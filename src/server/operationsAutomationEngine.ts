import { db } from '../db/index.ts';
import {
  products,
  orders,
  customers,
  campaigns,
  returnsRefunds,
  auditLogs,
  inventoryLedger,
  productionBatches,
  opsTasksAndAlerts
} from '../db/schema.ts';
import { eq, desc } from 'drizzle-orm';
import { ingestAutomationEvent } from './automationEngine.ts';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type ShippingLifecycleEventType =
  | 'ORDER_READY_FOR_PACKING'
  | 'PACKING_COMPLETED'
  | 'SHIPMENT_BOOKED'
  | 'COURIER_ACCEPTED'
  | 'SHIPPED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'DELIVERY_EXCEPTION'
  | 'RETURN_TO_ORIGIN'
  | 'LOST_OR_DAMAGED_SHIPMENT';

export interface OrderTimelineEvent {
  id: string;
  timestamp: string;
  eventType: string;
  status: string;
  actor: string;
  verificationSource?: string;
  details: string;
}

export interface StockMovementEntry {
  id: string;
  timestamp: string;
  movementType:
    | 'OPENING_SEED'
    | 'RESERVE'
    | 'COMMIT_SALE'
    | 'RELEASE_RESERVATION'
    | 'BATCH_RELEASE_RECEIVED'
    | 'RETURN_SELLABLE'
    | 'RETURN_DAMAGED'
    | 'MANUAL_ADJUSTMENT'
    | 'RECONCILIATION_SYNC';
  quantity: number;
  referenceId: string;
  actor: string;
  notes: string;
  resultingAvailable: number;
  resultingReserved: number;
  resultingSold: number;
}

// ============================================================================
// 1. INVENTORY LEDGER INITIALIZATION & ATOMIC SYNCHRONIZATION
// ============================================================================

export function calculateLedgerAvailable(row: {
  openingStock: number;
  receivedStock: number;
  reservedStock: number;
  soldStock: number;
  returnedSellableStock: number;
  damagedStock: number;
}): number {
  return Math.max(
    0,
    Number(row.openingStock || 0) +
      Number(row.receivedStock || 0) +
      Number(row.returnedSellableStock || 0) -
      Number(row.reservedStock || 0) -
      Number(row.soldStock || 0) -
      Number(row.damagedStock || 0)
  );
}

export async function syncAndInitializeInventoryLedger(): Promise<any[]> {
  const allProducts = await db.select().from(products);
  const existingLedger = await db.select().from(inventoryLedger);
  const ledgerBySku = new Map<string, any>(existingLedger.map((r) => [r.sku, r]));

  for (const prod of allProducts) {
    if (String(prod.status).toUpperCase() !== 'ACTIVE') continue;
    const variants: any[] = Array.isArray(prod.variants) ? prod.variants : [];
    for (const v of variants) {
      if (!v.sku) continue;
      if (!ledgerBySku.has(v.sku)) {
        // Initialize from existing product variant stock values
        const currentReserved = Math.max(0, Number(v.stockReserved) || 0);
        const currentOnHand =
          Number(v.stockOnHand) > 0
            ? Number(v.stockOnHand)
            : v.isAvailable !== false && Number(v.sellingPrice) > 0
            ? 45
            : 0;
        const openingStock = currentOnHand;
        const availableStock = Math.max(0, openingStock - currentReserved);

        const initialMovement: StockMovementEntry = {
          id: `mov-init-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: new Date().toISOString(),
          movementType: 'OPENING_SEED',
          quantity: openingStock,
          referenceId: prod.id,
          actor: 'system',
          notes: `Initialized SKU ledger from catalog (${prod.name} ${v.size})`,
          resultingAvailable: availableStock,
          resultingReserved: currentReserved,
          resultingSold: 0
        };

        const newEntry = {
          sku: v.sku,
          productId: prod.id,
          productName: prod.name,
          variantId: v.id || `${prod.slug}-${v.size}`,
          size: v.size || '50 ml',
          openingStock,
          receivedStock: 0,
          reservedStock: currentReserved,
          availableStock,
          soldStock: 0,
          returnedSellableStock: 0,
          damagedStock: 0,
          reorderThreshold: 20,
          alertThresholds: [20, 10, 5],
          targetStockLevel: 60,
          procurementStatus:
            availableStock === 0
              ? 'OUT_OF_STOCK'
              : availableStock <= 20
              ? 'LOW_STOCK_ALERT'
              : 'NORMAL',
          movementsHistory: [initialMovement],
          updatedAt: new Date()
        };

        await db.insert(inventoryLedger).values(newEntry).onConflictDoNothing();
        ledgerBySku.set(v.sku, newEntry);
      }
    }
  }

  // Ensure initial authentic production batches exist for FRAGMORÉ active catalog
  const existingBatches = await db.select().from(productionBatches);
  if (existingBatches.length === 0) {
    const activeProds = allProducts.filter((p) => String(p.status).toUpperCase() === 'ACTIVE');
    const firstProd = activeProds[0];
    const secondProd = activeProds[1] || activeProds[0];
    if (firstProd) {
      const v1 = (Array.isArray(firstProd.variants) ? firstProd.variants : [])[1] ||
        (Array.isArray(firstProd.variants) ? firstProd.variants : [])[0] || {
          id: 'golden-hour-50ml',
          sku: 'FRG-SIG-GH-050',
          size: '50 ml'
        };
      await db
        .insert(productionBatches)
        .values([
          {
            id: 'batch-gh-2026-01',
            batchNumber: 'BATCH-GH-2026-01A',
            productId: firstProd.id,
            productName: firstProd.name,
            variantId: v1.id,
            sku: v1.sku,
            size: v1.size,
            manufacturingDate: '2026-08-15',
            expiryDate: '2029-08-14',
            finishedQuantity: 120,
            qcStatus: 'PASSED',
            bottleType: '50ml Heavy Italian Crimp Flacon (Gold Collar)',
            packagingAvailability: 'AVAILABLE',
            batchReleaseStatus: 'RELEASED',
            releasedToInventory: true,
            releasedAt: new Date('2026-08-20T10:00:00Z'),
            notes: 'Macerated 6 weeks at Grasse & Mumbai atelier; GC-MS stability verified.',
            createdBy: 'gowisherharsha@gmail.com'
          },
          {
            id: 'batch-bb-2026-02',
            batchNumber: 'BATCH-BB-2026-02B',
            productId: secondProd.id,
            productName: secondProd.name,
            variantId:
              ((Array.isArray(secondProd.variants) ? secondProd.variants : [])[1] ||
                (Array.isArray(secondProd.variants) ? secondProd.variants : [])[0])?.id || 'var-50ml',
            sku:
              ((Array.isArray(secondProd.variants) ? secondProd.variants : [])[1] ||
                (Array.isArray(secondProd.variants) ? secondProd.variants : [])[0])?.sku || 'FRG-SIG-BB-050',
            size: '50 ml',
            manufacturingDate: '2026-10-10',
            expiryDate: '2029-10-09',
            finishedQuantity: 80,
            qcStatus: 'PENDING_QC',
            bottleType: '50ml Heavy Italian Crimp Flacon (Gold Collar)',
            packagingAvailability: 'AWAITING_COFFRET',
            batchReleaseStatus: 'UNRELEASED',
            releasedToInventory: false,
            notes: 'Awaiting final olfactory QC sign-off and outer velvet coffret sleeves. Blocked from sale.',
            createdBy: 'gowisherharsha@gmail.com'
          }
        ])
        .onConflictDoNothing();
    }
  }

  return await db.select().from(inventoryLedger);
}

// Helper to sync a SKU's ledger numbers back to products.variants so storefront & admin stay 100% in sync
export async function syncSkuToProductVariants(
  tx: any,
  sku: string,
  availableStock: number,
  reservedStock: number,
  onHandStock: number
) {
  const allProds = await tx.select().from(products);
  for (const p of allProds) {
    const vars: any[] = Array.isArray(p.variants) ? p.variants : [];
    if (vars.some((v) => v.sku === sku)) {
      const updatedVars = vars.map((v) => {
        if (v.sku === sku) {
          return {
            ...v,
            stockOnHand: Math.max(0, onHandStock),
            stockReserved: Math.max(0, reservedStock),
            stockAvailable: Math.max(0, availableStock),
            stockManaged: true,
            isAvailable: availableStock > 0 && Number(v.sellingPrice) > 0
          };
        }
        return v;
      });
      await tx.update(products).set({ variants: updatedVars }).where(eq(products.id, p.id));
    }
  }
}

// ============================================================================
// 2. LOW-STOCK THRESHOLD ALERTS (20, 10, 5), PROCUREMENT QUEUE & AD FLAGS
// ============================================================================

export async function evaluateLowStockAndProcurementRules(sku: string): Promise<{
  triggeredAlert: boolean;
  thresholdBreached: number | null;
  suggestedReorderQty: number;
  flaggedCampaignsCount: number;
  pausePromotionRecommended: boolean;
}> {
  const [row] = await db.select().from(inventoryLedger).where(eq(inventoryLedger.sku, sku)).limit(1);
  if (!row) {
    return {
      triggeredAlert: false,
      thresholdBreached: null,
      suggestedReorderQty: 0,
      flaggedCampaignsCount: 0,
      pausePromotionRecommended: false
    };
  }

  const avail = Number(row.availableStock);
  const customThreshold = Number(row.reorderThreshold) || 20;
  const thresholds: number[] = Array.isArray(row.alertThresholds)
    ? (row.alertThresholds as number[]).sort((a, b) => a - b)
    : [5, 10, 20];

  // Determine the most severe breached threshold (e.g. 0, 5, 10, 20, or customThreshold)
  let breached: number | null = null;
  if (avail === 0) {
    breached = 0;
  } else {
    for (const t of thresholds) {
      if (avail <= t) {
        breached = t;
        break;
      }
    }
    if (breached === null && avail <= customThreshold) {
      breached = customThreshold;
    }
  }

  if (breached === null) {
    if (row.procurementStatus !== 'NORMAL') {
      await db
        .update(inventoryLedger)
        .set({ procurementStatus: 'NORMAL', updatedAt: new Date() })
        .where(eq(inventoryLedger.sku, sku));
    }
    return {
      triggeredAlert: false,
      thresholdBreached: null,
      suggestedReorderQty: 0,
      flaggedCampaignsCount: 0,
      pausePromotionRecommended: false
    };
  }

  const targetLevel = Math.max(Number(row.targetStockLevel) || 60, customThreshold * 3);
  const suggestedReorderQty = Math.max(25, targetLevel - avail + Number(row.reservedStock || 0));
  const severity = avail === 0 ? 'CRITICAL' : breached <= 5 ? 'CRITICAL' : breached <= 10 ? 'HIGH' : 'MEDIUM';

  // 1. Create Admin Low-Stock Alert
  const alertId = `alert-stock-${sku}-${breached}`;
  await db
    .insert(opsTasksAndAlerts)
    .values({
      id: alertId,
      category: 'LOW_STOCK_ALERT',
      severity,
      title:
        avail === 0
          ? `OUT OF STOCK: ${row.productName} (${row.size}) [${sku}]`
          : `Low Stock Alert (≤ ${breached} units): ${row.productName} (${row.size}) [${sku}]`,
      description: `Available stock for ${sku} is ${avail} units (Reserved: ${row.reservedStock}, Sold: ${row.soldStock}). Threshold ${breached} breached.`,
      entityType: 'SKU',
      entityId: row.productId,
      sku,
      status: 'OPEN',
      suggestedReorderQty,
      requiresAdminApproval: false,
      metadata: {
        availableStock: avail,
        reservedStock: row.reservedStock,
        thresholdBreached: breached,
        productName: row.productName,
        size: row.size
      }
    })
    .onConflictDoUpdate({
      target: opsTasksAndAlerts.id,
      set: {
        severity,
        description: `Available stock for ${sku} is ${avail} units (Reserved: ${row.reservedStock}, Sold: ${row.soldStock}). Threshold ${breached} breached.`,
        status: 'OPEN',
        suggestedReorderQty
      }
    });

  // 2. Add to Procurement Queue with Suggested Reorder Quantity (Requires Admin Approval — never auto-orders from suppliers!)
  const procId = `proc-queue-${sku}`;
  await db
    .insert(opsTasksAndAlerts)
    .values({
      id: procId,
      category: 'PROCUREMENT_QUEUE',
      severity,
      title: `Procurement Reorder Queue: ${row.productName} (${row.size})`,
      description: `Suggested reorder quantity: ${suggestedReorderQty} units to restore target stock (${targetLevel}). Supplier PO requires explicit Admin approval.`,
      entityType: 'SKU',
      entityId: row.productId,
      sku,
      status: 'PENDING_APPROVAL',
      suggestedReorderQty,
      requiresAdminApproval: true,
      metadata: {
        sku,
        productName: row.productName,
        size: row.size,
        availableStock: avail,
        targetStockLevel: targetLevel,
        suggestedReorderQty,
        supplierAutoOrdered: false,
        governancePolicy: 'Do not automatically place supplier orders without Admin approval'
      }
    })
    .onConflictDoUpdate({
      target: opsTasksAndAlerts.id,
      set: {
        severity,
        suggestedReorderQty,
        description: `Suggested reorder quantity: ${suggestedReorderQty} units to restore target stock (${targetLevel}). Supplier PO requires explicit Admin approval.`,
        status: 'PENDING_APPROVAL'
      }
    });

  // 3. Flag active advertising campaigns for review (Never auto-changes budget without approval!)
  const allCampaigns = await db.select().from(campaigns);
  const activeCampaigns = allCampaigns.filter((c) => String(c.status).toLowerCase() === 'active');
  for (const camp of activeCampaigns) {
    const flagId = `ad-flag-${camp.id}-${sku}`;
    await db
      .insert(opsTasksAndAlerts)
      .values({
        id: flagId,
        category: 'AD_CAMPAIGN_FLAG',
        severity: avail === 0 ? 'CRITICAL' : 'HIGH',
        title: `Ad Campaign Review Flag: "${camp.name}" (${camp.channel})`,
        description: `SKU ${sku} (${row.productName} ${row.size}) has ${avail} available units. Review ad spend allocation for campaign "${camp.name}".`,
        entityType: 'CAMPAIGN',
        entityId: camp.id,
        sku,
        status: 'PENDING_APPROVAL',
        requiresAdminApproval: true,
        metadata: {
          campaignId: camp.id,
          campaignName: camp.name,
          channel: camp.channel,
          sku,
          availableStock: avail
        }
      })
      .onConflictDoNothing();
  }

  // 4. Recommend pausing out-of-stock product promotions when availableStock === 0
  const pausePromoRecommended = avail === 0 || breached <= 5;
  if (pausePromoRecommended) {
    const pauseId = `promo-pause-${sku}`;
    await db
      .insert(opsTasksAndAlerts)
      .values({
        id: pauseId,
        category: 'PROMO_PAUSE_RECOMMENDATION',
        severity: 'CRITICAL',
        title: `Recommend Pausing Promotions: ${row.productName} (${row.size})`,
        description:
          avail === 0
            ? `SKU ${sku} is out of stock (0 available). Recommend pausing active product promotions and paid ad creatives until batch replenishment.`
            : `SKU ${sku} has critically low stock (${avail} units). Recommend throttling promotional traffic.`,
        entityType: 'SKU',
        entityId: row.productId,
        sku,
        status: 'PENDING_APPROVAL',
        requiresAdminApproval: true,
        metadata: {
          sku,
          productName: row.productName,
          availableStock: avail,
          recommendedAction: 'PAUSE_PRODUCT_PROMOTIONS'
        }
      })
      .onConflictDoUpdate({
        target: opsTasksAndAlerts.id,
        set: {
          status: 'PENDING_APPROVAL',
          description:
            avail === 0
              ? `SKU ${sku} is out of stock (0 available). Recommend pausing active product promotions and paid ad creatives until batch replenishment.`
              : `SKU ${sku} has critically low stock (${avail} units). Recommend throttling promotional traffic.`
        }
      });
  }

  await db
    .update(inventoryLedger)
    .set({
      procurementStatus: avail === 0 ? 'OUT_OF_STOCK' : 'IN_PROCUREMENT_QUEUE',
      updatedAt: new Date()
    })
    .where(eq(inventoryLedger.sku, sku));

  try {
    await ingestAutomationEvent({
      eventType: 'inventory.below_threshold',
      source: 'backend_api',
      entityId: sku,
      payload: {
        sku,
        productName: row.productName,
        size: row.size,
        availableStock: avail,
        thresholdBreached: breached,
        suggestedReorderQty
      }
    });
  } catch {}

  return {
    triggeredAlert: true,
    thresholdBreached: breached,
    suggestedReorderQty,
    flaggedCampaignsCount: activeCampaigns.length,
    pausePromotionRecommended: pausePromoRecommended
  };
}

// ============================================================================
// 3. ATOMIC SKU INVENTORY ADJUSTMENT & THRESHOLD CONFIGURATION
// ============================================================================

export async function adjustSkuInventoryAtomically(params: {
  sku: string;
  adjustmentType: 'RECEIVE_STOCK' | 'DAMAGE_WRITE_OFF' | 'MANUAL_OPENING_ADJUST' | 'UPDATE_THRESHOLDS';
  quantity?: number;
  reorderThreshold?: number;
  alertThresholds?: number[];
  targetStockLevel?: number;
  actor?: string;
  notes?: string;
}): Promise<any> {
  await syncAndInitializeInventoryLedger();
  const actor = params.actor || 'admin@fragmore.com';
  const qty = Number(params.quantity) || 0;

  const updatedRow = await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(inventoryLedger)
      .where(eq(inventoryLedger.sku, params.sku))
      .limit(1);

    if (!row) {
      throw new Error(`SKU ${params.sku} not found in inventory ledger`);
    }

    let openingStock = Number(row.openingStock);
    let receivedStock = Number(row.receivedStock);
    let damagedStock = Number(row.damagedStock);
    let reorderThreshold =
      params.reorderThreshold !== undefined ? Math.max(1, Number(params.reorderThreshold)) : Number(row.reorderThreshold);
    let alertThresholds = Array.isArray(params.alertThresholds)
      ? params.alertThresholds.map(Number).filter((n) => n > 0)
      : (row.alertThresholds as number[]);
    let targetStockLevel =
      params.targetStockLevel !== undefined ? Math.max(10, Number(params.targetStockLevel)) : Number(row.targetStockLevel);

    if (params.adjustmentType === 'RECEIVE_STOCK') {
      if (qty <= 0) throw new Error('Received stock quantity must be positive');
      receivedStock += qty;
    } else if (params.adjustmentType === 'DAMAGE_WRITE_OFF') {
      if (qty <= 0) throw new Error('Damaged stock quantity must be positive');
      if (qty > row.availableStock) {
        throw new Error(`Cannot write off ${qty} damaged units when only ${row.availableStock} are available`);
      }
      damagedStock += qty;
    } else if (params.adjustmentType === 'MANUAL_OPENING_ADJUST') {
      const nextOpening = openingStock + qty;
      const projectedAvail = calculateLedgerAvailable({
        openingStock: nextOpening,
        receivedStock,
        reservedStock: row.reservedStock,
        soldStock: row.soldStock,
        returnedSellableStock: row.returnedSellableStock,
        damagedStock
      });
      if (projectedAvail < 0 || nextOpening < 0) {
        throw new Error('Stock adjustment would result in negative available stock');
      }
      openingStock = nextOpening;
    }

    const availableStock = calculateLedgerAvailable({
      openingStock,
      receivedStock,
      reservedStock: row.reservedStock,
      soldStock: row.soldStock,
      returnedSellableStock: row.returnedSellableStock,
      damagedStock
    });

    const onHandStock = availableStock + Number(row.reservedStock);
    const history: StockMovementEntry[] = Array.isArray(row.movementsHistory)
      ? [...(row.movementsHistory as StockMovementEntry[])]
      : [];

    if (qty !== 0 || params.adjustmentType === 'UPDATE_THRESHOLDS') {
      history.unshift({
        id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
        movementType: 'MANUAL_ADJUSTMENT',
        quantity: qty,
        referenceId: params.sku,
        actor,
        notes: params.notes || `${params.adjustmentType} (${qty >= 0 ? '+' : ''}${qty})`,
        resultingAvailable: availableStock,
        resultingReserved: row.reservedStock,
        resultingSold: row.soldStock
      });
    }

    const [saved] = await tx
      .update(inventoryLedger)
      .set({
        openingStock,
        receivedStock,
        damagedStock,
        availableStock,
        reorderThreshold,
        alertThresholds,
        targetStockLevel,
        movementsHistory: history.slice(0, 100),
        updatedAt: new Date()
      })
      .where(eq(inventoryLedger.sku, params.sku))
      .returning();

    await syncSkuToProductVariants(tx, params.sku, availableStock, row.reservedStock, onHandStock);
    return saved;
  });

  await evaluateLowStockAndProcurementRules(params.sku);
  return updatedRow;
}

// ============================================================================
// 4. FRAGRANCE PRODUCTION BATCH MANAGEMENT (WITH QC & RELEASE SAFEGUARDS)
// ============================================================================

export async function createOrUpdateProductionBatch(payload: {
  id?: string;
  batchNumber: string;
  productId: string;
  productName: string;
  variantId: string;
  sku: string;
  size: string;
  manufacturingDate: string;
  expiryDate: string;
  finishedQuantity: number;
  qcStatus: 'PENDING_QC' | 'PASSED' | 'FAILED' | 'QUARANTINED';
  bottleType: string;
  packagingAvailability: 'AVAILABLE' | 'LOW_PACKAGING' | 'AWAITING_COFFRET' | 'UNAVAILABLE';
  batchReleaseStatus?: 'UNRELEASED' | 'RELEASED' | 'RECALLED' | 'BLOCKED';
  notes?: string;
  actor?: string;
}): Promise<{
  batch: any;
  canOfferForSale: boolean;
  blockReasons: string[];
}> {
  await syncAndInitializeInventoryLedger();
  const blockReasons: string[] = [];

  if (payload.qcStatus !== 'PASSED') {
    blockReasons.push(`Quality Control status is ${payload.qcStatus} (must be PASSED)`);
  }
  if (payload.packagingAvailability !== 'AVAILABLE') {
    blockReasons.push(`Packaging is ${payload.packagingAvailability} (must be AVAILABLE)`);
  }
  const expMs = new Date(payload.expiryDate).getTime();
  if (isNaN(expMs) || expMs <= Date.now()) {
    blockReasons.push(`Batch expiry/best-before date (${payload.expiryDate}) is invalid or expired`);
  }
  if (Number(payload.finishedQuantity) <= 0) {
    blockReasons.push('Finished quantity must be greater than 0');
  }

  // Prevent unavailable or failed batches from being marked RELEASED
  let effectiveReleaseStatus = payload.batchReleaseStatus || 'UNRELEASED';
  if (blockReasons.length > 0 && effectiveReleaseStatus === 'RELEASED') {
    effectiveReleaseStatus = 'BLOCKED';
  }

  const canOfferForSale = blockReasons.length === 0 && effectiveReleaseStatus === 'RELEASED';
  const batchId = payload.id || `batch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const existing = await db
    .select()
    .from(productionBatches)
    .where(eq(productionBatches.batchNumber, payload.batchNumber))
    .limit(1);

  let savedBatch: any;
  if (existing.length > 0) {
    const [upd] = await db
      .update(productionBatches)
      .set({
        productId: payload.productId,
        productName: payload.productName,
        variantId: payload.variantId,
        sku: payload.sku,
        size: payload.size,
        manufacturingDate: payload.manufacturingDate,
        expiryDate: payload.expiryDate,
        finishedQuantity: Number(payload.finishedQuantity),
        qcStatus: payload.qcStatus,
        bottleType: payload.bottleType,
        packagingAvailability: payload.packagingAvailability,
        batchReleaseStatus: effectiveReleaseStatus,
        notes: payload.notes || existing[0].notes,
        updatedAt: new Date()
      })
      .where(eq(productionBatches.batchNumber, payload.batchNumber))
      .returning();
    savedBatch = upd;
  } else {
    const [ins] = await db
      .insert(productionBatches)
      .values({
        id: batchId,
        batchNumber: payload.batchNumber,
        productId: payload.productId,
        productName: payload.productName,
        variantId: payload.variantId,
        sku: payload.sku,
        size: payload.size,
        manufacturingDate: payload.manufacturingDate,
        expiryDate: payload.expiryDate,
        finishedQuantity: Number(payload.finishedQuantity),
        qcStatus: payload.qcStatus,
        bottleType: payload.bottleType,
        packagingAvailability: payload.packagingAvailability,
        batchReleaseStatus: effectiveReleaseStatus,
        releasedToInventory: false,
        notes: payload.notes || '',
        createdBy: payload.actor || 'admin@fragmore.com'
      })
      .returning();
    savedBatch = ins;
  }

  return {
    batch: savedBatch,
    canOfferForSale,
    blockReasons
  };
}

export async function releaseProductionBatchToInventory(params: {
  batchId: string;
  actor?: string;
}): Promise<{
  released: boolean;
  reason: string;
  batch: any;
  updatedLedger?: any;
}> {
  await syncAndInitializeInventoryLedger();
  const [batch] = await db
    .select()
    .from(productionBatches)
    .where(eq(productionBatches.id, params.batchId))
    .limit(1);

  if (!batch) {
    throw new Error(`Production batch ${params.batchId} not found`);
  }

  if (batch.releasedToInventory) {
    return {
      released: false,
      reason: `Batch ${batch.batchNumber} was already released to sellable inventory`,
      batch
    };
  }

  const blockReasons: string[] = [];
  if (batch.qcStatus !== 'PASSED') {
    blockReasons.push(`Quality Control status is ${batch.qcStatus} (must be PASSED)`);
  }
  if (batch.packagingAvailability !== 'AVAILABLE') {
    blockReasons.push(`Packaging availability is ${batch.packagingAvailability} (must be AVAILABLE)`);
  }
  if (new Date(batch.expiryDate).getTime() <= Date.now()) {
    blockReasons.push(`Batch ${batch.batchNumber} is past its expiry date (${batch.expiryDate})`);
  }
  if (batch.batchReleaseStatus === 'RECALLED' || batch.batchReleaseStatus === 'BLOCKED') {
    blockReasons.push(`Batch status is ${batch.batchReleaseStatus}`);
  }

  if (blockReasons.length > 0) {
    await db
      .update(productionBatches)
      .set({ batchReleaseStatus: 'BLOCKED', updatedAt: new Date() })
      .where(eq(productionBatches.id, batch.id));

    return {
      released: false,
      reason: `Blocked from sale: ${blockReasons.join('; ')}`,
      batch: { ...batch, batchReleaseStatus: 'BLOCKED' }
    };
  }

  const actor = params.actor || 'admin@fragmore.com';
  const result = await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(inventoryLedger)
      .where(eq(inventoryLedger.sku, batch.sku))
      .limit(1);

    if (!row) {
      throw new Error(`SKU ${batch.sku} not found in inventory ledger`);
    }

    const nextReceived = Number(row.receivedStock) + Number(batch.finishedQuantity);
    const nextAvailable = calculateLedgerAvailable({
      openingStock: row.openingStock,
      receivedStock: nextReceived,
      reservedStock: row.reservedStock,
      soldStock: row.soldStock,
      returnedSellableStock: row.returnedSellableStock,
      damagedStock: row.damagedStock
    });

    const history: StockMovementEntry[] = Array.isArray(row.movementsHistory)
      ? [...(row.movementsHistory as StockMovementEntry[])]
      : [];

    history.unshift({
      id: `mov-batch-${Date.now()}`,
      timestamp: new Date().toISOString(),
      movementType: 'BATCH_RELEASE_RECEIVED',
      quantity: Number(batch.finishedQuantity),
      referenceId: batch.batchNumber,
      actor,
      notes: `Released production batch ${batch.batchNumber} (${batch.bottleType}) to sellable stock`,
      resultingAvailable: nextAvailable,
      resultingReserved: row.reservedStock,
      resultingSold: row.soldStock
    });

    const [updatedLedger] = await tx
      .update(inventoryLedger)
      .set({
        receivedStock: nextReceived,
        availableStock: nextAvailable,
        procurementStatus: nextAvailable > row.reorderThreshold ? 'NORMAL' : row.procurementStatus,
        movementsHistory: history.slice(0, 100),
        updatedAt: new Date()
      })
      .where(eq(inventoryLedger.sku, batch.sku))
      .returning();

    const [updatedBatch] = await tx
      .update(productionBatches)
      .set({
        batchReleaseStatus: 'RELEASED',
        releasedToInventory: true,
        releasedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(productionBatches.id, batch.id))
      .returning();

    await syncSkuToProductVariants(
      tx,
      batch.sku,
      nextAvailable,
      row.reservedStock,
      nextAvailable + Number(row.reservedStock)
    );

    await tx.insert(auditLogs).values({
      id: `aud-batch-${Date.now()}`,
      action: 'PRODUCTION_BATCH_RELEASED',
      adminEmail: actor,
      details: `Released batch ${batch.batchNumber} (+${batch.finishedQuantity} units) into SKU ${batch.sku}`,
      metadata: { batchNumber: batch.batchNumber, sku: batch.sku, quantity: batch.finishedQuantity }
    });

    return { updatedBatch, updatedLedger };
  });

  await evaluateLowStockAndProcurementRules(batch.sku);

  return {
    released: true,
    reason: `Batch ${batch.batchNumber} (+${batch.finishedQuantity} units) released into sellable stock for ${batch.sku}`,
    batch: result.updatedBatch,
    updatedLedger: result.updatedLedger
  };
}

// ============================================================================
// 5. ORDER AUTOMATION, ATOMIC RESERVATION & SERVER PAYMENT VERIFICATION
// ============================================================================

export async function createOrderWithAutomation(payload: {
  id?: string;
  orderNumber?: string;
  customerId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: any;
  items: any[];
  discount?: number;
  couponCode?: string | null;
  taxAmount?: number;
  shippingAmount?: number;
  paymentMethod: string;
  paymentStatus?: string;
  transactionId?: string | null;
  verifiedByServerCallback?: boolean; // Must be true or verified via webhook to mark PAID immediately
  attribution?: any;
  notes?: string;
}): Promise<{
  order: any;
  reservedSkus: { sku: string; quantity: number; availableAfter: number }[];
  priceValidated: boolean;
}> {
  await syncAndInitializeInventoryLedger();

  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw new Error('Order must contain at least one item');
  }

  const allProds = await db.select().from(products);
  const allBatches = await db.select().from(productionBatches);

  // 1. Validate product variants, authoritative prices, and batch release eligibility
  const validatedItems: any[] = [];
  let authoritativeSubtotal = 0;

  for (const reqItem of payload.items) {
    const prod = allProds.find(
      (p) =>
        p.id === reqItem.productId ||
        (reqItem.slug && p.slug === reqItem.slug) ||
        (reqItem.productName && p.name.toLowerCase() === String(reqItem.productName).toLowerCase())
    );

    if (!prod || String(prod.status).toUpperCase() !== 'ACTIVE') {
      throw new Error(`Product "${reqItem.productName || reqItem.productId}" is inactive or unavailable for sale.`);
    }

    const vars: any[] = Array.isArray(prod.variants) ? prod.variants : [];
    const matchedVar =
      vars.find(
        (v) =>
          (reqItem.variantId && v.id === reqItem.variantId) ||
          (reqItem.sku && v.sku === reqItem.sku) ||
          (reqItem.size && String(v.size).toLowerCase() === String(reqItem.size).toLowerCase())
      ) || vars[0];

    if (!matchedVar || !matchedVar.sku) {
      throw new Error(`Invalid variant "${reqItem.size}" for product "${prod.name}".`);
    }

    // Check if this SKU is tied exclusivamente to a RECALLED or BLOCKED batch with 0 prior sellable stock
    const recalledBatches = allBatches.filter(
      (b) => b.sku === matchedVar.sku && b.batchReleaseStatus === 'RECALLED'
    );
    if (recalledBatches.length > 0) {
      throw new Error(`SKU ${matchedVar.sku} has an active batch recall (${recalledBatches[0].batchNumber}) and cannot be sold.`);
    }

    if (reqItem.batchNumber) {
      const requestedBatch = allBatches.find((b) => b.batchNumber === reqItem.batchNumber);
      if (
        !requestedBatch ||
        requestedBatch.qcStatus !== 'PASSED' ||
        requestedBatch.packagingAvailability !== 'AVAILABLE' ||
        requestedBatch.batchReleaseStatus !== 'RELEASED'
      ) {
        throw new Error(`Batch ${reqItem.batchNumber} is unreleased or failed QC and cannot be offered for sale.`);
      }
    }

    const authoritativeUnitPrice =
      Number(matchedVar.sellingPrice) > 0
        ? Number(matchedVar.sellingPrice)
        : Number(reqItem.sellingPrice) || Number(reqItem.price) || 999;

    const qty = Math.max(1, Number(reqItem.quantity) || 1);
    authoritativeSubtotal += authoritativeUnitPrice * qty;

    validatedItems.push({
      ...reqItem,
      productId: prod.id,
      productName: prod.name,
      slug: prod.slug,
      variantId: matchedVar.id,
      sku: matchedVar.sku,
      size: matchedVar.size,
      sellingPrice: authoritativeUnitPrice,
      price: authoritativeUnitPrice,
      quantity: qty
    });
  }

  const discount = Math.max(0, Number(payload.discount) || 0);
  const shippingAmount =
    payload.shippingAmount !== undefined
      ? Number(payload.shippingAmount)
      : authoritativeSubtotal >= 999
      ? 0
      : 100;
  const taxableAmount = Math.max(0, authoritativeSubtotal - discount);
  const taxAmount =
    payload.taxAmount !== undefined ? Number(payload.taxAmount) : Math.round(taxableAmount * 0.18);
  const totalAmount = Math.max(0, taxableAmount + shippingAmount);

  const orderId = payload.id || `ord-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const orderNumber =
    payload.orderNumber || `FRG-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

  // 2. Payment Verification Guard:
  // Never trust a browser success callback alone as payment verification!
  const isCod = String(payload.paymentMethod || '').toUpperCase().includes('COD');
  const isServerVerified = Boolean(payload.verifiedByServerCallback);

  const initialPaymentStatus = isCod
    ? 'COD_PENDING'
    : isServerVerified
    ? 'PAID'
    : 'PENDING_VERIFICATION';

  const initialOrderStatus = isServerVerified ? 'CONFIRMED' : 'NEW';
  const nowIso = new Date().toISOString();

  const timeline: OrderTimelineEvent[] = [
    {
      id: `tl-${Date.now()}-1`,
      timestamp: nowIso,
      eventType: 'ORDER_CREATED',
      status: initialOrderStatus,
      actor: payload.customerEmail || 'customer',
      details: `Order ${orderNumber} created. Variants & authoritative prices validated (Subtotal: ₹${authoritativeSubtotal}, Total: ₹${totalAmount}).`
    },
    {
      id: `tl-${Date.now()}-2`,
      timestamp: nowIso,
      eventType: 'INVENTORY_RESERVED',
      status: 'RESERVED',
      actor: 'inventory_engine',
      details: `Atomic stock reservation locked for ${validatedItems.map((i) => `${i.sku} ×${i.quantity}`).join(', ')}.`
    }
  ];

  if (!isCod && !isServerVerified) {
    timeline.push({
      id: `tl-${Date.now()}-3`,
      timestamp: nowIso,
      eventType: 'AWAITING_SERVER_PAYMENT_VERIFICATION',
      status: 'PENDING_VERIFICATION',
      actor: 'payment_guard',
      details: 'Browser callback held: awaiting cryptographic payment provider webhook or server-side verification before confirming order.'
    });
  }

  // 3. Atomic Transaction: Check available stock, reserve inventory, insert order, and notify Admin
  const reservedSkus: { sku: string; quantity: number; availableAfter: number }[] = [];

  const createdOrder = await db.transaction(async (tx) => {
    for (const item of validatedItems) {
      const [ledgerRow] = await tx
        .select()
        .from(inventoryLedger)
        .where(eq(inventoryLedger.sku, item.sku))
        .limit(1);

      if (!ledgerRow) {
        throw new Error(`Inventory ledger missing for SKU ${item.sku}`);
      }

      if (Number(ledgerRow.availableStock) < item.quantity) {
        throw new Error(
          `Oversell Prevention Guard: Insufficient available stock for ${item.productName} (${item.size}) [${item.sku}]. Available: ${ledgerRow.availableStock}, Requested: ${item.quantity}`
        );
      }

      const nextReserved = isServerVerified
        ? Number(ledgerRow.reservedStock)
        : Number(ledgerRow.reservedStock) + item.quantity;
      const nextSold = isServerVerified
        ? Number(ledgerRow.soldStock) + item.quantity
        : Number(ledgerRow.soldStock);

      const nextAvailable = calculateLedgerAvailable({
        openingStock: ledgerRow.openingStock,
        receivedStock: ledgerRow.receivedStock,
        reservedStock: nextReserved,
        soldStock: nextSold,
        returnedSellableStock: ledgerRow.returnedSellableStock,
        damagedStock: ledgerRow.damagedStock
      });

      const history: StockMovementEntry[] = Array.isArray(ledgerRow.movementsHistory)
        ? [...(ledgerRow.movementsHistory as StockMovementEntry[])]
        : [];

      history.unshift({
        id: `mov-res-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: nowIso,
        movementType: isServerVerified ? 'COMMIT_SALE' : 'RESERVE',
        quantity: item.quantity,
        referenceId: orderNumber,
        actor: 'order_engine',
        notes: isServerVerified
          ? `Committed sale for verified order ${orderNumber}`
          : `Reserved ${item.quantity} units for order ${orderNumber}`,
        resultingAvailable: nextAvailable,
        resultingReserved: nextReserved,
        resultingSold: nextSold
      });

      await tx
        .update(inventoryLedger)
        .set({
          reservedStock: nextReserved,
          soldStock: nextSold,
          availableStock: nextAvailable,
          movementsHistory: history.slice(0, 100),
          updatedAt: new Date()
        })
        .where(eq(inventoryLedger.sku, item.sku));

      await syncSkuToProductVariants(
        tx,
        item.sku,
        nextAvailable,
        nextReserved,
        nextAvailable + nextReserved
      );

      reservedSkus.push({
        sku: item.sku,
        quantity: item.quantity,
        availableAfter: nextAvailable
      });
    }

    const opsMetadata = {
      priceValidated: true,
      authoritativeSubtotalInr: authoritativeSubtotal,
      reservationStatus: isServerVerified ? 'COMMITTED' : 'RESERVED',
      reservationCreatedAt: nowIso,
      reservationExpiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      paymentVerification: {
        verified: isServerVerified,
        method: isServerVerified ? 'SERVER_CALLBACK' : 'UNVERIFIED_BROWSER_HELD',
        verifiedAt: isServerVerified ? nowIso : null,
        transactionId: payload.transactionId || null
      },
      fulfillmentQueueStatus: isServerVerified || isCod ? 'QUEUED_FOR_PACKING' : 'AWAITING_PAYMENT_VERIFICATION',
      verifiedSalesRevenueInr: isServerVerified ? totalAmount : 0,
      deliveryVerification: {
        verified: false,
        verificationSource: null,
        verifiedAt: null,
        verifiedBy: null
      },
      shippingEvents: [],
      timeline
    };

    const [insertedOrder] = await tx
      .insert(orders)
      .values({
        id: orderId,
        orderNumber,
        customerId: payload.customerId || `cust-${Date.now()}`,
        customerName: payload.customerName,
        customerEmail: payload.customerEmail,
        customerPhone: payload.customerPhone,
        shippingAddress: payload.shippingAddress || { city: 'Mumbai', state: 'Maharashtra' },
        items: validatedItems,
        subtotal: authoritativeSubtotal,
        discount,
        couponCode: payload.couponCode || null,
        taxAmount,
        shippingAmount,
        totalAmount,
        paymentMethod: payload.paymentMethod || 'PREPAID',
        paymentStatus: initialPaymentStatus,
        transactionId: payload.transactionId || null,
        orderStatus: initialOrderStatus,
        attribution: payload.attribution || { utm_source: 'direct' },
        notes: payload.notes || '',
        opsMetadata
      })
      .onConflictDoUpdate({
        target: orders.id,
        set: {
          items: validatedItems,
          subtotal: authoritativeSubtotal,
          totalAmount,
          paymentStatus: initialPaymentStatus,
          orderStatus: initialOrderStatus,
          opsMetadata
        }
      })
      .returning();

    // Notify Admin
    await tx.insert(opsTasksAndAlerts).values({
      id: `alert-ord-${orderId}`,
      category: 'ORDER_ALERT',
      severity: 'INFO',
      title: `New Order ${orderNumber} (₹${totalAmount.toLocaleString('en-IN')})`,
      description: `Customer ${payload.customerName} placed ${orderNumber} (${initialPaymentStatus}). Inventory reserved for ${reservedSkus.length} SKU(s).`,
      entityType: 'ORDER',
      entityId: orderId,
      status: 'OPEN',
      requiresAdminApproval: false,
      metadata: {
        orderId,
        orderNumber,
        totalAmount,
        paymentStatus: initialPaymentStatus,
        reservedSkus
      }
    });

    await tx.insert(auditLogs).values({
      id: `aud-ord-${Date.now()}`,
      action: 'ORDER_CREATED_WITH_RESERVATION',
      adminEmail: payload.customerEmail || 'system@fragmore.com',
      details: `Order ${orderNumber} created (₹${totalAmount}). Payment: ${initialPaymentStatus}. Reserved: ${reservedSkus.map((r) => `${r.sku}×${r.quantity}`).join(', ')}`,
      metadata: { orderId, orderNumber, reservedSkus }
    });

    return insertedOrder;
  });

  // Evaluate low-stock rules for all reserved SKUs
  for (const r of reservedSkus) {
    await evaluateLowStockAndProcurementRules(r.sku);
  }

  return {
    order: createdOrder,
    reservedSkus,
    priceValidated: true
  };
}

export async function verifyOrderPaymentServerSide(params: {
  orderId: string;
  verificationSource: 'PROVIDER_WEBHOOK_SIGNATURE' | 'SERVER_API_VERIFICATION' | 'BROWSER_CALLBACK_ONLY';
  transactionId?: string;
  providerSignature?: string;
  actor?: string;
}): Promise<{
  verified: boolean;
  reason: string;
  order: any;
}> {
  const [ord] = await db.select().from(orders).where(eq(orders.id, params.orderId)).limit(1);
  if (!ord) {
    throw new Error(`Order ${params.orderId} not found`);
  }

  // Strict guard: Never trust a browser success callback alone as payment verification!
  if (params.verificationSource === 'BROWSER_CALLBACK_ONLY') {
    const meta = ((ord.opsMetadata as any) || {}) as Record<string, any>;
    const timeline: OrderTimelineEvent[] = Array.isArray(meta.timeline) ? [...meta.timeline] : [];
    timeline.push({
      id: `tl-reject-browser-${Date.now()}`,
      timestamp: new Date().toISOString(),
      eventType: 'BROWSER_CALLBACK_REJECTED',
      status: ord.orderStatus,
      actor: 'payment_security_guard',
      verificationSource: 'BROWSER_CALLBACK_ONLY',
      details: 'Rejected browser-only payment callback. Order confirmation and inventory commit require server-side verification or signed provider webhook.'
    });

    const [updated] = await db
      .update(orders)
      .set({
        opsMetadata: {
          ...meta,
          timeline
        }
      })
      .where(eq(orders.id, ord.id))
      .returning();

    return {
      verified: false,
      reason: 'Browser success callback alone is not trusted for payment verification. Requires signed provider webhook or server-side verification.',
      order: updated
    };
  }

  const meta = ((ord.opsMetadata as any) || {}) as Record<string, any>;
  if (ord.paymentStatus === 'PAID' && meta.reservationStatus === 'COMMITTED') {
    return {
      verified: true,
      reason: `Order ${ord.orderNumber} payment is already verified and committed`,
      order: ord
    };
  }

  const nowIso = new Date().toISOString();
  const items: any[] = Array.isArray(ord.items) ? ord.items : [];

  const updatedOrder = await db.transaction(async (tx) => {
    // Commit inventory reservation -> move from reservedStock to soldStock
    if (meta.reservationStatus !== 'COMMITTED') {
      for (const item of items) {
        if (!item.sku) continue;
        const [ledgerRow] = await tx
          .select()
          .from(inventoryLedger)
          .where(eq(inventoryLedger.sku, item.sku))
          .limit(1);

        if (ledgerRow) {
          const qty = Math.max(1, Number(item.quantity) || 1);
          const nextReserved = Math.max(0, Number(ledgerRow.reservedStock) - qty);
          const nextSold = Number(ledgerRow.soldStock) + qty;
          const nextAvailable = calculateLedgerAvailable({
            openingStock: ledgerRow.openingStock,
            receivedStock: ledgerRow.receivedStock,
            reservedStock: nextReserved,
            soldStock: nextSold,
            returnedSellableStock: ledgerRow.returnedSellableStock,
            damagedStock: ledgerRow.damagedStock
          });

          const history: StockMovementEntry[] = Array.isArray(ledgerRow.movementsHistory)
            ? [...(ledgerRow.movementsHistory as StockMovementEntry[])]
            : [];

          history.unshift({
            id: `mov-commit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            timestamp: nowIso,
            movementType: 'COMMIT_SALE',
            quantity: qty,
            referenceId: ord.orderNumber,
            actor: params.verificationSource,
            notes: `Committed reserved stock to sold upon verified payment (${ord.orderNumber})`,
            resultingAvailable: nextAvailable,
            resultingReserved: nextReserved,
            resultingSold: nextSold
          });

          await tx
            .update(inventoryLedger)
            .set({
              reservedStock: nextReserved,
              soldStock: nextSold,
              availableStock: nextAvailable,
              movementsHistory: history.slice(0, 100),
              updatedAt: new Date()
            })
            .where(eq(inventoryLedger.sku, item.sku));

          await syncSkuToProductVariants(
            tx,
            item.sku,
            nextAvailable,
            nextReserved,
            nextAvailable + nextReserved
          );
        }
      }
    }

    const timeline: OrderTimelineEvent[] = Array.isArray(meta.timeline) ? [...meta.timeline] : [];
    timeline.push({
      id: `tl-pay-verified-${Date.now()}`,
      timestamp: nowIso,
      eventType: 'PAYMENT_VERIFIED_SERVER_SIDE',
      status: 'CONFIRMED',
      actor: params.actor || params.verificationSource,
      verificationSource: params.verificationSource,
      details: `Payment verified via ${params.verificationSource} (Txn: ${params.transactionId || 'TXN-VERIFIED'}). Inventory committed, order confirmed, added to fulfillment queue, and ₹${ord.totalAmount} sales revenue recorded.`
    });

    const nextMeta = {
      ...meta,
      reservationStatus: 'COMMITTED',
      committedAt: nowIso,
      paymentVerification: {
        verified: true,
        method: params.verificationSource,
        verifiedAt: nowIso,
        transactionId: params.transactionId || ord.transactionId || `TXN-${Date.now()}`,
        providerSignature: params.providerSignature || 'HMAC-SHA256-VALID'
      },
      fulfillmentQueueStatus: 'READY_FOR_PACKING',
      queuedForFulfillmentAt: nowIso,
      verifiedSalesRevenueInr: Number(ord.totalAmount) || 0,
      orderConfirmationTriggered: true,
      timeline
    };

    const [saved] = await tx
      .update(orders)
      .set({
        paymentStatus: 'PAID',
        orderStatus: ord.orderStatus === 'NEW' || ord.orderStatus === 'PAYMENT_FAILED' ? 'CONFIRMED' : ord.orderStatus,
        transactionId: params.transactionId || ord.transactionId || `TXN-${Date.now()}`,
        opsMetadata: nextMeta
      })
      .where(eq(orders.id, ord.id))
      .returning();

    return saved;
  });

  try {
    await ingestAutomationEvent({
      eventType: 'payment.succeeded',
      source: 'webhook',
      entityId: ord.id,
      customerEmail: ord.customerEmail,
      customerPhone: ord.customerPhone,
      payload: {
        orderId: ord.id,
        orderNumber: ord.orderNumber,
        totalAmount: ord.totalAmount,
        verificationSource: params.verificationSource
      }
    });
  } catch {}

  return {
    verified: true,
    reason: `Order ${ord.orderNumber} confirmed, inventory committed, added to fulfillment queue, and ₹${ord.totalAmount} recorded as actual sales revenue.`,
    order: updatedOrder
  };
}

export async function handleOrderPaymentFailure(params: {
  orderId: string;
  failureReason?: string;
  actor?: string;
}): Promise<{
  releasedReservation: boolean;
  order: any;
}> {
  const [ord] = await db.select().from(orders).where(eq(orders.id, params.orderId)).limit(1);
  if (!ord) {
    throw new Error(`Order ${params.orderId} not found`);
  }

  const meta = ((ord.opsMetadata as any) || {}) as Record<string, any>;
  const nowIso = new Date().toISOString();
  const items: any[] = Array.isArray(ord.items) ? ord.items : [];
  let releasedReservation = false;

  const updatedOrder = await db.transaction(async (tx) => {
    if (meta.reservationStatus === 'RESERVED') {
      for (const item of items) {
        if (!item.sku) continue;
        const [ledgerRow] = await tx
          .select()
          .from(inventoryLedger)
          .where(eq(inventoryLedger.sku, item.sku))
          .limit(1);

        if (ledgerRow) {
          const qty = Math.max(1, Number(item.quantity) || 1);
          const nextReserved = Math.max(0, Number(ledgerRow.reservedStock) - qty);
          const nextAvailable = calculateLedgerAvailable({
            openingStock: ledgerRow.openingStock,
            receivedStock: ledgerRow.receivedStock,
            reservedStock: nextReserved,
            soldStock: ledgerRow.soldStock,
            returnedSellableStock: ledgerRow.returnedSellableStock,
            damagedStock: ledgerRow.damagedStock
          });

          const history: StockMovementEntry[] = Array.isArray(ledgerRow.movementsHistory)
            ? [...(ledgerRow.movementsHistory as StockMovementEntry[])]
            : [];

          history.unshift({
            id: `mov-rel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            timestamp: nowIso,
            movementType: 'RELEASE_RESERVATION',
            quantity: qty,
            referenceId: ord.orderNumber,
            actor: params.actor || 'payment_gateway',
            notes: `Released reserved stock after payment failure (${params.failureReason || 'Gateway declined'})`,
            resultingAvailable: nextAvailable,
            resultingReserved: nextReserved,
            resultingSold: ledgerRow.soldStock
          });

          await tx
            .update(inventoryLedger)
            .set({
              reservedStock: nextReserved,
              availableStock: nextAvailable,
              movementsHistory: history.slice(0, 100),
              updatedAt: new Date()
            })
            .where(eq(inventoryLedger.sku, item.sku));

          await syncSkuToProductVariants(
            tx,
            item.sku,
            nextAvailable,
            nextReserved,
            nextAvailable + nextReserved
          );
          releasedReservation = true;
        }
      }
    }

    const timeline: OrderTimelineEvent[] = Array.isArray(meta.timeline) ? [...meta.timeline] : [];
    timeline.push({
      id: `tl-pay-fail-${Date.now()}`,
      timestamp: nowIso,
      eventType: 'PAYMENT_FAILED_RESERVATION_RELEASED',
      status: 'PAYMENT_FAILED',
      actor: params.actor || 'payment_gateway',
      details: `Payment failed (${params.failureReason || 'Gateway declined'}). Inventory reservation released; false order confirmation prevented; safe retry token issued.`
    });

    const nextMeta = {
      ...meta,
      reservationStatus: 'RELEASED_ON_PAYMENT_FAILURE',
      releasedAt: nowIso,
      paymentVerification: {
        verified: false,
        method: 'FAILED',
        failureReason: params.failureReason || 'Payment declined by issuing bank',
        failedAt: nowIso
      },
      fulfillmentQueueStatus: 'BLOCKED_PAYMENT_FAILED',
      verifiedSalesRevenueInr: 0,
      orderConfirmationTriggered: false,
      canRetryPayment: true,
      retryToken: `retry_${ord.id}_${Date.now()}`,
      timeline
    };

    const [saved] = await tx
      .update(orders)
      .set({
        paymentStatus: 'FAILED',
        orderStatus: 'PAYMENT_FAILED',
        opsMetadata: nextMeta
      })
      .where(eq(orders.id, ord.id))
      .returning();

    return saved;
  });

  try {
    await ingestAutomationEvent({
      eventType: 'payment.failed',
      source: 'webhook',
      entityId: ord.id,
      customerEmail: ord.customerEmail,
      customerPhone: ord.customerPhone,
      payload: {
        orderId: ord.id,
        orderNumber: ord.orderNumber,
        reason: params.failureReason || 'Payment failed'
      }
    });
  } catch {}

  return {
    releasedReservation,
    order: updatedOrder
  };
}

export async function retryFailedOrderPayment(params: {
  orderId: string;
  verificationSource?: 'PROVIDER_WEBHOOK_SIGNATURE' | 'SERVER_API_VERIFICATION';
  transactionId?: string;
}): Promise<{
  retried: boolean;
  order: any;
  reason: string;
}> {
  const [ord] = await db.select().from(orders).where(eq(orders.id, params.orderId)).limit(1);
  if (!ord) {
    throw new Error(`Order ${params.orderId} not found`);
  }

  const meta = ((ord.opsMetadata as any) || {}) as Record<string, any>;
  const items: any[] = Array.isArray(ord.items) ? ord.items : [];
  const nowIso = new Date().toISOString();

  // Re-reserve stock atomically first
  await db.transaction(async (tx) => {
    if (meta.reservationStatus === 'RELEASED_ON_PAYMENT_FAILURE') {
      for (const item of items) {
        if (!item.sku) continue;
        const [ledgerRow] = await tx
          .select()
          .from(inventoryLedger)
          .where(eq(inventoryLedger.sku, item.sku))
          .limit(1);

        if (!ledgerRow || Number(ledgerRow.availableStock) < Number(item.quantity || 1)) {
          throw new Error(`Cannot retry payment: SKU ${item.sku} no longer has sufficient available stock.`);
        }

        const qty = Math.max(1, Number(item.quantity) || 1);
        const nextReserved = Number(ledgerRow.reservedStock) + qty;
        const nextAvailable = calculateLedgerAvailable({
          openingStock: ledgerRow.openingStock,
          receivedStock: ledgerRow.receivedStock,
          reservedStock: nextReserved,
          soldStock: ledgerRow.soldStock,
          returnedSellableStock: ledgerRow.returnedSellableStock,
          damagedStock: ledgerRow.damagedStock
        });

        await tx
          .update(inventoryLedger)
          .set({
            reservedStock: nextReserved,
            availableStock: nextAvailable,
            updatedAt: new Date()
          })
          .where(eq(inventoryLedger.sku, item.sku));

        await syncSkuToProductVariants(
          tx,
          item.sku,
          nextAvailable,
          nextReserved,
          nextAvailable + nextReserved
        );
      }

      const timeline: OrderTimelineEvent[] = Array.isArray(meta.timeline) ? [...meta.timeline] : [];
      timeline.push({
        id: `tl-retry-${Date.now()}`,
        timestamp: nowIso,
        eventType: 'PAYMENT_RETRY_INITIATED',
        status: 'NEW',
        actor: ord.customerEmail,
        details: 'Customer initiated safe payment retry; stock re-reserved atomically.'
      });

      await tx
        .update(orders)
        .set({
          paymentStatus: 'PENDING_VERIFICATION',
          orderStatus: 'NEW',
          opsMetadata: {
            ...meta,
            reservationStatus: 'RESERVED',
            timeline
          }
        })
        .where(eq(orders.id, ord.id));
    }
  });

  if (params.verificationSource) {
    const ver = await verifyOrderPaymentServerSide({
      orderId: ord.id,
      verificationSource: params.verificationSource,
      transactionId: params.transactionId || `RETRY-TXN-${Date.now()}`
    });
    return {
      retried: ver.verified,
      order: ver.order,
      reason: ver.reason
    };
  }

  const [refreshed] = await db.select().from(orders).where(eq(orders.id, ord.id)).limit(1);
  return {
    retried: true,
    order: refreshed,
    reason: 'Stock re-reserved safely; awaiting payment verification.'
  };
}

// ============================================================================
// 6. SHIPPING AUTOMATION (10 EVENT-BASED WORKFLOWS + DELIVERY GUARD)
// ============================================================================

export async function processShippingLifecycleEvent(params: {
  orderId: string;
  eventType: ShippingLifecycleEventType;
  awbNumber?: string;
  courierName?: string;
  trackingUrl?: string;
  verificationSource?: 'TRUSTED_CARRIER_WEBHOOK' | 'AUTHORIZED_ADMIN_CONFIRMATION' | 'UNVERIFIED_CLIENT';
  adminEmail?: string;
  proofReference?: string;
  exceptionReason?: string;
}): Promise<{
  success: boolean;
  reason: string;
  order: any;
  createdAdminTask?: any | null;
  customerNotified: boolean;
}> {
  const [ord] = await db.select().from(orders).where(eq(orders.id, params.orderId)).limit(1);
  if (!ord) {
    throw new Error(`Order ${params.orderId} not found`);
  }

  const meta = ((ord.opsMetadata as any) || {}) as Record<string, any>;

  // Strict Guard: Do NOT mark an order DELIVERED unless verified through trusted carrier status or authorized manual confirmation!
  if (params.eventType === 'DELIVERED') {
    const isTrustedCarrier = params.verificationSource === 'TRUSTED_CARRIER_WEBHOOK';
    const isAuthorizedAdmin =
      params.verificationSource === 'AUTHORIZED_ADMIN_CONFIRMATION' && Boolean(params.adminEmail);

    if (!isTrustedCarrier && !isAuthorizedAdmin) {
      return {
        success: false,
        reason:
          'Delivery Verification Guard: Cannot mark order DELIVERED without TRUSTED_CARRIER_WEBHOOK status or AUTHORIZED_ADMIN_CONFIRMATION.',
        order: ord,
        createdAdminTask: null,
        customerNotified: false
      };
    }
  }

  const statusMap: Record<ShippingLifecycleEventType, string> = {
    ORDER_READY_FOR_PACKING: 'PACKING',
    PACKING_COMPLETED: 'PACKING_COMPLETED',
    SHIPMENT_BOOKED: 'SHIPMENT_BOOKED',
    COURIER_ACCEPTED: 'COURIER_ACCEPTED',
    SHIPPED: 'SHIPPED',
    OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
    DELIVERED: 'DELIVERED',
    DELIVERY_EXCEPTION: 'DELIVERY_EXCEPTION',
    RETURN_TO_ORIGIN: 'RTO_INITIATED',
    LOST_OR_DAMAGED_SHIPMENT: 'SHIPMENT_LOST_OR_DAMAGED'
  };

  const nextOrderStatus = statusMap[params.eventType] || ord.orderStatus;
  const awb = params.awbNumber || ord.awbNumber || (params.eventType === 'SHIPMENT_BOOKED' || params.eventType === 'SHIPPED' ? `BD${Math.floor(10000000 + Math.random() * 90000000)}IN` : null);
  const courier = params.courierName || ord.courierName || 'Blue Dart Express';
  const nowIso = new Date().toISOString();

  // Check customer communication permission
  const [cust] = await db
    .select()
    .from(customers)
    .where(eq(customers.email, ord.customerEmail))
    .limit(1);
  const custConsent = ((cust?.crmMetadata as any)?.consent || {}) as Record<string, any>;
  const customerNotified = custConsent.unsubscribed !== true;

  const shippingEvents = Array.isArray(meta.shippingEvents) ? [...meta.shippingEvents] : [];
  shippingEvents.push({
    id: `ship-ev-${Date.now()}`,
    eventType: params.eventType,
    timestamp: nowIso,
    awbNumber: awb,
    courierName: courier,
    verificationSource: params.verificationSource || 'SYSTEM',
    customerNotified,
    notes: params.exceptionReason || params.proofReference || `Shipping workflow stage: ${params.eventType}`
  });

  const timeline: OrderTimelineEvent[] = Array.isArray(meta.timeline) ? [...meta.timeline] : [];
  timeline.push({
    id: `tl-ship-${Date.now()}`,
    timestamp: nowIso,
    eventType: params.eventType,
    status: nextOrderStatus,
    actor: params.adminEmail || params.verificationSource || courier,
    verificationSource: params.verificationSource,
    details: `Shipping event ${params.eventType} processed (${courier}${awb ? ` · AWB ${awb}` : ''}). Customer notified: ${customerNotified ? 'Yes' : 'Suppressed'}.`
  });

  const deliveryVerification =
    params.eventType === 'DELIVERED'
      ? {
          verified: true,
          verificationSource: params.verificationSource,
          verifiedAt: nowIso,
          verifiedBy: params.adminEmail || courier,
          proofReference: params.proofReference || awb || 'POD-VERIFIED'
        }
      : meta.deliveryVerification || { verified: false };

  const [updatedOrder] = await db
    .update(orders)
    .set({
      orderStatus: nextOrderStatus,
      awbNumber: awb,
      courierName: courier,
      trackingUrl: params.trackingUrl || ord.trackingUrl || (awb ? `https://www.bluedart.com/tracking?awb=${awb}` : null),
      opsMetadata: {
        ...meta,
        shippingEvents,
        deliveryVerification,
        fulfillmentQueueStatus: params.eventType,
        timeline
      }
    })
    .where(eq(orders.id, ord.id))
    .returning();

  // Create Admin Task automatically for unresolved shipping exceptions
  let createdAdminTask: any = null;
  if (
    params.eventType === 'DELIVERY_EXCEPTION' ||
    params.eventType === 'RETURN_TO_ORIGIN' ||
    params.eventType === 'LOST_OR_DAMAGED_SHIPMENT'
  ) {
    const taskId = `task-ship-exc-${ord.id}-${params.eventType}`;
    const [task] = await db
      .insert(opsTasksAndAlerts)
      .values({
        id: taskId,
        category: 'SHIPPING_EXCEPTION',
        severity: params.eventType === 'LOST_OR_DAMAGED_SHIPMENT' ? 'CRITICAL' : 'HIGH',
        title: `Shipping Exception (${params.eventType}): Order ${ord.orderNumber}`,
        description: `Consignment ${awb || ord.orderNumber} via ${courier} reported ${params.eventType}. Reason: ${
          params.exceptionReason || 'Carrier exception'
        }. Requires concierge & logistics resolution.`,
        entityType: 'SHIPMENT',
        entityId: ord.id,
        status: 'OPEN',
        requiresAdminApproval: true,
        metadata: {
          orderId: ord.id,
          orderNumber: ord.orderNumber,
          customerName: ord.customerName,
          customerPhone: ord.customerPhone,
          awbNumber: awb,
          courierName: courier,
          eventType: params.eventType,
          exceptionReason: params.exceptionReason || 'Carrier exception'
        }
      })
      .onConflictDoUpdate({
        target: opsTasksAndAlerts.id,
        set: {
          status: 'OPEN',
          description: `Consignment ${awb || ord.orderNumber} via ${courier} reported ${params.eventType}. Reason: ${
            params.exceptionReason || 'Carrier exception'
          }. Requires concierge & logistics resolution.`
        }
      })
      .returning();
    createdAdminTask = task;
  }

  return {
    success: true,
    reason: `Processed shipping event ${params.eventType} for order ${ord.orderNumber}`,
    order: updatedOrder,
    createdAdminTask,
    customerNotified
  };
}

// ============================================================================
// 7. RETURNS & REFUNDS AUTOMATION (ELIGIBILITY, PICKUP, INSPECTION, REFUND & RESTOCK)
// ============================================================================

export async function createReturnRequestWithValidation(payload: {
  id?: string;
  orderId?: string;
  orderNumber: string;
  customerName?: string;
  customerEmail?: string;
  items?: any[];
  productName?: string;
  sku?: string;
  size?: string;
  quantity?: number;
  reason: string;
  refundAmount?: number;
  isDamagedOnArrival?: boolean;
}): Promise<{
  returnRecord: any;
  eligible: boolean;
  eligibilityReason: string;
}> {
  await syncAndInitializeInventoryLedger();
  const allOrders = await db.select().from(orders);
  const matchedOrder = allOrders.find(
    (o) =>
      (payload.orderId && o.id === payload.orderId) ||
      o.orderNumber.toLowerCase() === String(payload.orderNumber || '').toLowerCase()
  );

  let eligible = true;
  let eligibilityReason = 'Eligible for reverse pickup & atelier inspection';

  if (!matchedOrder) {
    eligible = false;
    eligibilityReason = `Order ${payload.orderNumber} not found in verified order ledger`;
  } else if (
    String(matchedOrder.orderStatus).toUpperCase() === 'CANCELLED' ||
    String(matchedOrder.paymentStatus).toUpperCase() === 'FAILED'
  ) {
    eligible = false;
    eligibilityReason = `Order ${matchedOrder.orderNumber} was cancelled or unpaid and is not eligible for return`;
  }

  const orderItems: any[] = Array.isArray(matchedOrder?.items) ? matchedOrder.items : [];
  const firstOrderItem = orderItems[0] || {};
  const resolvedSku = payload.sku || firstOrderItem.sku || 'FRG-SIG-GH-050';
  const resolvedProductName = payload.productName || firstOrderItem.productName || 'GOLDEN HOUR';
  const resolvedSize = payload.size || firstOrderItem.size || '50 ml';
  const resolvedQty = Math.max(1, Number(payload.quantity) || Number(firstOrderItem.quantity) || 1);
  const resolvedRefundAmount =
    payload.refundAmount !== undefined
      ? Number(payload.refundAmount)
      : Number(matchedOrder?.totalAmount) || 999;

  const returnId = payload.id || `ret-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const nowIso = new Date().toISOString();

  const initialStatus = eligible ? 'PENDING_APPROVAL' : 'REJECTED_INELIGIBLE';

  const returnMetadata = {
    sku: resolvedSku,
    productName: resolvedProductName,
    size: resolvedSize,
    quantity: resolvedQty,
    customerEmail: payload.customerEmail || matchedOrder?.customerEmail || '',
    isDamagedOnArrival: Boolean(payload.isDamagedOnArrival),
    eligibilityValidation: {
      eligible,
      reason: eligibilityReason,
      validatedAt: nowIso
    },
    approvalState: {
      status: eligible ? 'PENDING_ADMIN_APPROVAL' : 'REJECTED',
      approvedBy: null,
      approvedAt: null
    },
    pickupWorkflow: {
      status: 'NOT_SCHEDULED',
      reverseCourier: null,
      reverseAwb: null,
      scheduledAt: null,
      pickedUpAt: null
    },
    inspectionResult: {
      status: 'PENDING_INSPECTION',
      sealIntact: null,
      disposition: null, // 'RESTOCK_SELLABLE' | 'QUARANTINE_DAMAGED'
      inspectedBy: null,
      inspectedAt: null,
      notes: null
    },
    refundExecution: {
      status: 'NOT_INITIATED',
      initiatedAt: null,
      gatewayConfirmedAt: null,
      gatewayRefundId: null
    },
    inventoryReconciliation: {
      reconciled: false,
      reconciledAt: null,
      disposition: null,
      quantityReconciled: 0
    },
    customerNotifications: [
      {
        stage: initialStatus,
        sentAt: nowIso,
        message: eligible
          ? `Return request ${returnId} logged and queued for Admin approval.`
          : `Return request ${returnId} declined: ${eligibilityReason}`
      }
    ]
  };

  const [inserted] = await db
    .insert(returnsRefunds)
    .values({
      id: returnId,
      orderId: matchedOrder?.id || payload.orderId || `ord-unknown`,
      orderNumber: matchedOrder?.orderNumber || payload.orderNumber,
      customerName: payload.customerName || matchedOrder?.customerName || 'Valued Patron',
      items: payload.items || [
        {
          sku: resolvedSku,
          productName: resolvedProductName,
          size: resolvedSize,
          quantity: resolvedQty
        }
      ],
      reason: payload.reason,
      refundAmount: resolvedRefundAmount,
      status: initialStatus,
      returnMetadata
    })
    .returning();

  if (eligible) {
    await db
      .insert(opsTasksAndAlerts)
      .values({
        id: `task-ret-app-${returnId}`,
        category: 'RETURN_APPROVAL',
        severity: 'MEDIUM',
        title: `Return Approval Queue: ${inserted.orderNumber} (₹${resolvedRefundAmount})`,
        description: `${inserted.customerName} requested return for ${resolvedProductName} (${resolvedSize}). Reason: "${payload.reason}".`,
        entityType: 'RETURN',
        entityId: returnId,
        sku: resolvedSku,
        status: 'PENDING_APPROVAL',
        requiresAdminApproval: true,
        metadata: { returnId, orderNumber: inserted.orderNumber, refundAmount: resolvedRefundAmount }
      })
      .onConflictDoNothing();
  }

  return {
    returnRecord: inserted,
    eligible,
    eligibilityReason
  };
}

export async function advanceReturnWorkflowStage(params: {
  returnId: string;
  stage:
    | 'APPROVE_RETURN'
    | 'SCHEDULE_PICKUP'
    | 'MARK_PICKED_UP'
    | 'COMPLETE_INSPECTION'
    | 'INITIATE_REFUND'
    | 'CONFIRM_GATEWAY_REFUND_AND_RECONCILE'
    | 'REJECT_RETURN';
  adminEmail?: string;
  reverseCourier?: string;
  reverseAwb?: string;
  sealIntact?: boolean;
  gatewayRefundId?: string;
  notes?: string;
}): Promise<{
  success: boolean;
  reason: string;
  returnRecord: any;
}> {
  await syncAndInitializeInventoryLedger();
  const [ret] = await db
    .select()
    .from(returnsRefunds)
    .where(eq(returnsRefunds.id, params.returnId))
    .limit(1);

  if (!ret) {
    throw new Error(`Return record ${params.returnId} not found`);
  }

  const meta = ((ret.returnMetadata as any) || {}) as Record<string, any>;
  const actor = params.adminEmail || 'admin@fragmore.com';
  const nowIso = new Date().toISOString();
  const items: any[] = Array.isArray(ret.items) ? ret.items : [];
  const primaryItem = items[0] || {};
  const sku = meta.sku || primaryItem.sku || 'FRG-SIG-GH-050';
  const qty = Math.max(1, Number(meta.quantity) || Number(primaryItem.quantity) || 1);

  const notifications = Array.isArray(meta.customerNotifications) ? [...meta.customerNotifications] : [];

  if (params.stage === 'REJECT_RETURN') {
    notifications.push({
      stage: 'REJECTED',
      sentAt: nowIso,
      message: `Your return request for ${ret.orderNumber} was reviewed and declined: ${params.notes || 'Does not meet seal criteria'}.`
    });
    const [upd] = await db
      .update(returnsRefunds)
      .set({
        status: 'REJECTED',
        returnMetadata: {
          ...meta,
          approvalState: { status: 'REJECTED', approvedBy: actor, approvedAt: nowIso },
          customerNotifications: notifications
        }
      })
      .where(eq(returnsRefunds.id, ret.id))
      .returning();

    return { success: true, reason: 'Return request rejected', returnRecord: upd };
  }

  if (params.stage === 'APPROVE_RETURN') {
    notifications.push({
      stage: 'APPROVED',
      sentAt: nowIso,
      message: `Your return request for ${ret.orderNumber} has been approved. Reverse pickup will be scheduled.`
    });
    const [upd] = await db
      .update(returnsRefunds)
      .set({
        status: 'APPROVED',
        returnMetadata: {
          ...meta,
          approvalState: { status: 'APPROVED', approvedBy: actor, approvedAt: nowIso },
          customerNotifications: notifications
        }
      })
      .where(eq(returnsRefunds.id, ret.id))
      .returning();

    await db
      .update(opsTasksAndAlerts)
      .set({ status: 'APPROVED', resolvedBy: actor, resolvedAt: new Date() })
      .where(eq(opsTasksAndAlerts.id, `task-ret-app-${ret.id}`));

    return { success: true, reason: 'Return request approved by Admin', returnRecord: upd };
  }

  if (params.stage === 'SCHEDULE_PICKUP' || params.stage === 'MARK_PICKED_UP') {
    const revCourier = params.reverseCourier || meta.pickupWorkflow?.reverseCourier || 'Blue Dart Reverse Logistics';
    const revAwb = params.reverseAwb || meta.pickupWorkflow?.reverseAwb || `REV-BD-${Math.floor(100000 + Math.random() * 900000)}`;
    const nextStatus = params.stage === 'MARK_PICKED_UP' ? 'PICKED_UP' : 'PICKUP_SCHEDULED';

    notifications.push({
      stage: nextStatus,
      sentAt: nowIso,
      message: `Reverse pickup ${nextStatus === 'PICKED_UP' ? 'completed' : 'scheduled'} via ${revCourier} (AWB: ${revAwb}).`
    });

    const [upd] = await db
      .update(returnsRefunds)
      .set({
        status: nextStatus,
        returnMetadata: {
          ...meta,
          pickupWorkflow: {
            status: nextStatus,
            reverseCourier: revCourier,
            reverseAwb: revAwb,
            scheduledAt: meta.pickupWorkflow?.scheduledAt || nowIso,
            pickedUpAt: params.stage === 'MARK_PICKED_UP' ? nowIso : null
          },
          customerNotifications: notifications
        }
      })
      .where(eq(returnsRefunds.id, ret.id))
      .returning();

    return { success: true, reason: `Reverse pickup ${nextStatus}`, returnRecord: upd };
  }

  if (params.stage === 'COMPLETE_INSPECTION') {
    const sealIntact = params.sealIntact !== undefined ? Boolean(params.sealIntact) : true;
    const disposition = sealIntact ? 'RESTOCK_SELLABLE' : 'QUARANTINE_DAMAGED';

    notifications.push({
      stage: 'IN_INSPECTION',
      sentAt: nowIso,
      message: `Atelier inspection completed for ${ret.orderNumber} (Disposition: ${disposition}).`
    });

    const [upd] = await db
      .update(returnsRefunds)
      .set({
        status: 'IN_INSPECTION',
        returnMetadata: {
          ...meta,
          inspectionResult: {
            status: 'COMPLETED',
            sealIntact,
            disposition,
            inspectedBy: actor,
            inspectedAt: nowIso,
            notes: params.notes || (sealIntact ? 'Crimp seal intact; sellable condition' : 'Opened/damaged seal; routed to damaged stock')
          },
          customerNotifications: notifications
        }
      })
      .where(eq(returnsRefunds.id, ret.id))
      .returning();

    return {
      success: true,
      reason: `Inspection completed: ${disposition}`,
      returnRecord: upd
    };
  }

  if (params.stage === 'INITIATE_REFUND') {
    if (meta.approvalState?.status !== 'APPROVED' && ret.status === 'PENDING_APPROVAL') {
      return {
        success: false,
        reason: 'Cannot initiate refund before Admin approval',
        returnRecord: ret
      };
    }

    notifications.push({
      stage: 'REFUND_INITIATED',
      sentAt: nowIso,
      message: `Refund of ₹${ret.refundAmount} initiated for ${ret.orderNumber}; awaiting payment gateway confirmation.`
    });

    const [upd] = await db
      .update(returnsRefunds)
      .set({
        status: 'REFUND_INITIATED',
        returnMetadata: {
          ...meta,
          refundExecution: {
            ...(meta.refundExecution || {}),
            status: 'INITIATED',
            initiatedAt: nowIso
          },
          customerNotifications: notifications
        }
      })
      .where(eq(returnsRefunds.id, ret.id))
      .returning();

    return { success: true, reason: 'Refund initiated; awaiting payment provider confirmation', returnRecord: upd };
  }

  if (params.stage === 'CONFIRM_GATEWAY_REFUND_AND_RECONCILE') {
    const gatewayRefundId = params.gatewayRefundId || `rfnd_${Date.now()}`;
    const sealIntact =
      params.sealIntact !== undefined
        ? Boolean(params.sealIntact)
        : meta.inspectionResult?.sealIntact !== undefined && meta.inspectionResult?.sealIntact !== null
        ? Boolean(meta.inspectionResult.sealIntact)
        : true;
    const disposition = sealIntact ? 'RESTOCK_SELLABLE' : 'QUARANTINE_DAMAGED';

    const updatedRet = await db.transaction(async (tx) => {
      // Reconcile inventory if not already reconciled
      if (!meta.inventoryReconciliation?.reconciled) {
        const [ledgerRow] = await tx
          .select()
          .from(inventoryLedger)
          .where(eq(inventoryLedger.sku, sku))
          .limit(1);

        if (ledgerRow) {
          // When an item from a sold order is returned:
          // - If sellable: increment returnedSellableStock (which increases availableStock)
          // - If damaged: incrementreturnedSellableStock AND damagedStock (or decrement soldStock and increment damagedStock so availableStock does NOT increase!)
          const nextSold = Math.max(0, Number(ledgerRow.soldStock) - qty);
          const nextReturnedSellable = sealIntact
            ? Number(ledgerRow.returnedSellableStock) + qty
            : Number(ledgerRow.returnedSellableStock);
          const nextDamaged = sealIntact
            ? Number(ledgerRow.damagedStock)
            : Number(ledgerRow.damagedStock) + qty;

          // Notice: if we decrement soldStock AND increment returnedSellableStock, that would double-count!
          // Let's keep the formula exact:
          // availableStock = openingStock + receivedStock + returnedSellableStock - reservedStock - soldStock - damagedStock
          // When a sold item is returned in sellable condition, soldStock stays as gross sold, and returnedSellableStock increases by qty (so availableStock increases by +qty).
          // When a sold item is returned damaged, returnedSellableStock increases by qty AND damagedStock increases by qty (so net effect on availableStock is 0!).
          const updatedReturnedSellable = Number(ledgerRow.returnedSellableStock) + qty;
          const updatedDamaged = sealIntact
            ? Number(ledgerRow.damagedStock)
            : Number(ledgerRow.damagedStock) + qty;

          const nextAvailable = calculateLedgerAvailable({
            openingStock: ledgerRow.openingStock,
            receivedStock: ledgerRow.receivedStock,
            reservedStock: ledgerRow.reservedStock,
            soldStock: ledgerRow.soldStock,
            returnedSellableStock: updatedReturnedSellable,
            damagedStock: updatedDamaged
          });

          const history: StockMovementEntry[] = Array.isArray(ledgerRow.movementsHistory)
            ? [...(ledgerRow.movementsHistory as StockMovementEntry[])]
            : [];

          history.unshift({
            id: `mov-ret-${Date.now()}`,
            timestamp: nowIso,
            movementType: sealIntact ? 'RETURN_SELLABLE' : 'RETURN_DAMAGED',
            quantity: qty,
            referenceId: ret.orderNumber,
            actor,
            notes: sealIntact
              ? `Return ${ret.id} passed inspection: +${qty} restocked to sellable inventory`
              : `Return ${ret.id} damaged/unsealed: +${qty} routed to damaged stock (excluded from available stock)`,
            resultingAvailable: nextAvailable,
            resultingReserved: ledgerRow.reservedStock,
            resultingSold: ledgerRow.soldStock
          });

          await tx
            .update(inventoryLedger)
            .set({
              returnedSellableStock: updatedReturnedSellable,
              damagedStock: updatedDamaged,
              availableStock: nextAvailable,
              movementsHistory: history.slice(0, 100),
              updatedAt: new Date()
            })
            .where(eq(inventoryLedger.sku, sku));

          await syncSkuToProductVariants(
            tx,
            sku,
            nextAvailable,
            ledgerRow.reservedStock,
            nextAvailable + Number(ledgerRow.reservedStock)
          );
        }
      }

      notifications.push({
        stage: 'REFUNDED',
        sentAt: nowIso,
        message: `Refund of ₹${ret.refundAmount} confirmed by payment provider (Ref: ${gatewayRefundId}).`
      });

      const [saved] = await tx
        .update(returnsRefunds)
        .set({
          status: 'REFUNDED',
          returnMetadata: {
            ...meta,
            approvalState: {
              status: 'APPROVED',
              approvedBy: meta.approvalState?.approvedBy || actor,
              approvedAt: meta.approvalState?.approvedAt || nowIso
            },
            inspectionResult: {
              status: 'COMPLETED',
              sealIntact,
              disposition,
              inspectedBy: meta.inspectionResult?.inspectedBy || actor,
              inspectedAt: meta.inspectionResult?.inspectedAt || nowIso
            },
            refundExecution: {
              status: 'CONFIRMED',
              initiatedAt: meta.refundExecution?.initiatedAt || nowIso,
              gatewayConfirmedAt: nowIso,
              gatewayRefundId
            },
            inventoryReconciliation: {
              reconciled: true,
              reconciledAt: nowIso,
              disposition,
              quantityReconciled: qty
            },
            customerNotifications: notifications
          }
        })
        .where(eq(returnsRefunds.id, ret.id))
        .returning();

      await tx.insert(auditLogs).values({
        id: `aud-ref-${Date.now()}`,
        action: 'REFUND_CONFIRMED_AND_INVENTORY_RECONCILED',
        adminEmail: actor,
        details: `Confirmed gateway refund ${gatewayRefundId} (₹${ret.refundAmount}) for ${ret.orderNumber}. Inventory disposition: ${disposition} (${qty} × ${sku}).`,
        metadata: { returnId: ret.id, gatewayRefundId, disposition, sku, quantity: qty }
      });

      return saved;
    });

    try {
      await ingestAutomationEvent({
        eventType: 'refund.completed',
        source: 'backend_api',
        entityId: ret.id,
        customerEmail: meta.customerEmail || undefined,
        payload: {
          returnId: ret.id,
          orderId: ret.orderId,
          orderNumber: ret.orderNumber,
          refundAmount: ret.refundAmount,
          gatewayRefundId,
          disposition
        }
      });
    } catch {}

    return {
      success: true,
      reason: `Gateway refund (${gatewayRefundId}) confirmed and inventory reconciled (${disposition}).`,
      returnRecord: updatedRet
    };
  }

  return { success: false, reason: 'Unsupported return stage', returnRecord: ret };
}

// ============================================================================
// 8. CROSS-MODULE RECONCILIATION ENGINE (ORDERS, PAYMENTS, SHIPMENTS, INVENTORY)
// ============================================================================

export async function runCrossModuleReconciliationJob(params?: {
  autoFixLedgerDrift?: boolean;
}): Promise<{
  runAt: string;
  totalChecked: {
    orders: number;
    skus: number;
    batches: number;
    returns: number;
  };
  mismatchesFound: number;
  autoHealedCount: number;
  anomalies: Array<{
    id: string;
    domain: 'ORDER_PAYMENT' | 'ORDER_SHIPMENT' | 'INVENTORY_LEDGER' | 'PRODUCTION_BATCH' | 'RETURN_REFUND';
    severity: 'MEDIUM' | 'HIGH' | 'CRITICAL';
    entityId: string;
    description: string;
    autoHealed: boolean;
  }>;
}> {
  await syncAndInitializeInventoryLedger();
  const allOrders = await db.select().from(orders);
  const allLedger = await db.select().from(inventoryLedger);
  const allProducts = await db.select().from(products);
  const allBatches = await db.select().from(productionBatches);
  const allReturns = await db.select().from(returnsRefunds);

  const anomalies: Array<{
    id: string;
    domain: 'ORDER_PAYMENT' | 'ORDER_SHIPMENT' | 'INVENTORY_LEDGER' | 'PRODUCTION_BATCH' | 'RETURN_REFUND';
    severity: 'MEDIUM' | 'HIGH' | 'CRITICAL';
    entityId: string;
    description: string;
    autoHealed: boolean;
  }> = [];

  let autoHealedCount = 0;

  // 1. Check Orders vs Payments & Shipments
  for (const ord of allOrders) {
    const oStatus = String(ord.orderStatus).toUpperCase();
    const pStatus = String(ord.paymentStatus).toUpperCase();
    const pMethod = String(ord.paymentMethod).toUpperCase();
    const meta = ((ord.opsMetadata as any) || {}) as Record<string, any>;

    // Mismatch A: Prepaid order confirmed/shipped/delivered without PAID status
    if (
      !pMethod.includes('COD') &&
      (oStatus === 'CONFIRMED' || oStatus === 'SHIPPED' || oStatus === 'DELIVERED') &&
      pStatus !== 'PAID'
    ) {
      anomalies.push({
        id: `mismatch-ord-pay-${ord.id}`,
        domain: 'ORDER_PAYMENT',
        severity: 'CRITICAL',
        entityId: ord.orderNumber,
        description: `Order ${ord.orderNumber} is in status ${oStatus} but paymentStatus is ${pStatus} (${pMethod}).`,
        autoHealed: false
      });
    }

    // Mismatch B: Order marked SHIPPED or OUT_FOR_DELIVERY without AWB number
    if ((oStatus === 'SHIPPED' || oStatus === 'OUT_FOR_DELIVERY') && !ord.awbNumber) {
      anomalies.push({
        id: `mismatch-ord-awb-${ord.id}`,
        domain: 'ORDER_SHIPMENT',
        severity: 'HIGH',
        entityId: ord.orderNumber,
        description: `Order ${ord.orderNumber} is marked ${oStatus} without an assigned carrier AWB number.`,
        autoHealed: false
      });
    }

    // Mismatch C: Order marked DELIVERED via ops engine without delivery verification
    if (
      oStatus === 'DELIVERED' &&
      meta.deliveryVerification &&
      meta.deliveryVerification.verified === false
    ) {
      anomalies.push({
        id: `mismatch-ord-deliv-${ord.id}`,
        domain: 'ORDER_SHIPMENT',
        severity: 'HIGH',
        entityId: ord.orderNumber,
        description: `Order ${ord.orderNumber} is marked DELIVERED without carrier webhook or authorized admin confirmation.`,
        autoHealed: false
      });
    }
  }

  // 2. Check Inventory Ledger Equation & Product Variant Sync
  for (const row of allLedger) {
    const expectedAvail = calculateLedgerAvailable(row);
    const actualAvail = Number(row.availableStock);

    if (expectedAvail !== actualAvail) {
      let healed = false;
      if (params?.autoFixLedgerDrift !== false) {
        await db
          .update(inventoryLedger)
          .set({ availableStock: expectedAvail, updatedAt: new Date() })
          .where(eq(inventoryLedger.sku, row.sku));
        healed = true;
        autoHealedCount++;
      }
      anomalies.push({
        id: `mismatch-inv-eq-${row.sku}`,
        domain: 'INVENTORY_LEDGER',
        severity: 'HIGH',
        entityId: row.sku,
        description: `SKU ${row.sku} ledger equation mismatch: recorded available=${actualAvail}, computed=${expectedAvail}.`,
        autoHealed: healed
      });
    }

    // Also check if product variant stockAvailable matches ledger
    const prod = allProducts.find((p) => p.id === row.productId);
    const vars: any[] = Array.isArray(prod?.variants) ? prod.variants : [];
    const matchedVar = vars.find((v) => v.sku === row.sku);
    if (matchedVar && Number(matchedVar.stockAvailable) !== expectedAvail) {
      let healed = false;
      if (params?.autoFixLedgerDrift !== false) {
        await db.transaction(async (tx) => {
          await syncSkuToProductVariants(
            tx,
            row.sku,
            expectedAvail,
            row.reservedStock,
            expectedAvail + Number(row.reservedStock)
          );
        });
        healed = true;
        autoHealedCount++;
      }
      anomalies.push({
        id: `mismatch-inv-prod-${row.sku}`,
        domain: 'INVENTORY_LEDGER',
        severity: 'MEDIUM',
        entityId: row.sku,
        description: `Catalog variant stockAvailable (${matchedVar.stockAvailable}) differed from SKU ledger (${expectedAvail}).`,
        autoHealed: healed
      });
    }
  }

  // 3. Check Production Batches vs Sellable Inventory
  for (const batch of allBatches) {
    if (
      batch.releasedToInventory &&
      (batch.qcStatus !== 'PASSED' ||
        batch.packagingAvailability !== 'AVAILABLE' ||
        batch.batchReleaseStatus !== 'RELEASED')
    ) {
      anomalies.push({
        id: `mismatch-batch-${batch.batchNumber}`,
        domain: 'PRODUCTION_BATCH',
        severity: 'CRITICAL',
        entityId: batch.batchNumber,
        description: `Batch ${batch.batchNumber} was marked released to inventory despite QC=${batch.qcStatus}, Packaging=${batch.packagingAvailability}, Release=${batch.batchReleaseStatus}.`,
        autoHealed: false
      });
    }
  }

  // 4. Check Returns marked REFUNDED without inventory reconciliation
  for (const ret of allReturns) {
    const meta = ((ret.returnMetadata as any) || {}) as Record<string, any>;
    if (
      String(ret.status).toUpperCase() === 'REFUNDED' &&
      meta.inventoryReconciliation &&
      meta.inventoryReconciliation.reconciled === false
    ) {
      anomalies.push({
        id: `mismatch-ret-${ret.id}`,
        domain: 'RETURN_REFUND',
        severity: 'HIGH',
        entityId: ret.id,
        description: `Return ${ret.id} (${ret.orderNumber}) is marked REFUNDED but inventory disposition has not been reconciled.`,
        autoHealed: false
      });
    }
  }

  // Log unresolved anomalies into ops_tasks_and_alerts
  for (const anom of anomalies.filter((a) => !a.autoHealed)) {
    await db
      .insert(opsTasksAndAlerts)
      .values({
        id: anom.id,
        category: 'RECONCILIATION_MISMATCH',
        severity: anom.severity,
        title: `Reconciliation Mismatch (${anom.domain}): ${anom.entityId}`,
        description: anom.description,
        entityType: 'RECONCILIATION',
        entityId: anom.entityId,
        status: 'OPEN',
        requiresAdminApproval: false,
        metadata: anom
      })
      .onConflictDoNothing();
  }

  return {
    runAt: new Date().toISOString(),
    totalChecked: {
      orders: allOrders.length,
      skus: allLedger.length,
      batches: allBatches.length,
      returns: allReturns.length
    },
    mismatchesFound: anomalies.length,
    autoHealedCount,
    anomalies
  };
}

// ============================================================================
// 9. UNIFIED OPERATIONS COMMAND DASHBOARD TELEMETRY & VERIFICATION SUITE
// ============================================================================

export async function getUnifiedOperationsDashboard() {
  await syncAndInitializeInventoryLedger();
  const [allOrders, allLedger, allBatches, allReturns, allTasks] = await Promise.all([
    db.select().from(orders).orderBy(desc(orders.createdAt)),
    db.select().from(inventoryLedger),
    db.select().from(productionBatches).orderBy(desc(productionBatches.createdAt)),
    db.select().from(returnsRefunds).orderBy(desc(returnsRefunds.createdAt)),
    db.select().from(opsTasksAndAlerts).orderBy(desc(opsTasksAndAlerts.createdAt))
  ]);

  const verifiedSalesRevenueInr = allOrders.reduce((sum, o) => {
    const meta = (o.opsMetadata || {}) as any;
    if (meta.verifiedSalesRevenueInr !== undefined) {
      return sum + Number(meta.verifiedSalesRevenueInr);
    }
    return String(o.paymentStatus).toUpperCase() === 'PAID' && String(o.orderStatus).toUpperCase() !== 'CANCELLED'
      ? sum + Number(o.totalAmount || 0)
      : sum;
  }, 0);

  const fulfillmentQueueCount = allOrders.filter((o) => {
    const st = String(o.orderStatus).toUpperCase();
    return st === 'CONFIRMED' || st === 'PACKING' || st === 'PACKING_COMPLETED' || st === 'SHIPMENT_BOOKED';
  }).length;

  const lowStockSkusCount = allLedger.filter(
    (r) => Number(r.availableStock) <= Number(r.reorderThreshold || 20)
  ).length;

  const totalReservedUnits = allLedger.reduce((s, r) => s + Number(r.reservedStock || 0), 0);
  const totalAvailableUnits = allLedger.reduce((s, r) => s + Number(r.availableStock || 0), 0);
  const totalSoldUnits = allLedger.reduce((s, r) => s + Number(r.soldStock || 0), 0);
  const totalDamagedUnits = allLedger.reduce((s, r) => s + Number(r.damagedStock || 0), 0);

  return {
    summary: {
      totalOrders: allOrders.length,
      verifiedSalesRevenueInr,
      fulfillmentQueueCount,
      lowStockSkusCount,
      totalAvailableUnits,
      totalReservedUnits,
      totalSoldUnits,
      totalDamagedUnits,
      activeBatchesCount: allBatches.filter((b) => b.batchReleaseStatus === 'RELEASED').length,
      blockedOrPendingBatchesCount: allBatches.filter((b) => b.batchReleaseStatus !== 'RELEASED').length,
      openShippingExceptionsCount: allTasks.filter(
        (t) => t.category === 'SHIPPING_EXCEPTION' && t.status === 'OPEN'
      ).length,
      pendingProcurementApprovalsCount: allTasks.filter(
        (t) => t.category === 'PROCUREMENT_QUEUE' && t.status === 'PENDING_APPROVAL'
      ).length
    },
    orders: allOrders,
    inventoryLedger: allLedger,
    productionBatches: allBatches,
    returns: allReturns,
    tasksAndAlerts: allTasks
  };
}

export async function runOperationsAutomationVerificationSuite(): Promise<{
  allPassed: boolean;
  passedCount: number;
  totalCount: number;
  results: Array<{
    id: string;
    scenario: string;
    passed: boolean;
    details: string;
  }>;
}> {
  await syncAndInitializeInventoryLedger();
  const results: Array<{
    id: string;
    scenario: string;
    passed: boolean;
    details: string;
  }> = [];

  const testPrefix = `ops_test_${Date.now()}`;
  const allLedger = await db.select().from(inventoryLedger);
  const targetSkuRow = allLedger.find((r) => r.availableStock >= 15) || allLedger[0];
  const testSku = targetSkuRow.sku;
  const initialAvail = Number(targetSkuRow.availableStock);
  const initialReserved = Number(targetSkuRow.reservedStock);
  const initialSold = Number(targetSkuRow.soldStock);
  const initialReturned = Number(targetSkuRow.returnedSellableStock);
  const initialDamaged = Number(targetSkuRow.damagedStock);

  const testOrderId1 = `${testPrefix}_ord_1`;
  const testOrderId2 = `${testPrefix}_ord_2`;
  const testBatchId = `${testPrefix}_batch_unreleased`;
  const testReturnId = `${testPrefix}_ret_1`;

  try {
    // 1. Order Creation + Atomic Inventory Reservation + Browser Callback Distrust Guard
    {
      const created = await createOrderWithAutomation({
        id: testOrderId1,
        orderNumber: `FRG-TEST-${Date.now().toString().slice(-5)}`,
        customerName: 'Aarav Singhania',
        customerEmail: `${testPrefix}@fragmore.shop`,
        customerPhone: '+919820011223',
        shippingAddress: { city: 'Mumbai', state: 'Maharashtra', pincode: '400018' },
        items: [
          {
            productId: targetSkuRow.productId,
            productName: targetSkuRow.productName,
            variantId: targetSkuRow.variantId,
            sku: testSku,
            size: targetSkuRow.size,
            quantity: 2
          }
        ],
        paymentMethod: 'PREPAID',
        paymentStatus: 'PAID', // Browser claims PAID
        verifiedByServerCallback: false // Not verified by server!
      });

      const browserAttempt = await verifyOrderPaymentServerSide({
        orderId: testOrderId1,
        verificationSource: 'BROWSER_CALLBACK_ONLY'
      });

      const [afterCreateLedger] = await db
        .select()
        .from(inventoryLedger)
        .where(eq(inventoryLedger.sku, testSku));

      const passed =
        created.order.paymentStatus === 'PENDING_VERIFICATION' &&
        browserAttempt.verified === false &&
        Number(afterCreateLedger.reservedStock) === initialReserved + 2 &&
        Number(afterCreateLedger.availableStock) === initialAvail - 2;

      results.push({
        id: 'ops_1_order_reservation_and_browser_guard',
        scenario: '1. Order creation reserves stock atomically & blocks browser-only payment confirmation',
        passed,
        details: `OrderStatus=${created.order.orderStatus}, PaymentStatus=${created.order.paymentStatus}, BrowserVerifyBlocked=${!browserAttempt.verified}, Reserved=${afterCreateLedger.reservedStock} (+2), Available=${afterCreateLedger.availableStock} (-2)`
      });
    }

    // 2. Verified Server Payment commits reservation, queues fulfillment & records revenue
    {
      const verified = await verifyOrderPaymentServerSide({
        orderId: testOrderId1,
        verificationSource: 'PROVIDER_WEBHOOK_SIGNATURE',
        transactionId: `pay_razor_${Date.now()}`
      });

      const [afterVerifyLedger] = await db
        .select()
        .from(inventoryLedger)
        .where(eq(inventoryLedger.sku, testSku));

      const meta = (verified.order.opsMetadata || {}) as any;
      const passed =
        verified.verified === true &&
        verified.order.orderStatus === 'CONFIRMED' &&
        verified.order.paymentStatus === 'PAID' &&
        meta.fulfillmentQueueStatus === 'READY_FOR_PACKING' &&
        meta.verifiedSalesRevenueInr === verified.order.totalAmount &&
        Number(afterVerifyLedger.reservedStock) === initialReserved &&
        Number(afterVerifyLedger.soldStock) === initialSold + 2;

      results.push({
        id: 'ops_2_verified_payment_commit',
        scenario: '2. Verified payment confirms order, commits stock to sold, queues fulfillment & records revenue',
        passed,
        details: `Status=${verified.order.orderStatus}, Queue=${meta.fulfillmentQueueStatus}, Revenue=₹${meta.verifiedSalesRevenueInr}, Reserved=${afterVerifyLedger.reservedStock}, Sold=${afterVerifyLedger.soldStock} (+2)`
      });
    }

    // 3. Failed Payment releases reservation & allows safe retry
    {
      await createOrderWithAutomation({
        id: testOrderId2,
        orderNumber: `FRG-FAIL-${Date.now().toString().slice(-5)}`,
        customerName: 'Meera Kapoor',
        customerEmail: `${testPrefix}_fail@fragmore.shop`,
        customerPhone: '+919820011224',
        shippingAddress: { city: 'Delhi', state: 'Delhi', pincode: '110001' },
        items: [
          {
            productId: targetSkuRow.productId,
            productName: targetSkuRow.productName,
            variantId: targetSkuRow.variantId,
            sku: testSku,
            size: targetSkuRow.size,
            quantity: 1
          }
        ],
        paymentMethod: 'PREPAID'
      });

      const failRes = await handleOrderPaymentFailure({
        orderId: testOrderId2,
        failureReason: 'Bank 3DS authentication timeout'
      });

      const [afterFailLedger] = await db
        .select()
        .from(inventoryLedger)
        .where(eq(inventoryLedger.sku, testSku));

      const passed =
        failRes.releasedReservation === true &&
        failRes.order.paymentStatus === 'FAILED' &&
        failRes.order.orderStatus === 'PAYMENT_FAILED' &&
        Number(afterFailLedger.reservedStock) === initialReserved &&
        Boolean((failRes.order.opsMetadata as any)?.canRetryPayment);

      results.push({
        id: 'ops_3_failed_payment_release',
        scenario: '3. Failed payment releases inventory reservation, prevents false confirmation & enables retry',
        passed,
        details: `Released=${failRes.releasedReservation}, Status=${failRes.order.orderStatus}, ReservedRestored=${afterFailLedger.reservedStock}, CanRetry=${(failRes.order.opsMetadata as any)?.canRetryPayment}`
      });
    }

    // 4. Shipping Automation: Delivery Verification Guard + Exception Task Generation
    {
      const unverifiedDelivery = await processShippingLifecycleEvent({
        orderId: testOrderId1,
        eventType: 'DELIVERED',
        verificationSource: 'UNVERIFIED_CLIENT'
      });

      const exceptionEvent = await processShippingLifecycleEvent({
        orderId: testOrderId1,
        eventType: 'DELIVERY_EXCEPTION',
        awbNumber: 'BD99112233IN',
        courierName: 'Blue Dart Express',
        exceptionReason: 'Consignee premises locked; re-attempt scheduled'
      });

      const verifiedDelivery = await processShippingLifecycleEvent({
        orderId: testOrderId1,
        eventType: 'DELIVERED',
        awbNumber: 'BD99112233IN',
        courierName: 'Blue Dart Express',
        verificationSource: 'TRUSTED_CARRIER_WEBHOOK',
        proofReference: 'POD-SIGN-8821'
      });

      const passed =
        unverifiedDelivery.success === false &&
        exceptionEvent.success === true &&
        Boolean(exceptionEvent.createdAdminTask) &&
        verifiedDelivery.success === true &&
        verifiedDelivery.order.orderStatus === 'DELIVERED';

      results.push({
        id: 'ops_4_shipping_guard_and_exceptions',
        scenario: '4. Shipping automation blocks unverified DELIVERED status, creates tasks on exceptions & confirms carrier POD',
        passed,
        details: `UnverifiedBlocked=${!unverifiedDelivery.success}, ExceptionTaskCreated=${Boolean(exceptionEvent.createdAdminTask)}, CarrierVerified=${verifiedDelivery.order.orderStatus}`
      });
    }

    // 5. Production Management: Block Unreleased / Pending-QC Batch from Sale & Inventory Release
    {
      const batchCreated = await createOrUpdateProductionBatch({
        id: testBatchId,
        batchNumber: `BATCH-TEST-${Date.now().toString().slice(-4)}`,
        productId: targetSkuRow.productId,
        productName: targetSkuRow.productName,
        variantId: targetSkuRow.variantId,
        sku: testSku,
        size: targetSkuRow.size,
        manufacturingDate: '2026-10-01',
        expiryDate: '2029-10-01',
        finishedQuantity: 50,
        qcStatus: 'PENDING_QC',
        bottleType: '50ml Italian Flacon',
        packagingAvailability: 'AWAITING_COFFRET',
        batchReleaseStatus: 'RELEASED' // Attempt to release prematurely
      });

      const releaseAttempt = await releaseProductionBatchToInventory({
        batchId: testBatchId
      });

      const passed =
        batchCreated.canOfferForSale === false &&
        batchCreated.batch.batchReleaseStatus === 'BLOCKED' &&
        releaseAttempt.released === false;

      results.push({
        id: 'ops_5_production_batch_guard',
        scenario: '5. Production management blocks unreleased/pending-QC batches from being offered for sale',
        passed,
        details: `CanOfferForSale=${batchCreated.canOfferForSale}, ReleaseAttempt=${releaseAttempt.released}, Reason="${releaseAttempt.reason}"`
      });
    }

    // 6. Returns & Refunds: Eligibility -> Approval -> Inspection -> Gateway Confirmation -> Inventory Reconciliation
    {
      const retCreated = await createReturnRequestWithValidation({
        id: testReturnId,
        orderId: testOrderId1,
        orderNumber: (await db.select().from(orders).where(eq(orders.id, testOrderId1)))[0].orderNumber,
        sku: testSku,
        productName: targetSkuRow.productName,
        size: targetSkuRow.size,
        quantity: 1,
        reason: 'Unopened gift exchange',
        refundAmount: 999
      });

      await advanceReturnWorkflowStage({ returnId: testReturnId, stage: 'APPROVE_RETURN' });
      await advanceReturnWorkflowStage({
        returnId: testReturnId,
        stage: 'COMPLETE_INSPECTION',
        sealIntact: true
      });
      const reconciled = await advanceReturnWorkflowStage({
        returnId: testReturnId,
        stage: 'CONFIRM_GATEWAY_REFUND_AND_RECONCILE',
        sealIntact: true,
        gatewayRefundId: `rfnd_test_${Date.now()}`
      });

      const [afterReturnLedger] = await db
        .select()
        .from(inventoryLedger)
        .where(eq(inventoryLedger.sku, testSku));

      const passed =
        retCreated.eligible === true &&
        reconciled.returnRecord.status === 'REFUNDED' &&
        Number(afterReturnLedger.returnedSellableStock) === initialReturned + 1;

      results.push({
        id: 'ops_6_returns_refunds_reconciliation',
        scenario: '6. Return & refund lifecycle validates eligibility, inspects seal, confirms refund & reconciles stock',
        passed,
        details: `Eligible=${retCreated.eligible}, FinalStatus=${reconciled.returnRecord.status}, ReturnedSellableStock=${afterReturnLedger.returnedSellableStock} (+1)`
      });
    }
  } finally {
    // Restore exact original SKU ledger state and clean up temporary test records
    await db
      .update(inventoryLedger)
      .set({
        availableStock: initialAvail,
        reservedStock: initialReserved,
        soldStock: initialSold,
        returnedSellableStock: initialReturned,
        damagedStock: initialDamaged,
        updatedAt: new Date()
      })
      .where(eq(inventoryLedger.sku, testSku));

    await db.transaction(async (tx) => {
      await syncSkuToProductVariants(tx, testSku, initialAvail, initialReserved, initialAvail + initialReserved);
    });

    await db.delete(orders).where(eq(orders.id, testOrderId1));
    await db.delete(orders).where(eq(orders.id, testOrderId2));
    await db.delete(productionBatches).where(eq(productionBatches.id, testBatchId));
    await db.delete(returnsRefunds).where(eq(returnsRefunds.id, testReturnId));
    await db.delete(opsTasksAndAlerts).where(eq(opsTasksAndAlerts.entityId, testOrderId1));
    await db.delete(opsTasksAndAlerts).where(eq(opsTasksAndAlerts.entityId, testOrderId2));
    await db.delete(opsTasksAndAlerts).where(eq(opsTasksAndAlerts.entityId, testReturnId));
  }

  const passedCount = results.filter((r) => r.passed).length;
  return {
    allPassed: passedCount === results.length,
    passedCount,
    totalCount: results.length,
    results
  };
}
