import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../../context/StoreContext';
import { Coupon } from '../../types';
import {
  Plus,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  TrendingUp,
  Award,
  Settings,
  CheckCircle2,
  Clock,
  RefreshCw,
  Play,
  Eye,
  X,
  Lock,
  Gift,
  Boxes
} from 'lucide-react';
import { ErpTableExportBar } from './erp/ErpUniversalExportModal';

interface AdminCouponsProps {
  initialView?: 'coupons' | 'discovery_journeys' | 'redemption_rules' | 'loyalty' | 'analytics';
}

export const AdminCoupons: React.FC<AdminCouponsProps> = ({ initialView = 'coupons' }) => {
  const { coupons: storeCoupons, addCoupon, toggleCouponStatus, showNotification } = useStore();
  const [activeTab, setActiveTab] = useState<
    'discovery_journeys' | 'redemption_rules' | 'loyalty' | 'coupons' | 'analytics'
  >(initialView);

  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState<any | null>(null);
  const [selectedJourney, setSelectedJourney] = useState<any | null>(null);
  const [selectedCouponHistory, setSelectedCouponHistory] = useState<any | null>(null);

  // Redemption Rules Form State (Admin-Configurable, Never Hardcoded)
  const [rulesForm, setRulesForm] = useState<any>({
    redemptionCalculationMode: 'CONFIGURED_AMOUNT_BY_VIAL_SIZE',
    redemptionAmount2mlInr: 999,
    redemptionAmount8mlInr: 1999,
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
    estimatedCogsPercent: 25
  });

  // Register Discovery Purchase Modal
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [discCustName, setDiscCustName] = useState('Ananya Birla');
  const [discCustEmail, setDiscCustEmail] = useState('ananya.b@fragmore.in');
  const [discCustPhone, setDiscCustPhone] = useState('+91 98209 55120');
  const [discConfigCode, setDiscConfigCode] = useState('DISCOVERY_SIX_2ML');
  const [discOrderStatus, setDiscOrderStatus] = useState('CONFIRMED');

  // Favorite Selection & Upgrade Simulator State
  const [favoriteChoice, setFavoriteChoice] = useState('AZURE');
  const [upgradeProductChoice, setUpgradeProductChoice] = useState('AZURE');
  const [upgradeSizeChoice, setUpgradeSizeChoice] = useState('100 ml');
  const [upgradeGrossPrice, setUpgradeGrossPrice] = useState(5499);

  // Loyalty Customer Execution Modal
  const [execLoyaltyModal, setExecLoyaltyModal] = useState<any | null>(null);
  const [loyCustomerEmail, setLoyCustomerEmail] = useState('patron@fragmore.in');
  const [loyCustomerName, setLoyCustomerName] = useState('Rohan Singhania');
  const [loyVoluntaryBirthday, setLoyVoluntaryBirthday] = useState('1991-10-25');

  // Create Enterprise Coupon Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newType, setNewType] = useState<
    'PERCENTAGE' | 'FLAT' | 'FREE_SHIPPING' | 'DISCOVERY_VOUCHER' | 'LOYALTY_REWARD'
  >('PERCENTAGE');
  const [newValue, setNewValue] = useState(15);
  const [newMin, setNewMin] = useState(3499);
  const [newMaxDiscount, setNewMaxDiscount] = useState(1200);
  const [newUsageLimit, setNewUsageLimit] = useState(250);
  const [newPerCustLimit, setNewPerCustLimit] = useState(1);
  const [newStartDate, setNewStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [newExpiryDate, setNewExpiryDate] = useState('2026-12-31');
  const [newCampaignOwner, setNewCampaignOwner] = useState('FRAGMORÉ Growth & Retention Desk');
  const [newBudgetInr, setNewBudgetInr] = useState(50000);
  const [newEligibleSegment, setNewEligibleSegment] = useState('ALL');
  const [newAssignedEmail, setNewAssignedEmail] = useState('');
  const [newEligibleProducts, setNewEligibleProducts] = useState('ALL_FULL_BOTTLES');
  const [newStackingRule, setNewStackingRule] = useState<
    'EXCLUSIVE' | 'STACKABLE_WITH_LOYALTY' | 'STACKABLE_WITH_ALL'
  >('EXCLUSIVE');
  const [newDesc, setNewDesc] = useState('');

  // Verification Suite State
  const [runningTests, setRunningTests] = useState(false);
  const [testResults, setTestResults] = useState<any | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/discovery-loyalty/dashboard');
      if (res.ok) {
        const data = await res.json();
        setDashboard(data);
        if (data.redemptionRules) {
          setRulesForm(data.redemptionRules);
        }
      }
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Merge coupons from PostgreSQL and StoreContext
  const dbCoupons: any[] = dashboard?.coupons || [];
  const mergedCoupons: any[] = storeCoupons.map((sc) => {
    const match = dbCoupons.find((d) => d.code.toUpperCase() === sc.code.toUpperCase());
    return match ? { ...sc, ...match } : sc;
  });
  dbCoupons.forEach((dbc) => {
    if (!mergedCoupons.some((m) => m.code.toUpperCase() === dbc.code.toUpperCase())) {
      mergedCoupons.unshift({
        ...dbc,
        minCartValue: dbc.minOrderValue || 0,
        timesUsed: dbc.usageCount || 0
      });
    }
  });

  const handleSaveRedemptionRules = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/discovery-loyalty/redemption-rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rulesForm)
      });
      const data = await res.json();
      if (res.ok) {
        showNotification('Admin Discovery Redemption Rules saved to PostgreSQL.');
        setRulesForm(data.redemptionRules);
        await fetchDashboard();
      } else {
        showNotification(data.error || 'Failed to update rules');
      }
    } catch (err: any) {
      showNotification(err.message || 'Error updating rules');
    }
  };

  const handleRegisterDiscoveryOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const is8ml = discConfigCode.includes('8ML');
    try {
      const res = await fetch('/api/discovery-loyalty/journeys/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: `ord-disc-${Date.now()}`,
          orderNumber: `FRG-DISC-${Math.floor(1000 + Math.random() * 9000)}`,
          customerName: discCustName,
          customerEmail: discCustEmail,
          customerPhone: discCustPhone,
          configurationCode: discConfigCode,
          sizeVariant: is8ml ? '8 ml' : '2 ml',
          netDiscoveryPriceInr: is8ml ? 2499 : 999,
          orderStatus: discOrderStatus
        })
      });
      const data = await res.json();
      if (res.ok) {
        showNotification(
          `Discovery purchase registered (${data.journey.configurationName}). Customer tagged as Discovery Buyer.`
        );
        setRegisterModalOpen(false);
        await fetchDashboard();
      } else {
        showNotification(data.error || 'Registration failed');
      }
    } catch (err: any) {
      showNotification(err.message || 'Registration error');
    }
  };

  const handleConfirmDiscoveryDelivery = async (
    journeyId: string,
    verificationSource: 'TRUSTED_CARRIER_WEBHOOK' | 'AUTHORIZED_ADMIN_CONFIRMATION' | 'UNVERIFIED_PING'
  ) => {
    try {
      const res = await fetch(`/api/discovery-loyalty/journeys/${journeyId}/confirm-delivery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verificationSource,
          channel: 'EMAIL',
          actor:
            verificationSource === 'TRUSTED_CARRIER_WEBHOOK'
              ? 'Blue Dart Carrier Webhook'
              : 'Super Admin Concierge'
        })
      });
      const data = await res.json();
      if (!res.ok) {
        showNotification(data.error || data.reason || 'Delivery verification blocked');
      } else {
        showNotification(data.reason);
        await fetchDashboard();
        if (selectedJourney && selectedJourney.id === journeyId) {
          setSelectedJourney(data.journey);
        }
      }
    } catch (err: any) {
      showNotification(err.message || 'Error');
    }
  };

  const handleSelectFavoriteAndIssueVoucher = async (journeyId: string) => {
    try {
      const res = await fetch(`/api/discovery-loyalty/journeys/${journeyId}/select-favorite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedFavoriteFragrance: favoriteChoice,
          issueRedemptionVoucher: true
        })
      });
      const data = await res.json();
      if (!res.ok) {
        showNotification(data.error || data.reason || 'Could not issue voucher');
      } else {
        showNotification(data.reason);
        await fetchDashboard();
        if (selectedJourney && selectedJourney.id === journeyId) {
          setSelectedJourney(data.journey);
        }
      }
    } catch (err: any) {
      showNotification(err.message || 'Error');
    }
  };

  const handleRedeemVoucherUpgrade = async (journey: any) => {
    if (!journey.issuedVoucherCode) {
      showNotification('No active voucher issued for this journey yet.');
      return;
    }
    try {
      const res = await fetch('/api/discovery-loyalty/vouchers/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voucherCode: journey.issuedVoucherCode,
          customerEmail: journey.customerEmail,
          orderId: `ord-upg-${Date.now()}`,
          orderNumber: `FRG-UPG-${Math.floor(1000 + Math.random() * 9000)}`,
          productName: upgradeProductChoice,
          bottleSize: upgradeSizeChoice,
          grossOrderAmountInr: upgradeGrossPrice
        })
      });
      const data = await res.json();
      if (!res.ok) {
        showNotification(data.error || data.reason || 'Redemption failed');
      } else {
        showNotification(data.reason);
        await fetchDashboard();
        if (selectedJourney && selectedJourney.id === journey.id) {
          setSelectedJourney(data.journey);
        }
      }
    } catch (err: any) {
      showNotification(err.message || 'Redemption error');
    }
  };

  const handleRevokeDiscoveryJourney = async (journeyId: string) => {
    try {
      const res = await fetch(`/api/discovery-loyalty/journeys/${journeyId}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'Discovery order refunded/cancelled — revoking unredeemed voucher'
        })
      });
      const data = await res.json();
      if (res.ok) {
        showNotification(data.reason);
        await fetchDashboard();
        if (selectedJourney && selectedJourney.id === journeyId) {
          setSelectedJourney(data.journey);
        }
      }
    } catch (err: any) {
      showNotification(err.message || 'Revoke error');
    }
  };

  const handleLoyaltyAction = async (
    programId: string,
    action: 'APPROVE' | 'REJECT' | 'ACTIVATE' | 'PAUSE'
  ) => {
    try {
      const res = await fetch(`/api/discovery-loyalty/loyalty/${programId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (!res.ok) {
        showNotification(data.error || data.reason);
      } else {
        showNotification(data.reason);
        await fetchDashboard();
      }
    } catch (err: any) {
      showNotification(err.message || 'Error');
    }
  };

  const handleExecuteLoyaltyBenefit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!execLoyaltyModal) return;
    try {
      const res = await fetch(`/api/discovery-loyalty/loyalty/${execLoyaltyModal.id}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerEmail: loyCustomerEmail,
          customerName: loyCustomerName,
          voluntaryBirthdayProvided: loyVoluntaryBirthday || null,
          favoriteFragrance: 'AZURE'
        })
      });
      const data = await res.json();
      if (!res.ok) {
        showNotification(data.error || data.reason);
      } else {
        showNotification(data.reason);
        setExecLoyaltyModal(null);
        await fetchDashboard();
      }
    } catch (err: any) {
      showNotification(err.message || 'Execution error');
    }
  };

  const handleCreateEnterpriseCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode) return;

    try {
      const res = await fetch('/api/discovery-loyalty/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: newCode.toUpperCase(),
          discountType: newType,
          value: newValue,
          minOrderValue: newMin,
          maxDiscount: newMaxDiscount,
          usageLimit: newUsageLimit,
          perCustomerLimit: newPerCustLimit,
          startDate: newStartDate,
          expiryDate: newExpiryDate,
          campaignOwner: newCampaignOwner,
          budgetInr: newBudgetInr,
          eligibleCustomerSegment: newEligibleSegment,
          assignedCustomerEmail: newAssignedEmail || null,
          eligibleProducts: [newEligibleProducts],
          stackingRule: newStackingRule,
          description: newDesc || `${newCode.toUpperCase()} (${newCampaignOwner})`
        })
      });
      if (res.ok) {
        const cpn: Coupon = {
          code: newCode.toUpperCase(),
          discountType: newType as any,
          value: newValue,
          minCartValue: newMin,
          usageLimit: newUsageLimit,
          timesUsed: 0,
          isActive: true,
          description: newDesc || `${newCode.toUpperCase()} (${newCampaignOwner})`,
          expiryDate: newExpiryDate
        };
        addCoupon(cpn);
        setIsModalOpen(false);
        setNewCode('');
        setNewDesc('');
        await fetchDashboard();
      }
    } catch (err: any) {
      showNotification(err.message || 'Coupon creation error');
    }
  };

  const handleRunVerificationSuite = async () => {
    setRunningTests(true);
    try {
      const res = await fetch('/api/discovery-loyalty/run-tests', { method: 'POST' });
      const data = await res.json();
      setTestResults(data);
      showNotification(
        `Discovery, Loyalty & Coupon Verification Suite: ${data.passedCount}/${data.totalCount} scenarios passed.`
      );
      await fetchDashboard();
    } catch (err: any) {
      showNotification(err.message || 'Verification error');
    } finally {
      setRunningTests(false);
    }
  };

  const analytics = dashboard?.analytics || {
    discoveryKitsSold: 0,
    netDiscoveryRevenueInr: 0,
    costPerDiscoveryCustomerInr: 0,
    discoveryToFullBottleConversionPercent: 0,
    avgTimeToUpgradeDays: 0,
    mostSelectedFragrance: 'AZURE',
    fragranceSelectionBreakdown: [],
    totalVouchersIssued: 0,
    vouchersRedeemed: 0,
    redemptionRatePercent: 0,
    upgradeRevenueInr: 0,
    upgradeContributionMarginInr: 0,
    repeatPurchaseRatePercent: 0
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-mono text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-white/10 gap-4">
        <div>
          <h2 className="font-serif text-2xl uppercase tracking-wider text-white">
            Discovery Experience, Privilege Coupons & Loyalty Automation
          </h2>
          <p className="text-xs text-white/50">
            2 ml & 10 ml Discovery Six journeys, Admin-configurable redemption safeguards, governed loyalty rewards & cohort analytics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ErpTableExportBar
            reportKey="custom_table"
            title="FRAGMORÉ Discovery Vouchers, Privilege Coupons & Loyalty Register"
            customRows={(dashboard?.coupons || storeCoupons || []).map((c: any) => ({
              code: c.code,
              discountType: c.discountType,
              value: c.value,
              minCartValueInr: Number(c.minCartValue ?? c.minOrderValue ?? 0),
              timesUsed: Number(c.timesUsed ?? 0),
              usageLimit: Number(c.usageLimit ?? 0),
              expiryDate: c.expiryDate || '',
              status: c.isActive === false ? 'INACTIVE' : 'ACTIVE'
            }))}
            notify={(m) => showNotification(m)}
          />
          <button
            onClick={fetchDashboard}
            className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/15 rounded-lg text-white flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Sync
          </button>
          <button
            onClick={handleRunVerificationSuite}
            disabled={runningTests}
            className="px-3.5 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-bold rounded-lg uppercase tracking-wider flex items-center gap-1.5"
          >
            <Play className="w-3.5 h-3.5" />{' '}
            {runningTests ? 'Verifying...' : 'Run 6-Scenario Verification'}
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] font-bold uppercase tracking-wider rounded-lg flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Create Enterprise Coupon
          </button>
        </div>
      </div>

      {/* Verification Suite Banner if run */}
      {testResults && (
        <div className="p-4 bg-[#121218] border border-emerald-500/40 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-400 uppercase flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Automated Discovery, Loyalty & Coupon Suite:{' '}
              {testResults.passedCount}/{testResults.totalCount} Passed
            </span>
            <button
              onClick={() => setTestResults(null)}
              className="text-white/40 hover:text-white text-[11px]"
            >
              Dismiss
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {(testResults.results || []).map((r: any) => (
              <div
                key={r.id}
                className="p-2.5 bg-black/40 border border-white/10 rounded-lg flex items-start justify-between gap-2"
              >
                <div>
                  <div className="text-white font-bold text-[11px]">{r.scenario}</div>
                  <div className="text-white/50 text-[10px] mt-0.5">{r.details}</div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                    r.passed
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-rose-500/20 text-rose-400'
                  }`}
                >
                  {r.passed ? 'PASS' : 'FAIL'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2 overflow-x-auto no-scrollbar">
        {[
          { id: 'discovery_journeys', label: '1. Discovery Purchase Journeys (2ml & 8ml)' },
          { id: 'redemption_rules', label: '2. Discovery Redemption Rules' },
          { id: 'loyalty', label: '3. Loyalty Automation (9 Programs)' },
          { id: 'coupons', label: `4. Enterprise Coupons (${mergedCoupons.length})` },
          { id: 'analytics', label: '5. Discovery Analytics & 7d/30d/60d/90d Cohorts' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-[#D4AF37] text-[#08080A] font-bold shadow'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* =================================================================== */}
      {/* TAB 1: DISCOVERY PURCHASE JOURNEYS (10-STEP PIPELINE)               */}
      {/* =================================================================== */}
      {activeTab === 'discovery_journeys' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-[#121218] border border-white/10 rounded-xl p-4 gap-4">
            <div>
              <h3 className="font-serif text-base uppercase tracking-wider text-white">
                Discovery Six (2 ml & 10 ml) & Collector Discovery Journeys
              </h3>
              <p className="text-[11px] text-white/50">
                Rule enforced: Journey, fragrance education, and redemption benefits start ONLY after confirmed carrier/Admin delivery.
              </p>
            </div>
            <button
              onClick={() => setRegisterModalOpen(true)}
              className="px-4 py-2 bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] font-bold rounded-lg uppercase text-[11px] whitespace-nowrap flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Register Discovery Purchase
            </button>
          </div>

          {/* Supported Discovery Configurations Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {(rulesForm.supportedConfigurations || []).map((cfg: any) => (
              <div
                key={cfg.code}
                className="p-3.5 bg-[#121218] border border-white/10 rounded-xl space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded bg-[#D4AF37]/15 text-[#D4AF37] font-bold text-[10px]">
                    {cfg.vialCount} × {cfg.vialSize}
                  </span>
                  <span className="text-emerald-400 font-bold text-xs">
                    ₹{Number(cfg.defaultPriceInr || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <strong className="text-white block text-xs pt-1">{cfg.name}</strong>
                <span className="text-[10px] text-white/40 block">
                  {(cfg.includedFragrances || []).join(', ')}
                </span>
              </div>
            ))}
          </div>

          {/* Journeys Table */}
          <div className="bg-[#121218] border border-white/10 rounded-xl overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10 text-white/40 uppercase text-[10px]">
                  <th className="p-3.5">Order & Cohort</th>
                  <th className="p-3.5">Discovery Buyer</th>
                  <th className="p-3.5">Configuration & Vial</th>
                  <th className="p-3.5">Delivery Gate</th>
                  <th className="p-3.5">Journey Stage & Favorite</th>
                  <th className="p-3.5">Voucher & Upgrade</th>
                  <th className="p-3.5 text-right">Orchestrate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {(dashboard?.journeys || []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-white/40">
                      No Discovery purchases recorded yet. Click "Register Discovery Purchase" to test the 10-step pipeline.
                    </td>
                  </tr>
                ) : (
                  (dashboard?.journeys || []).map((j: any) => (
                    <tr key={j.id} className="hover:bg-white/[0.02]">
                      <td className="p-3.5">
                        <strong className="text-white block">{j.orderNumber}</strong>
                        <span className="text-[10px] text-white/40">Cohort: {j.cohortMonth}</span>
                      </td>
                      <td className="p-3.5">
                        <span className="text-white font-medium block">{j.customerName}</span>
                        <span className="text-[10px] text-white/50">{j.customerEmail}</span>
                        <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-[#D4AF37]/15 text-[#D4AF37] text-[9px] font-bold">
                          Discovery Buyer
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span className="text-white block">{j.configurationName}</span>
                        <span className="text-[10px] text-[#D4AF37] font-bold">
                          {j.vialCount} × {j.vialSize} • ₹{Number(j.netDiscoveryPriceInr || 0).toLocaleString('en-IN')}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            j.deliveryStatus === 'DELIVERED'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : j.deliveryStatus === 'RETURNED_OR_CANCELLED'
                              ? 'bg-rose-500/20 text-rose-400'
                              : 'bg-amber-500/20 text-amber-400'
                          }`}
                        >
                          {j.deliveryStatus}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded bg-white/10 text-white font-bold text-[10px]">
                          {j.journeyStatus}
                        </span>
                        {j.selectedFavoriteFragrance && (
                          <span className="block text-[10px] text-[#D4AF37] mt-1">
                            ★ Favorite: {j.selectedFavoriteFragrance}
                          </span>
                        )}
                      </td>
                      <td className="p-3.5">
                        {j.issuedVoucherCode ? (
                          <div>
                            <strong className="text-[#D4AF37] block">{j.issuedVoucherCode}</strong>
                            <span className="text-[10px] text-white/60">
                              ₹{j.voucherAmountInr} ({j.voucherStatus})
                            </span>
                            {j.upgradeNetRevenueInr > 0 && (
                              <span className="block text-[10px] text-emerald-400 font-bold">
                                Upgraded: ₹{Number(j.upgradeNetRevenueInr).toLocaleString('en-IN')}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-white/40 text-[10px]">Not issued yet</span>
                        )}
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => setSelectedJourney(j)}
                          className="px-3 py-1.5 bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] font-bold rounded text-[10px] uppercase inline-flex items-center gap-1"
                        >
                          <Sparkles className="w-3 h-3" /> 10-Step Journey
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: ADMIN-CONFIGURABLE DISCOVERY REDEMPTION RULES                */}
      {/* =================================================================== */}
      {activeTab === 'redemption_rules' && (
        <form
          onSubmit={handleSaveRedemptionRules}
          className="bg-[#121218] border border-white/10 rounded-xl p-6 space-y-6"
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <h3 className="font-serif text-lg uppercase tracking-wider text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-[#D4AF37]" /> Admin-Configurable Discovery Redemption Rules
              </h3>
              <p className="text-xs text-white/50">
                Zero hardcoded redemption offers. All amounts, validity windows, stacking rules, and gross-margin safeguards are dynamically enforced.
              </p>
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] font-bold uppercase rounded-lg"
            >
              Save Redemption Rules
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-white/60 mb-1">Redemption Calculation Mode</label>
              <select
                value={rulesForm.redemptionCalculationMode}
                onChange={(e) =>
                  setRulesForm({ ...rulesForm, redemptionCalculationMode: e.target.value })
                }
                className="w-full bg-[#08080A] border border-white/20 rounded-lg p-2.5 text-white"
              >
                <option value="CONFIGURED_AMOUNT_BY_VIAL_SIZE">
                  Configured Amount by Vial Size (2 ml / 8 ml)
                </option>
                <option value="FULL_DISCOVERY_NET_PRICE">
                  100% of Net Discovery Purchase Price
                </option>
                <option value="CONFIGURED_PERCENTAGE">
                  Configured Percentage (%) off Full Bottle
                </option>
              </select>
            </div>

            <div>
              <label className="block text-white/60 mb-1">
                2 ml Discovery Redemption Amount (₹)
              </label>
              <input
                type="number"
                value={rulesForm.redemptionAmount2mlInr}
                onChange={(e) =>
                  setRulesForm({
                    ...rulesForm,
                    redemptionAmount2mlInr: Number(e.target.value)
                  })
                }
                className="w-full bg-[#08080A] border border-white/20 rounded-lg p-2.5 text-white font-bold"
              />
            </div>

            <div>
              <label className="block text-white/60 mb-1">
                8 ml Discovery Redemption Amount (₹)
              </label>
              <input
                type="number"
                value={rulesForm.redemptionAmount8mlInr}
                onChange={(e) =>
                  setRulesForm({
                    ...rulesForm,
                    redemptionAmount8mlInr: Number(e.target.value)
                  })
                }
                className="w-full bg-[#08080A] border border-white/20 rounded-lg p-2.5 text-white font-bold"
              />
            </div>

            <div>
              <label className="block text-white/60 mb-1">
                Minimum Full-Bottle Order Value (₹)
              </label>
              <input
                type="number"
                value={rulesForm.minOrderValueInr}
                onChange={(e) =>
                  setRulesForm({ ...rulesForm, minOrderValueInr: Number(e.target.value) })
                }
                className="w-full bg-[#08080A] border border-white/20 rounded-lg p-2.5 text-white"
              />
            </div>

            <div>
              <label className="block text-white/60 mb-1">
                Voucher Validity Period (Days After Delivery)
              </label>
              <input
                type="number"
                value={rulesForm.validityDaysAfterDelivery}
                onChange={(e) =>
                  setRulesForm({
                    ...rulesForm,
                    validityDaysAfterDelivery: Number(e.target.value)
                  })
                }
                className="w-full bg-[#08080A] border border-white/20 rounded-lg p-2.5 text-white"
              />
            </div>

            <div>
              <label className="block text-white/60 mb-1">
                Minimum Gross Margin Safeguard (%)
              </label>
              <input
                type="number"
                value={rulesForm.minGrossMarginPercent}
                onChange={(e) =>
                  setRulesForm({
                    ...rulesForm,
                    minGrossMarginPercent: Number(e.target.value)
                  })
                }
                className="w-full bg-[#08080A] border border-white/20 rounded-lg p-2.5 text-emerald-400 font-bold"
              />
            </div>
          </div>

          {/* Governance & Guardrail Checkboxes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-4 border-t border-white/10">
            <label className="flex items-center gap-2.5 p-3 bg-black/40 border border-white/10 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(rulesForm.oneRedemptionPerDiscoveryOrder)}
                onChange={(e) =>
                  setRulesForm({
                    ...rulesForm,
                    oneRedemptionPerDiscoveryOrder: e.target.checked
                  })
                }
              />
              <span>One redemption per qualifying discovery purchase</span>
            </label>

            <label className="flex items-center gap-2.5 p-3 bg-black/40 border border-white/10 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(rulesForm.customerSpecificVoucherBinding)}
                onChange={(e) =>
                  setRulesForm({
                    ...rulesForm,
                    customerSpecificVoucherBinding: e.target.checked
                  })
                }
              />
              <span>Customer-specific voucher binding (non-transferable)</span>
            </label>

            <label className="flex items-center gap-2.5 p-3 bg-black/40 border border-white/10 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(rulesForm.revokeVoucherOnRefundOrCancel)}
                onChange={(e) =>
                  setRulesForm({
                    ...rulesForm,
                    revokeVoucherOnRefundOrCancel: e.target.checked
                  })
                }
              />
              <span>Auto-revoke voucher on discovery refund/cancellation</span>
            </label>

            <label className="flex items-center gap-2.5 p-3 bg-black/40 border border-white/10 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(rulesForm.requireProductInStock)}
                onChange={(e) =>
                  setRulesForm({
                    ...rulesForm,
                    requireProductInStock: e.target.checked
                  })
                }
              />
              <span>Require eligible full-bottle SKU in stock (&gt; 0)</span>
            </label>

            <label className="flex items-center gap-2.5 p-3 bg-black/40 border border-white/10 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(rulesForm.allowStackingWithOtherCoupons)}
                onChange={(e) =>
                  setRulesForm({
                    ...rulesForm,
                    allowStackingWithOtherCoupons: e.target.checked
                  })
                }
              />
              <span>Allow stacking with other promotional coupons</span>
            </label>
          </div>
        </form>
      )}

      {/* =================================================================== */}
      {/* TAB 3: LOYALTY AUTOMATION (9 PROGRAMS + MONETARY APPROVAL GATE)     */}
      {/* =================================================================== */}
      {activeTab === 'loyalty' && (
        <div className="space-y-4">
          <div className="p-4 bg-[#121218] border border-[#D4AF37]/30 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-[#D4AF37]" />
              <div>
                <strong className="text-white block uppercase">
                  Monetary Loyalty Benefit Governance Gate
                </strong>
                <span className="text-white/50 text-[11px]">
                  Monetary loyalty benefits cannot be activated or issued without explicit Super Admin approval. Birthday offers strictly require a voluntarily provided birth date.
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(dashboard?.loyaltyPrograms || []).map((prog: any) => (
              <div
                key={prog.id}
                className="p-5 bg-[#121218] border border-white/10 rounded-xl space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded bg-[#D4AF37]/15 text-[#D4AF37] font-bold text-[10px]">
                      {prog.ruleType}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          prog.approvalStatus === 'APPROVED'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-amber-500/20 text-amber-400'
                        }`}
                      >
                        {prog.approvalStatus}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          prog.isActive
                            ? 'bg-sky-500/20 text-sky-400'
                            : 'bg-white/10 text-white/50'
                        }`}
                      >
                        {prog.isActive ? 'ACTIVE' : 'PAUSED'}
                      </span>
                    </div>
                  </div>

                  <h4 className="font-serif text-base text-white uppercase tracking-wider">
                    {prog.name}
                  </h4>
                  <p className="text-white/60 text-[11px]">{prog.description}</p>

                  <div className="grid grid-cols-3 gap-2 pt-2 text-[11px]">
                    <div className="p-2 bg-black/40 rounded border border-white/5">
                      <span className="text-white/40 block text-[9px]">Benefit</span>
                      <strong className="text-[#D4AF37]">
                        {!prog.isMonetaryBenefit
                          ? 'Non-Monetary'
                          : prog.benefitType === 'PERCENTAGE_DISCOUNT'
                          ? `${prog.benefitValue}% Off`
                          : `₹${prog.benefitValue}`}
                      </strong>
                    </div>
                    <div className="p-2 bg-black/40 rounded border border-white/5">
                      <span className="text-white/40 block text-[9px]">Min Order</span>
                      <strong className="text-white">
                        ₹{Number(prog.minQualifyingOrderInr || 0).toLocaleString('en-IN')}
                      </strong>
                    </div>
                    <div className="p-2 bg-black/40 rounded border border-white/5">
                      <span className="text-white/40 block text-[9px]">Executions</span>
                      <strong className="text-emerald-400">{prog.conversionsCount}</strong>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-white/10">
                  {prog.approvalStatus !== 'APPROVED' && (
                    <button
                      onClick={() => handleLoyaltyAction(prog.id, 'APPROVE')}
                      className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 rounded font-bold text-[10px] uppercase"
                    >
                      Approve Monetary Benefit
                    </button>
                  )}

                  {prog.isActive ? (
                    <button
                      onClick={() => handleLoyaltyAction(prog.id, 'PAUSE')}
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white/80 rounded font-bold text-[10px] uppercase"
                    >
                      Pause
                    </button>
                  ) : (
                    <button
                      onClick={() => handleLoyaltyAction(prog.id, 'ACTIVATE')}
                      className="px-3 py-1.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 rounded font-bold text-[10px] uppercase"
                    >
                      Activate
                    </button>
                  )}

                  <button
                    onClick={() => setExecLoyaltyModal(prog)}
                    className="px-3 py-1.5 bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] rounded font-bold text-[10px] uppercase flex items-center gap-1"
                  >
                    <Gift className="w-3 h-3" /> Issue / Trigger
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 4: ENTERPRISE COUPON MANAGEMENT                                 */}
      {/* =================================================================== */}
      {activeTab === 'coupons' && (
        <div className="bg-[#121218] border border-white/10 rounded-xl overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10 text-white/40 uppercase text-[10px]">
                <th className="p-3.5">Coupon & Owner</th>
                <th className="p-3.5">Type & Cap</th>
                <th className="p-3.5">Budget & Spend</th>
                <th className="p-3.5">Eligibility & Stacking</th>
                <th className="p-3.5">Redemptions & Window</th>
                <th className="p-3.5">Attributed Rev & Margin</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {mergedCoupons.map((c) => {
                const meta = c.couponMetadata || {};
                return (
                  <tr key={c.code} className="hover:bg-white/[0.02]">
                    <td className="p-3.5">
                      <strong className="text-[#D4AF37] block font-bold">{c.code}</strong>
                      <span className="text-[10px] text-white/50">
                        {meta.campaignOwner || 'FRAGMORÉ Growth Desk'}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className="text-white font-semibold block">
                        {String(c.discountType).toUpperCase() === 'PERCENTAGE'
                          ? `${c.value}%`
                          : `₹${Number(c.value || 0).toLocaleString('en-IN')}`}
                      </span>
                      <span className="text-[10px] text-white/50">
                        Min: ₹{Number(c.minOrderValue ?? c.minCartValue ?? 0).toLocaleString('en-IN')} • Max Cap: ₹
                        {Number(c.maxDiscount || c.value || 0).toLocaleString('en-IN')}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className="text-white block">
                        Budget: ₹{Number(meta.budgetInr || 50000).toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] text-amber-400">
                        Discount Cost: ₹{Number(meta.totalDiscountCostInr || 0).toLocaleString('en-IN')}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className="text-white/80 block text-[11px]">
                        Seg: {meta.eligibleCustomerSegment || 'ALL'}
                      </span>
                      {meta.assignedCustomerEmail && (
                        <span className="block text-[9px] text-[#D4AF37]">
                          Bound: {meta.assignedCustomerEmail}
                        </span>
                      )}
                      <span className="text-[9px] text-white/40 uppercase">
                        {meta.stackingRule || 'EXCLUSIVE'}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className="text-white font-bold block">
                        {c.usageCount ?? c.timesUsed ?? 0} / {c.usageLimit || 100}
                      </span>
                      <span className="text-[10px] text-white/40">
                        {meta.startDate || '2026-01-01'} → {c.expiryDate || '2026-12-31'}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className="text-emerald-400 font-bold block">
                        Rev: ₹{Number(meta.attributedRevenueInr || 0).toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] text-white/60">
                        Est. Profit: ₹{Number(meta.profitabilityEstimateInr || 0).toLocaleString('en-IN')} ({meta.netMarginPercent || 55}% margin)
                      </span>
                    </td>
                    <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => setSelectedCouponHistory(c)}
                        className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/15 text-[#D4AF37] text-[10px] font-bold"
                      >
                        History
                      </button>
                      <button
                        onClick={() => toggleCouponStatus(c.code)}
                        className="px-2.5 py-1 rounded border border-white/20 text-white/70 hover:text-white text-[10px]"
                      >
                        {c.isActive ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 5: DISCOVERY ANALYTICS & 7D / 30D / 60D / 90D COHORTS           */}
      {/* =================================================================== */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* 10 Discovery Analytics KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-4 bg-[#121218] border border-white/10 rounded-xl">
              <span className="text-[10px] text-white/40 uppercase block">1. Discovery Kits Sold</span>
              <div className="text-2xl font-bold text-white mt-1">{analytics.discoveryKitsSold}</div>
              <span className="text-[10px] text-white/40">2 ml & 8 ml verified sets</span>
            </div>

            <div className="p-4 bg-[#121218] border border-white/10 rounded-xl">
              <span className="text-[10px] text-white/40 uppercase block">2. Net Discovery Revenue</span>
              <div className="text-2xl font-bold text-[#D4AF37] mt-1">
                ₹{Number(analytics.netDiscoveryRevenueInr || 0).toLocaleString('en-IN')}
              </div>
              <span className="text-[10px] text-white/40">Excludes refunded kits</span>
            </div>

            <div className="p-4 bg-[#121218] border border-white/10 rounded-xl">
              <span className="text-[10px] text-white/40 uppercase block">3. Cost / Discovery Buyer</span>
              <div className="text-2xl font-bold text-amber-400 mt-1">
                ₹{Number(analytics.costPerDiscoveryCustomerInr || 0).toLocaleString('en-IN')}
              </div>
              <span className="text-[10px] text-white/40">CAC + vial & voucher cost</span>
            </div>

            <div className="p-4 bg-[#121218] border border-white/10 rounded-xl">
              <span className="text-[10px] text-white/40 uppercase block">4. Full-Bottle Conversion</span>
              <div className="text-2xl font-bold text-emerald-400 mt-1">
                {analytics.discoveryToFullBottleConversionPercent}%
              </div>
              <span className="text-[10px] text-white/40">Discovery → 50ml / 100ml</span>
            </div>

            <div className="p-4 bg-[#121218] border border-white/10 rounded-xl">
              <span className="text-[10px] text-white/40 uppercase block">5. Avg Time to Upgrade</span>
              <div className="text-2xl font-bold text-sky-400 mt-1">
                {analytics.avgTimeToUpgradeDays} Days
              </div>
              <span className="text-[10px] text-white/40">From verified delivery</span>
            </div>

            <div className="p-4 bg-[#121218] border border-white/10 rounded-xl">
              <span className="text-[10px] text-white/40 uppercase block">6. Most Selected Scent</span>
              <div className="text-xl font-bold text-[#D4AF37] mt-1">
                {analytics.mostSelectedFragrance}
              </div>
              <span className="text-[10px] text-white/40">Top customer favorite</span>
            </div>

            <div className="p-4 bg-[#121218] border border-white/10 rounded-xl">
              <span className="text-[10px] text-white/40 uppercase block">7. Voucher Redemption Rate</span>
              <div className="text-2xl font-bold text-emerald-400 mt-1">
                {analytics.redemptionRatePercent}%
              </div>
              <span className="text-[10px] text-white/40">
                {analytics.vouchersRedeemed}/{analytics.totalVouchersIssued} redeemed
              </span>
            </div>

            <div className="p-4 bg-[#121218] border border-white/10 rounded-xl">
              <span className="text-[10px] text-white/40 uppercase block">8. Upgrade Net Revenue</span>
              <div className="text-2xl font-bold text-white mt-1">
                ₹{Number(analytics.upgradeRevenueInr || 0).toLocaleString('en-IN')}
              </div>
              <span className="text-[10px] text-white/40">Full-bottle upgrades</span>
            </div>

            <div className="p-4 bg-[#121218] border border-white/10 rounded-xl">
              <span className="text-[10px] text-white/40 uppercase block">9. Upgrade Contrib. Margin</span>
              <div className="text-2xl font-bold text-emerald-400 mt-1">
                ₹{Number(analytics.upgradeContributionMarginInr || 0).toLocaleString('en-IN')}
              </div>
              <span className="text-[10px] text-white/40">Net of voucher & COGS</span>
            </div>

            <div className="p-4 bg-[#121218] border border-white/10 rounded-xl">
              <span className="text-[10px] text-white/40 uppercase block">10. Repeat Purchase Rate</span>
              <div className="text-2xl font-bold text-[#D4AF37] mt-1">
                {analytics.repeatPurchaseRatePercent}%
              </div>
              <span className="text-[10px] text-white/40">2+ paid orders</span>
            </div>
          </div>

          {/* 7-Day, 30-Day, 60-Day, and 90-Day Cohort Table */}
          <div className="bg-[#121218] border border-white/10 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="font-serif text-base uppercase tracking-wider text-white">
                  Discovery Customer Cohort Conversion Windows (7-Day / 30-Day / 60-Day / 90-Day)
                </h3>
                <p className="text-[11px] text-white/50">
                  Tracks cumulative full-bottle upgrades and net contribution margin by acquisition cohort.
                </p>
              </div>
            </div>

            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10 text-white/40 uppercase text-[10px]">
                  <th className="p-3">Cohort Month</th>
                  <th className="p-3">Kits Sold</th>
                  <th className="p-3">Net Discovery Rev</th>
                  <th className="p-3">7-Day Upgrades</th>
                  <th className="p-3">30-Day Upgrades</th>
                  <th className="p-3">60-Day Upgrades</th>
                  <th className="p-3">90-Day Upgrades</th>
                  <th className="p-3">Upgrade Net Revenue</th>
                  <th className="p-3">Contribution Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {(dashboard?.cohorts || []).map((c: any) => {
                  const pct = (n: number) =>
                    c.kitsSold > 0 ? `${Math.round((n / c.kitsSold) * 100)}%` : '0%';
                  return (
                    <tr key={c.cohortMonth} className="hover:bg-white/[0.02]">
                      <td className="p-3 font-bold text-white">{c.cohortMonth}</td>
                      <td className="p-3 text-white">{c.kitsSold}</td>
                      <td className="p-3 text-[#D4AF37]">
                        ₹{Number(c.netDiscoveryRevenueInr || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="p-3 text-emerald-400">
                        {c.converted7d} ({pct(c.converted7d)})
                      </td>
                      <td className="p-3 text-emerald-400">
                        {c.converted30d} ({pct(c.converted30d)})
                      </td>
                      <td className="p-3 text-sky-400">
                        {c.converted60d} ({pct(c.converted60d)})
                      </td>
                      <td className="p-3 text-[#D4AF37] font-bold">
                        {c.converted90d} ({pct(c.converted90d)})
                      </td>
                      <td className="p-3 font-bold text-white">
                        ₹{Number(c.upgradeRevenueInr || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="p-3 font-bold text-emerald-400">
                        ₹{Number(c.upgradeMarginInr || 0).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: 10-STEP DISCOVERY JOURNEY ORCHESTRATOR                       */}
      {/* =================================================================== */}
      {selectedJourney && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedJourney(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto"
        >
          <div className="bg-[#0E0E14] border border-white/15 w-full max-w-3xl my-auto max-h-[90vh] overflow-y-auto rounded-2xl p-6 text-[#F3EFE6] space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="font-serif text-xl uppercase tracking-wider text-white">
                  Discovery Journey — {selectedJourney.orderNumber} ({selectedJourney.configurationName})
                </h3>
                <p className="text-xs text-white/50">
                  Buyer: {selectedJourney.customerName} ({selectedJourney.customerEmail}) • Vial:{' '}
                  {selectedJourney.vialSize} • Stage: {selectedJourney.journeyStatus}
                </p>
              </div>
              <button
                onClick={() => setSelectedJourney(null)}
                className="text-white/40 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step 3, 4 & 5: Delivery Gate & Fragrance Education */}
            <div className="p-4 bg-[#121218] border border-white/10 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <strong className="text-xs uppercase text-[#D4AF37]">
                  Step 3–5: Delivery Gate & Fragrance Education
                </strong>
                <span className="text-[10px] text-white/40">
                  Current Delivery Status: {selectedJourney.deliveryStatus}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() =>
                    handleConfirmDiscoveryDelivery(
                      selectedJourney.id,
                      'TRUSTED_CARRIER_WEBHOOK'
                    )
                  }
                  className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 rounded font-bold text-[11px]"
                >
                  Confirm Delivery (Trusted Carrier) → Start Journey & Send Education
                </button>
                <button
                  onClick={() =>
                    handleConfirmDiscoveryDelivery(selectedJourney.id, 'UNVERIFIED_PING')
                  }
                  className="px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 rounded font-bold text-[11px]"
                >
                  Test Unverified Delivery Block
                </button>
                <button
                  onClick={() => handleRevokeDiscoveryJourney(selectedJourney.id)}
                  className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 rounded font-bold text-[11px]"
                >
                  Refund / Cancel Discovery (Revoke Benefit)
                </button>
              </div>
            </div>

            {/* Step 6, 7 & 8: Select Favorite Fragrance, Issue Benefit & Show Eligible Full Bottles */}
            <div className="p-4 bg-[#121218] border border-white/10 rounded-xl space-y-3">
              <strong className="text-xs uppercase text-[#D4AF37] block">
                Step 6–8: Favorite Fragrance Selection & Dynamic Redemption Voucher
              </strong>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={favoriteChoice}
                  onChange={(e) => {
                    setFavoriteChoice(e.target.value);
                    setUpgradeProductChoice(e.target.value);
                  }}
                  className="bg-[#08080A] border border-white/20 rounded px-3 py-2 text-white"
                >
                  {(selectedJourney.includedFragrances || ['AZURE', 'IGNITE', 'ROSELLE', 'ÉLAN', 'SUEDE', 'SOLARA']).map(
                    (f: string) => (
                      <option key={f} value={f}>
                        Favorite: {f}
                      </option>
                    )
                  )}
                </select>
                <button
                  onClick={() => handleSelectFavoriteAndIssueVoucher(selectedJourney.id)}
                  className="px-4 py-2 bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] font-bold rounded uppercase text-[11px]"
                >
                  Record Favorite & Issue Eligible Redemption Voucher
                </button>
              </div>

              {/* Eligible Full-Bottle Products */}
              <div className="pt-2">
                <span className="text-[10px] text-white/50 uppercase block mb-2">
                  Eligible In-Stock Full-Bottle Products ({(selectedJourney.eligibleFullBottleProducts || []).length})
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(selectedJourney.eligibleFullBottleProducts || []).slice(0, 4).map((prod: any) => (
                    <div
                      key={prod.sku}
                      className="p-2.5 bg-black/40 border border-white/10 rounded-lg text-[10px]"
                    >
                      <strong className="text-white block">{prod.name}</strong>
                      <span className="text-[#D4AF37] font-bold">
                        {prod.size} • ₹{Number(prod.priceInr).toLocaleString('en-IN')}
                      </span>
                      <span className="block text-emerald-400 text-[9px]">
                        In Stock: {prod.availableStock} units
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Step 9 & 10: Redeem Voucher on Full-Bottle Upgrade & Complete Journey */}
            {selectedJourney.issuedVoucherCode && (
              <div className="p-4 bg-[#121218] border border-[#D4AF37]/40 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <strong className="text-xs uppercase text-emerald-400">
                    Step 9–10: Redeem Voucher ({selectedJourney.issuedVoucherCode}) & Record Full-Bottle Upgrade
                  </strong>
                  <span className="text-[10px] text-[#D4AF37]">
                    Value: ₹{selectedJourney.voucherAmountInr}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input
                    type="text"
                    value={upgradeProductChoice}
                    onChange={(e) => setUpgradeProductChoice(e.target.value)}
                    className="bg-[#08080A] border border-white/20 rounded px-3 py-2 text-white"
                    placeholder="Product Name"
                  />
                  <select
                    value={upgradeSizeChoice}
                    onChange={(e) => setUpgradeSizeChoice(e.target.value)}
                    className="bg-[#08080A] border border-white/20 rounded px-3 py-2 text-white"
                  >
                    <option value="100 ml">100 ml Flacon</option>
                    <option value="50 ml">50 ml Flacon</option>
                  </select>
                  <input
                    type="number"
                    value={upgradeGrossPrice}
                    onChange={(e) => setUpgradeGrossPrice(Number(e.target.value))}
                    className="bg-[#08080A] border border-white/20 rounded px-3 py-2 text-white"
                  />
                  <button
                    onClick={() => handleRedeemVoucherUpgrade(selectedJourney)}
                    className="px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-[#08080A] font-bold rounded uppercase text-[11px]"
                  >
                    Complete Upgrade
                  </button>
                </div>
              </div>
            )}

            {/* Journey Timeline */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase text-white/70 block">
                Auditable Discovery Journey Timeline
              </span>
              <div className="bg-[#121218] border border-white/10 rounded-xl p-4 space-y-2 max-h-48 overflow-y-auto">
                {(selectedJourney.journeyTimeline || []).map((ev: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-start justify-between border-b border-white/5 pb-2 last:border-none"
                  >
                    <div>
                      <span className="px-2 py-0.5 rounded bg-[#D4AF37]/15 text-[#D4AF37] font-bold text-[10px]">
                        {ev.stage}
                      </span>
                      <p className="text-white/90 text-xs mt-1">{ev.details}</p>
                    </div>
                    <span className="text-[10px] text-white/40">
                      {new Date(ev.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REGISTER DISCOVERY PURCHASE */}
      {registerModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setRegisterModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
        >
          <div className="bg-[#0E0E14] border border-white/15 w-full max-w-md rounded-2xl p-6 text-[#F3EFE6] space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-serif text-lg uppercase tracking-wider text-white">
                Register Verified Discovery Purchase
              </h3>
              <button onClick={() => setRegisterModalOpen(false)} className="text-white/40">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleRegisterDiscoveryOrder} className="space-y-3">
              <div>
                <label className="block text-white/60 mb-1">Customer Full Name</label>
                <input
                  type="text"
                  required
                  value={discCustName}
                  onChange={(e) => setDiscCustName(e.target.value)}
                  className="w-full bg-[#08080A] border border-white/20 rounded p-2 text-white"
                />
              </div>
              <div>
                <label className="block text-white/60 mb-1">Customer Email</label>
                <input
                  type="email"
                  required
                  value={discCustEmail}
                  onChange={(e) => setDiscCustEmail(e.target.value)}
                  className="w-full bg-[#08080A] border border-white/20 rounded p-2 text-white"
                />
              </div>
              <div>
                <label className="block text-white/60 mb-1">Discovery Configuration (2ml / 10ml)</label>
                <select
                  value={discConfigCode}
                  onChange={(e) => setDiscConfigCode(e.target.value)}
                  className="w-full bg-[#08080A] border border-white/20 rounded p-2 text-white"
                >
                  <option value="DISCOVERY_SIX_2ML">Discovery Six — 6 × 2 ml (₹499)</option>
                  <option value="DISCOVERY_SIX_10ML">Discovery Six Deluxe — 6 × 10 ml (₹1,499 · MRP ₹1,999)</option>
                  <option value="SIGNATURE_TRIO_8ML">Signature Extrait Trio — 3 × 8 ml (₹1,499)</option>
                  <option value="DEVOTIONAL_QUARTET_2ML">Sacred Aura Quartet — 4 × 2 ml (₹799)</option>
                </select>
              </div>
              <div>
                <label className="block text-white/60 mb-1">Initial Delivery Status</label>
                <select
                  value={discOrderStatus}
                  onChange={(e) => setDiscOrderStatus(e.target.value)}
                  className="w-full bg-[#08080A] border border-white/20 rounded p-2 text-white"
                >
                  <option value="CONFIRMED">Awaiting Dispatch (Holds Journey Until Delivered)</option>
                  <option value="DELIVERED">Already Delivered (Starts Journey Immediately)</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setRegisterModalOpen(false)}
                  className="px-4 py-2 border border-white/20 rounded text-white/70"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#D4AF37] text-[#08080A] font-bold rounded uppercase"
                >
                  Register Discovery Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EXECUTE LOYALTY BENEFIT */}
      {execLoyaltyModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setExecLoyaltyModal(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
        >
          <div className="bg-[#0E0E14] border border-white/15 w-full max-w-md rounded-2xl p-6 text-[#F3EFE6] space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-serif text-lg uppercase tracking-wider text-white">
                Trigger Loyalty Benefit — {execLoyaltyModal.name}
              </h3>
              <button onClick={() => setExecLoyaltyModal(null)} className="text-white/40">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleExecuteLoyaltyBenefit} className="space-y-3">
              <div>
                <label className="block text-white/60 mb-1">Customer Email</label>
                <input
                  type="email"
                  required
                  value={loyCustomerEmail}
                  onChange={(e) => setLoyCustomerEmail(e.target.value)}
                  className="w-full bg-[#08080A] border border-white/20 rounded p-2 text-white"
                />
              </div>
              <div>
                <label className="block text-white/60 mb-1">Customer Name</label>
                <input
                  type="text"
                  required
                  value={loyCustomerName}
                  onChange={(e) => setLoyCustomerName(e.target.value)}
                  className="w-full bg-[#08080A] border border-white/20 rounded p-2 text-white"
                />
              </div>
              {execLoyaltyModal.ruleType === 'BIRTHDAY_OFFER' && (
                <div>
                  <label className="block text-white/60 mb-1">
                    Voluntarily Provided Birthday (Leave empty to test guard)
                  </label>
                  <input
                    type="date"
                    value={loyVoluntaryBirthday}
                    onChange={(e) => setLoyVoluntaryBirthday(e.target.value)}
                    className="w-full bg-[#08080A] border border-white/20 rounded p-2 text-white"
                  />
                </div>
              )}
              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setExecLoyaltyModal(null)}
                  className="px-4 py-2 border border-white/20 rounded text-white/70"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#D4AF37] text-[#08080A] font-bold rounded uppercase"
                >
                  Execute Benefit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: COUPON REDEMPTION HISTORY & PROFITABILITY */}
      {selectedCouponHistory && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedCouponHistory(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
        >
          <div className="bg-[#0E0E14] border border-white/15 w-full max-w-xl rounded-2xl p-6 text-[#F3EFE6] space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="font-serif text-lg uppercase tracking-wider text-white">
                  Coupon Audit & Profitability — {selectedCouponHistory.code}
                </h3>
                <p className="text-[11px] text-white/50">
                  Owner: {selectedCouponHistory.couponMetadata?.campaignOwner || 'FRAGMORÉ Growth Desk'}
                </p>
              </div>
              <button onClick={() => setSelectedCouponHistory(null)} className="text-white/40">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {(selectedCouponHistory.couponMetadata?.redemptionHistory || []).length === 0 ? (
                <div className="text-white/40 text-xs py-6 text-center">
                  No verified paid order redemptions recorded for this coupon code yet.
                </div>
              ) : (
                (selectedCouponHistory.couponMetadata?.redemptionHistory || []).map(
                  (r: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-3 bg-[#121218] border border-white/10 rounded-lg flex items-center justify-between"
                    >
                      <div>
                        <strong className="text-white block">{r.orderNumber}</strong>
                        <span className="text-[10px] text-white/50">{r.customerEmail}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-emerald-400 font-bold block">
                          Net Rev: ₹{Number(r.orderAmountInr).toLocaleString('en-IN')}
                        </span>
                        <span className="text-[10px] text-amber-400">
                          Discount: ₹{r.discountAppliedInr} • Margin: ₹{r.netContributionMarginInr}
                        </span>
                      </div>
                    </div>
                  )
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* CREATE ENTERPRISE COUPON MODAL */}
      {isModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto"
        >
          <div className="bg-[#0E0E14] border border-white/15 w-full max-w-2xl my-auto rounded-2xl p-6 sm:p-8 relative text-[#F3EFE6]">
            <h3 className="font-serif text-xl uppercase tracking-wider text-white mb-4">
              Create Enterprise Privilege Coupon
            </h3>
            <form onSubmit={handleCreateEnterpriseCoupon} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-white/60 mb-1">Coupon Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ATELIER15"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                    className="w-full bg-[#08080A] border border-white/20 rounded p-2.5 text-white font-bold uppercase"
                  />
                </div>
                <div>
                  <label className="block text-white/60 mb-1">Campaign Owner *</label>
                  <input
                    type="text"
                    required
                    value={newCampaignOwner}
                    onChange={(e) => setNewCampaignOwner(e.target.value)}
                    className="w-full bg-[#08080A] border border-white/20 rounded p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-white/60 mb-1">Campaign Budget (₹)</label>
                  <input
                    type="number"
                    value={newBudgetInr}
                    onChange={(e) => setNewBudgetInr(Number(e.target.value))}
                    className="w-full bg-[#08080A] border border-white/20 rounded p-2.5 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-white/60 mb-1">Discount Type</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as any)}
                    className="w-full bg-[#08080A] border border-white/20 rounded p-2.5 text-white"
                  >
                    <option value="PERCENTAGE">PERCENTAGE (%)</option>
                    <option value="FLAT">FLAT AMOUNT (₹)</option>
                    <option value="DISCOVERY_VOUCHER">DISCOVERY VOUCHER</option>
                    <option value="LOYALTY_REWARD">LOYALTY REWARD</option>
                  </select>
                </div>
                <div>
                  <label className="block text-white/60 mb-1">Value</label>
                  <input
                    type="number"
                    value={newValue}
                    onChange={(e) => setNewValue(Number(e.target.value))}
                    className="w-full bg-[#08080A] border border-white/20 rounded p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-white/60 mb-1">Max Discount (₹)</label>
                  <input
                    type="number"
                    value={newMaxDiscount}
                    onChange={(e) => setNewMaxDiscount(Number(e.target.value))}
                    className="w-full bg-[#08080A] border border-white/20 rounded p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-white/60 mb-1">Min Purchase (₹)</label>
                  <input
                    type="number"
                    value={newMin}
                    onChange={(e) => setNewMin(Number(e.target.value))}
                    className="w-full bg-[#08080A] border border-white/20 rounded p-2.5 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-white/60 mb-1">Total Usage Limit</label>
                  <input
                    type="number"
                    value={newUsageLimit}
                    onChange={(e) => setNewUsageLimit(Number(e.target.value))}
                    className="w-full bg-[#08080A] border border-white/20 rounded p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-white/60 mb-1">Per-Customer Limit</label>
                  <input
                    type="number"
                    value={newPerCustLimit}
                    onChange={(e) => setNewPerCustLimit(Number(e.target.value))}
                    className="w-full bg-[#08080A] border border-white/20 rounded p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-white/60 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="w-full bg-[#08080A] border border-white/20 rounded p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-white/60 mb-1">End Date</label>
                  <input
                    type="date"
                    value={newExpiryDate}
                    onChange={(e) => setNewExpiryDate(e.target.value)}
                    className="w-full bg-[#08080A] border border-white/20 rounded p-2.5 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-white/60 mb-1">Eligible Customers</label>
                  <select
                    value={newEligibleSegment}
                    onChange={(e) => setNewEligibleSegment(e.target.value)}
                    className="w-full bg-[#08080A] border border-white/20 rounded p-2.5 text-white"
                  >
                    <option value="ALL">All Customers</option>
                    <option value="Discovery Buyers">Discovery Buyers</option>
                    <option value="VIP Customers">VIP Customers (₹5,000+)</option>
                    <option value="First-Time Buyers">First-Time Buyers</option>
                    <option value="Repeat Buyers">Repeat Buyers</option>
                  </select>
                </div>
                <div>
                  <label className="block text-white/60 mb-1">Eligible Products</label>
                  <select
                    value={newEligibleProducts}
                    onChange={(e) => setNewEligibleProducts(e.target.value)}
                    className="w-full bg-[#08080A] border border-white/20 rounded p-2.5 text-white"
                  >
                    <option value="ALL_FULL_BOTTLES">All Full Bottles (50ml & 100ml)</option>
                    <option value="SIGNATURE_COLLECTION">Signature Extrait Collection</option>
                    <option value="DEVOTIONAL_COLLECTION">Devotional & Sacred Collection</option>
                  </select>
                </div>
                <div>
                  <label className="block text-white/60 mb-1">Stacking Rules</label>
                  <select
                    value={newStackingRule}
                    onChange={(e) => setNewStackingRule(e.target.value as any)}
                    className="w-full bg-[#08080A] border border-white/20 rounded p-2.5 text-white"
                  >
                    <option value="EXCLUSIVE">Exclusive (Non-Stackable)</option>
                    <option value="STACKABLE_WITH_LOYALTY">Stackable with Loyalty Only</option>
                    <option value="STACKABLE_WITH_ALL">Stackable with All</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-white/60 mb-1">
                    Customer-Specific Email Binding (Optional)
                  </label>
                  <input
                    type="email"
                    placeholder="Leave blank for segment-wide eligibility"
                    value={newAssignedEmail}
                    onChange={(e) => setNewAssignedEmail(e.target.value)}
                    className="w-full bg-[#08080A] border border-white/20 rounded p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-white/60 mb-1">Description</label>
                  <input
                    type="text"
                    placeholder="e.g. Exclusive 15% privilege for Discovery upgrades"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="w-full bg-[#08080A] border border-white/20 rounded p-2.5 text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-white/20 rounded text-white/70"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] font-bold uppercase rounded"
                >
                  Create Enterprise Coupon
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
