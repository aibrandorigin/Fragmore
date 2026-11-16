import { pgTable, text, integer, serial, boolean, timestamp, real, jsonb, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// 1. Users Table (Integrated with Firebase Auth UID)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  displayName: text('display_name'),
  role: text('role').default('customer').notNull(), // customer | super_admin | admin | store_manager | fulfillment_staff
  phone: text('phone'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 2. Products Table
export const products = pgTable('products', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  subtitle: text('subtitle'),
  gender: text('gender').notNull(),
  collection: text('collection').notNull(),
  scentProfile: text('scent_profile'),
  description: text('description').notNull(),
  story: text('story'),
  notes: jsonb('notes').notNull(), // { top: [], heart: [], base: [] }
  families: jsonb('families').notNull(), // string[]
  occasions: jsonb('occasions').notNull(), // string[]
  longevity: text('longevity'),
  sillage: text('sillage'),
  rating: real('rating').default(5.0),
  reviewCount: integer('review_count').default(0),
  isNewArrival: boolean('is_new_arrival').default(false),
  isBestSeller: boolean('is_best_seller').default(false),
  status: text('status').default('ACTIVE').notNull(),
  variants: jsonb('variants').notNull(), // ProductVariant[]
  themeColor: text('theme_color').notNull(),
  accentColor: text('accent_color').notNull(),
  badge: text('badge'),
  features: jsonb('features').notNull(), // string[]
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 3. Orders Table
export const orders = pgTable('orders', {
  id: text('id').primaryKey(),
  orderNumber: text('order_number').notNull().unique(),
  customerId: text('customer_id').notNull(),
  customerName: text('customer_name').notNull(),
  customerEmail: text('customer_email').notNull(),
  customerPhone: text('customer_phone').notNull(),
  shippingAddress: jsonb('shipping_address').notNull(),
  items: jsonb('items').notNull(), // OrderItem[]
  subtotal: integer('subtotal').notNull(),
  discount: integer('discount').default(0).notNull(),
  couponCode: text('coupon_code'),
  taxAmount: integer('tax_amount').default(0).notNull(),
  shippingAmount: integer('shipping_amount').default(0).notNull(),
  totalAmount: integer('total_amount').notNull(),
  paymentMethod: text('payment_method').notNull(),
  paymentStatus: text('payment_status').notNull(),
  transactionId: text('transaction_id'),
  orderStatus: text('order_status').default('NEW').notNull(),
  awbNumber: text('awb_number'),
  courierName: text('courier_name'),
  trackingUrl: text('tracking_url'),
  attribution: jsonb('attribution'),
  notes: text('notes'),
  opsMetadata: jsonb('ops_metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 4. Customers Table
export const customers = pgTable('customers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  phone: text('phone').notNull(),
  city: text('city'),
  state: text('state'),
  tier: text('tier').default('Silver').notNull(),
  tags: jsonb('tags').notNull(), // string[]
  totalOrders: integer('total_orders').default(0).notNull(),
  totalSpend: integer('total_spend').default(0).notNull(),
  addresses: jsonb('addresses'), // CustomerAddress[]
  notes: text('notes'),
  favouriteFragrance: text('favourite_fragrance'),
  source: text('source'),
  influencer: text('influencer'),
  utmSource: text('utm_source'),
  utmCampaign: text('utm_campaign'),
  communicationHistory: jsonb('communication_history'),
  wishlistSlugs: jsonb('wishlist_slugs'),
  crmMetadata: jsonb('crm_metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 5. Reviews Table
export const reviews = pgTable('reviews', {
  id: text('id').primaryKey(),
  productId: text('product_id'),
  productSlug: text('product_slug').notNull(),
  authorName: text('author_name').notNull(),
  rating: integer('rating').notNull(),
  title: text('title').notNull(),
  comment: text('comment').notNull(),
  verified: boolean('verified').default(true).notNull(),
  helpfulCount: integer('helpful_count').default(0).notNull(),
  status: text('status').default('approved').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 6. Coupons Table
export const coupons = pgTable('coupons', {
  code: text('code').primaryKey(),
  discountType: text('discount_type').notNull(), // 'percentage' | 'fixed'
  value: integer('value').notNull(),
  minOrderValue: integer('min_order_value').default(0),
  maxDiscount: integer('max_discount'),
  expiryDate: text('expiry_date'),
  usageLimit: integer('usage_limit'),
  usageCount: integer('usage_count').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  description: text('description'),
  couponMetadata: jsonb('coupon_metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 7. Influencers Table
export const influencers = pgTable('influencers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  handle: text('handle').notNull(),
  platform: text('platform').notNull(),
  referralCode: text('referral_code').notNull().unique(),
  commissionRate: integer('commission_rate').notNull(),
  totalRevenue: integer('total_revenue').default(0).notNull(),
  clicks: integer('clicks').default(0).notNull(),
  ordersCount: integer('orders_count').default(0).notNull(),
  status: text('status').default('active').notNull(),
  partnerMetadata: jsonb('partner_metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 8. Abandoned Carts Table
export const abandonedCarts = pgTable('abandoned_carts', {
  id: text('id').primaryKey(),
  customerEmail: text('customer_email').notNull(),
  customerPhone: text('customer_phone').notNull(),
  customerName: text('customer_name'),
  items: jsonb('items').notNull(), // CartItem[]
  cartValue: integer('cart_value').notNull(),
  couponCode: text('coupon_code'),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  status: text('status').default('ABANDONED').notNull(),
  recoveredAt: timestamp('recovered_at'),
  attribution: jsonb('attribution'),
  recoverySentEmail: boolean('recovery_sent_email').default(false).notNull(),
  recoverySentWhatsApp: boolean('recovery_sent_whatsapp').default(false).notNull(),
  recoverySentSMS: boolean('recovery_sent_sms').default(false).notNull(),
  recoveryMetadata: jsonb('recovery_metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 9. CMS Settings Table
export const cmsSettings = pgTable('cms_settings', {
  id: text('id').primaryKey(), // 'current' or 'draft'
  settings: jsonb('settings').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 10. Campaigns Table
export const campaigns = pgTable('campaigns', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  channel: text('channel').notNull(),
  budget: integer('budget').default(0).notNull(),
  spend: integer('spend').default(0).notNull(),
  revenue: integer('revenue').default(0).notNull(),
  status: text('status').default('active').notNull(),
  startDate: text('start_date'),
  endDate: text('end_date'),
  campaignMetadata: jsonb('campaign_metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 11. Returns & Refunds Table
export const returnsRefunds = pgTable('returns_refunds', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull(),
  orderNumber: text('order_number').notNull(),
  customerName: text('customer_name').notNull(),
  items: jsonb('items').notNull(),
  reason: text('reason').notNull(),
  refundAmount: integer('refund_amount').notNull(),
  status: text('status').default('pending').notNull(),
  returnMetadata: jsonb('return_metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 12. Back In Stock Notifications Table
export const backInStock = pgTable('back_in_stock', {
  id: text('id').primaryKey(),
  productSlug: text('product_slug').notNull(),
  variantSize: text('variant_size').notNull(),
  customerEmail: text('customer_email').notNull(),
  notified: boolean('notified').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 13. Audit Logs Table
export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  action: text('action').notNull(),
  adminEmail: text('admin_email').notNull(),
  details: text('details'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 14. Automation Workflows Table
export const automationWorkflows = pgTable('automation_workflows', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category').notNull(), // customer_journeys | marketing | order | inventory | shipping | discovery | influencer | review_retention | scheduled
  status: text('status').default('DRAFT').notNull(), // DRAFT | ACTIVE | PAUSED | PENDING_APPROVAL | ARCHIVED
  triggerType: text('trigger_type').notNull(),
  triggerConfig: jsonb('trigger_config').notNull(),
  nodes: jsonb('nodes').notNull(), // WorkflowNode[]
  edges: jsonb('edges').notNull(), // WorkflowEdge[]
  version: integer('version').default(1).notNull(),
  versionHistory: jsonb('version_history').notNull(), // WorkflowVersionSnapshot[]
  maxExecutionsPerCustomer: integer('max_executions_per_customer').default(0).notNull(),
  maxExecutionsPerDay: integer('max_executions_per_day').default(1000).notNull(),
  cooldownMinutes: integer('cooldown_minutes').default(0).notNull(),
  requiresApproval: boolean('requires_approval').default(false).notNull(),
  approvalStatus: text('approval_status').default('APPROVED').notNull(), // APPROVED | PENDING | REJECTED
  approvedBy: text('approved_by'),
  approvedAt: timestamp('approved_at'),
  allowedRoles: jsonb('allowed_roles').notNull(), // string[]
  stats: jsonb('stats').notNull(),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 15. Automation Events Table (Durable Event Ledger with Idempotency Keys)
export const automationEvents = pgTable('automation_events', {
  id: text('id').primaryKey(),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  eventType: text('event_type').notNull(),
  source: text('source').notNull(), // storefront | backend_api | webhook | scheduler | manual_test
  entityId: text('entity_id'),
  customerEmail: text('customer_email'),
  customerPhone: text('customer_phone'),
  customerSegment: text('customer_segment'),
  payload: jsonb('payload').notNull(),
  status: text('status').default('RECEIVED').notNull(), // RECEIVED | PROCESSING | PROCESSED | DEDUPLICATED | FAILED
  matchedWorkflowIds: jsonb('matched_workflow_ids').notNull(), // string[]
  processedAt: timestamp('processed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 16. Automation Jobs Table (Persistent Queue, Delayed Jobs, Retries & Dead-Letter Queue)
export const automationJobs = pgTable('automation_jobs', {
  id: text('id').primaryKey(),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  workflowId: text('workflow_id').notNull(),
  workflowName: text('workflow_name').notNull(),
  workflowVersion: integer('workflow_version').default(1).notNull(),
  eventId: text('event_id').notNull(),
  eventType: text('event_type').notNull(),
  customerEmail: text('customer_email'),
  customerSegment: text('customer_segment'),
  channel: text('channel'),
  status: text('status').default('QUEUED').notNull(), // QUEUED | DELAYED | RUNNING | WAITING_APPROVAL | COMPLETED | FAILED | DEAD_LETTER | CANCELLED
  currentNodeId: text('current_node_id'),
  executionContext: jsonb('execution_context').notNull(),
  stepLogs: jsonb('step_logs').notNull(), // StepExecutionLog[]
  attemptCount: integer('attempt_count').default(0).notNull(),
  maxAttempts: integer('max_attempts').default(3).notNull(),
  nextRunAt: timestamp('next_run_at').defaultNow().notNull(),
  lockedBy: text('locked_by'),
  lockedUntil: timestamp('locked_until'),
  latencyMs: integer('latency_ms').default(0).notNull(),
  costInr: real('cost_inr').default(0).notNull(),
  attributedRevenue: integer('attributed_revenue').default(0).notNull(),
  lastError: text('last_error'),
  isTestRun: boolean('is_test_run').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

// 17. Automation Scheduled Tasks Table (Timezone-aware Cron & Delayed Triggers)
export const automationScheduledTasks = pgTable('automation_scheduled_tasks', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  workflowId: text('workflow_id').notNull(),
  cronExpression: text('cron_expression').notNull(),
  timezone: text('timezone').default('Asia/Kolkata').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  lastRunAt: timestamp('last_run_at'),
  nextRunAt: timestamp('next_run_at').notNull(),
  runCount: integer('run_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 18. Automation Approvals Table (Governance Gate for Sensitive Actions & Workflows)
export const automationApprovals = pgTable('automation_approvals', {
  id: text('id').primaryKey(),
  workflowId: text('workflow_id').notNull(),
  workflowName: text('workflow_name').notNull(),
  jobId: text('job_id'),
  actionType: text('action_type').notNull(), // HIGH_VALUE_DISCOUNT | BULK_INVENTORY | CUSTOMER_EXPORT | PAYMENT_REFUND_STATE | BULK_PROMO_BROADCAST | SPEND_BUDGET | AI_RECOMMENDATION | WORKFLOW_PUBLISH
  requestedBy: text('requested_by').notNull(),
  reason: text('reason').notNull(),
  payload: jsonb('payload').notNull(),
  status: text('status').default('PENDING').notNull(), // PENDING | APPROVED | REJECTED
  reviewedBy: text('reviewed_by'),
  reviewedAt: timestamp('reviewed_at'),
  reviewNotes: text('review_notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 19. Automation AI Recommendations Table
export const automationAiRecommendations = pgTable('automation_ai_recommendations', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  category: text('category').notNull(),
  rationale: text('rationale').notNull(),
  suggestedTrigger: text('suggested_trigger').notNull(),
  expectedImpact: text('expected_impact').notNull(),
  confidenceScore: integer('confidence_score').default(85).notNull(),
  workflowBlueprint: jsonb('workflow_blueprint').notNull(),
  status: text('status').default('PENDING_APPROVAL').notNull(), // PENDING_APPROVAL | APPROVED | DISMISSED
  approvedBy: text('approved_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 20. Automation Settings Table
export const automationSettingsTable = pgTable('automation_settings', {
  id: text('id').primaryKey(), // 'global'
  config: jsonb('config').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 21. SKU Inventory Ledger Table (Atomic Stock & Threshold Tracking)
export const inventoryLedger = pgTable('inventory_ledger', {
  sku: text('sku').primaryKey(),
  productId: text('product_id').notNull(),
  productName: text('product_name').notNull(),
  variantId: text('variant_id').notNull(),
  size: text('size').notNull(),
  openingStock: integer('opening_stock').default(0).notNull(),
  receivedStock: integer('received_stock').default(0).notNull(),
  reservedStock: integer('reserved_stock').default(0).notNull(),
  availableStock: integer('available_stock').default(0).notNull(),
  soldStock: integer('sold_stock').default(0).notNull(),
  returnedSellableStock: integer('returned_sellable_stock').default(0).notNull(),
  damagedStock: integer('damaged_stock').default(0).notNull(),
  reorderThreshold: integer('reorder_threshold').default(20).notNull(),
  alertThresholds: jsonb('alert_thresholds').notNull(), // e.g. [20, 10, 5]
  targetStockLevel: integer('target_stock_level').default(60).notNull(),
  procurementStatus: text('procurement_status').default('NORMAL').notNull(), // NORMAL | LOW_STOCK_ALERT | IN_PROCUREMENT_QUEUE | OUT_OF_STOCK
  movementsHistory: jsonb('movements_history').notNull(), // StockMovementEntry[]
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 22. Fragrance Production Batches Table (11-Stage Manufacturing Execution & Costing)
export const productionBatches = pgTable('production_batches', {
  id: text('id').primaryKey(),
  batchNumber: text('batch_number').notNull().unique(),
  productId: text('product_id').notNull(),
  productName: text('product_name').notNull(),
  variantId: text('variant_id').notNull(),
  sku: text('sku').notNull(),
  size: text('size').notNull(),
  manufacturingDate: text('manufacturing_date').notNull(),
  expiryDate: text('expiry_date').notNull(),
  finishedQuantity: integer('finished_quantity').notNull(),
  qcStatus: text('qc_status').default('PENDING_QC').notNull(), // PENDING_QC | PASSED | FAILED | QUARANTINED
  bottleType: text('bottle_type').notNull(),
  packagingAvailability: text('packaging_availability').default('AVAILABLE').notNull(), // AVAILABLE | LOW_PACKAGING | AWAITING_COFFRET | UNAVAILABLE
  batchReleaseStatus: text('batch_release_status').default('UNRELEASED').notNull(), // UNRELEASED | RELEASED | RECALLED | BLOCKED
  releasedToInventory: boolean('released_to_inventory').default(false).notNull(),
  releasedAt: timestamp('released_at'),
  notes: text('notes'),
  createdBy: text('created_by').default('admin@fragmore.com').notNull(),
  // Advanced Manufacturing OS Fields (11-Stage Pipeline, Density BOM, Traceability & Costing)
  formulationId: text('formulation_id'),
  formulationVersionId: text('formulation_version_id'),
  lockedFormulaVersionNumber: integer('locked_formula_version_number'),
  lockedFormulaSnapshot: jsonb('locked_formula_snapshot'), // Frozen formula ingredients + density + packaging BOM at planning
  pipelineStage: text('pipeline_stage').default('PLANNING').notNull(), // PLANNING | AVAILABILITY_CHECK | RESERVED | AUTHORIZED | MATERIAL_ISSUED | MIXING | MATURATION | QC | FILLING | PACKING | RELEASED
  isOnceCollection: boolean('is_once_collection').default(false).notNull(),
  onceEditionId: text('once_edition_id'),
  bottleSizeMl: real('bottle_size_ml').default(50).notNull(),
  plannedJuiceQty: real('planned_juice_qty').default(0).notNull(), // in plannedJuiceUnit (kg or l)
  plannedJuiceUnit: text('planned_juice_unit').default('l').notNull(),
  actualJuiceQty: real('actual_juice_qty').default(0).notNull(),
  plannedBottlesCount: integer('planned_bottles_count').default(0).notNull(),
  actualFilledBottlesCount: integer('actual_filled_bottles_count').default(0).notNull(),
  rejectedBottlesCount: integer('rejected_bottles_count').default(0).notNull(),
  reworkBottlesCount: integer('rework_bottles_count').default(0).notNull(),
  materialRequirements: jsonb('material_requirements'), // Calculated ingredients & packaging from locked formula + density
  weighingRecords: jsonb('weighing_records'), // Array<{ materialId, materialName, lotId, lotNumber, plannedQty, actualWeighedQty, uom, varianceQty, variancePct, dispensedByEmail, verifiedByEmail, timestamp }>
  packagingConsumptions: jsonb('packaging_consumptions'), // Array<{ materialId, materialName, componentType, lotId, lotNumber, plannedQty, actualQty, rejectedQty, uom, unitCostInr, totalCostInr }>
  reworkRecords: jsonb('rework_records'), // Array<{ id, stage, reason, rejectedQty, reworkQty, disposition, recoveredQty, recordedByEmail, timestamp }>
  wastageQty: real('wastage_qty').default(0).notNull(),
  yieldVariancePct: real('yield_variance_pct').default(0).notNull(),
  materialCostInr: real('material_cost_inr').default(0).notNull(),
  packagingCostInr: real('packaging_cost_inr').default(0).notNull(),
  labourCostInr: real('labour_cost_inr').default(0).notNull(),
  overheadCostInr: real('overhead_cost_inr').default(0).notNull(),
  actualTotalCostInr: real('actual_total_cost_inr').default(0).notNull(),
  costPerBottleInr: real('cost_per_bottle_inr').default(0).notNull(),
  holdingTankLocation: text('holding_tank_location'),
  macerationStartDate: text('maceration_start_date'),
  macerationTargetDate: text('maceration_target_date'),
  authorizedByEmail: text('authorized_by_email'),
  authorizedAt: timestamp('authorized_at'),
  releasedByEmail: text('released_by_email'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 23. Operations Tasks, Alerts, Procurement Queue & Reconciliation Ledger
export const opsTasksAndAlerts = pgTable('ops_tasks_and_alerts', {
  id: text('id').primaryKey(),
  category: text('category').notNull(), // ORDER_ALERT | SHIPPING_EXCEPTION | LOW_STOCK_ALERT | PROCUREMENT_QUEUE | AD_CAMPAIGN_FLAG | PROMO_PAUSE_RECOMMENDATION | RETURN_APPROVAL | RECONCILIATION_MISMATCH
  severity: text('severity').default('MEDIUM').notNull(), // INFO | MEDIUM | HIGH | CRITICAL
  title: text('title').notNull(),
  description: text('description').notNull(),
  entityType: text('entity_type').notNull(), // ORDER | SHIPMENT | SKU | BATCH | RETURN | CAMPAIGN | RECONCILIATION
  entityId: text('entity_id').notNull(),
  sku: text('sku'),
  status: text('status').default('OPEN').notNull(), // OPEN | PENDING_APPROVAL | APPROVED | RESOLVED | DISMISSED
  suggestedReorderQty: integer('suggested_reorder_qty'),
  requiresAdminApproval: boolean('requires_admin_approval').default(false).notNull(),
  metadata: jsonb('metadata').notNull(),
  resolvedBy: text('resolved_by'),
  resolvedAt: timestamp('resolved_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 24. Discovery Purchase Journeys & Voucher Conversion Ledger
export const discoveryJourneys = pgTable('discovery_journeys', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull(),
  orderNumber: text('order_number').notNull(),
  customerId: text('customer_id').notNull(),
  customerEmail: text('customer_email').notNull(),
  customerName: text('customer_name').notNull(),
  customerPhone: text('customer_phone'),
  configurationCode: text('configuration_code').notNull(), // DISCOVERY_SIX_2ML | DISCOVERY_SIX_8ML | SIGNATURE_TRIO_8ML | DEVOTIONAL_QUARTET_2ML
  configurationName: text('configuration_name').notNull(),
  vialSize: text('vial_size').notNull(), // '2 ml' | '8 ml'
  vialCount: integer('vial_count').default(6).notNull(),
  includedFragrances: jsonb('included_fragrances').notNull(), // string[]
  netDiscoveryPriceInr: integer('net_discovery_price_inr').notNull(),
  deliveryStatus: text('delivery_status').default('AWAITING_DISPATCH').notNull(), // AWAITING_DISPATCH | IN_TRANSIT | DELIVERED | RETURNED_OR_CANCELLED
  deliveredAt: timestamp('delivered_at'),
  journeyStatus: text('journey_status').default('AWAITING_DELIVERY').notNull(), // AWAITING_DELIVERY | EDUCATION_SENT | FAVORITE_INVITED | FAVORITE_SELECTED | VOUCHER_ISSUED | CONVERTED_TO_FULL_BOTTLE | JOURNEY_COMPLETED | SUPPRESSED_REFUNDED
  selectedFavoriteFragrance: text('selected_favorite_fragrance'),
  favoriteSelectedAt: timestamp('favorite_selected_at'),
  issuedVoucherCode: text('issued_voucher_code'),
  voucherAmountInr: integer('voucher_amount_inr').default(0).notNull(),
  voucherIssuedAt: timestamp('voucher_issued_at'),
  voucherExpiresAt: timestamp('voucher_expires_at'),
  voucherStatus: text('voucher_status').default('NOT_ISSUED').notNull(), // NOT_ISSUED | ACTIVE | REDEEMED | EXPIRED | REVOKED_ON_REFUND | BLOCKED_BY_GUARD
  eligibleFullBottleProducts: jsonb('eligible_full_bottle_products').notNull(), // EligibleProductSnapshot[]
  upgradedOrderId: text('upgraded_order_id'),
  upgradedOrderNumber: text('upgraded_order_number'),
  upgradedProductName: text('upgraded_product_name'),
  upgradedSize: text('upgraded_size'),
  upgradeNetRevenueInr: integer('upgrade_net_revenue_inr').default(0).notNull(),
  upgradeContributionMarginInr: integer('upgrade_contribution_margin_inr').default(0).notNull(),
  upgradedAt: timestamp('upgraded_at'),
  daysToUpgrade: real('days_to_upgrade'),
  cohortMonth: text('cohort_month').notNull(),
  journeyTimeline: jsonb('journey_timeline').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 25. Discovery Redemption Rules & Loyalty Automation Programs Table
export const loyaltyProgramsAndLedger = pgTable('loyalty_programs_and_ledger', {
  id: text('id').primaryKey(),
  ruleType: text('rule_type').notNull(), // DISCOVERY_REDEMPTION_CONFIG | FIRST_ORDER_BENEFIT | SECOND_PURCHASE_REWARD | VIP_ELIGIBILITY | REFERRAL_BENEFIT | BIRTHDAY_OFFER | REPEAT_CUSTOMER_OFFER | WIN_BACK_BENEFIT | BUNDLE_RECOMMENDATION | GIFT_PURCHASE_JOURNEY
  name: text('name').notNull(),
  description: text('description').notNull(),
  isMonetaryBenefit: boolean('is_monetary_benefit').default(true).notNull(),
  benefitType: text('benefit_type').notNull(), // PERCENTAGE_DISCOUNT | FIXED_VOUCHER | DYNAMIC_REDEMPTION | CURATED_BUNDLE_RECOMMENDATION | CONCIERGE_GIFT_EXPERIENCE
  benefitValue: integer('benefit_value').default(0).notNull(),
  minQualifyingOrderInr: integer('min_qualifying_order_inr').default(0).notNull(),
  requiresAdminApproval: boolean('requires_admin_approval').default(true).notNull(),
  approvalStatus: text('approval_status').default('PENDING_APPROVAL').notNull(), // PENDING_APPROVAL | APPROVED | REJECTED
  approvedBy: text('approved_by'),
  approvedAt: timestamp('approved_at'),
  isActive: boolean('is_active').default(false).notNull(),
  conversionsCount: integer('conversions_count').default(0).notNull(),
  attributedRevenueInr: integer('attributed_revenue_inr').default(0).notNull(),
  discountCostInr: integer('discount_cost_inr').default(0).notNull(),
  config: jsonb('config').notNull(),
  executionsHistory: jsonb('executions_history').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 26. Influencer Content Deliverables & Advertising Disclosure Ledger
export const influencerContentDeliverables = pgTable('influencer_content_deliverables', {
  id: text('id').primaryKey(),
  influencerId: text('influencer_id').notNull(),
  influencerName: text('influencer_name').notNull(),
  handle: text('handle').notNull(),
  platform: text('platform').notNull(),
  campaignName: text('campaign_name').notNull(),
  deliverableTitle: text('deliverable_title').notNull(),
  stage: text('stage').default('BRIEF_ISSUED').notNull(), // BRIEF_ISSUED | SAMPLE_SHIPPED | DRAFT_RECEIVED | CONTENT_APPROVED | CONTENT_PUBLISHED
  sampleSku: text('sample_sku'),
  sampleAwb: text('sample_awb'),
  draftUrl: text('draft_url'),
  publishedUrl: text('published_url'),
  hasRequiredAdDisclosure: boolean('has_required_ad_disclosure').default(false).notNull(),
  disclosureTagUsed: text('disclosure_tag_used'),
  usageRights: text('usage_rights').default('90 Days Paid Whitelisting + Organic Archive').notNull(),
  performanceMetrics: jsonb('performance_metrics').notNull(),
  commercialFeeInr: integer('commercial_fee_inr').default(0).notNull(),
  paymentStatus: text('payment_status').default('UNBILLED').notNull(), // UNBILLED | IN_PAYOUT_QUEUE | APPROVED_FOR_SETTLEMENT | PAID
  timeline: jsonb('timeline').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 27. Resellers, Wholesale B2B Orders & Partner Payout Approval Queue Table
export const resellersAndB2bOrders = pgTable('resellers_and_b2b_orders', {
  id: text('id').primaryKey(),
  recordType: text('record_type').notNull(), // RESELLER_PARTNER | RESELLER_ORDER | PAYOUT_APPROVAL_QUEUE | COMMISSION_CONFIG
  partnerId: text('partner_id').notNull(),
  businessName: text('business_name').notNull(),
  contactName: text('contact_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  city: text('city'),
  state: text('state'),
  gstin: text('gstin'),
  moqSlabCode: text('moq_slab_code').default('SLAB_8999').notNull(), // SLAB_8999 | SLAB_14999 | SLAB_29999
  moqMinimumInr: integer('moq_minimum_inr').default(8999).notNull(),
  wholesaleDiscountPercent: integer('wholesale_discount_percent').default(28).notNull(),
  status: text('status').default('PENDING_APPROVAL').notNull(),
  totalWholesaleRevenueInr: integer('total_wholesale_revenue_inr').default(0).notNull(),
  totalOrdersCount: integer('total_orders_count').default(0).notNull(),
  outstandingBalanceInr: integer('outstanding_balance_inr').default(0).notNull(),
  lastOrderAt: timestamp('last_order_at'),
  nextRestockReminderAt: timestamp('next_restock_reminder_at'),
  metadata: jsonb('metadata').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 28. Omnichannel Analytics, Standardized Tracking Events & Attribution Deduplication Ledger
export const analyticsTrackingLedger = pgTable('analytics_tracking_ledger', {
  id: text('id').primaryKey(),
  eventId: text('event_id').notNull().unique(), // Stable event_id for browser + CAPI server deduplication
  eventName: text('event_name').notNull(), // page_view | view_item | search | select_item | add_to_cart | remove_from_cart | begin_checkout | add_shipping_info | add_payment_info | purchase | refund | sign_up | generate_lead
  eventSource: text('event_source').default('BROWSER_AND_SERVER').notNull(), // BROWSER_PIXEL | SERVER_CAPI | WEBHOOK | FIRST_PARTY_BACKEND
  deduplicationStatus: text('deduplication_status').default('UNIQUE_ACCEPTED').notNull(), // UNIQUE_ACCEPTED | DEDUPLICATED_BROWSER_SERVER | DUPLICATE_WEBHOOK_IGNORED | SUPPRESSED_NO_CONSENT
  currency: text('currency').default('INR').notNull(),
  valueInr: real('value_inr').default(0).notNull(),
  transactionId: text('transaction_id'),
  transactionVerifiedInDb: boolean('transaction_verified_in_db').default(false).notNull(),
  consentState: jsonb('consent_state').notNull(), // { analytics: boolean, marketingPixels: boolean }
  piiProtectionStatus: text('pii_protection_status').default('RAW_PII_STRIPPED_SHA256_HASHED').notNull(),
  utmParams: jsonb('utm_params').notNull(), // { utm_source, utm_medium, utm_campaign, utm_content, utm_term }
  attributionTouch: jsonb('attribution_touch').notNull(), // { firstTouchChannel, lastTouchChannel, couponCode, influencerCode, campaignId }
  itemsPayload: jsonb('items_payload').notNull(), // Product items in GA4/Meta standard format
  destinationsDispatched: jsonb('destinations_dispatched').notNull(), // Array of provider dispatch results
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 29. AI Marketing Intelligence, Content Studio, Cost Ledger & Executive Briefing Table
export const aiMarketingIntelligenceLedger = pgTable('ai_marketing_intelligence_ledger', {
  id: text('id').primaryKey(),
  recordType: text('record_type').notNull(), // RECOMMENDATION | CONTENT_STUDIO_ITEM | AI_USAGE_LOG | EXECUTIVE_BRIEFING | SAFETY_CONFIG
  capabilityKey: text('capability_key').notNull(), // e.g. SALES_TRENDS | FRAGRANCE_PERFORMANCE | ABANDONED_PATTERNS | PROFITABLE_BUNDLES | SEGMENT_RECOMMENDATION | AD_CREATIVE_AUDIT | CONTENT_TOPICS | IG_REEL_SCRIPT | WHATSAPP_EMAIL_COPY | REVIEW_OBJECTION_ANALYSIS | REPLENISHMENT_CAMPAIGN | CHECKOUT_DROP_ALERT | INVENTORY_FORECAST | RETENTION_ELIGIBILITY | WEEKLY_EXECUTIVE_SUMMARY | MORNING_BRIEFING | CONTENT_STUDIO
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  fragranceFocus: text('fragrance_focus'), // AZURE | IGNITE | ROSELLE | ÉLAN | SUEDE | SOLARA | Moksha Essence | Temple Flora | Divine Aura | MULTI_COLLECTION
  channel: text('channel'), // INSTAGRAM | WHATSAPP | EMAIL | META_ADS | GOOGLE_ADS | STOREFRONT | INTERNAL_ERP
  status: text('status').default('PENDING_REVIEW').notNull(), // PENDING_REVIEW | ACCEPTED | EDITED_AND_ACCEPTED | REJECTED | SCHEDULED_AWAITING_API | PUBLISHED
  confidenceScore: integer('confidence_score').default(90).notNull(),
  dataSources: jsonb('data_sources').notNull(), // string[] of tables/metrics used
  explainableRationale: text('explainable_rationale').notNull(),
  structuredContent: jsonb('structured_content').notNull(), // Detailed recommendation payload, copy variations, storyboard, forecast ranges, or briefing metrics
  safetyAudit: jsonb('safety_audit').notNull(), // { piiRedacted: boolean, promptInjectionScanned: boolean, hallucinationCheckPassed: boolean, autoExternalActionBlocked: boolean }
  tokenUsage: jsonb('token_usage').notNull(), // { model: string, promptTokens: number, completionTokens: number, totalTokens: number, costInr: number }
  reviewedBy: text('reviewed_by'),
  reviewedAt: timestamp('reviewed_at'),
  reviewNotes: text('review_notes'),
  scheduledFor: text('scheduled_for'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 30. Automated Customer Support, Review Management & Retention Workflows Ledger
export const supportReviewRetentionLedger = pgTable('support_review_retention_ledger', {
  id: text('id').primaryKey(),
  recordType: text('record_type').notNull(), // SUPPORT_TICKET | REVIEW_INVITE_AND_MODERATION | RETENTION_JOURNEY_CONFIG | RETENTION_JOURNEY_EXECUTION | SUPPORT_RETENTION_SETTINGS
  referenceCode: text('reference_code').notNull(), // e.g. TKT-2026-1001, REV-INV-1001, RET-JRN-FIRST-PURCHASE
  customerId: text('customer_id'),
  customerEmail: text('customer_email'),
  customerName: text('customer_name'),
  customerPhone: text('customer_phone'),
  orderId: text('order_id'),
  orderNumber: text('order_number'),
  awbNumber: text('awb_number'),
  courierName: text('courier_name'),
  returnId: text('return_id'),
  productSlug: text('product_slug'),
  productName: text('product_name'),
  variantSize: text('variant_size'),
  category: text('category').notNull(), // LEAKAGE | BROKEN_BOTTLE | WRONG_FRAGRANCE | MISSING_ITEM | DELIVERY_DELAY | PAYMENT_ISSUE | FRAGRANCE_DISSATISFACTION | REVIEW_AUTOMATION | FIRST_PURCHASE_FOLLOW_UP | PRODUCT_EDUCATION | CROSS_SELL_COMPLEMENTARY | DISCOVERY_TO_FULL_BOTTLE | REPLENISHMENT_REMINDER | VIP_CUSTOMER_ENGAGEMENT | REFERRAL_INVITATION | CUSTOMER_WIN_BACK | SETTINGS
  priority: text('priority').default('MEDIUM').notNull(), // LOW | MEDIUM | HIGH | CRITICAL
  status: text('status').default('OPEN').notNull(), // OPEN | IN_PROGRESS | ESCALATED | AWAITING_FINANCE_RECONCILIATION | RESOLVED | CLOSED | INVITE_SCHEDULED | INVITE_SENT | REVIEW_PUBLISHED | REVIEW_HELD_MODERATION | JOURNEY_ACTIVE | JOURNEY_DISPATCHED | SUPPRESSED_NO_CONSENT
  assignedDepartment: text('assigned_department'),
  assignedStaffEmail: text('assigned_staff_email'),
  slaTargetMinutes: integer('sla_target_minutes').default(120).notNull(),
  slaDueAt: timestamp('sla_due_at'),
  firstResponseAt: timestamp('first_response_at'),
  firstResponseMinutes: integer('first_response_minutes'),
  resolvedAt: timestamp('resolved_at'),
  resolutionMinutes: integer('resolution_minutes'),
  isOverdue: boolean('is_overdue').default(false).notNull(),
  escalatedAt: timestamp('escalated_at'),
  refundRequestedInr: integer('refund_requested_inr').default(0).notNull(),
  refundStatus: text('refund_status').default('NONE').notNull(), // NONE | REQUESTED | AWAITING_FINANCE_RECONCILIATION | PROVIDER_RECONCILED_COMPLETED | REJECTED
  refundGatewayRef: text('refund_gateway_ref'),
  financeReconciled: boolean('finance_reconciled').default(false).notNull(),
  csatScore: integer('csat_score'), // 1 to 5
  customerFeedback: text('customer_feedback'),
  title: text('title').notNull(),
  description: text('description').notNull(),
  metadata: jsonb('metadata').notNull(), // Rich payload: SLA logs, review moderation flags, dynamic bottle consumption profile, timeline events
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relationships
export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  user: one(users, {
    fields: [orders.customerEmail],
    references: [users.email],
  }),
}));

// ============================================================================
// ADDITIVE AI CMO 3.0 TABLES (ISOLATED & FEATURE-FLAGGED)
// Zero changes to existing production tables or foreign-key constraints
// ============================================================================

// 31. AI CMO 3.0 Feature Flags & Reversibility Controls
export const aiCmoFeatureFlags = pgTable('ai_cmo_feature_flags', {
  id: text('id').primaryKey(), // e.g. 'GLOBAL_AI_CMO_3_CONFIG'
  moduleEnabled: boolean('module_enabled').default(true).notNull(),
  readOnlyMode: boolean('read_only_mode').default(true).notNull(), // Defaults to true so initial setup never mutates live business tables
  requireHumanApprovalForWrites: boolean('require_human_approval_for_writes').default(true).notNull(),
  liveExecutionEnabled: boolean('live_execution_enabled').default(false).notNull(),
  reversibleKillSwitch: boolean('reversible_kill_switch').default(false).notNull(),
  realtimeSyncEnabled: boolean('realtime_sync_enabled').default(true).notNull(),
  modelName: text('model_name').default('gemini-3.8-flash').notNull(),
  maxDailyTokenBudget: integer('max_daily_token_budget').default(250000).notNull(),
  allowedReadAdapters: jsonb('allowed_read_adapters').notNull(), // string[]
  allowedWriteAdapters: jsonb('allowed_write_adapters').notNull(), // string[]
  updatedByEmail: text('updated_by_email').default('admin@fragmore.com').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 32. AI CMO 3.0 Conversations & Memory Threads
export const aiCmoConversations = pgTable('ai_cmo_conversations', {
  id: text('id').primaryKey(), // e.g. 'AICMO-CONV-...'
  title: text('title').notNull(),
  actorEmail: text('actor_email').notNull(),
  actorRole: text('actor_role').default('super_admin').notNull(),
  status: text('status').default('ACTIVE').notNull(), // ACTIVE | ARCHIVED | PINNED
  languagePreference: text('language_preference').default('EN').notNull(), // EN | TE | BILINGUAL
  memorySummary: text('memory_summary').notNull(),
  pinnedFacts: jsonb('pinned_facts').notNull(), // Array of verified store facts remembered across turns
  linkedEntities: jsonb('linked_entities'), // Referenced SKUs, orders, carts, workflows, customers
  contextSnapshot: jsonb('context_snapshot').notNull(), // Snapshot of retrieved store metrics at thread start
  messageCount: integer('message_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 33. AI CMO 3.0 Conversation Messages
export const aiCmoMessages = pgTable('ai_cmo_messages', {
  id: text('id').primaryKey(), // e.g. 'AICMO-MSG-...'
  conversationId: text('conversation_id').notNull(),
  role: text('role').notNull(), // user | assistant | tool | system
  content: text('content').notNull(),
  structuredResponse: jsonb('structured_response'), // 5-part format: directAnswer, supportingData, recommendedNextActions, actionCards, approvalRequests, clarificationRequest
  toolCalls: jsonb('tool_calls'), // Executed read/write tool invocations with latency & status
  linkedEntities: jsonb('linked_entities'), // Entities linked in this turn (SKUs, Order IDs, Cart IDs, Workflow IDs)
  attachments: jsonb('attachments'), // Safe metadata/content of uploaded brief/CSV/JSON attachments
  retrievedContextSources: jsonb('retrieved_context_sources').notNull(), // Array of adapter sources queried
  proposedPlanId: text('proposed_plan_id'),
  proposedActionIds: jsonb('proposed_action_ids').notNull(), // string[]
  modelUsed: text('model_used').default('gemini-3.8-flash').notNull(),
  tokenCount: integer('token_count').default(0).notNull(),
  latencyMs: integer('latency_ms').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 34. AI CMO 3.0 Action Planning Engine Records
export const aiCmoPlans = pgTable('ai_cmo_plans', {
  id: text('id').primaryKey(), // e.g. 'AICMO-PLAN-...'
  title: text('title').notNull(),
  objective: text('objective').notNull(),
  targetSegment: text('target_segment').notNull(), // e.g. 'DISCOVERY_BUYERS' | 'VIP_CUSTOMERS' | 'ABANDONED_HIGH_INTENT' | 'INFLUENCER_COHORT'
  status: text('status').default('DRAFT_PLAN').notNull(), // DRAFT_PLAN | AWAITING_APPROVAL | APPROVED | EXECUTED_DRY_RUN | EXECUTED_LIVE | CANCELLED
  riskLevel: text('risk_level').default('LOW').notNull(), // LOW | MEDIUM | HIGH
  projectedRevenueInr: integer('projected_revenue_inr').default(0).notNull(),
  budgetRequiredInr: integer('budget_required_inr').default(0).notNull(),
  projectedRoas: real('projected_roas').default(0).notNull(),
  steps: jsonb('steps').notNull(), // Array of structured DAG steps with toolId, adapterName, dryRunResult, approvalRequirement
  contextEvidence: jsonb('context_evidence').notNull(), // Live data grounding snapshot used to formulate plan
  createdByEmail: text('created_by_email').notNull(),
  approvedByEmail: text('approved_by_email'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 35. AI CMO 3.0 Approval Engine & Execution Orchestrator Queue
export const aiCmoActionApprovals = pgTable('ai_cmo_action_approvals', {
  id: text('id').primaryKey(), // e.g. 'AICMO-ACT-...'
  planId: text('plan_id'),
  conversationId: text('conversation_id'),
  toolId: text('tool_id').notNull(), // e.g. 'tool.campaigns.create_draft', 'tool.abandoned_cart.queue_recovery'
  toolCategory: text('tool_category').notNull(), // READ_ADAPTER | WRITE_ADAPTER
  adapterTarget: text('adapter_target').notNull(), // Existing service/module name
  title: text('title').notNull(),
  rationale: text('rationale').notNull(),
  payload: jsonb('payload').notNull(),
  dryRunPreview: jsonb('dry_run_preview').notNull(), // Non-destructive simulation output
  rollbackBlueprint: jsonb('rollback_blueprint').notNull(), // Instructions/snapshot to reverse action if ever executed live
  approvalStatus: text('approval_status').default('PENDING_APPROVAL').notNull(), // PENDING_APPROVAL | APPROVED | REJECTED | EXECUTED_DRY_RUN | EXECUTED_LIVE | ROLLED_BACK
  executionMode: text('execution_mode').default('DRY_RUN_ONLY').notNull(), // DRY_RUN_ONLY | LIVE_MUTATION
  requestedByEmail: text('requested_by_email').notNull(),
  reviewedByEmail: text('reviewed_by_email'),
  reviewNote: text('review_note'),
  executionResult: jsonb('execution_result'),
  executedAt: timestamp('executed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 36. AI CMO 3.0 Audit & Observability Ledger
export const aiCmoAuditObservabilityLogs = pgTable('ai_cmo_audit_observability_logs', {
  id: text('id').primaryKey(), // e.g. 'AICMO-AUDIT-...'
  serviceComponent: text('service_component').notNull(), // CHAT_SERVICE | MEMORY_SERVICE | TOOL_REGISTRY | MODULE_ADAPTER | CONTEXT_ENGINE | PLANNER | APPROVAL_ENGINE | ORCHESTRATOR | REALTIME_SYNC | ANALYTICS_ENGINE | COMPATIBILITY_TEST
  eventType: text('event_type').notNull(),
  actorEmail: text('actor_email').notNull(),
  actorRole: text('actor_role').notNull(),
  adapterTarget: text('adapter_target').notNull(),
  mutatedExistingData: boolean('mutated_existing_data').default(false).notNull(),
  featureFlagState: jsonb('feature_flag_state').notNull(),
  latencyMs: integer('latency_ms').default(0).notNull(),
  status: text('status').default('SUCCESS').notNull(), // SUCCESS | BLOCKED_BY_FLAG | PENDING_APPROVAL | DRY_RUN_VERIFIED | ERROR
  details: jsonb('details').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 37. AI CMO 3.0 Saved Prompts Library (English & Telugu)
export const aiCmoSavedPrompts = pgTable('ai_cmo_saved_prompts', {
  id: text('id').primaryKey(), // e.g. 'AICMO-PROMPT-...'
  title: text('title').notNull(),
  promptText: text('prompt_text').notNull(),
  language: text('language').default('EN').notNull(), // EN | TE
  category: text('category').default('EXECUTIVE').notNull(), // SALES_PROFIT | MARGIN | CAMPAIGN | ABANDONED_CART | WORKFLOW_DIAGNOSTICS | INVENTORY | REFUNDS | CREATIVE_BRIEF
  createdByEmail: text('created_by_email').default('admin@fragmore.com').notNull(),
  usageCount: integer('usage_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 38. AI CMO 3.0 Durable Memory & Versioned Business Policy Ledger
export const aiCmoDurableMemory = pgTable('ai_cmo_durable_memory', {
  id: text('id').primaryKey(), // e.g. 'AICMO-MEM-...'
  category: text('category').notNull(), // BRAND_VOICE_GUIDELINES | PRODUCT_POSITIONING_AUDIENCES | MARKETING_BUDGET_POLICIES | APPROVED_CAMPAIGN_OBJECTIVES | HISTORICAL_CAMPAIGN_DECISIONS | CONTENT_RESTRICTED_CLAIMS | FOUNDER_BUSINESS_RULES | PAST_PROPOSALS_MEASURED_OUTCOMES | CUSTOMER_SEGMENTATION_DEFINITIONS | FINANCIAL_METRIC_DEFINITIONS
  memoryKey: text('memory_key').notNull().unique(),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  structuredPolicy: jsonb('structured_policy').notNull(), // Detailed rules, thresholds, positioning, formulas, or historical outcome metrics
  sourceType: text('source_type').default('FOUNDER_APPROVED').notNull(), // FOUNDER_APPROVED | ADMIN_CURATED | MEASURED_OUTCOME | CANDIDATE_FROM_CHAT
  epistemicType: text('epistemic_type').default('APPROVED_POLICY').notNull(), // APPROVED_POLICY | MEASURED_LEARNING | HYPOTHESIS
  governanceStatus: text('governance_status').default('APPROVED_ACTIVE').notNull(), // DRAFT_CANDIDATE | PENDING_ADMIN_REVIEW | APPROVED_ACTIVE | REVOKED
  isEnforcedInPrompts: boolean('is_enforced_in_prompts').default(true).notNull(),
  version: integer('version').default(1).notNull(),
  versionHistory: jsonb('version_history').notNull(), // Array of immutable version snapshots { version, updatedAt, updatedBy, changeSummary, governanceStatus, summary, structuredPolicy }
  linkedEntityIds: jsonb('linked_entity_ids').notNull(), // Array of linked SKUs, campaign IDs, segment names, or proposal IDs
  measuredOutcomeEvidence: jsonb('measured_outcome_evidence'), // { baselineMetric, actualOutcomeMetric, sampleSize, confidenceLevel, verifiedAtUtc }
  createdByEmail: text('created_by_email').default('admin@fragmore.com').notNull(),
  approvedByEmail: text('approved_by_email'),
  approvedAt: timestamp('approved_at'),
  revokedByEmail: text('revoked_by_email'),
  revokedAt: timestamp('revoked_at'),
  revocationReason: text('revocation_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 39. AI CMO 3.0 Scheduled Intelligence Runs & Epistemic Reports Ledger
export const aiCmoScheduledIntelligenceRuns = pgTable('ai_cmo_scheduled_intelligence_runs', {
  id: text('id').primaryKey(), // e.g. 'AICMO-INTEL-...'
  jobType: text('job_type').notNull(), // DAILY_BUSINESS_BRIEF | DAILY_CAMPAIGN_ANOMALY_REVIEW | WEEKLY_MARKETING_STRATEGY | WEEKLY_CREATIVE_PERFORMANCE_REVIEW | MONTHLY_CONTRIBUTION_PROFIT_REPORT | INVENTORY_AND_DEMAND_ALERTS | WORKFLOW_FAILURE_MONITORING
  scheduledTaskId: text('scheduled_task_id').notNull(), // Links to automation_scheduled_tasks.id (single scheduler, zero duplication)
  title: text('title').notNull(),
  triggerSource: text('trigger_source').default('SCHEDULED_CRON').notNull(), // SCHEDULED_CRON | ADMIN_MANUAL_RUN
  status: text('status').default('COMPLETED').notNull(), // COMPLETED | WARNING_DETECTED | ACTION_PROPOSED_AWAITING_APPROVAL | FAILED
  executiveSummary: text('executive_summary').notNull(),
  measuredLearnings: jsonb('measured_learnings').notNull(), // Array of verified empirical findings citing historical outcomes & live PostgreSQL data
  testableHypotheses: jsonb('testable_hypotheses').notNull(), // Array of clearly labeled hypotheses with explicit assumptions & validation criteria
  referencedMemoryIds: jsonb('referenced_memory_ids').notNull(), // string[] of ai_cmo_durable_memory IDs applied
  liveDataSnapshot: jsonb('live_data_snapshot').notNull(), // Snapshot of authoritative orders, campaigns, inventory, workflows at run time
  recommendedDraftActions: jsonb('recommended_draft_actions').notNull(), // Non-executing recommendations requiring explicit admin approval
  autoExecutionBlocked: boolean('auto_execution_blocked').default(true).notNull(), // Enforces zero automatic campaign launch, spend, or promo dispatch
  tokenUsage: jsonb('token_usage').notNull(), // { model, promptTokens, completionTokens, totalTokens, costInr }
  latencyMs: integer('latency_ms').default(0).notNull(),
  executedByEmail: text('executed_by_email').default('scheduler@fragmore.com').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 40. AI CMO 3.0 Intelligence Governance, Token/Cost Budgets & Data Retention Settings
export const aiCmoIntelligenceGovernanceSettings = pgTable('ai_cmo_intelligence_governance_settings', {
  id: text('id').primaryKey(), // 'GLOBAL_AI_CMO_INTELLIGENCE_SETTINGS'
  rawChatAutoPolicyPromotionBlocked: boolean('raw_chat_auto_policy_promotion_blocked').default(true).notNull(),
  blockAutoCampaignLaunch: boolean('block_auto_campaign_launch').default(true).notNull(),
  blockAutoAdSpendMutation: boolean('block_auto_ad_spend_mutation').default(true).notNull(),
  blockAutoPromotionalMessaging: boolean('block_auto_promotional_messaging').default(true).notNull(),
  requireHistoricalOutcomeCitations: boolean('require_historical_outcome_citations').default(true).notNull(),
  separateMeasuredFromHypotheses: boolean('separate_measured_from_hypotheses').default(true).notNull(),
  maxDailyTokenBudget: integer('max_daily_token_budget').default(250000).notNull(),
  maxMonthlyTokenBudget: integer('max_monthly_token_budget').default(5000000).notNull(),
  maxSingleRequestTokens: integer('max_single_request_tokens').default(16000).notNull(),
  maxDailyCostInr: real('max_daily_cost_inr').default(750).notNull(),
  maxMonthlyCostInr: real('max_monthly_cost_inr').default(15000).notNull(),
  budgetWarningThresholdPct: integer('budget_warning_threshold_pct').default(80).notNull(),
  hardStopOnBudgetExceeded: boolean('hard_stop_on_budget_exceeded').default(true).notNull(),
  dataRetentionPolicy: jsonb('data_retention_policy').notNull(), // { conversationRetentionDays, toolCallLogRetentionDays, scheduledBriefingRetentionDays, revokedMemoryRetentionDays, piiAutoRedactionEnabled, lastPurgeRunAtUtc }
  updatedByEmail: text('updated_by_email').default('admin@fragmore.com').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 41. Supplier Purchase Orders (Procurement Module) Table
export const supplierPurchaseOrders = pgTable('supplier_purchase_orders', {
  id: text('id').primaryKey(),
  poNumber: text('po_number').notNull().unique(),
  supplierId: text('supplier_id').notNull(),
  supplierName: text('supplier_name').notNull(),
  supplierEmail: text('supplier_email'),
  supplierPhone: text('supplier_phone'),
  category: text('category').default('PACKAGING').notNull(),
  requisitionId: text('requisition_id'),
  rfqId: text('rfq_id'),
  quotationId: text('quotation_id'),
  warehouseId: text('warehouse_id').default('wh-mumbai-rm'),
  orderDate: text('order_date').notNull(),
  expectedDeliveryDate: text('expected_delivery_date').notNull(),
  actualDeliveryDate: text('actual_delivery_date'),
  items: jsonb('items').notNull(), // Array<{ id, materialId?, sku?, name, category?, quantity, receivedQty?, unit, unitPriceInr, taxPct?, totalPriceInr }>
  subtotalInr: integer('subtotal_inr').notNull(),
  gstInr: integer('gst_inr').default(0).notNull(),
  shippingInr: integer('shipping_inr').default(0).notNull(),
  totalCostInr: integer('total_cost_inr').notNull(),
  isInterState: boolean('is_inter_state').default(false).notNull(),
  status: text('status').default('DRAFT').notNull(), // DRAFT | PENDING_APPROVAL | ORDERED | IN_TRANSIT | PARTIALLY_RECEIVED | RECEIVED | CANCELLED
  receivedStatus: text('received_status').default('UNRECEIVED').notNull(), // UNRECEIVED | PARTIALLY_RECEIVED | FULLY_RECEIVED
  approvalStatus: text('approval_status').default('APPROVED').notNull(), // APPROVED | PENDING_APPROVAL | REJECTED
  approvedBy: text('approved_by'),
  approvalThresholdTier: text('approval_threshold_tier').default('STANDARD').notNull(),
  advancePaidInr: real('advance_paid_inr').default(0).notNull(),
  invoicedAmountInr: real('invoiced_amount_inr').default(0).notNull(),
  paymentStatus: text('payment_status').default('PENDING').notNull(), // PENDING | PARTIALLY_PAID | PAID
  paymentTerms: text('payment_terms').default('NET_30').notNull(),
  cancellationReason: text('cancellation_reason'),
  notes: text('notes'),
  createdBy: text('created_by').default('admin@fragmore.com').notNull(),
  receivedBy: text('received_by'),
  version: integer('version').default(1).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 42. Procurement Suppliers Directory Table
export const procurementSuppliers = pgTable('procurement_suppliers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  legalName: text('legal_name'),
  tradeName: text('trade_name'),
  code: text('code').notNull().unique(),
  category: text('category').notNull(),
  gstin: text('gstin'),
  pan: text('pan'),
  address: text('address'),
  stateName: text('state_name').default('Maharashtra'),
  contactPerson: text('contact_person').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  city: text('city').notNull(),
  country: text('country').default('India').notNull(),
  leadTimeDays: integer('lead_time_days').default(14).notNull(),
  moq: integer('moq').default(1).notNull(),
  paymentTerms: text('payment_terms').default('NET_30').notNull(),
  bankDetails: jsonb('bank_details'), // { bankName, accountHolder, accountNumberMasked, ifsc, branch, upiId }
  rating: text('rating').default('A_GRADE').notNull(), // A_GRADE | B_GRADE | C_GRADE
  status: text('status').default('ACTIVE').notNull(), // ACTIVE | INACTIVE | UNDER_REVIEW
  materialsSupplied: jsonb('materials_supplied').notNull(), // string[] (categories or material names)
  performanceMetrics: jsonb('performance_metrics'), // { totalOrders, onTimeDeliveries, onTimeRatePct, qcPassRatePct, avgLeadTimeDays, totalSpendInr }
  notes: text('notes'),
  version: integer('version').default(1).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// FRAGMORÉ BUSINESS OS — ADDITIVE NORMALIZED ERP SCHEMA
// Zero destructive changes to existing tables. Uses foreign keys, indexes,
// status tracking, idempotency keys, and optimistic concurrency versions.
// ============================================================================

// 43. Organizations (Company Master, GSTIN, Bank Details, Fiscal Config)
export const erpOrganizations = pgTable('erp_organizations', {
  id: text('id').primaryKey(), // e.g. 'org-fragmore-hq'
  code: text('code').notNull().unique(),
  legalName: text('legal_name').notNull(),
  brandName: text('brand_name').notNull(),
  tagline: text('tagline').default('Scent That Stays With You.').notNull(),
  websiteUrl: text('website_url').default('https://fragmore.shop/').notNull(),
  gstin: text('gstin').notNull(),
  pan: text('pan').notNull(),
  cin: text('cin'),
  stateCode: text('state_code').default('27').notNull(), // Maharashtra 27
  stateName: text('state_name').default('Maharashtra').notNull(),
  city: text('city').default('Mumbai').notNull(),
  registeredAddress: text('registered_address').notNull(),
  contactEmail: text('contact_email').notNull(),
  contactPhone: text('contact_phone').notNull(),
  currency: text('currency').default('INR').notNull(),
  fiscalYearStartMonth: integer('fiscal_year_start_month').default(4).notNull(),
  defaultGstRatePct: integer('default_gst_rate_pct').default(18).notNull(),
  bankDetails: jsonb('bank_details').notNull(), // { bankName, accountName, accountNumberMasked, ifsc, branch, upiId }
  numberingPrefixes: jsonb('numbering_prefixes').notNull(), // Record<string, string>
  eInvoiceEnabled: boolean('e_invoice_enabled').default(false).notNull(),
  eInvoiceThresholdInr: integer('e_invoice_threshold_inr').default(50000000).notNull(),
  eWayBillThresholdInr: integer('e_way_bill_threshold_inr').default(50000).notNull(),
  inventoryValuationPolicy: text('inventory_valuation_policy').default('WEIGHTED_AVERAGE').notNull(), // WEIGHTED_AVERAGE | FIFO_LOT_COST
  gstConfigApprovedBy: text('gst_config_approved_by'),
  gstConfigApprovedAt: timestamp('gst_config_approved_at'),
  accountingReadyStatus: text('accounting_ready_status').default('VERIFICATION_PENDING').notNull(), // VERIFICATION_PENDING | ACCOUNTANT_ACCEPTED_READY
  accountantSignoffEmail: text('accountant_signoff_email'),
  accountantSignoffAt: timestamp('accountant_signoff_at'),
  status: text('status').default('ACTIVE').notNull(),
  version: integer('version').default(1).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 44. Departments
export const erpDepartments = pgTable(
  'erp_departments',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    code: text('code').notNull().unique(),
    name: text('name').notNull(),
    headEmail: text('head_email'),
    costCenterCode: text('cost_center_code').notNull(),
    description: text('description'),
    status: text('status').default('ACTIVE').notNull(),
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('idx_erp_dept_org').on(t.organizationId)]
);

// 45. RBAC Roles
export const erpRoles = pgTable(
  'erp_roles',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    departmentId: text('department_id').references(() => erpDepartments.id, { onDelete: 'set null' }),
    code: text('code').notNull().unique(), // e.g. SUPER_ADMIN, FORMULATOR, FINANCE_CONTROLLER
    name: text('name').notNull(),
    description: text('description'),
    hierarchyLevel: integer('hierarchy_level').default(50).notNull(), // 100 = Super Admin, 10 = Intern
    isSystem: boolean('is_system').default(false).notNull(),
    status: text('status').default('ACTIVE').notNull(),
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('idx_erp_roles_org_dept').on(t.organizationId, t.departmentId)]
);

// 46. Granular Permissions Matrix per Role & Module
export const erpPermissions = pgTable(
  'erp_permissions',
  {
    id: text('id').primaryKey(),
    roleId: text('role_id')
      .notNull()
      .references(() => erpRoles.id, { onDelete: 'cascade' }),
    moduleKey: text('module_key').notNull(), // executive | procurement | materials | formulations | batches | quality | warehouse | crm | sales | proposals | gst_billing | accounting | marketing | hr | rbac | reports | assistant | settings
    canView: boolean('can_view').default(false).notNull(),
    canCreate: boolean('can_create').default(false).notNull(),
    canEdit: boolean('can_edit').default(false).notNull(),
    canApprove: boolean('can_approve').default(false).notNull(),
    canDelete: boolean('can_delete').default(false).notNull(),
    canExport: boolean('can_export').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('idx_erp_perm_role_mod').on(t.roleId, t.moduleKey)]
);

// 47. User Access Bindings (Links Users/Staff Emails to RBAC Roles & Departments)
export const erpUserAccess = pgTable(
  'erp_user_access',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    userUid: text('user_uid'),
    email: text('email').notNull().unique(),
    displayName: text('display_name').notNull(),
    roleId: text('role_id')
      .notNull()
      .references(() => erpRoles.id),
    departmentId: text('department_id').references(() => erpDepartments.id),
    isActive: boolean('is_active').default(true).notNull(),
    lastActiveAt: timestamp('last_active_at'),
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('idx_erp_user_access_email').on(t.email), index('idx_erp_user_access_role').on(t.roleId)]
);

// 48. Warehouses & Storage Zones
export const erpWarehouses = pgTable(
  'erp_warehouses',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    code: text('code').notNull().unique(),
    name: text('name').notNull(),
    warehouseType: text('warehouse_type').notNull(), // RAW_MATERIAL | PACKAGING | WIP_MACERATION | FINISHED_GOODS | QUARANTINE
    city: text('city').notNull(),
    state: text('state').notNull(),
    address: text('address').notNull(),
    capacityUnits: integer('capacity_units').default(50000).notNull(),
    temperatureControlled: boolean('temperature_controlled').default(false).notNull(),
    managerEmail: text('manager_email'),
    status: text('status').default('ACTIVE').notNull(),
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('idx_erp_wh_type').on(t.warehouseType)]
);

// 49. Raw Materials & Packaging Components Master
export const erpMaterials = pgTable(
  'erp_materials',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    defaultWarehouseId: text('default_warehouse_id').references(() => erpWarehouses.id),
    preferredSupplierId: text('preferred_supplier_id'),
    code: text('code').notNull().unique(),
    name: text('name').notNull(),
    category: text('category').notNull(), // ESSENTIAL_OIL | AROMA_CHEMICAL | ABSOLUTE | SOLVENT | GLASS_FLACON | ATOMIZER_CAP | COFFRET_BOX | LABEL | CORRUGATED
    stockType: text('stock_type').default('RAW_MATERIAL').notNull(), // RAW_MATERIAL | FRAGRANCE_OIL | PACKAGING | CONSUMABLE
    uom: text('uom').default('pcs').notNull(), // g | kg | ml | l | pcs (plus legacy units | liters | grams)
    densityGPerMl: real('density_g_per_ml'), // Required positive density (g/mL) for any mass <-> volume conversion; NEVER assume 1g = 1ml
    densityValidated: boolean('density_validated').default(false).notNull(),
    retestIntervalDays: integer('retest_interval_days').default(365),
    hsnCode: text('hsn_code').default('33029011').notNull(),
    gstRatePct: integer('gst_rate_pct').default(18).notNull(),
    unitCostInr: real('unit_cost_inr').default(0).notNull(),
    currentStock: real('current_stock').default(0).notNull(),
    reservedStock: real('reserved_stock').default(0).notNull(),
    reorderLevel: real('reorder_level').default(100).notNull(),
    targetStock: real('target_stock').default(500).notNull(),
    ifraMaxPct: real('ifra_max_pct'),
    allergenNote: text('allergen_note'),
    casNumber: text('cas_number'),
    status: text('status').default('OPTIMAL').notNull(), // OPTIMAL | LOW_STOCK | CRITICAL | INACTIVE
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('idx_erp_mat_cat').on(t.category), index('idx_erp_mat_status').on(t.status)]
);

// 50. Goods Receipts (GRN — Links Supplier PO to Stock Lots & AP Journal)
export const erpGoodsReceipts = pgTable(
  'erp_goods_receipts',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    purchaseOrderId: text('purchase_order_id')
      .notNull()
      .references(() => supplierPurchaseOrders.id),
    warehouseId: text('warehouse_id')
      .notNull()
      .references(() => erpWarehouses.id),
    grnNumber: text('grn_number').notNull().unique(),
    supplierId: text('supplier_id').notNull(),
    supplierName: text('supplier_name').notNull(),
    challanNumber: text('challan_number'),
    receivedDate: text('received_date').notNull(),
    receivedByEmail: text('received_by_email').notNull(),
    items: jsonb('items').notNull(), // Array<{ materialId, materialCode, materialName, orderedQty, receivedQty, acceptedQty, rejectedQty, unit, unitCostInr, lotNumber, expiryDate }>
    subtotalInr: real('subtotal_inr').default(0).notNull(),
    taxInr: real('tax_inr').default(0).notNull(),
    totalInr: real('total_inr').default(0).notNull(),
    qcStatus: text('qc_status').default('PENDING_INSPECTION').notNull(), // PENDING_INSPECTION | PASSED | PARTIAL_REJECTED | FAILED
    inventoryPosted: boolean('inventory_posted').default(false).notNull(),
    inspectedByEmail: text('inspected_by_email'),
    inspectedAt: timestamp('inspected_at'),
    inspectionNotes: text('inspection_notes'),
    journalId: text('journal_id'),
    notes: text('notes'),
    idempotencyKey: text('idempotency_key').unique(),
    status: text('status').default('POSTED').notNull(), // DRAFT | POSTED | CANCELLED
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('idx_erp_grn_po').on(t.purchaseOrderId), index('idx_erp_grn_wh').on(t.warehouseId)]
);

// 51. Stock Lots (FIFO Lot Traceability for Concentrates, Oils, Packaging, WIP, Samples & Damaged Stock)
export const erpStockLots = pgTable(
  'erp_stock_lots',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    materialId: text('material_id')
      .notNull()
      .references(() => erpMaterials.id, { onDelete: 'cascade' }),
    warehouseId: text('warehouse_id')
      .notNull()
      .references(() => erpWarehouses.id),
    warehouseLocation: text('warehouse_location').default('BAY-A1').notNull(),
    grnId: text('grn_id').references(() => erpGoodsReceipts.id, { onDelete: 'set null' }),
    purchaseRef: text('purchase_ref'), // PO-xxx / GRN-xxx
    supplierId: text('supplier_id'),
    supplierName: text('supplier_name'),
    stockCategory: text('stock_category').default('RAW_MATERIAL').notNull(), // RAW_MATERIAL | FRAGRANCE_OIL | PACKAGING | WIP | FINISHED_GOODS | SAMPLE | DAMAGED
    uom: text('uom').default('pcs').notNull(),
    lotNumber: text('lot_number').notNull().unique(),
    supplierBatchRef: text('supplier_batch_ref'),
    receivedQty: real('received_qty').notNull(),
    availableQty: real('available_qty').notNull(),
    reservedQty: real('reserved_qty').default(0).notNull(),
    consumedQty: real('consumed_qty').default(0).notNull(),
    damagedQty: real('damaged_qty').default(0).notNull(),
    unitCostInr: real('unit_cost_inr').default(0).notNull(),
    receivedDate: text('received_date').notNull(),
    retestDate: text('retest_date'),
    expiryDate: text('expiry_date'),
    qcStatus: text('qc_status').default('APPROVED').notNull(), // PENDING | APPROVED | QUARANTINED | EXPIRED
    status: text('status').default('ACTIVE').notNull(), // ACTIVE | DEPLETED | QUARANTINED
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('idx_erp_lot_mat').on(t.materialId),
    index('idx_erp_lot_wh').on(t.warehouseId),
    index('idx_erp_lot_qc').on(t.qcStatus),
    index('idx_erp_lot_cat').on(t.stockCategory)
  ]
);

// 52. Perfume Formulations Master
export const erpFormulations = pgTable(
  'erp_formulations',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    formulaCode: text('formula_code').notNull().unique(),
    name: text('name').notNull(),
    fragranceFamily: text('fragrance_family').notNull(),
    productSlug: text('product_slug'),
    concentrationType: text('concentration_type').default('Extrait de Parfum 28%').notNull(),
    targetOilPct: real('target_oil_pct').default(28).notNull(),
    macerationDays: integer('maceration_days').default(21).notNull(),
    perfumerEmail: text('perfumer_email').notNull(),
    activeVersionNumber: integer('active_version_number').default(1).notNull(),
    notes: text('notes'),
    status: text('status').default('APPROVED').notNull(), // DRAFT | LAB_TRIAL | PENDING_APPROVAL | APPROVED | ARCHIVED
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('idx_erp_frm_status').on(t.status)]
);

// 53. Perfume Formulation Versions (Versioned BOM, Multi-Size Packaging BOM, Density Costing & Confidentiality)
export const erpFormulationVersions = pgTable(
  'erp_formulation_versions',
  {
    id: text('id').primaryKey(),
    formulationId: text('formulation_id')
      .notNull()
      .references(() => erpFormulations.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    changeSummary: text('change_summary').notNull(),
    ingredients: jsonb('ingredients').notNull(), // Array<{ materialId, materialCode, materialName, notePyramid, percentage, quantityInBatch?, uom?, densityGPerMl?, costPerKgInr }>
    totalPercentage: real('total_percentage').default(100).notNull(),
    concentratePct: real('concentrate_pct').default(28).notNull(),
    solventPct: real('solvent_pct').default(72).notNull(),
    targetBatchSize: real('target_batch_size').default(10).notNull(),
    targetBatchUnit: text('target_batch_unit').default('kg').notNull(), // kg | l
    expectedYieldPct: real('expected_yield_pct').default(98).notNull(),
    expectedYieldQty: real('expected_yield_qty').default(9.8).notNull(),
    packagingBom: jsonb('packaging_bom'), // Record<sizeLabel (e.g. '2ML','10ML','15ML','30ML','50ML', custom), Array<{ materialId, materialName, componentType: 'BOTTLE'|'CAP'|'SPRAYER'|'LABEL'|'CARTON', qtyPerBottle, unitCostInr }>>
    bottleSizeCosts: jsonb('bottle_size_costs'), // Array<{ sizeLabel, sizeMl, juiceCostInr, packagingCostInr, totalEstimatedCostPerBottleInr }>
    supportedBottleSizes: jsonb('supported_bottle_sizes'), // string[] e.g. ['2ML','10ML','15ML','30ML','50ML'] + configurable sizes
    isConfidential: boolean('is_confidential').default(false).notNull(),
    confidentialityLevel: text('confidentiality_level').default('STANDARD').notNull(), // STANDARD | RESTRICTED | TOP_SECRET_MASTER
    authorizedRoleCodes: jsonb('authorized_role_codes'), // string[] e.g. ['SUPER_ADMIN', 'FORMULATOR']
    costPerKgInr: real('cost_per_kg_inr').default(0).notNull(),
    estimatedCostPer50mlInr: real('estimated_cost_per_50ml_inr').default(0).notNull(),
    ifraComplianceStatus: text('ifra_compliance_status').default('PENDING_EVIDENCE').notNull(), // PENDING_EVIDENCE | COMPLIANT | RESTRICTED | NON_COMPLIANT
    safetyStatus: text('safety_status').default('UNVERIFIED').notNull(), // UNVERIFIED | SAFETY_VERIFIED | FLAGGED
    regulatoryAuthorizationBy: text('regulatory_authorization_by'),
    regulatoryAuthorizedAt: timestamp('regulatory_authorized_at'),
    supportingEvidenceRef: text('supporting_evidence_ref'),
    ifraDossierRef: text('ifra_dossier_ref'),
    complianceNotes: text('compliance_notes'),
    stabilityNotes: text('stability_notes'),
    createdByEmail: text('created_by_email').notNull(),
    approvedByEmail: text('approved_by_email'),
    approvedAt: timestamp('approved_at'),
    status: text('status').default('APPROVED').notNull(), // DRAFT | PENDING_APPROVAL | APPROVED | SUPERSEDED
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('idx_erp_frm_ver_parent').on(t.formulationId, t.versionNumber)]
);

// 54. Samples Management (R&D Lab Trials, Influencer Seeding, Retailer Testing, Corporate & Perfume Bar Demos)
export const erpSamples = pgTable(
  'erp_samples',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    formulationId: text('formulation_id').references(() => erpFormulations.id, { onDelete: 'set null' }),
    formulationVersionId: text('formulation_version_id').references(() => erpFormulationVersions.id, { onDelete: 'set null' }),
    batchId: text('batch_id'),
    sampleNumber: text('sample_number').notNull().unique(),
    sampleType: text('sample_type').notNull(), // Legacy alias or purpose code
    purpose: text('purpose').default('INTERNAL_QC').notNull(), // NEW_FORMULA_DEV | FORMULA_REVISION | CUSTOMER_TRIAL | INFLUENCER_SEEDING | RETAILER_TESTING | CORPORATE_PROPOSAL | PERFUME_BAR_DEMO | INTERNAL_QC
    workflowStage: text('workflow_stage').default('REQUESTED').notNull(), // REQUESTED | APPROVED | MATERIAL_ISSUED | PREPARED | TESTING | FEEDBACK | REVISION_REQUIRED | APPROVED_FOR_DISPATCH | DISPATCHED | ARCHIVED
    fragranceName: text('fragrance_name').notNull(),
    rawMaterialLotRefs: jsonb('raw_material_lot_refs'), // Array<{ materialId, materialCode?, materialName, lotId?, lotNumber?, qtyIssued, uom, unitCostInr, lineCostInr, componentRole }>
    preparationDate: text('preparation_date'),
    quantityUnits: integer('quantity_units').default(1).notNull(),
    volumeMl: integer('volume_ml').default(10).notNull(),
    preparerEmail: text('preparer_email'),
    approvedByEmail: text('approved_by_email'),
    approvedAt: timestamp('approved_at'),
    recipientType: text('recipient_type').default('INTERNAL').notNull(), // INTERNAL | CUSTOMER | INFLUENCER | RETAILER | DISTRIBUTOR | CORPORATE | PERFUME_BAR
    recipientName: text('recipient_name'),
    recipientCompany: text('recipient_company'),
    recipientEmail: text('recipient_email'),
    recipientPhone: text('recipient_phone'),
    recipientAddress: text('recipient_address'),
    dispatchDate: text('dispatch_date'),
    courierName: text('courier_name'),
    trackingNumber: text('tracking_number'),
    olfactoryScore: real('olfactory_score'),
    longevityHours: real('longevity_hours'),
    evaluationNotes: text('evaluation_notes'),
    feedbackStatus: text('feedback_status').default('PENDING').notNull(), // PENDING | RECEIVED_POSITIVE | REVISION_NEEDED | CONVERTED | NO_RESPONSE
    feedbackSummary: text('feedback_summary'),
    feedbackReceivedAt: timestamp('feedback_received_at'),
    followUpDate: text('follow_up_date'),
    rawMaterialCostInr: real('raw_material_cost_inr').default(0).notNull(),
    vialCostInr: real('vial_cost_inr').default(0).notNull(),
    labelCostInr: real('label_cost_inr').default(0).notNull(),
    packagingCostInr: real('packaging_cost_inr').default(0).notNull(),
    shippingCostInr: real('shipping_cost_inr').default(0).notNull(),
    handlingCostInr: real('handling_cost_inr').default(0).notNull(),
    totalCostInr: real('total_cost_inr').default(0).notNull(),
    costPerSampleInr: real('cost_per_sample_inr').default(0).notNull(),
    leadId: text('lead_id'),
    customerId: text('customer_id'),
    convertedToOrderId: text('converted_to_order_id'),
    conversionValueInr: real('conversion_value_inr').default(0).notNull(),
    marketingBriefId: text('marketing_brief_id'),
    influencerDeliverableId: text('influencer_deliverable_id'),
    parentSampleId: text('parent_sample_id'),
    revisionNumber: integer('revision_number').default(1).notNull(),
    materialIssued: boolean('material_issued').default(false).notNull(),
    stageHistory: jsonb('stage_history'), // Array<{ stage, action, actorEmail, timestamp, note? }>
    requestedByEmail: text('requested_by_email').notNull(),
    status: text('status').default('REQUESTED').notNull(), // Mirrors workflowStage / compatibility status
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('idx_erp_samples_status').on(t.status),
    index('idx_erp_samples_stage').on(t.workflowStage),
    index('idx_erp_samples_purpose').on(t.purpose)
  ]
);

// 55. Quality Control (QC) Laboratory Records
export const erpQcRecords = pgTable(
  'erp_qc_records',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    qcNumber: text('qc_number').notNull().unique(),
    inspectionType: text('inspection_type').notNull(), // RAW_MATERIAL_INWARD | IN_PROCESS_MACERATION | SAMPLE_EVALUATION | FINISHED_BATCH_RELEASE | STABILITY_AUDIT
    batchId: text('batch_id'),
    grnId: text('grn_id').references(() => erpGoodsReceipts.id, { onDelete: 'set null' }),
    sampleId: text('sample_id').references(() => erpSamples.id, { onDelete: 'set null' }),
    subjectName: text('subject_name').notNull(),
    checklistId: text('checklist_id'),
    checklistName: text('checklist_name'),
    checklistResults: jsonb('checklist_results'), // Array<{ criterionId, parameter, targetSpec, measuredValue, isCritical, passed, notes? }>
    abvTestedPct: real('abv_tested_pct').default(80.0).notNull(),
    specificGravity: real('specific_gravity').default(0.845).notNull(),
    refractiveIndex: real('refractive_index').default(1.368).notNull(),
    gcmsMatchPct: real('gcms_match_pct').default(99.2).notNull(),
    appearanceResult: text('appearance_result').default('CLEAR_HOMOGENEOUS').notNull(),
    odourResult: text('odour_result').default('CONFORMS_TO_MASTER').notNull(),
    colourResult: text('colour_result').default('MILD_GOLD_CLEAR').notNull(),
    targetFillVolumeMl: real('target_fill_volume_ml'),
    actualFillVolumeMl: real('actual_fill_volume_ml'),
    packagingInspectionResult: text('packaging_inspection_result').default('PASS').notNull(),
    stabilityObservations: text('stability_observations'),
    labTests: jsonb('lab_tests'), // { phLevel?, uvStabilityPassed?, freezeThawPassed?, flashPointC?, allergenScreenRef?, notes? }
    clarityResult: text('clarity_result').default('CRYSTAL_CLEAR').notNull(),
    olfactoryResult: text('olfactory_result').default('CONFORMS').notNull(),
    microbiologyPass: boolean('microbiology_pass').default(true).notNull(),
    decision: text('decision').default('PENDING').notNull(), // PENDING | PASSED | FAILED | QUARANTINED
    correctiveAction: text('corrective_action'),
    capaStatus: text('capa_status').default('NONE').notNull(), // NONE | OPEN | IN_PROGRESS | VERIFIED_CLOSED
    retestOfQcId: text('retest_of_qc_id'),
    retestCount: integer('retest_count').default(0).notNull(),
    approvalHistory: jsonb('approval_history'), // Array<{ decision, actorEmail, timestamp, notes? }>
    supportingEvidenceRef: text('supporting_evidence_ref'),
    certificateNumber: text('certificate_number'),
    certificateIssuedAt: timestamp('certificate_issued_at'),
    inspectorEmail: text('inspector_email').notNull(),
    approvedByEmail: text('approved_by_email'),
    approvedAt: timestamp('approved_at'),
    status: text('status').default('OPEN').notNull(), // OPEN | COMPLETED | QUARANTINED
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('idx_erp_qc_batch').on(t.batchId), index('idx_erp_qc_decision').on(t.decision), index('idx_erp_qc_sample').on(t.sampleId)]
);

// 56. Finished Goods Warehouse Bins & Batch Allocations
export const erpFinishedGoods = pgTable(
  'erp_finished_goods',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    warehouseId: text('warehouse_id')
      .notNull()
      .references(() => erpWarehouses.id),
    productId: text('product_id').notNull(),
    sku: text('sku').notNull().unique(),
    productName: text('product_name').notNull(),
    size: text('size').notNull(),
    binLocation: text('bin_location').default('WH-FG-A1').notNull(),
    batchId: text('batch_id'),
    batchNumber: text('batch_number'),
    quantityOnHand: integer('quantity_on_hand').default(0).notNull(),
    quantityReserved: integer('quantity_reserved').default(0).notNull(),
    quantityAvailable: integer('quantity_available').default(0).notNull(),
    unitManufacturingCostInr: real('unit_manufacturing_cost_inr').default(420).notNull(),
    mrpInr: integer('mrp_inr').default(0).notNull(),
    sellingPriceInr: integer('selling_price_inr').default(0).notNull(),
    hsnCode: text('hsn_code').default('33030050').notNull(),
    gstRatePct: integer('gst_rate_pct').default(18).notNull(),
    status: text('status').default('ACTIVE').notNull(), // ACTIVE | LOW_STOCK | QUARANTINED | DEPLETED
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('idx_erp_fg_wh').on(t.warehouseId), index('idx_erp_fg_sku').on(t.sku)]
);

// 57. B2B, Corporate, Hospitality, Reseller & Retail CRM Leads Pipeline
export const erpLeads = pgTable(
  'erp_leads',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    leadNumber: text('lead_number').notNull().unique(),
    companyName: text('company_name').notNull(),
    contactName: text('contact_name').notNull(),
    email: text('email').notNull(),
    phone: text('phone').notNull(),
    city: text('city').default('Mumbai').notNull(),
    state: text('state').default('Maharashtra').notNull(),
    leadType: text('lead_type').default('CORPORATE_GIFTING').notNull(),
    customerCategory: text('customer_category').default('CORPORATE_GIFTING').notNull(), // DIRECT_CONSUMER | RESELLER | RETAILER | DISTRIBUTOR | STOCKIST | CORPORATE_GIFTING | WEDDING_PLANNER | EVENT_MANAGER | HOTEL_HOSPITALITY | PERFUME_BAR_CUSTOMER | AGENCY_INSTITUTIONAL
    source: text('source').default('Website Inquiry').notNull(),
    estimatedValueInr: integer('estimated_value_inr').default(0).notNull(),
    probabilityPct: integer('probability_pct').default(25).notNull(),
    stage: text('stage').default('NEW').notNull(), // NEW | QUALIFIED | PROPOSAL_SENT | NEGOTIATION | WON | LOST
    workflowStage: text('workflow_stage').default('LEAD').notNull(), // LEAD | REQUIREMENT | PROPOSAL_DRAFT | INTERNAL_APPROVAL | SENT | CLIENT_NEGOTIATION | REVISED_PROPOSAL | ACCEPTED | SALES_ORDER | INVOICE | PAYMENT | FULFILMENT | LOST
    clientGstin: text('client_gstin'),
    clientAddress: text('client_address'),
    requirementsSummary: text('requirements_summary'),
    eventDate: text('event_date'),
    expectedQuantity: integer('expected_quantity'),
    contactHistory: jsonb('contact_history'), // Array<{ id, channel, summary, outcome, contactDate, actorEmail }>
    reminderNotes: text('reminder_notes'),
    assignedToEmail: text('assigned_to_email').notNull(),
    convertedCustomerId: text('converted_customer_id'),
    linkedOrderId: text('linked_order_id'),
    nextFollowUpDate: text('next_follow_up_date'),
    notes: text('notes'),
    status: text('status').default('ACTIVE').notNull(),
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('idx_erp_leads_stage').on(t.stage), index('idx_erp_leads_email').on(t.email), index('idx_erp_leads_cat').on(t.customerCategory)]
);

// 58. Corporate Proposals (Multi-Version, Package Tiers, Setup/Staffing/Shipping, Milestones & Acceptance)
export const erpProposals = pgTable(
  'erp_proposals',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    leadId: text('lead_id').references(() => erpLeads.id, { onDelete: 'set null' }),
    customerId: text('customer_id'),
    proposalNumber: text('proposal_number').notNull().unique(),
    proposalDate: text('proposal_date'),
    proposalType: text('proposal_type').default('CORPORATE_GIFTING').notNull(), // CORPORATE_GIFTING | EMPLOYEE_GIFTING | WEDDING_RETURN_GIFTS | PERFUME_BAR_EVENT | BULK_PERFUME_ORDER | RETAILER_DISTRIBUTOR_PARTNERSHIP | CUSTOM_FRAGRANCE_EXPERIENCE | SPECIAL_COLLECTION_PACKAGE
    versionGroupId: text('version_group_id'),
    proposalVersionNumber: integer('proposal_version_number').default(1).notNull(),
    parentProposalId: text('parent_proposal_id'),
    title: text('title').notNull(),
    clientCompany: text('client_company').notNull(),
    clientContactName: text('client_contact_name').notNull(),
    clientEmail: text('client_email').notNull(),
    clientPhone: text('client_phone'),
    clientAddress: text('client_address'),
    clientGstin: text('client_gstin'),
    placeOfSupplyState: text('place_of_supply_state').default('Maharashtra').notNull(),
    scopeSummary: text('scope_summary').notNull(),
    eventRequirements: jsonb('event_requirements'), // { eventType?, eventDate?, guestCount?, city?, brandingNotes? }
    customizationSpecs: text('customization_specs'),
    deliverables: jsonb('deliverables'), // string[]
    lineItems: jsonb('line_items').notNull(), // Array<{ productId?, slug?, themeColor?, sku, description, size?, hsnCode, qty, catalogueUnitPriceInr?, unitPriceInr, gstRatePct?, totalInr }>
    packageOptions: jsonb('package_options'), // Array<{ packageName, description, items: any[], subtotalInr, recommended? }>
    selectedPackageName: text('selected_package_name'),
    subtotalInr: real('subtotal_inr').default(0).notNull(),
    discountInr: real('discount_inr').default(0).notNull(),
    taxInr: real('tax_inr').default(0).notNull(),
    shippingInr: real('shipping_inr').default(0).notNull(),
    setupCostInr: real('setup_cost_inr').default(0).notNull(),
    staffingCostInr: real('staffing_cost_inr').default(0).notNull(),
    grandTotalInr: real('grand_total_inr').default(0).notNull(),
    estimatedValueInr: integer('estimated_value_inr').notNull(),
    paymentMilestones: jsonb('payment_milestones'), // Array<{ milestoneName, pct, amountInr, triggerCondition }>
    termsAndConditions: text('terms_and_conditions'),
    validUntil: text('valid_until').notNull(),
    preparedByEmail: text('prepared_by_email').notNull(),
    approvedByEmail: text('approved_by_email'),
    approvalStatus: text('approval_status').default('APPROVED').notNull(), // PENDING_APPROVAL | APPROVED | REJECTED
    sentAt: timestamp('sent_at'),
    acceptedByName: text('accepted_by_name'),
    acceptedByEmail: text('accepted_by_email'),
    acceptedAt: timestamp('accepted_at'),
    acceptanceRef: text('acceptance_ref'),
    negotiationNotes: text('negotiation_notes'),
    changeSummary: text('change_summary'),
    convertedQuotationId: text('converted_quotation_id'),
    convertedOrderId: text('converted_order_id'),
    status: text('status').default('DRAFT').notNull(), // PROPOSAL_DRAFT | INTERNAL_APPROVAL | SENT | CLIENT_NEGOTIATION | REVISED_PROPOSAL | ACCEPTED | REJECTED | CONVERTED
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('idx_erp_prop_lead').on(t.leadId), index('idx_erp_prop_status').on(t.status), index('idx_erp_prop_vg').on(t.versionGroupId)]
);

// 59. Formal Commercial Quotations
export const erpQuotations = pgTable(
  'erp_quotations',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    proposalId: text('proposal_id').references(() => erpProposals.id, { onDelete: 'set null' }),
    leadId: text('lead_id').references(() => erpLeads.id, { onDelete: 'set null' }),
    customerId: text('customer_id'),
    quotationNumber: text('quotation_number').notNull().unique(),
    quotationDate: text('quotation_date'),
    quotationVersionNumber: integer('quotation_version_number').default(1).notNull(),
    parentQuotationId: text('parent_quotation_id'),
    clientName: text('client_name').notNull(),
    clientEmail: text('client_email').notNull(),
    clientGstin: text('client_gstin'),
    placeOfSupplyState: text('place_of_supply_state').default('Maharashtra').notNull(),
    isInterState: boolean('is_inter_state').default(false).notNull(),
    items: jsonb('items').notNull(), // Array<{ productId?, slug?, themeColor?, sku, description, size?, hsnCode, qty, catalogueUnitPriceInr?, unitPriceInr, discountInr, gstRatePct, unitManufacturingCostInr?, lineTotalInr }>
    subtotalInr: real('subtotal_inr').notNull(),
    discountInr: real('discount_inr').default(0).notNull(),
    taxableAmountInr: real('taxable_amount_inr').notNull(),
    cgstInr: real('cgst_inr').default(0).notNull(),
    sgstInr: real('sgst_inr').default(0).notNull(),
    igstInr: real('igst_inr').default(0).notNull(),
    freightInr: real('freight_inr').default(0).notNull(),
    totalInr: real('total_inr').notNull(),
    paymentTerms: text('payment_terms').default('50% Advance, 50% Prior to Dispatch').notNull(),
    validUntil: text('valid_until').notNull(),
    approvalStatus: text('approval_status').default('APPROVED').notNull(), // PENDING_APPROVAL | APPROVED | REJECTED
    requiresPricingApproval: boolean('requires_pricing_approval').default(false).notNull(),
    maxDiscountPctApplied: real('max_discount_pct_applied').default(0).notNull(),
    acceptedByName: text('accepted_by_name'),
    acceptedByEmail: text('accepted_by_email'),
    acceptedAt: timestamp('accepted_at'),
    notes: text('notes'),
    convertedOrderId: text('converted_order_id'),
    convertedInvoiceId: text('converted_invoice_id'),
    createdByEmail: text('created_by_email').notNull(),
    approvedByEmail: text('approved_by_email'),
    idempotencyKey: text('idempotency_key').unique(),
    status: text('status').default('DRAFT').notNull(), // DRAFT | PENDING_APPROVAL | APPROVED | SENT | ACCEPTED | CONVERTED | EXPIRED
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('idx_erp_qt_status').on(t.status), index('idx_erp_qt_lead').on(t.leadId)]
);

// 60. GST Tax Invoices
export const erpInvoices = pgTable(
  'erp_invoices',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    orderId: text('order_id'),
    quotationId: text('quotation_id').references(() => erpQuotations.id, { onDelete: 'set null' }),
    invoiceNumber: text('invoice_number').notNull().unique(),
    invoiceType: text('invoice_type').default('TAX_INVOICE').notNull(), // TAX_INVOICE | B2B_GST_INVOICE | PROFORMA
    billingCategory: text('billing_category').default('B2C').notNull(), // B2C | B2B | CORPORATE_GIFTING | EVENT_SERVICES | SAMPLE_SALES | WHOLESALE
    pricingMode: text('pricing_mode').default('EXCLUSIVE').notNull(), // EXCLUSIVE | INCLUSIVE
    issueDate: text('issue_date').notNull(),
    dueDate: text('due_date').notNull(),
    customerId: text('customer_id'),
    customerName: text('customer_name').notNull(),
    customerEmail: text('customer_email').notNull(),
    customerGstin: text('customer_gstin'),
    billingAddress: text('billing_address'),
    placeOfSupplyState: text('place_of_supply_state').default('Maharashtra').notNull(),
    placeOfSupplyCode: text('place_of_supply_code').default('27').notNull(),
    isInterState: boolean('is_inter_state').default(false).notNull(),
    items: jsonb('items').notNull(), // Array<{ sku, description, hsnCode, qty, unitPriceInr, discountInr, taxableValueInr, gstRatePct, cgstInr, sgstInr, igstInr, totalInr }>
    subtotalInr: real('subtotal_inr').notNull(),
    discountInr: real('discount_inr').default(0).notNull(),
    taxableAmountInr: real('taxable_amount_inr').notNull(),
    cgstAmountInr: real('cgst_amount_inr').default(0).notNull(),
    sgstAmountInr: real('sgst_amount_inr').default(0).notNull(),
    igstAmountInr: real('igst_amount_inr').default(0).notNull(),
    totalTaxInr: real('total_tax_inr').default(0).notNull(),
    shippingInr: real('shipping_inr').default(0).notNull(),
    grandTotalInr: real('grand_total_inr').notNull(),
    advanceAdjustedInr: real('advance_adjusted_inr').default(0).notNull(),
    amountPaidInr: real('amount_paid_inr').default(0).notNull(),
    balanceDueInr: real('balance_due_inr').notNull(),
    cogsAmountInr: real('cogs_amount_inr').default(0).notNull(),
    cogsJournalId: text('cogs_journal_id'),
    journalId: text('journal_id'),
    irnAckNumber: text('irn_ack_number'),
    eInvoiceStatus: text('e_invoice_status').default('NOT_APPLICABLE').notNull(), // NOT_APPLICABLE | PENDING_NIC_GENERATION | IRN_VERIFIED | CANCELLED
    eInvoiceIrn: text('e_invoice_irn'),
    eInvoiceQrData: text('e_invoice_qr_data'),
    eWayBillNumber: text('e_way_bill_number'),
    eWayBillStatus: text('e_way_bill_status').default('NOT_REQUIRED').notNull(), // NOT_REQUIRED | PENDING_EWB_GENERATION | EWB_VERIFIED
    proformaConvertedToInvoiceId: text('proforma_converted_to_invoice_id'),
    notes: text('notes'),
    paymentStatus: text('payment_status').default('UNPAID').notNull(), // UNPAID | PARTIAL | PAID | CREDITED | VOID | PROFORMA
    status: text('status').default('ISSUED').notNull(), // DRAFT | PROFORMA | ISSUED | SETTLED | VOID
    createdByEmail: text('created_by_email').notNull(),
    idempotencyKey: text('idempotency_key').unique(),
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('idx_erp_inv_order').on(t.orderId),
    index('idx_erp_inv_pay_status').on(t.paymentStatus),
    index('idx_erp_inv_date').on(t.issueDate)
  ]
);

// 61. GST Credit Notes
export const erpCreditNotes = pgTable(
  'erp_credit_notes',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    invoiceId: text('invoice_id')
      .notNull()
      .references(() => erpInvoices.id),
    creditNoteNumber: text('credit_note_number').notNull().unique(),
    issueDate: text('issue_date').notNull(),
    customerName: text('customer_name').notNull(),
    customerEmail: text('customer_email').notNull(),
    reason: text('reason').notNull(),
    salesReturnId: text('sales_return_id'),
    gstRatePct: integer('gst_rate_pct').default(18).notNull(),
    taxableAmountInr: real('taxable_amount_inr').notNull(),
    cgstInr: real('cgst_inr').default(0).notNull(),
    sgstInr: real('sgst_inr').default(0).notNull(),
    igstInr: real('igst_inr').default(0).notNull(),
    totalCreditInr: real('total_credit_inr').notNull(),
    journalId: text('journal_id'),
    createdByEmail: text('created_by_email').notNull(),
    approvedByEmail: text('approved_by_email'),
    idempotencyKey: text('idempotency_key').unique(),
    status: text('status').default('APPLIED').notNull(), // DRAFT | PENDING_APPROVAL | APPLIED | VOID
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('idx_erp_cn_inv').on(t.invoiceId)]
);

// 62. Payments Ledger (Inbound Customer Receipts & Outbound Vendor/Payroll Payouts)
export const erpPayments = pgTable(
  'erp_payments',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    paymentNumber: text('payment_number').notNull().unique(),
    direction: text('direction').notNull(), // INBOUND_RECEIPT | OUTBOUND_PAYOUT
    partyType: text('party_type').notNull(), // CUSTOMER | SUPPLIER | EMPLOYEE | INFLUENCER
    partyName: text('party_name').notNull(),
    invoiceId: text('invoice_id').references(() => erpInvoices.id, { onDelete: 'set null' }),
    purchaseOrderId: text('purchase_order_id').references(() => supplierPurchaseOrders.id, { onDelete: 'set null' }),
    supplierId: text('supplier_id'),
    vendorInvoiceId: text('vendor_invoice_id'),
    customerId: text('customer_id'),
    customerEmail: text('customer_email'),
    accountCode: text('account_code').default('1010').notNull(), // 1010 Bank | 1020 Cash | 1030 Petty Cash
    receiptNumber: text('receipt_number'),
    isAdvance: boolean('is_advance').default(false).notNull(),
    advanceRemainingInr: real('advance_remaining_inr').default(0).notNull(),
    advanceGstRatePct: integer('advance_gst_rate_pct').default(0).notNull(),
    reconciledWithBank: boolean('reconciled_with_bank').default(false).notNull(),
    bankStatementLineId: text('bank_statement_line_id'),
    paymentDate: text('payment_date').notNull(),
    method: text('method').default('NEFT').notNull(), // UPI | NEFT | RTGS | CARD | RAZORPAY | BANK_TRANSFER | CASH
    referenceNumber: text('reference_number').notNull(),
    amountInr: real('amount_inr').notNull(),
    journalId: text('journal_id'),
    notes: text('notes'),
    recordedByEmail: text('recorded_by_email').notNull(),
    idempotencyKey: text('idempotency_key').unique(),
    status: text('status').default('CLEARED').notNull(), // PENDING | CLEARED | REVERSED
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('idx_erp_pay_inv').on(t.invoiceId),
    index('idx_erp_pay_po').on(t.purchaseOrderId),
    index('idx_erp_pay_supp').on(t.supplierId)
  ]
);

// 63. Double-Entry Accounting Journals
export const erpAccountingJournals = pgTable(
  'erp_accounting_journals',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    journalNumber: text('journal_number').notNull().unique(),
    entryDate: text('entry_date').notNull(),
    fiscalPeriod: text('fiscal_period').notNull(), // e.g. FY2026-27
    sourceModule: text('source_module').notNull(), // SALES_INVOICE | PAYMENT | CREDIT_NOTE | DEBIT_NOTE | SALES_DEBIT_NOTE | PURCHASE_GRN | SUPPLIER_INVOICE | SUPPLIER_PAYMENT | PRODUCTION | EXPENSE | PETTY_CASH | COGS | ADVANCE | REVERSAL | MANUAL
    sourceEntityId: text('source_entity_id'),
    narration: text('narration').notNull(),
    lines: jsonb('lines').notNull(), // Array<{ accountCode: string; accountName: string; accountType: 'ASSET'|'LIABILITY'|'EQUITY'|'REVENUE'|'EXPENSE'; debitInr: number; creditInr: number; costCenter?: string }>
    totalDebitInr: real('total_debit_inr').notNull(),
    totalCreditInr: real('total_credit_inr').notNull(),
    isBalanced: boolean('is_balanced').default(true).notNull(),
    reversesJournalId: text('reverses_journal_id'),
    reversedByJournalId: text('reversed_by_journal_id'),
    reversalReason: text('reversal_reason'),
    isSystemImmutable: boolean('is_system_immutable').default(true).notNull(),
    postedByEmail: text('posted_by_email').notNull(),
    idempotencyKey: text('idempotency_key').unique(),
    status: text('status').default('POSTED').notNull(), // POSTED | REVERSED_CONTRA
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('idx_erp_jrn_date').on(t.entryDate), index('idx_erp_jrn_src').on(t.sourceModule)]
);

// 64. Digital Marketing Agency Workspace Assets & Deliverables
export const erpMarketingWorkspace = pgTable(
  'erp_marketing_workspace',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    campaignId: text('campaign_id'),
    briefCode: text('brief_code').notNull().unique(),
    title: text('title').notNull(),
    channel: text('channel').notNull(), // META_ADS | GOOGLE_ADS | INSTAGRAM | INFLUENCER | WHATSAPP | EMAIL
    creativeFormat: text('creative_format').notNull(), // REEL | STATIC_POST | CAROUSEL | EMAIL_FLOW | WHATSAPP_DROP | SEARCH_AD
    strategyType: text('strategy_type').default('BRAND_STORYTELLING').notNull(), // BRAND_STORYTELLING | VALUE_ADD_GIFTING | DISCOVERY_SAMPLING | LIMITED_EDITION_LAUNCH | EXPERIENTIAL_ATELIER | DISCOUNT_EXCEPTION
    targetAudience: text('target_audience').notNull(),
    budgetInr: integer('budget_inr').default(0).notNull(),
    spendInr: integer('spend_inr').default(0).notNull(),
    revenueAttributedInr: integer('revenue_attributed_inr').default(0).notNull(),
    leadsCount: integer('leads_count').default(0).notNull(),
    assigneeEmail: text('assignee_email').notNull(),
    scheduledDate: text('scheduled_date'),
    creativeCopy: text('creative_copy'),
    adScript: text('ad_script'),
    captionCopy: text('caption_copy'),
    storytellingAngle: text('storytelling_angle'),
    valueAddOffer: text('value_add_offer'),
    limitedEditionCode: text('limited_edition_code'),
    visualCompliance: jsonb('visual_compliance'),
    deliverableUrl: text('deliverable_url'),
    approvalStage: text('approval_stage').default('DRAFT').notNull(), // DRAFT | SUBMITTED | UNDER_REVIEW | CHANGES_REQUESTED | APPROVED | PUBLISHED
    founderFeedback: text('founder_feedback'),
    approvedByEmail: text('approved_by_email'),
    approvedAt: timestamp('approved_at'),
    currentRevision: integer('current_revision').default(1).notNull(),
    status: text('status').default('IN_PRODUCTION').notNull(), // BRIEFED | IN_PRODUCTION | CLIENT_REVIEW | APPROVED | LIVE | COMPLETED
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('idx_erp_mkt_status').on(t.status)]
);

// 65. Employees Directory (HR Module)
export const erpEmployees = pgTable(
  'erp_employees',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    departmentId: text('department_id').references(() => erpDepartments.id),
    roleId: text('role_id').references(() => erpRoles.id),
    employeeCode: text('employee_code').notNull().unique(),
    fullName: text('full_name').notNull(),
    email: text('email').notNull().unique(),
    phone: text('phone').notNull(),
    designation: text('designation').notNull(),
    employmentType: text('employment_type').default('FULL_TIME').notNull(), // FULL_TIME | PART_TIME | CONSULTANT
    joiningDate: text('joining_date').notNull(),
    monthlySalaryInr: integer('monthly_salary_inr').default(0).notNull(),
    leaveBalanceDays: integer('leave_balance_days').default(18).notNull(),
    reportingManagerEmail: text('reporting_manager_email'),
    locationCity: text('location_city').default('Mumbai').notNull(),
    status: text('status').default('ACTIVE').notNull(), // ACTIVE | ON_LEAVE | NOTICE | SEPARATED
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('idx_erp_emp_dept').on(t.departmentId)]
);

// 66. Interns & Mentorship Cohort Tracker
export const erpInterns = pgTable(
  'erp_interns',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    departmentId: text('department_id').references(() => erpDepartments.id),
    internCode: text('intern_code').notNull().unique(),
    fullName: text('full_name').notNull(),
    email: text('email').notNull().unique(),
    phone: text('phone').notNull(),
    university: text('university').notNull(),
    track: text('track').notNull(), // FORMULATION_RD | DIGITAL_MARKETING | SUPPLY_CHAIN | UI_UX | FINANCE_OPS
    departmentTrack: text('department_track').default('DIGITAL_MARKETING').notNull(), // SALES | DIGITAL_MARKETING | OPERATIONS | PROCUREMENT | PRODUCTION | HR | FINANCE
    mentorEmail: text('mentor_email').notNull(),
    startDate: text('start_date').notNull(),
    endDate: text('end_date').notNull(),
    stipendMonthlyInr: integer('stipend_monthly_inr').default(15000).notNull(),
    projectTitle: text('project_title').notNull(),
    evaluationScore: real('evaluation_score').default(4.5).notNull(),
    certificateIssued: boolean('certificate_issued').default(false).notNull(),
    certificateNumber: text('certificate_number'),
    certificateIssuedAt: timestamp('certificate_issued_at'),
    confidentialitySigned: boolean('confidentiality_signed').default(true).notNull(),
    canViewSensitiveFinancials: boolean('can_view_sensitive_financials').default(false).notNull(),
    canViewFormulations: boolean('can_view_formulations').default(false).notNull(),
    status: text('status').default('ACTIVE').notNull(), // ACTIVE | COMPLETED | EXTENDED | DROPPED
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('idx_erp_int_dept').on(t.departmentId)]
);

// 67. Cross-Department Tasks & Workflows
export const erpTasks = pgTable(
  'erp_tasks',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    departmentId: text('department_id').references(() => erpDepartments.id),
    taskNumber: text('task_number').notNull().unique(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    sourceModule: text('source_module').notNull(),
    linkedEntityType: text('linked_entity_type'),
    linkedEntityId: text('linked_entity_id'),
    priority: text('priority').default('MEDIUM').notNull(), // LOW | MEDIUM | HIGH | URGENT
    assignedToEmail: text('assigned_to_email').notNull(),
    createdByEmail: text('created_by_email').notNull(),
    dueDate: text('due_date'),
    reminderAt: text('reminder_at'),
    approvalStage: text('approval_stage').default('DRAFT').notNull(), // DRAFT | SUBMITTED | UNDER_REVIEW | CHANGES_REQUESTED | APPROVED | COMPLETED
    dependsOnTaskIds: jsonb('depends_on_task_ids'),
    checklists: jsonb('checklists'),
    activityLog: jsonb('activity_log'),
    approvedByEmail: text('approved_by_email'),
    completedAt: timestamp('completed_at'),
    status: text('status').default('TODO').notNull(), // TODO | IN_PROGRESS | IN_REVIEW | BLOCKED | DONE
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('idx_erp_tasks_status').on(t.status), index('idx_erp_tasks_assignee').on(t.assignedToEmail)]
);

// 68. Unified Approval Inbox (Multi-Department Governance)
export const erpApprovals = pgTable(
  'erp_approvals',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    departmentId: text('department_id').references(() => erpDepartments.id),
    approvalNumber: text('approval_number').notNull().unique(),
    moduleKey: text('module_key').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    amountInr: real('amount_inr').default(0).notNull(),
    requiredRoleCode: text('required_role_code').default('SUPER_ADMIN').notNull(),
    requestedByEmail: text('requested_by_email').notNull(),
    decidedByEmail: text('decided_by_email'),
    decisionNote: text('decision_note'),
    decidedAt: timestamp('decided_at'),
    status: text('status').default('PENDING').notNull(), // PENDING | APPROVED | REJECTED
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('idx_erp_apr_status').on(t.status)]
);

// 69. Document Attachments Ledger
export const erpAttachments = pgTable(
  'erp_attachments',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    entityType: text('entity_type').notNull(), // PURCHASE_ORDER | GRN | FORMULATION | BATCH | QC_RECORD | INVOICE | PROPOSAL | EMPLOYEE | TASK
    entityId: text('entity_id').notNull(),
    fileName: text('file_name').notNull(),
    documentType: text('document_type').default('GENERAL_DOCUMENT').notNull(),
    mimeType: text('mime_type').default('application/pdf').notNull(),
    fileSizeBytes: integer('file_size_bytes').default(0).notNull(),
    storageUrlOrData: text('storage_url_or_data').notNull(),
    notes: text('notes'),
    uploadedByEmail: text('uploaded_by_email').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('idx_erp_att_entity').on(t.entityType, t.entityId)]
);

// 70. Global Multi-Department Notifications
export const erpNotifications = pgTable(
  'erp_notifications',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    recipientEmail: text('recipient_email').default('ALL_ADMINS').notNull(),
    departmentCode: text('department_code'),
    severity: text('severity').default('INFO').notNull(), // INFO | WARNING | CRITICAL
    category: text('category').notNull(),
    title: text('title').notNull(),
    message: text('message').notNull(),
    linkModule: text('link_module'),
    linkEntityId: text('link_entity_id'),
    isRead: boolean('is_read').default(false).notNull(),
    readAt: timestamp('read_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('idx_erp_notif_read').on(t.isRead)]
);

// 71. Automated Sequential Document Numbering Ledger
export const erpSequences = pgTable('erp_sequences', {
  seqKey: text('seq_key').primaryKey(), // PO | GRN | LOT | FRM | BATCH | SMP | QC | FG | LEAD | PROP | QT | INV | CN | PAY | JRN | MKT | EMP | INT | TSK | APR | PR | RFQ | SQ | PINV | DN
  prefix: text('prefix').notNull(),
  currentValue: integer('current_value').default(1000).notNull(),
  padding: integer('padding').default(4).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 72. Purchase Requisitions (From Production Planning, Inventory Reorder & Operations)
export const erpPurchaseRequisitions = pgTable(
  'erp_purchase_requisitions',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    requisitionNumber: text('requisition_number').notNull().unique(),
    sourceDepartment: text('source_department').notNull(), // PRODUCTION | INVENTORY | RD | OPERATIONS
    linkedBatchId: text('linked_batch_id'),
    priority: text('priority').default('NORMAL').notNull(), // LOW | NORMAL | HIGH | URGENT
    requiredByDate: text('required_by_date').notNull(),
    items: jsonb('items').notNull(), // Array<{ materialId?, materialCode?, materialName, category, qty, unit, estimatedUnitCostInr }>
    estimatedTotalInr: real('estimated_total_inr').default(0).notNull(),
    requestedByEmail: text('requested_by_email').notNull(),
    approvedByEmail: text('approved_by_email'),
    approvalStatus: text('approval_status').default('APPROVED').notNull(), // PENDING_APPROVAL | APPROVED | REJECTED
    status: text('status').default('OPEN').notNull(), // OPEN | RFQ_SENT | PO_ISSUED | CLOSED | REJECTED
    notes: text('notes'),
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('idx_erp_pr_dept').on(t.sourceDepartment), index('idx_erp_pr_status').on(t.status)]
);

// 73. Requests for Quotation (RFQ)
export const erpRfqs = pgTable(
  'erp_rfqs',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    rfqNumber: text('rfq_number').notNull().unique(),
    requisitionId: text('requisition_id').references(() => erpPurchaseRequisitions.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    targetSupplierIds: jsonb('target_supplier_ids').notNull(), // string[]
    items: jsonb('items').notNull(), // Array<{ materialId?, materialCode?, materialName, category, qty, unit, targetUnitPriceInr? }>
    responseDeadline: text('response_deadline').notNull(),
    deliveryWarehouseId: text('delivery_warehouse_id').default('wh-mumbai-rm').notNull(),
    notes: text('notes'),
    createdByEmail: text('created_by_email').notNull(),
    awardedQuotationId: text('awarded_quotation_id'),
    awardedPoId: text('awarded_po_id'),
    status: text('status').default('OPEN').notNull(), // OPEN | QUOTED | AWARDED | CLOSED
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('idx_erp_rfq_req').on(t.requisitionId), index('idx_erp_rfq_status').on(t.status)]
);

// 74. Supplier Quotations (Multi-Vendor Quotes per RFQ for Comparative Statements)
export const erpSupplierQuotations = pgTable(
  'erp_supplier_quotations',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    rfqId: text('rfq_id')
      .notNull()
      .references(() => erpRfqs.id, { onDelete: 'cascade' }),
    supplierId: text('supplier_id')
      .notNull()
      .references(() => procurementSuppliers.id, { onDelete: 'cascade' }),
    supplierName: text('supplier_name').notNull(),
    quotationNumber: text('quotation_number').notNull().unique(),
    vendorRefNumber: text('vendor_ref_number'),
    quoteDate: text('quote_date').notNull(),
    validUntil: text('valid_until').notNull(),
    items: jsonb('items').notNull(), // Array<{ materialId?, materialName, category, qty, unit, unitPriceInr, taxPct, lineTaxInr, lineTotalInr }>
    subtotalInr: real('subtotal_inr').default(0).notNull(),
    taxInr: real('tax_inr').default(0).notNull(),
    freightInr: real('freight_inr').default(0).notNull(),
    totalLandedCostInr: real('total_landed_cost_inr').default(0).notNull(),
    deliveryDays: integer('delivery_days').default(14).notNull(),
    paymentTerms: text('payment_terms').default('NET_30').notNull(),
    notes: text('notes'),
    isSelectedWinner: boolean('is_selected_winner').default(false).notNull(),
    status: text('status').default('SUBMITTED').notNull(), // SUBMITTED | SHORTLISTED | AWARDED | REJECTED
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('idx_erp_sq_rfq').on(t.rfqId), index('idx_erp_sq_supp').on(t.supplierId)]
);

// 75. Supplier Vendor Invoices (PO-Matched & Non-PO, Duplicate Detection, Attachments, Single AP Posting)
export const erpVendorInvoices = pgTable(
  'erp_vendor_invoices',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    voucherNumber: text('voucher_number').notNull().unique(),
    supplierId: text('supplier_id')
      .notNull()
      .references(() => procurementSuppliers.id),
    supplierName: text('supplier_name').notNull(),
    supplierGstin: text('supplier_gstin'),
    supplierInvoiceNumber: text('supplier_invoice_number').notNull(),
    invoiceDate: text('invoice_date').notNull(),
    dueDate: text('due_date').notNull(),
    purchaseOrderId: text('purchase_order_id').references(() => supplierPurchaseOrders.id, { onDelete: 'set null' }),
    grnIds: jsonb('grn_ids').notNull(), // string[]
    isNonPo: boolean('is_non_po').default(false).notNull(),
    nonPoReason: text('non_po_reason'),
    expenseCategory: text('expense_category').default('RAW_MATERIAL_PURCHASE').notNull(),
    items: jsonb('items').notNull(),
    subtotalInr: real('subtotal_inr').default(0).notNull(),
    cgstInr: real('cgst_inr').default(0).notNull(),
    sgstInr: real('sgst_inr').default(0).notNull(),
    igstInr: real('igst_inr').default(0).notNull(),
    freightInr: real('freight_inr').default(0).notNull(),
    totalAmountInr: real('total_amount_inr').default(0).notNull(),
    paidAmountInr: real('paid_amount_inr').default(0).notNull(),
    debitNoteAmountInr: real('debit_note_amount_inr').default(0).notNull(),
    balanceDueInr: real('balance_due_inr').default(0).notNull(),
    attachmentName: text('attachment_name'),
    attachmentUrlOrData: text('attachment_url_or_data'),
    approvalStatus: text('approval_status').default('APPROVED').notNull(), // PENDING_APPROVAL | APPROVED | REJECTED
    approvedByEmail: text('approved_by_email'),
    journalId: text('journal_id'),
    journalPosted: boolean('journal_posted').default(false).notNull(),
    paymentStatus: text('payment_status').default('UNPAID').notNull(), // UNPAID | PARTIAL | PAID
    idempotencyKey: text('idempotency_key').unique(),
    status: text('status').default('POSTED').notNull(), // PENDING_APPROVAL | POSTED | PAID | CANCELLED
    createdByEmail: text('created_by_email').notNull(),
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('idx_erp_vinv_supp').on(t.supplierId),
    index('idx_erp_vinv_po').on(t.purchaseOrderId),
    index('idx_erp_vinv_dup').on(t.supplierId, t.supplierInvoiceNumber)
  ]
);

// 76. Supplier Debit Notes & Purchase Returns
export const erpDebitNotes = pgTable(
  'erp_debit_notes',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    debitNoteNumber: text('debit_note_number').notNull().unique(),
    supplierId: text('supplier_id')
      .notNull()
      .references(() => procurementSuppliers.id),
    supplierName: text('supplier_name').notNull(),
    purchaseOrderId: text('purchase_order_id').references(() => supplierPurchaseOrders.id, { onDelete: 'set null' }),
    grnId: text('grn_id').references(() => erpGoodsReceipts.id, { onDelete: 'set null' }),
    vendorInvoiceId: text('vendor_invoice_id').references(() => erpVendorInvoices.id, { onDelete: 'set null' }),
    issueDate: text('issue_date').notNull(),
    returnType: text('return_type').default('QC_REJECTION').notNull(), // QC_REJECTION | DAMAGED_GOODS | RATE_DIFFERENCE | SHORT_SUPPLY
    reason: text('reason').notNull(),
    items: jsonb('items').notNull(), // Array<{ materialId?, materialName, returnQty, unit, unitPriceInr, lineTotalInr }>
    taxableAmountInr: real('taxable_amount_inr').default(0).notNull(),
    cgstInr: real('cgst_inr').default(0).notNull(),
    sgstInr: real('sgst_inr').default(0).notNull(),
    igstInr: real('igst_inr').default(0).notNull(),
    totalDebitInr: real('total_debit_inr').default(0).notNull(),
    journalId: text('journal_id'),
    createdByEmail: text('created_by_email').notNull(),
    idempotencyKey: text('idempotency_key').unique(),
    status: text('status').default('APPLIED').notNull(), // POSTED | APPLIED | VOID
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('idx_erp_dn_supp').on(t.supplierId), index('idx_erp_dn_vinv').on(t.vendorInvoiceId)]
);

// 77. Immutable Stock Movement Ledger (Strict Audit Trail — Never Overwrite Available Stock Directly)
export const erpStockMovements = pgTable(
  'erp_stock_movements',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    movementNumber: text('movement_number').notNull().unique(),
    movementDate: text('movement_date').notNull(),
    stockCategory: text('stock_category').notNull(), // RAW_MATERIAL | FRAGRANCE_OIL | PACKAGING | WIP | FINISHED_GOODS | SAMPLE | DAMAGED
    movementType: text('movement_type').notNull(), // OPENING | RECEIPT | RESERVATION | RELEASE_RESERVATION | ISSUE_TO_BATCH | WIP_TRANSFER | FILLING_OUTPUT | PACKING_CONSUMPTION | FG_RELEASE | SAMPLE_ISSUE | DAMAGE_WRITEOFF | REWORK | RETURN | ADJUSTMENT
    materialId: text('material_id').references(() => erpMaterials.id, { onDelete: 'set null' }),
    materialCode: text('material_code'),
    materialName: text('material_name').notNull(),
    lotId: text('lot_id').references(() => erpStockLots.id, { onDelete: 'set null' }),
    lotNumber: text('lot_number'),
    finishedGoodId: text('finished_good_id'),
    sku: text('sku'),
    batchId: text('batch_id'),
    batchNumber: text('batch_number'),
    warehouseId: text('warehouse_id').references(() => erpWarehouses.id, { onDelete: 'set null' }),
    warehouseLocation: text('warehouse_location'),
    qtyDelta: real('qty_delta').notNull(),
    uom: text('uom').notNull(),
    balanceBefore: real('balance_before').notNull(),
    balanceAfter: real('balance_after').notNull(),
    unitCostInr: real('unit_cost_inr').default(0).notNull(),
    totalCostInr: real('total_cost_inr').default(0).notNull(),
    densityUsedGPerMl: real('density_used_g_per_ml'),
    referenceType: text('reference_type').notNull(), // MATERIAL | GRN | BATCH | QC_RECORD | FINISHED_GOOD | SAMPLE | DEBIT_NOTE | MANUAL_LEDGER
    referenceId: text('reference_id').notNull(),
    reason: text('reason').notNull(),
    performedByEmail: text('performed_by_email').notNull(),
    idempotencyKey: text('idempotency_key').unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('idx_erp_mov_mat').on(t.materialId),
    index('idx_erp_mov_lot').on(t.lotId),
    index('idx_erp_mov_batch').on(t.batchId),
    index('idx_erp_mov_cat').on(t.stockCategory)
  ]
);

// 78. Production Batch Stage Transitions & Sign-Off History
export const erpBatchEvents = pgTable(
  'erp_batch_events',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    batchId: text('batch_id')
      .notNull()
      .references(() => productionBatches.id, { onDelete: 'cascade' }),
    batchNumber: text('batch_number').notNull(),
    fromStage: text('from_stage'),
    toStage: text('to_stage').notNull(),
    eventType: text('event_type').notNull(), // STAGE_TRANSITION | WEIGHING | REWORK | QC_GATE | COST_ALLOCATION | RELEASE | ONCE_CLOSURE
    summary: text('summary').notNull(),
    payload: jsonb('payload'),
    performedByEmail: text('performed_by_email').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('idx_erp_bev_batch').on(t.batchId)]
);

// 79. The Once Collection (One-Time Limited-Edition 100–1,000 Bottle Campaigns — Permanent Closure Lock)
export const erpOnceEditions = pgTable(
  'erp_once_editions',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    editionCode: text('edition_code').notNull().unique(),
    editionName: text('edition_name').notNull(),
    fragranceName: text('fragrance_name').notNull(),
    formulationId: text('formulation_id')
      .notNull()
      .references(() => erpFormulations.id),
    lockedFormulationVersionId: text('locked_formulation_version_id')
      .notNull()
      .references(() => erpFormulationVersions.id),
    lockedFormulationVersionNumber: integer('locked_formulation_version_number').notNull(),
    productId: text('product_id'),
    sku: text('sku'),
    bottleSizeMl: real('bottle_size_ml').default(50).notNull(),
    declaredQuantity: integer('declared_quantity').notNull(), // Enforced 100 <= declaredQuantity <= 1000
    producedQuantity: integer('produced_quantity').default(0).notNull(),
    campaignBatchId: text('campaign_batch_id').unique(), // Strictly ONE authorized production campaign per edition
    campaignBatchNumber: text('campaign_batch_number'),
    status: text('status').default('PLANNED').notNull(), // PLANNED | CAMPAIGN_ACTIVE | PERMANENTLY_CLOSED
    authorizedByEmail: text('authorized_by_email').notNull(),
    authorizedAt: timestamp('authorized_at').defaultNow().notNull(),
    closedAt: timestamp('closed_at'),
    closedByEmail: text('closed_by_email'),
    closureCertificateHash: text('closure_certificate_hash'),
    notes: text('notes'),
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('idx_erp_once_status').on(t.status)]
);

// 80. The Once Collection — Unique Bottle Serial Registry
export const erpOnceSerialNumbers = pgTable(
  'erp_once_serial_numbers',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    editionId: text('edition_id')
      .notNull()
      .references(() => erpOnceEditions.id, { onDelete: 'cascade' }),
    batchId: text('batch_id')
      .notNull()
      .references(() => productionBatches.id, { onDelete: 'cascade' }),
    serialNumber: text('serial_number').notNull().unique(),
    editionIndex: integer('edition_index').notNull(), // 1 .. declaredQuantity
    bottleSizeMl: real('bottle_size_ml').notNull(),
    qcStatus: text('qc_status').default('PENDING').notNull(), // PENDING | PASSED | REJECTED
    status: text('status').default('GENERATED').notNull(), // GENERATED | FILLED | QC_PASSED | PACKED | RELEASED | DESTROYED_REJECTED
    orderId: text('order_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('idx_erp_once_ser_ed').on(t.editionId), index('idx_erp_once_ser_batch').on(t.batchId)]
);

// 81. Configurable Quality Control Checklists & Acceptance Criteria
export const erpQcChecklists = pgTable(
  'erp_qc_checklists',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    checklistCode: text('checklist_code').notNull().unique(),
    name: text('name').notNull(),
    inspectionType: text('inspection_type').notNull(), // RAW_MATERIAL_INWARD | IN_PROCESS_MACERATION | SAMPLE_EVALUATION | FINISHED_BATCH_RELEASE | STABILITY_AUDIT
    criteria: jsonb('criteria').notNull(), // Array<{ criterionId, parameter, testMethod, acceptanceMin?, acceptanceMax?, expectedSpec, unit?, isCritical }>
    isActive: boolean('is_active').default(true).notNull(),
    createdByEmail: text('created_by_email').notNull(),
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('idx_erp_qchk_type').on(t.inspectionType)]
);

// 82. Immutable Sampling R&D Workflow & Distribution Event Ledger
export const erpSampleEvents = pgTable(
  'erp_sample_events',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    sampleId: text('sample_id')
      .notNull()
      .references(() => erpSamples.id, { onDelete: 'cascade' }),
    sampleNumber: text('sample_number').notNull(),
    fromStage: text('from_stage'),
    toStage: text('to_stage').notNull(),
    eventType: text('event_type').notNull(), // STAGE_TRANSITION | MATERIAL_ISSUE | QC_TEST | FEEDBACK | DISPATCH | REVISION | CONVERSION
    summary: text('summary').notNull(),
    payload: jsonb('payload'),
    performedByEmail: text('performed_by_email').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('idx_erp_smpev_sample').on(t.sampleId)]
);

// 83. Permission-Controlled Pricing Override & Negotiation Audit Log
export const erpPricingAuditLogs = pgTable(
  'erp_pricing_audit_logs',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    entityType: text('entity_type').notNull(), // PROPOSAL | QUOTATION
    entityId: text('entity_id').notNull(),
    entityNumber: text('entity_number').notNull(),
    sku: text('sku'),
    itemDescription: text('item_description').notNull(),
    catalogueUnitPriceInr: real('catalogue_unit_price_inr').default(0).notNull(),
    previousUnitPriceInr: real('previous_unit_price_inr').default(0).notNull(),
    newUnitPriceInr: real('new_unit_price_inr').default(0).notNull(),
    discountPct: real('discount_pct').default(0).notNull(),
    reason: text('reason').notNull(),
    approvalRequired: boolean('approval_required').default(false).notNull(),
    approvalStatus: text('approval_status').default('APPROVED').notNull(), // PENDING_APPROVAL | APPROVED | REJECTED
    approvedByEmail: text('approved_by_email'),
    changedByEmail: text('changed_by_email').notNull(),
    changedByRole: text('changed_by_role').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('idx_erp_paudit_entity').on(t.entityType, t.entityId)]
);

// 84. CRM & Commercial Deal Lifecycle Activity Timeline
export const erpDealActivities = pgTable(
  'erp_deal_activities',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    leadId: text('lead_id'),
    proposalId: text('proposal_id'),
    quotationId: text('quotation_id'),
    orderId: text('order_id'),
    invoiceId: text('invoice_id'),
    stage: text('stage').notNull(),
    activityType: text('activity_type').notNull(), // LEAD_CAPTURE | CONTACT_LOG | FOLLOW_UP_TASK | PROPOSAL_VERSION | APPROVAL_DECISION | NEGOTIATION | ACCEPTANCE | SALES_ORDER | INVOICE | PAYMENT | FULFILMENT
    summary: text('summary').notNull(),
    payload: jsonb('payload'),
    performedByEmail: text('performed_by_email').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('idx_erp_deal_lead').on(t.leadId),
    index('idx_erp_deal_prop').on(t.proposalId),
    index('idx_erp_deal_qt').on(t.quotationId)
  ]
);

// 85. Master Chart of Accounts (Double-Entry Ledger Architecture)
export const erpChartOfAccounts = pgTable(
  'erp_chart_of_accounts',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    accountCode: text('account_code').notNull().unique(),
    accountName: text('account_name').notNull(),
    accountType: text('account_type').notNull(), // ASSET | LIABILITY | EQUITY | REVENUE | EXPENSE
    subGroup: text('sub_group').notNull(), // CASH | BANK | PETTY_CASH | AR | AP | INVENTORY | GST_INPUT | GST_OUTPUT | COGS | OPERATING_EXPENSE | EQUITY | REVENUE
    normalBalance: text('normal_balance').notNull(), // DEBIT | CREDIT
    description: text('description'),
    isSystemAccount: boolean('is_system_account').default(true).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdByEmail: text('created_by_email').default('finance@fragmore.shop').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('idx_erp_coa_type').on(t.accountType)]
);

// 86. Administrator-Approved & Accountant-Verified HSN / SAC & GST Tax Master
export const erpHsnSacMaster = pgTable(
  'erp_hsn_sac_master',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    hsnSacCode: text('hsn_sac_code').notNull().unique(),
    codeType: text('code_type').default('HSN').notNull(), // HSN | SAC
    description: text('description').notNull(),
    gstRatePct: real('gst_rate_pct').notNull(),
    cgstRatePct: real('cgst_rate_pct').notNull(),
    sgstRatePct: real('sgst_rate_pct').notNull(),
    igstRatePct: real('igst_rate_pct').notNull(),
    cessRatePct: real('cess_rate_pct').default(0).notNull(),
    approvalStatus: text('approval_status').default('PENDING_ADMIN_APPROVAL').notNull(), // PENDING_ADMIN_APPROVAL | ADMIN_APPROVED | ACCOUNTANT_VERIFIED
    adminApprovedByEmail: text('admin_approved_by_email'),
    adminApprovedAt: timestamp('admin_approved_at'),
    accountantVerifiedByEmail: text('accountant_verified_by_email'),
    accountantVerifiedAt: timestamp('accountant_verified_at'),
    notes: text('notes'),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('idx_erp_hsn_status').on(t.approvalStatus)]
);

// 87. Delivery Challans (Stock Transfer, Events, Approvals, Sample Dispatch, Pre-Invoice Logistics)
export const erpDeliveryChallans = pgTable(
  'erp_delivery_challans',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    challanNumber: text('challan_number').notNull().unique(),
    challanType: text('challan_type').default('SUPPLY_OF_GOODS').notNull(), // SUPPLY_OF_GOODS | EVENT_ACTIVATION | SAMPLE_DISPATCH | APPROVAL_BASIS | STOCK_TRANSFER | JOB_WORK
    orderId: text('order_id'),
    customerName: text('customer_name').notNull(),
    customerEmail: text('customer_email'),
    customerGstin: text('customer_gstin'),
    deliveryAddress: text('delivery_address').notNull(),
    placeOfSupplyState: text('place_of_supply_state').default('Maharashtra').notNull(),
    dispatchDate: text('dispatch_date').notNull(),
    items: jsonb('items').notNull(), // Array<{ sku, description, hsnCode, qty, unitValueInr, totalValueInr }>
    totalTaxableValueInr: real('total_taxable_value_inr').default(0).notNull(),
    transporterName: text('transporter_name'),
    vehicleNumber: text('vehicle_number'),
    eWayBillNumber: text('e_way_bill_number'),
    convertedInvoiceId: text('converted_invoice_id'),
    notes: text('notes'),
    createdByEmail: text('created_by_email').notNull(),
    status: text('status').default('DISPATCHED').notNull(), // DRAFT | DISPATCHED | DELIVERED | CONVERTED_TO_INVOICE | RETURNED
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('idx_erp_dc_status').on(t.status)]
);

// 88. Sales Returns & Inventory Restock / Credit Note Linkage
export const erpSalesReturns = pgTable(
  'erp_sales_returns',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    returnNumber: text('return_number').notNull().unique(),
    invoiceId: text('invoice_id')
      .notNull()
      .references(() => erpInvoices.id),
    orderId: text('order_id'),
    customerName: text('customer_name').notNull(),
    customerEmail: text('customer_email').notNull(),
    returnDate: text('return_date').notNull(),
    restockCondition: text('restock_condition').default('SELLABLE_RESTOCK').notNull(), // SELLABLE_RESTOCK | DAMAGED_SCRAP
    reason: text('reason').notNull(),
    items: jsonb('items').notNull(), // Array<{ sku?, description, hsnCode, qty, unitPriceInr, gstRatePct, taxableInr, taxInr, totalInr }>
    taxableAmountInr: real('taxable_amount_inr').default(0).notNull(),
    cgstInr: real('cgst_inr').default(0).notNull(),
    sgstInr: real('sgst_inr').default(0).notNull(),
    igstInr: real('igst_inr').default(0).notNull(),
    totalReturnInr: real('total_return_inr').default(0).notNull(),
    cogsReversedInr: real('cogs_reversed_inr').default(0).notNull(),
    creditNoteId: text('credit_note_id'),
    journalId: text('journal_id'),
    createdByEmail: text('created_by_email').notNull(),
    status: text('status').default('PROCESSED').notNull(), // PENDING | PROCESSED | CREDITED
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('idx_erp_sret_inv').on(t.invoiceId)]
);

// 89. Sales / Customer Debit Notes (Post-Invoice Price Uplift, Freight Recovery & Tax Adjustments)
export const erpSalesDebitNotes = pgTable(
  'erp_sales_debit_notes',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    debitNoteNumber: text('debit_note_number').notNull().unique(),
    invoiceId: text('invoice_id')
      .notNull()
      .references(() => erpInvoices.id),
    issueDate: text('issue_date').notNull(),
    customerName: text('customer_name').notNull(),
    customerEmail: text('customer_email').notNull(),
    customerGstin: text('customer_gstin'),
    placeOfSupplyState: text('place_of_supply_state').default('Maharashtra').notNull(),
    isInterState: boolean('is_inter_state').default(false).notNull(),
    reason: text('reason').notNull(),
    gstRatePct: integer('gst_rate_pct').default(18).notNull(),
    taxableAmountInr: real('taxable_amount_inr').notNull(),
    cgstInr: real('cgst_inr').default(0).notNull(),
    sgstInr: real('sgst_inr').default(0).notNull(),
    igstInr: real('igst_inr').default(0).notNull(),
    totalDebitInr: real('total_debit_inr').notNull(),
    journalId: text('journal_id'),
    createdByEmail: text('created_by_email').notNull(),
    status: text('status').default('APPLIED').notNull(), // APPLIED | VOID
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('idx_erp_sdn_inv').on(t.invoiceId)]
);

// 90. Operating Expenses & Petty Cash Vouchers
export const erpExpensesAndPettyCash = pgTable(
  'erp_expenses_and_petty_cash',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    voucherNumber: text('voucher_number').notNull().unique(),
    voucherType: text('voucher_type').default('OPERATING_EXPENSE').notNull(), // OPERATING_EXPENSE | PETTY_CASH_EXPENSE | PETTY_CASH_REPLENISHMENT
    expenseDate: text('expense_date').notNull(),
    category: text('category').notNull(),
    expenseAccountCode: text('expense_account_code').default('5100').notNull(),
    paymentAccountCode: text('payment_account_code').default('1010').notNull(), // 1010 Bank | 1020 Cash | 1030 Petty Cash
    payeeName: text('payee_name').notNull(),
    vendorGstin: text('vendor_gstin'),
    placeOfSupplyState: text('place_of_supply_state').default('Maharashtra').notNull(),
    isInterState: boolean('is_inter_state').default(false).notNull(),
    description: text('description').notNull(),
    taxableAmountInr: real('taxable_amount_inr').notNull(),
    gstRatePct: real('gst_rate_pct').default(0).notNull(),
    cgstInr: real('cgst_inr').default(0).notNull(),
    sgstInr: real('sgst_inr').default(0).notNull(),
    igstInr: real('igst_inr').default(0).notNull(),
    totalAmountInr: real('total_amount_inr').notNull(),
    receiptRef: text('receipt_ref'),
    approvalStatus: text('approval_status').default('APPROVED').notNull(), // PENDING_APPROVAL | APPROVED | REJECTED
    approvedByEmail: text('approved_by_email'),
    journalId: text('journal_id'),
    createdByEmail: text('created_by_email').notNull(),
    status: text('status').default('POSTED').notNull(), // PENDING_APPROVAL | POSTED | REJECTED
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('idx_erp_exp_type').on(t.voucherType), index('idx_erp_exp_date').on(t.expenseDate)]
);

// 91. Bank Statement Lines & Reconciliation Matching Ledger
export const erpBankStatements = pgTable(
  'erp_bank_statements',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    statementNumber: text('statement_number').notNull(),
    statementDate: text('statement_date').notNull(),
    bankAccountCode: text('bank_account_code').default('1010').notNull(),
    referenceNumber: text('reference_number').notNull(),
    description: text('description').notNull(),
    withdrawalInr: real('withdrawal_inr').default(0).notNull(),
    depositInr: real('deposit_inr').default(0).notNull(),
    closingBalanceInr: real('closing_balance_inr').default(0).notNull(),
    matchStatus: text('match_status').default('UNMATCHED').notNull(), // UNMATCHED | MATCHED_AUTO | MATCHED_MANUAL | BANK_CHARGE_POSTED
    matchedPaymentId: text('matched_payment_id'),
    matchedJournalId: text('matched_journal_id'),
    reconciledByEmail: text('reconciled_by_email'),
    reconciledAt: timestamp('reconciled_at'),
    createdByEmail: text('created_by_email').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('idx_erp_bnk_match').on(t.matchStatus), index('idx_erp_bnk_date').on(t.statementDate)]
);

// 92. Accountant Acceptance & Reconciliation Verification Sign-Off Ledger
export const erpAccountantSignoffs = pgTable(
  'erp_accountant_signoffs',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    runNumber: text('run_number').notNull().unique(),
    runDate: text('run_date').notNull(),
    executedByEmail: text('executed_by_email').notNull(),
    accountantEmail: text('accountant_email'),
    checksPassedCount: integer('checks_passed_count').default(0).notNull(),
    checksTotalCount: integer('checks_total_count').default(0).notNull(),
    allAutomatedPassed: boolean('all_automated_passed').default(false).notNull(),
    checkResults: jsonb('check_results').notNull(), // Array<{ code, title, passed, expectedValue, actualValue, variance, details }>
    decision: text('decision').default('PENDING_REVIEW').notNull(), // PENDING_REVIEW | ACCEPTED_PRODUCTION_READY | REJECTED_NEEDS_CORRECTION
    notes: text('notes'),
    decidedAt: timestamp('decided_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('idx_erp_acc_signoff_dec').on(t.decision)]
);

// 93. Marketing Agency Organization Profile
export const erpAgencyProfiles = pgTable('erp_agency_profiles', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
  agencyName: text('agency_name').notNull(),
  legalName: text('legal_name').notNull(),
  primaryContactName: text('primary_contact_name').notNull(),
  primaryContactEmail: text('primary_contact_email').notNull(),
  specialization: text('specialization').notNull(),
  websiteUrl: text('website_url'),
  gstin: text('gstin'),
  monthlyRetainerInr: integer('monthly_retainer_inr').default(85000).notNull(),
  billingCycleDay: integer('billing_cycle_day').default(5).notNull(),
  ndaSigned: boolean('nda_signed').default(true).notNull(),
  luxuryPhilosophyPledge: text('luxury_philosophy_pledge').notNull(),
  contractStartDate: text('contract_start_date').notNull(),
  contractEndDate: text('contract_end_date'),
  status: text('status').default('ACTIVE').notNull(),
  version: integer('version').default(1).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 94. Marketing Agency Staff Accounts
export const erpAgencyStaff = pgTable('erp_agency_staff', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
  agencyId: text('agency_id')
    .notNull()
    .references(() => erpAgencyProfiles.id, { onDelete: 'cascade' }),
  staffCode: text('staff_code').notNull().unique(),
  fullName: text('full_name').notNull(),
  email: text('email').notNull().unique(),
  roleTitle: text('role_title').notNull(),
  specialty: text('specialty').notNull(),
  accessLevel: text('access_level').default('CREATOR').notNull(), // STRATEGIST | CREATOR | PERFORMANCE_ANALYST | ACCOUNT_LEAD
  assignedChannels: jsonb('assigned_channels'),
  status: text('status').default('ACTIVE').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 95. Creative Revision & Approval History
export const erpCreativeRevisions = pgTable(
  'erp_creative_revisions',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    assetId: text('asset_id')
      .notNull()
      .references(() => erpMarketingWorkspace.id, { onDelete: 'cascade' }),
    revisionNumber: integer('revision_number').default(1).notNull(),
    adScript: text('ad_script'),
    captionCopy: text('caption_copy'),
    deliverableUrl: text('deliverable_url'),
    storytellingAngle: text('storytelling_angle'),
    changeSummary: text('change_summary').notNull(),
    approvalStage: text('approval_stage').notNull(),
    reviewerEmail: text('reviewer_email'),
    reviewerNotes: text('reviewer_notes'),
    submittedByEmail: text('submitted_by_email').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('idx_erp_crev_asset').on(t.assetId)]
);

// 96. Agency Invoices & Payment Status
export const erpAgencyInvoices = pgTable(
  'erp_agency_invoices',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    agencyId: text('agency_id')
      .notNull()
      .references(() => erpAgencyProfiles.id, { onDelete: 'cascade' }),
    invoiceNumber: text('invoice_number').notNull().unique(),
    billingMonth: text('billing_month').notNull(),
    invoiceDate: text('invoice_date').notNull(),
    dueDate: text('due_date').notNull(),
    description: text('description').notNull(),
    retainerInr: real('retainer_inr').default(0).notNull(),
    productionExtrasInr: real('production_extras_inr').default(0).notNull(),
    gstAmountInr: real('gst_amount_inr').default(0).notNull(),
    totalAmountInr: real('total_amount_inr').default(0).notNull(),
    paidAmountInr: real('paid_amount_inr').default(0).notNull(),
    paymentReference: text('payment_reference'),
    paymentDate: text('payment_date'),
    status: text('status').default('SUBMITTED').notNull(), // DRAFT | SUBMITTED | APPROVED | PAID
    approvedByEmail: text('approved_by_email'),
    notes: text('notes'),
    createdByEmail: text('created_by_email').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('idx_erp_aginv_status').on(t.status)]
);

// 97. Intern Attendance Ledger
export const erpInternAttendance = pgTable(
  'erp_intern_attendance',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    internId: text('intern_id')
      .notNull()
      .references(() => erpInterns.id, { onDelete: 'cascade' }),
    attendanceDate: text('attendance_date').notNull(),
    workMode: text('work_mode').default('ATELIER_ONSITE').notNull(), // ATELIER_ONSITE | LAB | REMOTE | FIELD_EVENT
    checkInTime: text('check_in_time').notNull(),
    checkOutTime: text('check_out_time'),
    hoursLogged: real('hours_logged').default(8).notNull(),
    status: text('status').default('PRESENT').notNull(), // PRESENT | HALF_DAY | LEAVE | ABSENT
    notes: text('notes'),
    verifiedByEmail: text('verified_by_email'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('idx_erp_int_att_date').on(t.internId, t.attendanceDate)]
);

// 98. Intern Work Submissions & Approval Requests
export const erpInternSubmissions = pgTable(
  'erp_intern_submissions',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    internId: text('intern_id')
      .notNull()
      .references(() => erpInterns.id, { onDelete: 'cascade' }),
    taskId: text('task_id'),
    submissionNumber: text('submission_number').notNull().unique(),
    departmentTrack: text('department_track').notNull(),
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    deliverableUrl: text('deliverable_url'),
    attachmentIds: jsonb('attachment_ids'),
    approvalStage: text('approval_stage').default('SUBMITTED').notNull(), // DRAFT | SUBMITTED | UNDER_REVIEW | CHANGES_REQUESTED | APPROVED | COMPLETED
    reviewerEmail: text('reviewer_email'),
    reviewerFeedback: text('reviewer_feedback'),
    submittedByEmail: text('submitted_by_email').notNull(),
    approvedAt: timestamp('approved_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('idx_erp_int_sub_intern').on(t.internId)]
);

// 99. Intern Evaluations & Feedback Ledger
export const erpInternEvaluations = pgTable(
  'erp_intern_evaluations',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    internId: text('intern_id')
      .notNull()
      .references(() => erpInterns.id, { onDelete: 'cascade' }),
    evaluationNumber: text('evaluation_number').notNull().unique(),
    evaluationDate: text('evaluation_date').notNull(),
    evaluatorEmail: text('evaluator_email').notNull(),
    executionScore: real('execution_score').default(4.5).notNull(),
    storytellingCraftScore: real('storytelling_craft_score').default(4.5).notNull(),
    reliabilityScore: real('reliability_score').default(4.5).notNull(),
    overallRating: real('overall_rating').default(4.5).notNull(),
    strengths: text('strengths').notNull(),
    growthAreas: text('growth_areas'),
    recommendation: text('recommendation').default('ENDORSE_FOR_CERTIFICATE').notNull(),
    certificateEligible: boolean('certificate_eligible').default(true).notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('idx_erp_int_eval_intern').on(t.internId)]
);

// 100. Collaborative Task Comments
export const erpTaskComments = pgTable(
  'erp_task_comments',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    taskId: text('task_id')
      .notNull()
      .references(() => erpTasks.id, { onDelete: 'cascade' }),
    authorEmail: text('author_email').notNull(),
    authorRole: text('author_role').notNull(),
    commentText: text('comment_text').notNull(),
    attachmentUrl: text('attachment_url'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('idx_erp_tsk_cmt_task').on(t.taskId)]
);

// 101. Centralized Reporting & Document Export Engine Jobs & Audit Ledger
export const erpExportJobs = pgTable(
  'erp_export_jobs',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    jobNumber: text('job_number').notNull().unique(),
    reportKey: text('report_key').notNull(),
    reportTitle: text('report_title').notNull(),
    moduleKey: text('module_key').notNull(),
    format: text('format').notNull(), // XLSX | PDF
    executionMode: text('execution_mode').default('SYNC').notNull(), // SYNC | ASYNC_JOB
    filters: jsonb('filters').notNull(),
    rowCount: integer('row_count').default(0).notNull(),
    fileName: text('file_name'),
    mimeType: text('mime_type'),
    fileSizeBytes: integer('file_size_bytes').default(0).notNull(),
    storagePath: text('storage_path'),
    downloadTokenHash: text('download_token_hash'),
    expiresAt: timestamp('expires_at'),
    downloadCount: integer('download_count').default(0).notNull(),
    status: text('status').default('QUEUED').notNull(), // QUEUED | PROCESSING | COMPLETED | FAILED | EXPIRED
    errorMessage: text('error_message'),
    retryCount: integer('retry_count').default(0).notNull(),
      requestedByEmail: text('requested_by_email').notNull(),
      requestedByRole: text('requested_by_role').notNull(),
      createdAt: timestamp('created_at').defaultNow().notNull(),
      completedAt: timestamp('completed_at'),
    },
    (t) => [index('idx_erp_expjob_status').on(t.status), index('idx_erp_expjob_user').on(t.requestedByEmail)]
  );

// 102. Configurable ERP Operations Alert Rules (10 Automated Alert Categories)
export const erpAlertRules = pgTable(
  'erp_alert_rules',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    ruleKey: text('rule_key').notNull().unique(), // LOW_STOCK | EXPIRING_MATERIALS | PENDING_QC | DELAYED_PROCUREMENT | OVERDUE_INVOICES | PRODUCTION_DELAYS | SAMPLE_FOLLOWUPS | PENDING_PROPOSALS | CAMPAIGN_DEADLINES | INTERN_TASK_DEADLINES
    title: text('title').notNull(),
    category: text('category').notNull(),
    moduleKey: text('module_key').notNull(),
    thresholdDays: integer('threshold_days').default(7).notNull(),
    thresholdValue: real('threshold_value').default(0).notNull(),
    severity: text('severity').default('HIGH').notNull(), // CRITICAL | HIGH | MEDIUM | INFO
    isEnabled: boolean('is_enabled').default(true).notNull(),
    autoNotify: boolean('auto_notify').default(true).notNull(),
    updatedByEmail: text('updated_by_email').default('system@fragmore.shop').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('idx_erp_alertrule_mod').on(t.moduleKey)]
);

// 103. AI Business Assistant Explicit Action Confirmation Gate Ledger
export const erpAiActionConfirmations = pgTable(
  'erp_ai_action_confirmations',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => erpOrganizations.id, { onDelete: 'cascade' }),
    confirmationCode: text('confirmation_code').notNull().unique(),
    actionType: text('action_type').notNull(), // STOCK_ADJUSTMENT | PO_APPROVAL | INVOICE_ISSUANCE | PAYMENT_POSTING | ACCOUNTING_JOURNAL | CUSTOMER_COMMUNICATION
    actionTitle: text('action_title').notNull(),
    actionSummary: text('action_summary').notNull(),
    requiredModule: text('required_module').notNull(),
    requiredAction: text('required_action').default('approve').notNull(),
    payload: jsonb('payload').notNull(),
    sourceRecords: jsonb('source_records'),
    requestedByEmail: text('requested_by_email').notNull(),
    requestedByRole: text('requested_by_role').notNull(),
    status: text('status').default('PENDING_CONFIRMATION').notNull(), // PENDING_CONFIRMATION | EXECUTED | CANCELLED
    decidedByEmail: text('decided_by_email'),
    decidedByRole: text('decided_by_role'),
    executionResult: jsonb('execution_result'),
    decidedAt: timestamp('decided_at'),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('idx_erp_aiconf_status').on(t.status), index('idx_erp_aiconf_req').on(t.requestedByEmail)]
);

// ============================================================================
// FRAGMORÉ — SMART WALLET, LOYALTY REWARDS & GIFT CARD ECOSYSTEM (TABLES 104–118)
// Backward-compatible extensions preserving all existing 103 tables
// ============================================================================

// 104. Global & Modular Rewards, Wallet, Loyalty, Gift Card & Checkout Rules Configuration
export const rewardsProgramConfig = pgTable('rewards_program_config', {
  id: text('id').primaryKey(), // 'fragmore-rewards-master-config'
  organizationId: text('organization_id').default('org-fragmore-hq').notNull(),
  walletConfig: jsonb('wallet_config').notNull(),
  loyaltyConfig: jsonb('loyalty_config').notNull(),
  giftCardConfig: jsonb('gift_card_config').notNull(),
  referralConfig: jsonb('referral_config').notNull(),
  occasionConfig: jsonb('occasion_config').notNull(),
  checkoutRulesConfig: jsonb('checkout_rules_config').notNull(),
  accountingTaxConfig: jsonb('accounting_tax_config').notNull(),
  complianceConfig: jsonb('compliance_config').notNull(),
  updatedByEmail: text('updated_by_email').default('founder@fragmore.com').notNull(),
  version: integer('version').default(1).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 105. Customer Wallets (Closed-Loop FRAGMORÉ Store Credit Summary)
export const customerWallets = pgTable(
  'customer_wallets',
  {
    id: text('id').primaryKey(),
    customerId: text('customer_id').notNull(),
    customerEmail: text('customer_email').notNull().unique(),
    customerName: text('customer_name').default('').notNull(),
    availableRefundInr: real('available_refund_inr').default(0).notNull(),
    availablePromoInr: real('available_promo_inr').default(0).notNull(),
    availableCashbackInr: real('available_cashback_inr').default(0).notNull(),
    availableGoodwillInr: real('available_goodwill_inr').default(0).notNull(),
    availableReferralInr: real('available_referral_inr').default(0).notNull(),
    pendingCreditsInr: real('pending_credits_inr').default(0).notNull(),
    reservedCreditsInr: real('reserved_credits_inr').default(0).notNull(),
    totalReceivedInr: real('total_received_inr').default(0).notNull(),
    totalRedeemedInr: real('total_redeemed_inr').default(0).notNull(),
    totalExpiredInr: real('total_expired_inr').default(0).notNull(),
    status: text('status').default('ACTIVE').notNull(), // ACTIVE | FROZEN
    termsAcceptedVersion: text('terms_accepted_version').default('v1.0-2026').notNull(),
    termsAcceptedAt: timestamp('terms_accepted_at'),
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('idx_cw_cust_id').on(t.customerId), index('idx_cw_status').on(t.status)]
);

// 106. Customer Wallet Sub-Ledger Credit Buckets (5 Distinct Credit Types with Expiry & Rules)
export const walletCreditBuckets = pgTable(
  'wallet_credit_buckets',
  {
    id: text('id').primaryKey(),
    walletId: text('wallet_id')
      .notNull()
      .references(() => customerWallets.id, { onDelete: 'cascade' }),
    customerEmail: text('customer_email').notNull(),
    creditType: text('credit_type').notNull(), // REFUND_CREDIT | PROMOTIONAL_CREDIT | CASHBACK_REWARD | GOODWILL_CREDIT | REFERRAL_CREDIT
    status: text('status').default('ACTIVE').notNull(), // PENDING | ACTIVE | EXHAUSTED | EXPIRED | REVERSED
    originalAmountInr: real('original_amount_inr').notNull(),
    remainingAmountInr: real('remaining_amount_inr').notNull(),
    reservedAmountInr: real('reserved_amount_inr').default(0).notNull(),
    minOrderValueInr: real('min_order_value_inr').default(0).notNull(),
    maxOrderPct: real('max_order_pct').default(100).notNull(),
    stackableWithCoupons: boolean('stackable_with_coupons').default(true).notNull(),
    stackableWithPoints: boolean('stackable_with_points').default(true).notNull(),
    excludedCategories: jsonb('excluded_categories'), // string[]
    sourceType: text('source_type').notNull(), // ORDER_REFUND_OPT_IN | CAMPAIGN_REWARD | ORDER_CASHBACK | CONCIERGE_GOODWILL | REFERRAL_PROGRAM | ADMIN_APPROVED
    sourceRefId: text('source_ref_id'),
    reason: text('reason').notNull(),
    issuedByEmail: text('issued_by_email').notNull(),
    approvedByEmail: text('approved_by_email'),
    maturesAt: timestamp('matures_at'),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('idx_wcb_wallet').on(t.walletId),
    index('idx_wcb_email').on(t.customerEmail),
    index('idx_wcb_status_exp').on(t.status, t.expiresAt)
  ]
);

// 107. Immutable Wallet Transactions Ledger
export const walletTransactions = pgTable(
  'wallet_transactions',
  {
    id: text('id').primaryKey(),
    referenceNumber: text('reference_number').notNull().unique(),
    idempotencyKey: text('idempotency_key').notNull().unique(),
    walletId: text('wallet_id')
      .notNull()
      .references(() => customerWallets.id, { onDelete: 'cascade' }),
    bucketId: text('bucket_id'),
    customerEmail: text('customer_email').notNull(),
    txnType: text('txn_type').notNull(), // CREDIT_GRANT | PENDING_GRANT | MATURED_CREDIT | CHECKOUT_RESERVE | CHECKOUT_CAPTURE | RELEASE_RESERVATION | CANCEL_RESTORE | RETURN_REVERSAL | EXPIRY | ADMIN_ADJUSTMENT
    creditType: text('credit_type').notNull(),
    direction: text('direction').notNull(), // CREDIT | DEBIT | HOLD | RELEASE
    amountInr: real('amount_inr').notNull(),
    availableBalanceBeforeInr: real('available_balance_before_inr').notNull(),
    availableBalanceAfterInr: real('available_balance_after_inr').notNull(),
    orderId: text('order_id'),
    orderNumber: text('order_number'),
    journalId: text('journal_id'),
    reason: text('reason').notNull(),
    actorEmail: text('actor_email').notNull(),
    actorRole: text('actor_role').notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('idx_wtx_wallet').on(t.walletId),
    index('idx_wtx_email').on(t.customerEmail),
    index('idx_wtx_order').on(t.orderId),
    index('idx_wtx_created').on(t.createdAt)
  ]
);

// 108. FRAGMORÉ Privileges — Configurable Loyalty Tiers
export const loyaltyTiers = pgTable(
  'loyalty_tiers',
  {
    id: text('id').primaryKey(),
    tierCode: text('tier_code').notNull().unique(), // SILVER | GOLD | PLATINUM | PRIVATE_ATELIER
    tierName: text('tier_name').notNull(),
    tagline: text('tagline').notNull(),
    minQualifyingSpendInr: real('min_qualifying_spend_inr').default(0).notNull(),
    minQualifyingOrders: integer('min_qualifying_orders').default(0).notNull(),
    pointsMultiplier: real('points_multiplier').default(1.0).notNull(),
    earnBonusPct: real('earn_bonus_pct').default(0).notNull(),
    durationMonths: integer('duration_months').default(12).notNull(),
    renewalSpendInr: real('renewal_spend_inr').default(0).notNull(),
    maxRedemptionOrderPct: real('max_redemption_order_pct').default(20).notNull(),
    benefits: jsonb('benefits').notNull(), // Array<{ code, label, description, requiresStockCheck: boolean }>
    requiresLiveStockVerificationForSamples: boolean('requires_live_stock_verification_for_samples')
      .default(true)
      .notNull(),
    sortOrder: integer('sort_order').default(1).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('idx_lt_sort').on(t.sortOrder)]
);

// 109. FRAGMORÉ Privileges — Customer Loyalty & Occasion Accounts
export const loyaltyAccounts = pgTable(
  'loyalty_accounts',
  {
    id: text('id').primaryKey(),
    customerId: text('customer_id').notNull(),
    customerEmail: text('customer_email').notNull().unique(),
    customerName: text('customer_name').default('').notNull(),
    memberNumber: text('member_number').notNull().unique(),
    tierCode: text('tier_code').default('SILVER').notNull(),
    tierQualifiedAt: timestamp('tier_qualified_at').defaultNow().notNull(),
    tierExpiresAt: timestamp('tier_expires_at'),
    qualifyingNetSpendInr: real('qualifying_net_spend_inr').default(0).notNull(),
    qualifyingOrdersCount: integer('qualifying_orders_count').default(0).notNull(),
    availablePoints: integer('available_points').default(0).notNull(),
    pendingPoints: integer('pending_points').default(0).notNull(),
    reservedPoints: integer('reserved_points').default(0).notNull(),
    lifetimeEarnedPoints: integer('lifetime_earned_points').default(0).notNull(),
    lifetimeRedeemedPoints: integer('lifetime_redeemed_points').default(0).notNull(),
    lifetimeReversedPoints: integer('lifetime_reversed_points').default(0).notNull(),
    lifetimeExpiredPoints: integer('lifetime_expired_points').default(0).notNull(),
    referralCode: text('referral_code').notNull().unique(),
    referredByCode: text('referred_by_code'),
    referredByEmail: text('referred_by_email'),
    birthday: text('birthday'),
    anniversary: text('anniversary'),
    preferredFragranceFamily: text('preferred_fragrance_family'),
    giftingPreferences: jsonb('gifting_preferences'),
    promoOptIn: boolean('promo_opt_in').default(true).notNull(),
    welcomeBonusAwarded: boolean('welcome_bonus_awarded').default(false).notNull(),
    status: text('status').default('ACTIVE').notNull(),
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('idx_la_cust').on(t.customerId),
    index('idx_la_tier').on(t.tierCode),
    index('idx_la_ref').on(t.referralCode)
  ]
);

// 110. Immutable FRAGMORÉ Privileges Points Ledger
export const loyaltyPointsLedger = pgTable(
  'loyalty_points_ledger',
  {
    id: text('id').primaryKey(),
    referenceNumber: text('reference_number').notNull().unique(),
    idempotencyKey: text('idempotency_key').notNull().unique(),
    loyaltyAccountId: text('loyalty_account_id')
      .notNull()
      .references(() => loyaltyAccounts.id, { onDelete: 'cascade' }),
    customerEmail: text('customer_email').notNull(),
    entryType: text('entry_type').notNull(), // PENDING_EARN | MATURED_EARN | WELCOME_REWARD | OCCASION_REWARD | CAMPAIGN_BONUS | CHECKOUT_RESERVE | CHECKOUT_REDEEM | RELEASE_RESERVATION | ORDER_CANCEL_RESTORE | RETURN_REVERSAL | EXPIRE | ADMIN_ADJUST
    pointsDelta: integer('points_delta').notNull(),
    remainingBatchPoints: integer('remaining_batch_points').default(0).notNull(),
    availablePointsBefore: integer('available_points_before').notNull(),
    availablePointsAfter: integer('available_points_after').notNull(),
    rupeeEquivalentInr: real('rupee_equivalent_inr').default(0).notNull(),
    orderId: text('order_id'),
    orderNumber: text('order_number'),
    maturesAt: timestamp('matures_at'),
    expiresAt: timestamp('expires_at'),
    journalId: text('journal_id'),
    reason: text('reason').notNull(),
    actorEmail: text('actor_email').notNull(),
    actorRole: text('actor_role').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('idx_lpl_acct').on(t.loyaltyAccountId),
    index('idx_lpl_email').on(t.customerEmail),
    index('idx_lpl_order').on(t.orderId)
  ]
);

// 111. Digital, Physical, Corporate & Event Gift Cards (Hashed Secret Codes & Post-Payment Activation)
export const giftCards = pgTable(
  'gift_cards',
  {
    id: text('id').primaryKey(),
    cardNumber: text('card_number').notNull().unique(), // Unpredictable public ID e.g. GC-FRG-9X4M-72KP
    codeHash: text('code_hash').notNull().unique(), // SHA-256 hash of high-entropy redemption secret
    encryptedCode: text('encrypted_code').notNull(), // AES-256-GCM encrypted for post-payment delivery only
    maskedCode: text('masked_code').notNull(), // FRGM-****-****-9K2P
    qrTokenHash: text('qr_token_hash').notNull().unique(),
    cardFormat: text('card_format').default('DIGITAL').notNull(), // DIGITAL | PHYSICAL | CORPORATE_BULK | EVENT_POS
    templateId: text('template_id').default('ivory-champagne-atelier').notNull(),
    occasion: text('occasion').default('Corporate Gift').notNull(),
    initialValueInr: real('initial_value_inr').notNull(),
    remainingBalanceInr: real('remaining_balance_inr').notNull(),
    reservedBalanceInr: real('reserved_balance_inr').default(0).notNull(),
    currency: text('currency').default('INR').notNull(),
    purchaserCustomerId: text('purchaser_customer_id'),
    purchaserName: text('purchaser_name').notNull(),
    purchaserEmail: text('purchaser_email').notNull(),
    senderName: text('sender_name').notNull(),
    recipientName: text('recipient_name').notNull(),
    recipientEmail: text('recipient_email'),
    recipientPhone: text('recipient_phone'),
    personalMessage: text('personal_message'),
    scheduledDeliveryDate: text('scheduled_delivery_date'),
    deliveredAt: timestamp('delivered_at'),
    claimedByCustomerId: text('claimed_by_customer_id'),
    claimedByEmail: text('claimed_by_email'),
    claimedAt: timestamp('claimed_at'),
    purchaseOrderId: text('purchase_order_id'),
    purchaseOrderNumber: text('purchase_order_number'),
    corporateBatchId: text('corporate_batch_id'),
    paymentStatus: text('payment_status').default('PENDING_PAYMENT').notNull(), // PENDING_PAYMENT | PAID | FAILED | REFUNDED
    status: text('status').default('PENDING_PAYMENT').notNull(), // PENDING_PAYMENT | SCHEDULED | ACTIVE | REDEEMED | BLOCKED | CANCELLED | EXPIRED
    issuanceJournalId: text('issuance_journal_id'),
    expiresAt: timestamp('expires_at').notNull(),
    blockedReason: text('blocked_reason'),
    blockedByEmail: text('blocked_by_email'),
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('idx_gc_status').on(t.status),
    index('idx_gc_purchaser').on(t.purchaserEmail),
    index('idx_gc_recipient').on(t.recipientEmail),
    index('idx_gc_claimed').on(t.claimedByEmail),
    index('idx_gc_batch').on(t.corporateBatchId)
  ]
);

// 112. Immutable Gift Card Transactions Ledger
export const giftCardTransactions = pgTable(
  'gift_card_transactions',
  {
    id: text('id').primaryKey(),
    referenceNumber: text('reference_number').notNull().unique(),
    idempotencyKey: text('idempotency_key').notNull().unique(),
    giftCardId: text('gift_card_id')
      .notNull()
      .references(() => giftCards.id, { onDelete: 'cascade' }),
    cardNumber: text('card_number').notNull(),
    txnType: text('txn_type').notNull(), // ISSUANCE_ACTIVATED | RECIPIENT_CLAIM | CHECKOUT_RESERVE | CHECKOUT_REDEMPTION | RELEASE_RESERVATION | CANCEL_RESTORE | EVENT_POS_REDEMPTION | ADMIN_BLOCK | ADMIN_UNBLOCK | ADMIN_CANCEL | BREAKAGE_RECOGNIZED
    channel: text('channel').default('WEB_STOREFRONT').notNull(), // WEB_STOREFRONT | EVENT_PERFUME_BAR_POS | CORPORATE_DESK | ADMIN
    amountInr: real('amount_inr').notNull(),
    balanceBeforeInr: real('balance_before_inr').notNull(),
    balanceAfterInr: real('balance_after_inr').notNull(),
    orderId: text('order_id'),
    orderNumber: text('order_number'),
    posEventLocation: text('pos_event_location'),
    redeemedByEmail: text('redeemed_by_email'),
    verifiedByStaffEmail: text('verified_by_staff_email'),
    journalId: text('journal_id'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('idx_gctx_card').on(t.giftCardId), index('idx_gctx_order').on(t.orderId)]
);

// 113. Corporate & Bulk Gift Card Batches (Connected to ERP Proposals, Quotations & Invoices)
export const corporateGiftCardBatches = pgTable(
  'corporate_gift_card_batches',
  {
    id: text('id').primaryKey(),
    batchNumber: text('batch_number').notNull().unique(),
    companyName: text('company_name').notNull(),
    contactName: text('contact_name').notNull(),
    contactEmail: text('contact_email').notNull(),
    contactPhone: text('contact_phone').notNull(),
    customerGstin: text('customer_gstin'),
    category: text('category').default('CORPORATE_GIFTING').notNull(), // CORPORATE_GIFTING | EMPLOYEE_REWARDS | WEDDING_RETURN_GIFTS | HOSPITALITY | EVENT_PERFUME_BAR | AGENCY_PARTNER
    erpProposalId: text('erp_proposal_id'),
    erpQuotationId: text('erp_quotation_id'),
    erpInvoiceId: text('erp_invoice_id'),
    templateId: text('template_id').default('ivory-champagne-atelier').notNull(),
    occasion: text('occasion').default('Corporate Gift').notNull(),
    quantity: integer('quantity').notNull(),
    denominationInr: real('denomination_inr').notNull(),
    grossFaceValueInr: real('gross_face_value_inr').notNull(),
    corporateDiscountPct: real('corporate_discount_pct').default(0).notNull(),
    netPayableInr: real('net_payable_inr').notNull(),
    paymentStatus: text('payment_status').default('AWAITING_PAYMENT').notNull(), // AWAITING_PAYMENT | PAYMENT_APPROVED
    paymentApprovedByEmail: text('payment_approved_by_email'),
    paymentApprovedAt: timestamp('payment_approved_at'),
    paymentReference: text('payment_reference'),
    scheduledDistributionDate: text('scheduled_distribution_date'),
    recipients: jsonb('recipients').notNull(), // Array<{ name, email, phone, customNote }>
    issuedCardsCount: integer('issued_cards_count').default(0).notNull(),
    claimedCardsCount: integer('claimed_cards_count').default(0).notNull(),
    redeemedValueInr: real('redeemed_value_inr').default(0).notNull(),
    status: text('status').default('QUOTATION_DRAFT').notNull(), // QUOTATION_DRAFT | AWAITING_PAYMENT | PAYMENT_CONFIRMED_READY | ISSUED | COMPLETED | CANCELLED
    notes: text('notes'),
    createdByEmail: text('created_by_email').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('idx_cgcb_status').on(t.status), index('idx_cgcb_pay').on(t.paymentStatus)]
);

// 114. Referral Program Conversions & Anti-Abuse Ledger
export const referralConversions = pgTable(
  'referral_conversions',
  {
    id: text('id').primaryKey(),
    conversionNumber: text('conversion_number').notNull().unique(),
    referralCode: text('referral_code').notNull(),
    referrerCustomerId: text('referrer_customer_id').notNull(),
    referrerEmail: text('referrer_email').notNull(),
    refereeCustomerId: text('referee_customer_id'),
    refereeEmail: text('referee_email').notNull(),
    refereePhone: text('referee_phone'),
    qualifyingOrderId: text('qualifying_order_id'),
    qualifyingOrderNumber: text('qualifying_order_number'),
    qualifyingOrderNetInr: real('qualifying_order_net_inr').default(0).notNull(),
    refereeCreditInr: real('referee_credit_inr').default(50).notNull(),
    referrerCreditInr: real('referrer_credit_inr').default(75).notNull(),
    status: text('status').default('REGISTERED').notNull(), // INVITED | REGISTERED | QUALIFYING_ORDER_PLACED | HELD_RETURN_WINDOW | HELD_FRAUD_REVIEW | COMPLETED_REWARDED | REVERSED_REFUND | REJECTED
    riskScore: integer('risk_score').default(0).notNull(),
    riskFlags: jsonb('risk_flags'), // string[]
    deviceFingerprintHash: text('device_fingerprint_hash'),
    ipAddressHash: text('ip_address_hash'),
    shippingAddressHash: text('shipping_address_hash'),
    paymentInstrumentHash: text('payment_instrument_hash'),
    maturesAt: timestamp('matures_at'),
    rewardedAt: timestamp('rewarded_at'),
    reversedAt: timestamp('reversed_at'),
    reviewedByEmail: text('reviewed_by_email'),
    reviewNotes: text('review_notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('idx_refc_referrer').on(t.referrerEmail),
    index('idx_refc_referee').on(t.refereeEmail),
    index('idx_refc_order').on(t.qualifyingOrderId),
    index('idx_refc_status').on(t.status)
  ]
);

// 115. Birthday, Anniversary & Special Occasion Reward Issuances
export const occasionRewardLogs = pgTable(
  'occasion_reward_logs',
  {
    id: text('id').primaryKey(),
    grantNumber: text('grant_number').notNull().unique(),
    customerId: text('customer_id').notNull(),
    customerEmail: text('customer_email').notNull(),
    occasionType: text('occasion_type').notNull(), // BIRTHDAY | ANNIVERSARY | VIP_MILESTONE | FESTIVE_ATELIER
    rewardYear: integer('reward_year').notNull(),
    rewardKind: text('reward_kind').notNull(), // LOYALTY_POINTS | PROMO_WALLET_CREDIT | PRIVATE_COUPON | COMPLIMENTARY_SAMPLE
    pointsAwarded: integer('points_awarded').default(0).notNull(),
    walletCreditInr: real('wallet_credit_inr').default(0).notNull(),
    couponCode: text('coupon_code'),
    sampleSku: text('sample_sku'),
    liveStockVerified: boolean('live_stock_verified').default(false).notNull(),
    consentVerified: boolean('consent_verified').default(true).notNull(),
    campaignBudgetInr: real('campaign_budget_inr').default(0).notNull(),
    status: text('status').default('ISSUED').notNull(), // ISSUED | REDEEMED | EXPIRED | SKIPPED_NO_CONSENT | SKIPPED_OUT_OF_STOCK
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('idx_occ_email_yr').on(t.customerEmail, t.occasionType, t.rewardYear)]
);

// 116. Atomic Checkout Reward Reservations & Captures
export const checkoutRewardReservations = pgTable(
  'checkout_reward_reservations',
  {
    id: text('id').primaryKey(),
    reservationNumber: text('reservation_number').notNull().unique(),
    idempotencyKey: text('idempotency_key').notNull().unique(),
    customerEmail: text('customer_email').notNull(),
    orderId: text('order_id'),
    orderNumber: text('order_number'),
    cartSubtotalInr: real('cart_subtotal_inr').notNull(),
    couponDiscountInr: real('coupon_discount_inr').default(0).notNull(),
    walletAppliedInr: real('wallet_applied_inr').default(0).notNull(),
    walletBucketBreakdown: jsonb('wallet_bucket_breakdown'), // Array<{ bucketId, creditType, amountInr }>
    loyaltyPointsRedeemed: integer('loyalty_points_redeemed').default(0).notNull(),
    loyaltyDiscountInr: real('loyalty_discount_inr').default(0).notNull(),
    giftCardId: text('gift_card_id'),
    giftCardNumber: text('gift_card_number'),
    giftCardAppliedInr: real('gift_card_applied_inr').default(0).notNull(),
    taxableValueInr: real('taxable_value_inr').notNull(),
    gstAmountInr: real('gst_amount_inr').notNull(),
    shippingInr: real('shipping_inr').default(0).notNull(),
    finalPayableInr: real('final_payable_inr').notNull(),
    status: text('status').default('RESERVED').notNull(), // RESERVED | CAPTURED | RELEASED | RESTORED_ON_CANCEL | PARTIALLY_REVERSED
    expiresAt: timestamp('expires_at').notNull(),
    capturedAt: timestamp('captured_at'),
    releasedAt: timestamp('released_at'),
    releaseReason: text('release_reason'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('idx_crr_email').on(t.customerEmail),
    index('idx_crr_order').on(t.orderId),
    index('idx_crr_status').on(t.status)
  ]
);

// 117. Dual-Control Approval Queue for Admin, Support, Finance & AI Reward Actions
export const rewardsAdjustmentApprovals = pgTable(
  'rewards_adjustment_approvals',
  {
    id: text('id').primaryKey(),
    approvalNumber: text('approval_number').notNull().unique(),
    requestSource: text('request_source').default('ADMIN_CONSOLE').notNull(), // ADMIN_CONSOLE | CUSTOMER_SUPPORT | AI_REWARDS_ASSISTANT | FINANCE_BREAKAGE
    actionType: text('action_type').notNull(), // WALLET_CREDIT_ISSUE | WALLET_DEBIT_ADJUST | LOYALTY_POINTS_ADJUST | GIFT_CARD_ISSUE | GIFT_CARD_BLOCK_CANCEL | REFERRAL_REVIEW_RELEASE | BREAKAGE_RECOGNITION | CAMPAIGN_LAUNCH
    targetCustomerEmail: text('target_customer_email'),
    targetEntityId: text('target_entity_id'),
    amountInr: real('amount_inr').default(0).notNull(),
    pointsDelta: integer('points_delta').default(0).notNull(),
    creditType: text('credit_type'),
    reason: text('reason').notNull(),
    payload: jsonb('payload').notNull(),
    requestedByEmail: text('requested_by_email').notNull(),
    requestedByRole: text('requested_by_role').notNull(),
    status: text('status').default('PENDING_APPROVAL').notNull(), // PENDING_APPROVAL | APPROVED_EXECUTED | REJECTED
    decidedByEmail: text('decided_by_email'),
    decidedByRole: text('decided_by_role'),
    decisionNotes: text('decision_notes'),
    executionResult: jsonb('execution_result'),
    decidedAt: timestamp('decided_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('idx_raa_status').on(t.status), index('idx_raa_target').on(t.targetCustomerEmail)]
);

// 118. Fraud, Brute-Force & Household-Safe Risk Review Queue
export const rewardsFraudFlags = pgTable(
  'rewards_fraud_flags',
  {
    id: text('id').primaryKey(),
    flagNumber: text('flag_number').notNull().unique(),
    category: text('category').notNull(), // GIFT_CARD_BRUTE_FORCE | SELF_REFERRAL_ATTEMPT | HOUSEHOLD_SHARED_SIGNAL | ABNORMAL_REDEMPTION_VELOCITY | RETURN_ABUSE_PATTERN | UNAUTHORIZED_ACCESS_ATTEMPT
    severity: text('severity').default('MEDIUM').notNull(), // LOW | MEDIUM | HIGH | CRITICAL
    actorIdentifier: text('actor_identifier').notNull(),
    customerEmail: text('customer_email'),
    relatedEntityType: text('related_entity_type'),
    relatedEntityId: text('related_entity_id'),
    signals: jsonb('signals').notNull(),
    status: text('status').default('OPEN_REVIEW').notNull(), // OPEN_REVIEW | CLEARED_LEGITIMATE_HOUSEHOLD | CONFIRMED_BLOCKED | DISMISSED
    reviewedByEmail: text('reviewed_by_email'),
    resolutionNotes: text('resolution_notes'),
    reviewedAt: timestamp('reviewed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('idx_rff_status').on(t.status), index('idx_rff_cat').on(t.category)]
);


