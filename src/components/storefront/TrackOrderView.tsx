import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { OrderStatus, ReturnRefund } from '../../types';
import { Clock, CheckCircle2, ExternalLink, ArrowLeft, Package, RotateCcw } from 'lucide-react';

export const TrackOrderView: React.FC = () => {
  const { orders, returns, addReturn, setCurrentView } = useStore();
  const [queryInput, setQueryInput] = useState('');
  const [searchedOrder, setSearchedOrder] = useState<(typeof orders)[0] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [returnReason, setReturnReason] = useState('Damaged seal or packaging during transit');
  const [showReturnForm, setShowReturnForm] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setShowReturnForm(false);
    const q = queryInput.trim().toUpperCase();
    if (!q) return;

    const found = orders.find(
      (o) =>
        o.orderNumber.toUpperCase() === q ||
        (o.awbNumber && o.awbNumber.toUpperCase() === q) ||
        o.id.toUpperCase() === q
    );
    if (found) {
      setSearchedOrder(found);
    } else {
      setSearchedOrder(null);
      setErrorMsg(`No consignment found matching "${q}". Please check your Order Number or AWB.`);
    }
  };

  const handleQuickReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchedOrder) return;
    const item = searchedOrder.items[0];
    const newRet: ReturnRefund = {
      id: 'ret-' + Date.now(),
      orderId: searchedOrder.id,
      orderNumber: searchedOrder.orderNumber,
      customerName: searchedOrder.customerName,
      customerEmail: searchedOrder.customerEmail,
      requestDate: new Date().toISOString().split('T')[0],
      reason: returnReason,
      productName: item ? item.productName : 'FRAGMORÉ Creation',
      size: item ? item.size : '50 ml',
      quantity: item ? item.quantity : 1,
      refundAmount: searchedOrder.totalAmount,
      status: 'REQUESTED',
      restockInventory: true,
      notes: 'Customer initiated return'
    };
    addReturn(newRet);
    setShowReturnForm(false);
  };

  const timelineSteps: { key: OrderStatus; label: string }[] = [
    { key: 'CONFIRMED', label: 'Order Confirmed' },
    { key: 'PACKING', label: 'Artisanal Packing' },
    { key: 'SHIPPED', label: 'Dispatched & In Transit' },
    { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
    { key: 'DELIVERED', label: 'Delivered' }
  ];

  const getStepStatus = (stepKey: OrderStatus, currentStatus: OrderStatus) => {
    const orderIndexMap: Record<string, number> = {
      NEW: 0,
      CONFIRMED: 1,
      PACKING: 2,
      SHIPPED: 3,
      OUT_FOR_DELIVERY: 4,
      DELIVERED: 5
    };
    const currentIdx = orderIndexMap[currentStatus] || 0;
    const stepIdx = orderIndexMap[stepKey] || 0;
    if (stepIdx < currentIdx) return 'completed';
    if (stepIdx === currentIdx) return 'current';
    return 'pending';
  };

  return (
    <div className="min-h-screen bg-[#08080A] text-[#F3EFE6] pt-24 pb-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <button
          onClick={() => setCurrentView('storefront')}
          className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-stone-400 hover:text-[#D4AF37] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Maison</span>
        </button>

        <div className="bg-[#121218] border border-white/10 rounded-2xl p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-2 text-xs font-mono tracking-widest text-[#D4AF37] uppercase">
            <Clock className="w-4 h-4" />
            <span>Consignment Status &amp; Courier Tracking</span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl text-white uppercase tracking-wider">
            Track Your FRAGMORÉ Order
          </h1>
          <p className="text-xs text-stone-400 leading-relaxed">
            Enter your Order ID (e.g. ORD-2025-001) or Air Waybill (AWB) number to inspect real-time dispatch milestones.
          </p>

          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 pt-2">
            <input
              type="text"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder="e.g. ORD-2025-001 or BD-882194812"
              className="flex-1 bg-[#08080A] border border-white/20 text-white placeholder-white/40 rounded-xl px-4 py-3 text-xs font-mono uppercase tracking-wider focus:outline-none focus:border-[#D4AF37]"
            />
            <button
              type="submit"
              className="px-6 py-3 bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Package className="w-4 h-4" />
              <span>Look Up Order</span>
            </button>
          </form>

          {errorMsg && <p className="text-rose-400 text-xs font-mono pt-1">{errorMsg}</p>}
        </div>

        {searchedOrder && (
          <div className="bg-[#121218] border border-white/10 rounded-2xl p-6 sm:p-10 space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/10 pb-6 gap-4">
              <div>
                <span className="text-xs font-mono tracking-widest text-[#D4AF37] uppercase">
                  Consignment Journey
                </span>
                <h2 className="font-serif text-2xl uppercase tracking-wider text-white">
                  Order {searchedOrder.orderNumber}
                </h2>
                <p className="text-xs text-white/50 font-mono mt-0.5">
                  Courier: {searchedOrder.courierName || 'Blue Dart Express'} · AWB:{' '}
                  {searchedOrder.awbNumber || 'BD-882194812'}
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#E5C378] text-xs font-mono uppercase self-start sm:self-center">
                {searchedOrder.orderStatus}
              </span>
            </div>

            <div className="space-y-6">
              {timelineSteps.map((step, idx) => {
                const status = getStepStatus(step.key, searchedOrder.orderStatus);
                const isCompleted = status === 'completed';
                const isCurrent = status === 'current';

                return (
                  <div key={step.key} className="flex items-start gap-4">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono ${
                          isCompleted
                            ? 'bg-emerald-500 text-white'
                            : isCurrent
                            ? 'bg-[#D4AF37] text-[#08080A] font-bold ring-4 ring-[#D4AF37]/20'
                            : 'bg-white/10 text-white/40'
                        }`}
                      >
                        {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                      </div>
                      {idx < timelineSteps.length - 1 && (
                        <div
                          className={`w-0.5 h-10 my-1 ${
                            isCompleted ? 'bg-emerald-500' : 'bg-white/10'
                          }`}
                        />
                      )}
                    </div>

                    <div className="pt-0.5">
                      <h3
                        className={`text-sm font-serif uppercase tracking-wider ${
                          isCurrent
                            ? 'text-[#D4AF37] font-semibold'
                            : isCompleted
                            ? 'text-white'
                            : 'text-white/40'
                        }`}
                      >
                        {step.label}
                      </h3>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono">
              <span className="text-white/60">
                Items: {searchedOrder.items.map((i) => `${i.productName} (${i.size})`).join(', ')}
              </span>
              {searchedOrder.orderStatus === 'DELIVERED' ? (
                (() => {
                  const existingRet = returns.find(
                    (r) => r.orderId === searchedOrder.id || r.orderNumber === searchedOrder.orderNumber
                  );
                  if (existingRet) {
                    return (
                      <span className="px-3 py-1.5 bg-amber-500/15 border border-amber-500/30 rounded text-[#D4AF37] font-semibold flex items-center gap-1.5">
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Return {existingRet.status}</span>
                      </span>
                    );
                  }
                  return (
                    <button
                      type="button"
                      onClick={() => setShowReturnForm((v) => !v)}
                      className="px-4 py-2 bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] font-bold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Return Order</span>
                    </button>
                  );
                })()
              ) : (
                searchedOrder.trackingUrl && (
                  <a
                    href={searchedOrder.trackingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-[#D4AF37] hover:underline"
                  >
                    <span>Carrier Tracking</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )
              )}
            </div>

            {showReturnForm && searchedOrder.orderStatus === 'DELIVERED' && (
              <form
                onSubmit={handleQuickReturn}
                className="p-4 rounded-xl bg-[#08080A] border border-white/15 space-y-3 text-xs font-mono"
              >
                <label className="block text-white/70">Select Reason for Return:</label>
                <select
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full bg-[#121218] border border-white/20 rounded-lg p-2.5 text-white focus:border-[#D4AF37] focus:outline-none"
                >
                  <option value="Damaged seal or packaging during transit">
                    Damaged seal or packaging during transit
                  </option>
                  <option value="Incorrect fragrance or size delivered">
                    Incorrect fragrance or size delivered
                  </option>
                  <option value="Atomizer or flacon defect">Atomizer or flacon defect</option>
                  <option value="Exchange for another creation">Exchange for another creation</option>
                </select>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowReturnForm(false)}
                    className="px-3 py-1.5 border border-white/20 rounded text-white/70 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-[#D4AF37] text-[#08080A] font-bold rounded cursor-pointer"
                  >
                    Submit Return Request
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
