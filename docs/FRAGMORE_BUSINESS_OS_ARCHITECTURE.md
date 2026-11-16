# FRAGMORÉ BUSINESS OS — Enterprise Architecture & Non-Destructive Migration Plan

## 1. Executive Architectural Overview

**FRAGMORÉ BUSINESS OS** extends the existing FRAGMORÉ Commerce Platform inside `AdminDashboard.tsx` into a unified, multi-department Enterprise Resource Planning (ERP) and Business Operating System.

### Existing System Baseline (Preserved 100% Intact)
- **Frontend**: React 19 + TypeScript + Vite 8 + Tailwind CSS v4 (`src/App.tsx`, `src/context/StoreContext.tsx`, `src/components/admin/*`)
- **Backend**: Express + TypeScript (`server.ts`, `src/server/*`) on port `3000`
- **Primary Database**: Google Cloud SQL PostgreSQL via `drizzle-orm/node-postgres` (`src/db/schema.ts`, `src/db/index.ts`)
- **Auth & Realtime**: Firebase Auth (`src/middleware/auth.ts`) + Server-Sent Events hub (`/api/realtime/stream` via `broadcastCrossBrowserSyncEvent`)
- **AI Runtime**: Server-side `@google/genai` SDK (`GEMINI_API_KEY` environment secret, model `gemini-4-hydrogen`)
- **Preserved Existing Records**: `users` (2 admins), `customers` (5 connoisseurs), `orders` (4 orders), `products` (22 products), `inventory_ledger` (33 SKUs), `production_batches` (4 batches), `supplier_purchase_orders` (3 POs), `procurement_suppliers` (4 suppliers), `campaigns` (3 campaigns), `audit_logs` (285 entries), `cms_settings`, `coupons`, `influencers`, `reviews`, `returns_refunds`, `automation_*`, `ai_cmo_*`.

---

## 2. Non-Destructive Database Architecture & Migration Plan

### Strategy
- **Zero destructive DDL**: No existing table or column is dropped, renamed, or truncated.
- **Zero data loss**: All additive tables use `CREATE TABLE IF NOT EXISTS` via Drizzle `UpdateSchema` RPC (`src/db/schema.ts`), preserving every row in existing tables.
- **Foreign Keys & Relational Integrity**: All new `erp_*` tables enforce foreign keys (`REFERENCES`), `status`, `version` (optimistic concurrency lock), `created_at` / `updated_at`, `idempotency_key` (unique constraints on financial/receipt mutations), and `B-Tree` indexes on foreign keys, statuses, numbers, and timestamps.

### Complete 31-Entity Normalization Map

| Logical Entity | Database Table | Relationship / Integration Strategy |
| :--- | :--- | :--- |
| Organizations | `erp_organizations` | Master legal entity, GSTIN, PAN, CIN, fiscal year, bank details, numbering config |
| Departments | `erp_departments` | FK -> `erp_organizations.id` (Executive, Procurement, R&D Formulation, Production, QC, Warehouse, Sales & CRM, Finance & GST, Marketing, HR) |
| Roles | `erp_roles` | FK -> `erp_organizations.id`, `erp_departments.id` |
| Permissions | `erp_permissions` | FK -> `erp_roles.id` (granular `canView`, `canCreate`, `canEdit`, `canApprove`, `canDelete`, `canExport` per module) |
| Users | `users` + `erp_user_access` | Preserves `users` table; `erp_user_access` binds `userUid`/`email` to `erp_roles` & `erp_departments` |
| Suppliers | `procurement_suppliers` | Existing table preserved & unified into Supplier & Procurement module |
| Purchase Orders | `supplier_purchase_orders` | Existing table preserved & wired into GRN + AP Journal workflows |
| Goods Receipts (GRN) | `erp_goods_receipts` | FK -> `supplier_purchase_orders.id`, `erp_warehouses.id`; creates `erp_stock_lots` + updates material stock + posts AP journal inside `db.transaction` |
| Warehouses | `erp_warehouses` | FK -> `erp_organizations.id` (Raw Material Store, Packaging Store, Cold Maceration Vault, Finished Goods Hub, QC Quarantine) |
| Raw & Packaging Materials | `erp_materials` | FK -> `erp_organizations.id`, `erp_warehouses.id`, `procurement_suppliers.id`; tracks HSN, GST %, IFRA limits, reorder level, stock |
| Stock Lots | `erp_stock_lots` | FK -> `erp_materials.id`, `erp_warehouses.id`, `erp_goods_receipts.id`; batch/lot FIFO tracking, expiry, QC hold |
| Formulations | `erp_formulations` | FK -> `erp_organizations.id`; master olfactory formula headers linked to product slugs |
| Formulation Versions | `erp_formulation_versions` | FK -> `erp_formulations.id`; immutable BOM % breakdown, alcohol dilution, maceration days, unit cost calculation, approval gate |
| Production Batches | `production_batches` | Existing table preserved & extended with formulation link, lot consumption, QC records & finished goods release |
| Samples | `erp_samples` | FK -> `erp_organizations.id`, `erp_formulations.id`, `erp_formulation_versions.id`, links to batches & leads/customers |
| QC Records | `erp_qc_records` | FK -> `erp_organizations.id`, links to GRN, Production Batches & Samples; lab metrics (ABV%, SG, GC-MS%, clarity, micro) |
| Finished Goods | `erp_finished_goods` | FK -> `erp_organizations.id`, `erp_warehouses.id`, links to `production_batches` & `products` + `inventory_ledger` |
| Customers | `customers` | Existing Customer 360 table preserved & enhanced with Lead conversion linkage |
| Leads | `erp_leads` | FK -> `erp_organizations.id`, corporate/B2B/bespoke pipeline with Lead -> Customer/Proposal conversion |
| Corporate Proposals | `erp_proposals` | FK -> `erp_organizations.id`, `erp_leads.id`; B2B gifting, hospitality & bespoke scope + pricing |
| Quotations | `erp_quotations` | FK -> `erp_organizations.id`, `erp_proposals.id`, `erp_leads.id`; GST-calculated formal quotes converting to Sales Orders / Invoices |
| Sales Orders | `orders` | Existing storefront/admin `orders` table preserved & unified into Module 9 |
| GST Invoices | `erp_invoices` | FK -> `erp_organizations.id`, `erp_quotations.id`, links to `orders.id`; HSN-wise CGST/SGST (intra-state) or IGST (inter-state), posts AR/Revenue/GST journal |
| Credit Notes | `erp_credit_notes` | FK -> `erp_organizations.id`, `erp_invoices.id`; linked GST reversal & contra-revenue journal entry |
| Payments | `erp_payments` | FK -> `erp_organizations.id`, `erp_invoices.id`, links to POs; updates `amountPaidInr`/`balanceDueInr` & posts Cash/Bank journal atomically |
| Accounting Journals | `erp_accounting_journals` | FK -> `erp_organizations.id`; double-entry ledger enforcing `SUM(debit) === SUM(credit)` on every posted entry |
| Campaigns | `campaigns` + `erp_marketing_workspace` | Preserves `campaigns` + adds agency creative briefs, ad spend/ROAS tracking, deliverables |
| Employees | `erp_employees` | FK -> `erp_organizations.id`, `erp_departments.id`, `erp_roles.id`; payroll/CTC/leave/reporting structure |
| Interns | `erp_interns` | FK -> `erp_organizations.id`, `erp_departments.id`; university cohort, mentor, stipend, evaluation & certification |
| Tasks | `erp_tasks` | FK -> `erp_organizations.id`, `erp_departments.id`; cross-department action items linked to any entity |
| Audit Logs | `audit_logs` | Existing immutable audit log table preserved & appended on every ERP mutation |

### Supporting Cross-Cutting Tables
- `erp_approvals`: Unified cross-department Approval Inbox (Formulation publish, PO issuance, QC batch release, High discount Quotation, Credit Note, Expense/Payroll approval)
- `erp_attachments`: Normalized document metadata & storage ledger attached to POs, GRNs, Formulations, QC Records, Invoices, Proposals, Employees
- `erp_notifications`: Targeted user/department/role alerts with read receipts
- `erp_sequences`: Transactional document auto-numbering (`PO-`, `GRN-`, `LOT-`, `FRM-`, `BATCH-`, `SMP-`, `QC-`, `FG-`, `LEAD-`, `PROP-`, `QT-`, `INV-`, `CN-`, `PAY-`, `JRN-`, `EMP-`, `INT-`, `TSK-`, `APR-`)

---

## 3. Core ACID Multi-Department Workflows

1. **Procure-to-Pay**: Supplier PO (`ORDERED`) -> Goods Receipt Note (`erp_goods_receipts`) in transaction: auto-generates `erp_stock_lots`, increments `erp_materials.currentStock`, records QC inward pending check, posts Balanced Journal (`DR Raw Material Inventory` + `DR Input GST`, `CR Accounts Payable`).
2. **Formulate-to-Bottle**: R&D Formulation Version (`APPROVED`) -> Start Production Batch -> Consume Raw Material Lots -> Sample & QC Inspection (`PASSED`) -> Finished Goods Warehouse Stock-In (`erp_finished_goods`) + Atomic Storefront Stock Sync (`inventory_ledger` + `products.variants`).
3. **Lead-to-Cash (B2B & Corporate)**: Lead (`NEW` -> `QUALIFIED`) -> Corporate Proposal (`SENT` -> `ACCEPTED`) -> GST Quotation (CGST/SGST vs IGST auto-computed by state vs Org State `Maharashtra 27`) -> GST Tax Invoice (`INV-...`) + Double-Entry Journal (`DR Accounts Receivable`, `CR Sales Revenue` + `CR Output CGST/SGST/IGST`) -> Payment Receipt (`DR Bank/UPI`, `CR Accounts Receivable`) / Credit Note reversal.
4. **Authorization & Concurrency**:
   - Every `/api/erp/*` route runs `requireErpPermission(moduleKey, action)` checking Firebase token / signed user session + `erp_user_access` + `erp_permissions` (with founder super-admin safeguard so authorized admins retain continuous access while restricted roles receive HTTP `403 Forbidden`).
   - Optimistic concurrency (`version` check returning HTTP `409 Conflict` on stale writes) and `idempotencyKey` guards prevent duplicate invoices, receipts, GRNs, or journals.
   - All mutations invoke `broadcastCrossBrowserSyncEvent` over SSE so connected browsers across departments update immediately.

---

## 4. Mapping to the 18 Modules Inside `AdminDashboard.tsx`

1. Executive Dashboard (Unified Revenue, Margin, WIP, Stock Value, AR/AP, Pending Approvals, Live Visitors)
2. Supplier and Procurement Management (Vendors, POs, GRN Inward Receipts, Reorder Alerts)
3. Raw Material and Packaging Inventory (Materials Master, FIFO Stock Lots, Warehouses, CSV Import)
4. Perfume Formulation Management (Formulas, Versioned BOMs, IFRA & Cost/ml Calculator, Approval Gate)
5. Batch Production and Manufacturing (Batches, Lot Allocation, 6-Stage Maceration, Yield Tracking)
6. Sampling and Quality Control (Lab & Client Samples, GC-MS / ABV / SG QC Records, Quarantine Gate)
7. Finished Goods and Warehouse Management (Multi-Warehouse Bin Stock, Ledger Sync, Stock Transfer)
8. Customer Relationship Management (Connoisseurs 360 + B2B Leads Pipeline + Lead-to-Customer Conversion)
9. Sales and Order Management (Omnichannel Storefront & B2B Orders, Fulfillment & Courier Tracking)
10. Corporate Proposals and Quotations (Proposal Builder, GST Quote Engine, One-Click Convert to Invoice)
11. GST Billing and Invoicing (HSN Tax Engine, CGST/SGST/IGST Split, Credit Notes, Printable Tax Invoice PDF)
12. Accounting and Finance (Double-Entry Journals, Trial Balance, P&L Snapshot, AR/AP Payment Receipts)
13. Digital Marketing Agency Workspace (Campaigns, Creative Briefs, ROAS/CAC Tracking, AI CMO Link)
14. HR, Employee and Internship Management (Department Staff Directory, Intern Tracker, Cross-Dept Tasks)
15. Role-Based Access Control (Department Roles, Matrix Permissions Editor, Live Access Tester)
16. Reports, Analytics and Export Center (Cross-Module Reports, Excel/CSV & Print PDF Exports)
17. AI Business Assistant (Server-Side `@google/genai` `gemini-4-hydrogen` SQL-Grounded Executive Analyst)
18. Settings, Audit Logs and Notifications (Company GST/Numbering Config, Audit Trail, Approvals, Alerts, Attachments)
