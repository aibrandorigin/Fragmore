import React, { useState, useEffect, useCallback } from 'react';
import { rewardsApi, type RewardsExportReportKey } from '../../lib/rewardsApi';
import {
  Wallet,
  Award,
  Gift,
  Building2,
  Share2,
  Calendar,
  Megaphone,
  ShieldAlert,
  FileSpreadsheet,
  Settings,
  ClipboardCheck,
  Sparkles,
  Download,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Lock,
  Plus,
  QrCode,
  Search,
  BookOpen,
  Sliders
} from 'lucide-react';

export type AdminRewardsSubView =
  | 'overview'
  | 'wallets'
  | 'wallet_txns'
  | 'loyalty_points'
  | 'loyalty_tiers'
  | 'gift_cards'
  | 'corporate_gift_cards'
  | 'referrals'
  | 'occasions'
  | 'campaigns'
  | 'redemption_rules'
  | 'fraud_risk'
  | 'reports'
  | 'settings'
  | 'audit_logs';

export const ADMIN_REWARDS_SUBVIEWS: { id: AdminRewardsSubView; label: string }[] = [
  { id: 'overview', label: 'Overview Dashboard' },
  { id: 'wallets', label: 'Customer Wallets' },
  { id: 'wallet_txns', label: 'Wallet Transactions' },
  { id: 'loyalty_points', label: 'Loyalty Points' },
  { id: 'loyalty_tiers', label: 'Loyalty Tiers' },
  { id: 'gift_cards', label: 'Gift Cards & POS' },
  { id: 'corporate_gift_cards', label: 'Corporate Gift Cards' },
  { id: 'referrals', label: 'Referrals' },
  { id: 'occasions', label: 'Birthday & Occasions' },
  { id: 'campaigns', label: 'Campaigns & Promotions' },
  { id: 'redemption_rules', label: 'Redemption Rules' },
  { id: 'fraud_risk', label: 'Fraud & Risk Review' },
  { id: 'reports', label: 'Reports & GL Exports' },
  { id: 'settings', label: 'Settings & Compliance' },
  { id: 'audit_logs', label: 'Approvals & Audit Logs' }
];

interface AdminRewardsAndWalletProps {
  activeSubView: AdminRewardsSubView;
  onSubViewChange: (sub: AdminRewardsSubView) => void;
  erpRoleCode: string;
  onNotify: (msg: string) => void;
}

const REPORT_CATALOG: {
  key: RewardsExportReportKey;
  title: string;
  subtitle: string;
  glNote: string;
}[] = [
  {
    key: 'wallet_statement',
    title: '01 · Customer Wallet Statement & Liability Ledger',
    subtitle: 'Running balances across Refund, Promotional, Cashback, Goodwill & Referral buckets.',
    glNote: 'GL 2320 / 5410'
  },
  {
    key: 'loyalty_ledger',
    title: '02 · FRAGMORÉ Privileges Points Accrual & Maturation Ledger',
    subtitle: 'Points earned, 7-day return-window holds, redemptions, reversals & expiries.',
    glNote: 'GL 2330 Reserve'
  },
  {
    key: 'gift_card_issuance',
    title: '03 · Gift Card Issuance Register (Masked Codes)',
    subtitle: 'Digital, physical & corporate gift cards issued post-payment confirmation.',
    glNote: 'GL 2310 Deferred'
  },
  {
    key: 'gift_card_redemption',
    title: '04 · Gift Card Redemption & POS Settlement Ledger',
    subtitle: 'Storefront checkout & Perfume Bar / Event POS partial and full redemptions.',
    glNote: 'GL 2310 → Revenue'
  },
  {
    key: 'unredeemed_liability',
    title: '05 · Unredeemed Gift Card Deferred Liability & Breakage Aging',
    subtitle: 'Active unredeemed liabilities + expired unredeemed balances pending accountant sign-off.',
    glNote: 'GL 2310 / GL 4310'
  },
  {
    key: 'corporate_gift_cards',
    title: '06 · Corporate Bulk Gift Card Batches & B2B Proposals',
    subtitle: 'ERP Proposal/Quotation-linked corporate gifting manifests & negotiated discounts.',
    glNote: 'B2B GST & GL 2310'
  },
  {
    key: 'referral_performance',
    title: '07 · Referral & Advocate Conversion Attribution',
    subtitle: 'Referrer-to-referee conversions, household shared signals & net first-order revenue.',
    glNote: 'GL 5410 CAC'
  },
  {
    key: 'vip_tier_report',
    title: '08 · VIP & Tier-Based Membership Roster',
    subtitle: 'Silver, Gold, Platinum (₹5,000+) & Private Atelier (₹15,000+) member progression.',
    glNote: 'CLV & Retention'
  },
  {
    key: 'campaign_reward_roi',
    title: '09 · Reward Campaign ROI & Incrementality Report',
    subtitle: 'Reward-driven orders, promotional expense vs net revenue & repeat purchase lift.',
    glNote: 'GL 5410 vs Sales'
  }
];

export const AdminRewardsAndWallet: React.FC<AdminRewardsAndWalletProps> = ({
  activeSubView,
  onSubViewChange,
  erpRoleCode,
  onNotify
}) => {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [exportingKey, setExportingKey] = useState<string | null>(null);

  // Issue / Debit Wallet Forms
  const [wltEmail, setWltEmail] = useState<string>('');
  const [wltName, setWltName] = useState<string>('');
  const [wltCreditType, setWltCreditType] = useState<string>('GOODWILL_CREDIT');
  const [wltAmount, setWltAmount] = useState<string>('250');
  const [wltReason, setWltReason] = useState<string>('');
  const [wltExpiryDays, setWltExpiryDays] = useState<string>('90');
  const [wltRequireApproval, setWltRequireApproval] = useState<boolean>(false);
  const [debitEmail, setDebitEmail] = useState<string>('');
  const [debitAmount, setDebitAmount] = useState<string>('100');
  const [debitReason, setDebitReason] = useState<string>('');

  // Loyalty Adjust Form
  const [ptsEmail, setPtsEmail] = useState<string>('');
  const [ptsDelta, setPtsDelta] = useState<string>('200');
  const [ptsReason, setPtsReason] = useState<string>('');
  const [ptsRequireApproval, setPtsRequireApproval] = useState<boolean>(false);

  // POS Redemption Terminal & Gift Card Actions
  const [posCode, setPosCode] = useState<string>('');
  const [posAmount, setPosAmount] = useState<string>('500');
  const [posLocation, setPosLocation] = useState<string>('FRAGMORÉ Worli Atelier Perfume Bar');
  const [posCustomerEmail, setPosCustomerEmail] = useState<string>('');
  const [gcActionReason, setGcActionReason] = useState<string>('Security verification / customer request');
  const [confirmPayRef, setConfirmPayRef] = useState<Record<string, string>>({});

  // Corporate Batch Creation Form
  const [corpCompany, setCorpCompany] = useState<string>('');
  const [corpContactName, setCorpContactName] = useState<string>('');
  const [corpContactEmail, setCorpContactEmail] = useState<string>('');
  const [corpGstin, setCorpGstin] = useState<string>('');
  const [corpOccasion, setCorpOccasion] = useState<string>('Corporate Gift');
  const [corpQty, setCorpQty] = useState<string>('10');
  const [corpDenom, setCorpDenom] = useState<string>('2000');
  const [corpDiscPct, setCorpDiscPct] = useState<string>('5');
  const [corpProposalId, setCorpProposalId] = useState<string>('');
  const [corpQuotationId, setCorpQuotationId] = useState<string>('');
  const [corpMessage, setCorpMessage] = useState<string>('With warm appreciation from Leadership.');
  const [corpPayRefMap, setCorpPayRefMap] = useState<Record<string, string>>({});

  // Occasion manual grant
  const [occEmail, setOccEmail] = useState<string>('');
  const [occType, setOccType] = useState<string>('BIRTHDAY');

  // Fraud resolution notes
  const [fraudNotesMap, setFraudNotesMap] = useState<Record<string, string>>({});

  // Breakage recognition request
  const [breakageAmount, setBreakageAmount] = useState<string>('500');
  const [breakageReason, setBreakageReason] = useState<string>(
    'Statutory post-expiry gift card breakage recognition verified against aged unredeemed schedule'
  );

  // Approval decision notes
  const [approvalNotesMap, setApprovalNotesMap] = useState<Record<string, string>>({});

  // Editable Config Drafts
  const [checkoutDraft, setCheckoutDraft] = useState<any>({});
  const [walletCfgDraft, setWalletCfgDraft] = useState<any>({});
  const [loyaltyCfgDraft, setLoyaltyCfgDraft] = useState<any>({});
  const [giftCardCfgDraft, setGiftCardCfgDraft] = useState<any>({});
  const [occasionCfgDraft, setOccasionCfgDraft] = useState<any>({});
  const [tierDrafts, setTierDrafts] = useState<Record<string, any>>({});

  // AI Rewards Strategist
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [aiResponse, setAiResponse] = useState<any | null>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await rewardsApi.getAdminBootstrap();
      setData(res);
      if (res?.config) {
        setCheckoutDraft(res.config.checkoutRulesConfig || {});
        setWalletCfgDraft(res.config.walletConfig || {});
        setLoyaltyCfgDraft(res.config.loyaltyConfig || {});
        setGiftCardCfgDraft(res.config.giftCardConfig || {});
        setOccasionCfgDraft(res.config.occasionConfig || {});
      }
      if (Array.isArray(res?.tiers)) {
        const map: Record<string, any> = {};
        res.tiers.forEach((t: any) => {
          map[t.tierCode] = { ...t };
        });
        setTierDrafts(map);
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to load Rewards & Wallet workspace.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace, erpRoleCode]);

  const handleExport = async (reportKey: RewardsExportReportKey, format: 'pdf' | 'xlsx', customerEmail?: string) => {
    const token = `${reportKey}_${format}`;
    setExportingKey(token);
    try {
      await rewardsApi.downloadAdminReport(reportKey, format, {
        customerEmail: customerEmail || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined
      });
      onNotify(`Downloaded ${reportKey.replace(/_/g, ' ').toUpperCase()} (${format.toUpperCase()}).`);
    } catch (err: any) {
      onNotify(`Export error: ${err.message}`);
    } finally {
      setExportingKey(null);
    }
  };

  const handleIssueWalletCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wltEmail.trim() || !wltReason.trim()) {
      onNotify('Customer email and mandatory audit reason are required.');
      return;
    }
    try {
      const res = await rewardsApi.issueWalletCreditAdmin({
        customerEmail: wltEmail.trim(),
        customerName: wltName.trim() || undefined,
        creditType: wltCreditType,
        amountInr: Number(wltAmount) || 0,
        reason: wltReason.trim(),
        expiresInDays: Number(wltExpiryDays) || 90,
        requireApproval: wltRequireApproval
      });
      setWltReason('');
      onNotify(
        res.queuedForApproval
          ? `Approval request ${res.approval?.approvalNumber} queued for Super Admin / Finance sign-off.`
          : `Issued ₹${wltAmount} (${wltCreditType}) to ${wltEmail.trim()}.`
      );
      await loadWorkspace();
    } catch (err: any) {
      onNotify(`Error: ${err.message}`);
    }
  };

  const handleDebitWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!debitEmail.trim() || !debitReason.trim()) {
      onNotify('Customer email and mandatory audit reason are required.');
      return;
    }
    try {
      await rewardsApi.debitWalletCreditAdmin({
        customerEmail: debitEmail.trim(),
        amountInr: Number(debitAmount) || 0,
        reason: debitReason.trim()
      });
      setDebitReason('');
      onNotify(`Reversed ₹${debitAmount} from ${debitEmail.trim()} wallet.`);
      await loadWorkspace();
    } catch (err: any) {
      onNotify(`Error: ${err.message}`);
    }
  };

  const handleAdjustPoints = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ptsEmail.trim() || !ptsReason.trim()) {
      onNotify('Customer email and mandatory audit reason are required.');
      return;
    }
    try {
      const res = await rewardsApi.adjustLoyaltyPointsAdmin({
        customerEmail: ptsEmail.trim(),
        pointsDelta: Number(ptsDelta) || 0,
        reason: ptsReason.trim(),
        requireApproval: ptsRequireApproval
      });
      setPtsReason('');
      onNotify(
        res.queuedForApproval
          ? `Loyalty adjustment queued for dual-control approval (${res.approval?.approvalNumber}).`
          : `Adjusted ${ptsDelta} points for ${ptsEmail.trim()}.`
      );
      await loadWorkspace();
    } catch (err: any) {
      onNotify(`Error: ${err.message}`);
    }
  };

  const handleSaveTier = async (tierCode: string) => {
    const draft = tierDrafts[tierCode];
    if (!draft) return;
    try {
      await rewardsApi.updateLoyaltyTier(tierCode, draft);
      onNotify(`Saved ${draft.tierName} (${tierCode}) tier parameters.`);
      await loadWorkspace();
    } catch (err: any) {
      onNotify(`Error: ${err.message}`);
    }
  };

  const handlePosRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!posCode.trim() || Number(posAmount) <= 0) return;
    try {
      const res = await rewardsApi.redeemGiftCardAtPosAdmin({
        redemptionCodeOrQr: posCode.trim(),
        amountInr: Number(posAmount),
        posEventLocation: posLocation.trim() || 'FRAGMORÉ Perfume Bar',
        customerEmail: posCustomerEmail.trim() || undefined
      });
      setPosCode('');
      onNotify(
        `Redeemed ₹${res.amountRedeemedInr} on ${res.giftCard?.cardNumber}. Remaining Card Balance: ₹${res.giftCard?.remainingBalanceInr}.`
      );
      await loadWorkspace();
    } catch (err: any) {
      onNotify(`POS Redemption Error: ${err.message}`);
    }
  };

  const handleConfirmSingleGiftCardPayment = async (cardId: string, cardNumber: string) => {
    const ref = (confirmPayRef[cardId] || `GW_VERIFIED_${Date.now().toString().slice(-6)}`).trim();
    try {
      const res = await rewardsApi.confirmGiftCardPayment(cardId, ref);
      onNotify(
        `Activated ${cardNumber} (GL 2310 Deferred Liability posted). Code: ${res.revealedCodeOnce || 'Issued'}`
      );
      await loadWorkspace();
    } catch (err: any) {
      onNotify(`Error: ${err.message}`);
    }
  };

  const handleGiftCardStatusAction = async (cardId: string, action: 'BLOCK' | 'UNBLOCK' | 'CANCEL') => {
    if (!gcActionReason.trim()) {
      onNotify('Enter a mandatory reason in the reason box above the Gift Cards table first.');
      return;
    }
    try {
      await rewardsApi.updateGiftCardStatusAdmin(cardId, action, gcActionReason.trim());
      onNotify(`Gift card status updated (${action}).`);
      await loadWorkspace();
    } catch (err: any) {
      onNotify(`Error: ${err.message}`);
    }
  };

  const handleCreateCorporateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!corpCompany.trim() || !corpContactEmail.trim()) {
      onNotify('Company name and corporate contact email are required.');
      return;
    }
    try {
      const created = await rewardsApi.createCorporateBatchAdmin({
        companyName: corpCompany.trim(),
        contactName: corpContactName.trim() || 'Corporate Procurement',
        contactEmail: corpContactEmail.trim(),
        companyGstin: corpGstin.trim() || undefined,
        occasion: corpOccasion,
        quantity: Number(corpQty) || 10,
        denominationInr: Number(corpDenom) || 1000,
        discountPct: Number(corpDiscPct) || 0,
        erpProposalId: corpProposalId || undefined,
        erpQuotationId: corpQuotationId || undefined,
        customSenderMessage: corpMessage
      });
      setCorpCompany('');
      onNotify(
        `Created Corporate Batch ${created.batch?.batchNumber} (${created.batch?.quantity} × ₹${created.batch?.denominationInr}) — Awaiting Finance Payment Verification.`
      );
      await loadWorkspace();
    } catch (err: any) {
      onNotify(`Error: ${err.message}`);
    }
  };

  const handleApproveCorporateBatch = async (batchId: string, batchNumber: string) => {
    const payRef = (corpPayRefMap[batchId] || `NEFT_CORP_${Date.now().toString().slice(-6)}`).trim();
    try {
      const res = await rewardsApi.approveCorporateBatchPaymentAdmin(batchId, payRef);
      onNotify(
        `Finance verified ${batchNumber}: Issued ${res.issuedCount || res.cards?.length || 0} active corporate gift cards & posted GL 2310.`
      );
      await loadWorkspace();
    } catch (err: any) {
      onNotify(`Error: ${err.message}`);
    }
  };

  const handleSaveConfigSection = async (section: string, payload: Record<string, any>, label: string) => {
    try {
      await rewardsApi.updateConfigSection(section, payload);
      onNotify(`${label} saved to PostgreSQL.`);
      await loadWorkspace();
    } catch (err: any) {
      onNotify(`Error: ${err.message}`);
    }
  };

  const handleAskAi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const res = await rewardsApi.askAiRewardsAssistant(aiPrompt.trim(), 'admin');
      setAiResponse(res);
    } catch (err: any) {
      onNotify(`AI Assistant Error: ${err.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="p-10 text-center font-mono text-xs text-[#686158]">
        Synchronizing FRAGMORÉ Smart Wallet, Loyalty &amp; Gift Card Ledger from Firebase Firestore...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-[#FFFFFF] border border-rose-300 rounded-xl text-xs font-mono text-rose-700 space-y-3">
        <div>
          <strong>Access / Workspace Notice:</strong> {error}
        </div>
        <button
          onClick={loadWorkspace}
          className="px-4 py-2 bg-[#24211D] text-[#FAF8F4] rounded cursor-pointer"
        >
          Retry Sync
        </button>
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const qLower = searchQuery.trim().toLowerCase();

  return (
    <div className="space-y-6 text-[#24211D]">
      {/* TOP HEADER STRIP + HORIZONTAL SUB-NAVIGATION */}
      <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-2xl p-4 sm:p-5 space-y-4 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-[#9A783E] font-bold">
                Closed-Loop Store Credit · Privileges · Cryptographic Gift Cards
              </span>
              <span className="px-2 py-0.5 rounded bg-[#F1EDE5] border border-[#DED7CC] text-[10px] font-mono font-bold text-[#24211D]">
                Active Role: {data?.actor?.role || erpRoleCode}
              </span>
            </div>
            <h2 className="font-serif text-xl sm:text-2xl uppercase tracking-wider text-[#24211D] mt-0.5">
              FRAGMORÉ Rewards, Smart Wallet &amp; Gift Card Ecosystem
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#9A783E] absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter email, card #, ref..."
                className="pl-8 pr-3 py-1.5 bg-[#FAF8F4] border border-[#DED7CC] rounded-lg text-xs font-mono text-[#24211D] focus:border-[#9A783E] focus:outline-none w-48 sm:w-56"
              />
            </div>
            <button
              type="button"
              onClick={loadWorkspace}
              className="px-3 py-1.5 rounded-lg border border-[#DED7CC] bg-[#FAF8F4] hover:border-[#9A783E] text-xs font-mono flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#9A783E]" />
              <span>Sync Ledger</span>
            </button>
          </div>
        </div>

        {/* Restricted Role Banner (Marketing Agency / Intern) */}
        {data?.restrictedView && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-mono flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-700 shrink-0" />
            <span>{data.restrictionNotice}</span>
          </div>
        )}

        {/* Compact Sub-View Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 border-t border-[#DED7CC]">
          {ADMIN_REWARDS_SUBVIEWS.map((sv) => {
            const active = activeSubView === sv.id;
            return (
              <button
                key={sv.id}
                type="button"
                onClick={() => onSubViewChange(sv.id)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-mono whitespace-nowrap transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#24211D] text-[#FAF8F4] font-bold'
                    : 'bg-[#FAF8F4] text-[#686158] hover:text-[#24211D] border border-[#DED7CC]'
                }`}
              >
                {sv.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ===================================================================
          1. OVERVIEW DASHBOARD (ALL 13 REQUIRED KPIS + AI REWARDS STRATEGIST)
          =================================================================== */}
      {activeSubView === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: '01 · Total Wallet Liability',
                value: `₹${Number(kpis.totalWalletLiabilityInr || 0).toLocaleString('en-IN')}`,
                sub: 'Active spendable closed-loop credits'
              },
              {
                label: '02 · Refund vs Promo Split',
                value: `₹${Number(kpis.refundCreditLiabilityInr || 0).toLocaleString('en-IN')} / ₹${Number(
                  kpis.promotionalWalletLiabilityInr || 0
                ).toLocaleString('en-IN')}`,
                sub: 'GL 2320 Refund vs GL 5410 Promo'
              },
              {
                label: '03 · Outstanding Loyalty Points',
                value: `${Number(kpis.totalOutstandingLoyaltyPoints || 0).toLocaleString('en-IN')} pts`,
                sub: `Reserve Value: ₹${Number(kpis.outstandingLoyaltyLiabilityInr || 0).toLocaleString('en-IN')} (GL 2330)`
              },
              {
                label: '04 · Gift Cards Sold (Paid)',
                value: `${Number(kpis.giftCardsSoldCount || 0)} Cards · ₹${Number(
                  kpis.giftCardsSoldValueInr || 0
                ).toLocaleString('en-IN')}`,
                sub: 'Excludes PENDING_PAYMENT orders'
              },
              {
                label: '05 · Gift Cards Redeemed',
                value: `₹${Number(kpis.giftCardsRedeemedInr || 0).toLocaleString('en-IN')}`,
                sub: 'Website Checkout + Perfume Bar POS'
              },
              {
                label: '06 · Unredeemed Gift Card Liability',
                value: `₹${Number(kpis.unredeemedGiftCardLiabilityInr || 0).toLocaleString('en-IN')}`,
                sub: 'GL 2310 Deferred Liability (₹0 rev at sale)'
              },
              {
                label: '07 · Points Redemption Rate',
                value: `${Number(kpis.redemptionRatePct || 0).toFixed(1)}%`,
                sub: 'Lifetime redeemed vs lifetime accrued'
              },
              {
                label: '08 · Member Repeat Purchase Rate',
                value: `${Number(kpis.repeatPurchaseRatePct || 0).toFixed(1)}%`,
                sub: 'Enrolled members with 2+ orders'
              },
              {
                label: '09 · Completed Referrals',
                value: `${Number(kpis.referralConversionsCount || 0)}`,
                sub: 'Post-delivery & return-window verified'
              },
              {
                label: '10 · Expiring Within 30 Days',
                value: `₹${Number(kpis.expiringRewards30dInr || 0).toLocaleString('en-IN')}`,
                sub: 'Eligible for automated reminder trigger'
              },
              {
                label: '11 · Reward-Driven Revenue',
                value: `₹${Number(kpis.rewardDrivenRevenueInr || 0).toLocaleString('en-IN')}`,
                sub: 'Orders utilizing Wallet / Loyalty / Gift Card'
              },
              {
                label: '12 · Suspicious / Risk Flags',
                value: `${Number(kpis.suspiciousAttemptsCount || 0)}`,
                sub: 'Brute-force & shared-signal review queue'
              }
            ].map((card, i) => (
              <div
                key={i}
                className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl p-4 space-y-1 shadow-2xs"
              >
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#686158] block">
                  {card.label}
                </span>
                <div className="font-serif text-xl font-semibold text-[#24211D] tabular-nums">
                  {card.value}
                </div>
                <span className="text-[11px] text-[#9A783E] font-mono block">{card.sub}</span>
              </div>
            ))}
          </div>

          {/* 13th KPI: VIP Tier Distribution + Quick Export Bar */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 bg-[#FFFFFF] border border-[#DED7CC] rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[#DED7CC] pb-3">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#24211D]">
                  13 · VIP &amp; Privileges Tier Distribution
                </span>
                <button
                  type="button"
                  onClick={() => handleExport('vip_tier_report', 'xlsx')}
                  className="text-[11px] font-mono text-[#9A783E] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export .XLSX</span>
                </button>
              </div>
              <div className="space-y-2.5">
                {(kpis.vipTierDistribution || []).map((t: any) => (
                  <div
                    key={t.tierCode}
                    className="flex items-center justify-between p-3 rounded-xl bg-[#FAF8F4] border border-[#DED7CC] text-xs font-mono"
                  >
                    <div>
                      <strong className="text-[#24211D]">{t.tierName}</strong>
                      <span className="text-[10px] text-[#686158] ml-2">({t.tierCode})</span>
                    </div>
                    <span className="font-bold text-[#9A783E] tabular-nums">
                      {t.membersCount} Members
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Rewards, Retention & Liability Strategist */}
            <div className="lg:col-span-7 bg-[#FFFFFF] border border-[#DED7CC] rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[#DED7CC] pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#9A783E]" />
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#24211D]">
                    AI Rewards, VIP Retention &amp; Liability Strategist
                  </span>
                </div>
                <span className="text-[10px] font-mono text-[#686158]">
                  Role-Aware · Stages Consequential Actions for Approval
                </span>
              </div>

              <form onSubmit={handleAskAi} className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g. Audit unredeemed gift card liability & suggest a luxury non-discount VIP campaign..."
                  className="flex-1 bg-[#FAF8F4] border border-[#DED7CC] rounded-xl px-3.5 py-2.5 text-xs font-mono text-[#24211D] focus:border-[#9A783E] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={aiLoading}
                  className="px-4 py-2.5 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] rounded-xl text-xs font-mono uppercase tracking-wider font-bold cursor-pointer disabled:opacity-50"
                >
                  {aiLoading ? 'Analyzing...' : 'Consult Strategist'}
                </button>
              </form>

              <div className="flex flex-wrap gap-1.5">
                {[
                  'Summarize GL 2310 gift card & GL 2320 wallet liabilities',
                  'Recommend non-discount Private Atelier perks for ₹5,000+ patrons',
                  'Stage ₹250 goodwill store credit for rohan.mehra@gmail.com'
                ].map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => setAiPrompt(sample)}
                    className="px-2.5 py-1 rounded bg-[#F1EDE5] hover:bg-[#DED7CC] text-[10px] font-mono text-[#24211D] cursor-pointer"
                  >
                    {sample}
                  </button>
                ))}
              </div>

              {aiResponse && (
                <div className="p-4 rounded-xl bg-[#FAF8F4] border border-[#DED7CC] space-y-2 text-xs">
                  <p className="whitespace-pre-line leading-relaxed text-[#24211D]">
                    {aiResponse.reply || aiResponse.answer}
                  </p>
                  {aiResponse.stagedApproval && (
                    <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-300 font-mono text-[11px] text-amber-900">
                      Staged in Dual-Control Queue ({aiResponse.stagedApproval.approvalNumber}) — Review under Approvals &amp; Audit Logs before financial execution.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          2. CUSTOMER WALLETS (SUB-LEDGER BUCKETS + ISSUE / DEBIT)
          =================================================================== */}
      {activeSubView === 'wallets' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Issue Store Credit Form */}
            <form
              onSubmit={handleIssueWalletCredit}
              className="bg-[#FFFFFF] border border-[#DED7CC] rounded-2xl p-5 space-y-3 text-xs font-mono"
            >
              <div className="flex items-center justify-between border-b border-[#DED7CC] pb-2">
                <strong className="uppercase tracking-wider text-[#24211D] flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-[#9A783E]" />
                  <span>Issue Closed-Loop Wallet Credit</span>
                </strong>
                <span className="text-[10px] text-[#686158]">Mandatory Audit Reason</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="email"
                  required
                  value={wltEmail}
                  onChange={(e) => setWltEmail(e.target.value)}
                  placeholder="Customer Email *"
                  className="bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2"
                />
                <input
                  type="text"
                  value={wltName}
                  onChange={(e) => setWltName(e.target.value)}
                  placeholder="Customer Name (Optional)"
                  className="bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2"
                />
                <select
                  value={wltCreditType}
                  onChange={(e) => setWltCreditType(e.target.value)}
                  className="bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2"
                >
                  <option value="GOODWILL_CREDIT">GOODWILL_CREDIT (Client Care)</option>
                  <option value="PROMOTIONAL_CREDIT">PROMOTIONAL_CREDIT (Campaign)</option>
                  <option value="CASHBACK_REWARD">CASHBACK_REWARD</option>
                  <option value="REFUND_CREDIT">REFUND_CREDIT (Verified Return Opt-In)</option>
                  <option value="REFERRAL_CREDIT">REFERRAL_CREDIT</option>
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min={1}
                    required
                    value={wltAmount}
                    onChange={(e) => setWltAmount(e.target.value)}
                    placeholder="Amount ₹"
                    className="bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2"
                  />
                  <input
                    type="number"
                    min={1}
                    value={wltExpiryDays}
                    onChange={(e) => setWltExpiryDays(e.target.value)}
                    placeholder="Expiry Days"
                    className="bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2"
                  />
                </div>
              </div>
              <input
                type="text"
                required
                value={wltReason}
                onChange={(e) => setWltReason(e.target.value)}
                placeholder="Mandatory audit reason (e.g. Transit delay goodwill gesture for Order FRG-...) *"
                className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2"
              />
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 text-[11px] text-[#686158] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={wltRequireApproval}
                    onChange={(e) => setWltRequireApproval(e.target.checked)}
                    className="accent-[#9A783E]"
                  />
                  <span>Route through Dual-Control Approval Queue</span>
                </label>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] rounded-lg font-bold uppercase cursor-pointer"
                >
                  Issue Credit
                </button>
              </div>
            </form>

            {/* Debit / Reverse Wallet Credit Form */}
            <form
              onSubmit={handleDebitWallet}
              className="bg-[#FFFFFF] border border-[#DED7CC] rounded-2xl p-5 space-y-3 text-xs font-mono"
            >
              <div className="flex items-center justify-between border-b border-[#DED7CC] pb-2">
                <strong className="uppercase tracking-wider text-[#24211D]">
                  Reverse / Debit Erroneous Store Credit
                </strong>
                <span className="text-[10px] text-rose-700">Super Admin / Finance Only</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="email"
                  required
                  value={debitEmail}
                  onChange={(e) => setDebitEmail(e.target.value)}
                  placeholder="Customer Email *"
                  className="bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2"
                />
                <input
                  type="number"
                  min={1}
                  required
                  value={debitAmount}
                  onChange={(e) => setDebitAmount(e.target.value)}
                  placeholder="Debit Amount ₹ *"
                  className="bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2"
                />
              </div>
              <input
                type="text"
                required
                value={debitReason}
                onChange={(e) => setDebitReason(e.target.value)}
                placeholder="Mandatory reversal reason & reference document *"
                className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2"
              />
              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-lg font-bold uppercase cursor-pointer"
                >
                  Execute Debit
                </button>
              </div>
            </form>
          </div>

          {/* Customer Wallets Table */}
          <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-serif text-lg uppercase tracking-wider">
                Customer Wallet Accounts ({(data?.wallets || []).length})
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleExport('wallet_statement', 'pdf')}
                  className="px-3 py-1.5 rounded border border-[#DED7CC] bg-[#FAF8F4] text-xs font-mono cursor-pointer"
                >
                  Download PDF
                </button>
                <button
                  type="button"
                  onClick={() => handleExport('wallet_statement', 'xlsx')}
                  className="px-3 py-1.5 rounded bg-[#24211D] text-[#FAF8F4] text-xs font-mono cursor-pointer"
                >
                  Download .XLSX
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="border-b border-[#DED7CC] text-[10px] uppercase text-[#686158]">
                    <th className="py-2.5 pr-3">Customer</th>
                    <th className="py-2.5 px-2 text-right">Total Available</th>
                    <th className="py-2.5 px-2 text-right">Refund (2320)</th>
                    <th className="py-2.5 px-2 text-right">Promo</th>
                    <th className="py-2.5 px-2 text-right">Goodwill / Ref</th>
                    <th className="py-2.5 px-2 text-right">Total Redeemed</th>
                    <th className="py-2.5 pl-2 text-right">Statement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1EDE5]">
                  {(data?.wallets || [])
                    .filter(
                      (w: any) =>
                        !qLower ||
                        String(w.customerEmail || '').toLowerCase().includes(qLower) ||
                        String(w.customerName || '').toLowerCase().includes(qLower)
                    )
                    .map((w: any) => (
                      <tr key={w.id} className="hover:bg-[#FAF8F4]">
                        <td className="py-2.5 pr-3">
                          <div className="font-bold text-[#24211D]">{w.customerName || 'Patron'}</div>
                          <div className="text-[11px] text-[#686158]">{w.customerEmail}</div>
                        </td>
                        <td className="py-2.5 px-2 text-right font-bold text-[#9A783E] tabular-nums">
                          ₹{Number(w.totalAvailableInr || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-2 text-right tabular-nums">
                          ₹{Number(w.availableRefundInr || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-2 text-right tabular-nums">
                          ₹{Number(w.availablePromoInr || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-2 text-right tabular-nums">
                          ₹
                          {(
                            Number(w.availableGoodwillInr || 0) +
                            Number(w.availableReferralInr || 0) +
                            Number(w.availableCashbackInr || 0)
                          ).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-2 text-right tabular-nums">
                          ₹{Number(w.totalRedeemedInr || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 pl-2 text-right">
                          <button
                            type="button"
                            onClick={() => handleExport('wallet_statement', 'pdf', w.customerEmail)}
                            className="text-[#9A783E] hover:underline cursor-pointer"
                          >
                            PDF
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          3. WALLET TRANSACTIONS LEDGER
          =================================================================== */}
      {activeSubView === 'wallet_txns' && (
        <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-serif text-lg uppercase tracking-wider">
              Immutable Wallet Transaction Ledger ({(data?.walletTransactions || []).length})
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleExport('wallet_statement', 'pdf')}
                className="px-3 py-1.5 rounded border border-[#DED7CC] bg-[#FAF8F4] text-xs font-mono cursor-pointer"
              >
                Export PDF
              </button>
              <button
                type="button"
                onClick={() => handleExport('wallet_statement', 'xlsx')}
                className="px-3 py-1.5 rounded bg-[#24211D] text-[#FAF8F4] text-xs font-mono cursor-pointer"
              >
                Export .XLSX
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-[#DED7CC] text-[10px] uppercase text-[#686158]">
                  <th className="py-2.5 pr-3">Reference</th>
                  <th className="py-2.5 px-2">Customer</th>
                  <th className="py-2.5 px-2">Type / Bucket</th>
                  <th className="py-2.5 px-2 text-right">Amount</th>
                  <th className="py-2.5 px-2 text-right">Running Bal</th>
                  <th className="py-2.5 pl-2">Reason &amp; Actor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1EDE5]">
                {(data?.walletTransactions || [])
                  .filter(
                    (t: any) =>
                      !qLower ||
                      String(t.customerEmail || '').toLowerCase().includes(qLower) ||
                      String(t.referenceNumber || '').toLowerCase().includes(qLower)
                  )
                  .map((t: any) => (
                    <tr key={t.id} className="hover:bg-[#FAF8F4]">
                      <td className="py-2.5 pr-3">
                        <div className="font-bold">{t.referenceNumber}</div>
                        <div className="text-[10px] text-[#686158]">
                          {new Date(t.createdAt).toLocaleString()}
                        </div>
                      </td>
                      <td className="py-2.5 px-2">{t.customerEmail}</td>
                      <td className="py-2.5 px-2">
                        <div>{t.txnType}</div>
                        <div className="text-[10px] text-[#9A783E]">{t.creditType}</div>
                      </td>
                      <td
                        className={`py-2.5 px-2 text-right font-bold tabular-nums ${
                          t.direction === 'CREDIT' ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {t.direction === 'CREDIT' ? '+' : '-'}₹{Number(t.amountInr).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-2 text-right tabular-nums">
                        ₹{Number(t.availableBalanceAfterInr || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 pl-2 max-w-xs truncate" title={t.reason}>
                        <div>{t.reason}</div>
                        <div className="text-[10px] text-[#686158]">{t.actorEmail}</div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================
          4. LOYALTY POINTS ACCOUNTS & LEDGER
          =================================================================== */}
      {activeSubView === 'loyalty_points' && (
        <div className="space-y-6">
          <form
            onSubmit={handleAdjustPoints}
            className="bg-[#FFFFFF] border border-[#DED7CC] rounded-2xl p-5 space-y-3 text-xs font-mono"
          >
            <div className="flex items-center justify-between border-b border-[#DED7CC] pb-2">
              <strong className="uppercase tracking-wider">
                Manual FRAGMORÉ Privileges Points Adjustment
              </strong>
              <span className="text-[10px] text-[#686158]">
                Positive to credit, negative to deduct (e.g. -100)
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="email"
                required
                value={ptsEmail}
                onChange={(e) => setPtsEmail(e.target.value)}
                placeholder="Customer Email *"
                className="bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2"
              />
              <input
                type="number"
                required
                value={ptsDelta}
                onChange={(e) => setPtsDelta(e.target.value)}
                placeholder="Points Delta (e.g. 250 or -100) *"
                className="bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2"
              />
              <input
                type="text"
                required
                value={ptsReason}
                onChange={(e) => setPtsReason(e.target.value)}
                placeholder="Mandatory audit reason *"
                className="bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-[11px] text-[#686158] cursor-pointer">
                <input
                  type="checkbox"
                  checked={ptsRequireApproval}
                  onChange={(e) => setPtsRequireApproval(e.target.checked)}
                  className="accent-[#9A783E]"
                />
                <span>Queue for Dual-Control Approval</span>
              </label>
              <button
                type="submit"
                className="px-4 py-2 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] rounded-lg font-bold uppercase cursor-pointer"
              >
                Apply Points Adjustment
              </button>
            </div>
          </form>

          <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-serif text-lg uppercase tracking-wider">
                Enrolled Privileges Members ({(data?.loyaltyAccounts || []).length})
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleExport('loyalty_ledger', 'pdf')}
                  className="px-3 py-1.5 rounded border border-[#DED7CC] bg-[#FAF8F4] text-xs font-mono cursor-pointer"
                >
                  Download PDF
                </button>
                <button
                  type="button"
                  onClick={() => handleExport('loyalty_ledger', 'xlsx')}
                  className="px-3 py-1.5 rounded bg-[#24211D] text-[#FAF8F4] text-xs font-mono cursor-pointer"
                >
                  Download .XLSX
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="border-b border-[#DED7CC] text-[10px] uppercase text-[#686158]">
                    <th className="py-2.5 pr-3">Member</th>
                    <th className="py-2.5 px-2">Tier</th>
                    <th className="py-2.5 px-2 text-right">Available Pts</th>
                    <th className="py-2.5 px-2 text-right">Pending (7d Hold)</th>
                    <th className="py-2.5 px-2 text-right">Net Spend</th>
                    <th className="py-2.5 pl-2">Referral Code</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1EDE5]">
                  {(data?.loyaltyAccounts || [])
                    .filter(
                      (a: any) =>
                        !qLower ||
                        String(a.customerEmail || '').toLowerCase().includes(qLower) ||
                        String(a.memberNumber || '').toLowerCase().includes(qLower)
                    )
                    .map((a: any) => (
                      <tr key={a.id} className="hover:bg-[#FAF8F4]">
                        <td className="py-2.5 pr-3">
                          <div className="font-bold">{a.customerName}</div>
                          <div className="text-[10px] text-[#686158]">
                            {a.memberNumber} · {a.customerEmail}
                          </div>
                        </td>
                        <td className="py-2.5 px-2 font-bold text-[#9A783E]">{a.tierCode}</td>
                        <td className="py-2.5 px-2 text-right font-bold tabular-nums">
                          {Number(a.availablePoints || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-2 text-right tabular-nums">
                          {Number(a.pendingPoints || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-2 text-right tabular-nums">
                          ₹{Number(a.qualifyingNetSpendInr || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 pl-2">{a.referralCode}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          5. LOYALTY TIERS CONFIGURATION
          =================================================================== */}
      {activeSubView === 'loyalty_tiers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(data?.tiers || []).map((tier: any) => {
            const draft = tierDrafts[tier.tierCode] || tier;
            return (
              <div
                key={tier.tierCode}
                className="bg-[#FFFFFF] border border-[#DED7CC] rounded-2xl p-5 space-y-4 text-xs font-mono"
              >
                <div className="flex items-center justify-between border-b border-[#DED7CC] pb-3">
                  <div>
                    <span className="text-[10px] uppercase tracking-widest text-[#9A783E] block">
                      {tier.tierCode}
                    </span>
                    <h4 className="font-serif text-lg uppercase text-[#24211D]">{draft.tierName}</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSaveTier(tier.tierCode)}
                    className="px-3.5 py-1.5 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] rounded-lg font-bold uppercase cursor-pointer"
                  >
                    Save Tier
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1">
                    <span className="text-[10px] text-[#686158] block">Min Qualifying Spend (₹)</span>
                    <input
                      type="number"
                      value={draft.minQualifyingSpendInr ?? 0}
                      onChange={(e) =>
                        setTierDrafts((prev) => ({
                          ...prev,
                          [tier.tierCode]: { ...draft, minQualifyingSpendInr: Number(e.target.value) }
                        }))
                      }
                      className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded px-2.5 py-1.5"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] text-[#686158] block">Points Multiplier (×)</span>
                    <input
                      type="number"
                      step="0.25"
                      value={draft.pointsMultiplier ?? 1}
                      onChange={(e) =>
                        setTierDrafts((prev) => ({
                          ...prev,
                          [tier.tierCode]: { ...draft, pointsMultiplier: Number(e.target.value) }
                        }))
                      }
                      className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded px-2.5 py-1.5"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] text-[#686158] block">Max Order Redemption (%)</span>
                    <input
                      type="number"
                      value={draft.maxRedemptionOrderPct ?? 20}
                      onChange={(e) =>
                        setTierDrafts((prev) => ({
                          ...prev,
                          [tier.tierCode]: { ...draft, maxRedemptionOrderPct: Number(e.target.value) }
                        }))
                      }
                      className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded px-2.5 py-1.5"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] text-[#686158] block">Annual Renewal Spend (₹)</span>
                    <input
                      type="number"
                      value={draft.renewalSpendInr ?? 0}
                      onChange={(e) =>
                        setTierDrafts((prev) => ({
                          ...prev,
                          [tier.tierCode]: { ...draft, renewalSpendInr: Number(e.target.value) }
                        }))
                      }
                      className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded px-2.5 py-1.5"
                    />
                  </label>
                </div>
                <p className="text-[11px] text-[#686158] font-sans">{draft.tagline}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* ===================================================================
          6. GIFT CARDS & PERFUME BAR / EVENT POS REDEMPTION TERMINAL
          =================================================================== */}
      {activeSubView === 'gift_cards' && (
        <div className="space-y-6">
          {/* Perfume Bar / Event POS Redemption Terminal */}
          <form
            onSubmit={handlePosRedeem}
            className="bg-[#FFFFFF] border border-[#9A783E]/50 rounded-2xl p-5 space-y-3 text-xs font-mono"
          >
            <div className="flex items-center justify-between border-b border-[#DED7CC] pb-2">
              <strong className="uppercase tracking-wider flex items-center gap-2 text-[#24211D]">
                <QrCode className="w-4 h-4 text-[#9A783E]" />
                <span>Perfume Bar &amp; Pop-Up Event POS Gift Card Redemption Terminal</span>
              </strong>
              <span className="text-[10px] text-[#9A783E]">Clears GL 2310 → Event Revenue</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input
                type="text"
                required
                value={posCode}
                onChange={(e) => setPosCode(e.target.value.toUpperCase())}
                placeholder="Scan QR or Enter FRGM-XXXX-..."
                className="bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2 uppercase"
              />
              <input
                type="number"
                min={1}
                required
                value={posAmount}
                onChange={(e) => setPosAmount(e.target.value)}
                placeholder="Redeem Amount ₹ *"
                className="bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2"
              />
              <input
                type="text"
                required
                value={posLocation}
                onChange={(e) => setPosLocation(e.target.value)}
                placeholder="Event / POS Location"
                className="bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] rounded-lg font-bold uppercase cursor-pointer"
              >
                Redeem at POS
              </button>
            </div>
          </form>

          {/* Issued Gift Cards Register (Masked Codes) */}
          <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-serif text-lg uppercase tracking-wider">
                  Issued Gift Cards ({(data?.giftCards || []).length})
                </h3>
                <p className="text-[11px] font-mono text-[#686158]">
                  Codes are SHA-256 hashed &amp; AES-256-GCM encrypted at rest; strictly masked in admin views and exports.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={gcActionReason}
                  onChange={(e) => setGcActionReason(e.target.value)}
                  placeholder="Reason for Block/Cancel..."
                  className="bg-[#FAF8F4] border border-[#DED7CC] rounded px-2.5 py-1.5 text-xs font-mono w-52"
                />
                <button
                  type="button"
                  onClick={() => handleExport('gift_card_issuance', 'pdf')}
                  className="px-3 py-1.5 rounded border border-[#DED7CC] bg-[#FAF8F4] text-xs font-mono cursor-pointer"
                >
                  Issuance PDF
                </button>
                <button
                  type="button"
                  onClick={() => handleExport('gift_card_issuance', 'xlsx')}
                  className="px-3 py-1.5 rounded bg-[#24211D] text-[#FAF8F4] text-xs font-mono cursor-pointer"
                >
                  Issuance .XLSX
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="border-b border-[#DED7CC] text-[10px] uppercase text-[#686158]">
                    <th className="py-2.5 pr-3">Card # / Masked Code</th>
                    <th className="py-2.5 px-2">Purchaser → Recipient</th>
                    <th className="py-2.5 px-2">Payment / Status</th>
                    <th className="py-2.5 px-2 text-right">Initial</th>
                    <th className="py-2.5 px-2 text-right">Remaining</th>
                    <th className="py-2.5 pl-2 text-right">Governance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1EDE5]">
                  {(data?.giftCards || [])
                    .filter(
                      (g: any) =>
                        !qLower ||
                        String(g.cardNumber || '').toLowerCase().includes(qLower) ||
                        String(g.purchaserEmail || '').toLowerCase().includes(qLower) ||
                        String(g.recipientEmail || '').toLowerCase().includes(qLower)
                    )
                    .map((g: any) => (
                      <tr key={g.id} className="hover:bg-[#FAF8F4]">
                        <td className="py-2.5 pr-3">
                          <div className="font-bold">{g.cardNumber}</div>
                          <div className="text-[11px] text-[#9A783E]">{g.maskedCode}</div>
                        </td>
                        <td className="py-2.5 px-2">
                          <div>{g.purchaserEmail}</div>
                          <div className="text-[10px] text-[#686158]">
                            → {g.recipientName} ({g.occasion})
                          </div>
                        </td>
                        <td className="py-2.5 px-2">
                          <span className="font-bold">{g.status}</span>
                          <span className="block text-[10px] text-[#686158]">{g.paymentStatus}</span>
                        </td>
                        <td className="py-2.5 px-2 text-right tabular-nums">
                          ₹{Number(g.initialValueInr || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-2 text-right font-bold text-[#9A783E] tabular-nums">
                          ₹{Number(g.remainingBalanceInr || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 pl-2 text-right space-x-1.5 whitespace-nowrap">
                          {g.paymentStatus === 'PENDING_PAYMENT' && (
                            <span className="inline-flex items-center gap-1">
                              <input
                                type="text"
                                value={confirmPayRef[g.id] || ''}
                                onChange={(e) =>
                                  setConfirmPayRef((p) => ({ ...p, [g.id]: e.target.value }))
                                }
                                placeholder="Gateway Txn#"
                                className="bg-[#FAF8F4] border border-[#DED7CC] rounded px-1.5 py-0.5 text-[10px] w-24"
                              />
                              <button
                                type="button"
                                onClick={() => handleConfirmSingleGiftCardPayment(g.id, g.cardNumber)}
                                className="px-2 py-1 bg-emerald-700 text-white rounded text-[10px] font-bold cursor-pointer"
                              >
                                Activate
                              </button>
                            </span>
                          )}
                          {g.status === 'ACTIVE' && (
                            <button
                              type="button"
                              onClick={() => handleGiftCardStatusAction(g.id, 'BLOCK')}
                              className="px-2 py-1 border border-amber-400 text-amber-800 rounded text-[10px] cursor-pointer"
                            >
                              Block
                            </button>
                          )}
                          {g.status === 'BLOCKED' && (
                            <button
                              type="button"
                              onClick={() => handleGiftCardStatusAction(g.id, 'UNBLOCK')}
                              className="px-2 py-1 border border-emerald-400 text-emerald-800 rounded text-[10px] cursor-pointer"
                            >
                              Unblock
                            </button>
                          )}
                          {g.status !== 'CANCELLED' && g.status !== 'REDEEMED' && (
                            <button
                              type="button"
                              onClick={() => handleGiftCardStatusAction(g.id, 'CANCEL')}
                              className="px-2 py-1 border border-rose-300 text-rose-700 rounded text-[10px] cursor-pointer"
                            >
                              Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          7. CORPORATE BULK GIFT CARDS (LINKED TO ERP PROPOSALS & QUOTATIONS)
          =================================================================== */}
      {activeSubView === 'corporate_gift_cards' && (
        <div className="space-y-6">
          <form
            onSubmit={handleCreateCorporateBatch}
            className="bg-[#FFFFFF] border border-[#DED7CC] rounded-2xl p-5 space-y-4 text-xs font-mono"
          >
            <div className="flex items-center justify-between border-b border-[#DED7CC] pb-2">
              <strong className="uppercase tracking-wider flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#9A783E]" />
                <span>Create Corporate Gifting Bulk Gift Card Batch</span>
              </strong>
              <span className="text-[10px] text-[#686158]">
                Cards remain unissued until Finance confirms payment
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                required
                value={corpCompany}
                onChange={(e) => setCorpCompany(e.target.value)}
                placeholder="Corporate Client / Organization *"
                className="bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2"
              />
              <input
                type="text"
                value={corpContactName}
                onChange={(e) => setCorpContactName(e.target.value)}
                placeholder="Authorized Contact Person"
                className="bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2"
              />
              <input
                type="email"
                required
                value={corpContactEmail}
                onChange={(e) => setCorpContactEmail(e.target.value)}
                placeholder="Corporate Contact Email *"
                className="bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2"
              />
              <input
                type="text"
                value={corpGstin}
                onChange={(e) => setCorpGstin(e.target.value.toUpperCase())}
                placeholder="Client GSTIN (Optional)"
                className="bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2 uppercase"
              />
              <select
                value={corpProposalId}
                onChange={(e) => setCorpProposalId(e.target.value)}
                className="bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2"
              >
                <option value="">Link ERP Corporate Proposal (Optional)</option>
                {(data?.erpProposals || []).map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.proposalNumber} — {p.clientOrganization || p.clientName}
                  </option>
                ))}
              </select>
              <select
                value={corpQuotationId}
                onChange={(e) => setCorpQuotationId(e.target.value)}
                className="bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2"
              >
                <option value="">Link ERP Quotation (Optional)</option>
                {(data?.erpQuotations || []).map((q: any) => (
                  <option key={q.id} value={q.id}>
                    {q.quotationNumber} — {q.customerName}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                max={500}
                required
                value={corpQty}
                onChange={(e) => setCorpQty(e.target.value)}
                placeholder="Quantity of Cards *"
                className="bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2"
              />
              <input
                type="number"
                min={250}
                max={25000}
                required
                value={corpDenom}
                onChange={(e) => setCorpDenom(e.target.value)}
                placeholder="Denomination ₹ *"
                className="bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2"
              />
              <input
                type="number"
                min={0}
                max={30}
                step="0.5"
                value={corpDiscPct}
                onChange={(e) => setCorpDiscPct(e.target.value)}
                placeholder="Corporate Discount %"
                className="bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2"
              />
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <input
                type="text"
                value={corpMessage}
                onChange={(e) => setCorpMessage(e.target.value)}
                placeholder="Custom Co-Branded Greeting Message"
                className="flex-1 w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2"
              />
              <button
                type="submit"
                className="px-5 py-2.5 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] rounded-lg font-bold uppercase whitespace-nowrap cursor-pointer"
              >
                Create Corporate Batch
              </button>
            </div>
          </form>

          <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-serif text-lg uppercase tracking-wider">
                Corporate Gift Card Batches ({(data?.corporateBatches || []).length})
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleExport('corporate_gift_cards', 'pdf')}
                  className="px-3 py-1.5 rounded border border-[#DED7CC] bg-[#FAF8F4] text-xs font-mono cursor-pointer"
                >
                  Download PDF
                </button>
                <button
                  type="button"
                  onClick={() => handleExport('corporate_gift_cards', 'xlsx')}
                  className="px-3 py-1.5 rounded bg-[#24211D] text-[#FAF8F4] text-xs font-mono cursor-pointer"
                >
                  Download .XLSX
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="border-b border-[#DED7CC] text-[10px] uppercase text-[#686158]">
                    <th className="py-2.5 pr-3">Batch #</th>
                    <th className="py-2.5 px-2">Company</th>
                    <th className="py-2.5 px-2 text-right">Qty × Denom</th>
                    <th className="py-2.5 px-2 text-right">Net Payable</th>
                    <th className="py-2.5 px-2">Status</th>
                    <th className="py-2.5 pl-2 text-right">Finance Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1EDE5]">
                  {(data?.corporateBatches || []).map((b: any) => (
                    <tr key={b.id} className="hover:bg-[#FAF8F4]">
                      <td className="py-2.5 pr-3 font-bold">{b.batchNumber}</td>
                      <td className="py-2.5 px-2">
                        <div>{b.companyName}</div>
                        <div className="text-[10px] text-[#686158]">{b.contactEmail}</div>
                      </td>
                      <td className="py-2.5 px-2 text-right tabular-nums">
                        {b.quantity} × ₹{Number(b.denominationInr).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-2 text-right font-bold text-[#9A783E] tabular-nums">
                        ₹{Number(b.netPayableValueInr).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-2">{b.status}</td>
                      <td className="py-2.5 pl-2 text-right">
                        {b.paymentStatus !== 'PAID' ? (
                          <div className="inline-flex items-center gap-1.5">
                            <input
                              type="text"
                              value={corpPayRefMap[b.id] || ''}
                              onChange={(e) =>
                                setCorpPayRefMap((p) => ({ ...p, [b.id]: e.target.value }))
                              }
                              placeholder="NEFT / UTR Ref"
                              className="bg-[#FAF8F4] border border-[#DED7CC] rounded px-2 py-1 text-[10px] w-28"
                            />
                            <button
                              type="button"
                              onClick={() => handleApproveCorporateBatch(b.id, b.batchNumber)}
                              className="px-2.5 py-1 bg-emerald-700 text-white rounded text-[10px] font-bold uppercase cursor-pointer"
                            >
                              Verify &amp; Issue Cards
                            </button>
                          </div>
                        ) : (
                          <span className="text-emerald-700 font-bold">ISSUED ({b.paymentReference})</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          8. REFERRALS & ADVOCATE CONVERSIONS
          =================================================================== */}
      {activeSubView === 'referrals' && (
        <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-serif text-lg uppercase tracking-wider">
                Referral &amp; Advocate Conversions ({(data?.referrals || []).length})
              </h3>
              <p className="text-[11px] font-mono text-[#686158]">
                Self-referrals blocked automatically. Shared household device/IP/address signals are flagged for review rather than auto-penalized.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleExport('referral_performance', 'pdf')}
                className="px-3 py-1.5 rounded border border-[#DED7CC] bg-[#FAF8F4] text-xs font-mono cursor-pointer"
              >
                Download PDF
              </button>
              <button
                type="button"
                onClick={() => handleExport('referral_performance', 'xlsx')}
                className="px-3 py-1.5 rounded bg-[#24211D] text-[#FAF8F4] text-xs font-mono cursor-pointer"
              >
                Download .XLSX
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-[#DED7CC] text-[10px] uppercase text-[#686158]">
                  <th className="py-2.5 pr-3">Code</th>
                  <th className="py-2.5 px-2">Referrer → Referee</th>
                  <th className="py-2.5 px-2">Status</th>
                  <th className="py-2.5 px-2 text-right">Referee / Referrer ₹</th>
                  <th className="py-2.5 pl-2">Risk Signal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1EDE5]">
                {(data?.referrals || []).map((r: any) => (
                  <tr key={r.id} className="hover:bg-[#FAF8F4]">
                    <td className="py-2.5 pr-3 font-bold">{r.referralCode}</td>
                    <td className="py-2.5 px-2">
                      <div>{r.referrerEmail}</div>
                      <div className="text-[10px] text-[#686158]">→ {r.refereeEmail}</div>
                    </td>
                    <td className="py-2.5 px-2 font-bold text-[#9A783E]">{r.status}</td>
                    <td className="py-2.5 px-2 text-right tabular-nums">
                      ₹{r.refereeBenefitInr || 50} / ₹{r.referrerRewardInr || 75}
                    </td>
                    <td className="py-2.5 pl-2 text-[11px]">
                      {Array.isArray(r.riskSignals) && r.riskSignals.length > 0
                        ? r.riskSignals.join(', ')
                        : 'Clean'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================
          9. BIRTHDAY, ANNIVERSARY & OCCASION REWARDS
          =================================================================== */}
      {activeSubView === 'occasions' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-2xl p-5 space-y-3 text-xs font-mono">
              <strong className="uppercase tracking-wider block border-b border-[#DED7CC] pb-2">
                Occasion Privileges Configuration (Annual Cap &amp; Consent Verified)
              </strong>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-[10px] text-[#686158] block">Birthday Wallet Credit (₹)</span>
                  <input
                    type="number"
                    value={occasionCfgDraft.birthdayWalletCreditInr ?? 150}
                    onChange={(e) =>
                      setOccasionCfgDraft({
                        ...occasionCfgDraft,
                        birthdayWalletCreditInr: Number(e.target.value)
                      })
                    }
                    className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded px-2.5 py-1.5"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] text-[#686158] block">Anniversary Bonus Points</span>
                  <input
                    type="number"
                    value={occasionCfgDraft.anniversaryBonusPoints ?? 150}
                    onChange={(e) =>
                      setOccasionCfgDraft({
                        ...occasionCfgDraft,
                        anniversaryBonusPoints: Number(e.target.value)
                      })
                    }
                    className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded px-2.5 py-1.5"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleSaveConfigSection('occasionConfig', occasionCfgDraft, 'Occasion Rules')
                }
                className="px-4 py-2 bg-[#24211D] text-[#FAF8F4] rounded-lg font-bold uppercase cursor-pointer"
              >
                Save Occasion Rules
              </button>
            </div>

            <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-2xl p-5 space-y-3 text-xs font-mono">
              <strong className="uppercase tracking-wider block border-b border-[#DED7CC] pb-2">
                Trigger Eligibility-Verified Occasion Privilege
              </strong>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="email"
                  value={occEmail}
                  onChange={(e) => setOccEmail(e.target.value)}
                  placeholder="Patron Email *"
                  className="bg-[#FAF8F4] border border-[#DED7CC] rounded px-3 py-2"
                />
                <select
                  value={occType}
                  onChange={(e) => setOccType(e.target.value)}
                  className="bg-[#FAF8F4] border border-[#DED7CC] rounded px-3 py-2"
                >
                  <option value="BIRTHDAY">BIRTHDAY</option>
                  <option value="ANNIVERSARY">ANNIVERSARY</option>
                  <option value="FESTIVAL_VIP">FESTIVAL_VIP</option>
                </select>
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (!occEmail.trim()) return;
                  try {
                    const res = await rewardsApi.grantOccasionRewardAdmin({
                      customerEmail: occEmail.trim(),
                      occasionType: occType
                    });
                    onNotify(
                      res.granted
                        ? `Granted ${occType} privilege to ${occEmail.trim()} (Consent & stock verified).`
                        : `Skipped: ${res.reason}`
                    );
                    await loadWorkspace();
                  } catch (err: any) {
                    onNotify(`Error: ${err.message}`);
                  }
                }}
                className="px-4 py-2 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] rounded-lg font-bold uppercase cursor-pointer"
              >
                Verify Consent &amp; Grant Privilege
              </button>
            </div>
          </div>

          <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-2xl p-5 space-y-3">
            <h4 className="font-serif text-base uppercase tracking-wider">
              Occasion Grant Log ({(data?.occasionLogs || []).length})
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-[#DED7CC] text-[10px] uppercase text-[#686158]">
                    <th className="py-2">Customer</th>
                    <th className="py-2">Occasion / Year</th>
                    <th className="py-2">Reward Issued</th>
                    <th className="py-2">Stock &amp; Consent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1EDE5]">
                  {(data?.occasionLogs || []).map((o: any) => (
                    <tr key={o.id}>
                      <td className="py-2">{o.customerEmail}</td>
                      <td className="py-2">
                        {o.occasionType} ({o.grantYear})
                      </td>
                      <td className="py-2 text-[#9A783E] font-bold">
                        {o.rewardType} · {o.amountOrPoints}
                      </td>
                      <td className="py-2 text-[11px] text-[#686158]">
                        Consent: {o.consentVerified ? 'Verified' : 'No'} · Stock:{' '}
                        {o.sampleStockVerified ? 'Verified' : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          10. CAMPAIGNS & LIFECYCLE PROMOTIONS (ALL 11 LUXURY TEMPLATES)
          =================================================================== */}
      {activeSubView === 'campaigns' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-[#FFFFFF] border border-[#DED7CC] rounded-2xl p-5">
            <div>
              <h3 className="font-serif text-lg uppercase tracking-wider">
                Luxury Lifecycle Reward Automation Templates (11 Triggers)
              </h3>
              <p className="text-xs text-[#686158]">
                Crafted for FRAGMORÉ’s luxury-first positioning — zero habitual discount spam; prioritizes discovery samples, value-add gifts, and private previews.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleExport('campaign_reward_roi', 'xlsx')}
              className="px-4 py-2 bg-[#24211D] text-[#FAF8F4] rounded-lg text-xs font-mono uppercase cursor-pointer"
            >
              Export Campaign ROI .XLSX
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(data?.campaignTemplates || []).map((tpl: any) => (
              <div
                key={tpl.triggerKey}
                className="bg-[#FFFFFF] border border-[#DED7CC] rounded-2xl p-5 space-y-2.5 flex flex-col justify-between"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-mono uppercase text-[#9A783E]">
                    <span>{tpl.triggerKey}</span>
                    <span>{(tpl.channels || []).join(' · ') || tpl.channel || 'EMAIL · WHATSAPP'}</span>
                  </div>
                  <h4 className="font-serif text-base uppercase text-[#24211D]">{tpl.title || tpl.name}</h4>
                  <p className="text-xs font-mono text-[#24211D]">{tpl.subjectLine}</p>
                  <p className="text-xs text-[#686158] leading-relaxed">{tpl.previewCopy || tpl.messagePreview}</p>
                </div>
                <div className="pt-2 border-t border-[#F1EDE5] flex justify-end">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await rewardsApi.launchRewardsCampaignAdmin({
                          triggerKey: tpl.triggerKey,
                          name: tpl.title || tpl.name,
                          subjectLine: tpl.subjectLine,
                          messagePreview: tpl.previewCopy || tpl.messagePreview
                        });
                        onNotify(`Activated "${tpl.title || tpl.name}" in Omnichannel Marketing Campaigns.`);
                      } catch (err: any) {
                        onNotify(`Error: ${err.message}`);
                      }
                    }}
                    className="px-3.5 py-1.5 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] rounded-lg text-[11px] font-mono uppercase cursor-pointer"
                  >
                    Sync &amp; Activate Trigger
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================
          11. CHECKOUT REDEMPTION STACKING RULES
          =================================================================== */}
      {activeSubView === 'redemption_rules' && (
        <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-2xl p-6 space-y-5 max-w-3xl text-xs font-mono">
          <div className="border-b border-[#DED7CC] pb-3">
            <h3 className="font-serif text-lg uppercase tracking-wider">
              Checkout Stacking &amp; Pre-Tax Cap Governance
            </h3>
            <p className="text-[#686158] font-sans mt-1">
              Controls how Coupons, Promotional Wallet Credits, Refund Store Credits, Loyalty Points, and Gift Cards combine at checkout.
            </p>
          </div>

          <div className="space-y-2.5">
            {[
              { key: 'allowCouponWithLoyalty', label: 'Allow Coupon Code + Loyalty Points stacking' },
              {
                key: 'allowCouponWithPromoWallet',
                label: 'Allow Coupon Code + Promotional Wallet Credit stacking'
              },
              { key: 'allowWalletWithLoyalty', label: 'Allow Wallet Credits + Loyalty Points together' },
              { key: 'allowWalletWithGiftCard', label: 'Allow Wallet Credits + Gift Card tender together' },
              { key: 'allowLoyaltyWithGiftCard', label: 'Allow Loyalty Points + Gift Card tender together' }
            ].map((rule) => (
              <label
                key={rule.key}
                className="flex items-center justify-between p-3 rounded-xl bg-[#FAF8F4] border border-[#DED7CC] cursor-pointer"
              >
                <span>{rule.label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(checkoutDraft[rule.key])}
                  onChange={(e) =>
                    setCheckoutDraft({ ...checkoutDraft, [rule.key]: e.target.checked })
                  }
                  className="accent-[#9A783E] w-4 h-4"
                />
              </label>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="space-y-1">
              <span className="text-[#686158] block">Max Combined Pre-Tax Promotional Reduction (%)</span>
              <input
                type="number"
                min={5}
                max={80}
                value={checkoutDraft.maxCombinedPreTaxDiscountPct ?? 35}
                onChange={(e) =>
                  setCheckoutDraft({
                    ...checkoutDraft,
                    maxCombinedPreTaxDiscountPct: Number(e.target.value)
                  })
                }
                className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[#686158] block">Checkout Reservation Lock Window (Minutes)</span>
              <input
                type="number"
                min={5}
                max={60}
                value={checkoutDraft.reservationExpiryMinutes ?? 20}
                onChange={(e) =>
                  setCheckoutDraft({
                    ...checkoutDraft,
                    reservationExpiryMinutes: Number(e.target.value)
                  })
                }
                className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={() =>
              handleSaveConfigSection('checkoutRulesConfig', checkoutDraft, 'Checkout Stacking Rules')
            }
            className="px-5 py-2.5 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] rounded-lg font-bold uppercase cursor-pointer"
          >
            Save Redemption Rules
          </button>
        </div>
      )}

      {/* ===================================================================
          12. FRAUD & RISK REVIEW QUEUE
          =================================================================== */}
      {activeSubView === 'fraud_risk' && (
        <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-2xl p-5 space-y-4">
          <div>
            <h3 className="font-serif text-lg uppercase tracking-wider">
              Anti-Abuse, Brute-Force &amp; Household Shared-Signal Review ({(data?.fraudFlags || []).length})
            </h3>
            <p className="text-xs text-[#686158]">
              Invalid gift card brute-force attempts (5+/10m) are rate-limited automatically. Shared household Wi-Fi/address referrals are held for human review rather than unfairly auto-blocking families.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-[#DED7CC] text-[10px] uppercase text-[#686158]">
                  <th className="py-2.5 pr-3">Flag Type / Severity</th>
                  <th className="py-2.5 px-2">Subject</th>
                  <th className="py-2.5 px-2">Details</th>
                  <th className="py-2.5 px-2">Status</th>
                  <th className="py-2.5 pl-2 text-right">Resolution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1EDE5]">
                {(data?.fraudFlags || []).map((f: any) => (
                  <tr key={f.id} className="hover:bg-[#FAF8F4]">
                    <td className="py-2.5 pr-3">
                      <div className="font-bold text-rose-800">{f.flagType}</div>
                      <div className="text-[10px] text-[#686158]">Severity: {f.severity}</div>
                    </td>
                    <td className="py-2.5 px-2">{f.customerEmail || f.ipAddress || 'Anon'}</td>
                    <td className="py-2.5 px-2 max-w-xs">{f.reason}</td>
                    <td className="py-2.5 px-2 font-bold">{f.status}</td>
                    <td className="py-2.5 pl-2 text-right">
                      {f.status === 'OPEN_REVIEW' ? (
                        <div className="inline-flex items-center gap-1.5">
                          <input
                            type="text"
                            value={fraudNotesMap[f.id] || ''}
                            onChange={(e) =>
                              setFraudNotesMap((p) => ({ ...p, [f.id]: e.target.value }))
                            }
                            placeholder="Review notes *"
                            className="bg-[#FAF8F4] border border-[#DED7CC] rounded px-2 py-1 text-[10px] w-32"
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await rewardsApi.resolveFraudFlagAdmin(
                                  f.id,
                                  'CLEARED_LEGITIMATE_HOUSEHOLD',
                                  fraudNotesMap[f.id] || 'Verified legitimate household customer'
                                );
                                onNotify('Cleared flag as legitimate household.');
                                await loadWorkspace();
                              } catch (err: any) {
                                onNotify(`Error: ${err.message}`);
                              }
                            }}
                            className="px-2 py-1 bg-emerald-700 text-white rounded text-[10px] cursor-pointer"
                          >
                            Approve Household
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await rewardsApi.resolveFraudFlagAdmin(
                                  f.id,
                                  'CONFIRMED_BLOCKED',
                                  fraudNotesMap[f.id] || 'Confirmed policy abuse'
                                );
                                onNotify('Confirmed block on flagged activity.');
                                await loadWorkspace();
                              } catch (err: any) {
                                onNotify(`Error: ${err.message}`);
                              }
                            }}
                            className="px-2 py-1 bg-rose-700 text-white rounded text-[10px] cursor-pointer"
                          >
                            Block
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-[#686158]">{f.resolutionNotes || 'Resolved'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================
          13. REPORTS, EXPORTS & DOUBLE-ENTRY GL ACCOUNTING HUB
          =================================================================== */}
      {activeSubView === 'reports' && (
        <div className="space-y-6">
          {/* Date Filter Bar + 9 Statements Export Grid */}
          <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DED7CC] pb-3">
              <div>
                <h3 className="font-serif text-lg uppercase tracking-wider">
                  Official Branded PDF &amp; Typed Excel (.XLSX) Statements (All 9 Ledgers)
                </h3>
                <p className="text-xs text-[#686158]">
                  Genuine multi-sheet ExcelJS workbooks with formulas &amp; PDFKit statements with masked gift card codes.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="bg-[#FAF8F4] border border-[#DED7CC] rounded px-2.5 py-1.5"
                />
                <span>to</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="bg-[#FAF8F4] border border-[#DED7CC] rounded px-2.5 py-1.5"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {REPORT_CATALOG.map((rep) => (
                <div
                  key={rep.key}
                  className="p-4 rounded-xl bg-[#FAF8F4] border border-[#DED7CC] flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono uppercase text-[#9A783E] font-bold">
                      {rep.glNote}
                    </span>
                    <h4 className="font-serif text-sm uppercase text-[#24211D] font-semibold">
                      {rep.title}
                    </h4>
                    <p className="text-[11px] text-[#686158] leading-relaxed">{rep.subtitle}</p>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-[#DED7CC]">
                    <button
                      type="button"
                      disabled={exportingKey === `${rep.key}_pdf`}
                      onClick={() => handleExport(rep.key, 'pdf')}
                      className="flex-1 py-1.5 rounded border border-[#DED7CC] bg-[#FFFFFF] hover:border-[#9A783E] text-[11px] font-mono font-semibold cursor-pointer"
                    >
                      {exportingKey === `${rep.key}_pdf` ? 'Generating...' : 'Download PDF'}
                    </button>
                    <button
                      type="button"
                      disabled={exportingKey === `${rep.key}_xlsx`}
                      onClick={() => handleExport(rep.key, 'xlsx')}
                      className="flex-1 py-1.5 rounded bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-[11px] font-mono font-semibold cursor-pointer"
                    >
                      {exportingKey === `${rep.key}_xlsx` ? 'Generating...' : 'Download .XLSX'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Accountant Breakage Recognition Staging */}
          <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-2xl p-5 space-y-3 text-xs font-mono">
            <strong className="uppercase tracking-wider block">
              Accountant-Approved Gift Card Breakage Recognition (GL 2310 → GL 4310)
            </strong>
            <p className="text-[#686158] font-sans">
              Expired gift card balances are never silently recognized as revenue. Submit an audited breakage journal proposal for dual-control Finance Controller / Super Admin approval.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="number"
                min={1}
                value={breakageAmount}
                onChange={(e) => setBreakageAmount(e.target.value)}
                placeholder="Breakage Amount ₹"
                className="bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2 w-44"
              />
              <input
                type="text"
                value={breakageReason}
                onChange={(e) => setBreakageReason(e.target.value)}
                placeholder="Statutory accounting citation & aged schedule ref *"
                className="flex-1 bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2"
              />
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await rewardsApi.createApprovalRequestAdmin({
                      actionType: 'BREAKAGE_RECOGNITION',
                      amountInr: Number(breakageAmount) || 0,
                      reason: breakageReason
                    });
                    onNotify(
                      `Breakage journal proposal ${res.approval?.approvalNumber} queued in Dual-Control Approvals.`
                    );
                    await loadWorkspace();
                  } catch (err: any) {
                    onNotify(`Error: ${err.message}`);
                  }
                }}
                className="px-4 py-2 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] rounded-lg font-bold uppercase cursor-pointer"
              >
                Stage Breakage Journal
              </button>
            </div>
          </div>

          {/* Double-Entry GL Journals Table */}
          <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-2xl p-5 space-y-3">
            <h4 className="font-serif text-base uppercase tracking-wider flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#9A783E]" />
              <span>Posted Double-Entry GL Liability &amp; Redemption Journals ({(data?.glJournals || []).length})</span>
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="border-b border-[#DED7CC] text-[10px] uppercase text-[#686158]">
                    <th className="py-2 pr-3">Journal #</th>
                    <th className="py-2 px-2">Module</th>
                    <th className="py-2 px-2">Narration</th>
                    <th className="py-2 px-2 text-right">Debit (₹)</th>
                    <th className="py-2 pl-2 text-right">Credit (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1EDE5]">
                  {(data?.glJournals || []).map((j: any) => (
                    <tr key={j.id} className="hover:bg-[#FAF8F4]">
                      <td className="py-2 pr-3 font-bold">{j.journalNumber}</td>
                      <td className="py-2 px-2 text-[#9A783E]">{j.sourceModule}</td>
                      <td className="py-2 px-2">{j.narration}</td>
                      <td className="py-2 px-2 text-right tabular-nums">
                        ₹{Number(j.totalDebit || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2 pl-2 text-right tabular-nums">
                        ₹{Number(j.totalCredit || 0).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          14. SETTINGS & CLOSED-LOOP REGULATORY COMPLIANCE GUARDRAILS
          =================================================================== */}
      {activeSubView === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs font-mono">
          {/* Closed-Loop Regulatory Guardrails (Permanently Locked) */}
          <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-[#DED7CC] pb-3">
              <Lock className="w-4 h-4 text-[#9A783E]" />
              <strong className="uppercase tracking-wider">
                Closed-Loop Store Credit Legal Guardrails (Immutable)
              </strong>
            </div>
            <p className="text-[#686158] font-sans leading-relaxed">
              FRAGMORÉ Wallet operates strictly as a closed-loop brand store credit ledger redeemable solely for FRAGMORÉ merchandise and services. Semi-closed PPI banking features are permanently disabled at the database and API layers.
            </p>
            <div className="space-y-2">
              {[
                'Bank / UPI Cash Withdrawal: PERMANENTLY DISABLED',
                'Peer-to-Peer Wallet Transfer: PERMANENTLY DISABLED',
                'Open Public Cash Top-Up: PERMANENTLY DISABLED',
                'Gift Card Issuance Revenue Recognition: DEFERRED TO GL 2310 UNTIL REDEMPTION',
                'Return Refund to Wallet: REQUIRES EXPLICIT CUSTOMER OPT-IN'
              ].map((item) => (
                <div
                  key={item}
                  className="p-2.5 rounded-lg bg-[#FAF8F4] border border-[#DED7CC] flex items-center justify-between"
                >
                  <span>{item}</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                </div>
              ))}
            </div>
          </div>

          {/* Loyalty & Wallet Parameters */}
          <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-[#DED7CC] pb-3">
              <Sliders className="w-4 h-4 text-[#9A783E]" />
              <strong className="uppercase tracking-wider">
                Loyalty Earn / Maturation &amp; Gift Card Parameters
              </strong>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="text-[10px] text-[#686158] block">Points Earned per ₹100</span>
                <input
                  type="number"
                  value={loyaltyCfgDraft.pointsPer100Inr ?? 5}
                  onChange={(e) =>
                    setLoyaltyCfgDraft({
                      ...loyaltyCfgDraft,
                      pointsPer100Inr: Number(e.target.value)
                    })
                  }
                  className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded px-2.5 py-1.5"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] text-[#686158] block">Return-Window Hold (Days)</span>
                <input
                  type="number"
                  value={loyaltyCfgDraft.returnWindowHoldDays ?? 7}
                  onChange={(e) =>
                    setLoyaltyCfgDraft({
                      ...loyaltyCfgDraft,
                      returnWindowHoldDays: Number(e.target.value)
                    })
                  }
                  className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded px-2.5 py-1.5"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] text-[#686158] block">Min Custom Gift Card (₹)</span>
                <input
                  type="number"
                  value={giftCardCfgDraft.customMinInr ?? 250}
                  onChange={(e) =>
                    setGiftCardCfgDraft({
                      ...giftCardCfgDraft,
                      customMinInr: Number(e.target.value)
                    })
                  }
                  className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded px-2.5 py-1.5"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] text-[#686158] block">Max Custom Gift Card (₹)</span>
                <input
                  type="number"
                  value={giftCardCfgDraft.customMaxInr ?? 25000}
                  onChange={(e) =>
                    setGiftCardCfgDraft({
                      ...giftCardCfgDraft,
                      customMaxInr: Number(e.target.value)
                    })
                  }
                  className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded px-2.5 py-1.5"
                />
              </label>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() =>
                  handleSaveConfigSection('loyaltyConfig', loyaltyCfgDraft, 'Loyalty Parameters')
                }
                className="px-4 py-2 bg-[#24211D] text-[#FAF8F4] rounded-lg font-bold uppercase cursor-pointer"
              >
                Save Loyalty Config
              </button>
              <button
                type="button"
                onClick={() =>
                  handleSaveConfigSection('giftCardConfig', giftCardCfgDraft, 'Gift Card Parameters')
                }
                className="px-4 py-2 border border-[#24211D] text-[#24211D] rounded-lg font-bold uppercase cursor-pointer"
              >
                Save Gift Card Config
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          15. DUAL-CONTROL APPROVALS & IMMUTABLE AUDIT LOGS
          =================================================================== */}
      {activeSubView === 'audit_logs' && (
        <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-2xl p-5 space-y-4">
          <div>
            <h3 className="font-serif text-lg uppercase tracking-wider">
              Dual-Control Adjustment Approvals &amp; Governance Trail ({(data?.approvals || []).length})
            </h3>
            <p className="text-xs text-[#686158]">
              Customer Support goodwill proposals, AI-staged reward actions, and Accountant breakage journals require explicit Super Admin or Finance Controller sign-off.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-[#DED7CC] text-[10px] uppercase text-[#686158]">
                  <th className="py-2.5 pr-3">Approval #</th>
                  <th className="py-2.5 px-2">Source / Action</th>
                  <th className="py-2.5 px-2">Target &amp; Value</th>
                  <th className="py-2.5 px-2">Reason</th>
                  <th className="py-2.5 px-2">Status</th>
                  <th className="py-2.5 pl-2 text-right">Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1EDE5]">
                {(data?.approvals || []).map((ap: any) => (
                  <tr key={ap.id} className="hover:bg-[#FAF8F4]">
                    <td className="py-2.5 pr-3 font-bold">{ap.approvalNumber}</td>
                    <td className="py-2.5 px-2">
                      <div>{ap.actionType}</div>
                      <div className="text-[10px] text-[#686158]">{ap.requestSource}</div>
                    </td>
                    <td className="py-2.5 px-2">
                      <div>{ap.targetCustomerEmail || 'GL Ledger'}</div>
                      <div className="text-[#9A783E] font-bold">
                        {ap.amountInr ? `₹${ap.amountInr}` : `${ap.pointsDelta || 0} pts`}
                      </div>
                    </td>
                    <td className="py-2.5 px-2 max-w-xs">{ap.reason}</td>
                    <td className="py-2.5 px-2 font-bold">{ap.status}</td>
                    <td className="py-2.5 pl-2 text-right">
                      {ap.status === 'PENDING_APPROVAL' ? (
                        <div className="inline-flex items-center gap-1.5">
                          <input
                            type="text"
                            value={approvalNotesMap[ap.id] || ''}
                            onChange={(e) =>
                              setApprovalNotesMap((p) => ({ ...p, [ap.id]: e.target.value }))
                            }
                            placeholder="Decision note"
                            className="bg-[#FAF8F4] border border-[#DED7CC] rounded px-2 py-1 text-[10px] w-28"
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await rewardsApi.decideApprovalRequestAdmin(
                                  ap.id,
                                  'APPROVE',
                                  approvalNotesMap[ap.id] || 'Approved & executed'
                                );
                                onNotify(`Approved & executed ${ap.approvalNumber}.`);
                                await loadWorkspace();
                              } catch (err: any) {
                                onNotify(`Error: ${err.message}`);
                              }
                            }}
                            className="px-2 py-1 bg-emerald-700 text-white rounded text-[10px] font-bold cursor-pointer"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await rewardsApi.decideApprovalRequestAdmin(
                                  ap.id,
                                  'REJECT',
                                  approvalNotesMap[ap.id] || 'Rejected by controller'
                                );
                                onNotify(`Rejected ${ap.approvalNumber}.`);
                                await loadWorkspace();
                              } catch (err: any) {
                                onNotify(`Error: ${err.message}`);
                              }
                            }}
                            className="px-2 py-1 bg-rose-700 text-white rounded text-[10px] font-bold cursor-pointer"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-[#686158]">
                          {ap.decidedByEmail || 'Completed'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
