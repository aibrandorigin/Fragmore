import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../../context/StoreContext';
import { Influencer } from '../../types';
import {
  Users,
  Plus,
  DollarSign,
  TrendingUp,
  Trash2,
  Instagram,
  Copy,
  Check,
  Search,
  X,
  ShieldCheck,
  AlertTriangle,
  FileCheck2,
  Package,
  Building2,
  BarChart3,
  Play,
  RefreshCw,
  CheckCircle2,
  Clock,
  Lock,
  Sparkles,
  Send,
  RotateCcw,
  Award,
  Eye
} from 'lucide-react';
import { ErpTableExportBar } from './erp/ErpUniversalExportModal';

export type InfluencerModuleTab =
  | 'roster_tracking'
  | 'onboarding_portal'
  | 'commission_engine'
  | 'content_management'
  | 'reseller_b2b'
  | 'profitability_and_tests';

interface Props {
  initialView?: InfluencerModuleTab;
}

export const AdminInfluencers: React.FC<Props> = ({ initialView = 'roster_tracking' }) => {
  const { influencers, addInfluencer, deleteInfluencer, showNotification } = useStore();

  const [activeTab, setActiveTab] = useState<InfluencerModuleTab>(initialView);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Dashboard state from PostgreSQL backend
  const [dashboard, setDashboard] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [runningTests, setRunningTests] = useState<boolean>(false);
  const [testSuiteResult, setTestSuiteResult] = useState<any | null>(null);

  // Quick Add Partner Modal state (preserves legacy quick modal)
  const [newName, setNewName] = useState('');
  const [newHandle, setNewHandle] = useState('@');
  const [newCode, setNewCode] = useState('');
  const [newDiscount, setNewDiscount] = useState<number>(10);
  const [newCommission, setNewCommission] = useState<number>(15);
  const [newCampaign, setNewCampaign] = useState('Autumn Launch');

  // 1. Influencer Onboarding Portal Form State
  const [onbName, setOnbName] = useState('');
  const [onbEmail, setOnbEmail] = useState('');
  const [onbPhone, setOnbPhone] = useState('');
  const [onbInsta, setOnbInsta] = useState('@');
  const [onbYoutube, setOnbYoutube] = useState('');
  const [onbCode, setOnbCode] = useState('');
  const [onbCategory, setOnbCategory] = useState('Luxury & Niche Perfumery');
  const [onbLanguage, setOnbLanguage] = useState('English & Hindi');
  const [onbGeo, setOnbGeo] = useState('Mumbai, Delhi NCR, Bengaluru');
  const [onbFollowers, setOnbFollowers] = useState<number>(95000);
  const [onbEngagement, setOnbEngagement] = useState<number>(4.5);
  const [onbQuotedFee, setOnbQuotedFee] = useState<number>(18000);
  const [onbDeliverables, setOnbDeliverables] = useState('1 Instagram Reel + 2 Story Frames with UTM Link');
  const [onbCommissionType, setOnbCommissionType] = useState<'PERCENTAGE' | 'FIXED' | 'TIERED'>('TIERED');
  const [onbCommissionPct, setOnbCommissionPct] = useState<number>(15);
  const [onbAttrWindow, setOnbAttrWindow] = useState<number>(14);
  const [onbMaxOrdersPerCust, setOnbMaxOrdersPerCust] = useState<number>(2);

  // 2. Order Attribution Simulator Modal / Panel State
  const [simInfId, setSimInfId] = useState<string>('inf-1');
  const [simCustomerEmail, setSimCustomerEmail] = useState<string>('collector.mumbai@fragmore.in');
  const [simOrderAmount, setSimOrderAmount] = useState<number>(4200);
  const [simDaysSinceClick, setSimDaysSinceClick] = useState<number>(2);

  // 3. Content Deliverable Form State
  const [cntInfluencerId, setCntInfluencerId] = useState<string>('inf-1');
  const [cntCampaign, setCntCampaign] = useState<string>('Extrait_Connoisseur_Q1');
  const [cntPlatform, setCntPlatform] = useState<string>('INSTAGRAM_REEL');
  const [cntTitle, setCntTitle] = useState<string>('Evening Sillage Ritual — 100ml Extrait de Parfum');
  const [cntSampleSku, setCntSampleSku] = useState<string>('FRAG-AZR-100ML');
  const [cntFeeInr, setCntFeeInr] = useState<number>(15000);
  const [cntDisclosureText, setCntDisclosureText] = useState<string>('#Ad #PaidPartnership with @fragmore.official');
  const [cntDisclosureVerified, setCntDisclosureVerified] = useState<boolean>(true);

  // 4. Reseller B2B Onboarding & Wholesale Order Form State
  const [resBizName, setResBizName] = useState<string>('');
  const [resContactName, setResContactName] = useState<string>('');
  const [resEmail, setResEmail] = useState<string>('');
  const [resPhone, setResPhone] = useState<string>('');
  const [resCity, setResCity] = useState<string>('Mumbai');
  const [resState, setResState] = useState<string>('Maharashtra');
  const [resGstin, setResGstin] = useState<string>('27AABCF9012R1Z8');
  const [resMoqSlab, setResMoqSlab] = useState<'SLAB_8999' | 'SLAB_14999' | 'SLAB_29999'>('SLAB_8999');

  const [selectedResellerForOrder, setSelectedResellerForOrder] = useState<string>('reseller-maison-colaba');
  const [b2bSku1Qty, setB2bSku1Qty] = useState<number>(4);
  const [b2bSku2Qty, setB2bSku2Qty] = useState<number>(2);
  const [b2bPaymentVerified, setB2bPaymentVerified] = useState<boolean>(true);

  // Global Config Editor State
  const [cfgAttrWindowDays, setCfgAttrWindowDays] = useState<number>(14);
  const [cfgMaxOrdersPerCust, setCfgMaxOrdersPerCust] = useState<number>(2);
  const [cfgHoldingDays, setCfgHoldingDays] = useState<number>(7);
  const [cfgPayoutMinInr, setCfgPayoutMinInr] = useState<number>(2000);
  const [cfgRequireDisclosure, setCfgRequireDisclosure] = useState<boolean>(true);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/influencer-reseller/dashboard');
      if (!res.ok) return;
      const data = await res.json();
      setDashboard(data);
      if (data.config) {
        setCfgAttrWindowDays(Number(data.config.defaultAttributionWindowDays ?? 14));
        setCfgMaxOrdersPerCust(Number(data.config.defaultMaxAttributedOrdersPerCustomer ?? 2));
        setCfgHoldingDays(Number(data.config.defaultHoldingPeriodDays ?? 7));
        setCfgPayoutMinInr(Number(data.config.defaultPayoutMinimumInr ?? 2000));
        setCfgRequireDisclosure(data.config.requireAdvertisingDisclosure !== false);
      }
    } catch (err: any) {
      console.warn('[InfluencerResellerDashboard]', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Merge backend enriched influencers with StoreContext influencers
  const backendInfluencers: any[] = Array.isArray(dashboard?.influencers) ? dashboard.influencers : [];
  const displayInfluencers: any[] =
    backendInfluencers.length > 0
      ? backendInfluencers
      : influencers.map((inf) => ({
          ...inf,
          partnerMetadata: {
            affiliateId: `AFF-FRG-${inf.code}`,
            trackingUrl: `${window.location.origin}/shop?utm_source=influencer&utm_medium=affiliate&utm_campaign=${inf.code.toLowerCase()}`,
            onboardingStatus: 'APPROVED',
            commissionRules: {
              commissionType: 'PERCENTAGE',
              commissionPercentage: inf.commissionPercentage,
              attributionWindowDays: 14,
              maxAttributedOrdersPerCustomer: 2,
              holdingPeriodDays: 7,
              payoutMinimumInr: 2000
            },
            funnelMetrics: {
              clicks: inf.clicks || 0,
              landingPageVisits: Math.round((inf.clicks || 0) * 0.85),
              addToCarts: Math.round((inf.clicks || 0) * 0.2),
              ordersCount: inf.orders || 0,
              verifiedNetRevenueInr: inf.totalRevenue || 0,
              refundedOrdersCount: 0,
              refundedAmountInr: 0,
              commissionEarnedHoldInr: 0,
              commissionPayableInr: inf.totalCommission || 0,
              commissionPaidOutInr: 0,
              attributedOrders: []
            }
          }
        }));

  const filteredInfluencers = displayInfluencers.filter(
    (inf) =>
      String(inf.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(inf.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(inf.instagramHandle || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(inf.partnerMetadata?.affiliateId || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const summary = dashboard?.summary || {
    totalInfluencers: displayInfluencers.length,
    approvedInfluencersCount: displayInfluencers.length,
    pendingOnboardingCount: 0,
    totalClicks: displayInfluencers.reduce((s, i) => s + Number(i.clicks || 0), 0),
    totalLandingVisits: 0,
    totalAddToCarts: 0,
    totalInfluencerOrders: displayInfluencers.reduce((s, i) => s + Number(i.orders || 0), 0),
    totalVerifiedInfluencerRevenueInr: displayInfluencers.reduce((s, i) => s + Number(i.totalRevenue || 0), 0),
    totalCommissionOnHoldInr: 0,
    totalCommissionPayableInr: displayInfluencers.reduce((s, i) => s + Number(i.totalCommission || 0), 0),
    totalCommissionPaidInr: 0,
    pendingPayoutQueueCount: 0,
    totalContentDeliverables: 0,
    publishedContentCount: 0,
    compliantDisclosureCount: 0,
    activeResellersCount: 0,
    totalB2bOrdersCount: 0,
    totalResellerWholesaleRevenueInr: 0
  };

  // Legacy quick add handler (also syncs with backend onboarding API)
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newCode) return;

    const newInf: Influencer = {
      id: 'inf-' + Math.random().toString(36).substring(2, 7),
      name: newName,
      instagramHandle: newHandle,
      code: newCode.toUpperCase(),
      discountPercentage: newDiscount,
      commissionPercentage: newCommission,
      campaign: newCampaign,
      clicks: 0,
      orders: 0,
      totalRevenue: 0,
      totalCommission: 0,
      status: 'ACTIVE'
    };
    addInfluencer(newInf);

    try {
      await fetch('/api/influencer-reseller/influencers/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newInf.id,
          name: newName,
          instagramHandle: newHandle,
          code: newCode.toUpperCase(),
          discountPercentage: newDiscount,
          commissionPercentage: newCommission,
          campaign: newCampaign,
          onboardingStatus: 'APPROVED'
        })
      });
      await fetchDashboard();
    } catch {
      // fallback already handled by StoreContext
    }

    setIsModalOpen(false);
    setNewName('');
    setNewHandle('@');
    setNewCode('');
  };

  const copyCampaignLink = (inf: any) => {
    const meta = inf.partnerMetadata || {};
    const url =
      meta.trackingUrl ||
      `${window.location.origin}/shop?utm_source=influencer&utm_medium=affiliate&utm_campaign=${String(inf.code || '').toLowerCase()}&aff_id=${meta.affiliateId || inf.id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(inf.id);
    setTimeout(() => setCopiedId(null), 2500);
    showNotification(`Copied unique affiliate tracking link for ${inf.name}`);
  };

  // Submit full onboarding application
  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onbName.trim() || !onbCode.trim()) {
      showNotification('Partner Name and Referral Code are required.');
      return;
    }
    try {
      const res = await fetch('/api/influencer-reseller/influencers/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: onbName.trim(),
          email: onbEmail.trim(),
          phone: onbPhone.trim(),
          instagramHandle: onbInsta.trim(),
          youtubeHandle: onbYoutube.trim(),
          code: onbCode.trim().toUpperCase(),
          campaign: `Creator_${onbCode.trim().toUpperCase()}`,
          discountPercentage: 10,
          commissionPercentage: onbCommissionPct,
          commissionType: onbCommissionType,
          contentCategory: onbCategory,
          language: onbLanguage,
          targetGeography: onbGeo.split(',').map((s) => s.trim()),
          audienceDemographics: {
            followersCount: onbFollowers,
            engagementRatePercent: onbEngagement,
            topCities: onbGeo.split(',').map((s) => s.trim()),
            ageGroupPrimary: '24-38',
            genderSplit: '55% Women / 45% Men'
          },
          commercialQuotation: {
            quotedFeeInr: onbQuotedFee,
            deliverablesSummary: onbDeliverables,
            exclusivityDays: 30,
            usageRightsMonths: 6,
            contractSigned: true
          },
          attributionWindowDays: onbAttrWindow,
          maxAttributedOrdersPerCustomer: onbMaxOrdersPerCust,
          onboardingStatus: 'PENDING_REVIEW'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Onboarding failed');
      await fetchDashboard();
      setOnbName('');
      setOnbEmail('');
      setOnbPhone('');
      setOnbCode('');
      showNotification(`Onboarding application submitted for ${data.influencer.name} (Pending Admin Review).`);
    } catch (err: any) {
      showNotification(`Error: ${err.message}`);
    }
  };

  const handleReviewInfluencer = async (
    infId: string,
    decision: 'APPROVED' | 'REJECTED' | 'SUSPENDED'
  ) => {
    try {
      const res = await fetch(`/api/influencer-reseller/influencers/${infId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          paymentDetails:
            decision === 'APPROVED'
              ? {
                  collectedSecurely: true,
                  payoutMethod: 'NEFT_IMPS',
                  maskedAccountOrUpi: 'HDFC****8821',
                  taxIdGstinOrPan: 'ABCDE1234F',
                  verifiedAt: new Date().toISOString()
                }
              : undefined
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Review action failed');
      await fetchDashboard();
      showNotification(`Influencer ${infId} marked as ${decision}.`);
    } catch (err: any) {
      showNotification(`Error: ${err.message}`);
    }
  };

  const handleRecordFunnelEvent = async (
    infId: string,
    eventType: 'CLICK' | 'LANDING_VISIT' | 'ADD_TO_CART'
  ) => {
    try {
      const res = await fetch(`/api/influencer-reseller/influencers/${infId}/funnel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventType, count: 1 })
      });
      if (!res.ok) throw new Error('Failed to record funnel event');
      await fetchDashboard();
      showNotification(`Recorded ${eventType} for ${infId}.`);
    } catch (err: any) {
      showNotification(`Error: ${err.message}`);
    }
  };

  const handleSimulateOrderAttribution = async () => {
    try {
      const clickDate = new Date(Date.now() - simDaysSinceClick * 86400000).toISOString();
      const orderDate = new Date().toISOString();
      const res = await fetch(`/api/influencer-reseller/influencers/${simInfId}/attribute-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: `ORD-AFF-${Date.now().toString().slice(-5)}`,
          orderNumber: `FRG-AFF-${Date.now().toString().slice(-5)}`,
          customerEmail: simCustomerEmail.trim(),
          orderNetRevenueInr: Number(simOrderAmount),
          orderPaymentStatus: 'PAID',
          orderDeliveryStatus: 'DELIVERED',
          clickTimestampIso: clickDate,
          orderTimestampIso: orderDate,
          items: [{ sku: 'FRAG-AZR-100ML', name: 'AZURE Extrait 100ml', quantity: 1, priceInr: Number(simOrderAmount) }],
          holdingPeriodCleared: false
        })
      });
      const data = await res.json();
      await fetchDashboard();
      if (!data.attributed) {
        showNotification(`Attribution Guard Blocked: ${data.reason}`);
      } else {
        showNotification(
          `Order attributed! Commission ₹${data.commissionInr} placed in ${data.settlementState} (${data.reason}).`
        );
      }
    } catch (err: any) {
      showNotification(`Error: ${err.message}`);
    }
  };

  const handleSettleOrderCommission = async (infId: string, orderId: string) => {
    try {
      const res = await fetch(`/api/influencer-reseller/influencers/${infId}/settle-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          orderDeliveredVerified: true,
          holdingPeriodElapsed: true
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Settlement failed');
      await fetchDashboard();
      showNotification(data.reason || `Order ${orderId} settled to Payable Commission.`);
    } catch (err: any) {
      showNotification(`Error: ${err.message}`);
    }
  };

  const handleClawbackOrderCommission = async (infId: string, orderId: string) => {
    try {
      const res = await fetch(`/api/influencer-reseller/influencers/${infId}/clawback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          refundReason: 'Customer return/refund verified — automatic commission clawback'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Clawback failed');
      await fetchDashboard();
      showNotification(data.reason || `Clawed back ₹${data.clawedBackAmountInr} on order ${orderId}.`);
    } catch (err: any) {
      showNotification(`Error: ${err.message}`);
    }
  };

  const handleQueuePayout = async (infId: string) => {
    try {
      const res = await fetch('/api/influencer-reseller/payouts/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ influencerId: infId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Cannot queue payout');
      await fetchDashboard();
      showNotification(data.reason);
    } catch (err: any) {
      showNotification(`Payout Guard: ${err.message}`);
    }
  };

  const handleDecisionPayoutTask = async (taskId: string, decision: 'APPROVED' | 'REJECTED') => {
    try {
      const res = await fetch(`/api/influencer-reseller/payouts/${taskId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          settlementReference: `UTR-FRG-${Date.now().toString().slice(-7)}`
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payout decision failed');
      await fetchDashboard();
      showNotification(data.reason);
    } catch (err: any) {
      showNotification(`Error: ${err.message}`);
    }
  };

  const handleSaveGlobalConfig = async () => {
    try {
      const res = await fetch('/api/influencer-reseller/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defaultAttributionWindowDays: cfgAttrWindowDays,
          defaultMaxAttributedOrdersPerCustomer: cfgMaxOrdersPerCust,
          defaultHoldingPeriodDays: cfgHoldingDays,
          defaultPayoutMinimumInr: cfgPayoutMinInr,
          requireAdvertisingDisclosure: cfgRequireDisclosure
        })
      });
      if (!res.ok) throw new Error('Failed to save config');
      await fetchDashboard();
      showNotification('Influencer Attribution, Commission Hold & Reseller MOQ configuration saved.');
    } catch (err: any) {
      showNotification(`Error: ${err.message}`);
    }
  };

  const handleCreateContentBrief = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetInf = displayInfluencers.find((i) => i.id === cntInfluencerId);
    try {
      const res = await fetch('/api/influencer-reseller/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          influencerId: cntInfluencerId,
          influencerName: targetInf?.name || 'Creator Partner',
          campaignId: cntCampaign,
          platform: cntPlatform,
          deliverableTitle: cntTitle,
          workflowStage: 'BRIEF_ISSUED',
          sampleSku: cntSampleSku,
          advertisingDisclosureRequired: true,
          advertisingDisclosureVerified: cntDisclosureVerified,
          disclosureText: cntDisclosureText,
          agreedFeeInr: cntFeeInr,
          paymentStatus: 'UNPAID'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create brief');
      await fetchDashboard();
      showNotification(`Content deliverable brief created for ${targetInf?.name || cntInfluencerId}.`);
    } catch (err: any) {
      showNotification(`Error: ${err.message}`);
    }
  };

  const handleAdvanceContentStage = async (
    deliverable: any,
    nextStage: 'SAMPLE_SHIPPED' | 'DRAFT_RECEIVED' | 'CONTENT_APPROVED' | 'CONTENT_PUBLISHED',
    overrideDisclosureVerified?: boolean
  ) => {
    try {
      const res = await fetch('/api/influencer-reseller/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: deliverable.id,
          influencerId: deliverable.influencerId,
          workflowStage: nextStage,
          advertisingDisclosureVerified:
            overrideDisclosureVerified !== undefined
              ? overrideDisclosureVerified
              : deliverable.advertisingDisclosureVerified,
          disclosureText: deliverable.disclosureText || '#Ad #PaidPartnership with @fragmore.official',
          sampleTrackingAwb:
            nextStage === 'SAMPLE_SHIPPED' && !deliverable.sampleTrackingAwb
              ? `BD-SMP-${Date.now().toString().slice(-6)}`
              : deliverable.sampleTrackingAwb,
          draftUrl:
            nextStage === 'DRAFT_RECEIVED' && !deliverable.draftUrl
              ? `https://drive.fragmore.in/drafts/${deliverable.id}`
              : deliverable.draftUrl,
          publishedUrl:
            nextStage === 'CONTENT_PUBLISHED' && !deliverable.publishedUrl
              ? `https://instagram.com/p/fragmore_${deliverable.id.slice(-5)}`
              : deliverable.publishedUrl
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Stage transition blocked');
      await fetchDashboard();
      showNotification(data.reason);
    } catch (err: any) {
      showNotification(`Compliance Guard: ${err.message}`);
    }
  };

  const handleOnboardReseller = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resBizName.trim() || !resContactName.trim()) {
      showNotification('Business Name and Contact Person are required.');
      return;
    }
    try {
      const res = await fetch('/api/influencer-reseller/resellers/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: resBizName.trim(),
          contactName: resContactName.trim(),
          email: resEmail.trim(),
          phone: resPhone.trim(),
          city: resCity.trim(),
          state: resState.trim(),
          gstin: resGstin.trim(),
          onboardingStatus: 'APPROVED',
          moqSlabCode: resMoqSlab
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to onboard reseller');
      await fetchDashboard();
      setResBizName('');
      setResContactName('');
      setResEmail('');
      setResPhone('');
      showNotification(`Reseller partner "${data.reseller.businessName}" onboarded on ${resMoqSlab}.`);
    } catch (err: any) {
      showNotification(`Error: ${err.message}`);
    }
  };

  const handleCreateB2bOrder = async () => {
    try {
      const items: Array<{ sku: string; quantity: number }> = [];
      if (b2bSku1Qty > 0) items.push({ sku: 'FRAG-AZR-100ML', quantity: b2bSku1Qty });
      if (b2bSku2Qty > 0) items.push({ sku: 'FRAG-slk-100ML', quantity: b2bSku2Qty });

      const res = await fetch(`/api/influencer-reseller/resellers/${selectedResellerForOrder}/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          paymentVerified: b2bPaymentVerified,
          paymentReference: b2bPaymentVerified ? `NEFT-B2B-${Date.now().toString().slice(-6)}` : undefined
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'B2B Order rejected');
      await fetchDashboard();
      showNotification(data.reason);
    } catch (err: any) {
      showNotification(`MOQ / Inventory Guard: ${err.message}`);
    }
  };

  const handleReconcileReseller = async (resellerId: string, triggerRepeatReminder: boolean) => {
    try {
      const res = await fetch(`/api/influencer-reseller/resellers/${resellerId}/reconcile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          triggerRepeatReminder,
          paymentReference: `NEFT-REC-${Date.now().toString().slice(-6)}`
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reconciliation failed');
      await fetchDashboard();
      showNotification(data.reason);
    } catch (err: any) {
      showNotification(`Error: ${err.message}`);
    }
  };

  const handleRunVerificationSuite = async () => {
    setRunningTests(true);
    try {
      const res = await fetch('/api/influencer-reseller/run-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      setTestSuiteResult(data);
      await fetchDashboard();
      showNotification(
        `Verification Suite Complete: ${data.passedCount}/${data.totalTests} E2E Scenarios Passed.`
      );
    } catch (err: any) {
      showNotification(`Error running verification suite: ${err.message}`);
    } finally {
      setRunningTests(false);
    }
  };

  const TABS: { id: InfluencerModuleTab; label: string }[] = [
    { id: 'roster_tracking', label: '1. Influencer Roster & Tracking Funnel' },
    { id: 'onboarding_portal', label: '2. Influencer Onboarding Portal' },
    { id: 'commission_engine', label: '3. Commissions, Clawbacks & Payout Queue' },
    { id: 'content_management', label: '4. Content & #Ad Disclosure Compliance' },
    { id: 'reseller_b2b', label: '5. Reseller B2B & MOQ Slabs (₹8,999 / ₹14,999)' },
    { id: 'profitability_and_tests', label: '6. Unified Profitability & 6 E2E Tests' }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-mono text-xs">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-5 border-b border-white/10 gap-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#D4AF37] font-bold">
            <span>FRAGMORÉ PARTNER ECOSYSTEM</span>
            <span>•</span>
            <span>INFLUENCERS, AFFILIATES, CONTENT &amp; B2B RESELLERS</span>
          </div>
          <h2 className="font-serif text-2xl uppercase tracking-wider text-white mt-1">
            Integrated Influencer, Affiliate, Referral &amp; Reseller System
          </h2>
          <p className="text-xs text-white/50">
            Bounded attribution windows, settlement-gated commissions, mandatory #Ad disclosures, and separate ₹8,999 / ₹14,999 B2B reseller slabs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ErpTableExportBar
            reportKey="influencer_activity"
            title="FRAGMORÉ Influencer, Affiliate & Reseller Performance"
            notify={(m) => showNotification(m)}
          />
          <button
            onClick={fetchDashboard}
            className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white/80 rounded flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#D4AF37]" /> Refresh
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] font-bold text-xs uppercase tracking-wider rounded flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Quick Add Partner
          </button>
        </div>
      </div>

      {/* Top Executive KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 bg-[#121218] border border-white/10 rounded-xl space-y-1">
          <span className="text-white/50 text-[10px] uppercase">Verified Affiliate Revenue</span>
          <div className="text-xl font-bold text-white">
            ₹{Number(summary.totalVerifiedInfluencerRevenueInr || 0).toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-emerald-400">
            {summary.totalInfluencerOrders} attributed orders
          </span>
        </div>

        <div className="p-3.5 bg-[#121218] border border-white/10 rounded-xl space-y-1">
          <span className="text-white/50 text-[10px] uppercase">Commission On Hold</span>
          <div className="text-xl font-bold text-amber-400">
            ₹{Number(summary.totalCommissionOnHoldInr || 0).toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-white/40">{cfgHoldingDays}d return hold period</span>
        </div>

        <div className="p-3.5 bg-[#121218] border border-white/10 rounded-xl space-y-1">
          <span className="text-white/50 text-[10px] uppercase">Settled Payable</span>
          <div className="text-xl font-bold text-[#D4AF37]">
            ₹{Number(summary.totalCommissionPayableInr || 0).toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-emerald-400">
            {summary.pendingPayoutQueueCount} in payout approval queue
          </span>
        </div>

        <div className="p-3.5 bg-[#121218] border border-white/10 rounded-xl space-y-1">
          <span className="text-white/50 text-[10px] uppercase">Affiliate Funnel</span>
          <div className="text-xl font-bold text-white">
            {Number(summary.totalClicks || 0).toLocaleString('en-IN')} Clicks
          </div>
          <span className="text-[10px] text-white/40">
            {summary.totalLandingVisits} Visits • {summary.totalAddToCarts} ATC
          </span>
        </div>

        <div className="p-3.5 bg-[#121218] border border-white/10 rounded-xl space-y-1">
          <span className="text-white/50 text-[10px] uppercase">Content &amp; #Ad Compliance</span>
          <div className="text-xl font-bold text-white">
            {summary.publishedContentCount}/{summary.totalContentDeliverables} Live
          </div>
          <span className="text-[10px] text-emerald-400">
            {summary.compliantDisclosureCount} verified #Ad disclosures
          </span>
        </div>

        <div className="p-3.5 bg-[#121218] border border-white/10 rounded-xl space-y-1">
          <span className="text-white/50 text-[10px] uppercase">B2B Reseller Wholesale</span>
          <div className="text-xl font-bold text-emerald-400">
            ₹{Number(summary.totalResellerWholesaleRevenueInr || 0).toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-white/40">
            {summary.activeResellersCount} resellers • {summary.totalB2bOrdersCount} B2B POs
          </span>
        </div>
      </div>

      {/* Sub-Navigation Bar */}
      <div className="flex flex-wrap gap-1.5 bg-[#121218] p-1.5 rounded-xl border border-white/10">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-3 py-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
              activeTab === t.id
                ? 'bg-[#D4AF37] text-[#08080A]'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: INFLUENCER ROSTER, UNIQUE TRACKING & BOUNDED ATTRIBUTION       */}
      {/* ===================================================================== */}
      {activeTab === 'roster_tracking' && (
        <div className="space-y-6">
          {/* Search & Governance Banner */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#121218] border border-white/10 rounded-xl px-4 py-3">
            <div className="flex items-center gap-3 flex-1">
              <Search className="w-4 h-4 text-white/40" />
              <input
                type="text"
                placeholder="Search partner by name, affiliate ID (AFF-FRG-...), handle, or promo code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent text-xs text-white placeholder-white/40 focus:outline-none flex-1"
              />
            </div>
            <div className="flex items-center gap-2 text-[10px] text-[#E5C378] bg-[#D4AF37]/10 border border-[#D4AF37]/30 px-3 py-1.5 rounded-lg">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>
                Bounded Attribution Active: {cfgAttrWindowDays}-Day Window • Max {cfgMaxOrdersPerCust} Orders/Customer (No Indefinite Attribution)
              </span>
            </div>
          </div>

          {/* Influencers Table with Full Funnel & Settlement Columns */}
          <div className="bg-[#121218] border border-white/10 rounded-xl overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10 text-white/40 uppercase text-[10px]">
                  <th className="p-3.5">Influencer &amp; Affiliate ID</th>
                  <th className="p-3.5">Handle &amp; Category</th>
                  <th className="p-3.5">Code &amp; UTM</th>
                  <th className="p-3.5">Funnel (Click → Visit → ATC)</th>
                  <th className="p-3.5">Orders &amp; Refunds</th>
                  <th className="p-3.5">Verified Net Revenue</th>
                  <th className="p-3.5">Commission Rule</th>
                  <th className="p-3.5">Hold vs Payable</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredInfluencers.map((inf) => {
                  const meta = inf.partnerMetadata || {};
                  const funnel = meta.funnelMetrics || {};
                  const rules = meta.commissionRules || {};
                  const clicks = funnel.clicks ?? inf.clicks ?? 0;
                  const visits = funnel.landingPageVisits ?? Math.round(clicks * 0.85);
                  const atc = funnel.addToCarts ?? Math.round(clicks * 0.2);
                  const orders = funnel.ordersCount ?? inf.orders ?? 0;
                  const netRev = funnel.verifiedNetRevenueInr ?? inf.totalRevenue ?? 0;
                  const holdComm = funnel.commissionEarnedHoldInr ?? 0;
                  const payableComm = funnel.commissionPayableInr ?? inf.totalCommission ?? 0;
                  const conv = clicks > 0 ? ((orders / clicks) * 100).toFixed(1) : '0.0';

                  return (
                    <tr key={inf.id} className="hover:bg-white/[0.02]">
                      <td className="p-3.5">
                        <strong className="text-white block font-medium">{inf.name}</strong>
                        <span className="text-[10px] text-[#D4AF37] font-bold block">
                          {meta.affiliateId || `AFF-FRG-${inf.code}`}
                        </span>
                        <span className="text-[10px] text-white/40">{inf.campaign}</span>
                      </td>

                      <td className="p-3.5">
                        <span className="text-pink-400 font-semibold flex items-center gap-1">
                          <Instagram className="w-3 h-3" />
                          {inf.instagramHandle || '@fragmore.curated'}
                        </span>
                        <span className="text-[10px] text-white/40 block mt-0.5">
                          {meta.contentCategory || 'Luxury & Niche Perfumery'}
                        </span>
                      </td>

                      <td className="p-3.5 space-y-1.5">
                        <span className="px-2 py-0.5 rounded bg-[#D4AF37]/20 text-[#E5C378] font-bold font-mono text-[11px] inline-block">
                          {inf.code}
                        </span>
                        <button
                          onClick={() => copyCampaignLink(inf)}
                          className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-white/80 hover:text-white flex items-center gap-1 text-[10px] cursor-pointer"
                          title="Copy Tagged UTM Link"
                        >
                          {copiedId === inf.id ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          <span>{copiedId === inf.id ? 'Copied UTM' : 'Copy UTM'}</span>
                        </button>
                      </td>

                      <td className="p-3.5">
                        <div className="text-white font-semibold">
                          {clicks.toLocaleString('en-IN')} → {visits.toLocaleString('en-IN')} →{' '}
                          {atc.toLocaleString('en-IN')}
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <button
                            onClick={() => handleRecordFunnelEvent(inf.id, 'CLICK')}
                            className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 text-[9px] text-white/70 cursor-pointer"
                          >
                            +Click
                          </button>
                          <button
                            onClick={() => handleRecordFunnelEvent(inf.id, 'LANDING_VISIT')}
                            className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 text-[9px] text-white/70 cursor-pointer"
                          >
                            +Visit
                          </button>
                          <button
                            onClick={() => handleRecordFunnelEvent(inf.id, 'ADD_TO_CART')}
                            className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 text-[9px] text-white/70 cursor-pointer"
                          >
                            +ATC
                          </button>
                        </div>
                      </td>

                      <td className="p-3.5">
                        <div className="font-bold text-white">{orders} Orders</div>
                        <div className="text-[10px] text-emerald-400">{conv}% Conv.</div>
                        {(funnel.refundedOrdersCount || 0) > 0 && (
                          <div className="text-[10px] text-rose-400">
                            {funnel.refundedOrdersCount} Refunded (-₹{funnel.refundedAmountInr})
                          </div>
                        )}
                      </td>

                      <td className="p-3.5 font-bold text-white">
                        ₹{Number(netRev).toLocaleString('en-IN')}
                        <span className="block text-[10px] text-white/40 font-normal">
                          Cust. Disc: {inf.discountPercentage || 10}%
                        </span>
                      </td>

                      <td className="p-3.5">
                        <span className="text-[#D4AF37] font-bold">
                          {rules.commissionType || 'PERCENTAGE'} ({inf.commissionPercentage}%)
                        </span>
                        <span className="block text-[10px] text-white/40">
                          {rules.attributionWindowDays || 14}d window • Max{' '}
                          {rules.maxAttributedOrdersPerCustomer || 2}/cust
                        </span>
                      </td>

                      <td className="p-3.5">
                        <div className="text-amber-400 text-[11px]">
                          Hold: ₹{Number(holdComm).toLocaleString('en-IN')}
                        </div>
                        <div className="text-emerald-400 font-bold text-xs">
                          Payable: ₹{Number(payableComm).toLocaleString('en-IN')}
                        </div>
                      </td>

                      <td className="p-3.5 text-right space-x-1.5">
                        <button
                          onClick={() => handleQueuePayout(inf.id)}
                          className="px-2.5 py-1 rounded bg-[#D4AF37]/20 hover:bg-[#D4AF37]/30 text-[#E5C378] text-[10px] font-bold cursor-pointer"
                          title="Queue Payable Commission for Admin Payout Approval"
                        >
                          Queue Payout
                        </button>
                        <button
                          onClick={() => {
                            deleteInfluencer(inf.id);
                          }}
                          className="p-1.5 text-white/40 hover:text-rose-400 cursor-pointer"
                          title="Delete Partner"
                        >
                          <Trash2 className="w-3.5 h-3.5 inline" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Interactive Bounded Order Attribution Simulator */}
          <div className="bg-[#121218] border border-white/10 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
              <div>
                <h3 className="font-serif text-base uppercase tracking-wider text-white">
                  Test Documented Order Attribution &amp; Anti-Indefinite Coupon Guard
                </h3>
                <p className="text-[11px] text-white/50">
                  Verifies attribution window ({cfgAttrWindowDays} days), per-customer order cap (max {cfgMaxOrdersPerCust} orders), product exclusions, and holding-period commission state.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
              <div>
                <label className="block text-[10px] uppercase text-white/50 mb-1">Influencer Partner</label>
                <select
                  value={simInfId}
                  onChange={(e) => setSimInfId(e.target.value)}
                  className="w-full bg-[#08080A] border border-white/15 rounded-lg px-3 py-2 text-white"
                >
                  {displayInfluencers.map((inf) => (
                    <option key={inf.id} value={inf.id}>
                      {inf.name} ({inf.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase text-white/50 mb-1">Customer Email</label>
                <input
                  type="email"
                  value={simCustomerEmail}
                  onChange={(e) => setSimCustomerEmail(e.target.value)}
                  className="w-full bg-[#08080A] border border-white/15 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase text-white/50 mb-1">Net Order Value (₹)</label>
                <input
                  type="number"
                  value={simOrderAmount}
                  onChange={(e) => setSimOrderAmount(Number(e.target.value))}
                  className="w-full bg-[#08080A] border border-white/15 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase text-white/50 mb-1">
                  Days Elapsed Since Click
                </label>
                <input
                  type="number"
                  value={simDaysSinceClick}
                  onChange={(e) => setSimDaysSinceClick(Number(e.target.value))}
                  className="w-full bg-[#08080A] border border-white/15 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <button
                onClick={handleSimulateOrderAttribution}
                className="px-4 py-2 bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] font-bold rounded-lg uppercase tracking-wider cursor-pointer"
              >
                Attribute Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: SECURE INFLUENCER ONBOARDING PORTAL & APPLICATION REVIEW       */}
      {/* ===================================================================== */}
      {activeTab === 'onboarding_portal' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Onboarding Application Form */}
          <div className="lg:col-span-6 bg-[#121218] border border-white/10 rounded-xl p-5 space-y-4">
            <div className="border-b border-white/10 pb-3">
              <span className="text-[10px] uppercase text-[#D4AF37] font-bold">
                CREATOR &amp; TASTEMAKER APPLICATION
              </span>
              <h3 className="font-serif text-lg uppercase tracking-wider text-white mt-0.5">
                Influencer Onboarding Portal
              </h3>
              <p className="text-[11px] text-white/50">
                Captures social handles, audience demographics, commercial quotation, deliverables, and bounded attribution rules. Payment details are collected securely only upon approval.
              </p>
            </div>

            <form onSubmit={handleOnboardSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase text-white/60 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mira Rajput Kapoor"
                    value={onbName}
                    onChange={(e) => setOnbName(e.target.value)}
                    className="w-full bg-[#08080A] border border-white/15 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-white/60 mb-1">
                    Desired Referral Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MIRA10"
                    value={onbCode}
                    onChange={(e) => setOnbCode(e.target.value.toUpperCase())}
                    className="w-full bg-[#08080A] border border-white/15 rounded-lg px-3 py-2 text-white uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase text-white/60 mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="creator@luxuryagency.in"
                    value={onbEmail}
                    onChange={(e) => setOnbEmail(e.target.value)}
                    className="w-full bg-[#08080A] border border-white/15 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-white/60 mb-1">WhatsApp / Phone</label>
                  <input
                    type="text"
                    placeholder="+91 98201 11223"
                    value={onbPhone}
                    onChange={(e) => setOnbPhone(e.target.value)}
                    className="w-full bg-[#08080A] border border-white/15 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase text-white/60 mb-1">Instagram Handle</label>
                  <input
                    type="text"
                    value={onbInsta}
                    onChange={(e) => setOnbInsta(e.target.value)}
                    className="w-full bg-[#08080A] border border-white/15 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-white/60 mb-1">YouTube / Other Handle</label>
                  <input
                    type="text"
                    placeholder="@ChannelName"
                    value={onbYoutube}
                    onChange={(e) => setOnbYoutube(e.target.value)}
                    className="w-full bg-[#08080A] border border-white/15 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] uppercase text-white/60 mb-1">Content Category</label>
                  <select
                    value={onbCategory}
                    onChange={(e) => setOnbCategory(e.target.value)}
                    className="w-full bg-[#08080A] border border-white/15 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="Luxury & Niche Perfumery">Luxury &amp; Niche Perfumery</option>
                    <option value="Haute Couture & Editorial">Haute Couture &amp; Editorial</option>
                    <option value="Grooming & Connoisseur">Grooming &amp; Connoisseur</option>
                    <option value="Bridal & Occasion Styling">Bridal &amp; Occasion Styling</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-white/60 mb-1">Language</label>
                  <input
                    type="text"
                    value={onbLanguage}
                    onChange={(e) => setOnbLanguage(e.target.value)}
                    className="w-full bg-[#08080A] border border-white/15 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-white/60 mb-1">Target Geography</label>
                  <input
                    type="text"
                    value={onbGeo}
                    onChange={(e) => setOnbGeo(e.target.value)}
                    className="w-full bg-[#08080A] border border-white/15 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] uppercase text-white/60 mb-1">Audience Followers</label>
                  <input
                    type="number"
                    value={onbFollowers}
                    onChange={(e) => setOnbFollowers(Number(e.target.value))}
                    className="w-full bg-[#08080A] border border-white/15 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-white/60 mb-1">Engagement Rate (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={onbEngagement}
                    onChange={(e) => setOnbEngagement(Number(e.target.value))}
                    className="w-full bg-[#08080A] border border-white/15 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-white/60 mb-1">Commercial Quote (₹)</label>
                  <input
                    type="number"
                    value={onbQuotedFee}
                    onChange={(e) => setOnbQuotedFee(Number(e.target.value))}
                    className="w-full bg-[#08080A] border border-white/15 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase text-white/60 mb-1">
                  Contract Deliverables &amp; Usage Rights
                </label>
                <input
                  type="text"
                  value={onbDeliverables}
                  onChange={(e) => setOnbDeliverables(e.target.value)}
                  className="w-full bg-[#08080A] border border-white/15 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                <div>
                  <label className="block text-[10px] uppercase text-white/60 mb-1">Commission Model</label>
                  <select
                    value={onbCommissionType}
                    onChange={(e) => setOnbCommissionType(e.target.value as any)}
                    className="w-full bg-[#08080A] border border-white/15 rounded-lg px-2.5 py-2 text-white"
                  >
                    <option value="PERCENTAGE">Percentage</option>
                    <option value="FIXED">Fixed INR</option>
                    <option value="TIERED">Tiered Slabs</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-white/60 mb-1">Base Rate (%)</label>
                  <input
                    type="number"
                    value={onbCommissionPct}
                    onChange={(e) => setOnbCommissionPct(Number(e.target.value))}
                    className="w-full bg-[#08080A] border border-white/15 rounded-lg px-2.5 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-white/60 mb-1">Window (Days)</label>
                  <input
                    type="number"
                    value={onbAttrWindow}
                    onChange={(e) => setOnbAttrWindow(Number(e.target.value))}
                    className="w-full bg-[#08080A] border border-white/15 rounded-lg px-2.5 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-white/60 mb-1">Max Orders/Cust</label>
                  <input
                    type="number"
                    value={onbMaxOrdersPerCust}
                    onChange={(e) => setOnbMaxOrdersPerCust(Number(e.target.value))}
                    className="w-full bg-[#08080A] border border-white/15 rounded-lg px-2.5 py-2 text-white"
                  />
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-white/5 border border-white/10 text-[10px] text-white/60 flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                <span>
                  Security Policy: Bank / NEFT / GSTIN payout credentials are not collected during unverified public application; they are vaulted upon Admin Approval.
                </span>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] font-bold uppercase tracking-wider rounded-lg cursor-pointer"
              >
                Submit Influencer Application for Review
              </button>
            </form>
          </div>

          {/* Onboarding Review & Approval Queue */}
          <div className="lg:col-span-6 bg-[#121218] border border-white/10 rounded-xl p-5 space-y-4">
            <div className="border-b border-white/10 pb-3">
              <span className="text-[10px] uppercase text-[#D4AF37] font-bold">
                GOVERNANCE &amp; CONTRACT VERIFICATION
              </span>
              <h3 className="font-serif text-lg uppercase tracking-wider text-white mt-0.5">
                Partner Onboarding &amp; Approval Status ({displayInfluencers.length})
              </h3>
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {displayInfluencers.map((inf) => {
                const meta = inf.partnerMetadata || {};
                const demo = meta.audienceDemographics || {};
                const quote = meta.commercialQuotation || {};
                const pay = meta.paymentDetails || {};
                const status = meta.onboardingStatus || 'APPROVED';

                return (
                  <div
                    key={inf.id}
                    className="p-4 rounded-xl bg-[#08080A] border border-white/10 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">{inf.name}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              status === 'APPROVED'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : status === 'PENDING_REVIEW'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {status}
                          </span>
                        </div>
                        <div className="text-[11px] text-white/50 mt-0.5">
                          {inf.instagramHandle} • {meta.contentCategory || 'Luxury Perfumery'} •{' '}
                          {meta.language || 'English'}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-[#D4AF37]/20 text-[#E5C378] font-bold text-[10px]">
                        {meta.affiliateId || `AFF-FRG-${inf.code}`}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-[10px] bg-white/[0.03] p-2.5 rounded-lg">
                      <div>
                        <span className="text-white/40 block">Audience</span>
                        <span className="text-white font-semibold">
                          {Number(demo.followersCount || 85000).toLocaleString('en-IN')} ({demo.engagementRatePercent || 4.2}% ER)
                        </span>
                      </div>
                      <div>
                        <span className="text-white/40 block">Commercial Quote</span>
                        <span className="text-[#D4AF37] font-semibold">
                          ₹{Number(quote.quotedFeeInr || 0).toLocaleString('en-IN')} + {inf.commissionPercentage}% Comm.
                        </span>
                      </div>
                      <div>
                        <span className="text-white/40 block">Payout Vault</span>
                        <span className="text-emerald-400 font-semibold">
                          {pay.collectedSecurely ? `${pay.payoutMethod} (${pay.maskedAccountOrUpi})` : 'Collected on Approval'}
                        </span>
                      </div>
                    </div>

                    <div className="text-[10px] text-white/60">
                      Deliverables: <span className="text-white">{quote.deliverablesSummary || '1 Instagram Reel + Story Link'}</span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/10">
                      <span className="text-[10px] text-white/40">
                        Target Geo: {(meta.targetGeography || ['Mumbai', 'Delhi NCR']).join(', ')}
                      </span>
                      <div className="flex items-center gap-2">
                        {status !== 'APPROVED' && (
                          <button
                            onClick={() => handleReviewInfluencer(inf.id, 'APPROVED')}
                            className="px-3 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold text-[10px] cursor-pointer"
                          >
                            Approve &amp; Activate Link
                          </button>
                        )}
                        {status === 'APPROVED' && (
                          <button
                            onClick={() => handleReviewInfluencer(inf.id, 'SUSPENDED')}
                            className="px-3 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-[10px] cursor-pointer"
                          >
                            Suspend
                          </button>
                        )}
                        {status !== 'REJECTED' && (
                          <button
                            onClick={() => handleReviewInfluencer(inf.id, 'REJECTED')}
                            className="px-3 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-[10px] cursor-pointer"
                          >
                            Reject
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: COMMISSION AUTOMATION, SETTLEMENT HOLD & PAYOUT APPROVAL QUEUE */}
      {/* ===================================================================== */}
      {activeTab === 'commission_engine' && (
        <div className="space-y-6">
          {/* Global Commission & Attribution Configuration */}
          <div className="bg-[#121218] border border-white/10 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
              <div>
                <span className="text-[10px] uppercase text-[#D4AF37] font-bold">
                  DOCUMENTED ATTRIBUTION &amp; SETTLEMENT GOVERNANCE
                </span>
                <h3 className="font-serif text-lg uppercase tracking-wider text-white">
                  Commission Rules, Holding Period &amp; Anti-Indefinite Attribution Settings
                </h3>
              </div>
              <button
                onClick={handleSaveGlobalConfig}
                className="px-4 py-2 bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] font-bold rounded-lg uppercase tracking-wider cursor-pointer"
              >
                Save Commission Rules
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-[10px] uppercase text-white/60 mb-1">
                  Attribution Window (Days)
                </label>
                <input
                  type="number"
                  value={cfgAttrWindowDays}
                  onChange={(e) => setCfgAttrWindowDays(Number(e.target.value))}
                  className="w-full bg-[#08080A] border border-white/15 rounded-lg px-3 py-2 text-white"
                />
                <span className="text-[10px] text-white/40">Orders after window are not attributed</span>
              </div>

              <div>
                <label className="block text-[10px] uppercase text-white/60 mb-1">
                  Max Attributed Orders / Customer
                </label>
                <input
                  type="number"
                  value={cfgMaxOrdersPerCust}
                  onChange={(e) => setCfgMaxOrdersPerCust(Number(e.target.value))}
                  className="w-full bg-[#08080A] border border-white/15 rounded-lg px-3 py-2 text-white"
                />
                <span className="text-[10px] text-emerald-400">
                  Prevents indefinite coupon attribution
                </span>
              </div>

              <div>
                <label className="block text-[10px] uppercase text-white/60 mb-1">
                  Settlement Holding Period (Days)
                </label>
                <input
                  type="number"
                  value={cfgHoldingDays}
                  onChange={(e) => setCfgHoldingDays(Number(e.target.value))}
                  className="w-full bg-[#08080A] border border-white/15 rounded-lg px-3 py-2 text-white"
                />
                <span className="text-[10px] text-white/40">
                  Held until PAID + DELIVERED + return window clears
                </span>
              </div>

              <div>
                <label className="block text-[10px] uppercase text-white/60 mb-1">
                  Minimum Payout Threshold (₹)
                </label>
                <input
                  type="number"
                  value={cfgPayoutMinInr}
                  onChange={(e) => setCfgPayoutMinInr(Number(e.target.value))}
                  className="w-full bg-[#08080A] border border-white/15 rounded-lg px-3 py-2 text-white"
                />
                <span className="text-[10px] text-white/40">Required before queuing payout</span>
              </div>
            </div>
          </div>

          {/* Payout Approval Queue (No Automatic Unrestricted Transfers) */}
          <div className="bg-[#121218] border border-white/10 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <span className="text-[10px] uppercase text-[#D4AF37] font-bold">
                  FINANCE GOVERNANCE QUEUE
                </span>
                <h3 className="font-serif text-lg uppercase tracking-wider text-white">
                  Influencer Payout Approval Queue ({(dashboard?.payoutApprovalQueue || []).length})
                </h3>
                <p className="text-[11px] text-white/50">
                  All commission settlements require explicit Super Admin approval before NEFT/IMPS release — never automatic unrestricted transfers.
                </p>
              </div>
            </div>

            {(dashboard?.payoutApprovalQueue || []).length === 0 ? (
              <div className="p-6 text-center text-white/50 bg-[#08080A] rounded-xl border border-white/5">
                No payout requests queued yet. Click &ldquo;Queue Payout&rdquo; on any influencer with settled payable commission &ge; ₹{cfgPayoutMinInr}.
              </div>
            ) : (
              <div className="space-y-3">
                {(dashboard?.payoutApprovalQueue || []).map((task: any) => {
                  const p = task.payload || {};
                  return (
                    <div
                      key={task.id}
                      className="p-4 rounded-xl bg-[#08080A] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              task.status === 'PENDING_APPROVAL'
                                ? 'bg-amber-500/20 text-amber-300'
                                : task.status === 'APPROVED_SETTLED'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-rose-500/20 text-rose-400'
                            }`}
                          >
                            {task.status}
                          </span>
                          <span className="font-bold text-white">{task.title}</span>
                        </div>
                        <p className="text-[11px] text-white/60">{task.description}</p>
                        <div className="text-[10px] text-[#D4AF37]">
                          Affiliate ID: {p.affiliateId} • Payable Amount: ₹{Number(p.payableAmountInr || 0).toLocaleString('en-IN')}
                          {p.settlementReference ? ` • UTR: ${p.settlementReference}` : ''}
                        </div>
                      </div>

                      {task.status === 'PENDING_APPROVAL' && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleDecisionPayoutTask(task.id, 'APPROVED')}
                            className="px-3.5 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-[#08080A] font-bold text-xs cursor-pointer"
                          >
                            Approve &amp; Release Payout
                          </button>
                          <button
                            onClick={() => handleDecisionPayoutTask(task.id, 'REJECTED')}
                            className="px-3 py-1.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-xs cursor-pointer"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Attributed Orders & Settlement / Clawback Ledger */}
          <div className="bg-[#121218] border border-white/10 rounded-xl p-5 space-y-4">
            <h3 className="font-serif text-base uppercase tracking-wider text-white">
              Attributed Orders, Holding Period Settlement &amp; Refund Clawback Ledger
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/10 text-white/40 uppercase text-[10px]">
                    <th className="p-3">Influencer</th>
                    <th className="p-3">Order #</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Net Order Value</th>
                    <th className="p-3">Commission</th>
                    <th className="p-3">Settlement State</th>
                    <th className="p-3 text-right">Settlement / Clawback Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {displayInfluencers.flatMap((inf) => {
                    const orders = inf.partnerMetadata?.funnelMetrics?.attributedOrders || [];
                    return orders.map((ord: any) => (
                      <tr key={`${inf.id}-${ord.orderId}`} className="hover:bg-white/[0.02]">
                        <td className="p-3 font-bold text-white">
                          {inf.name} ({inf.code})
                        </td>
                        <td className="p-3 text-[#D4AF37] font-bold">{ord.orderNumber || ord.orderId}</td>
                        <td className="p-3 text-white/70">{ord.customerEmail}</td>
                        <td className="p-3 text-white font-semibold">
                          ₹{Number(ord.netRevenueInr || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="p-3 text-emerald-400 font-bold">
                          ₹{Number(ord.commissionInr || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              ord.settlementState === 'PAYABLE_SETTLED'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : ord.settlementState === 'EARNED_ON_HOLD'
                                ? 'bg-amber-500/20 text-amber-300'
                                : ord.settlementState === 'PAID_OUT'
                                ? 'bg-sky-500/20 text-sky-300'
                                : 'bg-rose-500/20 text-rose-400'
                            }`}
                          >
                            {ord.settlementState}
                          </span>
                        </td>
                        <td className="p-3 text-right space-x-2">
                          {ord.settlementState === 'EARNED_ON_HOLD' && (
                            <button
                              onClick={() => handleSettleOrderCommission(inf.id, ord.orderId)}
                              className="px-2.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-bold cursor-pointer"
                            >
                              Verify Delivery &amp; Settle Hold
                            </button>
                          )}
                          {ord.settlementState !== 'REFUNDED_CLAWED_BACK' && (
                            <button
                              onClick={() => handleClawbackOrderCommission(inf.id, ord.orderId)}
                              className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[10px] font-bold cursor-pointer"
                            >
                              Refund Clawback
                            </button>
                          )}
                        </td>
                      </tr>
                    ));
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: CONTENT MANAGEMENT & ADVERTISING DISCLOSURE (#AD) COMPLIANCE   */}
      {/* ===================================================================== */}
      {activeTab === 'content_management' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Create Brief Form */}
          <div className="lg:col-span-5 bg-[#121218] border border-white/10 rounded-xl p-5 space-y-4">
            <div className="border-b border-white/10 pb-3">
              <span className="text-[10px] uppercase text-[#D4AF37] font-bold">
                CREATOR BRIEF &amp; ASCI DISCLOSURE GATE
              </span>
              <h3 className="font-serif text-lg uppercase tracking-wider text-white mt-0.5">
                Issue Content Brief &amp; Sample Dispatch
              </h3>
            </div>

            <form onSubmit={handleCreateContentBrief} className="space-y-3">
              <div>
                <label className="block text-[10px] uppercase text-white/60 mb-1">Influencer Partner</label>
                <select
                  value={cntInfluencerId}
                  onChange={(e) => setCntInfluencerId(e.target.value)}
                  className="w-full bg-[#08080A] border border-white/15 rounded-lg px-3 py-2 text-white"
                >
                  {displayInfluencers.map((inf) => (
                    <option key={inf.id} value={inf.id}>
                      {inf.name} ({inf.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase text-white/60 mb-1">Platform Format</label>
                  <select
                    value={cntPlatform}
                    onChange={(e) => setCntPlatform(e.target.value)}
                    className="w-full bg-[#08080A] border border-white/15 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="INSTAGRAM_REEL">Instagram Reel</option>
                    <option value="YOUTUBE_INTEGRATION">YouTube Integration</option>
                    <option value="INSTAGRAM_STORY_SET">Instagram Story Set</option>
                    <option value="EDITORIAL_SHORT">Editorial Short</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-white/60 mb-1">Campaign ID</label>
                  <input
                    type="text"
                    value={cntCampaign}
                    onChange={(e) => setCntCampaign(e.target.value)}
                    className="w-full bg-[#08080A] border border-white/15 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase text-white/60 mb-1">Deliverable Title</label>
                <input
                  type="text"
                  value={cntTitle}
                  onChange={(e) => setCntTitle(e.target.value)}
                  className="w-full bg-[#08080A] border border-white/15 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase text-white/60 mb-1">Sample SKU</label>
                  <input
                    type="text"
                    value={cntSampleSku}
                    onChange={(e) => setCntSampleSku(e.target.value)}
                    className="w-full bg-[#08080A] border border-white/15 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-white/60 mb-1">Creator Fee (₹)</label>
                  <input
                    type="number"
                    value={cntFeeInr}
                    onChange={(e) => setCntFeeInr(Number(e.target.value))}
                    className="w-full bg-[#08080A] border border-white/15 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase text-white/60 mb-1">
                  Mandatory Advertising Disclosure Copy (#Ad / #PaidPartnership)
                </label>
                <input
                  type="text"
                  value={cntDisclosureText}
                  onChange={(e) => setCntDisclosureText(e.target.value)}
                  className="w-full bg-[#08080A] border border-white/15 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-white/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cntDisclosureVerified}
                  onChange={(e) => setCntDisclosureVerified(e.target.checked)}
                />
                <span>Verify #Ad / Paid Partnership Disclosure Included</span>
              </label>

              <button
                type="submit"
                className="w-full py-2.5 bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] font-bold uppercase tracking-wider rounded-lg cursor-pointer"
              >
                Issue Content Deliverable Brief
              </button>
            </form>
          </div>

          {/* Content Deliverables Lifecycle Tracker */}
          <div className="lg:col-span-7 bg-[#121218] border border-white/10 rounded-xl p-5 space-y-4">
            <div className="border-b border-white/10 pb-3">
              <span className="text-[10px] uppercase text-[#D4AF37] font-bold">
                5-STAGE CONTENT PIPELINE &amp; USAGE RIGHTS
              </span>
              <h3 className="font-serif text-lg uppercase tracking-wider text-white mt-0.5">
                Content Deliverables ({(dashboard?.contentDeliverables || []).length})
              </h3>
              <p className="text-[11px] text-white/50">
                Tracks Brief Issued → Sample Shipped → Draft Received → Content Approved → Published. Blocks approval if #Ad disclosure is missing.
              </p>
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {(dashboard?.contentDeliverables || []).map((cnt: any) => {
                const perf = cnt.performanceReport || {};
                const rights = cnt.usageRights || {};
                return (
                  <div
                    key={cnt.id}
                    className="p-4 rounded-xl bg-[#08080A] border border-white/10 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] text-[#D4AF37] font-bold uppercase">
                          {cnt.platform} • {cnt.campaignId}
                        </span>
                        <h4 className="text-white font-bold text-sm">{cnt.deliverableTitle}</h4>
                        <div className="text-[11px] text-white/50">
                          Creator: {cnt.influencerName} • Sample: {cnt.sampleSku || 'N/A'}{' '}
                          {cnt.sampleTrackingAwb ? `(${cnt.sampleTrackingAwb})` : ''}
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded bg-[#D4AF37]/20 text-[#E5C378] font-bold text-[10px]">
                        {cnt.workflowStage}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-white/[0.03] text-[10px]">
                      <div>
                        <span className="text-white/40">Disclosure: </span>
                        <span
                          className={
                            cnt.advertisingDisclosureVerified
                              ? 'text-emerald-400 font-bold'
                              : 'text-rose-400 font-bold'
                          }
                        >
                          {cnt.advertisingDisclosureVerified
                            ? `Verified (${cnt.disclosureText || '#Ad'})`
                            : 'MISSING #AD DISCLOSURE'}
                        </span>
                      </div>
                      <div>
                        <span className="text-white/40">Usage Rights: </span>
                        <span className="text-white">
                          {rights.whitelistingAllowed ? 'Organic + Paid Ads Whitelisting' : 'Organic'} (Until{' '}
                          {rights.exclusivityUntil || '2026-09-30'})
                        </span>
                      </div>
                      <div>
                        <span className="text-white/40">Fee: </span>
                        <span className="text-[#D4AF37] font-bold">
                          ₹{Number(cnt.agreedFeeInr || 0).toLocaleString('en-IN')} ({cnt.paymentStatus})
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-5 gap-2 text-center text-[10px] bg-white/[0.02] p-2 rounded-lg">
                      <div>
                        <span className="text-white/40 block">Views</span>
                        <span className="text-white font-bold">
                          {Number(perf.views || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div>
                        <span className="text-white/40 block">Likes</span>
                        <span className="text-white font-bold">
                          {Number(perf.likes || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div>
                        <span className="text-white/40 block">Saves</span>
                        <span className="text-white font-bold">
                          {Number(perf.saves || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div>
                        <span className="text-white/40 block">Link Clicks</span>
                        <span className="text-[#D4AF37] font-bold">
                          {Number(perf.linkClicks || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div>
                        <span className="text-white/40 block">Revenue</span>
                        <span className="text-emerald-400 font-bold">
                          ₹{Number(perf.attributedRevenueInr || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-white/10">
                      <button
                        onClick={() => handleAdvanceContentStage(cnt, 'SAMPLE_SHIPPED')}
                        className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-white text-[10px] cursor-pointer"
                      >
                        1. Ship Sample
                      </button>
                      <button
                        onClick={() => handleAdvanceContentStage(cnt, 'DRAFT_RECEIVED')}
                        className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-white text-[10px] cursor-pointer"
                      >
                        2. Mark Draft Received
                      </button>
                      <button
                        onClick={() => handleAdvanceContentStage(cnt, 'CONTENT_APPROVED', true)}
                        className="px-2.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold text-[10px] cursor-pointer"
                      >
                        3. Verify #Ad &amp; Approve
                      </button>
                      <button
                        onClick={() => handleAdvanceContentStage(cnt, 'CONTENT_PUBLISHED', true)}
                        className="px-2.5 py-1 rounded bg-[#D4AF37]/20 hover:bg-[#D4AF37]/30 text-[#E5C378] font-bold text-[10px] cursor-pointer"
                      >
                        4. Mark Published
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 5: RESELLER (B2B WHOLESALE) AUTOMATION & MOQ SLABS                */}
      {/* ===================================================================== */}
      {activeTab === 'reseller_b2b' && (
        <div className="space-y-6">
          {/* Approved Reseller Catalogue & Separate Wholesale Price List */}
          <div className="bg-[#121218] border border-white/10 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
              <div>
                <span className="text-[10px] uppercase text-[#D4AF37] font-bold">
                  STRICTLY SEPARATED B2B WHOLESALE PRICING &amp; LIVE INVENTORY
                </span>
                <h3 className="font-serif text-lg uppercase tracking-wider text-white">
                  Approved Reseller Catalogue &amp; Configurable MOQ Slabs (₹8,999 &amp; ₹14,999)
                </h3>
                <p className="text-[11px] text-white/50">
                  Reseller wholesale pricing and margins are isolated from public D2C pricing and influencer commissions.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/10 text-white/40 uppercase text-[10px]">
                    <th className="p-3">SKU</th>
                    <th className="p-3">Fragrance Variant</th>
                    <th className="p-3">Public D2C MRP (Reference)</th>
                    <th className="p-3">MOQ Slab ₹8,999 Price (22% Margin)</th>
                    <th className="p-3">MOQ Slab ₹14,999 Price (28% Margin)</th>
                    <th className="p-3">MOQ Slab ₹29,999 Price (34% Margin)</th>
                    <th className="p-3">Available Warehouse Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(dashboard?.approvedResellerCatalogue || []).map((item: any) => (
                    <tr key={item.sku} className="hover:bg-white/[0.02]">
                      <td className="p-3 font-bold text-[#D4AF37]">{item.sku}</td>
                      <td className="p-3 text-white font-semibold">
                        {item.productName} ({item.size})
                      </td>
                      <td className="p-3 text-white/50 line-through">
                        ₹{Number(item.d2cRetailMrpInr).toLocaleString('en-IN')}
                      </td>
                      <td className="p-3 text-white font-bold">
                        ₹{Number(item.slab8999WholesalePriceInr).toLocaleString('en-IN')}
                      </td>
                      <td className="p-3 text-emerald-400 font-bold">
                        ₹{Number(item.slab14999WholesalePriceInr).toLocaleString('en-IN')}
                      </td>
                      <td className="p-3 text-[#E5C378] font-bold">
                        ₹{Number(item.slab29999WholesalePriceInr).toLocaleString('en-IN')}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.inStockForWholesale
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-rose-500/20 text-rose-400'
                          }`}
                        >
                          {item.availableStock} units
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* B2B Wholesale Order & MOQ Verification Desk */}
            <div className="lg:col-span-6 bg-[#121218] border border-white/10 rounded-xl p-5 space-y-4">
              <div className="border-b border-white/10 pb-3">
                <span className="text-[10px] uppercase text-[#D4AF37] font-bold">
                  MOQ SLAB VERIFICATION &amp; ATOMIC STOCK CHECK
                </span>
                <h3 className="font-serif text-lg uppercase tracking-wider text-white mt-0.5">
                  Create Reseller B2B Purchase Order
                </h3>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] uppercase text-white/60 mb-1">
                    Select Approved Reseller Partner
                  </label>
                  <select
                    value={selectedResellerForOrder}
                    onChange={(e) => setSelectedResellerForOrder(e.target.value)}
                    className="w-full bg-[#08080A] border border-white/15 rounded-lg px-3 py-2 text-white"
                  >
                    {(dashboard?.resellers || []).map((r: any) => (
                      <option key={r.id} value={r.id}>
                        {r.businessName} ({r.moqSlabCode} — Min ₹{Number(r.minimumOrderValueInr).toLocaleString('en-IN')})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase text-white/60 mb-1">
                      FRAG-AZR-100ML Qty (AZURE 100ml)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={b2bSku1Qty}
                      onChange={(e) => setB2bSku1Qty(Number(e.target.value))}
                      className="w-full bg-[#08080A] border border-white/15 rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase text-white/60 mb-1">
                      FRAG-slk-100ML Qty (SILK 100ml)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={b2bSku2Qty}
                      onChange={(e) => setB2bSku2Qty(Number(e.target.value))}
                      className="w-full bg-[#08080A] border border-white/15 rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-white/80 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={b2bPaymentVerified}
                    onChange={(e) => setB2bPaymentVerified(e.target.checked)}
                  />
                  <span>Verify B2B NEFT/RTGS Settlement Upon Booking</span>
                </label>

                <button
                  onClick={handleCreateB2bOrder}
                  className="w-full py-2.5 bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] font-bold uppercase tracking-wider rounded-lg cursor-pointer"
                >
                  Verify MOQ Slab &amp; Place Wholesale Order
                </button>
              </div>

              {/* Reseller Onboarding Form */}
              <form onSubmit={handleOnboardReseller} className="pt-4 border-t border-white/10 space-y-3">
                <h4 className="font-serif text-sm uppercase tracking-wider text-white">
                  Onboard New Reseller Partner
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Boutique / Business Name *"
                    value={resBizName}
                    onChange={(e) => setResBizName(e.target.value)}
                    className="bg-[#08080A] border border-white/15 rounded-lg px-3 py-2 text-white"
                  />
                  <input
                    type="text"
                    placeholder="Contact Person *"
                    value={resContactName}
                    onChange={(e) => setResContactName(e.target.value)}
                    className="bg-[#08080A] border border-white/15 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <input
                    type="email"
                    placeholder="Email"
                    value={resEmail}
                    onChange={(e) => setResEmail(e.target.value)}
                    className="bg-[#08080A] border border-white/15 rounded-lg px-3 py-2 text-white"
                  />
                  <input
                    type="text"
                    placeholder="GSTIN"
                    value={resGstin}
                    onChange={(e) => setResGstin(e.target.value)}
                    className="bg-[#08080A] border border-white/15 rounded-lg px-3 py-2 text-white"
                  />
                  <select
                    value={resMoqSlab}
                    onChange={(e) => setResMoqSlab(e.target.value as any)}
                    className="bg-[#08080A] border border-white/15 rounded-lg px-2 py-2 text-white"
                  >
                    <option value="SLAB_8999">MOQ ₹8,999 (22%)</option>
                    <option value="SLAB_14999">MOQ ₹14,999 (28%)</option>
                    <option value="SLAB_29999">MOQ ₹29,999 (34%)</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-white/10 hover:bg-white/15 text-white font-bold uppercase rounded-lg cursor-pointer"
                >
                  Onboard B2B Reseller Partner
                </button>
              </form>
            </div>

            {/* Active Resellers, Payment Reconciliation & Repeat Order Reminders */}
            <div className="lg:col-span-6 bg-[#121218] border border-white/10 rounded-xl p-5 space-y-4">
              <div className="border-b border-white/10 pb-3">
                <span className="text-[10px] uppercase text-[#D4AF37] font-bold">
                  B2B ACCOUNTS, RECONCILIATION &amp; REPLENISHMENT
                </span>
                <h3 className="font-serif text-lg uppercase tracking-wider text-white mt-0.5">
                  Approved Resellers ({(dashboard?.resellers || []).length})
                </h3>
              </div>

              <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
                {(dashboard?.resellers || []).map((res: any) => (
                  <div
                    key={res.id}
                    className="p-4 rounded-xl bg-[#08080A] border border-white/10 space-y-2.5"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-bold text-white text-sm">{res.businessName}</span>
                        <div className="text-[11px] text-white/50">
                          {res.contactName} • {res.city}, {res.state} • GSTIN: {res.gstin}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-[#D4AF37]/20 text-[#E5C378] font-bold text-[10px]">
                        {res.moqSlabCode} (Min ₹{Number(res.minimumOrderValueInr).toLocaleString('en-IN')})
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-[10px] bg-white/[0.03] p-2.5 rounded-lg">
                      <div>
                        <span className="text-white/40 block">Wholesale Revenue</span>
                        <span className="text-emerald-400 font-bold">
                          ₹{Number(res.totalWholesaleRevenueInr || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div>
                        <span className="text-white/40 block">B2B Orders</span>
                        <span className="text-white font-bold">{res.totalWholesaleOrders || 0} POs</span>
                      </div>
                      <div>
                        <span className="text-white/40 block">Wholesale Margin</span>
                        <span className="text-[#D4AF37] font-bold">{res.wholesaleDiscountPercent}% Off MRP</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/10">
                      <span className="text-[10px] text-white/40">
                        Next Repeat Reminder:{' '}
                        {res.nextRepeatReminderAt
                          ? new Date(res.nextRepeatReminderAt).toLocaleDateString()
                          : 'Scheduled'}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleReconcileReseller(res.id, false)}
                          className="px-2.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-bold cursor-pointer"
                        >
                          Reconcile Payment
                        </button>
                        <button
                          onClick={() => handleReconcileReseller(res.id, true)}
                          className="px-2.5 py-1 rounded bg-[#D4AF37]/20 hover:bg-[#D4AF37]/30 text-[#E5C378] text-[10px] font-bold cursor-pointer"
                        >
                          Send Repeat PO Reminder
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 6: UNIFIED PROFITABILITY REPORT & 6-SCENARIO VERIFICATION SUITE   */}
      {/* ===================================================================== */}
      {activeTab === 'profitability_and_tests' && (
        <div className="space-y-6">
          {/* Unified Profitability Report */}
          <div className="bg-[#121218] border border-white/10 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
              <div>
                <span className="text-[10px] uppercase text-[#D4AF37] font-bold">
                  CROSS-CHANNEL PARTNER ECONOMICS
                </span>
                <h3 className="font-serif text-lg uppercase tracking-wider text-white">
                  Unified Profitability Report (Influencers &amp; B2B Resellers)
                </h3>
                <p className="text-[11px] text-white/50">
                  Compares verified net revenue, COGS, commissions/fixed fees/samples vs wholesale trade margins, and net contribution margin per partner.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/10 text-white/40 uppercase text-[10px]">
                    <th className="p-3">Partner Name</th>
                    <th className="p-3">Channel Type</th>
                    <th className="p-3">Pricing Isolation</th>
                    <th className="p-3">Orders</th>
                    <th className="p-3">Verified Net Revenue</th>
                    <th className="p-3">COGS</th>
                    <th className="p-3">Partner Cost (Comm+Fee+Samples)</th>
                    <th className="p-3">Net Contribution Margin</th>
                    <th className="p-3">ROI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(dashboard?.unifiedProfitabilityReport || []).map((row: any) => (
                    <tr key={row.partnerId} className="hover:bg-white/[0.02]">
                      <td className="p-3 font-bold text-white">
                        {row.partnerName}
                        <span className="block text-[10px] text-white/40 font-normal">
                          {row.codeOrSlab}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            row.partnerType === 'INFLUENCER_AFFILIATE'
                              ? 'bg-pink-500/20 text-pink-300'
                              : 'bg-sky-500/20 text-sky-300'
                          }`}
                        >
                          {row.partnerType}
                        </span>
                      </td>
                      <td className="p-3 text-[10px] text-[#E5C378] font-bold">
                        {row.pricingSeparation}
                      </td>
                      <td className="p-3 text-white font-semibold">{row.ordersCount}</td>
                      <td className="p-3 text-white font-bold">
                        ₹{Number(row.verifiedNetRevenueInr || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="p-3 text-white/60">
                        ₹{Number(row.estimatedCogsInr || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="p-3 text-amber-300">
                        ₹
                        {Number(
                          (row.commissionCostInr || 0) +
                            (row.fixedCreatorFeeInr || 0) +
                            (row.sampleCostInr || 0)
                        ).toLocaleString('en-IN')}
                      </td>
                      <td className="p-3">
                        <span className="text-emerald-400 font-bold">
                          ₹{Number(row.netContributionMarginInr || 0).toLocaleString('en-IN')}
                        </span>
                        <span className="block text-[10px] text-white/40">
                          ({row.contributionMarginPercent}% Margin)
                        </span>
                      </td>
                      <td className="p-3 font-bold text-[#D4AF37]">{row.roiMultiple}x</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 6-Scenario E2E Verification Suite Runner */}
          <div className="bg-[#121218] border border-white/10 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <span className="text-[10px] uppercase text-[#D4AF37] font-bold">
                  AUTOMATED COMPLIANCE &amp; ATTRIBUTION VERIFICATION
                </span>
                <h3 className="font-serif text-lg uppercase tracking-wider text-white mt-0.5">
                  Influencer, Affiliate, Content &amp; Reseller E2E Verification Suite
                </h3>
                <p className="text-xs text-white/50">
                  Executes 6 live PostgreSQL verification tests covering bounded attribution, commission hold/clawback, payout approval queues, #Ad disclosure enforcement, and ₹8,999 / ₹14,999 MOQ slabs.
                </p>
              </div>
              <button
                onClick={handleRunVerificationSuite}
                disabled={runningTests}
                className="px-4 py-2.5 bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] font-bold uppercase tracking-wider rounded-lg flex items-center gap-2 shrink-0 cursor-pointer"
              >
                <Play className="w-4 h-4" />
                <span>{runningTests ? 'Running 6 Scenarios...' : 'Run 6-Scenario Verification Suite'}</span>
              </button>
            </div>

            {testSuiteResult && (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                  <span className="text-emerald-400 font-bold">
                    Suite Status: {testSuiteResult.passedCount} / {testSuiteResult.totalTests} Scenarios Passed
                  </span>
                  <span className="text-[10px] text-white/50">
                    Executed at {new Date(testSuiteResult.executedAt).toLocaleTimeString()}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(testSuiteResult.results || []).map((r: any) => (
                    <div
                      key={r.id}
                      className="p-3.5 rounded-xl bg-[#08080A] border border-white/10 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">{r.scenario}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            r.passed
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-rose-500/20 text-rose-400'
                          }`}
                        >
                          {r.passed ? 'PASSED' : 'FAILED'}
                        </span>
                      </div>
                      <p className="text-[11px] text-white/60">{r.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* QUICK ADD INFLUENCER MODAL (Preserved) */}
      {isModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-[#0E0E14] border border-white/20 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-serif text-lg uppercase tracking-wider text-white">
                Add Influencer &amp; Affiliate Partner
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-white/40 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-white/60 mb-1">Partner Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Natasha Poonawalla"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-[#121218] border border-white/20 text-white rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-white/60 mb-1">Instagram Handle</label>
                <input
                  type="text"
                  placeholder="@natashapoonawalla"
                  value={newHandle}
                  onChange={(e) => setNewHandle(e.target.value)}
                  className="w-full bg-[#121218] border border-white/20 text-white rounded-lg px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-white/60 mb-1">Promo Code</label>
                  <input
                    type="text"
                    required
                    placeholder="NATASHA15"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    className="w-full bg-[#121218] border border-white/20 text-white rounded-lg px-3 py-2 uppercase"
                  />
                </div>

                <div>
                  <label className="block text-white/60 mb-1">Customer Discount (%)</label>
                  <input
                    type="number"
                    value={newDiscount}
                    onChange={(e) => setNewDiscount(Number(e.target.value))}
                    className="w-full bg-[#121218] border border-white/20 text-white rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-white/60 mb-1">Commission Rate (%)</label>
                  <input
                    type="number"
                    value={newCommission}
                    onChange={(e) => setNewCommission(Number(e.target.value))}
                    className="w-full bg-[#121218] border border-white/20 text-white rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-white/60 mb-1">Campaign Tag</label>
                  <input
                    type="text"
                    placeholder="e.g. Autumn_Launch"
                    value={newCampaign}
                    onChange={(e) => setNewCampaign(e.target.value)}
                    className="w-full bg-[#121218] border border-white/20 text-white rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-white/20 text-white rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#D4AF37] text-[#08080A] font-bold rounded-lg"
                >
                  Save Partner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
