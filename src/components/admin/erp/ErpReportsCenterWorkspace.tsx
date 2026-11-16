import React, { useEffect, useState, useCallback } from 'react';
import {
  FileSpreadsheet,
  FileText,
  SlidersHorizontal,
  Lock,
  RefreshCw,
  Download,
  RotateCcw,
  ShieldCheck,
  Database
} from 'lucide-react';
import { erpApi, downloadVerifiedExportFile, downloadCompleteDatabaseBackup } from '../../../lib/erpApi';
import { ErpUniversalExportModal } from './ErpUniversalExportModal';

interface Props {
  notify: (msg: string, type?: 'success' | 'error') => void;
}

const DOMAIN_GROUPS = [
  { id: 'ALL', label: 'All Enterprise Reports' },
  { id: 'PROCUREMENT_INVENTORY', label: 'Procurement & Inventory' },
  { id: 'MANUFACTURING_RD_QC', label: 'Formulation, Batch & QC' },
  { id: 'SALES_CRM_COMMERCIAL', label: 'Sales, CRM & Proposals' },
  { id: 'GST_ACCOUNTING_FINANCE', label: 'GST Billing, P&L & Balance Sheet' },
  { id: 'MARKETING_HR_OPERATIONS', label: 'Marketing, Interns & Tasks' }
] as const;

export const ErpReportsCenterWorkspace: React.FC<Props> = ({ notify }) => {
  const [catalog, setCatalog] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [actor, setActor] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeGroup, setActiveGroup] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [modalReport, setModalReport] = useState<{ reportKey: string; title: string } | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [fullDbBusy, setFullDbBusy] = useState<'json' | 'xlsx' | null>(null);

  const handleCompleteDatabaseDownload = async (format: 'json' | 'xlsx') => {
    setFullDbBusy(format);
    try {
      const res = await downloadCompleteDatabaseBackup(format);
      notify(
        `Complete Firestore database backup ready: ${res.fileName} (${res.totalDocuments.toLocaleString('en-IN')} documents across ${res.populatedCollections}/${res.totalCollections} collections · ${(res.sizeBytes / 1024).toFixed(1)} KB).`,
        'success'
      );
      await loadHub();
    } catch (e: any) {
      notify(e?.message || `Complete database ${format.toUpperCase()} backup failed`, 'error');
    } finally {
      setFullDbBusy(null);
    }
  };

  const loadHub = useCallback(async () => {
    setLoading(true);
    try {
      const res = await erpApi.getExportCatalog();
      setCatalog(res.catalog || []);
      setJobs(res.jobs || []);
      setActor(res.actor || null);
    } catch (e: any) {
      notify(e?.message || 'Failed to load Centralized Export Hub', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadHub();
  }, [loadHub]);

  const handleDirectExport = async (reportKey: string, format: 'XLSX' | 'PDF', asyncMode = false) => {
    const tokenKey = `${reportKey}:${format}`;
    setBusyKey(tokenKey);
    try {
      const res = await erpApi.createExportJob({ reportKey, format, asyncMode });
      await loadHub();

      if (res.queued) {
        notify(`Queued async ${format} job ${res.job.jobNumber}. Refreshing job ledger...`, 'success');
        return;
      }
      if (!res.downloadUrl) {
        throw new Error('Server did not return a signed download link.');
      }
      const verified = await downloadVerifiedExportFile(res.downloadUrl, res.job?.fileName);
      await loadHub();
      notify(
        `Verified ${format} downloaded: ${verified.fileName} (${(verified.sizeBytes / 1024).toFixed(1)} KB · ${res.job?.rowCount ?? 0} rows)`,
        'success'
      );
    } catch (e: any) {
      notify(e?.message || `Export failed for ${reportKey}`, 'error');
      await loadHub();
    } finally {
      setBusyKey(null);
    }
  };

  const handleRetry = async (jobId: string) => {
    setBusyKey(jobId);
    try {
      const res = await erpApi.retryExportJob(jobId);
      await loadHub();
      if (res.downloadUrl) {
        const verified = await downloadVerifiedExportFile(res.downloadUrl, res.job?.fileName);
        notify(`Retried & downloaded ${verified.fileName}`, 'success');
      }
    } catch (e: any) {
      notify(e?.message || 'Retry failed', 'error');
    } finally {
      setBusyKey(null);
    }
  };

  const filteredCatalog = catalog.filter((item) => {
    if (activeGroup !== 'ALL' && item.categoryGroup !== activeGroup) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.reportKey.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-[#DED7CC] pb-4">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-widest text-[#9A783E]">
            Module 16 · Centralized Reporting &amp; Document Export Engine
          </p>
          <h2 className="font-serif text-2xl sm:text-3xl text-[#24211D] uppercase tracking-wider mt-1">
            Enterprise BI, Branded PDF &amp; Genuine .XLSX Hub
          </h2>
          <p className="text-xs text-[#686158] mt-1">
            Server-validated OpenXML spreadsheets with formulas &amp; frozen headers, vector-crested FRAGMORÉ PDFs, formula-injection sanitization, expiring SHA-256 tokens &amp; RBAC audit logging.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
          {(actor?.isSuperAdmin || actor?.roleCode === 'SUPER_ADMIN') && (
            <>
              <button
                onClick={() => handleCompleteDatabaseDownload('json')}
                disabled={Boolean(fullDbBusy)}
                className="px-3.5 py-2 bg-[#FFFFFF] border border-[#DED7CC] hover:border-[#9A783E] rounded text-xs font-mono uppercase flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Database className="w-3.5 h-3.5 text-[#9A783E]" />
                <span>{fullDbBusy === 'json' ? 'Exporting DB...' : 'Full DB (.JSON)'}</span>
              </button>
              <button
                onClick={() => handleCompleteDatabaseDownload('xlsx')}
                disabled={Boolean(fullDbBusy)}
                className="px-3.5 py-2 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] rounded text-xs font-mono uppercase flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>{fullDbBusy === 'xlsx' ? 'Building Workbook...' : 'Full DB (.XLSX)'}</span>
              </button>
            </>
          )}
          <button
            onClick={loadHub}
            disabled={loading}
            className="px-3.5 py-2 bg-[#FFFFFF] border border-[#DED7CC] hover:border-[#9A783E] rounded text-xs font-mono uppercase flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Catalog &amp; Jobs</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 border border-[#DED7CC] bg-[#FFFFFF] divide-y sm:divide-y-0 sm:divide-x divide-[#DED7CC] rounded-lg">
        <div className="p-4">
          <span className="text-[10px] font-mono uppercase text-[#686158] block">Registered Report Categories</span>
          <span className="text-xl font-mono font-bold tabular-nums">{catalog.length}</span>
        </div>
        <div className="p-4">
          <span className="text-[10px] font-mono uppercase text-[#686158] block">Authorized for {actor?.roleCode || 'User'}</span>
          <span className="text-xl font-mono font-bold tabular-nums text-emerald-700">
            {catalog.filter((c) => c.permitted).length}
          </span>
        </div>
        <div className="p-4">
          <span className="text-[10px] font-mono uppercase text-[#686158] block">Restricted by RBAC Shield</span>
          <span className="text-xl font-mono font-bold tabular-nums text-[#9A783E]">
            {catalog.filter((c) => !c.permitted).length}
          </span>
        </div>
        <div className="p-4">
          <span className="text-[10px] font-mono uppercase text-[#686158] block">Logged Export Audit Jobs</span>
          <span className="text-xl font-mono font-bold tabular-nums">{jobs.length}</span>
        </div>
      </div>

      {/* Domain Filter & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {DOMAIN_GROUPS.map((grp) => (
            <button
              key={grp.id}
              onClick={() => setActiveGroup(grp.id)}
              className={`px-3 py-1.5 rounded text-xs font-mono cursor-pointer ${
                activeGroup === grp.id
                  ? 'bg-[#24211D] text-[#FAF8F4]'
                  : 'bg-[#FFFFFF] border border-[#DED7CC] text-[#24211D] hover:border-[#9A783E]'
              }`}
            >
              {grp.label}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search 27+ enterprise reports..."
          className="px-3 py-1.5 bg-[#FFFFFF] border border-[#DED7CC] rounded text-xs w-full md:w-64"
        />
      </div>

      {/* Report Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCatalog.map((rep) => {
          const isBusyXlsx = busyKey === `${rep.reportKey}:XLSX`;
          const isBusyPdf = busyKey === `${rep.reportKey}:PDF`;

          return (
            <div
              key={rep.reportKey}
              className={`border rounded-lg p-4 flex flex-col justify-between space-y-4 ${
                rep.permitted
                  ? 'border-[#DED7CC] bg-[#FFFFFF]'
                  : 'border-[#DED7CC]/70 bg-[#FAF8F4] opacity-80'
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-mono uppercase">
                  <span className="text-[#9A783E]">{rep.moduleKey}</span>
                  <span className="text-[#686158]">{rep.columns?.length || 0} Cols</span>
                </div>
                <h3 className="font-serif text-base text-[#24211D] leading-snug">{rep.title}</h3>
                <p className="text-xs text-[#686158] leading-relaxed">{rep.description}</p>
                {rep.sensitivity !== 'STANDARD' && (
                  <p className="text-[10px] font-mono text-[#9A783E] flex items-center gap-1 pt-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Classification: {rep.sensitivity}</span>
                  </p>
                )}
              </div>

              {rep.permitted ? (
                <div className="pt-3 border-t border-[#DED7CC] flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => setModalReport({ reportKey: rep.reportKey, title: rep.title })}
                    className="px-2.5 py-1.5 bg-[#FAF8F4] border border-[#DED7CC] hover:border-[#9A783E] rounded text-[11px] font-mono uppercase flex items-center gap-1 cursor-pointer"
                  >
                    <SlidersHorizontal className="w-3 h-3 text-[#9A783E]" />
                    <span>Preview &amp; Filter</span>
                  </button>
                  <button
                    disabled={Boolean(busyKey)}
                    onClick={() => handleDirectExport(rep.reportKey, 'XLSX')}
                    className="px-2.5 py-1.5 bg-[#FFFFFF] border border-[#DED7CC] hover:border-[#9A783E] rounded text-[11px] font-mono uppercase flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <FileSpreadsheet className="w-3 h-3 text-emerald-700" />
                    <span>{isBusyXlsx ? '...' : '.XLSX'}</span>
                  </button>
                  <button
                    disabled={Boolean(busyKey)}
                    onClick={() => handleDirectExport(rep.reportKey, 'PDF')}
                    className="px-2.5 py-1.5 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] rounded text-[11px] font-mono uppercase flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <FileText className="w-3 h-3" />
                    <span>{isBusyPdf ? '...' : 'PDF'}</span>
                  </button>
                </div>
              ) : (
                <div className="pt-3 border-t border-[#DED7CC] flex items-center gap-1.5 text-[11px] font-mono text-[#686158]">
                  <Lock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  <span className="truncate" title={rep.restrictionReason}>
                    Restricted ({actor?.roleCode})
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Export Audit Log & Async Job Queue */}
      <div className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-[#FAF8F4] border-b border-[#DED7CC] flex items-center justify-between">
          <div>
            <h3 className="text-xs font-mono uppercase font-semibold text-[#24211D]">
              Export Audit Ledger &amp; Expiring Signed Downloads ({jobs.length})
            </h3>
            <p className="text-[11px] text-[#686158]">
              Every export is audited with actor email, role, filters, row count, and 30-minute expiring download link.
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
              <tr>
                <th className="py-2.5 px-3">Doc # / Timestamp</th>
                <th className="py-2.5 px-3">Report Title</th>
                <th className="py-2.5 px-3">Format / Mode</th>
                <th className="py-2.5 px-3 text-right">Rows / Size</th>
                <th className="py-2.5 px-3">Requested By</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DED7CC]">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center font-mono text-[#686158]">
                    No export jobs generated yet in this session.
                  </td>
                </tr>
              ) : (
                jobs.map((j) => (
                  <tr key={j.id}>
                    <td className="py-2.5 px-3 font-mono tabular-nums">
                      <span className="font-bold text-[#9A783E] block">{j.jobNumber}</span>
                      <span className="text-[10px] text-[#686158]">
                        {String(j.createdAt || '').slice(0, 16).replace('T', ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-[#24211D]">{j.reportTitle}</td>
                    <td className="py-2.5 px-3 font-mono text-[11px]">
                      {j.format} · {j.executionMode}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-right tabular-nums">
                      {j.rowCount} rows · {j.fileSizeBytes ? `${(j.fileSizeBytes / 1024).toFixed(1)} KB` : '—'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px]">
                      {j.requestedByEmail} ({j.requestedByRole})
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px]">
                      {j.isExpired ? 'EXPIRED' : j.status}
                    </td>
                    <td className="py-2.5 px-3 text-right space-x-1.5">
                      {j.downloadUrl && !j.isExpired && j.status === 'COMPLETED' && (
                        <button
                          onClick={async () => {
                            try {
                              const v = await downloadVerifiedExportFile(j.downloadUrl, j.fileName);
                              await loadHub();
                              notify(`Downloaded ${v.fileName}`, 'success');
                            } catch (err: any) {
                              notify(err?.message || 'Download failed', 'error');
                            }
                          }}
                          className="px-2.5 py-1 bg-[#24211D] text-[#FAF8F4] rounded text-[10px] font-mono uppercase inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Download className="w-3 h-3" />
                          <span>Download</span>
                        </button>
                      )}
                      {(j.status === 'FAILED' || j.isExpired) && (
                        <button
                          disabled={busyKey === j.id}
                          onClick={() => handleRetry(j.id)}
                          className="px-2.5 py-1 border border-[#DED7CC] hover:border-[#9A783E] rounded text-[10px] font-mono uppercase inline-flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Regenerate</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalReport && (
        <ErpUniversalExportModal
          isOpen={Boolean(modalReport)}
          onClose={() => {
            setModalReport(null);
            loadHub();
          }}
          reportKey={modalReport.reportKey}
          defaultTitle={modalReport.title}
          notify={notify}
        />
      )}
    </div>
  );
};
