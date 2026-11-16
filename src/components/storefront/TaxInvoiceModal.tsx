import React from 'react';
import { useStore } from '../../context/StoreContext';
import { Order } from '../../types';
import { X, Printer, Download, CheckCircle2 } from 'lucide-react';
import { FragmoreLogo } from '../common/FragmoreLogo';

interface TaxInvoiceModalProps {
  order: Order;
  onClose: () => void;
}

export const TaxInvoiceModal: React.FC<TaxInvoiceModalProps> = ({ order, onClose }) => {
  const { cms } = useStore();

  const isIntraState = order.shippingAddress.state.toLowerCase() === 'maharashtra';
  const taxableSubtotal = Math.round(order.totalAmount / 1.18);
  const gstTotal = order.totalAmount - taxableSubtotal;
  const cgst = isIntraState ? Math.round(gstTotal / 2) : 0;
  const sgst = isIntraState ? Math.round(gstTotal / 2) : 0;
  const igst = !isIntraState ? gstTotal : 0;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto"
    >
      <div className="bg-white text-slate-900 w-full max-w-3xl my-auto max-h-[88vh] overflow-y-auto rounded-xl p-5 sm:p-10 shadow-2xl relative font-sans print:m-0 print:p-6 print:max-h-none print:overflow-visible print:shadow-none print:w-full print:max-w-none">
        
        {/* Actions bar (hidden in print) */}
        <div className="no-print flex items-center justify-between pb-6 border-b border-slate-200 mb-6">
          <span className="text-xs font-mono uppercase tracking-wider text-slate-500">
            Official Tax Invoice · HSN 330300
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Download PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700"
              aria-label="Close invoice"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Invoice Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pb-6 border-b border-slate-300">
          <div>
            <span className="font-serif text-2xl tracking-[0.25em] font-light text-slate-900 uppercase block">
              FRAGMORÉ
            </span>
            <span className="text-[10px] tracking-[0.3em] uppercase text-amber-700 block font-medium">
              SCENT THAT STAYS WITH YOU.
            </span>
            <div className="text-xs text-slate-600 mt-2 space-y-0.5">
              <p>FRAGMORÉ Olfactory Atelier Pvt. Ltd.</p>
              <p>{cms.headquarters}</p>
              <p className="font-mono">GSTIN: {cms.gstNumber} · State Code: 27</p>
              <p className="font-mono">Email: {cms.contactEmail}</p>
            </div>
          </div>

          <div className="text-right sm:text-right font-mono text-xs space-y-1">
            <h3 className="font-serif text-xl tracking-wider uppercase text-slate-900 font-semibold">
              TAX INVOICE
            </h3>
            <p><strong>Invoice No:</strong> INV-{order.orderNumber}</p>
            <p><strong>Date:</strong> {new Date(order.createdAt).toLocaleDateString('en-IN')}</p>
            <p><strong>Payment Ref:</strong> {order.transactionId}</p>
            <p><strong>Mode:</strong> {order.paymentMethod} (PAID)</p>
          </div>
        </div>

        {/* Bill To & Ship To Details */}
        <div className="grid grid-cols-2 gap-6 py-6 border-b border-slate-300 text-xs">
          <div>
            <strong className="block text-slate-400 uppercase tracking-wider text-[10px] mb-1">
              Billed & Dispatched To:
            </strong>
            <p className="font-semibold text-slate-900 text-sm">{order.shippingAddress?.fullName || order.customerName}</p>
            <p className="text-slate-600">{order.shippingAddress?.addressLine1 || 'Delivery Address'} {order.shippingAddress?.addressLine2 || ''}</p>
            <p className="text-slate-600">{order.shippingAddress?.city || 'Mumbai'}, {order.shippingAddress?.state || 'Maharashtra'} - {order.shippingAddress?.pincode || '400001'}</p>
            <p className="text-slate-600 font-mono">Mobile: {order.shippingAddress?.phone || order.customerPhone}</p>
          </div>

          <div className="text-right">
            <strong className="block text-slate-400 uppercase tracking-wider text-[10px] mb-1">
              Dispatch Details:
            </strong>
            <p><strong>Courier:</strong> {order.courierName || 'Blue Dart Express'}</p>
            <p><strong>AWB Number:</strong> {order.awbNumber || 'BD-882194812'}</p>
            <p><strong>Place of Supply:</strong> {order.shippingAddress?.state || 'Maharashtra'}</p>
            <p><strong>Tax Category:</strong> {isIntraState ? 'Intra-State (CGST + SGST)' : 'Inter-State (IGST)'}</p>
          </div>
        </div>

        {/* Items Table */}
        <div className="py-6">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b-2 border-slate-900 text-slate-700 font-mono uppercase text-[10px]">
                <th className="py-2">Item Description</th>
                <th className="py-2 text-center">HSN</th>
                <th className="py-2 text-center">Qty</th>
                <th className="py-2 text-right">Unit Rate (₹)</th>
                <th className="py-2 text-right">Taxable Amt (₹)</th>
                <th className="py-2 text-right">Total (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono">
              {(order.items || []).map((item, idx) => (
                <tr key={idx} className="py-3">
                  <td className="py-3 font-sans font-medium text-slate-900">
                    {item.productName} ({item.size})
                    <span className="block text-[10px] text-slate-500 font-mono">SKU: {item.sku}</span>
                  </td>
                  <td className="py-3 text-center text-slate-600">330300</td>
                  <td className="py-3 text-center font-semibold text-slate-900">{item.quantity}</td>
                  <td className="py-3 text-right text-slate-700">₹{Math.round(item.unitPrice / 1.18).toLocaleString('en-IN')}</td>
                  <td className="py-3 text-right text-slate-700">₹{Math.round(item.totalPrice / 1.18).toLocaleString('en-IN')}</td>
                  <td className="py-3 text-right font-semibold text-slate-900">₹{item.totalPrice.toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals & Tax Calculation Breakdown */}
        <div className="border-t-2 border-slate-900 pt-4 flex justify-end">
          <div className="w-72 space-y-1.5 text-xs font-mono text-slate-700">
            <div className="flex justify-between">
              <span>Taxable Value:</span>
              <span>₹{taxableSubtotal.toLocaleString('en-IN')}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Discount ({order.couponCode || 'PROMO'}):</span>
                <span>-₹{order.discount.toLocaleString('en-IN')}</span>
              </div>
            )}
            {isIntraState ? (
              <>
                <div className="flex justify-between">
                  <span>CGST (9.0%):</span>
                  <span>₹{cgst.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span>SGST (9.0%):</span>
                  <span>₹{sgst.toLocaleString('en-IN')}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between">
                <span>IGST (18.0%):</span>
                <span>₹{igst.toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Insured Shipping:</span>
              <span>{order.shippingAmount === 0 ? 'FREE' : `₹${order.shippingAmount}`}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-300">
              <span>Invoice Total:</span>
              <span>₹{order.totalAmount.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* Declaration & Footer */}
        <div className="mt-8 pt-6 border-t border-slate-200 text-[10px] text-slate-500 space-y-2">
          <p><strong>Declaration:</strong> We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.</p>
          <p>This is a computer-generated invoice authenticated under the Indian Goods and Services Tax Act, 2017.</p>
        </div>

      </div>
    </div>
  );
};
