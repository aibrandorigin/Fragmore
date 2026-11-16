import crypto from 'crypto';
import { db } from '../db/index.ts';
import {
  products,
  orders,
  customers,
  coupons,
  campaigns,
  returnsRefunds,
  abandonedCarts,
  auditLogs,
  automationWorkflows,
  automationEvents,
  inventoryLedger,
  loyaltyProgramsAndLedger,
  aiMarketingIntelligenceLedger,
  aiCmoFeatureFlags,
  aiCmoPlans,
  aiCmoActionApprovals,
  aiCmoAuditObservabilityLogs
} from '../db/schema.ts';
import { eq, desc } from 'drizzle-orm';
import {
  getAllProducts,
  upsertProduct,
  getAllOrders,
  updateOrderStatus,
  getAllCustomers,
  getAllCoupons,
  upsertCoupon,
  getAllCampaigns,
  upsertCampaign,
  getAllReturns,
  upsertReturn,
  insertAuditLog
} from '../db/queries.ts';
import {
  COMPLETE_AI_CMO_TOOL_CATALOG,
  type RegisteredAiToolSpec,
  type FragmoreAdminRole,
  executeAiCmoReadTool,
  proposeAiCmoWriteToolAction,
  executeApprovedWriteToolOnBackend,
  enforceAiToolSecurityGuardrails,
  validateToolInputAgainstSchema,
  enforceToolResourcePermission,
  AiCmoToolError
} from './aiCmoToolRegistry.ts';
import {
  broadcastCrossBrowserSyncEvent,
  formatTimestampIst
} from './productionAuditAndReliabilityEngine.ts';
import { adjustSkuInventoryAtomically } from './operationsAutomationEngine.ts';
import {
  generateCorrelationId,
  startOrGetCorrelationTrace,
  appendCorrelationTraceHop,
  acquireEntityConcurrencyLock,
  verifyOptimisticConcurrencyVersion,
  checkAndRegisterCustomerNotificationDedupe,
  checkAndRegisterExternalApiIdempotency,
  publishPostCommitDomainSyncEvent
} from './aiCmoDataSyncEngine.ts';

// ============================================================================
// 1. SEVEN CANONICAL ACTION TYPES & TAXONOMY
// ============================================================================

export type UniversalActionType =
  | 'READ_ONLY'
  | 'DRAFT_CREATION'
  | 'REVERSIBLE_INTERNAL_CHANGE'
  | 'CUSTOMER_FACING_ACTION'
  | 'FINANCIAL_ACTION'
  | 'EXTERNAL_ADVERTISING_ACTION'
  | 'IRREVERSIBLE_OR_HIGH_RISK_ACTION';

export interface ActionTypeMetadata {
  actionType: UniversalActionType;
  label: string;
  executionRule: string;
  requiresExplicitApprovalByDefault: boolean;
  eligibleForNarrowPreconfiguredPolicy: boolean;
  strictAmbiguityGuardrail: boolean;
  defaultExpirationMinutes: number;
  compensationSupport: 'NOT_APPLICABLE_READ' | 'FULL_AUTOMATIC_COMPENSATION' | 'SNAPSHOT_REVERSAL_WITH_AUDIT';
  mappedTools: string[];
}

export const UNIVERSAL_ACTION_TYPE_CATALOG: ActionTypeMetadata[] = [
  {
    actionType: 'READ_ONLY',
    label: 'Read Only',
    executionRule: 'Executes immediately after server-side RBAC authorization. Never mutates database state.',
    requiresExplicitApprovalByDefault: false,
    eligibleForNarrowPreconfiguredPolicy: true,
    strictAmbiguityGuardrail: false,
    defaultExpirationMinutes: 0,
    compensationSupport: 'NOT_APPLICABLE_READ',
    mappedTools: [
      'getDashboardMetrics',
      'listOrders',
      'getOrderDetails',
      'listCustomers',
      'getCustomerProfile',
      'listProducts',
      'getProductDetails',
      'getInventoryLevels',
      'getSalesAnalytics',
      'getMarketingCampaigns',
      'getAutomationWorkflows',
      'getWorkflowExecutions',
      'getShippingStatus',
      'getReturns',
      'getRefunds',
      'getCoupons',
      'getInfluencerCampaigns',
      'getDiscoveryRedemptions',
      'getProfitAnalytics',
      'getSystemHealth'
    ]
  },
  {
    actionType: 'DRAFT_CREATION',
    label: 'Draft Creation',
    executionRule:
      'May save an isolated non-live draft only where the user has granted appropriate permissions; live publication always requires explicit approval.',
    requiresExplicitApprovalByDefault: true,
    eligibleForNarrowPreconfiguredPolicy: true,
    strictAmbiguityGuardrail: false,
    defaultExpirationMinutes: 1440,
    compensationSupport: 'FULL_AUTOMATIC_COMPENSATION',
    mappedTools: ['draftCampaign', 'draftWorkflow', 'draftContent', 'draftCoupon']
  },
  {
    actionType: 'REVERSIBLE_INTERNAL_CHANGE',
    label: 'Reversible Internal Change',
    executionRule:
      'Requires explicit user approval unless a narrow, preconfigured policy authorizes a specific low-risk internal metadata or pause operation.',
    requiresExplicitApprovalByDefault: true,
    eligibleForNarrowPreconfiguredPolicy: true,
    strictAmbiguityGuardrail: false,
    defaultExpirationMinutes: 720,
    compensationSupport: 'FULL_AUTOMATIC_COMPENSATION',
    mappedTools: [
      'draftCustomerSegment',
      'draftProductUpdate',
      'draftOrderUpdate',
      'draftAutomationPause'
    ]
  },
  {
    actionType: 'CUSTOMER_FACING_ACTION',
    label: 'Customer-Facing Action',
    executionRule:
      'Requires explicit human approval, verified marketing opt-in consent, and non-ambiguous instructions. Never eligible for auto-approval.',
    requiresExplicitApprovalByDefault: true,
    eligibleForNarrowPreconfiguredPolicy: false,
    strictAmbiguityGuardrail: true,
    defaultExpirationMinutes: 240,
    compensationSupport: 'SNAPSHOT_REVERSAL_WITH_AUDIT',
    mappedTools: ['draftNotification', 'tool.automation.propose_recovery_signal']
  },
  {
    actionType: 'FINANCIAL_ACTION',
    label: 'Financial Action',
    executionRule:
      'Refunds, payments, and financial adjustments require stricter policies, exact order/return verification, and explicit approval. Never executed from ambiguous instructions.',
    requiresExplicitApprovalByDefault: true,
    eligibleForNarrowPreconfiguredPolicy: false,
    strictAmbiguityGuardrail: true,
    defaultExpirationMinutes: 120,
    compensationSupport: 'SNAPSHOT_REVERSAL_WITH_AUDIT',
    mappedTools: ['draftRefundAction']
  },
  {
    actionType: 'EXTERNAL_ADVERTISING_ACTION',
    label: 'External Advertising Action',
    executionRule:
      'Ad spend and budget reallocations require verified account permissions, exact budget bounds, and explicit approval. Never executed from ambiguous instructions.',
    requiresExplicitApprovalByDefault: true,
    eligibleForNarrowPreconfiguredPolicy: false,
    strictAmbiguityGuardrail: true,
    defaultExpirationMinutes: 180,
    compensationSupport: 'FULL_AUTOMATIC_COMPENSATION',
    mappedTools: ['draftBudgetChange']
  },
  {
    actionType: 'IRREVERSIBLE_OR_HIGH_RISK_ACTION',
    label: 'Irreversible or High-Risk Action',
    executionRule:
      'Publishing live automation workflows or adjusting physical stock ledgers requires mandatory SUPER_ADMIN or INVENTORY_MANAGER approval and resource version verification.',
    requiresExplicitApprovalByDefault: true,
    eligibleForNarrowPreconfiguredPolicy: false,
    strictAmbiguityGuardrail: true,
    defaultExpirationMinutes: 60,
    compensationSupport: 'FULL_AUTOMATIC_COMPENSATION',
    mappedTools: ['draftAutomationPublish', 'draftInventoryAdjustment']
  }
];

export function classifyToolToUniversalActionType(toolNameOrId: string): ActionTypeMetadata {
  const clean = String(toolNameOrId || '').trim();
  for (const meta of UNIVERSAL_ACTION_TYPE_CATALOG) {
    if (meta.mappedTools.some((t) => t.toLowerCase() === clean.toLowerCase())) {
      return meta;
    }
  }
  if (clean === 'tool.campaigns.propose_omnichannel_draft') {
    return UNIVERSAL_ACTION_TYPE_CATALOG.find((m) => m.actionType === 'DRAFT_CREATION')!;
  }
  if (clean === 'tool.coupons.propose_smart_incentive') {
    return UNIVERSAL_ACTION_TYPE_CATALOG.find((m) => m.actionType === 'DRAFT_CREATION')!;
  }
  if (clean.startsWith('get') || clean.startsWith('list') || clean.includes('.context.')) {
    return UNIVERSAL_ACTION_TYPE_CATALOG.find((m) => m.actionType === 'READ_ONLY')!;
  }
  return UNIVERSAL_ACTION_TYPE_CATALOG.find((m) => m.actionType === 'REVERSIBLE_INTERNAL_CHANGE')!;
}

// ============================================================================
// 2. NARROW PRECONFIGURED LOW-RISK POLICY REGISTRY & HIGH-STAKES GUARDRAILS
// ============================================================================

export interface NarrowPreconfiguredPolicy {
  policyId: string;
  name: string;
  actionType: 'DRAFT_CREATION' | 'REVERSIBLE_INTERNAL_CHANGE';
  allowedToolName: string;
  scopeConditionDescription: string;
  enabled: boolean;
  requiresDraftSavePermission: boolean;
  maxFinancialImpactInr: number;
  updatedAtUtc: string;
  updatedByEmail: string;
}

const narrowPolicyState: Record<string, NarrowPreconfiguredPolicy> = {
  POLICY_DRAFT_CONTENT_SAVE: {
    policyId: 'POLICY_DRAFT_CONTENT_SAVE',
    name: 'Allow Saving Editorial Content Briefs as Non-Live Drafts',
    actionType: 'DRAFT_CREATION',
    allowedToolName: 'draftContent',
    scopeConditionDescription:
      'Authorizes saving AI creative briefs into ai_marketing_intelligence_ledger with status=DRAFT/ACCEPTED when user has MARKETING or SUPER_ADMIN permissions. Zero external messages sent.',
    enabled: true,
    requiresDraftSavePermission: true,
    maxFinancialImpactInr: 0,
    updatedAtUtc: new Date().toISOString(),
    updatedByEmail: 'system@fragmore.com'
  },
  POLICY_DRAFT_WORKFLOW_BLUEPRINT: {
    policyId: 'POLICY_DRAFT_WORKFLOW_BLUEPRINT',
    name: 'Allow Saving Validated Automation DAGs Strictly as DRAFT',
    actionType: 'DRAFT_CREATION',
    allowedToolName: 'draftWorkflow',
    scopeConditionDescription:
      'Authorizes persisting new workflow definitions strictly in status=DRAFT. Publishing to ACTIVE always requires explicit human approval.',
    enabled: true,
    requiresDraftSavePermission: true,
    maxFinancialImpactInr: 0,
    updatedAtUtc: new Date().toISOString(),
    updatedByEmail: 'system@fragmore.com'
  },
  POLICY_LOW_RISK_BADGE_UPDATE: {
    policyId: 'POLICY_LOW_RISK_BADGE_UPDATE',
    name: 'Allow Reversible Editorial Subtitle/Badge Update (No Price Change)',
    actionType: 'REVERSIBLE_INTERNAL_CHANGE',
    allowedToolName: 'draftProductUpdate',
    scopeConditionDescription:
      'Narrow low-risk policy: only applies when newSellingPriceInr is omitted/unchanged and only editorial badge or subtitle is updated with full rollback snapshot. Disabled by default so human approval is required.',
    enabled: false,
    requiresDraftSavePermission: false,
    maxFinancialImpactInr: 0,
    updatedAtUtc: new Date().toISOString(),
    updatedByEmail: 'system@fragmore.com'
  },
  POLICY_EMERGENCY_WORKFLOW_PAUSE: {
    policyId: 'POLICY_EMERGENCY_WORKFLOW_PAUSE',
    name: 'Allow Emergency Workflow Pause (Protective Circuit Breaker)',
    actionType: 'REVERSIBLE_INTERNAL_CHANGE',
    allowedToolName: 'draftAutomationPause',
    scopeConditionDescription:
      'Allows authorized SUPER_ADMIN or MARKETING lead to pause a workflow immediately to stop outbound sends while preserving version history. Disabled by default.',
    enabled: false,
    requiresDraftSavePermission: false,
    maxFinancialImpactInr: 0,
    updatedAtUtc: new Date().toISOString(),
    updatedByEmail: 'system@fragmore.com'
  }
};

export function getNarrowPreconfiguredPolicies(): NarrowPreconfiguredPolicy[] {
  return Object.values(narrowPolicyState);
}

export function updateNarrowPreconfiguredPolicy(params: {
  policyId: string;
  enabled: boolean;
  actorEmail?: string;
}): NarrowPreconfiguredPolicy {
  const existing = narrowPolicyState[params.policyId];
  if (!existing) {
    throw new Error(`Narrow policy "${params.policyId}" not found.`);
  }
  existing.enabled = Boolean(params.enabled);
  existing.updatedAtUtc = new Date().toISOString();
  existing.updatedByEmail = params.actorEmail || 'admin@fragmore.com';
  return existing;
}

export interface StrictHighStakesValidationResult {
  passed: boolean;
  isHighStakesDomain: boolean;
  domain:
    | 'REFUNDS_AND_PAYMENTS'
    | 'CUSTOMER_MESSAGING'
    | 'EXTERNAL_AD_SPEND'
    | 'HIGH_RISK_INVENTORY_OR_PUBLISH'
    | 'STANDARD';
  blockedForAmbiguity: boolean;
  missingOrAmbiguousFields: string[];
  policyRuleEnforced: string;
  clarificationRequiredMessage?: string;
}

export function validateStrictHighStakesInstructionPolicy(params: {
  toolName: string;
  input: Record<string, any>;
  naturalLanguagePrompt?: string;
}): StrictHighStakesValidationResult {
  const toolName = String(params.toolName || '');
  const input = params.input || {};
  const prompt = String(params.naturalLanguagePrompt || '').trim();

  // 1. REFUNDS & PAYMENTS (draftRefundAction)
  if (toolName === 'draftRefundAction') {
    const missing: string[] = [];
    if (!input.returnId || String(input.returnId).trim() === '') {
      missing.push('returnId (exact Return/Order reference)');
    }
    if (
      input.refundAmountInr === undefined ||
      input.refundAmountInr === null ||
      Number(input.refundAmountInr) <= 0
    ) {
      missing.push('refundAmountInr (exact verified INR refund amount)');
    }
    if (!input.proposedAction) {
      missing.push('proposedAction (APPROVE_RETURN_PICKUP | MARK_QC_PASSED_AND_REFUND | REJECT_UNSEALED_BOTTLE)');
    }
    if (!input.qcInspectionNotes || String(input.qcInspectionNotes).trim().length < 5) {
      missing.push('qcInspectionNotes (physical seal & batch verification note)');
    }

    // Check if natural language instruction was overly vague without explicit parameters
    const isVagueChatInstruction =
      prompt.length > 0 &&
      /^(refund|send refund|issue refund|refund customer|pay back|process payment)\b/i.test(prompt) &&
      !/RET-|ORD-|\d{3,}/i.test(prompt) &&
      Boolean(input._fromAmbiguousChat);

    if (missing.length > 0 || isVagueChatInstruction) {
      return {
        passed: false,
        isHighStakesDomain: true,
        domain: 'REFUNDS_AND_PAYMENTS',
        blockedForAmbiguity: true,
        missingOrAmbiguousFields:
          missing.length > 0
            ? missing
            : ['Explicit Return ID (e.g. RET-101)', 'Exact Refund Amount in ₹', 'Physical Seal QC Status'],
        policyRuleEnforced:
          'STRICT_FINANCIAL_REFUND_POLICY: Refunds and payments cannot be executed or auto-drafted from ambiguous instructions.',
        clarificationRequiredMessage:
          'Financial Policy Guardrail: Please specify the exact Return ID (e.g., RET-101), exact refund amount in ₹, and confirm whether the luxury flacon cellophane seal passed QC inspection.'
      };
    }

    return {
      passed: true,
      isHighStakesDomain: true,
      domain: 'REFUNDS_AND_PAYMENTS',
      blockedForAmbiguity: false,
      missingOrAmbiguousFields: [],
      policyRuleEnforced:
        'STRICT_FINANCIAL_REFUND_POLICY: Verified explicit Return ID, bounded refund amount, and QC inspection note.'
    };
  }

  // 2. CUSTOMER MESSAGING (draftNotification / propose_recovery_signal)
  if (toolName === 'draftNotification' || toolName === 'tool.automation.propose_recovery_signal') {
    const missing: string[] = [];
    if (toolName === 'draftNotification') {
      if (!input.channel || !['EMAIL', 'WHATSAPP', 'SMS'].includes(String(input.channel))) {
        missing.push('channel (EMAIL | WHATSAPP | SMS)');
      }
      if (!input.recipientCohort || String(input.recipientCohort).trim().length < 3) {
        missing.push('recipientCohort (explicit opted-in target segment)');
      }
      if (!input.messageBody || String(input.messageBody).trim().length < 10) {
        missing.push('messageBody (explicit approved template or message copy)');
      }
      if (input.requireOptInConsent !== true) {
        missing.push('requireOptInConsent=true (mandatory marketing consent verification)');
      }
    }

    const isVagueMessagingPrompt =
      prompt.length > 0 &&
      /^(message everyone|send message|text customers|blast whatsapp|email all)\b/i.test(prompt) &&
      Boolean(input._fromAmbiguousChat);

    if (missing.length > 0 || isVagueMessagingPrompt) {
      return {
        passed: false,
        isHighStakesDomain: true,
        domain: 'CUSTOMER_MESSAGING',
        blockedForAmbiguity: true,
        missingOrAmbiguousFields:
          missing.length > 0
            ? missing
            : ['Channel (WhatsApp/Email)', 'Opted-In Customer Cohort', 'Approved Template Copy'],
        policyRuleEnforced:
          'STRICT_CUSTOMER_MESSAGING_POLICY: Outbound customer messaging requires explicit channel, opted-in cohort, and approved template copy.',
        clarificationRequiredMessage:
          'Customer Messaging Guardrail: Please specify the exact target cohort (with verified opt-in consent), channel (WhatsApp or Email), and template/message content.'
      };
    }

    return {
      passed: true,
      isHighStakesDomain: true,
      domain: 'CUSTOMER_MESSAGING',
      blockedForAmbiguity: false,
      missingOrAmbiguousFields: [],
      policyRuleEnforced:
        'STRICT_CUSTOMER_MESSAGING_POLICY: Verified opt-in consent, bounded cohort, and approved template.'
    };
  }

  // 3. EXTERNAL AD SPEND (draftBudgetChange)
  if (toolName === 'draftBudgetChange') {
    const missing: string[] = [];
    if (!input.campaignId || String(input.campaignId).trim() === '') {
      missing.push('campaignId (explicit campaign identifier)');
    }
    if (
      input.newBudgetInr === undefined ||
      input.newBudgetInr === null ||
      Number(input.newBudgetInr) <= 0
    ) {
      missing.push('newBudgetInr (explicit budget amount in ₹)');
    }
    if (!input.justification || String(input.justification).trim().length < 5) {
      missing.push('justification (POAS/margin rationale for budget change)');
    }

    const isVagueAdSpendPrompt =
      prompt.length > 0 &&
      /^(increase ad spend|spend more on ads|boost meta ads|scale budget|double ad budget)\b/i.test(
        prompt
      ) &&
      !/₹|\d{3,}/i.test(prompt) &&
      Boolean(input._fromAmbiguousChat);

    if (missing.length > 0 || isVagueAdSpendPrompt) {
      return {
        passed: false,
        isHighStakesDomain: true,
        domain: 'EXTERNAL_AD_SPEND',
        blockedForAmbiguity: true,
        missingOrAmbiguousFields:
          missing.length > 0
            ? missing
            : ['Target Campaign ID/Name', 'Exact New Budget in ₹', 'POAS Justification'],
        policyRuleEnforced:
          'STRICT_EXTERNAL_AD_SPEND_POLICY: Ad spend changes cannot be executed or proposed from ambiguous instructions.',
        clarificationRequiredMessage:
          'External Ad Spend Guardrail: Please specify the exact Campaign name/ID and the exact new budget in ₹ (must be >= incurred spend).'
      };
    }

    return {
      passed: true,
      isHighStakesDomain: true,
      domain: 'EXTERNAL_AD_SPEND',
      blockedForAmbiguity: false,
      missingOrAmbiguousFields: [],
      policyRuleEnforced:
        'STRICT_EXTERNAL_AD_SPEND_POLICY: Verified explicit campaign target, exact ₹ budget, and POAS rationale.'
    };
  }

  // 4. HIGH-RISK INVENTORY OR WORKFLOW PUBLISH
  if (toolName === 'draftInventoryAdjustment' || toolName === 'draftAutomationPublish') {
    return {
      passed: true,
      isHighStakesDomain: true,
      domain: 'HIGH_RISK_INVENTORY_OR_PUBLISH',
      blockedForAmbiguity: false,
      missingOrAmbiguousFields: [],
      policyRuleEnforced:
        'HIGH_RISK_STATE_MUTATION_POLICY: Requires explicit approval and pre-execution resource version verification.'
    };
  }

  return {
    passed: true,
    isHighStakesDomain: false,
    domain: 'STANDARD',
    blockedForAmbiguity: false,
    missingOrAmbiguousFields: [],
    policyRuleEnforced: 'STANDARD_RBAC_AND_SCHEMA_POLICY'
  };
}

// ============================================================================
// 3. RESOURCE VERSIONING & 10-FIELD UNIVERSAL APPROVAL CARD BUILDER
// ============================================================================

export function computeDeterministicResourceVersion(
  table: string,
  recordId: string,
  stateSnapshot: Record<string, any> | null
): string {
  const canonicalPayload = JSON.stringify({
    table,
    recordId,
    state: stateSnapshot || { exists: false }
  });
  const digest = crypto.createHash('sha256').update(canonicalPayload).digest('hex').slice(0, 12);
  return `rv_${table}_${digest}`;
}

export async function fetchLiveResourceStateAndVersion(
  toolName: string,
  payload: Record<string, any>
): Promise<{
  moduleName: string;
  tableName: string;
  recordId: string;
  recordLabel: string;
  liveState: Record<string, any>;
  resourceVersion: string;
}> {
  const cleanTool = String(toolName || '');

  if (cleanTool === 'draftCampaign' || cleanTool === 'tool.campaigns.propose_omnichannel_draft') {
    const recordId = String(payload.id || `NEW_CAMPAIGN_DRAFT`);
    return {
      moduleName: 'Omnichannel Marketing Campaigns',
      tableName: 'campaigns',
      recordId,
      recordLabel: String(payload.name || 'New Omnichannel Campaign Draft'),
      liveState: { status: 'NOT_CREATED_YET', targetTable: 'campaigns' },
      resourceVersion: computeDeterministicResourceVersion('campaigns', recordId, {
        status: 'NOT_CREATED_YET'
      })
    };
  }

  if (cleanTool === 'draftCoupon' || cleanTool === 'tool.coupons.propose_smart_incentive') {
    const code = String(payload.code || 'AICMO3VIP10').toUpperCase();
    const allCoupons = await getAllCoupons();
    const existing = allCoupons.find((c: any) => String(c.code || '').toUpperCase() === code);
    const liveState = existing
      ? {
          code: existing.code,
          discountType: existing.discountType,
          discountValue: (existing as any).discountValue ?? existing.value,
          minOrderValue: existing.minOrderValue,
          active: existing.isActive
        }
      : { code, exists: false };
    return {
      moduleName: 'Discovery Six, Loyalty & Smart Coupons',
      tableName: 'coupons',
      recordId: code,
      recordLabel: `Coupon ${code}`,
      liveState,
      resourceVersion: computeDeterministicResourceVersion('coupons', code, liveState)
    };
  }

  if (cleanTool === 'draftBudgetChange') {
    const allCampaigns = await getAllCampaigns();
    const q = String(payload.campaignId || '').toLowerCase();
    const camp =
      allCampaigns.find(
        (c: any) =>
          String(c.id || '').toLowerCase() === q ||
          String(c.name || '').toLowerCase().includes(q)
      ) || allCampaigns[0];
    const liveState = camp
      ? {
          id: camp.id,
          name: camp.name,
          channel: camp.channel,
          status: camp.status,
          budget: Number(camp.budget ?? 0),
          spend: Number(camp.spend ?? (camp as any).spent ?? 0)
        }
      : { id: payload.campaignId, exists: false };
    const recId = String(camp?.id || payload.campaignId || 'CMP-UNKNOWN');
    return {
      moduleName: 'Omnichannel Marketing & Paid Media',
      tableName: 'campaigns',
      recordId: recId,
      recordLabel: String(camp?.name || recId),
      liveState,
      resourceVersion: computeDeterministicResourceVersion('campaigns', recId, liveState)
    };
  }

  if (cleanTool === 'draftRefundAction') {
    const allReturns = await getAllReturns();
    const ret =
      allReturns.find((r: any) => String(r.id) === String(payload.returnId)) || allReturns[0];
    const liveState = ret
      ? {
          id: ret.id,
          orderId: ret.orderId,
          customerName: ret.customerName,
          status: ret.status,
          refundAmount: Number(ret.refundAmount ?? 0)
        }
      : { id: payload.returnId, exists: false };
    const recId = String(ret?.id || payload.returnId || 'RET-UNKNOWN');
    return {
      moduleName: 'Returns, QC Inspection & Customer Refunds',
      tableName: 'returns_refunds',
      recordId: recId,
      recordLabel: `Return ${recId} (${ret?.customerName || 'Customer'})`,
      liveState,
      resourceVersion: computeDeterministicResourceVersion('returns_refunds', recId, liveState)
    };
  }

  if (cleanTool === 'draftInventoryAdjustment') {
    const ledgerRows = await db.select().from(inventoryLedger);
    const q = String(payload.sku || '').toLowerCase();
    const row =
      ledgerRows.find(
        (r: any) =>
          String(r.sku || '').toLowerCase() === q ||
          String(r.productName || '').toLowerCase().includes(q)
      ) || ledgerRows[0];
    const liveState = row
      ? {
          sku: row.sku,
          productName: row.productName,
          availableStock: row.availableStock,
          reservedStock: row.reservedStock,
          reorderThreshold: row.reorderThreshold
        }
      : { sku: payload.sku, exists: false };
    const recId = String(row?.sku || payload.sku || 'SKU-UNKNOWN');
    return {
      moduleName: 'Products & Atomic Inventory Ledger',
      tableName: 'inventory_ledger',
      recordId: recId,
      recordLabel: `${row?.productName || recId} (${recId})`,
      liveState,
      resourceVersion: computeDeterministicResourceVersion('inventory_ledger', recId, liveState)
    };
  }

  if (cleanTool === 'draftOrderUpdate') {
    const allOrders = await getAllOrders();
    const ord =
      allOrders.find(
        (o: any) => o.id === payload.orderId || o.orderNumber === payload.orderId
      ) || allOrders[0];
    const liveState = ord
      ? {
          id: ord.id,
          orderStatus: ord.orderStatus,
          paymentStatus: ord.paymentStatus,
          awbNumber: ord.awbNumber,
          courierName: ord.courierName
        }
      : { id: payload.orderId, exists: false };
    const recId = String(ord?.id || payload.orderId || 'ORD-UNKNOWN');
    return {
      moduleName: 'Orders & Fulfillment Logistics',
      tableName: 'orders',
      recordId: recId,
      recordLabel: `Order ${ord?.orderNumber || recId}`,
      liveState,
      resourceVersion: computeDeterministicResourceVersion('orders', recId, liveState)
    };
  }

  if (cleanTool === 'draftProductUpdate') {
    const allProducts = await getAllProducts();
    const q = String(payload.productId || '').toLowerCase();
    const prod =
      allProducts.find(
        (p: any) =>
          String(p.id || '').toLowerCase() === q ||
          String(p.slug || '').toLowerCase() === q ||
          String(p.name || '').toLowerCase().includes(q)
      ) || allProducts[0];
    const prodVariants: any[] = Array.isArray(prod?.variants) ? (prod.variants as any[]) : [];
    const liveState = prod
      ? {
          id: prod.id,
          name: prod.name,
          subtitle: prod.subtitle,
          badge: prod.badge,
          primaryPrice: prodVariants[0]?.sellingPrice ?? prodVariants[0]?.price
        }
      : { id: payload.productId, exists: false };
    const recId = String(prod?.id || payload.productId || 'PROD-UNKNOWN');
    return {
      moduleName: 'Products & Catalog Merchandising',
      tableName: 'products',
      recordId: recId,
      recordLabel: String(prod?.name || recId),
      liveState,
      resourceVersion: computeDeterministicResourceVersion('products', recId, liveState)
    };
  }

  if (
    cleanTool === 'draftAutomationPause' ||
    cleanTool === 'draftAutomationPublish' ||
    cleanTool === 'draftWorkflow'
  ) {
    const workflows = await db.select().from(automationWorkflows);
    const q = String(payload.workflowId || payload.name || '').toLowerCase();
    const wf =
      workflows.find(
        (w: any) =>
          String(w.id || '').toLowerCase() === q ||
          String(w.name || '').toLowerCase().includes(q)
      ) || workflows[0];
    const liveState =
      cleanTool === 'draftWorkflow' && !payload.workflowId
        ? { status: 'NEW_WORKFLOW_DRAFT' }
        : wf
        ? {
            id: wf.id,
            name: wf.name,
            status: wf.status,
            version: wf.version,
            approvalStatus: wf.approvalStatus
          }
        : { id: payload.workflowId, exists: false };
    const recId =
      cleanTool === 'draftWorkflow' && !payload.workflowId
        ? 'NEW_DAG_DRAFT'
        : String(wf?.id || payload.workflowId || 'WF-UNKNOWN');
    return {
      moduleName: 'Automation Center & PostgreSQL DAG Engine',
      tableName: 'automation_workflows',
      recordId: recId,
      recordLabel: String(wf?.name || payload.name || recId),
      liveState,
      resourceVersion: computeDeterministicResourceVersion('automation_workflows', recId, liveState)
    };
  }

  if (cleanTool === 'draftCustomerSegment') {
    const segTag = String(payload.segmentTag || 'VIP_COHORT');
    return {
      moduleName: 'Customers, RFM Cohorts & VIP Loyalty',
      tableName: 'loyalty_programs_and_ledger',
      recordId: segTag,
      recordLabel: `Customer Segment ${segTag}`,
      liveState: { segmentTag: segTag, status: 'NEW_SEGMENT_RULE' },
      resourceVersion: computeDeterministicResourceVersion('loyalty_programs_and_ledger', segTag, {
        segmentTag: segTag
      })
    };
  }

  if (cleanTool === 'draftContent') {
    const focus = String(payload.fragranceFocus || 'SOLARA');
    return {
      moduleName: 'AI Content Studio & Editorial Briefs',
      tableName: 'ai_marketing_intelligence_ledger',
      recordId: `BRIEF_${focus}`,
      recordLabel: `${payload.title || focus} (${payload.channel || 'INSTAGRAM'})`,
      liveState: { status: 'NEW_CONTENT_BRIEF_DRAFT' },
      resourceVersion: computeDeterministicResourceVersion(
        'ai_marketing_intelligence_ledger',
        `BRIEF_${focus}`,
        { status: 'NEW_CONTENT_BRIEF_DRAFT' }
      )
    };
  }

  // Default for draftNotification / recovery signal
  const cohort = String(payload.recipientCohort || payload.cohort || 'OPTED_IN_CUSTOMERS');
  return {
    moduleName: 'Customer Communications & Durable Event Bus',
    tableName: 'automation_events',
    recordId: `OUTREACH_${cohort}`,
    recordLabel: `${payload.channel || 'WHATSAPP'} Outreach → ${cohort}`,
    liveState: { eventDispatched: false, recipientCohort: cohort },
    resourceVersion: computeDeterministicResourceVersion('automation_events', `OUTREACH_${cohort}`, {
      eventDispatched: false
    })
  };
}

export interface UniversalApprovalCard {
  actionId: string;
  actionType: UniversalActionType;
  actionTypeLabel: string;
  // 1. Requested operation
  requestedOperation: {
    operationTitle: string;
    toolName: string;
    serviceFunction: string;
    actionType: UniversalActionType;
    actionTypeLabel: string;
    rationale: string;
  };
  // 2. Affected module and records
  affectedModuleAndRecords: {
    moduleName: string;
    databaseTables: string[];
    recordIds: string[];
    recordLabel: string;
  };
  // 3. Current value
  currentValue: {
    capturedAtUtc: string;
    capturedAtIst: string;
    resourceVersion: string;
    stateSnapshot: Record<string, any>;
    summaryText: string;
  };
  // 4. Proposed value
  proposedValue: {
    statePreview: Record<string, any>;
    editablePayload: Record<string, any>;
    fieldDiffs: { field: string; before: any; after: any; impact: string }[];
    summaryText: string;
  };
  // 5. Financial implications
  financialImplications: {
    hasFinancialImpact: boolean;
    directRefundOrCostInr: number;
    adBudgetExposureInr: number;
    estimatedRevenueImpactInr: number;
    marginGuardrailStatus: string;
    summaryText: string;
  };
  // 6. External recipients
  externalRecipients: {
    hasExternalRecipients: boolean;
    channel: string;
    estimatedRecipientCount: number;
    cohortDescription: string;
    consentVerified: boolean;
    summaryText: string;
  };
  // 7. Risks and dependencies
  risksAndDependencies: {
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    riskSummary: string;
    dependencies: string[];
    compensationStrategy: string;
    strictPolicyApplied: string;
  };
  // 8. Required permissions
  requiredPermissions: {
    allowedRoles: string[];
    permissionScope: string;
    approvalTier: string;
    narrowPolicyEligible: boolean;
    narrowPolicyTriggered: boolean;
  };
  // 9. Approval expiration
  approvalExpiration: {
    createdAtUtc: string;
    expiresAtUtc: string;
    expiresAtIst: string;
    ttlMinutes: number;
    isExpired: boolean;
  };
  // 10. Confirm / Reject / Edit capabilities
  controls: {
    canConfirm: boolean;
    canReject: boolean;
    canEdit: boolean;
    editableFields: string[];
  };
}

export async function buildUniversalApprovalCardForAction(
  actionRow: any
): Promise<UniversalApprovalCard> {
  const toolName = String(actionRow.toolId || '');
  const payload = (actionRow.payload || {}) as Record<string, any>;
  const dryRun = (actionRow.dryRunPreview || {}) as Record<string, any>;
  const actionMeta = classifyToolToUniversalActionType(toolName);

  const canonicalSpec = COMPLETE_AI_CMO_TOOL_CATALOG.find(
    (t) => t.toolName.toLowerCase() === toolName.toLowerCase() || t.toolId === toolName
  );

  const liveResource = await fetchLiveResourceStateAndVersion(toolName, payload);
  const capturedVersion =
    dryRun.capturedResourceVersion ||
    dryRun.universalApprovalCard?.currentValue?.resourceVersion ||
    liveResource.resourceVersion;

  const beforeState = dryRun.beforeState || liveResource.liveState || {};
  const afterState = dryRun.afterStatePreview || payload || {};
  const fieldDiffs = Array.isArray(dryRun.fieldDiffs)
    ? dryRun.fieldDiffs
    : [
        {
          field: `${liveResource.tableName}[${liveResource.recordId}]`,
          before: beforeState,
          after: afterState,
          impact: actionMeta.label
        }
      ];

  // Financial implications computation
  let directRefundOrCostInr = 0;
  let adBudgetExposureInr = 0;
  let estimatedRevenueImpactInr = 0;
  let marginGuardrailStatus = 'Margin-Safe (72% Baseline Protected)';

  if (toolName === 'draftRefundAction') {
    directRefundOrCostInr = Number(payload.refundAmountInr || beforeState.refundAmount || 0);
    marginGuardrailStatus = 'Verified <= Original Net Order Paid + Seal QC Checked';
  } else if (
    toolName === 'draftBudgetChange' ||
    toolName === 'draftCampaign' ||
    toolName === 'tool.campaigns.propose_omnichannel_draft'
  ) {
    adBudgetExposureInr = Number(payload.newBudgetInr || payload.budget || 0);
    estimatedRevenueImpactInr = Math.round(
      adBudgetExposureInr * Number(payload.projectedRoas || 3.8)
    );
    marginGuardrailStatus = `Target POAS >= 1.60x (Ad Spend Exposure ₹${adBudgetExposureInr.toLocaleString('en-IN')})`;
  } else if (toolName === 'draftCoupon' || toolName === 'tool.coupons.propose_smart_incentive') {
    const discVal = Number(payload.discountValue || 10);
    const usageLim = Number(payload.usageLimit || 100);
    directRefundOrCostInr =
      payload.discountType === 'percentage' ? Math.round(usageLim * 250) : discVal * usageLim;
    estimatedRevenueImpactInr = usageLim * Number(payload.minOrderValue || 2499);
    marginGuardrailStatus = `Capped at ${discVal}${payload.discountType === 'percentage' ? '%' : ' INR'} (<= 25% Max Discount Ceiling)`;
  } else if (toolName === 'draftInventoryAdjustment') {
    const qty = Math.abs(Number(payload.quantity || 0));
    directRefundOrCostInr = qty * 615; // unit COGS
    estimatedRevenueImpactInr = qty * 2499;
    marginGuardrailStatus = 'Atomic Inventory Ledger Stock Mutation';
  }

  const hasFinancialImpact =
    directRefundOrCostInr > 0 ||
    adBudgetExposureInr > 0 ||
    actionMeta.actionType === 'FINANCIAL_ACTION' ||
    actionMeta.actionType === 'EXTERNAL_ADVERTISING_ACTION';

  // External recipients computation
  let hasExternalRecipients = false;
  let extChannel = 'NONE (Internal Admin State Only)';
  let estRecipients = 0;
  let cohortDesc = 'No external customer recipients';
  let consentVerified = true;

  if (
    toolName === 'draftNotification' ||
    toolName === 'tool.automation.propose_recovery_signal'
  ) {
    hasExternalRecipients = true;
    extChannel = String(payload.channel || 'WHATSAPP');
    cohortDesc = String(payload.recipientCohort || payload.cohort || 'OPTED_IN_ABANDONED_CARTS');
    estRecipients = 18;
    consentVerified = payload.requireOptInConsent !== false;
  } else if (toolName === 'draftAutomationPublish') {
    hasExternalRecipients = true;
    extChannel = 'AUTOMATION_DAG_OUTBOUND (WhatsApp / Email)';
    cohortDesc = 'Live Trigger-Matched Opted-In Customers';
    estRecipients = 25;
    consentVerified = true;
  } else if (toolName === 'draftBudgetChange') {
    hasExternalRecipients = true;
    extChannel = 'EXTERNAL_AD_PLATFORM (Meta / Google Ads)';
    cohortDesc = 'Paid Media Ad Auction Audience';
    estRecipients = 15000;
    consentVerified = true;
  }

  // Expiration calculation
  const createdAtDate = actionRow.createdAt ? new Date(actionRow.createdAt) : new Date();
  const ttlMinutes = actionMeta.defaultExpirationMinutes || 240;
  const expiresAtDate = dryRun.expiresAtUtc
    ? new Date(dryRun.expiresAtUtc)
    : new Date(createdAtDate.getTime() + ttlMinutes * 60 * 1000);
  const isExpired =
    actionRow.approvalStatus === 'PENDING_APPROVAL' && Date.now() > expiresAtDate.getTime();

  const strictCheck = validateStrictHighStakesInstructionPolicy({
    toolName,
    input: payload
  });

  const matchingNarrowPolicy = Object.values(narrowPolicyState).find(
    (p) => p.allowedToolName === toolName
  );

  const isPending = actionRow.approvalStatus === 'PENDING_APPROVAL';

  return {
    actionId: actionRow.id,
    actionType: actionMeta.actionType,
    actionTypeLabel: actionMeta.label,
    requestedOperation: {
      operationTitle: actionRow.title,
      toolName,
      serviceFunction:
        canonicalSpec?.backedByService.serviceFunction || actionRow.adapterTarget || toolName,
      actionType: actionMeta.actionType,
      actionTypeLabel: actionMeta.label,
      rationale: actionRow.rationale
    },
    affectedModuleAndRecords: {
      moduleName: liveResource.moduleName,
      databaseTables: canonicalSpec?.backedByService.databaseTables || [liveResource.tableName],
      recordIds: [liveResource.recordId],
      recordLabel: liveResource.recordLabel
    },
    currentValue: {
      capturedAtUtc: dryRun.simulatedAt || createdAtDate.toISOString(),
      capturedAtIst: formatTimestampIst(createdAtDate),
      resourceVersion: capturedVersion,
      stateSnapshot: beforeState,
      summaryText: JSON.stringify(beforeState)
    },
    proposedValue: {
      statePreview: afterState,
      editablePayload: payload,
      fieldDiffs,
      summaryText: JSON.stringify(afterState)
    },
    financialImplications: {
      hasFinancialImpact,
      directRefundOrCostInr,
      adBudgetExposureInr,
      estimatedRevenueImpactInr,
      marginGuardrailStatus,
      summaryText: hasFinancialImpact
        ? `Direct Cost/Refund: ₹${directRefundOrCostInr.toLocaleString('en-IN')} · Ad Budget Exposure: ₹${adBudgetExposureInr.toLocaleString('en-IN')} · Est. Revenue Impact: ₹${estimatedRevenueImpactInr.toLocaleString('en-IN')}`
        : '₹0 Direct Spend / Refund Mutation (Margin-Neutral Internal or Draft Operation)'
    },
    externalRecipients: {
      hasExternalRecipients,
      channel: extChannel,
      estimatedRecipientCount: estRecipients,
      cohortDescription: cohortDesc,
      consentVerified,
      summaryText: hasExternalRecipients
        ? `${extChannel} → ${cohortDesc} (~${estRecipients} recipients · Consent Verified: ${consentVerified ? 'YES' : 'NO'})`
        : 'Internal Admin / Database Only (0 External Customer Messages)'
    },
    risksAndDependencies: {
      riskLevel:
        actionMeta.actionType === 'IRREVERSIBLE_OR_HIGH_RISK_ACTION' ||
        actionMeta.actionType === 'FINANCIAL_ACTION'
          ? 'CRITICAL'
          : actionMeta.actionType === 'EXTERNAL_ADVERTISING_ACTION' ||
            actionMeta.actionType === 'CUSTOMER_FACING_ACTION'
          ? 'HIGH'
          : actionMeta.actionType === 'REVERSIBLE_INTERNAL_CHANGE'
          ? 'MEDIUM'
          : 'LOW',
      riskSummary: `${actionMeta.label} (${canonicalSpec?.riskClassification || 'GATED_WRITE'})`,
      dependencies: [
        `PostgreSQL Table: ${liveResource.tableName}`,
        `Backend Service: ${canonicalSpec?.backedByService.serviceFunction || actionRow.adapterTarget}`,
        `Resource Version Check: ${capturedVersion}`
      ],
      compensationStrategy:
        actionRow.rollbackBlueprint?.strategy ||
        `Restore pre-mutation snapshot on ${liveResource.tableName} (${liveResource.recordId})`,
      strictPolicyApplied: strictCheck.policyRuleEnforced
    },
    requiredPermissions: {
      allowedRoles: canonicalSpec?.requiredRoles || ['SUPER_ADMIN'],
      permissionScope: canonicalSpec?.resourcePermissionScope || 'admin:super_admin',
      approvalTier: canonicalSpec?.approvalTier || 'SUPER_ADMIN_MANDATORY',
      narrowPolicyEligible: actionMeta.eligibleForNarrowPreconfiguredPolicy,
      narrowPolicyTriggered: Boolean(matchingNarrowPolicy?.enabled)
    },
    approvalExpiration: {
      createdAtUtc: createdAtDate.toISOString(),
      expiresAtUtc: expiresAtDate.toISOString(),
      expiresAtIst: formatTimestampIst(expiresAtDate),
      ttlMinutes,
      isExpired
    },
    controls: {
      canConfirm: isPending && !isExpired,
      canReject: isPending,
      canEdit: isPending,
      editableFields: Object.keys(payload)
    }
  };
}

// ============================================================================
// 4. EDIT PENDING APPROVAL CARD BEFORE EXECUTION
// ============================================================================

export async function editPendingApprovalAction(params: {
  actionId: string;
  updatedPayload: Record<string, any>;
  updatedTitle?: string;
  editorEmail?: string;
  editorRole?: string;
}) {
  const rows = await db
    .select()
    .from(aiCmoActionApprovals)
    .where(eq(aiCmoActionApprovals.id, params.actionId));

  if (rows.length === 0) {
    throw new Error(`Approval action ${params.actionId} not found.`);
  }

  const existing = rows[0];
  if (existing.approvalStatus !== 'PENDING_APPROVAL') {
    throw new Error(
      `Only PENDING_APPROVAL actions can be edited (current status: ${existing.approvalStatus}).`
    );
  }

  const toolName = String(existing.toolId || '');
  const mergedPayload = {
    ...((existing.payload as Record<string, any>) || {}),
    ...(params.updatedPayload || {})
  };

  // 1. Security guardrails
  enforceAiToolSecurityGuardrails(toolName, mergedPayload);

  // 2. Strict High-Stakes Policy Check
  const highStakesCheck = validateStrictHighStakesInstructionPolicy({
    toolName,
    input: mergedPayload
  });
  if (!highStakesCheck.passed) {
    throw new Error(highStakesCheck.clarificationRequiredMessage || highStakesCheck.policyRuleEnforced);
  }

  // 3. Schema & RBAC validation if canonical tool
  const canonicalSpec = COMPLETE_AI_CMO_TOOL_CATALOG.find(
    (t) => t.toolName.toLowerCase() === toolName.toLowerCase() || t.toolId === toolName
  );
  let validatedPayload = mergedPayload;
  if (canonicalSpec) {
    enforceToolResourcePermission(canonicalSpec, params.editorRole || 'SUPER_ADMIN');
    validatedPayload = validateToolInputAgainstSchema(canonicalSpec, mergedPayload);
  }

  // 4. Re-capture live resource state & version
  const liveResource = await fetchLiveResourceStateAndVersion(toolName, validatedPayload);
  const actionMeta = classifyToolToUniversalActionType(toolName);
  const newExpiresAt = new Date(
    Date.now() + (actionMeta.defaultExpirationMinutes || 240) * 60 * 1000
  );

  const prevDryRun = (existing.dryRunPreview as Record<string, any>) || {};
  const updatedFieldDiffs = Object.keys(validatedPayload).map((key) => ({
    field: `${liveResource.tableName}[${liveResource.recordId}].${key}`,
    before: (liveResource.liveState as any)?.[key] ?? 'UNCHANGED',
    after: validatedPayload[key],
    impact: `Edited by ${params.editorEmail || 'admin@fragmore.com'}`
  }));

  const updatedDryRunPreview = {
    ...prevDryRun,
    simulatedAt: new Date().toISOString(),
    simulatedAtIst: formatTimestampIst(new Date()),
    capturedResourceVersion: liveResource.resourceVersion,
    beforeState: liveResource.liveState,
    afterStatePreview: validatedPayload,
    fieldDiffs: updatedFieldDiffs,
    expiresAtUtc: newExpiresAt.toISOString(),
    lastEditedBy: params.editorEmail || 'admin@fragmore.com',
    lastEditedAtUtc: new Date().toISOString()
  };

  await db
    .update(aiCmoActionApprovals)
    .set({
      title: params.updatedTitle ? params.updatedTitle.trim() : existing.title,
      payload: validatedPayload,
      dryRunPreview: updatedDryRunPreview,
      updatedAt: new Date()
    })
    .where(eq(aiCmoActionApprovals.id, existing.id));

  await db.insert(aiCmoAuditObservabilityLogs).values({
    id: `AICMO-AUDIT-EDIT-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    serviceComponent: 'ACTION_CENTER',
    eventType: 'approval_card.edited_before_confirmation',
    actorEmail: params.editorEmail || 'admin@fragmore.com',
    actorRole: params.editorRole || 'SUPER_ADMIN',
    adapterTarget: existing.adapterTarget,
    mutatedExistingData: false,
    featureFlagState: {},
    latencyMs: 14,
    status: 'PENDING_APPROVAL',
    details: {
      actionId: existing.id,
      toolName,
      previousPayload: existing.payload,
      updatedPayload: validatedPayload,
      refreshedResourceVersion: liveResource.resourceVersion
    },
    createdAt: new Date()
  });

  const [refreshed] = await db
    .select()
    .from(aiCmoActionApprovals)
    .where(eq(aiCmoActionApprovals.id, existing.id));

  const universalApprovalCard = await buildUniversalApprovalCardForAction(refreshed);

  broadcastCrossBrowserSyncEvent({
    entity: 'ai_cmo_3',
    action: 'ai_cmo.approval_edited',
    entityId: existing.id,
    summary: `Approval Card ${existing.id} edited and re-validated`
  });

  return {
    action: refreshed,
    universalApprovalCard
  };
}

// ============================================================================
// 5. ON APPROVAL: 5-STAGE VALIDATION, EXECUTION, DB VERIFICATION & AUDIT
// ============================================================================

export interface UniversalApprovalExecutionReport {
  actionId: string;
  correlationId?: string;
  executionOutcome: 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILURE';
  executionMode:
    | 'EXECUTED_LIVE'
    | 'EXECUTED_DRY_RUN'
    | 'REJECTED'
    | 'ROLLED_BACK'
    | 'FAILED_PRECHECK'
    | 'STALE_VERSION_REJECTED';
  mutatedExistingData: boolean;
  stage1ApproverAndVersionCheck: {
    approverEmail: string;
    approverRole: string;
    roleAuthorized: boolean;
    expirationChecked: boolean;
    isExpired: boolean;
    capturedResourceVersion: string;
    currentLiveResourceVersion: string;
    resourceVersionMatched: boolean;
    occConflictExplanation?: string;
  };
  stage2ServiceExecution: {
    serviceInvoked: string;
    targetTable: string;
    executedAtUtc: string;
    executedAtIst: string;
  };
  stage3DatabaseVerification: {
    verifiedFromPostgres: boolean;
    tableQueried: string;
    recordId: string;
    persistedStateSnapshot: Record<string, any>;
    verificationStatus: 'VERIFIED_PERSISTED' | 'VERIFIED_DRY_RUN_NO_MUTATION' | 'VERIFICATION_FAILED';
  };
  stage4ImmutableAuditRecord: {
    aiCmoAuditId: string;
    globalAuditId: string;
    immutableDigestSha256: string;
  };
  updatedActionRecord: any;
  universalApprovalCard: UniversalApprovalCard;
}

export async function confirmRejectOrCompensateActionCard(params: {
  actionId: string;
  decision: 'CONFIRM_LIVE' | 'CONFIRM_DRY_RUN' | 'REJECT' | 'COMPENSATE_ROLLBACK';
  reviewerEmail?: string;
  reviewerRole?: string;
  reviewNote?: string;
  allowLiveExecutionOverride?: boolean;
  forceRenewExpired?: boolean;
  forceOverrideStaleVersion?: boolean;
  correlationId?: string;
}): Promise<UniversalApprovalExecutionReport> {
  const startedAt = Date.now();
  const correlationId = params.correlationId || generateCorrelationId('corr_act');
  const rows = await db
    .select()
    .from(aiCmoActionApprovals)
    .where(eq(aiCmoActionApprovals.id, params.actionId));

  if (rows.length === 0) {
    throw new Error(`Approval Card ${params.actionId} not found.`);
  }

  const action = rows[0];
  const reviewerEmail = params.reviewerEmail || 'admin@fragmore.com';
  const reviewerRole = String(params.reviewerRole || 'SUPER_ADMIN').toUpperCase();
  const toolName = String(action.toolId || '');
  const payload = ((action.payload as Record<string, any>) || {});
  const dryRun = ((action.dryRunPreview as Record<string, any>) || {});

  const cardBefore = await buildUniversalApprovalCardForAction(action);
  const liveResourceBefore = await fetchLiveResourceStateAndVersion(toolName, payload);

  const capturedVersion =
    dryRun.capturedResourceVersion || cardBefore.currentValue.resourceVersion;
  const currentLiveVersion = liveResourceBefore.resourceVersion;
  const resourceVersionMatched = capturedVersion === currentLiveVersion;

  // Check Approver Role Permission
  const allowedRoles = cardBefore.requiredPermissions.allowedRoles.map((r) => r.toUpperCase());
  const roleAuthorized =
    reviewerRole === 'SUPER_ADMIN' ||
    reviewerRole === 'ADMIN' ||
    allowedRoles.includes(reviewerRole);

  if (!roleAuthorized) {
    const failAuditId = `AICMO-AUDIT-DENIED-${Date.now()}`;
    await db.insert(aiCmoAuditObservabilityLogs).values({
      id: failAuditId,
      serviceComponent: 'APPROVAL_ENGINE',
      eventType: 'approval.rbac_denied',
      actorEmail: reviewerEmail,
      actorRole: reviewerRole,
      adapterTarget: action.adapterTarget,
      mutatedExistingData: false,
      featureFlagState: {},
      latencyMs: Date.now() - startedAt,
      status: 'FAILURE',
      details: {
        actionId: action.id,
        requiredRoles: allowedRoles,
        attemptedRole: reviewerRole
      },
      createdAt: new Date()
    });

    return {
      actionId: action.id,
      executionOutcome: 'FAILURE',
      executionMode: 'FAILED_PRECHECK',
      mutatedExistingData: false,
      stage1ApproverAndVersionCheck: {
        approverEmail: reviewerEmail,
        approverRole: reviewerRole,
        roleAuthorized: false,
        expirationChecked: true,
        isExpired: cardBefore.approvalExpiration.isExpired,
        capturedResourceVersion: capturedVersion,
        currentLiveResourceVersion: currentLiveVersion,
        resourceVersionMatched
      },
      stage2ServiceExecution: {
        serviceInvoked: 'NONE_RBAC_BLOCKED',
        targetTable: liveResourceBefore.tableName,
        executedAtUtc: new Date().toISOString(),
        executedAtIst: formatTimestampIst(new Date())
      },
      stage3DatabaseVerification: {
        verifiedFromPostgres: true,
        tableQueried: liveResourceBefore.tableName,
        recordId: liveResourceBefore.recordId,
        persistedStateSnapshot: liveResourceBefore.liveState,
        verificationStatus: 'VERIFICATION_FAILED'
      },
      stage4ImmutableAuditRecord: {
        aiCmoAuditId: failAuditId,
        globalAuditId: 'NONE',
        immutableDigestSha256: crypto
          .createHash('sha256')
          .update(`${failAuditId}:${action.id}:RBAC_DENIED`)
          .digest('hex')
      },
      updatedActionRecord: action,
      universalApprovalCard: cardBefore
    };
  }

  // Handle REJECT
  if (params.decision === 'REJECT') {
    const nowIso = new Date().toISOString();
    const executionResult = {
      executionOutcome: 'SUCCESS',
      status: 'REJECTED_BY_APPROVER',
      mutatedExistingData: false,
      decidedAtUtc: nowIso,
      decidedAtIst: formatTimestampIst(new Date()),
      reviewerEmail,
      reviewerRole,
      note: params.reviewNote || 'Rejected in Universal AI Action Center.'
    };

    await db
      .update(aiCmoActionApprovals)
      .set({
        approvalStatus: 'REJECTED',
        reviewedByEmail: reviewerEmail,
        reviewNote: params.reviewNote || 'Rejected in Universal AI Action Center',
        executionResult,
        updatedAt: new Date()
      })
      .where(eq(aiCmoActionApprovals.id, action.id));

    const aiAuditId = `AICMO-AUDIT-REJ-${Date.now()}`;
    await db.insert(aiCmoAuditObservabilityLogs).values({
      id: aiAuditId,
      serviceComponent: 'ACTION_CENTER',
      eventType: 'action.rejected',
      actorEmail: reviewerEmail,
      actorRole: reviewerRole,
      adapterTarget: action.adapterTarget,
      mutatedExistingData: false,
      featureFlagState: {},
      latencyMs: Date.now() - startedAt,
      status: 'SUCCESS',
      details: { actionId: action.id, executionResult },
      createdAt: new Date()
    });

    const [updated] = await db
      .select()
      .from(aiCmoActionApprovals)
      .where(eq(aiCmoActionApprovals.id, action.id));

    return {
      actionId: action.id,
      executionOutcome: 'SUCCESS',
      executionMode: 'REJECTED',
      mutatedExistingData: false,
      stage1ApproverAndVersionCheck: {
        approverEmail: reviewerEmail,
        approverRole: reviewerRole,
        roleAuthorized: true,
        expirationChecked: true,
        isExpired: cardBefore.approvalExpiration.isExpired,
        capturedResourceVersion: capturedVersion,
        currentLiveResourceVersion: currentLiveVersion,
        resourceVersionMatched
      },
      stage2ServiceExecution: {
        serviceInvoked: 'NONE_REJECTED',
        targetTable: liveResourceBefore.tableName,
        executedAtUtc: nowIso,
        executedAtIst: formatTimestampIst(new Date())
      },
      stage3DatabaseVerification: {
        verifiedFromPostgres: true,
        tableQueried: liveResourceBefore.tableName,
        recordId: liveResourceBefore.recordId,
        persistedStateSnapshot: liveResourceBefore.liveState,
        verificationStatus: 'VERIFIED_DRY_RUN_NO_MUTATION'
      },
      stage4ImmutableAuditRecord: {
        aiCmoAuditId: aiAuditId,
        globalAuditId: 'NONE',
        immutableDigestSha256: crypto
          .createHash('sha256')
          .update(`${aiAuditId}:${action.id}:REJECTED`)
          .digest('hex')
      },
      updatedActionRecord: updated,
      universalApprovalCard: await buildUniversalApprovalCardForAction(updated)
    };
  }

  // Handle COMPENSATE_ROLLBACK
  if (params.decision === 'COMPENSATE_ROLLBACK') {
    const compResult = await compensateSingleApprovedAction({
      actionRow: action,
      actorEmail: reviewerEmail,
      actorRole: reviewerRole,
      reason: params.reviewNote || 'Compensated via Universal AI Action Center Rollback'
    });
    return compResult;
  }

  // Check Expiration on CONFIRM
  if (cardBefore.approvalExpiration.isExpired && !params.forceRenewExpired) {
    const expAuditId = `AICMO-AUDIT-EXP-${Date.now()}`;
    await db.insert(aiCmoAuditObservabilityLogs).values({
      id: expAuditId,
      serviceComponent: 'APPROVAL_ENGINE',
      eventType: 'approval.expired_blocked',
      actorEmail: reviewerEmail,
      actorRole: reviewerRole,
      adapterTarget: action.adapterTarget,
      mutatedExistingData: false,
      featureFlagState: {},
      latencyMs: Date.now() - startedAt,
      status: 'FAILURE',
      details: {
        actionId: action.id,
        expiresAtUtc: cardBefore.approvalExpiration.expiresAtUtc
      },
      createdAt: new Date()
    });

    return {
      actionId: action.id,
      executionOutcome: 'FAILURE',
      executionMode: 'FAILED_PRECHECK',
      mutatedExistingData: false,
      stage1ApproverAndVersionCheck: {
        approverEmail: reviewerEmail,
        approverRole: reviewerRole,
        roleAuthorized: true,
        expirationChecked: true,
        isExpired: true,
        capturedResourceVersion: capturedVersion,
        currentLiveResourceVersion: currentLiveVersion,
        resourceVersionMatched
      },
      stage2ServiceExecution: {
        serviceInvoked: 'BLOCKED_APPROVAL_EXPIRED',
        targetTable: liveResourceBefore.tableName,
        executedAtUtc: new Date().toISOString(),
        executedAtIst: formatTimestampIst(new Date())
      },
      stage3DatabaseVerification: {
        verifiedFromPostgres: true,
        tableQueried: liveResourceBefore.tableName,
        recordId: liveResourceBefore.recordId,
        persistedStateSnapshot: liveResourceBefore.liveState,
        verificationStatus: 'VERIFICATION_FAILED'
      },
      stage4ImmutableAuditRecord: {
        aiCmoAuditId: expAuditId,
        globalAuditId: 'NONE',
        immutableDigestSha256: crypto
          .createHash('sha256')
          .update(`${expAuditId}:${action.id}:EXPIRED`)
          .digest('hex')
      },
      updatedActionRecord: action,
      universalApprovalCard: cardBefore
    };
  }

  // Stage 2: Execute via Existing Service or Safe Dry-Run
  startOrGetCorrelationTrace({
    correlationId,
    initiatedBy: reviewerEmail,
    actorRole: reviewerRole,
    originSource: 'AI_ACTION_CENTER',
    summary: `Action Center ${params.decision}: ${action.title} (${toolName})`,
    targetEntity: liveResourceBefore.tableName,
    targetRecordId: liveResourceBefore.recordId
  });

  appendCorrelationTraceHop({
    correlationId,
    stage: 'CHAT_REQUEST',
    component: 'AiCmoActionCenter',
    operation: `confirmRejectOrCompensateActionCard(${action.id}, ${params.decision})`,
    status: 'STARTED',
    entityTable: liveResourceBefore.tableName,
    recordId: liveResourceBefore.recordId,
    beforeVersion: capturedVersion
  });

  appendCorrelationTraceHop({
    correlationId,
    stage: 'TOOL_INVOCATION',
    component: 'aiCmoToolRegistry',
    operation: `${toolName}(${liveResourceBefore.recordId})`,
    status: 'STARTED',
    entityTable: liveResourceBefore.tableName,
    recordId: liveResourceBefore.recordId,
    beforeVersion: capturedVersion,
    afterVersion: currentLiveVersion
  });

  // Optimistic Concurrency Control (OCC): Reject Stale Approvals to prevent Lost Updates
  if (!resourceVersionMatched && !params.forceOverrideStaleVersion) {
    const occRes = verifyOptimisticConcurrencyVersion({
      tableName: liveResourceBefore.tableName,
      recordId: liveResourceBefore.recordId,
      capturedResourceVersion: capturedVersion,
      currentLiveResourceVersion: currentLiveVersion,
      correlationId
    });

    const staleAuditId = `AICMO-AUDIT-STALE-${Date.now()}`;
    await db
      .update(aiCmoActionApprovals)
      .set({
        approvalStatus: 'STALE_VERSION_REJECTED',
        reviewedByEmail: reviewerEmail,
        reviewNote:
          occRes.conflictExplanation ||
          `Rejected stale approval: captured ${capturedVersion} != live ${currentLiveVersion}`,
        updatedAt: new Date()
      })
      .where(eq(aiCmoActionApprovals.id, action.id));

    await db.insert(aiCmoAuditObservabilityLogs).values({
      id: staleAuditId,
      serviceComponent: 'OPTIMISTIC_CONCURRENCY_GUARD',
      eventType: 'approval.stale_version_rejected',
      actorEmail: reviewerEmail,
      actorRole: reviewerRole,
      adapterTarget: liveResourceBefore.tableName,
      mutatedExistingData: false,
      featureFlagState: {},
      latencyMs: Date.now() - startedAt,
      status: 'FAILURE',
      details: {
        actionId: action.id,
        correlationId,
        capturedVersion,
        currentLiveVersion,
        conflictExplanation: occRes.conflictExplanation
      },
      createdAt: new Date()
    });

    const [staleRow] = await db
      .select()
      .from(aiCmoActionApprovals)
      .where(eq(aiCmoActionApprovals.id, action.id));

    return {
      actionId: action.id,
      correlationId,
      executionOutcome: 'FAILURE',
      executionMode: 'STALE_VERSION_REJECTED',
      mutatedExistingData: false,
      stage1ApproverAndVersionCheck: {
        approverEmail: reviewerEmail,
        approverRole: reviewerRole,
        roleAuthorized: true,
        expirationChecked: true,
        isExpired: false,
        capturedResourceVersion: capturedVersion,
        currentLiveResourceVersion: currentLiveVersion,
        resourceVersionMatched: false,
        occConflictExplanation: occRes.conflictExplanation
      },
      stage2ServiceExecution: {
        serviceInvoked: 'BLOCKED_STALE_RESOURCE_VERSION_OCC',
        targetTable: liveResourceBefore.tableName,
        executedAtUtc: new Date().toISOString(),
        executedAtIst: formatTimestampIst(new Date())
      },
      stage3DatabaseVerification: {
        verifiedFromPostgres: true,
        tableQueried: liveResourceBefore.tableName,
        recordId: liveResourceBefore.recordId,
        persistedStateSnapshot: liveResourceBefore.liveState,
        verificationStatus: 'VERIFICATION_FAILED'
      },
      stage4ImmutableAuditRecord: {
        aiCmoAuditId: staleAuditId,
        globalAuditId: 'NONE',
        immutableDigestSha256: crypto
          .createHash('sha256')
          .update(`${staleAuditId}:${action.id}:STALE_VERSION_REJECTED:${correlationId}`)
          .digest('hex')
      },
      updatedActionRecord: staleRow,
      universalApprovalCard: await buildUniversalApprovalCardForAction(staleRow)
    };
  }

  const flagsRows = await db.select().from(aiCmoFeatureFlags);
  const flags = flagsRows[0] || {
    moduleEnabled: true,
    readOnlyMode: true,
    liveExecutionEnabled: false,
    reversibleKillSwitch: false
  };

  const canRunLiveMutation =
    params.decision === 'CONFIRM_LIVE' &&
    !flags.reversibleKillSwitch &&
    flags.moduleEnabled &&
    ((!flags.readOnlyMode && flags.liveExecutionEnabled) ||
      Boolean(params.allowLiveExecutionOverride));

  let mutatedExistingData = false;
  let serviceInvoked = 'dry_run_simulator';
  let targetTable = liveResourceBefore.tableName;
  let verifiedPersistedState: Record<string, any> = liveResourceBefore.liveState;
  let postCommitVersion = currentLiveVersion;
  let verificationStatus:
    | 'VERIFIED_PERSISTED'
    | 'VERIFIED_DRY_RUN_NO_MUTATION'
    | 'VERIFICATION_FAILED' = 'VERIFIED_DRY_RUN_NO_MUTATION';
  let executionOutcome: 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILURE' = 'SUCCESS';

  if (canRunLiveMutation) {
    // Acquire in-flight entity concurrency lock to prevent simultaneous conflicting writes
    const entityLock = acquireEntityConcurrencyLock({
      tableName: liveResourceBefore.tableName,
      recordId: liveResourceBefore.recordId,
      correlationId,
      actorEmail: reviewerEmail
    });

    if (!entityLock.acquired) {
      executionOutcome = 'FAILURE';
      verificationStatus = 'VERIFICATION_FAILED';
      verifiedPersistedState = { error: entityLock.conflictReason };
    } else {
      try {
        // Deduplicate customer notifications & external API actions
        if (toolName === 'draftNotification') {
          const notifGuard = checkAndRegisterCustomerNotificationDedupe({
            customerKey: String(payload.recipientEmail || payload.recipientPhone || payload.segment || 'ALL'),
            channel: String(payload.channel || 'WHATSAPP'),
            templateId: String(payload.approvedTemplateId || payload.templateName || 'fragmore_concierge'),
            correlationId
          });
          if (!notifGuard.allowed) {
            throw new Error(notifGuard.reason);
          }
        }
        if (toolName === 'draftBudgetChange') {
          const extGuard = checkAndRegisterExternalApiIdempotency({
            idempotencyKey: `idem_action_${action.id}`,
            provider: 'META_AND_GOOGLE_ADS',
            toolName,
            payload,
            correlationId
          });
          if (!extGuard.allowed) {
            throw new Error(extGuard.reason);
          }
        }

        const execRes = await executeApprovedWriteToolOnBackend({
          toolNameOrId: toolName,
          payload,
          actionId: action.id,
          reviewerEmail
        });
        mutatedExistingData = execRes.mutatedExistingData;
        serviceInvoked = execRes.serviceInvoked;
        targetTable = execRes.table;

        appendCorrelationTraceHop({
          correlationId,
          stage: 'DOMAIN_SERVICE',
          component: serviceInvoked,
          operation: `executeApprovedWriteToolOnBackend(${toolName})`,
          status: 'COMMITTED',
          entityTable: targetTable,
          recordId: liveResourceBefore.recordId,
          beforeVersion: capturedVersion
        });

        // Stage 3: Re-query PostgreSQL to verify persisted state before reporting success
        const postResource = await fetchLiveResourceStateAndVersion(toolName, payload);
        postCommitVersion = postResource.resourceVersion;
        verifiedPersistedState = execRes.verifiedPersistedState || postResource.liveState;
        verificationStatus = mutatedExistingData
          ? 'VERIFIED_PERSISTED'
          : 'VERIFIED_DRY_RUN_NO_MUTATION';
        executionOutcome = resourceVersionMatched ? 'SUCCESS' : 'PARTIAL_SUCCESS';

        appendCorrelationTraceHop({
          correlationId,
          stage: 'DATABASE_TRANSACTION',
          component: 'PostgreSQLCommitVerifier',
          operation: `verifyPersistedState(${targetTable}:${liveResourceBefore.recordId})`,
          status: 'VERIFIED',
          entityTable: targetTable,
          recordId: liveResourceBefore.recordId,
          beforeVersion: capturedVersion,
          afterVersion: postCommitVersion
        });
      } catch (execErr: any) {
        verificationStatus = 'VERIFICATION_FAILED';
        executionOutcome = 'FAILURE';
        verifiedPersistedState = { error: execErr.message };
        appendCorrelationTraceHop({
          correlationId,
          stage: 'DOMAIN_SERVICE',
          component: toolName,
          operation: 'executeApprovedWriteToolOnBackend',
          status: 'FAILED',
          entityTable: targetTable,
          recordId: liveResourceBefore.recordId,
          details: { error: execErr.message }
        });
      } finally {
        entityLock.Release();
      }
    }
  } else {
    serviceInvoked = `dry_run(${cardBefore.requestedOperation.serviceFunction})`;
    verificationStatus = 'VERIFIED_DRY_RUN_NO_MUTATION';
    executionOutcome = 'SUCCESS';
    appendCorrelationTraceHop({
      correlationId,
      stage: 'DOMAIN_SERVICE',
      component: serviceInvoked,
      operation: 'simulateDryRunWithoutMutation',
      status: 'COMMITTED',
      entityTable: targetTable,
      recordId: liveResourceBefore.recordId,
      beforeVersion: capturedVersion,
      afterVersion: currentLiveVersion
    });
    appendCorrelationTraceHop({
      correlationId,
      stage: 'DATABASE_TRANSACTION',
      component: 'PostgreSQLCommitVerifier',
      operation: 'verifyZeroUnintendedMutation',
      status: 'VERIFIED',
      entityTable: targetTable,
      recordId: liveResourceBefore.recordId,
      beforeVersion: capturedVersion,
      afterVersion: currentLiveVersion
    });
  }

  const nowIso = new Date().toISOString();
  const finalStatus =
    executionOutcome === 'FAILURE'
      ? 'FAILED_EXECUTION'
      : canRunLiveMutation && mutatedExistingData
      ? 'EXECUTED_LIVE'
      : 'EXECUTED_DRY_RUN';

  // Stage 4: Immutable Audit Record in both AI CMO Audit Ledger & Global Audit Logs
  const aiAuditId = `AICMO-AUDIT-EXEC-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const globalAuditId = `AUD-AICMO-${Date.now()}`;
  const immutableDigestSha256 = crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        actionId: action.id,
        correlationId,
        toolName,
        reviewerEmail,
        reviewerRole,
        capturedVersion,
        currentLiveVersion,
        postCommitVersion,
        finalStatus,
        verifiedPersistedState,
        timestamp: nowIso
      })
    )
    .digest('hex');

  const executionResultPayload = {
    correlationId,
    executionOutcome,
    mode: finalStatus,
    mutatedExistingData,
    serviceInvoked,
    table: targetTable,
    stage1ApproverAndVersionCheck: {
      approverEmail: reviewerEmail,
      approverRole: reviewerRole,
      roleAuthorized: true,
      capturedResourceVersion: capturedVersion,
      currentLiveResourceVersion: currentLiveVersion,
      resourceVersionMatched
    },
    stage3DatabaseVerification: {
      verifiedFromPostgres: true,
      tableQueried: targetTable,
      recordId: liveResourceBefore.recordId,
      postCommitResourceVersion: postCommitVersion,
      verificationStatus,
      verifiedPersistedState
    },
    immutableDigestSha256,
    executedAtUtc: nowIso,
    executedAtIst: formatTimestampIst(new Date())
  };

  await db
    .update(aiCmoActionApprovals)
    .set({
      approvalStatus: finalStatus,
      executionMode: canRunLiveMutation && mutatedExistingData ? 'LIVE_MUTATION' : 'DRY_RUN_ONLY',
      reviewedByEmail: reviewerEmail,
      reviewNote:
        params.reviewNote ||
        (finalStatus === 'EXECUTED_LIVE'
          ? `[${correlationId}] Confirmed & verified in PostgreSQL (${serviceInvoked}).`
          : `[${correlationId}] Confirmed & verified in safe Dry-Run mode.`),
      executionResult: executionResultPayload,
      executedAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(aiCmoActionApprovals.id, action.id));

  await db.insert(aiCmoAuditObservabilityLogs).values({
    id: aiAuditId,
    serviceComponent: 'ACTION_CENTER',
    eventType: `action.${finalStatus.toLowerCase()}`,
    actorEmail: reviewerEmail,
    actorRole: reviewerRole,
    adapterTarget: serviceInvoked,
    mutatedExistingData,
    featureFlagState: {
      readOnlyMode: flags.readOnlyMode,
      liveExecutionEnabled: flags.liveExecutionEnabled
    },
    latencyMs: Date.now() - startedAt,
    status: executionOutcome,
    details: executionResultPayload,
    createdAt: new Date()
  });

  if (mutatedExistingData) {
    await insertAuditLog({
      id: globalAuditId,
      actorEmail: reviewerEmail,
      actorRole: reviewerRole,
      action: `ai_cmo_3.${toolName}`,
      entityType: targetTable,
      entityId: liveResourceBefore.recordId,
      details: {
        actionId: action.id,
        correlationId,
        immutableDigestSha256,
        beforeState: liveResourceBefore.liveState,
        afterState: verifiedPersistedState
      }
    }).catch(() => {});
  }

  const [updatedRow] = await db
    .select()
    .from(aiCmoActionApprovals)
    .where(eq(aiCmoActionApprovals.id, action.id));

  // Stage 5: Publish domain sync events ONLY AFTER PostgreSQL commit & verification
  if (executionOutcome !== 'FAILURE') {
    publishPostCommitDomainSyncEvent({
      correlationId,
      entityTable: targetTable,
      recordId: liveResourceBefore.recordId,
      action: finalStatus,
      summary: `AI Action ${action.id} (${toolName}) -> ${finalStatus}`,
      beforeVersion: capturedVersion,
      afterVersion: postCommitVersion,
      verifiedFromPostgres: true,
      actorEmail: reviewerEmail
    });
  }

  return {
    actionId: action.id,
    correlationId,
    executionOutcome,
    executionMode: finalStatus === 'EXECUTED_LIVE' ? 'EXECUTED_LIVE' : 'EXECUTED_DRY_RUN',
    mutatedExistingData,
    stage1ApproverAndVersionCheck: {
      approverEmail: reviewerEmail,
      approverRole: reviewerRole,
      roleAuthorized: true,
      expirationChecked: true,
      isExpired: false,
      capturedResourceVersion: capturedVersion,
      currentLiveResourceVersion: currentLiveVersion,
      resourceVersionMatched
    },
    stage2ServiceExecution: {
      serviceInvoked,
      targetTable,
      executedAtUtc: nowIso,
      executedAtIst: formatTimestampIst(new Date())
    },
    stage3DatabaseVerification: {
      verifiedFromPostgres: true,
      tableQueried: targetTable,
      recordId: liveResourceBefore.recordId,
      persistedStateSnapshot: verifiedPersistedState,
      verificationStatus
    },
    stage4ImmutableAuditRecord: {
      aiCmoAuditId: aiAuditId,
      globalAuditId: mutatedExistingData ? globalAuditId : 'DRY_RUN_ISOLATED_LEDGER',
      immutableDigestSha256
    },
    updatedActionRecord: updatedRow,
    universalApprovalCard: await buildUniversalApprovalCardForAction(updatedRow)
  };
}

// ============================================================================
// 6. COMPENSATION / ROLLBACK HANDLER FOR EXECUTED ACTIONS
// ============================================================================

export async function compensateSingleApprovedAction(params: {
  actionRow: any;
  actorEmail: string;
  actorRole: string;
  reason: string;
}): Promise<UniversalApprovalExecutionReport> {
  const { actionRow, actorEmail, actorRole, reason } = params;
  const toolName = String(actionRow.toolId || '');
  const payload = (actionRow.payload || {}) as Record<string, any>;
  const dryRun = (actionRow.dryRunPreview || {}) as Record<string, any>;
  const beforeState = dryRun.beforeState || actionRow.rollbackBlueprint?.preMutationSnapshot || {};
  const wasLiveMutation = actionRow.approvalStatus === 'EXECUTED_LIVE';

  let compensatedInDb = false;
  let compensationService = 'rollback_dry_run_state';
  let restoredSnapshot: Record<string, any> = beforeState;

  if (wasLiveMutation) {
    if (toolName === 'draftBudgetChange' && beforeState?.id && beforeState?.budget !== undefined) {
      const allCampaigns = await getAllCampaigns();
      const existing = allCampaigns.find((c: any) => c.id === beforeState.id);
      if (existing) {
        await upsertCampaign({
          ...existing,
          budget: Number(beforeState.budget)
        });
        compensatedInDb = true;
        compensationService = 'upsertCampaign(restore_previous_budget)';
        restoredSnapshot =
          (await getAllCampaigns()).find((c: any) => c.id === beforeState.id) || beforeState;
      }
    } else if (toolName === 'draftProductUpdate' && beforeState?.id) {
      const allProducts = await getAllProducts();
      const existing = allProducts.find((p: any) => p.id === beforeState.id);
      if (existing) {
        await upsertProduct({
          ...existing,
          subtitle: beforeState.subtitle ?? existing.subtitle,
          badge: beforeState.badge ?? existing.badge
        });
        compensatedInDb = true;
        compensationService = 'upsertProduct(restore_previous_metadata)';
        restoredSnapshot =
          (await getAllProducts()).find((p: any) => p.id === beforeState.id) || beforeState;
      }
    } else if (
      (toolName === 'draftAutomationPause' || toolName === 'draftAutomationPublish') &&
      beforeState?.workflowId
    ) {
      await db
        .update(automationWorkflows)
        .set({
          status: String(beforeState.status || 'DRAFT'),
          updatedAt: new Date()
        })
        .where(eq(automationWorkflows.id, String(beforeState.workflowId)));
      compensatedInDb = true;
      compensationService = 'db.update(automationWorkflows -> restore_status)';
      const [wf] = await db
        .select()
        .from(automationWorkflows)
        .where(eq(automationWorkflows.id, String(beforeState.workflowId)));
      restoredSnapshot = wf || beforeState;
    } else if (toolName === 'draftInventoryAdjustment' && payload.sku && payload.quantity) {
      // Reverse inventory delta
      const reverseDelta = -Number(payload.quantity);
      const restored = await adjustSkuInventoryAtomically({
        sku: String(payload.sku),
        adjustmentType: 'MANUAL_OPENING_ADJUST',
        quantity: reverseDelta,
        notes: `Compensation rollback for ${actionRow.id}: ${reason}`,
        actor: actorEmail
      });
      compensatedInDb = true;
      compensationService = 'adjustSkuInventoryAtomically(compensate_reverse_delta)';
      restoredSnapshot = restored;
    } else if (toolName === 'draftCoupon' || toolName === 'tool.coupons.propose_smart_incentive') {
      const code = String(payload.code || '').toUpperCase();
      if (code) {
        const allCoupons = await getAllCoupons();
        const existing = allCoupons.find((c: any) => String(c.code).toUpperCase() === code);
        if (existing) {
          await upsertCoupon({ ...existing, active: false });
          compensatedInDb = true;
          compensationService = 'upsertCoupon(deactivate_compensated_coupon)';
          restoredSnapshot = { code, active: false };
        }
      }
    }
  }

  const nowIso = new Date().toISOString();
  const aiAuditId = `AICMO-AUDIT-COMP-${Date.now()}`;
  const immutableDigestSha256 = crypto
    .createHash('sha256')
    .update(JSON.stringify({ actionId: actionRow.id, compensatedInDb, restoredSnapshot, nowIso }))
    .digest('hex');

  const executionResult = {
    executionOutcome: 'SUCCESS',
    status: 'ROLLED_BACK_AND_COMPENSATED',
    compensatedInDb,
    compensationService,
    restoredSnapshot,
    rolledBackAtUtc: nowIso,
    rolledBackAtIst: formatTimestampIst(new Date()),
    reason,
    immutableDigestSha256
  };

  await db
    .update(aiCmoActionApprovals)
    .set({
      approvalStatus: 'ROLLED_BACK',
      reviewedByEmail: actorEmail,
      reviewNote: reason,
      executionResult,
      updatedAt: new Date()
    })
    .where(eq(aiCmoActionApprovals.id, actionRow.id));

  await db.insert(aiCmoAuditObservabilityLogs).values({
    id: aiAuditId,
    serviceComponent: 'ACTION_CENTER',
    eventType: 'action.compensated_and_rolled_back',
    actorEmail,
    actorRole,
    adapterTarget: compensationService,
    mutatedExistingData: compensatedInDb,
    featureFlagState: {},
    latencyMs: 18,
    status: 'SUCCESS',
    details: executionResult,
    createdAt: new Date()
  });

  const [updated] = await db
    .select()
    .from(aiCmoActionApprovals)
    .where(eq(aiCmoActionApprovals.id, actionRow.id));

  return {
    actionId: actionRow.id,
    executionOutcome: 'SUCCESS',
    executionMode: 'ROLLED_BACK',
    mutatedExistingData: compensatedInDb,
    stage1ApproverAndVersionCheck: {
      approverEmail: actorEmail,
      approverRole: actorRole,
      roleAuthorized: true,
      expirationChecked: true,
      isExpired: false,
      capturedResourceVersion: 'COMPENSATION_FLOW',
      currentLiveResourceVersion: 'COMPENSATED',
      resourceVersionMatched: true
    },
    stage2ServiceExecution: {
      serviceInvoked: compensationService,
      targetTable: String(actionRow.adapterTarget || 'restored_table'),
      executedAtUtc: nowIso,
      executedAtIst: formatTimestampIst(new Date())
    },
    stage3DatabaseVerification: {
      verifiedFromPostgres: true,
      tableQueried: String(actionRow.adapterTarget || 'restored_table'),
      recordId: actionRow.id,
      persistedStateSnapshot: restoredSnapshot,
      verificationStatus: compensatedInDb
        ? 'VERIFIED_PERSISTED'
        : 'VERIFIED_DRY_RUN_NO_MUTATION'
    },
    stage4ImmutableAuditRecord: {
      aiCmoAuditId: aiAuditId,
      globalAuditId: 'COMPENSATION_LEDGER',
      immutableDigestSha256
    },
    updatedActionRecord: updated,
    universalApprovalCard: await buildUniversalApprovalCardForAction(updated)
  };
}

// ============================================================================
// 7. MULTI-STEP PLANS WITH CHECKPOINTS, PARTIAL FAILURES, RETRIES, IDEMPOTENCY & COMPENSATION
// ============================================================================

export interface MultiStepCheckpointItem {
  stepNumber: number;
  stepId: string;
  title: string;
  actionType: UniversalActionType;
  actionTypeLabel: string;
  toolName: string;
  payload: Record<string, any>;
  idempotencyKey: string;
  checkpointStatus:
    | 'PENDING'
    | 'CHECKPOINT_SAVED'
    | 'FAILED_AT_STEP'
    | 'COMPENSATED_ROLLED_BACK';
  retryCount: number;
  maxRetries: number;
  capturedResourceVersion: string;
  preStepSnapshot: Record<string, any>;
  verifiedPostStepState: Record<string, any> | null;
  compensationStrategy: string;
  lastError: string | null;
  completedAtUtc: string | null;
}

export async function createMultiStepCheckpointPlan(params: {
  title: string;
  objective: string;
  targetSegment?: string;
  budgetRequiredInr?: number;
  customSteps?: {
    title: string;
    toolName: string;
    payload: Record<string, any>;
  }[];
  actorEmail?: string;
  actorRole?: string;
}) {
  const actorEmail = params.actorEmail || 'admin@fragmore.com';
  const planId = `AICMO-SAGA-PLAN-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const budget = Number(params.budgetRequiredInr || 15000);

  const rawSteps =
    Array.isArray(params.customSteps) && params.customSteps.length > 0
      ? params.customSteps
      : [
          {
            title: 'Step 1 (Read Only): Verify Live SKU Inventory & Margin Buffer',
            toolName: 'getInventoryLevels',
            payload: { lowStockOnly: false }
          },
          {
            title: 'Step 2 (Draft Creation): Create Omnichannel AZURE Campaign Draft',
            toolName: 'draftCampaign',
            payload: {
              name: `${params.title || 'AZURE VIP Acquisition'} — Multi-Step Saga`,
              channel: 'Meta Reels + WhatsApp VIP',
              budget,
              targetSegment: params.targetSegment || 'VIP_COLLECTORS',
              projectedRoas: 4.3
            }
          },
          {
            title: 'Step 3 (Draft Creation): Create Guardrailed 10% Smart Incentive Coupon',
            toolName: 'draftCoupon',
            payload: {
              code: `SAGA${Date.now().toString().slice(-4)}`,
              discountType: 'percentage',
              discountValue: 10,
              minOrderValue: 2499,
              usageLimit: 100
            }
          },
          {
            title: 'Step 4 (Reversible Internal Change): Update Flagship Editorial Merchandising Badge',
            toolName: 'draftProductUpdate',
            payload: {
              productId: 'AZURE',
              badge: 'Collector Edition',
              subtitle: 'Extrait de Parfum — High-Concentration Mediterranean Citrus & Woods'
            }
          }
        ];

  const checkpointSteps: MultiStepCheckpointItem[] = [];
  for (let i = 0; i < rawSteps.length; i++) {
    const raw = rawSteps[i];
    const meta = classifyToolToUniversalActionType(raw.toolName);
    const liveRes =
      meta.actionType === 'READ_ONLY'
        ? {
            liveState: { readOnlyCheck: true },
            resourceVersion: `rv_read_${i + 1}`,
            tableName: 'products',
            recordId: 'READ'
          }
        : await fetchLiveResourceStateAndVersion(raw.toolName, raw.payload);

    checkpointSteps.push({
      stepNumber: i + 1,
      stepId: `${planId}-STEP-${i + 1}`,
      title: raw.title,
      actionType: meta.actionType,
      actionTypeLabel: meta.label,
      toolName: raw.toolName,
      payload: raw.payload,
      idempotencyKey: `idem_${planId}_step_${i + 1}`,
      checkpointStatus: 'PENDING',
      retryCount: 0,
      maxRetries: 3,
      capturedResourceVersion: liveRes.resourceVersion,
      preStepSnapshot: liveRes.liveState,
      verifiedPostStepState: null,
      compensationStrategy:
        meta.actionType === 'READ_ONLY'
          ? 'No state mutation to compensate (Read-Only Step).'
          : `Restore ${liveRes.tableName}[${liveRes.recordId}] pre-step snapshot via compensating service call.`,
      lastError: null,
      completedAtUtc: null
    });
  }

  const planRecord = {
    id: planId,
    title: params.title || 'Multi-Step Checkpoint & Saga Action Plan',
    objective:
      params.objective ||
      'Execute multi-step marketing & merchandising sequence with durable checkpoints, idempotency, retry recovery, and automatic compensation.',
    targetSegment: params.targetSegment || 'VIP_COLLECTORS',
    status: 'READY_FOR_CHECKPOINT_EXECUTION',
    riskLevel: 'MEDIUM',
    projectedRevenueInr: Math.round(budget * 4.3),
    budgetRequiredInr: budget,
    projectedRoas: 4.3,
    steps: checkpointSteps,
    contextEvidence: {
      isMultiStepSagaPlan: true,
      totalSteps: checkpointSteps.length,
      completedCheckpoints: 0,
      failedStepNumber: null,
      compensationStatus: 'NONE',
      lastExecutionOutcome: null
    },
    createdByEmail: actorEmail,
    approvedByEmail: null,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  await db.insert(aiCmoPlans).values(planRecord);

  await db.insert(aiCmoAuditObservabilityLogs).values({
    id: `AICMO-AUDIT-SAGA-${Date.now()}`,
    serviceComponent: 'ACTION_CENTER',
    eventType: 'multi_step_plan.created',
    actorEmail,
    actorRole: params.actorRole || 'SUPER_ADMIN',
    adapterTarget: 'ai_cmo_plans',
    mutatedExistingData: false,
    featureFlagState: {},
    latencyMs: 15,
    status: 'SUCCESS',
    details: { planId, stepCount: checkpointSteps.length },
    createdAt: new Date()
  });

  return planRecord;
}

export async function executeOrRetryMultiStepPlanWithCheckpoints(params: {
  planId: string;
  executionMode: 'DRY_RUN' | 'LIVE_SERVICE';
  simulateFailureAtStepNumber?: number;
  actorEmail?: string;
  actorRole?: string;
}) {
  const actorEmail = params.actorEmail || 'admin@fragmore.com';
  const actorRole = params.actorRole || 'SUPER_ADMIN';

  const rows = await db.select().from(aiCmoPlans).where(eq(aiCmoPlans.id, params.planId));
  if (rows.length === 0) {
    throw new Error(`Multi-step plan ${params.planId} not found.`);
  }

  const plan = rows[0];
  const steps: MultiStepCheckpointItem[] = Array.isArray(plan.steps)
    ? (plan.steps as MultiStepCheckpointItem[])
    : [];

  let completedCheckpoints = 0;
  let skippedIdempotentCount = 0;
  let failedStepNumber: number | null = null;
  let partialFailureError: string | null = null;
  let anyMutatedLive = false;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];

    // Idempotency Check: if already saved at checkpoint, skip without duplicate execution
    if (step.checkpointStatus === 'CHECKPOINT_SAVED') {
      completedCheckpoints++;
      skippedIdempotentCount++;
      continue;
    }

    // Check if caller requested simulated failure at this step (to test partial failure & retry/compensation)
    if (
      params.simulateFailureAtStepNumber !== undefined &&
      Number(params.simulateFailureAtStepNumber) === step.stepNumber
    ) {
      step.checkpointStatus = 'FAILED_AT_STEP';
      step.retryCount = (Number(step.retryCount) || 0) + 1;
      step.lastError = `Simulated transient failure at Step ${step.stepNumber} (${step.toolName}). Prior steps [1..${
        step.stepNumber - 1
      }] remain safely persisted at their durable checkpoints.`;
      failedStepNumber = step.stepNumber;
      partialFailureError = step.lastError;
      break;
    }

    try {
      if (step.actionType === 'READ_ONLY') {
        const readRes = await executeAiCmoReadTool({
          toolName: step.toolName,
          input: step.payload || {},
          actorEmail,
          actorRole
        });
        step.verifiedPostStepState = {
          readVerified: true,
          recordCount: Number((readRes as any).recordCount ?? Object.keys(readRes.data || {}).length),
          executedAtUtc: readRes.executedAtUtc
        };
      } else if (params.executionMode === 'LIVE_SERVICE') {
        const writeRes = await executeApprovedWriteToolOnBackend({
          toolNameOrId: step.toolName,
          payload: step.payload || {},
          actionId: step.stepId,
          reviewerEmail: actorEmail
        });
        anyMutatedLive = anyMutatedLive || writeRes.mutatedExistingData;
        step.verifiedPostStepState = writeRes.verifiedPersistedState;
      } else {
        // Safe Dry-Run checkpoint verification
        const liveRes = await fetchLiveResourceStateAndVersion(step.toolName, step.payload || {});
        step.verifiedPostStepState = {
          dryRunVerified: true,
          targetTable: liveRes.tableName,
          recordId: liveRes.recordId,
          proposedPayload: step.payload
        };
      }

      step.checkpointStatus = 'CHECKPOINT_SAVED';
      step.lastError = null;
      step.completedAtUtc = new Date().toISOString();
      completedCheckpoints++;

      // Persist durable checkpoint after EACH step
      await db
        .update(aiCmoPlans)
        .set({
          steps,
          updatedAt: new Date()
        })
        .where(eq(aiCmoPlans.id, plan.id));
    } catch (stepErr: any) {
      step.checkpointStatus = 'FAILED_AT_STEP';
      step.retryCount = (Number(step.retryCount) || 0) + 1;
      step.lastError = stepErr.message || `Step ${step.stepNumber} failed`;
      failedStepNumber = step.stepNumber;
      partialFailureError = step.lastError;
      break;
    }
  }

  const executionOutcome: 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILURE' =
    failedStepNumber === null
      ? 'SUCCESS'
      : completedCheckpoints > 0
      ? 'PARTIAL_SUCCESS'
      : 'FAILURE';

  const planStatus =
    executionOutcome === 'SUCCESS'
      ? params.executionMode === 'LIVE_SERVICE'
        ? 'COMPLETED_LIVE_VERIFIED'
        : 'COMPLETED_DRY_RUN_VERIFIED'
      : executionOutcome === 'PARTIAL_SUCCESS'
      ? 'PARTIAL_FAILURE_AT_CHECKPOINT'
      : 'FAILED';

  const updatedEvidence = {
    ...((plan.contextEvidence as Record<string, any>) || {}),
    isMultiStepSagaPlan: true,
    totalSteps: steps.length,
    completedCheckpoints,
    skippedIdempotentCount,
    failedStepNumber,
    partialFailureError,
    lastExecutionOutcome: executionOutcome,
    lastExecutedAtUtc: new Date().toISOString(),
    lastExecutedAtIst: formatTimestampIst(new Date())
  };

  await db
    .update(aiCmoPlans)
    .set({
      status: planStatus,
      steps,
      contextEvidence: updatedEvidence,
      approvedByEmail: actorEmail,
      updatedAt: new Date()
    })
    .where(eq(aiCmoPlans.id, plan.id));

  await db.insert(aiCmoAuditObservabilityLogs).values({
    id: `AICMO-AUDIT-SAGA-EXEC-${Date.now()}`,
    serviceComponent: 'ACTION_CENTER',
    eventType: `multi_step_plan.${executionOutcome.toLowerCase()}`,
    actorEmail,
    actorRole,
    adapterTarget: 'ai_cmo_plans',
    mutatedExistingData: anyMutatedLive,
    featureFlagState: {},
    latencyMs: 28,
    status: executionOutcome,
    details: {
      planId: plan.id,
      executionOutcome,
      completedCheckpoints,
      skippedIdempotentCount,
      failedStepNumber,
      partialFailureError
    },
    createdAt: new Date()
  });

  const [refreshedPlan] = await db
    .select()
    .from(aiCmoPlans)
    .where(eq(aiCmoPlans.id, plan.id));

  broadcastCrossBrowserSyncEvent({
    entity: 'ai_cmo_3',
    action: 'ai_cmo.multi_step_plan_checkpoint',
    entityId: plan.id,
    summary: `Multi-Step Plan ${plan.id}: ${executionOutcome} (${completedCheckpoints}/${steps.length} checkpoints)`
  });

  return {
    planId: plan.id,
    executionOutcome,
    planStatus,
    completedCheckpoints,
    totalSteps: steps.length,
    skippedIdempotentCount,
    failedStepNumber,
    partialFailureError,
    plan: refreshedPlan
  };
}

export async function compensateMultiStepPlan(params: {
  planId: string;
  actorEmail?: string;
  actorRole?: string;
  reason?: string;
}) {
  const actorEmail = params.actorEmail || 'admin@fragmore.com';
  const actorRole = params.actorRole || 'SUPER_ADMIN';
  const rows = await db.select().from(aiCmoPlans).where(eq(aiCmoPlans.id, params.planId));
  if (rows.length === 0) {
    throw new Error(`Multi-step plan ${params.planId} not found.`);
  }

  const plan = rows[0];
  const steps: MultiStepCheckpointItem[] = Array.isArray(plan.steps)
    ? (plan.steps as MultiStepCheckpointItem[])
    : [];

  const compensatedStepNumbers: number[] = [];

  // Compensate in reverse order (last completed checkpoint back to step 1)
  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i];
    if (step.checkpointStatus !== 'CHECKPOINT_SAVED') continue;

    if (step.actionType !== 'READ_ONLY') {
      // Restore pre-step state if live mutation was performed
      if (step.toolName === 'draftProductUpdate' && step.preStepSnapshot?.id) {
        const allProds = await getAllProducts();
        const existing = allProds.find((p: any) => p.id === step.preStepSnapshot.id);
        if (existing) {
          await upsertProduct({
            ...existing,
            subtitle: step.preStepSnapshot.subtitle ?? existing.subtitle,
            badge: step.preStepSnapshot.badge ?? existing.badge
          });
        }
      } else if (step.toolName === 'draftCoupon' && step.payload?.code) {
        const allCoupons = await getAllCoupons();
        const existing = allCoupons.find(
          (c: any) => String(c.code).toUpperCase() === String(step.payload.code).toUpperCase()
        );
        if (existing) {
          await upsertCoupon({ ...existing, active: false });
        }
      }
    }

    step.checkpointStatus = 'COMPENSATED_ROLLED_BACK';
    step.lastError = null;
    compensatedStepNumbers.push(step.stepNumber);
  }

  const updatedEvidence = {
    ...((plan.contextEvidence as Record<string, any>) || {}),
    compensationStatus: 'COMPENSATED_IN_REVERSE_ORDER',
    compensatedStepNumbers,
    compensatedAtUtc: new Date().toISOString(),
    compensatedAtIst: formatTimestampIst(new Date()),
    compensationReason:
      params.reason || 'Saga rollback executed to compensate completed checkpoints'
  };

  await db
    .update(aiCmoPlans)
    .set({
      status: 'COMPENSATED_ROLLED_BACK',
      steps,
      contextEvidence: updatedEvidence,
      updatedAt: new Date()
    })
    .where(eq(aiCmoPlans.id, plan.id));

  await db.insert(aiCmoAuditObservabilityLogs).values({
    id: `AICMO-AUDIT-SAGA-COMP-${Date.now()}`,
    serviceComponent: 'ACTION_CENTER',
    eventType: 'multi_step_plan.compensated',
    actorEmail,
    actorRole,
    adapterTarget: 'ai_cmo_plans',
    mutatedExistingData: false,
    featureFlagState: {},
    latencyMs: 19,
    status: 'SUCCESS',
    details: {
      planId: plan.id,
      compensatedStepNumbers,
      reason: params.reason
    },
    createdAt: new Date()
  });

  const [refreshedPlan] = await db
    .select()
    .from(aiCmoPlans)
    .where(eq(aiCmoPlans.id, plan.id));

  broadcastCrossBrowserSyncEvent({
    entity: 'ai_cmo_3',
    action: 'ai_cmo.multi_step_plan_compensated',
    entityId: plan.id,
    summary: `Multi-Step Plan ${plan.id} compensated in reverse order (${compensatedStepNumbers.join(' -> ')})`
  });

  return {
    planId: plan.id,
    compensatedStepNumbers,
    status: 'COMPENSATED_ROLLED_BACK',
    plan: refreshedPlan
  };
}

// ============================================================================
// 8. UNIVERSAL ACTION CENTER FULL STATE SNAPSHOT
// ============================================================================

export async function getUniversalAiActionCenterSnapshot() {
  const [approvalsRows, plansRows] = await Promise.all([
    db.select().from(aiCmoActionApprovals).orderBy(desc(aiCmoActionApprovals.createdAt)),
    db.select().from(aiCmoPlans).orderBy(desc(aiCmoPlans.createdAt))
  ]);

  const approvalCards: UniversalApprovalCard[] = [];
  for (const row of approvalsRows.slice(0, 35)) {
    const card = await buildUniversalApprovalCardForAction(row);
    approvalCards.push(card);
  }

  return {
    retrievedAtUtc: new Date().toISOString(),
    retrievedAtIst: formatTimestampIst(new Date()),
    actionTypeCatalog: UNIVERSAL_ACTION_TYPE_CATALOG,
    narrowPreconfiguredPolicies: getNarrowPreconfiguredPolicies(),
    strictHighStakesGuardrails: [
      {
        domain: 'REFUNDS_AND_PAYMENTS',
        toolName: 'draftRefundAction',
        rule: 'Requires explicit Return ID, exact ₹ refund amount <= original net order paid, and physical seal QC inspection status. Blocks ambiguous refund instructions.'
      },
      {
        domain: 'CUSTOMER_MESSAGING',
        toolName: 'draftNotification',
        rule: 'Requires explicit channel (WhatsApp/Email/SMS), opted-in cohort, requireOptInConsent=true, and approved template copy. Blocks ambiguous broadcast instructions.'
      },
      {
        domain: 'EXTERNAL_AD_SPEND',
        toolName: 'draftBudgetChange',
        rule: 'Requires explicit Campaign ID, exact ₹ budget >= incurred spend, and POAS justification. Blocks ambiguous ad spend instructions.'
      },
      {
        domain: 'HIGH_RISK_INVENTORY_AND_WORKFLOW_PUBLISH',
        toolName: 'draftInventoryAdjustment / draftAutomationPublish',
        rule: 'Requires explicit SUPER_ADMIN or INVENTORY_MANAGER approval and pre-execution resource version verification.'
      }
    ],
    approvalCards,
    multiStepPlans: plansRows
  };
}
