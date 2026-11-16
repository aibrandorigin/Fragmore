import crypto from 'crypto';
import { db } from '../db/index.ts';
import {
  erpOrganizations,
  erpChartOfAccounts,
  erpHsnSacMaster,
  erpQuotations,
  erpInvoices,
  erpCreditNotes,
  erpSalesDebitNotes,
  erpDeliveryChallans,
  erpSalesReturns,
  erpPayments,
  erpAccountingJournals,
  erpExpensesAndPettyCash,
  erpBankStatements,
  erpAccountantSignoffs,
  erpVendorInvoices,
  erpDebitNotes,
  erpMaterials,
  erpStockLots,
  erpFinishedGoods,
  erpApprovals,
  erpSequences,
  productionBatches,
  supplierPurchaseOrders,
  procurementSuppliers,
  orders,
  customers
} from '../db/schema.ts';
import { eq, desc, asc, sql } from 'drizzle-orm';
import {
  ORG_ID,
  ErpError,
  ValidationError,
  NotFoundError,
  ConflictError,
  getNextSequence,
  recordErpAuditLog,
  createErpNotification,
  ensureErpSeeded,
  type ErpActorContext
} from './erpBusinessOsEngine.ts';

// ============================================================================
// DECIMAL-SAFE PAISE ARITHMETIC & INDIAN GST STATE CONSTANTS
// ============================================================================

export function toPaise(amountInr: number): number {
  return Math.round((Number(amountInr) || 0) * 100);
}

export function fromPaise(paise: number): number {
  return Math.round(paise) / 100;
}

export function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
}

function currentIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

function getFiscalPeriod(dateStr?: string): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  const year = d.getUTCMonth() >= 3 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  const nextShort = String((year + 1) % 100).padStart(2, '0');
  return `FY${year}-${nextShort}`;
}

export const INDIAN_GST_STATES: Array<{ code: string; name: string }> = [
  { code: '01', name: 'Jammu and Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '26', name: 'Dadra and Nagar Haveli and Daman and Diu' },
  { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman and Nicobar Islands' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
  { code: '38', name: 'Ladakh' }
];

export function resolveIndianState(stateNameOrCode?: string | null): { code: string; name: string } {
  const raw = (stateNameOrCode || 'Maharashtra').trim().toLowerCase();
  const match = INDIAN_GST_STATES.find(
    (s) => s.name.toLowerCase() === raw || s.code === raw
  );
  if (match) return match;
  return { code: '27', name: stateNameOrCode?.trim() || 'Maharashtra' };
}

export function validateGstinFormat(gstin?: string | null, expectedStateCode?: string): string | null {
  const cleaned = (gstin || '').trim().toUpperCase();
  if (!cleaned) return null;
  const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!regex.test(cleaned)) {
    throw new ValidationError(`Invalid GSTIN format "${cleaned}". Expected 15-character GSTIN (e.g. 27AABCF9482M1Z8).`);
  }
  if (expectedStateCode && cleaned.slice(0, 2) !== expectedStateCode) {
    throw new ValidationError(
      `Customer GSTIN state code (${cleaned.slice(0, 2)}) does not match Place of Supply state code (${expectedStateCode}).`
    );
  }
  return cleaned;
}

export function computeGstLineAmounts(params: {
  qty: number;
  unitPriceInr: number;
  discountInr?: number;
  gstRatePct: number;
  isInterState: boolean;
  pricingMode: 'EXCLUSIVE' | 'INCLUSIVE';
}) {
  const qty = Number(params.qty || 0);
  if (qty <= 0) throw new ValidationError('Line item quantity must be greater than zero.');
  const unitPriceInr = Number(params.unitPriceInr || 0);
  if (unitPriceInr < 0) throw new ValidationError('Unit price cannot be negative.');
  const gstRatePct = Number(params.gstRatePct ?? 0);
  const lineDiscountPaise = toPaise(params.discountInr || 0);

  let taxablePaise = 0;
  let totalTaxPaise = 0;
  let totalPaise = 0;
  let effectiveExclUnitPriceInr = round2(unitPriceInr);

  if (params.pricingMode === 'INCLUSIVE') {
    const grossBeforeDiscPaise = Math.round(qty * toPaise(unitPriceInr));
    const netGrossPaise = Math.max(0, grossBeforeDiscPaise - lineDiscountPaise);
    taxablePaise = Math.round((netGrossPaise * 100) / (100 + gstRatePct));
    totalTaxPaise = netGrossPaise - taxablePaise;
    totalPaise = netGrossPaise;
    effectiveExclUnitPriceInr = qty > 0 ? round2(fromPaise(taxablePaise) / qty) : 0;
  } else {
    const grossTaxablePaise = Math.round(qty * toPaise(unitPriceInr));
    taxablePaise = Math.max(0, grossTaxablePaise - lineDiscountPaise);
    totalTaxPaise = Math.round((taxablePaise * gstRatePct) / 100);
    totalPaise = taxablePaise + totalTaxPaise;
  }

  let cgstPaise = 0;
  let sgstPaise = 0;
  let igstPaise = 0;
  if (params.isInterState) {
    igstPaise = totalTaxPaise;
  } else {
    cgstPaise = Math.floor(totalTaxPaise / 2);
    sgstPaise = totalTaxPaise - cgstPaise;
  }

  return {
    qty,
    unitPriceInr: round2(unitPriceInr),
    effectiveExclUnitPriceInr,
    discountInr: fromPaise(lineDiscountPaise),
    taxableValueInr: fromPaise(taxablePaise),
    gstRatePct,
    cgstInr: fromPaise(cgstPaise),
    sgstInr: fromPaise(sgstPaise),
    igstInr: fromPaise(igstPaise),
    totalTaxInr: fromPaise(totalTaxPaise),
    totalInr: fromPaise(totalPaise),
    paise: {
      taxablePaise,
      cgstPaise,
      sgstPaise,
      igstPaise,
      totalTaxPaise,
      totalPaise
    }
  };
}

function assertBalancedJournalLines(
  lines: Array<{ accountCode: string; accountName: string; accountType: string; debitInr: number; creditInr: number }>
) {
  if (!Array.isArray(lines) || lines.length < 2) {
    throw new ValidationError('Double-entry journal requires at least 2 balanced ledger lines.');
  }
  let drPaise = 0;
  let crPaise = 0;
  for (const l of lines) {
    const d = toPaise(l.debitInr || 0);
    const c = toPaise(l.creditInr || 0);
    if (d < 0 || c < 0) throw new ValidationError('Journal debit/credit amounts cannot be negative.');
    if (d > 0 && c > 0) throw new ValidationError(`Journal line ${l.accountCode} cannot have both Debit and Credit.`);
    drPaise += d;
    crPaise += c;
  }
  if (drPaise <= 0 || drPaise !== crPaise) {
    throw new ValidationError(
      `Decimal-safe double-entry check failed: Total Debit ₹${fromPaise(drPaise)} != Total Credit ₹${fromPaise(crPaise)}.`
    );
  }
  return { totalDebitInr: fromPaise(drPaise), totalCreditInr: fromPaise(crPaise) };
}

// ============================================================================
// CHART OF ACCOUNTS & HSN/SAC SEEDING (IDEMPOTENT)
// ============================================================================

const COA_SEEDS = [
  { id: 'coa-1010', accountCode: '1010', accountName: 'HDFC Operating Bank Account', accountType: 'ASSET', subGroup: 'BANK', normalBalance: 'DEBIT', description: 'Primary corporate current bank account for D2C, B2B & vendor settlements' },
  { id: 'coa-1020', accountCode: '1020', accountName: 'Cash on Hand — Atelier Register', accountType: 'ASSET', subGroup: 'CASH', normalBalance: 'DEBIT', description: 'Physical cash drawer for boutique & studio walk-in collections' },
  { id: 'coa-1030', accountCode: '1030', accountName: 'Petty Cash Imprest Float', accountType: 'ASSET', subGroup: 'PETTY_CASH', normalBalance: 'DEBIT', description: 'Studio & atelier petty cash imprest fund' },
  { id: 'coa-1100', accountCode: '1100', accountName: 'Accounts Receivable — Trade Debtors', accountType: 'ASSET', subGroup: 'AR', normalBalance: 'DEBIT', description: 'Customer receivables from B2C, B2B & corporate tax invoices' },
  { id: 'coa-1150', accountCode: '1150', accountName: 'Supplier Advances & Prepayments', accountType: 'ASSET', subGroup: 'AR', normalBalance: 'DEBIT', description: 'Advance deposits paid to raw material & glass flacon vendors' },
  { id: 'coa-1200', accountCode: '1200', accountName: 'Raw Materials & Packaging Inventory', accountType: 'ASSET', subGroup: 'INVENTORY', normalBalance: 'DEBIT', description: 'Fragrance oils, aroma chemicals, ethanol, glass flacons & coffrets' },
  { id: 'coa-1210', accountCode: '1210', accountName: 'Work-in-Progress (Maceration & Compounding)', accountType: 'ASSET', subGroup: 'INVENTORY', normalBalance: 'DEBIT', description: 'Active compounding & maceration batches on floor' },
  { id: 'coa-1220', accountCode: '1220', accountName: 'Finished Goods Luxury Inventory', accountType: 'ASSET', subGroup: 'INVENTORY', normalBalance: 'DEBIT', description: 'QC-released finished perfume bottles & discovery kits' },
  { id: 'coa-1310', accountCode: '1310', accountName: 'Input GST Credit Receivable (ITC)', accountType: 'ASSET', subGroup: 'GST_INPUT', normalBalance: 'DEBIT', description: 'Eligible CGST/SGST/IGST input tax credit from vendor bills & expenses' },
  { id: 'coa-2100', accountCode: '2100', accountName: 'Accounts Payable — Trade Suppliers', accountType: 'LIABILITY', subGroup: 'AP', normalBalance: 'CREDIT', description: 'Outstanding vendor bills payable to suppliers' },
  { id: 'coa-2110', accountCode: '2110', accountName: 'Goods Received Not Invoiced (GRNI Clearing)', accountType: 'LIABILITY', subGroup: 'AP', normalBalance: 'CREDIT', description: 'Temporary clearing liability for inspected GRNs awaiting supplier bill' },
  { id: 'coa-2210', accountCode: '2210', accountName: 'Output CGST Payable', accountType: 'LIABILITY', subGroup: 'GST_OUTPUT', normalBalance: 'CREDIT', description: 'Central GST output tax liability on intra-state supplies' },
  { id: 'coa-2220', accountCode: '2220', accountName: 'Output SGST Payable', accountType: 'LIABILITY', subGroup: 'GST_OUTPUT', normalBalance: 'CREDIT', description: 'State GST output tax liability on intra-state supplies' },
  { id: 'coa-2230', accountCode: '2230', accountName: 'Output IGST Payable', accountType: 'LIABILITY', subGroup: 'GST_OUTPUT', normalBalance: 'CREDIT', description: 'Integrated GST output tax liability on inter-state supplies' },
  { id: 'coa-2250', accountCode: '2250', accountName: 'Customer Advances Liability', accountType: 'LIABILITY', subGroup: 'AP', normalBalance: 'CREDIT', description: 'Advance deposits received from B2B / corporate clients pending final invoicing' },
  { id: 'coa-3000', accountCode: '3000', accountName: 'Shareholders Equity & Paid-In Capital', accountType: 'EQUITY', subGroup: 'EQUITY', normalBalance: 'CREDIT', description: 'Authorized & paid-up equity share capital of FRAGMORÉ' },
  { id: 'coa-4000', accountCode: '4000', accountName: 'Luxury Fragrance & Gifting Revenue', accountType: 'REVENUE', subGroup: 'REVENUE', normalBalance: 'CREDIT', description: 'Net taxable sales from B2C, B2B, wholesale & corporate gifting' },
  { id: 'coa-4010', accountCode: '4010', accountName: 'Sales Returns & Allowances', accountType: 'REVENUE', subGroup: 'REVENUE', normalBalance: 'DEBIT', description: 'Contra-revenue account for customer returns & GST credit notes' },
  { id: 'coa-4020', accountCode: '4020', accountName: 'Event Services & Perfume Bar Revenue', accountType: 'REVENUE', subGroup: 'REVENUE', normalBalance: 'CREDIT', description: 'Bespoke event staffing, perfume bar setup & fragrance activation fees' },
  { id: 'coa-5000', accountCode: '5000', accountName: 'Cost of Goods Sold (COGS)', accountType: 'EXPENSE', subGroup: 'COGS', normalBalance: 'DEBIT', description: 'Manufacturing & packaging cost of finished bottles dispatched/invoiced' },
  { id: 'coa-5100', accountCode: '5100', accountName: 'Atelier Operations, Lease & Utilities', accountType: 'EXPENSE', subGroup: 'OPERATING_EXPENSE', normalBalance: 'DEBIT', description: 'Cold vault lease, studio electricity, bank charges & operations overhead' },
  { id: 'coa-5150', accountCode: '5150', accountName: 'Direct Non-PO Services & Freight Expense', accountType: 'EXPENSE', subGroup: 'OPERATING_EXPENSE', normalBalance: 'DEBIT', description: 'Logistics freight, courier, and non-PO professional expenses' },
  { id: 'coa-5200', accountCode: '5200', accountName: 'Absorbed Packaging, Labour & Atelier Overhead', accountType: 'EXPENSE', subGroup: 'COGS', normalBalance: 'CREDIT', description: 'Manufacturing conversion & absorption variance account' },
  { id: 'coa-5210', accountCode: '5210', accountName: 'Manufacturing Scrap & Damaged Write-off', accountType: 'EXPENSE', subGroup: 'COGS', normalBalance: 'DEBIT', description: 'Batch spillage, QC rejection & damaged goods write-offs' },
  { id: 'coa-5220', accountCode: '5220', accountName: 'R&D Sampling, Trials & Marketing Seeding Expense', accountType: 'EXPENSE', subGroup: 'OPERATING_EXPENSE', normalBalance: 'DEBIT', description: 'Cost of R&D lab trials, creator seeding & corporate sample dispatches' },
  { id: 'coa-5300', accountCode: '5300', accountName: 'Marketing, Meta/Google Ads & Agency Spend', accountType: 'EXPENSE', subGroup: 'OPERATING_EXPENSE', normalBalance: 'DEBIT', description: 'Performance marketing & brand editorial spend' },
  { id: 'coa-5400', accountCode: '5400', accountName: 'Salaries, Wages & Internship Stipends', accountType: 'EXPENSE', subGroup: 'OPERATING_EXPENSE', normalBalance: 'DEBIT', description: 'Payroll & intern stipend expense' }
];

const HSN_SAC_SEEDS = [
  { id: 'hsn-33030050', hsnSacCode: '33030050', codeType: 'HSN', description: 'Perfumes & Extrait de Parfum (Finished Bottled Fragrances)', gstRatePct: 18, cgstRatePct: 9, sgstRatePct: 9, igstRatePct: 18, approvalStatus: 'ACCOUNTANT_VERIFIED' },
  { id: 'hsn-33029011', hsnSacCode: '33029011', codeType: 'HSN', description: 'Fragrance Oil Concentrates & Compounded Odoriferous Mixtures', gstRatePct: 18, cgstRatePct: 9, sgstRatePct: 9, igstRatePct: 18, approvalStatus: 'ACCOUNTANT_VERIFIED' },
  { id: 'hsn-33012990', hsnSacCode: '33012990', codeType: 'HSN', description: 'Essential Oils, Absolutes & Oud Extracts', gstRatePct: 18, cgstRatePct: 9, sgstRatePct: 9, igstRatePct: 18, approvalStatus: 'ACCOUNTANT_VERIFIED' },
  { id: 'hsn-70109000', hsnSacCode: '70109000', codeType: 'HSN', description: 'Glass Flacons, Crimp Bottles & Discovery Vials', gstRatePct: 18, cgstRatePct: 9, sgstRatePct: 9, igstRatePct: 18, approvalStatus: 'ACCOUNTANT_VERIFIED' },
  { id: 'hsn-48192090', hsnSacCode: '48192090', codeType: 'HSN', description: 'Luxury Rigid Coffret Boxes & Custom Printed Cartons', gstRatePct: 18, cgstRatePct: 9, sgstRatePct: 9, igstRatePct: 18, approvalStatus: 'ACCOUNTANT_VERIFIED' },
  { id: 'hsn-96161020', hsnSacCode: '96161020', codeType: 'HSN', description: 'Scent Sprayers, Atomizer Pumps & Magnetic Zamac Caps', gstRatePct: 18, cgstRatePct: 9, sgstRatePct: 9, igstRatePct: 18, approvalStatus: 'ACCOUNTANT_VERIFIED' },
  { id: 'sac-998596', hsnSacCode: '998596', codeType: 'SAC', description: 'Perfume Bar Event Activations, Bespoke Setup & Staffing Services', gstRatePct: 18, cgstRatePct: 9, sgstRatePct: 9, igstRatePct: 18, approvalStatus: 'ACCOUNTANT_VERIFIED' }
];

let gstAccSeedPromise: Promise<void> | null = null;

export async function ensureGstAccountingSeeded(): Promise<void> {
  await ensureErpSeeded();
  if (gstAccSeedPromise) return gstAccSeedPromise;
  gstAccSeedPromise = (async () => {
    try {
      for (const coa of COA_SEEDS) {
        await db.insert(erpChartOfAccounts).values({ ...coa, organizationId: ORG_ID }).onConflictDoNothing();
      }
      for (const hsn of HSN_SAC_SEEDS) {
        await db
          .insert(erpHsnSacMaster)
          .values({
            ...hsn,
            organizationId: ORG_ID,
            adminApprovedByEmail: 'aibrandorigin@gmail.com',
            adminApprovedAt: new Date(),
            accountantVerifiedByEmail: 'finance@fragmore.shop',
            accountantVerifiedAt: new Date(),
            notes: 'Standard CBIC GST schedule verified by Finance Controller.'
          })
          .onConflictDoNothing();
      }
      const seqSeeds = [
        { seqKey: 'PFM', prefix: 'PFM-2026-', currentValue: 1000, padding: 4 },
        { seqKey: 'ADV', prefix: 'ADV-2026-', currentValue: 1000, padding: 4 },
        { seqKey: 'RCPT', prefix: 'RCPT-2026-', currentValue: 1000, padding: 4 },
        { seqKey: 'DC', prefix: 'DC-2026-', currentValue: 1000, padding: 4 },
        { seqKey: 'SRET', prefix: 'SRET-2026-', currentValue: 1000, padding: 4 },
        { seqKey: 'SDN', prefix: 'SDN-2026-', currentValue: 1000, padding: 4 },
        { seqKey: 'EXP', prefix: 'EXP-2026-', currentValue: 1000, padding: 4 },
        { seqKey: 'PC', prefix: 'PC-2026-', currentValue: 1000, padding: 4 },
        { seqKey: 'AUD', prefix: 'ACC-VER-2026-', currentValue: 1000, padding: 4 }
      ];
      for (const s of seqSeeds) {
        await db.insert(erpSequences).values(s).onConflictDoNothing();
      }
    } catch (err) {
      gstAccSeedPromise = null;
      throw err;
    }
  })();
  return gstAccSeedPromise;
}

// Helper to resolve sequence prefix from org settings if customized
async function getConfiguredNextSeq(tx: any, seqKey: string, defaultPrefix: string): Promise<string> {
  const existing = await tx.select().from(erpSequences).where(eq(erpSequences.seqKey, seqKey));
  if (!existing.length) {
    await tx
      .insert(erpSequences)
      .values({ seqKey, prefix: defaultPrefix, currentValue: 1001, padding: 4, updatedAt: new Date() })
      .onConflictDoNothing();
    return `${defaultPrefix}1001`;
  }
  return getNextSequence(tx, seqKey);
}

// ============================================================================
// 1. GST CONFIGURATION, NUMBERING SERIES & HSN/SAC GOVERNANCE
// ============================================================================

export async function updateGstAndPolicyConfig(
  actor: ErpActorContext,
  payload: {
    legalName?: string;
    gstin?: string;
    pan?: string;
    cin?: string;
    stateName?: string;
    stateCode?: string;
    registeredAddress?: string;
    eInvoiceEnabled?: boolean;
    eInvoiceThresholdInr?: number;
    eWayBillThresholdInr?: number;
    inventoryValuationPolicy?: 'WEIGHTED_AVERAGE' | 'FIFO_LOT_COST';
    numberingPrefixes?: Record<string, string>;
    approveGstConfig?: boolean;
  }
) {
  await ensureGstAccountingSeeded();
  return await db.transaction(async (tx) => {
    const [org] = await tx.select().from(erpOrganizations).where(eq(erpOrganizations.id, ORG_ID));
    if (!org) throw new NotFoundError('Organization master not found.');

    const resolvedState = resolveIndianState(payload.stateName || payload.stateCode || org.stateName);
    const validatedGstin = payload.gstin
      ? validateGstinFormat(payload.gstin, resolvedState.code) || org.gstin
      : org.gstin;

    const mergedPrefixes = {
      ...((org.numberingPrefixes as Record<string, string>) || {}),
      ...(payload.numberingPrefixes || {})
    };

    if (payload.numberingPrefixes) {
      for (const [key, pref] of Object.entries(payload.numberingPrefixes)) {
        if (!pref?.trim()) continue;
        const seqRows = await tx.select().from(erpSequences).where(eq(erpSequences.seqKey, key));
        if (seqRows.length) {
          await tx
            .update(erpSequences)
            .set({ prefix: pref.trim(), updatedAt: new Date() })
            .where(eq(erpSequences.seqKey, key));
        } else {
          await tx
            .insert(erpSequences)
            .values({ seqKey: key, prefix: pref.trim(), currentValue: 1000, padding: 4, updatedAt: new Date() })
            .onConflictDoNothing();
        }
      }
    }

    const [updated] = await tx
      .update(erpOrganizations)
      .set({
        legalName: payload.legalName?.trim() || org.legalName,
        gstin: validatedGstin,
        pan: payload.pan?.trim().toUpperCase() || org.pan,
        cin: payload.cin?.trim().toUpperCase() ?? org.cin,
        stateName: resolvedState.name,
        stateCode: resolvedState.code,
        registeredAddress: payload.registeredAddress?.trim() || org.registeredAddress,
        eInvoiceEnabled: payload.eInvoiceEnabled !== undefined ? Boolean(payload.eInvoiceEnabled) : org.eInvoiceEnabled,
        eInvoiceThresholdInr: payload.eInvoiceThresholdInr !== undefined ? Number(payload.eInvoiceThresholdInr) : org.eInvoiceThresholdInr,
        eWayBillThresholdInr: payload.eWayBillThresholdInr !== undefined ? Number(payload.eWayBillThresholdInr) : org.eWayBillThresholdInr,
        inventoryValuationPolicy: payload.inventoryValuationPolicy || org.inventoryValuationPolicy,
        numberingPrefixes: mergedPrefixes,
        gstConfigApprovedBy: payload.approveGstConfig ? actor.email : org.gstConfigApprovedBy,
        gstConfigApprovedAt: payload.approveGstConfig ? new Date() : org.gstConfigApprovedAt,
        // Changing GST / valuation policy requires fresh Accountant verification before marking ready
        accountingReadyStatus: 'VERIFICATION_PENDING',
        version: sql`${erpOrganizations.version} + 1`,
        updatedAt: new Date()
      })
      .where(eq(erpOrganizations.id, ORG_ID))
      .returning();

    await recordErpAuditLog(tx, {
      action: 'ERP_GST_CONFIG_UPDATED',
      entity: 'erp_organizations',
      entityId: ORG_ID,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Updated GST & Accounting Policy: GSTIN=${updated.gstin} State=${updated.stateName}(${updated.stateCode}) Policy=${updated.inventoryValuationPolicy}`
    });

    return updated;
  });
}

export async function upsertHsnSacRule(
  actor: ErpActorContext,
  payload: {
    id?: string;
    hsnSacCode: string;
    codeType: 'HSN' | 'SAC';
    description: string;
    gstRatePct: number;
    cessRatePct?: number;
    notes?: string;
  }
) {
  await ensureGstAccountingSeeded();
  const code = (payload.hsnSacCode || '').trim().toUpperCase();
  if (!/^\d{4,8}$/.test(code)) {
    throw new ValidationError('HSN/SAC code must be 4 to 8 numeric digits (never invent placeholder codes).');
  }
  const gstRate = Number(payload.gstRatePct);
  if (![0, 5, 12, 18, 28].includes(gstRate)) {
    throw new ValidationError('GST rate must be an official CBIC slab (0%, 5%, 12%, 18%, or 28%).');
  }
  if (!payload.description?.trim()) throw new ValidationError('HSN/SAC description is required.');

  const half = round2(gstRate / 2);
  const existing = await db.select().from(erpHsnSacMaster).where(eq(erpHsnSacMaster.hsnSacCode, code));
  if (existing.length) {
    const [updated] = await db
      .update(erpHsnSacMaster)
      .set({
        codeType: payload.codeType,
        description: payload.description.trim(),
        gstRatePct: gstRate,
        cgstRatePct: half,
        sgstRatePct: half,
        igstRatePct: gstRate,
        cessRatePct: Number(payload.cessRatePct || 0),
        approvalStatus: 'PENDING_ADMIN_APPROVAL',
        adminApprovedByEmail: null,
        accountantVerifiedByEmail: null,
        notes: payload.notes || null,
        updatedAt: new Date()
      })
      .where(eq(erpHsnSacMaster.id, existing[0].id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(erpHsnSacMaster)
    .values({
      id: makeId('hsn'),
      organizationId: ORG_ID,
      hsnSacCode: code,
      codeType: payload.codeType,
      description: payload.description.trim(),
      gstRatePct: gstRate,
      cgstRatePct: half,
      sgstRatePct: half,
      igstRatePct: gstRate,
      cessRatePct: Number(payload.cessRatePct || 0),
      approvalStatus: 'PENDING_ADMIN_APPROVAL',
      notes: payload.notes || 'Requires Administrator Approval and Accountant Verification before statutory filing.'
    })
    .returning();

  await recordErpAuditLog(db, {
    action: 'ERP_HSN_RULE_CREATED',
    entity: 'erp_hsn_sac_master',
    entityId: created.id,
    actorEmail: actor.email,
    actorRole: actor.roleCode,
    details: `Proposed ${created.codeType} ${created.hsnSacCode} @ ${gstRate}% GST (Pending Admin & Accountant verification)`
  });

  return created;
}

export async function decideHsnSacVerification(
  actor: ErpActorContext,
  hsnId: string,
  action: 'ADMIN_APPROVE' | 'ACCOUNTANT_VERIFY'
) {
  const rows = await db.select().from(erpHsnSacMaster).where(eq(erpHsnSacMaster.id, hsnId));
  if (!rows.length) throw new NotFoundError('HSN/SAC configuration rule not found.');
  const rule = rows[0];

  if (action === 'ADMIN_APPROVE') {
    const [upd] = await db
      .update(erpHsnSacMaster)
      .set({
        approvalStatus: rule.accountantVerifiedByEmail ? 'ACCOUNTANT_VERIFIED' : 'ADMIN_APPROVED',
        adminApprovedByEmail: actor.email,
        adminApprovedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(erpHsnSacMaster.id, hsnId))
      .returning();
    return upd;
  }

  // ACCOUNTANT_VERIFY requires admin approval first unless Super Admin / Finance Controller
  if (!rule.adminApprovedByEmail && !actor.isSuperAdmin) {
    throw new ValidationError(`HSN/SAC ${rule.hsnSacCode} must be approved by an Administrator before Accountant verification.`);
  }
  const [upd] = await db
    .update(erpHsnSacMaster)
    .set({
      approvalStatus: 'ACCOUNTANT_VERIFIED',
      adminApprovedByEmail: rule.adminApprovedByEmail || actor.email,
      adminApprovedAt: rule.adminApprovedAt || new Date(),
      accountantVerifiedByEmail: actor.email,
      accountantVerifiedAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(erpHsnSacMaster.id, hsnId))
    .returning();
  return upd;
}

// ============================================================================
// 2. SALES BILLING: PROFORMA, TAX INVOICE (INCL/EXCL + COGS + ADVANCE ADJ),
//    ADVANCE RECEIPT, CREDIT NOTE, DEBIT NOTE, CHALLANS & SALES RETURNS
// ============================================================================

export async function createSalesBillingDocument(
  actor: ErpActorContext,
  payload: {
    invoiceType?: 'TAX_INVOICE' | 'B2B_GST_INVOICE' | 'PROFORMA';
    billingCategory?: 'B2C' | 'B2B' | 'CORPORATE_GIFTING' | 'EVENT_SERVICES' | 'SAMPLE_SALES' | 'WHOLESALE';
    pricingMode?: 'EXCLUSIVE' | 'INCLUSIVE';
    quotationId?: string;
    orderId?: string;
    advancePaymentId?: string;
    advanceAdjustAmountInr?: number;
    customerName?: string;
    customerEmail?: string;
    customerGstin?: string;
    billingAddress?: string;
    placeOfSupplyState?: string;
    issueDate?: string;
    dueDate?: string;
    discountInr?: number;
    shippingInr?: number;
    notes?: string;
    items?: Array<{
      sku?: string;
      description: string;
      hsnCode?: string;
      qty: number;
      unitPriceInr: number;
      discountInr?: number;
      gstRatePct?: number;
    }>;
    idempotencyKey?: string;
  }
) {
  await ensureGstAccountingSeeded();
  if (payload.idempotencyKey) {
    const dup = await db.select().from(erpInvoices).where(eq(erpInvoices.idempotencyKey, payload.idempotencyKey));
    if (dup.length) return { invoice: dup[0], deduplicated: true };
  }

  return await db.transaction(async (tx) => {
    const [org] = await tx.select().from(erpOrganizations).where(eq(erpOrganizations.id, ORG_ID));
    const orgState = resolveIndianState(org?.stateName || 'Maharashtra');

    let customerName = payload.customerName || '';
    let customerEmail = payload.customerEmail || '';
    let customerGstin: string | null = payload.customerGstin || null;
    let billingAddress = payload.billingAddress || '';
    let rawSupplyState = payload.placeOfSupplyState || orgState.name;
    let itemsInput = payload.items || [];
    let overallDiscountInr = Number(payload.discountInr || 0);
    let shippingInr = Number(payload.shippingInr || 0);
    let pricingMode: 'EXCLUSIVE' | 'INCLUSIVE' = payload.pricingMode || 'EXCLUSIVE';
    let billingCategory = payload.billingCategory || (customerGstin ? 'B2B' : 'B2C');
    let quotation: any = null;
    let order: any = null;

    if (payload.quotationId) {
      const qtRows = await tx.select().from(erpQuotations).where(eq(erpQuotations.id, payload.quotationId));
      if (!qtRows.length) throw new NotFoundError('Referenced Quotation not found.');
      quotation = qtRows[0];
      customerName = quotation.clientName;
      customerEmail = quotation.clientEmail;
      customerGstin = quotation.clientGstin;
      rawSupplyState = quotation.placeOfSupplyState;
      overallDiscountInr = Number(quotation.discountInr || 0);
      shippingInr = Number(quotation.freightInr || 0);
      itemsInput = (quotation.items as any[]) || [];
      billingCategory = customerGstin ? 'B2B' : 'CORPORATE_GIFTING';
    } else if (payload.orderId) {
      const ordRows = await tx.select().from(orders).where(eq(orders.id, payload.orderId));
      if (!ordRows.length) throw new NotFoundError('Referenced Storefront/B2B Order not found.');
      order = ordRows[0];
      customerName = order.customerName;
      customerEmail = order.customerEmail;
      const addr: any = order.shippingAddress || {};
      rawSupplyState = addr.state || orgState.name;
      billingAddress = [addr.addressLine1, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ');
      overallDiscountInr = Number(order.discount || 0);
      shippingInr = Number(order.shippingAmount || 0);
      pricingMode = 'INCLUSIVE'; // Storefront order prices are GST-inclusive
      itemsInput = ((order.items as any[]) || []).map((it) => ({
        sku: it.sku || 'FRG-SKU',
        description: `${it.productName} (${it.size || '50 ml'})`,
        hsnCode: '33030050',
        qty: Number(it.quantity || 1),
        unitPriceInr: Number(it.unitPrice || 0),
        gstRatePct: 18
      }));
    }

    if (!customerName?.trim() || !itemsInput.length) {
      throw new ValidationError('Customer name and at least one billing line item are required.');
    }

    const supplyState = resolveIndianState(rawSupplyState);
    if (customerGstin) {
      customerGstin = validateGstinFormat(customerGstin, supplyState.code);
    }

    const isInterState = supplyState.code !== orgState.code;

    // Verify HSN/SAC rules against approved master (never invent unverified tax rates!)
    const hsnRules = await tx.select().from(erpHsnSacMaster);
    const hsnMap = new Map(hsnRules.map((h) => [h.hsnSacCode, h]));

    const computedRaw = itemsInput.map((it) => {
      const hsnCode = (it.hsnCode || (billingCategory === 'EVENT_SERVICES' ? '998596' : '33030050')).trim();
      const matchedRule = hsnMap.get(hsnCode);
      if (!matchedRule) {
        throw new ValidationError(
          `HSN/SAC "${hsnCode}" is not configured in GST Master. Add and obtain Admin/Accountant approval before billing.`
        );
      }
      if (matchedRule.approvalStatus === 'PENDING_ADMIN_APPROVAL') {
        throw new ValidationError(`HSN/SAC "${hsnCode}" is pending Administrator approval and cannot be billed yet.`);
      }
      const gstRatePct = it.gstRatePct !== undefined ? Number(it.gstRatePct) : matchedRule.gstRatePct;
      if (gstRatePct !== matchedRule.gstRatePct) {
        throw new ValidationError(
          `Line item "${it.description}" rate ${gstRatePct}% conflicts with Administrator-approved HSN ${hsnCode} rate ${matchedRule.gstRatePct}%.`
        );
      }
      const calc = computeGstLineAmounts({
        qty: Number(it.qty || 1),
        unitPriceInr: Number(it.unitPriceInr || 0),
        discountInr: Number(it.discountInr || 0),
        gstRatePct,
        isInterState,
        pricingMode
      });
      return {
        sku: it.sku || 'FRG-SKU',
        description: it.description,
        hsnCode,
        qty: calc.qty,
        unitPriceInr: calc.effectiveExclUnitPriceInr,
        billedRateInr: calc.unitPriceInr,
        discountInr: calc.discountInr,
        taxableValueInr: calc.taxableValueInr,
        gstRatePct: calc.gstRatePct,
        cgstInr: calc.cgstInr,
        sgstInr: calc.sgstInr,
        igstInr: calc.igstInr,
        totalInr: calc.totalInr,
        paise: calc.paise
      };
    });

    // Apply overall invoice discount proportionally using exact paise arithmetic
    const rawSubtotalPaise = computedRaw.reduce((s, l) => s + l.paise.taxablePaise, 0);
    const overallDiscountPaise = Math.min(rawSubtotalPaise, toPaise(overallDiscountInr));
    const taxableAfterDiscPaise = Math.max(0, rawSubtotalPaise - overallDiscountPaise);
    const ratio = rawSubtotalPaise > 0 ? taxableAfterDiscPaise / rawSubtotalPaise : 1;

    const cgstPaise = Math.round(computedRaw.reduce((s, l) => s + l.paise.cgstPaise, 0) * ratio);
    const sgstPaise = Math.round(computedRaw.reduce((s, l) => s + l.paise.sgstPaise, 0) * ratio);
    const igstPaise = Math.round(computedRaw.reduce((s, l) => s + l.paise.igstPaise, 0) * ratio);
    const totalTaxPaise = cgstPaise + sgstPaise + igstPaise;
    const shippingPaise = toPaise(shippingInr);
    const grandTotalPaise = taxableAfterDiscPaise + totalTaxPaise + shippingPaise;

    const grandTotalInr = fromPaise(grandTotalPaise);
    const taxableAmountInr = fromPaise(taxableAfterDiscPaise);
    const cgstAmountInr = fromPaise(cgstPaise);
    const sgstAmountInr = fromPaise(sgstPaise);
    const igstAmountInr = fromPaise(igstPaise);
    const totalTaxInr = fromPaise(totalTaxPaise);
    const subtotalInr = fromPaise(rawSubtotalPaise);

    const docType = payload.invoiceType || (customerGstin ? 'B2B_GST_INVOICE' : 'TAX_INVOICE');
    const isProforma = docType === 'PROFORMA';
    const issueDate = payload.issueDate || currentIsoDate();
    const dueDate = payload.dueDate || addDaysIso(15);
    const invoiceId = makeId('inv');

    const invoiceNumber = isProforma
      ? await getConfiguredNextSeq(tx, 'PFM', 'PFM-2026-')
      : await getConfiguredNextSeq(tx, 'INV', 'INV-2026-');

    const cleanItems = computedRaw.map(({ paise: _p, ...rest }) => rest);

    // E-Invoice & E-Way Bill statutory workflow readiness (Never invent IRN/EWB!)
    const eInvoiceStatus =
      !isProforma && org?.eInvoiceEnabled && Boolean(customerGstin)
        ? 'PENDING_NIC_GENERATION'
        : 'NOT_APPLICABLE';
    const eWayBillStatus =
      !isProforma && grandTotalInr >= Number(org?.eWayBillThresholdInr || 50000) && billingCategory !== 'EVENT_SERVICES'
        ? 'PENDING_EWB_GENERATION'
        : 'NOT_REQUIRED';

    let journalId: string | null = null;
    let journalNumber: string | null = null;
    let cogsAmountInr = 0;
    let cogsJournalId: string | null = null;
    let advanceAdjustedInr = 0;
    let advToAdjust: { id: string; availableAdv: number; receiptOrPayNum: string } | null = null;

    if (!isProforma) {
      // 1. Revenue & GST Output Journal (Dr AR 1100, Cr Revenue 4000/4020, Cr Output GST 2210/2220/2230)
      journalNumber = await getConfiguredNextSeq(tx, 'JRN', 'JRN-2026-');
      journalId = makeId('jrn');
      const revenueCredit = round2(taxableAmountInr + shippingInr);
      const revAcct =
        billingCategory === 'EVENT_SERVICES'
          ? { code: '4020', name: 'Event Services & Perfume Bar Revenue' }
          : { code: '4000', name: 'Luxury Fragrance & Gifting Revenue' };

      const jLines: any[] = [
        { accountCode: '1100', accountName: 'Accounts Receivable — Trade Debtors', accountType: 'ASSET', debitInr: grandTotalInr, creditInr: 0, costCenter: 'CC-410' },
        { accountCode: revAcct.code, accountName: revAcct.name, accountType: 'REVENUE', debitInr: 0, creditInr: revenueCredit, costCenter: 'CC-410' }
      ];
      if (cgstAmountInr > 0) jLines.push({ accountCode: '2210', accountName: 'Output CGST Payable', accountType: 'LIABILITY', debitInr: 0, creditInr: cgstAmountInr, costCenter: 'CC-510' });
      if (sgstAmountInr > 0) jLines.push({ accountCode: '2220', accountName: 'Output SGST Payable', accountType: 'LIABILITY', debitInr: 0, creditInr: sgstAmountInr, costCenter: 'CC-510' });
      if (igstAmountInr > 0) jLines.push({ accountCode: '2230', accountName: 'Output IGST Payable', accountType: 'LIABILITY', debitInr: 0, creditInr: igstAmountInr, costCenter: 'CC-510' });

      const bal = assertBalancedJournalLines(jLines);
      await tx.insert(erpAccountingJournals).values({
        id: journalId,
        organizationId: ORG_ID,
        journalNumber,
        entryDate: issueDate,
        fiscalPeriod: getFiscalPeriod(issueDate),
        sourceModule: 'SALES_INVOICE',
        sourceEntityId: invoiceId,
        narration: `${docType} ${invoiceNumber} (${billingCategory}) — ${customerName} [${isInterState ? 'IGST' : 'CGST+SGST'}]`,
        lines: jLines,
        totalDebitInr: bal.totalDebitInr,
        totalCreditInr: bal.totalCreditInr,
        isBalanced: true,
        postedByEmail: actor.email,
        status: 'POSTED'
      });

      // 2. Inventory Valuation & COGS Recognition per SKU manufacturing cost (only if SKUs match finished goods)
      if (billingCategory !== 'EVENT_SERVICES') {
        const fgRows = await tx.select().from(erpFinishedGoods);
        let cogsPaise = 0;
        for (const item of cleanItems) {
          const fg = fgRows.find((f) => f.sku === item.sku);
          if (fg && Number(fg.unitManufacturingCostInr || 0) > 0) {
            cogsPaise += Math.round(item.qty * toPaise(fg.unitManufacturingCostInr));
          }
        }
        if (cogsPaise > 0) {
          cogsAmountInr = fromPaise(cogsPaise);
          const cogsJrnNo = await getConfiguredNextSeq(tx, 'JRN', 'JRN-2026-');
          cogsJournalId = makeId('jrn');
          const cogsLines = [
            { accountCode: '5000', accountName: 'Cost of Goods Sold (COGS)', accountType: 'EXPENSE', debitInr: cogsAmountInr, creditInr: 0, costCenter: 'CC-410' },
            { accountCode: '1220', accountName: 'Finished Goods Luxury Inventory', accountType: 'ASSET', debitInr: 0, creditInr: cogsAmountInr, costCenter: 'CC-320' }
          ];
          const cogsBal = assertBalancedJournalLines(cogsLines);
          await tx.insert(erpAccountingJournals).values({
            id: cogsJournalId,
            organizationId: ORG_ID,
            journalNumber: cogsJrnNo,
            entryDate: issueDate,
            fiscalPeriod: getFiscalPeriod(issueDate),
            sourceModule: 'COGS',
            sourceEntityId: invoiceId,
            narration: `COGS & Finished Goods Inventory relief (${org?.inventoryValuationPolicy || 'WEIGHTED_AVERAGE'}) for ${invoiceNumber}`,
            lines: cogsLines,
            totalDebitInr: cogsBal.totalDebitInr,
            totalCreditInr: cogsBal.totalCreditInr,
            isBalanced: true,
            postedByEmail: actor.email,
            status: 'POSTED'
          });
        }
      }

      // 3. Validate & prepare Customer Advance adjustment if requested
      if (payload.advancePaymentId) {
        const advRows = await tx.select().from(erpPayments).where(eq(erpPayments.id, payload.advancePaymentId));
        if (!advRows.length) throw new NotFoundError('Referenced Advance Receipt not found.');
        const adv = advRows[0];
        const availableAdv = Number(adv.advanceRemainingInr || 0);
        if (availableAdv <= 0) throw new ValidationError(`Advance ${adv.paymentNumber} has zero remaining balance.`);
        const requestedAdj = payload.advanceAdjustAmountInr ? Number(payload.advanceAdjustAmountInr) : availableAdv;
        advanceAdjustedInr = round2(Math.min(availableAdv, grandTotalInr, requestedAdj));
        if (advanceAdjustedInr > 0) {
          advToAdjust = {
            id: adv.id,
            availableAdv,
            receiptOrPayNum: adv.receiptNumber || adv.paymentNumber
          };
        }
      }
    }

    const isPrepaidOrder = !isProforma && Boolean(order && order.paymentStatus === 'PAID');
    const amountPaidInr = isPrepaidOrder ? grandTotalInr : advanceAdjustedInr;
    const balanceDueInr = isProforma ? grandTotalInr : round2(Math.max(0, grandTotalInr - amountPaidInr));
    const paymentStatus = isProforma
      ? 'PROFORMA'
      : balanceDueInr <= 0.05
      ? 'PAID'
      : amountPaidInr > 0
      ? 'PARTIAL'
      : 'UNPAID';

    const [invoice] = await tx
      .insert(erpInvoices)
      .values({
        id: invoiceId,
        organizationId: ORG_ID,
        orderId: order?.id || null,
        quotationId: quotation?.id || null,
        invoiceNumber,
        invoiceType: docType,
        billingCategory,
        pricingMode,
        issueDate,
        dueDate,
        customerName: customerName.trim(),
        customerEmail: (customerEmail || 'client@fragmore.shop').trim().toLowerCase(),
        customerGstin,
        billingAddress: billingAddress || `${supplyState.name}, India`,
        placeOfSupplyState: supplyState.name,
        placeOfSupplyCode: supplyState.code,
        isInterState,
        items: cleanItems,
        subtotalInr,
        discountInr: fromPaise(overallDiscountPaise),
        taxableAmountInr,
        cgstAmountInr,
        sgstAmountInr,
        igstAmountInr,
        totalTaxInr,
        shippingInr: fromPaise(shippingPaise),
        grandTotalInr,
        advanceAdjustedInr,
        amountPaidInr,
        balanceDueInr,
        cogsAmountInr,
        cogsJournalId,
        journalId,
        eInvoiceStatus,
        eWayBillStatus,
        notes: payload.notes || null,
        paymentStatus,
        status: isProforma ? 'PROFORMA' : balanceDueInr <= 0.05 ? 'SETTLED' : 'ISSUED',
        createdByEmail: actor.email,
        idempotencyKey: payload.idempotencyKey || null
      })
      .returning();

    if (!isProforma && advToAdjust && advanceAdjustedInr > 0) {
      const adjJrnNo = await getConfiguredNextSeq(tx, 'JRN', 'JRN-2026-');
      const adjJrnId = makeId('jrn');
      const adjLines = [
        { accountCode: '2250', accountName: 'Customer Advances Liability', accountType: 'LIABILITY', debitInr: advanceAdjustedInr, creditInr: 0, costCenter: 'CC-410' },
        { accountCode: '1100', accountName: 'Accounts Receivable — Trade Debtors', accountType: 'ASSET', debitInr: 0, creditInr: advanceAdjustedInr, costCenter: 'CC-410' }
      ];
      const adjBal = assertBalancedJournalLines(adjLines);
      await tx.insert(erpAccountingJournals).values({
        id: adjJrnId,
        organizationId: ORG_ID,
        journalNumber: adjJrnNo,
        entryDate: issueDate,
        fiscalPeriod: getFiscalPeriod(issueDate),
        sourceModule: 'ADVANCE',
        sourceEntityId: invoice.id,
        narration: `Adjusted Customer Advance ${advToAdjust.receiptOrPayNum} against ${invoiceNumber}`,
        lines: adjLines,
        totalDebitInr: adjBal.totalDebitInr,
        totalCreditInr: adjBal.totalCreditInr,
        isBalanced: true,
        postedByEmail: actor.email,
        status: 'POSTED'
      });
      await tx
        .update(erpPayments)
        .set({
          advanceRemainingInr: round2(advToAdjust.availableAdv - advanceAdjustedInr),
          invoiceId: invoice.id,
          updatedAt: new Date()
        })
        .where(eq(erpPayments.id, advToAdjust.id));
    }

    if (isPrepaidOrder && order) {
      const settleJrnNum = await getConfiguredNextSeq(tx, 'JRN', 'JRN-2026-');
      const settlePayNum = await getConfiguredNextSeq(tx, 'PAY', 'PAY-2026-');
      const rcptNum = await getConfiguredNextSeq(tx, 'RCPT', 'RCPT-2026-');
      const settleJrnId = makeId('jrn');
      await tx.insert(erpAccountingJournals).values({
        id: settleJrnId,
        organizationId: ORG_ID,
        journalNumber: settleJrnNum,
        entryDate: issueDate,
        fiscalPeriod: getFiscalPeriod(issueDate),
        sourceModule: 'PAYMENT',
        sourceEntityId: invoice.id,
        narration: `Storefront payment receipt ${rcptNum} for ${invoiceNumber} (${order.orderNumber})`,
        lines: [
          { accountCode: '1010', accountName: 'HDFC Operating Bank Account', accountType: 'ASSET', debitInr: grandTotalInr, creditInr: 0, costCenter: 'CC-510' },
          { accountCode: '1100', accountName: 'Accounts Receivable — Trade Debtors', accountType: 'ASSET', debitInr: 0, creditInr: grandTotalInr, costCenter: 'CC-410' }
        ],
        totalDebitInr: grandTotalInr,
        totalCreditInr: grandTotalInr,
        isBalanced: true,
        postedByEmail: actor.email,
        status: 'POSTED'
      });
      await tx.insert(erpPayments).values({
        id: makeId('pay'),
        organizationId: ORG_ID,
        paymentNumber: settlePayNum,
        receiptNumber: rcptNum,
        accountCode: '1010',
        direction: 'INBOUND_RECEIPT',
        partyType: 'CUSTOMER',
        partyName: customerName,
        customerEmail: invoice.customerEmail,
        invoiceId: invoice.id,
        paymentDate: issueDate,
        method: String(order.paymentMethod || 'RAZORPAY'),
        referenceNumber: order.transactionId || order.orderNumber,
        amountInr: grandTotalInr,
        journalId: settleJrnId,
        recordedByEmail: actor.email,
        status: 'CLEARED'
      });
    }

    if (!isProforma && quotation) {
      await tx
        .update(erpQuotations)
        .set({
          status: 'CONVERTED',
          convertedInvoiceId: invoice.id,
          version: sql`${erpQuotations.version} + 1`,
          updatedAt: new Date()
        })
        .where(eq(erpQuotations.id, quotation.id));
    }

    await recordErpAuditLog(tx, {
      action: isProforma ? 'ERP_PROFORMA_ISSUED' : 'ERP_INVOICE_ISSUED',
      entity: 'erp_invoices',
      entityId: invoice.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `${invoiceNumber} (${billingCategory}/${pricingMode}) for ${customerName}: ₹${grandTotalInr}`
    });

    return { invoice, journalNumber };
  });
}

export async function convertProformaToTaxInvoice(actor: ErpActorContext, proformaId: string) {
  const rows = await db.select().from(erpInvoices).where(eq(erpInvoices.id, proformaId));
  if (!rows.length) throw new NotFoundError('Proforma invoice not found.');
  const pf = rows[0];
  if (pf.invoiceType !== 'PROFORMA') {
    throw new ValidationError(`${pf.invoiceNumber} is already a Tax Invoice.`);
  }
  if (pf.proformaConvertedToInvoiceId) {
    const existing = await db.select().from(erpInvoices).where(eq(erpInvoices.id, pf.proformaConvertedToInvoiceId));
    if (existing.length) return { invoice: existing[0], deduplicated: true };
  }

  const res = await createSalesBillingDocument(actor, {
    invoiceType: pf.customerGstin ? 'B2B_GST_INVOICE' : 'TAX_INVOICE',
    billingCategory: pf.billingCategory as any,
    pricingMode: 'EXCLUSIVE',
    customerName: pf.customerName,
    customerEmail: pf.customerEmail,
    customerGstin: pf.customerGstin || undefined,
    billingAddress: pf.billingAddress || undefined,
    placeOfSupplyState: pf.placeOfSupplyState,
    discountInr: Number(pf.discountInr || 0),
    shippingInr: Number(pf.shippingInr || 0),
    notes: `Converted from Proforma ${pf.invoiceNumber}`,
    items: (pf.items as any[]).map((it) => ({
      sku: it.sku,
      description: it.description,
      hsnCode: it.hsnCode,
      qty: Number(it.qty),
      unitPriceInr: Number(it.unitPriceInr),
      discountInr: Number(it.discountInr || 0),
      gstRatePct: Number(it.gstRatePct)
    })),
    idempotencyKey: `pfm-conv-${pf.id}`
  });

  await db
    .update(erpInvoices)
    .set({
      proformaConvertedToInvoiceId: res.invoice.id,
      status: 'SETTLED',
      updatedAt: new Date()
    })
    .where(eq(erpInvoices.id, pf.id));

  return res;
}

export async function recordCustomerAdvanceReceipt(
  actor: ErpActorContext,
  payload: {
    customerName: string;
    customerEmail: string;
    accountCode?: '1010' | '1020';
    method: string;
    referenceNumber: string;
    amountInr: number;
    paymentDate?: string;
    notes?: string;
  }
) {
  await ensureGstAccountingSeeded();
  const amt = round2(Number(payload.amountInr || 0));
  if (amt <= 0) throw new ValidationError('Advance receipt amount must be greater than zero.');
  if (!payload.customerName?.trim()) throw new ValidationError('Customer name is required.');
  if (!payload.referenceNumber?.trim()) throw new ValidationError('Payment reference/UTR is required.');

  return await db.transaction(async (tx) => {
    const paymentDate = payload.paymentDate || currentIsoDate();
    const payNum = await getConfiguredNextSeq(tx, 'PAY', 'PAY-2026-');
    const advNum = await getConfiguredNextSeq(tx, 'ADV', 'ADV-2026-');
    const jrnNum = await getConfiguredNextSeq(tx, 'JRN', 'JRN-2026-');
    const jrnId = makeId('jrn');
    const acctCode = payload.accountCode === '1020' ? '1020' : '1010';
    const acctName = acctCode === '1020' ? 'Cash on Hand — Atelier Register' : 'HDFC Operating Bank Account';

    const lines = [
      { accountCode: acctCode, accountName: acctName, accountType: 'ASSET', debitInr: amt, creditInr: 0, costCenter: 'CC-510' },
      { accountCode: '2250', accountName: 'Customer Advances Liability', accountType: 'LIABILITY', debitInr: 0, creditInr: amt, costCenter: 'CC-410' }
    ];
    const bal = assertBalancedJournalLines(lines);

    await tx.insert(erpAccountingJournals).values({
      id: jrnId,
      organizationId: ORG_ID,
      journalNumber: jrnNum,
      entryDate: paymentDate,
      fiscalPeriod: getFiscalPeriod(paymentDate),
      sourceModule: 'ADVANCE',
      sourceEntityId: advNum,
      narration: `Customer Advance Receipt ${advNum} from ${payload.customerName.trim()} (${payload.method} Ref: ${payload.referenceNumber})`,
      lines,
      totalDebitInr: bal.totalDebitInr,
      totalCreditInr: bal.totalCreditInr,
      isBalanced: true,
      postedByEmail: actor.email,
      status: 'POSTED'
    });

    const [payment] = await tx
      .insert(erpPayments)
      .values({
        id: makeId('pay'),
        organizationId: ORG_ID,
        paymentNumber: payNum,
        receiptNumber: advNum,
        accountCode: acctCode,
        direction: 'INBOUND_RECEIPT',
        partyType: 'CUSTOMER',
        partyName: payload.customerName.trim(),
        customerEmail: (payload.customerEmail || '').trim().toLowerCase() || null,
        isAdvance: true,
        advanceRemainingInr: amt,
        paymentDate,
        method: payload.method || 'NEFT',
        referenceNumber: payload.referenceNumber.trim(),
        amountInr: amt,
        journalId: jrnId,
        notes: payload.notes || 'Customer Advance Deposit',
        recordedByEmail: actor.email,
        status: 'CLEARED'
      })
      .returning();

    await recordErpAuditLog(tx, {
      action: 'ERP_ADVANCE_RECEIPT_POSTED',
      entity: 'erp_payments',
      entityId: payment.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Recorded Advance Receipt ${advNum} for ${payload.customerName}: ₹${amt}`
    });

    return { payment, journalNumber: jrnNum };
  });
}

export async function recordAccountPaymentReceiptOrPayout(
  actor: ErpActorContext,
  payload: {
    direction: 'INBOUND_RECEIPT' | 'OUTBOUND_PAYOUT';
    accountCode?: '1010' | '1020' | '1030';
    partyType?: string;
    partyName?: string;
    customerEmail?: string;
    invoiceId?: string;
    purchaseOrderId?: string;
    vendorInvoiceId?: string;
    method: string;
    referenceNumber: string;
    amountInr: number;
    paymentDate?: string;
    notes?: string;
    idempotencyKey?: string;
  }
) {
  await ensureGstAccountingSeeded();
  const amt = round2(Number(payload.amountInr || 0));
  if (amt <= 0) throw new ValidationError('Payment amount must be greater than zero.');
  if (!payload.referenceNumber?.trim()) throw new ValidationError('UTR / Reference number is required.');

  if (payload.idempotencyKey) {
    const dup = await db.select().from(erpPayments).where(eq(erpPayments.idempotencyKey, payload.idempotencyKey));
    if (dup.length) return { payment: dup[0], deduplicated: true };
  }

  return await db.transaction(async (tx) => {
    const paymentDate = payload.paymentDate || currentIsoDate();
    const payNum = await getConfiguredNextSeq(tx, 'PAY', 'PAY-2026-');
    const rcptNum = payload.direction === 'INBOUND_RECEIPT' ? await getConfiguredNextSeq(tx, 'RCPT', 'RCPT-2026-') : null;
    const jrnNum = await getConfiguredNextSeq(tx, 'JRN', 'JRN-2026-');
    const jrnId = makeId('jrn');
    const cashAcct = payload.accountCode || (payload.method === 'CASH' ? '1020' : '1010');
    const cashAcctName =
      cashAcct === '1020'
        ? 'Cash on Hand — Atelier Register'
        : cashAcct === '1030'
        ? 'Petty Cash Imprest Float'
        : 'HDFC Operating Bank Account';

    let partyName = payload.partyName || 'Counterparty';
    let custEmail = payload.customerEmail?.trim().toLowerCase() || null;
    let updatedInvoice: any = null;
    let supplierId: string | null = null;

    if (payload.invoiceId) {
      const invRows = await tx.select().from(erpInvoices).where(eq(erpInvoices.id, payload.invoiceId));
      if (!invRows.length) throw new NotFoundError('Referenced GST Invoice not found.');
      const inv = invRows[0];
      if (inv.invoiceType === 'PROFORMA') throw new ValidationError('Convert Proforma to Tax Invoice before recording Invoice settlement (or record as Advance Receipt).');
      if (inv.balanceDueInr <= 0.01) throw new ValidationError(`Invoice ${inv.invoiceNumber} is already settled.`);
      if (amt > inv.balanceDueInr + 0.5) throw new ValidationError(`Payment ₹${amt} exceeds balance due ₹${inv.balanceDueInr}.`);
      partyName = inv.customerName;
      custEmail = inv.customerEmail;
      const newPaid = round2(inv.amountPaidInr + amt);
      const newBal = round2(Math.max(0, inv.grandTotalInr - newPaid));
      const newStatus = newBal <= 0.05 ? 'PAID' : 'PARTIAL';
      const [upd] = await tx
        .update(erpInvoices)
        .set({
          amountPaidInr: newPaid,
          balanceDueInr: newBal,
          paymentStatus: newStatus,
          status: newStatus === 'PAID' ? 'SETTLED' : inv.status,
          version: sql`${erpInvoices.version} + 1`,
          updatedAt: new Date()
        })
        .where(eq(erpInvoices.id, inv.id))
        .returning();
      updatedInvoice = upd;
    } else if (payload.vendorInvoiceId) {
      const vRows = await tx.select().from(erpVendorInvoices).where(eq(erpVendorInvoices.id, payload.vendorInvoiceId));
      if (!vRows.length) throw new NotFoundError('Referenced Vendor Bill not found.');
      const vInv = vRows[0];
      if (amt > Number(vInv.balanceDueInr || 0) + 0.5) {
        throw new ValidationError(`Supplier payout ₹${amt} exceeds vendor bill balance ₹${vInv.balanceDueInr}.`);
      }
      partyName = vInv.supplierName;
      supplierId = vInv.supplierId;
      const newPaid = round2(Number(vInv.paidAmountInr || 0) + amt);
      const newBal = round2(Math.max(0, Number(vInv.balanceDueInr || 0) - amt));
      await tx
        .update(erpVendorInvoices)
        .set({
          paidAmountInr: newPaid,
          balanceDueInr: newBal,
          paymentStatus: newBal <= 0.05 ? 'PAID' : 'PARTIAL',
          status: newBal <= 0.05 ? 'PAID' : vInv.status,
          updatedAt: new Date()
        })
        .where(eq(erpVendorInvoices.id, vInv.id));
    } else if (payload.purchaseOrderId) {
      const poRows = await tx.select().from(supplierPurchaseOrders).where(eq(supplierPurchaseOrders.id, payload.purchaseOrderId));
      if (!poRows.length) throw new NotFoundError('Referenced Purchase Order not found.');
      partyName = poRows[0].supplierName;
      supplierId = poRows[0].supplierId;
      await tx
        .update(supplierPurchaseOrders)
        .set({ paymentStatus: amt >= poRows[0].totalCostInr - 1 ? 'PAID' : 'PARTIALLY_PAID', updatedAt: new Date() })
        .where(eq(supplierPurchaseOrders.id, poRows[0].id));
    }

    const lines =
      payload.direction === 'INBOUND_RECEIPT'
        ? [
            { accountCode: cashAcct, accountName: cashAcctName, accountType: 'ASSET', debitInr: amt, creditInr: 0, costCenter: 'CC-510' },
            { accountCode: '1100', accountName: 'Accounts Receivable — Trade Debtors', accountType: 'ASSET', debitInr: 0, creditInr: amt, costCenter: 'CC-410' }
          ]
        : [
            { accountCode: '2100', accountName: 'Accounts Payable — Trade Suppliers', accountType: 'LIABILITY', debitInr: amt, creditInr: 0, costCenter: 'CC-210' },
            { accountCode: cashAcct, accountName: cashAcctName, accountType: 'ASSET', debitInr: 0, creditInr: amt, costCenter: 'CC-510' }
          ];
    const bal = assertBalancedJournalLines(lines);

    await tx.insert(erpAccountingJournals).values({
      id: jrnId,
      organizationId: ORG_ID,
      journalNumber: jrnNum,
      entryDate: paymentDate,
      fiscalPeriod: getFiscalPeriod(paymentDate),
      sourceModule: payload.direction === 'INBOUND_RECEIPT' ? 'PAYMENT' : 'SUPPLIER_PAYMENT',
      sourceEntityId: payload.invoiceId || payload.vendorInvoiceId || payload.purchaseOrderId || payNum,
      narration: `${rcptNum ? `Receipt ${rcptNum} / ` : ''}${payNum} (${payload.method} Ref: ${payload.referenceNumber}) — ${partyName}`,
      lines,
      totalDebitInr: bal.totalDebitInr,
      totalCreditInr: bal.totalCreditInr,
      isBalanced: true,
      postedByEmail: actor.email,
      status: 'POSTED'
    });

    const [payment] = await tx
      .insert(erpPayments)
      .values({
        id: makeId('pay'),
        organizationId: ORG_ID,
        paymentNumber: payNum,
        receiptNumber: rcptNum,
        accountCode: cashAcct,
        direction: payload.direction,
        partyType: payload.partyType || (payload.direction === 'INBOUND_RECEIPT' ? 'CUSTOMER' : 'SUPPLIER'),
        partyName,
        customerEmail: custEmail,
        invoiceId: payload.invoiceId || null,
        purchaseOrderId: payload.purchaseOrderId || null,
        supplierId,
        vendorInvoiceId: payload.vendorInvoiceId || null,
        paymentDate,
        method: payload.method || 'NEFT',
        referenceNumber: payload.referenceNumber.trim(),
        amountInr: amt,
        journalId: jrnId,
        notes: payload.notes || null,
        recordedByEmail: actor.email,
        idempotencyKey: payload.idempotencyKey || null,
        status: 'CLEARED'
      })
      .returning();

    await recordErpAuditLog(tx, {
      action: 'ERP_PAYMENT_POSTED',
      entity: 'erp_payments',
      entityId: payment.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Posted ${payNum} (${payload.direction}) ₹${amt} via ${cashAcctName} — ${partyName}`
    });

    return { payment, updatedInvoice, journalNumber: jrnNum };
  });
}

export async function issueSalesDebitNoteTransaction(
  actor: ErpActorContext,
  payload: {
    invoiceId: string;
    reason: string;
    taxableAmountInr: number;
    gstRatePct?: number;
  }
) {
  await ensureGstAccountingSeeded();
  const taxable = round2(Number(payload.taxableAmountInr || 0));
  if (taxable <= 0) throw new ValidationError('Sales Debit Note taxable amount must be positive.');
  if (!payload.reason?.trim()) throw new ValidationError('Debit Note reason is required.');

  return await db.transaction(async (tx) => {
    const invRows = await tx.select().from(erpInvoices).where(eq(erpInvoices.id, payload.invoiceId));
    if (!invRows.length) throw new NotFoundError('Referenced Tax Invoice not found.');
    const inv = invRows[0];
    if (inv.invoiceType === 'PROFORMA') throw new ValidationError('Cannot issue GST Debit Note against a Proforma invoice.');

    const gstRate = Number(payload.gstRatePct ?? 18);
    const calc = computeGstLineAmounts({
      qty: 1,
      unitPriceInr: taxable,
      gstRatePct: gstRate,
      isInterState: inv.isInterState,
      pricingMode: 'EXCLUSIVE'
    });

    const dnNumber = await getConfiguredNextSeq(tx, 'SDN', 'SDN-2026-');
    const jrnNum = await getConfiguredNextSeq(tx, 'JRN', 'JRN-2026-');
    const jrnId = makeId('jrn');
    const dnId = makeId('sdn');
    const issueDate = currentIsoDate();

    const jLines: any[] = [
      { accountCode: '1100', accountName: 'Accounts Receivable — Trade Debtors', accountType: 'ASSET', debitInr: calc.totalInr, creditInr: 0, costCenter: 'CC-410' },
      { accountCode: '4000', accountName: 'Luxury Fragrance & Gifting Revenue', accountType: 'REVENUE', debitInr: 0, creditInr: calc.taxableValueInr, costCenter: 'CC-410' }
    ];
    if (calc.cgstInr > 0) jLines.push({ accountCode: '2210', accountName: 'Output CGST Payable', accountType: 'LIABILITY', debitInr: 0, creditInr: calc.cgstInr, costCenter: 'CC-510' });
    if (calc.sgstInr > 0) jLines.push({ accountCode: '2220', accountName: 'Output SGST Payable', accountType: 'LIABILITY', debitInr: 0, creditInr: calc.sgstInr, costCenter: 'CC-510' });
    if (calc.igstInr > 0) jLines.push({ accountCode: '2230', accountName: 'Output IGST Payable', accountType: 'LIABILITY', debitInr: 0, creditInr: calc.igstInr, costCenter: 'CC-510' });

    const bal = assertBalancedJournalLines(jLines);
    await tx.insert(erpAccountingJournals).values({
      id: jrnId,
      organizationId: ORG_ID,
      journalNumber: jrnNum,
      entryDate: issueDate,
      fiscalPeriod: getFiscalPeriod(issueDate),
      sourceModule: 'SALES_DEBIT_NOTE',
      sourceEntityId: dnId,
      narration: `Sales Debit Note ${dnNumber} against ${inv.invoiceNumber}: ${payload.reason}`,
      lines: jLines,
      totalDebitInr: bal.totalDebitInr,
      totalCreditInr: bal.totalCreditInr,
      isBalanced: true,
      postedByEmail: actor.email,
      status: 'POSTED'
    });

    const [debitNote] = await tx
      .insert(erpSalesDebitNotes)
      .values({
        id: dnId,
        organizationId: ORG_ID,
        debitNoteNumber: dnNumber,
        invoiceId: inv.id,
        issueDate,
        customerName: inv.customerName,
        customerEmail: inv.customerEmail,
        customerGstin: inv.customerGstin,
        placeOfSupplyState: inv.placeOfSupplyState,
        isInterState: inv.isInterState,
        reason: payload.reason.trim(),
        gstRatePct: gstRate,
        taxableAmountInr: calc.taxableValueInr,
        cgstInr: calc.cgstInr,
        sgstInr: calc.sgstInr,
        igstInr: calc.igstInr,
        totalDebitInr: calc.totalInr,
        journalId: jrnId,
        createdByEmail: actor.email,
        status: 'APPLIED'
      })
      .returning();

    const newBalanceDue = round2(inv.balanceDueInr + calc.totalInr);
    await tx
      .update(erpInvoices)
      .set({
        balanceDueInr: newBalanceDue,
        paymentStatus: inv.amountPaidInr > 0 ? 'PARTIAL' : 'UNPAID',
        status: 'ISSUED',
        version: sql`${erpInvoices.version} + 1`,
        updatedAt: new Date()
      })
      .where(eq(erpInvoices.id, inv.id));

    await recordErpAuditLog(tx, {
      action: 'ERP_SALES_DEBIT_NOTE_ISSUED',
      entity: 'erp_sales_debit_notes',
      entityId: dnId,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Issued Sales Debit Note ${dnNumber} against ${inv.invoiceNumber}: +₹${calc.totalInr}`
    });

    return { debitNote, journalNumber: jrnNum };
  });
}

export async function createDeliveryChallanTransaction(
  actor: ErpActorContext,
  payload: {
    challanType: 'SUPPLY_OF_GOODS' | 'EVENT_ACTIVATION' | 'SAMPLE_DISPATCH' | 'APPROVAL_BASIS' | 'STOCK_TRANSFER' | 'JOB_WORK';
    customerName: string;
    customerEmail?: string;
    customerGstin?: string;
    deliveryAddress: string;
    placeOfSupplyState?: string;
    transporterName?: string;
    vehicleNumber?: string;
    eWayBillNumber?: string;
    notes?: string;
    items: Array<{ sku?: string; description: string; hsnCode?: string; qty: number; unitValueInr: number }>;
  }
) {
  await ensureGstAccountingSeeded();
  if (!payload.customerName?.trim() || !payload.deliveryAddress?.trim() || !payload.items?.length) {
    throw new ValidationError('Customer, delivery address, and at least one item are required for Delivery Challan.');
  }

  return await db.transaction(async (tx) => {
    const challanNumber = await getConfiguredNextSeq(tx, 'DC', 'DC-2026-');
    const mappedItems = payload.items.map((it) => {
      const qty = Number(it.qty || 1);
      const unitVal = round2(Number(it.unitValueInr || 0));
      return {
        sku: it.sku || 'FRG-SKU',
        description: it.description,
        hsnCode: it.hsnCode || '33030050',
        qty,
        unitValueInr: unitVal,
        totalValueInr: round2(qty * unitVal)
      };
    });
    const totalVal = round2(mappedItems.reduce((s, i) => s + i.totalValueInr, 0));

    const [challan] = await tx
      .insert(erpDeliveryChallans)
      .values({
        id: makeId('dc'),
        organizationId: ORG_ID,
        challanNumber,
        challanType: payload.challanType,
        customerName: payload.customerName.trim(),
        customerEmail: payload.customerEmail?.trim().toLowerCase() || null,
        customerGstin: payload.customerGstin?.trim().toUpperCase() || null,
        deliveryAddress: payload.deliveryAddress.trim(),
        placeOfSupplyState: payload.placeOfSupplyState || 'Maharashtra',
        dispatchDate: currentIsoDate(),
        items: mappedItems,
        totalTaxableValueInr: totalVal,
        transporterName: payload.transporterName || null,
        vehicleNumber: payload.vehicleNumber || null,
        eWayBillNumber: payload.eWayBillNumber || null,
        notes: payload.notes || null,
        createdByEmail: actor.email,
        status: 'DISPATCHED'
      })
      .returning();

    await recordErpAuditLog(tx, {
      action: 'ERP_DELIVERY_CHALLAN_ISSUED',
      entity: 'erp_delivery_challans',
      entityId: challan.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Issued Delivery Challan ${challanNumber} (${payload.challanType}) to ${challan.customerName}: ₹${totalVal}`
    });

    return challan;
  });
}

export async function convertChallanToTaxInvoice(actor: ErpActorContext, challanId: string) {
  const rows = await db.select().from(erpDeliveryChallans).where(eq(erpDeliveryChallans.id, challanId));
  if (!rows.length) throw new NotFoundError('Delivery Challan not found.');
  const dc = rows[0];
  if (dc.convertedInvoiceId) {
    const existing = await db.select().from(erpInvoices).where(eq(erpInvoices.id, dc.convertedInvoiceId));
    if (existing.length) return { invoice: existing[0], deduplicated: true };
  }

  const res = await createSalesBillingDocument(actor, {
    invoiceType: dc.customerGstin ? 'B2B_GST_INVOICE' : 'TAX_INVOICE',
    billingCategory: dc.challanType === 'EVENT_ACTIVATION' ? 'EVENT_SERVICES' : dc.customerGstin ? 'B2B' : 'B2C',
    pricingMode: 'EXCLUSIVE',
    customerName: dc.customerName,
    customerEmail: dc.customerEmail || undefined,
    customerGstin: dc.customerGstin || undefined,
    billingAddress: dc.deliveryAddress,
    placeOfSupplyState: dc.placeOfSupplyState,
    notes: `Converted from Delivery Challan ${dc.challanNumber}`,
    items: (dc.items as any[]).map((it) => ({
      sku: it.sku,
      description: it.description,
      hsnCode: it.hsnCode || '33030050',
      qty: Number(it.qty || 1),
      unitPriceInr: Number(it.unitValueInr || 0),
      gstRatePct: 18
    })),
    idempotencyKey: `dc-inv-${dc.id}`
  });

  await db
    .update(erpDeliveryChallans)
    .set({
      convertedInvoiceId: res.invoice.id,
      status: 'CONVERTED_TO_INVOICE',
      version: sql`${erpDeliveryChallans.version} + 1`,
      updatedAt: new Date()
    })
    .where(eq(erpDeliveryChallans.id, dc.id));

  return res;
}

export async function processSalesReturnTransaction(
  actor: ErpActorContext,
  payload: {
    invoiceId: string;
    restockCondition: 'SELLABLE_RESTOCK' | 'DAMAGED_SCRAP';
    reason: string;
    returnTaxableAmountInr: number;
    returnedQty?: number;
    sku?: string;
  }
) {
  await ensureGstAccountingSeeded();
  const taxable = round2(Number(payload.returnTaxableAmountInr || 0));
  if (taxable <= 0) throw new ValidationError('Sales return taxable amount must be positive.');
  if (!payload.reason?.trim()) throw new ValidationError('Sales return reason is required.');

  return await db.transaction(async (tx) => {
    const invRows = await tx.select().from(erpInvoices).where(eq(erpInvoices.id, payload.invoiceId));
    if (!invRows.length) throw new NotFoundError('Referenced Tax Invoice not found.');
    const inv = invRows[0];
    if (inv.invoiceType === 'PROFORMA') throw new ValidationError('Cannot process sales return on a Proforma invoice.');

    const gstRate = Number(((inv.items as any[])?.[0]?.gstRatePct) ?? 18);
    const calc = computeGstLineAmounts({
      qty: 1,
      unitPriceInr: taxable,
      gstRatePct: gstRate,
      isInterState: inv.isInterState,
      pricingMode: 'EXCLUSIVE'
    });

    const retNumber = await getConfiguredNextSeq(tx, 'SRET', 'SRET-2026-');
    const cnNumber = await getConfiguredNextSeq(tx, 'CN', 'CN-2026-');
    const jrnNum = await getConfiguredNextSeq(tx, 'JRN', 'JRN-2026-');
    const issueDate = currentIsoDate();
    const cnId = makeId('cn');
    const retId = makeId('sret');
    const jrnId = makeId('jrn');

    // Credit Note GL Entry (Reverses Revenue/Sales Returns + Output GST vs AR)
    const cnLines: any[] = [
      { accountCode: '4010', accountName: 'Sales Returns & Allowances', accountType: 'REVENUE', debitInr: calc.taxableValueInr, creditInr: 0, costCenter: 'CC-410' }
    ];
    if (calc.cgstInr > 0) cnLines.push({ accountCode: '2210', accountName: 'Output CGST Payable', accountType: 'LIABILITY', debitInr: calc.cgstInr, creditInr: 0, costCenter: 'CC-510' });
    if (calc.sgstInr > 0) cnLines.push({ accountCode: '2220', accountName: 'Output SGST Payable', accountType: 'LIABILITY', debitInr: calc.sgstInr, creditInr: 0, costCenter: 'CC-510' });
    if (calc.igstInr > 0) cnLines.push({ accountCode: '2230', accountName: 'Output IGST Payable', accountType: 'LIABILITY', debitInr: calc.igstInr, creditInr: 0, costCenter: 'CC-510' });
    cnLines.push({ accountCode: '1100', accountName: 'Accounts Receivable — Trade Debtors', accountType: 'ASSET', debitInr: 0, creditInr: calc.totalInr, costCenter: 'CC-410' });

    const bal = assertBalancedJournalLines(cnLines);
    await tx.insert(erpAccountingJournals).values({
      id: jrnId,
      organizationId: ORG_ID,
      journalNumber: jrnNum,
      entryDate: issueDate,
      fiscalPeriod: getFiscalPeriod(issueDate),
      sourceModule: 'CREDIT_NOTE',
      sourceEntityId: cnId,
      narration: `Sales Return ${retNumber} & Credit Note ${cnNumber} (${inv.invoiceNumber}): ${payload.reason}`,
      lines: cnLines,
      totalDebitInr: bal.totalDebitInr,
      totalCreditInr: bal.totalCreditInr,
      isBalanced: true,
      postedByEmail: actor.email,
      status: 'POSTED'
    });

    // Optional Inventory Restock & COGS Reversal if sellable SKU returned
    let cogsReversedInr = 0;
    const retQty = Number(payload.returnedQty || 1);
    const targetSku = payload.sku || ((inv.items as any[])?.[0]?.sku as string | undefined);
    if (targetSku && retQty > 0) {
      const fgRows = await tx.select().from(erpFinishedGoods).where(eq(erpFinishedGoods.sku, targetSku));
      if (fgRows.length) {
        const fg = fgRows[0];
        const unitCost = Number(fg.unitManufacturingCostInr || 420);
        cogsReversedInr = round2(unitCost * retQty);
        if (cogsReversedInr > 0) {
          const cogsRevJrnNo = await getConfiguredNextSeq(tx, 'JRN', 'JRN-2026-');
          const cogsRevLines =
            payload.restockCondition === 'SELLABLE_RESTOCK'
              ? [
                  { accountCode: '1220', accountName: 'Finished Goods Luxury Inventory', accountType: 'ASSET', debitInr: cogsReversedInr, creditInr: 0, costCenter: 'CC-320' },
                  { accountCode: '5000', accountName: 'Cost of Goods Sold (COGS)', accountType: 'EXPENSE', debitInr: 0, creditInr: cogsReversedInr, costCenter: 'CC-410' }
                ]
              : [
                  { accountCode: '5210', accountName: 'Manufacturing Scrap & Damaged Write-off', accountType: 'EXPENSE', debitInr: cogsReversedInr, creditInr: 0, costCenter: 'CC-320' },
                  { accountCode: '5000', accountName: 'Cost of Goods Sold (COGS)', accountType: 'EXPENSE', debitInr: 0, creditInr: cogsReversedInr, costCenter: 'CC-410' }
                ];
          const cBal = assertBalancedJournalLines(cogsRevLines);
          await tx.insert(erpAccountingJournals).values({
            id: makeId('jrn'),
            organizationId: ORG_ID,
            journalNumber: cogsRevJrnNo,
            entryDate: issueDate,
            fiscalPeriod: getFiscalPeriod(issueDate),
            sourceModule: 'COGS',
            sourceEntityId: retId,
            narration: `Inventory ${payload.restockCondition} & COGS reversal for ${retNumber} (${targetSku} x ${retQty})`,
            lines: cogsRevLines,
            totalDebitInr: cBal.totalDebitInr,
            totalCreditInr: cBal.totalCreditInr,
            isBalanced: true,
            postedByEmail: actor.email,
            status: 'POSTED'
          });

          if (payload.restockCondition === 'SELLABLE_RESTOCK') {
            await tx
              .update(erpFinishedGoods)
              .set({
                quantityOnHand: sql`${erpFinishedGoods.quantityOnHand} + ${retQty}`,
                quantityAvailable: sql`${erpFinishedGoods.quantityAvailable} + ${retQty}`,
                updatedAt: new Date()
              })
              .where(eq(erpFinishedGoods.id, fg.id));
          }
        }
      }
    }

    const [creditNote] = await tx
      .insert(erpCreditNotes)
      .values({
        id: cnId,
        organizationId: ORG_ID,
        invoiceId: inv.id,
        salesReturnId: retId,
        creditNoteNumber: cnNumber,
        issueDate,
        customerName: inv.customerName,
        customerEmail: inv.customerEmail,
        reason: payload.reason.trim(),
        gstRatePct: gstRate,
        taxableAmountInr: calc.taxableValueInr,
        cgstInr: calc.cgstInr,
        sgstInr: calc.sgstInr,
        igstInr: calc.igstInr,
        totalCreditInr: calc.totalInr,
        journalId: jrnId,
        createdByEmail: actor.email,
        approvedByEmail: actor.email,
        status: 'APPLIED'
      })
      .returning();

    const [salesReturn] = await tx
      .insert(erpSalesReturns)
      .values({
        id: retId,
        organizationId: ORG_ID,
        returnNumber: retNumber,
        invoiceId: inv.id,
        orderId: inv.orderId,
        customerName: inv.customerName,
        customerEmail: inv.customerEmail,
        returnDate: issueDate,
        restockCondition: payload.restockCondition,
        reason: payload.reason.trim(),
        items: [{ sku: targetSku || 'RETURN', description: payload.reason.trim(), hsnCode: '33030050', qty: retQty, unitPriceInr: calc.taxableValueInr, gstRatePct: gstRate, taxableInr: calc.taxableValueInr, taxInr: calc.totalTaxInr, totalInr: calc.totalInr }],
        taxableAmountInr: calc.taxableValueInr,
        cgstInr: calc.cgstInr,
        sgstInr: calc.sgstInr,
        igstInr: calc.igstInr,
        totalReturnInr: calc.totalInr,
        cogsReversedInr,
        creditNoteId: cnId,
        journalId: jrnId,
        createdByEmail: actor.email,
        status: 'CREDITED'
      })
      .returning();

    const newBalance = round2(Math.max(0, inv.balanceDueInr - calc.totalInr));
    await tx
      .update(erpInvoices)
      .set({
        balanceDueInr: newBalance,
        paymentStatus: newBalance === 0 && inv.amountPaidInr === 0 ? 'CREDITED' : inv.paymentStatus,
        version: sql`${erpInvoices.version} + 1`,
        updatedAt: new Date()
      })
      .where(eq(erpInvoices.id, inv.id));

    await recordErpAuditLog(tx, {
      action: 'ERP_SALES_RETURN_CREDITED',
      entity: 'erp_sales_returns',
      entityId: retId,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Processed Sales Return ${retNumber} -> Credit Note ${cnNumber} (₹${calc.totalInr})`
    });

    return { salesReturn, creditNote, journalNumber: jrnNum };
  });
}

export async function updateInvoiceStatutoryCompliance(
  actor: ErpActorContext,
  invoiceId: string,
  payload: {
    eInvoiceStatus?: 'NOT_APPLICABLE' | 'PENDING_NIC_GENERATION' | 'IRN_VERIFIED' | 'CANCELLED';
    eInvoiceIrn?: string;
    irnAckNumber?: string;
    eWayBillStatus?: 'NOT_REQUIRED' | 'PENDING_EWB_GENERATION' | 'EWB_VERIFIED';
    eWayBillNumber?: string;
  }
) {
  const rows = await db.select().from(erpInvoices).where(eq(erpInvoices.id, invoiceId));
  if (!rows.length) throw new NotFoundError('Tax Invoice not found.');
  const inv = rows[0];

  if (payload.eInvoiceStatus === 'IRN_VERIFIED' && !payload.eInvoiceIrn?.trim()) {
    throw new ValidationError('Verified NIC IRN hash (64-char) is required when marking E-Invoice IRN_VERIFIED. Never fabricate IRN codes.');
  }
  if (payload.eWayBillStatus === 'EWB_VERIFIED' && !payload.eWayBillNumber?.trim()) {
    throw new ValidationError('Official 12-digit E-Way Bill number is required when marking EWB_VERIFIED.');
  }

  const [updated] = await db
    .update(erpInvoices)
    .set({
      eInvoiceStatus: payload.eInvoiceStatus || inv.eInvoiceStatus,
      eInvoiceIrn: payload.eInvoiceIrn?.trim() || inv.eInvoiceIrn,
      irnAckNumber: payload.irnAckNumber?.trim() || inv.irnAckNumber,
      eWayBillStatus: payload.eWayBillStatus || inv.eWayBillStatus,
      eWayBillNumber: payload.eWayBillNumber?.trim() || inv.eWayBillNumber,
      version: sql`${erpInvoices.version} + 1`,
      updatedAt: new Date()
    })
    .where(eq(erpInvoices.id, invoiceId))
    .returning();

  await recordErpAuditLog(db, {
    action: 'ERP_INVOICE_STATUTORY_UPDATED',
    entity: 'erp_invoices',
    entityId: invoiceId,
    actorEmail: actor.email,
    actorRole: actor.roleCode,
    details: `Updated statutory compliance for ${inv.invoiceNumber}: eInv=${updated.eInvoiceStatus}, EWB=${updated.eWayBillStatus}`
  });

  return updated;
}

// ============================================================================
// 3. DOUBLE-ENTRY ACCOUNTING: COA, REVERSALS, EXPENSES, PETTY CASH & BANK RECON
// ============================================================================

export async function upsertChartOfAccount(
  actor: ErpActorContext,
  payload: {
    accountCode: string;
    accountName: string;
    accountType: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
    subGroup: string;
    normalBalance?: 'DEBIT' | 'CREDIT';
    description?: string;
  }
) {
  await ensureGstAccountingSeeded();
  const code = (payload.accountCode || '').trim();
  if (!/^\d{4}$/.test(code)) throw new ValidationError('Account code must be a 4-digit code (e.g. 5450).');
  if (!payload.accountName?.trim()) throw new ValidationError('Account name is required.');

  const normalBalance =
    payload.normalBalance ||
    (['LIABILITY', 'EQUITY', 'REVENUE'].includes(payload.accountType) ? 'CREDIT' : 'DEBIT');

  const existing = await db.select().from(erpChartOfAccounts).where(eq(erpChartOfAccounts.accountCode, code));
  if (existing.length) {
    const [upd] = await db
      .update(erpChartOfAccounts)
      .set({
        accountName: payload.accountName.trim(),
        subGroup: payload.subGroup,
        description: payload.description || existing[0].description,
        updatedAt: new Date()
      })
      .where(eq(erpChartOfAccounts.id, existing[0].id))
      .returning();
    return upd;
  }

  const [created] = await db
    .insert(erpChartOfAccounts)
    .values({
      id: `coa-${code}`,
      organizationId: ORG_ID,
      accountCode: code,
      accountName: payload.accountName.trim(),
      accountType: payload.accountType,
      subGroup: payload.subGroup,
      normalBalance,
      description: payload.description || null,
      isSystemAccount: false,
      createdByEmail: actor.email
    })
    .returning();

  await recordErpAuditLog(db, {
    action: 'ERP_COA_ACCOUNT_SAVED',
    entity: 'erp_chart_of_accounts',
    entityId: created.id,
    actorEmail: actor.email,
    actorRole: actor.roleCode,
    details: `Saved GL Account ${code} — ${created.accountName} (${created.accountType})`
  });

  return created;
}

export async function reverseAccountingJournalTransaction(
  actor: ErpActorContext,
  journalId: string,
  reason: string
) {
  await ensureGstAccountingSeeded();
  if (!reason?.trim()) throw new ValidationError('A documented audit reason is required to reverse an immutable journal.');

  return await db.transaction(async (tx) => {
    const rows = await tx.select().from(erpAccountingJournals).where(eq(erpAccountingJournals.id, journalId));
    if (!rows.length) throw new NotFoundError('Journal entry not found.');
    const orig = rows[0];
    if (orig.reversedByJournalId) {
      throw new ValidationError(`Journal ${orig.journalNumber} was already reversed.`);
    }

    const revNumber = await getConfiguredNextSeq(tx, 'JRN', 'JRN-2026-');
    const revId = makeId('jrn');
    const entryDate = currentIsoDate();

    const contraLines = ((orig.lines as any[]) || []).map((l) => ({
      accountCode: l.accountCode,
      accountName: l.accountName,
      accountType: l.accountType,
      debitInr: Number(l.creditInr || 0),
      creditInr: Number(l.debitInr || 0),
      costCenter: l.costCenter || 'CC-510'
    }));
    const bal = assertBalancedJournalLines(contraLines);

    const [reversalJournal] = await tx
      .insert(erpAccountingJournals)
      .values({
        id: revId,
        organizationId: ORG_ID,
        journalNumber: revNumber,
        entryDate,
        fiscalPeriod: getFiscalPeriod(entryDate),
        sourceModule: 'REVERSAL',
        sourceEntityId: orig.id,
        narration: `CONTRA REVERSAL of ${orig.journalNumber}: ${reason.trim()}`,
        lines: contraLines,
        totalDebitInr: bal.totalDebitInr,
        totalCreditInr: bal.totalCreditInr,
        isBalanced: true,
        reversesJournalId: orig.id,
        reversalReason: reason.trim(),
        postedByEmail: actor.email,
        status: 'POSTED'
      })
      .returning();

    await tx
      .update(erpAccountingJournals)
      .set({
        reversedByJournalId: revId,
        reversalReason: reason.trim(),
        version: sql`${erpAccountingJournals.version} + 1`,
        updatedAt: new Date()
      })
      .where(eq(erpAccountingJournals.id, orig.id));

    await recordErpAuditLog(tx, {
      action: 'ERP_JOURNAL_REVERSED',
      entity: 'erp_accounting_journals',
      entityId: orig.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Posted immutable contra journal ${revNumber} reversing ${orig.journalNumber} (${reason.trim()})`
    });

    return { reversalJournal, originalJournalNumber: orig.journalNumber };
  });
}

export async function recordExpenseOrPettyCashVoucher(
  actor: ErpActorContext,
  payload: {
    voucherType: 'OPERATING_EXPENSE' | 'PETTY_CASH_EXPENSE' | 'PETTY_CASH_REPLENISHMENT';
    expenseDate?: string;
    category: string;
    expenseAccountCode: string;
    paymentAccountCode?: '1010' | '1020' | '1030';
    payeeName: string;
    vendorGstin?: string;
    placeOfSupplyState?: string;
    description: string;
    taxableAmountInr: number;
    gstRatePct?: number;
    receiptRef?: string;
  }
) {
  await ensureGstAccountingSeeded();
  const taxable = round2(Number(payload.taxableAmountInr || 0));
  if (taxable <= 0) throw new ValidationError('Voucher amount must be greater than zero.');
  if (!payload.payeeName?.trim() || !payload.description?.trim()) {
    throw new ValidationError('Payee name and expense description are required.');
  }

  return await db.transaction(async (tx) => {
    const [org] = await tx.select().from(erpOrganizations).where(eq(erpOrganizations.id, ORG_ID));
    const orgState = resolveIndianState(org?.stateName || 'Maharashtra');
    const supplyState = resolveIndianState(payload.placeOfSupplyState || orgState.name);
    const isInterState = supplyState.code !== orgState.code;
    const cleanVendorGstin = payload.vendorGstin ? validateGstinFormat(payload.vendorGstin) : null;

    const expenseDate = payload.expenseDate || currentIsoDate();
    const isReplenishment = payload.voucherType === 'PETTY_CASH_REPLENISHMENT';
    const isPetty = payload.voucherType !== 'OPERATING_EXPENSE';
    const voucherNumber = isPetty
      ? await getConfiguredNextSeq(tx, 'PC', 'PC-2026-')
      : await getConfiguredNextSeq(tx, 'EXP', 'EXP-2026-');

    const gstRate = isReplenishment ? 0 : Number(payload.gstRatePct || 0);
    const calc = computeGstLineAmounts({
      qty: 1,
      unitPriceInr: taxable,
      gstRatePct: gstRate,
      isInterState,
      pricingMode: 'EXCLUSIVE'
    });

    const payAcctCode = isReplenishment
      ? '1010'
      : payload.paymentAccountCode || (payload.voucherType === 'PETTY_CASH_EXPENSE' ? '1030' : '1010');
    const payAcctName =
      payAcctCode === '1030'
        ? 'Petty Cash Imprest Float'
        : payAcctCode === '1020'
        ? 'Cash on Hand — Atelier Register'
        : 'HDFC Operating Bank Account';

    const coaRows = await tx.select().from(erpChartOfAccounts);
    const expCoa = coaRows.find((c) => c.accountCode === (isReplenishment ? '1030' : payload.expenseAccountCode));
    const expAcctCode = isReplenishment ? '1030' : expCoa?.accountCode || '5100';
    const expAcctName = isReplenishment ? 'Petty Cash Imprest Float' : expCoa?.accountName || 'Atelier Operations, Lease & Utilities';
    const expAcctType = isReplenishment ? 'ASSET' : expCoa?.accountType || 'EXPENSE';

    const requiresApproval = !actor.isSuperAdmin && actor.roleCode !== 'FINANCE_CONTROLLER' && calc.totalInr > 25000;
    let journalId: string | null = null;
    let journalNumber: string | null = null;

    if (!requiresApproval) {
      journalNumber = await getConfiguredNextSeq(tx, 'JRN', 'JRN-2026-');
      journalId = makeId('jrn');
      const lines: any[] = [
        { accountCode: expAcctCode, accountName: expAcctName, accountType: expAcctType, debitInr: calc.taxableValueInr, creditInr: 0, costCenter: 'CC-510' }
      ];
      if (calc.totalTaxInr > 0) {
        lines.push({ accountCode: '1310', accountName: 'Input GST Credit Receivable (ITC)', accountType: 'ASSET', debitInr: calc.totalTaxInr, creditInr: 0, costCenter: 'CC-510' });
      }
      lines.push({ accountCode: payAcctCode, accountName: payAcctName, accountType: 'ASSET', debitInr: 0, creditInr: calc.totalInr, costCenter: 'CC-510' });

      const bal = assertBalancedJournalLines(lines);
      await tx.insert(erpAccountingJournals).values({
        id: journalId,
        organizationId: ORG_ID,
        journalNumber,
        entryDate: expenseDate,
        fiscalPeriod: getFiscalPeriod(expenseDate),
        sourceModule: isPetty ? 'PETTY_CASH' : 'EXPENSE',
        sourceEntityId: voucherNumber,
        narration: `${payload.voucherType} ${voucherNumber}: ${payload.payeeName} — ${payload.description}`,
        lines,
        totalDebitInr: bal.totalDebitInr,
        totalCreditInr: bal.totalCreditInr,
        isBalanced: true,
        postedByEmail: actor.email,
        status: 'POSTED'
      });
    }

    const voucherId = makeId('exp');
    const [voucher] = await tx
      .insert(erpExpensesAndPettyCash)
      .values({
        id: voucherId,
        organizationId: ORG_ID,
        voucherNumber,
        voucherType: payload.voucherType,
        expenseDate,
        category: payload.category,
        expenseAccountCode: expAcctCode,
        paymentAccountCode: payAcctCode,
        payeeName: payload.payeeName.trim(),
        vendorGstin: cleanVendorGstin,
        placeOfSupplyState: supplyState.name,
        isInterState,
        description: payload.description.trim(),
        taxableAmountInr: calc.taxableValueInr,
        gstRatePct: gstRate,
        cgstInr: calc.cgstInr,
        sgstInr: calc.sgstInr,
        igstInr: calc.igstInr,
        totalAmountInr: calc.totalInr,
        receiptRef: payload.receiptRef || null,
        approvalStatus: requiresApproval ? 'PENDING_APPROVAL' : 'APPROVED',
        approvedByEmail: requiresApproval ? null : actor.email,
        journalId,
        createdByEmail: actor.email,
        status: requiresApproval ? 'PENDING_APPROVAL' : 'POSTED'
      })
      .returning();

    if (requiresApproval) {
      const aprNum = await getConfiguredNextSeq(tx, 'APR', 'APR-FRG-');
      await tx.insert(erpApprovals).values({
        id: makeId('apr'),
        organizationId: ORG_ID,
        departmentId: 'dept-fin',
        approvalNumber: aprNum,
        moduleKey: 'accounting',
        entityType: 'EXPENSE_VOUCHER',
        entityId: voucher.id,
        title: `Approve Expense ${voucherNumber} (₹${calc.totalInr})`,
        summary: `${payload.payeeName}: ${payload.description}`,
        amountInr: calc.totalInr,
        requiredRoleCode: 'FINANCE_CONTROLLER',
        requestedByEmail: actor.email,
        status: 'PENDING'
      });
    }

    await recordErpAuditLog(tx, {
      action: 'ERP_EXPENSE_VOUCHER_RECORDED',
      entity: 'erp_expenses_and_petty_cash',
      entityId: voucher.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Recorded ${voucherNumber} (${payload.voucherType}) ₹${calc.totalInr} to ${payload.payeeName}`
    });

    return { voucher, journalNumber };
  });
}

export async function importBankStatementLines(
  actor: ErpActorContext,
  payload: {
    statementNumber?: string;
    bankAccountCode?: string;
    lines: Array<{
      statementDate: string;
      referenceNumber: string;
      description: string;
      withdrawalInr: number;
      depositInr: number;
      closingBalanceInr?: number;
    }>;
  }
) {
  await ensureGstAccountingSeeded();
  if (!Array.isArray(payload.lines) || !payload.lines.length) {
    throw new ValidationError('At least one bank statement line is required.');
  }

  return await db.transaction(async (tx) => {
    const stmtNo = payload.statementNumber || `STMT-${currentIsoDate()}`;
    const bankCode = payload.bankAccountCode || '1010';
    const existingPayments = await tx.select().from(erpPayments);
    const created: any[] = [];

    for (const line of payload.lines) {
      const wd = round2(Number(line.withdrawalInr || 0));
      const dep = round2(Number(line.depositInr || 0));
      const ref = (line.referenceNumber || '').trim();
      const matched = existingPayments.find((p) => {
        if (p.reconciledWithBank) return false;
        const amtMatch =
          (dep > 0 && p.direction === 'INBOUND_RECEIPT' && Math.abs(Number(p.amountInr) - dep) < 0.05) ||
          (wd > 0 && p.direction === 'OUTBOUND_PAYOUT' && Math.abs(Number(p.amountInr) - wd) < 0.05);
        const refMatch = ref && p.referenceNumber && p.referenceNumber.toLowerCase() === ref.toLowerCase();
        return refMatch && amtMatch;
      });

      const [row] = await tx
        .insert(erpBankStatements)
        .values({
          id: makeId('bnk'),
          organizationId: ORG_ID,
          statementNumber: stmtNo,
          statementDate: line.statementDate || currentIsoDate(),
          bankAccountCode: bankCode,
          referenceNumber: ref || `REF-${Date.now().toString().slice(-6)}`,
          description: line.description || 'Bank Entry',
          withdrawalInr: wd,
          depositInr: dep,
          closingBalanceInr: round2(Number(line.closingBalanceInr || 0)),
          matchStatus: matched ? 'MATCHED_AUTO' : 'UNMATCHED',
          matchedPaymentId: matched?.id || null,
          matchedJournalId: matched?.journalId || null,
          reconciledByEmail: matched ? actor.email : null,
          reconciledAt: matched ? new Date() : null,
          createdByEmail: actor.email
        })
        .returning();

      if (matched) {
        await tx
          .update(erpPayments)
          .set({ reconciledWithBank: true, bankStatementLineId: row.id, updatedAt: new Date() })
          .where(eq(erpPayments.id, matched.id));
      }
      created.push(row);
    }

    return { importedCount: created.length, autoMatchedCount: created.filter((c) => c.matchStatus === 'MATCHED_AUTO').length, lines: created };
  });
}

export async function reconcileBankStatementLine(
  actor: ErpActorContext,
  statementLineId: string,
  payload: { action: 'MATCH_PAYMENT' | 'POST_BANK_CHARGE' | 'UNMATCH'; paymentId?: string }
) {
  return await db.transaction(async (tx) => {
    const rows = await tx.select().from(erpBankStatements).where(eq(erpBankStatements.id, statementLineId));
    if (!rows.length) throw new NotFoundError('Bank statement line not found.');
    const line = rows[0];

    if (payload.action === 'MATCH_PAYMENT') {
      if (!payload.paymentId) throw new ValidationError('Payment ID is required for manual match.');
      const payRows = await tx.select().from(erpPayments).where(eq(erpPayments.id, payload.paymentId));
      if (!payRows.length) throw new NotFoundError('Payment record not found.');
      const pay = payRows[0];
      const [upd] = await tx
        .update(erpBankStatements)
        .set({
          matchStatus: 'MATCHED_MANUAL',
          matchedPaymentId: pay.id,
          matchedJournalId: pay.journalId,
          reconciledByEmail: actor.email,
          reconciledAt: new Date()
        })
        .where(eq(erpBankStatements.id, line.id))
        .returning();
      await tx
        .update(erpPayments)
        .set({ reconciledWithBank: true, bankStatementLineId: line.id, updatedAt: new Date() })
        .where(eq(erpPayments.id, pay.id));
      return upd;
    }

    if (payload.action === 'POST_BANK_CHARGE') {
      const amt = round2(Number(line.withdrawalInr || 0) || Number(line.depositInr || 0));
      if (amt <= 0) throw new ValidationError('Statement line has zero amount.');
      const isDeposit = Number(line.depositInr || 0) > 0;
      const jrnNum = await getConfiguredNextSeq(tx, 'JRN', 'JRN-2026-');
      const jrnId = makeId('jrn');
      const jLines = isDeposit
        ? [
            { accountCode: '1010', accountName: 'HDFC Operating Bank Account', accountType: 'ASSET', debitInr: amt, creditInr: 0, costCenter: 'CC-510' },
            { accountCode: '4000', accountName: 'Other Bank / Interest Income', accountType: 'REVENUE', debitInr: 0, creditInr: amt, costCenter: 'CC-510' }
          ]
        : [
            { accountCode: '5100', accountName: 'Atelier Operations, Lease & Utilities', accountType: 'EXPENSE', debitInr: amt, creditInr: 0, costCenter: 'CC-510' },
            { accountCode: '1010', accountName: 'HDFC Operating Bank Account', accountType: 'ASSET', debitInr: 0, creditInr: amt, costCenter: 'CC-510' }
          ];
      const bal = assertBalancedJournalLines(jLines);
      await tx.insert(erpAccountingJournals).values({
        id: jrnId,
        organizationId: ORG_ID,
        journalNumber: jrnNum,
        entryDate: line.statementDate,
        fiscalPeriod: getFiscalPeriod(line.statementDate),
        sourceModule: 'EXPENSE',
        sourceEntityId: line.id,
        narration: `Bank Reconciliation Posting (${line.referenceNumber}): ${line.description}`,
        lines: jLines,
        totalDebitInr: bal.totalDebitInr,
        totalCreditInr: bal.totalCreditInr,
        isBalanced: true,
        postedByEmail: actor.email,
        status: 'POSTED'
      });
      const [upd] = await tx
        .update(erpBankStatements)
        .set({
          matchStatus: 'BANK_CHARGE_POSTED',
          matchedJournalId: jrnId,
          reconciledByEmail: actor.email,
          reconciledAt: new Date()
        })
        .where(eq(erpBankStatements.id, line.id))
        .returning();
      return upd;
    }

    // UNMATCH
    if (line.matchedPaymentId) {
      await tx
        .update(erpPayments)
        .set({ reconciledWithBank: false, bankStatementLineId: null, updatedAt: new Date() })
        .where(eq(erpPayments.id, line.matchedPaymentId));
    }
    const [upd] = await tx
      .update(erpBankStatements)
      .set({
        matchStatus: 'UNMATCHED',
        matchedPaymentId: null,
        matchedJournalId: null,
        reconciledByEmail: null,
        reconciledAt: null
      })
      .where(eq(erpBankStatements.id, line.id))
      .returning();
    return upd;
  });
}

// ============================================================================
// 4. FINANCIAL STATEMENTS, REGISTERS, CUSTOMER/SUPPLIER LEDGERS & ACCEPTANCE TESTS
// ============================================================================

export async function getGstAccountingWorkspaceSnapshot(actor: ErpActorContext) {
  await ensureGstAccountingSeeded();

  const [
    orgs,
    coaRows,
    hsnRules,
    invoices,
    creditNotes,
    salesDebitNotes,
    deliveryChallans,
    salesReturns,
    payments,
    journals,
    expenses,
    bankStatements,
    signoffs,
    vendorInvoices,
    vendorDebitNotes,
    purchaseOrders,
    suppliers,
    materials,
    stockLots,
    finishedGoods,
    batches,
    sequences,
    storeOrders,
    storeCustomers
  ] = await Promise.all([
    db.select().from(erpOrganizations).where(eq(erpOrganizations.id, ORG_ID)),
    db.select().from(erpChartOfAccounts).orderBy(asc(erpChartOfAccounts.accountCode)),
    db.select().from(erpHsnSacMaster).orderBy(asc(erpHsnSacMaster.hsnSacCode)),
    db.select().from(erpInvoices).orderBy(desc(erpInvoices.createdAt)),
    db.select().from(erpCreditNotes).orderBy(desc(erpCreditNotes.createdAt)),
    db.select().from(erpSalesDebitNotes).orderBy(desc(erpSalesDebitNotes.createdAt)),
    db.select().from(erpDeliveryChallans).orderBy(desc(erpDeliveryChallans.createdAt)),
    db.select().from(erpSalesReturns).orderBy(desc(erpSalesReturns.createdAt)),
    db.select().from(erpPayments).orderBy(desc(erpPayments.createdAt)),
    db.select().from(erpAccountingJournals).orderBy(desc(erpAccountingJournals.entryDate), desc(erpAccountingJournals.createdAt)),
    db.select().from(erpExpensesAndPettyCash).orderBy(desc(erpExpensesAndPettyCash.createdAt)),
    db.select().from(erpBankStatements).orderBy(desc(erpBankStatements.statementDate), desc(erpBankStatements.createdAt)),
    db.select().from(erpAccountantSignoffs).orderBy(desc(erpAccountantSignoffs.createdAt)),
    db.select().from(erpVendorInvoices).orderBy(desc(erpVendorInvoices.createdAt)),
    db.select().from(erpDebitNotes).orderBy(desc(erpDebitNotes.createdAt)),
    db.select().from(supplierPurchaseOrders).orderBy(desc(supplierPurchaseOrders.createdAt)),
    db.select().from(procurementSuppliers),
    db.select().from(erpMaterials).orderBy(erpMaterials.code),
    db.select().from(erpStockLots),
    db.select().from(erpFinishedGoods).orderBy(erpFinishedGoods.sku),
    db.select().from(productionBatches),
    db.select().from(erpSequences).orderBy(erpSequences.seqKey),
    db.select().from(orders).orderBy(desc(orders.createdAt)),
    db.select().from(customers)
  ]);

  const org = orgs[0];

  // 1. Trial Balance computed strictly in integer paise across all POSTED journals
  const accMap: Record<
    string,
    {
      accountCode: string;
      accountName: string;
      accountType: string;
      subGroup: string;
      debitPaise: number;
      creditPaise: number;
    }
  > = {};

  for (const c of coaRows) {
    accMap[c.accountCode] = {
      accountCode: c.accountCode,
      accountName: c.accountName,
      accountType: c.accountType,
      subGroup: c.subGroup,
      debitPaise: 0,
      creditPaise: 0
    };
  }

  let totalDebitsPaise = 0;
  let totalCreditsPaise = 0;
  let unbalancedJournalsCount = 0;

  // Cash Flow buckets derived from cash/bank (1010, 1020, 1030) journal movements
  let cashReceiptsCustomersPaise = 0;
  let cashPaidSuppliersPaise = 0;
  let cashPaidExpensesPaise = 0;
  let cashCapitalInflowPaise = 0;
  let cashOtherNetPaise = 0;

  const glLedgerEntries: Array<{
    journalId: string;
    journalNumber: string;
    entryDate: string;
    sourceModule: string;
    narration: string;
    accountCode: string;
    accountName: string;
    accountType: string;
    debitInr: number;
    creditInr: number;
    isReversal: boolean;
  }> = [];

  for (const j of journals) {
    if (j.status !== 'POSTED') continue;
    const lines: any[] = Array.isArray(j.lines) ? j.lines : [];
    let jDr = 0;
    let jCr = 0;
    for (const l of lines) {
      const code = String(l.accountCode || '9999');
      const d = toPaise(l.debitInr || 0);
      const c = toPaise(l.creditInr || 0);
      jDr += d;
      jCr += c;
      totalDebitsPaise += d;
      totalCreditsPaise += c;

      if (!accMap[code]) {
        accMap[code] = {
          accountCode: code,
          accountName: String(l.accountName || code),
          accountType: String(l.accountType || 'ASSET'),
          subGroup: 'OTHER',
          debitPaise: 0,
          creditPaise: 0
        };
      }
      accMap[code].debitPaise += d;
      accMap[code].creditPaise += c;

      glLedgerEntries.push({
        journalId: j.id,
        journalNumber: j.journalNumber,
        entryDate: j.entryDate,
        sourceModule: j.sourceModule,
        narration: j.narration,
        accountCode: code,
        accountName: accMap[code].accountName,
        accountType: accMap[code].accountType,
        debitInr: fromPaise(d),
        creditInr: fromPaise(c),
        isReversal: Boolean(j.reversesJournalId || j.reversedByJournalId)
      });

      if (['1010', '1020', '1030'].includes(code)) {
        const netCashDelta = d - c;
        if (j.sourceModule === 'PAYMENT' || j.sourceModule === 'ADVANCE') {
          cashReceiptsCustomersPaise += netCashDelta;
        } else if (j.sourceModule === 'SUPPLIER_PAYMENT') {
          cashPaidSuppliersPaise += netCashDelta;
        } else if (j.sourceModule === 'EXPENSE' || j.sourceModule === 'PETTY_CASH' || j.sourceModule === 'SAMPLING_RD') {
          cashPaidExpensesPaise += netCashDelta;
        } else if (j.sourceModule === 'MANUAL' && lines.some((x) => x.accountCode === '3000')) {
          cashCapitalInflowPaise += netCashDelta;
        } else {
          cashOtherNetPaise += netCashDelta;
        }
      }
    }
    if (jDr !== jCr) unbalancedJournalsCount++;
  }

  const trialBalance = Object.values(accMap)
    .map((a) => {
      const isCreditNormal = ['LIABILITY', 'EQUITY', 'REVENUE'].includes(a.accountType);
      const netPaise = isCreditNormal ? a.creditPaise - a.debitPaise : a.debitPaise - a.creditPaise;
      return {
        accountCode: a.accountCode,
        accountName: a.accountName,
        accountType: a.accountType,
        subGroup: a.subGroup,
        debitInr: fromPaise(a.debitPaise),
        creditInr: fromPaise(a.creditPaise),
        netBalanceInr: fromPaise(netPaise),
        netPaise
      };
    })
    .sort((x, y) => x.accountCode.localeCompare(y.accountCode));

  // 2. Profit & Loss Statement
  const revenueLines = trialBalance.filter((a) => a.accountType === 'REVENUE');
  const totalRevenuePaise = revenueLines.reduce((s, a) => s + a.netPaise, 0);
  const cogsLines = trialBalance.filter((a) => a.accountType === 'EXPENSE' && a.subGroup === 'COGS');
  const totalCogsPaise = cogsLines.reduce((s, a) => s + a.netPaise, 0);
  const opexLines = trialBalance.filter((a) => a.accountType === 'EXPENSE' && a.subGroup !== 'COGS');
  const totalOpexPaise = opexLines.reduce((s, a) => s + a.netPaise, 0);
  const grossProfitPaise = totalRevenuePaise - totalCogsPaise;
  const netProfitPaise = grossProfitPaise - totalOpexPaise;

  // 3. Balance Sheet
  const assetLines = trialBalance.filter((a) => a.accountType === 'ASSET');
  const liabilityLines = trialBalance.filter((a) => a.accountType === 'LIABILITY');
  const equityLines = trialBalance.filter((a) => a.accountType === 'EQUITY');

  const totalAssetsPaise = assetLines.reduce((s, a) => s + a.netPaise, 0);
  const totalLiabilitiesPaise = liabilityLines.reduce((s, a) => s + a.netPaise, 0);
  const totalEquityCapitalPaise = equityLines.reduce((s, a) => s + a.netPaise, 0);
  const totalLiabilitiesAndEquityPaise = totalLiabilitiesPaise + totalEquityCapitalPaise + netProfitPaise;
  const balanceSheetBalanced = totalAssetsPaise === totalLiabilitiesAndEquityPaise;

  // 4. Cash & Bank Books + Cash Flow Statement
  const cashBookAccounts = ['1010', '1020', '1030'].map((code) => {
    const acc = trialBalance.find((a) => a.accountCode === code);
    const entries = glLedgerEntries.filter((e) => e.accountCode === code);
    return {
      accountCode: code,
      accountName: acc?.accountName || code,
      debitTotalInr: acc?.debitInr || 0,
      creditTotalInr: acc?.creditInr || 0,
      closingBalanceInr: acc?.netBalanceInr || 0,
      entriesCount: entries.length
    };
  });
  const totalCashAndBankPaise = cashBookAccounts.reduce((s, a) => s + toPaise(a.closingBalanceInr), 0);
  const netOperatingCashPaise = cashReceiptsCustomersPaise + cashPaidSuppliersPaise + cashPaidExpensesPaise + cashOtherNetPaise;

  // 5. GST Registers (Output GSTR-1 & Input GSTR-2B)
  const taxInvoicesOnly = invoices.filter((i) => i.invoiceType !== 'PROFORMA' && i.status !== 'VOID');
  const outputTaxSummary = {
    taxableSalesInr: round2(taxInvoicesOnly.reduce((s, i) => s + Number(i.taxableAmountInr || 0), 0)),
    outputCgstInr: round2(taxInvoicesOnly.reduce((s, i) => s + Number(i.cgstAmountInr || 0), 0) - creditNotes.reduce((s, c) => s + Number(c.cgstInr || 0), 0) + salesDebitNotes.reduce((s, d) => s + Number(d.cgstInr || 0), 0)),
    outputSgstInr: round2(taxInvoicesOnly.reduce((s, i) => s + Number(i.sgstAmountInr || 0), 0) - creditNotes.reduce((s, c) => s + Number(c.sgstInr || 0), 0) + salesDebitNotes.reduce((s, d) => s + Number(d.sgstInr || 0), 0)),
    outputIgstInr: round2(taxInvoicesOnly.reduce((s, i) => s + Number(i.igstAmountInr || 0), 0) - creditNotes.reduce((s, c) => s + Number(c.igstInr || 0), 0) + salesDebitNotes.reduce((s, d) => s + Number(d.igstInr || 0), 0)),
    b2bCount: taxInvoicesOnly.filter((i) => Boolean(i.customerGstin)).length,
    b2cCount: taxInvoicesOnly.filter((i) => !i.customerGstin).length,
    proformaCount: invoices.filter((i) => i.invoiceType === 'PROFORMA').length
  };

  const postedVendorInvoices = vendorInvoices.filter((v) => v.status !== 'CANCELLED' && v.journalPosted);
  const postedExpensesWithGst = expenses.filter((e) => e.status === 'POSTED' && Number(e.gstRatePct || 0) > 0);
  const inputTaxSummary = {
    taxablePurchasesInr: round2(postedVendorInvoices.reduce((s, v) => s + Number(v.subtotalInr || 0), 0) + postedExpensesWithGst.reduce((s, e) => s + Number(e.taxableAmountInr || 0), 0)),
    inputCgstInr: round2(postedVendorInvoices.reduce((s, v) => s + Number(v.cgstInr || 0), 0) + postedExpensesWithGst.reduce((s, e) => s + Number(e.cgstInr || 0), 0) - vendorDebitNotes.reduce((s, d) => s + Number(d.cgstInr || 0), 0)),
    inputSgstInr: round2(postedVendorInvoices.reduce((s, v) => s + Number(v.sgstInr || 0), 0) + postedExpensesWithGst.reduce((s, e) => s + Number(e.sgstInr || 0), 0) - vendorDebitNotes.reduce((s, d) => s + Number(d.sgstInr || 0), 0)),
    inputIgstInr: round2(postedVendorInvoices.reduce((s, v) => s + Number(v.igstInr || 0), 0) + postedExpensesWithGst.reduce((s, e) => s + Number(e.igstInr || 0), 0) - vendorDebitNotes.reduce((s, d) => s + Number(d.igstInr || 0), 0))
  };

  const totalOutputGstInr = round2(outputTaxSummary.outputCgstInr + outputTaxSummary.outputSgstInr + outputTaxSummary.outputIgstInr);
  const totalInputGstInr = round2(inputTaxSummary.inputCgstInr + inputTaxSummary.inputSgstInr + inputTaxSummary.inputIgstInr);
  const netGstPayableInr = round2(totalOutputGstInr - totalInputGstInr);

  // HSN Summary Register for GSTR-1 Table 12
  const hsnSummaryMap: Record<string, { hsnCode: string; totalQty: number; taxableValueInr: number; cgstInr: number; sgstInr: number; igstInr: number; totalInr: number }> = {};
  for (const inv of taxInvoicesOnly) {
    for (const it of (inv.items as any[]) || []) {
      const code = String(it.hsnCode || '33030050');
      if (!hsnSummaryMap[code]) {
        hsnSummaryMap[code] = { hsnCode: code, totalQty: 0, taxableValueInr: 0, cgstInr: 0, sgstInr: 0, igstInr: 0, totalInr: 0 };
      }
      hsnSummaryMap[code].totalQty += Number(it.qty || 0);
      hsnSummaryMap[code].taxableValueInr = round2(hsnSummaryMap[code].taxableValueInr + Number(it.taxableValueInr || 0));
      hsnSummaryMap[code].cgstInr = round2(hsnSummaryMap[code].cgstInr + Number(it.cgstInr || 0));
      hsnSummaryMap[code].sgstInr = round2(hsnSummaryMap[code].sgstInr + Number(it.sgstInr || 0));
      hsnSummaryMap[code].igstInr = round2(hsnSummaryMap[code].igstInr + Number(it.igstInr || 0));
      hsnSummaryMap[code].totalInr = round2(hsnSummaryMap[code].totalInr + Number(it.totalInr || 0));
    }
  }

  // 6. Customer Ledgers & AR Aging + Supplier Ledgers
  const customerLedgerMap: Record<string, { customerName: string; customerEmail: string; invoicedInr: number; debitNotesInr: number; paidInr: number; creditNotesInr: number; advanceRemainingInr: number; balanceDueInr: number }> = {};
  for (const inv of taxInvoicesOnly) {
    const key = (inv.customerEmail || inv.customerName).toLowerCase();
    if (!customerLedgerMap[key]) {
      customerLedgerMap[key] = { customerName: inv.customerName, customerEmail: inv.customerEmail, invoicedInr: 0, debitNotesInr: 0, paidInr: 0, creditNotesInr: 0, advanceRemainingInr: 0, balanceDueInr: 0 };
    }
    customerLedgerMap[key].invoicedInr = round2(customerLedgerMap[key].invoicedInr + Number(inv.grandTotalInr || 0));
    customerLedgerMap[key].paidInr = round2(customerLedgerMap[key].paidInr + Number(inv.amountPaidInr || 0));
    customerLedgerMap[key].balanceDueInr = round2(customerLedgerMap[key].balanceDueInr + Number(inv.balanceDueInr || 0));
  }
  for (const cn of creditNotes) {
    const key = (cn.customerEmail || cn.customerName).toLowerCase();
    if (customerLedgerMap[key]) customerLedgerMap[key].creditNotesInr = round2(customerLedgerMap[key].creditNotesInr + Number(cn.totalCreditInr || 0));
  }
  for (const dn of salesDebitNotes) {
    const key = (dn.customerEmail || dn.customerName).toLowerCase();
    if (customerLedgerMap[key]) customerLedgerMap[key].debitNotesInr = round2(customerLedgerMap[key].debitNotesInr + Number(dn.totalDebitInr || 0));
  }
  for (const pay of payments.filter((p) => p.isAdvance && Number(p.advanceRemainingInr || 0) > 0)) {
    const key = (pay.customerEmail || pay.partyName).toLowerCase();
    if (!customerLedgerMap[key]) {
      customerLedgerMap[key] = { customerName: pay.partyName, customerEmail: pay.customerEmail || '', invoicedInr: 0, debitNotesInr: 0, paidInr: 0, creditNotesInr: 0, advanceRemainingInr: 0, balanceDueInr: 0 };
    }
    customerLedgerMap[key].advanceRemainingInr = round2(customerLedgerMap[key].advanceRemainingInr + Number(pay.advanceRemainingInr || 0));
  }

  const supplierLedgers = suppliers.map((s) => {
    const sInvs = vendorInvoices.filter((v) => v.supplierId === s.id);
    const sPays = payments.filter((p) => p.supplierId === s.id && p.direction === 'OUTBOUND_PAYOUT');
    const sDns = vendorDebitNotes.filter((d) => d.supplierId === s.id);
    const totalBilled = round2(sInvs.reduce((sum, v) => sum + Number(v.totalAmountInr || 0), 0));
    const totalPaid = round2(sPays.reduce((sum, p) => sum + Number(p.amountInr || 0), 0));
    const totalDebitNotes = round2(sDns.reduce((sum, d) => sum + Number(d.totalDebitInr || 0), 0));
    const outstanding = round2(sInvs.reduce((sum, v) => sum + Number(v.balanceDueInr || 0), 0));
    return {
      supplierId: s.id,
      supplierCode: s.code,
      supplierName: s.name,
      gstin: s.gstin,
      totalBilledInr: totalBilled,
      totalPaidInr: totalPaid,
      totalDebitNotesInr: totalDebitNotes,
      outstandingPayableInr: outstanding
    };
  });

  // 7. Inventory Valuation Schedule vs GL Accounts (1200, 1210, 1220)
  const rmLotsValuationInr = round2(
    stockLots.filter((l) => l.status === 'ACTIVE').reduce((s, l) => s + Number(l.availableQty || 0) * Number(l.unitCostInr || 0), 0)
  );
  const fgValuationInr = round2(
    finishedGoods.reduce((s, f) => s + Number(f.quantityOnHand || 0) * Number(f.unitManufacturingCostInr || 0), 0)
  );
  const wipValuationInr = round2(
    batches.filter((b) => b.pipelineStage !== 'RELEASED' && b.batchReleaseStatus !== 'RELEASED').reduce((s, b) => s + Number(b.materialCostInr || 0), 0)
  );
  const gl1200Inr = trialBalance.find((a) => a.accountCode === '1200')?.netBalanceInr || 0;
  const gl1210Inr = trialBalance.find((a) => a.accountCode === '1210')?.netBalanceInr || 0;
  const gl1220Inr = trialBalance.find((a) => a.accountCode === '1220')?.netBalanceInr || 0;
  const glCogs5000Inr = trialBalance.find((a) => a.accountCode === '5000')?.netBalanceInr || 0;

  // 8. Bank Reconciliation Metrics
  const glBank1010Inr = trialBalance.find((a) => a.accountCode === '1010')?.netBalanceInr || 0;
  const unreconciledBankLines = bankStatements.filter((b) => b.matchStatus === 'UNMATCHED');
  const latestStmtBalance = bankStatements[0]?.closingBalanceInr ?? glBank1010Inr;

  return {
    actor: {
      email: actor.email,
      roleCode: actor.roleCode,
      canApprove: actor.isSuperAdmin || Boolean(actor.permissions?.accounting?.canApprove),
      canEditGst: actor.isSuperAdmin || Boolean(actor.permissions?.gst_billing?.canApprove) || Boolean(actor.permissions?.settings?.canEdit)
    },
    organization: org,
    indianStates: INDIAN_GST_STATES,
    sequences,
    chartOfAccounts: coaRows,
    hsnSacMaster: hsnRules,
    invoices,
    creditNotes,
    salesDebitNotes,
    deliveryChallans,
    salesReturns,
    payments,
    journals,
    glLedgerEntries,
    expenses,
    bankStatements,
    vendorInvoices,
    vendorDebitNotes,
    purchaseOrders,
    signoffs,
    storeOrders,
    storeCustomers,
    customerLedgers: Object.values(customerLedgerMap),
    supplierLedgers,
    financialStatements: {
      trialBalance: {
        accounts: trialBalance,
        totalDebitsInr: fromPaise(totalDebitsPaise),
        totalCreditsInr: fromPaise(totalCreditsPaise),
        isBalanced: totalDebitsPaise === totalCreditsPaise && unbalancedJournalsCount === 0,
        unbalancedJournalsCount
      },
      profitAndLoss: {
        revenueLines,
        totalRevenueInr: fromPaise(totalRevenuePaise),
        cogsLines,
        totalCogsInr: fromPaise(totalCogsPaise),
        grossProfitInr: fromPaise(grossProfitPaise),
        opexLines,
        totalOpexInr: fromPaise(totalOpexPaise),
        netProfitInr: fromPaise(netProfitPaise)
      },
      balanceSheet: {
        assetLines,
        totalAssetsInr: fromPaise(totalAssetsPaise),
        liabilityLines,
        totalLiabilitiesInr: fromPaise(totalLiabilitiesPaise),
        equityLines,
        shareCapitalInr: fromPaise(totalEquityCapitalPaise),
        currentPeriodEarningsInr: fromPaise(netProfitPaise),
        totalLiabilitiesAndEquityInr: fromPaise(totalLiabilitiesAndEquityPaise),
        isBalanced: balanceSheetBalanced
      },
      cashFlow: {
        receiptsFromCustomersInr: fromPaise(cashReceiptsCustomersPaise),
        paymentsToSuppliersInr: fromPaise(cashPaidSuppliersPaise),
        operatingExpensesPaidInr: fromPaise(cashPaidExpensesPaise),
        otherOperatingCashInr: fromPaise(cashOtherNetPaise),
        netOperatingCashFlowInr: fromPaise(netOperatingCashPaise),
        financingCapitalInflowInr: fromPaise(cashCapitalInflowPaise),
        closingCashAndBankInr: fromPaise(totalCashAndBankPaise)
      },
      cashAndBankBooks: cashBookAccounts,
      inventoryValuation: {
        policy: org?.inventoryValuationPolicy || 'WEIGHTED_AVERAGE',
        rmLotsPhysicalValuationInr: rmLotsValuationInr,
        wipFloorValuationInr: wipValuationInr,
        fgBinsPhysicalValuationInr: fgValuationInr,
        gl1200BalanceInr: gl1200Inr,
        gl1210BalanceInr: gl1210Inr,
        gl1220BalanceInr: gl1220Inr,
        glCogs5000Inr
      },
      bankReconciliation: {
        glBankBookBalanceInr: glBank1010Inr,
        latestStatementBalanceInr: latestStmtBalance,
        matchedCount: bankStatements.filter((b) => b.matchStatus !== 'UNMATCHED').length,
        unmatchedCount: unreconciledBankLines.length,
        unreconciledPaymentsCount: payments.filter((p) => p.accountCode === '1010' && !p.reconciledWithBank).length
      }
    },
    gstRegisters: {
      outputTaxSummary,
      inputTaxSummary,
      totalOutputGstInr,
      totalInputGstInr,
      netGstPayableInr,
      hsnSummary: Object.values(hsnSummaryMap)
    }
  };
}

export async function runAccountingVerificationSuite(actor: ErpActorContext) {
  const snap = await getGstAccountingWorkspaceSnapshot(actor);
  const org = snap.organization;

  const tb = snap.financialStatements.trialBalance;
  const bs = snap.financialStatements.balanceSheet;

  // Check 1: Double-entry Trial Balance equality
  const c1 = {
    code: 'TB_EQUALITY',
    title: 'Double-Entry Trial Balance (Total Debits === Total Credits)',
    passed: tb.isBalanced && tb.unbalancedJournalsCount === 0,
    expectedValue: `Dr = Cr (₹${tb.totalDebitsInr.toLocaleString('en-IN')})`,
    actualValue: `Dr ₹${tb.totalDebitsInr.toLocaleString('en-IN')} / Cr ₹${tb.totalCreditsInr.toLocaleString('en-IN')} (${tb.unbalancedJournalsCount} unbalanced journals)`,
    varianceInr: round2(tb.totalDebitsInr - tb.totalCreditsInr)
  };

  // Check 2: Balance Sheet Accounting Equation
  const c2 = {
    code: 'BS_EQUATION',
    title: 'Balance Sheet Equation (Assets === Liabilities + Equity + Net Profit)',
    passed: bs.isBalanced,
    expectedValue: `₹${bs.totalAssetsInr.toLocaleString('en-IN')}`,
    actualValue: `₹${bs.totalLiabilitiesAndEquityInr.toLocaleString('en-IN')}`,
    varianceInr: round2(bs.totalAssetsInr - bs.totalLiabilitiesAndEquityInr)
  };

  // Check 3: Invoice GST Tax Math & Split Integrity
  let taxMismatchCount = 0;
  for (const inv of snap.invoices.filter((i) => i.invoiceType !== 'PROFORMA' && i.status !== 'VOID')) {
    const sumTaxPaise = toPaise(inv.cgstAmountInr) + toPaise(inv.sgstAmountInr) + toPaise(inv.igstAmountInr);
    const calcGrandPaise = toPaise(inv.taxableAmountInr) + sumTaxPaise + toPaise(inv.shippingInr);
    if (Math.abs(sumTaxPaise - toPaise(inv.totalTaxInr)) > 2 || Math.abs(calcGrandPaise - toPaise(inv.grandTotalInr)) > 2) {
      taxMismatchCount++;
    }
    if (inv.isInterState && (Number(inv.cgstAmountInr) > 0 || Number(inv.sgstAmountInr) > 0)) taxMismatchCount++;
    if (!inv.isInterState && Number(inv.igstAmountInr) > 0) taxMismatchCount++;
  }
  const c3 = {
    code: 'GST_TAX_MATH_INTEGRITY',
    title: 'GST Intra/Inter-State Tax Split & Decimal Paise Integrity',
    passed: taxMismatchCount === 0,
    expectedValue: '0 Tax Split or Rounding Variances',
    actualValue: `${taxMismatchCount} invoice tax variances detected`,
    varianceInr: taxMismatchCount
  };

  // Check 4: Company GSTIN & HSN/SAC Admin/Accountant Governance
  const unverifiedHsn = snap.hsnSacMaster.filter((h) => h.approvalStatus !== 'ACCOUNTANT_VERIFIED');
  const validGstin = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(org?.gstin || '');
  const c4 = {
    code: 'GST_CONFIG_GOVERNANCE',
    title: 'Registered GSTIN & HSN/SAC Master Accountant Verification',
    passed: validGstin && unverifiedHsn.length === 0,
    expectedValue: 'Valid GSTIN & 0 unverified HSN/SAC codes',
    actualValue: `GSTIN=${org?.gstin} (${validGstin ? 'Valid' : 'Invalid'}) · ${unverifiedHsn.length} unverified HSN/SAC rules`,
    varianceInr: unverifiedHsn.length
  };

  // Check 5: AR Sub-Ledger vs GL Account 1100
  const arSubledgerInr = round2(snap.invoices.filter((i) => i.invoiceType !== 'PROFORMA' && i.status !== 'VOID').reduce((s, i) => s + Number(i.balanceDueInr || 0), 0));
  const glAr1100Inr = tb.accounts.find((a) => a.accountCode === '1100')?.netBalanceInr || 0;
  const arDiff = round2(arSubledgerInr - glAr1100Inr);
  const c5 = {
    code: 'AR_SUBLEDGER_RECON',
    title: 'Accounts Receivable Sub-Ledger vs GL (1100)',
    passed: Math.abs(arDiff) < 1,
    expectedValue: `₹${glAr1100Inr.toLocaleString('en-IN')}`,
    actualValue: `₹${arSubledgerInr.toLocaleString('en-IN')}`,
    varianceInr: arDiff
  };

  // Check 6: AP Sub-Ledger vs GL Account 2100
  const apSubledgerInr = round2(snap.vendorInvoices.filter((v) => v.status !== 'CANCELLED' && v.journalPosted).reduce((s, v) => s + Number(v.balanceDueInr || 0), 0));
  const glAp2100Inr = tb.accounts.find((a) => a.accountCode === '2100')?.netBalanceInr || 0;
  const apDiff = round2(apSubledgerInr - glAp2100Inr);
  const c6 = {
    code: 'AP_SUBLEDGER_RECON',
    title: 'Accounts Payable Sub-Ledger vs GL (2100)',
    passed: Math.abs(apDiff) < 1,
    expectedValue: `₹${glAp2100Inr.toLocaleString('en-IN')}`,
    actualValue: `₹${apSubledgerInr.toLocaleString('en-IN')}`,
    varianceInr: apDiff
  };

  // Check 7: Bank Statement Unmatched Exception Check
  const unmatchedBank = snap.financialStatements.bankReconciliation.unmatchedCount;
  const c7 = {
    code: 'BANK_RECON_EXCEPTIONS',
    title: 'Bank Reconciliation Open Statement Exceptions',
    passed: unmatchedBank === 0,
    expectedValue: '0 Unmatched Bank Statement Lines',
    actualValue: `${unmatchedBank} unmatched statement lines`,
    varianceInr: unmatchedBank
  };

  const checks = [c1, c2, c3, c4, c5, c6, c7];
  const passedCount = checks.filter((c) => c.passed).length;
  const allPassed = passedCount === checks.length;

  const runNumber = await db.transaction((tx) => getConfiguredNextSeq(tx, 'AUD', 'ACC-VER-2026-'));
  const [signoff] = await db
    .insert(erpAccountantSignoffs)
    .values({
      id: makeId('asgn'),
      organizationId: ORG_ID,
      runNumber,
      runDate: currentIsoDate(),
      executedByEmail: actor.email,
      checksPassedCount: passedCount,
      checksTotalCount: checks.length,
      allAutomatedPassed: allPassed,
      checkResults: checks,
      decision: 'PENDING_REVIEW',
      notes: allPassed
        ? 'All automated reconciliation, double-entry & GST checks passed. Ready for Accountant acceptance sign-off.'
        : 'Automated verification detected exceptions that require review or correction before production sign-off.'
    })
    .returning();

  return signoff;
}

export async function decideAccountingReadiness(
  actor: ErpActorContext,
  signoffId: string,
  payload: { decision: 'ACCEPTED_PRODUCTION_READY' | 'REJECTED_NEEDS_CORRECTION'; notes?: string }
) {
  const rows = await db.select().from(erpAccountantSignoffs).where(eq(erpAccountantSignoffs.id, signoffId));
  if (!rows.length) throw new NotFoundError('Verification test run not found.');
  const run = rows[0];

  if (payload.decision === 'ACCEPTED_PRODUCTION_READY' && !run.allAutomatedPassed) {
    throw new ValidationError(
      'Cannot mark accounting system production-ready: one or more automated reconciliation or GST verification checks failed.'
    );
  }

  return await db.transaction(async (tx) => {
    const [updatedRun] = await tx
      .update(erpAccountantSignoffs)
      .set({
        decision: payload.decision,
        accountantEmail: actor.email,
        notes: payload.notes?.trim() || run.notes,
        decidedAt: new Date()
      })
      .where(eq(erpAccountantSignoffs.id, signoffId))
      .returning();

    const readyStatus =
      payload.decision === 'ACCEPTED_PRODUCTION_READY' ? 'ACCOUNTANT_ACCEPTED_READY' : 'VERIFICATION_PENDING';

    await tx
      .update(erpOrganizations)
      .set({
        accountingReadyStatus: readyStatus,
        accountantSignoffEmail: payload.decision === 'ACCEPTED_PRODUCTION_READY' ? actor.email : null,
        accountantSignoffAt: payload.decision === 'ACCEPTED_PRODUCTION_READY' ? new Date() : null,
        version: sql`${erpOrganizations.version} + 1`,
        updatedAt: new Date()
      })
      .where(eq(erpOrganizations.id, ORG_ID));

    await recordErpAuditLog(tx, {
      action: `ERP_ACCOUNTANT_${payload.decision}`,
      entity: 'erp_accountant_signoffs',
      entityId: signoffId,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Accountant Acceptance ${run.runNumber}: ${payload.decision} (${run.checksPassedCount}/${run.checksTotalCount} checks)`
    });

    await createErpNotification(tx, {
      departmentCode: 'FIN',
      severity: payload.decision === 'ACCEPTED_PRODUCTION_READY' ? 'INFO' : 'WARNING',
      category: 'ACCOUNTING_READINESS',
      title: `Accounting Verification ${payload.decision}`,
      message: `${run.runNumber} reviewed by ${actor.email} (${run.checksPassedCount}/${run.checksTotalCount} passed).`,
      linkModule: 'accounting',
      linkEntityId: signoffId
    });

    return updatedRun;
  });
}
