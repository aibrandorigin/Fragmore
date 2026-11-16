import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Upload, FileText, AlertTriangle, ShieldCheck } from 'lucide-react';
import { type ErpProcurementSnapshot } from '../../../lib/erpApi';

const fmtInr = (n: any) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

// 1. SUPPLIER CREATE / EDIT MODAL
export const SupplierFormModal: React.FC<{
  open: boolean;
  initialSupplier: any | null;
  categories: Array<{ code: string; label: string }>;
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: any) => Promise<void>;
}> = ({ open, initialSupplier, categories, busy, onClose, onSubmit }) => {
  const [form, setForm] = useState<any>({
    name: '',
    legalName: '',
    tradeName: '',
    code: '',
    category: 'FRAGRANCE_OIL',
    gstin: '',
    pan: '',
    address: '',
    stateName: 'Maharashtra',
    contactPerson: '',
    email: '',
    phone: '',
    city: 'Mumbai',
    country: 'India',
    leadTimeDays: 14,
    moq: 100,
    paymentTerms: 'NET_30',
    rating: 'A_GRADE',
    status: 'ACTIVE',
    materialsSupplied: ['FRAGRANCE_OIL'],
    bankDetails: {
      bankName: 'HDFC Bank Corporate',
      accountHolder: '',
      accountNumberMasked: 'XXXX-XXXX-0000',
      ifsc: '',
      branch: 'Mumbai',
      upiId: ''
    },
    notes: ''
  });

  useEffect(() => {
    if (!open) return;
    if (initialSupplier) {
      setForm({
        id: initialSupplier.id,
        expectedVersion: initialSupplier.version,
        name: initialSupplier.name || '',
        legalName: initialSupplier.legalName || initialSupplier.name || '',
        tradeName: initialSupplier.tradeName || initialSupplier.name || '',
        code: initialSupplier.code || '',
        category: initialSupplier.category || 'FRAGRANCE_OIL',
        gstin: initialSupplier.gstin || '',
        pan: initialSupplier.pan || '',
        address: initialSupplier.address || '',
        stateName: initialSupplier.stateName || 'Maharashtra',
        contactPerson: initialSupplier.contactPerson || '',
        email: initialSupplier.email || '',
        phone: initialSupplier.phone || '',
        city: initialSupplier.city || '',
        country: initialSupplier.country || 'India',
        leadTimeDays: Number(initialSupplier.leadTimeDays || 14),
        moq: Number(initialSupplier.moq || 1),
        paymentTerms: initialSupplier.paymentTerms || 'NET_30',
        rating: initialSupplier.rating || 'A_GRADE',
        status: initialSupplier.status || 'ACTIVE',
        materialsSupplied: Array.isArray(initialSupplier.materialsSupplied) ? initialSupplier.materialsSupplied : [initialSupplier.category || 'FRAGRANCE_OIL'],
        bankDetails: {
          bankName: initialSupplier.bankDetails?.bankName || '',
          accountHolder: initialSupplier.bankDetails?.accountHolder || initialSupplier.legalName || '',
          accountNumberMasked: initialSupplier.bankDetails?.accountNumberMasked || '',
          ifsc: initialSupplier.bankDetails?.ifsc || '',
          branch: initialSupplier.bankDetails?.branch || '',
          upiId: initialSupplier.bankDetails?.upiId || ''
        },
        notes: initialSupplier.notes || ''
      });
    } else {
      setForm({
        name: '',
        legalName: '',
        tradeName: '',
        code: '',
        category: 'FRAGRANCE_OIL',
        gstin: '',
        pan: '',
        address: '',
        stateName: 'Maharashtra',
        contactPerson: '',
        email: '',
        phone: '+91 ',
        city: 'Mumbai',
        country: 'India',
        leadTimeDays: 14,
        moq: 100,
        paymentTerms: 'NET_30',
        rating: 'A_GRADE',
        status: 'ACTIVE',
        materialsSupplied: ['FRAGRANCE_OIL'],
        bankDetails: {
          bankName: 'HDFC Corporate',
          accountHolder: '',
          accountNumberMasked: 'XXXX-XXXX-',
          ifsc: '',
          branch: '',
          upiId: ''
        },
        notes: ''
      });
    }
  }, [open, initialSupplier]);

  if (!open) return null;

  const toggleCategory = (code: string) => {
    setForm((prev: any) => {
      const exists = prev.materialsSupplied.includes(code);
      const next = exists
        ? prev.materialsSupplied.filter((c: string) => c !== code)
        : [...prev.materialsSupplied, code];
      return { ...prev, materialsSupplied: next.length ? next : [prev.category] };
    });
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-5 text-xs">
        <div className="flex items-center justify-between border-b border-[#DED7CC] pb-3">
          <div>
            <span className="font-mono text-[10px] uppercase text-[#9A783E]">Vendor Registry Master</span>
            <h3 className="font-serif text-xl uppercase text-[#24211D]">
              {initialSupplier ? `Edit Supplier · ${initialSupplier.code}` : 'Onboard New Supplier'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-[#686158] hover:text-[#24211D] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await onSubmit(form);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-mono text-[10px] uppercase text-[#686158] block mb-1">Display Name *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4]"
                placeholder="e.g. Firmenich Aromatics India"
              />
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase text-[#686158] block mb-1">Legal Entity Name</label>
              <input
                value={form.legalName}
                onChange={(e) => setForm({ ...form, legalName: e.target.value })}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4]"
                placeholder="Pvt. Ltd. / LLP Registered Name"
              />
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase text-[#686158] block mb-1">Trade Name / Brand</label>
              <input
                value={form.tradeName}
                onChange={(e) => setForm({ ...form, tradeName: e.target.value })}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="font-mono text-[10px] uppercase text-[#686158] block mb-1">GSTIN</label>
              <input
                value={form.gstin}
                onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4] font-mono"
                placeholder="27AAAAA0000A1Z5"
              />
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase text-[#686158] block mb-1">PAN</label>
              <input
                value={form.pan}
                onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4] font-mono"
                placeholder="AAAAA0000A"
              />
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase text-[#686158] block mb-1">State (GST Regime)</label>
              <input
                value={form.stateName}
                onChange={(e) => setForm({ ...form, stateName: e.target.value })}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4]"
              />
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase text-[#686158] block mb-1">Primary Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4]"
              >
                {categories.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="font-mono text-[10px] uppercase text-[#686158] block mb-1">Contact Person *</label>
              <input
                required
                value={form.contactPerson}
                onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4]"
              />
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase text-[#686158] block mb-1">Email *</label>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4]"
              />
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase text-[#686158] block mb-1">Phone</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4] font-mono"
              />
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase text-[#686158] block mb-1">City &amp; Country</label>
              <div className="flex gap-1.5">
                <input
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="w-1/2 px-2 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4]"
                  placeholder="City"
                />
                <input
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                  className="w-1/2 px-2 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4]"
                  placeholder="Country"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="font-mono text-[10px] uppercase text-[#686158] block mb-1">Registered Address</label>
              <input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4]"
              />
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase text-[#686158] block mb-1">Lead Time (Days) / MOQ</label>
              <div className="flex gap-1.5">
                <input
                  type="number"
                  min={1}
                  value={form.leadTimeDays}
                  onChange={(e) => setForm({ ...form, leadTimeDays: Number(e.target.value) })}
                  className="w-1/2 px-2 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4] font-mono tabular-nums"
                  title="Lead Time Days"
                />
                <input
                  type="number"
                  min={1}
                  value={form.moq}
                  onChange={(e) => setForm({ ...form, moq: Number(e.target.value) })}
                  className="w-1/2 px-2 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4] font-mono tabular-nums"
                  title="MOQ"
                />
              </div>
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase text-[#686158] block mb-1">Payment Terms</label>
              <select
                value={form.paymentTerms}
                onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4]"
              >
                <option value="NET_15">NET_15</option>
                <option value="NET_30">NET_30</option>
                <option value="NET_45">NET_45</option>
                <option value="NET_60">NET_60</option>
                <option value="ADVANCE_50_BALANCE_DISPATCH">50% Advance / Balance Dispatch</option>
                <option value="100_ADVANCE">100% Advance</option>
              </select>
            </div>
          </div>

          <div className="border-t border-[#DED7CC] pt-3">
            <span className="font-mono text-[10px] uppercase text-[#9A783E] block mb-2">
              Bank Remittance Details
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input
                value={form.bankDetails.bankName}
                onChange={(e) =>
                  setForm({ ...form, bankDetails: { ...form.bankDetails, bankName: e.target.value } })
                }
                placeholder="Bank Name"
                className="px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4]"
              />
              <input
                value={form.bankDetails.accountHolder}
                onChange={(e) =>
                  setForm({ ...form, bankDetails: { ...form.bankDetails, accountHolder: e.target.value } })
                }
                placeholder="Beneficiary Name"
                className="px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4]"
              />
              <input
                value={form.bankDetails.accountNumberMasked}
                onChange={(e) =>
                  setForm({ ...form, bankDetails: { ...form.bankDetails, accountNumberMasked: e.target.value } })
                }
                placeholder="Account Number / Masked"
                className="px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4] font-mono"
              />
              <input
                value={form.bankDetails.ifsc}
                onChange={(e) =>
                  setForm({ ...form, bankDetails: { ...form.bankDetails, ifsc: e.target.value.toUpperCase() } })
                }
                placeholder="IFSC / SWIFT"
                className="px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4] font-mono"
              />
            </div>
          </div>

          <div className="border-t border-[#DED7CC] pt-3">
            <span className="font-mono text-[10px] uppercase text-[#686158] block mb-2">
              Supplied Material Categories (13 Standard Classifications)
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {categories.map((cat) => {
                const active = form.materialsSupplied.includes(cat.code);
                return (
                  <button
                    type="button"
                    key={cat.code}
                    onClick={() => toggleCategory(cat.code)}
                    className={`px-2.5 py-1.5 text-left text-[11px] font-mono rounded border transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#24211D] text-[#FAF8F4] border-[#24211D]'
                        : 'bg-[#FAF8F4] text-[#686158] border-[#DED7CC] hover:border-[#9A783E]'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#DED7CC]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-[#DED7CC] rounded font-mono text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              disabled={busy}
              type="submit"
              className="px-5 py-2 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] rounded font-mono text-xs cursor-pointer disabled:opacity-50"
            >
              {busy ? 'Saving...' : initialSupplier ? 'Save Supplier Changes' : 'Create Supplier Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 2. PURCHASE REQUISITION MODAL
export const PurchaseRequisitionModal: React.FC<{
  open: boolean;
  snapshot: ErpProcurementSnapshot;
  prefillItem?: any | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: any) => Promise<void>;
}> = ({ open, snapshot, prefillItem, busy, onClose, onSubmit }) => {
  const [sourceDepartment, setSourceDepartment] = useState<'PRODUCTION' | 'INVENTORY' | 'RD' | 'OPERATIONS'>('PRODUCTION');
  const [priority, setPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'>('HIGH');
  const [linkedBatchId, setLinkedBatchId] = useState('');
  const [requiredByDate, setRequiredByDate] = useState(new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<any[]>([
    { materialId: '', materialCode: '', materialName: '', category: 'FRAGRANCE_OIL', qty: 10, unit: 'kg', estimatedUnitCostInr: 4500 }
  ]);

  useEffect(() => {
    if (!open) return;
    if (prefillItem) {
      setSourceDepartment(prefillItem.source === 'PRODUCTION_PLANNING' ? 'PRODUCTION' : 'INVENTORY');
      setLinkedBatchId(prefillItem.batchId || '');
      setPriority(prefillItem.severity === 'CRITICAL' ? 'URGENT' : 'HIGH');
      setNotes(prefillItem.reason || 'Replenishment requisition from low-stock alert.');
      setItems([
        {
          materialId: prefillItem.materialId || '',
          materialCode: prefillItem.code || '',
          materialName: prefillItem.name || '',
          category: prefillItem.category || 'FRAGRANCE_OIL',
          qty: Number(prefillItem.recommendedOrderQty || 100),
          unit: prefillItem.unit || 'units',
          estimatedUnitCostInr: Number(prefillItem.estimatedUnitCostInr || 100)
        }
      ]);
    } else if (snapshot.materials.length) {
      const m = snapshot.materials[0];
      setItems([
        {
          materialId: m.id,
          materialCode: m.code,
          materialName: m.name,
          category: m.category,
          qty: 50,
          unit: m.uom,
          estimatedUnitCostInr: m.unitCostInr
        }
      ]);
    }
  }, [open, prefillItem, snapshot.materials]);

  if (!open) return null;
  const estTotal = items.reduce((s, it) => s + Number(it.qty || 0) * Number(it.estimatedUnitCostInr || 0), 0);

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-[#DED7CC] pb-3">
          <div>
            <span className="font-mono text-[10px] uppercase text-[#9A783E]">Stage 01 · Demand Intake</span>
            <h3 className="font-serif text-xl uppercase text-[#24211D]">Raise Purchase Requisition (PR)</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-[#686158] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await onSubmit({
              sourceDepartment,
              priority,
              linkedBatchId: linkedBatchId || undefined,
              requiredByDate,
              notes,
              items
            });
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="font-mono text-[10px] uppercase text-[#686158] block mb-1">Requesting Dept</label>
              <select
                value={sourceDepartment}
                onChange={(e) => setSourceDepartment(e.target.value as any)}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4]"
              >
                <option value="PRODUCTION">PRODUCTION</option>
                <option value="INVENTORY">INVENTORY</option>
                <option value="RD">RD / LAB</option>
                <option value="OPERATIONS">OPERATIONS</option>
              </select>
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase text-[#686158] block mb-1">Linked Production Batch</label>
              <select
                value={linkedBatchId}
                onChange={(e) => setLinkedBatchId(e.target.value)}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4]"
              >
                <option value="">General Stock Replenishment</option>
                {snapshot.batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.batchNumber} · {b.productName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase text-[#686158] block mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4]"
              >
                <option value="NORMAL">NORMAL</option>
                <option value="HIGH">HIGH</option>
                <option value="URGENT">URGENT</option>
                <option value="LOW">LOW</option>
              </select>
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase text-[#686158] block mb-1">Required By Date</label>
              <input
                type="date"
                value={requiredByDate}
                onChange={(e) => setRequiredByDate(e.target.value)}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4] font-mono"
              />
            </div>
          </div>

          <div className="space-y-2 border-t border-[#DED7CC] pt-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase text-[#9A783E]">Requisition Line Items</span>
              <button
                type="button"
                onClick={() =>
                  setItems([
                    ...items,
                    { materialId: '', materialCode: '', materialName: '', category: 'FRAGRANCE_OIL', qty: 10, unit: 'units', estimatedUnitCostInr: 100 }
                  ])
                }
                className="text-xs font-mono text-[#9A783E] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Line
              </button>
            </div>
            {items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-[#FAF8F4] p-2 rounded border border-[#DED7CC]">
                <select
                  className="col-span-4 px-2 py-1.5 border border-[#DED7CC] rounded bg-[#FFFFFF]"
                  value={it.materialId}
                  onChange={(e) => {
                    const mat = snapshot.materials.find((m) => m.id === e.target.value);
                    const next = [...items];
                    if (mat) {
                      next[idx] = {
                        ...next[idx],
                        materialId: mat.id,
                        materialCode: mat.code,
                        materialName: mat.name,
                        category: mat.category,
                        unit: mat.uom,
                        estimatedUnitCostInr: mat.unitCostInr
                      };
                    } else {
                      next[idx].materialId = '';
                    }
                    setItems(next);
                  }}
                >
                  <option value="">Custom Item / Equipment</option>
                  {snapshot.materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.code} · {m.name}
                    </option>
                  ))}
                </select>
                <input
                  required
                  placeholder="Material / Item Description"
                  value={it.materialName}
                  onChange={(e) => {
                    const next = [...items];
                    next[idx].materialName = e.target.value;
                    setItems(next);
                  }}
                  className="col-span-3 px-2 py-1.5 border border-[#DED7CC] rounded bg-[#FFFFFF]"
                />
                <input
                  type="number"
                  min={1}
                  step="any"
                  value={it.qty}
                  onChange={(e) => {
                    const next = [...items];
                    next[idx].qty = Number(e.target.value);
                    setItems(next);
                  }}
                  className="col-span-2 px-2 py-1.5 border border-[#DED7CC] rounded bg-[#FFFFFF] font-mono tabular-nums"
                  placeholder="Qty"
                />
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={it.estimatedUnitCostInr}
                  onChange={(e) => {
                    const next = [...items];
                    next[idx].estimatedUnitCostInr = Number(e.target.value);
                    setItems(next);
                  }}
                  className="col-span-2 px-2 py-1.5 border border-[#DED7CC] rounded bg-[#FFFFFF] font-mono tabular-nums"
                  placeholder="Est ₹"
                />
                <button
                  type="button"
                  disabled={items.length === 1}
                  onClick={() => setItems(items.filter((_, i) => i !== idx))}
                  className="col-span-1 flex justify-center text-rose-700 disabled:opacity-30 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Operational justification or batch notes..."
            className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4]"
          />

          <div className="flex items-center justify-between pt-3 border-t border-[#DED7CC]">
            <div className="font-mono text-[#686158]">
              Estimated PR Value: <span className="font-bold text-[#24211D]">{fmtInr(estTotal)}</span>
              {estTotal > 100000 && <span className="text-[#9A783E] ml-2">(Routes to Super Admin approval if non-admin)</span>}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 border border-[#DED7CC] rounded font-mono cursor-pointer">
                Cancel
              </button>
              <button
                disabled={busy}
                type="submit"
                className="px-5 py-2 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] rounded font-mono cursor-pointer"
              >
                {busy ? 'Submitting...' : 'Submit Purchase Requisition'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

// 3. MULTI-LINE PURCHASE ORDER MODAL
export const PurchaseOrderFormModal: React.FC<{
  open: boolean;
  snapshot: ErpProcurementSnapshot;
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: any) => Promise<void>;
}> = ({ open, snapshot, busy, onClose, onSubmit }) => {
  const [supplierId, setSupplierId] = useState(snapshot.suppliers[0]?.id || '');
  const [warehouseId, setWarehouseId] = useState(snapshot.warehouses[0]?.id || 'wh-mumbai-rm');
  const [expectedDeliveryDays, setExpectedDeliveryDays] = useState(14);
  const [shippingInr, setShippingInr] = useState(1800);
  const [paymentTerms, setPaymentTerms] = useState('NET_30');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<any[]>([
    { materialId: '', sku: '', name: '', category: 'FRAGRANCE_OIL', quantity: 100, unit: 'units', unitPriceInr: 185, taxPct: 18 }
  ]);

  useEffect(() => {
    if (!open) return;
    const s = snapshot.suppliers[0];
    if (s && !supplierId) {
      setSupplierId(s.id);
      setExpectedDeliveryDays(Number(s.leadTimeDays || 14));
      setPaymentTerms(s.paymentTerms || 'NET_30');
    }
    const m = snapshot.materials[0];
    if (m) {
      setItems([
        {
          materialId: m.id,
          sku: m.code,
          name: m.name,
          category: m.category,
          quantity: Math.max(10, Number(m.reorderLevel || 50)),
          unit: m.uom,
          unitPriceInr: Number(m.unitCostInr || 100),
          taxPct: Number(m.gstRatePct || 18)
        }
      ]);
    }
  }, [open, snapshot.suppliers, snapshot.materials]);

  if (!open) return null;

  const subtotal = items.reduce((s, it) => s + Number(it.quantity || 0) * Number(it.unitPriceInr || 0), 0);
  const gst = Math.round(items.reduce((s, it) => s + (Number(it.quantity || 0) * Number(it.unitPriceInr || 0) * Number(it.taxPct ?? 18)) / 100, 0));
  const grandTotal = Math.round(subtotal + gst + Number(shippingInr || 0));
  const thresholdLabel =
    grandTotal > 200000
      ? 'Tier > ₹2,00,000 (Requires Super Admin Approval)'
      : grandTotal > 50000
      ? 'Tier ₹50k–₹2L (Requires Finance Controller Sign-off)'
      : 'Tier ≤ ₹50,000 (Standard Auto-Authorized)';

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-[#DED7CC] pb-3">
          <div>
            <span className="font-mono text-[10px] uppercase text-[#9A783E]">Stage 04 · Order Release</span>
            <h3 className="font-serif text-xl uppercase text-[#24211D]">Generate Purchase Order</h3>
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
              warehouseId,
              expectedDeliveryDays,
              shippingInr,
              paymentTerms,
              notes,
              items
            });
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="font-mono text-[10px] uppercase text-[#686158] block mb-1">Supplier *</label>
              <select
                required
                value={supplierId}
                onChange={(e) => {
                  const s = snapshot.suppliers.find((x) => x.id === e.target.value);
                  setSupplierId(e.target.value);
                  if (s) {
                    setExpectedDeliveryDays(s.leadTimeDays || 14);
                    setPaymentTerms(s.paymentTerms || 'NET_30');
                  }
                }}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4]"
              >
                {snapshot.suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} · {s.name} ({s.stateName || 'MH'})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase text-[#686158] block mb-1">Receiving Warehouse</label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4]"
              >
                {snapshot.warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} · {w.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase text-[#686158] block mb-1">Lead Days &amp; Freight (₹)</label>
              <div className="flex gap-1.5">
                <input
                  type="number"
                  min={1}
                  value={expectedDeliveryDays}
                  onChange={(e) => setExpectedDeliveryDays(Number(e.target.value))}
                  className="w-1/2 px-2 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4] font-mono"
                />
                <input
                  type="number"
                  min={0}
                  value={shippingInr}
                  onChange={(e) => setShippingInr(Number(e.target.value))}
                  className="w-1/2 px-2 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4] font-mono"
                />
              </div>
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase text-[#686158] block mb-1">Payment Terms</label>
              <select
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4]"
              >
                <option value="NET_15">NET_15</option>
                <option value="NET_30">NET_30</option>
                <option value="NET_45">NET_45</option>
                <option value="ADVANCE_50_BALANCE_DISPATCH">50% Advance</option>
                <option value="100_ADVANCE">100% Advance</option>
              </select>
            </div>
          </div>

          <div className="space-y-2 border-t border-[#DED7CC] pt-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase text-[#9A783E]">Editable PO Line Items</span>
              <button
                type="button"
                onClick={() =>
                  setItems([
                    ...items,
                    { materialId: '', sku: 'MAT-CUSTOM', name: '', category: 'MISC_SUPPLIES', quantity: 50, unit: 'units', unitPriceInr: 100, taxPct: 18 }
                  ])
                }
                className="font-mono text-xs text-[#9A783E] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add PO Line
              </button>
            </div>
            {items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-[#FAF8F4] p-2 rounded border border-[#DED7CC]">
                <select
                  className="col-span-3 px-2 py-1.5 border border-[#DED7CC] rounded bg-[#FFFFFF]"
                  value={it.materialId}
                  onChange={(e) => {
                    const mat = snapshot.materials.find((m) => m.id === e.target.value);
                    const next = [...items];
                    if (mat) {
                      next[idx] = {
                        ...next[idx],
                        materialId: mat.id,
                        sku: mat.code,
                        name: mat.name,
                        category: mat.category,
                        unit: mat.uom,
                        unitPriceInr: mat.unitCostInr,
                        taxPct: mat.gstRatePct || 18
                      };
                    } else {
                      next[idx].materialId = '';
                    }
                    setItems(next);
                  }}
                >
                  <option value="">Custom Item</option>
                  {snapshot.materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.code} · {m.name}
                    </option>
                  ))}
                </select>
                <input
                  required
                  value={it.name}
                  placeholder="Item Name"
                  onChange={(e) => {
                    const next = [...items];
                    next[idx].name = e.target.value;
                    setItems(next);
                  }}
                  className="col-span-3 px-2 py-1.5 border border-[#DED7CC] rounded bg-[#FFFFFF]"
                />
                <input
                  type="number"
                  min={1}
                  step="any"
                  value={it.quantity}
                  onChange={(e) => {
                    const next = [...items];
                    next[idx].quantity = Number(e.target.value);
                    setItems(next);
                  }}
                  className="col-span-2 px-2 py-1.5 border border-[#DED7CC] rounded bg-[#FFFFFF] font-mono tabular-nums"
                  title="Quantity"
                />
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={it.unitPriceInr}
                  onChange={(e) => {
                    const next = [...items];
                    next[idx].unitPriceInr = Number(e.target.value);
                    setItems(next);
                  }}
                  className="col-span-2 px-2 py-1.5 border border-[#DED7CC] rounded bg-[#FFFFFF] font-mono tabular-nums"
                  title="Unit Rate"
                />
                <input
                  type="number"
                  min={0}
                  max={28}
                  value={it.taxPct}
                  onChange={(e) => {
                    const next = [...items];
                    next[idx].taxPct = Number(e.target.value);
                    setItems(next);
                  }}
                  className="col-span-1 px-1.5 py-1.5 border border-[#DED7CC] rounded bg-[#FFFFFF] font-mono tabular-nums"
                  title="GST %"
                />
                <button
                  type="button"
                  disabled={items.length === 1}
                  onClick={() => setItems(items.filter((_, i) => i !== idx))}
                  className="col-span-1 flex justify-center text-rose-700 disabled:opacity-30 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Packing instructions, COA certificate mandate, delivery instructions..."
            className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4]"
          />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#DED7CC]">
            <div className="font-mono space-y-0.5 tabular-nums">
              <div>
                Subtotal: {fmtInr(subtotal)} · GST: {fmtInr(gst)} · Freight: {fmtInr(shippingInr)} ·{' '}
                <span className="font-bold text-[#9A783E]">Total: {fmtInr(grandTotal)}</span>
              </div>
              <div className="text-[11px] text-[#686158] flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#9A783E]" />
                <span>{thresholdLabel}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 border border-[#DED7CC] rounded font-mono cursor-pointer">
                Cancel
              </button>
              <button
                disabled={busy}
                type="submit"
                className="px-5 py-2 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] rounded font-mono cursor-pointer"
              >
                {busy ? 'Issuing PO...' : 'Release Purchase Order'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

// 4. SUPPLIER QUOTATION MODAL (FOR RFQ COMPARATIVE STATEMENT)
export const SupplierQuotationModal: React.FC<{
  open: boolean;
  rfq: any | null;
  suppliers: any[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: any) => Promise<void>;
}> = ({ open, rfq, suppliers, busy, onClose, onSubmit }) => {
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || '');
  const [vendorRefNumber, setVendorRefNumber] = useState('');
  const [deliveryDays, setDeliveryDays] = useState(10);
  const [freightInr, setFreightInr] = useState(2500);
  const [paymentTerms, setPaymentTerms] = useState('NET_30');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    if (!open || !rfq) return;
    setSupplierId(suppliers[0]?.id || '');
    setItems(
      (rfq.items || []).map((it: any) => ({
        materialId: it.materialId || '',
        materialName: it.materialName,
        category: it.category || 'FRAGRANCE_OIL',
        qty: Number(it.qty || 1),
        unit: it.unit || 'units',
        unitPriceInr: Number(it.targetUnitPriceInr || 100),
        taxPct: 18
      }))
    );
  }, [open, rfq, suppliers]);

  if (!open || !rfq) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl w-full max-w-3xl p-6 space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-[#DED7CC] pb-3">
          <div>
            <span className="font-mono text-[10px] uppercase text-[#9A783E]">Stage 03 · Comparative Bidding</span>
            <h3 className="font-serif text-xl uppercase text-[#24211D]">
              Log Supplier Quotation · {rfq.rfqNumber}
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
              rfqId: rfq.id,
              supplierId,
              vendorRefNumber,
              deliveryDays,
              freightInr,
              paymentTerms,
              notes,
              items
            });
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="font-mono text-[10px] uppercase text-[#686158] block mb-1">Quoting Supplier</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4]"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} · {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase text-[#686158] block mb-1">Delivery (Days)</label>
              <input
                type="number"
                min={1}
                value={deliveryDays}
                onChange={(e) => setDeliveryDays(Number(e.target.value))}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4] font-mono"
              />
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase text-[#686158] block mb-1">Freight (₹)</label>
              <input
                type="number"
                min={0}
                value={freightInr}
                onChange={(e) => setFreightInr(Number(e.target.value))}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4] font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              value={vendorRefNumber}
              onChange={(e) => setVendorRefNumber(e.target.value)}
              placeholder="Supplier Quote Reference # (e.g. QT-2026-901)"
              className="px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4] font-mono"
            />
            <select
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              className="px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4]"
            >
              <option value="NET_30">NET_30</option>
              <option value="NET_45">NET_45</option>
              <option value="NET_15">NET_15</option>
              <option value="ADVANCE_50_BALANCE_DISPATCH">50% Advance / Balance Dispatch</option>
            </select>
          </div>

          <div className="space-y-2 border-t border-[#DED7CC] pt-3">
            <span className="font-mono text-[10px] uppercase text-[#9A783E] block">Quoted Unit Prices &amp; GST %</span>
            {items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-[#FAF8F4] p-2 rounded border border-[#DED7CC]">
                <div className="col-span-5 font-semibold truncate">{it.materialName}</div>
                <div className="col-span-2 font-mono text-right tabular-nums">
                  {it.qty} {it.unit}
                </div>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={it.unitPriceInr}
                  onChange={(e) => {
                    const next = [...items];
                    next[idx].unitPriceInr = Number(e.target.value);
                    setItems(next);
                  }}
                  className="col-span-3 px-2 py-1 border border-[#DED7CC] rounded bg-[#FFFFFF] font-mono tabular-nums"
                  title="Unit Rate"
                />
                <input
                  type="number"
                  min={0}
                  max={28}
                  value={it.taxPct}
                  onChange={(e) => {
                    const next = [...items];
                    next[idx].taxPct = Number(e.target.value);
                    setItems(next);
                  }}
                  className="col-span-2 px-2 py-1 border border-[#DED7CC] rounded bg-[#FFFFFF] font-mono tabular-nums"
                  title="GST %"
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#DED7CC]">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-[#DED7CC] rounded font-mono cursor-pointer">
              Cancel
            </button>
            <button
              disabled={busy}
              type="submit"
              className="px-5 py-2 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] rounded font-mono cursor-pointer"
            >
              {busy ? 'Recording...' : 'Save Supplier Quote'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 5. PARTIAL GRN RECEIVING + QC INSPECTION MODALS
export const PartialGrnModal: React.FC<{
  open: boolean;
  po: any | null;
  warehouses: any[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: any) => Promise<void>;
}> = ({ open, po, warehouses, busy, onClose, onSubmit }) => {
  const [warehouseId, setWarehouseId] = useState('wh-mumbai-rm');
  const [challanNumber, setChallanNumber] = useState('');
  const [approveNow, setApproveNow] = useState(false);
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<any[]>([]);

  useEffect(() => {
    if (!open || !po) return;
    setWarehouseId(po.warehouseId || warehouses[0]?.id || 'wh-mumbai-rm');
    setChallanNumber(`CH-${po.poNumber}-${Math.floor(10 + Math.random() * 89)}`);
    setApproveNow(false);
    setNotes('Physical inward delivery verification.');
    setLines(
      (po.items || []).map((it: any) => {
        const remaining = Math.max(0, Number(it.quantity || 0) - Number(it.receivedQty || 0));
        return {
          materialId: it.materialId || '',
          materialName: it.name,
          category: it.category || po.category,
          orderedQty: Number(it.quantity || 0),
          alreadyReceived: Number(it.receivedQty || 0),
          receivedQty: remaining,
          acceptedQty: remaining,
          rejectedQty: 0,
          unit: it.unit || 'units',
          unitCostInr: Number(it.unitPriceInr || 0)
        };
      })
    );
  }, [open, po, warehouses]);

  if (!open || !po) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl w-full max-w-3xl p-6 space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-[#DED7CC] pb-3">
          <div>
            <span className="font-mono text-[10px] uppercase text-[#9A783E]">Stage 05 · Partial / Multi-Delivery GRN</span>
            <h3 className="font-serif text-xl uppercase text-[#24211D]">
              Log Goods Receipt · {po.poNumber}
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
              purchaseOrderId: po.id,
              warehouseId,
              challanNumber,
              approveAndPostInventoryNow: approveNow,
              notes,
              items: lines.filter((l) => Number(l.receivedQty) > 0)
            });
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-mono text-[10px] uppercase text-[#686158] block mb-1">Delivery Warehouse</label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4]"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} · {w.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase text-[#686158] block mb-1">Challan / Airway Bill #</label>
              <input
                required
                value={challanNumber}
                onChange={(e) => setChallanNumber(e.target.value)}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4] font-mono"
              />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer font-mono text-[11px] bg-[#FAF8F4] border border-[#DED7CC] rounded px-3 py-2 w-full">
                <input
                  type="checkbox"
                  checked={approveNow}
                  onChange={(e) => setApproveNow(e.target.checked)}
                />
                <span>Direct QC Pass &amp; Post Stock Now</span>
              </label>
            </div>
          </div>

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                <th className="py-2">Material</th>
                <th className="py-2 text-right">Ordered / Prev</th>
                <th className="py-2 text-right">Receiving Now</th>
                <th className="py-2 text-right">Accepted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DED7CC]">
              {lines.map((l, idx) => (
                <tr key={idx}>
                  <td className="py-2 font-semibold">{l.materialName}</td>
                  <td className="py-2 text-right font-mono tabular-nums text-[#686158]">
                    {l.orderedQty} / {l.alreadyReceived} {l.unit}
                  </td>
                  <td className="py-2 text-right">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={l.receivedQty}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        const next = [...lines];
                        next[idx].receivedQty = val;
                        next[idx].acceptedQty = val;
                        setLines(next);
                      }}
                      className="w-24 px-2 py-1 border border-[#DED7CC] rounded bg-[#FAF8F4] text-right font-mono tabular-nums"
                    />
                  </td>
                  <td className="py-2 text-right">
                    <input
                      type="number"
                      min={0}
                      max={l.receivedQty}
                      step="any"
                      value={l.acceptedQty}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        const next = [...lines];
                        next[idx].acceptedQty = val;
                        next[idx].rejectedQty = Math.max(0, next[idx].receivedQty - val);
                        setLines(next);
                      }}
                      className="w-24 px-2 py-1 border border-[#DED7CC] rounded bg-[#FAF8F4] text-right font-mono tabular-nums"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-between items-center pt-3 border-t border-[#DED7CC]">
            <span className="font-mono text-[11px] text-[#686158]">
              {approveNow
                ? 'Will immediately capitalize FIFO Lots & post Dr Inventory / Cr GRNI.'
                : 'Stock stays quarantined (PENDING_INSPECTION) until QC Inspector approves.'}
            </span>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 border border-[#DED7CC] rounded font-mono cursor-pointer">
                Cancel
              </button>
              <button
                disabled={busy}
                type="submit"
                className="px-5 py-2 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] rounded font-mono cursor-pointer"
              >
                {busy ? 'Posting...' : 'Record Goods Receipt'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

// 6. VENDOR INVOICE MODAL (PO-MATCHED vs NON-PO + ATTACHMENT UPLOAD + DUPLICATE CHECK)
export const VendorInvoiceModal: React.FC<{
  open: boolean;
  snapshot: ErpProcurementSnapshot;
  prefillPo?: any | null;
  busy: boolean;
  errorBanner: string | null;
  onClose: () => void;
  onSubmit: (payload: any) => Promise<void>;
}> = ({ open, snapshot, prefillPo, busy, errorBanner, onClose, onSubmit }) => {
  const [isNonPo, setIsNonPo] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [purchaseOrderId, setPurchaseOrderId] = useState('');
  const [selectedGrnIds, setSelectedGrnIds] = useState<string[]>([]);
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState('');
  const [nonPoReason, setNonPoReason] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('LAB_TESTING_&_LOGISTICS');
  const [freightInr, setFreightInr] = useState(0);
  const [attachmentName, setAttachmentName] = useState('');
  const [attachmentUrlOrData, setAttachmentUrlOrData] = useState('');
  const [items, setItems] = useState<any[]>([{ name: '', category: 'FRAGRANCE_OIL', qty: 1, unit: 'units', unitPriceInr: 1000, taxPct: 18 }]);

  useEffect(() => {
    if (!open) return;
    setSupplierInvoiceNumber('');
    setAttachmentName('');
    setAttachmentUrlOrData('');
    if (prefillPo) {
      setIsNonPo(false);
      setSupplierId(prefillPo.supplierId);
      setPurchaseOrderId(prefillPo.id);
      setFreightInr(Number(prefillPo.shippingInr || 0));
      const matchingGrns = snapshot.goodsReceipts
        .filter((g) => g.purchaseOrderId === prefillPo.id && g.inventoryPosted)
        .map((g) => g.id);
      setSelectedGrnIds(matchingGrns);
      setItems(
        (prefillPo.items || []).map((it: any) => ({
          name: it.name,
          category: it.category || prefillPo.category,
          qty: Number(it.receivedQty > 0 ? it.receivedQty : it.quantity),
          unit: it.unit || 'units',
          unitPriceInr: Number(it.unitPriceInr || 0),
          taxPct: Number(it.taxPct ?? 18)
        }))
      );
    } else {
      const po0 = snapshot.purchaseOrders.find((p) => p.status !== 'CANCELLED');
      setIsNonPo(!po0);
      setSupplierId(po0?.supplierId || snapshot.suppliers[0]?.id || '');
      setPurchaseOrderId(po0?.id || '');
      setSelectedGrnIds([]);
      if (po0) {
        setItems(
          (po0.items || []).map((it: any) => ({
            name: it.name,
            category: it.category || po0.category,
            qty: Number(it.quantity),
            unit: it.unit || 'units',
            unitPriceInr: Number(it.unitPriceInr),
            taxPct: Number(it.taxPct ?? 18)
          }))
        );
      }
    }
  }, [open, prefillPo, snapshot.purchaseOrders, snapshot.goodsReceipts, snapshot.suppliers]);

  if (!open) return null;

  const poGrns = snapshot.goodsReceipts.filter((g) => g.purchaseOrderId === purchaseOrderId && g.inventoryPosted);

  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachmentName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setAttachmentUrlOrData(String(reader.result || '').slice(0, 65000));
    };
    reader.readAsDataURL(file);
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-[#DED7CC] pb-3">
          <div>
            <span className="font-mono text-[10px] uppercase text-[#9A783E]">Stage 07 · Three-Way Match &amp; Non-PO Bills</span>
            <h3 className="font-serif text-xl uppercase text-[#24211D]">Record Supplier Tax Invoice</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-[#686158] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorBanner && (
          <div className="p-3 bg-rose-50 border border-rose-300 rounded text-rose-800 font-mono text-[11px] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorBanner}</span>
          </div>
        )}

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await onSubmit({
              supplierId,
              supplierInvoiceNumber,
              purchaseOrderId: isNonPo ? undefined : purchaseOrderId || undefined,
              grnIds: isNonPo ? [] : selectedGrnIds,
              isNonPo,
              nonPoReason,
              expenseCategory,
              freightInr,
              attachmentName: attachmentName || undefined,
              attachmentUrlOrData: attachmentUrlOrData || undefined,
              items
            });
          }}
          className="space-y-4"
        >
          <div className="flex gap-2 border-b border-[#DED7CC] pb-3">
            <button
              type="button"
              onClick={() => setIsNonPo(false)}
              className={`px-3 py-1.5 font-mono rounded border cursor-pointer ${
                !isNonPo ? 'bg-[#24211D] text-[#FAF8F4] border-[#24211D]' : 'bg-[#FAF8F4] border-[#DED7CC] text-[#686158]'
              }`}
            >
              PO &amp; GRN Matched Invoice
            </button>
            <button
              type="button"
              onClick={() => {
                setIsNonPo(true);
                setPurchaseOrderId('');
                setSelectedGrnIds([]);
              }}
              className={`px-3 py-1.5 font-mono rounded border cursor-pointer ${
                isNonPo ? 'bg-[#24211D] text-[#FAF8F4] border-[#24211D]' : 'bg-[#FAF8F4] border-[#DED7CC] text-[#686158]'
              }`}
            >
              Non-PO Expense Purchase (Requires Approval)
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-mono text-[10px] uppercase text-[#686158] block mb-1">Supplier *</label>
              <select
                required
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4]"
              >
                {snapshot.suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} · {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase text-[#686158] block mb-1">
                Vendor Invoice # * (Duplicate Checked)
              </label>
              <input
                required
                value={supplierInvoiceNumber}
                onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
                placeholder="e.g. INV/26-27/0481"
                className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4] font-mono"
              />
            </div>
            {!isNonPo ? (
              <div>
                <label className="font-mono text-[10px] uppercase text-[#686158] block mb-1">Linked PO</label>
                <select
                  value={purchaseOrderId}
                  onChange={(e) => {
                    const po = snapshot.purchaseOrders.find((p) => p.id === e.target.value);
                    setPurchaseOrderId(e.target.value);
                    if (po) {
                      setSupplierId(po.supplierId);
                      setFreightInr(Number(po.shippingInr || 0));
                      setItems(
                        (po.items || []).map((it: any) => ({
                          name: it.name,
                          category: it.category || po.category,
                          qty: Number(it.receivedQty > 0 ? it.receivedQty : it.quantity),
                          unit: it.unit,
                          unitPriceInr: Number(it.unitPriceInr),
                          taxPct: Number(it.taxPct ?? 18)
                        }))
                      );
                    }
                  }}
                  className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4]"
                >
                  <option value="">Select Purchase Order...</option>
                  {snapshot.purchaseOrders
                    .filter((p) => p.status !== 'CANCELLED')
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.poNumber} · {p.supplierName} ({fmtInr(p.totalCostInr)})
                      </option>
                    ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="font-mono text-[10px] uppercase text-[#686158] block mb-1">Expense Head</label>
                <input
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4] font-mono"
                />
              </div>
            )}
          </div>

          {!isNonPo && poGrns.length > 0 && (
            <div className="bg-[#FAF8F4] border border-[#DED7CC] p-3 rounded">
              <span className="font-mono text-[10px] uppercase text-[#9A783E] block mb-1.5">
                Link Approved GRNs (Clears 2110 GRNI without Duplicate AP)
              </span>
              <div className="flex flex-wrap gap-2">
                {poGrns.map((g) => {
                  const checked = selectedGrnIds.includes(g.id);
                  return (
                    <label key={g.id} className="flex items-center gap-1.5 font-mono text-[11px] bg-[#FFFFFF] border border-[#DED7CC] px-2.5 py-1 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSelectedGrnIds((prev) =>
                            checked ? prev.filter((id) => id !== g.id) : [...prev, g.id]
                          )
                        }
                      />
                      <span>
                        {g.grnNumber} ({fmtInr(g.subtotalInr)})
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {isNonPo && (
            <input
              required
              value={nonPoReason}
              onChange={(e) => setNonPoReason(e.target.value)}
              placeholder="Justification for Non-PO procurement (e.g. Emergency customs freight / Lab calibration service)"
              className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4]"
            />
          )}

          <div className="space-y-2 border-t border-[#DED7CC] pt-3">
            <span className="font-mono text-[10px] uppercase text-[#686158] block">Billed Line Items</span>
            {items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-[#FAF8F4] p-2 rounded border border-[#DED7CC]">
                <input
                  required
                  value={it.name}
                  placeholder="Line description"
                  onChange={(e) => {
                    const next = [...items];
                    next[idx].name = e.target.value;
                    setItems(next);
                  }}
                  className="col-span-5 px-2 py-1 border border-[#DED7CC] rounded bg-[#FFFFFF]"
                />
                <input
                  type="number"
                  min={1}
                  step="any"
                  value={it.qty}
                  onChange={(e) => {
                    const next = [...items];
                    next[idx].qty = Number(e.target.value);
                    setItems(next);
                  }}
                  className="col-span-2 px-2 py-1 border border-[#DED7CC] rounded bg-[#FFFFFF] font-mono tabular-nums"
                />
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={it.unitPriceInr}
                  onChange={(e) => {
                    const next = [...items];
                    next[idx].unitPriceInr = Number(e.target.value);
                    setItems(next);
                  }}
                  className="col-span-3 px-2 py-1 border border-[#DED7CC] rounded bg-[#FFFFFF] font-mono tabular-nums"
                />
                <input
                  type="number"
                  min={0}
                  max={28}
                  value={it.taxPct}
                  onChange={(e) => {
                    const next = [...items];
                    next[idx].taxPct = Number(e.target.value);
                    setItems(next);
                  }}
                  className="col-span-2 px-2 py-1 border border-[#DED7CC] rounded bg-[#FFFFFF] font-mono tabular-nums"
                />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-[#DED7CC] pt-3">
            <div>
              <label className="font-mono text-[10px] uppercase text-[#686158] block mb-1">
                Attach Supplier PDF / Scan
              </label>
              <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-[#9A783E] rounded bg-[#FAF8F4] cursor-pointer">
                <Upload className="w-3.5 h-3.5 text-[#9A783E]" />
                <span className="font-mono truncate">
                  {attachmentName || 'Upload Tax Invoice PDF / Image'}
                </span>
                <input type="file" accept=".pdf,image/*" onChange={handleFileAttach} className="hidden" />
              </label>
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase text-[#686158] block mb-1">Freight Charges (₹)</label>
              <input
                type="number"
                min={0}
                value={freightInr}
                onChange={(e) => setFreightInr(Number(e.target.value))}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded bg-[#FAF8F4] font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#DED7CC]">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-[#DED7CC] rounded font-mono cursor-pointer">
              Cancel
            </button>
            <button
              disabled={busy}
              type="submit"
              className="px-5 py-2 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] rounded font-mono cursor-pointer"
            >
              {busy ? 'Verifying & Posting...' : 'Post Supplier Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
