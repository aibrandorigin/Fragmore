import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Printer,
  FileSpreadsheet,
  Truck,
  ShieldCheck,
  Building2,
  RotateCcw,
  Award,
  XCircle,
  CreditCard,
  Boxes,
  Paperclip
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import {
  erpApi,
  downloadExcelSpreadsheet,
  type ErpProcurementSnapshot
} from '../../lib/erpApi';
import { ProcurementPrintModal, type ProcurementPrintDoc } from './procurement/ProcurementPrintModal';
import {
  SupplierFormModal,
  PurchaseRequisitionModal,
  PurchaseOrderFormModal,
  SupplierQuotationModal,
  PartialGrnModal,
  VendorInvoiceModal
} from './procurement/ProcurementModals';
import {
  CreateRfqModal,
  GrnInspectModal,
  SupplierPaymentModal,
  DebitNoteModal,
  CancelPoModal,
  SupplierLedgerDrawer
} from './procurement/ProcurementActionModals';
import { ErpTableExportBar } from './erp/ErpUniversalExportModal';

type ProcTab =
  | 'overview'
  | 'rfq_compare'
  | 'purchase_orders'
  | 'grn_qc'
  | 'invoices_returns'
  | 'suppliers_reports';

const fmtInr = (n: any) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export const AdminProcurement: React.FC = () => {
  const { showNotification } = useStore();
  const [activeTab, setActiveTab] = useState<ProcTab>('overview');
  const [snapshot, setSnapshot] = useState<ErpProcurementSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [poStatusFilter, setPoStatusFilter] = useState('ALL');
  const [selectedRfqId, setSelectedRfqId] = useState<string>('');

  // Modal & Drawer states
  const [printDoc, setPrintDoc] = useState<ProcurementPrintDoc | null>(null);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any | null>(null);
  const [ledgerSupplier, setLedgerSupplier] = useState<any | null>(null);

  const [prModalOpen, setPrModalOpen] = useState(false);
  const [prPrefillAlert, setPrPrefillAlert] = useState<any | null>(null);

  const [rfqModalOpen, setRfqModalOpen] = useState(false);
  const [rfqPrefillPr, setRfqPrefillPr] = useState<any | null>(null);

  const [quoteModalRfq, setQuoteModalRfq] = useState<any | null>(null);

  const [poModalOpen, setPoModalOpen] = useState(false);
  const [cancelPoTarget, setCancelPoTarget] = useState<any | null>(null);

  const [grnPoTarget, setGrnPoTarget] = useState<any | null>(null);
  const [inspectGrnTarget, setInspectGrnTarget] = useState<any | null>(null);

  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoicePrefillPo, setInvoicePrefillPo] = useState<any | null>(null);
  const [invoiceErrorBanner, setInvoiceErrorBanner] = useState<string | null>(null);

  const [paymentModal, setPaymentModal] = useState<{
    open: boolean;
    mode: 'ADVANCE' | 'INVOICE';
    po?: any | null;
    invoice?: any | null;
  }>({ open: false, mode: 'ADVANCE', po: null, invoice: null });

  const [debitNoteModalOpen, setDebitNoteModalOpen] = useState(false);
  const [debitNotePrefillInv, setDebitNotePrefillInv] = useState<any | null>(null);

  const loadSnapshot = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await erpApi.getProcurementSnapshot();
      setSnapshot(data);
      if (data.rfqs.length && !selectedRfqId) {
        const quotedRfq = data.rfqs.find((r) =>
          data.supplierQuotations.some((q) => q.rfqId === r.id)
        );
        setSelectedRfqId((quotedRfq || data.rfqs[0]).id);
      }
    } catch (e: any) {
      showNotification(`Procurement load notice: ${e?.message || 'Unable to load snapshot'}`);
    } finally {
      setLoading(false);
    }
  }, [selectedRfqId, showNotification]);

  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

  // Multi-browser live SSE synchronization
  useEffect(() => {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/realtime/stream');
      es.onmessage = (evt) => {
        try {
          const parsed = JSON.parse(evt.data);
          if (
            (parsed?.type === 'STATE_INVALIDATED' || parsed?.type === 'CROSS_BROWSER_SYNC') &&
            (String(parsed?.entity || '').includes('procurement') ||
              String(parsed?.entity || '').includes('erp_') ||
              String(parsed?.entity || '').includes('supplier_'))
          ) {
            loadSnapshot(true);
          }
        } catch {
          // Ignore non-JSON ping
        }
      };
    } catch {
      // Non-fatal
    }
    return () => {
      if (es) es.close();
    };
  }, [loadSnapshot]);

  const notify = (msg: string) => showNotification(msg);

  const runAction = async (fn: () => Promise<void>, successMessage: string) => {
    setBusy(true);
    try {
      await fn();
      await loadSnapshot(true);
      notify(successMessage);
    } catch (e: any) {
      notify(`Error: ${e?.message || 'Operation failed'}`);
      throw e;
    } finally {
      setBusy(false);
    }
  };

  const filteredMaterials = useMemo(() => {
    if (!snapshot) return [];
    const q = searchQuery.trim().toLowerCase();
    return snapshot.materials.filter((m) => {
      const catOk = categoryFilter === 'ALL' || m.category === categoryFilter;
      const searchOk =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.code.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q);
      return catOk && searchOk;
    });
  }, [snapshot, categoryFilter, searchQuery]);

  const filteredPos = useMemo(() => {
    if (!snapshot) return [];
    const q = searchQuery.trim().toLowerCase();
    return snapshot.purchaseOrders.filter((p) => {
      const statusOk = poStatusFilter === 'ALL' || p.status === poStatusFilter;
      const searchOk =
        !q ||
        p.poNumber.toLowerCase().includes(q) ||
        p.supplierName.toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q);
      return statusOk && searchOk;
    });
  }, [snapshot, poStatusFilter, searchQuery]);

  const activeRfq = useMemo(
    () => snapshot?.rfqs.find((r) => r.id === selectedRfqId) || snapshot?.rfqs[0] || null,
    [snapshot, selectedRfqId]
  );

  const activeRfqQuotes = useMemo(() => {
    if (!snapshot || !activeRfq) return [];
    return snapshot.supplierQuotations
      .filter((q) => q.rfqId === activeRfq.id)
      .sort((a, b) => Number(a.totalLandedCostInr) - Number(b.totalLandedCostInr));
  }, [snapshot, activeRfq]);

  if (loading && !snapshot) {
    return (
      <div className="max-w-7xl mx-auto p-6 space-y-4">
        <div className="h-24 bg-[#FFFFFF] border border-[#DED7CC] rounded-lg animate-pulse" />
        <div className="h-64 bg-[#FFFFFF] border border-[#DED7CC] rounded-lg animate-pulse" />
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="max-w-7xl mx-auto p-6 bg-[#FFFFFF] border border-[#DED7CC] rounded-lg text-center space-y-3">
        <p className="font-mono text-xs text-rose-700">Unable to load FRAGMORÉ Procurement OS.</p>
        <button
          onClick={() => loadSnapshot()}
          className="px-4 py-2 bg-[#24211D] text-[#FAF8F4] font-mono text-xs rounded cursor-pointer"
        >
          Retry Sync
        </button>
      </div>
    );
  }

  // Export generators
  const exportPurchaseRegister = async (mode: 'excel' | 'pdf') => {
    const rows = snapshot.purchaseOrders.map((p) => ({
      PONumber: p.poNumber,
      Date: p.orderDate,
      Supplier: p.supplierName,
      Category: p.category,
      TaxRegime: p.isInterState ? 'IGST' : 'CGST+SGST',
      SubtotalInr: p.subtotalInr,
      GstInr: p.gstInr,
      FreightInr: p.shippingInr,
      TotalInr: p.totalCostInr,
      Approval: p.approvalStatus,
      Status: p.status,
      Received: p.receivedStatus || 'UNRECEIVED',
      InvoicedInr: p.invoicedAmountInr || 0
    }));
    if (mode === 'excel') {
      try {
        const verified = await downloadExcelSpreadsheet('fragmore-purchase-register.xlsx', 'FRAGMORÉ Purchase Register', rows);
        notify(`Purchase Register exported (${verified.fileName}).`);
      } catch (err: any) {
        notify(err?.message || 'Purchase Register Excel export failed.');
      }
    } else {
      setPrintDoc({
        type: 'TABLE_REPORT',
        title: 'FRAGMORÉ Purchase Register',
        subtitle: `Total POs: ${rows.length} · Cumulative Commitment: ${fmtInr(snapshot.kpis.totalSpendInr)}`,
        rows
      });
    }
  };

  const exportSupplierPerformance = async (mode: 'excel' | 'pdf') => {
    const rows = snapshot.suppliers.map((s) => ({
      Code: s.code,
      Supplier: s.legalName || s.name,
      GSTIN: s.gstin || 'Unregistered',
      Category: s.category,
      LeadDaysStd: s.leadTimeDays,
      AvgLeadActual: s.computedPerformance?.avgLeadTimeDays,
      MOQ: s.moq || 1,
      OnTimePct: `${s.computedPerformance?.onTimeRatePct}%`,
      QcPassPct: `${s.computedPerformance?.qcPassRatePct}%`,
      TotalOrders: s.computedPerformance?.totalOrders,
      InvoicedInr: s.ledgerSummary?.totalInvoicedInr,
      AdvancePaidInr: s.ledgerSummary?.advancePaidInr,
      OutstandingApInr: s.ledgerSummary?.outstandingBalanceInr
    }));
    if (mode === 'excel') {
      try {
        const verified = await downloadExcelSpreadsheet(
          'fragmore-supplier-performance.xlsx',
          'FRAGMORÉ Supplier Performance & AP Summary',
          rows
        );
        notify(`Supplier Performance Report exported (${verified.fileName}).`);
      } catch (err: any) {
        notify(err?.message || 'Supplier Performance Excel export failed.');
      }
    } else {
      setPrintDoc({
        type: 'TABLE_REPORT',
        title: 'Supplier Lead-Time Performance & AP Ledger Summary',
        subtitle: `Active Suppliers: ${rows.length} · Average On-Time SLA: ${snapshot.kpis.avgSupplierOnTimePct}%`,
        rows
      });
    }
  };

  const tabs: Array<{ id: ProcTab; label: string; count?: number }> = [
    { id: 'overview', label: '01. Alerts & Categories', count: snapshot.kpis.lowStockAlertsCount },
    { id: 'rfq_compare', label: '02. PR, RFQ & Compare', count: snapshot.rfqs.length },
    { id: 'purchase_orders', label: '03. Purchase Orders', count: snapshot.purchaseOrders.length },
    { id: 'grn_qc', label: '04. GRN & QC Inspection', count: snapshot.kpis.pendingQcGrnsCount },
    { id: 'invoices_returns', label: '05. Bills, AP & Debit Notes', count: snapshot.vendorInvoices.length },
    { id: 'suppliers_reports', label: '06. Suppliers & Exports', count: snapshot.suppliers.length }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Zone */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-[#DED7CC] pb-4">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-widest text-[#9A783E]">
            FRAGMORÉ Supply Chain &amp; Accounts Payable OS
          </p>
          <h2 className="font-serif text-2xl sm:text-3xl text-[#24211D] uppercase tracking-wider mt-1">
            Procurement Management
          </h2>
          <p className="text-xs text-[#686158] mt-1 font-mono">
            PR → RFQ → Comparative Matrix → PO Thresholds → Partial GRN → QC Release → 3-Way Bill Match → Payment
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <ErpTableExportBar
            reportKey={activeTab === 'suppliers_reports' ? 'supplier_performance' : 'procurement_pos'}
            notify={(msg) => notify(msg)}
          />
          <button
            onClick={() => {
              setPrPrefillAlert(null);
              setPrModalOpen(true);
            }}
            className="px-3.5 py-2 border border-[#DED7CC] bg-[#FFFFFF] hover:border-[#9A783E] text-xs font-mono text-[#24211D] rounded flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-[#9A783E]" />
            <span>Raise PR</span>
          </button>
          <button
            onClick={() => setPoModalOpen(true)}
            className="px-4 py-2 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono rounded flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Purchase Order</span>
          </button>
          <button
            onClick={() => loadSnapshot(true)}
            className="px-3 py-2 border border-[#DED7CC] bg-[#FFFFFF] hover:border-[#24211D] text-xs font-mono rounded flex items-center gap-1.5 cursor-pointer"
            title="Sync live PostgreSQL data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Single-Level Flat KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 border border-[#DED7CC] bg-[#FFFFFF] divide-y sm:divide-y-0 sm:divide-x divide-[#DED7CC] rounded-lg">
        <div className="p-4">
          <span className="text-[10px] font-mono uppercase text-[#686158] block">PO Commitment</span>
          <span className="text-lg font-mono font-bold text-[#24211D] tabular-nums">
            {fmtInr(snapshot.kpis.totalSpendInr)}
          </span>
        </div>
        <div className="p-4">
          <span className="text-[10px] font-mono uppercase text-[#686158] block">Active POs</span>
          <span className="text-lg font-mono font-bold text-[#24211D] tabular-nums">
            {snapshot.kpis.activePosCount}
          </span>
        </div>
        <div className="p-4">
          <span className="text-[10px] font-mono uppercase text-[#686158] block">Pending QC GRNs</span>
          <span
            className={`text-lg font-mono font-bold tabular-nums ${
              snapshot.kpis.pendingQcGrnsCount > 0 ? 'text-amber-700' : 'text-emerald-700'
            }`}
          >
            {snapshot.kpis.pendingQcGrnsCount}
          </span>
        </div>
        <div className="p-4">
          <span className="text-[10px] font-mono uppercase text-[#686158] block">Outstanding AP</span>
          <span className="text-lg font-mono font-bold text-[#9A783E] tabular-nums">
            {fmtInr(snapshot.kpis.totalOutstandingApInr)}
          </span>
        </div>
        <div className="p-4">
          <span className="text-[10px] font-mono uppercase text-[#686158] block">Advance Paid</span>
          <span className="text-lg font-mono font-bold text-[#24211D] tabular-nums">
            {fmtInr(snapshot.kpis.totalAdvancePaidInr)}
          </span>
        </div>
        <div className="p-4">
          <span className="text-[10px] font-mono uppercase text-[#686158] block">Avg On-Time SLA</span>
          <span className="text-lg font-mono font-bold text-emerald-700 tabular-nums">
            {snapshot.kpis.avgSupplierOnTimePct}%
          </span>
        </div>
      </div>

      {/* Navigation Tabs & Universal Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 p-1 bg-[#F1EDE5] border border-[#DED7CC] rounded-lg">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-3 py-1.5 text-xs font-mono rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === t.id
                  ? 'bg-[#FFFFFF] text-[#24211D] font-semibold border border-[#DED7CC]'
                  : 'text-[#686158] hover:text-[#24211D]'
              }`}
            >
              {t.label} ({t.count ?? 0})
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-3.5 h-3.5 text-[#686158] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter PO, material, supplier, invoice..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-[#FFFFFF] border border-[#DED7CC] rounded-lg focus:outline-none focus:border-[#9A783E]"
          />
        </div>
      </div>

      {/* =================================================================== */}
      {/* TAB 01: REORDER ALERTS & 13 MATERIAL CATEGORIES                     */}
      {/* =================================================================== */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-lg p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#DED7CC] pb-3">
              <div>
                <h3 className="font-serif text-lg uppercase text-[#24211D]">
                  Production &amp; Low-Stock Reorder Demand Queue
                </h3>
                <p className="text-xs font-mono text-[#686158]">
                  Live shortfalls synced from Raw Materials, Batch Production schedules, and Storefront Ledger
                </p>
              </div>
              <span className="font-mono text-xs text-rose-700 font-semibold tabular-nums">
                {snapshot.reorderAlerts.length} Active Replenishment Triggers
              </span>
            </div>

            {snapshot.reorderAlerts.length === 0 ? (
              <div className="py-8 text-center font-mono text-xs text-emerald-700">
                All materials and planned production batches have sufficient safety stock.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                      <th className="py-2">Trigger Source</th>
                      <th className="py-2">Material / Batch Requirement</th>
                      <th className="py-2">Category</th>
                      <th className="py-2 text-right">Stock / Threshold</th>
                      <th className="py-2 text-right">Rec. Order</th>
                      <th className="py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DED7CC]">
                    {snapshot.reorderAlerts.map((al, i) => (
                      <tr key={`${al.id}-${i}`} className="hover:bg-[#FAF8F4]">
                        <td className="py-2.5 font-mono text-[11px]">
                          <span className={al.severity === 'CRITICAL' ? 'text-rose-700 font-bold' : 'text-amber-700 font-semibold'}>
                            {al.severity} · {al.source}
                          </span>
                        </td>
                        <td className="py-2.5">
                          <div className="font-semibold text-[#24211D]">{al.name}</div>
                          <div className="font-mono text-[11px] text-[#686158]">
                            {al.code} · {al.reason}
                          </div>
                        </td>
                        <td className="py-2.5 font-mono text-[11px] text-[#686158]">{al.category}</td>
                        <td className="py-2.5 text-right font-mono tabular-nums">
                          {al.currentStock} / {al.reorderLevel} {al.unit}
                        </td>
                        <td className="py-2.5 text-right font-mono font-semibold text-[#9A783E] tabular-nums">
                          +{al.recommendedOrderQty} {al.unit}
                        </td>
                        <td className="py-2.5 text-right">
                          <button
                            onClick={() => {
                              setPrPrefillAlert(al);
                              setPrModalOpen(true);
                            }}
                            className="px-3 py-1 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] font-mono text-[11px] rounded cursor-pointer"
                          >
                            Raise PR
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 13 Material Categories Matrix */}
          <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-lg p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#DED7CC] pb-3">
              <div>
                <h3 className="font-serif text-lg uppercase text-[#24211D]">
                  13 Standard Procurement Material Categories
                </h3>
                <p className="text-xs font-mono text-[#686158]">
                  Filter raw concentrates, flacons, caps, sprayers, labels, coffrets, equipment &amp; consumables
                </p>
              </div>
              <button
                onClick={() => setCategoryFilter('ALL')}
                className="font-mono text-xs text-[#9A783E] hover:underline cursor-pointer"
              >
                Show All Categories ({snapshot.materials.length})
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setCategoryFilter('ALL')}
                className={`px-3 py-1.5 font-mono text-[11px] rounded border cursor-pointer ${
                  categoryFilter === 'ALL'
                    ? 'bg-[#24211D] text-[#FAF8F4] border-[#24211D]'
                    : 'bg-[#FAF8F4] border-[#DED7CC] text-[#686158]'
                }`}
              >
                All ({snapshot.materials.length})
              </button>
              {snapshot.categories.map((c) => {
                const count = snapshot.materials.filter((m) => m.category === c.code).length;
                return (
                  <button
                    key={c.code}
                    onClick={() => setCategoryFilter(c.code)}
                    className={`px-3 py-1.5 font-mono text-[11px] rounded border cursor-pointer ${
                      categoryFilter === c.code
                        ? 'bg-[#24211D] text-[#FAF8F4] border-[#24211D]'
                        : 'bg-[#FAF8F4] border-[#DED7CC] text-[#686158] hover:border-[#9A783E]'
                    }`}
                  >
                    {c.label} ({count})
                  </button>
                );
              })}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                    <th className="py-2">Code &amp; Name</th>
                    <th className="py-2">Category</th>
                    <th className="py-2">HSN / GST</th>
                    <th className="py-2 text-right">Stock Level</th>
                    <th className="py-2 text-right">Reorder / Target</th>
                    <th className="py-2 text-right">Last Unit Cost</th>
                    <th className="py-2">Health</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DED7CC]">
                  {filteredMaterials.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center font-mono text-[#686158]">
                        No catalog materials tagged under {categoryFilter} yet — create a Purchase Order or PR to onboard.
                      </td>
                    </tr>
                  ) : (
                    filteredMaterials.map((m) => (
                      <tr key={m.id} className="hover:bg-[#FAF8F4]">
                        <td className="py-2.5">
                          <span className="font-semibold text-[#24211D]">{m.name}</span>
                          <span className="block font-mono text-[10px] text-[#686158]">{m.code}</span>
                        </td>
                        <td className="py-2.5 font-mono text-[11px]">{m.category}</td>
                        <td className="py-2.5 font-mono text-[11px] text-[#686158]">
                          {m.hsnCode} · {m.gstRatePct}%
                        </td>
                        <td className="py-2.5 text-right font-mono font-semibold tabular-nums">
                          {m.currentStock} {m.uom}
                        </td>
                        <td className="py-2.5 text-right font-mono text-[#686158] tabular-nums">
                          {m.reorderLevel} / {m.targetStock}
                        </td>
                        <td className="py-2.5 text-right font-mono tabular-nums">{fmtInr(m.unitCostInr)}</td>
                        <td className="py-2.5 font-mono text-[11px]">
                          <span
                            className={
                              m.currentStock <= m.reorderLevel ? 'text-rose-700 font-bold' : 'text-emerald-700'
                            }
                          >
                            {m.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 02: REQUISITIONS, RFQS & COMPARATIVE STATEMENTS                 */}
      {/* =================================================================== */}
      {activeTab === 'rfq_compare' && (
        <div className="space-y-6">
          {/* Purchase Requisitions */}
          <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#DED7CC] pb-3">
              <div>
                <h3 className="font-serif text-lg uppercase text-[#24211D]">
                  01. Purchase Requisitions (Production &amp; Inventory)
                </h3>
                <p className="text-xs font-mono text-[#686158]">
                  Departmental demand requests converted directly into competitive multi-vendor RFQs
                </p>
              </div>
              <button
                onClick={() => {
                  setPrPrefillAlert(null);
                  setPrModalOpen(true);
                }}
                className="px-3 py-1.5 bg-[#24211D] text-[#FAF8F4] font-mono text-xs rounded flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Raise PR
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                    <th className="py-2">PR #</th>
                    <th className="py-2">Department · Priority</th>
                    <th className="py-2">Requested Materials</th>
                    <th className="py-2 text-right">Est. Value</th>
                    <th className="py-2">Approval / Status</th>
                    <th className="py-2 text-right">Workflow Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DED7CC]">
                  {snapshot.requisitions.map((pr) => (
                    <tr key={pr.id} className="hover:bg-[#FAF8F4]">
                      <td className="py-2.5 font-mono font-bold text-[#9A783E]">{pr.requisitionNumber}</td>
                      <td className="py-2.5 font-mono text-[11px]">
                        {pr.sourceDepartment} · {pr.priority}
                        <span className="block text-[#686158]">Due: {pr.requiredByDate}</span>
                      </td>
                      <td className="py-2.5">
                        {(pr.items || []).map((it: any, idx: number) => (
                          <div key={idx} className="truncate max-w-xs">
                            {it.materialName} ({it.qty} {it.unit})
                          </div>
                        ))}
                      </td>
                      <td className="py-2.5 text-right font-mono tabular-nums font-semibold">
                        {fmtInr(pr.estimatedTotalInr)}
                      </td>
                      <td className="py-2.5 font-mono text-[11px]">
                        {pr.approvalStatus} · {pr.status}
                      </td>
                      <td className="py-2.5 text-right">
                        {pr.status === 'OPEN' ? (
                          <button
                            onClick={() => {
                              setRfqPrefillPr(pr);
                              setRfqModalOpen(true);
                            }}
                            className="px-3 py-1 border border-[#9A783E] text-[#9A783E] hover:bg-[#9A783E] hover:text-white font-mono text-[11px] rounded cursor-pointer"
                          >
                            Issue RFQ
                          </button>
                        ) : (
                          <span className="font-mono text-[11px] text-[#686158]">{pr.status}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* RFQs & Comparative Matrix */}
          <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-lg p-5 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DED7CC] pb-3">
              <div>
                <h3 className="font-serif text-lg uppercase text-[#24211D]">
                  02. RFQs &amp; Side-by-Side Comparative Statement
                </h3>
                <p className="text-xs font-mono text-[#686158]">
                  Compare unit rates, GST, freight, delivery lead days, and payment terms across bidders
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setRfqPrefillPr(null);
                    setRfqModalOpen(true);
                  }}
                  className="px-3 py-1.5 border border-[#DED7CC] font-mono text-xs rounded hover:border-[#9A783E] cursor-pointer"
                >
                  + New Standalone RFQ
                </button>
                {activeRfq && (
                  <>
                    <button
                      onClick={() => setQuoteModalRfq(activeRfq)}
                      className="px-3 py-1.5 bg-[#24211D] text-[#FAF8F4] font-mono text-xs rounded cursor-pointer"
                    >
                      + Log Supplier Quote
                    </button>
                    <button
                      onClick={() =>
                        setPrintDoc({
                          type: 'RFQ',
                          data: activeRfq,
                          suppliers: snapshot.suppliers
                        })
                      }
                      className="px-3 py-1.5 border border-[#DED7CC] font-mono text-xs rounded flex items-center gap-1 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" /> RFQ PDF
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {snapshot.rfqs.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedRfqId(r.id)}
                  className={`px-3 py-2 text-left rounded border font-mono text-xs cursor-pointer ${
                    activeRfq?.id === r.id
                      ? 'bg-[#24211D] text-[#FAF8F4] border-[#24211D]'
                      : 'bg-[#FAF8F4] border-[#DED7CC] text-[#24211D]'
                  }`}
                >
                  <div className="font-bold">{r.rfqNumber}</div>
                  <div className="text-[10px] opacity-80 truncate max-w-[200px]">{r.title}</div>
                </button>
              ))}
            </div>

            {activeRfq && (
              <div className="space-y-4 border-t border-[#DED7CC] pt-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="font-mono text-xs text-[#686158]">
                    Evaluating <span className="font-bold text-[#24211D]">{activeRfq.rfqNumber}</span> ·{' '}
                    {activeRfq.title} · Deadline {activeRfq.responseDeadline}
                  </div>
                  {activeRfqQuotes.length > 0 && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const rows = activeRfqQuotes.map((q) => ({
                            QuoteNo: q.quotationNumber,
                            Supplier: q.supplierName,
                            SubtotalInr: q.subtotalInr,
                            TaxInr: q.taxInr,
                            FreightInr: q.freightInr,
                            TotalLandedInr: q.totalLandedCostInr,
                            DeliveryDays: q.deliveryDays,
                            PaymentTerms: q.paymentTerms,
                            Status: q.status
                          }));
                          downloadExcelSpreadsheet(
                            `comparative-${activeRfq.rfqNumber}.xls`,
                            `Comparative Statement - ${activeRfq.rfqNumber}`,
                            rows
                          );
                          notify('Comparative Statement Excel downloaded.');
                        }}
                        className="px-3 py-1 border border-[#DED7CC] rounded font-mono text-[11px] flex items-center gap-1 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-[#9A783E]" /> Compare Excel
                      </button>
                      <button
                        onClick={() =>
                          setPrintDoc({
                            type: 'COMPARATIVE',
                            rfq: activeRfq,
                            quotes: activeRfqQuotes
                          })
                        }
                        className="px-3 py-1 border border-[#DED7CC] rounded font-mono text-[11px] flex items-center gap-1 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" /> Compare PDF
                      </button>
                    </div>
                  )}
                </div>

                {activeRfqQuotes.length === 0 ? (
                  <div className="p-6 text-center font-mono text-xs bg-[#FAF8F4] border border-[#DED7CC] rounded text-[#686158]">
                    No supplier quotations logged yet for {activeRfq.rfqNumber}. Click &ldquo;+ Log Supplier Quote&rdquo; above.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                          <th className="py-2">Quote # / Supplier</th>
                          <th className="py-2">Unit Rates Breakdown</th>
                          <th className="py-2 text-right">Tax &amp; Freight</th>
                          <th className="py-2 text-right">Landed Total</th>
                          <th className="py-2 text-right">Lead / Terms</th>
                          <th className="py-2 text-right">Award Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#DED7CC]">
                        {activeRfqQuotes.map((q, idx) => {
                          const isLowest = idx === 0;
                          return (
                            <tr key={q.id} className={q.isSelectedWinner ? 'bg-[#FAF8F4]' : 'hover:bg-[#FAF8F4]'}>
                              <td className="py-3">
                                <div className="font-semibold text-[#24211D]">{q.supplierName}</div>
                                <div className="font-mono text-[11px] text-[#686158]">
                                  {q.quotationNumber} · Ref: {q.vendorRefNumber || '—'}
                                  {isLowest && (
                                    <span className="ml-2 text-emerald-700 font-bold">L1 LOWEST LANDED</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 font-mono text-[11px]">
                                {(q.items || []).map((it: any, i: number) => (
                                  <div key={i}>
                                    {it.materialName.slice(0, 32)}: {fmtInr(it.unitPriceInr)}/{it.unit} ({it.taxPct}%)
                                  </div>
                                ))}
                              </td>
                              <td className="py-3 text-right font-mono tabular-nums">
                                Tax: {fmtInr(q.taxInr)}
                                <span className="block text-[#686158]">Freight: {fmtInr(q.freightInr)}</span>
                              </td>
                              <td className="py-3 text-right font-mono font-bold text-[#9A783E] tabular-nums">
                                {fmtInr(q.totalLandedCostInr)}
                              </td>
                              <td className="py-3 text-right font-mono tabular-nums">
                                {q.deliveryDays} days
                                <span className="block text-[10px] text-[#686158]">{q.paymentTerms}</span>
                              </td>
                              <td className="py-3 text-right">
                                {activeRfq.status === 'AWARDED' ? (
                                  <span className="font-mono text-[11px] font-bold text-emerald-700">
                                    {q.isSelectedWinner ? 'AWARDED PO' : q.status}
                                  </span>
                                ) : (
                                  <button
                                    disabled={busy}
                                    onClick={() =>
                                      runAction(async () => {
                                        await erpApi.awardQuotationToPo(q.id);
                                        setActiveTab('purchase_orders');
                                      }, `Awarded ${q.quotationNumber} & generated Purchase Order.`)
                                    }
                                    className="px-3 py-1.5 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] font-mono text-[11px] rounded inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <Award className="w-3.5 h-3.5" /> Award &amp; Issue PO
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 03: PURCHASE ORDERS & APPROVAL THRESHOLDS                       */}
      {/* =================================================================== */}
      {activeTab === 'purchase_orders' && (
        <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-lg p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DED7CC] pb-3">
            <div className="flex flex-wrap gap-1">
              {['ALL', 'PENDING_APPROVAL', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setPoStatusFilter(st)}
                  className={`px-2.5 py-1 font-mono text-[11px] rounded border cursor-pointer ${
                    poStatusFilter === st
                      ? 'bg-[#24211D] text-[#FAF8F4] border-[#24211D]'
                      : 'bg-[#FAF8F4] border-[#DED7CC] text-[#686158]'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => exportPurchaseRegister('excel')}
                className="px-3 py-1.5 border border-[#DED7CC] rounded font-mono text-[11px] flex items-center gap-1 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#9A783E]" /> Register Excel
              </button>
              <button
                onClick={() => exportPurchaseRegister('pdf')}
                className="px-3 py-1.5 border border-[#DED7CC] rounded font-mono text-[11px] flex items-center gap-1 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" /> Register PDF
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                  <th className="py-2">PO # &amp; Date</th>
                  <th className="py-2">Supplier &amp; Regime</th>
                  <th className="py-2">Items &amp; Threshold</th>
                  <th className="py-2 text-right">PO Total / Advance</th>
                  <th className="py-2">Status &amp; Delivery</th>
                  <th className="py-2 text-right">Workflow Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DED7CC]">
                {filteredPos.map((po) => {
                  const sup = snapshot.suppliers.find((s) => s.id === po.supplierId);
                  return (
                    <tr key={po.id} className="hover:bg-[#FAF8F4]">
                      <td className="py-3 font-mono">
                        <div className="font-bold text-[#9A783E]">{po.poNumber}</div>
                        <div className="text-[11px] text-[#686158]">{po.orderDate}</div>
                      </td>
                      <td className="py-3">
                        <div className="font-semibold text-[#24211D]">{po.supplierName}</div>
                        <div className="font-mono text-[10px] text-[#686158]">
                          {po.isInterState ? 'IGST' : 'CGST+SGST'} · {po.paymentTerms}
                        </div>
                      </td>
                      <td className="py-3">
                        <div>{(po.items || []).map((i: any) => `${i.name} (${i.receivedQty || 0}/${i.quantity})`).join(', ').slice(0, 68)}</div>
                        <div className="font-mono text-[10px] text-[#686158]">
                          {po.approvalThresholdTier || 'AUTO_STANDARD'} · {po.approvalStatus || 'APPROVED'}
                        </div>
                      </td>
                      <td className="py-3 text-right font-mono tabular-nums">
                        <div className="font-bold">{fmtInr(po.totalCostInr)}</div>
                        <div className="text-[10px] text-[#686158]">
                          Adv: {fmtInr(po.advancePaidInr)} · Inv: {fmtInr(po.invoicedAmountInr)}
                        </div>
                      </td>
                      <td className="py-3 font-mono text-[11px]">
                        <span
                          className={
                            po.status === 'CANCELLED'
                              ? 'text-rose-700 font-bold'
                              : po.status === 'RECEIVED'
                              ? 'text-emerald-700 font-bold'
                              : 'text-[#9A783E] font-semibold'
                          }
                        >
                          {po.status}
                        </span>
                        <span className="block text-[10px] text-[#686158]">
                          Due: {po.expectedDeliveryDate}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex flex-wrap justify-end gap-1.5 font-mono text-[11px]">
                          {po.status !== 'CANCELLED' && po.approvalStatus !== 'PENDING_APPROVAL' && po.status !== 'RECEIVED' && (
                            <button
                              onClick={() => setGrnPoTarget(po)}
                              className="px-2.5 py-1 bg-[#24211D] text-[#FAF8F4] rounded cursor-pointer"
                            >
                              Receive GRN
                            </button>
                          )}
                          {po.status !== 'CANCELLED' && (
                            <>
                              <button
                                onClick={() => setPaymentModal({ open: true, mode: 'ADVANCE', po })}
                                className="px-2 py-1 border border-[#DED7CC] rounded hover:border-[#9A783E] cursor-pointer"
                                title="Record Advance Payment"
                              >
                                Advance
                              </button>
                              <button
                                onClick={() => {
                                  setInvoicePrefillPo(po);
                                  setInvoiceErrorBanner(null);
                                  setInvoiceModalOpen(true);
                                }}
                                className="px-2 py-1 border border-[#DED7CC] rounded hover:border-[#9A783E] cursor-pointer"
                                title="Post Supplier Invoice"
                              >
                                Post Bill
                              </button>
                            </>
                          )}
                          {po.status !== 'CANCELLED' && po.status !== 'RECEIVED' && (
                            <button
                              onClick={() => setCancelPoTarget(po)}
                              className="px-2 py-1 border border-rose-200 text-rose-700 rounded cursor-pointer"
                              title="Cancel Purchase Order"
                            >
                              Cancel
                            </button>
                          )}
                          <button
                            onClick={() =>
                              setPrintDoc({ type: 'PO', data: po, supplier: sup })
                            }
                            className="px-2 py-1 border border-[#DED7CC] rounded cursor-pointer"
                            title="Print / Save PO PDF"
                          >
                            PDF
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

      {/* =================================================================== */}
      {/* TAB 04: GOODS RECEIPTS (PARTIAL/MULTI GRN) & QUALITY INSPECTION     */}
      {/* =================================================================== */}
      {activeTab === 'grn_qc' && (
        <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-lg p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DED7CC] pb-3">
            <div>
              <h3 className="font-serif text-lg uppercase text-[#24211D]">
                Goods Receipts (Partial / Multi-Delivery) &amp; Quality Inspection Gate
              </h3>
              <p className="text-xs font-mono text-[#686158]">
                Only QC-approved quantities credit Inventory &amp; FIFO Stock Lots (posts Dr 1200 Inventory / Cr 2110 GRNI)
              </p>
            </div>
            <button
              onClick={() => {
                const openPo = snapshot.purchaseOrders.find(
                  (p) => p.status !== 'CANCELLED' && p.status !== 'RECEIVED' && p.approvalStatus === 'APPROVED'
                );
                if (openPo) setGrnPoTarget(openPo);
                else notify('No open approved Purchase Order ready for receipt.');
              }}
              className="px-3.5 py-2 bg-[#24211D] text-[#FAF8F4] font-mono text-xs rounded flex items-center gap-1.5 cursor-pointer"
            >
              <Truck className="w-3.5 h-3.5" /> Log New Partial GRN
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                  <th className="py-2">GRN # &amp; Date</th>
                  <th className="py-2">Supplier / Challan</th>
                  <th className="py-2">Received vs Accepted Items</th>
                  <th className="py-2 text-right">Capitalized Value</th>
                  <th className="py-2">QC &amp; Inventory Gate</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DED7CC]">
                {snapshot.goodsReceipts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center font-mono text-[#686158]">
                      No Goods Receipts logged yet. Open an active PO or click &ldquo;Log New Partial GRN&rdquo;.
                    </td>
                  </tr>
                ) : (
                  snapshot.goodsReceipts.map((g) => (
                    <tr key={g.id} className="hover:bg-[#FAF8F4]">
                      <td className="py-3 font-mono">
                        <div className="font-bold text-[#9A783E]">{g.grnNumber}</div>
                        <div className="text-[11px] text-[#686158]">{g.receivedDate}</div>
                      </td>
                      <td className="py-3">
                        <div className="font-semibold">{g.supplierName}</div>
                        <div className="font-mono text-[11px] text-[#686158]">Challan: {g.challanNumber}</div>
                      </td>
                      <td className="py-3 font-mono text-[11px]">
                        {(g.items || []).map((it: any, idx: number) => (
                          <div key={idx}>
                            {it.materialName.slice(0, 34)}: Rec {it.receivedQty} · Acc {it.acceptedQty} · Rej {it.rejectedQty || 0} ({it.lotNumber})
                          </div>
                        ))}
                      </td>
                      <td className="py-3 text-right font-mono font-semibold tabular-nums">
                        {fmtInr(g.subtotalInr)}
                      </td>
                      <td className="py-3 font-mono text-[11px]">
                        <div className={g.inventoryPosted ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                          {g.qcStatus}
                        </div>
                        <div className="text-[10px] text-[#686158]">
                          {g.inventoryPosted ? `Stock Posted (${g.inspectedByEmail || 'QC'})` : 'Quarantined · Awaiting Lab QC'}
                        </div>
                      </td>
                      <td className="py-3 text-right font-mono text-[11px] space-x-1.5">
                        {!g.inventoryPosted && (
                          <button
                            onClick={() => setInspectGrnTarget(g)}
                            className="px-3 py-1 bg-[#9A783E] text-white rounded cursor-pointer"
                          >
                            Inspect &amp; Release Stock
                          </button>
                        )}
                        <button
                          onClick={() => setPrintDoc({ type: 'GRN', data: g })}
                          className="px-2.5 py-1 border border-[#DED7CC] rounded cursor-pointer"
                        >
                          GRN PDF
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 05: SUPPLIER INVOICES, NON-PO BILLS, PAYMENTS & DEBIT NOTES     */}
      {/* =================================================================== */}
      {activeTab === 'invoices_returns' && (
        <div className="space-y-6">
          <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-lg p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DED7CC] pb-3">
              <div>
                <h3 className="font-serif text-lg uppercase text-[#24211D]">
                  Supplier Invoices (PO-Matched &amp; Non-PO) · Zero Duplicate AP
                </h3>
                <p className="text-xs font-mono text-[#686158]">
                  Duplicate vendor bill detection enabled per supplier · Non-PO purchases enforce Controller approval
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setDebitNotePrefillInv(null);
                    setDebitNoteModalOpen(true);
                  }}
                  className="px-3 py-1.5 border border-[#DED7CC] rounded font-mono text-xs flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-rose-700" /> Issue Debit Note
                </button>
                <button
                  onClick={() => {
                    setInvoicePrefillPo(null);
                    setInvoiceErrorBanner(null);
                    setInvoiceModalOpen(true);
                  }}
                  className="px-3.5 py-1.5 bg-[#24211D] text-[#FAF8F4] font-mono text-xs rounded flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Record Supplier Invoice
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                    <th className="py-2">Voucher / Vendor Bill #</th>
                    <th className="py-2">Supplier &amp; Match Type</th>
                    <th className="py-2 text-right">Taxable + GST</th>
                    <th className="py-2 text-right">Total / Balance Due</th>
                    <th className="py-2">AP Posting &amp; Status</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DED7CC]">
                  {snapshot.vendorInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center font-mono text-[#686158]">
                        No supplier bills posted yet. Click &ldquo;Record Supplier Invoice&rdquo; to post PO or Non-PO bills.
                      </td>
                    </tr>
                  ) : (
                    snapshot.vendorInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-[#FAF8F4]">
                        <td className="py-3 font-mono">
                          <div className="font-bold text-[#9A783E]">{inv.voucherNumber}</div>
                          <div className="text-[11px] text-[#24211D]">Bill #{inv.supplierInvoiceNumber}</div>
                          <div className="text-[10px] text-[#686158]">{inv.invoiceDate} · Due {inv.dueDate}</div>
                        </td>
                        <td className="py-3">
                          <div className="font-semibold">{inv.supplierName}</div>
                          <div className="font-mono text-[10px] text-[#686158]">
                            {inv.isNonPo ? `NON-PO (${inv.expenseCategory})` : `PO Matched (${(inv.grnIds || []).length} GRNs)`}
                            {inv.attachmentName && ` · 📎 ${inv.attachmentName}`}
                          </div>
                        </td>
                        <td className="py-3 text-right font-mono tabular-nums">
                          {fmtInr(inv.subtotalInr)}
                          <span className="block text-[10px] text-[#686158]">
                            GST: {fmtInr((inv.cgstInr || 0) + (inv.sgstInr || 0) + (inv.igstInr || 0))}
                          </span>
                        </td>
                        <td className="py-3 text-right font-mono tabular-nums">
                          <div className="font-bold">{fmtInr(inv.totalAmountInr)}</div>
                          <div className={inv.balanceDueInr > 0 ? 'text-[#9A783E] font-semibold' : 'text-emerald-700'}>
                            Due: {fmtInr(inv.balanceDueInr)}
                          </div>
                        </td>
                        <td className="py-3 font-mono text-[11px]">
                          <div>{inv.approvalStatus} · {inv.paymentStatus}</div>
                          <div className="text-[10px] text-[#686158]">
                            {inv.journalPosted ? 'AP Posted (No Duplicate)' : 'Awaiting Finance Approval'}
                          </div>
                        </td>
                        <td className="py-3 text-right font-mono text-[11px] space-x-1.5">
                          {inv.approvalStatus !== 'APPROVED' && (
                            <button
                              disabled={busy}
                              onClick={() =>
                                runAction(
                                  () => erpApi.approveVendorInvoice(inv.id),
                                  `Approved & posted AP journal for ${inv.voucherNumber}.`
                                )
                              }
                              className="px-2.5 py-1 bg-[#9A783E] text-white rounded cursor-pointer"
                            >
                              Approve &amp; Post AP
                            </button>
                          )}
                          {inv.approvalStatus === 'APPROVED' && Number(inv.balanceDueInr) > 0.5 && (
                            <button
                              onClick={() =>
                                setPaymentModal({ open: true, mode: 'INVOICE', invoice: inv })
                              }
                              className="px-2.5 py-1 bg-[#24211D] text-[#FAF8F4] rounded cursor-pointer"
                            >
                              Pay Bill
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setDebitNotePrefillInv(inv);
                              setDebitNoteModalOpen(true);
                            }}
                            className="px-2 py-1 border border-[#DED7CC] rounded cursor-pointer"
                          >
                            Debit Note
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Debit Notes & Supplier Payouts Split Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-lg p-5 space-y-3">
              <h3 className="font-serif text-base uppercase text-[#24211D] border-b border-[#DED7CC] pb-2">
                Purchase Returns &amp; Debit Notes ({snapshot.debitNotes.length})
              </h3>
              {snapshot.debitNotes.length === 0 ? (
                <p className="py-4 font-mono text-xs text-[#686158]">No supplier debit notes issued yet.</p>
              ) : (
                <div className="divide-y divide-[#DED7CC] text-xs">
                  {snapshot.debitNotes.map((d) => (
                    <div key={d.id} className="py-2.5 flex items-center justify-between gap-2">
                      <div>
                        <div className="font-mono font-bold text-rose-700">{d.debitNoteNumber}</div>
                        <div className="font-semibold">{d.supplierName}</div>
                        <div className="font-mono text-[10px] text-[#686158]">{d.returnType} · {d.reason}</div>
                      </div>
                      <div className="font-mono font-bold tabular-nums">{fmtInr(d.totalDebitInr)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-lg p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-[#DED7CC] pb-2">
                <h3 className="font-serif text-base uppercase text-[#24211D]">
                  Supplier Advances &amp; Payouts ({snapshot.vendorPayments.length})
                </h3>
                <button
                  onClick={() => setPaymentModal({ open: true, mode: 'ADVANCE', po: null })}
                  className="font-mono text-[11px] text-[#9A783E] hover:underline cursor-pointer"
                >
                  + Direct Advance
                </button>
              </div>
              {snapshot.vendorPayments.length === 0 ? (
                <p className="py-4 font-mono text-xs text-[#686158]">No outbound supplier payments recorded yet.</p>
              ) : (
                <div className="divide-y divide-[#DED7CC] text-xs">
                  {snapshot.vendorPayments.map((p) => (
                    <div key={p.id} className="py-2.5 flex items-center justify-between gap-2">
                      <div>
                        <div className="font-mono font-bold text-[#9A783E]">
                          {p.paymentNumber} · {p.isAdvance ? 'ADVANCE' : 'AP SETTLEMENT'}
                        </div>
                        <div className="font-semibold">{p.partyName}</div>
                        <div className="font-mono text-[10px] text-[#686158]">
                          {p.paymentDate} · {p.method} {p.referenceNumber}
                        </div>
                      </div>
                      <div className="font-mono font-bold text-emerald-700 tabular-nums">{fmtInr(p.amountInr)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 06: SUPPLIERS DIRECTORY, LEDGER & PROCUREMENT REPORTS           */}
      {/* =================================================================== */}
      {activeTab === 'suppliers_reports' && (
        <div className="space-y-6">
          <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-lg p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DED7CC] pb-3">
              <div>
                <h3 className="font-serif text-lg uppercase text-[#24211D]">
                  Supplier Directory &amp; Statutory Masters
                </h3>
                <p className="text-xs font-mono text-[#686158]">
                  Legal names, GSTIN/PAN, payment &amp; bank details, MOQ, lead times, and live SLA performance
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => exportSupplierPerformance('excel')}
                  className="px-3 py-1.5 border border-[#DED7CC] rounded font-mono text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-[#9A783E]" /> Performance Excel
                </button>
                <button
                  onClick={() => exportSupplierPerformance('pdf')}
                  className="px-3 py-1.5 border border-[#DED7CC] rounded font-mono text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> Performance PDF
                </button>
                <button
                  onClick={() => {
                    setEditingSupplier(null);
                    setSupplierModalOpen(true);
                  }}
                  className="px-3.5 py-1.5 bg-[#24211D] text-[#FAF8F4] font-mono text-xs rounded flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Supplier
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                    <th className="py-2">Supplier &amp; Legal Identity</th>
                    <th className="py-2">GSTIN / PAN / Bank</th>
                    <th className="py-2">Categories &amp; MOQ</th>
                    <th className="py-2 text-right">SLA Performance</th>
                    <th className="py-2 text-right">Outstanding AP / Adv</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DED7CC]">
                  {snapshot.suppliers.map((s) => (
                    <tr key={s.id} className="hover:bg-[#FAF8F4]">
                      <td className="py-3">
                        <div className="font-semibold text-[#24211D]">{s.legalName || s.name}</div>
                        <div className="font-mono text-[10px] text-[#686158]">
                          {s.code} · {s.contactPerson} · {s.city}, {s.stateName || 'MH'}
                        </div>
                      </td>
                      <td className="py-3 font-mono text-[11px]">
                        <div>GSTIN: {s.gstin || '—'} · PAN: {s.pan || '—'}</div>
                        <div className="text-[10px] text-[#686158]">
                          {s.bankDetails?.bankName || 'Bank'} ({s.bankDetails?.ifsc || '—'})
                        </div>
                      </td>
                      <td className="py-3 font-mono text-[11px]">
                        <div>{(s.materialsSupplied || [s.category]).slice(0, 3).join(', ')}</div>
                        <div className="text-[10px] text-[#686158]">
                          Terms: {s.paymentTerms} · MOQ: {s.moq || 1}
                        </div>
                      </td>
                      <td className="py-3 text-right font-mono tabular-nums">
                        <div className="text-emerald-700 font-semibold">
                          {s.computedPerformance?.onTimeRatePct}% On-Time
                        </div>
                        <div className="text-[10px] text-[#686158]">
                          {s.computedPerformance?.avgLeadTimeDays}d Avg · QC {s.computedPerformance?.qcPassRatePct}%
                        </div>
                      </td>
                      <td className="py-3 text-right font-mono tabular-nums">
                        <div className="font-bold text-[#9A783E]">
                          {fmtInr(s.ledgerSummary?.outstandingBalanceInr)}
                        </div>
                        <div className="text-[10px] text-[#686158]">
                          Adv: {fmtInr(s.ledgerSummary?.advancePaidInr)}
                        </div>
                      </td>
                      <td className="py-3 text-right font-mono text-[11px] space-x-1.5">
                        <button
                          onClick={() => setLedgerSupplier(s)}
                          className="px-2.5 py-1 bg-[#24211D] text-[#FAF8F4] rounded cursor-pointer"
                        >
                          Ledger
                        </button>
                        <button
                          onClick={() => {
                            setEditingSupplier(s);
                            setSupplierModalOpen(true);
                          }}
                          className="px-2.5 py-1 border border-[#DED7CC] rounded cursor-pointer"
                        >
                          Edit
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

      {/* ALL MODALS & DRAWERS */}
      <ProcurementPrintModal doc={printDoc} onClose={() => setPrintDoc(null)} />

      <SupplierFormModal
        open={supplierModalOpen}
        initialSupplier={editingSupplier}
        categories={snapshot.categories}
        busy={busy}
        onClose={() => setSupplierModalOpen(false)}
        onSubmit={async (payload) => {
          await runAction(async () => {
            await erpApi.upsertProcurementSupplier(payload);
            setSupplierModalOpen(false);
          }, 'Supplier master persisted to PostgreSQL.');
        }}
      />

      <PurchaseRequisitionModal
        open={prModalOpen}
        snapshot={snapshot}
        prefillItem={prPrefillAlert}
        busy={busy}
        onClose={() => setPrModalOpen(false)}
        onSubmit={async (payload) => {
          await runAction(async () => {
            await erpApi.createPurchaseRequisition(payload);
            setPrModalOpen(false);
            setActiveTab('rfq_compare');
          }, 'Purchase Requisition created.');
        }}
      />

      <CreateRfqModal
        open={rfqModalOpen}
        snapshot={snapshot}
        prefillPr={rfqPrefillPr}
        busy={busy}
        onClose={() => setRfqModalOpen(false)}
        onSubmit={async (payload) => {
          await runAction(async () => {
            const res = await erpApi.createProcurementRfq(payload);
            if (res?.rfq?.id) setSelectedRfqId(res.rfq.id);
            setRfqModalOpen(false);
          }, 'RFQ tender issued to selected suppliers.');
        }}
      />

      <SupplierQuotationModal
        open={Boolean(quoteModalRfq)}
        rfq={quoteModalRfq}
        suppliers={snapshot.suppliers}
        busy={busy}
        onClose={() => setQuoteModalRfq(null)}
        onSubmit={async (payload) => {
          await runAction(async () => {
            await erpApi.recordSupplierQuotation(payload);
            setQuoteModalRfq(null);
          }, 'Supplier quotation added to Comparative Statement.');
        }}
      />

      <PurchaseOrderFormModal
        open={poModalOpen}
        snapshot={snapshot}
        busy={busy}
        onClose={() => setPoModalOpen(false)}
        onSubmit={async (payload) => {
          await runAction(async () => {
            await erpApi.createProcurementPo(payload);
            setPoModalOpen(false);
            setActiveTab('purchase_orders');
          }, 'Purchase Order generated & persisted.');
        }}
      />

      <CancelPoModal
        po={cancelPoTarget}
        busy={busy}
        onClose={() => setCancelPoTarget(null)}
        onConfirm={async (poId, reason) => {
          await runAction(async () => {
            await erpApi.cancelProcurementPo(poId, reason);
            setCancelPoTarget(null);
          }, 'Purchase Order cancelled with audit trail.');
        }}
      />

      <PartialGrnModal
        open={Boolean(grnPoTarget)}
        po={grnPoTarget}
        warehouses={snapshot.warehouses}
        busy={busy}
        onClose={() => setGrnPoTarget(null)}
        onSubmit={async (payload) => {
          await runAction(async () => {
            await erpApi.createProcurementGrn(payload);
            setGrnPoTarget(null);
            setActiveTab('grn_qc');
          }, 'Goods Receipt recorded cleanly.');
        }}
      />

      <GrnInspectModal
        open={Boolean(inspectGrnTarget)}
        grn={inspectGrnTarget}
        busy={busy}
        onClose={() => setInspectGrnTarget(null)}
        onSubmit={async (grnId, payload) => {
          await runAction(async () => {
            await erpApi.inspectProcurementGrn(grnId, payload);
            setInspectGrnTarget(null);
          }, 'GRN QC completed & FIFO inventory stock capitalized.');
        }}
      />

      <VendorInvoiceModal
        open={invoiceModalOpen}
        snapshot={snapshot}
        prefillPo={invoicePrefillPo}
        busy={busy}
        errorBanner={invoiceErrorBanner}
        onClose={() => setInvoiceModalOpen(false)}
        onSubmit={async (payload) => {
          setInvoiceErrorBanner(null);
          try {
            await runAction(async () => {
              await erpApi.postVendorInvoice(payload);
              setInvoiceModalOpen(false);
              setActiveTab('invoices_returns');
            }, 'Supplier Tax Invoice recorded cleanly.');
          } catch (e: any) {
            setInvoiceErrorBanner(e?.message || 'Failed to record vendor invoice');
          }
        }}
      />

      <SupplierPaymentModal
        open={paymentModal.open}
        snapshot={snapshot}
        mode={paymentModal.mode}
        targetPo={paymentModal.po}
        targetInvoice={paymentModal.invoice}
        busy={busy}
        onClose={() => setPaymentModal({ open: false, mode: 'ADVANCE', po: null, invoice: null })}
        onSubmit={async (payload) => {
          await runAction(async () => {
            await erpApi.recordSupplierPayment(payload);
            setPaymentModal({ open: false, mode: 'ADVANCE', po: null, invoice: null });
          }, 'Supplier payment & accounting journal posted.');
        }}
      />

      <DebitNoteModal
        open={debitNoteModalOpen}
        snapshot={snapshot}
        prefillInvoice={debitNotePrefillInv}
        busy={busy}
        onClose={() => setDebitNoteModalOpen(false)}
        onSubmit={async (payload) => {
          await runAction(async () => {
            await erpApi.issueDebitNote(payload);
            setDebitNoteModalOpen(false);
          }, 'Debit Note issued & stock/AP balances updated.');
        }}
      />

      <SupplierLedgerDrawer
        supplier={ledgerSupplier}
        snapshot={snapshot}
        onClose={() => setLedgerSupplier(null)}
        onPrintLedger={(supplier, invoices, debitNotes, payments) =>
          setPrintDoc({ type: 'SUPPLIER_LEDGER', supplier, invoices, debitNotes, payments })
        }
        onExportLedgerExcel={(supplier, rows) => {
          downloadExcelSpreadsheet(
            `ledger-${supplier.code}.xls`,
            `Supplier Ledger — ${supplier.legalName || supplier.name}`,
            rows
          );
          notify(`Exported ledger for ${supplier.name}.`);
        }}
      />
    </div>
  );
};
