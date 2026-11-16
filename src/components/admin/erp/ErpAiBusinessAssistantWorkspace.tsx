import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  ShieldCheck,
  Bell,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  RefreshCw,
  Play,
  FileSpreadsheet,
  Sliders,
  Database,
  Calculator
} from 'lucide-react';
import { erpApi, downloadVerifiedExportFile } from '../../../lib/erpApi';
import { ErpTableExportBar } from './ErpUniversalExportModal';

interface Props {
  notify: (msg: string, type?: 'success' | 'error') => void;
  onChanged?: () => void;
}

interface AssistantTurn {
  id: string;
  prompt: string;
  timestamp: string;
  answer: string;
  modelUsed: string;
  actorRole: string;
  toolCallsExecuted: Array<{ toolName: string; status: string; summary: string }>;
  sourceRecords: Array<{
    entityType: string;
    id: string;
    referenceCode: string;
    label: string;
    moduleKey: string;
    details?: string;
  }>;
  assumptions: string[];
  calculations: Array<{ label: string; formula: string; result: string; unit?: string }>;
  pendingConfirmations: any[];
  generatedExport?: {
    id: string;
    jobNumber: string;
    reportTitle: string;
    format: string;
    rowCount: number;
    fileName: string;
    fileSizeBytes: number;
    downloadUrl: string | null;
  } | null;
}

const EXAMPLE_COMMANDS: Array<{ category: string; label: string; prompt: string }> = [
  { category: 'Inventory', label: 'Low-Stock Raw Materials', prompt: 'Show raw materials below reorder level.' },
  {
    category: 'Formulation',
    label: '300-Bottle BOM & Density Math',
    prompt: 'Calculate materials required for 300 bottles of a selected formulation.'
  },
  {
    category: 'Manufacturing',
    label: 'Latest Batch Cost / Bottle',
    prompt: 'Show production cost per bottle for the latest approved batch.'
  },
  { category: 'Procurement', label: 'Draft Purchase Requisition', prompt: 'Create a draft purchase requisition.' },
  { category: 'Sampling & QC', label: 'Samples Pending Feedback', prompt: 'List samples pending feedback.' },
  {
    category: 'Commercial',
    label: '200-Unit Corporate Proposal',
    prompt: 'Generate a corporate gifting proposal for 200 units.'
  },
  { category: 'Quotations', label: 'Customer GST Quotation', prompt: 'Create a quotation for an approved customer.' },
  { category: 'GST Billing', label: 'Overdue Customer Invoices', prompt: 'Show overdue customer invoices.' },
  { category: 'Accounting', label: 'Monthly Expense Summary', prompt: 'Summarize monthly expenses.' },
  {
    category: 'Exports',
    label: 'Export Production Report (.XLSX)',
    prompt: 'Export the production report to Excel.'
  },
  {
    category: 'Agency',
    label: 'Pending Creative Approvals',
    prompt: 'Show pending agency creative approvals.'
  },
  { category: 'Internships', label: 'Assign Intern Task', prompt: 'Assign a task to a department intern.' },
  {
    category: 'Safety Gate',
    label: 'Stage Stock Adjustment (Confirmation Gate)',
    prompt: 'Adjust stock by 2g for cycle count audit.'
  }
];

export const ErpAiBusinessAssistantWorkspace: React.FC<Props> = ({ notify, onChanged }) => {
  const [activeTab, setActiveTab] = useState<'COPILOT' | 'ALERTS' | 'VERIFICATION'>('COPILOT');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [downloadingJobId, setDownloadingJobId] = useState<string | null>(null);

  const [actor, setActor] = useState<any>(null);
  const [alertRules, setAlertRules] = useState<any[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
  const [pendingConfirmations, setPendingConfirmations] = useState<any[]>([]);
  const [auditReport, setAuditReport] = useState<any>(null);

  const [promptInput, setPromptInput] = useState('');
  const [history, setHistory] = useState<AssistantTurn[]>([]);
  const [selectedAlertCategory, setSelectedAlertCategory] = useState<string>('ALL');
  const [ruleEdits, setRuleEdits] = useState<Record<string, { thresholdDays: number; severity: string; isEnabled: boolean }>>({});

  const loadBootstrap = useCallback(async () => {
    setLoading(true);
    try {
      const data = await erpApi.getAssistantBootstrap();
      setActor(data.actor || null);
      setAlertRules(data.alertRules || []);
      setActiveAlerts(data.activeAlerts || []);
      setPendingConfirmations(data.pendingConfirmations || []);
      if (data.latestSystemAuditReport) {
        setAuditReport(data.latestSystemAuditReport);
      }
      const edits: Record<string, { thresholdDays: number; severity: string; isEnabled: boolean }> = {};
      for (const r of data.alertRules || []) {
        edits[r.ruleKey] = {
          thresholdDays: Number(r.thresholdDays ?? 0),
          severity: r.severity || 'HIGH',
          isEnabled: Boolean(r.isEnabled)
        };
      }
      setRuleEdits(edits);
    } catch (e: any) {
      notify(e?.message || 'Failed to load AI Business Assistant workspace', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadBootstrap();
  }, [loadBootstrap]);

  const executePrompt = async (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setBusy(true);
    try {
      const res = await erpApi.askAssistant(clean);
      const turn: AssistantTurn = {
        id: `${Date.now()}`,
        prompt: clean,
        timestamp: new Date().toLocaleTimeString(),
        answer: res.answer || '',
        modelUsed: res.modelUsed || 'gemini-4-hydrogen',
        actorRole: res.actorRole || actor?.roleCode || 'STAFF',
        toolCallsExecuted: res.toolCallsExecuted || [],
        sourceRecords: res.sourceRecords || [],
        assumptions: res.assumptions || [],
        calculations: res.calculations || [],
        pendingConfirmations: res.pendingConfirmations || [],
        generatedExport: res.generatedExport || null
      };
      setHistory((prev) => [turn, ...prev]);
      if (res.pendingConfirmations?.length) {
        notify('Consequential action staged — explicit authorized confirmation required before execution.');
      }
      await loadBootstrap();
      onChanged?.();
    } catch (e: any) {
      notify(e?.message || 'AI Assistant blocked or encountered an error', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmAction = async (confId: string) => {
    setBusy(true);
    try {
      const res = await erpApi.confirmAssistantAction(confId);
      notify(`Confirmed & executed ${res.confirmation?.confirmationCode || 'staged action'}.`);
      await loadBootstrap();
      onChanged?.();
    } catch (e: any) {
      notify(e?.message || 'Confirmation denied by RBAC policy', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleCancelAction = async (confId: string) => {
    setBusy(true);
    try {
      await erpApi.cancelAssistantAction(confId);
      notify('Staged action cancelled without modifying ERP ledgers.');
      await loadBootstrap();
    } catch (e: any) {
      notify(e?.message || 'Failed to cancel confirmation', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadGeneratedExport = async (exp: NonNullable<AssistantTurn['generatedExport']>) => {
    if (!exp.downloadUrl) {
      notify('Signed download link unavailable or expired.', 'error');
      return;
    }
    setDownloadingJobId(exp.id);
    try {
      const out = await downloadVerifiedExportFile(exp.downloadUrl, exp.fileName);
      notify(`Downloaded verified ${out.fileName} (${Math.max(1, Math.round(out.sizeBytes / 1024))} KB).`);
    } catch (e: any) {
      notify(e?.message || 'Export download failed', 'error');
    } finally {
      setDownloadingJobId(null);
    }
  };

  const handleSaveAlertRule = async (ruleKey: string) => {
    const edit = ruleEdits[ruleKey];
    if (!edit) return;
    setBusy(true);
    try {
      await erpApi.updateAlertRule(ruleKey, edit);
      notify(`Saved alert rule ${ruleKey} threshold & status.`);
      await loadBootstrap();
    } catch (e: any) {
      notify(e?.message || 'Failed to update alert rule', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleSyncAlerts = async () => {
    setBusy(true);
    try {
      const res = await erpApi.syncLiveAlertsToNotifications();
      setActiveAlerts(res.alerts || []);
      notify(`Evaluated ${res.alerts?.length || 0} live alerts and synced critical items to ERP notifications.`);
      onChanged?.();
    } catch (e: any) {
      notify(e?.message || 'Failed to sync alerts', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleRun10Workflows = async () => {
    setBusy(true);
    try {
      const res = await erpApi.runFinal10WorkflowAudit();
      setAuditReport(res.report);
      notify(
        `Completed 10-Workflow E2E Verification: ${res.report.passedWorkflowsCount}/${res.report.totalWorkflowsCount} passed.`
      );
      await loadBootstrap();
    } catch (e: any) {
      notify(e?.message || 'System verification requires SUPER_ADMIN privileges', 'error');
    } finally {
      setBusy(false);
    }
  };

  const openPendingConfirmations = pendingConfirmations.filter((c) => c.status === 'PENDING_CONFIRMATION');
  const filteredAlerts =
    selectedAlertCategory === 'ALL'
      ? activeAlerts
      : activeAlerts.filter((a) => a.ruleKey === selectedAlertCategory);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-[#DED7CC] pb-4">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-widest text-[#9A783E]">
            Module 17 · Role-Enforced Server Intelligence, Automated Alerts &amp; E2E Readiness
          </p>
          <h2 className="font-serif text-2xl sm:text-3xl text-[#24211D] uppercase tracking-wider mt-1">
            FRAGMORÉ AI Business Assistant
          </h2>
          <p className="text-xs text-[#686158] mt-1">
            Grounded strictly in live PostgreSQL records ({actor?.roleName || 'Authorized Role'} · {actor?.roleCode || 'RBAC'}) with source citations, unit calculations, and explicit confirmation gates.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: 'COPILOT', label: 'AI Business Copilot', icon: Sparkles },
              {
                id: 'ALERTS',
                label: `Automated Alerts (${activeAlerts.length})`,
                icon: Bell
              },
              {
                id: 'VERIFICATION',
                label: '10-Workflow Verification & Readiness',
                icon: ShieldCheck
              }
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`px-3.5 py-2 text-xs font-mono uppercase tracking-wider rounded border flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  active
                    ? 'bg-[#24211D] text-[#FAF8F4] border-[#24211D]'
                    : 'bg-[#FFFFFF] text-[#24211D] border-[#DED7CC] hover:border-[#9A783E]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            disabled={loading || busy}
            onClick={loadBootstrap}
            className="px-3 py-2 text-xs font-mono uppercase border border-[#DED7CC] bg-[#FFFFFF] hover:border-[#9A783E] rounded flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: AI BUSINESS COPILOT                                            */}
      {/* ===================================================================== */}
      {activeTab === 'COPILOT' && (
        <div className="space-y-6">
          {/* Safety & RBAC Governance Strip */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4">
              <div className="text-[10px] font-mono uppercase tracking-wider text-[#686158]">Active RBAC Session</div>
              <div className="text-sm font-semibold text-[#24211D] mt-1">
                {actor?.displayName || 'Authorized User'} · <span className="font-mono text-[#9A783E]">{actor?.roleCode || 'STAFF'}</span>
              </div>
              <p className="text-[11px] text-[#686158] mt-1">
                Every tool call validates module permissions &amp; formulation confidentiality on the server.
              </p>
            </div>
            <div className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4">
              <div className="text-[10px] font-mono uppercase tracking-wider text-[#686158]">Consequential Safety Gate</div>
              <div className="text-sm font-semibold text-[#24211D] mt-1 tabular-nums">
                {openPendingConfirmations.length} Pending Confirmation{openPendingConfirmations.length === 1 ? '' : 's'}
              </div>
              <p className="text-[11px] text-[#686158] mt-1">
                Stock adjustments, PO approvals, invoices, payments &amp; journals require explicit sign-off.
              </p>
            </div>
            <div className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4">
              <div className="text-[10px] font-mono uppercase tracking-wider text-[#686158]">Data Traceability</div>
              <div className="text-sm font-semibold text-[#24211D] mt-1">
                Source IDs + Validated Density Math
              </div>
              <p className="text-[11px] text-[#686158] mt-1">
                Never fabricates balances or assumes 1g = 1ml; cites live SKUs, lots, batches, and vouchers.
              </p>
            </div>
          </div>

          {/* Pending Explicit Confirmations Queue */}
          {openPendingConfirmations.length > 0 && (
            <div className="border border-[#9A783E] bg-[#FAF8F4] rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[#DED7CC] pb-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#9A783E]" />
                  <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-[#24211D]">
                    Authorized Confirmation Gate ({openPendingConfirmations.length} Awaiting Sign-Off)
                  </h3>
                </div>
                <span className="text-[10px] font-mono uppercase text-[#686158]">
                  No ledger mutation until confirmed
                </span>
              </div>
              <div className="space-y-2.5">
                {openPendingConfirmations.map((conf) => (
                  <div
                    key={conf.id}
                    className="border border-[#DED7CC] bg-[#FFFFFF] rounded p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 text-[10px] font-mono uppercase border border-[#9A783E] text-[#9A783E] rounded">
                          {conf.confirmationCode}
                        </span>
                        <span className="px-2 py-0.5 text-[10px] font-mono uppercase border border-[#DED7CC] text-[#24211D] rounded">
                          {conf.actionType}
                        </span>
                        <span className="text-[11px] font-mono text-[#686158]">
                          Requires {conf.requiredModule}:{conf.requiredAction}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-[#24211D]">{conf.actionTitle}</div>
                      <div className="text-xs text-[#686158]">{conf.actionSummary}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleConfirmAction(conf.id)}
                        className="px-3.5 py-2 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono uppercase rounded flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Confirm &amp; Execute</span>
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleCancelAction(conf.id)}
                        className="px-3 py-2 border border-[#DED7CC] bg-[#FFFFFF] hover:border-[#24211D] text-[#24211D] text-xs font-mono uppercase rounded whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 12 Authorized Example Commands Grid */}
          <div className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#686158] font-semibold">
                Cross-Module ERP Command Library (Click to Execute)
              </span>
              <span className="text-[10px] font-mono text-[#9A783E]">12 Core ERP Workflows + Safety Gate</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {EXAMPLE_COMMANDS.map((cmd, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setPromptInput(cmd.prompt);
                    executePrompt(cmd.prompt);
                  }}
                  className="p-2.5 border border-[#DED7CC] bg-[#FAF8F4] hover:bg-[#FFFFFF] hover:border-[#9A783E] rounded text-left transition-colors cursor-pointer group"
                >
                  <div className="text-[10px] font-mono uppercase tracking-wider text-[#9A783E]">
                    {cmd.category}
                  </div>
                  <div className="text-xs font-medium text-[#24211D] mt-0.5 truncate">{cmd.label}</div>
                  <div className="text-[11px] text-[#686158] truncate mt-0.5">{cmd.prompt}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Command Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              executePrompt(promptInput);
            }}
            className="flex flex-col sm:flex-row gap-2"
          >
            <input
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              placeholder="Enter an ERP command (e.g., Calculate materials required for 300 bottles of Golden Hour, or Show overdue customer invoices)..."
              className="flex-1 px-4 py-3 border border-[#DED7CC] bg-[#FFFFFF] rounded text-xs text-[#24211D] focus:border-[#9A783E] focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || !promptInput.trim()}
              className="px-5 py-3 bg-[#24211D] hover:bg-[#9A783E] disabled:opacity-50 text-[#FAF8F4] text-xs font-mono uppercase tracking-wider rounded flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{busy ? 'Executing Tools...' : 'Run ERP Command'}</span>
            </button>
          </form>

          {/* Traceable Execution History */}
          {history.length === 0 ? (
            <div className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-8 text-center space-y-2">
              <Database className="w-6 h-6 text-[#9A783E] mx-auto" />
              <div className="text-sm font-medium text-[#24211D]">Ready for Authorized ERP Commands</div>
              <p className="text-xs text-[#686158] max-w-xl mx-auto">
                Select any command above or enter a natural-language instruction. Every response includes verified PostgreSQL source records, explicit assumptions, and exact calculation formulas.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((item) => (
                <div key={item.id} className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-5 space-y-4">
                  {/* Prompt Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DED7CC] pb-3">
                    <div className="text-xs font-semibold text-[#24211D]">
                      <span className="font-mono text-[#9A783E] mr-2">COMMAND:</span>
                      {item.prompt}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-mono uppercase text-[#686158]">
                      <span className="px-2 py-0.5 border border-[#DED7CC] rounded">{item.actorRole}</span>
                      <span className="px-2 py-0.5 border border-[#DED7CC] rounded">{item.modelUsed}</span>
                      <span>{item.timestamp}</span>
                    </div>
                  </div>

                  {/* Narrative Summary */}
                  <div className="whitespace-pre-wrap text-xs text-[#24211D] leading-relaxed bg-[#FAF8F4] border border-[#DED7CC] rounded p-3.5">
                    {item.answer}
                  </div>

                  {/* Generated Export One-Click Download Card */}
                  {item.generatedExport && (
                    <div className="border border-[#9A783E] bg-[#FAF8F4] rounded p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <FileSpreadsheet className="w-5 h-5 text-[#9A783E] shrink-0" />
                        <div>
                          <div className="text-xs font-semibold text-[#24211D]">
                            {item.generatedExport.reportTitle} ({item.generatedExport.format}) · {item.generatedExport.jobNumber}
                          </div>
                          <div className="text-[11px] text-[#686158] tabular-nums">
                            {item.generatedExport.rowCount} rows · {item.generatedExport.fileName} (
                            {Math.max(1, Math.round((item.generatedExport.fileSizeBytes || 0) / 1024))} KB)
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={downloadingJobId === item.generatedExport.id}
                        onClick={() => handleDownloadGeneratedExport(item.generatedExport!)}
                        className="px-3.5 py-2 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono uppercase rounded flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>
                          {downloadingJobId === item.generatedExport.id
                            ? 'Verifying...'
                            : `Download ${item.generatedExport.format}`}
                        </span>
                      </button>
                    </div>
                  )}

                  {/* Calculations & Unit Math */}
                  {item.calculations.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-[#686158] font-semibold">
                        <Calculator className="w-3.5 h-3.5 text-[#9A783E]" />
                        <span>Calculation Breakdown &amp; Validated Unit Math</span>
                      </div>
                      <div className="overflow-x-auto border border-[#DED7CC] rounded">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                            <tr>
                              <th className="py-2 px-3">Component / Metric</th>
                              <th className="py-2 px-3">Formula Applied</th>
                              <th className="py-2 px-3 text-right">Computed Result</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#DED7CC] tabular-nums">
                            {item.calculations.map((calc, cIdx) => (
                              <tr key={cIdx}>
                                <td className="py-2 px-3 font-medium text-[#24211D]">{calc.label}</td>
                                <td className="py-2 px-3 font-mono text-[11px] text-[#686158]">{calc.formula}</td>
                                <td className="py-2 px-3 text-right font-mono font-semibold text-[#24211D]">
                                  {calc.result}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Source Records & Assumptions */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="text-[11px] font-mono uppercase tracking-wider text-[#686158] font-semibold">
                        Verified Source Records ({item.sourceRecords.length})
                      </div>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {item.sourceRecords.map((sr, sIdx) => (
                          <div
                            key={sIdx}
                            className="border border-[#DED7CC] bg-[#FAF8F4] rounded px-3 py-2 text-xs flex items-start justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="font-medium text-[#24211D] truncate">{sr.label}</div>
                              {sr.details && <div className="text-[11px] text-[#686158]">{sr.details}</div>}
                            </div>
                            <span className="px-2 py-0.5 text-[10px] font-mono uppercase border border-[#DED7CC] bg-[#FFFFFF] text-[#9A783E] rounded shrink-0">
                              {sr.referenceCode}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-[11px] font-mono uppercase tracking-wider text-[#686158] font-semibold">
                        Assumptions &amp; Server Tool Trace
                      </div>
                      <div className="border border-[#DED7CC] bg-[#FAF8F4] rounded p-3 space-y-2 text-xs">
                        {item.assumptions.map((asmp, aIdx) => (
                          <div key={aIdx} className="text-[#24211D]">
                            • {asmp}
                          </div>
                        ))}
                        <div className="pt-2 border-t border-[#DED7CC] flex flex-wrap gap-1.5">
                          {item.toolCallsExecuted.map((tc, tIdx) => (
                            <span
                              key={tIdx}
                              className="px-2 py-0.5 text-[10px] font-mono border border-[#DED7CC] bg-[#FFFFFF] text-[#686158] rounded"
                            >
                              {tc.toolName} · {tc.status}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: AUTOMATED OPERATIONS ALERTS (10 CATEGORIES)                    */}
      {/* ===================================================================== */}
      {activeTab === 'ALERTS' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedAlertCategory('ALL')}
                className={`px-3 py-1.5 text-xs font-mono uppercase rounded border cursor-pointer whitespace-nowrap shrink-0 ${
                  selectedAlertCategory === 'ALL'
                    ? 'bg-[#24211D] text-[#FAF8F4] border-[#24211D]'
                    : 'bg-[#FFFFFF] text-[#24211D] border-[#DED7CC]'
                }`}
              >
                All Categories ({activeAlerts.length})
              </button>
              {alertRules.map((r) => {
                const cnt = activeAlerts.filter((a) => a.ruleKey === r.ruleKey).length;
                return (
                  <button
                    key={r.ruleKey}
                    type="button"
                    onClick={() => setSelectedAlertCategory(r.ruleKey)}
                    className={`px-2.5 py-1.5 text-[11px] font-mono uppercase rounded border cursor-pointer whitespace-nowrap shrink-0 ${
                      selectedAlertCategory === r.ruleKey
                        ? 'bg-[#24211D] text-[#FAF8F4] border-[#24211D]'
                        : 'bg-[#FFFFFF] text-[#24211D] border-[#DED7CC] hover:border-[#9A783E]'
                    }`}
                  >
                    {r.ruleKey.replace(/_/g, ' ')} ({cnt})
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ErpTableExportBar
                reportKey="custom_table"
                title="FRAGMORÉ Active Operational Alerts"
                customRows={filteredAlerts}
                notify={notify}
              />
              <button
                type="button"
                disabled={busy}
                onClick={handleSyncAlerts}
                className="px-3.5 py-2 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono uppercase rounded flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Sync Critical to Bell</span>
              </button>
            </div>
          </div>

          {/* Live Alerts Table */}
          <div className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                <tr>
                  <th className="py-2.5 px-3">Severity</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Alert &amp; Operational Context</th>
                  <th className="py-2.5 px-3">Reference</th>
                  <th className="py-2.5 px-3">Target / Due Date</th>
                  <th className="py-2.5 px-3 text-right">Metric</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DED7CC] tabular-nums">
                {filteredAlerts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[#686158]">
                      No active alerts triggered for this filter under your current role permissions.
                    </td>
                  </tr>
                ) : (
                  filteredAlerts.map((al) => (
                    <tr key={al.alertId} className="hover:bg-[#FAF8F4]/60">
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-mono uppercase rounded border ${
                            al.severity === 'CRITICAL'
                              ? 'border-red-700 text-red-800 bg-red-50'
                              : al.severity === 'HIGH'
                              ? 'border-[#9A783E] text-[#9A783E] bg-[#FAF8F4]'
                              : 'border-[#DED7CC] text-[#686158] bg-[#FFFFFF]'
                          }`}
                        >
                          {al.severity}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-[#686158]">{al.category}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-[#24211D]">{al.title}</div>
                        <div className="text-[11px] text-[#686158]">{al.description}</div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[#9A783E]">{al.entityRef}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-[#686158]">
                        {al.dueOrTriggerDate || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-[#24211D]">
                        {al.metricValue}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Configurable Alert Rules Matrix */}
          <div className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 border-b border-[#DED7CC] pb-2">
              <Sliders className="w-4 h-4 text-[#9A783E]" />
              <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-[#24211D]">
                Configurable Alert Thresholds &amp; Automation Rules (10 Categories)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                  <tr>
                    <th className="py-2 px-3">Rule Key &amp; Title</th>
                    <th className="py-2 px-3">Module</th>
                    <th className="py-2 px-3">Enabled</th>
                    <th className="py-2 px-3">Horizon / Grace (Days)</th>
                    <th className="py-2 px-3">Default Severity</th>
                    <th className="py-2 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DED7CC] tabular-nums">
                  {alertRules.map((r) => {
                    const edit = ruleEdits[r.ruleKey] || {
                      thresholdDays: r.thresholdDays,
                      severity: r.severity,
                      isEnabled: r.isEnabled
                    };
                    return (
                      <tr key={r.id}>
                        <td className="py-2 px-3">
                          <div className="font-medium text-[#24211D]">{r.title}</div>
                          <div className="font-mono text-[10px] text-[#686158]">{r.ruleKey}</div>
                        </td>
                        <td className="py-2 px-3 font-mono uppercase text-[11px] text-[#686158]">
                          {r.moduleKey}
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="checkbox"
                            checked={edit.isEnabled}
                            onChange={(e) =>
                              setRuleEdits({
                                ...ruleEdits,
                                [r.ruleKey]: { ...edit, isEnabled: e.target.checked }
                              })
                            }
                            className="accent-[#9A783E] cursor-pointer"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            min={0}
                            max={365}
                            value={edit.thresholdDays}
                            onChange={(e) =>
                              setRuleEdits({
                                ...ruleEdits,
                                [r.ruleKey]: { ...edit, thresholdDays: Number(e.target.value) }
                              })
                            }
                            className="w-20 px-2 py-1 border border-[#DED7CC] rounded bg-[#FAF8F4] font-mono text-xs"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <select
                            value={edit.severity}
                            onChange={(e) =>
                              setRuleEdits({
                                ...ruleEdits,
                                [r.ruleKey]: { ...edit, severity: e.target.value }
                              })
                            }
                            className="px-2 py-1 border border-[#DED7CC] rounded bg-[#FAF8F4] font-mono text-xs"
                          >
                            <option value="CRITICAL">CRITICAL</option>
                            <option value="HIGH">HIGH</option>
                            <option value="MEDIUM">MEDIUM</option>
                            <option value="INFO">INFO</option>
                          </select>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleSaveAlertRule(r.ruleKey)}
                            className="px-3 py-1 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-[11px] font-mono uppercase rounded whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            Save Rule
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: 10-WORKFLOW SYSTEM VERIFICATION & DEPLOYMENT READINESS         */}
      {/* ===================================================================== */}
      {activeTab === 'VERIFICATION' && (
        <div className="space-y-6">
          <div className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-[#9A783E]">
                Live PostgreSQL End-to-End Verification Suite
              </div>
              <h3 className="font-serif text-xl text-[#24211D] uppercase tracking-wider mt-0.5">
                10 Cross-Module ERP Workflows &amp; Storefront Integrity Audit
              </h3>
              <p className="text-xs text-[#686158] mt-1">
                Executes real ACID transactions across Procurement, Manufacturing, Sampling, Commercial CRM, AP/AR Accounting, RBAC, Exports, Row-Locked Concurrency, and User Revocation — then cleans up all test artifacts automatically.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {auditReport?.workflowResults && (
                <ErpTableExportBar
                  reportKey="custom_table"
                  title={`FRAGMORÉ 10-Workflow Verification Report (${auditReport.runId})`}
                  customRows={auditReport.workflowResults.map((w: any) => ({
                    workflowNumber: w.workflowNumber,
                    title: w.title,
                    status: w.passed ? 'PASSED' : 'FAILED',
                    durationMs: w.durationMs,
                    evidenceSummary: w.evidenceSummary
                  }))}
                  notify={notify}
                />
              )}
              <button
                type="button"
                disabled={busy}
                onClick={handleRun10Workflows}
                className="px-4 py-2.5 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono uppercase tracking-wider rounded flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                <span>{busy ? 'Running 10 Workflows...' : 'Run 10-Workflow E2E Suite'}</span>
              </button>
            </div>
          </div>

          {!auditReport ? (
            <div className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-8 text-center space-y-2">
              <ShieldCheck className="w-7 h-7 text-[#9A783E] mx-auto" />
              <div className="text-sm font-medium text-[#24211D]">
                Click &ldquo;Run 10-Workflow E2E Suite&rdquo; to execute live verification
              </div>
              <p className="text-xs text-[#686158] max-w-lg mx-auto">
                Requires SUPER_ADMIN privileges. Verifies all 10 business workflows against Firebase Firestore with zero pollution to storefront records.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 tabular-nums">
                <div className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4">
                  <div className="text-[10px] font-mono uppercase text-[#686158]">Workflows Passed</div>
                  <div className="text-2xl font-serif text-[#24211D] mt-1">
                    {auditReport.passedWorkflowsCount} / {auditReport.totalWorkflowsCount}
                  </div>
                  <div className="text-[11px] font-mono text-emerald-700 mt-0.5">
                    {auditReport.allPassed ? 'ALL CRITICAL WORKFLOWS VERIFIED' : 'CHECK FAILURES BELOW'}
                  </div>
                </div>
                <div className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4">
                  <div className="text-[10px] font-mono uppercase text-[#686158]">Audit Run Reference</div>
                  <div className="text-base font-mono font-semibold text-[#24211D] mt-1">
                    {auditReport.runId}
                  </div>
                  <div className="text-[11px] text-[#686158] mt-0.5">
                    Duration: {auditReport.totalDurationMs} ms
                  </div>
                </div>
                <div className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4">
                  <div className="text-[10px] font-mono uppercase text-[#686158]">Storefront Products</div>
                  <div className="text-2xl font-serif text-[#24211D] mt-1">
                    {auditReport.storefrontDataIntegrity?.productsCount}
                  </div>
                  <div className="text-[11px] text-[#686158] mt-0.5">Intact &amp; Untouched</div>
                </div>
                <div className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4">
                  <div className="text-[10px] font-mono uppercase text-[#686158]">Customers &amp; Orders</div>
                  <div className="text-2xl font-serif text-[#24211D] mt-1">
                    {auditReport.storefrontDataIntegrity?.customersCount} · {auditReport.storefrontDataIntegrity?.ordersCount}
                  </div>
                  <div className="text-[11px] text-emerald-700 font-mono mt-0.5">
                    {auditReport.storefrontDataIntegrity?.preservedIntact ? 'BASELINE PRESERVED' : 'CHECK COUNTS'}
                  </div>
                </div>
              </div>

              {/* 10 Workflow Results */}
              <div className="space-y-2.5">
                {auditReport.workflowResults?.map((wf: any) => (
                  <div key={wf.workflowNumber} className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {wf.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-700 shrink-0" />
                        )}
                        <span className="font-mono text-xs font-semibold text-[#9A783E]">
                          #{wf.workflowNumber}
                        </span>
                        <span className="text-xs font-semibold text-[#24211D]">{wf.title}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] font-mono tabular-nums">
                        <span className="text-[#686158]">{wf.durationMs} ms</span>
                        <span
                          className={`px-2 py-0.5 rounded border uppercase text-[10px] ${
                            wf.passed
                              ? 'border-emerald-700 text-emerald-800 bg-emerald-50'
                              : 'border-red-700 text-red-800 bg-red-50'
                          }`}
                        >
                          {wf.passed ? 'PASSED' : 'FAILED'}
                        </span>
                      </div>
                    </div>
                    <div className="text-xs font-mono text-[#686158] bg-[#FAF8F4] px-3 py-1.5 rounded border border-[#DED7CC]">
                      {wf.error ? `Error: ${wf.error}` : wf.evidenceSummary}
                    </div>
                    {wf.assertionsVerified?.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1">
                        {wf.assertionsVerified.map((asrt: string, idx: number) => (
                          <div key={idx} className="text-[11px] text-[#24211D]">
                            ✓ {asrt}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Readiness & Dependency Matrix */}
              {auditReport.readinessMatrix && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4 space-y-2">
                    <h4 className="text-xs font-mono uppercase tracking-wider font-semibold text-[#24211D] border-b border-[#DED7CC] pb-2">
                      Completed FRAGMORÉ BUSINESS OS Modules
                    </h4>
                    {auditReport.readinessMatrix.completedModules?.map((m: string, i: number) => (
                      <div key={i} className="text-xs text-[#24211D] leading-relaxed">
                        • {m}
                      </div>
                    ))}
                  </div>
                  <div className="space-y-4">
                    <div className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4 space-y-2">
                      <h4 className="text-xs font-mono uppercase tracking-wider font-semibold text-[#24211D] border-b border-[#DED7CC] pb-2">
                        Working Production Integrations
                      </h4>
                      {auditReport.readinessMatrix.workingIntegrations?.map((w: string, i: number) => (
                        <div key={i} className="text-xs text-[#24211D] leading-relaxed">
                          • {w}
                        </div>
                      ))}
                    </div>
                    <div className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4 space-y-2">
                      <h4 className="text-xs font-mono uppercase tracking-wider font-semibold text-[#9A783E] border-b border-[#DED7CC] pb-2">
                        External Credentials &amp; Statutory / Accountant Approvals
                      </h4>
                      {auditReport.readinessMatrix.externalCredentialsOrApprovalsRequired?.map(
                        (ext: string, i: number) => (
                          <div key={i} className="text-xs text-[#686158] leading-relaxed">
                            • {ext}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
