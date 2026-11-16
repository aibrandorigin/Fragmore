import React from 'react';
import { X, Printer, FileSpreadsheet, Download, CheckCircle2, ShieldCheck } from 'lucide-react';
import { FragmoreLogo } from '../../common/FragmoreLogo';
import { FragmoreBottleVisual } from '../../storefront/FragmoreBottleVisual';
import { downloadCsvFile, downloadExcelSpreadsheet } from '../../../lib/erpApi';

interface CommercialProposalPrintModalProps {
  mode: 'PROPOSAL' | 'QUOTATION';
  record: any;
  catalogue: any[];
  onClose: () => void;
}

const fmt = (n: number) => `₹${Math.round(Number(n || 0)).toLocaleString('en-IN')}`;

export const CommercialProposalPrintModal: React.FC<CommercialProposalPrintModalProps> = ({
  mode,
  record,
  catalogue,
  onClose
}) => {
  if (!record) return null;

  const isProposal = mode === 'PROPOSAL';
  const docNumber = isProposal ? record.proposalNumber : record.quotationNumber;
  const docDate = isProposal ? record.proposalDate || record.createdAt?.slice?.(0, 10) : record.quotationDate || record.createdAt?.slice?.(0, 10);
  const clientName = isProposal ? record.clientCompany : record.clientName;
  const lineItems: any[] = isProposal
    ? Array.isArray(record.lineItems)
      ? record.lineItems
      : []
    : Array.isArray(record.items)
    ? record.items
    : [];

  const catBySku = new Map<string, any>();
  for (const c of catalogue || []) catBySku.set(String(c.sku || '').toUpperCase(), c);

  const exportInternalCostingExcel = () => {
    const rows = lineItems.map((it) => {
      const cat = catBySku.get(String(it.sku || '').toUpperCase());
      const qty = Number(it.qty || 1);
      const unitRate = Number(it.unitPriceInr || 0);
      const catRate = Number(it.catalogueUnitPriceInr ?? cat?.catalogueUnitPriceInr ?? unitRate);
      const unitCogs = Number(it.unitManufacturingCostInr ?? cat?.unitManufacturingCostInr ?? Math.round(unitRate * 0.28));
      const netRev = qty * unitRate;
      const totalCogs = qty * unitCogs;
      const grossMargin = netRev - totalCogs;
      const marginPct = netRev > 0 ? Math.round((grossMargin / netRev) * 1000) / 10 : 0;
      const discPct = catRate > 0 ? Math.round(((catRate - unitRate) / catRate) * 1000) / 10 : 0;
      return {
        Document: docNumber,
        Client: clientName,
        SKU: it.sku || 'CUSTOM',
        Description: it.description,
        HSN: it.hsnCode || '33030050',
        Qty: qty,
        CatalogueBaseRateInr: catRate,
        QuotedNetRateInr: unitRate,
        DiscountPct: discPct,
        NetRevenueInr: netRev,
        UnitCogsInr: unitCogs,
        TotalCogsInr: totalCogs,
        GrossMarginInr: grossMargin,
        GrossMarginPct: `${marginPct}%`
      };
    });
    if (rows.length) {
      downloadExcelSpreadsheet(
        `${docNumber}_internal_costing_margin.xls`,
        `FRAGMORÉ Internal Margin Breakdown — ${docNumber}`,
        rows
      );
    }
  };

  const exportCsv = () => {
    const rows = lineItems.map((it) => ({
      DocumentNumber: docNumber,
      Client: clientName,
      SKU: it.sku || 'CUSTOM',
      Description: it.description,
      HSN: it.hsnCode || '33030050',
      Qty: Number(it.qty || 1),
      UnitPriceInr: Number(it.unitPriceInr || 0),
      GstPct: Number(it.gstRatePct ?? 18),
      LineTotalInr: Number(it.totalInr ?? it.lineTotalInr ?? Number(it.qty || 1) * Number(it.unitPriceInr || 0))
    }));
    if (rows.length) {
      downloadCsvFile(`${docNumber}_commercial_lines.csv`, rows);
    }
  };

  const subtotal = Number(record.subtotalInr || record.estimatedValueInr || 0);
  const discount = Number(record.discountInr || 0);
  const setupCost = isProposal ? Number(record.setupCostInr || 0) : 0;
  const staffingCost = isProposal ? Number(record.staffingCostInr || 0) : 0;
  const freight = isProposal ? Number(record.shippingInr || 0) : Number(record.freightInr || 0);
  const totalTax = isProposal
    ? Number(record.taxInr || 0)
    : Number(record.cgstInr || 0) + Number(record.sgstInr || 0) + Number(record.igstInr || 0);
  const grandTotal = isProposal ? Number(record.grandTotalInr || record.estimatedValueInr || 0) : Number(record.totalInr || 0);

  return (
    <div className="fixed inset-0 z-[110] bg-black/55 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto print:bg-white print:p-0 print:static">
      <div className="w-full max-w-4xl bg-white border border-[#DED7CC] shadow-2xl max-h-[92vh] flex flex-col print:max-h-none print:border-0 print:shadow-none">
        {/* Toolbar (hidden on print) */}
        <div className="px-5 py-3.5 border-b border-[#DED7CC] bg-[#FAF8F4] flex flex-wrap items-center justify-between gap-2 print:hidden">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-[#9A783E]">
              FRAGMORÉ Branded {isProposal ? 'Proposal Dossier' : 'Commercial GST Quotation'}
            </p>
            <p className="text-xs text-[#6B6258] tabular-nums">
              {docNumber} · Version v{isProposal ? record.proposalVersionNumber || 1 : record.quotationVersionNumber || 1} · {clientName}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={exportInternalCostingExcel}
              className="px-3 py-1.5 text-[11px] font-medium border border-[#DED7CC] bg-white hover:bg-[#FAF8F4] text-[#24211D] flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#9A783E]" /> Costing & Margin (.xls)
            </button>
            <button
              type="button"
              onClick={exportCsv}
              className="px-3 py-1.5 text-[11px] font-medium border border-[#DED7CC] bg-white hover:bg-[#FAF8F4] text-[#24211D] flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5 text-[#6B6258]" /> Export CSV
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-1.5 text-[11px] font-semibold bg-[#24211D] text-white hover:bg-[#3A352F] flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Printer className="w-3.5 h-3.5" /> Print / Save PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-[#6B6258] hover:text-[#24211D]"
              aria-label="Close document preview"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="p-6 sm:p-10 overflow-y-auto space-y-6 text-[#24211D] bg-white print:overflow-visible print:p-6">
          {/* Header Letterhead */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b-2 border-[#24211D]">
            <div className="flex flex-col items-start">
              <FragmoreLogo size="md" variant="gold" showTagline className="items-start text-left" />
              <div className="mt-2.5 text-[11px] text-[#6B6258] space-y-0.5 leading-relaxed">
                <p>FRAGMORÉ Perfumery House Pvt. Ltd. · Atelier & B2B Bespoke Gifting Division</p>
                <p>Lower Parel Luxury Atelier, Mumbai, Maharashtra 400013 · GSTIN: 27AABCF9182K1Z5</p>
                <p>concierge@fragmore.shop · https://fragmore.shop/</p>
              </div>
            </div>
            <div className="text-left sm:text-right space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9A783E]">
                {isProposal ? `COMMERCIAL PROPOSAL (${String(record.proposalType || '').replace(/_/g, ' ')})` : 'COMMERCIAL TAX QUOTATION'}
              </p>
              <p className="text-xl font-serif font-semibold text-[#24211D] tabular-nums">{docNumber}</p>
              <p className="text-xs text-[#6B6258] tabular-nums">
                Issue Date: {docDate || new Date().toISOString().slice(0, 10)} · Valid Until: {record.validUntil}
              </p>
              <p className="text-[11px] font-medium text-[#24211D]">
                Revision v{isProposal ? record.proposalVersionNumber || 1 : record.quotationVersionNumber || 1} · Status: {record.status}
              </p>
            </div>
          </div>

          {/* Client & Event Summary Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-2 border-b border-[#DED7CC] pb-5">
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A783E]">Prepared For</p>
              <p className="text-sm font-semibold text-[#24211D]">{clientName}</p>
              {isProposal && record.clientContactName && (
                <p className="text-xs text-[#4A433B]">Attn: {record.clientContactName}</p>
              )}
              <p className="text-xs text-[#6B6258]">{record.clientEmail}{record.clientPhone ? ` · ${record.clientPhone}` : ''}</p>
              {record.clientAddress && <p className="text-xs text-[#6B6258]">{record.clientAddress}</p>}
              <p className="text-[11px] text-[#4A433B]">
                Place of Supply: {record.placeOfSupplyState || 'Maharashtra'}
                {record.clientGstin ? ` · Client GSTIN: ${record.clientGstin}` : ''}
              </p>
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A783E]">
                {isProposal ? 'Scope & Event Brief' : 'Commercial Terms'}
              </p>
              {isProposal ? (
                <>
                  <p className="text-sm font-semibold text-[#24211D]">{record.title}</p>
                  <p className="text-xs text-[#4A433B] leading-relaxed">{record.scopeSummary}</p>
                  {record.customizationSpecs && (
                    <p className="text-[11px] text-[#6B6258]">
                      <span className="font-semibold text-[#24211D]">Customization:</span> {record.customizationSpecs}
                    </p>
                  )}
                  {record.eventRequirements?.eventDate && (
                    <p className="text-[11px] text-[#6B6258] tabular-nums">
                      Event Date: {record.eventRequirements.eventDate} · Guests/Units: {record.eventRequirements.guestCount || '—'} · City: {record.eventRequirements.city || record.placeOfSupplyState}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-xs text-[#4A433B]">
                    Tax Regime: {record.isInterState ? 'Inter-State IGST (18%)' : 'Intra-State CGST (9%) + SGST (9%)'}
                  </p>
                  <p className="text-xs text-[#4A433B]">Payment Terms: {record.paymentTerms}</p>
                  {record.notes && <p className="text-xs text-[#6B6258]">{record.notes}</p>}
                </>
              )}
            </div>
          </div>

          {/* Package Options (Proposals only) */}
          {isProposal && Array.isArray(record.packageOptions) && record.packageOptions.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A783E]">Curated Package Options</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {record.packageOptions.map((pkg: any, idx: number) => (
                  <div
                    key={idx}
                    className={`p-3 border ${
                      record.selectedPackageName === pkg.packageName || pkg.recommended
                        ? 'border-[#9A783E] bg-[#FAF8F4]'
                        : 'border-[#DED7CC] bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-[#24211D]">{pkg.packageName}</p>
                      <span className="text-xs font-semibold text-[#9A783E] tabular-nums">{fmt(pkg.subtotalInr)}</span>
                    </div>
                    <p className="text-[11px] text-[#6B6258] mt-1">{pkg.description}</p>
                    {(pkg.recommended || record.selectedPackageName === pkg.packageName) && (
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9A783E] mt-1">
                        {record.selectedPackageName === pkg.packageName ? 'Selected Tier' : 'Atelier Recommended'}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Product Line Items with FRAGMORÉ Flacon Visuals */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A783E]">
              Fragrance Selection & Line Breakdown
            </p>
            <div className="border border-[#DED7CC] overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#FAF8F4] border-b border-[#DED7CC] text-[10px] uppercase tracking-wider text-[#6B6258]">
                  <tr>
                    <th className="py-2.5 px-3">Flacon / SKU</th>
                    <th className="py-2.5 px-3">HSN</th>
                    <th className="py-2.5 px-3 text-right">Qty</th>
                    <th className="py-2.5 px-3 text-right">Net Rate (Ex-GST)</th>
                    <th className="py-2.5 px-3 text-right">GST %</th>
                    <th className="py-2.5 px-3 text-right">Line Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DED7CC]">
                  {lineItems.map((it: any, idx: number) => {
                    const cat = catBySku.get(String(it.sku || '').toUpperCase());
                    const slug = it.slug || cat?.slug || 'golden-hour';
                    const qty = Number(it.qty || 1);
                    const unitRate = Number(it.unitPriceInr || 0);
                    const amount = isProposal ? Number(it.totalInr || qty * unitRate) : Number(it.qty * unitRate);
                    return (
                      <tr key={idx} className="align-middle">
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-14 shrink-0 flex items-center justify-center bg-[#FAF8F4] border border-[#E5DEC9]">
                              <FragmoreBottleVisual
                                slug={slug}
                                name={it.description || cat?.name || 'Golden Hour'}
                                size={it.size || cat?.size || '50 ml'}
                                variant="card"
                                showGlow={false}
                                showShadow={false}
                                className="w-9 h-12"
                              />
                            </div>
                            <div>
                              <p className="font-semibold text-[#24211D]">{it.description}</p>
                              <p className="text-[10px] text-[#6B6258] font-mono">
                                SKU: {it.sku || 'CUSTOM'} · {it.size || cat?.size || '50 ml'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-[#6B6258]">{it.hsnCode || '33030050'}</td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">{qty}</td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">{fmt(unitRate)}</td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">{Number(it.gstRatePct ?? 18)}%</td>
                        <td className="py-2.5 px-3 text-right font-semibold font-mono tabular-nums">{fmt(amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Deliverables + Financial Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
            <div className="space-y-3">
              {isProposal && Array.isArray(record.deliverables) && record.deliverables.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A783E] mb-1.5">
                    Included Deliverables
                  </p>
                  <ul className="space-y-1 text-xs text-[#4A433B] list-disc pl-4">
                    {record.deliverables.map((d: string, i: number) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </div>
              )}

              {isProposal && Array.isArray(record.paymentMilestones) && record.paymentMilestones.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A783E] mb-1.5">
                    Payment Milestones
                  </p>
                  <div className="border border-[#DED7CC] divide-y divide-[#DED7CC] text-[11px]">
                    {record.paymentMilestones.map((m: any, i: number) => (
                      <div key={i} className="px-3 py-1.5 flex items-center justify-between gap-2">
                        <div>
                          <span className="font-semibold text-[#24211D]">{m.milestoneName}</span>
                          <span className="text-[#6B6258]"> · {m.triggerCondition}</span>
                        </div>
                        <span className="font-mono font-semibold tabular-nums whitespace-nowrap">
                          {m.pct}% ({fmt(m.amountInr || (grandTotal * m.pct) / 100)})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="border border-[#DED7CC] bg-[#FAF8F4] p-4 space-y-1.5 text-xs self-start">
              <div className="flex justify-between">
                <span className="text-[#6B6258]">Merchandise Subtotal</span>
                <span className="font-mono tabular-nums">{fmt(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-[#16A34A]">
                  <span>Privilege Discount</span>
                  <span className="font-mono tabular-nums">-{fmt(discount)}</span>
                </div>
              )}
              {setupCost > 0 && (
                <div className="flex justify-between">
                  <span className="text-[#6B6258]">Perfume Bar / Packaging Setup</span>
                  <span className="font-mono tabular-nums">{fmt(setupCost)}</span>
                </div>
              )}
              {staffingCost > 0 && (
                <div className="flex justify-between">
                  <span className="text-[#6B6258]">On-Site Mixologist Staffing</span>
                  <span className="font-mono tabular-nums">{fmt(staffingCost)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[#6B6258]">GST ({record.isInterState ? 'IGST 18%' : 'CGST 9% + SGST 9%'})</span>
                <span className="font-mono tabular-nums">{fmt(totalTax)}</span>
              </div>
              {freight > 0 && (
                <div className="flex justify-between">
                  <span className="text-[#6B6258]">Shipping & White-Glove Freight</span>
                  <span className="font-mono tabular-nums">{fmt(freight)}</span>
                </div>
              )}
              <div className="pt-2 mt-2 border-t border-[#DED7CC] flex justify-between text-sm font-semibold text-[#24211D]">
                <span>Total Payable Investment</span>
                <span className="font-mono tabular-nums text-[#9A783E]">{fmt(grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Terms & Client Acceptance / Authorised Signatory */}
          <div className="pt-4 border-t border-[#DED7CC] space-y-4">
            {isProposal && record.termsAndConditions && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A783E] mb-1">Terms & Conditions</p>
                <p className="text-[11px] text-[#6B6258] whitespace-pre-line leading-relaxed">{record.termsAndConditions}</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-3">
              <div className="border border-[#DED7CC] p-3.5 text-xs space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#9A783E]">
                  <ShieldCheck className="w-3.5 h-3.5" /> FRAGMORÉ Authorised Signatory
                </div>
                <p className="font-medium text-[#24211D] pt-2">Prepared By: {record.preparedByEmail || record.createdByEmail}</p>
                <p className="text-[11px] text-[#6B6258]">
                  Pricing Approval: {record.approvalStatus} {record.approvedByEmail ? `by ${record.approvedByEmail}` : ''}
                </p>
              </div>

              <div className="border border-[#DED7CC] p-3.5 text-xs space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#24211D]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" /> Client Acceptance & Sign-Off
                </div>
                {record.acceptedAt ? (
                  <>
                    <p className="font-semibold text-[#16A34A] pt-1">
                      Accepted by {record.acceptedByName} ({record.acceptedByEmail})
                    </p>
                    <p className="text-[11px] text-[#6B6258]">
                      Ref: {record.acceptanceRef || 'Digital Approval'} · {String(record.acceptedAt).slice(0, 10)}
                    </p>
                  </>
                ) : (
                  <div className="pt-4 text-[11px] text-[#8C8275] border-t border-dashed border-[#DED7CC] mt-3">
                    Client Signature, Designation & Company Stamp
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
