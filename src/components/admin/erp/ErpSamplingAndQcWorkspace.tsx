import React, { useState, useEffect, useCallback } from 'react';
import {
  FlaskConical,
  ShieldCheck,
  Printer,
  FileSpreadsheet,
  Truck,
  Check,
  AlertTriangle,
  RefreshCw,
  Plus,
  Lock,
  Sparkles,
  Award,
  Layers
} from 'lucide-react';
import {
  erpApi,
  downloadExcelSpreadsheet,
  downloadCsvFile,
  type ErpWorkspaceSnapshot,
  type ErpSamplingQcSnapshot
} from '../../../lib/erpApi';
import { SamplingQcPrintModal, type SamplingQcPrintDoc } from './SamplingQcPrintModal';
import { ErpTableExportBar } from './ErpUniversalExportModal';

interface Props {
  snapshot: ErpWorkspaceSnapshot;
  onRefresh: () => Promise<void>;
  notify: (msg: string, type?: 'success' | 'error') => void;
}

const STAGE_ORDER = [
  'REQUESTED',
  'APPROVED',
  'MATERIAL_ISSUED',
  'PREPARED',
  'TESTING',
  'FEEDBACK',
  'REVISION_REQUIRED',
  'APPROVED_FOR_DISPATCH',
  'DISPATCHED',
  'ARCHIVED'
];

export const ErpSamplingAndQcWorkspace: React.FC<Props> = ({ snapshot, onRefresh, notify }) => {
  const [sqSnap, setSqSnap] = useState<ErpSamplingQcSnapshot | null>(null);
  const [subTab, setSubTab] = useState<'samples' | 'qc' | 'distribution' | 'reports'>('samples');
  const [busy, setBusy] = useState(false);
  const [printDoc, setPrintDoc] = useState<SamplingQcPrintDoc | null>(null);

  // Filters & Selection
  const [purposeFilter, setPurposeFilter] = useState<string>('ALL');
  const [stageFilter, setStageFilter] = useState<string>('ALL');
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);

  // New Sample Request Form
  const [sampleForm, setSampleForm] = useState({
    purpose: 'INFLUENCER_SEEDING',
    formulationId: snapshot.formulations[0]?.id || '',
    formulationVersionId: '',
    fragranceName: '',
    quantityUnits: 3,
    volumeMl: 15,
    recipientName: '',
    recipientCompany: '',
    recipientEmail: '',
    recipientPhone: '',
    recipientAddress: '',
    leadId: '',
    marketingBriefId: '',
    influencerDeliverableId: '',
    vialCostInr: 144,
    labelCostInr: 45,
    packagingCostInr: 240,
    shippingCostInr: 0,
    handlingCostInr: 35,
    evaluationNotes: ''
  });

  // Active Sample Stage Transition Controls
  const [issueLotRows, setIssueLotRows] = useState<
    Array<{ materialId: string; lotId: string; qtyIssued: number; componentRole: 'CONCENTRATE' | 'SOLVENT' | 'VIAL' | 'LABEL' | 'PACKAGING' | 'OTHER' }>
  >([
    {
      materialId: snapshot.materials[0]?.id || '',
      lotId: snapshot.stockLots[0]?.id || '',
      qtyIssued: 0.05,
      componentRole: 'CONCENTRATE'
    }
  ]);
  const [dispatchForm, setDispatchForm] = useState({
    courierName: 'BlueDart Luxury Air',
    trackingNumber: '',
    recipientAddress: '',
    shippingCostInr: 240,
    handlingCostInr: 75,
    followUpDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  });
  const [feedbackForm, setFeedbackForm] = useState({
    olfactoryScore: 9.4,
    longevityHours: 11.5,
    feedbackStatus: 'RECEIVED_POSITIVE' as 'RECEIVED_POSITIVE' | 'REVISION_NEEDED' | 'CONVERTED' | 'NO_RESPONSE',
    feedbackSummary: '',
    overrideQcNote: ''
  });

  // QC Inspection & Configurable Checklist State
  const [qcViewMode, setQcViewMode] = useState<'records' | 'checklists'>('records');
  const [retestSourceQc, setRetestSourceQc] = useState<any | null>(null);
  const [qcForm, setQcForm] = useState({
    inspectionType: 'SAMPLE_EVALUATION',
    sampleId: '',
    batchId: '',
    checklistId: 'qchk-sample-01',
    subjectName: '',
    appearanceResult: 'CLEAR_HOMOGENEOUS',
    odourResult: 'CONFORMS_TO_MASTER',
    colourResult: 'MILD_GOLD_CLEAR',
    targetFillVolumeMl: 15,
    actualFillVolumeMl: 15.1,
    packagingInspectionResult: 'PASS',
    stabilityObservations: '24h cold-clarity check at 4°C clean; mild gold hue preserved.',
    abvTestedPct: 78.5,
    specificGravity: 0.846,
    refractiveIndex: 1.369,
    gcmsMatchPct: 99.4,
    microbiologyPass: true,
    decision: 'PASSED' as 'PASSED' | 'FAILED' | 'QUARANTINED',
    correctiveAction: '',
    supportingEvidenceRef: 'LAB-BENCH-2026-LOG',
    checklistResults: [] as Array<{ criterionId: string; parameter: string; targetSpec: string; measuredValue: string; isCritical: boolean; passed: boolean }>
  });

  // Configurable Checklist Creator State
  const [checklistForm, setChecklistForm] = useState({
    name: '',
    inspectionType: 'SAMPLE_EVALUATION',
    param1: 'Visual Mild Gold Clarity',
    spec1: 'Clear homogeneous solution, zero haze',
    param2: 'Fill Volume Tolerance (±3%)',
    spec2: '97% – 103% nominal fill'
  });

  // Retailer Conversion State
  const [convModalSample, setConvModalSample] = useState<any | null>(null);
  const [convForm, setConvForm] = useState({
    leadId: '',
    convertedToOrderId: '',
    conversionValueInr: 150000,
    feedbackSummary: 'Retailer / corporate buyer converted after sample testing.'
  });

  // Regulatory Compliance Authorization State (Explicit Documented Guardrail)
  const [authVersionId, setAuthVersionId] = useState<string>('');
  const [authForm, setAuthForm] = useState({
    ifraComplianceStatus: 'COMPLIANT' as 'COMPLIANT' | 'RESTRICTED' | 'NON_COMPLIANT',
    safetyStatus: 'SAFETY_VERIFIED' as 'SAFETY_VERIFIED' | 'FLAGGED',
    supportingEvidenceRef: '',
    ifraDossierRef: '',
    complianceNotes: ''
  });

  const loadSnapshot = useCallback(async () => {
    try {
      const s = await erpApi.getSamplingQcSnapshot();
      setSqSnap(s);
    } catch {
      // Fallback safely
    }
  }, []);

  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot, snapshot]);

  const samples = sqSnap?.samples || snapshot.samples;
  const qcRecords = sqSnap?.qcRecords || snapshot.qcRecords;
  const checklists = sqSnap?.checklists || [];
  const sampleEvents = sqSnap?.sampleEvents || [];
  const formulations = sqSnap?.formulations || snapshot.formulations;
  const formulationVersions = sqSnap?.formulationVersions || snapshot.formulationVersions;
  const materials = sqSnap?.materials || snapshot.materials;
  const lots = sqSnap?.lots || snapshot.stockLots;
  const leads = sqSnap?.leads || snapshot.leads;
  const marketingWorkspace = sqSnap?.marketingWorkspace || snapshot.marketingWorkspace;
  const influencerDeliverables = sqSnap?.influencerDeliverables || [];

  // Initialize checklist items when checklistId changes
  useEffect(() => {
    const chk = checklists.find((c) => c.id === qcForm.checklistId);
    if (chk && Array.isArray(chk.criteria)) {
      setQcForm((prev) => ({
        ...prev,
        checklistResults: chk.criteria.map((cr: any) => ({
          criterionId: cr.criterionId,
          parameter: cr.parameter,
          targetSpec: cr.expectedSpec,
          measuredValue: 'Conforms',
          isCritical: cr.isCritical !== false,
          passed: true
        }))
      }));
    }
  }, [qcForm.checklistId, checklists.length]);

  const runAction = async (fn: () => Promise<void>, okMsg: string) => {
    setBusy(true);
    try {
      await fn();
      await Promise.all([loadSnapshot(), onRefresh()]);
      notify(okMsg, 'success');
    } catch (err: any) {
      notify(err?.message || 'Action failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const selectedSample = samples.find((s) => s.id === selectedSampleId) || null;
  const filteredSamples = samples.filter((s) => {
    if (purposeFilter !== 'ALL' && (s.purpose || s.sampleType) !== purposeFilter) return false;
    if (stageFilter !== 'ALL' && (s.workflowStage || s.status) !== stageFilter) return false;
    return true;
  });

  const rdTotalSpend = sqSnap?.reports?.rdExpenditure?.grandTotalInr ?? samples.reduce((s, x) => s + Number(x.totalCostInr || 0), 0);
  const pendingFeedbackCount = sqSnap?.reports?.pendingFeedbackList?.length ?? 0;
  const qcRejectPct = sqSnap?.reports?.qcRejectionStats?.qcRejectionRatePct ?? 0;
  const openCapas = sqSnap?.reports?.qcRejectionStats?.openCapasCount ?? 0;
  const convertedRev = sqSnap?.reports?.retailerSampleConversion?.totalConversionRevenueInr ?? 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <SamplingQcPrintModal doc={printDoc} onClose={() => setPrintDoc(null)} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#DED7CC] pb-4">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-widest text-[#9A783E]">
            Module 06 · Sampling, R&amp;D &amp; Analytical QA
          </p>
          <h2 className="font-serif text-2xl sm:text-3xl text-[#24211D] uppercase tracking-wider mt-1">
            Sampling, R&amp;D &amp; Quality Control OS
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'samples', label: `Samples Pipeline (${samples.length})` },
            { id: 'qc', label: `QC & CAPA Lab (${qcRecords.length})` },
            { id: 'distribution', label: `Marketing & CRM Sync` },
            { id: 'reports', label: `Reports & Compliance Guard` }
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id as any)}
              className={`px-3 py-1.5 rounded text-xs font-mono whitespace-nowrap shrink-0 cursor-pointer ${
                subTab === t.id ? 'bg-[#24211D] text-[#FAF8F4]' : 'bg-[#FFFFFF] border border-[#DED7CC] text-[#24211D] hover:border-[#9A783E]'
              }`}
            >
              {t.label}
            </button>
          ))}
          <ErpTableExportBar
            reportKey={subTab === 'qc' ? 'qc_inspections' : 'sampling_register'}
            notify={notify}
          />
        </div>
      </div>

      {/* 5-Column Flat KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 border border-[#DED7CC] bg-[#FFFFFF] divide-y sm:divide-y-0 sm:divide-x divide-[#DED7CC] rounded-lg">
        <div className="p-4">
          <span className="text-[11px] font-mono uppercase text-[#686158] block">Total Samples / Units</span>
          <span className="text-xl font-mono font-bold text-[#24211D] tabular-nums">
            {samples.length} · {sqSnap?.reports?.sampleConsumption?.totalSampleUnits || samples.length} pcs
          </span>
        </div>
        <div className="p-4">
          <span className="text-[11px] font-mono uppercase text-[#686158] block">R&amp;D &amp; Seeding Spend</span>
          <span className="text-xl font-mono font-bold text-[#9A783E] tabular-nums">
            ₹{Math.round(rdTotalSpend).toLocaleString('en-IN')}
          </span>
        </div>
        <div className="p-4">
          <span className="text-[11px] font-mono uppercase text-[#686158] block">QC Rejection / CAPA</span>
          <span className={`text-xl font-mono font-bold tabular-nums ${qcRejectPct > 15 || openCapas > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
            {qcRejectPct}% · {openCapas} Open
          </span>
        </div>
        <div className="p-4">
          <span className="text-[11px] font-mono uppercase text-[#686158] block">Pending Feedback</span>
          <span className="text-xl font-mono font-bold text-[#24211D] tabular-nums">{pendingFeedbackCount}</span>
        </div>
        <div className="p-4">
          <span className="text-[11px] font-mono uppercase text-[#686158] block">B2B Sample Conversion</span>
          <span className="text-xl font-mono font-bold text-emerald-700 tabular-nums">
            ₹{Math.round(convertedRev).toLocaleString('en-IN')}
          </span>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: SAMPLES & 8-STAGE R&D WORKFLOW                                 */}
      {/* ===================================================================== */}
      {subTab === 'samples' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-3">
              <select
                value={purposeFilter}
                onChange={(e) => setPurposeFilter(e.target.value)}
                className="px-2.5 py-1.5 border border-[#DED7CC] rounded text-xs font-mono bg-[#FAF8F4]"
              >
                <option value="ALL">All 8 Sample Purposes</option>
                {(sqSnap?.purposes || []).map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.label}
                  </option>
                ))}
              </select>
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="px-2.5 py-1.5 border border-[#DED7CC] rounded text-xs font-mono bg-[#FAF8F4]"
              >
                <option value="ALL">All Workflow Stages</option>
                {STAGE_ORDER.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
              {selectedSampleId && (
                <button
                  onClick={() => setSelectedSampleId(null)}
                  className="ml-auto px-3 py-1.5 border border-[#DED7CC] rounded text-xs font-mono text-[#9A783E] hover:border-[#9A783E] cursor-pointer whitespace-nowrap shrink-0"
                >
                  + New Sample Request
                </button>
              )}
            </div>

            <div className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                  <tr>
                    <th className="py-2.5 px-3">Sample # / Stage</th>
                    <th className="py-2.5 px-3">Fragrance &amp; Purpose</th>
                    <th className="py-2.5 px-3">Recipient / Integration</th>
                    <th className="py-2.5 px-3 text-right">Total Cost / Unit</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DED7CC]">
                  {filteredSamples.map((s) => {
                    const stage = s.workflowStage || s.status;
                    const isSelected = selectedSampleId === s.id;
                    const fVer = formulationVersions.find((v) => v.id === s.formulationVersionId);
                    return (
                      <tr
                        key={s.id}
                        onClick={() => {
                          setSelectedSampleId(s.id);
                          setDispatchForm((prev) => ({
                            ...prev,
                            recipientAddress: s.recipientAddress || '',
                            courierName: s.courierName || prev.courierName,
                            trackingNumber: s.trackingNumber || '',
                            shippingCostInr: Number(s.shippingCostInr || 240),
                            handlingCostInr: Number(s.handlingCostInr || 75)
                          }));
                        }}
                        className={`cursor-pointer transition-colors ${isSelected ? 'bg-[#FAF8F4]' : 'hover:bg-[#FAF8F4]/70'}`}
                      >
                        <td className="py-2.5 px-3">
                          <span className="font-mono font-bold text-[#24211D] block">
                            {s.sampleNumber} {s.revisionNumber > 1 ? `(Rev ${s.revisionNumber})` : ''}
                          </span>
                          <span className="font-mono text-[10px] text-[#9A783E] font-semibold">{stage}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-medium text-[#24211D] block">{s.fragranceName}</span>
                          <span className="text-[10px] font-mono text-[#686158]">
                            {String(s.purpose || s.sampleType).replace(/_/g, ' ')} · {s.quantityUnits || 1} × {s.volumeMl}mL
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[#686158]">
                          <span className="block text-[#24211D]">{s.recipientName || 'Internal Atelier'}</span>
                          <span className="text-[10px] font-mono">
                            {s.trackingNumber ? `${s.courierName} · ${s.trackingNumber}` : `Feedback: ${s.feedbackStatus || 'PENDING'}`}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          <span className="font-bold text-[#24211D] block">₹{Number(s.totalCostInr || 0).toLocaleString('en-IN')}</span>
                          <span className="text-[10px] text-[#686158]">₹{Number(s.costPerSampleInr || 0).toFixed(0)}/unit</span>
                        </td>
                        <td className="py-2.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() =>
                              setPrintDoc({
                                type: 'SAMPLE_LABEL',
                                sample: s,
                                formulaVersion: fVer,
                                organization: snapshot.organization
                              })
                            }
                            className="px-2.5 py-1 border border-[#DED7CC] bg-[#FFFFFF] hover:border-[#9A783E] rounded text-[11px] font-mono inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                          >
                            <Printer className="w-3 h-3 text-[#9A783E]" />
                            <span>Label</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Column: Sample Stage Workflow Executor OR Create Request Form */}
          <div className="space-y-4">
            {selectedSample ? (
              <div className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4 space-y-4">
                <div className="flex items-start justify-between border-b border-[#DED7CC] pb-3">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-[#9A783E] block">
                      {selectedSample.sampleNumber} · {selectedSample.workflowStage}
                    </span>
                    <h3 className="font-serif text-base uppercase text-[#24211D]">{selectedSample.fragranceName}</h3>
                  </div>
                  <button
                    onClick={() => setSelectedSampleId(null)}
                    className="text-xs font-mono text-[#686158] hover:text-[#24211D] cursor-pointer"
                  >
                    New
                  </button>
                </div>

                {/* Costing Summary */}
                <div className="grid grid-cols-3 gap-2 border border-[#DED7CC] bg-[#FAF8F4] p-2.5 rounded font-mono text-[10px]">
                  <div>
                    <span className="text-[#686158] block">Raw Material</span>
                    <strong>₹{selectedSample.rawMaterialCostInr || 0}</strong>
                  </div>
                  <div>
                    <span className="text-[#686158] block">Vial+Lbl+Pkg</span>
                    <strong>
                      ₹{Number(selectedSample.vialCostInr || 0) + Number(selectedSample.labelCostInr || 0) + Number(selectedSample.packagingCostInr || 0)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#686158] block">Ship+Handl</span>
                    <strong>
                      ₹{Number(selectedSample.shippingCostInr || 0) + Number(selectedSample.handlingCostInr || 0)}
                    </strong>
                  </div>
                </div>

                {/* Stage Progression Buttons */}
                <div className="space-y-2">
                  <span className="text-[10px] font-mono uppercase text-[#686158] block">Execute Next Workflow Stage</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      disabled={busy}
                      onClick={() =>
                        runAction(
                          () => erpApi.advanceSampleWorkflow(selectedSample.id, { targetStage: 'APPROVED', expectedVersion: selectedSample.version }),
                          'Sample request approved.'
                        )
                      }
                      className="px-2.5 py-1.5 border border-[#DED7CC] hover:border-[#9A783E] rounded text-[11px] font-mono cursor-pointer whitespace-nowrap"
                    >
                      1. Approve Request
                    </button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        runAction(
                          () => erpApi.advanceSampleWorkflow(selectedSample.id, { targetStage: 'PREPARED', expectedVersion: selectedSample.version }),
                          'Marked sample prepared & filled.'
                        )
                      }
                      className="px-2.5 py-1.5 border border-[#DED7CC] hover:border-[#9A783E] rounded text-[11px] font-mono cursor-pointer whitespace-nowrap"
                    >
                      3. Mark Prepared
                    </button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        runAction(
                          () => erpApi.advanceSampleWorkflow(selectedSample.id, { targetStage: 'TESTING', expectedVersion: selectedSample.version }),
                          'Queued sample for QC evaluation.'
                        )
                      }
                      className="px-2.5 py-1.5 border border-[#DED7CC] hover:border-[#9A783E] rounded text-[11px] font-mono cursor-pointer whitespace-nowrap"
                    >
                      4. Send to QC Test
                    </button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        runAction(
                          () =>
                            erpApi.advanceSampleWorkflow(selectedSample.id, {
                              targetStage: 'APPROVED_FOR_DISPATCH',
                              overrideQcNote: feedbackForm.overrideQcNote || undefined,
                              expectedVersion: selectedSample.version
                            }),
                          'Approved sample for dispatch.'
                        )
                      }
                      className="px-2.5 py-1.5 border border-[#DED7CC] hover:border-[#9A783E] rounded text-[11px] font-mono cursor-pointer whitespace-nowrap"
                    >
                      6. Approve Dispatch
                    </button>
                  </div>
                </div>

                {/* Material Issue Lot Deduction Section */}
                {!selectedSample.materialIssued && (
                  <div className="border-t border-[#DED7CC] pt-3 space-y-2">
                    <span className="text-[10px] font-mono uppercase text-[#9A783E] block font-semibold">
                      2. Issue Raw Materials &amp; Packaging Lots
                    </span>
                    {issueLotRows.map((row, idx) => (
                      <div key={idx} className="grid grid-cols-3 gap-1.5">
                        <select
                          value={row.materialId}
                          onChange={(e) => {
                            const next = [...issueLotRows];
                            next[idx].materialId = e.target.value;
                            const firstLot = lots.find((l) => l.materialId === e.target.value && (l.availableQty ?? 0) > 0);
                            next[idx].lotId = firstLot?.id || '';
                            setIssueLotRows(next);
                          }}
                          className="col-span-2 px-2 py-1.5 border border-[#DED7CC] rounded text-[11px] bg-[#FAF8F4]"
                        >
                          {materials.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.currentStock} {m.uom})
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          step="0.005"
                          value={row.qtyIssued}
                          onChange={(e) => {
                            const next = [...issueLotRows];
                            next[idx].qtyIssued = Number(e.target.value);
                            setIssueLotRows(next);
                          }}
                          className="px-2 py-1.5 border border-[#DED7CC] rounded font-mono text-[11px] bg-[#FAF8F4]"
                        />
                      </div>
                    ))}
                    <button
                      disabled={busy}
                      onClick={() =>
                        runAction(
                          () =>
                            erpApi.advanceSampleWorkflow(selectedSample.id, {
                              targetStage: 'MATERIAL_ISSUED',
                              materialIssues: issueLotRows,
                              expectedVersion: selectedSample.version
                            }),
                          'Issued stock lots to sample & updated ledger.'
                        )
                      }
                      className="w-full py-2 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono uppercase rounded cursor-pointer"
                    >
                      Deduct Stock Lots &amp; Issue Materials
                    </button>
                  </div>
                )}

                {/* Feedback & Revision */}
                <div className="border-t border-[#DED7CC] pt-3 space-y-2">
                  <span className="text-[10px] font-mono uppercase text-[#686158] block">
                    5. Evaluation Feedback / Trigger Revision
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      step="0.1"
                      value={feedbackForm.olfactoryScore}
                      onChange={(e) => setFeedbackForm({ ...feedbackForm, olfactoryScore: Number(e.target.value) })}
                      placeholder="Score /10"
                      className="px-2 py-1.5 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
                    />
                    <input
                      type="number"
                      step="0.5"
                      value={feedbackForm.longevityHours}
                      onChange={(e) => setFeedbackForm({ ...feedbackForm, longevityHours: Number(e.target.value) })}
                      placeholder="Longevity hrs"
                      className="px-2 py-1.5 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
                    />
                  </div>
                  <input
                    value={feedbackForm.feedbackSummary}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, feedbackSummary: e.target.value })}
                    placeholder="Evaluator / recipient sensory notes..."
                    className="w-full px-2.5 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      disabled={busy}
                      onClick={() =>
                        runAction(
                          () =>
                            erpApi.advanceSampleWorkflow(selectedSample.id, {
                              targetStage: 'FEEDBACK',
                              ...feedbackForm,
                              expectedVersion: selectedSample.version
                            }),
                          'Recorded sample evaluation feedback.'
                        )
                      }
                      className="py-1.5 border border-[#DED7CC] hover:border-[#9A783E] text-[11px] font-mono rounded cursor-pointer"
                    >
                      Log Feedback
                    </button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        runAction(
                          () =>
                            erpApi.advanceSampleWorkflow(selectedSample.id, {
                              targetStage: 'REVISION_REQUIRED',
                              createRevisionSample: true,
                              revisionNotes: feedbackForm.feedbackSummary || 'Formula tweak iteration requested',
                              expectedVersion: selectedSample.version
                            }),
                          'Flagged revision & spawned next revision sample.'
                        )
                      }
                      className="py-1.5 border border-amber-300 bg-amber-50 text-amber-900 text-[11px] font-mono rounded cursor-pointer"
                    >
                      Spawn Revision
                    </button>
                  </div>
                </div>

                {/* Dispatch or Archive */}
                <div className="border-t border-[#DED7CC] pt-3 space-y-2">
                  <span className="text-[10px] font-mono uppercase text-[#686158] block">
                    7. Courier Dispatch / Archive
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={dispatchForm.courierName}
                      onChange={(e) => setDispatchForm({ ...dispatchForm, courierName: e.target.value })}
                      placeholder="Courier Name"
                      className="px-2 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                    />
                    <input
                      value={dispatchForm.trackingNumber}
                      onChange={(e) => setDispatchForm({ ...dispatchForm, trackingNumber: e.target.value })}
                      placeholder="AWB Tracking #"
                      className="px-2 py-1.5 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-mono text-[#686158]">Shipping ₹</label>
                      <input
                        type="number"
                        value={dispatchForm.shippingCostInr}
                        onChange={(e) => setDispatchForm({ ...dispatchForm, shippingCostInr: Number(e.target.value) })}
                        className="w-full px-2 py-1 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-mono text-[#686158]">Handling ₹</label>
                      <input
                        type="number"
                        value={dispatchForm.handlingCostInr}
                        onChange={(e) => setDispatchForm({ ...dispatchForm, handlingCostInr: Number(e.target.value) })}
                        className="w-full px-2 py-1 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      disabled={busy}
                      onClick={() =>
                        runAction(
                          () =>
                            erpApi.advanceSampleWorkflow(selectedSample.id, {
                              targetStage: 'DISPATCHED',
                              ...dispatchForm,
                              expectedVersion: selectedSample.version
                            }),
                          'Sample dispatched & synced with courier/CRM/marketing.'
                        )
                      }
                      className="py-2 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-[11px] font-mono uppercase rounded cursor-pointer"
                    >
                      Dispatch Sample
                    </button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        runAction(
                          () =>
                            erpApi.advanceSampleWorkflow(selectedSample.id, {
                              targetStage: 'ARCHIVED',
                              expectedVersion: selectedSample.version
                            }),
                          'Sample archived.'
                        )
                      }
                      className="py-2 border border-[#DED7CC] text-[11px] font-mono uppercase rounded cursor-pointer"
                    >
                      Archive
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  runAction(async () => {
                    await erpApi.createSampleRequest(sampleForm);
                    setSampleForm((prev) => ({
                      ...prev,
                      fragranceName: '',
                      recipientName: '',
                      recipientCompany: '',
                      recipientEmail: '',
                      recipientAddress: '',
                      evaluationNotes: ''
                    }));
                  }, 'New sample R&D request created cleanly.');
                }}
                className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4 space-y-3"
              >
                <h3 className="text-xs font-mono uppercase font-semibold text-[#24211D] border-b border-[#DED7CC] pb-2">
                  Create New Sample Request
                </h3>
                <div>
                  <label className="text-[10px] font-mono uppercase text-[#686158]">Sample Purpose</label>
                  <select
                    value={sampleForm.purpose}
                    onChange={(e) => setSampleForm({ ...sampleForm, purpose: e.target.value })}
                    className="w-full px-2.5 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                  >
                    {(sqSnap?.purposes || [
                      { code: 'NEW_FORMULA_DEV', label: 'New Perfume Formulation Development' },
                      { code: 'FORMULA_REVISION', label: 'Formula Revisions' },
                      { code: 'CUSTOMER_TRIAL', label: 'Customer Trials' },
                      { code: 'INFLUENCER_SEEDING', label: 'Influencer Seeding' },
                      { code: 'RETAILER_TESTING', label: 'Retailer & Distributor Testing' },
                      { code: 'CORPORATE_PROPOSAL', label: 'Corporate Proposals' },
                      { code: 'PERFUME_BAR_DEMO', label: 'Perfume Bar Demonstrations' },
                      { code: 'INTERNAL_QC', label: 'Internal Quality Evaluation' }
                    ]).map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <select
                  value={sampleForm.formulationId}
                  onChange={(e) => {
                    const frm = formulations.find((f) => f.id === e.target.value);
                    const ver = formulationVersions.find((v) => v.formulationId === e.target.value);
                    setSampleForm({
                      ...sampleForm,
                      formulationId: e.target.value,
                      formulationVersionId: ver?.id || '',
                      fragranceName: frm ? `${frm.name} (${sampleForm.volumeMl}mL Sample)` : sampleForm.fragranceName
                    });
                  }}
                  className="w-full px-2.5 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                >
                  <option value="">— Link Master Formulation (Optional) —</option>
                  {formulations.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.formulaCode} · {f.name} (v{f.activeVersionNumber})
                    </option>
                  ))}
                </select>
                <input
                  required
                  placeholder="Sample Fragrance Title *"
                  value={sampleForm.fragranceName}
                  onChange={(e) => setSampleForm({ ...sampleForm, fragranceName: e.target.value })}
                  className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-mono text-[#686158]">Units</label>
                    <input
                      type="number"
                      min={1}
                      value={sampleForm.quantityUnits}
                      onChange={(e) => setSampleForm({ ...sampleForm, quantityUnits: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-[#686158]">Volume (mL)</label>
                    <input
                      type="number"
                      min={1}
                      value={sampleForm.volumeMl}
                      onChange={(e) => setSampleForm({ ...sampleForm, volumeMl: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
                    />
                  </div>
                </div>
                <input
                  placeholder="Recipient / Influencer / Retailer Name"
                  value={sampleForm.recipientName}
                  onChange={(e) => setSampleForm({ ...sampleForm, recipientName: e.target.value })}
                  className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    placeholder="Recipient Email"
                    value={sampleForm.recipientEmail}
                    onChange={(e) => setSampleForm({ ...sampleForm, recipientEmail: e.target.value })}
                    className="px-2.5 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                  />
                  <input
                    placeholder="Phone"
                    value={sampleForm.recipientPhone}
                    onChange={(e) => setSampleForm({ ...sampleForm, recipientPhone: e.target.value })}
                    className="px-2.5 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                  />
                </div>
                {sampleForm.purpose === 'INFLUENCER_SEEDING' && (
                  <select
                    value={sampleForm.marketingBriefId}
                    onChange={(e) => setSampleForm({ ...sampleForm, marketingBriefId: e.target.value })}
                    className="w-full px-2.5 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                  >
                    <option value="">— Link Marketing Campaign Brief —</option>
                    {marketingWorkspace.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.briefCode} · {m.title}
                      </option>
                    ))}
                  </select>
                )}
                {['RETAILER_TESTING', 'CORPORATE_PROPOSAL'].includes(sampleForm.purpose) && (
                  <select
                    value={sampleForm.leadId}
                    onChange={(e) => setSampleForm({ ...sampleForm, leadId: e.target.value })}
                    className="w-full px-2.5 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                  >
                    <option value="">— Link CRM Lead / Account —</option>
                    {leads.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.leadNumber} · {l.companyName}
                      </option>
                    ))}
                  </select>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-mono text-[#686158]">Vial ₹</label>
                    <input
                      type="number"
                      value={sampleForm.vialCostInr}
                      onChange={(e) => setSampleForm({ ...sampleForm, vialCostInr: Number(e.target.value) })}
                      className="w-full px-2 py-1 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-[#686158]">Label ₹</label>
                    <input
                      type="number"
                      value={sampleForm.labelCostInr}
                      onChange={(e) => setSampleForm({ ...sampleForm, labelCostInr: Number(e.target.value) })}
                      className="w-full px-2 py-1 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-[#686158]">Pkg ₹</label>
                    <input
                      type="number"
                      value={sampleForm.packagingCostInr}
                      onChange={(e) => setSampleForm({ ...sampleForm, packagingCostInr: Number(e.target.value) })}
                      className="w-full px-2 py-1 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
                    />
                  </div>
                </div>
                <button
                  disabled={busy}
                  type="submit"
                  className="w-full py-2.5 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono uppercase rounded cursor-pointer"
                >
                  Submit Sample Request
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: QUALITY CONTROL, CHECKLISTS & CAPA RETESTING                   */}
      {/* ===================================================================== */}
      {subTab === 'qc' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQcViewMode('records')}
                className={`px-3 py-1.5 rounded text-xs font-mono cursor-pointer ${
                  qcViewMode === 'records' ? 'bg-[#24211D] text-[#FAF8F4]' : 'bg-[#FFFFFF] border border-[#DED7CC]'
                }`}
              >
                QC Inspection &amp; CAPA Log ({qcRecords.length})
              </button>
              <button
                onClick={() => setQcViewMode('checklists')}
                className={`px-3 py-1.5 rounded text-xs font-mono cursor-pointer ${
                  qcViewMode === 'checklists' ? 'bg-[#24211D] text-[#FAF8F4]' : 'bg-[#FFFFFF] border border-[#DED7CC]'
                }`}
              >
                Configurable QC Checklists ({checklists.length})
              </button>
            </div>

            {qcViewMode === 'records' ? (
              <div className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                    <tr>
                      <th className="py-2.5 px-3">QC # / Retest</th>
                      <th className="py-2.5 px-3">Subject &amp; Sensory</th>
                      <th className="py-2.5 px-3">Lab Assays</th>
                      <th className="py-2.5 px-3">Decision / CAPA</th>
                      <th className="py-2.5 px-3 text-right">COA / Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DED7CC]">
                    {qcRecords.map((q) => {
                      const coaEligible = q.decision === 'PASSED' && q.certificateNumber && q.approvedByEmail && q.supportingEvidenceRef;
                      return (
                        <tr key={q.id} className="hover:bg-[#FAF8F4]/70">
                          <td className="py-2.5 px-3 font-mono">
                            <strong className="text-[#24211D] block">{q.qcNumber}</strong>
                            <span className="text-[10px] text-[#686158]">
                              {q.retestOfQcId ? `Retest #${q.retestCount}` : q.inspectionType}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-medium block">{q.subjectName}</span>
                            <span className="text-[10px] font-mono text-[#686158]">
                              {q.appearanceResult || 'CLEAR'} · {q.colourResult || 'MILD GOLD'} · Fill {q.actualFillVolumeMl || '—'}mL
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono tabular-nums text-[11px]">
                            <span>GC-MS {q.gcmsMatchPct}% · {q.abvTestedPct}% ABV</span>
                            <span className="block text-[10px] text-[#686158]">SG {q.specificGravity} · RI {q.refractiveIndex}</span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px]">
                            <span className={q.decision === 'PASSED' ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                              {q.decision}
                            </span>
                            {q.capaStatus && q.capaStatus !== 'NONE' && (
                              <span className="block text-[10px] text-[#686158]">CAPA: {q.capaStatus}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right space-x-1.5">
                            {coaEligible && (
                              <button
                                onClick={() =>
                                  setPrintDoc({
                                    type: 'QC_CERTIFICATE',
                                    qcRecord: q,
                                    organization: snapshot.organization
                                  })
                                }
                                className="px-2 py-1 border border-[#DED7CC] hover:border-[#9A783E] rounded text-[10px] font-mono inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Printer className="w-3 h-3 text-[#9A783E]" />
                                <span>COA</span>
                              </button>
                            )}
                            {(q.decision === 'FAILED' || q.decision === 'QUARANTINED') && (
                              <button
                                onClick={() => {
                                  setRetestSourceQc(q);
                                  setQcForm((prev) => ({
                                    ...prev,
                                    inspectionType: q.inspectionType,
                                    sampleId: q.sampleId || '',
                                    batchId: q.batchId || '',
                                    checklistId: q.checklistId || prev.checklistId,
                                    subjectName: `${q.subjectName} (CAPA Retest)`
                                  }));
                                }}
                                className="px-2 py-1 border border-amber-300 bg-amber-50 text-amber-900 rounded text-[10px] font-mono inline-flex items-center gap-1 cursor-pointer"
                              >
                                <RefreshCw className="w-3 h-3" />
                                <span>Retest</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3">
                  {checklists.map((chk) => (
                    <div key={chk.id} className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4 space-y-2">
                      <div className="flex justify-between items-center border-b border-[#DED7CC] pb-2">
                        <div>
                          <span className="font-mono text-[10px] text-[#9A783E] uppercase">{chk.checklistCode} · {chk.inspectionType}</span>
                          <h4 className="font-serif text-sm uppercase text-[#24211D]">{chk.name}</h4>
                        </div>
                        <span className="text-[10px] font-mono text-[#686158]">
                          {(chk.criteria || []).length} Criteria
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {(chk.criteria || []).map((c: any) => (
                          <div key={c.criterionId} className="border border-[#DED7CC] bg-[#FAF8F4] rounded p-2">
                            <span className="font-semibold block">{c.parameter} {c.isCritical ? '(Critical)' : ''}</span>
                            <span className="text-[11px] font-mono text-[#686158]">{c.expectedSpec}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Checklist Form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    runAction(async () => {
                      await erpApi.upsertQcChecklist({
                        name: checklistForm.name,
                        inspectionType: checklistForm.inspectionType,
                        criteria: [
                          { criterionId: 'c1', parameter: checklistForm.param1, testMethod: 'Atelier Lab SOP', expectedSpec: checklistForm.spec1, isCritical: true },
                          { criterionId: 'c2', parameter: checklistForm.param2, testMethod: 'Gravimetric / Visual', expectedSpec: checklistForm.spec2, isCritical: true }
                        ]
                      });
                      setChecklistForm((prev) => ({ ...prev, name: '' }));
                    }, 'Custom QC checklist protocol saved.');
                  }}
                  className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4 space-y-3"
                >
                  <h4 className="text-xs font-mono uppercase font-semibold">Create Custom QC Checklist Protocol</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      required
                      placeholder="Checklist Protocol Name"
                      value={checklistForm.name}
                      onChange={(e) => setChecklistForm({ ...checklistForm, name: e.target.value })}
                      className="px-3 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                    />
                    <select
                      value={checklistForm.inspectionType}
                      onChange={(e) => setChecklistForm({ ...checklistForm, inspectionType: e.target.value })}
                      className="px-2.5 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                    >
                      <option value="SAMPLE_EVALUATION">SAMPLE_EVALUATION</option>
                      <option value="FINISHED_BATCH_RELEASE">FINISHED_BATCH_RELEASE</option>
                      <option value="IN_PROCESS_MACERATION">IN_PROCESS_MACERATION</option>
                      <option value="RAW_MATERIAL_INWARD">RAW_MATERIAL_INWARD</option>
                      <option value="STABILITY_AUDIT">STABILITY_AUDIT</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={checklistForm.param1}
                      onChange={(e) => setChecklistForm({ ...checklistForm, param1: e.target.value })}
                      className="px-2.5 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                    />
                    <input
                      value={checklistForm.spec1}
                      onChange={(e) => setChecklistForm({ ...checklistForm, spec1: e.target.value })}
                      className="px-2.5 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                    />
                  </div>
                  <button
                    disabled={busy}
                    type="submit"
                    className="px-4 py-2 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono uppercase rounded cursor-pointer"
                  >
                    Save Checklist Template
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Right Column: Detailed QC Lab Submission Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runAction(async () => {
                await erpApi.recordDetailedQc({
                  ...qcForm,
                  retestOfQcId: retestSourceQc?.id || undefined
                });
                setRetestSourceQc(null);
                setQcForm((prev) => ({ ...prev, subjectName: '', correctiveAction: '' }));
              }, 'Detailed QC record logged.');
            }}
            className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4 space-y-3 h-fit"
          >
            <div className="flex items-center justify-between border-b border-[#DED7CC] pb-2">
              <h3 className="text-xs font-mono uppercase font-semibold text-[#24211D]">
                {retestSourceQc ? `Retest ${retestSourceQc.qcNumber}` : 'Log Detailed QC Assay'}
              </h3>
              {retestSourceQc && (
                <button type="button" onClick={() => setRetestSourceQc(null)} className="text-[10px] font-mono text-rose-700 cursor-pointer">
                  Cancel Retest
                </button>
              )}
            </div>

            <select
              value={qcForm.sampleId}
              onChange={(e) => {
                const smp = samples.find((s) => s.id === e.target.value);
                setQcForm({
                  ...qcForm,
                  sampleId: e.target.value,
                  subjectName: smp ? `${smp.sampleNumber} — ${smp.fragranceName}` : qcForm.subjectName,
                  targetFillVolumeMl: smp?.volumeMl || qcForm.targetFillVolumeMl,
                  actualFillVolumeMl: smp?.volumeMl || qcForm.actualFillVolumeMl
                });
              }}
              className="w-full px-2.5 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
            >
              <option value="">— Optional Link to Sample —</option>
              {samples.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.sampleNumber} · {s.fragranceName}
                </option>
              ))}
            </select>

            <select
              value={qcForm.checklistId}
              onChange={(e) => setQcForm({ ...qcForm, checklistId: e.target.value })}
              className="w-full px-2.5 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
            >
              {checklists.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.checklistCode} · {c.name}
                </option>
              ))}
            </select>

            <input
              required
              placeholder="Inspection Subject Name *"
              value={qcForm.subjectName}
              onChange={(e) => setQcForm({ ...qcForm, subjectName: e.target.value })}
              className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
            />

            <div className="grid grid-cols-3 gap-2">
              <input
                value={qcForm.appearanceResult}
                onChange={(e) => setQcForm({ ...qcForm, appearanceResult: e.target.value })}
                placeholder="Appearance"
                className="px-2 py-1.5 border border-[#DED7CC] rounded text-[11px] bg-[#FAF8F4]"
              />
              <input
                value={qcForm.odourResult}
                onChange={(e) => setQcForm({ ...qcForm, odourResult: e.target.value })}
                placeholder="Odour"
                className="px-2 py-1.5 border border-[#DED7CC] rounded text-[11px] bg-[#FAF8F4]"
              />
              <input
                value={qcForm.colourResult}
                onChange={(e) => setQcForm({ ...qcForm, colourResult: e.target.value })}
                placeholder="Colour"
                className="px-2 py-1.5 border border-[#DED7CC] rounded text-[11px] bg-[#FAF8F4]"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] font-mono text-[#686158]">GC-MS %</label>
                <input
                  type="number"
                  step="0.1"
                  value={qcForm.gcmsMatchPct}
                  onChange={(e) => setQcForm({ ...qcForm, gcmsMatchPct: Number(e.target.value) })}
                  className="w-full px-2 py-1 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-[#686158]">ABV %</label>
                <input
                  type="number"
                  step="0.1"
                  value={qcForm.abvTestedPct}
                  onChange={(e) => setQcForm({ ...qcForm, abvTestedPct: Number(e.target.value) })}
                  className="w-full px-2 py-1 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-[#686158]">Fill mL</label>
                <input
                  type="number"
                  step="0.1"
                  value={qcForm.actualFillVolumeMl}
                  onChange={(e) => setQcForm({ ...qcForm, actualFillVolumeMl: Number(e.target.value) })}
                  className="w-full px-2 py-1 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
                />
              </div>
            </div>

            {qcForm.checklistResults.length > 0 && (
              <div className="space-y-1.5 border border-[#DED7CC] rounded p-2.5 bg-[#FAF8F4]">
                <span className="text-[10px] font-mono uppercase text-[#686158] block">Checklist Evaluation</span>
                {qcForm.checklistResults.map((cr, idx) => (
                  <label key={cr.criterionId} className="flex items-center justify-between text-[11px] gap-2">
                    <span className="truncate">{cr.parameter}</span>
                    <input
                      type="checkbox"
                      checked={cr.passed}
                      onChange={(e) => {
                        const next = [...qcForm.checklistResults];
                        next[idx].passed = e.target.checked;
                        setQcForm({ ...qcForm, checklistResults: next });
                      }}
                    />
                  </label>
                ))}
              </div>
            )}

            <input
              value={qcForm.supportingEvidenceRef}
              onChange={(e) => setQcForm({ ...qcForm, supportingEvidenceRef: e.target.value })}
              placeholder="Supporting Lab / Evidence Ref (Required for COA)"
              className="w-full px-2.5 py-1.5 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
            />

            <select
              value={qcForm.decision}
              onChange={(e) => setQcForm({ ...qcForm, decision: e.target.value as any })}
              className="w-full px-2.5 py-2 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
            >
              <option value="PASSED">PASSED (Eligible for COA Release)</option>
              <option value="FAILED">FAILED (Open CAPA &amp; Retest)</option>
              <option value="QUARANTINED">QUARANTINED (Hold Stock)</option>
            </select>

            {(qcForm.decision === 'FAILED' || qcForm.decision === 'QUARANTINED') && (
              <textarea
                required
                rows={2}
                placeholder="Mandatory Corrective Action (CAPA) *"
                value={qcForm.correctiveAction}
                onChange={(e) => setQcForm({ ...qcForm, correctiveAction: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-rose-300 rounded text-xs bg-rose-50/40"
              />
            )}

            <button
              disabled={busy}
              type="submit"
              className="w-full py-2.5 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono uppercase rounded cursor-pointer"
            >
              Record QC Sign-Off
            </button>
          </form>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: DISTRIBUTION, INFLUENCER MARKETING & CRM CONVERSION SYNC       */}
      {/* ===================================================================== */}
      {subTab === 'distribution' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Influencer Seeding <-> Marketing Agency Integration */}
            <div className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[#DED7CC] pb-2">
                <h3 className="text-xs font-mono uppercase font-semibold text-[#24211D]">
                  Influencer Seeding ↔ Marketing Agency Cost &amp; Briefs
                </h3>
                <span className="text-xs font-mono font-bold text-[#9A783E] tabular-nums">
                  ₹{(sqSnap?.reports?.influencerSampleCostReport?.totalSpendInr || 0).toLocaleString('en-IN')} Total
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                    <tr>
                      <th className="py-2 px-2.5">Sample / Creator</th>
                      <th className="py-2 px-2.5">Marketing Brief</th>
                      <th className="py-2 px-2.5 text-right">Itemized Cost</th>
                      <th className="py-2 px-2.5">Feedback</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DED7CC]">
                    {(sqSnap?.reports?.influencerSampleCostReport?.rows || []).map((row) => (
                      <tr key={row.sampleNumber}>
                        <td className="py-2 px-2.5">
                          <span className="font-mono font-bold block">{row.sampleNumber}</span>
                          <span className="text-[#686158]">{row.recipientName || 'Creator'}</span>
                        </td>
                        <td className="py-2 px-2.5 font-mono text-[11px]">
                          {row.marketingBriefCode || 'Standalone'}
                          {row.trackingNumber && <span className="block text-[10px] text-[#686158]">AWB {row.trackingNumber}</span>}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums font-bold">
                          ₹{Number(row.totalCostInr || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2 px-2.5 font-mono text-[10px]">{row.feedbackStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Retailer / B2B Sample <-> CRM Conversion */}
            <div className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[#DED7CC] pb-2">
                <h3 className="text-xs font-mono uppercase font-semibold text-[#24211D]">
                  Retailer &amp; Corporate Samples ↔ CRM Conversion
                </h3>
                <span className="text-xs font-mono font-bold text-emerald-700 tabular-nums">
                  {sqSnap?.reports?.retailerSampleConversion?.conversionRatePct || 0}% Conv · {sqSnap?.reports?.retailerSampleConversion?.roiMultiple || 0}x ROI
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                    <tr>
                      <th className="py-2 px-2.5">Sample / Buyer</th>
                      <th className="py-2 px-2.5 text-right">Sample Cost</th>
                      <th className="py-2 px-2.5 text-right">Order Value</th>
                      <th className="py-2 px-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DED7CC]">
                    {(sqSnap?.reports?.retailerSampleConversion?.rows || []).map((r) => (
                      <tr key={r.id}>
                        <td className="py-2 px-2.5">
                          <span className="font-mono font-bold block">{r.sampleNumber}</span>
                          <span className="text-[#686158]">{r.recipientCompany || r.recipientName || 'B2B Account'}</span>
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums">₹{Number(r.totalCostInr || 0).toLocaleString('en-IN')}</td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums font-bold text-emerald-700">
                          {Number(r.conversionValueInr || 0) > 0 ? `₹${Number(r.conversionValueInr).toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="py-2 px-2.5 text-right">
                          {r.feedbackStatus !== 'CONVERTED' ? (
                            <button
                              onClick={() => {
                                setConvModalSample(r);
                                setConvForm({
                                  leadId: r.leadId || '',
                                  convertedToOrderId: '',
                                  conversionValueInr: 185000,
                                  feedbackSummary: `Converted from ${r.sampleNumber}`
                                });
                              }}
                              className="px-2 py-1 border border-[#DED7CC] hover:border-[#9A783E] rounded text-[10px] font-mono cursor-pointer whitespace-nowrap"
                            >
                              Mark Converted
                            </button>
                          ) : (
                            <span className="text-[10px] font-mono text-emerald-700 font-semibold">CONVERTED</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {convModalSample && (
                <div className="border-t border-[#DED7CC] pt-3 space-y-2 bg-[#FAF8F4] p-3 rounded">
                  <span className="text-[10px] font-mono uppercase text-[#9A783E] block">
                    Link Commercial Order Conversion for {convModalSample.sampleNumber}
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      value={convForm.conversionValueInr}
                      onChange={(e) => setConvForm({ ...convForm, conversionValueInr: Number(e.target.value) })}
                      placeholder="Order Value ₹"
                      className="px-2.5 py-1.5 border border-[#DED7CC] rounded font-mono text-xs bg-[#FFFFFF]"
                    />
                    <input
                      value={convForm.convertedToOrderId}
                      onChange={(e) => setConvForm({ ...convForm, convertedToOrderId: e.target.value })}
                      placeholder="Order / Quote Ref"
                      className="px-2.5 py-1.5 border border-[#DED7CC] rounded font-mono text-xs bg-[#FFFFFF]"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setConvModalSample(null)} className="px-3 py-1 text-xs font-mono text-[#686158] cursor-pointer">
                      Cancel
                    </button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        runAction(async () => {
                          await erpApi.linkSampleConversion(convModalSample.id, convForm);
                          setConvModalSample(null);
                        }, 'Retailer/B2B sample conversion recorded.')
                      }
                      className="px-3 py-1.5 bg-[#24211D] text-[#FAF8F4] text-xs font-mono uppercase rounded cursor-pointer"
                    >
                      Save Conversion
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Pending Feedback Queue */}
          <div className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4 space-y-3">
            <h3 className="text-xs font-mono uppercase font-semibold text-[#24211D] border-b border-[#DED7CC] pb-2">
              Pending Sample Feedback &amp; Follow-Up Queue ({pendingFeedbackCount})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                  <tr>
                    <th className="py-2 px-3">Sample #</th>
                    <th className="py-2 px-3">Fragrance &amp; Purpose</th>
                    <th className="py-2 px-3">Recipient</th>
                    <th className="py-2 px-3">Dispatch / AWB</th>
                    <th className="py-2 px-3">Follow-Up Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DED7CC]">
                  {(sqSnap?.reports?.pendingFeedbackList || []).map((pf) => (
                    <tr key={pf.id}>
                      <td className="py-2 px-3 font-mono font-bold">{pf.sampleNumber}</td>
                      <td className="py-2 px-3">{pf.fragranceName} · {pf.purpose}</td>
                      <td className="py-2 px-3 text-[#686158]">{pf.recipientName}</td>
                      <td className="py-2 px-3 font-mono text-[11px]">{pf.dispatchDate || 'Not Dispatched'} {pf.trackingNumber ? `· ${pf.trackingNumber}` : ''}</td>
                      <td className={`py-2 px-3 font-mono text-[11px] ${pf.isOverdue ? 'text-rose-700 font-bold' : 'text-[#686158]'}`}>
                        {pf.followUpDate || '—'} {pf.isOverdue ? '(OVERDUE)' : ''}
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
      {/* TAB 4: 7 REPORTS + STRICT REGULATORY COMPLIANCE AUTHORIZATION GUARD   */}
      {/* ===================================================================== */}
      {subTab === 'reports' && (
        <div className="space-y-6">
          {/* 7 Report Export Deck */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                title: '1. Sample Development History',
                metric: `${sqSnap?.reports?.sampleDevelopmentHistory?.length || 0} R&D Trials`,
                rows: sqSnap?.reports?.sampleDevelopmentHistory || []
              },
              {
                title: '2. Sample Consumption Ledger',
                metric: `${sqSnap?.reports?.sampleConsumption?.totalSampleUnits || 0} Units (${sqSnap?.reports?.sampleConsumption?.totalSampleVolumeMl || 0} mL)`,
                rows: sqSnap?.reports?.sampleConsumption?.byPurpose || []
              },
              {
                title: '3. QC Rejection & CAPA Rate',
                metric: `${qcRejectPct}% Failed/Hold · ${openCapas} Open`,
                rows: qcRecords
              },
              {
                title: '4. Pending Feedback Report',
                metric: `${pendingFeedbackCount} Awaiting Response`,
                rows: sqSnap?.reports?.pendingFeedbackList || []
              },
              {
                title: '5. Influencer Sample Cost',
                metric: `₹${Math.round(sqSnap?.reports?.influencerSampleCostReport?.totalSpendInr || 0).toLocaleString('en-IN')}`,
                rows: sqSnap?.reports?.influencerSampleCostReport?.rows || []
              },
              {
                title: '6. Retailer Sample Conversion',
                metric: `${sqSnap?.reports?.retailerSampleConversion?.conversionRatePct || 0}% · ₹${Math.round(convertedRev).toLocaleString('en-IN')}`,
                rows: sqSnap?.reports?.retailerSampleConversion?.rows || []
              },
              {
                title: '7. Total R&D Expenditure',
                metric: `₹${Math.round(rdTotalSpend).toLocaleString('en-IN')}`,
                rows: sqSnap?.reports?.rdExpenditure ? [sqSnap.reports.rdExpenditure] : []
              }
            ].map((rep) => (
              <div key={rep.title} className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4 flex flex-col justify-between space-y-3">
                <div>
                  <span className="text-[11px] font-mono uppercase text-[#686158] block">{rep.title}</span>
                  <span className="text-base font-mono font-bold text-[#24211D] tabular-nums block mt-1">{rep.metric}</span>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-[#DED7CC]">
                  <button
                    onClick={() =>
                      setPrintDoc({
                        type: 'SAMPLING_QC_REPORT',
                        reportTitle: rep.title,
                        rows: rep.rows,
                        organization: snapshot.organization
                      })
                    }
                    className="flex-1 py-1.5 border border-[#DED7CC] hover:border-[#9A783E] rounded text-[11px] font-mono flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Printer className="w-3 h-3 text-[#9A783E]" />
                    <span>PDF</span>
                  </button>
                  <button
                    onClick={() => downloadExcelSpreadsheet(`${rep.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.xls`, rep.title, rep.rows)}
                    className="flex-1 py-1.5 border border-[#DED7CC] hover:border-[#9A783E] rounded text-[11px] font-mono flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3 h-3 text-[#9A783E]" />
                    <span>Excel</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Formulation Regulatory Compliance & Safety Authorization Desk */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4 space-y-3">
              <div className="border-b border-[#DED7CC] pb-2">
                <h3 className="text-xs font-mono uppercase font-semibold text-[#24211D]">
                  Formulation Regulatory &amp; Safety Evidence Registry
                </h3>
                <p className="text-xs text-[#686158] mt-0.5">
                  Formulations remain PENDING_EVIDENCE until an authorized signatory attaches supporting IFRA &amp; lab evidence.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                    <tr>
                      <th className="py-2 px-3">Formula / Version</th>
                      <th className="py-2 px-3">IFRA / Safety State</th>
                      <th className="py-2 px-3">Supporting Evidence &amp; Signatory</th>
                      <th className="py-2 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DED7CC]">
                    {formulationVersions.map((fv) => {
                      const parentF = formulations.find((f) => f.id === fv.formulationId);
                      const isVerified = fv.ifraComplianceStatus === 'COMPLIANT' && fv.regulatoryAuthorizationBy && fv.supportingEvidenceRef;
                      return (
                        <tr key={fv.id}>
                          <td className="py-2.5 px-3">
                            <span className="font-mono font-bold block">{parentF?.formulaCode || fv.formulationId} v{fv.versionNumber}</span>
                            <span className="text-[#686158]">{parentF?.name || 'Formulation'}</span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px]">
                            <span className={isVerified ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                              {fv.ifraComplianceStatus} · {fv.safetyStatus || 'UNVERIFIED'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-[#686158]">
                            {fv.supportingEvidenceRef ? (
                              <>
                                <span className="block text-[#24211D]">{fv.supportingEvidenceRef}</span>
                                <span className="text-[10px]">Dossier {fv.ifraDossierRef} · By {fv.regulatoryAuthorizationBy}</span>
                              </>
                            ) : (
                              <span>No documented regulatory evidence uploaded</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={() => setAuthVersionId(fv.id)}
                              className="px-2.5 py-1 border border-[#DED7CC] hover:border-[#9A783E] rounded text-[11px] font-mono cursor-pointer whitespace-nowrap"
                            >
                              Authorize
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!authVersionId) {
                  notify('Select a formulation version from the table first.', 'error');
                  return;
                }
                runAction(async () => {
                  await erpApi.authorizeFormulationCompliance(authVersionId, authForm);
                  setAuthForm((prev) => ({ ...prev, supportingEvidenceRef: '', ifraDossierRef: '', complianceNotes: '' }));
                }, 'Formulation compliance & safety authorized with documented evidence.');
              }}
              className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4 space-y-3 h-fit"
            >
              <h4 className="text-xs font-mono uppercase font-semibold border-b border-[#DED7CC] pb-2">
                Explicit Compliance Sign-Off
              </h4>
              <select
                value={authVersionId}
                onChange={(e) => setAuthVersionId(e.target.value)}
                className="w-full px-2.5 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              >
                <option value="">— Select Formulation Version —</option>
                {formulationVersions.map((fv) => {
                  const parentF = formulations.find((f) => f.id === fv.formulationId);
                  return (
                    <option key={fv.id} value={fv.id}>
                      {parentF?.formulaCode || ''} v{fv.versionNumber} ({fv.ifraComplianceStatus})
                    </option>
                  );
                })}
              </select>
              <select
                value={authForm.ifraComplianceStatus}
                onChange={(e) => setAuthForm({ ...authForm, ifraComplianceStatus: e.target.value as any })}
                className="w-full px-2.5 py-2 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
              >
                <option value="COMPLIANT">COMPLIANT (IFRA Verified)</option>
                <option value="RESTRICTED">RESTRICTED (Max Limit Applies)</option>
                <option value="NON_COMPLIANT">NON_COMPLIANT (Reformulate)</option>
              </select>
              <select
                value={authForm.safetyStatus}
                onChange={(e) => setAuthForm({ ...authForm, safetyStatus: e.target.value as any })}
                className="w-full px-2.5 py-2 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
              >
                <option value="SAFETY_VERIFIED">SAFETY_VERIFIED</option>
                <option value="FLAGGED">FLAGGED (Safety Hold)</option>
              </select>
              <input
                required
                placeholder="Supporting Lab / QC Evidence Ref ID *"
                value={authForm.supportingEvidenceRef}
                onChange={(e) => setAuthForm({ ...authForm, supportingEvidenceRef: e.target.value })}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
              />
              <input
                required
                placeholder="IFRA Dossier / Certificate Ref *"
                value={authForm.ifraDossierRef}
                onChange={(e) => setAuthForm({ ...authForm, ifraDossierRef: e.target.value })}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
              />
              <textarea
                rows={2}
                placeholder="Regulatory notes & dermal max concentration check"
                value={authForm.complianceNotes}
                onChange={(e) => setAuthForm({ ...authForm, complianceNotes: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              />
              <button
                disabled={busy}
                type="submit"
                className="w-full py-2.5 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono uppercase rounded cursor-pointer"
              >
                Record Authorized Sign-Off
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
