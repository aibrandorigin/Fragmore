import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../../context/StoreContext';
import {
  FlaskConical,
  Factory,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  X,
  Layers,
  ArrowRight,
  Lock,
  Boxes,
  Printer,
  GitBranch,
  Crown,
  Wrench
} from 'lucide-react';
import { erpApi, type ErpManufacturingSnapshot } from '../../lib/erpApi';
import { ManufacturingPrintModal, type MfgPrintDoc } from './erp/ManufacturingPrintModal';
import { ErpTableExportBar } from './erp/ErpUniversalExportModal';

const PIPELINE_STAGES = [
  { key: 'PLANNING', label: 'Planning', step: 1 },
  { key: 'AVAILABILITY_CHECK', label: 'Availability', step: 2 },
  { key: 'RESERVED', label: 'Reserved', step: 3 },
  { key: 'AUTHORIZED', label: 'Authorized', step: 4 },
  { key: 'MATERIAL_ISSUED', label: 'Dispensed', step: 5 },
  { key: 'MIXING', label: 'Mixing', step: 6 },
  { key: 'MATURATION', label: 'Maturation', step: 7 },
  { key: 'QC', label: 'Lab QC', step: 8 },
  { key: 'FILLING', label: 'Filling', step: 9 },
  { key: 'PACKING', label: 'Packing', step: 10 },
  { key: 'RELEASED', label: 'Released', step: 11 }
] as const;

type PipelineStageKey = (typeof PIPELINE_STAGES)[number]['key'];

export const AdminBatchProduction: React.FC = () => {
  const { showNotification } = useStore();
  const [activeTab, setActiveTab] = useState<'pipeline' | 'once' | 'traceability' | 'costing'>('pipeline');
  const [stageFilter, setStageFilter] = useState<string>('ALL');
  const [mfgSnap, setMfgSnap] = useState<ErpManufacturingSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [printDoc, setPrintDoc] = useState<MfgPrintDoc | null>(null);

  // Create Batch Plan Modal
  const [createBatchOpen, setCreateBatchOpen] = useState(false);
  const [batchForm, setBatchForm] = useState({
    formulationId: '',
    bottleSizePreset: '50',
    customBottleSizeMl: 50,
    sku: 'FRG-SIG-GH-050',
    plannedBottlesCount: 200,
    plannedJuiceUnit: 'l' as 'kg' | 'l',
    labourCostInr: 5600,
    overheadCostInr: 3600,
    notes: ''
  });

  // Execute Stage Modal
  const [stageModalBatch, setStageModalBatch] = useState<any | null>(null);
  const [weighingInputs, setWeighingInputs] = useState<Record<string, number>>({});
  const [stageExecForm, setStageExecForm] = useState({
    actualJuiceQty: 0,
    wastageQty: 0,
    holdingTankLocation: 'TANK-CHILL-04 (14°C)',
    macerationTargetDate: new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10),
    actualFilledBottlesCount: 0,
    rejectedBottlesCount: 0,
    reworkBottlesCount: 0,
    labourCostInr: 0,
    overheadCostInr: 0,
    notes: ''
  });

  // QC Modal
  const [qcModalBatch, setQcModalBatch] = useState<any | null>(null);
  const [qcForm, setQcForm] = useState({
    abvTestedPct: 80.2,
    gcmsMatchPct: 99.4,
    qcStatus: 'PASSED' as 'PENDING_QC' | 'PASSED' | 'FAILED' | 'QUARANTINED',
    labNotes: 'GC-MS chromatogram verified against master retention index. Clarity crystal clear.'
  });

  // Rework / Rejection Modal
  const [reworkModalBatch, setReworkModalBatch] = useState<any | null>(null);
  const [reworkForm, setReworkForm] = useState({
    rejectedQty: 2,
    reworkQty: 3,
    disposition: 'REWORK_RECOVERED' as 'REWORK_RECOVERED' | 'DESTROYED_SCRAP',
    reason: ''
  });

  // Once Collection State
  const [onceForm, setOnceForm] = useState({
    editionName: '',
    fragranceName: '',
    formulationId: '',
    bottleSizeMl: 50,
    declaredQuantity: 250,
    sku: '',
    notes: ''
  });
  const [confirmCloseEditionId, setConfirmCloseEditionId] = useState<string | null>(null);
  const [serialPreviewEdition, setSerialPreviewEdition] = useState<any | null>(null);

  // Traceability State
  const [traceBatchId, setTraceBatchId] = useState<string>('');
  const [traceReport, setTraceReport] = useState<any | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);

  const loadSnapshot = useCallback(async () => {
    try {
      const snap = await erpApi.getManufacturingSnapshot();
      setMfgSnap(snap);
      if (snap.formulations.length && !batchForm.formulationId) {
        const approved = snap.formulations.find((f) => f.status === 'APPROVED') || snap.formulations[0];
        if (approved) {
          setBatchForm((prev) => ({ ...prev, formulationId: approved.id }));
          setOnceForm((prev) => ({ ...prev, formulationId: approved.id, fragranceName: approved.name }));
        }
      }
      if (snap.batches.length && !traceBatchId) {
        setTraceBatchId(snap.batches[0].id);
      }
    } catch (e: any) {
      showNotification(e?.message || 'Failed to load manufacturing workspace.');
    } finally {
      setLoading(false);
    }
  }, [batchForm.formulationId, traceBatchId, showNotification]);

  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/realtime/stream');
      es.onmessage = (evt) => {
        try {
          const parsed = JSON.parse(evt.data);
          const ent = String(parsed?.entity || '');
          if (
            (parsed?.type === 'CROSS_BROWSER_SYNC' || parsed?.type === 'STATE_INVALIDATED') &&
            (ent.startsWith('erp_') || ent === 'production_batches' || ent.includes('inventory'))
          ) {
            loadSnapshot();
          }
        } catch {}
      };
    } catch {}
    return () => {
      if (es) es.close();
    };
  }, [loadSnapshot]);

  const loadTraceability = useCallback(
    async (bId: string) => {
      if (!bId) return;
      setTraceLoading(true);
      try {
        const data = await erpApi.getBatchTraceability(bId);
        setTraceReport(data);
      } catch (e: any) {
        showNotification(e?.message || 'Could not load batch traceability.');
      } finally {
        setTraceLoading(false);
      }
    },
    [showNotification]
  );

  useEffect(() => {
    if (activeTab === 'traceability' && traceBatchId) {
      loadTraceability(traceBatchId);
    }
  }, [activeTab, traceBatchId, loadTraceability]);

  const runAction = async (fn: () => Promise<void>, successMessage: string) => {
    setBusy(true);
    try {
      await fn();
      await loadSnapshot();
      showNotification(successMessage);
    } catch (e: any) {
      showNotification(e?.message || 'Operation failed');
    } finally {
      setBusy(false);
    }
  };

  const batches = mfgSnap?.batches || [];
  const formulations = mfgSnap?.formulations || [];
  const approvedFormulations = formulations.filter((f) => f.status === 'APPROVED');
  const onceEditions = mfgSnap?.onceEditions || [];
  const kpis = mfgSnap?.kpis;

  const getStageIdx = (stage?: string | null) => {
    const idx = PIPELINE_STAGES.findIndex((s) => s.key === (stage || 'PLANNING'));
    return idx >= 0 ? idx : 0;
  };

  const getNextStage = (batch: any): PipelineStageKey | null => {
    const cur = (batch.pipelineStage || (batch.releasedToInventory ? 'RELEASED' : 'PLANNING')) as PipelineStageKey;
    const idx = PIPELINE_STAGES.findIndex((s) => s.key === cur);
    if (idx < 0 || idx >= PIPELINE_STAGES.length - 1) return null;
    return PIPELINE_STAGES[idx + 1].key;
  };

  const openStageModal = (batch: any) => {
    const reqs = batch.materialRequirements || {};
    const initialWeights: Record<string, number> = {};
    for (const ing of reqs.ingredientReqs || []) {
      if (ing.materialId) {
        initialWeights[ing.materialId] = Number(ing.requiredQty || 0);
      }
    }
    setWeighingInputs(initialWeights);
    setStageExecForm({
      actualJuiceQty: Number(batch.actualJuiceQty || batch.plannedJuiceQty || 5),
      wastageQty: 0,
      holdingTankLocation: batch.holdingTankLocation || 'TANK-CHILL-04 (14°C)',
      macerationTargetDate: batch.macerationTargetDate || new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10),
      actualFilledBottlesCount: Number(batch.plannedBottlesCount || batch.finishedQuantity || 100),
      rejectedBottlesCount: Number(batch.rejectedBottlesCount || 0),
      reworkBottlesCount: Number(batch.reworkBottlesCount || 0),
      labourCostInr: Number(batch.labourCostInr || (batch.plannedBottlesCount || batch.finishedQuantity || 100) * 28),
      overheadCostInr: Number(batch.overheadCostInr || (batch.plannedBottlesCount || batch.finishedQuantity || 100) * 18),
      notes: ''
    });
    setStageModalBatch(batch);
  };

  const openBmrForBatch = async (batch: any) => {
    try {
      const tr = await erpApi.getBatchTraceability(batch.id);
      setPrintDoc({ type: 'BMR', batch, traceability: tr });
    } catch (e: any) {
      showNotification(e?.message || 'Unable to generate BMR.');
    }
  };

  const filteredBatches =
    stageFilter === 'ALL'
      ? batches
      : batches.filter((b) => (b.pipelineStage || (b.releasedToInventory ? 'RELEASED' : 'PLANNING')) === stageFilter);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <ManufacturingPrintModal doc={printDoc} onClose={() => setPrintDoc(null)} />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#DED7CC] pb-4">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-widest text-[#9A783E]">
            Module 05 · 11-Stage Manufacturing &amp; The Once Collection Vault
          </p>
          <h2 className="font-serif text-2xl sm:text-3xl text-[#24211D] uppercase tracking-wider mt-1">
            Batch Production &amp; Formulation Execution
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ErpTableExportBar
            reportKey={activeTab === 'costing' ? 'production_variance' : 'production_batches'}
            notify={(msg) => showNotification(msg)}
          />
          <button
            onClick={loadSnapshot}
            className="px-3 py-2 border border-[#DED7CC] bg-[#FFFFFF] hover:border-[#9A783E] text-[#24211D] text-xs font-mono rounded flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#9A783E]' : ''}`} />
            <span>Sync</span>
          </button>
          <button
            onClick={() => setPrintDoc({ type: 'COST_SHEET', batches })}
            className="px-3 py-2 border border-[#DED7CC] bg-[#FFFFFF] hover:border-[#9A783E] text-[#24211D] text-xs font-mono rounded flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-[#9A783E]" />
            <span>Cost Sheet PDF/XLS</span>
          </button>
          <button
            onClick={() => setCreateBatchOpen(true)}
            className="px-4 py-2 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono uppercase tracking-wider rounded flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Plan Batch</span>
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 border border-[#DED7CC] bg-[#FFFFFF] divide-y sm:divide-y-0 sm:divide-x divide-[#DED7CC] rounded-lg">
        <div className="p-4">
          <span className="text-[11px] font-mono uppercase text-[#686158] block">Active In-Progress Batches</span>
          <span className="text-xl font-mono font-bold text-[#24211D] tabular-nums">
            {kpis?.activeBatchesCount ?? batches.filter((b) => !b.releasedToInventory).length}
          </span>
        </div>
        <div className="p-4">
          <span className="text-[11px] font-mono uppercase text-[#686158] block">Released Batches</span>
          <span className="text-xl font-mono font-bold text-emerald-700 tabular-nums">
            {kpis?.releasedBatchesCount ?? batches.filter((b) => b.releasedToInventory).length}
          </span>
        </div>
        <div className="p-4">
          <span className="text-[11px] font-mono uppercase text-[#686158] block">The Once Collection (Sealed)</span>
          <span className="text-xl font-mono font-bold text-[#9A783E] tabular-nums">
            {onceEditions.length} ({onceEditions.filter((o) => o.status === 'PERMANENTLY_CLOSED').length} Sealed)
          </span>
        </div>
        <div className="p-4">
          <span className="text-[11px] font-mono uppercase text-[#686158] block">Total Movements Logged</span>
          <span className="text-xl font-mono font-bold text-[#24211D] tabular-nums">
            {kpis?.totalMovements ?? mfgSnap?.movements.length ?? 0}
          </span>
        </div>
      </div>

      {/* Primary Sub-Navigation */}
      <div className="flex items-center gap-2 border-b border-[#DED7CC] pb-3 overflow-x-auto">
        {[
          { id: 'pipeline', label: `11-Stage Execution (${batches.length})`, icon: Factory },
          { id: 'once', label: `The Once Collection (${onceEditions.length})`, icon: Crown },
          { id: 'traceability', label: 'Batch Traceability & Audit', icon: GitBranch },
          { id: 'costing', label: 'Cost Sheets & Reports', icon: Layers }
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-2 rounded text-xs font-mono flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === tab.id ? 'bg-[#24211D] text-[#FAF8F4]' : 'bg-[#FFFFFF] border border-[#DED7CC] text-[#24211D]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: 11-STAGE PRODUCTION PIPELINE */}
      {activeTab === 'pipeline' && (
        <div className="space-y-5">
          {/* Interactive 11-Stage Filter Bar */}
          <div className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-3 overflow-x-auto">
            <div className="flex items-center gap-1.5 min-w-max">
              <button
                onClick={() => setStageFilter('ALL')}
                className={`px-2.5 py-1.5 rounded text-[11px] font-mono whitespace-nowrap shrink-0 cursor-pointer ${
                  stageFilter === 'ALL' ? 'bg-[#9A783E] text-white font-semibold' : 'bg-[#FAF8F4] text-[#686158] border border-[#DED7CC]'
                }`}
              >
                All ({batches.length})
              </button>
              {PIPELINE_STAGES.map((st) => {
                const cnt = batches.filter(
                  (b) => (b.pipelineStage || (b.releasedToInventory ? 'RELEASED' : 'PLANNING')) === st.key
                ).length;
                return (
                  <button
                    key={st.key}
                    onClick={() => setStageFilter(st.key)}
                    className={`px-2.5 py-1.5 rounded text-[11px] font-mono whitespace-nowrap shrink-0 cursor-pointer ${
                      stageFilter === st.key
                        ? 'bg-[#24211D] text-[#FAF8F4] font-semibold'
                        : 'bg-[#FAF8F4] text-[#24211D] border border-[#DED7CC]'
                    }`}
                  >
                    {st.step}. {st.label} ({cnt})
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredBatches.map((b) => {
              const curStage = (b.pipelineStage || (b.releasedToInventory ? 'RELEASED' : 'PLANNING')) as PipelineStageKey;
              const stepIdx = getStageIdx(curStage) + 1;
              const nextStage = getNextStage(b);
              const lockSnap = b.lockedFormulaSnapshot || null;

              return (
                <div key={b.id} className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                        <span className="font-bold text-[#9A783E]">{b.batchNumber}</span>
                        {b.isOnceCollection && (
                          <span className="text-[#9A783E] font-bold inline-flex items-center gap-1">
                            <Crown className="w-3 h-3" /> ONCE COLLECTION
                          </span>
                        )}
                        <span className="text-[#686158]">·</span>
                        <span className="text-[#24211D] font-semibold">
                          Stage {stepIdx}/11: {curStage.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <h3 className="font-serif text-lg text-[#24211D] mt-0.5">
                        {b.productName} ({b.size})
                      </h3>
                      <p className="text-[11px] font-mono text-[#686158]">
                        SKU {b.sku} · {lockSnap ? `Locked ${lockSnap.formulaCode} v${lockSnap.versionNumber}` : 'Standard Atelier Run'} · Mfg {b.manufacturingDate}
                      </p>
                    </div>
                    <div className="text-right font-mono text-[11px]">
                      <span className={b.qcStatus === 'PASSED' ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                        QC: {b.qcStatus}
                      </span>
                      <span className="block text-[#24211D] tabular-nums mt-0.5 font-semibold">
                        {b.finishedQuantity} / {b.plannedBottlesCount || b.finishedQuantity} btls
                      </span>
                    </div>
                  </div>

                  {/* 11-Stage Progress Track */}
                  <div className="w-full h-1.5 bg-[#FAF8F4] border border-[#DED7CC] rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${curStage === 'RELEASED' ? 'bg-emerald-600' : 'bg-[#9A783E]'}`}
                      style={{ width: `${Math.round((stepIdx / 11) * 100)}%` }}
                    />
                  </div>

                  {/* Financials & Yield Row */}
                  <div className="grid grid-cols-4 gap-2 bg-[#FAF8F4] border border-[#DED7CC] rounded p-2.5 text-[11px] font-mono tabular-nums">
                    <div>
                      <span className="text-[#686158] block text-[10px]">Material</span>
                      <strong>₹{Number(b.materialCostInr || 0).toLocaleString('en-IN')}</strong>
                    </div>
                    <div>
                      <span className="text-[#686158] block text-[10px]">Packaging</span>
                      <strong>₹{Number(b.packagingCostInr || 0).toLocaleString('en-IN')}</strong>
                    </div>
                    <div>
                      <span className="text-[#686158] block text-[10px]">Total Batch</span>
                      <strong>₹{Number(b.actualTotalCostInr || 0).toLocaleString('en-IN')}</strong>
                    </div>
                    <div>
                      <span className="text-[#686158] block text-[10px]">Cost / Bottle</span>
                      <strong className="text-[#9A783E]">₹{Number(b.costPerBottleInr || 0).toLocaleString('en-IN')}</strong>
                    </div>
                  </div>

                  {/* Action Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#DED7CC]">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        onClick={() => setQcModalBatch(b)}
                        className="px-2.5 py-1.5 border border-[#DED7CC] hover:border-[#9A783E] bg-[#FAF8F4] rounded text-[11px] font-mono flex items-center gap-1 cursor-pointer"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Lab QC</span>
                      </button>
                      {!b.releasedToInventory && (
                        <button
                          onClick={() => {
                            setReworkModalBatch(b);
                            setReworkForm({ rejectedQty: 1, reworkQty: 2, disposition: 'REWORK_RECOVERED', reason: '' });
                          }}
                          className="px-2.5 py-1.5 border border-[#DED7CC] hover:border-[#9A783E] bg-[#FAF8F4] rounded text-[11px] font-mono flex items-center gap-1 cursor-pointer"
                        >
                          <Wrench className="w-3.5 h-3.5 text-[#9A783E]" />
                          <span>Rework/Reject</span>
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setTraceBatchId(b.id);
                          setActiveTab('traceability');
                        }}
                        className="px-2.5 py-1.5 border border-[#DED7CC] hover:border-[#9A783E] bg-[#FAF8F4] rounded text-[11px] font-mono flex items-center gap-1 cursor-pointer"
                      >
                        <GitBranch className="w-3.5 h-3.5 text-[#686158]" />
                        <span>Trace</span>
                      </button>
                      <button
                        onClick={() => openBmrForBatch(b)}
                        className="px-2.5 py-1.5 border border-[#DED7CC] hover:border-[#9A783E] bg-[#FAF8F4] rounded text-[11px] font-mono flex items-center gap-1 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5 text-[#9A783E]" />
                        <span>BMR</span>
                      </button>
                    </div>

                    {nextStage ? (
                      <button
                        onClick={() => openStageModal(b)}
                        className="px-3 py-1.5 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] rounded text-[11px] font-mono flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                      >
                        <span>Next: {nextStage.replace(/_/g, ' ')}</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    ) : (
                      <span className="text-[11px] font-mono text-emerald-700 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Released to Sellable Stock</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: THE ONCE COLLECTION VAULT */}
      {activeTab === 'once' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4">
              <h3 className="font-serif text-base uppercase text-[#24211D]">
                The Once Collection · One-Time Limited Editions (100–1,000 Numbered Bottles)
              </h3>
              <p className="text-xs text-[#686158] mt-1">
                Strict archive governance: each edition locks one approved formula version, authorizes exactly one production campaign with serialized bottles, and permanently closes production upon completion.
              </p>
            </div>

            {onceEditions.map((ed) => {
              const mintedCount = mfgSnap?.onceSerialsCountByEdition?.[ed.id] || 0;
              const isClosed = ed.status === 'PERMANENTLY_CLOSED';
              const hasCampaign = Boolean(ed.campaignBatchId);
              const editionSerials = (mfgSnap?.onceSerialsPreview || []).filter((s) => s.editionId === ed.id);

              return (
                <div key={ed.id} className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-5 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-mono">
                        <span className="font-bold text-[#9A783E]">{ed.editionCode}</span>
                        <span className="text-[#686158]">·</span>
                        <span className={isClosed ? 'text-rose-700 font-bold' : hasCampaign ? 'text-emerald-700 font-bold' : 'text-[#24211D]'}>
                          {ed.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <h4 className="font-serif text-lg text-[#24211D] mt-0.5">
                        {ed.editionName} — {ed.fragranceName} ({ed.bottleSizeMl} ml)
                      </h4>
                      <p className="text-[11px] font-mono text-[#686158]">
                        Locked Formula v{ed.lockedFormulationVersionNumber} · Declared Cap: <strong>{ed.declaredQuantity}</strong> numbered bottles · Minted Serials: <strong>{mintedCount}</strong>
                      </p>
                    </div>
                    <div className="text-right font-mono text-xs tabular-nums">
                      <span className="text-[#686158] block text-[10px]">Produced</span>
                      <strong>{ed.producedQuantity} / {ed.declaredQuantity}</strong>
                    </div>
                  </div>

                  {ed.notes && <p className="text-xs text-[#686158]">{ed.notes}</p>}

                  {isClosed ? (
                    <div className="p-3 bg-[#FAF8F4] border border-[#DED7CC] rounded font-mono text-[11px] space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-rose-700">
                        <Lock className="w-3.5 h-3.5" />
                        <span>PRODUCTION PERMANENTLY CLOSED — RE-PRODUCTION DISABLED</span>
                      </div>
                      <div className="text-[#686158]">
                        Sealed by {ed.closedByEmail} · Certificate Hash: <strong className="text-[#24211D]">{ed.closureCertificateHash}</strong>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#DED7CC]">
                      <div className="flex flex-wrap items-center gap-2">
                        {!hasCampaign ? (
                          <button
                            disabled={busy}
                            onClick={() =>
                              runAction(async () => {
                                await erpApi.launchOnceCampaign(ed.id);
                              }, `Authorized single campaign launched for ${ed.editionCode} and ${ed.declaredQuantity} unique bottle serials minted.`)
                            }
                            className="px-3.5 py-1.5 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] rounded text-xs font-mono cursor-pointer"
                          >
                            Launch Single Authorized Campaign
                          </button>
                        ) : (
                          <button
                            onClick={() => setActiveTab('pipeline')}
                            className="px-3 py-1.5 border border-[#DED7CC] bg-[#FAF8F4] hover:border-[#9A783E] rounded text-xs font-mono cursor-pointer"
                          >
                            Campaign: {ed.campaignBatchNumber} → Pipeline
                          </button>
                        )}

                        {mintedCount > 0 && (
                          <button
                            onClick={() => setSerialPreviewEdition({ edition: ed, serials: editionSerials })}
                            className="px-3 py-1.5 border border-[#DED7CC] bg-[#FFFFFF] hover:border-[#9A783E] rounded text-xs font-mono cursor-pointer"
                          >
                            Preview Serials ({mintedCount})
                          </button>
                        )}
                      </div>

                      {confirmCloseEditionId === ed.id ? (
                        <div className="flex items-center gap-2">
                          <button
                            disabled={busy}
                            onClick={() =>
                              runAction(async () => {
                                await erpApi.closeOnceEdition(ed.id, 'Archive vault finalized & permanently locked.');
                                setConfirmCloseEditionId(null);
                              }, `Edition ${ed.editionCode} permanently closed with cryptographic seal.`)
                            }
                            className="px-3 py-1.5 bg-rose-700 text-white rounded text-xs font-mono cursor-pointer"
                          >
                            Confirm Permanent Seal
                          </button>
                          <button
                            onClick={() => setConfirmCloseEditionId(null)}
                            className="px-2.5 py-1.5 text-xs font-mono text-[#686158] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmCloseEditionId(ed.id)}
                          className="px-3 py-1.5 border border-rose-300 text-rose-700 hover:bg-rose-50 rounded text-xs font-mono flex items-center gap-1 cursor-pointer"
                        >
                          <Lock className="w-3 h-3" />
                          <span>Permanently Close Edition</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              runAction(async () => {
                await erpApi.createOnceEdition({
                  editionName: onceForm.editionName,
                  fragranceName: onceForm.fragranceName,
                  formulationId: onceForm.formulationId,
                  bottleSizeMl: Number(onceForm.bottleSizeMl),
                  declaredQuantity: Number(onceForm.declaredQuantity),
                  sku: onceForm.sku || undefined,
                  notes: onceForm.notes || undefined
                });
                setOnceForm({ ...onceForm, editionName: '', sku: '', notes: '' });
              }, 'The Once Collection edition registered with locked formulation version.');
            }}
            className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4 space-y-3 h-fit"
          >
            <h3 className="text-xs font-mono uppercase font-semibold text-[#24211D] border-b border-[#DED7CC] pb-2">
              Register Limited-Edition Drop
            </h3>
            <input
              required
              placeholder="Edition Title (e.g. NOCTURNE RESERVE 2026)"
              value={onceForm.editionName}
              onChange={(e) => setOnceForm({ ...onceForm, editionName: e.target.value })}
              className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
            />
            <div>
              <label className="text-[10px] font-mono text-[#686158] block mb-1">Locked Approved Formulation</label>
              <select
                required
                value={onceForm.formulationId}
                onChange={(e) => {
                  const f = approvedFormulations.find((x) => x.id === e.target.value);
                  setOnceForm({ ...onceForm, formulationId: e.target.value, fragranceName: f ? f.name : onceForm.fragranceName });
                }}
                className="w-full px-2.5 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              >
                {approvedFormulations.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.formulaCode} — {f.name} (v{f.activeVersionNumber})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-mono text-[#686158]">Declared Bottles (100–1000)</label>
                <input
                  type="number"
                  min={100}
                  max={1000}
                  required
                  value={onceForm.declaredQuantity}
                  onChange={(e) => setOnceForm({ ...onceForm, declaredQuantity: Number(e.target.value) })}
                  className="w-full px-2.5 py-1.5 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-[#686158]">Bottle Size (ml)</label>
                <input
                  type="number"
                  min={2}
                  required
                  value={onceForm.bottleSizeMl}
                  onChange={(e) => setOnceForm({ ...onceForm, bottleSizeMl: Number(e.target.value) })}
                  className="w-full px-2.5 py-1.5 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
                />
              </div>
            </div>
            <input
              placeholder="Exclusive SKU (optional)"
              value={onceForm.sku}
              onChange={(e) => setOnceForm({ ...onceForm, sku: e.target.value })}
              className="w-full px-3 py-2 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
            />
            <textarea
              rows={2}
              placeholder="Provenance / collector vault notes..."
              value={onceForm.notes}
              onChange={(e) => setOnceForm({ ...onceForm, notes: e.target.value })}
              className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
            />
            <button
              disabled={busy || !onceForm.formulationId}
              type="submit"
              className="w-full py-2.5 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono uppercase rounded cursor-pointer"
            >
              Lock &amp; Create Once Edition
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: END-TO-END LOT-TO-ORDER TRACEABILITY */}
      {activeTab === 'traceability' && (
        <div className="space-y-4">
          <div className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-[260px]">
              <label className="text-xs font-mono uppercase text-[#686158] whitespace-nowrap">Inspect Batch:</label>
              <select
                value={traceBatchId}
                onChange={(e) => setTraceBatchId(e.target.value)}
                className="flex-1 px-3 py-2 border border-[#DED7CC] rounded text-xs font-mono bg-[#FAF8F4]"
              >
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.batchNumber} — {b.productName} ({b.size}) [{b.pipelineStage || b.batchReleaseStatus}]
                  </option>
                ))}
              </select>
            </div>
            {traceReport?.batch && (
              <button
                onClick={() => setPrintDoc({ type: 'BMR', batch: traceReport.batch, traceability: traceReport })}
                className="px-3.5 py-2 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono rounded flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print / Export Batch Manufacturing Record</span>
              </button>
            )}
          </div>

          {traceLoading || !traceReport ? (
            <div className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-8 text-center font-mono text-xs text-[#686158]">
              {traceLoading ? 'Tracing raw material lots, weighing logs, stage events, and orders...' : 'Select a batch to trace.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
              <div className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4 space-y-2">
                <h4 className="font-mono uppercase font-bold text-[#24211D] border-b border-[#DED7CC] pb-2">
                  1. Source Supplier Lots &amp; GRNs ({traceReport.sourceLots.length} Lots / {traceReport.sourceGrns.length} GRNs)
                </h4>
                {traceReport.sourceLots.length === 0 ? (
                  <p className="text-[#686158] font-mono">No stock lots linked yet (advance batch to Reserved / Dispensed).</p>
                ) : (
                  traceReport.sourceLots.map((l: any) => (
                    <div key={l.id} className="flex justify-between font-mono text-[11px] border-b border-[#DED7CC]/60 py-1.5">
                      <span>{l.lotNumber} ({l.supplierName || 'Direct'})</span>
                      <span className="text-[#686158]">Rec {l.receivedDate} · {l.qcStatus}</span>
                    </div>
                  ))
                )}
              </div>

              <div className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4 space-y-2">
                <h4 className="font-mono uppercase font-bold text-[#24211D] border-b border-[#DED7CC] pb-2">
                  2. Stage Audit Timeline ({traceReport.events.length} Events)
                </h4>
                <div className="space-y-1.5 max-h-60 overflow-y-auto font-mono text-[11px]">
                  {traceReport.events.map((ev: any) => (
                    <div key={ev.id} className="border-b border-[#DED7CC]/60 pb-1">
                      <span className="font-bold text-[#9A783E]">[{ev.toStage}]</span> {ev.summary}
                      <span className="block text-[10px] text-[#686158]">{ev.performedByEmail}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4 space-y-2">
                <h4 className="font-mono uppercase font-bold text-[#24211D] border-b border-[#DED7CC] pb-2">
                  3. Material Movements &amp; Laboratory QC ({traceReport.movements.length} Moves / {traceReport.qcRecords.length} QC)
                </h4>
                <div className="space-y-1.5 max-h-60 overflow-y-auto font-mono text-[11px]">
                  {traceReport.movements.map((mv: any) => (
                    <div key={mv.id} className="flex justify-between border-b border-[#DED7CC]/60 py-1">
                      <span>{mv.movementNumber} [{mv.movementType}] {mv.materialName}</span>
                      <span className="tabular-nums font-semibold">{mv.qtyDelta} {mv.uom}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4 space-y-2">
                <h4 className="font-mono uppercase font-bold text-[#24211D] border-b border-[#DED7CC] pb-2">
                  4. Finished Goods Bins &amp; Customer Orders ({traceReport.linkedOrders.length} Orders)
                </h4>
                <div className="space-y-1.5 max-h-60 overflow-y-auto font-mono text-[11px]">
                  {traceReport.finishedGoodsBins.map((fg: any) => (
                    <div key={fg.id} className="flex justify-between bg-[#FAF8F4] p-2 rounded border border-[#DED7CC]">
                      <span>Vault Bin {fg.binLocation} ({fg.sku})</span>
                      <strong>{fg.quantityAvailable} avail / {fg.quantityOnHand} on hand</strong>
                    </div>
                  ))}
                  {traceReport.linkedOrders.map((ord: any, i: number) => (
                    <div key={i} className="flex justify-between border-b border-[#DED7CC]/60 py-1">
                      <span>{ord.orderNumber} — {ord.customerName}</span>
                      <span className="text-[#9A783E]">₹{Number(ord.totalAmount || 0).toLocaleString('en-IN')} ({ord.orderStatus})</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: COST SHEETS & EXPORTS */}
      {activeTab === 'costing' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4">
            <span className="text-xs font-mono text-[#24211D] font-semibold uppercase">
              Downloadable PDF &amp; Excel Production Intelligence
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setPrintDoc({ type: 'COST_SHEET', batches })}
                className="px-3 py-1.5 bg-[#24211D] text-[#FAF8F4] text-xs font-mono rounded cursor-pointer"
              >
                Cost Sheet PDF / Excel
              </button>
              <button
                onClick={() =>
                  setPrintDoc({
                    type: 'MOVEMENT_LEDGER',
                    movements: mfgSnap?.movements || [],
                    filterLabel: 'ALL_CATEGORIES'
                  })
                }
                className="px-3 py-1.5 border border-[#DED7CC] bg-[#FAF8F4] text-xs font-mono rounded cursor-pointer"
              >
                Movement Ledger PDF / Excel
              </button>
              <button
                onClick={() => setPrintDoc({ type: 'FINISHED_GOODS', finishedGoods: mfgSnap?.finishedGoods || [] })}
                className="px-3 py-1.5 border border-[#DED7CC] bg-[#FAF8F4] text-xs font-mono rounded cursor-pointer"
              >
                Finished Goods PDF / Excel
              </button>
            </div>
          </div>

          <div className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                <tr>
                  <th className="py-2.5 px-3">Batch #</th>
                  <th className="py-2.5 px-3">Product / Size</th>
                  <th className="py-2.5 px-3 text-right">Planned / Good</th>
                  <th className="py-2.5 px-3 text-right">Yield Var %</th>
                  <th className="py-2.5 px-3 text-right">Material ₹</th>
                  <th className="py-2.5 px-3 text-right">Packaging ₹</th>
                  <th className="py-2.5 px-3 text-right">Labour + OH ₹</th>
                  <th className="py-2.5 px-3 text-right">Actual Total ₹</th>
                  <th className="py-2.5 px-3 text-right">Cost / Bottle ₹</th>
                  <th className="py-2.5 px-3 text-right">BMR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DED7CC] font-mono tabular-nums">
                {batches.map((b) => (
                  <tr key={b.id} className="hover:bg-[#FAF8F4]">
                    <td className="py-2.5 px-3 font-bold text-[#9A783E]">{b.batchNumber}</td>
                    <td className="py-2.5 px-3 font-sans">
                      {b.productName} ({b.size})
                      <span className="block font-mono text-[10px] text-[#686158]">{b.pipelineStage || b.batchReleaseStatus}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right">{b.plannedBottlesCount || b.finishedQuantity} / {b.finishedQuantity}</td>
                    <td className="py-2.5 px-3 text-right">{b.yieldVariancePct || 0}%</td>
                    <td className="py-2.5 px-3 text-right">₹{Number(b.materialCostInr || 0).toLocaleString('en-IN')}</td>
                    <td className="py-2.5 px-3 text-right">₹{Number(b.packagingCostInr || 0).toLocaleString('en-IN')}</td>
                    <td className="py-2.5 px-3 text-right">₹{Number((b.labourCostInr || 0) + (b.overheadCostInr || 0)).toLocaleString('en-IN')}</td>
                    <td className="py-2.5 px-3 text-right font-bold">₹{Number(b.actualTotalCostInr || 0).toLocaleString('en-IN')}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-[#9A783E]">₹{Number(b.costPerBottleInr || 0).toLocaleString('en-IN')}</td>
                    <td className="py-2.5 px-3 text-right">
                      <button onClick={() => openBmrForBatch(b)} className="text-[#9A783E] hover:underline cursor-pointer">
                        Open BMR
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PLAN NEW BATCH MODAL */}
      {createBatchOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setCreateBatchOpen(false);
          }}
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const sizeMl =
                batchForm.bottleSizePreset === 'CUSTOM'
                  ? Number(batchForm.customBottleSizeMl || 50)
                  : Number(batchForm.bottleSizePreset);
              runAction(async () => {
                await erpApi.createBatchPlan({
                  formulationId: batchForm.formulationId,
                  sku: batchForm.sku,
                  bottleSizeMl: sizeMl,
                  plannedBottlesCount: Number(batchForm.plannedBottlesCount),
                  plannedJuiceUnit: batchForm.plannedJuiceUnit,
                  labourCostInr: Number(batchForm.labourCostInr),
                  overheadCostInr: Number(batchForm.overheadCostInr),
                  notes: batchForm.notes || undefined
                });
                setCreateBatchOpen(false);
              }, 'Batch plan created with locked approved formula & calculated density requirements.');
            }}
            className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl w-full max-w-lg p-6 space-y-3.5 text-xs shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#DED7CC] pb-3">
              <h3 className="font-serif text-base uppercase text-[#24211D]">Plan Production Batch (Locked Formula BOM)</h3>
              <button type="button" onClick={() => setCreateBatchOpen(false)} className="text-[#686158] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-[10px] font-mono text-[#686158] block mb-1">Approved Formulation *</label>
              <select
                required
                value={batchForm.formulationId}
                onChange={(e) => setBatchForm({ ...batchForm, formulationId: e.target.value })}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4]"
              >
                {approvedFormulations.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.formulaCode} — {f.name} (v{f.activeVersionNumber})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-mono text-[#686158] block mb-1">Bottle Size Preset</label>
                <select
                  value={batchForm.bottleSizePreset}
                  onChange={(e) => setBatchForm({ ...batchForm, bottleSizePreset: e.target.value })}
                  className="w-full px-3 py-2 border border-[#DED7CC] rounded font-mono bg-[#FAF8F4]"
                >
                  <option value="2">2 ml (Discovery Sample Vial)</option>
                  <option value="10">10 ml (Pocket Atomizer)</option>
                  <option value="15">15 ml (Travel Flacon)</option>
                  <option value="30">30 ml (Signature Compact)</option>
                  <option value="50">50 ml (Luxury Extrait Flacon)</option>
                  <option value="CUSTOM">Custom Size (ml)</option>
                </select>
              </div>
              {batchForm.bottleSizePreset === 'CUSTOM' ? (
                <div>
                  <label className="text-[10px] font-mono text-[#686158] block mb-1">Custom Volume (ml)</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={batchForm.customBottleSizeMl}
                    onChange={(e) => setBatchForm({ ...batchForm, customBottleSizeMl: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-[#DED7CC] rounded font-mono bg-[#FAF8F4]"
                  />
                </div>
              ) : (
                <div>
                  <label className="text-[10px] font-mono text-[#686158] block mb-1">Planned Bottles</label>
                  <input
                    type="number"
                    min={10}
                    required
                    value={batchForm.plannedBottlesCount}
                    onChange={(e) => setBatchForm({ ...batchForm, plannedBottlesCount: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-[#DED7CC] rounded font-mono bg-[#FAF8F4]"
                  />
                </div>
              )}
            </div>

            {batchForm.bottleSizePreset === 'CUSTOM' && (
              <div>
                <label className="text-[10px] font-mono text-[#686158] block mb-1">Planned Bottles</label>
                <input
                  type="number"
                  min={10}
                  required
                  value={batchForm.plannedBottlesCount}
                  onChange={(e) => setBatchForm({ ...batchForm, plannedBottlesCount: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-[#DED7CC] rounded font-mono bg-[#FAF8F4]"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-mono text-[#686158] block mb-1">Target Commercial SKU</label>
                <input
                  required
                  value={batchForm.sku}
                  onChange={(e) => setBatchForm({ ...batchForm, sku: e.target.value })}
                  className="w-full px-3 py-2 border border-[#DED7CC] rounded font-mono bg-[#FAF8F4]"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-[#686158] block mb-1">Bulk Juice Unit</label>
                <select
                  value={batchForm.plannedJuiceUnit}
                  onChange={(e) => setBatchForm({ ...batchForm, plannedJuiceUnit: e.target.value as any })}
                  className="w-full px-3 py-2 border border-[#DED7CC] rounded font-mono bg-[#FAF8F4]"
                >
                  <option value="l">Litres (l)</option>
                  <option value="kg">Kilograms (kg, density-converted)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-mono text-[#686158] block mb-1">Estimated Labour (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={batchForm.labourCostInr}
                  onChange={(e) => setBatchForm({ ...batchForm, labourCostInr: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-[#DED7CC] rounded font-mono bg-[#FAF8F4]"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-[#686158] block mb-1">Allocated Overhead (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={batchForm.overheadCostInr}
                  onChange={(e) => setBatchForm({ ...batchForm, overheadCostInr: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-[#DED7CC] rounded font-mono bg-[#FAF8F4]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#DED7CC]">
              <button type="button" onClick={() => setCreateBatchOpen(false)} className="px-3 py-1.5 border border-[#DED7CC] rounded font-mono">
                Cancel
              </button>
              <button disabled={busy || !batchForm.formulationId} type="submit" className="px-4 py-1.5 bg-[#24211D] text-[#FAF8F4] rounded font-mono">
                Initiate Batch Plan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* EXECUTE NEXT STAGE MODAL */}
      {stageModalBatch && (() => {
        const nextStage = getNextStage(stageModalBatch);
        if (!nextStage) return null;
        const reqs = stageModalBatch.materialRequirements || {};
        const qcBlocked = (nextStage === 'FILLING' || nextStage === 'RELEASED') && stageModalBatch.qcStatus !== 'PASSED';

        return (
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setStageModalBatch(null);
            }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                runAction(async () => {
                  const payload: any = { targetStage: nextStage, notes: stageExecForm.notes || undefined };
                  if (nextStage === 'MATERIAL_ISSUED') {
                    payload.weighingInputs = Object.entries(weighingInputs).map(([materialId, actualWeighedQty]) => ({
                      materialId,
                      actualWeighedQty
                    }));
                  } else if (nextStage === 'MIXING') {
                    payload.actualJuiceQty = Number(stageExecForm.actualJuiceQty);
                    payload.wastageQty = Number(stageExecForm.wastageQty);
                  } else if (nextStage === 'MATURATION') {
                    payload.holdingTankLocation = stageExecForm.holdingTankLocation;
                    payload.macerationTargetDate = stageExecForm.macerationTargetDate;
                  } else if (nextStage === 'FILLING') {
                    payload.actualFilledBottlesCount = Number(stageExecForm.actualFilledBottlesCount);
                    payload.rejectedBottlesCount = Number(stageExecForm.rejectedBottlesCount);
                    payload.reworkBottlesCount = Number(stageExecForm.reworkBottlesCount);
                  } else if (nextStage === 'PACKING') {
                    payload.labourCostInr = Number(stageExecForm.labourCostInr);
                    payload.overheadCostInr = Number(stageExecForm.overheadCostInr);
                  }
                  await erpApi.advanceBatchStage(stageModalBatch.id, payload);
                  setStageModalBatch(null);
                }, `Batch ${stageModalBatch.batchNumber} advanced to ${nextStage.replace(/_/g, ' ')}.`);
              }}
              className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl w-full max-w-xl p-6 space-y-4 text-xs shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-[#DED7CC] pb-3">
                <div>
                  <h3 className="font-serif text-base uppercase text-[#24211D]">
                    Execute Stage: {nextStage.replace(/_/g, ' ')}
                  </h3>
                  <span className="font-mono text-[11px] text-[#9A783E]">
                    {stageModalBatch.batchNumber} · {stageModalBatch.productName} ({stageModalBatch.size})
                  </span>
                </div>
                <button type="button" onClick={() => setStageModalBatch(null)} className="text-[#686158] cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {nextStage === 'AVAILABILITY_CHECK' && (
                <div className="space-y-2">
                  <p className="text-[#686158]">
                    Verifying real-time approved FIFO lot quantities against locked formula BOM &amp; density conversion factors:
                  </p>
                  <div className="border border-[#DED7CC] rounded divide-y divide-[#DED7CC] font-mono text-[11px]">
                    {[...(reqs.ingredientReqs || []), ...(reqs.packagingReqs || [])].map((r: any, idx: number) => (
                      <div key={idx} className="flex justify-between p-2">
                        <span>{r.materialName}</span>
                        <span>
                          Req {r.requiredQty} {r.uom} / Avail <strong>{r.availableQty}</strong>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {nextStage === 'MATERIAL_ISSUED' && (
                <div className="space-y-2">
                  <p className="text-[#686158]">Enter actual scale-weighed quantities dispensed into compounding vessel:</p>
                  {(reqs.ingredientReqs || []).map((ing: any) =>
                    ing.materialId ? (
                      <div key={ing.materialId} className="grid grid-cols-12 gap-2 items-center border border-[#DED7CC] p-2 rounded bg-[#FAF8F4]">
                        <div className="col-span-7">
                          <span className="font-medium block">{ing.materialName}</span>
                          <span className="font-mono text-[10px] text-[#686158]">
                            Target: {ing.requiredQty} {ing.uom} {ing.densityUsedGPerMl ? `(${ing.densityUsedGPerMl} g/mL)` : ''}
                          </span>
                        </div>
                        <div className="col-span-5">
                          <input
                            type="number"
                            step="0.001"
                            required
                            value={weighingInputs[ing.materialId] ?? ing.requiredQty}
                            onChange={(e) => setWeighingInputs({ ...weighingInputs, [ing.materialId]: Number(e.target.value) })}
                            className="w-full px-2.5 py-1.5 border border-[#DED7CC] rounded font-mono bg-[#FFFFFF]"
                          />
                        </div>
                      </div>
                    ) : null
                  )}
                </div>
              )}

              {nextStage === 'MIXING' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-mono text-[#686158] block mb-1">
                      Actual Compounded Bulk ({stageModalBatch.plannedJuiceUnit || 'l'})
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      required
                      value={stageExecForm.actualJuiceQty}
                      onChange={(e) => setStageExecForm({ ...stageExecForm, actualJuiceQty: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-[#DED7CC] rounded font-mono bg-[#FAF8F4]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-[#686158] block mb-1">Mixing / Filtration Loss</label>
                    <input
                      type="number"
                      step="0.001"
                      min={0}
                      value={stageExecForm.wastageQty}
                      onChange={(e) => setStageExecForm({ ...stageExecForm, wastageQty: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-[#DED7CC] rounded font-mono bg-[#FAF8F4]"
                    />
                  </div>
                </div>
              )}

              {nextStage === 'MATURATION' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-mono text-[#686158] block mb-1">Holding Tank / Vault Bay</label>
                    <input
                      required
                      value={stageExecForm.holdingTankLocation}
                      onChange={(e) => setStageExecForm({ ...stageExecForm, holdingTankLocation: e.target.value })}
                      className="w-full px-3 py-2 border border-[#DED7CC] rounded font-mono bg-[#FAF8F4]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-[#686158] block mb-1">Maturation Target Date</label>
                    <input
                      type="date"
                      required
                      value={stageExecForm.macerationTargetDate}
                      onChange={(e) => setStageExecForm({ ...stageExecForm, macerationTargetDate: e.target.value })}
                      className="w-full px-3 py-2 border border-[#DED7CC] rounded font-mono bg-[#FAF8F4]"
                    />
                  </div>
                </div>
              )}

              {nextStage === 'FILLING' && (
                <div className="space-y-3">
                  {qcBlocked && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-800 space-y-2">
                      <div className="flex items-center gap-1.5 font-mono font-bold">
                        <AlertTriangle className="w-4 h-4" />
                        <span>QC Gate Active: Current QC Status is {stageModalBatch.qcStatus}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const target = stageModalBatch;
                          setStageModalBatch(null);
                          setQcModalBatch(target);
                        }}
                        className="px-3 py-1 bg-[#24211D] text-white font-mono rounded text-[11px] cursor-pointer"
                      >
                        Open Lab QC Sign-Off
                      </button>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] font-mono text-[#686158]">Filled Bottles</label>
                      <input
                        type="number"
                        min={1}
                        required
                        value={stageExecForm.actualFilledBottlesCount}
                        onChange={(e) => setStageExecForm({ ...stageExecForm, actualFilledBottlesCount: Number(e.target.value) })}
                        className="w-full px-2.5 py-1.5 border border-[#DED7CC] rounded font-mono bg-[#FAF8F4]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-mono text-[#686158]">Rejected</label>
                      <input
                        type="number"
                        min={0}
                        value={stageExecForm.rejectedBottlesCount}
                        onChange={(e) => setStageExecForm({ ...stageExecForm, rejectedBottlesCount: Number(e.target.value) })}
                        className="w-full px-2.5 py-1.5 border border-[#DED7CC] rounded font-mono bg-[#FAF8F4]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-mono text-[#686158]">Rework</label>
                      <input
                        type="number"
                        min={0}
                        value={stageExecForm.reworkBottlesCount}
                        onChange={(e) => setStageExecForm({ ...stageExecForm, reworkBottlesCount: Number(e.target.value) })}
                        className="w-full px-2.5 py-1.5 border border-[#DED7CC] rounded font-mono bg-[#FAF8F4]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {nextStage === 'PACKING' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-mono text-[#686158] block mb-1">Direct Atelier Labour (₹)</label>
                    <input
                      type="number"
                      min={0}
                      value={stageExecForm.labourCostInr}
                      onChange={(e) => setStageExecForm({ ...stageExecForm, labourCostInr: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-[#DED7CC] rounded font-mono bg-[#FAF8F4]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-[#686158] block mb-1">Chiller &amp; QC Overhead (₹)</label>
                    <input
                      type="number"
                      min={0}
                      value={stageExecForm.overheadCostInr}
                      onChange={(e) => setStageExecForm({ ...stageExecForm, overheadCostInr: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-[#DED7CC] rounded font-mono bg-[#FAF8F4]"
                    />
                  </div>
                </div>
              )}

              {nextStage === 'RELEASED' && (
                <div className="p-3 bg-[#FAF8F4] border border-[#DED7CC] rounded font-mono text-[11px] space-y-1">
                  <div>Releasing <strong>{stageModalBatch.finishedQuantity}</strong> bottles of <strong>{stageModalBatch.sku}</strong> to Finished Goods Vault &amp; Storefront Sellable Stock.</div>
                  <div>Capitalized Valuation: <strong>₹{Number(stageModalBatch.actualTotalCostInr || 0).toLocaleString('en-IN')}</strong> (₹{Number(stageModalBatch.costPerBottleInr || 0)}/bottle).</div>
                </div>
              )}

              <input
                placeholder="Stage transition notes (optional)"
                value={stageExecForm.notes}
                onChange={(e) => setStageExecForm({ ...stageExecForm, notes: e.target.value })}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4]"
              />

              <div className="flex justify-end gap-2 pt-2 border-t border-[#DED7CC]">
                <button type="button" onClick={() => setStageModalBatch(null)} className="px-3 py-1.5 border border-[#DED7CC] rounded font-mono">
                  Cancel
                </button>
                <button
                  disabled={busy || qcBlocked}
                  type="submit"
                  className="px-4 py-1.5 bg-[#24211D] hover:bg-[#9A783E] disabled:opacity-50 text-[#FAF8F4] rounded font-mono cursor-pointer"
                >
                  Confirm &amp; Advance to {nextStage.replace(/_/g, ' ')}
                </button>
              </div>
            </form>
          </div>
        );
      })()}

      {/* QC INSPECTION MODAL */}
      {qcModalBatch && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setQcModalBatch(null);
          }}
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runAction(async () => {
                const res = await fetch(`/api/ops/batches/${encodeURIComponent(qcModalBatch.id)}/qc`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    qcStatus: qcForm.qcStatus,
                    notes: `${qcForm.labNotes} [ABV ${qcForm.abvTestedPct}%, GC-MS ${qcForm.gcmsMatchPct}%]`
                  })
                });
                if (!res.ok) throw new Error('Failed to record batch QC status.');
                if (qcForm.qcStatus !== 'PENDING_QC') {
                  await erpApi
                    .createQcRecord({
                      inspectionType: 'FINISHED_BATCH_RELEASE',
                      batchId: qcModalBatch.id,
                      subjectName: `${qcModalBatch.batchNumber} — ${qcModalBatch.productName}`,
                      abvTestedPct: qcForm.abvTestedPct,
                      gcmsMatchPct: qcForm.gcmsMatchPct,
                      clarityResult: 'CRYSTAL_CLEAR',
                      olfactoryResult: 'CONFORMS',
                      decision: qcForm.qcStatus
                    })
                    .catch(() => {});
                }
                setQcModalBatch(null);
              }, `Batch ${qcModalBatch.batchNumber} QC certified as ${qcForm.qcStatus}.`);
            }}
            className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl w-full max-w-md p-6 space-y-3.5 text-xs shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#DED7CC] pb-3">
              <div>
                <h3 className="font-serif text-base uppercase text-[#24211D]">QC Laboratory Sign-Off</h3>
                <span className="font-mono text-[11px] text-[#9A783E]">{qcModalBatch.batchNumber}</span>
              </div>
              <button type="button" onClick={() => setQcModalBatch(null)} className="text-[#686158] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-mono text-[#686158] block mb-1">Alcohol by Vol (ABV %)</label>
                <input
                  type="number"
                  step="0.1"
                  value={qcForm.abvTestedPct}
                  onChange={(e) => setQcForm({ ...qcForm, abvTestedPct: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-[#DED7CC] rounded font-mono bg-[#FAF8F4]"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-[#686158] block mb-1">GC-MS Match %</label>
                <input
                  type="number"
                  step="0.1"
                  value={qcForm.gcmsMatchPct}
                  onChange={(e) => setQcForm({ ...qcForm, gcmsMatchPct: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-[#DED7CC] rounded font-mono bg-[#FAF8F4]"
                />
              </div>
            </div>

            <select
              value={qcForm.qcStatus}
              onChange={(e) => setQcForm({ ...qcForm, qcStatus: e.target.value as any })}
              className="w-full px-3 py-2 border border-[#DED7CC] rounded font-mono bg-[#FAF8F4]"
            >
              <option value="PASSED">PASSED — Laboratory Specification Met</option>
              <option value="PENDING_QC">PENDING_QC — Under Observation</option>
              <option value="FAILED">FAILED — Specification Deviation</option>
              <option value="QUARANTINED">QUARANTINED — Hold Vault</option>
            </select>

            <textarea
              rows={2}
              value={qcForm.labNotes}
              onChange={(e) => setQcForm({ ...qcForm, labNotes: e.target.value })}
              className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4]"
            />

            <div className="flex justify-end gap-2 pt-2 border-t border-[#DED7CC]">
              <button type="button" onClick={() => setQcModalBatch(null)} className="px-3 py-1.5 border border-[#DED7CC] rounded font-mono">
                Cancel
              </button>
              <button disabled={busy} type="submit" className="px-4 py-1.5 bg-emerald-700 text-white rounded font-mono cursor-pointer">
                Submit QC Certification
              </button>
            </div>
          </form>
        </div>
      )}

      {/* REWORK / REJECTION MODAL */}
      {reworkModalBatch && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setReworkModalBatch(null);
          }}
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runAction(async () => {
                await erpApi.recordBatchRework(reworkModalBatch.id, {
                  stage: reworkModalBatch.pipelineStage || 'FILLING',
                  reason: reworkForm.reason,
                  rejectedQty: Number(reworkForm.rejectedQty),
                  reworkQty: Number(reworkForm.reworkQty),
                  disposition: reworkForm.disposition
                });
                setReworkModalBatch(null);
              }, 'Rework & rejection record committed to batch audit trail.');
            }}
            className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl w-full max-w-md p-6 space-y-3 text-xs shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#DED7CC] pb-2">
              <h3 className="font-serif text-base uppercase text-[#24211D]">Log Rework / Bottle Rejection</h3>
              <button type="button" onClick={() => setReworkModalBatch(null)} className="text-[#686158] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-mono text-[#686158]">Rejected Qty</label>
                <input
                  type="number"
                  min={0}
                  value={reworkForm.rejectedQty}
                  onChange={(e) => setReworkForm({ ...reworkForm, rejectedQty: Number(e.target.value) })}
                  className="w-full px-2.5 py-1.5 border border-[#DED7CC] rounded font-mono bg-[#FAF8F4]"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-[#686158]">Rework Qty</label>
                <input
                  type="number"
                  min={0}
                  value={reworkForm.reworkQty}
                  onChange={(e) => setReworkForm({ ...reworkForm, reworkQty: Number(e.target.value) })}
                  className="w-full px-2.5 py-1.5 border border-[#DED7CC] rounded font-mono bg-[#FAF8F4]"
                />
              </div>
            </div>

            <select
              value={reworkForm.disposition}
              onChange={(e) => setReworkForm({ ...reworkForm, disposition: e.target.value as any })}
              className="w-full px-2.5 py-2 border border-[#DED7CC] rounded font-mono bg-[#FAF8F4]"
            >
              <option value="REWORK_RECOVERED">REWORK_RECOVERED (Re-filter / Re-crimp)</option>
              <option value="DESTROYED_SCRAP">DESTROYED_SCRAP (Write-off as Damaged Stock)</option>
            </select>

            <textarea
              required
              rows={2}
              placeholder="Defect description (e.g. crimp seal leak on flacon neck)..."
              value={reworkForm.reason}
              onChange={(e) => setReworkForm({ ...reworkForm, reason: e.target.value })}
              className="w-full px-2.5 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4]"
            />

            <div className="flex justify-end gap-2 pt-2 border-t border-[#DED7CC]">
              <button type="button" onClick={() => setReworkModalBatch(null)} className="px-3 py-1.5 border border-[#DED7CC] rounded font-mono">
                Cancel
              </button>
              <button disabled={busy} type="submit" className="px-4 py-1.5 bg-[#24211D] text-[#FAF8F4] rounded font-mono">
                Record Event
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ONCE COLLECTION SERIAL PREVIEW MODAL */}
      {serialPreviewEdition && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setSerialPreviewEdition(null);
          }}
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl w-full max-w-2xl p-6 space-y-3 text-xs shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#DED7CC] pb-2">
              <div>
                <h3 className="font-serif text-base uppercase text-[#24211D]">
                  Unique Bottle Serial Registry — {serialPreviewEdition.edition.editionCode}
                </h3>
                <span className="font-mono text-[11px] text-[#686158]">
                  Showing first {serialPreviewEdition.serials.length} of {serialPreviewEdition.edition.declaredQuantity} minted serials
                </span>
              </div>
              <button onClick={() => setSerialPreviewEdition(null)} className="text-[#686158] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2">
              {serialPreviewEdition.serials.map((s: any) => (
                <div key={s.id} className="border border-[#DED7CC] bg-[#FAF8F4] rounded p-2 font-mono text-[11px]">
                  <span className="font-bold text-[#24211D] block">{s.serialNumber}</span>
                  <span className="text-[10px] text-[#686158]">
                    {s.bottleSizeMl}ml · {s.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
