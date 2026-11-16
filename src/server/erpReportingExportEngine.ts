import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { db } from '../db/index.ts';
import {
  erpExportJobs,
  erpOrganizations,
  supplierPurchaseOrders,
  procurementSuppliers,
  erpMaterials,
  erpStockMovements,
  erpStockLots,
  erpFormulations,
  erpFormulationVersions,
  productionBatches,
  erpSamples,
  erpQcRecords,
  erpFinishedGoods,
  orders,
  products,
  customers,
  erpProposals,
  erpQuotations,
  erpInvoices,
  erpVendorInvoices,
  erpExpensesAndPettyCash,
  campaigns,
  influencers,
  erpEmployees,
  erpInterns,
  erpInternAttendance,
  erpInternEvaluations,
  erpTasks,
  erpDepartments
} from '../db/schema.ts';
import { eq, desc } from 'drizzle-orm';
import {
  ORG_ID,
  ensureErpSeeded,
  assertErpPermission,
  getNextSequence,
  recordErpAuditLog,
  ValidationError,
  NotFoundError,
  ForbiddenError,
  type ErpActorContext,
  type ErpModuleKey
} from './erpBusinessOsEngine.ts';
import { getGstAccountingWorkspaceSnapshot } from './erpGstAccountingEngine.ts';
import { ensureAgencyHrSeeded } from './erpAgencyHrWorkspaceEngine.ts';
import { broadcastCrossBrowserSyncEvent } from './productionAuditAndReliabilityEngine.ts';

const EXPORT_DIR = '/tmp/fragmore-exports';
const SERVER_EXPORT_HMAC_SECRET =
  process.env.EXPORT_SIGNING_SECRET || crypto.createHash('sha256').update(`fragmore-erp-export-${ORG_ID}`).digest('hex');

function ensureExportDir() {
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true, mode: 0o700 });
  }
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
}

function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function deriveSignedDownloadToken(jobId: string, expiresAtIso: string): string {
  return crypto
    .createHmac('sha256', SERVER_EXPORT_HMAC_SECRET)
    .update(`${jobId}:${expiresAtIso}`)
    .digest('hex');
}

/**
 * Protects against CSV / Excel spreadsheet formula injection (CWE-1236).
 * Any user-supplied string starting with =, +, -, @, tab, or CR is prefixed with a literal single quote.
 */
export function sanitizeSpreadsheetString(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
  if (!str) return '';
  const firstChar = str[0];
  const trimmedFirst = str.trimStart()[0];
  const dangerous = ['=', '+', '-', '@', '\t', '\r'];
  if (dangerous.includes(firstChar) || (trimmedFirst && dangerous.includes(trimmedFirst))) {
    return `'${str}`;
  }
  return str;
}

/**
 * Normalizes text for standard PDF Type1 fonts (WinAnsiEncoding) so symbols like ₹ or arrows never render garbled.
 */
function toPdfSafeText(input: unknown): string {
  if (input === null || input === undefined) return '-';
  const raw = typeof input === 'object' ? JSON.stringify(input) : String(input);
  return raw
    .replace(/₹/g, 'INR ')
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/•/g, '*')
    .replace(/—/g, '-')
    .replace(/–/g, '-')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
}

export type ExportColumnType = 'string' | 'currency' | 'number' | 'percent' | 'date';

export interface ReportColumnDef {
  key: string;
  label: string;
  type: ExportColumnType;
  width?: number;
  summable?: boolean;
}

export type SensitivityTier = 'STANDARD' | 'SENSITIVE_FINANCIAL' | 'CONFIDENTIAL_FORMULATION' | 'CUSTOMER_PII';

export interface ReportCategoryMeta {
  reportKey: string;
  title: string;
  categoryGroup:
    | 'PROCUREMENT_INVENTORY'
    | 'MANUFACTURING_RD_QC'
    | 'SALES_CRM_COMMERCIAL'
    | 'GST_ACCOUNTING_FINANCE'
    | 'MARKETING_HR_OPERATIONS';
  moduleKey: ErpModuleKey;
  sensitivity: SensitivityTier;
  description: string;
  requiresAuthorizedSignature: boolean;
  taxRelevant: boolean;
  columns: ReportColumnDef[];
}

export const REPORT_CATALOG: ReportCategoryMeta[] = [
  {
    reportKey: 'procurement_pos',
    title: 'Procurement Purchase Orders Register',
    categoryGroup: 'PROCUREMENT_INVENTORY',
    moduleKey: 'procurement',
    sensitivity: 'STANDARD',
    description: 'Approved and open supplier purchase orders, GST amounts, delivery schedules, and settlement status.',
    requiresAuthorizedSignature: true,
    taxRelevant: true,
    columns: [
      { key: 'poNumber', label: 'PO Number', type: 'string', width: 18 },
      { key: 'orderDate', label: 'Order Date', type: 'date', width: 14 },
      { key: 'supplierName', label: 'Supplier', type: 'string', width: 26 },
      { key: 'status', label: 'PO Status', type: 'string', width: 16 },
      { key: 'paymentStatus', label: 'Payment Status', type: 'string', width: 16 },
      { key: 'subtotalInr', label: 'Taxable Subtotal (INR)', type: 'currency', width: 20, summable: true },
      { key: 'gstTotalInr', label: 'GST Amount (INR)', type: 'currency', width: 18, summable: true },
      { key: 'totalAmountInr', label: 'Grand Total (INR)', type: 'currency', width: 20, summable: true },
      { key: 'expectedDeliveryDate', label: 'Expected Delivery', type: 'date', width: 16 }
    ]
  },
  {
    reportKey: 'supplier_performance',
    title: 'Supplier Performance, Lead-Time & Spend Scorecard',
    categoryGroup: 'PROCUREMENT_INVENTORY',
    moduleKey: 'procurement',
    sensitivity: 'STANDARD',
    description: 'Vendor reliability ratings, lead times, GST compliance, MOQ, and cumulative procurement value.',
    requiresAuthorizedSignature: false,
    taxRelevant: true,
    columns: [
      { key: 'supplierCode', label: 'Vendor Code', type: 'string', width: 16 },
      { key: 'legalName', label: 'Legal Entity Name', type: 'string', width: 28 },
      { key: 'gstin', label: 'GSTIN', type: 'string', width: 20 },
      { key: 'leadTimeDays', label: 'Lead Time (Days)', type: 'number', width: 16 },
      { key: 'onTimeDeliveryPct', label: 'On-Time %', type: 'number', width: 14 },
      { key: 'qualityRating', label: 'Quality Score / 5', type: 'number', width: 16 },
      { key: 'poCount', label: 'Total POs', type: 'number', width: 12, summable: true },
      { key: 'totalSpendInr', label: 'Cumulative Spend (INR)', type: 'currency', width: 22, summable: true },
      { key: 'status', label: 'Status', type: 'string', width: 14 }
    ]
  },
  {
    reportKey: 'raw_materials',
    title: 'Raw Material, Fragrance Oil & Packaging Inventory',
    categoryGroup: 'PROCUREMENT_INVENTORY',
    moduleKey: 'materials',
    sensitivity: 'STANDARD',
    description: 'Master inventory of aroma oils, solvents, flacons, pumps, and boxes with reorder points and density validation.',
    requiresAuthorizedSignature: false,
    taxRelevant: false,
    columns: [
      { key: 'sku', label: 'Material SKU', type: 'string', width: 18 },
      { key: 'name', label: 'Material Name', type: 'string', width: 28 },
      { key: 'category', label: 'Category', type: 'string', width: 18 },
      { key: 'uom', label: 'Base UOM', type: 'string', width: 10 },
      { key: 'densityGPerMl', label: 'Density (g/mL)', type: 'number', width: 14 },
      { key: 'availableQty', label: 'Available Qty', type: 'number', width: 16, summable: true },
      { key: 'reorderPoint', label: 'Reorder Point', type: 'number', width: 14 },
      { key: 'standardCostInr', label: 'Unit Cost (INR)', type: 'currency', width: 18 },
      { key: 'stockValueInr', label: 'Valuation (INR)', type: 'currency', width: 20, summable: true }
    ]
  },
  {
    reportKey: 'stock_movements',
    title: 'Immutable Stock Movement Ledger',
    categoryGroup: 'PROCUREMENT_INVENTORY',
    moduleKey: 'materials',
    sensitivity: 'STANDARD',
    description: 'Chronological ledger of receipts, batch issues, sample draws, QC holds, and adjustments.',
    requiresAuthorizedSignature: false,
    taxRelevant: false,
    columns: [
      { key: 'movementDate', label: 'Date', type: 'date', width: 14 },
      { key: 'movementNumber', label: 'Movement #', type: 'string', width: 18 },
      { key: 'materialSku', label: 'Material SKU', type: 'string', width: 18 },
      { key: 'movementType', label: 'Movement Type', type: 'string', width: 20 },
      { key: 'direction', label: 'Direction', type: 'string', width: 12 },
      { key: 'qty', label: 'Quantity', type: 'number', width: 14, summable: true },
      { key: 'uom', label: 'UOM', type: 'string', width: 10 },
      { key: 'totalCostInr', label: 'Value Impact (INR)', type: 'currency', width: 18, summable: true },
      { key: 'referenceCode', label: 'Reference', type: 'string', width: 20 }
    ]
  },
  {
    reportKey: 'stock_valuation',
    title: 'FIFO Stock Lot Valuation & Expiry Register',
    categoryGroup: 'PROCUREMENT_INVENTORY',
    moduleKey: 'warehouse',
    sensitivity: 'STANDARD',
    description: 'Lot-level FIFO inventory valuation with supplier lot codes, QC release status, and expiry/retest dates.',
    requiresAuthorizedSignature: true,
    taxRelevant: false,
    columns: [
      { key: 'lotNumber', label: 'Internal Lot #', type: 'string', width: 20 },
      { key: 'materialName', label: 'Material', type: 'string', width: 26 },
      { key: 'receivedDate', label: 'Receipt Date', type: 'date', width: 14 },
      { key: 'expiryDate', label: 'Expiry / Retest', type: 'date', width: 14 },
      { key: 'qcStatus', label: 'QC Status', type: 'string', width: 14 },
      { key: 'qtyAvailable', label: 'Available Qty', type: 'number', width: 15, summable: true },
      { key: 'uom', label: 'UOM', type: 'string', width: 10 },
      { key: 'unitCostInr', label: 'Unit Cost (INR)', type: 'currency', width: 16 },
      { key: 'lotValuationInr', label: 'Lot Value (INR)', type: 'currency', width: 20, summable: true }
    ]
  },
  {
    reportKey: 'formulation_costs',
    title: 'Perfume Formulation BOM & Bottle Costing Sheet',
    categoryGroup: 'MANUFACTURING_RD_QC',
    moduleKey: 'formulations',
    sensitivity: 'CONFIDENTIAL_FORMULATION',
    description: 'Confidential fragrance concentrate ratios, IFRA approval state, ingredient costs, and per-bottle landed BOM.',
    requiresAuthorizedSignature: true,
    taxRelevant: false,
    columns: [
      { key: 'formulaCode', label: 'Formula Code', type: 'string', width: 18 },
      { key: 'fragranceName', label: 'Fragrance Name', type: 'string', width: 26 },
      { key: 'versionLabel', label: 'Active Version', type: 'string', width: 14 },
      { key: 'concentrationPct', label: 'Concentrate %', type: 'number', width: 14 },
      { key: 'solventPct', label: 'Solvent %', type: 'number', width: 14 },
      { key: 'targetBatchMl', label: 'Target Batch (mL)', type: 'number', width: 16 },
      { key: 'juiceCostPerBottleInr', label: 'Juice Cost / Bottle', type: 'currency', width: 18 },
      { key: 'packagingCostInr', label: 'Packaging BOM', type: 'currency', width: 16 },
      { key: 'estimatedCostPerBottleInr', label: 'Total Bottle Cost (INR)', type: 'currency', width: 22, summable: true },
      { key: 'approvalStatus', label: 'Compliance Status', type: 'string', width: 18 }
    ]
  },
  {
    reportKey: 'production_batches',
    title: 'Perfume Manufacturing Batch Register',
    categoryGroup: 'MANUFACTURING_RD_QC',
    moduleKey: 'batches',
    sensitivity: 'STANDARD',
    description: '11-stage perfume compounding, maceration, chilling, filtration, filling, and release ledger.',
    requiresAuthorizedSignature: true,
    taxRelevant: false,
    columns: [
      { key: 'batchCode', label: 'Batch Code', type: 'string', width: 18 },
      { key: 'productName', label: 'Fragrance / SKU', type: 'string', width: 26 },
      { key: 'currentStage', label: 'Workflow Stage', type: 'string', width: 18 },
      { key: 'plannedUnits', label: 'Planned Bottles', type: 'number', width: 16, summable: true },
      { key: 'actualUnitsProduced', label: 'Actual Yield', type: 'number', width: 16, summable: true },
      { key: 'macerationDays', label: 'Maceration (Days)', type: 'number', width: 16 },
      { key: 'totalBatchCostInr', label: 'Batch Cost (INR)', type: 'currency', width: 20, summable: true },
      { key: 'status', label: 'Batch Status', type: 'string', width: 16 }
    ]
  },
  {
    reportKey: 'production_variance',
    title: 'Production Yield, Wastage & Variance Analysis',
    categoryGroup: 'MANUFACTURING_RD_QC',
    moduleKey: 'batches',
    sensitivity: 'STANDARD',
    description: 'Comparison of theoretical vs actual yield, filtration/filling wastage, and unit cost variance.',
    requiresAuthorizedSignature: false,
    taxRelevant: false,
    columns: [
      { key: 'batchCode', label: 'Batch Code', type: 'string', width: 18 },
      { key: 'productName', label: 'Fragrance', type: 'string', width: 24 },
      { key: 'plannedUnits', label: 'Target Units', type: 'number', width: 14, summable: true },
      { key: 'actualUnitsProduced', label: 'Produced Units', type: 'number', width: 14, summable: true },
      { key: 'rejectedOrScrapUnits', label: 'Scrap / Loss Units', type: 'number', width: 16, summable: true },
      { key: 'yieldPct', label: 'Yield %', type: 'number', width: 12 },
      { key: 'unitCostInr', label: 'Actual Cost / Unit (INR)', type: 'currency', width: 20 },
      { key: 'varianceNotes', label: 'Variance Observation', type: 'string', width: 26 }
    ]
  },
  {
    reportKey: 'sampling_register',
    title: 'R&D, Commercial & Creator Sampling Register',
    categoryGroup: 'MANUFACTURING_RD_QC',
    moduleKey: 'quality',
    sensitivity: 'STANDARD',
    description: 'End-to-end sample preparation, dispatch tracking, recipient feedback, and sample landed cost.',
    requiresAuthorizedSignature: false,
    taxRelevant: false,
    columns: [
      { key: 'sampleNumber', label: 'Sample ID', type: 'string', width: 18 },
      { key: 'preparedDate', label: 'Date', type: 'date', width: 14 },
      { key: 'fragranceName', label: 'Fragrance', type: 'string', width: 24 },
      { key: 'purpose', label: 'Purpose', type: 'string', width: 20 },
      { key: 'recipientName', label: 'Recipient', type: 'string', width: 22 },
      { key: 'quantityMl', label: 'Volume (mL)', type: 'number', width: 14, summable: true },
      { key: 'totalSampleCostInr', label: 'Landed Cost (INR)', type: 'currency', width: 18, summable: true },
      { key: 'status', label: 'Workflow Stage', type: 'string', width: 18 }
    ]
  },
  {
    reportKey: 'qc_inspections',
    title: 'Quality Control & Laboratory Inspection Ledger',
    categoryGroup: 'MANUFACTURING_RD_QC',
    moduleKey: 'quality',
    sensitivity: 'STANDARD',
    description: 'Organoleptic, refractive index, specific gravity, fill volume, and CAPA inspection outcomes.',
    requiresAuthorizedSignature: true,
    taxRelevant: false,
    columns: [
      { key: 'inspectionNumber', label: 'QC Record #', type: 'string', width: 18 },
      { key: 'inspectedAt', label: 'Inspection Date', type: 'date', width: 14 },
      { key: 'targetType', label: 'Target Type', type: 'string', width: 16 },
      { key: 'targetCode', label: 'Batch / Sample / GRN', type: 'string', width: 20 },
      { key: 'odorProfilePass', label: 'Odour Check', type: 'string', width: 14 },
      { key: 'colorAppearancePass', label: 'Appearance', type: 'string', width: 14 },
      { key: 'overallResult', label: 'QC Verdict', type: 'string', width: 14 },
      { key: 'inspectorEmail', label: 'Inspector', type: 'string', width: 24 }
    ]
  },
  {
    reportKey: 'finished_goods',
    title: 'Finished Goods Warehouse & Bin Stock Summary',
    categoryGroup: 'PROCUREMENT_INVENTORY',
    moduleKey: 'warehouse',
    sensitivity: 'STANDARD',
    description: 'Ready-for-sale bottled perfume stock across bins, reserved quantities, and finished inventory value.',
    requiresAuthorizedSignature: false,
    taxRelevant: false,
    columns: [
      { key: 'sku', label: 'SKU Code', type: 'string', width: 18 },
      { key: 'productName', label: 'Product Name', type: 'string', width: 28 },
      { key: 'binLocation', label: 'Warehouse Bin', type: 'string', width: 16 },
      { key: 'availableUnits', label: 'Available Units', type: 'number', width: 16, summable: true },
      { key: 'reservedUnits', label: 'Reserved Units', type: 'number', width: 16, summable: true },
      { key: 'unitCostInr', label: 'Unit COGS (INR)', type: 'currency', width: 18 },
      { key: 'mrpInr', label: 'MRP (INR)', type: 'currency', width: 16 },
      { key: 'totalValuationInr', label: 'FG Valuation (INR)', type: 'currency', width: 20, summable: true }
    ]
  },
  {
    reportKey: 'sales_orders',
    title: 'Storefront & B2B Commercial Sales Orders Register',
    categoryGroup: 'SALES_CRM_COMMERCIAL',
    moduleKey: 'sales',
    sensitivity: 'CUSTOMER_PII',
    description: 'All D2C storefront and B2B converted orders with payment method, fulfillment status, and order totals.',
    requiresAuthorizedSignature: false,
    taxRelevant: true,
    columns: [
      { key: 'orderId', label: 'Order ID', type: 'string', width: 18 },
      { key: 'createdAt', label: 'Order Date', type: 'date', width: 14 },
      { key: 'customerName', label: 'Customer', type: 'string', width: 24 },
      { key: 'customerEmail', label: 'Email', type: 'string', width: 24 },
      { key: 'paymentMethod', label: 'Payment Mode', type: 'string', width: 16 },
      { key: 'paymentStatus', label: 'Payment Status', type: 'string', width: 16 },
      { key: 'status', label: 'Fulfillment', type: 'string', width: 16 },
      { key: 'totalAmountInr', label: 'Order Total (INR)', type: 'currency', width: 20, summable: true }
    ]
  },
  {
    reportKey: 'store_products',
    title: 'Storefront Fragrance Catalogue & Inventory Register',
    categoryGroup: 'SALES_CRM_COMMERCIAL',
    moduleKey: 'sales',
    sensitivity: 'STANDARD',
    description: 'Live fragmore.shop perfume SKUs, collections, concentrations, pricing, and storefront stock.',
    requiresAuthorizedSignature: false,
    taxRelevant: false,
    columns: [
      { key: 'sku', label: 'SKU', type: 'string', width: 18 },
      { key: 'name', label: 'Fragrance Title', type: 'string', width: 28 },
      { key: 'collection', label: 'Collection', type: 'string', width: 20 },
      { key: 'size', label: 'Size', type: 'string', width: 12 },
      { key: 'mrpInr', label: 'MRP (INR)', type: 'currency', width: 16 },
      { key: 'priceInr', label: 'Selling Price (INR)', type: 'currency', width: 18 },
      { key: 'stock', label: 'Storefront Stock', type: 'number', width: 16, summable: true }
    ]
  },
  {
    reportKey: 'store_customers',
    title: 'Customer Directory & Lifetime Value Register',
    categoryGroup: 'SALES_CRM_COMMERCIAL',
    moduleKey: 'crm',
    sensitivity: 'CUSTOMER_PII',
    description: 'Registered storefront and B2B clientele with order frequency and lifetime spend.',
    requiresAuthorizedSignature: false,
    taxRelevant: false,
    columns: [
      { key: 'name', label: 'Customer Name', type: 'string', width: 26 },
      { key: 'email', label: 'Email', type: 'string', width: 28 },
      { key: 'phone', label: 'Phone', type: 'string', width: 18 },
      { key: 'city', label: 'City', type: 'string', width: 18 },
      { key: 'ordersCount', label: 'Orders', type: 'number', width: 12, summable: true },
      { key: 'totalSpentInr', label: 'Lifetime Spend (INR)', type: 'currency', width: 20, summable: true }
    ]
  },
  {
    reportKey: 'corporate_proposals',
    title: 'Corporate Gifting, Wedding & Perfume Bar Proposals',
    categoryGroup: 'SALES_CRM_COMMERCIAL',
    moduleKey: 'proposals',
    sensitivity: 'STANDARD',
    description: 'Branded corporate gifting, hospitality, and event activation proposals with version and approval status.',
    requiresAuthorizedSignature: true,
    taxRelevant: false,
    columns: [
      { key: 'proposalNumber', label: 'Proposal #', type: 'string', width: 18 },
      { key: 'createdAt', label: 'Date', type: 'date', width: 14 },
      { key: 'clientCompany', label: 'Client / Organization', type: 'string', width: 26 },
      { key: 'proposalType', label: 'Category', type: 'string', width: 22 },
      { key: 'versionNumber', label: 'Version', type: 'number', width: 10 },
      { key: 'estimatedValueInr', label: 'Proposal Value (INR)', type: 'currency', width: 20, summable: true },
      { key: 'status', label: 'Status', type: 'string', width: 16 }
    ]
  },
  {
    reportKey: 'quotations_register',
    title: 'Commercial Quotations & Gross Margin Register',
    categoryGroup: 'SALES_CRM_COMMERCIAL',
    moduleKey: 'proposals',
    sensitivity: 'STANDARD',
    description: 'Formal GST commercial quotations with taxable value, GST split, validity dates, and acceptance status.',
    requiresAuthorizedSignature: true,
    taxRelevant: true,
    columns: [
      { key: 'quotationNumber', label: 'Quotation #', type: 'string', width: 18 },
      { key: 'issueDate', label: 'Issue Date', type: 'date', width: 14 },
      { key: 'clientName', label: 'Client Name', type: 'string', width: 26 },
      { key: 'validUntil', label: 'Valid Until', type: 'date', width: 14 },
      { key: 'subtotalInr', label: 'Taxable Value (INR)', type: 'currency', width: 20, summable: true },
      { key: 'gstTotalInr', label: 'GST (INR)', type: 'currency', width: 16, summable: true },
      { key: 'grandTotalInr', label: 'Grand Total (INR)', type: 'currency', width: 20, summable: true },
      { key: 'status', label: 'Status', type: 'string', width: 16 }
    ]
  },
  {
    reportKey: 'gst_invoices',
    title: 'GST Tax Invoices & Statutory GSTR-1 Register',
    categoryGroup: 'GST_ACCOUNTING_FINANCE',
    moduleKey: 'gst_billing',
    sensitivity: 'SENSITIVE_FINANCIAL',
    description: 'Statutory B2B/B2C tax invoices and proformas with GSTIN, Place of Supply, CGST/SGST/IGST, and balances.',
    requiresAuthorizedSignature: true,
    taxRelevant: true,
    columns: [
      { key: 'invoiceNumber', label: 'Invoice #', type: 'string', width: 20 },
      { key: 'invoiceDate', label: 'Invoice Date', type: 'date', width: 14 },
      { key: 'documentType', label: 'Doc Type', type: 'string', width: 16 },
      { key: 'customerName', label: 'Customer / Party', type: 'string', width: 24 },
      { key: 'customerGstin', label: 'Buyer GSTIN', type: 'string', width: 18 },
      { key: 'placeOfSupplyState', label: 'Place of Supply', type: 'string', width: 18 },
      { key: 'taxableAmountInr', label: 'Taxable (INR)', type: 'currency', width: 18, summable: true },
      { key: 'cgstAmountInr', label: 'CGST (INR)', type: 'currency', width: 14, summable: true },
      { key: 'sgstAmountInr', label: 'SGST (INR)', type: 'currency', width: 14, summable: true },
      { key: 'igstAmountInr', label: 'IGST (INR)', type: 'currency', width: 14, summable: true },
      { key: 'grandTotalInr', label: 'Invoice Total (INR)', type: 'currency', width: 20, summable: true },
      { key: 'balanceDueInr', label: 'Balance Due (INR)', type: 'currency', width: 18, summable: true }
    ]
  },
  {
    reportKey: 'outstanding_payments',
    title: 'Accounts Receivable (AR) & Supplier Payables (AP) Aging',
    categoryGroup: 'GST_ACCOUNTING_FINANCE',
    moduleKey: 'accounting',
    sensitivity: 'SENSITIVE_FINANCIAL',
    description: 'Unsettled customer tax invoices and unpaid approved vendor bills requiring collection or payout.',
    requiresAuthorizedSignature: true,
    taxRelevant: true,
    columns: [
      { key: 'ledgerType', label: 'Ledger Side', type: 'string', width: 16 },
      { key: 'documentNumber', label: 'Invoice / Bill #', type: 'string', width: 20 },
      { key: 'documentDate', label: 'Date', type: 'date', width: 14 },
      { key: 'dueDate', label: 'Due Date', type: 'date', width: 14 },
      { key: 'partyName', label: 'Counterparty Name', type: 'string', width: 26 },
      { key: 'totalAmountInr', label: 'Billed Total (INR)', type: 'currency', width: 18, summable: true },
      { key: 'paidAmountInr', label: 'Settled (INR)', type: 'currency', width: 18, summable: true },
      { key: 'outstandingInr', label: 'Outstanding (INR)', type: 'currency', width: 20, summable: true }
    ]
  },
  {
    reportKey: 'expenses_petty_cash',
    title: 'Operating Expenses & Petty Cash Voucher Register',
    categoryGroup: 'GST_ACCOUNTING_FINANCE',
    moduleKey: 'accounting',
    sensitivity: 'SENSITIVE_FINANCIAL',
    description: 'Posted operating expenses, lab consumables, packaging freight, and petty cash vouchers with ITC.',
    requiresAuthorizedSignature: true,
    taxRelevant: true,
    columns: [
      { key: 'voucherNumber', label: 'Voucher #', type: 'string', width: 18 },
      { key: 'expenseDate', label: 'Date', type: 'date', width: 14 },
      { key: 'voucherType', label: 'Type', type: 'string', width: 16 },
      { key: 'category', label: 'Expense Category', type: 'string', width: 22 },
      { key: 'payeeName', label: 'Payee / Vendor', type: 'string', width: 24 },
      { key: 'taxableAmountInr', label: 'Base Amount (INR)', type: 'currency', width: 18, summable: true },
      { key: 'gstAmountInr', label: 'Input GST (INR)', type: 'currency', width: 16, summable: true },
      { key: 'totalAmountInr', label: 'Total Paid (INR)', type: 'currency', width: 18, summable: true }
    ]
  },
  {
    reportKey: 'profit_and_loss',
    title: 'Statement of Profit & Loss (Income Statement)',
    categoryGroup: 'GST_ACCOUNTING_FINANCE',
    moduleKey: 'accounting',
    sensitivity: 'SENSITIVE_FINANCIAL',
    description: 'Double-entry General Ledger Revenue, Cost of Goods Sold (COGS), Gross Profit, Operating Expenses, and Net Profit.',
    requiresAuthorizedSignature: true,
    taxRelevant: true,
    columns: [
      { key: 'section', label: 'P&L Section', type: 'string', width: 22 },
      { key: 'accountCode', label: 'GL Code', type: 'string', width: 14 },
      { key: 'accountName', label: 'Account Head', type: 'string', width: 32 },
      { key: 'debitInr', label: 'Debit (INR)', type: 'currency', width: 18, summable: true },
      { key: 'creditInr', label: 'Credit (INR)', type: 'currency', width: 18, summable: true },
      { key: 'amountInr', label: 'Statement Impact (INR)', type: 'currency', width: 22, summable: true }
    ]
  },
  {
    reportKey: 'balance_sheet',
    title: 'Statement of Financial Position (Balance Sheet)',
    categoryGroup: 'GST_ACCOUNTING_FINANCE',
    moduleKey: 'accounting',
    sensitivity: 'SENSITIVE_FINANCIAL',
    description: 'Assets, Liabilities, Share Capital, and Current Period Retained Earnings verified for double-entry equilibrium.',
    requiresAuthorizedSignature: true,
    taxRelevant: true,
    columns: [
      { key: 'classification', label: 'Classification', type: 'string', width: 22 },
      { key: 'accountCode', label: 'GL Code', type: 'string', width: 14 },
      { key: 'accountName', label: 'Account Head', type: 'string', width: 32 },
      { key: 'subGroup', label: 'Sub-Group', type: 'string', width: 20 },
      { key: 'balanceInr', label: 'Closing Balance (INR)', type: 'currency', width: 22, summable: true }
    ]
  },
  {
    reportKey: 'marketing_campaigns',
    title: 'Luxury Marketing Campaigns, Attribution & ROAS Report',
    categoryGroup: 'MARKETING_HR_OPERATIONS',
    moduleKey: 'marketing',
    sensitivity: 'STANDARD',
    description: 'Agency storytelling campaigns, value-add coffret initiatives, ad spend, attributed orders, and ROAS.',
    requiresAuthorizedSignature: false,
    taxRelevant: false,
    columns: [
      { key: 'name', label: 'Campaign Name', type: 'string', width: 28 },
      { key: 'channel', label: 'Channel', type: 'string', width: 16 },
      { key: 'strategyType', label: 'Luxury Strategy', type: 'string', width: 22 },
      { key: 'budgetInr', label: 'Budget (INR)', type: 'currency', width: 18, summable: true },
      { key: 'spendInr', label: 'Spend (INR)', type: 'currency', width: 18, summable: true },
      { key: 'revenueInr', label: 'Attributed Revenue (INR)', type: 'currency', width: 22, summable: true },
      { key: 'roas', label: 'ROAS (x)', type: 'number', width: 12 },
      { key: 'status', label: 'Status', type: 'string', width: 14 }
    ]
  },
  {
    reportKey: 'influencer_activity',
    title: 'Influencer Seeding, Deliverables & Attribution Report',
    categoryGroup: 'MARKETING_HR_OPERATIONS',
    moduleKey: 'marketing',
    sensitivity: 'STANDARD',
    description: 'Creator seeding roster, referral codes, clicks, converted orders, and attributed revenue.',
    requiresAuthorizedSignature: false,
    taxRelevant: false,
    columns: [
      { key: 'name', label: 'Creator Name', type: 'string', width: 24 },
      { key: 'handle', label: 'Social Handle', type: 'string', width: 20 },
      { key: 'platform', label: 'Platform', type: 'string', width: 16 },
      { key: 'referralCode', label: 'Tracking Code', type: 'string', width: 18 },
      { key: 'clicks', label: 'Clicks', type: 'number', width: 12, summable: true },
      { key: 'ordersCount', label: 'Orders', type: 'number', width: 12, summable: true },
      { key: 'totalRevenueInr', label: 'Attributed Sales (INR)', type: 'currency', width: 22, summable: true },
      { key: 'status', label: 'Status', type: 'string', width: 14 }
    ]
  },
  {
    reportKey: 'employee_performance',
    title: 'Employee Directory, Department Velocity & Compensation',
    categoryGroup: 'MARKETING_HR_OPERATIONS',
    moduleKey: 'hr',
    sensitivity: 'STANDARD',
    description: 'Permanent team roster, designations, task completion metrics, and payroll summary (redacted for unauthorized roles).',
    requiresAuthorizedSignature: true,
    taxRelevant: false,
    columns: [
      { key: 'employeeCode', label: 'Employee ID', type: 'string', width: 16 },
      { key: 'fullName', label: 'Full Name', type: 'string', width: 24 },
      { key: 'designation', label: 'Designation', type: 'string', width: 24 },
      { key: 'email', label: 'Email', type: 'string', width: 24 },
      { key: 'tasksCompleted', label: 'Tasks Done', type: 'number', width: 14, summable: true },
      { key: 'leaveBalanceDays', label: 'Leave Balance', type: 'number', width: 14 },
      { key: 'monthlySalaryInr', label: 'Monthly CTC (INR)', type: 'currency', width: 20, summable: true },
      { key: 'status', label: 'Status', type: 'string', width: 14 }
    ]
  },
  {
    reportKey: 'internship_cohort',
    title: 'Internship Cohort, Evaluations & Completion Certificates',
    categoryGroup: 'MARKETING_HR_OPERATIONS',
    moduleKey: 'hr',
    sensitivity: 'STANDARD',
    description: 'Intern roster across 7 departments, universities, mentors, evaluation scores, and certificate issuance.',
    requiresAuthorizedSignature: true,
    taxRelevant: false,
    columns: [
      { key: 'internCode', label: 'Intern ID', type: 'string', width: 16 },
      { key: 'fullName', label: 'Intern Name', type: 'string', width: 24 },
      { key: 'departmentTrack', label: 'Department Track', type: 'string', width: 20 },
      { key: 'university', label: 'College / University', type: 'string', width: 26 },
      { key: 'startDate', label: 'Joining Date', type: 'date', width: 14 },
      { key: 'endDate', label: 'End Date', type: 'date', width: 14 },
      { key: 'evaluationScore', label: 'Score / 5', type: 'number', width: 12 },
      { key: 'certificateNumber', label: 'Certificate #', type: 'string', width: 20 },
      { key: 'status', label: 'Status', type: 'string', width: 14 }
    ]
  },
  {
    reportKey: 'intern_attendance',
    title: 'Internship Attendance & Logged Hours Register',
    categoryGroup: 'MARKETING_HR_OPERATIONS',
    moduleKey: 'hr',
    sensitivity: 'STANDARD',
    description: 'Daily intern check-in/out records, work mode (Lab/Atelier/Remote), logged hours, and mentor verification.',
    requiresAuthorizedSignature: false,
    taxRelevant: false,
    columns: [
      { key: 'attendanceDate', label: 'Date', type: 'date', width: 14 },
      { key: 'internCode', label: 'Intern ID', type: 'string', width: 16 },
      { key: 'internName', label: 'Intern Name', type: 'string', width: 22 },
      { key: 'departmentTrack', label: 'Department', type: 'string', width: 18 },
      { key: 'workMode', label: 'Work Mode', type: 'string', width: 16 },
      { key: 'checkInTime', label: 'Check-In', type: 'string', width: 12 },
      { key: 'checkOutTime', label: 'Check-Out', type: 'string', width: 12 },
      { key: 'hoursLogged', label: 'Hours Logged', type: 'number', width: 14, summable: true },
      { key: 'status', label: 'Attendance Status', type: 'string', width: 16 }
    ]
  },
  {
    reportKey: 'tasks_productivity',
    title: 'Cross-Department Kanban Tasks & Approval Register',
    categoryGroup: 'MARKETING_HR_OPERATIONS',
    moduleKey: 'hr',
    sensitivity: 'STANDARD',
    description: 'Kanban tasks across departments with priority, dependencies, due dates, and approval stage.',
    requiresAuthorizedSignature: false,
    taxRelevant: false,
    columns: [
      { key: 'taskNumber', label: 'Task #', type: 'string', width: 16 },
      { key: 'title', label: 'Task Title', type: 'string', width: 30 },
      { key: 'sourceModule', label: 'Department / Module', type: 'string', width: 18 },
      { key: 'assignedToEmail', label: 'Assignee', type: 'string', width: 24 },
      { key: 'priority', label: 'Priority', type: 'string', width: 12 },
      { key: 'dueDate', label: 'Due Date', type: 'date', width: 14 },
      { key: 'status', label: 'Kanban Column', type: 'string', width: 16 },
      { key: 'approvalStage', label: 'Approval Stage', type: 'string', width: 18 }
    ]
  },
  {
    reportKey: 'department_productivity',
    title: 'Department Productivity & Operational Velocity Summary',
    categoryGroup: 'MARKETING_HR_OPERATIONS',
    moduleKey: 'hr',
    sensitivity: 'STANDARD',
    description: 'Department-by-department task throughput, completion rate, active staff, and intern cohort allocation.',
    requiresAuthorizedSignature: false,
    taxRelevant: false,
    columns: [
      { key: 'departmentCode', label: 'Dept Code', type: 'string', width: 14 },
      { key: 'departmentName', label: 'Department Name', type: 'string', width: 26 },
      { key: 'staffCount', label: 'Permanent Staff', type: 'number', width: 16, summable: true },
      { key: 'internCount', label: 'Active Interns', type: 'number', width: 16, summable: true },
      { key: 'totalTasks', label: 'Total Tasks', type: 'number', width: 14, summable: true },
      { key: 'completedTasks', label: 'Completed Tasks', type: 'number', width: 16, summable: true },
      { key: 'completionRatePct', label: 'Completion %', type: 'number', width: 16 }
    ]
  }
];

function assertReportExportAccess(actor: ErpActorContext, meta: ReportCategoryMeta) {
  if (actor.isSuperAdmin) return;

  // Enforce strict sensitivity boundaries regardless of generic module view flags
  if (meta.sensitivity === 'CONFIDENTIAL_FORMULATION') {
    if (!['SUPER_ADMIN', 'FORMULATOR', 'FINANCE_CONTROLLER'].includes(actor.roleCode)) {
      throw new ForbiddenError(
        `Confidential formulation costing & BOM export is restricted to Authorized Formulators, Finance Controllers, and Founders (${actor.roleCode} blocked).`
      );
    }
  }

  if (meta.sensitivity === 'SENSITIVE_FINANCIAL') {
    if (!['SUPER_ADMIN', 'FINANCE_CONTROLLER', 'OPERATIONS_ADMIN'].includes(actor.roleCode)) {
      throw new ForbiddenError(
        `Sensitive statutory GST & financial statement export is restricted to Finance Controllers and Founders (${actor.roleCode} blocked).`
      );
    }
  }

  if (meta.sensitivity === 'CUSTOMER_PII') {
    if (['INTERN_VIEWER', 'MARKETING_AGENCY', 'FORMULATOR', 'QC_ANALYST'].includes(actor.roleCode)) {
      throw new ForbiddenError(
        `Customer PII & commercial order export is restricted for role ${actor.roleCode}.`
      );
    }
  }

  // Check module view & export permissions
  const modulePerm = actor.permissions[meta.moduleKey];
  const reportsPerm = actor.permissions['reports'];
  const canViewModule = Boolean(modulePerm?.canView || reportsPerm?.canView);
  const canExportModule = Boolean(modulePerm?.canExport || reportsPerm?.canExport);

  if (!canViewModule || !canExportModule) {
    assertErpPermission(actor, meta.moduleKey, 'export');
  }
}

export interface ReportFilterInput {
  dateFrom?: string;
  dateTo?: string;
  statusFilter?: string;
  searchQuery?: string;
  selectedColumns?: string[];
  customTitle?: string;
  customRows?: Array<Record<string, any>>;
  customColumns?: ReportColumnDef[];
}

function extractIsoDate(val: any): string | null {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  const str = String(val);
  const match = str.match(/^\d{4}-\d{2}-\d{2}/);
  if (match) return match[0];
  const parsed = Date.parse(str);
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  return null;
}

async function fetchDatasetForReport(actor: ErpActorContext, reportKey: string): Promise<Array<Record<string, any>>> {
  await ensureErpSeeded();
  await ensureAgencyHrSeeded();

  const canSeePayroll = ['SUPER_ADMIN', 'FINANCE_CONTROLLER', 'OPERATIONS_ADMIN'].includes(actor.roleCode);
  const canSeeMarketingSpend = actor.roleCode !== 'INTERN_VIEWER';

  switch (reportKey) {
    case 'procurement_pos': {
      const [pos, sups] = await Promise.all([
        db.select().from(supplierPurchaseOrders).orderBy(desc(supplierPurchaseOrders.createdAt)),
        db.select().from(procurementSuppliers)
      ]);
      const supMap = new Map(sups.map((s) => [s.id, s.legalName || s.tradeName || s.name]));
      return pos.map((p) => ({
        poNumber: p.poNumber,
        orderDate: extractIsoDate(p.orderDate || p.createdAt) || '',
        supplierName: supMap.get(p.supplierId) || p.supplierName || p.supplierId,
        status: p.status,
        paymentStatus: p.paymentStatus || 'PENDING',
        subtotalInr: Number(p.subtotalInr || 0),
        gstTotalInr: Number(p.gstInr || 0),
        totalAmountInr: Number(p.totalCostInr || 0),
        expectedDeliveryDate: p.expectedDeliveryDate || ''
      }));
    }

    case 'supplier_performance': {
      const [sups, pos] = await Promise.all([
        db.select().from(procurementSuppliers).orderBy(procurementSuppliers.code),
        db.select().from(supplierPurchaseOrders)
      ]);
      return sups.map((s) => {
        const vendorPos = pos.filter((p) => p.supplierId === s.id && p.status !== 'CANCELLED');
        const spend = vendorPos.reduce((acc, p) => acc + Number(p.totalCostInr || 0), 0);
        const perf = (s.performanceMetrics as any) || {};
        return {
          supplierCode: s.code,
          legalName: s.legalName || s.name,
          gstin: s.gstin || 'UNREGISTERED',
          leadTimeDays: Number(s.leadTimeDays || 7),
          onTimeDeliveryPct: Number(perf.onTimeRatePct || 96),
          qualityRating: s.rating === 'A_GRADE' ? 4.9 : s.rating === 'B_GRADE' ? 4.2 : 3.6,
          poCount: vendorPos.length,
          totalSpendInr: spend,
          status: s.status
        };
      });
    }

    case 'raw_materials': {
      const mats = await db.select().from(erpMaterials).orderBy(erpMaterials.code);
      return mats.map((m) => ({
        sku: m.code,
        name: m.name,
        category: m.category,
        uom: m.uom,
        densityGPerMl: m.densityGPerMl ? Number(m.densityGPerMl) : 0,
        availableQty: Number(m.currentStock || 0),
        reorderPoint: Number(m.reorderLevel || 0),
        standardCostInr: Number(m.unitCostInr || 0),
        stockValueInr: Math.round(Number(m.currentStock || 0) * Number(m.unitCostInr || 0) * 100) / 100
      }));
    }

    case 'stock_movements': {
      const [movs, mats] = await Promise.all([
        db.select().from(erpStockMovements).orderBy(desc(erpStockMovements.createdAt)),
        db.select().from(erpMaterials)
      ]);
      const matMap = new Map(mats.map((m) => [m.id, m.code]));
      return movs.map((mv) => ({
        movementDate: mv.movementDate || extractIsoDate(mv.createdAt) || '',
        movementNumber: mv.movementNumber,
        materialSku: mv.materialCode || (mv.materialId ? matMap.get(mv.materialId) : null) || mv.sku || '-',
        movementType: mv.movementType,
        direction: Number(mv.qtyDelta || 0) >= 0 ? 'INWARD' : 'OUTWARD',
        qty: Math.abs(Number(mv.qtyDelta || 0)),
        uom: mv.uom,
        totalCostInr: Number(mv.totalCostInr || 0),
        referenceCode: mv.referenceId || mv.reason || ''
      }));
    }

    case 'stock_valuation': {
      const [lots, mats] = await Promise.all([
        db.select().from(erpStockLots).orderBy(desc(erpStockLots.createdAt)),
        db.select().from(erpMaterials)
      ]);
      const matMap = new Map(mats.map((m) => [m.id, m.name]));
      return lots.map((l) => ({
        lotNumber: l.lotNumber,
        materialName: matMap.get(l.materialId) || l.materialId,
        receivedDate: l.receivedDate || extractIsoDate(l.createdAt) || '',
        expiryDate: l.expiryDate || l.retestDate || '',
        qcStatus: l.qcStatus,
        qtyAvailable: Number(l.availableQty || 0),
        uom: l.uom,
        unitCostInr: Number(l.unitCostInr || 0),
        lotValuationInr: Math.round(Number(l.availableQty || 0) * Number(l.unitCostInr || 0) * 100) / 100
      }));
    }

    case 'formulation_costs': {
      const [forms, vers] = await Promise.all([
        db.select().from(erpFormulations).orderBy(erpFormulations.formulaCode),
        db.select().from(erpFormulationVersions).orderBy(desc(erpFormulationVersions.versionNumber))
      ]);
      return forms.map((f) => {
        const v = vers.find((ver) => ver.formulationId === f.id);
        const sizeCosts = Array.isArray(v?.bottleSizeCosts) ? (v?.bottleSizeCosts as any[]) : [];
        const cost50 = sizeCosts.find((sc) => sc.sizeLabel === '50ML') || sizeCosts[0] || {};
        const juiceCost = Number(cost50.juiceCostInr ?? ((Number(v?.costPerKgInr || 0) / 1000) * 50));
        const pkgCost = Number(cost50.packagingCostInr ?? 185);
        const totalBottle = Number(v?.estimatedCostPer50mlInr || cost50.totalEstimatedCostPerBottleInr || juiceCost + pkgCost);
        return {
          formulaCode: f.formulaCode,
          fragranceName: f.name,
          versionLabel: v ? `v${v.versionNumber}` : `v${f.activeVersionNumber || 1}`,
          concentrationPct: Number(v?.concentratePct ?? f.targetOilPct ?? 28),
          solventPct: Number(v?.solventPct ?? 100 - Number(f.targetOilPct || 28)),
          targetBatchMl: Number(v?.targetBatchSize || 10) * (v?.targetBatchUnit === 'kg' ? 1000 : 1000),
          juiceCostPerBottleInr: Math.round(juiceCost * 100) / 100,
          packagingCostInr: Math.round(pkgCost * 100) / 100,
          estimatedCostPerBottleInr: Math.round(totalBottle * 100) / 100,
          approvalStatus: v?.ifraComplianceStatus || f.status
        };
      });
    }

    case 'production_batches': {
      const batches = await db.select().from(productionBatches).orderBy(desc(productionBatches.createdAt));
      return batches.map((b) => ({
        batchCode: b.batchNumber,
        productName: b.productName,
        currentStage: b.pipelineStage || b.batchReleaseStatus,
        plannedUnits: Number(b.plannedBottlesCount || b.finishedQuantity || 0),
        actualUnitsProduced: Number(b.actualFilledBottlesCount || b.finishedQuantity || 0),
        macerationDays: 21,
        totalBatchCostInr: Number(b.actualTotalCostInr || 0),
        status: b.batchReleaseStatus || b.qcStatus
      }));
    }

    case 'production_variance': {
      const batches = await db.select().from(productionBatches).orderBy(desc(productionBatches.createdAt));
      return batches.map((b) => {
        const planned = Number(b.plannedBottlesCount || b.finishedQuantity || 0);
        const actual = Number(b.actualFilledBottlesCount || b.finishedQuantity || planned);
        const scrap = Number(b.rejectedBottlesCount || Math.max(0, planned - actual));
        const yieldPct = planned > 0 ? Math.round((actual / planned) * 10000) / 100 : 100;
        const unitCost =
          Number(b.costPerBottleInr || 0) ||
          (actual > 0 ? Math.round((Number(b.actualTotalCostInr || 0) / actual) * 100) / 100 : 0);
        return {
          batchCode: b.batchNumber,
          productName: b.productName,
          plannedUnits: planned,
          actualUnitsProduced: actual,
          rejectedOrScrapUnits: scrap,
          yieldPct,
          unitCostInr: unitCost,
          varianceNotes: b.notes || (yieldPct >= 98 ? 'Within luxury tolerance' : 'Filtration evaporation loss')
        };
      });
    }

    case 'sampling_register': {
      const samples = await db.select().from(erpSamples).orderBy(desc(erpSamples.createdAt));
      return samples.map((s) => ({
        sampleNumber: s.sampleNumber,
        preparedDate: s.preparationDate || extractIsoDate(s.createdAt) || '',
        fragranceName: s.fragranceName,
        purpose: s.purpose,
        recipientName: s.recipientName || 'Internal Lab',
        quantityMl: Number(s.volumeMl || 0) * Number(s.quantityUnits || 1),
        totalSampleCostInr: Number(s.totalCostInr || 0),
        status: s.workflowStage || s.status
      }));
    }

    case 'qc_inspections': {
      const qcs = await db.select().from(erpQcRecords).orderBy(desc(erpQcRecords.createdAt));
      return qcs.map((q) => ({
        inspectionNumber: q.qcNumber,
        inspectedAt: extractIsoDate(q.createdAt) || '',
        targetType: q.inspectionType,
        targetCode: q.subjectName,
        odorProfilePass: q.odourResult,
        colorAppearancePass: q.appearanceResult,
        overallResult: q.decision,
        inspectorEmail: q.inspectorEmail
      }));
    }

    case 'finished_goods': {
      const fgs = await db.select().from(erpFinishedGoods).orderBy(erpFinishedGoods.sku);
      return fgs.map((fg) => ({
        sku: fg.sku,
        productName: fg.productName,
        binLocation: fg.binLocation,
        availableUnits: Number(fg.quantityAvailable || 0),
        reservedUnits: Number(fg.quantityReserved || 0),
        unitCostInr: Number(fg.unitManufacturingCostInr || 0),
        mrpInr: Number(fg.mrpInr || 0),
        totalValuationInr:
          Math.round(Number(fg.quantityAvailable || 0) * Number(fg.unitManufacturingCostInr || 0) * 100) / 100
      }));
    }

    case 'sales_orders': {
      const ordRows = await db.select().from(orders).orderBy(desc(orders.createdAt));
      return ordRows.map((o) => ({
        orderId: o.orderNumber || o.id,
        createdAt: extractIsoDate(o.createdAt) || '',
        customerName: o.customerName,
        customerEmail: o.customerEmail,
        paymentMethod: o.paymentMethod || 'ONLINE',
        paymentStatus: o.paymentStatus || 'PAID',
        status: o.orderStatus,
        totalAmountInr: Number(o.totalAmount || 0)
      }));
    }

    case 'store_products': {
      const prods = await db.select().from(products).orderBy(products.name);
      return prods.map((p) => {
        const variants = Array.isArray(p.variants) ? (p.variants as any[]) : [];
        const primary = variants[0] || {};
        return {
          sku: primary.sku || p.slug.toUpperCase(),
          name: p.name,
          collection: p.collection || 'Signature',
          size: primary.size || '50ML',
          mrpInr: Number(primary.mrp || primary.sellingPrice || 0),
          priceInr: Number(primary.sellingPrice || primary.price || 0),
          stock: variants.reduce(
            (s, v) => s + Number(v.stockOnHand ?? v.stockAvailable ?? v.stock ?? 0),
            0
          )
        };
      });
    }

    case 'store_customers': {
      const custs = await db.select().from(customers).orderBy(desc(customers.totalSpend));
      return custs.map((c) => ({
        name: c.name,
        email: c.email,
        phone: c.phone || '',
        city: c.city || ((Array.isArray(c.addresses) && (c.addresses as any[])[0]?.city) || ''),
        ordersCount: Number(c.totalOrders || 0),
        totalSpentInr: Number(c.totalSpend || 0)
      }));
    }

    case 'corporate_proposals': {
      const props = await db.select().from(erpProposals).orderBy(desc(erpProposals.createdAt));
      return props.map((p) => ({
        proposalNumber: p.proposalNumber,
        createdAt: p.proposalDate || extractIsoDate(p.createdAt) || '',
        clientCompany: p.clientCompany,
        proposalType: p.proposalType,
        versionNumber: Number(p.proposalVersionNumber || 1),
        estimatedValueInr: Number(p.grandTotalInr || p.estimatedValueInr || 0),
        status: p.status
      }));
    }

    case 'quotations_register': {
      const quots = await db.select().from(erpQuotations).orderBy(desc(erpQuotations.createdAt));
      return quots.map((q) => ({
        quotationNumber: q.quotationNumber,
        issueDate: q.quotationDate || extractIsoDate(q.createdAt) || '',
        clientName: q.clientName,
        validUntil: q.validUntil || '',
        subtotalInr: Number(q.taxableAmountInr || q.subtotalInr || 0),
        gstTotalInr: Number(q.cgstInr || 0) + Number(q.sgstInr || 0) + Number(q.igstInr || 0),
        grandTotalInr: Number(q.totalInr || 0),
        status: q.status
      }));
    }

    case 'gst_invoices': {
      const invs = await db.select().from(erpInvoices).orderBy(desc(erpInvoices.createdAt));
      return invs.map((inv) => ({
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.issueDate || extractIsoDate(inv.createdAt) || '',
        documentType: inv.invoiceType,
        customerName: inv.customerName,
        customerGstin: inv.customerGstin || 'URP (B2C)',
        placeOfSupplyState: inv.placeOfSupplyState,
        taxableAmountInr: Number(inv.taxableAmountInr || inv.subtotalInr || 0),
        cgstAmountInr: Number(inv.cgstAmountInr || 0),
        sgstAmountInr: Number(inv.sgstAmountInr || 0),
        igstAmountInr: Number(inv.igstAmountInr || 0),
        grandTotalInr: Number(inv.grandTotalInr || 0),
        balanceDueInr: Number(inv.balanceDueInr || 0)
      }));
    }

    case 'outstanding_payments': {
      const [arInvs, apBills] = await Promise.all([
        db.select().from(erpInvoices).orderBy(desc(erpInvoices.createdAt)),
        db.select().from(erpVendorInvoices).orderBy(desc(erpVendorInvoices.createdAt))
      ]);
      const rows: Array<Record<string, any>> = [];
      for (const inv of arInvs) {
        if (inv.invoiceType !== 'PROFORMA' && Number(inv.balanceDueInr || 0) > 0) {
          rows.push({
            ledgerType: 'RECEIVABLE (AR)',
            documentNumber: inv.invoiceNumber,
            documentDate: inv.issueDate,
            dueDate: inv.dueDate || inv.issueDate,
            partyName: inv.customerName,
            totalAmountInr: Number(inv.grandTotalInr || 0),
            paidAmountInr: Number(inv.amountPaidInr || 0),
            outstandingInr: Number(inv.balanceDueInr || 0)
          });
        }
      }
      for (const bill of apBills) {
        const out = Number(bill.balanceDueInr ?? Number(bill.totalAmountInr || 0) - Number(bill.paidAmountInr || 0));
        if (out > 0 && bill.status !== 'CANCELLED') {
          rows.push({
            ledgerType: 'PAYABLE (AP)',
            documentNumber: bill.voucherNumber || bill.supplierInvoiceNumber,
            documentDate: bill.invoiceDate,
            dueDate: bill.dueDate || bill.invoiceDate,
            partyName: bill.supplierName || bill.supplierId,
            totalAmountInr: Number(bill.totalAmountInr || 0),
            paidAmountInr: Number(bill.paidAmountInr || 0),
            outstandingInr: out
          });
        }
      }
      return rows;
    }

    case 'expenses_petty_cash': {
      const exps = await db.select().from(erpExpensesAndPettyCash).orderBy(desc(erpExpensesAndPettyCash.createdAt));
      return exps.map((e) => ({
        voucherNumber: e.voucherNumber,
        expenseDate: e.expenseDate,
        voucherType: e.voucherType,
        category: e.category,
        payeeName: e.payeeName,
        taxableAmountInr: Number(e.taxableAmountInr || 0),
        gstAmountInr:
          Number(e.cgstInr || 0) + Number(e.sgstInr || 0) + Number(e.igstInr || 0),
        totalAmountInr: Number(e.totalAmountInr || 0)
      }));
    }

    case 'profit_and_loss': {
      const snap = await getGstAccountingWorkspaceSnapshot(actor);
      const pnl = snap.financialStatements.profitAndLoss;
      const rows: Array<Record<string, any>> = [];
      for (const r of pnl.revenueLines) {
        rows.push({
          section: '1. OPERATING REVENUE',
          accountCode: r.accountCode,
          accountName: r.accountName,
          debitInr: Number(r.debitInr || 0),
          creditInr: Number(r.creditInr || 0),
          amountInr: Number(r.creditInr || 0) - Number(r.debitInr || 0)
        });
      }
      for (const c of pnl.cogsLines) {
        rows.push({
          section: '2. COST OF GOODS SOLD',
          accountCode: c.accountCode,
          accountName: c.accountName,
          debitInr: Number(c.debitInr || 0),
          creditInr: Number(c.creditInr || 0),
          amountInr: -(Number(c.debitInr || 0) - Number(c.creditInr || 0))
        });
      }
      for (const o of pnl.opexLines) {
        rows.push({
          section: '3. OPERATING EXPENSES',
          accountCode: o.accountCode,
          accountName: o.accountName,
          debitInr: Number(o.debitInr || 0),
          creditInr: Number(o.creditInr || 0),
          amountInr: -(Number(o.debitInr || 0) - Number(o.creditInr || 0))
        });
      }
      if (!rows.length) {
        rows.push({
          section: 'NET PROFIT SUMMARY',
          accountCode: 'PNL-SUM',
          accountName: 'Current Period Net Operating Result',
          debitInr: Number(pnl.totalCogsInr + pnl.totalOpexInr),
          creditInr: Number(pnl.totalRevenueInr),
          amountInr: Number(pnl.netProfitInr)
        });
      }
      return rows;
    }

    case 'balance_sheet': {
      const snap = await getGstAccountingWorkspaceSnapshot(actor);
      const bs = snap.financialStatements.balanceSheet;
      const rows: Array<Record<string, any>> = [];
      for (const a of bs.assetLines) {
        rows.push({
          classification: 'ASSET',
          accountCode: a.accountCode,
          accountName: a.accountName,
          subGroup: a.subGroup || 'Assets',
          balanceInr: Number(a.netBalanceInr || 0)
        });
      }
      for (const l of bs.liabilityLines) {
        rows.push({
          classification: 'LIABILITY',
          accountCode: l.accountCode,
          accountName: l.accountName,
          subGroup: l.subGroup || 'Liabilities',
          balanceInr: Math.abs(Number(l.netBalanceInr || 0))
        });
      }
      for (const eqLine of bs.equityLines) {
        rows.push({
          classification: 'EQUITY',
          accountCode: eqLine.accountCode,
          accountName: eqLine.accountName,
          subGroup: eqLine.subGroup || 'Capital & Reserves',
          balanceInr: Math.abs(Number(eqLine.netBalanceInr || 0))
        });
      }
      if (bs.currentPeriodEarningsInr !== 0) {
        rows.push({
          classification: 'EQUITY (RETAINED)',
          accountCode: '3999',
          accountName: 'Current Period Unappropriated Earnings',
          subGroup: 'Retained Earnings',
          balanceInr: Number(bs.currentPeriodEarningsInr || 0)
        });
      }
      return rows;
    }

    case 'marketing_campaigns': {
      const camps = await db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
      return camps.map((c) => ({
        name: c.name,
        channel: c.channel,
        strategyType: (c.campaignMetadata as any)?.strategyType || 'BRAND_STORYTELLING',
        budgetInr: canSeeMarketingSpend ? Number(c.budget || 0) : 0,
        spendInr: canSeeMarketingSpend ? Number(c.spend || 0) : 0,
        revenueInr: canSeeMarketingSpend ? Number(c.revenue || 0) : 0,
        roas: Number(c.spend || 0) > 0 ? Math.round((Number(c.revenue || 0) / Number(c.spend || 0)) * 100) / 100 : 0,
        status: c.status
      }));
    }

    case 'influencer_activity': {
      const infs = await db.select().from(influencers).orderBy(desc(influencers.totalRevenue));
      return infs.map((i) => ({
        name: i.name,
        handle: i.handle,
        platform: i.platform,
        referralCode: i.referralCode,
        clicks: Number(i.clicks || 0),
        ordersCount: Number(i.ordersCount || 0),
        totalRevenueInr: canSeeMarketingSpend ? Number(i.totalRevenue || 0) : 0,
        status: i.status
      }));
    }

    case 'employee_performance': {
      const [emps, tsks] = await Promise.all([
        db.select().from(erpEmployees).orderBy(erpEmployees.employeeCode),
        db.select().from(erpTasks)
      ]);
      return emps.map((e) => ({
        employeeCode: e.employeeCode,
        fullName: e.fullName,
        designation: e.designation,
        email: e.email,
        tasksCompleted: tsks.filter(
          (t) => t.assignedToEmail.toLowerCase() === e.email.toLowerCase() && t.status === 'DONE'
        ).length,
        leaveBalanceDays: Number(e.leaveBalanceDays || 0),
        monthlySalaryInr: canSeePayroll ? Number(e.monthlySalaryInr || 0) : 0,
        status: e.status
      }));
    }

    case 'internship_cohort': {
      const [ints, evals] = await Promise.all([
        db.select().from(erpInterns).orderBy(erpInterns.internCode),
        db.select().from(erpInternEvaluations).orderBy(desc(erpInternEvaluations.createdAt))
      ]);
      return ints.map((i) => {
        const latestEval = evals.find((ev) => ev.internId === i.id);
        return {
          internCode: i.internCode,
          fullName: i.fullName,
          departmentTrack: i.departmentTrack || i.track,
          university: i.university,
          startDate: i.startDate,
          endDate: i.endDate,
          evaluationScore: Number(latestEval?.overallRating ?? i.evaluationScore ?? 0),
          certificateNumber: i.certificateNumber || (i.certificateIssued ? 'CERT-ISSUED' : 'PENDING'),
          status: i.status
        };
      });
    }

    case 'intern_attendance': {
      const [atts, ints] = await Promise.all([
        db.select().from(erpInternAttendance).orderBy(desc(erpInternAttendance.attendanceDate)),
        db.select().from(erpInterns)
      ]);
      const intMap = new Map(ints.map((i) => [i.id, i]));
      return atts.map((a) => {
        const intr = intMap.get(a.internId);
        return {
          attendanceDate: a.attendanceDate,
          internCode: intr?.internCode || a.internId,
          internName: intr?.fullName || 'Intern',
          departmentTrack: intr?.departmentTrack || intr?.track || '',
          workMode: a.workMode,
          checkInTime: a.checkInTime,
          checkOutTime: a.checkOutTime || '',
          hoursLogged: Number(a.hoursLogged || 0),
          status: a.status
        };
      });
    }

    case 'tasks_productivity': {
      const tsks = await db.select().from(erpTasks).orderBy(desc(erpTasks.createdAt));
      return tsks.map((t) => ({
        taskNumber: t.taskNumber,
        title: t.title,
        sourceModule: t.sourceModule.toUpperCase(),
        assignedToEmail: t.assignedToEmail,
        priority: t.priority,
        dueDate: t.dueDate || '',
        status: t.status,
        approvalStage: t.approvalStage || 'IN_PROGRESS'
      }));
    }

    case 'department_productivity': {
      const [depts, emps, ints, tsks] = await Promise.all([
        db.select().from(erpDepartments),
        db.select().from(erpEmployees),
        db.select().from(erpInterns),
        db.select().from(erpTasks)
      ]);
      return depts.map((d) => {
        const deptTasks = tsks.filter(
          (t) => t.departmentId === d.id || t.sourceModule.toUpperCase().includes(d.code.slice(0, 4))
        );
        const done = deptTasks.filter((t) => t.status === 'DONE').length;
        return {
          departmentCode: d.code,
          departmentName: d.name,
          staffCount: emps.filter((e) => e.departmentId === d.id).length,
          internCount: ints.filter((i) => i.departmentId === d.id).length,
          totalTasks: deptTasks.length,
          completedTasks: done,
          completionRatePct: deptTasks.length ? Math.round((done / deptTasks.length) * 100) : 100
        };
      });
    }

    default:
      throw new ValidationError(`Unsupported report key: ${reportKey}`);
  }
}

function applyServerReportFilters(
  rawRows: Array<Record<string, any>>,
  allColumns: ReportColumnDef[],
  filters: ReportFilterInput
): { rows: Array<Record<string, any>>; activeColumns: ReportColumnDef[] } {
  let filtered = [...rawRows];

  if (filters.dateFrom || filters.dateTo) {
    const dateCols = allColumns.filter((c) => c.type === 'date').map((c) => c.key);
    if (dateCols.length > 0) {
      filtered = filtered.filter((row) => {
        const rowDate = extractIsoDate(row[dateCols[0]]);
        if (!rowDate) return true;
        if (filters.dateFrom && rowDate < filters.dateFrom) return false;
        if (filters.dateTo && rowDate > filters.dateTo) return false;
        return true;
      });
    }
  }

  if (filters.statusFilter && filters.statusFilter !== 'ALL') {
    const statusTarget = filters.statusFilter.trim().toUpperCase();
    filtered = filtered.filter((row) =>
      Object.values(row).some((v) => String(v ?? '').toUpperCase() === statusTarget)
    );
  }

  if (filters.searchQuery && filters.searchQuery.trim()) {
    const q = filters.searchQuery.trim().toLowerCase();
    filtered = filtered.filter((row) =>
      Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q))
    );
  }

  const activeColumns =
    filters.selectedColumns && filters.selectedColumns.length > 0
      ? allColumns.filter((c) => filters.selectedColumns!.includes(c.key))
      : allColumns;

  if (!activeColumns.length) {
    throw new ValidationError('At least one column must be selected for report generation.');
  }

  return { rows: filtered, activeColumns };
}

function resolveReportDefinition(reportKey: string, filters?: ReportFilterInput): ReportCategoryMeta {
  const existing = REPORT_CATALOG.find((r) => r.reportKey === reportKey);
  if (existing) return existing;

  if (reportKey === 'custom_table') {
    const rowsArr = Array.isArray(filters?.customRows) ? filters!.customRows! : [];
    const sample = rowsArr[0] || {};
    const inferredCols: ReportColumnDef[] =
      filters?.customColumns && filters.customColumns.length
        ? filters.customColumns
        : Object.keys(sample).map((k) => {
            const val = sample[k];
            const isCurr = /inr|amount|price|cost|spend|revenue|total|balance|budget/i.test(k) && typeof val === 'number';
            const isDate = /date|created|updated/i.test(k) && Boolean(extractIsoDate(val));
            return {
              key: k,
              label: k.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()),
              type: isCurr ? 'currency' : typeof val === 'number' ? 'number' : isDate ? 'date' : 'string',
              width: 20,
              summable: isCurr
            };
          });

    return {
      reportKey: 'custom_table',
      title: filters?.customTitle || 'FRAGMORÉ Operational Table Export',
      categoryGroup: 'MARKETING_HR_OPERATIONS',
      moduleKey: 'reports',
      sensitivity: 'STANDARD',
      description: 'Ad-hoc verified admin table export.',
      requiresAuthorizedSignature: false,
      taxRelevant: false,
      columns: inferredCols.length ? inferredCols : [{ key: 'summary', label: 'Record', type: 'string', width: 30 }]
    };
  }

  throw new NotFoundError(`Report definition '${reportKey}' not found in FRAGMORÉ Reporting Engine.`);
}

export function getReportCatalogForActor(actor: ErpActorContext) {
  return REPORT_CATALOG.map((meta) => {
    let permitted = true;
    let restrictionReason: string | null = null;
    try {
      assertReportExportAccess(actor, meta);
    } catch (e: any) {
      permitted = false;
      restrictionReason = e?.message || 'Restricted by RBAC';
    }
    return {
      ...meta,
      permitted,
      restrictionReason
    };
  });
}

export async function previewReportData(
  actor: ErpActorContext,
  payload: { reportKey: string; filters?: ReportFilterInput }
) {
  const filters = payload.filters || {};
  const meta = resolveReportDefinition(payload.reportKey, filters);
  assertReportExportAccess(actor, meta);

  const rawRows =
    payload.reportKey === 'custom_table' && Array.isArray(filters.customRows)
      ? filters.customRows
      : await fetchDatasetForReport(actor, payload.reportKey);

  const { rows, activeColumns } = applyServerReportFilters(rawRows, meta.columns, filters);
  const orgRows = await db.select().from(erpOrganizations).where(eq(erpOrganizations.id, ORG_ID));
  const org = orgRows[0] || {};

  // Compute column totals for preview footer
  const totals: Record<string, number> = {};
  for (const col of activeColumns) {
    if (col.summable || col.type === 'currency') {
      totals[col.key] = Math.round(rows.reduce((sum, r) => sum + (Number(r[col.key]) || 0), 0) * 100) / 100;
    }
  }

  return {
    meta: {
      reportKey: meta.reportKey,
      title: filters.customTitle || meta.title,
      categoryGroup: meta.categoryGroup,
      description: meta.description,
      sensitivity: meta.sensitivity,
      taxRelevant: meta.taxRelevant,
      requiresAuthorizedSignature: meta.requiresAuthorizedSignature,
      allColumns: meta.columns
    },
    organization: {
      brandName: 'FRAGMORÉ',
      legalName: org.legalName || 'FRAGMORÉ HAUTE PARFUMERIE PRIVATE LIMITED',
      gstin: org.gstin || '27AABCF9182K1Z4',
      stateCode: org.stateCode || '27',
      stateName: org.stateName || 'Maharashtra',
      registeredAddress: org.registeredAddress || 'Atelier 402, Ballard Estate, Mumbai 400001, Maharashtra, India',
      contactEmail: org.contactEmail || 'concierge@fragmore.shop'
    },
    activeColumns,
    totalRowCount: rows.length,
    previewRows: rows.slice(0, 200),
    totals,
    generatedAtIso: new Date().toISOString(),
    actor: { email: actor.email, roleCode: actor.roleCode }
  };
}

function excelColLetter(colIndex1Based: number): string {
  let temp = colIndex1Based;
  let letter = '';
  while (temp > 0) {
    const mod = (temp - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    temp = Math.floor((temp - mod) / 26);
  }
  return letter;
}

/**
 * Generates a genuine OpenXML .xlsx workbook with Executive Summary + Detailed Ledger,
 * typed numbers/dates/currencies, native formulas, frozen headers, auto-filters, and formula-injection sanitization.
 */
async function buildGenuineXlsxBuffer(params: {
  docNumber: string;
  meta: ReportCategoryMeta;
  org: any;
  actor: ErpActorContext;
  filters: ReportFilterInput;
  activeColumns: ReportColumnDef[];
  rows: Array<Record<string, any>>;
}): Promise<Buffer> {
  const { docNumber, meta, org, actor, filters, activeColumns, rows } = params;
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'FRAGMORÉ Business OS';
  workbook.lastModifiedBy = actor.email;
  workbook.created = new Date();
  workbook.modified = new Date();

  const summarySheet = workbook.addWorksheet('Executive Summary', {
    views: [{ showGridLines: true }]
  });
  const detailSheet = workbook.addWorksheet('Detailed Ledger', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  // 1. Populate Detailed Ledger Sheet (Row 1 = Frozen Header)
  detailSheet.columns = activeColumns.map((col) => ({
    header: col.label,
    key: col.key,
    width: col.width || 20
  }));

  const headerRow = detailSheet.getRow(1);
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF24211D' }
    };
    cell.font = {
      name: 'Calibri',
      size: 10,
      bold: true,
      color: { argb: 'FFFAF8F4' }
    };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = {
      bottom: { style: 'medium', color: { argb: 'FF9A783E' } }
    };
  });

  rows.forEach((rawRow, idx) => {
    const rowValues: Record<string, any> = {};
    for (const col of activeColumns) {
      const val = rawRow[col.key];
      if (col.type === 'currency' || col.type === 'number' || col.type === 'percent') {
        const num = Number(val);
        rowValues[col.key] = Number.isFinite(num) ? num : 0;
      } else if (col.type === 'date') {
        const iso = extractIsoDate(val);
        rowValues[col.key] = iso ? new Date(`${iso}T00:00:00Z`) : sanitizeSpreadsheetString(val);
      } else {
        rowValues[col.key] = sanitizeSpreadsheetString(val);
      }
    }
    const added = detailSheet.addRow(rowValues);
    added.height = 19;

    activeColumns.forEach((col, cIdx) => {
      const cell = added.getCell(cIdx + 1);
      if (col.type === 'currency') {
        cell.numFmt = '"₹"#,##0.00;-"₹"#,##0.00;"₹"0.00';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else if (col.type === 'number') {
        cell.numFmt = Number.isInteger(cell.value) ? '#,##0' : '#,##0.00';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else if (col.type === 'percent') {
        cell.numFmt = '0.00%';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else if (col.type === 'date' && cell.value instanceof Date) {
        cell.numFmt = 'yyyy-mm-dd';
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }

      if (idx % 2 === 1) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFAF8F4' }
        };
      }
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE8E2D9' } }
      };
    });
  });

  const lastDataRow = rows.length + 1;
  const lastColLetter = excelColLetter(activeColumns.length);

  // Auto-filter across header and data rows
  detailSheet.autoFilter = {
    from: 'A1',
    to: `${lastColLetter}${Math.max(1, lastDataRow)}`
  };

  // Totals row with native Excel SUM formulas
  if (rows.length > 0) {
    const totalRowIndex = lastDataRow + 1;
    const totalRow = detailSheet.getRow(totalRowIndex);
    totalRow.height = 22;

    activeColumns.forEach((col, idx) => {
      const colNum = idx + 1;
      const colLet = excelColLetter(colNum);
      const cell = totalRow.getCell(colNum);
      if (idx === 0) {
        cell.value = 'TOTAL / SUMMARY';
        cell.font = { bold: true, color: { argb: 'FF24211D' } };
      } else if (col.summable || col.type === 'currency') {
        const sumTotal = Math.round(rows.reduce((s, r) => s + (Number(r[col.key]) || 0), 0) * 100) / 100;
        cell.value = {
          formula: `SUM(${colLet}2:${colLet}${lastDataRow})`,
          result: sumTotal
        };
        cell.numFmt = col.type === 'currency' ? '"₹"#,##0.00;-"₹"#,##0.00;"₹"0.00' : '#,##0.00';
        cell.font = { bold: true, color: { argb: 'FF24211D' } };
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3EFE7' }
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF9A783E' } },
        bottom: { style: 'double', color: { argb: 'FF24211D' } }
      };
    });
  }

  // 2. Populate Executive Summary Sheet with Official FRAGMORÉ Branding & Live Formulas
  summarySheet.columns = [
    { key: 'label', width: 34 },
    { key: 'val', width: 42 },
    { key: 'avg', width: 26 }
  ];

  const brandRow = summarySheet.addRow(['FRAGMORÉ — HAUTE PARFUMERIE BUSINESS OS', '', '']);
  brandRow.height = 28;
  brandRow.getCell(1).font = { name: 'Georgia', size: 15, bold: true, color: { argb: 'FF24211D' } };

  const titleText = sanitizeSpreadsheetString(filters.customTitle || meta.title);
  const repRow = summarySheet.addRow([titleText, '', '']);
  repRow.getCell(1).font = { name: 'Georgia', size: 12, bold: true, color: { argb: 'FF9A783E' } };

  summarySheet.addRow([]);
  const metaEntries: Array<[string, string]> = [
    ['Document Number', docNumber],
    ['Legal Entity', org.legalName || 'FRAGMORÉ HAUTE PARFUMERIE PRIVATE LIMITED'],
    ['GSTIN / State Code', `${org.gstin || '27AABCF9182K1Z4'} (${org.stateCode || '27'} - ${org.stateName || 'Maharashtra'})`],
    ['Registered Address', org.registeredAddress || 'Atelier 402, Ballard Estate, Mumbai 400001'],
    ['Generated Timestamp (UTC)', new Date().toISOString()],
    ['Requested By', `${actor.email} (${actor.roleCode})`],
    [
      'Applied Filters',
      sanitizeSpreadsheetString(
        `Date: ${filters.dateFrom || 'Start'} to ${filters.dateTo || 'Present'} | Status: ${filters.statusFilter || 'ALL'} | Search: ${filters.searchQuery || 'None'}`
      )
    ]
  ];

  for (const [k, v] of metaEntries) {
    const r = summarySheet.addRow([k, v]);
    r.getCell(1).font = { bold: true, color: { argb: 'FF686158' } };
    r.getCell(2).font = { color: { argb: 'FF24211D' } };
  }

  summarySheet.addRow([]);
  const kpiHeader = summarySheet.addRow(['KPI / Metric', 'Formula / Total Value', 'Average per Record']);
  kpiHeader.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF24211D' } };
    c.font = { bold: true, color: { argb: 'FFFAF8F4' } };
  });

  const countRow = summarySheet.addRow([
    'Total Exported Records',
    rows.length > 0
      ? { formula: `COUNTA('Detailed Ledger'!A2:A${lastDataRow})`, result: rows.length }
      : 0,
    ''
  ]);
  countRow.getCell(2).numFmt = '#,##0';

  activeColumns.forEach((col, idx) => {
    if (col.summable || col.type === 'currency') {
      const colLet = excelColLetter(idx + 1);
      const sumVal = Math.round(rows.reduce((s, r) => s + (Number(r[col.key]) || 0), 0) * 100) / 100;
      const avgVal = rows.length > 0 ? Math.round((sumVal / rows.length) * 100) / 100 : 0;
      const r = summarySheet.addRow([
        `Total ${col.label}`,
        rows.length > 0
          ? { formula: `SUM('Detailed Ledger'!${colLet}2:${colLet}${lastDataRow})`, result: sumVal }
          : 0,
        rows.length > 0
          ? { formula: `IFERROR(AVERAGE('Detailed Ledger'!${colLet}2:${colLet}${lastDataRow}),0)`, result: avgVal }
          : 0
      ]);
      const fmt = col.type === 'currency' ? '"₹"#,##0.00;-"₹"#,##0.00;"₹"0.00' : '#,##0.00';
      r.getCell(2).numFmt = fmt;
      r.getCell(3).numFmt = fmt;
    }
  });

  if (meta.requiresAuthorizedSignature) {
    summarySheet.addRow([]);
    summarySheet.addRow(['Authorized Signatory', `For ${org.legalName || 'FRAGMORÉ HAUTE PARFUMERIE PRIVATE LIMITED'}`]);
    summarySheet.addRow(['Verification Seal', 'Digitally Authenticated via FRAGMORÉ Business OS']);
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Generates an official FRAGMORÉ branded multi-page PDF document with vector monogram logo,
 * legal/GST header, repeating table headers, formatted figures, signatory block, and "Page X of Y" footers.
 */
async function buildBrandedPdfBuffer(params: {
  docNumber: string;
  meta: ReportCategoryMeta;
  org: any;
  actor: ErpActorContext;
  filters: ReportFilterInput;
  activeColumns: ReportColumnDef[];
  rows: Array<Record<string, any>>;
}): Promise<Buffer> {
  const { docNumber, meta, org, actor, filters, activeColumns, rows } = params;
  const isLandscape = activeColumns.length > 6;
  const { default: PDFDocument } = await import('pdfkit');

  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        layout: isLandscape ? 'landscape' : 'portrait',
        margins: { top: 42, bottom: 48, left: 38, right: 38 },
        bufferPages: true,
        info: {
          Title: toPdfSafeText(filters.customTitle || meta.title),
          Author: 'FRAGMORE Business OS',
          Subject: docNumber
        }
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const marginLeft = 38;
      const marginRight = 38;
      const usableWidth = pageWidth - marginLeft - marginRight;

      // Official FRAGMORÉ Header Banner + Vector Crest
      const drawOfficialBrandHeader = (isContinuationPage: boolean) => {
        const startY = 36;
        // Vector Flacon / Diamond Monogram Crest
        doc.save();
        doc
          .polygon([marginLeft + 14, startY], [marginLeft + 28, startY + 14], [marginLeft + 14, startY + 28], [marginLeft, startY + 14])
          .lineWidth(1.2)
          .strokeColor('#9A783E')
          .stroke();
        doc
          .font('Times-Bold')
          .fontSize(11)
          .fillColor('#24211D')
          .text('F', marginLeft + 10.5, startY + 8.5, { lineBreak: false });
        doc.restore();

        // Brand Wordmark & Legal Entity
        doc
          .font('Times-Bold')
          .fontSize(16)
          .fillColor('#24211D')
          .text('FRAGMORÉ', marginLeft + 36, startY, { characterSpacing: 2, lineBreak: false });
        doc
          .font('Helvetica')
          .fontSize(7.5)
          .fillColor('#686158')
          .text(
            toPdfSafeText(org.legalName || 'FRAGMORE HAUTE PARFUMERIE PRIVATE LIMITED'),
            marginLeft + 36,
            startY + 18,
            { lineBreak: false }
          );

        if (!isContinuationPage) {
          doc
            .font('Helvetica')
            .fontSize(7.5)
            .fillColor('#686158')
            .text(
              toPdfSafeText(
                `${org.registeredAddress || 'Mumbai, Maharashtra'} | Email: ${org.contactEmail || 'concierge@fragmore.shop'}`
              ),
              marginLeft + 36,
              startY + 28,
              { width: usableWidth * 0.58 }
            );
        }

        // Right-aligned Document Metadata & Tax Block
        const metaBoxX = pageWidth - marginRight - 220;
        doc
          .font('Helvetica-Bold')
          .fontSize(8)
          .fillColor('#9A783E')
          .text(`DOC NO: ${toPdfSafeText(docNumber)}`, metaBoxX, startY, { width: 220, align: 'right' });
        doc
          .font('Helvetica')
          .fontSize(7.5)
          .fillColor('#24211D')
          .text(`Date: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`, metaBoxX, startY + 11, {
            width: 220,
            align: 'right'
          });
        doc
          .font('Helvetica')
          .fontSize(7.5)
          .fillColor('#686158')
          .text(
            toPdfSafeText(`GSTIN: ${org.gstin || '27AABCF9182K1Z4'} | State: ${org.stateCode || '27'}`),
            metaBoxX,
            startY + 22,
            { width: 220, align: 'right' }
          );

        const dividerY = isContinuationPage ? startY + 34 : startY + 46;
        doc
          .moveTo(marginLeft, dividerY)
          .lineTo(pageWidth - marginRight, dividerY)
          .lineWidth(0.8)
          .strokeColor('#9A783E')
          .stroke();

        if (isContinuationPage) {
          doc
            .font('Times-Bold')
            .fontSize(10)
            .fillColor('#24211D')
            .text(toPdfSafeText(`${filters.customTitle || meta.title} (Continued)`), marginLeft, dividerY + 6);
          return dividerY + 24;
        }

        // Report Title & Filter Summary Strip
        doc
          .font('Times-Bold')
          .fontSize(13)
          .fillColor('#24211D')
          .text(toPdfSafeText(filters.customTitle || meta.title), marginLeft, dividerY + 8);
        doc
          .font('Helvetica')
          .fontSize(7.5)
          .fillColor('#686158')
          .text(
            toPdfSafeText(
              `Prepared for: ${actor.email} (${actor.roleCode}) | Records: ${rows.length} | Currency: INR | Period: ${filters.dateFrom || 'All'} to ${filters.dateTo || 'Current'} | Filter: ${filters.statusFilter || 'ALL'}`
            ),
            marginLeft,
            dividerY + 25,
            { width: usableWidth }
          );

        return dividerY + 42;
      };

      // Proportional Column Widths
      const totalRelativeWeight = activeColumns.reduce((s, c) => s + (c.width || 18), 0);
      const colWidths = activeColumns.map((c) => ((c.width || 18) / totalRelativeWeight) * usableWidth);

      const drawTableHeader = (yPos: number): number => {
        const h = 20;
        doc.rect(marginLeft, yPos, usableWidth, h).fill('#24211D');
        let curX = marginLeft;
        activeColumns.forEach((col, i) => {
          const w = colWidths[i];
          const align = col.type === 'currency' || col.type === 'number' || col.type === 'percent' ? 'right' : 'left';
          doc
            .font('Helvetica-Bold')
            .fontSize(7)
            .fillColor('#FAF8F4')
            .text(toPdfSafeText(col.label).toUpperCase(), curX + 4, yPos + 6, {
              width: w - 8,
              align,
              lineBreak: false,
              ellipsis: true
            });
          curX += w;
        });
        return yPos + h;
      };

      const formatPdfCell = (val: any, col: ReportColumnDef): string => {
        if (val === null || val === undefined || val === '') return '-';
        if (col.type === 'currency') {
          const n = Number(val);
          return Number.isFinite(n)
            ? `INR ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : '-';
        }
        if (col.type === 'number') {
          const n = Number(val);
          return Number.isFinite(n) ? n.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : toPdfSafeText(val);
        }
        if (col.type === 'percent') {
          const n = Number(val);
          return Number.isFinite(n) ? `${n.toFixed(2)}%` : toPdfSafeText(val);
        }
        if (col.type === 'date') {
          return extractIsoDate(val) || toPdfSafeText(val);
        }
        return toPdfSafeText(val);
      };

      let cursorY = drawOfficialBrandHeader(false);
      cursorY = drawTableHeader(cursorY);

      const bottomSafeLimit = pageHeight - 66;

      if (rows.length === 0) {
        doc
          .rect(marginLeft, cursorY, usableWidth, 28)
          .fill('#FAF8F4');
        doc
          .font('Helvetica-Oblique')
          .fontSize(8.5)
          .fillColor('#686158')
          .text('No matching records found for the selected filter criteria.', marginLeft + 10, cursorY + 9);
        cursorY += 34;
      } else {
        rows.forEach((row, rIdx) => {
          const rowHeight = 18;
          if (cursorY + rowHeight > bottomSafeLimit) {
            doc.addPage();
            cursorY = drawOfficialBrandHeader(true);
            cursorY = drawTableHeader(cursorY);
          }

          if (rIdx % 2 === 1) {
            doc.rect(marginLeft, cursorY, usableWidth, rowHeight).fill('#FAF8F4');
          }

          let curX = marginLeft;
          activeColumns.forEach((col, cIdx) => {
            const w = colWidths[cIdx];
            const align = col.type === 'currency' || col.type === 'number' || col.type === 'percent' ? 'right' : 'left';
            const formatted = formatPdfCell(row[col.key], col);
            doc
              .font('Helvetica')
              .fontSize(7)
              .fillColor('#24211D')
              .text(formatted, curX + 4, cursorY + 5, {
                width: w - 8,
                align,
                lineBreak: false,
                ellipsis: true
              });
            curX += w;
          });

          doc
            .moveTo(marginLeft, cursorY + rowHeight)
            .lineTo(pageWidth - marginRight, cursorY + rowHeight)
            .lineWidth(0.3)
            .strokeColor('#DED7CC')
            .stroke();

          cursorY += rowHeight;
        });

        // Summary Totals Strip
        const hasSummable = activeColumns.some((c) => c.summable || c.type === 'currency');
        if (hasSummable) {
          if (cursorY + 24 > bottomSafeLimit) {
            doc.addPage();
            cursorY = drawOfficialBrandHeader(true);
          }
          doc.rect(marginLeft, cursorY, usableWidth, 20).fill('#F3EFE7');
          let curX = marginLeft;
          activeColumns.forEach((col, cIdx) => {
            const w = colWidths[cIdx];
            if (cIdx === 0) {
              doc
                .font('Helvetica-Bold')
                .fontSize(7.2)
                .fillColor('#24211D')
                .text('TOTALS', curX + 4, cursorY + 6, { width: w - 8, align: 'left', lineBreak: false });
            } else if (col.summable || col.type === 'currency') {
              const sum = rows.reduce((acc, r) => acc + (Number(r[col.key]) || 0), 0);
              doc
                .font('Helvetica-Bold')
                .fontSize(7.2)
                .fillColor('#24211D')
                .text(formatPdfCell(sum, col), curX + 4, cursorY + 6, {
                  width: w - 8,
                  align: 'right',
                  lineBreak: false,
                  ellipsis: true
                });
            }
            curX += w;
          });
          cursorY += 26;
        }
      }

      // Authorized Signature Block where applicable
      if (meta.requiresAuthorizedSignature) {
        if (cursorY + 65 > bottomSafeLimit) {
          doc.addPage();
          cursorY = drawOfficialBrandHeader(true);
        }
        cursorY += 14;
        const sigBoxWidth = 220;
        const sigX = pageWidth - marginRight - sigBoxWidth;
        doc
          .font('Helvetica-Bold')
          .fontSize(8)
          .fillColor('#24211D')
          .text(
            toPdfSafeText(`For ${org.legalName || 'FRAGMORE HAUTE PARFUMERIE PRIVATE LIMITED'}`),
            sigX,
            cursorY,
            { width: sigBoxWidth, align: 'right' }
          );
        doc
          .moveTo(sigX + 40, cursorY + 34)
          .lineTo(pageWidth - marginRight, cursorY + 34)
          .lineWidth(0.6)
          .strokeColor('#24211D')
          .stroke();
        doc
          .font('Helvetica')
          .fontSize(7.5)
          .fillColor('#686158')
          .text('Authorized Signatory & Company Seal', sigX, cursorY + 38, { width: sigBoxWidth, align: 'right' });
      }

      // Second Pass: Add Page X of Y Footers across all buffered pages
      const range = doc.bufferedPageRange();
      const totalPages = range.count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(range.start + i);
        const footerY = doc.page.height - 32;
        doc
          .moveTo(marginLeft, footerY - 6)
          .lineTo(pageWidth - marginRight, footerY - 6)
          .lineWidth(0.4)
          .strokeColor('#DED7CC')
          .stroke();
        doc
          .font('Helvetica')
          .fontSize(7)
          .fillColor('#686158')
          .text(
            toPdfSafeText(`FRAGMORE Business OS | Official Document ${docNumber} | Confidential`),
            marginLeft,
            footerY,
            { width: usableWidth * 0.65, align: 'left', lineBreak: false }
          );
        doc
          .font('Helvetica-Bold')
          .fontSize(7)
          .fillColor('#24211D')
          .text(`Page ${i + 1} of ${totalPages}`, pageWidth - marginRight - 120, footerY, {
            width: 120,
            align: 'right',
            lineBreak: false
          });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

async function executeExportJobGeneration(
  jobId: string,
  actor: ErpActorContext,
  meta: ReportCategoryMeta,
  format: 'XLSX' | 'PDF',
  filters: ReportFilterInput,
  preloadedRawRows?: Array<Record<string, any>>
) {
  ensureExportDir();
  try {
    await db
      .update(erpExportJobs)
      .set({ status: 'PROCESSING', errorMessage: null })
      .where(eq(erpExportJobs.id, jobId));

    const [jobRows, orgRows] = await Promise.all([
      db.select().from(erpExportJobs).where(eq(erpExportJobs.id, jobId)),
      db.select().from(erpOrganizations).where(eq(erpOrganizations.id, ORG_ID))
    ]);
    const job = jobRows[0];
    if (!job) throw new NotFoundError('Export job record missing.');
    const org = orgRows[0] || {};

    const rawRows = preloadedRawRows
      ? preloadedRawRows
      : meta.reportKey === 'custom_table' && Array.isArray(filters.customRows)
      ? filters.customRows
      : await fetchDatasetForReport(actor, meta.reportKey);

    const { rows, activeColumns } = applyServerReportFilters(rawRows, meta.columns, filters);

    const ext = format === 'XLSX' ? 'xlsx' : 'pdf';
    const mimeType =
      format === 'XLSX'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/pdf';
    const safeSlug = meta.reportKey.replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
    const dateStamp = new Date().toISOString().slice(0, 10);
    const fileName = `fragmore-${safeSlug}-${dateStamp}-${job.jobNumber.toLowerCase()}.${ext}`;
    const storagePath = path.join(EXPORT_DIR, `${job.id}.${ext}`);

    const buffer =
      format === 'XLSX'
        ? await buildGenuineXlsxBuffer({
            docNumber: job.jobNumber,
            meta,
            org,
            actor,
            filters,
            activeColumns,
            rows
          })
        : await buildBrandedPdfBuffer({
            docNumber: job.jobNumber,
            meta,
            org,
            actor,
            filters,
            activeColumns,
            rows
          });

    if (!buffer || buffer.length === 0) {
      throw new Error('Generated document buffer was empty.');
    }

    fs.writeFileSync(storagePath, buffer, { mode: 0o600 });
    const stat = fs.statSync(storagePath);
    if (!stat.isFile() || stat.size === 0) {
      throw new Error('Export file verification failed on server temporary storage.');
    }

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes expiring download link
    const rawToken = deriveSignedDownloadToken(job.id, expiresAt.toISOString());
    const tokenHash = sha256Hex(rawToken);

    // Keep bounded customRows (<=1000) for custom_table so Retry Export works seamlessly
    const storedFilters = { ...filters };
    if (meta.reportKey === 'custom_table' && Array.isArray(filters.customRows)) {
      storedFilters.customRows = filters.customRows.slice(0, 1000);
      storedFilters.customColumns = meta.columns;
    } else {
      delete storedFilters.customRows;
    }

    const [completed] = await db
      .update(erpExportJobs)
      .set({
        filters: storedFilters,
        rowCount: rows.length,
        fileName,
        mimeType,
        fileSizeBytes: stat.size,
        storagePath,
        downloadTokenHash: tokenHash,
        expiresAt,
        status: 'COMPLETED',
        errorMessage: null,
        completedAt: new Date()
      })
      .where(eq(erpExportJobs.id, job.id))
      .returning();

    await recordErpAuditLog(db, {
      action: 'ERP_REPORT_EXPORTED',
      entity: 'erp_export_jobs',
      entityId: job.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Exported ${meta.reportKey} (${format}, ${rows.length} rows, ${stat.size} bytes) | Filters: ${JSON.stringify(storedFilters)}`
    });

    broadcastCrossBrowserSyncEvent({
      type: 'STATE_INVALIDATED',
      entity: 'erp_export_jobs',
      summary: `Export ${job.jobNumber} (${format}) ready for ${actor.email}`
    });

    return {
      job: serializeJobForClient(completed, actor),
      downloadUrl: `/api/erp/exports/download/${completed.id}?token=${rawToken}`
    };
  } catch (err: any) {
    await db
      .update(erpExportJobs)
      .set({
        status: 'FAILED',
        errorMessage: err?.message || 'Document generation failed.'
      })
      .where(eq(erpExportJobs.id, jobId));
    throw err;
  }
}

function serializeJobForClient(job: any, actor: ErpActorContext) {
  const canDownload =
    job.status === 'COMPLETED' &&
    job.expiresAt &&
    new Date(job.expiresAt).getTime() > Date.now() &&
    (actor.isSuperAdmin || job.requestedByEmail?.toLowerCase() === actor.email.toLowerCase());

  const token =
    canDownload && job.expiresAt
      ? deriveSignedDownloadToken(job.id, new Date(job.expiresAt).toISOString())
      : null;

  return {
    id: job.id,
    jobNumber: job.jobNumber,
    reportKey: job.reportKey,
    reportTitle: job.reportTitle,
    moduleKey: job.moduleKey,
    format: job.format,
    executionMode: job.executionMode,
    filters: job.filters,
    rowCount: job.rowCount,
    fileName: job.fileName,
    mimeType: job.mimeType,
    fileSizeBytes: job.fileSizeBytes,
    expiresAt: job.expiresAt,
    isExpired: job.expiresAt ? new Date(job.expiresAt).getTime() <= Date.now() : false,
    downloadCount: job.downloadCount,
    status: job.status,
    errorMessage: job.errorMessage,
    retryCount: job.retryCount,
    requestedByEmail: job.requestedByEmail,
    requestedByRole: job.requestedByRole,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
    downloadUrl: token ? `/api/erp/exports/download/${job.id}?token=${token}` : null
  };
}

export async function createExportJob(
  actor: ErpActorContext,
  payload: {
    reportKey: string;
    format: 'XLSX' | 'PDF';
    asyncMode?: boolean;
    filters?: ReportFilterInput;
  }
) {
  await ensureErpSeeded();
  const format = String(payload.format || 'XLSX').toUpperCase() === 'PDF' ? 'PDF' : 'XLSX';
  const filters = payload.filters || {};
  const meta = resolveReportDefinition(payload.reportKey, filters);

  // Enforce strict RBAC + sensitivity guard BEFORE queuing or generating
  assertReportExportAccess(actor, meta);

  const jobId = makeId('exp');
  const jobNumber = await getNextSequence(db, 'DOC-EXP');
  const preloadedRows = payload.asyncMode
    ? undefined
    : meta.reportKey === 'custom_table' && Array.isArray(filters.customRows)
    ? filters.customRows
    : await fetchDatasetForReport(actor, meta.reportKey);
  const estimatedCount = preloadedRows
    ? preloadedRows.length
    : Array.isArray(filters.customRows)
    ? filters.customRows.length
    : 0;
  const runAsync = Boolean(payload.asyncMode || estimatedCount > 250);

  const storedFilters = { ...filters };
  if (meta.reportKey === 'custom_table' && Array.isArray(filters.customRows)) {
    storedFilters.customRows = filters.customRows.slice(0, 1000);
    storedFilters.customColumns = meta.columns;
  } else {
    delete storedFilters.customRows;
  }

  const [created] = await db
    .insert(erpExportJobs)
    .values({
      id: jobId,
      organizationId: ORG_ID,
      jobNumber,
      reportKey: meta.reportKey,
      reportTitle: filters.customTitle || meta.title,
      moduleKey: meta.moduleKey,
      format,
      executionMode: runAsync ? 'ASYNC_JOB' : 'SYNC',
      filters: storedFilters,
      rowCount: 0,
      status: 'QUEUED',
      requestedByEmail: actor.email,
      requestedByRole: actor.roleCode
    })
    .returning();

  if (runAsync) {
    setImmediate(() => {
      executeExportJobGeneration(jobId, actor, meta, format, filters, preloadedRows).catch((err) => {
        console.error(`[Async Export Job ${jobNumber} Failed]:`, err?.message);
      });
    });

    return {
      queued: true,
      job: serializeJobForClient(created, actor),
      downloadUrl: null
    };
  }

  const completedResult = await executeExportJobGeneration(jobId, actor, meta, format, filters, preloadedRows);
  return {
    queued: false,
    ...completedResult
  };
}

export async function retryExportJob(actor: ErpActorContext, jobId: string) {
  const rows = await db.select().from(erpExportJobs).where(eq(erpExportJobs.id, jobId));
  if (!rows.length) throw new NotFoundError('Export job not found.');
  const job = rows[0];

  if (!actor.isSuperAdmin && job.requestedByEmail.toLowerCase() !== actor.email.toLowerCase()) {
    throw new ForbiddenError('Only the requesting user or Super Admin can retry this export job.');
  }

  const filters = (job.filters as ReportFilterInput) || {};
  const meta = resolveReportDefinition(job.reportKey, filters);
  assertReportExportAccess(actor, meta);

  await db
    .update(erpExportJobs)
    .set({
      retryCount: Number(job.retryCount || 0) + 1,
      status: 'QUEUED',
      errorMessage: null
    })
    .where(eq(erpExportJobs.id, jobId));

  return executeExportJobGeneration(jobId, actor, meta, job.format as 'XLSX' | 'PDF', filters);
}

export async function listExportJobs(actor: ErpActorContext) {
  await ensureErpSeeded();
  const all = await db.select().from(erpExportJobs).orderBy(desc(erpExportJobs.createdAt)).limit(60);
  const visible = actor.isSuperAdmin || actor.roleCode === 'FINANCE_CONTROLLER'
    ? all
    : all.filter((j) => j.requestedByEmail.toLowerCase() === actor.email.toLowerCase());
  return visible.map((j) => serializeJobForClient(j, actor));
}

export async function getExportJobById(actor: ErpActorContext, jobId: string) {
  const rows = await db.select().from(erpExportJobs).where(eq(erpExportJobs.id, jobId));
  if (!rows.length) throw new NotFoundError('Export job not found.');
  const job = rows[0];
  if (!actor.isSuperAdmin && job.requestedByEmail.toLowerCase() !== actor.email.toLowerCase()) {
    throw new ForbiddenError('Access denied to export job status.');
  }
  return serializeJobForClient(job, actor);
}

export async function verifyAndReadExportDownload(
  actor: ErpActorContext,
  jobId: string,
  token: string
): Promise<{ fileName: string; mimeType: string; storagePath: string; sizeBytes: number }> {
  if (!token) throw new ForbiddenError('Missing signed download token.');
  const rows = await db.select().from(erpExportJobs).where(eq(erpExportJobs.id, jobId));
  if (!rows.length) throw new NotFoundError('Export job not found.');
  const job = rows[0];

  if (job.status !== 'COMPLETED') {
    throw new ValidationError(`Export job ${job.jobNumber} is currently ${job.status}.`);
  }
  if (!job.expiresAt || new Date(job.expiresAt).getTime() <= Date.now()) {
    throw new ForbiddenError('Download link has expired. Please regenerate or retry the export.');
  }
  if (!job.downloadTokenHash || sha256Hex(token) !== job.downloadTokenHash) {
    throw new ForbiddenError('Invalid download signature token.');
  }
  if (!actor.isSuperAdmin && job.requestedByEmail.toLowerCase() !== actor.email.toLowerCase()) {
    const meta = resolveReportDefinition(job.reportKey, (job.filters as any) || {});
    assertReportExportAccess(actor, meta);
  }
  if (!job.storagePath || !fs.existsSync(job.storagePath)) {
    throw new NotFoundError('Temporary export file is no longer present on server storage. Click Retry to regenerate.');
  }
  const stat = fs.statSync(job.storagePath);
  if (!stat.isFile() || stat.size === 0) {
    throw new NotFoundError('Export file on server storage is empty.');
  }

  await db
    .update(erpExportJobs)
    .set({ downloadCount: Number(job.downloadCount || 0) + 1 })
    .where(eq(erpExportJobs.id, jobId));

  return {
    fileName: job.fileName || `fragmore-export.${job.format.toLowerCase()}`,
    mimeType: job.mimeType || 'application/octet-stream',
    storagePath: job.storagePath,
    sizeBytes: stat.size
  };
}
