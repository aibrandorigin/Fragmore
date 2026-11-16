import crypto from 'crypto';
import { GoogleGenAI, Type, type FunctionDeclaration } from '@google/genai';
import { db } from '../db/index.ts';
import {
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
  campaigns,
  products,
  orders,
  erpOrganizations
} from '../db/schema.ts';
import { eq, desc, asc } from 'drizzle-orm';
import {
  ORG_ID,
  ForbiddenError,
  ValidationError,
  recordErpAuditLog
} from './erpBusinessOsEngine.ts';
import { sanitizeSpreadsheetString } from './erpReportingExportEngine.ts';
import {
  ensureRewardsEcosystemSeeded,
  getRewardsMasterConfig,
  getAdminRewardsWorkspaceSnapshot,
  assertCustomerOwnershipOrStaff,
  assertRewardsStaffRoles,
  createRewardsApprovalRequest,
  maskEmailForRestrictedRole,
  type RewardsActor,
  type WalletCreditType
} from './rewardsWalletGiftCardEngine.ts';

export type RewardsExportReportKey =
  | 'wallet_statement'
  | 'loyalty_ledger'
  | 'gift_card_issuance'
  | 'gift_card_redemption'
  | 'unredeemed_liability'
  | 'corporate_gift_cards'
  | 'referral_performance'
  | 'vip_tier_report'
  | 'campaign_reward_roi';

export const REWARDS_CAMPAIGN_TEMPLATES = [
  {
    triggerKey: 'WELCOME_LOYALTY',
    title: 'Welcome to FRAGMORÉ Privileges',
    eventHook: 'customer.registered',
    channel: 'EMAIL + WHATSAPP',
    defaultRewardLabel: 'Silver Atelier Entry + 5 pts / ₹100',
    subjectLine: 'Welcome to FRAGMORÉ Privileges — Your Private Olfactory Ledger',
    luxuryCopy:
      'Your personal FRAGMORÉ Privileges membership is now active. Every retained flacon and Discovery Set cultivates house points redeemable across future creations.'
  },
  {
    triggerKey: 'POINTS_EARNED_ORDER',
    title: 'Points Earned After Qualifying Order',
    eventHook: 'order.delivered',
    channel: 'EMAIL',
    defaultRewardLabel: 'Tier-Multiplied Points Credited',
    subjectLine: 'Your FRAGMORÉ Privileges Points Have Matured',
    luxuryCopy:
      'Thank you for welcoming a FRAGMORÉ creation into your collection. Your house privilege points from your recent consignment are now active in your account.'
  },
  {
    triggerKey: 'POINTS_EXPIRING_SOON',
    title: 'Points Expiring Within 30 Days',
    eventHook: 'loyalty.expiring_soon',
    channel: 'EMAIL + WHATSAPP',
    defaultRewardLabel: '12-Month Point Validity Gentle Notice',
    subjectLine: 'A Gentle Note from the Worli Atelier — Privilege Points Expiring Soon',
    luxuryCopy:
      'A portion of your FRAGMORÉ Privileges balance approaches its annual horizon. Apply your points effortlessly at checkout toward your next extrait or Discovery Set.'
  },
  {
    triggerKey: 'WALLET_CREDIT_ADDED',
    title: 'FRAGMORÉ Wallet Credit Added',
    eventHook: 'wallet.credited',
    channel: 'EMAIL + WHATSAPP',
    defaultRewardLabel: 'Closed-Loop Brand Credit Issued',
    subjectLine: 'A House Credit Awaits in Your FRAGMORÉ Wallet',
    luxuryCopy:
      'A private house credit has been recorded in your FRAGMORÉ Wallet and may be applied seamlessly during your next visit to fragmore.shop.'
  },
  {
    triggerKey: 'WALLET_CREDIT_EXPIRING',
    title: 'Promotional Wallet Credit Expiring Reminder',
    eventHook: 'wallet.expiring_soon',
    channel: 'EMAIL',
    defaultRewardLabel: '30-Day Promotional Credit Reminder',
    subjectLine: 'Your Promotional House Credit Remains Available',
    luxuryCopy:
      'Your complimentary FRAGMORÉ promotional store credit remains reserved for your next fragrance acquisition prior to its scheduled expiry.'
  },
  {
    triggerKey: 'GIFT_CARD_SENT_RECEIVED',
    title: 'Gift FRAGMORÉ — Digital Card Delivered',
    eventHook: 'gift_card.issued',
    channel: 'EMAIL + WHATSAPP',
    defaultRewardLabel: 'Personalized Digital Gift Card',
    subjectLine: 'A Personal Fragrance Gift from FRAGMORÉ Haute Parfumerie',
    luxuryCopy:
      'Someone special has presented you with a FRAGMORÉ Gift Card. Claim it to your private account or apply it directly toward any Signature or Aura creation.'
  },
  {
    triggerKey: 'GIFT_CARD_BALANCE_REMINDER',
    title: 'Gift Card Unredeemed Balance Reminder',
    eventHook: 'gift_card.balance_reminder',
    channel: 'EMAIL',
    defaultRewardLabel: 'Remaining Gift Card Balance',
    subjectLine: 'Your FRAGMORÉ Gift Card Carries Remaining Value',
    luxuryCopy:
      'Your FRAGMORÉ Gift Card still holds an available balance ready for partial or full redemption online or at our Perfume Bar experiences.'
  },
  {
    triggerKey: 'BIRTHDAY_REWARD',
    title: 'Annual Birthday Celebration Privilege',
    eventHook: 'occasion.birthday_reward',
    channel: 'EMAIL + WHATSAPP',
    defaultRewardLabel: '250 Bonus Points + ₹100 Celebration Credit',
    subjectLine: 'Celebrating Your Day — With Compliments of FRAGMORÉ',
    luxuryCopy:
      'Wishing you a year of unforgettable scent memories. A celebratory privilege credit and bonus house points have been placed in your FRAGMORÉ account.'
  },
  {
    triggerKey: 'ANNIVERSARY_REWARD',
    title: 'Anniversary & Milestone Celebration',
    eventHook: 'occasion.anniversary_reward',
    channel: 'EMAIL',
    defaultRewardLabel: '200 Bonus Points + ₹75 Celebration Credit',
    subjectLine: 'Honoring Your Milestone — A Note from FRAGMORÉ',
    luxuryCopy:
      'To mark your special occasion, our Atelier has placed an anniversary privilege in your FRAGMORÉ Wallet.'
  },
  {
    triggerKey: 'VIP_TIER_UPGRADE',
    title: 'VIP & Tier Elevation Announcement',
    eventHook: 'vip.tier_upgraded',
    channel: 'EMAIL + WHATSAPP',
    defaultRewardLabel: 'Gold / Platinum / Private Atelier Elevation',
    subjectLine: 'Elevated to a New Circle of FRAGMORÉ Privileges',
    luxuryCopy:
      'Your patronage has unlocked a higher tier of FRAGMORÉ Privileges, bringing accelerated point earning and priority access to ONCE limited editions.'
  },
  {
    triggerKey: 'REFERRAL_INVITE_UNLOCKED',
    title: 'Refer & Experience FRAGMORÉ — Reward Unlocked',
    eventHook: 'referral.reward_unlocked',
    channel: 'EMAIL + WHATSAPP',
    defaultRewardLabel: '₹75 Referrer / ₹50 Friend Store Credit',
    subjectLine: 'Your FRAGMORÉ Referral Privilege Is Ready',
    luxuryCopy:
      'Thank you for sharing the art of FRAGMORÉ. Following your guest’s completed inaugural order, your referral house credit is now available in your Wallet.'
  }
] as const;

function toPdfSafe(input: unknown): string {
  if (input === null || input === undefined) return '-';
  const str = typeof input === 'object' ? JSON.stringify(input) : String(input);
  return str
    .replace(/₹/g, 'INR ')
    .replace(/→/g, '->')
    .replace(/•/g, '*')
    .replace(/—/g, '-')
    .replace(/–/g, '-')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
}

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

interface BuiltStatementPayload {
  title: string;
  subtitle: string;
  docCode: string;
  summaryMetrics: Array<{ label: string; value: string }>;
  columns: Array<{ key: string; label: string; type: 'string' | 'currency' | 'number' | 'date'; width: number }>;
  rows: Record<string, any>[];
}

async function buildRewardsStatementData(params: {
  reportKey: RewardsExportReportKey;
  actor: RewardsActor;
  customerEmailFilter?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<BuiltStatementPayload> {
  await ensureRewardsEcosystemSeeded();
  const { reportKey, actor, customerEmailFilter } = params;

  // Customer self-service mode: strictly allowed ONLY for their own wallet_statement or loyalty_ledger!
  if (!actor.isAdminStaff) {
    if (reportKey !== 'wallet_statement' && reportKey !== 'loyalty_ledger') {
      throw new ForbiddenError('Forbidden (403): Administrative privileges required for enterprise reward reports.');
    }
    if (!customerEmailFilter) {
      throw new ValidationError('Customer email is required for personal statement export.');
    }
    await assertCustomerOwnershipOrStaff(actor, customerEmailFilter);
  } else {
    // Staff RBAC check
    if (actor.role === 'INTERN_VIEWER') {
      throw new ForbiddenError('Forbidden (403): Intern role cannot export financial, wallet, or customer reward statements.');
    }
    if (actor.role === 'MARKETING_AGENCY' && reportKey !== 'campaign_reward_roi') {
      throw new ForbiddenError(
        'Forbidden (403): Marketing Agency role can only export aggregate Campaign Reward ROI summaries.'
      );
    }
  }

  const docSuffix = Date.now().toString().slice(-6);
  const inDateWindow = (d: Date | string | null | undefined) => {
    if (!d) return true;
    const iso = new Date(d).toISOString().slice(0, 10);
    if (params.dateFrom && iso < params.dateFrom) return false;
    if (params.dateTo && iso > params.dateTo) return false;
    return true;
  };

  if (reportKey === 'wallet_statement') {
    const allTx = await db.select().from(walletTransactions).orderBy(desc(walletTransactions.createdAt));
    const filtered = allTx.filter(
      (t) =>
        (!customerEmailFilter || t.customerEmail.toLowerCase() === customerEmailFilter.trim().toLowerCase()) &&
        inDateWindow(t.createdAt)
    );
    const totalCredited = round2(filtered.filter((t) => t.direction === 'CREDIT').reduce((s, t) => s + t.amountInr, 0));
    const totalDebited = round2(filtered.filter((t) => t.direction === 'DEBIT').reduce((s, t) => s + t.amountInr, 0));

    return {
      title: customerEmailFilter ? `FRAGMORE Customer Wallet Statement (${customerEmailFilter})` : 'FRAGMORE Wallet Ledger Statement',
      subtitle: 'Closed-Loop Brand Store Credit Movements, Reference IDs & Running Balances',
      docCode: `WLT-STMT-${docSuffix}`,
      summaryMetrics: [
        { label: 'Transactions', value: String(filtered.length) },
        { label: 'Total Credits (INR)', value: `INR ${totalCredited.toLocaleString('en-IN')}` },
        { label: 'Total Redemptions/Debits (INR)', value: `INR ${totalDebited.toLocaleString('en-IN')}` }
      ],
      columns: [
        { key: 'referenceNumber', label: 'Reference No', type: 'string', width: 20 },
        { key: 'date', label: 'Date', type: 'date', width: 14 },
        { key: 'customerEmail', label: 'Customer Email', type: 'string', width: 26 },
        { key: 'creditType', label: 'Credit Bucket', type: 'string', width: 20 },
        { key: 'txnType', label: 'Transaction Type', type: 'string', width: 20 },
        { key: 'direction', label: 'Dr/Cr', type: 'string', width: 10 },
        { key: 'amountInr', label: 'Amount (INR)', type: 'currency', width: 16 },
        { key: 'balanceAfterInr', label: 'Closing Balance (INR)', type: 'currency', width: 18 },
        { key: 'reason', label: 'Audit Reason / Order Ref', type: 'string', width: 32 }
      ],
      rows: filtered.map((t) => ({
        referenceNumber: t.referenceNumber,
        date: new Date(t.createdAt).toISOString().slice(0, 10),
        customerEmail: actor.role === 'CUSTOMER_SUPPORT' ? maskEmailForRestrictedRole(t.customerEmail) : t.customerEmail,
        creditType: t.creditType,
        txnType: t.txnType,
        direction: t.direction,
        amountInr: round2(t.amountInr),
        balanceAfterInr: round2(t.availableBalanceAfterInr),
        reason: t.reason
      }))
    };
  }

  if (reportKey === 'loyalty_ledger') {
    const ledger = await db.select().from(loyaltyPointsLedger).orderBy(desc(loyaltyPointsLedger.createdAt));
    const filtered = ledger.filter(
      (l) =>
        (!customerEmailFilter || l.customerEmail.toLowerCase() === customerEmailFilter.trim().toLowerCase()) &&
        inDateWindow(l.createdAt)
    );
    const totalEarned = filtered.filter((l) => l.pointsDelta > 0).reduce((s, l) => s + l.pointsDelta, 0);
    const totalUsed = Math.abs(filtered.filter((l) => l.pointsDelta < 0).reduce((s, l) => s + l.pointsDelta, 0));

    return {
      title: 'FRAGMORE Privileges — Loyalty Points Ledger',
      subtitle: 'Immutable Earning, Maturation, Redemption & Return Reversal Statement',
      docCode: `LOY-LDG-${docSuffix}`,
      summaryMetrics: [
        { label: 'Ledger Entries', value: String(filtered.length) },
        { label: 'Points Credited', value: `${totalEarned} pts` },
        { label: 'Points Redeemed/Reversed', value: `${totalUsed} pts` }
      ],
      columns: [
        { key: 'referenceNumber', label: 'Ref Number', type: 'string', width: 20 },
        { key: 'date', label: 'Date', type: 'date', width: 14 },
        { key: 'customerEmail', label: 'Member Email', type: 'string', width: 26 },
        { key: 'entryType', label: 'Entry Type', type: 'string', width: 20 },
        { key: 'pointsDelta', label: 'Points Delta', type: 'number', width: 14 },
        { key: 'availablePointsAfter', label: 'Available After', type: 'number', width: 16 },
        { key: 'rupeeEquivalentInr', label: 'INR Equivalent', type: 'currency', width: 16 },
        { key: 'orderNumber', label: 'Order No', type: 'string', width: 18 },
        { key: 'reason', label: 'Details', type: 'string', width: 32 }
      ],
      rows: filtered.map((l) => ({
        referenceNumber: l.referenceNumber,
        date: new Date(l.createdAt).toISOString().slice(0, 10),
        customerEmail: l.customerEmail,
        entryType: l.entryType,
        pointsDelta: l.pointsDelta,
        availablePointsAfter: l.availablePointsAfter,
        rupeeEquivalentInr: round2(l.rupeeEquivalentInr),
        orderNumber: l.orderNumber || '-',
        reason: l.reason
      }))
    };
  }

  if (reportKey === 'gift_card_issuance') {
    const cards = (await db.select().from(giftCards).orderBy(desc(giftCards.createdAt))).filter((c) =>
      inDateWindow(c.createdAt)
    );
    const paidTotal = round2(cards.filter((c) => c.paymentStatus === 'PAID').reduce((s, c) => s + c.initialValueInr, 0));

    return {
      title: 'Gift FRAGMORE — Gift Card Issuance Register',
      subtitle: 'Digital, Physical & Corporate Gift Cards (Secret Codes Masked for Security)',
      docCode: `GC-ISS-${docSuffix}`,
      summaryMetrics: [
        { label: 'Total Cards', value: String(cards.length) },
        { label: 'Activated Paid Value (INR)', value: `INR ${paidTotal.toLocaleString('en-IN')}` },
        { label: 'Deferred Liability Account', value: 'GL 2310' }
      ],
      columns: [
        { key: 'cardNumber', label: 'Card ID', type: 'string', width: 20 },
        { key: 'maskedCode', label: 'Masked Secret', type: 'string', width: 22 },
        { key: 'cardFormat', label: 'Format', type: 'string', width: 16 },
        { key: 'occasion', label: 'Occasion', type: 'string', width: 16 },
        { key: 'purchaserEmail', label: 'Purchaser', type: 'string', width: 24 },
        { key: 'recipientName', label: 'Recipient', type: 'string', width: 22 },
        { key: 'initialValueInr', label: 'Initial Value (INR)', type: 'currency', width: 18 },
        { key: 'remainingBalanceInr', label: 'Remaining (INR)', type: 'currency', width: 18 },
        { key: 'paymentStatus', label: 'Payment', type: 'string', width: 16 },
        { key: 'status', label: 'Card Status', type: 'string', width: 16 }
      ],
      rows: cards.map((c) => ({
        cardNumber: c.cardNumber,
        maskedCode: c.maskedCode, // NEVER export raw secret codes!
        cardFormat: c.cardFormat,
        occasion: c.occasion,
        purchaserEmail: c.purchaserEmail,
        recipientName: c.recipientName,
        initialValueInr: round2(c.initialValueInr),
        remainingBalanceInr: round2(c.remainingBalanceInr),
        paymentStatus: c.paymentStatus,
        status: c.status
      }))
    };
  }

  if (reportKey === 'gift_card_redemption') {
    const txns = (await db.select().from(giftCardTransactions).orderBy(desc(giftCardTransactions.createdAt))).filter(
      (t) =>
        (t.txnType === 'CHECKOUT_REDEMPTION' || t.txnType === 'EVENT_POS_REDEMPTION') && inDateWindow(t.createdAt)
    );
    const totalRedeemed = round2(txns.reduce((s, t) => s + t.amountInr, 0));

    return {
      title: 'Gift FRAGMORE — Gift Card Redemption Statement',
      subtitle: 'Online Storefront Checkout & Perfume Bar Event POS Redemptions',
      docCode: `GC-RED-${docSuffix}`,
      summaryMetrics: [
        { label: 'Redemption Count', value: String(txns.length) },
        { label: 'Total Redeemed (INR)', value: `INR ${totalRedeemed.toLocaleString('en-IN')}` }
      ],
      columns: [
        { key: 'referenceNumber', label: 'Txn Ref', type: 'string', width: 20 },
        { key: 'date', label: 'Date', type: 'date', width: 14 },
        { key: 'cardNumber', label: 'Card Number', type: 'string', width: 20 },
        { key: 'channel', label: 'Channel', type: 'string', width: 22 },
        { key: 'amountInr', label: 'Redeemed (INR)', type: 'currency', width: 18 },
        { key: 'balanceAfterInr', label: 'Remaining (INR)', type: 'currency', width: 18 },
        { key: 'orderNumber', label: 'Order / POS Ref', type: 'string', width: 20 },
        { key: 'redeemedByEmail', label: 'Customer / Staff', type: 'string', width: 26 }
      ],
      rows: txns.map((t) => ({
        referenceNumber: t.referenceNumber,
        date: new Date(t.createdAt).toISOString().slice(0, 10),
        cardNumber: t.cardNumber,
        channel: t.channel,
        amountInr: round2(t.amountInr),
        balanceAfterInr: round2(t.balanceAfterInr),
        orderNumber: t.orderNumber || t.posEventLocation || '-',
        redeemedByEmail: t.redeemedByEmail || t.verifiedByStaffEmail || '-'
      }))
    };
  }

  if (reportKey === 'unredeemed_liability') {
    assertRewardsStaffRoles(actor, ['SUPER_ADMIN', 'FINANCE_CONTROLLER'], 'Unredeemed Liability Accounting Statement');
    const snap = await getAdminRewardsWorkspaceSnapshot(actor);
    const rows = [
      {
        glCode: '2310',
        instrument: 'Unredeemed Paid Gift Cards (Digital, Physical & Corporate)',
        accountingTreatment: 'Deferred Liability — Recognized as revenue only upon product redemption',
        outstandingInr: snap.kpis.unredeemedGiftCardLiabilityInr
      },
      {
        glCode: '2320',
        instrument: 'Customer Opt-In Refund Store Credits',
        accountingTreatment: 'Customer Refund Liability — Post-tax tender obligation',
        outstandingInr: snap.kpis.refundCreditLiabilityInr
      },
      {
        glCode: '2330',
        instrument: `FRAGMORE Privileges Outstanding Points (${snap.kpis.totalOutstandingLoyaltyPoints} pts)`,
        accountingTreatment: 'Loyalty Points Reserve — Pre-tax trade discount reserve',
        outstandingInr: snap.kpis.outstandingLoyaltyLiabilityInr
      },
      {
        glCode: '5410-MEMO',
        instrument: 'Active Promotional, Referral, Cashback & Goodwill Wallet Credits',
        accountingTreatment: 'Promotional Marketing Commitment (Non-cash brand allowance)',
        outstandingInr: snap.kpis.promotionalWalletLiabilityInr
      }
    ];
    const grandLiability = round2(rows.reduce((s, r) => s + r.outstandingInr, 0));

    return {
      title: 'Unredeemed Gift Card, Wallet & Loyalty Liability Statement',
      subtitle: 'Accountant-Ready Deferred Liability & Promotional Commitment Schedule',
      docCode: `FIN-LIAB-${docSuffix}`,
      summaryMetrics: [
        { label: 'Gift Card Liability (2310)', value: `INR ${snap.kpis.unredeemedGiftCardLiabilityInr.toLocaleString('en-IN')}` },
        { label: 'Refund Credit Liability (2320)', value: `INR ${snap.kpis.refundCreditLiabilityInr.toLocaleString('en-IN')}` },
        { label: 'Combined Outstanding (INR)', value: `INR ${grandLiability.toLocaleString('en-IN')}` }
      ],
      columns: [
        { key: 'glCode', label: 'GL Account', type: 'string', width: 16 },
        { key: 'instrument', label: 'Liability / Reserve Category', type: 'string', width: 40 },
        { key: 'accountingTreatment', label: 'Statutory Accounting Policy', type: 'string', width: 44 },
        { key: 'outstandingInr', label: 'Outstanding Balance (INR)', type: 'currency', width: 22 }
      ],
      rows
    };
  }

  if (reportKey === 'corporate_gift_cards') {
    const batches = await db.select().from(corporateGiftCardBatches).orderBy(desc(corporateGiftCardBatches.createdAt));
    const totalGross = round2(batches.reduce((s, b) => s + b.grossFaceValueInr, 0));

    return {
      title: 'Corporate & Event Bulk Gift Card Batches Report',
      subtitle: 'B2B Gifting Proposals, Payment Approvals, Issuance & Redemption Tracking',
      docCode: `CORP-GC-${docSuffix}`,
      summaryMetrics: [
        { label: 'Corporate Batches', value: String(batches.length) },
        { label: 'Gross Face Value (INR)', value: `INR ${totalGross.toLocaleString('en-IN')}` }
      ],
      columns: [
        { key: 'batchNumber', label: 'Batch No', type: 'string', width: 18 },
        { key: 'companyName', label: 'Corporate Client', type: 'string', width: 28 },
        { key: 'category', label: 'Category', type: 'string', width: 22 },
        { key: 'quantity', label: 'Qty', type: 'number', width: 10 },
        { key: 'denominationInr', label: 'Denomination (INR)', type: 'currency', width: 18 },
        { key: 'grossFaceValueInr', label: 'Gross Value (INR)', type: 'currency', width: 18 },
        { key: 'netPayableInr', label: 'Net Billed (INR)', type: 'currency', width: 18 },
        { key: 'paymentStatus', label: 'Payment Status', type: 'string', width: 20 },
        { key: 'issuedCardsCount', label: 'Issued', type: 'number', width: 12 },
        { key: 'redeemedValueInr', label: 'Redeemed (INR)', type: 'currency', width: 18 }
      ],
      rows: batches.map((b) => ({
        batchNumber: b.batchNumber,
        companyName: b.companyName,
        category: b.category,
        quantity: b.quantity,
        denominationInr: round2(b.denominationInr),
        grossFaceValueInr: round2(b.grossFaceValueInr),
        netPayableInr: round2(b.netPayableInr),
        paymentStatus: b.paymentStatus,
        issuedCardsCount: b.issuedCardsCount,
        redeemedValueInr: round2(b.redeemedValueInr)
      }))
    };
  }

  if (reportKey === 'referral_performance') {
    const refs = await db.select().from(referralConversions).orderBy(desc(referralConversions.createdAt));
    const completed = refs.filter((r) => r.status === 'COMPLETED_REWARDED');
    const revGenerated = round2(completed.reduce((s, r) => s + r.qualifyingOrderNetInr, 0));

    return {
      title: 'Refer & Experience FRAGMORE — Referral Performance Report',
      subtitle: 'Referrer-to-Referee Attribution, Return-Window Holds & Anti-Abuse Status',
      docCode: `REF-PERF-${docSuffix}`,
      summaryMetrics: [
        { label: 'Total Referrals', value: String(refs.length) },
        { label: 'Completed & Rewarded', value: String(completed.length) },
        { label: 'Qualifying Net Order Value', value: `INR ${revGenerated.toLocaleString('en-IN')}` }
      ],
      columns: [
        { key: 'conversionNumber', label: 'Ref ID', type: 'string', width: 18 },
        { key: 'referralCode', label: 'Code', type: 'string', width: 18 },
        { key: 'referrerEmail', label: 'Referrer', type: 'string', width: 24 },
        { key: 'refereeEmail', label: 'Invited Friend', type: 'string', width: 24 },
        { key: 'qualifyingOrderNetInr', label: 'Order Value (INR)', type: 'currency', width: 18 },
        { key: 'referrerCreditInr', label: 'Referrer Credit (INR)', type: 'currency', width: 18 },
        { key: 'status', label: 'Conversion Status', type: 'string', width: 24 },
        { key: 'riskScore', label: 'Risk Score', type: 'number', width: 12 }
      ],
      rows: refs.map((r) => ({
        conversionNumber: r.conversionNumber,
        referralCode: r.referralCode,
        referrerEmail: r.referrerEmail,
        refereeEmail: r.refereeEmail,
        qualifyingOrderNetInr: round2(r.qualifyingOrderNetInr),
        referrerCreditInr: round2(r.referrerCreditInr),
        status: r.status,
        riskScore: r.riskScore
      }))
    };
  }

  if (reportKey === 'vip_tier_report') {
    const accounts = await db.select().from(loyaltyAccounts).orderBy(desc(loyaltyAccounts.qualifyingNetSpendInr));
    return {
      title: 'FRAGMORE Privileges — VIP & Tier Membership Report',
      subtitle: 'Silver, Gold, Platinum (VIP) & Private Atelier Patron Standing',
      docCode: `VIP-TIER-${docSuffix}`,
      summaryMetrics: [
        { label: 'Total Enrolled Members', value: String(accounts.length) },
        {
          label: 'Platinum & Private Atelier',
          value: String(accounts.filter((a) => a.tierCode === 'PLATINUM' || a.tierCode === 'PRIVATE_ATELIER').length)
        }
      ],
      columns: [
        { key: 'memberNumber', label: 'Member ID', type: 'string', width: 18 },
        { key: 'customerName', label: 'Member Name', type: 'string', width: 22 },
        { key: 'customerEmail', label: 'Email', type: 'string', width: 26 },
        { key: 'tierCode', label: 'Active Tier', type: 'string', width: 18 },
        { key: 'qualifyingNetSpendInr', label: 'Qualifying Net Spend (INR)', type: 'currency', width: 22 },
        { key: 'qualifyingOrdersCount', label: 'Retained Orders', type: 'number', width: 16 },
        { key: 'availablePoints', label: 'Available Points', type: 'number', width: 16 },
        { key: 'lifetimeEarnedPoints', label: 'Lifetime Earned', type: 'number', width: 16 }
      ],
      rows: accounts.map((a) => ({
        memberNumber: a.memberNumber,
        customerName: a.customerName || '-',
        customerEmail: a.customerEmail,
        tierCode: a.tierCode,
        qualifyingNetSpendInr: round2(a.qualifyingNetSpendInr),
        qualifyingOrdersCount: a.qualifyingOrdersCount,
        availablePoints: a.availablePoints,
        lifetimeEarnedPoints: a.lifetimeEarnedPoints
      }))
    };
  }

  // Default: campaign_reward_roi
  const [allCamps, reservations, occLogs] = await Promise.all([
    db.select().from(campaigns).orderBy(desc(campaigns.createdAt)),
    db.select().from(checkoutRewardReservations),
    db.select().from(occasionRewardLogs)
  ]);

  const rows = REWARDS_CAMPAIGN_TEMPLATES.map((tpl) => {
    const matchedCamp = allCamps.find((c) => c.name.toLowerCase().includes(tpl.triggerKey.toLowerCase().replace(/_/g, ' ')));
    const occCount =
      tpl.triggerKey === 'BIRTHDAY_REWARD'
        ? occLogs.filter((o) => o.occasionType === 'BIRTHDAY').length
        : tpl.triggerKey === 'ANNIVERSARY_REWARD'
        ? occLogs.filter((o) => o.occasionType === 'ANNIVERSARY').length
        : reservations.filter((r) => r.status === 'CAPTURED').length;
    const revInr = matchedCamp
      ? Number(matchedCamp.revenue) || 0
      : round2(reservations.filter((r) => r.status === 'CAPTURED').reduce((s, r) => s + r.finalPayableInr, 0));
    return {
      triggerKey: tpl.triggerKey,
      campaignTitle: tpl.title,
      channel: tpl.channel,
      rewardStructure: tpl.defaultRewardLabel,
      engagementsCount: occCount,
      attributedRevenueInr: revInr
    };
  });

  return {
    title: 'FRAGMORE Rewards & Retention Campaign ROI Summary',
    subtitle: 'Luxury Non-Discount Lifecycle Flows, Occasion Privileges & Attributed Revenue',
    docCode: `CMP-ROI-${docSuffix}`,
    summaryMetrics: [
      { label: 'Active Lifecycle Flows', value: String(rows.length) },
      { label: 'Brand Philosophy', value: 'Luxury Value-Add (No Habitual Discounting)' }
    ],
    columns: [
      { key: 'triggerKey', label: 'Trigger Key', type: 'string', width: 24 },
      { key: 'campaignTitle', label: 'Lifecycle Journey', type: 'string', width: 32 },
      { key: 'channel', label: 'Channels', type: 'string', width: 18 },
      { key: 'rewardStructure', label: 'Privilege / Offer', type: 'string', width: 28 },
      { key: 'engagementsCount', label: 'Conversions / Grants', type: 'number', width: 18 },
      { key: 'attributedRevenueInr', label: 'Attributed Revenue (INR)', type: 'currency', width: 22 }
    ],
    rows
  };
}

export async function generateRewardsExcelBuffer(params: {
  reportKey: RewardsExportReportKey;
  actor: RewardsActor;
  customerEmailFilter?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<{ buffer: Buffer; fileName: string }> {
  const payload = await buildRewardsStatementData(params);
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'FRAGMORÉ Haute Parfumerie Business OS';
  workbook.created = new Date();

  // Sheet 1: Executive Summary
  const summarySheet = workbook.addWorksheet('Executive Summary');
  summarySheet.columns = [
    { header: 'Field', key: 'field', width: 34 },
    { header: 'Value', key: 'value', width: 48 }
  ];
  summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFAF8F4' } };
  summarySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF24211D' } };

  summarySheet.addRow({ field: 'Legal Entity', value: 'FRAGMORE HAUTE PARFUMERIE PRIVATE LIMITED' });
  summarySheet.addRow({ field: 'GSTIN', value: '27AABCF9482M1Z8 (Maharashtra - 27)' });
  summarySheet.addRow({ field: 'Statement Title', value: sanitizeSpreadsheetString(payload.title) });
  summarySheet.addRow({ field: 'Document Number', value: payload.docCode });
  summarySheet.addRow({ field: 'Generated At (UTC)', value: new Date().toISOString() });
  summarySheet.addRow({ field: 'Generated By', value: `${params.actor.email} (${params.actor.role})` });
  for (const m of payload.summaryMetrics) {
    summarySheet.addRow({ field: m.label, value: sanitizeSpreadsheetString(m.value) });
  }

  // Sheet 2: Detailed Ledger
  const detailSheet = workbook.addWorksheet('Statement Ledger', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  detailSheet.columns = payload.columns.map((c) => ({
    header: c.label,
    key: c.key,
    width: c.width
  }));

  const headerRow = detailSheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFAF8F4' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF24211D' } };

  for (const r of payload.rows) {
    const cleanRow: Record<string, any> = {};
    for (const col of payload.columns) {
      const val = r[col.key];
      if (col.type === 'currency' || col.type === 'number') {
        cleanRow[col.key] = Number(val) || 0;
      } else {
        cleanRow[col.key] = sanitizeSpreadsheetString(val);
      }
    }
    const added = detailSheet.addRow(cleanRow);
    payload.columns.forEach((col, idx) => {
      if (col.type === 'currency') {
        added.getCell(idx + 1).numFmt = '"INR "#,##0.00';
      } else if (col.type === 'number') {
        added.getCell(idx + 1).numFmt = '#,##0';
      }
    });
  }

  // Formula row if rows exist
  if (payload.rows.length > 0) {
    const totalRowValues: Record<string, any> = {};
    const lastDataRow = payload.rows.length + 1;
    payload.columns.forEach((col, idx) => {
      const colLetter = String.fromCharCode(65 + idx);
      if (idx === 0) {
        totalRowValues[col.key] = 'TOTAL';
      } else if (col.type === 'currency' || col.type === 'number') {
        totalRowValues[col.key] = { formula: `SUM(${colLetter}2:${colLetter}${lastDataRow})` };
      } else {
        totalRowValues[col.key] = '';
      }
    });
    const totRow = detailSheet.addRow(totalRowValues);
    totRow.font = { bold: true };
  }

  const rawBuf = await workbook.xlsx.writeBuffer();
  await recordErpAuditLog(db, {
    action: 'REWARDS_EXCEL_EXPORTED',
    entity: 'rewards_exports',
    entityId: payload.docCode,
    actorEmail: params.actor.email,
    actorRole: params.actor.role,
    details: `Exported ${params.reportKey} (.xlsx, ${payload.rows.length} rows)`
  });

  return {
    buffer: Buffer.from(rawBuf),
    fileName: `FRAGMORE_${params.reportKey.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.xlsx`
  };
}

export async function generateRewardsPdfBuffer(params: {
  reportKey: RewardsExportReportKey;
  actor: RewardsActor;
  customerEmailFilter?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<{ buffer: Buffer; fileName: string }> {
  const payload = await buildRewardsStatementData(params);
  const [org] = await db.select().from(erpOrganizations).where(eq(erpOrganizations.id, ORG_ID)).limit(1);
  const { default: PDFDocument } = await import('pdfkit');

  const pdfBuf = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Branded Header Banner
    doc.rect(36, 32, doc.page.width - 72, 62).fill('#24211D');
    doc.fillColor('#D4AF37').font('Helvetica-Bold').fontSize(15).text('FRAGMORE HAUTE PARFUMERIE', 50, 44);
    doc
      .fillColor('#FAF8F4')
      .font('Helvetica')
      .fontSize(8.5)
      .text(
        toPdfSafe(
          `${org?.legalName || 'FRAGMORE HAUTE PARFUMERIE PRIVATE LIMITED'} | GSTIN: ${org?.gstin || '27AABCF9482M1Z8'}`
        ),
        50,
        64
      );
    doc
      .fillColor('#DED7CC')
      .fontSize(8)
      .text(`Doc: ${payload.docCode} | Date: ${new Date().toISOString().slice(0, 10)}`, doc.page.width - 250, 46, {
        width: 200,
        align: 'right'
      });
    doc
      .text(`Prepared For: ${toPdfSafe(params.actor.email)}`, doc.page.width - 250, 62, {
        width: 200,
        align: 'right'
      });

    // Title & Summary Strip
    doc.fillColor('#24211D').font('Helvetica-Bold').fontSize(13).text(toPdfSafe(payload.title), 36, 108);
    doc.fillColor('#686158').font('Helvetica').fontSize(9).text(toPdfSafe(payload.subtitle), 36, 124);

    let metricX = 36;
    for (const m of payload.summaryMetrics) {
      doc.rect(metricX, 140, 220, 34).fillAndStroke('#FAF8F4', '#DED7CC');
      doc.fillColor('#686158').font('Helvetica').fontSize(7.5).text(toPdfSafe(m.label.toUpperCase()), metricX + 10, 146);
      doc.fillColor('#24211D').font('Helvetica-Bold').fontSize(10).text(toPdfSafe(m.value), metricX + 10, 158);
      metricX += 230;
    }

    // Table Header
    const tableLeft = 36;
    const tableWidth = doc.page.width - 72;
    const colCount = Math.min(payload.columns.length, 8);
    const activeCols = payload.columns.slice(0, colCount);
    const totalRelW = activeCols.reduce((s, c) => s + c.width, 0);
    const colWidths = activeCols.map((c) => Math.floor((c.width / totalRelW) * tableWidth));

    let y = 186;
    const drawTableHeader = (topY: number) => {
      doc.rect(tableLeft, topY, tableWidth, 20).fill('#24211D');
      let cx = tableLeft;
      activeCols.forEach((col, i) => {
        doc
          .fillColor('#FAF8F4')
          .font('Helvetica-Bold')
          .fontSize(7.5)
          .text(toPdfSafe(col.label), cx + 4, topY + 6, { width: colWidths[i] - 8, lineBreak: false });
        cx += colWidths[i];
      });
      return topY + 20;
    };

    y = drawTableHeader(y);

    if (payload.rows.length === 0) {
      doc
        .fillColor('#686158')
        .font('Helvetica')
        .fontSize(9)
        .text('No ledger transactions matched the selected filter range.', tableLeft + 8, y + 12);
    } else {
      payload.rows.forEach((row, rIdx) => {
        if (y > doc.page.height - 68) {
          doc.addPage({ size: 'A4', layout: 'landscape', margin: 36 });
          y = drawTableHeader(40);
        }
        const rowBg = rIdx % 2 === 0 ? '#FFFFFF' : '#FAF8F4';
        doc.rect(tableLeft, y, tableWidth, 18).fillAndStroke(rowBg, '#EAE4DA');
        let cx = tableLeft;
        activeCols.forEach((col, cIdx) => {
          const rawVal = row[col.key];
          const formatted =
            col.type === 'currency'
              ? `INR ${Number(rawVal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : toPdfSafe(rawVal);
          doc
            .fillColor('#24211D')
            .font('Helvetica')
            .fontSize(7.5)
            .text(formatted, cx + 4, y + 5, { width: colWidths[cIdx] - 8, lineBreak: false });
          cx += colWidths[cIdx];
        });
        y += 18;
      });
    }

    // Legal & Page Number Footer
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc
        .fillColor('#686158')
        .font('Helvetica')
        .fontSize(7.5)
        .text(
          'FRAGMORE Closed-Loop Wallet & Gift Card Statement | Secret redemption codes masked per security policy | Non-withdrawable to bank/cash.',
          36,
          doc.page.height - 30,
          { width: doc.page.width - 200, lineBreak: false }
        );
      doc.text(`Page ${i + 1} of ${range.count}`, doc.page.width - 140, doc.page.height - 30, {
        width: 104,
        align: 'right',
        lineBreak: false
      });
    }

    doc.end();
  });

  await recordErpAuditLog(db, {
    action: 'REWARDS_PDF_EXPORTED',
    entity: 'rewards_exports',
    entityId: payload.docCode,
    actorEmail: params.actor.email,
    actorRole: params.actor.role,
    details: `Exported ${params.reportKey} (.pdf, ${payload.rows.length} rows)`
  });

  return {
    buffer: pdfBuf,
    fileName: `FRAGMORE_${params.reportKey.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.pdf`
  };
}

// ============================================================================
// MODULE 11: AI REWARDS & GIFTING CONCIERGE ASSISTANT (GEMINI + APPROVAL GATE)
// ============================================================================

export async function runAiRewardsAssistant(params: {
  prompt: string;
  actor: RewardsActor;
  customerEmailContext?: string;
}) {
  await ensureRewardsEcosystemSeeded();
  const promptText = String(params.prompt || '').trim();
  if (!promptText) throw new ValidationError('Prompt is required.');

  const cfg = await getRewardsMasterConfig();
  const activeProducts = (await db.select().from(products)).filter((p) => p.status === 'ACTIVE');

  let contextSummary: Record<string, any> = {
    programConfig: {
      loyalty: cfg.loyaltyConfig,
      giftCards: {
        denominations: (cfg.giftCardConfig as any)?.presetDenominationsInr,
        occasions: (cfg.giftCardConfig as any)?.occasions
      },
      referral: cfg.referralConfig
    },
    fragranceCatalogSample: activeProducts.slice(0, 8).map((p) => ({
      name: p.name,
      collection: p.collection,
      scentProfile: p.scentProfile,
      families: p.families
    }))
  };

  if (params.actor.isAdminStaff) {
    const adminSnap = await getAdminRewardsWorkspaceSnapshot(params.actor);
    contextSummary = {
      ...contextSummary,
      mode: 'ADMIN_REWARDS_STRATEGIST',
      actorRole: params.actor.role,
      kpis: adminSnap.kpis,
      availableCampaignTriggers: REWARDS_CAMPAIGN_TEMPLATES.map((t) => t.triggerKey)
    };
  } else if (params.actor.email) {
    const [wlt] = await db
      .select()
      .from(customerWallets)
      .where(eq(customerWallets.customerEmail, params.actor.email))
      .limit(1);
    const [loy] = await db
      .select()
      .from(loyaltyAccounts)
      .where(eq(loyaltyAccounts.customerEmail, params.actor.email))
      .limit(1);
    contextSummary = {
      ...contextSummary,
      mode: 'CUSTOMER_CONCIERGE',
      customerLoyalty: loy
        ? {
            tierCode: loy.tierCode,
            availablePoints: loy.availablePoints,
            pendingPoints: loy.pendingPoints,
            referralCode: loy.referralCode
          }
        : null,
      customerWalletAvailableInr: wlt
        ? round2(
            (wlt.availableRefundInr || 0) +
              (wlt.availablePromoInr || 0) +
              (wlt.availableCashbackInr || 0) +
              (wlt.availableGoodwillInr || 0) +
              (wlt.availableReferralInr || 0)
          )
        : 0
    };
  }

  // Check if admin prompt requests a consequential action that MUST be staged for confirmation
  let stagedApproval: any = null;
  const lower = promptText.toLowerCase();
  if (
    params.actor.isAdminStaff &&
    params.actor.role !== 'MARKETING_AGENCY' &&
    params.actor.role !== 'INTERN_VIEWER' &&
    (lower.includes('issue') || lower.includes('grant') || lower.includes('credit') || lower.includes('adjust')) &&
    params.customerEmailContext
  ) {
    const amountMatch = promptText.match(/₹\s*(\d+)|(\d+)\s*inr/i);
    const suggestedInr = amountMatch ? Number(amountMatch[1] || amountMatch[2]) : 100;
    stagedApproval = await createRewardsApprovalRequest({
      requestSource: 'AI_REWARDS_ASSISTANT',
      actionType: 'WALLET_CREDIT_ISSUE',
      targetCustomerEmail: params.customerEmailContext,
      amountInr: suggestedInr,
      creditType: 'GOODWILL_CREDIT' as WalletCreditType,
      reason: `AI Rewards Assistant staged proposal: "${promptText.slice(0, 120)}"`,
      payload: { expiresInDays: 180, proposedViaAi: true },
      actor: params.actor
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      const systemInstruction = `You are the FRAGMORÉ Privileges, Smart Wallet & Gifting Strategist for FRAGMORÉ Haute Parfumerie (fragmore.shop).
Follow FRAGMORÉ's luxury-first house philosophy:
- Avoid habitual discount-led campaigns; champion fragrance storytelling, Discovery Set upgrades, tier privileges, and thoughtful gifting.
- Wallet credits and Gift Cards are strictly closed-loop brand credits (never cash-withdrawable or transferable to bank accounts).
- Never claim you directly mutated a customer's balance, issued a gift card, or approved a refund without human approval. If an action was staged, reference the pending confirmation ticket.
Keep your answer concise, structured, and grounded strictly in the provided live JSON context.`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Live FRAGMORÉ Context:\n${JSON.stringify(contextSummary)}\n\nUser Query: ${promptText}${
          stagedApproval
            ? `\n\nNote: A staged approval ticket (${stagedApproval.approvalNumber}) for ₹${stagedApproval.amountInr} has been queued in PENDING_APPROVAL and requires explicit Super Admin / Finance confirmation before any balance changes.`
            : ''
        }`,
        config: {
          systemInstruction,
          temperature: 0.35
        }
      });

      if (response.text) {
        return {
          reply: response.text,
          stagedApproval,
          modelUsed: 'gemini-4-hydrogen'
        };
      }
    } catch (err: any) {
      console.warn('[AI Rewards Assistant] Falling back to deterministic engine:', err?.message);
    }
  }

  // Deterministic high-precision fallback if API key is unconfigured in local test
  const kpis = (contextSummary as any).kpis;
  const fallbackLines: string[] = [];
  if (params.actor.isAdminStaff && kpis) {
    fallbackLines.push(
      `FRAGMORÉ Privileges & Wallet Live Summary (${params.actor.role}):`,
      `• Unredeemed Paid Gift Card Liability (GL 2310): ₹${kpis.unredeemedGiftCardLiabilityInr.toLocaleString('en-IN')} across ${kpis.giftCardsSoldCount} paid cards.`,
      `• Wallet Liability: ₹${kpis.totalWalletLiabilityInr.toLocaleString('en-IN')} (Refund Credits: ₹${kpis.refundCreditLiabilityInr.toLocaleString('en-IN')} | Promo/Referral Credits: ₹${kpis.promotionalWalletLiabilityInr.toLocaleString('en-IN')}).`,
      `• Outstanding Loyalty Reserve (GL 2330): ${kpis.totalOutstandingLoyaltyPoints} pts (₹${kpis.outstandingLoyaltyLiabilityInr.toLocaleString('en-IN')}).`,
      `• Budget-Safe Recommendation: Target Platinum & Gold patrons with Discovery-to-50ml flacon upgrade privileges and Gift FRAGMORÉ celebratory reminders rather than blanket percentage discounts.`
    );
  } else {
    const loy = (contextSummary as any).customerLoyalty;
    fallbackLines.push(
      `Welcome to FRAGMORÉ Concierge.`,
      loy
        ? `• Your FRAGMORÉ Privileges standing is ${loy.tierCode} with ${loy.availablePoints} available points (${loy.pendingPoints} maturing) and ₹${(contextSummary as any).customerWalletAvailableInr || 0} available Wallet credit.`
        : `• You earn 5 FRAGMORÉ Privileges points per ₹100 on qualifying fragrance purchases (100 points = ₹10 at checkout, up to 20% of order value).`,
      `• For gifting, explore Gift FRAGMORÉ digital cards from ₹500 to ₹5,000 paired with GOLDEN HOUR or MOKSHA ESSENCE.`
    );
  }

  if (stagedApproval) {
    fallbackLines.push(
      `• Action Governance: Request ${stagedApproval.approvalNumber} (₹${stagedApproval.amountInr} for ${stagedApproval.targetCustomerEmail}) has been queued in PENDING_APPROVAL and requires explicit authorized confirmation before execution.`
    );
  }

  return {
    reply: fallbackLines.join('\n'),
    stagedApproval,
    modelUsed: 'deterministic-rewards-strategist'
  };
}
