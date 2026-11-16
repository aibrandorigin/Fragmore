import React, { useState, useEffect } from 'react';
import { X, Printer, FileSpreadsheet, ShieldCheck, RotateCcw } from 'lucide-react';
import { type ErpProcurementSnapshot } from '../../../lib/erpApi';

const fmtInr = (n: any) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

// 1. CREATE RFQ MODAL
export const CreateRfqModal: React.FC<{
  open: boolean;
  snapshot: ErpProcurementSnapshot;
  prefillPr?: any | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: any) => Promise<void>;
}> = ({ open, snapshot, prefillPr, busy, onClose, onSubmit }) => {
  const [title, setTitle] = useState('');
  const [targetSupplierIds, setTargetSupplierIds] = useState<string[]>([]);
  const [deliveryWarehouseId, setDeliveryWarehouseId] = useState('wh-mumbai-rm');
  const [responseDeadline, setResponseDeadline] = useState(new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    if (!open) return;
    if (prefillPr) {
      setTitle(`Tender for ${prefillPr.requisitionNumber} (${prefillPr.sourceDepartment})`);
      setItems(
        (prefillPr.items || []).map((it: any) => ({
          materialId: it.materialId || '',
          materialCode: it.materialCode || '',
          materialName: it.materialName,
          category: it.category || 'FRAGRANCE_OIL',
          qty: Number(it.qty || 1),
          unit: it.unit || 'units',
          targetUnitPriceInr: Number(it.estimatedUnitCostInr || 100)
        }))
      );
    } else {
      const m = snapshot.materials[0];
      setTitle('Perfumery Raw Material & Packaging Tender');
      setItems(
        m
          ? [{ materialId: m.id, materialCode: m.code, materialName: m.name, category: m.category, qty: 100, unit: m.uom, targetUnitPriceInr: m.unitCostInr }]
          : []
      );
    }
    setTargetSupplierIds(snapshot.suppliers.slice(0, 3).map((s) => s.id));
  }, [open, prefillPr, snapshot.suppliers, snapshot.materials]);

  if (!open) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl w-full max-w-2xl p-6 space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-[#DED7CC] pb-3">
          <div>
            <span className="font-mono text-[10px] uppercase text-[#9A783E]">Stage 02 · Vendor Tendering</span>
            <h3 className="font-serif text-xl uppercase text-[#24211D]">Issue Request For Quotation (RFQ)</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-[#686158] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await onSubmit({
              requisitionId: prefillPr?.id || undefined,
              title,
              targetSupplierIds,
              deliveryWarehouseId,
              responseDeadline,
              notes,
              items
            });
          }}
          className="space-y-4"
        >
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="RFQ Tender Title"
            className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4]"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-mono text-[10px] uppercase text-[#686158] block mb-1">Response Deadline</label>
              <input
                type="date"
                value={responseDeadline}
                onChange={(e) => setResponseDeadline(e.target.value)}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4] font-mono"
              />
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase text-[#686158] block mb-1">Delivery Warehouse</label>
              <select
                value={deliveryWarehouseId}
                onChange={(e) => setDeliveryWarehouseId(e.target.value)}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4]"
              >
                {snapshot.warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} · {w.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <span className="font-mono text-[10px] uppercase text-[#686158] block mb-1.5">
              Select Suppliers to Invite
            </span>
            <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto border border-[#DED7CC] p-2 rounded bg-[#FAF8F4]">
              {snapshot.suppliers.map((s) => {
                const selected = targetSupplierIds.includes(s.id);
                return (
                  <label key={s.id} className="flex items-center gap-2 font-mono text-[11px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() =>
                        setTargetSupplierIds((prev) =>
                          selected ? prev.filter((id) => id !== s.id) : [...prev, s.id]
                        )
                      }
                    />
                    <span className="truncate">{s.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="border-t border-[#DED7CC] pt-3 space-y-1.5">
            <span className="font-mono text-[10px] uppercase text-[#686158] block">RFQ Schedule Items ({items.length})</span>
            {items.map((it, idx) => (
              <div key={idx} className="flex justify-between font-mono text-[11px] bg-[#FAF8F4] px-3 py-1.5 rounded border border-[#DED7CC]">
                <span className="truncate">{it.materialName}</span>
                <span>
                  {it.qty} {it.unit} (Est {fmtInr(it.targetUnitPriceInr)})
                </span>
              </div>
            ))}
          </div>

          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Special quality, COA, or IFRA certification requirements..."
            className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4]"
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-[#DED7CC]">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-[#DED7CC] rounded font-mono cursor-pointer">
              Cancel
            </button>
            <button
              disabled={busy || !targetSupplierIds.length}
              type="submit"
              className="px-5 py-2 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] rounded font-mono cursor-pointer disabled:opacity-50"
            >
              {busy ? 'Issuing RFQ...' : 'Issue RFQ to Vendors'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 2. GRN QUALITY INSPECTION APPROVAL MODAL
export const GrnInspectModal: React.FC<{
  open: boolean;
  grn: any | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (grnId: string, payload: any) => Promise<void>;
}> = ({ open, grn, busy, onClose, onSubmit }) => {
  const [decision, setDecision] = useState<'PASSED' | 'PARTIAL_REJECTED' | 'FAILED'>('PASSED');
  const [gcmsMatchPct, setGcmsMatchPct] = useState(99.2);
  const [abvTestedPct, setAbvTestedPct] = useState(0);
  const [inspectionNotes, setInspectionNotes] = useState('IFRA / COA & visual defect checks passed.');
  const [itemsOverride, setItemsOverride] = useState<Array<{ materialId: string; materialName: string; receivedQty: number; acceptedQty: number; rejectedQty: number }>>([]);

  useEffect(() => {
    if (!open || !grn) return;
    setDecision('PASSED');
    setInspectionNotes('Physical count, packaging seal, and lab Olfactory/GC-MS verified.');
    setItemsOverride(
      (grn.items || []).map((it: any) => ({
        materialId: it.materialId,
        materialName: it.materialName,
        receivedQty: Number(it.receivedQty || 0),
        acceptedQty: Number(it.acceptedQty ?? it.receivedQty ?? 0),
        rejectedQty: Number(it.rejectedQty || 0)
      }))
    );
  }, [open, grn]);

  if (!open || !grn) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl w-full max-w-2xl p-6 space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-[#DED7CC] pb-3">
          <div>
            <span className="font-mono text-[10px] uppercase text-[#9A783E]">Stage 06 · Lab &amp; Physical QC Gate</span>
            <h3 className="font-serif text-xl uppercase text-[#24211D]">
              Quality Inspection · {grn.grnNumber}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-[#686158] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await onSubmit(grn.id, {
              decision,
              gcmsMatchPct,
              abvTestedPct,
              inspectionNotes,
              itemsOverride: itemsOverride.map((i) => ({
                materialId: i.materialId,
                acceptedQty: decision === 'FAILED' ? 0 : i.acceptedQty,
                rejectedQty: decision === 'FAILED' ? i.receivedQty : i.rejectedQty
              }))
            });
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-mono text-[10px] uppercase text-[#686158] block mb-1">QC Decision</label>
              <select
                value={decision}
                onChange={(e) => setDecision(e.target.value as any)}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4] font-mono"
              >
                <option value="PASSED">PASSED (Release Stock &amp; Post Lot)</option>
                <option value="PARTIAL_REJECTED">PARTIAL_REJECTED</option>
                <option value="FAILED">FAILED (Quarantine All)</option>
              </select>
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase text-[#686158] block mb-1">GC-MS Purity %</label>
              <input
                type="number"
                step="0.1"
                value={gcmsMatchPct}
                onChange={(e) => setGcmsMatchPct(Number(e.target.value))}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4] font-mono"
              />
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase text-[#686158] block mb-1">Alcohol ABV %</label>
              <input
                type="number"
                step="0.1"
                value={abvTestedPct}
                onChange={(e) => setAbvTestedPct(Number(e.target.value))}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4] font-mono"
              />
            </div>
          </div>

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                <th className="py-2">Material</th>
                <th className="py-2 text-right">Received</th>
                <th className="py-2 text-right">Accept Qty</th>
                <th className="py-2 text-right">Reject Qty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DED7CC]">
              {itemsOverride.map((it, idx) => (
                <tr key={idx}>
                  <td className="py-2 font-semibold">{it.materialName}</td>
                  <td className="py-2 text-right font-mono tabular-nums">{it.receivedQty}</td>
                  <td className="py-2 text-right">
                    <input
                      type="number"
                      min={0}
                      max={it.receivedQty}
                      disabled={decision === 'FAILED'}
                      value={decision === 'FAILED' ? 0 : it.acceptedQty}
                      onChange={(e) => {
                        const acc = Number(e.target.value);
                        const next = [...itemsOverride];
                        next[idx].acceptedQty = acc;
                        next[idx].rejectedQty = Math.max(0, next[idx].receivedQty - acc);
                        setItemsOverride(next);
                      }}
                      className="w-20 px-2 py-1 border border-[#DED7CC] rounded bg-[#FAF8F4] text-right font-mono tabular-nums"
                    />
                  </td>
                  <td className="py-2 text-right font-mono tabular-nums text-rose-700">
                    {decision === 'FAILED' ? it.receivedQty : it.rejectedQty}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <input
            required
            value={inspectionNotes}
            onChange={(e) => setInspectionNotes(e.target.value)}
            placeholder="Lab inspection remarks..."
            className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4]"
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-[#DED7CC]">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-[#DED7CC] rounded font-mono cursor-pointer">
              Cancel
            </button>
            <button
              disabled={busy}
              type="submit"
              className="px-5 py-2 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] rounded font-mono flex items-center gap-1.5 cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{busy ? 'Capitalizing Stock...' : 'Approve QC & Capitalize Inventory'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 3. SUPPLIER PAYMENT (ADVANCE OR INVOICE SETTLEMENT) MODAL
export const SupplierPaymentModal: React.FC<{
  open: boolean;
  snapshot: ErpProcurementSnapshot;
  mode: 'ADVANCE' | 'INVOICE';
  targetPo?: any | null;
  targetInvoice?: any | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: any) => Promise<void>;
}> = ({ open, snapshot, mode, targetPo, targetInvoice, busy, onClose, onSubmit }) => {
  const [supplierId, setSupplierId] = useState('');
  const [method, setMethod] = useState('NEFT');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [amountInr, setAmountInr] = useState(0);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    setReferenceNumber(`UTR-${Date.now().toString().slice(-6)}`);
    if (mode === 'INVOICE' && targetInvoice) {
      setSupplierId(targetInvoice.supplierId);
      setAmountInr(Number(targetInvoice.balanceDueInr || 0));
      setNotes(`Settlement for ${targetInvoice.supplierInvoiceNumber} (${targetInvoice.voucherNumber})`);
    } else if (mode === 'ADVANCE' && targetPo) {
      setSupplierId(targetPo.supplierId);
      setAmountInr(Math.round(Number(targetPo.totalCostInr || 0) * 0.3));
      setNotes(`Advance payment against PO ${targetPo.poNumber}`);
    } else {
      setSupplierId(snapshot.suppliers[0]?.id || '');
      setAmountInr(10000);
    }
  }, [open, mode, targetPo, targetInvoice, snapshot.suppliers]);

  if (!open) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4"
    >
      <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl w-full max-w-lg p-6 space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-[#DED7CC] pb-3">
          <div>
            <span className="font-mono text-[10px] uppercase text-[#9A783E]">Stage 08 · Treasury &amp; AP</span>
            <h3 className="font-serif text-xl uppercase text-[#24211D]">
              {mode === 'ADVANCE' ? 'Record Supplier Advance Prepayment' : 'Settle Supplier Invoice'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-[#686158] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await onSubmit({
              supplierId,
              vendorInvoiceId: targetInvoice?.id || undefined,
              purchaseOrderId: targetPo?.id || targetInvoice?.purchaseOrderId || undefined,
              isAdvance: mode === 'ADVANCE',
              expectedInvoiceVersion: targetInvoice?.version,
              method,
              referenceNumber,
              amountInr,
              notes
            });
          }}
          className="space-y-3"
        >
          <div className="font-mono bg-[#FAF8F4] border border-[#DED7CC] p-3 rounded text-[11px]">
            {mode === 'INVOICE' && targetInvoice ? (
              <div>
                Invoice: <span className="font-bold">{targetInvoice.voucherNumber}</span> · Balance Due:{' '}
                <span className="font-bold text-[#9A783E]">{fmtInr(targetInvoice.balanceDueInr)}</span>
              </div>
            ) : targetPo ? (
              <div>
                Purchase Order: <span className="font-bold">{targetPo.poNumber}</span> · Total:{' '}
                <span className="font-bold">{fmtInr(targetPo.totalCostInr)}</span>
              </div>
            ) : (
              <div>Direct Supplier Advance Payout (Posts Dr 1150 Supplier Advances / Cr 1010 Bank)</div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-mono text-[10px] uppercase text-[#686158] block mb-1">Mode</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4]"
              >
                <option value="NEFT">NEFT</option>
                <option value="RTGS">RTGS</option>
                <option value="IMPS">IMPS</option>
                <option value="WIRE_SWIFT">International Wire / SWIFT</option>
                <option value="UPI">UPI Corporate</option>
              </select>
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase text-[#686158] block mb-1">Amount (₹)</label>
              <input
                type="number"
                min={1}
                step="any"
                required
                value={amountInr}
                onChange={(e) => setAmountInr(Number(e.target.value))}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4] font-mono tabular-nums"
              />
            </div>
          </div>

          <input
            required
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
            placeholder="Bank UTR / Remittance Reference #"
            className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4] font-mono"
          />
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Payment narration"
            className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4]"
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-[#DED7CC]">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-[#DED7CC] rounded font-mono cursor-pointer">
              Cancel
            </button>
            <button
              disabled={busy}
              type="submit"
              className="px-5 py-2 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] rounded font-mono cursor-pointer"
            >
              {busy ? 'Posting Journal...' : mode === 'ADVANCE' ? 'Disburse Advance' : 'Post Payment & Clear AP'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 4. PURCHASE RETURN & DEBIT NOTE MODAL
export const DebitNoteModal: React.FC<{
  open: boolean;
  snapshot: ErpProcurementSnapshot;
  prefillInvoice?: any | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: any) => Promise<void>;
}> = ({ open, snapshot, prefillInvoice, busy, onClose, onSubmit }) => {
  const [supplierId, setSupplierId] = useState('');
  const [vendorInvoiceId, setVendorInvoiceId] = useState('');
  const [returnType, setReturnType] = useState<'QC_REJECTION' | 'DAMAGED_GOODS' | 'RATE_DIFFERENCE' | 'SHORT_SUPPLY'>('QC_REJECTION');
  const [reason, setReason] = useState('');
  const [materialId, setMaterialId] = useState('');
  const [materialName, setMaterialName] = useState('');
  const [returnQty, setReturnQty] = useState(5);
  const [unitPriceInr, setUnitPriceInr] = useState(185);

  useEffect(() => {
    if (!open) return;
    if (prefillInvoice) {
      setSupplierId(prefillInvoice.supplierId);
      setVendorInvoiceId(prefillInvoice.id);
      const it0 = prefillInvoice.items?.[0];
      setMaterialName(it0?.name || 'Damaged / Rejected Supply');
      setUnitPriceInr(Number(it0?.unitPriceInr || 500));
    } else {
      setSupplierId(snapshot.suppliers[0]?.id || '');
      setVendorInvoiceId('');
      const mat0 = snapshot.materials[0];
      setMaterialId(mat0?.id || '');
      setMaterialName(mat0?.name || '');
      setUnitPriceInr(Number(mat0?.unitCostInr || 185));
    }
    setReason('');
  }, [open, prefillInvoice, snapshot.suppliers, snapshot.materials]);

  if (!open) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4"
    >
      <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl w-full max-w-lg p-6 space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-[#DED7CC] pb-3">
          <div>
            <span className="font-mono text-[10px] uppercase text-[#9A783E]">Returns &amp; Reversals</span>
            <h3 className="font-serif text-xl uppercase text-[#24211D]">Issue Purchase Return / Debit Note</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-[#686158] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await onSubmit({
              supplierId,
              vendorInvoiceId: vendorInvoiceId || undefined,
              returnType,
              reason,
              items: [{ materialId: materialId || undefined, materialName, returnQty, unitPriceInr }]
            });
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-mono text-[10px] uppercase text-[#686158] block mb-1">Supplier</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4]"
              >
                {snapshot.suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase text-[#686158] block mb-1">Return Type</label>
              <select
                value={returnType}
                onChange={(e) => setReturnType(e.target.value as any)}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4]"
              >
                <option value="QC_REJECTION">QC_REJECTION (Deducts Stock + Reverses AP)</option>
                <option value="DAMAGED_GOODS">DAMAGED_GOODS (Deducts Stock + Reverses AP)</option>
                <option value="SHORT_SUPPLY">SHORT_SUPPLY (Financial AP Claim)</option>
                <option value="RATE_DIFFERENCE">RATE_DIFFERENCE (Credit Adjustment)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-mono text-[10px] uppercase text-[#686158] block mb-1">Material (for stock deduction)</label>
            <select
              value={materialId}
              onChange={(e) => {
                const m = snapshot.materials.find((x) => x.id === e.target.value);
                setMaterialId(e.target.value);
                if (m) {
                  setMaterialName(m.name);
                  setUnitPriceInr(Number(m.unitCostInr));
                }
              }}
              className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4]"
            >
              <option value="">Rate Difference / Non-Stock Claim</option>
              {snapshot.materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.code} · {m.name} (Stock: {m.currentStock})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <input
              required
              value={materialName}
              onChange={(e) => setMaterialName(e.target.value)}
              placeholder="Item Name"
              className="col-span-1 px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4]"
            />
            <input
              type="number"
              min={1}
              step="any"
              required
              value={returnQty}
              onChange={(e) => setReturnQty(Number(e.target.value))}
              placeholder="Qty"
              className="px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4] font-mono"
            />
            <input
              type="number"
              min={1}
              step="any"
              required
              value={unitPriceInr}
              onChange={(e) => setUnitPriceInr(Number(e.target.value))}
              placeholder="Unit Rate ₹"
              className="px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4] font-mono"
            />
          </div>

          <input
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Debit note justification (e.g. Chipped flacon rims on 12 cartons)"
            className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4]"
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-[#DED7CC]">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-[#DED7CC] rounded font-mono cursor-pointer">
              Cancel
            </button>
            <button
              disabled={busy}
              type="submit"
              className="px-5 py-2 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] rounded font-mono flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{busy ? 'Posting Debit Note...' : 'Issue Debit Note'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 5. CANCEL PO MODAL (REQUIRES REASON - ZERO window.prompt)
export const CancelPoModal: React.FC<{
  po: any | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (poId: string, reason: string) => Promise<void>;
}> = ({ po, busy, onClose, onConfirm }) => {
  const [reason, setReason] = useState('');
  if (!po) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4"
    >
      <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl w-full max-w-md p-6 space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-[#DED7CC] pb-3">
          <h3 className="font-serif text-lg uppercase text-rose-800">Cancel PO · {po.poNumber}</h3>
          <button onClick={onClose} className="p-1 text-[#686158] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[#686158]">
          Cancelling stops vendor dispatch and logs an immutable audit event. Enter a mandatory cancellation reason:
        </p>
        <input
          autoFocus
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Replaced by lower landed RFQ quotation / Production rescheduled"
          className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4]"
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border border-[#DED7CC] rounded font-mono cursor-pointer">
            Keep PO
          </button>
          <button
            disabled={busy || !reason.trim()}
            onClick={async () => {
              await onConfirm(po.id, reason);
              setReason('');
            }}
            className="px-4 py-2 bg-rose-700 text-white rounded font-mono cursor-pointer disabled:opacity-50"
          >
            {busy ? 'Cancelling...' : 'Confirm Cancellation'}
          </button>
        </div>
      </div>
    </div>
  );
};

// 6. SUPPLIER LEDGER DRAWER (STATEMENT + PERFORMANCE + BANK/GSTIN)
export const SupplierLedgerDrawer: React.FC<{
  supplier: any | null;
  snapshot: ErpProcurementSnapshot;
  onClose: () => void;
  onPrintLedger: (supplier: any, invoices: any[], debitNotes: any[], payments: any[]) => void;
  onExportLedgerExcel: (supplier: any, rows: any[]) => void;
}> = ({ supplier, snapshot, onClose, onPrintLedger, onExportLedgerExcel }) => {
  if (!supplier) return null;
  const sInvs = snapshot.vendorInvoices.filter((i) => i.supplierId === supplier.id);
  const sDns = snapshot.debitNotes.filter((d) => d.supplierId === supplier.id);
  const sPays = snapshot.vendorPayments.filter((p) => p.supplierId === supplier.id || p.partyName === supplier.name);

  const ledgerRows = [
    ...sInvs.map((i) => ({ Date: i.invoiceDate, Type: 'INVOICE', Ref: `${i.voucherNumber} (${i.supplierInvoiceNumber})`, Status: i.paymentStatus, AmountInr: i.totalAmountInr })),
    ...sDns.map((d) => ({ Date: d.issueDate, Type: 'DEBIT_NOTE', Ref: d.debitNoteNumber, Status: d.status, AmountInr: -d.totalDebitInr })),
    ...sPays.map((p) => ({ Date: p.paymentDate, Type: p.isAdvance ? 'ADVANCE' : 'PAYMENT', Ref: `${p.paymentNumber} (${p.referenceNumber})`, Status: p.status, AmountInr: -p.amountInr }))
  ].sort((a, b) => String(b.Date).localeCompare(String(a.Date)));

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-black/45 flex justify-end"
    >
      <div className="w-full max-w-2xl bg-[#FFFFFF] border-l border-[#DED7CC] h-full flex flex-col text-xs">
        <div className="px-6 py-4 border-b border-[#DED7CC] flex items-center justify-between">
          <div>
            <span className="font-mono text-[10px] uppercase text-[#9A783E]">
              {supplier.code} · Supplier Statutory &amp; Ledger Statement
            </span>
            <h3 className="font-serif text-xl uppercase text-[#24211D]">{supplier.legalName || supplier.name}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-[#686158] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 border border-[#DED7CC] divide-y sm:divide-y-0 sm:divide-x divide-[#DED7CC] rounded-lg font-mono">
            <div className="p-3">
              <span className="text-[10px] text-[#686158] uppercase block">Total Invoiced</span>
              <span className="font-bold text-sm tabular-nums">{fmtInr(supplier.ledgerSummary?.totalInvoicedInr)}</span>
            </div>
            <div className="p-3">
              <span className="text-[10px] text-[#686158] uppercase block">Advance Paid</span>
              <span className="font-bold text-sm tabular-nums">{fmtInr(supplier.ledgerSummary?.advancePaidInr)}</span>
            </div>
            <div className="p-3">
              <span className="text-[10px] text-[#686158] uppercase block">Debit Notes</span>
              <span className="font-bold text-sm tabular-nums">{fmtInr(supplier.ledgerSummary?.totalDebitNotesInr)}</span>
            </div>
            <div className="p-3 bg-[#FAF8F4]">
              <span className="text-[10px] text-[#9A783E] uppercase block">Net Payable</span>
              <span className="font-bold text-sm text-[#9A783E] tabular-nums">
                {fmtInr(supplier.ledgerSummary?.outstandingBalanceInr)}
              </span>
            </div>
          </div>

          <div className="border border-[#DED7CC] rounded-lg p-4 bg-[#FAF8F4] grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono text-[11px]">
            <div>
              <span className="text-[10px] text-[#686158] block">GSTIN / PAN</span>
              <span>{supplier.gstin || 'Unregistered'} · {supplier.pan || 'N/A'}</span>
            </div>
            <div>
              <span className="text-[10px] text-[#686158] block">Bank / IFSC</span>
              <span>{supplier.bankDetails?.bankName || '—'} · {supplier.bankDetails?.ifsc || '—'}</span>
            </div>
            <div>
              <span className="text-[10px] text-[#686158] block">SLA Performance</span>
              <span>
                {supplier.computedPerformance?.onTimeRatePct}% On-Time · {supplier.computedPerformance?.avgLeadTimeDays}d Avg · MOQ {supplier.moq}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => onPrintLedger(supplier, sInvs, sDns, sPays)}
              className="px-3 py-1.5 bg-[#24211D] text-[#FAF8F4] font-mono text-[11px] rounded flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" /> Print / PDF Ledger
            </button>
            <button
              onClick={() => onExportLedgerExcel(supplier, ledgerRows)}
              className="px-3 py-1.5 border border-[#DED7CC] bg-[#FFFFFF] font-mono text-[11px] rounded flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#9A783E]" /> Export Ledger Excel
            </button>
          </div>

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                <th className="py-2">Date</th>
                <th className="py-2">Type</th>
                <th className="py-2">Reference</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DED7CC]">
              {ledgerRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center font-mono text-[#686158]">
                    No posted invoices, debit notes, or payouts recorded yet for this supplier.
                  </td>
                </tr>
              ) : (
                ledgerRows.map((r, idx) => (
                  <tr key={idx}>
                    <td className="py-2 font-mono">{r.Date}</td>
                    <td className="py-2 font-mono text-[11px]">{r.Type}</td>
                    <td className="py-2 font-mono">{r.Ref}</td>
                    <td className={`py-2 text-right font-mono tabular-nums font-semibold ${Number(r.AmountInr) < 0 ? 'text-emerald-700' : 'text-[#24211D]'}`}>
                      {Number(r.AmountInr) < 0 ? `- ${fmtInr(Math.abs(r.AmountInr))}` : fmtInr(r.AmountInr)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
