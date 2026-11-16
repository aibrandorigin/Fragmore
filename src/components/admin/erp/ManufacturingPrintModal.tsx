import React from 'react';
import { X, Printer, FileSpreadsheet } from 'lucide-react';
import { downloadExcelSpreadsheet } from '../../../lib/erpApi';

export type MfgPrintDoc =
  | { type: 'BMR'; batch: any; traceability: any; organization?: any }
  | { type: 'MOVEMENT_LEDGER'; movements: any[]; filterLabel: string; organization?: any }
  | { type: 'COST_SHEET'; batches: any[]; organization?: any }
  | { type: 'FINISHED_GOODS'; finishedGoods: any[]; organization?: any };

interface Props {
  doc: MfgPrintDoc | null;
  onClose: () => void;
}

export const ManufacturingPrintModal: React.FC<Props> = ({ doc, onClose }) => {
  if (!doc) return null;

  const orgName = doc.organization?.legalName || 'FRAGMORÉ HAUTE PARFUMERIE PRIVATE LIMITED';
  const orgGstin = doc.organization?.gstin || '27AABCF9482M1Z8';

  const handleExcelDownload = () => {
    if (doc.type === 'MOVEMENT_LEDGER') {
      downloadExcelSpreadsheet(
        'fragmore-inventory-movement-ledger.xls',
        'FRAGMORE Inventory Stock Movement Ledger',
        doc.movements.map((m) => ({
          MovementNumber: m.movementNumber,
          Date: m.movementDate,
          Category: m.stockCategory,
          Type: m.movementType,
          MaterialCode: m.materialCode || m.sku || '',
          MaterialName: m.materialName,
          LotNumber: m.lotNumber || '',
          BatchNumber: m.batchNumber || '',
          QtyDelta: m.qtyDelta,
          UOM: m.uom,
          BalanceBefore: m.balanceBefore,
          BalanceAfter: m.balanceAfter,
          UnitCostINR: m.unitCostInr,
          TotalCostINR: m.totalCostInr,
          WarehouseLoc: m.warehouseLocation || '',
          Reference: `${m.referenceType}:${m.referenceId}`,
          PerformedBy: m.performedByEmail,
          Reason: m.reason
        }))
      );
    } else if (doc.type === 'COST_SHEET') {
      downloadExcelSpreadsheet(
        'fragmore-production-cost-sheet.xls',
        'FRAGMORE Batch Production Cost Sheet',
        doc.batches.map((b) => ({
          BatchNumber: b.batchNumber,
          Product: b.productName,
          Size: b.size,
          Stage: b.pipelineStage || b.batchReleaseStatus,
          OnceCollection: b.isOnceCollection ? 'YES' : 'NO',
          PlannedQty: b.plannedBottlesCount || b.finishedQuantity,
          NetGoodBottles: b.finishedQuantity,
          RejectedBottles: b.rejectedBottlesCount || 0,
          ReworkBottles: b.reworkBottlesCount || 0,
          YieldVariancePct: b.yieldVariancePct || 0,
          MaterialCostINR: b.materialCostInr || 0,
          PackagingCostINR: b.packagingCostInr || 0,
          LabourCostINR: b.labourCostInr || 0,
          OverheadCostINR: b.overheadCostInr || 0,
          TotalBatchCostINR: b.actualTotalCostInr || 0,
          CostPerBottleINR: b.costPerBottleInr || 0
        }))
      );
    } else if (doc.type === 'FINISHED_GOODS') {
      downloadExcelSpreadsheet(
        'fragmore-finished-goods-report.xls',
        'FRAGMORE Finished Goods Warehouse Valuation Report',
        doc.finishedGoods.map((fg) => ({
          SKU: fg.sku,
          ProductName: fg.productName,
          Size: fg.size,
          BinLocation: fg.binLocation,
          BatchNumber: fg.batchNumber || '',
          OnHand: fg.quantityOnHand,
          Reserved: fg.quantityReserved,
          Available: fg.quantityAvailable,
          UnitMfgCostINR: fg.unitManufacturingCostInr,
          MRP_INR: fg.mrpInr,
          TotalCostValuationINR: Math.round((fg.quantityOnHand || 0) * (fg.unitManufacturingCostInr || 0)),
          Status: fg.status
        }))
      );
    } else if (doc.type === 'BMR') {
      const b = doc.batch;
      const trace = doc.traceability;
      const rows = (trace?.movements || []).map((m: any) => ({
        BatchNumber: b.batchNumber,
        Movement: m.movementNumber,
        StageOrType: m.movementType,
        Material: m.materialName,
        Lot: m.lotNumber || '',
        QtyDelta: m.qtyDelta,
        UOM: m.uom,
        CostINR: m.totalCostInr,
        Actor: m.performedByEmail,
        Notes: m.reason
      }));
      downloadExcelSpreadsheet(
        `BMR-${b.batchNumber}.xls`,
        `Batch Manufacturing Record — ${b.batchNumber}`,
        rows.length
          ? rows
          : [
              {
                BatchNumber: b.batchNumber,
                Product: b.productName,
                Size: b.size,
                Stage: b.pipelineStage,
                FinishedBottles: b.finishedQuantity,
                TotalCostINR: b.actualTotalCostInr,
                CostPerBottleINR: b.costPerBottleInr
              }
            ]
      );
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
    >
      <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="px-5 py-3 border-b border-[#DED7CC] bg-[#FAF8F4] flex items-center justify-between gap-3 print:hidden">
          <span className="font-mono text-xs uppercase font-bold text-[#24211D]">
            Atelier Document Preview · {doc.type.replace(/_/g, ' ')}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExcelDownload}
              className="px-3 py-1.5 border border-[#DED7CC] bg-[#FFFFFF] hover:border-[#9A783E] text-[#24211D] text-xs font-mono rounded flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#9A783E]" />
              <span>Export Excel (.xls)</span>
            </button>
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono rounded flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>
            <button onClick={onClose} className="p-1.5 text-[#686158] hover:text-[#24211D] cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 sm:p-8 text-xs text-[#24211D] space-y-5 bg-[#FFFFFF]">
          {/* Letterhead */}
          <div className="flex flex-wrap justify-between items-start border-b-2 border-[#24211D] pb-4 gap-4">
            <div>
              <h1 className="font-serif text-xl uppercase tracking-widest font-bold">{orgName}</h1>
              <p className="font-mono text-[11px] text-[#686158]">GSTIN: {orgGstin} · Haute Parfumerie Manufacturing &amp; Quality Vault</p>
            </div>
            <div className="text-right font-mono text-[11px]">
              <div className="font-bold text-[#9A783E]">GENERATED {new Date().toISOString().slice(0, 10)}</div>
              <div className="text-[#686158]">ISO / IFRA Batch Traceability Record</div>
            </div>
          </div>

          {doc.type === 'BMR' && (() => {
            const b = doc.batch;
            const tr = doc.traceability;
            const weighings: any[] = Array.isArray(b.weighingRecords) ? b.weighingRecords : [];
            const pkgList: any[] = Array.isArray(b.packagingConsumptions) ? b.packagingConsumptions : [];
            const events: any[] = tr?.events || [];
            return (
              <div className="space-y-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#FAF8F4] border border-[#DED7CC] p-4 rounded">
                  <div>
                    <span className="text-[10px] font-mono text-[#686158] uppercase block">Batch Number</span>
                    <span className="font-mono font-bold text-sm">{b.batchNumber}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-[#686158] uppercase block">Fragrance / SKU</span>
                    <span className="font-semibold">{b.productName} ({b.size}) · {b.sku}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-[#686158] uppercase block">Formula Version Lock</span>
                    <span className="font-mono">{b.lockedFormulaSnapshot?.formulaCode || 'MASTER'} v{b.lockedFormulaVersionNumber || 1}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-[#686158] uppercase block">Pipeline / QC</span>
                    <span className="font-mono font-bold">{b.pipelineStage} · {b.qcStatus}</span>
                  </div>
                </div>

                <div>
                  <h3 className="font-mono text-xs uppercase font-bold border-b border-[#DED7CC] pb-1 mb-2">
                    1. Ingredient Weighing &amp; Dispensing Records
                  </h3>
                  <table className="w-full border-collapse text-left text-[11px]">
                    <thead>
                      <tr className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono">
                        <th className="p-2">Material</th>
                        <th className="p-2">Lot #</th>
                        <th className="p-2">Planned</th>
                        <th className="p-2">Actual Weighed</th>
                        <th className="p-2">Variance</th>
                        <th className="p-2">Dispensed By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DED7CC]">
                      {weighings.length === 0 ? (
                        <tr><td colSpan={6} className="p-3 text-[#686158] font-mono">No weighing records logged yet.</td></tr>
                      ) : (
                        weighings.map((w, idx) => (
                          <tr key={idx}>
                            <td className="p-2 font-medium">{w.materialName}</td>
                            <td className="p-2 font-mono">{w.lotNumber}</td>
                            <td className="p-2 font-mono tabular-nums">{w.plannedQty} {w.uom}</td>
                            <td className="p-2 font-mono tabular-nums font-bold">{w.actualWeighedQty} {w.uom}</td>
                            <td className="p-2 font-mono tabular-nums">{w.varianceQty} ({w.variancePct}%)</td>
                            <td className="p-2 font-mono">{w.dispensedByEmail}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-mono text-xs uppercase font-bold border-b border-[#DED7CC] pb-1 mb-2">
                      2. Packaging Consumption &amp; Yield
                    </h3>
                    <table className="w-full text-[11px] border-collapse">
                      <thead>
                        <tr className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono">
                          <th className="p-1.5 text-left">Component</th>
                          <th className="p-1.5 text-left">Lot #</th>
                          <th className="p-1.5 text-right">Consumed</th>
                          <th className="p-1.5 text-right">Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#DED7CC]">
                        {pkgList.length === 0 ? (
                          <tr><td colSpan={4} className="p-2 text-[#686158] font-mono">Pending Packing stage.</td></tr>
                        ) : (
                          pkgList.map((p, idx) => (
                            <tr key={idx}>
                              <td className="p-1.5">{p.materialName}</td>
                              <td className="p-1.5 font-mono">{p.lotNumber}</td>
                              <td className="p-1.5 text-right font-mono tabular-nums">{p.actualQty} pcs</td>
                              <td className="p-1.5 text-right font-mono tabular-nums">₹{Number(p.totalCostInr || 0).toLocaleString('en-IN')}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="border border-[#DED7CC] p-4 rounded bg-[#FAF8F4] space-y-1.5 font-mono text-[11px]">
                    <h3 className="font-bold uppercase text-[#24211D] border-b border-[#DED7CC] pb-1 mb-2">
                      3. Batch Costing &amp; Bottle Yield Summary
                    </h3>
                    <div className="flex justify-between"><span>Planned / Net Good Bottles:</span><strong>{b.plannedBottlesCount || b.finishedQuantity} / {b.finishedQuantity}</strong></div>
                    <div className="flex justify-between"><span>Rejected / Reworked:</span><span>{b.rejectedBottlesCount || 0} / {b.reworkBottlesCount || 0}</span></div>
                    <div className="flex justify-between"><span>Material Cost:</span><span>₹{Number(b.materialCostInr || 0).toLocaleString('en-IN')}</span></div>
                    <div className="flex justify-between"><span>Packaging Cost:</span><span>₹{Number(b.packagingCostInr || 0).toLocaleString('en-IN')}</span></div>
                    <div className="flex justify-between"><span>Labour &amp; Overhead:</span><span>₹{Number((b.labourCostInr || 0) + (b.overheadCostInr || 0)).toLocaleString('en-IN')}</span></div>
                    <div className="flex justify-between border-t border-[#DED7CC] pt-1.5 font-bold text-[#9A783E]">
                      <span>Actual Total / Per Bottle:</span>
                      <span>₹{Number(b.actualTotalCostInr || 0).toLocaleString('en-IN')} (₹{Number(b.costPerBottleInr || 0).toLocaleString('en-IN')}/btl)</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-mono text-xs uppercase font-bold border-b border-[#DED7CC] pb-1 mb-2">
                    4. Stage Transition &amp; Sign-Off History
                  </h3>
                  <div className="space-y-1 font-mono text-[11px]">
                    {events.map((ev: any) => (
                      <div key={ev.id} className="flex justify-between border-b border-[#DED7CC]/60 py-1 gap-3">
                        <span><strong>[{ev.toStage}]</strong> {ev.summary}</span>
                        <span className="text-[#686158] shrink-0">{ev.performedByEmail}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          {doc.type === 'MOVEMENT_LEDGER' && (
            <div className="space-y-3">
              <div className="font-mono text-xs font-bold">
                INVENTORY STOCK MOVEMENT LEDGER — {doc.filterLabel} ({doc.movements.length} Entries)
              </div>
              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase">
                    <th className="p-2">Movement #</th>
                    <th className="p-2">Date</th>
                    <th className="p-2">Category</th>
                    <th className="p-2">Material / Lot</th>
                    <th className="p-2 text-right">Delta</th>
                    <th className="p-2 text-right">Before → After</th>
                    <th className="p-2 text-right">Value (₹)</th>
                    <th className="p-2">Ref / Actor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DED7CC]">
                  {doc.movements.map((m) => (
                    <tr key={m.id}>
                      <td className="p-2 font-mono font-semibold">{m.movementNumber}<span className="block text-[9px] text-[#686158]">{m.movementType}</span></td>
                      <td className="p-2 font-mono">{m.movementDate}</td>
                      <td className="p-2 font-mono">{m.stockCategory}</td>
                      <td className="p-2">{m.materialName}<span className="block font-mono text-[10px] text-[#686158]">{m.lotNumber || m.sku || ''}</span></td>
                      <td className={`p-2 text-right font-mono tabular-nums font-bold ${m.qtyDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {m.qtyDelta >= 0 ? `+${m.qtyDelta}` : m.qtyDelta} {m.uom}
                      </td>
                      <td className="p-2 text-right font-mono tabular-nums">{m.balanceBefore} → {m.balanceAfter}</td>
                      <td className="p-2 text-right font-mono tabular-nums">₹{Number(m.totalCostInr || 0).toLocaleString('en-IN')}</td>
                      <td className="p-2 font-mono text-[10px]">{m.referenceId}<span className="block text-[#686158]">{m.performedByEmail}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {doc.type === 'COST_SHEET' && (
            <div className="space-y-3">
              <div className="font-mono text-xs font-bold">PRODUCTION COST SHEETS ({doc.batches.length} Batches)</div>
              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase">
                    <th className="p-2">Batch #</th>
                    <th className="p-2">Product / Size</th>
                    <th className="p-2 text-right">Bottles</th>
                    <th className="p-2 text-right">Material ₹</th>
                    <th className="p-2 text-right">Packaging ₹</th>
                    <th className="p-2 text-right">Labour + OH ₹</th>
                    <th className="p-2 text-right">Total Cost ₹</th>
                    <th className="p-2 text-right">Cost / Bottle ₹</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DED7CC]">
                  {doc.batches.map((b) => (
                    <tr key={b.id}>
                      <td className="p-2 font-mono font-bold">{b.batchNumber}{b.isOnceCollection ? ' [ONCE]' : ''}</td>
                      <td className="p-2">{b.productName} ({b.size})<span className="block font-mono text-[10px] text-[#686158]">{b.pipelineStage || b.batchReleaseStatus}</span></td>
                      <td className="p-2 text-right font-mono tabular-nums">{b.finishedQuantity}</td>
                      <td className="p-2 text-right font-mono tabular-nums">₹{Number(b.materialCostInr || 0).toLocaleString('en-IN')}</td>
                      <td className="p-2 text-right font-mono tabular-nums">₹{Number(b.packagingCostInr || 0).toLocaleString('en-IN')}</td>
                      <td className="p-2 text-right font-mono tabular-nums">₹{Number((b.labourCostInr || 0) + (b.overheadCostInr || 0)).toLocaleString('en-IN')}</td>
                      <td className="p-2 text-right font-mono tabular-nums font-bold">₹{Number(b.actualTotalCostInr || 0).toLocaleString('en-IN')}</td>
                      <td className="p-2 text-right font-mono tabular-nums font-bold text-[#9A783E]">₹{Number(b.costPerBottleInr || 0).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {doc.type === 'FINISHED_GOODS' && (
            <div className="space-y-3">
              <div className="font-mono text-xs font-bold">FINISHED GOODS WAREHOUSE VALUATION REPORT ({doc.finishedGoods.length} SKUs)</div>
              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase">
                    <th className="p-2">SKU / Bin</th>
                    <th className="p-2">Product</th>
                    <th className="p-2">Batch #</th>
                    <th className="p-2 text-right">On Hand</th>
                    <th className="p-2 text-right">Available</th>
                    <th className="p-2 text-right">Unit Mfg Cost</th>
                    <th className="p-2 text-right">Total Valuation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DED7CC]">
                  {doc.finishedGoods.map((fg) => (
                    <tr key={fg.id}>
                      <td className="p-2 font-mono font-bold">{fg.sku}<span className="block text-[10px] text-[#686158]">{fg.binLocation}</span></td>
                      <td className="p-2">{fg.productName} ({fg.size})</td>
                      <td className="p-2 font-mono">{fg.batchNumber || '—'}</td>
                      <td className="p-2 text-right font-mono tabular-nums">{fg.quantityOnHand}</td>
                      <td className="p-2 text-right font-mono tabular-nums font-bold">{fg.quantityAvailable}</td>
                      <td className="p-2 text-right font-mono tabular-nums">₹{Number(fg.unitManufacturingCostInr || 0).toLocaleString('en-IN')}</td>
                      <td className="p-2 text-right font-mono tabular-nums font-bold text-[#9A783E]">
                        ₹{Math.round((fg.quantityOnHand || 0) * (fg.unitManufacturingCostInr || 0)).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
