import React from 'react';
import { X, Printer, FileSpreadsheet, Download } from 'lucide-react';
import { FragmoreLogo } from '../../common/FragmoreLogo';
import { downloadCsvFile, downloadExcelSpreadsheet } from '../../../lib/erpApi';

export type GstPrintableDocType =
  | 'INVOICE'
  | 'CREDIT_NOTE'
  | 'SALES_DEBIT_NOTE'
  | 'RECEIPT'
  | 'DELIVERY_CHALLAN'
  | 'CUSTOMER_STATEMENT'
  | 'FINANCIAL_STATEMENT';

export interface GstPrintablePayload {
  type: GstPrintableDocType;
  title?: string;
  record: any;
  extra?: any;
}

interface Props {
  doc: GstPrintablePayload | null;
  organization: any;
  onClose: () => void;
}

const fmt = (n: number) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const GstDocumentPrintModal: React.FC<Props> = ({ doc, organization, onClose }) => {
  if (!doc || !doc.record) return null;

  const org = organization || {};
  const rec = doc.record;

  const handleExportExcel = () => {
    if (doc.type === 'INVOICE' && Array.isArray(rec.items)) {
      downloadExcelSpreadsheet(`${rec.invoiceNumber}.xls`, `FRAGMORÉ ${rec.invoiceType} ${rec.invoiceNumber}`, rec.items);
    } else if (doc.type === 'DELIVERY_CHALLAN' && Array.isArray(rec.items)) {
      downloadExcelSpreadsheet(`${rec.challanNumber}.xls`, `Delivery Challan ${rec.challanNumber}`, rec.items);
    } else if (doc.type === 'CUSTOMER_STATEMENT' && Array.isArray(doc.extra?.transactions)) {
      downloadExcelSpreadsheet(
        `statement_${(rec.customerName || 'customer').replace(/\s+/g, '_')}.xls`,
        `Customer Statement — ${rec.customerName}`,
        doc.extra.transactions
      );
    } else if (doc.type === 'FINANCIAL_STATEMENT' && Array.isArray(doc.extra?.exportRows)) {
      downloadExcelSpreadsheet(
        `${(doc.title || 'financial_statement').toLowerCase().replace(/\s+/g, '_')}.xls`,
        doc.title || 'Financial Statement',
        doc.extra.exportRows
      );
    }
  };

  const handleExportCsv = () => {
    if (doc.type === 'INVOICE' && Array.isArray(rec.items)) {
      downloadCsvFile(`${rec.invoiceNumber}.csv`, rec.items);
    } else if (doc.type === 'DELIVERY_CHALLAN' && Array.isArray(rec.items)) {
      downloadCsvFile(`${rec.challanNumber}.csv`, rec.items);
    } else if (doc.type === 'CUSTOMER_STATEMENT' && Array.isArray(doc.extra?.transactions)) {
      downloadCsvFile(`statement_${(rec.customerName || 'customer').replace(/\s+/g, '_')}.csv`, doc.extra.transactions);
    } else if (doc.type === 'FINANCIAL_STATEMENT' && Array.isArray(doc.extra?.exportRows)) {
      downloadCsvFile(`${(doc.title || 'financial_statement').toLowerCase().replace(/\s+/g, '_')}.csv`, doc.extra.exportRows);
    }
  };

  const hasExportableRows =
    (doc.type === 'INVOICE' && Array.isArray(rec.items) && rec.items.length > 0) ||
    (doc.type === 'DELIVERY_CHALLAN' && Array.isArray(rec.items) && rec.items.length > 0) ||
    (doc.type === 'CUSTOMER_STATEMENT' && Array.isArray(doc.extra?.transactions) && doc.extra.transactions.length > 0) ||
    (doc.type === 'FINANCIAL_STATEMENT' && Array.isArray(doc.extra?.exportRows) && doc.extra.exportRows.length > 0);

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[120] bg-black/55 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto print:static print:bg-white print:p-0"
    >
      <div className="w-full max-w-4xl bg-white border border-[#DED7CC] shadow-2xl max-h-[92vh] flex flex-col print:max-h-none print:border-0 print:shadow-none">
        {/* Toolbar */}
        <div className="px-5 py-3.5 border-b border-[#DED7CC] bg-[#FAF8F4] flex flex-wrap items-center justify-between gap-2 print:hidden">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-[#9A783E]">
              FRAGMORÉ Statutory Document Preview
            </p>
            <p className="text-xs text-[#6B6258]">{doc.title || doc.type}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {hasExportableRows && (
              <>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="px-3 py-1.5 border border-[#DED7CC] bg-white hover:border-[#9A783E] text-xs font-mono text-[#24211D] rounded flex items-center gap-1.5 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-[#9A783E]" />
                  <span>Excel</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="px-3 py-1.5 border border-[#DED7CC] bg-white hover:border-[#9A783E] text-xs font-mono text-[#24211D] rounded flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#9A783E]" />
                  <span>CSV</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-1.5 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono rounded flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 border border-[#DED7CC] bg-white text-[#686158] hover:text-[#24211D] rounded cursor-pointer"
              aria-label="Close document preview"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Sheet */}
        <div className="p-6 sm:p-10 overflow-y-auto space-y-6 text-xs text-[#24211D] bg-white">
          {/* Org Letterhead */}
          <div className="flex flex-col sm:flex-row justify-between gap-4 border-b border-[#24211D] pb-5">
            <div className="space-y-1">
              <div className="mb-2">
                <FragmoreLogo size="sm" />
              </div>
              <p className="font-semibold text-sm text-[#24211D]">{org.legalName || 'FRAGMORÉ Fine Fragrances Pvt. Ltd.'}</p>
              <p className="text-[#686158] max-w-md">{org.registeredAddress || 'Mumbai, Maharashtra, India'}</p>
              <p className="font-mono text-[11px]">
                GSTIN: <strong className="text-[#24211D]">{org.gstin}</strong> · PAN: {org.pan || 'AABCF9482M'}
              </p>
              <p className="font-mono text-[11px] text-[#686158]">
                State: {org.stateName || 'Maharashtra'} (Code {org.stateCode || '27'}) · {org.contactEmail || 'concierge@fragmore.shop'}
              </p>
            </div>

            {doc.type === 'INVOICE' && (
              <div className="sm:text-right font-mono space-y-1">
                <div className="text-sm font-bold tracking-wider uppercase text-[#9A783E]">
                  {rec.invoiceType === 'PROFORMA'
                    ? 'PROFORMA INVOICE'
                    : rec.customerGstin
                    ? 'TAX INVOICE (B2B GST)'
                    : 'TAX INVOICE'}
                </div>
                <div>Document #: <strong>{rec.invoiceNumber}</strong></div>
                <div>Issue Date: {rec.issueDate} · Due: {rec.dueDate}</div>
                <div>Category: {rec.billingCategory || 'B2C'} · Mode: {rec.pricingMode || 'EXCLUSIVE'} GST</div>
                <div>Place of Supply: {rec.placeOfSupplyState} ({rec.placeOfSupplyCode || '27'})</div>
                <div>Tax Regime: {rec.isInterState ? 'Inter-State (IGST)' : 'Intra-State (CGST + SGST)'}</div>
              </div>
            )}

            {doc.type === 'CREDIT_NOTE' && (
              <div className="sm:text-right font-mono space-y-1">
                <div className="text-sm font-bold tracking-wider uppercase text-rose-800">GST CREDIT NOTE</div>
                <div>Credit Note #: <strong>{rec.creditNoteNumber}</strong></div>
                <div>Date: {rec.issueDate}</div>
                <div>Against Invoice: {doc.extra?.invoiceNumber || rec.invoiceId}</div>
              </div>
            )}

            {doc.type === 'SALES_DEBIT_NOTE' && (
              <div className="sm:text-right font-mono space-y-1">
                <div className="text-sm font-bold tracking-wider uppercase text-[#9A783E]">GST SALES DEBIT NOTE</div>
                <div>Debit Note #: <strong>{rec.debitNoteNumber}</strong></div>
                <div>Date: {rec.issueDate}</div>
                <div>Supply: {rec.placeOfSupplyState} ({rec.isInterState ? 'IGST' : 'CGST+SGST'})</div>
              </div>
            )}

            {doc.type === 'RECEIPT' && (
              <div className="sm:text-right font-mono space-y-1">
                <div className="text-sm font-bold tracking-wider uppercase text-[#9A783E]">
                  {rec.isAdvance ? 'ADVANCE PAYMENT RECEIPT' : 'OFFICIAL PAYMENT RECEIPT'}
                </div>
                <div>Receipt #: <strong>{rec.receiptNumber || rec.paymentNumber}</strong></div>
                <div>Voucher #: {rec.paymentNumber}</div>
                <div>Date: {rec.paymentDate}</div>
                <div>Instrument: {rec.method} · Ref: {rec.referenceNumber}</div>
              </div>
            )}

            {doc.type === 'DELIVERY_CHALLAN' && (
              <div className="sm:text-right font-mono space-y-1">
                <div className="text-sm font-bold tracking-wider uppercase text-[#9A783E]">DELIVERY CHALLAN</div>
                <div>Challan #: <strong>{rec.challanNumber}</strong></div>
                <div>Type: {rec.challanType}</div>
                <div>Dispatch Date: {rec.dispatchDate}</div>
                {rec.eWayBillNumber && <div>E-Way Bill: {rec.eWayBillNumber}</div>}
              </div>
            )}

            {doc.type === 'CUSTOMER_STATEMENT' && (
              <div className="sm:text-right font-mono space-y-1">
                <div className="text-sm font-bold tracking-wider uppercase text-[#9A783E]">CUSTOMER LEDGER STATEMENT</div>
                <div>Account: <strong>{rec.customerName}</strong></div>
                <div>{rec.customerEmail}</div>
                <div>As of: {new Date().toISOString().slice(0, 10)}</div>
              </div>
            )}

            {doc.type === 'FINANCIAL_STATEMENT' && (
              <div className="sm:text-right font-mono space-y-1">
                <div className="text-sm font-bold tracking-wider uppercase text-[#9A783E]">{doc.title}</div>
                <div>Accounting Basis: Double-Entry Accrual</div>
                <div>Valuation: {org.inventoryValuationPolicy || 'WEIGHTED_AVERAGE'}</div>
                <div>Status: {org.accountingReadyStatus || 'VERIFICATION_PENDING'}</div>
              </div>
            )}
          </div>

          {/* INVOICE BODY */}
          {doc.type === 'INVOICE' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#FAF8F4] border border-[#DED7CC] p-4 rounded">
                <div>
                  <span className="text-[10px] font-mono uppercase text-[#686158] block">Billed To</span>
                  <p className="font-semibold text-sm text-[#24211D]">{rec.customerName}</p>
                  <p className="text-[#686158]">{rec.billingAddress || rec.placeOfSupplyState}</p>
                  <p className="font-mono text-[11px] text-[#686158]">{rec.customerEmail}</p>
                  {rec.customerGstin && (
                    <p className="font-mono text-[11px] text-[#24211D] mt-1">
                      Buyer GSTIN: <strong>{rec.customerGstin}</strong>
                    </p>
                  )}
                </div>
                <div className="sm:text-right font-mono text-[11px] space-y-1">
                  <div>Payment Status: <strong>{rec.paymentStatus}</strong></div>
                  <div>E-Invoice Status: <strong>{rec.eInvoiceStatus || 'NOT_APPLICABLE'}</strong></div>
                  {rec.eInvoiceIrn && <div className="break-all">IRN: {rec.eInvoiceIrn}</div>}
                  <div>E-Way Bill: <strong>{rec.eWayBillStatus || 'NOT_REQUIRED'}</strong> {rec.eWayBillNumber ? `(${rec.eWayBillNumber})` : ''}</div>
                </div>
              </div>

              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#24211D] font-mono text-[10px] uppercase text-[#686158]">
                    <th className="py-2 pr-2">#</th>
                    <th className="py-2 pr-2">Item &amp; HSN/SAC</th>
                    <th className="py-2 px-2 text-right">Qty</th>
                    <th className="py-2 px-2 text-right">Rate (Excl.)</th>
                    <th className="py-2 px-2 text-right">Taxable</th>
                    <th className="py-2 px-2 text-right">GST</th>
                    <th className="py-2 pl-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DED7CC]">
                  {(rec.items || []).map((it: any, idx: number) => (
                    <tr key={idx}>
                      <td className="py-2 pr-2 font-mono text-[#686158]">{idx + 1}</td>
                      <td className="py-2 pr-2">
                        <span className="font-medium text-[#24211D] block">{it.description}</span>
                        <span className="font-mono text-[10px] text-[#686158]">
                          SKU: {it.sku || 'FRG'} · HSN/SAC: {it.hsnCode || '33030050'} ({it.gstRatePct ?? 18}% GST)
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right font-mono tabular-nums">{it.qty}</td>
                      <td className="py-2 px-2 text-right font-mono tabular-nums">{fmt(it.unitPriceInr)}</td>
                      <td className="py-2 px-2 text-right font-mono tabular-nums">{fmt(it.taxableValueInr)}</td>
                      <td className="py-2 px-2 text-right font-mono tabular-nums">
                        {fmt(Number(it.cgstInr || 0) + Number(it.sgstInr || 0) + Number(it.igstInr || 0))}
                      </td>
                      <td className="py-2 pl-2 text-right font-mono tabular-nums font-semibold">{fmt(it.totalInr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-t border-[#24211D] pt-4">
                <div className="space-y-2 text-[11px] text-[#686158]">
                  <p className="font-mono uppercase text-[#24211D] font-semibold">Bank &amp; Settlement Instructions</p>
                  <p>
                    {org.bankDetails?.bankName || 'HDFC Bank Ltd'} · A/C {org.bankDetails?.accountNumber || '50200084910421'} · IFSC{' '}
                    {org.bankDetails?.ifsc || 'HDFC0000240'}
                  </p>
                  {rec.notes && <p className="italic">Notes: {rec.notes}</p>}
                  <p className="text-[10px] pt-2">
                    Subject to Mumbai Jurisdiction. Certified that particulars above are true and correct under CGST/SGST/IGST Act.
                  </p>
                </div>
                <div className="font-mono space-y-1.5 text-right tabular-nums">
                  <div className="flex justify-between">
                    <span className="text-[#686158]">Subtotal (Excl. Tax)</span>
                    <span>{fmt(rec.subtotalInr)}</span>
                  </div>
                  {Number(rec.discountInr || 0) > 0 && (
                    <div className="flex justify-between text-rose-700">
                      <span>Less: Discount</span>
                      <span>-{fmt(rec.discountInr)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-[#686158]">Taxable Value</span>
                    <span>{fmt(rec.taxableAmountInr)}</span>
                  </div>
                  {rec.isInterState ? (
                    <div className="flex justify-between">
                      <span className="text-[#686158]">IGST Output</span>
                      <span>{fmt(rec.igstAmountInr)}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span className="text-[#686158]">CGST Output</span>
                        <span>{fmt(rec.cgstAmountInr)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#686158]">SGST Output</span>
                        <span>{fmt(rec.sgstAmountInr)}</span>
                      </div>
                    </>
                  )}
                  {Number(rec.shippingInr || 0) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-[#686158]">Freight &amp; Handling</span>
                      <span>{fmt(rec.shippingInr)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold text-[#9A783E] border-t border-[#DED7CC] pt-2">
                    <span>Grand Total</span>
                    <span>{fmt(rec.grandTotalInr)}</span>
                  </div>
                  {Number(rec.advanceAdjustedInr || 0) > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Advance Receipt Adjusted</span>
                      <span>-{fmt(rec.advanceAdjustedInr)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[11px] text-[#686158]">
                    <span>Amount Paid / Settled</span>
                    <span>{fmt(rec.amountPaidInr)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-[#24211D]">
                    <span>Net Balance Due</span>
                    <span>{fmt(rec.balanceDueInr)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CREDIT NOTE OR SALES DEBIT NOTE BODY */}
          {(doc.type === 'CREDIT_NOTE' || doc.type === 'SALES_DEBIT_NOTE') && (
            <div className="space-y-4">
              <div className="bg-[#FAF8F4] border border-[#DED7CC] p-4 rounded space-y-1">
                <p>Party: <strong>{rec.customerName}</strong> ({rec.customerEmail})</p>
                <p>Reason / Adjustment Particulars: <strong>{rec.reason}</strong></p>
              </div>
              <table className="w-full text-left border-collapse font-mono">
                <thead>
                  <tr className="border-b border-[#24211D] text-[10px] uppercase text-[#686158]">
                    <th className="py-2">Component</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DED7CC] tabular-nums">
                  <tr>
                    <td className="py-2">Taxable Adjustment Value ({rec.gstRatePct || 18}% GST)</td>
                    <td className="py-2 text-right">{fmt(rec.taxableAmountInr)}</td>
                  </tr>
                  <tr>
                    <td className="py-2">CGST</td>
                    <td className="py-2 text-right">{fmt(rec.cgstInr)}</td>
                  </tr>
                  <tr>
                    <td className="py-2">SGST</td>
                    <td className="py-2 text-right">{fmt(rec.sgstInr)}</td>
                  </tr>
                  <tr>
                    <td className="py-2">IGST</td>
                    <td className="py-2 text-right">{fmt(rec.igstInr)}</td>
                  </tr>
                  <tr className="font-bold text-sm text-[#9A783E]">
                    <td className="py-3">Total {doc.type === 'CREDIT_NOTE' ? 'Credit' : 'Debit'} Note Value</td>
                    <td className="py-3 text-right">
                      {fmt(doc.type === 'CREDIT_NOTE' ? rec.totalCreditInr : rec.totalDebitInr)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* ADVANCE / PAYMENT RECEIPT BODY */}
          {doc.type === 'RECEIPT' && (
            <div className="space-y-4 border border-[#DED7CC] bg-[#FAF8F4] p-6 rounded">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] font-mono uppercase text-[#686158] block">Received From</span>
                  <p className="text-sm font-semibold">{rec.partyName}</p>
                  {rec.customerEmail && <p className="font-mono text-[#686158]">{rec.customerEmail}</p>}
                </div>
                <div className="text-right font-mono tabular-nums">
                  <span className="text-[10px] uppercase text-[#686158] block">Amount Received</span>
                  <p className="text-xl font-bold text-emerald-700">{fmt(rec.amountInr)}</p>
                  {rec.isAdvance && (
                    <p className="text-[11px] text-[#9A783E]">Unadjusted Advance Balance: {fmt(rec.advanceRemainingInr)}</p>
                  )}
                </div>
              </div>
              <div className="border-t border-[#DED7CC] pt-3 font-mono text-[11px] space-y-1">
                <div>Deposited Into Account: {rec.accountCode} · Mode: {rec.method}</div>
                <div>Bank / UTR Reference: {rec.referenceNumber}</div>
                {rec.notes && <div>Notes: {rec.notes}</div>}
              </div>
            </div>
          )}

          {/* DELIVERY CHALLAN BODY */}
          {doc.type === 'DELIVERY_CHALLAN' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#FAF8F4] border border-[#DED7CC] p-4 rounded">
                <div>
                  <span className="text-[10px] font-mono uppercase text-[#686158] block">Consignee &amp; Delivery Address</span>
                  <p className="font-semibold text-sm">{rec.customerName}</p>
                  <p className="text-[#686158]">{rec.deliveryAddress}</p>
                  <p className="font-mono text-[11px]">Supply State: {rec.placeOfSupplyState}</p>
                </div>
                <div className="sm:text-right font-mono text-[11px] space-y-1">
                  <div>Transporter: {rec.transporterName || 'FRAGMORÉ White-Glove Logistics'}</div>
                  <div>Vehicle #: {rec.vehicleNumber || 'TBD'}</div>
                  <div>Status: {rec.status}</div>
                </div>
              </div>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#24211D] font-mono text-[10px] uppercase text-[#686158]">
                    <th className="py-2">SKU / Description</th>
                    <th className="py-2">HSN</th>
                    <th className="py-2 text-right">Qty</th>
                    <th className="py-2 text-right">Declared Unit Value</th>
                    <th className="py-2 text-right">Total Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DED7CC] font-mono tabular-nums">
                  {(rec.items || []).map((it: any, idx: number) => (
                    <tr key={idx}>
                      <td className="py-2 font-sans">{it.description} <span className="text-[#686158] text-[10px]">({it.sku})</span></td>
                      <td className="py-2">{it.hsnCode}</td>
                      <td className="py-2 text-right">{it.qty}</td>
                      <td className="py-2 text-right">{fmt(it.unitValueInr)}</td>
                      <td className="py-2 text-right font-semibold">{fmt(it.totalValueInr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-right font-mono font-bold text-sm text-[#9A783E]">
                Total Consignment Declared Value: {fmt(rec.totalTaxableValueInr)}
              </div>
              <p className="text-[10px] text-[#686158] italic">
                Note: Goods moving under Delivery Challan (Rule 55 CGST Rules) — not a Tax Invoice until converted upon supply confirmation.
              </p>
            </div>
          )}

          {/* CUSTOMER STATEMENT BODY */}
          {doc.type === 'CUSTOMER_STATEMENT' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-[#FAF8F4] border border-[#DED7CC] p-4 rounded font-mono tabular-nums">
                <div>
                  <span className="text-[10px] text-[#686158] block">Total Invoiced</span>
                  <strong>{fmt(rec.invoicedInr)}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-[#686158] block">Debit Notes (+)</span>
                  <strong>{fmt(rec.debitNotesInr)}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-[#686158] block">Payments (-)</span>
                  <strong className="text-emerald-700">{fmt(rec.paidInr)}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-[#686158] block">Credit Notes (-)</span>
                  <strong className="text-rose-700">{fmt(rec.creditNotesInr)}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-[#686158] block">Net Balance Due</span>
                  <strong className="text-[#9A783E]">{fmt(rec.balanceDueInr)}</strong>
                </div>
              </div>
              {Array.isArray(doc.extra?.transactions) && (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#24211D] font-mono text-[10px] uppercase text-[#686158]">
                      <th className="py-2">Date</th>
                      <th className="py-2">Document</th>
                      <th className="py-2">Type</th>
                      <th className="py-2 text-right">Debit (Receivable)</th>
                      <th className="py-2 text-right">Credit (Settled)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DED7CC] font-mono tabular-nums">
                    {doc.extra.transactions.map((t: any, idx: number) => (
                      <tr key={idx}>
                        <td className="py-2">{t.date}</td>
                        <td className="py-2 font-semibold">{t.ref}</td>
                        <td className="py-2">{t.kind}</td>
                        <td className="py-2 text-right">{t.debit > 0 ? fmt(t.debit) : '—'}</td>
                        <td className="py-2 text-right">{t.credit > 0 ? fmt(t.credit) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* FINANCIAL STATEMENT BODY */}
          {doc.type === 'FINANCIAL_STATEMENT' && Array.isArray(doc.extra?.exportRows) && (
            <div className="space-y-4">
              {doc.extra?.summaryLine && (
                <div className="p-3 bg-[#FAF8F4] border border-[#DED7CC] font-mono text-[11px] font-semibold">
                  {doc.extra.summaryLine}
                </div>
              )}
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#24211D] font-mono text-[10px] uppercase text-[#686158]">
                    {doc.extra.exportRows[0] &&
                      Object.keys(doc.extra.exportRows[0]).map((col) => (
                        <th key={col} className="py-2 pr-3">
                          {col}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DED7CC] font-mono tabular-nums">
                  {doc.extra.exportRows.map((r: any, idx: number) => (
                    <tr key={idx}>
                      {Object.keys(doc.extra.exportRows[0]).map((col) => (
                        <td key={col} className="py-2 pr-3">
                          {typeof r[col] === 'number' ? fmt(r[col]) : String(r[col] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Signature Footer */}
          <div className="border-t border-[#DED7CC] pt-6 flex justify-between items-end text-[11px] text-[#686158]">
            <div>
              <p>Generated by FRAGMORÉ Business OS · Persistent Firebase Firestore Ledger</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-[#24211D]">For {org.legalName || 'FRAGMORÉ Fine Fragrances Pvt. Ltd.'}</p>
              <p className="mt-6 border-t border-[#DED7CC] pt-1">Authorised Signatory</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
