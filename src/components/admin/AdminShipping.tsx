import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../../context/StoreContext';
import {
  Truck,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Send,
  X
} from 'lucide-react';
import { ErpTableExportBar } from './erp/ErpUniversalExportModal';

const SHIPPING_STAGES = [
  { id: 'ORDER_READY_FOR_PACKING', label: 'Order ready for packing' },
  { id: 'PACKING_COMPLETED', label: 'Packing completed' },
  { id: 'SHIPMENT_BOOKED', label: 'Shipment booked' },
  { id: 'COURIER_ACCEPTED', label: 'Courier accepted' },
  { id: 'SHIPPED', label: 'Shipped' },
  { id: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
  { id: 'DELIVERED', label: 'Delivered (Requires Verification)' },
  { id: 'DELIVERY_EXCEPTION', label: 'Delivery exception (Creates Admin Task)' },
  { id: 'RETURN_TO_ORIGIN', label: 'Return to origin (RTO)' },
  { id: 'LOST_OR_DAMAGED_SHIPMENT', label: 'Lost or damaged shipment' }
] as const;

export const AdminShipping: React.FC = () => {
  const { orders, updateOrderStatus, cms, updateCMS, showNotification } = useStore();
  const [selectedCourier, setSelectedCourier] = useState('Blue Dart Express');
  const [warehousePincode] = useState('400018');
  const [shippingThreshold, setShippingThreshold] = useState(cms.freeShippingThreshold);

  // Live PostgreSQL shipping & exception tasks state
  const [dbOrders, setDbOrders] = useState<any[]>([]);
  const [shippingTasks, setShippingTasks] = useState<any[]>([]);
  const [loadingOps, setLoadingOps] = useState(false);

  // Event-based workflow modal state
  const [selectedOrderForEvent, setSelectedOrderForEvent] = useState<any | null>(null);
  const [eventStage, setEventStage] = useState<string>('ORDER_READY_FOR_PACKING');
  const [eventCourier, setEventCourier] = useState('Blue Dart Express');
  const [eventAwb, setEventAwb] = useState('');
  const [verificationSource, setVerificationSource] = useState<
    'TRUSTED_CARRIER_WEBHOOK' | 'AUTHORIZED_ADMIN_CONFIRMATION' | 'UNVERIFIED_PING'
  >('TRUSTED_CARRIER_WEBHOOK');
  const [eventNotes, setEventNotes] = useState('');

  const fetchShippingOps = useCallback(async () => {
    setLoadingOps(true);
    try {
      const res = await fetch('/api/ops/dashboard');
      if (res.ok) {
        const data = await res.json();
        setDbOrders(data.orders || []);
        const tasks = (data.tasks || []).filter(
          (t: any) => t.category === 'SHIPPING_EXCEPTION'
        );
        setShippingTasks(tasks);
      }
    } catch {
      // fallback
    } finally {
      setLoadingOps(false);
    }
  }, []);

  useEffect(() => {
    fetchShippingOps();
  }, [fetchShippingOps]);

  const mergedOrders: any[] = orders.map((ord) => {
    const dbMatch = dbOrders.find((d) => d.id === ord.id || d.orderNumber === ord.orderNumber);
    return dbMatch ? { ...ord, ...dbMatch } : ord;
  });
  dbOrders.forEach((dbOrd) => {
    if (!mergedOrders.some((m) => m.id === dbOrd.id || m.orderNumber === dbOrd.orderNumber)) {
      mergedOrders.unshift(dbOrd);
    }
  });

  // Orders awaiting dispatch (NEW, CONFIRMED, PACKING)
  const pendingFulfillment = mergedOrders.filter(
    (o) => o.orderStatus === 'NEW' || o.orderStatus === 'CONFIRMED' || o.orderStatus === 'PACKING'
  );

  // Shipped orders
  const inTransitOrders = mergedOrders.filter(
    (o) => o.orderStatus === 'SHIPPED' || o.orderStatus === 'OUT_FOR_DELIVERY'
  );

  const handleDispatchOrder = async (orderId: string, orderNumber: string) => {
    const awb = 'BD' + Math.floor(10000000 + Math.random() * 90000000) + 'IN';
    try {
      const res = await fetch(`/api/ops/shipping/${orderId}/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage: 'SHIPPED',
          courierName: selectedCourier,
          awbNumber: awb,
          verificationSource: 'AUTHORIZED_ADMIN_CONFIRMATION',
          actor: 'Super Admin Dispatch Desk',
          notes: `Consignment sealed and handed over to ${selectedCourier}`
        })
      });
      const data = await res.json();
      if (!res.ok) {
        showNotification(data.error || 'Dispatch event failed');
        return;
      }
    } catch {
      // fallback
    }
    updateOrderStatus(orderId, 'SHIPPED', awb, selectedCourier);
    showNotification(
      `Consignment ${orderNumber} dispatched via ${selectedCourier} with AWB #${awb}.`
    );
    await fetchShippingOps();
  };

  const handleTriggerShippingEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderForEvent) return;
    try {
      const res = await fetch(`/api/ops/shipping/${selectedOrderForEvent.id}/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage: eventStage,
          courierName: eventCourier,
          awbNumber: eventAwb || selectedOrderForEvent.awbNumber || `BD${Date.now().toString().slice(-8)}IN`,
          verificationSource,
          actor:
            verificationSource === 'TRUSTED_CARRIER_WEBHOOK'
              ? `${eventCourier} Signed Webhook`
              : 'Super Admin Logistics Officer',
          notes: eventNotes
        })
      });
      const data = await res.json();
      if (!res.ok) {
        showNotification(`Delivery Verification Guard: ${data.error}`);
      } else {
        showNotification(
          `Shipping workflow stage [${eventStage}] recorded for ${selectedOrderForEvent.orderNumber}.`
        );
        setSelectedOrderForEvent(null);
        await fetchShippingOps();
      }
    } catch (err: any) {
      showNotification(err.message || 'Shipping event error');
    }
  };

  const handleResolveTask = async (taskId: string) => {
    try {
      const res = await fetch(`/api/ops/tasks/${taskId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolutionNotes: 'Carrier exception resolved with consignee re-attempt / replacement confirmed.'
        })
      });
      if (res.ok) {
        showNotification('Shipping exception task resolved.');
        await fetchShippingOps();
      }
    } catch {
      // ignore
    }
  };

  const handleSaveThreshold = (e: React.FormEvent) => {
    e.preventDefault();
    updateCMS({ freeShippingThreshold: shippingThreshold });
    showNotification(`Free shipping threshold updated to ₹${shippingThreshold}.`);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-mono text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-white/10 gap-4">
        <div>
          <h2 className="font-serif text-2xl uppercase tracking-wider text-white">
            Logistics, 10-Stage Event Shipping & Exception Orchestration
          </h2>
          <p className="text-xs text-white/50">
            Event-based carrier workflows, trusted delivery verification guard, AWB tracking, and automated exception tasks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ErpTableExportBar
            reportKey="custom_table"
            title="FRAGMORÉ Logistics & Consignment Manifest"
            customRows={mergedOrders.map((o) => ({
              orderNumber: o.orderNumber || o.id,
              date: o.date || o.createdAt || '',
              customerName: o.customerName || '',
              city: o.shippingAddress?.city || o.city || '',
              courier: o.courierName || selectedCourier,
              awbNumber: o.trackingNumber || o.awbNumber || 'PENDING',
              status: o.orderStatus || 'NEW',
              amountInr: Number(o.totalAmount || 0)
            }))}
            notify={(m) => showNotification(m)}
          />
          <button
            onClick={fetchShippingOps}
            className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingOps ? 'animate-spin' : ''}`} /> Sync Carrier Events
          </button>
        </div>
      </div>

      {/* Logistics Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-[#121218] border border-white/10 rounded-xl space-y-1">
          <span className="text-[10px] text-white/50 uppercase">Ready for Packing</span>
          <div className="text-2xl font-bold text-amber-400">{pendingFulfillment.length} Orders</div>
          <span className="text-[10px] text-white/40">Requires flacon sealing</span>
        </div>

        <div className="p-4 bg-[#121218] border border-white/10 rounded-xl space-y-1">
          <span className="text-[10px] text-white/50 uppercase">In-Transit Consignments</span>
          <div className="text-2xl font-bold text-sky-400">{inTransitOrders.length} Flacons</div>
          <span className="text-[10px] text-white/40">With active courier AWBs</span>
        </div>

        <div className="p-4 bg-[#121218] border border-white/10 rounded-xl space-y-1">
          <span className="text-[10px] text-white/50 uppercase">Open Carrier Exceptions</span>
          <div className="text-2xl font-bold text-rose-400">
            {shippingTasks.filter((t) => t.status === 'OPEN').length} Alerts
          </div>
          <span className="text-[10px] text-white/40">RTO, NDR & Damaged Shipments</span>
        </div>

        <div className="p-4 bg-[#121218] border border-[#D4AF37]/30 rounded-xl space-y-1">
          <span className="text-[10px] text-[#D4AF37] uppercase flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Delivery Guard
          </span>
          <div className="text-sm font-bold text-white mt-1">Carrier Webhook / Admin Auth</div>
          <span className="text-[10px] text-emerald-400">Unverified delivery pings blocked</span>
        </div>
      </div>

      {/* Unresolved Shipping Exceptions Queue */}
      {shippingTasks.length > 0 && (
        <div className="bg-[#121218] border border-rose-500/30 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="font-serif text-base uppercase tracking-wider text-rose-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Shipping Exception Admin Task Queue
            </h3>
            <span className="text-[11px] text-white/60">
              {shippingTasks.filter((t) => t.status === 'OPEN').length} Open Tasks
            </span>
          </div>
          <div className="divide-y divide-white/5">
            {shippingTasks.slice(0, 6).map((task) => (
              <div
                key={task.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                        task.status === 'OPEN'
                          ? 'bg-rose-500/20 text-rose-400'
                          : 'bg-emerald-500/20 text-emerald-400'
                      }`}
                    >
                      {task.status}
                    </span>
                    <strong className="text-white">{task.title}</strong>
                  </div>
                  <p className="text-white/70 text-[11px] mt-1">{task.description}</p>
                  <span className="text-[10px] text-[#D4AF37]">
                    Action Required: {task.suggestedAction}
                  </span>
                </div>
                {task.status === 'OPEN' && (
                  <button
                    onClick={() => handleResolveTask(task.id)}
                    className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 rounded font-bold text-[10px] uppercase whitespace-nowrap"
                  >
                    Resolve Exception
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shipping Threshold Controls */}
      <div className="p-5 bg-[#121218] border border-white/10 rounded-xl">
        <form
          onSubmit={handleSaveThreshold}
          className="flex flex-col sm:flex-row items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <Truck className="w-5 h-5 text-[#D4AF37]" />
            <div>
              <strong className="text-white block font-serif tracking-wider uppercase text-sm">
                Complimentary White-Glove Shipping Threshold
              </strong>
              <span className="text-white/50 text-[11px]">
                Orders equal or exceeding this value receive complimentary express delivery nationwide (Origin Pincode: {warehousePincode}).
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center bg-black/40 border border-white/20 rounded-lg px-3 py-1.5 text-white">
              <span className="text-[#D4AF37] mr-1 font-bold">₹</span>
              <input
                type="number"
                value={shippingThreshold}
                onChange={(e) => setShippingThreshold(Number(e.target.value))}
                className="bg-transparent w-24 text-white focus:outline-none font-bold"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] font-bold rounded-lg uppercase tracking-wider text-xs whitespace-nowrap"
            >
              Update Rule
            </button>
          </div>
        </form>
      </div>

      {/* Dispatch Pipeline Table */}
      <div className="bg-[#121218] border border-white/10 rounded-xl overflow-x-auto p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <h3 className="font-serif text-base uppercase tracking-wider text-white">
            Orders Awaiting Manifest & Dispatch
          </h3>
          <div className="flex items-center gap-3">
            <select
              value={selectedCourier}
              onChange={(e) => setSelectedCourier(e.target.value)}
              className="bg-black/40 border border-white/15 rounded px-2.5 py-1 text-white text-[11px]"
            >
              <option value="Blue Dart Express">Blue Dart Express</option>
              <option value="Delhivery Surface Pro">Delhivery Surface Pro</option>
              <option value="DTDC Premium">DTDC Premium</option>
            </select>
            <span className="text-[11px] text-[#D4AF37]">
              {pendingFulfillment.length} Consignments Pending
            </span>
          </div>
        </div>

        {pendingFulfillment.length === 0 ? (
          <div className="text-center py-10 text-white/40">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
            All current customer orders have been dispatched with verified courier AWBs.
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10 text-white/40 uppercase text-[10px]">
                <th className="p-3">Order #</th>
                <th className="p-3">Customer & Destination</th>
                <th className="p-3">Flacons & Coffrets</th>
                <th className="p-3">Payment</th>
                <th className="p-3">Shipping Stage</th>
                <th className="p-3 text-right">Workflow & Dispatch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {pendingFulfillment.map((ord) => (
                <tr key={ord.id} className="hover:bg-white/[0.02]">
                  <td className="p-3 font-bold text-white">{ord.orderNumber}</td>
                  <td className="p-3">
                    <strong className="text-white block">{ord.customerName}</strong>
                    <span className="text-white/60 text-[11px]">
                      {ord.shippingAddress?.city || 'India'}, {ord.shippingAddress?.state || ''} -{' '}
                      {ord.shippingAddress?.pincode || ''}
                    </span>
                  </td>
                  <td className="p-3 text-white/80">
                    {(ord.items || [])
                      .map((i: any) => `${i.productName} (${i.size}) × ${i.quantity}`)
                      .join(', ')}
                  </td>
                  <td className="p-3">
                    <span className="text-[#D4AF37] font-semibold">
                      ₹{Number(ord.totalAmount || 0).toLocaleString('en-IN')}
                    </span>
                    <span className="block text-[10px] text-white/40">
                      {ord.paymentStatus} ({ord.paymentMethod})
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-bold text-[10px]">
                      {ord.opsMetadata?.shippingStage || ord.orderStatus}
                    </span>
                  </td>
                  <td className="p-3 text-right space-x-2 whitespace-nowrap">
                    <button
                      onClick={() => {
                        setSelectedOrderForEvent(ord);
                        setEventStage(ord.opsMetadata?.shippingStage || 'ORDER_READY_FOR_PACKING');
                        setEventCourier(ord.courierName || selectedCourier);
                        setEventAwb(ord.awbNumber || '');
                      }}
                      className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/15 text-white rounded font-bold text-[10px] uppercase inline-flex items-center gap-1"
                    >
                      <Send className="w-3 h-3 text-[#D4AF37]" /> 10-Stage Event
                    </button>
                    <button
                      onClick={() => handleDispatchOrder(ord.id, ord.orderNumber)}
                      className="px-3 py-1.5 bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] rounded font-bold text-[10px] uppercase tracking-wider inline-flex items-center gap-1.5"
                    >
                      <Truck className="w-3 h-3" /> Seal & Dispatch
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Dispatched Consignments with Live Tracking & Event Trigger */}
      <div className="bg-[#121218] border border-white/10 rounded-xl overflow-x-auto p-5 space-y-4">
        <h3 className="font-serif text-base uppercase tracking-wider text-white border-b border-white/10 pb-3">
          Dispatched Consignments & Carrier Event Orchestration
        </h3>

        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/10 text-white/40 uppercase text-[10px]">
              <th className="p-3">Order #</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Courier</th>
              <th className="p-3">AWB Tracking #</th>
              <th className="p-3">Stage & Verification</th>
              <th className="p-3 text-right">Actions & Tracking</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {mergedOrders
              .filter(
                (o) =>
                  o.awbNumber ||
                  o.orderStatus === 'SHIPPED' ||
                  o.orderStatus === 'OUT_FOR_DELIVERY' ||
                  o.orderStatus === 'DELIVERED' ||
                  o.opsMetadata?.shippingStage
              )
              .map((ord) => (
                <tr key={ord.id} className="hover:bg-white/[0.02]">
                  <td className="p-3 font-bold text-white">{ord.orderNumber}</td>
                  <td className="p-3 text-white/80">{ord.customerName}</td>
                  <td className="p-3 text-white/70">{ord.courierName || 'Blue Dart Express'}</td>
                  <td className="p-3 text-[#D4AF37] font-bold">
                    {ord.awbNumber || 'BD89412098IN'}
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold text-[10px]">
                      {ord.opsMetadata?.shippingStage || ord.orderStatus}
                    </span>
                    {ord.opsMetadata?.deliveryVerificationSource && (
                      <span className="block text-[9px] text-white/40 mt-0.5">
                        Verified: {ord.opsMetadata.deliveryVerificationSource}
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right space-x-2 whitespace-nowrap">
                    <button
                      onClick={() => {
                        setSelectedOrderForEvent(ord);
                        setEventStage(ord.opsMetadata?.shippingStage || 'OUT_FOR_DELIVERY');
                        setEventCourier(ord.courierName || 'Blue Dart Express');
                        setEventAwb(ord.awbNumber || 'BD89412098IN');
                      }}
                      className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/15 rounded text-[10px] text-[#D4AF37] font-bold"
                    >
                      Trigger Event
                    </button>
                    <a
                      href={`https://www.bluedart.com/tracking?awb=${ord.awbNumber || 'BD89412098IN'}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-[#D4AF37] hover:underline inline-flex items-center gap-1"
                    >
                      Track Live <ExternalLink className="w-3 h-3" />
                    </a>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* 10-STAGE EVENT-BASED SHIPPING WORKFLOW MODAL */}
      {selectedOrderForEvent && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedOrderForEvent(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto"
        >
          <div className="bg-[#0E0E14] border border-white/15 w-full max-w-lg my-auto rounded-2xl p-6 relative text-[#F3EFE6]">
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
              <div>
                <h3 className="font-serif text-lg uppercase tracking-wider text-white">
                  10-Stage Shipping Workflow — {selectedOrderForEvent.orderNumber}
                </h3>
                <p className="text-[11px] text-white/50">
                  Notifies customer when permitted and creates Admin tasks on carrier exceptions.
                </p>
              </div>
              <button
                onClick={() => setSelectedOrderForEvent(null)}
                className="text-white/40 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTriggerShippingEvent} className="space-y-4">
              <div>
                <label className="block text-white/60 mb-1">Shipping Event Stage</label>
                <select
                  value={eventStage}
                  onChange={(e) => setEventStage(e.target.value)}
                  className="w-full bg-[#08080A] border border-white/20 rounded p-2.5 text-white"
                >
                  {SHIPPING_STAGES.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-white/60 mb-1">Courier Partner</label>
                  <input
                    type="text"
                    value={eventCourier}
                    onChange={(e) => setEventCourier(e.target.value)}
                    className="w-full bg-[#08080A] border border-white/20 rounded p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-white/60 mb-1">AWB Number</label>
                  <input
                    type="text"
                    value={eventAwb}
                    onChange={(e) => setEventAwb(e.target.value)}
                    placeholder="BD89412098IN"
                    className="w-full bg-[#08080A] border border-white/20 rounded p-2.5 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-white/60 mb-1">
                  Delivery Verification Source (Enforced for DELIVERED)
                </label>
                <select
                  value={verificationSource}
                  onChange={(e) => setVerificationSource(e.target.value as any)}
                  className="w-full bg-[#08080A] border border-white/20 rounded p-2.5 text-white"
                >
                  <option value="TRUSTED_CARRIER_WEBHOOK">
                    Trusted Carrier Webhook (Blue Dart / Delhivery Signed Status)
                  </option>
                  <option value="AUTHORIZED_ADMIN_CONFIRMATION">
                    Authorized Admin Manual Confirmation (POD Verified)
                  </option>
                  <option value="UNVERIFIED_PING">
                    Unverified Client Ping (Test Security Rejection)
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-white/60 mb-1">Carrier / Exception Notes</label>
                <textarea
                  rows={2}
                  value={eventNotes}
                  onChange={(e) => setEventNotes(e.target.value)}
                  placeholder="Optional scan location, NDR reason, or POD signature reference..."
                  className="w-full bg-[#08080A] border border-white/20 rounded p-2.5 text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setSelectedOrderForEvent(null)}
                  className="px-4 py-2 border border-white/20 rounded text-white/70"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] font-bold uppercase rounded"
                >
                  Execute Shipping Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
