import crypto from 'crypto';
import { eq, desc, and, sql, inArray } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  erpMaterials,
  erpStockLots,
  erpStockMovements,
  erpWarehouses,
  erpFormulations,
  erpFormulationVersions,
  erpFinishedGoods,
  erpQcRecords,
  erpApprovals,
  erpAccountingJournals,
  erpSequences,
  erpOnceEditions,
  erpOnceSerialNumbers,
  erpBatchEvents,
  productionBatches,
  inventoryLedger,
  products,
  orders,
  erpGoodsReceipts,
  supplierPurchaseOrders,
  procurementSuppliers
} from '../db/schema.ts';
import {
  ORG_ID,
  getNextSequence,
  recordErpAuditLog,
  createErpNotification,
  ensureErpSeeded,
  ValidationError,
  ConflictError,
  NotFoundError,
  ForbiddenError,
  type ErpActorContext
} from './erpBusinessOsEngine.ts';
import { syncSkuToProductVariants, calculateLedgerAvailable } from './operationsAutomationEngine.ts';

// ============================================================================
// CONSTANTS, UOM & VALIDATED DENSITY CONVERSION ENGINE
// ============================================================================

export const STOCK_CATEGORIES = [
  'RAW_MATERIAL',
  'FRAGRANCE_OIL',
  'PACKAGING',
  'WIP',
  'FINISHED_GOODS',
  'SAMPLE',
  'DAMAGED'
] as const;

export type StockCategory = (typeof STOCK_CATEGORIES)[number];

export const BATCH_PIPELINE_STAGES = [
  'PLANNING',
  'AVAILABILITY_CHECK',
  'RESERVED',
  'AUTHORIZED',
  'MATERIAL_ISSUED',
  'MIXING',
  'MATURATION',
  'QC',
  'FILLING',
  'PACKING',
  'RELEASED'
] as const;

export type BatchPipelineStage = (typeof BATCH_PIPELINE_STAGES)[number];

export const STANDARD_BOTTLE_SIZES = ['2ML', '10ML', '15ML', '30ML', '50ML'] as const;

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
}

function round4(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 10000) / 10000;
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

function getFiscalPeriod(dateStr?: string): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  const year = d.getUTCMonth() >= 3 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  return `FY${year}-${String((year + 1) % 100).padStart(2, '0')}`;
}

export type CanonicalUom = 'g' | 'kg' | 'ml' | 'l' | 'pcs';

export function normalizeUom(raw?: string): CanonicalUom {
  const u = String(raw || 'pcs').trim().toLowerCase();
  if (u === 'g' || u === 'gram' || u === 'grams' || u === 'gm' || u === 'gms') return 'g';
  if (u === 'kg' || u === 'kgs' || u === 'kilogram' || u === 'kilograms') return 'kg';
  if (u === 'ml' || u === 'milliliter' || u === 'milliliters' || u === 'millilitre' || u === 'millilitres') return 'ml';
  if (u === 'l' || u === 'liter' || u === 'liters' || u === 'litre' || u === 'litres') return 'l';
  if (u === 'pcs' || u === 'pc' || u === 'unit' || u === 'units' || u === 'piece' || u === 'pieces' || u === 'boxes' || u === 'nos') return 'pcs';
  throw new ValidationError(`Unsupported unit "${raw}". Allowed units: g, kg, ml, l, pcs.`);
}

export function isMassUom(u: CanonicalUom): boolean {
  return u === 'g' || u === 'kg';
}

export function isVolumeUom(u: CanonicalUom): boolean {
  return u === 'ml' || u === 'l';
}

/**
 * Converts material quantity between supported units (g, kg, ml, l, pcs).
 * STRICT DOMAIN INVARIANT:
 * Never assumes 1g = 1ml. Requires positive validated material-specific density (g/mL)
 * whenever converting between mass (g, kg) and volume (ml, l).
 */
export function convertMaterialQty(params: {
  qty: number;
  fromUom: string;
  toUom: string;
  densityGPerMl?: number | null;
  densityValidated?: boolean;
  materialName?: string;
}): { convertedQty: number; densityUsedGPerMl: number | null; factorUsed: number } {
  const qty = Number(params.qty);
  if (!Number.isFinite(qty) || qty < 0) {
    throw new ValidationError(`Invalid quantity "${params.qty}" for unit conversion.`);
  }
  const from = normalizeUom(params.fromUom);
  const to = normalizeUom(params.toUom);

  if (from === to) {
    return { convertedQty: round4(qty), densityUsedGPerMl: null, factorUsed: 1 };
  }

  if (from === 'pcs' || to === 'pcs') {
    throw new ValidationError(
      `Cannot convert discrete piece count (${from}) to/from continuous mass or volume (${to}) for ${params.materialName || 'material'}.`
    );
  }

  // Mass <-> Mass
  if (isMassUom(from) && isMassUom(to)) {
    const grams = from === 'kg' ? qty * 1000 : qty;
    const result = to === 'kg' ? grams / 1000 : grams;
    return { convertedQty: round4(result), densityUsedGPerMl: null, factorUsed: to === 'kg' ? 0.001 : 1000 };
  }

  // Volume <-> Volume
  if (isVolumeUom(from) && isVolumeUom(to)) {
    const ml = from === 'l' ? qty * 1000 : qty;
    const result = to === 'l' ? ml / 1000 : ml;
    return { convertedQty: round4(result), densityUsedGPerMl: null, factorUsed: to === 'l' ? 0.001 : 1000 };
  }

  // Cross-dimension Mass <-> Volume: MUST have validated densityGPerMl > 0
  const density = Number(params.densityGPerMl);
  if (!Number.isFinite(density) || density <= 0 || params.densityValidated === false) {
    throw new ValidationError(
      `Density validation required: Material "${params.materialName || 'unknown'}" cannot convert between ${from} and ${to} without a validated specific density (g/mL). Never assume 1g = 1ml.`
    );
  }
  if (density < 0.4 || density > 3.5) {
    throw new ValidationError(
      `Density ${density} g/mL for "${params.materialName || 'material'}" is outside plausible aromatic/solvent range (0.40 – 3.50 g/mL).`
    );
  }

  if (isMassUom(from) && isVolumeUom(to)) {
    const grams = from === 'kg' ? qty * 1000 : qty;
    const ml = grams / density; // V = m / rho
    const out = to === 'l' ? ml / 1000 : ml;
    return { convertedQty: round4(out), densityUsedGPerMl: density, factorUsed: round4(out / (qty || 1)) };
  } else {
    // Volume -> Mass: m = V * rho
    const ml = from === 'l' ? qty * 1000 : qty;
    const grams = ml * density;
    const out = to === 'kg' ? grams / 1000 : grams;
    return { convertedQty: round4(out), densityUsedGPerMl: density, factorUsed: round4(out / (qty || 1)) };
  }
}

export function inferStockTypeFromCategory(category: string): StockCategory {
  const c = String(category || '').toUpperCase();
  if (['ESSENTIAL_OIL', 'FRAGRANCE_OIL', 'ABSOLUTE'].includes(c)) return 'FRAGRANCE_OIL';
  if (['AROMA_CHEMICAL', 'SOLVENT', 'PERFUME_SOLVENT', 'RAW_MATERIALS'].includes(c)) return 'RAW_MATERIAL';
  if (['GLASS_FLACON', 'BOTTLES', 'ATOMIZER_CAP', 'CAPS', 'SPRAYERS', 'COFFRET_BOX', 'CARTONS', 'LABELS', 'LABEL', 'CORRUGATED', 'DISCOVERY_PACKAGING', 'PACKING_CONSUMABLES'].includes(c)) {
    return 'PACKAGING';
  }
  if (['SAMPLE_VIALS', 'SAMPLE'].includes(c)) return 'SAMPLE';
  return 'RAW_MATERIAL';
}

export function parseBottleSizeMl(sizeLabel: string): number {
  const m = String(sizeLabel || '').match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : 50;
}

// ============================================================================
// IDEMPOTENT MANUFACTURING SEEDING & MIGRATION ENRICHMENT
// ============================================================================

let mfgSeedPromise: Promise<void> | null = null;

export async function ensureManufacturingSeeded(): Promise<void> {
  if (mfgSeedPromise) return mfgSeedPromise;
  mfgSeedPromise = (async () => {
    try {
      await ensureErpSeeded();

      // 1. Register Manufacturing Sequences safely above existing/seeded IDs
      const seqDefs = [
        { seqKey: 'MOV', prefix: 'MOV-2026-', currentValue: 1005, padding: 5 },
        { seqKey: 'ONCE', prefix: 'ONCE-2026-', currentValue: 105, padding: 3 },
        { seqKey: 'BATCH', prefix: 'BATCH-FRG-2026-', currentValue: 1015, padding: 4 }
      ];
      for (const s of seqDefs) {
        await db.insert(erpSequences).values(s).onConflictDoNothing();
      }
      await db
        .update(erpSequences)
        .set({ currentValue: sql`GREATEST(${erpSequences.currentValue}, 1015)` })
        .where(eq(erpSequences.seqKey, 'BATCH'));

      // 2. Ensure validated material-specific densities on aromatic liquids & stockType classifications
      const densityMap: Record<string, { density: number | null; validated: boolean; stockType: StockCategory; uom?: CanonicalUom }> = {
        'mat-conc-gold': { density: 0.912, validated: true, stockType: 'FRAGRANCE_OIL', uom: 'l' },
        'mat-conc-oud': { density: 0.958, validated: true, stockType: 'FRAGRANCE_OIL', uom: 'l' },
        'mat-conc-velvet': { density: 0.924, validated: true, stockType: 'FRAGRANCE_OIL', uom: 'l' },
        'mat-solv-eth': { density: 0.789, validated: true, stockType: 'RAW_MATERIAL', uom: 'l' }, // Pure perfumery ethanol density = 0.789 g/mL (CRITICAL: NOT 1.0!)
        'mat-aroma-iso': { density: 0.935, validated: true, stockType: 'RAW_MATERIAL', uom: 'kg' },
        'mat-flacon-50': { density: null, validated: false, stockType: 'PACKAGING', uom: 'pcs' },
        'mat-flacon-15': { density: null, validated: false, stockType: 'PACKAGING', uom: 'pcs' },
        'mat-vial-2': { density: null, validated: false, stockType: 'PACKAGING', uom: 'pcs' },
        'mat-cap-gold': { density: null, validated: false, stockType: 'PACKAGING', uom: 'pcs' },
        'mat-box-rig': { density: null, validated: false, stockType: 'PACKAGING', uom: 'pcs' },
        'mat-spray-gold': { density: null, validated: false, stockType: 'PACKAGING', uom: 'pcs' },
        'mat-label-foil': { density: null, validated: false, stockType: 'PACKAGING', uom: 'pcs' },
        'mat-pack-tape': { density: null, validated: false, stockType: 'PACKAGING', uom: 'pcs' }
      };

      const mats = await db.select().from(erpMaterials);
      for (const m of mats) {
        const cfg = densityMap[m.id];
        if (cfg) {
          if (m.densityGPerMl !== cfg.density || m.densityValidated !== cfg.validated || m.stockType !== cfg.stockType) {
            await db
              .update(erpMaterials)
              .set({
                densityGPerMl: m.densityGPerMl ?? cfg.density,
                densityValidated: m.densityValidated || cfg.validated,
                stockType: cfg.stockType
              })
              .where(eq(erpMaterials.id, m.id));
          }
        } else if (!m.stockType || m.stockType === 'RAW_MATERIAL') {
          const inferred = inferStockTypeFromCategory(m.category);
          if (inferred !== m.stockType) {
            await db.update(erpMaterials).set({ stockType: inferred }).where(eq(erpMaterials.id, m.id));
          }
        }
      }

      // Ensure 30ml & 10ml packaging materials exist so multi-size BOM supports 2ML, 10ML, 15ML, 30ML, 50ML out-of-box
      const sizePackagingSeeds = [
        {
          id: 'mat-flacon-30',
          code: 'PKG-FLC-030',
          name: '30ml Heavy Italian Crimp Crystal Flacon',
          category: 'GLASS_FLACON',
          stockType: 'PACKAGING',
          uom: 'pcs',
          unitCostInr: 145,
          currentStock: 680,
          reservedStock: 0,
          reorderLevel: 300,
          targetStock: 1200,
          defaultWarehouseId: 'wh-mumbai-pkg',
          status: 'OPTIMAL'
        },
        {
          id: 'mat-flacon-10',
          code: 'PKG-FLC-010',
          name: '10ml Pocket Atomizer Glass Flacon',
          category: 'GLASS_FLACON',
          stockType: 'PACKAGING',
          uom: 'pcs',
          unitCostInr: 68,
          currentStock: 1100,
          reservedStock: 0,
          reorderLevel: 400,
          targetStock: 2000,
          defaultWarehouseId: 'wh-mumbai-pkg',
          status: 'OPTIMAL'
        }
      ];
      for (const sp of sizePackagingSeeds) {
        await db.insert(erpMaterials).values({ organizationId: ORG_ID, ...sp }).onConflictDoNothing();
        await db
          .insert(erpStockLots)
          .values({
            id: `lot-${sp.id}`,
            organizationId: ORG_ID,
            materialId: sp.id,
            warehouseId: sp.defaultWarehouseId,
            warehouseLocation: 'PKG-R2-B4',
            stockCategory: 'PACKAGING',
            uom: 'pcs',
            lotNumber: `LOT-2026-${sp.code.slice(-3)}`,
            supplierBatchRef: `SUP-${sp.code.slice(-3)}-A1`,
            receivedQty: sp.currentStock,
            availableQty: sp.currentStock,
            reservedQty: 0,
            consumedQty: 0,
            damagedQty: 0,
            unitCostInr: sp.unitCostInr,
            receivedDate: addDaysIso(-18),
            retestDate: addDaysIso(365),
            expiryDate: addDaysIso(1095),
            qcStatus: 'APPROVED',
            status: 'ACTIVE'
          })
          .onConflictDoNothing();
      }

      // 2b. Ensure every material with currentStock > 0 has at least one active FIFO lot + OPENING ledger row
      const existingLotsNow = await db.select().from(erpStockLots);
      const allMatsNow = await db.select().from(erpMaterials);
      for (const m of allMatsNow) {
        if (Number(m.currentStock || 0) <= 0) continue;
        const hasAnyLot = existingLotsNow.some((l) => l.materialId === m.id);
        if (!hasAnyLot) {
          const cat = (m.stockType as StockCategory) || inferStockTypeFromCategory(m.category);
          const u = normalizeUom(m.uom);
          const lotId = `lot-init-${m.id}`;
          const lotNumber = `LOT-2026-${m.code.replace(/[^A-Z0-9]/gi, '').slice(-5)}-${m.id.replace(/[^A-Z0-9]/gi, '').slice(-4).toUpperCase()}`;
          const qty = Number(m.currentStock || 0);
          const insertedLot = await db
            .insert(erpStockLots)
            .values({
              id: lotId,
              organizationId: ORG_ID,
              materialId: m.id,
              warehouseId: m.defaultWarehouseId || (cat === 'PACKAGING' ? 'wh-mumbai-pkg' : 'wh-mumbai-rm'),
              warehouseLocation: cat === 'PACKAGING' ? 'PKG-BAY-01' : 'VAULT-BAY-01',
              stockCategory: cat,
              uom: u,
              lotNumber,
              supplierBatchRef: `OPEN-${m.code}`,
              supplierName: 'Opening Atelier Inventory',
              receivedQty: qty,
              availableQty: qty,
              reservedQty: 0,
              consumedQty: 0,
              damagedQty: 0,
              unitCostInr: m.unitCostInr,
              receivedDate: addDaysIso(-21),
              retestDate: addDaysIso(340),
              expiryDate: addDaysIso(1095),
              qcStatus: 'APPROVED',
              status: 'ACTIVE'
            })
            .onConflictDoNothing()
            .returning();

          if (insertedLot.length > 0) {
            await db
              .insert(erpStockMovements)
              .values({
                id: `mov-init-${lotId}`,
                organizationId: ORG_ID,
                movementNumber: `MOV-2026-${m.id.replace(/[^A-Z0-9]/gi, '').slice(-6).toUpperCase()}`,
                movementDate: addDaysIso(-21),
                stockCategory: cat,
                movementType: 'OPENING',
                materialId: m.id,
                materialCode: m.code,
                materialName: m.name,
                lotId: insertedLot[0].id,
                lotNumber: insertedLot[0].lotNumber,
                warehouseId: m.defaultWarehouseId || 'wh-mumbai-rm',
                warehouseLocation: cat === 'PACKAGING' ? 'PKG-BAY-01' : 'VAULT-BAY-01',
                qtyDelta: qty,
                uom: u,
                balanceBefore: 0,
                balanceAfter: qty,
                unitCostInr: m.unitCostInr,
                totalCostInr: round2(qty * m.unitCostInr),
                densityUsedGPerMl: m.densityGPerMl ?? null,
                referenceType: 'MATERIAL',
                referenceId: m.id,
                reason: `Opening inventory baseline lot for ${m.code}`,
                performedByEmail: 'system@fragmore.shop'
              })
              .onConflictDoNothing();
          }
        }
      }

      // 3. Backfill lot stockCategory & uom cleanly for existing seeded lots
      const allLots = await db.select().from(erpStockLots);
      const updatedMats = await db.select().from(erpMaterials);
      for (const lot of allLots) {
        const m = updatedMats.find((x) => x.id === lot.materialId);
        if (m && (lot.stockCategory === 'RAW_MATERIAL' || !lot.uom || lot.uom === 'pcs')) {
          const cat = (m.stockType as StockCategory) || inferStockTypeFromCategory(m.category);
          const u = normalizeUom(m.uom);
          if (lot.stockCategory !== cat || lot.uom !== u) {
            await db
              .update(erpStockLots)
              .set({
                stockCategory: cat,
                uom: u,
                retestDate: lot.retestDate || addDaysIso(340),
                warehouseLocation: lot.warehouseLocation || 'BAY-A1'
              })
              .where(eq(erpStockLots.id, lot.id));
          }
        }
      }

      // 4. Seed baseline immutable Stock Movement Ledger rows if empty (one OPENING entry per existing lot)
      const existingMovs = await db.select().from(erpStockMovements).limit(1);
      if (!existingMovs.length) {
        const freshLots = await db.select().from(erpStockLots);
        let idx = 1;
        for (const lot of freshLots) {
          const m = updatedMats.find((x) => x.id === lot.materialId);
          if (!m) continue;
          const movNum = `MOV-2026-${String(idx).padStart(5, '0')}`;
          idx++;
          await db
            .insert(erpStockMovements)
            .values({
              id: `mov-init-${lot.id}`,
              organizationId: ORG_ID,
              movementNumber: movNum,
              movementDate: lot.receivedDate || currentIsoDate(),
              stockCategory: lot.stockCategory || 'RAW_MATERIAL',
              movementType: 'OPENING',
              materialId: m.id,
              materialCode: m.code,
              materialName: m.name,
              lotId: lot.id,
              lotNumber: lot.lotNumber,
              warehouseId: lot.warehouseId,
              warehouseLocation: lot.warehouseLocation || 'BAY-A1',
              qtyDelta: lot.receivedQty,
              uom: normalizeUom(m.uom),
              balanceBefore: 0,
              balanceAfter: lot.receivedQty,
              unitCostInr: lot.unitCostInr,
              totalCostInr: round2(lot.receivedQty * lot.unitCostInr),
              densityUsedGPerMl: m.densityGPerMl ?? null,
              referenceType: 'MATERIAL',
              referenceId: m.id,
              reason: `Opening inventory ledger baseline for ${lot.lotNumber}`,
              performedByEmail: 'system@fragmore.shop'
            })
            .onConflictDoNothing();
        }
        await db
          .update(erpSequences)
          .set({ currentValue: Math.max(1005, idx + 10) })
          .where(eq(erpSequences.seqKey, 'MOV'));
      }

      // 5. Enrich seeded formulation versions with density-backed Packaging BOM & multi-size cost breakdown (2ML, 10ML, 15ML, 30ML, 50ML)
      const fVers = await db.select().from(erpFormulationVersions);
      for (const fv of fVers) {
        if (!fv.packagingBom || !fv.bottleSizeCosts) {
          const packagingBom = buildDefaultPackagingBom(updatedMats);
          const avgDensity = computeFormulationWeightedDensity(fv.ingredients as any[], updatedMats) || 0.835;
          const bottleSizeCosts = computeBottleSizeCosts({
            costPerKgInr: fv.costPerKgInr,
            densityGPerMl: avgDensity,
            packagingBom,
            sizes: ['2ML', '10ML', '15ML', '30ML', '50ML']
          });
          const cost50 = bottleSizeCosts.find((c) => c.sizeLabel === '50ML')?.totalEstimatedCostPerBottleInr || fv.estimatedCostPer50mlInr;
          await db
            .update(erpFormulationVersions)
            .set({
              concentratePct: fv.concentratePct || 28,
              solventPct: fv.solventPct || 72,
              targetBatchSize: fv.targetBatchSize || 10,
              targetBatchUnit: fv.targetBatchUnit || 'kg',
              expectedYieldPct: fv.expectedYieldPct || 98,
              expectedYieldQty: fv.expectedYieldQty || 9.8,
              packagingBom,
              bottleSizeCosts,
              supportedBottleSizes: ['2ML', '10ML', '15ML', '30ML', '50ML'],
              estimatedCostPer50mlInr: cost50,
              authorizedRoleCodes: fv.authorizedRoleCodes || ['SUPER_ADMIN', 'FORMULATOR']
            })
            .where(eq(erpFormulationVersions.id, fv.id));
        }
      }

      // 6. Seed 1 Planned Once Collection limited-edition if empty (for demonstration)
      const existingOnce = await db.select().from(erpOnceEditions).limit(1);
      if (!existingOnce.length) {
        await db
          .insert(erpOnceEditions)
          .values({
            id: 'once-seed-01',
            organizationId: ORG_ID,
            editionCode: 'ONCE-2026-101',
            editionName: 'SOLSTICE EXTRAIT DE PARFUMS — EDITION I',
            fragranceName: 'GOLDEN HOUR',
            formulationId: 'frm-golden-hour',
            lockedFormulationVersionId: 'fver-frm-golden-hour-v2',
            lockedFormulationVersionNumber: 2,
            productId: 'prod-golden-hour',
            sku: 'FRG-GLD-050',
            bottleSizeMl: 50,
            declaredQuantity: 250,
            producedQuantity: 0,
            status: 'PLANNED',
            authorizedByEmail: 'aibrandorigin@gmail.com',
            notes: 'Strict one-time 250-bottle Reserve Drop. Formula v2 locked; permanent closure upon release.'
          })
          .onConflictDoNothing();
      }
    } catch (err) {
      mfgSeedPromise = null;
      console.error('[Manufacturing Seed] Error:', err);
      throw err;
    }
  })();
  return mfgSeedPromise;
}

// ============================================================================
// PACKAGING BOM & BOTTLE COST CALCULATION HELPERS
// ============================================================================

export function buildDefaultPackagingBom(materials: any[]) {
  const findMat = (id: string, fallbackName: string, fallbackCost: number) => {
    const m = materials.find((x) => x.id === id);
    return {
      materialId: m?.id || id,
      materialName: m?.name || fallbackName,
      unitCostInr: Number(m?.unitCostInr || fallbackCost)
    };
  };
  const flacon50 = findMat('mat-flacon-50', '50ml Heavy Italian Crimp Crystal Flacon', 185);
  const flacon30 = findMat('mat-flacon-30', '30ml Heavy Italian Crimp Crystal Flacon', 145);
  const flacon15 = findMat('mat-flacon-15', '15ml Travel Atelier Glass Flacon', 95);
  const flacon10 = findMat('mat-flacon-10', '10ml Pocket Atomizer Glass Flacon', 68);
  const vial2 = findMat('mat-vial-2', '2ml Borosilicate Discovery Sample Vial', 22);
  const cap = findMat('mat-cap-gold', 'Brushed Champagne Gold Magnetic Zamac Cap', 112);
  const sprayer = findMat('mat-spray-gold', 'Crimp Micro-Mist Luxury Brass Sprayer (FEA15)', 42);
  const label = findMat('mat-label-foil', 'Hot-Foil Stamped Textured Cotton Labels', 14);
  const box = findMat('mat-box-rig', 'Handcrafted Linen & Gold Foil Rigid Coffret', 145);

  return {
    '2ML': [
      { ...vial2, componentType: 'BOTTLE', qtyPerBottle: 1 },
      { ...label, componentType: 'LABEL', qtyPerBottle: 1 }
    ],
    '10ML': [
      { ...flacon10, componentType: 'BOTTLE', qtyPerBottle: 1 },
      { ...sprayer, componentType: 'SPRAYER', qtyPerBottle: 1 },
      { ...label, componentType: 'LABEL', qtyPerBottle: 1 }
    ],
    '15ML': [
      { ...flacon15, componentType: 'BOTTLE', qtyPerBottle: 1 },
      { ...sprayer, componentType: 'SPRAYER', qtyPerBottle: 1 },
      { ...label, componentType: 'LABEL', qtyPerBottle: 1 },
      { ...box, componentType: 'CARTON', qtyPerBottle: 1 }
    ],
    '30ML': [
      { ...flacon30, componentType: 'BOTTLE', qtyPerBottle: 1 },
      { ...cap, componentType: 'CAP', qtyPerBottle: 1 },
      { ...sprayer, componentType: 'SPRAYER', qtyPerBottle: 1 },
      { ...label, componentType: 'LABEL', qtyPerBottle: 1 },
      { ...box, componentType: 'CARTON', qtyPerBottle: 1 }
    ],
    '50ML': [
      { ...flacon50, componentType: 'BOTTLE', qtyPerBottle: 1 },
      { ...cap, componentType: 'CAP', qtyPerBottle: 1 },
      { ...sprayer, componentType: 'SPRAYER', qtyPerBottle: 1 },
      { ...label, componentType: 'LABEL', qtyPerBottle: 1 },
      { ...box, componentType: 'CARTON', qtyPerBottle: 1 }
    ]
  } as Record<string, Array<{ materialId: string; materialName: string; componentType: string; qtyPerBottle: number; unitCostInr: number }>>;
}

export function computeFormulationWeightedDensity(ingredients: any[], materials: any[]): number | null {
  let weightedSum = 0;
  let pctCovered = 0;
  for (const ing of ingredients || []) {
    const mat = materials.find((m) => m.id === ing.materialId);
    const dens = Number(ing.densityGPerMl || mat?.densityGPerMl || 0);
    const pct = Number(ing.percentage || 0);
    if (dens > 0 && pct > 0) {
      weightedSum += (pct / 100) * dens;
      pctCovered += pct;
    }
  }
  if (pctCovered <= 0) return null;
  return round4(weightedSum / (pctCovered / 100));
}

export function computeBottleSizeCosts(params: {
  costPerKgInr: number;
  densityGPerMl: number;
  packagingBom: Record<string, any[]>;
  sizes: string[];
}) {
  return params.sizes.map((sizeLabel) => {
    const sizeMl = parseBottleSizeMl(sizeLabel);
    // Mass per bottle in kg = (sizeMl * densityGPerMl) / 1000 — strictly density-based, NEVER 1g=1ml
    const massKgPerBottle = (sizeMl * params.densityGPerMl) / 1000;
    const juiceCostInr = round2(massKgPerBottle * params.costPerKgInr);
    const bomLines = params.packagingBom?.[sizeLabel] || params.packagingBom?.['50ML'] || [];
    const packagingCostInr = round2(
      bomLines.reduce((s: number, l: any) => s + Number(l.qtyPerBottle || 1) * Number(l.unitCostInr || 0), 0)
    );
    return {
      sizeLabel,
      sizeMl,
      densityGPerMl: params.densityGPerMl,
      juiceMassGramsPerBottle: round2(sizeMl * params.densityGPerMl),
      juiceCostInr,
      packagingCostInr,
      totalEstimatedCostPerBottleInr: round2(juiceCostInr + packagingCostInr)
    };
  });
}

// ============================================================================
// IMMUTABLE STOCK MOVEMENT LEDGER HELPER (CORE TRANSACTION ENGINE)
// ============================================================================

export async function appendStockMovementTx(
  tx: any,
  params: {
    movementDate?: string;
    stockCategory: StockCategory;
    movementType:
      | 'OPENING'
      | 'RECEIPT'
      | 'RESERVATION'
      | 'RELEASE_RESERVATION'
      | 'ISSUE_TO_BATCH'
      | 'WIP_TRANSFER'
      | 'FILLING_OUTPUT'
      | 'PACKING_CONSUMPTION'
      | 'FG_RELEASE'
      | 'SAMPLE_ISSUE'
      | 'DAMAGE_WRITEOFF'
      | 'REWORK'
      | 'RETURN'
      | 'ADJUSTMENT';
    materialId?: string | null;
    materialCode?: string | null;
    materialName: string;
    lotId?: string | null;
    lotNumber?: string | null;
    finishedGoodId?: string | null;
    sku?: string | null;
    batchId?: string | null;
    batchNumber?: string | null;
    warehouseId?: string | null;
    warehouseLocation?: string | null;
    qtyDelta: number;
    uom: string;
    balanceBefore: number;
    balanceAfter: number;
    unitCostInr: number;
    densityUsedGPerMl?: number | null;
    referenceType: string;
    referenceId: string;
    reason: string;
    performedByEmail: string;
    idempotencyKey?: string;
  }
) {
  if (params.idempotencyKey) {
    const dup = await tx
      .select()
      .from(erpStockMovements)
      .where(eq(erpStockMovements.idempotencyKey, params.idempotencyKey))
      .limit(1);
    if (dup.length) return dup[0];
  }

  const movementNumber = await getNextSequence(tx, 'MOV');
  const totalCostInr = round2(Math.abs(params.qtyDelta) * Number(params.unitCostInr || 0));

  const [mov] = await tx
    .insert(erpStockMovements)
    .values({
      id: makeId('mov'),
      organizationId: ORG_ID,
      movementNumber,
      movementDate: params.movementDate || currentIsoDate(),
      stockCategory: params.stockCategory,
      movementType: params.movementType,
      materialId: params.materialId || null,
      materialCode: params.materialCode || null,
      materialName: params.materialName,
      lotId: params.lotId || null,
      lotNumber: params.lotNumber || null,
      finishedGoodId: params.finishedGoodId || null,
      sku: params.sku || null,
      batchId: params.batchId || null,
      batchNumber: params.batchNumber || null,
      warehouseId: params.warehouseId || null,
      warehouseLocation: params.warehouseLocation || null,
      qtyDelta: round4(params.qtyDelta),
      uom: normalizeUom(params.uom),
      balanceBefore: round4(params.balanceBefore),
      balanceAfter: round4(params.balanceAfter),
      unitCostInr: round2(params.unitCostInr || 0),
      totalCostInr,
      densityUsedGPerMl: params.densityUsedGPerMl ?? null,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      reason: params.reason,
      performedByEmail: params.performedByEmail,
      idempotencyKey: params.idempotencyKey || null
    })
    .returning();

  return mov;
}

// ============================================================================
// CONFIDENTIALITY REDACTION FOR FORMULATIONS
// ============================================================================

export function canViewConfidentialFormula(actor: ErpActorContext, versionRow: any): boolean {
  if (!versionRow?.isConfidential) return true;
  if (actor.isSuperAdmin) return true;
  const allowed: string[] = Array.isArray(versionRow.authorizedRoleCodes)
    ? versionRow.authorizedRoleCodes
    : ['SUPER_ADMIN', 'FORMULATOR'];
  return allowed.includes(actor.roleCode);
}

export function sanitizeFormulationVersionsForActor(actor: ErpActorContext, versions: any[]) {
  return versions.map((v) => {
    if (canViewConfidentialFormula(actor, v)) {
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
}

// ============================================================================
// INVENTORY: MATERIAL MASTER (WITH DENSITY) & LEDGER-ONLY STOCK MOVEMENTS
// ============================================================================

export async function saveMaterialWithDensity(
  actor: ErpActorContext,
  payload: {
    id?: string;
    code?: string;
    name: string;
    category: string;
    stockType?: StockCategory;
    uom: string;
    densityGPerMl?: number | null;
    densityValidated?: boolean;
    retestIntervalDays?: number;
    hsnCode?: string;
    gstRatePct?: number;
    unitCostInr: number;
    openingStock?: number;
    reorderLevel: number;
    targetStock?: number;
    defaultWarehouseId?: string;
    warehouseLocation?: string;
    ifraMaxPct?: number;
    casNumber?: string;
    expectedVersion?: number;
  }
) {
  await ensureManufacturingSeeded();
  if (!payload.name?.trim()) throw new ValidationError('Material name is required.');
  const uom = normalizeUom(payload.uom);
  const unitCostInr = Number(payload.unitCostInr || 0);
  if (unitCostInr < 0) throw new ValidationError('Unit cost cannot be negative.');

  const stockType = payload.stockType || inferStockTypeFromCategory(payload.category);
  const isContinuousFluidOrMass = ['g', 'kg', 'ml', 'l'].includes(uom);
  const density = payload.densityGPerMl !== undefined && payload.densityGPerMl !== null && Number(payload.densityGPerMl) > 0
    ? Number(payload.densityGPerMl)
    : null;
  if (density !== null && (density < 0.4 || density > 3.5)) {
    throw new ValidationError('Material density (g/mL) must be between 0.40 and 3.50 g/mL.');
  }
  const densityValidated = Boolean(density !== null && (payload.densityValidated ?? true));

  return await db.transaction(async (tx) => {
    if (payload.id) {
      const existing = await tx.select().from(erpMaterials).where(eq(erpMaterials.id, payload.id));
      if (existing.length) {
        if (payload.expectedVersion !== undefined && existing[0].version !== payload.expectedVersion) {
          throw new ConflictError(`Material ${existing[0].code} was modified by another session.`);
        }
        // NOTE: Updating metadata NEVER overwrites currentStock directly! Stock changes must go via Stock Movement Ledger.
        const [updated] = await tx
          .update(erpMaterials)
          .set({
            name: payload.name.trim(),
            category: payload.category,
            stockType,
            uom,
            densityGPerMl: density,
            densityValidated,
            retestIntervalDays: payload.retestIntervalDays ?? existing[0].retestIntervalDays,
            hsnCode: payload.hsnCode || existing[0].hsnCode,
            gstRatePct: payload.gstRatePct ?? existing[0].gstRatePct,
            unitCostInr,
            reorderLevel: Number(payload.reorderLevel ?? existing[0].reorderLevel),
            targetStock: payload.targetStock ?? existing[0].targetStock,
            ifraMaxPct: payload.ifraMaxPct ?? existing[0].ifraMaxPct,
            casNumber: payload.casNumber ?? existing[0].casNumber,
            defaultWarehouseId: payload.defaultWarehouseId || existing[0].defaultWarehouseId,
            status: existing[0].currentStock <= 0 ? 'CRITICAL' : existing[0].currentStock <= Number(payload.reorderLevel ?? existing[0].reorderLevel) ? 'LOW_STOCK' : 'OPTIMAL',
            version: sql`${erpMaterials.version} + 1`,
            updatedAt: new Date()
          })
          .where(eq(erpMaterials.id, payload.id))
          .returning();

        await recordErpAuditLog(tx, {
          action: 'ERP_MATERIAL_METADATA_UPDATED',
          entity: 'erp_materials',
          entityId: updated.id,
          actorEmail: actor.email,
          actorRole: actor.roleCode,
          details: `Updated material ${updated.code} (${updated.name}), uom=${updated.uom}, density=${updated.densityGPerMl ?? 'N/A'} g/ml`
        });
        return updated;
      }
    }

    const openingStock = Number(payload.openingStock ?? 0);
    if (openingStock < 0) throw new ValidationError('Opening stock cannot be negative.');
    const code = payload.code?.trim().toUpperCase() || `MAT-${Date.now().toString(36).slice(-5).toUpperCase()}`;
    const matId = payload.id || makeId('mat');
    const whId = payload.defaultWarehouseId || (stockType === 'PACKAGING' ? 'wh-mumbai-pkg' : 'wh-mumbai-rm');
    const status = openingStock <= 0 ? 'CRITICAL' : openingStock <= payload.reorderLevel ? 'LOW_STOCK' : 'OPTIMAL';

    const [created] = await tx
      .insert(erpMaterials)
      .values({
        id: matId,
        organizationId: ORG_ID,
        defaultWarehouseId: whId,
        code,
        name: payload.name.trim(),
        category: payload.category || 'ESSENTIAL_OIL',
        stockType,
        uom,
        densityGPerMl: density,
        densityValidated,
        retestIntervalDays: payload.retestIntervalDays || (isContinuousFluidOrMass ? 365 : 1095),
        hsnCode: payload.hsnCode || '33029011',
        gstRatePct: payload.gstRatePct ?? 18,
        unitCostInr,
        currentStock: openingStock,
        reservedStock: 0,
        reorderLevel: Number(payload.reorderLevel || 50),
        targetStock: payload.targetStock || Math.max(Number(payload.reorderLevel || 50) * 3, openingStock),
        ifraMaxPct: payload.ifraMaxPct ?? null,
        casNumber: payload.casNumber || null,
        status,
        version: 1
      })
      .returning();

    if (openingStock > 0) {
      const lotNumber = await getNextSequence(tx, 'LOT');
      const [lot] = await tx
        .insert(erpStockLots)
        .values({
          id: makeId('lot'),
          organizationId: ORG_ID,
          materialId: created.id,
          warehouseId: whId,
          warehouseLocation: payload.warehouseLocation || 'BAY-A1',
          stockCategory: stockType,
          uom,
          lotNumber,
          supplierBatchRef: `OPEN-${code}`,
          receivedQty: openingStock,
          availableQty: openingStock,
          reservedQty: 0,
          consumedQty: 0,
          damagedQty: 0,
          unitCostInr,
          receivedDate: currentIsoDate(),
          retestDate: addDaysIso(created.retestIntervalDays || 365),
          expiryDate: addDaysIso(730),
          qcStatus: 'APPROVED',
          status: 'ACTIVE'
        })
        .returning();

      await appendStockMovementTx(tx, {
        stockCategory: stockType,
        movementType: 'OPENING',
        materialId: created.id,
        materialCode: created.code,
        materialName: created.name,
        lotId: lot.id,
        lotNumber: lot.lotNumber,
        warehouseId: whId,
        warehouseLocation: lot.warehouseLocation,
        qtyDelta: openingStock,
        uom,
        balanceBefore: 0,
        balanceAfter: openingStock,
        unitCostInr,
        densityUsedGPerMl: density,
        referenceType: 'MATERIAL',
        referenceId: created.id,
        reason: `Initial opening stock receipt for ${created.code}`,
        performedByEmail: actor.email
      });
    }

    await recordErpAuditLog(tx, {
      action: 'ERP_MATERIAL_CREATED',
      entity: 'erp_materials',
      entityId: created.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Created ${created.code} (${created.name}) | stockType=${stockType}, uom=${uom}, density=${density ?? 'none'}`
    });
    return created;
  });
}

/**
 * Ledger-only stock operation (Sample Issue, Damage Write-off, Stock Receipt/Adjustment, QC Quarantine/Release, Bin Transfer).
 * Directly modifying available qty is disallowed; all deltas must pass through this function.
 */
export async function postStockMovementTransaction(
  actor: ErpActorContext,
  payload: {
    lotId: string;
    movementType: 'SAMPLE_ISSUE' | 'DAMAGE_WRITEOFF' | 'RETURN' | 'ADJUSTMENT' | 'REWORK';
    qty: number; // Positive magnitude; ADJUSTMENT may pass signed qtyDelta via direction
    direction?: 'IN' | 'OUT';
    reason: string;
    targetWarehouseLocation?: string;
    qcStatus?: 'PENDING' | 'APPROVED' | 'QUARANTINED' | 'EXPIRED';
    idempotencyKey?: string;
  }
) {
  await ensureManufacturingSeeded();
  if (!payload.lotId) throw new ValidationError('lotId is required.');
  if (!payload.reason?.trim()) throw new ValidationError('Mandatory reason is required for every inventory ledger movement.');
  const rawQty = Number(payload.qty || 0);
  if (!Number.isFinite(rawQty) || rawQty <= 0) throw new ValidationError('Movement quantity must be greater than zero.');

  if (payload.idempotencyKey) {
    const dup = await db
      .select()
      .from(erpStockMovements)
      .where(eq(erpStockMovements.idempotencyKey, payload.idempotencyKey))
      .limit(1);
    if (dup.length) return { movement: dup[0], deduplicated: true };
  }

  return await db.transaction(async (tx) => {
    // Acquire deterministic row-level FOR UPDATE locks (erpStockLots -> erpMaterials) to serialize concurrent stock deductions
    const lots = await tx.select().from(erpStockLots).where(eq(erpStockLots.id, payload.lotId)).for('update');
    if (!lots.length) throw new NotFoundError('Stock lot not found.');
    const lot = lots[0];

    const mats = await tx.select().from(erpMaterials).where(eq(erpMaterials.id, lot.materialId)).for('update');
    if (!mats.length) throw new NotFoundError('Parent material not found.');
    const mat = mats[0];

    // Re-check idempotency inside locked transaction so simultaneous retries never double-deduct
    if (payload.idempotencyKey) {
      const dupInside = await tx
        .select()
        .from(erpStockMovements)
        .where(eq(erpStockMovements.idempotencyKey, payload.idempotencyKey))
        .limit(1);
      if (dupInside.length) return { movement: dupInside[0], deduplicated: true };
    }

    const isOut =
      payload.movementType === 'SAMPLE_ISSUE' ||
      payload.movementType === 'DAMAGE_WRITEOFF' ||
      (payload.movementType === 'ADJUSTMENT' && payload.direction !== 'IN');

    const delta = isOut ? -rawQty : rawQty;
    if (lot.availableQty + delta < -0.0001) {
      throw new ValidationError(
        `Insufficient available lot stock on ${lot.lotNumber}: available ${lot.availableQty} ${lot.uom}, requested out ${rawQty} ${lot.uom}.`
      );
    }

    const nextLotAvailable = round4(Math.max(0, lot.availableQty + delta));
    const nextLotDamaged =
      payload.movementType === 'DAMAGE_WRITEOFF' ? round4(Number(lot.damagedQty || 0) + rawQty) : Number(lot.damagedQty || 0);
    const nextLotStatus =
      payload.qcStatus === 'QUARANTINED'
        ? 'QUARANTINED'
        : nextLotAvailable <= 0 && lot.reservedQty <= 0
        ? 'DEPLETED'
        : 'ACTIVE';

    const nextMatStock = round4(Math.max(0, Number(mat.currentStock || 0) + delta));
    const nextMatStatus = nextMatStock <= 0 ? 'CRITICAL' : nextMatStock <= mat.reorderLevel ? 'LOW_STOCK' : 'OPTIMAL';

    await tx
      .update(erpStockLots)
      .set({
        availableQty: nextLotAvailable,
        damagedQty: nextLotDamaged,
        warehouseLocation: payload.targetWarehouseLocation || lot.warehouseLocation,
        qcStatus: payload.qcStatus || lot.qcStatus,
        status: nextLotStatus,
        version: sql`${erpStockLots.version} + 1`,
        updatedAt: new Date()
      })
      .where(eq(erpStockLots.id, lot.id));

    await tx
      .update(erpMaterials)
      .set({
        currentStock: nextMatStock,
        status: nextMatStatus,
        version: sql`${erpMaterials.version} + 1`,
        updatedAt: new Date()
      })
      .where(eq(erpMaterials.id, mat.id));

    const movementCategory: StockCategory =
      payload.movementType === 'DAMAGE_WRITEOFF'
        ? 'DAMAGED'
        : payload.movementType === 'SAMPLE_ISSUE'
        ? 'SAMPLE'
        : (lot.stockCategory as StockCategory) || (mat.stockType as StockCategory) || 'RAW_MATERIAL';

    const movement = await appendStockMovementTx(tx, {
      stockCategory: movementCategory,
      movementType: payload.movementType,
      materialId: mat.id,
      materialCode: mat.code,
      materialName: mat.name,
      lotId: lot.id,
      lotNumber: lot.lotNumber,
      warehouseId: lot.warehouseId,
      warehouseLocation: payload.targetWarehouseLocation || lot.warehouseLocation,
      qtyDelta: delta,
      uom: lot.uom || mat.uom,
      balanceBefore: lot.availableQty,
      balanceAfter: nextLotAvailable,
      unitCostInr: lot.unitCostInr,
      densityUsedGPerMl: mat.densityGPerMl ?? null,
      referenceType: 'MANUAL_LEDGER',
      referenceId: lot.id,
      reason: payload.reason.trim(),
      performedByEmail: actor.email,
      idempotencyKey: payload.idempotencyKey
    });

    // Post scrap/write-off accounting entry for DAMAGE_WRITEOFF
    if (payload.movementType === 'DAMAGE_WRITEOFF') {
      const scrapVal = round2(rawQty * Number(lot.unitCostInr || mat.unitCostInr || 0));
      if (scrapVal > 0) {
        const jrnNo = await getNextSequence(tx, 'JRN');
        await tx.insert(erpAccountingJournals).values({
          id: makeId('jrn'),
          organizationId: ORG_ID,
          journalNumber: jrnNo,
          entryDate: currentIsoDate(),
          fiscalPeriod: getFiscalPeriod(),
          sourceModule: 'PRODUCTION',
          sourceEntityId: movement.id,
          narration: `Inventory Damage / Scrap Write-Off ${movement.movementNumber}: ${mat.name} (${lot.lotNumber})`,
          lines: [
            { accountCode: '5210', accountName: 'Manufacturing Scrap & Material Spoilage', accountType: 'EXPENSE', debitInr: scrapVal, creditInr: 0, costCenter: 'CC-220' },
            { accountCode: '1200', accountName: 'Raw Materials & Packaging Inventory', accountType: 'ASSET', debitInr: 0, creditInr: scrapVal, costCenter: 'CC-220' }
          ],
          totalDebitInr: scrapVal,
          totalCreditInr: scrapVal,
          isBalanced: true,
          postedByEmail: actor.email,
          status: 'POSTED'
        });
      }
    }

    await recordErpAuditLog(tx, {
      action: `ERP_STOCK_${payload.movementType}`,
      entity: 'erp_stock_movements',
      entityId: movement.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `${movement.movementNumber}: ${lot.lotNumber} (${mat.name}) delta=${delta} ${lot.uom} | before=${lot.availableQty} after=${nextLotAvailable} | ${payload.reason}`
    });

    return { movement, updatedLotAvailable: nextLotAvailable, updatedMaterialStock: nextMatStock };
  });
}

// ============================================================================
// FORMULATION MANAGEMENT (CONCENTRATE/SOLVENT, MULTI-SIZE BOM, CONFIDENTIALITY)
// ============================================================================

export async function saveFormulationAdvanced(
  actor: ErpActorContext,
  payload: {
    formulationId?: string;
    name: string;
    fragranceFamily: string;
    productSlug?: string;
    concentrationType?: string;
    concentratePct?: number;
    solventPct?: number;
    macerationDays?: number;
    targetBatchSize?: number;
    targetBatchUnit?: 'kg' | 'l';
    expectedYieldPct?: number;
    supportedBottleSizes?: string[];
    packagingBom?: Record<string, Array<{ materialId: string; materialName: string; componentType: string; qtyPerBottle: number; unitCostInr: number }>>;
    isConfidential?: boolean;
    confidentialityLevel?: 'STANDARD' | 'RESTRICTED' | 'TOP_SECRET_MASTER';
    authorizedRoleCodes?: string[];
    changeSummary?: string;
    stabilityNotes?: string;
    submitForApproval?: boolean;
    ingredients: Array<{
      materialId?: string;
      materialCode?: string;
      materialName: string;
      notePyramid: 'TOP' | 'HEART' | 'BASE' | 'SOLVENT' | 'FIXATIVE';
      percentage: number;
      densityGPerMl?: number | null;
      costPerKgInr: number;
    }>;
  }
) {
  await ensureManufacturingSeeded();
  if (!payload.name?.trim()) throw new ValidationError('Formulation name is required.');
  if (!Array.isArray(payload.ingredients) || !payload.ingredients.length) {
    throw new ValidationError('At least one ingredient line is required.');
  }

  const totalPct = round2(payload.ingredients.reduce((s, i) => s + Number(i.percentage || 0), 0));
  if (Math.abs(totalPct - 100) > 0.05) {
    throw new ValidationError(`Formulation percentages must total exactly 100% (currently ${totalPct}%).`);
  }

  const solventSum = round2(
    payload.ingredients.filter((i) => i.notePyramid === 'SOLVENT').reduce((s, i) => s + Number(i.percentage || 0), 0)
  );
  const concentrateSum = round2(totalPct - solventSum);
  const concentratePct = payload.concentratePct !== undefined ? Number(payload.concentratePct) : concentrateSum;
  const solventPct = payload.solventPct !== undefined ? Number(payload.solventPct) : solventSum;

  const targetBatchSize = Number(payload.targetBatchSize || 10);
  if (targetBatchSize <= 0) throw new ValidationError('Target batch size must be positive.');
  const targetBatchUnit = payload.targetBatchUnit === 'l' ? 'l' : 'kg';
  const expectedYieldPct = Number(payload.expectedYieldPct || 98);
  const expectedYieldQty = round4(targetBatchSize * (expectedYieldPct / 100));

  const allMaterials = await db.select().from(erpMaterials);
  const enrichedIngredients = payload.ingredients.map((ing) => {
    const mat = ing.materialId ? allMaterials.find((m) => m.id === ing.materialId) : undefined;
    const dens = ing.densityGPerMl ?? mat?.densityGPerMl ?? null;
    return {
      ...ing,
      materialCode: ing.materialCode || mat?.code || 'CUSTOM',
      densityGPerMl: dens,
      quantityInTargetBatch: round4((Number(ing.percentage) / 100) * targetBatchSize),
      targetUnit: targetBatchUnit
    };
  });

  const avgDensity = computeFormulationWeightedDensity(enrichedIngredients, allMaterials) || 0.84;
  const costPerKg = round2(enrichedIngredients.reduce((s, i) => s + (Number(i.percentage) / 100) * Number(i.costPerKgInr || 0), 0));
  const supportedSizes = Array.isArray(payload.supportedBottleSizes) && payload.supportedBottleSizes.length
    ? Array.from(new Set(payload.supportedBottleSizes.map((s) => String(s).trim().toUpperCase())))
    : ['2ML', '10ML', '15ML', '30ML', '50ML'];

  const packagingBom = payload.packagingBom && Object.keys(payload.packagingBom).length
    ? payload.packagingBom
    : buildDefaultPackagingBom(allMaterials);

  const bottleSizeCosts = computeBottleSizeCosts({
    costPerKgInr: costPerKg,
    densityGPerMl: avgDensity,
    packagingBom,
    sizes: supportedSizes
  });
  const cost50ml =
    bottleSizeCosts.find((b) => b.sizeLabel === '50ML')?.totalEstimatedCostPerBottleInr ||
    round2(((50 * avgDensity) / 1000) * costPerKg);

  return await db.transaction(async (tx) => {
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
          concentrationType: payload.concentrationType || existing[0].concentrationType,
          targetOilPct: concentratePct,
          macerationDays: Number(payload.macerationDays || existing[0].macerationDays),
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
          productSlug: payload.productSlug || payload.name.trim().toLowerCase().replace(/\s+/g, '-'),
          concentrationType: payload.concentrationType || `Extrait de Parfum ${concentratePct}%`,
          targetOilPct: concentratePct,
          macerationDays: Number(payload.macerationDays || 21),
          perfumerEmail: actor.email,
          activeVersionNumber: 1,
          status: statusTarget
        })
        .returning();
      formulation = created;
    }

    const isConfidential = Boolean(payload.isConfidential || (payload.confidentialityLevel && payload.confidentialityLevel !== 'STANDARD'));
    const confidentialityLevel = payload.confidentialityLevel || (isConfidential ? 'RESTRICTED' : 'STANDARD');
    const authorizedRoleCodes =
      Array.isArray(payload.authorizedRoleCodes) && payload.authorizedRoleCodes.length
        ? payload.authorizedRoleCodes
        : ['SUPER_ADMIN', 'FORMULATOR'];

    const [versionRec] = await tx
      .insert(erpFormulationVersions)
      .values({
        id: makeId('fver'),
        formulationId: formulation.id,
        versionNumber: nextVer,
        changeSummary: payload.changeSummary || `Version ${nextVer} authored by ${actor.email}`,
        ingredients: enrichedIngredients,
        totalPercentage: totalPct,
        concentratePct,
        solventPct,
        targetBatchSize,
        targetBatchUnit,
        expectedYieldPct,
        expectedYieldQty,
        packagingBom,
        bottleSizeCosts,
        supportedBottleSizes: supportedSizes,
        isConfidential,
        confidentialityLevel,
        authorizedRoleCodes,
        costPerKgInr: costPerKg,
        estimatedCostPer50mlInr: cost50ml,
        ifraComplianceStatus: 'PENDING_EVIDENCE',
        safetyStatus: 'UNVERIFIED',
        stabilityNotes: payload.stabilityNotes || `Calculated weighted density: ${avgDensity} g/mL across ${supportedSizes.join(', ')}.`,
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
        summary: `Concentrate ${concentratePct}% / Solvent ${solventPct}% · Est. ₹${cost50ml}/50ml finished bottle.`,
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
      details: `Saved ${formulation.formulaCode} v${nextVer} (${confidentialityLevel}) — Est 50ml unit cost ₹${cost50ml}`
    });

    return { formulation, version: versionRec };
  });
}

// ============================================================================
// 11-STAGE BATCH PRODUCTION ENGINE (BOM + RESERVATION + WEIGHING + COSTING + RELEASE)
// ============================================================================

async function computeBatchRequirementsFromFormula(params: {
  formulation: any;
  version: any;
  plannedJuiceQty: number;
  plannedJuiceUnit: 'kg' | 'l';
  bottleSizeMl: number;
  plannedBottlesCount: number;
  allMaterials: any[];
  allLots: any[];
}) {
  const { version, plannedJuiceQty, plannedJuiceUnit, bottleSizeMl, plannedBottlesCount, allMaterials, allLots } = params;
  const ingredients: any[] = Array.isArray(version.ingredients) ? version.ingredients : [];

  const ingredientReqs = ingredients.map((ing) => {
    const mat = ing.materialId ? allMaterials.find((m) => m.id === ing.materialId) : null;
    const stockUom = mat ? normalizeUom(mat.uom) : normalizeUom(plannedJuiceUnit);
    const pct = Number(ing.percentage || 0);
    // Target share in plannedJuiceUnit (e.g. if batch is 10 l and ethanol is 72%, share = 7.2 l; or if batch is 10 kg, share = 7.2 kg)
    const rawShareQty = round4((pct / 100) * plannedJuiceQty);

    let requiredQtyInStockUom = rawShareQty;
    let densityUsedGPerMl: number | null = null;

    if (mat) {
      const conv = convertMaterialQty({
        qty: rawShareQty,
        fromUom: plannedJuiceUnit,
        toUom: stockUom,
        densityGPerMl: ing.densityGPerMl ?? mat.densityGPerMl,
        densityValidated: mat.densityGPerMl ? (mat.densityValidated ?? true) : false,
        materialName: mat.name
      });
      requiredQtyInStockUom = conv.convertedQty;
      densityUsedGPerMl = conv.densityUsedGPerMl;
    }

    const matchingLots = mat
      ? allLots.filter((l) => l.materialId === mat.id && l.qcStatus === 'APPROVED' && l.status === 'ACTIVE' && l.availableQty > 0)
      : [];
    const availableInStockUom = round4(matchingLots.reduce((s, l) => s + Number(l.availableQty || 0), 0));

    return {
      materialId: mat?.id || ing.materialId || null,
      materialCode: mat?.code || ing.materialCode || 'UNLINKED',
      materialName: mat?.name || ing.materialName,
      notePyramid: ing.notePyramid,
      percentage: pct,
      requiredQty: requiredQtyInStockUom,
      uom: stockUom,
      densityUsedGPerMl,
      availableQty: availableInStockUom,
      shortageQty: round4(Math.max(0, requiredQtyInStockUom - availableInStockUom)),
      unitCostInr: Number(mat?.unitCostInr || ing.costPerKgInr || 0)
    };
  });

  const sizeKey = `${Math.round(bottleSizeMl)}ML`;
  const pkgBomMap = (version.packagingBom as Record<string, any[]>) || buildDefaultPackagingBom(allMaterials);
  const sizeBom = pkgBomMap[sizeKey] || pkgBomMap['50ML'] || [];

  const packagingReqs = sizeBom.map((pkg: any) => {
    const mat = pkg.materialId ? allMaterials.find((m) => m.id === pkg.materialId) : null;
    const reqQty = Math.ceil(Number(pkg.qtyPerBottle || 1) * plannedBottlesCount);
    const matchingLots = mat
      ? allLots.filter((l) => l.materialId === mat.id && l.qcStatus === 'APPROVED' && l.status === 'ACTIVE' && l.availableQty > 0)
      : [];
    const availableQty = round4(matchingLots.reduce((s, l) => s + Number(l.availableQty || 0), 0));
    return {
      materialId: mat?.id || pkg.materialId,
      materialCode: mat?.code || 'PKG',
      materialName: mat?.name || pkg.materialName,
      componentType: pkg.componentType || 'PACKAGING',
      requiredQty: reqQty,
      uom: 'pcs' as CanonicalUom,
      availableQty,
      shortageQty: Math.max(0, reqQty - availableQty),
      unitCostInr: Number(mat?.unitCostInr || pkg.unitCostInr || 0)
    };
  });

  return {
    ingredientReqs,
    packagingReqs,
    allMaterialsAvailable:
      ingredientReqs.every((r) => r.shortageQty <= 0.0001) &&
      packagingReqs.every((r) => r.shortageQty <= 0.0001)
  };
}

export async function createBatchPlanTransaction(
  actor: ErpActorContext,
  payload: {
    formulationId: string;
    formulationVersionId?: string;
    sku: string;
    productId?: string;
    productName?: string;
    variantId?: string;
    bottleSizeMl: number;
    plannedBottlesCount: number;
    plannedJuiceQty?: number;
    plannedJuiceUnit?: 'kg' | 'l';
    labourCostInr?: number;
    overheadCostInr?: number;
    onceEditionId?: string;
    notes?: string;
  }
) {
  await ensureManufacturingSeeded();
  if (!payload.formulationId) throw new ValidationError('formulationId is required to initiate a batch.');
  const bottleSizeMl = Number(payload.bottleSizeMl || 50);
  const plannedBottlesCount = Math.round(Number(payload.plannedBottlesCount || 0));
  if (bottleSizeMl <= 0 || plannedBottlesCount <= 0) {
    throw new ValidationError('Bottle size (ml) and planned bottle count must be positive.');
  }

  return await db.transaction(async (tx) => {
    const fRows = await tx.select().from(erpFormulations).where(eq(erpFormulations.id, payload.formulationId));
    if (!fRows.length) throw new NotFoundError('Formulation not found.');
    const formula = fRows[0];

    const vRows = payload.formulationVersionId
      ? await tx.select().from(erpFormulationVersions).where(eq(erpFormulationVersions.id, payload.formulationVersionId))
      : await tx
          .select()
          .from(erpFormulationVersions)
          .where(and(eq(erpFormulationVersions.formulationId, formula.id), eq(erpFormulationVersions.versionNumber, formula.activeVersionNumber)));

    if (!vRows.length) throw new NotFoundError('Formulation version not found.');
    const ver = vRows[0];
    if (ver.status !== 'APPROVED') {
      throw new ValidationError(`Formulation version v${ver.versionNumber} is "${ver.status}". Only APPROVED formulations can enter Batch Production.`);
    }

    // If Once Edition ID is supplied directly, enforce strict single-campaign lock
    let onceEdition: any = null;
    if (payload.onceEditionId) {
      const edRows = await tx.select().from(erpOnceEditions).where(eq(erpOnceEditions.id, payload.onceEditionId));
      if (!edRows.length) throw new NotFoundError('Once Collection edition not found.');
      onceEdition = edRows[0];
      if (onceEdition.status === 'PERMANENTLY_CLOSED') {
        throw new ConflictError(`Once Edition ${onceEdition.editionCode} is PERMANENTLY CLOSED. Additional manufacturing is strictly prohibited.`);
      }
      if (onceEdition.campaignBatchId) {
        throw new ConflictError(`Once Edition ${onceEdition.editionCode} already has an authorized campaign (${onceEdition.campaignBatchNumber}).`);
      }
    }

    const allMaterials = await tx.select().from(erpMaterials);
    const allLots = await tx.select().from(erpStockLots);

    const plannedJuiceUnit: 'kg' | 'l' = payload.plannedJuiceUnit === 'kg' ? 'kg' : 'l';
    // Calculate bulk juice volume/mass needed for plannedBottlesCount * bottleSizeMl (+ 2% filling allowance if unspecified)
    let plannedJuiceQty = Number(payload.plannedJuiceQty || 0);
    if (plannedJuiceQty <= 0) {
      const totalMl = plannedBottlesCount * bottleSizeMl * 1.02;
      if (plannedJuiceUnit === 'l') {
        plannedJuiceQty = round4(totalMl / 1000);
      } else {
        const weightedDensity = computeFormulationWeightedDensity(ver.ingredients as any[], allMaterials);
        if (!weightedDensity) {
          throw new ValidationError('Validated material densities are required to compute target kg from bottle ml volume.');
        }
        plannedJuiceQty = round4((totalMl * weightedDensity) / 1000);
      }
    }

    const reqs = await computeBatchRequirementsFromFormula({
      formulation: formula,
      version: ver,
      plannedJuiceQty,
      plannedJuiceUnit,
      bottleSizeMl,
      plannedBottlesCount,
      allMaterials,
      allLots
    });

    const batchNumber = await getNextSequence(tx, 'BATCH');
    const batchId = makeId('batch');
    const sizeLabel = `${Math.round(bottleSizeMl)} ml`;

    // Resolve SKU & product cleanly if linked
    const allLedger = await tx.select().from(inventoryLedger);
    const matchedLedger = allLedger.find((l) => l.sku === payload.sku) || null;

    const lockedSnapshot = {
      formulaCode: formula.formulaCode,
      formulaName: formula.name,
      versionNumber: ver.versionNumber,
      concentratePct: ver.concentratePct,
      solventPct: ver.solventPct,
      ingredients: ver.ingredients,
      packagingBom: ver.packagingBom,
      isConfidential: ver.isConfidential,
      lockedAt: new Date().toISOString()
    };

    const estMaterialCost = round2(
      reqs.ingredientReqs.reduce((s, r) => s + r.requiredQty * r.unitCostInr, 0)
    );
    const estPkgCost = round2(
      reqs.packagingReqs.reduce((s, r) => s + r.requiredQty * r.unitCostInr, 0)
    );
    const labourCost = round2(Number(payload.labourCostInr ?? plannedBottlesCount * 28));
    const overheadCost = round2(Number(payload.overheadCostInr ?? plannedBottlesCount * 18));

    const [batch] = await tx
      .insert(productionBatches)
      .values({
        id: batchId,
        batchNumber,
        productId: payload.productId || matchedLedger?.productId || formula.productSlug || 'prod-atelier',
        productName: (payload.productName || matchedLedger?.productName || formula.name).toUpperCase(),
        variantId: payload.variantId || matchedLedger?.variantId || `${formula.formulaCode}-${Math.round(bottleSizeMl)}ml`,
        sku: payload.sku || matchedLedger?.sku || `FRG-${formula.formulaCode.slice(-3)}-${String(Math.round(bottleSizeMl)).padStart(3, '0')}`,
        size: sizeLabel,
        manufacturingDate: currentIsoDate(),
        expiryDate: addDaysIso(1095),
        finishedQuantity: plannedBottlesCount,
        qcStatus: 'PENDING_QC',
        bottleType: `${Math.round(bottleSizeMl)}ml Fragmoré Atelier Flacon (Locked BOM)`,
        packagingAvailability: reqs.allMaterialsAvailable ? 'AVAILABLE' : 'LOW_PACKAGING',
        batchReleaseStatus: 'UNRELEASED',
        releasedToInventory: false,
        notes: payload.notes || `Locked Formula ${formula.formulaCode} v${ver.versionNumber}`,
        createdBy: actor.email,
        formulationId: formula.id,
        formulationVersionId: ver.id,
        lockedFormulaVersionNumber: ver.versionNumber,
        lockedFormulaSnapshot: lockedSnapshot,
        pipelineStage: 'PLANNING',
        isOnceCollection: Boolean(onceEdition),
        onceEditionId: onceEdition?.id || null,
        bottleSizeMl,
        plannedJuiceQty,
        plannedJuiceUnit,
        actualJuiceQty: 0,
        plannedBottlesCount,
        actualFilledBottlesCount: 0,
        rejectedBottlesCount: 0,
        reworkBottlesCount: 0,
        materialRequirements: reqs,
        weighingRecords: [],
        packagingConsumptions: [],
        reworkRecords: [],
        wastageQty: 0,
        yieldVariancePct: 0,
        materialCostInr: estMaterialCost,
        packagingCostInr: estPkgCost,
        labourCostInr: labourCost,
        overheadCostInr: overheadCost,
        actualTotalCostInr: round2(estMaterialCost + estPkgCost + labourCost + overheadCost),
        costPerBottleInr: round2((estMaterialCost + estPkgCost + labourCost + overheadCost) / plannedBottlesCount)
      })
      .returning();

    await tx.insert(erpBatchEvents).values({
      id: makeId('bev'),
      organizationId: ORG_ID,
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      fromStage: null,
      toStage: 'PLANNING',
      eventType: 'STAGE_TRANSITION',
      summary: `Initiated ${batchNumber} locking ${formula.formulaCode} v${ver.versionNumber} (${plannedJuiceQty} ${plannedJuiceUnit} -> ${plannedBottlesCount} × ${sizeLabel})`,
      payload: { formulaCode: formula.formulaCode, versionNumber: ver.versionNumber, onceEditionId: onceEdition?.id || null },
      performedByEmail: actor.email
    });

    await recordErpAuditLog(tx, {
      action: 'ERP_BATCH_PLANNED',
      entity: 'production_batches',
      entityId: batch.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Planned batch ${batchNumber} for ${batch.productName} (${plannedBottlesCount} × ${sizeLabel}) with locked ${formula.formulaCode} v${ver.versionNumber}`
    });

    return { batch, requirements: reqs };
  });
}

export async function advanceBatchStageTransaction(
  actor: ErpActorContext,
  payload: {
    batchId: string;
    targetStage: BatchPipelineStage;
    weighingInputs?: Array<{ materialId: string; actualWeighedQty: number; verifiedByEmail?: string }>;
    actualJuiceQty?: number;
    wastageQty?: number;
    holdingTankLocation?: string;
    macerationStartDate?: string;
    macerationTargetDate?: string;
    actualFilledBottlesCount?: number;
    rejectedBottlesCount?: number;
    reworkBottlesCount?: number;
    labourCostInr?: number;
    overheadCostInr?: number;
    notes?: string;
  }
) {
  await ensureManufacturingSeeded();
  if (!payload.batchId || !payload.targetStage) throw new ValidationError('batchId and targetStage are required.');
  if (!BATCH_PIPELINE_STAGES.includes(payload.targetStage)) {
    throw new ValidationError(`Invalid pipeline stage "${payload.targetStage}".`);
  }

  return await db.transaction(async (tx) => {
    const bRows = await tx.select().from(productionBatches).where(eq(productionBatches.id, payload.batchId)).for('update');
    if (!bRows.length) throw new NotFoundError('Production batch not found.');
    const batch = bRows[0];

    const fromStage = (batch.pipelineStage || 'PLANNING') as BatchPipelineStage;
    const fromIdx = BATCH_PIPELINE_STAGES.indexOf(fromStage);
    const toIdx = BATCH_PIPELINE_STAGES.indexOf(payload.targetStage);

    if (fromStage === 'RELEASED') {
      throw new ConflictError(`Batch ${batch.batchNumber} is already RELEASED and immutable.`);
    }
    if (toIdx <= fromIdx) {
      throw new ValidationError(`Cannot move batch backwards or stay on stage (${fromStage} -> ${payload.targetStage}).`);
    }

    // Lock erpStockLots BEFORE erpMaterials (matching postStockMovementTransaction lock order) to prevent concurrent race conditions
    const allLots = await tx.select().from(erpStockLots).orderBy(erpStockLots.receivedDate, erpStockLots.id).for('update');
    const allMaterials = await tx.select().from(erpMaterials).orderBy(erpMaterials.id).for('update');
    let reqs = (batch.materialRequirements as any) || null;
    if (!reqs && batch.formulationId) {
      const vRows = await tx.select().from(erpFormulationVersions).where(eq(erpFormulationVersions.id, batch.formulationVersionId!));
      if (vRows.length) {
        reqs = await computeBatchRequirementsFromFormula({
          formulation: { formulaCode: batch.productName },
          version: vRows[0],
          plannedJuiceQty: batch.plannedJuiceQty || 5,
          plannedJuiceUnit: (batch.plannedJuiceUnit as 'kg' | 'l') || 'l',
          bottleSizeMl: batch.bottleSizeMl || 50,
          plannedBottlesCount: batch.plannedBottlesCount || batch.finishedQuantity,
          allMaterials,
          allLots
        });
      }
    }

    const updatePatch: any = {
      pipelineStage: payload.targetStage,
      updatedAt: new Date()
    };
    let eventSummary = `Stage advanced: ${fromStage} -> ${payload.targetStage}`;

    // STAGE 2: AVAILABILITY_CHECK
    if (payload.targetStage === 'AVAILABILITY_CHECK') {
      if (reqs) {
        for (const listKey of ['ingredientReqs', 'packagingReqs']) {
          reqs[listKey] = (reqs[listKey] || []).map((r: any) => {
            const avail = r.materialId
              ? round4(
                  allLots
                    .filter((l) => l.materialId === r.materialId && l.qcStatus === 'APPROVED' && l.status === 'ACTIVE' && l.availableQty > 0)
                    .reduce((s, l) => s + Number(l.availableQty || 0), 0)
                )
              : r.availableQty;
            return { ...r, availableQty: avail, shortageQty: round4(Math.max(0, Number(r.requiredQty) - avail)) };
          });
        }
        reqs.allMaterialsAvailable =
          (reqs.ingredientReqs || []).every((r: any) => r.shortageQty <= 0.0001) &&
          (reqs.packagingReqs || []).every((r: any) => r.shortageQty <= 0.0001);
        updatePatch.materialRequirements = reqs;
        updatePatch.packagingAvailability = reqs.allMaterialsAvailable ? 'AVAILABLE' : 'LOW_PACKAGING';
        eventSummary = reqs.allMaterialsAvailable
          ? 'Material availability verified: all raw concentrates, solvent & packaging lots available.'
          : 'Material availability check completed with shortages flagged.';
      }
    }

    // STAGE 3: RESERVED (FIFO Reserve Ingredients & Packaging Lots + Write Stock Movements)
    if (payload.targetStage === 'RESERVED') {
      if (!reqs) throw new ValidationError('Batch formula material requirements not initialized.');
      const allLines = [...(reqs.ingredientReqs || []), ...(reqs.packagingReqs || [])].filter((l) => l.materialId && l.requiredQty > 0);
      const reservedAllocations: any[] = [];

      for (const line of allLines) {
        let remaining = Number(line.requiredQty);
        const mat = allMaterials.find((m) => m.id === line.materialId);
        if (!mat) continue;

        const eligibleLots = allLots.filter(
          (l) => l.materialId === mat.id && l.qcStatus === 'APPROVED' && l.status === 'ACTIVE' && l.availableQty > 0
        );
        const totalAvail = eligibleLots.reduce((s, l) => s + Number(l.availableQty), 0);
        if (totalAvail + 0.0001 < remaining) {
          throw new ValidationError(
            `Insufficient FIFO stock for "${mat.name}": required ${remaining} ${line.uom}, available ${round4(totalAvail)} ${line.uom}.`
          );
        }

        for (const lot of eligibleLots) {
          if (remaining <= 0.0001) break;
          const take = round4(Math.min(remaining, Number(lot.availableQty)));
          const nextLotAvail = round4(lot.availableQty - take);
          const nextLotRes = round4(Number(lot.reservedQty || 0) + take);
          await tx
            .update(erpStockLots)
            .set({
              availableQty: nextLotAvail,
              reservedQty: nextLotRes,
              version: sql`${erpStockLots.version} + 1`,
              updatedAt: new Date()
            })
            .where(eq(erpStockLots.id, lot.id));

          await appendStockMovementTx(tx, {
            stockCategory: (lot.stockCategory as StockCategory) || (mat.stockType as StockCategory) || 'RAW_MATERIAL',
            movementType: 'RESERVATION',
            materialId: mat.id,
            materialCode: mat.code,
            materialName: mat.name,
            lotId: lot.id,
            lotNumber: lot.lotNumber,
            batchId: batch.id,
            batchNumber: batch.batchNumber,
            warehouseId: lot.warehouseId,
            warehouseLocation: lot.warehouseLocation,
            qtyDelta: -take,
            uom: lot.uom || mat.uom,
            balanceBefore: lot.availableQty,
            balanceAfter: nextLotAvail,
            unitCostInr: lot.unitCostInr,
            densityUsedGPerMl: line.densityUsedGPerMl ?? mat.densityGPerMl ?? null,
            referenceType: 'BATCH',
            referenceId: batch.id,
            reason: `Reserved FIFO lot ${lot.lotNumber} for Batch ${batch.batchNumber}`,
            performedByEmail: actor.email
          });

          reservedAllocations.push({
            materialId: mat.id,
            materialName: mat.name,
            lotId: lot.id,
            lotNumber: lot.lotNumber,
            reservedQty: take,
            uom: lot.uom || mat.uom,
            unitCostInr: lot.unitCostInr
          });
          remaining = round4(remaining - take);
        }

        await tx
          .update(erpMaterials)
          .set({
            reservedStock: round4(Number(mat.reservedStock || 0) + Number(line.requiredQty)),
            version: sql`${erpMaterials.version} + 1`,
            updatedAt: new Date()
          })
          .where(eq(erpMaterials.id, mat.id));
      }

      updatePatch.materialRequirements = { ...reqs, reservedAllocations };
      updatePatch.packagingAvailability = 'AVAILABLE';
      eventSummary = `Reserved ${reservedAllocations.length} FIFO lot allocation(s) for Batch ${batch.batchNumber}.`;
    }

    // STAGE 4: AUTHORIZED
    if (payload.targetStage === 'AUTHORIZED') {
      updatePatch.authorizedByEmail = actor.email;
      updatePatch.authorizedAt = new Date();
      eventSummary = `Batch manufacturing authorized by ${actor.email} (${actor.roleCode}).`;
    }

    // STAGE 5: MATERIAL_ISSUED (Weighing/Dispensing & Issue Ingredients to WIP + Accounting Journal)
    if (payload.targetStage === 'MATERIAL_ISSUED') {
      const reqIngredients: any[] = reqs?.ingredientReqs || [];
      const reservedAllocations: any[] = reqs?.reservedAllocations || [];
      const weighingRecords: any[] = [];
      let totalIssuedMatCost = 0;

      for (const ing of reqIngredients) {
        if (!ing.materialId) continue;
        const mat = allMaterials.find((m) => m.id === ing.materialId);
        if (!mat) continue;

        const input = payload.weighingInputs?.find((w) => w.materialId === ing.materialId);
        const targetQty = Number(ing.requiredQty || 0);
        const actualWeighed = input ? Number(input.actualWeighedQty) : targetQty;
        if (actualWeighed <= 0) {
          throw new ValidationError(`Actual weighed quantity for ${mat.name} must be positive.`);
        }

        // Consume from reserved lots first, then available if variance > reserved
        let remainingToIssue = actualWeighed;
        const matLots = allLots.filter((l) => l.materialId === mat.id && (l.reservedQty > 0 || l.availableQty > 0));
        let lastLotNumber = 'MULTI-LOT';
        let lastLotId: string | null = null;
        let issueCost = 0;

        for (const lot of matLots) {
          if (remainingToIssue <= 0.0001) break;
          const resAlloc = reservedAllocations.find((a) => a.lotId === lot.id);
          const canDrawFromRes = Math.min(Number(lot.reservedQty || 0), resAlloc ? Number(resAlloc.reservedQty) : Number(lot.reservedQty || 0));
          const drawRes = round4(Math.min(remainingToIssue, canDrawFromRes));
          const stillNeed = round4(remainingToIssue - drawRes);
          const drawAvail = round4(Math.min(stillNeed, Number(lot.availableQty || 0)));
          const totalDraw = round4(drawRes + drawAvail);
          if (totalDraw <= 0) continue;

          const nextRes = round4(Math.max(0, Number(lot.reservedQty || 0) - drawRes));
          const nextAvail = round4(Math.max(0, Number(lot.availableQty || 0) - drawAvail));
          const nextConsumed = round4(Number(lot.consumedQty || 0) + totalDraw);

          await tx
            .update(erpStockLots)
            .set({
              reservedQty: nextRes,
              availableQty: nextAvail,
              consumedQty: nextConsumed,
              status: nextAvail <= 0 && nextRes <= 0 ? 'DEPLETED' : 'ACTIVE',
              version: sql`${erpStockLots.version} + 1`,
              updatedAt: new Date()
            })
            .where(eq(erpStockLots.id, lot.id));

          await appendStockMovementTx(tx, {
            stockCategory: 'WIP',
            movementType: 'ISSUE_TO_BATCH',
            materialId: mat.id,
            materialCode: mat.code,
            materialName: mat.name,
            lotId: lot.id,
            lotNumber: lot.lotNumber,
            batchId: batch.id,
            batchNumber: batch.batchNumber,
            warehouseId: 'wh-atelier-wip',
            warehouseLocation: 'COMPOUNDING-BENCH-01',
            qtyDelta: -totalDraw,
            uom: lot.uom || mat.uom,
            balanceBefore: Number(lot.availableQty) + Number(lot.reservedQty),
            balanceAfter: nextAvail + nextRes,
            unitCostInr: lot.unitCostInr,
            densityUsedGPerMl: ing.densityUsedGPerMl ?? mat.densityGPerMl ?? null,
            referenceType: 'BATCH',
            referenceId: batch.id,
            reason: `Dispensed & weighed for ${batch.batchNumber} (Target ${targetQty}, Actual ${actualWeighed} ${ing.uom})`,
            performedByEmail: actor.email
          });

          issueCost += totalDraw * Number(lot.unitCostInr || mat.unitCostInr || 0);
          lastLotNumber = lot.lotNumber;
          lastLotId = lot.id;
          remainingToIssue = round4(remainingToIssue - totalDraw);
        }

        if (remainingToIssue > 0.01) {
          throw new ValidationError(`Insufficient stock while dispensing "${mat.name}": short by ${remainingToIssue} ${ing.uom}.`);
        }

        const nextMatStock = round4(Math.max(0, Number(mat.currentStock || 0) - actualWeighed));
        const nextMatRes = round4(Math.max(0, Number(mat.reservedStock || 0) - Math.min(targetQty, actualWeighed)));
        await tx
          .update(erpMaterials)
          .set({
            currentStock: nextMatStock,
            reservedStock: nextMatRes,
            status: nextMatStock <= 0 ? 'CRITICAL' : nextMatStock <= mat.reorderLevel ? 'LOW_STOCK' : 'OPTIMAL',
            version: sql`${erpMaterials.version} + 1`,
            updatedAt: new Date()
          })
          .where(eq(erpMaterials.id, mat.id));

        const varianceQty = round4(actualWeighed - targetQty);
        const variancePct = targetQty > 0 ? round2((varianceQty / targetQty) * 100) : 0;
        weighingRecords.push({
          materialId: mat.id,
          materialCode: mat.code,
          materialName: mat.name,
          lotId: lastLotId,
          lotNumber: lastLotNumber,
          plannedQty: targetQty,
          actualWeighedQty: actualWeighed,
          uom: ing.uom,
          varianceQty,
          variancePct,
          dispensedByEmail: actor.email,
          verifiedByEmail: input?.verifiedByEmail || actor.email,
          timestamp: new Date().toISOString()
        });

        totalIssuedMatCost = round2(totalIssuedMatCost + issueCost);
      }

      if (totalIssuedMatCost > 0) {
        const jrnNo = await getNextSequence(tx, 'JRN');
        await tx.insert(erpAccountingJournals).values({
          id: makeId('jrn'),
          organizationId: ORG_ID,
          journalNumber: jrnNo,
          entryDate: currentIsoDate(),
          fiscalPeriod: getFiscalPeriod(),
          sourceModule: 'PRODUCTION',
          sourceEntityId: batch.id,
          narration: `Raw Material Issue to WIP for Batch ${batch.batchNumber} (${batch.productName})`,
          lines: [
            { accountCode: '1210', accountName: 'Work-in-Progress (Maceration & Compounding)', accountType: 'ASSET', debitInr: totalIssuedMatCost, creditInr: 0, costCenter: 'CC-320' },
            { accountCode: '1200', accountName: 'Raw Materials & Packaging Inventory', accountType: 'ASSET', debitInr: 0, creditInr: totalIssuedMatCost, costCenter: 'CC-220' }
          ],
          totalDebitInr: totalIssuedMatCost,
          totalCreditInr: totalIssuedMatCost,
          isBalanced: true,
          postedByEmail: actor.email,
          status: 'POSTED'
        });
      }

      updatePatch.weighingRecords = weighingRecords;
      updatePatch.materialCostInr = totalIssuedMatCost || batch.materialCostInr;
      updatePatch.actualJuiceQty = round4(batch.plannedJuiceQty);
      eventSummary = `Weighed & dispensed ${weighingRecords.length} ingredient lots into WIP (₹${totalIssuedMatCost.toLocaleString('en-IN')}).`;
    }

    // STAGE 6: MIXING
    if (payload.targetStage === 'MIXING') {
      const actualJuice = payload.actualJuiceQty !== undefined ? Number(payload.actualJuiceQty) : Number(batch.actualJuiceQty || batch.plannedJuiceQty);
      const wastage = payload.wastageQty !== undefined ? Number(payload.wastageQty) : round4(Math.max(0, Number(batch.plannedJuiceQty) - actualJuice));
      updatePatch.actualJuiceQty = actualJuice;
      updatePatch.wastageQty = wastage;
      updatePatch.yieldVariancePct = batch.plannedJuiceQty > 0 ? round2(((actualJuice - batch.plannedJuiceQty) / batch.plannedJuiceQty) * 100) : 0;
      eventSummary = `Compounded ${actualJuice} ${batch.plannedJuiceUnit} bulk extrait (mixing loss ${wastage} ${batch.plannedJuiceUnit}).`;
    }

    // STAGE 7: MATURATION
    if (payload.targetStage === 'MATURATION') {
      updatePatch.holdingTankLocation = payload.holdingTankLocation || batch.holdingTankLocation || 'TANK-CHILL-04 (14°C)';
      updatePatch.macerationStartDate = payload.macerationStartDate || currentIsoDate();
      updatePatch.macerationTargetDate = payload.macerationTargetDate || addDaysIso(21);
      eventSummary = `Transferred to holding tank ${updatePatch.holdingTankLocation} for cold maceration.`;
    }

    // STAGE 8: QC
    if (payload.targetStage === 'QC') {
      eventSummary = `Submitted Batch ${batch.batchNumber} to Analytical Laboratory QC Gate.`;
    }

    // STAGE 9: FILLING (STRICT QC PASSED GATE!)
    if (payload.targetStage === 'FILLING') {
      if (batch.qcStatus !== 'PASSED') {
        throw new ValidationError(
          `QC Gate Blocked: Batch ${batch.batchNumber} has QC status "${batch.qcStatus}". Laboratory QC must be PASSED before Bottling/Filling.`
        );
      }
      const filled = Number(payload.actualFilledBottlesCount ?? batch.plannedBottlesCount ?? batch.finishedQuantity);
      const rejected = Number(payload.rejectedBottlesCount ?? batch.rejectedBottlesCount ?? 0);
      const rework = Number(payload.reworkBottlesCount ?? batch.reworkBottlesCount ?? 0);
      if (filled <= 0) throw new ValidationError('Filled bottle count must be positive.');

      if (batch.isOnceCollection && batch.onceEditionId) {
        const edRows = await tx.select().from(erpOnceEditions).where(eq(erpOnceEditions.id, batch.onceEditionId));
        if (edRows.length && filled > edRows[0].declaredQuantity) {
          throw new ConflictError(
            `THE ONCE COLLECTION INVARIANT: Cannot fill ${filled} bottles — edition ${edRows[0].editionCode} is strictly capped at ${edRows[0].declaredQuantity} bottles.`
          );
        }
        await tx
          .update(erpOnceSerialNumbers)
          .set({ status: 'FILLED', qcStatus: 'PASSED' })
          .where(eq(erpOnceSerialNumbers.batchId, batch.id));
      }

      const planned = Number(batch.plannedBottlesCount || batch.finishedQuantity || filled);
      updatePatch.actualFilledBottlesCount = filled;
      updatePatch.rejectedBottlesCount = rejected;
      updatePatch.reworkBottlesCount = rework;
      updatePatch.finishedQuantity = Math.max(0, filled - rejected);
      updatePatch.yieldVariancePct = planned > 0 ? round2(((filled - rejected - planned) / planned) * 100) : 0;
      eventSummary = `Filled ${filled} × ${batch.size} bottles (${rejected} rejected, ${rework} reworked; yield variance ${updatePatch.yieldVariancePct}%).`;
    }

    // STAGE 10: PACKING (Consume Packaging BOM Lots + Allocate Labour & Overhead -> Actual Costing)
    if (payload.targetStage === 'PACKING') {
      const netBottles = Math.max(1, Number(batch.finishedQuantity || batch.actualFilledBottlesCount || batch.plannedBottlesCount));
      const pkgReqs: any[] = reqs?.packagingReqs || [];
      const pkgConsumptions: any[] = [];
      let totalPkgCost = 0;

      for (const pkg of pkgReqs) {
        if (!pkg.materialId) continue;
        const mat = allMaterials.find((m) => m.id === pkg.materialId);
        if (!mat) continue;

        let remainingPkg = Math.max(netBottles, Number(pkg.requiredQty || netBottles));
        const matLots = allLots.filter((l) => l.materialId === mat.id && (l.reservedQty > 0 || l.availableQty > 0));
        let lotCostSum = 0;
        let lastLot = 'PKG-LOT';
        let lastLotId: string | null = null;

        for (const lot of matLots) {
          if (remainingPkg <= 0) break;
          const drawRes = Math.min(remainingPkg, Number(lot.reservedQty || 0));
          const stillNeed = remainingPkg - drawRes;
          const drawAvail = Math.min(stillNeed, Number(lot.availableQty || 0));
          const draw = drawRes + drawAvail;
          if (draw <= 0) continue;

          const nextRes = Math.max(0, Number(lot.reservedQty || 0) - drawRes);
          const nextAvail = Math.max(0, Number(lot.availableQty || 0) - drawAvail);
          await tx
            .update(erpStockLots)
            .set({
              reservedQty: nextRes,
              availableQty: nextAvail,
              consumedQty: Number(lot.consumedQty || 0) + draw,
              status: nextAvail <= 0 && nextRes <= 0 ? 'DEPLETED' : 'ACTIVE',
              version: sql`${erpStockLots.version} + 1`,
              updatedAt: new Date()
            })
            .where(eq(erpStockLots.id, lot.id));

          await appendStockMovementTx(tx, {
            stockCategory: 'PACKAGING',
            movementType: 'PACKING_CONSUMPTION',
            materialId: mat.id,
            materialCode: mat.code,
            materialName: mat.name,
            lotId: lot.id,
            lotNumber: lot.lotNumber,
            batchId: batch.id,
            batchNumber: batch.batchNumber,
            warehouseId: lot.warehouseId,
            warehouseLocation: lot.warehouseLocation,
            qtyDelta: -draw,
            uom: 'pcs',
            balanceBefore: Number(lot.availableQty) + Number(lot.reservedQty),
            balanceAfter: nextAvail + nextRes,
            unitCostInr: lot.unitCostInr,
            referenceType: 'BATCH',
            referenceId: batch.id,
            reason: `Packaging BOM consumed for ${batch.batchNumber} (${netBottles} bottles)`,
            performedByEmail: actor.email
          });

          lotCostSum += draw * Number(lot.unitCostInr || mat.unitCostInr || 0);
          lastLot = lot.lotNumber;
          lastLotId = lot.id;
          remainingPkg -= draw;
        }

        const nextMatStock = Math.max(0, Number(mat.currentStock || 0) - (Math.max(netBottles, Number(pkg.requiredQty || netBottles)) - remainingPkg));
        const nextMatRes = Math.max(0, Number(mat.reservedStock || 0) - Number(pkg.requiredQty || netBottles));
        await tx
          .update(erpMaterials)
          .set({
            currentStock: nextMatStock,
            reservedStock: nextMatRes,
            status: nextMatStock <= 0 ? 'CRITICAL' : nextMatStock <= mat.reorderLevel ? 'LOW_STOCK' : 'OPTIMAL',
            version: sql`${erpMaterials.version} + 1`,
            updatedAt: new Date()
          })
          .where(eq(erpMaterials.id, mat.id));

        const consumedQty = Math.max(netBottles, Number(pkg.requiredQty || netBottles)) - remainingPkg;
        pkgConsumptions.push({
          materialId: mat.id,
          materialName: mat.name,
          componentType: pkg.componentType,
          lotId: lastLotId,
          lotNumber: lastLot,
          plannedQty: pkg.requiredQty,
          actualQty: consumedQty,
          uom: 'pcs',
          unitCostInr: mat.unitCostInr,
          totalCostInr: round2(lotCostSum)
        });
        totalPkgCost = round2(totalPkgCost + lotCostSum);
      }

      const labourCost = payload.labourCostInr !== undefined ? round2(Number(payload.labourCostInr)) : Number(batch.labourCostInr || 0);
      const overheadCost = payload.overheadCostInr !== undefined ? round2(Number(payload.overheadCostInr)) : Number(batch.overheadCostInr || 0);
      const matCost = Number(batch.materialCostInr || 0);
      const pkgCost = totalPkgCost || Number(batch.packagingCostInr || 0);
      const totalBatchCost = round2(matCost + pkgCost + labourCost + overheadCost);
      const costPerBottle = round2(totalBatchCost / netBottles);

      if (batch.isOnceCollection) {
        await tx
          .update(erpOnceSerialNumbers)
          .set({ status: 'PACKED' })
          .where(eq(erpOnceSerialNumbers.batchId, batch.id));
      }

      updatePatch.packagingConsumptions = pkgConsumptions;
      updatePatch.packagingCostInr = pkgCost;
      updatePatch.labourCostInr = labourCost;
      updatePatch.overheadCostInr = overheadCost;
      updatePatch.actualTotalCostInr = totalBatchCost;
      updatePatch.costPerBottleInr = costPerBottle;
      eventSummary = `Packed ${netBottles} bottles consuming ${pkgConsumptions.length} packaging BOM lines. Actual batch cost ₹${totalBatchCost.toLocaleString('en-IN')} (₹${costPerBottle}/bottle).`;
    }

    // STAGE 11: RELEASED (Atomic Finished Goods Warehouse Release + Storefront Ledger Sync + Journal)
    if (payload.targetStage === 'RELEASED') {
      if (batch.qcStatus !== 'PASSED') {
        throw new ValidationError(`Batch Release blocked: QC status is ${batch.qcStatus} (must be PASSED).`);
      }
      const netGoodBottles = Math.max(1, Number(batch.finishedQuantity || batch.actualFilledBottlesCount || batch.plannedBottlesCount));
      const totalCost = Number(batch.actualTotalCostInr || (Number(batch.materialCostInr || 0) + Number(batch.packagingCostInr || 0) + Number(batch.labourCostInr || 0) + Number(batch.overheadCostInr || 0)));
      const costPerBottle = Number(batch.costPerBottleInr || round2(totalCost / netGoodBottles));

      // Upsert Finished Goods warehouse bin
      const fgRows = await tx.select().from(erpFinishedGoods).where(eq(erpFinishedGoods.sku, batch.sku));
      let fgId = fgRows[0]?.id;
      const fgBefore = fgRows[0]?.quantityOnHand || 0;
      const fgAfter = fgBefore + netGoodBottles;

      if (fgRows.length) {
        await tx
          .update(erpFinishedGoods)
          .set({
            quantityOnHand: fgAfter,
            quantityAvailable: Math.max(0, fgAfter - Number(fgRows[0].quantityReserved || 0)),
            batchId: batch.id,
            batchNumber: batch.batchNumber,
            unitManufacturingCostInr: costPerBottle > 0 ? costPerBottle : fgRows[0].unitManufacturingCostInr,
            status: 'ACTIVE',
            version: sql`${erpFinishedGoods.version} + 1`,
            updatedAt: new Date()
          })
          .where(eq(erpFinishedGoods.id, fgRows[0].id));
      } else {
        fgId = makeId('fg');
        await tx.insert(erpFinishedGoods).values({
          id: fgId,
          organizationId: ORG_ID,
          warehouseId: 'wh-fg-main',
          productId: batch.productId,
          sku: batch.sku,
          productName: batch.productName,
          size: batch.size,
          binLocation: 'FG-VAULT-A1',
          batchId: batch.id,
          batchNumber: batch.batchNumber,
          quantityOnHand: netGoodBottles,
          quantityReserved: 0,
          quantityAvailable: netGoodBottles,
          unitManufacturingCostInr: costPerBottle || 450,
          mrpInr: 3499,
          sellingPriceInr: 2999,
          status: 'ACTIVE'
        });
      }

      await appendStockMovementTx(tx, {
        stockCategory: 'FINISHED_GOODS',
        movementType: 'FG_RELEASE',
        materialName: `${batch.productName} (${batch.size})`,
        finishedGoodId: fgId,
        sku: batch.sku,
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        warehouseId: 'wh-fg-main',
        warehouseLocation: fgRows[0]?.binLocation || 'FG-VAULT-A1',
        qtyDelta: netGoodBottles,
        uom: 'pcs',
        balanceBefore: fgBefore,
        balanceAfter: fgAfter,
        unitCostInr: costPerBottle,
        referenceType: 'BATCH',
        referenceId: batch.id,
        reason: `Batch ${batch.batchNumber} approved & released to Finished Goods warehouse`,
        performedByEmail: actor.email
      });

      // Also sync storefront inventory_ledger & product variant if matching SKU exists
      const ledRows = await tx.select().from(inventoryLedger).where(eq(inventoryLedger.sku, batch.sku));
      if (ledRows.length) {
        const row = ledRows[0];
        const nextRec = Number(row.receivedStock) + netGoodBottles;
        const nextAvail = calculateLedgerAvailable({
          openingStock: row.openingStock,
          receivedStock: nextRec,
          reservedStock: row.reservedStock,
          soldStock: row.soldStock,
          returnedSellableStock: row.returnedSellableStock,
          damagedStock: row.damagedStock
        });
        const hist = Array.isArray(row.movementsHistory) ? [...(row.movementsHistory as any[])] : [];
        hist.unshift({
          id: `mov-batch-${Date.now()}`,
          timestamp: new Date().toISOString(),
          movementType: 'BATCH_RELEASE_RECEIVED',
          quantity: netGoodBottles,
          referenceId: batch.batchNumber,
          actor: actor.email,
          notes: `11-Stage Batch Release (${batch.batchNumber}, cost ₹${costPerBottle}/bottle)`,
          resultingAvailable: nextAvail,
          resultingReserved: row.reservedStock,
          resultingSold: row.soldStock
        });
        await tx
          .update(inventoryLedger)
          .set({
            receivedStock: nextRec,
            availableStock: nextAvail,
            procurementStatus: nextAvail > row.reorderThreshold ? 'NORMAL' : row.procurementStatus,
            movementsHistory: hist.slice(0, 100),
            updatedAt: new Date()
          })
          .where(eq(inventoryLedger.sku, batch.sku));
        await syncSkuToProductVariants(tx, batch.sku, nextAvail, row.reservedStock, nextAvail + Number(row.reservedStock));
      }

      // Post balanced Finished Goods capitalization accounting journal
      if (totalCost > 0) {
        const matCost = Number(batch.materialCostInr || 0);
        const pkgAndConversion = round2(Math.max(0, totalCost - matCost));
        const jrnNo = await getNextSequence(tx, 'JRN');
        const jLines: any[] = [
          { accountCode: '1220', accountName: 'Finished Goods Luxury Inventory', accountType: 'ASSET', debitInr: totalCost, creditInr: 0, costCenter: 'CC-320' }
        ];
        if (matCost > 0) {
          jLines.push({ accountCode: '1210', accountName: 'Work-in-Progress (Maceration & Compounding)', accountType: 'ASSET', debitInr: 0, creditInr: matCost, costCenter: 'CC-320' });
        }
        if (pkgAndConversion > 0) {
          jLines.push({ accountCode: '5200', accountName: 'Absorbed Packaging, Labour & Atelier Overhead', accountType: 'EXPENSE', debitInr: 0, creditInr: pkgAndConversion, costCenter: 'CC-320' });
        }
        await tx.insert(erpAccountingJournals).values({
          id: makeId('jrn'),
          organizationId: ORG_ID,
          journalNumber: jrnNo,
          entryDate: currentIsoDate(),
          fiscalPeriod: getFiscalPeriod(),
          sourceModule: 'PRODUCTION',
          sourceEntityId: batch.id,
          narration: `Finished Goods Release Batch ${batch.batchNumber} (${netGoodBottles} × ${batch.size} @ ₹${costPerBottle}/btl)`,
          lines: jLines,
          totalDebitInr: totalCost,
          totalCreditInr: round2(matCost + pkgAndConversion),
          isBalanced: true,
          postedByEmail: actor.email,
          status: 'POSTED'
        });
      }

      if (batch.isOnceCollection && batch.onceEditionId) {
        await tx
          .update(erpOnceSerialNumbers)
          .set({ status: 'RELEASED' })
          .where(eq(erpOnceSerialNumbers.batchId, batch.id));
        await tx
          .update(erpOnceEditions)
          .set({ producedQuantity: netGoodBottles, updatedAt: new Date() })
          .where(eq(erpOnceEditions.id, batch.onceEditionId));
      }

      updatePatch.batchReleaseStatus = 'RELEASED';
      updatePatch.releasedToInventory = true;
      updatePatch.releasedAt = new Date();
      updatePatch.releasedByEmail = actor.email;
      eventSummary = `Released ${netGoodBottles} × ${batch.size} finished bottles to sellable inventory (@ ₹${costPerBottle}/bottle).`;
    }

    if (payload.notes) {
      updatePatch.notes = payload.notes;
    }

    const [updatedBatch] = await tx
      .update(productionBatches)
      .set(updatePatch)
      .where(eq(productionBatches.id, batch.id))
      .returning();

    await tx.insert(erpBatchEvents).values({
      id: makeId('bev'),
      organizationId: ORG_ID,
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      fromStage,
      toStage: payload.targetStage,
      eventType: payload.targetStage === 'RELEASED' ? 'RELEASE' : 'STAGE_TRANSITION',
      summary: eventSummary,
      payload: { targetStage: payload.targetStage },
      performedByEmail: actor.email
    });

    await recordErpAuditLog(tx, {
      action: `ERP_BATCH_STAGE_${payload.targetStage}`,
      entity: 'production_batches',
      entityId: batch.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `${batch.batchNumber}: ${fromStage} -> ${payload.targetStage} | ${eventSummary}`
    });

    return { batch: updatedBatch, eventSummary };
  });
}

export async function recordBatchReworkOrScrapTransaction(
  actor: ErpActorContext,
  payload: {
    batchId: string;
    stage: string;
    reason: string;
    rejectedQty: number;
    reworkQty: number;
    disposition: 'REWORK_RECOVERED' | 'DESTROYED_SCRAP';
  }
) {
  await ensureManufacturingSeeded();
  if (!payload.reason?.trim()) throw new ValidationError('Rework/rejection reason is required.');

  return await db.transaction(async (tx) => {
    const rows = await tx.select().from(productionBatches).where(eq(productionBatches.id, payload.batchId));
    if (!rows.length) throw new NotFoundError('Production batch not found.');
    const batch = rows[0];
    if (batch.releasedToInventory) {
      throw new ConflictError('Cannot log manufacturing rework after batch is released to Finished Goods.');
    }

    const rejected = Math.max(0, Math.round(Number(payload.rejectedQty || 0)));
    const rework = Math.max(0, Math.round(Number(payload.reworkQty || 0)));
    const existingLog: any[] = Array.isArray(batch.reworkRecords) ? [...(batch.reworkRecords as any[])] : [];
    const entry = {
      id: makeId('rwk'),
      stage: payload.stage || batch.pipelineStage,
      reason: payload.reason.trim(),
      rejectedQty: rejected,
      reworkQty: rework,
      disposition: payload.disposition || 'REWORK_RECOVERED',
      recordedByEmail: actor.email,
      timestamp: new Date().toISOString()
    };
    existingLog.unshift(entry);

    const nextRejected = Number(batch.rejectedBottlesCount || 0) + (payload.disposition === 'DESTROYED_SCRAP' ? rejected : 0);
    const nextRework = Number(batch.reworkBottlesCount || 0) + rework;
    const netGood = Math.max(1, Number(batch.actualFilledBottlesCount || batch.finishedQuantity) - nextRejected);
    const nextCostPerBottle = round2(Number(batch.actualTotalCostInr || 0) / netGood);

    const [updated] = await tx
      .update(productionBatches)
      .set({
        rejectedBottlesCount: nextRejected,
        reworkBottlesCount: nextRework,
        finishedQuantity: netGood,
        costPerBottleInr: nextCostPerBottle > 0 ? nextCostPerBottle : batch.costPerBottleInr,
        reworkRecords: existingLog,
        updatedAt: new Date()
      })
      .where(eq(productionBatches.id, batch.id))
      .returning();

    await appendStockMovementTx(tx, {
      stockCategory: payload.disposition === 'DESTROYED_SCRAP' ? 'DAMAGED' : 'WIP',
      movementType: payload.disposition === 'DESTROYED_SCRAP' ? 'DAMAGE_WRITEOFF' : 'REWORK',
      materialName: `${batch.productName} (${batch.size})`,
      sku: batch.sku,
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      warehouseId: 'wh-quarantine',
      warehouseLocation: 'QC-REWORK-BAY',
      qtyDelta: -(rejected || rework),
      uom: 'pcs',
      balanceBefore: Number(batch.finishedQuantity),
      balanceAfter: netGood,
      unitCostInr: nextCostPerBottle,
      referenceType: 'BATCH',
      referenceId: batch.id,
      reason: `${payload.disposition}: ${payload.reason}`,
      performedByEmail: actor.email
    });

    await tx.insert(erpBatchEvents).values({
      id: makeId('bev'),
      organizationId: ORG_ID,
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      fromStage: batch.pipelineStage,
      toStage: batch.pipelineStage,
      eventType: 'REWORK',
      summary: `Rework/Rejection logged (${payload.disposition}): ${rejected} rejected, ${rework} reworked — ${payload.reason}`,
      payload: entry,
      performedByEmail: actor.email
    });

    return { batch: updated, entry };
  });
}

// ============================================================================
// THE ONCE COLLECTION (100–1,000 NUMBERED BOTTLES, SINGLE CAMPAIGN, PERMANENT CLOSURE)
// ============================================================================

export async function createOnceEditionTransaction(
  actor: ErpActorContext,
  payload: {
    editionName: string;
    fragranceName: string;
    formulationId: string;
    formulationVersionId?: string;
    sku?: string;
    bottleSizeMl: number;
    declaredQuantity: number;
    notes?: string;
  }
) {
  await ensureManufacturingSeeded();
  if (!payload.editionName?.trim()) throw new ValidationError('Edition name is required.');
  const qty = Math.round(Number(payload.declaredQuantity || 0));
  if (qty < 100 || qty > 1000) {
    throw new ValidationError(
      `The Once Collection requires a strict limited edition quantity between 100 and 1,000 numbered bottles (received ${qty}).`
    );
  }

  return await db.transaction(async (tx) => {
    const fRows = await tx.select().from(erpFormulations).where(eq(erpFormulations.id, payload.formulationId));
    if (!fRows.length) throw new NotFoundError('Referenced formulation not found.');
    const formula = fRows[0];

    const vRows = payload.formulationVersionId
      ? await tx.select().from(erpFormulationVersions).where(eq(erpFormulationVersions.id, payload.formulationVersionId))
      : await tx
          .select()
          .from(erpFormulationVersions)
          .where(and(eq(erpFormulationVersions.formulationId, formula.id), eq(erpFormulationVersions.versionNumber, formula.activeVersionNumber)));

    if (!vRows.length) throw new NotFoundError('Formulation version not found.');
    const ver = vRows[0];
    if (ver.status !== 'APPROVED') {
      throw new ValidationError('Only APPROVED formulation versions may be locked into The Once Collection.');
    }

    const editionCode = await getNextSequence(tx, 'ONCE');
    const [edition] = await tx
      .insert(erpOnceEditions)
      .values({
        id: makeId('once'),
        organizationId: ORG_ID,
        editionCode,
        editionName: payload.editionName.trim().toUpperCase(),
        fragranceName: (payload.fragranceName || formula.name).trim().toUpperCase(),
        formulationId: formula.id,
        lockedFormulationVersionId: ver.id,
        lockedFormulationVersionNumber: ver.versionNumber,
        sku: payload.sku || `ONCE-${editionCode.slice(-3)}-${Math.round(payload.bottleSizeMl || 50)}`,
        bottleSizeMl: Number(payload.bottleSizeMl || 50),
        declaredQuantity: qty,
        producedQuantity: 0,
        status: 'PLANNED',
        authorizedByEmail: actor.email,
        notes: payload.notes || `Single-run locked edition (${qty} numbered bottles).`
      })
      .returning();

    await recordErpAuditLog(tx, {
      action: 'ERP_ONCE_EDITION_CREATED',
      entity: 'erp_once_editions',
      entityId: edition.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Created Once Edition ${editionCode} (${edition.editionName}): locked formula ${formula.formulaCode} v${ver.versionNumber}, cap=${qty} bottles.`
    });

    return edition;
  });
}

export async function launchOnceCampaignBatchTransaction(
  actor: ErpActorContext,
  editionId: string,
  payload?: { labourCostInr?: number; overheadCostInr?: number; notes?: string }
) {
  await ensureManufacturingSeeded();
  const edRows = await db.select().from(erpOnceEditions).where(eq(erpOnceEditions.id, editionId));
  if (!edRows.length) throw new NotFoundError('Once Collection edition not found.');
  const edition = edRows[0];

  if (edition.status === 'PERMANENTLY_CLOSED') {
    throw new ConflictError(
      `THE ONCE COLLECTION LOCK: Edition ${edition.editionCode} (${edition.editionName}) is PERMANENTLY CLOSED. Additional production is forbidden.`
    );
  }
  if (edition.campaignBatchId) {
    throw new ConflictError(
      `THE ONCE COLLECTION LOCK: Edition ${edition.editionCode} already launched its single authorized campaign (${edition.campaignBatchNumber}). Second batches are prohibited.`
    );
  }

  // Create batch with locked formula version & declaredQuantity
  const { batch, requirements } = await createBatchPlanTransaction(actor, {
    formulationId: edition.formulationId,
    formulationVersionId: edition.lockedFormulationVersionId,
    sku: edition.sku || `ONCE-${edition.editionCode.slice(-3)}`,
    productName: `${edition.editionName} [ONCE]`,
    bottleSizeMl: edition.bottleSizeMl,
    plannedBottlesCount: edition.declaredQuantity,
    labourCostInr: payload?.labourCostInr,
    overheadCostInr: payload?.overheadCostInr,
    onceEditionId: edition.id,
    notes: payload?.notes || `Once Collection Official Single Campaign — ${edition.declaredQuantity} Numbered Flacons`
  });

  // Mint all unique numbered bottle serials (001/N .. N/N) in one transaction
  const slug = edition.editionCode.replace(/[^A-Z0-9]/gi, '').slice(-4);
  const serialRows = Array.from({ length: edition.declaredQuantity }, (_, i) => {
    const idx = i + 1;
    return {
      id: makeId('ser'),
      organizationId: ORG_ID,
      editionId: edition.id,
      batchId: batch.id,
      serialNumber: `ONCE-${slug}-${String(idx).padStart(4, '0')}/${edition.declaredQuantity}`,
      editionIndex: idx,
      bottleSizeMl: edition.bottleSizeMl,
      qcStatus: 'PENDING',
      status: 'GENERATED'
    };
  });

  await db.transaction(async (tx) => {
    for (let i = 0; i < serialRows.length; i += 250) {
      await tx.insert(erpOnceSerialNumbers).values(serialRows.slice(i, i + 250));
    }
    await tx
      .update(erpOnceEditions)
      .set({
        campaignBatchId: batch.id,
        campaignBatchNumber: batch.batchNumber,
        status: 'CAMPAIGN_ACTIVE',
        updatedAt: new Date()
      })
      .where(eq(erpOnceEditions.id, edition.id));

    await recordErpAuditLog(tx, {
      action: 'ERP_ONCE_CAMPAIGN_LAUNCHED',
      entity: 'erp_once_editions',
      entityId: edition.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Launched single campaign ${batch.batchNumber} for ${edition.editionCode}; minted ${serialRows.length} unique serial numbers.`
    });
  });

  return {
    edition: { ...edition, campaignBatchId: batch.id, campaignBatchNumber: batch.batchNumber, status: 'CAMPAIGN_ACTIVE' },
    batch,
    requirements,
    serialsMinted: serialRows.length
  };
}

export async function permanentlyCloseOnceEditionTransaction(
  actor: ErpActorContext,
  editionId: string,
  notes?: string
) {
  await ensureManufacturingSeeded();
  return await db.transaction(async (tx) => {
    const edRows = await tx.select().from(erpOnceEditions).where(eq(erpOnceEditions.id, editionId));
    if (!edRows.length) throw new NotFoundError('Once Collection edition not found.');
    const edition = edRows[0];

    if (edition.status === 'PERMANENTLY_CLOSED') {
      throw new ConflictError(`Edition ${edition.editionCode} is already permanently closed.`);
    }

    const closedAt = new Date();
    const certHash = crypto
      .createHash('sha256')
      .update(
        `${edition.id}|${edition.editionCode}|${edition.lockedFormulationVersionId}|${edition.campaignBatchId || 'NONE'}|${edition.declaredQuantity}|${closedAt.toISOString()}`
      )
      .digest('hex')
      .slice(0, 24)
      .toUpperCase();

    const [closed] = await tx
      .update(erpOnceEditions)
      .set({
        status: 'PERMANENTLY_CLOSED',
        closedAt,
        closedByEmail: actor.email,
        closureCertificateHash: `FRAGMORE-ONCE-${certHash}`,
        notes: notes ? `${edition.notes || ''}\n[CLOSURE SEAL]: ${notes}` : edition.notes,
        version: sql`${erpOnceEditions.version} + 1`,
        updatedAt: closedAt
      })
      .where(eq(erpOnceEditions.id, edition.id))
      .returning();

    if (edition.campaignBatchId) {
      await tx.insert(erpBatchEvents).values({
        id: makeId('bev'),
        organizationId: ORG_ID,
        batchId: edition.campaignBatchId,
        batchNumber: edition.campaignBatchNumber || edition.editionCode,
        fromStage: 'RELEASED',
        toStage: 'RELEASED',
        eventType: 'ONCE_CLOSURE',
        summary: `PERMANENT PRODUCTION CLOSURE SEALED by ${actor.email}. Certificate: FRAGMORE-ONCE-${certHash}. Future runs strictly blocked.`,
        payload: { closureCertificateHash: `FRAGMORE-ONCE-${certHash}` },
        performedByEmail: actor.email
      });
    }

    await createErpNotification(tx, {
      departmentCode: 'PROD',
      severity: 'INFO',
      category: 'ONCE_COLLECTION_CLOSED',
      title: `The Once Collection Sealed: ${edition.editionCode}`,
      message: `${edition.editionName} (${edition.declaredQuantity} bottles) permanently closed by ${actor.email}. Re-production disabled.`,
      linkModule: 'batches',
      linkEntityId: edition.id
    });

    await recordErpAuditLog(tx, {
      action: 'ERP_ONCE_EDITION_PERMANENTLY_CLOSED',
      entity: 'erp_once_editions',
      entityId: edition.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Permanently sealed ${edition.editionCode} (${edition.editionName}); cert FRAGMORE-ONCE-${certHash}.`
    });

    return closed;
  });
}

// ============================================================================
// FULL BATCH TRACEABILITY & WORKSPACE SNAPSHOT
// ============================================================================

export async function getBatchTraceabilityReport(batchId: string) {
  await ensureManufacturingSeeded();
  const [batch] = await db.select().from(productionBatches).where(eq(productionBatches.id, batchId));
  if (!batch) throw new NotFoundError('Production batch not found.');

  const [events, movements, qcList, serials, fgs, allOrders] = await Promise.all([
    db.select().from(erpBatchEvents).where(eq(erpBatchEvents.batchId, batch.id)).orderBy(erpBatchEvents.createdAt),
    db.select().from(erpStockMovements).where(eq(erpStockMovements.batchId, batch.id)).orderBy(erpStockMovements.createdAt),
    db.select().from(erpQcRecords).where(eq(erpQcRecords.batchId, batch.id)),
    db.select().from(erpOnceSerialNumbers).where(eq(erpOnceSerialNumbers.batchId, batch.id)).orderBy(erpOnceSerialNumbers.editionIndex),
    db.select().from(erpFinishedGoods).where(eq(erpFinishedGoods.sku, batch.sku)),
    db.select().from(orders).orderBy(desc(orders.createdAt))
  ]);

  const lotIds = Array.from(new Set(movements.map((m) => m.lotId).filter(Boolean) as string[]));
  const lots = lotIds.length ? await db.select().from(erpStockLots).where(inArray(erpStockLots.id, lotIds)) : [];
  const grnIds = Array.from(new Set(lots.map((l) => l.grnId).filter(Boolean) as string[]));
  const grns = grnIds.length ? await db.select().from(erpGoodsReceipts).where(inArray(erpGoodsReceipts.id, grnIds)) : [];

  const linkedOrders = allOrders
    .filter((o) => (Array.isArray(o.items) ? o.items : []).some((it: any) => it.sku === batch.sku))
    .slice(0, 15)
    .map((o) => ({
      orderNumber: o.orderNumber,
      customerName: o.customerName,
      orderStatus: o.orderStatus,
      totalAmount: o.totalAmount,
      createdAt: o.createdAt
    }));

  return {
    batch,
    events,
    movements,
    sourceLots: lots,
    sourceGrns: grns,
    qcRecords: qcList,
    finishedGoodsBins: fgs,
    onceSerialsCount: serials.length,
    onceSerialsSample: serials.slice(0, 50),
    linkedOrders
  };
}

export async function getManufacturingWorkspaceSnapshot(actor: ErpActorContext) {
  await ensureManufacturingSeeded();

  const [
    materials,
    lots,
    movements,
    warehouses,
    formulations,
    rawFormulationVersions,
    batches,
    batchEvents,
    qcRecords,
    finishedGoods,
    onceEditions,
    onceSerials
  ] = await Promise.all([
    db.select().from(erpMaterials).orderBy(erpMaterials.code),
    db.select().from(erpStockLots).orderBy(desc(erpStockLots.createdAt)),
    db.select().from(erpStockMovements).orderBy(desc(erpStockMovements.createdAt)),
    db.select().from(erpWarehouses),
    db.select().from(erpFormulations).orderBy(erpFormulations.formulaCode),
    db.select().from(erpFormulationVersions).orderBy(desc(erpFormulationVersions.versionNumber)),
    db.select().from(productionBatches).orderBy(desc(productionBatches.createdAt)),
    db.select().from(erpBatchEvents).orderBy(desc(erpBatchEvents.createdAt)),
    db.select().from(erpQcRecords).orderBy(desc(erpQcRecords.createdAt)),
    db.select().from(erpFinishedGoods).orderBy(erpFinishedGoods.sku),
    db.select().from(erpOnceEditions).orderBy(desc(erpOnceEditions.createdAt)),
    db.select().from(erpOnceSerialNumbers).orderBy(erpOnceSerialNumbers.editionIndex)
  ]);

  const formulationVersions = sanitizeFormulationVersionsForActor(actor, rawFormulationVersions);

  // Stock bucket breakdown
  const valuationByCategory: Record<StockCategory, number> = {
    RAW_MATERIAL: 0,
    FRAGRANCE_OIL: 0,
    PACKAGING: 0,
    WIP: 0,
    FINISHED_GOODS: 0,
    SAMPLE: 0,
    DAMAGED: 0
  };
  for (const lot of lots) {
    const cat = (lot.stockCategory as StockCategory) || 'RAW_MATERIAL';
    if (valuationByCategory[cat] !== undefined) {
      valuationByCategory[cat] = round2(valuationByCategory[cat] + Number(lot.availableQty || 0) * Number(lot.unitCostInr || 0));
    }
  }
  for (const fg of finishedGoods) {
    valuationByCategory.FINISHED_GOODS = round2(
      valuationByCategory.FINISHED_GOODS + Number(fg.quantityOnHand || 0) * Number(fg.unitManufacturingCostInr || 0)
    );
  }
  for (const b of batches) {
    if (!b.releasedToInventory && ['MATERIAL_ISSUED', 'MIXING', 'MATURATION', 'QC', 'FILLING', 'PACKING'].includes(b.pipelineStage || '')) {
      valuationByCategory.WIP = round2(valuationByCategory.WIP + Number(b.materialCostInr || 0));
    }
  }

  return {
    actor,
    materials,
    lots,
    movements: movements.slice(0, 400),
    warehouses,
    formulations,
    formulationVersions,
    batches,
    batchEvents: batchEvents.slice(0, 300),
    qcRecords,
    finishedGoods,
    onceEditions,
    onceSerialsCountByEdition: onceEditions.reduce((acc, ed) => {
      acc[ed.id] = onceSerials.filter((s) => s.editionId === ed.id).length;
      return acc;
    }, {} as Record<string, number>),
    onceSerialsPreview: onceSerials.slice(0, 200),
    kpis: {
      totalMaterials: materials.length,
      totalActiveLots: lots.filter((l) => l.status === 'ACTIVE').length,
      totalMovements: movements.length,
      lowStockCount: materials.filter((m) => m.currentStock <= m.reorderLevel).length,
      missingDensityFluidsCount: materials.filter(
        (m) => ['g', 'kg', 'ml', 'l'].includes(normalizeUom(m.uom)) && (!m.densityGPerMl || !m.densityValidated)
      ).length,
      activeBatchesCount: batches.filter((b) => !b.releasedToInventory).length,
      releasedBatchesCount: batches.filter((b) => b.releasedToInventory).length,
      onceEditionsCount: onceEditions.length,
      onceClosedCount: onceEditions.filter((o) => o.status === 'PERMANENTLY_CLOSED').length,
      valuationByCategory
    }
  };
}
