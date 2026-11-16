import crypto from 'crypto';
import { db } from '../db/index.ts';
import {
  abandonedCarts,
  orders,
  products,
  coupons,
  customers,
  returnsRefunds,
  automationSettingsTable,
  automationEvents,
  automationJobs
} from '../db/schema.ts';
import { eq, desc } from 'drizzle-orm';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type RecoveryStepId = 'T_PLUS_30M' | 'T_PLUS_6H' | 'T_PLUS_24H' | 'T_PLUS_48H';

export interface RecoveryStepRecord {
  stepId: RecoveryStepId;
  label: string;
  delayMinutes: number;
  scheduledAt: string;
  executedAt?: string | null;
  status:
    | 'SCHEDULED'
    | 'DELIVERED'
    | 'QUEUED'
    | 'INTEGRATION_REQUIRED'
    | 'FAILED'
    | 'SKIPPED_ANONYMOUS_NO_CONTACT'
    | 'SUPPRESSED_PRODUCT_UNAVAILABLE'
    | 'SUPPRESSED_CONSENT'
    | 'SUPPRESSED_FREQUENCY_CAP'
    | 'CANCELLED_ORDER_COMPLETED'
    | 'CANCELLED_UNSUBSCRIBED'
    | 'CANCELLED_MANUAL';
  channel?: 'WHATSAPP' | 'EMAIL' | 'SMS' | 'NONE';
  providerStatus?: string;
  externalMessageId?: string | null;
  couponCodeIssued?: string | null;
  discountEvaluationReason?: string | null;
  costInr?: number;
  error?: string | null;
}

export interface SmartCouponPolicyConfig {
  enabled: boolean;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number; // e.g. 10 (%) or 300 (INR)
  maxDiscountCapInr: number; // e.g. 750 INR
  minCartValueInr: number; // e.g. 2500 INR
  expiryHours: number; // e.g. 48 hours
  singleUse: boolean;
  excludedProductSlugs: string[]; // e.g. ['discovery-six']
  minGrossMarginPercent: number; // e.g. 55% minimum gross margin after discount
  estimatedCogsRatio: number; // e.g. 0.30 (30% COGS of selling price)
  campaignBudgetLimitInr: number; // e.g. 50000 INR max total discount budget
}

export interface AbandonedCartEngineConfig {
  abandonmentThresholdMinutes: number; // Initially 30 minutes
  attributionWindowHours: number; // 168 hours (7 days)
  enableStep1_30m: boolean;
  enableStep2_6h: boolean;
  enableStep3_24h: boolean;
  enableStep4_48h: boolean;
  maxMessagesPerCart: number;
  smartCouponPolicy: SmartCouponPolicyConfig;
}

export const DEFAULT_ABANDONED_CART_ENGINE_CONFIG: AbandonedCartEngineConfig = {
  abandonmentThresholdMinutes: 30,
  attributionWindowHours: 168,
  enableStep1_30m: true,
  enableStep2_6h: true,
  enableStep3_24h: true,
  enableStep4_48h: true,
  maxMessagesPerCart: 4,
  smartCouponPolicy: {
    enabled: true,
    discountType: 'PERCENTAGE',
    discountValue: 10,
    maxDiscountCapInr: 750,
    minCartValueInr: 2500,
    expiryHours: 48,
    singleUse: true,
    excludedProductSlugs: ['discovery-six'],
    minGrossMarginPercent: 55,
    estimatedCogsRatio: 0.3,
    campaignBudgetLimitInr: 50000
  }
};

// ============================================================================
// CONFIGURATION PERSISTENCE
// ============================================================================

export async function getAbandonedCartEngineConfig(): Promise<AbandonedCartEngineConfig> {
  try {
    const rows = await db
      .select()
      .from(automationSettingsTable)
      .where(eq(automationSettingsTable.id, 'global'))
      .limit(1);
    const globalCfg = (rows[0]?.config || {}) as Record<string, any>;
    const saved = globalCfg.abandonedCartEngine || {};
    return {
      ...DEFAULT_ABANDONED_CART_ENGINE_CONFIG,
      ...saved,
      smartCouponPolicy: {
        ...DEFAULT_ABANDONED_CART_ENGINE_CONFIG.smartCouponPolicy,
        ...(saved.smartCouponPolicy || {})
      }
    };
  } catch {
    return DEFAULT_ABANDONED_CART_ENGINE_CONFIG;
  }
}

export async function updateAbandonedCartEngineConfig(
  patch: Partial<AbandonedCartEngineConfig>
): Promise<AbandonedCartEngineConfig> {
  const current = await getAbandonedCartEngineConfig();
  const next: AbandonedCartEngineConfig = {
    ...current,
    ...patch,
    smartCouponPolicy: {
      ...current.smartCouponPolicy,
      ...(patch.smartCouponPolicy || {})
    }
  };

  const rows = await db
    .select()
    .from(automationSettingsTable)
    .where(eq(automationSettingsTable.id, 'global'))
    .limit(1);

  if (rows.length === 0) {
    await db.insert(automationSettingsTable).values({
      id: 'global',
      config: { abandonedCartEngine: next },
      updatedAt: new Date()
    });
  } else {
    const existingCfg = (rows[0].config || {}) as Record<string, any>;
    await db
      .update(automationSettingsTable)
      .set({
        config: {
          ...existingCfg,
          abandonedCartEngine: next
        },
        updatedAt: new Date()
      })
      .where(eq(automationSettingsTable.id, 'global'));
  }

  return next;
}

// ============================================================================
// COMMUNICATION PROVIDER ADAPTERS
// ============================================================================

export interface ProviderStatusSummary {
  whatsapp: {
    providerName: string;
    connected: boolean;
    statusLabel: 'Connected' | 'Integration required';
    missingEnvVars: string[];
  };
  email: {
    providerName: string;
    connected: boolean;
    statusLabel: 'Connected' | 'Integration required';
    missingEnvVars: string[];
  };
}

export function getRecoveryCommunicationProviderStatus(): ProviderStatusSummary {
  const waConnected = Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID
  );
  const emailConnected = Boolean(process.env.RESEND_API_KEY || process.env.SMTP_HOST);

  const waMissing: string[] = [];
  if (!process.env.WHATSAPP_ACCESS_TOKEN) waMissing.push('WHATSAPP_ACCESS_TOKEN');
  if (!process.env.WHATSAPP_PHONE_NUMBER_ID) waMissing.push('WHATSAPP_PHONE_NUMBER_ID');

  const emailMissing: string[] = [];
  if (!process.env.RESEND_API_KEY && !process.env.SMTP_HOST) {
    emailMissing.push('RESEND_API_KEY or SMTP_HOST');
  }

  return {
    whatsapp: {
      providerName: 'Meta WhatsApp Business Cloud API',
      connected: waConnected,
      statusLabel: waConnected ? 'Connected' : 'Integration required',
      missingEnvVars: waMissing
    },
    email: {
      providerName: 'Transactional & Recovery Email (Resend / SMTP)',
      connected: emailConnected,
      statusLabel: emailConnected ? 'Connected' : 'Integration required',
      missingEnvVars: emailMissing
    }
  };
}

export async function dispatchRecoveryMessageViaAdapter(params: {
  channel: 'WHATSAPP' | 'EMAIL';
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  recipientName?: string | null;
  cartId: string;
  stepId: RecoveryStepId | 'MANUAL';
  cartValue: number;
  itemsSummary: string;
  couponCode?: string | null;
  simulateProviderState?: 'CONNECTED_SUCCESS' | 'PROVIDER_FAILURE' | 'DEFAULT';
}): Promise<{
  attempted: boolean;
  delivered: boolean;
  status: 'DELIVERED' | 'INTEGRATION_REQUIRED' | 'FAILED' | 'QUEUED';
  provider: string;
  externalMessageId: string | null;
  costInr: number;
  error: string | null;
}> {
  const {
    channel,
    recipientEmail,
    recipientPhone,
    cartId,
    stepId,
    couponCode,
    simulateProviderState = 'DEFAULT'
  } = params;

  // 1. Explicit failure simulation for automated resilience testing
  if (simulateProviderState === 'PROVIDER_FAILURE') {
    return {
      attempted: true,
      delivered: false,
      status: 'FAILED',
      provider: channel === 'WHATSAPP' ? 'whatsapp_cloud_api' : 'email_gateway',
      externalMessageId: null,
      costInr: 0,
      error: `${channel} provider rejected request: 503 Upstream Gateway Timeout`
    };
  }

  // 2. Explicit connected test adapter mode (for deterministic E2E testing of delivery pipeline)
  if (simulateProviderState === 'CONNECTED_SUCCESS') {
    const msgId = `msg_${channel.toLowerCase()}_${cartId}_${stepId}_${Date.now()}`;
    return {
      attempted: true,
      delivered: true,
      status: 'DELIVERED',
      provider: channel === 'WHATSAPP' ? 'whatsapp_cloud_api' : 'email_gateway',
      externalMessageId: msgId,
      costInr: channel === 'WHATSAPP' ? 0.85 : 0.15,
      error: null
    };
  }

  const providerSummary = getRecoveryCommunicationProviderStatus();

  if (channel === 'WHATSAPP') {
    if (!recipientPhone || recipientPhone.replace(/\D/g, '').length < 10) {
      return {
        attempted: false,
        delivered: false,
        status: 'FAILED',
        provider: 'whatsapp_cloud_api',
        externalMessageId: null,
        costInr: 0,
        error: 'Missing valid 10-digit mobile number for WhatsApp dispatch'
      };
    }

    if (!providerSummary.whatsapp.connected) {
      // Do NOT pretend a message was sent if provider is not connected!
      return {
        attempted: true,
        delivered: false,
        status: 'INTEGRATION_REQUIRED',
        provider: 'whatsapp_cloud_api',
        externalMessageId: null,
        costInr: 0,
        error: `Integration required: Configure ${providerSummary.whatsapp.missingEnvVars.join(', ')} to enable live WhatsApp Business dispatch.`
      };
    }

    try {
      const phoneClean = recipientPhone.replace(/\D/g, '');
      const toNumber = phoneClean.length === 10 ? `91${phoneClean}` : phoneClean;
      const response = await fetch(
        `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: toNumber,
            type: 'template',
            template: {
              name: couponCode ? 'fragmore_cart_recovery_offer' : 'fragmore_cart_concierge_v1',
              language: { code: 'en' }
            }
          })
        }
      );

      if (!response.ok) {
        const errBody = await response.text();
        return {
          attempted: true,
          delivered: false,
          status: 'FAILED',
          provider: 'whatsapp_cloud_api',
          externalMessageId: null,
          costInr: 0,
          error: `WhatsApp API error (${response.status}): ${errBody.slice(0, 180)}`
        };
      }

      const data: any = await response.json();
      return {
        attempted: true,
        delivered: true,
        status: 'DELIVERED',
        provider: 'whatsapp_cloud_api',
        externalMessageId: data?.messages?.[0]?.id || `wa_${Date.now()}`,
        costInr: 0.85,
        error: null
      };
    } catch (err: any) {
      return {
        attempted: true,
        delivered: false,
        status: 'FAILED',
        provider: 'whatsapp_cloud_api',
        externalMessageId: null,
        costInr: 0,
        error: err.message || 'WhatsApp network transport failure'
      };
    }
  } else {
    // EMAIL CHANNEL
    if (!recipientEmail || !recipientEmail.includes('@')) {
      return {
        attempted: false,
        delivered: false,
        status: 'FAILED',
        provider: 'email_gateway',
        externalMessageId: null,
        costInr: 0,
        error: 'Missing valid email address for Email recovery dispatch'
      };
    }

    if (!providerSummary.email.connected) {
      return {
        attempted: true,
        delivered: false,
        status: 'INTEGRATION_REQUIRED',
        provider: 'email_gateway',
        externalMessageId: null,
        costInr: 0,
        error: `Integration required: Configure ${providerSummary.email.missingEnvVars.join(', ')} to enable live Email recovery dispatch.`
      };
    }

    if (process.env.RESEND_API_KEY) {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM || 'FRAGMORÉ Atelier <concierge@fragmore.shop>',
            to: [recipientEmail],
            subject: couponCode
              ? `Your FRAGMORÉ Selection & Private Privilege (${couponCode})`
              : 'Your Selected FRAGMORÉ Flacon Awaits in Your Private Bag',
            html: `<p>Your selected flacons (${params.itemsSummary}) remain reserved in your bag.</p>${
              couponCode ? `<p>Use single-use privilege code: <strong>${couponCode}</strong></p>` : ''
            }`
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          return {
            attempted: true,
            delivered: false,
            status: 'FAILED',
            provider: 'resend_email_api',
            externalMessageId: null,
            costInr: 0,
            error: `Resend API error (${response.status}): ${errText.slice(0, 180)}`
          };
        }

        const data: any = await response.json();
        return {
          attempted: true,
          delivered: true,
          status: 'DELIVERED',
          provider: 'resend_email_api',
          externalMessageId: data?.id || `em_${Date.now()}`,
          costInr: 0.15,
          error: null
        };
      } catch (err: any) {
        return {
          attempted: true,
          delivered: false,
          status: 'FAILED',
          provider: 'resend_email_api',
          externalMessageId: null,
          costInr: 0,
          error: err.message || 'Email network transport failure'
        };
      }
    }

    return {
      attempted: true,
      delivered: false,
      status: 'INTEGRATION_REQUIRED',
      provider: 'smtp_gateway',
      externalMessageId: null,
      costInr: 0,
      error: 'Integration required: SMTP transport credentials incomplete'
    };
  }
}

// ============================================================================
// PRODUCT STOCK & AVAILABILITY CHECKER
// ============================================================================

export async function checkCartProductsAvailability(items: any[]): Promise<{
  available: boolean;
  unavailableItems: string[];
}> {
  if (!Array.isArray(items) || items.length === 0) {
    return { available: false, unavailableItems: ['Empty cart'] };
  }

  const allProducts = await db.select().from(products);
  const unavailableItems: string[] = [];

  for (const item of items) {
    const prod = allProducts.find(
      (p) =>
        p.id === item.productId ||
        (item.slug && p.slug === item.slug) ||
        (item.productName && p.name.toLowerCase() === String(item.productName).toLowerCase())
    );

    if (!prod || String(prod.status).toUpperCase() !== 'ACTIVE') {
      unavailableItems.push(`${item.productName || item.slug || 'Unknown Product'} (Inactive/Removed)`);
      continue;
    }

    const variants: any[] = Array.isArray(prod.variants) ? prod.variants : [];
    const matchedVariant = variants.find(
      (v) =>
        (item.variantId && v.id === item.variantId) ||
        (item.sku && v.sku === item.sku) ||
        (item.size && String(v.size).toLowerCase() === String(item.size).toLowerCase())
    );

    if (!matchedVariant) {
      unavailableItems.push(`${prod.name} (${item.size || 'Default'})`);
      continue;
    }

    const reqQty = Math.max(1, Number(item.quantity) || 1);
    const isAvail =
      matchedVariant.isAvailable !== false &&
      (matchedVariant.stockManaged === false || Number(matchedVariant.stockAvailable ?? 0) >= reqQty);

    if (!isAvail) {
      unavailableItems.push(
        `${prod.name} (${matchedVariant.size}) — Available: ${matchedVariant.stockAvailable ?? 0}, Requested: ${reqQty}`
      );
    }
  }

  return {
    available: unavailableItems.length === 0,
    unavailableItems
  };
}

// ============================================================================
// SMART COUPON ENGINE (ELIGIBILITY, PROFITABILITY, MARGIN & BUDGET PROTECTION)
// ============================================================================

export async function getCampaignDiscountBudgetUsage(): Promise<{
  totalIssuedCount: number;
  totalIssuedPotentialInr: number;
  totalRedeemedInr: number;
}> {
  const allCoupons = await db.select().from(coupons);
  const allOrders = await db.select().from(orders);

  const recoveryCoupons = allCoupons.filter(
    (c) =>
      c.code.startsWith('RECOV') ||
      c.code.startsWith('PRIVILEGE') ||
      String(c.description || '').toLowerCase().includes('recovery')
  );

  let totalIssuedPotentialInr = 0;
  for (const c of recoveryCoupons) {
    const cap = Number(c.maxDiscount) || (c.discountType === 'FIXED' ? Number(c.value) : 500);
    totalIssuedPotentialInr += cap;
  }

  let totalRedeemedInr = 0;
  const recoveryCodeSet = new Set(recoveryCoupons.map((c) => c.code.toUpperCase()));
  for (const o of allOrders) {
    const st = String(o.orderStatus || '').toUpperCase();
    const pst = String(o.paymentStatus || '').toUpperCase();
    if (st === 'CANCELLED' || pst === 'FAILED') continue;
    if (o.couponCode && recoveryCodeSet.has(o.couponCode.toUpperCase())) {
      totalRedeemedInr += Number(o.discount) || 0;
    }
  }

  return {
    totalIssuedCount: recoveryCoupons.length,
    totalIssuedPotentialInr,
    totalRedeemedInr
  };
}

export async function evaluateSmartCouponEligibility(params: {
  cartId: string;
  customerEmail?: string | null;
  customerId?: string | null;
  items: any[];
  cartValue: number;
  policyOverride?: Partial<SmartCouponPolicyConfig>;
}): Promise<{
  eligible: boolean;
  reason: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
  calculatedDiscountInr: number;
  eligibleSubtotalInr: number;
  estimatedCogsInr: number;
  projectedMarginPercent: number;
  budgetRemainingInr: number;
}> {
  const engineCfg = await getAbandonedCartEngineConfig();
  const policy: SmartCouponPolicyConfig = {
    ...engineCfg.smartCouponPolicy,
    ...(params.policyOverride || {})
  };

  const items = Array.isArray(params.items) ? params.items : [];
  const excludedSlugs = new Set((policy.excludedProductSlugs || []).map((s) => s.toLowerCase()));

  // 1. Calculate eligible subtotal excluding excluded products (e.g., discovery-six)
  let eligibleSubtotalInr = 0;
  let totalCartSubtotalInr = 0;
  for (const item of items) {
    const lineTotal = (Number(item.sellingPrice) || Number(item.price) || 0) * (Number(item.quantity) || 1);
    totalCartSubtotalInr += lineTotal;
    const itemSlug = String(item.slug || '').toLowerCase();
    const itemName = String(item.productName || '').toLowerCase();
    const isExcluded =
      excludedSlugs.has(itemSlug) ||
      (excludedSlugs.has('discovery-six') && itemName.includes('discovery'));
    if (!isExcluded) {
      eligibleSubtotalInr += lineTotal;
    }
  }

  if (totalCartSubtotalInr === 0 && params.cartValue > 0) {
    totalCartSubtotalInr = params.cartValue;
    eligibleSubtotalInr = params.cartValue;
  }

  const budgetUsage = await getCampaignDiscountBudgetUsage();
  const committedBudget = Math.max(budgetUsage.totalRedeemedInr, Math.round(budgetUsage.totalIssuedPotentialInr * 0.5));
  const budgetRemainingInr = Math.max(0, policy.campaignBudgetLimitInr - committedBudget);

  if (!policy.enabled) {
    return {
      eligible: false,
      reason: 'Smart Coupon Engine is disabled in recovery policy',
      discountType: policy.discountType,
      discountValue: policy.discountValue,
      calculatedDiscountInr: 0,
      eligibleSubtotalInr,
      estimatedCogsInr: 0,
      projectedMarginPercent: 0,
      budgetRemainingInr
    };
  }

  if (eligibleSubtotalInr <= 0) {
    return {
      eligible: false,
      reason: `All items in cart belong to excluded products (${policy.excludedProductSlugs.join(', ')})`,
      discountType: policy.discountType,
      discountValue: policy.discountValue,
      calculatedDiscountInr: 0,
      eligibleSubtotalInr: 0,
      estimatedCogsInr: 0,
      projectedMarginPercent: 0,
      budgetRemainingInr
    };
  }

  if (eligibleSubtotalInr < policy.minCartValueInr) {
    return {
      eligible: false,
      reason: `Eligible cart subtotal ₹${eligibleSubtotalInr} is below minimum threshold ₹${policy.minCartValueInr}`,
      discountType: policy.discountType,
      discountValue: policy.discountValue,
      calculatedDiscountInr: 0,
      eligibleSubtotalInr,
      estimatedCogsInr: Math.round(eligibleSubtotalInr * policy.estimatedCogsRatio),
      projectedMarginPercent: Math.round((1 - policy.estimatedCogsRatio) * 100),
      budgetRemainingInr
    };
  }

  // 2. Calculate raw discount and apply maxDiscountCapInr
  let calculatedDiscountInr =
    policy.discountType === 'PERCENTAGE'
      ? Math.round((eligibleSubtotalInr * policy.discountValue) / 100)
      : Math.round(policy.discountValue);

  if (policy.maxDiscountCapInr > 0 && calculatedDiscountInr > policy.maxDiscountCapInr) {
    calculatedDiscountInr = policy.maxDiscountCapInr;
  }

  // 3. Check Margin Protection
  const estimatedCogsInr = Math.round(totalCartSubtotalInr * policy.estimatedCogsRatio);
  const netRevenueAfterDiscount = totalCartSubtotalInr - calculatedDiscountInr;
  const projectedGrossProfit = netRevenueAfterDiscount - estimatedCogsInr;
  const projectedMarginPercent =
    totalCartSubtotalInr > 0 ? Math.round((projectedGrossProfit / totalCartSubtotalInr) * 100) : 0;

  if (projectedMarginPercent < policy.minGrossMarginPercent) {
    return {
      eligible: false,
      reason: `Margin protection triggered: Projected margin ${projectedMarginPercent}% is below ${policy.minGrossMarginPercent}% floor`,
      discountType: policy.discountType,
      discountValue: policy.discountValue,
      calculatedDiscountInr,
      eligibleSubtotalInr,
      estimatedCogsInr,
      projectedMarginPercent,
      budgetRemainingInr
    };
  }

  // 4. Check Campaign Budget Limit
  if (calculatedDiscountInr > budgetRemainingInr) {
    return {
      eligible: false,
      reason: `Campaign budget limit reached: Remaining budget ₹${budgetRemainingInr} < required discount ₹${calculatedDiscountInr}`,
      discountType: policy.discountType,
      discountValue: policy.discountValue,
      calculatedDiscountInr,
      eligibleSubtotalInr,
      estimatedCogsInr,
      projectedMarginPercent,
      budgetRemainingInr
    };
  }

  return {
    eligible: true,
    reason: `Eligible for ${
      policy.discountType === 'PERCENTAGE' ? `${policy.discountValue}%` : `₹${policy.discountValue}`
    } recovery voucher (Est. discount ₹${calculatedDiscountInr}, Margin ${projectedMarginPercent}%)`,
    discountType: policy.discountType,
    discountValue: policy.discountValue,
    calculatedDiscountInr,
    eligibleSubtotalInr,
    estimatedCogsInr,
    projectedMarginPercent,
    budgetRemainingInr
  };
}

export async function issueSmartRecoveryCoupon(params: {
  cartId: string;
  customerEmail?: string | null;
  customerId?: string | null;
  items: any[];
  cartValue: number;
  policyOverride?: Partial<SmartCouponPolicyConfig>;
}): Promise<{
  issued: boolean;
  couponCode: string | null;
  expiresAt: string | null;
  evaluation: Awaited<ReturnType<typeof evaluateSmartCouponEligibility>>;
}> {
  const evaluation = await evaluateSmartCouponEligibility(params);
  if (!evaluation.eligible) {
    return {
      issued: false,
      couponCode: null,
      expiresAt: null,
      evaluation
    };
  }

  const engineCfg = await getAbandonedCartEngineConfig();
  const policy: SmartCouponPolicyConfig = {
    ...engineCfg.smartCouponPolicy,
    ...(params.policyOverride || {})
  };

  // Check if this cart already has an active unexpired smart coupon
  const existingCartRows = await db
    .select()
    .from(abandonedCarts)
    .where(eq(abandonedCarts.id, params.cartId))
    .limit(1);
  const existingCart = existingCartRows[0];
  if (existingCart?.couponCode) {
    const existingCpnRows = await db
      .select()
      .from(coupons)
      .where(eq(coupons.code, existingCart.couponCode))
      .limit(1);
    const existingCpn = existingCpnRows[0];
    if (existingCpn && existingCpn.isActive && (existingCpn.usageCount || 0) < (existingCpn.usageLimit || 1)) {
      const expTime = existingCpn.expiryDate ? new Date(existingCpn.expiryDate).getTime() : Infinity;
      if (expTime > Date.now()) {
        return {
          issued: true,
          couponCode: existingCpn.code,
          expiresAt: existingCpn.expiryDate,
          evaluation
        };
      }
    }
  }

  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  const code = `RECOV_${suffix}`;
  const expiresAt = new Date(Date.now() + policy.expiryHours * 3600 * 1000).toISOString();

  const metaDescription = JSON.stringify({
    type: 'SMART_RECOVERY_COUPON',
    assignedCartId: params.cartId,
    assignedCustomerEmail: (params.customerEmail || '').trim().toLowerCase() || null,
    assignedCustomerId: params.customerId || null,
    excludedProductSlugs: policy.excludedProductSlugs,
    maxDiscountCapInr: policy.maxDiscountCapInr,
    minGrossMarginPercent: policy.minGrossMarginPercent,
    expiresAt
  });

  await db.insert(coupons).values({
    code,
    discountType: policy.discountType,
    value: policy.discountValue,
    minOrderValue: policy.minCartValueInr,
    maxDiscount: policy.maxDiscountCapInr,
    expiryDate: expiresAt,
    usageLimit: policy.singleUse ? 1 : 10,
    usageCount: 0,
    isActive: true,
    description: metaDescription
  });

  return {
    issued: true,
    couponCode: code,
    expiresAt,
    evaluation
  };
}

export async function validateRecoveryCouponAtCheckout(params: {
  code: string;
  customerEmail?: string | null;
  cartId?: string | null;
  cartValue: number;
  items?: any[];
}): Promise<{
  valid: boolean;
  reason: string;
  errorCode?:
    | 'NOT_FOUND'
    | 'INACTIVE'
    | 'COUPON_EXPIRED'
    | 'USAGE_LIMIT_REACHED'
    | 'MIN_CART_VALUE_NOT_MET'
    | 'COUPON_CUSTOMER_MISMATCH'
    | 'EXCLUDED_PRODUCTS_ONLY';
  discountAmountInr: number;
  coupon?: any;
}> {
  const cleanCode = String(params.code || '').trim().toUpperCase();
  if (!cleanCode) {
    return { valid: false, reason: 'Coupon code is required', errorCode: 'NOT_FOUND', discountAmountInr: 0 };
  }

  const rows = await db.select().from(coupons).where(eq(coupons.code, cleanCode)).limit(1);
  const cpn = rows[0];
  if (!cpn) {
    return { valid: false, reason: 'Invalid coupon code', errorCode: 'NOT_FOUND', discountAmountInr: 0 };
  }

  if (!cpn.isActive) {
    return { valid: false, reason: 'This voucher has been deactivated', errorCode: 'INACTIVE', discountAmountInr: 0 };
  }

  // 1. Check Expiration
  if (cpn.expiryDate) {
    const expMs = new Date(cpn.expiryDate).getTime();
    if (!Number.isNaN(expMs) && Date.now() > expMs) {
      return {
        valid: false,
        reason: `Coupon "${cleanCode}" expired on ${new Date(cpn.expiryDate).toISOString()}`,
        errorCode: 'COUPON_EXPIRED',
        discountAmountInr: 0
      };
    }
  }

  // 2. Check Single-Use / Usage Limit
  if (cpn.usageLimit && (cpn.usageCount || 0) >= cpn.usageLimit) {
    return {
      valid: false,
      reason: `Coupon "${cleanCode}" has already been redeemed (single-use limit reached)`,
      errorCode: 'USAGE_LIMIT_REACHED',
      discountAmountInr: 0
    };
  }

  // 3. Parse Smart Coupon metadata if present
  let meta: any = null;
  try {
    if (cpn.description && cpn.description.startsWith('{')) {
      meta = JSON.parse(cpn.description);
    }
  } catch {}

  // 4. Customer-specific assignment check
  if (meta?.assignedCustomerEmail && params.customerEmail) {
    if (meta.assignedCustomerEmail.toLowerCase() !== params.customerEmail.trim().toLowerCase()) {
      return {
        valid: false,
        reason: `Coupon "${cleanCode}" is assigned exclusively to another customer account`,
        errorCode: 'COUPON_CUSTOMER_MISMATCH',
        discountAmountInr: 0
      };
    }
  }

  // 5. Product exclusions check
  const excludedSlugs = new Set<string>(
    Array.isArray(meta?.excludedProductSlugs)
      ? meta.excludedProductSlugs.map((s: string) => s.toLowerCase())
      : []
  );

  let eligibleSubtotal = Number(params.cartValue) || 0;
  if (Array.isArray(params.items) && params.items.length > 0 && excludedSlugs.size > 0) {
    eligibleSubtotal = 0;
    for (const item of params.items) {
      const lineVal = (Number(item.sellingPrice) || Number(item.price) || 0) * (Number(item.quantity) || 1);
      const slug = String(item.slug || '').toLowerCase();
      const name = String(item.productName || '').toLowerCase();
      const isExcluded =
        excludedSlugs.has(slug) || (excludedSlugs.has('discovery-six') && name.includes('discovery'));
      if (!isExcluded) {
        eligibleSubtotal += lineVal;
      }
    }
    if (eligibleSubtotal <= 0) {
      return {
        valid: false,
        reason: 'Cart contains only excluded products not eligible for this recovery voucher',
        errorCode: 'EXCLUDED_PRODUCTS_ONLY',
        discountAmountInr: 0
      };
    }
  }

  // 6. Minimum cart value check
  const minVal = Number(cpn.minOrderValue) || 0;
  if (eligibleSubtotal < minVal) {
    return {
      valid: false,
      reason: `Minimum eligible cart value of ₹${minVal} required (current eligible: ₹${eligibleSubtotal})`,
      errorCode: 'MIN_CART_VALUE_NOT_MET',
      discountAmountInr: 0
    };
  }

  let discountAmountInr =
    String(cpn.discountType).toUpperCase() === 'PERCENTAGE'
      ? Math.round((eligibleSubtotal * Number(cpn.value)) / 100)
      : Math.round(Number(cpn.value));

  const maxCap = Number(cpn.maxDiscount) || Number(meta?.maxDiscountCapInr) || 0;
  if (maxCap > 0 && discountAmountInr > maxCap) {
    discountAmountInr = maxCap;
  }

  return {
    valid: true,
    reason: 'Valid recovery voucher',
    discountAmountInr,
    coupon: cpn
  };
}

// ============================================================================
// CART TRACKING, CROSS-DEVICE MERGE & ABANDONMENT RULE EVALUATION
// ============================================================================

export function buildDefaultSequenceSteps(lastActivityDate: Date): RecoveryStepRecord[] {
  const baseMs = lastActivityDate.getTime();
  return [
    {
      stepId: 'T_PLUS_30M',
      label: 'T+30m First Concierge Reminder',
      delayMinutes: 30,
      scheduledAt: new Date(baseMs + 30 * 60 * 1000).toISOString(),
      status: 'SCHEDULED'
    },
    {
      stepId: 'T_PLUS_6H',
      label: 'T+6h Second Channel Reminder',
      delayMinutes: 360,
      scheduledAt: new Date(baseMs + 360 * 60 * 1000).toISOString(),
      status: 'SCHEDULED'
    },
    {
      stepId: 'T_PLUS_24H',
      label: 'T+24h Smart Coupon Evaluation & Reminder',
      delayMinutes: 1440,
      scheduledAt: new Date(baseMs + 1440 * 60 * 1000).toISOString(),
      status: 'SCHEDULED'
    },
    {
      stepId: 'T_PLUS_48H',
      label: 'T+48h Final Private Bag Reminder',
      delayMinutes: 2880,
      scheduledAt: new Date(baseMs + 2880 * 60 * 1000).toISOString(),
      status: 'SCHEDULED'
    }
  ];
}

// In-memory + DB idempotency guard for cart event deduplication
const processedEventKeys = new Set<string>();

export async function trackOrSyncCartSession(payload: {
  id?: string;
  anonymousCartId?: string;
  customerId?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerName?: string | null;
  items?: any[];
  cartValue?: number;
  couponCode?: string | null;
  checkoutStarted?: boolean;
  checkoutActive?: boolean;
  paymentAttempted?: boolean;
  paymentResult?: 'NONE' | 'PENDING' | 'SUCCEEDED' | 'FAILED';
  customerConsent?: {
    emailOptIn?: boolean;
    whatsappOptIn?: boolean;
    smsOptIn?: boolean;
    unsubscribed?: boolean;
  };
  attribution?: Record<string, any>;
  lastActivityOverride?: string | Date;
  workflowSuppressed?: boolean;
  status?: string;
  idempotencyKey?: string;
}): Promise<{
  cart: any;
  deduplicated: boolean;
  mergedFromAnonymousCartId?: string | null;
}> {
  // 1. Idempotency check (if same event arrives twice)
  if (payload.idempotencyKey) {
    if (processedEventKeys.has(payload.idempotencyKey)) {
      const all = await db.select().from(abandonedCarts);
      const existingMatch = all.find(
        (c) =>
          c.id === payload.id ||
          (c.recoveryMetadata as any)?.lastIdempotencyKey === payload.idempotencyKey
      );
      if (existingMatch) {
        return { cart: existingMatch, deduplicated: true };
      }
    }
    const existingEv = await db
      .select()
      .from(automationEvents)
      .where(eq(automationEvents.idempotencyKey, payload.idempotencyKey))
      .limit(1);
    if (existingEv.length > 0) {
      const all = await db.select().from(abandonedCarts);
      const existingMatch = all.find(
        (c) =>
          c.id === payload.id ||
          (c.recoveryMetadata as any)?.lastIdempotencyKey === payload.idempotencyKey
      );
      if (existingMatch) {
        return { cart: existingMatch, deduplicated: true };
      }
    }
    processedEventKeys.add(payload.idempotencyKey);
  }

  const allCarts = await db.select().from(abandonedCarts);

  // Never fabricate missing email, phone, or name for anonymous carts!
  const cleanEmail = payload.customerEmail ? String(payload.customerEmail).trim().toLowerCase() : '';
  const cleanPhone = payload.customerPhone ? String(payload.customerPhone).trim() : '';
  const cleanName = payload.customerName ? String(payload.customerName).trim() : null;
  const anonId = payload.anonymousCartId || payload.id || `anon-${Date.now()}`;
  const custId = payload.customerId ? String(payload.customerId).trim() : null;

  // Cross-device & anonymous-to-authenticated cart matching
  let existingCart = allCarts.find((c) => {
    const meta = (c.recoveryMetadata || {}) as Record<string, any>;
    if (payload.id && c.id === payload.id) return true;
    if (payload.anonymousCartId && (c.id === payload.anonymousCartId || meta.anonymousCartId === payload.anonymousCartId)) {
      return true;
    }
    // If customer switches devices and logs in, match their active/abandoned unrecovered cart by customerId or email
    if (
      c.status !== 'RECOVERED' &&
      c.status !== 'ORGANIC_COMPLETED' &&
      c.status !== 'DELETED'
    ) {
      if (custId && meta.customerId === custId) return true;
      if (cleanEmail && c.customerEmail && c.customerEmail.trim().toLowerCase() === cleanEmail) return true;
    }
    return false;
  });

  // Also check if there is BOTH an anonymous cart AND an older customer cart when switching devices
  let mergedFromAnonymousCartId: string | null = null;
  if (payload.anonymousCartId && (cleanEmail || custId)) {
    const anonCart = allCarts.find(
      (c) =>
        c.id === payload.anonymousCartId ||
        (c.recoveryMetadata as any)?.anonymousCartId === payload.anonymousCartId
    );
    const authCart = allCarts.find(
      (c) =>
        c.id !== anonCart?.id &&
        c.status !== 'RECOVERED' &&
        c.status !== 'DELETED' &&
        ((cleanEmail && c.customerEmail.toLowerCase() === cleanEmail) ||
          (custId && (c.recoveryMetadata as any)?.customerId === custId))
    );

    if (anonCart && authCart) {
      // Merge anonymous cart into the authenticated cart and mark duplicate anonymous cart as MERGED_DELETED
      mergedFromAnonymousCartId = anonCart.id;
      await db
        .update(abandonedCarts)
        .set({
          status: 'DELETED',
          recoveryMetadata: {
            ...((anonCart.recoveryMetadata as any) || {}),
            isDeleted: true,
            mergedIntoCartId: authCart.id,
            mergedAt: new Date().toISOString()
          }
        })
        .where(eq(abandonedCarts.id, anonCart.id));
      existingCart = authCart;
    }
  }

  const prevMeta = ((existingCart?.recoveryMetadata as any) || {}) as Record<string, any>;
  const nowDate = payload.lastActivityOverride ? new Date(payload.lastActivityOverride) : new Date();
  const nowIso = nowDate.toISOString();

  const resolvedEmail = cleanEmail || (existingCart?.customerEmail ? existingCart.customerEmail.trim() : '');
  const resolvedPhone = cleanPhone || (existingCart?.customerPhone ? existingCart.customerPhone.trim() : '');
  const resolvedName = cleanName || existingCart?.customerName || null;
  const resolvedCustomerId = custId || prevMeta.customerId || null;
  const resolvedAnonId = payload.anonymousCartId || prevMeta.anonymousCartId || existingCart?.id || anonId;

  // Lookup customer consent from customers CRM if customer is known
  let dbCustomerConsent: Record<string, any> = {};
  if (resolvedEmail || resolvedCustomerId) {
    const allCusts = await db.select().from(customers);
    const matchedCust = allCusts.find(
      (c) =>
        (resolvedCustomerId && c.id === resolvedCustomerId) ||
        (resolvedEmail && c.email.toLowerCase() === resolvedEmail.toLowerCase())
    );
    if (matchedCust?.crmMetadata && typeof matchedCust.crmMetadata === 'object') {
      dbCustomerConsent = (matchedCust.crmMetadata as any).consent || {};
    }
  }

  const prevConsent = prevMeta.customerConsent || {};
  const incomingConsent = payload.customerConsent || {};
  const unsubscribed =
    incomingConsent.unsubscribed !== undefined
      ? Boolean(incomingConsent.unsubscribed)
      : dbCustomerConsent.unsubscribed !== undefined
      ? Boolean(dbCustomerConsent.unsubscribed)
      : Boolean(prevConsent.unsubscribed);

  const customerConsent = {
    emailOptIn: unsubscribed
      ? false
      : incomingConsent.emailOptIn ?? dbCustomerConsent.emailPromotional ?? prevConsent.emailOptIn ?? true,
    whatsappOptIn: unsubscribed
      ? false
      : incomingConsent.whatsappOptIn ?? dbCustomerConsent.whatsappPromotional ?? prevConsent.whatsappOptIn ?? true,
    smsOptIn: unsubscribed
      ? false
      : incomingConsent.smsOptIn ?? dbCustomerConsent.smsPromotional ?? prevConsent.smsOptIn ?? false,
    unsubscribed,
    updatedAt: nowIso
  };

  // Strict rule: An anonymous cart must NOT be assumed to have a known contact identity
  const hasValidEmail = Boolean(resolvedEmail && resolvedEmail.includes('@'));
  const hasValidPhone = Boolean(resolvedPhone && resolvedPhone.replace(/\D/g, '').length >= 10);
  const isContactable =
    !unsubscribed &&
    ((hasValidEmail && customerConsent.emailOptIn) || (hasValidPhone && customerConsent.whatsappOptIn));

  const itemsList = Array.isArray(payload.items)
    ? payload.items
    : Array.isArray(existingCart?.items)
    ? (existingCart.items as any[])
    : [];

  const totalQuantity = itemsList.reduce((sum, i) => sum + (Number(i.quantity) || 1), 0);
  const computedCartValue =
    payload.cartValue !== undefined
      ? Number(payload.cartValue)
      : itemsList.length > 0
      ? itemsList.reduce(
          (sum, i) => sum + (Number(i.sellingPrice) || Number(i.price) || 0) * (Number(i.quantity) || 1),
          0
        )
      : Number(existingCart?.cartValue) || 0;

  const paymentResult =
    payload.paymentResult || prevMeta.paymentResult || 'NONE';

  // Determine sequence steps: if cart value or items changed meaningfully while still active, reset scheduled steps that haven't run
  const prevSteps: RecoveryStepRecord[] = Array.isArray(prevMeta.sequenceSteps)
    ? prevMeta.sequenceSteps
    : buildDefaultSequenceSteps(nowDate);

  const hasDeliveredOrAttemptedSteps = prevSteps.some(
    (s) => s.status === 'DELIVERED' || s.status === 'INTEGRATION_REQUIRED' || s.status === 'FAILED'
  );

  const updatedSteps = !hasDeliveredOrAttemptedSteps
    ? buildDefaultSequenceSteps(nowDate)
    : prevSteps;

  let nextStatus = payload.status || existingCart?.status || 'ACTIVE';
  if (paymentResult === 'SUCCEEDED') {
    nextStatus = hasDeliveredOrAttemptedSteps ? 'RECOVERED' : 'ORGANIC_COMPLETED';
  } else if (paymentResult === 'PENDING') {
    nextStatus = 'PAYMENT_PENDING';
  } else if (unsubscribed || payload.workflowSuppressed) {
    nextStatus = 'SUPPRESSED';
  }

  const nextMetadata = {
    ...prevMeta,
    anonymousCartId: resolvedAnonId,
    customerId: resolvedCustomerId,
    identityState: hasValidEmail || hasValidPhone ? 'IDENTIFIED' : 'ANONYMOUS',
    contactable: isContactable,
    totalQuantity,
    cartCreatedAt: prevMeta.cartCreatedAt || existingCart?.createdAt?.toISOString() || nowIso,
    lastMeaningfulActivityAt: nowIso,
    checkoutStartedAt: payload.checkoutStarted
      ? nowIso
      : prevMeta.checkoutStartedAt || null,
    checkoutActive:
      payload.checkoutActive !== undefined
        ? Boolean(payload.checkoutActive)
        : Boolean(payload.checkoutStarted && paymentResult !== 'FAILED'),
    paymentAttemptedAt: payload.paymentAttempted
      ? nowIso
      : prevMeta.paymentAttemptedAt || null,
    paymentResult,
    customerConsent,
    workflowSuppressed: Boolean(payload.workflowSuppressed || unsubscribed),
    sequenceSteps: updatedSteps,
    mergedFromAnonymousCartId: mergedFromAnonymousCartId || prevMeta.mergedFromAnonymousCartId || null,
    lastIdempotencyKey: payload.idempotencyKey || prevMeta.lastIdempotencyKey || null
  };

  const targetId = existingCart?.id || payload.id || resolvedAnonId;

  if (existingCart) {
    const [updated] = await db
      .update(abandonedCarts)
      .set({
        customerEmail: resolvedEmail,
        customerPhone: resolvedPhone,
        customerName: resolvedName,
        items: itemsList,
        cartValue: computedCartValue,
        couponCode: payload.couponCode !== undefined ? payload.couponCode : existingCart.couponCode,
        lastActivity: nowDate,
        status: nextStatus,
        attribution: payload.attribution || existingCart.attribution || { utm_source: 'direct' },
        recoveryMetadata: nextMetadata
      })
      .where(eq(abandonedCarts.id, targetId))
      .returning();

    return {
      cart: updated,
      deduplicated: false,
      mergedFromAnonymousCartId
    };
  } else {
    const [inserted] = await db
      .insert(abandonedCarts)
      .values({
        id: targetId,
        customerEmail: resolvedEmail,
        customerPhone: resolvedPhone,
        customerName: resolvedName,
        items: itemsList,
        cartValue: computedCartValue,
        couponCode: payload.couponCode || null,
        lastActivity: nowDate,
        status: nextStatus,
        attribution: payload.attribution || { utm_source: 'direct' },
        recoverySentEmail: false,
        recoverySentWhatsApp: false,
        recoverySentSMS: false,
        recoveryMetadata: nextMetadata
      })
      .returning();

    return {
      cart: inserted,
      deduplicated: false,
      mergedFromAnonymousCartId
    };
  }
}

// ============================================================================
// ABANDONMENT RULE EVALUATION
// ============================================================================

export function evaluateCartAbandonmentEligibility(params: {
  cart: any;
  allOrders: any[];
  config: AbandonedCartEngineConfig;
  referenceNowMs?: number;
}): {
  isAbandonedEligible: boolean;
  isContactable: boolean;
  exclusionReason: string | null;
  minutesSinceLastActivity: number;
  linkedValidOrder: any | null;
  attributionType: 'DIRECT_RECOVERY' | 'ASSISTED_RECOVERY' | 'ORGANIC' | 'MANUAL_UNVERIFIED' | null;
} {
  const { cart, allOrders, config, referenceNowMs = Date.now() } = params;
  const meta = ((cart.recoveryMetadata as any) || {}) as Record<string, any>;
  const lastActMs = cart.lastActivity ? new Date(cart.lastActivity).getTime() : referenceNowMs;
  const minutesSinceLastActivity = Math.max(0, Math.floor((referenceNowMs - lastActMs) / 60000));

  const cleanEmail = (cart.customerEmail || '').trim().toLowerCase();
  const cleanPhone = (cart.customerPhone || '').replace(/\D/g, '');
  const consent = meta.customerConsent || {};
  const isUnsubscribed = Boolean(consent.unsubscribed);
  const isContactable =
    !isUnsubscribed &&
    ((Boolean(cleanEmail && cleanEmail.includes('@')) && consent.emailOptIn !== false) ||
      (cleanPhone.length >= 10 && consent.whatsappOptIn !== false));

  // Find if there is a real valid paid/confirmed order linked to this cart
  const cartCreatedMs = cart.createdAt ? new Date(cart.createdAt).getTime() : 0;
  const linkedValidOrder = allOrders.find((ord) => {
    const ordStatus = String(ord.orderStatus || '').toUpperCase();
    const payStatus = String(ord.paymentStatus || '').toUpperCase();
    if (ordStatus === 'CANCELLED' || payStatus === 'FAILED') return false;

    const ordAttr = (ord.attribution || {}) as Record<string, any>;
    if (ordAttr.cartId === cart.id || ordAttr.anonymousCartId === meta.anonymousCartId || meta.recoveredOrderId === ord.id) {
      return true;
    }
    if (cart.couponCode && ord.couponCode && String(ord.couponCode).toUpperCase() === String(cart.couponCode).toUpperCase()) {
      return true;
    }
    const ordCreatedMs = ord.createdAt ? new Date(ord.createdAt).getTime() : Date.now();
    if (ordCreatedMs >= cartCreatedMs - 60000) {
      if (cleanEmail && (ord.customerEmail || '').trim().toLowerCase() === cleanEmail) return true;
      if (cleanPhone.length >= 10 && (ord.customerPhone || '').replace(/\D/g, '').endsWith(cleanPhone.slice(-10))) {
        return true;
      }
    }
    return false;
  });

  const steps: RecoveryStepRecord[] = Array.isArray(meta.sequenceSteps) ? meta.sequenceSteps : [];
  const hadRecoveryTouchpoint =
    Boolean(cart.recoverySentEmail || cart.recoverySentWhatsApp || cart.recoverySentSMS) ||
    steps.some((s) => s.status === 'DELIVERED' || s.status === 'INTEGRATION_REQUIRED');

  if (linkedValidOrder) {
    // Determine Direct vs Assisted vs Organic
    const ordAttr = (linkedValidOrder.attribution || {}) as Record<string, any>;
    const usedRecoveryCoupon = Boolean(
      cart.couponCode &&
        linkedValidOrder.couponCode &&
        String(linkedValidOrder.couponCode).toUpperCase() === String(cart.couponCode).toUpperCase()
    );
    const clickedRecoveryLink = Boolean(ordAttr.recoveryClick || ordAttr.recoveredCartId === cart.id);

    let attributionType: 'DIRECT_RECOVERY' | 'ASSISTED_RECOVERY' | 'ORGANIC' = 'ORGANIC';
    if (hadRecoveryTouchpoint) {
      attributionType = usedRecoveryCoupon || clickedRecoveryLink ? 'DIRECT_RECOVERY' : 'ASSISTED_RECOVERY';
    }

    return {
      isAbandonedEligible: false,
      isContactable,
      exclusionReason: 'Customer completed a valid order',
      minutesSinceLastActivity,
      linkedValidOrder,
      attributionType
    };
  }

  // Rule 5: Cart has been deleted
  if (cart.status === 'DELETED' || meta.isDeleted) {
    return {
      isAbandonedEligible: false,
      isContactable,
      exclusionReason: 'Cart has been deleted',
      minutesSinceLastActivity,
      linkedValidOrder: null,
      attributionType: null
    };
  }

  // Rule 4: Cart has already been recovered (including manual mark without a linked order)
  if (cart.status === 'RECOVERED' || cart.status === 'MANUALLY_RECOVERED' || cart.status === 'ORGANIC_COMPLETED') {
    return {
      isAbandonedEligible: false,
      isContactable,
      exclusionReason: 'Cart has already been recovered',
      minutesSinceLastActivity,
      linkedValidOrder: null,
      attributionType: cart.status === 'ORGANIC_COMPLETED' ? 'ORGANIC' : 'MANUAL_UNVERIFIED'
    };
  }

  // Rule 6: Workflow has been suppressed
  if (cart.status === 'SUPPRESSED' || meta.workflowSuppressed || isUnsubscribed) {
    return {
      isAbandonedEligible: false,
      isContactable,
      exclusionReason: 'Recovery workflow has been suppressed (unsubscribed or admin suppressed)',
      minutesSinceLastActivity,
      linkedValidOrder: null,
      attributionType: null
    };
  }

  // Rule 3: Payment confirmation is pending
  if (cart.status === 'PAYMENT_PENDING' || meta.paymentResult === 'PENDING') {
    return {
      isAbandonedEligible: false,
      isContactable,
      exclusionReason: 'Payment confirmation is pending',
      minutesSinceLastActivity,
      linkedValidOrder: null,
      attributionType: null
    };
  }

  // Rule 2: Checkout is still active OR within the configurable 30-minute activity window
  const thresholdMins = config.abandonmentThresholdMinutes || 30;
  // Historical seeded carts with status === 'ABANDONED' and older timestamps remain eligible
  const isExplicitlyAbandoned =
    cart.status === 'ABANDONED' && minutesSinceLastActivity >= thresholdMins;

  if (!isExplicitlyAbandoned && minutesSinceLastActivity < thresholdMins) {
    return {
      isAbandonedEligible: false,
      isContactable,
      exclusionReason: meta.checkoutActive
        ? `Checkout is still active (${minutesSinceLastActivity}m < ${thresholdMins}m threshold)`
        : `Active cart session (${minutesSinceLastActivity}m < ${thresholdMins}m abandonment threshold)`,
      minutesSinceLastActivity,
      linkedValidOrder: null,
      attributionType: null
    };
  }

  if (Number(cart.cartValue) <= 0 || !Array.isArray(cart.items) || cart.items.length === 0) {
    return {
      isAbandonedEligible: false,
      isContactable,
      exclusionReason: 'Cart is empty',
      minutesSinceLastActivity,
      linkedValidOrder: null,
      attributionType: null
    };
  }

  return {
    isAbandonedEligible: true,
    isContactable,
    exclusionReason: null,
    minutesSinceLastActivity,
    linkedValidOrder: null,
    attributionType: null
  };
}

// ============================================================================
// CANCEL PENDING REMINDERS (ON ORDER COMPLETION, LATE WEBHOOK, OR UNSUBSCRIBE)
// ============================================================================

export async function cancelPendingRecoveryForCart(params: {
  cartId?: string;
  anonymousCartId?: string;
  customerEmail?: string;
  customerPhone?: string;
  orderId?: string;
  reason: 'ORDER_COMPLETED' | 'LATE_PAYMENT_WEBHOOK' | 'CUSTOMER_UNSUBSCRIBED' | 'CART_DELETED' | 'MANUAL_SUPPRESS';
}): Promise<{
  cancelledCartIds: string[];
  cancelledStepCount: number;
}> {
  const allCarts = await db.select().from(abandonedCarts);
  const cleanEmail = (params.customerEmail || '').trim().toLowerCase();
  const cleanPhone = (params.customerPhone || '').replace(/\D/g, '');

  const matchingCarts = allCarts.filter((c) => {
    const meta = (c.recoveryMetadata || {}) as Record<string, any>;
    if (params.cartId && c.id === params.cartId) return true;
    if (params.anonymousCartId && (c.id === params.anonymousCartId || meta.anonymousCartId === params.anonymousCartId)) {
      return true;
    }
    if (cleanEmail && c.customerEmail && c.customerEmail.trim().toLowerCase() === cleanEmail) return true;
    if (
      cleanPhone.length >= 10 &&
      c.customerPhone &&
      c.customerPhone.replace(/\D/g, '').endsWith(cleanPhone.slice(-10))
    ) {
      return true;
    }
    return false;
  });

  const cancelledCartIds: string[] = [];
  let cancelledStepCount = 0;

  for (const cart of matchingCarts) {
    const meta = ((cart.recoveryMetadata as any) || {}) as Record<string, any>;
    const prevSteps: RecoveryStepRecord[] = Array.isArray(meta.sequenceSteps)
      ? meta.sequenceSteps
      : buildDefaultSequenceSteps(cart.lastActivity ? new Date(cart.lastActivity) : new Date());

    const hadPriorTouchpoint =
      Boolean(cart.recoverySentEmail || cart.recoverySentWhatsApp || cart.recoverySentSMS) ||
      prevSteps.some((s) => s.status === 'DELIVERED' || s.status === 'INTEGRATION_REQUIRED');

    const updatedSteps = prevSteps.map((step) => {
      if (step.status === 'SCHEDULED' || step.status === 'QUEUED') {
        cancelledStepCount++;
        return {
          ...step,
          status:
            params.reason === 'CUSTOMER_UNSUBSCRIBED'
              ? ('CANCELLED_UNSUBSCRIBED' as const)
              : ('CANCELLED_ORDER_COMPLETED' as const),
          executedAt: new Date().toISOString(),
          error: `Cancelled automatically: ${params.reason}`
        };
      }
      return step;
    });

    let nextStatus = cart.status;
    if (params.reason === 'ORDER_COMPLETED' || params.reason === 'LATE_PAYMENT_WEBHOOK') {
      nextStatus = hadPriorTouchpoint ? 'RECOVERED' : 'ORGANIC_COMPLETED';
    } else if (params.reason === 'CUSTOMER_UNSUBSCRIBED' || params.reason === 'MANUAL_SUPPRESS') {
      nextStatus = 'SUPPRESSED';
    } else if (params.reason === 'CART_DELETED') {
      nextStatus = 'DELETED';
    }

    await db
      .update(abandonedCarts)
      .set({
        status: nextStatus,
        recoveredAt:
          nextStatus === 'RECOVERED' || nextStatus === 'ORGANIC_COMPLETED' ? new Date() : cart.recoveredAt,
        recoveryMetadata: {
          ...meta,
          paymentResult:
            params.reason === 'ORDER_COMPLETED' || params.reason === 'LATE_PAYMENT_WEBHOOK'
              ? 'SUCCEEDED'
              : meta.paymentResult,
          checkoutActive: false,
          recoveredOrderId: params.orderId || meta.recoveredOrderId || null,
          recoveryAttributionType:
            nextStatus === 'RECOVERED'
              ? 'DIRECT_OR_ASSISTED'
              : nextStatus === 'ORGANIC_COMPLETED'
              ? 'ORGANIC'
              : meta.recoveryAttributionType || null,
          workflowSuppressed:
            params.reason === 'CUSTOMER_UNSUBSCRIBED' || params.reason === 'MANUAL_SUPPRESS'
              ? true
              : meta.workflowSuppressed,
          customerConsent:
            params.reason === 'CUSTOMER_UNSUBSCRIBED'
              ? {
                  ...(meta.customerConsent || {}),
                  unsubscribed: true,
                  emailOptIn: false,
                  whatsappOptIn: false,
                  smsOptIn: false,
                  updatedAt: new Date().toISOString()
                }
              : meta.customerConsent,
          sequenceSteps: updatedSteps,
          cancelledReason: params.reason,
          cancelledAt: new Date().toISOString()
        }
      })
      .where(eq(abandonedCarts.id, cart.id));

    cancelledCartIds.push(cart.id);
  }

  // Also cancel any pending automation_jobs for this customer's cart recovery
  if (cleanEmail) {
    const pendingJobs = await db
      .select()
      .from(automationJobs)
      .where(eq(automationJobs.customerEmail, cleanEmail));
    for (const jb of pendingJobs) {
      if (
        (jb.status === 'QUEUED' || jb.status === 'DELAYED') &&
        (jb.eventType === 'cart.abandoned' || jb.workflowId.includes('cart'))
      ) {
        await db
          .update(automationJobs)
          .set({
            status: 'CANCELLED',
            lastError: `Cancelled immediately: ${params.reason}`,
            updatedAt: new Date()
          })
          .where(eq(automationJobs.id, jb.id));
      }
    }
  }

  return { cancelledCartIds, cancelledStepCount };
}

// ============================================================================
// RECOVERY SEQUENCE STEP EXECUTOR (T+30M, T+6H, T+24H, T+48H)
// ============================================================================

export async function executeCartRecoveryStep(params: {
  cartId: string;
  stepId: RecoveryStepId;
  forceElapsed?: boolean;
  preferredChannel?: 'WHATSAPP' | 'EMAIL';
  simulateProviderState?: 'CONNECTED_SUCCESS' | 'PROVIDER_FAILURE' | 'DEFAULT';
}): Promise<{
  executed: boolean;
  stepRecord: RecoveryStepRecord;
  cart: any;
  couponIssued?: string | null;
}> {
  const { cartId, stepId, forceElapsed = false, preferredChannel, simulateProviderState = 'DEFAULT' } = params;

  const [cart] = await db.select().from(abandonedCarts).where(eq(abandonedCarts.id, cartId)).limit(1);
  if (!cart) {
    throw new Error(`Abandoned cart ${cartId} not found`);
  }

  const config = await getAbandonedCartEngineConfig();
  const allOrders = await db.select().from(orders);
  const meta = ((cart.recoveryMetadata as any) || {}) as Record<string, any>;
  const steps: RecoveryStepRecord[] = Array.isArray(meta.sequenceSteps)
    ? [...meta.sequenceSteps]
    : buildDefaultSequenceSteps(cart.lastActivity ? new Date(cart.lastActivity) : new Date());

  const stepIdx = steps.findIndex((s) => s.stepId === stepId);
  const currentStep: RecoveryStepRecord =
    stepIdx > -1
      ? { ...steps[stepIdx] }
      : {
          stepId,
          label: stepId,
          delayMinutes: stepId === 'T_PLUS_30M' ? 30 : stepId === 'T_PLUS_6H' ? 360 : stepId === 'T_PLUS_24H' ? 1440 : 2880,
          scheduledAt: new Date().toISOString(),
          status: 'SCHEDULED'
        };

  // Idempotency: Do not re-send a step that already delivered
  if (currentStep.status === 'DELIVERED') {
    return {
      executed: false,
      stepRecord: currentStep,
      cart,
      couponIssued: currentStep.couponCodeIssued || null
    };
  }

  // 1. Evaluate Abandonment Eligibility (Order completed? Payment pending? Unsubscribed? Deleted?)
  const simulatedRefMs = forceElapsed
    ? new Date(cart.lastActivity).getTime() + (currentStep.delayMinutes + 5) * 60000
    : Date.now();

  const eligibility = evaluateCartAbandonmentEligibility({
    cart,
    allOrders,
    config,
    referenceNowMs: simulatedRefMs
  });

  if (!eligibility.isAbandonedEligible) {
    if (eligibility.linkedValidOrder) {
      await cancelPendingRecoveryForCart({
        cartId: cart.id,
        orderId: eligibility.linkedValidOrder.id,
        reason: 'ORDER_COMPLETED'
      });
      currentStep.status = 'CANCELLED_ORDER_COMPLETED';
      currentStep.error = eligibility.exclusionReason;
    } else if (meta.customerConsent?.unsubscribed || cart.status === 'SUPPRESSED') {
      currentStep.status = 'CANCELLED_UNSUBSCRIBED';
      currentStep.error = eligibility.exclusionReason;
    } else {
      currentStep.status = 'SUPPRESSED_CONSENT';
      currentStep.error = eligibility.exclusionReason;
    }
    currentStep.executedAt = new Date().toISOString();
    if (stepIdx > -1) steps[stepIdx] = currentStep;
    const [updated] = await db
      .update(abandonedCarts)
      .set({ recoveryMetadata: { ...meta, sequenceSteps: steps } })
      .where(eq(abandonedCarts.id, cart.id))
      .returning();
    return { executed: false, stepRecord: currentStep, cart: updated };
  }

  // 2. Check anonymous / contactability rule
  if (!eligibility.isContactable) {
    currentStep.status = 'SKIPPED_ANONYMOUS_NO_CONTACT';
    currentStep.executedAt = new Date().toISOString();
    currentStep.channel = 'NONE';
    currentStep.error = 'Anonymous cart or no permitted contact channel (email/phone)';
    if (stepIdx > -1) steps[stepIdx] = currentStep;
    const [updated] = await db
      .update(abandonedCarts)
      .set({ recoveryMetadata: { ...meta, sequenceSteps: steps } })
      .where(eq(abandonedCarts.id, cart.id))
      .returning();
    return { executed: false, stepRecord: currentStep, cart: updated };
  }

  // 3. Check product stock availability before sending any recovery reminder
  const stockCheck = await checkCartProductsAvailability(Array.isArray(cart.items) ? cart.items : []);
  if (!stockCheck.available) {
    currentStep.status = 'SUPPRESSED_PRODUCT_UNAVAILABLE';
    currentStep.executedAt = new Date().toISOString();
    currentStep.error = `Product unavailable: ${stockCheck.unavailableItems.join('; ')}`;
    if (stepIdx > -1) steps[stepIdx] = currentStep;
    const [updated] = await db
      .update(abandonedCarts)
      .set({ recoveryMetadata: { ...meta, sequenceSteps: steps } })
      .where(eq(abandonedCarts.id, cart.id))
      .returning();
    return { executed: false, stepRecord: currentStep, cart: updated };
  }

  // 4. Check frequency cap per cart
  const attemptedCount = steps.filter(
    (s) => s.status === 'DELIVERED' || s.status === 'INTEGRATION_REQUIRED'
  ).length;
  if (attemptedCount >= (config.maxMessagesPerCart || 4)) {
    currentStep.status = 'SUPPRESSED_FREQUENCY_CAP';
    currentStep.executedAt = new Date().toISOString();
    currentStep.error = `Frequency cap reached (${config.maxMessagesPerCart} reminders max)`;
    if (stepIdx > -1) steps[stepIdx] = currentStep;
    const [updated] = await db
      .update(abandonedCarts)
      .set({ recoveryMetadata: { ...meta, sequenceSteps: steps } })
      .where(eq(abandonedCarts.id, cart.id))
      .returning();
    return { executed: false, stepRecord: currentStep, cart: updated };
  }

  // 5. At T+24h (or T+48h if coupon already issued), evaluate Smart Coupon Engine
  let couponCodeToSend: string | null = cart.couponCode || null;
  let discountEvaluationReason: string | null = null;

  if (stepId === 'T_PLUS_24H') {
    const couponResult = await issueSmartRecoveryCoupon({
      cartId: cart.id,
      customerEmail: cart.customerEmail,
      customerId: meta.customerId,
      items: Array.isArray(cart.items) ? cart.items : [],
      cartValue: Number(cart.cartValue) || 0
    });
    discountEvaluationReason = couponResult.evaluation.reason;
    if (couponResult.issued && couponResult.couponCode) {
      couponCodeToSend = couponResult.couponCode;
    } else {
      couponCodeToSend = null;
    }
  } else if (stepId === 'T_PLUS_30M' || stepId === 'T_PLUS_6H') {
    // Never automatically provide discounts at T+30m or T+6h!
    couponCodeToSend = null;
    discountEvaluationReason = 'No discount offered in early reminder stage (margin preservation)';
  }

  // 6. Select permitted channel
  const cleanEmail = (cart.customerEmail || '').trim();
  const cleanPhone = (cart.customerPhone || '').trim();
  const consent = meta.customerConsent || {};
  const canWhatsApp = Boolean(cleanPhone.replace(/\D/g, '').length >= 10 && consent.whatsappOptIn !== false);
  const canEmail = Boolean(cleanEmail.includes('@') && consent.emailOptIn !== false);

  let chosenChannel: 'WHATSAPP' | 'EMAIL' = 'EMAIL';
  if (preferredChannel === 'WHATSAPP' && canWhatsApp) {
    chosenChannel = 'WHATSAPP';
  } else if (preferredChannel === 'EMAIL' && canEmail) {
    chosenChannel = 'EMAIL';
  } else if (stepId === 'T_PLUS_30M') {
    chosenChannel = canWhatsApp ? 'WHATSAPP' : 'EMAIL';
  } else if (stepId === 'T_PLUS_6H') {
    chosenChannel = canEmail ? 'EMAIL' : 'WHATSAPP';
  } else {
    chosenChannel = canWhatsApp ? 'WHATSAPP' : 'EMAIL';
  }

  const itemsSummary = (Array.isArray(cart.items) ? cart.items : [])
    .map((i: any) => `${i.productName || 'Flacon'} (${i.size || '100ml'}) × ${i.quantity || 1}`)
    .join(', ');

  // 7. Dispatch through secure communication adapter
  const dispatchResult = await dispatchRecoveryMessageViaAdapter({
    channel: chosenChannel,
    recipientEmail: cleanEmail,
    recipientPhone: cleanPhone,
    recipientName: cart.customerName,
    cartId: cart.id,
    stepId,
    cartValue: Number(cart.cartValue) || 0,
    itemsSummary,
    couponCode: couponCodeToSend,
    simulateProviderState
  });

  currentStep.executedAt = new Date().toISOString();
  currentStep.channel = chosenChannel;
  currentStep.status = dispatchResult.status;
  currentStep.providerStatus = dispatchResult.provider;
  currentStep.externalMessageId = dispatchResult.externalMessageId;
  currentStep.couponCodeIssued = couponCodeToSend;
  currentStep.discountEvaluationReason = discountEvaluationReason;
  currentStep.costInr = dispatchResult.costInr;
  currentStep.error = dispatchResult.error;

  if (stepIdx > -1) {
    steps[stepIdx] = currentStep;
  } else {
    steps.push(currentStep);
  }

  // Only mark recoverySentEmail / recoverySentWhatsApp true if ACTUALLY DELIVERED!
  const nextSentEmail =
    cart.recoverySentEmail || (chosenChannel === 'EMAIL' && dispatchResult.delivered);
  const nextSentWhatsApp =
    cart.recoverySentWhatsApp || (chosenChannel === 'WHATSAPP' && dispatchResult.delivered);

  const [updatedCart] = await db
    .update(abandonedCarts)
    .set({
      status: 'ABANDONED',
      couponCode: couponCodeToSend || cart.couponCode,
      recoverySentEmail: nextSentEmail,
      recoverySentWhatsApp: nextSentWhatsApp,
      recoveryMetadata: {
        ...meta,
        sequenceSteps: steps,
        lastStepExecuted: stepId,
        lastStepStatus: dispatchResult.status,
        lastDiscountEvaluation: discountEvaluationReason
      }
    })
    .where(eq(abandonedCarts.id, cart.id))
    .returning();

  return {
    executed: dispatchResult.delivered,
    stepRecord: currentStep,
    cart: updatedCart,
    couponIssued: couponCodeToSend
  };
}

// ============================================================================
// BACKGROUND SWEEP FOR DUE RECOVERY REMINDERS
// ============================================================================

export async function processDueAbandonedCartReminders(): Promise<{
  evaluatedCarts: number;
  stepsProcessed: number;
}> {
  const config = await getAbandonedCartEngineConfig();
  const allCarts = await db.select().from(abandonedCarts);
  const allOrders = await db.select().from(orders);
  const nowMs = Date.now();

  let evaluatedCarts = 0;
  let stepsProcessed = 0;

  for (const cart of allCarts) {
    const elig = evaluateCartAbandonmentEligibility({
      cart,
      allOrders,
      config,
      referenceNowMs: nowMs
    });

    if (!elig.isAbandonedEligible) {
      // If linkedValidOrder found and cart is still marked ABANDONED, reconcile it automatically
      if (elig.linkedValidOrder && cart.status === 'ABANDONED') {
        await cancelPendingRecoveryForCart({
          cartId: cart.id,
          orderId: elig.linkedValidOrder.id,
          reason: 'ORDER_COMPLETED'
        });
      }
      continue;
    }

    evaluatedCarts++;
    const mins = elig.minutesSinceLastActivity;
    const meta = ((cart.recoveryMetadata as any) || {}) as Record<string, any>;
    const steps: RecoveryStepRecord[] = Array.isArray(meta.sequenceSteps)
      ? meta.sequenceSteps
      : buildDefaultSequenceSteps(cart.lastActivity ? new Date(cart.lastActivity) : new Date());

    const stepChecks: { id: RecoveryStepId; enabled: boolean; minMins: number }[] = [
      { id: 'T_PLUS_30M', enabled: config.enableStep1_30m, minMins: Math.max(1, config.abandonmentThresholdMinutes) },
      { id: 'T_PLUS_6H', enabled: config.enableStep2_6h, minMins: 360 },
      { id: 'T_PLUS_24H', enabled: config.enableStep3_24h, minMins: 1440 },
      { id: 'T_PLUS_48H', enabled: config.enableStep4_48h, minMins: 2880 }
    ];

    for (const sc of stepChecks) {
      if (!sc.enabled) continue;
      if (mins >= sc.minMins) {
        const existingStep = steps.find((s) => s.stepId === sc.id);
        if (!existingStep || existingStep.status === 'SCHEDULED') {
          await executeCartRecoveryStep({
            cartId: cart.id,
            stepId: sc.id
          });
          stepsProcessed++;
          break; // Process at most one stage per sweep cycle per cart
        }
      }
    }
  }

  return { evaluatedCarts, stepsProcessed };
}

// ============================================================================
// ADMIN DASHBOARD ANALYTICS & KPI AGGREGATOR
// ============================================================================

export async function getAbandonedCartDashboardAnalytics() {
  const [config, allCarts, allOrders, allRefunds, allCoupons, budgetUsage] = await Promise.all([
    getAbandonedCartEngineConfig(),
    db.select().from(abandonedCarts).orderBy(desc(abandonedCarts.lastActivity)),
    db.select().from(orders).orderBy(desc(orders.createdAt)),
    db.select().from(returnsRefunds),
    db.select().from(coupons),
    getCampaignDiscountBudgetUsage()
  ]);

  const providers = getRecoveryCommunicationProviderStatus();
  const refundByOrderId = new Map<string, number>();
  for (const r of allRefunds) {
    if (String(r.status || '').toUpperCase() === 'REFUNDED') {
      refundByOrderId.set(r.orderId, (refundByOrderId.get(r.orderId) || 0) + (Number(r.refundAmount) || 0));
    }
  }

  let eligibleAbandonedCartsCount = 0;
  let totalAbandonedValueInr = 0;
  let contactableAbandonedCartsCount = 0;
  let anonymousAbandonedCartsCount = 0;
  let recoveryMessagesAttempted = 0;
  let messagesDelivered = 0;
  let messagesIntegrationRequired = 0;
  let messagesFailed = 0;
  let recoveredCartsCount = 0;
  let directRecoveredCartsCount = 0;
  let assistedRecoveredCartsCount = 0;
  let manuallyMarkedCartsCount = 0;
  let organicCompletedCartsCount = 0;
  let recoveredNetRevenueInr = 0;
  let directRecoveredNetRevenueInr = 0;
  let assistedRecoveredNetRevenueInr = 0;
  let discountsIssuedCount = 0;
  let totalDiscountCostInr = 0;
  let totalMessagingCostInr = 0;
  let totalRecoveredCogsInr = 0;

  const enrichedCarts = allCarts.map((cart) => {
    const meta = ((cart.recoveryMetadata as any) || {}) as Record<string, any>;
    const evalResult = evaluateCartAbandonmentEligibility({
      cart,
      allOrders,
      config
    });

    const steps: RecoveryStepRecord[] = Array.isArray(meta.sequenceSteps)
      ? meta.sequenceSteps
      : buildDefaultSequenceSteps(cart.lastActivity ? new Date(cart.lastActivity) : new Date());

    // Count attempted & delivered messages for this cart
    let cartAttempted = 0;
    let cartDelivered = 0;
    let cartMessagingCost = 0;

    for (const s of steps) {
      if (
        s.status === 'DELIVERED' ||
        s.status === 'INTEGRATION_REQUIRED' ||
        s.status === 'FAILED'
      ) {
        cartAttempted++;
      }
      if (s.status === 'DELIVERED') {
        cartDelivered++;
        cartMessagingCost += Number(s.costInr) || 0;
      }
      if (s.status === 'INTEGRATION_REQUIRED') {
        messagesIntegrationRequired++;
      }
      if (s.status === 'FAILED') {
        messagesFailed++;
      }
    }

    // Include historical boolean flags if steps array had no recorded attempts yet
    if (cartAttempted === 0) {
      const legacySent =
        (cart.recoverySentWhatsApp ? 1 : 0) +
        (cart.recoverySentEmail ? 1 : 0) +
        (cart.recoverySentSMS ? 1 : 0);
      if (legacySent > 0) {
        cartAttempted += legacySent;
        cartDelivered += legacySent;
        cartMessagingCost += (cart.recoverySentWhatsApp ? 0.85 : 0) + (cart.recoverySentEmail ? 0.15 : 0);
      }
    }

    recoveryMessagesAttempted += cartAttempted;
    messagesDelivered += cartDelivered;
    totalMessagingCostInr += cartMessagingCost;

    if (cart.couponCode) {
      discountsIssuedCount++;
    }

    // Verified Order Recovery vs Manual Mark vs Eligible Abandoned
    const linkedOrder = evalResult.linkedValidOrder;
    let verifiedRecoveredOrderNetInr = 0;
    let verifiedOrderNumber: string | null = null;
    let recoveryClassification:
      | 'ELIGIBLE_ABANDONED'
      | 'VERIFIED_DIRECT_RECOVERY'
      | 'VERIFIED_ASSISTED_RECOVERY'
      | 'ORGANIC_SELF_COMPLETED'
      | 'MANUAL_UNVERIFIED'
      | 'ACTIVE_OR_PENDING'
      | 'SUPPRESSED_OR_DELETED' = 'ELIGIBLE_ABANDONED';

    if (linkedOrder) {
      const refundAmt = refundByOrderId.get(linkedOrder.id) || 0;
      const netOrderVal = Math.max(0, Number(linkedOrder.totalAmount || 0) - refundAmt);
      verifiedOrderNumber = linkedOrder.orderNumber;

      if (evalResult.attributionType === 'DIRECT_RECOVERY') {
        recoveryClassification = 'VERIFIED_DIRECT_RECOVERY';
        verifiedRecoveredOrderNetInr = netOrderVal;
        recoveredCartsCount++;
        directRecoveredCartsCount++;
        recoveredNetRevenueInr += netOrderVal;
        directRecoveredNetRevenueInr += netOrderVal;
        totalDiscountCostInr += Number(linkedOrder.discount) || 0;
        totalRecoveredCogsInr += Math.round(
          (Number(linkedOrder.subtotal) || netOrderVal) * config.smartCouponPolicy.estimatedCogsRatio
        );
      } else if (evalResult.attributionType === 'ASSISTED_RECOVERY') {
        recoveryClassification = 'VERIFIED_ASSISTED_RECOVERY';
        verifiedRecoveredOrderNetInr = netOrderVal;
        recoveredCartsCount++;
        assistedRecoveredCartsCount++;
        recoveredNetRevenueInr += netOrderVal;
        assistedRecoveredNetRevenueInr += netOrderVal;
        totalDiscountCostInr += Number(linkedOrder.discount) || 0;
        totalRecoveredCogsInr += Math.round(
          (Number(linkedOrder.subtotal) || netOrderVal) * config.smartCouponPolicy.estimatedCogsRatio
        );
      } else {
        // Organic completion before any reminder was sent -> ₹0 recovered revenue!
        recoveryClassification = 'ORGANIC_SELF_COMPLETED';
        organicCompletedCartsCount++;
      }
    } else if (cart.status === 'RECOVERED' || cart.status === 'MANUALLY_RECOVERED') {
      // Strictly enforce: Do NOT count a manually marked recovered cart as revenue!
      recoveryClassification = 'MANUAL_UNVERIFIED';
      manuallyMarkedCartsCount++;
    } else if (evalResult.isAbandonedEligible) {
      recoveryClassification = 'ELIGIBLE_ABANDONED';
      eligibleAbandonedCartsCount++;
      totalAbandonedValueInr += Number(cart.cartValue) || 0;
      if (evalResult.isContactable) {
        contactableAbandonedCartsCount++;
      } else {
        anonymousAbandonedCartsCount++;
      }
    } else if (cart.status === 'DELETED' || cart.status === 'SUPPRESSED' || meta.isDeleted) {
      recoveryClassification = 'SUPPRESSED_OR_DELETED';
    } else {
      recoveryClassification = 'ACTIVE_OR_PENDING';
    }

    const cleanEmail = (cart.customerEmail || '').trim();
    const cleanPhone = (cart.customerPhone || '').trim();
    const isAnonymous = !cleanEmail && !cleanPhone;
    const stepMap: Record<string, any> = {};
    for (const st of steps) {
      stepMap[st.stepId] = {
        ...st,
        offsetMinutes: st.delayMinutes,
        scheduledFor: st.scheduledAt,
        reason: st.error || st.discountEvaluationReason || null
      };
    }

    const permittedChannels: ('whatsapp' | 'email' | 'sms')[] = [];
    const consentObj = meta.customerConsent || {
      emailOptIn: true,
      whatsappOptIn: true,
      smsOptIn: false,
      unsubscribed: false
    };
    if (!consentObj.unsubscribed) {
      if (cleanPhone && consentObj.whatsappOptIn !== false) permittedChannels.push('whatsapp');
      if (cleanEmail && consentObj.emailOptIn !== false) permittedChannels.push('email');
    }

    return {
      ...cart,
      anonymousCartId: meta.anonymousCartId || cart.id,
      customerId: meta.customerId || null,
      identityState: isAnonymous ? 'ANONYMOUS' : 'IDENTIFIED',
      isAnonymous,
      isContactable: evalResult.isContactable,
      isAbandonedEligible: evalResult.isAbandonedEligible,
      exclusionReason: evalResult.exclusionReason,
      minutesSinceLastActivity: evalResult.minutesSinceLastActivity,
      lastActivity: cart.lastActivity
        ? new Date(cart.lastActivity).toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
          })
        : 'Just now',
      totalQuantity:
        meta.totalQuantity ||
        (Array.isArray(cart.items)
          ? cart.items.reduce((s: number, i: any) => s + (Number(i.quantity) || 1), 0)
          : 0),
      checkoutStartedAt: meta.checkoutStartedAt || null,
      paymentAttemptedAt: meta.paymentAttemptedAt || null,
      paymentResult: meta.paymentResult || 'NONE',
      customerConsent: consentObj,
      sequenceSteps: steps,
      attemptsCount: cartAttempted,
      deliveredCount: cartDelivered,
      recoveryClassification,
      verifiedOrderNumber,
      verifiedRecoveredOrderNetInr,
      lastDiscountEvaluation: meta.lastDiscountEvaluation || null,
      recoveryMetadata: {
        ...meta,
        consent: consentObj,
        sequenceSteps: stepMap,
        manuallyMarkedRecovered: recoveryClassification === 'MANUAL_UNVERIFIED',
        messageAttempts: steps
          .filter((s) => s.status !== 'SCHEDULED')
          .map((s, idx) => ({
            id: `${cart.id}_${s.stepId}_${idx}`,
            stepId: s.stepId,
            channel: (s.channel || 'WHATSAPP').toLowerCase(),
            attemptedAt: s.executedAt || s.scheduledAt,
            deliveryStatus: s.status,
            providerName:
              String(s.channel || '').toUpperCase() === 'EMAIL'
                ? providers.email.providerName
                : providers.whatsapp.providerName,
            errorReason: s.error || s.discountEvaluationReason || null,
            couponCode: s.couponCodeIssued || null,
            costInr: s.costInr || 0
          }))
      },
      eligibility: {
        isAbandoned: evalResult.isAbandonedEligible,
        isContactable: evalResult.isContactable,
        minutesInactive: evalResult.minutesSinceLastActivity,
        blockReasons: evalResult.exclusionReason ? [evalResult.exclusionReason] : [],
        permittedChannels
      },
      linkedPaidOrder: linkedOrder
        ? {
            id: linkedOrder.id,
            orderNumber: linkedOrder.orderNumber,
            netRevenueInr: verifiedRecoveredOrderNetInr,
            attributionType:
              evalResult.attributionType === 'DIRECT_RECOVERY'
                ? ('DIRECT' as const)
                : evalResult.attributionType === 'ASSISTED_RECOVERY'
                ? ('ASSISTED' as const)
                : ('ORGANIC' as const),
            createdAt: linkedOrder.createdAt ? new Date(linkedOrder.createdAt).toISOString() : new Date().toISOString()
          }
        : null
    };
  });

  const totalDenominator = eligibleAbandonedCartsCount + recoveredCartsCount;
  const recoveryConversionRatePercent =
    totalDenominator > 0 ? Number(((recoveredCartsCount / totalDenominator) * 100).toFixed(1)) : 0;

  const totalRecoveryCostInr = Math.round((totalMessagingCostInr + totalDiscountCostInr) * 100) / 100;
  const recoveryContributionMarginInr = Math.round(
    recoveredNetRevenueInr - totalRecoveredCogsInr - totalMessagingCostInr
  );
  const recoveryContributionMarginPercent =
    recoveredNetRevenueInr > 0
      ? Number(((recoveryContributionMarginInr / recoveredNetRevenueInr) * 100).toFixed(1))
      : 0;

  return {
    kpis: {
      eligibleAbandonedCarts: eligibleAbandonedCartsCount,
      totalAbandonedValueInr,
      contactableAbandonedCarts: contactableAbandonedCartsCount,
      anonymousAbandonedCarts: anonymousAbandonedCartsCount,
      anonymousNonContactableCarts: anonymousAbandonedCartsCount,
      recoveryMessagesAttempted,
      messagesDelivered,
      messagesIntegrationRequired,
      messagesFailed,
      recoveredCarts: recoveredCartsCount,
      directRecoveredCarts: directRecoveredCartsCount,
      assistedRecoveredCarts: assistedRecoveredCartsCount,
      manuallyMarkedCarts: manuallyMarkedCartsCount,
      organicCompletedCarts: organicCompletedCartsCount,
      recoveredNetRevenueInr,
      directRecoveredNetRevenueInr,
      assistedRecoveredNetRevenueInr,
      recoveryConversionRatePercent,
      discountsIssued: discountsIssuedCount,
      discountsIssuedCount,
      totalDiscountRedeemedInr: totalDiscountCostInr,
      totalDiscountValueRedeemedInr: totalDiscountCostInr,
      recoveryContributionMarginInr,
      recoveryContributionMarginPercent,
      recoveryCostInr: totalRecoveryCostInr,
      messagingCostInr: Math.round(totalMessagingCostInr * 100) / 100,
      campaignBudgetLimitInr: config.smartCouponPolicy.campaignBudgetLimitInr,
      campaignBudgetRemainingInr: Math.max(
        0,
        config.smartCouponPolicy.campaignBudgetLimitInr - budgetUsage.totalRedeemedInr
      )
    },
    providers: {
      whatsapp: {
        ...providers.whatsapp,
        costPerMessageInr: 0.85
      },
      email: {
        ...providers.email,
        costPerMessageInr: 0.12
      },
      sms: {
        providerName: 'DLT SMS Gateway',
        connected: false,
        statusLabel: 'Integration required' as const,
        costPerMessageInr: 0.25
      }
    },
    config: {
      ...config,
      inactivityMinutes: config.abandonmentThresholdMinutes,
      enableT48hFinalReminder: config.enableStep4_48h,
      maxRemindersPerCart: config.maxMessagesPerCart,
      quietHoursStart: 22,
      quietHoursEnd: 9,
      smartCoupon: {
        ...config.smartCouponPolicy,
        singleUseOnly: config.smartCouponPolicy.singleUse,
        customerSpecificAssignment: true,
        estimatedCogsPercent: Math.round(config.smartCouponPolicy.estimatedCogsRatio * 100),
        campaignBudgetSpentInr: budgetUsage.totalRedeemedInr
      }
    },
    carts: enrichedCarts.filter((c) => c.status !== 'DELETED')
  };
}

// ============================================================================
// AUTOMATED 10-SCENARIO VERIFICATION SUITE (REAL POSTGRESQL EXECUTION)
// ============================================================================

export async function runAbandonedCartEngineVerificationSuite(): Promise<{
  allPassed: boolean;
  passedCount: number;
  totalTests: number;
  totalCount: number;
  results: {
    id: string;
    name: string;
    scenario: string;
    passed: boolean;
    assertionSummary: string;
    details: string;
    durationMs: number;
  }[];
}> {
  const results: {
    id: string;
    name: string;
    scenario: string;
    passed: boolean;
    assertionSummary: string;
    details: string;
    durationMs: number;
  }[] = [];

  const testPrefix = `test_ace_${Date.now()}`;
  const createdCartIds: string[] = [];
  const createdOrderIds: string[] = [];
  const createdCouponCodes: string[] = [];

  // Look up a real active, in-stock product from PostgreSQL so stock checks pass for normal tests
  const dbProducts = await db.select().from(products);
  const activeProd =
    dbProducts.find((p) => {
      if (String(p.status).toUpperCase() !== 'ACTIVE') return false;
      const vars: any[] = Array.isArray(p.variants) ? p.variants : [];
      return vars.some((v) => v.isAvailable !== false && (v.stockManaged === false || Number(v.stockAvailable ?? 10) > 0));
    }) || dbProducts[0];

  const activeVariants: any[] = Array.isArray(activeProd?.variants) ? activeProd.variants : [];
  const activeVar =
    activeVariants.find(
      (v) => v.isAvailable !== false && (v.stockManaged === false || Number(v.stockAvailable ?? 10) > 0)
    ) ||
    activeVariants[0] || { id: 'golden-hour-50ml', size: '50 ml', sku: 'FRG-SIG-GH-050', sellingPrice: 999 };

  const validTestItem = {
    productId: activeProd?.id || 'prod-golden-hour',
    slug: activeProd?.slug || 'golden-hour',
    productName: activeProd?.name || 'Golden Hour',
    variantId: activeVar.id,
    size: activeVar.size || '100ml',
    sku: activeVar.sku,
    sellingPrice: 3899,
    quantity: 1
  };

  try {
    // ------------------------------------------------------------------------
    // TEST 1: Customer completes order before first reminder
    // ------------------------------------------------------------------------
    {
      const t0 = Date.now();
      const cartId = `${testPrefix}_t1_cart`;
      const orderId = `${testPrefix}_t1_order`;
      const email = `${testPrefix}_t1@fragmore.shop`;
      createdCartIds.push(cartId);
      createdOrderIds.push(orderId);

      await trackOrSyncCartSession({
        id: cartId,
        customerEmail: email,
        customerPhone: '+919811100001',
        customerName: 'Test 1 Buyer',
        items: [validTestItem],
        cartValue: 3899,
        checkoutStarted: true
      });

      // Customer completes order 5 minutes later (before T+30m first reminder)
      await db.insert(orders).values({
        id: orderId,
        orderNumber: `FM-T1-${Date.now()}`,
        customerId: 'cust-t1',
        customerName: 'Test 1 Buyer',
        customerEmail: email,
        customerPhone: '+919811100001',
        shippingAddress: { city: 'Mumbai', state: 'Maharashtra' },
        items: [{ ...validTestItem, price: 3899 }],
        subtotal: 3899,
        discount: 0,
        totalAmount: 3899,
        paymentMethod: 'PREPAID',
        paymentStatus: 'PAID',
        orderStatus: 'CONFIRMED',
        attribution: { cartId }
      });

      const cancelRes = await cancelPendingRecoveryForCart({
        cartId,
        orderId,
        reason: 'ORDER_COMPLETED'
      });

      const stepRes = await executeCartRecoveryStep({
        cartId,
        stepId: 'T_PLUS_30M',
        forceElapsed: true,
        simulateProviderState: 'CONNECTED_SUCCESS'
      });

      const passed =
        cancelRes.cancelledStepCount === 4 &&
        stepRes.executed === false &&
        stepRes.cart.status === 'ORGANIC_COMPLETED';

      const summary = `Status=${stepRes.cart.status}, CancelledSteps=${cancelRes.cancelledStepCount}, MessagesSent=0, AttributedRecoveryRevenue=₹0`;
      results.push({
        id: 'test_1_order_before_first_reminder',
        name: '1. Customer completes order before first reminder',
        scenario: '1. Customer completes order before first reminder',
        passed,
        assertionSummary: summary,
        details: summary,
        durationMs: Date.now() - t0
      });
    }

    // ------------------------------------------------------------------------
    // TEST 2: Payment webhook arrives late
    // ------------------------------------------------------------------------
    {
      const t0 = Date.now();
      const cartId = `${testPrefix}_t2_cart`;
      const orderId = `${testPrefix}_t2_order`;
      const email = `${testPrefix}_t2@fragmore.shop`;
      createdCartIds.push(cartId);
      createdOrderIds.push(orderId);

      const fortyMinsAgo = new Date(Date.now() - 45 * 60 * 1000);
      await trackOrSyncCartSession({
        id: cartId,
        customerEmail: email,
        customerPhone: '+919811100002',
        items: [validTestItem],
        cartValue: 3899,
        paymentAttempted: true,
        paymentResult: 'PENDING',
        lastActivityOverride: fortyMinsAgo
      });

      const config = await getAbandonedCartEngineConfig();
      const [pendingCart] = await db.select().from(abandonedCarts).where(eq(abandonedCarts.id, cartId));
      const eligWhilePending = evaluateCartAbandonmentEligibility({
        cart: pendingCart,
        allOrders: [],
        config
      });

      await db.insert(orders).values({
        id: orderId,
        orderNumber: `FM-T2-${Date.now()}`,
        customerId: 'cust-t2',
        customerName: 'Test 2 Buyer',
        customerEmail: email,
        customerPhone: '+919811100002',
        shippingAddress: { city: 'Delhi', state: 'Delhi' },
        items: [{ ...validTestItem, price: 3899 }],
        subtotal: 3899,
        discount: 0,
        totalAmount: 3899,
        paymentMethod: 'PREPAID',
        paymentStatus: 'PAID',
        orderStatus: 'CONFIRMED',
        attribution: { cartId }
      });

      const cancelAfterWebhook = await cancelPendingRecoveryForCart({
        cartId,
        orderId,
        reason: 'LATE_PAYMENT_WEBHOOK'
      });

      const passed =
        eligWhilePending.isAbandonedEligible === false &&
        eligWhilePending.exclusionReason === 'Payment confirmation is pending' &&
        cancelAfterWebhook.cancelledStepCount === 4;

      const summary = `HeldWhilePending=${!eligWhilePending.isAbandonedEligible} (${eligWhilePending.exclusionReason}), CancelledOnWebhook=${cancelAfterWebhook.cancelledStepCount} steps`;
      results.push({
        id: 'test_2_late_payment_webhook',
        name: '2. Payment webhook arrives late',
        scenario: '2. Payment webhook arrives late',
        passed,
        assertionSummary: summary,
        details: summary,
        durationMs: Date.now() - t0
      });
    }

    // ------------------------------------------------------------------------
    // TEST 3: Same event arrives twice (Idempotency & Deduplication)
    // ------------------------------------------------------------------------
    {
      const t0 = Date.now();
      const cartId = `${testPrefix}_t3_cart`;
      const idemKey = `idem_${testPrefix}_t3`;
      createdCartIds.push(cartId);

      const firstCall = await trackOrSyncCartSession({
        id: cartId,
        customerEmail: `${testPrefix}_t3@fragmore.shop`,
        customerPhone: '+919811100003',
        items: [validTestItem],
        cartValue: 3899,
        idempotencyKey: idemKey,
        lastActivityOverride: new Date(Date.now() - 40 * 60 * 1000)
      });

      const secondCall = await trackOrSyncCartSession({
        id: cartId,
        customerEmail: `${testPrefix}_t3@fragmore.shop`,
        customerPhone: '+919811100003',
        items: [validTestItem],
        cartValue: 3899,
        idempotencyKey: idemKey
      });

      const stepRun1 = await executeCartRecoveryStep({
        cartId,
        stepId: 'T_PLUS_30M',
        forceElapsed: true,
        simulateProviderState: 'CONNECTED_SUCCESS'
      });
      const stepRun2 = await executeCartRecoveryStep({
        cartId,
        stepId: 'T_PLUS_30M',
        forceElapsed: true,
        simulateProviderState: 'CONNECTED_SUCCESS'
      });

      const passed =
        firstCall.deduplicated === false &&
        secondCall.deduplicated === true &&
        stepRun1.executed === true &&
        stepRun2.executed === false;

      const summary = `Event2Deduplicated=${secondCall.deduplicated}, StepRun1Sent=${stepRun1.executed}, DuplicateStepRun2Blocked=${!stepRun2.executed}`;
      results.push({
        id: 'test_3_duplicate_event_idempotency',
        name: '3. Same event arrives twice',
        scenario: '3. Same event arrives twice',
        passed,
        assertionSummary: summary,
        details: summary,
        durationMs: Date.now() - t0
      });
    }

    // ------------------------------------------------------------------------
    // TEST 4: Customer unsubscribes
    // ------------------------------------------------------------------------
    {
      const t0 = Date.now();
      const cartId = `${testPrefix}_t4_cart`;
      const email = `${testPrefix}_t4@fragmore.shop`;
      createdCartIds.push(cartId);

      await trackOrSyncCartSession({
        id: cartId,
        customerEmail: email,
        customerPhone: '+919811100004',
        items: [validTestItem],
        cartValue: 3899,
        lastActivityOverride: new Date(Date.now() - 50 * 60 * 1000)
      });

      await cancelPendingRecoveryForCart({
        cartId,
        customerEmail: email,
        reason: 'CUSTOMER_UNSUBSCRIBED'
      });

      const stepAfterUnsub = await executeCartRecoveryStep({
        cartId,
        stepId: 'T_PLUS_6H',
        forceElapsed: true,
        simulateProviderState: 'CONNECTED_SUCCESS'
      });

      const passed =
        stepAfterUnsub.executed === false &&
        stepAfterUnsub.stepRecord.status === 'CANCELLED_UNSUBSCRIBED';

      const summary = `StepExecuted=${stepAfterUnsub.executed}, StepStatus=${stepAfterUnsub.stepRecord.status}`;
      results.push({
        id: 'test_4_customer_unsubscribes',
        name: '4. Customer unsubscribes',
        scenario: '4. Customer unsubscribes',
        passed,
        assertionSummary: summary,
        details: summary,
        durationMs: Date.now() - t0
      });
    }

    // ------------------------------------------------------------------------
    // TEST 5: Cart value changes (Smart Coupon threshold & activity reset)
    // ------------------------------------------------------------------------
    {
      const t0 = Date.now();
      const cartId = `${testPrefix}_t5_cart`;
      createdCartIds.push(cartId);

      await trackOrSyncCartSession({
        id: cartId,
        customerEmail: `${testPrefix}_t5@fragmore.shop`,
        customerPhone: '+919811100005',
        items: [validTestItem],
        cartValue: 3899
      });

      // Customer modifies cart to ₹1,200 (< ₹2,500 minCartValue)
      await trackOrSyncCartSession({
        id: cartId,
        customerEmail: `${testPrefix}_t5@fragmore.shop`,
        customerPhone: '+919811100005',
        items: [{ ...validTestItem, sellingPrice: 1200, quantity: 1 }],
        cartValue: 1200,
        lastActivityOverride: new Date(Date.now() - 1500 * 60 * 1000)
      });

      const step24h = await executeCartRecoveryStep({
        cartId,
        stepId: 'T_PLUS_24H',
        forceElapsed: true,
        simulateProviderState: 'CONNECTED_SUCCESS'
      });

      const passed =
        step24h.cart.cartValue === 1200 &&
        step24h.couponIssued === null &&
        String(step24h.stepRecord.discountEvaluationReason || '').includes('below minimum threshold');

      const summary = `UpdatedCartValue=₹${step24h.cart.cartValue}, CouponIssued=${step24h.couponIssued}, PolicyReason="${step24h.stepRecord.discountEvaluationReason}"`;
      results.push({
        id: 'test_5_cart_value_changes',
        name: '5. Cart value changes',
        scenario: '5. Cart value changes',
        passed,
        assertionSummary: summary,
        details: summary,
        durationMs: Date.now() - t0
      });
    }

    // ------------------------------------------------------------------------
    // TEST 6: Product becomes unavailable
    // ------------------------------------------------------------------------
    {
      const t0 = Date.now();
      const cartId = `${testPrefix}_t6_cart`;
      createdCartIds.push(cartId);

      await trackOrSyncCartSession({
        id: cartId,
        customerEmail: `${testPrefix}_t6@fragmore.shop`,
        customerPhone: '+919811100006',
        items: [
          {
            ...validTestItem,
            productId: 'prod-unavailable-sku',
            slug: 'discontinued-flacon',
            productName: 'Discontinued Reserve',
            quantity: 99999
          }
        ],
        cartValue: 3899,
        lastActivityOverride: new Date(Date.now() - 60 * 60 * 1000)
      });

      const stepRes = await executeCartRecoveryStep({
        cartId,
        stepId: 'T_PLUS_30M',
        forceElapsed: true,
        simulateProviderState: 'CONNECTED_SUCCESS'
      });

      const passed =
        stepRes.executed === false &&
        stepRes.stepRecord.status === 'SUPPRESSED_PRODUCT_UNAVAILABLE';

      const summary = `StepExecuted=${stepRes.executed}, Status=${stepRes.stepRecord.status} (${stepRes.stepRecord.error})`;
      results.push({
        id: 'test_6_product_unavailable',
        name: '6. Product becomes unavailable',
        scenario: '6. Product becomes unavailable',
        passed,
        assertionSummary: summary,
        details: summary,
        durationMs: Date.now() - t0
      });
    }

    // ------------------------------------------------------------------------
    // TEST 7: Coupon expires
    // ------------------------------------------------------------------------
    {
      const t0 = Date.now();
      const cartId = `${testPrefix}_t7_cart`;
      const email = `${testPrefix}_t7@fragmore.shop`;
      createdCartIds.push(cartId);

      const issuedRes = await issueSmartRecoveryCoupon({
        cartId,
        customerEmail: email,
        items: [validTestItem],
        cartValue: 3899,
        policyOverride: { expiryHours: -1 }
      });

      if (issuedRes.couponCode) {
        createdCouponCodes.push(issuedRes.couponCode);
      }

      const validation = await validateRecoveryCouponAtCheckout({
        code: issuedRes.couponCode || '',
        customerEmail: email,
        cartValue: 3899
      });

      const passed =
        issuedRes.issued === true &&
        validation.valid === false &&
        validation.errorCode === 'COUPON_EXPIRED';

      const summary = `Coupon=${issuedRes.couponCode}, Valid=${validation.valid}, ErrorCode=${validation.errorCode}`;
      results.push({
        id: 'test_7_coupon_expires',
        name: '7. Coupon expires',
        scenario: '7. Coupon expires',
        passed,
        assertionSummary: summary,
        details: summary,
        durationMs: Date.now() - t0
      });
    }

    // ------------------------------------------------------------------------
    // TEST 8: Message provider fails (Do not pretend message was delivered)
    // ------------------------------------------------------------------------
    {
      const t0 = Date.now();
      const cartId = `${testPrefix}_t8_cart`;
      createdCartIds.push(cartId);

      await trackOrSyncCartSession({
        id: cartId,
        customerEmail: `${testPrefix}_t8@fragmore.shop`,
        customerPhone: '+919811100008',
        items: [validTestItem],
        cartValue: 3899,
        lastActivityOverride: new Date(Date.now() - 45 * 60 * 1000)
      });

      const failRes = await executeCartRecoveryStep({
        cartId,
        stepId: 'T_PLUS_30M',
        forceElapsed: true,
        simulateProviderState: 'PROVIDER_FAILURE'
      });

      const passed =
        failRes.executed === false &&
        failRes.stepRecord.status === 'FAILED' &&
        failRes.cart.recoverySentWhatsApp === false &&
        failRes.cart.recoverySentEmail === false;

      const summary = `Delivered=${failRes.executed}, StepStatus=${failRes.stepRecord.status}, recoverySentFlags=false`;
      results.push({
        id: 'test_8_provider_fails',
        name: '8. Message provider fails',
        scenario: '8. Message provider fails',
        passed,
        assertionSummary: summary,
        details: summary,
        durationMs: Date.now() - t0
      });
    }

    // ------------------------------------------------------------------------
    // TEST 9: Customer switches devices (Cross-device cart merge without duplicate sequence)
    // ------------------------------------------------------------------------
    {
      const t0 = Date.now();
      const authCartId = `${testPrefix}_t9_deviceA`;
      const anonCartId = `${testPrefix}_t9_deviceB_anon`;
      const email = `${testPrefix}_t9@fragmore.shop`;
      createdCartIds.push(authCartId, anonCartId);

      await trackOrSyncCartSession({
        id: authCartId,
        customerId: 'cust-t9',
        customerEmail: email,
        customerPhone: '+919811100009',
        items: [validTestItem],
        cartValue: 3899
      });

      await trackOrSyncCartSession({
        id: anonCartId,
        anonymousCartId: anonCartId,
        items: [validTestItem],
        cartValue: 3899
      });

      const mergedSession = await trackOrSyncCartSession({
        anonymousCartId: anonCartId,
        customerId: 'cust-t9',
        customerEmail: email,
        customerPhone: '+919811100009',
        items: [validTestItem],
        cartValue: 3899
      });

      const [anonAfterMerge] = await db
        .select()
        .from(abandonedCarts)
        .where(eq(abandonedCarts.id, anonCartId));

      const passed =
        mergedSession.cart.id === authCartId &&
        mergedSession.mergedFromAnonymousCartId === anonCartId &&
        anonAfterMerge?.status === 'DELETED';

      const summary = `CanonicalCartId=${mergedSession.cart.id}, MergedFrom=${mergedSession.mergedFromAnonymousCartId}, DuplicateCartStatus=${anonAfterMerge?.status}`;
      results.push({
        id: 'test_9_customer_switches_devices',
        name: '9. Customer switches devices',
        scenario: '9. Customer switches devices',
        passed,
        assertionSummary: summary,
        details: summary,
        durationMs: Date.now() - t0
      });
    }

    // ------------------------------------------------------------------------
    // TEST 10: Anonymous customer without contact details
    // ------------------------------------------------------------------------
    {
      const t0 = Date.now();
      const anonCartId = `${testPrefix}_t10_anon`;
      createdCartIds.push(anonCartId);

      const tracked = await trackOrSyncCartSession({
        id: anonCartId,
        anonymousCartId: anonCartId,
        items: [validTestItem],
        cartValue: 3899,
        lastActivityOverride: new Date(Date.now() - 60 * 60 * 1000)
      });

      const stepRes = await executeCartRecoveryStep({
        cartId: anonCartId,
        stepId: 'T_PLUS_30M',
        forceElapsed: true,
        simulateProviderState: 'CONNECTED_SUCCESS'
      });

      const meta = (tracked.cart.recoveryMetadata || {}) as Record<string, any>;
      const passed =
        tracked.cart.customerEmail === '' &&
        tracked.cart.customerPhone === '' &&
        meta.identityState === 'ANONYMOUS' &&
        meta.contactable === false &&
        stepRes.executed === false &&
        stepRes.stepRecord.status === 'SKIPPED_ANONYMOUS_NO_CONTACT';

      const summary = `Identity=${meta.identityState}, Contactable=${meta.contactable}, Email="", Phone="", StepStatus=${stepRes.stepRecord.status}`;
      results.push({
        id: 'test_10_anonymous_without_contact',
        name: '10. Anonymous customer without contact details',
        scenario: '10. Anonymous customer without contact details',
        passed,
        assertionSummary: summary,
        details: summary,
        durationMs: Date.now() - t0
      });
    }
  } finally {
    // Clean up all temporary test records from PostgreSQL so zero artificial data remains
    for (const cid of createdCartIds) {
      await db.delete(abandonedCarts).where(eq(abandonedCarts.id, cid));
    }
    for (const oid of createdOrderIds) {
      await db.delete(orders).where(eq(orders.id, oid));
    }
    for (const code of createdCouponCodes) {
      await db.delete(coupons).where(eq(coupons.code, code));
    }
  }

  const passedCount = results.filter((r) => r.passed).length;
  return {
    allPassed: passedCount === results.length,
    passedCount,
    totalTests: results.length,
    totalCount: results.length,
    results
  };
}
