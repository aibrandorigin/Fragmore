import React, { useState, useEffect, useCallback } from 'react';
import { Printer, FileSpreadsheet, Download, CheckCircle2, ShieldCheck, Plus, Trash2, ArrowRightLeft } from 'lucide-react';
import {
  erpApi,
  downloadCsvFile,
  downloadExcelSpreadsheet,
  type ErpGstAccountingSnapshot
} from '../../../lib/erpApi';
import { GstDocumentPrintModal, type GstPrintablePayload } from './GstDocumentPrintModal';
import { ErpTableExportBar } from './ErpUniversalExportModal';

interface Props {
  onRefreshParent: () => Promise<void>;
  notify: (msg: string, type?: 'success' | 'error') => void;
}

type BillingTab =
  | 'INVOICES'
  | 'ADVANCES_RECEIPTS'
  | 'RETURNS_CN'
  | 'DEBIT_NOTES'
  | 'CHALLANS'
  | 'STATEMENTS'
  | 'GST_CONFIG';

const fmt = (n: number) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const ErpGstBillingWorkspace: React.FC<Props> = ({ onRefreshParent, notify }) => {
  const [snap, setSnap] = useState<ErpGstAccountingSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<BillingTab>('INVOICES');
  const [printDoc, setPrintDoc] = useState<GstPrintablePayload | null>(null);

  // Storefront Order quick-invoice
  const [selectedOrderId, setSelectedOrderId] = useState('');

  // Composer state for Invoice / Proforma
  const [billForm, setBillForm] = useState({
    invoiceType: 'TAX_INVOICE' as 'TAX_INVOICE' | 'B2B_GST_INVOICE' | 'PROFORMA',
    billingCategory: 'B2B' as 'B2C' | 'B2B' | 'CORPORATE_GIFTING' | 'EVENT_SERVICES' | 'SAMPLE_SALES' | 'WHOLESALE',
    pricingMode: 'EXCLUSIVE' as 'EXCLUSIVE' | 'INCLUSIVE',
    customerName: '',
    customerEmail: '',
    customerGstin: '',
    billingAddress: '',
    placeOfSupplyState: 'Maharashtra',
    advancePaymentId: '',
    discountInr: 0,
    shippingInr: 0,
    notes: ''
  });
  const [billItems, setBillItems] = useState<Array<{ sku: string; description: string; hsnCode: string; qty: number; unitPriceInr: number }>>([
    { sku: 'FRG-GOLD-50', description: 'Golden Hour 50ml Extrait de Parfum', hsnCode: '33030050', qty: 4, unitPriceInr: 2541 }
  ]);

  // Statutory IRN / EWB modal state
  const [statModalInv, setStatModalInv] = useState<any | null>(null);
  const [statForm, setStatForm] = useState({
    eInvoiceStatus: 'IRN_VERIFIED' as 'NOT_APPLICABLE' | 'PENDING_NIC_GENERATION' | 'IRN_VERIFIED' | 'CANCELLED',
    eInvoiceIrn: '',
    irnAckNumber: '',
    eWayBillStatus: 'EWB_VERIFIED' as 'NOT_REQUIRED' | 'PENDING_EWB_GENERATION' | 'EWB_VERIFIED',
    eWayBillNumber: ''
  });

  // Advance & Payment Receipt forms
  const [advForm, setAdvForm] = useState({
    customerName: '',
    customerEmail: '',
    accountCode: '1010' as '1010' | '1020',
    method: 'NEFT',
    referenceNumber: `ADVUTR${Date.now().toString().slice(-6)}`,
    amountInr: 25000,
    notes: 'B2B Advance Deposit'
  });
  const [rcptForm, setRcptForm] = useState({
    invoiceId: '',
    accountCode: '1010' as '1010' | '1020',
    method: 'NEFT',
    referenceNumber: `RCPTUT${Date.now().toString().slice(-6)}`,
    amountInr: 0,
    notes: 'Invoice Settlement Receipt'
  });

  // Sales Return & Credit Note form
  const [retForm, setRetForm] = useState({
    invoiceId: '',
    restockCondition: 'SELLABLE_RESTOCK' as 'SELLABLE_RESTOCK' | 'DAMAGED_SCRAP',
    reason: 'Outer coffret seal damaged in transit / customer return',
    returnTaxableAmountInr: 2541,
    returnedQty: 1,
    sku: 'FRG-GOLD-50'
  });

  // Sales Debit Note form
  const [sdnForm, setSdnForm] = useState({
    invoiceId: '',
    reason: 'Post-invoice freight surcharge & custom engraving recovery',
    taxableAmountInr: 1500,
    gstRatePct: 18
  });

  // Delivery Challan form
  const [dcForm, setDcForm] = useState({
    challanType: 'SUPPLY_OF_GOODS' as 'SUPPLY_OF_GOODS' | 'EVENT_ACTIVATION' | 'SAMPLE_DISPATCH' | 'APPROVAL_BASIS' | 'STOCK_TRANSFER' | 'JOB_WORK',
    customerName: '',
    customerEmail: '',
    customerGstin: '',
    deliveryAddress: '',
    placeOfSupplyState: 'Maharashtra',
    transporterName: 'BlueDart Luxury Express',
    vehicleNumber: 'MH-01-FR-4020',
    eWayBillNumber: '',
    sku: 'FRG-GOLD-50',
    description: 'Golden Hour 50ml Extrait de Parfum — Consignment',
    hsnCode: '33030050',
    qty: 10,
    unitValueInr: 2541
  });

  // GST Config & HSN Master forms
  const [cfgForm, setCfgForm] = useState({
    legalName: '',
    gstin: '',
    pan: '',
    cin: '',
    stateName: 'Maharashtra',
    registeredAddress: '',
    eInvoiceEnabled: false,
    eInvoiceThresholdInr: 50000000,
    eWayBillThresholdInr: 50000,
    invPrefix: 'INV-2026-',
    pfmPrefix: 'PFM-2026-',
    cnPrefix: 'CN-2026-',
    sdnPrefix: 'SDN-2026-',
    dcPrefix: 'DC-2026-',
    approveGstConfig: true
  });
  const [hsnForm, setHsnForm] = useState({
    hsnSacCode: '',
    codeType: 'HSN' as 'HSN' | 'SAC',
    description: '',
    gstRatePct: 18,
    notes: ''
  });

  const loadSnapshot = useCallback(async () => {
    try {
      const data = await erpApi.getGstAccountingSnapshot();
      setSnap(data);
      const org = data.organization || {};
      const prefs = (org.numberingPrefixes as Record<string, string>) || {};
      setCfgForm({
        legalName: org.legalName || '',
        gstin: org.gstin || '',
        pan: org.pan || '',
        cin: org.cin || '',
        stateName: org.stateName || 'Maharashtra',
        registeredAddress: org.registeredAddress || '',
        eInvoiceEnabled: Boolean(org.eInvoiceEnabled),
        eInvoiceThresholdInr: Number(org.eInvoiceThresholdInr || 50000000),
        eWayBillThresholdInr: Number(org.eWayBillThresholdInr || 50000),
        invPrefix: prefs.INV || 'INV-2026-',
        pfmPrefix: prefs.PFM || 'PFM-2026-',
        cnPrefix: prefs.CN || 'CN-2026-',
        sdnPrefix: prefs.SDN || 'SDN-2026-',
        dcPrefix: prefs.DC || 'DC-2026-',
        approveGstConfig: true
      });
      if (!selectedOrderId && data.storeOrders.length > 0) {
        setSelectedOrderId(data.storeOrders[0].id);
      }
      const openInvs = data.invoices.filter((i) => i.invoiceType !== 'PROFORMA' && i.balanceDueInr > 0);
      if (!rcptForm.invoiceId && openInvs.length > 0) {
        setRcptForm((prev) => ({ ...prev, invoiceId: openInvs[0].id, amountInr: Number(openInvs[0].balanceDueInr) }));
      }
      const taxInvs = data.invoices.filter((i) => i.invoiceType !== 'PROFORMA');
      if (!retForm.invoiceId && taxInvs.length > 0) {
        setRetForm((prev) => ({ ...prev, invoiceId: taxInvs[0].id }));
      }
      if (!sdnForm.invoiceId && taxInvs.length > 0) {
        setSdnForm((prev) => ({ ...prev, invoiceId: taxInvs[0].id }));
      }
    } catch (e: any) {
      notify(e?.message || 'Failed to load GST Billing workspace', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

  const runAction = async (fn: () => Promise<void>, okMsg: string) => {
    setBusy(true);
    try {
      await fn();
      await loadSnapshot();
      await onRefreshParent();
      notify(okMsg, 'success');
    } catch (e: any) {
      notify(e?.message || 'GST billing operation failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading || !snap) {
    return (
      <div className="max-w-7xl mx-auto p-8 border border-[#DED7CC] bg-white rounded-lg text-xs font-mono text-[#686158]">
        Loading GST Billing &amp; Statutory Compliance Ledger...
      </div>
    );
  }

  const org = snap.organization || {};
  const verifiedHsn = snap.hsnSacMaster.filter((h) => h.approvalStatus !== 'PENDING_ADMIN_APPROVAL');
  const openTaxInvoices = snap.invoices.filter((i) => i.invoiceType !== 'PROFORMA' && Number(i.balanceDueInr) > 0.01);
  const allTaxInvoices = snap.invoices.filter((i) => i.invoiceType !== 'PROFORMA');
  const availableAdvances = snap.payments.filter((p) => p.isAdvance && Number(p.advanceRemainingInr) > 0);
  const totalOpenAr = allTaxInvoices.reduce((s, i) => s + Number(i.balanceDueInr || 0), 0);
  const proformasCount = snap.invoices.filter((i) => i.invoiceType === 'PROFORMA' && !i.proformaConvertedToInvoiceId).length;
  const isInterPreview =
    (billForm.placeOfSupplyState || '').trim().toLowerCase() !== (org.stateName || 'Maharashtra').trim().toLowerCase();

  const openCustomerStatement = (ledgerRow: any) => {
    const email = (ledgerRow.customerEmail || '').toLowerCase();
    const custInvs = allTaxInvoices.filter((i) => (i.customerEmail || '').toLowerCase() === email);
    const custPays = snap.payments.filter(
      (p) => p.direction === 'INBOUND_RECEIPT' && ((p.customerEmail || '').toLowerCase() === email || p.partyName === ledgerRow.customerName)
    );
    const custCns = snap.creditNotes.filter((c) => (c.customerEmail || '').toLowerCase() === email);
    const custDns = snap.salesDebitNotes.filter((d) => (d.customerEmail || '').toLowerCase() === email);

    const transactions = [
      ...custInvs.map((i) => ({ date: i.issueDate, ref: i.invoiceNumber, kind: `${i.billingCategory} TAX INVOICE`, debit: Number(i.grandTotalInr), credit: 0 })),
      ...custDns.map((d) => ({ date: d.issueDate, ref: d.debitNoteNumber, kind: 'SALES DEBIT NOTE', debit: Number(d.totalDebitInr), credit: 0 })),
      ...custPays.map((p) => ({ date: p.paymentDate, ref: p.receiptNumber || p.paymentNumber, kind: p.isAdvance ? 'ADVANCE RECEIPT' : 'PAYMENT RECEIPT', debit: 0, credit: Number(p.amountInr) })),
      ...custCns.map((c) => ({ date: c.issueDate, ref: c.creditNoteNumber, kind: 'GST CREDIT NOTE', debit: 0, credit: Number(c.totalCreditInr) }))
    ].sort((a, b) => a.date.localeCompare(b.date));

    setPrintDoc({
      type: 'CUSTOMER_STATEMENT',
      title: `Customer Ledger Statement — ${ledgerRow.customerName}`,
      record: ledgerRow,
      extra: { transactions }
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <GstDocumentPrintModal doc={printDoc} organization={org} onClose={() => setPrintDoc(null)} />

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-[#DED7CC] pb-4">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-widest text-[#9A783E]">
            Module 11 · Sales Billing &amp; Indian GST Compliance
          </p>
          <h2 className="font-serif text-2xl sm:text-3xl text-[#24211D] uppercase tracking-wider mt-1">
            GST Invoicing, Challans, Returns &amp; Tax Governance
          </h2>
          <p className="text-xs text-[#686158] mt-1 font-mono">
            Entity GSTIN: <strong className="text-[#24211D]">{org.gstin}</strong> · Home State: {org.stateName} ({org.stateCode}) · Pricing: Incl &amp; Excl GST
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ErpTableExportBar reportKey="gst_invoices" notify={notify} />
          <select
            value={selectedOrderId}
            onChange={(e) => setSelectedOrderId(e.target.value)}
            className="px-2.5 py-1.5 border border-[#DED7CC] bg-white rounded text-xs font-mono max-w-[220px]"
          >
            {snap.storeOrders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.orderNumber} · {o.customerName}
              </option>
            ))}
          </select>
          <button
            disabled={busy || !selectedOrderId}
            onClick={() =>
              runAction(
                () =>
                  erpApi.createSalesBillingDoc({
                    orderId: selectedOrderId,
                    billingCategory: 'B2C',
                    pricingMode: 'INCLUSIVE',
                    idempotencyKey: `ord-inv-${selectedOrderId}-${Date.now()}`
                  }),
                'Generated GST Tax Invoice (Inclusive) from Storefront Order & posted AR/Revenue/GST journals.'
              )
            }
            className="px-3.5 py-1.5 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono rounded whitespace-nowrap shrink-0 cursor-pointer"
          >
            Invoice Store Order
          </button>
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 border border-[#DED7CC] bg-white divide-y sm:divide-y-0 sm:divide-x divide-[#DED7CC] rounded-lg">
        <div className="p-4">
          <span className="text-[11px] font-mono uppercase text-[#686158] block">Taxable Sales (GSTR-1)</span>
          <span className="text-xl font-mono font-bold text-[#24211D] tabular-nums">
            {fmt(snap.gstRegisters.outputTaxSummary.taxableSalesInr)}
          </span>
          <span className="text-[10px] font-mono text-[#686158] block mt-0.5">
            {snap.gstRegisters.outputTaxSummary.b2bCount} B2B · {snap.gstRegisters.outputTaxSummary.b2cCount} B2C
          </span>
        </div>
        <div className="p-4">
          <span className="text-[11px] font-mono uppercase text-[#686158] block">Net Output GST</span>
          <span className="text-xl font-mono font-bold text-[#9A783E] tabular-nums">
            {fmt(snap.gstRegisters.totalOutputGstInr)}
          </span>
          <span className="text-[10px] font-mono text-[#686158] block mt-0.5">
            ITC Input: {fmt(snap.gstRegisters.totalInputGstInr)}
          </span>
        </div>
        <div className="p-4">
          <span className="text-[11px] font-mono uppercase text-[#686158] block">Open AR Receivables</span>
          <span className="text-xl font-mono font-bold text-[#24211D] tabular-nums">{fmt(totalOpenAr)}</span>
          <span className="text-[10px] font-mono text-[#686158] block mt-0.5">{openTaxInvoices.length} unpaid/partial invoices</span>
        </div>
        <div className="p-4">
          <span className="text-[11px] font-mono uppercase text-[#686158] block">Proformas &amp; Challans</span>
          <span className="text-xl font-mono font-bold text-[#24211D] tabular-nums">
            {proformasCount} PFM · {snap.deliveryChallans.length} DC
          </span>
          <span className="text-[10px] font-mono text-[#686158] block mt-0.5">
            {snap.salesReturns.length} Returns · {snap.salesDebitNotes.length} Sales DN
          </span>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-[#DED7CC] pb-3">
        {(
          [
            { id: 'INVOICES', label: `Invoices & Proformas (${snap.invoices.length})` },
            { id: 'ADVANCES_RECEIPTS', label: `Advances & Receipts (${snap.payments.filter((p) => p.direction === 'INBOUND_RECEIPT').length})` },
            { id: 'RETURNS_CN', label: `Sales Returns & Credit Notes (${snap.creditNotes.length})` },
            { id: 'DEBIT_NOTES', label: `Sales Debit Notes (${snap.salesDebitNotes.length})` },
            { id: 'CHALLANS', label: `Delivery Challans (${snap.deliveryChallans.length})` },
            { id: 'STATEMENTS', label: `Customer Statements (${snap.customerLedgers.length})` },
            { id: 'GST_CONFIG', label: 'GST Config, HSN & GSTR Exports' }
          ] as Array<{ id: BillingTab; label: string }>
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded text-xs font-mono whitespace-nowrap cursor-pointer ${
              tab === t.id ? 'bg-[#24211D] text-[#FAF8F4]' : 'bg-white border border-[#DED7CC] text-[#24211D] hover:border-[#9A783E]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: INVOICES & PROFORMAS */}
      {tab === 'INVOICES' && (
        <div className="space-y-6">
          {statModalInv && (
            <div className="border border-[#9A783E] bg-white rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[#DED7CC] pb-2">
                <span className="text-xs font-mono font-bold text-[#24211D]">
                  Update Statutory E-Invoice (NIC IRN) / E-Way Bill — {statModalInv.invoiceNumber}
                </span>
                <button onClick={() => setStatModalInv(null)} className="text-xs font-mono text-[#686158] cursor-pointer">
                  Close
                </button>
              </div>
              <p className="text-[11px] font-mono text-[#686158]">
                Governance rule: Record only official NIC-generated IRN hashes and E-Way Bill numbers. Never fabricate compliance IDs.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <select
                  value={statForm.eInvoiceStatus}
                  onChange={(e) => setStatForm({ ...statForm, eInvoiceStatus: e.target.value as any })}
                  className="px-2.5 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                >
                  <option value="NOT_APPLICABLE">E-Inv: Not Applicable</option>
                  <option value="PENDING_NIC_GENERATION">E-Inv: Pending NIC Generation</option>
                  <option value="IRN_VERIFIED">E-Inv: NIC IRN Verified</option>
                </select>
                <input
                  placeholder="64-char NIC IRN Hash"
                  value={statForm.eInvoiceIrn}
                  onChange={(e) => setStatForm({ ...statForm, eInvoiceIrn: e.target.value })}
                  className="px-2.5 py-2 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
                />
                <input
                  placeholder="Ack Number"
                  value={statForm.irnAckNumber}
                  onChange={(e) => setStatForm({ ...statForm, irnAckNumber: e.target.value })}
                  className="px-2.5 py-2 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
                />
                <select
                  value={statForm.eWayBillStatus}
                  onChange={(e) => setStatForm({ ...statForm, eWayBillStatus: e.target.value as any })}
                  className="px-2.5 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                >
                  <option value="NOT_REQUIRED">EWB: Not Required</option>
                  <option value="PENDING_EWB_GENERATION">EWB: Pending Generation</option>
                  <option value="EWB_VERIFIED">EWB: Verified</option>
                </select>
                <input
                  placeholder="12-digit E-Way Bill #"
                  value={statForm.eWayBillNumber}
                  onChange={(e) => setStatForm({ ...statForm, eWayBillNumber: e.target.value })}
                  className="px-2.5 py-2 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
                />
                <button
                  disabled={busy}
                  onClick={() =>
                    runAction(async () => {
                      await erpApi.updateInvoiceStatutory(statModalInv.id, statForm);
                      setStatModalInv(null);
                    }, `Updated statutory IRN / EWB status for ${statModalInv.invoiceNumber}.`)
                  }
                  className="px-4 py-2 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono rounded cursor-pointer"
                >
                  Save Statutory Record
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Register Table */}
            <div className="xl:col-span-2 border border-[#DED7CC] bg-white rounded-lg overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                  <tr>
                    <th className="py-2.5 px-3">Doc # &amp; Date</th>
                    <th className="py-2.5 px-3">Customer / Supply</th>
                    <th className="py-2.5 px-3">Taxable / GST</th>
                    <th className="py-2.5 px-3">Total / Due</th>
                    <th className="py-2.5 px-3">Status / Compliance</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DED7CC]">
                  {snap.invoices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center font-mono text-[#686158]">
                        No invoices or proformas yet. Issue your first billing document on the right.
                      </td>
                    </tr>
                  ) : (
                    snap.invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-[#FAF8F4]">
                        <td className="py-2.5 px-3 font-mono">
                          <span className="font-bold text-[#24211D] block">{inv.invoiceNumber}</span>
                          <span className="text-[10px] text-[#686158]">
                            {inv.issueDate} · {inv.invoiceType}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-medium text-[#24211D] block">{inv.customerName}</span>
                          <span className="text-[10px] font-mono text-[#686158]">
                            {inv.billingCategory || 'B2C'} · {inv.placeOfSupplyState} ({inv.isInterState ? 'IGST' : 'CGST+SGST'})
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums">
                          <span>{fmt(inv.taxableAmountInr)}</span>
                          <span className="block text-[10px] text-[#686158]">
                            Tax {fmt(inv.totalTaxInr)} ({inv.pricingMode || 'EXCL'})
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums">
                          <span className="font-bold text-[#9A783E] block">{fmt(inv.grandTotalInr)}</span>
                          <span className="text-[10px] text-[#686158]">Due {fmt(inv.balanceDueInr)}</span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[10px]">
                          <span className="font-semibold text-[#24211D] block">{inv.paymentStatus}</span>
                          {inv.eInvoiceStatus && inv.eInvoiceStatus !== 'NOT_APPLICABLE' && (
                            <span className="text-[#686158] block">eInv: {inv.eInvoiceStatus}</span>
                          )}
                          {inv.eWayBillStatus && inv.eWayBillStatus !== 'NOT_REQUIRED' && (
                            <span className="text-[#686158] block">EWB: {inv.eWayBillStatus}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right space-x-2 whitespace-nowrap font-mono">
                          <button
                            onClick={() => setPrintDoc({ type: 'INVOICE', title: `${inv.invoiceType} ${inv.invoiceNumber}`, record: inv })}
                            className="text-[#24211D] hover:text-[#9A783E] cursor-pointer"
                          >
                            PDF
                          </button>
                          {inv.invoiceType === 'PROFORMA' && !inv.proformaConvertedToInvoiceId && (
                            <button
                              disabled={busy}
                              onClick={() =>
                                runAction(
                                  () => erpApi.convertProformaToInvoice(inv.id),
                                  `Converted Proforma ${inv.invoiceNumber} to binding Tax Invoice & posted GL.`
                                )
                              }
                              className="text-[#9A783E] hover:underline cursor-pointer"
                            >
                              Convert
                            </button>
                          )}
                          {inv.invoiceType !== 'PROFORMA' && (
                            <button
                              onClick={() => {
                                setStatModalInv(inv);
                                setStatForm({
                                  eInvoiceStatus: (inv.eInvoiceStatus || 'PENDING_NIC_GENERATION') as any,
                                  eInvoiceIrn: inv.eInvoiceIrn || '',
                                  irnAckNumber: inv.irnAckNumber || '',
                                  eWayBillStatus: (inv.eWayBillStatus || 'PENDING_EWB_GENERATION') as any,
                                  eWayBillNumber: inv.eWayBillNumber || ''
                                });
                              }}
                              className="text-[#686158] hover:text-[#24211D] cursor-pointer"
                            >
                              IRN/EWB
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Composer Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                runAction(async () => {
                  await erpApi.createSalesBillingDoc({
                    ...billForm,
                    customerGstin: billForm.customerGstin || undefined,
                    advancePaymentId: billForm.advancePaymentId || undefined,
                    items: billItems.map((it) => {
                      const rule = verifiedHsn.find((h) => h.hsnSacCode === it.hsnCode);
                      return { ...it, gstRatePct: rule?.gstRatePct ?? 18 };
                    }),
                    idempotencyKey: `man-bill-${Date.now()}`
                  });
                  setBillForm({ ...billForm, customerName: '', customerEmail: '', customerGstin: '', billingAddress: '', advancePaymentId: '', notes: '' });
                }, `Created ${billForm.invoiceType === 'PROFORMA' ? 'Proforma Invoice' : 'GST Tax Invoice'} & synced ledgers.`);
              }}
              className="border border-[#DED7CC] bg-white rounded-lg p-4 space-y-3 h-fit"
            >
              <div className="flex items-center justify-between border-b border-[#DED7CC] pb-2">
                <h3 className="text-xs font-mono uppercase font-semibold text-[#24211D]">
                  Create GST Invoice / Proforma
                </h3>
                <span className="text-[10px] font-mono text-[#9A783E]">
                  {isInterPreview ? 'IGST Inter-State' : 'CGST+SGST Intra'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={billForm.invoiceType}
                  onChange={(e) => setBillForm({ ...billForm, invoiceType: e.target.value as any })}
                  className="px-2 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                >
                  <option value="TAX_INVOICE">Tax Invoice</option>
                  <option value="B2B_GST_INVOICE">B2B GST Invoice</option>
                  <option value="PROFORMA">Proforma Invoice</option>
                </select>
                <select
                  value={billForm.billingCategory}
                  onChange={(e) => setBillForm({ ...billForm, billingCategory: e.target.value as any })}
                  className="px-2 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                >
                  <option value="B2B">B2B Wholesale</option>
                  <option value="B2C">B2C Direct</option>
                  <option value="CORPORATE_GIFTING">Corporate Gifting</option>
                  <option value="EVENT_SERVICES">Event Services (Bar)</option>
                  <option value="SAMPLE_SALES">Paid Sample Sales</option>
                  <option value="WHOLESALE">Distributor Stockist</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={billForm.pricingMode}
                  onChange={(e) => setBillForm({ ...billForm, pricingMode: e.target.value as any })}
                  className="px-2 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                >
                  <option value="EXCLUSIVE">GST Exclusive (+Tax)</option>
                  <option value="INCLUSIVE">GST Inclusive (MRP)</option>
                </select>
                <select
                  value={billForm.placeOfSupplyState}
                  onChange={(e) => setBillForm({ ...billForm, placeOfSupplyState: e.target.value })}
                  className="px-2 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                >
                  {snap.indianStates.map((s) => (
                    <option key={s.code} value={s.name}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <select
                value=""
                onChange={(e) => {
                  const cust = snap.storeCustomers.find((c) => c.id === e.target.value);
                  if (cust) {
                    setBillForm({
                      ...billForm,
                      customerName: cust.name,
                      customerEmail: cust.email,
                      billingAddress: cust.address?.city ? `${cust.address.addressLine1 || ''}, ${cust.address.city}` : ''
                    });
                  }
                }}
                className="w-full px-2.5 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4] text-[#686158]"
              >
                <option value="">Quick-fill Existing Customer (optional)</option>
                {snap.storeCustomers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.email})
                  </option>
                ))}
              </select>

              <input
                required
                placeholder="Customer / Legal Party Name *"
                value={billForm.customerName}
                onChange={(e) => setBillForm({ ...billForm, customerName: e.target.value })}
                className="w-full px-3 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  placeholder="Email"
                  value={billForm.customerEmail}
                  onChange={(e) => setBillForm({ ...billForm, customerEmail: e.target.value })}
                  className="px-2.5 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                />
                <input
                  placeholder="Buyer GSTIN (B2B)"
                  value={billForm.customerGstin}
                  onChange={(e) => setBillForm({ ...billForm, customerGstin: e.target.value.toUpperCase() })}
                  className="px-2.5 py-1.5 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
                />
              </div>
              <input
                placeholder="Billing Address"
                value={billForm.billingAddress}
                onChange={(e) => setBillForm({ ...billForm, billingAddress: e.target.value })}
                className="w-full px-3 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              />

              {/* Line Items */}
              <div className="space-y-2 border-t border-[#DED7CC] pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase text-[#686158]">Line Items (Verified HSN/SAC)</span>
                  <button
                    type="button"
                    onClick={() =>
                      setBillItems([...billItems, { sku: 'FRG-SKU', description: '', hsnCode: '33030050', qty: 1, unitPriceInr: 1500 }])
                    }
                    className="text-[11px] font-mono text-[#9A783E] flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Add Line
                  </button>
                </div>
                {billItems.map((it, idx) => (
                  <div key={idx} className="p-2 bg-[#FAF8F4] border border-[#DED7CC] rounded space-y-1.5">
                    <div className="flex gap-1.5">
                      <input
                        required
                        placeholder="Item / Service Description"
                        value={it.description}
                        onChange={(e) => {
                          const next = [...billItems];
                          next[idx].description = e.target.value;
                          setBillItems(next);
                        }}
                        className="flex-1 px-2 py-1 border border-[#DED7CC] rounded text-xs bg-white"
                      />
                      {billItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setBillItems(billItems.filter((_, i) => i !== idx))}
                          className="p-1 text-rose-700 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <select
                        value={it.hsnCode}
                        onChange={(e) => {
                          const next = [...billItems];
                          next[idx].hsnCode = e.target.value;
                          setBillItems(next);
                        }}
                        className="px-1.5 py-1 border border-[#DED7CC] rounded font-mono text-[11px] bg-white"
                      >
                        {verifiedHsn.map((h) => (
                          <option key={h.id} value={h.hsnSacCode}>
                            {h.hsnSacCode} ({h.gstRatePct}%)
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        placeholder="Qty"
                        value={it.qty}
                        onChange={(e) => {
                          const next = [...billItems];
                          next[idx].qty = Number(e.target.value);
                          setBillItems(next);
                        }}
                        className="px-2 py-1 border border-[#DED7CC] rounded font-mono text-xs bg-white"
                      />
                      <input
                        type="number"
                        min={1}
                        placeholder="Rate ₹"
                        value={it.unitPriceInr}
                        onChange={(e) => {
                          const next = [...billItems];
                          next[idx].unitPriceInr = Number(e.target.value);
                          setBillItems(next);
                        }}
                        className="px-2 py-1 border border-[#DED7CC] rounded font-mono text-xs bg-white"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min={0}
                  placeholder="Discount ₹"
                  value={billForm.discountInr}
                  onChange={(e) => setBillForm({ ...billForm, discountInr: Number(e.target.value) })}
                  className="px-2.5 py-1.5 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
                />
                <input
                  type="number"
                  min={0}
                  placeholder="Shipping / Freight ₹"
                  value={billForm.shippingInr}
                  onChange={(e) => setBillForm({ ...billForm, shippingInr: Number(e.target.value) })}
                  className="px-2.5 py-1.5 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
                />
              </div>

              {availableAdvances.length > 0 && billForm.invoiceType !== 'PROFORMA' && (
                <select
                  value={billForm.advancePaymentId}
                  onChange={(e) => setBillForm({ ...billForm, advancePaymentId: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                >
                  <option value="">Adjust Customer Advance? (Optional)</option>
                  {availableAdvances.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.receiptNumber || a.paymentNumber} · {a.partyName} · Bal {fmt(a.advanceRemainingInr)}
                    </option>
                  ))}
                </select>
              )}

              <button
                disabled={busy}
                type="submit"
                className="w-full py-2.5 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono uppercase rounded cursor-pointer"
              >
                {billForm.invoiceType === 'PROFORMA' ? 'Generate Proforma Invoice' : 'Issue GST Invoice & Post GL'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: ADVANCES & PAYMENT RECEIPTS */}
      {tab === 'ADVANCES_RECEIPTS' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 border border-[#DED7CC] bg-white rounded-lg overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                <tr>
                  <th className="py-2.5 px-3">Receipt / Voucher</th>
                  <th className="py-2.5 px-3">Customer &amp; Type</th>
                  <th className="py-2.5 px-3">Account &amp; UTR</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                  <th className="py-2.5 px-3 text-right">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DED7CC]">
                {snap.payments
                  .filter((p) => p.direction === 'INBOUND_RECEIPT')
                  .map((p) => (
                    <tr key={p.id} className="hover:bg-[#FAF8F4]">
                      <td className="py-2.5 px-3 font-mono">
                        <strong className="text-[#24211D] block">{p.receiptNumber || p.paymentNumber}</strong>
                        <span className="text-[10px] text-[#686158]">{p.paymentDate}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-medium block">{p.partyName}</span>
                        <span className="text-[10px] font-mono text-[#9A783E]">
                          {p.isAdvance ? `ADVANCE · Unadjusted ${fmt(p.advanceRemainingInr)}` : 'INVOICE RECEIPT'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-[#686158]">
                        GL {p.accountCode} · {p.method} · {p.referenceNumber}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 tabular-nums">
                        {fmt(p.amountInr)}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => setPrintDoc({ type: 'RECEIPT', title: `Receipt ${p.receiptNumber || p.paymentNumber}`, record: p })}
                          className="text-xs font-mono text-[#24211D] hover:text-[#9A783E] cursor-pointer"
                        >
                          PDF
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                runAction(async () => {
                  await erpApi.recordCustomerAdvance(advForm);
                  setAdvForm({ ...advForm, customerName: '', customerEmail: '', referenceNumber: `ADVUTR${Date.now().toString().slice(-6)}` });
                }, 'Advance Receipt issued & credited to Customer Advances Liability (2250).');
              }}
              className="border border-[#DED7CC] bg-white rounded-lg p-4 space-y-2.5"
            >
              <h3 className="text-xs font-mono uppercase font-semibold border-b border-[#DED7CC] pb-2">
                Issue Customer Advance Receipt
              </h3>
              <input
                required
                placeholder="Customer / Corporate Name"
                value={advForm.customerName}
                onChange={(e) => setAdvForm({ ...advForm, customerName: e.target.value })}
                className="w-full px-3 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              />
              <input
                placeholder="Customer Email"
                value={advForm.customerEmail}
                onChange={(e) => setAdvForm({ ...advForm, customerEmail: e.target.value })}
                className="w-full px-3 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={advForm.accountCode}
                  onChange={(e) => setAdvForm({ ...advForm, accountCode: e.target.value as any })}
                  className="px-2 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                >
                  <option value="1010">Bank (1010)</option>
                  <option value="1020">Cash (1020)</option>
                </select>
                <input
                  required
                  placeholder="UTR / Ref #"
                  value={advForm.referenceNumber}
                  onChange={(e) => setAdvForm({ ...advForm, referenceNumber: e.target.value })}
                  className="px-2 py-1.5 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
                />
              </div>
              <input
                type="number"
                min={1}
                placeholder="Advance Amount ₹"
                value={advForm.amountInr}
                onChange={(e) => setAdvForm({ ...advForm, amountInr: Number(e.target.value) })}
                className="w-full px-3 py-1.5 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
              />
              <button
                disabled={busy}
                type="submit"
                className="w-full py-2 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono uppercase rounded cursor-pointer"
              >
                Record Advance Receipt
              </button>
            </form>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                runAction(async () => {
                  await erpApi.recordAccountPayment({
                    direction: 'INBOUND_RECEIPT',
                    ...rcptForm,
                    idempotencyKey: `rcpt-${Date.now()}`
                  });
                }, 'Payment Receipt recorded & AR (1100) reduced.');
              }}
              className="border border-[#DED7CC] bg-white rounded-lg p-4 space-y-2.5"
            >
              <h3 className="text-xs font-mono uppercase font-semibold border-b border-[#DED7CC] pb-2">
                Settle Open Invoice (Payment Receipt)
              </h3>
              <select
                required
                value={rcptForm.invoiceId}
                onChange={(e) => {
                  const inv = openTaxInvoices.find((i) => i.id === e.target.value);
                  setRcptForm({ ...rcptForm, invoiceId: e.target.value, amountInr: inv ? Number(inv.balanceDueInr) : 0 });
                }}
                className="w-full px-2.5 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              >
                <option value="">Select Unpaid / Partial Tax Invoice</option>
                {openTaxInvoices.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.invoiceNumber} · {i.customerName} · Due {fmt(i.balanceDueInr)}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={rcptForm.accountCode}
                  onChange={(e) => setRcptForm({ ...rcptForm, accountCode: e.target.value as any })}
                  className="px-2 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                >
                  <option value="1010">Bank (1010)</option>
                  <option value="1020">Cash (1020)</option>
                </select>
                <input
                  required
                  placeholder="UTR / Ref #"
                  value={rcptForm.referenceNumber}
                  onChange={(e) => setRcptForm({ ...rcptForm, referenceNumber: e.target.value })}
                  className="px-2 py-1.5 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
                />
              </div>
              <input
                type="number"
                min={1}
                step="0.01"
                value={rcptForm.amountInr}
                onChange={(e) => setRcptForm({ ...rcptForm, amountInr: Number(e.target.value) })}
                className="w-full px-3 py-1.5 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
              />
              <button
                disabled={busy || !rcptForm.invoiceId}
                type="submit"
                className="w-full py-2 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono uppercase rounded cursor-pointer"
              >
                Issue Payment Receipt
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 3: SALES RETURNS & CREDIT NOTES */}
      {tab === 'RETURNS_CN' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-4">
            <div className="border border-[#DED7CC] bg-white rounded-lg overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                  <tr>
                    <th className="py-2.5 px-3">Credit Note / Return</th>
                    <th className="py-2.5 px-3">Customer &amp; Reason</th>
                    <th className="py-2.5 px-3 text-right">Taxable</th>
                    <th className="py-2.5 px-3 text-right">GST Reversed</th>
                    <th className="py-2.5 px-3 text-right">Total Credit</th>
                    <th className="py-2.5 px-3 text-right">PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DED7CC]">
                  {snap.creditNotes.map((cn) => (
                    <tr key={cn.id} className="hover:bg-[#FAF8F4]">
                      <td className="py-2.5 px-3 font-mono">
                        <strong className="text-[#24211D] block">{cn.creditNoteNumber}</strong>
                        <span className="text-[10px] text-[#686158]">{cn.issueDate}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-medium block">{cn.customerName}</span>
                        <span className="text-[11px] text-[#686158]">{cn.reason}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">{fmt(cn.taxableAmountInr)}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        {fmt(Number(cn.cgstInr || 0) + Number(cn.sgstInr || 0) + Number(cn.igstInr || 0))}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700 tabular-nums">
                        -{fmt(cn.totalCreditInr)}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => setPrintDoc({ type: 'CREDIT_NOTE', title: `Credit Note ${cn.creditNoteNumber}`, record: cn })}
                          className="text-xs font-mono text-[#24211D] hover:text-[#9A783E] cursor-pointer"
                        >
                          PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                  {snap.creditNotes.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center font-mono text-[#686158]">
                        No sales returns or credit notes recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {snap.salesReturns.length > 0 && (
              <div className="border border-[#DED7CC] bg-white rounded-lg p-4 space-y-2">
                <h3 className="text-xs font-mono uppercase font-semibold text-[#24211D]">
                  Sales Return &amp; Inventory Disposition Log ({snap.salesReturns.length})
                </h3>
                {snap.salesReturns.map((sr) => (
                  <div key={sr.id} className="flex flex-wrap justify-between text-xs font-mono border-t border-[#DED7CC] pt-2 gap-2">
                    <span>
                      <strong>{sr.returnNumber}</strong> · {sr.customerName} ({sr.restockCondition})
                    </span>
                    <span className="text-[#686158]">
                      COGS Reversed: {fmt(sr.cogsReversedInr)} · Credit: {fmt(sr.totalReturnInr)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              runAction(
                () => erpApi.processSalesReturn(retForm),
                'Processed Sales Return, reversed GST & inventory/COGS, and issued Credit Note.'
              );
            }}
            className="border border-[#DED7CC] bg-white rounded-lg p-4 space-y-3 h-fit"
          >
            <h3 className="text-xs font-mono uppercase font-semibold border-b border-[#DED7CC] pb-2">
              Process Sales Return + Auto Credit Note
            </h3>
            <select
              required
              value={retForm.invoiceId}
              onChange={(e) => setRetForm({ ...retForm, invoiceId: e.target.value })}
              className="w-full px-2.5 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
            >
              <option value="">Select Tax Invoice</option>
              {allTaxInvoices.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.invoiceNumber} · {i.customerName} ({fmt(i.grandTotalInr)})
                </option>
              ))}
            </select>
            <select
              value={retForm.restockCondition}
              onChange={(e) => setRetForm({ ...retForm, restockCondition: e.target.value as any })}
              className="w-full px-2.5 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
            >
              <option value="SELLABLE_RESTOCK">Sellable — Restock Finished Goods (Dr 1220 / Cr 5000)</option>
              <option value="DAMAGED_SCRAP">Damaged — Scrap Write-Off (Dr 5210 / Cr 5000)</option>
            </select>
            <input
              required
              placeholder="Return Reason"
              value={retForm.reason}
              onChange={(e) => setRetForm({ ...retForm, reason: e.target.value })}
              className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min={1}
                placeholder="Returned Qty"
                value={retForm.returnedQty}
                onChange={(e) => setRetForm({ ...retForm, returnedQty: Number(e.target.value) })}
                className="px-2.5 py-2 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
              />
              <input
                type="number"
                min={1}
                placeholder="Taxable Credit ₹"
                value={retForm.returnTaxableAmountInr}
                onChange={(e) => setRetForm({ ...retForm, returnTaxableAmountInr: Number(e.target.value) })}
                className="px-2.5 py-2 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
              />
            </div>
            <button
              disabled={busy || !retForm.invoiceId}
              type="submit"
              className="w-full py-2.5 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono uppercase rounded cursor-pointer"
            >
              Process Return &amp; Issue Credit Note
            </button>
          </form>
        </div>
      )}

      {/* TAB 4: SALES DEBIT NOTES */}
      {tab === 'DEBIT_NOTES' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 border border-[#DED7CC] bg-white rounded-lg overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                <tr>
                  <th className="py-2.5 px-3">Debit Note #</th>
                  <th className="py-2.5 px-3">Customer &amp; Reason</th>
                  <th className="py-2.5 px-3 text-right">Taxable</th>
                  <th className="py-2.5 px-3 text-right">GST</th>
                  <th className="py-2.5 px-3 text-right">Total Debit</th>
                  <th className="py-2.5 px-3 text-right">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DED7CC]">
                {snap.salesDebitNotes.map((dn) => (
                  <tr key={dn.id} className="hover:bg-[#FAF8F4]">
                    <td className="py-2.5 px-3 font-mono">
                      <strong className="block">{dn.debitNoteNumber}</strong>
                      <span className="text-[10px] text-[#686158]">{dn.issueDate}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-medium block">{dn.customerName}</span>
                      <span className="text-[11px] text-[#686158]">{dn.reason}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">{fmt(dn.taxableAmountInr)}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {fmt(Number(dn.cgstInr || 0) + Number(dn.sgstInr || 0) + Number(dn.igstInr || 0))}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-[#9A783E] tabular-nums">
                      +{fmt(dn.totalDebitInr)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => setPrintDoc({ type: 'SALES_DEBIT_NOTE', title: `Sales Debit Note ${dn.debitNoteNumber}`, record: dn })}
                        className="text-xs font-mono text-[#24211D] hover:text-[#9A783E] cursor-pointer"
                      >
                        PDF
                      </button>
                    </td>
                  </tr>
                ))}
                {snap.salesDebitNotes.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center font-mono text-[#686158]">
                      No customer sales debit notes issued yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              runAction(
                () => erpApi.issueSalesDebitNote(sdnForm),
                'Sales Debit Note issued & AR / Output GST ledger updated.'
              );
            }}
            className="border border-[#DED7CC] bg-white rounded-lg p-4 space-y-3 h-fit"
          >
            <h3 className="text-xs font-mono uppercase font-semibold border-b border-[#DED7CC] pb-2">
              Issue Customer Sales Debit Note
            </h3>
            <select
              required
              value={sdnForm.invoiceId}
              onChange={(e) => setSdnForm({ ...sdnForm, invoiceId: e.target.value })}
              className="w-full px-2.5 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
            >
              <option value="">Select Tax Invoice</option>
              {allTaxInvoices.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.invoiceNumber} · {i.customerName}
                </option>
              ))}
            </select>
            <input
              required
              placeholder="Adjustment Reason (Price difference / freight recovery)"
              value={sdnForm.reason}
              onChange={(e) => setSdnForm({ ...sdnForm, reason: e.target.value })}
              className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min={1}
                placeholder="Taxable Uplift ₹"
                value={sdnForm.taxableAmountInr}
                onChange={(e) => setSdnForm({ ...sdnForm, taxableAmountInr: Number(e.target.value) })}
                className="px-2.5 py-2 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
              />
              <select
                value={sdnForm.gstRatePct}
                onChange={(e) => setSdnForm({ ...sdnForm, gstRatePct: Number(e.target.value) })}
                className="px-2.5 py-2 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
              >
                <option value={18}>18% GST</option>
                <option value={12}>12% GST</option>
                <option value={5}>5% GST</option>
                <option value={28}>28% GST</option>
              </select>
            </div>
            <button
              disabled={busy || !sdnForm.invoiceId}
              type="submit"
              className="w-full py-2.5 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono uppercase rounded cursor-pointer"
            >
              Issue Sales Debit Note
            </button>
          </form>
        </div>
      )}

      {/* TAB 5: DELIVERY CHALLANS */}
      {tab === 'CHALLANS' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 border border-[#DED7CC] bg-white rounded-lg overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                <tr>
                  <th className="py-2.5 px-3">Challan # &amp; Type</th>
                  <th className="py-2.5 px-3">Consignee &amp; Logistics</th>
                  <th className="py-2.5 px-3 text-right">Declared Value</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DED7CC]">
                {snap.deliveryChallans.map((dc) => (
                  <tr key={dc.id} className="hover:bg-[#FAF8F4]">
                    <td className="py-2.5 px-3 font-mono">
                      <strong className="block">{dc.challanNumber}</strong>
                      <span className="text-[10px] text-[#686158]">
                        {dc.dispatchDate} · {dc.challanType}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-medium block">{dc.customerName}</span>
                      <span className="text-[10px] font-mono text-[#686158]">
                        {dc.placeOfSupplyState} · {dc.transporterName || 'Courier'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-[#9A783E] tabular-nums">
                      {fmt(dc.totalTaxableValueInr)}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px]">{dc.status}</td>
                    <td className="py-2.5 px-3 text-right space-x-2 whitespace-nowrap font-mono">
                      <button
                        onClick={() => setPrintDoc({ type: 'DELIVERY_CHALLAN', title: `Delivery Challan ${dc.challanNumber}`, record: dc })}
                        className="text-[#24211D] hover:text-[#9A783E] cursor-pointer"
                      >
                        PDF
                      </button>
                      {!dc.convertedInvoiceId && (
                        <button
                          disabled={busy}
                          onClick={() =>
                            runAction(
                              () => erpApi.convertChallanToInvoice(dc.id),
                              `Converted Delivery Challan ${dc.challanNumber} into binding GST Tax Invoice.`
                            )
                          }
                          className="text-[#9A783E] hover:underline cursor-pointer"
                        >
                          Convert to Invoice
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {snap.deliveryChallans.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center font-mono text-[#686158]">
                      No delivery challans dispatched yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              runAction(async () => {
                await erpApi.createDeliveryChallan({
                  challanType: dcForm.challanType,
                  customerName: dcForm.customerName,
                  customerEmail: dcForm.customerEmail || undefined,
                  customerGstin: dcForm.customerGstin || undefined,
                  deliveryAddress: dcForm.deliveryAddress,
                  placeOfSupplyState: dcForm.placeOfSupplyState,
                  transporterName: dcForm.transporterName,
                  vehicleNumber: dcForm.vehicleNumber,
                  eWayBillNumber: dcForm.eWayBillNumber || undefined,
                  items: [{ sku: dcForm.sku, description: dcForm.description, hsnCode: dcForm.hsnCode, qty: dcForm.qty, unitValueInr: dcForm.unitValueInr }]
                });
                setDcForm({ ...dcForm, customerName: '', deliveryAddress: '' });
              }, 'Delivery Challan issued for dispatch.');
            }}
            className="border border-[#DED7CC] bg-white rounded-lg p-4 space-y-2.5 h-fit"
          >
            <h3 className="text-xs font-mono uppercase font-semibold border-b border-[#DED7CC] pb-2">
              Issue Delivery Challan
            </h3>
            <select
              value={dcForm.challanType}
              onChange={(e) => setDcForm({ ...dcForm, challanType: e.target.value as any })}
              className="w-full px-2.5 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
            >
              <option value="SUPPLY_OF_GOODS">Supply of Goods (Pre-Invoice)</option>
              <option value="EVENT_ACTIVATION">Perfume Bar Event Activation</option>
              <option value="SAMPLE_DISPATCH">Sample / Seeding Dispatch</option>
              <option value="APPROVAL_BASIS">Approval / Consignment Basis</option>
              <option value="STOCK_TRANSFER">Warehouse Stock Transfer</option>
            </select>
            <input
              required
              placeholder="Consignee Name *"
              value={dcForm.customerName}
              onChange={(e) => setDcForm({ ...dcForm, customerName: e.target.value })}
              className="w-full px-3 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
            />
            <input
              required
              placeholder="Delivery Address *"
              value={dcForm.deliveryAddress}
              onChange={(e) => setDcForm({ ...dcForm, deliveryAddress: e.target.value })}
              className="w-full px-3 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={dcForm.placeOfSupplyState}
                onChange={(e) => setDcForm({ ...dcForm, placeOfSupplyState: e.target.value })}
                className="px-2 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              >
                {snap.indianStates.map((s) => (
                  <option key={s.code} value={s.name}>{s.name}</option>
                ))}
              </select>
              <input
                placeholder="Vehicle / EWB #"
                value={dcForm.vehicleNumber}
                onChange={(e) => setDcForm({ ...dcForm, vehicleNumber: e.target.value })}
                className="px-2 py-1.5 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
              />
            </div>
            <input
              required
              placeholder="Goods Description"
              value={dcForm.description}
              onChange={(e) => setDcForm({ ...dcForm, description: e.target.value })}
              className="w-full px-3 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min={1}
                placeholder="Qty"
                value={dcForm.qty}
                onChange={(e) => setDcForm({ ...dcForm, qty: Number(e.target.value) })}
                className="px-2 py-1.5 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
              />
              <input
                type="number"
                min={1}
                placeholder="Declared Unit Value ₹"
                value={dcForm.unitValueInr}
                onChange={(e) => setDcForm({ ...dcForm, unitValueInr: Number(e.target.value) })}
                className="px-2 py-1.5 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
              />
            </div>
            <button
              disabled={busy}
              type="submit"
              className="w-full py-2.5 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono uppercase rounded cursor-pointer"
            >
              Generate Delivery Challan
            </button>
          </form>
        </div>
      )}

      {/* TAB 6: CUSTOMER STATEMENTS */}
      {tab === 'STATEMENTS' && (
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            <button
              onClick={() => downloadCsvFile('fragmore_customer_ledgers.csv', snap.customerLedgers)}
              className="px-3 py-1.5 border border-[#DED7CC] bg-white rounded text-xs font-mono hover:border-[#9A783E] cursor-pointer"
            >
              Export CSV
            </button>
            <button
              onClick={() =>
                downloadExcelSpreadsheet('fragmore_customer_ledgers.xls', 'FRAGMORÉ Customer Receivable Ledgers', snap.customerLedgers)
              }
              className="px-3 py-1.5 border border-[#DED7CC] bg-white rounded text-xs font-mono hover:border-[#9A783E] cursor-pointer"
            >
              Export Excel (.xls)
            </button>
          </div>

          <div className="border border-[#DED7CC] bg-white rounded-lg overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                <tr>
                  <th className="py-2.5 px-3">Customer Account</th>
                  <th className="py-2.5 px-3 text-right">Invoiced</th>
                  <th className="py-2.5 px-3 text-right">Debit Notes</th>
                  <th className="py-2.5 px-3 text-right">Paid</th>
                  <th className="py-2.5 px-3 text-right">Credit Notes</th>
                  <th className="py-2.5 px-3 text-right">Unadj. Advance</th>
                  <th className="py-2.5 px-3 text-right">Balance Due</th>
                  <th className="py-2.5 px-3 text-right">Statement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DED7CC] font-mono tabular-nums">
                {snap.customerLedgers.map((c, idx) => (
                  <tr key={idx} className="hover:bg-[#FAF8F4]">
                    <td className="py-2.5 px-3 font-sans">
                      <span className="font-semibold block">{c.customerName}</span>
                      <span className="font-mono text-[10px] text-[#686158]">{c.customerEmail}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right">{fmt(c.invoicedInr)}</td>
                    <td className="py-2.5 px-3 text-right">{fmt(c.debitNotesInr)}</td>
                    <td className="py-2.5 px-3 text-right text-emerald-700">{fmt(c.paidInr)}</td>
                    <td className="py-2.5 px-3 text-right text-rose-700">{fmt(c.creditNotesInr)}</td>
                    <td className="py-2.5 px-3 text-right text-[#9A783E]">{fmt(c.advanceRemainingInr)}</td>
                    <td className="py-2.5 px-3 text-right font-bold">{fmt(c.balanceDueInr)}</td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => openCustomerStatement(c)}
                        className="text-[#24211D] hover:text-[#9A783E] cursor-pointer"
                      >
                        Statement PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 7: GST CONFIG, HSN GOVERNANCE & GSTR EXPORTS */}
      {tab === 'GST_CONFIG' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* GST Organization & Policies */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                runAction(
                  () =>
                    erpApi.updateGstAndPolicyConfig({
                      legalName: cfgForm.legalName,
                      gstin: cfgForm.gstin,
                      pan: cfgForm.pan,
                      cin: cfgForm.cin,
                      stateName: cfgForm.stateName,
                      registeredAddress: cfgForm.registeredAddress,
                      eInvoiceEnabled: cfgForm.eInvoiceEnabled,
                      eInvoiceThresholdInr: cfgForm.eInvoiceThresholdInr,
                      eWayBillThresholdInr: cfgForm.eWayBillThresholdInr,
                      numberingPrefixes: {
                        INV: cfgForm.invPrefix,
                        PFM: cfgForm.pfmPrefix,
                        CN: cfgForm.cnPrefix,
                        SDN: cfgForm.sdnPrefix,
                        DC: cfgForm.dcPrefix
                      },
                      approveGstConfig: cfgForm.approveGstConfig
                    }),
                  'Saved Statutory GSTIN, Numbering Series & E-Invoice/EWB Policies.'
                );
              }}
              className="border border-[#DED7CC] bg-white rounded-lg p-5 space-y-3"
            >
              <div className="flex items-center justify-between border-b border-[#DED7CC] pb-2">
                <h3 className="text-xs font-mono uppercase font-semibold">Company GSTIN, Numbering &amp; E-Invoicing</h3>
                {org.gstConfigApprovedBy && (
                  <span className="text-[10px] font-mono text-emerald-700">Approved by {org.gstConfigApprovedBy}</span>
                )}
              </div>
              <input
                required
                placeholder="Legal Entity Name"
                value={cfgForm.legalName}
                onChange={(e) => setCfgForm({ ...cfgForm, legalName: e.target.value })}
                className="w-full px-3 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  required
                  placeholder="15-Char Company GSTIN"
                  value={cfgForm.gstin}
                  onChange={(e) => setCfgForm({ ...cfgForm, gstin: e.target.value.toUpperCase() })}
                  className="px-3 py-1.5 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
                />
                <select
                  value={cfgForm.stateName}
                  onChange={(e) => setCfgForm({ ...cfgForm, stateName: e.target.value })}
                  className="px-2.5 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                >
                  {snap.indianStates.map((s) => (
                    <option key={s.code} value={s.name}>{s.name} ({s.code})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  placeholder="PAN"
                  value={cfgForm.pan}
                  onChange={(e) => setCfgForm({ ...cfgForm, pan: e.target.value.toUpperCase() })}
                  className="px-3 py-1.5 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
                />
                <input
                  placeholder="CIN (Optional)"
                  value={cfgForm.cin}
                  onChange={(e) => setCfgForm({ ...cfgForm, cin: e.target.value.toUpperCase() })}
                  className="px-3 py-1.5 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
                />
              </div>
              <input
                placeholder="Registered GST Address"
                value={cfgForm.registeredAddress}
                onChange={(e) => setCfgForm({ ...cfgForm, registeredAddress: e.target.value })}
                className="w-full px-3 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              />
              <div className="grid grid-cols-3 gap-2 font-mono">
                <input
                  placeholder="INV Prefix"
                  value={cfgForm.invPrefix}
                  onChange={(e) => setCfgForm({ ...cfgForm, invPrefix: e.target.value })}
                  className="px-2 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                />
                <input
                  placeholder="PFM Prefix"
                  value={cfgForm.pfmPrefix}
                  onChange={(e) => setCfgForm({ ...cfgForm, pfmPrefix: e.target.value })}
                  className="px-2 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                />
                <input
                  placeholder="DC Prefix"
                  value={cfgForm.dcPrefix}
                  onChange={(e) => setCfgForm({ ...cfgForm, dcPrefix: e.target.value })}
                  className="px-2 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cfgForm.eInvoiceEnabled}
                    onChange={(e) => setCfgForm({ ...cfgForm, eInvoiceEnabled: e.target.checked })}
                    className="accent-[#9A783E]"
                  />
                  <span>Enable E-Invoice (NIC IRN) Workflow for B2B</span>
                </label>
                <div className="flex items-center gap-1.5 font-mono">
                  <span className="text-[11px] text-[#686158]">EWB ₹</span>
                  <input
                    type="number"
                    value={cfgForm.eWayBillThresholdInr}
                    onChange={(e) => setCfgForm({ ...cfgForm, eWayBillThresholdInr: Number(e.target.value) })}
                    className="w-24 px-2 py-1 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                  />
                </div>
              </div>
              <button
                disabled={busy}
                type="submit"
                className="w-full py-2.5 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono uppercase rounded cursor-pointer"
              >
                Save &amp; Administrator-Approve GST Config
              </button>
            </form>

            {/* Propose & Verify HSN/SAC Rules */}
            <div className="space-y-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  runAction(async () => {
                    await erpApi.upsertHsnSacRule(hsnForm);
                    setHsnForm({ hsnSacCode: '', codeType: 'HSN', description: '', gstRatePct: 18, notes: '' });
                  }, 'Proposed HSN/SAC rule (Pending Admin Approval & Accountant Verification).');
                }}
                className="border border-[#DED7CC] bg-white rounded-lg p-4 space-y-2.5"
              >
                <h3 className="text-xs font-mono uppercase font-semibold border-b border-[#DED7CC] pb-2">
                  Propose Official CBIC HSN / SAC Schedule
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    required
                    placeholder="4-8 Digit Code"
                    value={hsnForm.hsnSacCode}
                    onChange={(e) => setHsnForm({ ...hsnForm, hsnSacCode: e.target.value })}
                    className="px-2.5 py-1.5 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
                  />
                  <select
                    value={hsnForm.codeType}
                    onChange={(e) => setHsnForm({ ...hsnForm, codeType: e.target.value as any })}
                    className="px-2 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                  >
                    <option value="HSN">HSN (Goods)</option>
                    <option value="SAC">SAC (Services)</option>
                  </select>
                  <select
                    value={hsnForm.gstRatePct}
                    onChange={(e) => setHsnForm({ ...hsnForm, gstRatePct: Number(e.target.value) })}
                    className="px-2 py-1.5 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
                  >
                    <option value={0}>0% GST</option>
                    <option value={5}>5% GST</option>
                    <option value={12}>12% GST</option>
                    <option value={18}>18% GST</option>
                    <option value={28}>28% GST</option>
                  </select>
                </div>
                <input
                  required
                  placeholder="Statutory Commodity / Service Description"
                  value={hsnForm.description}
                  onChange={(e) => setHsnForm({ ...hsnForm, description: e.target.value })}
                  className="w-full px-3 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                />
                <button
                  disabled={busy}
                  type="submit"
                  className="w-full py-2 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono uppercase rounded cursor-pointer"
                >
                  Submit HSN/SAC for Admin &amp; Accountant Governance
                </button>
              </form>

              <div className="border border-[#DED7CC] bg-white rounded-lg p-4 space-y-2 max-h-64 overflow-y-auto">
                <h4 className="text-xs font-mono uppercase font-semibold text-[#24211D]">
                  HSN / SAC Verification Governance ({snap.hsnSacMaster.length})
                </h4>
                {snap.hsnSacMaster.map((h) => (
                  <div key={h.id} className="flex items-center justify-between gap-2 text-xs border-t border-[#DED7CC] pt-2">
                    <div className="min-w-0">
                      <span className="font-mono font-bold text-[#9A783E]">
                        {h.codeType} {h.hsnSacCode} · {h.gstRatePct}% GST
                      </span>
                      <p className="text-[11px] text-[#686158] truncate">{h.description}</p>
                    </div>
                    <div className="shrink-0 flex items-center gap-1.5 font-mono text-[10px]">
                      {h.approvalStatus === 'PENDING_ADMIN_APPROVAL' && (
                        <button
                          disabled={busy}
                          onClick={() =>
                            runAction(() => erpApi.verifyHsnSacRule(h.id, 'ADMIN_APPROVE'), `Admin approved HSN ${h.hsnSacCode}.`)
                          }
                          className="px-2 py-1 bg-[#24211D] text-[#FAF8F4] rounded cursor-pointer"
                        >
                          Admin Approve
                        </button>
                      )}
                      {h.approvalStatus === 'ADMIN_APPROVED' && (
                        <button
                          disabled={busy}
                          onClick={() =>
                            runAction(() => erpApi.verifyHsnSacRule(h.id, 'ACCOUNTANT_VERIFY'), `Accountant verified HSN ${h.hsnSacCode}.`)
                          }
                          className="px-2 py-1 bg-[#9A783E] text-[#FAF8F4] rounded cursor-pointer"
                        >
                          Accountant Verify
                        </button>
                      )}
                      {h.approvalStatus === 'ACCOUNTANT_VERIFIED' && (
                        <span className="text-emerald-700 font-semibold">VERIFIED</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* GSTR-1 / GSTR-2B / HSN Summary Statutory Exports */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border border-[#DED7CC] bg-white rounded-lg p-4 space-y-3">
              <div>
                <span className="text-[10px] font-mono uppercase text-[#9A783E]">Outward Tax Return</span>
                <h4 className="font-serif text-base text-[#24211D]">GSTR-1 Sales Register</h4>
                <p className="font-mono text-[11px] text-[#686158] mt-1">
                  Output GST: {fmt(snap.gstRegisters.totalOutputGstInr)} ({allTaxInvoices.length} tax invoices)
                </p>
              </div>
              <div className="flex gap-2 pt-2 border-t border-[#DED7CC]">
                <button
                  onClick={() => downloadCsvFile('fragmore_gstr1_sales.csv', allTaxInvoices)}
                  className="px-2.5 py-1.5 border border-[#DED7CC] rounded text-xs font-mono hover:border-[#9A783E] cursor-pointer"
                >
                  CSV
                </button>
                <button
                  onClick={() => downloadExcelSpreadsheet('fragmore_gstr1_sales.xls', 'GSTR-1 Outward Supplies', allTaxInvoices)}
                  className="px-2.5 py-1.5 border border-[#DED7CC] rounded text-xs font-mono hover:border-[#9A783E] cursor-pointer"
                >
                  Excel (.xls)
                </button>
              </div>
            </div>

            <div className="border border-[#DED7CC] bg-white rounded-lg p-4 space-y-3">
              <div>
                <span className="text-[10px] font-mono uppercase text-[#9A783E]">Outward HSN Table 12</span>
                <h4 className="font-serif text-base text-[#24211D]">HSN-Wise GST Summary</h4>
                <p className="font-mono text-[11px] text-[#686158] mt-1">
                  {snap.gstRegisters.hsnSummary.length} HSN/SAC buckets aggregated
                </p>
              </div>
              <div className="flex gap-2 pt-2 border-t border-[#DED7CC]">
                <button
                  onClick={() => downloadCsvFile('fragmore_gstr1_hsn_summary.csv', snap.gstRegisters.hsnSummary)}
                  className="px-2.5 py-1.5 border border-[#DED7CC] rounded text-xs font-mono hover:border-[#9A783E] cursor-pointer"
                >
                  CSV
                </button>
                <button
                  onClick={() =>
                    downloadExcelSpreadsheet('fragmore_gstr1_hsn_summary.xls', 'GSTR-1 Table 12 HSN Summary', snap.gstRegisters.hsnSummary)
                  }
                  className="px-2.5 py-1.5 border border-[#DED7CC] rounded text-xs font-mono hover:border-[#9A783E] cursor-pointer"
                >
                  Excel (.xls)
                </button>
              </div>
            </div>

            <div className="border border-[#DED7CC] bg-white rounded-lg p-4 space-y-3">
              <div>
                <span className="text-[10px] font-mono uppercase text-[#9A783E]">Inward ITC &amp; Net Tax</span>
                <h4 className="font-serif text-base text-[#24211D]">GSTR-2B Purchase &amp; ITC Register</h4>
                <p className="font-mono text-[11px] text-[#686158] mt-1">
                  Net GST Payable: {fmt(snap.gstRegisters.netGstPayableInr)} (ITC {fmt(snap.gstRegisters.totalInputGstInr)})
                </p>
              </div>
              <div className="flex gap-2 pt-2 border-t border-[#DED7CC]">
                <button
                  onClick={() => downloadCsvFile('fragmore_gstr2b_purchases_itc.csv', snap.vendorInvoices)}
                  className="px-2.5 py-1.5 border border-[#DED7CC] rounded text-xs font-mono hover:border-[#9A783E] cursor-pointer"
                >
                  CSV
                </button>
                <button
                  onClick={() =>
                    downloadExcelSpreadsheet('fragmore_gstr2b_purchases_itc.xls', 'GSTR-2B Purchase & ITC Register', snap.vendorInvoices)
                  }
                  className="px-2.5 py-1.5 border border-[#DED7CC] rounded text-xs font-mono hover:border-[#9A783E] cursor-pointer"
                >
                  Excel (.xls)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
