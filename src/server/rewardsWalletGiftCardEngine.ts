import crypto from 'crypto';
import { db } from '../db/index.ts';
import {
  rewardsProgramConfig,
  customerWallets,
  walletCreditBuckets,
  walletTransactions,
  loyaltyTiers,
  loyaltyAccounts,
  loyaltyPointsLedger,
  giftCards,
  giftCardTransactions,
  corporateGiftCardBatches,
  referralConversions,
  occasionRewardLogs,
  checkoutRewardReservations,
  rewardsAdjustmentApprovals,
  rewardsFraudFlags,
  customers,
  orders,
  products,
  coupons,
  erpChartOfAccounts,
  erpAccountingJournals,
  erpProposals,
  erpQuotations,
  erpSequences,
  auditLogs
} from '../db/schema.ts';
import { eq, and, desc, asc, sql, inArray } from 'drizzle-orm';
import {
  ORG_ID,
  ErpError,
  ForbiddenError,
  ValidationError,
  NotFoundError,
  getNextSequence,
  recordErpAuditLog
} from './erpBusinessOsEngine.ts';
import { ingestAutomationEvent } from './automationEngine.ts';
import { broadcastCrossBrowserSyncEvent } from './productionAuditAndReliabilityEngine.ts';

export const REWARDS_CONFIG_ID = 'fragmore-rewards-master-config';

export type WalletCreditType =
  | 'REFUND_CREDIT'
  | 'PROMOTIONAL_CREDIT'
  | 'CASHBACK_REWARD'
  | 'GOODWILL_CREDIT'
  | 'REFERRAL_CREDIT';

export type LoyaltyTierCode = 'SILVER' | 'GOLD' | 'PLATINUM' | 'PRIVATE_ATELIER';

export type RewardsAdminRole =
  | 'SUPER_ADMIN'
  | 'FINANCE_CONTROLLER'
  | 'MARKETING_MANAGER'
  | 'MARKETING_AGENCY'
  | 'CUSTOMER_SUPPORT'
  | 'SALES_CRM'
  | 'INTERN_VIEWER';

export interface RewardsActor {
  email: string;
  role: RewardsAdminRole | 'CUSTOMER';
  isAdminStaff: boolean;
  ipAddress: string;
}

export class RateLimitError extends ErpError {
  constructor(message = 'Too many invalid lookup attempts. Access temporarily rate-limited for security.') {
    super(429, 'RATE_LIMITED', message);
  }
}

// ============================================================================
// CRYPTOGRAPHIC HELPERS (GIFT CARD HASHING, ENCRYPTION & MASKING)
// ============================================================================

const GIFT_CARD_CIPHER_KEY = crypto
  .createHash('sha256')
  .update(process.env.GIFT_CARD_MASTER_SECRET || `fragmore-vault-gc-secret-${ORG_ID}`)
  .digest();

const SAFE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
}

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function currentIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function getFiscalPeriod(dateStr?: string): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  const year = d.getUTCMonth() >= 3 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  const nextShort = String((year + 1) % 100).padStart(2, '0');
  return `FY${year}-${nextShort}`;
}

function randomSafeChars(len: number): string {
  const bytes = crypto.randomBytes(len * 2);
  let out = '';
  for (let i = 0; i < bytes.length && out.length < len; i++) {
    out += SAFE_ALPHABET[bytes[i] % SAFE_ALPHABET.length];
  }
  return out;
}

export function generateGiftCardPublicNumber(): string {
  return `GC-FRG-${randomSafeChars(4)}-${randomSafeChars(4)}`;
}

export function generateGiftCardSecretCode(): string {
  return `FRGM-${randomSafeChars(4)}-${randomSafeChars(4)}-${randomSafeChars(4)}`;
}

export function normalizeGiftCardCode(raw: string): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '');
}

export function hashSecretValue(raw: string): string {
  return crypto.createHash('sha256').update(normalizeGiftCardCode(raw)).digest('hex');
}

export function maskGiftCardCode(secretCode: string): string {
  const clean = normalizeGiftCardCode(secretCode);
  const last4 = clean.replace(/-/g, '').slice(-4) || 'XXXX';
  return `FRGM-****-****-${last4}`;
}

export function encryptGiftCardCode(secretCode: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', GIFT_CARD_CIPHER_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(normalizeGiftCardCode(secretCode), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptGiftCardCodeForAuthorizedDelivery(encryptedPayload: string): string {
  const [ivHex, tagHex, dataHex] = String(encryptedPayload || '').split(':');
  if (!ivHex || !tagHex || !dataHex) return '';
  const decipher = crypto.createDecipheriv('aes-256-gcm', GIFT_CARD_CIPHER_KEY, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
}

export function maskEmailForRestrictedRole(email: string | null | undefined): string {
  if (!email) return '-';
  const [local, domain] = String(email).split('@');
  if (!domain) return '***';
  const head = local.slice(0, 2);
  return `${head}***@${domain}`;
}

// ============================================================================
// IN-MEMORY ANTI-BRUTE-FORCE GUARD + PERSISTENT FRAUD FLAG ESCALATION
// ============================================================================

interface AttemptWindow {
  failures: number;
  windowStartedAt: number;
  lockedUntil: number;
}

const giftCardLookupLimiter = new Map<string, AttemptWindow>();

async function checkAndRecordGiftCardLookupAttempt(actorKey: string, succeeded: boolean, attemptedInput?: string) {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000; // 10 minutes
  const maxFailures = 5;
  const entry = giftCardLookupLimiter.get(actorKey) || {
    failures: 0,
    windowStartedAt: now,
    lockedUntil: 0
  };

  if (entry.lockedUntil > now) {
    throw new RateLimitError(
      'Gift card lookup temporarily locked after repeated invalid codes. Please wait 10 minutes or contact FRAGMORÉ Concierge.'
    );
  }

  if (now - entry.windowStartedAt > windowMs) {
    entry.failures = 0;
    entry.windowStartedAt = now;
  }

  if (succeeded) {
    giftCardLookupLimiter.delete(actorKey);
    return;
  }

  entry.failures += 1;
  if (entry.failures >= maxFailures) {
    entry.lockedUntil = now + windowMs;
    giftCardLookupLimiter.set(actorKey, entry);

    // Record persistent fraud flag for Super Admin Fraud & Risk Review
    await db
      .insert(rewardsFraudFlags)
      .values({
        id: makeId('rff'),
        flagNumber: `FRD-${Date.now().toString().slice(-6)}-${randomSafeChars(3)}`,
        category: 'GIFT_CARD_BRUTE_FORCE',
        severity: 'HIGH',
        actorIdentifier: actorKey,
        customerEmail: actorKey.includes('@') ? actorKey : null,
        relatedEntityType: 'GIFT_CARD_LOOKUP',
        relatedEntityId: attemptedInput ? `${attemptedInput.slice(0, 4)}****` : 'UNKNOWN',
        signals: {
          failedAttemptsInWindow: entry.failures,
          windowMinutes: 10,
          lockedUntilIso: new Date(entry.lockedUntil).toISOString()
        },
        status: 'OPEN_REVIEW',
        createdAt: new Date()
      })
      .catch(() => {});

    throw new RateLimitError(
      'Maximum invalid gift card attempts exceeded (5/5). Security lockout activated and logged for review.'
    );
  }

  giftCardLookupLimiter.set(actorKey, entry);
}

// ============================================================================
// DEFAULT CONFIGURATION & TIERS
// ============================================================================

export const DEFAULT_REWARDS_CONFIG = {
  walletConfig: {
    programTitle: 'FRAGMORÉ Wallet',
    closedLoopOnly: true,
    bucketExpiryDays: {
      REFUND_CREDIT: 365,
      PROMOTIONAL_CREDIT: 90,
      CASHBACK_REWARD: 180,
      GOODWILL_CREDIT: 180,
      REFERRAL_CREDIT: 120
    },
    defaultMinOrderForPromoInr: 499,
    maxPromoWalletOrderPct: 50,
    consumptionPriority: [
      'PROMOTIONAL_CREDIT',
      'REFERRAL_CREDIT',
      'CASHBACK_REWARD',
      'GOODWILL_CREDIT',
      'REFUND_CREDIT'
    ],
    termsSummary:
      'FRAGMORÉ Wallet credits are closed-loop brand credits redeemable solely toward eligible FRAGMORÉ fragrances, Discovery Sets, and Atelier experiences. Promotional, referral, goodwill, and cashback credits carry validity dates and are non-withdrawable to bank accounts or cash.'
  },
  loyaltyConfig: {
    programName: 'FRAGMORÉ Privileges',
    earnPointsPer100Inr: 5, // ₹100 = 5 points
    minQualifyingPurchaseInr: 499,
    redeemPointsUnit: 100, // 100 points = ₹10
    redeemRupeePerUnitInr: 10,
    maxOrderRedemptionPct: 20, // max 20% of order subtotal
    minPointsRequiredToRedeem: 100,
    returnWindowHoldDays: 7,
    pointsValidityMonths: 12,
    welcomeBonusPoints: 100,
    awardOnShipping: false,
    awardOnTax: false,
    awardOnGiftCardPurchase: false,
    excludedCollections: ['Gift Cards'],
    excludedProductSlugs: [] as string[],
    activeCampaignMultiplier: 1.0,
    activeMultiplierLabel: 'Standard House Earn Rate (1.0x)'
  },
  giftCardConfig: {
    pageTitle: 'Gift FRAGMORÉ',
    presetDenominationsInr: [500, 1000, 2000, 3000, 5000],
    allowCustomAmount: true,
    minCustomAmountInr: 250,
    maxCustomAmountInr: 25000,
    validityMonths: 12,
    allowGiftCardToBuyGiftCard: false,
    allowPartialRedemption: true,
    allowEventPosRedemption: true,
    occasions: [
      'Birthday',
      'Anniversary',
      'Wedding',
      'Congratulations',
      'Festival',
      'Thank You',
      'Corporate Gift'
    ],
    templates: [
      {
        id: 'ivory-champagne-atelier',
        name: 'Ivory & Champagne Gold',
        subtitle: 'Signature FRAGMORÉ Maison Parchment',
        bgHex: '#FAF8F4',
        accentHex: '#9A783E',
        textHex: '#1C1916'
      },
      {
        id: 'obsidian-gold-monolith',
        name: 'Obsidian Noir & Gold Foil',
        subtitle: 'Evening Extrait Collector Edition',
        bgHex: '#141312',
        accentHex: '#D4AF37',
        textHex: '#FAF8F4'
      },
      {
        id: 'royal-wedding-coffret',
        name: 'Trousseau & Wedding Silk',
        subtitle: 'Bespoke Celebration & Return Gifting',
        bgHex: '#F5EFE6',
        accentHex: '#8C6239',
        textHex: '#24211D'
      },
      {
        id: 'festive-saffron-silk',
        name: 'Festive Kesar & Oud',
        subtitle: 'Sacred Celebrations & Seasonal Gifting',
        bgHex: '#231B15',
        accentHex: '#E0A952',
        textHex: '#FAF8F4'
      }
    ]
  },
  referralConfig: {
    programName: 'Refer & Experience FRAGMORÉ',
    enabled: true,
    refereeRewardInr: 50,
    referrerRewardInr: 75,
    minFirstOrderValueInr: 699,
    returnWindowHoldDays: 7,
    rewardExpiryDays: 120,
    maxReferralsPerCustomerPerMonth: 15,
    maxReferralCapPerYearInr: 15000,
    blockSelfReferral: true,
    holdSharedAddressOrIpForManualReview: true
  },
  occasionConfig: {
    birthdayEnabled: true,
    birthdayPoints: 250,
    birthdayPromoCreditInr: 100,
    birthdayValidityDays: 30,
    anniversaryEnabled: true,
    anniversaryPoints: 200,
    anniversaryPromoCreditInr: 75,
    anniversaryValidityDays: 30,
    maxGrantsPerOccasionPerYear: 1,
    annualOccasionBudgetInr: 250000,
    requireMarketingOptIn: true,
    complimentarySampleEnabled: false,
    complimentarySampleSku: 'FRG-GIFT-2ML'
  },
  checkoutRulesConfig: {
    allowCouponWithLoyalty: true,
    allowCouponWithPromoWallet: false,
    allowWalletWithLoyalty: true,
    allowGiftCardWithAll: true,
    redemptionOrder: ['COUPON', 'LOYALTY_POINTS', 'PROMO_WALLET', 'REFUND_WALLET', 'GIFT_CARD'],
    maxCombinedPreTaxDiscountPct: 35,
    reservationExpiryMinutes: 20
  },
  accountingTaxConfig: {
    giftCardLiabilityAccountCode: '2310',
    refundWalletLiabilityAccountCode: '2320',
    loyaltyLiabilityAccountCode: '2330',
    promoRewardExpenseAccountCode: '5410',
    breakageIncomeAccountCode: '4310',
    promoAndLoyaltyReduceTaxableValue: true,
    giftCardAndRefundArePostTaxTender: true,
    defaultProductGstRatePct: 18,
    breakageRequiresAccountantApproval: true
  },
  complianceConfig: {
    closedLoopInstrumentOnly: true,
    allowBankWithdrawal: false,
    allowPeerToPeerTransfer: false,
    allowUnrestrictedCashTopUp: false,
    allowCashOut: false,
    legalDisclosure:
      'Closed-loop FRAGMORÉ store credits and gift cards are redeemable exclusively on fragmore.shop and authorized FRAGMORÉ Perfume Bar experiences. Not a bank deposit or prepaid payment instrument; no cash withdrawal or P2P transfer permitted.'
  }
};

export const DEFAULT_LOYALTY_TIERS = [
  {
    id: 'tier-silver',
    tierCode: 'SILVER',
    tierName: 'FRAGMORÉ Silver',
    tagline: 'Complimentary Entry Privilege upon Registration',
    minQualifyingSpendInr: 0,
    minQualifyingOrders: 0,
    pointsMultiplier: 1.0,
    earnBonusPct: 0,
    durationMonths: 12,
    renewalSpendInr: 0,
    maxRedemptionOrderPct: 20,
    benefits: [
      { code: 'BASE_EARN', label: '5 Points per ₹100 qualifying spend', description: 'Standard FRAGMORÉ Privileges earn rate', requiresStockCheck: false },
      { code: 'BIRTHDAY_NOTE', label: 'Annual Birthday Privilege', description: '250 bonus points + ₹100 birthday credit (with opt-in)', requiresStockCheck: false },
      { code: 'DISCOVERY_ACCESS', label: 'Discovery Set Upgrade Access', description: 'Seamless transition from 2 ml vials to 50 ml flacons', requiresStockCheck: false }
    ],
    requiresLiveStockVerificationForSamples: true,
    sortOrder: 1,
    isActive: true
  },
  {
    id: 'tier-gold',
    tierCode: 'GOLD',
    tierName: 'FRAGMORÉ Gold',
    tagline: 'Elevated Connoisseurship from ₹2,500 Annual Spend',
    minQualifyingSpendInr: 2500,
    minQualifyingOrders: 2,
    pointsMultiplier: 1.2,
    earnBonusPct: 20,
    durationMonths: 12,
    renewalSpendInr: 2000,
    maxRedemptionOrderPct: 25,
    benefits: [
      { code: 'GOLD_EARN', label: '1.2x Points Multiplier (6 pts / ₹100)', description: '20% accelerated loyalty point accumulation', requiresStockCheck: false },
      { code: 'EARLY_DROP', label: '24-Hour Early Access to Seasonal Releases', description: 'Priority window on new Aura & Signature drops', requiresStockCheck: false },
      { code: 'OCCASION_DOUBLE', label: 'Birthday & Anniversary Privileges', description: 'Eligible for annual celebratory house credits', requiresStockCheck: false }
    ],
    requiresLiveStockVerificationForSamples: true,
    sortOrder: 2,
    isActive: true
  },
  {
    id: 'tier-platinum',
    tierCode: 'PLATINUM',
    tierName: 'FRAGMORÉ Platinum (VIP)',
    tagline: 'House VIP Distinction from ₹5,000 Qualifying Net Spend',
    minQualifyingSpendInr: 5000,
    minQualifyingOrders: 3,
    pointsMultiplier: 1.5,
    earnBonusPct: 50,
    durationMonths: 12,
    renewalSpendInr: 4000,
    maxRedemptionOrderPct: 30,
    benefits: [
      { code: 'PLATINUM_EARN', label: '1.5x Points Multiplier (7.5 pts / ₹100)', description: '50% accelerated point earning on retained orders', requiresStockCheck: false },
      { code: 'ONCE_PRIORITY', label: 'Priority Allocation on ONCE Limited Editions', description: 'Reserved window before public release', requiresStockCheck: false },
      { code: 'SAMPLE_ELIGIBLE', label: 'Complimentary Discovery Vial (Subject to Live Stock)', description: 'Verified against live warehouse stock at checkout', requiresStockCheck: true }
    ],
    requiresLiveStockVerificationForSamples: true,
    sortOrder: 3,
    isActive: true
  },
  {
    id: 'tier-private-atelier',
    tierCode: 'PRIVATE_ATELIER',
    tierName: 'FRAGMORÉ Private Atelier',
    tagline: 'Sovereign Patron Circle from ₹15,000 Qualifying Net Spend',
    minQualifyingSpendInr: 15000,
    minQualifyingOrders: 5,
    pointsMultiplier: 2.0,
    earnBonusPct: 100,
    durationMonths: 18,
    renewalSpendInr: 10000,
    maxRedemptionOrderPct: 35,
    benefits: [
      { code: 'ATELIER_EARN', label: '2.0x Points Multiplier (10 pts / ₹100)', description: 'Double points on every qualifying flacon', requiresStockCheck: false },
      { code: 'CONCIERGE_DESK', label: 'Dedicated Private Scent Concierge & Engraving', description: 'Direct Worli Atelier consultation & bespoke monogramming', requiresStockCheck: false },
      { code: 'PERFUME_BAR_VIP', label: 'Private Invitations to Perfume Bar Soirées', description: 'Complimentary tasting access at curated FRAGMORÉ events', requiresStockCheck: false }
    ],
    requiresLiveStockVerificationForSamples: true,
    sortOrder: 4,
    isActive: true
  }
];

// ============================================================================
// RBAC & CUSTOMER OWNERSHIP RESOLUTION
// ============================================================================

export function resolveRewardsRoleFromHeaders(params: {
  verifiedEmail?: string;
  headerAdminEmail?: string;
  headerAdminRole?: string;
  headerErpRoleCode?: string;
  headerCustomerEmail?: string;
  ipAddress?: string;
}): RewardsActor {
  const ipAddress = params.ipAddress || '127.0.0.1';
  const rawErpRole = String(params.headerErpRoleCode || '').trim().toUpperCase();
  const rawAdminRole = String(params.headerAdminRole || '').trim().toUpperCase();

  // Explicit role override header (used by AdminDashboard role switcher & security audit tests)
  const effectiveRoleCandidate = rawErpRole || rawAdminRole;
  const emailFromAdmin = (params.verifiedEmail || params.headerAdminEmail || '').trim().toLowerCase();
  const emailFromCustomer = (params.verifiedEmail || params.headerCustomerEmail || '').trim().toLowerCase();

  const roleMap: Record<string, RewardsAdminRole> = {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'SUPER_ADMIN',
    FINANCE_CONTROLLER: 'FINANCE_CONTROLLER',
    ACCOUNTANT: 'FINANCE_CONTROLLER',
    MARKETING_MANAGER: 'MARKETING_MANAGER',
    CONTENT_MARKETING: 'MARKETING_MANAGER',
    MARKETING_AGENCY: 'MARKETING_AGENCY',
    AGENCY: 'MARKETING_AGENCY',
    MARKETING: 'MARKETING_MANAGER',
    CUSTOMER_SUPPORT: 'CUSTOMER_SUPPORT',
    SUPPORT: 'CUSTOMER_SUPPORT',
    SALES_CRM: 'SALES_CRM',
    ORDER_MANAGER: 'SALES_CRM',
    INTERN_VIEWER: 'INTERN_VIEWER',
    INTERN: 'INTERN_VIEWER',
    PROCUREMENT_LEAD: 'INTERN_VIEWER',
    FORMULATOR: 'INTERN_VIEWER',
    PRODUCTION_LEAD: 'INTERN_VIEWER',
    QC_ANALYST: 'INTERN_VIEWER',
    WAREHOUSE_MANAGER: 'INTERN_VIEWER',
    HR_MANAGER: 'INTERN_VIEWER'
  };

  if (effectiveRoleCandidate && roleMap[effectiveRoleCandidate]) {
    const mapped = roleMap[effectiveRoleCandidate];
    return {
      email: emailFromAdmin || `${mapped.toLowerCase()}@fragmore.shop`,
      role: mapped,
      isAdminStaff: true,
      ipAddress
    };
  }

  if (
    emailFromAdmin === 'gowisherharsha@gmail.com' ||
    emailFromAdmin === 'aibrandorigin@gmail.com' ||
    emailFromAdmin === 'founder@fragmore.com'
  ) {
    return {
      email: emailFromAdmin,
      role: 'SUPER_ADMIN',
      isAdminStaff: true,
      ipAddress
    };
  }

  return {
    email: emailFromCustomer,
    role: 'CUSTOMER',
    isAdminStaff: false,
    ipAddress
  };
}

export async function assertCustomerOwnershipOrStaff(
  actor: RewardsActor,
  targetCustomerEmail: string,
  allowSupportRead = true
): Promise<void> {
  const cleanTarget = String(targetCustomerEmail || '').trim().toLowerCase();
  if (!cleanTarget) {
    throw new ValidationError('Customer email is required.');
  }

  if (actor.isAdminStaff) {
    // Agency and Intern roles NEVER have access to individual customer wallets or ledgers!
    if (actor.role === 'MARKETING_AGENCY' || actor.role === 'INTERN_VIEWER') {
      await db
        .insert(rewardsFraudFlags)
        .values({
          id: makeId('rff'),
          flagNumber: `FRD-${Date.now().toString().slice(-6)}-${randomSafeChars(3)}`,
          category: 'UNAUTHORIZED_ACCESS_ATTEMPT',
          severity: 'MEDIUM',
          actorIdentifier: `${actor.email} (${actor.role})`,
          customerEmail: cleanTarget,
          relatedEntityType: 'CUSTOMER_WALLET_READ',
          relatedEntityId: cleanTarget,
          signals: { attemptedByRole: actor.role, blocked: true },
          status: 'OPEN_REVIEW'
        })
        .catch(() => {});
      throw new ForbiddenError(
        `Forbidden (403): Role ${actor.role} cannot access individual customer wallets, points ledgers, or gift card records.`
      );
    }
    if (!allowSupportRead && actor.role === 'CUSTOMER_SUPPORT') {
      throw new ForbiddenError('Forbidden (403): Customer Support cannot directly mutate customer balances without approval.');
    }
    return;
  }

  // Customer mode: strict ownership enforcement!
  if (!actor.email) {
    throw new ErpError(401, 'UNAUTHORIZED', 'Authentication required to access FRAGMORÉ Wallet and Rewards.');
  }
  if (actor.email.toLowerCase() !== cleanTarget) {
    await db
      .insert(rewardsFraudFlags)
      .values({
        id: makeId('rff'),
        flagNumber: `FRD-${Date.now().toString().slice(-6)}-${randomSafeChars(3)}`,
        category: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        severity: 'HIGH',
        actorIdentifier: actor.email,
        customerEmail: cleanTarget,
        relatedEntityType: 'CROSS_CUSTOMER_WALLET_ACCESS',
        relatedEntityId: cleanTarget,
        signals: { actorEmail: actor.email, targetEmail: cleanTarget, ip: actor.ipAddress },
        status: 'OPEN_REVIEW'
      })
      .catch(() => {});
    throw new ForbiddenError('Forbidden (403): You are only authorized to access your own FRAGMORÉ Wallet and Rewards.');
  }
}

export function assertRewardsStaffRoles(actor: RewardsActor, allowedRoles: RewardsAdminRole[], contextLabel: string): void {
  if (!actor.isAdminStaff || actor.role === 'CUSTOMER') {
    throw new ForbiddenError(`Forbidden (403): Staff authorization required for ${contextLabel}.`);
  }
  if (!allowedRoles.includes(actor.role)) {
    throw new ForbiddenError(
      `Forbidden (403): Role ${actor.role} is not authorized for ${contextLabel}. Allowed roles: ${allowedRoles.join(', ')}.`
    );
  }
}

// ============================================================================
// DOUBLE-ENTRY ACCOUNTING GL HELPER FOR WALLET, LOYALTY & GIFT CARDS
// ============================================================================

async function postRewardsAccountingJournal(
  tx: any,
  params: {
    sourceModule: string;
    sourceEntityId: string;
    narration: string;
    idempotencyKey: string;
    postedByEmail: string;
    lines: Array<{
      accountCode: string;
      accountName: string;
      accountType: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
      debitInr: number;
      creditInr: number;
      costCenter?: string;
    }>;
  }
): Promise<string | null> {
  const totalDebit = round2(params.lines.reduce((s, l) => s + (Number(l.debitInr) || 0), 0));
  const totalCredit = round2(params.lines.reduce((s, l) => s + (Number(l.creditInr) || 0), 0));
  if (totalDebit <= 0 || Math.abs(totalDebit - totalCredit) > 0.02) {
    return null;
  }

  const existing = await tx
    .select()
    .from(erpAccountingJournals)
    .where(eq(erpAccountingJournals.idempotencyKey, params.idempotencyKey))
    .limit(1);
  if (existing[0]) {
    return existing[0].id;
  }

  const journalNumber = await getNextSequence(tx, 'JRN');
  const id = makeId('jrn');
  const today = currentIsoDate();

  await tx.insert(erpAccountingJournals).values({
    id,
    organizationId: ORG_ID,
    journalNumber,
    entryDate: today,
    fiscalPeriod: getFiscalPeriod(today),
    sourceModule: params.sourceModule,
    sourceEntityId: params.sourceEntityId,
    narration: params.narration,
    lines: params.lines,
    totalDebitInr: totalDebit,
    totalCreditInr: totalCredit,
    isBalanced: true,
    isSystemImmutable: true,
    postedByEmail: params.postedByEmail || 'finance@fragmore.shop',
    idempotencyKey: params.idempotencyKey,
    status: 'POSTED',
    version: 1
  });

  return id;
}

// ============================================================================
// SEEDING & CUSTOMER ACCOUNT INITIALIZATION (IDEMPOTENT, NON-DESTRUCTIVE)
// ============================================================================

let rewardsSeedPromise: Promise<void> | null = null;
let rewardsSeedCompleted = false;

export async function ensureRewardsEcosystemSeeded(): Promise<void> {
  if (rewardsSeedCompleted) return;
  if (rewardsSeedPromise) return rewardsSeedPromise;
  rewardsSeedPromise = (async () => {
    try {
      // Fast path when Firestore already holds migrated master config, tiers & wallets
      const [existingCfg, existingTiers, sampleWallets] = await Promise.all([
        db.select().from(rewardsProgramConfig).where(eq(rewardsProgramConfig.id, REWARDS_CONFIG_ID)).limit(1),
        db.select().from(loyaltyTiers).limit(4),
        db.select().from(customerWallets).limit(1)
      ]);
      if (existingCfg.length > 0 && existingTiers.length >= 4 && sampleWallets.length > 0) {
        rewardsSeedCompleted = true;
        return;
      }

      // 1. Master Program Config
      if (!existingCfg.length) {
        await db
          .insert(rewardsProgramConfig)
          .values({
            id: REWARDS_CONFIG_ID,
            organizationId: ORG_ID,
            ...DEFAULT_REWARDS_CONFIG,
            updatedByEmail: 'founder@fragmore.com',
            version: 1
          })
          .onConflictDoNothing();
      }

      // 2. Sequences
      const seqs = [
        { seqKey: 'WLT', prefix: 'WLT-FRG-2026-', currentValue: 1001, padding: 4 },
        { seqKey: 'LPT', prefix: 'LPT-FRG-2026-', currentValue: 1001, padding: 4 },
        { seqKey: 'GCTX', prefix: 'GCT-FRG-2026-', currentValue: 1001, padding: 4 },
        { seqKey: 'CORPGC', prefix: 'CGC-FRG-2026-', currentValue: 101, padding: 3 },
        { seqKey: 'REFC', prefix: 'REF-FRG-2026-', currentValue: 1001, padding: 4 },
        { seqKey: 'OCCR', prefix: 'OCC-FRG-2026-', currentValue: 1001, padding: 4 },
        { seqKey: 'CRES', prefix: 'CRS-FRG-2026-', currentValue: 1001, padding: 4 },
        { seqKey: 'RAPR', prefix: 'RAP-FRG-2026-', currentValue: 1001, padding: 4 }
      ];
      for (const s of seqs) {
        await db.insert(erpSequences).values(s).onConflictDoNothing();
      }

      // 3. Accounting GL Accounts for Gift Cards, Refund Credits, Loyalty & Breakage
      const glAccounts = [
        {
          id: 'coa-2310-gc-liab',
          organizationId: ORG_ID,
          accountCode: '2310',
          accountName: 'Unredeemed Gift Card Deferred Liability',
          accountType: 'LIABILITY',
          subGroup: 'AP',
          normalBalance: 'CREDIT',
          description: 'Deferred liability for paid unredeemed FRAGMORÉ digital, physical & corporate gift cards (not recognized as sales revenue until redeemed).'
        },
        {
          id: 'coa-2320-refund-wlt',
          organizationId: ORG_ID,
          accountCode: '2320',
          accountName: 'Customer Refund Store Credit Liability',
          accountType: 'LIABILITY',
          subGroup: 'AP',
          normalBalance: 'CREDIT',
          description: 'Customer-approved opt-in store credit refund obligations.'
        },
        {
          id: 'coa-2330-loyalty-liab',
          organizationId: ORG_ID,
          accountCode: '2330',
          accountName: 'FRAGMORÉ Privileges Loyalty Points Reserve',
          accountType: 'LIABILITY',
          subGroup: 'AP',
          normalBalance: 'CREDIT',
          description: 'Deferred loyalty points obligation awaiting customer redemption.'
        },
        {
          id: 'coa-5410-promo-exp',
          organizationId: ORG_ID,
          accountCode: '5410',
          accountName: 'Promotional Wallet, Referral & Loyalty Reward Expense',
          accountType: 'EXPENSE',
          subGroup: 'OPERATING_EXPENSE',
          normalBalance: 'DEBIT',
          description: 'Marketing & retention expense for promotional credits, referrals, occasion rewards & loyalty redemptions.'
        },
        {
          id: 'coa-4310-breakage',
          organizationId: ORG_ID,
          accountCode: '4310',
          accountName: 'Accountant-Approved Gift Card & Reward Breakage Income',
          accountType: 'REVENUE',
          subGroup: 'REVENUE',
          normalBalance: 'CREDIT',
          description: 'Recognized only when an accountant-approved breakage policy explicitly clears expired liability.'
        }
      ];
      for (const acct of glAccounts) {
        await db.insert(erpChartOfAccounts).values(acct).onConflictDoNothing();
      }

      // 4. Loyalty Tiers
      for (const tier of DEFAULT_LOYALTY_TIERS) {
        await db.insert(loyaltyTiers).values(tier).onConflictDoNothing();
      }

      // 5. Sync existing customers & historical retained orders into Wallets & Loyalty Accounts
      const existingCustomers = await db.select().from(customers);
      const existingOrders = await db.select().from(orders);

      for (const cust of existingCustomers) {
        if (!cust.email) continue;
        await ensureCustomerWalletAndLoyaltyAccount({
          customerId: cust.id,
          customerEmail: cust.email,
          customerName: cust.name || '',
          birthday: (cust.crmMetadata as any)?.birthday || null,
          promoOptIn: (cust.crmMetadata as any)?.consent?.unsubscribed ? false : true
        });
      }

      // Sync real historical paid/delivered orders into loyalty accounts (idempotent per order)
      for (const ord of existingOrders) {
        const payStatus = String(ord.paymentStatus || '').toUpperCase();
        const ordStatus = String(ord.orderStatus || '').toUpperCase();
        if (
          ord.customerEmail &&
          ordStatus !== 'CANCELLED' &&
          ordStatus !== 'RETURNED' &&
          payStatus !== 'FAILED' &&
          (payStatus === 'PAID' || ordStatus === 'DELIVERED')
        ) {
          await awardOrderLoyaltyPointsTransaction({
            orderId: ord.id,
            orderNumber: ord.orderNumber,
            customerId: ord.customerId,
            customerEmail: ord.customerEmail,
            customerName: ord.customerName,
            subtotalInr: Number(ord.subtotal) || 0,
            discountInr: Number(ord.discount) || 0,
            items: Array.isArray(ord.items) ? ord.items : [],
            matureImmediately: ordStatus === 'DELIVERED',
            actorEmail: 'system@fragmore.shop',
            skipSeedCheck: true
          }).catch(() => {});
        }
      }
      rewardsSeedCompleted = true;
    } catch (err: any) {
      rewardsSeedPromise = null;
      console.warn('[Rewards Ecosystem Seed] Notice:', err?.message || err);
    }
  })();
  return rewardsSeedPromise;
}

export async function getRewardsMasterConfig(skipSeedCheck = false) {
  if (!skipSeedCheck) {
    await ensureRewardsEcosystemSeeded();
  }
  const [row] = await db
    .select()
    .from(rewardsProgramConfig)
    .where(eq(rewardsProgramConfig.id, REWARDS_CONFIG_ID))
    .limit(1);
  return row || { id: REWARDS_CONFIG_ID, ...DEFAULT_REWARDS_CONFIG, version: 1 };
}

function buildReferralCodeForCustomer(name: string, email: string): string {
  const cleanAlpha = (name || email.split('@')[0] || 'FRG')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase()
    .slice(0, 5)
    .padEnd(3, 'X');
  const hashSuffix = crypto.createHash('md5').update(email.toLowerCase()).digest('hex').slice(0, 4).toUpperCase();
  return `FRG-${cleanAlpha}-${hashSuffix}`;
}

export async function ensureCustomerWalletAndLoyaltyAccount(params: {
  customerId?: string;
  customerEmail: string;
  customerName?: string;
  birthday?: string | null;
  anniversary?: string | null;
  preferredFragranceFamily?: string | null;
  promoOptIn?: boolean;
}) {
  const email = String(params.customerEmail || '').trim().toLowerCase();
  if (!email) throw new ValidationError('Valid customer email is required.');

  const custRows = await db.select().from(customers).where(eq(customers.email, email)).limit(1);
  const cust = custRows[0];
  const customerId = params.customerId || cust?.id || `cust-${crypto.createHash('md5').update(email).digest('hex').slice(0, 8)}`;
  const customerName = params.customerName || cust?.name || email.split('@')[0];

  // Ensure Wallet
  let [wallet] = await db.select().from(customerWallets).where(eq(customerWallets.customerEmail, email)).limit(1);
  if (!wallet) {
    const [insertedWallet] = await db
      .insert(customerWallets)
      .values({
        id: makeId('wlt'),
        customerId,
        customerEmail: email,
        customerName,
        status: 'ACTIVE'
      })
      .onConflictDoNothing()
      .returning();
    wallet =
      insertedWallet ||
      (await db.select().from(customerWallets).where(eq(customerWallets.customerEmail, email)).limit(1))[0];
  }

  // Ensure Loyalty Account
  let [loyalty] = await db.select().from(loyaltyAccounts).where(eq(loyaltyAccounts.customerEmail, email)).limit(1);
  if (!loyalty) {
    const memberHash = crypto.createHash('sha256').update(email).digest('hex').slice(0, 6).toUpperCase();
    const referralCode = buildReferralCodeForCustomer(customerName, email);
    const crmMeta = (cust?.crmMetadata as any) || {};
    const [insertedLoyalty] = await db
      .insert(loyaltyAccounts)
      .values({
        id: makeId('loy'),
        customerId,
        customerEmail: email,
        customerName,
        memberNumber: `FP-${new Date().getFullYear()}-${memberHash}`,
        tierCode: String(cust?.tier || '').toUpperCase() === 'VIP' ? 'PLATINUM' : 'SILVER',
        referralCode,
        birthday: params.birthday ?? crmMeta.birthday ?? null,
        anniversary: params.anniversary ?? crmMeta.anniversary ?? null,
        preferredFragranceFamily: params.preferredFragranceFamily ?? cust?.favouriteFragrance ?? null,
        promoOptIn: params.promoOptIn !== undefined ? params.promoOptIn : crmMeta?.consent?.unsubscribed ? false : true,
        status: 'ACTIVE'
      })
      .onConflictDoNothing()
      .returning();
    loyalty =
      insertedLoyalty ||
      (await db.select().from(loyaltyAccounts).where(eq(loyaltyAccounts.customerEmail, email)).limit(1))[0];
  }

  return { wallet, loyalty };
}

function computeTotalAvailableWalletInr(w: typeof customerWallets.$inferSelect): number {
  return round2(
    (Number(w.availableRefundInr) || 0) +
      (Number(w.availablePromoInr) || 0) +
      (Number(w.availableCashbackInr) || 0) +
      (Number(w.availableGoodwillInr) || 0) +
      (Number(w.availableReferralInr) || 0)
  );
}

function getWalletBucketColumnKey(creditType: WalletCreditType) {
  switch (creditType) {
    case 'REFUND_CREDIT':
      return 'availableRefundInr' as const;
    case 'PROMOTIONAL_CREDIT':
      return 'availablePromoInr' as const;
    case 'CASHBACK_REWARD':
      return 'availableCashbackInr' as const;
    case 'GOODWILL_CREDIT':
      return 'availableGoodwillInr' as const;
    case 'REFERRAL_CREDIT':
      return 'availableReferralInr' as const;
    default:
      return 'availablePromoInr' as const;
  }
}

async function recalculateWalletTotalsInTx(tx: any, walletId: string) {
  const buckets = await tx
    .select()
    .from(walletCreditBuckets)
    .where(eq(walletCreditBuckets.walletId, walletId));

  const now = new Date();
  let refund = 0;
  let promo = 0;
  let cashback = 0;
  let goodwill = 0;
  let referral = 0;
  let pending = 0;
  let reserved = 0;

  for (const b of buckets) {
    const rem = Math.max(0, round2(Number(b.remainingAmountInr) || 0));
    const resv = Math.max(0, round2(Number(b.reservedAmountInr) || 0));
    reserved += resv;

    if (b.status === 'PENDING') {
      pending += rem;
      continue;
    }
    if (b.status !== 'ACTIVE') continue;
    if (b.expiresAt && new Date(b.expiresAt) <= now) continue;

    if (b.creditType === 'REFUND_CREDIT') refund += rem;
    else if (b.creditType === 'PROMOTIONAL_CREDIT') promo += rem;
    else if (b.creditType === 'CASHBACK_REWARD') cashback += rem;
    else if (b.creditType === 'GOODWILL_CREDIT') goodwill += rem;
    else if (b.creditType === 'REFERRAL_CREDIT') referral += rem;
  }

  const [updated] = await tx
    .update(customerWallets)
    .set({
      availableRefundInr: round2(refund),
      availablePromoInr: round2(promo),
      availableCashbackInr: round2(cashback),
      availableGoodwillInr: round2(goodwill),
      availableReferralInr: round2(referral),
      pendingCreditsInr: round2(pending),
      reservedCreditsInr: round2(reserved),
      version: sql`${customerWallets.version} + 1`,
      updatedAt: new Date()
    })
    .where(eq(customerWallets.id, walletId))
    .returning();

  return updated;
}

// ============================================================================
// MODULE 1: CUSTOMER WALLET ISSUANCE, ADJUSTMENT & EXPIRY SWEEP
// ============================================================================

export async function issueWalletCreditTransaction(params: {
  customerEmail: string;
  customerName?: string;
  creditType: WalletCreditType;
  amountInr: number;
  sourceType: string;
  sourceRefId?: string;
  reason: string;
  minOrderValueInr?: number;
  maxOrderPct?: number;
  expiresInDays?: number | null;
  isPendingMaturation?: boolean;
  maturesAt?: Date | null;
  customerOptedInStoreCredit?: boolean;
  idempotencyKey: string;
  actorEmail: string;
  actorRole: string;
}) {
  await ensureRewardsEcosystemSeeded();
  const amount = round2(Number(params.amountInr) || 0);
  if (amount <= 0) throw new ValidationError('Credit amount must be greater than ₹0.');
  if (!params.reason || !params.reason.trim()) {
    throw new ValidationError('A clear auditable reason is mandatory when issuing wallet credits.');
  }

  // Enforce opt-in requirement for order refund store credits
  if (params.creditType === 'REFUND_CREDIT' && params.sourceType === 'ORDER_REFUND_OPT_IN' && !params.customerOptedInStoreCredit) {
    throw new ValidationError(
      'Refund store credit can only be issued when the customer explicitly selects store-credit refund.'
    );
  }

  const cfg = await getRewardsMasterConfig();
  const walletCfg = (cfg.walletConfig as any) || DEFAULT_REWARDS_CONFIG.walletConfig;
  const { wallet } = await ensureCustomerWalletAndLoyaltyAccount({
    customerEmail: params.customerEmail,
    customerName: params.customerName
  });

  return db.transaction(async (tx) => {
    const existingTx = await tx
      .select()
      .from(walletTransactions)
      .where(eq(walletTransactions.idempotencyKey, params.idempotencyKey))
      .limit(1);
    if (existingTx[0]) {
      const [currWallet] = await tx.select().from(customerWallets).where(eq(customerWallets.id, wallet.id));
      return { wallet: currWallet, transaction: existingTx[0], deduplicated: true };
    }

    const [lockedWallet] = await tx
      .select()
      .from(customerWallets)
      .where(eq(customerWallets.id, wallet.id))
      .for('update');

    if (lockedWallet.status === 'FROZEN') {
      throw new ValidationError('Customer wallet is currently frozen for risk review.');
    }

    const beforeAvailable = computeTotalAvailableWalletInr(lockedWallet);
    const defaultDays = walletCfg.bucketExpiryDays?.[params.creditType] ?? 180;
    const expDays = params.expiresInDays === undefined ? defaultDays : params.expiresInDays;
    const expiresAt = expDays && expDays > 0 ? new Date(Date.now() + expDays * 86400000) : null;

    const bucketId = makeId('wcb');
    const bucketStatus = params.isPendingMaturation ? 'PENDING' : 'ACTIVE';

    await tx.insert(walletCreditBuckets).values({
      id: bucketId,
      walletId: lockedWallet.id,
      customerEmail: lockedWallet.customerEmail,
      creditType: params.creditType,
      status: bucketStatus,
      originalAmountInr: amount,
      remainingAmountInr: amount,
      reservedAmountInr: 0,
      minOrderValueInr: round2(params.minOrderValueInr ?? (params.creditType === 'REFUND_CREDIT' ? 0 : 499)),
      maxOrderPct: round2(params.maxOrderPct ?? (params.creditType === 'REFUND_CREDIT' ? 100 : walletCfg.maxPromoWalletOrderPct || 50)),
      stackableWithCoupons: params.creditType === 'REFUND_CREDIT',
      stackableWithPoints: true,
      excludedCategories: ['Gift Cards'],
      sourceType: params.sourceType,
      sourceRefId: params.sourceRefId || null,
      reason: params.reason.trim(),
      issuedByEmail: params.actorEmail,
      approvedByEmail: params.actorEmail,
      maturesAt: params.maturesAt || null,
      expiresAt
    });

    await tx
      .update(customerWallets)
      .set({
        totalReceivedInr: round2((Number(lockedWallet.totalReceivedInr) || 0) + (bucketStatus === 'ACTIVE' ? amount : 0))
      })
      .where(eq(customerWallets.id, lockedWallet.id));

    const updatedWallet = await recalculateWalletTotalsInTx(tx, lockedWallet.id);
    const afterAvailable = computeTotalAvailableWalletInr(updatedWallet);

    // Post Accounting GL for Refund Credit Liability (2320) upon opt-in refund issuance
    let journalId: string | null = null;
    if (params.creditType === 'REFUND_CREDIT' && bucketStatus === 'ACTIVE') {
      journalId = await postRewardsAccountingJournal(tx, {
        sourceModule: 'WALLET_REFUND_CREDIT',
        sourceEntityId: bucketId,
        narration: `Customer opt-in store credit refund issued to ${lockedWallet.customerEmail} (${params.reason})`,
        idempotencyKey: `gl_wlt_ref_${params.idempotencyKey}`,
        postedByEmail: params.actorEmail,
        lines: [
          {
            accountCode: '4000',
            accountName: 'Sales Returns & Refund Allowances',
            accountType: 'REVENUE',
            debitInr: amount,
            creditInr: 0,
            costCenter: 'CC-510'
          },
          {
            accountCode: '2320',
            accountName: 'Customer Refund Store Credit Liability',
            accountType: 'LIABILITY',
            debitInr: 0,
            creditInr: amount,
            costCenter: 'CC-510'
          }
        ]
      });
    }

    const refNumber = await getNextSequence(tx, 'WLT');
    const [txRow] = await tx
      .insert(walletTransactions)
      .values({
        id: makeId('wtx'),
        referenceNumber: refNumber,
        idempotencyKey: params.idempotencyKey,
        walletId: lockedWallet.id,
        bucketId,
        customerEmail: lockedWallet.customerEmail,
        txnType: bucketStatus === 'PENDING' ? 'PENDING_GRANT' : 'CREDIT_GRANT',
        creditType: params.creditType,
        direction: 'CREDIT',
        amountInr: amount,
        availableBalanceBeforeInr: beforeAvailable,
        availableBalanceAfterInr: afterAvailable,
        orderId: params.sourceType.includes('ORDER') ? params.sourceRefId || null : null,
        journalId,
        reason: params.reason.trim(),
        actorEmail: params.actorEmail,
        actorRole: params.actorRole,
        metadata: { expiresAt: expiresAt?.toISOString() || null, sourceType: params.sourceType }
      })
      .returning();

    await recordErpAuditLog(tx, {
      action: 'WALLET_CREDIT_ISSUED',
      entity: 'customer_wallets',
      entityId: lockedWallet.id,
      actorEmail: params.actorEmail,
      actorRole: params.actorRole,
      details: `Issued ₹${amount} (${params.creditType}) to ${lockedWallet.customerEmail}. Ref: ${refNumber}. Reason: ${params.reason}`
    });

    return { wallet: updatedWallet, transaction: txRow, deduplicated: false };
  });
}

export async function debitOrReverseWalletAdminTransaction(params: {
  customerEmail: string;
  amountInr: number;
  creditType?: WalletCreditType;
  reason: string;
  idempotencyKey: string;
  actorEmail: string;
  actorRole: string;
}) {
  const amount = round2(Number(params.amountInr) || 0);
  if (amount <= 0) throw new ValidationError('Debit/reversal amount must be greater than ₹0.');
  if (!params.reason || !params.reason.trim()) {
    throw new ValidationError('Mandatory audit reason is required for wallet debit/reversal.');
  }

  const { wallet } = await ensureCustomerWalletAndLoyaltyAccount({ customerEmail: params.customerEmail });

  return db.transaction(async (tx) => {
    const [lockedWallet] = await tx
      .select()
      .from(customerWallets)
      .where(eq(customerWallets.id, wallet.id))
      .for('update');

    const beforeAvailable = computeTotalAvailableWalletInr(lockedWallet);
    if (beforeAvailable < amount) {
      throw new ValidationError(
        `Cannot reverse ₹${amount}: customer only has ₹${beforeAvailable} available wallet balance (negative balances prohibited).`
      );
    }

    const buckets = await tx
      .select()
      .from(walletCreditBuckets)
      .where(and(eq(walletCreditBuckets.walletId, lockedWallet.id), eq(walletCreditBuckets.status, 'ACTIVE')))
      .orderBy(asc(walletCreditBuckets.expiresAt), asc(walletCreditBuckets.createdAt))
      .for('update');

    let remainingToDeduct = amount;
    for (const b of buckets) {
      if (remainingToDeduct <= 0) break;
      if (params.creditType && b.creditType !== params.creditType) continue;
      const bRem = round2(Number(b.remainingAmountInr) || 0);
      if (bRem <= 0) continue;
      const take = Math.min(bRem, remainingToDeduct);
      const nextRem = round2(bRem - take);
      await tx
        .update(walletCreditBuckets)
        .set({
          remainingAmountInr: nextRem,
          status: nextRem <= 0 ? 'REVERSED' : 'ACTIVE',
          updatedAt: new Date()
        })
        .where(eq(walletCreditBuckets.id, b.id));
      remainingToDeduct = round2(remainingToDeduct - take);
    }

    if (remainingToDeduct > 0) {
      throw new ValidationError(
        `Insufficient balance in specified credit bucket (${params.creditType || 'ANY'}) to reverse ₹${amount}.`
      );
    }

    const updatedWallet = await recalculateWalletTotalsInTx(tx, lockedWallet.id);
    const afterAvailable = computeTotalAvailableWalletInr(updatedWallet);
    const refNumber = await getNextSequence(tx, 'WLT');

    const [txRow] = await tx
      .insert(walletTransactions)
      .values({
        id: makeId('wtx'),
        referenceNumber: refNumber,
        idempotencyKey: params.idempotencyKey,
        walletId: lockedWallet.id,
        customerEmail: lockedWallet.customerEmail,
        txnType: 'ADMIN_ADJUSTMENT',
        creditType: params.creditType || 'PROMOTIONAL_CREDIT',
        direction: 'DEBIT',
        amountInr: amount,
        availableBalanceBeforeInr: beforeAvailable,
        availableBalanceAfterInr: afterAvailable,
        reason: params.reason.trim(),
        actorEmail: params.actorEmail,
        actorRole: params.actorRole
      })
      .returning();

    await recordErpAuditLog(tx, {
      action: 'WALLET_DEBIT_ADJUSTMENT',
      entity: 'customer_wallets',
      entityId: lockedWallet.id,
      actorEmail: params.actorEmail,
      actorRole: params.actorRole,
      details: `Reversed/debited ₹${amount} from ${lockedWallet.customerEmail}. Ref: ${refNumber}. Reason: ${params.reason}`
    });

    return { wallet: updatedWallet, transaction: txRow };
  });
}

// ============================================================================
// MODULE 2 & 5: FRAGMORÉ PRIVILEGES LOYALTY POINTS & TIER RECALCULATION
// ============================================================================

export async function recalculateLoyaltyTierInTx(tx: any, loyaltyAccountId: string) {
  const [acct] = await tx
    .select()
    .from(loyaltyAccounts)
    .where(eq(loyaltyAccounts.id, loyaltyAccountId))
    .for('update');
  if (!acct) return null;

  const tiers = await tx
    .select()
    .from(loyaltyTiers)
    .where(eq(loyaltyTiers.isActive, true))
    .orderBy(desc(loyaltyTiers.minQualifyingSpendInr));

  const spend = Number(acct.qualifyingNetSpendInr) || 0;
  let matchedTierCode: LoyaltyTierCode = 'SILVER';
  let durationMonths = 12;

  for (const t of tiers) {
    if (spend >= (Number(t.minQualifyingSpendInr) || 0)) {
      matchedTierCode = t.tierCode as LoyaltyTierCode;
      durationMonths = Number(t.durationMonths) || 12;
      break;
    }
  }

  const tierChanged = acct.tierCode !== matchedTierCode;
  const tierExpiresAt = new Date(Date.now() + durationMonths * 30 * 86400000);

  const [updated] = await tx
    .update(loyaltyAccounts)
    .set({
      tierCode: matchedTierCode,
      ...(tierChanged ? { tierQualifiedAt: new Date(), tierExpiresAt } : {}),
      version: sql`${loyaltyAccounts.version} + 1`,
      updatedAt: new Date()
    })
    .where(eq(loyaltyAccounts.id, loyaltyAccountId))
    .returning();

  if (tierChanged && (matchedTierCode === 'GOLD' || matchedTierCode === 'PLATINUM' || matchedTierCode === 'PRIVATE_ATELIER')) {
    ingestAutomationEvent({
      eventType: 'vip.tier_upgraded',
      source: 'fragmore_privileges_engine',
      idempotencyKey: `tier_up_${acct.customerEmail}_${matchedTierCode}_${new Date().toISOString().slice(0, 10)}`,
      customerEmail: acct.customerEmail,
      payload: {
        customerEmail: acct.customerEmail,
        previousTier: acct.tierCode,
        newTier: matchedTierCode,
        qualifyingNetSpendInr: spend
      }
    }).catch(() => {});
  }

  return updated;
}

export async function awardOrderLoyaltyPointsTransaction(params: {
  orderId: string;
  orderNumber: string;
  customerId?: string;
  customerEmail: string;
  customerName?: string;
  subtotalInr: number;
  discountInr: number;
  items: any[];
  matureImmediately?: boolean;
  actorEmail?: string;
  skipSeedCheck?: boolean;
}) {
  if (!params.skipSeedCheck) {
    await ensureRewardsEcosystemSeeded();
  }
  const cfg = await getRewardsMasterConfig(Boolean(params.skipSeedCheck));
  const loyCfg = (cfg.loyaltyConfig as any) || DEFAULT_REWARDS_CONFIG.loyaltyConfig;

  const email = String(params.customerEmail || '').trim().toLowerCase();
  if (!email) return null;

  // Exclude Gift Card items from earning loyalty points unless explicitly enabled
  const eligibleItemsValue = (Array.isArray(params.items) ? params.items : []).reduce((sum, item) => {
    const name = String(item.productName || '').toLowerCase();
    const sku = String(item.sku || '').toUpperCase();
    const isGiftCard = name.includes('gift card') || sku.startsWith('GC-') || sku.startsWith('FRG-GC');
    if (isGiftCard && !loyCfg.awardOnGiftCardPurchase) return sum;
    return sum + (Number(item.totalPrice) || (Number(item.unitPrice) || 0) * (Number(item.quantity) || 1));
  }, 0);

  const baseSubtotal = eligibleItemsValue > 0 ? eligibleItemsValue : Number(params.subtotalInr) || 0;
  const qualifyingNetMerchandiseInr = Math.max(0, round2(baseSubtotal - (Number(params.discountInr) || 0)));

  if (qualifyingNetMerchandiseInr < (Number(loyCfg.minQualifyingPurchaseInr) || 0)) {
    return { awarded: false, reason: 'Below minimum qualifying order value', points: 0 };
  }

  const { loyalty } = await ensureCustomerWalletAndLoyaltyAccount({
    customerId: params.customerId,
    customerEmail: email,
    customerName: params.customerName
  });

  const tiers = await db.select().from(loyaltyTiers);
  const currentTier = tiers.find((t) => t.tierCode === loyalty.tierCode) || DEFAULT_LOYALTY_TIERS[0];
  const tierMultiplier = Number(currentTier.pointsMultiplier) || 1.0;
  const campaignMultiplier = Number(loyCfg.activeCampaignMultiplier) || 1.0;
  const ptsPer100 = Number(loyCfg.earnPointsPer100Inr) || 5;

  const rawPoints = Math.floor((qualifyingNetMerchandiseInr / 100) * ptsPer100 * tierMultiplier * campaignMultiplier);
  if (rawPoints <= 0) return { awarded: false, points: 0 };

  const rupeeValue = round2((rawPoints / (Number(loyCfg.redeemPointsUnit) || 100)) * (Number(loyCfg.redeemRupeePerUnitInr) || 10));
  const idempKey = `order_earn_${params.orderId}`;

  return db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(loyaltyPointsLedger)
      .where(eq(loyaltyPointsLedger.idempotencyKey, idempKey))
      .limit(1);

    if (existing[0]) {
      // If order was previously PENDING_EARN and is now DELIVERED/matureImmediately, mature it!
      if (params.matureImmediately && existing[0].entryType === 'PENDING_EARN') {
        const matureIdemp = `order_mature_${params.orderId}`;
        const alreadyMatured = await tx
          .select()
          .from(loyaltyPointsLedger)
          .where(eq(loyaltyPointsLedger.idempotencyKey, matureIdemp))
          .limit(1);
        if (!alreadyMatured[0]) {
          const [lockedAcct] = await tx
            .select()
            .from(loyaltyAccounts)
            .where(eq(loyaltyAccounts.id, loyalty.id))
            .for('update');
          const beforeAvail = Number(lockedAcct.availablePoints) || 0;
          const afterAvail = beforeAvail + existing[0].pointsDelta;
          const nextPending = Math.max(0, (Number(lockedAcct.pendingPoints) || 0) - existing[0].pointsDelta);
          await tx
            .update(loyaltyAccounts)
            .set({
              availablePoints: afterAvail,
              pendingPoints: nextPending,
              lifetimeEarnedPoints: (Number(lockedAcct.lifetimeEarnedPoints) || 0) + existing[0].pointsDelta,
              qualifyingNetSpendInr: round2((Number(lockedAcct.qualifyingNetSpendInr) || 0) + qualifyingNetMerchandiseInr),
              qualifyingOrdersCount: (Number(lockedAcct.qualifyingOrdersCount) || 0) + 1,
              updatedAt: new Date()
            })
            .where(eq(loyaltyAccounts.id, loyalty.id));

          const refNo = await getNextSequence(tx, 'LPT');
          await tx.insert(loyaltyPointsLedger).values({
            id: makeId('lpl'),
            referenceNumber: refNo,
            idempotencyKey: matureIdemp,
            loyaltyAccountId: loyalty.id,
            customerEmail: email,
            entryType: 'MATURED_EARN',
            pointsDelta: existing[0].pointsDelta,
            remainingBatchPoints: existing[0].pointsDelta,
            availablePointsBefore: beforeAvail,
            availablePointsAfter: afterAvail,
            rupeeEquivalentInr: rupeeValue,
            orderId: params.orderId,
            orderNumber: params.orderNumber,
            expiresAt: new Date(Date.now() + (Number(loyCfg.pointsValidityMonths) || 12) * 30 * 86400000),
            reason: `Matured points on delivered order ${params.orderNumber}`,
            actorEmail: params.actorEmail || 'system@fragmore.shop',
            actorRole: 'SYSTEM'
          });
          await recalculateLoyaltyTierInTx(tx, loyalty.id);
        }
      }
      return { awarded: true, deduplicated: true, points: existing[0].pointsDelta };
    }

    const [lockedAcct] = await tx
      .select()
      .from(loyaltyAccounts)
      .where(eq(loyaltyAccounts.id, loyalty.id))
      .for('update');

    const beforeAvail = Number(lockedAcct.availablePoints) || 0;
    const holdDays = Number(loyCfg.returnWindowHoldDays) || 7;
    const maturesAt = params.matureImmediately ? new Date() : new Date(Date.now() + holdDays * 86400000);
    const expiresAt = new Date(Date.now() + (Number(loyCfg.pointsValidityMonths) || 12) * 30 * 86400000);

    const entryType = params.matureImmediately ? 'MATURED_EARN' : 'PENDING_EARN';
    const afterAvail = params.matureImmediately ? beforeAvail + rawPoints : beforeAvail;

    await tx
      .update(loyaltyAccounts)
      .set({
        availablePoints: afterAvail,
        pendingPoints: params.matureImmediately
          ? Number(lockedAcct.pendingPoints) || 0
          : (Number(lockedAcct.pendingPoints) || 0) + rawPoints,
        lifetimeEarnedPoints: params.matureImmediately
          ? (Number(lockedAcct.lifetimeEarnedPoints) || 0) + rawPoints
          : Number(lockedAcct.lifetimeEarnedPoints) || 0,
        qualifyingNetSpendInr: params.matureImmediately
          ? round2((Number(lockedAcct.qualifyingNetSpendInr) || 0) + qualifyingNetMerchandiseInr)
          : Number(lockedAcct.qualifyingNetSpendInr) || 0,
        qualifyingOrdersCount: params.matureImmediately
          ? (Number(lockedAcct.qualifyingOrdersCount) || 0) + 1
          : Number(lockedAcct.qualifyingOrdersCount) || 0,
        updatedAt: new Date()
      })
      .where(eq(loyaltyAccounts.id, loyalty.id));

    let journalId: string | null = null;
    if (params.matureImmediately && rupeeValue > 0) {
      journalId = await postRewardsAccountingJournal(tx, {
        sourceModule: 'LOYALTY_POINTS_ACCRUAL',
        sourceEntityId: params.orderId,
        narration: `FRAGMORÉ Privileges loyalty accrual (${rawPoints} pts) on order ${params.orderNumber}`,
        idempotencyKey: `gl_loy_earn_${params.orderId}`,
        postedByEmail: params.actorEmail || 'system@fragmore.shop',
        lines: [
          {
            accountCode: '5410',
            accountName: 'Promotional Wallet, Referral & Loyalty Reward Expense',
            accountType: 'EXPENSE',
            debitInr: rupeeValue,
            creditInr: 0,
            costCenter: 'CC-610'
          },
          {
            accountCode: '2330',
            accountName: 'FRAGMORÉ Privileges Loyalty Points Reserve',
            accountType: 'LIABILITY',
            debitInr: 0,
            creditInr: rupeeValue,
            costCenter: 'CC-510'
          }
        ]
      });
    }

    const refNumber = await getNextSequence(tx, 'LPT');
    await tx.insert(loyaltyPointsLedger).values({
      id: makeId('lpl'),
      referenceNumber: refNumber,
      idempotencyKey: idempKey,
      loyaltyAccountId: loyalty.id,
      customerEmail: email,
      entryType,
      pointsDelta: rawPoints,
      remainingBatchPoints: params.matureImmediately ? rawPoints : 0,
      availablePointsBefore: beforeAvail,
      availablePointsAfter: afterAvail,
      rupeeEquivalentInr: rupeeValue,
      orderId: params.orderId,
      orderNumber: params.orderNumber,
      maturesAt,
      expiresAt,
      journalId,
      reason: `Qualifying net spend ₹${qualifyingNetMerchandiseInr} on order ${params.orderNumber} (${tierMultiplier}x tier)`,
      actorEmail: params.actorEmail || 'system@fragmore.shop',
      actorRole: 'SYSTEM'
    });

    if (params.matureImmediately) {
      await recalculateLoyaltyTierInTx(tx, loyalty.id);
    }

    return { awarded: true, deduplicated: false, points: rawPoints, status: entryType };
  });
}

export async function adjustLoyaltyPointsAdminTransaction(params: {
  customerEmail: string;
  pointsDelta: number;
  reason: string;
  idempotencyKey: string;
  actorEmail: string;
  actorRole: string;
}) {
  const delta = Math.trunc(Number(params.pointsDelta) || 0);
  if (delta === 0) throw new ValidationError('Points delta must be non-zero.');
  if (!params.reason || !params.reason.trim()) {
    throw new ValidationError('Mandatory reason is required for loyalty points adjustment.');
  }

  const cfg = await getRewardsMasterConfig();
  const loyCfg = (cfg.loyaltyConfig as any) || DEFAULT_REWARDS_CONFIG.loyaltyConfig;
  const { loyalty } = await ensureCustomerWalletAndLoyaltyAccount({ customerEmail: params.customerEmail });

  return db.transaction(async (tx) => {
    const [lockedAcct] = await tx
      .select()
      .from(loyaltyAccounts)
      .where(eq(loyaltyAccounts.id, loyalty.id))
      .for('update');

    const beforeAvail = Number(lockedAcct.availablePoints) || 0;
    const afterAvail = beforeAvail + delta;
    if (afterAvail < 0) {
      throw new ValidationError(
        `Cannot deduct ${Math.abs(delta)} points: customer only has ${beforeAvail} available points (negative balances prohibited).`
      );
    }

    await tx
      .update(loyaltyAccounts)
      .set({
        availablePoints: afterAvail,
        lifetimeEarnedPoints: delta > 0 ? (Number(lockedAcct.lifetimeEarnedPoints) || 0) + delta : lockedAcct.lifetimeEarnedPoints,
        lifetimeReversedPoints:
          delta < 0 ? (Number(lockedAcct.lifetimeReversedPoints) || 0) + Math.abs(delta) : lockedAcct.lifetimeReversedPoints,
        version: sql`${loyaltyAccounts.version} + 1`,
        updatedAt: new Date()
      })
      .where(eq(loyaltyAccounts.id, loyalty.id));

    const rupeeEq = round2(
      (Math.abs(delta) / (Number(loyCfg.redeemPointsUnit) || 100)) * (Number(loyCfg.redeemRupeePerUnitInr) || 10)
    );
    const refNo = await getNextSequence(tx, 'LPT');
    const [entry] = await tx
      .insert(loyaltyPointsLedger)
      .values({
        id: makeId('lpl'),
        referenceNumber: refNo,
        idempotencyKey: params.idempotencyKey,
        loyaltyAccountId: loyalty.id,
        customerEmail: lockedAcct.customerEmail,
        entryType: 'ADMIN_ADJUST',
        pointsDelta: delta,
        remainingBatchPoints: delta > 0 ? delta : 0,
        availablePointsBefore: beforeAvail,
        availablePointsAfter: afterAvail,
        rupeeEquivalentInr: rupeeEq,
        expiresAt: delta > 0 ? new Date(Date.now() + 365 * 86400000) : null,
        reason: params.reason.trim(),
        actorEmail: params.actorEmail,
        actorRole: params.actorRole
      })
      .returning();

    await recordErpAuditLog(tx, {
      action: 'LOYALTY_POINTS_ADJUSTED',
      entity: 'loyalty_accounts',
      entityId: loyalty.id,
      actorEmail: params.actorEmail,
      actorRole: params.actorRole,
      details: `Adjusted loyalty points by ${delta > 0 ? `+${delta}` : delta} for ${lockedAcct.customerEmail}. Ref: ${refNo}. Reason: ${params.reason}`
    });

    return { loyaltyAccount: { ...lockedAcct, availablePoints: afterAvail }, ledgerEntry: entry };
  });
}

// ============================================================================
// MODULE 3 & 8: DIGITAL, PHYSICAL, CORPORATE & EVENT POS GIFT CARDS
// ============================================================================

export async function createGiftCardOrderTransaction(params: {
  cardFormat?: 'DIGITAL' | 'PHYSICAL' | 'EVENT_POS';
  templateId?: string;
  occasion: string;
  amountInr: number;
  purchaserCustomerId?: string;
  purchaserName: string;
  purchaserEmail: string;
  senderName: string;
  recipientName: string;
  recipientEmail?: string;
  recipientPhone?: string;
  personalMessage?: string;
  scheduledDeliveryDate?: string;
  paymentMethodUsed?: string;
  paymentConfirmedImmediately?: boolean;
  purchaseOrderId?: string;
  purchaseOrderNumber?: string;
  actorEmail?: string;
}) {
  await ensureRewardsEcosystemSeeded();
  const cfg = await getRewardsMasterConfig();
  const gcCfg = (cfg.giftCardConfig as any) || DEFAULT_REWARDS_CONFIG.giftCardConfig;

  const amount = round2(Number(params.amountInr) || 0);
  const minAmt = Number(gcCfg.minCustomAmountInr) || 250;
  const maxAmt = Number(gcCfg.maxCustomAmountInr) || 25000;
  if (amount < minAmt || amount > maxAmt) {
    throw new ValidationError(`Gift card value must be between ₹${minAmt} and ₹${maxAmt}.`);
  }

  // Strictly block buying a gift card using another gift card unless explicitly enabled
  const payMethodUpper = String(params.paymentMethodUsed || '').toUpperCase();
  if (!gcCfg.allowGiftCardToBuyGiftCard && (payMethodUpper.includes('GIFT_CARD') || payMethodUpper.includes('PROMO_WALLET'))) {
    throw new ValidationError(
      'Gift cards and promotional wallet credits cannot be used to purchase a FRAGMORÉ Gift Card.'
    );
  }

  if (!params.recipientEmail && !params.recipientPhone && params.cardFormat !== 'PHYSICAL') {
    throw new ValidationError('Recipient email or mobile number is required for digital gift card delivery.');
  }

  const cardNumber = generateGiftCardPublicNumber();
  const rawSecretCode = generateGiftCardSecretCode();
  const codeHash = hashSecretValue(rawSecretCode);
  const encryptedCode = encryptGiftCardCode(rawSecretCode);
  const maskedCode = maskGiftCardCode(rawSecretCode);
  const qrTokenRaw = `FRGQR-${cardNumber}-${randomSafeChars(8)}`;
  const qrTokenHash = hashSecretValue(qrTokenRaw);

  const validityMonths = Number(gcCfg.validityMonths) || 12;
  const expiresAt = new Date(Date.now() + validityMonths * 30 * 86400000);
  const todayStr = currentIsoDate();
  const isScheduledFuture = Boolean(params.scheduledDeliveryDate && params.scheduledDeliveryDate > todayStr);

  return db.transaction(async (tx) => {
    const isPaid = Boolean(params.paymentConfirmedImmediately);
    const initialStatus = !isPaid ? 'PENDING_PAYMENT' : isScheduledFuture ? 'SCHEDULED' : 'ACTIVE';

    const cardId = makeId('gc');
    let issuanceJournalId: string | null = null;

    if (isPaid) {
      // Deferred Liability Accounting: NEVER recognize gift card sales proceeds as product revenue at issuance!
      issuanceJournalId = await postRewardsAccountingJournal(tx, {
        sourceModule: 'GIFT_CARD_ISSUANCE',
        sourceEntityId: cardId,
        narration: `Gift Card ${cardNumber} issued upon confirmed payment (Deferred Liability — zero product revenue at issuance)`,
        idempotencyKey: `gl_gc_issue_${cardId}`,
        postedByEmail: params.actorEmail || params.purchaserEmail,
        lines: [
          {
            accountCode: '1010',
            accountName: 'HDFC Bank / Payment Gateway Clearing',
            accountType: 'ASSET',
            debitInr: amount,
            creditInr: 0,
            costCenter: 'CC-510'
          },
          {
            accountCode: '2310',
            accountName: 'Unredeemed Gift Card Deferred Liability',
            accountType: 'LIABILITY',
            debitInr: 0,
            creditInr: amount,
            costCenter: 'CC-510'
          }
        ]
      });
    }

    const [created] = await tx
      .insert(giftCards)
      .values({
        id: cardId,
        cardNumber,
        codeHash,
        encryptedCode,
        maskedCode,
        qrTokenHash,
        cardFormat: params.cardFormat || 'DIGITAL',
        templateId: params.templateId || 'ivory-champagne-atelier',
        occasion: params.occasion || 'Corporate Gift',
        initialValueInr: amount,
        remainingBalanceInr: isPaid ? amount : 0, // Zero spendable balance until payment is confirmed!
        reservedBalanceInr: 0,
        currency: 'INR',
        purchaserCustomerId: params.purchaserCustomerId || null,
        purchaserName: params.purchaserName.trim(),
        purchaserEmail: params.purchaserEmail.trim().toLowerCase(),
        senderName: params.senderName.trim(),
        recipientName: params.recipientName.trim(),
        recipientEmail: params.recipientEmail ? params.recipientEmail.trim().toLowerCase() : null,
        recipientPhone: params.recipientPhone ? params.recipientPhone.trim() : null,
        personalMessage: params.personalMessage || null,
        scheduledDeliveryDate: params.scheduledDeliveryDate || todayStr,
        deliveredAt: isPaid && !isScheduledFuture ? new Date() : null,
        purchaseOrderId: params.purchaseOrderId || null,
        purchaseOrderNumber: params.purchaseOrderNumber || null,
        paymentStatus: isPaid ? 'PAID' : 'PENDING_PAYMENT',
        status: initialStatus,
        issuanceJournalId,
        expiresAt,
        version: 1
      })
      .returning();

    if (isPaid) {
      const refNo = await getNextSequence(tx, 'GCTX');
      await tx.insert(giftCardTransactions).values({
        id: makeId('gctx'),
        referenceNumber: refNo,
        idempotencyKey: `gc_activate_${cardId}`,
        giftCardId: cardId,
        cardNumber,
        txnType: 'ISSUANCE_ACTIVATED',
        channel: params.cardFormat === 'EVENT_POS' ? 'EVENT_PERFUME_BAR_POS' : 'WEB_STOREFRONT',
        amountInr: amount,
        balanceBeforeInr: 0,
        balanceAfterInr: amount,
        orderId: params.purchaseOrderId || null,
        orderNumber: params.purchaseOrderNumber || null,
        journalId: issuanceJournalId,
        notes: `Activated after confirmed payment for ${params.recipientName}`
      });

      ingestAutomationEvent({
        eventType: 'gift_card.issued',
        source: 'gift_fragmore_atelier',
        idempotencyKey: `gc_issued_evt_${cardId}`,
        customerEmail: params.recipientEmail || params.purchaserEmail,
        payload: {
          cardNumber,
          maskedCode,
          occasion: params.occasion,
          initialValueInr: amount,
          senderName: params.senderName,
          recipientName: params.recipientName,
          recipientEmail: params.recipientEmail,
          scheduledDeliveryDate: params.scheduledDeliveryDate || todayStr
        }
      }).catch(() => {});
    }

    return {
      giftCard: {
        ...created,
        codeHash: undefined,
        encryptedCode: undefined,
        qrTokenHash: undefined
      },
      // Secret redemption code is ONLY revealed once paymentStatus === 'PAID'!
      ...(isPaid
        ? {
            deliveryCredential: {
              redemptionCode: rawSecretCode,
              qrPayload: qrTokenRaw,
              notice: 'Issued after verified payment. Store securely.'
            }
          }
        : {
            pendingPaymentNotice:
              'Gift card is in PENDING_PAYMENT state. Secret redemption code and balance activation occur strictly after confirmed payment.'
          })
    };
  });
}

export async function confirmGiftCardPaymentAndActivate(params: {
  giftCardId: string;
  paymentReference: string;
  actorEmail: string;
  actorRole: string;
}) {
  return db.transaction(async (tx) => {
    const [card] = await tx
      .select()
      .from(giftCards)
      .where(eq(giftCards.id, params.giftCardId))
      .for('update');
    if (!card) throw new NotFoundError('Gift card record not found.');
    if (card.paymentStatus === 'PAID' && (card.status === 'ACTIVE' || card.status === 'SCHEDULED')) {
      const secretCode = decryptGiftCardCodeForAuthorizedDelivery(card.encryptedCode);
      return {
        giftCard: { ...card, codeHash: undefined, encryptedCode: undefined, qrTokenHash: undefined },
        deliveryCredential: { redemptionCode: secretCode }
      };
    }

    const todayStr = currentIsoDate();
    const isScheduledFuture = Boolean(card.scheduledDeliveryDate && card.scheduledDeliveryDate > todayStr);
    const nextStatus = isScheduledFuture ? 'SCHEDULED' : 'ACTIVE';

    const journalId = await postRewardsAccountingJournal(tx, {
      sourceModule: 'GIFT_CARD_ISSUANCE',
      sourceEntityId: card.id,
      narration: `Gift Card ${card.cardNumber} activated upon confirmed payment (${params.paymentReference})`,
      idempotencyKey: `gl_gc_issue_${card.id}`,
      postedByEmail: params.actorEmail,
      lines: [
        {
          accountCode: '1010',
          accountName: 'HDFC Bank / Payment Gateway Clearing',
          accountType: 'ASSET',
          debitInr: Number(card.initialValueInr),
          creditInr: 0,
          costCenter: 'CC-510'
        },
        {
          accountCode: '2310',
          accountName: 'Unredeemed Gift Card Deferred Liability',
          accountType: 'LIABILITY',
          debitInr: 0,
          creditInr: Number(card.initialValueInr),
          costCenter: 'CC-510'
        }
      ]
    });

    const [updated] = await tx
      .update(giftCards)
      .set({
        paymentStatus: 'PAID',
        status: nextStatus,
        remainingBalanceInr: Number(card.initialValueInr),
        deliveredAt: isScheduledFuture ? null : new Date(),
        issuanceJournalId: journalId,
        version: sql`${giftCards.version} + 1`,
        updatedAt: new Date()
      })
      .where(eq(giftCards.id, card.id))
      .returning();

    const refNo = await getNextSequence(tx, 'GCTX');
    await tx.insert(giftCardTransactions).values({
      id: makeId('gctx'),
      referenceNumber: refNo,
      idempotencyKey: `gc_activate_${card.id}`,
      giftCardId: card.id,
      cardNumber: card.cardNumber,
      txnType: 'ISSUANCE_ACTIVATED',
      channel: 'WEB_STOREFRONT',
      amountInr: Number(card.initialValueInr),
      balanceBeforeInr: 0,
      balanceAfterInr: Number(card.initialValueInr),
      journalId,
      verifiedByStaffEmail: params.actorEmail,
      notes: `Payment confirmed (${params.paymentReference})`
    });

    await recordErpAuditLog(tx, {
      action: 'GIFT_CARD_PAYMENT_CONFIRMED',
      entity: 'gift_cards',
      entityId: card.id,
      actorEmail: params.actorEmail,
      actorRole: params.actorRole,
      details: `Activated Gift Card ${card.cardNumber} (₹${card.initialValueInr}) after verified payment ${params.paymentReference}`
    });

    const secretCode = decryptGiftCardCodeForAuthorizedDelivery(card.encryptedCode);
    return {
      giftCard: { ...updated, codeHash: undefined, encryptedCode: undefined, qrTokenHash: undefined },
      deliveryCredential: { redemptionCode: secretCode }
    };
  });
}

export async function inquireGiftCardBalanceSecure(params: {
  redemptionCode: string;
  actorKey: string;
}) {
  const cleanCode = normalizeGiftCardCode(params.redemptionCode);
  if (!cleanCode || cleanCode.length < 10) {
    await checkAndRecordGiftCardLookupAttempt(params.actorKey, false, cleanCode);
    throw new NotFoundError('Invalid gift card redemption code.');
  }

  const codeHash = hashSecretValue(cleanCode);
  const [card] = await db.select().from(giftCards).where(eq(giftCards.codeHash, codeHash)).limit(1);

  if (!card) {
    await checkAndRecordGiftCardLookupAttempt(params.actorKey, false, cleanCode);
    throw new NotFoundError('Gift card code not recognized.');
  }

  await checkAndRecordGiftCardLookupAttempt(params.actorKey, true);

  if (card.paymentStatus !== 'PAID' || card.status === 'PENDING_PAYMENT') {
    throw new ValidationError('This gift card has not been activated because payment is not yet confirmed.');
  }

  return {
    cardNumber: card.cardNumber,
    maskedCode: card.maskedCode,
    status: card.status,
    occasion: card.occasion,
    initialValueInr: round2(card.initialValueInr),
    remainingBalanceInr: round2(card.remainingBalanceInr),
    expiresAt: card.expiresAt,
    currency: card.currency
  };
}

export async function claimGiftCardToCustomerAccount(params: {
  redemptionCode: string;
  customerEmail: string;
  customerId?: string;
  actorKey: string;
}) {
  const cleanCode = normalizeGiftCardCode(params.redemptionCode);
  const codeHash = hashSecretValue(cleanCode);

  const [found] = await db.select().from(giftCards).where(eq(giftCards.codeHash, codeHash)).limit(1);
  if (!found) {
    await checkAndRecordGiftCardLookupAttempt(params.actorKey, false, cleanCode);
    throw new NotFoundError('Invalid gift card redemption code.');
  }
  await checkAndRecordGiftCardLookupAttempt(params.actorKey, true);

  return db.transaction(async (tx) => {
    const [card] = await tx.select().from(giftCards).where(eq(giftCards.id, found.id)).for('update');
    if (card.paymentStatus !== 'PAID' || card.status === 'PENDING_PAYMENT') {
      throw new ValidationError('Gift card cannot be claimed before payment confirmation.');
    }
    if (card.status === 'BLOCKED' || card.status === 'CANCELLED' || card.status === 'EXPIRED') {
      throw new ValidationError(`Gift card is currently ${card.status}.`);
    }
    const cleanEmail = params.customerEmail.trim().toLowerCase();
    if (card.claimedByEmail && card.claimedByEmail.toLowerCase() !== cleanEmail) {
      throw new ValidationError('This gift card has already been claimed by another FRAGMORÉ account.');
    }

    const [updated] = await tx
      .update(giftCards)
      .set({
        claimedByEmail: cleanEmail,
        claimedByCustomerId: params.customerId || card.claimedByCustomerId,
        claimedAt: card.claimedAt || new Date(),
        status: card.status === 'SCHEDULED' ? 'ACTIVE' : card.status,
        updatedAt: new Date()
      })
      .where(eq(giftCards.id, card.id))
      .returning();

    if (!card.claimedByEmail) {
      const refNo = await getNextSequence(tx, 'GCTX');
      await tx.insert(giftCardTransactions).values({
        id: makeId('gctx'),
        referenceNumber: refNo,
        idempotencyKey: `gc_claim_${card.id}_${cleanEmail}`,
        giftCardId: card.id,
        cardNumber: card.cardNumber,
        txnType: 'RECIPIENT_CLAIM',
        channel: 'WEB_STOREFRONT',
        amountInr: 0,
        balanceBeforeInr: card.remainingBalanceInr,
        balanceAfterInr: card.remainingBalanceInr,
        redeemedByEmail: cleanEmail,
        notes: `Claimed into FRAGMORÉ account ${cleanEmail}`
      });

      if (card.corporateBatchId) {
        await tx
          .update(corporateGiftCardBatches)
          .set({
            claimedCardsCount: sql`${corporateGiftCardBatches.claimedCardsCount} + 1`,
            updatedAt: new Date()
          })
          .where(eq(corporateGiftCardBatches.id, card.corporateBatchId));
      }
    }

    return {
      ...updated,
      codeHash: undefined,
      encryptedCode: undefined,
      qrTokenHash: undefined
    };
  });
}

export async function redeemGiftCardAtEventOrPosTransaction(params: {
  redemptionCodeOrQr: string;
  amountInr: number;
  posEventLocation: string;
  customerEmail?: string;
  orderReference?: string;
  staffActor: RewardsActor;
  idempotencyKey: string;
}) {
  assertRewardsStaffRoles(
    params.staffActor,
    ['SUPER_ADMIN', 'FINANCE_CONTROLLER', 'SALES_CRM'],
    'Perfume Bar / Event POS Gift Card Redemption'
  );

  const redeemAmount = round2(Number(params.amountInr) || 0);
  if (redeemAmount <= 0) throw new ValidationError('POS redemption amount must be greater than ₹0.');

  const cleanToken = normalizeGiftCardCode(params.redemptionCodeOrQr);
  const tokenHash = hashSecretValue(cleanToken);

  return db.transaction(async (tx) => {
    const existingTx = await tx
      .select()
      .from(giftCardTransactions)
      .where(eq(giftCardTransactions.idempotencyKey, params.idempotencyKey))
      .limit(1);
    if (existingTx[0]) {
      return { transaction: existingTx[0], deduplicated: true };
    }

    const matchedCards = await tx
      .select()
      .from(giftCards)
      .where(sql`${giftCards.codeHash} = ${tokenHash} OR ${giftCards.qrTokenHash} = ${tokenHash}`)
      .for('update');

    const card = matchedCards[0];
    if (!card) {
      await checkAndRecordGiftCardLookupAttempt(params.staffActor.email, false, cleanToken);
      throw new NotFoundError('Invalid gift card code or QR token.');
    }

    if (card.paymentStatus !== 'PAID' || (card.status !== 'ACTIVE' && card.status !== 'SCHEDULED')) {
      throw new ValidationError(`Gift card ${card.cardNumber} is not active for redemption (status: ${card.status}).`);
    }
    if (new Date(card.expiresAt) <= new Date()) {
      throw new ValidationError(`Gift card ${card.cardNumber} expired on ${card.expiresAt.toISOString().slice(0, 10)}.`);
    }

    const beforeBal = round2(Number(card.remainingBalanceInr) || 0);
    if (beforeBal < redeemAmount) {
      throw new ValidationError(
        `Insufficient gift card balance: requested ₹${redeemAmount}, available ₹${beforeBal}.`
      );
    }

    const afterBal = round2(beforeBal - redeemAmount);
    const nextStatus = afterBal <= 0 ? 'REDEEMED' : 'ACTIVE';

    await tx
      .update(giftCards)
      .set({
        remainingBalanceInr: afterBal,
        status: nextStatus,
        version: sql`${giftCards.version} + 1`,
        updatedAt: new Date()
      })
      .where(eq(giftCards.id, card.id));

    if (card.corporateBatchId) {
      await tx
        .update(corporateGiftCardBatches)
        .set({
          redeemedValueInr: sql`${corporateGiftCardBatches.redeemedValueInr} + ${redeemAmount}`,
          updatedAt: new Date()
        })
        .where(eq(corporateGiftCardBatches.id, card.corporateBatchId));
    }

    // Recognize liability reduction against POS product sale (net of 18% GST output)
    const netSupply = round2(redeemAmount / 1.18);
    const gstOut = round2(redeemAmount - netSupply);
    const journalId = await postRewardsAccountingJournal(tx, {
      sourceModule: 'GIFT_CARD_POS_REDEMPTION',
      sourceEntityId: card.id,
      narration: `Perfume Bar / Event POS redemption of Gift Card ${card.cardNumber} at ${params.posEventLocation}`,
      idempotencyKey: `gl_gc_pos_${params.idempotencyKey}`,
      postedByEmail: params.staffActor.email,
      lines: [
        {
          accountCode: '2310',
          accountName: 'Unredeemed Gift Card Deferred Liability',
          accountType: 'LIABILITY',
          debitInr: redeemAmount,
          creditInr: 0,
          costCenter: 'CC-410'
        },
        {
          accountCode: '4000',
          accountName: 'Perfume Bar & Retail Fragrance Sales',
          accountType: 'REVENUE',
          debitInr: 0,
          creditInr: netSupply,
          costCenter: 'CC-410'
        },
        {
          accountCode: '2110',
          accountName: 'Output GST Payable',
          accountType: 'LIABILITY',
          debitInr: 0,
          creditInr: gstOut,
          costCenter: 'CC-510'
        }
      ]
    });

    const refNo = await getNextSequence(tx, 'GCTX');
    const [txRow] = await tx
      .insert(giftCardTransactions)
      .values({
        id: makeId('gctx'),
        referenceNumber: refNo,
        idempotencyKey: params.idempotencyKey,
        giftCardId: card.id,
        cardNumber: card.cardNumber,
        txnType: 'EVENT_POS_REDEMPTION',
        channel: 'EVENT_PERFUME_BAR_POS',
        amountInr: redeemAmount,
        balanceBeforeInr: beforeBal,
        balanceAfterInr: afterBal,
        orderNumber: params.orderReference || null,
        posEventLocation: params.posEventLocation,
        redeemedByEmail: params.customerEmail || card.recipientEmail || null,
        verifiedByStaffEmail: params.staffActor.email,
        journalId,
        notes: `Redeemed at ${params.posEventLocation} by ${params.staffActor.email}`
      })
      .returning();

    await recordErpAuditLog(tx, {
      action: 'GIFT_CARD_POS_REDEEMED',
      entity: 'gift_cards',
      entityId: card.id,
      actorEmail: params.staffActor.email,
      actorRole: params.staffActor.role,
      details: `POS redeemed ₹${redeemAmount} on ${card.cardNumber} at ${params.posEventLocation}. Remaining: ₹${afterBal}`
    });

    return {
      cardNumber: card.cardNumber,
      maskedCode: card.maskedCode,
      amountRedeemedInr: redeemAmount,
      remainingBalanceInr: afterBal,
      status: nextStatus,
      transaction: txRow,
      deduplicated: false
    };
  });
}

export async function blockOrCancelGiftCardAdminTransaction(params: {
  giftCardId: string;
  action: 'BLOCK' | 'UNBLOCK' | 'CANCEL';
  reason: string;
  actor: RewardsActor;
}) {
  assertRewardsStaffRoles(params.actor, ['SUPER_ADMIN', 'FINANCE_CONTROLLER'], 'Gift Card Block/Cancel');
  if (!params.reason || !params.reason.trim()) {
    throw new ValidationError('Mandatory reason is required to block, unblock, or cancel a gift card.');
  }

  return db.transaction(async (tx) => {
    const [card] = await tx.select().from(giftCards).where(eq(giftCards.id, params.giftCardId)).for('update');
    if (!card) throw new NotFoundError('Gift card not found.');

    const nextStatus =
      params.action === 'BLOCK' ? 'BLOCKED' : params.action === 'CANCEL' ? 'CANCELLED' : card.remainingBalanceInr > 0 ? 'ACTIVE' : 'REDEEMED';

    const [updated] = await tx
      .update(giftCards)
      .set({
        status: nextStatus,
        blockedReason: params.action === 'UNBLOCK' ? null : params.reason.trim(),
        blockedByEmail: params.action === 'UNBLOCK' ? null : params.actor.email,
        updatedAt: new Date()
      })
      .where(eq(giftCards.id, card.id))
      .returning();

    const refNo = await getNextSequence(tx, 'GCTX');
    await tx.insert(giftCardTransactions).values({
      id: makeId('gctx'),
      referenceNumber: refNo,
      idempotencyKey: `gc_adm_${card.id}_${params.action}_${Date.now()}`,
      giftCardId: card.id,
      cardNumber: card.cardNumber,
      txnType:
        params.action === 'BLOCK' ? 'ADMIN_BLOCK' : params.action === 'CANCEL' ? 'ADMIN_CANCEL' : 'ADMIN_UNBLOCK',
      channel: 'ADMIN',
      amountInr: 0,
      balanceBeforeInr: card.remainingBalanceInr,
      balanceAfterInr: params.action === 'CANCEL' ? 0 : card.remainingBalanceInr,
      verifiedByStaffEmail: params.actor.email,
      notes: params.reason.trim()
    });

    await recordErpAuditLog(tx, {
      action: `GIFT_CARD_${params.action}`,
      entity: 'gift_cards',
      entityId: card.id,
      actorEmail: params.actor.email,
      actorRole: params.actor.role,
      details: `${params.action} gift card ${card.cardNumber}. Reason: ${params.reason}`
    });

    return { ...updated, codeHash: undefined, encryptedCode: undefined, qrTokenHash: undefined };
  });
}

// ============================================================================
// CORPORATE BULK GIFT CARDS (ERP PROPOSAL / QUOTATION LINKED)
// ============================================================================

export async function createCorporateGiftCardBatchTransaction(params: {
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  customerGstin?: string;
  category?: string;
  erpProposalId?: string;
  erpQuotationId?: string;
  templateId?: string;
  occasion?: string;
  quantity: number;
  denominationInr: number;
  corporateDiscountPct?: number;
  scheduledDistributionDate?: string;
  recipients?: Array<{ name: string; email?: string; phone?: string; customNote?: string }>;
  notes?: string;
  actor: RewardsActor;
}) {
  assertRewardsStaffRoles(
    params.actor,
    ['SUPER_ADMIN', 'FINANCE_CONTROLLER', 'SALES_CRM'],
    'Create Corporate Gift Card Quotation / Batch'
  );

  const qty = Math.trunc(Number(params.quantity) || 0);
  const denom = round2(Number(params.denominationInr) || 0);
  if (qty < 1 || qty > 1000) throw new ValidationError('Corporate batch quantity must be between 1 and 1,000 cards.');
  if (denom < 250 || denom > 50000) throw new ValidationError('Corporate denomination must be between ₹250 and ₹50,000.');

  const discPct = Math.min(25, Math.max(0, round2(Number(params.corporateDiscountPct) || 0)));
  const grossFaceValueInr = round2(qty * denom);
  const netPayableInr = round2(grossFaceValueInr * (1 - discPct / 100));

  const recipientList =
    Array.isArray(params.recipients) && params.recipients.length > 0
      ? params.recipients
      : Array.from({ length: qty }, (_, idx) => ({
          name: `${params.companyName} Recipient #${idx + 1}`,
          email: params.contactEmail,
          phone: params.contactPhone,
          customNote: `Compliments of ${params.companyName} & FRAGMORÉ Haute Parfumerie`
        }));

  return db.transaction(async (tx) => {
    const batchNumber = await getNextSequence(tx, 'CORPGC');
    const [batch] = await tx
      .insert(corporateGiftCardBatches)
      .values({
        id: makeId('cgcb'),
        batchNumber,
        companyName: params.companyName.trim(),
        contactName: params.contactName.trim(),
        contactEmail: params.contactEmail.trim().toLowerCase(),
        contactPhone: params.contactPhone.trim(),
        customerGstin: params.customerGstin?.trim() || null,
        category: params.category || 'CORPORATE_GIFTING',
        erpProposalId: params.erpProposalId || null,
        erpQuotationId: params.erpQuotationId || null,
        templateId: params.templateId || 'ivory-champagne-atelier',
        occasion: params.occasion || 'Corporate Gift',
        quantity: qty,
        denominationInr: denom,
        grossFaceValueInr,
        corporateDiscountPct: discPct,
        netPayableInr,
        paymentStatus: 'AWAITING_PAYMENT',
        scheduledDistributionDate: params.scheduledDistributionDate || currentIsoDate(),
        recipients: recipientList,
        status: 'AWAITING_PAYMENT',
        notes: params.notes || null,
        createdByEmail: params.actor.email
      })
      .returning();

    await recordErpAuditLog(tx, {
      action: 'CORPORATE_GC_BATCH_CREATED',
      entity: 'corporate_gift_card_batches',
      entityId: batch.id,
      actorEmail: params.actor.email,
      actorRole: params.actor.role,
      details: `Created Corporate Bulk Gift Card Batch ${batchNumber} for ${params.companyName}: ${qty} × ₹${denom} (Gross ₹${grossFaceValueInr}, Net ₹${netPayableInr}). Status: AWAITING_PAYMENT.`
    });

    return batch;
  });
}

export async function approveCorporateBatchAndIssueCardsTransaction(params: {
  batchId: string;
  paymentReference: string;
  erpInvoiceId?: string;
  actor: RewardsActor;
}) {
  assertRewardsStaffRoles(
    params.actor,
    ['SUPER_ADMIN', 'FINANCE_CONTROLLER'],
    'Approve Corporate Gift Card Payment & Issue Batch'
  );
  if (!params.paymentReference || !params.paymentReference.trim()) {
    throw new ValidationError('Verified bank/invoice payment reference is required before issuing corporate gift cards.');
  }

  const cfg = await getRewardsMasterConfig();
  const gcCfg = (cfg.giftCardConfig as any) || DEFAULT_REWARDS_CONFIG.giftCardConfig;
  const validityMonths = Number(gcCfg.validityMonths) || 12;
  const expiresAt = new Date(Date.now() + validityMonths * 30 * 86400000);

  return db.transaction(async (tx) => {
    const [batch] = await tx
      .select()
      .from(corporateGiftCardBatches)
      .where(eq(corporateGiftCardBatches.id, params.batchId))
      .for('update');
    if (!batch) throw new NotFoundError('Corporate gift card batch not found.');
    if (batch.status === 'ISSUED' || batch.issuedCardsCount >= batch.quantity) {
      return { batch, alreadyIssued: true };
    }

    const recipients = Array.isArray(batch.recipients) ? (batch.recipients as any[]) : [];
    const todayStr = currentIsoDate();
    const isFuture = Boolean(batch.scheduledDistributionDate && batch.scheduledDistributionDate > todayStr);

    // Post Deferred Liability GL for full face value, with corporate discount in 5410 if any
    const discountAmt = round2(Number(batch.grossFaceValueInr) - Number(batch.netPayableInr));
    const journalLines: any[] = [
      {
        accountCode: '1010',
        accountName: 'HDFC Bank / Corporate Receipt Clearing',
        accountType: 'ASSET',
        debitInr: Number(batch.netPayableInr),
        creditInr: 0,
        costCenter: 'CC-410'
      },
      {
        accountCode: '2310',
        accountName: 'Unredeemed Gift Card Deferred Liability',
        accountType: 'LIABILITY',
        debitInr: 0,
        creditInr: Number(batch.grossFaceValueInr),
        costCenter: 'CC-510'
      }
    ];
    if (discountAmt > 0) {
      journalLines.push({
        accountCode: '5410',
        accountName: 'Promotional Wallet, Referral & Loyalty Reward Expense',
        accountType: 'EXPENSE',
        debitInr: discountAmt,
        creditInr: 0,
        costCenter: 'CC-410'
      });
    }

    const journalId = await postRewardsAccountingJournal(tx, {
      sourceModule: 'CORPORATE_GIFT_CARD_BATCH',
      sourceEntityId: batch.id,
      narration: `Corporate Gift Card Batch ${batch.batchNumber} (${batch.companyName}) issued post-payment (${params.paymentReference})`,
      idempotencyKey: `gl_corpgc_${batch.id}`,
      postedByEmail: params.actor.email,
      lines: journalLines
    });

    const issuedManifest: Array<{ cardNumber: string; maskedCode: string; recipientName: string; recipientEmail: string | null }> = [];

    for (let i = 0; i < batch.quantity; i++) {
      const rec = recipients[i] || {
        name: `${batch.companyName} Guest #${i + 1}`,
        email: batch.contactEmail,
        phone: batch.contactPhone
      };
      const cardNumber = generateGiftCardPublicNumber();
      const rawSecret = generateGiftCardSecretCode();
      const cardId = makeId('gc');

      await tx.insert(giftCards).values({
        id: cardId,
        cardNumber,
        codeHash: hashSecretValue(rawSecret),
        encryptedCode: encryptGiftCardCode(rawSecret),
        maskedCode: maskGiftCardCode(rawSecret),
        qrTokenHash: hashSecretValue(`FRGQR-${cardNumber}-${randomSafeChars(8)}`),
        cardFormat: 'CORPORATE_BULK',
        templateId: batch.templateId,
        occasion: batch.occasion,
        initialValueInr: batch.denominationInr,
        remainingBalanceInr: batch.denominationInr,
        reservedBalanceInr: 0,
        currency: 'INR',
        purchaserName: batch.companyName,
        purchaserEmail: batch.contactEmail,
        senderName: batch.companyName,
        recipientName: rec.name || `${batch.companyName} Recipient`,
        recipientEmail: rec.email ? String(rec.email).trim().toLowerCase() : null,
        recipientPhone: rec.phone || null,
        personalMessage: rec.customNote || `Presented with compliments of ${batch.companyName}`,
        scheduledDeliveryDate: batch.scheduledDistributionDate || todayStr,
        deliveredAt: isFuture ? null : new Date(),
        corporateBatchId: batch.id,
        paymentStatus: 'PAID',
        status: isFuture ? 'SCHEDULED' : 'ACTIVE',
        issuanceJournalId: journalId,
        expiresAt
      });

      const refNo = await getNextSequence(tx, 'GCTX');
      await tx.insert(giftCardTransactions).values({
        id: makeId('gctx'),
        referenceNumber: refNo,
        idempotencyKey: `gc_corp_issue_${cardId}`,
        giftCardId: cardId,
        cardNumber,
        txnType: 'ISSUANCE_ACTIVATED',
        channel: 'CORPORATE_DESK',
        amountInr: batch.denominationInr,
        balanceBeforeInr: 0,
        balanceAfterInr: batch.denominationInr,
        verifiedByStaffEmail: params.actor.email,
        journalId,
        notes: `Corporate Batch ${batch.batchNumber} (${batch.companyName})`
      });

      issuedManifest.push({
        cardNumber,
        maskedCode: maskGiftCardCode(rawSecret),
        recipientName: rec.name || `${batch.companyName} Recipient`,
        recipientEmail: rec.email || null
      });
    }

    const [updatedBatch] = await tx
      .update(corporateGiftCardBatches)
      .set({
        paymentStatus: 'PAYMENT_APPROVED',
        paymentApprovedByEmail: params.actor.email,
        paymentApprovedAt: new Date(),
        paymentReference: params.paymentReference.trim(),
        erpInvoiceId: params.erpInvoiceId || batch.erpInvoiceId,
        issuedCardsCount: batch.quantity,
        status: 'ISSUED',
        updatedAt: new Date()
      })
      .where(eq(corporateGiftCardBatches.id, batch.id))
      .returning();

    await recordErpAuditLog(tx, {
      action: 'CORPORATE_GC_BATCH_ISSUED',
      entity: 'corporate_gift_card_batches',
      entityId: batch.id,
      actorEmail: params.actor.email,
      actorRole: params.actor.role,
      details: `Confirmed payment (${params.paymentReference}) and issued ${batch.quantity} Gift Cards for ${batch.companyName} (${batch.batchNumber}).`
    });

    return { batch: updatedBatch, issuedManifest, alreadyIssued: false };
  });
}

// ============================================================================
// MODULE 4: REFERRAL PROGRAM & HOUSEHOLD-AWARE ANTI-ABUSE ENGINE
// ============================================================================

export async function registerReferralAttribution(params: {
  referralCode: string;
  refereeEmail: string;
  refereePhone?: string;
  refereeCustomerId?: string;
  ipAddress?: string;
  deviceFingerprint?: string;
  shippingAddressText?: string;
}) {
  await ensureRewardsEcosystemSeeded();
  const cfg = await getRewardsMasterConfig();
  const refCfg = (cfg.referralConfig as any) || DEFAULT_REWARDS_CONFIG.referralConfig;
  if (!refCfg.enabled) throw new ValidationError('The FRAGMORÉ Referral program is currently paused.');

  const cleanCode = String(params.referralCode || '').trim().toUpperCase();
  const refereeEmail = String(params.refereeEmail || '').trim().toLowerCase();
  if (!cleanCode || !refereeEmail) {
    throw new ValidationError('Referral code and referee email are required.');
  }

  const [referrerAcct] = await db
    .select()
    .from(loyaltyAccounts)
    .where(eq(loyaltyAccounts.referralCode, cleanCode))
    .limit(1);

  if (!referrerAcct) {
    throw new NotFoundError('Referral code not found.');
  }

  // Anti-Abuse 1: Strict block on self-referral
  if (referrerAcct.customerEmail.toLowerCase() === refereeEmail) {
    await db
      .insert(rewardsFraudFlags)
      .values({
        id: makeId('rff'),
        flagNumber: `FRD-${Date.now().toString().slice(-6)}-${randomSafeChars(3)}`,
        category: 'SELF_REFERRAL_ATTEMPT',
        severity: 'MEDIUM',
        actorIdentifier: refereeEmail,
        customerEmail: refereeEmail,
        relatedEntityType: 'REFERRAL_CODE',
        relatedEntityId: cleanCode,
        signals: { referrerEmail: referrerAcct.customerEmail, refereeEmail },
        status: 'CONFIRMED_BLOCKED'
      })
      .catch(() => {});
    throw new ValidationError('Self-referrals are not eligible under Refer & Experience FRAGMORÉ.');
  }

  // Anti-Abuse 2: Block if referee already has prior completed orders
  const priorOrders = await db
    .select()
    .from(orders)
    .where(eq(orders.customerEmail, refereeEmail));
  const hasCompletedOrder = priorOrders.some(
    (o) => String(o.orderStatus).toUpperCase() !== 'CANCELLED' && String(o.paymentStatus).toUpperCase() !== 'FAILED'
  );
  if (hasCompletedOrder) {
    throw new ValidationError('Referral welcome privileges apply exclusively to first-time FRAGMORÉ customers.');
  }

  const existingConv = await db
    .select()
    .from(referralConversions)
    .where(eq(referralConversions.refereeEmail, refereeEmail))
    .limit(1);
  if (existingConv[0]) {
    return existingConv[0];
  }

  const ipHash = params.ipAddress ? hashSecretValue(params.ipAddress) : null;
  const devHash = params.deviceFingerprint ? hashSecretValue(params.deviceFingerprint) : null;
  const addrHash = params.shippingAddressText ? hashSecretValue(params.shippingAddressText) : null;

  // Check if referrer or another conversion shares device/IP/address (flag for manual review without auto-banning households!)
  const siblingConvs = await db
    .select()
    .from(referralConversions)
    .where(eq(referralConversions.referrerEmail, referrerAcct.customerEmail));

  const riskFlags: string[] = [];
  let riskScore = 0;
  if (ipHash && siblingConvs.some((c) => c.ipAddressHash === ipHash)) {
    riskFlags.push('SHARED_NETWORK_IP');
    riskScore += 35;
  }
  if (devHash && siblingConvs.some((c) => c.deviceFingerprintHash === devHash)) {
    riskFlags.push('SHARED_DEVICE_SIGNATURE');
    riskScore += 50;
  }
  if (addrHash && siblingConvs.some((c) => c.shippingAddressHash === addrHash)) {
    riskFlags.push('SHARED_HOUSEHOLD_SHIPPING_ADDRESS');
    riskScore += 30;
  }

  const { loyalty: refereeLoyalty } = await ensureCustomerWalletAndLoyaltyAccount({
    customerId: params.refereeCustomerId,
    customerEmail: refereeEmail
  });

  await db
    .update(loyaltyAccounts)
    .set({
      referredByCode: cleanCode,
      referredByEmail: referrerAcct.customerEmail,
      updatedAt: new Date()
    })
    .where(eq(loyaltyAccounts.id, refereeLoyalty.id));

  return db.transaction(async (tx) => {
    const convNo = await getNextSequence(tx, 'REFC');
    const [conv] = await tx
      .insert(referralConversions)
      .values({
        id: makeId('refc'),
        conversionNumber: convNo,
        referralCode: cleanCode,
        referrerCustomerId: referrerAcct.customerId,
        referrerEmail: referrerAcct.customerEmail,
        refereeCustomerId: refereeLoyalty.customerId,
        refereeEmail,
        refereePhone: params.refereePhone || null,
        refereeCreditInr: Number(refCfg.refereeRewardInr) || 50,
        referrerCreditInr: Number(refCfg.referrerRewardInr) || 75,
        status: riskScore >= 50 ? 'HELD_FRAUD_REVIEW' : 'REGISTERED',
        riskScore,
        riskFlags,
        deviceFingerprintHash: devHash,
        ipAddressHash: ipHash,
        shippingAddressHash: addrHash
      })
      .returning();

    if (riskFlags.length > 0) {
      await tx.insert(rewardsFraudFlags).values({
        id: makeId('rff'),
        flagNumber: `FRD-${Date.now().toString().slice(-6)}-${randomSafeChars(3)}`,
        category: 'HOUSEHOLD_SHARED_SIGNAL',
        severity: riskScore >= 50 ? 'HIGH' : 'LOW',
        actorIdentifier: refereeEmail,
        customerEmail: referrerAcct.customerEmail,
        relatedEntityType: 'REFERRAL_CONVERSION',
        relatedEntityId: conv.id,
        signals: {
          note: 'Held for human review rather than automatic household penalty.',
          riskFlags,
          riskScore,
          referrerEmail: referrerAcct.customerEmail,
          refereeEmail
        },
        status: 'OPEN_REVIEW'
      });
    }

    return conv;
  });
}

export async function evaluateReferralOnFirstOrder(params: {
  orderId: string;
  orderNumber: string;
  customerEmail: string;
  netOrderValueInr: number;
  orderDeliveredAndMatured?: boolean;
}) {
  const email = String(params.customerEmail || '').trim().toLowerCase();
  if (!email) return null;

  const [conv] = await db
    .select()
    .from(referralConversions)
    .where(eq(referralConversions.refereeEmail, email))
    .limit(1);
  if (!conv) return null;
  if (conv.status === 'COMPLETED_REWARDED' || conv.status === 'REJECTED' || conv.status === 'REVERSED_REFUND') {
    return conv;
  }

  const cfg = await getRewardsMasterConfig();
  const refCfg = (cfg.referralConfig as any) || DEFAULT_REWARDS_CONFIG.referralConfig;
  if (params.netOrderValueInr < (Number(refCfg.minFirstOrderValueInr) || 699)) {
    return conv;
  }

  if (conv.status === 'HELD_FRAUD_REVIEW') {
    await db
      .update(referralConversions)
      .set({
        qualifyingOrderId: params.orderId,
        qualifyingOrderNumber: params.orderNumber,
        qualifyingOrderNetInr: params.netOrderValueInr,
        updatedAt: new Date()
      })
      .where(eq(referralConversions.id, conv.id));
    return conv;
  }

  const holdDays = Number(refCfg.returnWindowHoldDays) || 7;
  const maturesAt = params.orderDeliveredAndMatured ? new Date() : new Date(Date.now() + holdDays * 86400000);

  if (!params.orderDeliveredAndMatured) {
    const [updated] = await db
      .update(referralConversions)
      .set({
        qualifyingOrderId: params.orderId,
        qualifyingOrderNumber: params.orderNumber,
        qualifyingOrderNetInr: params.netOrderValueInr,
        status: 'HELD_RETURN_WINDOW',
        maturesAt,
        updatedAt: new Date()
      })
      .where(eq(referralConversions.id, conv.id))
      .returning();
    return updated;
  }

  // Matured & Delivered: Release Referee + Referrer promotional wallet credits!
  await issueWalletCreditTransaction({
    customerEmail: conv.refereeEmail,
    creditType: 'REFERRAL_CREDIT',
    amountInr: Number(conv.refereeCreditInr) || 50,
    sourceType: 'REFERRAL_PROGRAM',
    sourceRefId: conv.id,
    reason: `Refer & Experience FRAGMORÉ first-order welcome privilege (${conv.conversionNumber})`,
    expiresInDays: Number(refCfg.rewardExpiryDays) || 120,
    idempotencyKey: `ref_referee_credit_${conv.id}`,
    actorEmail: 'system@fragmore.shop',
    actorRole: 'SYSTEM'
  });

  await issueWalletCreditTransaction({
    customerEmail: conv.referrerEmail,
    creditType: 'REFERRAL_CREDIT',
    amountInr: Number(conv.referrerCreditInr) || 75,
    sourceType: 'REFERRAL_PROGRAM',
    sourceRefId: conv.id,
    reason: `Referrer reward for completed referred order ${params.orderNumber} (${conv.conversionNumber})`,
    expiresInDays: Number(refCfg.rewardExpiryDays) || 120,
    idempotencyKey: `ref_referrer_credit_${conv.id}`,
    actorEmail: 'system@fragmore.shop',
    actorRole: 'SYSTEM'
  });

  const [rewarded] = await db
    .update(referralConversions)
    .set({
      qualifyingOrderId: params.orderId,
      qualifyingOrderNumber: params.orderNumber,
      qualifyingOrderNetInr: params.netOrderValueInr,
      status: 'COMPLETED_REWARDED',
      rewardedAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(referralConversions.id, conv.id))
    .returning();

  ingestAutomationEvent({
    eventType: 'referral.reward_unlocked',
    source: 'fragmore_referral_engine',
    idempotencyKey: `ref_unlocked_${conv.id}`,
    customerEmail: conv.referrerEmail,
    payload: {
      conversionNumber: conv.conversionNumber,
      referrerEmail: conv.referrerEmail,
      refereeEmail: conv.refereeEmail,
      referrerCreditInr: conv.referrerCreditInr
    }
  }).catch(() => {});

  return rewarded;
}

// ============================================================================
// MODULE 6: BIRTHDAY, ANNIVERSARY & OCCASION REWARDS (CONSENT + LIVE STOCK CHECK)
// ============================================================================

export async function updateCustomerLoyaltyPreferences(params: {
  customerEmail: string;
  birthday?: string | null;
  anniversary?: string | null;
  preferredFragranceFamily?: string | null;
  giftingPreferences?: Record<string, any>;
  promoOptIn?: boolean;
}) {
  const { loyalty } = await ensureCustomerWalletAndLoyaltyAccount({ customerEmail: params.customerEmail });
  const [updated] = await db
    .update(loyaltyAccounts)
    .set({
      ...(params.birthday !== undefined ? { birthday: params.birthday || null } : {}),
      ...(params.anniversary !== undefined ? { anniversary: params.anniversary || null } : {}),
      ...(params.preferredFragranceFamily !== undefined
        ? { preferredFragranceFamily: params.preferredFragranceFamily || null }
        : {}),
      ...(params.giftingPreferences !== undefined ? { giftingPreferences: params.giftingPreferences } : {}),
      ...(params.promoOptIn !== undefined ? { promoOptIn: Boolean(params.promoOptIn) } : {}),
      updatedAt: new Date()
    })
    .where(eq(loyaltyAccounts.id, loyalty.id))
    .returning();
  return updated;
}

export async function grantOccasionRewardIfEligible(params: {
  customerEmail: string;
  occasionType: 'BIRTHDAY' | 'ANNIVERSARY' | 'VIP_MILESTONE' | 'FESTIVE_ATELIER';
  actorEmail: string;
  actorRole: string;
}) {
  await ensureRewardsEcosystemSeeded();
  const cfg = await getRewardsMasterConfig();
  const occCfg = (cfg.occasionConfig as any) || DEFAULT_REWARDS_CONFIG.occasionConfig;
  const { loyalty } = await ensureCustomerWalletAndLoyaltyAccount({ customerEmail: params.customerEmail });

  const currentYear = new Date().getUTCFullYear();

  // Check explicit promotional consent
  if (occCfg.requireMarketingOptIn && !loyalty.promoOptIn) {
    throw new ValidationError(
      'Customer has opted out of promotional communications. Occasion reward skipped to respect consent preferences.'
    );
  }

  // Enforce annual frequency cap per customer & occasion
  const existingGrants = await db
    .select()
    .from(occasionRewardLogs)
    .where(
      and(
        eq(occasionRewardLogs.customerEmail, loyalty.customerEmail),
        eq(occasionRewardLogs.occasionType, params.occasionType),
        eq(occasionRewardLogs.rewardYear, currentYear)
      )
    );
  if (existingGrants.length >= (Number(occCfg.maxGrantsPerOccasionPerYear) || 1)) {
    throw new ValidationError(
      `${params.occasionType} privilege has already been awarded to ${loyalty.customerEmail} for ${currentYear}.`
    );
  }

  // Check annual campaign budget
  const allYearGrants = await db
    .select()
    .from(occasionRewardLogs)
    .where(eq(occasionRewardLogs.rewardYear, currentYear));
  const usedBudget = allYearGrants.reduce((s, g) => s + (Number(g.walletCreditInr) || 0), 0);
  const creditInr =
    params.occasionType === 'BIRTHDAY'
      ? Number(occCfg.birthdayPromoCreditInr) || 100
      : Number(occCfg.anniversaryPromoCreditInr) || 75;
  const points =
    params.occasionType === 'BIRTHDAY' ? Number(occCfg.birthdayPoints) || 250 : Number(occCfg.anniversaryPoints) || 200;

  if (usedBudget + creditInr > (Number(occCfg.annualOccasionBudgetInr) || 250000)) {
    throw new ValidationError('Annual Occasion Rewards budget cap reached. Increase budget in Settings to issue further grants.');
  }

  // Live stock check if complimentary sample is configured
  let liveStockVerified = false;
  let sampleSku: string | null = null;
  if (occCfg.complimentarySampleEnabled && occCfg.complimentarySampleSku) {
    const allProds = await db.select().from(products);
    const hasSampleStock = allProds.some((p) =>
      Array.isArray(p.variants) &&
      (p.variants as any[]).some(
        (v) => v.sku === occCfg.complimentarySampleSku && (Number(v.stockAvailable) || 0) > 5
      )
    );
    if (hasSampleStock) {
      liveStockVerified = true;
      sampleSku = occCfg.complimentarySampleSku;
    }
  }

  const validDays = Number(occCfg.birthdayValidityDays) || 30;
  const expiresAt = new Date(Date.now() + validDays * 86400000);
  const idempBase = `occ_${loyalty.customerEmail}_${params.occasionType}_${currentYear}`;

  if (creditInr > 0) {
    await issueWalletCreditTransaction({
      customerEmail: loyalty.customerEmail,
      creditType: 'PROMOTIONAL_CREDIT',
      amountInr: creditInr,
      sourceType: 'CAMPAIGN_REWARD',
      sourceRefId: idempBase,
      reason: `FRAGMORÉ ${params.occasionType} Celebration Credit (${currentYear})`,
      expiresInDays: validDays,
      idempotencyKey: `${idempBase}_wlt`,
      actorEmail: params.actorEmail,
      actorRole: params.actorRole
    });
  }

  if (points > 0) {
    await adjustLoyaltyPointsAdminTransaction({
      customerEmail: loyalty.customerEmail,
      pointsDelta: points,
      reason: `FRAGMORÉ ${params.occasionType} Bonus Points (${currentYear})`,
      idempotencyKey: `${idempBase}_pts`,
      actorEmail: params.actorEmail,
      actorRole: params.actorRole
    });
  }

  return db.transaction(async (tx) => {
    const grantNo = await getNextSequence(tx, 'OCCR');
    const [grant] = await tx
      .insert(occasionRewardLogs)
      .values({
        id: makeId('occ'),
        grantNumber: grantNo,
        customerId: loyalty.customerId,
        customerEmail: loyalty.customerEmail,
        occasionType: params.occasionType,
        rewardYear: currentYear,
        rewardKind: 'PROMO_WALLET_CREDIT',
        pointsAwarded: points,
        walletCreditInr: creditInr,
        sampleSku,
        liveStockVerified,
        consentVerified: true,
        campaignBudgetInr: Number(occCfg.annualOccasionBudgetInr) || 250000,
        status: 'ISSUED',
        expiresAt
      })
      .returning();

    ingestAutomationEvent({
      eventType: params.occasionType === 'BIRTHDAY' ? 'occasion.birthday_reward' : 'occasion.anniversary_reward',
      source: 'fragmore_occasion_engine',
      idempotencyKey: idempBase,
      customerEmail: loyalty.customerEmail,
      payload: {
        grantNumber: grantNo,
        occasionType: params.occasionType,
        pointsAwarded: points,
        walletCreditInr: creditInr,
        expiresAt: expiresAt.toISOString()
      }
    }).catch(() => {});

    return grant;
  });
}

// ============================================================================
// MODULE 7: CHECKOUT PREVIEW, ATOMIC RESERVATION, CAPTURE & AUTO-RESTORE
// ============================================================================

export interface CheckoutRewardsCalculationInput {
  customerEmail: string;
  cartSubtotalInr: number;
  couponDiscountInr?: number;
  couponCode?: string | null;
  shippingInr?: number;
  giftWrapInr?: number;
  items?: Array<{ productId?: string; productName?: string; sku?: string; quantity?: number; totalPrice?: number }>;
  applyWalletCredits: boolean;
  requestedWalletAmountInr?: number;
  applyLoyaltyPoints: boolean;
  requestedLoyaltyPoints?: number;
  applyGiftCard: boolean;
  giftCardCodeOrNumber?: string;
  actorIp?: string;
}

export async function calculateCheckoutRewardsPreview(input: CheckoutRewardsCalculationInput) {
  await ensureRewardsEcosystemSeeded();
  const cfg = await getRewardsMasterConfig();
  const loyCfg = (cfg.loyaltyConfig as any) || DEFAULT_REWARDS_CONFIG.loyaltyConfig;
  const chkCfg = (cfg.checkoutRulesConfig as any) || DEFAULT_REWARDS_CONFIG.checkoutRulesConfig;
  const gcCfg = (cfg.giftCardConfig as any) || DEFAULT_REWARDS_CONFIG.giftCardConfig;
  const taxCfg = (cfg.accountingTaxConfig as any) || DEFAULT_REWARDS_CONFIG.accountingTaxConfig;

  const subtotal = Math.max(0, round2(Number(input.cartSubtotalInr) || 0));
  const couponDisc = Math.min(subtotal, Math.max(0, round2(Number(input.couponDiscountInr) || 0)));
  const shipping = Math.max(0, round2(Number(input.shippingInr) || 0));
  const giftWrap = Math.max(0, round2(Number(input.giftWrapInr) || 0));

  const hasGiftCardInCart = (Array.isArray(input.items) ? input.items : []).some((i) => {
    const n = String(i.productName || '').toLowerCase();
    const s = String(i.sku || '').toUpperCase();
    return n.includes('gift card') || s.startsWith('GC-');
  });

  const { wallet, loyalty } = await ensureCustomerWalletAndLoyaltyAccount({
    customerEmail: input.customerEmail
  });

  const tiers = await db.select().from(loyaltyTiers);
  const currentTier = tiers.find((t) => t.tierCode === loyalty.tierCode) || DEFAULT_LOYALTY_TIERS[0];

  const warnings: string[] = [];

  // Maximum combined pre-tax promotional reduction cap (e.g. 35% of subtotal)
  const maxCombinedPreTaxInr = round2(subtotal * ((Number(chkCfg.maxCombinedPreTaxDiscountPct) || 35) / 100));
  let remainingPreTaxCapInr = Math.max(0, round2(maxCombinedPreTaxInr - couponDisc));
  let runningMerchandiseInr = Math.max(0, round2(subtotal - couponDisc));

  // 1. Loyalty Points Calculation (Pre-tax price reduction)
  let loyaltyPointsApplied = 0;
  let loyaltyDiscountInr = 0;
  const availPts = Math.max(0, Number(loyalty.availablePoints) || 0);
  const minPtsReq = Number(loyCfg.minPointsRequiredToRedeem) || 100;
  const ptsUnit = Number(loyCfg.redeemPointsUnit) || 100;
  const rupeePerUnit = Number(loyCfg.redeemRupeePerUnitInr) || 10;

  if (input.applyLoyaltyPoints) {
    if (hasGiftCardInCart) {
      warnings.push('Loyalty points cannot be redeemed toward Gift Card purchases.');
    } else if (couponDisc > 0 && !chkCfg.allowCouponWithLoyalty) {
      warnings.push('Loyalty points cannot be stacked with an active coupon code.');
    } else if (availPts < minPtsReq) {
      warnings.push(`Minimum ${minPtsReq} FRAGMORÉ Privileges points required to redeem.`);
    } else {
      const tierMaxPct = Number(currentTier.maxRedemptionOrderPct) || Number(loyCfg.maxOrderRedemptionPct) || 20;
      const maxLoyaltyRupeesByTier = round2(subtotal * (tierMaxPct / 100));
      const maxAllowedRupees = Math.min(maxLoyaltyRupeesByTier, remainingPreTaxCapInr, runningMerchandiseInr);
      const maxPtsByCap = Math.floor((maxAllowedRupees / rupeePerUnit) * ptsUnit);
      const desiredPts =
        input.requestedLoyaltyPoints && input.requestedLoyaltyPoints > 0
          ? Math.min(availPts, Math.trunc(input.requestedLoyaltyPoints))
          : availPts;
      const cappedPts = Math.floor(Math.min(availPts, desiredPts, maxPtsByCap) / 10) * 10; // clean 10-pt increments
      if (cappedPts >= minPtsReq) {
        loyaltyPointsApplied = cappedPts;
        loyaltyDiscountInr = round2((cappedPts / ptsUnit) * rupeePerUnit);
        runningMerchandiseInr = Math.max(0, round2(runningMerchandiseInr - loyaltyDiscountInr));
        remainingPreTaxCapInr = Math.max(0, round2(remainingPreTaxCapInr - loyaltyDiscountInr));
      }
    }
  }

  // 2. Wallet Credits Calculation (Split cleanly: Promo/Referral/Cashback/Goodwill = Pre-Tax; Refund Store Credit = Post-Tax Tender!)
  const activeBuckets = await db
    .select()
    .from(walletCreditBuckets)
    .where(and(eq(walletCreditBuckets.walletId, wallet.id), eq(walletCreditBuckets.status, 'ACTIVE')))
    .orderBy(asc(walletCreditBuckets.expiresAt), asc(walletCreditBuckets.createdAt));

  const now = new Date();
  let promoWalletEligibleInr = 0;
  let refundWalletEligibleInr = 0;
  for (const b of activeBuckets) {
    if (b.expiresAt && new Date(b.expiresAt) <= now) continue;
    const rem = Math.max(0, round2(Number(b.remainingAmountInr) || 0));
    if (rem <= 0) continue;
    if (subtotal < (Number(b.minOrderValueInr) || 0)) continue;
    if (b.creditType === 'REFUND_CREDIT') {
      refundWalletEligibleInr = round2(refundWalletEligibleInr + rem);
    } else {
      promoWalletEligibleInr = round2(promoWalletEligibleInr + rem);
    }
  }

  let promoWalletAppliedInr = 0;
  if (input.applyWalletCredits && promoWalletEligibleInr > 0) {
    if (hasGiftCardInCart) {
      warnings.push('Promotional wallet credits cannot be applied to Gift Card purchases.');
    } else if (couponDisc > 0 && !chkCfg.allowCouponWithPromoWallet) {
      warnings.push('Promotional wallet credits cannot be combined with a coupon; eligible Refund Store Credits still apply.');
    } else {
      const requestedMax =
        input.requestedWalletAmountInr !== undefined ? Math.max(0, round2(input.requestedWalletAmountInr)) : Infinity;
      promoWalletAppliedInr = Math.min(
        promoWalletEligibleInr,
        remainingPreTaxCapInr,
        runningMerchandiseInr,
        requestedMax
      );
      runningMerchandiseInr = Math.max(0, round2(runningMerchandiseInr - promoWalletAppliedInr));
      remainingPreTaxCapInr = Math.max(0, round2(remainingPreTaxCapInr - promoWalletAppliedInr));
    }
  }

  // 3. GST Calculation on Net Taxable Supply (Indian GST compliant: pre-tax promo/loyalty discounts reduce taxable value; Gift Cards have 0% GST at issuance and 18% GST on underlying fragrance supply at redemption!)
  const gstRate = hasGiftCardInCart ? 0 : (Number(taxCfg.defaultProductGstRatePct) || 18) / 100;
  const taxableValueInr = round2(runningMerchandiseInr + giftWrap);
  const gstAmountInr = round2(taxableValueInr * gstRate);
  const grossInvoiceTotalInr = round2(taxableValueInr + gstAmountInr + shipping);

  // 4. Post-Tax Tender: Customer Refund Store Credit + Gift Card
  let remainingPayableAfterTaxInr = grossInvoiceTotalInr;
  let refundWalletAppliedInr = 0;

  if (input.applyWalletCredits && refundWalletEligibleInr > 0 && !hasGiftCardInCart) {
    const requestedRem =
      input.requestedWalletAmountInr !== undefined
        ? Math.max(0, round2(input.requestedWalletAmountInr - promoWalletAppliedInr))
        : Infinity;
    refundWalletAppliedInr = Math.min(refundWalletEligibleInr, remainingPayableAfterTaxInr, requestedRem);
    remainingPayableAfterTaxInr = Math.max(0, round2(remainingPayableAfterTaxInr - refundWalletAppliedInr));
  }

  const totalWalletAppliedInr = round2(promoWalletAppliedInr + refundWalletAppliedInr);

  // 5. Gift Card Tender Calculation
  let giftCardAppliedInr = 0;
  let verifiedGiftCard: { id: string; cardNumber: string; maskedCode: string; availableInr: number } | null = null;

  if (input.applyGiftCard && input.giftCardCodeOrNumber?.trim()) {
    if (hasGiftCardInCart && !gcCfg.allowGiftCardToBuyGiftCard) {
      warnings.push('Gift cards cannot be used to purchase another Gift Card.');
    } else {
      const rawInput = normalizeGiftCardCode(input.giftCardCodeOrNumber);
      // Allow lookup either by secret code OR by an already-claimed cardNumber belonging strictly to this customer!
      let matchedCard: typeof giftCards.$inferSelect | undefined;
      if (rawInput.startsWith('GC-FRG-')) {
        const [byNum] = await db
          .select()
          .from(giftCards)
          .where(
            and(
              eq(giftCards.cardNumber, rawInput),
              eq(giftCards.claimedByEmail, input.customerEmail.trim().toLowerCase())
            )
          )
          .limit(1);
        matchedCard = byNum;
      } else {
        const hash = hashSecretValue(rawInput);
        const [bySecret] = await db.select().from(giftCards).where(eq(giftCards.codeHash, hash)).limit(1);
        if (!bySecret) {
          await checkAndRecordGiftCardLookupAttempt(input.actorIp || input.customerEmail, false, rawInput);
          warnings.push('Gift card code was not recognized.');
        } else {
          await checkAndRecordGiftCardLookupAttempt(input.actorIp || input.customerEmail, true);
          matchedCard = bySecret;
        }
      }

      if (matchedCard) {
        if (matchedCard.paymentStatus !== 'PAID' || matchedCard.status === 'PENDING_PAYMENT') {
          warnings.push('This gift card is awaiting payment confirmation and is not yet active.');
        } else if (matchedCard.status !== 'ACTIVE' && matchedCard.status !== 'SCHEDULED') {
          warnings.push(`Gift card ${matchedCard.cardNumber} is ${matchedCard.status}.`);
        } else if (new Date(matchedCard.expiresAt) <= now) {
          warnings.push(`Gift card ${matchedCard.cardNumber} has expired.`);
        } else {
          const gcAvail = Math.max(0, round2(Number(matchedCard.remainingBalanceInr) || 0));
          verifiedGiftCard = {
            id: matchedCard.id,
            cardNumber: matchedCard.cardNumber,
            maskedCode: matchedCard.maskedCode,
            availableInr: gcAvail
          };
          giftCardAppliedInr = Math.min(gcAvail, remainingPayableAfterTaxInr);
          remainingPayableAfterTaxInr = Math.max(0, round2(remainingPayableAfterTaxInr - giftCardAppliedInr));
        }
      }
    }
  }

  return {
    customerEmail: wallet.customerEmail,
    walletSummary: {
      totalAvailableInr: computeTotalAvailableWalletInr(wallet),
      promoEligibleInr: promoWalletEligibleInr,
      refundEligibleInr: refundWalletEligibleInr
    },
    loyaltySummary: {
      tierCode: loyalty.tierCode,
      availablePoints: availPts,
      pendingPoints: loyalty.pendingPoints,
      pointsToRupeeRateLabel: `${ptsUnit} pts = ₹${rupeePerUnit}`
    },
    verifiedGiftCard,
    breakdown: {
      cartSubtotalInr: subtotal,
      couponDiscountInr: couponDisc,
      loyaltyPointsRedeemed: loyaltyPointsApplied,
      loyaltyDiscountInr,
      promoWalletAppliedInr,
      refundWalletAppliedInr,
      walletCreditsAppliedInr: totalWalletAppliedInr,
      giftWrapInr: giftWrap,
      taxableValueInr,
      gstAmountInr,
      shippingInr: shipping,
      grossInvoiceTotalInr,
      giftCardAppliedInr,
      finalPayableInr: remainingPayableAfterTaxInr
    },
    warnings
  };
}

/**
 * Atomically locks & deducts Wallet Buckets, Loyalty Points, and Gift Card balances inside a single PostgreSQL transaction
 * using `FOR UPDATE` row-level locks. Two simultaneous redemptions can NEVER overspend a balance!
 */
export async function reserveAndCaptureCheckoutRewardsTransaction(
  input: CheckoutRewardsCalculationInput & {
    idempotencyKey: string;
    orderId?: string;
    orderNumber?: string;
    captureImmediately?: boolean;
  }
) {
  if (!input.idempotencyKey) {
    throw new ValidationError('idempotencyKey is required for atomic checkout reward redemption.');
  }

  await ensureRewardsEcosystemSeeded();
  const cfg = await getRewardsMasterConfig();
  const loyCfg = (cfg.loyaltyConfig as any) || DEFAULT_REWARDS_CONFIG.loyaltyConfig;
  const chkCfg = (cfg.checkoutRulesConfig as any) || DEFAULT_REWARDS_CONFIG.checkoutRulesConfig;

  const { wallet, loyalty } = await ensureCustomerWalletAndLoyaltyAccount({
    customerEmail: input.customerEmail
  });

  return db.transaction(async (tx) => {
    // 1. Idempotency check
    const existingRes = await tx
      .select()
      .from(checkoutRewardReservations)
      .where(eq(checkoutRewardReservations.idempotencyKey, input.idempotencyKey))
      .limit(1);
    if (existingRes[0]) {
      return { reservation: existingRes[0], deduplicated: true };
    }

    // 2. Acquire deterministic row-level FOR UPDATE locks on Wallet and Loyalty Account!
    const [lockedWallet] = await tx
      .select()
      .from(customerWallets)
      .where(eq(customerWallets.id, wallet.id))
      .for('update');

    const [lockedLoyalty] = await tx
      .select()
      .from(loyaltyAccounts)
      .where(eq(loyaltyAccounts.id, loyalty.id))
      .for('update');

    if (lockedWallet.status === 'FROZEN') {
      throw new ValidationError('Wallet is temporarily frozen for security review.');
    }

    const subtotal = Math.max(0, round2(Number(input.cartSubtotalInr) || 0));
    const couponDisc = Math.min(subtotal, Math.max(0, round2(Number(input.couponDiscountInr) || 0)));
    const shipping = Math.max(0, round2(Number(input.shippingInr) || 0));
    const giftWrap = Math.max(0, round2(Number(input.giftWrapInr) || 0));
    const maxCombinedPreTaxInr = round2(subtotal * ((Number(chkCfg.maxCombinedPreTaxDiscountPct) || 35) / 100));
    let remainingPreTaxCapInr = Math.max(0, round2(maxCombinedPreTaxInr - couponDisc));
    let runningMerchandiseInr = Math.max(0, round2(subtotal - couponDisc));

    // 3. Atomic Loyalty Redemption Check & Deduction
    let loyaltyPointsRedeemed = 0;
    let loyaltyDiscountInr = 0;
    const ptsUnit = Number(loyCfg.redeemPointsUnit) || 100;
    const rupeePerUnit = Number(loyCfg.redeemRupeePerUnitInr) || 10;
    const minPts = Number(loyCfg.minPointsRequiredToRedeem) || 100;

    if (input.applyLoyaltyPoints) {
      const availPts = Number(lockedLoyalty.availablePoints) || 0;
      const requestedPts =
        input.requestedLoyaltyPoints && input.requestedLoyaltyPoints > 0
          ? Math.trunc(input.requestedLoyaltyPoints)
          : availPts;

      if (input.requestedLoyaltyPoints && availPts < requestedPts) {
        throw new ErpError(
          409,
          'INSUFFICIENT_LOYALTY_POINTS',
          `Insufficient loyalty points: requested ${requestedPts}, currently available ${availPts}.`
        );
      }

      const tiers = await tx.select().from(loyaltyTiers);
      const currentTier = tiers.find((t) => t.tierCode === lockedLoyalty.tierCode) || DEFAULT_LOYALTY_TIERS[0];
      const tierMaxPct = Number(currentTier.maxRedemptionOrderPct) || 20;
      const maxRupees = Math.min(round2(subtotal * (tierMaxPct / 100)), remainingPreTaxCapInr, runningMerchandiseInr);
      const maxPtsByRule = Math.floor((maxRupees / rupeePerUnit) * ptsUnit);
      const ptsToUse = Math.floor(Math.min(availPts, requestedPts, maxPtsByRule) / 10) * 10;

      if (ptsToUse >= minPts) {
        loyaltyPointsRedeemed = ptsToUse;
        loyaltyDiscountInr = round2((ptsToUse / ptsUnit) * rupeePerUnit);
        const afterPts = availPts - ptsToUse;

        await tx
          .update(loyaltyAccounts)
          .set({
            availablePoints: afterPts,
            lifetimeRedeemedPoints: (Number(lockedLoyalty.lifetimeRedeemedPoints) || 0) + ptsToUse,
            version: sql`${loyaltyAccounts.version} + 1`,
            updatedAt: new Date()
          })
          .where(eq(loyaltyAccounts.id, lockedLoyalty.id));

        const lptRef = await getNextSequence(tx, 'LPT');
        await tx.insert(loyaltyPointsLedger).values({
          id: makeId('lpl'),
          referenceNumber: lptRef,
          idempotencyKey: `chk_loy_${input.idempotencyKey}`,
          loyaltyAccountId: lockedLoyalty.id,
          customerEmail: lockedLoyalty.customerEmail,
          entryType: 'CHECKOUT_REDEEM',
          pointsDelta: -ptsToUse,
          availablePointsBefore: availPts,
          availablePointsAfter: afterPts,
          rupeeEquivalentInr: loyaltyDiscountInr,
          orderId: input.orderId || null,
          orderNumber: input.orderNumber || null,
          reason: `Redeemed ${ptsToUse} points (₹${loyaltyDiscountInr}) at checkout`,
          actorEmail: lockedLoyalty.customerEmail,
          actorRole: 'CUSTOMER'
        });

        runningMerchandiseInr = Math.max(0, round2(runningMerchandiseInr - loyaltyDiscountInr));
        remainingPreTaxCapInr = Math.max(0, round2(remainingPreTaxCapInr - loyaltyDiscountInr));
      }
    }

    // 4. Atomic Wallet Bucket Lock & FIFO Deduction
    const lockedBuckets = await tx
      .select()
      .from(walletCreditBuckets)
      .where(and(eq(walletCreditBuckets.walletId, lockedWallet.id), eq(walletCreditBuckets.status, 'ACTIVE')))
      .orderBy(asc(walletCreditBuckets.expiresAt), asc(walletCreditBuckets.createdAt))
      .for('update');

    const now = new Date();
    const totalAvailBefore = computeTotalAvailableWalletInr(lockedWallet);
    if (
      input.applyWalletCredits &&
      input.requestedWalletAmountInr !== undefined &&
      input.requestedWalletAmountInr > totalAvailBefore + 0.01
    ) {
      throw new ErpError(
        409,
        'INSUFFICIENT_WALLET_BALANCE',
        `Insufficient wallet balance: requested ₹${input.requestedWalletAmountInr}, available ₹${totalAvailBefore}.`
      );
    }

    const bucketBreakdown: Array<{ bucketId: string; creditType: WalletCreditType; amountInr: number }> = [];
    let promoWalletApplied = 0;

    if (input.applyWalletCredits && (couponDisc === 0 || chkCfg.allowCouponWithPromoWallet)) {
      let maxPromoToTake = Math.min(
        remainingPreTaxCapInr,
        runningMerchandiseInr,
        input.requestedWalletAmountInr !== undefined ? round2(input.requestedWalletAmountInr) : Infinity
      );

      for (const b of lockedBuckets) {
        if (maxPromoToTake <= 0) break;
        if (b.creditType === 'REFUND_CREDIT') continue;
        if (b.expiresAt && new Date(b.expiresAt) <= now) continue;
        if (subtotal < (Number(b.minOrderValueInr) || 0)) continue;
        const bRem = round2(Number(b.remainingAmountInr) || 0);
        if (bRem <= 0) continue;

        const take = Math.min(bRem, maxPromoToTake);
        const nextRem = round2(bRem - take);
        await tx
          .update(walletCreditBuckets)
          .set({
            remainingAmountInr: nextRem,
            status: nextRem <= 0 ? 'EXHAUSTED' : 'ACTIVE',
            updatedAt: new Date()
          })
          .where(eq(walletCreditBuckets.id, b.id));

        bucketBreakdown.push({ bucketId: b.id, creditType: b.creditType as WalletCreditType, amountInr: take });
        promoWalletApplied = round2(promoWalletApplied + take);
        maxPromoToTake = round2(maxPromoToTake - take);
      }
      runningMerchandiseInr = Math.max(0, round2(runningMerchandiseInr - promoWalletApplied));
    }

    // Calculate GST after pre-tax discounts
    const taxableValueInr = round2(runningMerchandiseInr + giftWrap);
    const gstAmountInr = round2(taxableValueInr * 0.18);
    let remainingPayableInr = round2(taxableValueInr + gstAmountInr + shipping);

    // Apply Refund Store Credit buckets (Post-tax tender)
    let refundWalletApplied = 0;
    if (input.applyWalletCredits && remainingPayableInr > 0) {
      let maxRefundToTake = Math.min(
        remainingPayableInr,
        input.requestedWalletAmountInr !== undefined
          ? Math.max(0, round2(input.requestedWalletAmountInr - promoWalletApplied))
          : Infinity
      );
      for (const b of lockedBuckets) {
        if (maxRefundToTake <= 0) break;
        if (b.creditType !== 'REFUND_CREDIT') continue;
        if (b.expiresAt && new Date(b.expiresAt) <= now) continue;
        const bRem = round2(Number(b.remainingAmountInr) || 0);
        if (bRem <= 0) continue;

        const take = Math.min(bRem, maxRefundToTake);
        const nextRem = round2(bRem - take);
        await tx
          .update(walletCreditBuckets)
          .set({
            remainingAmountInr: nextRem,
            status: nextRem <= 0 ? 'EXHAUSTED' : 'ACTIVE',
            updatedAt: new Date()
          })
          .where(eq(walletCreditBuckets.id, b.id));

        bucketBreakdown.push({ bucketId: b.id, creditType: 'REFUND_CREDIT', amountInr: take });
        refundWalletApplied = round2(refundWalletApplied + take);
        maxRefundToTake = round2(maxRefundToTake - take);
      }
      remainingPayableInr = Math.max(0, round2(remainingPayableInr - refundWalletApplied));
    }

    const totalWalletAppliedInr = round2(promoWalletApplied + refundWalletApplied);
    if (
      input.applyWalletCredits &&
      input.requestedWalletAmountInr !== undefined &&
      input.requestedWalletAmountInr > 0 &&
      totalWalletAppliedInr + 0.01 < input.requestedWalletAmountInr
    ) {
      throw new ErpError(
        409,
        'WALLET_CONCURRENT_EXHAUSTED',
        `Requested ₹${input.requestedWalletAmountInr} wallet credit could not be fulfilled (eligible available: ₹${totalWalletAppliedInr}).`
      );
    }

    if (totalWalletAppliedInr > 0) {
      await tx
        .update(customerWallets)
        .set({
          totalRedeemedInr: round2((Number(lockedWallet.totalRedeemedInr) || 0) + totalWalletAppliedInr)
        })
        .where(eq(customerWallets.id, lockedWallet.id));

      const updatedWlt = await recalculateWalletTotalsInTx(tx, lockedWallet.id);
      const afterWltAvail = computeTotalAvailableWalletInr(updatedWlt);
      const wltRef = await getNextSequence(tx, 'WLT');

      await tx.insert(walletTransactions).values({
        id: makeId('wtx'),
        referenceNumber: wltRef,
        idempotencyKey: `chk_wlt_${input.idempotencyKey}`,
        walletId: lockedWallet.id,
        customerEmail: lockedWallet.customerEmail,
        txnType: 'CHECKOUT_CAPTURE',
        creditType: refundWalletApplied > 0 && promoWalletApplied === 0 ? 'REFUND_CREDIT' : 'PROMOTIONAL_CREDIT',
        direction: 'DEBIT',
        amountInr: totalWalletAppliedInr,
        availableBalanceBeforeInr: totalAvailBefore,
        availableBalanceAfterInr: afterWltAvail,
        orderId: input.orderId || null,
        orderNumber: input.orderNumber || null,
        reason: `Redeemed ₹${totalWalletAppliedInr} wallet credit at checkout${input.orderNumber ? ` (${input.orderNumber})` : ''}`,
        actorEmail: lockedWallet.customerEmail,
        actorRole: 'CUSTOMER',
        metadata: { bucketBreakdown }
      });
    }

    // 5. Atomic Gift Card Row-Lock & Deduction
    let giftCardIdUsed: string | null = null;
    let giftCardNumberUsed: string | null = null;
    let giftCardAppliedInr = 0;

    if (input.applyGiftCard && input.giftCardCodeOrNumber?.trim() && remainingPayableInr > 0) {
      const rawCode = normalizeGiftCardCode(input.giftCardCodeOrNumber);
      let lockedCardRows: Array<typeof giftCards.$inferSelect> = [];
      if (rawCode.startsWith('GC-FRG-')) {
        lockedCardRows = await tx
          .select()
          .from(giftCards)
          .where(
            and(
              eq(giftCards.cardNumber, rawCode),
              eq(giftCards.claimedByEmail, lockedWallet.customerEmail)
            )
          )
          .for('update');
      } else {
        const hash = hashSecretValue(rawCode);
        lockedCardRows = await tx.select().from(giftCards).where(eq(giftCards.codeHash, hash)).for('update');
      }

      const lockedCard = lockedCardRows[0];
      if (!lockedCard) {
        throw new NotFoundError('Gift card not found or unauthorized.');
      }
      if (lockedCard.paymentStatus !== 'PAID' || (lockedCard.status !== 'ACTIVE' && lockedCard.status !== 'SCHEDULED')) {
        throw new ValidationError(`Gift card ${lockedCard.cardNumber} is not active for redemption.`);
      }
      if (new Date(lockedCard.expiresAt) <= now) {
        throw new ValidationError(`Gift card ${lockedCard.cardNumber} has expired.`);
      }

      const cardBalBefore = round2(Number(lockedCard.remainingBalanceInr) || 0);
      if (cardBalBefore <= 0) {
        throw new ErpError(409, 'GIFT_CARD_DEPLETED', `Gift card ${lockedCard.cardNumber} has ₹0 remaining balance.`);
      }

      giftCardAppliedInr = Math.min(cardBalBefore, remainingPayableInr);
      const cardBalAfter = round2(cardBalBefore - giftCardAppliedInr);

      await tx
        .update(giftCards)
        .set({
          remainingBalanceInr: cardBalAfter,
          status: cardBalAfter <= 0 ? 'REDEEMED' : 'ACTIVE',
          version: sql`${giftCards.version} + 1`,
          updatedAt: new Date()
        })
        .where(eq(giftCards.id, lockedCard.id));

      const gctxRef = await getNextSequence(tx, 'GCTX');
      await tx.insert(giftCardTransactions).values({
        id: makeId('gctx'),
        referenceNumber: gctxRef,
        idempotencyKey: `chk_gc_${input.idempotencyKey}`,
        giftCardId: lockedCard.id,
        cardNumber: lockedCard.cardNumber,
        txnType: 'CHECKOUT_REDEMPTION',
        channel: 'WEB_STOREFRONT',
        amountInr: giftCardAppliedInr,
        balanceBeforeInr: cardBalBefore,
        balanceAfterInr: cardBalAfter,
        orderId: input.orderId || null,
        orderNumber: input.orderNumber || null,
        redeemedByEmail: lockedWallet.customerEmail,
        notes: `Redeemed ₹${giftCardAppliedInr} at checkout`
      });

      giftCardIdUsed = lockedCard.id;
      giftCardNumberUsed = lockedCard.cardNumber;
      remainingPayableInr = Math.max(0, round2(remainingPayableInr - giftCardAppliedInr));
    }

    // 6. Post Double-Entry GL for Redeemed Liabilities/Expenses
    if (giftCardAppliedInr > 0 || refundWalletApplied > 0 || promoWalletApplied > 0 || loyaltyDiscountInr > 0) {
      const glLines: any[] = [];
      let totalClear = 0;
      if (giftCardAppliedInr > 0) {
        glLines.push({
          accountCode: '2310',
          accountName: 'Unredeemed Gift Card Deferred Liability',
          accountType: 'LIABILITY',
          debitInr: giftCardAppliedInr,
          creditInr: 0,
          costCenter: 'CC-510'
        });
        totalClear = round2(totalClear + giftCardAppliedInr);
      }
      if (refundWalletApplied > 0) {
        glLines.push({
          accountCode: '2320',
          accountName: 'Customer Refund Store Credit Liability',
          accountType: 'LIABILITY',
          debitInr: refundWalletApplied,
          creditInr: 0,
          costCenter: 'CC-510'
        });
        totalClear = round2(totalClear + refundWalletApplied);
      }
      if (loyaltyDiscountInr > 0) {
        glLines.push({
          accountCode: '2330',
          accountName: 'FRAGMORÉ Privileges Loyalty Points Reserve',
          accountType: 'LIABILITY',
          debitInr: loyaltyDiscountInr,
          creditInr: 0,
          costCenter: 'CC-510'
        });
        totalClear = round2(totalClear + loyaltyDiscountInr);
      }
      if (promoWalletApplied > 0) {
        glLines.push({
          accountCode: '5410',
          accountName: 'Promotional Wallet, Referral & Loyalty Reward Expense',
          accountType: 'EXPENSE',
          debitInr: promoWalletApplied,
          creditInr: 0,
          costCenter: 'CC-610'
        });
        totalClear = round2(totalClear + promoWalletApplied);
      }
      if (totalClear > 0) {
        glLines.push({
          accountCode: '1100',
          accountName: 'Accounts Receivable — Storefront Orders Clearing',
          accountType: 'ASSET',
          debitInr: 0,
          creditInr: totalClear,
          costCenter: 'CC-410'
        });
        await postRewardsAccountingJournal(tx, {
          sourceModule: 'CHECKOUT_REWARDS_REDEMPTION',
          sourceEntityId: input.orderId || input.idempotencyKey,
          narration: `Checkout rewards & tender redemption for ${lockedWallet.customerEmail}${input.orderNumber ? ` (${input.orderNumber})` : ''}`,
          idempotencyKey: `gl_chk_red_${input.idempotencyKey}`,
          postedByEmail: lockedWallet.customerEmail,
          lines: glLines
        });
      }
    }

    // 7. Create Checkout Reservation/Capture Record
    const resNo = await getNextSequence(tx, 'CRES');
    const [reservation] = await tx
      .insert(checkoutRewardReservations)
      .values({
        id: makeId('cres'),
        reservationNumber: resNo,
        idempotencyKey: input.idempotencyKey,
        customerEmail: lockedWallet.customerEmail,
        orderId: input.orderId || null,
        orderNumber: input.orderNumber || null,
        cartSubtotalInr: subtotal,
        couponDiscountInr: couponDisc,
        walletAppliedInr: totalWalletAppliedInr,
        walletBucketBreakdown: bucketBreakdown,
        loyaltyPointsRedeemed,
        loyaltyDiscountInr,
        giftCardId: giftCardIdUsed,
        giftCardNumber: giftCardNumberUsed,
        giftCardAppliedInr,
        taxableValueInr,
        gstAmountInr,
        shippingInr: shipping,
        finalPayableInr: remainingPayableInr,
        status: input.captureImmediately === false ? 'RESERVED' : 'CAPTURED',
        expiresAt: new Date(Date.now() + (Number(chkCfg.reservationExpiryMinutes) || 20) * 60000),
        capturedAt: input.captureImmediately === false ? null : new Date()
      })
      .returning();

    return { reservation, deduplicated: false };
  });
}

export async function linkCheckoutReservationToOrder(params: {
  reservationId: string;
  orderId: string;
  orderNumber: string;
}) {
  if (!params.reservationId || !params.orderId) return null;
  const [updated] = await db
    .update(checkoutRewardReservations)
    .set({
      orderId: params.orderId,
      orderNumber: params.orderNumber,
      updatedAt: new Date()
    })
    .where(eq(checkoutRewardReservations.id, params.reservationId))
    .returning();
  return updated || null;
}

/**
 * Automatically restores redeemed Wallet buckets, Loyalty points, and Gift Card balances
 * when a payment fails or an order is cancelled!
 */
export async function restoreRedeemedRewardsOnCancelOrPaymentFailure(params: {
  orderId?: string;
  reservationId?: string;
  reason: string;
  actorEmail?: string;
}) {
  return db.transaction(async (tx) => {
    const resRows = params.reservationId
      ? await tx
          .select()
          .from(checkoutRewardReservations)
          .where(eq(checkoutRewardReservations.id, params.reservationId))
          .for('update')
      : params.orderId
      ? await tx
          .select()
          .from(checkoutRewardReservations)
          .where(eq(checkoutRewardReservations.orderId, params.orderId))
          .for('update')
      : [];

    const resv = resRows[0];
    if (!resv) return { restored: false, reason: 'No reward reservation linked to order' };
    if (resv.status === 'RELEASED' || resv.status === 'RESTORED_ON_CANCEL') {
      return { restored: true, deduplicated: true, reservation: resv };
    }

    const actor = params.actorEmail || 'system@fragmore.shop';

    // 1. Restore Wallet Buckets
    if ((Number(resv.walletAppliedInr) || 0) > 0) {
      const [lockedWallet] = await tx
        .select()
        .from(customerWallets)
        .where(eq(customerWallets.customerEmail, resv.customerEmail))
        .for('update');
      if (lockedWallet) {
        const beforeAvail = computeTotalAvailableWalletInr(lockedWallet);
        const breakdown = Array.isArray(resv.walletBucketBreakdown) ? (resv.walletBucketBreakdown as any[]) : [];
        for (const item of breakdown) {
          const [b] = await tx
            .select()
            .from(walletCreditBuckets)
            .where(eq(walletCreditBuckets.id, item.bucketId))
            .for('update');
          if (b) {
            await tx
              .update(walletCreditBuckets)
              .set({
                remainingAmountInr: round2((Number(b.remainingAmountInr) || 0) + (Number(item.amountInr) || 0)),
                status: 'ACTIVE',
                updatedAt: new Date()
              })
              .where(eq(walletCreditBuckets.id, b.id));
          }
        }
        await tx
          .update(customerWallets)
          .set({
            totalRedeemedInr: Math.max(0, round2((Number(lockedWallet.totalRedeemedInr) || 0) - Number(resv.walletAppliedInr)))
          })
          .where(eq(customerWallets.id, lockedWallet.id));

        const updatedWlt = await recalculateWalletTotalsInTx(tx, lockedWallet.id);
        const afterAvail = computeTotalAvailableWalletInr(updatedWlt);
        const wltRef = await getNextSequence(tx, 'WLT');

        await tx.insert(walletTransactions).values({
          id: makeId('wtx'),
          referenceNumber: wltRef,
          idempotencyKey: `restore_wlt_${resv.id}`,
          walletId: lockedWallet.id,
          customerEmail: lockedWallet.customerEmail,
          txnType: 'CANCEL_RESTORE',
          creditType: 'PROMOTIONAL_CREDIT',
          direction: 'CREDIT',
          amountInr: Number(resv.walletAppliedInr),
          availableBalanceBeforeInr: beforeAvail,
          availableBalanceAfterInr: afterAvail,
          orderId: resv.orderId,
          orderNumber: resv.orderNumber,
          reason: `Auto-restored wallet credits (${params.reason})`,
          actorEmail: actor,
          actorRole: 'SYSTEM'
        });
      }
    }

    // 2. Restore Loyalty Points
    if ((Number(resv.loyaltyPointsRedeemed) || 0) > 0) {
      const [lockedLoy] = await tx
        .select()
        .from(loyaltyAccounts)
        .where(eq(loyaltyAccounts.customerEmail, resv.customerEmail))
        .for('update');
      if (lockedLoy) {
        const beforePts = Number(lockedLoy.availablePoints) || 0;
        const ptsRestore = Number(resv.loyaltyPointsRedeemed);
        const afterPts = beforePts + ptsRestore;
        await tx
          .update(loyaltyAccounts)
          .set({
            availablePoints: afterPts,
            lifetimeRedeemedPoints: Math.max(0, (Number(lockedLoy.lifetimeRedeemedPoints) || 0) - ptsRestore),
            updatedAt: new Date()
          })
          .where(eq(loyaltyAccounts.id, lockedLoy.id));

        const lptRef = await getNextSequence(tx, 'LPT');
        await tx.insert(loyaltyPointsLedger).values({
          id: makeId('lpl'),
          referenceNumber: lptRef,
          idempotencyKey: `restore_loy_${resv.id}`,
          loyaltyAccountId: lockedLoy.id,
          customerEmail: lockedLoy.customerEmail,
          entryType: 'ORDER_CANCEL_RESTORE',
          pointsDelta: ptsRestore,
          availablePointsBefore: beforePts,
          availablePointsAfter: afterPts,
          rupeeEquivalentInr: Number(resv.loyaltyDiscountInr) || 0,
          orderId: resv.orderId,
          orderNumber: resv.orderNumber,
          reason: `Auto-restored redeemed points (${params.reason})`,
          actorEmail: actor,
          actorRole: 'SYSTEM'
        });
      }
    }

    // 3. Restore Gift Card Balance
    if (resv.giftCardId && (Number(resv.giftCardAppliedInr) || 0) > 0) {
      const [lockedCard] = await tx
        .select()
        .from(giftCards)
        .where(eq(giftCards.id, resv.giftCardId))
        .for('update');
      if (lockedCard) {
        const beforeBal = round2(Number(lockedCard.remainingBalanceInr) || 0);
        const afterBal = round2(beforeBal + Number(resv.giftCardAppliedInr));
        await tx
          .update(giftCards)
          .set({
            remainingBalanceInr: afterBal,
            status: 'ACTIVE',
            updatedAt: new Date()
          })
          .where(eq(giftCards.id, lockedCard.id));

        const gcRef = await getNextSequence(tx, 'GCTX');
        await tx.insert(giftCardTransactions).values({
          id: makeId('gctx'),
          referenceNumber: gcRef,
          idempotencyKey: `restore_gc_${resv.id}`,
          giftCardId: lockedCard.id,
          cardNumber: lockedCard.cardNumber,
          txnType: 'CANCEL_RESTORE',
          channel: 'WEB_STOREFRONT',
          amountInr: Number(resv.giftCardAppliedInr),
          balanceBeforeInr: beforeBal,
          balanceAfterInr: afterBal,
          orderId: resv.orderId,
          orderNumber: resv.orderNumber,
          notes: `Auto-restored on order cancel / payment failure (${params.reason})`
        });
      }
    }

    // Also reverse any pending loyalty points earned on this cancelled order
    if (resv.orderId) {
      const earnedRows = await tx
        .select()
        .from(loyaltyPointsLedger)
        .where(and(eq(loyaltyPointsLedger.orderId, resv.orderId), eq(loyaltyPointsLedger.entryType, 'PENDING_EARN')));
      if (earnedRows[0] && earnedRows[0].pointsDelta > 0) {
        await tx
          .update(loyaltyAccounts)
          .set({
            pendingPoints: sql`GREATEST(0, ${loyaltyAccounts.pendingPoints} - ${earnedRows[0].pointsDelta})`,
            updatedAt: new Date()
          })
          .where(eq(loyaltyAccounts.customerEmail, resv.customerEmail));
      }
    }

    const [updatedResv] = await tx
      .update(checkoutRewardReservations)
      .set({
        status: 'RESTORED_ON_CANCEL',
        releasedAt: new Date(),
        releaseReason: params.reason,
        updatedAt: new Date()
      })
      .where(eq(checkoutRewardReservations.id, resv.id))
      .returning();

    return { restored: true, deduplicated: false, reservation: updatedResv };
  });
}

/**
 * Handles Returns, Partial Returns & Store-Credit Opt-In Refunds:
 * - Proportionally reverses loyalty points earned on the returned merchandise
 * - Reverses referral rewards if a referred qualifying first order is refunded
 * - Credits REFUND_CREDIT to wallet ONLY if customer expressly opted in (`refundToWalletOptIn === true`)
 */
export async function processReturnAndRefundRewardsSync(params: {
  returnId: string;
  orderId: string;
  orderNumber?: string;
  customerEmail: string;
  refundAmountInr: number;
  orderTotalInr: number;
  refundToWalletOptIn?: boolean;
  actorEmail?: string;
}) {
  await ensureRewardsEcosystemSeeded();
  const email = String(params.customerEmail || '').trim().toLowerCase();
  if (!email) return null;

  const refundAmt = round2(Number(params.refundAmountInr) || 0);
  const orderTotal = Math.max(refundAmt, round2(Number(params.orderTotalInr) || refundAmt));
  if (refundAmt <= 0) return null;

  const refundRatio = orderTotal > 0 ? Math.min(1, refundAmt / orderTotal) : 1;
  const actor = params.actorEmail || 'returns@fragmore.shop';

  // 1. Reverse proportional earned/pending loyalty points for this order
  const orderEarnEntries = await db
    .select()
    .from(loyaltyPointsLedger)
    .where(eq(loyaltyPointsLedger.orderId, params.orderId));

  const maturedEarn = orderEarnEntries.find((e) => e.entryType === 'MATURED_EARN');
  const pendingEarn = orderEarnEntries.find((e) => e.entryType === 'PENDING_EARN');
  const baseEarnedPts = maturedEarn?.pointsDelta || pendingEarn?.pointsDelta || 0;
  const ptsToReverse = Math.round(baseEarnedPts * refundRatio);

  let reversedPoints = 0;
  if (ptsToReverse > 0) {
    await db.transaction(async (tx) => {
      const idempKey = `ret_loy_rev_${params.returnId}`;
      const exists = await tx
        .select()
        .from(loyaltyPointsLedger)
        .where(eq(loyaltyPointsLedger.idempotencyKey, idempKey))
        .limit(1);
      if (exists[0]) return;

      const [lockedAcct] = await tx
        .select()
        .from(loyaltyAccounts)
        .where(eq(loyaltyAccounts.customerEmail, email))
        .for('update');
      if (!lockedAcct) return;

      if (maturedEarn) {
        const beforeAvail = Number(lockedAcct.availablePoints) || 0;
        const deductAvail = Math.min(beforeAvail, ptsToReverse);
        const afterAvail = beforeAvail - deductAvail;
        await tx
          .update(loyaltyAccounts)
          .set({
            availablePoints: afterAvail,
            lifetimeReversedPoints: (Number(lockedAcct.lifetimeReversedPoints) || 0) + deductAvail,
            qualifyingNetSpendInr: Math.max(0, round2((Number(lockedAcct.qualifyingNetSpendInr) || 0) - refundAmt)),
            updatedAt: new Date()
          })
          .where(eq(loyaltyAccounts.id, lockedAcct.id));

        const refNo = await getNextSequence(tx, 'LPT');
        await tx.insert(loyaltyPointsLedger).values({
          id: makeId('lpl'),
          referenceNumber: refNo,
          idempotencyKey: idempKey,
          loyaltyAccountId: lockedAcct.id,
          customerEmail: email,
          entryType: 'RETURN_REVERSAL',
          pointsDelta: -deductAvail,
          availablePointsBefore: beforeAvail,
          availablePointsAfter: afterAvail,
          orderId: params.orderId,
          orderNumber: params.orderNumber || null,
          reason: `Reversed ${deductAvail} pts on return ${params.returnId} (₹${refundAmt} refunded)`,
          actorEmail: actor,
          actorRole: 'SYSTEM'
        });
        reversedPoints = deductAvail;
        await recalculateLoyaltyTierInTx(tx, lockedAcct.id);
      } else if (pendingEarn) {
        const deductPending = Math.min(Number(lockedAcct.pendingPoints) || 0, ptsToReverse);
        await tx
          .update(loyaltyAccounts)
          .set({
            pendingPoints: Math.max(0, (Number(lockedAcct.pendingPoints) || 0) - deductPending),
            updatedAt: new Date()
          })
          .where(eq(loyaltyAccounts.id, lockedAcct.id));
        reversedPoints = deductPending;
      }
    });
  }

  // 2. Reverse referral reward if this was a referred qualifying order and net retained falls below threshold
  const [refConv] = await db
    .select()
    .from(referralConversions)
    .where(eq(referralConversions.qualifyingOrderId, params.orderId))
    .limit(1);

  let referralReversed = false;
  if (refConv && refConv.status !== 'REVERSED_REFUND') {
    const remainingNet = round2((Number(refConv.qualifyingOrderNetInr) || orderTotal) - refundAmt);
    const cfg = await getRewardsMasterConfig();
    const minFirstOrder = Number((cfg.referralConfig as any)?.minFirstOrderValueInr) || 699;
    if (remainingNet < minFirstOrder) {
      if (refConv.status === 'COMPLETED_REWARDED') {
        // Attempt clawback of unspent referral credit from referrer
        await debitOrReverseWalletAdminTransaction({
          customerEmail: refConv.referrerEmail,
          amountInr: Number(refConv.referrerCreditInr) || 75,
          creditType: 'REFERRAL_CREDIT',
          reason: `Referral reward reversed due to refund on referred order ${params.orderNumber || params.orderId}`,
          idempotencyKey: `ref_rev_${params.returnId}`,
          actorEmail: actor,
          actorRole: 'SYSTEM'
        }).catch(() => {});
      }
      await db
        .update(referralConversions)
        .set({ status: 'REVERSED_REFUND', reversedAt: new Date(), updatedAt: new Date() })
        .where(eq(referralConversions.id, refConv.id));
      referralReversed = true;
    }
  }

  // 3. Issue Store-Credit Refund ONLY when customer expressly opted in
  let storeCreditIssued = null;
  if (params.refundToWalletOptIn) {
    storeCreditIssued = await issueWalletCreditTransaction({
      customerEmail: email,
      creditType: 'REFUND_CREDIT',
      amountInr: refundAmt,
      sourceType: 'ORDER_REFUND_OPT_IN',
      sourceRefId: params.orderId,
      reason: `Customer-approved store credit refund for return ${params.returnId}`,
      customerOptedInStoreCredit: true,
      expiresInDays: 365,
      idempotencyKey: `ret_wlt_credit_${params.returnId}`,
      actorEmail: actor,
      actorRole: 'SYSTEM'
    });
  }

  return { reversedPoints, referralReversed, storeCreditIssued };
}

// ============================================================================
// APPROVAL WORKFLOW & ACCOUNTANT-APPROVED BREAKAGE RECOGNITION
// ============================================================================

export async function createRewardsApprovalRequest(params: {
  requestSource: 'ADMIN_CONSOLE' | 'CUSTOMER_SUPPORT' | 'AI_REWARDS_ASSISTANT' | 'FINANCE_BREAKAGE';
  actionType:
    | 'WALLET_CREDIT_ISSUE'
    | 'WALLET_DEBIT_ADJUST'
    | 'LOYALTY_POINTS_ADJUST'
    | 'GIFT_CARD_ISSUE'
    | 'GIFT_CARD_BLOCK_CANCEL'
    | 'REFERRAL_REVIEW_RELEASE'
    | 'BREAKAGE_RECOGNITION'
    | 'CAMPAIGN_LAUNCH';
  targetCustomerEmail?: string;
  targetEntityId?: string;
  amountInr?: number;
  pointsDelta?: number;
  creditType?: WalletCreditType;
  reason: string;
  payload: Record<string, any>;
  actor: RewardsActor;
}) {
  if (!params.reason || !params.reason.trim()) {
    throw new ValidationError('Mandatory reason is required to submit a reward approval request.');
  }

  return db.transaction(async (tx) => {
    const approvalNumber = await getNextSequence(tx, 'RAPR');
    const [row] = await tx
      .insert(rewardsAdjustmentApprovals)
      .values({
        id: makeId('rapr'),
        approvalNumber,
        requestSource: params.requestSource,
        actionType: params.actionType,
        targetCustomerEmail: params.targetCustomerEmail?.trim().toLowerCase() || null,
        targetEntityId: params.targetEntityId || null,
        amountInr: round2(Number(params.amountInr) || 0),
        pointsDelta: Math.trunc(Number(params.pointsDelta) || 0),
        creditType: params.creditType || null,
        reason: params.reason.trim(),
        payload: params.payload || {},
        requestedByEmail: params.actor.email,
        requestedByRole: params.actor.role,
        status: 'PENDING_APPROVAL'
      })
      .returning();

    await recordErpAuditLog(tx, {
      action: 'REWARDS_APPROVAL_REQUESTED',
      entity: 'rewards_adjustment_approvals',
      entityId: row.id,
      actorEmail: params.actor.email,
      actorRole: params.actor.role,
      details: `Queued ${params.actionType} (${approvalNumber}) for approval. Reason: ${params.reason}`
    });

    return row;
  });
}

export async function decideRewardsApprovalRequest(params: {
  approvalId: string;
  decision: 'APPROVE' | 'REJECT';
  decisionNotes?: string;
  actor: RewardsActor;
}) {
  assertRewardsStaffRoles(params.actor, ['SUPER_ADMIN', 'FINANCE_CONTROLLER'], 'Approve/Reject Reward Adjustment');

  const [reqRow] = await db
    .select()
    .from(rewardsAdjustmentApprovals)
    .where(eq(rewardsAdjustmentApprovals.id, params.approvalId))
    .limit(1);
  if (!reqRow) throw new NotFoundError('Approval request not found.');
  if (reqRow.status !== 'PENDING_APPROVAL') {
    throw new ValidationError(`Request ${reqRow.approvalNumber} has already been ${reqRow.status}.`);
  }

  if (params.decision === 'REJECT') {
    const [rejected] = await db
      .update(rewardsAdjustmentApprovals)
      .set({
        status: 'REJECTED',
        decidedByEmail: params.actor.email,
        decidedByRole: params.actor.role,
        decisionNotes: params.decisionNotes || 'Rejected by reviewer',
        decidedAt: new Date()
      })
      .where(eq(rewardsAdjustmentApprovals.id, reqRow.id))
      .returning();
    return rejected;
  }

  let executionResult: any = { status: 'EXECUTED' };
  const payload = (reqRow.payload || {}) as Record<string, any>;

  if (reqRow.actionType === 'WALLET_CREDIT_ISSUE' && reqRow.targetCustomerEmail) {
    executionResult = await issueWalletCreditTransaction({
      customerEmail: reqRow.targetCustomerEmail,
      creditType: (reqRow.creditType as WalletCreditType) || 'GOODWILL_CREDIT',
      amountInr: Number(reqRow.amountInr) || 0,
      sourceType: reqRow.requestSource === 'CUSTOMER_SUPPORT' ? 'CONCIERGE_GOODWILL' : 'ADMIN_APPROVED',
      sourceRefId: reqRow.approvalNumber,
      reason: reqRow.reason,
      expiresInDays: Number(payload.expiresInDays) || 180,
      idempotencyKey: `apr_exec_${reqRow.id}`,
      actorEmail: params.actor.email,
      actorRole: params.actor.role
    });
  } else if (reqRow.actionType === 'WALLET_DEBIT_ADJUST' && reqRow.targetCustomerEmail) {
    executionResult = await debitOrReverseWalletAdminTransaction({
      customerEmail: reqRow.targetCustomerEmail,
      amountInr: Number(reqRow.amountInr) || 0,
      creditType: (reqRow.creditType as WalletCreditType) || undefined,
      reason: reqRow.reason,
      idempotencyKey: `apr_exec_${reqRow.id}`,
      actorEmail: params.actor.email,
      actorRole: params.actor.role
    });
  } else if (reqRow.actionType === 'LOYALTY_POINTS_ADJUST' && reqRow.targetCustomerEmail) {
    executionResult = await adjustLoyaltyPointsAdminTransaction({
      customerEmail: reqRow.targetCustomerEmail,
      pointsDelta: Number(reqRow.pointsDelta) || 0,
      reason: reqRow.reason,
      idempotencyKey: `apr_exec_${reqRow.id}`,
      actorEmail: params.actor.email,
      actorRole: params.actor.role
    });
  } else if (reqRow.actionType === 'REFERRAL_REVIEW_RELEASE' && reqRow.targetEntityId) {
    const [conv] = await db
      .select()
      .from(referralConversions)
      .where(eq(referralConversions.id, reqRow.targetEntityId))
      .limit(1);
    if (conv) {
      await db
        .update(referralConversions)
        .set({
          status: 'REGISTERED',
          reviewedByEmail: params.actor.email,
          reviewNotes: params.decisionNotes || 'Approved legitimate household referral',
          updatedAt: new Date()
        })
        .where(eq(referralConversions.id, conv.id));
      if (conv.qualifyingOrderId) {
        executionResult = await evaluateReferralOnFirstOrder({
          orderId: conv.qualifyingOrderId,
          orderNumber: conv.qualifyingOrderNumber || conv.qualifyingOrderId,
          customerEmail: conv.refereeEmail,
          netOrderValueInr: Number(conv.qualifyingOrderNetInr) || 1000,
          orderDeliveredAndMatured: true
        });
      }
    }
  } else if (reqRow.actionType === 'BREAKAGE_RECOGNITION') {
    const breakageAmt = round2(Number(reqRow.amountInr) || 0);
    if (breakageAmt > 0) {
      await db.transaction(async (tx) => {
        const jId = await postRewardsAccountingJournal(tx, {
          sourceModule: 'ACCOUNTANT_APPROVED_BREAKAGE',
          sourceEntityId: reqRow.id,
          narration: `Accountant-approved expired Gift Card / Loyalty breakage recognition (${reqRow.approvalNumber})`,
          idempotencyKey: `gl_breakage_${reqRow.id}`,
          postedByEmail: params.actor.email,
          lines: [
            {
              accountCode: '2310',
              accountName: 'Unredeemed Gift Card Deferred Liability',
              accountType: 'LIABILITY',
              debitInr: breakageAmt,
              creditInr: 0,
              costCenter: 'CC-510'
            },
            {
              accountCode: '4310',
              accountName: 'Accountant-Approved Gift Card & Reward Breakage Income',
              accountType: 'REVENUE',
              debitInr: 0,
              creditInr: breakageAmt,
              costCenter: 'CC-510'
            }
          ]
        });
        executionResult = { journalId: jId, breakageRecognizedInr: breakageAmt };
      });
    }
  }

  const [approved] = await db
    .update(rewardsAdjustmentApprovals)
    .set({
      status: 'APPROVED_EXECUTED',
      decidedByEmail: params.actor.email,
      decidedByRole: params.actor.role,
      decisionNotes: params.decisionNotes || 'Approved and executed',
      executionResult,
      decidedAt: new Date()
    })
    .where(eq(rewardsAdjustmentApprovals.id, reqRow.id))
    .returning();

  broadcastCrossBrowserSyncEvent({
    entity: 'REWARDS_ECOSYSTEM',
    action: 'APPROVAL_EXECUTED',
    recordId: approved.id,
    summary: `Executed ${approved.actionType} (${approved.approvalNumber})`
  });

  return approved;
}

// ============================================================================
// CUSTOMER PORTAL & SUPER ADMIN DASHBOARD SNAPSHOT QUERIES
// ============================================================================

export async function getCustomerRewardsPortalSnapshot(customerEmail: string) {
  await ensureRewardsEcosystemSeeded();
  const cfg = await getRewardsMasterConfig();
  const { wallet, loyalty } = await ensureCustomerWalletAndLoyaltyAccount({ customerEmail });

  const [buckets, wltTxns, tiers, ptsLedger, relatedGiftCards, referralsAsReferrer, referralsAsReferee, occasionGrants] =
    await Promise.all([
      db
        .select()
        .from(walletCreditBuckets)
        .where(eq(walletCreditBuckets.walletId, wallet.id))
        .orderBy(asc(walletCreditBuckets.expiresAt), desc(walletCreditBuckets.createdAt)),
      db
        .select()
        .from(walletTransactions)
        .where(eq(walletTransactions.walletId, wallet.id))
        .orderBy(desc(walletTransactions.createdAt))
        .limit(100),
      db.select().from(loyaltyTiers).orderBy(asc(loyaltyTiers.sortOrder)),
      db
        .select()
        .from(loyaltyPointsLedger)
        .where(eq(loyaltyPointsLedger.loyaltyAccountId, loyalty.id))
        .orderBy(desc(loyaltyPointsLedger.createdAt))
        .limit(100),
      db
        .select()
        .from(giftCards)
        .where(
          sql`LOWER(${giftCards.purchaserEmail}) = ${wallet.customerEmail} OR LOWER(${giftCards.claimedByEmail}) = ${wallet.customerEmail} OR (LOWER(${giftCards.recipientEmail}) = ${wallet.customerEmail} AND ${giftCards.paymentStatus} = 'PAID')`
        )
        .orderBy(desc(giftCards.createdAt)),
      db
        .select()
        .from(referralConversions)
        .where(eq(referralConversions.referrerEmail, wallet.customerEmail))
        .orderBy(desc(referralConversions.createdAt)),
      db
        .select()
        .from(referralConversions)
        .where(eq(referralConversions.refereeEmail, wallet.customerEmail))
        .limit(5),
      db
        .select()
        .from(occasionRewardLogs)
        .where(eq(occasionRewardLogs.customerEmail, wallet.customerEmail))
        .orderBy(desc(occasionRewardLogs.createdAt))
    ]);

  const cardIds = relatedGiftCards.map((c) => c.id);
  const gcTxns =
    cardIds.length > 0
      ? await db
          .select()
          .from(giftCardTransactions)
          .where(inArray(giftCardTransactions.giftCardId, cardIds))
          .orderBy(desc(giftCardTransactions.createdAt))
      : [];

  // Expiring within 30 days
  const in30Days = new Date(Date.now() + 30 * 86400000);
  const now = new Date();
  const expiringPromoCreditsInr = round2(
    buckets
      .filter((b) => b.status === 'ACTIVE' && b.expiresAt && new Date(b.expiresAt) > now && new Date(b.expiresAt) <= in30Days)
      .reduce((s, b) => s + (Number(b.remainingAmountInr) || 0), 0)
  );

  // Sanitize gift cards: never expose raw hashes/encrypted ciphers in general list
  const safeGiftCards = relatedGiftCards.map((c) => ({
    ...c,
    codeHash: undefined,
    encryptedCode: undefined,
    qrTokenHash: undefined
  }));

  // Next tier progress
  const sortedTiers = [...tiers].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  const currTierIdx = sortedTiers.findIndex((t) => t.tierCode === loyalty.tierCode);
  const currentTierObj = sortedTiers[currTierIdx] || sortedTiers[0];
  const nextTierObj = currTierIdx >= 0 && currTierIdx < sortedTiers.length - 1 ? sortedTiers[currTierIdx + 1] : null;
  const spendToNextTierInr = nextTierObj
    ? Math.max(0, round2((Number(nextTierObj.minQualifyingSpendInr) || 0) - (Number(loyalty.qualifyingNetSpendInr) || 0)))
    : 0;

  return {
    config: cfg,
    wallet: {
      ...wallet,
      totalAvailableInr: computeTotalAvailableWalletInr(wallet),
      expiringWithin30DaysInr: expiringPromoCreditsInr
    },
    walletBuckets: buckets,
    walletTransactions: wltTxns,
    loyalty: {
      ...loyalty,
      currentTier: currentTierObj,
      nextTier: nextTierObj,
      spendToNextTierInr
    },
    tiers: sortedTiers,
    pointsLedger: ptsLedger,
    giftCards: safeGiftCards,
    giftCardTransactions: gcTxns,
    referrals: {
      referralCode: loyalty.referralCode,
      shareUrl: `https://fragmore.shop/?ref=${loyalty.referralCode}`,
      invitedConversions: referralsAsReferrer,
      referredByConversion: referralsAsReferee[0] || null
    },
    occasionGrants
  };
}

export async function getAdminRewardsWorkspaceSnapshot(actor: RewardsActor) {
  await ensureRewardsEcosystemSeeded();
  if (!actor.isAdminStaff) {
    throw new ForbiddenError('Forbidden (403): Admin staff role required.');
  }

  const cfg = await getRewardsMasterConfig();
  const [
    wallets,
    buckets,
    wltTxns,
    tiers,
    loyAccounts,
    ptsLedger,
    allGiftCards,
    gcTxns,
    corpBatches,
    referrals,
    occasions,
    reservations,
    approvals,
    fraudFlags,
    glJournals,
    proposals,
    quotations,
    allOrders
  ] = await Promise.all([
    db.select().from(customerWallets).orderBy(desc(customerWallets.updatedAt)),
    db.select().from(walletCreditBuckets).orderBy(desc(walletCreditBuckets.createdAt)),
    db.select().from(walletTransactions).orderBy(desc(walletTransactions.createdAt)).limit(250),
    db.select().from(loyaltyTiers).orderBy(asc(loyaltyTiers.sortOrder)),
    db.select().from(loyaltyAccounts).orderBy(desc(loyaltyAccounts.qualifyingNetSpendInr)),
    db.select().from(loyaltyPointsLedger).orderBy(desc(loyaltyPointsLedger.createdAt)).limit(250),
    db.select().from(giftCards).orderBy(desc(giftCards.createdAt)),
    db.select().from(giftCardTransactions).orderBy(desc(giftCardTransactions.createdAt)).limit(250),
    db.select().from(corporateGiftCardBatches).orderBy(desc(corporateGiftCardBatches.createdAt)),
    db.select().from(referralConversions).orderBy(desc(referralConversions.createdAt)),
    db.select().from(occasionRewardLogs).orderBy(desc(occasionRewardLogs.createdAt)),
    db.select().from(checkoutRewardReservations).orderBy(desc(checkoutRewardReservations.createdAt)).limit(150),
    db.select().from(rewardsAdjustmentApprovals).orderBy(desc(rewardsAdjustmentApprovals.createdAt)).limit(150),
    db.select().from(rewardsFraudFlags).orderBy(desc(rewardsFraudFlags.createdAt)).limit(150),
    db
      .select()
      .from(erpAccountingJournals)
      .where(
        inArray(erpAccountingJournals.sourceModule, [
          'GIFT_CARD_ISSUANCE',
          'GIFT_CARD_POS_REDEMPTION',
          'CORPORATE_GIFT_CARD_BATCH',
          'WALLET_REFUND_CREDIT',
          'LOYALTY_POINTS_ACCRUAL',
          'CHECKOUT_REWARDS_REDEMPTION',
          'ACCOUNTANT_APPROVED_BREAKAGE'
        ])
      )
      .orderBy(desc(erpAccountingJournals.createdAt))
      .limit(100),
    db.select().from(erpProposals).orderBy(desc(erpProposals.createdAt)).limit(50),
    db.select().from(erpQuotations).orderBy(desc(erpQuotations.createdAt)).limit(50),
    db.select().from(orders)
  ]);

  const now = new Date();
  const in30Days = new Date(Date.now() + 30 * 86400000);
  const LoyCfg = (cfg.loyaltyConfig as any) || DEFAULT_REWARDS_CONFIG.loyaltyConfig;
  const rupeePerPt = (Number(LoyCfg.redeemRupeePerUnitInr) || 10) / (Number(LoyCfg.redeemPointsUnit) || 100);

  // Compute all 13 Required Overview KPIs
  const totalWalletLiabilityInr = round2(
    wallets.reduce((s, w) => s + computeTotalAvailableWalletInr(w), 0)
  );
  const refundCreditLiabilityInr = round2(
    wallets.reduce((s, w) => s + (Number(w.availableRefundInr) || 0), 0)
  );
  const promotionalWalletLiabilityInr = round2(totalWalletLiabilityInr - refundCreditLiabilityInr);

  const totalOutstandingLoyaltyPoints = loyAccounts.reduce((s, a) => s + (Number(a.availablePoints) || 0), 0);
  const outstandingLoyaltyLiabilityInr = round2(totalOutstandingLoyaltyPoints * rupeePerPt);

  const paidGiftCards = allGiftCards.filter((g) => g.paymentStatus === 'PAID');
  const giftCardsSoldCount = paidGiftCards.length;
  const giftCardsSoldValueInr = round2(paidGiftCards.reduce((s, g) => s + (Number(g.initialValueInr) || 0), 0));
  const unredeemedGiftCardLiabilityInr = round2(
    paidGiftCards
      .filter((g) => g.status === 'ACTIVE' || g.status === 'SCHEDULED')
      .reduce((s, g) => s + (Number(g.remainingBalanceInr) || 0), 0)
  );
  const giftCardsRedeemedInr = round2(
    gcTxns
      .filter((t) => t.txnType === 'CHECKOUT_REDEMPTION' || t.txnType === 'EVENT_POS_REDEMPTION')
      .reduce((s, t) => s + (Number(t.amountInr) || 0), 0)
  );

  const totalEarnedPts = loyAccounts.reduce((s, a) => s + (Number(a.lifetimeEarnedPoints) || 0), 0);
  const totalRedeemedPts = loyAccounts.reduce((s, a) => s + (Number(a.lifetimeRedeemedPoints) || 0), 0);
  const redemptionRatePct = totalEarnedPts > 0 ? round2((totalRedeemedPts / totalEarnedPts) * 100) : 0;

  const referralConversionsCount = referrals.filter((r) => r.status === 'COMPLETED_REWARDED').length;

  const vipTierDistribution = tiers.map((t) => ({
    tierCode: t.tierCode,
    tierName: t.tierName,
    membersCount: loyAccounts.filter((a) => a.tierCode === t.tierCode).length
  }));

  const expiringRewards30dInr = round2(
    buckets
      .filter((b) => b.status === 'ACTIVE' && b.expiresAt && new Date(b.expiresAt) > now && new Date(b.expiresAt) <= in30Days)
      .reduce((s, b) => s + (Number(b.remainingAmountInr) || 0), 0) +
      paidGiftCards
        .filter((g) => g.status === 'ACTIVE' && new Date(g.expiresAt) > now && new Date(g.expiresAt) <= in30Days)
        .reduce((s, g) => s + (Number(g.remainingBalanceInr) || 0), 0)
  );

  // Repeat purchase rate & Reward-driven revenue
  const repeatCustomersCount = loyAccounts.filter((a) => (Number(a.qualifyingOrdersCount) || 0) >= 2).length;
  const activeOrderingCustomersCount = loyAccounts.filter((a) => (Number(a.qualifyingOrdersCount) || 0) >= 1).length;
  const repeatPurchaseRatePct =
    activeOrderingCustomersCount > 0 ? round2((repeatCustomersCount / activeOrderingCustomersCount) * 100) : 0;

  const capturedOrderIds = new Set(
    reservations.filter((r) => r.status === 'CAPTURED' && r.orderId).map((r) => r.orderId as string)
  );
  const rewardDrivenRevenueInr = round2(
    allOrders
      .filter(
        (o) =>
          (capturedOrderIds.has(o.id) || Boolean(o.couponCode)) &&
          String(o.orderStatus).toUpperCase() !== 'CANCELLED' &&
          String(o.paymentStatus).toUpperCase() !== 'FAILED'
      )
      .reduce((s, o) => s + (Number(o.totalAmount) || 0), 0)
  );

  const suspiciousAttemptsCount = fraudFlags.filter((f) => f.status === 'OPEN_REVIEW' || f.status === 'CONFIRMED_BLOCKED').length;

  const kpis = {
    totalWalletLiabilityInr,
    refundCreditLiabilityInr,
    promotionalWalletLiabilityInr,
    totalOutstandingLoyaltyPoints,
    outstandingLoyaltyLiabilityInr,
    giftCardsSoldCount,
    giftCardsSoldValueInr,
    giftCardsRedeemedInr,
    unredeemedGiftCardLiabilityInr,
    redemptionRatePct,
    repeatPurchaseRatePct,
    referralConversionsCount,
    vipTierDistribution,
    expiringRewards30dInr,
    rewardDrivenRevenueInr,
    suspiciousAttemptsCount
  };

  // Strict RBAC Data Redaction for Restricted Roles (MARKETING_AGENCY & INTERN_VIEWER)
  if (actor.role === 'MARKETING_AGENCY' || actor.role === 'INTERN_VIEWER') {
    return {
      actor,
      restrictedView: true,
      restrictionNotice: `Role ${actor.role} has aggregate campaign & tier KPI visibility only. Individual customer wallet balances, ledgers, PII, and gift card records are restricted.`,
      config: {
        ...cfg,
        accountingTaxConfig: undefined
      },
      kpis: {
        ...kpis,
        totalWalletLiabilityInr: 0,
        refundCreditLiabilityInr: 0,
        unredeemedGiftCardLiabilityInr: 0
      },
      wallets: [],
      walletBuckets: [],
      walletTransactions: [],
      tiers,
      loyaltyAccounts: [],
      pointsLedger: [],
      giftCards: [],
      giftCardTransactions: [],
      corporateBatches: [],
      referrals: referrals.map((r) => ({
        ...r,
        referrerEmail: maskEmailForRestrictedRole(r.referrerEmail),
        refereeEmail: maskEmailForRestrictedRole(r.refereeEmail),
        refereePhone: null
      })),
      occasionLogs: [],
      reservations: [],
      approvals: [],
      fraudFlags: [],
      glJournals: [],
      erpProposals: [],
      erpQuotations: []
    };
  }

  const isSupport = actor.role === 'CUSTOMER_SUPPORT';
  const safeGiftCards = allGiftCards.map((c) => ({
    ...c,
    codeHash: undefined,
    encryptedCode: undefined,
    qrTokenHash: undefined,
    recipientPhone: isSupport ? (c.recipientPhone ? `******${c.recipientPhone.slice(-4)}` : null) : c.recipientPhone
  }));

  return {
    actor,
    restrictedView: false,
    config: cfg,
    kpis,
    wallets: wallets.map((w) => ({
      ...w,
      totalAvailableInr: computeTotalAvailableWalletInr(w)
    })),
    walletBuckets: buckets,
    walletTransactions: wltTxns,
    tiers,
    loyaltyAccounts: loyAccounts,
    pointsLedger: ptsLedger,
    giftCards: safeGiftCards,
    giftCardTransactions: gcTxns,
    corporateBatches: corpBatches,
    referrals,
    occasionLogs: occasions,
    reservations,
    approvals,
    fraudFlags,
    glJournals,
    erpProposals: proposals,
    erpQuotations: quotations
  };
}

export async function updateRewardsConfigurationSection(params: {
  section:
    | 'walletConfig'
    | 'loyaltyConfig'
    | 'giftCardConfig'
    | 'referralConfig'
    | 'occasionConfig'
    | 'checkoutRulesConfig'
    | 'accountingTaxConfig';
  patch: Record<string, any>;
  actor: RewardsActor;
}) {
  const allowedRoles: RewardsAdminRole[] =
    params.section === 'accountingTaxConfig'
      ? ['SUPER_ADMIN', 'FINANCE_CONTROLLER']
      : params.section === 'occasionConfig' || params.section === 'referralConfig'
      ? ['SUPER_ADMIN', 'MARKETING_MANAGER']
      : ['SUPER_ADMIN'];

  assertRewardsStaffRoles(params.actor, allowedRoles, `Update ${params.section}`);

  const current = await getRewardsMasterConfig();
  const nextSection = {
    ...((current[params.section] as any) || {}),
    ...params.patch
  };

  const [updated] = await db
    .update(rewardsProgramConfig)
    .set({
      [params.section]: nextSection,
      updatedByEmail: params.actor.email,
      version: sql`${rewardsProgramConfig.version} + 1`,
      updatedAt: new Date()
    } as any)
    .where(eq(rewardsProgramConfig.id, REWARDS_CONFIG_ID))
    .returning();

  await recordErpAuditLog(db, {
    action: `REWARDS_CONFIG_UPDATED_${params.section.toUpperCase()}`,
    entity: 'rewards_program_config',
    entityId: REWARDS_CONFIG_ID,
    actorEmail: params.actor.email,
    actorRole: params.actor.role,
    details: `Updated ${params.section} settings.`
  });

  return updated;
}

export async function upsertLoyaltyTierAdmin(params: {
  tierCode: LoyaltyTierCode;
  tierName: string;
  tagline: string;
  minQualifyingSpendInr: number;
  minQualifyingOrders: number;
  pointsMultiplier: number;
  earnBonusPct: number;
  durationMonths: number;
  renewalSpendInr: number;
  maxRedemptionOrderPct: number;
  benefits?: any[];
  actor: RewardsActor;
}) {
  assertRewardsStaffRoles(params.actor, ['SUPER_ADMIN', 'MARKETING_MANAGER'], 'Configure Loyalty Tiers');

  const [existing] = await db
    .select()
    .from(loyaltyTiers)
    .where(eq(loyaltyTiers.tierCode, params.tierCode))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(loyaltyTiers)
      .set({
        tierName: params.tierName,
        tagline: params.tagline,
        minQualifyingSpendInr: round2(params.minQualifyingSpendInr),
        minQualifyingOrders: Math.trunc(params.minQualifyingOrders),
        pointsMultiplier: round2(params.pointsMultiplier),
        earnBonusPct: round2(params.earnBonusPct),
        durationMonths: Math.trunc(params.durationMonths),
        renewalSpendInr: round2(params.renewalSpendInr),
        maxRedemptionOrderPct: round2(params.maxRedemptionOrderPct),
        ...(params.benefits ? { benefits: params.benefits } : {}),
        updatedAt: new Date()
      })
      .where(eq(loyaltyTiers.id, existing.id))
      .returning();

    await recordErpAuditLog(db, {
      action: 'LOYALTY_TIER_UPDATED',
      entity: 'loyalty_tiers',
      entityId: existing.id,
      actorEmail: params.actor.email,
      actorRole: params.actor.role,
      details: `Updated tier ${params.tierCode} (min spend ₹${params.minQualifyingSpendInr}, multiplier ${params.pointsMultiplier}x)`
    });
    return updated;
  }

  throw new NotFoundError(`Tier ${params.tierCode} not found.`);
}

export async function resolveFraudFlagAdmin(params: {
  flagId: string;
  status: 'CLEARED_LEGITIMATE_HOUSEHOLD' | 'CONFIRMED_BLOCKED' | 'DISMISSED';
  resolutionNotes: string;
  actor: RewardsActor;
}) {
  assertRewardsStaffRoles(params.actor, ['SUPER_ADMIN', 'FINANCE_CONTROLLER'], 'Resolve Fraud & Risk Flag');
  if (!params.resolutionNotes?.trim()) {
    throw new ValidationError('Resolution notes are required when closing a fraud/risk flag.');
  }

  const [updated] = await db
    .update(rewardsFraudFlags)
    .set({
      status: params.status,
      reviewedByEmail: params.actor.email,
      resolutionNotes: params.resolutionNotes.trim(),
      reviewedAt: new Date()
    })
    .where(eq(rewardsFraudFlags.id, params.flagId))
    .returning();

  if (!updated) throw new NotFoundError('Fraud flag not found.');

  // If cleared legitimate household on a referral conversion, release hold!
  if (params.status === 'CLEARED_LEGITIMATE_HOUSEHOLD' && updated.relatedEntityType === 'REFERRAL_CONVERSION' && updated.relatedEntityId) {
    await db
      .update(referralConversions)
      .set({
        status: 'REGISTERED',
        reviewedByEmail: params.actor.email,
        reviewNotes: params.resolutionNotes.trim(),
        updatedAt: new Date()
      })
      .where(eq(referralConversions.id, updated.relatedEntityId));
  }

  await recordErpAuditLog(db, {
    action: 'REWARDS_FRAUD_FLAG_RESOLVED',
    entity: 'rewards_fraud_flags',
    entityId: updated.id,
    actorEmail: params.actor.email,
    actorRole: params.actor.role,
    details: `Marked ${updated.flagNumber} as ${params.status}: ${params.resolutionNotes}`
  });

  return updated;
}
