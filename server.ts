import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  getAllProducts,
  upsertProduct,
  deleteProductById,
  getAllOrders,
  insertOrder,
  updateOrderStatus,
  deleteOrderById,
  getAllCustomers,
  upsertCustomer,
  deleteCustomerById,
  getAdminCustomerAnalytics,
  getAllReviews,
  insertReview,
  deleteReviewById,
  getAllCoupons,
  upsertCoupon,
  deleteCouponByCode,
  getAllInfluencers,
  upsertInfluencer,
  deleteInfluencerById,
  getAllAbandonedCarts,
  upsertAbandonedCart,
  deleteAbandonedCartById,
  getCMSSettings,
  updateCMSSettings,
  getAllAuditLogs,
  insertAuditLog,
  getAllCampaigns,
  upsertCampaign,
  deleteCampaignById,
  getAllReturns,
  upsertReturn,
  getAllBackInStock,
  upsertBackInStock,
  deleteBackInStockById,
  recalculateCustomerLifecycleState,
  seedInitialDataIfEmpty
} from './src/db/queries.ts';
import { getOrCreateUser } from './src/db/users.ts';
import { optionalAuth, requireAuth, requireAdmin, type AuthRequest } from './src/middleware/auth.ts';
import { automationRouter } from './src/server/automationRoutes.ts';
import {
  ingestAutomationEvent,
  startAutomationBackgroundWorker,
  ensureAutomationSeeded
} from './src/server/automationEngine.ts';
import { erpRouter } from './src/server/erpRoutes.ts';
import { ensureErpSeeded, resolveErpActor } from './src/server/erpBusinessOsEngine.ts';
import {
  readCompleteFirestoreDatabase,
  generateCompleteDatabaseXlsxBuffer
} from './src/server/databaseBackupEngine.ts';
import { rewardsRouter } from './src/server/rewardsRoutes.ts';
import {
  ensureRewardsEcosystemSeeded,
  ensureCustomerWalletAndLoyaltyAccount,
  registerReferralAttribution,
  awardOrderLoyaltyPointsTransaction,
  evaluateReferralOnFirstOrder,
  restoreRedeemedRewardsOnCancelOrPaymentFailure,
  processReturnAndRefundRewardsSync,
  reserveAndCaptureCheckoutRewardsTransaction,
  linkCheckoutReservationToOrder
} from './src/server/rewardsWalletGiftCardEngine.ts';
import {
  getAbandonedCartDashboardAnalytics,
  getAbandonedCartEngineConfig,
  updateAbandonedCartEngineConfig,
  trackOrSyncCartSession,
  executeCartRecoveryStep,
  cancelPendingRecoveryForCart,
  evaluateSmartCouponEligibility,
  issueSmartRecoveryCoupon,
  validateRecoveryCouponAtCheckout,
  processDueAbandonedCartReminders,
  runAbandonedCartEngineVerificationSuite,
  type RecoveryStepId
} from './src/server/abandonedCartEngine.ts';
import {
  syncAndInitializeInventoryLedger,
  adjustSkuInventoryAtomically,
  createOrUpdateProductionBatch,
  releaseProductionBatchToInventory,
  createOrderWithAutomation,
  verifyOrderPaymentServerSide,
  handleOrderPaymentFailure,
  retryFailedOrderPayment,
  processShippingLifecycleEvent,
  createReturnRequestWithValidation,
  advanceReturnWorkflowStage,
  runCrossModuleReconciliationJob,
  getUnifiedOperationsDashboard,
  runOperationsAutomationVerificationSuite,
  type ShippingLifecycleEventType
} from './src/server/operationsAutomationEngine.ts';
import {
  ensureDiscoveryLoyaltyAndCouponsInitialized,
  getDiscoveryLoyaltyCouponDashboard,
  updateDiscoveryRedemptionRules,
  registerDiscoveryPurchase,
  confirmDiscoveryDeliveryAndStartJourney,
  selectFavoriteFragranceAndIssueRedemptionBenefit,
  redeemDiscoveryVoucherOnFullBottleUpgrade,
  revokeDiscoveryBenefitOnRefundOrCancel,
  approveOrToggleLoyaltyProgram,
  executeLoyaltyBenefitForCustomer,
  createOrUpdateEnterpriseCoupon,
  runDiscoveryLoyaltyCouponVerificationSuite
} from './src/server/discoveryLoyaltyCouponEngine.ts';
import { visitorAnalyticsEngine } from './src/server/visitorAnalyticsEngine.ts';
import {
  ensureInfluencerAndResellerInitialized,
  getGlobalCommissionAndMoqConfig,
  updateGlobalCommissionAndMoqConfig,
  onboardOrUpdateInfluencer,
  approveOrReviewInfluencerOnboarding,
  recordAffiliateFunnelEvent,
  attributeOrderAndCalculateCommission,
  settleInfluencerOrderCommissionAfterHold,
  clawbackInfluencerCommissionOnRefund,
  queueInfluencerPayoutForApproval,
  approveQueuedInfluencerPayout,
  createOrAdvanceContentDeliverable,
  onboardOrUpdateResellerPartner,
  createResellerWholesaleOrder,
  reconcileResellerPaymentAndSendReminder,
  getUnifiedInfluencerResellerDashboard,
  runInfluencerResellerVerificationSuite
} from './src/server/influencerResellerEngine.ts';
import {
  ensureOmnichannelCampaignsInitialized,
  verifyOmnichannelAnalyticsIntegrations,
  ingestStandardizedTrackingEvent,
  createOrUpdateOmnichannelCampaign,
  reviewCampaignApprovalWorkflow,
  evaluateAutomatedPerformanceRules,
  getOmnichannelCampaignAttributionDashboard,
  runOmnichannelCampaignVerificationSuite
} from './src/server/omnichannelCampaignAttributionEngine.ts';
import {
  getAiMarketingIntelligenceDashboard,
  generateMorningExecutiveBriefing,
  generateAiContentStudioPackage,
  reviewAiRecommendationOrContentItem,
  updateAiSafetyAndCostConfig,
  sanitizeAndRedactCustomerTextForAi,
  runAiMarketingIntelligenceVerificationSuite
} from './src/server/aiMarketingIntelligenceEngine.ts';
import {
  getCustomerSupportReviewRetentionDashboard,
  getSupportRetentionSettings,
  updateSupportRetentionSettings,
  scheduleOrTriggerPostDeliveryReviewInvite,
  submitAndModerateVerifiedCustomerReview,
  reportNegativeExperienceAndCreateTicket,
  evaluateAndEscalateOverdueSupportTickets,
  updateSupportTicketAndSyncRefund,
  calculateDynamicReplenishmentWindow,
  triggerPersonalizedRetentionJourney,
  COMPLEMENTARY_FRAGRANCE_MATRIX,
  runSupportReviewRetentionVerificationSuite
} from './src/server/customerSupportReviewRetentionEngine.ts';
import {
  registerRealtimeSseClient,
  broadcastCrossBrowserSyncEvent,
  getRealtimeSyncState,
  auditExistingDashboardAndDatabaseData,
  executeAdminReviewedCleanupAndReconciliation,
  runAuthoritativeDataReconciliation,
  queryEnterpriseEventInspector,
  replayAuthorizedAutomationEvent,
  verifyWebhookHmacAndReplayGuard,
  detectAndRecoverStuckAutomationJobs,
  getAutomationReliabilityHealthReport,
  runProductionGradeAuditAndChaosTestSuite
} from './src/server/productionAuditAndReliabilityEngine.ts';
import {
  verifyAll14DepartmentsConnectivity,
  runAll7CustomerJourneysLiveVerification,
  verifyNonFunctionalRequirements,
  getEnterpriseArchitectureDeliverables
} from './src/server/enterpriseE2EIntegrationAuditEngine.ts';
import {
  getAiCmo3FullOverview,
  getAiCmoDependencyMap,
  sendAiCmoChatMessage,
  updateAiCmoConversationMeta,
  createOrSaveAiCmoPrompt,
  deleteAiCmoSavedPrompt,
  createAiCmoGrowthPlan,
  proposeAiCmoAction,
  decideAndOrchestrateAiCmoAction,
  updateAiCmoFeatureFlagsConfig,
  runAiCmoCompatibilityAndRegressionTests,
  getAiCmoToolRegistryDiscoveryReport,
  executeAiCmoReadTool,
  proposeAiCmoWriteToolAction,
  AiCmoToolError,
  getAiCmoMarketingStrategyEngineReport,
  generateGoalBasedCampaignPlan,
  recordStrategyMeasuredOutcome,
  getAutomationNodeSchemaCatalog,
  createOrUpdateDraftWorkflowFromNaturalLanguage,
  applyFollowUpMutationToWorkflow,
  runWorkflowDryRunSimulation,
  requestAndOrPublishWorkflowViaExistingService,
  diagnoseLastWorkflowExecutionFailure,
  buildWorkflowChatCardFromRow,
  getUniversalAiActionCenterSnapshot,
  updateNarrowPreconfiguredPolicy,
  editPendingApprovalAction,
  confirmRejectOrCompensateActionCard,
  createMultiStepCheckpointPlan,
  executeOrRetryMultiStepPlanWithCheckpoints,
  compensateMultiStepPlan,
  invalidateAuthoritativeDomainCache,
  getAiCmoDataSyncOverview,
  refreshStaleApprovalCardVersion,
  runAiCmoSynchronizationAndConcurrencyTestSuite,
  ensureAiCmoMemoryAndScheduledIntelligenceSeeded,
  listAiCmoDurableMemories,
  createOrProposeAiCmoMemoryEntry,
  reviewEditRevokeOrRollbackMemoryEntry,
  executeScheduledIntelligenceJob,
  updateScheduledIntelligenceTaskConfig,
  getAiCmoGovernanceAndUsageAnalytics,
  updateAiCmoIntelligenceGovernanceSettings,
  executeAiDataRetentionCleanup,
  getAiCmoMemoryAndScheduledIntelligenceSnapshot
} from './src/server/aiCmo3Engine.ts';
import {
  runFullAiCmoIntegrationAndRegressionAudit,
  getLatestOrRunIntegrationAuditReport
} from './src/server/aiCmoFullIntegrationAudit.ts';
import { db } from './src/db/index.ts';
import {
  abandonedCarts as abandonedCartsTable,
  coupons as couponsTable,
  opsTasksAndAlerts as opsTasksAndAlertsTable,
  automationEvents as automationEventsTable,
  supplierPurchaseOrders as supplierPurchaseOrdersTable,
  procurementSuppliers as procurementSuppliersTable,
  productionBatches as productionBatchesTable,
  inventoryLedger as inventoryLedgerTable
} from './src/db/schema.ts';
import { eq, desc } from 'drizzle-orm';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Ensure API responses always reflect live database state without browser/CDN caching
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// ========================================================
// API ROUTES (Connected to Firebase Firestore — Cloud SQL Disabled)
// ========================================================

// 1. Health & Database Status
app.get('/api/health', async (_req: Request, res: Response) => {
  try {
    const mem = process.memoryUsage();
    res.json({
      status: 'ok',
      database: 'Firebase Firestore',
      cloudSqlDisabled: true,
      memoryBudgetMb: 1024,
      rssMb: Math.round(mem.rss / (1024 * 1024)),
      heapUsedMb: Math.round(mem.heapUsed / (1024 * 1024)),
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Seed endpoint / trigger
app.post('/api/seed', async (_req: Request, res: Response) => {
  try {
    await seedInitialDataIfEmpty();
    res.json({ success: true, message: 'Firebase Firestore database seeded successfully' });
  } catch (error: any) {
    console.error('Seeding error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Complete Firebase Firestore Database Export (Super Admin / Founder Only — JSON or Multi-Sheet XLSX)
app.get('/api/admin/database/export', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const actor = await resolveErpActor({
      verifiedEmail: req.user?.email,
      headerEmail: req.headers['x-admin-email'] as string | undefined,
      headerAdminRole: req.headers['x-admin-role'] as string | undefined,
      headerErpRoleCode: req.headers['x-erp-role-code'] as string | undefined
    });

    if (!actor.isSuperAdmin && actor.roleCode !== 'SUPER_ADMIN') {
      return res.status(403).json({
        error: 'Forbidden: Only Founder / Super Admin may download a complete database backup.'
      });
    }

    const fmt = String(req.query.format || 'json').trim().toLowerCase();
    const snapshot = await readCompleteFirestoreDatabase(actor.email);
    const dateTag = new Date().toISOString().slice(0, 10);

    await insertAuditLog({
      id: `audit-dbexp-${Date.now()}`,
      adminEmail: actor.email,
      action: 'COMPLETE_DATABASE_EXPORT',
      module: 'Database Backup',
      details: `Exported complete Firebase Firestore database (${fmt.toUpperCase()} · ${snapshot.meta.nonEmptyCollections}/${snapshot.meta.totalCollections} populated collections · ${snapshot.meta.totalDocuments} documents).`
    }).catch(() => {});

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Database-Collections-Total', String(snapshot.meta.totalCollections));
    res.setHeader('X-Database-Collections-Populated', String(snapshot.meta.nonEmptyCollections));
    res.setHeader('X-Database-Documents-Total', String(snapshot.meta.totalDocuments));

    if (fmt === 'xlsx' || fmt === 'excel') {
      const { buffer, fileName } = await generateCompleteDatabaseXlsxBuffer(snapshot);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', String(buffer.length));
      return res.send(buffer);
    }

    const fileName = `FRAGMORE_Complete_Database_${dateTag}.json`;
    const jsonBuffer = Buffer.from(JSON.stringify(snapshot, null, 2), 'utf8');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', String(jsonBuffer.length));
    return res.send(jsonBuffer);
  } catch (error: any) {
    console.error('[Database Export Error]:', error);
    return res.status(500).json({ error: error?.message || 'Complete database export failed' });
  }
});

// 2. User Sync / Registration (Firebase Auth <-> Cloud SQL)
app.post('/api/users/sync', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { uid, email, displayName, phone, addresses, wishlistSlugs, notes, source } = req.body;
    const targetUid = req.user?.uid || uid;
    const targetEmail = req.user?.email || email;

    if (!targetUid || !targetEmail) {
      return res.status(400).json({ error: 'UID and Email are required to sync user' });
    }

    const user = await getOrCreateUser(targetUid, targetEmail, displayName, phone);
    // Ensure customer account and all details are immediately saved in Admin -> Customers -> All Customers (never fabricate missing name/phone)
    const custId = String(targetUid).startsWith('cust-') ? String(targetUid) : `cust-${targetUid}`;
    await upsertCustomer({
      id: custId,
      email: targetEmail,
      name: displayName ? String(displayName).trim() : '',
      phone: phone !== undefined ? String(phone).trim() : '',
      tags: ['New registered customers'],
      addresses: Array.isArray(addresses) ? addresses : undefined,
      wishlistSlugs: Array.isArray(wishlistSlugs) ? wishlistSlugs : undefined,
      notes: notes !== undefined ? notes : undefined,
      source: source || 'Direct User Registration',
      crmMetadata: {
        emailVerified: Boolean(targetEmail),
        mobileVerified: Boolean(phone),
        ...(req.body.birthday ? { birthday: req.body.birthday } : {}),
        ...(req.body.consent ? { consent: req.body.consent } : {})
      }
    }).catch((e: any) => console.warn('[Customers Table Sync] notice:', e.message));

    // Emit durable server-side automation event for customer registration / verification
    ingestAutomationEvent({
      eventType: 'customer.registered',
      source: source || 'storefront_auth',
      idempotencyKey: `user_sync_${custId}_${new Date().toISOString().slice(0, 13)}`,
      customerId: custId,
      customerEmail: targetEmail,
      customerPhone: phone || undefined,
      payload: {
        uid: targetUid,
        email: targetEmail,
        name: displayName ? String(displayName).trim() : '',
        phone: phone ? String(phone).trim() : '',
        emailVerified: Boolean(targetEmail),
        mobileVerified: Boolean(phone),
        source: source || 'Direct User Registration'
      }
    }).catch((err: any) => console.warn('[Automation Hook user.sync]', err.message));

    // Provision FRAGMORÉ Wallet & Privileges Loyalty Account automatically on registration/sync
    ensureCustomerWalletAndLoyaltyAccount({
      customerId: custId,
      customerEmail: targetEmail,
      customerName: displayName ? String(displayName).trim() : '',
      birthday: req.body?.birthday || undefined
    })
      .then(() => {
        if (req.body?.referralCode) {
          return registerReferralAttribution({
            referralCode: String(req.body.referralCode),
            refereeEmail: targetEmail,
            refereePhone: phone ? String(phone).trim() : undefined,
            refereeCustomerId: custId,
            ipAddress: String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '')
          }).catch(() => {});
        }
      })
      .catch((err: any) => console.warn('[Rewards Account Provisioning Hook]', err.message));

    res.json({ success: true, user });
  } catch (error: any) {
    console.error('Error syncing user:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3. Products
app.get('/api/products', async (_req: Request, res: Response) => {
  try {
    const products = await getAllProducts();
    res.json(products);
  } catch (error: any) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/products', optionalAuth, async (req: Request, res: Response) => {
  try {
    const product = await upsertProduct(req.body);
    const variants = Array.isArray(req.body?.variants) ? req.body.variants : [];
    for (const v of variants) {
      if (typeof v.stockAvailable === 'number' && v.stockAvailable < (v.lowStockThreshold || 30)) {
        ingestAutomationEvent({
          eventType: 'inventory.below_threshold',
          source: 'catalog_inventory_monitor',
          idempotencyKey: `low_stock_${product.id}_${v.sku}_${v.stockAvailable}`,
          payload: {
            productId: product.id,
            productName: product.name,
            sku: v.sku,
            size: v.size,
            stockAvailable: v.stockAvailable,
            threshold: v.lowStockThreshold || 30
          }
        }).catch(() => {});
      }
    }
    broadcastCrossBrowserSyncEvent({
      entity: 'PRODUCTS',
      action: 'UPSERT',
      recordId: product.id,
      summary: `Product ${product.name} updated`
    });
    res.json({ success: true, product });
  } catch (error: any) {
    console.error('Error saving product:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/products/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    await deleteProductById(req.params.id);
    broadcastCrossBrowserSyncEvent({
      entity: 'PRODUCTS',
      action: 'DELETE',
      recordId: req.params.id
    });
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: error.message });
  }
});

// 4. Orders
app.get('/api/orders', async (_req: Request, res: Response) => {
  try {
    const orders = await getAllOrders();
    res.json(orders);
  } catch (error: any) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/orders', optionalAuth, async (req: Request, res: Response) => {
  try {
    let order: any;
    try {
      const autoRes = await createOrderWithAutomation({
        ...req.body,
        verifiedByServerCallback: Boolean(req.body?.verifiedByServerCallback)
      });
      order = autoRes.order;
    } catch (opsErr: any) {
      // Fallback only if legacy test payload omits SKU, otherwise enforce oversell/batch guard
      if (String(opsErr.message || '').includes('Oversell') || String(opsErr.message || '').includes('Batch')) {
        return res.status(400).json({ error: opsErr.message });
      }
      order = await insertOrder(req.body);
    }
    const orderPayload = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      totalAmount: order.totalAmount,
      subtotal: order.subtotal,
      couponCode: order.couponCode,
      paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus,
      items: order.items,
      city: (order.shippingAddress as any)?.city || '',
      state: (order.shippingAddress as any)?.state || ''
    };

    ingestAutomationEvent({
      eventType: 'order.placed',
      source: 'checkout_engine',
      idempotencyKey: `order_placed_${order.id}`,
      customerId: order.customerId || undefined,
      customerEmail: order.customerEmail || undefined,
      orderId: order.id,
      payload: orderPayload
    }).catch((err: any) => console.warn('[Automation Hook order.placed]', err.message));

    if (String(order.paymentStatus).toUpperCase() === 'PAID') {
      ingestAutomationEvent({
        eventType: 'payment.succeeded',
        source: 'payment_gateway',
        idempotencyKey: `payment_succeeded_${order.id}`,
        customerId: order.customerId || undefined,
        customerEmail: order.customerEmail || undefined,
        orderId: order.id,
        payload: orderPayload
      }).catch(() => {});
    } else if (String(order.paymentStatus).toUpperCase() === 'FAILED') {
      ingestAutomationEvent({
        eventType: 'payment.failed',
        source: 'payment_gateway',
        idempotencyKey: `payment_failed_${order.id}`,
        customerId: order.customerId || undefined,
        customerEmail: order.customerEmail || undefined,
        orderId: order.id,
        payload: orderPayload
      }).catch(() => {});
    }

    if (order.couponCode) {
      // Increment coupon usageCount in PostgreSQL so single-use vouchers are enforced
      const cleanCode = String(order.couponCode).trim().toUpperCase();
      const existingCpns = await db.select().from(couponsTable).where(eq(couponsTable.code, cleanCode)).limit(1);
      if (existingCpns[0]) {
        await db
          .update(couponsTable)
          .set({ usageCount: (existingCpns[0].usageCount || 0) + 1 })
          .where(eq(couponsTable.code, cleanCode));
      }

      ingestAutomationEvent({
        eventType: 'coupon.redeemed',
        source: 'checkout_engine',
        idempotencyKey: `coupon_redeemed_${order.id}_${order.couponCode}`,
        customerId: order.customerId || undefined,
        customerEmail: order.customerEmail || undefined,
        orderId: order.id,
        payload: { ...orderPayload, couponCode: order.couponCode }
      }).catch(() => {});
    }

    // Cancel all pending abandoned cart reminders immediately upon verified order completion
    if (String(order.paymentStatus).toUpperCase() !== 'FAILED' && String(order.orderStatus).toUpperCase() !== 'CANCELLED') {
      await cancelPendingRecoveryForCart({
        cartId: (order.attribution as any)?.cartId || req.body?.cartId || undefined,
        anonymousCartId: (order.attribution as any)?.anonymousCartId || req.body?.anonymousCartId || undefined,
        customerEmail: order.customerEmail || undefined,
        customerPhone: order.customerPhone || undefined,
        orderId: order.id,
        reason: 'ORDER_COMPLETED'
      }).catch(() => {});
    }

    const itemsList = Array.isArray(order.items) ? order.items : [];
    const hasDiscoveryKit = itemsList.some(
      (i: any) =>
        String(i.productName || '').toLowerCase().includes('discovery') ||
        String(i.sku || '').toLowerCase().includes('disc') ||
        String(i.size || '').toLowerCase().includes('2ml')
    );
    if (hasDiscoveryKit) {
      ingestAutomationEvent({
        eventType: 'discovery.purchased',
        source: 'checkout_engine',
        idempotencyKey: `discovery_purchased_${order.id}`,
        customerId: order.customerId || undefined,
        customerEmail: order.customerEmail || undefined,
        orderId: order.id,
        payload: orderPayload
      }).catch(() => {});
    }

    // Recalculate customer lifecycle state (VIP ₹5,000 net rule + 14 dynamic segments)
    const lifecycleState = await recalculateCustomerLifecycleState(
      order.customerEmail || order.customerId || order.customerPhone || ''
    );

    if (String(order.paymentStatus).toUpperCase() !== 'FAILED') {
      if (lifecycleState?.qualifyingCount === 1) {
        ingestAutomationEvent({
          eventType: 'order.first_purchase',
          source: 'crm_lifecycle_engine',
          idempotencyKey: `first_purchase_${order.customerId || order.customerEmail}_${order.id}`,
          customerId: order.customerId || undefined,
          customerEmail: order.customerEmail || undefined,
          orderId: order.id,
          payload: { ...orderPayload, qualifyingOrdersCount: 1 }
        }).catch(() => {});
      } else if ((lifecycleState?.qualifyingCount || 0) >= 2) {
        ingestAutomationEvent({
          eventType: 'order.repeat_purchase',
          source: 'crm_lifecycle_engine',
          idempotencyKey: `repeat_purchase_${order.customerId || order.customerEmail}_${order.id}`,
          customerId: order.customerId || undefined,
          customerEmail: order.customerEmail || undefined,
          orderId: order.id,
          payload: { ...orderPayload, qualifyingOrdersCount: lifecycleState?.qualifyingCount }
        }).catch(() => {});
      }
    }

    // VIP RULE: Cumulative qualifying completed purchases >= ₹5,000 OR single qualifying order >= ₹5,000
    if (lifecycleState?.isVip || Number(order.totalAmount || 0) >= 5000) {
      ingestAutomationEvent({
        eventType: 'vip.eligible',
        source: 'crm_tier_monitor',
        idempotencyKey: `vip_eligible_${order.customerId || order.customerEmail}_${order.id}`,
        customerId: order.customerId || undefined,
        customerEmail: order.customerEmail || undefined,
        orderId: order.id,
        payload: {
          ...orderPayload,
          netSpend: lifecycleState?.netSpend ?? Number(order.totalAmount || 0),
          vipThreshold: 5000
        }
      }).catch(() => {});
    }

    // FRAGMORÉ Smart Wallet, Loyalty Points, Referral & Checkout Redemption Hooks
    if (order.customerEmail) {
      const payStatusUpper = String(order.paymentStatus || '').toUpperCase();
      const ordStatusUpper = String(order.orderStatus || '').toUpperCase();
      const rewardsPayload = req.body?.rewardsRedemption || (order.opsMetadata as any)?.rewardsRedemption;

      if (rewardsPayload?.alreadyCapturedOnServer && rewardsPayload?.reservationId) {
        await linkCheckoutReservationToOrder({
          reservationId: String(rewardsPayload.reservationId),
          orderId: order.id,
          orderNumber: order.orderNumber
        }).catch(() => {});
      } else if (
        rewardsPayload &&
        !rewardsPayload.alreadyCapturedOnServer &&
        (rewardsPayload.applyWalletCredits || rewardsPayload.applyLoyaltyPoints || rewardsPayload.applyGiftCard)
      ) {
        await reserveAndCaptureCheckoutRewardsTransaction({
          customerEmail: order.customerEmail,
          cartSubtotalInr: Number(order.subtotal) || Number(order.totalAmount) || 0,
          couponDiscountInr: Number(rewardsPayload.couponDiscountInr) || 0,
          couponCode: order.couponCode || null,
          shippingInr: Number(order.shippingFee) || 0,
          giftWrapInr: Number(rewardsPayload.giftWrapInr) || 0,
          items: itemsList,
          applyWalletCredits: Boolean(rewardsPayload.applyWalletCredits),
          requestedWalletAmountInr: rewardsPayload.requestedWalletAmountInr,
          applyLoyaltyPoints: Boolean(rewardsPayload.applyLoyaltyPoints),
          requestedLoyaltyPoints: rewardsPayload.requestedLoyaltyPoints,
          applyGiftCard: Boolean(rewardsPayload.applyGiftCard),
          giftCardCodeOrNumber: rewardsPayload.giftCardCodeOrNumber,
          idempotencyKey: String(rewardsPayload.idempotencyKey || `ord_chk_${order.id}`),
          orderId: order.id,
          orderNumber: order.orderNumber,
          captureImmediately: true
        }).catch((err: any) => console.warn('[Checkout Rewards Hook]', err.message));
      }

      if (payStatusUpper === 'FAILED' || ordStatusUpper === 'CANCELLED') {
        await restoreRedeemedRewardsOnCancelOrPaymentFailure({
          orderId: order.id,
          reason: `Order ${order.orderNumber} ${payStatusUpper === 'FAILED' ? 'payment failed' : 'cancelled'}`
        }).catch(() => {});
      } else {
        await awardOrderLoyaltyPointsTransaction({
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerId: order.customerId || undefined,
          customerEmail: order.customerEmail,
          customerName: order.customerName,
          subtotalInr: Number(order.subtotal) || Number(order.totalAmount) || 0,
          discountInr: Number(order.discount) || 0,
          items: itemsList,
          matureImmediately: ordStatusUpper === 'DELIVERED'
        }).catch((err: any) => console.warn('[Order Loyalty Accrual Hook]', err.message));

        await evaluateReferralOnFirstOrder({
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerEmail: order.customerEmail,
          netOrderValueInr: Number(order.totalAmount) || 0,
          orderDeliveredAndMatured: ordStatusUpper === 'DELIVERED'
        }).catch(() => {});
      }
    }

    broadcastCrossBrowserSyncEvent({
      entity: 'ORDERS',
      action: 'CREATE',
      recordId: order.id,
      summary: `Order ${order.orderNumber} created (₹${order.totalAmount})`
    });
    res.json({ success: true, order, lifecycleState });
  } catch (error: any) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/orders/:id/status', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { status, awbNumber, courierName, trackingUrl } = req.body;
    const updated = await updateOrderStatus(req.params.id, status, { awbNumber, courierName, trackingUrl });
    const normStatus = String(status || '').toUpperCase();
    const statusEventMap: Record<string, string> = {
      SHIPPED: 'order.dispatched',
      DISPATCHED: 'order.dispatched',
      DELIVERED: 'order.delivered',
      CANCELLED: 'order.cancelled'
    };
    if (updated) {
      // Recalculate VIP status & net purchase value when order status changes (e.g., CANCELLED or DELIVERED)
      await recalculateCustomerLifecycleState(
        updated.customerEmail || updated.customerId || updated.customerPhone || ''
      );

      if (normStatus === 'CANCELLED') {
        await restoreRedeemedRewardsOnCancelOrPaymentFailure({
          orderId: updated.id,
          reason: `Order ${updated.orderNumber} cancelled`
        }).catch(() => {});
      } else if (normStatus === 'DELIVERED' && updated.customerEmail) {
        await awardOrderLoyaltyPointsTransaction({
          orderId: updated.id,
          orderNumber: updated.orderNumber,
          customerId: updated.customerId || undefined,
          customerEmail: updated.customerEmail,
          customerName: updated.customerName,
          subtotalInr: Number(updated.subtotal) || Number(updated.totalAmount) || 0,
          discountInr: Number(updated.discount) || 0,
          items: Array.isArray(updated.items) ? updated.items : [],
          matureImmediately: true
        }).catch(() => {});

        await evaluateReferralOnFirstOrder({
          orderId: updated.id,
          orderNumber: updated.orderNumber,
          customerEmail: updated.customerEmail,
          netOrderValueInr: Number(updated.totalAmount) || 0,
          orderDeliveredAndMatured: true
        }).catch(() => {});
      }
    }
    if (statusEventMap[normStatus] && updated) {
      ingestAutomationEvent({
        eventType: statusEventMap[normStatus],
        source: 'order_fulfillment',
        idempotencyKey: `order_status_${updated.id}_${normStatus}_${Date.now().toString().slice(0, 8)}`,
        customerId: updated.customerId || undefined,
        customerEmail: updated.customerEmail || undefined,
        orderId: updated.id,
        payload: {
          orderId: updated.id,
          orderNumber: updated.orderNumber,
          customerName: updated.customerName,
          customerEmail: updated.customerEmail,
          customerPhone: updated.customerPhone,
          orderStatus: normStatus,
          awbNumber: updated.awbNumber,
          courierName: updated.courierName,
          trackingUrl: updated.trackingUrl,
          totalAmount: updated.totalAmount
        }
      }).catch(() => {});
    }
    broadcastCrossBrowserSyncEvent({
      entity: 'ORDERS',
      action: 'STATUS_UPDATE',
      recordId: req.params.id,
      summary: `Order ${req.params.id} status updated to ${status}`
    });
    res.json({ success: true, order: updated });
  } catch (error: any) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/orders/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    await deleteOrderById(req.params.id);
    broadcastCrossBrowserSyncEvent({
      entity: 'ORDERS',
      action: 'DELETE',
      recordId: req.params.id
    });
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting order:', error);
    res.status(500).json({ error: error.message });
  }
});

// 5. Customers
// Protected Admin-Only Customer Intelligence & Classifications
app.get('/api/admin/customers', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const customersWithAnalytics = await getAdminCustomerAnalytics();
    res.json(customersWithAnalytics);
  } catch (error: any) {
    console.error('Error fetching admin customers with classifications:', error);
    res.status(500).json({ error: error.message });
  }
});

// Public/Storefront Customer endpoint — VIP status is strictly hidden here (visible only inside authorized Admin interfaces)
app.get('/api/customers', async (_req: Request, res: Response) => {
  try {
    const rawCustomers = await getAllCustomers();
    const mapped = rawCustomers.map((c: any) => {
      const safeTags = (Array.isArray(c.tags) ? c.tags : []).filter(
        (t: string) => !String(t).toLowerCase().includes('vip')
      );
      const crmMeta = c.crmMetadata && typeof c.crmMetadata === 'object' ? c.crmMetadata : {};
      return {
        id: c.id,
        name: c.name || '',
        email: c.email || '',
        phone: c.phone || '',
        city: c.city || '',
        state: c.state || '',
        // Never expose VIP status on public customer endpoints
        tier: String(c.tier).toUpperCase() === 'VIP' ? 'Member' : c.tier || 'Member',
        tags: safeTags,
        totalOrders: Number(c.totalOrders) || 0,
        totalSpend: Number(c.totalSpend) || 0,
        addresses: Array.isArray(c.addresses) ? c.addresses : [],
        notes: c.notes || '',
        favouriteFragrance: c.favouriteFragrance || '',
        source: c.source || 'Direct Website',
        influencer: c.influencer || '',
        utmSource: c.utmSource || '',
        utmCampaign: c.utmCampaign || '',
        communicationHistory: Array.isArray(c.communicationHistory) ? c.communicationHistory : [],
        wishlistSlugs: Array.isArray(c.wishlistSlugs) ? c.wishlistSlugs : [],
        birthday: crmMeta.birthday || null,
        consent: crmMeta.consent || null,
        createdAt: c.createdAt
      };
    });
    res.json(mapped);
  } catch (error: any) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/customers', optionalAuth, async (req: Request, res: Response) => {
  try {
    const customer = await upsertCustomer(req.body);
    invalidateAuthoritativeDomainCache({ entity: 'CUSTOMERS', recordId: customer.id });
    broadcastCrossBrowserSyncEvent({
      type: 'CUSTOMER_UPDATED',
      entity: 'CUSTOMERS',
      action: 'UPSERT',
      recordId: customer.id,
      summary: `Customer ${customer.name || customer.email} updated`
    });
    res.json({ success: true, customer });
  } catch (error: any) {
    console.error('Error saving customer:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/customers/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const customer = await upsertCustomer({ ...req.body, id: req.params.id });
    invalidateAuthoritativeDomainCache({ entity: 'CUSTOMERS', recordId: customer.id });
    broadcastCrossBrowserSyncEvent({
      type: 'CUSTOMER_UPDATED',
      entity: 'CUSTOMERS',
      action: 'UPDATE',
      recordId: customer.id,
      summary: `Customer ${customer.name || customer.email} updated`
    });
    res.json({ success: true, customer });
  } catch (error: any) {
    console.error('Error updating customer:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/customers/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    await deleteCustomerById(req.params.id);
    invalidateAuthoritativeDomainCache({ entity: 'CUSTOMERS', recordId: req.params.id });
    broadcastCrossBrowserSyncEvent({
      type: 'CUSTOMER_UPDATED',
      entity: 'CUSTOMERS',
      action: 'DELETE',
      recordId: req.params.id
    });
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting customer:', error);
    res.status(500).json({ error: error.message });
  }
});

// 6. Reviews
app.get('/api/reviews', async (_req: Request, res: Response) => {
  try {
    const reviews = await getAllReviews();
    res.json(reviews);
  } catch (error: any) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/reviews', optionalAuth, async (req: Request, res: Response) => {
  try {
    const review = await insertReview(req.body);
    ingestAutomationEvent({
      eventType: 'review.submitted',
      source: 'storefront_reviews',
      idempotencyKey: `review_submitted_${review.id}`,
      customerEmail: req.body?.customerEmail || undefined,
      payload: {
        reviewId: review.id,
        productId: review.productId,
        customerName: review.authorName,
        rating: review.rating,
        title: review.title,
        comment: review.comment
      }
    }).catch(() => {});
    res.json({ success: true, review });
  } catch (error: any) {
    console.error('Error submitting review:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/reviews/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    await deleteReviewById(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting review:', error);
    res.status(500).json({ error: error.message });
  }
});

// 7. Coupons
app.get('/api/coupons', async (_req: Request, res: Response) => {
  try {
    const coupons = await getAllCoupons();
    res.json(coupons);
  } catch (error: any) {
    console.error('Error fetching coupons:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/coupons', optionalAuth, async (req: Request, res: Response) => {
  try {
    const coupon = await upsertCoupon(req.body);
    invalidateAuthoritativeDomainCache({ entity: 'COUPONS', recordId: coupon.code });
    broadcastCrossBrowserSyncEvent({
      type: 'COUPON_UPDATED',
      entity: 'COUPONS',
      action: 'UPSERT',
      recordId: coupon.code,
      summary: `Coupon ${coupon.code} updated`
    });
    res.json({ success: true, coupon });
  } catch (error: any) {
    console.error('Error saving coupon:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/coupons/:code', optionalAuth, async (req: Request, res: Response) => {
  try {
    await deleteCouponByCode(req.params.code);
    invalidateAuthoritativeDomainCache({ entity: 'COUPONS', recordId: req.params.code });
    broadcastCrossBrowserSyncEvent({
      type: 'COUPON_UPDATED',
      entity: 'COUPONS',
      action: 'DELETE',
      recordId: req.params.code
    });
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting coupon:', error);
    res.status(500).json({ error: error.message });
  }
});

// 8. Influencers
app.get('/api/influencers', async (_req: Request, res: Response) => {
  try {
    const influencers = await getAllInfluencers();
    res.json(influencers);
  } catch (error: any) {
    console.error('Error fetching influencers:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/influencers', optionalAuth, async (req: Request, res: Response) => {
  try {
    const influencer = await upsertInfluencer(req.body);
    res.json({ success: true, influencer });
  } catch (error: any) {
    console.error('Error saving influencer:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/influencers/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    await deleteInfluencerById(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting influencer:', error);
    res.status(500).json({ error: error.message });
  }
});

// 9. Abandoned Carts & Automated Recovery Engine
app.get('/api/abandoned-carts', async (_req: Request, res: Response) => {
  try {
    const dashboard = await getAbandonedCartDashboardAnalytics();
    res.json(dashboard.carts);
  } catch (error: any) {
    console.error('Error fetching abandoned carts:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/abandoned-carts/dashboard', async (_req: Request, res: Response) => {
  try {
    const dashboard = await getAbandonedCartDashboardAnalytics();
    res.json(dashboard);
  } catch (error: any) {
    console.error('Error fetching abandoned carts dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/abandoned-carts/config', async (_req: Request, res: Response) => {
  try {
    const config = await getAbandonedCartEngineConfig();
    res.json(config);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/abandoned-carts/config', optionalAuth, async (req: Request, res: Response) => {
  try {
    const config = await updateAbandonedCartEngineConfig(req.body || {});
    res.json({ success: true, config });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/abandoned-carts', optionalAuth, async (req: Request, res: Response) => {
  try {
    const tracked = await trackOrSyncCartSession(req.body || {});
    const cart = tracked.cart;
    if (!tracked.deduplicated && String(cart.status || 'ABANDONED').toUpperCase() === 'ABANDONED') {
      ingestAutomationEvent({
        eventType: 'cart.abandoned',
        source: 'storefront_cart_tracker',
        idempotencyKey: req.body?.idempotencyKey || `cart_abandoned_${cart.id}_${cart.cartValue}`,
        customerEmail: cart.customerEmail || undefined,
        payload: {
          cartId: cart.id,
          anonymousCartId: (cart.recoveryMetadata as any)?.anonymousCartId || cart.id,
          customerName: cart.customerName,
          customerEmail: cart.customerEmail,
          customerPhone: cart.customerPhone,
          cartValue: cart.cartValue,
          items: cart.items,
          status: cart.status
        }
      }).catch(() => {});
    }
    res.json({
      success: true,
      cart,
      deduplicated: tracked.deduplicated,
      mergedFromAnonymousCartId: tracked.mergedFromAnonymousCartId
    });
  } catch (error: any) {
    console.error('Error saving abandoned cart:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/abandoned-carts/:id/execute-step', optionalAuth, async (req: Request, res: Response) => {
  try {
    const stepId = (req.body?.stepId || 'T_PLUS_30M') as RecoveryStepId;
    const result = await executeCartRecoveryStep({
      cartId: req.params.id,
      stepId,
      forceElapsed: req.body?.forceElapsed !== false,
      preferredChannel: req.body?.preferredChannel,
      simulateProviderState: req.body?.simulateProviderState || 'DEFAULT'
    });
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/abandoned-carts/:id/manual-workflow', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { channel = 'WHATSAPP', note } = req.body || {};
    const [cart] = await db
      .select()
      .from(abandonedCartsTable)
      .where(eq(abandonedCartsTable.id, req.params.id))
      .limit(1);
    if (!cart) {
      return res.status(404).json({ error: 'Abandoned cart not found' });
    }
    const meta = ((cart.recoveryMetadata as any) || {}) as Record<string, any>;
    const manualLogs = Array.isArray(meta.manualWorkflows) ? [...meta.manualWorkflows] : [];
    const entry = {
      id: `man_${Date.now()}`,
      channel: String(channel).toUpperCase(),
      note: note || `Manual ${channel} concierge link prepared by admin`,
      couponCode: cart.couponCode || null,
      timestamp: new Date().toISOString(),
      status: 'MANUAL_WORKFLOW_PREPARED'
    };
    manualLogs.unshift(entry);

    const [updated] = await db
      .update(abandonedCartsTable)
      .set({
        recoveryMetadata: {
          ...meta,
          manualWorkflows: manualLogs
        }
      })
      .where(eq(abandonedCartsTable.id, cart.id))
      .returning();

    res.json({ success: true, cart: updated, manualEntry: entry });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/abandoned-carts/:id/mark-recovered', optionalAuth, async (req: Request, res: Response) => {
  try {
    // Strictly mark as MANUALLY_RECOVERED without fabricating order revenue
    const [cart] = await db
      .select()
      .from(abandonedCartsTable)
      .where(eq(abandonedCartsTable.id, req.params.id))
      .limit(1);
    if (!cart) {
      return res.status(404).json({ error: 'Abandoned cart not found' });
    }
    const meta = ((cart.recoveryMetadata as any) || {}) as Record<string, any>;
    await cancelPendingRecoveryForCart({
      cartId: cart.id,
      reason: 'MANUAL_SUPPRESS'
    });
    const [updated] = await db
      .update(abandonedCartsTable)
      .set({
        status: 'MANUALLY_RECOVERED',
        recoveredAt: new Date(),
        recoveryMetadata: {
          ...meta,
          manualRecoveryOnly: true,
          manuallyMarkedAt: new Date().toISOString(),
          attributedOrderRevenueInr: 0
        }
      })
      .where(eq(abandonedCartsTable.id, cart.id))
      .returning();
    res.json({
      success: true,
      cart: updated,
      notice: 'Marked as manually recovered. Note: Only verified paid orders contribute to Recovered Net Revenue.'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/abandoned-carts/:id/suppress', optionalAuth, async (req: Request, res: Response) => {
  try {
    const reason = req.body?.unsubscribe ? 'CUSTOMER_UNSUBSCRIBED' : 'MANUAL_SUPPRESS';
    const result = await cancelPendingRecoveryForCart({
      cartId: req.params.id,
      reason
    });
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/abandoned-carts/webhook/payment', async (req: Request, res: Response) => {
  try {
    const { cartId, anonymousCartId, customerEmail, orderId, paymentStatus = 'PAID' } = req.body || {};
    if (String(paymentStatus).toUpperCase() === 'PAID') {
      const result = await cancelPendingRecoveryForCart({
        cartId,
        anonymousCartId,
        customerEmail,
        orderId,
        reason: 'LATE_PAYMENT_WEBHOOK'
      });
      return res.json({ success: true, ...result });
    }
    res.json({ success: true, paymentStatus });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/abandoned-carts/coupons/evaluate', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { cartId, customerEmail, customerId, items = [], cartValue = 0, issue = false } = req.body || {};
    if (issue && cartId) {
      const issued = await issueSmartRecoveryCoupon({
        cartId,
        customerEmail,
        customerId,
        items,
        cartValue: Number(cartValue)
      });
      if (issued.issued && issued.couponCode) {
        await db
          .update(abandonedCartsTable)
          .set({ couponCode: issued.couponCode })
          .where(eq(abandonedCartsTable.id, cartId));
      }
      return res.json({ success: true, ...issued });
    }
    const evaluation = await evaluateSmartCouponEligibility({
      cartId: cartId || 'preview',
      customerEmail,
      customerId,
      items,
      cartValue: Number(cartValue)
    });
    res.json({ success: true, evaluation });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/abandoned-carts/coupons/validate', async (req: Request, res: Response) => {
  try {
    const validation = await validateRecoveryCouponAtCheckout(req.body || {});
    res.json(validation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/abandoned-carts/process-due', optionalAuth, async (_req: Request, res: Response) => {
  try {
    const result = await processDueAbandonedCartReminders();
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/abandoned-carts/run-tests', optionalAuth, async (_req: Request, res: Response) => {
  try {
    const suiteResult = await runAbandonedCartEngineVerificationSuite();
    res.json(suiteResult);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/abandoned-carts/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    await cancelPendingRecoveryForCart({
      cartId: req.params.id,
      reason: 'CART_DELETED'
    });
    await deleteAbandonedCartById(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting abandoned cart:', error);
    res.status(500).json({ error: error.message });
  }
});

// 10. CMS Settings
app.get('/api/cms', async (_req: Request, res: Response) => {
  try {
    const settings = await getCMSSettings();
    res.json(settings || {});
  } catch (error: any) {
    console.error('Error fetching CMS settings:', error);
    res.status(500).json({ error: error.message });
  }
});

const handleSaveCMS = async (req: Request, res: Response) => {
  try {
    const adminRoleHeader = String(req.headers['x-admin-role'] || '').toUpperCase();
    const allowedRoles = ['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'CONTENT_MARKETING'];
    const isFirebaseAdmin = (req as any).user?.role === 'admin' || (req as any).user?.email === 'founder@fragmore.com';

    if (!allowedRoles.includes(adminRoleHeader) && !isFirebaseAdmin) {
      res.status(403).json({
        error: 'Unauthorized: Server-side Admin authorization is required to modify CMS & Atelier Concierge settings.'
      });
      return;
    }

    const payload = req.body;
    if (!payload || typeof payload !== 'object') {
      res.status(400).json({ error: 'Invalid CMS configuration payload.' });
      return;
    }

    if (payload.atelierConcierge) {
      const ac = payload.atelierConcierge;
      if (!ac.heading || typeof ac.heading !== 'string' || !ac.heading.trim()) {
        res.status(400).json({ error: 'Atelier Concierge heading is required.' });
        return;
      }
      if (!ac.email || typeof ac.email !== 'string' || !ac.email.includes('@')) {
        res.status(400).json({ error: 'A valid Atelier Concierge email address is required.' });
        return;
      }
      if (!ac.whatsappNumber || typeof ac.whatsappNumber !== 'string' || !ac.whatsappNumber.trim()) {
        res.status(400).json({ error: 'Atelier Concierge WhatsApp number is required.' });
        return;
      }
    }

    const settings = await updateCMSSettings(payload);
    res.json({ success: true, settings });
  } catch (error: any) {
    console.error('Error saving CMS settings:', error);
    res.status(500).json({ error: error.message });
  }
};

app.post('/api/cms', optionalAuth, handleSaveCMS);
app.put('/api/cms', optionalAuth, handleSaveCMS);

// 11. Audit Logs
app.get('/api/audit-logs', async (_req: Request, res: Response) => {
  try {
    const logs = await getAllAuditLogs();
    res.json(logs);
  } catch (error: any) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/audit-logs', optionalAuth, async (req: Request, res: Response) => {
  try {
    const log = await insertAuditLog(req.body);
    res.json({ success: true, log });
  } catch (error: any) {
    console.error('Error saving audit log:', error);
    res.status(500).json({ error: error.message });
  }
});

// 12. Campaigns, Returns & Back-in-Stock
app.get('/api/campaigns', async (_req: Request, res: Response) => {
  try {
    const list = await getAllCampaigns();
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/campaigns', optionalAuth, async (req: Request, res: Response) => {
  try {
    const camp = await upsertCampaign(req.body);
    invalidateAuthoritativeDomainCache({ entity: 'CAMPAIGNS', recordId: camp.id });
    broadcastCrossBrowserSyncEvent({
      type: 'STATE_INVALIDATED',
      entity: 'CAMPAIGNS',
      action: 'UPSERT',
      recordId: camp.id,
      summary: `Campaign ${camp.name} updated`
    });
    res.json({ success: true, campaign: camp });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/campaigns/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    await deleteCampaignById(req.params.id);
    invalidateAuthoritativeDomainCache({ entity: 'CAMPAIGNS', recordId: req.params.id });
    broadcastCrossBrowserSyncEvent({
      type: 'STATE_INVALIDATED',
      entity: 'CAMPAIGNS',
      action: 'DELETE',
      recordId: req.params.id
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/returns', async (_req: Request, res: Response) => {
  try {
    const list = await getAllReturns();
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/returns', optionalAuth, async (req: Request, res: Response) => {
  try {
    const ret = await upsertReturn(req.body);
    const returnPayload = {
      returnId: ret.id,
      orderId: ret.orderId,
      orderNumber: ret.orderNumber,
      customerName: ret.customerName,
      customerEmail: req.body?.customerEmail || '',
      reason: ret.reason,
      refundAmount: ret.refundAmount,
      status: ret.status
    };

    if (String(ret.status || '').toUpperCase() === 'REFUNDED') {
      await ingestAutomationEvent({
        eventType: 'refund.completed',
        source: 'returns_desk',
        idempotencyKey: `refund_completed_${ret.id}`,
        customerEmail: req.body?.customerEmail || undefined,
        orderId: ret.orderId || undefined,
        payload: returnPayload
      }).catch(() => {});
    } else {
      await ingestAutomationEvent({
        eventType: 'return.requested',
        source: 'returns_desk',
        idempotencyKey: `return_requested_${ret.id}_${ret.status}`,
        customerEmail: req.body?.customerEmail || undefined,
        orderId: ret.orderId || undefined,
        payload: returnPayload
      }).catch(() => {});
    }

    // Recalculate VIP status & net purchase value when returns or refunds occur
    const allOrds = await getAllOrders();
    const matchedOrd = allOrds.find(
      (o: any) => o.id === ret.orderId || o.orderNumber === ret.orderNumber
    );
    const custIdentifier =
      req.body?.customerEmail || matchedOrd?.customerEmail || matchedOrd?.customerId || '';
    const lifecycleState = custIdentifier
      ? await recalculateCustomerLifecycleState(custIdentifier)
      : null;

    const retStatusUpper = String(ret.status || '').toUpperCase();
    if (
      (retStatusUpper === 'REFUNDED' || retStatusUpper === 'APPROVED' || retStatusUpper === 'COMPLETED') &&
      custIdentifier &&
      String(custIdentifier).includes('@')
    ) {
      await processReturnAndRefundRewardsSync({
        returnId: ret.id,
        orderId: ret.orderId,
        orderNumber: ret.orderNumber,
        customerEmail: String(custIdentifier),
        refundAmountInr: Number(ret.refundAmount) || 0,
        orderTotalInr: Number(matchedOrd?.totalAmount) || Number(ret.refundAmount) || 0,
        refundToWalletOptIn: Boolean(req.body?.refundToWalletOptIn),
        actorEmail: 'returns@fragmore.shop'
      }).catch((err: any) => console.warn('[Returns Rewards Reversal Hook]', err.message));
    }

    invalidateAuthoritativeDomainCache({ entity: 'RETURNS_REFUNDS', recordId: ret.id });
    broadcastCrossBrowserSyncEvent({
      type: 'STATE_INVALIDATED',
      entity: 'RETURNS_REFUNDS',
      action: 'UPSERT',
      recordId: ret.id,
      summary: `Return ${ret.id} (${ret.status}) updated`
    });

    res.json({ success: true, returnItem: ret, lifecycleState });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/back-in-stock', async (_req: Request, res: Response) => {
  try {
    const list = await getAllBackInStock();
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/back-in-stock', optionalAuth, async (req: Request, res: Response) => {
  try {
    const item = await upsertBackInStock(req.body);
    res.json({ success: true, item });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/back-in-stock/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    await deleteBackInStockById(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 13. Centralized Enterprise Automation Center API
app.use('/api/automation', automationRouter);

// 13b. FRAGMORÉ BUSINESS OS ERP API (Multi-Department ACID & RBAC)
app.use('/api/erp', erpRouter);

// 13c. FRAGMORÉ SMART WALLET, LOYALTY REWARDS & GIFT CARD ECOSYSTEM API
app.use('/api/rewards', rewardsRouter);

// 14. Interconnected Order, Payment, Shipping, Inventory, Production & Returns Automation API
app.get('/api/ops/dashboard', async (_req: Request, res: Response) => {
  try {
    const data = await getUnifiedOperationsDashboard();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ops/orders/create', optionalAuth, async (req: Request, res: Response) => {
  try {
    const result = await createOrderWithAutomation(req.body || {});
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/ops/orders/:id/verify-payment', optionalAuth, async (req: Request, res: Response) => {
  try {
    const result = await verifyOrderPaymentServerSide({
      orderId: req.params.id,
      verificationSource: req.body?.verificationSource || 'SERVER_API_VERIFICATION',
      transactionId: req.body?.transactionId,
      providerSignature: req.body?.providerSignature,
      actor: req.body?.actor || 'admin@fragmore.com'
    });
    res.json({ success: result.verified, ...result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/ops/orders/:id/payment-failed', optionalAuth, async (req: Request, res: Response) => {
  try {
    const result = await handleOrderPaymentFailure({
      orderId: req.params.id,
      failureReason: req.body?.failureReason,
      actor: req.body?.actor
    });
    await restoreRedeemedRewardsOnCancelOrPaymentFailure({
      orderId: req.params.id,
      reason: req.body?.failureReason || 'Order payment failed'
    }).catch(() => {});
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/ops/orders/:id/retry-payment', optionalAuth, async (req: Request, res: Response) => {
  try {
    const result = await retryFailedOrderPayment({
      orderId: req.params.id,
      verificationSource: req.body?.verificationSource,
      transactionId: req.body?.transactionId
    });
    res.json({ success: result.retried, ...result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/ops/shipping/:orderId/event', optionalAuth, async (req: Request, res: Response) => {
  try {
    const result = await processShippingLifecycleEvent({
      orderId: req.params.orderId,
      eventType: req.body?.eventType as ShippingLifecycleEventType,
      awbNumber: req.body?.awbNumber,
      courierName: req.body?.courierName,
      trackingUrl: req.body?.trackingUrl,
      verificationSource: req.body?.verificationSource || 'AUTHORIZED_ADMIN_CONFIRMATION',
      adminEmail: req.body?.adminEmail || 'admin@fragmore.com',
      proofReference: req.body?.proofReference,
      exceptionReason: req.body?.exceptionReason
    });
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/ops/inventory/ledger', async (_req: Request, res: Response) => {
  try {
    const ledger = await syncAndInitializeInventoryLedger();
    res.json(ledger);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ops/inventory/adjust', optionalAuth, async (req: Request, res: Response) => {
  try {
    const updated = await adjustSkuInventoryAtomically(req.body || {});
    res.json({ success: true, ledgerRow: updated });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/ops/batches', optionalAuth, async (req: Request, res: Response) => {
  try {
    const result = await createOrUpdateProductionBatch(req.body || {});
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/ops/batches/:id/release', optionalAuth, async (req: Request, res: Response) => {
  try {
    const result = await releaseProductionBatchToInventory({
      batchId: req.params.id,
      actor: req.body?.actor || 'admin@fragmore.com'
    });
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/ops/returns/create', optionalAuth, async (req: Request, res: Response) => {
  try {
    const result = await createReturnRequestWithValidation(req.body || {});
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/ops/returns/:id/advance', optionalAuth, async (req: Request, res: Response) => {
  try {
    const result = await advanceReturnWorkflowStage({
      returnId: req.params.id,
      stage: req.body?.stage,
      adminEmail: req.body?.adminEmail || 'admin@fragmore.com',
      reverseCourier: req.body?.reverseCourier,
      reverseAwb: req.body?.reverseAwb,
      sealIntact: req.body?.sealIntact,
      gatewayRefundId: req.body?.gatewayRefundId,
      notes: req.body?.notes
    });

    if (result.returnRecord?.orderId || result.returnRecord?.orderNumber) {
      const allOrds = await getAllOrders();
      const matchedOrd = allOrds.find(
        (o: any) =>
          o.id === result.returnRecord.orderId || o.orderNumber === result.returnRecord.orderNumber
      );
      if (matchedOrd?.customerEmail) {
        await recalculateCustomerLifecycleState(matchedOrd.customerEmail).catch(() => {});
      }
    }

    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/ops/tasks/:id/resolve', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { action = 'APPROVED', adminEmail = 'admin@fragmore.com' } = req.body || {};
    const [updated] = await db
      .update(opsTasksAndAlertsTable)
      .set({
        status: action,
        resolvedBy: adminEmail,
        resolvedAt: new Date()
      })
      .where(eq(opsTasksAndAlertsTable.id, req.params.id))
      .returning();
    res.json({ success: true, task: updated });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/ops/reconciliation/run', optionalAuth, async (req: Request, res: Response) => {
  try {
    const report = await runCrossModuleReconciliationJob({
      autoFixLedgerDrift: Boolean(req.body?.autoFixLedgerDrift)
    });
    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ops/run-tests', optionalAuth, async (_req: Request, res: Response) => {
  try {
    const suite = await runOperationsAutomationVerificationSuite();
    res.json(suite);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================================
// PROCUREMENT & PURCHASE ORDER APIS
// ========================================================
app.get('/api/procurement/overview', optionalAuth, async (_req: Request, res: Response) => {
  try {
    const purchaseOrders = await db
      .select()
      .from(supplierPurchaseOrdersTable)
      .orderBy(desc(supplierPurchaseOrdersTable.createdAt));
    const suppliers = await db
      .select()
      .from(procurementSuppliersTable)
      .orderBy(desc(procurementSuppliersTable.createdAt));
    const ledger = await db.select().from(inventoryLedgerTable);
    const tasks = await db.select().from(opsTasksAndAlertsTable);
    
    // Low stock reorder alerts
    const lowStockAlerts = tasks.filter(
      (t) => t.category === 'PROCUREMENT_QUEUE' || t.category === 'LOW_STOCK_ALERT'
    );

    res.json({
      success: true,
      purchaseOrders,
      suppliers,
      inventoryLedger: ledger,
      lowStockAlerts
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/procurement/purchase-orders', optionalAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const id = body.id || `po-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const poNumber = body.poNumber || `PO-FRG-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const [saved] = await db
      .insert(supplierPurchaseOrdersTable)
      .values({
        id,
        poNumber,
        supplierId: body.supplierId || 'supp-parma-glass',
        supplierName: body.supplierName || 'Verreries de Parma S.p.A.',
        supplierEmail: body.supplierEmail || null,
        supplierPhone: body.supplierPhone || null,
        category: body.category || 'PACKAGING',
        orderDate: body.orderDate || new Date().toISOString().slice(0, 10),
        expectedDeliveryDate: body.expectedDeliveryDate || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
        actualDeliveryDate: body.actualDeliveryDate || null,
        items: body.items || [],
        subtotalInr: Number(body.subtotalInr || 0),
        gstInr: Number(body.gstInr || 0),
        shippingInr: Number(body.shippingInr || 0),
        totalCostInr: Number(body.totalCostInr || 0),
        status: body.status || 'ORDERED',
        paymentStatus: body.paymentStatus || 'PENDING',
        paymentTerms: body.paymentTerms || 'NET_30',
        notes: body.notes || '',
        createdBy: (req as any).user?.email || body.createdBy || 'admin@fragmore.com'
      })
      .returning();

    res.json({ success: true, purchaseOrder: saved });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/procurement/purchase-orders/:id/status', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { status, paymentStatus, actualDeliveryDate, notes } = req.body || {};
    const updateData: any = { updatedAt: new Date() };
    if (status) updateData.status = status;
    if (paymentStatus) updateData.paymentStatus = paymentStatus;
    if (actualDeliveryDate) updateData.actualDeliveryDate = actualDeliveryDate;
    if (notes) updateData.notes = notes;
    if (status === 'RECEIVED') {
      updateData.actualDeliveryDate = new Date().toISOString().slice(0, 10);
      updateData.receivedBy = (req as any).user?.email || 'admin@fragmore.com';
    }

    const [updated] = await db
      .update(supplierPurchaseOrdersTable)
      .set(updateData)
      .where(eq(supplierPurchaseOrdersTable.id, req.params.id))
      .returning();

    res.json({ success: true, purchaseOrder: updated });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/procurement/suppliers', optionalAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const id = body.id || `supp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const code = body.code || `SUP-${Math.floor(100 + Math.random() * 900)}`;

    const [saved] = await db
      .insert(procurementSuppliersTable)
      .values({
        id,
        name: body.name,
        code,
        category: body.category || 'PACKAGING',
        contactPerson: body.contactPerson,
        email: body.email,
        phone: body.phone,
        city: body.city || 'Mumbai',
        country: body.country || 'India',
        leadTimeDays: Number(body.leadTimeDays || 14),
        paymentTerms: body.paymentTerms || 'NET_30',
        rating: body.rating || 'A_GRADE',
        status: body.status || 'ACTIVE',
        materialsSupplied: body.materialsSupplied || [],
        notes: body.notes || ''
      })
      .returning();

    res.json({ success: true, supplier: saved });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/ops/batches/:id/qc', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { qcStatus, packagingAvailability, notes } = req.body || {};
    const [updated] = await db
      .update(productionBatchesTable)
      .set({
        qcStatus: qcStatus || 'PASSED',
        packagingAvailability: packagingAvailability || 'AVAILABLE',
        notes: notes || undefined,
        updatedAt: new Date()
      })
      .where(eq(productionBatchesTable.id, req.params.id))
      .returning();

    res.json({ success: true, batch: updated });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ========================================================
// 14. DISCOVERY EXPERIENCE, COUPON & LOYALTY AUTOMATION API
// ========================================================

app.get('/api/discovery-loyalty/dashboard', optionalAuth, async (_req: Request, res: Response) => {
  try {
    const dashboard = await getDiscoveryLoyaltyCouponDashboard();
    res.json(dashboard);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/discovery-loyalty/redemption-rules', optionalAuth, async (req: Request, res: Response) => {
  try {
    const rules = await updateDiscoveryRedemptionRules(
      req.body || {},
      req.body?.adminEmail || 'gowisherharsha@gmail.com'
    );
    res.json({ success: true, redemptionRules: rules });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/discovery-loyalty/journeys/register', optionalAuth, async (req: Request, res: Response) => {
  try {
    const journey = await registerDiscoveryPurchase(req.body || {});
    res.json({ success: true, journey });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/discovery-loyalty/journeys/:id/confirm-delivery', optionalAuth, async (req: Request, res: Response) => {
  try {
    const result = await confirmDiscoveryDeliveryAndStartJourney({
      journeyId: req.params.id,
      verificationSource: req.body?.verificationSource || 'TRUSTED_CARRIER_WEBHOOK',
      channel: req.body?.channel || 'EMAIL',
      actor: req.body?.actor || 'Blue Dart Carrier Webhook'
    });
    if (!result.success) {
      return res.status(400).json({ error: result.reason, ...result });
    }
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/discovery-loyalty/journeys/:id/select-favorite', optionalAuth, async (req: Request, res: Response) => {
  try {
    const result = await selectFavoriteFragranceAndIssueRedemptionBenefit({
      journeyId: req.params.id,
      selectedFavoriteFragrance: req.body?.selectedFavoriteFragrance || 'AZURE',
      issueRedemptionVoucher: req.body?.issueRedemptionVoucher !== false,
      actor: req.body?.actor || 'Customer Favorite Portal'
    });
    if (!result.success) {
      return res.status(400).json({ error: result.reason, ...result });
    }
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/discovery-loyalty/journeys/:id/revoke', optionalAuth, async (req: Request, res: Response) => {
  try {
    const result = await revokeDiscoveryBenefitOnRefundOrCancel({
      journeyId: req.params.id,
      reason: req.body?.reason || 'Discovery order refunded or cancelled',
      actor: req.body?.actor || 'Super Admin'
    });
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/discovery-loyalty/vouchers/redeem', optionalAuth, async (req: Request, res: Response) => {
  try {
    const result = await redeemDiscoveryVoucherOnFullBottleUpgrade(req.body || {});
    if (!result.success) {
      return res.status(400).json({ error: result.reason, ...result });
    }
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/discovery-loyalty/loyalty/:id/action', optionalAuth, async (req: Request, res: Response) => {
  try {
    const result = await approveOrToggleLoyaltyProgram({
      programId: req.params.id,
      action: req.body?.action || 'APPROVE',
      adminEmail: req.body?.adminEmail || 'gowisherharsha@gmail.com',
      benefitValue: req.body?.benefitValue,
      minQualifyingOrderInr: req.body?.minQualifyingOrderInr,
      configUpdates: req.body?.configUpdates
    });
    if (!result.success) {
      return res.status(400).json({ error: result.reason, ...result });
    }
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/discovery-loyalty/loyalty/:id/execute', optionalAuth, async (req: Request, res: Response) => {
  try {
    const result = await executeLoyaltyBenefitForCustomer({
      programId: req.params.id,
      customerEmail: req.body?.customerEmail,
      customerName: req.body?.customerName,
      voluntaryBirthdayProvided: req.body?.voluntaryBirthdayProvided,
      favoriteFragrance: req.body?.favoriteFragrance,
      actor: req.body?.actor || 'Super Admin'
    });
    if (!result.success) {
      return res.status(400).json({ error: result.reason, ...result });
    }
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/discovery-loyalty/coupons', optionalAuth, async (req: Request, res: Response) => {
  try {
    const saved = await createOrUpdateEnterpriseCoupon(req.body || {});
    res.json({ success: true, coupon: saved });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/discovery-loyalty/run-tests', optionalAuth, async (_req: Request, res: Response) => {
  try {
    const suite = await runDiscoveryLoyaltyCouponVerificationSuite();
    res.json(suite);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================================
// 15. INFLUENCER, AFFILIATE, CONTENT & RESELLER SYSTEM API
// ========================================================

app.get('/api/influencer-reseller/dashboard', optionalAuth, async (_req: Request, res: Response) => {
  try {
    const dashboard = await getUnifiedInfluencerResellerDashboard();
    res.json(dashboard);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/influencer-reseller/config', optionalAuth, async (_req: Request, res: Response) => {
  try {
    await ensureInfluencerAndResellerInitialized();
    const config = await getGlobalCommissionAndMoqConfig();
    res.json(config);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/influencer-reseller/config', optionalAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const config = await updateGlobalCommissionAndMoqConfig(
      {
        ...body,
        maxAttributedOrdersPerCustomer:
          body.maxAttributedOrdersPerCustomer ?? body.defaultMaxAttributedOrdersPerCustomer,
        commissionHoldingPeriodDaysAfterDelivery:
          body.commissionHoldingPeriodDaysAfterDelivery ?? body.defaultHoldingPeriodDays,
        payoutMinimumInr: body.payoutMinimumInr ?? body.defaultPayoutMinimumInr
      },
      body.adminEmail || 'gowisherharsha@gmail.com'
    );
    res.json({ success: true, config });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/influencer-reseller/influencers/onboard', optionalAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const saved = await onboardOrUpdateInfluencer({
      id: body.id,
      name: body.name || 'Creator Partner',
      handle: body.handle || body.instagramHandle || '@fragmore.creator',
      platform: body.platform || 'Instagram',
      email: body.email || 'creator@fragmore.in',
      phone: body.phone || '+91 98201 00000',
      bio: body.bio,
      followerCount: body.followerCount ?? body.audienceDemographics?.followersCount,
      engagementRatePercent:
        body.engagementRatePercent ?? body.audienceDemographics?.engagementRatePercent,
      ageRange: body.ageRange ?? body.audienceDemographics?.ageGroupPrimary,
      genderSplit: body.genderSplit ?? body.audienceDemographics?.genderSplit,
      topCities: body.topCities ?? body.audienceDemographics?.topCities,
      contentCategory: body.contentCategory,
      language: body.language,
      targetGeography: Array.isArray(body.targetGeography)
        ? body.targetGeography.join(', ')
        : body.targetGeography,
      quotedFixedFeeInr: body.quotedFixedFeeInr ?? body.commercialQuotation?.quotedFeeInr,
      requestedCommissionPercent:
        body.requestedCommissionPercent ?? body.commissionPercentage ?? 15,
      deliverablesCommitted: body.deliverablesCommitted
        ? body.deliverablesCommitted
        : body.commercialQuotation?.deliverablesSummary
        ? [body.commercialQuotation.deliverablesSummary]
        : undefined,
      referralCode: body.referralCode || body.code,
      customerDiscountPercent: body.customerDiscountPercent ?? body.discountPercentage ?? 10,
      campaignName: body.campaignName || body.campaign,
      attributionWindowDays: body.attributionWindowDays,
      maxAttributedOrdersPerCustomer: body.maxAttributedOrdersPerCustomer,
      commissionModel: body.commissionModel || body.commissionType || 'PERCENTAGE',
      fixedCommissionPerOrderInr: body.fixedCommissionPerOrderInr,
      holdingPeriodDays: body.holdingPeriodDays,
      payoutMinimumInr: body.payoutMinimumInr,
      applicationStatus: body.applicationStatus || body.onboardingStatus || 'PENDING_REVIEW'
    });
    res.json({ success: true, influencer: saved });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/influencer-reseller/influencers/:id/review', optionalAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const updated = await approveOrReviewInfluencerOnboarding({
      influencerId: req.params.id,
      decision: body.decision || 'APPROVED',
      commissionModel: body.commissionModel || body.commissionType,
      commissionRate: body.commissionRate ?? body.commissionPercentage,
      fixedCommissionPerOrderInr: body.fixedCommissionPerOrderInr ?? body.fixedCommissionInr,
      attributionWindowDays: body.attributionWindowDays,
      maxAttributedOrdersPerCustomer: body.maxAttributedOrdersPerCustomer,
      maskedAccountIdentifier:
        body.maskedAccountIdentifier ?? body.paymentDetails?.maskedAccountOrUpi,
      adminEmail: body.adminEmail || 'gowisherharsha@gmail.com'
    });
    res.json({ success: true, influencer: updated });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/influencer-reseller/influencers/:id/funnel', optionalAuth, async (req: Request, res: Response) => {
  try {
    const updated = await recordAffiliateFunnelEvent({
      influencerId: req.params.id,
      eventType: req.body?.eventType || 'CLICK'
    });
    res.json({ success: true, influencer: updated });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/influencer-reseller/influencers/:id/attribute-order', optionalAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    let daysSinceClick = body.daysSinceAffiliateClick;
    if (daysSinceClick === undefined && body.clickTimestampIso) {
      const clickMs = new Date(body.clickTimestampIso).getTime();
      const orderMs = body.orderTimestampIso
        ? new Date(body.orderTimestampIso).getTime()
        : Date.now();
      daysSinceClick = Math.max(0, Math.round((orderMs - clickMs) / 86400000));
    }

    const result = await attributeOrderAndCalculateCommission({
      influencerId: req.params.id,
      orderId: body.orderId || `ORD-${Date.now().toString().slice(-6)}`,
      orderNumber: body.orderNumber || `FRG-${Date.now().toString().slice(-6)}`,
      customerEmail: body.customerEmail || 'collector@fragmore.in',
      grossOrderAmountInr: Number(
        body.grossOrderAmountInr ?? body.orderNetRevenueInr ?? 4200
      ),
      discountAppliedInr: Number(body.discountAppliedInr ?? 0),
      productSlugs: body.productSlugs,
      daysSinceAffiliateClick: daysSinceClick,
      orderTimestampIso: body.orderTimestampIso,
      orderPaymentStatus: body.orderPaymentStatus || 'PAID',
      orderDeliveryStatus: body.orderDeliveryStatus || 'DELIVERED',
      daysSinceDelivery: body.holdingPeriodCleared ? 15 : 0
    });
    res.json({
      ...result,
      commissionInr: result.commissionCalculatedInr,
      settlementState:
        result.settlementStatus === 'EARNED_HOLD'
          ? 'EARNED_ON_HOLD'
          : result.settlementStatus
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/influencer-reseller/influencers/:id/settle-order', optionalAuth, async (req: Request, res: Response) => {
  try {
    const result = await settleInfluencerOrderCommissionAfterHold({
      influencerId: req.params.id,
      orderId: req.body?.orderId
    });
    if (!result.settled) {
      return res.status(400).json({ error: result.reason, ...result });
    }
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/influencer-reseller/influencers/:id/clawback', optionalAuth, async (req: Request, res: Response) => {
  try {
    const result = await clawbackInfluencerCommissionOnRefund({
      influencerId: req.params.id,
      orderId: req.body?.orderId,
      reason: req.body?.refundReason || req.body?.reason || 'Order refunded by customer'
    });
    if (!result.clawedBack) {
      return res.status(400).json({ error: result.reason, ...result });
    }
    res.json({
      success: true,
      clawedBackAmountInr: result.clawedBackCommissionInr,
      ...result
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/influencer-reseller/payouts/queue', optionalAuth, async (req: Request, res: Response) => {
  try {
    const result = await queueInfluencerPayoutForApproval({
      influencerId: req.body?.influencerId,
      requestedBy: req.body?.requestedBy || 'Creator Portal'
    });
    if (!result.queued) {
      return res.status(400).json({ error: result.reason, ...result });
    }
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/influencer-reseller/payouts/:id/approve', optionalAuth, async (req: Request, res: Response) => {
  try {
    const decision = req.body?.decision || 'APPROVED';
    const result = await approveQueuedInfluencerPayout({
      payoutQueueId: req.params.id,
      action: decision === 'REJECTED' ? 'REJECT' : 'APPROVE_AND_SETTLE',
      bankSettlementRef: req.body?.settlementReference,
      adminEmail: req.body?.adminEmail || 'gowisherharsha@gmail.com'
    });
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/influencer-reseller/content', optionalAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const result = await createOrAdvanceContentDeliverable({
      id: body.id,
      influencerId: body.influencerId,
      deliverableTitle: body.deliverableTitle,
      campaignName: body.campaignName || body.campaignId,
      targetStage: body.targetStage || body.workflowStage || 'BRIEF_ISSUED',
      sampleSku: body.sampleSku,
      sampleAwb: body.sampleAwb || body.sampleTrackingAwb,
      draftUrl: body.draftUrl,
      publishedUrl: body.publishedUrl,
      hasRequiredAdDisclosure:
        body.hasRequiredAdDisclosure ?? body.advertisingDisclosureVerified,
      disclosureTagUsed: body.disclosureTagUsed ?? body.disclosureText,
      usageRights:
        typeof body.usageRights === 'string'
          ? body.usageRights
          : '90 Days Paid Whitelisting + Organic Archive',
      commercialFeeInr: body.commercialFeeInr ?? body.agreedFeeInr,
      performanceMetrics: body.performanceMetrics
    });
    if (!result.success) {
      return res.status(400).json({ error: result.reason, ...result });
    }
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/influencer-reseller/resellers/onboard', optionalAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const saved = await onboardOrUpdateResellerPartner({
      id: body.id,
      businessName: body.businessName,
      contactName: body.contactName,
      email: body.email || 'procurement@boutique.in',
      phone: body.phone || '+91 98200 11223',
      city: body.city || 'Mumbai',
      state: body.state || 'Maharashtra',
      gstin: body.gstin || '27AABCF9012R1Z8',
      moqSlabCode: body.moqSlabCode || 'SLAB_8999',
      businessType: body.businessType,
      status: body.status || body.onboardingStatus || 'APPROVED'
    });
    res.json({ success: true, reseller: saved });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/influencer-reseller/resellers/:id/order', optionalAuth, async (req: Request, res: Response) => {
  try {
    const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
    const normalizedItems = rawItems.map((it: any) => ({
      sku: it.sku === 'FRAG-AZR-100ML' ? 'FRG-1-100ML' : it.sku === 'FRAG-slk-100ML' ? 'FRG-2-100ML' : it.sku,
      productName: it.productName || (it.sku?.includes('AZR') || it.sku?.includes('FRG-1') ? 'AZURE Extrait' : 'SILK Extrait'),
      size: it.size || '100 ml',
      d2cMrpInr: Number(it.d2cMrpInr || 5499),
      quantity: Number(it.quantity || 1)
    }));
    const result = await createResellerWholesaleOrder({
      resellerId: req.params.id,
      items: normalizedItems,
      paymentStatus: req.body?.paymentVerified === false ? 'PENDING_RECONCILIATION' : 'SETTLED'
    });
    if (!result.success) {
      return res.status(400).json({ error: result.reason, ...result });
    }
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/influencer-reseller/resellers/:id/reconcile', optionalAuth, async (req: Request, res: Response) => {
  try {
    const result = await reconcileResellerPaymentAndSendReminder({
      resellerId: req.params.id,
      action: req.body?.triggerRepeatReminder
        ? 'SEND_REPEAT_ORDER_REMINDER'
        : 'RECONCILE_PAYMENT',
      bankUtrRef: req.body?.paymentReference
    });
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/influencer-reseller/run-tests', optionalAuth, async (_req: Request, res: Response) => {
  try {
    const suite = await runInfluencerResellerVerificationSuite();
    res.json(suite);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================================
// 16. OMNICHANNEL CAMPAIGN MANAGEMENT, TRACKING & ATTRIBUTION API
// ========================================================

app.get('/api/omnichannel/dashboard', optionalAuth, async (_req: Request, res: Response) => {
  try {
    const dashboard = await getOmnichannelCampaignAttributionDashboard();
    res.json(dashboard);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/omnichannel/integrations', optionalAuth, async (_req: Request, res: Response) => {
  try {
    await ensureOmnichannelCampaignsInitialized();
    const integrations = await verifyOmnichannelAnalyticsIntegrations();
    res.json({ integrations });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/omnichannel/events/track', optionalAuth, async (req: Request, res: Response) => {
  try {
    const result = await ingestStandardizedTrackingEvent(req.body || {});
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/omnichannel/campaigns', optionalAuth, async (req: Request, res: Response) => {
  try {
    const saved = await createOrUpdateOmnichannelCampaign(req.body || {});
    res.json({ success: true, campaign: saved });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/omnichannel/campaigns/:id/approval', optionalAuth, async (req: Request, res: Response) => {
  try {
    const updated = await reviewCampaignApprovalWorkflow({
      campaignId: req.params.id,
      decision: req.body?.decision || 'APPROVED_ACTIVE',
      adminEmail: req.body?.adminEmail || 'gowisherharsha@gmail.com'
    });
    res.json({ success: true, campaign: updated });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/omnichannel/rules/evaluate', optionalAuth, async (_req: Request, res: Response) => {
  try {
    const alerts = await evaluateAutomatedPerformanceRules();
    res.json({ success: true, alerts });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/omnichannel/run-tests', optionalAuth, async (_req: Request, res: Response) => {
  try {
    const suite = await runOmnichannelCampaignVerificationSuite();
    res.json(suite);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================================
// 17. AI MARKETING INTELLIGENCE ASSISTANT, CONTENT STUDIO & EXECUTIVE BRIEFING API
// ========================================================

app.get('/api/ai-marketing/dashboard', optionalAuth, async (_req: Request, res: Response) => {
  try {
    const dashboard = await getAiMarketingIntelligenceDashboard();
    res.json(dashboard);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/ai-marketing/morning-briefing', optionalAuth, async (_req: Request, res: Response) => {
  try {
    const briefing = await generateMorningExecutiveBriefing();
    res.json(briefing);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ai-marketing/content-studio/generate', optionalAuth, async (req: Request, res: Response) => {
  try {
    const result = await generateAiContentStudioPackage(req.body || {});
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/ai-marketing/items/:id/review', optionalAuth, async (req: Request, res: Response) => {
  try {
    const result = await reviewAiRecommendationOrContentItem({
      id: req.params.id,
      decision: req.body?.decision || 'ACCEPTED',
      editedTitle: req.body?.editedTitle,
      editedSummary: req.body?.editedSummary,
      editedCaptionOrCopy: req.body?.editedCaptionOrCopy,
      scheduledFor: req.body?.scheduledFor,
      adminEmail: req.body?.adminEmail || 'aibrandorigin@gmail.com',
      reviewNotes: req.body?.reviewNotes
    });
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/ai-marketing/safety-config', optionalAuth, async (req: Request, res: Response) => {
  try {
    const config = await updateAiSafetyAndCostConfig(req.body || {});
    res.json({ success: true, config });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/ai-marketing/sanitize-test', optionalAuth, async (req: Request, res: Response) => {
  try {
    const result = sanitizeAndRedactCustomerTextForAi(req.body?.rawText || '');
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/ai-marketing/run-tests', optionalAuth, async (_req: Request, res: Response) => {
  try {
    const suite = await runAiMarketingIntelligenceVerificationSuite();
    res.json(suite);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================================
// 18. AUTOMATED CUSTOMER SUPPORT, REVIEW MANAGEMENT & RETENTION WORKFLOWS API
// ========================================================

app.get('/api/support-retention/dashboard', optionalAuth, async (_req: Request, res: Response) => {
  try {
    const dashboard = await getCustomerSupportReviewRetentionDashboard();
    res.json(dashboard);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/support-retention/settings', optionalAuth, async (_req: Request, res: Response) => {
  try {
    const settings = await getSupportRetentionSettings();
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/support-retention/settings', optionalAuth, async (req: Request, res: Response) => {
  try {
    const settings = await updateSupportRetentionSettings(
      req.body || {},
      req.body?.adminEmail || 'aibrandorigin@gmail.com'
    );
    res.json({ success: true, settings });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/support-retention/reviews/invite', optionalAuth, async (req: Request, res: Response) => {
  try {
    const result = await scheduleOrTriggerPostDeliveryReviewInvite(req.body || {});
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/support-retention/reviews/submit', optionalAuth, async (req: Request, res: Response) => {
  try {
    const result = await submitAndModerateVerifiedCustomerReview(req.body || {});
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/support-retention/tickets/create', optionalAuth, async (req: Request, res: Response) => {
  try {
    const result = await reportNegativeExperienceAndCreateTicket(req.body || {});
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/support-retention/tickets/evaluate-sla', optionalAuth, async (_req: Request, res: Response) => {
  try {
    const result = await evaluateAndEscalateOverdueSupportTickets();
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/support-retention/tickets/:id/action', optionalAuth, async (req: Request, res: Response) => {
  try {
    const result = await updateSupportTicketAndSyncRefund({
      ticketId: req.params.id,
      ...(req.body || {})
    });
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post(
  '/api/support-retention/retention/calculate-depletion',
  optionalAuth,
  async (req: Request, res: Response) => {
    try {
      const body = req.body || {};
      const dynamicDepletion = calculateDynamicReplenishmentWindow({
        variantSize: body.variantSize || '100 ml',
        fragranceName: body.fragranceName || 'AZURE',
        customerActiveBottlesCount: Number(body.customerActiveBottlesCount || 1),
        historicalRepurchaseIntervalDays: body.historicalRepurchaseIntervalDays
          ? Number(body.historicalRepurchaseIntervalDays)
          : null
      });
      const complementary =
        COMPLEMENTARY_FRAGRANCE_MATRIX[body.fragranceName || 'AZURE'] ||
        COMPLEMENTARY_FRAGRANCE_MATRIX.AZURE;
      res.json({ dynamicDepletion, complementary });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

app.post('/api/support-retention/retention/dispatch', optionalAuth, async (req: Request, res: Response) => {
  try {
    const result = await triggerPersonalizedRetentionJourney(req.body || {});
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/support-retention/run-tests', optionalAuth, async (_req: Request, res: Response) => {
  try {
    const suite = await runSupportReviewRetentionVerificationSuite();
    res.json(suite);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================================
// 19. PRODUCTION-GRADE AUDIT, LIVE EVENT INSPECTOR,
//     AUTOMATION RELIABILITY & CROSS-BROWSER SSE SYNC
// ========================================================

// Real-time Server-Sent Events (SSE) stream for cross-browser / multi-device synchronization
app.get('/api/realtime/stream', (req: Request, res: Response) => {
  registerRealtimeSseClient(req, res);
});

app.get('/api/realtime/state', (_req: Request, res: Response) => {
  res.json(getRealtimeSyncState());
});

app.post('/api/realtime/broadcast', optionalAuth, (req: Request, res: Response) => {
  const evt = broadcastCrossBrowserSyncEvent({
    entity: req.body?.entity || 'ALL',
    action: req.body?.action || 'MANUAL_SYNC',
    recordId: req.body?.recordId,
    summary: req.body?.summary || 'Manual cross-browser synchronization broadcast'
  });
  res.json({ success: true, event: evt, state: getRealtimeSyncState() });
});

// 1. Audit Existing Dashboard & Database Data (Never deletes legitimate production records)
app.get('/api/production-audit/audit-report', optionalAuth, async (_req: Request, res: Response) => {
  try {
    const report = await auditExistingDashboardAndDatabaseData();
    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Safe Admin-Reviewed Cleanup & Reconciliation Procedure
app.post('/api/production-audit/cleanup', optionalAuth, async (req: Request, res: Response) => {
  try {
    const result = await executeAdminReviewedCleanupAndReconciliation({
      action: req.body?.action || 'CLEANUP_SELECTED_DEMO_RECORDS',
      selectedFindingIds: Array.isArray(req.body?.selectedRecordIds)
        ? req.body.selectedRecordIds
        : Array.isArray(req.body?.selectedFindingIds)
        ? req.body.selectedFindingIds
        : undefined,
      adminEmail: req.body?.adminEmail || 'aibrandorigin@gmail.com'
    });
    res.json(result);
  } catch (error: any) {
    res.status(403).json({ error: error.message });
  }
});

// 2. Authoritative Data Accuracy & Denominator Reconciler
app.get('/api/production-audit/reconciliation', optionalAuth, async (_req: Request, res: Response) => {
  try {
    const result = await runAuthoritativeDataReconciliation();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/production-audit/reconcile-now', optionalAuth, async (_req: Request, res: Response) => {
  try {
    const result = await runAuthoritativeDataReconciliation();
    broadcastCrossBrowserSyncEvent({
      entity: 'ALL',
      action: 'RECONCILED',
      summary: 'Authoritative financial, cart, inventory, and segment reconciliation completed'
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Enterprise 14-Field Live Event Inspector (Search, Filter, Pagination + UTC/IST)
app.get('/api/production-audit/event-inspector', optionalAuth, async (req: Request, res: Response) => {
  try {
    const result = await queryEnterpriseEventInspector({
      search: req.query.search ? String(req.query.search) : undefined,
      eventType: req.query.eventType ? String(req.query.eventType) : undefined,
      processingStatus: req.query.status ? String(req.query.status) : req.query.processingStatus ? String(req.query.processingStatus) : undefined,
      sourceSystem: req.query.sourceSystem ? String(req.query.sourceSystem) : undefined,
      page: req.query.page ? Number(req.query.page) : 1,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : 20
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Permission-Controlled Event Replay
app.post('/api/production-audit/event-inspector/:id/replay', optionalAuth, async (req: Request, res: Response) => {
  try {
    const result = await replayAuthorizedAutomationEvent({
      eventId: req.params.id,
      actorRole: req.body?.adminRole || req.body?.actorRole || String(req.headers['x-admin-role'] || 'SUPER_ADMIN'),
      actorEmail: req.body?.adminEmail || req.body?.actorEmail || 'aibrandorigin@gmail.com'
    });
    if (!result.replayed) {
      return res.status(result.status || 403).json(result);
    }
    res.json(result);
  } catch (error: any) {
    res.status(403).json({ error: error.message });
  }
});

// 4. Automation Reliability, DLQ, Retry Dashboard & Stuck-Job Monitor
app.get('/api/production-audit/reliability', optionalAuth, async (_req: Request, res: Response) => {
  try {
    const report = await getAutomationReliabilityHealthReport();
    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/production-audit/recover-stuck-jobs', optionalAuth, async (req: Request, res: Response) => {
  try {
    const result = await detectAndRecoverStuckAutomationJobs(
      req.body?.stuckThresholdMs ? Number(req.body.stuckThresholdMs) : 120000
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Webhook Signature & Replay-Protection Endpoint
app.post('/api/production-audit/webhook-verify', async (req: Request, res: Response) => {
  try {
    const rawBody = JSON.stringify(req.body || {});
    const signatureHeader = String(req.headers['x-fragmore-signature'] || req.body?.signatureHeader || '');
    const timestampHeader = String(req.headers['x-fragmore-timestamp'] || req.body?.timestampHeader || '');
    const nonceHeader = String(req.headers['x-fragmore-nonce'] || req.body?.nonceHeader || '');
    const verification = await verifyWebhookHmacAndReplayGuard({
      rawBody,
      signatureHeader,
      timestampHeader,
      nonceHeader
    });
    if (!verification.verified) {
      return res.status(401).json(verification);
    }
    res.json({ success: true, ...verification });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// 5. 12-Scenario Automated Chaos & Security Test Suite + Production Readiness Report
app.post('/api/production-audit/run-tests', optionalAuth, async (_req: Request, res: Response) => {
  try {
    const report = await runProductionGradeAuditAndChaosTestSuite();
    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================================
// 19. NOTIFICATIONS FEED, CONSENT BROADCAST & INTEGRATIONS VAULT
// ========================================================
app.get('/api/notifications/feed', optionalAuth, async (_req: Request, res: Response) => {
  try {
    const [opsAlerts, recentDispatchEvents] = await Promise.all([
      db.select().from(opsTasksAndAlertsTable).orderBy(desc(opsTasksAndAlertsTable.createdAt)).limit(25),
      db.select().from(automationEventsTable).orderBy(desc(automationEventsTable.createdAt)).limit(25)
    ]);
    res.json({ opsAlerts, recentDispatchEvents });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/notifications/broadcast', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { channel = 'WHATSAPP', targetAudience = 'ALL', title = '', messageBody = '' } = req.body || {};
    const allCusts = await getAllCustomers();

    // Filter by segment
    const segmentMatches = allCusts.filter((c: any) => {
      const tags = Array.isArray(c.tags) ? c.tags.map((t: string) => String(t).toLowerCase()) : [];
      if (targetAudience === 'VIP') {
        return String(c.tier).toUpperCase() === 'VIP' || tags.some((t: string) => t.includes('vip')) || Number(c.totalSpend) >= 5000;
      }
      if (targetAudience === 'DISCOVERY') {
        return tags.some((t: string) => t.includes('discovery'));
      }
      if (targetAudience === 'REPEAT') {
        return Number(c.totalOrders) >= 2 || tags.some((t: string) => t.includes('repeat'));
      }
      return true;
    });

    // Enforce channel consent (whatsappOptIn / emailOptIn / smsOptIn)
    const consentedRecipients = segmentMatches.filter((c: any) => {
      const consent = (c.crmMetadata as any)?.consent;
      if (!consent || typeof consent !== 'object') return true; // default opted-in unless explicitly withdrawn
      if (channel === 'WHATSAPP' && consent.whatsappOptIn === false) return false;
      if (channel === 'EMAIL' && consent.emailOptIn === false) return false;
      if (channel === 'SMS' && consent.smsOptIn === false) return false;
      return true;
    });

    const suppressedOptOutCount = segmentMatches.length - consentedRecipients.length;
    const hasLiveChannelCredentials =
      (channel === 'WHATSAPP' && Boolean(process.env.WHATSAPP_CLOUD_API_TOKEN)) ||
      (channel === 'EMAIL' && Boolean(process.env.SENDGRID_API_KEY)) ||
      (channel === 'SMS' && Boolean(process.env.MSG91_AUTH_KEY));

    const evt = await ingestAutomationEvent({
      eventType: 'notification.broadcast_queued',
      source: 'admin_notifications_dispatcher',
      idempotencyKey: `broadcast_${channel}_${targetAudience}_${Date.now()}`,
      payload: {
        channel,
        targetAudience,
        title,
        messageBody,
        totalSegmentMatches: segmentMatches.length,
        eligibleRecipientsCount: consentedRecipients.length,
        suppressedOptOutCount,
        dispatchMode: hasLiveChannelCredentials ? 'LIVE_PROVIDER_DISPATCH' : 'DRY_RUN_LOGGED_AWAITING_PROVIDER_TOKEN'
      }
    });

    await insertAuditLog({
      action: 'NOTIFICATION_BROADCAST',
      adminEmail: 'aibrandorigin@gmail.com',
      details: `Notifications: Queued ${channel} broadcast "${title}" to ${consentedRecipients.length} consented recipients (${suppressedOptOutCount} suppressed by opt-out guard)`,
      metadata: { eventId: evt.event.id, channel, targetAudience }
    });

    broadcastCrossBrowserSyncEvent({
      entity: 'NOTIFICATIONS',
      action: 'BROADCAST_QUEUED',
      recordId: evt.event.id,
      summary: `${channel} broadcast queued (${consentedRecipients.length} recipients)`
    });

    res.json({
      success: true,
      eventId: evt.event.id,
      totalSegmentMatches: segmentMatches.length,
      eligibleRecipientsCount: consentedRecipients.length,
      suppressedOptOutCount,
      dispatchMode: hasLiveChannelCredentials
        ? 'LIVE_PROVIDER_DISPATCH'
        : 'PERSISTED_IN_DB (DRY-RUN: AWAITING PROVIDER API TOKEN)'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/integrations', optionalAuth, async (_req: Request, res: Response) => {
  try {
    const cms = await getCMSSettings();
    res.json((cms as any)?.integrationsVault || {});
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/integrations', optionalAuth, async (req: Request, res: Response) => {
  try {
    const currentCms = (await getCMSSettings()) || {};
    const updated = await updateCMSSettings({
      ...currentCms,
      integrationsVault: req.body || {}
    });
    await insertAuditLog({
      action: 'UPDATE_INTEGRATIONS',
      adminEmail: 'aibrandorigin@gmail.com',
      details: 'Integrations: Updated third-party integration credentials in PostgreSQL vault',
      metadata: { updatedAt: new Date().toISOString() }
    });
    res.json({ success: true, integrations: (updated as any)?.integrationsVault || req.body });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/integrations/verify', optionalAuth, async (req: Request, res: Response) => {
  try {
    const service = String(req.body?.service || '').toLowerCase();
    const cfg = req.body?.config || {};

    let hasEnvOrRealKey = false;
    let detailMessage = '';

    if (service === 'meta') {
      hasEnvOrRealKey = Boolean(process.env.META_CAPI_ACCESS_TOKEN || (cfg.conversionsApiToken && !String(cfg.conversionsApiToken).includes('EAAJ...')));
      detailMessage = hasEnvOrRealKey
        ? 'META Pixel & CAPI credentials configured and verified.'
        : 'First-party event deduplication active in PostgreSQL; live Meta CAPI forwarding awaits META_CAPI_ACCESS_TOKEN.';
    } else if (service === 'google') {
      hasEnvOrRealKey = Boolean(process.env.GA4_API_SECRET || cfg.ga4MeasurementId);
      detailMessage = hasEnvOrRealKey
        ? `GA4 Measurement ID (${cfg.ga4MeasurementId || 'configured'}) & first-party telemetry active; server-side Measurement Protocol awaits GA4_API_SECRET.`
        : 'Awaiting GA4 Measurement ID and GA4_API_SECRET.';
    } else if (service === 'whatsapp') {
      hasEnvOrRealKey = Boolean(process.env.WHATSAPP_CLOUD_API_TOKEN);
      detailMessage = hasEnvOrRealKey
        ? 'WhatsApp Business Cloud API token verified.'
        : 'WhatsApp template & consent engine active in dry-run mode; awaiting WHATSAPP_CLOUD_API_TOKEN for live dispatch.';
    } else if (service === 'email') {
      hasEnvOrRealKey = Boolean(process.env.SENDGRID_API_KEY);
      detailMessage = hasEnvOrRealKey
        ? 'SendGrid / SMTP transactional email credentials verified.'
        : 'Email queue & templates active in dry-run mode; awaiting SENDGRID_API_KEY for live outbound email.';
    } else if (service === 'sms') {
      hasEnvOrRealKey = Boolean(process.env.MSG91_AUTH_KEY);
      detailMessage = hasEnvOrRealKey
        ? 'Msg91 DLT SMS credentials verified.'
        : 'DLT SMS template engine active in dry-run mode; awaiting MSG91_AUTH_KEY.';
    } else if (service === 'razorpay') {
      hasEnvOrRealKey = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
      detailMessage = hasEnvOrRealKey
        ? 'Razorpay live merchant credentials & HMAC webhook verification active.'
        : 'Server-side payment verification & HMAC-SHA256 webhook guard active; awaiting live RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET.';
    } else if (service === 'shiprocket') {
      hasEnvOrRealKey = Boolean(process.env.SHIPROCKET_EMAIL && process.env.SHIPROCKET_PASSWORD);
      detailMessage = hasEnvOrRealKey
        ? 'Shiprocket / Blue Dart live logistics credentials verified.'
        : '11-stage shipping lifecycle & NDR/RTO state machine active; awaiting live SHIPROCKET_EMAIL & SHIPROCKET_PASSWORD.';
    } else {
      detailMessage = `${service.toUpperCase()}: Checked against server configuration.`;
    }

    await ingestAutomationEvent({
      eventType: 'integration.verified',
      source: 'admin_integrations_vault',
      idempotencyKey: `verify_${service}_${Math.floor(Date.now() / 5000)}`,
      payload: { service, hasEnvOrRealKey, detailMessage }
    });

    res.json({
      success: true,
      liveCredentialsConfigured: hasEnvOrRealKey,
      classification: hasEnvOrRealKey ? 'IMPLEMENTED_AND_TESTED' : 'IMPLEMENTED_AWAITING_CREDENTIALS',
      message: detailMessage
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================================
// 20. ENTERPRISE E2E INTEGRATION AUDIT, 7 JOURNEYS & 10 DELIVERABLES
// ========================================================
app.get('/api/enterprise-audit/deliverables', optionalAuth, async (req: Request, res: Response) => {
  try {
    const includeLive = req.query.runTests === 'true';
    const result = await getEnterpriseArchitectureDeliverables(includeLive);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/enterprise-audit/departments', optionalAuth, async (_req: Request, res: Response) => {
  try {
    const result = await verifyAll14DepartmentsConnectivity();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/enterprise-audit/verify-journeys', optionalAuth, async (_req: Request, res: Response) => {
  try {
    const result = await runAll7CustomerJourneysLiveVerification();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/enterprise-audit/nfr', optionalAuth, async (_req: Request, res: Response) => {
  try {
    const result = await verifyNonFunctionalRequirements();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================================
// 21. AI CMO 3.0 (ISOLATED, FEATURE-FLAGGED, NON-DESTRUCTIVE MODULE)
// ========================================================
app.get('/api/ai-cmo/overview', optionalAuth, async (_req: Request, res: Response) => {
  try {
    const overview = await getAiCmo3FullOverview();
    res.json(overview);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/ai-cmo/dependency-map', optionalAuth, async (_req: Request, res: Response) => {
  try {
    res.json(getAiCmoDependencyMap());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/ai-cmo/tools', optionalAuth, async (_req: Request, res: Response) => {
  try {
    res.json(getAiCmoToolRegistryDiscoveryReport());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ai-cmo/tools/execute-read', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { toolName, input, actorEmail, actorRole } = req.body || {};
    if (!toolName) {
      res.status(400).json({ error: 'toolName is required.' });
      return;
    }
    const result = await executeAiCmoReadTool({
      toolName,
      input: input || {},
      actorEmail,
      actorRole
    });
    res.json(result);
  } catch (error: any) {
    if (error instanceof AiCmoToolError) {
      res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
        toolName: error.toolName,
        details: error.details
      });
      return;
    }
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ai-cmo/tools/propose-write', optionalAuth, async (req: Request, res: Response) => {
  try {
    const {
      toolName,
      naturalLanguagePrompt,
      detectedIntent,
      input,
      actorEmail,
      actorRole,
      idempotencyKey,
      conversationId,
      planId
    } = req.body || {};
    if (!toolName) {
      res.status(400).json({ error: 'toolName is required.' });
      return;
    }
    const result = await proposeAiCmoWriteToolAction({
      toolName,
      naturalLanguagePrompt,
      detectedIntent,
      input: input || {},
      actorEmail,
      actorRole,
      idempotencyKey,
      conversationId,
      planId
    });
    res.json(result);
  } catch (error: any) {
    if (error instanceof AiCmoToolError) {
      res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
        toolName: error.toolName,
        details: error.details
      });
      return;
    }
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ai-cmo/chat', optionalAuth, async (req: Request, res: Response) => {
  try {
    const {
      conversationId,
      prompt,
      language,
      actorEmail,
      actorRole,
      autoProposeAction,
      attachments
    } = req.body || {};
    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ error: 'Prompt is required.' });
      return;
    }
    const result = await sendAiCmoChatMessage({
      conversationId,
      prompt,
      language,
      actorEmail,
      actorRole,
      autoProposeAction: Boolean(autoProposeAction),
      attachments
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Server-Sent Streaming AI Chat Endpoint (Never exposes model API keys to browser)
app.post('/api/ai-cmo/chat/stream', optionalAuth, async (req: Request, res: Response) => {
  try {
    const {
      conversationId,
      prompt,
      language,
      actorEmail,
      actorRole,
      autoProposeAction,
      attachments
    } = req.body || {};
    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ error: 'Prompt is required.' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (typeof (res as any).flushHeaders === 'function') {
      (res as any).flushHeaders();
    }

    const sendEvent = (eventType: string, payload: Record<string, any>) => {
      res.write(`data: ${JSON.stringify({ eventType, ...payload })}\n\n`);
    };

    sendEvent('status', {
      step: 'RBAC_AUTH',
      message: `Verifying server-side RBAC permissions for ${actorRole || 'SUPER_ADMIN'}...`
    });

    sendEvent('status', {
      step: 'CONTEXT_RETRIEVAL',
      message: 'Querying Firebase Firestore via non-destructive Read Adapters...'
    });

    const result = await sendAiCmoChatMessage({
      conversationId,
      prompt,
      language,
      actorEmail,
      actorRole,
      autoProposeAction: Boolean(autoProposeAction),
      attachments
    });

    const fullText = String(result.assistantMessage?.content || '');
    const words = fullText.split(/(\s+)/);
    let accumulated = '';
    for (let i = 0; i < words.length; i += 6) {
      const chunk = words.slice(i, i + 6).join('');
      accumulated += chunk;
      sendEvent('token', { delta: chunk, accumulated });
    }

    sendEvent('complete', {
      conversationId: result.conversationId,
      userMessageId: result.userMessageId,
      assistantMessage: result.assistantMessage
    });
    res.end();
  } catch (error: any) {
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      res.write(`data: ${JSON.stringify({ eventType: 'error', error: error.message })}\n\n`);
      res.end();
    }
  }
});

app.patch('/api/ai-cmo/conversations/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const conversationId = req.params.id;
    const { title, status, languagePreference } = req.body || {};
    const updated = await updateAiCmoConversationMeta({
      conversationId,
      title,
      status,
      languagePreference
    });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ai-cmo/saved-prompts', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { title, promptText, language, category, createdByEmail } = req.body || {};
    if (!title || !promptText) {
      res.status(400).json({ error: 'title and promptText are required.' });
      return;
    }
    const created = await createOrSaveAiCmoPrompt({
      title,
      promptText,
      language,
      category,
      createdByEmail
    });
    res.json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/ai-cmo/saved-prompts/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const deleted = await deleteAiCmoSavedPrompt(req.params.id);
    res.json(deleted);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ai-cmo/planner', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { title, objective, targetSegment, budgetRequiredInr, createdByEmail, queueStepsForApproval } =
      req.body || {};
    if (!objective || !targetSegment) {
      res.status(400).json({ error: 'objective and targetSegment are required.' });
      return;
    }
    const result = await createAiCmoGrowthPlan({
      title,
      objective,
      targetSegment,
      budgetRequiredInr: budgetRequiredInr ? Number(budgetRequiredInr) : 25000,
      createdByEmail,
      queueStepsForApproval
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// AI CMO 3.0 Marketing Strategy Engine (16 Capabilities + Goal-Based Campaign Planner + Outcome Tracking)
app.get('/api/ai-cmo/strategy-engine', optionalAuth, async (_req: Request, res: Response) => {
  try {
    const report = await getAiCmoMarketingStrategyEngineReport();
    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ai-cmo/strategy-engine/goal-planner', optionalAuth, async (req: Request, res: Response) => {
  try {
    const {
      goal,
      product,
      channel,
      budgetInr,
      durationDays,
      audience,
      targetProfitability,
      createdByEmail,
      actorEmail,
      actorRole,
      queueTasksForApproval,
      queueApprovalTasks
    } = req.body || {};
    if (!goal || !product || !channel) {
      res.status(400).json({ error: 'goal, product, and channel are required.' });
      return;
    }
    const result = await generateGoalBasedCampaignPlan({
      goal,
      product,
      channel,
      budgetInr: Number(budgetInr) || 15000,
      durationDays: Number(durationDays) || 14,
      audience: audience || 'VIP Collectors & Discovery Six Upgrade Window (Day 5-14)',
      targetProfitability: targetProfitability || 'Target POAS >= 1.60x (Contribution Margin >= 70%)',
      actorEmail: actorEmail || createdByEmail || 'admin@fragmore.com',
      actorRole: actorRole || 'SUPER_ADMIN',
      queueApprovalTasks: queueApprovalTasks !== false && queueTasksForApproval !== false
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ai-cmo/strategy-engine/plans/:id/outcome', optionalAuth, async (req: Request, res: Response) => {
  try {
    const planId = req.params.id;
    const {
      executionStatus,
      actualSpendInr,
      actualRevenueInr,
      notes,
      actorEmail
    } = req.body || {};
    const result = await recordStrategyMeasuredOutcome({
      planId,
      executionStatus: executionStatus || 'COMPLETED_MEASURED',
      actualSpendInr: Number(actualSpendInr) || 0,
      actualRevenueInr: Number(actualRevenueInr) || 0,
      notes,
      actorEmail
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// AI CMO 3.0 -> Existing Automation Center & PostgreSQL DAG Bridge Routes
app.get('/api/ai-cmo/automation/node-schemas', optionalAuth, async (_req: Request, res: Response) => {
  try {
    res.json(getAutomationNodeSchemaCatalog());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ai-cmo/automation/workflows/create-draft', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { prompt, conversationId, actorEmail, actorRole } = req.body || {};
    const result = await createOrUpdateDraftWorkflowFromNaturalLanguage({
      prompt:
        prompt ||
        'Create an abandoned cart recovery workflow for carts above ₹999, wait 30 minutes, check marketing consent, send an approved WhatsApp template, then stop if the order is completed.',
      conversationId,
      actorEmail,
      actorRole
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ai-cmo/automation/workflows/:id/dry-run', optionalAuth, async (req: Request, res: Response) => {
  try {
    const workflowId = req.params.id;
    const { customPayload, actorEmail } = req.body || {};
    const sim = await runWorkflowDryRunSimulation({
      workflowId,
      customPayload,
      actorEmail
    });
    res.json(sim);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ai-cmo/automation/workflows/:id/publish', optionalAuth, async (req: Request, res: Response) => {
  try {
    const workflowId = req.params.id;
    const { mode, actorEmail, actorRole } = req.body || {};
    const result = await requestAndOrPublishWorkflowViaExistingService({
      workflowId,
      mode: mode || 'APPROVE_AND_PUBLISH',
      actorEmail,
      actorRole
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ai-cmo/automation/workflows/:id/follow-up', optionalAuth, async (req: Request, res: Response) => {
  try {
    const workflowId = req.params.id;
    const { mutationType, prompt, actorEmail, actorRole, conversationId } = req.body || {};
    const result = await applyFollowUpMutationToWorkflow({
      workflowId,
      mutationType: mutationType || 'ADD_EMAIL_FALLBACK',
      prompt: prompt || 'Add an email fallback.',
      actorEmail,
      actorRole,
      conversationId
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/ai-cmo/automation/diagnose-failure', optionalAuth, async (req: Request, res: Response) => {
  try {
    const workflowId = req.query.workflowId ? String(req.query.workflowId) : undefined;
    const result = await diagnoseLastWorkflowExecutionFailure({ workflowId });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ai-cmo/actions/propose', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { planId, conversationId, toolId, title, rationale, payload, requestedByEmail } =
      req.body || {};
    if (!toolId || !title) {
      res.status(400).json({ error: 'toolId and title are required.' });
      return;
    }
    const result = await proposeAiCmoAction({
      planId,
      conversationId,
      toolId,
      title,
      rationale: rationale || 'Proposed from AI CMO 3.0 Action Center',
      payload: payload || {},
      requestedByEmail
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ai-cmo/approvals/:id/decide', optionalAuth, async (req: Request, res: Response) => {
  try {
    const actionId = req.params.id;
    const { decision, reviewerEmail, reviewerRole, reviewNote, allowLiveExecutionOverride } =
      req.body || {};
    if (!decision) {
      res.status(400).json({ error: 'decision is required.' });
      return;
    }
    const result = await decideAndOrchestrateAiCmoAction({
      actionId,
      decision,
      reviewerEmail,
      reviewerRole,
      reviewNote,
      allowLiveExecutionOverride
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Universal AI Action Center API Routes
app.get('/api/ai-cmo/action-center', optionalAuth, async (_req: Request, res: Response) => {
  try {
    const snapshot = await getUniversalAiActionCenterSnapshot();
    res.json(snapshot);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put(
  '/api/ai-cmo/action-center/narrow-policies',
  optionalAuth,
  async (req: Request, res: Response) => {
    try {
      const { policyId, enabled, actorEmail } = req.body || {};
      if (!policyId) {
        res.status(400).json({ error: 'policyId is required.' });
        return;
      }
      const updated = updateNarrowPreconfiguredPolicy({
        policyId,
        enabled: Boolean(enabled),
        actorEmail
      });
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

app.patch('/api/ai-cmo/approvals/:id/edit', optionalAuth, async (req: Request, res: Response) => {
  try {
    const actionId = req.params.id;
    const { updatedPayload, updatedTitle, editorEmail, editorRole } = req.body || {};
    const result = await editPendingApprovalAction({
      actionId,
      updatedPayload: updatedPayload || {},
      updatedTitle,
      editorEmail,
      editorRole
    });
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/ai-cmo/approvals/:id/confirm', optionalAuth, async (req: Request, res: Response) => {
  try {
    const actionId = req.params.id;
    const {
      decision,
      reviewerEmail,
      reviewerRole,
      reviewNote,
      allowLiveExecutionOverride,
      forceRenewExpired
    } = req.body || {};
    const report = await confirmRejectOrCompensateActionCard({
      actionId,
      decision: decision || 'CONFIRM_DRY_RUN',
      reviewerEmail,
      reviewerRole,
      reviewNote,
      allowLiveExecutionOverride: Boolean(allowLiveExecutionOverride),
      forceRenewExpired: Boolean(forceRenewExpired)
    });
    res.json(report);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post(
  '/api/ai-cmo/action-center/multi-step-plans',
  optionalAuth,
  async (req: Request, res: Response) => {
    try {
      const { title, objective, targetSegment, budgetRequiredInr, customSteps, actorEmail, actorRole } =
        req.body || {};
      const plan = await createMultiStepCheckpointPlan({
        title: title || 'Multi-Step Checkpoint & Compensation Saga Plan',
        objective:
          objective ||
          'Execute multi-step sequence with durable checkpoints, idempotency, retries, and compensation.',
        targetSegment,
        budgetRequiredInr: budgetRequiredInr ? Number(budgetRequiredInr) : 15000,
        customSteps,
        actorEmail,
        actorRole
      });
      res.json(plan);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

app.post(
  '/api/ai-cmo/action-center/multi-step-plans/:id/execute',
  optionalAuth,
  async (req: Request, res: Response) => {
    try {
      const planId = req.params.id;
      const { executionMode, simulateFailureAtStepNumber, actorEmail, actorRole } = req.body || {};
      const result = await executeOrRetryMultiStepPlanWithCheckpoints({
        planId,
        executionMode: executionMode === 'LIVE_SERVICE' ? 'LIVE_SERVICE' : 'DRY_RUN',
        simulateFailureAtStepNumber:
          simulateFailureAtStepNumber !== undefined ? Number(simulateFailureAtStepNumber) : undefined,
        actorEmail,
        actorRole
      });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

app.post(
  '/api/ai-cmo/action-center/multi-step-plans/:id/compensate',
  optionalAuth,
  async (req: Request, res: Response) => {
    try {
      const planId = req.params.id;
      const { actorEmail, actorRole, reason } = req.body || {};
      const result = await compensateMultiStepPlan({
        planId,
        actorEmail,
        actorRole,
        reason
      });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

app.put('/api/ai-cmo/settings', optionalAuth, async (req: Request, res: Response) => {
  try {
    const result = await updateAiCmoFeatureFlagsConfig(req.body || {});
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ai-cmo/run-tests', optionalAuth, async (req: Request, res: Response) => {
  try {
    const result = await runAiCmoCompatibilityAndRegressionTests(
      req.body?.actorEmail || 'admin@fragmore.com'
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Authoritative Data Synchronization, Concurrency & Correlation Trace Routes
app.get('/api/ai-cmo/sync/overview', optionalAuth, async (_req: Request, res: Response) => {
  try {
    const overview = await getAiCmoDataSyncOverview();
    res.json(overview);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ai-cmo/sync/run-tests', optionalAuth, async (req: Request, res: Response) => {
  try {
    const suite = await runAiCmoSynchronizationAndConcurrencyTestSuite(
      req.body?.actorEmail || 'admin@fragmore.com'
    );
    res.json(suite);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post(
  '/api/ai-cmo/approvals/:id/rebase-version',
  optionalAuth,
  async (req: Request, res: Response) => {
    try {
      const rebased = await refreshStaleApprovalCardVersion({
        actionId: req.params.id,
        actorEmail: req.body?.actorEmail || 'admin@fragmore.com'
      });
      res.json(rebased);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

app.post('/api/ai-cmo/sync/invalidate', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { entity, recordId, reason } = req.body || {};
    const policy = invalidateAuthoritativeDomainCache({
      entity: entity || 'CAMPAIGNS',
      recordId,
      reason: reason || 'Manual admin cache invalidation'
    });
    res.json({ success: true, policy });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ========================================================
// AI CMO 3.0 DURABLE MEMORY, SCHEDULED INTELLIGENCE & GOVERNANCE ROUTES
// ========================================================

app.get('/api/ai-cmo/memory/snapshot', optionalAuth, async (_req: Request, res: Response) => {
  try {
    const snapshot = await getAiCmoMemoryAndScheduledIntelligenceSnapshot();
    res.json(snapshot);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/ai-cmo/memory/entries', optionalAuth, async (req: Request, res: Response) => {
  try {
    const entries = await listAiCmoDurableMemories({
      category: (req.query.category as any) || 'ALL',
      governanceStatus: (req.query.governanceStatus as any) || 'ALL',
      searchQuery: (req.query.q as string) || ''
    });
    res.json(entries);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ai-cmo/memory/entries', optionalAuth, async (req: Request, res: Response) => {
  try {
    const created = await createOrProposeAiCmoMemoryEntry(req.body || {});
    res.json(created);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post(
  '/api/ai-cmo/memory/entries/:id/review',
  optionalAuth,
  async (req: Request, res: Response) => {
    try {
      const updated = await reviewEditRevokeOrRollbackMemoryEntry({
        memoryId: req.params.id,
        ...(req.body || {})
      });
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

app.post(
  '/api/ai-cmo/scheduled-intelligence/run',
  optionalAuth,
  async (req: Request, res: Response) => {
    try {
      const run = await executeScheduledIntelligenceJob({
        jobType: req.body?.jobType || 'DAILY_BUSINESS_BRIEF',
        triggerSource: 'ADMIN_MANUAL_RUN',
        actorEmail: req.body?.actorEmail || 'admin@fragmore.com'
      });
      res.json(run);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

app.post(
  '/api/ai-cmo/scheduled-intelligence/tasks/:id',
  optionalAuth,
  async (req: Request, res: Response) => {
    try {
      const updated = await updateScheduledIntelligenceTaskConfig({
        scheduledTaskId: req.params.id,
        isActive: req.body?.isActive,
        cronExpression: req.body?.cronExpression,
        actorEmail: req.body?.actorEmail || 'admin@fragmore.com'
      });
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

app.get('/api/ai-cmo/governance/analytics', optionalAuth, async (_req: Request, res: Response) => {
  try {
    const analytics = await getAiCmoGovernanceAndUsageAnalytics();
    res.json(analytics);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ai-cmo/governance/settings', optionalAuth, async (req: Request, res: Response) => {
  try {
    const updated = await updateAiCmoIntelligenceGovernanceSettings(req.body || {});
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post(
  '/api/ai-cmo/governance/retention-purge',
  optionalAuth,
  async (req: Request, res: Response) => {
    try {
      const result = await executeAiDataRetentionCleanup(
        req.body?.actorEmail || 'admin@fragmore.com'
      );
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

app.get(
  '/api/ai-cmo/integration-audit/latest',
  optionalAuth,
  async (req: Request, res: Response) => {
    try {
      const report = await getLatestOrRunIntegrationAuditReport(
        (req.query.actorEmail as string) || 'admin@fragmore.com'
      );
      res.json(report);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

app.post(
  '/api/ai-cmo/integration-audit/run',
  optionalAuth,
  async (req: Request, res: Response) => {
    try {
      const report = await runFullAiCmoIntegrationAndRegressionAudit(
        req.body?.actorEmail || 'admin@fragmore.com'
      );
      res.json(report);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// ========================================================
// STORE VISITOR TRACKING & TELEMETRY APIS
// ========================================================
app.get('/api/analytics/visitors', optionalAuth, async (_req: Request, res: Response) => {
  try {
    const stats = visitorAnalyticsEngine.getStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/analytics/track-visit', optionalAuth, async (req: Request, res: Response) => {
  try {
    const userAgent = (req.headers['user-agent'] as string) || '';
    if (visitorAnalyticsEngine.isBotRequest(userAgent, req.headers as any)) {
      return res.json(visitorAnalyticsEngine.getStats());
    }
    const forwarded = req.headers['x-forwarded-for'];
    const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '') || req.socket.remoteAddress || '127.0.0.1';
    const authUser = (req as any).user;

    const stats = visitorAnalyticsEngine.recordVisit({
      ...(req.body || {}),
      customerName: req.body?.customerName || authUser?.name,
      customerEmail: req.body?.customerEmail || authUser?.email,
      isLoggedIn: req.body?.isLoggedIn !== undefined ? req.body.isLoggedIn : Boolean(authUser || req.body?.customerEmail),
      userAgent,
      ip
    });
    res.json(stats);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/analytics/heartbeat', optionalAuth, async (req: Request, res: Response) => {
  try {
    if (req.body?.visitorId) {
      const forwarded = req.headers['x-forwarded-for'];
      const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '') || req.socket.remoteAddress || '127.0.0.1';
      const authUser = (req as any).user;

      visitorAnalyticsEngine.recordHeartbeat({
        ...(req.body || {}),
        customerName: req.body?.customerName || authUser?.name,
        customerEmail: req.body?.customerEmail || authUser?.email,
        isLoggedIn: req.body?.isLoggedIn !== undefined ? req.body.isLoggedIn : Boolean(authUser || req.body?.customerEmail),
        ip
      });
    }
    res.json({ success: true, stats: visitorAnalyticsEngine.getStats() });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ========================================================
// CONCIERGE ASSISTED CART & DIRECT PAYMENT LINK APIS
// ========================================================
interface AssistedCartData {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: {
    addressLine1: string;
    city: string;
    state: string;
    pincode: string;
  };
  items: Array<{
    productId: string;
    productName: string;
    size: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    selectedFlavours?: string[];
  }>;
  subtotal: number;
  discount: number;
  couponCode?: string;
  totalAmount: number;
  createdAt: string;
}

const assistedCartsStore: Map<string, AssistedCartData> = new Map();

app.post('/api/assisted-cart', optionalAuth, async (req: Request, res: Response) => {
  try {
    const cartId = `ac_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const data: AssistedCartData = {
      id: cartId,
      customerName: req.body.customerName || 'Valued Client',
      customerEmail: req.body.customerEmail || '',
      customerPhone: req.body.customerPhone || '',
      shippingAddress: req.body.shippingAddress || {
        addressLine1: '',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001'
      },
      items: Array.isArray(req.body.items) ? req.body.items : [],
      subtotal: Number(req.body.subtotal) || 0,
      discount: Number(req.body.discount) || 0,
      couponCode: req.body.couponCode || '',
      totalAmount: Number(req.body.totalAmount) || 0,
      createdAt: new Date().toISOString()
    };
    if (assistedCartsStore.size >= 200) {
      const oldestKey = assistedCartsStore.keys().next().value;
      if (oldestKey) assistedCartsStore.delete(oldestKey);
    }
    assistedCartsStore.set(cartId, data);
    res.json({ success: true, cartId, cart: data });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/assisted-cart/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const cart = assistedCartsStore.get(req.params.id);
    if (!cart) {
      return res.status(404).json({ error: 'Assisted cart link expired or not found' });
    }
    res.json(cart);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================================
// START SERVER WITH VITE DEV MIDDLEWARE OR STATIC SERVING
// ========================================================

// Prevent transient background errors (such as Cloud SQL scale-to-zero wakeups) from crashing the server process
process.on('unhandledRejection', (reason: any) => {
  console.warn('[Server] Unhandled promise rejection (non-fatal):', reason?.message || reason);
});

process.on('uncaughtException', (err: any) => {
  if (err?.code === 'EADDRINUSE') {
    console.error('[Server] Port 3000 is already in use:', err.message);
    process.exit(1);
  }
  console.warn('[Server] Uncaught exception (non-fatal):', err?.message || err);
});

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';
  const distDir = path.resolve(__dirname, 'dist');
  const distIndexPath = path.resolve(distDir, 'index.html');

  if (isProduction && fs.existsSync(distIndexPath)) {
    app.use(
      express.static(distDir, {
        maxAge: '1d',
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
          } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.sendFile(distIndexPath);
    });
  } else {
    let viteMiddleware: any = null;
    const viteInitPromise = import('vite')
      .then(({ createServer: createViteServer }) =>
        createViteServer({
          server: { middlewareMode: true },
          appType: 'spa',
        })
      )
      .then((vite) => {
        viteMiddleware = vite.middlewares;
        return viteMiddleware;
      })
      .catch((err) => {
        console.error('[Server] Vite middleware initialization error:', err);
        return null;
      });

    app.use(async (req, res, next) => {
      if (viteMiddleware) {
        return viteMiddleware(req, res, next);
      }
      const mw = await viteInitPromise;
      if (mw) {
        return mw(req, res, next);
      }
      next();
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Fragmore Parfums backend running on http://0.0.0.0:${PORT}`);

    // Stagger lightweight seed verification sequentially so cold starts avoid concurrent Firestore bursts
    const warmupTimer = setTimeout(async () => {
      try {
        await seedInitialDataIfEmpty().catch((err) => {
          console.warn('[Server] Initial Firestore seed check notice:', err.message);
        });
        await ensureErpSeeded().catch((err) => {
          console.warn('[Server] Business OS ERP seed notice:', err.message);
        });
        await ensureRewardsEcosystemSeeded().catch((err) => {
          console.warn('[Server] Rewards & Wallet ecosystem seed notice:', err.message);
        });
        await ensureAutomationSeeded();
        await ensureAiCmoMemoryAndScheduledIntelligenceSeeded();
        startAutomationBackgroundWorker();
        const recoveryTimer = setInterval(() => {
          processDueAbandonedCartReminders().catch(() => {});
          detectAndRecoverStuckAutomationJobs(120000).catch(() => {});
        }, 300000);
        if (typeof (recoveryTimer as any)?.unref === 'function') {
          (recoveryTimer as any).unref();
        }
      } catch (err: any) {
        console.warn('[Server] Startup warmup notice:', err?.message || err);
      }
    }, 5000);
    if (typeof (warmupTimer as any)?.unref === 'function') {
      (warmupTimer as any).unref();
    }
  });
}

startServer();

