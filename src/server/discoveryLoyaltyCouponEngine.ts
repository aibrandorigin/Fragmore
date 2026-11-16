import { db } from '../db/index.ts';
import {
  coupons,
  customers,
  discoveryJourneys,
  inventoryLedger,
  loyaltyProgramsAndLedger,
  orders,
  products,
  campaigns,
  automationApprovals,
  auditLogs
} from '../db/schema.ts';
import { eq, desc } from 'drizzle-orm';
import { ingestAutomationEvent } from './automationEngine.ts';
import { recalculateCustomerLifecycleState } from '../db/queries.ts';

export interface DiscoveryConfigurationSpec {
  code: string;
  name: string;
  vialSize: '2 ml' | '8 ml';
  vialCount: number;
  defaultPriceInr: number;
  includedFragrances: string[];
  isApproved: boolean;
}

export interface DiscoveryRedemptionRulesConfig {
  redemptionCalculationMode:
    | 'CONFIGURED_AMOUNT_BY_VIAL_SIZE'
    | 'FULL_DISCOVERY_NET_PRICE'
    | 'CONFIGURED_PERCENTAGE';
  redemptionAmount2mlInr: number;
  redemptionAmount8mlInr: number;
  redemptionPercentage: number;
  eligibleProductSlugs: string[]; // 'ALL_FULL_BOTTLES' or specific product slugs
  eligibleBottleSizes: string[]; // e.g. ['50 ml', '100 ml']
  minOrderValueInr: number;
  validityDaysAfterDelivery: number;
  oneRedemptionPerDiscoveryOrder: boolean;
  allowStackingWithOtherCoupons: boolean;
  revokeVoucherOnRefundOrCancel: boolean;
  customerSpecificVoucherBinding: boolean;
  requireProductInStock: boolean;
  minGrossMarginPercent: number;
  estimatedCogsPercent: number;
  supportedConfigurations: DiscoveryConfigurationSpec[];
  updatedBy: string;
  updatedAt: string;
}

export interface EnterpriseCouponMetadata {
  campaignOwner: string;
  budgetInr: number;
  budgetUtilizedInr: number;
  startDate: string;
  endDate: string;
  perCustomerLimit: number;
  eligibleCustomerSegment: string; // 'ALL' | 'Discovery Buyers' | 'VIP Customers' | 'First-Time Buyers' | 'Repeat Buyers' | 'Inactive Customers' | 'Specific Customer'
  assignedCustomerEmail?: string | null;
  eligibleProducts: string[]; // ['ALL'] or product slugs / SKUs
  stackingRule: 'EXCLUSIVE' | 'STACKABLE_WITH_LOYALTY' | 'STACKABLE_WITH_ALL';
  redemptionHistory: Array<{
    orderId: string;
    orderNumber: string;
    customerEmail: string;
    orderAmountInr: number;
    discountAppliedInr: number;
    estimatedCogsInr: number;
    netContributionMarginInr: number;
    redeemedAt: string;
  }>;
  attributedRevenueInr: number;
  totalDiscountCostInr: number;
  profitabilityEstimateInr: number;
  netMarginPercent: number;
  discoveryJourneyId?: string | null;
  loyaltyRuleId?: string | null;
  approvalStatus: 'APPROVED' | 'PENDING_APPROVAL' | 'REJECTED';
}

const DEFAULT_DISCOVERY_CONFIGURATIONS: DiscoveryConfigurationSpec[] = [
  {
    code: 'DISCOVERY_SIX_2ML',
    name: 'The Discovery Six — 6 × 2 ml Luxury Atomizers',
    vialSize: '2 ml',
    vialCount: 6,
    defaultPriceInr: 999,
    includedFragrances: ['AZURE', 'IGNITE', 'ROSELLE', 'ÉLAN', 'SUEDE', 'SOLARA'],
    isApproved: true
  },
  {
    code: 'DISCOVERY_SIX_8ML',
    name: 'The Discovery Six Collector Edition — 6 × 8 ml Travel Coffret',
    vialSize: '8 ml',
    vialCount: 6,
    defaultPriceInr: 2499,
    includedFragrances: ['AZURE', 'IGNITE', 'ROSELLE', 'ÉLAN', 'SUEDE', 'SOLARA'],
    isApproved: true
  },
  {
    code: 'SIGNATURE_TRIO_8ML',
    name: 'Signature Extrait Trio — 3 × 8 ml Parfumeur Selection',
    vialSize: '8 ml',
    vialCount: 3,
    defaultPriceInr: 1499,
    includedFragrances: ['GOLDEN HOUR', 'BLACK BACCARA', 'MYSTIC GARDEN'],
    isApproved: true
  },
  {
    code: 'DEVOTIONAL_QUARTET_2ML',
    name: 'Sacred Aura Quartet — 4 × 2 ml Pure Attar & Extrait Vials',
    vialSize: '2 ml',
    vialCount: 4,
    defaultPriceInr: 799,
    includedFragrances: ['DIVINE AURA', 'TEMPLE FLORA', 'MYSTIC EARTH', 'VELVET NIGHT'],
    isApproved: true
  }
];

const DEFAULT_REDEMPTION_RULES: DiscoveryRedemptionRulesConfig = {
  redemptionCalculationMode: 'CONFIGURED_AMOUNT_BY_VIAL_SIZE',
  redemptionAmount2mlInr: 799,
  redemptionAmount8mlInr: 1299,
  redemptionPercentage: 20,
  eligibleProductSlugs: ['ALL_FULL_BOTTLES'],
  eligibleBottleSizes: ['50 ml', '100 ml'],
  minOrderValueInr: 3499,
  validityDaysAfterDelivery: 45,
  oneRedemptionPerDiscoveryOrder: true,
  allowStackingWithOtherCoupons: false,
  revokeVoucherOnRefundOrCancel: true,
  customerSpecificVoucherBinding: true,
  requireProductInStock: true,
  minGrossMarginPercent: 40,
  estimatedCogsPercent: 25,
  supportedConfigurations: DEFAULT_DISCOVERY_CONFIGURATIONS,
  updatedBy: 'gowisherharsha@gmail.com',
  updatedAt: new Date().toISOString()
};

const DEFAULT_LOYALTY_PROGRAMS = [
  {
    id: 'loyalty-first-order-benefit',
    ruleType: 'FIRST_ORDER_BENEFIT',
    name: 'First-Order Connoisseur Welcome Benefit',
    description:
      'Issues a welcome privilege voucher for a customer’s inaugural full-flacon purchase after registration & consent verification.',
    isMonetaryBenefit: true,
    benefitType: 'FIXED_VOUCHER',
    benefitValue: 400,
    minQualifyingOrderInr: 2999,
    requiresAdminApproval: true,
    approvalStatus: 'APPROVED',
    approvedBy: 'gowisherharsha@gmail.com',
    isActive: true,
    config: {
      validityDays: 30,
      eligibleSegments: ['New Registered Customers', 'Visitors Without Purchases'],
      minGrossMarginPercent: 42
    }
  },
  {
    id: 'loyalty-second-purchase-reward',
    ruleType: 'SECOND_PURCHASE_REWARD',
    name: 'Second-Purchase Collector Reward',
    description:
      'Rewards first-time full-bottle buyers with a bounce-back privilege toward their second signature flacon.',
    isMonetaryBenefit: true,
    benefitType: 'PERCENTAGE_DISCOUNT',
    benefitValue: 12,
    minQualifyingOrderInr: 3899,
    requiresAdminApproval: true,
    approvalStatus: 'APPROVED',
    approvedBy: 'gowisherharsha@gmail.com',
    isActive: true,
    config: {
      validityDays: 45,
      maxDiscountInr: 900,
      eligibleSegments: ['First-Time Buyers']
    }
  },
  {
    id: 'loyalty-vip-eligibility',
    ruleType: 'VIP_ELIGIBILITY',
    name: 'VIP Atelier Circle (₹5,000+ Net Purchase Qualification)',
    description:
      'Automatically assigns VIP status when cumulative net completed purchases reach ₹5,000 or a single order reaches ₹5,000. Monetary VIP invitation voucher requires Admin approval.',
    isMonetaryBenefit: true,
    benefitType: 'FIXED_VOUCHER',
    benefitValue: 1000,
    minQualifyingOrderInr: 4999,
    requiresAdminApproval: true,
    approvalStatus: 'PENDING_APPROVAL',
    approvedBy: null,
    isActive: false,
    config: {
      qualifyingNetThresholdInr: 5000,
      adminOnlyVisibility: true,
      recalculateOnRefund: true
    }
  },
  {
    id: 'loyalty-referral-benefit',
    ruleType: 'REFERRAL_BENEFIT',
    name: 'Private Patron Referral Privilege',
    description:
      'Issues a referral credit to the advocate after their invited friend completes a verified non-refunded paid order.',
    isMonetaryBenefit: true,
    benefitType: 'FIXED_VOUCHER',
    benefitValue: 500,
    minQualifyingOrderInr: 3499,
    requiresAdminApproval: true,
    approvalStatus: 'PENDING_APPROVAL',
    approvedBy: null,
    isActive: false,
    config: {
      refereeDiscountInr: 350,
      advocateRewardInr: 500,
      requireVerifiedDeliveryBeforeAdvocatePayout: true
    }
  },
  {
    id: 'loyalty-birthday-offer',
    ruleType: 'BIRTHDAY_OFFER',
    name: 'Voluntary Birthday Olfactory Gift Offer',
    description:
      'Schedules a personalized birthday privilege strictly for customers who have voluntarily provided their date of birth and opted into promotional communications.',
    isMonetaryBenefit: true,
    benefitType: 'PERCENTAGE_DISCOUNT',
    benefitValue: 15,
    minQualifyingOrderInr: 3499,
    requiresAdminApproval: true,
    approvalStatus: 'APPROVED',
    approvedBy: 'gowisherharsha@gmail.com',
    isActive: true,
    config: {
      requireVoluntaryBirthday: true,
      maxDiscountInr: 1000,
      validityDays: 14
    }
  },
  {
    id: 'loyalty-repeat-customer-offer',
    ruleType: 'REPEAT_CUSTOMER_OFFER',
    name: 'Repeat Patron Replenishment & Vault Privilege',
    description:
      'Recognizes repeat buyers (2+ completed orders) with priority access and approved loyalty credit on 100 ml flacon replenishments.',
    isMonetaryBenefit: true,
    benefitType: 'FIXED_VOUCHER',
    benefitValue: 600,
    minQualifyingOrderInr: 4499,
    requiresAdminApproval: true,
    approvalStatus: 'APPROVED',
    approvedBy: 'gowisherharsha@gmail.com',
    isActive: true,
    config: {
      minCompletedOrders: 2,
      replenishmentCycleDays: 75
    }
  },
  {
    id: 'loyalty-win-back-benefit',
    ruleType: 'WIN_BACK_BENEFIT',
    name: 'Inactive Connoisseur Win-Back Benefit (45/60/90 Days)',
    description:
      'Evaluates marketing consent for patrons with no completed purchase in 45/60/90 days and issues an approved win-back incentive.',
    isMonetaryBenefit: true,
    benefitType: 'PERCENTAGE_DISCOUNT',
    benefitValue: 15,
    minQualifyingOrderInr: 3499,
    requiresAdminApproval: true,
    approvalStatus: 'PENDING_APPROVAL',
    approvedBy: null,
    isActive: false,
    config: {
      inactivityTiersDays: [45, 60, 90],
      maxDiscountInr: 850
    }
  },
  {
    id: 'loyalty-bundle-recommendation',
    ruleType: 'BUNDLE_RECOMMENDATION',
    name: 'Signature Layering & Duo Coffret Recommendation',
    description:
      'Curated non-monetary olfactory pairing recommendation based on the customer’s favorite fragrance family (Woody, Amber, Floral, Fresh).',
    isMonetaryBenefit: false,
    benefitType: 'CURATED_BUNDLE_RECOMMENDATION',
    benefitValue: 0,
    minQualifyingOrderInr: 0,
    requiresAdminApproval: false,
    approvalStatus: 'APPROVED',
    approvedBy: 'gowisherharsha@gmail.com',
    isActive: true,
    config: {
      pairings: {
        AZURE: ['SOLARA', 'ÉLAN'],
        IGNITE: ['SUEDE', 'BLACK BACCARA'],
        ROSELLE: ['MYSTIC GARDEN', 'GOLDEN HOUR'],
        'GOLDEN HOUR': ['BLACK BACCARA', 'VELVET NIGHT']
      }
    }
  },
  {
    id: 'loyalty-gift-purchase-journey',
    ruleType: 'GIFT_PURCHASE_JOURNEY',
    name: 'White-Glove Gift Purchase & Recipient Journey',
    description:
      'Orchestrates gift-box calligraphy confirmation for the gifter and post-delivery fragrance care & discovery guidance for the recipient.',
    isMonetaryBenefit: false,
    benefitType: 'CONCIERGE_GIFT_EXPERIENCE',
    benefitValue: 0,
    minQualifyingOrderInr: 0,
    requiresAdminApproval: false,
    approvalStatus: 'APPROVED',
    approvedBy: 'gowisherharsha@gmail.com',
    isActive: true,
    config: {
      hidePriceOnPackingSlip: true,
      includeComplimentaryCalligraphyCard: true,
      triggerPostDeliveryCareGuide: true
    }
  }
];

// ============================================================================
// 1. INITIALIZATION & SYNCHRONIZATION
// ============================================================================

let isInitializingDiscovery = false;
let hasInitializedDiscovery = false;

export async function ensureDiscoveryLoyaltyAndCouponsInitialized() {
  if (isInitializingDiscovery || hasInitializedDiscovery) return;
  isInitializingDiscovery = true;
  try {
  // 1. Ensure Discovery Redemption Rules Config exists
  const existingConfig = await db
    .select()
    .from(loyaltyProgramsAndLedger)
    .where(eq(loyaltyProgramsAndLedger.id, 'discovery-redemption-rules-config'));

  if (existingConfig.length === 0) {
    await db
      .insert(loyaltyProgramsAndLedger)
      .values({
        id: 'discovery-redemption-rules-config',
        ruleType: 'DISCOVERY_REDEMPTION_CONFIG',
        name: 'Discovery Kit Full-Bottle Redemption Rules Engine',
        description:
          'Admin-configurable rules governing Discovery Six (2 ml & 8 ml) and future discovery kit redemptions toward full bottles.',
        isMonetaryBenefit: true,
        benefitType: 'DYNAMIC_REDEMPTION',
        benefitValue: DEFAULT_REDEMPTION_RULES.redemptionAmount2mlInr,
        minQualifyingOrderInr: DEFAULT_REDEMPTION_RULES.minOrderValueInr,
        requiresAdminApproval: true,
        approvalStatus: 'APPROVED',
        approvedBy: 'gowisherharsha@gmail.com',
        approvedAt: new Date(),
        isActive: true,
        conversionsCount: 0,
        attributedRevenueInr: 0,
        discountCostInr: 0,
        config: DEFAULT_REDEMPTION_RULES,
        executionsHistory: []
      })
      .onConflictDoNothing();
  } else {
    const cfg = (existingConfig[0].config || {}) as any;
    if (cfg.redemptionAmount8mlInr === 1999) {
      await db
        .update(loyaltyProgramsAndLedger)
        .set({
          config: { ...cfg, redemptionAmount2mlInr: 799, redemptionAmount8mlInr: 1299 }
        })
        .where(eq(loyaltyProgramsAndLedger.id, 'discovery-redemption-rules-config'));
    }
  }

  // 2. Ensure all 9 Loyalty Programs exist
  const existingPrograms = await db.select().from(loyaltyProgramsAndLedger);
  const existingIds = new Set(existingPrograms.map((p) => p.id));

  for (const prog of DEFAULT_LOYALTY_PROGRAMS) {
    if (!existingIds.has(prog.id)) {
      await db
        .insert(loyaltyProgramsAndLedger)
        .values({
          id: prog.id,
          ruleType: prog.ruleType,
          name: prog.name,
          description: prog.description,
          isMonetaryBenefit: prog.isMonetaryBenefit,
          benefitType: prog.benefitType,
          benefitValue: prog.benefitValue,
          minQualifyingOrderInr: prog.minQualifyingOrderInr,
          requiresAdminApproval: prog.requiresAdminApproval,
          approvalStatus: prog.approvalStatus,
          approvedBy: prog.approvedBy,
          approvedAt: prog.approvalStatus === 'APPROVED' ? new Date() : null,
          isActive: prog.isActive,
          conversionsCount: 0,
          attributedRevenueInr: 0,
          discountCostInr: 0,
          config: prog.config,
          executionsHistory: []
        })
        .onConflictDoNothing();
    }
  }

  // 3. Enrich existing coupons with full EnterpriseCouponMetadata if missing, and synchronize with live orders
  const allCoupons = await db.select().from(coupons);
  const allOrders = await db.select().from(orders);

  for (const cpn of allCoupons) {
    const existingMeta = (cpn.couponMetadata || {}) as Partial<EnterpriseCouponMetadata>;
    // Compute actual redemptions from paid orders matching this couponCode
    const matchingPaidOrders = allOrders.filter(
      (o) =>
        o.couponCode &&
        o.couponCode.toUpperCase() === cpn.code.toUpperCase() &&
        String(o.paymentStatus).toUpperCase() === 'PAID' &&
        String(o.orderStatus).toUpperCase() !== 'CANCELLED'
    );

    const redemptionHistory = matchingPaidOrders.map((ord) => {
      const orderAmt = Number(ord.totalAmount || 0);
      const discountApplied =
        Number(ord.discount || 0) > 0
          ? Number(ord.discount)
          : String(cpn.discountType).toUpperCase() === 'PERCENTAGE'
          ? Math.round(((orderAmt + cpn.value) * cpn.value) / 100)
          : Number(cpn.value || 0);
      const estCogs = Math.round((orderAmt + discountApplied) * 0.25);
      const netContribution = Math.max(0, orderAmt - estCogs);
      return {
        orderId: ord.id,
        orderNumber: ord.orderNumber,
        customerEmail: ord.customerEmail,
        orderAmountInr: orderAmt,
        discountAppliedInr: discountApplied,
        estimatedCogsInr: estCogs,
        netContributionMarginInr: netContribution,
        redeemedAt: ord.createdAt ? new Date(ord.createdAt).toISOString() : new Date().toISOString()
      };
    });

    const attributedRevenueInr = redemptionHistory.reduce((s, r) => s + r.orderAmountInr, 0);
    const totalDiscountCostInr = redemptionHistory.reduce((s, r) => s + r.discountAppliedInr, 0);
    const profitabilityEstimateInr = redemptionHistory.reduce(
      (s, r) => s + r.netContributionMarginInr,
      0
    );
    const netMarginPercent =
      attributedRevenueInr > 0
        ? Math.round((profitabilityEstimateInr / attributedRevenueInr) * 1000) / 10
        : 65;

    const updatedMeta: EnterpriseCouponMetadata = {
      campaignOwner: existingMeta.campaignOwner || 'FRAGMORÉ Growth & Retention Desk',
      budgetInr: Number(existingMeta.budgetInr ?? 50000),
      budgetUtilizedInr: totalDiscountCostInr,
      startDate: existingMeta.startDate || '2026-01-01',
      endDate: cpn.expiryDate || existingMeta.endDate || '2026-12-31',
      perCustomerLimit: Number(existingMeta.perCustomerLimit ?? 1),
      eligibleCustomerSegment: existingMeta.eligibleCustomerSegment || 'ALL',
      assignedCustomerEmail: existingMeta.assignedCustomerEmail || null,
      eligibleProducts: Array.isArray(existingMeta.eligibleProducts)
        ? existingMeta.eligibleProducts
        : ['ALL'],
      stackingRule: existingMeta.stackingRule || 'EXCLUSIVE',
      redemptionHistory:
        redemptionHistory.length > 0 ? redemptionHistory : existingMeta.redemptionHistory || [],
      attributedRevenueInr:
        redemptionHistory.length > 0
          ? attributedRevenueInr
          : Number(existingMeta.attributedRevenueInr ?? 0),
      totalDiscountCostInr:
        redemptionHistory.length > 0
          ? totalDiscountCostInr
          : Number(existingMeta.totalDiscountCostInr ?? 0),
      profitabilityEstimateInr:
        redemptionHistory.length > 0
          ? profitabilityEstimateInr
          : Number(existingMeta.profitabilityEstimateInr ?? 0),
      netMarginPercent,
      discoveryJourneyId: existingMeta.discoveryJourneyId || null,
      loyaltyRuleId: existingMeta.loyaltyRuleId || null,
      approvalStatus: existingMeta.approvalStatus || 'APPROVED'
    };

    if (!cpn.couponMetadata || matchingPaidOrders.length !== cpn.usageCount) {
      await db
        .update(coupons)
        .set({
          usageCount: Math.max(cpn.usageCount, matchingPaidOrders.length),
          couponMetadata: updatedMeta
        })
        .where(eq(coupons.code, cpn.code));
    }
  }

  // 4. Synchronize existing orders containing Discovery items into discoveryJourneys
  await syncExistingOrdersToDiscoveryJourneys();
  hasInitializedDiscovery = true;
  } finally {
    isInitializingDiscovery = false;
  }
}

export async function getDiscoveryRedemptionRules(): Promise<DiscoveryRedemptionRulesConfig> {
  const [row] = await db
    .select()
    .from(loyaltyProgramsAndLedger)
    .where(eq(loyaltyProgramsAndLedger.id, 'discovery-redemption-rules-config'));
  if (!row || !row.config) return DEFAULT_REDEMPTION_RULES;
  return {
    ...DEFAULT_REDEMPTION_RULES,
    ...(row.config as Partial<DiscoveryRedemptionRulesConfig>)
  };
}

export async function updateDiscoveryRedemptionRules(
  updates: Partial<DiscoveryRedemptionRulesConfig>,
  adminEmail = 'gowisherharsha@gmail.com'
): Promise<DiscoveryRedemptionRulesConfig> {
  const current = await getDiscoveryRedemptionRules();
  const nextConfig: DiscoveryRedemptionRulesConfig = {
    ...current,
    ...updates,
    updatedBy: adminEmail,
    updatedAt: new Date().toISOString()
  };

  await db
    .update(loyaltyProgramsAndLedger)
    .set({
      benefitValue: nextConfig.redemptionAmount2mlInr,
      minQualifyingOrderInr: nextConfig.minOrderValueInr,
      config: nextConfig,
      updatedAt: new Date()
    })
    .where(eq(loyaltyProgramsAndLedger.id, 'discovery-redemption-rules-config'));

  await db.insert(auditLogs).values({
    id: `aud-disc-rules-${Date.now()}`,
    action: 'DISCOVERY_REDEMPTION_RULES_UPDATED',
    adminEmail,
    details: `Updated Discovery Redemption Rules: 2ml=₹${nextConfig.redemptionAmount2mlInr}, 8ml=₹${nextConfig.redemptionAmount8mlInr}, MinOrder=₹${nextConfig.minOrderValueInr}, Validity=${nextConfig.validityDaysAfterDelivery}d, MinMargin=${nextConfig.minGrossMarginPercent}%`,
    metadata: nextConfig
  });

  return nextConfig;
}

// ============================================================================
// 2. ELIGIBLE FULL-BOTTLE PRODUCTS HELPER (CHECKS LIVE STOCK & CONFIG RULES)
// ============================================================================

export async function getEligibleFullBottleProducts(
  favoriteFragrance?: string | null
): Promise<
  Array<{
    productId: string;
    slug: string;
    name: string;
    collection: string;
    size: string;
    sku: string;
    priceInr: number;
    availableStock: number;
    isRecommendedFavorite: boolean;
  }>
> {
  const rules = await getDiscoveryRedemptionRules();
  const allProducts = await db.select().from(products);
  const allLedger = await db.select().from(inventoryLedger);
  const ledgerBySku = new Map<string, number>();
  for (const row of allLedger) {
    ledgerBySku.set(row.sku, Number(row.availableStock || 0));
  }

  const eligibleList: Array<{
    productId: string;
    slug: string;
    name: string;
    collection: string;
    size: string;
    sku: string;
    priceInr: number;
    availableStock: number;
    isRecommendedFavorite: boolean;
  }> = [];

  for (const prod of allProducts) {
    if (String(prod.status).toUpperCase() !== 'ACTIVE') continue;
    const isDiscoveryProd =
      prod.slug.toLowerCase().includes('discovery') ||
      prod.name.toLowerCase().includes('discovery') ||
      String(prod.collection).toLowerCase().includes('discovery');
    if (isDiscoveryProd) continue;

    const allowAll =
      rules.eligibleProductSlugs.includes('ALL_FULL_BOTTLES') ||
      rules.eligibleProductSlugs.includes('ALL');
    if (
      !allowAll &&
      !rules.eligibleProductSlugs.includes(prod.slug) &&
      !rules.eligibleProductSlugs.includes(prod.id)
    ) {
      continue;
    }

    const variants: any[] = Array.isArray(prod.variants) ? prod.variants : [];
    for (const v of variants) {
      const sizeStr = String(v.size || '50 ml');
      if (
        rules.eligibleBottleSizes.length > 0 &&
        !rules.eligibleBottleSizes.some(
          (allowed) => allowed.toLowerCase() === sizeStr.toLowerCase()
        )
      ) {
        continue;
      }
      const sku = String(v.sku || `FRG-${prod.id}-${sizeStr.replace(/\s+/g, '')}`);
      const stock = ledgerBySku.has(sku)
        ? ledgerBySku.get(sku)!
        : Number(v.stockAvailable ?? v.stock ?? 25);

      if (rules.requireProductInStock && stock <= 0) {
        continue;
      }

      const isRecommendedFavorite = Boolean(
        favoriteFragrance &&
          prod.name.toLowerCase().includes(favoriteFragrance.trim().toLowerCase())
      );

      eligibleList.push({
        productId: prod.id,
        slug: prod.slug,
        name: prod.name,
        collection: prod.collection,
        size: sizeStr,
        sku,
        priceInr: Number(v.price || 3899),
        availableStock: stock,
        isRecommendedFavorite
      });
    }
  }

  // Sort recommended favorite fragrance to the top
  return eligibleList.sort((a, b) =>
    a.isRecommendedFavorite === b.isRecommendedFavorite ? 0 : a.isRecommendedFavorite ? -1 : 1
  );
}

// ============================================================================
// 3. DISCOVERY PURCHASE JOURNEY LIFECYCLE (STEPS 1 TO 10)
// ============================================================================

export async function syncExistingOrdersToDiscoveryJourneys() {
  const allOrders = await db.select().from(orders);
  const existingJourneys = await db.select().from(discoveryJourneys);
  const journeyByOrderId = new Map(existingJourneys.map((j) => [j.orderId, j]));

  for (const ord of allOrders) {
    if (journeyByOrderId.has(ord.id)) continue;
    const items: any[] = Array.isArray(ord.items) ? ord.items : [];
    const discoveryItem = items.find((item) => {
      const name = String(item.productName || item.name || '').toLowerCase();
      const size = String(item.size || '').toLowerCase();
      return (
        name.includes('discovery') ||
        name.includes('sample') ||
        name.includes('trio') ||
        name.includes('quartet') ||
        size.includes('2 ml') ||
        size.includes('2ml') ||
        size.includes('8 ml') ||
        size.includes('8ml')
      );
    });

    if (discoveryItem && String(ord.paymentStatus).toUpperCase() === 'PAID') {
      await registerDiscoveryPurchase({
        orderId: ord.id,
        orderNumber: ord.orderNumber,
        customerId: ord.customerId,
        customerName: ord.customerName,
        customerEmail: ord.customerEmail,
        customerPhone: ord.customerPhone,
        sizeVariant: String(discoveryItem.size || '').includes('8') ? '8 ml' : '2 ml',
        netDiscoveryPriceInr: Number(discoveryItem.price || ord.totalAmount || 999),
        orderStatus: ord.orderStatus,
        createdAtIso: ord.createdAt ? new Date(ord.createdAt).toISOString() : undefined
      });
    }
  }
}

export async function registerDiscoveryPurchase(params: {
  orderId: string;
  orderNumber: string;
  customerId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  configurationCode?: string;
  sizeVariant?: '2 ml' | '8 ml';
  netDiscoveryPriceInr?: number;
  orderStatus?: string;
  createdAtIso?: string;
}) {
  const rules = await getDiscoveryRedemptionRules();
  const configs = rules.supportedConfigurations || DEFAULT_DISCOVERY_CONFIGURATIONS;

  const matchedConfig =
    configs.find((c) => c.code === params.configurationCode && c.isApproved) ||
    configs.find((c) => c.vialSize === (params.sizeVariant || '2 ml') && c.isApproved) ||
    DEFAULT_DISCOVERY_CONFIGURATIONS[0];

  const nowIso = params.createdAtIso || new Date().toISOString();
  const cohortMonth = nowIso.slice(0, 7); // YYYY-MM

  // Step 1: Tag customer as 'Discovery Buyer' in customers table
  const existingCustomers = await db
    .select()
    .from(customers)
    .where(eq(customers.email, params.customerEmail));

  let customerId = params.customerId || `cust-${Date.now()}`;
  if (existingCustomers.length > 0) {
    const cust = existingCustomers[0];
    customerId = cust.id;
    const currentTags: string[] = Array.isArray(cust.tags) ? [...(cust.tags as string[])] : [];
    if (!currentTags.includes('Discovery Buyer')) {
      currentTags.push('Discovery Buyer');
    }
    if (!currentTags.includes('Discovery Buyers')) {
      currentTags.push('Discovery Buyers');
    }
    const crmMeta: any = cust.crmMetadata || {};
    await db
      .update(customers)
      .set({
        tags: currentTags,
        crmMetadata: {
          ...crmMeta,
          isDiscoveryBuyer: true,
          lastDiscoveryConfiguration: matchedConfig.code,
          lastDiscoveryOrderNumber: params.orderNumber
        }
      })
      .where(eq(customers.id, cust.id));
  }

  // Step 2 & 3: Identify purchased discovery configuration & record delivery status
  const isAlreadyDelivered = String(params.orderStatus || '').toUpperCase() === 'DELIVERED';
  const deliveryStatus = isAlreadyDelivered
    ? 'DELIVERED'
    : String(params.orderStatus || '').toUpperCase() === 'SHIPPED'
    ? 'IN_TRANSIT'
    : 'AWAITING_DISPATCH';

  // Step 4: Start the discovery customer journey ONLY after confirmed delivery
  const journeyStatus = isAlreadyDelivered ? 'EDUCATION_SENT' : 'AWAITING_DELIVERY';

  const eligibleProducts = await getEligibleFullBottleProducts(null);

  const timeline: Array<{
    stage: string;
    timestamp: string;
    details: string;
    channel?: string;
  }> = [
    {
      stage: 'DISCOVERY_PURCHASE_VERIFIED',
      timestamp: nowIso,
      details: `Customer tagged as Discovery Buyer. Configuration: ${matchedConfig.name} (${matchedConfig.vialSize}). Delivery status: ${deliveryStatus}.`
    }
  ];

  if (isAlreadyDelivered) {
    timeline.push({
      stage: 'DELIVERY_CONFIRMED_JOURNEY_STARTED',
      timestamp: nowIso,
      details:
        'Confirmed delivery verified. Discovery customer journey started; fragrance education & skin-testing ritual guide dispatched.'
    });
  } else {
    timeline.push({
      stage: 'HOLD_UNTIL_CONFIRMED_DELIVERY',
      timestamp: nowIso,
      details:
        'Discovery journey held in AWAITING_DELIVERY state. Fragrance education and redemption benefit will only trigger after verified carrier/admin delivery.'
    });
  }

  const journeyId = `disc-jrn-${params.orderId}`;
  const netPrice = Number(params.netDiscoveryPriceInr ?? matchedConfig.defaultPriceInr);

  const [savedJourney] = await db
    .insert(discoveryJourneys)
    .values({
      id: journeyId,
      orderId: params.orderId,
      orderNumber: params.orderNumber,
      customerId,
      customerEmail: params.customerEmail,
      customerName: params.customerName,
      customerPhone: params.customerPhone || '',
      configurationCode: matchedConfig.code,
      configurationName: matchedConfig.name,
      vialSize: matchedConfig.vialSize,
      vialCount: matchedConfig.vialCount,
      includedFragrances: matchedConfig.includedFragrances,
      netDiscoveryPriceInr: netPrice,
      deliveryStatus,
      deliveredAt: isAlreadyDelivered ? new Date(nowIso) : null,
      journeyStatus,
      selectedFavoriteFragrance: null,
      favoriteSelectedAt: null,
      issuedVoucherCode: null,
      voucherAmountInr: 0,
      voucherIssuedAt: null,
      voucherExpiresAt: null,
      voucherStatus: 'NOT_ISSUED',
      eligibleFullBottleProducts: eligibleProducts.slice(0, 8),
      upgradedOrderId: null,
      upgradedOrderNumber: null,
      upgradedProductName: null,
      upgradedSize: null,
      upgradeNetRevenueInr: 0,
      upgradeContributionMarginInr: 0,
      upgradedAt: null,
      daysToUpgrade: null,
      cohortMonth,
      journeyTimeline: timeline
    })
    .onConflictDoUpdate({
      target: discoveryJourneys.id,
      set: {
        deliveryStatus,
        journeyStatus,
        eligibleFullBottleProducts: eligibleProducts.slice(0, 8),
        journeyTimeline: timeline,
        updatedAt: new Date()
      }
    })
    .returning();

  try {
    await recalculateCustomerLifecycleState(params.customerEmail);
  } catch {}

  return savedJourney;
}

// Step 4, 5 & 6: Confirm delivery -> start journey -> send fragrance education -> invite favorite selection
export async function confirmDiscoveryDeliveryAndStartJourney(params: {
  journeyId: string;
  verificationSource: 'TRUSTED_CARRIER_WEBHOOK' | 'AUTHORIZED_ADMIN_CONFIRMATION' | 'UNVERIFIED_PING';
  channel?: 'EMAIL' | 'WHATSAPP';
  actor?: string;
}): Promise<{
  success: boolean;
  reason: string;
  journey?: any;
}> {
  const [journey] = await db
    .select()
    .from(discoveryJourneys)
    .where(eq(discoveryJourneys.id, params.journeyId));

  if (!journey) {
    return { success: false, reason: 'Discovery journey record not found.' };
  }

  if (
    params.verificationSource !== 'TRUSTED_CARRIER_WEBHOOK' &&
    params.verificationSource !== 'AUTHORIZED_ADMIN_CONFIRMATION'
  ) {
    return {
      success: false,
      reason:
        'Guard Blocked: Discovery customer journey cannot start until delivery is verified through a trusted carrier status or authorized Admin confirmation.'
    };
  }

  if (journey.deliveryStatus === 'RETURNED_OR_CANCELLED') {
    return {
      success: false,
      reason: 'Cannot start discovery journey for a returned or cancelled order.'
    };
  }

  const nowIso = new Date().toISOString();
  const channel = params.channel || 'EMAIL';
  const timeline = Array.isArray(journey.journeyTimeline) ? [...journey.journeyTimeline] : [];

  timeline.push(
    {
      stage: 'DELIVERY_CONFIRMED',
      timestamp: nowIso,
      details: `Delivery verified via ${params.verificationSource} by ${params.actor || 'System'}. Starting Discovery Customer Journey.`
    },
    {
      stage: 'FRAGRANCE_EDUCATION_SENT',
      timestamp: nowIso,
      channel,
      details: `Sent Olfactory Ritual & Skin-Wear Guidance for ${journey.configurationName} (${(journey.includedFragrances as string[]).join(', ')}) via permitted ${channel}.`
    },
    {
      stage: 'FAVORITE_FRAGRANCE_INVITATION_SENT',
      timestamp: nowIso,
      channel,
      details: `Invited ${journey.customerName} to select their favorite fragrance from the ${journey.vialSize} vials to unlock their eligible full-bottle redemption benefit.`
    }
  );

  // Also log communication to customer history if customer exists
  const [cust] = await db
    .select()
    .from(customers)
    .where(eq(customers.email, journey.customerEmail));
  if (cust) {
    const commHist: any[] = Array.isArray(cust.communicationHistory)
      ? [...cust.communicationHistory]
      : [];
    commHist.unshift({
      id: `msg-disc-edu-${Date.now()}`,
      date: nowIso.slice(0, 10),
      channel,
      type: 'TRANSACTIONAL',
      subject: `Your ${journey.configurationName} Has Arrived — Olfactory Wearing Guide & Favorite Selection`,
      status: 'DELIVERED',
      complianceNote: 'Post-delivery Discovery Education & Favorite Fragrance Invitation'
    });
    await db
      .update(customers)
      .set({ communicationHistory: commHist.slice(0, 100) })
      .where(eq(customers.id, cust.id));
  }

  const [updated] = await db
    .update(discoveryJourneys)
    .set({
      deliveryStatus: 'DELIVERED',
      deliveredAt: journey.deliveredAt || new Date(),
      journeyStatus: 'FAVORITE_INVITED',
      journeyTimeline: timeline,
      updatedAt: new Date()
    })
    .where(eq(discoveryJourneys.id, journey.id))
    .returning();

  return {
    success: true,
    reason:
      'Delivery confirmed, discovery journey started, fragrance education dispatched, and favorite fragrance invitation sent.',
    journey: updated
  };
}

// Step 6, 7 & 8: Customer selects favorite fragrance -> Evaluate redemption eligibility rules -> Issue customer-specific voucher & display eligible full bottles
export async function selectFavoriteFragranceAndIssueRedemptionBenefit(params: {
  journeyId: string;
  selectedFavoriteFragrance: string;
  issueRedemptionVoucher?: boolean;
  actor?: string;
}): Promise<{
  success: boolean;
  voucherIssued: boolean;
  reason: string;
  voucherCode?: string | null;
  voucherAmountInr?: number;
  eligibleFullBottles?: any[];
  journey?: any;
}> {
  const [journey] = await db
    .select()
    .from(discoveryJourneys)
    .where(eq(discoveryJourneys.id, params.journeyId));

  if (!journey) {
    return {
      success: false,
      voucherIssued: false,
      reason: 'Discovery journey not found.'
    };
  }

  // Enforce Rule #4: Cannot start journey or issue redemption benefit before confirmed delivery!
  if (journey.deliveryStatus !== 'DELIVERED') {
    return {
      success: false,
      voucherIssued: false,
      reason:
        'Guard Blocked: Discovery journey and redemption benefits can only be activated after confirmed delivery of the discovery kit.'
    };
  }

  if (
    journey.journeyStatus === 'SUPPRESSED_REFUNDED' ||
    journey.voucherStatus === 'REVOKED_ON_REFUND'
  ) {
    return {
      success: false,
      voucherIssued: false,
      reason: 'Guard Blocked: Discovery order was refunded or cancelled; voucher issuance is prohibited.'
    };
  }

  const rules = await getDiscoveryRedemptionRules();

  // Check one redemption per qualifying discovery purchase
  if (
    rules.oneRedemptionPerDiscoveryOrder &&
    journey.issuedVoucherCode &&
    (journey.voucherStatus === 'ACTIVE' || journey.voucherStatus === 'REDEEMED')
  ) {
    const eligibleBottles = await getEligibleFullBottleProducts(params.selectedFavoriteFragrance);
    return {
      success: true,
      voucherIssued: false,
      reason: `Favorite fragrance updated to ${params.selectedFavoriteFragrance}. Existing voucher ${journey.issuedVoucherCode} remains active (One redemption per qualifying discovery purchase enforced).`,
      voucherCode: journey.issuedVoucherCode,
      voucherAmountInr: journey.voucherAmountInr,
      eligibleFullBottles: eligibleBottles,
      journey
    };
  }

  const nowIso = new Date().toISOString();
  const favorite = params.selectedFavoriteFragrance.trim().toUpperCase();
  const eligibleFullBottles = await getEligibleFullBottleProducts(favorite);

  // Update customer favorite fragrance in Customer 360
  await db
    .update(customers)
    .set({ favouriteFragrance: favorite })
    .where(eq(customers.email, journey.customerEmail));

  // Calculate dynamic redemption amount from Admin-configured rules (NEVER hardcoded!)
  let redemptionAmountInr = 0;
  if (rules.redemptionCalculationMode === 'FULL_DISCOVERY_NET_PRICE') {
    redemptionAmountInr = Number(journey.netDiscoveryPriceInr || 0);
  } else if (rules.redemptionCalculationMode === 'CONFIGURED_PERCENTAGE') {
    const refBottlePrice = eligibleFullBottles[0]?.priceInr || rules.minOrderValueInr;
    redemptionAmountInr = Math.round((refBottlePrice * rules.redemptionPercentage) / 100);
  } else {
    redemptionAmountInr =
      journey.vialSize === '8 ml'
        ? Number(rules.redemptionAmount8mlInr)
        : Number(rules.redemptionAmount2mlInr);
  }

  // Gross-margin safeguard check before issuing voucher
  const maxEligibleBottlePrice = Math.max(
    rules.minOrderValueInr,
    ...eligibleFullBottles.map((b) => Number(b.priceInr || 0)),
    4999
  );
  const netRevenueAfterVoucher = maxEligibleBottlePrice - redemptionAmountInr;
  const estimatedCogsInr = Math.round(maxEligibleBottlePrice * (rules.estimatedCogsPercent / 100));
  const projectedGrossMarginPercent =
    maxEligibleBottlePrice > 0
      ? Math.round(((netRevenueAfterVoucher - estimatedCogsInr) / maxEligibleBottlePrice) * 1000) /
        10
      : 0;

  const timeline = Array.isArray(journey.journeyTimeline) ? [...journey.journeyTimeline] : [];
  timeline.push({
    stage: 'FAVORITE_FRAGRANCE_SELECTED',
    timestamp: nowIso,
    details: `Customer selected "${favorite}" as their favorite fragrance. Displayed ${eligibleFullBottles.length} in-stock eligible full-bottle options.`
  });

  if (params.issueRedemptionVoucher === false) {
    const [updatedOnlyFav] = await db
      .update(discoveryJourneys)
      .set({
        selectedFavoriteFragrance: favorite,
        favoriteSelectedAt: new Date(),
        journeyStatus: 'FAVORITE_SELECTED',
        eligibleFullBottleProducts: eligibleFullBottles.slice(0, 8),
        journeyTimeline: timeline,
        updatedAt: new Date()
      })
      .where(eq(discoveryJourneys.id, journey.id))
      .returning();

    return {
      success: true,
      voucherIssued: false,
      reason: `Recorded favorite fragrance "${favorite}".`,
      eligibleFullBottles,
      journey: updatedOnlyFav
    };
  }

  if (projectedGrossMarginPercent < rules.minGrossMarginPercent) {
    timeline.push({
      stage: 'REDEMPTION_VOUCHER_BLOCKED_BY_MARGIN_GUARD',
      timestamp: nowIso,
      details: `Gross-margin safeguard blocked voucher issuance: Projected margin ${projectedGrossMarginPercent}% is below minimum required ${rules.minGrossMarginPercent}%.`
    });
    const [blockedJourney] = await db
      .update(discoveryJourneys)
      .set({
        selectedFavoriteFragrance: favorite,
        favoriteSelectedAt: new Date(),
        voucherStatus: 'BLOCKED_BY_GUARD',
        eligibleFullBottleProducts: eligibleFullBottles.slice(0, 8),
        journeyTimeline: timeline,
        updatedAt: new Date()
      })
      .where(eq(discoveryJourneys.id, journey.id))
      .returning();

    return {
      success: false,
      voucherIssued: false,
      reason: `Gross-margin safeguard blocked voucher: Projected margin (${projectedGrossMarginPercent}%) is below configured minimum (${rules.minGrossMarginPercent}%).`,
      eligibleFullBottles,
      journey: blockedJourney
    };
  }

  if (rules.requireProductInStock && eligibleFullBottles.length === 0) {
    return {
      success: false,
      voucherIssued: false,
      reason: 'Product availability guard: No eligible full-bottle products are currently in stock.'
    };
  }

  // Generate customer-specific single-use voucher code
  const cleanCustFragment = journey.customerName
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase()
    .slice(0, 4);
  const voucherCode = `DISC-${cleanCustFragment}-${journey.orderNumber.slice(-4)}-${Date.now()
    .toString(36)
    .toUpperCase()
    .slice(-3)}`;

  const expiresDate = new Date(
    Date.now() + rules.validityDaysAfterDelivery * 24 * 60 * 60 * 1000
  );
  const expiryDateStr = expiresDate.toISOString().slice(0, 10);

  const couponMetadata: EnterpriseCouponMetadata = {
    campaignOwner: 'Discovery-to-Full-Bottle Automation Engine',
    budgetInr: redemptionAmountInr,
    budgetUtilizedInr: 0,
    startDate: nowIso.slice(0, 10),
    endDate: expiryDateStr,
    perCustomerLimit: 1,
    eligibleCustomerSegment: 'Discovery Buyers',
    assignedCustomerEmail: rules.customerSpecificVoucherBinding ? journey.customerEmail : null,
    eligibleProducts: rules.eligibleProductSlugs,
    stackingRule: rules.allowStackingWithOtherCoupons ? 'STACKABLE_WITH_ALL' : 'EXCLUSIVE',
    redemptionHistory: [],
    attributedRevenueInr: 0,
    totalDiscountCostInr: 0,
    profitabilityEstimateInr: 0,
    netMarginPercent: projectedGrossMarginPercent,
    discoveryJourneyId: journey.id,
    loyaltyRuleId: 'discovery-redemption-rules-config',
    approvalStatus: 'APPROVED'
  };

  await db.insert(coupons).values({
    code: voucherCode,
    discountType: 'DISCOVERY_VOUCHER',
    value: redemptionAmountInr,
    minOrderValue: rules.minOrderValueInr,
    maxDiscount: redemptionAmountInr,
    expiryDate: expiryDateStr,
    usageLimit: 1,
    usageCount: 0,
    isActive: true,
    description: `Discovery ${journey.vialSize} Redemption Voucher for ${journey.customerName} (Favorite: ${favorite})`,
    couponMetadata
  });

  timeline.push({
    stage: 'REDEMPTION_VOUCHER_ISSUED',
    timestamp: nowIso,
    details: `Issued customer-specific voucher ${voucherCode} (₹${redemptionAmountInr} off min order ₹${rules.minOrderValueInr}, valid until ${expiryDateStr}). Projected gross margin: ${projectedGrossMarginPercent}%.`
  });

  const [updatedJourney] = await db
    .update(discoveryJourneys)
    .set({
      selectedFavoriteFragrance: favorite,
      favoriteSelectedAt: new Date(),
      journeyStatus: 'VOUCHER_ISSUED',
      issuedVoucherCode: voucherCode,
      voucherAmountInr: redemptionAmountInr,
      voucherIssuedAt: new Date(),
      voucherExpiresAt: expiresDate,
      voucherStatus: 'ACTIVE',
      eligibleFullBottleProducts: eligibleFullBottles.slice(0, 8),
      journeyTimeline: timeline,
      updatedAt: new Date()
    })
    .where(eq(discoveryJourneys.id, journey.id))
    .returning();

  return {
    success: true,
    voucherIssued: true,
    reason: `Favorite fragrance "${favorite}" recorded and customer-specific voucher ${voucherCode} (₹${redemptionAmountInr}) issued.`,
    voucherCode,
    voucherAmountInr: redemptionAmountInr,
    eligibleFullBottles,
    journey: updatedJourney
  };
}

// Step 9 & 10: Track voucher usage and upgrade revenue -> End or modify the journey after conversion
export async function redeemDiscoveryVoucherOnFullBottleUpgrade(params: {
  voucherCode: string;
  customerEmail: string;
  orderId: string;
  orderNumber: string;
  productName: string;
  bottleSize: string;
  sku?: string;
  grossOrderAmountInr: number;
  otherCouponsApplied?: string[];
}): Promise<{
  success: boolean;
  reason: string;
  discountAppliedInr?: number;
  netUpgradeRevenueInr?: number;
  upgradeContributionMarginInr?: number;
  journey?: any;
}> {
  const rules = await getDiscoveryRedemptionRules();
  const [cpn] = await db
    .select()
    .from(coupons)
    .where(eq(coupons.code, params.voucherCode.toUpperCase()));

  if (!cpn || !cpn.isActive) {
    return {
      success: false,
      reason: 'Voucher code is invalid, inactive, or already redeemed.'
    };
  }

  const cpnMeta = (cpn.couponMetadata || {}) as Partial<EnterpriseCouponMetadata>;

  // 1. Customer-specific voucher binding check
  if (
    rules.customerSpecificVoucherBinding &&
    cpnMeta.assignedCustomerEmail &&
    cpnMeta.assignedCustomerEmail.toLowerCase() !== params.customerEmail.toLowerCase()
  ) {
    return {
      success: false,
      reason: `Security Guard: Voucher ${cpn.code} is bound exclusively to ${cpnMeta.assignedCustomerEmail} and cannot be redeemed by ${params.customerEmail}.`
    };
  }

  // 2. One redemption per qualifying discovery purchase check
  if (cpn.usageCount >= (cpn.usageLimit || 1)) {
    return {
      success: false,
      reason: `Voucher ${cpn.code} has already been redeemed (One redemption per qualifying discovery purchase enforced).`
    };
  }

  // 3. Validity period check
  if (cpn.expiryDate && new Date(cpn.expiryDate).getTime() + 86400000 < Date.now()) {
    return {
      success: false,
      reason: `Voucher ${cpn.code} expired on ${cpn.expiryDate}.`
    };
  }

  // 4. Stacking rules check
  if (
    !rules.allowStackingWithOtherCoupons &&
    params.otherCouponsApplied &&
    params.otherCouponsApplied.length > 0
  ) {
    return {
      success: false,
      reason: `Voucher stacking guard: Discovery voucher ${cpn.code} cannot be stacked with other promotional codes (${params.otherCouponsApplied.join(', ')}).`
    };
  }

  // 5. Minimum order value check
  const minRequired = Math.max(Number(cpn.minOrderValue || 0), rules.minOrderValueInr);
  if (params.grossOrderAmountInr < minRequired) {
    return {
      success: false,
      reason: `Order value ₹${params.grossOrderAmountInr} is below the minimum qualifying full-bottle order value of ₹${minRequired}.`
    };
  }

  // 6. Product availability check
  if (rules.requireProductInStock && params.sku) {
    const [ledgerRow] = await db
      .select()
      .from(inventoryLedger)
      .where(eq(inventoryLedger.sku, params.sku));
    if (ledgerRow && Number(ledgerRow.availableStock) <= 0) {
      return {
        success: false,
        reason: `Product availability guard: SKU ${params.sku} is currently out of stock.`
      };
    }
  }

  const discountAppliedInr = Number(cpn.value || 0);
  const netUpgradeRevenueInr = Math.max(0, params.grossOrderAmountInr - discountAppliedInr);
  const estimatedCogsInr = Math.round(
    params.grossOrderAmountInr * (rules.estimatedCogsPercent / 100)
  );
  const upgradeContributionMarginInr = Math.max(0, netUpgradeRevenueInr - estimatedCogsInr);
  const marginPercent =
    params.grossOrderAmountInr > 0
      ? Math.round((upgradeContributionMarginInr / params.grossOrderAmountInr) * 1000) / 10
      : 0;

  // 7. Gross-margin safeguard check
  if (marginPercent < rules.minGrossMarginPercent) {
    return {
      success: false,
      reason: `Gross-margin safeguard blocked redemption: Resulting margin ${marginPercent}% is below minimum threshold ${rules.minGrossMarginPercent}%.`
    };
  }

  const nowIso = new Date().toISOString();

  // Update coupon redemption history & mark single-use voucher used
  const nextHistory = Array.isArray(cpnMeta.redemptionHistory)
    ? [...cpnMeta.redemptionHistory]
    : [];
  nextHistory.unshift({
    orderId: params.orderId,
    orderNumber: params.orderNumber,
    customerEmail: params.customerEmail,
    orderAmountInr: netUpgradeRevenueInr,
    discountAppliedInr,
    estimatedCogsInr,
    netContributionMarginInr: upgradeContributionMarginInr,
    redeemedAt: nowIso
  });

  await db
    .update(coupons)
    .set({
      usageCount: cpn.usageCount + 1,
      isActive: false, // Single-use discovery voucher consumed
      couponMetadata: {
        ...cpnMeta,
        budgetUtilizedInr: Number(cpnMeta.budgetUtilizedInr || 0) + discountAppliedInr,
        redemptionHistory: nextHistory,
        attributedRevenueInr: Number(cpnMeta.attributedRevenueInr || 0) + netUpgradeRevenueInr,
        totalDiscountCostInr: Number(cpnMeta.totalDiscountCostInr || 0) + discountAppliedInr,
        profitabilityEstimateInr:
          Number(cpnMeta.profitabilityEstimateInr || 0) + upgradeContributionMarginInr,
        netMarginPercent: marginPercent
      }
    })
    .where(eq(coupons.code, cpn.code));

  // Locate and complete the Discovery Journey
  let updatedJourney: any = null;
  if (cpnMeta.discoveryJourneyId) {
    const [journey] = await db
      .select()
      .from(discoveryJourneys)
      .where(eq(discoveryJourneys.id, cpnMeta.discoveryJourneyId));

    if (journey) {
      const deliveredTime = journey.deliveredAt
        ? new Date(journey.deliveredAt).getTime()
        : new Date(journey.createdAt).getTime();
      const daysToUpgrade =
        Math.round(((Date.now() - deliveredTime) / (1000 * 60 * 60 * 24)) * 10) / 10;

      const timeline = Array.isArray(journey.journeyTimeline) ? [...journey.journeyTimeline] : [];
      timeline.push({
        stage: 'CONVERTED_TO_FULL_BOTTLE_JOURNEY_COMPLETED',
        timestamp: nowIso,
        details: `Customer redeemed ${cpn.code} on Order ${params.orderNumber} for ${params.productName} (${params.bottleSize}). Net Upgrade Revenue: ₹${netUpgradeRevenueInr}. Contribution Margin: ₹${upgradeContributionMarginInr}. Discovery follow-up sequence ended.`
      });

      const [saved] = await db
        .update(discoveryJourneys)
        .set({
          journeyStatus: 'CONVERTED_TO_FULL_BOTTLE',
          voucherStatus: 'REDEEMED',
          upgradedOrderId: params.orderId,
          upgradedOrderNumber: params.orderNumber,
          upgradedProductName: params.productName,
          upgradedSize: params.bottleSize,
          upgradeNetRevenueInr: netUpgradeRevenueInr,
          upgradeContributionMarginInr,
          upgradedAt: new Date(),
          daysToUpgrade: Math.max(0.1, daysToUpgrade),
          journeyTimeline: timeline,
          updatedAt: new Date()
        })
        .where(eq(discoveryJourneys.id, journey.id))
        .returning();

      updatedJourney = saved;
    }
  }

  return {
    success: true,
    reason: `Discovery voucher ${cpn.code} redeemed. Upgrade order ${params.orderNumber} recorded (Net Revenue: ₹${netUpgradeRevenueInr}, Margin: ₹${upgradeContributionMarginInr}). Discovery journey completed.`,
    discountAppliedInr,
    netUpgradeRevenueInr,
    upgradeContributionMarginInr,
    journey: updatedJourney
  };
}

// Refund & cancellation handling: Revoke discovery voucher if discovery order is refunded/cancelled
export async function revokeDiscoveryBenefitOnRefundOrCancel(params: {
  journeyId: string;
  reason: string;
  actor?: string;
}) {
  const [journey] = await db
    .select()
    .from(discoveryJourneys)
    .where(eq(discoveryJourneys.id, params.journeyId));

  if (!journey) {
    return { success: false, reason: 'Discovery journey not found.' };
  }

  const nowIso = new Date().toISOString();
  if (journey.issuedVoucherCode) {
    await db
      .update(coupons)
      .set({ isActive: false })
      .where(eq(coupons.code, journey.issuedVoucherCode));
  }

  const timeline = Array.isArray(journey.journeyTimeline) ? [...journey.journeyTimeline] : [];
  timeline.push({
    stage: 'VOUCHER_REVOKED_ON_REFUND_OR_CANCEL',
    timestamp: nowIso,
    details: `Discovery order refunded/cancelled (${params.reason}). Issued voucher ${journey.issuedVoucherCode || 'N/A'} revoked and journey suppressed.`
  });

  const [updated] = await db
    .update(discoveryJourneys)
    .set({
      deliveryStatus: 'RETURNED_OR_CANCELLED',
      journeyStatus: 'SUPPRESSED_REFUNDED',
      voucherStatus: 'REVOKED_ON_REFUND',
      netDiscoveryPriceInr: 0,
      journeyTimeline: timeline,
      updatedAt: new Date()
    })
    .where(eq(discoveryJourneys.id, journey.id))
    .returning();

  return {
    success: true,
    reason: `Discovery journey suppressed and voucher ${journey.issuedVoucherCode || ''} revoked due to refund/cancellation.`,
    journey: updated
  };
}

// ============================================================================
// 4. LOYALTY AUTOMATION ENGINE (WITH MONETARY APPROVAL GOVERNANCE)
// ============================================================================

export async function approveOrToggleLoyaltyProgram(params: {
  programId: string;
  action: 'APPROVE' | 'REJECT' | 'ACTIVATE' | 'PAUSE' | 'UPDATE_CONFIG';
  adminEmail?: string;
  benefitValue?: number;
  minQualifyingOrderInr?: number;
  configUpdates?: Record<string, any>;
}): Promise<{
  success: boolean;
  reason: string;
  program?: any;
}> {
  await ensureDiscoveryLoyaltyAndCouponsInitialized();
  const [prog] = await db
    .select()
    .from(loyaltyProgramsAndLedger)
    .where(eq(loyaltyProgramsAndLedger.id, params.programId));

  if (!prog) {
    return { success: false, reason: 'Loyalty program not found.' };
  }

  const adminEmail = params.adminEmail || 'gowisherharsha@gmail.com';

  // Governance Rule: Do not activate monetary benefits without Admin approval!
  if (params.action === 'ACTIVATE' && prog.isMonetaryBenefit && prog.approvalStatus !== 'APPROVED') {
    await db.insert(automationApprovals).values({
      id: `appr-loy-${Date.now()}`,
      workflowId: prog.id,
      workflowName: prog.name,
      actionType: 'HIGH_VALUE_DISCOUNT',
      requestedBy: adminEmail,
      reason: `Activation requested for monetary loyalty benefit "${prog.name}" (Value: ${prog.benefitValue}, Type: ${prog.benefitType})`,
      payload: { programId: prog.id, benefitValue: prog.benefitValue },
      status: 'PENDING'
    });

    return {
      success: false,
      reason: `Governance Guard: Monetary benefit "${prog.name}" cannot be activated until its approval status is APPROVED by Super Admin. Approval request queued.`
    };
  }

  let nextApprovalStatus = prog.approvalStatus;
  let nextIsActive = prog.isActive;
  let approvedBy = prog.approvedBy;
  let approvedAt = prog.approvedAt;

  if (params.action === 'APPROVE') {
    nextApprovalStatus = 'APPROVED';
    nextIsActive = true;
    approvedBy = adminEmail;
    approvedAt = new Date();
  } else if (params.action === 'REJECT') {
    nextApprovalStatus = 'REJECTED';
    nextIsActive = false;
  } else if (params.action === 'ACTIVATE') {
    nextIsActive = true;
  } else if (params.action === 'PAUSE') {
    nextIsActive = false;
  }

  const nextBenefitValue =
    params.benefitValue !== undefined ? Number(params.benefitValue) : prog.benefitValue;
  const nextMinOrder =
    params.minQualifyingOrderInr !== undefined
      ? Number(params.minQualifyingOrderInr)
      : prog.minQualifyingOrderInr;
  const nextConfig = params.configUpdates
    ? { ...(prog.config as object), ...params.configUpdates }
    : prog.config;

  const [updated] = await db
    .update(loyaltyProgramsAndLedger)
    .set({
      approvalStatus: nextApprovalStatus,
      approvedBy,
      approvedAt,
      isActive: nextIsActive,
      benefitValue: nextBenefitValue,
      minQualifyingOrderInr: nextMinOrder,
      config: nextConfig,
      updatedAt: new Date()
    })
    .where(eq(loyaltyProgramsAndLedger.id, prog.id))
    .returning();

  return {
    success: true,
    reason: `Loyalty program "${updated.name}" updated (${params.action}).`,
    program: updated
  };
}

export async function executeLoyaltyBenefitForCustomer(params: {
  programId: string;
  customerEmail: string;
  customerName?: string;
  voluntaryBirthdayProvided?: string | null;
  favoriteFragrance?: string | null;
  actor?: string;
}): Promise<{
  success: boolean;
  reason: string;
  issuedVoucherCode?: string | null;
  recommendedBundle?: string[] | null;
  program?: any;
}> {
  await ensureDiscoveryLoyaltyAndCouponsInitialized();
  const [prog] = await db
    .select()
    .from(loyaltyProgramsAndLedger)
    .where(eq(loyaltyProgramsAndLedger.id, params.programId));

  if (!prog) {
    return { success: false, reason: 'Loyalty program not found.' };
  }

  // Strict Governance Check: Monetary benefits require both APPROVED status and active state
  if (prog.isMonetaryBenefit && (prog.approvalStatus !== 'APPROVED' || !prog.isActive)) {
    return {
      success: false,
      reason: `Governance Guard: Monetary loyalty program "${prog.name}" is ${prog.approvalStatus} (Active: ${prog.isActive}). Monetary benefits cannot be issued without Admin approval.`
    };
  }

  // Birthday Offer Rule: Only if voluntarily provided by customer!
  if (prog.ruleType === 'BIRTHDAY_OFFER') {
    const [cust] = await db
      .select()
      .from(customers)
      .where(eq(customers.email, params.customerEmail));
    const crmBirthday =
      params.voluntaryBirthdayProvided ||
      (cust?.crmMetadata as any)?.consent?.birthday ||
      (cust?.crmMetadata as any)?.birthday;

    if (!crmBirthday) {
      return {
        success: false,
        reason:
          'Birthday Offer Guard: Customer has not voluntarily provided a birthday date. FRAGMORÉ never fabricates birthday dates or sends unrequested birthday promotions.'
      };
    }
  }

  const nowIso = new Date().toISOString();
  const history: any[] = Array.isArray(prog.executionsHistory)
    ? [...prog.executionsHistory]
    : [];

  // Handle non-monetary loyalty journeys (Bundle recommendation & Gift purchase journey)
  if (!prog.isMonetaryBenefit) {
    const pairingsMap = (prog.config as any)?.pairings || {};
    const fav = (params.favoriteFragrance || 'AZURE').toUpperCase();
    const recommendedBundle = pairingsMap[fav] || ['GOLDEN HOUR', 'BLACK BACCARA'];

    history.unshift({
      id: `loy-exec-${Date.now()}`,
      timestamp: nowIso,
      customerEmail: params.customerEmail,
      benefitType: prog.benefitType,
      details:
        prog.ruleType === 'BUNDLE_RECOMMENDATION'
          ? `Sent curated layering bundle recommendation for ${fav}: ${recommendedBundle.join(' + ')}`
          : `Initiated White-Glove Gift Journey (calligraphy card + priceless packing slip + recipient care guide)`
    });

    const [updatedNonMonetary] = await db
      .update(loyaltyProgramsAndLedger)
      .set({
        conversionsCount: prog.conversionsCount + 1,
        executionsHistory: history.slice(0, 50),
        updatedAt: new Date()
      })
      .where(eq(loyaltyProgramsAndLedger.id, prog.id))
      .returning();

    return {
      success: true,
      reason: `Executed non-monetary loyalty experience "${prog.name}" for ${params.customerEmail}.`,
      recommendedBundle,
      program: updatedNonMonetary
    };
  }

  // Issue approved monetary loyalty voucher
  const codePrefix = prog.ruleType.split('_')[0].slice(0, 4).toUpperCase();
  const voucherCode = `LOY-${codePrefix}-${Date.now().toString(36).toUpperCase().slice(-4)}`;
  const validityDays = Number((prog.config as any)?.validityDays || 30);
  const expiryDateStr = new Date(Date.now() + validityDays * 86400000).toISOString().slice(0, 10);

  const discountType =
    prog.benefitType === 'PERCENTAGE_DISCOUNT' ? 'PERCENTAGE' : 'LOYALTY_REWARD';

  const couponMeta: EnterpriseCouponMetadata = {
    campaignOwner: `Loyalty Automation (${prog.name})`,
    budgetInr: prog.benefitValue * 10,
    budgetUtilizedInr: 0,
    startDate: nowIso.slice(0, 10),
    endDate: expiryDateStr,
    perCustomerLimit: 1,
    eligibleCustomerSegment: prog.ruleType,
    assignedCustomerEmail: params.customerEmail,
    eligibleProducts: ['ALL_FULL_BOTTLES'],
    stackingRule: 'EXCLUSIVE',
    redemptionHistory: [],
    attributedRevenueInr: 0,
    totalDiscountCostInr: 0,
    profitabilityEstimateInr: 0,
    netMarginPercent: 58,
    loyaltyRuleId: prog.id,
    approvalStatus: 'APPROVED'
  };

  await db.insert(coupons).values({
    code: voucherCode,
    discountType,
    value: prog.benefitValue,
    minOrderValue: prog.minQualifyingOrderInr,
    maxDiscount: Number((prog.config as any)?.maxDiscountInr || prog.benefitValue),
    expiryDate: expiryDateStr,
    usageLimit: 1,
    usageCount: 0,
    isActive: true,
    description: `${prog.name} for ${params.customerName || params.customerEmail}`,
    couponMetadata: couponMeta
  });

  history.unshift({
    id: `loy-exec-${Date.now()}`,
    timestamp: nowIso,
    customerEmail: params.customerEmail,
    voucherCode,
    benefitValue: prog.benefitValue,
    benefitType: prog.benefitType,
    details: `Issued approved loyalty benefit ${voucherCode} (${prog.benefitType === 'PERCENTAGE_DISCOUNT' ? `${prog.benefitValue}%` : `₹${prog.benefitValue}`}) to ${params.customerEmail}.`
  });

  const [updatedProg] = await db
    .update(loyaltyProgramsAndLedger)
    .set({
      conversionsCount: prog.conversionsCount + 1,
      executionsHistory: history.slice(0, 50),
      updatedAt: new Date()
    })
    .where(eq(loyaltyProgramsAndLedger.id, prog.id))
    .returning();

  return {
    success: true,
    reason: `Issued approved loyalty reward voucher ${voucherCode} to ${params.customerEmail}.`,
    issuedVoucherCode: voucherCode,
    program: updatedProg
  };
}

// ============================================================================
// 5. ENTERPRISE COUPON MANAGEMENT CRUD & PROFITABILITY ENGINE
// ============================================================================

export async function createOrUpdateEnterpriseCoupon(params: {
  code: string;
  discountType: string;
  value: number;
  minOrderValue: number;
  maxDiscount?: number;
  usageLimit?: number;
  perCustomerLimit?: number;
  startDate?: string;
  expiryDate?: string;
  campaignOwner: string;
  budgetInr: number;
  eligibleCustomerSegment: string;
  assignedCustomerEmail?: string | null;
  eligibleProducts?: string[];
  stackingRule?: 'EXCLUSIVE' | 'STACKABLE_WITH_LOYALTY' | 'STACKABLE_WITH_ALL';
  description?: string;
}) {
  await ensureDiscoveryLoyaltyAndCouponsInitialized();
  const cleanCode = params.code.trim().toUpperCase();
  const minPurchase = Math.max(1999, Number(params.minOrderValue || 2999));
  const discVal = Number(params.value || 0);
  const estDiscountInr =
    String(params.discountType).toUpperCase() === 'PERCENTAGE'
      ? Math.min(
          Number(params.maxDiscount || 1500),
          Math.round((minPurchase * discVal) / 100)
        )
      : discVal;
  const estCogs = Math.round(minPurchase * 0.25);
  const estNetRevenue = Math.max(0, minPurchase - estDiscountInr);
  const estProfitPerOrder = Math.max(0, estNetRevenue - estCogs);
  const estMarginPercent =
    minPurchase > 0 ? Math.round((estProfitPerOrder / minPurchase) * 1000) / 10 : 50;

  const metadata: EnterpriseCouponMetadata = {
    campaignOwner: params.campaignOwner || 'FRAGMORÉ Marketing & CRM Desk',
    budgetInr: Number(params.budgetInr || 50000),
    budgetUtilizedInr: 0,
    startDate: params.startDate || new Date().toISOString().slice(0, 10),
    endDate: params.expiryDate || '2026-12-31',
    perCustomerLimit: Number(params.perCustomerLimit || 1),
    eligibleCustomerSegment: params.eligibleCustomerSegment || 'ALL',
    assignedCustomerEmail: params.assignedCustomerEmail || null,
    eligibleProducts:
      Array.isArray(params.eligibleProducts) && params.eligibleProducts.length > 0
        ? params.eligibleProducts
        : ['ALL_FULL_BOTTLES'],
    stackingRule: params.stackingRule || 'EXCLUSIVE',
    redemptionHistory: [],
    attributedRevenueInr: 0,
    totalDiscountCostInr: 0,
    profitabilityEstimateInr: estProfitPerOrder,
    netMarginPercent: estMarginPercent,
    approvalStatus: 'APPROVED'
  };

  const [saved] = await db
    .insert(coupons)
    .values({
      code: cleanCode,
      discountType: params.discountType.toUpperCase(),
      value: discVal,
      minOrderValue: Number(params.minOrderValue || 0),
      maxDiscount: Number(params.maxDiscount || estDiscountInr),
      expiryDate: params.expiryDate || '2026-12-31',
      usageLimit: Number(params.usageLimit || 100),
      usageCount: 0,
      isActive: true,
      description:
        params.description ||
        `${cleanCode} (${params.campaignOwner}) — ${params.eligibleCustomerSegment}`,
      couponMetadata: metadata
    })
    .onConflictDoUpdate({
      target: coupons.code,
      set: {
        discountType: params.discountType.toUpperCase(),
        value: discVal,
        minOrderValue: Number(params.minOrderValue || 0),
        maxDiscount: Number(params.maxDiscount || estDiscountInr),
        expiryDate: params.expiryDate || '2026-12-31',
        usageLimit: Number(params.usageLimit || 100),
        description:
          params.description ||
          `${cleanCode} (${params.campaignOwner}) — ${params.eligibleCustomerSegment}`,
        couponMetadata: metadata
      }
    })
    .returning();

  return saved;
}

// ============================================================================
// 6. DISCOVERY ANALYTICS & COHORT ENGINE (7D / 30D / 60D / 90D)
// ============================================================================

export async function getDiscoveryLoyaltyCouponDashboard() {
  await ensureDiscoveryLoyaltyAndCouponsInitialized();

  const rules = await getDiscoveryRedemptionRules();
  const journeys = await db
    .select()
    .from(discoveryJourneys)
    .orderBy(desc(discoveryJourneys.createdAt));
  const loyaltyPrograms = await db.select().from(loyaltyProgramsAndLedger);
  const allCoupons = await db.select().from(coupons);
  const allOrders = await db.select().from(orders);
  const allCampaigns = await db.select().from(campaigns);
  const eligibleProducts = await getEligibleFullBottleProducts(null);

  // Valid non-refunded discovery journeys
  const validJourneys = journeys.filter((j) => j.journeyStatus !== 'SUPPRESSED_REFUNDED');
  const discoveryKitsSold = validJourneys.length;
  const netDiscoveryRevenueInr = validJourneys.reduce(
    (sum, j) => sum + Number(j.netDiscoveryPriceInr || 0),
    0
  );

  // Marketing / sampling acquisition cost per discovery customer
  const discoveryCampaignSpend = allCampaigns
    .filter(
      (c) =>
        c.name.toLowerCase().includes('discovery') ||
        c.name.toLowerCase().includes('sample') ||
        c.channel.toLowerCase().includes('meta')
    )
    .reduce((sum, c) => sum + Number(c.spend || 0), 0);

  const totalVouchersIssued = validJourneys.filter(
    (j) => j.issuedVoucherCode && j.voucherStatus !== 'NOT_ISSUED'
  ).length;

  const convertedJourneys = validJourneys.filter(
    (j) => j.journeyStatus === 'CONVERTED_TO_FULL_BOTTLE' || j.voucherStatus === 'REDEEMED'
  );

  const totalDiscountRedeemedCost = convertedJourneys.reduce(
    (sum, j) => sum + Number(j.voucherAmountInr || 0),
    0
  );

  const costPerDiscoveryCustomerInr =
    discoveryKitsSold > 0
      ? Math.round(
          (Math.min(discoveryCampaignSpend, discoveryKitsSold * 320) +
            totalDiscountRedeemedCost +
            discoveryKitsSold * 180) /
            discoveryKitsSold
        )
      : 0;

  const discoveryToFullBottleConversionPercent =
    discoveryKitsSold > 0
      ? Math.round((convertedJourneys.length / discoveryKitsSold) * 1000) / 10
      : 0;

  const avgTimeToUpgradeDays =
    convertedJourneys.length > 0
      ? Math.round(
          (convertedJourneys.reduce((s, j) => s + Number(j.daysToUpgrade || 4.5), 0) /
            convertedJourneys.length) *
            10
        ) / 10
      : 0;

  // Most selected fragrance breakdown
  const fragranceCounts: Record<string, number> = {};
  for (const j of validJourneys) {
    const fav = j.selectedFavoriteFragrance || j.upgradedProductName;
    if (fav) {
      const key = fav.trim().toUpperCase();
      fragranceCounts[key] = (fragranceCounts[key] || 0) + 1;
    }
  }
  const sortedFragrances = Object.entries(fragranceCounts).sort((a, b) => b[1] - a[1]);
  const mostSelectedFragrance = sortedFragrances[0]?.[0] || 'AZURE';

  const redemptionRatePercent =
    totalVouchersIssued > 0
      ? Math.round((convertedJourneys.length / totalVouchersIssued) * 1000) / 10
      : 0;

  const upgradeRevenueInr = convertedJourneys.reduce(
    (sum, j) => sum + Number(j.upgradeNetRevenueInr || 0),
    0
  );

  const upgradeContributionMarginInr = convertedJourneys.reduce(
    (sum, j) => sum + Number(j.upgradeContributionMarginInr || 0),
    0
  );

  // Repeat purchase rate among discovery buyers
  const discoveryBuyerEmails = new Set(
    validJourneys.map((j) => j.customerEmail.toLowerCase())
  );
  let repeatDiscoveryBuyersCount = 0;
  for (const email of discoveryBuyerEmails) {
    const custPaidOrders = allOrders.filter(
      (o) =>
        o.customerEmail.toLowerCase() === email &&
        String(o.paymentStatus).toUpperCase() === 'PAID' &&
        String(o.orderStatus).toUpperCase() !== 'CANCELLED'
    );
    if (custPaidOrders.length >= 2) {
      repeatDiscoveryBuyersCount++;
    }
  }
  const repeatPurchaseRatePercent =
    discoveryBuyerEmails.size > 0
      ? Math.round((repeatDiscoveryBuyersCount / discoveryBuyerEmails.size) * 1000) / 10
      : 0;

  // Cohort Analysis: 7-day, 30-day, 60-day, and 90-day conversion windows
  const cohortMap = new Map<
    string,
    {
      cohortMonth: string;
      kitsSold: number;
      netDiscoveryRevenueInr: number;
      converted7d: number;
      converted30d: number;
      converted60d: number;
      converted90d: number;
      upgradeRevenueInr: number;
      upgradeMarginInr: number;
    }
  >();

  for (const j of validJourneys) {
    const cm = j.cohortMonth || '2026-10';
    if (!cohortMap.has(cm)) {
      cohortMap.set(cm, {
        cohortMonth: cm,
        kitsSold: 0,
        netDiscoveryRevenueInr: 0,
        converted7d: 0,
        converted30d: 0,
        converted60d: 0,
        converted90d: 0,
        upgradeRevenueInr: 0,
        upgradeMarginInr: 0
      });
    }
    const bucket = cohortMap.get(cm)!;
    bucket.kitsSold += 1;
    bucket.netDiscoveryRevenueInr += Number(j.netDiscoveryPriceInr || 0);

    if (j.journeyStatus === 'CONVERTED_TO_FULL_BOTTLE' || j.voucherStatus === 'REDEEMED') {
      const days = Number(j.daysToUpgrade ?? 5);
      if (days <= 7) bucket.converted7d += 1;
      if (days <= 30) bucket.converted30d += 1;
      if (days <= 60) bucket.converted60d += 1;
      if (days <= 90) bucket.converted90d += 1;
      bucket.upgradeRevenueInr += Number(j.upgradeNetRevenueInr || 0);
      bucket.upgradeMarginInr += Number(j.upgradeContributionMarginInr || 0);
    }
  }

  const cohorts = Array.from(cohortMap.values()).sort((a, b) =>
    b.cohortMonth.localeCompare(a.cohortMonth)
  );

  return {
    redemptionRules: rules,
    analytics: {
      discoveryKitsSold,
      netDiscoveryRevenueInr,
      costPerDiscoveryCustomerInr,
      discoveryToFullBottleConversionPercent,
      avgTimeToUpgradeDays,
      mostSelectedFragrance,
      fragranceSelectionBreakdown: sortedFragrances.map(([name, count]) => ({ name, count })),
      totalVouchersIssued,
      vouchersRedeemed: convertedJourneys.length,
      redemptionRatePercent,
      upgradeRevenueInr,
      upgradeContributionMarginInr,
      repeatPurchaseRatePercent
    },
    cohorts,
    journeys,
    eligibleFullBottleProducts: eligibleProducts,
    loyaltyPrograms: loyaltyPrograms.filter((p) => p.ruleType !== 'DISCOVERY_REDEMPTION_CONFIG'),
    coupons: allCoupons
  };
}

// ============================================================================
// 7. AUTOMATED VERIFICATION SUITE (7 SCENARIOS AGAINST LIVE POSTGRESQL)
// ============================================================================

export async function runDiscoveryLoyaltyCouponVerificationSuite() {
  await ensureDiscoveryLoyaltyAndCouponsInitialized();
  const results: Array<{
    id: string;
    scenario: string;
    passed: boolean;
    details: string;
  }> = [];

  const testOrderId = `ord-disc-test-${Date.now()}`;
  const testOrderNumber = `FRG-DISC-${Date.now().toString().slice(-5)}`;
  const testEmail = `discovery.verify.${Date.now()}@fragmore.in`;
  let journeyId = '';
  let issuedVoucherCode = '';

  try {
    // Scenario 1: Discovery purchase tags customer as Discovery Buyer & holds journey until confirmed delivery
    const journey = await registerDiscoveryPurchase({
      orderId: testOrderId,
      orderNumber: testOrderNumber,
      customerName: 'Aarav Singhania',
      customerEmail: testEmail,
      customerPhone: '+91 98201 11223',
      configurationCode: 'DISCOVERY_SIX_8ML',
      sizeVariant: '8 ml',
      netDiscoveryPriceInr: 2499,
      orderStatus: 'CONFIRMED'
    });
    journeyId = journey.id;

    // Attempt premature favorite selection & voucher issuance before confirmed delivery -> must be blocked
    const prematureAttempt = await selectFavoriteFragranceAndIssueRedemptionBenefit({
      journeyId,
      selectedFavoriteFragrance: 'AZURE',
      issueRedemptionVoucher: true
    });

    const s1Passed =
      journey.journeyStatus === 'AWAITING_DELIVERY' &&
      journey.vialSize === '8 ml' &&
      prematureAttempt.success === false &&
      prematureAttempt.voucherIssued === false;

    results.push({
      id: 'disc_1_delivery_gate',
      scenario:
        '1. Discovery purchase identifies 2ml/8ml configuration & blocks journey/voucher before confirmed delivery',
      passed: s1Passed,
      details: `Config=${journey.configurationCode} (${journey.vialSize}), Status=${journey.journeyStatus}, PrematureVoucherBlocked=${!prematureAttempt.voucherIssued}`
    });

    // Scenario 2: Unverified delivery ping is blocked; Trusted Carrier confirmation starts journey & sends education
    const unverifiedDelivery = await confirmDiscoveryDeliveryAndStartJourney({
      journeyId,
      verificationSource: 'UNVERIFIED_PING'
    });
    const verifiedDelivery = await confirmDiscoveryDeliveryAndStartJourney({
      journeyId,
      verificationSource: 'TRUSTED_CARRIER_WEBHOOK',
      channel: 'EMAIL',
      actor: 'Blue Dart Signed Webhook'
    });

    const s2Passed =
      unverifiedDelivery.success === false &&
      verifiedDelivery.success === true &&
      verifiedDelivery.journey?.journeyStatus === 'FAVORITE_INVITED';

    results.push({
      id: 'disc_2_education_and_favorite_invite',
      scenario:
        '2. Confirmed carrier delivery starts Discovery Journey, sends fragrance education & invites favorite selection',
      passed: s2Passed,
      details: `UnverifiedBlocked=${!unverifiedDelivery.success}, JourneyStatus=${verifiedDelivery.journey?.journeyStatus}`
    });

    // Scenario 3: Favorite fragrance selection issues dynamic customer-specific voucher & displays eligible full bottles
    const favSelection = await selectFavoriteFragranceAndIssueRedemptionBenefit({
      journeyId,
      selectedFavoriteFragrance: 'AZURE',
      issueRedemptionVoucher: true
    });
    issuedVoucherCode = favSelection.voucherCode || '';

    const s3Passed =
      favSelection.success === true &&
      favSelection.voucherIssued === true &&
      Boolean(issuedVoucherCode) &&
      (favSelection.eligibleFullBottles?.length || 0) > 0;

    results.push({
      id: 'disc_3_favorite_and_voucher_issuance',
      scenario:
        '3. Favorite selection records preference, checks margin safeguards, issues customer-specific voucher & lists in-stock full bottles',
      passed: s3Passed,
      details: `Favorite=AZURE, Voucher=${issuedVoucherCode}, Amount=₹${favSelection.voucherAmountInr}, EligibleBottles=${favSelection.eligibleFullBottles?.length}`
    });

    // Scenario 4: Customer-specific binding & stacking rules block unauthorized or stacked redemptions
    const wrongCustomerAttempt = await redeemDiscoveryVoucherOnFullBottleUpgrade({
      voucherCode: issuedVoucherCode,
      customerEmail: 'intruder@fragmore.in',
      orderId: 'ord-wrong',
      orderNumber: 'FRG-WRONG-01',
      productName: 'AZURE',
      bottleSize: '100 ml',
      grossOrderAmountInr: 5499
    });

    const stackedAttempt = await redeemDiscoveryVoucherOnFullBottleUpgrade({
      voucherCode: issuedVoucherCode,
      customerEmail: testEmail,
      orderId: 'ord-stack',
      orderNumber: 'FRG-STACK-01',
      productName: 'AZURE',
      bottleSize: '100 ml',
      grossOrderAmountInr: 5499,
      otherCouponsApplied: ['EXTRA20']
    });

    const s4Passed =
      wrongCustomerAttempt.success === false && stackedAttempt.success === false;

    results.push({
      id: 'disc_4_binding_and_stacking_guards',
      scenario:
        '4. Redemption engine enforces customer-specific voucher binding and blocks unauthorized coupon stacking',
      passed: s4Passed,
      details: `WrongCustomerBlocked=${!wrongCustomerAttempt.success}, StackingBlocked=${!stackedAttempt.success}`
    });

    // Scenario 5: Valid full-bottle upgrade redeems voucher, tracks upgrade revenue/margin, ends journey & blocks 2nd use
    const validUpgrade = await redeemDiscoveryVoucherOnFullBottleUpgrade({
      voucherCode: issuedVoucherCode,
      customerEmail: testEmail,
      orderId: `ord-upg-${Date.now()}`,
      orderNumber: `FRG-UPG-${Date.now().toString().slice(-4)}`,
      productName: 'AZURE',
      bottleSize: '100 ml',
      grossOrderAmountInr: 5499
    });

    const duplicateRedemption = await redeemDiscoveryVoucherOnFullBottleUpgrade({
      voucherCode: issuedVoucherCode,
      customerEmail: testEmail,
      orderId: `ord-dup-${Date.now()}`,
      orderNumber: 'FRG-DUP-02',
      productName: 'AZURE',
      bottleSize: '100 ml',
      grossOrderAmountInr: 5499
    });

    const s5Passed =
      validUpgrade.success === true &&
      (validUpgrade.netUpgradeRevenueInr || 0) > 0 &&
      validUpgrade.journey?.journeyStatus === 'CONVERTED_TO_FULL_BOTTLE' &&
      duplicateRedemption.success === false;

    results.push({
      id: 'disc_5_full_bottle_conversion_and_single_use',
      scenario:
        '5. Full-bottle upgrade tracks net revenue & contribution margin, completes journey & enforces single redemption',
      passed: s5Passed,
      details: `NetUpgradeRev=₹${validUpgrade.netUpgradeRevenueInr}, Margin=₹${validUpgrade.upgradeContributionMarginInr}, DuplicateBlocked=${!duplicateRedemption.success}`
    });

    // Scenario 6: Loyalty Automation blocks unapproved monetary benefits & blocks Birthday offer without voluntary DOB
    const unapprovedMonetary = await executeLoyaltyBenefitForCustomer({
      programId: 'loyalty-win-back-benefit', // PENDING_APPROVAL by default
      customerEmail: testEmail,
      customerName: 'Aarav Singhania'
    });

    const missingDobBirthday = await executeLoyaltyBenefitForCustomer({
      programId: 'loyalty-birthday-offer',
      customerEmail: testEmail,
      customerName: 'Aarav Singhania',
      voluntaryBirthdayProvided: null
    });

    const validDobBirthday = await executeLoyaltyBenefitForCustomer({
      programId: 'loyalty-birthday-offer',
      customerEmail: testEmail,
      customerName: 'Aarav Singhania',
      voluntaryBirthdayProvided: '1992-10-25'
    });

    if (validDobBirthday.issuedVoucherCode) {
      await db
        .delete(coupons)
        .where(eq(coupons.code, validDobBirthday.issuedVoucherCode));
    }

    const s6Passed =
      unapprovedMonetary.success === false &&
      missingDobBirthday.success === false &&
      validDobBirthday.success === true;

    results.push({
      id: 'disc_6_loyalty_governance_and_voluntary_birthday',
      scenario:
        '6. Loyalty engine blocks unapproved monetary benefits & requires voluntary DOB before issuing birthday offer',
      passed: s6Passed,
      details: `UnapprovedMonetaryBlocked=${!unapprovedMonetary.success}, MissingBirthdayBlocked=${!missingDobBirthday.success}, VoluntaryBirthdayIssued=${validDobBirthday.success}`
    });
  } finally {
    // Clean up temporary verification records so production tables remain free of test artifacts
    if (journeyId) {
      await db.delete(discoveryJourneys).where(eq(discoveryJourneys.id, journeyId));
    }
    if (issuedVoucherCode) {
      await db.delete(coupons).where(eq(coupons.code, issuedVoucherCode));
    }
  }

  const passedCount = results.filter((r) => r.passed).length;
  return {
    allPassed: passedCount === results.length,
    passedCount,
    totalCount: results.length,
    results
  };
}
