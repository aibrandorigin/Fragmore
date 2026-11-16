import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { db } from '../db/index.ts';
import {
  erpOrganizations,
  erpDepartments,
  erpRoles,
  erpPermissions,
  erpUserAccess,
  erpWarehouses,
  erpMaterials,
  erpGoodsReceipts,
  erpStockLots,
  erpFormulations,
  erpFormulationVersions,
  erpSamples,
  erpQcRecords,
  erpFinishedGoods,
  erpLeads,
  erpProposals,
  erpQuotations,
  erpInvoices,
  erpCreditNotes,
  erpPayments,
  erpAccountingJournals,
  erpExpensesAndPettyCash,
  erpChartOfAccounts,
  erpMarketingWorkspace,
  erpEmployees,
  erpInterns,
  erpInternSubmissions,
  erpTasks,
  erpApprovals,
  erpAttachments,
  erpNotifications,
  erpSequences,
  erpPurchaseRequisitions,
  erpRfqs,
  erpVendorInvoices,
  erpDebitNotes,
  supplierPurchaseOrders,
  procurementSuppliers,
  productionBatches,
  inventoryLedger,
  products,
  customers,
  orders,
  campaigns,
  auditLogs,
  users
} from '../db/schema.ts';
import { eq, desc, sql, and, ilike, or } from 'drizzle-orm';

export const ORG_ID = 'org-fragmore-hq';

export const ERP_MODULE_KEYS = [
  'executive',
  'procurement',
  'materials',
  'formulations',
  'batches',
  'quality',
  'warehouse',
  'crm',
  'sales',
  'proposals',
  'gst_billing',
  'accounting',
  'marketing',
  'hr',
  'rbac',
  'reports',
  'assistant',
  'settings'
] as const;

export type ErpModuleKey = (typeof ERP_MODULE_KEYS)[number];
export type ErpActionKey = 'view' | 'create' | 'edit' | 'approve' | 'delete' | 'export';

export class ErpError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export class ConflictError extends ErpError {
  constructor(message = 'Optimistic concurrency conflict: record was modified by another user. Refresh and retry.') {
    super(409, 'CONFLICT', message);
  }
}

export class ForbiddenError extends ErpError {
  constructor(message = 'Forbidden: Your assigned role does not have permission for this ERP action.') {
    super(403, 'FORBIDDEN', message);
  }
}

export class ValidationError extends ErpError {
  constructor(message: string) {
    super(400, 'VALIDATION_ERROR', message);
  }
}

export class NotFoundError extends ErpError {
  constructor(message: string) {
    super(404, 'NOT_FOUND', message);
  }
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

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

// ============================================================================
// ATOMIC SEQUENTIAL NUMBERING & AUDIT LOGGING
// ============================================================================

export async function getNextSequence(tx: any, seqKey: string): Promise<string> {
  const existing = await tx.select().from(erpSequences).where(eq(erpSequences.seqKey, seqKey));
  if (!existing.length) {
    await tx
      .insert(erpSequences)
      .values({
        seqKey,
        prefix: `${seqKey}-${new Date().getFullYear()}-`,
        currentValue: 1010,
        padding: 4,
        updatedAt: new Date()
      })
      .onConflictDoNothing();
    return `${seqKey}-${new Date().getFullYear()}-1010`;
  }
  const [updated] = await tx
    .update(erpSequences)
    .set({
      currentValue: sql`${erpSequences.currentValue} + 1`,
      updatedAt: new Date()
    })
    .where(eq(erpSequences.seqKey, seqKey))
    .returning();
  const padded = String(updated.currentValue).padStart(updated.padding || 4, '0');
  return `${updated.prefix}${padded}`;
}

export async function recordErpAuditLog(
  txOrDb: any,
  params: {
    action: string;
    entity: string;
    entityId?: string;
    actorEmail: string;
    actorRole: string;
    details: string;
  }
) {
  await txOrDb.insert(auditLogs).values({
    id: makeId('aud'),
    action: params.action,
    adminEmail: params.actorEmail || 'system@fragmore.shop',
    details: params.details,
    metadata: {
      entity: params.entity,
      entityId: params.entityId || null,
      actorRole: params.actorRole,
      timestamp: new Date().toISOString()
    },
    createdAt: new Date()
  });
}

export async function createErpNotification(
  txOrDb: any,
  params: {
    recipientEmail?: string;
    departmentCode?: string;
    severity?: 'INFO' | 'WARNING' | 'CRITICAL';
    category: string;
    title: string;
    message: string;
    linkModule?: string;
    linkEntityId?: string;
  }
) {
  await txOrDb.insert(erpNotifications).values({
    id: makeId('ntf'),
    organizationId: ORG_ID,
    recipientEmail: params.recipientEmail || 'ALL_ADMINS',
    departmentCode: params.departmentCode || 'EXEC',
    severity: params.severity || 'INFO',
    category: params.category,
    title: params.title,
    message: params.message,
    linkModule: params.linkModule || null,
    linkEntityId: params.linkEntityId || null,
    isRead: false,
    createdAt: new Date()
  });
}

// ============================================================================
// IDEMPOTENT ERP BOOTSTRAP SEEDING (ZERO MUTATION TO EXISTING TABLES)
// ============================================================================

let erpSeedPromise: Promise<void> | null = null;

export async function ensureErpSeeded(): Promise<void> {
  if (erpSeedPromise) return erpSeedPromise;
  erpSeedPromise = (async () => {
    try {
      const existingOrg = await db.select().from(erpOrganizations).where(eq(erpOrganizations.id, ORG_ID));
      if (!existingOrg.length) {
        await db
          .insert(erpOrganizations)
          .values({
            id: ORG_ID,
            code: 'FRAGMORE-HQ',
            legalName: 'FRAGMORÉ HAUTE PARFUMERIE PRIVATE LIMITED',
            brandName: 'FRAGMORÉ',
            tagline: 'Scent That Stays With You.',
            websiteUrl: 'https://fragmore.shop/',
            gstin: '27AABCF9482M1Z8',
            pan: 'AABCF9482M',
            cin: 'U24246MH2024PTC419205',
            stateCode: '27',
            stateName: 'Maharashtra',
            city: 'Mumbai',
            registeredAddress: 'Suite 402, Atelier Chambers, Kala Ghoda, Fort, Mumbai, Maharashtra 400001',
            contactEmail: 'concierge@fragmore.shop',
            contactPhone: '+91 22 4890 2140',
            currency: 'INR',
            fiscalYearStartMonth: 4,
            defaultGstRatePct: 18,
            bankDetails: {
              bankName: 'HDFC Bank Private Wealth',
              accountName: 'FRAGMORE HAUTE PARFUMERIE PVT LTD',
              accountNumberMasked: 'XXXXXX8492',
              ifsc: 'HDFC0000060',
              branch: 'Fort Mumbai Main',
              upiId: 'fragmore.atelier@hdfcbank'
            },
            numberingPrefixes: {
              PO: 'PO-FRG-2026-',
              GRN: 'GRN-FRG-2026-',
              LOT: 'LOT-FRG-2026-',
              FRM: 'FRM-FRG-',
              BATCH: 'BATCH-FRG-2026-',
              SMP: 'SMP-FRG-2026-',
              QC: 'QC-FRG-2026-',
              FG: 'FG-BIN-',
              LEAD: 'LEAD-2026-',
              PROP: 'PROP-2026-',
              QT: 'QT-2026-',
              INV: 'INV-FRG-2627-',
              CN: 'CN-FRG-2627-',
              PAY: 'PAY-2026-',
              JRN: 'JRN-2026-',
              MKT: 'MKT-2026-',
              EMP: 'EMP-FRG-',
              INT: 'INT-FRG-',
              TSK: 'TSK-FRG-',
              APR: 'APR-FRG-'
            },
            status: 'ACTIVE',
            version: 1
          })
          .onConflictDoNothing();
      }

      // 1. Sequences
      const seqDefs = [
        { seqKey: 'PO', prefix: 'PO-FRG-2026-', currentValue: 1004, padding: 4 },
        { seqKey: 'GRN', prefix: 'GRN-FRG-2026-', currentValue: 1002, padding: 4 },
        { seqKey: 'LOT', prefix: 'LOT-FRG-2026-', currentValue: 1008, padding: 4 },
        { seqKey: 'FRM', prefix: 'FRM-FRG-', currentValue: 104, padding: 3 },
        { seqKey: 'BATCH', prefix: 'BATCH-FRG-2026-', currentValue: 1005, padding: 4 },
        { seqKey: 'SMP', prefix: 'SMP-FRG-2026-', currentValue: 1004, padding: 4 },
        { seqKey: 'QC', prefix: 'QC-FRG-2026-', currentValue: 1004, padding: 4 },
        { seqKey: 'LEAD', prefix: 'LEAD-2026-', currentValue: 1004, padding: 4 },
        { seqKey: 'PROP', prefix: 'PROP-2026-', currentValue: 1002, padding: 4 },
        { seqKey: 'QT', prefix: 'QT-2026-', currentValue: 1002, padding: 4 },
        { seqKey: 'INV', prefix: 'INV-FRG-2627-', currentValue: 1003, padding: 4 },
        { seqKey: 'CN', prefix: 'CN-FRG-2627-', currentValue: 1000, padding: 4 },
        { seqKey: 'PAY', prefix: 'PAY-2026-', currentValue: 1003, padding: 4 },
        { seqKey: 'JRN', prefix: 'JRN-2026-', currentValue: 1004, padding: 4 },
        { seqKey: 'MKT', prefix: 'MKT-2026-', currentValue: 1004, padding: 4 },
        { seqKey: 'EMP', prefix: 'EMP-FRG-', currentValue: 106, padding: 3 },
        { seqKey: 'INT', prefix: 'INT-FRG-', currentValue: 104, padding: 3 },
        { seqKey: 'TSK', prefix: 'TSK-FRG-', currentValue: 1006, padding: 4 },
        { seqKey: 'APR', prefix: 'APR-FRG-', currentValue: 1003, padding: 4 }
      ];
      for (const s of seqDefs) {
        await db.insert(erpSequences).values(s).onConflictDoNothing();
      }

      // 2. Departments
      const depts = [
        { id: 'dept-exec', code: 'EXEC', name: 'Executive & Governance', costCenterCode: 'CC-100', headEmail: 'aibrandorigin@gmail.com', description: 'Founder suite, governance & cross-department oversight' },
        { id: 'dept-proc', code: 'PROC', name: 'Procurement & Vendor Sourcing', costCenterCode: 'CC-210', headEmail: 'procurement@fragmore.shop', description: 'Raw aromatic oils, Italian flacons & supplier POs' },
        { id: 'dept-inv', code: 'INV', name: 'Materials & Warehouse Ops', costCenterCode: 'CC-220', headEmail: 'warehouse@fragmore.shop', description: 'Raw material FIFO lots & finished goods storage' },
        { id: 'dept-rd', code: 'RD', name: 'Olfactory Lab & Formulation', costCenterCode: 'CC-310', headEmail: 'perfumer@fragmore.shop', description: 'Extrait de Parfum composition, IFRA & maceration trials' },
        { id: 'dept-prod', code: 'PROD', name: 'Batch Production & Bottling', costCenterCode: 'CC-320', headEmail: 'production@fragmore.shop', description: 'Compounding, chill filtration & crimp bottling' },
        { id: 'dept-qc', code: 'QC', name: 'Quality Control & Assurance', costCenterCode: 'CC-330', headEmail: 'qc@fragmore.shop', description: 'GC-MS verification, clarity, stability & batch release' },
        { id: 'dept-crm', code: 'CRM', name: 'Sales, B2B & Concierge CRM', costCenterCode: 'CC-410', headEmail: 'sales@fragmore.shop', description: 'Connoisseur CRM, corporate gifting & quotations' },
        { id: 'dept-fin', code: 'FIN', name: 'Finance, GST & Accounting', costCenterCode: 'CC-510', headEmail: 'finance@fragmore.shop', description: 'GST billing, AR/AP, double-entry journals & P&L' },
        { id: 'dept-mkt', code: 'MKT', name: 'Digital Marketing Studio', costCenterCode: 'CC-610', headEmail: 'growth@fragmore.shop', description: 'Paid acquisition, creator seeding & campaign deliverables' },
        { id: 'dept-hr', code: 'HR', name: 'People, HR & Internships', costCenterCode: 'CC-710', headEmail: 'people@fragmore.shop', description: 'Employees, intern cohorts & cross-department tasks' }
      ];
      for (const d of depts) {
        await db
          .insert(erpDepartments)
          .values({ ...d, organizationId: ORG_ID })
          .onConflictDoNothing();
      }

      // 3. Roles + Full RBAC Permissions Matrix
      const rolesSeed = [
        { id: 'role-super-admin', code: 'SUPER_ADMIN', departmentId: 'dept-exec', name: 'Founder / Super Admin', hierarchyLevel: 100, isSystem: true, description: 'Full unrestricted access across all 18 Business OS modules & approvals' },
        { id: 'role-proc-lead', code: 'PROCUREMENT_LEAD', departmentId: 'dept-proc', name: 'Procurement & Supply Lead', hierarchyLevel: 70, isSystem: true, description: 'Manages suppliers, POs, GRNs and raw materials stock' },
        { id: 'role-formulator', code: 'FORMULATOR', departmentId: 'dept-rd', name: 'Master Perfumer / R&D', hierarchyLevel: 75, isSystem: true, description: 'Authors versioned formulas, lab trials & formulation approvals' },
        { id: 'role-prod-lead', code: 'PRODUCTION_LEAD', departmentId: 'dept-prod', name: 'Batch Production Lead', hierarchyLevel: 70, isSystem: true, description: 'Runs batch compounding, maceration & requests QC release' },
        { id: 'role-qc-analyst', code: 'QC_ANALYST', departmentId: 'dept-qc', name: 'QC Laboratory Analyst', hierarchyLevel: 75, isSystem: true, description: 'Evaluates samples, executes GC-MS QC inspections & quarantine holds' },
        { id: 'role-wh-mgr', code: 'WAREHOUSE_MANAGER', departmentId: 'dept-inv', name: 'Warehouse & Inventory Manager', hierarchyLevel: 70, isSystem: true, description: 'Manages warehouses, FIFO lots, finished goods & dispatch stock' },
        { id: 'role-fin-ctrl', code: 'FINANCE_CONTROLLER', departmentId: 'dept-fin', name: 'Finance & GST Controller', hierarchyLevel: 85, isSystem: true, description: 'Manages GST invoices, credit notes, payments & double-entry journals' },
        { id: 'role-sales-crm', code: 'SALES_CRM', departmentId: 'dept-crm', name: 'Sales, B2B & Order Ops', hierarchyLevel: 65, isSystem: true, description: 'Manages CRM leads, corporate proposals, quotations & sales orders' },
        { id: 'role-mkt-agency', code: 'MARKETING_AGENCY', departmentId: 'dept-mkt', name: 'Digital Marketing Strategist', hierarchyLevel: 60, isSystem: true, description: 'Manages agency workspace deliverables, campaigns & CRM read access' },
        { id: 'role-hr-mgr', code: 'HR_MANAGER', departmentId: 'dept-hr', name: 'HR & Cohort Manager', hierarchyLevel: 70, isSystem: true, description: 'Manages employees, interns, leaves, stipends & tasks' },
        { id: 'role-intern-viewer', code: 'INTERN_VIEWER', departmentId: 'dept-hr', name: 'Atelier Intern (Read-Only)', hierarchyLevel: 15, isSystem: true, description: 'Strictly read-only access to assigned R&D/Marketing views; mutations denied (403)' }
      ];
      for (const r of rolesSeed) {
        await db
          .insert(erpRoles)
          .values({ ...r, organizationId: ORG_ID })
          .onConflictDoNothing();
      }

      const existingPerms = await db.select().from(erpPermissions);
      if (!existingPerms.length) {
        const permPresets: Record<string, Partial<Record<ErpModuleKey, [boolean, boolean, boolean, boolean, boolean, boolean]>>> = {
          'role-super-admin': Object.fromEntries(
            ERP_MODULE_KEYS.map((m) => [m, [true, true, true, true, true, true]])
          ) as any,
          'role-proc-lead': {
            executive: [true, false, false, false, false, true],
            procurement: [true, true, true, true, false, true],
            materials: [true, true, true, false, false, true],
            warehouse: [true, true, true, false, false, true],
            quality: [true, true, false, false, false, false],
            reports: [true, false, false, false, false, true],
            assistant: [true, true, false, false, false, false]
          },
          'role-formulator': {
            executive: [true, false, false, false, false, false],
            materials: [true, false, false, false, false, true],
            formulations: [true, true, true, false, false, true],
            batches: [true, true, true, false, false, false],
            quality: [true, true, true, false, false, true],
            assistant: [true, true, false, false, false, false]
          },
          'role-prod-lead': {
            executive: [true, false, false, false, false, false],
            materials: [true, false, false, false, false, false],
            formulations: [true, false, false, false, false, false],
            batches: [true, true, true, false, false, true],
            quality: [true, true, false, false, false, false],
            warehouse: [true, true, true, false, false, false]
          },
          'role-qc-analyst': {
            executive: [true, false, false, false, false, false],
            materials: [true, false, false, false, false, false],
            formulations: [true, false, false, false, false, false],
            batches: [true, false, true, true, false, true],
            quality: [true, true, true, true, false, true],
            warehouse: [true, false, true, true, false, false]
          },
          'role-wh-mgr': {
            executive: [true, false, false, false, false, false],
            procurement: [true, true, false, false, false, true],
            materials: [true, true, true, false, false, true],
            batches: [true, false, false, false, false, false],
            warehouse: [true, true, true, true, false, true],
            sales: [true, false, true, false, false, true]
          },
          'role-fin-ctrl': {
            executive: [true, false, false, false, false, true],
            procurement: [true, false, false, true, false, true],
            sales: [true, false, true, false, false, true],
            proposals: [true, true, true, true, false, true],
            gst_billing: [true, true, true, true, false, true],
            accounting: [true, true, true, true, false, true],
            hr: [true, false, false, true, false, true],
            reports: [true, false, false, false, false, true],
            assistant: [true, true, false, false, false, false]
          },
          'role-sales-crm': {
            executive: [true, false, false, false, false, false],
            warehouse: [true, false, false, false, false, false],
            crm: [true, true, true, true, false, true],
            sales: [true, true, true, false, false, true],
            proposals: [true, true, true, false, false, true],
            gst_billing: [true, true, false, false, false, true],
            reports: [true, false, false, false, false, true]
          },
          'role-mkt-agency': {
            executive: [true, false, false, false, false, false],
            crm: [true, false, false, false, false, true],
            marketing: [true, true, true, true, false, true],
            reports: [true, false, false, false, false, true],
            assistant: [true, true, false, false, false, false]
          },
          'role-hr-mgr': {
            executive: [true, false, false, false, false, false],
            hr: [true, true, true, true, false, true],
            reports: [true, false, false, false, false, true]
          },
          'role-intern-viewer': {
            executive: [true, false, false, false, false, false],
            marketing: [true, true, false, false, false, false],
            hr: [true, true, true, false, false, false]
          }
        };

        const permRows: any[] = [];
        for (const role of rolesSeed) {
          const map = permPresets[role.id] || {};
          for (const mod of ERP_MODULE_KEYS) {
            const flags = map[mod] || [false, false, false, false, false, false];
            permRows.push({
              id: `perm-${role.id}-${mod}`,
              roleId: role.id,
              moduleKey: mod,
              canView: flags[0],
              canCreate: flags[1],
              canEdit: flags[2],
              canApprove: flags[3],
              canDelete: flags[4],
              canExport: flags[5]
            });
          }
        }
        await db.insert(erpPermissions).values(permRows).onConflictDoNothing();
      }

      // 4. User Access Bindings (Sync existing admin accounts + realistic department staff)
      const existingAdmins = await db.select().from(users);
      const accessSeeds = [
        { id: 'ua-founder-1', email: 'aibrandorigin@gmail.com', displayName: 'Harsha (Founder)', roleId: 'role-super-admin', departmentId: 'dept-exec' },
        { id: 'ua-founder-2', email: 'gowisherharsha@gmail.com', displayName: 'Harsha Vardhan', roleId: 'role-super-admin', departmentId: 'dept-exec' },
        { id: 'ua-founder-3', email: 'harsha@brandorigin.in', displayName: 'Harsha (Executive)', roleId: 'role-super-admin', departmentId: 'dept-exec' },
        { id: 'ua-admin-default', email: 'admin@fragmore.com', displayName: 'Fragmoré Admin', roleId: 'role-super-admin', departmentId: 'dept-exec' },
        { id: 'ua-perfumer', email: 'perfumer@fragmore.shop', displayName: 'Aarav Deshmukh (Master Perfumer)', roleId: 'role-formulator', departmentId: 'dept-rd' },
        { id: 'ua-finance', email: 'finance@fragmore.shop', displayName: 'Meera Kulkarni (CA / Controller)', roleId: 'role-fin-ctrl', departmentId: 'dept-fin' },
        { id: 'ua-qc', email: 'qc@fragmore.shop', displayName: 'Dr. Rohan Nair (QC Head)', roleId: 'role-qc-analyst', departmentId: 'dept-qc' },
        { id: 'ua-warehouse', email: 'warehouse@fragmore.shop', displayName: 'Vikram Singh (Warehouse Lead)', roleId: 'role-wh-mgr', departmentId: 'dept-inv' },
        { id: 'ua-sales', email: 'sales@fragmore.shop', displayName: 'Ananya Sharma (B2B Concierge)', roleId: 'role-sales-crm', departmentId: 'dept-crm' },
        { id: 'ua-mkt', email: 'growth@fragmore.shop', displayName: 'Kabir Mehta (Growth Studio)', roleId: 'role-mkt-agency', departmentId: 'dept-mkt' },
        { id: 'ua-intern', email: 'intern.riya@fragmore.shop', displayName: 'Riya Patel (R&D Intern)', roleId: 'role-intern-viewer', departmentId: 'dept-hr' }
      ];
      for (const a of accessSeeds) {
        const matchedUser = existingAdmins.find((u) => u.email.toLowerCase() === a.email.toLowerCase());
        await db
          .insert(erpUserAccess)
          .values({
            ...a,
            userUid: matchedUser?.uid || null,
            organizationId: ORG_ID,
            isActive: true
          })
          .onConflictDoNothing();
      }

      // 5. Warehouses
      const whSeeds = [
        { id: 'wh-mumbai-rm', code: 'WH-RM-MUM', name: 'Mumbai Cold Aromatic Vault', warehouseType: 'RAW_MATERIAL', city: 'Mumbai', state: 'Maharashtra', address: 'Unit 12, Industrial Estate, Lower Parel, Mumbai', capacityUnits: 25000, temperatureControlled: true, managerEmail: 'warehouse@fragmore.shop' },
        { id: 'wh-mumbai-pkg', code: 'WH-PKG-MUM', name: 'Bhiwandi Glass & Coffret Hub', warehouseType: 'PACKAGING', city: 'Thane', state: 'Maharashtra', address: 'Plot 8B, Logistics Park, Bhiwandi', capacityUnits: 120000, temperatureControlled: false, managerEmail: 'procurement@fragmore.shop' },
        { id: 'wh-atelier-wip', code: 'WH-WIP-LAB', name: 'Kala Ghoda Maceration Cellar', warehouseType: 'WIP_MACERATION', city: 'Mumbai', state: 'Maharashtra', address: 'Basement Vault, Atelier Chambers, Fort, Mumbai', capacityUnits: 15000, temperatureControlled: true, managerEmail: 'perfumer@fragmore.shop' },
        { id: 'wh-fg-main', code: 'WH-FG-MUM', name: 'Fragmoré Flagship Fulfillment Vault', warehouseType: 'FINISHED_GOODS', city: 'Mumbai', state: 'Maharashtra', address: 'Ground Wing, Fort Fulfillment Center, Mumbai', capacityUnits: 45000, temperatureControlled: true, managerEmail: 'warehouse@fragmore.shop' },
        { id: 'wh-quarantine', code: 'WH-QC-HOLD', name: 'QC Quarantine & Sample Hold Cage', warehouseType: 'QUARANTINE', city: 'Mumbai', state: 'Maharashtra', address: 'Bay 4, Lower Parel Lab Annex, Mumbai', capacityUnits: 5000, temperatureControlled: true, managerEmail: 'qc@fragmore.shop' }
      ];
      for (const w of whSeeds) {
        await db.insert(erpWarehouses).values({ ...w, organizationId: ORG_ID }).onConflictDoNothing();
      }

      // 6. Materials & Stock Lots
      const existingMats = await db.select().from(erpMaterials);
      if (!existingMats.length) {
        const matSeeds = [
          { id: 'mat-conc-gold', code: 'MAT-CONC-001', name: 'Golden Hour Extrait Concentrate (Grasse Reserve)', category: 'ESSENTIAL_OIL', uom: 'liters', hsnCode: '33029011', gstRatePct: 18, unitCostInr: 11800, currentStock: 36, reservedStock: 4, reorderLevel: 20, targetStock: 60, ifraMaxPct: 35, casNumber: '8008-57-9', defaultWarehouseId: 'wh-mumbai-rm', status: 'OPTIMAL' },
          { id: 'mat-conc-oud', code: 'MAT-CONC-002', name: 'Oblique Woods & Assam Oud Absolute', category: 'ABSOLUTE', uom: 'liters', hsnCode: '33012990', gstRatePct: 18, unitCostInr: 18400, currentStock: 18, reservedStock: 2, reorderLevel: 15, targetStock: 40, ifraMaxPct: 18, casNumber: '94350-09-1', defaultWarehouseId: 'wh-mumbai-rm', status: 'OPTIMAL' },
          { id: 'mat-conc-velvet', code: 'MAT-CONC-003', name: 'Velvet Nocturne Amber-Saffron Accord', category: 'AROMA_CHEMICAL', uom: 'liters', hsnCode: '33029012', gstRatePct: 18, unitCostInr: 14200, currentStock: 12, reservedStock: 0, reorderLevel: 15, targetStock: 45, ifraMaxPct: 28, casNumber: '6790-58-5', defaultWarehouseId: 'wh-mumbai-rm', status: 'LOW_STOCK' },
          { id: 'mat-solv-eth', code: 'MAT-SOLV-001', name: 'Organic Denatured Perfumery Ethanol (99.9%)', category: 'SOLVENT', uom: 'liters', hsnCode: '22072000', gstRatePct: 18, unitCostInr: 320, currentStock: 420, reservedStock: 40, reorderLevel: 150, targetStock: 600, ifraMaxPct: 90, casNumber: '64-17-5', defaultWarehouseId: 'wh-mumbai-rm', status: 'OPTIMAL' },
          { id: 'mat-flacon-50', code: 'PKG-FLC-050', name: '50ml Heavy Italian Crimp Crystal Flacon', category: 'GLASS_FLACON', uom: 'units', hsnCode: '70109000', gstRatePct: 18, unitCostInr: 185, currentStock: 480, reservedStock: 60, reorderLevel: 500, targetStock: 1500, defaultWarehouseId: 'wh-mumbai-pkg', status: 'LOW_STOCK' },
          { id: 'mat-flacon-15', code: 'PKG-FLC-015', name: '15ml Travel Atelier Glass Flacon', category: 'GLASS_FLACON', uom: 'units', hsnCode: '70109000', gstRatePct: 18, unitCostInr: 95, currentStock: 920, reservedStock: 0, reorderLevel: 400, targetStock: 1500, defaultWarehouseId: 'wh-mumbai-pkg', status: 'OPTIMAL' },
          { id: 'mat-vial-2', code: 'PKG-VIAL-002', name: '2ml Borosilicate Discovery Sample Vial', category: 'GLASS_FLACON', uom: 'units', hsnCode: '70109000', gstRatePct: 18, unitCostInr: 22, currentStock: 4200, reservedStock: 300, reorderLevel: 1500, targetStock: 6000, defaultWarehouseId: 'wh-mumbai-pkg', status: 'OPTIMAL' },
          { id: 'mat-cap-gold', code: 'PKG-CAP-GLD', name: 'Brushed Champagne Gold Magnetic Zamac Cap + FEA15 Pump', category: 'ATOMIZER_CAP', uom: 'units', hsnCode: '96161020', gstRatePct: 18, unitCostInr: 112, currentStock: 1150, reservedStock: 60, reorderLevel: 600, targetStock: 2000, defaultWarehouseId: 'wh-mumbai-pkg', status: 'OPTIMAL' },
          { id: 'mat-box-rig', code: 'PKG-BOX-RIG', name: 'Handcrafted Linen & Gold Foil Rigid Coffret', category: 'COFFRET_BOX', uom: 'units', hsnCode: '48192090', gstRatePct: 18, unitCostInr: 145, currentStock: 310, reservedStock: 40, reorderLevel: 400, targetStock: 1200, defaultWarehouseId: 'wh-mumbai-pkg', status: 'LOW_STOCK' }
        ];
        for (const m of matSeeds) {
          await db.insert(erpMaterials).values({ ...m, organizationId: ORG_ID }).onConflictDoNothing();
          await db
            .insert(erpStockLots)
            .values({
              id: `lot-${m.id}`,
              organizationId: ORG_ID,
              materialId: m.id,
              warehouseId: m.defaultWarehouseId,
              lotNumber: `LOT-2026-${m.code.slice(-3)}`,
              supplierBatchRef: `SUP-${m.code.slice(-3)}-A1`,
              receivedQty: m.currentStock,
              availableQty: m.currentStock - m.reservedStock,
              reservedQty: m.reservedStock,
              consumedQty: 0,
              unitCostInr: m.unitCostInr,
              receivedDate: addDaysIso(-22),
              expiryDate: addDaysIso(700),
              qcStatus: 'APPROVED',
              status: 'ACTIVE'
            })
            .onConflictDoNothing();
        }
      }

      // 7. Formulations & Versions
      const existingFormulas = await db.select().from(erpFormulations);
      if (!existingFormulas.length) {
        const fSeeds = [
          {
            id: 'frm-golden-hour',
            formulaCode: 'FRM-FRG-101',
            name: 'GOLDEN HOUR',
            fragranceFamily: 'Amber Citrus',
            productSlug: 'golden-hour',
            concentrationType: 'Extrait de Parfum 28%',
            targetOilPct: 28,
            macerationDays: 21,
            perfumerEmail: 'perfumer@fragmore.shop',
            activeVersionNumber: 2,
            status: 'APPROVED',
            notes: 'Signature warm champagne-gold citrus opening with labdanum amber drydown.',
            ingredients: [
              { materialId: 'mat-conc-gold', materialCode: 'MAT-CONC-001', materialName: 'Golden Hour Extrait Concentrate (Grasse Reserve)', notePyramid: 'HEART', percentage: 28, costPerKgInr: 11800 },
              { materialId: 'mat-solv-eth', materialCode: 'MAT-SOLV-001', materialName: 'Organic Denatured Perfumery Ethanol (99.9%)', notePyramid: 'SOLVENT', percentage: 72, costPerKgInr: 320 }
            ]
          },
          {
            id: 'frm-oblique-woods',
            formulaCode: 'FRM-FRG-102',
            name: 'OBLIQUE WOODS',
            fragranceFamily: 'Woody Oud',
            productSlug: 'oblique-woods',
            concentrationType: 'Extrait de Parfum 30%',
            targetOilPct: 30,
            macerationDays: 28,
            perfumerEmail: 'perfumer@fragmore.shop',
            activeVersionNumber: 1,
            status: 'APPROVED',
            notes: 'Deep Assam oud, Mysore sandalwood, and charred cedar extract.',
            ingredients: [
              { materialId: 'mat-conc-oud', materialCode: 'MAT-CONC-002', materialName: 'Oblique Woods & Assam Oud Absolute', notePyramid: 'BASE', percentage: 30, costPerKgInr: 18400 },
              { materialId: 'mat-solv-eth', materialCode: 'MAT-SOLV-001', materialName: 'Organic Denatured Perfumery Ethanol (99.9%)', notePyramid: 'SOLVENT', percentage: 70, costPerKgInr: 320 }
            ]
          },
          {
            id: 'frm-velvet-nocturne',
            formulaCode: 'FRM-FRG-103',
            name: 'VELVET NOCTURNE',
            fragranceFamily: 'Spicy Amber',
            productSlug: 'velvet-nocturne',
            concentrationType: 'Extrait de Parfum 26%',
            targetOilPct: 26,
            macerationDays: 21,
            perfumerEmail: 'perfumer@fragmore.shop',
            activeVersionNumber: 1,
            status: 'APPROVED',
            notes: 'Evening Kashmiri saffron, black cardamom and smoked vanilla resin.',
            ingredients: [
              { materialId: 'mat-conc-velvet', materialCode: 'MAT-CONC-003', materialName: 'Velvet Nocturne Amber-Saffron Accord', notePyramid: 'HEART', percentage: 26, costPerKgInr: 14200 },
              { materialId: 'mat-solv-eth', materialCode: 'MAT-SOLV-001', materialName: 'Organic Denatured Perfumery Ethanol (99.9%)', notePyramid: 'SOLVENT', percentage: 74, costPerKgInr: 320 }
            ]
          }
        ];

        for (const f of fSeeds) {
          const { ingredients, ...meta } = f;
          const costPerKg = round2(ingredients.reduce((s, ing) => s + (ing.percentage / 100) * ing.costPerKgInr, 0));
          const cost50ml = round2(costPerKg * 0.045);
          await db.insert(erpFormulations).values({ ...meta, organizationId: ORG_ID }).onConflictDoNothing();
          await db
            .insert(erpFormulationVersions)
            .values({
              id: `fver-${f.id}-v${f.activeVersionNumber}`,
              formulationId: f.id,
              versionNumber: f.activeVersionNumber,
              changeSummary: 'Production master IFRA-51 compliant formulation lock',
              ingredients,
              totalPercentage: 100,
              costPerKgInr: costPerKg,
              estimatedCostPer50mlInr: cost50ml,
              ifraComplianceStatus: 'COMPLIANT',
              stabilityNotes: 'Passed 14C cold-maceration & UV amber stability check.',
              createdByEmail: f.perfumerEmail,
              approvedByEmail: 'aibrandorigin@gmail.com',
              approvedAt: new Date(),
              status: 'APPROVED'
            })
            .onConflictDoNothing();
        }
      }

      // 8. Initial Samples & QC Records
      const existingSamples = await db.select().from(erpSamples);
      if (!existingSamples.length) {
        await db
          .insert(erpSamples)
          .values([
            {
              id: 'smp-001',
              organizationId: ORG_ID,
              formulationId: 'frm-golden-hour',
              formulationVersionId: 'fver-frm-golden-hour-v2',
              sampleNumber: 'SMP-FRG-2026-1001',
              sampleType: 'STABILITY_TEST',
              fragranceName: 'GOLDEN HOUR (Extrait 28%)',
              recipientName: 'Dr. Rohan Nair (Internal QC)',
              recipientEmail: 'qc@fragmore.shop',
              volumeMl: 15,
              olfactoryScore: 9.6,
              longevityHours: 11.5,
              evaluationNotes: 'Zero precipitation after 72h freeze-thaw cycle.',
              requestedByEmail: 'perfumer@fragmore.shop',
              status: 'APPROVED'
            },
            {
              id: 'smp-002',
              organizationId: ORG_ID,
              formulationId: 'frm-oblique-woods',
              formulationVersionId: 'fver-frm-oblique-woods-v1',
              sampleNumber: 'SMP-FRG-2026-1002',
              sampleType: 'CORPORATE_EVAL',
              fragranceName: 'OBLIQUE WOODS (Bespoke Coffret Eval)',
              recipientName: 'Taj Falaknuma Concierge Desk',
              recipientEmail: 'procurement@tajluxury.in',
              volumeMl: 10,
              olfactoryScore: 9.8,
              longevityHours: 14,
              evaluationNotes: 'Submitted for 250-unit festive VIP amenity curation.',
              requestedByEmail: 'sales@fragmore.shop',
              status: 'DISPATCHED'
            }
          ])
          .onConflictDoNothing();
      }

      const existingQc = await db.select().from(erpQcRecords);
      if (!existingQc.length) {
        await db
          .insert(erpQcRecords)
          .values([
            {
              id: 'qc-001',
              organizationId: ORG_ID,
              qcNumber: 'QC-FRG-2026-1001',
              inspectionType: 'FINISHED_BATCH_RELEASE',
              subjectName: 'GOLDEN HOUR 50ml — Master Atelier Lot',
              abvTestedPct: 80.1,
              specificGravity: 0.844,
              refractiveIndex: 1.368,
              gcmsMatchPct: 99.6,
              clarityResult: 'CRYSTAL_CLEAR',
              olfactoryResult: 'CONFORMS',
              microbiologyPass: true,
              decision: 'PASSED',
              inspectorEmail: 'qc@fragmore.shop',
              approvedByEmail: 'qc@fragmore.shop',
              approvedAt: new Date(),
              status: 'COMPLETED'
            },
            {
              id: 'qc-002',
              organizationId: ORG_ID,
              qcNumber: 'QC-FRG-2026-1002',
              inspectionType: 'RAW_MATERIAL_INWARD',
              subjectName: 'Assam Oud Absolute Grasse Cert #882',
              abvTestedPct: 0,
              specificGravity: 0.962,
              refractiveIndex: 1.502,
              gcmsMatchPct: 99.3,
              clarityResult: 'AMBER_CLEAR',
              olfactoryResult: 'CONFORMS',
              microbiologyPass: true,
              decision: 'PASSED',
              inspectorEmail: 'qc@fragmore.shop',
              approvedByEmail: 'qc@fragmore.shop',
              approvedAt: new Date(),
              status: 'COMPLETED'
            }
          ])
          .onConflictDoNothing();
      }

      // 9. Finished Goods Warehouse Bins (Seed safely from live products/inventory_ledger)
      const existingFg = await db.select().from(erpFinishedGoods);
      if (!existingFg.length) {
        const prodRows = await db.select().from(products);
        const fgBatchRows: any[] = [];
        let binNum = 1;
        for (const p of prodRows.slice(0, 12)) {
          const variants: any[] = Array.isArray(p.variants) ? p.variants : [];
          for (const v of variants) {
            if (!v?.sku) continue;
            const onHand = Number(v.stockOnHand ?? v.stockAvailable ?? 25);
            const reserved = Number(v.stockReserved ?? 0);
            const avail = Math.max(0, onHand - reserved);
            fgBatchRows.push({
              id: `fg-${v.sku}`,
              organizationId: ORG_ID,
              warehouseId: 'wh-fg-main',
              productId: p.id,
              sku: v.sku,
              productName: p.name,
              size: v.size || '50 ml',
              binLocation: `FG-R${Math.ceil(binNum / 6)}-B${binNum}`,
              batchNumber: 'BATCH-FRG-2026-1001',
              quantityOnHand: onHand,
              quantityReserved: reserved,
              quantityAvailable: avail,
              unitManufacturingCostInr: v.size?.includes('2') ? 160 : v.size?.includes('15') ? 310 : 540,
              mrpInr: Number(v.mrp || v.sellingPrice || 3499),
              sellingPriceInr: Number(v.sellingPrice || 2999),
              hsnCode: '33030050',
              gstRatePct: 18,
              status: avail < 15 ? 'LOW_STOCK' : 'ACTIVE'
            });
            binNum++;
          }
        }
        if (fgBatchRows.length) {
          for (const row of fgBatchRows) {
            await db.insert(erpFinishedGoods).values(row).onConflictDoNothing();
          }
        }
      }

      // 10. B2B Leads, Proposals, Quotations
      const existingLeads = await db.select().from(erpLeads);
      if (!existingLeads.length) {
        await db
          .insert(erpLeads)
          .values([
            {
              id: 'lead-taj-01',
              organizationId: ORG_ID,
              leadNumber: 'LEAD-2026-1001',
              companyName: 'Taj Falaknuma Hospitality Group',
              contactName: 'Vikramaditya Rao',
              email: 'procurement@tajluxury.in',
              phone: '+91 98201 44120',
              city: 'Hyderabad',
              state: 'Telangana',
              leadType: 'LUXURY_HOSPITALITY',
              source: 'Founder Concierge Referral',
              estimatedValueInr: 720000,
              stage: 'PROPOSAL_SENT',
              assignedToEmail: 'sales@fragmore.shop',
              nextFollowUpDate: addDaysIso(3),
              notes: '250 presidential suite bespoke 50ml coffrets + custom monogramming.'
            },
            {
              id: 'lead-deloitte-02',
              organizationId: ORG_ID,
              leadNumber: 'LEAD-2026-1002',
              companyName: 'Meridian Capital Partners India',
              contactName: 'Nandini Verma',
              email: 'nandini.verma@meridiancap.in',
              phone: '+91 98190 33110',
              city: 'Mumbai',
              state: 'Maharashtra',
              leadType: 'CORPORATE_GIFTING',
              source: 'Instagram Executive Ad',
              estimatedValueInr: 385000,
              stage: 'QUALIFIED',
              assignedToEmail: 'sales@fragmore.shop',
              nextFollowUpDate: addDaysIso(2),
              notes: 'Diwali CXO Discovery Six + Velvet Nocturne gifting.'
            }
          ])
          .onConflictDoNothing();

        await db
          .insert(erpProposals)
          .values({
            id: 'prop-taj-01',
            organizationId: ORG_ID,
            leadId: 'lead-taj-01',
            proposalNumber: 'PROP-2026-1001',
            title: 'Bespoke Suite Amenity & Presidential Coffret Program',
            clientCompany: 'Taj Falaknuma Hospitality Group',
            clientContactName: 'Vikramaditya Rao',
            clientEmail: 'procurement@tajluxury.in',
            scopeSummary: '250 units of Oblique Woods 50ml Extrait de Parfum in custom gold-foiled linen coffrets.',
            lineItems: [
              { sku: 'FRG-OBL-050', description: 'Oblique Woods 50ml Bespoke Edition', hsnCode: '33030050', qty: 250, unitPriceInr: 2400, totalInr: 600000 },
              { sku: 'BESPOKE-FOIL', description: 'Custom Gold Monogramming & Silk Sleeves', hsnCode: '48192090', qty: 250, unitPriceInr: 180, totalInr: 45000 }
            ],
            estimatedValueInr: 645000,
            validUntil: addDaysIso(25),
            preparedByEmail: 'sales@fragmore.shop',
            approvedByEmail: 'aibrandorigin@gmail.com',
            status: 'SENT'
          })
          .onConflictDoNothing();

        await db
          .insert(erpQuotations)
          .values({
            id: 'qt-taj-01',
            organizationId: ORG_ID,
            proposalId: 'prop-taj-01',
            leadId: 'lead-taj-01',
            quotationNumber: 'QT-2026-1001',
            clientName: 'Taj Falaknuma Hospitality Group',
            clientEmail: 'procurement@tajluxury.in',
            clientGstin: '36AAACT4210Q1Z4',
            placeOfSupplyState: 'Telangana',
            isInterState: true,
            items: [
              { sku: 'FRG-OBL-050', description: 'Oblique Woods 50ml Bespoke Edition', hsnCode: '33030050', qty: 250, unitPriceInr: 2400, discountInr: 0, gstRatePct: 18, lineTotalInr: 600000 }
            ],
            subtotalInr: 600000,
            discountInr: 0,
            taxableAmountInr: 600000,
            cgstInr: 0,
            sgstInr: 0,
            igstInr: 108000,
            totalInr: 708000,
            paymentTerms: '50% Advance with PO, 50% Against Pre-Dispatch QC',
            validUntil: addDaysIso(20),
            createdByEmail: 'sales@fragmore.shop',
            approvedByEmail: 'finance@fragmore.shop',
            status: 'SENT'
          })
          .onConflictDoNothing();
      }

      // 11. Accounting Baseline Journal + GST Invoices synced safely without modifying storefront orders
      const existingJournals = await db.select().from(erpAccountingJournals);
      if (!existingJournals.length) {
        const fp = getFiscalPeriod();
        await db
          .insert(erpAccountingJournals)
          .values([
            {
              id: 'jrn-opening-01',
              organizationId: ORG_ID,
              journalNumber: 'JRN-2026-1001',
              entryDate: addDaysIso(-30),
              fiscalPeriod: fp,
              sourceModule: 'MANUAL',
              narration: 'Atelier Opening Capital, Raw Materials Reserve & Operating Bank Balance',
              lines: [
                { accountCode: '1010', accountName: 'HDFC Operating Bank Account', accountType: 'ASSET', debitInr: 2500000, creditInr: 0, costCenter: 'CC-100' },
                { accountCode: '1200', accountName: 'Raw Materials & Flacon Inventory', accountType: 'ASSET', debitInr: 850000, creditInr: 0, costCenter: 'CC-220' },
                { accountCode: '3000', accountName: 'Shareholders Equity & Paid-In Capital', accountType: 'EQUITY', debitInr: 0, creditInr: 3350000, costCenter: 'CC-100' }
              ],
              totalDebitInr: 3350000,
              totalCreditInr: 3350000,
              isBalanced: true,
              postedByEmail: 'finance@fragmore.shop',
              status: 'POSTED'
            }
          ])
          .onConflictDoNothing();
      }

      // 12. Digital Marketing Workspace
      const existingMkt = await db.select().from(erpMarketingWorkspace);
      if (!existingMkt.length) {
        await db
          .insert(erpMarketingWorkspace)
          .values([
            {
              id: 'mkt-ws-01',
              organizationId: ORG_ID,
              briefCode: 'MKT-2026-1001',
              title: 'Golden Hour Extrait — Monsoon Cinema Film & Meta Prospecting',
              channel: 'META_ADS',
              creativeFormat: 'REEL',
              targetAudience: 'Luxury Fragrance Connoisseurs (Mumbai, Delhi, Bengaluru)',
              budgetInr: 180000,
              spendInr: 92400,
              revenueAttributedInr: 418500,
              leadsCount: 64,
              assigneeEmail: 'growth@fragmore.shop',
              scheduledDate: currentIsoDate(),
              creativeCopy: '28% Extrait concentration. Aged 21 days in chilled oak vaults.',
              status: 'LIVE'
            },
            {
              id: 'mkt-ws-02',
              organizationId: ORG_ID,
              briefCode: 'MKT-2026-1002',
              title: 'Discovery Six — WhatsApp VIP Redemption Flow',
              channel: 'WHATSAPP',
              creativeFormat: 'WHATSAPP_DROP',
              targetAudience: 'Discovery Kit Buyers Day 10–14 Window',
              budgetInr: 25000,
              spendInr: 8400,
              revenueAttributedInr: 124900,
              leadsCount: 39,
              assigneeEmail: 'growth@fragmore.shop',
              scheduledDate: addDaysIso(2),
              creativeCopy: 'Redeem your full Discovery Kit value toward your signature 50ml flacon.',
              status: 'APPROVED'
            }
          ])
          .onConflictDoNothing();
      }

      // 13. Employees, Interns & Cross-Dept Tasks
      const existingEmp = await db.select().from(erpEmployees);
      if (!existingEmp.length) {
        await db
          .insert(erpEmployees)
          .values([
            { id: 'emp-01', organizationId: ORG_ID, departmentId: 'dept-exec', roleId: 'role-super-admin', employeeCode: 'EMP-FRG-101', fullName: 'Harsha Vardhan', email: 'aibrandorigin@gmail.com', phone: '+91 98200 11001', designation: 'Founder & Managing Director', joiningDate: '2024-04-01', monthlySalaryInr: 225000, leaveBalanceDays: 20, locationCity: 'Mumbai', status: 'ACTIVE' },
            { id: 'emp-02', organizationId: ORG_ID, departmentId: 'dept-rd', roleId: 'role-formulator', employeeCode: 'EMP-FRG-102', fullName: 'Aarav Deshmukh', email: 'perfumer@fragmore.shop', phone: '+91 98200 11002', designation: 'Master Perfumer & Head of R&D', joiningDate: '2024-06-15', monthlySalaryInr: 145000, leaveBalanceDays: 16, reportingManagerEmail: 'aibrandorigin@gmail.com', locationCity: 'Mumbai', status: 'ACTIVE' },
            { id: 'emp-03', organizationId: ORG_ID, departmentId: 'dept-fin', roleId: 'role-fin-ctrl', employeeCode: 'EMP-FRG-103', fullName: 'Meera Kulkarni', email: 'finance@fragmore.shop', phone: '+91 98200 11003', designation: 'Financial Controller (GST & Audit)', joiningDate: '2024-08-01', monthlySalaryInr: 130000, leaveBalanceDays: 18, reportingManagerEmail: 'aibrandorigin@gmail.com', locationCity: 'Mumbai', status: 'ACTIVE' },
            { id: 'emp-04', organizationId: ORG_ID, departmentId: 'dept-qc', roleId: 'role-qc-analyst', employeeCode: 'EMP-FRG-104', fullName: 'Dr. Rohan Nair', email: 'qc@fragmore.shop', phone: '+91 98200 11004', designation: 'Senior Olfactory QC & IFRA Chemist', joiningDate: '2024-09-10', monthlySalaryInr: 95000, leaveBalanceDays: 15, reportingManagerEmail: 'perfumer@fragmore.shop', locationCity: 'Mumbai', status: 'ACTIVE' },
            { id: 'emp-05', organizationId: ORG_ID, departmentId: 'dept-crm', roleId: 'role-sales-crm', employeeCode: 'EMP-FRG-105', fullName: 'Ananya Sharma', email: 'sales@fragmore.shop', phone: '+91 98200 11005', designation: 'Corporate Gifting & Concierge Lead', joiningDate: '2025-01-05', monthlySalaryInr: 82000, leaveBalanceDays: 14, reportingManagerEmail: 'aibrandorigin@gmail.com', locationCity: 'Mumbai', status: 'ACTIVE' }
          ])
          .onConflictDoNothing();

        await db
          .insert(erpInterns)
          .values([
            { id: 'int-01', organizationId: ORG_ID, departmentId: 'dept-rd', internCode: 'INT-FRG-101', fullName: 'Riya Patel', email: 'intern.riya@fragmore.shop', phone: '+91 97654 22001', university: 'ICT Mumbai (Perfumery & Flavour Tech)', track: 'FORMULATION_RD', mentorEmail: 'perfumer@fragmore.shop', startDate: addDaysIso(-45), endDate: addDaysIso(135), stipendMonthlyInr: 22000, projectTitle: 'Cold-Maceration Ester Stability Benchmarking', evaluationScore: 4.8, status: 'ACTIVE' },
            { id: 'int-02', organizationId: ORG_ID, departmentId: 'dept-mkt', internCode: 'INT-FRG-102', fullName: 'Siddharth Joshi', email: 'intern.sid@fragmore.shop', phone: '+91 97654 22002', university: 'NMIMS Mumbai', track: 'DIGITAL_MARKETING', mentorEmail: 'growth@fragmore.shop', startDate: addDaysIso(-30), endDate: addDaysIso(90), stipendMonthlyInr: 18000, projectTitle: 'Creator Unboxing & Discovery-to-50ml Cohort Attribution', evaluationScore: 4.6, status: 'ACTIVE' }
          ])
          .onConflictDoNothing();

        await db
          .insert(erpTasks)
          .values([
            { id: 'tsk-01', organizationId: ORG_ID, departmentId: 'dept-proc', taskNumber: 'TSK-FRG-1001', title: 'Replenish 50ml Italian Crimp Flacons below reorder point', description: 'Current stock 480 units is below reorder threshold of 500 units. Raise PO & book GRN slot.', sourceModule: 'materials', priority: 'HIGH', assignedToEmail: 'warehouse@fragmore.shop', createdByEmail: 'aibrandorigin@gmail.com', dueDate: addDaysIso(3), status: 'IN_PROGRESS' },
            { id: 'tsk-02', organizationId: ORG_ID, departmentId: 'dept-crm', taskNumber: 'TSK-FRG-1002', title: 'Follow up with Taj Falaknuma on QT-2026-1001 advance invoice', description: 'Client requested final GST proforma confirmation prior to releasing 50% advance.', sourceModule: 'proposals', linkedEntityType: 'QUOTATION', linkedEntityId: 'qt-taj-01', priority: 'URGENT', assignedToEmail: 'sales@fragmore.shop', createdByEmail: 'aibrandorigin@gmail.com', dueDate: addDaysIso(1), status: 'TODO' },
            { id: 'tsk-03', organizationId: ORG_ID, departmentId: 'dept-qc', taskNumber: 'TSK-FRG-1003', title: 'Complete GC-MS assay sign-off for pending maceration lots', description: 'Verify ABV 80% and clarity specs before releasing finished bottles to Flagship Vault.', sourceModule: 'quality', priority: 'HIGH', assignedToEmail: 'qc@fragmore.shop', createdByEmail: 'perfumer@fragmore.shop', dueDate: addDaysIso(2), status: 'IN_REVIEW' }
          ])
          .onConflictDoNothing();
      }

      // 14. Approvals & Notifications Seed
      const existingApprovals = await db.select().from(erpApprovals);
      if (!existingApprovals.length) {
        await db
          .insert(erpApprovals)
          .values([
            {
              id: 'apr-qt-taj',
              organizationId: ORG_ID,
              departmentId: 'dept-crm',
              approvalNumber: 'APR-FRG-1001',
              moduleKey: 'proposals',
              entityType: 'QUOTATION',
              entityId: 'qt-taj-01',
              title: 'Approve B2B Quotation QT-2026-1001 (₹7,08,000 incl. IGST)',
              summary: '250 × Oblique Woods 50ml Bespoke Hospitality Amenity order for Taj Falaknuma.',
              amountInr: 708000,
              requiredRoleCode: 'SUPER_ADMIN',
              requestedByEmail: 'sales@fragmore.shop',
              status: 'PENDING'
            }
          ])
          .onConflictDoNothing();
      }

      const existingNotifs = await db.select().from(erpNotifications);
      if (!existingNotifs.length) {
        await db
          .insert(erpNotifications)
          .values([
            {
              id: 'ntf-boot-01',
              organizationId: ORG_ID,
              recipientEmail: 'ALL_ADMINS',
              departmentCode: 'INV',
              severity: 'WARNING',
              category: 'REORDER_ALERT',
              title: 'Raw Material & Flacon Reorder Threshold Triggered',
              message: '50ml Heavy Italian Crimp Crystal Flacon (480 units) and Rigid Coffrets (310 units) are below reorder levels.',
              linkModule: 'materials',
              linkEntityId: 'mat-flacon-50',
              isRead: false
            },
            {
              id: 'ntf-boot-02',
              organizationId: ORG_ID,
              recipientEmail: 'ALL_ADMINS',
              departmentCode: 'CRM',
              severity: 'INFO',
              category: 'APPROVAL_PENDING',
              title: 'B2B Quotation Awaiting Executive Sign-off',
              message: 'QT-2026-1001 for Taj Falaknuma Hospitality Group (₹7,08,000) is queued in Approval Inbox.',
              linkModule: 'proposals',
              linkEntityId: 'qt-taj-01',
              isRead: false
            }
          ])
          .onConflictDoNothing();
      }
    } catch (err) {
      erpSeedPromise = null;
      console.error('[ERP Seed] Error:', err);
      throw err;
    }
  })();
  return erpSeedPromise;
}

// ============================================================================
// SERVER-SIDE RBAC ACTOR & PERMISSION EVALUATOR
// ============================================================================

export interface ErpActorContext {
  email: string;
  displayName: string;
  roleId: string;
  roleCode: string;
  roleName: string;
  departmentCode: string;
  isSuperAdmin: boolean;
  permissions: Record<
    string,
    {
      canView: boolean;
      canCreate: boolean;
      canEdit: boolean;
      canApprove: boolean;
      canDelete: boolean;
      canExport: boolean;
    }
  >;
}

const LEGACY_ROLE_ALIAS: Record<string, string> = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'SUPER_ADMIN',
  ORDER_MANAGER: 'SALES_CRM',
  INVENTORY_MANAGER: 'WAREHOUSE_MANAGER',
  MARKETING: 'MARKETING_AGENCY',
  CUSTOMER_SUPPORT: 'INTERN_VIEWER'
};

export async function resolveErpActor(params: {
  verifiedEmail?: string;
  headerEmail?: string;
  headerAdminRole?: string;
  headerErpRoleCode?: string;
}): Promise<ErpActorContext> {
  await ensureErpSeeded();

  const rawEmail = (params.verifiedEmail || params.headerEmail || '').trim().toLowerCase();
  const explicitErpRole = (params.headerErpRoleCode || '').trim().toUpperCase();
  const legacyRole = (params.headerAdminRole || '').trim().toUpperCase();

  // Strictly block anonymous or CUSTOMER requests with no valid admin identity
  const isBootstrapAdmin =
    rawEmail === 'aibrandorigin@gmail.com' ||
    rawEmail === 'gowisherharsha@gmail.com' ||
    rawEmail === 'harsha@brandorigin.in' ||
    rawEmail === 'admin@fragmore.com' ||
    rawEmail.includes('admin');

  let userAccessRow: any = null;
  if (rawEmail) {
    const found = await db.select().from(erpUserAccess).where(eq(erpUserAccess.email, rawEmail));
    if (found.length) userAccessRow = found[0];
  }

  // Immediate access revocation gate: disabled users are blocked before any role evaluation or header override
  if (userAccessRow && !userAccessRow.isActive) {
    throw new ForbiddenError('User ERP access has been deactivated by an administrator.');
  }

  // Also check if bound intern/employee record is explicitly revoked/terminated for non-bootstrap users
  if (rawEmail && !isBootstrapAdmin) {
    const [internRow] = await db.select().from(erpInterns).where(eq(erpInterns.email, rawEmail));
    if (internRow && (internRow.status === 'REVOKED' || internRow.status === 'INACTIVE' || internRow.status === 'DISABLED')) {
      throw new ForbiddenError('Intern ERP access has been revoked.');
    }
    const [empRow] = await db.select().from(erpEmployees).where(eq(erpEmployees.email, rawEmail));
    if (empRow && (empRow.status === 'TERMINATED' || empRow.status === 'INACTIVE' || empRow.status === 'DISABLED')) {
      throw new ForbiddenError('Employee ERP access has been deactivated.');
    }
  }

  let dbBoundRoleCode: string | null = null;
  if (userAccessRow) {
    const [roleRec] = await db.select().from(erpRoles).where(eq(erpRoles.id, userAccessRow.roleId));
    dbBoundRoleCode = roleRec?.code || 'INTERN_VIEWER';
  }

  // Determine target role code:
  // Bootstrap admins and SUPER_ADMIN accounts can use x-erp-role-code for the RBAC Role Simulator.
  // Explicitly bound non-admin staff (e.g. MARKETING_AGENCY, INTERN_VIEWER) CANNOT escalate via headers!
  let targetRoleCode = '';
  if (userAccessRow && !isBootstrapAdmin && dbBoundRoleCode && dbBoundRoleCode !== 'SUPER_ADMIN') {
    targetRoleCode = dbBoundRoleCode;
  } else if (explicitErpRole) {
    if (!rawEmail && !legacyRole && !isBootstrapAdmin) {
      throw new ForbiddenError('Authentication required to assume an ERP role.');
    }
    if (!isBootstrapAdmin && legacyRole === 'CUSTOMER') {
      throw new ForbiddenError('Customer accounts cannot assume ERP roles.');
    }
    targetRoleCode = explicitErpRole;
  } else if (legacyRole === 'CUSTOMER') {
    throw new ForbiddenError('Customer accounts cannot access Fragmoré Business OS ERP.');
  } else if (userAccessRow && dbBoundRoleCode) {
    targetRoleCode = dbBoundRoleCode;
  } else if (legacyRole && LEGACY_ROLE_ALIAS[legacyRole]) {
    targetRoleCode = LEGACY_ROLE_ALIAS[legacyRole];
  } else if (isBootstrapAdmin) {
    targetRoleCode = 'SUPER_ADMIN';
  } else {
    throw new ForbiddenError('Forbidden: Authorized ERP department membership required.');
  }

  const roleRows = await db.select().from(erpRoles).where(eq(erpRoles.code, targetRoleCode));
  if (!roleRows.length) {
    throw new ForbiddenError(`Unknown or inactive ERP role: ${targetRoleCode}`);
  }
  const role = roleRows[0];

  const permRows = await db.select().from(erpPermissions).where(eq(erpPermissions.roleId, role.id));
  const permissions: ErpActorContext['permissions'] = {};
  for (const mod of ERP_MODULE_KEYS) {
    const match = permRows.find((p) => p.moduleKey === mod);
    permissions[mod] = {
      canView: Boolean(match?.canView),
      canCreate: Boolean(match?.canCreate),
      canEdit: Boolean(match?.canEdit),
      canApprove: Boolean(match?.canApprove),
      canDelete: Boolean(match?.canDelete),
      canExport: Boolean(match?.canExport)
    };
  }

  let deptCode = 'EXEC';
  if (role.departmentId) {
    const [d] = await db.select().from(erpDepartments).where(eq(erpDepartments.id, role.departmentId));
    if (d) deptCode = d.code;
  }

  return {
    email: rawEmail || `${role.code.toLowerCase()}@fragmore.shop`,
    displayName: userAccessRow?.displayName || role.name,
    roleId: role.id,
    roleCode: role.code,
    roleName: role.name,
    departmentCode: deptCode,
    isSuperAdmin: role.code === 'SUPER_ADMIN',
    permissions
  };
}

export function assertErpPermission(actor: ErpActorContext, moduleKey: ErpModuleKey, action: ErpActionKey): void {
  if (actor.isSuperAdmin) return;
  const p = actor.permissions[moduleKey];
  if (!p) throw new ForbiddenError(`No permissions configured for module "${moduleKey}".`);
  const map: Record<ErpActionKey, boolean> = {
    view: p.canView,
    create: p.canCreate,
    edit: p.canEdit,
    approve: p.canApprove,
    delete: p.canDelete,
    export: p.canExport
  };
  if (!map[action]) {
    throw new ForbiddenError(`Role "${actor.roleName}" lacks "${action.toUpperCase()}" permission on module "${moduleKey}".`);
  }
}

// ============================================================================
// CORE BOOTSTRAP PAYLOAD & ACCOUNTING TRIAL BALANCE
// ============================================================================

export async function computeTrialBalanceAndPnl() {
  const journals = await db.select().from(erpAccountingJournals).orderBy(desc(erpAccountingJournals.entryDate));
  const accountTotals: Record<
    string,
    { accountCode: string; accountName: string; accountType: string; debitInr: number; creditInr: number; netBalanceInr: number }
  > = {};

  let totalDebits = 0;
  let totalCredits = 0;

  for (const j of journals) {
    if (j.status !== 'POSTED') continue;
    const lines: any[] = Array.isArray(j.lines) ? j.lines : [];
    for (const line of lines) {
      const code = String(line.accountCode || '9999');
      if (!accountTotals[code]) {
        accountTotals[code] = {
          accountCode: code,
          accountName: String(line.accountName || code),
          accountType: String(line.accountType || 'ASSET'),
          debitInr: 0,
          creditInr: 0,
          netBalanceInr: 0
        };
      }
      const dr = Number(line.debitInr || 0);
      const cr = Number(line.creditInr || 0);
      accountTotals[code].debitInr = round2(accountTotals[code].debitInr + dr);
      accountTotals[code].creditInr = round2(accountTotals[code].creditInr + cr);
      totalDebits = round2(totalDebits + dr);
      totalCredits = round2(totalCredits + cr);
    }
  }

  let totalRevenue = 0;
  let totalExpense = 0;
  const accounts = Object.values(accountTotals)
    .map((acc) => {
      const isCreditNormal = ['LIABILITY', 'EQUITY', 'REVENUE'].includes(acc.accountType);
      const net = isCreditNormal ? round2(acc.creditInr - acc.debitInr) : round2(acc.debitInr - acc.creditInr);
      if (acc.accountType === 'REVENUE') totalRevenue = round2(totalRevenue + (acc.creditInr - acc.debitInr));
      if (acc.accountType === 'EXPENSE') totalExpense = round2(totalExpense + (acc.debitInr - acc.creditInr));
      return { ...acc, netBalanceInr: net };
    })
    .sort((a, b) => a.accountCode.localeCompare(b.accountCode));

  return {
    accounts,
    totalDebits: round2(totalDebits),
    totalCredits: round2(totalCredits),
    isBalanced: Math.abs(totalDebits - totalCredits) < 0.05,
    totalRevenueInr: round2(totalRevenue),
    totalExpenseInr: round2(totalExpense),
    netProfitInr: round2(totalRevenue - totalExpense)
  };
}

export async function getErpWorkspaceSnapshot(actor: ErpActorContext) {
  await ensureErpSeeded();

  const [
    orgs,
    departments,
    roles,
    permissions,
    userAccess,
    warehouses,
    materials,
    goodsReceipts,
    stockLots,
    formulations,
    formulationVersions,
    samples,
    qcRecords,
    finishedGoods,
    leads,
    proposals,
    quotations,
    invoices,
    creditNotes,
    payments,
    journals,
    marketingWorkspace,
    employees,
    interns,
    tasks,
    approvals,
    attachments,
    notifications,
    purchaseOrders,
    suppliers,
    batches,
    storeOrders,
    storeCustomers,
    storeProducts,
    storeCampaigns
  ] = await Promise.all([
    db.select().from(erpOrganizations),
    db.select().from(erpDepartments),
    db.select().from(erpRoles),
    db.select().from(erpPermissions),
    db.select().from(erpUserAccess),
    db.select().from(erpWarehouses),
    db.select().from(erpMaterials).orderBy(erpMaterials.code),
    db.select().from(erpGoodsReceipts).orderBy(desc(erpGoodsReceipts.createdAt)),
    db.select().from(erpStockLots).orderBy(desc(erpStockLots.createdAt)),
    db.select().from(erpFormulations).orderBy(erpFormulations.formulaCode),
    db.select().from(erpFormulationVersions).orderBy(desc(erpFormulationVersions.versionNumber)),
    db.select().from(erpSamples).orderBy(desc(erpSamples.createdAt)),
    db.select().from(erpQcRecords).orderBy(desc(erpQcRecords.createdAt)),
    db.select().from(erpFinishedGoods).orderBy(erpFinishedGoods.sku),
    db.select().from(erpLeads).orderBy(desc(erpLeads.createdAt)),
    db.select().from(erpProposals).orderBy(desc(erpProposals.createdAt)),
    db.select().from(erpQuotations).orderBy(desc(erpQuotations.createdAt)),
    db.select().from(erpInvoices).orderBy(desc(erpInvoices.createdAt)),
    db.select().from(erpCreditNotes).orderBy(desc(erpCreditNotes.createdAt)),
    db.select().from(erpPayments).orderBy(desc(erpPayments.createdAt)),
    db.select().from(erpAccountingJournals).orderBy(desc(erpAccountingJournals.createdAt)),
    db.select().from(erpMarketingWorkspace).orderBy(desc(erpMarketingWorkspace.createdAt)),
    db.select().from(erpEmployees).orderBy(erpEmployees.employeeCode),
    db.select().from(erpInterns).orderBy(erpInterns.internCode),
    db.select().from(erpTasks).orderBy(desc(erpTasks.createdAt)),
    db.select().from(erpApprovals).orderBy(desc(erpApprovals.createdAt)),
    db.select().from(erpAttachments).orderBy(desc(erpAttachments.createdAt)),
    db.select().from(erpNotifications).orderBy(desc(erpNotifications.createdAt)),
    db.select().from(supplierPurchaseOrders).orderBy(desc(supplierPurchaseOrders.createdAt)),
    db.select().from(procurementSuppliers),
    db.select().from(productionBatches).orderBy(desc(productionBatches.createdAt)),
    db.select().from(orders).orderBy(desc(orders.createdAt)),
    db.select().from(customers),
    db.select().from(products),
    db.select().from(campaigns)
  ]);

  const sanitizedFormulationVersions = formulationVersions.map((v: any) => {
    const allowed: string[] = Array.isArray(v.authorizedRoleCodes) ? v.authorizedRoleCodes : ['SUPER_ADMIN', 'FORMULATOR'];
    if (!v.isConfidential || actor.isSuperAdmin || allowed.includes(actor.roleCode)) {
      return { ...v, isRedactedForActor: false };
    }
    return {
      ...v,
      isRedactedForActor: true,
      ingredients: [
        {
          materialId: null,
          materialCode: 'CLASSIFIED',
          materialName: '[CONFIDENTIAL MASTER ACCORD — CLEARANCE REQUIRED]',
          notePyramid: 'CLASSIFIED',
          percentage: 100,
          costPerKgInr: 0
        }
      ],
      changeSummary: '[REDACTED: Restricted Intellectual Property]',
      stabilityNotes: '[REDACTED: Authorized Clearance Required]'
    };
  });

  const financialSummary = await computeTrialBalanceAndPnl();

  const totalOrderRevenue = storeOrders
    .filter((o) => o.orderStatus !== 'CANCELLED')
    .reduce((s, o) => s + Number(o.totalAmount || 0), 0);
  const totalInvoicedAmount = invoices
    .filter((inv) => inv.status !== 'VOID')
    .reduce((s, inv) => s + Number(inv.grandTotalInr || 0), 0);
  const totalArBalance = invoices
    .filter((inv) => inv.status !== 'VOID')
    .reduce((s, inv) => s + Number(inv.balanceDueInr || 0), 0);
  const totalApPayables = purchaseOrders
    .filter((po) => po.status !== 'CANCELLED' && po.paymentStatus !== 'PAID')
    .reduce((s, po) => s + Number(po.totalCostInr || 0), 0);

  const matchedIntern = interns.find((i) => i.email.toLowerCase() === actor.email.toLowerCase());
  const isRestrictedIntern = actor.roleCode === 'INTERN_VIEWER' && !matchedIntern?.canViewSensitiveFinancials;
  const safeFinancialSummary = isRestrictedIntern
    ? { accounts: [], totalDebits: 0, totalCredits: 0, isBalanced: true, totalRevenueInr: 0, totalExpenseInr: 0, netProfitInr: 0 }
    : financialSummary;
  const safeEmployees = isRestrictedIntern ? employees.map((e) => ({ ...e, monthlySalaryInr: null })) : employees;
  const safeInvoices = isRestrictedIntern ? [] : invoices;
  const safeJournals = isRestrictedIntern ? [] : journals;
  const safeFormulations =
    actor.roleCode === 'INTERN_VIEWER' && !matchedIntern?.canViewFormulations ? [] : formulations;
  const safeVersions =
    actor.roleCode === 'INTERN_VIEWER' && !matchedIntern?.canViewFormulations ? [] : sanitizedFormulationVersions;

  return {
    actor,
    organization: orgs[0],
    departments,
    roles,
    permissions,
    userAccess,
    warehouses,
    materials,
    goodsReceipts,
    stockLots,
    formulations: safeFormulations,
    formulationVersions: safeVersions,
    samples,
    qcRecords,
    finishedGoods,
    leads,
    proposals,
    quotations,
    invoices: safeInvoices,
    creditNotes: isRestrictedIntern ? [] : creditNotes,
    payments: isRestrictedIntern ? [] : payments,
    journals: safeJournals,
    financialSummary: safeFinancialSummary,
    marketingWorkspace,
    employees: safeEmployees,
    interns,
    tasks,
    approvals,
    attachments,
    notifications,
    procurement: { purchaseOrders: isRestrictedIntern ? [] : purchaseOrders, suppliers },
    batches,
    commerceSummary: {
      storeOrdersCount: storeOrders.length,
      storeCustomersCount: storeCustomers.length,
      storeProductsCount: storeProducts.length,
      storeCampaignsCount: storeCampaigns.length,
      totalOrderRevenueInr: totalOrderRevenue,
      totalInvoicedInr: round2(totalInvoicedAmount),
      accountsReceivableInr: round2(totalArBalance),
      accountsPayableInr: round2(totalApPayables),
      lowStockMaterialsCount: materials.filter((m) => m.currentStock <= m.reorderLevel).length,
      pendingApprovalsCount: approvals.filter((a) => a.status === 'PENDING').length,
      unreadNotificationsCount: notifications.filter((n) => !n.isRead).length
    }
  };
}

// ============================================================================
// WAREHOUSES, RAW MATERIALS & GOODS RECEIPT (GRN + FIFO LOT + AP JOURNAL)
// ============================================================================

export async function createOrUpdateMaterial(
  actor: ErpActorContext,
  payload: {
    id?: string;
    code?: string;
    name: string;
    category: string;
    uom: string;
    hsnCode?: string;
    gstRatePct?: number;
    unitCostInr: number;
    currentStock: number;
    reorderLevel: number;
    targetStock?: number;
    defaultWarehouseId?: string;
    ifraMaxPct?: number;
    casNumber?: string;
    expectedVersion?: number;
  }
) {
  if (!payload.name?.trim()) throw new ValidationError('Material name is required.');
  if (payload.unitCostInr < 0 || payload.currentStock < 0) throw new ValidationError('Cost and stock cannot be negative.');

  const status =
    payload.currentStock <= 0
      ? 'CRITICAL'
      : payload.currentStock <= payload.reorderLevel
      ? 'LOW_STOCK'
      : 'OPTIMAL';

  return await db.transaction(async (tx) => {
    if (payload.id) {
      const existing = await tx.select().from(erpMaterials).where(eq(erpMaterials.id, payload.id));
      if (existing.length) {
        if (payload.expectedVersion !== undefined && existing[0].version !== payload.expectedVersion) {
          throw new ConflictError(`Material ${existing[0].code} was updated by another session.`);
        }
        const [updated] = await tx
          .update(erpMaterials)
          .set({
            name: payload.name.trim(),
            category: payload.category,
            uom: payload.uom,
            hsnCode: payload.hsnCode || existing[0].hsnCode,
            gstRatePct: payload.gstRatePct ?? existing[0].gstRatePct,
            unitCostInr: payload.unitCostInr,
            currentStock: payload.currentStock,
            reorderLevel: payload.reorderLevel,
            targetStock: payload.targetStock ?? existing[0].targetStock,
            ifraMaxPct: payload.ifraMaxPct ?? existing[0].ifraMaxPct,
            casNumber: payload.casNumber ?? existing[0].casNumber,
            defaultWarehouseId: payload.defaultWarehouseId || existing[0].defaultWarehouseId,
            status,
            version: sql`${erpMaterials.version} + 1`,
            updatedAt: new Date()
          })
          .where(eq(erpMaterials.id, payload.id))
          .returning();
        await recordErpAuditLog(tx, {
          action: 'ERP_MATERIAL_UPDATED',
          entity: 'erp_materials',
          entityId: updated.id,
          actorEmail: actor.email,
          actorRole: actor.roleCode,
          details: `Updated material ${updated.code} (${updated.name}), stock=${updated.currentStock} ${updated.uom}`
        });
        return updated;
      }
    }

    const code = payload.code?.trim().toUpperCase() || `MAT-${Date.now().toString(36).slice(-5).toUpperCase()}`;
    const [created] = await tx
      .insert(erpMaterials)
      .values({
        id: payload.id || makeId('mat'),
        organizationId: ORG_ID,
        defaultWarehouseId: payload.defaultWarehouseId || 'wh-mumbai-rm',
        code,
        name: payload.name.trim(),
        category: payload.category || 'ESSENTIAL_OIL',
        uom: payload.uom || 'units',
        hsnCode: payload.hsnCode || '33029011',
        gstRatePct: payload.gstRatePct ?? 18,
        unitCostInr: payload.unitCostInr,
        currentStock: payload.currentStock,
        reservedStock: 0,
        reorderLevel: payload.reorderLevel,
        targetStock: payload.targetStock || Math.max(payload.reorderLevel * 3, payload.currentStock),
        ifraMaxPct: payload.ifraMaxPct ?? null,
        casNumber: payload.casNumber || null,
        status,
        version: 1
      })
      .returning();

    if (created.currentStock > 0) {
      await tx.insert(erpStockLots).values({
        id: makeId('lot'),
        organizationId: ORG_ID,
        materialId: created.id,
        warehouseId: created.defaultWarehouseId || 'wh-mumbai-rm',
        lotNumber: `LOT-${code}-${Date.now().toString(36).slice(-4).toUpperCase()}`,
        receivedQty: created.currentStock,
        availableQty: created.currentStock,
        reservedQty: 0,
        consumedQty: 0,
        unitCostInr: created.unitCostInr,
        receivedDate: currentIsoDate(),
        expiryDate: addDaysIso(730),
        qcStatus: 'APPROVED',
        status: 'ACTIVE'
      });
    }

    await recordErpAuditLog(tx, {
      action: 'ERP_MATERIAL_CREATED',
      entity: 'erp_materials',
      entityId: created.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Created material ${created.code} (${created.name})`
    });
    return created;
  });
}

export async function createWarehouse(
  actor: ErpActorContext,
  payload: { code: string; name: string; warehouseType: string; city: string; state: string; address: string; capacityUnits?: number; temperatureControlled?: boolean }
) {
  if (!payload.code?.trim() || !payload.name?.trim()) {
    throw new ValidationError('Warehouse code and name are required.');
  }
  const [created] = await db
    .insert(erpWarehouses)
    .values({
      id: makeId('wh'),
      organizationId: ORG_ID,
      code: payload.code.trim().toUpperCase(),
      name: payload.name.trim(),
      warehouseType: payload.warehouseType || 'FINISHED_GOODS',
      city: payload.city || 'Mumbai',
      state: payload.state || 'Maharashtra',
      address: payload.address || 'Mumbai Atelier Facility',
      capacityUnits: Number(payload.capacityUnits || 25000),
      temperatureControlled: Boolean(payload.temperatureControlled),
      managerEmail: actor.email
    })
    .returning();
  await recordErpAuditLog(db, {
    action: 'ERP_WAREHOUSE_CREATED',
    entity: 'erp_warehouses',
    entityId: created.id,
    actorEmail: actor.email,
    actorRole: actor.roleCode,
    details: `Created warehouse ${created.code} — ${created.name}`
  });
  return created;
}

// ACID Transaction: Purchase Order -> GRN -> Stock Lots -> Material Stock -> QC Inward -> Balanced AP Journal
export async function createGoodsReceiptTransaction(
  actor: ErpActorContext,
  payload: {
    purchaseOrderId: string;
    warehouseId?: string;
    challanNumber?: string;
    receivedDate?: string;
    items?: Array<{
      materialId?: string;
      materialName: string;
      receivedQty: number;
      acceptedQty?: number;
      rejectedQty?: number;
      unit?: string;
      unitCostInr: number;
    }>;
    notes?: string;
    idempotencyKey?: string;
  }
) {
  if (!payload.purchaseOrderId) throw new ValidationError('purchaseOrderId is required.');

  if (payload.idempotencyKey) {
    const dup = await db
      .select()
      .from(erpGoodsReceipts)
      .where(eq(erpGoodsReceipts.idempotencyKey, payload.idempotencyKey));
    if (dup.length) return { grn: dup[0], deduplicated: true };
  }

  return await db.transaction(async (tx) => {
    const pos = await tx.select().from(supplierPurchaseOrders).where(eq(supplierPurchaseOrders.id, payload.purchaseOrderId));
    if (!pos.length) throw new NotFoundError(`Purchase Order ${payload.purchaseOrderId} not found.`);
    const po = pos[0];
    if (po.status === 'CANCELLED') throw new ValidationError('Cannot receive goods against a CANCELLED Purchase Order.');

    const grnNumber = await getNextSequence(tx, 'GRN');
    const receivedDate = payload.receivedDate || currentIsoDate();
    const warehouseId = payload.warehouseId || 'wh-mumbai-rm';

    const sourceItems: any[] =
      Array.isArray(payload.items) && payload.items.length
        ? payload.items
        : (Array.isArray(po.items) ? po.items : []).map((it: any) => ({
            materialName: it.name,
            receivedQty: Number(it.quantity || 1),
            acceptedQty: Number(it.quantity || 1),
            rejectedQty: 0,
            unit: it.unit || 'units',
            unitCostInr: Number(it.unitPriceInr || 0)
          }));

    let subtotal = 0;
    const grnItems: any[] = [];
    const createdLots: any[] = [];
    const allMats = await tx.select().from(erpMaterials);

    for (const item of sourceItems) {
      const receivedQty = Number(item.receivedQty || 0);
      const acceptedQty = item.acceptedQty !== undefined ? Number(item.acceptedQty) : receivedQty;
      const rejectedQty = Number(item.rejectedQty || Math.max(0, receivedQty - acceptedQty));
      const unitCost = Number(item.unitCostInr || 0);
      if (receivedQty <= 0) throw new ValidationError(`Invalid received quantity for ${item.materialName}`);

      subtotal += acceptedQty * unitCost;
      const lotNumber = await getNextSequence(tx, 'LOT');

      // Match existing material by ID or fuzzy name, or auto-register new raw material cleanly
      let matchedMat = item.materialId
        ? allMats.find((m) => m.id === item.materialId)
        : allMats.find((m) => m.name.toLowerCase().includes(String(item.materialName).toLowerCase().slice(0, 14)));

      if (!matchedMat) {
        const [newMat] = await tx
          .insert(erpMaterials)
          .values({
            id: makeId('mat'),
            organizationId: ORG_ID,
            defaultWarehouseId: warehouseId,
            preferredSupplierId: po.supplierId,
            code: `MAT-${Date.now().toString(36).slice(-5).toUpperCase()}`,
            name: item.materialName,
            category: po.category || 'RAW_MATERIALS',
            uom: item.unit || 'units',
            hsnCode: '33029011',
            gstRatePct: 18,
            unitCostInr: unitCost,
            currentStock: 0,
            reservedStock: 0,
            reorderLevel: 50,
            targetStock: 300,
            status: 'OPTIMAL'
          })
          .returning();
        matchedMat = newMat;
        allMats.push(newMat);
      }

      const newStock = Number(matchedMat.currentStock || 0) + acceptedQty;
      const newStatus = newStock <= matchedMat.reorderLevel ? 'LOW_STOCK' : 'OPTIMAL';
      await tx
        .update(erpMaterials)
        .set({
          currentStock: newStock,
          unitCostInr: unitCost > 0 ? unitCost : matchedMat.unitCostInr,
          status: newStatus,
          version: sql`${erpMaterials.version} + 1`,
          updatedAt: new Date()
        })
        .where(eq(erpMaterials.id, matchedMat.id));

      grnItems.push({
        materialId: matchedMat.id,
        materialCode: matchedMat.code,
        materialName: matchedMat.name,
        orderedQty: receivedQty,
        receivedQty,
        acceptedQty,
        rejectedQty,
        unit: item.unit || matchedMat.uom,
        unitCostInr: unitCost,
        lotNumber,
        expiryDate: addDaysIso(730)
      });

      const [lot] = await tx
        .insert(erpStockLots)
        .values({
          id: makeId('lot'),
          organizationId: ORG_ID,
          materialId: matchedMat.id,
          warehouseId,
          supplierId: po.supplierId,
          lotNumber,
          supplierBatchRef: payload.challanNumber || po.poNumber,
          receivedQty,
          availableQty: acceptedQty,
          reservedQty: 0,
          consumedQty: 0,
          unitCostInr: unitCost,
          receivedDate,
          expiryDate: addDaysIso(730),
          qcStatus: rejectedQty > 0 ? 'PENDING' : 'APPROVED',
          status: acceptedQty > 0 ? 'ACTIVE' : 'QUARANTINED'
        })
        .returning();
      createdLots.push(lot);
    }

    subtotal = round2(subtotal);
    const taxInr = round2(subtotal * 0.18);
    const totalInr = round2(subtotal + taxInr);
    const grnId = makeId('grn');
    const journalNumber = await getNextSequence(tx, 'JRN');
    const journalId = makeId('jrn');

    // Balanced Double-Entry Journal: DR Raw Material Inventory = CR GRNI Clearing (AP is posted once at Vendor Invoice)
    await tx.insert(erpAccountingJournals).values({
      id: journalId,
      organizationId: ORG_ID,
      journalNumber,
      entryDate: receivedDate,
      fiscalPeriod: getFiscalPeriod(receivedDate),
      sourceModule: 'PURCHASE_GRN',
      sourceEntityId: grnId,
      narration: `GRN ${grnNumber} inward against PO ${po.poNumber} (${po.supplierName})`,
      lines: [
        { accountCode: '1200', accountName: 'Raw Materials & Packaging Inventory', accountType: 'ASSET', debitInr: subtotal, creditInr: 0, costCenter: 'CC-210' },
        { accountCode: '2110', accountName: 'Goods Received Not Invoiced (GRNI Clearing)', accountType: 'LIABILITY', debitInr: 0, creditInr: subtotal, costCenter: 'CC-210' }
      ],
      totalDebitInr: subtotal,
      totalCreditInr: subtotal,
      isBalanced: true,
      postedByEmail: actor.email,
      status: 'POSTED'
    });

    const [grn] = await tx
      .insert(erpGoodsReceipts)
      .values({
        id: grnId,
        organizationId: ORG_ID,
        purchaseOrderId: po.id,
        warehouseId,
        grnNumber,
        supplierId: po.supplierId,
        supplierName: po.supplierName,
        challanNumber: payload.challanNumber || `CH-${po.poNumber}`,
        receivedDate,
        receivedByEmail: actor.email,
        items: grnItems,
        subtotalInr: subtotal,
        taxInr,
        totalInr,
        qcStatus: 'PASSED',
        inventoryPosted: true,
        inspectedByEmail: actor.email,
        inspectedAt: new Date(),
        journalId,
        notes: payload.notes || `Auto-stocked FIFO lots and posted GRNI Journal ${journalNumber}`,
        idempotencyKey: payload.idempotencyKey || null,
        status: 'POSTED'
      })
      .returning();

    // Update stock lots to reference GRN
    for (const lot of createdLots) {
      await tx.update(erpStockLots).set({ grnId: grn.id }).where(eq(erpStockLots.id, lot.id));
    }

    // Update Purchase Order status to RECEIVED
    await tx
      .update(supplierPurchaseOrders)
      .set({
        status: 'RECEIVED',
        actualDeliveryDate: receivedDate,
        receivedBy: actor.email,
        updatedAt: new Date()
      })
      .where(eq(supplierPurchaseOrders.id, po.id));

    // Auto-create Inward QC Record
    const qcNumber = await getNextSequence(tx, 'QC');
    await tx.insert(erpQcRecords).values({
      id: makeId('qc'),
      organizationId: ORG_ID,
      qcNumber,
      inspectionType: 'RAW_MATERIAL_INWARD',
      grnId: grn.id,
      subjectName: `${po.supplierName} — ${grnNumber} (${grnItems.length} lots)`,
      abvTestedPct: 0,
      specificGravity: 0.91,
      refractiveIndex: 1.44,
      gcmsMatchPct: 99.1,
      clarityResult: 'CONFORMS',
      olfactoryResult: 'CONFORMS',
      microbiologyPass: true,
      decision: 'PASSED',
      inspectorEmail: actor.email,
      approvedByEmail: actor.email,
      approvedAt: new Date(),
      status: 'COMPLETED'
    });

    await createErpNotification(tx, {
      departmentCode: 'INV',
      severity: 'INFO',
      category: 'GRN_POSTED',
      title: `Goods Receipt ${grnNumber} Posted`,
      message: `${grnItems.length} material lot(s) from ${po.supplierName} stocked into warehouse & journal ${journalNumber} balanced at ₹${totalInr.toLocaleString('en-IN')}.`,
      linkModule: 'materials',
      linkEntityId: grn.id
    });

    await recordErpAuditLog(tx, {
      action: 'ERP_GRN_POSTED',
      entity: 'erp_goods_receipts',
      entityId: grn.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Posted ${grnNumber} for PO ${po.poNumber}: ₹${totalInr} with ${createdLots.length} FIFO lots & journal ${journalNumber}`
    });

    return { grn, lots: createdLots, journalNumber };
  });
}

// ============================================================================
// PERFUME FORMULATIONS, SAMPLES, QC & FINISHED GOODS
// ============================================================================

export async function createFormulationWithVersion(
  actor: ErpActorContext,
  payload: {
    formulationId?: string;
    name: string;
    fragranceFamily: string;
    concentrationType?: string;
    targetOilPct?: number;
    macerationDays?: number;
    changeSummary?: string;
    submitForApproval?: boolean;
    ingredients: Array<{
      materialId?: string;
      materialCode?: string;
      materialName: string;
      notePyramid: 'TOP' | 'HEART' | 'BASE' | 'SOLVENT' | 'FIXATIVE';
      percentage: number;
      costPerKgInr: number;
    }>;
  }
) {
  if (!payload.name?.trim()) throw new ValidationError('Formulation name is required.');
  if (!Array.isArray(payload.ingredients) || !payload.ingredients.length) {
    throw new ValidationError('At least one ingredient line is required.');
  }
  const totalPct = round2(payload.ingredients.reduce((s, i) => s + Number(i.percentage || 0), 0));
  if (Math.abs(totalPct - 100) > 0.05) {
    throw new ValidationError(`Formulation BOM percentages must equal exactly 100% (currently ${totalPct}%).`);
  }

  return await db.transaction(async (tx) => {
    const costPerKg = round2(payload.ingredients.reduce((s, i) => s + (Number(i.percentage) / 100) * Number(i.costPerKgInr || 0), 0));
    const cost50ml = round2(costPerKg * 0.045);

    let formulation: any;
    let nextVer = 1;
    const statusTarget = payload.submitForApproval ? 'PENDING_APPROVAL' : 'APPROVED';

    if (payload.formulationId) {
      const existing = await tx.select().from(erpFormulations).where(eq(erpFormulations.id, payload.formulationId));
      if (!existing.length) throw new NotFoundError('Formulation not found.');
      nextVer = existing[0].activeVersionNumber + 1;
      const [upd] = await tx
        .update(erpFormulations)
        .set({
          activeVersionNumber: nextVer,
          status: statusTarget,
          version: sql`${erpFormulations.version} + 1`,
          updatedAt: new Date()
        })
        .where(eq(erpFormulations.id, payload.formulationId))
        .returning();
      formulation = upd;
    } else {
      const formulaCode = await getNextSequence(tx, 'FRM');
      const [created] = await tx
        .insert(erpFormulations)
        .values({
          id: makeId('frm'),
          organizationId: ORG_ID,
          formulaCode,
          name: payload.name.trim().toUpperCase(),
          fragranceFamily: payload.fragranceFamily || 'Woody Amber',
          concentrationType: payload.concentrationType || 'Extrait de Parfum 28%',
          targetOilPct: Number(payload.targetOilPct || 28),
          macerationDays: Number(payload.macerationDays || 21),
          perfumerEmail: actor.email,
          activeVersionNumber: 1,
          status: statusTarget
        })
        .returning();
      formulation = created;
    }

    const [versionRec] = await tx
      .insert(erpFormulationVersions)
      .values({
        id: makeId('fver'),
        formulationId: formulation.id,
        versionNumber: nextVer,
        changeSummary: payload.changeSummary || `Version ${nextVer} composition authored by ${actor.email}`,
        ingredients: payload.ingredients,
        totalPercentage: totalPct,
        costPerKgInr: costPerKg,
        estimatedCostPer50mlInr: cost50ml,
        ifraComplianceStatus: 'PENDING_EVIDENCE',
        safetyStatus: 'UNVERIFIED',
        createdByEmail: actor.email,
        approvedByEmail: payload.submitForApproval ? null : actor.email,
        approvedAt: payload.submitForApproval ? null : new Date(),
        status: statusTarget
      })
      .returning();

    if (payload.submitForApproval) {
      const aprNum = await getNextSequence(tx, 'APR');
      await tx.insert(erpApprovals).values({
        id: makeId('apr'),
        organizationId: ORG_ID,
        departmentId: 'dept-rd',
        approvalNumber: aprNum,
        moduleKey: 'formulations',
        entityType: 'FORMULATION_VERSION',
        entityId: versionRec.id,
        title: `Approve Formula ${formulation.formulaCode} (${formulation.name}) v${nextVer}`,
        summary: `Extrait BOM cost ₹${cost50ml}/50ml. Requires Master Perfumer / Super Admin sign-off.`,
        amountInr: costPerKg,
        requiredRoleCode: 'SUPER_ADMIN',
        requestedByEmail: actor.email,
        status: 'PENDING'
      });
    }

    await recordErpAuditLog(tx, {
      action: 'ERP_FORMULATION_SAVED',
      entity: 'erp_formulations',
      entityId: formulation.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Saved ${formulation.formulaCode} (${formulation.name}) v${nextVer} — BOM cost ₹${costPerKg}/kg`
    });

    return { formulation, version: versionRec };
  });
}

export async function recordSampleEvaluation(
  actor: ErpActorContext,
  payload: {
    formulationId?: string;
    sampleType: string;
    fragranceName: string;
    recipientName?: string;
    recipientEmail?: string;
    volumeMl?: number;
    olfactoryScore?: number;
    longevityHours?: number;
    evaluationNotes?: string;
    status?: string;
  }
) {
  if (!payload.fragranceName?.trim()) throw new ValidationError('Fragrance / Sample name is required.');
  return await db.transaction(async (tx) => {
    const sampleNumber = await getNextSequence(tx, 'SMP');
    const [sample] = await tx
      .insert(erpSamples)
      .values({
        id: makeId('smp'),
        organizationId: ORG_ID,
        formulationId: payload.formulationId || null,
        sampleNumber,
        sampleType: payload.sampleType || 'LAB_TRIAL',
        fragranceName: payload.fragranceName.trim(),
        recipientName: payload.recipientName || null,
        recipientEmail: payload.recipientEmail || null,
        volumeMl: Number(payload.volumeMl || 10),
        olfactoryScore: payload.olfactoryScore !== undefined ? Number(payload.olfactoryScore) : null,
        longevityHours: payload.longevityHours !== undefined ? Number(payload.longevityHours) : null,
        evaluationNotes: payload.evaluationNotes || null,
        requestedByEmail: actor.email,
        status: payload.status || 'EVALUATED'
      })
      .returning();

    await recordErpAuditLog(tx, {
      action: 'ERP_SAMPLE_RECORDED',
      entity: 'erp_samples',
      entityId: sample.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Logged sample ${sampleNumber} (${sample.fragranceName}) — Status ${sample.status}`
    });
    return sample;
  });
}

export async function recordQcInspectionTransaction(
  actor: ErpActorContext,
  payload: {
    inspectionType: string;
    batchId?: string;
    sampleId?: string;
    subjectName: string;
    abvTestedPct: number;
    specificGravity?: number;
    refractiveIndex?: number;
    gcmsMatchPct: number;
    clarityResult: string;
    olfactoryResult: string;
    microbiologyPass?: boolean;
    decision: 'PASSED' | 'FAILED' | 'QUARANTINED';
    correctiveAction?: string;
  }
) {
  if (!payload.subjectName?.trim()) throw new ValidationError('Inspection subject name is required.');
  return await db.transaction(async (tx) => {
    const qcNumber = await getNextSequence(tx, 'QC');
    const [qc] = await tx
      .insert(erpQcRecords)
      .values({
        id: makeId('qc'),
        organizationId: ORG_ID,
        qcNumber,
        inspectionType: payload.inspectionType || 'FINISHED_BATCH_RELEASE',
        batchId: payload.batchId || null,
        sampleId: payload.sampleId || null,
        subjectName: payload.subjectName.trim(),
        abvTestedPct: Number(payload.abvTestedPct || 80),
        specificGravity: Number(payload.specificGravity || 0.845),
        refractiveIndex: Number(payload.refractiveIndex || 1.368),
        gcmsMatchPct: Number(payload.gcmsMatchPct || 99.2),
        clarityResult: payload.clarityResult || 'CRYSTAL_CLEAR',
        olfactoryResult: payload.olfactoryResult || 'CONFORMS',
        microbiologyPass: payload.microbiologyPass !== false,
        decision: payload.decision,
        correctiveAction: payload.correctiveAction || null,
        inspectorEmail: actor.email,
        approvedByEmail: actor.email,
        approvedAt: new Date(),
        status: payload.decision === 'QUARANTINED' ? 'QUARANTINED' : 'COMPLETED'
      })
      .returning();

    // Sync with linked production batch if provided
    if (payload.batchId) {
      await tx
        .update(productionBatches)
        .set({
          qcStatus: payload.decision,
          updatedAt: new Date()
        })
        .where(eq(productionBatches.id, payload.batchId));
    }

    if (payload.decision === 'FAILED' || payload.decision === 'QUARANTINED') {
      await createErpNotification(tx, {
        departmentCode: 'QC',
        severity: 'CRITICAL',
        category: 'QC_HOLD',
        title: `QC ${payload.decision}: ${qcNumber}`,
        message: `${payload.subjectName} flagged ${payload.decision}. Corrective action: ${payload.correctiveAction || 'Review lab log.'}`,
        linkModule: 'quality',
        linkEntityId: qc.id
      });
    }

    await recordErpAuditLog(tx, {
      action: 'ERP_QC_RECORDED',
      entity: 'erp_qc_records',
      entityId: qc.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `QC ${qcNumber} decision=${payload.decision} (GC-MS ${payload.gcmsMatchPct}%, ABV ${payload.abvTestedPct}%)`
    });
    return qc;
  });
}

export async function adjustFinishedGoodsWarehouseBin(
  actor: ErpActorContext,
  payload: {
    id: string;
    warehouseId?: string;
    binLocation?: string;
    quantityDelta?: number;
    status?: string;
    expectedVersion?: number;
  }
) {
  return await db.transaction(async (tx) => {
    const rows = await tx.select().from(erpFinishedGoods).where(eq(erpFinishedGoods.id, payload.id));
    if (!rows.length) throw new NotFoundError('Finished goods SKU record not found.');
    const cur = rows[0];
    if (payload.expectedVersion !== undefined && cur.version !== payload.expectedVersion) {
      throw new ConflictError(`Finished goods bin ${cur.sku} was modified concurrently.`);
    }
    const delta = Number(payload.quantityDelta || 0);
    const nextOnHand = Math.max(0, cur.quantityOnHand + delta);
    const nextAvail = Math.max(0, nextOnHand - cur.quantityReserved);
    const nextStatus = payload.status || (nextAvail <= 0 ? 'DEPLETED' : nextAvail < 15 ? 'LOW_STOCK' : 'ACTIVE');

    const [updated] = await tx
      .update(erpFinishedGoods)
      .set({
        warehouseId: payload.warehouseId || cur.warehouseId,
        binLocation: payload.binLocation || cur.binLocation,
        quantityOnHand: nextOnHand,
        quantityAvailable: nextAvail,
        status: nextStatus,
        version: sql`${erpFinishedGoods.version} + 1`,
        updatedAt: new Date()
      })
      .where(eq(erpFinishedGoods.id, payload.id))
      .returning();

    await recordErpAuditLog(tx, {
      action: 'ERP_FG_BIN_UPDATED',
      entity: 'erp_finished_goods',
      entityId: updated.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Adjusted SKU ${updated.sku} bin=${updated.binLocation}, delta=${delta}, available=${updated.quantityAvailable}`
    });
    return updated;
  });
}

// ============================================================================
// B2B CRM LEADS, PROPOSALS & QUOTATIONS
// ============================================================================

export async function createOrUpdateLead(
  actor: ErpActorContext,
  payload: {
    id?: string;
    companyName: string;
    contactName: string;
    email: string;
    phone: string;
    city?: string;
    state?: string;
    leadType?: string;
    source?: string;
    estimatedValueInr?: number;
    stage?: string;
    notes?: string;
    expectedVersion?: number;
  }
) {
  if (!payload.companyName?.trim() || !payload.email?.trim()) {
    throw new ValidationError('Company name and email are required for CRM leads.');
  }

  if (payload.id) {
    const existing = await db.select().from(erpLeads).where(eq(erpLeads.id, payload.id));
    if (!existing.length) throw new NotFoundError('Lead not found.');
    if (payload.expectedVersion !== undefined && existing[0].version !== payload.expectedVersion) {
      throw new ConflictError('Lead was modified by another team member.');
    }
    const [updated] = await db
      .update(erpLeads)
      .set({
        companyName: payload.companyName.trim(),
        contactName: payload.contactName || existing[0].contactName,
        email: payload.email.trim(),
        phone: payload.phone || existing[0].phone,
        city: payload.city || existing[0].city,
        state: payload.state || existing[0].state,
        leadType: payload.leadType || existing[0].leadType,
        estimatedValueInr: payload.estimatedValueInr ?? existing[0].estimatedValueInr,
        stage: payload.stage || existing[0].stage,
        notes: payload.notes ?? existing[0].notes,
        version: sql`${erpLeads.version} + 1`,
        updatedAt: new Date()
      })
      .where(eq(erpLeads.id, payload.id))
      .returning();
    return updated;
  }

  return await db.transaction(async (tx) => {
    const leadNumber = await getNextSequence(tx, 'LEAD');
    const [created] = await tx
      .insert(erpLeads)
      .values({
        id: makeId('lead'),
        organizationId: ORG_ID,
        leadNumber,
        companyName: payload.companyName.trim(),
        contactName: payload.contactName?.trim() || payload.companyName.trim(),
        email: payload.email.trim().toLowerCase(),
        phone: payload.phone || '+91 98000 00000',
        city: payload.city || 'Mumbai',
        state: payload.state || 'Maharashtra',
        leadType: payload.leadType || 'CORPORATE_GIFTING',
        source: payload.source || 'Direct B2B Desk',
        estimatedValueInr: Number(payload.estimatedValueInr || 0),
        stage: payload.stage || 'NEW',
        assignedToEmail: actor.email,
        nextFollowUpDate: addDaysIso(3),
        notes: payload.notes || null
      })
      .returning();

    await recordErpAuditLog(tx, {
      action: 'ERP_LEAD_CREATED',
      entity: 'erp_leads',
      entityId: created.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Created B2B Lead ${leadNumber}: ${created.companyName} (₹${created.estimatedValueInr})`
    });
    return created;
  });
}

export async function convertLeadToCustomerTransaction(actor: ErpActorContext, leadId: string) {
  return await db.transaction(async (tx) => {
    const leadRows = await tx.select().from(erpLeads).where(eq(erpLeads.id, leadId));
    if (!leadRows.length) throw new NotFoundError('CRM lead not found.');
    const lead = leadRows[0];

    // Check if customer already exists by email so we never overwrite real customer accounts
    const existingCust = await tx.select().from(customers).where(eq(customers.email, lead.email.toLowerCase()));
    let customerId = existingCust[0]?.id;

    if (!customerId) {
      customerId = makeId('cust-b2b');
      await tx.insert(customers).values({
        id: customerId,
        name: `${lead.contactName} (${lead.companyName})`,
        email: lead.email.toLowerCase(),
        phone: lead.phone || '0000000000',
        city: lead.city || '',
        state: lead.state || '',
        tier: 'B2B',
        tags: ['B2B Corporate', lead.leadType],
        totalOrders: 0,
        totalSpend: 0,
        favouriteFragrance: 'OBLIQUE WOODS',
        wishlistSlugs: [],
        source: `ERP Lead ${lead.leadNumber}`,
        notes: lead.notes || `Converted from CRM Lead ${lead.leadNumber}`,
        communicationHistory: [],
        crmMetadata: {
          leadNumber: lead.leadNumber,
          companyName: lead.companyName,
          isDiscoveryBuyer: false,
          registeredDate: currentIsoDate()
        }
      });
    }

    const [updatedLead] = await tx
      .update(erpLeads)
      .set({
        stage: 'WON',
        convertedCustomerId: customerId,
        version: sql`${erpLeads.version} + 1`,
        updatedAt: new Date()
      })
      .where(eq(erpLeads.id, lead.id))
      .returning();

    await recordErpAuditLog(tx, {
      action: 'ERP_LEAD_CONVERTED_TO_CUSTOMER',
      entity: 'erp_leads',
      entityId: lead.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Converted lead ${lead.leadNumber} (${lead.companyName}) -> Customer ID ${customerId}`
    });
    return { lead: updatedLead, customerId };
  });
}

export async function createProposal(
  actor: ErpActorContext,
  payload: {
    leadId?: string;
    title: string;
    clientCompany: string;
    clientContactName: string;
    clientEmail: string;
    scopeSummary: string;
    lineItems: Array<{ sku?: string; description: string; hsnCode?: string; qty: number; unitPriceInr: number }>;
    validUntil?: string;
  }
) {
  if (!payload.title?.trim() || !payload.clientCompany?.trim()) {
    throw new ValidationError('Proposal title and client company are required.');
  }
  const normalizedLines = (payload.lineItems || []).map((li) => ({
    sku: li.sku || 'BESPOKE-SKU',
    description: li.description,
    hsnCode: li.hsnCode || '33030050',
    qty: Number(li.qty || 1),
    unitPriceInr: Number(li.unitPriceInr || 0),
    totalInr: round2(Number(li.qty || 1) * Number(li.unitPriceInr || 0))
  }));
  const estimatedValueInr = Math.round(normalizedLines.reduce((s, li) => s + li.totalInr, 0));

  return await db.transaction(async (tx) => {
    const proposalNumber = await getNextSequence(tx, 'PROP');
    const [proposal] = await tx
      .insert(erpProposals)
      .values({
        id: makeId('prop'),
        organizationId: ORG_ID,
        leadId: payload.leadId || null,
        proposalNumber,
        title: payload.title.trim(),
        clientCompany: payload.clientCompany.trim(),
        clientContactName: payload.clientContactName || payload.clientCompany,
        clientEmail: payload.clientEmail || 'client@company.in',
        scopeSummary: payload.scopeSummary || 'Custom luxury fragrance curation & coffret fulfillment.',
        lineItems: normalizedLines,
        estimatedValueInr,
        validUntil: payload.validUntil || addDaysIso(30),
        preparedByEmail: actor.email,
        status: 'SENT'
      })
      .returning();

    await recordErpAuditLog(tx, {
      action: 'ERP_PROPOSAL_CREATED',
      entity: 'erp_proposals',
      entityId: proposal.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Created corporate proposal ${proposalNumber} for ${proposal.clientCompany} (₹${estimatedValueInr})`
    });
    return proposal;
  });
}

export async function createQuotationWithGst(
  actor: ErpActorContext,
  payload: {
    proposalId?: string;
    leadId?: string;
    clientName: string;
    clientEmail: string;
    clientGstin?: string;
    placeOfSupplyState: string;
    discountInr?: number;
    paymentTerms?: string;
    validUntil?: string;
    items: Array<{ sku?: string; description: string; hsnCode?: string; qty: number; unitPriceInr: number; gstRatePct?: number }>;
  }
) {
  if (!payload.clientName?.trim() || !Array.isArray(payload.items) || !payload.items.length) {
    throw new ValidationError('Client name and at least one quotation item are required.');
  }

  return await db.transaction(async (tx) => {
    const [org] = await tx.select().from(erpOrganizations).where(eq(erpOrganizations.id, ORG_ID));
    const orgState = (org?.stateName || 'Maharashtra').trim().toLowerCase();
    const supplyState = (payload.placeOfSupplyState || 'Maharashtra').trim();
    const isInterState = supplyState.toLowerCase() !== orgState;

    const normalizedItems = payload.items.map((it) => {
      const qty = Number(it.qty || 1);
      const price = Number(it.unitPriceInr || 0);
      const gstRatePct = Number(it.gstRatePct ?? 18);
      const lineSub = round2(qty * price);
      return {
        sku: it.sku || 'FRG-SKU',
        description: it.description,
        hsnCode: it.hsnCode || '33030050',
        qty,
        unitPriceInr: price,
        discountInr: 0,
        gstRatePct,
        lineTotalInr: lineSub
      };
    });

    const subtotalInr = round2(normalizedItems.reduce((s, it) => s + it.lineTotalInr, 0));
    const discountInr = round2(Math.min(subtotalInr, Number(payload.discountInr || 0)));
    const taxableAmountInr = round2(Math.max(0, subtotalInr - discountInr));
    const totalGst = round2(taxableAmountInr * 0.18);
    const cgstInr = isInterState ? 0 : round2(totalGst / 2);
    const sgstInr = isInterState ? 0 : round2(totalGst - cgstInr);
    const igstInr = isInterState ? totalGst : 0;
    const totalInr = round2(taxableAmountInr + cgstInr + sgstInr + igstInr);

    const quotationNumber = await getNextSequence(tx, 'QT');
    const [qt] = await tx
      .insert(erpQuotations)
      .values({
        id: makeId('qt'),
        organizationId: ORG_ID,
        proposalId: payload.proposalId || null,
        leadId: payload.leadId || null,
        quotationNumber,
        clientName: payload.clientName.trim(),
        clientEmail: payload.clientEmail || 'client@company.in',
        clientGstin: payload.clientGstin || null,
        placeOfSupplyState: supplyState,
        isInterState,
        items: normalizedItems,
        subtotalInr,
        discountInr,
        taxableAmountInr,
        cgstInr,
        sgstInr,
        igstInr,
        totalInr,
        paymentTerms: payload.paymentTerms || '50% Advance, 50% Against Dispatch',
        validUntil: payload.validUntil || addDaysIso(21),
        createdByEmail: actor.email,
        status: 'APPROVED'
      })
      .returning();

    await recordErpAuditLog(tx, {
      action: 'ERP_QUOTATION_CREATED',
      entity: 'erp_quotations',
      entityId: qt.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Created quotation ${quotationNumber} for ${qt.clientName}: ₹${totalInr} (${isInterState ? 'IGST' : 'CGST+SGST'})`
    });
    return qt;
  });
}

// ============================================================================
// GST BILLING, INVOICING, CREDIT NOTES, PAYMENTS & DOUBLE-ENTRY ACCOUNTING
// ============================================================================

export async function createGstInvoiceTransaction(
  actor: ErpActorContext,
  payload: {
    quotationId?: string;
    orderId?: string;
    customerName?: string;
    customerEmail?: string;
    customerGstin?: string;
    billingAddress?: string;
    placeOfSupplyState?: string;
    discountInr?: number;
    shippingInr?: number;
    items?: Array<{ sku?: string; description: string; hsnCode?: string; qty: number; unitPriceInr: number; gstRatePct?: number }>;
    idempotencyKey?: string;
  }
) {
  if (payload.idempotencyKey) {
    const dup = await db.select().from(erpInvoices).where(eq(erpInvoices.idempotencyKey, payload.idempotencyKey));
    if (dup.length) return { invoice: dup[0], deduplicated: true };
  }

  return await db.transaction(async (tx) => {
    const [org] = await tx.select().from(erpOrganizations).where(eq(erpOrganizations.id, ORG_ID));
    const orgState = (org?.stateName || 'Maharashtra').trim().toLowerCase();

    let customerName = payload.customerName || '';
    let customerEmail = payload.customerEmail || '';
    let customerGstin = payload.customerGstin || null;
    let billingAddress = payload.billingAddress || '';
    let supplyState = payload.placeOfSupplyState || 'Maharashtra';
    let itemsInput = payload.items || [];
    let discountInr = Number(payload.discountInr || 0);
    let shippingInr = Number(payload.shippingInr || 0);
    let quotation: any = null;
    let order: any = null;

    if (payload.quotationId) {
      const qtRows = await tx.select().from(erpQuotations).where(eq(erpQuotations.id, payload.quotationId));
      if (!qtRows.length) throw new NotFoundError('Quotation not found.');
      quotation = qtRows[0];
      if (quotation.status === 'CONVERTED' && quotation.convertedInvoiceId) {
        const existingInv = await tx.select().from(erpInvoices).where(eq(erpInvoices.id, quotation.convertedInvoiceId));
        if (existingInv.length) return { invoice: existingInv[0], deduplicated: true };
      }
      customerName = quotation.clientName;
      customerEmail = quotation.clientEmail;
      customerGstin = quotation.clientGstin;
      supplyState = quotation.placeOfSupplyState;
      discountInr = Number(quotation.discountInr || 0);
      itemsInput = (quotation.items as any[]) || [];
    } else if (payload.orderId) {
      const ordRows = await tx.select().from(orders).where(eq(orders.id, payload.orderId));
      if (!ordRows.length) throw new NotFoundError('Storefront order not found.');
      order = ordRows[0];
      customerName = order.customerName;
      customerEmail = order.customerEmail;
      const addr: any = order.shippingAddress || {};
      supplyState = addr.state || 'Maharashtra';
      billingAddress = [addr.addressLine1, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ');
      discountInr = Number(order.discount || 0);
      shippingInr = Number(order.shippingAmount || 0);
      itemsInput = ((order.items as any[]) || []).map((it) => ({
        sku: it.sku || 'FRG-SKU',
        description: `${it.productName} (${it.size})`,
        hsnCode: '33030050',
        qty: Number(it.quantity || 1),
        unitPriceInr: round2(Number(it.unitPrice || 0) / 1.18), // Price on storefront is GST-inclusive
        gstRatePct: 18
      }));
    }

    if (!customerName?.trim() || !itemsInput.length) {
      throw new ValidationError('Customer name and at least one invoice line item are required.');
    }

    const isInterState = supplyState.trim().toLowerCase() !== orgState;

    const computedLines = itemsInput.map((it) => {
      const qty = Number(it.qty || 1);
      const unitPriceInr = round2(Number(it.unitPriceInr || 0));
      const gstRatePct = Number(it.gstRatePct ?? 18);
      const taxableValueInr = round2(qty * unitPriceInr);
      const taxLine = round2((taxableValueInr * gstRatePct) / 100);
      const cgstInr = isInterState ? 0 : round2(taxLine / 2);
      const sgstInr = isInterState ? 0 : round2(taxLine - cgstInr);
      const igstInr = isInterState ? taxLine : 0;
      return {
        sku: it.sku || 'FRG-SKU',
        description: it.description,
        hsnCode: it.hsnCode || '33030050',
        qty,
        unitPriceInr,
        discountInr: 0,
        taxableValueInr,
        gstRatePct,
        cgstInr,
        sgstInr,
        igstInr,
        totalInr: round2(taxableValueInr + cgstInr + sgstInr + igstInr)
      };
    });

    const subtotalInr = round2(computedLines.reduce((s, l) => s + l.taxableValueInr, 0));
    const appliedDiscount = round2(Math.min(subtotalInr, discountInr));
    const taxableAmountInr = round2(Math.max(0, subtotalInr - appliedDiscount));
    const discountRatio = subtotalInr > 0 ? taxableAmountInr / subtotalInr : 1;

    const cgstAmountInr = round2(computedLines.reduce((s, l) => s + l.cgstInr, 0) * discountRatio);
    const sgstAmountInr = round2(computedLines.reduce((s, l) => s + l.sgstInr, 0) * discountRatio);
    const igstAmountInr = round2(computedLines.reduce((s, l) => s + l.igstInr, 0) * discountRatio);
    const totalTaxInr = round2(cgstAmountInr + sgstAmountInr + igstAmountInr);
    const grandTotalInr = round2(taxableAmountInr + totalTaxInr + shippingInr);

    const invoiceNumber = await getNextSequence(tx, 'INV');
    const invoiceId = makeId('inv');
    const issueDate = currentIsoDate();
    const dueDate = addDaysIso(15);

    const journalNumber = await getNextSequence(tx, 'JRN');
    const journalId = makeId('jrn');
    const revenueCredit = round2(taxableAmountInr + shippingInr);

    const jLines: any[] = [
      { accountCode: '1100', accountName: 'Accounts Receivable — Trade Debtors', accountType: 'ASSET', debitInr: grandTotalInr, creditInr: 0, costCenter: 'CC-410' },
      { accountCode: '4000', accountName: 'Luxury Fragrance & Gifting Revenue', accountType: 'REVENUE', debitInr: 0, creditInr: revenueCredit, costCenter: 'CC-410' }
    ];
    if (cgstAmountInr > 0) {
      jLines.push({ accountCode: '2210', accountName: 'Output CGST Payable', accountType: 'LIABILITY', debitInr: 0, creditInr: cgstAmountInr, costCenter: 'CC-510' });
    }
    if (sgstAmountInr > 0) {
      jLines.push({ accountCode: '2220', accountName: 'Output SGST Payable', accountType: 'LIABILITY', debitInr: 0, creditInr: sgstAmountInr, costCenter: 'CC-510' });
    }
    if (igstAmountInr > 0) {
      jLines.push({ accountCode: '2230', accountName: 'Output IGST Payable', accountType: 'LIABILITY', debitInr: 0, creditInr: igstAmountInr, costCenter: 'CC-510' });
    }

    await tx.insert(erpAccountingJournals).values({
      id: journalId,
      organizationId: ORG_ID,
      journalNumber,
      entryDate: issueDate,
      fiscalPeriod: getFiscalPeriod(issueDate),
      sourceModule: 'SALES_INVOICE',
      sourceEntityId: invoiceId,
      narration: `Tax Invoice ${invoiceNumber} issued to ${customerName} (${isInterState ? 'Inter-State IGST' : 'Intra-State CGST+SGST'})`,
      lines: jLines,
      totalDebitInr: grandTotalInr,
      totalCreditInr: grandTotalInr,
      isBalanced: true,
      postedByEmail: actor.email,
      status: 'POSTED'
    });

    const isPrepaidOrder = Boolean(order && order.paymentStatus === 'PAID');
    const amountPaidInr = isPrepaidOrder ? grandTotalInr : 0;
    const balanceDueInr = isPrepaidOrder ? 0 : grandTotalInr;

    const [invoice] = await tx
      .insert(erpInvoices)
      .values({
        id: invoiceId,
        organizationId: ORG_ID,
        orderId: order?.id || null,
        quotationId: quotation?.id || null,
        invoiceNumber,
        invoiceType: customerGstin ? 'B2B_GST_INVOICE' : 'TAX_INVOICE',
        issueDate,
        dueDate,
        customerName: customerName.trim(),
        customerEmail: customerEmail || 'client@fragmore.shop',
        customerGstin,
        billingAddress: billingAddress || `${supplyState}, India`,
        placeOfSupplyState: supplyState,
        isInterState,
        items: computedLines,
        subtotalInr,
        discountInr: appliedDiscount,
        taxableAmountInr,
        cgstAmountInr,
        sgstAmountInr,
        igstAmountInr,
        totalTaxInr,
        shippingInr,
        grandTotalInr,
        amountPaidInr,
        balanceDueInr,
        journalId,
        paymentStatus: isPrepaidOrder ? 'PAID' : 'UNPAID',
        status: isPrepaidOrder ? 'SETTLED' : 'ISSUED',
        createdByEmail: actor.email,
        idempotencyKey: payload.idempotencyKey || null
      })
      .returning();

    if (isPrepaidOrder) {
      const settleJrnNum = await getNextSequence(tx, 'JRN');
      const settlePayNum = await getNextSequence(tx, 'PAY');
      const settleJrnId = makeId('jrn');
      await tx.insert(erpAccountingJournals).values({
        id: settleJrnId,
        organizationId: ORG_ID,
        journalNumber: settleJrnNum,
        entryDate: issueDate,
        fiscalPeriod: getFiscalPeriod(issueDate),
        sourceModule: 'PAYMENT',
        sourceEntityId: invoice.id,
        narration: `Storefront payment settlement for ${invoiceNumber} (${order.orderNumber})`,
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
        direction: 'INBOUND_RECEIPT',
        partyType: 'CUSTOMER',
        partyName: customerName,
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

    if (quotation) {
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
      action: 'ERP_INVOICE_ISSUED',
      entity: 'erp_invoices',
      entityId: invoice.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Issued GST Invoice ${invoiceNumber} (${customerName}) = ₹${grandTotalInr} | Journal ${journalNumber}`
    });

    return { invoice, journalNumber };
  });
}

export async function recordPaymentTransaction(
  actor: ErpActorContext,
  payload: {
    direction: 'INBOUND_RECEIPT' | 'OUTBOUND_PAYOUT';
    partyType?: string;
    partyName?: string;
    invoiceId?: string;
    purchaseOrderId?: string;
    method: string;
    referenceNumber: string;
    amountInr: number;
    paymentDate?: string;
    notes?: string;
    expectedInvoiceVersion?: number;
    idempotencyKey?: string;
  }
) {
  const amt = round2(Number(payload.amountInr || 0));
  if (amt <= 0) throw new ValidationError('Payment amount must be greater than zero.');
  if (!payload.referenceNumber?.trim()) throw new ValidationError('Payment reference/UTR number is required.');

  if (payload.idempotencyKey) {
    const dup = await db.select().from(erpPayments).where(eq(erpPayments.idempotencyKey, payload.idempotencyKey));
    if (dup.length) return { payment: dup[0], deduplicated: true };
  }

  return await db.transaction(async (tx) => {
    const paymentDate = payload.paymentDate || currentIsoDate();
    const paymentNumber = await getNextSequence(tx, 'PAY');
    const journalNumber = await getNextSequence(tx, 'JRN');
    const journalId = makeId('jrn');
    let partyName = payload.partyName || 'Counterparty';
    let updatedInvoice: any = null;

    if (payload.invoiceId) {
      const invRows = await tx.select().from(erpInvoices).where(eq(erpInvoices.id, payload.invoiceId));
      if (!invRows.length) throw new NotFoundError('Referenced GST Invoice not found.');
      const inv = invRows[0];
      if (payload.expectedInvoiceVersion !== undefined && inv.version !== payload.expectedInvoiceVersion) {
        throw new ConflictError(`Invoice ${inv.invoiceNumber} was updated concurrently.`);
      }
      if (inv.balanceDueInr <= 0) throw new ValidationError(`Invoice ${inv.invoiceNumber} is already settled.`);
      if (amt > inv.balanceDueInr + 0.5) {
        throw new ValidationError(`Payment ₹${amt} exceeds invoice balance due ₹${inv.balanceDueInr}.`);
      }

      partyName = inv.customerName;
      const newPaid = round2(inv.amountPaidInr + amt);
      const newBal = round2(Math.max(0, inv.grandTotalInr - newPaid));
      const newPayStatus = newBal <= 0.05 ? 'PAID' : 'PARTIAL';

      const [upd] = await tx
        .update(erpInvoices)
        .set({
          amountPaidInr: newPaid,
          balanceDueInr: newBal,
          paymentStatus: newPayStatus,
          status: newPayStatus === 'PAID' ? 'SETTLED' : inv.status,
          version: sql`${erpInvoices.version} + 1`,
          updatedAt: new Date()
        })
        .where(eq(erpInvoices.id, inv.id))
        .returning();
      updatedInvoice = upd;
    } else if (payload.purchaseOrderId) {
      const poRows = await tx.select().from(supplierPurchaseOrders).where(eq(supplierPurchaseOrders.id, payload.purchaseOrderId));
      if (!poRows.length) throw new NotFoundError('Referenced Purchase Order not found.');
      const po = poRows[0];
      partyName = po.supplierName;
      const poPaidStatus = amt >= po.totalCostInr - 1 ? 'PAID' : 'PARTIALLY_PAID';
      await tx
        .update(supplierPurchaseOrders)
        .set({ paymentStatus: poPaidStatus, updatedAt: new Date() })
        .where(eq(supplierPurchaseOrders.id, po.id));
    }

    const journalLines =
      payload.direction === 'INBOUND_RECEIPT'
        ? [
            { accountCode: '1010', accountName: 'HDFC Operating Bank Account', accountType: 'ASSET', debitInr: amt, creditInr: 0, costCenter: 'CC-510' },
            { accountCode: '1100', accountName: 'Accounts Receivable — Trade Debtors', accountType: 'ASSET', debitInr: 0, creditInr: amt, costCenter: 'CC-410' }
          ]
        : [
            { accountCode: '2100', accountName: 'Accounts Payable — Trade Suppliers', accountType: 'LIABILITY', debitInr: amt, creditInr: 0, costCenter: 'CC-210' },
            { accountCode: '1010', accountName: 'HDFC Operating Bank Account', accountType: 'ASSET', debitInr: 0, creditInr: amt, costCenter: 'CC-510' }
          ];

    await tx.insert(erpAccountingJournals).values({
      id: journalId,
      organizationId: ORG_ID,
      journalNumber,
      entryDate: paymentDate,
      fiscalPeriod: getFiscalPeriod(paymentDate),
      sourceModule: 'PAYMENT',
      sourceEntityId: payload.invoiceId || payload.purchaseOrderId || paymentNumber,
      narration: `${payload.direction} ${paymentNumber} (${payload.method} Ref: ${payload.referenceNumber}) — ${partyName}`,
      lines: journalLines,
      totalDebitInr: amt,
      totalCreditInr: amt,
      isBalanced: true,
      postedByEmail: actor.email,
      status: 'POSTED'
    });

    const [payment] = await tx
      .insert(erpPayments)
      .values({
        id: makeId('pay'),
        organizationId: ORG_ID,
        paymentNumber,
        direction: payload.direction,
        partyType: payload.partyType || (payload.direction === 'INBOUND_RECEIPT' ? 'CUSTOMER' : 'SUPPLIER'),
        partyName,
        invoiceId: payload.invoiceId || null,
        purchaseOrderId: payload.purchaseOrderId || null,
        paymentDate,
        method: payload.method || 'NEFT',
        referenceNumber: payload.referenceNumber.trim(),
        amountInr: amt,
        journalId,
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
      details: `Posted ${paymentNumber} (${payload.direction}) ₹${amt} — ${partyName} | Journal ${journalNumber}`
    });

    return { payment, updatedInvoice, journalNumber };
  });
}

export async function issueCreditNoteTransaction(
  actor: ErpActorContext,
  payload: {
    invoiceId: string;
    reason: string;
    taxableAmountInr: number;
  }
) {
  const taxable = round2(Number(payload.taxableAmountInr || 0));
  if (taxable <= 0) throw new ValidationError('Credit note taxable amount must be positive.');
  if (!payload.reason?.trim()) throw new ValidationError('Credit note reason is required.');

  return await db.transaction(async (tx) => {
    const invRows = await tx.select().from(erpInvoices).where(eq(erpInvoices.id, payload.invoiceId));
    if (!invRows.length) throw new NotFoundError('Invoice not found.');
    const inv = invRows[0];

    const gst = round2(taxable * 0.18);
    const cgstInr = inv.isInterState ? 0 : round2(gst / 2);
    const sgstInr = inv.isInterState ? 0 : round2(gst - cgstInr);
    const igstInr = inv.isInterState ? gst : 0;
    const totalCreditInr = round2(taxable + cgstInr + sgstInr + igstInr);

    const cnNumber = await getNextSequence(tx, 'CN');
    const jrnNumber = await getNextSequence(tx, 'JRN');
    const journalId = makeId('jrn');
    const cnId = makeId('cn');
    const issueDate = currentIsoDate();

    const jLines: any[] = [
      { accountCode: '4010', accountName: 'Sales Returns & Allowances', accountType: 'REVENUE', debitInr: taxable, creditInr: 0, costCenter: 'CC-410' }
    ];
    if (cgstInr > 0) jLines.push({ accountCode: '2210', accountName: 'Output CGST Payable', accountType: 'LIABILITY', debitInr: cgstInr, creditInr: 0, costCenter: 'CC-510' });
    if (sgstInr > 0) jLines.push({ accountCode: '2220', accountName: 'Output SGST Payable', accountType: 'LIABILITY', debitInr: sgstInr, creditInr: 0, costCenter: 'CC-510' });
    if (igstInr > 0) jLines.push({ accountCode: '2230', accountName: 'Output IGST Payable', accountType: 'LIABILITY', debitInr: igstInr, creditInr: 0, costCenter: 'CC-510' });
    jLines.push({ accountCode: '1100', accountName: 'Accounts Receivable — Trade Debtors', accountType: 'ASSET', debitInr: 0, creditInr: totalCreditInr, costCenter: 'CC-410' });

    await tx.insert(erpAccountingJournals).values({
      id: journalId,
      organizationId: ORG_ID,
      journalNumber: jrnNumber,
      entryDate: issueDate,
      fiscalPeriod: getFiscalPeriod(issueDate),
      sourceModule: 'CREDIT_NOTE',
      sourceEntityId: cnId,
      narration: `GST Credit Note ${cnNumber} against ${inv.invoiceNumber}: ${payload.reason}`,
      lines: jLines,
      totalDebitInr: totalCreditInr,
      totalCreditInr: totalCreditInr,
      isBalanced: true,
      postedByEmail: actor.email,
      status: 'POSTED'
    });

    const [creditNote] = await tx
      .insert(erpCreditNotes)
      .values({
        id: cnId,
        organizationId: ORG_ID,
        invoiceId: inv.id,
        creditNoteNumber: cnNumber,
        issueDate,
        customerName: inv.customerName,
        customerEmail: inv.customerEmail,
        reason: payload.reason.trim(),
        taxableAmountInr: taxable,
        cgstInr,
        sgstInr,
        igstInr,
        totalCreditInr,
        journalId,
        createdByEmail: actor.email,
        approvedByEmail: actor.email,
        status: 'APPLIED'
      })
      .returning();

    const newBalance = round2(Math.max(0, inv.balanceDueInr - totalCreditInr));
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
      action: 'ERP_CREDIT_NOTE_ISSUED',
      entity: 'erp_credit_notes',
      entityId: cnId,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Issued Credit Note ${cnNumber} for ${inv.invoiceNumber}: ₹${totalCreditInr}`
    });
    return { creditNote, journalNumber: jrnNumber };
  });
}

export async function createManualAccountingJournal(
  actor: ErpActorContext,
  payload: {
    entryDate?: string;
    narration: string;
    lines: Array<{ accountCode: string; accountName: string; accountType: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'; debitInr: number; creditInr: number; costCenter?: string }>;
  }
) {
  if (!payload.narration?.trim()) throw new ValidationError('Journal narration is required.');
  if (!Array.isArray(payload.lines) || payload.lines.length < 2) {
    throw new ValidationError('Double-entry journal requires at least 2 balanced ledger lines.');
  }
  const totalDebit = round2(payload.lines.reduce((s, l) => s + Number(l.debitInr || 0), 0));
  const totalCredit = round2(payload.lines.reduce((s, l) => s + Number(l.creditInr || 0), 0));
  if (totalDebit <= 0 || Math.abs(totalDebit - totalCredit) >= 0.01) {
    throw new ValidationError(`Journal entry is unbalanced: Debits ₹${totalDebit} != Credits ₹${totalCredit}.`);
  }

  return await db.transaction(async (tx) => {
    const entryDate = payload.entryDate || currentIsoDate();
    const journalNumber = await getNextSequence(tx, 'JRN');
    const [journal] = await tx
      .insert(erpAccountingJournals)
      .values({
        id: makeId('jrn'),
        organizationId: ORG_ID,
        journalNumber,
        entryDate,
        fiscalPeriod: getFiscalPeriod(entryDate),
        sourceModule: 'MANUAL',
        narration: payload.narration.trim(),
        lines: payload.lines,
        totalDebitInr: totalDebit,
        totalCreditInr: totalCredit,
        isBalanced: true,
        postedByEmail: actor.email,
        status: 'POSTED'
      })
      .returning();

    await recordErpAuditLog(tx, {
      action: 'ERP_JOURNAL_POSTED',
      entity: 'erp_accounting_journals',
      entityId: journal.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Posted manual journal ${journalNumber} = ₹${totalDebit}`
    });
    return journal;
  });
}

// ============================================================================
// MARKETING WORKSPACE, HR (EMPLOYEES, INTERNS, TASKS), APPROVALS, RBAC & ORG
// ============================================================================

export async function createMarketingBrief(
  actor: ErpActorContext,
  payload: {
    title: string;
    channel: string;
    creativeFormat: string;
    targetAudience: string;
    budgetInr: number;
    spendInr?: number;
    revenueAttributedInr?: number;
    leadsCount?: number;
    creativeCopy?: string;
    status?: string;
  }
) {
  if (!payload.title?.trim()) throw new ValidationError('Deliverable title is required.');
  return await db.transaction(async (tx) => {
    const briefCode = await getNextSequence(tx, 'MKT');
    const [brief] = await tx
      .insert(erpMarketingWorkspace)
      .values({
        id: makeId('mkt'),
        organizationId: ORG_ID,
        briefCode,
        title: payload.title.trim(),
        channel: payload.channel || 'META_ADS',
        creativeFormat: payload.creativeFormat || 'REEL',
        targetAudience: payload.targetAudience || 'Luxury Buyers Tier-1 Cities',
        budgetInr: Number(payload.budgetInr || 0),
        spendInr: Number(payload.spendInr || 0),
        revenueAttributedInr: Number(payload.revenueAttributedInr || 0),
        leadsCount: Number(payload.leadsCount || 0),
        assigneeEmail: actor.email,
        scheduledDate: currentIsoDate(),
        creativeCopy: payload.creativeCopy || null,
        status: payload.status || 'IN_PRODUCTION'
      })
      .returning();

    await recordErpAuditLog(tx, {
      action: 'ERP_MARKETING_BRIEF_CREATED',
      entity: 'erp_marketing_workspace',
      entityId: brief.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Created Marketing Brief ${briefCode}: ${brief.title} (${brief.channel})`
    });
    return brief;
  });
}

export async function createEmployeeRecord(
  actor: ErpActorContext,
  payload: {
    fullName: string;
    email: string;
    phone: string;
    designation: string;
    departmentId?: string;
    employmentType?: string;
    monthlySalaryInr: number;
    locationCity?: string;
  }
) {
  if (!payload.fullName?.trim() || !payload.email?.trim()) {
    throw new ValidationError('Employee name and email are required.');
  }
  return await db.transaction(async (tx) => {
    const employeeCode = await getNextSequence(tx, 'EMP');
    const [emp] = await tx
      .insert(erpEmployees)
      .values({
        id: makeId('emp'),
        organizationId: ORG_ID,
        departmentId: payload.departmentId || 'dept-exec',
        employeeCode,
        fullName: payload.fullName.trim(),
        email: payload.email.trim().toLowerCase(),
        phone: payload.phone || '+91 98000 00000',
        designation: payload.designation || 'Specialist',
        employmentType: payload.employmentType || 'FULL_TIME',
        joiningDate: currentIsoDate(),
        monthlySalaryInr: Number(payload.monthlySalaryInr || 0),
        locationCity: payload.locationCity || 'Mumbai',
        reportingManagerEmail: actor.email,
        status: 'ACTIVE'
      })
      .returning();

    await recordErpAuditLog(tx, {
      action: 'ERP_EMPLOYEE_CREATED',
      entity: 'erp_employees',
      entityId: emp.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Onboarded ${employeeCode}: ${emp.fullName} (${emp.designation})`
    });
    return emp;
  });
}

export async function createInternRecord(
  actor: ErpActorContext,
  payload: {
    fullName: string;
    email: string;
    phone: string;
    university: string;
    track: string;
    stipendMonthlyInr: number;
    projectTitle: string;
    departmentId?: string;
  }
) {
  if (!payload.fullName?.trim() || !payload.email?.trim()) {
    throw new ValidationError('Intern name and email are required.');
  }
  return await db.transaction(async (tx) => {
    const internCode = await getNextSequence(tx, 'INT');
    const [intern] = await tx
      .insert(erpInterns)
      .values({
        id: makeId('int'),
        organizationId: ORG_ID,
        departmentId: payload.departmentId || 'dept-hr',
        internCode,
        fullName: payload.fullName.trim(),
        email: payload.email.trim().toLowerCase(),
        phone: payload.phone || '+91 98000 00000',
        university: payload.university || 'University Cohort',
        track: payload.track || 'DIGITAL_MARKETING',
        mentorEmail: actor.email,
        startDate: currentIsoDate(),
        endDate: addDaysIso(120),
        stipendMonthlyInr: Number(payload.stipendMonthlyInr || 15000),
        projectTitle: payload.projectTitle || 'Business OS Operations Project',
        evaluationScore: 4.5,
        status: 'ACTIVE'
      })
      .returning();

    await recordErpAuditLog(tx, {
      action: 'ERP_INTERN_CREATED',
      entity: 'erp_interns',
      entityId: intern.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Onboarded intern ${internCode}: ${intern.fullName} (${intern.track})`
    });
    return intern;
  });
}

export async function createOrUpdateTask(
  actor: ErpActorContext,
  payload: {
    id?: string;
    title?: string;
    description?: string;
    sourceModule?: string;
    priority?: string;
    assignedToEmail?: string;
    dueDate?: string;
    status?: string;
    expectedVersion?: number;
  }
) {
  if (payload.id) {
    const rows = await db.select().from(erpTasks).where(eq(erpTasks.id, payload.id));
    if (!rows.length) throw new NotFoundError('Task not found.');
    if (payload.expectedVersion !== undefined && rows[0].version !== payload.expectedVersion) {
      throw new ConflictError('Task was updated concurrently.');
    }
    const [updated] = await db
      .update(erpTasks)
      .set({
        status: payload.status || rows[0].status,
        priority: payload.priority || rows[0].priority,
        assignedToEmail: payload.assignedToEmail || rows[0].assignedToEmail,
        completedAt: payload.status === 'DONE' ? new Date() : rows[0].completedAt,
        version: sql`${erpTasks.version} + 1`,
        updatedAt: new Date()
      })
      .where(eq(erpTasks.id, payload.id))
      .returning();
    return updated;
  }

  if (!payload.title?.trim()) throw new ValidationError('Task title is required.');
  return await db.transaction(async (tx) => {
    const taskNumber = await getNextSequence(tx, 'TSK');
    const [task] = await tx
      .insert(erpTasks)
      .values({
        id: makeId('tsk'),
        organizationId: ORG_ID,
        departmentId: 'dept-exec',
        taskNumber,
        title: payload.title!.trim(),
        description: payload.description || payload.title!.trim(),
        sourceModule: payload.sourceModule || 'hr',
        priority: payload.priority || 'MEDIUM',
        assignedToEmail: payload.assignedToEmail || actor.email,
        createdByEmail: actor.email,
        dueDate: payload.dueDate || addDaysIso(5),
        status: 'TODO'
      })
      .returning();
    return task;
  });
}

export async function decideApprovalItem(
  actor: ErpActorContext,
  payload: { approvalId: string; decision: 'APPROVED' | 'REJECTED'; note?: string }
) {
  return await db.transaction(async (tx) => {
    const rows = await tx.select().from(erpApprovals).where(eq(erpApprovals.id, payload.approvalId));
    if (!rows.length) throw new NotFoundError('Approval request not found.');
    const apr = rows[0];
    if (apr.status !== 'PENDING') {
      throw new ValidationError(`Approval ${apr.approvalNumber} is already ${apr.status}.`);
    }

    const [updated] = await tx
      .update(erpApprovals)
      .set({
        status: payload.decision,
        decidedByEmail: actor.email,
        decisionNote: payload.note || `${payload.decision} by ${actor.email}`,
        decidedAt: new Date(),
        version: sql`${erpApprovals.version} + 1`,
        updatedAt: new Date()
      })
      .where(eq(erpApprovals.id, apr.id))
      .returning();

    // Propagate approval decision to linked entity
    if (apr.entityType === 'FORMULATION_VERSION') {
      const targetStatus = payload.decision === 'APPROVED' ? 'APPROVED' : 'DRAFT';
      const [ver] = await tx
        .update(erpFormulationVersions)
        .set({
          status: targetStatus,
          approvedByEmail: payload.decision === 'APPROVED' ? actor.email : null,
          approvedAt: payload.decision === 'APPROVED' ? new Date() : null
        })
        .where(eq(erpFormulationVersions.id, apr.entityId))
        .returning();
      if (ver) {
        await tx
          .update(erpFormulations)
          .set({ status: targetStatus, updatedAt: new Date() })
          .where(eq(erpFormulations.id, ver.formulationId));
      }
    } else if (apr.entityType === 'QUOTATION') {
      await tx
        .update(erpQuotations)
        .set({
          status: payload.decision === 'APPROVED' ? 'APPROVED' : 'DRAFT',
          approvedByEmail: payload.decision === 'APPROVED' ? actor.email : null,
          updatedAt: new Date()
        })
        .where(eq(erpQuotations.id, apr.entityId));
    } else if (apr.entityType === 'PURCHASE_ORDER') {
      await tx
        .update(supplierPurchaseOrders)
        .set({
          approvalStatus: payload.decision === 'APPROVED' ? 'APPROVED' : 'REJECTED',
          approvedBy: payload.decision === 'APPROVED' ? actor.email : null,
          status: payload.decision === 'APPROVED' ? 'ORDERED' : 'CANCELLED',
          updatedAt: new Date()
        })
        .where(eq(supplierPurchaseOrders.id, apr.entityId));
    } else if (apr.entityType === 'PURCHASE_REQUISITION') {
      await tx
        .update(erpPurchaseRequisitions)
        .set({
          approvalStatus: payload.decision === 'APPROVED' ? 'APPROVED' : 'REJECTED',
          approvedByEmail: payload.decision === 'APPROVED' ? actor.email : null,
          status: payload.decision === 'APPROVED' ? 'OPEN' : 'REJECTED',
          updatedAt: new Date()
        })
        .where(eq(erpPurchaseRequisitions.id, apr.entityId));
    } else if (apr.entityType === 'VENDOR_INVOICE') {
      const vRows = await tx.select().from(erpVendorInvoices).where(eq(erpVendorInvoices.id, apr.entityId));
      if (vRows.length) {
        const vInv = vRows[0];
        if (payload.decision === 'APPROVED' && !vInv.journalPosted) {
          const taxable = round2(Number(vInv.subtotalInr || 0) + Number(vInv.freightInr || 0));
          const taxAmt = round2(Number(vInv.cgstInr || 0) + Number(vInv.sgstInr || 0) + Number(vInv.igstInr || 0));
          const totalAmt = round2(taxable + taxAmt);
          const jrnNo = await getNextSequence(tx, 'JRN');
          const jrnId = makeId('jrn');
          const lines: any[] = [
            { accountCode: '5150', accountName: 'Direct Non-PO Procurement & Services Expense', accountType: 'EXPENSE', debitInr: taxable, creditInr: 0, costCenter: 'CC-210' }
          ];
          if (taxAmt > 0) {
            lines.push({ accountCode: '1310', accountName: 'Input GST Credit Receivable (18%)', accountType: 'ASSET', debitInr: taxAmt, creditInr: 0, costCenter: 'CC-510' });
          }
          lines.push({ accountCode: '2100', accountName: 'Accounts Payable — Trade Suppliers', accountType: 'LIABILITY', debitInr: 0, creditInr: totalAmt, costCenter: 'CC-210' });
          await tx.insert(erpAccountingJournals).values({
            id: jrnId,
            organizationId: ORG_ID,
            journalNumber: jrnNo,
            entryDate: vInv.invoiceDate,
            fiscalPeriod: getFiscalPeriod(vInv.invoiceDate),
            sourceModule: 'SUPPLIER_INVOICE',
            sourceEntityId: vInv.id,
            narration: `Approved Non-PO Bill ${vInv.supplierInvoiceNumber} (${vInv.voucherNumber}) — ${vInv.supplierName}`,
            lines,
            totalDebitInr: totalAmt,
            totalCreditInr: totalAmt,
            isBalanced: true,
            postedByEmail: actor.email,
            status: 'POSTED'
          });
          await tx
            .update(erpVendorInvoices)
            .set({ approvalStatus: 'APPROVED', approvedByEmail: actor.email, journalId: jrnId, journalPosted: true, status: 'POSTED', updatedAt: new Date() })
            .where(eq(erpVendorInvoices.id, vInv.id));
        } else {
          await tx
            .update(erpVendorInvoices)
            .set({ approvalStatus: 'REJECTED', status: 'CANCELLED', updatedAt: new Date() })
            .where(eq(erpVendorInvoices.id, vInv.id));
        }
      }
    } else if (apr.entityType === 'EXPENSE_VOUCHER') {
      const expRows = await tx.select().from(erpExpensesAndPettyCash).where(eq(erpExpensesAndPettyCash.id, apr.entityId));
      if (expRows.length) {
        const v = expRows[0];
        if (payload.decision === 'APPROVED' && v.status === 'PENDING_APPROVAL') {
          const coaRows = await tx.select().from(erpChartOfAccounts);
          const expCoa = coaRows.find((c) => c.accountCode === v.expenseAccountCode);
          const payCoa = coaRows.find((c) => c.accountCode === v.paymentAccountCode);
          const taxAmt = round2(Number(v.cgstInr || 0) + Number(v.sgstInr || 0) + Number(v.igstInr || 0));
          const jrnNo = await getNextSequence(tx, 'JRN');
          const jrnId = makeId('jrn');
          const lines: any[] = [
            {
              accountCode: v.expenseAccountCode,
              accountName: expCoa?.accountName || 'Atelier Operations, Lease & Utilities',
              accountType: expCoa?.accountType || 'EXPENSE',
              debitInr: round2(Number(v.taxableAmountInr || 0)),
              creditInr: 0,
              costCenter: 'CC-510'
            }
          ];
          if (taxAmt > 0) {
            lines.push({
              accountCode: '1310',
              accountName: 'Input GST Credit Receivable (ITC)',
              accountType: 'ASSET',
              debitInr: taxAmt,
              creditInr: 0,
              costCenter: 'CC-510'
            });
          }
          lines.push({
            accountCode: v.paymentAccountCode,
            accountName: payCoa?.accountName || 'HDFC Operating Bank Account',
            accountType: 'ASSET',
            debitInr: 0,
            creditInr: round2(Number(v.totalAmountInr || 0)),
            costCenter: 'CC-510'
          });
          await tx.insert(erpAccountingJournals).values({
            id: jrnId,
            organizationId: ORG_ID,
            journalNumber: jrnNo,
            entryDate: v.expenseDate,
            fiscalPeriod: getFiscalPeriod(v.expenseDate),
            sourceModule: v.voucherType === 'OPERATING_EXPENSE' ? 'EXPENSE' : 'PETTY_CASH',
            sourceEntityId: v.voucherNumber,
            narration: `Approved ${v.voucherType} ${v.voucherNumber}: ${v.payeeName} — ${v.description}`,
            lines,
            totalDebitInr: round2(Number(v.totalAmountInr || 0)),
            totalCreditInr: round2(Number(v.totalAmountInr || 0)),
            isBalanced: true,
            postedByEmail: actor.email,
            status: 'POSTED'
          });
          await tx
            .update(erpExpensesAndPettyCash)
            .set({
              approvalStatus: 'APPROVED',
              approvedByEmail: actor.email,
              journalId: jrnId,
              status: 'POSTED',
              version: sql`${erpExpensesAndPettyCash.version} + 1`,
              updatedAt: new Date()
            })
            .where(eq(erpExpensesAndPettyCash.id, v.id));
        } else if (payload.decision === 'REJECTED') {
          await tx
            .update(erpExpensesAndPettyCash)
            .set({
              approvalStatus: 'REJECTED',
              approvedByEmail: actor.email,
              status: 'REJECTED',
              version: sql`${erpExpensesAndPettyCash.version} + 1`,
              updatedAt: new Date()
            })
            .where(eq(erpExpensesAndPettyCash.id, v.id));
        }
      }
    } else if (apr.entityType === 'MARKETING_CREATIVE') {
      const targetStage = payload.decision === 'APPROVED' ? 'APPROVED' : 'CHANGES_REQUESTED';
      const targetStatus = payload.decision === 'APPROVED' ? 'APPROVED' : 'IN_PRODUCTION';
      await tx
        .update(erpMarketingWorkspace)
        .set({
          approvalStage: targetStage,
          status: targetStatus,
          founderFeedback: payload.note || `${payload.decision} by ${actor.email}`,
          approvedByEmail: payload.decision === 'APPROVED' ? actor.email : null,
          approvedAt: payload.decision === 'APPROVED' ? new Date() : null,
          updatedAt: new Date()
        })
        .where(eq(erpMarketingWorkspace.id, apr.entityId));
    } else if (apr.entityType === 'INTERN_SUBMISSION') {
      const targetStage = payload.decision === 'APPROVED' ? 'APPROVED' : 'CHANGES_REQUESTED';
      await tx
        .update(erpInternSubmissions)
        .set({
          approvalStage: targetStage,
          reviewerEmail: actor.email,
          reviewerFeedback: payload.note || `${payload.decision} by ${actor.email}`,
          approvedAt: payload.decision === 'APPROVED' ? new Date() : null,
          updatedAt: new Date()
        })
        .where(eq(erpInternSubmissions.id, apr.entityId));
    }

    await recordErpAuditLog(tx, {
      action: `ERP_APPROVAL_${payload.decision}`,
      entity: 'erp_approvals',
      entityId: apr.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `${apr.approvalNumber} (${apr.title}) ${payload.decision} by ${actor.email}`
    });
    return updated;
  });
}

export async function updateRolePermissionMatrix(
  actor: ErpActorContext,
  payload: {
    roleId: string;
    moduleKey: ErpModuleKey;
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canApprove: boolean;
    canDelete: boolean;
    canExport: boolean;
  }
) {
  if (payload.roleId === 'role-super-admin') {
    throw new ValidationError('System Super Admin permissions cannot be downgraded.');
  }
  const existing = await db
    .select()
    .from(erpPermissions)
    .where(and(eq(erpPermissions.roleId, payload.roleId), eq(erpPermissions.moduleKey, payload.moduleKey)));

  if (!existing.length) {
    const [created] = await db
      .insert(erpPermissions)
      .values({
        id: `perm-${payload.roleId}-${payload.moduleKey}`,
        roleId: payload.roleId,
        moduleKey: payload.moduleKey,
        canView: payload.canView,
        canCreate: payload.canCreate,
        canEdit: payload.canEdit,
        canApprove: payload.canApprove,
        canDelete: payload.canDelete,
        canExport: payload.canExport
      })
      .returning();
    return created;
  }

  const [updated] = await db
    .update(erpPermissions)
    .set({
      canView: payload.canView,
      canCreate: payload.canCreate,
      canEdit: payload.canEdit,
      canApprove: payload.canApprove,
      canDelete: payload.canDelete,
      canExport: payload.canExport,
      updatedAt: new Date()
    })
    .where(eq(erpPermissions.id, existing[0].id))
    .returning();

  await recordErpAuditLog(db, {
    action: 'ERP_RBAC_PERMISSION_UPDATED',
    entity: 'erp_permissions',
    entityId: updated.id,
    actorEmail: actor.email,
    actorRole: actor.roleCode,
    details: `Updated ${payload.roleId} :: ${payload.moduleKey} permissions`
  });
  return updated;
}

export async function assignUserErpAccess(
  actor: ErpActorContext,
  payload: { email: string; displayName: string; roleId: string; departmentId?: string; isActive?: boolean }
) {
  if (!payload.email?.trim()) throw new ValidationError('Email is required.');
  const email = payload.email.trim().toLowerCase();
  const [depts, roles, existing] = await Promise.all([
    db.select().from(erpDepartments),
    db.select().from(erpRoles),
    db.select().from(erpUserAccess).where(eq(erpUserAccess.email, email))
  ]);

  const deptIds = new Set(depts.map((d) => d.id));
  const matchedRole = roles.find((r) => r.id === payload.roleId || r.code === payload.roleId);
  const resolvedRoleId = matchedRole?.id || payload.roleId;
  const fallbackDeptId =
    (payload.departmentId && deptIds.has(payload.departmentId) ? payload.departmentId : null) ||
    ((matchedRole as any)?.departmentId && deptIds.has((matchedRole as any).departmentId) ? (matchedRole as any).departmentId : null) ||
    depts[0]?.id ||
    'dept-exec';

  if (existing.length) {
    const nextIsActive = payload.isActive !== undefined ? Boolean(payload.isActive) : existing[0].isActive;
    const nextDeptId =
      payload.departmentId && deptIds.has(payload.departmentId)
        ? payload.departmentId
        : existing[0].departmentId || fallbackDeptId;
    const [updated] = await db
      .update(erpUserAccess)
      .set({
        displayName: payload.displayName || existing[0].displayName,
        roleId: resolvedRoleId || existing[0].roleId,
        departmentId: nextDeptId,
        isActive: nextIsActive,
        version: sql`${erpUserAccess.version} + 1`,
        updatedAt: new Date()
      })
      .where(eq(erpUserAccess.id, existing[0].id))
      .returning();
    await recordErpAuditLog(db, {
      action: nextIsActive ? 'ERP_USER_ACCESS_UPDATED' : 'ERP_USER_ACCESS_REVOKED',
      entity: 'erp_user_access',
      entityId: updated.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `${nextIsActive ? 'Updated' : 'Revoked'} ERP access for ${email} (role ${updated.roleId}, active=${nextIsActive})`
    });
    return updated;
  }
  const initialActive = payload.isActive !== undefined ? Boolean(payload.isActive) : true;
  const [created] = await db
    .insert(erpUserAccess)
    .values({
      id: makeId('ua'),
      organizationId: ORG_ID,
      email,
      displayName: payload.displayName || email,
      roleId: resolvedRoleId,
      departmentId: fallbackDeptId,
      isActive: initialActive
    })
    .returning();
  await recordErpAuditLog(db, {
    action: initialActive ? 'ERP_USER_ACCESS_GRANTED' : 'ERP_USER_ACCESS_REVOKED',
    entity: 'erp_user_access',
    entityId: created.id,
    actorEmail: actor.email,
    actorRole: actor.roleCode,
    details: `Assigned ${email} -> role ${resolvedRoleId} (active=${initialActive})`
  });
  return created;
}

export async function updateOrganizationSettings(
  actor: ErpActorContext,
  payload: {
    legalName?: string;
    brandName?: string;
    tagline?: string;
    gstin?: string;
    pan?: string;
    stateName?: string;
    stateCode?: string;
    city?: string;
    registeredAddress?: string;
    contactEmail?: string;
    contactPhone?: string;
    bankDetails?: any;
    expectedVersion?: number;
  }
) {
  const existing = await db.select().from(erpOrganizations).where(eq(erpOrganizations.id, ORG_ID));
  if (!existing.length) throw new NotFoundError('Organization master not found.');
  const cur = existing[0];
  if (payload.expectedVersion !== undefined && cur.version !== payload.expectedVersion) {
    throw new ConflictError('Organization settings were edited by another session.');
  }

  const [updated] = await db
    .update(erpOrganizations)
    .set({
      legalName: payload.legalName || cur.legalName,
      brandName: payload.brandName || cur.brandName,
      tagline: payload.tagline || cur.tagline,
      gstin: payload.gstin || cur.gstin,
      pan: payload.pan || cur.pan,
      stateName: payload.stateName || cur.stateName,
      stateCode: payload.stateCode || cur.stateCode,
      city: payload.city || cur.city,
      registeredAddress: payload.registeredAddress || cur.registeredAddress,
      contactEmail: payload.contactEmail || cur.contactEmail,
      contactPhone: payload.contactPhone || cur.contactPhone,
      bankDetails: payload.bankDetails ? { ...(cur.bankDetails as any), ...payload.bankDetails } : cur.bankDetails,
      version: sql`${erpOrganizations.version} + 1`,
      updatedAt: new Date()
    })
    .where(eq(erpOrganizations.id, ORG_ID))
    .returning();

  await recordErpAuditLog(db, {
    action: 'ERP_ORG_SETTINGS_UPDATED',
    entity: 'erp_organizations',
    entityId: ORG_ID,
    actorEmail: actor.email,
    actorRole: actor.roleCode,
    details: `Updated Organization GSTIN=${updated.gstin} State=${updated.stateName}`
  });
  return updated;
}

export async function addDocumentAttachment(
  actor: ErpActorContext,
  payload: {
    entityType: string;
    entityId: string;
    fileName: string;
    documentType?: string;
    mimeType?: string;
    fileSizeBytes?: number;
    storageUrlOrData: string;
    notes?: string;
  }
) {
  if (!payload.fileName?.trim() || !payload.storageUrlOrData?.trim()) {
    throw new ValidationError('File name and document content/URL are required.');
  }
  const [att] = await db
    .insert(erpAttachments)
    .values({
      id: makeId('att'),
      organizationId: ORG_ID,
      entityType: payload.entityType || 'GENERAL',
      entityId: payload.entityId || ORG_ID,
      fileName: payload.fileName.trim(),
      documentType: payload.documentType || 'COMMERCIAL_DOCUMENT',
      mimeType: payload.mimeType || 'application/pdf',
      fileSizeBytes: Number(payload.fileSizeBytes || payload.storageUrlOrData.length),
      storageUrlOrData: payload.storageUrlOrData,
      notes: payload.notes || null,
      uploadedByEmail: actor.email
    })
    .returning();
  return att;
}

// ============================================================================
// UNIVERSAL SEARCH, CSV DATA IMPORT WITH VALIDATION & AI BUSINESS ASSISTANT
// ============================================================================

export async function searchErpEntities(queryText: string) {
  const q = (queryText || '').trim().toLowerCase();
  if (!q) return [];
  const results: Array<{ moduleKey: ErpModuleKey; category: string; id: string; title: string; subtitle: string; badge?: string }> = [];

  const [mats, frms, batches, fg, leads, invs, ordersList, emps, tasks, prs, rfqs, vInvs, dns] = await Promise.all([
    db.select().from(erpMaterials),
    db.select().from(erpFormulations),
    db.select().from(productionBatches),
    db.select().from(erpFinishedGoods),
    db.select().from(erpLeads),
    db.select().from(erpInvoices),
    db.select().from(orders),
    db.select().from(erpEmployees),
    db.select().from(erpTasks),
    db.select().from(erpPurchaseRequisitions),
    db.select().from(erpRfqs),
    db.select().from(erpVendorInvoices),
    db.select().from(erpDebitNotes)
  ]);

  mats.filter((m) => m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q)).slice(0, 5).forEach((m) =>
    results.push({ moduleKey: 'materials', category: 'Raw Material', id: m.id, title: `${m.code} — ${m.name}`, subtitle: `Stock: ${m.currentStock} ${m.uom} · ₹${m.unitCostInr}` })
  );
  prs.filter((p) => p.requisitionNumber.toLowerCase().includes(q) || p.sourceDepartment.toLowerCase().includes(q)).slice(0, 4).forEach((p) =>
    results.push({ moduleKey: 'procurement', category: 'Purchase Requisition', id: p.id, title: `${p.requisitionNumber} (${p.sourceDepartment})`, subtitle: `₹${p.estimatedTotalInr.toLocaleString('en-IN')} · ${p.status}` })
  );
  rfqs.filter((r) => r.rfqNumber.toLowerCase().includes(q) || r.title.toLowerCase().includes(q)).slice(0, 4).forEach((r) =>
    results.push({ moduleKey: 'procurement', category: 'RFQ', id: r.id, title: `${r.rfqNumber} — ${r.title}`, subtitle: `Status: ${r.status}` })
  );
  vInvs.filter((v) => v.supplierInvoiceNumber.toLowerCase().includes(q) || v.voucherNumber.toLowerCase().includes(q) || v.supplierName.toLowerCase().includes(q)).slice(0, 4).forEach((v) =>
    results.push({ moduleKey: 'procurement', category: 'Supplier Bill', id: v.id, title: `${v.voucherNumber} (${v.supplierInvoiceNumber}) — ${v.supplierName}`, subtitle: `₹${v.totalAmountInr.toLocaleString('en-IN')} · ${v.paymentStatus}` })
  );
  dns.filter((d) => d.debitNoteNumber.toLowerCase().includes(q) || d.supplierName.toLowerCase().includes(q)).slice(0, 4).forEach((d) =>
    results.push({ moduleKey: 'procurement', category: 'Debit Note', id: d.id, title: `${d.debitNoteNumber} — ${d.supplierName}`, subtitle: `₹${d.totalDebitInr.toLocaleString('en-IN')} · ${d.returnType}` })
  );
  frms.filter((f) => f.name.toLowerCase().includes(q) || f.formulaCode.toLowerCase().includes(q)).slice(0, 5).forEach((f) =>
    results.push({ moduleKey: 'formulations', category: 'Formulation', id: f.id, title: `${f.formulaCode} — ${f.name}`, subtitle: `${f.concentrationType} · v${f.activeVersionNumber}` })
  );
  batches.filter((b) => b.batchNumber.toLowerCase().includes(q) || b.productName.toLowerCase().includes(q)).slice(0, 5).forEach((b) =>
    results.push({ moduleKey: 'batches', category: 'Batch Production', id: b.id, title: `${b.batchNumber} — ${b.productName}`, subtitle: `Qty: ${b.finishedQuantity} · QC: ${b.qcStatus}` })
  );
  fg.filter((g) => g.sku.toLowerCase().includes(q) || g.productName.toLowerCase().includes(q)).slice(0, 5).forEach((g) =>
    results.push({ moduleKey: 'warehouse', category: 'Finished Goods Bin', id: g.id, title: `${g.sku} — ${g.productName}`, subtitle: `Bin ${g.binLocation} · Avail ${g.quantityAvailable}` })
  );
  leads.filter((l) => l.companyName.toLowerCase().includes(q) || l.leadNumber.toLowerCase().includes(q)).slice(0, 5).forEach((l) =>
    results.push({ moduleKey: 'crm', category: 'B2B Lead', id: l.id, title: `${l.leadNumber} — ${l.companyName}`, subtitle: `${l.stage} · ₹${l.estimatedValueInr.toLocaleString('en-IN')}` })
  );
  invs.filter((i) => i.invoiceNumber.toLowerCase().includes(q) || i.customerName.toLowerCase().includes(q)).slice(0, 5).forEach((i) =>
    results.push({ moduleKey: 'gst_billing', category: 'GST Invoice', id: i.id, title: `${i.invoiceNumber} — ${i.customerName}`, subtitle: `₹${i.grandTotalInr.toLocaleString('en-IN')} · ${i.paymentStatus}` })
  );
  ordersList.filter((o) => o.orderNumber.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q)).slice(0, 5).forEach((o) =>
    results.push({ moduleKey: 'sales', category: 'Storefront Order', id: o.id, title: `${o.orderNumber} — ${o.customerName}`, subtitle: `₹${o.totalAmount.toLocaleString('en-IN')} · ${o.orderStatus}` })
  );
  emps.filter((e) => e.fullName.toLowerCase().includes(q) || e.employeeCode.toLowerCase().includes(q)).slice(0, 5).forEach((e) =>
    results.push({ moduleKey: 'hr', category: 'Employee', id: e.id, title: `${e.employeeCode} — ${e.fullName}`, subtitle: e.designation })
  );
  tasks.filter((t) => t.title.toLowerCase().includes(q) || t.taskNumber.toLowerCase().includes(q)).slice(0, 5).forEach((t) =>
    results.push({ moduleKey: 'hr', category: 'Task', id: t.id, title: `${t.taskNumber} — ${t.title}`, subtitle: `${t.priority} · ${t.status}` })
  );

  return results.slice(0, 20);
}

export async function importErpCsvRows(
  actor: ErpActorContext,
  payload: {
    targetEntity: 'materials' | 'leads';
    rows: Array<Record<string, any>>;
  }
) {
  if (!Array.isArray(payload.rows) || !payload.rows.length) {
    throw new ValidationError('CSV payload must contain at least one row.');
  }
  const errors: Array<{ rowIndex: number; error: string }> = [];
  let importedCount = 0;

  for (let i = 0; i < payload.rows.length; i++) {
    const r = payload.rows[i];
    try {
      if (payload.targetEntity === 'materials') {
        if (!r.name || Number.isNaN(Number(r.unitCostInr)) || Number.isNaN(Number(r.currentStock))) {
          throw new Error('Missing required fields: name, unitCostInr, currentStock');
        }
        await createOrUpdateMaterial(actor, {
          code: r.code,
          name: String(r.name),
          category: String(r.category || 'ESSENTIAL_OIL'),
          uom: String(r.uom || 'units'),
          unitCostInr: Number(r.unitCostInr),
          currentStock: Number(r.currentStock),
          reorderLevel: Number(r.reorderLevel || 50)
        });
        importedCount++;
      } else if (payload.targetEntity === 'leads') {
        if (!r.companyName || !r.email) {
          throw new Error('Missing required fields: companyName, email');
        }
        await createOrUpdateLead(actor, {
          companyName: String(r.companyName),
          contactName: String(r.contactName || r.companyName),
          email: String(r.email),
          phone: String(r.phone || '+91 98000 00000'),
          city: String(r.city || 'Mumbai'),
          state: String(r.state || 'Maharashtra'),
          estimatedValueInr: Number(r.estimatedValueInr || 0)
        });
        importedCount++;
      }
    } catch (e: any) {
      errors.push({ rowIndex: i + 1, error: e?.message || 'Validation failed' });
    }
  }

  return { importedCount, skippedCount: errors.length, errors };
}

export async function queryErpAiAssistant(
  actor: ErpActorContext,
  payload: { prompt: string }
) {
  if (!payload.prompt?.trim()) throw new ValidationError('Prompt cannot be empty.');
  const snapshot = await getErpWorkspaceSnapshot(actor);

  const dbGrounding = {
    organization: snapshot.organization.legalName,
    gstin: snapshot.organization.gstin,
    commerce: snapshot.commerceSummary,
    financials: {
      totalDebitsInr: snapshot.financialSummary.totalDebits,
      totalCreditsInr: snapshot.financialSummary.totalCredits,
      trialBalanceBalanced: snapshot.financialSummary.isBalanced,
      revenueInr: snapshot.financialSummary.totalRevenueInr,
      expenseInr: snapshot.financialSummary.totalExpenseInr,
      netProfitInr: snapshot.financialSummary.netProfitInr
    },
    lowStockMaterials: snapshot.materials
      .filter((m) => m.currentStock <= m.reorderLevel)
      .map((m) => ({ code: m.code, name: m.name, currentStock: m.currentStock, reorderLevel: m.reorderLevel, uom: m.uom })),
    activeBatches: snapshot.batches.map((b) => ({
      batchNumber: b.batchNumber,
      productName: b.productName,
      qty: b.finishedQuantity,
      qcStatus: b.qcStatus,
      releaseStatus: b.batchReleaseStatus
    })),
    openLeads: snapshot.leads.map((l) => ({
      leadNumber: l.leadNumber,
      company: l.companyName,
      stage: l.stage,
      valueInr: l.estimatedValueInr
    })),
    pendingApprovals: snapshot.approvals
      .filter((a) => a.status === 'PENDING')
      .map((a) => ({ approvalNumber: a.approvalNumber, title: a.title, amountInr: a.amountInr })),
    headcount: {
      employees: snapshot.employees.length,
      interns: snapshot.interns.length,
      openTasks: snapshot.tasks.filter((t) => t.status !== 'DONE').length
    }
  };

  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey !== 'YOUR_API_KEY' && !apiKey.includes('••')) {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `You are the FRAGMORÉ BUSINESS OS Executive Analyst AI inside an enterprise perfume ERP. Answer strictly using the live PostgreSQL telemetry JSON below. Be concise, quantitative, cite exact codes (SKUs, Batch numbers, Invoice/Lead numbers, INR amounts), and recommend concrete actions inside the 18 ERP modules.\n\nActor Role: ${actor.roleName} (${actor.email})\nLive Database Snapshot:\n${JSON.stringify(dbGrounding, null, 2)}\n\nExecutive Question: ${payload.prompt}`
              }
            ]
          }
        ]
      });
      const answerText = response.text || '';
      if (answerText.trim()) {
        return {
          answer: answerText,
          modelUsed: 'gemini-4-hydrogen',
          groundedSnapshot: dbGrounding
        };
      }
    } catch (err: any) {
      console.warn('[ERP AI Assistant] Gemini fallback triggered:', err?.message);
    }
  }

  // Deterministic live PostgreSQL executive synthesis fallback
  const lowList = dbGrounding.lowStockMaterials
    .map((m) => `- ${m.code} (${m.name}): ${m.currentStock}/${m.reorderLevel} ${m.uom}`)
    .join('\n') || '- All raw materials above reorder threshold.';
  const pendingList = dbGrounding.pendingApprovals
    .map((a) => `- ${a.approvalNumber}: ${a.title} (₹${a.amountInr.toLocaleString('en-IN')})`)
    .join('\n') || '- Zero pending approvals.';

  return {
    answer: [
      `Executive Brief for "${payload.prompt}" (Live PostgreSQL ERP Grounding):`,
      `1. Financial & GST Ledger: ${dbGrounding.financials.trialBalanceBalanced ? 'BALANCED' : 'UNBALANCED'} Trial Balance (Dr ₹${dbGrounding.financials.totalDebitsInr.toLocaleString('en-IN')} / Cr ₹${dbGrounding.financials.totalCreditsInr.toLocaleString('en-IN')}). Storefront Order Revenue: ₹${dbGrounding.commerce.totalOrderRevenueInr.toLocaleString('en-IN')} | Open AR: ₹${dbGrounding.commerce.accountsReceivableInr.toLocaleString('en-IN')} | Open AP: ₹${dbGrounding.commerce.accountsPayableInr.toLocaleString('en-IN')}.`,
      `2. Material Reorder Watch (${dbGrounding.lowStockMaterials.length} alerts):\n${lowList}`,
      `3. Pending Approvals Queue (${dbGrounding.pendingApprovals.length}):\n${pendingList}`,
      `4. Operations & People: ${dbGrounding.activeBatches.length} production batches, ${dbGrounding.openLeads.length} active B2B leads, ${dbGrounding.headcount.employees} employees, ${dbGrounding.headcount.interns} interns.`
    ].join('\n\n'),
    modelUsed: 'postgres-deterministic-analyst',
    groundedSnapshot: dbGrounding
  };
}
