import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../../context/StoreContext';
import {
  Boxes,
  AlertTriangle,
  Search,
  ShieldCheck,
  FlaskConical,
  Factory,
  RefreshCw,
  Plus,
  CheckCircle2,
  XCircle,
  Lock,
  Sparkles,
  History,
  Settings2,
  Megaphone,
  PauseCircle,
  Check,
  X,
  ClipboardCheck
} from 'lucide-react';
import { ErpTableExportBar } from './erp/ErpUniversalExportModal';

interface LedgerRow {
  sku: string;
  productId: string;
  productName: string;
  variantId: string;
  size: string;
  openingStock: number;
  receivedStock: number;
  reservedStock: number;
  availableStock: number;
  soldStock: number;
  returnedSellableStock: number;
  damagedStock: number;
  reorderThreshold: number;
  alertThresholds: number[];
  targetStockLevel: number;
  procurementStatus: string;
  movementsHistory: Array<{
    id: string;
    timestamp: string;
    movementType: string;
    quantity: number;
    referenceId: string;
    actor: string;
    notes: string;
    resultingAvailable: number;
    resultingReserved: number;
    resultingSold: number;
  }>;
}

interface ProductionBatch {
  id: string;
  batchNumber: string;
  productId: string;
  productName: string;
  variantId: string;
  sku: string;
  size: string;
  manufacturingDate: string;
  expiryDate: string;
  finishedQuantity: number;
  qcStatus: 'PENDING_QC' | 'PASSED' | 'FAILED' | 'QUARANTINED';
  bottleType: string;
  packagingAvailability: 'AVAILABLE' | 'LOW_PACKAGING' | 'AWAITING_COFFRET' | 'UNAVAILABLE';
  batchReleaseStatus: 'UNRELEASED' | 'RELEASED' | 'RECALLED' | 'BLOCKED';
  releasedToInventory: boolean;
  releasedAt?: string;
  notes?: string;
}

interface OpsTaskOrAlert {
  id: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  entityType: string;
  entityId: string;
  sku?: string;
  status: string;
  suggestedReorderQty?: number;
  requiresAdminApproval: boolean;
  metadata: Record<string, any>;
  createdAt: string;
}

export const AdminInventory: React.FC = () => {
  const { products, showNotification } = useStore();
  const [activeTab, setActiveTab] = useState<'ledger' | 'batches' | 'procurement' | 'reconciliation'>('ledger');
  const [searchTerm, setSearchTerm] = useState('');
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [tasksAndAlerts, setTasksAndAlerts] = useState<OpsTaskOrAlert[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected SKU for adjustment / history modal
  const [selectedSkuRow, setSelectedSkuRow] = useState<LedgerRow | null>(null);
  const [adjustType, setAdjustType] = useState<'RECEIVE_STOCK' | 'DAMAGE_WRITE_OFF' | 'MANUAL_OPENING_ADJUST' | 'UPDATE_THRESHOLDS'>('RECEIVE_STOCK');
  const [adjustQty, setAdjustQty] = useState<number>(10);
  const [customReorderThreshold, setCustomReorderThreshold] = useState<number>(20);
  const [customTargetStock, setCustomTargetStock] = useState<number>(60);
  const [adjustNotes, setAdjustNotes] = useState('');

  // New Production Batch Modal
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchForm, setBatchForm] = useState({
    batchNumber: `BATCH-FRG-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
    sku: 'FRG-SIG-GH-050',
    manufacturingDate: new Date().toISOString().split('T')[0],
    expiryDate: new Date(Date.now() + 3 * 365 * 86400000).toISOString().split('T')[0],
    finishedQuantity: 100,
    qcStatus: 'PASSED' as 'PENDING_QC' | 'PASSED' | 'FAILED' | 'QUARANTINED',
    bottleType: '50ml Heavy Italian Crimp Flacon (Gold Collar)',
    packagingAvailability: 'AVAILABLE' as 'AVAILABLE' | 'LOW_PACKAGING' | 'AWAITING_COFFRET' | 'UNAVAILABLE',
    batchReleaseStatus: 'UNRELEASED' as 'UNRELEASED' | 'RELEASED' | 'RECALLED' | 'BLOCKED',
    notes: 'Macerated in temperature-controlled vault; GC-MS purity verified.'
  });

  // Reconciliation & Verification state
  const [reconciliationReport, setReconciliationReport] = useState<any | null>(null);
  const [runningReconciliation, setRunningReconciliation] = useState(false);
  const [verificationResults, setVerificationResults] = useState<any | null>(null);
  const [runningTests, setRunningTests] = useState(false);

  const fetchOpsData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ops/dashboard');
      if (res.ok) {
        const data = await res.json();
        setLedger(data.inventoryLedger || []);
        setBatches(data.productionBatches || []);
        setTasksAndAlerts(data.tasksAndAlerts || []);
      }
    } catch (e) {
      console.warn('[AdminInventory] Failed to load ops dashboard:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOpsData();
  }, [fetchOpsData]);

  const handleQuickAdjust = async (sku: string, delta: number) => {
    try {
      const res = await fetch('/api/ops/inventory/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku,
          adjustmentType: delta > 0 ? 'RECEIVE_STOCK' : 'MANUAL_OPENING_ADJUST',
          quantity: delta,
          notes: `Quick Admin stock adjustment (${delta > 0 ? '+' : ''}${delta})`
        })
      });
      const data = await res.json();
      if (!res.ok) {
        showNotification(data.error || 'Stock adjustment failed');
        return;
      }
      showNotification(`SKU ${sku} adjusted by ${delta > 0 ? '+' : ''}${delta} units atomically.`);
      await fetchOpsData();
    } catch {
      showNotification('Failed to adjust SKU inventory.');
    }
  };

  const handleSubmitSkuAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSkuRow) return;
    try {
      const res = await fetch('/api/ops/inventory/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: selectedSkuRow.sku,
          adjustmentType: adjustType,
          quantity: adjustType === 'UPDATE_THRESHOLDS' ? 0 : adjustQty,
          reorderThreshold: customReorderThreshold,
          alertThresholds: [20, 10, 5],
          targetStockLevel: customTargetStock,
          notes: adjustNotes || `${adjustType} via Inventory Ledger Console`
        })
      });
      const data = await res.json();
      if (!res.ok) {
        showNotification(data.error || 'Adjustment rejected by atomic guard.');
        return;
      }
      showNotification(`Updated ledger for ${selectedSkuRow.sku}.`);
      setSelectedSkuRow(null);
      await fetchOpsData();
    } catch {
      showNotification('Failed to update SKU ledger.');
    }
  };

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const matchedSku = ledger.find((r) => r.sku === batchForm.sku) || ledger[0];
    try {
      const res = await fetch('/api/ops/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...batchForm,
          productId: matchedSku?.productId || 'prod-golden-hour',
          productName: matchedSku?.productName || 'GOLDEN HOUR',
          variantId: matchedSku?.variantId || 'golden-hour-50ml',
          size: matchedSku?.size || '50 ml'
        })
      });
      const data = await res.json();
      if (!res.ok) {
        showNotification(data.error || 'Failed to save production batch');
        return;
      }
      if (data.blockReasons?.length > 0) {
        showNotification(
          `Batch ${batchForm.batchNumber} logged. Sale guard active: ${data.blockReasons[0]}`
        );
      } else {
        showNotification(`Production batch ${batchForm.batchNumber} created.`);
      }
      setIsBatchModalOpen(false);
      await fetchOpsData();
    } catch {
      showNotification('Error saving production batch.');
    }
  };

  const handleReleaseBatch = async (batchId: string) => {
    try {
      const res = await fetch(`/api/ops/batches/${encodeURIComponent(batchId)}/release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor: 'gowisherharsha@gmail.com' })
      });
      const data = await res.json();
      showNotification(data.reason || 'Batch release evaluated.');
      await fetchOpsData();
    } catch {
      showNotification('Failed to release batch.');
    }
  };

  const handleResolveTask = async (taskId: string, action: 'APPROVED' | 'DISMISSED') => {
    try {
      await fetch(`/api/ops/tasks/${encodeURIComponent(taskId)}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, adminEmail: 'gowisherharsha@gmail.com' })
      });
      showNotification(`Governance item marked ${action}.`);
      await fetchOpsData();
    } catch {
      showNotification('Failed to update task status.');
    }
  };

  const handleRunReconciliation = async (autoFix: boolean) => {
    setRunningReconciliation(true);
    try {
      const res = await fetch('/api/ops/reconciliation/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoFixLedgerDrift: autoFix })
      });
      const data = await res.json();
      setReconciliationReport(data);
      showNotification(
        `Reconciliation complete: ${data.mismatchesFound} mismatch(es) found, ${data.autoHealedCount} auto-reconciled.`
      );
      await fetchOpsData();
    } catch {
      showNotification('Reconciliation job failed.');
    } finally {
      setRunningReconciliation(false);
    }
  };

  const handleRunOpsTests = async () => {
    setRunningTests(true);
    try {
      const res = await fetch('/api/ops/run-tests', { method: 'POST' });
      const data = await res.json();
      setVerificationResults(data);
      showNotification(
        `Operations Automation Suite: ${data.passedCount}/${data.totalCount} scenarios passed.`
      );
      await fetchOpsData();
    } catch {
      showNotification('Failed to run operations verification suite.');
    } finally {
      setRunningTests(false);
    }
  };

  const filteredLedger = ledger.filter(
    (r) =>
      r.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.size.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const inventoryTasks = tasksAndAlerts.filter((t) =>
    ['LOW_STOCK_ALERT', 'PROCUREMENT_QUEUE', 'AD_CAMPAIGN_FLAG', 'PROMO_PAUSE_RECOMMENDATION'].includes(
      t.category
    )
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-mono text-xs">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-6 border-b border-white/10 gap-4">
        <div>
          <h2 className="font-serif text-2xl uppercase tracking-wider text-white">
            Inventory Automation, Production Batches & Procurement Governance
          </h2>
          <p className="text-xs text-white/50 mt-1">
            Atomic per-SKU stock ledger, multi-tier low-stock alerts (20 / 10 / 5 units), fragrance batch QC release guards, and cross-module reconciliation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <ErpTableExportBar
            reportKey="custom_table"
            title="FRAGMORÉ Storefront SKU Inventory Ledger"
            customRows={filteredLedger.map((r) => ({
              sku: r.sku,
              productName: r.productName,
              size: r.size,
              openingStock: r.openingStock,
              receivedStock: r.receivedStock,
              reservedStock: r.reservedStock,
              availableStock: r.availableStock,
              soldStock: r.soldStock,
              damagedStock: r.damagedStock,
              reorderThreshold: r.reorderThreshold,
              status: r.procurementStatus
            }))}
            notify={(m) => showNotification(m)}
          />
          <button
            onClick={handleRunOpsTests}
            disabled={runningTests}
            className="px-3.5 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 rounded-lg font-bold flex items-center gap-1.5"
          >
            <FlaskConical className="w-3.5 h-3.5" />
            {runningTests ? 'Verifying 6 Modules...' : 'Verify Interconnected Ops'}
          </button>

          <button
            onClick={() => handleRunReconciliation(true)}
            disabled={runningReconciliation}
            className="px-3.5 py-2 bg-[#D4AF37]/20 hover:bg-[#D4AF37]/30 text-[#E5C378] border border-[#D4AF37]/40 rounded-lg font-bold flex items-center gap-1.5"
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            {runningReconciliation ? 'Reconciling...' : 'Run Reconciliation Job'}
          </button>

          <button
            onClick={fetchOpsData}
            className="p-2 bg-white/5 hover:bg-white/10 text-white/70 rounded-lg border border-white/10"
            title="Refresh Ledger"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Verification Suite Results Banner */}
      {verificationResults && (
        <div className="bg-[#121218] border border-emerald-500/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-white font-bold uppercase">
              Interconnected Operations Verification ({verificationResults.passedCount}/{verificationResults.totalCount} Passed)
            </span>
            <button
              onClick={() => setVerificationResults(null)}
              className="text-white/40 hover:text-white text-[11px]"
            >
              Dismiss
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {(verificationResults.results || []).map((r: any) => (
              <div
                key={r.id}
                className={`p-2.5 rounded-lg border flex items-start gap-2 ${
                  r.passed
                    ? 'bg-emerald-500/10 border-emerald-500/25'
                    : 'bg-rose-500/10 border-rose-500/30'
                }`}
              >
                {r.passed ? (
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <X className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="text-white font-bold text-[11px]">{r.scenario}</div>
                  <div className="text-white/60 text-[10px]">{r.details}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-2">
        {[
          { id: 'ledger', label: `1. Atomic SKU Ledger (${ledger.length})` },
          { id: 'batches', label: `2. Fragrance Production Batches (${batches.length})` },
          {
            id: 'procurement',
            label: `3. Low-Stock Alerts, Procurement & Ad Flags (${
              inventoryTasks.filter((t) => t.status !== 'DISMISSED').length
            })`
          },
          { id: 'reconciliation', label: '4. Cross-Module Reconciliation' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3.5 py-2 rounded-lg font-bold uppercase text-[11px] transition ${
              activeTab === tab.id
                ? 'bg-[#D4AF37] text-black'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: ATOMIC SKU INVENTORY LEDGER */}
      {activeTab === 'ledger' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 bg-[#121218] border border-white/10 rounded-xl px-4 py-2.5">
            <Search className="w-4 h-4 text-white/40" />
            <input
              type="text"
              placeholder="Filter SKU ledger by SKU code, fragrance name, or variant size..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent text-xs text-white placeholder-white/40 focus:outline-none flex-1"
            />
          </div>

          <div className="bg-[#121218] border border-white/10 rounded-xl overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10 text-white/40 uppercase text-[10px]">
                  <th className="p-3.5">SKU & Variant</th>
                  <th className="p-3.5">Opening</th>
                  <th className="p-3.5">Received</th>
                  <th className="p-3.5">Reserved</th>
                  <th className="p-3.5">Available</th>
                  <th className="p-3.5">Sold</th>
                  <th className="p-3.5">Returned (Sellable)</th>
                  <th className="p-3.5">Damaged</th>
                  <th className="p-3.5">Reorder Threshold</th>
                  <th className="p-3.5 text-right">Atomic Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredLedger.map((row) => {
                  const avail = row.availableStock;
                  const alertTier =
                    avail === 0
                      ? 'OUT OF STOCK'
                      : avail <= 5
                      ? 'CRITICAL (≤5)'
                      : avail <= 10
                      ? 'HIGH (≤10)'
                      : avail <= 20 || avail <= row.reorderThreshold
                      ? `LOW (≤${row.reorderThreshold})`
                      : null;

                  return (
                    <tr key={row.sku} className="hover:bg-white/[0.02]">
                      <td className="p-3.5">
                        <strong className="text-[#D4AF37] block font-bold">{row.sku}</strong>
                        <span className="text-white font-serif uppercase">{row.productName}</span> ·{' '}
                        <span className="text-white/60">{row.size}</span>
                      </td>
                      <td className="p-3.5 text-white/80">{row.openingStock}</td>
                      <td className="p-3.5 text-sky-400">+{row.receivedStock}</td>
                      <td className="p-3.5 text-amber-400 font-bold">{row.reservedStock}</td>
                      <td className="p-3.5">
                        <span
                          className={`font-bold text-sm ${
                            avail === 0
                              ? 'text-rose-400'
                              : avail <= row.reorderThreshold
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {avail}
                        </span>
                        {alertTier && (
                          <span className="block text-[9px] px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 font-bold mt-0.5 w-fit">
                            {alertTier}
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-white">{row.soldStock}</td>
                      <td className="p-3.5 text-emerald-300">{row.returnedSellableStock}</td>
                      <td className="p-3.5 text-rose-400">{row.damagedStock}</td>
                      <td className="p-3.5 text-white/60">
                        {row.reorderThreshold} units
                        <span className="block text-[9px] text-white/40">
                          Alerts: 20 / 10 / 5
                        </span>
                      </td>
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => handleQuickAdjust(row.sku, -5)}
                            className="px-2 py-1 bg-white/5 hover:bg-white/15 text-white/70 rounded text-[10px]"
                          >
                            -5
                          </button>
                          <button
                            onClick={() => handleQuickAdjust(row.sku, 10)}
                            className="px-2 py-1 bg-[#D4AF37]/20 hover:bg-[#D4AF37]/30 text-[#E5C378] rounded text-[10px] font-bold"
                          >
                            +10
                          </button>
                          <button
                            onClick={() => {
                              setSelectedSkuRow(row);
                              setCustomReorderThreshold(row.reorderThreshold);
                              setCustomTargetStock(row.targetStockLevel || 60);
                            }}
                            className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-[10px] ml-1"
                          >
                            Ledger & Rules
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: FRAGRANCE PRODUCTION BATCHES */}
      {activeTab === 'batches' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-[#121218] border border-white/10 rounded-xl p-4">
            <div>
              <h3 className="text-white font-serif uppercase text-sm">
                Atelier Fragrance Maceration & Batch Release Ledger
              </h3>
              <p className="text-[11px] text-white/50">
                Strict Guard: Batches with QC ≠ PASSED, Packaging ≠ AVAILABLE, or Status ≠ RELEASED are automatically blocked from sale and inventory receipt.
              </p>
            </div>
            <button
              onClick={() => setIsBatchModalOpen(true)}
              className="px-4 py-2 bg-[#D4AF37] hover:bg-[#e5c358] text-black font-bold rounded-lg flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Log Production Batch
            </button>
          </div>

          <div className="bg-[#121218] border border-white/10 rounded-xl overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10 text-white/40 uppercase text-[10px]">
                  <th className="p-3.5">Batch #</th>
                  <th className="p-3.5">Fragrance Variant</th>
                  <th className="p-3.5">Mfg / Best-Before</th>
                  <th className="p-3.5">Finished Qty</th>
                  <th className="p-3.5">Bottle Type</th>
                  <th className="p-3.5">QC Status</th>
                  <th className="p-3.5">Packaging</th>
                  <th className="p-3.5">Release Status</th>
                  <th className="p-3.5 text-right">Batch Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {batches.map((b) => {
                  const isReadyForSale =
                    b.qcStatus === 'PASSED' &&
                    b.packagingAvailability === 'AVAILABLE' &&
                    b.batchReleaseStatus === 'RELEASED';

                  return (
                    <tr key={b.id} className="hover:bg-white/[0.02]">
                      <td className="p-3.5 font-bold text-[#D4AF37]">{b.batchNumber}</td>
                      <td className="p-3.5">
                        <strong className="text-white block">{b.productName}</strong>
                        <span className="text-white/50 text-[10px]">
                          {b.sku} · {b.size}
                        </span>
                      </td>
                      <td className="p-3.5 text-white/70">
                        <div>Mfg: {b.manufacturingDate}</div>
                        <div className="text-[10px] text-white/40">Exp: {b.expiryDate}</div>
                      </td>
                      <td className="p-3.5 font-bold text-white">{b.finishedQuantity} flacons</td>
                      <td className="p-3.5 text-white/70 max-w-[180px]">{b.bottleType}</td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            b.qcStatus === 'PASSED'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : b.qcStatus === 'PENDING_QC'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {b.qcStatus}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            b.packagingAvailability === 'AVAILABLE'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {b.packagingAvailability}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isReadyForSale
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {b.batchReleaseStatus}
                        </span>
                        {!isReadyForSale && (
                          <span className="block text-[9px] text-rose-400 mt-0.5">
                            Blocked from sale
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-right">
                        {b.releasedToInventory ? (
                          <span className="text-emerald-400 font-bold text-[10px] inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Credited to Stock
                          </span>
                        ) : (
                          <button
                            onClick={() => handleReleaseBatch(b.id)}
                            className="px-3 py-1.5 bg-[#D4AF37]/20 hover:bg-[#D4AF37]/30 text-[#E5C378] rounded font-bold text-[10px]"
                          >
                            Verify & Release to Stock
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: LOW-STOCK ALERTS, PROCUREMENT QUEUE & AD CAMPAIGN FLAGS */}
      {activeTab === 'procurement' && (
        <div className="space-y-4">
          <div className="p-4 bg-[#121218] border border-white/10 rounded-xl flex items-center justify-between">
            <div>
              <h3 className="text-white font-serif uppercase text-sm">
                Automated Low-Stock Governance, Procurement Queue & Campaign Review Flags
              </h3>
              <p className="text-[11px] text-white/50">
                Governance Guard: Supplier purchase orders and advertising budget changes are never executed automatically without explicit Admin approval.
              </p>
            </div>
          </div>

          {inventoryTasks.length === 0 ? (
            <div className="p-8 bg-[#121218] border border-white/10 rounded-xl text-center text-white/40">
              All SKUs are above their reorder thresholds.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {inventoryTasks.map((task) => (
                <div
                  key={task.id}
                  className="p-4 bg-[#121218] border border-white/10 rounded-xl space-y-2.5 flex flex-col justify-between"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                          task.severity === 'CRITICAL'
                            ? 'bg-rose-500/20 text-rose-300'
                            : task.severity === 'HIGH'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-sky-500/20 text-sky-300'
                        }`}
                      >
                        {task.category.replace(/_/g, ' ')} · {task.severity}
                      </span>
                      <span className="text-[10px] text-white/40">{task.status}</span>
                    </div>
                    <h4 className="text-white font-bold text-xs">{task.title}</h4>
                    <p className="text-white/60 text-[11px]">{task.description}</p>
                    {task.suggestedReorderQty && (
                      <div className="text-[#D4AF37] font-bold text-[11px]">
                        Suggested Reorder Quantity: {task.suggestedReorderQty} units
                      </div>
                    )}
                  </div>

                  {task.status === 'PENDING_APPROVAL' || task.status === 'OPEN' ? (
                    <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                      <button
                        onClick={() => handleResolveTask(task.id, 'APPROVED')}
                        className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded font-bold text-[10px]"
                      >
                        Approve Recommended Action
                      </button>
                      <button
                        onClick={() => handleResolveTask(task.id, 'DISMISSED')}
                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/60 rounded text-[10px]"
                      >
                        Dismiss
                      </button>
                    </div>
                  ) : (
                    <div className="text-[10px] text-emerald-400 font-bold pt-1">
                      Resolved ({task.status})
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: CROSS-MODULE RECONCILIATION */}
      {activeTab === 'reconciliation' && (
        <div className="space-y-4">
          <div className="p-5 bg-[#121218] border border-white/10 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-white font-serif uppercase text-base">
                Orders ↔ Payments ↔ Shipments ↔ Inventory ↔ Production Reconciliation Engine
              </h3>
              <p className="text-xs text-white/50 mt-1">
                Audits every order payment state, carrier delivery proof, SKU ledger equation, unreleased batch guard, and return restock disposition.
              </p>
            </div>
            <button
              onClick={() => handleRunReconciliation(true)}
              disabled={runningReconciliation}
              className="px-4 py-2.5 bg-[#D4AF37] text-black font-bold rounded-lg shrink-0"
            >
              {runningReconciliation ? 'Auditing Ledger...' : 'Execute Full Reconciliation Audit'}
            </button>
          </div>

          {reconciliationReport && (
            <div className="bg-[#121218] border border-white/10 rounded-xl p-5 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-3 bg-white/[0.02] rounded-lg border border-white/5">
                  <span className="text-[10px] text-white/40 uppercase block">Orders Audited</span>
                  <span className="text-lg font-bold text-white">
                    {reconciliationReport.totalChecked?.orders || 0}
                  </span>
                </div>
                <div className="p-3 bg-white/[0.02] rounded-lg border border-white/5">
                  <span className="text-[10px] text-white/40 uppercase block">SKUs Audited</span>
                  <span className="text-lg font-bold text-white">
                    {reconciliationReport.totalChecked?.skus || 0}
                  </span>
                </div>
                <div className="p-3 bg-white/[0.02] rounded-lg border border-white/5">
                  <span className="text-[10px] text-white/40 uppercase block">Batches Audited</span>
                  <span className="text-lg font-bold text-white">
                    {reconciliationReport.totalChecked?.batches || 0}
                  </span>
                </div>
                <div className="p-3 bg-white/[0.02] rounded-lg border border-white/5">
                  <span className="text-[10px] text-white/40 uppercase block">Mismatches Found</span>
                  <span className="text-lg font-bold text-amber-400">
                    {reconciliationReport.mismatchesFound || 0}
                  </span>
                </div>
                <div className="p-3 bg-white/[0.02] rounded-lg border border-white/5">
                  <span className="text-[10px] text-white/40 uppercase block">Auto-Reconciled</span>
                  <span className="text-lg font-bold text-emerald-400">
                    {reconciliationReport.autoHealedCount || 0}
                  </span>
                </div>
              </div>

              {(reconciliationReport.anomalies || []).length === 0 ? (
                <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold">
                  Zero unresolved discrepancies across Orders, Payments, Shipments, Production Batches, and SKU Inventory.
                </div>
              ) : (
                <div className="space-y-2">
                  {reconciliationReport.anomalies.map((a: any) => (
                    <div
                      key={a.id}
                      className="p-3 rounded-lg bg-white/[0.02] border border-white/10 flex items-center justify-between"
                    >
                      <div>
                        <span className="text-amber-300 font-bold">[{a.domain}]</span>{' '}
                        <span className="text-white">{a.description}</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-white/70">
                        {a.autoHealed ? 'Auto-Reconciled' : 'Flagged for Review'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SKU LEDGER ADJUSTMENT & MOVEMENT HISTORY MODAL */}
      {selectedSkuRow && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedSkuRow(null);
          }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-[#121218] border border-white/15 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <span className="text-[10px] text-[#D4AF37] uppercase font-bold">
                  SKU Ledger & Threshold Configuration
                </span>
                <h3 className="text-lg font-serif text-white">
                  {selectedSkuRow.productName} ({selectedSkuRow.size}) — {selectedSkuRow.sku}
                </h3>
              </div>
              <button
                onClick={() => setSelectedSkuRow(null)}
                className="px-3 py-1 rounded bg-white/10 text-white/70 hover:text-white"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSubmitSkuAdjustment} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase text-white/50 mb-1">
                  Ledger Operation
                </label>
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value as any)}
                  className="w-full bg-black/40 border border-white/15 rounded-lg p-2.5 text-white"
                >
                  <option value="RECEIVE_STOCK">Receive New Stock (+Received)</option>
                  <option value="DAMAGE_WRITE_OFF">Record Damaged Stock (+Damaged / -Available)</option>
                  <option value="MANUAL_OPENING_ADJUST">Adjust Opening Stock</option>
                  <option value="UPDATE_THRESHOLDS">Update Reorder & Alert Thresholds Only</option>
                </select>
              </div>

              {adjustType !== 'UPDATE_THRESHOLDS' && (
                <div>
                  <label className="block text-[10px] uppercase text-white/50 mb-1">
                    Quantity (Units)
                  </label>
                  <input
                    type="number"
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(Number(e.target.value))}
                    className="w-full bg-black/40 border border-white/15 rounded-lg p-2.5 text-white"
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] uppercase text-white/50 mb-1">
                  Product-Specific Reorder Threshold (Units)
                </label>
                <input
                  type="number"
                  value={customReorderThreshold}
                  onChange={(e) => setCustomReorderThreshold(Number(e.target.value))}
                  className="w-full bg-black/40 border border-white/15 rounded-lg p-2.5 text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase text-white/50 mb-1">
                  Target Replenishment Level (Units)
                </label>
                <input
                  type="number"
                  value={customTargetStock}
                  onChange={(e) => setCustomTargetStock(Number(e.target.value))}
                  className="w-full bg-black/40 border border-white/15 rounded-lg p-2.5 text-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[10px] uppercase text-white/50 mb-1">
                  Audit Note
                </label>
                <input
                  type="text"
                  placeholder="Reason for stock movement or threshold change..."
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  className="w-full bg-black/40 border border-white/15 rounded-lg p-2.5 text-white"
                />
              </div>

              <div className="sm:col-span-2 flex justify-end gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#D4AF37] text-black font-bold rounded-lg"
                >
                  Apply Atomic Ledger Update
                </button>
              </div>
            </form>

            {/* Audit Movement History */}
            <div className="space-y-2 pt-3 border-t border-white/10">
              <div className="text-[10px] uppercase text-white/50 font-bold">
                Auditable Stock Movements ({selectedSkuRow.movementsHistory?.length || 0})
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {(selectedSkuRow.movementsHistory || []).map((m) => (
                  <div
                    key={m.id}
                    className="p-2.5 rounded bg-white/[0.02] border border-white/5 flex items-center justify-between"
                  >
                    <div>
                      <span className="text-[#D4AF37] font-bold">{m.movementType}</span> ·{' '}
                      <span className="text-white">{m.notes}</span>
                      <div className="text-[10px] text-white/40">
                        Ref: {m.referenceId} · {new Date(m.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-white font-bold block">Qty: {m.quantity}</span>
                      <span className="text-[10px] text-emerald-400">
                        Avail: {m.resultingAvailable}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE PRODUCTION BATCH MODAL */}
      {isBatchModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsBatchModalOpen(false);
          }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-[#121218] border border-white/15 rounded-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-serif text-lg uppercase text-white">
                Log Fragrance Production Batch
              </h3>
              <button
                onClick={() => setIsBatchModalOpen(false)}
                className="text-white/50 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBatch} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase text-white/50 mb-1">
                    Batch Number
                  </label>
                  <input
                    type="text"
                    required
                    value={batchForm.batchNumber}
                    onChange={(e) => setBatchForm({ ...batchForm, batchNumber: e.target.value })}
                    className="w-full bg-black/40 border border-white/15 rounded p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-white/50 mb-1">
                    Target SKU Variant
                  </label>
                  <select
                    value={batchForm.sku}
                    onChange={(e) => setBatchForm({ ...batchForm, sku: e.target.value })}
                    className="w-full bg-black/40 border border-white/15 rounded p-2 text-white"
                  >
                    {ledger.map((r) => (
                      <option key={r.sku} value={r.sku}>
                        {r.productName} ({r.size}) — {r.sku}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase text-white/50 mb-1">
                    Manufacturing Date
                  </label>
                  <input
                    type="date"
                    value={batchForm.manufacturingDate}
                    onChange={(e) =>
                      setBatchForm({ ...batchForm, manufacturingDate: e.target.value })
                    }
                    className="w-full bg-black/40 border border-white/15 rounded p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-white/50 mb-1">
                    Expiry / Best-Before Date
                  </label>
                  <input
                    type="date"
                    value={batchForm.expiryDate}
                    onChange={(e) => setBatchForm({ ...batchForm, expiryDate: e.target.value })}
                    className="w-full bg-black/40 border border-white/15 rounded p-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase text-white/50 mb-1">
                    Finished Quantity
                  </label>
                  <input
                    type="number"
                    value={batchForm.finishedQuantity}
                    onChange={(e) =>
                      setBatchForm({ ...batchForm, finishedQuantity: Number(e.target.value) })
                    }
                    className="w-full bg-black/40 border border-white/15 rounded p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-white/50 mb-1">
                    Quality Control (QC) Status
                  </label>
                  <select
                    value={batchForm.qcStatus}
                    onChange={(e) =>
                      setBatchForm({ ...batchForm, qcStatus: e.target.value as any })
                    }
                    className="w-full bg-black/40 border border-white/15 rounded p-2 text-white"
                  >
                    <option value="PASSED">PASSED</option>
                    <option value="PENDING_QC">PENDING_QC (Blocked from sale)</option>
                    <option value="FAILED">FAILED (Blocked from sale)</option>
                    <option value="QUARANTINED">QUARANTINED (Blocked from sale)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase text-white/50 mb-1">
                    Packaging Availability
                  </label>
                  <select
                    value={batchForm.packagingAvailability}
                    onChange={(e) =>
                      setBatchForm({ ...batchForm, packagingAvailability: e.target.value as any })
                    }
                    className="w-full bg-black/40 border border-white/15 rounded p-2 text-white"
                  >
                    <option value="AVAILABLE">AVAILABLE</option>
                    <option value="AWAITING_COFFRET">AWAITING_COFFRET (Blocked)</option>
                    <option value="LOW_PACKAGING">LOW_PACKAGING (Blocked)</option>
                    <option value="UNAVAILABLE">UNAVAILABLE (Blocked)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-white/50 mb-1">
                    Batch Release Status
                  </label>
                  <select
                    value={batchForm.batchReleaseStatus}
                    onChange={(e) =>
                      setBatchForm({ ...batchForm, batchReleaseStatus: e.target.value as any })
                    }
                    className="w-full bg-black/40 border border-white/15 rounded p-2 text-white"
                  >
                    <option value="UNRELEASED">UNRELEASED</option>
                    <option value="RELEASED">RELEASED (If QC & Packaging Pass)</option>
                    <option value="RECALLED">RECALLED</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase text-white/50 mb-1">
                  Bottle & Atomizer Specification
                </label>
                <input
                  type="text"
                  value={batchForm.bottleType}
                  onChange={(e) => setBatchForm({ ...batchForm, bottleType: e.target.value })}
                  className="w-full bg-black/40 border border-white/15 rounded p-2 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsBatchModalOpen(false)}
                  className="px-4 py-2 bg-white/5 text-white/70 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#D4AF37] text-black font-bold rounded"
                >
                  Save Production Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
