import React, { useState, useEffect, useCallback } from 'react';
import {
  Boxes,
  FlaskConical,
  ShieldCheck,
  Warehouse,
  Plus,
  Upload,
  Check,
  AlertTriangle,
  RefreshCw,
  FileSpreadsheet,
  Scale,
  ArrowLeftRight,
  Lock,
  Printer,
  Edit3,
  X
} from 'lucide-react';
import {
  erpApi,
  downloadCsvFile,
  downloadExcelSpreadsheet,
  type ErpWorkspaceSnapshot,
  type ErpManufacturingSnapshot
} from '../../../lib/erpApi';
import { ManufacturingPrintModal, type MfgPrintDoc } from './ManufacturingPrintModal';
import { ErpSamplingAndQcWorkspace } from './ErpSamplingAndQcWorkspace';
import { ErpTableExportBar } from './ErpUniversalExportModal';

interface Props {
  snapshot: ErpWorkspaceSnapshot;
  activeModule: 'ERP_MATERIALS' | 'ERP_FORMULATIONS' | 'ERP_QUALITY' | 'ERP_WAREHOUSE';
  onRefresh: () => Promise<void>;
  notify: (msg: string, type?: 'success' | 'error') => void;
}

const STOCK_CATEGORIES = [
  'RAW_MATERIAL',
  'FRAGRANCE_OIL',
  'PACKAGING',
  'WIP',
  'FINISHED_GOODS',
  'SAMPLE',
  'DAMAGED'
] as const;

export const ErpSupplyAndLabModules: React.FC<Props> = ({
  snapshot,
  activeModule,
  onRefresh,
  notify
}) => {
  const [busy, setBusy] = useState(false);
  const [mfgSnap, setMfgSnap] = useState<ErpManufacturingSnapshot | null>(null);
  const [printDoc, setPrintDoc] = useState<MfgPrintDoc | null>(null);

  const loadMfgSnapshot = useCallback(async () => {
    try {
      const m = await erpApi.getManufacturingSnapshot();
      setMfgSnap(m);
    } catch {
      // Non-fatal fallback to bootstrap snapshot if limited permissions
    }
  }, []);

  useEffect(() => {
    loadMfgSnapshot();
  }, [loadMfgSnapshot, snapshot]);

  // Materials, Density & Ledger State
  const [matSubTab, setMatSubTab] = useState<'materials' | 'lots' | 'movements' | 'grn'>('materials');
  const [movementCategoryFilter, setMovementCategoryFilter] = useState<string>('ALL');
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [matForm, setMatForm] = useState({
    code: '',
    name: '',
    category: 'ESSENTIAL_OIL',
    stockType: 'FRAGRANCE_OIL',
    uom: 'kg',
    densityGPerMl: '0.885',
    densityValidated: true,
    retestIntervalDays: 365,
    unitCostInr: 4500,
    openingStock: 25,
    reorderLevel: 15,
    warehouseLocation: 'VAULT-OIL-A1',
    casNumber: ''
  });

  // Interactive Density Unit Conversion Checker
  const [convForm, setConvForm] = useState({
    materialId: snapshot.materials[0]?.id || '',
    qty: 5,
    fromUom: 'kg',
    toUom: 'l'
  });
  const [convResult, setConvResult] = useState<{ convertedQty?: number; densityUsedGPerMl?: number | null; error?: string } | null>(null);

  // Stock Movement Ledger Modal (for a selected Lot)
  const [movementModalLot, setMovementModalLot] = useState<any | null>(null);
  const [movementForm, setMovementForm] = useState({
    movementType: 'SAMPLE_ISSUE' as 'SAMPLE_ISSUE' | 'DAMAGE_WRITEOFF' | 'RETURN' | 'ADJUSTMENT' | 'REWORK',
    direction: 'OUT' as 'IN' | 'OUT',
    qty: 1,
    reason: '',
    targetWarehouseLocation: '',
    qcStatus: ''
  });

  const [grnForm, setGrnForm] = useState({
    purchaseOrderId: snapshot.procurement.purchaseOrders[0]?.id || '',
    warehouseId: snapshot.warehouses[0]?.id || 'wh-mumbai-rm',
    challanNumber: `CH-${Date.now().toString().slice(-4)}`,
    notes: 'Physical inward count verified at receiving bay.'
  });
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [csvRawText, setCsvRawText] = useState(
    'code,name,category,uom,unitCostInr,currentStock,reorderLevel\nMAT-BERGAMOT,Calabrian Bergamot Cold-Pressed Oil,ESSENTIAL_OIL,kg,8900,18,10'
  );

  // Formulations State (Advanced)
  const [selectedFormulaId, setSelectedFormulaId] = useState<string>(snapshot.formulations[0]?.id || '');
  const [formulaForm, setFormulaForm] = useState({
    formulationId: '',
    name: '',
    fragranceFamily: 'Amber Woody',
    concentrationType: 'Extrait de Parfum 28%',
    macerationDays: 21,
    targetBatchSize: 10,
    targetBatchUnit: 'l' as 'kg' | 'l',
    expectedYieldPct: 98,
    supportedBottleSizesCsv: '2ML, 10ML, 15ML, 30ML, 50ML',
    confidentialityLevel: 'RESTRICTED' as 'STANDARD' | 'RESTRICTED' | 'TOP_SECRET_MASTER',
    changeSummary: '',
    submitForApproval: true,
    ingredients: [
      { materialId: 'mat-conc-gold', materialName: 'Golden Hour Concentrate', notePyramid: 'HEART' as 'TOP' | 'HEART' | 'BASE' | 'SOLVENT' | 'FIXATIVE', percentage: 28, costPerKgInr: 11800 },
      { materialId: 'mat-solv-eth', materialName: 'Organic Perfumery Ethanol', notePyramid: 'SOLVENT' as 'TOP' | 'HEART' | 'BASE' | 'SOLVENT' | 'FIXATIVE', percentage: 72, costPerKgInr: 320 }
    ]
  });

  // Warehouse & Finished Goods State
  const [whSubTab, setWhSubTab] = useState<'fg' | 'warehouses'>('fg');
  const [whForm, setWhForm] = useState({
    code: '',
    name: '',
    warehouseType: 'FINISHED_GOODS',
    city: 'Mumbai',
    state: 'Maharashtra',
    address: '',
    capacityUnits: 20000,
    temperatureControlled: true
  });
  const [fgEdit, setFgEdit] = useState<{ id: string; binLocation: string; delta: number; version: number } | null>(null);

  const runAction = async (fn: () => Promise<void>, successMessage: string) => {
    setBusy(true);
    try {
      await fn();
      await Promise.all([onRefresh(), loadMfgSnapshot()]);
      notify(successMessage, 'success');
    } catch (e: any) {
      notify(e?.message || 'Operation failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const activeMaterials = mfgSnap?.materials || snapshot.materials;
  const activeLots = mfgSnap?.lots || snapshot.stockLots;
  const activeMovements = mfgSnap?.movements || [];
  const activeFormulations = mfgSnap?.formulations || snapshot.formulations;
  const activeFormulaVersions = mfgSnap?.formulationVersions || snapshot.formulationVersions;
  const activeFinishedGoods = mfgSnap?.finishedGoods || snapshot.finishedGoods;

  // --------------------------------------------------------------------------
  // MODULE 3: INVENTORY, DENSITY VALIDATION & IMMUTABLE STOCK MOVEMENT LEDGER
  // --------------------------------------------------------------------------
  if (activeModule === 'ERP_MATERIALS') {
    const lowCount = activeMaterials.filter((m) => m.currentStock <= m.reorderLevel).length;
    const missingDensityCount = mfgSnap?.kpis?.missingDensityFluidsCount ?? activeMaterials.filter(
      (m) => ['g', 'kg', 'ml', 'l'].includes(String(m.uom || '').toLowerCase()) && (!m.densityGPerMl || !m.densityValidated)
    ).length;
    const totalValuation = activeMaterials.reduce((s, m) => s + Number(m.currentStock || 0) * Number(m.unitCostInr || 0), 0);
    const valByCat = mfgSnap?.kpis?.valuationByCategory || {};

    const filteredMovements =
      movementCategoryFilter === 'ALL'
        ? activeMovements
        : activeMovements.filter((mv) => mv.stockCategory === movementCategoryFilter);

    const handleCsvImport = async () => {
      const lines = csvRawText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length < 2) {
        notify('Provide a CSV header row and at least one data row.', 'error');
        return;
      }
      const headers = lines[0].split(',').map((h) => h.trim());
      const rows = lines.slice(1).map((line) => {
        const vals = line.split(',').map((v) => v.trim());
        const obj: Record<string, any> = {};
        headers.forEach((h, idx) => {
          obj[h] = vals[idx];
        });
        return obj;
      });
      await runAction(async () => {
        const res = await erpApi.importCsv('materials', rows);
        setCsvImportOpen(false);
        if (res.skippedCount > 0) {
          notify(`Imported ${res.importedCount} rows (${res.skippedCount} skipped validation).`, 'error');
        }
      }, 'Raw materials CSV imported to Firebase Firestore.');
    };

    const handleDensityTest = async (e: React.FormEvent) => {
      e.preventDefault();
      const selectedMat = activeMaterials.find((m) => m.id === convForm.materialId);
      if (!selectedMat) return;
      try {
        const res = await erpApi.convertMaterialUnits({
          qty: Number(convForm.qty),
          fromUom: convForm.fromUom,
          toUom: convForm.toUom,
          densityGPerMl: selectedMat.densityGPerMl ?? null,
          densityValidated: Boolean(selectedMat.densityValidated),
          materialName: selectedMat.name
        });
        setConvResult({ convertedQty: res.convertedQty, densityUsedGPerMl: res.densityUsedGPerMl });
      } catch (err: any) {
        setConvResult({ error: err?.message || 'Density validation failed' });
      }
    };

    const resetMatForm = () => {
      setEditingMaterialId(null);
      setMatForm({
        code: '',
        name: '',
        category: 'ESSENTIAL_OIL',
        stockType: 'FRAGRANCE_OIL',
        uom: 'kg',
        densityGPerMl: '0.885',
        densityValidated: true,
        retestIntervalDays: 365,
        unitCostInr: 4500,
        openingStock: 25,
        reorderLevel: 15,
        warehouseLocation: 'VAULT-OIL-A1',
        casNumber: ''
      });
    };

    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <ManufacturingPrintModal doc={printDoc} onClose={() => setPrintDoc(null)} />

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#DED7CC] pb-4">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-widest text-[#9A783E]">
              Module 03 · Density-Validated Inventory &amp; Ledger
            </p>
            <h2 className="font-serif text-2xl sm:text-3xl text-[#24211D] uppercase tracking-wider mt-1">
              Raw Material, Fragrance Oil &amp; Packaging Inventory
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ErpTableExportBar
              reportKey={
                matSubTab === 'movements'
                  ? 'stock_movements'
                  : matSubTab === 'lots'
                  ? 'stock_valuation'
                  : 'raw_materials'
              }
              notify={notify}
            />
            <button
              onClick={() =>
                setPrintDoc({
                  type: 'MOVEMENT_LEDGER',
                  movements: filteredMovements,
                  filterLabel: movementCategoryFilter,
                  organization: snapshot.organization
                })
              }
              className="px-3 py-1.5 border border-[#DED7CC] bg-[#FFFFFF] hover:border-[#9A783E] text-xs font-mono text-[#24211D] rounded flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-[#9A783E]" />
              <span>Movement Ledger</span>
            </button>
            <button
              onClick={() => setCsvImportOpen((v) => !v)}
              className="px-3 py-1.5 border border-[#DED7CC] bg-[#FFFFFF] hover:border-[#9A783E] text-xs font-mono text-[#24211D] rounded flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-[#9A783E]" />
              <span>Import CSV</span>
            </button>
          </div>
        </div>

        {/* Flat 1px KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-5 border border-[#DED7CC] bg-[#FFFFFF] divide-y sm:divide-y-0 sm:divide-x divide-[#DED7CC] rounded-lg">
          <div className="p-4">
            <span className="text-[11px] font-mono uppercase text-[#686158] block">Materials / Lots</span>
            <span className="text-xl font-mono font-bold text-[#24211D] tabular-nums">
              {activeMaterials.length} / {activeLots.length}
            </span>
          </div>
          <div className="p-4">
            <span className="text-[11px] font-mono uppercase text-[#686158] block">Ledger Entries</span>
            <span className="text-xl font-mono font-bold text-[#24211D] tabular-nums">{activeMovements.length}</span>
          </div>
          <div className="p-4">
            <span className="text-[11px] font-mono uppercase text-[#686158] block">Reorder Alerts</span>
            <span className={`text-xl font-mono font-bold tabular-nums ${lowCount > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
              {lowCount}
            </span>
          </div>
          <div className="p-4">
            <span className="text-[11px] font-mono uppercase text-[#686158] block">Unvalidated Fluids</span>
            <span className={`text-xl font-mono font-bold tabular-nums ${missingDensityCount > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
              {missingDensityCount}
            </span>
          </div>
          <div className="p-4">
            <span className="text-[11px] font-mono uppercase text-[#686158] block">Stock Valuation</span>
            <span className="text-xl font-mono font-bold text-[#9A783E] tabular-nums">
              ₹{Math.round(totalValuation).toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* Category Valuation Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 border border-[#DED7CC] bg-[#FFFFFF] divide-y sm:divide-y-0 sm:divide-x divide-[#DED7CC] rounded-lg text-[11px] font-mono">
          {STOCK_CATEGORIES.map((cat) => (
            <div key={cat} className="p-3">
              <span className="text-[#686158] block truncate">{cat.replace(/_/g, ' ')}</span>
              <span className="font-bold text-[#24211D] tabular-nums">
                ₹{Math.round(Number(valByCat[cat] || 0)).toLocaleString('en-IN')}
              </span>
            </div>
          ))}
        </div>

        {csvImportOpen && (
          <div className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono uppercase font-semibold text-[#24211D]">Validated CSV Bulk Material Import</h3>
              <button onClick={() => setCsvImportOpen(false)} className="text-xs font-mono text-[#686158] cursor-pointer">
                Close
              </button>
            </div>
            <textarea
              value={csvRawText}
              onChange={(e) => setCsvRawText(e.target.value)}
              rows={4}
              className="w-full p-2.5 border border-[#DED7CC] bg-[#FAF8F4] font-mono text-xs rounded focus:border-[#9A783E] focus:outline-none"
            />
            <button
              disabled={busy}
              onClick={handleCsvImport}
              className="px-4 py-2 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono uppercase rounded cursor-pointer"
            >
              Validate &amp; Import Rows
            </button>
          </div>
        )}

        {/* Sub-Navigation */}
        <div className="flex items-center gap-2 border-b border-[#DED7CC] pb-3 overflow-x-auto">
          {[
            { id: 'materials', label: `Material Master (${activeMaterials.length})` },
            { id: 'lots', label: `FIFO Stock Lots (${activeLots.length})` },
            { id: 'movements', label: `Stock Movement Ledger (${activeMovements.length})` },
            { id: 'grn', label: `Goods Receipts / GRN (${snapshot.goodsReceipts.length})` }
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setMatSubTab(t.id as any)}
              className={`px-3 py-1.5 rounded text-xs font-mono whitespace-nowrap shrink-0 cursor-pointer ${
                matSubTab === t.id ? 'bg-[#24211D] text-[#FAF8F4]' : 'bg-[#FFFFFF] border border-[#DED7CC] text-[#24211D]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {matSubTab === 'materials' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                      <tr>
                        <th className="py-2.5 px-3">Code / Material</th>
                        <th className="py-2.5 px-3">Type · UOM</th>
                        <th className="py-2.5 px-3">Density (g/mL)</th>
                        <th className="py-2.5 px-3 text-right">Stock / Min</th>
                        <th className="py-2.5 px-3 text-right">Unit Cost</th>
                        <th className="py-2.5 px-3 text-right">Specs</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DED7CC]">
                      {activeMaterials.map((m) => (
                        <tr key={m.id} className="hover:bg-[#FAF8F4]">
                          <td className="py-2.5 px-3">
                            <span className="font-mono font-semibold text-[#24211D] block">{m.code}</span>
                            <span className="text-[#686158]">{m.name}</span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-[#686158]">
                            {m.stockType || m.category} · <strong>{m.uom}</strong>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] tabular-nums">
                            {m.densityGPerMl ? (
                              <span className={m.densityValidated ? 'text-emerald-700' : 'text-amber-700'}>
                                {Number(m.densityGPerMl).toFixed(3)} g/mL {m.densityValidated ? '✓' : '(Unverified)'}
                              </span>
                            ) : (
                              <span className="text-[#686158]">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#24211D]">
                            <strong>{m.currentStock}</strong> {m.uom}
                            <span className="block text-[10px] text-[#686158]">
                              Res {m.reservedStock || 0} · Min {m.reorderLevel}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                            ₹{Number(m.unitCostInr).toLocaleString('en-IN')}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={() => {
                                setEditingMaterialId(m.id);
                                setMatForm({
                                  code: m.code,
                                  name: m.name,
                                  category: m.category,
                                  stockType: m.stockType || 'RAW_MATERIAL',
                                  uom: m.uom,
                                  densityGPerMl: m.densityGPerMl ? String(m.densityGPerMl) : '',
                                  densityValidated: Boolean(m.densityValidated),
                                  retestIntervalDays: m.retestIntervalDays || 365,
                                  unitCostInr: Number(m.unitCostInr || 0),
                                  openingStock: 0,
                                  reorderLevel: Number(m.reorderLevel || 0),
                                  warehouseLocation: 'VAULT-MAIN',
                                  casNumber: m.casNumber || ''
                                });
                              }}
                              className="text-[11px] font-mono text-[#9A783E] hover:underline cursor-pointer inline-flex items-center gap-1"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Specs</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Density Unit Conversion Validator */}
              <form onSubmit={handleDensityTest} className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DED7CC] pb-2">
                  <div className="flex items-center gap-2">
                    <Scale className="w-4 h-4 text-[#9A783E]" />
                    <h3 className="text-xs font-mono uppercase font-semibold text-[#24211D]">
                      Validated Density Unit Converter (Mass ↔ Volume — Never Assumes 1g = 1mL)
                    </h3>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-end text-xs">
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-mono text-[#686158] block mb-1">Material</label>
                    <select
                      value={convForm.materialId}
                      onChange={(e) => {
                        setConvForm({ ...convForm, materialId: e.target.value });
                        setConvResult(null);
                      }}
                      className="w-full px-2.5 py-1.5 border border-[#DED7CC] rounded bg-[#FAF8F4]"
                    >
                      {activeMaterials.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.code} — {m.name} ({m.densityGPerMl ? `${m.densityGPerMl} g/mL` : 'No Density'})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-[#686158] block mb-1">Quantity</label>
                    <input
                      type="number"
                      step="0.001"
                      value={convForm.qty}
                      onChange={(e) => setConvForm({ ...convForm, qty: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 border border-[#DED7CC] rounded font-mono bg-[#FAF8F4]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <div>
                      <label className="text-[10px] font-mono text-[#686158] block mb-1">From</label>
                      <select
                        value={convForm.fromUom}
                        onChange={(e) => setConvForm({ ...convForm, fromUom: e.target.value })}
                        className="w-full px-2 py-1.5 border border-[#DED7CC] rounded font-mono bg-[#FAF8F4]"
                      >
                        <option value="g">g</option>
                        <option value="kg">kg</option>
                        <option value="ml">ml</option>
                        <option value="l">l</option>
                        <option value="pcs">pcs</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-mono text-[#686158] block mb-1">To</label>
                      <select
                        value={convForm.toUom}
                        onChange={(e) => setConvForm({ ...convForm, toUom: e.target.value })}
                        className="w-full px-2 py-1.5 border border-[#DED7CC] rounded font-mono bg-[#FAF8F4]"
                      >
                        <option value="ml">ml</option>
                        <option value="l">l</option>
                        <option value="g">g</option>
                        <option value="kg">kg</option>
                        <option value="pcs">pcs</option>
                      </select>
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] font-mono text-xs rounded whitespace-nowrap cursor-pointer"
                  >
                    Convert
                  </button>
                </div>
                {convResult && (
                  <div
                    className={`p-2.5 rounded border text-xs font-mono ${
                      convResult.error
                        ? 'bg-rose-50 border-rose-200 text-rose-700'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    }`}
                  >
                    {convResult.error
                      ? `Blocked: ${convResult.error}`
                      : `Verified Result: ${convForm.qty} ${convForm.fromUom} = ${convResult.convertedQty} ${convForm.toUom}${
                          convResult.densityUsedGPerMl ? ` (at validated ${convResult.densityUsedGPerMl} g/mL)` : ''
                        }`}
                  </div>
                )}
              </form>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                runAction(async () => {
                  await erpApi.saveManufacturingMaterial({
                    id: editingMaterialId || undefined,
                    code: matForm.code || undefined,
                    name: matForm.name,
                    category: matForm.category,
                    stockType: matForm.stockType,
                    uom: matForm.uom,
                    densityGPerMl: matForm.densityGPerMl ? Number(matForm.densityGPerMl) : null,
                    densityValidated: matForm.densityValidated,
                    retestIntervalDays: Number(matForm.retestIntervalDays || 365),
                    unitCostInr: Number(matForm.unitCostInr),
                    openingStock: editingMaterialId ? undefined : Number(matForm.openingStock),
                    reorderLevel: Number(matForm.reorderLevel),
                    warehouseLocation: matForm.warehouseLocation,
                    casNumber: matForm.casNumber
                  });
                  resetMatForm();
                }, editingMaterialId ? 'Material specifications updated (stock quantity preserved via ledger).' : 'Material registered with initial Stock Movement Ledger entry.');
              }}
              className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4 space-y-3 h-fit"
            >
              <div className="flex items-center justify-between border-b border-[#DED7CC] pb-2">
                <h3 className="text-xs font-mono uppercase font-semibold text-[#24211D] flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-[#9A783E]" />
                  <span>{editingMaterialId ? 'Update Material & Density' : 'Register Material Master'}</span>
                </h3>
                {editingMaterialId && (
                  <button type="button" onClick={resetMatForm} className="text-[11px] font-mono text-[#686158] hover:underline cursor-pointer">
                    New
                  </button>
                )}
              </div>

              <input
                required
                placeholder="Material Name"
                value={matForm.name}
                onChange={(e) => setMatForm({ ...matForm, name: e.target.value })}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              />

              <div className="grid grid-cols-2 gap-2">
                <input
                  placeholder="Code (auto if blank)"
                  disabled={Boolean(editingMaterialId)}
                  value={matForm.code}
                  onChange={(e) => setMatForm({ ...matForm, code: e.target.value })}
                  className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs font-mono bg-[#FAF8F4] disabled:opacity-60"
                />
                <select
                  value={matForm.stockType}
                  onChange={(e) => setMatForm({ ...matForm, stockType: e.target.value })}
                  className="w-full px-2 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                >
                  <option value="FRAGRANCE_OIL">Fragrance Oil</option>
                  <option value="RAW_MATERIAL">Raw Material / Solvent</option>
                  <option value="PACKAGING">Packaging Component</option>
                  <option value="SAMPLE">Sample Stock</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-mono text-[#686158]">Canonical UOM</label>
                  <select
                    value={matForm.uom}
                    onChange={(e) => setMatForm({ ...matForm, uom: e.target.value })}
                    className="w-full px-2 py-2 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
                  >
                    <option value="kg">kg (Kilograms)</option>
                    <option value="g">g (Grams)</option>
                    <option value="l">l (Litres)</option>
                    <option value="ml">ml (Millilitres)</option>
                    <option value="pcs">pcs (Pieces)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-mono text-[#686158]">Density (g/mL)</label>
                  <input
                    type="number"
                    step="0.001"
                    placeholder="e.g. 0.789"
                    value={matForm.densityGPerMl}
                    onChange={(e) => setMatForm({ ...matForm, densityGPerMl: e.target.value })}
                    className="w-full px-2.5 py-2 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-mono text-[#686158]">Cost (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={matForm.unitCostInr}
                    onChange={(e) => setMatForm({ ...matForm, unitCostInr: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 border border-[#DED7CC] rounded text-xs font-mono bg-[#FAF8F4]"
                  />
                </div>
                {!editingMaterialId ? (
                  <div>
                    <label className="text-[10px] font-mono text-[#686158]">Opening Qty</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={matForm.openingStock}
                      onChange={(e) => setMatForm({ ...matForm, openingStock: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 border border-[#DED7CC] rounded text-xs font-mono bg-[#FAF8F4]"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="text-[10px] font-mono text-[#686158]">Stock Lock</label>
                    <div className="px-2 py-1.5 border border-[#DED7CC] rounded text-[11px] font-mono text-[#686158] bg-[#FAF8F4]">
                      Via Ledger
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-[10px] font-mono text-[#686158]">Reorder Lvl</label>
                  <input
                    type="number"
                    min={0}
                    value={matForm.reorderLevel}
                    onChange={(e) => setMatForm({ ...matForm, reorderLevel: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 border border-[#DED7CC] rounded text-xs font-mono bg-[#FAF8F4]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  placeholder="Bin Location"
                  value={matForm.warehouseLocation}
                  onChange={(e) => setMatForm({ ...matForm, warehouseLocation: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
                />
                <input
                  placeholder="CAS # (optional)"
                  value={matForm.casNumber}
                  onChange={(e) => setMatForm({ ...matForm, casNumber: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-[#686158]">
                <input
                  type="checkbox"
                  checked={matForm.densityValidated}
                  onChange={(e) => setMatForm({ ...matForm, densityValidated: e.target.checked })}
                />
                <span>Lab Density Validated (required for mass ↔ volume)</span>
              </label>

              <button
                disabled={busy}
                type="submit"
                className="w-full py-2.5 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono uppercase tracking-wider rounded cursor-pointer"
              >
                {editingMaterialId ? 'Update Material Specs' : 'Save Material Master'}
              </button>
            </form>
          </div>
        )}

        {matSubTab === 'lots' && (
          <div className="space-y-4">
            <div className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                  <tr>
                    <th className="py-2.5 px-3">Lot # / Supplier</th>
                    <th className="py-2.5 px-3">Category / Location</th>
                    <th className="py-2.5 px-3 text-right">Received</th>
                    <th className="py-2.5 px-3 text-right">Available</th>
                    <th className="py-2.5 px-3 text-right">Reserved / Damaged</th>
                    <th className="py-2.5 px-3">Retest / Expiry</th>
                    <th className="py-2.5 px-3">QC</th>
                    <th className="py-2.5 px-3 text-right">Ledger Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DED7CC]">
                  {activeLots.map((lot) => {
                    const mat = activeMaterials.find((m) => m.id === lot.materialId);
                    return (
                      <tr key={lot.id} className="hover:bg-[#FAF8F4]">
                        <td className="py-2.5 px-3">
                          <span className="font-mono font-semibold text-[#24211D] block">{lot.lotNumber}</span>
                          <span className="text-[11px] text-[#686158] block">{mat?.name || lot.materialId}</span>
                          <span className="text-[10px] font-mono text-[#686158]">
                            {lot.supplierName || 'Direct'} · {lot.purchaseRef || lot.supplierBatchRef || 'OPEN'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px]">
                          <span className="block text-[#24211D]">{lot.stockCategory || 'RAW_MATERIAL'}</span>
                          <span className="text-[#9A783E]">{lot.warehouseLocation || lot.warehouseId}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {lot.receivedQty} {lot.uom || mat?.uom}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-[#9A783E]">
                          {lot.availableQty} {lot.uom || mat?.uom}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#686158]">
                          Res {lot.reservedQty || 0} · Dmg {lot.damagedQty || 0}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-[#686158]">
                          <span>R: {lot.retestDate || '—'}</span>
                          <span className="block">E: {lot.expiryDate || '—'}</span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px]">
                          <span className={lot.qcStatus === 'APPROVED' ? 'text-emerald-700 font-semibold' : 'text-amber-700'}>
                            {lot.qcStatus} · {lot.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => {
                              setMovementModalLot(lot);
                              setMovementForm({
                                movementType: 'SAMPLE_ISSUE',
                                direction: 'OUT',
                                qty: 0.5,
                                reason: '',
                                targetWarehouseLocation: lot.warehouseLocation || '',
                                qcStatus: ''
                              });
                            }}
                            className="px-2.5 py-1 border border-[#DED7CC] hover:border-[#9A783E] rounded text-[11px] font-mono text-[#24211D] whitespace-nowrap cursor-pointer"
                          >
                            Post Movement
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {matSubTab === 'movements' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {['ALL', ...STOCK_CATEGORIES].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setMovementCategoryFilter(cat)}
                    className={`px-2.5 py-1 rounded text-[11px] font-mono cursor-pointer ${
                      movementCategoryFilter === cat
                        ? 'bg-[#24211D] text-[#FAF8F4]'
                        : 'bg-[#FFFFFF] border border-[#DED7CC] text-[#686158]'
                    }`}
                  >
                    {cat.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
              <button
                onClick={() =>
                  setPrintDoc({
                    type: 'MOVEMENT_LEDGER',
                    movements: filteredMovements,
                    filterLabel: movementCategoryFilter,
                    organization: snapshot.organization
                  })
                }
                className="px-3 py-1.5 bg-[#24211D] text-[#FAF8F4] text-xs font-mono rounded flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print / Export Filtered Ledger</span>
              </button>
            </div>

            <div className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                  <tr>
                    <th className="py-2.5 px-3">Movement #</th>
                    <th className="py-2.5 px-3">Category / Type</th>
                    <th className="py-2.5 px-3">Material &amp; Lot</th>
                    <th className="py-2.5 px-3 text-right">Delta</th>
                    <th className="py-2.5 px-3 text-right">Before → After</th>
                    <th className="py-2.5 px-3 text-right">Value (₹)</th>
                    <th className="py-2.5 px-3">Reference &amp; Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DED7CC]">
                  {filteredMovements.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center font-mono text-[#686158]">
                        No stock movements recorded for this category filter.
                      </td>
                    </tr>
                  ) : (
                    filteredMovements.map((mv) => (
                      <tr key={mv.id} className="hover:bg-[#FAF8F4]">
                        <td className="py-2.5 px-3 font-mono font-bold text-[#24211D]">
                          {mv.movementNumber}
                          <span className="block text-[10px] text-[#686158] font-normal">{mv.movementDate}</span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px]">
                          <span className="text-[#9A783E] font-semibold block">{mv.stockCategory}</span>
                          <span className="text-[#686158]">{mv.movementType}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-medium text-[#24211D] block">{mv.materialName}</span>
                          <span className="text-[10px] font-mono text-[#686158]">
                            {mv.lotNumber || mv.sku || mv.batchNumber || '—'} · {mv.warehouseLocation || ''}
                          </span>
                        </td>
                        <td className={`py-2.5 px-3 text-right font-mono tabular-nums font-bold ${mv.qtyDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {mv.qtyDelta >= 0 ? `+${mv.qtyDelta}` : mv.qtyDelta} {mv.uom}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#686158]">
                          {mv.balanceBefore} → <strong className="text-[#24211D]">{mv.balanceAfter}</strong>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          ₹{Number(mv.totalCostInr || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-[#686158] max-w-xs">
                          <span className="block text-[#24211D] truncate">{mv.reason}</span>
                          <span className="font-mono text-[10px]">{mv.performedByEmail}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {matSubTab === 'grn' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 border border-[#DED7CC] bg-[#FFFFFF] rounded-lg overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                  <tr>
                    <th className="py-2.5 px-3">GRN Number</th>
                    <th className="py-2.5 px-3">Supplier / Challan</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Total (incl. GST)</th>
                    <th className="py-2.5 px-3">QC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DED7CC]">
                  {snapshot.goodsReceipts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-[#686158] font-mono">
                        No Goods Receipts posted yet. Post an inward GRN from an open Purchase Order on the right.
                      </td>
                    </tr>
                  ) : (
                    snapshot.goodsReceipts.map((g) => (
                      <tr key={g.id}>
                        <td className="py-2.5 px-3 font-mono font-bold text-[#24211D]">{g.grnNumber}</td>
                        <td className="py-2.5 px-3">
                          {g.supplierName}
                          <span className="block text-[10px] font-mono text-[#686158]">Challan {g.challanNumber}</span>
                        </td>
                        <td className="py-2.5 px-3 font-mono">{g.receivedDate}</td>
                        <td className="py-2.5 px-3 font-mono tabular-nums text-[#9A783E] font-semibold">
                          ₹{Number(g.totalInr).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-emerald-700">{g.qcStatus}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                runAction(async () => {
                  await erpApi.postGoodsReceipt({
                    ...grnForm,
                    idempotencyKey: `grn-${grnForm.purchaseOrderId}-${Date.now()}`
                  });
                }, 'Goods Receipt posted: FIFO lots stocked, Movement Ledger & AP Journal balanced.');
              }}
              className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4 space-y-3 h-fit"
            >
              <h3 className="text-xs font-mono uppercase font-semibold text-[#24211D] border-b border-[#DED7CC] pb-2">
                Post Goods Receipt Note (GRN)
              </h3>
              <div>
                <label className="text-[10px] font-mono text-[#686158] block mb-1">Purchase Order</label>
                <select
                  required
                  value={grnForm.purchaseOrderId}
                  onChange={(e) => setGrnForm({ ...grnForm, purchaseOrderId: e.target.value })}
                  className="w-full px-2.5 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                >
                  {snapshot.procurement.purchaseOrders.map((po) => (
                    <option key={po.id} value={po.id}>
                      {po.poNumber} · {po.supplierName} ({po.status})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-mono text-[#686158] block mb-1">Receiving Warehouse</label>
                <select
                  value={grnForm.warehouseId}
                  onChange={(e) => setGrnForm({ ...grnForm, warehouseId: e.target.value })}
                  className="w-full px-2.5 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                >
                  {snapshot.warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.code} — {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-mono text-[#686158] block mb-1">Delivery Challan / AWB</label>
                <input
                  value={grnForm.challanNumber}
                  onChange={(e) => setGrnForm({ ...grnForm, challanNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs font-mono bg-[#FAF8F4]"
                />
              </div>
              <button
                disabled={busy || !grnForm.purchaseOrderId}
                type="submit"
                className="w-full py-2.5 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono uppercase tracking-wider rounded cursor-pointer"
              >
                Receive Goods &amp; Post AP Journal
              </button>
            </form>
          </div>
        )}

        {/* STOCK MOVEMENT MODAL (LEDGER-ONLY QUANTITY ADJUSTMENT) */}
        {movementModalLot && (
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setMovementModalLot(null);
            }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                runAction(async () => {
                  await erpApi.postStockMovement({
                    lotId: movementModalLot.id,
                    movementType: movementForm.movementType,
                    direction: movementForm.direction,
                    qty: Number(movementForm.qty),
                    reason: movementForm.reason,
                    targetWarehouseLocation: movementForm.targetWarehouseLocation || undefined,
                    qcStatus: movementForm.qcStatus || undefined,
                    idempotencyKey: `mov-${movementModalLot.id}-${Date.now()}`
                  });
                  setMovementModalLot(null);
                }, 'Immutable stock movement appended to inventory ledger.');
              }}
              className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl w-full max-w-md p-5 space-y-3 shadow-2xl text-xs"
            >
              <div className="flex items-center justify-between border-b border-[#DED7CC] pb-2">
                <div>
                  <h3 className="font-serif text-base uppercase text-[#24211D]">Record Stock Movement</h3>
                  <span className="font-mono text-[11px] text-[#9A783E]">
                    {movementModalLot.lotNumber} · Available: {movementModalLot.availableQty} {movementModalLot.uom}
                  </span>
                </div>
                <button type="button" onClick={() => setMovementModalLot(null)} className="text-[#686158] cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-mono text-[#686158] block mb-1">Movement Type</label>
                  <select
                    value={movementForm.movementType}
                    onChange={(e) => setMovementForm({ ...movementForm, movementType: e.target.value as any })}
                    className="w-full px-2.5 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4]"
                  >
                    <option value="SAMPLE_ISSUE">Sample Issue (OUT)</option>
                    <option value="DAMAGE_WRITEOFF">Damage / Spoilage Write-Off (OUT)</option>
                    <option value="RETURN">Lab / Production Return (IN)</option>
                    <option value="ADJUSTMENT">Audit Reconciliation</option>
                    <option value="REWORK">Rework Allocation</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-mono text-[#686158] block mb-1">Quantity ({movementModalLot.uom})</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    required
                    value={movementForm.qty}
                    onChange={(e) => setMovementForm({ ...movementForm, qty: Number(e.target.value) })}
                    className="w-full px-2.5 py-2 border border-[#DED7CC] rounded font-mono bg-[#FAF8F4]"
                  />
                </div>
              </div>

              {movementForm.movementType === 'ADJUSTMENT' && (
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={movementForm.direction}
                    onChange={(e) => setMovementForm({ ...movementForm, direction: e.target.value as any })}
                    className="w-full px-2.5 py-2 border border-[#DED7CC] rounded font-mono bg-[#FAF8F4]"
                  >
                    <option value="OUT">OUT (Deduct)</option>
                    <option value="IN">IN (Add)</option>
                  </select>
                  <select
                    value={movementForm.qcStatus}
                    onChange={(e) => setMovementForm({ ...movementForm, qcStatus: e.target.value })}
                    className="w-full px-2.5 py-2 border border-[#DED7CC] rounded font-mono bg-[#FAF8F4]"
                  >
                    <option value="">Keep QC Status</option>
                    <option value="APPROVED">APPROVED</option>
                    <option value="QUARANTINED">QUARANTINED</option>
                  </select>
                </div>
              )}

              <div>
                <label className="text-[10px] font-mono text-[#686158] block mb-1">Target Bin / Bay (optional)</label>
                <input
                  value={movementForm.targetWarehouseLocation}
                  onChange={(e) => setMovementForm({ ...movementForm, targetWarehouseLocation: e.target.value })}
                  className="w-full px-2.5 py-2 border border-[#DED7CC] rounded font-mono bg-[#FAF8F4]"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono text-[#686158] block mb-1">Mandatory Audit Reason *</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Describe laboratory draw, breakage, or stock count reconciliation..."
                  value={movementForm.reason}
                  onChange={(e) => setMovementForm({ ...movementForm, reason: e.target.value })}
                  className="w-full px-2.5 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#DED7CC]">
                <button type="button" onClick={() => setMovementModalLot(null)} className="px-3 py-1.5 border border-[#DED7CC] rounded font-mono">
                  Cancel
                </button>
                <button disabled={busy} type="submit" className="px-4 py-1.5 bg-[#24211D] text-[#FAF8F4] rounded font-mono">
                  Append Ledger Entry
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // MODULE 4: PERFUME FORMULATIONS, MULTI-SIZE BOM & CONFIDENTIALITY
  // --------------------------------------------------------------------------
  if (activeModule === 'ERP_FORMULATIONS') {
    const activeFormula = activeFormulations.find((f) => f.id === selectedFormulaId) || activeFormulations[0];
    const versions = activeFormulaVersions.filter((v) => v.formulationId === activeFormula?.id);
    const bomSum = formulaForm.ingredients.reduce((s, i) => s + Number(i.percentage || 0), 0);
    const solventPctCalc = formulaForm.ingredients
      .filter((i) => i.notePyramid === 'SOLVENT')
      .reduce((s, i) => s + Number(i.percentage || 0), 0);
    const concentratePctCalc = Math.max(0, 100 - solventPctCalc);

    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#DED7CC] pb-4">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-widest text-[#9A783E]">
              Module 04 · Olfactory R&amp;D, Multi-Size Packaging BOM &amp; IP Confidentiality
            </p>
            <h2 className="font-serif text-2xl sm:text-3xl text-[#24211D] uppercase tracking-wider mt-1">
              Perfume Formulations &amp; Costing Matrix
            </h2>
          </div>
          <ErpTableExportBar reportKey="formulation_costs" notify={notify} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                  <tr>
                    <th className="py-2.5 px-3">Code</th>
                    <th className="py-2.5 px-3">Fragrance</th>
                    <th className="py-2.5 px-3">Concentration</th>
                    <th className="py-2.5 px-3">Maceration</th>
                    <th className="py-2.5 px-3">Version / Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DED7CC]">
                  {activeFormulations.map((f) => (
                    <tr
                      key={f.id}
                      onClick={() => setSelectedFormulaId(f.id)}
                      className={`cursor-pointer ${activeFormula?.id === f.id ? 'bg-[#F1EDE5]' : 'hover:bg-[#FAF8F4]'}`}
                    >
                      <td className="py-2.5 px-3 font-mono font-bold text-[#9A783E]">{f.formulaCode}</td>
                      <td className="py-2.5 px-3 font-semibold text-[#24211D]">{f.name}</td>
                      <td className="py-2.5 px-3 text-[#686158]">{f.concentrationType}</td>
                      <td className="py-2.5 px-3 font-mono tabular-nums">{f.macerationDays} days</td>
                      <td className="py-2.5 px-3 font-mono text-[11px]">
                        v{f.activeVersionNumber} ·{' '}
                        <span className={f.status === 'APPROVED' ? 'text-emerald-700 font-semibold' : 'text-amber-700'}>
                          {f.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {activeFormula && (
              <div className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-[#DED7CC] pb-2">
                  <h3 className="font-serif text-base uppercase text-[#24211D]">
                    {activeFormula.formulaCode} · {activeFormula.name} — Specifications &amp; Versions
                  </h3>
                  <span className="text-[11px] font-mono text-[#686158]">{activeFormula.fragranceFamily}</span>
                </div>

                {versions.map((v) => {
                  const sizeCosts: any[] = Array.isArray(v.bottleSizeCosts) ? v.bottleSizeCosts : [];
                  const pkgBomMap = (v.packagingBom || {}) as Record<string, any[]>;
                  return (
                    <div key={v.id} className="border border-[#DED7CC] rounded p-3.5 bg-[#FAF8F4] space-y-3 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2 font-mono">
                        <span className="font-bold text-[#24211D] flex items-center gap-1.5">
                          <span>Version v{v.versionNumber} · {v.status} · {v.ifraComplianceStatus}</span>
                          {v.isConfidential && (
                            <span className="inline-flex items-center gap-1 text-[#9A783E]">
                              <Lock className="w-3 h-3" />
                              <span>{v.confidentialityLevel || 'RESTRICTED'}</span>
                            </span>
                          )}
                        </span>
                        <span className="text-[#9A783E] font-semibold tabular-nums">
                          ₹{Number(v.costPerKgInr).toLocaleString('en-IN')}/kg · Conc {v.concentratePct ?? 28}% / Solv {v.solventPct ?? 72}%
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono border-y border-[#DED7CC] py-2">
                        <div>
                          <span className="text-[#686158] block">Target Batch</span>
                          <strong>{v.targetBatchSize || 10} {v.targetBatchUnit || 'kg'}</strong>
                        </div>
                        <div>
                          <span className="text-[#686158] block">Expected Yield</span>
                          <strong>{v.expectedYieldPct || 98}% ({v.expectedYieldQty || 9.8} {v.targetBatchUnit || 'kg'})</strong>
                        </div>
                        <div>
                          <span className="text-[#686158] block">Supported Sizes</span>
                          <strong>{Array.isArray(v.supportedBottleSizes) ? v.supportedBottleSizes.join(', ') : '2ML..50ML'}</strong>
                        </div>
                        <div>
                          <span className="text-[#686158] block">Clearance</span>
                          <strong>{v.isRedactedForActor ? 'REDACTED' : 'AUTHORIZED'}</strong>
                        </div>
                      </div>

                      <p className="text-[#686158]">{v.changeSummary}</p>

                      {v.isRedactedForActor ? (
                        <div className="p-3 border border-amber-300 bg-amber-50 rounded font-mono text-[11px] text-amber-900 flex items-center gap-2">
                          <Lock className="w-4 h-4 shrink-0" />
                          <span>
                            Master ingredient breakdown is classified ({v.confidentialityLevel}). Switch role to SUPER_ADMIN or FORMULATOR to inspect composition.
                          </span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {(v.ingredients as any[]).map((ing, idx) => (
                            <div key={idx} className="flex justify-between font-mono text-[11px] border-b border-[#DED7CC]/60 py-1">
                              <span>
                                [{ing.notePyramid}] {ing.materialName}
                                {ing.densityGPerMl ? ` (${ing.densityGPerMl} g/mL)` : ''}
                              </span>
                              <span className="font-semibold tabular-nums">{ing.percentage}%</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {sizeCosts.length > 0 && (
                        <div className="pt-2">
                          <span className="text-[10px] font-mono uppercase text-[#686158] block mb-1.5">
                            Multi-Size Bottle Costing &amp; Packaging BOM
                          </span>
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                            {sizeCosts.map((sc) => (
                              <div key={sc.sizeLabel} className="border border-[#DED7CC] bg-[#FFFFFF] rounded p-2 font-mono text-[10px]">
                                <span className="font-bold text-[#24211D] block">{sc.sizeLabel}</span>
                                <span className="text-[#686158] block">Juice: ₹{sc.juiceCostInr}</span>
                                <span className="text-[#686158] block">
                                  Pkg ({(pkgBomMap[sc.sizeLabel] || []).length}): ₹{sc.packagingCostInr}
                                </span>
                                <span className="font-bold text-[#9A783E] block mt-0.5 tabular-nums">
                                  Est: ₹{sc.totalEstimatedCostPerBottleInr}/btl
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              runAction(async () => {
                const sizes = formulaForm.supportedBottleSizesCsv
                  .split(',')
                  .map((s) => s.trim().toUpperCase())
                  .filter(Boolean);
                await erpApi.saveFormulationAdvanced({
                  formulationId: formulaForm.formulationId || undefined,
                  name: formulaForm.name,
                  fragranceFamily: formulaForm.fragranceFamily,
                  concentrationType: formulaForm.concentrationType,
                  concentratePct: concentratePctCalc,
                  solventPct: solventPctCalc,
                  macerationDays: Number(formulaForm.macerationDays),
                  targetBatchSize: Number(formulaForm.targetBatchSize),
                  targetBatchUnit: formulaForm.targetBatchUnit,
                  expectedYieldPct: Number(formulaForm.expectedYieldPct),
                  supportedBottleSizes: sizes,
                  isConfidential: formulaForm.confidentialityLevel !== 'STANDARD',
                  confidentialityLevel: formulaForm.confidentialityLevel,
                  changeSummary: formulaForm.changeSummary || undefined,
                  submitForApproval: formulaForm.submitForApproval,
                  ingredients: formulaForm.ingredients
                });
                setFormulaForm({ ...formulaForm, formulationId: '', name: '', changeSummary: '' });
              }, 'Formulation BOM saved with density-linked bottle sizing costs.');
            }}
            className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4 space-y-3 h-fit"
          >
            <h3 className="text-xs font-mono uppercase font-semibold text-[#24211D] border-b border-[#DED7CC] pb-2">
              Author / Revise Formulation BOM
            </h3>

            <div>
              <label className="text-[10px] font-mono text-[#686158] block mb-1">Revision Target (Optional)</label>
              <select
                value={formulaForm.formulationId}
                onChange={(e) => {
                  const fId = e.target.value;
                  const f = activeFormulations.find((x) => x.id === fId);
                  setFormulaForm({
                    ...formulaForm,
                    formulationId: fId,
                    name: f ? f.name : '',
                    fragranceFamily: f ? f.fragranceFamily : formulaForm.fragranceFamily
                  });
                }}
                className="w-full px-2.5 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              >
                <option value="">+ Create Brand New Formula</option>
                {activeFormulations.map((f) => (
                  <option key={f.id} value={f.id}>
                    New Version for {f.formulaCode} ({f.name})
                  </option>
                ))}
              </select>
            </div>

            <input
              required
              placeholder="Formula Name (e.g. SAFFRON ECLIPSE)"
              value={formulaForm.name}
              onChange={(e) => setFormulaForm({ ...formulaForm, name: e.target.value })}
              className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
            />

            <div className="grid grid-cols-2 gap-2">
              <input
                placeholder="Family"
                value={formulaForm.fragranceFamily}
                onChange={(e) => setFormulaForm({ ...formulaForm, fragranceFamily: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              />
              <input
                placeholder="Concentration"
                value={formulaForm.concentrationType}
                onChange={(e) => setFormulaForm({ ...formulaForm, concentrationType: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] font-mono text-[#686158]">Batch Size</label>
                <input
                  type="number"
                  step="0.5"
                  value={formulaForm.targetBatchSize}
                  onChange={(e) => setFormulaForm({ ...formulaForm, targetBatchSize: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-[#686158]">Unit</label>
                <select
                  value={formulaForm.targetBatchUnit}
                  onChange={(e) => setFormulaForm({ ...formulaForm, targetBatchUnit: e.target.value as any })}
                  className="w-full px-2 py-1.5 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
                >
                  <option value="l">l</option>
                  <option value="kg">kg</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-mono text-[#686158]">Yield %</label>
                <input
                  type="number"
                  step="0.5"
                  value={formulaForm.expectedYieldPct}
                  onChange={(e) => setFormulaForm({ ...formulaForm, expectedYieldPct: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-mono text-[#686158]">Supported Sizes (CSV)</label>
                <input
                  value={formulaForm.supportedBottleSizesCsv}
                  onChange={(e) => setFormulaForm({ ...formulaForm, supportedBottleSizesCsv: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-[#686158]">Confidentiality</label>
                <select
                  value={formulaForm.confidentialityLevel}
                  onChange={(e) => setFormulaForm({ ...formulaForm, confidentialityLevel: e.target.value as any })}
                  className="w-full px-2 py-1.5 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
                >
                  <option value="STANDARD">Standard</option>
                  <option value="RESTRICTED">Restricted (R&amp;D Only)</option>
                  <option value="TOP_SECRET_MASTER">Top Secret Master</option>
                </select>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-[#686158] uppercase">
                  Conc {concentratePctCalc.toFixed(1)}% · Solv {solventPctCalc.toFixed(1)}%
                </span>
                <span className={Math.abs(bomSum - 100) < 0.05 ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                  Total: {bomSum}%
                </span>
              </div>
              {formulaForm.ingredients.map((ing, idx) => (
                <div key={idx} className="space-y-1 border border-[#DED7CC]/70 rounded p-2 bg-[#FAF8F4]">
                  <div className="grid grid-cols-12 gap-1.5 items-center text-xs">
                    <select
                      value={ing.materialId}
                      onChange={(e) => {
                        const m = activeMaterials.find((x) => x.id === e.target.value);
                        const next = [...formulaForm.ingredients];
                        next[idx] = {
                          ...ing,
                          materialId: e.target.value,
                          materialName: m ? m.name : ing.materialName,
                          costPerKgInr: m ? Number(m.unitCostInr) : ing.costPerKgInr
                        };
                        setFormulaForm({ ...formulaForm, ingredients: next });
                      }}
                      className="col-span-7 px-2 py-1 border border-[#DED7CC] rounded bg-[#FFFFFF] text-[11px]"
                    >
                      <option value="">Custom Ingredient</option>
                      {activeMaterials
                        .filter((m) => ['RAW_MATERIAL', 'FRAGRANCE_OIL'].includes(m.stockType || '') || ['ESSENTIAL_OIL', 'ABSOLUTE', 'SOLVENT', 'AROMA_CHEMICAL'].includes(m.category))
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.code} — {m.name}
                          </option>
                        ))}
                    </select>
                    <select
                      value={ing.notePyramid}
                      onChange={(e) => {
                        const next = [...formulaForm.ingredients];
                        next[idx] = { ...ing, notePyramid: e.target.value as any };
                        setFormulaForm({ ...formulaForm, ingredients: next });
                      }}
                      className="col-span-5 px-1.5 py-1 border border-[#DED7CC] rounded font-mono text-[10px] bg-[#FFFFFF]"
                    >
                      <option value="TOP">TOP NOTE</option>
                      <option value="HEART">HEART</option>
                      <option value="BASE">BASE</option>
                      <option value="FIXATIVE">FIXATIVE</option>
                      <option value="SOLVENT">SOLVENT</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-12 gap-1.5 items-center text-xs">
                    <input
                      value={ing.materialName}
                      onChange={(e) => {
                        const next = [...formulaForm.ingredients];
                        next[idx] = { ...ing, materialName: e.target.value };
                        setFormulaForm({ ...formulaForm, ingredients: next });
                      }}
                      className="col-span-6 px-2 py-1 border border-[#DED7CC] rounded bg-[#FFFFFF]"
                    />
                    <input
                      type="number"
                      step="0.1"
                      value={ing.percentage}
                      onChange={(e) => {
                        const next = [...formulaForm.ingredients];
                        next[idx] = { ...ing, percentage: Number(e.target.value) };
                        setFormulaForm({ ...formulaForm, ingredients: next });
                      }}
                      placeholder="%"
                      className="col-span-3 px-2 py-1 border border-[#DED7CC] rounded font-mono bg-[#FFFFFF]"
                    />
                    <input
                      type="number"
                      value={ing.costPerKgInr}
                      onChange={(e) => {
                        const next = [...formulaForm.ingredients];
                        next[idx] = { ...ing, costPerKgInr: Number(e.target.value) };
                        setFormulaForm({ ...formulaForm, ingredients: next });
                      }}
                      placeholder="₹/kg"
                      className="col-span-3 px-2 py-1 border border-[#DED7CC] rounded font-mono bg-[#FFFFFF]"
                    />
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setFormulaForm({
                    ...formulaForm,
                    ingredients: [
                      ...formulaForm.ingredients,
                      { materialId: '', materialName: 'Fixative Accord', notePyramid: 'HEART', percentage: 0, costPerKgInr: 6200 }
                    ]
                  })
                }
                className="text-[11px] font-mono text-[#9A783E] hover:underline cursor-pointer"
              >
                + Add Component Line
              </button>
            </div>

            <label className="flex items-center gap-2 text-xs text-[#686158]">
              <input
                type="checkbox"
                checked={formulaForm.submitForApproval}
                onChange={(e) => setFormulaForm({ ...formulaForm, submitForApproval: e.target.checked })}
              />
              <span>Queue in Approval Inbox (unchecked = auto-approved)</span>
            </label>

            <button
              disabled={busy || Math.abs(bomSum - 100) > 0.05}
              type="submit"
              className="w-full py-2.5 bg-[#24211D] hover:bg-[#9A783E] disabled:opacity-50 text-[#FAF8F4] text-xs font-mono uppercase tracking-wider rounded cursor-pointer"
            >
              Save Versioned Formula
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // MODULE 6: SAMPLING, R&D & QUALITY CONTROL OS
  // --------------------------------------------------------------------------
  if (activeModule === 'ERP_QUALITY') {
    return (
      <ErpSamplingAndQcWorkspace
        snapshot={snapshot}
        onRefresh={async () => {
          await Promise.all([onRefresh(), loadMfgSnapshot()]);
        }}
        notify={notify}
      />
    );
  }

  // --------------------------------------------------------------------------
  // MODULE 7: FINISHED GOODS & WAREHOUSE MANAGEMENT
  // --------------------------------------------------------------------------
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <ManufacturingPrintModal doc={printDoc} onClose={() => setPrintDoc(null)} />

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#DED7CC] pb-4">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-widest text-[#9A783E]">Module 07 · Vault &amp; Bins</p>
          <h2 className="font-serif text-2xl sm:text-3xl text-[#24211D] uppercase tracking-wider mt-1">
            Finished Goods &amp; Warehouse Operations
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setWhSubTab('fg')}
            className={`px-3 py-1.5 rounded text-xs font-mono whitespace-nowrap shrink-0 cursor-pointer ${
              whSubTab === 'fg' ? 'bg-[#24211D] text-[#FAF8F4]' : 'bg-[#FFFFFF] border border-[#DED7CC]'
            }`}
          >
            Finished Goods Bins ({activeFinishedGoods.length})
          </button>
          <button
            onClick={() => setWhSubTab('warehouses')}
            className={`px-3 py-1.5 rounded text-xs font-mono whitespace-nowrap shrink-0 cursor-pointer ${
              whSubTab === 'warehouses' ? 'bg-[#24211D] text-[#FAF8F4]' : 'bg-[#FFFFFF] border border-[#DED7CC]'
            }`}
          >
            Facilities ({snapshot.warehouses.length})
          </button>
          <ErpTableExportBar reportKey="finished_goods" notify={notify} />
          <button
            onClick={() =>
              setPrintDoc({
                type: 'FINISHED_GOODS',
                finishedGoods: activeFinishedGoods,
                organization: snapshot.organization
              })
            }
            className="px-3 py-1.5 border border-[#DED7CC] bg-[#FFFFFF] hover:border-[#9A783E] text-xs font-mono rounded flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-[#9A783E]" />
            <span>Vault Sheet</span>
          </button>
        </div>
      </div>

      {whSubTab === 'fg' ? (
        <div className="space-y-4">
          {fgEdit && (
            <div className="border border-[#9A783E] bg-[#FFFFFF] rounded-lg p-4 flex flex-wrap items-end gap-3">
              <div>
                <label className="text-[10px] font-mono uppercase text-[#686158] block">Bin Location</label>
                <input
                  value={fgEdit.binLocation}
                  onChange={(e) => setFgEdit({ ...fgEdit, binLocation: e.target.value })}
                  className="px-3 py-1.5 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase text-[#686158] block">Stock Delta (+/- units)</label>
                <input
                  type="number"
                  value={fgEdit.delta}
                  onChange={(e) => setFgEdit({ ...fgEdit, delta: Number(e.target.value) })}
                  className="px-3 py-1.5 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4] w-28"
                />
              </div>
              <button
                disabled={busy}
                onClick={() =>
                  runAction(async () => {
                    await erpApi.adjustFinishedGood(fgEdit.id, {
                      binLocation: fgEdit.binLocation,
                      quantityDelta: fgEdit.delta,
                      expectedVersion: fgEdit.version
                    });
                    setFgEdit(null);
                  }, 'Warehouse bin stock updated with optimistic lock.')
                }
                className="px-4 py-1.5 bg-[#24211D] text-[#FAF8F4] text-xs font-mono uppercase rounded cursor-pointer"
              >
                Commit Adjustment
              </button>
              <button onClick={() => setFgEdit(null)} className="px-3 py-1.5 text-xs font-mono text-[#686158] cursor-pointer">
                Cancel
              </button>
            </div>
          )}

          <div className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                <tr>
                  <th className="py-2.5 px-3">SKU</th>
                  <th className="py-2.5 px-3">Product / Size</th>
                  <th className="py-2.5 px-3">Bin / Batch #</th>
                  <th className="py-2.5 px-3 text-right">On Hand / Avail</th>
                  <th className="py-2.5 px-3 text-right">MRP / COGS</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DED7CC]">
                {activeFinishedGoods.map((g) => (
                  <tr key={g.id} className="hover:bg-[#FAF8F4]">
                    <td className="py-2.5 px-3 font-mono font-semibold text-[#24211D]">{g.sku}</td>
                    <td className="py-2.5 px-3">
                      {g.productName} <span className="text-[#686158]">({g.size})</span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[#9A783E]">
                      {g.binLocation}
                      <span className="block text-[10px] text-[#686158]">{g.batchNumber || '—'}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {g.quantityOnHand} / <strong>{g.quantityAvailable}</strong>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      ₹{Number(g.mrpInr).toLocaleString('en-IN')} · COGS ₹{g.unitManufacturingCostInr}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() =>
                          setFgEdit({ id: g.id, binLocation: g.binLocation, delta: 0, version: g.version })
                        }
                        className="text-xs font-mono text-[#9A783E] hover:underline cursor-pointer"
                      >
                        Adjust Bin
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {snapshot.warehouses.map((w) => (
              <div key={w.id} className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="font-bold text-[#9A783E]">{w.code}</span>
                  <span className="text-[#686158]">{w.warehouseType}</span>
                </div>
                <h3 className="font-serif text-base text-[#24211D]">{w.name}</h3>
                <p className="text-xs text-[#686158]">{w.address}</p>
                <div className="pt-2 border-t border-[#DED7CC] flex justify-between text-[11px] font-mono text-[#686158] tabular-nums">
                  <span>Cap: {Number(w.capacityUnits).toLocaleString('en-IN')}</span>
                  <span>{w.temperatureControlled ? '14°C Climate Vault' : 'Ambient'}</span>
                </div>
              </div>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              runAction(async () => {
                await erpApi.createWarehouse(whForm);
                setWhForm({ ...whForm, code: '', name: '', address: '' });
              }, 'Warehouse facility registered.');
            }}
            className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4 space-y-3 h-fit"
          >
            <h3 className="text-xs font-mono uppercase font-semibold border-b border-[#DED7CC] pb-2">Add Warehouse Zone</h3>
            <input
              required
              placeholder="Code (e.g. WH-BLR-01)"
              value={whForm.code}
              onChange={(e) => setWhForm({ ...whForm, code: e.target.value })}
              className="w-full px-3 py-2 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
            />
            <input
              required
              placeholder="Facility Name"
              value={whForm.name}
              onChange={(e) => setWhForm({ ...whForm, name: e.target.value })}
              className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
            />
            <input
              required
              placeholder="City"
              value={whForm.city}
              onChange={(e) => setWhForm({ ...whForm, city: e.target.value })}
              className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
            />
            <input
              required
              placeholder="Street Address"
              value={whForm.address}
              onChange={(e) => setWhForm({ ...whForm, address: e.target.value })}
              className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
            />
            <button
              disabled={busy}
              type="submit"
              className="w-full py-2.5 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono uppercase rounded cursor-pointer"
            >
              Register Warehouse
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
