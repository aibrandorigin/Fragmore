import React, { useState, useEffect } from 'react';
import { Search, X, Check, XCircle, Bell, ShieldCheck, Printer, ArrowRight } from 'lucide-react';
import { erpApi, type ErpWorkspaceSnapshot } from '../../../lib/erpApi';

const MODULE_KEY_TO_NAV: Record<string, string> = {
  executive: 'DASHBOARD',
  procurement: 'PROCUREMENT',
  materials: 'ERP_MATERIALS',
  formulations: 'ERP_FORMULATIONS',
  batches: 'BATCH_PRODUCTION',
  quality: 'ERP_QUALITY',
  warehouse: 'ERP_WAREHOUSE',
  crm: 'ERP_CRM',
  sales: 'ORDERS',
  proposals: 'ERP_PROPOSALS',
  gst_billing: 'ERP_GST_BILLING',
  accounting: 'ERP_ACCOUNTING',
  marketing: 'ERP_MARKETING_WS',
  hr: 'ERP_HR',
  rbac: 'ERP_RBAC',
  reports: 'ERP_REPORTS',
  assistant: 'ERP_ASSISTANT',
  settings: 'ERP_SETTINGS_ORG'
};

export const ErpUniversalSearchModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onNavigateModule: (navKey: string) => void;
}> = ({ open, onClose, onNavigateModule }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await erpApi.search(query);
        setResults(res.results || []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [query, open]);

  if (!open) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-16 px-4"
    >
      <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl w-full max-w-2xl overflow-hidden shadow-xl">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#DED7CC]">
          <Search className="w-4 h-4 text-[#9A783E]" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Universal ERP Search: Materials, Formulations, Batches, GST Invoices, Leads, Orders, Staff..."
            className="flex-1 text-xs bg-transparent focus:outline-none text-[#24211D]"
          />
          <button onClick={onClose} className="text-[#686158] hover:text-[#24211D] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto divide-y divide-[#DED7CC]">
          {searching ? (
            <div className="p-6 text-center text-xs font-mono text-[#686158]">Searching PostgreSQL ERP...</div>
          ) : !query.trim() ? (
            <div className="p-6 text-center text-xs font-mono text-[#686158]">
              Type any code, customer, fragrance, SKU, invoice number, or employee name.
            </div>
          ) : results.length === 0 ? (
            <div className="p-6 text-center text-xs font-mono text-[#686158]">No matching records found.</div>
          ) : (
            results.map((r) => (
              <button
                key={`${r.category}-${r.id}`}
                onClick={() => {
                  onNavigateModule(MODULE_KEY_TO_NAV[r.moduleKey] || 'DASHBOARD');
                  onClose();
                }}
                className="w-full text-left px-4 py-3 hover:bg-[#FAF8F4] flex items-center justify-between gap-3 cursor-pointer"
              >
                <div className="min-w-0">
                  <span className="text-[10px] font-mono uppercase text-[#9A783E] block">{r.category}</span>
                  <span className="text-xs font-semibold text-[#24211D] block truncate">{r.title}</span>
                  <span className="text-[11px] font-mono text-[#686158] block truncate">{r.subtitle}</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-[#9A783E] shrink-0" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export const ErpApprovalsDrawer: React.FC<{
  open: boolean;
  onClose: () => void;
  snapshot: ErpWorkspaceSnapshot | null;
  onRefresh: () => Promise<void>;
  notify: (msg: string, type?: 'success' | 'error') => void;
}> = ({ open, onClose, snapshot, onRefresh, notify }) => {
  const [busyId, setBusyId] = useState<string | null>(null);
  if (!open || !snapshot) return null;

  const decide = async (id: string, decision: 'APPROVED' | 'REJECTED') => {
    setBusyId(id);
    try {
      await erpApi.decideApproval(id, decision);
      await onRefresh();
      notify(`Approval ${decision.toLowerCase()} & persisted.`, 'success');
    } catch (e: any) {
      notify(e?.message || 'Approval decision failed', 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-black/40 flex justify-end"
    >
      <div className="w-full max-w-md bg-[#FFFFFF] border-l border-[#DED7CC] h-full flex flex-col">
        <div className="px-5 py-4 border-b border-[#DED7CC] flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase text-[#9A783E] block">Governance Queue</span>
            <h3 className="font-serif text-lg uppercase text-[#24211D]">Approval Inbox</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-[#686158] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {snapshot.approvals.map((apr) => (
            <div key={apr.id} className="border border-[#DED7CC] rounded-lg p-3.5 space-y-2 text-xs bg-[#FAF8F4]">
              <div className="flex items-center justify-between font-mono text-[10px]">
                <span className="font-bold text-[#9A783E]">{apr.approvalNumber}</span>
                <span>{apr.status}</span>
              </div>
              <div className="font-semibold text-[#24211D]">{apr.title}</div>
              <p className="text-[#686158]">{apr.summary}</p>
              <div className="text-[11px] font-mono text-[#686158]">Requested by: {apr.requestedByEmail}</div>
              {apr.status === 'PENDING' && (
                <div className="flex gap-2 pt-2">
                  <button
                    disabled={busyId === apr.id}
                    onClick={() => decide(apr.id, 'APPROVED')}
                    className="flex-1 py-1.5 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] font-mono text-[11px] rounded cursor-pointer"
                  >
                    Approve
                  </button>
                  <button
                    disabled={busyId === apr.id}
                    onClick={() => decide(apr.id, 'REJECTED')}
                    className="flex-1 py-1.5 border border-[#DED7CC] bg-[#FFFFFF] text-rose-700 font-mono text-[11px] rounded cursor-pointer"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const ErpNotificationsDrawer: React.FC<{
  open: boolean;
  onClose: () => void;
  snapshot: ErpWorkspaceSnapshot | null;
  onRefresh: () => Promise<void>;
  onNavigateModule: (navKey: string) => void;
}> = ({ open, onClose, snapshot, onRefresh, onNavigateModule }) => {
  if (!open || !snapshot) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-black/40 flex justify-end"
    >
      <div className="w-full max-w-md bg-[#FFFFFF] border-l border-[#DED7CC] h-full flex flex-col">
        <div className="px-5 py-4 border-b border-[#DED7CC] flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase text-[#9A783E] block">Cross-Department Alerts</span>
            <h3 className="font-serif text-lg uppercase text-[#24211D]">ERP Notifications</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-[#686158] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {snapshot.notifications.map((n) => (
            <div
              key={n.id}
              className={`border rounded-lg p-3.5 space-y-1.5 text-xs ${
                n.isRead ? 'border-[#DED7CC] bg-[#FFFFFF]' : 'border-[#9A783E] bg-[#FAF8F4]'
              }`}
            >
              <div className="flex items-center justify-between font-mono text-[10px]">
                <span className="text-[#9A783E] font-bold">{n.departmentCode} · {n.category}</span>
                <span>{n.severity}</span>
              </div>
              <div className="font-semibold text-[#24211D]">{n.title}</div>
              <p className="text-[#686158]">{n.message}</p>
              <div className="flex justify-between pt-1.5">
                {n.linkModule && (
                  <button
                    onClick={() => {
                      onNavigateModule(MODULE_KEY_TO_NAV[n.linkModule] || 'DASHBOARD');
                      onClose();
                    }}
                    className="text-[11px] font-mono text-[#9A783E] hover:underline cursor-pointer"
                  >
                    Open Module →
                  </button>
                )}
                {!n.isRead && (
                  <button
                    onClick={async () => {
                      await erpApi.markNotificationRead(n.id);
                      await onRefresh();
                    }}
                    className="text-[11px] font-mono text-[#686158] hover:text-[#24211D] cursor-pointer"
                  >
                    Mark Read
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const ErpPrintableDocumentModal: React.FC<{
  invoice: any | null;
  reportData: { title: string; rows: any[] } | null;
  organization: any;
  onClose: () => void;
}> = ({ invoice, reportData, organization, onClose }) => {
  if (!invoice && !reportData) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto print:static print:bg-white print:p-0">
      <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl w-full max-w-3xl p-6 sm:p-8 space-y-6 text-xs text-[#24211D] print:border-0 print:w-full">
        <div className="flex items-center justify-between border-b border-[#DED7CC] pb-4 print:hidden">
          <span className="font-mono uppercase text-[#9A783E]">Print / Save PDF Preview</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-4 py-1.5 bg-[#24211D] text-[#FAF8F4] font-mono text-xs rounded flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save as PDF</span>
            </button>
            <button onClick={onClose} className="px-3 py-1.5 border border-[#DED7CC] rounded font-mono text-xs cursor-pointer">
              Close
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between gap-4 border-b border-[#DED7CC] pb-4">
          <div>
            <h2 className="font-serif text-2xl tracking-widest uppercase">FRAGMORÉ</h2>
            <p className="font-semibold mt-1">{organization?.legalName}</p>
            <p className="text-[#686158]">{organization?.registeredAddress}</p>
            <p className="font-mono mt-1">GSTIN: {organization?.gstin} · State: {organization?.stateName} ({organization?.stateCode})</p>
          </div>
          {invoice && (
            <div className="sm:text-right font-mono">
              <div className="text-sm font-bold text-[#9A783E]">TAX INVOICE</div>
              <div>No: {invoice.invoiceNumber}</div>
              <div>Date: {invoice.issueDate}</div>
              <div>Due: {invoice.dueDate}</div>
              <div>Bill To: {invoice.customerName}</div>
              {invoice.customerGstin && <div>Buyer GSTIN: {invoice.customerGstin}</div>}
              <div>Supply: {invoice.placeOfSupplyState}</div>
            </div>
          )}
        </div>

        {invoice && (
          <div className="space-y-4">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#24211D] font-mono text-[10px] uppercase">
                  <th className="py-2">Description / HSN</th>
                  <th className="py-2 text-right">Qty</th>
                  <th className="py-2 text-right">Taxable</th>
                  <th className="py-2 text-right">GST</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DED7CC]">
                {(invoice.items || []).map((it: any, i: number) => (
                  <tr key={i}>
                    <td className="py-2">
                      {it.description}
                      <span className="block font-mono text-[10px] text-[#686158]">HSN {it.hsnCode}</span>
                    </td>
                    <td className="py-2 text-right font-mono">{it.qty}</td>
                    <td className="py-2 text-right font-mono">₹{Number(it.taxableValueInr).toLocaleString('en-IN')}</td>
                    <td className="py-2 text-right font-mono">₹{Number((it.cgstInr || 0) + (it.sgstInr || 0) + (it.igstInr || 0)).toLocaleString('en-IN')}</td>
                    <td className="py-2 text-right font-mono font-semibold">₹{Number(it.totalInr).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-[#24211D] pt-3 flex flex-col items-end font-mono space-y-1">
              <div>Taxable Value: ₹{Number(invoice.taxableAmountInr).toLocaleString('en-IN')}</div>
              {invoice.isInterState ? (
                <div>IGST (18%): ₹{Number(invoice.igstAmountInr).toLocaleString('en-IN')}</div>
              ) : (
                <>
                  <div>CGST (9%): ₹{Number(invoice.cgstAmountInr).toLocaleString('en-IN')}</div>
                  <div>SGST (9%): ₹{Number(invoice.sgstAmountInr).toLocaleString('en-IN')}</div>
                </>
              )}
              <div className="text-base font-bold text-[#9A783E]">
                Grand Total: ₹{Number(invoice.grandTotalInr).toLocaleString('en-IN')}
              </div>
              <div>Paid: ₹{Number(invoice.amountPaidInr).toLocaleString('en-IN')} · Balance Due: ₹{Number(invoice.balanceDueInr).toLocaleString('en-IN')}</div>
            </div>
          </div>
        )}

        {reportData && (
          <div className="space-y-3">
            <h3 className="font-serif text-lg uppercase">{reportData.title}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-[#24211D] font-mono uppercase">
                    {reportData.rows[0] &&
                      Object.keys(reportData.rows[0])
                        .slice(0, 6)
                        .map((k) => (
                          <th key={k} className="py-1.5 pr-3">
                            {k}
                          </th>
                        ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DED7CC]">
                  {reportData.rows.slice(0, 40).map((row, idx) => (
                    <tr key={idx}>
                      {Object.keys(reportData.rows[0])
                        .slice(0, 6)
                        .map((k) => (
                          <td key={k} className="py-1.5 pr-3 font-mono truncate max-w-[160px]">
                            {typeof row[k] === 'object' ? JSON.stringify(row[k]) : String(row[k] ?? '')}
                          </td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
