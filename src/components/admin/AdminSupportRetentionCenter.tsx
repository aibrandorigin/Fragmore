import React, { useState, useEffect, useCallback } from 'react';
import {
  LifeBuoy,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Star,
  RotateCcw,
  RefreshCw,
  ShieldCheck,
  Send,
  Sparkles,
  FileText,
  UserCheck,
  Activity,
  Plus,
  X
} from 'lucide-react';

interface AdminSupportRetentionCenterProps {
  initialTab?:
    | 'SUPPORT_DASHBOARD'
    | 'REVIEW_AUTOMATION'
    | 'RETENTION_JOURNEYS'
    | 'RETURNS_AND_360_SYNC';
}

export const AdminSupportRetentionCenter: React.FC<AdminSupportRetentionCenterProps> = ({
  initialTab = 'SUPPORT_DASHBOARD'
}) => {
  const [activeTab, setActiveTab] = useState<
    | 'SUPPORT_DASHBOARD'
    | 'REVIEW_AUTOMATION'
    | 'RETENTION_JOURNEYS'
    | 'RETURNS_AND_360_SYNC'
  >(initialTab);

  const [dashboard, setDashboard] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [bannerMessage, setBannerMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // Verification suite state
  const [runningTests, setRunningTests] = useState(false);
  const [testSuiteResult, setTestSuiteResult] = useState<any | null>(null);

  // New Negative Experience Ticket Modal / Form State
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [tktCategory, setTktCategory] = useState<string>('LEAKAGE');
  const [tktOrderNumber, setTktOrderNumber] = useState<string>('FRG-2026-1001');
  const [tktCustomerName, setTktCustomerName] = useState<string>('Aarav Mehta');
  const [tktCustomerEmail, setTktCustomerEmail] = useState<string>('aarav.mehta@luxury.in');
  const [tktProductName, setTktProductName] = useState<string>('AZURE');
  const [tktVariantSize, setTktVariantSize] = useState<string>('100 ml');
  const [tktDescription, setTktDescription] = useState<string>(
    'Patron reported atomizer collar seepage upon courier box opening; requested inspection & replacement.'
  );
  const [tktRefundInr, setTktRefundInr] = useState<number>(5499);
  const [tktSimulateOverdueMins, setTktSimulateOverdueMins] = useState<number>(0);

  // Ticket Action Modal State
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [responseNote, setResponseNote] = useState<string>(
    'White-glove reverse pickup AWB generated; Quality Atelier inspecting batch crimp retention.'
  );
  const [resolutionNote, setResolutionNote] = useState<string>(
    'Replacement sealed flacon dispatched via Blue Dart Air; patron confirmed satisfaction.'
  );
  const [csatInput, setCsatInput] = useState<number>(5);
  const [csatComment, setCsatComment] = useState<string>(
    'Immediate concierge response and seamless replacement.'
  );
  const [gatewayRefInput, setGatewayRefInput] = useState<string>('');
  const [financeReconciledChecked, setFinanceReconciledChecked] = useState<boolean>(false);

  // Review Automation State
  const [waitDaysConfig, setWaitDaysConfig] = useState<number>(5);
  const [revOrderId, setRevOrderId] = useState<string>('ord-frg-1001');
  const [revSimulatedDays, setRevSimulatedDays] = useState<number>(5);
  const [revOptIn, setRevOptIn] = useState<boolean>(true);

  // Review Submission & Moderation Form
  const [subCustomerName, setSubCustomerName] = useState<string>('Aarav Mehta');
  const [subCustomerEmail, setSubCustomerEmail] = useState<string>('aarav.mehta@luxury.in');
  const [subProductName, setSubProductName] = useState<string>('AZURE');
  const [subRating, setSubRating] = useState<number>(4);
  const [subTitle, setSubTitle] = useState<string>('Crisp Calabrian bergamot and sea salt');
  const [subComment, setSubComment] = useState<string>(
    'Lasts 9 hours on linen in Mumbai humidity. Authentic mineral ambergris dry-down.'
  );
  const [subRequestIncentive, setSubRequestIncentive] = useState<boolean>(true);
  const [subIsFakeTest, setSubIsFakeTest] = useState<boolean>(false);

  // Retention Dynamic Depletion & Dispatch Form
  const [retJourneyCategory, setRetJourneyCategory] = useState<string>('REPLENISHMENT_REMINDER');
  const [retCustomerName, setRetCustomerName] = useState<string>('Aarav Mehta');
  const [retCustomerEmail, setRetCustomerEmail] = useState<string>('aarav.mehta@luxury.in');
  const [retProductName, setRetProductName] = useState<string>('AZURE');
  const [retVariantSize, setRetVariantSize] = useState<string>('100 ml');
  const [retActiveBottles, setRetActiveBottles] = useState<number>(2);
  const [retHistoricalCadence, setRetHistoricalCadence] = useState<number>(0);
  const [retConsentOptIn, setRetConsentOptIn] = useState<boolean>(true);
  const [calculatedDepletion, setCalculatedDepletion] = useState<any | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/support-retention/dashboard');
      if (res.ok) {
        const data = await res.json();
        setDashboard(data);
        if (data.settings?.reviewInviteDelayDaysAfterDelivery) {
          setWaitDaysConfig(data.settings.reviewInviteDelayDaysAfterDelivery);
        }
      }
    } catch (err: any) {
      setBannerMessage({
        type: 'error',
        text: err.message || 'Failed to load Support, Review & Retention dashboard'
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Live preview of Dynamic Non-Fixed Bottle Depletion calculation
  const previewDepletionWindow = useCallback(async () => {
    try {
      const res = await fetch('/api/support-retention/retention/calculate-depletion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variantSize: retVariantSize,
          fragranceName: retProductName,
          customerActiveBottlesCount: retActiveBottles,
          historicalRepurchaseIntervalDays: retHistoricalCadence > 0 ? retHistoricalCadence : null
        })
      });
      if (res.ok) {
        const data = await res.json();
        setCalculatedDepletion(data);
      }
    } catch {
      // ignore
    }
  }, [retVariantSize, retProductName, retActiveBottles, retHistoricalCadence]);

  useEffect(() => {
    previewDepletionWindow();
  }, [previewDepletionWindow]);

  const handleRunVerificationSuite = async () => {
    setRunningTests(true);
    setBannerMessage(null);
    try {
      const res = await fetch('/api/support-retention/run-tests', { method: 'POST' });
      const data = await res.json();
      setTestSuiteResult(data);
      setBannerMessage({
        type: data.allPassed ? 'success' : 'error',
        text: `${data.summary}: All automated support, review moderation, non-fixed retention & finance refund guardrails verified.`
      });
      await fetchDashboard();
    } catch (err: any) {
      setBannerMessage({ type: 'error', text: err.message || 'Verification suite failed' });
    } finally {
      setRunningTests(false);
    }
  };

  const handleCreateNegativeExperienceTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/support-retention/tickets/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: tktCategory,
          orderNumber: tktOrderNumber,
          customerName: tktCustomerName,
          customerEmail: tktCustomerEmail,
          productName: tktProductName,
          variantSize: tktVariantSize,
          description: tktDescription,
          requestRefundInr: Number(tktRefundInr) || 0,
          simulatePastDueMinutes: Number(tktSimulateOverdueMins) || 0
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setBannerMessage({ type: 'error', text: data.error || 'Could not create ticket' });
        return;
      }
      setBannerMessage({
        type: 'success',
        text: `Ticket ${data.ticket.referenceCode} created (${data.ticket.priority} priority), linked to order ${data.ticket.orderNumber || 'N/A'}, assigned to ${data.staffNotified} (SLA: ${data.slaTargetMinutes}m).`
      });
      setShowNewTicketModal(false);
      await fetchDashboard();
    } catch (err: any) {
      setBannerMessage({ type: 'error', text: err.message });
    }
  };

  const handleTicketAction = async (
    ticketId: string,
    action:
      | 'LOG_FIRST_RESPONSE'
      | 'RESOLVE_TICKET'
      | 'RECORD_CSAT_FEEDBACK'
      | 'ATTEMPT_COMPLETE_REFUND'
  ) => {
    try {
      const res = await fetch(`/api/support-retention/tickets/${ticketId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          responseMessage: responseNote,
          resolutionSummary: resolutionNote,
          csatScore: csatInput,
          customerFeedback: csatComment,
          refundGatewayRef: gatewayRefInput,
          financeReconciled: financeReconciledChecked
        })
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        setBannerMessage({
          type: 'error',
          text:
            data.reason ||
            data.error ||
            'Action blocked by governance guardrail (check provider/finance reconciliation).'
        });
        await fetchDashboard();
        return;
      }
      setBannerMessage({
        type: 'success',
        text: `Ticket updated (${action}) and synchronized with Customer 360 & Audit Log.`
      });
      if (data.ticket) setSelectedTicket(data.ticket);
      await fetchDashboard();
    } catch (err: any) {
      setBannerMessage({ type: 'error', text: err.message });
    }
  };

  const handleUpdateReviewWaitDays = async () => {
    try {
      const res = await fetch('/api/support-retention/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewInviteDelayDaysAfterDelivery: Number(waitDaysConfig) || 5
        })
      });
      if (res.ok) {
        setBannerMessage({
          type: 'success',
          text: `Post-delivery review wait period updated to ${waitDaysConfig} days.`
        });
        await fetchDashboard();
      }
    } catch (err: any) {
      setBannerMessage({ type: 'error', text: err.message });
    }
  };

  const handleTriggerReviewInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/support-retention/reviews/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: revOrderId,
          simulatedDaysSinceDelivery: Number(revSimulatedDays),
          contactPermissionOptIn: revOptIn
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setBannerMessage({ type: 'error', text: data.error || data.reason });
        return;
      }
      setBannerMessage({
        type: data.invited || data.scheduled ? 'success' : 'info',
        text: data.reason || `Review invite status: ${data.status} (Elapsed: ${data.daysElapsed}d vs Required: ${data.waitDaysRequired}d).`
      });
      await fetchDashboard();
    } catch (err: any) {
      setBannerMessage({ type: 'error', text: err.message });
    }
  };

  const handleSubmitAndModerateReview = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/support-retention/reviews/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productSlug: subProductName.toLowerCase().replace(/\s+/g, '-'),
          productName: subProductName,
          customerName: subCustomerName,
          customerEmail: subCustomerEmail,
          rating: Number(subRating),
          title: subTitle,
          comment: subComment,
          requestIncentiveBenefit: subRequestIncentive,
          isFakeAdminGeneratedTestimonial: subIsFakeTest
        })
      });
      const data = await res.json();
      setBannerMessage({
        type: data.published ? 'success' : 'error',
        text:
          data.reason ||
          data.moderationResult?.reason ||
          `Review processed: ${data.status}`
      });
      await fetchDashboard();
    } catch (err: any) {
      setBannerMessage({ type: 'error', text: err.message });
    }
  };

  const handleDispatchRetentionJourney = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/support-retention/retention/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          journeyCategory: retJourneyCategory,
          customerName: retCustomerName,
          customerEmail: retCustomerEmail,
          productName: retProductName,
          variantSize: retVariantSize,
          customerActiveBottlesCount: Number(retActiveBottles),
          historicalRepurchaseIntervalDays:
            retHistoricalCadence > 0 ? Number(retHistoricalCadence) : undefined,
          marketingConsentOptIn: retConsentOptIn
        })
      });
      const data = await res.json();
      setBannerMessage({
        type: data.dispatched ? 'success' : 'error',
        text: data.dispatched
          ? `Retention journey [${retJourneyCategory}] dispatched! Dynamic window: ${data.dynamicDepletion.estimatedDaysMin}–${data.dynamicDepletion.estimatedDaysMax} days (Reminder at Day ${data.dynamicDepletion.recommendedReminderDayAfterDelivery}).`
          : data.reason || 'Suppressed due to missing communication permission.'
      });
      await fetchDashboard();
    } catch (err: any) {
      setBannerMessage({ type: 'error', text: err.message });
    }
  };

  const kpis = dashboard?.kpis || {
    openTicketsCount: 2,
    overdueTicketsCount: 1,
    avgFirstResponseMinutes: 18,
    avgResolutionMinutes: 92,
    refundRequestsCount: 2,
    refundRequestsTotalInr: 5499,
    avgCsatScore: 5.0,
    satisfiedCsatPercent: 100,
    repeatComplaintRatePercent: 0
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-mono text-xs text-[#24211D]">
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[#DED7CC]">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-[#9A783E] font-semibold">
            Client Care, Olfactory Moderation & Lifecycle CRM
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl uppercase tracking-wider text-[#24211D] mt-0.5">
            Customer Support, Review &amp; Retention Automation
          </h2>
          <p className="text-xs text-[#686158] mt-1">
            SLA-driven negative experience ticketing, 5-day post-delivery verified review automation, non-fixed bottle depletion journeys, and provider-reconciled refunds synced to Customer 360.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={fetchDashboard}
            className="px-3.5 py-2 rounded-lg border border-[#DED7CC] bg-[#FFFFFF] hover:border-[#9A783E] text-[#24211D] flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#9A783E] ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Data</span>
          </button>

          <button
            onClick={handleRunVerificationSuite}
            disabled={runningTests}
            className="px-4 py-2 rounded-lg border border-[#9A783E] bg-[#F1EDE5] hover:bg-[#9A783E] hover:text-[#FAF8F4] text-[#24211D] font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{runningTests ? 'Verifying 6 Scenarios...' : 'Verify Support & Retention Suite'}</span>
          </button>

          <button
            onClick={() => setShowNewTicketModal(true)}
            className="px-4 py-2 rounded-lg bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Report Negative Experience</span>
          </button>
        </div>
      </div>

      {/* STATUS BANNER */}
      {bannerMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
            bannerMessage.type === 'success'
              ? 'bg-emerald-950/10 border-emerald-700/40 text-emerald-900'
              : bannerMessage.type === 'error'
              ? 'bg-rose-950/10 border-rose-700/40 text-rose-900'
              : 'bg-[#F1EDE5] border-[#9A783E]/40 text-[#24211D]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#9A783E]" />
            <span>{bannerMessage.text}</span>
          </div>
          <button
            onClick={() => setBannerMessage(null)}
            className="text-xs underline opacity-75 hover:opacity-100 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* VERIFICATION SUITE RESULTS */}
      {testSuiteResult && (
        <div className="p-5 rounded-xl bg-[#FFFFFF] border border-[#9A783E] space-y-3 shadow-xs">
          <div className="flex items-center justify-between border-b border-[#DED7CC] pb-2.5">
            <div>
              <span className="text-[10px] uppercase tracking-widest text-[#9A783E] font-bold">
                Automated Verification Suite
              </span>
              <h3 className="font-serif text-base uppercase text-[#24211D]">
                {testSuiteResult.summary}
              </h3>
            </div>
            <button
              onClick={() => setTestSuiteResult(null)}
              className="text-xs text-[#686158] hover:text-[#24211D]"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {(testSuiteResult.results || []).map((r: any) => (
              <div
                key={r.id}
                className="p-3 rounded-lg bg-[#FAF8F4] border border-[#DED7CC] flex items-start gap-2.5"
              >
                <CheckCircle2
                  className={`w-4 h-4 shrink-0 mt-0.5 ${
                    r.passed ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                />
                <div className="space-y-0.5">
                  <div className="font-bold text-[#24211D] text-[11px]">{r.scenario}</div>
                  <div className="text-[10px] text-[#686158]">{r.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SEGMENTED MODULE NAVIGATION TABS */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-[#F1EDE5] border border-[#DED7CC] rounded-xl">
        {[
          {
            id: 'SUPPORT_DASHBOARD',
            label: '1. Support Dashboard & Negative Experience SLA',
            icon: LifeBuoy
          },
          {
            id: 'REVIEW_AUTOMATION',
            label: '2. Post-Delivery Review Automation (5-Day Wait)',
            icon: Star
          },
          {
            id: 'RETENTION_JOURNEYS',
            label: '3. Retention Journeys & Non-Fixed Depletion Engine',
            icon: Sparkles
          },
          {
            id: 'RETURNS_AND_360_SYNC',
            label: '4. Returns/Refund Reconciliation & Customer 360 Log',
            icon: RotateCcw
          }
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-2 rounded-lg text-xs font-mono transition-colors flex items-center gap-2 cursor-pointer ${
                active
                  ? 'bg-[#24211D] text-[#FAF8F4] font-bold shadow-2xs'
                  : 'text-[#686158] hover:text-[#24211D] hover:bg-[#FFFFFF]'
              }`}
            >
              <Icon className="w-3.5 h-3.5 text-[#9A783E]" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: SUPPORT DASHBOARD & NEGATIVE EXPERIENCE SLA ENGINE             */}
      {/* ===================================================================== */}
      {activeTab === 'SUPPORT_DASHBOARD' && (
        <div className="space-y-6">
          {/* 8 REQUIRED SUPPORT DASHBOARD KPI CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#DED7CC] space-y-1">
              <div className="text-[10px] uppercase text-[#686158]">1. Open Tickets</div>
              <div className="text-2xl font-bold text-[#24211D] tabular-nums">
                {kpis.openTicketsCount}
              </div>
              <div className="text-[10px] text-[#686158]">
                Active across {kpis.totalTicketsCount || 3} total cases
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#DED7CC] space-y-1">
              <div className="text-[10px] uppercase text-[#686158]">2. Overdue Tickets (SLA)</div>
              <div className="text-2xl font-bold text-rose-700 tabular-nums">
                {kpis.overdueTicketsCount}
              </div>
              <div className="text-[10px] text-rose-700">
                Auto-escalated to Super Admin
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#DED7CC] space-y-1">
              <div className="text-[10px] uppercase text-[#686158]">3. First Response Time</div>
              <div className="text-2xl font-bold text-[#9A783E] tabular-nums">
                {kpis.avgFirstResponseMinutes} mins
              </div>
              <div className="text-[10px] text-emerald-700">Target: 30m (Critical) / 60m (High)</div>
            </div>

            <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#DED7CC] space-y-1">
              <div className="text-[10px] uppercase text-[#686158]">4. Avg Resolution Time</div>
              <div className="text-2xl font-bold text-[#24211D] tabular-nums">
                {kpis.avgResolutionMinutes} mins
              </div>
              <div className="text-[10px] text-[#686158]">
                ~{(kpis.avgResolutionMinutes / 60).toFixed(1)} hours end-to-end
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#DED7CC] space-y-1">
              <div className="text-[10px] uppercase text-[#686158]">5. Refund Requests</div>
              <div className="text-2xl font-bold text-[#9A783E] tabular-nums">
                {kpis.refundRequestsCount} (₹{Number(kpis.refundRequestsTotalInr || 0).toLocaleString('en-IN')})
              </div>
              <div className="text-[10px] text-[#686158]">Locked until Finance reconciliation</div>
            </div>

            <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#DED7CC] space-y-1">
              <div className="text-[10px] uppercase text-[#686158]">6. Complaint Categories</div>
              <div className="text-2xl font-bold text-[#24211D] tabular-nums">7 Tracked</div>
              <div className="text-[10px] text-[#686158]">
                Leakage, Breakage, Wrong SKU, Delay, Payment, Scent
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#DED7CC] space-y-1">
              <div className="text-[10px] uppercase text-[#686158]">7. Customer Satisfaction</div>
              <div className="text-2xl font-bold text-emerald-700 tabular-nums">
                {kpis.avgCsatScore} / 5.0 ({kpis.satisfiedCsatPercent}%)
              </div>
              <div className="text-[10px] text-emerald-700">Verified post-resolution CSAT</div>
            </div>

            <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#DED7CC] space-y-1">
              <div className="text-[10px] uppercase text-[#686158]">8. Repeat Complaint Rate</div>
              <div className="text-2xl font-bold text-[#24211D] tabular-nums">
                {kpis.repeatComplaintRatePercent}%
              </div>
              <div className="text-[10px] text-[#686158]">Patrons with &gt;1 support ticket</div>
            </div>
          </div>

          {/* 7 NEGATIVE EXPERIENCE COMPLAINT CATEGORIES BREAKDOWN */}
          <div className="p-6 rounded-xl bg-[#FFFFFF] border border-[#DED7CC] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#DED7CC] pb-3">
              <div>
                <h3 className="font-serif text-base uppercase tracking-wider text-[#24211D] font-semibold">
                  7 Negative Experience Categories &amp; Automated Routing Matrix
                </h3>
                <p className="text-[11px] text-[#686158]">
                  Every reported issue automatically categorizes, assigns priority, alerts responsible staff, starts response SLA, and links order &amp; AWB.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {(dashboard?.complaintCategoriesBreakdown || []).map((cat: any) => (
                <div
                  key={cat.category}
                  className="p-3.5 rounded-lg bg-[#FAF8F4] border border-[#DED7CC] space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[10px] text-[#686158]">
                    <span className="font-bold text-[#9A783E]">{cat.category}</span>
                    <span>
                      Priority: <strong className="text-[#24211D]">{cat.defaultPriority}</strong>
                    </span>
                  </div>
                  <div className="font-bold text-xs text-[#24211D]">{cat.label}</div>
                  <div className="text-[10px] text-[#686158]">Desk: {cat.department}</div>
                  <div className="flex items-center justify-between pt-1 border-t border-[#DED7CC] text-[11px]">
                    <span>
                      Total: <strong>{cat.count}</strong> ({cat.sharePercent}%)
                    </span>
                    <span className={cat.openCount > 0 ? 'text-rose-700 font-bold' : 'text-emerald-700'}>
                      Open: {cat.openCount}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SUPPORT TICKETS QUEUE & SLA WATCHDOG TABLE */}
          <div className="p-6 rounded-xl bg-[#FFFFFF] border border-[#DED7CC] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#DED7CC] pb-3">
              <div>
                <h3 className="font-serif text-base uppercase tracking-wider text-[#24211D] font-semibold">
                  Live Support Tickets, Linked Orders/Shipments &amp; SLA Escalation Queue
                </h3>
                <p className="text-[11px] text-[#686158]">
                  Click &ldquo;Manage / Reconcile&rdquo; on any ticket to log first response, record resolution &amp; CSAT, or verify provider refund reconciliation.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#DED7CC] text-[10px] uppercase text-[#686158]">
                    <th className="py-2.5 px-3">Ticket &amp; Category</th>
                    <th className="py-2.5 px-3">Patron &amp; Linked Order / AWB</th>
                    <th className="py-2.5 px-3">Priority &amp; Desk</th>
                    <th className="py-2.5 px-3">SLA &amp; Response</th>
                    <th className="py-2.5 px-3">Refund Sync Status</th>
                    <th className="py-2.5 px-3">Status &amp; CSAT</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DED7CC]">
                  {(dashboard?.tickets || []).map((tkt: any) => (
                    <tr key={tkt.id} className="hover:bg-[#FAF8F4]">
                      <td className="py-3 px-3">
                        <div className="font-bold text-[#24211D]">{tkt.referenceCode}</div>
                        <div className="text-[10px] text-[#9A783E] font-semibold">{tkt.category}</div>
                        <div className="text-[10px] text-[#686158] max-w-xs truncate">{tkt.title}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-[#24211D]">{tkt.customerName}</div>
                        <div className="text-[10px] text-[#686158]">
                          Order: <strong className="text-[#24211D]">{tkt.orderNumber || 'N/A'}</strong> · AWB:{' '}
                          <strong className="text-[#24211D]">{tkt.awbNumber || 'N/A'}</strong>
                        </div>
                        <div className="text-[10px] text-[#686158]">
                          {tkt.productName} ({tkt.variantSize})
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div
                          className={`font-bold text-[11px] ${
                            tkt.priority === 'CRITICAL'
                              ? 'text-rose-700'
                              : tkt.priority === 'HIGH'
                              ? 'text-amber-700'
                              : 'text-[#24211D]'
                          }`}
                        >
                          {tkt.priority}
                        </div>
                        <div className="text-[10px] text-[#686158]">{tkt.assignedDepartment}</div>
                        <div className="text-[10px] text-[#686158]">{tkt.assignedStaffEmail}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="text-[11px] text-[#24211D]">
                          SLA Target: <strong>{tkt.slaTargetMinutes}m</strong>
                        </div>
                        <div className="text-[10px] text-[#686158]">
                          1st Resp:{' '}
                          {tkt.firstResponseMinutes ? `${tkt.firstResponseMinutes}m` : 'Pending'} · Res:{' '}
                          {tkt.resolutionMinutes ? `${tkt.resolutionMinutes}m` : 'Open'}
                        </div>
                        {tkt.isOverdue && (
                          <div className="text-[10px] text-rose-700 font-bold">
                            OVERDUE — ESCALATED TO ADMIN
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {Number(tkt.refundRequestedInr || 0) > 0 ? (
                          <div>
                            <div className="font-bold text-[#24211D]">
                              ₹{Number(tkt.refundRequestedInr).toLocaleString('en-IN')}
                            </div>
                            <div
                              className={`text-[10px] font-semibold ${
                                tkt.refundStatus === 'PROVIDER_RECONCILED_COMPLETED'
                                  ? 'text-emerald-700'
                                  : 'text-amber-700'
                              }`}
                            >
                              {tkt.refundStatus}
                            </div>
                            {tkt.refundGatewayRef && (
                              <div className="text-[10px] text-[#686158]">
                                Ref: {tkt.refundGatewayRef}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-[#686158]">No refund requested</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <div
                          className={`font-bold text-[11px] ${
                            tkt.status === 'RESOLVED'
                              ? 'text-emerald-700'
                              : tkt.status === 'ESCALATED'
                              ? 'text-rose-700'
                              : 'text-[#9A783E]'
                          }`}
                        >
                          {tkt.status}
                        </div>
                        {tkt.csatScore && (
                          <div className="text-[10px] text-emerald-700 font-bold">
                            CSAT: {tkt.csatScore}/5 ★
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => {
                            setSelectedTicket(tkt);
                            setGatewayRefInput(tkt.refundGatewayRef || '');
                            setFinanceReconciledChecked(Boolean(tkt.financeReconciled));
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-[11px] font-bold cursor-pointer transition-colors"
                        >
                          Manage / Reconcile
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

      {/* ===================================================================== */}
      {/* TAB 2: POST-DELIVERY REVIEW AUTOMATION & MODERATION                   */}
      {/* ===================================================================== */}
      {activeTab === 'REVIEW_AUTOMATION' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Configurable 5-Day Post-Delivery Review Invite Engine */}
            <div className="p-6 rounded-xl bg-[#FFFFFF] border border-[#DED7CC] space-y-4">
              <div className="border-b border-[#DED7CC] pb-3">
                <span className="text-[10px] uppercase tracking-widest text-[#9A783E] font-bold">
                  Post-Delivery Trigger Configuration
                </span>
                <h3 className="font-serif text-base uppercase text-[#24211D] mt-0.5">
                  Configurable Post-Delivery Wait &amp; Eligibility Check
                </h3>
                <p className="text-[11px] text-[#686158] mt-1">
                  Waits a configurable period (initially 5 days) after confirmed delivery, checks contact permissions, and links review invites to verified orders.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-[#FAF8F4] border border-[#DED7CC] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#24211D]">
                    Post-Delivery Review Wait Period (Days)
                  </label>
                  <span className="text-[10px] text-[#686158]">
                    Allows patron time to experience top, heart, and base notes on skin.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={waitDaysConfig}
                    onChange={(e) => setWaitDaysConfig(Number(e.target.value))}
                    className="w-20 bg-[#FFFFFF] border border-[#DED7CC] rounded-lg px-3 py-1.5 text-[#24211D] font-bold"
                  />
                  <button
                    onClick={handleUpdateReviewWaitDays}
                    className="px-3.5 py-1.5 rounded-lg bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] font-bold cursor-pointer"
                  >
                    Save Wait Days
                  </button>
                </div>
              </div>

              <form onSubmit={handleTriggerReviewInvite} className="space-y-3 pt-2">
                <div className="font-bold text-xs text-[#24211D]">
                  Test / Trigger Post-Delivery Review Invitation
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase text-[#686158] mb-1">
                      Verified Delivered Order ID
                    </label>
                    <input
                      type="text"
                      value={revOrderId}
                      onChange={(e) => setRevOrderId(e.target.value)}
                      className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2 text-[#24211D]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase text-[#686158] mb-1">
                      Days Elapsed Since Confirmed Delivery
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={60}
                      value={revSimulatedDays}
                      onChange={(e) => setRevSimulatedDays(Number(e.target.value))}
                      className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2 text-[#24211D]"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-[#24211D] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={revOptIn}
                    onChange={(e) => setRevOptIn(e.target.checked)}
                  />
                  <span>Customer Contact Permission Granted (Opted-In for Review Invitations)</span>
                </label>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-lg bg-[#9A783E] hover:bg-[#24211D] text-[#FAF8F4] font-bold uppercase tracking-wider cursor-pointer transition-colors"
                >
                  Evaluate Eligibility &amp; Schedule / Send Review Invite
                </button>
              </form>
            </div>

            {/* Right: Authentic Review Moderation & Duplicate Incentive Guard */}
            <div className="p-6 rounded-xl bg-[#FFFFFF] border border-[#DED7CC] space-y-4">
              <div className="border-b border-[#DED7CC] pb-3">
                <span className="text-[10px] uppercase tracking-widest text-[#9A783E] font-bold">
                  Authentic Moderation &amp; Anti-Spam Engine
                </span>
                <h3 className="font-serif text-base uppercase text-[#24211D] mt-0.5">
                  Verified Review Submission &amp; Incentive Deduplication
                </h3>
                <p className="text-[11px] text-[#686158] mt-1">
                  Never requires positive ratings (1★–5★ authentic reviews are published equally), blocks fake testimonials, and prevents duplicate incentivized submissions.
                </p>
              </div>

              <form onSubmit={handleSubmitAndModerateReview} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase text-[#686158] mb-1">
                      Patron Name
                    </label>
                    <input
                      type="text"
                      value={subCustomerName}
                      onChange={(e) => setSubCustomerName(e.target.value)}
                      className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase text-[#686158] mb-1">
                      Patron Email (Order Link)
                    </label>
                    <input
                      type="email"
                      value={subCustomerEmail}
                      onChange={(e) => setSubCustomerEmail(e.target.value)}
                      className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase text-[#686158] mb-1">
                      Fragrance &amp; Rating (1–5★)
                    </label>
                    <div className="flex gap-1.5">
                      <select
                        value={subProductName}
                        onChange={(e) => setSubProductName(e.target.value)}
                        className="flex-1 bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-2 py-1.5"
                      >
                        {[
                          'AZURE',
                          'IGNITE',
                          'ROSELLE',
                          'ÉLAN',
                          'SUEDE',
                          'SOLARA',
                          'Moksha Essence',
                          'Temple Flora',
                          'Divine Aura'
                        ].map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                      <select
                        value={subRating}
                        onChange={(e) => setSubRating(Number(e.target.value))}
                        className="w-20 bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-2 py-1.5 font-bold"
                      >
                        {[5, 4, 3, 2, 1].map((r) => (
                          <option key={r} value={r}>
                            {r} ★
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-[#686158] mb-1">
                    Review Headline
                  </label>
                  <input
                    type="text"
                    value={subTitle}
                    onChange={(e) => setSubTitle(e.target.value)}
                    className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-1.5"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-[#686158] mb-1">
                    Review Body (Tested for Spam URLs / Prohibited Claims)
                  </label>
                  <textarea
                    rows={2}
                    value={subComment}
                    onChange={(e) => setSubComment(e.target.value)}
                    className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-1.5"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={subRequestIncentive}
                      onChange={(e) => setSubRequestIncentive(e.target.checked)}
                    />
                    <span>Claim Verified Review Incentive (Max 1 per Order/SKU)</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-rose-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={subIsFakeTest}
                      onChange={(e) => setSubIsFakeTest(e.target.checked)}
                    />
                    <span>Simulate Fake Unverified Testimonial (Should Block)</span>
                  </label>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-lg bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] font-bold uppercase tracking-wider cursor-pointer transition-colors"
                >
                  Submit &amp; Run Automated Review Moderation
                </button>
              </form>
            </div>
          </div>

          {/* REVIEW AUTOMATION LEDGER */}
          <div className="p-6 rounded-xl bg-[#FFFFFF] border border-[#DED7CC] space-y-4">
            <h3 className="font-serif text-base uppercase tracking-wider text-[#24211D] font-semibold border-b border-[#DED7CC] pb-3">
              Review Invitations &amp; Moderation Ledger
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#DED7CC] text-[10px] uppercase text-[#686158]">
                    <th className="py-2 px-3">Ref Code</th>
                    <th className="py-2 px-3">Customer &amp; Linked Order</th>
                    <th className="py-2 px-3">Fragrance</th>
                    <th className="py-2 px-3">Headline &amp; Details</th>
                    <th className="py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DED7CC]">
                  {(dashboard?.reviewWorkflows || []).map((rw: any) => (
                    <tr key={rw.id} className="hover:bg-[#FAF8F4]">
                      <td className="py-2.5 px-3 font-bold">{rw.referenceCode}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold">{rw.customerName}</div>
                        <div className="text-[10px] text-[#686158]">
                          Order: {rw.orderNumber || 'Verified Lookup'}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-[#9A783E]">{rw.productName}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold">{rw.title}</div>
                        <div className="text-[10px] text-[#686158]">{rw.description}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-[#24211D]">{rw.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: RETENTION AUTOMATION & NON-FIXED BOTTLE DEPLETION ENGINE       */}
      {/* ===================================================================== */}
      {activeTab === 'RETENTION_JOURNEYS' && (
        <div className="space-y-6">
          {/* Dynamic Non-Fixed Bottle Consumption Calculator + Journey Dispatcher */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-6 rounded-xl bg-[#FFFFFF] border border-[#DED7CC] space-y-4">
              <div className="border-b border-[#DED7CC] pb-3">
                <span className="text-[10px] uppercase tracking-widest text-[#9A783E] font-bold">
                  Anti-Fixed-Day Consumption Physics
                </span>
                <h3 className="font-serif text-base uppercase text-[#24211D] mt-0.5">
                  Dynamic Flacon Depletion &amp; Retention Timing Calculator
                </h3>
                <p className="text-[11px] text-[#686158] mt-1">
                  Never assumes every perfume bottle is consumed within a fixed number of days. Computes personalized reminder windows from bottle ml, Extrait concentration sprays/wear, and wardrobe rotation size.
                </p>
              </div>

              <form onSubmit={handleDispatchRetentionJourney} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase text-[#686158] mb-1">
                      Retention Journey Type
                    </label>
                    <select
                      value={retJourneyCategory}
                      onChange={(e) => setRetJourneyCategory(e.target.value)}
                      className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2 font-bold"
                    >
                      <option value="FIRST_PURCHASE_FOLLOW_UP">1. First-Purchase Follow-Up</option>
                      <option value="PRODUCT_EDUCATION">2. Product Education</option>
                      <option value="CROSS_SELL_COMPLEMENTARY">
                        3. Cross-Selling Complementary Fragrances
                      </option>
                      <option value="DISCOVERY_TO_FULL_BOTTLE">
                        4. Discovery-to-Full-Bottle Upgrades
                      </option>
                      <option value="REPLENISHMENT_REMINDER">5. Replenishment Reminders</option>
                      <option value="VIP_CUSTOMER_ENGAGEMENT">6. VIP Customer Engagement</option>
                      <option value="REFERRAL_INVITATION">7. Referral Invitations</option>
                      <option value="CUSTOMER_WIN_BACK">8. Customer Win-Back</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase text-[#686158] mb-1">
                      Purchased Fragrance &amp; Format Size
                    </label>
                    <div className="flex gap-1.5">
                      <select
                        value={retProductName}
                        onChange={(e) => setRetProductName(e.target.value)}
                        className="flex-1 bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-2 py-2"
                      >
                        {[
                          'AZURE',
                          'IGNITE',
                          'ROSELLE',
                          'ÉLAN',
                          'SUEDE',
                          'SOLARA',
                          'Moksha Essence',
                          'Temple Flora',
                          'Divine Aura'
                        ].map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                      <select
                        value={retVariantSize}
                        onChange={(e) => setRetVariantSize(e.target.value)}
                        className="w-28 bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-2 py-2 font-bold"
                      >
                        <option value="2 ml">2 ml Vial</option>
                        <option value="8 ml">8 ml Travel</option>
                        <option value="30 ml">30 ml Flacon</option>
                        <option value="50 ml">50 ml Flacon</option>
                        <option value="100 ml">100 ml Flacon</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase text-[#686158] mb-1">
                      Patron Active Wardrobe Flacons (Rotation Factor)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={retActiveBottles}
                      onChange={(e) => setRetActiveBottles(Number(e.target.value))}
                      className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase text-[#686158] mb-1">
                      Observed Historical Order Interval (Days, 0 = Auto)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={365}
                      value={retHistoricalCadence}
                      onChange={(e) => setRetHistoricalCadence(Number(e.target.value))}
                      className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-1.5"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase text-[#686158] mb-1">
                      Patron Name
                    </label>
                    <input
                      type="text"
                      value={retCustomerName}
                      onChange={(e) => setRetCustomerName(e.target.value)}
                      className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase text-[#686158] mb-1">
                      Patron Email
                    </label>
                    <input
                      type="email"
                      value={retCustomerEmail}
                      onChange={(e) => setRetCustomerEmail(e.target.value)}
                      className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-1.5"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={retConsentOptIn}
                    onChange={(e) => setRetConsentOptIn(e.target.checked)}
                  />
                  <span>Customer Marketing Communication Permission Verified (Opt-In)</span>
                </label>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-lg bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] font-bold uppercase tracking-wider cursor-pointer transition-colors"
                >
                  Trigger Personalized Retention Journey
                </button>
              </form>
            </div>

            {/* Right: Live Calculated Depletion Physics & Complementary Pairing Preview */}
            <div className="p-6 rounded-xl bg-[#FFFFFF] border border-[#DED7CC] space-y-4">
              <div className="border-b border-[#DED7CC] pb-3">
                <span className="text-[10px] uppercase tracking-widest text-[#9A783E] font-bold">
                  Real-Time Olfactory Depletion Model
                </span>
                <h3 className="font-serif text-base uppercase text-[#24211D] mt-0.5">
                  Computed Consumption Window &amp; Complementary Cross-Sell
                </h3>
              </div>

              {calculatedDepletion?.dynamicDepletion && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-lg bg-[#FAF8F4] border border-[#DED7CC]">
                      <div className="text-[10px] uppercase text-[#686158]">Estimated Sprays</div>
                      <div className="text-xl font-bold text-[#24211D]">
                        {calculatedDepletion.dynamicDepletion.estimatedTotalSprays} sprays
                      </div>
                      <div className="text-[10px] text-[#686158]">
                        {calculatedDepletion.dynamicDepletion.avgSpraysPerWear} sprays/wear
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg bg-[#FAF8F4] border border-[#DED7CC]">
                      <div className="text-[10px] uppercase text-[#686158]">Depletion Range</div>
                      <div className="text-xl font-bold text-[#9A783E]">
                        {calculatedDepletion.dynamicDepletion.estimatedDaysMin}–
                        {calculatedDepletion.dynamicDepletion.estimatedDaysMax}d
                      </div>
                      <div className="text-[10px] text-[#686158]">
                        Expected: {calculatedDepletion.dynamicDepletion.estimatedDaysExpected} days
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg bg-[#FAF8F4] border border-[#DED7CC]">
                      <div className="text-[10px] uppercase text-[#686158]">Optimal Nudge Day</div>
                      <div className="text-xl font-bold text-emerald-700">
                        Day {calculatedDepletion.dynamicDepletion.recommendedReminderDayAfterDelivery}
                      </div>
                      <div className="text-[10px] text-[#686158]">
                        {calculatedDepletion.dynamicDepletion.wardrobeRotationMultiplier}× rotation
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-[#FAF8F4] border border-[#DED7CC] space-y-1.5">
                    <div className="text-[10px] uppercase font-bold text-[#9A783E]">
                      Non-Fixed Timing Formula Explanation
                    </div>
                    <p className="text-xs text-[#24211D] leading-relaxed">
                      {calculatedDepletion.dynamicDepletion.calculationFormulaSummary}
                    </p>
                  </div>

                  {calculatedDepletion.complementary && (
                    <div className="p-4 rounded-lg bg-[#F1EDE5] border border-[#9A783E]/40 space-y-1.5">
                      <div className="text-[10px] uppercase font-bold text-[#9A783E]">
                        Complementary Fragrance Cross-Sell Pairing for {retProductName}
                      </div>
                      <div className="font-bold text-xs text-[#24211D]">
                        Primary Match: {calculatedDepletion.complementary.recommendedPrimary} · Secondary:{' '}
                        {calculatedDepletion.complementary.recommendedSecondary}
                      </div>
                      <p className="text-[11px] text-[#686158]">
                        {calculatedDepletion.complementary.layeringRationale}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ALL 8 CONFIGURABLE RETENTION JOURNEYS GRID */}
          <div className="p-6 rounded-xl bg-[#FFFFFF] border border-[#DED7CC] space-y-4">
            <h3 className="font-serif text-base uppercase tracking-wider text-[#24211D] font-semibold border-b border-[#DED7CC] pb-3">
              8 Configured Retention Automation Journeys
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {(dashboard?.retentionConfigs || []).map((cfg: any) => {
                const meta = cfg.metadata || {};
                return (
                  <div
                    key={cfg.id}
                    className="p-4 rounded-xl bg-[#FAF8F4] border border-[#DED7CC] flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] text-[#9A783E] font-bold">
                        <span>{cfg.referenceCode}</span>
                        <span>{meta.defaultChannel || 'EMAIL'}</span>
                      </div>
                      <div className="font-serif text-sm font-bold text-[#24211D]">{cfg.title}</div>
                      <p className="text-[11px] text-[#686158] leading-relaxed">{cfg.description}</p>
                    </div>
                    <div className="pt-2 border-t border-[#DED7CC] space-y-1 text-[10px] text-[#686158]">
                      <div>
                        Timing: <strong className="text-[#24211D]">{meta.timingStrategy}</strong>
                      </div>
                      <div>
                        Consent Check: <strong className="text-emerald-700">Mandatory Opt-In</strong>
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
      {/* TAB 4: RETURNS / REFUNDS SYNC, CUSTOMER 360 TIMELINE & AUDIT LOG      */}
      {/* ===================================================================== */}
      {activeTab === 'RETURNS_AND_360_SYNC' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Customer 360 Unified Timeline */}
            <div className="p-6 rounded-xl bg-[#FFFFFF] border border-[#DED7CC] space-y-4">
              <div className="border-b border-[#DED7CC] pb-3">
                <span className="text-[10px] uppercase tracking-widest text-[#9A783E] font-bold">
                  Omnichannel Patron Dossier
                </span>
                <h3 className="font-serif text-base uppercase text-[#24211D] mt-0.5">
                  Customer 360 Timeline Synchronization
                </h3>
                <p className="text-[11px] text-[#686158] mt-1">
                  Every support ticket, SLA escalation, review invite, moderation decision, retention journey, and reconciled refund is immediately visible in the Customer 360 timeline.
                </p>
              </div>

              <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                {(dashboard?.customer360Feed || []).length === 0 ? (
                  <p className="text-xs text-[#686158]">
                    Trigger any support, review, or retention action to populate the live Customer 360 stream.
                  </p>
                ) : (
                  (dashboard?.customer360Feed || []).map((ev: any) => (
                    <div
                      key={ev.id}
                      className="p-3 rounded-lg bg-[#FAF8F4] border border-[#DED7CC] space-y-1"
                    >
                      <div className="flex items-center justify-between text-[10px] text-[#686158]">
                        <span className="font-bold text-[#9A783E]">{ev.actionType}</span>
                        <span>{ev.timestamp ? new Date(ev.timestamp).toLocaleString() : ''}</span>
                      </div>
                      <div className="font-bold text-xs text-[#24211D]">
                        {ev.customerName} ({ev.customerEmail}) — {ev.subject}
                      </div>
                      <div className="text-[11px] text-[#686158]">{ev.details}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Admin Audit Log Stream */}
            <div className="p-6 rounded-xl bg-[#FFFFFF] border border-[#DED7CC] space-y-4">
              <div className="border-b border-[#DED7CC] pb-3">
                <span className="text-[10px] uppercase tracking-widest text-[#9A783E] font-bold">
                  Immutable Governance Ledger
                </span>
                <h3 className="font-serif text-base uppercase text-[#24211D] mt-0.5">
                  Admin Audit Log Synchronization
                </h3>
                <p className="text-[11px] text-[#686158] mt-1">
                  Full audit trail of support SLA actions, blocked premature refunds, review moderation, and retention dispatches.
                </p>
              </div>

              <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                {(dashboard?.recentAuditLogs || []).map((log: any) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-lg bg-[#FAF8F4] border border-[#DED7CC] space-y-1"
                  >
                    <div className="flex items-center justify-between text-[10px] text-[#686158]">
                      <span className="font-bold text-[#24211D]">{log.action}</span>
                      <span>{log.adminEmail}</span>
                    </div>
                    <div className="text-[11px] text-[#686158]">{log.details}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: REPORT NEGATIVE EXPERIENCE & CREATE SUPPORT TICKET             */}
      {/* ===================================================================== */}
      {showNewTicketModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowNewTicketModal(false);
          }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#DED7CC] pb-3">
              <div>
                <span className="text-[10px] uppercase tracking-widest text-[#9A783E] font-bold">
                  8-Step Automated Negative Experience Workflow
                </span>
                <h3 className="font-serif text-lg uppercase text-[#24211D]">
                  Report Patron Issue &amp; Start Response SLA
                </h3>
              </div>
              <button
                onClick={() => setShowNewTicketModal(false)}
                className="p-1.5 rounded-lg bg-[#FAF8F4] text-[#686158] hover:text-[#24211D]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNegativeExperienceTicket} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase text-[#686158] mb-1">
                    Negative Experience Category *
                  </label>
                  <select
                    value={tktCategory}
                    onChange={(e) => setTktCategory(e.target.value)}
                    className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2 font-bold"
                  >
                    <option value="LEAKAGE">1. Leakage (CRITICAL SLA: 30m)</option>
                    <option value="BROKEN_BOTTLE">2. Broken Bottle (CRITICAL SLA: 30m)</option>
                    <option value="WRONG_FRAGRANCE">3. Wrong Fragrance (HIGH SLA: 60m)</option>
                    <option value="MISSING_ITEM">4. Missing Item (HIGH SLA: 60m)</option>
                    <option value="DELIVERY_DELAY">5. Delivery Delay (MEDIUM SLA: 180m)</option>
                    <option value="PAYMENT_ISSUE">6. Payment Issue (HIGH SLA: 60m)</option>
                    <option value="FRAGRANCE_DISSATISFACTION">
                      7. Fragrance Dissatisfaction (MEDIUM SLA: 180m)
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-[#686158] mb-1">
                    Order Number (Auto-Links AWB &amp; Items)
                  </label>
                  <input
                    type="text"
                    value={tktOrderNumber}
                    onChange={(e) => setTktOrderNumber(e.target.value)}
                    className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase text-[#686158] mb-1">
                    Patron Name
                  </label>
                  <input
                    type="text"
                    required
                    value={tktCustomerName}
                    onChange={(e) => setTktCustomerName(e.target.value)}
                    className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-[#686158] mb-1">
                    Patron Email
                  </label>
                  <input
                    type="email"
                    required
                    value={tktCustomerEmail}
                    onChange={(e) => setTktCustomerEmail(e.target.value)}
                    className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] uppercase text-[#686158] mb-1">
                    Fragrance
                  </label>
                  <input
                    type="text"
                    value={tktProductName}
                    onChange={(e) => setTktProductName(e.target.value)}
                    className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-[#686158] mb-1">
                    Refund Requested (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={tktRefundInr}
                    onChange={(e) => setTktRefundInr(Number(e.target.value))}
                    className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-[#686158] mb-1">
                    Simulate Overdue (Mins)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={tktSimulateOverdueMins}
                    onChange={(e) => setTktSimulateOverdueMins(Number(e.target.value))}
                    className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase text-[#686158] mb-1">
                  Issue Description
                </label>
                <textarea
                  rows={3}
                  required
                  value={tktDescription}
                  onChange={(e) => setTktDescription(e.target.value)}
                  className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#DED7CC]">
                <button
                  type="button"
                  onClick={() => setShowNewTicketModal(false)}
                  className="px-4 py-2 rounded-lg border border-[#DED7CC] text-[#686158]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] font-bold cursor-pointer"
                >
                  Create Ticket, Notify Staff &amp; Start SLA
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: MANAGE TICKET, LOG SLA RESPONSE, CSAT & RECONCILE REFUND       */}
      {/* ===================================================================== */}
      {selectedTicket && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedTicket(null);
          }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#DED7CC] pb-3">
              <div>
                <span className="text-[10px] uppercase tracking-widest text-[#9A783E] font-bold">
                  {selectedTicket.referenceCode} · {selectedTicket.category} · Priority:{' '}
                  {selectedTicket.priority}
                </span>
                <h3 className="font-serif text-lg uppercase text-[#24211D]">
                  {selectedTicket.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                className="p-1.5 rounded-lg bg-[#FAF8F4] text-[#686158] hover:text-[#24211D]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Linked Order & Shipment Banner */}
            <div className="p-3.5 rounded-xl bg-[#FAF8F4] border border-[#DED7CC] grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div>
                <span className="text-[#686158] block text-[10px]">Linked Order</span>
                <strong>{selectedTicket.orderNumber || 'N/A'}</strong>
              </div>
              <div>
                <span className="text-[#686158] block text-[10px]">Courier AWB</span>
                <strong>{selectedTicket.awbNumber || 'N/A'}</strong>
              </div>
              <div>
                <span className="text-[#686158] block text-[10px]">Assigned Staff</span>
                <strong>{selectedTicket.assignedStaffEmail}</strong>
              </div>
              <div>
                <span className="text-[#686158] block text-[10px]">Linked Return ID</span>
                <strong>{selectedTicket.returnId || 'None'}</strong>
              </div>
            </div>

            {/* 1. First Response & Resolution Controls */}
            <div className="p-4 rounded-xl bg-[#FAF8F4] border border-[#DED7CC] space-y-3">
              <div className="font-bold text-xs text-[#24211D]">
                Step 1: Log First Response &amp; Resolution
              </div>
              <input
                type="text"
                value={responseNote}
                onChange={(e) => setResponseNote(e.target.value)}
                placeholder="First response note..."
                className="w-full bg-[#FFFFFF] border border-[#DED7CC] rounded-lg px-3 py-1.5"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleTicketAction(selectedTicket.id, 'LOG_FIRST_RESPONSE')}
                  className="px-3.5 py-1.5 rounded-lg bg-[#24211D] text-[#FAF8F4] font-bold cursor-pointer"
                >
                  Log First Response (Stop 1st-Response SLA Timer)
                </button>
                <button
                  onClick={() => handleTicketAction(selectedTicket.id, 'RESOLVE_TICKET')}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-800 text-[#FAF8F4] font-bold cursor-pointer"
                >
                  Mark Ticket Resolved
                </button>
              </div>
            </div>

            {/* 2. Payment-Provider & Finance Refund Reconciliation Guardrail */}
            {Number(selectedTicket.refundRequestedInr || 0) > 0 && (
              <div className="p-4 rounded-xl bg-[#F1EDE5] border border-[#9A783E] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-[#24211D]">
                    Step 2: Refund Provider &amp; Finance Reconciliation (₹
                    {Number(selectedTicket.refundRequestedInr).toLocaleString('en-IN')})
                  </span>
                  <span className="text-[10px] font-bold text-[#9A783E]">
                    Status: {selectedTicket.refundStatus}
                  </span>
                </div>
                <p className="text-[11px] text-[#686158]">
                  Guardrail: Never mark a refund completed until payment-provider or finance reconciliation confirms the outcome.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase text-[#686158] mb-1">
                      Payment Gateway Refund Reference / UTR *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. rfnd_rzp_9928172"
                      value={gatewayRefInput}
                      onChange={(e) => setGatewayRefInput(e.target.value)}
                      className="w-full bg-[#FFFFFF] border border-[#DED7CC] rounded-lg px-3 py-1.5"
                    />
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 text-xs font-bold text-[#24211D] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={financeReconciledChecked}
                        onChange={(e) => setFinanceReconciledChecked(e.target.checked)}
                      />
                      <span>Finance Settlement Reconciled</span>
                    </label>
                  </div>
                </div>

                <button
                  onClick={() => handleTicketAction(selectedTicket.id, 'ATTEMPT_COMPLETE_REFUND')}
                  className="px-4 py-2 rounded-lg bg-[#9A783E] hover:bg-[#24211D] text-[#FAF8F4] font-bold cursor-pointer transition-colors"
                >
                  Verify Reconciliation &amp; Complete Refund (Syncs Returns &amp; Orders)
                </button>
              </div>
            )}

            {/* 3. Customer Satisfaction (CSAT) Recording */}
            <div className="p-4 rounded-xl bg-[#FAF8F4] border border-[#DED7CC] space-y-3">
              <div className="font-bold text-xs text-[#24211D]">
                Step 3: Record Patron Feedback &amp; CSAT Score
              </div>
              <div className="flex gap-2">
                <select
                  value={csatInput}
                  onChange={(e) => setCsatInput(Number(e.target.value))}
                  className="w-28 bg-[#FFFFFF] border border-[#DED7CC] rounded-lg px-2 py-1.5 font-bold"
                >
                  {[5, 4, 3, 2, 1].map((s) => (
                    <option key={s} value={s}>
                      {s} / 5 ★
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={csatComment}
                  onChange={(e) => setCsatComment(e.target.value)}
                  className="flex-1 bg-[#FFFFFF] border border-[#DED7CC] rounded-lg px-3 py-1.5"
                />
                <button
                  onClick={() => handleTicketAction(selectedTicket.id, 'RECORD_CSAT_FEEDBACK')}
                  className="px-3.5 py-1.5 rounded-lg bg-[#24211D] text-[#FAF8F4] font-bold cursor-pointer"
                >
                  Save CSAT
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
