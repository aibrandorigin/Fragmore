import React, { useEffect, useState, useCallback } from 'react';
import {
  FileSpreadsheet,
  FileText,
  Printer,
  SlidersHorizontal,
  X,
  RefreshCw,
  Check,
  Clock,
  AlertCircle,
  Download
} from 'lucide-react';
import { erpApi, downloadVerifiedExportFile } from '../../../lib/erpApi';

export interface ErpUniversalExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportKey: string;
  defaultTitle?: string;
  customRows?: Array<Record<string, any>>;
  autoPrintOnOpen?: boolean;
  onAutoPrintHandled?: () => void;
  notify: (msg: string, type?: 'success' | 'error') => void;
}

export const ErpUniversalExportModal: React.FC<ErpUniversalExportModalProps> = ({
  isOpen,
  onClose,
  reportKey,
  defaultTitle,
  customRows,
  autoPrintOnOpen,
  onAutoPrintHandled,
  notify
}) => {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [allColumns, setAllColumns] = useState<Array<{ key: string; label: string; type: string }>>([]);
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<'XLSX' | 'PDF' | null>(null);
  const [asyncMode, setAsyncMode] = useState(false);
  const [activeJob, setActiveJob] = useState<any | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [printMode, setPrintMode] = useState(false);

  const loadPreview = useCallback(
    async (colsOverride?: string[]) => {
      if (!isOpen) return;
      setLoadingPreview(true);
      setErrorBanner(null);
      try {
        const res = await erpApi.previewReport({
          reportKey,
          filters: {
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
            statusFilter: statusFilter !== 'ALL' ? statusFilter : undefined,
            searchQuery: searchQuery.trim() || undefined,
            selectedColumns: colsOverride && colsOverride.length > 0 ? colsOverride : undefined,
            customTitle: defaultTitle,
            customRows: reportKey === 'custom_table' ? customRows : undefined
          }
        });
        setPreviewData(res);
        const metaCols = res?.meta?.allColumns || res?.activeColumns || [];
        setAllColumns(metaCols);
        if (!colsOverride) {
          setSelectedColumns(metaCols.map((c: any) => c.key));
        }
      } catch (e: any) {
        setErrorBanner(e?.message || 'Unable to load report preview.');
      } finally {
        setLoadingPreview(false);
      }
    },
    [isOpen, reportKey, dateFrom, dateTo, statusFilter, searchQuery, defaultTitle, customRows]
  );

  useEffect(() => {
    if (isOpen) {
      setActiveJob(null);
      setErrorBanner(null);
      loadPreview();
    }
  }, [isOpen, reportKey]);

  useEffect(() => {
    if (isOpen && autoPrintOnOpen && previewData && !loadingPreview) {
      onAutoPrintHandled?.();
      setPrintMode(true);
      const t = setTimeout(() => {
        window.print();
        setPrintMode(false);
      }, 180);
      return () => clearTimeout(t);
    }
  }, [isOpen, autoPrintOnOpen, previewData, loadingPreview, onAutoPrintHandled]);

  // Poll async job if queued/processing
  useEffect(() => {
    if (!activeJob || (activeJob.status !== 'QUEUED' && activeJob.status !== 'PROCESSING')) return;
    const timer = setInterval(async () => {
      try {
        const { job } = await erpApi.getExportJob(activeJob.id);
        setActiveJob(job);
        if (job.status === 'COMPLETED' && job.downloadUrl) {
          clearInterval(timer);
          const verified = await downloadVerifiedExportFile(job.downloadUrl, job.fileName);
          notify(
            `Verified ${job.format} downloaded (${verified.fileName} · ${(verified.sizeBytes / 1024).toFixed(1)} KB)`,
            'success'
          );
        } else if (job.status === 'FAILED') {
          clearInterval(timer);
          setErrorBanner(job.errorMessage || 'Async export job failed.');
        }
      } catch {
        // Wait for next poll cycle
      }
    }, 1200);
    return () => clearInterval(timer);
  }, [activeJob, notify]);

  if (!isOpen) return null;

  const toggleColumn = (colKey: string) => {
    setSelectedColumns((prev) => {
      if (prev.includes(colKey)) {
        if (prev.length === 1) return prev; // Keep at least 1 column
        return prev.filter((k) => k !== colKey);
      }
      return [...prev, colKey];
    });
  };

  const runExport = async (format: 'XLSX' | 'PDF') => {
    setExportingFormat(format);
    setErrorBanner(null);
    try {
      const res = await erpApi.createExportJob({
        reportKey,
        format,
        asyncMode,
        filters: {
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          statusFilter: statusFilter !== 'ALL' ? statusFilter : undefined,
          searchQuery: searchQuery.trim() || undefined,
          selectedColumns,
          customTitle: defaultTitle,
          customRows: reportKey === 'custom_table' ? customRows : undefined
        }
      });

      setActiveJob(res.job);

      if (res.queued) {
        notify(`Queued async ${format} job ${res.job.jobNumber}. Preparing file on server...`, 'success');
        return;
      }

      if (!res.downloadUrl) {
        throw new Error('Server did not return a signed download URL.');
      }

      const verified = await downloadVerifiedExportFile(res.downloadUrl, res.job?.fileName);
      notify(
        `Downloaded ${verified.fileName} (${(verified.sizeBytes / 1024).toFixed(1)} KB · ${res.job?.rowCount ?? 0} rows)`,
        'success'
      );
    } catch (e: any) {
      const msg = e?.message || `Failed to export ${format}`;
      setErrorBanner(msg);
      notify(msg, 'error');
    } finally {
      setExportingFormat(null);
    }
  };

  const handleRetryJob = async () => {
    if (!activeJob?.id) return;
    setErrorBanner(null);
    setExportingFormat(activeJob.format);
    try {
      const res = await erpApi.retryExportJob(activeJob.id);
      setActiveJob(res.job);
      if (res.downloadUrl) {
        const verified = await downloadVerifiedExportFile(res.downloadUrl, res.job?.fileName);
        notify(`Retried & downloaded ${verified.fileName} (${(verified.sizeBytes / 1024).toFixed(1)} KB)`, 'success');
      }
    } catch (e: any) {
      setErrorBanner(e?.message || 'Retry failed');
      notify(e?.message || 'Retry failed', 'error');
    } finally {
      setExportingFormat(null);
    }
  };

  const handleTriggerPrint = () => {
    setPrintMode(true);
    setTimeout(() => {
      window.print();
      setPrintMode(false);
    }, 150);
  };

  const formatCellDisplay = (val: any, type: string) => {
    if (val === null || val === undefined || val === '') return '—';
    if (type === 'currency') {
      const n = Number(val);
      return Number.isFinite(n)
        ? `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : String(val);
    }
    if (type === 'number') {
      const n = Number(val);
      return Number.isFinite(n) ? n.toLocaleString('en-IN') : String(val);
    }
    return String(val);
  };

  const displayedCols = allColumns.filter((c) => selectedColumns.includes(c.key));
  const org = previewData?.organization || {};

  return (
    <div className="fixed inset-0 z-50 bg-[#24211D]/60 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div
        className={`w-full max-w-6xl bg-[#FAF8F4] border border-[#DED7CC] rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[92vh] ${
          printMode ? 'max-h-none shadow-none border-0 bg-white' : ''
        }`}
      >
        {/* Official FRAGMORÉ Modal Header */}
        <div className="bg-[#FFFFFF] border-b border-[#DED7CC] px-5 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-[#9A783E]">
              FRAGMORÉ Centralized Reporting &amp; Document Export Engine
            </p>
            <h3 className="font-serif text-xl text-[#24211D] mt-0.5">
              {previewData?.meta?.title || defaultTitle || reportKey}
            </h3>
            {org.legalName && (
              <p className="text-[11px] font-mono text-[#686158] mt-0.5 tabular-nums">
                {org.legalName} · GSTIN: {org.gstin} · Records: {previewData?.totalRowCount ?? 0}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <label className="flex items-center gap-1.5 text-[11px] font-mono text-[#686158] mr-2 cursor-pointer">
              <input
                type="checkbox"
                checked={asyncMode}
                onChange={(e) => setAsyncMode(e.target.checked)}
                className="accent-[#9A783E]"
              />
              <span>Async Background Job</span>
            </label>
            <button
              disabled={Boolean(exportingFormat) || loadingPreview}
              onClick={() => runExport('XLSX')}
              className="px-3.5 py-2 bg-[#FFFFFF] border border-[#DED7CC] hover:border-[#9A783E] text-[#24211D] rounded text-xs font-mono uppercase flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              <span>{exportingFormat === 'XLSX' ? 'Generating...' : 'Download .XLSX'}</span>
            </button>
            <button
              disabled={Boolean(exportingFormat) || loadingPreview}
              onClick={() => runExport('PDF')}
              className="px-3.5 py-2 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] rounded text-xs font-mono uppercase flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{exportingFormat === 'PDF' ? 'Rendering...' : 'Download PDF'}</span>
            </button>
            <button
              onClick={handleTriggerPrint}
              className="px-3 py-2 bg-[#FFFFFF] border border-[#DED7CC] hover:border-[#24211D] text-[#24211D] rounded text-xs font-mono uppercase flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-[#686158] hover:text-[#24211D] cursor-pointer"
              aria-label="Close export studio"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filters, Date Range & Column Selection Controls */}
        <div className="p-4 bg-[#FAF8F4] border-b border-[#DED7CC] space-y-3 print:hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            <div>
              <label className="block text-[10px] font-mono uppercase text-[#686158] mb-1">From Date</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[#FFFFFF] border border-[#DED7CC] rounded text-xs font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase text-[#686158] mb-1">To Date</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[#FFFFFF] border border-[#DED7CC] rounded text-xs font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase text-[#686158] mb-1">Status Filter</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[#FFFFFF] border border-[#DED7CC] rounded text-xs font-mono"
              >
                <option value="ALL">ALL STATUSES</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="APPROVED">APPROVED</option>
                <option value="ISSUED">ISSUED</option>
                <option value="PAID">PAID</option>
                <option value="UNPAID">UNPAID</option>
                <option value="PENDING">PENDING</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="DONE">DONE</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase text-[#686158] mb-1">Keyword Filter</label>
              <input
                placeholder="Search party, SKU, doc #..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[#FFFFFF] border border-[#DED7CC] rounded text-xs"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={() => loadPreview(selectedColumns)}
                disabled={loadingPreview}
                className="w-full py-1.5 px-3 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] rounded text-xs font-mono uppercase flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingPreview ? 'animate-spin' : ''}`} />
                <span>Apply &amp; Preview</span>
              </button>
            </div>
          </div>

          {/* Column Selection Bar */}
          {allColumns.length > 0 && (
            <div className="pt-2 border-t border-[#DED7CC]/70">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-mono uppercase text-[#686158]">
                  Included Columns ({selectedColumns.length} / {allColumns.length})
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedColumns(allColumns.map((c) => c.key))}
                  className="text-[10px] font-mono uppercase text-[#9A783E] hover:underline cursor-pointer"
                >
                  Select All Columns
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {allColumns.map((col) => {
                  const active = selectedColumns.includes(col.key);
                  return (
                    <button
                      key={col.key}
                      type="button"
                      onClick={() => toggleColumn(col.key)}
                      className={`px-2.5 py-1 rounded text-[11px] font-mono border flex items-center gap-1 cursor-pointer transition-colors ${
                        active
                          ? 'bg-[#24211D] text-[#FAF8F4] border-[#24211D]'
                          : 'bg-[#FFFFFF] text-[#686158] border-[#DED7CC] hover:border-[#9A783E]'
                      }`}
                    >
                      {active && <Check className="w-3 h-3 text-[#9A783E]" />}
                      <span>{col.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Error or Active Async Job Status Strip */}
          {errorBanner && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded flex items-center justify-between gap-3 text-xs text-rose-800">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorBanner}</span>
              </div>
              {activeJob?.id && (
                <button
                  onClick={handleRetryJob}
                  className="px-2.5 py-1 bg-rose-800 text-white rounded font-mono text-[11px] uppercase cursor-pointer"
                >
                  Retry Export
                </button>
              )}
            </div>
          )}

          {activeJob && !errorBanner && (
            <div className="p-2.5 bg-[#FFFFFF] border border-[#DED7CC] rounded flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
              <div className="flex items-center gap-2 text-[#24211D]">
                <Clock className="w-3.5 h-3.5 text-[#9A783E]" />
                <span>
                  Job {activeJob.jobNumber} · {activeJob.format} · Status: {activeJob.status}
                </span>
              </div>
              {activeJob.downloadUrl && activeJob.status === 'COMPLETED' && (
                <button
                  onClick={async () => {
                    try {
                      const v = await downloadVerifiedExportFile(activeJob.downloadUrl, activeJob.fileName);
                      notify(`Re-downloaded ${v.fileName}`, 'success');
                    } catch (err: any) {
                      notify(err?.message || 'Download expired', 'error');
                    }
                  }}
                  className="px-2.5 py-1 bg-[#24211D] text-[#FAF8F4] rounded text-[11px] uppercase flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  <span>Download Again (30m Link)</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Live Report Preview Table */}
        <div className="flex-1 overflow-auto p-4 bg-[#FFFFFF]">
          {loadingPreview ? (
            <div className="py-16 text-center text-xs font-mono text-[#686158]">
              Loading server-validated report preview...
            </div>
          ) : !previewData ? (
            <div className="py-16 text-center text-xs font-mono text-[#686158]">
              Select report criteria and click Apply &amp; Preview.
            </div>
          ) : (
            <div className="border border-[#DED7CC] rounded overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#24211D] text-[#FAF8F4] font-mono text-[10px] uppercase">
                  <tr>
                    {displayedCols.map((col) => (
                      <th
                        key={col.key}
                        className={`py-2.5 px-3 border-b border-[#9A783E] whitespace-nowrap ${
                          col.type === 'currency' || col.type === 'number' ? 'text-right' : 'text-left'
                        }`}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DED7CC]">
                  {(previewData.previewRows || []).length === 0 ? (
                    <tr>
                      <td colSpan={Math.max(1, displayedCols.length)} className="py-8 text-center text-[#686158] font-mono">
                        No records match the current date range or filter.
                      </td>
                    </tr>
                  ) : (
                    (previewData.previewRows || []).map((row: any, rIdx: number) => (
                      <tr key={rIdx} className={rIdx % 2 === 1 ? 'bg-[#FAF8F4]/70' : 'bg-[#FFFFFF]'}>
                        {displayedCols.map((col) => (
                          <td
                            key={col.key}
                            className={`py-2 px-3 tabular-nums ${
                              col.type === 'currency' || col.type === 'number'
                                ? 'text-right font-mono'
                                : 'text-left text-[#24211D]'
                            }`}
                          >
                            {formatCellDisplay(row[col.key], col.type)}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
                {previewData.totals && Object.keys(previewData.totals).length > 0 && (
                  <tfoot className="bg-[#FAF8F4] border-t-2 border-[#24211D] font-mono font-bold text-xs">
                    <tr>
                      {displayedCols.map((col, idx) => (
                        <td
                          key={col.key}
                          className={`py-2.5 px-3 tabular-nums ${
                            col.type === 'currency' || col.type === 'number' ? 'text-right' : 'text-left'
                          }`}
                        >
                          {idx === 0
                            ? 'TOTALS'
                            : previewData.totals[col.key] !== undefined
                            ? formatCellDisplay(previewData.totals[col.key], col.type)
                            : ''}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Compact Universal Export Toolbar Bar for embedding inside any Admin / ERP Module Header
 */
export const ErpTableExportBar: React.FC<{
  reportKey: string;
  title?: string;
  customRows?: Array<Record<string, any>>;
  notify: (msg: string, type?: 'success' | 'error') => void;
}> = ({ reportKey, title, customRows, notify }) => {
  const [open, setOpen] = useState(false);
  const [autoPrint, setAutoPrint] = useState(false);
  const [quickBusy, setQuickBusy] = useState<'XLSX' | 'PDF' | null>(null);

  const quickDownload = async (format: 'XLSX' | 'PDF') => {
    setQuickBusy(format);
    try {
      const res = await erpApi.createExportJob({
        reportKey,
        format,
        filters: {
          customTitle: title,
          customRows: reportKey === 'custom_table' ? customRows : undefined
        }
      });
      if (res.queued) {
        notify(`Large ${format} export queued (${res.job.jobNumber}). Open Export Studio to monitor.`, 'success');
        setOpen(true);
        return;
      }
      if (!res.downloadUrl) throw new Error('Missing download URL from export engine.');
      const verified = await downloadVerifiedExportFile(res.downloadUrl, res.job?.fileName);
      notify(`Exported ${verified.fileName} (${(verified.sizeBytes / 1024).toFixed(1)} KB)`, 'success');
    } catch (e: any) {
      notify(e?.message || `${format} export failed`, 'error');
    } finally {
      setQuickBusy(null);
    }
  };

  return (
    <>
      <div className="inline-flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            setAutoPrint(false);
            setOpen(true);
          }}
          className="px-2.5 py-1.5 bg-[#FFFFFF] border border-[#DED7CC] hover:border-[#9A783E] text-[#24211D] rounded text-[11px] font-mono uppercase inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <SlidersHorizontal className="w-3 h-3 text-[#9A783E] shrink-0" />
          <span>Preview &amp; Filters</span>
        </button>
        <button
          type="button"
          disabled={Boolean(quickBusy)}
          onClick={() => quickDownload('XLSX')}
          className="px-2.5 py-1.5 bg-[#FFFFFF] border border-[#DED7CC] hover:border-[#9A783E] text-[#24211D] rounded text-[11px] font-mono uppercase inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
        >
          <FileSpreadsheet className="w-3 h-3 text-emerald-700 shrink-0" />
          <span>{quickBusy === 'XLSX' ? '...' : '.XLSX'}</span>
        </button>
        <button
          type="button"
          disabled={Boolean(quickBusy)}
          onClick={() => quickDownload('PDF')}
          className="px-2.5 py-1.5 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] rounded text-[11px] font-mono uppercase inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
        >
          <FileText className="w-3 h-3 shrink-0" />
          <span>{quickBusy === 'PDF' ? '...' : 'PDF'}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setAutoPrint(true);
            setOpen(true);
          }}
          className="px-2.5 py-1.5 bg-[#FFFFFF] border border-[#DED7CC] hover:border-[#24211D] text-[#24211D] rounded text-[11px] font-mono uppercase inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Printer className="w-3 h-3 text-[#686158] shrink-0" />
          <span>Print</span>
        </button>
      </div>
      <ErpUniversalExportModal
        isOpen={open}
        onClose={() => {
          setAutoPrint(false);
          setOpen(false);
        }}
        reportKey={reportKey}
        defaultTitle={title}
        customRows={customRows}
        autoPrintOnOpen={autoPrint}
        onAutoPrintHandled={() => setAutoPrint(false)}
        notify={notify}
      />
    </>
  );
};
