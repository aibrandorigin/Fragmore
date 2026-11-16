import React from 'react';
import { Printer, X } from 'lucide-react';

export type ProcurementPrintDoc =
  | { type: 'PO'; data: any; supplier?: any }
  | { type: 'RFQ'; data: any; suppliers?: any[] }
  | { type: 'COMPARATIVE'; rfq: any; quotes: any[] }
  | { type: 'GRN'; data: any }
  | { type: 'SUPPLIER_LEDGER'; supplier: any; invoices: any[]; debitNotes: any[]; payments: any[] }
  | { type: 'TABLE_REPORT'; title: string; subtitle?: string; rows: Array<Record<string, any>> };

interface Props {
  doc: ProcurementPrintDoc | null;
  onClose: () => void;
}

const fmtInr = (n: any) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export const ProcurementPrintModal: React.FC<Props> = ({ doc, onClose }) => {
  if (!doc) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto print:static print:bg-white print:p-0"
    >
      <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl w-full max-w-4xl p-6 sm:p-8 space-y-6 text-xs text-[#24211D] print:border-0 print:w-full max-h-[92vh] overflow-y-auto print:max-h-none">
        <div className="flex items-center justify-between border-b border-[#DED7CC] pb-4 print:hidden">
          <span className="font-mono uppercase tracking-wider text-[#9A783E]">
            Procurement Document Preview · PDF Export Ready
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] font-mono text-xs rounded flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save as PDF</span>
            </button>
            <button
              onClick={onClose}
              className="px-3 py-2 border border-[#DED7CC] hover:border-[#24211D] rounded font-mono text-xs flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Close</span>
            </button>
          </div>
        </div>

        {/* Company Letterhead */}
        <div className="flex flex-col sm:flex-row justify-between gap-4 border-b border-[#24211D] pb-4">
          <div>
            <h2 className="font-serif text-2xl tracking-widest uppercase text-[#24211D]">FRAGMORÉ</h2>
            <p className="font-semibold mt-0.5">Fragmoré Luxury Perfumery Pvt. Ltd.</p>
            <p className="text-[#686158]">
              402 Atelier House, Lower Parel Estate, Mumbai, Maharashtra 400013
            </p>
            <p className="font-mono text-[11px] mt-1 text-[#686158]">
              GSTIN: 27AABCF9104K1Z5 · State: Maharashtra (27) · procurement@fragmore.shop
            </p>
          </div>

          {doc.type === 'PO' && (
            <div className="sm:text-right font-mono space-y-0.5">
              <div className="text-sm font-bold text-[#9A783E] uppercase">Purchase Order</div>
              <div className="font-bold">{doc.data.poNumber}</div>
              <div>Date: {doc.data.orderDate}</div>
              <div>Expected Delivery: {doc.data.expectedDeliveryDate}</div>
              <div>Terms: {doc.data.paymentTerms}</div>
              <div>Approval: {doc.data.approvalStatus}</div>
            </div>
          )}

          {doc.type === 'RFQ' && (
            <div className="sm:text-right font-mono space-y-0.5">
              <div className="text-sm font-bold text-[#9A783E] uppercase">Request For Quotation</div>
              <div className="font-bold">{doc.data.rfqNumber}</div>
              <div>Deadline: {doc.data.responseDeadline}</div>
              <div>Status: {doc.data.status}</div>
            </div>
          )}

          {doc.type === 'COMPARATIVE' && (
            <div className="sm:text-right font-mono space-y-0.5">
              <div className="text-sm font-bold text-[#9A783E] uppercase">Comparative Statement</div>
              <div className="font-bold">{doc.rfq?.rfqNumber}</div>
              <div>Quotes Evaluated: {doc.quotes.length}</div>
              <div>Generated: {new Date().toISOString().slice(0, 10)}</div>
            </div>
          )}

          {doc.type === 'GRN' && (
            <div className="sm:text-right font-mono space-y-0.5">
              <div className="text-sm font-bold text-[#9A783E] uppercase">Goods Receipt &amp; QC Note</div>
              <div className="font-bold">{doc.data.grnNumber}</div>
              <div>Received: {doc.data.receivedDate}</div>
              <div>Challan: {doc.data.challanNumber}</div>
              <div>QC Result: {doc.data.qcStatus}</div>
            </div>
          )}

          {doc.type === 'SUPPLIER_LEDGER' && (
            <div className="sm:text-right font-mono space-y-0.5">
              <div className="text-sm font-bold text-[#9A783E] uppercase">Supplier Ledger Statement</div>
              <div className="font-bold">{doc.supplier.code} · {doc.supplier.name}</div>
              <div>GSTIN: {doc.supplier.gstin || 'Unregistered'} · PAN: {doc.supplier.pan || 'N/A'}</div>
              <div>Generated: {new Date().toISOString().slice(0, 10)}</div>
            </div>
          )}

          {doc.type === 'TABLE_REPORT' && (
            <div className="sm:text-right font-mono space-y-0.5">
              <div className="text-sm font-bold text-[#9A783E] uppercase">Procurement Report</div>
              <div>Records: {doc.rows.length}</div>
              <div>Generated: {new Date().toISOString().slice(0, 10)}</div>
            </div>
          )}
        </div>

        {/* Document Specific Bodies */}
        {doc.type === 'PO' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border border-[#DED7CC] p-4 rounded-lg bg-[#FAF8F4]">
              <div>
                <span className="font-mono text-[10px] uppercase text-[#686158] block">Vendor / Supplier</span>
                <div className="font-semibold text-sm mt-0.5">
                  {doc.supplier?.legalName || doc.data.supplierName}
                </div>
                {doc.supplier?.gstin && (
                  <div className="font-mono text-[11px] text-[#686158]">
                    GSTIN: {doc.supplier.gstin} · PAN: {doc.supplier.pan || '—'}
                  </div>
                )}
                <div className="text-[#686158] mt-1">
                  {doc.supplier?.address || `${doc.supplier?.city || ''}, ${doc.supplier?.country || ''}`}
                </div>
                <div className="font-mono text-[11px] mt-1">
                  {doc.data.supplierEmail} · {doc.data.supplierPhone}
                </div>
              </div>
              <div>
                <span className="font-mono text-[10px] uppercase text-[#686158] block">Tax &amp; Dispatch Details</span>
                <div className="font-mono mt-1 space-y-0.5">
                  <div>Tax Regime: {doc.data.isInterState ? 'IGST (Inter-State)' : 'CGST + SGST (Intra-State)'}</div>
                  <div>Category: {doc.data.category}</div>
                  <div>Delivery Warehouse: {doc.data.warehouseId || 'wh-mumbai-rm'}</div>
                  <div>Advance Paid: {fmtInr(doc.data.advancePaidInr)}</div>
                </div>
              </div>
            </div>

            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#24211D] font-mono text-[10px] uppercase text-[#686158]">
                  <th className="py-2">SKU / Item Description</th>
                  <th className="py-2 text-right">Ordered Qty</th>
                  <th className="py-2 text-right">Received</th>
                  <th className="py-2 text-right">Unit Rate</th>
                  <th className="py-2 text-right">GST %</th>
                  <th className="py-2 text-right">Line Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DED7CC]">
                {(doc.data.items || []).map((it: any, i: number) => (
                  <tr key={i}>
                    <td className="py-2">
                      <span className="font-semibold">{it.name}</span>
                      <span className="block font-mono text-[10px] text-[#686158]">
                        {it.sku || '—'} · {it.category || doc.data.category}
                      </span>
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums">
                      {it.quantity} {it.unit}
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums">{it.receivedQty || 0}</td>
                    <td className="py-2 text-right font-mono tabular-nums">{fmtInr(it.unitPriceInr)}</td>
                    <td className="py-2 text-right font-mono tabular-nums">{it.taxPct ?? 18}%</td>
                    <td className="py-2 text-right font-mono tabular-nums font-semibold">
                      {fmtInr(it.totalPriceInr)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="border-t border-[#24211D] pt-3 flex flex-col items-end font-mono space-y-1 tabular-nums">
              <div>Taxable Subtotal: {fmtInr(doc.data.subtotalInr)}</div>
              <div>GST Total: {fmtInr(doc.data.gstInr)}</div>
              <div>Freight &amp; Handling: {fmtInr(doc.data.shippingInr)}</div>
              <div className="text-base font-bold text-[#9A783E]">
                PO Grand Total: {fmtInr(doc.data.totalCostInr)}
              </div>
            </div>
            {doc.data.notes && (
              <div className="border border-[#DED7CC] p-3 rounded bg-[#FAF8F4] text-[#686158]">
                <span className="font-mono text-[10px] uppercase block text-[#24211D]">Instructions &amp; Notes</span>
                {doc.data.notes}
              </div>
            )}
          </div>
        )}

        {doc.type === 'RFQ' && (
          <div className="space-y-4">
            <div>
              <h3 className="font-serif text-lg uppercase">{doc.data.title}</h3>
              <p className="text-[#686158] mt-1">{doc.data.notes}</p>
            </div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#24211D] font-mono text-[10px] uppercase text-[#686158]">
                  <th className="py-2">Code</th>
                  <th className="py-2">Material Description</th>
                  <th className="py-2">Category</th>
                  <th className="py-2 text-right">Required Qty</th>
                  <th className="py-2 text-right">Target Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DED7CC]">
                {(doc.data.items || []).map((it: any, i: number) => (
                  <tr key={i}>
                    <td className="py-2 font-mono">{it.materialCode || '—'}</td>
                    <td className="py-2 font-semibold">{it.materialName}</td>
                    <td className="py-2 font-mono text-[11px]">{it.category}</td>
                    <td className="py-2 text-right font-mono tabular-nums">
                      {it.qty} {it.unit}
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums">
                      {it.targetUnitPriceInr ? fmtInr(it.targetUnitPriceInr) : 'Open Quote'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-[11px] font-mono text-[#686158] border-t border-[#DED7CC] pt-3">
              Invited Bidders:{' '}
              {(doc.data.targetSupplierIds || [])
                .map((id: string) => doc.suppliers?.find((s) => s.id === id)?.name || id)
                .join(' · ')}
            </div>
          </div>
        )}

        {doc.type === 'COMPARATIVE' && (
          <div className="space-y-4">
            <h3 className="font-serif text-lg uppercase">
              Comparative Statement · {doc.rfq?.title || doc.rfq?.rfqNumber}
            </h3>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#24211D] font-mono text-[10px] uppercase text-[#686158]">
                  <th className="py-2">Quote #</th>
                  <th className="py-2">Supplier</th>
                  <th className="py-2 text-right">Subtotal</th>
                  <th className="py-2 text-right">Tax</th>
                  <th className="py-2 text-right">Freight</th>
                  <th className="py-2 text-right">Landed Total</th>
                  <th className="py-2 text-right">Lead Time</th>
                  <th className="py-2">Terms &amp; Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DED7CC]">
                {doc.quotes.map((q) => (
                  <tr key={q.id} className={q.isSelectedWinner ? 'bg-[#FAF8F4] font-semibold' : ''}>
                    <td className="py-2 font-mono">{q.quotationNumber}</td>
                    <td className="py-2">{q.supplierName}</td>
                    <td className="py-2 text-right font-mono tabular-nums">{fmtInr(q.subtotalInr)}</td>
                    <td className="py-2 text-right font-mono tabular-nums">{fmtInr(q.taxInr)}</td>
                    <td className="py-2 text-right font-mono tabular-nums">{fmtInr(q.freightInr)}</td>
                    <td className="py-2 text-right font-mono tabular-nums text-[#9A783E]">
                      {fmtInr(q.totalLandedCostInr)}
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums">{q.deliveryDays} days</td>
                    <td className="py-2 font-mono text-[11px]">
                      {q.paymentTerms} · {q.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {doc.type === 'GRN' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border border-[#DED7CC] p-3 rounded bg-[#FAF8F4] font-mono text-[11px]">
              <div>
                <span className="text-[#686158] block text-[10px]">Supplier</span>
                <span className="font-semibold text-[#24211D]">{doc.data.supplierName}</span>
              </div>
              <div>
                <span className="text-[#686158] block text-[10px]">Warehouse</span>
                <span className="font-semibold text-[#24211D]">{doc.data.warehouseId}</span>
              </div>
              <div>
                <span className="text-[#686158] block text-[10px]">Inventory Posted</span>
                <span className="font-semibold text-[#24211D]">{doc.data.inventoryPosted ? 'YES' : 'PENDING QC'}</span>
              </div>
              <div>
                <span className="text-[#686158] block text-[10px]">Inspected By</span>
                <span className="font-semibold text-[#24211D]">{doc.data.inspectedByEmail || 'Awaiting Lab'}</span>
              </div>
            </div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#24211D] font-mono text-[10px] uppercase text-[#686158]">
                  <th className="py-2">Material &amp; FIFO Lot</th>
                  <th className="py-2 text-right">Received</th>
                  <th className="py-2 text-right">Accepted</th>
                  <th className="py-2 text-right">Rejected</th>
                  <th className="py-2 text-right">Unit Cost</th>
                  <th className="py-2 text-right">Accepted Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DED7CC]">
                {(doc.data.items || []).map((it: any, i: number) => (
                  <tr key={i}>
                    <td className="py-2">
                      <span className="font-semibold">{it.materialName}</span>
                      <span className="block font-mono text-[10px] text-[#686158]">
                        {it.materialCode} · Lot {it.lotNumber}
                      </span>
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums">{it.receivedQty} {it.unit}</td>
                    <td className="py-2 text-right font-mono tabular-nums text-emerald-700">{it.acceptedQty}</td>
                    <td className="py-2 text-right font-mono tabular-nums text-rose-700">{it.rejectedQty || 0}</td>
                    <td className="py-2 text-right font-mono tabular-nums">{fmtInr(it.unitCostInr)}</td>
                    <td className="py-2 text-right font-mono tabular-nums font-semibold">
                      {fmtInr(Number(it.acceptedQty || 0) * Number(it.unitCostInr || 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-[#24211D] pt-3 flex justify-end font-mono font-bold text-sm tabular-nums">
              Total Accepted Capitalized Value: {fmtInr(doc.data.subtotalInr)} (+ GST {fmtInr(doc.data.taxInr)})
            </div>
          </div>
        )}

        {doc.type === 'SUPPLIER_LEDGER' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-5 border border-[#DED7CC] divide-y sm:divide-y-0 sm:divide-x divide-[#DED7CC] rounded font-mono">
              <div className="p-3">
                <span className="text-[10px] text-[#686158] block uppercase">Total Invoiced</span>
                <span className="font-bold tabular-nums">{fmtInr(doc.supplier.ledgerSummary?.totalInvoicedInr)}</span>
              </div>
              <div className="p-3">
                <span className="text-[10px] text-[#686158] block uppercase">Debit Notes</span>
                <span className="font-bold tabular-nums">{fmtInr(doc.supplier.ledgerSummary?.totalDebitNotesInr)}</span>
              </div>
              <div className="p-3">
                <span className="text-[10px] text-[#686158] block uppercase">Advance Paid</span>
                <span className="font-bold tabular-nums">{fmtInr(doc.supplier.ledgerSummary?.advancePaidInr)}</span>
              </div>
              <div className="p-3">
                <span className="text-[10px] text-[#686158] block uppercase">Bill Payments</span>
                <span className="font-bold tabular-nums">{fmtInr(doc.supplier.ledgerSummary?.invoicePaymentsInr)}</span>
              </div>
              <div className="p-3 bg-[#FAF8F4]">
                <span className="text-[10px] text-[#9A783E] block uppercase">Outstanding AP</span>
                <span className="font-bold text-[#9A783E] tabular-nums">
                  {fmtInr(doc.supplier.ledgerSummary?.outstandingBalanceInr)}
                </span>
              </div>
            </div>

            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#24211D] font-mono text-[10px] uppercase text-[#686158]">
                  <th className="py-2">Date</th>
                  <th className="py-2">Type</th>
                  <th className="py-2">Reference #</th>
                  <th className="py-2">Particulars</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DED7CC]">
                {[
                  ...doc.invoices.map((i) => ({
                    date: i.invoiceDate,
                    type: 'SUPPLIER BILL',
                    ref: `${i.voucherNumber} (${i.supplierInvoiceNumber})`,
                    desc: `${i.isNonPo ? 'Non-PO Expense' : 'PO Bill'} · ${i.paymentStatus}`,
                    amt: `+ ${fmtInr(i.totalAmountInr)}`
                  })),
                  ...doc.debitNotes.map((d) => ({
                    date: d.issueDate,
                    type: 'DEBIT NOTE',
                    ref: d.debitNoteNumber,
                    desc: `${d.returnType} · ${d.reason}`,
                    amt: `- ${fmtInr(d.totalDebitInr)}`
                  })),
                  ...doc.payments.map((p) => ({
                    date: p.paymentDate,
                    type: p.isAdvance ? 'ADVANCE PAYOUT' : 'BILL SETTLEMENT',
                    ref: `${p.paymentNumber} (${p.referenceNumber})`,
                    desc: `${p.method} · ${p.notes || ''}`,
                    amt: `- ${fmtInr(p.amountInr)}`
                  }))
                ]
                  .sort((a, b) => String(b.date).localeCompare(String(a.date)))
                  .map((row, idx) => (
                    <tr key={idx}>
                      <td className="py-2 font-mono">{row.date}</td>
                      <td className="py-2 font-mono text-[11px]">{row.type}</td>
                      <td className="py-2 font-mono font-semibold">{row.ref}</td>
                      <td className="py-2 text-[#686158]">{row.desc}</td>
                      <td className="py-2 text-right font-mono tabular-nums font-semibold">{row.amt}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {doc.type === 'TABLE_REPORT' && (
          <div className="space-y-3">
            <div>
              <h3 className="font-serif text-lg uppercase">{doc.title}</h3>
              {doc.subtitle && <p className="text-[#686158]">{doc.subtitle}</p>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-[#24211D] font-mono uppercase text-[#686158]">
                    {doc.rows[0] &&
                      Object.keys(doc.rows[0]).map((k) => (
                        <th key={k} className="py-2 pr-3">
                          {k}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DED7CC]">
                  {doc.rows.slice(0, 80).map((row, idx) => (
                    <tr key={idx}>
                      {Object.keys(doc.rows[0]).map((k) => (
                        <td key={k} className="py-1.5 pr-3 font-mono tabular-nums">
                          {typeof row[k] === 'object' ? JSON.stringify(row[k]) : String(row[k] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
