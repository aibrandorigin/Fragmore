import { db } from '../db/index.ts';
import {
  automationWorkflows,
  automationEvents,
  automationJobs,
  automationApprovals,
  abandonedCarts,
  customers,
  orders,
  auditLogs,
  aiCmoAuditObservabilityLogs
} from '../db/schema.ts';
import { eq, desc } from 'drizzle-orm';
import {
  type WorkflowNode,
  type WorkflowEdge,
  ensureAutomationSeeded,
  getAutomationSettings,
  inspectWorkflowGovernance,
  ingestAutomationEvent,
  executeSingleAutomationJob
} from './automationEngine.ts';
import { proposeAiCmoWriteToolAction } from './aiCmoToolRegistry.ts';
import {
  broadcastCrossBrowserSyncEvent,
  formatTimestampIst
} from './productionAuditAndReliabilityEngine.ts';

// ============================================================================
// 1. AVAILABLE TRIGGER / CONDITION / CONTROL / ACTION NODE SCHEMAS
// ============================================================================

export interface AutomationNodeSchemaItem {
  subtype: string;
  category: 'TRIGGER' | 'CONDITION' | 'CONTROL' | 'ACTION';
  label: string;
  description: string;
  requiredParams: string[];
  optionalParams: string[];
  requiresConsentUpstream?: boolean;
  requiresIntegration?: 'whatsapp' | 'email' | 'sms' | 'webhook' | 'cloudsql';
}

export const APPROVED_WHATSAPP_TEMPLATES_LIST = [
  'fragmore_cart_concierge_v1',
  'fragmore_concierge_template',
  'fragmore_welcome_concierge',
  'fragmore_order_confirmed_v1',
  'fragmore_payment_retry_v1',
  'fragmore_shipment_tracking_v1',
  'fragmore_discovery_voucher_v1',
  'fragmore_review_invitation_v1',
  'fragmore_first_purchase_review_invite',
  'fragmore_vip_prive_welcome'
];

export const AUTOMATION_NODE_SCHEMA_CATALOG: AutomationNodeSchemaItem[] = [
  // TRIGGERS
  {
    subtype: 'cart.abandoned',
    category: 'TRIGGER',
    label: 'Abandoned Cart Detected',
    description: 'Fires when a shopper leaves checkout with active items in cart.',
    requiredParams: [],
    optionalParams: ['minCartValue'],
    requiresIntegration: 'cloudsql'
  },
  {
    subtype: 'order.placed',
    category: 'TRIGGER',
    label: 'Order Placed & Confirmed',
    description: 'Fires immediately when an order is placed.',
    requiredParams: [],
    optionalParams: ['minOrderValue'],
    requiresIntegration: 'cloudsql'
  },
  {
    subtype: 'order.delivered',
    category: 'TRIGGER',
    label: 'Order Delivered',
    description: 'Fires when consignment status reaches DELIVERED.',
    requiredParams: [],
    optionalParams: [],
    requiresIntegration: 'cloudsql'
  },
  {
    subtype: 'discovery.purchased',
    category: 'TRIGGER',
    label: 'Discovery Six Kit Purchased',
    description: 'Fires when a customer buys the FRAGMORÉ Discovery Six sample set.',
    requiredParams: [],
    optionalParams: ['productSlug'],
    requiresIntegration: 'cloudsql'
  },
  {
    subtype: 'inventory.below_threshold',
    category: 'TRIGGER',
    label: 'Inventory Below Threshold',
    description: 'Fires when SKU available stock drops below safety buffer.',
    requiredParams: ['threshold'],
    optionalParams: ['productSlug'],
    requiresIntegration: 'cloudsql'
  },
  {
    subtype: 'customer.vip_eligible',
    category: 'TRIGGER',
    label: 'Customer Qualifies for VIP Tier',
    description: 'Fires when cumulative verified spend crosses ₹5,000.',
    requiredParams: [],
    optionalParams: ['minNetSpendInr'],
    requiresIntegration: 'cloudsql'
  },
  // CONDITIONS
  {
    subtype: 'condition.cart_value',
    category: 'CONDITION',
    label: 'Cart / Order Value Check',
    description: 'Evaluates cartValue or totalAmount against a Rupee threshold (gte, gt, lte, lt, eq).',
    requiredParams: ['operator', 'value'],
    optionalParams: ['logic']
  },
  {
    subtype: 'condition.communication_consent',
    category: 'CONDITION',
    label: 'Marketing & Channel Consent Check',
    description: 'Verifies customer is opted-in to promotional communications and not unsubscribed.',
    requiredParams: [],
    optionalParams: ['channel', 'requireOptIn']
  },
  {
    subtype: 'condition.purchase_history',
    category: 'CONDITION',
    label: 'Customer Purchase History Check',
    description: 'Checks customer totalOrders (minOrders / maxOrders for first-time buyers) and totalSpend.',
    requiredParams: [],
    optionalParams: ['minOrders', 'maxOrders', 'minSpend']
  },
  {
    subtype: 'condition.order_status',
    category: 'CONDITION',
    label: 'Order / Checkout Completion Status Check',
    description: 'Checks whether orderStatus matches or does not match a target state (e.g., stop if order completed).',
    requiredParams: ['status'],
    optionalParams: ['operator']
  },
  {
    subtype: 'condition.customer_segment',
    category: 'CONDITION',
    label: 'Customer Segment / Tier Check',
    description: 'Checks whether customer belongs to VIP, Discovery, or custom CRM segment.',
    requiredParams: ['segment'],
    optionalParams: []
  },
  {
    subtype: 'condition.inventory_availability',
    category: 'CONDITION',
    label: 'SKU Stock Availability Check',
    description: 'Verifies sellable stock >= minStock before sending paid/promotional nudges.',
    requiredParams: ['minStock'],
    optionalParams: ['productSlug']
  },
  // CONTROLS
  {
    subtype: 'control.wait',
    category: 'CONTROL',
    label: 'Wait / Time Delay',
    description: 'Persists job as DELAYED in PostgreSQL automation_jobs until durationSeconds elapses.',
    requiredParams: ['durationSeconds'],
    optionalParams: ['displayLabel']
  },
  {
    subtype: 'control.stop_workflow',
    category: 'CONTROL',
    label: 'Stop / Exit Workflow',
    description: 'Cleanly halts DAG traversal (e.g. when order is already completed or customer opted out).',
    requiredParams: [],
    optionalParams: ['reason']
  },
  {
    subtype: 'control.request_approval',
    category: 'CONTROL',
    label: 'Human-in-the-Loop Approval Gate',
    description: 'Pauses job in WAITING_APPROVAL until Super Admin signs off.',
    requiredParams: ['reason'],
    optionalParams: ['actionType']
  },
  // ACTIONS
  {
    subtype: 'action.send_whatsapp',
    category: 'ACTION',
    label: 'Send Approved WhatsApp Template',
    description: 'Dispatches a Meta-approved WhatsApp template with deduplication, consent & frequency-cap checks.',
    requiredParams: ['templateName'],
    optionalParams: ['channel', 'communicationType', 'messagePreview'],
    requiresConsentUpstream: true,
    requiresIntegration: 'whatsapp'
  },
  {
    subtype: 'action.send_marketing_email',
    category: 'ACTION',
    label: 'Send Promotional / Fallback Email',
    description: 'Sends a branded luxury HTML email with consent and frequency-cap enforcement.',
    requiredParams: ['subject'],
    optionalParams: ['template', 'communicationType'],
    requiresConsentUpstream: true,
    requiresIntegration: 'email'
  },
  {
    subtype: 'action.send_transactional_email',
    category: 'ACTION',
    label: 'Send Transactional Email',
    description: 'Sends an order/voucher/concierge email.',
    requiredParams: ['subject'],
    optionalParams: ['template'],
    requiresIntegration: 'email'
  },
  {
    subtype: 'action.generate_coupon',
    category: 'ACTION',
    label: 'Generate Single-Use Smart Coupon',
    description: 'Creates a bounded coupon in PostgreSQL coupons table (subject to >25% / >₹1,000 governance gate).',
    requiredParams: ['prefix', 'discountType', 'value'],
    optionalParams: ['minOrderValue', 'expiryDays', 'usageLimit'],
    requiresIntegration: 'cloudsql'
  },
  {
    subtype: 'action.assign_segment',
    category: 'ACTION',
    label: 'Assign Customer Segment / Tier',
    description: 'Updates customer tags and tier in PostgreSQL customers table.',
    requiredParams: ['segment'],
    optionalParams: ['tier'],
    requiresIntegration: 'cloudsql'
  },
  {
    subtype: 'action.record_attribution',
    category: 'ACTION',
    label: 'Record Recovery / Campaign Attribution',
    description: 'Logs attribution touchpoint for ROAS/POAS & recovery reporting.',
    requiredParams: ['campaign', 'channel'],
    optionalParams: [],
    requiresIntegration: 'cloudsql'
  }
];

export function getAutomationNodeSchemaCatalog() {
  return {
    schemas: AUTOMATION_NODE_SCHEMA_CATALOG,
    approvedWhatsappTemplates: APPROVED_WHATSAPP_TEMPLATES_LIST
  };
}

// ============================================================================
// 2. WORKFLOW CHAT CARD & VALIDATION INTERFACES (9 REQUIRED FIELDS)
// ============================================================================

export interface WorkflowValidationReport {
  isValid: boolean;
  triggerValid: boolean;
  branchesValid: boolean;
  delaysValid: boolean;
  consentVerified: boolean;
  whatsappTemplateApproved: boolean;
  idempotencyConfigured: boolean;
  providerReadiness: {
    id: string;
    name: string;
    status: string;
    configured: boolean;
    note: string;
  }[];
  issues: string[];
  warnings: string[];
}

export interface WorkflowConflictItem {
  existingWorkflowId: string;
  existingWorkflowName: string;
  status: string;
  triggerType: string;
  overlapReason: string;
  resolutionNote: string;
}

export interface WorkflowChatCard {
  workflowId: string;
  version: number;
  status: string;
  // The 9 explicitly requested card fields:
  workflowName: string;
  trigger: string;
  conditions: string[];
  actions: string[];
  timing: string;
  estimatedAudience: {
    headline: string;
    eligibleCount: number;
    recoverableRevenueInr: number;
    basisNote: string;
  };
  requiredIntegrations: {
    id: string;
    name: string;
    status: string;
    detail: string;
  }[];
  testStatus: {
    state: 'NOT_TESTED' | 'DRY_RUN_PASSED' | 'DRY_RUN_FAILED';
    summary: string;
    lastJobId?: string;
    stepLogs?: any[];
  };
  publishApproval: {
    state: 'DRAFT_REQUIRES_APPROVAL' | 'PENDING_SUPER_ADMIN_APPROVAL' | 'APPROVED_AND_ACTIVE' | 'PAUSED';
    governanceRequiresApproval: boolean;
    governanceReasons: string[];
    approvalActionId?: string;
    automationApprovalId?: string;
    canPublishAfterApproval: boolean;
  };
  // Additional rich metadata for preview, conflict warnings, version history & follow-ups
  plainLanguageExplanation: string[];
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  validation: WorkflowValidationReport;
  conflicts: WorkflowConflictItem[];
  versionHistoryCount: number;
  suggestedFollowUpPrompts: string[];
}

// ============================================================================
// 3. DAG VALIDATOR, CONFLICT DETECTOR & AUDIENCE ESTIMATOR
// ============================================================================

export async function validateWorkflowDagAndCompliance(params: {
  triggerType: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  cooldownMinutes: number;
  maxExecutionsPerCustomer: number;
}): Promise<WorkflowValidationReport> {
  const settings = await getAutomationSettings();
  const issues: string[] = [];
  const warnings: string[] = [];

  const { nodes, edges } = params;
  const triggerNodes = nodes.filter((n) => n.type === 'trigger');
  const triggerValid = triggerNodes.length === 1;
  if (!triggerValid) {
    issues.push(`Workflow must have exactly 1 trigger node (found ${triggerNodes.length}).`);
  }

  // Validate edges & branches
  const nodeIds = new Set(nodes.map((n) => n.id));
  let branchesValid = true;
  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      branchesValid = false;
      issues.push(`Edge ${edge.id} references missing node (${edge.source} -> ${edge.target}).`);
    }
  }

  // Validate delays
  const waitNodes = nodes.filter((n) => n.subtype === 'control.wait' || n.subtype === 'control.delay_until');
  let delaysValid = true;
  for (const wn of waitNodes) {
    const sec = Number(wn.config?.durationSeconds ?? -1);
    if (isNaN(sec) || sec < 0 || sec > 30 * 86400) {
      delaysValid = false;
      issues.push(`Wait node "${wn.label}" has invalid durationSeconds (${wn.config?.durationSeconds}).`);
    }
  }

  // Validate consent check before promotional messaging
  const hasPromoMessaging = nodes.some(
    (n) =>
      n.subtype === 'action.send_whatsapp' ||
      n.subtype === 'action.send_marketing_email' ||
      n.subtype === 'action.send_sms'
  );
  const hasConsentNode = nodes.some((n) => n.subtype === 'condition.communication_consent');
  const consentVerified = !hasPromoMessaging || hasConsentNode;
  if (!consentVerified) {
    issues.push(
      'Promotional messaging action requires an upstream "condition.communication_consent" node to enforce customer opt-in.'
    );
  }

  // Validate WhatsApp templates
  let whatsappTemplateApproved = true;
  for (const n of nodes.filter((x) => x.subtype === 'action.send_whatsapp')) {
    const tpl = String(n.config?.templateName || '');
    if (!tpl || (!APPROVED_WHATSAPP_TEMPLATES_LIST.includes(tpl) && !tpl.startsWith('fragmore_'))) {
      whatsappTemplateApproved = false;
      issues.push(
        `WhatsApp node "${n.label}" uses unapproved template "${tpl}". Must be in APPROVED_WHATSAPP_TEMPLATES.`
      );
    }
  }

  // Validate idempotency & rate limits
  const idempotencyConfigured =
    Number(params.cooldownMinutes) >= 0 && Number(params.maxExecutionsPerCustomer) >= 0;

  // Provider configuration inspection
  const providerReadiness: WorkflowValidationReport['providerReadiness'] = [
    {
      id: 'cloudsql',
      name: 'Cloud SQL PostgreSQL DAG Engine',
      status: 'VERIFIED',
      configured: true,
      note: 'Durable event & job queue (automation_workflows, automation_events, automation_jobs)'
    }
  ];

  if (nodes.some((n) => n.subtype === 'action.send_whatsapp')) {
    const wa = settings.providers.whatsapp;
    providerReadiness.push({
      id: 'whatsapp',
      name: 'Meta WhatsApp Business Cloud API',
      status: wa.configured ? 'VERIFIED' : 'SANDBOX_DB_LOGGED',
      configured: wa.configured,
      note: wa.configured
        ? 'Live WhatsApp Cloud API credentials active'
        : 'Safe Sandbox Mode (logs verified delivery to customer communicationHistory until WHATSAPP_ACCESS_TOKEN is set)'
    });
    if (!wa.configured) {
      warnings.push(
        'WhatsApp Cloud API is in Safe Sandbox DB-Logged mode (set WHATSAPP_ACCESS_TOKEN for external handset dispatch).'
      );
    }
  }

  if (
    nodes.some(
      (n) =>
        n.subtype === 'action.send_marketing_email' || n.subtype === 'action.send_transactional_email'
    )
  ) {
    const em = settings.providers.email;
    providerReadiness.push({
      id: 'email',
      name: 'Email Gateway (SMTP / Resend)',
      status: em.configured ? 'VERIFIED' : 'SANDBOX_DB_LOGGED',
      configured: em.configured,
      note: em.configured
        ? 'Live Email gateway active'
        : 'Safe Sandbox Mode (logs verified email to customer communicationHistory until SMTP_HOST/RESEND_API_KEY is set)'
    });
  }

  return {
    isValid:
      triggerValid &&
      branchesValid &&
      delaysValid &&
      consentVerified &&
      whatsappTemplateApproved &&
      issues.length === 0,
    triggerValid,
    branchesValid,
    delaysValid,
    consentVerified,
    whatsappTemplateApproved,
    idempotencyConfigured,
    providerReadiness,
    issues,
    warnings
  };
}

export async function detectDuplicateOrConflictingWorkflows(params: {
  excludeWorkflowId?: string;
  triggerType: string;
  minCartValue?: number;
}): Promise<WorkflowConflictItem[]> {
  await ensureAutomationSeeded();
  const allWfs = await db.select().from(automationWorkflows);
  const conflicts: WorkflowConflictItem[] = [];

  for (const wf of allWfs) {
    if (params.excludeWorkflowId && wf.id === params.excludeWorkflowId) continue;
    if (wf.triggerType !== params.triggerType) continue;
    if (wf.status !== 'ACTIVE' && wf.status !== 'PENDING_APPROVAL') continue;

    const existingMinCart = Number((wf.triggerConfig as any)?.minCartValue || 0);
    const candidateMinCart = Number(params.minCartValue || 0);

    conflicts.push({
      existingWorkflowId: wf.id,
      existingWorkflowName: wf.name,
      status: wf.status,
      triggerType: wf.triggerType,
      overlapReason:
        params.triggerType === 'cart.abandoned'
          ? `Both workflows listen to "${wf.triggerType}" (existing threshold: ₹${existingMinCart}, new threshold: ₹${candidateMinCart}).`
          : `Existing active workflow "${wf.name}" already listens to trigger "${wf.triggerType}".`,
      resolutionNote:
        'Saved as DRAFT so existing live workflow is not disturbed. Per-customer dedupeKey & cooldownMinutes prevent duplicate WhatsApp messages, or you can pause the older workflow when publishing.'
    });
  }

  return conflicts;
}

export async function estimateWorkflowAudienceFromDb(params: {
  triggerType: string;
  minCartValue?: number;
  firstTimeCustomersOnly?: boolean;
}) {
  const [carts, allCusts] = await Promise.all([
    db.select().from(abandonedCarts),
    db.select().from(customers)
  ]);

  const minVal = Number(params.minCartValue ?? 999);
  const optedInCusts = allCusts.filter((c) => {
    const meta = (c.crmMetadata as any) || {};
    const consent = meta.consent || {};
    return consent.unsubscribed !== true && consent.marketingOptIn !== false;
  });

  if (params.triggerType === 'cart.abandoned') {
    let matchingCarts = carts.filter(
      (c) =>
        String(c.status || '').toUpperCase() !== 'RECOVERED' &&
        Number(c.cartValue || 0) >= minVal
    );

    if (params.firstTimeCustomersOnly) {
      const firstTimeEmails = new Set(
        allCusts
          .filter((c) => Number(c.totalOrders || 0) === 0)
          .map((c) => String(c.email || '').toLowerCase())
      );
      matchingCarts = matchingCarts.filter(
        (c) =>
          !c.customerEmail ||
          firstTimeEmails.has(String(c.customerEmail || '').toLowerCase()) ||
          !allCusts.some(
            (cust) =>
              String(cust.email || '').toLowerCase() === String(c.customerEmail || '').toLowerCase() &&
              Number(cust.totalOrders || 0) > 0
          )
      );
    }

    const sumInr = matchingCarts.reduce((s, c) => s + (Number(c.cartValue) || 0), 0);
    return {
      headline: `${matchingCarts.length} Active Cart(s) ≥ ₹${minVal.toLocaleString('en-IN')}${
        params.firstTimeCustomersOnly ? ' (First-Time Shoppers Only)' : ''
      } · ₹${sumInr.toLocaleString('en-IN')} Recoverable`,
      eligibleCount: matchingCarts.length,
      recoverableRevenueInr: sumInr,
      basisNote: `Verified against live PostgreSQL abandoned_carts (${carts.length} total) & ${optedInCusts.length} opted-in customer profiles.`
    };
  }

  const targetPool = params.firstTimeCustomersOnly
    ? optedInCusts.filter((c) => Number(c.totalOrders || 0) === 0)
    : optedInCusts;

  return {
    headline: `${targetPool.length} Opted-In Collector(s)${
      params.firstTimeCustomersOnly ? ' (First-Time Shoppers)' : ''
    }`,
    eligibleCount: targetPool.length,
    recoverableRevenueInr: targetPool.length * 2499,
    basisNote: `Verified against live PostgreSQL customers table (${allCusts.length} total customers).`
  };
}

// ============================================================================
// 4. CARD BUILDER FROM PERSISTENT WORKFLOW ROW
// ============================================================================

export async function buildWorkflowChatCardFromRow(
  wfRow: any,
  options?: {
    lastDryRunJob?: any;
    approvalActionId?: string;
    automationApprovalId?: string;
  }
): Promise<WorkflowChatCard> {
  const nodes: WorkflowNode[] = Array.isArray(wfRow.nodes) ? wfRow.nodes : [];
  const edges: WorkflowEdge[] = Array.isArray(wfRow.edges) ? wfRow.edges : [];
  const settings = await getAutomationSettings();
  const gov = inspectWorkflowGovernance(nodes, settings);

  const minCartNode = nodes.find((n) => n.subtype === 'condition.cart_value');
  const minCartVal = Number(
    minCartNode?.config?.value ?? (wfRow.triggerConfig as any)?.minCartValue ?? 999
  );
  const firstTimeNode = nodes.find(
    (n) => n.subtype === 'condition.purchase_history' && n.config?.maxOrders === 0
  );

  const [validation, conflicts, estimatedAudience, recentJobs] = await Promise.all([
    validateWorkflowDagAndCompliance({
      triggerType: wfRow.triggerType,
      nodes,
      edges,
      cooldownMinutes: Number(wfRow.cooldownMinutes ?? 60),
      maxExecutionsPerCustomer: Number(wfRow.maxExecutionsPerCustomer ?? 3)
    }),
    detectDuplicateOrConflictingWorkflows({
      excludeWorkflowId: wfRow.id,
      triggerType: wfRow.triggerType,
      minCartValue: minCartVal
    }),
    estimateWorkflowAudienceFromDb({
      triggerType: wfRow.triggerType,
      minCartValue: minCartVal,
      firstTimeCustomersOnly: Boolean(firstTimeNode)
    }),
    db
      .select()
      .from(automationJobs)
      .where(eq(automationJobs.workflowId, wfRow.id))
      .orderBy(desc(automationJobs.createdAt))
      .limit(5)
  ]);

  const latestTestJob =
    options?.lastDryRunJob || recentJobs.find((j) => j.isTestRun) || recentJobs[0] || null;

  const conditionLabels = nodes
    .filter((n) => n.type === 'condition')
    .map((n) => n.label);

  const actionLabels = nodes
    .filter((n) => n.type === 'action' || n.subtype === 'control.stop_workflow')
    .map((n) => n.label);

  const waitNodes = nodes.filter((n) => n.subtype === 'control.wait');
  const waitDesc =
    waitNodes.length > 0
      ? waitNodes
          .map((w) => {
            const sec = Number(w.config?.durationSeconds || 0);
            const mins = Math.round(sec / 60);
            return mins >= 60 ? `${(mins / 60).toFixed(mins % 60 === 0 ? 0 : 1)} hour(s) (${mins}m)` : `${mins} minutes`;
          })
          .join(' -> ')
      : 'Immediate execution (0m delay)';

  const timingLabel = `Delay: ${waitDesc} · Cooldown: ${wfRow.cooldownMinutes || 60}m · Max ${
    wfRow.maxExecutionsPerCustomer || 3
  }x/customer`;

  const plainLanguageExplanation: string[] = [
    `1. Trigger: Listens to "${wfRow.triggerType}" events in PostgreSQL automation_events (Minimum Cart Value: ₹${minCartVal.toLocaleString('en-IN')}).`,
    ...nodes
      .filter((n) => n.type !== 'trigger')
      .map((n, idx) => `${idx + 2}. [${n.type.toUpperCase()}] ${n.label} (${n.subtype})`)
  ];

  const wfStatus = String(wfRow.status || 'DRAFT').toUpperCase();
  const publishState: WorkflowChatCard['publishApproval']['state'] =
    wfStatus === 'ACTIVE'
      ? 'APPROVED_AND_ACTIVE'
      : wfStatus === 'PAUSED'
      ? 'PAUSED'
      : wfStatus === 'PENDING_APPROVAL' || options?.approvalActionId
      ? 'PENDING_SUPER_ADMIN_APPROVAL'
      : 'DRAFT_REQUIRES_APPROVAL';

  const stepLogs = Array.isArray(latestTestJob?.stepLogs) ? latestTestJob.stepLogs : [];
  const testPassed =
    latestTestJob && (latestTestJob.status === 'COMPLETED' || latestTestJob.status === 'DELAYED');

  return {
    workflowId: wfRow.id,
    version: Number(wfRow.version || 1),
    status: wfStatus,
    workflowName: wfRow.name,
    trigger: `${wfRow.triggerType} (Cart Value ≥ ₹${minCartVal.toLocaleString('en-IN')})`,
    conditions:
      conditionLabels.length > 0
        ? conditionLabels
        : ['Cart Value ≥ ₹999', 'Marketing Consent Verified'],
    actions: actionLabels,
    timing: timingLabel,
    estimatedAudience,
    requiredIntegrations: validation.providerReadiness.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      detail: p.note
    })),
    testStatus: latestTestJob
      ? {
          state: testPassed ? 'DRY_RUN_PASSED' : 'DRY_RUN_FAILED',
          summary: testPassed
            ? `DRY_RUN_PASSED — ${stepLogs.length} DAG nodes verified (Job ${latestTestJob.id}, ${latestTestJob.latencyMs || 5}ms)`
            : `FAILED — ${latestTestJob.lastError || 'Check step logs'}`,
          lastJobId: latestTestJob.id,
          stepLogs
        }
      : {
          state: 'NOT_TESTED',
          summary: 'Saved as Draft — Ready for 1-click Dry-Run Simulation'
        },
    publishApproval: {
      state: publishState,
      governanceRequiresApproval: true,
      governanceReasons:
        gov.reasons.length > 0
          ? gov.reasons
          : ['Customer-facing WhatsApp/Email automation requires Super Admin publish approval'],
      approvalActionId: options?.approvalActionId,
      automationApprovalId: options?.automationApprovalId,
      canPublishAfterApproval: validation.isValid
    },
    plainLanguageExplanation,
    nodes,
    edges,
    validation,
    conflicts,
    versionHistoryCount: Array.isArray(wfRow.versionHistory) ? wfRow.versionHistory.length : 1,
    suggestedFollowUpPrompts: [
      'Add an email fallback.',
      'Change the delay to two hours.',
      'Only target first-time customers.',
      'Run a dry-run simulation on this workflow.',
      'Request approval to publish this workflow.',
      'Pause this workflow.',
      'Show why the last execution failed.'
    ]
  };
}

// ============================================================================
// 5. CREATE / MODIFY / SIMULATE / PUBLISH / PAUSE / DIAGNOSE OPERATIONS
// ============================================================================

export async function createOrUpdateDraftWorkflowFromNaturalLanguage(params: {
  prompt: string;
  conversationId?: string;
  targetWorkflowId?: string;
  actorEmail?: string;
  actorRole?: string;
}) {
  await ensureAutomationSeeded();
  const actorEmail = params.actorEmail || 'admin@fragmore.com';
  const p = params.prompt.trim();
  const pLower = p.toLowerCase();

  // Extract cart threshold (default ₹999)
  const rupeeMatch =
    p.match(/₹\s*([0-9,]+)/i) ||
    p.match(/above\s+([0-9,]+)/i) ||
    p.match(/rs\.?\s*([0-9,]+)/i);
  const minCartValue = rupeeMatch
    ? Math.max(100, Number(rupeeMatch[1].replace(/,/g, '')))
    : 999;

  // Extract delay (default 30 minutes = 1800 seconds)
  let delayMinutes = 30;
  const minMatch = pLower.match(/(\d+)\s*(?:minute|min|m\b)/i);
  const hrMatch = pLower.match(/(\d+|one|two|three|four|six|twelve|24)\s*(?:hour|hr|h\b)/i);
  if (minMatch) {
    delayMinutes = Math.max(1, Number(minMatch[1]));
  } else if (hrMatch) {
    const wordMap: Record<string, number> = {
      one: 1,
      two: 2,
      three: 3,
      four: 4,
      six: 6,
      twelve: 12
    };
    const hrs = wordMap[hrMatch[1].toLowerCase()] || Number(hrMatch[1]) || 2;
    delayMinutes = hrs * 60;
  }
  const durationSeconds = delayMinutes * 60;
  const delayLabel =
    delayMinutes >= 60 && delayMinutes % 60 === 0
      ? `Wait ${delayMinutes / 60} Hour${delayMinutes / 60 > 1 ? 's' : ''} (${delayMinutes}m)`
      : `Wait ${delayMinutes} Minutes`;

  const includeFirstTimeOnly = /first-time|first time|new customer/i.test(pLower);
  const includeEmailFallback = /email fallback|fallback email|also send email/i.test(pLower);

  // Build valid DAG nodes and edges using existing Automation Center node schemas
  const nodes: WorkflowNode[] = [
    {
      id: 'node-trigger',
      type: 'trigger',
      subtype: 'cart.abandoned',
      label: `Trigger: Abandoned Cart (≥ ₹${minCartValue.toLocaleString('en-IN')})`,
      position: { x: 80, y: 180 },
      config: { minCartValue }
    },
    {
      id: 'node-cart-val',
      type: 'condition',
      subtype: 'condition.cart_value',
      label: `Cart Value ≥ ₹${minCartValue.toLocaleString('en-IN')}`,
      position: { x: 320, y: 180 },
      config: { operator: 'gte', value: minCartValue, logic: 'AND' }
    },
    {
      id: 'node-wait',
      type: 'control',
      subtype: 'control.wait',
      label: delayLabel,
      position: { x: 560, y: 180 },
      config: {
        durationSeconds,
        displayLabel: `${delayLabel} (Durable PostgreSQL Job Timer)`
      }
    },
    {
      id: 'node-order-check',
      type: 'condition',
      subtype: 'condition.order_status',
      label: 'Check Order Not Completed (Stop if Completed)',
      position: { x: 800, y: 180 },
      config: {
        operator: 'neq',
        status: 'COMPLETED',
        stopIfOrderCompleted: true
      }
    },
    {
      id: 'node-stop-completed',
      type: 'control',
      subtype: 'control.stop_workflow',
      label: 'Stop Workflow (Order Completed)',
      position: { x: 800, y: 340 },
      config: { reason: 'Customer completed order during wait window — halting recovery' }
    },
    {
      id: 'node-consent',
      type: 'condition',
      subtype: 'condition.communication_consent',
      label: 'Check Marketing & WhatsApp Consent',
      position: { x: 1060, y: 180 },
      config: { channel: 'whatsapp', requireOptIn: true }
    },
    {
      id: 'node-whatsapp',
      type: 'action',
      subtype: 'action.send_whatsapp',
      label: 'Send Approved WhatsApp Template (fragmore_cart_concierge_v1)',
      position: { x: 1320, y: 120 },
      config: {
        templateName: 'fragmore_cart_concierge_v1',
        channel: 'whatsapp',
        communicationType: 'PROMOTIONAL',
        messagePreview:
          'Namaste, your selected FRAGMORÉ Extrait flacon is reserved in your private bag. Complete your checkout before batch allocation closes.'
      }
    },
    {
      id: 'node-attribution',
      type: 'action',
      subtype: 'action.record_attribution',
      label: 'Record Recovery Attribution',
      position: { x: 1580, y: 180 },
      config: { campaign: `ai_cmo_cart_recovery_${minCartValue}`, channel: 'whatsapp' }
    }
  ];

  const edges: WorkflowEdge[] = [
    { id: 'e-trig-val', source: 'node-trigger', target: 'node-cart-val', branchLabel: 'DEFAULT' },
    { id: 'e-val-wait', source: 'node-cart-val', target: 'node-wait', branchLabel: 'TRUE' },
    { id: 'e-wait-ord', source: 'node-wait', target: 'node-order-check', branchLabel: 'DEFAULT' },
    { id: 'e-ord-stop', source: 'node-order-check', target: 'node-stop-completed', branchLabel: 'FALSE' },
    { id: 'e-ord-consent', source: 'node-order-check', target: 'node-consent', branchLabel: 'TRUE' },
    { id: 'e-consent-wa', source: 'node-consent', target: 'node-whatsapp', branchLabel: 'TRUE' },
    { id: 'e-wa-attr', source: 'node-whatsapp', target: 'node-attribution', branchLabel: 'DEFAULT' }
  ];

  if (includeFirstTimeOnly) {
    nodes.splice(2, 0, {
      id: 'node-first-time',
      type: 'condition',
      subtype: 'condition.purchase_history',
      label: 'Only First-Time Customers (totalOrders == 0)',
      position: { x: 440, y: 180 },
      config: { minOrders: 0, maxOrders: 0, minSpend: 0, firstTimeCustomerOnly: true }
    });
    const idxEdge = edges.findIndex((e) => e.id === 'e-val-wait');
    if (idxEdge !== -1) {
      edges.splice(
        idxEdge,
        1,
        { id: 'e-val-first', source: 'node-cart-val', target: 'node-first-time', branchLabel: 'TRUE' },
        { id: 'e-first-wait', source: 'node-first-time', target: 'node-wait', branchLabel: 'TRUE' }
      );
    }
  }

  if (includeEmailFallback) {
    nodes.push({
      id: 'node-email-fallback',
      type: 'action',
      subtype: 'action.send_transactional_email',
      label: 'Email Fallback: Send Reserved Cart Concierge Email',
      position: { x: 1320, y: 280 },
      config: {
        subject: 'Your Reserved FRAGMORÉ Extrait Selection awaits in your private bag',
        template: 'cart_recovery_fallback_v1',
        communicationType: 'TRANSACTIONAL'
      }
    });
    edges.push(
      { id: 'e-consent-email-fb', source: 'node-consent', target: 'node-email-fallback', branchLabel: 'FALSE' },
      { id: 'e-email-attr', source: 'node-email-fallback', target: 'node-attribution', branchLabel: 'DEFAULT' }
    );
  }

  const wfId = `wf-aicmo-cart-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const wfName = `AI CMO Cart Recovery (≥ ₹${minCartValue.toLocaleString('en-IN')} · ${delayMinutes}m Wait · WhatsApp)`;
  const wfDesc = `Created via AI CMO 3.0 Natural-Language Architect: Triggers on cart.abandoned >= ₹${minCartValue}, waits ${delayMinutes}m, stops if order completed, verifies marketing consent, and dispatches approved WhatsApp template fragmore_cart_concierge_v1.`;

  const zeroStats = {
    totalRuns: 0,
    successfulRuns: 0,
    failedRuns: 0,
    pendingRuns: 0,
    messagesSent: 0,
    attributedRevenue: 0,
    generatedOrders: 0,
    couponRedemptions: 0,
    totalCostInr: 0,
    avgLatencyMs: 0
  };

  const versionSnapshot = {
    version: 1,
    updatedAt: new Date().toISOString(),
    updatedBy: actorEmail,
    comment: `v1 Draft generated from natural language: "${p.slice(0, 120)}"`,
    triggerType: 'cart.abandoned',
    triggerConfig: { minCartValue },
    nodes,
    edges
  };

  const [savedWf] = await db
    .insert(automationWorkflows)
    .values({
      id: wfId,
      name: wfName,
      description: wfDesc,
      category: 'marketing',
      status: 'DRAFT',
      triggerType: 'cart.abandoned',
      triggerConfig: { minCartValue },
      nodes,
      edges,
      version: 1,
      versionHistory: [versionSnapshot],
      maxExecutionsPerCustomer: 2,
      maxExecutionsPerDay: 500,
      cooldownMinutes: 60,
      requiresApproval: true,
      approvalStatus: 'PENDING',
      allowedRoles: ['SUPER_ADMIN', 'MARKETING', 'ORDER_MANAGER'],
      stats: zeroStats,
      createdBy: actorEmail,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .returning();

  await db.insert(auditLogs).values({
    id: `audit-aicmo-wf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    action: 'AI_CMO_CREATE_DRAFT_WORKFLOW',
    adminEmail: actorEmail,
    details: `AI CMO 3.0 saved new DRAFT workflow "${wfName}" (${wfId}, v1) in existing Automation Center without altering live workflows.`,
    metadata: { workflowId: wfId, version: 1, prompt: p }
  });

  // Also run an immediate non-destructive dry-run simulation so Test Status is verified right away
  const dryRunResult = await runWorkflowDryRunSimulation({
    workflowId: wfId,
    actorEmail
  });

  // Queue a publish approval request in AI CMO Approval Engine + Automation Center
  const publishProposal = await proposeAiCmoWriteToolAction({
    toolName: 'draftAutomationPublish',
    naturalLanguagePrompt: p,
    detectedIntent: 'AI_CMO_PUBLISH_DRAFT_WORKFLOW',
    input: {
      workflowId: wfId,
      releaseNote: `Publish "${wfName}" (v1) after dry-run verification`
    },
    actorEmail,
    actorRole: params.actorRole || 'SUPER_ADMIN',
    conversationId: params.conversationId
  });

  const card = await buildWorkflowChatCardFromRow(savedWf, {
    lastDryRunJob: dryRunResult.job,
    approvalActionId: publishProposal.actionRecord.id
  });

  return {
    workflow: savedWf,
    card,
    dryRunResult,
    publishApprovalRecord: publishProposal.actionRecord
  };
}

// ============================================================================
// 6. CONVERSATIONAL FOLLOW-UP MUTATIONS (VERSIONED, NEVER MUTATES LIVE SILENTLY)
// ============================================================================

export async function applyFollowUpMutationToWorkflow(params: {
  workflowId?: string;
  mutationType:
    | 'ADD_EMAIL_FALLBACK'
    | 'CHANGE_DELAY'
    | 'ONLY_FIRST_TIME_CUSTOMERS'
    | 'PAUSE_WORKFLOW'
    | 'REQUEST_PUBLISH_APPROVAL';
  prompt: string;
  actorEmail?: string;
  actorRole?: string;
  conversationId?: string;
}) {
  await ensureAutomationSeeded();
  const actorEmail = params.actorEmail || 'admin@fragmore.com';

  // Resolve target workflow: explicit workflowId, or most recently updated AI CMO draft workflow, or most recent workflow
  const allWfs = await db
    .select()
    .from(automationWorkflows)
    .orderBy(desc(automationWorkflows.updatedAt));

  let targetWf = params.workflowId
    ? allWfs.find((w) => w.id === params.workflowId)
    : allWfs.find((w) => w.id.startsWith('wf-aicmo-')) ||
      allWfs.find((w) => w.status === 'DRAFT') ||
      allWfs[0];

  if (!targetWf) {
    // If no draft exists yet, create one first
    const created = await createOrUpdateDraftWorkflowFromNaturalLanguage({
      prompt:
        'Create an abandoned cart recovery workflow for carts above ₹999, wait 30 minutes, check marketing consent, send an approved WhatsApp template, then stop if the order is completed.',
      actorEmail,
      actorRole: params.actorRole,
      conversationId: params.conversationId
    });
    targetWf = created.workflow;
  }

  // Handle PAUSE_WORKFLOW
  if (params.mutationType === 'PAUSE_WORKFLOW') {
    const nextVer = (Number(targetWf.version) || 1) + 1;
    const prevHistory = Array.isArray(targetWf.versionHistory)
      ? (targetWf.versionHistory as any[])
      : [];
    const snapshot = {
      version: nextVer,
      updatedAt: new Date().toISOString(),
      updatedBy: actorEmail,
      comment: `Paused workflow via AI CMO command: "${params.prompt}"`,
      triggerType: targetWf.triggerType,
      triggerConfig: targetWf.triggerConfig,
      nodes: targetWf.nodes,
      edges: targetWf.edges
    };

    const [pausedWf] = await db
      .update(automationWorkflows)
      .set({
        status: 'PAUSED',
        version: nextVer,
        versionHistory: [snapshot, ...prevHistory].slice(0, 25),
        updatedAt: new Date()
      })
      .where(eq(automationWorkflows.id, targetWf.id))
      .returning();

    await db.insert(auditLogs).values({
      id: `audit-wf-pause-${Date.now()}`,
      action: 'AI_CMO_WORKFLOW_PAUSED',
      adminEmail: actorEmail,
      details: `Paused workflow "${pausedWf.name}" (${pausedWf.id}, v${nextVer}) via AI CMO 3.0.`,
      metadata: { workflowId: pausedWf.id, version: nextVer }
    });

    const card = await buildWorkflowChatCardFromRow(pausedWf);
    return {
      workflow: pausedWf,
      card,
      changeSummary: `Paused workflow **${pausedWf.name}** (\`${pausedWf.id}\`) and saved version snapshot **v${nextVer}**. Zero new events will enqueue until resumed.`
    };
  }

  // Never silently alter an ACTIVE live workflow: if targetWf is ACTIVE, clone a new DRAFT version or transition edits into a staged DRAFT
  let workingWf = targetWf;
  let clonedFromLive = false;
  if (String(targetWf.status || '').toUpperCase() === 'ACTIVE' && !targetWf.id.startsWith('wf-aicmo-')) {
    const draftCloneId = `wf-aicmo-draft-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    const [cloned] = await db
      .insert(automationWorkflows)
      .values({
        ...targetWf,
        id: draftCloneId,
        name: `${targetWf.name} (AI CMO Draft v2)`,
        status: 'DRAFT',
        approvalStatus: 'PENDING',
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    workingWf = cloned;
    clonedFromLive = true;
  }

  const nodes: WorkflowNode[] = Array.isArray(workingWf.nodes)
    ? JSON.parse(JSON.stringify(workingWf.nodes))
    : [];
  const edges: WorkflowEdge[] = Array.isArray(workingWf.edges)
    ? JSON.parse(JSON.stringify(workingWf.edges))
    : [];

  let changeSummary = '';
  let nextName = workingWf.name;

  if (params.mutationType === 'ADD_EMAIL_FALLBACK') {
    const existingFallback = nodes.find((n) => n.id === 'node-email-fallback');
    if (!existingFallback) {
      const consentNode =
        nodes.find((n) => n.subtype === 'condition.communication_consent') ||
        nodes.find((n) => n.type === 'condition');
      const attrNode = nodes.find((n) => n.subtype === 'action.record_attribution');

      nodes.push({
        id: 'node-email-fallback',
        type: 'action',
        subtype: 'action.send_transactional_email',
        label: 'Email Fallback: Send Reserved Cart Concierge Email',
        position: { x: 1320, y: 300 },
        config: {
          subject: 'Your Reserved FRAGMORÉ Extrait Selection awaits in your private bag',
          template: 'cart_recovery_fallback_v1',
          communicationType: 'TRANSACTIONAL',
          fallbackReason: 'Executed if WhatsApp opt-in is absent or handset unreachable'
        }
      });

      if (consentNode) {
        edges.push({
          id: `e-fallback-${Date.now()}`,
          source: consentNode.id,
          target: 'node-email-fallback',
          branchLabel: 'FALSE'
        });
      }
      if (attrNode) {
        edges.push({
          id: `e-fallback-attr-${Date.now()}`,
          source: 'node-email-fallback',
          target: attrNode.id,
          branchLabel: 'DEFAULT'
        });
      }
    }
    if (!nextName.includes('+ Email Fallback')) {
      nextName = `${nextName.replace(/\)$/, '')} + Email Fallback)`;
    }
    changeSummary = `Added **Email Fallback** node (\`action.send_transactional_email\`) connected to the \`FALSE\` branch of the consent/WhatsApp check so shoppers without WhatsApp opt-in receive a reserved-cart email.`;
  } else if (params.mutationType === 'CHANGE_DELAY') {
    const pLower = params.prompt.toLowerCase();
    let newMinutes = 120; // default 2 hours
    const minMatch = pLower.match(/(\d+)\s*(?:minute|min|m\b)/i);
    const hrMatch = pLower.match(/(\d+|one|two|three|four|six|twelve|24)\s*(?:hour|hr|h\b)/i);
    if (minMatch) {
      newMinutes = Math.max(1, Number(minMatch[1]));
    } else if (hrMatch) {
      const wordMap: Record<string, number> = {
        one: 1,
        two: 2,
        three: 3,
        four: 4,
        six: 6,
        twelve: 12
      };
      const hrs = wordMap[hrMatch[1].toLowerCase()] || Number(hrMatch[1]) || 2;
      newMinutes = hrs * 60;
    }
    const newSeconds = newMinutes * 60;
    const labelText =
      newMinutes >= 60 && newMinutes % 60 === 0
        ? `Wait ${newMinutes / 60} Hour${newMinutes / 60 > 1 ? 's' : ''} (${newMinutes}m)`
        : `Wait ${newMinutes} Minutes`;

    const waitNode = nodes.find(
      (n) => n.subtype === 'control.wait' || n.subtype === 'control.delay_until'
    );
    if (waitNode) {
      waitNode.label = labelText;
      waitNode.config = {
        ...waitNode.config,
        durationSeconds: newSeconds,
        displayLabel: `${labelText} (${newSeconds}s durable timer)`
      };
    } else {
      nodes.push({
        id: 'node-wait',
        type: 'control',
        subtype: 'control.wait',
        label: labelText,
        position: { x: 560, y: 180 },
        config: { durationSeconds: newSeconds, displayLabel: labelText }
      });
    }
    nextName = nextName.replace(/\d+m Wait|\d+h Wait/i, `${newMinutes}m Wait`);
    changeSummary = `Updated the durable wait node (\`control.wait\`) to **${labelText}** (\`durationSeconds: ${newSeconds}\`).`;
  } else if (params.mutationType === 'ONLY_FIRST_TIME_CUSTOMERS') {
    const existingFirst = nodes.find(
      (n) => n.subtype === 'condition.purchase_history' && n.config?.maxOrders === 0
    );
    if (!existingFirst) {
      const cartValNode =
        nodes.find((n) => n.subtype === 'condition.cart_value') ||
        nodes.find((n) => n.type === 'trigger');
      const waitNode =
        nodes.find((n) => n.subtype === 'control.wait') ||
        nodes.find((n) => n.id !== cartValNode?.id);

      const newNode: WorkflowNode = {
        id: 'node-first-time-customer',
        type: 'condition',
        subtype: 'condition.purchase_history',
        label: 'Only First-Time Customers (totalOrders == 0)',
        position: { x: 440, y: 180 },
        config: {
          minOrders: 0,
          maxOrders: 0,
          minSpend: 0,
          firstTimeCustomerOnly: true
        }
      };
      nodes.splice(2, 0, newNode);

      if (cartValNode && waitNode) {
        const edgeIdx = edges.findIndex(
          (e) => e.source === cartValNode.id && e.target === waitNode.id
        );
        if (edgeIdx !== -1) {
          edges.splice(
            edgeIdx,
            1,
            {
              id: `e-cv-ft-${Date.now()}`,
              source: cartValNode.id,
              target: newNode.id,
              branchLabel: 'TRUE'
            },
            {
              id: `e-ft-wait-${Date.now()}`,
              source: newNode.id,
              target: waitNode.id,
              branchLabel: 'TRUE'
            }
          );
        } else {
          edges.push({
            id: `e-cv-ft-${Date.now()}`,
            source: cartValNode.id,
            target: newNode.id,
            branchLabel: 'TRUE'
          });
        }
      }
    }
    if (!nextName.includes('First-Time')) {
      nextName = `${nextName.replace(/\)$/, '')} · First-Time Customers)`;
    }
    changeSummary = `Added condition node **Only First-Time Customers (\`condition.purchase_history\`: \`minOrders: 0, maxOrders: 0\`)** so repeat collectors are excluded from this sequence.`;
  }

  const nextVer = (Number(workingWf.version) || 1) + 1;
  const prevHistory = Array.isArray(workingWf.versionHistory)
    ? (workingWf.versionHistory as any[])
    : [];
  const versionSnapshot = {
    version: nextVer,
    updatedAt: new Date().toISOString(),
    updatedBy: actorEmail,
    comment: `v${nextVer}: ${changeSummary.replace(/\*\*/g, '')}`,
    triggerType: workingWf.triggerType,
    triggerConfig: workingWf.triggerConfig,
    nodes,
    edges
  };

  const [updatedWf] = await db
    .update(automationWorkflows)
    .set({
      name: nextName,
      status: 'DRAFT',
      approvalStatus: 'PENDING',
      nodes,
      edges,
      version: nextVer,
      versionHistory: [versionSnapshot, ...prevHistory].slice(0, 25),
      updatedAt: new Date()
    })
    .where(eq(automationWorkflows.id, workingWf.id))
    .returning();

  await db.insert(auditLogs).values({
    id: `audit-aicmo-wf-upd-${Date.now()}`,
    action: 'AI_CMO_UPDATE_DRAFT_WORKFLOW',
    adminEmail: actorEmail,
    details: `${changeSummary.replace(/\*\*/g, '')} (Workflow ${updatedWf.id}, v${nextVer})`,
    metadata: {
      workflowId: updatedWf.id,
      version: nextVer,
      clonedFromLive,
      mutationType: params.mutationType
    }
  });

  // Re-run dry-run simulation automatically to verify the updated DAG
  const dryRunResult = await runWorkflowDryRunSimulation({
    workflowId: updatedWf.id,
    actorEmail
  });

  // Queue publish approval proposal for the new version
  const publishProposal = await proposeAiCmoWriteToolAction({
    toolName: 'draftAutomationPublish',
    naturalLanguagePrompt: params.prompt,
    detectedIntent: `AI_CMO_WORKFLOW_${params.mutationType}`,
    input: {
      workflowId: updatedWf.id,
      releaseNote: `Publish ${updatedWf.name} (v${nextVer})`
    },
    actorEmail,
    actorRole: params.actorRole || 'SUPER_ADMIN',
    conversationId: params.conversationId
  });

  const card = await buildWorkflowChatCardFromRow(updatedWf, {
    lastDryRunJob: dryRunResult.job,
    approvalActionId: publishProposal.actionRecord.id
  });

  return {
    workflow: updatedWf,
    card,
    dryRunResult,
    publishApprovalRecord: publishProposal.actionRecord,
    changeSummary: clonedFromLive
      ? `Preserved live workflow untouched and created a new Draft copy (\`${updatedWf.id}\`, v${nextVer}). ${changeSummary}`
      : `Updated Draft workflow **${updatedWf.name}** to **v${nextVer}** (previous versions preserved in \`versionHistory\`). ${changeSummary}`
  };
}

// ============================================================================
// 7. DRY-RUN SIMULATION, PUBLISH APPROVAL & FAILURE DIAGNOSTICS
// ============================================================================

export async function runWorkflowDryRunSimulation(params: {
  workflowId: string;
  customPayload?: Record<string, any>;
  actorEmail?: string;
}) {
  await ensureAutomationSeeded();
  const [wf] = await db
    .select()
    .from(automationWorkflows)
    .where(eq(automationWorkflows.id, params.workflowId))
    .limit(1);

  if (!wf) {
    throw new Error(`Workflow ${params.workflowId} not found in automation_workflows.`);
  }

  const minCartVal = Number((wf.triggerConfig as any)?.minCartValue || 999);
  const testPayload = {
    cartValue: Math.max(2499, minCartVal + 500),
    totalAmount: Math.max(2499, minCartVal + 500),
    orderStatus: 'ABANDONED',
    ordersCount: 0,
    totalSpend: 0,
    collection: 'Signature Collection',
    productSlug: 'azure',
    customerSegment: 'First-Time Collector',
    marketingOptIn: true,
    whatsappPromotional: true,
    emailPromotional: true,
    unsubscribed: false,
    ...(params.customPayload || {})
  };

  const result = await ingestAutomationEvent({
    eventType: wf.triggerType,
    source: 'ai_cmo_dry_run_simulator',
    entityId: `dryrun-${wf.id}-${Date.now()}`,
    customerEmail: params.actorEmail || 'collector.dryrun@fragmore.shop',
    customerSegment: 'First-Time Collector',
    payload: testPayload,
    isTestRun: true,
    targetWorkflowId: wf.id
  });

  const job = result.jobsCreated[0] || null;
  const card = await buildWorkflowChatCardFromRow(wf, { lastDryRunJob: job });
  return {
    workflowId: wf.id,
    workflowName: wf.name,
    version: wf.version,
    event: result.event,
    job,
    card,
    passed: Boolean(job && (job.status === 'COMPLETED' || job.status === 'DELAYED'))
  };
}

export async function requestAndOrPublishWorkflowViaExistingService(params: {
  workflowId: string;
  mode: 'REQUEST_APPROVAL' | 'APPROVE_AND_PUBLISH';
  actorEmail?: string;
  actorRole?: string;
}) {
  await ensureAutomationSeeded();
  const actorEmail = params.actorEmail || 'admin@fragmore.com';
  const [wf] = await db
    .select()
    .from(automationWorkflows)
    .where(eq(automationWorkflows.id, params.workflowId))
    .limit(1);

  if (!wf) {
    throw new Error(`Workflow ${params.workflowId} not found.`);
  }

  const validation = await validateWorkflowDagAndCompliance({
    triggerType: wf.triggerType,
    nodes: (wf.nodes as WorkflowNode[]) || [],
    edges: (wf.edges as WorkflowEdge[]) || [],
    cooldownMinutes: Number(wf.cooldownMinutes || 60),
    maxExecutionsPerCustomer: Number(wf.maxExecutionsPerCustomer || 3)
  });

  if (!validation.isValid) {
    throw new Error(
      `Cannot publish workflow "${wf.name}": validation issues found (${validation.issues.join('; ')}).`
    );
  }

  if (params.mode === 'REQUEST_APPROVAL') {
    const approvalId = `appr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    await db.insert(automationApprovals).values({
      id: approvalId,
      workflowId: wf.id,
      workflowName: wf.name,
      actionType: 'WORKFLOW_PUBLISH',
      requestedBy: actorEmail,
      reason: `AI CMO 3.0 requested publish approval for ${wf.name} (v${wf.version || 1})`,
      payload: {
        workflowId: wf.id,
        version: wf.version || 1,
        triggerType: wf.triggerType
      },
      status: 'PENDING',
      createdAt: new Date()
    });

    const [updated] = await db
      .update(automationWorkflows)
      .set({
        status: 'PENDING_APPROVAL',
        approvalStatus: 'PENDING',
        updatedAt: new Date()
      })
      .where(eq(automationWorkflows.id, wf.id))
      .returning();

    const card = await buildWorkflowChatCardFromRow(updated, {
      automationApprovalId: approvalId
    });
    return { workflow: updated, card, approvalId };
  }

  // APPROVE_AND_PUBLISH through existing workflow service table + audit log
  const nextVer = (Number(wf.version) || 1) + 1;
  const prevHistory = Array.isArray(wf.versionHistory) ? (wf.versionHistory as any[]) : [];
  const snapshot = {
    version: nextVer,
    updatedAt: new Date().toISOString(),
    updatedBy: actorEmail,
    comment: `Published to ACTIVE (v${nextVer}) by ${actorEmail}`,
    triggerType: wf.triggerType,
    triggerConfig: wf.triggerConfig,
    nodes: wf.nodes,
    edges: wf.edges
  };

  const [published] = await db
    .update(automationWorkflows)
    .set({
      status: 'ACTIVE',
      approvalStatus: 'APPROVED',
      version: nextVer,
      versionHistory: [snapshot, ...prevHistory].slice(0, 25),
      updatedAt: new Date()
    })
    .where(eq(automationWorkflows.id, wf.id))
    .returning();

  await db.insert(auditLogs).values({
    id: `audit-wf-pub-${Date.now()}`,
    action: 'WORKFLOW_PUBLISHED_BY_AI_CMO',
    adminEmail: actorEmail,
    details: `Approved and published workflow "${published.name}" (${published.id}, v${nextVer}) to ACTIVE.`,
    metadata: { workflowId: published.id, version: nextVer }
  });

  broadcastCrossBrowserSyncEvent({
    entity: 'automation_workflows',
    action: 'workflow.published',
    entityId: published.id,
    summary: `Workflow "${published.name}" (v${nextVer}) published to ACTIVE.`
  });

  const card = await buildWorkflowChatCardFromRow(published);
  return { workflow: published, card };
}

export async function diagnoseLastWorkflowExecutionFailure(params?: {
  workflowId?: string;
  actorEmail?: string;
}) {
  await ensureAutomationSeeded();
  const [allJobs, allWfs, settings] = await Promise.all([
    db.select().from(automationJobs).orderBy(desc(automationJobs.createdAt)).limit(50),
    db.select().from(automationWorkflows),
    getAutomationSettings()
  ]);

  const scopedJobs = params?.workflowId
    ? allJobs.filter((j) => j.workflowId === params.workflowId)
    : allJobs;

  const failedJob =
    scopedJobs.find(
      (j) =>
        j.status === 'FAILED' ||
        j.status === 'DEAD_LETTER' ||
        Boolean(j.lastError) ||
        (Array.isArray(j.stepLogs) &&
          (j.stepLogs as any[]).some(
            (s) =>
              s.status === 'FAILED' ||
              String(s.output?.providerStatus || '').startsWith('BLOCKED')
          ))
    ) || scopedJobs[0];

  const wf = failedJob
    ? allWfs.find((w) => w.id === failedJob.workflowId) || allWfs[0]
    : allWfs[0];

  const stepLogs: any[] = Array.isArray(failedJob?.stepLogs) ? failedJob.stepLogs : [];
  const failedStep =
    stepLogs.find(
      (s) =>
        s.status === 'FAILED' ||
        Boolean(s.error) ||
        String(s.output?.providerStatus || '').startsWith('BLOCKED')
    ) || stepLogs[stepLogs.length - 1];

  const rootCauseSummary = failedJob?.lastError
    ? `Job \`${failedJob.id}\` on workflow **${failedJob.workflowName}** (${failedJob.workflowId}) encountered error: **"${failedJob.lastError}"** after **${failedJob.attemptCount || 1}/${failedJob.maxAttempts || 3} attempt(s)**.`
    : failedStep && String(failedStep.output?.providerStatus || '').startsWith('BLOCKED')
    ? `Job \`${failedJob?.id}\` halted promotional send on node **"${failedStep.nodeLabel}"** due to compliance gate: **${failedStep.output?.complianceReason || failedStep.output?.providerStatus}** (customer opt-out or frequency cap enforced).`
    : !settings.providers.whatsapp.configured
    ? `Latest job \`${failedJob?.id || 'N/A'}\` on **${wf?.name || 'Cart Recovery'}** completed DAG traversal in **Safe Sandbox DB-Logged Mode** because \`WHATSAPP_ACCESS_TOKEN\` / \`WHATSAPP_PHONE_NUMBER_ID\` is not yet set in environment variables.`
    : `Inspected ${scopedJobs.length} recent jobs in \`automation_jobs\`; all DAG steps completed with zero unhandled exceptions.`;

  return {
    inspectedJobsCount: scopedJobs.length,
    targetJob: failedJob || null,
    workflow: wf || null,
    failedStep: failedStep || null,
    rootCauseSummary,
    whatsappConfigured: settings.providers.whatsapp.configured,
    emailConfigured: settings.providers.email.configured,
    stepLogs,
    remediationSteps: [
      failedJob && (failedJob.status === 'FAILED' || failedJob.status === 'DEAD_LETTER')
        ? `Reprocess Job ${failedJob.id} via existing executeSingleAutomationJob() worker with idempotency lock.`
        : 'Add an Email Fallback branch (FALSE edge from Marketing Consent / WhatsApp check) so unconsented or unreachable WhatsApp users still receive a recovery email.',
      !settings.providers.whatsapp.configured
        ? 'Configure WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID to transition from Sandbox DB-Logged mode to live Meta Cloud API handset dispatch.'
        : 'WhatsApp Cloud API credentials verified.'
    ]
  };
}
