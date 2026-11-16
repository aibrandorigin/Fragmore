import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../../context/StoreContext';
import { Campaign } from '../../types';
import {
  Activity,
  Plus,
  Play,
  Pause,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  RefreshCw,
  Copy,
  FlaskConical,
  X
} from 'lucide-react';
import { AdminCoupons } from './AdminCoupons';
import { AdminInfluencers } from './AdminInfluencers';
import { AdminAbandonedCarts } from './AdminAbandonedCarts';
import { AdminAiMarketingAssistant } from './AdminAiMarketingAssistant';
import { AdminProductionAuditAndInspector } from './AdminProductionAuditAndInspector';
import { ErpTableExportBar } from './erp/ErpUniversalExportModal';

interface AdminMarketingProps {
  initialSubTab?:
    | 'campaigns'
    | 'coupons'
    | 'influencers'
    | 'abandoned'
    | 'discovery'
    | 'attribution'
    | 'ai_assistant';
}

const STANDARDIZED_EVENTS = [
  'page_view',
  'view_item',
  'search',
  'select_item',
  'add_to_cart',
  'remove_from_cart',
  'begin_checkout',
  'add_shipping_info',
  'add_payment_info',
  'purchase',
  'refund',
  'sign_up',
  'generate_lead'
] as const;

export const AdminMarketing: React.FC<AdminMarketingProps> = ({ initialSubTab = 'campaigns' }) => {
  const {
    campaigns,
    addCampaign,
    updateCampaignStatus,
    deleteCampaign,
    customers,
    setIsEventInspectorOpen,
    showNotification
  } = useStore();

  const [activeSubTab, setActiveSubTab] = useState<string>(initialSubTab);

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  // Omnichannel backend state
  const [omnichannelData, setOmnichannelData] = useState<any | null>(null);
  const [loadingOmnichannel, setLoadingOmnichannel] = useState<boolean>(false);
  const [campaignViewMode, setCampaignViewMode] = useState<'PERFORMANCE' | 'CALENDAR' | 'RULES'>('PERFORMANCE');

  // Create Campaign + UTM Builder Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newObjective, setNewObjective] = useState<'CONVERSIONS' | 'HIGH_INTENT_TRAFFIC' | 'DISCOVERY_ACQUISITION' | 'RETENTION_LOYALTY' | 'BRAND_AWARENESS'>('CONVERSIONS');
  const [newChannel, setNewChannel] = useState<'META_ADS' | 'GOOGLE_SEARCH_ADS' | 'WHATSAPP_BUSINESS' | 'EMAIL' | 'INFLUENCER_AFFILIATE'>('META_ADS');
  const [newSegment, setNewSegment] = useState('VIP & High-Intent Luxury Fragrance Collectors');
  const [newStartDate, setNewStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [newEndDate, setNewEndDate] = useState('2026-12-31');
  const [newDailyBudget, setNewDailyBudget] = useState<number>(3500);
  const [newLifetimeBudget, setNewLifetimeBudget] = useState<number>(75000);
  const [newOwner, setNewOwner] = useState('ananya.sharma@fragmore.in');
  const [newLandingPage, setNewLandingPage] = useState('https://fragmore.shop/shop');
  const [newPromotedSku, setNewPromotedSku] = useState('FRG-1-100ML');
  const [newCreativeHeadline, setNewCreativeHeadline] = useState('28% Extrait de Parfum — Vault Release');
  const [utmSource, setUtmSource] = useState('meta');
  const [utmMedium, setUtmMedium] = useState('paid_social');
  const [utmCampaign, setUtmCampaign] = useState('extrait_vault_2026');
  const [utmContent, setUtmContent] = useState('reel_35s_azure');
  const [utmTerm, setUtmTerm] = useState('niche_perfume_india');

  // Standardized Event Dispatcher & Deduplication Lab State
  const [testEventName, setTestEventName] = useState<string>('purchase');
  const [testEventId, setTestEventId] = useState<string>(`evt_purchase_${Date.now().toString().slice(-5)}`);
  const [testEventSource, setTestEventSource] = useState<'BROWSER_PIXEL' | 'SERVER_CAPI' | 'WEBHOOK'>('BROWSER_PIXEL');
  const [testCurrency, setTestCurrency] = useState<string>('INR');
  const [testValueInr, setTestValueInr] = useState<number>(5499);
  const [testTransactionId, setTestTransactionId] = useState<string>('ORD-1001');
  const [testSku, setTestSku] = useState<string>('FRG-1-100ML');
  const [testUtmCampaign, setTestUtmCampaign] = useState<string>('signature_extrait_q4');
  const [testAnalyticsConsent, setTestAnalyticsConsent] = useState<boolean>(true);
  const [testMarketingConsent, setTestMarketingConsent] = useState<boolean>(true);
  const [testRawEmail, setTestRawEmail] = useState<string>('connoisseur@fragmore.in');
  const [testRawPhone, setTestRawPhone] = useState<string>('+91 98201 55443');
  const [lastDispatchedResult, setLastDispatchedResult] = useState<any | null>(null);

  // Verification Suite State
  const [runningSuite, setRunningSuite] = useState<boolean>(false);
  const [suiteResult, setSuiteResult] = useState<any | null>(null);

  const fetchOmnichannelDashboard = useCallback(async () => {
    setLoadingOmnichannel(true);
    try {
      const res = await fetch('/api/omnichannel/dashboard');
      if (res.ok) {
        const data = await res.json();
        setOmnichannelData(data);
      }
    } catch (err) {
      console.error('Error loading omnichannel dashboard:', err);
    } finally {
      setLoadingOmnichannel(false);
    }
  }, []);

  useEffect(() => {
    fetchOmnichannelDashboard();
  }, [fetchOmnichannelDashboard]);

  // Discovery Redemption stats strictly from actual DB (Zero hardcoded offsets)
  const discoveryBuyers = customers.filter((c) => c.isDiscoveryBuyer);
  const totalDiscoveryIssued = discoveryBuyers.length;
  const totalDiscoveryRedeemed = discoveryBuyers.filter((c) => c.totalSpend > 1499).length;
  const upgradeRate =
    totalDiscoveryIssued > 0 ? Math.round((totalDiscoveryRedeemed / totalDiscoveryIssued) * 100) : 0;
  const revenueFromUpgrades = discoveryBuyers
    .filter((c) => c.totalSpend > 1499)
    .reduce((sum, c) => sum + Math.max(0, c.totalSpend - 1499), 0);

  // Live UTM preview URL
  const previewTaggedUrl = (() => {
    try {
      const url = new URL(
        newLandingPage.startsWith('http') ? newLandingPage : `https://fragmore.shop${newLandingPage}`
      );
      if (utmSource) url.searchParams.set('utm_source', utmSource.trim());
      if (utmMedium) url.searchParams.set('utm_medium', utmMedium.trim());
      if (utmCampaign) url.searchParams.set('utm_campaign', utmCampaign.trim());
      if (utmContent) url.searchParams.set('utm_content', utmContent.trim());
      if (utmTerm) url.searchParams.set('utm_term', utmTerm.trim());
      return url.toString();
    } catch {
      return `${newLandingPage}?utm_source=${utmSource}&utm_medium=${utmMedium}&utm_campaign=${utmCampaign}`;
    }
  })();

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;

    try {
      const res = await fetch('/api/omnichannel/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          channel: newChannel,
          objective: newObjective,
          targetAudienceSegment: newSegment,
          startDate: newStartDate,
          endDate: newEndDate,
          dailyBudgetInr: Number(newDailyBudget) || 0,
          lifetimeBudgetInr: Number(newLifetimeBudget) || 0,
          assignedOwner: newOwner,
          landingPageUrl: newLandingPage,
          utm_source: utmSource,
          utm_medium: utmMedium,
          utm_campaign: utmCampaign || newName.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
          utm_content: utmContent,
          utm_term: utmTerm,
          creativeAssets: [
            {
              assetId: `cr_${Date.now().toString().slice(-4)}`,
              headline: newCreativeHeadline || `${newName} Primary Creative`,
              format: newChannel === 'META_ADS' ? 'REEL_9_16' : 'STATIC_4_5',
              promotedSku: newPromotedSku,
              promotedProductName: newPromotedSku.includes('FRG-1')
                ? 'AZURE Extrait de Parfum 100ml'
                : 'SILK Extrait de Parfum 100ml',
              spendInr: 0,
              impressions: 0,
              clicks: 0,
              verifiedPurchases: 0,
              verifiedRevenueInr: 0
            }
          ]
        })
      });

      const data = await res.json();
      if (res.ok && data.campaign) {
        const legacyType =
          newChannel === 'WHATSAPP_BUSINESS'
            ? 'WHATSAPP'
            : newChannel === 'EMAIL'
            ? 'EMAIL'
            : 'BANNER';

        const newCamp: Campaign = {
          id: data.campaign.id,
          name: newName,
          type: legacyType,
          status: 'PAUSED',
          targetSegment: newSegment,
          scheduledDate: newStartDate,
          sentCount: 0,
          openRate: 0,
          clicksCount: 0,
          revenueGenerated: 0
        };
        addCampaign(newCamp);
        showNotification('Omnichannel campaign created with UTM tracking and routed for approval');
        setIsAddModalOpen(false);
        setNewName('');
        await fetchOmnichannelDashboard();
      }
    } catch (err) {
      console.error('Failed to create omnichannel campaign:', err);
    }
  };

  const handleCampaignApprovalAction = async (
    campaignId: string,
    decision: 'APPROVED_ACTIVE' | 'PAUSED' | 'REJECTED'
  ) => {
    try {
      const res = await fetch(`/api/omnichannel/campaigns/${campaignId}/approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          adminEmail: 'gowisherharsha@gmail.com'
        })
      });
      if (res.ok) {
        updateCampaignStatus(campaignId, decision === 'APPROVED_ACTIVE' ? 'ACTIVE' : 'PAUSED');
        showNotification(`Campaign approval status updated to ${decision}`);
        await fetchOmnichannelDashboard();
      }
    } catch (err) {
      console.error('Approval update failed:', err);
    }
  };

  const handleDispatchStandardizedEvent = async (
    overrideSource?: 'BROWSER_PIXEL' | 'SERVER_CAPI' | 'WEBHOOK'
  ) => {
    const sourceToUse = overrideSource || testEventSource;
    try {
      const res = await fetch('/api/omnichannel/events/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: testEventId,
          eventName: testEventName,
          eventSource: sourceToUse,
          currency: testCurrency,
          valueInr: Number(testValueInr) || 0,
          transactionId:
            testEventName === 'purchase' || testEventName === 'refund' ? testTransactionId : undefined,
          utmParams: {
            utm_source: 'meta',
            utm_medium: 'paid_social',
            utm_campaign: testUtmCampaign
          },
          items: [
            {
              item_id: testSku,
              item_name: testSku.includes('FRG-1') ? 'AZURE Extrait 100ml' : 'Discovery Six Coffret',
              variant: '100 ml',
              quantity: 1,
              price: Number(testValueInr) || 0
            }
          ],
          consent: {
            analytics: testAnalyticsConsent,
            marketingPixels: testMarketingConsent
          },
          rawCustomerPii: {
            email: testRawEmail,
            phone: testRawPhone,
            fullName: 'Aarav Singhania',
            streetAddress: 'Bandra West, Mumbai'
          }
        })
      });
      const data = await res.json();
      setLastDispatchedResult(data);
      showNotification(
        data.deduplicated
          ? `Deduplicated duplicate ${sourceToUse} event (${testEventId})`
          : `Ingested ${testEventName} (${sourceToUse}) in INR with PII scrubbed`
      );
      await fetchOmnichannelDashboard();
    } catch (err) {
      console.error('Error dispatching event:', err);
    }
  };

  const handleRunOmnichannelSuite = async () => {
    setRunningSuite(true);
    try {
      const res = await fetch('/api/omnichannel/run-tests', { method: 'POST' });
      const data = await res.json();
      setSuiteResult(data);
      await fetchOmnichannelDashboard();
      showNotification(
        `Omnichannel Verification Suite: ${data.passedCount}/${data.totalTests} Passed`
      );
    } catch (err) {
      console.error('Error running suite:', err);
    } finally {
      setRunningSuite(false);
    }
  };

  const campaignReports: any[] = omnichannelData?.campaigns || [];
  const integrations: any[] = omnichannelData?.integrations || [];
  const performanceRulesList: any[] = omnichannelData?.performanceRules?.alertsAndRecommendations || [];
  const sampleThresholds = omnichannelData?.performanceRules?.rulesConfig || {
    minSampleImpressions: 1000,
    minSampleClicks: 50,
    minSampleSpendInr: 2500
  };
  const executiveSummary = omnichannelData?.executiveSummary || null;
  const attributionModels = omnichannelData?.attributionModels || null;
  const recentEvents: any[] = omnichannelData?.trackingLedger || [];

  const overstatementPercent =
    executiveSummary?.storeVerifiedNetRevenueInr > 0
      ? Math.round(
          ((executiveSummary.totalPlatformClaimedRevenueInr -
            executiveSummary.storeVerifiedNetRevenueInr) /
            executiveSummary.storeVerifiedNetRevenueInr) *
            100
        )
      : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-mono text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-white/10 gap-4">
        <div>
          <h2 className="font-serif text-2xl uppercase tracking-wider text-white">
            Growth Marketing, Attribution & Revenue Drivers
          </h2>
          <p className="text-xs text-white/50">
            Omnichannel campaign management, standardized INR event deduplication, automated rules & backend-verified attribution.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ErpTableExportBar
            reportKey="marketing_campaigns"
            title="FRAGMORÉ Omnichannel Marketing & Attribution Report"
            notify={(m) => showNotification(m)}
          />
          {(activeSubTab === 'campaigns' || activeSubTab === 'attribution') && (
            <button
              onClick={handleRunOmnichannelSuite}
              disabled={runningSuite}
              className="px-3.5 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold text-xs uppercase tracking-wider rounded flex items-center gap-1.5"
            >
              <FlaskConical className="w-3.5 h-3.5" />
              {runningSuite ? 'Verifying 7 Scenarios...' : 'Verify Omnichannel Engine (7 Tests)'}
            </button>
          )}
          {activeSubTab === 'campaigns' && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2 bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] font-bold text-xs uppercase tracking-wider rounded flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Create Campaign & UTM
            </button>
          )}
          <button
            onClick={() => setIsEventInspectorOpen(true)}
            className="px-3.5 py-2 bg-white/10 hover:bg-white/15 text-white rounded flex items-center gap-1.5"
          >
            <Activity className="w-3.5 h-3.5 text-[#D4AF37]" /> Live Event Inspector
          </button>
        </div>
      </div>

      {/* Verification Suite Banner if executed */}
      {suiteResult && (
        <div className="bg-[#121218] border border-emerald-500/40 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="font-bold text-white uppercase tracking-wider">
                Omnichannel Campaign & Attribution Verification Suite — {suiteResult.passedCount}/
                {suiteResult.totalTests} Scenarios Passed
              </span>
            </div>
            <button
              onClick={() => setSuiteResult(null)}
              className="text-white/40 hover:text-white text-[11px]"
            >
              Dismiss
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {(suiteResult.results || []).map((r: any, idx: number) => (
              <div
                key={idx}
                className="p-2.5 rounded bg-black/40 border border-white/10 flex items-start gap-2"
              >
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                    r.passed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                  }`}
                >
                  {r.passed ? 'PASS' : 'FAIL'}
                </span>
                <div>
                  <div className="text-white font-semibold text-[11px]">{r.scenario}</div>
                  <div className="text-white/60 text-[10px]">{r.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sub-Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2 overflow-x-auto text-[11px]">
        {[
          { id: 'campaigns', label: `Campaigns (${Math.max(campaigns.length, campaignReports.length)})` },
          { id: 'ai_assistant', label: 'AI Marketing Intelligence & Studio' },
          { id: 'coupons', label: 'Coupons & Vouchers' },
          { id: 'influencers', label: 'Influencer Affiliates' },
          { id: 'abandoned', label: 'Abandoned Carts' },
          { id: 'discovery', label: 'Discovery Redemption' },
          { id: 'attribution', label: 'Attribution & Pixels' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap ${
              activeSubTab === tab.id
                ? 'bg-[#D4AF37] text-[#08080A] font-bold'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* SUB-TAB 1: CAMPAIGNS (Omnichannel Campaign Management, 16 Metrics, Calendar & Rules) */}
      {activeSubTab === 'campaigns' && (
        <div className="space-y-6">
          {/* Executive Blended MER & Backend vs Platform Revenue KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="p-4 bg-[#121218] border border-white/10 rounded-xl space-y-1">
              <span className="text-[10px] text-white/50 uppercase">Total Ad Spend</span>
              <div className="text-lg font-bold text-white">
                ₹{Number(executiveSummary?.totalMarketingSpendInr || 0).toLocaleString('en-IN')}
              </div>
              <span className="text-[10px] text-white/40">Recorded ledger spend (INR)</span>
            </div>

            <div className="p-4 bg-[#121218] border border-emerald-500/30 rounded-xl space-y-1">
              <span className="text-[10px] text-emerald-400 uppercase font-bold">
                Backend-Verified Net Revenue
              </span>
              <div className="text-lg font-bold text-emerald-400">
                ₹{Number(executiveSummary?.storeVerifiedNetRevenueInr || 0).toLocaleString('en-IN')}
              </div>
              <span className="text-[10px] text-white/50">Reconciled paid orders net of refunds</span>
            </div>

            <div className="p-4 bg-[#121218] border border-amber-500/30 rounded-xl space-y-1">
              <span className="text-[10px] text-amber-400 uppercase">Platform-Claimed Revenue</span>
              <div className="text-lg font-bold text-amber-300">
                ₹{Number(executiveSummary?.totalPlatformClaimedRevenueInr || 0).toLocaleString('en-IN')}
              </div>
              <span className="text-[10px] text-amber-400/70">
                Over-attributed by +{overstatementPercent}% vs Backend
              </span>
            </div>

            <div className="p-4 bg-[#121218] border border-white/10 rounded-xl space-y-1">
              <span className="text-[10px] text-white/50 uppercase">Blended MER</span>
              <div className="text-lg font-bold text-[#D4AF37]">
                {executiveSummary?.blendedMer || 0}x
              </div>
              <span className="text-[10px] text-white/40">Total Net Store Revenue / Total Spend</span>
            </div>

            <div className="p-4 bg-[#121218] border border-white/10 rounded-xl space-y-1">
              <span className="text-[10px] text-white/50 uppercase">Backend ROAS vs Platform</span>
              <div className="text-lg font-bold text-white">
                {executiveSummary?.blendedBackendRoas || 0}x{' '}
                <span className="text-xs text-white/40">
                  (vs {executiveSummary?.blendedPlatformRoas || 0}x)
                </span>
              </div>
              <span className="text-[10px] text-white/40">Strictly separated attribution</span>
            </div>

            <div className="p-4 bg-[#121218] border border-white/10 rounded-xl space-y-1">
              <span className="text-[10px] text-white/50 uppercase">Contribution After Mktg</span>
              <div className="text-lg font-bold text-emerald-400">
                ₹
                {Number(
                  executiveSummary?.totalContributionAfterMarketingInr || 0
                ).toLocaleString('en-IN')}
              </div>
              <span className="text-[10px] text-white/40">
                {performanceRulesList.length} Automated Rule Alerts
              </span>
            </div>
          </div>

          {/* Sub-navigation within Campaigns */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#121218] p-3 rounded-xl border border-white/10">
            <div className="flex items-center gap-2">
              {[
                { id: 'PERFORMANCE', label: '1. Full Funnel & Attribution Matrix (16 Metrics)' },
                { id: 'CALENDAR', label: '2. Campaign Calendar, Creative & UTM Builder' },
                {
                  id: 'RULES',
                  label: `3. Automated Performance Rules & Sample Guard (${performanceRulesList.length} Alerts)`
                }
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setCampaignViewMode(m.id as any)}
                  className={`px-3 py-1.5 rounded text-[11px] font-bold transition-colors ${
                    campaignViewMode === m.id
                      ? 'bg-[#D4AF37] text-[#08080A]'
                      : 'bg-white/5 text-white/60 hover:text-white'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <button
              onClick={fetchOmnichannelDashboard}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/70 rounded flex items-center gap-1.5 text-[11px]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingOmnichannel ? 'animate-spin' : ''}`} />
              Sync Ledger
            </button>
          </div>

          {/* VIEW 1: 16-METRIC CAMPAIGN REPORTING TABLE */}
          {campaignViewMode === 'PERFORMANCE' && (
            <div className="bg-[#121218] border border-white/10 rounded-xl overflow-x-auto">
              <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-serif text-sm uppercase tracking-wider text-white">
                    Omnichannel Campaign Performance & Contribution Ledger
                  </h3>
                  <p className="text-[11px] text-white/50">
                    External ad platforms without live API credentials explicitly show{' '}
                    <span className="text-amber-300 font-bold">Not connected</span> for live sync while preserving backend-verified order attribution.
                  </p>
                </div>
              </div>
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="border-b border-white/10 text-white/40 uppercase text-[9px]">
                    <th className="p-3">Campaign / Owner / Objective</th>
                    <th className="p-3">Channel & Live API Status</th>
                    <th className="p-3">Spend (Budget)</th>
                    <th className="p-3">Impr / Reach / Freq</th>
                    <th className="p-3">CPM / CPC / CTR</th>
                    <th className="p-3">LP Visits → ATC% → Checkout% → Conv%</th>
                    <th className="p-3">CAC</th>
                    <th className="p-3">Backend ROAS (vs Platform)</th>
                    <th className="p-3">Blended MER</th>
                    <th className="p-3">Backend Net Rev (vs Platform Claim)</th>
                    <th className="p-3">Contribution After Mktg</th>
                    <th className="p-3 text-right">Approval & Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {campaignReports.map((camp) => (
                    <tr key={camp.id} className="hover:bg-white/[0.02]">
                      <td className="p-3">
                        <div className="font-bold text-white">{camp.name}</div>
                        <div className="text-[10px] text-white/50">
                          {camp.objective} • Owner: {camp.assignedOwner}
                        </div>
                        <div className="text-[10px] text-[#D4AF37]">
                          UTM:{' '}
                          <code className="text-white/80">
                            {camp.utmConfig?.utm_campaign || camp.utmConfig?.utmCampaign}
                          </code>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-white">{camp.channel}</div>
                        <span
                          className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            camp.liveExternalApiStatus === 'Connected'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          Live API: {camp.liveExternalApiStatus || 'Not connected'}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-white">
                          ₹{Number(camp.spendInr || 0).toLocaleString('en-IN')}
                        </div>
                        <div className="text-[10px] text-white/40">
                          Daily: ₹{Number(camp.dailyBudgetInr || 0).toLocaleString('en-IN')}
                        </div>
                      </td>
                      <td className="p-3 text-white/80">
                        <div>{Number(camp.impressions || 0).toLocaleString('en-IN')} impr</div>
                        <div className="text-[10px] text-white/50">
                          Reach {Number(camp.reach || 0).toLocaleString('en-IN')} • Freq {camp.frequency}
                        </div>
                      </td>
                      <td className="p-3 text-white/80">
                        <div>
                          CPM ₹{camp.cpmInr} • CPC ₹{camp.cpcInr}
                        </div>
                        <div className="text-[10px] text-emerald-400 font-bold">
                          CTR {camp.ctrPercent}%
                        </div>
                      </td>
                      <td className="p-3 text-white/80">
                        <div className="font-bold text-white">
                          {Number(camp.landingPageVisits || 0).toLocaleString('en-IN')} visits
                        </div>
                        <div className="text-[10px] text-white/60">
                          ATC {camp.addToCartRatePercent}% → Chk {camp.checkoutRatePercent}% → Purchase{' '}
                          <span className="text-emerald-400 font-bold">
                            {camp.purchaseConversionPercent}%
                          </span>
                        </div>
                      </td>
                      <td className="p-3 font-bold text-white">
                        {camp.cacInr > 0 ? `₹${Number(camp.cacInr).toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-emerald-400">{camp.backendVerifiedRoas}x</div>
                        <div className="text-[10px] text-amber-300/80">
                          Platform: {camp.platformReportedRoas}x
                        </div>
                      </td>
                      <td className="p-3 font-bold text-[#D4AF37]">
                        {executiveSummary?.blendedMer || 0}x
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-emerald-400">
                          ₹{Number(camp.verifiedNetRevenueInr || 0).toLocaleString('en-IN')}
                        </div>
                        <div className="text-[10px] text-amber-300/70">
                          Claimed: ₹{Number(camp.platformClaimedRevenueInr || 0).toLocaleString('en-IN')}
                        </div>
                      </td>
                      <td className="p-3">
                        <div
                          className={`font-bold ${
                            camp.contributionAfterMarketingInr >= 0
                              ? 'text-emerald-400'
                              : 'text-rose-400'
                          }`}
                        >
                          ₹{Number(camp.contributionAfterMarketingInr || 0).toLocaleString('en-IN')}
                        </div>
                        <div className="text-[9px] text-white/40">
                          Net of COGS (₹{Number(camp.estCogsInr || 0).toLocaleString('en-IN')}) + Spend
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex flex-col items-end gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                              camp.approvalStatus === 'APPROVED_ACTIVE'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : camp.approvalStatus === 'PENDING_APPROVAL'
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-white/10 text-white/50'
                            }`}
                          >
                            {camp.approvalStatus}
                          </span>
                          <div className="flex items-center gap-1">
                            {camp.approvalStatus !== 'APPROVED_ACTIVE' ? (
                              <button
                                onClick={() =>
                                  handleCampaignApprovalAction(camp.id, 'APPROVED_ACTIVE')
                                }
                                className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded text-[10px] font-bold flex items-center gap-1"
                                title="Approve & Activate"
                              >
                                <Play className="w-3 h-3" /> Approve
                              </button>
                            ) : (
                              <button
                                onClick={() => handleCampaignApprovalAction(camp.id, 'PAUSED')}
                                className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white/80 rounded text-[10px] flex items-center gap-1"
                                title="Pause Campaign"
                              >
                                <Pause className="w-3 h-3" /> Pause
                              </button>
                            )}
                            <button
                              onClick={() => deleteCampaign(camp.id)}
                              className="p-1 text-white/40 hover:text-rose-400"
                              title="Delete Campaign"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* VIEW 2: CAMPAIGN CALENDAR, CREATIVES & TAGGED UTM LINKS */}
          {campaignViewMode === 'CALENDAR' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {campaignReports.map((camp) => (
                <div
                  key={camp.id}
                  className="bg-[#121218] border border-white/10 rounded-xl p-5 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] text-[#D4AF37] uppercase font-bold">
                        {camp.channel} • {camp.objective}
                      </span>
                      <h4 className="text-sm font-bold text-white">{camp.name}</h4>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-white/10 text-white/80 text-[10px]">
                      {camp.startDate} → {camp.endDate}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] bg-black/30 p-3 rounded-lg border border-white/5">
                    <div>
                      <span className="text-white/40 block text-[10px]">Target Audience</span>
                      <span className="text-white font-medium">{camp.targetAudienceSegment}</span>
                    </div>
                    <div>
                      <span className="text-white/40 block text-[10px]">Assigned Owner</span>
                      <span className="text-white font-medium">{camp.assignedOwner}</span>
                    </div>
                    <div>
                      <span className="text-white/40 block text-[10px]">Daily / Lifetime Budget</span>
                      <span className="text-white font-medium">
                        ₹{Number(camp.dailyBudgetInr || 0).toLocaleString('en-IN')} / ₹
                        {Number(camp.lifetimeBudgetInr || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div>
                      <span className="text-white/40 block text-[10px]">Creative Assets</span>
                      <span className="text-emerald-400 font-medium">
                        {(camp.creativeAssets || []).length} Linked SKU Assets
                      </span>
                    </div>
                  </div>

                  {(camp.creativeAssets || []).length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[10px] text-white/50 uppercase">
                        Creative Asset & SKU Mapping
                      </div>
                      {(camp.creativeAssets || []).map((asset: any) => (
                        <div
                          key={asset.assetId}
                          className="p-2.5 bg-white/[0.03] border border-white/10 rounded flex items-center justify-between text-[11px]"
                        >
                          <div>
                            <div className="text-white font-bold">{asset.headline}</div>
                            <div className="text-white/50 text-[10px]">
                              Format: {asset.format} • Promoted SKU:{' '}
                              <code className="text-[#D4AF37]">{asset.promotedSku}</code>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-emerald-400 font-bold">
                              ₹{Number(asset.verifiedRevenueInr || 0).toLocaleString('en-IN')}
                            </div>
                            <div className="text-white/40 text-[10px]">
                              {asset.verifiedPurchases || 0} verified orders
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pt-2 border-t border-white/10 space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-white/50">
                      <span>Generated UTM Tracking URL</span>
                      <button
                        onClick={() => {
                          navigator.clipboard?.writeText(camp.utmConfig?.fullTaggedUrl || '');
                          showNotification('Tagged UTM URL copied to clipboard');
                        }}
                        className="text-[#D4AF37] hover:underline flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" /> Copy UTM Link
                      </button>
                    </div>
                    <div className="p-2 bg-black/50 rounded text-[10px] text-white/70 break-all border border-white/5">
                      {camp.utmConfig?.fullTaggedUrl}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* VIEW 3: AUTOMATED PERFORMANCE RULES & SAMPLE GUARD */}
          {campaignViewMode === 'RULES' && (
            <div className="space-y-4">
              <div className="bg-[#121218] border border-amber-500/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-amber-300 font-bold text-xs uppercase">
                    <ShieldCheck className="w-4 h-4" />
                    Statistical Sample Threshold & Manual Governance Guard Active
                  </div>
                  <p className="text-[11px] text-white/60">
                    Minimum statistical sample required before triggering performance alerts:{' '}
                    <span className="text-white font-bold">
                      ≥ {sampleThresholds.minSampleImpressions} Impressions
                    </span>
                    ,{' '}
                    <span className="text-white font-bold">
                      ≥ {sampleThresholds.minSampleClicks} Clicks
                    </span>
                    , and{' '}
                    <span className="text-white font-bold">
                      ≥ ₹{sampleThresholds.minSampleSpendInr} Spend
                    </span>
                    . External ad budgets and live campaigns are NEVER automatically modified without explicit approval and a connected integration.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {performanceRulesList.map((rule) => (
                  <div
                    key={rule.ruleId}
                    className={`p-4 rounded-xl border space-y-2 ${
                      rule.severity === 'CRITICAL' || rule.severity === 'HIGH'
                        ? 'bg-rose-500/10 border-rose-500/40'
                        : rule.severity === 'INFO'
                        ? 'bg-emerald-500/10 border-emerald-500/40'
                        : 'bg-amber-500/10 border-amber-500/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-white text-xs">{rule.title}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase whitespace-nowrap ${
                          rule.severity === 'CRITICAL' || rule.severity === 'HIGH'
                            ? 'bg-rose-500/20 text-rose-300'
                            : rule.severity === 'INFO'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {rule.ruleType} • {rule.severity}
                      </span>
                    </div>
                    <div className="text-[11px] text-white/80">
                      Campaign: <span className="font-bold text-white">{rule.campaignName}</span>
                    </div>
                    <div className="text-[11px] text-white/70">{rule.detail}</div>
                    <div className="p-2.5 rounded bg-black/40 border border-white/10 text-[11px] text-[#D4AF37]">
                      Recommendation: {rule.recommendedAction}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-white/40 pt-1">
                      <span>
                        Sample Guard: {rule.sampleSizeMet ? 'Threshold Met' : 'Suppressed (Small Sample)'}
                      </span>
                      <span>
                        Auto-Executed External Change: {String(rule.autoExecutedExternalChange).toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB: AI MARKETING INTELLIGENCE ASSISTANT & CONTENT STUDIO */}
      {activeSubTab === 'ai_assistant' && <AdminAiMarketingAssistant />}

      {/* SUB-TAB 2: COUPONS */}
      {activeSubTab === 'coupons' && <AdminCoupons />}

      {/* SUB-TAB 3: INFLUENCERS */}
      {activeSubTab === 'influencers' && <AdminInfluencers />}

      {/* SUB-TAB 4: ABANDONED CARTS */}
      {activeSubTab === 'abandoned' && <AdminAbandonedCarts />}

      {/* SUB-TAB 5: DISCOVERY REDEMPTION */}
      {activeSubTab === 'discovery' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-5 bg-[#121218] border border-white/10 rounded-xl space-y-1">
              <span className="text-[10px] text-white/50 uppercase">Discovery Coffrets Dispatched</span>
              <div className="text-2xl font-bold text-white">{totalDiscoveryIssued} Coffrets</div>
              <span className="text-[10px] text-white/40">Includes ₹1,499 voucher</span>
            </div>

            <div className="p-5 bg-[#121218] border border-white/10 rounded-xl space-y-1">
              <span className="text-[10px] text-white/50 uppercase">Vouchers Redeemed (Full Bottles)</span>
              <div className="text-2xl font-bold text-emerald-400">{totalDiscoveryRedeemed} Flacons</div>
              <span className="text-[10px] text-emerald-400">Upgraded to 50ml or 100ml</span>
            </div>

            <div className="p-5 bg-[#121218] border border-white/10 rounded-xl space-y-1">
              <span className="text-[10px] text-white/50 uppercase">Upgrade Conversion Rate</span>
              <div className="text-2xl font-bold text-[#D4AF37]">{upgradeRate}%</div>
              <span className="text-[10px] text-white/40">From sampling to full flacon</span>
            </div>

            <div className="p-5 bg-[#121218] border border-white/10 rounded-xl space-y-1">
              <span className="text-[10px] text-white/50 uppercase">Net Upgrade Revenue</span>
              <div className="text-2xl font-bold text-white">₹{revenueFromUpgrades.toLocaleString('en-IN')}</div>
              <span className="text-[10px] text-emerald-400">High-intent recurring value</span>
            </div>
          </div>

          <div className="bg-[#121218] border border-white/10 rounded-xl p-6 space-y-4">
            <h3 className="font-serif text-base uppercase tracking-wider text-white border-b border-white/10 pb-3">
              Discovery Six Voucher Mechanics
            </h3>
            <p className="text-white/70 text-xs">
              Every Discovery Six coffret (6 × 2ml at ₹1,499) includes an unforgeable digital credit code equal to 100% of the coffret price (₹1,499) valid toward any full 50ml or 100ml flacon creation. When entered at checkout, the cart subtotal is reduced by ₹1,499 automatically.
            </p>
          </div>
        </div>
      )}

      {/* SUB-TAB 6: ATTRIBUTION & PIXELS (10 Integrations, 13 Standardized INR Events, Deduplication & Multi-Touch) */}
      {activeSubTab === 'attribution' && (
        <div className="space-y-6">
          {/* 1. ANALYTICS & MARKETING INTEGRATIONS READINESS MATRIX (10 INTEGRATIONS) */}
          <div className="bg-[#121218] border border-white/10 rounded-xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
              <div>
                <h3 className="font-serif text-base uppercase tracking-wider text-white">
                  1. Omnichannel Analytics & Ad Platform Integrations (10 Providers)
                </h3>
                <p className="text-white/50 text-[11px]">
                  Strict credential & test-event verification. Unconfigured external APIs explicitly report{' '}
                  <span className="text-amber-300 font-bold">Not connected</span> — never fabricated live metrics.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded bg-white/5 border border-white/10 text-[10px] text-white/70">
                Connected: {integrations.filter((i) => i.status === 'Connected').length} / {integrations.length}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              {integrations.map((integ) => (
                <div
                  key={integ.id}
                  className={`p-3.5 rounded-xl border space-y-2 ${
                    integ.status === 'Connected'
                      ? 'bg-emerald-500/5 border-emerald-500/30'
                      : 'bg-black/40 border-white/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-white text-xs">{integ.name}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[9px] font-bold whitespace-nowrap ${
                        integ.status === 'Connected'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {integ.status}
                    </span>
                  </div>
                  <div className="text-[10px] text-white/50 space-y-0.5">
                    <div>
                      Credentials: {integ.credentialsPresent ? 'Verified' : 'Missing Env Key'}
                    </div>
                    <div>Test Event: {integ.lastTestEventStatus}</div>
                  </div>
                  <div className="text-[10px] text-white/60 border-t border-white/5 pt-1.5">
                    {integ.diagnosticNote}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 2. MULTI-TOUCH ATTRIBUTION & PLATFORM VS BACKEND REVENUE RECONCILIATION */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#121218] border border-white/10 rounded-xl p-6 space-y-4">
              <h3 className="font-serif text-base uppercase tracking-wider text-white border-b border-white/10 pb-2">
                2. First-Touch vs Last-Touch Attribution (Backend-Verified INR)
              </h3>
              <div className="space-y-3">
                <div className="text-[10px] text-[#D4AF37] uppercase font-bold">
                  First-Touch Attribution (Discovery Origin)
                </div>
                {(attributionModels?.firstTouchAttribution || []).map((item: any) => (
                  <div key={`ft-${item.channel}`} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-white font-medium">
                        {item.channel} ({item.orders} orders)
                      </span>
                      <span className="text-[#D4AF37] font-bold">
                        ₹{Number(item.backendVerifiedNetRevenueInr || 0).toLocaleString('en-IN')} ({item.sharePercent}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#D4AF37]"
                        style={{ width: `${Math.min(100, item.sharePercent || 0)}%` }}
                      />
                    </div>
                  </div>
                ))}

                <div className="text-[10px] text-emerald-400 uppercase font-bold pt-3 border-t border-white/10">
                  Last-Touch Attribution (Conversion Closer)
                </div>
                {(attributionModels?.lastTouchAttribution || []).map((item: any) => (
                  <div key={`lt-${item.channel}`} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-white font-medium">
                        {item.channel} ({item.orders} orders)
                      </span>
                      <span className="text-emerald-400 font-bold">
                        ₹{Number(item.backendVerifiedNetRevenueInr || 0).toLocaleString('en-IN')} ({item.sharePercent}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-400"
                        style={{ width: `${Math.min(100, item.sharePercent || 0)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#121218] border border-white/10 rounded-xl p-6 space-y-4">
              <h3 className="font-serif text-base uppercase tracking-wider text-white border-b border-white/10 pb-2">
                3. UTM, Coupon-Assisted, Influencer-Assisted & Revenue Truth
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-black/40 border border-white/10 rounded-lg">
                  <div className="text-[10px] text-white/50 uppercase">Coupon-Assisted Orders</div>
                  <div className="text-base font-bold text-white">
                    {attributionModels?.couponAssistedAttribution?.qualifyingOrdersCount || 0} Orders
                  </div>
                  <div className="text-[11px] text-[#D4AF37]">
                    ₹
                    {Number(
                      attributionModels?.couponAssistedAttribution?.assistedNetRevenueInr || 0
                    ).toLocaleString('en-IN')}{' '}
                    Net
                  </div>
                </div>

                <div className="p-3 bg-black/40 border border-white/10 rounded-lg">
                  <div className="text-[10px] text-white/50 uppercase">Influencer-Assisted Revenue</div>
                  <div className="text-base font-bold text-white">
                    {attributionModels?.influencerAssistedAttribution?.activePartnersCount || 0} Partners
                  </div>
                  <div className="text-[11px] text-emerald-400">
                    ₹
                    {Number(
                      attributionModels?.influencerAssistedAttribution?.assistedNetRevenueInr || 0
                    ).toLocaleString('en-IN')}{' '}
                    Net
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-[10px] text-white/50 uppercase">UTM Campaign Attribution Breakdown</div>
                {(attributionModels?.utmAttribution || []).map((u: any) => (
                  <div
                    key={u.utmCampaign}
                    className="p-2 bg-white/[0.03] border border-white/5 rounded flex items-center justify-between text-[11px]"
                  >
                    <div>
                      <code className="text-white font-bold">{u.utmCampaign}</code>
                      <span className="text-white/40 text-[10px] ml-2">({u.utmSourceMedium})</span>
                    </div>
                    <span className="text-emerald-400 font-bold">
                      {u.verifiedOrders} orders • ₹
                      {Number(u.verifiedNetRevenueInr || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>

              <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-[11px] space-y-1">
                <div className="font-bold text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" /> Platform ROAS vs Backend-Verified Order Reconciliation
                </div>
                <p className="text-white/70">
                  Ad platforms self-report{' '}
                  <span className="text-amber-300 font-bold">
                    ₹{Number(executiveSummary?.totalPlatformClaimedRevenueInr || 0).toLocaleString('en-IN')}
                  </span>{' '}
                  due to overlapping view-through windows and unverified browser callbacks. FRAGMORÉ accounting strictly books{' '}
                  <span className="text-emerald-400 font-bold">
                    ₹{Number(executiveSummary?.storeVerifiedNetRevenueInr || 0).toLocaleString('en-IN')}
                  </span>{' '}
                  verified in PostgreSQL after deducting refunds.
                </p>
              </div>
            </div>
          </div>

          {/* 4. STANDARDIZED 13-EVENT DISPATCHER, PII SCRUBBER & BROWSER/SERVER DEDUPLICATION LAB */}
          <div className="bg-[#121218] border border-white/10 rounded-xl p-6 space-y-4">
            <div className="border-b border-white/10 pb-3">
              <h3 className="font-serif text-base uppercase tracking-wider text-white">
                4. Standardized 13-Event Dispatcher, Browser/Server Deduplication & PII Scrubber Lab
              </h3>
              <p className="text-white/50 text-[11px]">
                Test all 13 standardized events with <code className="text-[#D4AF37]">event_id</code> deduplication across Browser Pixel & Server CAPI, automatic <code className="text-[#D4AF37]">INR</code> currency enforcement, consent gating, and SHA-256 PII scrubbing.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] text-white/50 uppercase mb-1">
                  Standardized Event (13 Supported)
                </label>
                <select
                  value={testEventName}
                  onChange={(e) => {
                    setTestEventName(e.target.value);
                    setTestEventId(`evt_${e.target.value}_${Date.now().toString().slice(-4)}`);
                  }}
                  className="w-full bg-black/50 border border-white/20 text-white rounded px-3 py-2"
                >
                  {STANDARDIZED_EVENTS.map((ev) => (
                    <option key={ev} value={ev}>
                      {ev}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-white/50 uppercase mb-1">
                  Stable Event ID (Deduplication Key)
                </label>
                <input
                  type="text"
                  value={testEventId}
                  onChange={(e) => setTestEventId(e.target.value)}
                  className="w-full bg-black/50 border border-white/20 text-white rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-[10px] text-white/50 uppercase mb-1">
                  Currency & Value (Enforced INR)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={testCurrency}
                    onChange={(e) => setTestCurrency(e.target.value)}
                    className="w-20 bg-black/50 border border-white/20 text-[#D4AF37] font-bold rounded px-2 py-2"
                    title="Even if USD/EUR is entered, engine normalizes to INR"
                  />
                  <input
                    type="number"
                    value={testValueInr}
                    onChange={(e) => setTestValueInr(Number(e.target.value))}
                    className="flex-1 bg-black/50 border border-white/20 text-white rounded px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-white/50 uppercase mb-1">
                  Transaction / Order ID (Reconciliation)
                </label>
                <input
                  type="text"
                  value={testTransactionId}
                  onChange={(e) => setTestTransactionId(e.target.value)}
                  className="w-full bg-black/50 border border-white/20 text-white rounded px-3 py-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div className="p-3 bg-black/40 border border-white/10 rounded-lg space-y-2">
                <div className="text-[10px] text-white/50 uppercase font-bold">
                  Customer Consent State
                </div>
                <label className="flex items-center gap-2 text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={testAnalyticsConsent}
                    onChange={(e) => setTestAnalyticsConsent(e.target.checked)}
                  />
                  <span>Analytics Tracking Consent Granted</span>
                </label>
                <label className="flex items-center gap-2 text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={testMarketingConsent}
                    onChange={(e) => setTestMarketingConsent(e.target.checked)}
                  />
                  <span>Marketing Pixel / CAPI Consent Granted</span>
                </label>
              </div>

              <div className="p-3 bg-black/40 border border-white/10 rounded-lg space-y-2">
                <div className="text-[10px] text-white/50 uppercase font-bold">
                  Raw Customer PII Input (Auto-Scrubbed Before Analytics)
                </div>
                <input
                  type="text"
                  value={testRawEmail}
                  onChange={(e) => setTestRawEmail(e.target.value)}
                  placeholder="Raw Email (will be stripped)"
                  className="w-full bg-black/60 border border-white/15 text-white rounded px-2.5 py-1 text-[11px]"
                />
                <input
                  type="text"
                  value={testRawPhone}
                  onChange={(e) => setTestRawPhone(e.target.value)}
                  placeholder="Raw Phone (will be stripped)"
                  className="w-full bg-black/60 border border-white/15 text-white rounded px-2.5 py-1 text-[11px]"
                />
              </div>

              <div className="p-3 bg-black/40 border border-white/10 rounded-lg flex flex-col justify-between gap-2">
                <div className="text-[10px] text-white/50 uppercase font-bold">
                  Fire Browser Pixel vs Server CAPI (Same Event ID)
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleDispatchStandardizedEvent('BROWSER_PIXEL')}
                    className="flex-1 px-3 py-2 bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] font-bold rounded text-[11px]"
                  >
                    1. Fire Browser Pixel
                  </button>
                  <button
                    onClick={() => handleDispatchStandardizedEvent('SERVER_CAPI')}
                    className="flex-1 px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-bold rounded text-[11px]"
                  >
                    2. Fire Server CAPI (Dedupe)
                  </button>
                </div>
              </div>
            </div>

            {lastDispatchedResult && (
              <div className="p-3.5 bg-black/60 border border-emerald-500/30 rounded-lg space-y-1 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-400">
                    Last Ingestion Result: {lastDispatchedResult.eventRecord?.eventName} (
                    {lastDispatchedResult.deduplicationStatus})
                  </span>
                  <span className="text-[#D4AF37] font-bold">
                    Currency: {lastDispatchedResult.eventRecord?.currency} • PII Guard:{' '}
                    {lastDispatchedResult.eventRecord?.piiProtectionStatus}
                  </span>
                </div>
                <div className="text-white/70">{lastDispatchedResult.reason}</div>
              </div>
            )}

            {/* Recent Tracking Events Ledger */}
            <div className="overflow-x-auto pt-2">
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="border-b border-white/10 text-white/40 uppercase text-[9px]">
                    <th className="p-2.5">Event Name</th>
                    <th className="p-2.5">Stable Event ID</th>
                    <th className="p-2.5">Source</th>
                    <th className="p-2.5">Currency / Value</th>
                    <th className="p-2.5">Transaction Reconciliation</th>
                    <th className="p-2.5">Deduplication Status</th>
                    <th className="p-2.5">Consent & PII Guard</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {recentEvents.slice(0, 10).map((ev) => (
                    <tr key={ev.id} className="hover:bg-white/[0.02]">
                      <td className="p-2.5 font-bold text-white">{ev.eventName}</td>
                      <td className="p-2.5 text-[#D4AF37]">
                        <code>{ev.eventId}</code>
                      </td>
                      <td className="p-2.5 text-white/80">{ev.eventSource}</td>
                      <td className="p-2.5 font-bold text-white">
                        {ev.currency} ₹{Number(ev.valueInr || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="p-2.5">
                        {ev.transactionId ? (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              ev.transactionVerifiedInDb
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-amber-500/20 text-amber-300'
                            }`}
                          >
                            {ev.transactionId} •{' '}
                            {ev.transactionVerifiedInDb ? 'BACKEND VERIFIED' : 'UNVERIFIED CALLBACK'}
                          </span>
                        ) : (
                          <span className="text-white/40">—</span>
                        )}
                      </td>
                      <td className="p-2.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            ev.deduplicationStatus === 'UNIQUE_ACCEPTED'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : ev.deduplicationStatus?.includes('SUPPRESSED')
                              ? 'bg-rose-500/20 text-rose-300'
                              : 'bg-sky-500/20 text-sky-300'
                          }`}
                        >
                          {ev.deduplicationStatus}
                        </span>
                      </td>
                      <td className="p-2.5 text-[10px] text-emerald-400">
                        {ev.piiProtectionStatus}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Enterprise 14-Field Live Event Inspector, Data Audit & Reconciliation */}
          <AdminProductionAuditAndInspector initialView="inspector" compactHeader={true} />
        </div>
      )}

      {/* CREATE CAMPAIGN & UTM BUILDER MODAL */}
      {isAddModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAddModalOpen(false);
          }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
        >
          <div className="bg-[#0E0E14] border border-white/20 rounded-2xl w-full max-w-2xl my-auto max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="font-serif text-lg uppercase tracking-wider text-white">
                  Create Omnichannel Campaign & UTM Builder
                </h3>
                <p className="text-[11px] text-white/50">
                  Includes campaign calendar dates, budget guardrails, SKU creative mapping, UTM parameters & approval workflow.
                </p>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-white/40 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCampaign} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-white/60 mb-1">Campaign Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Monsoon Oud & Extrait Collector Flight"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-[#121218] border border-white/20 text-white rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-white/60 mb-1">Campaign Objective</label>
                  <select
                    value={newObjective}
                    onChange={(e: any) => setNewObjective(e.target.value)}
                    className="w-full bg-[#121218] border border-white/20 text-white rounded-lg px-3 py-2"
                  >
                    <option value="CONVERSIONS">Conversions (D2C Extrait & Discovery)</option>
                    <option value="DISCOVERY_ACQUISITION">Discovery Six Acquisition</option>
                    <option value="HIGH_INTENT_TRAFFIC">High-Intent Landing Page Traffic</option>
                    <option value="RETENTION_LOYALTY">Retention & Discovery Upgrade</option>
                    <option value="BRAND_AWARENESS">Luxury Brand Awareness</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-white/60 mb-1">Channel</label>
                  <select
                    value={newChannel}
                    onChange={(e: any) => setNewChannel(e.target.value)}
                    className="w-full bg-[#121218] border border-white/20 text-white rounded-lg px-3 py-2"
                  >
                    <option value="META_ADS">Meta Ads (IG / FB)</option>
                    <option value="GOOGLE_SEARCH_ADS">Google Search / Shopping</option>
                    <option value="WHATSAPP_BUSINESS">WhatsApp Concierge</option>
                    <option value="EMAIL">Email Editorial</option>
                    <option value="INFLUENCER_AFFILIATE">Influencer Partnership</option>
                  </select>
                </div>

                <div>
                  <label className="block text-white/60 mb-1">Daily Budget (INR)</label>
                  <input
                    type="number"
                    value={newDailyBudget}
                    onChange={(e) => setNewDailyBudget(Number(e.target.value))}
                    className="w-full bg-[#121218] border border-white/20 text-white rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-white/60 mb-1">Lifetime Budget (INR)</label>
                  <input
                    type="number"
                    value={newLifetimeBudget}
                    onChange={(e) => setNewLifetimeBudget(Number(e.target.value))}
                    className="w-full bg-[#121218] border border-white/20 text-white rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-white/60 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="w-full bg-[#121218] border border-white/20 text-white rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-white/60 mb-1">End Date</label>
                  <input
                    type="date"
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    className="w-full bg-[#121218] border border-white/20 text-white rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-white/60 mb-1">Assigned Owner</label>
                  <input
                    type="text"
                    value={newOwner}
                    onChange={(e) => setNewOwner(e.target.value)}
                    className="w-full bg-[#121218] border border-white/20 text-white rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-white/60 mb-1">Target Audience Segment</label>
                  <input
                    type="text"
                    value={newSegment}
                    onChange={(e) => setNewSegment(e.target.value)}
                    className="w-full bg-[#121218] border border-white/20 text-white rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-white/60 mb-1">Promoted SKU (Stock Checked)</label>
                  <input
                    type="text"
                    value={newPromotedSku}
                    onChange={(e) => setNewPromotedSku(e.target.value)}
                    placeholder="e.g. FRG-1-100ML"
                    className="w-full bg-[#121218] border border-white/20 text-white rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-white/60 mb-1">Creative Asset Headline</label>
                  <input
                    type="text"
                    value={newCreativeHeadline}
                    onChange={(e) => setNewCreativeHeadline(e.target.value)}
                    className="w-full bg-[#121218] border border-white/20 text-white rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              {/* UTM Builder Section */}
              <div className="p-3.5 bg-[#121218] border border-white/10 rounded-xl space-y-3">
                <div className="text-[10px] text-[#D4AF37] uppercase font-bold">
                  Standardized UTM Parameter Builder
                </div>
                <div>
                  <label className="block text-white/60 mb-1">Landing Page URL</label>
                  <input
                    type="text"
                    value={newLandingPage}
                    onChange={(e) => setNewLandingPage(e.target.value)}
                    className="w-full bg-black/40 border border-white/15 text-white rounded px-3 py-1.5"
                  />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <div>
                    <label className="block text-[10px] text-white/40">utm_source</label>
                    <input
                      type="text"
                      value={utmSource}
                      onChange={(e) => setUtmSource(e.target.value)}
                      className="w-full bg-black/40 border border-white/15 text-white rounded px-2 py-1"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-white/40">utm_medium</label>
                    <input
                      type="text"
                      value={utmMedium}
                      onChange={(e) => setUtmMedium(e.target.value)}
                      className="w-full bg-black/40 border border-white/15 text-white rounded px-2 py-1"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-white/40">utm_campaign</label>
                    <input
                      type="text"
                      value={utmCampaign}
                      onChange={(e) => setUtmCampaign(e.target.value)}
                      className="w-full bg-black/40 border border-white/15 text-white rounded px-2 py-1"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-white/40">utm_content</label>
                    <input
                      type="text"
                      value={utmContent}
                      onChange={(e) => setUtmContent(e.target.value)}
                      className="w-full bg-black/40 border border-white/15 text-white rounded px-2 py-1"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-white/40">utm_term</label>
                    <input
                      type="text"
                      value={utmTerm}
                      onChange={(e) => setUtmTerm(e.target.value)}
                      className="w-full bg-black/40 border border-white/15 text-white rounded px-2 py-1"
                    />
                  </div>
                </div>
                <div className="p-2 bg-black/60 rounded border border-white/10 text-[10px] text-emerald-400 break-all">
                  {previewTaggedUrl}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-white/20 text-white rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#D4AF37] text-[#08080A] font-bold rounded-lg"
                >
                  Save Campaign & Submit for Approval
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
