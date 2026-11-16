import React from 'react';
import { Printer, FileSpreadsheet, X, ShieldCheck, AlertTriangle } from 'lucide-react';
import { downloadExcelSpreadsheet, downloadCsvFile } from '../../../lib/erpApi';

export type SamplingQcPrintDoc =
  | {
      type: 'SAMPLE_LABEL';
      sample: any;
      formulaVersion?: any;
      organization?: any;
    }
  | {
      type: 'QC_CERTIFICATE';
      qcRecord: any;
      sample?: any;
      organization?: any;
    }
  | {
      type: 'SAMPLING_QC_REPORT';
      reportTitle: string;
      rows: any[];
      summaryLines?: Array<{ label: string; value: string }>;
      organization?: any;
    };

interface Props {
  doc: SamplingQcPrintDoc | null;
  onClose: () => void;
}

export const SamplingQcPrintModal: React.FC<Props> = ({ doc, onClose }) => {
  if (!doc) return null;

  const org = (doc as any).organization || {
    legalName: 'FRAGMORÉ LUXURY PERFUMERY PVT. LTD.',
    gstin: '27AAACF9102K1Z8',
    registeredAddress: 'Suite 402, Kala Ghoda Atelier, Fort, Mumbai, Maharashtra 400001'
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportXls = () => {
    if (doc.type === 'SAMPLE_LABEL') {
      downloadExcelSpreadsheet(
        `${doc.sample.sampleNumber}-label.xls`,
        `Sample Label ${doc.sample.sampleNumber}`,
        [doc.sample]
      );
    } else if (doc.type === 'QC_CERTIFICATE') {
      downloadExcelSpreadsheet(
        `${doc.qcRecord.certificateNumber || doc.qcRecord.qcNumber}-coa.xls`,
        `COA ${doc.qcRecord.qcNumber}`,
        [doc.qcRecord]
      );
    } else {
      downloadExcelSpreadsheet(
        `fragmore-sampling-qc-report.xls`,
        doc.reportTitle,
        doc.rows.length ? doc.rows : [{ Status: 'No rows' }]
      );
    }
  };

  const handleExportCsv = () => {
    if (doc.type === 'SAMPLE_LABEL') {
      downloadCsvFile(`${doc.sample.sampleNumber}.csv`, [doc.sample]);
    } else if (doc.type === 'QC_CERTIFICATE') {
      downloadCsvFile(`${doc.qcRecord.qcNumber}.csv`, [doc.qcRecord]);
    } else {
      downloadCsvFile(`fragmore-sampling-qc-report.csv`, doc.rows);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#24211D]/60 flex items-center justify-center p-4 overflow-y-auto print:bg-white print:p-0">
      <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-lg max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-xl print:border-0 print:shadow-none print:max-h-none">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#DED7CC] bg-[#FAF8F4] print:hidden">
          <span className="text-xs font-mono uppercase tracking-wider text-[#24211D] font-semibold">
            {doc.type === 'SAMPLE_LABEL'
              ? `Printable Atelier Sample Label · ${doc.sample.sampleNumber}`
              : doc.type === 'QC_CERTIFICATE'
              ? `Certificate of Analysis (COA) · ${doc.qcRecord.certificateNumber || doc.qcRecord.qcNumber}`
              : `Report Preview · ${doc.reportTitle}`}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              className="px-3 py-1.5 border border-[#DED7CC] bg-[#FFFFFF] hover:border-[#9A783E] text-xs font-mono rounded flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#9A783E]" />
              <span>CSV</span>
            </button>
            <button
              onClick={handleExportXls}
              className="px-3 py-1.5 border border-[#DED7CC] bg-[#FFFFFF] hover:border-[#9A783E] text-xs font-mono rounded flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#9A783E]" />
              <span>Excel (.xls)</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono rounded flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-[#686158] hover:text-[#24211D] cursor-pointer"
              aria-label="Close print preview"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-6 text-[#24211D] space-y-5">
          {doc.type === 'SAMPLE_LABEL' && (
            <div className="max-w-lg mx-auto border-2 border-[#24211D] p-6 bg-[#FAF8F4] space-y-4">
              <div className="flex items-start justify-between border-b border-[#24211D] pb-3">
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-[#9A783E]">FRAGMORÉ R&amp;D ATELIER</p>
                  <h3 className="font-serif text-xl uppercase tracking-wider text-[#24211D] mt-0.5">
                    {doc.sample.fragranceName}
                  </h3>
                </div>
                <div className="text-right font-mono text-xs">
                  <span className="font-bold block">{doc.sample.sampleNumber}</span>
                  <span className="text-[10px] text-[#686158]">Rev #{doc.sample.revisionNumber || 1}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div>
                  <span className="text-[10px] uppercase text-[#686158] block">Purpose</span>
                  <strong>{String(doc.sample.purpose || doc.sample.sampleType).replace(/_/g, ' ')}</strong>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-[#686158] block">Fill &amp; Units</span>
                  <strong>{doc.sample.quantityUnits || 1} × {doc.sample.volumeMl} mL (Mild Gold)</strong>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-[#686158] block">Formulation Ref</span>
                  <strong>
                    {doc.formulaVersion ? `v${doc.formulaVersion.versionNumber}` : doc.sample.formulationId || 'Custom R&D'}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-[#686158] block">Prepared On / By</span>
                  <strong>
                    {doc.sample.preparationDate || 'Pending'} · {(doc.sample.preparerEmail || doc.sample.requestedByEmail || '').split('@')[0]}
                  </strong>
                </div>
              </div>

              <div className="border-t border-[#DED7CC] pt-3 text-xs font-mono">
                <span className="text-[10px] uppercase text-[#686158] block">Intended Recipient</span>
                <strong>{doc.sample.recipientName || 'Internal Laboratory'}</strong>
                {doc.sample.recipientCompany && <span className="block text-[#686158]">{doc.sample.recipientCompany}</span>}
                {doc.sample.recipientAddress && <span className="block text-[11px] text-[#686158]">{doc.sample.recipientAddress}</span>}
                {doc.sample.trackingNumber && (
                  <span className="block text-[11px] text-[#9A783E] mt-1">
                    {doc.sample.courierName} · AWB {doc.sample.trackingNumber}
                  </span>
                )}
              </div>

              {Array.isArray(doc.sample.rawMaterialLotRefs) && doc.sample.rawMaterialLotRefs.length > 0 && (
                <div className="border-t border-[#DED7CC] pt-2 text-[10px] font-mono">
                  <span className="uppercase text-[#686158] block mb-1">Traceable Raw Material Lots</span>
                  {doc.sample.rawMaterialLotRefs.map((lot: any, idx: number) => (
                    <div key={idx} className="flex justify-between">
                      <span>{lot.materialName}</span>
                      <span>{lot.lotNumber || 'LOT'} ({lot.qtyIssued} {lot.uom})</span>
                    </div>
                  ))}
                </div>
              )}

              <div
                className={`p-2.5 border rounded text-[10px] font-mono flex items-center gap-2 ${
                  doc.formulaVersion?.ifraComplianceStatus === 'COMPLIANT' &&
                  doc.formulaVersion?.regulatoryAuthorizationBy &&
                  doc.formulaVersion?.supportingEvidenceRef
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                    : 'border-amber-300 bg-amber-50 text-amber-900'
                }`}
              >
                {doc.formulaVersion?.ifraComplianceStatus === 'COMPLIANT' &&
                doc.formulaVersion?.regulatoryAuthorizationBy &&
                doc.formulaVersion?.supportingEvidenceRef ? (
                  <>
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>
                      IFRA VERIFIED ({doc.formulaVersion.ifraDossierRef}) · Signed by {doc.formulaVersion.regulatoryAuthorizationBy}
                    </span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>R&amp;D EVALUATION SAMPLE ONLY — NOT REGULATORY / IFRA CERTIFIED UNTIL DOCUMENTED SIGN-OFF</span>
                  </>
                )}
              </div>
            </div>
          )}

          {doc.type === 'QC_CERTIFICATE' && (
            <div className="space-y-5">
              <div className="flex justify-between items-start border-b border-[#24211D] pb-4">
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#9A783E]">{org.legalName}</p>
                  <h2 className="font-serif text-2xl uppercase tracking-wider mt-1">Certificate of Analysis (COA)</h2>
                  <p className="text-xs font-mono text-[#686158] mt-1">{org.registeredAddress} · GSTIN {org.gstin}</p>
                </div>
                <div className="text-right font-mono text-xs space-y-0.5">
                  <span className="font-bold text-sm block">{doc.qcRecord.certificateNumber || doc.qcRecord.qcNumber}</span>
                  <span className="text-[#686158] block">QC Assay: {doc.qcRecord.qcNumber}</span>
                  <span className="text-emerald-700 font-bold block">STATUS: VERIFIED PASSED</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 border border-[#DED7CC] p-4 rounded bg-[#FAF8F4] text-xs font-mono">
                <div>
                  <span className="text-[10px] uppercase text-[#686158] block">Subject Evaluated</span>
                  <strong>{doc.qcRecord.subjectName}</strong>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-[#686158] block">Inspection Protocol</span>
                  <strong>{doc.qcRecord.checklistName || doc.qcRecord.inspectionType}</strong>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-[#686158] block">Evidence Reference</span>
                  <strong>{doc.qcRecord.supportingEvidenceRef || 'Lab Bench Record'}</strong>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-[#686158] block">Appearance &amp; Colour</span>
                  <strong>{doc.qcRecord.appearanceResult} · {doc.qcRecord.colourResult}</strong>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-[#686158] block">Olfactory &amp; Packaging</span>
                  <strong>{doc.qcRecord.odourResult} · {doc.qcRecord.packagingInspectionResult}</strong>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-[#686158] block">Fill Volume (Target / Actual)</span>
                  <strong>
                    {doc.qcRecord.targetFillVolumeMl || '—'} mL / {doc.qcRecord.actualFillVolumeMl || '—'} mL
                  </strong>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 border border-[#DED7CC] divide-x divide-[#DED7CC] rounded text-center font-mono text-xs">
                <div className="p-3">
                  <span className="text-[10px] text-[#686158] block">GC-MS Match</span>
                  <strong className="text-sm tabular-nums">{doc.qcRecord.gcmsMatchPct}%</strong>
                </div>
                <div className="p-3">
                  <span className="text-[10px] text-[#686158] block">ABV Proof</span>
                  <strong className="text-sm tabular-nums">{doc.qcRecord.abvTestedPct}%</strong>
                </div>
                <div className="p-3">
                  <span className="text-[10px] text-[#686158] block">Specific Gravity</span>
                  <strong className="text-sm tabular-nums">{doc.qcRecord.specificGravity}</strong>
                </div>
                <div className="p-3">
                  <span className="text-[10px] text-[#686158] block">Refractive Index</span>
                  <strong className="text-sm tabular-nums">{doc.qcRecord.refractiveIndex}</strong>
                </div>
                <div className="p-3">
                  <span className="text-[10px] text-[#686158] block">Microbiology</span>
                  <strong className="text-sm text-emerald-700">{doc.qcRecord.microbiologyPass ? 'PASS' : 'FAIL'}</strong>
                </div>
              </div>

              {Array.isArray(doc.qcRecord.checklistResults) && doc.qcRecord.checklistResults.length > 0 && (
                <table className="w-full text-left text-xs border border-[#DED7CC]">
                  <thead className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                    <tr>
                      <th className="py-2 px-3">Parameter</th>
                      <th className="py-2 px-3">Target Spec</th>
                      <th className="py-2 px-3">Measured Value</th>
                      <th className="py-2 px-3">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DED7CC]">
                    {doc.qcRecord.checklistResults.map((c: any, idx: number) => (
                      <tr key={idx}>
                        <td className="py-2 px-3 font-medium">{c.parameter}</td>
                        <td className="py-2 px-3 text-[#686158]">{c.targetSpec}</td>
                        <td className="py-2 px-3 font-mono">{c.measuredValue}</td>
                        <td className={`py-2 px-3 font-mono font-bold ${c.passed ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {c.passed ? 'PASS' : 'FAIL'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {doc.qcRecord.stabilityObservations && (
                <div className="text-xs border border-[#DED7CC] p-3 rounded">
                  <span className="font-mono text-[10px] uppercase text-[#686158] block">Stability Observations</span>
                  <p className="mt-1">{doc.qcRecord.stabilityObservations}</p>
                </div>
              )}

              <div className="flex justify-between items-end pt-4 border-t border-[#DED7CC] text-xs font-mono">
                <div>
                  <span className="text-[#686158] block">Analytical Inspector</span>
                  <strong>{doc.qcRecord.inspectorEmail}</strong>
                </div>
                <div className="text-right">
                  <span className="text-[#686158] block">Authorized Quality Signatory</span>
                  <strong>{doc.qcRecord.approvedByEmail}</strong>
                </div>
              </div>
            </div>
          )}

          {doc.type === 'SAMPLING_QC_REPORT' && (
            <div className="space-y-4">
              <div className="border-b border-[#24211D] pb-3 flex justify-between items-end">
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#9A783E]">{org.legalName}</p>
                  <h3 className="font-serif text-xl uppercase tracking-wider">{doc.reportTitle}</h3>
                </div>
                <span className="text-xs font-mono text-[#686158]">Generated {new Date().toISOString().slice(0, 10)}</span>
              </div>

              {doc.summaryLines && doc.summaryLines.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {doc.summaryLines.map((sl, idx) => (
                    <div key={idx} className="border border-[#DED7CC] rounded p-3 bg-[#FAF8F4]">
                      <span className="text-[10px] font-mono uppercase text-[#686158] block">{sl.label}</span>
                      <strong className="font-mono text-sm tabular-nums">{sl.value}</strong>
                    </div>
                  ))}
                </div>
              )}

              {doc.rows.length > 0 ? (
                <div className="overflow-x-auto border border-[#DED7CC] rounded">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                      <tr>
                        {Object.keys(doc.rows[0]).slice(0, 8).map((k) => (
                          <th key={k} className="py-2 px-2.5 whitespace-nowrap">{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DED7CC]">
                      {doc.rows.map((r, rIdx) => (
                        <tr key={rIdx}>
                          {Object.keys(doc.rows[0]).slice(0, 8).map((k) => (
                            <td key={k} className="py-2 px-2.5 font-mono">
                              {r[k] === null || r[k] === undefined ? '—' : typeof r[k] === 'object' ? JSON.stringify(r[k]) : String(r[k])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs font-mono text-[#686158]">No rows recorded for this dataset.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
