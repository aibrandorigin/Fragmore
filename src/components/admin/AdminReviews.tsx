import React from 'react';
import { useStore } from '../../context/StoreContext';
import { Star, CheckCircle2 } from 'lucide-react';
import { AdminSupportRetentionCenter } from './AdminSupportRetentionCenter';
import { ErpTableExportBar } from './erp/ErpUniversalExportModal';

export const AdminReviews: React.FC = () => {
  const { reviews, updateReviewStatus, showNotification } = useStore();

  return (
    <div className="space-y-8 max-w-7xl mx-auto font-mono text-xs">
      <AdminSupportRetentionCenter initialTab="REVIEW_AUTOMATION" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-white/10 gap-4">
        <div>
          <h2 className="font-serif text-2xl uppercase tracking-wider text-white">
            Storefront Reviews &amp; Olfactory Moderation Queue
          </h2>
          <p className="text-xs text-white/50">
            Moderate verified flacon purchaser experiences and rating scores (1★–5★ authentic reviews treated equally).
          </p>
        </div>
        <ErpTableExportBar
          reportKey="custom_table"
          title="FRAGMORÉ Storefront Customer Reviews Register"
          customRows={reviews.map((r) => ({
            date: r.date,
            customerName: r.customerName,
            fragrance: r.productName,
            rating: r.rating,
            title: r.title,
            content: r.content,
            status: r.status
          }))}
          notify={(m) => showNotification(m)}
        />
      </div>

      {/* Reviews Table */}
      <div className="bg-[#121218] border border-white/10 rounded-xl overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/10 text-white/40 uppercase text-[10px]">
              <th className="p-4">Customer & Date</th>
              <th className="p-4">Fragrance</th>
              <th className="p-4">Rating</th>
              <th className="p-4">Review Content</th>
              <th className="p-4">Verified</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Moderation Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {reviews.map((rev) => (
              <tr key={rev.id} className="hover:bg-white/[0.02]">
                <td className="p-4">
                  <strong className="text-white block font-medium">{rev.customerName}</strong>
                  <span className="text-[10px] text-white/50">{rev.date}</span>
                </td>
                <td className="p-4 font-bold text-[#D4AF37] uppercase">{rev.productName}</td>
                <td className="p-4">
                  <div className="flex text-amber-400">
                    {[...Array(rev.rating)].map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-current" />
                    ))}
                  </div>
                </td>
                <td className="p-4 max-w-md">
                  <strong className="text-white block font-medium mb-0.5">{rev.title}</strong>
                  <p className="text-white/70 line-clamp-2">{rev.content}</p>
                </td>
                <td className="p-4">
                  <span className="text-emerald-400 flex items-center gap-1 text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Yes
                  </span>
                </td>
                <td className="p-4">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      rev.status === 'APPROVED'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-amber-500/10 text-amber-400'
                    }`}
                  >
                    {rev.status}
                  </span>
                </td>
                <td className="p-4 text-right space-x-2">
                  {rev.status !== 'APPROVED' && (
                    <button
                      onClick={() => updateReviewStatus(rev.id, 'APPROVED')}
                      className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                      title="Approve"
                    >
                      Approve
                    </button>
                  )}
                  {rev.status !== 'REJECTED' && (
                    <button
                      onClick={() => updateReviewStatus(rev.id, 'REJECTED')}
                      className="px-2.5 py-1 rounded bg-rose-500/20 text-rose-400 hover:bg-rose-500/30"
                      title="Reject"
                    >
                      Reject
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
};
