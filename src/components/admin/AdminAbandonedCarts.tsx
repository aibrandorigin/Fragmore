import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../../context/StoreContext';
import { ErpTableExportBar } from './erp/ErpUniversalExportModal';
import {
  MessageSquare,
  Mail,
  RotateCcw,
  CheckCircle2,
  Ticket,
  Trash2,
  Search,
  ShieldAlert,
  Settings2,
  Play,
  Clock,
  AlertTriangle,
  Sparkles,
  ExternalLink,
  Ban,
  Activity,
  ChevronRight,
  Lock,
  FlaskConical,
  RefreshCw,
  Check,
  X
} from 'lucide-react';

interface ProviderStatus {
  whatsapp: {
    providerName: string;
    connected: boolean;
    statusLabel: 'Connected' | 'Integration required';
    costPerMessageInr: number;
  };
  email: {
    providerName: string;
    connected: boolean;
    statusLabel: 'Connected' | 'Integration required';
    costPerMessageInr: number;
  };
  sms: {
    providerName: string;
    connected: boolean;
    statusLabel: 'Connected' | 'Integration required';
    costPerMessageInr: number;
  };
}

interface DashboardKpis {
  eligibleAbandonedCarts: number;
  totalAbandonedValueInr: number;
  contactableAbandonedCarts: number;
  anonymousNonContactableCarts: number;
  recoveryMessagesAttempted: number;
  messagesDelivered: number;
  recoveredCarts: number;
  directRecoveredCarts: number;
  assistedRecoveredCarts: number;
  manuallyMarkedCarts: number;
  recoveredNetRevenueInr: number;
  directRecoveredNetRevenueInr: number;
  assistedRecoveredNetRevenueInr: number;
  recoveryConversionRatePercent: number;
  discountsIssuedCount: number;
  totalDiscountValueRedeemedInr: number;
  recoveryContributionMarginInr: number;
  recoveryContributionMarginPercent: number;
  recoveryCostInr: number;
}

interface SmartCouponEngineConfig {
  enabled: boolean;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
  maxDiscountCapInr: number;
  minCartValueInr: number;
  singleUseOnly: boolean;
  expiryHours: number;
  excludedProductSlugs: string[];
  customerSpecificAssignment: boolean;
  minGrossMarginPercent: number;
  estimatedCogsPercent: number;
  campaignBudgetLimitInr: number;
  campaignBudgetSpentInr: number;
}

interface EngineConfig {
  inactivityMinutes: number;
  attributionWindowHours: number;
  enableT48hFinalReminder: boolean;
  maxRemindersPerCart: number;
  quietHoursStart: number;
  quietHoursEnd: number;
  smartCoupon: SmartCouponEngineConfig;
}

interface EnrichedCart {
  id: string;
  anonymousCartId: string;
  customerId: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  isAnonymous: boolean;
  isContactable: boolean;
  items: Array<{
    productId: string;
    productName: string;
    slug?: string;
    variantId: string;
    size: string;
    sku: string;
    sellingPrice: number;
    mrp?: number;
    quantity: number;
  }>;
  cartValue: number;
  couponCode: string | null;
  status: string;
  lastActivity: string;
  recoverySentEmail: boolean;
  recoverySentWhatsApp: boolean;
  recoverySentSMS: boolean;
  attribution: Record<string, any>;
  recoveryMetadata: {
    anonymousCartId?: string;
    customerId?: string | null;
    isAnonymous?: boolean;
    paymentResult?: 'NONE' | 'PENDING' | 'SUCCEEDED' | 'FAILED';
    consent?: {
      emailOptIn: boolean;
      whatsappOptIn: boolean;
      smsOptIn: boolean;
      unsubscribed: boolean;
    };
    workflowSuppressed?: boolean;
    suppressedReason?: string | null;
    manuallyMarkedRecovered?: boolean;
    recoveredOrderId?: string | null;
    recoveredOrderNumber?: string | null;
    recoveredNetRevenueInr?: number;
    recoveryAttributionType?: 'DIRECT' | 'ASSISTED' | 'MANUAL_NON_REVENUE' | 'ORGANIC_BEFORE_REMINDER' | null;
    smartCouponIssued?: {
      code: string;
      discountType: 'PERCENTAGE' | 'FIXED';
      discountValue: number;
      maxDiscountCapInr: number;
      minCartValueInr: number;
      expiresAt: string;
      singleUse: boolean;
      marginAfterDiscountPercent: number;
    } | null;
    sequenceSteps?: Record<
      'T_PLUS_30M' | 'T_PLUS_6H' | 'T_PLUS_24H' | 'T_PLUS_48H',
      {
        stepId: string;
        label: string;
        offsetMinutes: number;
        status: 'PENDING' | 'SENT' | 'DELIVERED' | 'SKIPPED' | 'CANCELLED' | 'FAILED' | 'INTEGRATION_REQUIRED';
        scheduledFor?: string | null;
        executedAt?: string | null;
        channel?: string | null;
        couponCode?: string | null;
        reason?: string | null;
      }
    >;
    messageAttempts?: Array<{
      id: string;
      stepId: string;
      channel: string;
      attemptedAt: string;
      deliveryStatus: string;
      providerName: string;
      errorReason?: string | null;
      couponCode?: string | null;
      costInr: number;
    }>;
  };
  eligibility: {
    isAbandoned: boolean;
    isContactable: boolean;
    minutesInactive: number;
    blockReasons: string[];
    permittedChannels: ('whatsapp' | 'email' | 'sms')[];
  };
  linkedPaidOrder: {
    id: string;
    orderNumber: string;
    netRevenueInr: number;
    attributionType: 'DIRECT' | 'ASSISTED' | 'ORGANIC';
    createdAt: string;
  } | null;
}

interface VerificationTestResult {
  id: string;
  scenario: string;
  passed: boolean;
  details: string;
}

export const AdminAbandonedCarts: React.FC = () => {
  const {
    abandonedCarts,
    markCartRecovered,
    deleteAbandonedCart,
    showNotification
  } = useStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ELIGIBLE' | 'RECOVERED' | 'ANONYMOUS' | 'SUPPRESSED'>('ALL');
  const [dashboardData, setDashboardData] = useState<{
    kpis: DashboardKpis;
    providers: ProviderStatus;
    config: EngineConfig;
    carts: EnrichedCart[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingQueue, setProcessingQueue] = useState(false);
  const [selectedCart, setSelectedCart] = useState<EnrichedCart | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [configDraft, setConfigDraft] = useState<EngineConfig | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [testSuiteResults, setTestSuiteResults] = useState<{
    allPassed: boolean;
    passedCount: number;
    totalCount: number;
    results: VerificationTestResult[];
  } | null>(null);
  const [runningTests, setRunningTests] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/abandoned-carts/dashboard');
      if (!res.ok) throw new Error('Failed to load dashboard');
      const data = await res.json();
      setDashboardData(data);
      if (!configDraft && data.config) {
        setConfigDraft(data.config);
      }
      if (selectedCart) {
        const updated = (data.carts || []).find((c: EnrichedCart) => c.id === selectedCart.id);
        if (updated) setSelectedCart(updated);
      }
    } catch (err) {
      console.warn('[AdminAbandonedCarts] Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [configDraft, selectedCart]);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleProcessDueQueue = async () => {
    setProcessingQueue(true);
    try {
      const res = await fetch('/api/abandoned-carts/process-due', { method: 'POST' });
      const data = await res.json();
      showNotification(
        `Processed ${data.processedCarts || 0} carts (${data.stepsTriggered || 0} sequence steps evaluated).`
      );
      await fetchDashboard();
    } catch {
      showNotification('Failed to process due recovery sequence queue.');
    } finally {
      setProcessingQueue(false);
    }
  };

  const handleExecuteSequenceStep = async (
    cartId: string,
    stepId: 'T_PLUS_30M' | 'T_PLUS_6H' | 'T_PLUS_24H' | 'T_PLUS_48H',
    preferredChannel?: 'whatsapp' | 'email'
  ) => {
    try {
      const res = await fetch(`/api/abandoned-carts/${encodeURIComponent(cartId)}/execute-step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepId, preferredChannel, forceNow: true })
      });
      const data = await res.json();
      if (data.deliveryStatus === 'DELIVERED') {
        showNotification(`Step ${stepId} delivered via ${data.channel?.toUpperCase()}.`);
      } else if (data.deliveryStatus === 'INTEGRATION_REQUIRED') {
        showNotification(
          `${stepId}: Provider not connected ('Integration required'). Logged without faking delivery.${
            data.couponIssued ? ` Smart Coupon ${data.couponIssued} issued.` : ''
          }`
        );
      } else {
        showNotification(`${stepId}: ${data.reason || data.deliveryStatus}`);
      }
      await fetchDashboard();
    } catch {
      showNotification(`Failed to execute step ${stepId}.`);
    }
  };

  const handleSafeManualWorkflow = async (
    cart: EnrichedCart,
    channel: 'whatsapp' | 'email',
    couponCode?: string
  ) => {
    if (cart.isAnonymous || !cart.isContactable) {
      showNotification('Blocked: Anonymous cart has no verified contact details.');
      return;
    }

    try {
      const res = await fetch(`/api/abandoned-carts/${encodeURIComponent(cart.id)}/manual-workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          couponCode: couponCode || cart.couponCode || undefined,
          adminEmail: 'admin@fragmore.com',
          notes: `Manual ${channel} outreach recorded via Admin Recovery Console`
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        showNotification(data.error || 'Manual workflow blocked by eligibility rules.');
        return;
      }
      showNotification(
        `Manual ${channel.toUpperCase()} workflow recorded safely (provider status: Integration required).`
      );
      await fetchDashboard();
    } catch {
      showNotification('Failed to record manual workflow.');
    }
  };

  const handleEvaluateOrIssueSmartCoupon = async (cartId: string) => {
    try {
      const res = await fetch(`/api/abandoned-carts/${encodeURIComponent(cartId)}/execute-step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepId: 'T_PLUS_24H', forceNow: true })
      });
      const data = await res.json();
      if (data.couponIssued) {
        showNotification(`Smart Coupon "${data.couponIssued}" issued after passing margin & eligibility rules.`);
      } else {
        showNotification(data.reason || 'Cart did not qualify for a discount under Smart Coupon Engine rules.');
      }
      await fetchDashboard();
    } catch {
      showNotification('Smart Coupon evaluation failed.');
    }
  };

  const handleToggleSuppress = async (cart: EnrichedCart) => {
    const currentlySuppressed = !!cart.recoveryMetadata?.workflowSuppressed;
    try {
      await fetch(`/api/abandoned-carts/${encodeURIComponent(cart.id)}/suppress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suppressed: !currentlySuppressed,
          reason: !currentlySuppressed ? 'Suppressed by Admin in Recovery Console' : null
        })
      });
      showNotification(
        !currentlySuppressed
          ? `Recovery sequence suppressed for cart #${cart.id}.`
          : `Recovery sequence re-enabled for cart #${cart.id}.`
      );
      await fetchDashboard();
    } catch {
      showNotification('Failed to update workflow suppression state.');
    }
  };

  const handleSaveConfig = async () => {
    if (!configDraft) return;
    setSavingConfig(true);
    try {
      const res = await fetch('/api/abandoned-carts/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configDraft)
      });
      if (!res.ok) throw new Error('Save failed');
      const data = await res.json();
      setConfigDraft(data.config);
      setIsConfigOpen(false);
      showNotification('Abandonment rule & Smart Coupon Engine configuration saved.');
      await fetchDashboard();
    } catch {
      showNotification('Failed to save configuration.');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleRunVerificationTests = async () => {
    setRunningTests(true);
    try {
      const res = await fetch('/api/abandoned-carts/run-tests', { method: 'POST' });
      const data = await res.json();
      setTestSuiteResults(data);
      showNotification(
        `Verification Suite: ${data.passedCount}/${data.totalCount} scenarios passed.`
      );
      await fetchDashboard();
    } catch {
      showNotification('Failed to execute verification test suite.');
    } finally {
      setRunningTests(false);
    }
  };

  // Merge server carts with fallback store carts so historical valid data is always preserved
  const cartsList: EnrichedCart[] = dashboardData?.carts?.length
    ? dashboardData.carts
    : abandonedCarts.map((ac) => {
        const hasContact = Boolean(ac.customerEmail?.trim() || ac.customerPhone?.trim());
        const custId = (ac as any).customerId || null;
        return {
          id: ac.id,
          anonymousCartId: `anon-${ac.id}`,
          customerId: custId,
          customerName: hasContact ? ac.customerName || '' : '',
          customerEmail: ac.customerEmail || '',
          customerPhone: ac.customerPhone || '',
          isAnonymous: !custId && !hasContact,
          isContactable: hasContact,
          items: ac.items || [],
          cartValue: ac.cartValue || 0,
          couponCode: ac.couponCode || null,
          status: ac.status || 'ABANDONED',
          lastActivity: ac.lastActivity || '',
          recoverySentEmail: Boolean(ac.recoverySentEmail),
          recoverySentWhatsApp: Boolean(ac.recoverySentWhatsApp),
          recoverySentSMS: Boolean(ac.recoverySentSMS),
          attribution: ac.attribution || {},
          recoveryMetadata: {},
          eligibility: {
            isAbandoned: ac.status === 'ABANDONED',
            isContactable: hasContact,
            minutesInactive: 45,
            blockReasons: [],
            permittedChannels: hasContact ? ['whatsapp', 'email'] : []
          },
          linkedPaidOrder: null
        };
      });

  const kpis: DashboardKpis = dashboardData?.kpis || {
    eligibleAbandonedCarts: cartsList.filter((c) => c.eligibility?.isAbandoned).length,
    totalAbandonedValueInr: cartsList
      .filter((c) => c.status === 'ABANDONED')
      .reduce((s, c) => s + c.cartValue, 0),
    contactableAbandonedCarts: cartsList.filter((c) => c.eligibility?.isAbandoned && c.isContactable).length,
    anonymousNonContactableCarts: cartsList.filter((c) => !c.isContactable).length,
    recoveryMessagesAttempted: 0,
    messagesDelivered: 0,
    recoveredCarts: 0,
    directRecoveredCarts: 0,
    assistedRecoveredCarts: 0,
    manuallyMarkedCarts: 0,
    recoveredNetRevenueInr: 0,
    directRecoveredNetRevenueInr: 0,
    assistedRecoveredNetRevenueInr: 0,
    recoveryConversionRatePercent: 0,
    discountsIssuedCount: 0,
    totalDiscountValueRedeemedInr: 0,
    recoveryContributionMarginInr: 0,
    recoveryContributionMarginPercent: 0,
    recoveryCostInr: 0
  };

  const providers: ProviderStatus = dashboardData?.providers || {
    whatsapp: {
      providerName: 'Meta WhatsApp Business Cloud API',
      connected: false,
      statusLabel: 'Integration required',
      costPerMessageInr: 0.85
    },
    email: {
      providerName: 'Transactional & Recovery Email Relay',
      connected: false,
      statusLabel: 'Integration required',
      costPerMessageInr: 0.12
    },
    sms: {
      providerName: 'DLT SMS Gateway',
      connected: false,
      statusLabel: 'Integration required',
      costPerMessageInr: 0.25
    }
  };

  const filteredCarts = cartsList.filter((ac) => {
    const matchesSearch =
      !searchTerm.trim() ||
      (ac.customerEmail || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ac.customerPhone || '').includes(searchTerm) ||
      (ac.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ac.anonymousCartId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      ac.id.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'ELIGIBLE') return ac.eligibility?.isAbandoned;
    if (statusFilter === 'RECOVERED') return ac.status === 'RECOVERED' || Boolean(ac.linkedPaidOrder);
    if (statusFilter === 'ANONYMOUS') return ac.isAnonymous || !ac.isContactable;
    if (statusFilter === 'SUPPRESSED') return Boolean(ac.recoveryMetadata?.workflowSuppressed);
    return true;
  });

  const stepOrder: Array<'T_PLUS_30M' | 'T_PLUS_6H' | 'T_PLUS_24H' | 'T_PLUS_48H'> = [
    'T_PLUS_30M',
    'T_PLUS_6H',
    'T_PLUS_24H',
    'T_PLUS_48H'
  ];

  const stepShortLabels: Record<'T_PLUS_30M' | 'T_PLUS_6H' | 'T_PLUS_24H' | 'T_PLUS_48H', string> = {
    T_PLUS_30M: 'T+30m',
    T_PLUS_6H: 'T+6h',
    T_PLUS_24H: 'T+24h',
    T_PLUS_48H: 'T+48h'
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-mono text-xs">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-6 border-b border-white/10 gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="font-serif text-2xl uppercase tracking-wider text-white">
              Abandoned Cart Recovery Engine & Revenue Recapture
            </h2>
            <span className="px-2.5 py-0.5 rounded bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#E5C378] text-[10px] font-bold uppercase">
              {dashboardData?.config?.inactivityMinutes || 30}m Abandonment Rule
            </span>
          </div>
          <p className="text-xs text-white/50 mt-1">
            Automated T+30m / T+6h / T+24h / T+48h recovery orchestration, Smart Coupon margin protection, and verified order attribution.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <ErpTableExportBar
            reportKey="custom_table"
            title="FRAGMORÉ Abandoned Cart Recovery Register"
            customRows={filteredCarts.map((ac: any) => ({
              cartId: ac.id,
              customerName: ac.customerName || 'Anonymous Visitor',
              customerEmail: ac.customerEmail || '',
              customerPhone: ac.customerPhone || '',
              cartValueInr: Number(ac.totalValue || ac.cartValue || 0),
              abandonedAt: ac.abandonedAt || ac.updatedAt || '',
              status: ac.status || (ac.linkedPaidOrder ? 'RECOVERED' : 'ABANDONED')
            }))}
            notify={(m) => showNotification(m)}
          />
          <button
            onClick={handleProcessDueQueue}
            disabled={processingQueue}
            className="px-3.5 py-2 bg-[#D4AF37] hover:bg-[#e3be42] text-black font-bold rounded-lg flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" />
            {processingQueue ? 'Evaluating Queue...' : 'Run Due Recovery Sequence'}
          </button>

          <button
            onClick={() => setIsConfigOpen(true)}
            className="px-3.5 py-2 bg-white/10 hover:bg-white/15 text-white rounded-lg flex items-center gap-1.5 border border-white/10 transition"
          >
            <Settings2 className="w-3.5 h-3.5 text-[#D4AF37]" />
            Smart Coupon & Rules
          </button>

          <button
            onClick={handleRunVerificationTests}
            disabled={runningTests}
            className="px-3.5 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 rounded-lg flex items-center gap-1.5 font-bold transition disabled:opacity-50"
          >
            <FlaskConical className="w-3.5 h-3.5" />
            {runningTests ? 'Running 10 Tests...' : 'Verify 10 Scenarios'}
          </button>

          <button
            onClick={fetchDashboard}
            className="p-2 bg-white/5 hover:bg-white/10 text-white/70 rounded-lg border border-white/10"
            title="Refresh Telemetry"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Communication Providers Status Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-[#121218] border border-white/10 rounded-xl p-3.5">
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
          <div className="flex items-center gap-2.5">
            <MessageSquare className="w-4 h-4 text-emerald-400" />
            <div>
              <div className="text-white font-bold text-[11px]">{providers.whatsapp.providerName}</div>
              <div className="text-[10px] text-white/40">
                Approved template adapter · Est. ₹{providers.whatsapp.costPerMessageInr}/msg
              </div>
            </div>
          </div>
          <span
            className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase ${
              providers.whatsapp.connected
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
            }`}
          >
            {providers.whatsapp.statusLabel}
          </span>
        </div>

        <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
          <div className="flex items-center gap-2.5">
            <Mail className="w-4 h-4 text-sky-400" />
            <div>
              <div className="text-white font-bold text-[11px]">{providers.email.providerName}</div>
              <div className="text-[10px] text-white/40">
                Transactional & opted-in recovery adapter · Est. ₹{providers.email.costPerMessageInr}/msg
              </div>
            </div>
          </div>
          <span
            className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase ${
              providers.email.connected
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
            }`}
          >
            {providers.email.statusLabel}
          </span>
        </div>
      </div>

      {/* 11 Required Admin Dashboard KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* 1. Eligible abandoned carts */}
        <div className="p-3.5 bg-[#121218] border border-white/10 rounded-xl space-y-1">
          <span className="text-white/50 text-[10px] uppercase block">1. Eligible Abandoned</span>
          <div className="text-2xl font-bold text-white">{kpis.eligibleAbandonedCarts}</div>
          <span className="text-[10px] text-white/40 block">
            Inactive ≥ {dashboardData?.config?.inactivityMinutes || 30}m & active
          </span>
        </div>

        {/* 2. Total abandoned value */}
        <div className="p-3.5 bg-[#121218] border border-white/10 rounded-xl space-y-1">
          <span className="text-white/50 text-[10px] uppercase block">2. Total Abandoned Value</span>
          <div className="text-2xl font-bold text-amber-400">
            ₹{kpis.totalAbandonedValueInr.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-white/40 block">Eligible unrecovered value</span>
        </div>

        {/* 3. Contactable abandoned carts */}
        <div className="p-3.5 bg-[#121218] border border-white/10 rounded-xl space-y-1">
          <span className="text-white/50 text-[10px] uppercase block">3. Contactable Carts</span>
          <div className="text-2xl font-bold text-sky-400">{kpis.contactableAbandonedCarts}</div>
          <span className="text-[10px] text-white/40 block">
            {kpis.anonymousNonContactableCarts} anonymous (no contact)
          </span>
        </div>

        {/* 4. Recovery messages attempted */}
        <div className="p-3.5 bg-[#121218] border border-white/10 rounded-xl space-y-1">
          <span className="text-white/50 text-[10px] uppercase block">4. Messages Attempted</span>
          <div className="text-2xl font-bold text-white">{kpis.recoveryMessagesAttempted}</div>
          <span className="text-[10px] text-white/40 block">Across T+30m to T+48h</span>
        </div>

        {/* 5. Messages delivered */}
        <div className="p-3.5 bg-[#121218] border border-white/10 rounded-xl space-y-1">
          <span className="text-white/50 text-[10px] uppercase block">5. Messages Delivered</span>
          <div className="text-2xl font-bold text-emerald-400">{kpis.messagesDelivered}</div>
          <span className="text-[10px] text-white/40 block">Verified provider ACKs only</span>
        </div>

        {/* 6. Recovered carts */}
        <div className="p-3.5 bg-[#121218] border border-white/10 rounded-xl space-y-1">
          <span className="text-white/50 text-[10px] uppercase block">6. Recovered Carts</span>
          <div className="text-2xl font-bold text-emerald-400">{kpis.recoveredCarts}</div>
          <span className="text-[10px] text-white/40 block">
            {kpis.directRecoveredCarts} Direct · {kpis.assistedRecoveredCarts} Assisted
          </span>
        </div>

        {/* 7. Recovered net revenue */}
        <div className="p-3.5 bg-[#121218] border border-emerald-500/25 rounded-xl space-y-1 lg:col-span-2">
          <div className="flex items-center justify-between">
            <span className="text-emerald-300/80 text-[10px] uppercase">7. Recovered Net Revenue (Paid Orders)</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">
              Manual = ₹0
            </span>
          </div>
          <div className="text-2xl font-bold text-emerald-400">
            ₹{kpis.recoveredNetRevenueInr.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-white/50 block">
            Direct: ₹{kpis.directRecoveredNetRevenueInr.toLocaleString('en-IN')} · Assisted: ₹
            {kpis.assistedRecoveredNetRevenueInr.toLocaleString('en-IN')} ({kpis.manuallyMarkedCarts} manual excluded)
          </span>
        </div>

        {/* 8. Recovery conversion rate */}
        <div className="p-3.5 bg-[#121218] border border-white/10 rounded-xl space-y-1">
          <span className="text-white/50 text-[10px] uppercase block">8. Conversion Rate</span>
          <div className="text-2xl font-bold text-[#D4AF37]">{kpis.recoveryConversionRatePercent}%</div>
          <span className="text-[10px] text-white/40 block">Verified paid / eligible</span>
        </div>

        {/* 9. Discounts issued */}
        <div className="p-3.5 bg-[#121218] border border-white/10 rounded-xl space-y-1">
          <span className="text-white/50 text-[10px] uppercase block">9. Discounts Issued</span>
          <div className="text-2xl font-bold text-[#E5C378]">{kpis.discountsIssuedCount}</div>
          <span className="text-[10px] text-white/40 block">
            ₹{kpis.totalDiscountValueRedeemedInr.toLocaleString('en-IN')} redeemed
          </span>
        </div>

        {/* 10. Recovery contribution margin */}
        <div className="p-3.5 bg-[#121218] border border-white/10 rounded-xl space-y-1">
          <span className="text-white/50 text-[10px] uppercase block">10. Contribution Margin</span>
          <div className="text-2xl font-bold text-emerald-300">
            ₹{kpis.recoveryContributionMarginInr.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-white/40 block">
            {kpis.recoveryContributionMarginPercent}% net after COGS & cost
          </span>
        </div>

        {/* 11. Recovery cost */}
        <div className="p-3.5 bg-[#121218] border border-white/10 rounded-xl space-y-1">
          <span className="text-white/50 text-[10px] uppercase block">11. Recovery Cost</span>
          <div className="text-2xl font-bold text-white">₹{kpis.recoveryCostInr.toLocaleString('en-IN')}</div>
          <span className="text-[10px] text-white/40 block">Provider dispatch spend</span>
        </div>
      </div>

      {/* 10-Scenario Verification Suite Results Panel (when run) */}
      {testSuiteResults && (
        <div className="bg-[#121218] border border-emerald-500/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-emerald-400" />
              <span className="text-white font-bold uppercase text-xs">
                Automated Recovery Engine Verification Suite ({testSuiteResults.passedCount}/{testSuiteResults.totalCount} Passed)
              </span>
            </div>
            <button
              onClick={() => setTestSuiteResults(null)}
              className="text-white/40 hover:text-white text-[11px]"
            >
              Dismiss
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {testSuiteResults.results.map((r) => (
              <div
                key={r.id}
                className={`p-2.5 rounded-lg border flex items-start gap-2.5 ${
                  r.passed
                    ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-200'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                }`}
              >
                {r.passed ? (
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <X className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div className="space-y-0.5">
                  <div className="font-bold text-[11px] text-white">{r.scenario}</div>
                  <div className="text-[10px] text-white/70">{r.details}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search & Filter Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex items-center gap-3 bg-[#121218] border border-white/10 rounded-xl px-4 py-2.5 flex-1">
          <Search className="w-4 h-4 text-white/40" />
          <input
            type="text"
            placeholder="Search by customer name, email, phone, or anonymous cart ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent text-xs text-white placeholder-white/40 focus:outline-none flex-1"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-[#121218] border border-white/10 rounded-xl p-1">
          {(
            [
              { id: 'ALL', label: 'All Carts' },
              { id: 'ELIGIBLE', label: 'Eligible Abandoned' },
              { id: 'RECOVERED', label: 'Recovered' },
              { id: 'ANONYMOUS', label: 'Anonymous' },
              { id: 'SUPPRESSED', label: 'Suppressed' }
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase transition ${
                statusFilter === tab.id
                  ? 'bg-[#D4AF37] text-black'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Abandoned Carts Table */}
      <div className="bg-[#121218] border border-white/10 rounded-xl overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/10 text-white/40 uppercase text-[10px]">
              <th className="p-3.5">Customer / Identity</th>
              <th className="p-3.5">Products in Flacon Bag</th>
              <th className="p-3.5">Cart Value</th>
              <th className="p-3.5">Abandonment & Activity</th>
              <th className="p-3.5">4-Stage Sequence (T+30m → T+48h)</th>
              <th className="p-3.5">Smart Coupon</th>
              <th className="p-3.5">Recovery & Attribution</th>
              <th className="p-3.5 text-right">Recovery Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredCarts.map((cart) => {
              const steps = cart.recoveryMetadata?.sequenceSteps;
              const attempts = cart.recoveryMetadata?.messageAttempts || [];
              const deliveredCount = attempts.filter((a) => a.deliveryStatus === 'DELIVERED').length;
              const smartCoupon = cart.recoveryMetadata?.smartCouponIssued;
              const isManualNonRevenue = Boolean(cart.recoveryMetadata?.manuallyMarkedRecovered);
              const paidOrder = cart.linkedPaidOrder;

              return (
                <tr key={cart.id} className="hover:bg-white/[0.02]">
                  {/* Customer / Identity */}
                  <td className="p-3.5">
                    {cart.isContactable ? (
                      <>
                        <strong className="text-white block font-medium">
                          {cart.customerName || 'Authenticated Customer'}
                        </strong>
                        {cart.customerEmail && (
                          <span className="text-white/70 block text-[11px]">{cart.customerEmail}</span>
                        )}
                        {cart.customerPhone && (
                          <span className="text-white/50 block text-[10px]">{cart.customerPhone}</span>
                        )}
                      </>
                    ) : (
                      <div className="space-y-0.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/10 text-white/70 text-[10px] font-bold">
                          <Lock className="w-3 h-3 text-amber-400" /> Anonymous Session
                        </span>
                        <span className="block text-[10px] text-white/40">
                          ID: {cart.anonymousCartId || cart.id}
                        </span>
                        <span className="block text-[9px] text-amber-400/80">
                          No known contact identity
                        </span>
                      </div>
                    )}
                    <span className="text-[9px] text-white/30 block mt-0.5">
                      Source: {cart.attribution?.utm_source || 'direct'} / {cart.attribution?.utm_campaign || 'organic'}
                    </span>
                  </td>

                  {/* Products */}
                  <td className="p-3.5 text-white/80 max-w-xs">
                    <div className="line-clamp-2">
                      {(cart.items || [])
                        .map((i) => `${i.productName} (${i.size}) × ${i.quantity}`)
                        .join(', ')}
                    </div>
                    <span className="text-[10px] text-white/40 block mt-0.5">
                      {(cart.items || []).reduce((s, i) => s + (Number(i.quantity) || 1), 0)} units total
                    </span>
                  </td>

                  {/* Cart Value */}
                  <td className="p-3.5 font-bold text-white whitespace-nowrap">
                    ₹{cart.cartValue.toLocaleString('en-IN')}
                    {cart.recoveryMetadata?.paymentResult &&
                      cart.recoveryMetadata.paymentResult !== 'NONE' && (
                        <span
                          className={`block text-[9px] mt-0.5 font-normal ${
                            cart.recoveryMetadata.paymentResult === 'PENDING'
                              ? 'text-amber-400'
                              : cart.recoveryMetadata.paymentResult === 'FAILED'
                              ? 'text-rose-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          Payment: {cart.recoveryMetadata.paymentResult}
                        </span>
                      )}
                  </td>

                  {/* Abandonment & Activity */}
                  <td className="p-3.5 whitespace-nowrap">
                    <span className="text-white/80 block">{cart.lastActivity}</span>
                    {cart.eligibility?.isAbandoned ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 mt-0.5">
                        <Clock className="w-3 h-3" /> Eligible ({cart.eligibility.minutesInactive}m idle)
                      </span>
                    ) : (
                      <span className="text-[10px] text-white/40 block mt-0.5 max-w-[170px] truncate" title={cart.eligibility?.blockReasons?.join(', ')}>
                        {cart.eligibility?.blockReasons?.[0] || 'Active / Not abandoned'}
                      </span>
                    )}
                  </td>

                  {/* 4-Stage Sequence */}
                  <td className="p-3.5">
                    <div className="flex items-center gap-1">
                      {stepOrder.map((stepKey) => {
                        const st = steps?.[stepKey]?.status || 'PENDING';
                        const badgeColor =
                          st === 'DELIVERED'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : st === 'INTEGRATION_REQUIRED'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : st === 'SKIPPED' || st === 'CANCELLED'
                            ? 'bg-white/5 text-white/30 border-white/10 line-through'
                            : st === 'FAILED'
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            : 'bg-white/5 text-white/50 border-white/10';
                        return (
                          <button
                            key={stepKey}
                            onClick={() => handleExecuteSequenceStep(cart.id, stepKey)}
                            title={`${stepShortLabels[stepKey]}: ${st}${
                              steps?.[stepKey]?.reason ? ` (${steps[stepKey].reason})` : ''
                            } — Click to evaluate step`}
                            className={`px-1.5 py-0.5 rounded border text-[9px] font-bold transition hover:border-[#D4AF37] ${badgeColor}`}
                          >
                            {stepShortLabels[stepKey]}
                          </button>
                        );
                      })}
                    </div>
                    <div className="text-[10px] text-white/40 mt-1">
                      {attempts.length} attempted · {deliveredCount} delivered
                    </div>
                  </td>

                  {/* Smart Coupon */}
                  <td className="p-3.5">
                    {smartCoupon ? (
                      <div>
                        <span className="px-2 py-0.5 rounded bg-[#D4AF37]/20 text-[#E5C378] font-mono text-[10px] font-bold">
                          {smartCoupon.code}
                        </span>
                        <span className="block text-[9px] text-white/40 mt-0.5">
                          Margin: {smartCoupon.marginAfterDiscountPercent}% · Single-use
                        </span>
                      </div>
                    ) : cart.couponCode ? (
                      <span className="px-2 py-0.5 rounded bg-[#D4AF37]/20 text-[#E5C378] font-mono text-[10px] font-bold">
                        {cart.couponCode}
                      </span>
                    ) : (
                      <span className="text-white/30 text-[10px]">No discount issued</span>
                    )}
                  </td>

                  {/* Recovery & Attribution */}
                  <td className="p-3.5">
                    {paidOrder && paidOrder.attributionType !== 'ORGANIC' ? (
                      <div className="space-y-0.5">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold inline-block">
                          RECOVERED ({paidOrder.attributionType})
                        </span>
                        <span className="block text-[10px] text-emerald-400 font-bold">
                          ₹{paidOrder.netRevenueInr.toLocaleString('en-IN')} Net
                        </span>
                        <span className="block text-[9px] text-white/40">
                          Order #{paidOrder.orderNumber}
                        </span>
                      </div>
                    ) : paidOrder && paidOrder.attributionType === 'ORGANIC' ? (
                      <div className="space-y-0.5">
                        <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[10px] font-bold inline-block">
                          ORGANIC ORDER
                        </span>
                        <span className="block text-[9px] text-white/40">
                          Completed before 1st reminder
                        </span>
                      </div>
                    ) : isManualNonRevenue ? (
                      <div className="space-y-0.5">
                        <span className="px-2 py-0.5 rounded bg-white/10 text-white/70 text-[10px] font-bold inline-block">
                          MANUAL ARCHIVE
                        </span>
                        <span className="block text-[9px] text-white/40">
                          ₹0 attributed revenue
                        </span>
                      </div>
                    ) : cart.recoveryMetadata?.workflowSuppressed ? (
                      <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 text-[10px] font-bold">
                        SUPPRESSED
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[10px] font-bold">
                        UNRECOVERED
                      </span>
                    )}
                  </td>

                  {/* Recovery Actions */}
                  <td className="p-3.5 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      {cart.status !== 'RECOVERED' && !paidOrder && (
                        <>
                          <button
                            onClick={() => handleSafeManualWorkflow(cart, 'whatsapp')}
                            disabled={!cart.isContactable}
                            className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 disabled:opacity-30 text-emerald-300 rounded font-bold text-[10px] flex items-center gap-1"
                            title={
                              cart.isContactable
                                ? 'Record safe manual WhatsApp workflow'
                                : 'Anonymous cart has no contact phone'
                            }
                          >
                            <MessageSquare className="w-3 h-3" /> WhatsApp
                          </button>
                          <button
                            onClick={() => handleSafeManualWorkflow(cart, 'email')}
                            disabled={!cart.isContactable}
                            className="px-2 py-1 bg-sky-500/20 hover:bg-sky-500/30 disabled:opacity-30 text-sky-300 rounded font-bold text-[10px] flex items-center gap-1"
                            title={
                              cart.isContactable
                                ? 'Record safe manual Email workflow'
                                : 'Anonymous cart has no contact email'
                            }
                          >
                            <Mail className="w-3 h-3" /> Email
                          </button>
                          <button
                            onClick={() => handleEvaluateOrIssueSmartCoupon(cart.id)}
                            className="px-2 py-1 bg-[#D4AF37]/20 hover:bg-[#D4AF37]/30 text-[#E5C378] rounded font-bold text-[10px] flex items-center gap-1"
                            title="Evaluate T+24h Smart Coupon Eligibility & Margin Protection"
                          >
                            <Ticket className="w-3 h-3" /> Smart Voucher
                          </button>
                          <button
                            onClick={() => {
                              markCartRecovered(cart.id);
                              setTimeout(fetchDashboard, 400);
                            }}
                            className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded font-bold text-[10px]"
                            title="Manually Mark Recovered (Excluded from Recovered Revenue)"
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => setSelectedCart(cart)}
                        className="px-2 py-1 bg-white/5 hover:bg-white/15 text-white/80 rounded text-[10px] flex items-center gap-0.5"
                        title="Inspect Cart Recovery Timeline & Consent"
                      >
                        Inspect <ChevronRight className="w-3 h-3" />
                      </button>

                      {confirmDeleteId === cart.id ? (
                        <button
                          onClick={() => {
                            deleteAbandonedCart(cart.id);
                            setConfirmDeleteId(null);
                            setTimeout(fetchDashboard, 400);
                          }}
                          className="px-2 py-1 bg-rose-500 text-white rounded text-[10px] font-bold"
                        >
                          Confirm
                        </button>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(cart.id)}
                          className="p-1 text-white/30 hover:text-rose-400"
                          title="Delete Entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Cart Sequence & Audit Inspector Modal */}
      {selectedCart && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedCart(null);
          }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-end p-4"
        >
          <div className="bg-[#121218] border border-white/15 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5 font-mono text-xs">
            <div className="flex items-start justify-between border-b border-white/10 pb-4">
              <div>
                <span className="text-[10px] uppercase text-[#D4AF37] font-bold">
                  Cart Recovery Inspector
                </span>
                <h3 className="text-lg font-serif text-white mt-0.5">
                  {selectedCart.isContactable
                    ? selectedCart.customerName || selectedCart.customerEmail || selectedCart.customerPhone
                    : `Anonymous Session (${selectedCart.anonymousCartId})`}
                </h3>
                <p className="text-[11px] text-white/50">
                  Cart ID: {selectedCart.id} · Value: ₹{selectedCart.cartValue.toLocaleString('en-IN')}
                </p>
              </div>
              <button
                onClick={() => setSelectedCart(null)}
                className="px-3 py-1 rounded bg-white/10 text-white/70 hover:text-white"
              >
                Close
              </button>
            </div>

            {/* Abandonment Rule & Consent Check */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-1.5">
                <div className="text-[10px] uppercase text-white/40 font-bold">
                  Abandonment Eligibility
                </div>
                <div className="text-white font-bold">
                  {selectedCart.eligibility?.isAbandoned
                    ? 'ELIGIBLE FOR RECOVERY'
                    : 'NOT ELIGIBLE / BLOCKED'}
                </div>
                {selectedCart.eligibility?.blockReasons?.length > 0 && (
                  <ul className="text-[10px] text-amber-300 space-y-0.5">
                    {selectedCart.eligibility.blockReasons.map((r, idx) => (
                      <li key={idx}>• {r}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-1.5">
                <div className="text-[10px] uppercase text-white/40 font-bold">
                  Communication Consent & Channels
                </div>
                <div className="text-white">
                  Permitted:{' '}
                  {selectedCart.eligibility?.permittedChannels?.length
                    ? selectedCart.eligibility.permittedChannels.join(', ').toUpperCase()
                    : 'NONE'}
                </div>
                <div className="text-[10px] text-white/50">
                  Unsubscribed: {selectedCart.recoveryMetadata?.consent?.unsubscribed ? 'YES (Blocked)' : 'No'}
                </div>
                <button
                  onClick={() => handleToggleSuppress(selectedCart)}
                  className="mt-1 px-2.5 py-1 rounded bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-[10px] font-bold flex items-center gap-1"
                >
                  <Ban className="w-3 h-3" />
                  {selectedCart.recoveryMetadata?.workflowSuppressed
                    ? 'Resume Recovery Sequence'
                    : 'Suppress Recovery Workflow'}
                </button>
              </div>
            </div>

            {/* 4-Stage Sequence Timeline */}
            <div className="space-y-2.5">
              <div className="text-[10px] uppercase text-white/50 font-bold">
                Automated Recovery Sequence (T+30m → T+48h)
              </div>
              <div className="space-y-2">
                {stepOrder.map((stepKey) => {
                  const step = selectedCart.recoveryMetadata?.sequenceSteps?.[stepKey];
                  return (
                    <div
                      key={stepKey}
                      className="p-3 rounded-xl bg-white/[0.02] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{step?.label || stepKey}</span>
                          <span className="px-2 py-0.5 rounded bg-white/10 text-[10px] text-[#E5C378]">
                            {step?.status || 'PENDING'}
                          </span>
                        </div>
                        {step?.reason && (
                          <p className="text-[10px] text-white/50 mt-0.5">{step.reason}</p>
                        )}
                        {step?.couponCode && (
                          <p className="text-[10px] text-[#D4AF37] mt-0.5">
                            Issued Smart Coupon: {step.couponCode}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleExecuteSequenceStep(selectedCart.id, stepKey)}
                        className="px-3 py-1.5 rounded bg-[#D4AF37]/20 hover:bg-[#D4AF37]/30 text-[#E5C378] font-bold text-[10px] shrink-0"
                      >
                        Trigger {stepShortLabels[stepKey]} Now
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Message Dispatch Log */}
            <div className="space-y-2">
              <div className="text-[10px] uppercase text-white/50 font-bold">
                Provider Dispatch & Manual Workflow Log
              </div>
              {(selectedCart.recoveryMetadata?.messageAttempts || []).length === 0 ? (
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-white/40 text-center">
                  No recovery messages attempted yet for this cart.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {(selectedCart.recoveryMetadata?.messageAttempts || []).map((att) => (
                    <div
                      key={att.id}
                      className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5 flex items-center justify-between"
                    >
                      <div>
                        <span className="text-white font-bold uppercase">{att.channel}</span> ·{' '}
                        <span className="text-white/60">{att.stepId}</span>
                        <div className="text-[10px] text-white/40">
                          {att.providerName} · {new Date(att.attemptedAt).toLocaleString()}
                        </div>
                        {att.errorReason && (
                          <div className="text-[10px] text-amber-300/90">{att.errorReason}</div>
                        )}
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          att.deliveryStatus === 'DELIVERED'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : att.deliveryStatus === 'INTEGRATION_REQUIRED'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {att.deliveryStatus}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Smart Coupon Engine & Abandonment Rule Configuration Modal */}
      {isConfigOpen && configDraft && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsConfigOpen(false);
          }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-[#121218] border border-white/15 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <span className="text-[10px] uppercase text-[#D4AF37] font-bold">
                  Engine Configuration
                </span>
                <h3 className="text-lg font-serif text-white">
                  Abandonment Threshold & Smart Coupon Engine Rules
                </h3>
              </div>
              <button
                onClick={() => setIsConfigOpen(false)}
                className="px-3 py-1 rounded bg-white/10 text-white/70 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase text-white/50 mb-1">
                  Abandonment Inactivity Rule (Minutes)
                </label>
                <input
                  type="number"
                  value={configDraft.inactivityMinutes}
                  onChange={(e) =>
                    setConfigDraft({
                      ...configDraft,
                      inactivityMinutes: Math.max(5, Number(e.target.value) || 30)
                    })
                  }
                  className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase text-white/50 mb-1">
                  Attribution Window (Hours)
                </label>
                <input
                  type="number"
                  value={configDraft.attributionWindowHours}
                  onChange={(e) =>
                    setConfigDraft({
                      ...configDraft,
                      attributionWindowHours: Math.max(1, Number(e.target.value) || 72)
                    })
                  }
                  className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase text-white/50 mb-1">
                  Smart Coupon Discount Type
                </label>
                <select
                  value={configDraft.smartCoupon.discountType}
                  onChange={(e) =>
                    setConfigDraft({
                      ...configDraft,
                      smartCoupon: {
                        ...configDraft.smartCoupon,
                        discountType: e.target.value as 'PERCENTAGE' | 'FIXED'
                      }
                    })
                  }
                  className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-white"
                >
                  <option value="PERCENTAGE">Percentage Discount (%)</option>
                  <option value="FIXED">Fixed Concession (₹)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase text-white/50 mb-1">
                  Discount Value ({configDraft.smartCoupon.discountType === 'PERCENTAGE' ? '%' : '₹'})
                </label>
                <input
                  type="number"
                  value={configDraft.smartCoupon.discountValue}
                  onChange={(e) =>
                    setConfigDraft({
                      ...configDraft,
                      smartCoupon: {
                        ...configDraft.smartCoupon,
                        discountValue: Math.max(1, Number(e.target.value) || 10)
                      }
                    })
                  }
                  className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase text-white/50 mb-1">
                  Maximum Discount Cap (₹)
                </label>
                <input
                  type="number"
                  value={configDraft.smartCoupon.maxDiscountCapInr}
                  onChange={(e) =>
                    setConfigDraft({
                      ...configDraft,
                      smartCoupon: {
                        ...configDraft.smartCoupon,
                        maxDiscountCapInr: Math.max(50, Number(e.target.value) || 500)
                      }
                    })
                  }
                  className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase text-white/50 mb-1">
                  Minimum Qualifying Cart Value (₹)
                </label>
                <input
                  type="number"
                  value={configDraft.smartCoupon.minCartValueInr}
                  onChange={(e) =>
                    setConfigDraft({
                      ...configDraft,
                      smartCoupon: {
                        ...configDraft.smartCoupon,
                        minCartValueInr: Math.max(0, Number(e.target.value) || 1800)
                      }
                    })
                  }
                  className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase text-white/50 mb-1">
                  Minimum Protected Gross Margin (%)
                </label>
                <input
                  type="number"
                  value={configDraft.smartCoupon.minGrossMarginPercent}
                  onChange={(e) =>
                    setConfigDraft({
                      ...configDraft,
                      smartCoupon: {
                        ...configDraft.smartCoupon,
                        minGrossMarginPercent: Math.max(10, Number(e.target.value) || 45)
                      }
                    })
                  }
                  className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase text-white/50 mb-1">
                  Campaign Budget Limit (₹)
                </label>
                <input
                  type="number"
                  value={configDraft.smartCoupon.campaignBudgetLimitInr}
                  onChange={(e) =>
                    setConfigDraft({
                      ...configDraft,
                      smartCoupon: {
                        ...configDraft.smartCoupon,
                        campaignBudgetLimitInr: Math.max(500, Number(e.target.value) || 25000)
                      }
                    })
                  }
                  className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase text-white/50 mb-1">
                  Single-Use Voucher Expiry (Hours)
                </label>
                <input
                  type="number"
                  value={configDraft.smartCoupon.expiryHours}
                  onChange={(e) =>
                    setConfigDraft({
                      ...configDraft,
                      smartCoupon: {
                        ...configDraft.smartCoupon,
                        expiryHours: Math.max(1, Number(e.target.value) || 48)
                      }
                    })
                  }
                  className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase text-white/50 mb-1">
                  Excluded Product Slugs (Comma-separated)
                </label>
                <input
                  type="text"
                  value={(configDraft.smartCoupon.excludedProductSlugs || []).join(', ')}
                  onChange={(e) =>
                    setConfigDraft({
                      ...configDraft,
                      smartCoupon: {
                        ...configDraft.smartCoupon,
                        excludedProductSlugs: e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean)
                      }
                    })
                  }
                  className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
              <button
                onClick={() => setIsConfigOpen(false)}
                className="px-4 py-2 rounded-lg bg-white/5 text-white/70"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveConfig}
                disabled={savingConfig}
                className="px-4 py-2 rounded-lg bg-[#D4AF37] text-black font-bold"
              >
                {savingConfig ? 'Saving...' : 'Save Recovery Rules'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
