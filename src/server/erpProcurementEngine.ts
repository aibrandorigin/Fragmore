import { eq, desc, and, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  erpOrganizations,
  erpWarehouses,
  erpMaterials,
  erpStockLots,
  erpGoodsReceipts,
  erpQcRecords,
  erpAccountingJournals,
  erpPayments,
  erpApprovals,
  erpAttachments,
  procurementSuppliers,
  supplierPurchaseOrders,
  productionBatches,
  inventoryLedger,
  erpPurchaseRequisitions,
  erpRfqs,
  erpSupplierQuotations,
  erpVendorInvoices,
  erpDebitNotes,
  erpSequences
} from '../db/schema.ts';
import {
  getNextSequence,
  recordErpAuditLog,
  createErpNotification,
  ErpError,
  ValidationError,
  ConflictError,
  NotFoundError,
  type ErpActorContext
} from './erpBusinessOsEngine.ts';
import {
  appendStockMovementTx,
  inferStockTypeFromCategory,
  normalizeUom
} from './erpManufacturingEngine.ts';

const ORG_ID = 'org-fragmore-hq';

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function round2(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function currentIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

function getFiscalPeriod(dateStr: string): string {
  const [yStr, mStr] = dateStr.split('-');
  const y = Number(yStr) || new Date().getFullYear();
  const m = Number(mStr) || 4;
  const startYear = m >= 4 ? y : y - 1;
  return `FY${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

export const PROCUREMENT_MATERIAL_CATEGORIES = [
  { code: 'FRAGRANCE_OIL', label: 'Fragrance Oils' },
  { code: 'AROMA_CHEMICAL', label: 'Aroma Chemicals' },
  { code: 'PERFUME_SOLVENT', label: 'Perfume Solvent' },
  { code: 'BOTTLES', label: 'Bottles' },
  { code: 'CAPS', label: 'Caps' },
  { code: 'SPRAYERS', label: 'Sprayers' },
  { code: 'LABELS', label: 'Labels' },
  { code: 'CARTONS', label: 'Cartons' },
  { code: 'SAMPLE_VIALS', label: 'Sample Vials' },
  { code: 'DISCOVERY_PACKAGING', label: 'Discovery Packaging' },
  { code: 'PACKING_CONSUMABLES', label: 'Packing Consumables' },
  { code: 'EQUIPMENT', label: 'Equipment' },
  { code: 'MISC_SUPPLIES', label: 'Miscellaneous Supplies' }
] as const;

let procSeeded = false;
let procSeedPromise: Promise<void> | null = null;

export async function ensureProcurementSeeded(): Promise<void> {
  if (procSeeded) return;
  if (procSeedPromise) return procSeedPromise;

  procSeedPromise = (async () => {
    try {
      const seqDefaults = [
        { seqKey: 'PR', prefix: 'PR-2026-', currentValue: 1005, padding: 4 },
        { seqKey: 'RFQ', prefix: 'RFQ-2026-', currentValue: 1005, padding: 4 },
        { seqKey: 'SQ', prefix: 'SQ-2026-', currentValue: 1005, padding: 4 },
        { seqKey: 'PINV', prefix: 'PINV-2026-', currentValue: 1005, padding: 4 },
        { seqKey: 'DN', prefix: 'DN-2026-', currentValue: 1005, padding: 4 },
        { seqKey: 'PO', prefix: 'PO-FRG-2026-', currentValue: 1010, padding: 4 }
      ];
      for (const s of seqDefaults) {
        await db.insert(erpSequences).values(s).onConflictDoNothing();
      }
      await db
        .update(erpSequences)
        .set({ currentValue: sql`GREATEST(${erpSequences.currentValue}, 1005)` })
        .where(sql`${erpSequences.seqKey} IN ('PR', 'RFQ', 'SQ')`);

      // Non-destructively enrich existing suppliers with statutory GSTIN, PAN, MOQ, Legal/Trade names & Bank info if blank
      const existingSuppliers = await db.select().from(procurementSuppliers);
      const supplierEnrichments: Record<string, any> = {
        'Verreries': {
          legalName: 'Verreries de Parma S.p.A. (India Liaison)',
          tradeName: 'Parma Luxury Flacons',
          gstin: '27AAACV4419M1Z2',
          pan: 'AAACV4419M',
          address: 'Unit 14, Nhava Sheva Import Bonded Zone, Navi Mumbai 400707',
          stateName: 'Maharashtra',
          moq: 500,
          bankDetails: { bankName: 'UniCredit / Citi Correspondent', accountHolder: 'Verreries de Parma S.p.A.', accountNumberMasked: 'XXXX-XXXX-8821', ifsc: 'CITI0100000', branch: 'BKC Mumbai' }
        },
        'Grasse': {
          legalName: 'Laboratoires Grasse Olfactive SAS',
          tradeName: 'Grasse Fine Absolutes',
          gstin: '27AAACG9102K1Z8',
          pan: 'AAACG9102K',
          address: '42 Avenue Jean Maubert, Grasse 06130 / Mumbai Fragrance Depot',
          stateName: 'Maharashtra',
          moq: 5,
          bankDetails: { bankName: 'BNP Paribas Corporate', accountHolder: 'Laboratoires Grasse Olfactive', accountNumberMasked: 'XXXX-XXXX-4012', ifsc: 'BNPA0009001', branch: 'Nariman Point Mumbai' }
        },
        'Kannauj': {
          legalName: 'Kannauj Natural Extracts & Hydro-Distillers LLP',
          tradeName: 'Kannauj Naturals',
          gstin: '09AABFK7821D1Z5',
          pan: 'AABFK7821D',
          address: 'Attar Gali Industrial Estate, Sector 3, Kannauj, UP 209725',
          stateName: 'Uttar Pradesh',
          moq: 2,
          bankDetails: { bankName: 'HDFC Bank Commercial', accountHolder: 'Kannauj Natural Extracts LLP', accountNumberMasked: 'XXXX-XXXX-9314', ifsc: 'HDFC0001822', branch: 'Kannauj Main' }
        },
        'Artisan': {
          legalName: 'Artisan Coffret & Foiling Works Pvt. Ltd.',
          tradeName: 'Artisan Rigid Coffrets',
          gstin: '27AABCA6120R1Z9',
          pan: 'AABCA6120R',
          address: 'Gala 22, Midc Industrial Area, Andheri East, Mumbai 400093',
          stateName: 'Maharashtra',
          moq: 250,
          bankDetails: { bankName: 'ICICI Bank Business', accountHolder: 'Artisan Coffret & Foiling Works', accountNumberMasked: 'XXXX-XXXX-5529', ifsc: 'ICIC0000393', branch: 'Andheri East Mumbai' }
        }
      };

      for (const s of existingSuppliers) {
        if (!s.legalName || !s.gstin || !s.bankDetails) {
          const matchKey = Object.keys(supplierEnrichments).find((k) => s.name.includes(k));
          const patch = matchKey ? supplierEnrichments[matchKey] : {};
          await db
            .update(procurementSuppliers)
            .set({
              legalName: s.legalName || patch.legalName || s.name,
              tradeName: s.tradeName || patch.tradeName || s.name,
              gstin: s.gstin || patch.gstin || '27AABCF9012P1Z1',
              pan: s.pan || patch.pan || 'AABCF9012P',
              address: s.address || patch.address || `${s.city}, ${s.country}`,
              stateName: s.stateName || patch.stateName || 'Maharashtra',
              moq: s.moq || patch.moq || 100,
              bankDetails: s.bankDetails || patch.bankDetails || {
                bankName: 'HDFC Corporate',
                accountHolder: s.name,
                accountNumberMasked: 'XXXX-XXXX-1001',
                ifsc: 'HDFC0000060',
                branch: s.city
              },
              performanceMetrics: s.performanceMetrics || {
                totalOrders: 1,
                onTimeDeliveries: 1,
                onTimeRatePct: 100,
                qcPassRatePct: 99.2,
                avgLeadTimeDays: s.leadTimeDays,
                totalSpendInr: 0
              }
            })
            .where(eq(procurementSuppliers.id, s.id));
        }
      }

      // Ensure key materials across Fragrance Oils, Sprayers, Labels, Discovery Packaging, Packing Consumables exist cleanly
      const extraMaterials = [
        { id: 'mat-spray-gold', code: 'CMP-SPR-001', name: 'Crimp Micro-Mist Luxury Brass Sprayer (FEA15)', category: 'SPRAYERS', uom: 'units', hsnCode: '96161020', gstRatePct: 18, unitCostInr: 42, currentStock: 380, reservedStock: 0, reorderLevel: 500, targetStock: 2000, status: 'LOW_STOCK', defaultWarehouseId: 'wh-mumbai-pkg' },
        { id: 'mat-label-foil', code: 'PKG-LBL-GOLD', name: 'Hot-Foil Stamped Textured Cotton Labels (Front & Batch)', category: 'LABELS', uom: 'units', hsnCode: '48211090', gstRatePct: 12, unitCostInr: 14, currentStock: 1900, reservedStock: 0, reorderLevel: 1000, targetStock: 5000, status: 'OPTIMAL', defaultWarehouseId: 'wh-mumbai-pkg' },
        { id: 'mat-aroma-iso', code: 'RM-ARO-ISOE', name: 'Iso E Super (IFF Sylvamber Perfumery Grade)', category: 'AROMA_CHEMICAL', uom: 'kg', hsnCode: '29142990', gstRatePct: 18, unitCostInr: 4200, currentStock: 4.2, reservedStock: 0, reorderLevel: 5.0, targetStock: 15.0, status: 'LOW_STOCK', defaultWarehouseId: 'wh-mumbai-rm' },
        { id: 'mat-pack-tape', code: 'CON-PKG-FILL', name: 'Tamper-Evident Security Seals & Acid-Free Tissue Wraps', category: 'PACKING_CONSUMABLES', uom: 'units', hsnCode: '48192090', gstRatePct: 18, unitCostInr: 11, currentStock: 3400, reservedStock: 0, reorderLevel: 1000, targetStock: 5000, status: 'OPTIMAL', defaultWarehouseId: 'wh-mumbai-pkg' }
      ];
      for (const m of extraMaterials) {
        await db.insert(erpMaterials).values({ organizationId: ORG_ID, ...m }).onConflictDoNothing();
      }

      // Seed 1 realistic Requisition -> RFQ -> Multi-Supplier Quotation comparison set if empty
      const prCount = await db.select().from(erpPurchaseRequisitions);
      if (prCount.length === 0 && existingSuppliers.length >= 2) {
        const suppA = existingSuppliers[0];
        const suppB = existingSuppliers[1];
        const prId = 'pr-seed-01';
        await db
          .insert(erpPurchaseRequisitions)
          .values({
            id: prId,
            organizationId: ORG_ID,
            requisitionNumber: 'PR-2026-1001',
            sourceDepartment: 'PRODUCTION',
            priority: 'HIGH',
            requiredByDate: addDaysIso(12),
            items: [
              { materialId: 'mat-spray-gold', materialCode: 'CMP-SPR-001', materialName: 'Crimp Micro-Mist Luxury Brass Sprayer (FEA15)', category: 'SPRAYERS', qty: 1000, unit: 'units', estimatedUnitCostInr: 42 },
              { materialId: 'mat-flacon-50ml', materialCode: 'PKG-FLA-050', materialName: '50ml Heavy Italian Crimp Flacons (Gold Collar)', category: 'BOTTLES', qty: 1000, unit: 'units', estimatedUnitCostInr: 185 }
            ],
            estimatedTotalInr: 227000,
            requestedByEmail: 'production@fragmore.shop',
            approvedByEmail: 'aibrandorigin@gmail.com',
            approvalStatus: 'APPROVED',
            status: 'RFQ_SENT',
            notes: 'Required for upcoming Golden Hour & Oblique Woods Winter Atelier fill run.'
          })
          .onConflictDoNothing();

        const rfqId = 'rfq-seed-01';
        await db
          .insert(erpRfqs)
          .values({
            id: rfqId,
            organizationId: ORG_ID,
            rfqNumber: 'RFQ-2026-1001',
            requisitionId: prId,
            title: 'Q4 Winter Atelier Flacon & Crimp Sprayer Tender',
            targetSupplierIds: [suppA.id, suppB.id],
            items: [
              { materialId: 'mat-spray-gold', materialCode: 'CMP-SPR-001', materialName: 'Crimp Micro-Mist Luxury Brass Sprayer (FEA15)', category: 'SPRAYERS', qty: 1000, unit: 'units', targetUnitPriceInr: 42 },
              { materialId: 'mat-flacon-50ml', materialCode: 'PKG-FLA-050', materialName: '50ml Heavy Italian Crimp Flacons (Gold Collar)', category: 'BOTTLES', qty: 1000, unit: 'units', targetUnitPriceInr: 185 }
            ],
            responseDeadline: addDaysIso(5),
            deliveryWarehouseId: 'wh-mumbai-pkg',
            notes: 'Compare CIF landed cost, COA certification, and delivery lead time.',
            createdByEmail: 'procurement@fragmore.shop',
            status: 'QUOTED'
          })
          .onConflictDoNothing();

        await db
          .insert(erpSupplierQuotations)
          .values([
            {
              id: 'sq-seed-01',
              organizationId: ORG_ID,
              rfqId,
              supplierId: suppA.id,
              supplierName: suppA.name,
              quotationNumber: 'SQ-2026-1001',
              vendorRefNumber: 'QT-VDP-8841',
              quoteDate: currentIsoDate(),
              validUntil: addDaysIso(20),
              items: [
                { materialId: 'mat-spray-gold', materialName: 'Crimp Micro-Mist Luxury Brass Sprayer (FEA15)', category: 'SPRAYERS', qty: 1000, unit: 'units', unitPriceInr: 40, taxPct: 18, lineTaxInr: 7200, lineTotalInr: 47200 },
                { materialId: 'mat-flacon-50ml', materialName: '50ml Heavy Italian Crimp Flacons (Gold Collar)', category: 'BOTTLES', qty: 1000, unit: 'units', unitPriceInr: 178, taxPct: 18, lineTaxInr: 32040, lineTotalInr: 210040 }
              ],
              subtotalInr: 218000,
              taxInr: 39240,
              freightInr: 4500,
              totalLandedCostInr: 261740,
              deliveryDays: 10,
              paymentTerms: 'NET_30',
              notes: 'Includes custom gold anodic polishing & protective tray dividers.',
              status: 'SHORTLISTED'
            },
            {
              id: 'sq-seed-02',
              organizationId: ORG_ID,
              rfqId,
              supplierId: suppB.id,
              supplierName: suppB.name,
              quotationNumber: 'SQ-2026-1002',
              vendorRefNumber: 'QUO-19-402',
              quoteDate: currentIsoDate(),
              validUntil: addDaysIso(15),
              items: [
                { materialId: 'mat-spray-gold', materialName: 'Crimp Micro-Mist Luxury Brass Sprayer (FEA15)', category: 'SPRAYERS', qty: 1000, unit: 'units', unitPriceInr: 44, taxPct: 18, lineTaxInr: 7920, lineTotalInr: 51920 },
                { materialId: 'mat-flacon-50ml', materialName: '50ml Heavy Italian Crimp Flacons (Gold Collar)', category: 'BOTTLES', qty: 1000, unit: 'units', unitPriceInr: 189, taxPct: 18, lineTaxInr: 34020, lineTotalInr: 223020 }
              ],
              subtotalInr: 233000,
              taxInr: 41940,
              freightInr: 2500,
              totalLandedCostInr: 277440,
              deliveryDays: 7,
              paymentTerms: 'ADVANCE_50_BALANCE_DISPATCH',
              notes: 'Faster express air dispatch within 7 days.',
              status: 'SUBMITTED'
            }
          ])
          .onConflictDoNothing();
      }

      procSeeded = true;
    } finally {
      procSeedPromise = null;
    }
  })();

  return procSeedPromise;
}

// ============================================================================
// PROCUREMENT WORKSPACE SNAPSHOT & ANALYTICS
// ============================================================================

export async function getProcurementWorkspaceSnapshot() {
  await ensureProcurementSeeded();

  const [
    suppliers,
    requisitions,
    rfqs,
    supplierQuotations,
    purchaseOrders,
    goodsReceipts,
    vendorInvoices,
    debitNotes,
    payments,
    materials,
    warehouses,
    batches,
    ledger,
    qcRecords,
    attachments
  ] = await Promise.all([
    db.select().from(procurementSuppliers).orderBy(procurementSuppliers.name),
    db.select().from(erpPurchaseRequisitions).orderBy(desc(erpPurchaseRequisitions.createdAt)),
    db.select().from(erpRfqs).orderBy(desc(erpRfqs.createdAt)),
    db.select().from(erpSupplierQuotations).orderBy(erpSupplierQuotations.totalLandedCostInr),
    db.select().from(supplierPurchaseOrders).orderBy(desc(supplierPurchaseOrders.createdAt)),
    db.select().from(erpGoodsReceipts).orderBy(desc(erpGoodsReceipts.createdAt)),
    db.select().from(erpVendorInvoices).orderBy(desc(erpVendorInvoices.createdAt)),
    db.select().from(erpDebitNotes).orderBy(desc(erpDebitNotes.createdAt)),
    db.select().from(erpPayments).orderBy(desc(erpPayments.createdAt)),
    db.select().from(erpMaterials).orderBy(erpMaterials.code),
    db.select().from(erpWarehouses),
    db.select().from(productionBatches).orderBy(desc(productionBatches.createdAt)),
    db.select().from(inventoryLedger),
    db.select().from(erpQcRecords).orderBy(desc(erpQcRecords.createdAt)),
    db.select().from(erpAttachments).orderBy(desc(erpAttachments.createdAt))
  ]);

  const vendorPayments = payments.filter((p) => p.direction === 'OUTBOUND_PAYOUT');

  // Compute live Supplier Ledger & Performance Metrics
  const enrichedSuppliers = suppliers.map((s) => {
    const sPos = purchaseOrders.filter((p) => p.supplierId === s.id && p.status !== 'CANCELLED');
    const sInvs = vendorInvoices.filter((i) => i.supplierId === s.id && i.status !== 'CANCELLED' && i.approvalStatus === 'APPROVED');
    const sDns = debitNotes.filter((d) => d.supplierId === s.id && d.status !== 'VOID');
    const sPays = vendorPayments.filter((p) => p.supplierId === s.id || (!p.supplierId && p.partyName === s.name));
    const sGrns = goodsReceipts.filter((g) => g.supplierId === s.id && g.status !== 'CANCELLED');

    const totalInvoicedInr = round2(sInvs.reduce((sum, i) => sum + Number(i.totalAmountInr || 0), 0));
    const totalDebitNotesInr = round2(sDns.reduce((sum, d) => sum + Number(d.totalDebitInr || 0), 0));
    const advancePaidInr = round2(sPays.filter((p) => p.isAdvance).reduce((sum, p) => sum + Number(p.amountInr || 0), 0));
    const invoicePaymentsInr = round2(sPays.filter((p) => !p.isAdvance).reduce((sum, p) => sum + Number(p.amountInr || 0), 0));
    const totalPaymentsInr = round2(sPays.reduce((sum, p) => sum + Number(p.amountInr || 0), 0));
    const outstandingBalanceInr = round2(
      sInvs.reduce((sum, i) => sum + Number(i.balanceDueInr || 0), 0)
    );
    const totalPoSpendInr = round2(sPos.reduce((sum, p) => sum + Number(p.totalCostInr || 0), 0));

    // Lead-time & on-time performance from received POs
    const deliveredPos = sPos.filter((p) => p.actualDeliveryDate && p.orderDate);
    const onTimeCount = deliveredPos.filter((p) => p.actualDeliveryDate! <= p.expectedDeliveryDate).length;
    const onTimeRatePct = deliveredPos.length > 0 ? Math.round((onTimeCount / deliveredPos.length) * 100) : 100;
    const avgLeadDays =
      deliveredPos.length > 0
        ? round2(
            deliveredPos.reduce((sum, p) => {
              const d = Math.max(1, Math.round((new Date(p.actualDeliveryDate!).getTime() - new Date(p.orderDate).getTime()) / 86400000));
              return sum + d;
            }, 0) / deliveredPos.length
          )
        : s.leadTimeDays;
    const passedGrns = sGrns.filter((g) => g.qcStatus === 'PASSED').length;
    const qcPassRatePct = sGrns.length > 0 ? Math.round((passedGrns / sGrns.length) * 100) : 100;

    return {
      ...s,
      ledgerSummary: {
        totalPoSpendInr,
        totalInvoicedInr,
        totalDebitNotesInr,
        advancePaidInr,
        invoicePaymentsInr,
        totalPaymentsInr,
        outstandingBalanceInr
      },
      computedPerformance: {
        totalOrders: sPos.length,
        deliveredOrders: deliveredPos.length,
        onTimeRatePct,
        avgLeadTimeDays: avgLeadDays,
        qcPassRatePct,
        grnCount: sGrns.length
      }
    };
  });

  // Compute Low Stock + Production Planning Demand Alerts
  const materialAlerts = materials
    .filter((m) => Number(m.currentStock || 0) <= Number(m.reorderLevel || 0))
    .map((m) => ({
      source: 'INVENTORY_REORDER',
      id: m.id,
      materialId: m.id,
      code: m.code,
      name: m.name,
      category: m.category,
      currentStock: m.currentStock,
      reorderLevel: m.reorderLevel,
      targetStock: m.targetStock,
      recommendedOrderQty: Math.max(1, Math.ceil(Number(m.targetStock || 500) - Number(m.currentStock || 0))),
      unit: m.uom,
      estimatedUnitCostInr: m.unitCostInr,
      severity: Number(m.currentStock || 0) <= 0 ? 'CRITICAL' : 'HIGH',
      reason: `Stock ${m.currentStock} ${m.uom} <= Reorder threshold ${m.reorderLevel} ${m.uom}`
    }));

  const productionAlerts = batches
    .filter((b) => b.batchReleaseStatus !== 'RELEASED' && b.packagingAvailability !== 'SUFFICIENT')
    .map((b) => ({
      source: 'PRODUCTION_PLANNING',
      id: b.id,
      batchId: b.id,
      batchNumber: b.batchNumber,
      code: b.sku,
      name: `${b.productName} Packaging / Components (${b.finishedQuantity} flacons)`,
      category: 'BOTTLES',
      currentStock: 0,
      reorderLevel: b.finishedQuantity,
      targetStock: b.finishedQuantity * 2,
      recommendedOrderQty: b.finishedQuantity,
      unit: 'units',
      estimatedUnitCostInr: 185,
      severity: 'HIGH',
      reason: `Batch ${b.batchNumber} (${b.productName}) flagged packaging=${b.packagingAvailability}`
    }));

  const ledgerAlerts = ledger
    .filter((l) => Number(l.availableStock || 0) <= Number(l.reorderThreshold || 15))
    .map((l) => ({
      source: 'FINISHED_SKU_DEMAND',
      id: l.sku,
      code: l.sku,
      name: `${l.productName} (${l.size}) Fill Components`,
      category: 'BOTTLES',
      currentStock: l.availableStock,
      reorderLevel: l.reorderThreshold,
      targetStock: 150,
      recommendedOrderQty: 150,
      unit: 'units',
      estimatedUnitCostInr: 185,
      severity: l.availableStock <= 5 ? 'CRITICAL' : 'MEDIUM',
      reason: `Storefront SKU ${l.sku} stock ${l.availableStock} <= threshold ${l.reorderThreshold}`
    }));

  const reorderAlerts = [...materialAlerts, ...productionAlerts, ...ledgerAlerts];

  const totalOutstandingApInr = round2(
    vendorInvoices
      .filter((i) => i.status !== 'CANCELLED' && i.approvalStatus === 'APPROVED')
      .reduce((s, i) => s + Number(i.balanceDueInr || 0), 0)
  );
  const totalAdvancePaidInr = round2(
    vendorPayments.filter((p) => p.isAdvance).reduce((s, p) => s + Number(p.amountInr || 0), 0)
  );
  const totalSpendInr = round2(
    purchaseOrders.filter((p) => p.status !== 'CANCELLED').reduce((s, p) => s + Number(p.totalCostInr || 0), 0)
  );

  return {
    categories: PROCUREMENT_MATERIAL_CATEGORIES,
    suppliers: enrichedSuppliers,
    requisitions,
    rfqs,
    supplierQuotations,
    purchaseOrders,
    goodsReceipts,
    vendorInvoices,
    debitNotes,
    vendorPayments,
    materials,
    warehouses,
    batches,
    qcRecords,
    attachments: attachments.filter((a) =>
      ['SUPPLIER_INVOICE', 'PURCHASE_ORDER', 'GRN', 'RFQ', 'DEBIT_NOTE'].includes(a.entityType)
    ),
    reorderAlerts,
    kpis: {
      totalSpendInr,
      activePosCount: purchaseOrders.filter((p) => ['ORDERED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED', 'PENDING_APPROVAL'].includes(p.status)).length,
      openRequisitionsCount: requisitions.filter((r) => r.status === 'OPEN' || r.status === 'RFQ_SENT').length,
      openRfqsCount: rfqs.filter((r) => r.status === 'OPEN' || r.status === 'QUOTED').length,
      pendingQcGrnsCount: goodsReceipts.filter((g) => g.qcStatus === 'PENDING_INSPECTION' || !g.inventoryPosted).length,
      totalOutstandingApInr,
      totalAdvancePaidInr,
      lowStockAlertsCount: reorderAlerts.length,
      avgSupplierOnTimePct:
        enrichedSuppliers.length > 0
          ? Math.round(
              enrichedSuppliers.reduce((s, v) => s + Number(v.computedPerformance.onTimeRatePct || 100), 0) /
                enrichedSuppliers.length
            )
          : 100
    }
  };
}

// ============================================================================
// 1. SUPPLIER MANAGEMENT (STATUTORY PROFILE, BANK, MOQ, CATEGORIES)
// ============================================================================

export async function upsertProcurementSupplier(
  actor: ErpActorContext,
  payload: {
    id?: string;
    name: string;
    legalName?: string;
    tradeName?: string;
    code?: string;
    category: string;
    gstin?: string;
    pan?: string;
    address?: string;
    stateName?: string;
    contactPerson: string;
    email: string;
    phone: string;
    city: string;
    country?: string;
    leadTimeDays?: number;
    moq?: number;
    paymentTerms?: string;
    bankDetails?: {
      bankName?: string;
      accountHolder?: string;
      accountNumberMasked?: string;
      ifsc?: string;
      branch?: string;
      upiId?: string;
    };
    rating?: string;
    status?: string;
    materialsSupplied?: string[];
    notes?: string;
    expectedVersion?: number;
  }
) {
  if (!payload.name?.trim() || !payload.contactPerson?.trim() || !payload.email?.trim()) {
    throw new ValidationError('Supplier name, contact person, and email are required.');
  }

  return await db.transaction(async (tx) => {
    if (payload.id) {
      const existing = await tx.select().from(procurementSuppliers).where(eq(procurementSuppliers.id, payload.id));
      if (existing.length) {
        if (payload.expectedVersion !== undefined && existing[0].version !== payload.expectedVersion) {
          throw new ConflictError('Supplier profile was updated by another session.');
        }
        const [updated] = await tx
          .update(procurementSuppliers)
          .set({
            name: payload.name.trim(),
            legalName: payload.legalName?.trim() || existing[0].legalName || payload.name.trim(),
            tradeName: payload.tradeName?.trim() || existing[0].tradeName || payload.name.trim(),
            category: payload.category || existing[0].category,
            gstin: payload.gstin !== undefined ? payload.gstin.trim().toUpperCase() : existing[0].gstin,
            pan: payload.pan !== undefined ? payload.pan.trim().toUpperCase() : existing[0].pan,
            address: payload.address !== undefined ? payload.address : existing[0].address,
            stateName: payload.stateName || existing[0].stateName || 'Maharashtra',
            contactPerson: payload.contactPerson.trim(),
            email: payload.email.trim(),
            phone: payload.phone || existing[0].phone,
            city: payload.city || existing[0].city,
            country: payload.country || existing[0].country,
            leadTimeDays: Number(payload.leadTimeDays ?? existing[0].leadTimeDays),
            moq: Number(payload.moq ?? existing[0].moq ?? 1),
            paymentTerms: payload.paymentTerms || existing[0].paymentTerms,
            bankDetails: payload.bankDetails ? { ...(existing[0].bankDetails as any), ...payload.bankDetails } : existing[0].bankDetails,
            rating: payload.rating || existing[0].rating,
            status: payload.status || existing[0].status,
            materialsSupplied: payload.materialsSupplied || (existing[0].materialsSupplied as any),
            notes: payload.notes !== undefined ? payload.notes : existing[0].notes,
            version: sql`${procurementSuppliers.version} + 1`,
            updatedAt: new Date()
          })
          .where(eq(procurementSuppliers.id, payload.id))
          .returning();

        await recordErpAuditLog(tx, {
          action: 'PROCUREMENT_SUPPLIER_UPDATED',
          entity: 'procurement_suppliers',
          entityId: updated.id,
          actorEmail: actor.email,
          actorRole: actor.roleCode,
          details: `Updated supplier ${updated.code} (${updated.name}) GSTIN=${updated.gstin || 'N/A'}`
        });
        return updated;
      }
    }

    const code = payload.code?.trim().toUpperCase() || `SUP-${Date.now().toString(36).slice(-4).toUpperCase()}`;
    const [created] = await tx
      .insert(procurementSuppliers)
      .values({
        id: payload.id || makeId('supp'),
        name: payload.name.trim(),
        legalName: payload.legalName?.trim() || payload.name.trim(),
        tradeName: payload.tradeName?.trim() || payload.name.trim(),
        code,
        category: payload.category || 'FRAGRANCE_OIL',
        gstin: payload.gstin?.trim().toUpperCase() || null,
        pan: payload.pan?.trim().toUpperCase() || null,
        address: payload.address || `${payload.city}, ${payload.country || 'India'}`,
        stateName: payload.stateName || 'Maharashtra',
        contactPerson: payload.contactPerson.trim(),
        email: payload.email.trim(),
        phone: payload.phone || '+91 98000 00000',
        city: payload.city || 'Mumbai',
        country: payload.country || 'India',
        leadTimeDays: Number(payload.leadTimeDays || 14),
        moq: Number(payload.moq || 1),
        paymentTerms: payload.paymentTerms || 'NET_30',
        bankDetails: payload.bankDetails || {
          bankName: 'HDFC Corporate',
          accountHolder: payload.legalName || payload.name,
          accountNumberMasked: 'XXXX-XXXX-0000',
          ifsc: '',
          branch: payload.city || 'Mumbai'
        },
        rating: payload.rating || 'A_GRADE',
        status: payload.status || 'ACTIVE',
        materialsSupplied: payload.materialsSupplied?.length ? payload.materialsSupplied : [payload.category || 'FRAGRANCE_OIL'],
        performanceMetrics: {
          totalOrders: 0,
          onTimeDeliveries: 0,
          onTimeRatePct: 100,
          qcPassRatePct: 100,
          avgLeadTimeDays: Number(payload.leadTimeDays || 14),
          totalSpendInr: 0
        },
        notes: payload.notes || null,
        version: 1
      })
      .returning();

    await recordErpAuditLog(tx, {
      action: 'PROCUREMENT_SUPPLIER_CREATED',
      entity: 'procurement_suppliers',
      entityId: created.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Onboarded supplier ${created.code}: ${created.legalName || created.name} (GSTIN: ${created.gstin || 'Unregistered'})`
    });
    return created;
  });
}

// ============================================================================
// 2. PURCHASE REQUISITIONS (FROM PRODUCTION, INVENTORY & OPS)
// ============================================================================

export async function createPurchaseRequisition(
  actor: ErpActorContext,
  payload: {
    sourceDepartment: 'PRODUCTION' | 'INVENTORY' | 'RD' | 'OPERATIONS';
    linkedBatchId?: string;
    priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
    requiredByDate?: string;
    items: Array<{
      materialId?: string;
      materialCode?: string;
      materialName: string;
      category: string;
      qty: number;
      unit: string;
      estimatedUnitCostInr: number;
    }>;
    notes?: string;
  }
) {
  await ensureProcurementSeeded();
  if (!Array.isArray(payload.items) || !payload.items.length) {
    throw new ValidationError('At least one requisition line item is required.');
  }

  return await db.transaction(async (tx) => {
    const requisitionNumber = await getNextSequence(tx, 'PR');
    const estimatedTotalInr = round2(
      payload.items.reduce((s, it) => s + Number(it.qty || 0) * Number(it.estimatedUnitCostInr || 0), 0)
    );
    const needsApproval = estimatedTotalInr > 100000 && !actor.isSuperAdmin && actor.roleCode !== 'FINANCE_CONTROLLER';

    const [pr] = await tx
      .insert(erpPurchaseRequisitions)
      .values({
        id: makeId('pr'),
        organizationId: ORG_ID,
        requisitionNumber,
        sourceDepartment: payload.sourceDepartment || 'INVENTORY',
        linkedBatchId: payload.linkedBatchId || null,
        priority: payload.priority || 'NORMAL',
        requiredByDate: payload.requiredByDate || addDaysIso(10),
        items: payload.items,
        estimatedTotalInr,
        requestedByEmail: actor.email,
        approvedByEmail: needsApproval ? null : actor.email,
        approvalStatus: needsApproval ? 'PENDING_APPROVAL' : 'APPROVED',
        status: 'OPEN',
        notes: payload.notes || null
      })
      .returning();

    if (needsApproval) {
      const aprNumber = await getNextSequence(tx, 'APR');
      await tx.insert(erpApprovals).values({
        id: makeId('apr'),
        organizationId: ORG_ID,
        departmentId: 'dept-proc',
        approvalNumber: aprNumber,
        moduleKey: 'procurement',
        entityType: 'PURCHASE_REQUISITION',
        entityId: pr.id,
        title: `Approve Requisition ${requisitionNumber} (₹${estimatedTotalInr.toLocaleString('en-IN')})`,
        summary: `${pr.sourceDepartment} dept requisition exceeds ₹1,00,000 threshold.`,
        amountInr: estimatedTotalInr,
        requiredRoleCode: 'SUPER_ADMIN',
        requestedByEmail: actor.email,
        status: 'PENDING'
      });
    }

    await recordErpAuditLog(tx, {
      action: 'PROCUREMENT_PR_CREATED',
      entity: 'erp_purchase_requisitions',
      entityId: pr.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Raised PR ${requisitionNumber} from ${pr.sourceDepartment} (₹${estimatedTotalInr})`
    });
    return pr;
  });
}

// ============================================================================
// 3. REQUESTS FOR QUOTATION (RFQ) & MULTI-VENDOR QUOTATIONS (COMPARATIVE STATEMENT)
// ============================================================================

export async function createProcurementRfq(
  actor: ErpActorContext,
  payload: {
    requisitionId?: string;
    title: string;
    targetSupplierIds: string[];
    items: Array<{
      materialId?: string;
      materialCode?: string;
      materialName: string;
      category: string;
      qty: number;
      unit: string;
      targetUnitPriceInr?: number;
    }>;
    responseDeadline?: string;
    deliveryWarehouseId?: string;
    notes?: string;
  }
) {
  await ensureProcurementSeeded();
  if (!payload.title?.trim() || !Array.isArray(payload.items) || !payload.items.length) {
    throw new ValidationError('RFQ title and at least one item are required.');
  }

  return await db.transaction(async (tx) => {
    const rfqNumber = await getNextSequence(tx, 'RFQ');
    const [rfq] = await tx
      .insert(erpRfqs)
      .values({
        id: makeId('rfq'),
        organizationId: ORG_ID,
        rfqNumber,
        requisitionId: payload.requisitionId || null,
        title: payload.title.trim(),
        targetSupplierIds: payload.targetSupplierIds || [],
        items: payload.items,
        responseDeadline: payload.responseDeadline || addDaysIso(5),
        deliveryWarehouseId: payload.deliveryWarehouseId || 'wh-mumbai-rm',
        notes: payload.notes || null,
        createdByEmail: actor.email,
        status: 'OPEN'
      })
      .returning();

    if (payload.requisitionId) {
      await tx
        .update(erpPurchaseRequisitions)
        .set({ status: 'RFQ_SENT', version: sql`${erpPurchaseRequisitions.version} + 1`, updatedAt: new Date() })
        .where(eq(erpPurchaseRequisitions.id, payload.requisitionId));
    }

    await recordErpAuditLog(tx, {
      action: 'PROCUREMENT_RFQ_CREATED',
      entity: 'erp_rfqs',
      entityId: rfq.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Issued RFQ ${rfqNumber}: ${rfq.title} to ${(payload.targetSupplierIds || []).length} supplier(s)`
    });
    return rfq;
  });
}

export async function recordSupplierQuotation(
  actor: ErpActorContext,
  payload: {
    rfqId: string;
    supplierId: string;
    vendorRefNumber?: string;
    validUntil?: string;
    freightInr?: number;
    deliveryDays: number;
    paymentTerms: string;
    notes?: string;
    items: Array<{
      materialId?: string;
      materialName: string;
      category?: string;
      qty: number;
      unit: string;
      unitPriceInr: number;
      taxPct?: number;
    }>;
  }
) {
  await ensureProcurementSeeded();
  if (!payload.rfqId || !payload.supplierId || !Array.isArray(payload.items) || !payload.items.length) {
    throw new ValidationError('RFQ ID, supplier ID, and line quotes are required.');
  }

  return await db.transaction(async (tx) => {
    const rfqs = await tx.select().from(erpRfqs).where(eq(erpRfqs.id, payload.rfqId));
    if (!rfqs.length) throw new NotFoundError('RFQ not found.');
    const supps = await tx.select().from(procurementSuppliers).where(eq(procurementSuppliers.id, payload.supplierId));
    if (!supps.length) throw new NotFoundError('Supplier not found.');

    const normalizedItems = payload.items.map((it) => {
      const qty = Number(it.qty || 1);
      const unitPriceInr = round2(Number(it.unitPriceInr || 0));
      const taxPct = Number(it.taxPct ?? 18);
      const sub = round2(qty * unitPriceInr);
      const lineTaxInr = round2((sub * taxPct) / 100);
      return {
        materialId: it.materialId || null,
        materialName: it.materialName,
        category: it.category || 'FRAGRANCE_OIL',
        qty,
        unit: it.unit || 'units',
        unitPriceInr,
        taxPct,
        lineTaxInr,
        lineTotalInr: round2(sub + lineTaxInr)
      };
    });

    const subtotalInr = round2(normalizedItems.reduce((s, it) => s + it.qty * it.unitPriceInr, 0));
    const taxInr = round2(normalizedItems.reduce((s, it) => s + it.lineTaxInr, 0));
    const freightInr = round2(Number(payload.freightInr || 0));
    const totalLandedCostInr = round2(subtotalInr + taxInr + freightInr);
    const quotationNumber = await getNextSequence(tx, 'SQ');

    const [sq] = await tx
      .insert(erpSupplierQuotations)
      .values({
        id: makeId('sq'),
        organizationId: ORG_ID,
        rfqId: payload.rfqId,
        supplierId: supps[0].id,
        supplierName: supps[0].name,
        quotationNumber,
        vendorRefNumber: payload.vendorRefNumber || null,
        quoteDate: currentIsoDate(),
        validUntil: payload.validUntil || addDaysIso(21),
        items: normalizedItems,
        subtotalInr,
        taxInr,
        freightInr,
        totalLandedCostInr,
        deliveryDays: Number(payload.deliveryDays || supps[0].leadTimeDays || 14),
        paymentTerms: payload.paymentTerms || supps[0].paymentTerms || 'NET_30',
        notes: payload.notes || null,
        status: 'SUBMITTED'
      })
      .returning();

    await tx
      .update(erpRfqs)
      .set({ status: 'QUOTED', version: sql`${erpRfqs.version} + 1`, updatedAt: new Date() })
      .where(eq(erpRfqs.id, payload.rfqId));

    await recordErpAuditLog(tx, {
      action: 'PROCUREMENT_SUPPLIER_QUOTE_LOGGED',
      entity: 'erp_supplier_quotations',
      entityId: sq.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Logged Quote ${quotationNumber} from ${sq.supplierName} for RFQ ${rfqs[0].rfqNumber}: Landed ₹${totalLandedCostInr} (${sq.deliveryDays}d)`
    });
    return sq;
  });
}

// ============================================================================
// 4. PURCHASE ORDER GENERATION (WITH THRESHOLD APPROVALS) & CANCELLATION
// ============================================================================

export async function createPurchaseOrderTransaction(
  actor: ErpActorContext,
  payload: {
    supplierId: string;
    requisitionId?: string;
    rfqId?: string;
    quotationId?: string;
    warehouseId?: string;
    category?: string;
    expectedDeliveryDays?: number;
    shippingInr?: number;
    paymentTerms?: string;
    notes?: string;
    items: Array<{
      materialId?: string;
      sku?: string;
      name: string;
      category?: string;
      quantity: number;
      unit: string;
      unitPriceInr: number;
      taxPct?: number;
    }>;
  }
) {
  await ensureProcurementSeeded();
  if (!payload.supplierId || !Array.isArray(payload.items) || !payload.items.length) {
    throw new ValidationError('Supplier and at least one Purchase Order line item are required.');
  }

  return await db.transaction(async (tx) => {
    const [supp] = await tx.select().from(procurementSuppliers).where(eq(procurementSuppliers.id, payload.supplierId));
    if (!supp) throw new NotFoundError('Referenced supplier not found.');

    const [org] = await tx.select().from(erpOrganizations).where(eq(erpOrganizations.id, ORG_ID));
    const orgState = (org?.stateName || 'Maharashtra').trim().toLowerCase();
    const suppState = (supp.stateName || 'Maharashtra').trim().toLowerCase();
    const isInterState = suppState !== orgState;

    const poItems = payload.items.map((it, idx) => {
      const qty = Number(it.quantity || 1);
      const price = round2(Number(it.unitPriceInr || 0));
      const taxPct = Number(it.taxPct ?? 18);
      if (qty <= 0 || price < 0) throw new ValidationError(`Invalid qty/price on PO line ${it.name}`);
      return {
        id: `poi-${idx + 1}-${Date.now().toString(36).slice(-4)}`,
        materialId: it.materialId || null,
        sku: it.sku || `MAT-${idx + 1}`,
        name: it.name,
        category: it.category || payload.category || supp.category || 'FRAGRANCE_OIL',
        quantity: qty,
        receivedQty: 0,
        unit: it.unit || 'units',
        unitPriceInr: price,
        taxPct,
        totalPriceInr: round2(qty * price)
      };
    });

    const subtotalInr = Math.round(poItems.reduce((s, it) => s + it.totalPriceInr, 0));
    const gstInr = Math.round(
      poItems.reduce((s, it) => s + (it.totalPriceInr * Number(it.taxPct || 18)) / 100, 0)
    );
    const shippingInr = Math.round(Number(payload.shippingInr || 0));
    const totalCostInr = subtotalInr + gstInr + shippingInr;

    // Purchase Approval Thresholds based on amount & role
    let approvalThresholdTier = 'AUTO_STANDARD';
    let needsApproval = false;
    let requiredRoleCode = 'FINANCE_CONTROLLER';

    if (totalCostInr > 200000) {
      approvalThresholdTier = 'EXECUTIVE_BOARD_GT_2L';
      if (!actor.isSuperAdmin) {
        needsApproval = true;
        requiredRoleCode = 'SUPER_ADMIN';
      }
    } else if (totalCostInr > 50000) {
      approvalThresholdTier = 'FINANCE_SIGN_OFF_50K_2L';
      if (!actor.isSuperAdmin && actor.roleCode !== 'FINANCE_CONTROLLER') {
        needsApproval = true;
        requiredRoleCode = 'FINANCE_CONTROLLER';
      }
    }

    const poNumber = await getNextSequence(tx, 'PO');
    const leadDays = Number(payload.expectedDeliveryDays || supp.leadTimeDays || 14);

    const [po] = await tx
      .insert(supplierPurchaseOrders)
      .values({
        id: makeId('po'),
        poNumber,
        supplierId: supp.id,
        supplierName: supp.name,
        supplierEmail: supp.email,
        supplierPhone: supp.phone,
        category: payload.category || poItems[0].category || supp.category,
        requisitionId: payload.requisitionId || null,
        rfqId: payload.rfqId || null,
        quotationId: payload.quotationId || null,
        warehouseId: payload.warehouseId || 'wh-mumbai-rm',
        orderDate: currentIsoDate(),
        expectedDeliveryDate: addDaysIso(leadDays),
        items: poItems,
        subtotalInr,
        gstInr,
        shippingInr,
        totalCostInr,
        isInterState,
        status: needsApproval ? 'PENDING_APPROVAL' : 'ORDERED',
        receivedStatus: 'UNRECEIVED',
        approvalStatus: needsApproval ? 'PENDING_APPROVAL' : 'APPROVED',
        approvedBy: needsApproval ? null : actor.email,
        approvalThresholdTier,
        advancePaidInr: 0,
        invoicedAmountInr: 0,
        paymentStatus: 'PENDING',
        paymentTerms: payload.paymentTerms || supp.paymentTerms || 'NET_30',
        notes: payload.notes || '',
        createdBy: actor.email
      })
      .returning();

    if (needsApproval) {
      const aprNumber = await getNextSequence(tx, 'APR');
      await tx.insert(erpApprovals).values({
        id: makeId('apr'),
        organizationId: ORG_ID,
        departmentId: 'dept-proc',
        approvalNumber: aprNumber,
        moduleKey: 'procurement',
        entityType: 'PURCHASE_ORDER',
        entityId: po.id,
        title: `Approve PO ${poNumber} — ${supp.name} (₹${totalCostInr.toLocaleString('en-IN')})`,
        summary: `Triggered threshold rule ${approvalThresholdTier}. Requires ${requiredRoleCode} approval before vendor dispatch.`,
        amountInr: totalCostInr,
        requiredRoleCode,
        requestedByEmail: actor.email,
        status: 'PENDING'
      });
    }

    if (payload.requisitionId) {
      await tx
        .update(erpPurchaseRequisitions)
        .set({ status: 'PO_ISSUED', version: sql`${erpPurchaseRequisitions.version} + 1`, updatedAt: new Date() })
        .where(eq(erpPurchaseRequisitions.id, payload.requisitionId));
    }

    if (payload.quotationId && payload.rfqId) {
      await tx
        .update(erpSupplierQuotations)
        .set({ isSelectedWinner: true, status: 'AWARDED', updatedAt: new Date() })
        .where(eq(erpSupplierQuotations.id, payload.quotationId));
      await tx
        .update(erpSupplierQuotations)
        .set({ isSelectedWinner: false, status: 'REJECTED', updatedAt: new Date() })
        .where(and(eq(erpSupplierQuotations.rfqId, payload.rfqId), sql`${erpSupplierQuotations.id} != ${payload.quotationId}`));
      await tx
        .update(erpRfqs)
        .set({ status: 'AWARDED', awardedQuotationId: payload.quotationId, awardedPoId: po.id, updatedAt: new Date() })
        .where(eq(erpRfqs.id, payload.rfqId));
    }

    await recordErpAuditLog(tx, {
      action: 'PROCUREMENT_PO_CREATED',
      entity: 'supplier_purchase_orders',
      entityId: po.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Created PO ${poNumber} to ${supp.name}: ₹${totalCostInr} (${po.approvalStatus})`
    });
    return po;
  });
}

export async function awardQuotationAndCreatePoTransaction(actor: ErpActorContext, quotationId: string) {
  const quotes = await db.select().from(erpSupplierQuotations).where(eq(erpSupplierQuotations.id, quotationId));
  if (!quotes.length) throw new NotFoundError('Supplier quotation not found.');
  const q = quotes[0];
  const rfqs = await db.select().from(erpRfqs).where(eq(erpRfqs.id, q.rfqId));
  const rfq = rfqs[0];

  const items = ((q.items as any[]) || []).map((it) => ({
    materialId: it.materialId || undefined,
    name: it.materialName,
    category: it.category || 'FRAGRANCE_OIL',
    quantity: Number(it.qty || 1),
    unit: it.unit || 'units',
    unitPriceInr: Number(it.unitPriceInr || 0),
    taxPct: Number(it.taxPct ?? 18)
  }));

  const po = await createPurchaseOrderTransaction(actor, {
    supplierId: q.supplierId,
    requisitionId: rfq?.requisitionId || undefined,
    rfqId: q.rfqId,
    quotationId: q.id,
    warehouseId: rfq?.deliveryWarehouseId || 'wh-mumbai-rm',
    expectedDeliveryDays: q.deliveryDays,
    shippingInr: q.freightInr,
    paymentTerms: q.paymentTerms,
    notes: `Awarded from Comparative Statement (${q.quotationNumber} / ${rfq?.rfqNumber || ''})`,
    items
  });
  return { purchaseOrder: po, quotation: q };
}

export async function cancelPurchaseOrderTransaction(actor: ErpActorContext, poId: string, reason: string) {
  if (!reason?.trim()) throw new ValidationError('Cancellation reason is required.');
  return await db.transaction(async (tx) => {
    const pos = await tx.select().from(supplierPurchaseOrders).where(eq(supplierPurchaseOrders.id, poId));
    if (!pos.length) throw new NotFoundError('Purchase order not found.');
    const po = pos[0];
    if (po.status === 'RECEIVED' || po.receivedStatus === 'FULLY_RECEIVED') {
      throw new ValidationError(`PO ${po.poNumber} is already fully received and cannot be cancelled.`);
    }
    const [updated] = await tx
      .update(supplierPurchaseOrders)
      .set({
        status: 'CANCELLED',
        cancellationReason: reason.trim(),
        version: sql`${supplierPurchaseOrders.version} + 1`,
        updatedAt: new Date()
      })
      .where(eq(supplierPurchaseOrders.id, poId))
      .returning();

    await recordErpAuditLog(tx, {
      action: 'PROCUREMENT_PO_CANCELLED',
      entity: 'supplier_purchase_orders',
      entityId: po.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Cancelled PO ${po.poNumber}: ${reason.trim()}`
    });
    return updated;
  });
}

// ============================================================================
// 5. PARTIAL / MULTIPLE GOODS RECEIPTS (GRN) + QUALITY INSPECTION APPROVAL
//    Rule: Approved receipts update inventory accurately + post GRNI Clearing
//          so Supplier Invoices post Accounts Payable once with ZERO duplication.
// ============================================================================

export async function createPartialOrFullGrnTransaction(
  actor: ErpActorContext,
  payload: {
    purchaseOrderId: string;
    warehouseId?: string;
    challanNumber?: string;
    receivedDate?: string;
    approveAndPostInventoryNow?: boolean;
    inspectionNotes?: string;
    items: Array<{
      materialId?: string;
      materialName: string;
      category?: string;
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
  await ensureProcurementSeeded();
  if (!payload.purchaseOrderId || !Array.isArray(payload.items) || !payload.items.length) {
    throw new ValidationError('Purchase order ID and at least one received line item are required.');
  }

  if (payload.idempotencyKey) {
    const dup = await db.select().from(erpGoodsReceipts).where(eq(erpGoodsReceipts.idempotencyKey, payload.idempotencyKey));
    if (dup.length) return { grn: dup[0], deduplicated: true };
  }

  return await db.transaction(async (tx) => {
    const pos = await tx.select().from(supplierPurchaseOrders).where(eq(supplierPurchaseOrders.id, payload.purchaseOrderId));
    if (!pos.length) throw new NotFoundError('Purchase order not found.');
    const po = pos[0];
    if (po.status === 'CANCELLED') throw new ValidationError('Cannot receive goods against a CANCELLED Purchase Order.');
    if (po.approvalStatus !== 'APPROVED') {
      throw new ValidationError(`PO ${po.poNumber} is awaiting approval (${po.approvalStatus}) before goods receipt.`);
    }

    const grnNumber = await getNextSequence(tx, 'GRN');
    const receivedDate = payload.receivedDate || currentIsoDate();
    const warehouseId = payload.warehouseId || po.warehouseId || 'wh-mumbai-rm';
    const postNow = Boolean(payload.approveAndPostInventoryNow);

    const allMats = await tx.select().from(erpMaterials);
    const poItems: any[] = Array.isArray(po.items) ? [...po.items] : [];
    const grnItems: any[] = [];
    const createdLots: any[] = [];
    let acceptedSubtotal = 0;

    for (const line of payload.items) {
      const receivedQty = Number(line.receivedQty || 0);
      if (receivedQty <= 0) continue;
      const acceptedQty = line.acceptedQty !== undefined ? Number(line.acceptedQty) : receivedQty;
      const rejectedQty = Number(line.rejectedQty ?? Math.max(0, receivedQty - acceptedQty));
      const unitCost = Number(line.unitCostInr || 0);
      acceptedSubtotal += acceptedQty * unitCost;

      let matchedMat = line.materialId
        ? allMats.find((m) => m.id === line.materialId)
        : allMats.find((m) => m.name.toLowerCase().includes(line.materialName.toLowerCase().slice(0, 14)));

      if (!matchedMat) {
        const [newMat] = await tx
          .insert(erpMaterials)
          .values({
            id: makeId('mat'),
            organizationId: ORG_ID,
            defaultWarehouseId: warehouseId,
            preferredSupplierId: po.supplierId,
            code: `MAT-${Date.now().toString(36).slice(-5).toUpperCase()}`,
            name: line.materialName,
            category: line.category || po.category || 'MISC_SUPPLIES',
            uom: line.unit || 'units',
            hsnCode: '33029011',
            gstRatePct: 18,
            unitCostInr: unitCost,
            currentStock: 0,
            reservedStock: 0,
            reorderLevel: 50,
            targetStock: 300,
            status: 'LOW_STOCK'
          })
          .returning();
        matchedMat = newMat;
        allMats.push(newMat);
      }

      const lotNumber = await getNextSequence(tx, 'LOT');

      // Update material stock immediately ONLY if approveAndPostInventoryNow === true
      if (postNow && acceptedQty > 0) {
        const nextStock = round2(Number(matchedMat.currentStock || 0) + acceptedQty);
        const nextStatus = nextStock <= 0 ? 'CRITICAL' : nextStock <= matchedMat.reorderLevel ? 'LOW_STOCK' : 'OPTIMAL';
        await tx
          .update(erpMaterials)
          .set({
            currentStock: nextStock,
            unitCostInr: unitCost > 0 ? unitCost : matchedMat.unitCostInr,
            status: nextStatus,
            version: sql`${erpMaterials.version} + 1`,
            updatedAt: new Date()
          })
          .where(eq(erpMaterials.id, matchedMat.id));
        matchedMat.currentStock = nextStock;
      }

      const poLineIdx = poItems.findIndex(
        (pi) => (line.materialId && pi.materialId === line.materialId) || pi.name.toLowerCase() === line.materialName.toLowerCase()
      );
      if (poLineIdx >= 0) {
        poItems[poLineIdx] = {
          ...poItems[poLineIdx],
          receivedQty: round2(Number(poItems[poLineIdx].receivedQty || 0) + acceptedQty)
        };
      }

      grnItems.push({
        materialId: matchedMat.id,
        materialCode: matchedMat.code,
        materialName: matchedMat.name,
        orderedQty: poLineIdx >= 0 ? Number(poItems[poLineIdx].quantity) : receivedQty,
        receivedQty,
        acceptedQty,
        rejectedQty,
        unit: line.unit || matchedMat.uom,
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
          warehouseLocation: 'INWARD-BAY-01',
          purchaseRef: `${po.poNumber} / ${grnNumber}`,
          supplierId: po.supplierId,
          supplierName: po.supplierName,
          stockCategory: (matchedMat.stockType as any) || inferStockTypeFromCategory(matchedMat.category),
          uom: normalizeUom(line.unit || matchedMat.uom),
          lotNumber,
          supplierBatchRef: payload.challanNumber || po.poNumber,
          receivedQty,
          availableQty: postNow ? acceptedQty : 0,
          reservedQty: 0,
          consumedQty: 0,
          damagedQty: 0,
          unitCostInr: unitCost,
          receivedDate,
          retestDate: addDaysIso(365),
          expiryDate: addDaysIso(730),
          qcStatus: postNow ? (acceptedQty > 0 ? 'APPROVED' : 'QUARANTINED') : 'PENDING',
          status: postNow && acceptedQty > 0 ? 'ACTIVE' : 'QUARANTINED'
        })
        .returning();
      if (postNow && acceptedQty > 0) {
        await appendStockMovementTx(tx, {
          movementDate: receivedDate,
          stockCategory: ((matchedMat.stockType as any) || inferStockTypeFromCategory(matchedMat.category)),
          movementType: 'RECEIPT',
          materialId: matchedMat.id,
          materialCode: matchedMat.code,
          materialName: matchedMat.name,
          lotId: lot.id,
          lotNumber: lot.lotNumber,
          warehouseId,
          warehouseLocation: lot.warehouseLocation,
          qtyDelta: acceptedQty,
          uom: normalizeUom(line.unit || matchedMat.uom),
          balanceBefore: 0,
          balanceAfter: acceptedQty,
          unitCostInr: unitCost,
          densityUsedGPerMl: matchedMat.densityGPerMl ?? null,
          referenceType: 'GRN',
          referenceId: grnNumber,
          reason: `Inward GRN ${grnNumber} against PO ${po.poNumber} (${po.supplierName})`,
          performedByEmail: actor.email
        });
      }
      createdLots.push(lot);
    }

    if (!grnItems.length) throw new ValidationError('At least one positive received quantity is required.');

    acceptedSubtotal = round2(acceptedSubtotal);
    const taxInr = round2(acceptedSubtotal * 0.18);
    const totalInr = round2(acceptedSubtotal + taxInr);
    const grnId = makeId('grn');
    let journalId: string | null = null;
    let journalNumber: string | null = null;

    if (postNow && acceptedSubtotal > 0) {
      journalNumber = await getNextSequence(tx, 'JRN');
      journalId = makeId('jrn');
      await tx.insert(erpAccountingJournals).values({
        id: journalId,
        organizationId: ORG_ID,
        journalNumber,
        entryDate: receivedDate,
        fiscalPeriod: getFiscalPeriod(receivedDate),
        sourceModule: 'PURCHASE_GRN',
        sourceEntityId: grnId,
        narration: `Approved GRN ${grnNumber} stock receipt for PO ${po.poNumber} (Dr Inventory / Cr GRNI Clearing)`,
        lines: [
          { accountCode: '1200', accountName: 'Raw Materials & Packaging Inventory', accountType: 'ASSET', debitInr: acceptedSubtotal, creditInr: 0, costCenter: 'CC-210' },
          { accountCode: '2110', accountName: 'Goods Received Not Invoiced (GRNI Clearing)', accountType: 'LIABILITY', debitInr: 0, creditInr: acceptedSubtotal, costCenter: 'CC-210' }
        ],
        totalDebitInr: acceptedSubtotal,
        totalCreditInr: acceptedSubtotal,
        isBalanced: true,
        postedByEmail: actor.email,
        status: 'POSTED'
      });
    }

    const totalRejected = grnItems.reduce((s, i) => s + i.rejectedQty, 0);
    const qcStatus = !postNow ? 'PENDING_INSPECTION' : totalRejected > 0 ? 'PARTIAL_REJECTED' : 'PASSED';

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
        subtotalInr: acceptedSubtotal,
        taxInr,
        totalInr,
        qcStatus,
        inventoryPosted: postNow,
        inspectedByEmail: postNow ? actor.email : null,
        inspectedAt: postNow ? new Date() : null,
        inspectionNotes: postNow ? (payload.inspectionNotes || 'Direct inward QC cleared') : null,
        journalId,
        notes: payload.notes || null,
        idempotencyKey: payload.idempotencyKey || null,
        status: 'POSTED'
      })
      .returning();

    for (const lot of createdLots) {
      await tx.update(erpStockLots).set({ grnId: grn.id }).where(eq(erpStockLots.id, lot.id));
    }

    if (postNow) {
      const allFulfilled = poItems.every((it) => Number(it.receivedQty || 0) >= Number(it.quantity || 1));
      const anyReceived = poItems.some((it) => Number(it.receivedQty || 0) > 0);
      await tx
        .update(supplierPurchaseOrders)
        .set({
          items: poItems,
          receivedStatus: allFulfilled ? 'FULLY_RECEIVED' : anyReceived ? 'PARTIALLY_RECEIVED' : 'UNRECEIVED',
          status: allFulfilled ? 'RECEIVED' : 'PARTIALLY_RECEIVED',
          actualDeliveryDate: receivedDate,
          receivedBy: actor.email,
          version: sql`${supplierPurchaseOrders.version} + 1`,
          updatedAt: new Date()
        })
        .where(eq(supplierPurchaseOrders.id, po.id));

      const qcNumber = await getNextSequence(tx, 'QC');
      await tx.insert(erpQcRecords).values({
        id: makeId('qc'),
        organizationId: ORG_ID,
        qcNumber,
        inspectionType: 'RAW_MATERIAL_INWARD',
        grnId: grn.id,
        subjectName: `${po.supplierName} — ${grnNumber}`,
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
    }

    await recordErpAuditLog(tx, {
      action: 'PROCUREMENT_GRN_CREATED',
      entity: 'erp_goods_receipts',
      entityId: grn.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Logged GRN ${grnNumber} for PO ${po.poNumber} (QC=${qcStatus}, InventoryPosted=${postNow})`
    });

    return { grn, lots: createdLots, journalNumber };
  });
}

export async function inspectAndApproveGrnTransaction(
  actor: ErpActorContext,
  payload: {
    grnId: string;
    decision: 'PASSED' | 'PARTIAL_REJECTED' | 'FAILED';
    inspectionNotes?: string;
    gcmsMatchPct?: number;
    abvTestedPct?: number;
    itemsOverride?: Array<{ materialId: string; acceptedQty: number; rejectedQty: number }>;
  }
) {
  return await db.transaction(async (tx) => {
    const grns = await tx.select().from(erpGoodsReceipts).where(eq(erpGoodsReceipts.id, payload.grnId));
    if (!grns.length) throw new NotFoundError('Goods Receipt (GRN) not found.');
    const grn = grns[0];
    if (grn.inventoryPosted) {
      throw new ConflictError(`GRN ${grn.grnNumber} has already been QC-inspected and posted to inventory.`);
    }

    const pos = await tx.select().from(supplierPurchaseOrders).where(eq(supplierPurchaseOrders.id, grn.purchaseOrderId));
    if (!pos.length) throw new NotFoundError('Linked Purchase Order not found.');
    const po = pos[0];
    const poItems: any[] = Array.isArray(po.items) ? [...po.items] : [];

    const existingItems: any[] = Array.isArray(grn.items) ? [...grn.items] : [];
    const updatedItems: any[] = [];
    let acceptedSubtotal = 0;

    for (const item of existingItems) {
      const ov = payload.itemsOverride?.find((o) => o.materialId === item.materialId);
      const acceptedQty =
        payload.decision === 'FAILED'
          ? 0
          : ov !== undefined
          ? Number(ov.acceptedQty)
          : Number(item.acceptedQty ?? item.receivedQty);
      const rejectedQty =
        payload.decision === 'FAILED'
          ? Number(item.receivedQty)
          : ov !== undefined
          ? Number(ov.rejectedQty)
          : Math.max(0, Number(item.receivedQty) - acceptedQty);

      acceptedSubtotal += acceptedQty * Number(item.unitCostInr || 0);
      updatedItems.push({ ...item, acceptedQty, rejectedQty });

      // Update Lot + Material Stock accurately ONLY for acceptedQty
      const lots = await tx
        .select()
        .from(erpStockLots)
        .where(and(eq(erpStockLots.grnId, grn.id), eq(erpStockLots.materialId, item.materialId)));
      for (const lot of lots) {
        await tx
          .update(erpStockLots)
          .set({
            availableQty: acceptedQty,
            qcStatus: acceptedQty > 0 ? 'APPROVED' : 'QUARANTINED',
            status: acceptedQty > 0 ? 'ACTIVE' : 'QUARANTINED',
            updatedAt: new Date()
          })
          .where(eq(erpStockLots.id, lot.id));

        if (acceptedQty > 0) {
          await appendStockMovementTx(tx, {
            movementDate: currentIsoDate(),
            stockCategory: (lot.stockCategory as any) || 'RAW_MATERIAL',
            movementType: 'RECEIPT',
            materialId: item.materialId,
            materialCode: item.materialCode || null,
            materialName: item.materialName,
            lotId: lot.id,
            lotNumber: lot.lotNumber,
            warehouseId: lot.warehouseId,
            warehouseLocation: lot.warehouseLocation || 'INWARD-BAY-01',
            qtyDelta: acceptedQty,
            uom: normalizeUom(item.unit || lot.uom),
            balanceBefore: 0,
            balanceAfter: acceptedQty,
            unitCostInr: Number(item.unitCostInr || lot.unitCostInr || 0),
            referenceType: 'GRN',
            referenceId: grn.grnNumber,
            reason: `QC Inspection PASSED for GRN ${grn.grnNumber} (${grn.supplierName})`,
            performedByEmail: actor.email
          });
        }
      }

      if (acceptedQty > 0) {
        const mats = await tx.select().from(erpMaterials).where(eq(erpMaterials.id, item.materialId));
        if (mats.length) {
          const mat = mats[0];
          const nextStock = round2(Number(mat.currentStock || 0) + acceptedQty);
          const nextStatus = nextStock <= 0 ? 'CRITICAL' : nextStock <= mat.reorderLevel ? 'LOW_STOCK' : 'OPTIMAL';
          await tx
            .update(erpMaterials)
            .set({
              currentStock: nextStock,
              unitCostInr: item.unitCostInr > 0 ? item.unitCostInr : mat.unitCostInr,
              status: nextStatus,
              version: sql`${erpMaterials.version} + 1`,
              updatedAt: new Date()
            })
            .where(eq(erpMaterials.id, mat.id));
        }

        const poIdx = poItems.findIndex(
          (pi) => (item.materialId && pi.materialId === item.materialId) || pi.name.toLowerCase() === item.materialName.toLowerCase()
        );
        if (poIdx >= 0) {
          poItems[poIdx] = {
            ...poItems[poIdx],
            receivedQty: round2(Number(poItems[poIdx].receivedQty || 0) + acceptedQty)
          };
        }
      }
    }

    acceptedSubtotal = round2(acceptedSubtotal);
    const taxInr = round2(acceptedSubtotal * 0.18);
    const totalInr = round2(acceptedSubtotal + taxInr);

    let journalId: string | null = grn.journalId;
    let journalNumber: string | null = null;
    if (acceptedSubtotal > 0 && !journalId) {
      journalNumber = await getNextSequence(tx, 'JRN');
      journalId = makeId('jrn');
      await tx.insert(erpAccountingJournals).values({
        id: journalId,
        organizationId: ORG_ID,
        journalNumber,
        entryDate: currentIsoDate(),
        fiscalPeriod: getFiscalPeriod(currentIsoDate()),
        sourceModule: 'PURCHASE_GRN',
        sourceEntityId: grn.id,
        narration: `QC Approved ${grn.grnNumber} inventory capitalization (Dr Inventory / Cr GRNI Clearing)`,
        lines: [
          { accountCode: '1200', accountName: 'Raw Materials & Packaging Inventory', accountType: 'ASSET', debitInr: acceptedSubtotal, creditInr: 0, costCenter: 'CC-210' },
          { accountCode: '2110', accountName: 'Goods Received Not Invoiced (GRNI Clearing)', accountType: 'LIABILITY', debitInr: 0, creditInr: acceptedSubtotal, costCenter: 'CC-210' }
        ],
        totalDebitInr: acceptedSubtotal,
        totalCreditInr: acceptedSubtotal,
        isBalanced: true,
        postedByEmail: actor.email,
        status: 'POSTED'
      });
    }

    const [updatedGrn] = await tx
      .update(erpGoodsReceipts)
      .set({
        items: updatedItems,
        subtotalInr: acceptedSubtotal,
        taxInr,
        totalInr,
        qcStatus: payload.decision,
        inventoryPosted: true,
        inspectedByEmail: actor.email,
        inspectedAt: new Date(),
        inspectionNotes: payload.inspectionNotes || `QC Inspection: ${payload.decision}`,
        journalId,
        version: sql`${erpGoodsReceipts.version} + 1`,
        updatedAt: new Date()
      })
      .where(eq(erpGoodsReceipts.id, grn.id))
      .returning();

    const allFulfilled = poItems.every((it) => Number(it.receivedQty || 0) >= Number(it.quantity || 1));
    const anyReceived = poItems.some((it) => Number(it.receivedQty || 0) > 0);
    await tx
      .update(supplierPurchaseOrders)
      .set({
        items: poItems,
        receivedStatus: allFulfilled ? 'FULLY_RECEIVED' : anyReceived ? 'PARTIALLY_RECEIVED' : 'UNRECEIVED',
        status: allFulfilled ? 'RECEIVED' : anyReceived ? 'PARTIALLY_RECEIVED' : po.status,
        actualDeliveryDate: grn.receivedDate,
        receivedBy: actor.email,
        version: sql`${supplierPurchaseOrders.version} + 1`,
        updatedAt: new Date()
      })
      .where(eq(supplierPurchaseOrders.id, po.id));

    const qcNumber = await getNextSequence(tx, 'QC');
    await tx.insert(erpQcRecords).values({
      id: makeId('qc'),
      organizationId: ORG_ID,
      qcNumber,
      inspectionType: 'RAW_MATERIAL_INWARD',
      grnId: grn.id,
      subjectName: `${grn.supplierName} — ${grn.grnNumber}`,
      abvTestedPct: Number(payload.abvTestedPct || 0),
      specificGravity: 0.91,
      refractiveIndex: 1.44,
      gcmsMatchPct: Number(payload.gcmsMatchPct || 99.1),
      clarityResult: payload.decision === 'FAILED' ? 'REJECTED' : 'CONFORMS',
      olfactoryResult: payload.decision === 'FAILED' ? 'OFF_NOTE' : 'CONFORMS',
      microbiologyPass: payload.decision !== 'FAILED',
      decision: payload.decision === 'FAILED' ? 'FAILED' : 'PASSED',
      correctiveAction: payload.decision !== 'PASSED' ? (payload.inspectionNotes || 'Issue Supplier Debit Note for rejected qty.') : null,
      inspectorEmail: actor.email,
      approvedByEmail: actor.email,
      approvedAt: new Date(),
      status: 'COMPLETED'
    });

    await createErpNotification(tx, {
      departmentCode: 'INV',
      severity: payload.decision === 'FAILED' ? 'CRITICAL' : 'INFO',
      category: 'GRN_QC_COMPLETED',
      title: `GRN ${grn.grnNumber} QC ${payload.decision}`,
      message: `Accepted ₹${acceptedSubtotal.toLocaleString('en-IN')} added to usable inventory lots.${journalNumber ? ` Balanced journal ${journalNumber} posted.` : ''}`,
      linkModule: 'procurement',
      linkEntityId: grn.id
    });

    await recordErpAuditLog(tx, {
      action: 'PROCUREMENT_GRN_QC_APPROVED',
      entity: 'erp_goods_receipts',
      entityId: grn.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `QC ${payload.decision} on ${grn.grnNumber} (inventoryPosted=true, acceptedSubtotal=₹${acceptedSubtotal})`
    });

    return { grn: updatedGrn, journalNumber };
  });
}

// ============================================================================
// 6. SUPPLIER INVOICES (DUPLICATE CHECK, ATTACHMENTS, NON-PO APPROVAL, SINGLE AP POSTING)
// ============================================================================

async function postVendorInvoiceApJournalInTx(tx: any, actor: ErpActorContext, inv: any) {
  if (inv.journalPosted && inv.journalId) {
    return { journalId: inv.journalId, deduplicated: true };
  }

  // Compute GRNI Clearing already accrued if backed by GRNs
  let grniAccrued = 0;
  const linkedGrnIds: string[] = Array.isArray(inv.grnIds) ? inv.grnIds : [];
  if (linkedGrnIds.length > 0) {
    for (const gid of linkedGrnIds) {
      const grnRows = await tx.select().from(erpGoodsReceipts).where(eq(erpGoodsReceipts.id, gid));
      if (grnRows.length && grnRows[0].journalId && grnRows[0].inventoryPosted) {
        grniAccrued += Number(grnRows[0].subtotalInr || 0);
      }
    }
  }
  grniAccrued = round2(grniAccrued);

  const taxableAndFreight = round2(Number(inv.subtotalInr || 0) + Number(inv.freightInr || 0));
  const totalTax = round2(Number(inv.cgstInr || 0) + Number(inv.sgstInr || 0) + Number(inv.igstInr || 0));
  const grandTotal = round2(taxableAndFreight + totalTax);

  const journalNumber = await getNextSequence(tx, 'JRN');
  const journalId = makeId('jrn');
  const jLines: any[] = [];

  if (grniAccrued > 0) {
    const clearAmt = Math.min(grniAccrued, taxableAndFreight);
    jLines.push({
      accountCode: '2110',
      accountName: 'Goods Received Not Invoiced (GRNI Clearing)',
      accountType: 'LIABILITY',
      debitInr: clearAmt,
      creditInr: 0,
      costCenter: 'CC-210'
    });
    const variance = round2(taxableAndFreight - clearAmt);
    if (variance > 0.01) {
      jLines.push({
        accountCode: '5200',
        accountName: 'Freight & Purchase Price Variance',
        accountType: 'EXPENSE',
        debitInr: variance,
        creditInr: 0,
        costCenter: 'CC-210'
      });
    }
  } else {
    jLines.push({
      accountCode: inv.isNonPo ? '5150' : '1200',
      accountName: inv.isNonPo ? 'Direct Non-PO Procurement & Services Expense' : 'Raw Materials & Packaging Inventory',
      accountType: inv.isNonPo ? 'EXPENSE' : 'ASSET',
      debitInr: taxableAndFreight,
      creditInr: 0,
      costCenter: 'CC-210'
    });
  }

  if (totalTax > 0) {
    jLines.push({
      accountCode: '1310',
      accountName: 'Input GST Credit Receivable (18%)',
      accountType: 'ASSET',
      debitInr: totalTax,
      creditInr: 0,
      costCenter: 'CC-510'
    });
  }

  jLines.push({
    accountCode: '2100',
    accountName: 'Accounts Payable — Trade Suppliers',
    accountType: 'LIABILITY',
    debitInr: 0,
    creditInr: grandTotal,
    costCenter: 'CC-210'
  });

  await tx.insert(erpAccountingJournals).values({
    id: journalId,
    organizationId: ORG_ID,
    journalNumber,
    entryDate: inv.invoiceDate,
    fiscalPeriod: getFiscalPeriod(inv.invoiceDate),
    sourceModule: 'SUPPLIER_INVOICE',
    sourceEntityId: inv.id,
    narration: `Supplier Invoice ${inv.supplierInvoiceNumber} (${inv.voucherNumber}) — ${inv.supplierName}`,
    lines: jLines,
    totalDebitInr: grandTotal,
    totalCreditInr: grandTotal,
    isBalanced: true,
    postedByEmail: actor.email,
    status: 'POSTED'
  });

  await tx
    .update(erpVendorInvoices)
    .set({
      journalId,
      journalPosted: true,
      approvalStatus: 'APPROVED',
      approvedByEmail: actor.email,
      status: 'POSTED',
      updatedAt: new Date()
    })
    .where(eq(erpVendorInvoices.id, inv.id));

  if (inv.purchaseOrderId) {
    const pos = await tx.select().from(supplierPurchaseOrders).where(eq(supplierPurchaseOrders.id, inv.purchaseOrderId));
    if (pos.length) {
      await tx
        .update(supplierPurchaseOrders)
        .set({
          invoicedAmountInr: round2(Number(pos[0].invoicedAmountInr || 0) + grandTotal),
          updatedAt: new Date()
        })
        .where(eq(supplierPurchaseOrders.id, inv.purchaseOrderId));
    }
  }

  return { journalId, journalNumber, deduplicated: false };
}

export async function postVendorInvoiceTransaction(
  actor: ErpActorContext,
  payload: {
    supplierId: string;
    supplierInvoiceNumber: string;
    invoiceDate?: string;
    dueDate?: string;
    purchaseOrderId?: string;
    grnIds?: string[];
    isNonPo?: boolean;
    nonPoReason?: string;
    expenseCategory?: string;
    freightInr?: number;
    attachmentName?: string;
    attachmentUrlOrData?: string;
    items: Array<{ name: string; category?: string; qty: number; unit?: string; unitPriceInr: number; taxPct?: number }>;
    idempotencyKey?: string;
  }
) {
  await ensureProcurementSeeded();
  if (!payload.supplierId || !payload.supplierInvoiceNumber?.trim() || !Array.isArray(payload.items) || !payload.items.length) {
    throw new ValidationError('Supplier, external supplier invoice number, and at least one item are required.');
  }

  if (payload.idempotencyKey) {
    const dupKey = await db.select().from(erpVendorInvoices).where(eq(erpVendorInvoices.idempotencyKey, payload.idempotencyKey));
    if (dupKey.length) return { invoice: dupKey[0], deduplicated: true };
  }

  return await db.transaction(async (tx) => {
    const supps = await tx.select().from(procurementSuppliers).where(eq(procurementSuppliers.id, payload.supplierId));
    if (!supps.length) throw new NotFoundError('Supplier not found.');
    const supp = supps[0];

    // Duplicate Supplier Invoice Detection per supplier
    const normalizedInvNo = payload.supplierInvoiceNumber.trim().toLowerCase();
    const existingForSupp = await tx
      .select()
      .from(erpVendorInvoices)
      .where(eq(erpVendorInvoices.supplierId, supp.id));
    const dupInvoice = existingForSupp.find(
      (i) => i.supplierInvoiceNumber.trim().toLowerCase() === normalizedInvNo && i.status !== 'CANCELLED'
    );
    if (dupInvoice) {
      throw new ConflictError(
        `Duplicate supplier invoice "${payload.supplierInvoiceNumber.trim()}" already exists for ${supp.name} under voucher ${dupInvoice.voucherNumber}.`
      );
    }

    const [org] = await tx.select().from(erpOrganizations).where(eq(erpOrganizations.id, ORG_ID));
    const isInterState = (supp.stateName || 'Maharashtra').trim().toLowerCase() !== (org?.stateName || 'Maharashtra').trim().toLowerCase();

    const lines = payload.items.map((it) => {
      const qty = Number(it.qty || 1);
      const price = round2(Number(it.unitPriceInr || 0));
      const taxPct = Number(it.taxPct ?? 18);
      const sub = round2(qty * price);
      const taxAmt = round2((sub * taxPct) / 100);
      return { name: it.name, category: it.category || 'MISC_SUPPLIES', qty, unit: it.unit || 'units', unitPriceInr: price, taxPct, lineTotalInr: sub, taxAmt };
    });

    const subtotalInr = round2(lines.reduce((s, l) => s + l.lineTotalInr, 0));
    const totalTaxInr = round2(lines.reduce((s, l) => s + l.taxAmt, 0));
    const cgstInr = isInterState ? 0 : round2(totalTaxInr / 2);
    const sgstInr = isInterState ? 0 : round2(totalTaxInr - cgstInr);
    const igstInr = isInterState ? totalTaxInr : 0;
    const freightInr = round2(Number(payload.freightInr || 0));
    const totalAmountInr = round2(subtotalInr + cgstInr + sgstInr + igstInr + freightInr);

    // Non-PO purchase OR high-value purchase threshold enforcement
    const isNonPo = Boolean(payload.isNonPo || !payload.purchaseOrderId);
    const needsApproval = isNonPo && !actor.isSuperAdmin && actor.roleCode !== 'FINANCE_CONTROLLER';

    const voucherNumber = await getNextSequence(tx, 'PINV');
    const invoiceDate = payload.invoiceDate || currentIsoDate();
    const dueDate = payload.dueDate || addDaysIso(30);

    const [inv] = await tx
      .insert(erpVendorInvoices)
      .values({
        id: makeId('pinv'),
        organizationId: ORG_ID,
        voucherNumber,
        supplierId: supp.id,
        supplierName: supp.name,
        supplierGstin: supp.gstin || null,
        supplierInvoiceNumber: payload.supplierInvoiceNumber.trim(),
        invoiceDate,
        dueDate,
        purchaseOrderId: payload.purchaseOrderId || null,
        grnIds: payload.grnIds || [],
        isNonPo,
        nonPoReason: payload.nonPoReason || null,
        expenseCategory: payload.expenseCategory || (isNonPo ? 'DIRECT_NON_PO_EXPENSE' : 'RAW_MATERIAL_PURCHASE'),
        items: lines,
        subtotalInr,
        cgstInr,
        sgstInr,
        igstInr,
        freightInr,
        totalAmountInr,
        paidAmountInr: 0,
        debitNoteAmountInr: 0,
        balanceDueInr: totalAmountInr,
        attachmentName: payload.attachmentName || null,
        attachmentUrlOrData: payload.attachmentUrlOrData || null,
        approvalStatus: needsApproval ? 'PENDING_APPROVAL' : 'APPROVED',
        approvedByEmail: needsApproval ? null : actor.email,
        journalPosted: false,
        paymentStatus: 'UNPAID',
        idempotencyKey: payload.idempotencyKey || null,
        status: needsApproval ? 'PENDING_APPROVAL' : 'POSTED',
        createdByEmail: actor.email
      })
      .returning();

    if (payload.attachmentName && payload.attachmentUrlOrData) {
      await tx.insert(erpAttachments).values({
        id: makeId('att'),
        organizationId: ORG_ID,
        entityType: 'SUPPLIER_INVOICE',
        entityId: inv.id,
        fileName: payload.attachmentName,
        documentType: 'VENDOR_TAX_INVOICE',
        mimeType: 'application/pdf',
        fileSizeBytes: payload.attachmentUrlOrData.length,
        storageUrlOrData: payload.attachmentUrlOrData,
        notes: `Bill #${inv.supplierInvoiceNumber} (${supp.name})`,
        uploadedByEmail: actor.email
      });
    }

    let journalNumber: string | null = null;
    if (needsApproval) {
      const aprNumber = await getNextSequence(tx, 'APR');
      await tx.insert(erpApprovals).values({
        id: makeId('apr'),
        organizationId: ORG_ID,
        departmentId: 'dept-fin',
        approvalNumber: aprNumber,
        moduleKey: 'procurement',
        entityType: 'VENDOR_INVOICE',
        entityId: inv.id,
        title: `Approve Non-PO Vendor Bill ${inv.supplierInvoiceNumber} (${supp.name})`,
        summary: `Non-PO purchase ₹${totalAmountInr.toLocaleString('en-IN')}. Reason: ${payload.nonPoReason || 'Operational purchase'}.`,
        amountInr: totalAmountInr,
        requiredRoleCode: 'FINANCE_CONTROLLER',
        requestedByEmail: actor.email,
        status: 'PENDING'
      });
    } else {
      const j = await postVendorInvoiceApJournalInTx(tx, actor, inv);
      journalNumber = (j as any).journalNumber || null;
      inv.journalId = j.journalId;
      inv.journalPosted = true;
    }

    await recordErpAuditLog(tx, {
      action: 'PROCUREMENT_VENDOR_INVOICE_RECORDED',
      entity: 'erp_vendor_invoices',
      entityId: inv.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Recorded Bill ${inv.supplierInvoiceNumber} (${voucherNumber}) for ${supp.name}: ₹${totalAmountInr} | Posted=${inv.journalPosted}`
    });

    return { invoice: inv, journalNumber };
  });
}

export async function approveAndPostVendorInvoiceTransaction(actor: ErpActorContext, invoiceId: string) {
  return await db.transaction(async (tx) => {
    const rows = await tx.select().from(erpVendorInvoices).where(eq(erpVendorInvoices.id, invoiceId));
    if (!rows.length) throw new NotFoundError('Vendor invoice not found.');
    const inv = rows[0];
    if (inv.journalPosted) {
      return { invoice: inv, deduplicated: true };
    }
    const res = await postVendorInvoiceApJournalInTx(tx, actor, inv);
    const [updated] = await tx.select().from(erpVendorInvoices).where(eq(erpVendorInvoices.id, inv.id));
    return { invoice: updated, journalNumber: (res as any).journalNumber };
  });
}

// ============================================================================
// 7. PURCHASE RETURNS & DEBIT NOTES (STOCK DEDUCTION + AP REVERSAL)
// ============================================================================

export async function issueDebitNoteTransaction(
  actor: ErpActorContext,
  payload: {
    supplierId: string;
    purchaseOrderId?: string;
    grnId?: string;
    vendorInvoiceId?: string;
    returnType: 'QC_REJECTION' | 'DAMAGED_GOODS' | 'RATE_DIFFERENCE' | 'SHORT_SUPPLY';
    reason: string;
    items: Array<{ materialId?: string; materialName: string; returnQty: number; unit?: string; unitPriceInr: number }>;
    idempotencyKey?: string;
  }
) {
  await ensureProcurementSeeded();
  if (!payload.supplierId || !payload.reason?.trim() || !Array.isArray(payload.items) || !payload.items.length) {
    throw new ValidationError('Supplier, reason, and at least one debit note line item are required.');
  }

  if (payload.idempotencyKey) {
    const dup = await db.select().from(erpDebitNotes).where(eq(erpDebitNotes.idempotencyKey, payload.idempotencyKey));
    if (dup.length) return { debitNote: dup[0], deduplicated: true };
  }

  return await db.transaction(async (tx) => {
    const supps = await tx.select().from(procurementSuppliers).where(eq(procurementSuppliers.id, payload.supplierId));
    if (!supps.length) throw new NotFoundError('Supplier not found.');
    const supp = supps[0];

    const [org] = await tx.select().from(erpOrganizations).where(eq(erpOrganizations.id, ORG_ID));
    const isInterState = (supp.stateName || 'Maharashtra').trim().toLowerCase() !== (org?.stateName || 'Maharashtra').trim().toLowerCase();

    const dnItems: any[] = [];
    let taxableAmountInr = 0;

    for (const it of payload.items) {
      const qty = Number(it.returnQty || 0);
      const price = round2(Number(it.unitPriceInr || 0));
      const lineTotal = round2(qty * price);
      taxableAmountInr += lineTotal;
      dnItems.push({ ...it, returnQty: qty, unitPriceInr: price, lineTotalInr: lineTotal });

      // Deduct returned stock cleanly if materialId is linked and returnType implies physical return
      if (it.materialId && qty > 0 && (payload.returnType === 'DAMAGED_GOODS' || payload.returnType === 'QC_REJECTION')) {
        const mats = await tx.select().from(erpMaterials).where(eq(erpMaterials.id, it.materialId));
        if (mats.length) {
          const mat = mats[0];
          const nextStock = round2(Math.max(0, Number(mat.currentStock || 0) - qty));
          const nextStatus = nextStock <= 0 ? 'CRITICAL' : nextStock <= mat.reorderLevel ? 'LOW_STOCK' : 'OPTIMAL';
          await tx
            .update(erpMaterials)
            .set({ currentStock: nextStock, status: nextStatus, version: sql`${erpMaterials.version} + 1`, updatedAt: new Date() })
            .where(eq(erpMaterials.id, mat.id));
        }
      }
    }

    taxableAmountInr = round2(taxableAmountInr);
    if (taxableAmountInr <= 0) throw new ValidationError('Debit note taxable amount must be positive.');
    const totalGst = round2(taxableAmountInr * 0.18);
    const cgstInr = isInterState ? 0 : round2(totalGst / 2);
    const sgstInr = isInterState ? 0 : round2(totalGst - cgstInr);
    const igstInr = isInterState ? totalGst : 0;
    const totalDebitInr = round2(taxableAmountInr + cgstInr + sgstInr + igstInr);

    const debitNoteNumber = await getNextSequence(tx, 'DN');
    const journalNumber = await getNextSequence(tx, 'JRN');
    const journalId = makeId('jrn');
    const dnId = makeId('dn');
    const issueDate = currentIsoDate();

    await tx.insert(erpAccountingJournals).values({
      id: journalId,
      organizationId: ORG_ID,
      journalNumber,
      entryDate: issueDate,
      fiscalPeriod: getFiscalPeriod(issueDate),
      sourceModule: 'DEBIT_NOTE',
      sourceEntityId: dnId,
      narration: `Supplier Debit Note ${debitNoteNumber} (${supp.name}): ${payload.reason.trim()}`,
      lines: [
        { accountCode: '2100', accountName: 'Accounts Payable — Trade Suppliers', accountType: 'LIABILITY', debitInr: totalDebitInr, creditInr: 0, costCenter: 'CC-210' },
        { accountCode: '1200', accountName: 'Raw Materials & Purchase Returns', accountType: 'ASSET', debitInr: 0, creditInr: taxableAmountInr, costCenter: 'CC-210' },
        { accountCode: '1310', accountName: 'Input GST Credit Receivable (18%)', accountType: 'ASSET', debitInr: 0, creditInr: totalGst, costCenter: 'CC-510' }
      ],
      totalDebitInr: totalDebitInr,
      totalCreditInr: totalDebitInr,
      isBalanced: true,
      postedByEmail: actor.email,
      status: 'POSTED'
    });

    const [debitNote] = await tx
      .insert(erpDebitNotes)
      .values({
        id: dnId,
        organizationId: ORG_ID,
        debitNoteNumber,
        supplierId: supp.id,
        supplierName: supp.name,
        purchaseOrderId: payload.purchaseOrderId || null,
        grnId: payload.grnId || null,
        vendorInvoiceId: payload.vendorInvoiceId || null,
        issueDate,
        returnType: payload.returnType,
        reason: payload.reason.trim(),
        items: dnItems,
        taxableAmountInr,
        cgstInr,
        sgstInr,
        igstInr,
        totalDebitInr,
        journalId,
        createdByEmail: actor.email,
        idempotencyKey: payload.idempotencyKey || null,
        status: 'APPLIED'
      })
      .returning();

    if (payload.vendorInvoiceId) {
      const invs = await tx.select().from(erpVendorInvoices).where(eq(erpVendorInvoices.id, payload.vendorInvoiceId));
      if (invs.length) {
        const inv = invs[0];
        const newBal = round2(Math.max(0, Number(inv.balanceDueInr || 0) - totalDebitInr));
        await tx
          .update(erpVendorInvoices)
          .set({
            debitNoteAmountInr: round2(Number(inv.debitNoteAmountInr || 0) + totalDebitInr),
            balanceDueInr: newBal,
            paymentStatus: newBal <= 0.05 ? 'PAID' : inv.paymentStatus,
            version: sql`${erpVendorInvoices.version} + 1`,
            updatedAt: new Date()
          })
          .where(eq(erpVendorInvoices.id, inv.id));
      }
    }

    await recordErpAuditLog(tx, {
      action: 'PROCUREMENT_DEBIT_NOTE_ISSUED',
      entity: 'erp_debit_notes',
      entityId: dnId,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Issued Debit Note ${debitNoteNumber} (${supp.name}) ₹${totalDebitInr} | Journal ${journalNumber}`
    });

    return { debitNote, journalNumber };
  });
}

// ============================================================================
// 8. SUPPLIER PAYMENTS & ADVANCE PREPAYMENTS
// ============================================================================

export async function recordSupplierPaymentTransaction(
  actor: ErpActorContext,
  payload: {
    supplierId: string;
    vendorInvoiceId?: string;
    purchaseOrderId?: string;
    isAdvance?: boolean;
    method: string;
    referenceNumber: string;
    amountInr: number;
    paymentDate?: string;
    notes?: string;
    expectedInvoiceVersion?: number;
    idempotencyKey?: string;
  }
) {
  await ensureProcurementSeeded();
  const amt = round2(Number(payload.amountInr || 0));
  if (amt <= 0) throw new ValidationError('Payment amount must be positive.');
  if (!payload.referenceNumber?.trim()) throw new ValidationError('Payment UTR/Reference number is required.');

  if (payload.idempotencyKey) {
    const dup = await db.select().from(erpPayments).where(eq(erpPayments.idempotencyKey, payload.idempotencyKey));
    if (dup.length) return { payment: dup[0], deduplicated: true };
  }

  return await db.transaction(async (tx) => {
    const supps = await tx.select().from(procurementSuppliers).where(eq(procurementSuppliers.id, payload.supplierId));
    if (!supps.length) throw new NotFoundError('Supplier not found.');
    const supp = supps[0];
    const isAdvance = Boolean(payload.isAdvance && !payload.vendorInvoiceId);

    let updatedInvoice: any = null;
    if (payload.vendorInvoiceId) {
      const invs = await tx.select().from(erpVendorInvoices).where(eq(erpVendorInvoices.id, payload.vendorInvoiceId));
      if (!invs.length) throw new NotFoundError('Referenced Supplier Invoice not found.');
      const inv = invs[0];
      if (payload.expectedInvoiceVersion !== undefined && inv.version !== payload.expectedInvoiceVersion) {
        throw new ConflictError(`Vendor Invoice ${inv.voucherNumber} was modified concurrently.`);
      }
      if (inv.approvalStatus !== 'APPROVED') {
        throw new ValidationError(`Vendor Invoice ${inv.voucherNumber} must be approved before payment.`);
      }
      if (amt > inv.balanceDueInr + 0.5) {
        throw new ValidationError(`Payment ₹${amt} exceeds invoice balance due ₹${inv.balanceDueInr}.`);
      }

      const newPaid = round2(inv.paidAmountInr + amt);
      const newBal = round2(Math.max(0, inv.balanceDueInr - amt));
      const newPayStatus = newBal <= 0.05 ? 'PAID' : 'PARTIAL';

      const [upd] = await tx
        .update(erpVendorInvoices)
        .set({
          paidAmountInr: newPaid,
          balanceDueInr: newBal,
          paymentStatus: newPayStatus,
          status: newPayStatus === 'PAID' ? 'PAID' : inv.status,
          version: sql`${erpVendorInvoices.version} + 1`,
          updatedAt: new Date()
        })
        .where(eq(erpVendorInvoices.id, inv.id))
        .returning();
      updatedInvoice = upd;
    }

    if (payload.purchaseOrderId) {
      const pos = await tx.select().from(supplierPurchaseOrders).where(eq(supplierPurchaseOrders.id, payload.purchaseOrderId));
      if (pos.length) {
        const po = pos[0];
        const newAdv = isAdvance ? round2(Number(po.advancePaidInr || 0) + amt) : Number(po.advancePaidInr || 0);
        const totalSettled = newAdv + (isAdvance ? 0 : amt);
        await tx
          .update(supplierPurchaseOrders)
          .set({
            advancePaidInr: newAdv,
            paymentStatus: totalSettled >= po.totalCostInr - 1 ? 'PAID' : 'PARTIALLY_PAID',
            updatedAt: new Date()
          })
          .where(eq(supplierPurchaseOrders.id, po.id));
      }
    }

    const paymentDate = payload.paymentDate || currentIsoDate();
    const paymentNumber = await getNextSequence(tx, 'PAY');
    const journalNumber = await getNextSequence(tx, 'JRN');
    const journalId = makeId('jrn');

    const jLines = isAdvance
      ? [
          { accountCode: '1150', accountName: 'Supplier Advances & Prepayments', accountType: 'ASSET', debitInr: amt, creditInr: 0, costCenter: 'CC-210' },
          { accountCode: '1010', accountName: 'HDFC Operating Bank Account', accountType: 'ASSET', debitInr: 0, creditInr: amt, costCenter: 'CC-510' }
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
      sourceModule: 'SUPPLIER_PAYMENT',
      sourceEntityId: payload.vendorInvoiceId || payload.purchaseOrderId || paymentNumber,
      narration: `${isAdvance ? 'Advance Payout' : 'AP Bill Settlement'} ${paymentNumber} (${payload.method} ${payload.referenceNumber}) — ${supp.name}`,
      lines: jLines,
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
        direction: 'OUTBOUND_PAYOUT',
        partyType: 'SUPPLIER',
        partyName: supp.name,
        purchaseOrderId: payload.purchaseOrderId || null,
        supplierId: supp.id,
        vendorInvoiceId: payload.vendorInvoiceId || null,
        isAdvance,
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
      action: isAdvance ? 'PROCUREMENT_ADVANCE_PAID' : 'PROCUREMENT_AP_SETTLED',
      entity: 'erp_payments',
      entityId: payment.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `${paymentNumber} (${isAdvance ? 'Advance' : 'Bill Payment'}) ₹${amt} to ${supp.name} | Journal ${journalNumber}`
    });

    return { payment, updatedInvoice, journalNumber };
  });
}
