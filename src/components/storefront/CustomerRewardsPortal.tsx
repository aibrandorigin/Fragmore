import React, { useState, useEffect, useCallback } from 'react';
import { rewardsApi } from '../../lib/rewardsApi';
import {
  Wallet,
  Award,
  Gift,
  Share2,
  History,
  Download,
  Copy,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Clock,
  ArrowRight,
  Lock,
  Search,
  Send
} from 'lucide-react';

export type CustomerRewardsSubTab = 'wallet' | 'privileges' | 'gift_cards' | 'referrals' | 'rewards_history';

interface CustomerRewardsPortalProps {
  activeSubTab: CustomerRewardsSubTab;
  customerEmail: string;
  customerId?: string;
  customerName?: string;
  onNavigateGiftStore: () => void;
  onNotify: (msg: string) => void;
}

const FRAGRANCE_FAMILIES = [
  'Woody & Oud',
  'Amber & Oriental',
  'Floral & Rose',
  'Fresh Citrus & Marine',
  'Warm Gourmand & Vanilla',
  'Sacred Sandalwood & Incense'
];

export const CustomerRewardsPortal: React.FC<CustomerRewardsPortalProps> = ({
  activeSubTab,
  customerEmail,
  customerId,
  onNavigateGiftStore,
  onNotify
}) => {
  const [snapshot, setSnapshot] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Preferences state
  const [birthday, setBirthday] = useState<string>('');
  const [anniversary, setAnniversary] = useState<string>('');
  const [preferredFamily, setPreferredFamily] = useState<string>('');
  const [promoOptIn, setPromoOptIn] = useState<boolean>(true);
  const [savingPrefs, setSavingPrefs] = useState<boolean>(false);

  // Gift card claim / balance inquiry
  const [claimCode, setClaimCode] = useState<string>('');
  const [claiming, setClaiming] = useState<boolean>(false);
  const [balanceCheckCode, setBalanceCheckCode] = useState<string>('');
  const [checkedCard, setCheckedCard] = useState<any | null>(null);

  // Referral code apply
  const [friendRefCode, setFriendRefCode] = useState<string>('');
  const [applyingRef, setApplyingRef] = useState<boolean>(false);

  // AI Concierge
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [aiReply, setAiReply] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);

  const loadPortal = useCallback(async () => {
    if (!customerEmail) return;
    setLoading(true);
    setError(null);
    try {
      const data = await rewardsApi.getCustomerPortal(customerEmail);
      setSnapshot(data);
      if (data?.loyalty) {
        setBirthday(data.loyalty.birthday || '');
        setAnniversary(data.loyalty.anniversary || '');
        setPreferredFamily(data.loyalty.preferredFragranceFamily || '');
        setPromoOptIn(data.loyalty.promoOptIn !== false);
      }
    } catch (err: any) {
      setError(err.message || 'Unable to load FRAGMORÉ Wallet & Privileges.');
    } finally {
      setLoading(false);
    }
  }, [customerEmail]);

  useEffect(() => {
    loadPortal();
  }, [loadPortal]);

  const handleSaveOccasionPreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPrefs(true);
    try {
      await rewardsApi.updateCustomerPreferences(customerEmail, {
        birthday: birthday || null,
        anniversary: anniversary || null,
        preferredFragranceFamily: preferredFamily || null,
        promoOptIn
      });
      onNotify('Occasion & fragrance preferences saved to FRAGMORÉ Privileges.');
      await loadPortal();
    } catch (err: any) {
      onNotify(err.message);
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleClaimGiftCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimCode.trim()) return;
    setClaiming(true);
    try {
      const res = await rewardsApi.claimGiftCard(claimCode.trim(), customerEmail, customerId);
      setClaimCode('');
      onNotify(`Gift Card ${res.giftCard.cardNumber} claimed! Available: ₹${res.giftCard.remainingBalanceInr}`);
      await loadPortal();
    } catch (err: any) {
      onNotify(err.message);
    } finally {
      setClaiming(false);
    }
  };

  const handleVerifyGiftCardBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!balanceCheckCode.trim()) return;
    try {
      const res = await rewardsApi.inquireGiftCardBalance(balanceCheckCode.trim(), customerEmail);
      setCheckedCard(res.giftCard);
    } catch (err: any) {
      onNotify(err.message);
    }
  };

  const handleApplyReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendRefCode.trim()) return;
    setApplyingRef(true);
    try {
      await rewardsApi.applyReferralCode(customerEmail, friendRefCode.trim(), undefined, customerId);
      setFriendRefCode('');
      onNotify('Referral invitation linked! Complete your qualifying first order to unlock your privilege.');
      await loadPortal();
    } catch (err: any) {
      onNotify(err.message);
    } finally {
      setApplyingRef(false);
    }
  };

  const handleAskConcierge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const res = await rewardsApi.askAiRewardsAssistant(aiPrompt.trim(), 'customer', customerEmail);
      setAiReply(res.reply);
    } catch (err: any) {
      onNotify(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  if (loading && !snapshot) {
    return (
      <div className="p-12 bg-[#121218] border border-white/10 rounded-2xl text-center font-mono text-xs text-white/60">
        Synchronizing your FRAGMORÉ Wallet, Privileges &amp; Gift Card ledger...
      </div>
    );
  }

  if (error || !snapshot) {
    return (
      <div className="p-8 bg-[#121218] border border-rose-500/30 rounded-2xl text-center space-y-3 font-mono text-xs">
        <div className="text-rose-300">{error || 'Unable to load portal'}</div>
        <button
          type="button"
          onClick={loadPortal}
          className="px-4 py-2 rounded bg-[#D4AF37] text-[#08080A] font-semibold uppercase cursor-pointer"
        >
          Retry Sync
        </button>
      </div>
    );
  }

  const { wallet, walletBuckets, walletTransactions, loyalty, tiers, pointsLedger, giftCards, giftCardTransactions, referrals, occasionGrants } =
    snapshot;

  // ==========================================================================
  // SUB-TAB 1: MY WALLET (CLOSED-LOOP BRAND STORE CREDIT)
  // ==========================================================================
  if (activeSubTab === 'wallet') {
    return (
      <div className="space-y-6">
        {/* Top KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="p-5 bg-[#121218] border border-[#D4AF37]/40 rounded-xl space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#D4AF37] block">
              Available Wallet Balance
            </span>
            <div className="font-serif text-3xl text-white tabular-nums">
              ₹{Number(wallet.totalAvailableInr || 0).toLocaleString('en-IN')}
            </div>
            <span className="text-[11px] font-mono text-white/50 block">Redeemable on fragmore.shop</span>
          </div>

          <div className="p-5 bg-[#121218] border border-white/10 rounded-xl space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-widest text-white/50 block">
              Pending Rewards
            </span>
            <div className="font-mono text-xl font-semibold text-white tabular-nums">
              ₹{Number(wallet.pendingCreditsInr || 0).toLocaleString('en-IN')}
            </div>
            <span className="text-[11px] font-mono text-white/40 block">Maturing post return-window</span>
          </div>

          <div className="p-5 bg-[#121218] border border-white/10 rounded-xl space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-widest text-white/50 block">
              Total Credits Received
            </span>
            <div className="font-mono text-xl font-semibold text-emerald-400 tabular-nums">
              ₹{Number(wallet.totalReceivedInr || 0).toLocaleString('en-IN')}
            </div>
            <span className="text-[11px] font-mono text-white/40 block">Lifetime credited</span>
          </div>

          <div className="p-5 bg-[#121218] border border-white/10 rounded-xl space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-widest text-white/50 block">
              Total Redeemed
            </span>
            <div className="font-mono text-xl font-semibold text-white tabular-nums">
              ₹{Number(wallet.totalRedeemedInr || 0).toLocaleString('en-IN')}
            </div>
            <span className="text-[11px] font-mono text-white/40 block">Applied at checkout</span>
          </div>

          <div className="p-5 bg-[#121218] border border-white/10 rounded-xl space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-widest text-amber-300 block">
              Expiring in 30 Days
            </span>
            <div className="font-mono text-xl font-semibold text-amber-300 tabular-nums">
              ₹{Number(wallet.expiringWithin30DaysInr || 0).toLocaleString('en-IN')}
            </div>
            <span className="text-[11px] font-mono text-white/40 block">Promotional buckets</span>
          </div>
        </div>

        {/* Sub-Ledger Breakdown + Export Controls */}
        <div className="bg-[#121218] border border-white/10 rounded-xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <h3 className="font-serif text-lg uppercase tracking-wider text-white">
                Credit Sub-Ledgers &amp; Statement Export
              </h3>
              <p className="text-xs text-white/50 font-mono mt-0.5">
                Credits consume automatically in earliest-expiry order at checkout.
              </p>
            </div>
            <div className="flex items-center gap-2 font-mono text-xs">
              <button
                type="button"
                onClick={() => rewardsApi.downloadCustomerStatement(customerEmail, 'wallet_statement', 'pdf')}
                className="px-3.5 py-2 rounded-lg border border-[#D4AF37]/50 text-[#E5C378] hover:bg-[#D4AF37]/10 flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>PDF Statement</span>
              </button>
              <button
                type="button"
                onClick={() => rewardsApi.downloadCustomerStatement(customerEmail, 'wallet_statement', 'xlsx')}
                className="px-3.5 py-2 rounded-lg border border-white/20 text-white hover:border-[#D4AF37] flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Excel (.xlsx)</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs font-mono">
            {[
              { label: 'Refund Store Credit', val: wallet.availableRefundInr },
              { label: 'Promotional Credit', val: wallet.availablePromoInr },
              { label: 'Cashback Rewards', val: wallet.availableCashbackInr },
              { label: 'Concierge Goodwill', val: wallet.availableGoodwillInr },
              { label: 'Referral Rewards', val: wallet.availableReferralInr }
            ].map((b) => (
              <div key={b.label} className="p-3.5 rounded-xl bg-[#08080A] border border-white/10">
                <div className="text-[10px] text-white/50 uppercase">{b.label}</div>
                <div className="text-sm font-semibold text-white mt-1 tabular-nums">
                  ₹{Number(b.val || 0).toLocaleString('en-IN')}
                </div>
              </div>
            ))}
          </div>

          {/* Active Credit Buckets */}
          {walletBuckets.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-white/50 uppercase text-[10px]">
                    <th className="py-2.5">Credit Bucket</th>
                    <th className="py-2.5">Reason / Source</th>
                    <th className="py-2.5">Remaining</th>
                    <th className="py-2.5">Min Order</th>
                    <th className="py-2.5">Expiry</th>
                    <th className="py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {walletBuckets.map((b: any) => (
                    <tr key={b.id}>
                      <td className="py-2.5 text-[#D4AF37]">{b.creditType}</td>
                      <td className="py-2.5 text-white/80">{b.reason}</td>
                      <td className="py-2.5 font-semibold text-white tabular-nums">
                        ₹{Number(b.remainingAmountInr || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 text-white/60 tabular-nums">
                        ₹{Number(b.minOrderValueInr || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 text-white/60">
                        {b.expiresAt ? new Date(b.expiresAt).toLocaleDateString('en-IN') : 'No Expiry'}
                      </td>
                      <td className="py-2.5 text-white/80">{b.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Transaction History */}
        <div className="bg-[#121218] border border-white/10 rounded-xl p-6 space-y-4">
          <h3 className="font-serif text-lg uppercase tracking-wider text-white">
            Wallet Transaction History
          </h3>
          {walletTransactions.length === 0 ? (
            <p className="text-xs font-mono text-white/50 py-6 text-center">
              No wallet credit movements recorded yet. Earn referral privileges, occasion credits, or opt-in refund
              credits here.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-white/50 uppercase text-[10px]">
                    <th className="py-2.5">Reference ID</th>
                    <th className="py-2.5">Date</th>
                    <th className="py-2.5">Type</th>
                    <th className="py-2.5">Details</th>
                    <th className="py-2.5 text-right">Amount</th>
                    <th className="py-2.5 text-right">Closing Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {walletTransactions.map((tx: any) => (
                    <tr key={tx.id}>
                      <td className="py-3 text-[#D4AF37]">{tx.referenceNumber}</td>
                      <td className="py-3 text-white/60">{new Date(tx.createdAt).toLocaleDateString('en-IN')}</td>
                      <td className="py-3 text-white/80">{tx.txnType}</td>
                      <td className="py-3 text-white/70 max-w-xs truncate">{tx.reason}</td>
                      <td
                        className={`py-3 text-right font-semibold tabular-nums ${
                          tx.direction === 'CREDIT' ? 'text-emerald-400' : 'text-rose-300'
                        }`}
                      >
                        {tx.direction === 'CREDIT' ? '+' : '-'}₹{Number(tx.amountInr || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 text-right text-white tabular-nums">
                        ₹{Number(tx.availableBalanceAfterInr || 0).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Closed-Loop Wallet Terms & Conditions */}
        <div className="p-5 rounded-xl bg-[#0D0D12] border border-white/10 space-y-2 text-xs font-mono text-white/60">
          <div className="flex items-center gap-2 text-[#D4AF37] uppercase tracking-wider font-semibold">
            <Lock className="w-3.5 h-3.5" />
            <span>FRAGMORÉ Closed-Loop Brand Store Credit Terms</span>
          </div>
          <p className="leading-relaxed">
            FRAGMORÉ Wallet credits are closed-loop promotional and opt-in refund store credits redeemable solely
            toward eligible FRAGMORÉ creations on fragmore.shop. Wallet credits are not a bank deposit or cash-equivalent
            prepaid instrument: bank/UPI withdrawals, cash redemptions, peer-to-peer transfers, and open cash top-ups
            are permanently disabled. If a checkout payment fails or an order is cancelled, any applied wallet credits
            are automatically restored.
          </p>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // SUB-TAB 2: FRAGMORÉ PRIVILEGES (LOYALTY POINTS, VIP TIERS & OCCASIONS)
  // ==========================================================================
  if (activeSubTab === 'privileges') {
    const loyCfg = snapshot.config?.loyaltyConfig || {};
    const rupeePerUnit = Number(loyCfg.redeemRupeePerUnitInr) || 10;
    const ptsUnit = Number(loyCfg.redeemPointsUnit) || 100;
    const rupeeValue = Math.round(((Number(loyalty.availablePoints) || 0) / ptsUnit) * rupeePerUnit);

    return (
      <div className="space-y-6">
        {/* Active Tier & Points Banner */}
        <div className="bg-gradient-to-br from-[#16151C] via-[#121218] to-[#1D1912] border border-[#D4AF37]/40 rounded-2xl p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.25em] text-[#D4AF37]">
              <Award className="w-4 h-4" />
              <span>FRAGMORÉ Privileges · {loyalty.memberNumber}</span>
            </div>
            <h2 className="font-serif text-3xl uppercase tracking-widest text-white">
              {loyalty.currentTier?.tierName || loyalty.tierCode} Circle
            </h2>
            <p className="text-xs text-white/70 leading-relaxed max-w-xl">
              {loyalty.currentTier?.tagline ||
                'Earn house points on every retained fragrance purchase and unlock curated Atelier benefits.'}
            </p>
            <div className="pt-2 space-y-1.5 font-mono text-xs">
              <div className="flex justify-between text-white/70">
                <span>
                  Retained Qualifying Spend:{' '}
                  <strong className="text-white tabular-nums">
                    ₹{Number(loyalty.qualifyingNetSpendInr || 0).toLocaleString('en-IN')}
                  </strong>
                </span>
                {loyalty.nextTier ? (
                  <span className="text-[#D4AF37] tabular-nums">
                    ₹{Number(loyalty.spendToNextTierInr || 0).toLocaleString('en-IN')} to {loyalty.nextTier.tierName}
                  </span>
                ) : (
                  <span className="text-emerald-400">Highest House Circle Achieved</span>
                )}
              </div>
              {loyalty.nextTier && (
                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-[#D4AF37]"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(
                          ((Number(loyalty.qualifyingNetSpendInr) || 0) /
                            Math.max(1, Number(loyalty.nextTier.minQualifyingSpendInr))) *
                            100
                        )
                      )}%`
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-5 grid grid-cols-2 gap-3 font-mono">
            <div className="p-4 rounded-xl bg-[#08080A] border border-white/10">
              <span className="text-[10px] text-white/50 uppercase block">Available Points</span>
              <div className="text-2xl font-bold text-[#D4AF37] mt-1 tabular-nums">
                {Number(loyalty.availablePoints || 0).toLocaleString('en-IN')}
              </div>
              <span className="text-[11px] text-white/60 tabular-nums">Worth ₹{rupeeValue.toLocaleString('en-IN')}</span>
            </div>
            <div className="p-4 rounded-xl bg-[#08080A] border border-white/10">
              <span className="text-[10px] text-white/50 uppercase block">Pending Hold</span>
              <div className="text-2xl font-bold text-white mt-1 tabular-nums">
                {Number(loyalty.pendingPoints || 0).toLocaleString('en-IN')}
              </div>
              <span className="text-[11px] text-white/50">7-day return window</span>
            </div>
            <div className="col-span-2 flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => rewardsApi.downloadCustomerStatement(customerEmail, 'loyalty_ledger', 'pdf')}
                className="flex-1 py-2 rounded-lg border border-[#D4AF37]/40 text-[#E5C378] text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>PDF Ledger</span>
              </button>
              <button
                type="button"
                onClick={() => rewardsApi.downloadCustomerStatement(customerEmail, 'loyalty_ledger', 'xlsx')}
                className="flex-1 py-2 rounded-lg border border-white/20 text-white text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Excel (.xlsx)</span>
              </button>
            </div>
          </div>
        </div>

        {/* 4 Membership Tiers Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {tiers.map((t: any) => {
            const isCurrent = t.tierCode === loyalty.tierCode;
            return (
              <div
                key={t.id}
                className={`p-5 rounded-xl border space-y-3 ${
                  isCurrent ? 'bg-[#181612] border-[#D4AF37]' : 'bg-[#121218] border-white/10'
                }`}
              >
                <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider">
                  <span className="text-[#D4AF37] font-bold">{t.pointsMultiplier}x Points</span>
                  {isCurrent && <span className="text-emerald-400">Your Circle</span>}
                </div>
                <div className="font-serif text-lg uppercase tracking-wider text-white">{t.tierName}</div>
                <div className="text-xs font-mono text-white/60 tabular-nums">
                  {Number(t.minQualifyingSpendInr) === 0
                    ? 'Complimentary on Registration'
                    : `₹${Number(t.minQualifyingSpendInr).toLocaleString('en-IN')}+ Retained Spend`}
                </div>
                <ul className="space-y-1.5 text-[11px] text-white/70 pt-2 border-t border-white/10">
                  {(Array.isArray(t.benefits) ? t.benefits : []).map((b: any, i: number) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-[#D4AF37]">•</span>
                      <span>{typeof b === 'string' ? b : b.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Occasion & Scent Preferences + AI Privileges Concierge */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form
            onSubmit={handleSaveOccasionPreferences}
            className="bg-[#121218] border border-white/10 rounded-xl p-6 space-y-4 font-mono text-xs"
          >
            <div>
              <span className="text-[10px] uppercase tracking-widest text-[#D4AF37] block">
                Birthday, Anniversary &amp; Olfactory Profile
              </span>
              <h3 className="font-serif text-lg uppercase tracking-wider text-white mt-0.5">
                Special Occasion Privileges
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-white/60 block mb-1">Birthday (Optional)</label>
                <input
                  type="date"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                  className="w-full bg-[#08080A] border border-white/20 rounded-lg p-2.5 text-white"
                />
              </div>
              <div>
                <label className="text-white/60 block mb-1">Anniversary (Optional)</label>
                <input
                  type="date"
                  value={anniversary}
                  onChange={(e) => setAnniversary(e.target.value)}
                  className="w-full bg-[#08080A] border border-white/20 rounded-lg p-2.5 text-white"
                />
              </div>
            </div>
            <div>
              <label className="text-white/60 block mb-1">Preferred Fragrance Family</label>
              <select
                value={preferredFamily}
                onChange={(e) => setPreferredFamily(e.target.value)}
                className="w-full bg-[#08080A] border border-white/20 rounded-lg p-2.5 text-white"
              >
                <option value="">Select preferred scent family...</option>
                {FRAGRANCE_FAMILIES.map((fam) => (
                  <option key={fam} value={fam}>
                    {fam}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-white/80 cursor-pointer">
              <input
                type="checkbox"
                checked={promoOptIn}
                onChange={(e) => setPromoOptIn(e.target.checked)}
                className="accent-[#D4AF37]"
              />
              <span>Opt in to annual Birthday, Anniversary &amp; ONCE Limited Edition invitations</span>
            </label>
            <button
              type="submit"
              disabled={savingPrefs}
              className="w-full py-2.5 rounded-lg bg-[#D4AF37] text-[#08080A] font-semibold uppercase tracking-wider cursor-pointer"
            >
              {savingPrefs ? 'Saving...' : 'Save Privileges Profile'}
            </button>
          </form>

          {/* AI Gifting & Privileges Concierge */}
          <div className="bg-[#121218] border border-white/10 rounded-xl p-6 space-y-4 flex flex-col justify-between font-mono text-xs">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[#D4AF37] uppercase tracking-widest text-[10px]">
                <Sparkles className="w-4 h-4" />
                <span>Atelier Privileges &amp; Gifting Advisor</span>
              </div>
              <h3 className="font-serif text-lg uppercase tracking-wider text-white">
                Personalized Scent &amp; Reward Guidance
              </h3>
              <p className="text-white/60 font-sans text-xs leading-relaxed">
                Ask how to maximize your current points, select a gift card denomination for a wedding or corporate
                event, or pair a Discovery Set with a full flacon.
              </p>
              {aiReply && (
                <div className="p-4 rounded-xl bg-[#08080A] border border-[#D4AF37]/30 text-white/90 whitespace-pre-line font-sans text-xs leading-relaxed">
                  {aiReply}
                </div>
              )}
            </div>
            <form onSubmit={handleAskConcierge} className="flex gap-2 pt-2">
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g. Suggest a Wedding gift card & scent pairing..."
                className="flex-1 bg-[#08080A] border border-white/20 rounded-lg px-3 py-2.5 text-white"
              />
              <button
                type="submit"
                disabled={aiLoading}
                className="px-4 py-2.5 rounded-lg bg-[#D4AF37] text-[#08080A] font-semibold uppercase flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{aiLoading ? '...' : 'Ask'}</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // SUB-TAB 3: GIFT CARDS (CLAIM, BALANCE CHECK & MY CARDS)
  // ==========================================================================
  if (activeSubTab === 'gift_cards') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#121218] border border-white/10 rounded-xl p-6">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#D4AF37] block">
              Digital &amp; Physical Gift Cards
            </span>
            <h3 className="font-serif text-xl uppercase tracking-wider text-white">
              Your FRAGMORÉ Gift Cards
            </h3>
          </div>
          <button
            type="button"
            onClick={onNavigateGiftStore}
            className="px-5 py-2.5 rounded-lg bg-[#D4AF37] text-[#08080A] text-xs font-mono font-semibold uppercase tracking-wider flex items-center gap-2 cursor-pointer"
          >
            <Gift className="w-4 h-4" />
            <span>Purchase Gift Card →</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 font-mono text-xs">
          <form onSubmit={handleClaimGiftCard} className="bg-[#121218] border border-white/10 rounded-xl p-6 space-y-3">
            <div className="text-[#D4AF37] uppercase tracking-wider font-semibold">Claim Gift Card to Account</div>
            <p className="text-white/60 font-sans">
              Bind an activated gift card code to your FRAGMORÉ account for 1-click partial or full redemption at
              checkout.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={claimCode}
                onChange={(e) => setClaimCode(e.target.value.toUpperCase())}
                placeholder="FRGM-XXXX-XXXX-XXXX"
                className="flex-1 bg-[#08080A] border border-white/20 rounded-lg px-3.5 py-2.5 text-white uppercase"
              />
              <button
                type="submit"
                disabled={claiming}
                className="px-4 py-2.5 rounded-lg bg-[#D4AF37] text-[#08080A] font-semibold uppercase cursor-pointer"
              >
                {claiming ? 'Claiming...' : 'Claim'}
              </button>
            </div>
          </form>

          <form
            onSubmit={handleVerifyGiftCardBalance}
            className="bg-[#121218] border border-white/10 rounded-xl p-6 space-y-3"
          >
            <div className="text-white uppercase tracking-wider font-semibold">Check Any Card Balance</div>
            <p className="text-white/60 font-sans">
              Verify remaining balance and validity without claiming the card.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={balanceCheckCode}
                onChange={(e) => setBalanceCheckCode(e.target.value.toUpperCase())}
                placeholder="FRGM-XXXX-XXXX-XXXX"
                className="flex-1 bg-[#08080A] border border-white/20 rounded-lg px-3.5 py-2.5 text-white uppercase"
              />
              <button
                type="submit"
                className="px-4 py-2.5 rounded-lg border border-white/20 hover:border-[#D4AF37] text-white uppercase flex items-center gap-1.5 cursor-pointer"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Verify</span>
              </button>
            </div>
            {checkedCard && (
              <div className="p-3 rounded-lg bg-[#08080A] border border-white/10 flex items-center justify-between">
                <span>
                  {checkedCard.cardNumber} ({checkedCard.status})
                </span>
                <strong className="text-[#D4AF37] tabular-nums">
                  ₹{Number(checkedCard.remainingBalanceInr || 0).toLocaleString('en-IN')}
                </strong>
              </div>
            )}
          </form>
        </div>

        {/* Cards Table */}
        <div className="bg-[#121218] border border-white/10 rounded-xl p-6 space-y-4">
          <h4 className="font-serif text-lg uppercase tracking-wider text-white">
            Purchased, Received &amp; Claimed Cards ({giftCards.length})
          </h4>
          {giftCards.length === 0 ? (
            <p className="text-xs font-mono text-white/50 py-6 text-center">
              No gift cards associated with your account yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
              {giftCards.map((c: any) => (
                <div key={c.id} className="p-5 rounded-xl bg-[#08080A] border border-white/10 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[#D4AF37] font-bold">{c.cardNumber}</span>
                    <span className="text-[10px] uppercase text-white/70">
                      {c.status} · {c.paymentStatus}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/50">Masked Code: {c.maskedCode}</span>
                    <span className="text-base font-bold text-white tabular-nums">
                      ₹{Number(c.remainingBalanceInr || 0).toLocaleString('en-IN')}{' '}
                      <span className="text-[10px] text-white/40 font-normal">
                        / ₹{Number(c.initialValueInr || 0).toLocaleString('en-IN')}
                      </span>
                    </span>
                  </div>
                  <div className="text-[11px] text-white/60 flex justify-between pt-2 border-t border-white/10">
                    <span>
                      {c.occasion} · For {c.recipientName}
                    </span>
                    <span>Expires {new Date(c.expiresAt).toLocaleDateString('en-IN')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==========================================================================
  // SUB-TAB 4: REFERRALS (REFER & EXPERIENCE FRAGMORÉ)
  // ==========================================================================
  if (activeSubTab === 'referrals') {
    const refCfg = snapshot.config?.referralConfig || {};
    const whatsappText = encodeURIComponent(
      `Discover FRAGMORÉ Haute Parfumerie — use my private invitation code ${referrals.referralCode} at ${referrals.shareUrl} to receive ₹${refCfg.refereeRewardInr || 50} welcome privilege on your first fragrance order.`
    );

    return (
      <div className="space-y-6">
        <div className="bg-[#121218] border border-[#D4AF37]/40 rounded-2xl p-6 sm:p-8 space-y-5">
          <div className="space-y-2 max-w-2xl">
            <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-[#D4AF37] block">
              Refer &amp; Experience FRAGMORÉ
            </span>
            <h3 className="font-serif text-2xl sm:text-3xl uppercase tracking-wider text-white">
              Invite a Connoisseur. Share the Scent.
            </h3>
            <p className="text-xs text-white/70 leading-relaxed">
              Your invited friend receives{' '}
              <strong className="text-white">₹{refCfg.refereeRewardInr || 50} FRAGMORÉ Wallet Privilege</strong> on
              their qualifying inaugural order (₹{refCfg.minFirstOrderValueInr || 699}+), and you receive{' '}
              <strong className="text-[#D4AF37]">₹{refCfg.referrerRewardInr || 75} Wallet Credit</strong> once their
              order is delivered and completes the {refCfg.returnWindowHoldDays || 7}-day return window.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 font-mono text-xs items-center">
            <div className="md:col-span-4 p-3.5 rounded-xl bg-[#08080A] border border-white/15 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-white/40 uppercase block">Your Invitation Code</span>
                <strong className="text-base text-[#D4AF37] tracking-widest">{referrals.referralCode}</strong>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(referrals.referralCode);
                  onNotify(`Copied referral code ${referrals.referralCode}`);
                }}
                className="px-3 py-1.5 rounded bg-white/10 hover:bg-[#D4AF37] hover:text-[#08080A] text-white cursor-pointer flex items-center gap-1"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </button>
            </div>

            <div className="md:col-span-5 p-3.5 rounded-xl bg-[#08080A] border border-white/15 flex items-center justify-between gap-2">
              <span className="truncate text-white/80">{referrals.shareUrl}</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(referrals.shareUrl);
                  onNotify('Copied referral invitation link');
                }}
                className="px-3 py-1.5 rounded bg-white/10 hover:bg-[#D4AF37] hover:text-[#08080A] text-white shrink-0 cursor-pointer"
              >
                Copy Link
              </button>
            </div>

            <a
              href={`https://wa.me/?text=${whatsappText}`}
              target="_blank"
              rel="noreferrer"
              className="md:col-span-3 py-4 px-4 rounded-xl bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] font-semibold uppercase tracking-wider flex items-center justify-center gap-2 text-center"
            >
              <Share2 className="w-4 h-4" />
              <span>WhatsApp Invite</span>
            </a>
          </div>
        </div>

        {/* Apply Friend's Referral Code (for first-time patrons) */}
        {!referrals.referredByConversion && (
          <form
            onSubmit={handleApplyReferral}
            className="bg-[#121218] border border-white/10 rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 font-mono text-xs"
          >
            <div>
              <div className="text-white font-semibold uppercase">Were You Invited by a FRAGMORÉ Patron?</div>
              <p className="text-white/50 font-sans mt-0.5">
                Link your friend’s code prior to placing your inaugural order.
              </p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <input
                type="text"
                value={friendRefCode}
                onChange={(e) => setFriendRefCode(e.target.value.toUpperCase())}
                placeholder="FRG-XXXXXX"
                className="bg-[#08080A] border border-white/20 rounded-lg px-3.5 py-2 text-white uppercase"
              />
              <button
                type="submit"
                disabled={applyingRef}
                className="px-4 py-2 rounded-lg bg-[#D4AF37] text-[#08080A] font-semibold uppercase cursor-pointer"
              >
                {applyingRef ? '...' : 'Apply Code'}
              </button>
            </div>
          </form>
        )}

        {/* Referral Conversions Table */}
        <div className="bg-[#121218] border border-white/10 rounded-xl p-6 space-y-4">
          <h4 className="font-serif text-lg uppercase tracking-wider text-white">
            Your Invited Friends ({referrals.invitedConversions.length})
          </h4>
          {referrals.invitedConversions.length === 0 ? (
            <p className="text-xs font-mono text-white/50 py-6 text-center">
              No referral conversions yet. Share your code above to invite friends to FRAGMORÉ.
            </p>
          ) : (
            <div className="overflow-x-auto font-mono text-xs">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/10 text-white/50 uppercase text-[10px]">
                    <th className="py-2.5">Ref ID</th>
                    <th className="py-2.5">Invited Friend</th>
                    <th className="py-2.5">Status</th>
                    <th className="py-2.5 text-right">Your Reward</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {referrals.invitedConversions.map((r: any) => (
                    <tr key={r.id}>
                      <td className="py-3 text-[#D4AF37]">{r.conversionNumber}</td>
                      <td className="py-3 text-white">{r.refereeEmail}</td>
                      <td className="py-3 text-white/70">{r.status}</td>
                      <td className="py-3 text-right font-semibold text-emerald-400 tabular-nums">
                        ₹{Number(r.referrerCreditInr || 0).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==========================================================================
  // SUB-TAB 5: REWARDS HISTORY (UNIFIED AUDITABLE CHRONOLOGY)
  // ==========================================================================
  const unifiedFeed = [
    ...walletTransactions.map((w: any) => ({
      id: `w_${w.id}`,
      date: w.createdAt,
      stream: 'WALLET',
      ref: w.referenceNumber,
      summary: `${w.txnType} (${w.creditType}) — ${w.reason}`,
      impact: `${w.direction === 'CREDIT' ? '+' : '-'}₹${Number(w.amountInr).toLocaleString('en-IN')}`
    })),
    ...pointsLedger.map((p: any) => ({
      id: `p_${p.id}`,
      date: p.createdAt,
      stream: 'PRIVILEGES POINTS',
      ref: p.referenceNumber,
      summary: `${p.entryType} — ${p.reason}`,
      impact: `${p.pointsDelta > 0 ? '+' : ''}${p.pointsDelta} pts`
    })),
    ...giftCardTransactions.map((g: any) => ({
      id: `g_${g.id}`,
      date: g.createdAt,
      stream: 'GIFT CARD',
      ref: g.referenceNumber,
      summary: `${g.txnType} on ${g.cardNumber} (${g.notes || g.channel})`,
      impact: `₹${Number(g.amountInr).toLocaleString('en-IN')}`
    })),
    ...occasionGrants.map((o: any) => ({
      id: `o_${o.id}`,
      date: o.createdAt,
      stream: 'OCCASION PRIVILEGE',
      ref: o.grantNumber,
      summary: `${o.occasionType} Celebration (${o.rewardYear})`,
      impact: `+${o.pointsAwarded} pts / +₹${o.walletCreditInr}`
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="bg-[#121218] border border-white/10 rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-[#D4AF37] block">
            Complete Auditable Ledger
          </span>
          <h3 className="font-serif text-xl uppercase tracking-wider text-white">
            Unified Rewards &amp; Wallet History
          </h3>
        </div>
        <History className="w-5 h-5 text-[#D4AF37]" />
      </div>

      {unifiedFeed.length === 0 ? (
        <p className="text-xs font-mono text-white/50 py-8 text-center">
          Your unified rewards ledger will record every earned point, redeemed credit, gift card movement, and occasion
          grant here.
        </p>
      ) : (
        <div className="overflow-x-auto font-mono text-xs">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10 text-white/50 uppercase text-[10px]">
                <th className="py-2.5">Date</th>
                <th className="py-2.5">Program</th>
                <th className="py-2.5">Reference</th>
                <th className="py-2.5">Activity</th>
                <th className="py-2.5 text-right">Value / Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {unifiedFeed.map((row) => (
                <tr key={row.id}>
                  <td className="py-3 text-white/60">{new Date(row.date).toLocaleDateString('en-IN')}</td>
                  <td className="py-3 text-[#D4AF37]">{row.stream}</td>
                  <td className="py-3 text-white/80">{row.ref}</td>
                  <td className="py-3 text-white/80 max-w-md truncate">{row.summary}</td>
                  <td className="py-3 text-right font-semibold text-white tabular-nums">{row.impact}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
