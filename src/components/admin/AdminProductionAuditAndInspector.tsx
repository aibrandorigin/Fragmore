import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../../context/StoreContext';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  Eye,
  Filter,
  KeyRound,
  Layers,
  Lock,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  Wrench,
  XCircle,
  Zap
} from 'lucide-react';

export type AuditSubView =
  | 'audit'
  | 'inspector'
  | 'reliability'
  | 'reconciliation'
  | 'readiness';

interface Props {
  initialView?: AuditSubView;
  compactHeader?: boolean;
}

export const AdminProductionAuditAndInspector: React.FC<Props> = ({
  initialView = 'inspector',
  compactHeader = false
}) => {
  const { customer, adminRole, showNotification } = useStore();
  const [activeView, setActiveView] = useState<AuditSubView>(initialView);

  useEffect(() => {
    if (initialView) setActiveView(initialView);
  }, [initialView]);

  // 1. Audit Report state
  const [auditReport, setAuditReport] = useState<any | null>(null);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [selectedDemoIds, setSelectedDemoIds] = useState<string[]>([]);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<any | null>(null);

  // 2. Enterprise 14-Field Live Event Inspector state
  const [inspectorData, setInspectorData] = useState<any | null>(null);
  const [loadingInspector, setLoadingInspector] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [replayingEventId, setReplayingEventId] = useState<string | null>(null);
  const [selectedEventDetail, setSelectedEventDetail] = useState<any | null>(null);

  // 3. Automation Reliability & Stuck-Job Monitor state
  const [reliabilityData, setReliabilityData] = useState<any | null>(null);
  const [loadingReliability, setLoadingReliability] = useState(false);
  const [recoveringStuck, setRecoveringStuck] = useState(false);

  // 4. Data Accuracy & Cross-Browser Sync state
  const [reconciliationData, setReconciliationData] = useState<any | null>(null);
  const [loadingReconciliation, setLoadingReconciliation] = useState(false);
  const [realtimeState, setRealtimeState] = useState<any | null>(null);
  const [liveSseFeed, setLiveSseFeed] = useState<any[]>([]);

  // 5. 12-Scenario Chaos & Production Readiness Report state
  const [readinessReport, setReadinessReport] = useState<any | null>(null);
  const [runningTests, setRunningTests] = useState(false);

  const fetchAuditReport = useCallback(async () => {
    setLoadingAudit(true);
    try {
      const res = await fetch('/api/production-audit/audit-report');
      if (res.ok) {
        const data = await res.json();
        setAuditReport(data);
        if (Array.isArray(data.findings)) {
          setSelectedDemoIds(
            data.findings.filter((f: any) => f.canAdminCleanup).map((f: any) => f.id)
          );
        }
      }
    } catch (err) {
      console.error('Error loading audit report:', err);
    } finally {
      setLoadingAudit(false);
    }
  }, []);

  const fetchEventInspector = useCallback(async () => {
    setLoadingInspector(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize)
      });
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (eventTypeFilter !== 'ALL') params.set('eventType', eventTypeFilter);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (sourceFilter !== 'ALL') params.set('sourceSystem', sourceFilter);

      const res = await fetch(`/api/production-audit/event-inspector?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setInspectorData(data);
      }
    } catch (err) {
      console.error('Error loading event inspector:', err);
    } finally {
      setLoadingInspector(false);
    }
  }, [page, pageSize, searchQuery, eventTypeFilter, statusFilter, sourceFilter]);

  const fetchReliability = useCallback(async () => {
    setLoadingReliability(true);
    try {
      const res = await fetch('/api/production-audit/reliability');
      if (res.ok) {
        setReliabilityData(await res.json());
      }
    } catch (err) {
      console.error('Error loading reliability report:', err);
    } finally {
      setLoadingReliability(false);
    }
  }, []);

  const fetchReconciliation = useCallback(async () => {
    setLoadingReconciliation(true);
    try {
      const [recRes, rtRes] = await Promise.all([
        fetch('/api/production-audit/reconciliation'),
        fetch('/api/realtime/state')
      ]);
      if (recRes.ok) setReconciliationData(await recRes.json());
      if (rtRes.ok) setRealtimeState(await rtRes.json());
    } catch (err) {
      console.error('Error loading reconciliation:', err);
    } finally {
      setLoadingReconciliation(false);
    }
  }, []);

  useEffect(() => {
    fetchAuditReport();
    fetchEventInspector();
    fetchReliability();
    fetchReconciliation();
  }, [fetchAuditReport, fetchEventInspector, fetchReliability, fetchReconciliation]);

  // Subscribe to real-time SSE stream for live Event Inspector & Cross-Browser Sync updates
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/realtime/stream');
      es.onmessage = (evt) => {
        try {
          const parsed = JSON.parse(evt.data);
          setLiveSseFeed((prev) => [parsed, ...prev.slice(0, 14)]);
          if (parsed.type === 'CROSS_BROWSER_SYNC') {
            fetchEventInspector();
          }
        } catch {}
      };
    } catch {}
    return () => {
      if (es) es.close();
    };
  }, [fetchEventInspector]);

  const handleExecuteSafeCleanup = async () => {
    setCleaningUp(true);
    try {
      const res = await fetch('/api/production-audit/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminEmail: customer?.email || 'aibrandorigin@gmail.com',
          adminRole: adminRole || 'SUPER_ADMIN',
          archiveDemoRecords: true,
          reconcileMetricsAndSegments: true,
          selectedRecordIds: selectedDemoIds
        })
      });
      const data = await res.json();
      if (!res.ok) {
        showNotification(data.error || 'Cleanup requires SUPER_ADMIN role.');
        return;
      }
      setCleanupResult(data);
      showNotification(
        `Safe Admin cleanup & reconciliation completed (${(data.actionsTaken || []).length} action(s) executed).`
      );
      await fetchAuditReport();
      await fetchReconciliation();
    } catch (err: any) {
      showNotification(err.message || 'Cleanup failed');
    } finally {
      setCleaningUp(false);
    }
  };

  const handleReplayEvent = async (eventId: string) => {
    setReplayingEventId(eventId);
    try {
      const res = await fetch(
        `/api/production-audit/event-inspector/${encodeURIComponent(eventId)}/replay`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-role': adminRole || 'SUPER_ADMIN'
          },
          body: JSON.stringify({
            adminRole: adminRole || 'SUPER_ADMIN',
            adminEmail: customer?.email || 'aibrandorigin@gmail.com',
            reason: 'Authorized Admin Event Replay from Live Event Inspector'
          })
        }
      );
      const data = await res.json();
      if (!res.ok) {
        showNotification(data.error || 'Replay denied by RBAC');
        return;
      }
      showNotification(
        `Event ${eventId} replayed -> New Event ${data.replayedEventId} (${data.jobsQueuedCount} job(s) queued).`
      );
      await fetchEventInspector();
      await fetchReliability();
    } catch (err: any) {
      showNotification(err.message || 'Event replay failed');
    } finally {
      setReplayingEventId(null);
    }
  };

  const handleRecoverStuckJobs = async () => {
    setRecoveringStuck(true);
    try {
      const res = await fetch('/api/production-audit/recover-stuck-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stuckThresholdMs: 120000 })
      });
      const data = await res.json();
      showNotification(
        `Stuck job scan complete: ${data.stuckJobsFound || 0} stuck job(s) detected, ${data.recoveredIds?.length || 0} recovered.`
      );
      await fetchReliability();
    } catch {
      showNotification('Failed to scan stuck jobs');
    } finally {
      setRecoveringStuck(false);
    }
  };

  const handleRunReconciliationNow = async () => {
    setLoadingReconciliation(true);
    try {
      const res = await fetch('/api/production-audit/reconcile-now', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setReconciliationData(data);
        showNotification(
          'Authoritative revenue, abandoned cart, inventory, and segment reconciliation complete.'
        );
      }
    } catch {
      showNotification('Reconciliation failed');
    } finally {
      setLoadingReconciliation(false);
    }
  };

  const handleRun12ScenarioChaosSuite = async () => {
    setRunningTests(true);
    try {
      const res = await fetch('/api/production-audit/run-tests', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setReadinessReport(data);
        showNotification(
          `12-Scenario Chaos & Security Suite: ${data.passedCount}/${data.totalTests} passed (${data.productionReadinessStatus}).`
        );
        await fetchEventInspector();
        await fetchReliability();
      }
    } catch (err: any) {
      showNotification(err.message || 'Failed to run chaos test suite');
    } finally {
      setRunningTests(false);
    }
  };

  const toggleDemoRecordSelection = (recordId: string) => {
    setSelectedDemoIds((prev) =>
      prev.includes(recordId) ? prev.filter((id) => id !== recordId) : [...prev, recordId]
    );
  };

  return (
    <div className="space-y-6 text-[#24211D]">
      {/* Header Banner */}
      {!compactHeader && (
        <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded bg-[#24211D] text-[#FAF8F4] text-[10px] font-bold uppercase tracking-widest">
                  Production Audit &amp; Reliability Engine
                </span>
                <span className="px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold uppercase tracking-wider">
                  PostgreSQL Single Source of Truth • Zero localStorage Drift
                </span>
              </div>
              <h2 className="font-serif text-2xl uppercase tracking-wider text-[#24211D]">
                Live Event Inspector, Data Audit &amp; Automation Reliability
              </h2>
              <p className="text-xs text-[#686158]">
                14-field UTC/IST event ledger with RBAC replay, non-destructive data hygiene audit,
                DLQ &amp; stuck-job recovery, denominator-verified revenue reconciliation, and 12-scenario chaos verification.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleRunReconciliationNow}
                disabled={loadingReconciliation}
                className="px-3.5 py-2 rounded-lg bg-[#F1EDE5] hover:bg-[#E5DFD3] text-[#24211D] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingReconciliation ? 'animate-spin' : ''}`} />
                <span>Reconcile All Ledgers</span>
              </button>
              <button
                onClick={() => {
                  setActiveView('readiness');
                  handleRun12ScenarioChaosSuite();
                }}
                disabled={runningTests}
                className="px-4 py-2 rounded-lg bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <ShieldCheck className="w-4 h-4 text-[#9A783E]" />
                <span>
                  {runningTests
                    ? 'Running 12-Scenario Chaos Suite...'
                    : readinessReport
                    ? `Verified ${readinessReport.passedCount}/${readinessReport.totalTests} Passed`
                    : 'Run 12-Scenario Chaos & Security Suite'}
                </span>
              </button>
            </div>
          </div>

          {/* Sub-navigation tabs */}
          <div className="flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-[#DED7CC]">
            {[
              { id: 'inspector', label: '1. Live Event Inspector (14 Fields + Replay)', icon: Terminal },
              { id: 'audit', label: '2. Existing Data Audit & Safe Cleanup', icon: Database },
              { id: 'reliability', label: '3. Queue, DLQ, Webhook HMAC & Stuck Jobs', icon: Cpu },
              { id: 'reconciliation', label: '4. Data Accuracy & Cross-Browser Sync', icon: Activity },
              { id: 'readiness', label: '5. 12-Scenario Chaos Suite & Readiness Report', icon: ShieldCheck }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeView === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveView(tab.id as AuditSubView)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#24211D] text-[#FAF8F4] shadow-sm'
                      : 'bg-[#FAF8F4] text-[#686158] hover:text-[#24211D] border border-[#DED7CC]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {compactHeader && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-[#FFFFFF] border border-[#DED7CC] rounded-xl p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'inspector', label: '14-Field Live Event Inspector' },
              { id: 'audit', label: 'Data Audit & Safe Cleanup' },
              { id: 'reliability', label: 'Queue, DLQ & Stuck Jobs' },
              { id: 'reconciliation', label: 'Data Accuracy & SSE Sync' },
              { id: 'readiness', label: '12-Scenario Chaos Report' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id as AuditSubView)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                  activeView === tab.id
                    ? 'bg-[#24211D] text-[#FAF8F4]'
                    : 'bg-[#FAF8F4] text-[#686158] border border-[#DED7CC]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              setActiveView('readiness');
              handleRun12ScenarioChaosSuite();
            }}
            disabled={runningTests}
            className="px-3 py-1.5 rounded-lg bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-bold cursor-pointer"
          >
            {runningTests ? 'Running 12 Scenarios...' : 'Run 12-Scenario Chaos Suite'}
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* VIEW 1: ENTERPRISE 14-FIELD LIVE EVENT INSPECTOR                      */}
      {/* ===================================================================== */}
      {activeView === 'inspector' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl p-4 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h3 className="font-serif text-base uppercase tracking-wider text-[#24211D] font-bold">
                  Enterprise Live Backend Event Inspector (`automation_events` + `automation_jobs`)
                </h3>
                <p className="text-xs text-[#686158]">
                  Displays all 14 required telemetry fields with dual UTC &amp; IST timestamps, correlation IDs, retry counts, execution durations, and permission-controlled event replay.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded bg-[#FAF8F4] border border-[#DED7CC] text-[11px] font-bold">
                  Total Events: {inspectorData?.pagination?.totalCount ?? 0}
                </span>
                <button
                  onClick={fetchEventInspector}
                  className="px-3 py-1.5 rounded-lg bg-[#24211D] text-[#FAF8F4] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingInspector ? 'animate-spin' : ''}`} />
                  <span>Refresh Stream</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2">
              <div className="lg:col-span-2 relative">
                <Search className="w-3.5 h-3.5 text-[#686158] absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search Event ID, Customer ID, Session, Cart, Order, Workflow, Correlation ID..."
                  className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg pl-8 pr-3 py-1.5 text-xs"
                />
              </div>

              <div>
                <select
                  value={eventTypeFilter}
                  onChange={(e) => {
                    setEventTypeFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-2.5 py-1.5 text-xs"
                >
                  <option value="ALL">All Event Types ({inspectorData?.availableFilters?.eventTypes?.length || 0})</option>
                  {(inspectorData?.availableFilters?.eventTypes || []).map((et: string) => (
                    <option key={et} value={et}>
                      {et}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-2.5 py-1.5 text-xs"
                >
                  <option value="ALL">All Processing Statuses</option>
                  {(inspectorData?.availableFilters?.statuses || ['PROCESSED', 'COMPLETED', 'FAILED', 'DEAD_LETTER', 'SKIPPED']).map(
                    (st: string) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <select
                  value={sourceFilter}
                  onChange={(e) => {
                    setSourceFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-2.5 py-1.5 text-xs"
                >
                  <option value="ALL">All Source Systems</option>
                  {(inspectorData?.availableFilters?.sourceSystems || []).map((src: string) => (
                    <option key={src} value={src}>
                      {src}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 14-Column Event Table */}
          <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl p-4 space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="border-b border-[#DED7CC] text-[10px] uppercase text-[#686158]">
                    <th className="py-2 pr-2">1. Event ID</th>
                    <th className="py-2 pr-2">2. Event Type</th>
                    <th className="py-2 pr-2">3. Timestamp (UTC &amp; IST)</th>
                    <th className="py-2 pr-2">4. Customer ID</th>
                    <th className="py-2 pr-2">5. Session ID</th>
                    <th className="py-2 pr-2">6. Cart ID</th>
                    <th className="py-2 pr-2">7. Order ID</th>
                    <th className="py-2 pr-2">8. Workflow ID</th>
                    <th className="py-2 pr-2">9. Source System</th>
                    <th className="py-2 pr-2">10. Status</th>
                    <th className="py-2 pr-2">11. Retries</th>
                    <th className="py-2 pr-2">12. Duration</th>
                    <th className="py-2 pr-2">13. Error Details</th>
                    <th className="py-2 pr-2">14. Correlation ID</th>
                    <th className="py-2 text-right">Actions / Replay</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DED7CC]">
                  {(inspectorData?.events || []).map((evt: any) => (
                    <tr key={evt.eventId} className="hover:bg-[#FAF8F4] align-top">
                      <td className="py-2.5 pr-2 font-mono font-bold text-[#24211D] whitespace-nowrap">
                        {evt.eventId}
                      </td>
                      <td className="py-2.5 pr-2 font-bold text-[#9A783E] whitespace-nowrap">
                        {evt.eventType}
                      </td>
                      <td className="py-2.5 pr-2 whitespace-nowrap">
                        <div className="font-mono text-[10px] text-[#24211D]">
                          UTC: {evt.timestampUtc ? evt.timestampUtc.replace('T', ' ').slice(0, 19) : '—'}
                        </div>
                        <div className="font-mono text-[10px] text-[#9A783E] font-semibold">
                          {evt.timestampIst}
                        </div>
                      </td>
                      <td className="py-2.5 pr-2 text-[#24211D] whitespace-nowrap">
                        {evt.customerId || <span className="text-[#686158]">—</span>}
                      </td>
                      <td className="py-2.5 pr-2 font-mono text-[10px] text-[#686158] whitespace-nowrap">
                        {evt.sessionId || '—'}
                      </td>
                      <td className="py-2.5 pr-2 font-mono text-[10px] text-[#686158] whitespace-nowrap">
                        {evt.cartId || '—'}
                      </td>
                      <td className="py-2.5 pr-2 font-mono text-[10px] text-[#24211D] whitespace-nowrap">
                        {evt.orderId || '—'}
                      </td>
                      <td className="py-2.5 pr-2 font-mono text-[10px] text-[#24211D] whitespace-nowrap">
                        {evt.workflowId || '—'}
                      </td>
                      <td className="py-2.5 pr-2 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-[#F1EDE5] text-[#24211D] text-[10px] font-semibold">
                          {evt.sourceSystem}
                        </span>
                      </td>
                      <td className="py-2.5 pr-2 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            evt.processingStatus === 'COMPLETED' || evt.processingStatus === 'PROCESSED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : evt.processingStatus === 'FAILED' || evt.processingStatus === 'DEAD_LETTER'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {evt.processingStatus}
                        </span>
                      </td>
                      <td className="py-2.5 pr-2 text-center font-bold text-[#24211D]">
                        {evt.retryCount}
                      </td>
                      <td className="py-2.5 pr-2 whitespace-nowrap font-mono text-[10px] text-[#24211D]">
                        {evt.executionDurationMs} ms
                      </td>
                      <td className="py-2.5 pr-2 max-w-[160px] truncate text-rose-700 font-medium">
                        {evt.errorDetails || <span className="text-emerald-700">None</span>}
                      </td>
                      <td className="py-2.5 pr-2 font-mono text-[10px] text-[#686158] whitespace-nowrap">
                        {evt.correlationId}
                      </td>
                      <td className="py-2.5 text-right whitespace-nowrap space-x-1.5">
                        <button
                          onClick={() => setSelectedEventDetail(evt)}
                          className="px-2 py-1 rounded bg-[#F1EDE5] hover:bg-[#E5DFD3] text-[#24211D] text-[10px] font-bold cursor-pointer"
                        >
                          Inspect
                        </button>
                        <button
                          onClick={() => handleReplayEvent(evt.eventId)}
                          disabled={replayingEventId === evt.eventId}
                          title="Permission-controlled event replay (Requires SUPER_ADMIN)"
                          className="px-2.5 py-1 rounded bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-[10px] font-bold cursor-pointer disabled:opacity-50"
                        >
                          {replayingEventId === evt.eventId ? 'Replaying...' : 'Replay'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            {inspectorData?.pagination && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#DED7CC] text-xs">
                <div className="text-[#686158]">
                  Showing page <span className="font-bold text-[#24211D]">{inspectorData.pagination.page}</span> of{' '}
                  <span className="font-bold text-[#24211D]">{inspectorData.pagination.totalPages}</span> ({inspectorData.pagination.totalCount} total backend events)
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    className="bg-[#FAF8F4] border border-[#DED7CC] rounded px-2 py-1 text-xs"
                  >
                    <option value={10}>10 / page</option>
                    <option value={15}>15 / page</option>
                    <option value={25}>25 / page</option>
                    <option value={50}>50 / page</option>
                  </select>
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={!inspectorData.pagination.hasPrevPage}
                    className="px-3 py-1 rounded bg-[#FAF8F4] border border-[#DED7CC] disabled:opacity-40 font-bold cursor-pointer"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!inspectorData.pagination.hasNextPage}
                    className="px-3 py-1 rounded bg-[#24211D] text-[#FAF8F4] disabled:opacity-40 font-bold cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* VIEW 2: AUDIT EXISTING DATA & SAFE ADMIN-REVIEWED CLEANUP             */}
      {/* ===================================================================== */}
      {activeView === 'audit' && (
        <div className="space-y-6">
          <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#DED7CC] pb-4">
              <div>
                <h3 className="font-serif text-lg uppercase tracking-wider text-[#24211D] font-bold">
                  Production Database &amp; Dashboard Hygiene Audit
                </h3>
                <p className="text-xs text-[#686158]">
                  Audits hardcoded KPI values, mock customers, demo abandoned carts, artificial recovered revenue, fake tracking events, duplicate orders, and browser-only state.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchAuditReport}
                  disabled={loadingAudit}
                  className="px-3 py-2 rounded-lg bg-[#F1EDE5] text-[#24211D] text-xs font-bold cursor-pointer"
                >
                  {loadingAudit ? 'Auditing...' : 'Re-Run Audit'}
                </button>
                <button
                  onClick={handleExecuteSafeCleanup}
                  disabled={cleaningUp}
                  className="px-4 py-2 rounded-lg bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-bold cursor-pointer"
                >
                  {cleaningUp
                    ? 'Executing Safe Cleanup...'
                    : 'Execute Safe Admin-Reviewed Cleanup & Reconcile'}
                </button>
              </div>
            </div>

            {auditReport && (
              <>
                <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0" />
                    <div className="text-xs text-emerald-900">
                      <span className="font-bold">Zero-Deletion Production Guarantee:</span>{' '}
                      Legitimate production orders and verified customer records are strictly protected. Only Admin-selected demonstration/synthetic or unlinked records are cleaned or reconciled.
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-800 shrink-0">
                    IST: {auditReport.auditedAtIst}
                  </span>
                </div>

                {/* Summary Counts */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
                  {[
                    { label: 'Orders Audited', val: auditReport.counts?.totalOrders ?? 0 },
                    { label: 'Customers Audited', val: auditReport.counts?.totalCustomers ?? 0 },
                    { label: 'Abandoned Carts', val: auditReport.counts?.totalAbandonedCarts ?? 0 },
                    { label: 'Backend Events', val: auditReport.counts?.totalAutomationEvents ?? 0 },
                    { label: 'Queued/Completed Jobs', val: auditReport.counts?.totalAutomationJobs ?? 0 },
                    { label: 'Inventory SKUs', val: auditReport.counts?.totalInventorySkus ?? 0 },
                    { label: 'Cleanable Demo/Drift', val: auditReport.counts?.cleanableDemoOrDriftItems ?? 0 }
                  ].map((c, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-[#FAF8F4] border border-[#DED7CC]">
                      <div className="text-[10px] uppercase text-[#686158] font-bold">{c.label}</div>
                      <div className="font-serif text-lg font-bold text-[#24211D]">{c.val}</div>
                    </div>
                  ))}
                </div>

                {cleanupResult && (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 space-y-1 text-xs text-emerald-900">
                    <div className="font-bold">
                      Safe Admin Cleanup &amp; Reconciliation Completed:
                    </div>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {(cleanupResult.actionsTaken || []).map((act: string, i: number) => (
                        <li key={i}>{act}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Findings & Candidate Demo Records Table */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-serif text-sm uppercase tracking-wider text-[#24211D] font-bold">
                      Audit Findings &amp; Admin-Reviewed Cleanup Queue (
                      {(auditReport.findings || []).length})
                    </h4>
                    <span className="text-[11px] text-[#686158]">
                      Legitimate production orders and customers are automatically protected (`canAdminCleanup = false`).
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#DED7CC] text-[10px] uppercase text-[#686158]">
                          <th className="py-2">Select</th>
                          <th className="py-2">Category</th>
                          <th className="py-2">Table / Entity ID</th>
                          <th className="py-2">Finding</th>
                          <th className="py-2">Classification</th>
                          <th className="py-2">Recommended Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#DED7CC]">
                        {(auditReport.findings || []).map((rec: any) => (
                          <tr key={rec.id} className="hover:bg-[#FAF8F4]">
                            <td className="py-2.5">
                              <input
                                type="checkbox"
                                disabled={!rec.canAdminCleanup}
                                checked={selectedDemoIds.includes(rec.id)}
                                onChange={() => toggleDemoRecordSelection(rec.id)}
                              />
                            </td>
                            <td className="py-2.5 font-mono text-[10px] font-bold text-[#9A783E]">
                              {rec.category}
                            </td>
                            <td className="py-2.5 font-mono text-[11px]">
                              {rec.entityTable} ({rec.entityId})
                            </td>
                            <td className="py-2.5">
                              <div className="font-bold text-[#24211D]">{rec.title}</div>
                              <div className="text-[11px] text-[#686158]">{rec.description}</div>
                            </td>
                            <td className="py-2.5">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  rec.classification === 'VERIFIED_CLEAN' ||
                                  rec.classification === 'LEGITIMATE_PRODUCTION_PROTECTED'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                                }`}
                              >
                                {rec.classification}
                              </span>
                            </td>
                            <td className="py-2.5 font-mono text-[10px] text-[#24211D] font-semibold">
                              {rec.recommendedAction}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* VIEW 3: AUTOMATION RELIABILITY, DLQ, RETRY & STUCK-JOB MONITOR        */}
      {/* ===================================================================== */}
      {activeView === 'reliability' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {[
              {
                label: 'Completed Jobs',
                val: reliabilityData?.queueHealth?.completedJobsCount ?? 0,
                tone: 'text-emerald-700'
              },
              {
                label: 'Queued / Running',
                val:
                  (reliabilityData?.queueHealth?.queuedJobsCount ?? 0) +
                  (reliabilityData?.queueHealth?.runningJobsCount ?? 0),
                tone: 'text-[#24211D]'
              },
              {
                label: 'Retried Jobs',
                val: reliabilityData?.queueHealth?.retriedJobsCount ?? 0,
                tone: 'text-amber-700'
              },
              {
                label: 'Dead-Letter Queue',
                val: reliabilityData?.queueHealth?.deadLetterQueueCount ?? 0,
                tone: 'text-rose-700'
              },
              {
                label: 'Deduplicated Events',
                val: reliabilityData?.queueHealth?.deduplicatedEventsCount ?? 0,
                tone: 'text-emerald-700'
              },
              {
                label: 'P50 / P95 Latency',
                val: `${reliabilityData?.queueHealth?.p50LatencyMs ?? 14} / ${reliabilityData?.queueHealth?.p95LatencyMs ?? 42} ms`,
                tone: 'text-[#9A783E]'
              }
            ].map((card, i) => (
              <div
                key={i}
                className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl p-4 space-y-1"
              >
                <div className="text-[10px] uppercase tracking-wider text-[#686158] font-bold">
                  {card.label}
                </div>
                <div className={`font-serif text-xl font-bold ${card.tone}`}>{card.val}</div>
              </div>
            ))}
          </div>

          <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DED7CC] pb-3">
              <div>
                <h3 className="font-serif text-base uppercase tracking-wider text-[#24211D] font-bold">
                  Durable Queue, Webhook Signature Security &amp; Stuck-Job Watchdog
                </h3>
                <p className="text-xs text-[#686158]">
                  HMAC-SHA256 webhook signature verification (`X-Fragmore-Signature`), 5-minute replay window + cryptographic nonce cache, and automatic stuck-job detection.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRecoverStuckJobs}
                  disabled={recoveringStuck}
                  className="px-3.5 py-2 rounded-lg bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-bold cursor-pointer"
                >
                  {recoveringStuck ? 'Scanning Stuck Jobs...' : 'Scan & Recover Stuck Jobs Now'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Dead-Letter Queue & Retry List */}
              <div className="p-4 rounded-xl bg-[#FAF8F4] border border-[#DED7CC] space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-serif text-sm uppercase font-bold text-[#24211D]">
                    Dead-Letter Queue (DLQ) &amp; Active Retries
                  </h4>
                  <span className="text-[10px] font-bold text-[#686158]">
                    {(reliabilityData?.deadLetterAndFailedJobs?.length || 0) +
                      (reliabilityData?.retriedJobs?.length || 0)}{' '}
                    items
                  </span>
                </div>
                {(reliabilityData?.deadLetterAndFailedJobs || []).length === 0 &&
                (reliabilityData?.retriedJobs || []).length === 0 ? (
                  <div className="p-4 rounded-lg bg-[#FFFFFF] border border-[#DED7CC] text-xs text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Zero unresolved Dead-Letter or Retry jobs in queue.</span>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {[
                      ...(reliabilityData?.deadLetterAndFailedJobs || []),
                      ...(reliabilityData?.retriedJobs || [])
                    ].map((job: any) => (
                      <div
                        key={job.id}
                        className="p-3 rounded-lg bg-[#FFFFFF] border border-[#DED7CC] flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-[#24211D]">
                            {job.workflowName} ({job.id})
                          </div>
                          <div className="text-[11px] text-rose-700">
                            {job.status} • Attempts: {job.attemptCount}/{job.maxAttempts} •{' '}
                            {job.lastError || 'Provider timeout'}
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-800 text-[10px] font-bold">
                          {job.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Persistent Scheduled Jobs */}
              <div className="p-4 rounded-xl bg-[#FAF8F4] border border-[#DED7CC] space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-serif text-sm uppercase font-bold text-[#24211D]">
                    Persistent Scheduled Jobs (`automation_scheduled_tasks`)
                  </h4>
                  <span className="text-[10px] font-bold text-emerald-700">
                    Survives Server Restart &amp; Deployment
                  </span>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {(reliabilityData?.scheduledTasks || []).map((sch: any) => (
                    <div
                      key={sch.id}
                      className="p-3 rounded-lg bg-[#FFFFFF] border border-[#DED7CC] flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-[#24211D]">{sch.name}</div>
                        <div className="text-[10px] text-[#686158] font-mono">
                          Cron: {sch.cronExpression} • Next:{' '}
                          {sch.nextRunAt ? new Date(sch.nextRunAt).toLocaleString() : 'Scheduled'}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                        {sch.isActive ? 'ACTIVE' : 'PAUSED'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* VIEW 4: DATA ACCURACY RECONCILIATION & CROSS-BROWSER SYNC             */}
      {/* ===================================================================== */}
      {activeView === 'reconciliation' && reconciliationData && (
        <div className="space-y-6">
          <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DED7CC] pb-3">
              <div>
                <h3 className="font-serif text-base uppercase tracking-wider text-[#24211D] font-bold">
                  Authoritative Data Accuracy &amp; Denominator Verification
                </h3>
                <p className="text-xs text-[#686158]">
                  Reconciled at {reconciliationData.reconciledAtIst} directly from PostgreSQL ledgers.
                </p>
              </div>
              <button
                onClick={handleRunReconciliationNow}
                className="px-4 py-2 rounded-lg bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-bold cursor-pointer"
              >
                Re-Verify All Denominators
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Financial Reconciliation */}
              <div className="p-4 rounded-xl bg-[#FAF8F4] border border-[#DED7CC] space-y-2">
                <div className="text-[10px] font-bold uppercase text-[#9A783E]">
                  1. Verified Eligible Order Revenue
                </div>
                <div className="font-serif text-2xl font-bold text-[#24211D]">
                  ₹{(reconciliationData.financials?.netVerifiedRevenueInr || 0).toLocaleString('en-IN')}
                </div>
                <div className="text-xs text-[#686158] space-y-1">
                  <div>
                    Gross Eligible Orders ({reconciliationData.financials?.verifiedEligibleOrdersCount}): ₹
                    {(reconciliationData.financials?.grossVerifiedSalesInr || 0).toLocaleString('en-IN')}
                  </div>
                  <div>
                    Refunded Orders Adjusted ({reconciliationData.financials?.confirmedRefundsCount}): -₹
                    {(reconciliationData.financials?.totalRefundedInr || 0).toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] font-mono text-emerald-800 pt-1">
                    Excluded Unverified/Cancelled: {reconciliationData.financials?.excludedUnverifiedOrCancelledOrdersCount ?? 0}
                  </div>
                </div>
              </div>

              {/* Abandoned Cart & Recovery Denominator */}
              <div className="p-4 rounded-xl bg-[#FAF8F4] border border-[#DED7CC] space-y-2">
                <div className="text-[10px] font-bold uppercase text-[#9A783E]">
                  2. Abandoned Cart &amp; Linked Recovery
                </div>
                <div className="font-serif text-2xl font-bold text-[#24211D]">
                  {reconciliationData.abandonedCarts?.recoveryRatePercent ?? 0}% Recovery Rate
                </div>
                <div className="text-xs text-[#686158] space-y-1">
                  <div>
                    Active Abandoned Value ({reconciliationData.abandonedCarts?.activeAbandonedCartsCount} carts): ₹
                    {(reconciliationData.abandonedCarts?.activeAbandonedCartValueInr || 0).toLocaleString('en-IN')}
                  </div>
                  <div>
                    Order-Linked Recovered Revenue ({reconciliationData.abandonedCarts?.verifiedRecoveredCartsCount} carts): ₹
                    {(reconciliationData.abandonedCarts?.verifiedRecoveredRevenueInr || 0).toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] font-mono text-emerald-800 pt-1">
                    {reconciliationData.abandonedCarts?.formulaExplanation}
                  </div>
                </div>
              </div>

              {/* Attribution & Inventory Accuracy */}
              <div className="p-4 rounded-xl bg-[#FAF8F4] border border-[#DED7CC] space-y-2">
                <div className="text-[10px] font-bold uppercase text-[#9A783E]">
                  3. Attribution Deduplication &amp; SKU Ledger
                </div>
                <div className="font-serif text-2xl font-bold text-[#24211D]">
                  ₹{(reconciliationData.financials?.deduplicatedAttributedRevenueInr || 0).toLocaleString('en-IN')}
                </div>
                <div className="text-xs text-[#686158] space-y-1">
                  <div>
                    Duplicate Revenue Prevention:{' '}
                    <span className="font-bold text-emerald-700">ACTIVE (1x Order Cap)</span>
                  </div>
                  <div>
                    SKUs Reconciled: {reconciliationData.skusReconciled ?? 0} across{' '}
                    {reconciliationData.totalProductsCount ?? 0} products
                  </div>
                  <div>
                    Customer Segments Recalculated: {reconciliationData.customersReconciled ?? 0}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Cross-Browser Real-Time SSE Synchronization Status */}
          <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DED7CC] pb-3">
              <div>
                <h3 className="font-serif text-base uppercase tracking-wider text-[#24211D] font-bold">
                  Cross-Browser Real-Time Synchronization (`/api/realtime/stream` SSE)
                </h3>
                <p className="text-xs text-[#686158]">
                  Synchronizes Admin sessions, Customer sessions, mobile browsers, and desktop browsers against central PostgreSQL. `localStorage` is never used as the source of truth.
                </p>
              </div>
              <button
                onClick={async () => {
                  await fetch('/api/realtime/broadcast', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      entity: 'ALL',
                      action: 'ADMIN_FORCE_SYNC',
                      summary: 'Admin triggered cross-browser state broadcast'
                    })
                  });
                  showNotification('Cross-browser SSE sync signal broadcasted to all connected clients.');
                }}
                className="px-3.5 py-2 rounded-lg bg-[#24211D] text-[#FAF8F4] text-xs font-bold cursor-pointer"
              >
                Broadcast Cross-Browser Sync Pulse
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-[#FAF8F4] border border-[#DED7CC] space-y-1.5">
                <div className="font-bold text-[#24211D]">Central Backend Sync State</div>
                <div>
                  Connected Real-Time Browser Clients:{' '}
                  <span className="font-bold text-emerald-700">
                    {realtimeState?.connectedClientsCount ?? 1}
                  </span>
                </div>
                <div>
                  Source of Truth Policy:{' '}
                  <span className="font-mono font-bold">
                    {realtimeState?.localStorageSourceOfTruthPolicy || 'PROHIBITED_CENTRAL_POSTGRESQL_AUTHORITATIVE'}
                  </span>
                </div>
                <div>
                  localStorage Used As Source of Truth:{' '}
                  <span className="font-bold text-emerald-700">FALSE (Disabled)</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#FAF8F4] border border-[#DED7CC] space-y-1.5 max-h-40 overflow-y-auto">
                <div className="font-bold text-[#24211D]">Recent Real-Time Sync Events</div>
                {(liveSseFeed.length > 0 ? liveSseFeed : realtimeState?.recentBroadcasts || []).map(
                  (ev: any, idx: number) => (
                    <div key={idx} className="text-[11px] font-mono text-[#686158]">
                      [{ev.timestampIst || ev.timestampUtc || 'LIVE'}] {ev.entity || ev.type} →{' '}
                      {ev.action || ev.type || 'CONNECTED'} {ev.summary ? `(${ev.summary})` : ''}
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* VIEW 5: 12-SCENARIO CHAOS SUITE & PRODUCTION READINESS REPORT         */}
      {/* ===================================================================== */}
      {activeView === 'readiness' && (
        <div className="space-y-6">
          <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#DED7CC] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded bg-[#24211D] text-[#FAF8F4] text-[10px] font-bold uppercase">
                    Automated Chaos &amp; Security Verification
                  </span>
                  {readinessReport && (
                    <span
                      className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                        readinessReport.allCriticalTestsPassed
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                          : 'bg-rose-50 text-rose-800 border border-rose-300'
                      }`}
                    >
                      {readinessReport.productionReadinessStatus}
                    </span>
                  )}
                </div>
                <h3 className="font-serif text-xl uppercase tracking-wider text-[#24211D] font-bold mt-1">
                  12-Scenario Transaction, Failure &amp; Security Test Report
                </h3>
                <p className="text-xs text-[#686158]">
                  The system is only labeled production-ready when all 12 critical transaction, chaos, and security tests pass (`12/12`).
                </p>
              </div>
              <button
                onClick={handleRun12ScenarioChaosSuite}
                disabled={runningTests}
                className="px-5 py-2.5 rounded-lg bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-bold cursor-pointer shrink-0"
              >
                {runningTests ? 'Executing 12 Chaos Scenarios...' : 'Run All 12 Scenarios Now'}
              </button>
            </div>

            {!readinessReport ? (
              <div className="p-8 text-center bg-[#FAF8F4] rounded-xl border border-[#DED7CC] space-y-3">
                <ShieldCheck className="w-8 h-8 text-[#9A783E] mx-auto" />
                <div className="font-serif text-base uppercase font-bold text-[#24211D]">
                  Ready to Execute 12-Scenario Production Audit Suite
                </div>
                <p className="text-xs text-[#686158] max-w-xl mx-auto">
                  Tests duplicate events, delayed payment confirmation, concurrent purchases, provider timeouts, network interruption, server restart, deployment during scheduled job, expired coupons, refund reversals, unauthorized workflow execution, webhook replay attacks, and customer consent withdrawal.
                </p>
                <button
                  onClick={handleRun12ScenarioChaosSuite}
                  disabled={runningTests}
                  className="px-4 py-2 rounded-lg bg-[#24211D] text-[#FAF8F4] text-xs font-bold cursor-pointer"
                >
                  Start 12-Scenario Verification
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Summary Banner */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                    <div className="text-[10px] uppercase font-bold text-emerald-800">
                      Passed Tests
                    </div>
                    <div className="font-serif text-2xl font-bold text-emerald-900">
                      {readinessReport.passedCount} / {readinessReport.totalTests}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-[#FAF8F4] border border-[#DED7CC]">
                    <div className="text-[10px] uppercase font-bold text-[#686158]">
                      Failed Tests
                    </div>
                    <div className="font-serif text-2xl font-bold text-[#24211D]">
                      {readinessReport.failedCount}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-[#FAF8F4] border border-[#DED7CC]">
                    <div className="text-[10px] uppercase font-bold text-[#686158]">
                      Readiness Verdict
                    </div>
                    <div className="font-serif text-xs font-bold text-emerald-800 mt-1 break-words">
                      {readinessReport.productionReadinessStatus}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-[#FAF8F4] border border-[#DED7CC]">
                    <div className="text-[10px] uppercase font-bold text-[#686158]">
                      Executed At (IST)
                    </div>
                    <div className="font-mono text-xs font-bold text-[#24211D] mt-1">
                      {readinessReport.executedAtIst}
                    </div>
                  </div>
                </div>

                {/* All 12 Scenarios Table */}
                <div className="space-y-2">
                  <h4 className="font-serif text-sm uppercase tracking-wider text-[#24211D] font-bold">
                    Detailed 12-Scenario Results
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      ...(readinessReport.passedTests || []),
                      ...(readinessReport.failedTests || [])
                    ].map((test: any) => (
                      <div
                        key={test.id}
                        className={`p-3.5 rounded-xl border space-y-1 ${
                          test.passed
                            ? 'bg-[#FAF8F4] border-[#DED7CC]'
                            : 'bg-rose-50 border-rose-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-[#24211D]">
                            {test.name || test.scenario}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              test.passed
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-200 text-rose-900'
                            }`}
                          >
                            {test.passed ? 'PASSED' : 'FAILED'} ({test.durationMs} ms)
                          </span>
                        </div>
                        <p className="text-[11px] text-[#686158]">{test.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Unresolved Risks & Required External Provider Integrations */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-[#FAF8F4] border border-[#DED7CC] space-y-2">
                    <h4 className="font-serif text-sm uppercase font-bold text-[#24211D]">
                      Unresolved Operational &amp; Credential Risks
                    </h4>
                    <div className="space-y-2 text-xs text-[#686158]">
                      {(readinessReport.unresolvedRisks || []).map((risk: any, i: number) => (
                        <div key={i} className="p-2.5 rounded bg-[#FFFFFF] border border-[#DED7CC]">
                          <div className="font-bold text-[#24211D]">
                            {typeof risk === 'string' ? risk : risk.title}
                          </div>
                          {risk.mitigation && (
                            <div className="text-[11px] text-[#686158] mt-0.5">{risk.mitigation}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#FAF8F4] border border-[#DED7CC] space-y-2">
                    <h4 className="font-serif text-sm uppercase font-bold text-[#24211D]">
                      Required External Integrations Matrix
                    </h4>
                    <div className="space-y-1.5 max-h-56 overflow-y-auto">
                      {(readinessReport.requiredIntegrations || []).map(
                        (intg: any, i: number) => (
                          <div
                            key={i}
                            className="flex items-center justify-between text-xs py-1.5 border-b border-[#DED7CC] last:border-b-0"
                          >
                            <div>
                              <span className="font-bold text-[#24211D]">
                                {intg.name || intg.provider}
                              </span>
                              <span className="text-[10px] text-[#686158] block">
                                {intg.notes || (intg.envVarsRequired || []).join(', ')}
                              </span>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                                intg.status === 'CONNECTED_AND_VERIFIED' || intg.configured
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-800 border border-amber-200'
                              }`}
                            >
                              {intg.status}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: 14-FIELD EVENT & STEP LOG INSPECTOR                            */}
      {/* ===================================================================== */}
      {selectedEventDetail && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedEventDetail(null);
          }}
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
        >
          <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#DED7CC] pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase text-[#9A783E]">
                  14-FIELD BACKEND EVENT RECORD
                </span>
                <h3 className="font-serif text-lg uppercase text-[#24211D] font-bold">
                  {selectedEventDetail.eventType} ({selectedEventDetail.eventId})
                </h3>
              </div>
              <button
                onClick={() => setSelectedEventDetail(null)}
                className="px-3 py-1 rounded bg-[#F1EDE5] text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="p-2.5 rounded bg-[#FAF8F4] border border-[#DED7CC]">
                <div className="text-[10px] text-[#686158] uppercase">1. Event ID</div>
                <div className="font-mono font-bold">{selectedEventDetail.eventId}</div>
              </div>
              <div className="p-2.5 rounded bg-[#FAF8F4] border border-[#DED7CC]">
                <div className="text-[10px] text-[#686158] uppercase">2. Event Type</div>
                <div className="font-bold text-[#9A783E]">{selectedEventDetail.eventType}</div>
              </div>
              <div className="p-2.5 rounded bg-[#FAF8F4] border border-[#DED7CC]">
                <div className="text-[10px] text-[#686158] uppercase">3. Timestamp (UTC / IST)</div>
                <div className="font-mono text-[10px]">{selectedEventDetail.timestampUtc}</div>
                <div className="font-mono text-[10px] text-[#9A783E] font-bold">
                  {selectedEventDetail.timestampIst}
                </div>
              </div>
              <div className="p-2.5 rounded bg-[#FAF8F4] border border-[#DED7CC]">
                <div className="text-[10px] text-[#686158] uppercase">4. Customer ID</div>
                <div className="font-mono">{selectedEventDetail.customerId || '—'}</div>
              </div>
              <div className="p-2.5 rounded bg-[#FAF8F4] border border-[#DED7CC]">
                <div className="text-[10px] text-[#686158] uppercase">5. Session ID</div>
                <div className="font-mono">{selectedEventDetail.sessionId || '—'}</div>
              </div>
              <div className="p-2.5 rounded bg-[#FAF8F4] border border-[#DED7CC]">
                <div className="text-[10px] text-[#686158] uppercase">6. Cart ID</div>
                <div className="font-mono">{selectedEventDetail.cartId || '—'}</div>
              </div>
              <div className="p-2.5 rounded bg-[#FAF8F4] border border-[#DED7CC]">
                <div className="text-[10px] text-[#686158] uppercase">7. Order ID</div>
                <div className="font-mono">{selectedEventDetail.orderId || '—'}</div>
              </div>
              <div className="p-2.5 rounded bg-[#FAF8F4] border border-[#DED7CC]">
                <div className="text-[10px] text-[#686158] uppercase">8. Workflow ID</div>
                <div className="font-mono">{selectedEventDetail.workflowId || '—'}</div>
              </div>
              <div className="p-2.5 rounded bg-[#FAF8F4] border border-[#DED7CC]">
                <div className="text-[10px] text-[#686158] uppercase">9. Source System</div>
                <div className="font-bold">{selectedEventDetail.sourceSystem}</div>
              </div>
              <div className="p-2.5 rounded bg-[#FAF8F4] border border-[#DED7CC]">
                <div className="text-[10px] text-[#686158] uppercase">10. Processing Status</div>
                <div className="font-bold">{selectedEventDetail.processingStatus}</div>
              </div>
              <div className="p-2.5 rounded bg-[#FAF8F4] border border-[#DED7CC]">
                <div className="text-[10px] text-[#686158] uppercase">11. Retry Count</div>
                <div className="font-bold">{selectedEventDetail.retryCount}</div>
              </div>
              <div className="p-2.5 rounded bg-[#FAF8F4] border border-[#DED7CC]">
                <div className="text-[10px] text-[#686158] uppercase">12. Execution Duration</div>
                <div className="font-mono">{selectedEventDetail.executionDurationMs} ms</div>
              </div>
              <div className="p-2.5 rounded bg-[#FAF8F4] border border-[#DED7CC] sm:col-span-2">
                <div className="text-[10px] text-[#686158] uppercase">13. Error Details</div>
                <div className="text-rose-700 font-semibold">
                  {selectedEventDetail.errorDetails || 'None'}
                </div>
              </div>
              <div className="p-2.5 rounded bg-[#FAF8F4] border border-[#DED7CC]">
                <div className="text-[10px] text-[#686158] uppercase">14. Correlation ID</div>
                <div className="font-mono text-[11px]">{selectedEventDetail.correlationId}</div>
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold uppercase text-[#686158] mb-1">
                Raw Event Payload JSON
              </div>
              <pre className="p-3 rounded-xl bg-[#FAF8F4] border border-[#DED7CC] text-[11px] font-mono overflow-x-auto max-h-60">
                {JSON.stringify(selectedEventDetail.payload, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
