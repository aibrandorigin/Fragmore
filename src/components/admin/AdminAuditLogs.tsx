import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../../context/StoreContext';
import {
  Search,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { ErpTableExportBar } from './erp/ErpUniversalExportModal';

export const AdminAuditLogs: React.FC = () => {
  const { auditLogs, clearAuditLogs, showNotification } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [confirmClear, setConfirmClear] = useState(false);
  const [dbLogs, setDbLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchServerAuditLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/audit-logs');
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows)) {
          setDbLogs(
            rows.map((r: any) => {
              const meta = r.metadata && typeof r.metadata === 'object' ? r.metadata : {};
              const rawDetails = String(r.details || '');
              const parts = rawDetails.includes(':') ? rawDetails.split(':') : ['System', rawDetails];
              return {
                id: r.id,
                action: r.action || 'ACTION',
                entity: meta.entity || parts[0]?.trim() || 'System',
                entityId: meta.entityId || '',
                user: r.adminEmail || r.user || 'Administrator',
                role: meta.role || 'SUPER_ADMIN',
                timestamp: r.createdAt
                  ? new Date(r.createdAt).toISOString().replace('T', ' ').substring(0, 19)
                  : r.timestamp || '',
                details: parts.length > 1 ? parts.slice(1).join(':').trim() : rawDetails
              };
            })
          );
        }
      }
    } catch {
      // ignore non-fatal error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServerAuditLogs();
  }, [fetchServerAuditLogs]);

  // Merge DB logs with current session logs, deduplicated by id
  const combinedLogs = React.useMemo(() => {
    const map = new Map<string, any>();
    for (const l of dbLogs) {
      if (l?.id) map.set(l.id, l);
    }
    for (const l of auditLogs) {
      if (l?.id && !map.has(l.id)) {
        map.set(l.id, {
          id: l.id,
          action: l.action || 'ACTION',
          entity: l.entity || 'System',
          entityId: l.entityId || '',
          user: l.user || (l as any).adminEmail || 'Administrator',
          role: l.role || 'SUPER_ADMIN',
          timestamp:
            l.timestamp ||
            ((l as any).createdAt
              ? new Date((l as any).createdAt).toISOString().replace('T', ' ').substring(0, 19)
              : ''),
          details: l.details || ''
        });
      }
    }
    return Array.from(map.values());
  }, [dbLogs, auditLogs]);

  const filteredLogs = combinedLogs.filter((log) => {
    const actionStr = String(log.action || '').toLowerCase();
    const entityStr = String(log.entity || '').toLowerCase();
    const detailsStr = String(log.details || '').toLowerCase();
    const userStr = String(log.user || '').toLowerCase();
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      actionStr.includes(q) || entityStr.includes(q) || detailsStr.includes(q) || userStr.includes(q);
    const matchesEntity =
      entityFilter === 'all' ||
      entityStr.includes(entityFilter.toLowerCase()) ||
      detailsStr.includes(entityFilter.toLowerCase());
    return matchesSearch && matchesEntity;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-mono text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-white/10 gap-4">
        <div>
          <h2 className="font-serif text-2xl uppercase tracking-wider text-white">
            Administrative Audit Trail &amp; Security Ledger
          </h2>
          <p className="text-xs text-white/50">
            Immutable chronological PostgreSQL record of administrative actions, pricing edits, stock allocations, and credential verifications.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ErpTableExportBar
            reportKey="custom_table"
            title="FRAGMORÉ Administrative Audit Trail & Security Ledger"
            customRows={filteredLogs.map((l) => ({
              timestamp: l.timestamp,
              user: l.user,
              role: l.role,
              action: l.action,
              entity: l.entity,
              entityId: l.entityId || '',
              details: l.details || ''
            }))}
            notify={(m) => showNotification(m)}
          />
          <button
            type="button"
            onClick={fetchServerAuditLogs}
            className="px-3.5 py-2 bg-white/10 hover:bg-white/15 text-white rounded flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#D4AF37] ${loading ? 'animate-spin' : ''}`} /> Refresh DB Logs
          </button>

          {!confirmClear ? (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear Session View
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  clearAuditLogs();
                  setConfirmClear(false);
                }}
                className="px-3 py-2 bg-rose-500 text-white font-bold rounded text-xs cursor-pointer"
              >
                Confirm Clear
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="px-2.5 py-2 bg-white/10 text-white/70 rounded text-xs cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2 flex items-center gap-3 bg-[#121218] border border-white/10 rounded-xl px-4 py-2.5">
          <Search className="w-4 h-4 text-white/40" />
          <input
            type="text"
            placeholder="Search audit trail by user, action, entity, or details..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent text-xs text-white placeholder-white/40 focus:outline-none flex-1"
          />
        </div>

        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="bg-[#121218] border border-white/10 text-white rounded-xl px-4 py-2.5 focus:outline-none"
        >
          <option value="all">All Entities ({combinedLogs.length})</option>
          <option value="Order">Orders</option>
          <option value="Product">Products</option>
          <option value="Inventory">Inventory</option>
          <option value="CMS">CMS &amp; Content</option>
          <option value="Coupon">Coupons</option>
          <option value="Customer">Customer CRM</option>
          <option value="Integration">Integrations</option>
          <option value="Marketing">Marketing</option>
          <option value="Returns">Returns &amp; Refunds</option>
        </select>
      </div>

      {/* Logs Table */}
      <div className="bg-[#121218] border border-white/10 rounded-xl overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/10 text-white/40 uppercase text-[10px]">
              <th className="p-3.5">Timestamp (UTC)</th>
              <th className="p-3.5">Administrator</th>
              <th className="p-3.5">Action</th>
              <th className="p-3.5">Target Entity</th>
              <th className="p-3.5">Specific Event Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredLogs.map((log) => (
              <tr key={log.id} className="hover:bg-white/[0.02]">
                <td className="p-3.5 text-white/50 text-[11px] whitespace-nowrap">
                  {log.timestamp}
                </td>
                <td className="p-3.5 whitespace-nowrap">
                  <strong className="text-white block font-medium">{log.user}</strong>
                  <span className="text-[#D4AF37] text-[10px]">{log.role}</span>
                </td>
                <td className="p-3.5 whitespace-nowrap">
                  <span className="text-emerald-400 font-bold text-[11px]">{log.action}</span>
                </td>
                <td className="p-3.5 whitespace-nowrap">
                  <span className="text-white/80 font-medium">{log.entity}</span>
                  {log.entityId && (
                    <span className="text-[10px] text-white/40 block">#{log.entityId}</span>
                  )}
                </td>
                <td className="p-3.5 text-white/70 max-w-md">{log.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
