import React, { useState, useEffect, useCallback } from 'react';
import { Printer, FileSpreadsheet, Download, CheckCircle2, AlertTriangle, RotateCcw, Plus, Trash2, ShieldCheck } from 'lucide-react';
import {
  erpApi,
  downloadCsvFile,
  downloadExcelSpreadsheet,
  type ErpGstAccountingSnapshot
} from '../../../lib/erpApi';
import { GstDocumentPrintModal, type GstPrintablePayload } from './GstDocumentPrintModal';
import { ErpTableExportBar } from './ErpUniversalExportModal';

interface Props {
  onRefreshParent: () => Promise<void>;
  notify: (msg: string, type?: 'success' | 'error') => void;
}

type AccountingTab =
  | 'STATEMENTS'
  | 'COA_GL'
  | 'JOURNALS'
  | 'CASH_EXPENSES'
  | 'AR_AP_VALUATION'
  | 'BANK_RECON'
  | 'VERIFICATION';

const fmt = (n: number) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const ErpAccountingWorkspace: React.FC<Props> = ({ onRefreshParent, notify }) => {
  const [snap, setSnap] = useState<ErpGstAccountingSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<AccountingTab>('STATEMENTS');
  const [printDoc, setPrintDoc] = useState<GstPrintablePayload | null>(null);

  // CoA & GL filter
  const [glFilterAcct, setGlFilterAcct] = useState('ALL');
  const [coaForm, setCoaForm] = useState({
    accountCode: '',
    accountName: '',
    accountType: 'EXPENSE' as 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE',
    subGroup: 'OPERATING_EXPENSE',
    description: ''
  });

  // Multi-line Journal Entry builder & Contra Reversal
  const [jrnNarration, setJrnNarration] = useState('');
  const [jrnLines, setJrnLines] = useState<Array<{ accountCode: string; debitInr: number; creditInr: number }>>([
    { accountCode: '5100', debitInr: 5000, creditInr: 0 },
    { accountCode: '1010', debitInr: 0, creditInr: 5000 }
  ]);
  const [reverseTarget, setReverseTarget] = useState<any | null>(null);
  const [reverseReason, setReverseReason] = useState('');

  // Expense & Petty Cash voucher form
  const [expForm, setExpForm] = useState({
    voucherType: 'OPERATING_EXPENSE' as 'OPERATING_EXPENSE' | 'PETTY_CASH_EXPENSE' | 'PETTY_CASH_REPLENISHMENT',
    category: 'Atelier Operations',
    expenseAccountCode: '5100',
    paymentAccountCode: '1010' as '1010' | '1020' | '1030',
    payeeName: '',
    vendorGstin: '',
    placeOfSupplyState: 'Maharashtra',
    description: '',
    taxableAmountInr: 2500,
    gstRatePct: 0,
    receiptRef: ''
  });

  // AP / AR direct payment form
  const [payForm, setPayForm] = useState({
    direction: 'OUTBOUND_PAYOUT' as 'INBOUND_RECEIPT' | 'OUTBOUND_PAYOUT',
    accountCode: '1010' as '1010' | '1020' | '1030',
    vendorInvoiceId: '',
    invoiceId: '',
    partyName: '',
    method: 'NEFT',
    referenceNumber: `UTR${Date.now().toString().slice(-6)}`,
    amountInr: 5000
  });

  // Bank statement import
  const [stmtLineForm, setStmtLineForm] = useState({
    statementDate: new Date().toISOString().slice(0, 10),
    referenceNumber: '',
    description: 'NEFT Bank Settlement / Charge',
    withdrawalInr: 0,
    depositInr: 0,
    closingBalanceInr: 0
  });
  const [manualMatchPayMap, setManualMatchPayMap] = useState<Record<string, string>>({});

  // Accountant signoff notes
  const [signoffNotes, setSignoffNotes] = useState('');

  const loadSnapshot = useCallback(async () => {
    try {
      const data = await erpApi.getGstAccountingSnapshot();
      setSnap(data);
    } catch (e: any) {
      notify(e?.message || 'Failed to load Accounting workspace', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

  const runAction = async (fn: () => Promise<void>, okMsg: string) => {
    setBusy(true);
    try {
      await fn();
      await loadSnapshot();
      await onRefreshParent();
      notify(okMsg, 'success');
    } catch (e: any) {
      notify(e?.message || 'Accounting operation failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading || !snap) {
    return (
      <div className="max-w-7xl mx-auto p-8 border border-[#DED7CC] bg-white rounded-lg text-xs font-mono text-[#686158]">
        Loading Double-Entry General Ledger &amp; Financial Statements...
      </div>
    );
  }

  const org = snap.organization || {};
  const fs = snap.financialStatements;
  const tb = fs.trialBalance;
  const pnl = fs.profitAndLoss;
  const bs = fs.balanceSheet;
  const cf = fs.cashFlow;
  const isReady = org.accountingReadyStatus === 'ACCOUNTANT_ACCEPTED_READY';

  const totalCashLiquid = fs.cashAndBankBooks.reduce((s, a) => s + Number(a.closingBalanceInr || 0), 0);
  const openVendorBills = snap.vendorInvoices.filter((v) => v.status !== 'CANCELLED' && Number(v.balanceDueInr || 0) > 0.01);
  const openCustomerInvs = snap.invoices.filter((i) => i.invoiceType !== 'PROFORMA' && Number(i.balanceDueInr || 0) > 0.01);
  const unreconciledPayments = snap.payments.filter((p) => p.accountCode === '1010' && !p.reconciledWithBank);

  const jrnDrTotal = jrnLines.reduce((s, l) => s + Number(l.debitInr || 0), 0);
  const jrnCrTotal = jrnLines.reduce((s, l) => s + Number(l.creditInr || 0), 0);
  const jrnIsBalanced = jrnDrTotal > 0 && Math.abs(jrnDrTotal - jrnCrTotal) < 0.01;

  // Running balance GL entries
  const filteredGl =
    glFilterAcct === 'ALL' ? snap.glLedgerEntries : snap.glLedgerEntries.filter((e) => e.accountCode === glFilterAcct);

  const exportFullAccountantBundle = () => {
    const bundleRows = [
      ...tb.accounts.map((a) => ({
        Section: 'TRIAL_BALANCE',
        Code: a.accountCode,
        Name: a.accountName,
        Class: a.accountType,
        DebitInr: a.debitInr,
        CreditInr: a.creditInr,
        NetBalanceInr: a.netBalanceInr
      })),
      {
        Section: 'PROFIT_AND_LOSS',
        Code: 'PNL-REV',
        Name: 'Total Revenue',
        Class: 'REVENUE',
        DebitInr: 0,
        CreditInr: pnl.totalRevenueInr,
        NetBalanceInr: pnl.totalRevenueInr
      },
      {
        Section: 'PROFIT_AND_LOSS',
        Code: 'PNL-COGS',
        Name: 'Cost of Goods Sold',
        Class: 'EXPENSE',
        DebitInr: pnl.totalCogsInr,
        CreditInr: 0,
        NetBalanceInr: pnl.totalCogsInr
      },
      {
        Section: 'PROFIT_AND_LOSS',
        Code: 'PNL-NET',
        Name: 'Net Profit / (Loss)',
        Class: 'PROFIT',
        DebitInr: 0,
        CreditInr: 0,
        NetBalanceInr: pnl.netProfitInr
      },
      {
        Section: 'BALANCE_SHEET',
        Code: 'BS-ASSETS',
        Name: 'Total Assets',
        Class: 'ASSET',
        DebitInr: bs.totalAssetsInr,
        CreditInr: 0,
        NetBalanceInr: bs.totalAssetsInr
      },
      {
        Section: 'BALANCE_SHEET',
        Code: 'BS-LIAB-EQ',
        Name: 'Total Liabilities + Equity + Earnings',
        Class: 'LIAB_EQUITY',
        DebitInr: 0,
        CreditInr: bs.totalLiabilitiesAndEquityInr,
        NetBalanceInr: bs.totalLiabilitiesAndEquityInr
      }
    ];
    downloadExcelSpreadsheet(
      `fragmore_accountant_audit_bundle_${new Date().toISOString().slice(0, 10)}.xls`,
      `FRAGMORÉ Accountant Audit Bundle (${org.accountingReadyStatus})`,
      bundleRows
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <GstDocumentPrintModal doc={printDoc} organization={org} onClose={() => setPrintDoc(null)} />

      {/* Header + Production Readiness Gate */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-[#DED7CC] pb-4">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-widest text-[#9A783E]">
            Module 12 · Double-Entry General Ledger &amp; Financial Statements
          </p>
          <h2 className="font-serif text-2xl sm:text-3xl text-[#24211D] uppercase tracking-wider mt-1">
            Accounting, Treasury, Bank Recon &amp; Audit Sign-Off
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className={`px-3 py-1.5 border rounded text-xs font-mono flex items-center gap-1.5 ${
              isReady
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                : 'border-[#9A783E]/50 bg-[#FAF8F4] text-[#24211D]'
            }`}
          >
            {isReady ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" /> : <AlertTriangle className="w-3.5 h-3.5 text-[#9A783E]" />}
            <span>
              {isReady
                ? `ACCOUNTING ACCEPTED (${org.accountantSignoffEmail || 'Finance Controller'})`
                : 'VERIFICATION PENDING — Run Accountant Tests'}
            </span>
          </div>
          <ErpTableExportBar
            reportKey={
              tab === 'CASH_EXPENSES'
                ? 'expenses_petty_cash'
                : tab === 'AR_AP_VALUATION'
                ? 'outstanding_payments'
                : 'profit_and_loss'
            }
            notify={notify}
          />
          <button
            onClick={exportFullAccountantBundle}
            className="px-3 py-1.5 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono rounded flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Accountant Bundle (.xls)</span>
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 border border-[#DED7CC] bg-white divide-y sm:divide-y-0 sm:divide-x divide-[#DED7CC] rounded-lg">
        <div className="p-4">
          <span className="text-[11px] font-mono uppercase text-[#686158] block">Trial Balance Proof</span>
          <span className={`text-lg font-mono font-bold ${tb.isBalanced ? 'text-emerald-700' : 'text-rose-700'}`}>
            {tb.isBalanced ? 'BALANCED' : 'OUT OF BALANCE'}
          </span>
          <span className="text-[10px] font-mono text-[#686158] block tabular-nums">Dr = Cr {fmt(tb.totalDebitsInr)}</span>
        </div>
        <div className="p-4">
          <span className="text-[11px] font-mono uppercase text-[#686158] block">Balance Sheet Equation</span>
          <span className={`text-lg font-mono font-bold ${bs.isBalanced ? 'text-emerald-700' : 'text-rose-700'}`}>
            {bs.isBalanced ? 'ASSETS = L + E' : 'VARIANCE'}
          </span>
          <span className="text-[10px] font-mono text-[#686158] block tabular-nums">Assets {fmt(bs.totalAssetsInr)}</span>
        </div>
        <div className="p-4">
          <span className="text-[11px] font-mono uppercase text-[#686158] block">Net Ledger Profit (P&amp;L)</span>
          <span className={`text-xl font-mono font-bold tabular-nums ${pnl.netProfitInr >= 0 ? 'text-[#9A783E]' : 'text-rose-700'}`}>
            {fmt(pnl.netProfitInr)}
          </span>
          <span className="text-[10px] font-mono text-[#686158] block tabular-nums">Rev {fmt(pnl.totalRevenueInr)}</span>
        </div>
        <div className="p-4">
          <span className="text-[11px] font-mono uppercase text-[#686158] block">Cash, Bank &amp; Petty Cash</span>
          <span className="text-xl font-mono font-bold text-[#24211D] tabular-nums">{fmt(totalCashLiquid)}</span>
          <span className="text-[10px] font-mono text-[#686158] block">
            {fs.bankReconciliation.unmatchedCount} bank exceptions
          </span>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex flex-wrap gap-2 border-b border-[#DED7CC] pb-3">
        {(
          [
            { id: 'STATEMENTS', label: 'Trial Balance, P&L, Balance Sheet & Cash Flow' },
            { id: 'COA_GL', label: `Chart of Accounts & GL (${snap.chartOfAccounts.length})` },
            { id: 'JOURNALS', label: `Journals & Reversals (${snap.journals.length})` },
            { id: 'CASH_EXPENSES', label: `Cash Book, Bank Book & Expenses (${snap.expenses.length})` },
            { id: 'AR_AP_VALUATION', label: 'AR/AP Ledgers & Inventory COGS' },
            { id: 'BANK_RECON', label: `Bank Reconciliation (${snap.bankStatements.length})` },
            { id: 'VERIFICATION', label: 'Accountant Acceptance Tests' }
          ] as Array<{ id: AccountingTab; label: string }>
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded text-xs font-mono whitespace-nowrap cursor-pointer ${
              tab === t.id ? 'bg-[#24211D] text-[#FAF8F4]' : 'bg-white border border-[#DED7CC] text-[#24211D] hover:border-[#9A783E]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: FINANCIAL STATEMENTS */}
      {tab === 'STATEMENTS' && (
        <div className="space-y-6">
          {/* Trial Balance */}
          <div className="border border-[#DED7CC] bg-white rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-[#FAF8F4] border-b border-[#DED7CC] flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-mono uppercase font-semibold text-[#24211D]">
                1. Trial Balance (Decimal-Safe Paise Sum Across Posted Journals)
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => downloadCsvFile('fragmore_trial_balance.csv', tb.accounts)}
                  className="px-2.5 py-1 border border-[#DED7CC] bg-white rounded text-[11px] font-mono cursor-pointer"
                >
                  CSV
                </button>
                <button
                  onClick={() =>
                    setPrintDoc({
                      type: 'FINANCIAL_STATEMENT',
                      title: 'General Ledger Trial Balance',
                      record: tb,
                      extra: {
                        summaryLine: `Total Debits ${fmt(tb.totalDebitsInr)} = Total Credits ${fmt(tb.totalCreditsInr)} · Status: ${tb.isBalanced ? 'BALANCED' : 'UNBALANCED'}`,
                        exportRows: tb.accounts.map((a) => ({
                          Code: a.accountCode,
                          Account: a.accountName,
                          Class: a.accountType,
                          TotalDebit: a.debitInr,
                          TotalCredit: a.creditInr,
                          NetBalance: a.netBalanceInr
                        }))
                      }
                    })
                  }
                  className="px-2.5 py-1 bg-[#24211D] text-[#FAF8F4] rounded text-[11px] font-mono cursor-pointer"
                >
                  PDF
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                  <tr>
                    <th className="py-2 px-3">Code</th>
                    <th className="py-2 px-3">Account Name</th>
                    <th className="py-2 px-3">Class</th>
                    <th className="py-2 px-3 text-right">Debit</th>
                    <th className="py-2 px-3 text-right">Credit</th>
                    <th className="py-2 px-3 text-right">Net Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DED7CC] font-mono tabular-nums">
                  {tb.accounts
                    .filter((a) => a.debitInr > 0 || a.creditInr > 0)
                    .map((acc) => (
                      <tr key={acc.accountCode} className="hover:bg-[#FAF8F4]">
                        <td className="py-2 px-3 font-bold text-[#9A783E]">{acc.accountCode}</td>
                        <td className="py-2 px-3 font-sans font-medium">{acc.accountName}</td>
                        <td className="py-2 px-3 text-[11px] text-[#686158]">{acc.accountType}</td>
                        <td className="py-2 px-3 text-right">{fmt(acc.debitInr)}</td>
                        <td className="py-2 px-3 text-right">{fmt(acc.creditInr)}</td>
                        <td className="py-2 px-3 text-right font-bold">{fmt(acc.netBalanceInr)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Profit & Loss Statement */}
            <div className="border border-[#DED7CC] bg-white rounded-lg p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[#DED7CC] pb-2">
                <h3 className="text-xs font-mono uppercase font-semibold text-[#24211D]">2. Profit &amp; Loss Statement (P&amp;L)</h3>
                <button
                  onClick={() =>
                    setPrintDoc({
                      type: 'FINANCIAL_STATEMENT',
                      title: 'Statement of Profit & Loss (P&L)',
                      record: pnl,
                      extra: {
                        summaryLine: `Revenue ${fmt(pnl.totalRevenueInr)} · Gross Profit ${fmt(pnl.grossProfitInr)} · Net Profit ${fmt(pnl.netProfitInr)}`,
                        exportRows: [
                          ...pnl.revenueLines.map((l) => ({ Group: 'REVENUE', Code: l.accountCode, Account: l.accountName, Amount: l.netBalanceInr })),
                          ...pnl.cogsLines.map((l) => ({ Group: 'COGS', Code: l.accountCode, Account: l.accountName, Amount: l.netBalanceInr })),
                          ...pnl.opexLines.map((l) => ({ Group: 'OPEX', Code: l.accountCode, Account: l.accountName, Amount: l.netBalanceInr }))
                        ]
                      }
                    })
                  }
                  className="text-[11px] font-mono text-[#9A783E] hover:underline cursor-pointer"
                >
                  PDF Statement
                </button>
              </div>
              <div className="space-y-1.5 text-xs font-mono tabular-nums">
                <p className="text-[10px] uppercase text-[#686158]">Operating Revenue</p>
                {pnl.revenueLines.map((l) => (
                  <div key={l.accountCode} className="flex justify-between">
                    <span className="font-sans">{l.accountCode} · {l.accountName}</span>
                    <span>{fmt(l.netBalanceInr)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold border-t border-[#DED7CC] pt-1">
                  <span>Total Net Revenue</span>
                  <span className="text-[#9A783E]">{fmt(pnl.totalRevenueInr)}</span>
                </div>

                <p className="text-[10px] uppercase text-[#686158] pt-3">Cost of Goods Sold (COGS)</p>
                {pnl.cogsLines.map((l) => (
                  <div key={l.accountCode} className="flex justify-between">
                    <span className="font-sans">{l.accountCode} · {l.accountName}</span>
                    <span>{fmt(l.netBalanceInr)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold border-t border-[#DED7CC] pt-1">
                  <span>Gross Profit</span>
                  <span>{fmt(pnl.grossProfitInr)}</span>
                </div>

                <p className="text-[10px] uppercase text-[#686158] pt-3">Operating Expenses</p>
                {pnl.opexLines.map((l) => (
                  <div key={l.accountCode} className="flex justify-between">
                    <span className="font-sans">{l.accountCode} · {l.accountName}</span>
                    <span>{fmt(l.netBalanceInr)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-bold border-t-2 border-[#24211D] pt-2 mt-2">
                  <span>Net Profit / (Loss)</span>
                  <span className={pnl.netProfitInr >= 0 ? 'text-emerald-700' : 'text-rose-700'}>{fmt(pnl.netProfitInr)}</span>
                </div>
              </div>
            </div>

            {/* Balance Sheet & Cash Flow */}
            <div className="space-y-6">
              <div className="border border-[#DED7CC] bg-white rounded-lg p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-[#DED7CC] pb-2">
                  <h3 className="text-xs font-mono uppercase font-semibold text-[#24211D]">3. Balance Sheet</h3>
                  <button
                    onClick={() =>
                      setPrintDoc({
                        type: 'FINANCIAL_STATEMENT',
                        title: 'Balance Sheet',
                        record: bs,
                        extra: {
                          summaryLine: `Total Assets ${fmt(bs.totalAssetsInr)} = Liabilities + Equity + Earnings ${fmt(bs.totalLiabilitiesAndEquityInr)}`,
                          exportRows: [
                            ...bs.assetLines.map((l) => ({ Section: 'ASSET', Code: l.accountCode, Account: l.accountName, Balance: l.netBalanceInr })),
                            ...bs.liabilityLines.map((l) => ({ Section: 'LIABILITY', Code: l.accountCode, Account: l.accountName, Balance: l.netBalanceInr })),
                            ...bs.equityLines.map((l) => ({ Section: 'EQUITY', Code: l.accountCode, Account: l.accountName, Balance: l.netBalanceInr }))
                          ]
                        }
                      })
                    }
                    className="text-[11px] font-mono text-[#9A783E] hover:underline cursor-pointer"
                  >
                    PDF Statement
                  </button>
                </div>
                <div className="space-y-1 text-xs font-mono tabular-nums">
                  <div className="flex justify-between font-bold text-[#24211D]">
                    <span>Total Assets</span>
                    <span>{fmt(bs.totalAssetsInr)}</span>
                  </div>
                  <div className="flex justify-between text-[#686158]">
                    <span>Total Liabilities</span>
                    <span>{fmt(bs.totalLiabilitiesInr)}</span>
                  </div>
                  <div className="flex justify-between text-[#686158]">
                    <span>Shareholders Paid-In Capital</span>
                    <span>{fmt(bs.shareCapitalInr)}</span>
                  </div>
                  <div className="flex justify-between text-[#686158]">
                    <span>Current Period Earnings (P&amp;L)</span>
                    <span>{fmt(bs.currentPeriodEarningsInr)}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t-2 border-[#24211D] pt-2 mt-2">
                    <span>Total Liabilities &amp; Equity</span>
                    <span className={bs.isBalanced ? 'text-emerald-700' : 'text-rose-700'}>
                      {fmt(bs.totalLiabilitiesAndEquityInr)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border border-[#DED7CC] bg-white rounded-lg p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-[#DED7CC] pb-2">
                  <h3 className="text-xs font-mono uppercase font-semibold text-[#24211D]">4. Cash Flow Summary (Direct Method)</h3>
                  <button
                    onClick={() =>
                      setPrintDoc({
                        type: 'FINANCIAL_STATEMENT',
                        title: 'Cash Flow Statement',
                        record: cf,
                        extra: {
                          summaryLine: `Closing Cash, Bank & Petty Cash Balance: ${fmt(cf.closingCashAndBankInr)}`,
                          exportRows: [
                            { Line: 'Receipts from Customers & Advances', Amount: cf.receiptsFromCustomersInr },
                            { Line: 'Payments to Suppliers', Amount: cf.paymentsToSuppliersInr },
                            { Line: 'Operating Expenses & Petty Cash Paid', Amount: cf.operatingExpensesPaidInr },
                            { Line: 'Other Operating Cash Movements', Amount: cf.otherOperatingCashInr },
                            { Line: 'Net Operating Cash Flow', Amount: cf.netOperatingCashFlowInr },
                            { Line: 'Financing / Paid-In Capital Inflows', Amount: cf.financingCapitalInflowInr },
                            { Line: 'Closing Cash & Bank Balance', Amount: cf.closingCashAndBankInr }
                          ]
                        }
                      })
                    }
                    className="text-[11px] font-mono text-[#9A783E] hover:underline cursor-pointer"
                  >
                    PDF Cash Flow
                  </button>
                </div>
                <div className="space-y-1 text-xs font-mono tabular-nums">
                  <div className="flex justify-between"><span>Customer Receipts &amp; Advances</span><span>{fmt(cf.receiptsFromCustomersInr)}</span></div>
                  <div className="flex justify-between"><span>Supplier Payouts</span><span>{fmt(cf.paymentsToSuppliersInr)}</span></div>
                  <div className="flex justify-between"><span>Operating &amp; Petty Cash Expenses</span><span>{fmt(cf.operatingExpensesPaidInr)}</span></div>
                  <div className="flex justify-between font-bold border-t border-[#DED7CC] pt-1">
                    <span>Net Operating Cash Flow</span>
                    <span>{fmt(cf.netOperatingCashFlowInr)}</span>
                  </div>
                  <div className="flex justify-between text-[#686158]"><span>Paid-In Equity / Financing Inflows</span><span>{fmt(cf.financingCapitalInflowInr)}</span></div>
                  <div className="flex justify-between font-bold text-[#9A783E] border-t border-[#DED7CC] pt-1">
                    <span>Closing Cash &amp; Bank Balance</span>
                    <span>{fmt(cf.closingCashAndBankInr)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CHART OF ACCOUNTS & GENERAL LEDGER */}
      {tab === 'COA_GL' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 border border-[#DED7CC] bg-white rounded-lg overflow-x-auto max-h-[420px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158] sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">Code</th>
                    <th className="py-2.5 px-3">Account Name</th>
                    <th className="py-2.5 px-3">Type / Group</th>
                    <th className="py-2.5 px-3">Normal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DED7CC]">
                  {snap.chartOfAccounts.map((c) => (
                    <tr key={c.id} className="hover:bg-[#FAF8F4]">
                      <td className="py-2 px-3 font-mono font-bold text-[#9A783E]">{c.accountCode}</td>
                      <td className="py-2 px-3">
                        <span className="font-medium block">{c.accountName}</span>
                        <span className="text-[10px] text-[#686158]">{c.description}</span>
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px]">{c.accountType} · {c.subGroup}</td>
                      <td className="py-2 px-3 font-mono text-[11px]">{c.normalBalance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                runAction(async () => {
                  await erpApi.upsertChartOfAccount(coaForm);
                  setCoaForm({ accountCode: '', accountName: '', accountType: 'EXPENSE', subGroup: 'OPERATING_EXPENSE', description: '' });
                }, 'Chart of Accounts updated in PostgreSQL.');
              }}
              className="border border-[#DED7CC] bg-white rounded-lg p-4 space-y-2.5 h-fit"
            >
              <h3 className="text-xs font-mono uppercase font-semibold border-b border-[#DED7CC] pb-2">
                Add / Update GL Account
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <input
                  required
                  placeholder="4-Digit Code (e.g. 5450)"
                  value={coaForm.accountCode}
                  onChange={(e) => setCoaForm({ ...coaForm, accountCode: e.target.value })}
                  className="px-2.5 py-1.5 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
                />
                <select
                  value={coaForm.accountType}
                  onChange={(e) => setCoaForm({ ...coaForm, accountType: e.target.value as any })}
                  className="px-2 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                >
                  <option value="ASSET">ASSET</option>
                  <option value="LIABILITY">LIABILITY</option>
                  <option value="EQUITY">EQUITY</option>
                  <option value="REVENUE">REVENUE</option>
                  <option value="EXPENSE">EXPENSE</option>
                </select>
              </div>
              <input
                required
                placeholder="Account Name *"
                value={coaForm.accountName}
                onChange={(e) => setCoaForm({ ...coaForm, accountName: e.target.value })}
                className="w-full px-3 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              />
              <input
                placeholder="Sub-Group (e.g. OPERATING_EXPENSE)"
                value={coaForm.subGroup}
                onChange={(e) => setCoaForm({ ...coaForm, subGroup: e.target.value })}
                className="w-full px-3 py-1.5 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
              />
              <input
                placeholder="Purpose Description"
                value={coaForm.description}
                onChange={(e) => setCoaForm({ ...coaForm, description: e.target.value })}
                className="w-full px-3 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              />
              <button
                disabled={busy}
                type="submit"
                className="w-full py-2 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono uppercase rounded cursor-pointer"
              >
                Save GL Account
              </button>
            </form>
          </div>

          {/* General Ledger Detail */}
          <div className="border border-[#DED7CC] bg-white rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-[#FAF8F4] border-b border-[#DED7CC] flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-mono uppercase font-semibold text-[#24211D]">General Ledger Postings ({filteredGl.length} lines)</h3>
              <div className="flex items-center gap-2">
                <select
                  value={glFilterAcct}
                  onChange={(e) => setGlFilterAcct(e.target.value)}
                  className="px-2.5 py-1 border border-[#DED7CC] rounded font-mono text-xs bg-white"
                >
                  <option value="ALL">All Accounts</option>
                  {snap.chartOfAccounts.map((c) => (
                    <option key={c.id} value={c.accountCode}>
                      {c.accountCode} · {c.accountName}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => downloadCsvFile(`fragmore_gl_${glFilterAcct}.csv`, filteredGl)}
                  className="px-2.5 py-1 border border-[#DED7CC] bg-white rounded text-xs font-mono cursor-pointer"
                >
                  CSV
                </button>
              </div>
            </div>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158] sticky top-0 bg-white">
                  <tr>
                    <th className="py-2 px-3">Date &amp; Journal</th>
                    <th className="py-2 px-3">Account</th>
                    <th className="py-2 px-3">Narration</th>
                    <th className="py-2 px-3 text-right">Debit</th>
                    <th className="py-2 px-3 text-right">Credit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DED7CC] font-mono tabular-nums">
                  {filteredGl.slice(0, 120).map((e, idx) => (
                    <tr key={idx} className="hover:bg-[#FAF8F4]">
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className="font-bold text-[#24211D] block">{e.journalNumber}</span>
                        <span className="text-[10px] text-[#686158]">{e.entryDate} · {e.sourceModule}</span>
                      </td>
                      <td className="py-2 px-3 font-sans">
                        <span className="font-mono text-[#9A783E] font-semibold">{e.accountCode}</span> · {e.accountName}
                      </td>
                      <td className="py-2 px-3 font-sans text-[#686158] max-w-md truncate">{e.narration}</td>
                      <td className="py-2 px-3 text-right">{e.debitInr > 0 ? fmt(e.debitInr) : '—'}</td>
                      <td className="py-2 px-3 text-right">{e.creditInr > 0 ? fmt(e.creditInr) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: JOURNAL ENTRIES & CONTRA REVERSALS */}
      {tab === 'JOURNALS' && (
        <div className="space-y-4">
          {reverseTarget && (
            <div className="border border-[#9A783E] bg-white rounded-lg p-4 flex flex-wrap items-end gap-3">
              <div className="w-full text-xs font-mono font-bold text-[#24211D]">
                Post Immutable Contra Reversal Journal for {reverseTarget.journalNumber} ({reverseTarget.narration})
              </div>
              <input
                required
                placeholder="Audit reason for contra reversal *"
                value={reverseReason}
                onChange={(e) => setReverseReason(e.target.value)}
                className="flex-1 min-w-[240px] px-3 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              />
              <button
                disabled={busy || !reverseReason.trim()}
                onClick={() =>
                  runAction(async () => {
                    await erpApi.reverseAccountingJournal(reverseTarget.id, reverseReason);
                    setReverseTarget(null);
                    setReverseReason('');
                  }, `Posted contra reversal journal for ${reverseTarget.journalNumber}.`)
                }
                className="px-4 py-1.5 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono rounded cursor-pointer"
              >
                Post Reversal Journal
              </button>
              <button onClick={() => setReverseTarget(null)} className="px-2 py-1.5 text-xs font-mono text-[#686158] cursor-pointer">
                Cancel
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 space-y-3">
              {snap.journals.map((j) => (
                <div key={j.id} className="border border-[#DED7CC] bg-white rounded-lg p-4 space-y-2 text-xs">
                  <div className="flex flex-wrap justify-between items-center gap-2 font-mono border-b border-[#DED7CC] pb-2">
                    <span className="font-bold text-[#24211D]">
                      {j.journalNumber} · {j.sourceModule}
                      {j.reversedByJournalId && <span className="text-rose-700 ml-2">[REVERSED BY CONTRA]</span>}
                      {j.reversesJournalId && <span className="text-[#9A783E] ml-2">[CONTRA REVERSAL]</span>}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-[#686158]">{j.entryDate} · {j.fiscalPeriod}</span>
                      {!j.reversedByJournalId && !j.reversesJournalId && (
                        <button
                          onClick={() => {
                            setReverseTarget(j);
                            setReverseReason('');
                          }}
                          className="text-[11px] text-[#9A783E] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" /> Reverse
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-[#24211D] font-medium">{j.narration}</p>
                  <div className="space-y-1 pt-1 font-mono text-[11px] tabular-nums">
                    {(j.lines as any[]).map((line, i) => (
                      <div key={i} className="flex justify-between">
                        <span>{line.accountCode} · {line.accountName}</span>
                        <span>
                          {line.debitInr > 0 ? `DR ${fmt(line.debitInr)}` : `CR ${fmt(line.creditInr)}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                runAction(async () => {
                  const mappedLines = jrnLines.map((l) => {
                    const coa = snap.chartOfAccounts.find((c) => c.accountCode === l.accountCode);
                    return {
                      accountCode: l.accountCode,
                      accountName: coa?.accountName || l.accountCode,
                      accountType: coa?.accountType || 'EXPENSE',
                      debitInr: Number(l.debitInr || 0),
                      creditInr: Number(l.creditInr || 0)
                    };
                  });
                  await erpApi.createJournal({ narration: jrnNarration, lines: mappedLines });
                  setJrnNarration('');
                }, 'Balanced manual double-entry journal posted to General Ledger.');
              }}
              className="border border-[#DED7CC] bg-white rounded-lg p-4 space-y-3 h-fit"
            >
              <h3 className="text-xs font-mono uppercase font-semibold border-b border-[#DED7CC] pb-2">
                Post Multi-Line Journal Entry
              </h3>
              <input
                required
                placeholder="Journal Narration / Audit Note *"
                value={jrnNarration}
                onChange={(e) => setJrnNarration(e.target.value)}
                className="w-full px-3 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              />
              <div className="space-y-2">
                {jrnLines.map((l, idx) => (
                  <div key={idx} className="p-2 bg-[#FAF8F4] border border-[#DED7CC] rounded space-y-1.5">
                    <div className="flex gap-1.5">
                      <select
                        value={l.accountCode}
                        onChange={(e) => {
                          const next = [...jrnLines];
                          next[idx].accountCode = e.target.value;
                          setJrnLines(next);
                        }}
                        className="flex-1 px-2 py-1 border border-[#DED7CC] rounded text-xs bg-white font-mono"
                      >
                        {snap.chartOfAccounts.map((c) => (
                          <option key={c.id} value={c.accountCode}>
                            {c.accountCode} · {c.accountName}
                          </option>
                        ))}
                      </select>
                      {jrnLines.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setJrnLines(jrnLines.filter((_, i) => i !== idx))}
                          className="p-1 text-rose-700 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 font-mono">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="Debit ₹"
                        value={l.debitInr}
                        onChange={(e) => {
                          const next = [...jrnLines];
                          next[idx].debitInr = Number(e.target.value);
                          if (next[idx].debitInr > 0) next[idx].creditInr = 0;
                          setJrnLines(next);
                        }}
                        className="px-2 py-1 border border-[#DED7CC] rounded text-xs bg-white"
                      />
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="Credit ₹"
                        value={l.creditInr}
                        onChange={(e) => {
                          const next = [...jrnLines];
                          next[idx].creditInr = Number(e.target.value);
                          if (next[idx].creditInr > 0) next[idx].debitInr = 0;
                          setJrnLines(next);
                        }}
                        className="px-2 py-1 border border-[#DED7CC] rounded text-xs bg-white"
                      />
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setJrnLines([...jrnLines, { accountCode: '1010', debitInr: 0, creditInr: 0 }])}
                  className="text-[11px] font-mono text-[#9A783E] flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Add Ledger Line
                </button>
              </div>
              <div className="flex justify-between font-mono text-[11px] pt-1 border-t border-[#DED7CC] tabular-nums">
                <span>Dr: {fmt(jrnDrTotal)}</span>
                <span>Cr: {fmt(jrnCrTotal)}</span>
                <span className={jrnIsBalanced ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                  {jrnIsBalanced ? 'BALANCED' : 'UNBALANCED'}
                </span>
              </div>
              <button
                disabled={busy || !jrnIsBalanced}
                type="submit"
                className="w-full py-2.5 bg-[#24211D] hover:bg-[#9A783E] disabled:opacity-50 text-[#FAF8F4] text-xs font-mono uppercase rounded cursor-pointer"
              >
                Post Balanced Journal
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 4: CASH BOOK, BANK BOOK, PETTY CASH & EXPENSES */}
      {tab === 'CASH_EXPENSES' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {fs.cashAndBankBooks.map((book) => (
              <div key={book.accountCode} className="border border-[#DED7CC] bg-white rounded-lg p-4 space-y-2">
                <div className="flex justify-between font-mono text-[11px] text-[#9A783E]">
                  <span>GL {book.accountCode}</span>
                  <span>{book.entriesCount} Ledger Entries</span>
                </div>
                <h4 className="font-serif text-base text-[#24211D]">{book.accountName}</h4>
                <div className="text-xl font-mono font-bold tabular-nums">{fmt(book.closingBalanceInr)}</div>
                <div className="flex justify-between text-[11px] font-mono text-[#686158] border-t border-[#DED7CC] pt-2 tabular-nums">
                  <span>In: {fmt(book.debitTotalInr)}</span>
                  <span>Out: {fmt(book.creditTotalInr)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 border border-[#DED7CC] bg-white rounded-lg overflow-x-auto">
              <div className="px-4 py-3 bg-[#FAF8F4] border-b border-[#DED7CC] flex items-center justify-between">
                <h3 className="text-xs font-mono uppercase font-semibold">Operating Expense &amp; Petty Cash Vouchers</h3>
                <button
                  onClick={() => downloadCsvFile('fragmore_expenses_petty_cash.csv', snap.expenses)}
                  className="px-2.5 py-1 border border-[#DED7CC] bg-white rounded text-[11px] font-mono cursor-pointer"
                >
                  CSV
                </button>
              </div>
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                  <tr>
                    <th className="py-2 px-3">Voucher #</th>
                    <th className="py-2 px-3">Payee &amp; Category</th>
                    <th className="py-2 px-3">Dr / Cr GL</th>
                    <th className="py-2 px-3 text-right">Taxable / ITC</th>
                    <th className="py-2 px-3 text-right">Total</th>
                    <th className="py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DED7CC] font-mono tabular-nums">
                  {snap.expenses.map((ex) => (
                    <tr key={ex.id} className="hover:bg-[#FAF8F4]">
                      <td className="py-2.5 px-3">
                        <strong className="block">{ex.voucherNumber}</strong>
                        <span className="text-[10px] text-[#686158]">{ex.expenseDate}</span>
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        <span className="font-medium block">{ex.payeeName}</span>
                        <span className="text-[11px] text-[#686158]">{ex.category} — {ex.description}</span>
                      </td>
                      <td className="py-2.5 px-3 text-[11px]">Dr {ex.expenseAccountCode} / Cr {ex.paymentAccountCode}</td>
                      <td className="py-2.5 px-3 text-right">
                        {fmt(ex.taxableAmountInr)}
                        <span className="block text-[10px] text-[#686158]">
                          ITC {fmt(Number(ex.cgstInr || 0) + Number(ex.sgstInr || 0) + Number(ex.igstInr || 0))}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold">{fmt(ex.totalAmountInr)}</td>
                      <td className="py-2.5 px-3 text-[11px]">{ex.status}</td>
                    </tr>
                  ))}
                  {snap.expenses.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#686158]">
                        No operating expense or petty cash vouchers recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                runAction(async () => {
                  await erpApi.recordExpenseOrPettyCash(expForm);
                  setExpForm({ ...expForm, payeeName: '', description: '', vendorGstin: '', receiptRef: '' });
                }, 'Recorded Expense / Petty Cash voucher & posted GL entries.');
              }}
              className="border border-[#DED7CC] bg-white rounded-lg p-4 space-y-2.5 h-fit"
            >
              <h3 className="text-xs font-mono uppercase font-semibold border-b border-[#DED7CC] pb-2">
                Record Expense / Petty Cash Voucher
              </h3>
              <select
                value={expForm.voucherType}
                onChange={(e) => {
                  const vt = e.target.value as any;
                  setExpForm({
                    ...expForm,
                    voucherType: vt,
                    paymentAccountCode: vt === 'PETTY_CASH_EXPENSE' ? '1030' : '1010'
                  });
                }}
                className="w-full px-2.5 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              >
                <option value="OPERATING_EXPENSE">Operating Expense Voucher</option>
                <option value="PETTY_CASH_EXPENSE">Petty Cash Expense (Imprest)</option>
                <option value="PETTY_CASH_REPLENISHMENT">Petty Cash Float Replenishment (1010 → 1030)</option>
              </select>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={expForm.expenseAccountCode}
                  onChange={(e) => setExpForm({ ...expForm, expenseAccountCode: e.target.value })}
                  className="px-2 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                >
                  <option value="5100">5100 Atelier Ops &amp; Lease</option>
                  <option value="5150">5150 Freight &amp; Services</option>
                  <option value="5300">5300 Marketing &amp; Ads</option>
                  <option value="5400">5400 Payroll &amp; Stipends</option>
                  <option value="5220">5220 R&amp;D &amp; Sampling</option>
                </select>
                <select
                  value={expForm.paymentAccountCode}
                  onChange={(e) => setExpForm({ ...expForm, paymentAccountCode: e.target.value as any })}
                  className="px-2 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                >
                  <option value="1010">Pay via Bank (1010)</option>
                  <option value="1020">Pay via Cash (1020)</option>
                  <option value="1030">Pay via Petty Cash (1030)</option>
                </select>
              </div>
              <input
                required
                placeholder="Payee / Vendor Name *"
                value={expForm.payeeName}
                onChange={(e) => setExpForm({ ...expForm, payeeName: e.target.value })}
                className="w-full px-3 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              />
              <input
                required
                placeholder="Expense Description *"
                value={expForm.description}
                onChange={(e) => setExpForm({ ...expForm, description: e.target.value })}
                className="w-full px-3 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min={1}
                  placeholder="Taxable Amount ₹"
                  value={expForm.taxableAmountInr}
                  onChange={(e) => setExpForm({ ...expForm, taxableAmountInr: Number(e.target.value) })}
                  className="px-2.5 py-1.5 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
                />
                <select
                  value={expForm.gstRatePct}
                  onChange={(e) => setExpForm({ ...expForm, gstRatePct: Number(e.target.value) })}
                  className="px-2.5 py-1.5 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
                >
                  <option value={0}>0% (No ITC)</option>
                  <option value={5}>5% GST ITC</option>
                  <option value={12}>12% GST ITC</option>
                  <option value={18}>18% GST ITC</option>
                </select>
              </div>
              <button
                disabled={busy}
                type="submit"
                className="w-full py-2.5 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono uppercase rounded cursor-pointer"
              >
                Post Voucher &amp; Update GL
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 5: AR / AP LEDGERS & INVENTORY VALUATION / COGS */}
      {tab === 'AR_AP_VALUATION' && (
        <div className="space-y-6">
          {/* Inventory Valuation Policy & GL Reconciliation */}
          <div className="border border-[#DED7CC] bg-white rounded-lg p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DED7CC] pb-3">
              <div>
                <h3 className="text-xs font-mono uppercase font-semibold text-[#24211D]">
                  Inventory Valuation Policy &amp; GL Cost Reconciliation (1200 / 1210 / 1220 / 5000 COGS)
                </h3>
                <p className="text-[11px] font-mono text-[#686158]">
                  Active Costing Basis: <strong>{fs.inventoryValuation.policy}</strong>
                </p>
              </div>
              <div className="flex items-center gap-2">
                {(['WEIGHTED_AVERAGE', 'FIFO_LOT_COST'] as const).map((pol) => (
                  <button
                    key={pol}
                    disabled={busy || fs.inventoryValuation.policy === pol}
                    onClick={() =>
                      runAction(
                        () => erpApi.updateGstAndPolicyConfig({ inventoryValuationPolicy: pol }),
                        `Inventory Valuation Policy updated to ${pol}.`
                      )
                    }
                    className={`px-3 py-1.5 rounded text-xs font-mono cursor-pointer ${
                      fs.inventoryValuation.policy === pol
                        ? 'bg-[#24211D] text-[#FAF8F4]'
                        : 'border border-[#DED7CC] bg-[#FAF8F4] hover:border-[#9A783E]'
                    }`}
                  >
                    {pol}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 font-mono tabular-nums text-xs">
              <div className="p-3 bg-[#FAF8F4] border border-[#DED7CC] rounded">
                <span className="text-[10px] text-[#686158] block">1200 Raw Materials (GL vs Lots)</span>
                <strong className="text-sm block">{fmt(fs.inventoryValuation.gl1200BalanceInr)}</strong>
                <span className="text-[10px] text-[#686158]">Active Lots: {fmt(fs.inventoryValuation.rmLotsPhysicalValuationInr)}</span>
              </div>
              <div className="p-3 bg-[#FAF8F4] border border-[#DED7CC] rounded">
                <span className="text-[10px] text-[#686158] block">1210 WIP Maceration (GL vs Batches)</span>
                <strong className="text-sm block">{fmt(fs.inventoryValuation.gl1210BalanceInr)}</strong>
                <span className="text-[10px] text-[#686158]">Floor Batches: {fmt(fs.inventoryValuation.wipFloorValuationInr)}</span>
              </div>
              <div className="p-3 bg-[#FAF8F4] border border-[#DED7CC] rounded">
                <span className="text-[10px] text-[#686158] block">1220 Finished Goods (GL vs Bins)</span>
                <strong className="text-sm block">{fmt(fs.inventoryValuation.gl1220BalanceInr)}</strong>
                <span className="text-[10px] text-[#686158]">FG Warehouse: {fmt(fs.inventoryValuation.fgBinsPhysicalValuationInr)}</span>
              </div>
              <div className="p-3 bg-[#FAF8F4] border border-[#DED7CC] rounded">
                <span className="text-[10px] text-[#686158] block">5000 Cost of Goods Sold (COGS)</span>
                <strong className="text-sm text-[#9A783E] block">{fmt(fs.inventoryValuation.glCogs5000Inr)}</strong>
                <span className="text-[10px] text-[#686158]">Recognized upon invoicing</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Supplier AP Ledgers */}
            <div className="xl:col-span-2 border border-[#DED7CC] bg-white rounded-lg overflow-x-auto">
              <div className="px-4 py-3 bg-[#FAF8F4] border-b border-[#DED7CC] flex items-center justify-between">
                <h3 className="text-xs font-mono uppercase font-semibold">Supplier Payables Sub-Ledger (AP · 2100)</h3>
                <button
                  onClick={() => downloadCsvFile('fragmore_supplier_ap_ledger.csv', snap.supplierLedgers)}
                  className="px-2.5 py-1 border border-[#DED7CC] bg-white rounded text-[11px] font-mono cursor-pointer"
                >
                  CSV
                </button>
              </div>
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                  <tr>
                    <th className="py-2 px-3">Supplier</th>
                    <th className="py-2 px-3 text-right">Billed</th>
                    <th className="py-2 px-3 text-right">Paid</th>
                    <th className="py-2 px-3 text-right">Debit Notes</th>
                    <th className="py-2 px-3 text-right">Outstanding AP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DED7CC] font-mono tabular-nums">
                  {snap.supplierLedgers.map((s) => (
                    <tr key={s.supplierId} className="hover:bg-[#FAF8F4]">
                      <td className="py-2 px-3 font-sans">
                        <strong className="block">{s.supplierName}</strong>
                        <span className="text-[10px] font-mono text-[#686158]">{s.supplierCode} · {s.gstin || 'Unregistered'}</span>
                      </td>
                      <td className="py-2 px-3 text-right">{fmt(s.totalBilledInr)}</td>
                      <td className="py-2 px-3 text-right text-emerald-700">{fmt(s.totalPaidInr)}</td>
                      <td className="py-2 px-3 text-right">{fmt(s.totalDebitNotesInr)}</td>
                      <td className="py-2 px-3 text-right font-bold text-[#9A783E]">{fmt(s.outstandingPayableInr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* AR / AP Payment Settlement Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                runAction(
                  () =>
                    erpApi.recordAccountPayment({
                      direction: payForm.direction,
                      accountCode: payForm.accountCode,
                      vendorInvoiceId: payForm.direction === 'OUTBOUND_PAYOUT' ? payForm.vendorInvoiceId || undefined : undefined,
                      invoiceId: payForm.direction === 'INBOUND_RECEIPT' ? payForm.invoiceId || undefined : undefined,
                      partyName: payForm.partyName || undefined,
                      method: payForm.method,
                      referenceNumber: payForm.referenceNumber,
                      amountInr: payForm.amountInr,
                      idempotencyKey: `accpay-${Date.now()}`
                    }),
                  'AR/AP payment settled & General Ledger updated.'
                );
              }}
              className="border border-[#DED7CC] bg-white rounded-lg p-4 space-y-2.5 h-fit"
            >
              <h3 className="text-xs font-mono uppercase font-semibold border-b border-[#DED7CC] pb-2">
                Settle Supplier AP / Customer AR
              </h3>
              <select
                value={payForm.direction}
                onChange={(e) => setPayForm({ ...payForm, direction: e.target.value as any })}
                className="w-full px-2.5 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              >
                <option value="OUTBOUND_PAYOUT">Outbound Supplier Payout (Dr AP 2100)</option>
                <option value="INBOUND_RECEIPT">Inbound Customer Receipt (Cr AR 1100)</option>
              </select>
              {payForm.direction === 'OUTBOUND_PAYOUT' ? (
                <select
                  value={payForm.vendorInvoiceId}
                  onChange={(e) => {
                    const v = openVendorBills.find((x) => x.id === e.target.value);
                    setPayForm({
                      ...payForm,
                      vendorInvoiceId: e.target.value,
                      partyName: v?.supplierName || '',
                      amountInr: v ? Number(v.balanceDueInr) : payForm.amountInr
                    });
                  }}
                  className="w-full px-2.5 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                >
                  <option value="">Select Open Vendor Bill</option>
                  {openVendorBills.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.voucherNumber} · {v.supplierName} · Due {fmt(v.balanceDueInr)}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={payForm.invoiceId}
                  onChange={(e) => {
                    const inv = openCustomerInvs.find((x) => x.id === e.target.value);
                    setPayForm({
                      ...payForm,
                      invoiceId: e.target.value,
                      partyName: inv?.customerName || '',
                      amountInr: inv ? Number(inv.balanceDueInr) : payForm.amountInr
                    });
                  }}
                  className="w-full px-2.5 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                >
                  <option value="">Select Open Tax Invoice</option>
                  {openCustomerInvs.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.invoiceNumber} · {i.customerName} · Due {fmt(i.balanceDueInr)}
                    </option>
                  ))}
                </select>
              )}
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={payForm.accountCode}
                  onChange={(e) => setPayForm({ ...payForm, accountCode: e.target.value as any })}
                  className="px-2 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                >
                  <option value="1010">Bank (1010)</option>
                  <option value="1020">Cash (1020)</option>
                  <option value="1030">Petty Cash (1030)</option>
                </select>
                <input
                  required
                  placeholder="UTR / Ref #"
                  value={payForm.referenceNumber}
                  onChange={(e) => setPayForm({ ...payForm, referenceNumber: e.target.value })}
                  className="px-2 py-1.5 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
                />
              </div>
              <input
                type="number"
                min={1}
                step="0.01"
                value={payForm.amountInr}
                onChange={(e) => setPayForm({ ...payForm, amountInr: Number(e.target.value) })}
                className="w-full px-3 py-1.5 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
              />
              <button
                disabled={busy}
                type="submit"
                className="w-full py-2 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono uppercase rounded cursor-pointer"
              >
                Commit Payment Settlement
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 6: BANK RECONCILIATION */}
      {tab === 'BANK_RECON' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 border border-[#DED7CC] bg-white divide-y sm:divide-y-0 sm:divide-x divide-[#DED7CC] rounded-lg">
            <div className="p-4">
              <span className="text-[10px] font-mono uppercase text-[#686158] block">GL Bank Book (1010)</span>
              <span className="text-lg font-mono font-bold tabular-nums">{fmt(fs.bankReconciliation.glBankBookBalanceInr)}</span>
            </div>
            <div className="p-4">
              <span className="text-[10px] font-mono uppercase text-[#686158] block">Latest Bank Closing</span>
              <span className="text-lg font-mono font-bold tabular-nums">{fmt(fs.bankReconciliation.latestStatementBalanceInr)}</span>
            </div>
            <div className="p-4">
              <span className="text-[10px] font-mono uppercase text-[#686158] block">Matched Lines</span>
              <span className="text-lg font-mono font-bold text-emerald-700">{fs.bankReconciliation.matchedCount}</span>
            </div>
            <div className="p-4">
              <span className="text-[10px] font-mono uppercase text-[#686158] block">Unmatched Exceptions</span>
              <span className={`text-lg font-mono font-bold ${fs.bankReconciliation.unmatchedCount === 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {fs.bankReconciliation.unmatchedCount}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 border border-[#DED7CC] bg-white rounded-lg overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                  <tr>
                    <th className="py-2.5 px-3">Date &amp; Ref</th>
                    <th className="py-2.5 px-3">Bank Description</th>
                    <th className="py-2.5 px-3 text-right">Dr (Withdrawal)</th>
                    <th className="py-2.5 px-3 text-right">Cr (Deposit)</th>
                    <th className="py-2.5 px-3">Match Status</th>
                    <th className="py-2.5 px-3 text-right">Reconcile</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DED7CC] font-mono tabular-nums">
                  {snap.bankStatements.map((line) => (
                    <tr key={line.id} className="hover:bg-[#FAF8F4]">
                      <td className="py-2.5 px-3">
                        <strong className="block">{line.referenceNumber}</strong>
                        <span className="text-[10px] text-[#686158]">{line.statementDate}</span>
                      </td>
                      <td className="py-2.5 px-3 font-sans">{line.description}</td>
                      <td className="py-2.5 px-3 text-right text-rose-700">{line.withdrawalInr > 0 ? fmt(line.withdrawalInr) : '—'}</td>
                      <td className="py-2.5 px-3 text-right text-emerald-700">{line.depositInr > 0 ? fmt(line.depositInr) : '—'}</td>
                      <td className="py-2.5 px-3 text-[11px]">{line.matchStatus}</td>
                      <td className="py-2.5 px-3 text-right space-x-2">
                        {line.matchStatus === 'UNMATCHED' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            {unreconciledPayments.length > 0 && (
                              <>
                                <select
                                  value={manualMatchPayMap[line.id] || ''}
                                  onChange={(e) => setManualMatchPayMap({ ...manualMatchPayMap, [line.id]: e.target.value })}
                                  className="px-1.5 py-1 border border-[#DED7CC] rounded text-[10px] bg-white max-w-[130px]"
                                >
                                  <option value="">Match Payment...</option>
                                  {unreconciledPayments.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.paymentNumber} · {fmt(p.amountInr)}
                                    </option>
                                  ))}
                                </select>
                                {manualMatchPayMap[line.id] && (
                                  <button
                                    disabled={busy}
                                    onClick={() =>
                                      runAction(
                                        () =>
                                          erpApi.reconcileBankLine(line.id, {
                                            action: 'MATCH_PAYMENT',
                                            paymentId: manualMatchPayMap[line.id]
                                          }),
                                        'Bank line manually matched to payment.'
                                      )
                                    }
                                    className="px-2 py-1 bg-[#24211D] text-[#FAF8F4] rounded text-[10px] cursor-pointer"
                                  >
                                    Match
                                  </button>
                                )}
                              </>
                            )}
                            <button
                              disabled={busy}
                              onClick={() =>
                                runAction(
                                  () => erpApi.reconcileBankLine(line.id, { action: 'POST_BANK_CHARGE' }),
                                  'Posted bank charge / interest to GL & reconciled statement line.'
                                )
                              }
                              className="px-2 py-1 border border-[#9A783E] text-[#9A783E] rounded text-[10px] cursor-pointer"
                            >
                              Post to GL
                            </button>
                          </div>
                        ) : (
                          <button
                            disabled={busy}
                            onClick={() =>
                              runAction(
                                () => erpApi.reconcileBankLine(line.id, { action: 'UNMATCH' }),
                                'Reconciliation match cleared.'
                              )
                            }
                            className="text-[11px] text-[#686158] hover:text-rose-700 cursor-pointer"
                          >
                            Unmatch
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {snap.bankStatements.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#686158]">
                        No bank statement lines imported yet. Import HDFC Bank entries on the right.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                runAction(async () => {
                  await erpApi.importBankStatement({
                    bankAccountCode: '1010',
                    lines: [stmtLineForm]
                  });
                  setStmtLineForm({ ...stmtLineForm, referenceNumber: '', withdrawalInr: 0, depositInr: 0 });
                }, 'Imported bank statement line (Auto-matched against UTR if present).');
              }}
              className="border border-[#DED7CC] bg-white rounded-lg p-4 space-y-2.5 h-fit"
            >
              <h3 className="text-xs font-mono uppercase font-semibold border-b border-[#DED7CC] pb-2">
                Import Bank Statement Line (Auto-Match)
              </h3>
              <input
                type="date"
                value={stmtLineForm.statementDate}
                onChange={(e) => setStmtLineForm({ ...stmtLineForm, statementDate: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
              />
              <input
                required
                placeholder="Bank UTR / Reference Number *"
                value={stmtLineForm.referenceNumber}
                onChange={(e) => setStmtLineForm({ ...stmtLineForm, referenceNumber: e.target.value })}
                className="w-full px-3 py-1.5 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
              />
              <input
                required
                placeholder="Statement Narration"
                value={stmtLineForm.description}
                onChange={(e) => setStmtLineForm({ ...stmtLineForm, description: e.target.value })}
                className="w-full px-3 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Withdrawal (Dr) ₹"
                  value={stmtLineForm.withdrawalInr}
                  onChange={(e) => setStmtLineForm({ ...stmtLineForm, withdrawalInr: Number(e.target.value) })}
                  className="px-2.5 py-1.5 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
                />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Deposit (Cr) ₹"
                  value={stmtLineForm.depositInr}
                  onChange={(e) => setStmtLineForm({ ...stmtLineForm, depositInr: Number(e.target.value) })}
                  className="px-2.5 py-1.5 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
                />
              </div>
              <input
                type="number"
                placeholder="Statement Closing Balance ₹"
                value={stmtLineForm.closingBalanceInr}
                onChange={(e) => setStmtLineForm({ ...stmtLineForm, closingBalanceInr: Number(e.target.value) })}
                className="w-full px-3 py-1.5 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
              />
              <button
                disabled={busy}
                type="submit"
                className="w-full py-2.5 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono uppercase rounded cursor-pointer"
              >
                Import &amp; Auto-Match Statement Line
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 7: ACCOUNTANT ACCEPTANCE & RECONCILIATION VERIFICATION GATE */}
      {tab === 'VERIFICATION' && (
        <div className="space-y-6">
          <div className="border border-[#DED7CC] bg-white rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="font-serif text-lg uppercase text-[#24211D]">
                Production Readiness Gate · Reconciliation, GST &amp; Accountant Acceptance Tests
              </h3>
              <p className="text-xs text-[#686158]">
                System remains in <strong>VERIFICATION_PENDING</strong> until all 7 automated ledger/GST/sub-ledger checks pass and Finance Controller / Accountant records acceptance sign-off.
              </p>
            </div>
            <button
              disabled={busy}
              onClick={() =>
                runAction(
                  () => erpApi.runAccountingVerification(),
                  'Executed 7 automated reconciliation, GST & double-entry verification tests.'
                )
              }
              className="px-5 py-2.5 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono uppercase rounded whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Run Verification Suite</span>
            </button>
          </div>

          {snap.signoffs.map((run) => (
            <div key={run.id} className="border border-[#DED7CC] bg-white rounded-lg p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DED7CC] pb-3">
                <div>
                  <span className="font-mono font-bold text-sm text-[#24211D]">{run.runNumber}</span>
                  <span className="ml-3 font-mono text-xs text-[#686158]">
                    Run Date: {run.runDate} · Executed by {run.executedByEmail}
                  </span>
                </div>
                <div className="font-mono text-xs font-bold">
                  <span className={run.allAutomatedPassed ? 'text-emerald-700' : 'text-rose-700'}>
                    {run.checksPassedCount}/{run.checksTotalCount} Automated Checks Passed
                  </span>
                  <span className="ml-3 px-2 py-0.5 border border-[#DED7CC] rounded bg-[#FAF8F4]">{run.decision}</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                    <tr>
                      <th className="py-2 px-3">Check</th>
                      <th className="py-2 px-3">Expected</th>
                      <th className="py-2 px-3">Actual</th>
                      <th className="py-2 px-3 text-right">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DED7CC] font-mono">
                    {((run.checkResults as any[]) || []).map((c, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-3 font-sans font-medium">{c.title}</td>
                        <td className="py-2 px-3 text-[#686158]">{c.expectedValue}</td>
                        <td className="py-2 px-3">{c.actualValue}</td>
                        <td className={`py-2 px-3 text-right font-bold ${c.passed ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {c.passed ? 'PASS' : 'FAIL'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {run.decision === 'PENDING_REVIEW' && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2 border-t border-[#DED7CC]">
                  <input
                    placeholder="Accountant review notes / statutory observations..."
                    value={signoffNotes}
                    onChange={(e) => setSignoffNotes(e.target.value)}
                    className="flex-1 px-3 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                  />
                  <button
                    disabled={busy || !run.allAutomatedPassed}
                    onClick={() =>
                      runAction(
                        () =>
                          erpApi.decideAccountingReadiness(run.id, {
                            decision: 'ACCEPTED_PRODUCTION_READY',
                            notes: signoffNotes || 'All reconciliation, GST & trial balance checks accepted.'
                          }),
                        'Accountant Acceptance recorded: Accounting System marked ACCEPTED_PRODUCTION_READY.'
                      )
                    }
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white text-xs font-mono rounded cursor-pointer"
                  >
                    Accept &amp; Mark Production-Ready
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      runAction(
                        () =>
                          erpApi.decideAccountingReadiness(run.id, {
                            decision: 'REJECTED_NEEDS_CORRECTION',
                            notes: signoffNotes || 'Returned for ledger correction.'
                          }),
                        'Verification rejected for correction.'
                      )
                    }
                    className="px-4 py-2 border border-rose-300 text-rose-700 text-xs font-mono rounded cursor-pointer"
                  >
                    Reject / Needs Correction
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
