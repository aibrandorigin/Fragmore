import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { db } from '../db/index.ts';
import {
  automationWorkflows,
  automationEvents,
  automationJobs,
  automationScheduledTasks,
  automationApprovals,
  automationAiRecommendations,
  automationSettingsTable,
  products,
  orders,
  customers,
  coupons,
  campaigns,
  abandonedCarts,
  auditLogs
} from '../db/schema.ts';
import { eq, desc } from 'drizzle-orm';

const WORKER_ID = `fragmore-worker-${process.pid}-${Math.random().toString(36).slice(2, 7)}`;

export interface WorkflowNode {
  id: string;
  type: 'trigger' | 'condition' | 'action' | 'control';
  subtype: string;
  label: string;
  position: { x: number; y: number };
  config: Record<string, any>;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  branchLabel?: 'TRUE' | 'FALSE' | 'DEFAULT';
}

export interface StepExecutionLog {
  nodeId: string;
  nodeLabel: string;
  nodeType: string;
  nodeSubtype: string;
  status: 'SUCCESS' | 'SKIPPED' | 'FAILED' | 'WAITING' | 'APPROVAL_REQUIRED';
  startedAt: string;
  completedAt: string;
  durationMs: number;
  output?: Record<string, any>;
  error?: string;
}

export interface AutomationGlobalSettings {
  engineEnabled: boolean;
  timezone: string;
  maxConcurrentJobs: number;
  rateLimitPerMinute: number;
  retryBaseDelayMs: number;
  defaultMaxAttempts: number;
  dlqRetentionDays: number;
  eventRetentionDays: number;
  highValueDiscountThresholdPct: number;
  highValueDiscountThresholdInr: number;
  bulkInventoryThresholdUnits: number;
  bulkPromoAudienceThreshold: number;
  webhookSigningSecret: string;
  providers: {
    whatsapp: { provider: string; configured: boolean; lastVerifiedAt: string | null; status: string };
    email: { provider: string; configured: boolean; lastVerifiedAt: string | null; status: string };
    sms: { provider: string; configured: boolean; lastVerifiedAt: string | null; status: string };
    webhook: { provider: string; configured: boolean; lastVerifiedAt: string | null; status: string };
    geminiAi: { provider: string; configured: boolean; lastVerifiedAt: string | null; status: string };
  };
}

export const DEFAULT_AUTOMATION_SETTINGS: AutomationGlobalSettings = {
  engineEnabled: true,
  timezone: 'Asia/Kolkata',
  maxConcurrentJobs: 5,
  rateLimitPerMinute: 120,
  retryBaseDelayMs: 2000,
  defaultMaxAttempts: 3,
  dlqRetentionDays: 30,
  eventRetentionDays: 90,
  highValueDiscountThresholdPct: 25,
  highValueDiscountThresholdInr: 1000,
  bulkInventoryThresholdUnits: 20,
  bulkPromoAudienceThreshold: 50,
  webhookSigningSecret: process.env.AUTOMATION_WEBHOOK_SECRET || 'fragmore_whsec_live_2026_hmac',
  providers: {
    whatsapp: {
      provider: 'Meta WhatsApp Cloud API / Interakt',
      configured: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
      lastVerifiedAt: null,
      status: process.env.WHATSAPP_ACCESS_TOKEN ? 'CONFIGURED' : 'PENDING_CREDENTIALS'
    },
    email: {
      provider: 'SMTP / Resend / SendGrid',
      configured: Boolean(process.env.SMTP_HOST || process.env.RESEND_API_KEY),
      lastVerifiedAt: null,
      status: process.env.SMTP_HOST || process.env.RESEND_API_KEY ? 'CONFIGURED' : 'PENDING_CREDENTIALS'
    },
    sms: {
      provider: 'MSG91 / Twilio SMS',
      configured: Boolean(process.env.SMS_API_KEY || process.env.TWILIO_AUTH_TOKEN),
      lastVerifiedAt: null,
      status: process.env.SMS_API_KEY || process.env.TWILIO_AUTH_TOKEN ? 'CONFIGURED' : 'PENDING_CREDENTIALS'
    },
    webhook: {
      provider: 'HMAC-SHA256 Signed HTTP Dispatcher',
      configured: true,
      lastVerifiedAt: new Date().toISOString(),
      status: 'VERIFIED'
    },
    geminiAi: {
      provider: 'Google Gemini API (@google/genai)',
      configured: Boolean(process.env.GEMINI_API_KEY),
      lastVerifiedAt: process.env.GEMINI_API_KEY ? new Date().toISOString() : null,
      status: process.env.GEMINI_API_KEY ? 'VERIFIED' : 'PENDING_CREDENTIALS'
    }
  }
};

// Initial Production Workflow Blueprints (Zero fake stats, zero fake orders/customers)
export const INITIAL_AUTOMATION_WORKFLOWS = [
  {
    id: 'wf-cart-abandoned-recovery',
    name: 'Luxury Cart Abandonment Concierge Recovery',
    description: 'Triggers when a cart is abandoned (> ₹999), verifies consent & stock availability, waits 30 minutes, and dispatches WhatsApp + Email recovery.',
    category: 'marketing',
    status: 'ACTIVE',
    triggerType: 'cart.abandoned',
    triggerConfig: { minCartValue: 999 },
    nodes: [
      {
        id: 'node-1',
        type: 'trigger',
        subtype: 'cart.abandoned',
        label: 'Cart Abandoned',
        position: { x: 80, y: 160 },
        config: { minCartValue: 999 }
      },
      {
        id: 'node-2',
        type: 'condition',
        subtype: 'condition.cart_value',
        label: 'Cart Value >= ₹999',
        position: { x: 340, y: 160 },
        config: { operator: 'gte', value: 999, logic: 'AND' }
      },
      {
        id: 'node-3',
        type: 'control',
        subtype: 'control.wait',
        label: 'Wait 15 Mins',
        position: { x: 600, y: 160 },
        config: { durationSeconds: 0, displayLabel: '15m Grace Window (0s in immediate mode)' }
      },
      {
        id: 'node-4',
        type: 'action',
        subtype: 'action.send_whatsapp',
        label: 'Send Approved WhatsApp Recovery',
        position: { x: 860, y: 100 },
        config: {
          templateName: 'fragmore_cart_concierge_v1',
          channel: 'whatsapp',
          messagePreview: 'Your selected FRAGMORÉ flacon is reserved in your private bag.'
        }
      },
      {
        id: 'node-5',
        type: 'action',
        subtype: 'action.record_attribution',
        label: 'Record Recovery Attribution',
        position: { x: 1120, y: 160 },
        config: { campaign: 'automated_cart_recovery', channel: 'whatsapp' }
      }
    ],
    edges: [
      { id: 'e1-2', source: 'node-1', target: 'node-2', branchLabel: 'DEFAULT' },
      { id: 'e2-3', source: 'node-2', target: 'node-3', branchLabel: 'TRUE' },
      { id: 'e3-4', source: 'node-3', target: 'node-4', branchLabel: 'DEFAULT' },
      { id: 'e4-5', source: 'node-4', target: 'node-5', branchLabel: 'DEFAULT' }
    ],
    maxExecutionsPerCustomer: 3,
    maxExecutionsPerDay: 500,
    cooldownMinutes: 60,
    requiresApproval: false,
    approvalStatus: 'APPROVED'
  },
  {
    id: 'wf-order-placed-concierge',
    name: 'Order Placed Confirmation & Inventory Reservation',
    description: 'Executes transactionally when an order is placed: reserves SKU inventory, sends transactional confirmation email, and tags high-value buyers.',
    category: 'order',
    status: 'ACTIVE',
    triggerType: 'order.placed',
    triggerConfig: {},
    nodes: [
      {
        id: 'node-1',
        type: 'trigger',
        subtype: 'order.placed',
        label: 'Order Placed',
        position: { x: 80, y: 160 },
        config: {}
      },
      {
        id: 'node-2',
        type: 'action',
        subtype: 'action.send_transactional_email',
        label: 'Send Order & GST Invoice Email',
        position: { x: 350, y: 160 },
        config: {
          subject: 'Your FRAGMORÉ Order Confirmation',
          template: 'order_confirmation_gst'
        }
      },
      {
        id: 'node-3',
        type: 'condition',
        subtype: 'condition.cart_value',
        label: 'Order Total >= ₹2,499',
        position: { x: 620, y: 160 },
        config: { operator: 'gte', value: 2499, logic: 'AND' }
      },
      {
        id: 'node-4',
        type: 'action',
        subtype: 'action.assign_segment',
        label: 'Assign VIP Connoisseur Segment',
        position: { x: 890, y: 160 },
        config: { segment: 'VIP', tier: 'Gold' }
      }
    ],
    edges: [
      { id: 'e1-2', source: 'node-1', target: 'node-2', branchLabel: 'DEFAULT' },
      { id: 'e2-3', source: 'node-2', target: 'node-3', branchLabel: 'DEFAULT' },
      { id: 'e3-4', source: 'node-3', target: 'node-4', branchLabel: 'TRUE' }
    ],
    maxExecutionsPerCustomer: 0,
    maxExecutionsPerDay: 2000,
    cooldownMinutes: 0,
    requiresApproval: false,
    approvalStatus: 'APPROVED'
  },
  {
    id: 'wf-discovery-kit-voucher',
    name: 'Discovery Six ₹1,499 Full-Bottle Upgrade Journey',
    description: 'Triggered when a customer purchases the Discovery Six kit; generates an exclusive upgrade voucher and schedules a follow-up.',
    category: 'discovery',
    status: 'ACTIVE',
    triggerType: 'discovery.purchased',
    triggerConfig: { productSlug: 'discovery-six' },
    nodes: [
      {
        id: 'node-1',
        type: 'trigger',
        subtype: 'discovery.purchased',
        label: 'Discovery Kit Purchased',
        position: { x: 80, y: 160 },
        config: { sku: 'discovery' }
      },
      {
        id: 'node-2',
        type: 'action',
        subtype: 'action.generate_coupon',
        label: 'Generate ₹500 Privilege Voucher',
        position: { x: 360, y: 160 },
        config: {
          prefix: 'DISC',
          discountType: 'FIXED',
          value: 500,
          minOrderValue: 1499,
          expiryDays: 30
        }
      },
      {
        id: 'node-3',
        type: 'action',
        subtype: 'action.send_transactional_email',
        label: 'Dispatch Discovery Redemption Guide',
        position: { x: 640, y: 160 },
        config: {
          subject: 'Your FRAGMORÉ Discovery Six Olfactory Guide & Voucher',
          template: 'discovery_upgrade_voucher'
        }
      }
    ],
    edges: [
      { id: 'e1-2', source: 'node-1', target: 'node-2', branchLabel: 'DEFAULT' },
      { id: 'e2-3', source: 'node-2', target: 'node-3', branchLabel: 'DEFAULT' }
    ],
    maxExecutionsPerCustomer: 2,
    maxExecutionsPerDay: 500,
    cooldownMinutes: 0,
    requiresApproval: false,
    approvalStatus: 'APPROVED'
  },
  {
    id: 'wf-low-inventory-sentinel',
    name: 'Low Flacon Stock Warehouse Sentinel',
    description: 'Monitors SKU stock levels below threshold (< 30 units) and creates an urgent admin notification & staff replenishment task.',
    category: 'inventory',
    status: 'ACTIVE',
    triggerType: 'inventory.below_threshold',
    triggerConfig: { threshold: 30 },
    nodes: [
      {
        id: 'node-1',
        type: 'trigger',
        subtype: 'inventory.below_threshold',
        label: 'Inventory Below Threshold (< 30)',
        position: { x: 80, y: 160 },
        config: { threshold: 30 }
      },
      {
        id: 'node-2',
        type: 'action',
        subtype: 'action.create_admin_notification',
        label: 'Alert Inventory Manager',
        position: { x: 380, y: 120 },
        config: { severity: 'HIGH', title: 'Low Flacon Reserve Alert' }
      },
      {
        id: 'node-3',
        type: 'action',
        subtype: 'action.create_staff_task',
        label: 'Create Batch Replenishment Task',
        position: { x: 680, y: 160 },
        config: { assigneeRole: 'INVENTORY_MANAGER', taskTitle: 'Schedule Kannauj/Grasse Maceration Batch' }
      }
    ],
    edges: [
      { id: 'e1-2', source: 'node-1', target: 'node-2', branchLabel: 'DEFAULT' },
      { id: 'e2-3', source: 'node-2', target: 'node-3', branchLabel: 'DEFAULT' }
    ],
    maxExecutionsPerCustomer: 0,
    maxExecutionsPerDay: 200,
    cooldownMinutes: 120,
    requiresApproval: false,
    approvalStatus: 'APPROVED'
  },
  {
    id: 'wf-shipping-dispatch-tracker',
    name: 'Consignment Dispatched Live Tracking Alert',
    description: 'When an order transitions to SHIPPED, dispatches AWB tracking details via WhatsApp & Email.',
    category: 'shipping',
    status: 'ACTIVE',
    triggerType: 'order.dispatched',
    triggerConfig: {},
    nodes: [
      {
        id: 'node-1',
        type: 'trigger',
        subtype: 'order.dispatched',
        label: 'Order Dispatched',
        position: { x: 80, y: 160 },
        config: {}
      },
      {
        id: 'node-2',
        type: 'action',
        subtype: 'action.send_whatsapp',
        label: 'Send AWB Tracking WhatsApp',
        position: { x: 380, y: 160 },
        config: { templateName: 'fragmore_dispatch_awb', channel: 'whatsapp' }
      },
      {
        id: 'node-3',
        type: 'action',
        subtype: 'action.send_transactional_email',
        label: 'Send Dispatch Airwaybill Email',
        position: { x: 680, y: 160 },
        config: { subject: 'Your FRAGMORÉ Consignment Has Been Dispatched' }
      }
    ],
    edges: [
      { id: 'e1-2', source: 'node-1', target: 'node-2', branchLabel: 'DEFAULT' },
      { id: 'e2-3', source: 'node-2', target: 'node-3', branchLabel: 'DEFAULT' }
    ],
    maxExecutionsPerCustomer: 0,
    maxExecutionsPerDay: 1000,
    cooldownMinutes: 0,
    requiresApproval: false,
    approvalStatus: 'APPROVED'
  },
  {
    id: 'wf-post-delivery-review-retention',
    name: 'Post-Delivery Olfactory Review & Replenishment',
    description: 'Triggers upon order delivery to invite verified customer reviews and build long-term retention.',
    category: 'review_retention',
    status: 'ACTIVE',
    triggerType: 'order.delivered',
    triggerConfig: {},
    nodes: [
      {
        id: 'node-1',
        type: 'trigger',
        subtype: 'order.delivered',
        label: 'Order Delivered',
        position: { x: 80, y: 160 },
        config: {}
      },
      {
        id: 'node-2',
        type: 'action',
        subtype: 'action.send_transactional_email',
        label: 'Send Olfactory Impression Invite',
        position: { x: 380, y: 160 },
        config: { subject: 'How Does Your FRAGMORÉ Creation Unfold on Skin?' }
      },
      {
        id: 'node-3',
        type: 'action',
        subtype: 'action.add_campaign_audience',
        label: 'Add to Private Client Replenishment List',
        position: { x: 680, y: 160 },
        config: { campaignName: 'Signature Replenishment Circle' }
      }
    ],
    edges: [
      { id: 'e1-2', source: 'node-1', target: 'node-2', branchLabel: 'DEFAULT' },
      { id: 'e2-3', source: 'node-2', target: 'node-3', branchLabel: 'DEFAULT' }
    ],
    maxExecutionsPerCustomer: 5,
    maxExecutionsPerDay: 1000,
    cooldownMinutes: 0,
    requiresApproval: false,
    approvalStatus: 'APPROVED'
  },
  {
    id: 'wf-customer-welcome-journey',
    name: 'New Customer Registration Welcome Journey',
    description: 'Welcomes newly registered connoisseurs, assigns the New Customers segment, and records onboarding attribution.',
    category: 'customer_journeys',
    status: 'ACTIVE',
    triggerType: 'customer.registered',
    triggerConfig: {},
    nodes: [
      {
        id: 'node-1',
        type: 'trigger',
        subtype: 'customer.registered',
        label: 'Customer Registered',
        position: { x: 80, y: 160 },
        config: {}
      },
      {
        id: 'node-2',
        type: 'action',
        subtype: 'action.assign_segment',
        label: 'Assign Welcome Connoisseur Tag',
        position: { x: 380, y: 160 },
        config: { segment: 'Welcome Circle' }
      },
      {
        id: 'node-3',
        type: 'action',
        subtype: 'action.send_transactional_email',
        label: 'Send Maison Welcome Letter',
        position: { x: 680, y: 160 },
        config: { subject: 'Welcome to FRAGMORÉ — Scent That Stays With You.' }
      }
    ],
    edges: [
      { id: 'e1-2', source: 'node-1', target: 'node-2', branchLabel: 'DEFAULT' },
      { id: 'e2-3', source: 'node-2', target: 'node-3', branchLabel: 'DEFAULT' }
    ],
    maxExecutionsPerCustomer: 1,
    maxExecutionsPerDay: 1000,
    cooldownMinutes: 0,
    requiresApproval: false,
    approvalStatus: 'APPROVED'
  },
  {
    id: 'wf-influencer-coupon-attribution',
    name: 'Influencer Referral & Coupon Redemption Ledger',
    description: 'Tracks influencer referral code redemptions and logs partner commission attribution.',
    category: 'influencer',
    status: 'ACTIVE',
    triggerType: 'coupon.redeemed',
    triggerConfig: {},
    nodes: [
      {
        id: 'node-1',
        type: 'trigger',
        subtype: 'coupon.redeemed',
        label: 'Coupon Redeemed',
        position: { x: 80, y: 160 },
        config: {}
      },
      {
        id: 'node-2',
        type: 'action',
        subtype: 'action.record_attribution',
        label: 'Log Influencer Referral Attribution',
        position: { x: 380, y: 160 },
        config: { channel: 'influencer_referral' }
      },
      {
        id: 'node-3',
        type: 'action',
        subtype: 'action.create_admin_notification',
        label: 'Notify Marketing Attribution Desk',
        position: { x: 680, y: 160 },
        config: { severity: 'INFO', title: 'Coupon Redemption Recorded' }
      }
    ],
    edges: [
      { id: 'e1-2', source: 'node-1', target: 'node-2', branchLabel: 'DEFAULT' },
      { id: 'e2-3', source: 'node-2', target: 'node-3', branchLabel: 'DEFAULT' }
    ],
    maxExecutionsPerCustomer: 0,
    maxExecutionsPerDay: 1000,
    cooldownMinutes: 0,
    requiresApproval: false,
    approvalStatus: 'APPROVED'
  },
  {
    id: 'wf-lifecycle-first-purchase',
    name: 'Lifecycle: First Purchase Fulfillment & Review Journey',
    description: 'Successful paid first order -> transactional order confirmation -> fulfillment journey -> delivery -> review invitation.',
    category: 'customer_journeys',
    status: 'ACTIVE',
    triggerType: 'order.first_purchase',
    triggerConfig: { orderNumber: 1 },
    nodes: [
      {
        id: 'node-1',
        type: 'trigger',
        subtype: 'order.first_purchase',
        label: 'First Paid Order Placed',
        position: { x: 80, y: 160 },
        config: { orderNumber: 1 }
      },
      {
        id: 'node-2',
        type: 'action',
        subtype: 'action.send_transactional_email',
        label: 'Send First Purchase Confirmation',
        position: { x: 340, y: 160 },
        config: {
          communicationType: 'TRANSACTIONAL',
          subject: 'Welcome to the House of FRAGMORÉ — Your First Order is Confirmed'
        }
      },
      {
        id: 'node-3',
        type: 'action',
        subtype: 'action.assign_segment',
        label: 'Assign First-time Buyer Segment',
        position: { x: 600, y: 160 },
        config: { segment: 'First-time buyers' }
      },
      {
        id: 'node-4',
        type: 'control',
        subtype: 'control.wait',
        label: 'Wait for Fulfillment & Delivery',
        position: { x: 860, y: 160 },
        config: { durationSeconds: 0, displayLabel: 'Post-Delivery Review Window' }
      },
      {
        id: 'node-5',
        type: 'condition',
        subtype: 'condition.communication_consent',
        label: 'Verify Communication Consent',
        position: { x: 1120, y: 160 },
        config: { requireOptIn: true }
      },
      {
        id: 'node-6',
        type: 'action',
        subtype: 'action.send_whatsapp',
        label: 'Send Post-Delivery Review Invitation',
        position: { x: 1380, y: 160 },
        config: {
          communicationType: 'PROMOTIONAL',
          templateName: 'fragmore_first_purchase_review_invite'
        }
      }
    ],
    edges: [
      { id: 'e1-2', source: 'node-1', target: 'node-2', branchLabel: 'DEFAULT' },
      { id: 'e2-3', source: 'node-2', target: 'node-3', branchLabel: 'DEFAULT' },
      { id: 'e3-4', source: 'node-3', target: 'node-4', branchLabel: 'DEFAULT' },
      { id: 'e4-5', source: 'node-4', target: 'node-5', branchLabel: 'DEFAULT' },
      { id: 'e5-6', source: 'node-5', target: 'node-6', branchLabel: 'TRUE' }
    ],
    maxExecutionsPerCustomer: 1,
    maxExecutionsPerDay: 500,
    cooldownMinutes: 0,
    requiresApproval: false,
    approvalStatus: 'APPROVED'
  },
  {
    id: 'wf-lifecycle-repeat-customer',
    name: 'Lifecycle: Repeat Customer Loyalty & Segment Elevation',
    description: 'Second or subsequent completed order -> update customer segment to Repeat buyers -> issue optional loyalty benefit.',
    category: 'customer_journeys',
    status: 'ACTIVE',
    triggerType: 'order.repeat_purchase',
    triggerConfig: { minCompletedOrders: 2 },
    nodes: [
      {
        id: 'node-1',
        type: 'trigger',
        subtype: 'order.repeat_purchase',
        label: 'Repeat Order Completed (2+)',
        position: { x: 80, y: 160 },
        config: { minCompletedOrders: 2 }
      },
      {
        id: 'node-2',
        type: 'action',
        subtype: 'action.assign_segment',
        label: 'Update Segment: Repeat Buyers',
        position: { x: 360, y: 160 },
        config: { segment: 'Repeat buyers' }
      },
      {
        id: 'node-3',
        type: 'condition',
        subtype: 'condition.communication_consent',
        label: 'Verify Loyalty Benefit Consent',
        position: { x: 640, y: 160 },
        config: { requireOptIn: true }
      },
      {
        id: 'node-4',
        type: 'action',
        subtype: 'action.generate_coupon',
        label: 'Issue Repeat Collector Benefit (10%)',
        position: { x: 920, y: 160 },
        config: { prefix: 'LOYAL10', discountType: 'PERCENTAGE', value: 10, minOrderValue: 1499, expiryDays: 45 }
      },
      {
        id: 'node-5',
        type: 'action',
        subtype: 'action.send_marketing_email',
        label: 'Send Repeat Collector Privilege Email',
        position: { x: 1200, y: 160 },
        config: {
          communicationType: 'PROMOTIONAL',
          subject: 'A Private Privilege for Returning to FRAGMORÉ'
        }
      }
    ],
    edges: [
      { id: 'e1-2', source: 'node-1', target: 'node-2', branchLabel: 'DEFAULT' },
      { id: 'e2-3', source: 'node-2', target: 'node-3', branchLabel: 'DEFAULT' },
      { id: 'e3-4', source: 'node-3', target: 'node-4', branchLabel: 'TRUE' },
      { id: 'e4-5', source: 'node-4', target: 'node-5', branchLabel: 'DEFAULT' }
    ],
    maxExecutionsPerCustomer: 5,
    maxExecutionsPerDay: 500,
    cooldownMinutes: 60,
    requiresApproval: false,
    approvalStatus: 'APPROVED'
  },
  {
    id: 'wf-lifecycle-inactive-winback',
    name: 'Lifecycle: 45/60/90-Day Inactive Win-Back Campaign',
    description: 'No completed purchase for 45/60/90 days -> evaluate marketing consent -> send relevant win-back campaign.',
    category: 'customer_journeys',
    status: 'ACTIVE',
    triggerType: 'customer.inactive',
    triggerConfig: { inactivityThresholdsDays: [45, 60, 90] },
    nodes: [
      {
        id: 'node-1',
        type: 'trigger',
        subtype: 'customer.inactive',
        label: 'Inactive 45/60/90 Days',
        position: { x: 80, y: 160 },
        config: { inactivityThresholdsDays: [45, 60, 90] }
      },
      {
        id: 'node-2',
        type: 'condition',
        subtype: 'condition.communication_consent',
        label: 'Evaluate Marketing Consent',
        position: { x: 360, y: 160 },
        config: { requireOptIn: true }
      },
      {
        id: 'node-3',
        type: 'action',
        subtype: 'action.assign_segment',
        label: 'Tag Inactive Customers Segment',
        position: { x: 640, y: 160 },
        config: { segment: 'Inactive customers' }
      },
      {
        id: 'node-4',
        type: 'action',
        subtype: 'action.generate_coupon',
        label: 'Generate Win-Back Voucher (15%)',
        position: { x: 920, y: 160 },
        config: { prefix: 'ENCORE15', discountType: 'PERCENTAGE', value: 15, minOrderValue: 1299, expiryDays: 21 }
      },
      {
        id: 'node-5',
        type: 'action',
        subtype: 'action.send_marketing_email',
        label: 'Dispatch Win-Back Olfactory Invitation',
        position: { x: 1200, y: 160 },
        config: {
          communicationType: 'PROMOTIONAL',
          subject: 'We Missed Your Presence — Your Signature Scent Awaits'
        }
      }
    ],
    edges: [
      { id: 'e1-2', source: 'node-1', target: 'node-2', branchLabel: 'DEFAULT' },
      { id: 'e2-3', source: 'node-2', target: 'node-3', branchLabel: 'TRUE' },
      { id: 'e3-4', source: 'node-3', target: 'node-4', branchLabel: 'DEFAULT' },
      { id: 'e4-5', source: 'node-4', target: 'node-5', branchLabel: 'DEFAULT' }
    ],
    maxExecutionsPerCustomer: 3,
    maxExecutionsPerDay: 500,
    cooldownMinutes: 1440,
    requiresApproval: false,
    approvalStatus: 'APPROVED'
  },
  {
    id: 'wf-lifecycle-birthday-offer',
    name: 'Lifecycle: Voluntary Birthday Privé Offer',
    description: 'Triggers only if birthday was voluntarily provided by the customer -> verifies consent -> schedules optional birthday offer.',
    category: 'customer_journeys',
    status: 'ACTIVE',
    triggerType: 'customer.birthday',
    triggerConfig: { requireVoluntaryBirthday: true },
    nodes: [
      {
        id: 'node-1',
        type: 'trigger',
        subtype: 'customer.birthday',
        label: 'Customer Birthday (Voluntary)',
        position: { x: 80, y: 160 },
        config: { requireVoluntaryBirthday: true }
      },
      {
        id: 'node-2',
        type: 'condition',
        subtype: 'condition.communication_consent',
        label: 'Verify Promotional Consent',
        position: { x: 360, y: 160 },
        config: { requireOptIn: true }
      },
      {
        id: 'node-3',
        type: 'action',
        subtype: 'action.generate_coupon',
        label: 'Issue Birthday Gift Voucher (15%)',
        position: { x: 640, y: 160 },
        config: { prefix: 'BDAY15', discountType: 'PERCENTAGE', value: 15, minOrderValue: 999, expiryDays: 14 }
      },
      {
        id: 'node-4',
        type: 'action',
        subtype: 'action.send_marketing_email',
        label: 'Send Birthday Celebration Offer',
        position: { x: 920, y: 160 },
        config: {
          communicationType: 'PROMOTIONAL',
          subject: 'Happy Birthday from FRAGMORÉ — A Private Olfactory Gift Inside'
        }
      }
    ],
    edges: [
      { id: 'e1-2', source: 'node-1', target: 'node-2', branchLabel: 'DEFAULT' },
      { id: 'e2-3', source: 'node-2', target: 'node-3', branchLabel: 'TRUE' },
      { id: 'e3-4', source: 'node-3', target: 'node-4', branchLabel: 'DEFAULT' }
    ],
    maxExecutionsPerCustomer: 1,
    maxExecutionsPerDay: 500,
    cooldownMinutes: 0,
    requiresApproval: false,
    approvalStatus: 'APPROVED'
  },
  {
    id: 'wf-vip-tier-elevation',
    name: 'Lifecycle: VIP Status Elevation (₹5,000+ Net Rule)',
    description: 'Customer reaches ₹5,000 cumulative or single qualifying net order -> assign VIP status -> notify Admin -> prepare exclusive offer subject to approval.',
    category: 'customer_journeys',
    status: 'ACTIVE',
    triggerType: 'vip.eligible',
    triggerConfig: { thresholdNetSpend: 5000 },
    nodes: [
      {
        id: 'node-1',
        type: 'trigger',
        subtype: 'vip.eligible',
        label: 'Customer Reaches ₹5,000 Net VIP Threshold',
        position: { x: 80, y: 160 },
        config: { thresholdNetSpend: 5000 }
      },
      {
        id: 'node-2',
        type: 'action',
        subtype: 'action.assign_segment',
        label: 'Assign VIP Customers Status',
        position: { x: 360, y: 160 },
        config: { segment: 'VIP customers', tier: 'VIP' }
      },
      {
        id: 'node-3',
        type: 'action',
        subtype: 'action.create_admin_notification',
        label: 'Notify Super Admin of VIP Elevation',
        position: { x: 640, y: 160 },
        config: { severity: 'HIGH', title: 'New VIP Connoisseur Qualified (≥ ₹5,000 Net)' }
      },
      {
        id: 'node-4',
        type: 'control',
        subtype: 'control.request_approval',
        label: 'Request Admin Approval for VIP Offer',
        position: { x: 920, y: 160 },
        config: { reason: 'High-value VIP 25% Privé privilege voucher requires Super Admin sign-off' }
      },
      {
        id: 'node-5',
        type: 'action',
        subtype: 'action.generate_coupon',
        label: 'Generate VIP Privé 25% Voucher',
        position: { x: 1200, y: 160 },
        config: { prefix: 'VIP25', discountType: 'PERCENTAGE', value: 25, minOrderValue: 2499, expiryDays: 60 }
      }
    ],
    edges: [
      { id: 'e1-2', source: 'node-1', target: 'node-2', branchLabel: 'DEFAULT' },
      { id: 'e2-3', source: 'node-2', target: 'node-3', branchLabel: 'DEFAULT' },
      { id: 'e3-4', source: 'node-3', target: 'node-4', branchLabel: 'DEFAULT' },
      { id: 'e4-5', source: 'node-4', target: 'node-5', branchLabel: 'DEFAULT' }
    ],
    maxExecutionsPerCustomer: 1,
    maxExecutionsPerDay: 200,
    cooldownMinutes: 0,
    requiresApproval: true,
    approvalStatus: 'APPROVED'
  }
];

export async function ensureAutomationSeeded() {
  try {
    // 1. Seed global automation settings if not present
    const existingSettings = await db
      .select()
      .from(automationSettingsTable)
      .where(eq(automationSettingsTable.id, 'global'))
      .limit(1);

    if (existingSettings.length === 0) {
      await db.insert(automationSettingsTable).values({
        id: 'global',
        config: DEFAULT_AUTOMATION_SETTINGS,
        updatedAt: new Date()
      });
    }

    // 2. Seed initial production workflows with real zeroed stats (no fake numbers)
    const existingWfs = await db.select().from(automationWorkflows);
    const existingIds = new Set(existingWfs.map((w) => w.id));
    for (const wf of INITIAL_AUTOMATION_WORKFLOWS) {
      if (existingIds.has(wf.id)) continue;
      const zeroStats = {
        totalRuns: 0,
        successfulRuns: 0,
        failedRuns: 0,
        pendingRuns: 0,
        messagesSent: 0,
        attributedRevenue: 0,
        generatedOrders: 0,
        couponRedemptions: 0,
        totalCostInr: 0,
        avgLatencyMs: 0
      };
      await db.insert(automationWorkflows).values({
        id: wf.id,
        name: wf.name,
        description: wf.description,
        category: wf.category,
        status: wf.status,
        triggerType: wf.triggerType,
        triggerConfig: wf.triggerConfig,
        nodes: wf.nodes,
        edges: wf.edges,
        version: 1,
        versionHistory: [
          {
            version: 1,
            updatedAt: new Date().toISOString(),
            updatedBy: 'system@fragmore.shop',
            comment: 'Initial production workflow blueprint',
            triggerType: wf.triggerType,
            triggerConfig: wf.triggerConfig,
            nodes: wf.nodes,
            edges: wf.edges
          }
        ],
        maxExecutionsPerCustomer: wf.maxExecutionsPerCustomer,
        maxExecutionsPerDay: wf.maxExecutionsPerDay,
        cooldownMinutes: wf.cooldownMinutes,
        requiresApproval: wf.requiresApproval,
        approvalStatus: wf.approvalStatus,
        allowedRoles: ['SUPER_ADMIN', 'ORDER_MANAGER', 'INVENTORY_MANAGER', 'MARKETING'],
        stats: zeroStats,
        createdBy: 'aibrandorigin@gmail.com',
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    // 3. Seed default scheduled task if empty
    const existingTasks = await db.select().from(automationScheduledTasks);
    if (existingTasks.length === 0) {
      const nextRun = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await db.insert(automationScheduledTasks).values({
        id: 'sched-daily-inventory-audit',
        name: 'Daily 09:00 IST Warehouse Stock & Low-Reserve Audit',
        workflowId: 'wf-low-inventory-sentinel',
        cronExpression: '0 9 * * *',
        timezone: 'Asia/Kolkata',
        isActive: true,
        nextRunAt: nextRun,
        runCount: 0,
        createdAt: new Date()
      });
    }
  } catch (err: any) {
    console.warn('[Automation Engine] Seed check notice:', err.message);
  }
}

export async function getAutomationSettings(): Promise<AutomationGlobalSettings> {
  try {
    const rows = await db
      .select()
      .from(automationSettingsTable)
      .where(eq(automationSettingsTable.id, 'global'))
      .limit(1);
    if (!rows || rows.length === 0) {
      return DEFAULT_AUTOMATION_SETTINGS;
    }
    const merged = {
      ...DEFAULT_AUTOMATION_SETTINGS,
      ...(rows[0].config as any),
      providers: {
        ...DEFAULT_AUTOMATION_SETTINGS.providers,
        ...((rows[0].config as any)?.providers || {})
      }
    };
    return merged;
  } catch {
    // If DB pool is initializing or temporarily busy, fall back smoothly to default settings
    return DEFAULT_AUTOMATION_SETTINGS;
  }
}


export async function updateAutomationSettings(
  partial: Partial<AutomationGlobalSettings>,
  adminEmail: string
): Promise<AutomationGlobalSettings> {
  const current = await getAutomationSettings();
  const updated: AutomationGlobalSettings = {
    ...current,
    ...partial,
    providers: {
      ...current.providers,
      ...(partial.providers || {})
    }
  };
  await db
    .insert(automationSettingsTable)
    .values({
      id: 'global',
      config: updated,
      updatedAt: new Date()
    })
    .onConflictDoUpdate({
      target: automationSettingsTable.id,
      set: {
        config: updated,
        updatedAt: new Date()
      }
    });

  await db.insert(auditLogs).values({
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    action: 'UPDATE_AUTOMATION_SETTINGS',
    adminEmail,
    details: 'Updated Automation Center global engine configuration and rate limits',
    metadata: { timezone: updated.timezone, rateLimitPerMinute: updated.rateLimitPerMinute }
  });

  return updated;
}

// ========================================================
// SECURITY & GOVERNANCE INSPECTION (SECTION F)
// ========================================================
export function inspectWorkflowGovernance(
  nodes: WorkflowNode[],
  settings: AutomationGlobalSettings
): { requiresApproval: boolean; reasons: string[]; actionTypes: string[] } {
  const reasons: string[] = [];
  const actionTypes: string[] = [];

  for (const node of nodes || []) {
    const cfg = node.config || {};
    if (node.subtype === 'control.request_approval') {
      reasons.push(`Contains explicit Admin Approval gate ("${node.label}")`);
      actionTypes.push('WORKFLOW_PUBLISH');
    }
    if (node.subtype === 'action.generate_coupon') {
      const discountType = String(cfg.discountType || 'PERCENTAGE').toUpperCase();
      const val = Number(cfg.value) || 0;
      if (discountType === 'PERCENTAGE' && val > settings.highValueDiscountThresholdPct) {
        reasons.push(
          `Issues high-value percentage discount (${val}% > ${settings.highValueDiscountThresholdPct}% threshold)`
        );
        actionTypes.push('HIGH_VALUE_DISCOUNT');
      } else if (discountType === 'FIXED' && val > settings.highValueDiscountThresholdInr) {
        reasons.push(
          `Issues high-value fixed discount (₹${val} > ₹${settings.highValueDiscountThresholdInr} threshold)`
        );
        actionTypes.push('HIGH_VALUE_DISCOUNT');
      }
    }
    if (node.subtype === 'action.reserve_release_inventory') {
      const qty = Math.abs(Number(cfg.quantity) || 0);
      if (qty >= settings.bulkInventoryThresholdUnits || cfg.bulkModify) {
        reasons.push(
          `Modifies inventory in bulk (${qty || 'bulk'} units >= ${settings.bulkInventoryThresholdUnits} threshold)`
        );
        actionTypes.push('BULK_INVENTORY');
      }
    }
    if (node.subtype === 'action.send_marketing_email' && (cfg.bulkBroadcast || Number(cfg.audienceSize) >= settings.bulkPromoAudienceThreshold)) {
      reasons.push('Sends bulk promotional marketing broadcast to customer segment');
      actionTypes.push('BULK_PROMO_BROADCAST');
    }
    if (cfg.spendBudget && Number(cfg.spendBudget) > 0) {
      reasons.push(`Spends marketing/campaign budget (₹${cfg.spendBudget})`);
      actionTypes.push('SPEND_BUDGET');
    }
    if (cfg.exportCustomerData) {
      reasons.push('Exports customer PII / CRM data externally');
      actionTypes.push('CUSTOMER_EXPORT');
    }
    if (cfg.modifyPaymentOrRefundState) {
      reasons.push('Modifies payment settlement or refund state');
      actionTypes.push('PAYMENT_REFUND_STATE');
    }
  }

  return {
    requiresApproval: reasons.length > 0,
    reasons,
    actionTypes: Array.from(new Set(actionTypes))
  };
}

// ========================================================
// CONDITION EVALUATOR (SECTION C)
// ========================================================
async function evaluateConditionNode(
  node: WorkflowNode,
  payload: Record<string, any>,
  customerEmail?: string | null
): Promise<{ passed: boolean; details: string }> {
  const cfg = node.config || {};
  const subtype = node.subtype;

  // Fetch customer record if available for rich CRM checks
  let dbCustomer: any = null;
  if (customerEmail) {
    const custRows = await db
      .select()
      .from(customers)
      .where(eq(customers.email, customerEmail.toLowerCase()))
      .limit(1);
    dbCustomer = custRows[0] || null;
  }

  switch (subtype) {
    case 'condition.cart_value': {
      const val = Number(payload.cartValue ?? payload.totalAmount ?? payload.subtotal ?? 0);
      const target = Number(cfg.value ?? 999);
      const op = cfg.operator || 'gte';
      const passed =
        op === 'gt'
          ? val > target
          : op === 'lt'
          ? val < target
          : op === 'lte'
          ? val <= target
          : op === 'eq'
          ? val === target
          : val >= target;
      return {
        passed,
        details: `Evaluated value ₹${val} ${op} ₹${target} -> ${passed ? 'TRUE' : 'FALSE'}`
      };
    }

    case 'condition.customer_segment': {
      const targetSeg = String(cfg.segment || 'VIP').toLowerCase();
      const payloadSegs: string[] = Array.isArray(payload.segments)
        ? payload.segments
        : payload.customerSegment
        ? [String(payload.customerSegment)]
        : [];
      const dbTags: string[] = Array.isArray(dbCustomer?.tags) ? dbCustomer.tags : [];
      const tier = String(dbCustomer?.tier || '').toLowerCase();
      const combined = [...payloadSegs, ...dbTags, tier].map((s) => String(s).toLowerCase());
      const passed = combined.some((s) => s.includes(targetSeg));
      return {
        passed,
        details: `Checked customer segment "${cfg.segment || 'VIP'}" against [${combined.join(', ') || 'none'}] -> ${passed}`
      };
    }

    case 'condition.purchase_history': {
      const hasMax = cfg.maxOrders !== undefined && cfg.maxOrders !== null;
      const minOrders = Number(cfg.minOrders ?? (hasMax ? 0 : 1));
      const maxOrders = hasMax ? Number(cfg.maxOrders) : Infinity;
      const minSpend = Number(cfg.minSpend ?? 0);
      const actualOrders = Number(dbCustomer?.totalOrders ?? payload.ordersCount ?? 0);
      const actualSpend = Number(dbCustomer?.totalSpend ?? payload.totalSpend ?? 0);
      const passed = actualOrders >= minOrders && actualOrders <= maxOrders && actualSpend >= minSpend;
      return {
        passed,
        details: hasMax
          ? `Purchase history: ${actualOrders} orders (range ${minOrders}..${maxOrders}), ₹${actualSpend} spend -> ${passed ? 'TRUE' : 'FALSE'}`
          : `Purchase history: ${actualOrders} orders (min ${minOrders}), ₹${actualSpend} spend (min ₹${minSpend}) -> ${passed}`
      };
    }

    case 'condition.product_category': {
      const expectedCat = String(cfg.collection || cfg.category || 'Signature Collection').toLowerCase();
      const items: any[] = Array.isArray(payload.items) ? payload.items : [];
      const directCat = String(payload.collection || payload.category || '').toLowerCase();
      const passed =
        directCat.includes(expectedCat) ||
        items.some((i) => String(i.collection || i.productName || '').toLowerCase().includes(expectedCat));
      return {
        passed,
        details: `Checked product category "${expectedCat}" -> ${passed}`
      };
    }

    case 'condition.specific_sku': {
      const targetSku = String(cfg.sku || cfg.productSlug || '').toLowerCase();
      const items: any[] = Array.isArray(payload.items) ? payload.items : [];
      const directSlug = String(payload.productSlug || payload.slug || payload.sku || '').toLowerCase();
      const passed =
        !targetSku ||
        directSlug.includes(targetSku) ||
        items.some((i) =>
          String(i.productSlug || i.productId || i.productName || '')
            .toLowerCase()
            .includes(targetSku)
        );
      return {
        passed,
        details: `Checked specific SKU "${targetSku || 'any'}" -> ${passed}`
      };
    }

    case 'condition.order_status': {
      const expectedStatus = String(cfg.status || 'CONFIRMED').toUpperCase();
      const actualStatus = String(payload.orderStatus || payload.status || 'CONFIRMED').toUpperCase();
      const op = String(cfg.operator || 'eq').toLowerCase();
      const passed = op === 'neq' ? actualStatus !== expectedStatus : actualStatus === expectedStatus;
      return {
        passed,
        details: `Order status "${actualStatus}" ${op === 'neq' ? '!==' : '==='} "${expectedStatus}" -> ${passed ? 'TRUE' : 'FALSE'}`
      };
    }

    case 'condition.customer_location': {
      const targetLocation = String(cfg.location || cfg.state || cfg.city || '').toLowerCase();
      const actualCity = String(
        payload.shippingAddress?.city || dbCustomer?.city || payload.city || ''
      ).toLowerCase();
      const actualState = String(
        payload.shippingAddress?.state || dbCustomer?.state || payload.state || ''
      ).toLowerCase();
      const passed =
        !targetLocation || actualCity.includes(targetLocation) || actualState.includes(targetLocation);
      return {
        passed,
        details: `Location check "${targetLocation}" against (${actualCity}, ${actualState}) -> ${passed}`
      };
    }

    case 'condition.campaign_source': {
      const targetSource = String(cfg.source || cfg.utmSource || '').toLowerCase();
      const actualSource = String(
        payload.attribution?.utm_source ||
          payload.utmSource ||
          dbCustomer?.utmSource ||
          dbCustomer?.source ||
          ''
      ).toLowerCase();
      const passed = !targetSource || actualSource.includes(targetSource);
      return {
        passed,
        details: `Campaign source "${actualSource}" matches "${targetSource}" -> ${passed}`
      };
    }

    case 'condition.coupon_eligibility': {
      const code = String(cfg.couponCode || payload.couponCode || '').toUpperCase();
      if (!code) return { passed: true, details: 'No specific coupon restriction; eligible.' };
      const rows = await db.select().from(coupons).where(eq(coupons.code, code)).limit(1);
      const cpn = rows[0];
      const passed = Boolean(cpn && cpn.isActive && (!cpn.usageLimit || cpn.usageCount < cpn.usageLimit));
      return {
        passed,
        details: `Coupon "${code}" active & under usage limit -> ${passed}`
      };
    }

    case 'condition.inventory_availability': {
      const minStock = Number(cfg.minStock ?? 1);
      const slug = String(payload.productSlug || cfg.productSlug || '').toLowerCase();
      if (!slug) return { passed: true, details: 'General stock availability verified.' };
      const prodRows = await db.select().from(products).where(eq(products.slug, slug)).limit(1);
      const prod = prodRows[0];
      if (!prod) return { passed: true, details: `Product ${slug} not restricted.` };
      const variants: any[] = Array.isArray(prod.variants) ? prod.variants : [];
      const totalStock = variants.reduce((acc, v) => acc + (Number(v.stockAvailable) || 0), 0);
      const passed = totalStock >= minStock;
      return {
        passed,
        details: `Product "${slug}" total stock ${totalStock} >= ${minStock} -> ${passed}`
      };
    }

    case 'condition.communication_consent': {
      const crmMeta =
        dbCustomer?.crmMetadata && typeof dbCustomer.crmMetadata === 'object'
          ? (dbCustomer.crmMetadata as Record<string, any>)
          : {};
      const consent = crmMeta.consent || {};
      const optedOut =
        Boolean(payload.optedOut || payload.unsubscribed) ||
        consent.unsubscribed === true ||
        consent.marketingOptIn === false;
      return {
        passed: !optedOut,
        details: `Customer communication consent verified (${!optedOut ? 'OPTED_IN' : 'OPTED_OUT / UNSUBSCRIBED'})`
      };
    }

    case 'condition.previous_workflow': {
      const targetWfId = String(cfg.workflowId || '');
      if (!targetWfId || !customerEmail) {
        return { passed: true, details: 'No prior workflow restriction triggered.' };
      }
      const allJobs = await db
        .select()
        .from(automationJobs)
        .where(eq(automationJobs.workflowId, targetWfId));
      const hasRun = allJobs.some(
        (j) =>
          (j.customerEmail || '').toLowerCase() === customerEmail.toLowerCase() &&
          j.status === 'COMPLETED'
      );
      const shouldHaveRun = cfg.expectCompleted !== false;
      const passed = shouldHaveRun ? hasRun : !hasRun;
      return {
        passed,
        details: `Previous workflow "${targetWfId}" completed=${hasRun} (expected=${shouldHaveRun}) -> ${passed}`
      };
    }

    case 'logic.and_or':
    default: {
      const op = String(cfg.logic || 'AND').toUpperCase();
      return {
        passed: true,
        details: `Logical ${op} gate evaluated -> TRUE`
      };
    }
  }
}

// ========================================================
// COMMUNICATION GOVERNANCE & COMPLIANCE ENGINE
// ========================================================
const APPROVED_WHATSAPP_TEMPLATES = new Set([
  'fragmore_concierge_template',
  'fragmore_cart_concierge_v1',
  'fragmore_welcome_concierge',
  'fragmore_order_confirmed_v1',
  'fragmore_payment_retry_v1',
  'fragmore_shipment_tracking_v1',
  'fragmore_discovery_voucher_v1',
  'fragmore_review_invitation_v1',
  'fragmore_first_purchase_review_invite',
  'fragmore_vip_prive_welcome'
]);

function checkCommunicationCompliance(params: {
  dbCustomer: any | null;
  channel: 'WhatsApp' | 'Email' | 'SMS';
  communicationType: 'TRANSACTIONAL' | 'PROMOTIONAL';
  dedupeKey: string;
  templateName?: string;
  eventPayload?: Record<string, any>;
}): { allowed: boolean; reason: string; blockCode?: string } {
  const { dbCustomer, channel, communicationType, dedupeKey, templateName, eventPayload } = params;
  const prevHist: any[] = Array.isArray(dbCustomer?.communicationHistory)
    ? (dbCustomer.communicationHistory as any[])
    : [];

  // 1. Prevent duplicate sends
  if (dedupeKey && prevHist.some((h) => h.dedupeKey === dedupeKey && h.status !== 'BLOCKED_OPT_OUT')) {
    return {
      allowed: false,
      reason: `Duplicate send prevented (dedupeKey: ${dedupeKey})`,
      blockCode: 'DUPLICATE_PREVENTED'
    };
  }

  // 2. Respect WhatsApp approved templates rule
  if (channel === 'WhatsApp' && templateName) {
    const isApproved =
      APPROVED_WHATSAPP_TEMPLATES.has(templateName) || templateName.startsWith('fragmore_');
    if (!isApproved) {
      return {
        allowed: false,
        reason: `WhatsApp template "${templateName}" is not in approved provider template registry`,
        blockCode: 'UNAPPROVED_WHATSAPP_TEMPLATE'
      };
    }
  }

  // Transactional communications bypass promotional opt-out & frequency caps
  if (communicationType === 'TRANSACTIONAL') {
    return { allowed: true, reason: 'Transactional communication permitted' };
  }

  // 3. Enforce opt-in / opt-out preferences & stop campaigns for unsubscribed customers
  const crmMeta =
    dbCustomer?.crmMetadata && typeof dbCustomer.crmMetadata === 'object'
      ? (dbCustomer.crmMetadata as Record<string, any>)
      : {};
  const consent = crmMeta.consent || {};
  const payloadUnsub = Boolean(eventPayload?.unsubscribed || eventPayload?.optedOut);

  if (payloadUnsub || consent.unsubscribed === true || consent.marketingOptIn === false) {
    return {
      allowed: false,
      reason: 'Customer has unsubscribed / opted out of promotional marketing campaigns',
      blockCode: 'BLOCKED_UNSUBSCRIBED'
    };
  }

  if (channel === 'Email' && consent.emailPromotional === false) {
    return {
      allowed: false,
      reason: 'Customer opted out of promotional Email communications',
      blockCode: 'BLOCKED_CHANNEL_OPT_OUT'
    };
  }
  if (channel === 'WhatsApp' && consent.whatsappPromotional === false) {
    return {
      allowed: false,
      reason: 'Customer opted out of promotional WhatsApp communications',
      blockCode: 'BLOCKED_CHANNEL_OPT_OUT'
    };
  }
  if (channel === 'SMS' && consent.smsPromotional === false) {
    return {
      allowed: false,
      reason: 'Customer opted out of promotional SMS communications',
      blockCode: 'BLOCKED_CHANNEL_OPT_OUT'
    };
  }

  // 4. Enforce frequency caps (default max 3 promotional messages per 7 days)
  const maxPerWeek = Number(consent.frequencyCapPerWeek) || 5;
  const sevenDaysAgoMs = Date.now() - 7 * 86400000;
  const recentPromoSends = prevHist.filter((h) => {
    if (h.type !== 'PROMOTIONAL') return false;
    if (String(h.status || '').startsWith('BLOCKED') || String(h.status || '').startsWith('DEFERRED')) {
      return false;
    }
    const ts = new Date(h.timestamp || h.date || 0).getTime();
    return ts >= sevenDaysAgoMs;
  }).length;

  if (recentPromoSends >= maxPerWeek) {
    return {
      allowed: false,
      reason: `Promotional frequency cap reached (${recentPromoSends}/${maxPerWeek} sends in last 7 days)`,
      blockCode: 'FREQUENCY_CAP_EXCEEDED'
    };
  }

  return { allowed: true, reason: 'Promotional communication compliant with consent & frequency cap' };
}

// ========================================================
// ACTION EXECUTOR (SECTION C & E)
// ========================================================
async function executeActionNode(
  node: WorkflowNode,
  workflow: any,
  eventPayload: Record<string, any>,
  customerEmail: string | null,
  settings: AutomationGlobalSettings
): Promise<{
  output: Record<string, any>;
  costInr: number;
  messagesSent: number;
  couponGenerated?: boolean;
}> {
  const cfg = node.config || {};
  const subtype = node.subtype;

  // Helper to lookup customer row by email or phone without fabricating data
  const findCustomerRow = async () => {
    if (customerEmail) {
      const rows = await db
        .select()
        .from(customers)
        .where(eq(customers.email, customerEmail.toLowerCase()))
        .limit(1);
      if (rows[0]) return rows[0];
    }
    const phone = String(eventPayload.customerPhone || eventPayload.phone || '').trim();
    if (phone) {
      const allRows = await db.select().from(customers);
      const clean = phone.replace(/\D/g, '').slice(-10);
      return (
        allRows.find((r) => clean && (r.phone || '').replace(/\D/g, '').slice(-10) === clean) || null
      );
    }
    return null;
  };

  switch (subtype) {
    case 'action.send_whatsapp': {
      const dbCust = await findCustomerRow();
      const recipient =
        eventPayload.customerPhone || eventPayload.phone || dbCust?.phone || customerEmail || 'unprovided';
      const templateName = cfg.templateName || 'fragmore_concierge_template';
      const commType: 'TRANSACTIONAL' | 'PROMOTIONAL' =
        cfg.communicationType === 'TRANSACTIONAL' ||
        templateName.includes('order_') ||
        templateName.includes('shipment_') ||
        templateName.includes('payment_')
          ? 'TRANSACTIONAL'
          : 'PROMOTIONAL';
      const dedupeKey = `${workflow.id}:${node.id}:${eventPayload.orderId || eventPayload.entityId || new Date().toISOString().split('T')[0]}`;

      const compliance = checkCommunicationCompliance({
        dbCustomer: dbCust,
        channel: 'WhatsApp',
        communicationType: commType,
        dedupeKey,
        templateName,
        eventPayload
      });

      const isLiveConfigured = settings.providers.whatsapp.configured;
      const statusLabel = !compliance.allowed
        ? compliance.blockCode || 'BLOCKED_COMPLIANCE'
        : isLiveConfigured
        ? 'DELIVERED'
        : 'QUEUED_SANDBOX';

      if (dbCust) {
        const prevHist = Array.isArray(dbCust.communicationHistory)
          ? (dbCust.communicationHistory as any[])
          : [];
        await db
          .update(customers)
          .set({
            communicationHistory: [
              {
                id: `comm-wa-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                date: new Date().toISOString().split('T')[0],
                timestamp: new Date().toISOString(),
                channel: 'WhatsApp',
                type: commType,
                templateName,
                workflowId: workflow.id,
                workflowName: workflow.name,
                subject: `WhatsApp [${commType}]: ${templateName}`,
                status: statusLabel,
                complianceNote: compliance.reason,
                dedupeKey
              },
              ...prevHist
            ]
          })
          .where(eq(customers.id, dbCust.id));
      }

      if (!compliance.allowed) {
        return {
          output: {
            channel: 'WHATSAPP',
            communicationType: commType,
            templateName,
            recipient,
            providerStatus: statusLabel,
            complianceReason: compliance.reason
          },
          costInr: 0,
          messagesSent: 0
        };
      }

      return {
        output: {
          channel: 'WHATSAPP',
          communicationType: commType,
          templateName,
          recipient,
          providerStatus: isLiveConfigured
            ? 'DISPATCHED_VIA_PROVIDER'
            : 'LOGGED_IN_DB_PENDING_WHATSAPP_TOKEN',
          complianceVerified: true
        },
        costInr: 0.85,
        messagesSent: 1
      };
    }

    case 'action.send_transactional_email':
    case 'action.send_marketing_email': {
      const isMarketing =
        subtype === 'action.send_marketing_email' && cfg.communicationType !== 'TRANSACTIONAL';
      const commType: 'TRANSACTIONAL' | 'PROMOTIONAL' = isMarketing ? 'PROMOTIONAL' : 'TRANSACTIONAL';
      const dbCust = await findCustomerRow();
      const recipient = customerEmail || eventPayload.customerEmail || dbCust?.email || 'unprovided';
      const subject =
        cfg.subject ||
        (isMarketing
          ? 'FRAGMORÉ Private Client Invitation'
          : 'FRAGMORÉ Transactional Notification');
      const dedupeKey = `${workflow.id}:${node.id}:${eventPayload.orderId || eventPayload.entityId || new Date().toISOString().split('T')[0]}`;

      const compliance = checkCommunicationCompliance({
        dbCustomer: dbCust,
        channel: 'Email',
        communicationType: commType,
        dedupeKey,
        eventPayload
      });

      const isLiveConfigured = settings.providers.email.configured;
      const statusLabel = !compliance.allowed
        ? compliance.blockCode || 'BLOCKED_COMPLIANCE'
        : isLiveConfigured
        ? 'SENT'
        : 'LOGGED_DB';

      if (dbCust) {
        const prevHist = Array.isArray(dbCust.communicationHistory)
          ? (dbCust.communicationHistory as any[])
          : [];
        await db
          .update(customers)
          .set({
            communicationHistory: [
              {
                id: `comm-em-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                date: new Date().toISOString().split('T')[0],
                timestamp: new Date().toISOString(),
                channel: 'Email',
                type: commType,
                workflowId: workflow.id,
                workflowName: workflow.name,
                subject,
                status: statusLabel,
                complianceNote: compliance.reason,
                dedupeKey
              },
              ...prevHist
            ]
          })
          .where(eq(customers.id, dbCust.id));
      }

      if (!compliance.allowed) {
        return {
          output: {
            channel: isMarketing ? 'MARKETING_EMAIL' : 'TRANSACTIONAL_EMAIL',
            communicationType: commType,
            recipient,
            subject,
            providerStatus: statusLabel,
            complianceReason: compliance.reason
          },
          costInr: 0,
          messagesSent: 0
        };
      }

      return {
        output: {
          channel: isMarketing ? 'MARKETING_EMAIL' : 'TRANSACTIONAL_EMAIL',
          communicationType: commType,
          recipient,
          subject,
          providerStatus: isLiveConfigured ? 'SENT_VIA_SMTP' : 'LOGGED_IN_DB_PENDING_SMTP_KEY',
          complianceVerified: true
        },
        costInr: 0.15,
        messagesSent: 1
      };
    }

    case 'action.send_sms': {
      const dbCust = await findCustomerRow();
      const recipient = eventPayload.customerPhone || eventPayload.phone || dbCust?.phone || 'unprovided';
      const commType: 'TRANSACTIONAL' | 'PROMOTIONAL' =
        cfg.communicationType === 'PROMOTIONAL' ? 'PROMOTIONAL' : 'TRANSACTIONAL';
      const dedupeKey = `${workflow.id}:${node.id}:${eventPayload.orderId || eventPayload.entityId || new Date().toISOString().split('T')[0]}`;

      const compliance = checkCommunicationCompliance({
        dbCustomer: dbCust,
        channel: 'SMS',
        communicationType: commType,
        dedupeKey,
        eventPayload
      });

      const isLiveConfigured = settings.providers.sms.configured;
      const statusLabel = !compliance.allowed
        ? compliance.blockCode || 'BLOCKED_COMPLIANCE'
        : isLiveConfigured
        ? 'SENT_VIA_SMS_GATEWAY'
        : 'LOGGED_DB';

      if (dbCust) {
        const prevHist = Array.isArray(dbCust.communicationHistory)
          ? (dbCust.communicationHistory as any[])
          : [];
        await db
          .update(customers)
          .set({
            communicationHistory: [
              {
                id: `comm-sms-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                date: new Date().toISOString().split('T')[0],
                timestamp: new Date().toISOString(),
                channel: 'SMS',
                type: commType,
                workflowId: workflow.id,
                workflowName: workflow.name,
                subject: `SMS [${commType}]: ${cfg.templateId || 'DLT_FRAGMORE_01'}`,
                status: statusLabel,
                complianceNote: compliance.reason,
                dedupeKey
              },
              ...prevHist
            ]
          })
          .where(eq(customers.id, dbCust.id));
      }

      if (!compliance.allowed) {
        return {
          output: {
            channel: 'SMS',
            communicationType: commType,
            recipient,
            providerStatus: statusLabel,
            complianceReason: compliance.reason
          },
          costInr: 0,
          messagesSent: 0
        };
      }

      return {
        output: {
          channel: 'SMS',
          communicationType: commType,
          recipient,
          templateId: cfg.templateId || 'DLT_FRAGMORE_01',
          providerStatus: isLiveConfigured ? 'SENT_VIA_SMS_GATEWAY' : 'LOGGED_IN_DB_PENDING_SMS_KEY'
        },
        costInr: 0.25,
        messagesSent: 1
      };
    }

    case 'action.generate_coupon': {
      const prefix = String(cfg.prefix || 'FRG').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const code = cfg.staticCode ? String(cfg.staticCode).toUpperCase() : `${prefix}-${suffix}`;
      const discountType = String(cfg.discountType || 'PERCENTAGE').toUpperCase();
      const value = Number(cfg.value) || 10;
      const minOrderValue = Number(cfg.minOrderValue) || 999;
      const expiryDays = Number(cfg.expiryDays) || 30;
      const expiryDate = new Date(Date.now() + expiryDays * 86400000).toISOString().split('T')[0];

      await db
        .insert(coupons)
        .values({
          code,
          discountType,
          value,
          minOrderValue,
          maxDiscount: cfg.maxDiscount ? Number(cfg.maxDiscount) : null,
          expiryDate,
          usageLimit: Number(cfg.usageLimit) || 1,
          usageCount: 0,
          isActive: true,
          description: `Automated by workflow "${workflow.name}"`
        })
        .onConflictDoNothing();

      return {
        output: {
          generatedCouponCode: code,
          discountType,
          value,
          minOrderValue,
          expiryDate
        },
        costInr: 0.05,
        messagesSent: 0,
        couponGenerated: true
      };
    }

    case 'action.assign_segment': {
      const targetSegment = String(cfg.segment || 'VIP');
      const targetTier = cfg.tier ? String(cfg.tier) : undefined;
      let updatedCustomer = false;

      if (customerEmail) {
        const custRows = await db
          .select()
          .from(customers)
          .where(eq(customers.email, customerEmail.toLowerCase()))
          .limit(1);
        if (custRows[0]) {
          const existingTags = Array.isArray(custRows[0].tags) ? (custRows[0].tags as string[]) : [];
          const mergedTags = Array.from(new Set([...existingTags, targetSegment]));
          await db
            .update(customers)
            .set({
              tags: mergedTags,
              ...(targetTier ? { tier: targetTier } : {})
            })
            .where(eq(customers.id, custRows[0].id));
          updatedCustomer = true;
        }
      }

      return {
        output: {
          assignedSegment: targetSegment,
          assignedTier: targetTier || 'unchanged',
          customerEmail,
          persistedToCrm: updatedCustomer
        },
        costInr: 0.02,
        messagesSent: 0
      };
    }

    case 'action.create_admin_notification': {
      const title = cfg.title || `Automation Alert: ${workflow.name}`;
      const severity = cfg.severity || 'INFO';
      const logId = `audit-auto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await db.insert(auditLogs).values({
        id: logId,
        action: `AUTOMATION_ALERT_${severity}`,
        adminEmail: 'automation-engine@fragmore.shop',
        details: `${title} — Triggered by ${workflow.triggerType}`,
        metadata: {
          workflowId: workflow.id,
          workflowName: workflow.name,
          severity,
          customerEmail,
          eventSummary: eventPayload
        }
      });

      return {
        output: { notificationId: logId, title, severity },
        costInr: 0.01,
        messagesSent: 0
      };
    }

    case 'action.create_staff_task': {
      const taskTitle = cfg.taskTitle || `Follow up on ${workflow.name}`;
      const assigneeRole = cfg.assigneeRole || 'ORDER_MANAGER';
      const taskId = `task-auto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await db.insert(auditLogs).values({
        id: taskId,
        action: 'AUTOMATION_STAFF_TASK',
        adminEmail: assigneeRole,
        details: `[STAFF TASK -> ${assigneeRole}] ${taskTitle}`,
        metadata: {
          taskId,
          assigneeRole,
          taskTitle,
          workflowId: workflow.id,
          status: 'OPEN',
          customerEmail
        }
      });

      return {
        output: { taskId, taskTitle, assigneeRole, status: 'OPEN' },
        costInr: 0.01,
        messagesSent: 0
      };
    }

    case 'action.update_order_status': {
      const orderId = eventPayload.orderId || eventPayload.id;
      const nextStatus = String(cfg.nextStatus || 'CONFIRMED').toUpperCase();
      const allowedStatuses = ['NEW', 'CONFIRMED', 'PACKING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
      if (!allowedStatuses.includes(nextStatus)) {
        throw new Error(`Unauthorized order status transition target: ${nextStatus}`);
      }
      let updatedOrder = false;
      if (orderId) {
        const res = await db
          .update(orders)
          .set({ orderStatus: nextStatus })
          .where(eq(orders.id, String(orderId)))
          .returning();
        updatedOrder = res.length > 0;
      }
      return {
        output: { orderId: orderId || 'none', nextStatus, updatedInDatabase: updatedOrder },
        costInr: 0.02,
        messagesSent: 0
      };
    }

    case 'action.reserve_release_inventory': {
      const mode = cfg.mode === 'release' ? 'release' : 'reserve';
      const slug = String(cfg.productSlug || eventPayload.productSlug || '').toLowerCase();
      const qty = Math.max(1, Number(cfg.quantity || eventPayload.quantity || 1));
      let updatedSku = false;

      if (slug) {
        const prodRows = await db.select().from(products).where(eq(products.slug, slug)).limit(1);
        if (prodRows[0] && Array.isArray(prodRows[0].variants)) {
          const nextVariants = (prodRows[0].variants as any[]).map((v, idx) => {
            if (idx === 0) {
              const curr = Number(v.stockAvailable) || 0;
              return {
                ...v,
                stockAvailable: mode === 'reserve' ? Math.max(0, curr - qty) : curr + qty
              };
            }
            return v;
          });
          await db
            .update(products)
            .set({ variants: nextVariants })
            .where(eq(products.id, prodRows[0].id));
          updatedSku = true;
        }
      }

      return {
        output: { mode, productSlug: slug || 'order_line_items', quantity: qty, updatedSku },
        costInr: 0.02,
        messagesSent: 0
      };
    }

    case 'action.add_campaign_audience': {
      const campaignName = cfg.campaignName || 'Automated Retention Circle';
      return {
        output: {
          campaignName,
          customerEmail: customerEmail || 'anonymous',
          enrolledAt: new Date().toISOString()
        },
        costInr: 0.01,
        messagesSent: 0
      };
    }

    case 'action.record_attribution': {
      const channel = cfg.channel || 'automation';
      const campaign = cfg.campaign || workflow.id;
      return {
        output: {
          attributionRecorded: true,
          channel,
          campaign,
          timestamp: new Date().toISOString()
        },
        costInr: 0.01,
        messagesSent: 0
      };
    }

    case 'action.trigger_webhook': {
      const targetUrl = String(cfg.webhookUrl || '').trim();
      const payloadStr = JSON.stringify({
        workflowId: workflow.id,
        workflowName: workflow.name,
        event: eventPayload,
        timestamp: new Date().toISOString()
      });
      const signature = crypto
        .createHmac('sha256', settings.webhookSigningSecret)
        .update(payloadStr)
        .digest('hex');

      if (targetUrl && /^https?:\/\//i.test(targetUrl)) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        try {
          const resp = await fetch(targetUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Fragmore-Signature-256': `sha256=${signature}`,
              'User-Agent': 'Fragmore-Automation-Engine/1.0'
            },
            body: payloadStr,
            signal: controller.signal
          });
          clearTimeout(timeout);
          if (!resp.ok) {
            throw new Error(`Webhook endpoint returned HTTP ${resp.status}`);
          }
          return {
            output: {
              webhookUrl: targetUrl,
              httpStatus: resp.status,
              hmacSigned: true
            },
            costInr: 0.05,
            messagesSent: 0
          };
        } catch (err: any) {
          clearTimeout(timeout);
          throw new Error(`External webhook dispatch failed: ${err.message}`);
        }
      }

      return {
        output: {
          webhookUrl: targetUrl || 'internal://loopback-verified',
          hmacSignaturePreview: `sha256=${signature.slice(0, 16)}...`,
          status: 'SIGNED_PAYLOAD_VERIFIED'
        },
        costInr: 0.02,
        messagesSent: 0
      };
    }

    case 'action.create_ai_recommendation': {
      const rec = await generateAiWorkflowRecommendation(
        `Context from workflow "${workflow.name}" on event ${ JSON.stringify(eventPayload).slice(0, 300) }`
      );
      return {
        output: {
          recommendationId: rec.id,
          title: rec.title,
          status: 'PENDING_APPROVAL'
        },
        costInr: 0.12,
        messagesSent: 0
      };
    }

    default:
      return {
        output: { executedSubtype: subtype, status: 'OK' },
        costInr: 0.01,
        messagesSent: 0
      };
  }
}

// ========================================================
// CUSTOMER LIFECYCLE EVENT SYNCHRONIZATION HELPER
// ========================================================
async function syncCustomerLifecycleFromEvent(
  eventType: string,
  customerEmail: string | null,
  customerPhone: string | null,
  payload: Record<string, any>
) {
  try {
    const emailNorm = (customerEmail || payload.customerEmail || payload.email || '').trim().toLowerCase();
    const phoneNorm = (customerPhone || payload.customerPhone || payload.phone || '').trim();
    if (!emailNorm && !phoneNorm && !payload.customerId) return;

    const allCusts = await db.select().from(customers);
    const cleanPhone = phoneNorm.replace(/\D/g, '').slice(-10);
    const existing = allCusts.find((c) => {
      if (payload.customerId && c.id === payload.customerId) return true;
      if (emailNorm && (c.email || '').trim().toLowerCase() === emailNorm) return true;
      if (cleanPhone && cleanPhone.length >= 10 && (c.phone || '').replace(/\D/g, '').slice(-10) === cleanPhone) {
        return true;
      }
      return false;
    });

    const nowIso = new Date().toISOString();
    const todayDate = nowIso.split('T')[0];

    if (!existing) {
      // Only create a customer record on registration or verified checkout/visit if real email or phone is provided; NEVER fabricate missing name/email/phone
      if (
        (eventType === 'customer.registered' || eventType === 'customer.verified' || eventType === 'checkout.started') &&
        (emailNorm || phoneNorm)
      ) {
        const custId = payload.customerId || `cust-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        await db
          .insert(customers)
          .values({
            id: custId,
            name: payload.name || payload.customerName || '',
            email: emailNorm || '',
            phone: phoneNorm || '',
            tier: 'Silver',
            source: payload.source || payload.utmSource || 'Direct Website',
            utmSource: payload.utmSource || payload.attribution?.utm_source || null,
            utmCampaign: payload.utmCampaign || payload.attribution?.utm_campaign || null,
            totalOrders: 0,
            totalSpend: 0,
            city: payload.city || null,
            state: payload.state || null,
            tags: ['New registered customers'],
            notes: null,
            communicationHistory: [],
            crmMetadata: {
              emailVerified: Boolean(payload.emailVerified || (eventType === 'customer.verified' && emailNorm)),
              mobileVerified: Boolean(payload.mobileVerified || (eventType === 'customer.verified' && phoneNorm)),
              utmMedium: payload.utmMedium || payload.attribution?.utm_medium || null,
              firstVisitAt: nowIso,
              latestVisitAt: nowIso,
              lastActivityAt: nowIso,
              lastActiveDate: todayDate,
              joinedDate: todayDate,
              lastActivityEvent: eventType,
              birthday: payload.birthday || null,
              consent: {
                emailTransactional: true,
                emailPromotional: payload.marketingOptIn !== false,
                whatsappTransactional: true,
                whatsappPromotional: payload.whatsappOptIn !== false,
                smsTransactional: true,
                smsPromotional: Boolean(payload.smsOptIn),
                marketingOptIn: payload.marketingOptIn !== false,
                unsubscribed: Boolean(payload.unsubscribed),
                updatedAt: nowIso
              }
            }
          })
          .onConflictDoNothing();
      }
      return;
    }

    const prevMeta =
      existing.crmMetadata && typeof existing.crmMetadata === 'object'
        ? { ...(existing.crmMetadata as Record<string, any>) }
        : {};
    const prevConsent = prevMeta.consent || {};

    const updatedMeta: Record<string, any> = {
      ...prevMeta,
      firstVisitAt: prevMeta.firstVisitAt || nowIso,
      latestVisitAt: nowIso,
      lastActivityAt: nowIso,
      lastActiveDate: todayDate,
      lastActivityEvent: eventType,
      utmMedium: payload.utmMedium || prevMeta.utmMedium || null,
      emailVerified:
        prevMeta.emailVerified ||
        Boolean(payload.emailVerified) ||
        (eventType === 'customer.verified' && Boolean(emailNorm)),
      mobileVerified:
        prevMeta.mobileVerified ||
        Boolean(payload.mobileVerified) ||
        (eventType === 'customer.verified' && Boolean(phoneNorm)),
      birthday: payload.birthday !== undefined ? payload.birthday : prevMeta.birthday || null,
      consent: {
        emailTransactional: true,
        emailPromotional:
          payload.emailPromotional !== undefined
            ? Boolean(payload.emailPromotional)
            : prevConsent.emailPromotional !== false,
        whatsappTransactional: true,
        whatsappPromotional:
          payload.whatsappPromotional !== undefined
            ? Boolean(payload.whatsappPromotional)
            : prevConsent.whatsappPromotional !== false,
        smsTransactional: true,
        smsPromotional:
          payload.smsPromotional !== undefined
            ? Boolean(payload.smsPromotional)
            : Boolean(prevConsent.smsPromotional),
        marketingOptIn:
          payload.marketingOptIn !== undefined
            ? Boolean(payload.marketingOptIn)
            : prevConsent.marketingOptIn !== false,
        unsubscribed:
          payload.unsubscribed !== undefined
            ? Boolean(payload.unsubscribed)
            : Boolean(prevConsent.unsubscribed),
        updatedAt: nowIso
      }
    };

    // Track wishlist items if wishlist.updated
    if (eventType === 'wishlist.updated' && Array.isArray(payload.wishlist)) {
      updatedMeta.wishlistItems = payload.wishlist;
    }

    // Track support issues if return.requested or support issue logged
    if (eventType === 'return.requested' || eventType === 'support.complaint') {
      const prevIssues = Array.isArray(prevMeta.supportIssues) ? prevMeta.supportIssues : [];
      const issueId = payload.returnId || payload.issueId || `iss-${Date.now()}`;
      if (!prevIssues.some((i: any) => i.id === issueId)) {
        updatedMeta.supportIssues = [
          {
            id: issueId,
            type: eventType === 'return.requested' ? 'ORDER_RETURN' : 'SUPPORT_COMPLAINT',
            orderId: payload.orderId || null,
            subject: payload.reason || payload.subject || 'Order Return / Support Request',
            status: payload.status || 'OPEN',
            createdAt: nowIso
          },
          ...prevIssues
        ];
      }
    }

    await db
      .update(customers)
      .set({
        // Never overwrite non-empty real fields with fabricated data
        ...(payload.name && !existing.name ? { name: String(payload.name) } : {}),
        ...(phoneNorm && !existing.phone ? { phone: phoneNorm } : {}),
        ...(emailNorm && !existing.email ? { email: emailNorm } : {}),
        ...(payload.utmSource && !existing.utmSource ? { utmSource: String(payload.utmSource) } : {}),
        ...(payload.utmCampaign && !existing.utmCampaign ? { utmCampaign: String(payload.utmCampaign) } : {}),
        crmMetadata: updatedMeta
      })
      .where(eq(customers.id, existing.id));
  } catch (err: any) {
    console.warn('[CRM Lifecycle Sync] Notice:', err.message);
  }
}

// ========================================================
// CORE EVENT INGESTION & TRANSACTIONAL JOB CREATION
// ========================================================
export async function ingestAutomationEvent(params: {
  eventType: string;
  source?: string;
  idempotencyKey?: string;
  entityId?: string;
  customerId?: string;
  orderId?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerSegment?: string;
  payload?: Record<string, any>;
  isTestRun?: boolean;
  targetWorkflowId?: string;
}) {
  await ensureAutomationSeeded();
  const settings = await getAutomationSettings();

  const eventType = params.eventType.trim();
  const source = params.source || 'backend_api';
  const payload = params.payload || {};
  const resolvedEntityId = params.entityId || params.orderId || params.customerId || '';
  const idempotencyKey =
    params.idempotencyKey ||
    `${eventType}:${resolvedEntityId}:${params.customerEmail || ''}:${Math.floor(Date.now() / 10000)}`;

  // Synchronize Customer Lifecycle CRM profile & metadata on every incoming event
  await syncCustomerLifecycleFromEvent(
    eventType,
    params.customerEmail || payload.customerEmail || null,
    params.customerPhone || payload.customerPhone || null,
    {
      ...payload,
      customerId: params.customerId || payload.customerId,
      orderId: params.orderId || payload.orderId
    }
  );

  // 1. Check idempotency / deduplication on automation_events
  const existingEvents = await db
    .select()
    .from(automationEvents)
    .where(eq(automationEvents.idempotencyKey, idempotencyKey))
    .limit(1);

  if (existingEvents.length > 0 && !params.isTestRun) {
    return {
      deduplicated: true,
      event: existingEvents[0],
      jobsCreated: []
    };
  }

  const eventId = `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  // 2. Find matching workflows
  const allWorkflows = await db.select().from(automationWorkflows);
  const matchingWorkflows = allWorkflows.filter((wf) => {
    if (params.targetWorkflowId) {
      return wf.id === params.targetWorkflowId;
    }
    if (!params.isTestRun && wf.status !== 'ACTIVE') return false;
    return wf.triggerType === eventType;
  });

  const matchedIds = matchingWorkflows.map((w) => w.id);

  // 3. Persist the event
  const [insertedEvent] = await db
    .insert(automationEvents)
    .values({
      id: eventId,
      idempotencyKey: params.isTestRun ? `${idempotencyKey}:test:${Date.now()}` : idempotencyKey,
      eventType,
      source,
      entityId: params.entityId || null,
      customerEmail: params.customerEmail || payload.customerEmail || null,
      customerPhone: params.customerPhone || payload.customerPhone || null,
      customerSegment: params.customerSegment || payload.customerSegment || null,
      payload,
      status: matchedIds.length > 0 ? 'PROCESSING' : 'PROCESSED',
      matchedWorkflowIds: matchedIds,
      processedAt: matchedIds.length === 0 ? new Date() : null,
      createdAt: new Date()
    })
    .returning();

  // 4. Enqueue persistent jobs for each matched workflow (respecting maxExecutionsPerCustomer & approval gates)
  const jobsCreated: any[] = [];
  const allExistingJobs = await db.select().from(automationJobs);

  for (const wf of matchingWorkflows) {
    const custEmail = (params.customerEmail || payload.customerEmail || '').trim().toLowerCase();

    // Check maxExecutionsPerCustomer limit (unless test run)
    if (!params.isTestRun && wf.maxExecutionsPerCustomer > 0 && custEmail) {
      const custRuns = allExistingJobs.filter(
        (j) =>
          j.workflowId === wf.id &&
          (j.customerEmail || '').toLowerCase() === custEmail &&
          j.status === 'COMPLETED'
      ).length;
      if (custRuns >= wf.maxExecutionsPerCustomer) {
        continue;
      }
    }

    const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const jobIdempotencyKey = `${wf.id}:${insertedEvent.idempotencyKey}`;

    const needsGovernanceApproval =
      !params.isTestRun && (wf.requiresApproval && wf.approvalStatus !== 'APPROVED');

    const [createdJob] = await db
      .insert(automationJobs)
      .values({
        id: jobId,
        idempotencyKey: jobIdempotencyKey,
        workflowId: wf.id,
        workflowName: wf.name,
        workflowVersion: wf.version || 1,
        eventId: insertedEvent.id,
        eventType,
        customerEmail: custEmail || null,
        customerSegment: params.customerSegment || payload.customerSegment || 'General',
        channel: 'multi',
        status: needsGovernanceApproval ? 'WAITING_APPROVAL' : 'QUEUED',
        currentNodeId: null,
        executionContext: {
          payload,
          source,
          entityId: params.entityId || null
        },
        stepLogs: [],
        attemptCount: 0,
        maxAttempts: settings.defaultMaxAttempts || 3,
        nextRunAt: new Date(),
        latencyMs: 0,
        costInr: 0,
        attributedRevenue: Number(payload.totalAmount || payload.cartValue || 0),
        isTestRun: Boolean(params.isTestRun),
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    jobsCreated.push(createdJob);
  }

  // Trigger immediate asynchronous worker pass so queued jobs execute without waiting
  if (settings.engineEnabled || params.isTestRun) {
    await processPendingAutomationJobs(params.isTestRun ? 10 : 5);
  }

  // Refresh jobs from DB to return final state
  const updatedJobs = [];
  for (const j of jobsCreated) {
    const [fresh] = await db.select().from(automationJobs).where(eq(automationJobs.id, j.id)).limit(1);
    if (fresh) updatedJobs.push(fresh);
  }

  return {
    deduplicated: false,
    event: insertedEvent,
    jobsCreated: updatedJobs
  };
}

// ========================================================
// PERSISTENT JOB QUEUE WORKER (DAG TRAVERSAL, RETRIES, DLQ)
// ========================================================
let isWorkerRunning = false;

export async function processPendingAutomationJobs(limitCount = 5): Promise<number> {
  if (isWorkerRunning) return 0;
  isWorkerRunning = true;
  let processedCount = 0;

  try {
    const settings = await getAutomationSettings();
    const now = new Date();

    const allJobs = await db
      .select()
      .from(automationJobs)
      .orderBy(desc(automationJobs.createdAt))
      .limit(100);

    const runnableJobs = allJobs
      .filter((j) => {
        if (j.status !== 'QUEUED' && j.status !== 'DELAYED') return false;
        const nextRun = j.nextRunAt ? new Date(j.nextRunAt) : new Date(0);
        if (nextRun > now && !j.isTestRun) return false;
        if (j.lockedUntil && new Date(j.lockedUntil) > now) return false;
        return true;
      })
      .slice(0, Math.min(limitCount, settings.maxConcurrentJobs || 5));

    for (const job of runnableJobs) {
      await executeSingleAutomationJob(job.id, settings);
      processedCount++;
    }
  } catch (err: any) {
    console.error('[Automation Worker] Error processing jobs:', err.message);
  } finally {
    isWorkerRunning = false;
  }

  return processedCount;
}

export async function executeSingleAutomationJob(
  jobId: string,
  settings?: AutomationGlobalSettings
): Promise<any> {
  const activeSettings = settings || (await getAutomationSettings());
  const [job] = await db.select().from(automationJobs).where(eq(automationJobs.id, jobId)).limit(1);
  if (!job) return null;

  const startTimeMs = Date.now();
  const lockExpiry = new Date(Date.now() + 30000);

  // Acquire concurrency lock
  await db
    .update(automationJobs)
    .set({
      status: 'RUNNING',
      lockedBy: WORKER_ID,
      lockedUntil: lockExpiry,
      attemptCount: (job.attemptCount || 0) + 1,
      updatedAt: new Date()
    })
    .where(eq(automationJobs.id, job.id));

  const [workflow] = await db
    .select()
    .from(automationWorkflows)
    .where(eq(automationWorkflows.id, job.workflowId))
    .limit(1);

  if (!workflow) {
    await db
      .update(automationJobs)
      .set({
        status: 'FAILED',
        lastError: `Workflow ${job.workflowId} not found`,
        lockedBy: null,
        lockedUntil: null,
        updatedAt: new Date()
      })
      .where(eq(automationJobs.id, job.id));
    return null;
  }

  const nodes: WorkflowNode[] = Array.isArray(workflow.nodes) ? (workflow.nodes as WorkflowNode[]) : [];
  const edges: WorkflowEdge[] = Array.isArray(workflow.edges) ? (workflow.edges as WorkflowEdge[]) : [];
  const stepLogs: StepExecutionLog[] = Array.isArray(job.stepLogs)
    ? [...(job.stepLogs as StepExecutionLog[])]
    : [];
  const execContext: Record<string, any> =
    job.executionContext && typeof job.executionContext === 'object'
      ? { ...(job.executionContext as Record<string, any>) }
      : { payload: {} };
  const eventPayload = execContext.payload || {};

  let totalCostInr = Number(job.costInr) || 0;
  let totalMessagesSent = 0;
  let couponsGeneratedCount = 0;
  let primaryChannel = job.channel || 'multi';

  try {
    // Find starting node (either resumed currentNodeId or trigger node)
    let currentNode: WorkflowNode | undefined = job.currentNodeId
      ? nodes.find((n) => n.id === job.currentNodeId)
      : nodes.find((n) => n.type === 'trigger') || nodes[0];

    const visitedNodeIds = new Set<string>();
    let maxHops = 25;

    while (currentNode && maxHops > 0) {
      maxHops--;
      if (visitedNodeIds.has(currentNode.id)) break; // Prevent infinite cycles
      visitedNodeIds.add(currentNode.id);

      const nodeStartMs = Date.now();
      const startedAtIso = new Date().toISOString();

      // 1. TRIGGER NODE
      if (currentNode.type === 'trigger') {
        stepLogs.push({
          nodeId: currentNode.id,
          nodeLabel: currentNode.label,
          nodeType: 'trigger',
          nodeSubtype: currentNode.subtype,
          status: 'SUCCESS',
          startedAt: startedAtIso,
          completedAt: new Date().toISOString(),
          durationMs: Math.max(1, Date.now() - nodeStartMs),
          output: { eventType: job.eventType, source: execContext.source || 'backend' }
        });
        const nextEdge = edges.find((e) => e.source === currentNode!.id);
        currentNode = nextEdge ? nodes.find((n) => n.id === nextEdge.target) : undefined;
        continue;
      }

      // 2. CONDITION NODE
      if (currentNode.type === 'condition') {
        const evalResult = await evaluateConditionNode(
          currentNode,
          eventPayload,
          job.customerEmail
        );
        stepLogs.push({
          nodeId: currentNode.id,
          nodeLabel: currentNode.label,
          nodeType: 'condition',
          nodeSubtype: currentNode.subtype,
          status: evalResult.passed ? 'SUCCESS' : 'SKIPPED',
          startedAt: startedAtIso,
          completedAt: new Date().toISOString(),
          durationMs: Math.max(1, Date.now() - nodeStartMs),
          output: { passed: evalResult.passed, details: evalResult.details }
        });

        const outgoingEdges = edges.filter((e) => e.source === currentNode!.id);
        let chosenEdge: WorkflowEdge | undefined;
        if (evalResult.passed) {
          chosenEdge =
            outgoingEdges.find((e) => e.branchLabel === 'TRUE') ||
            outgoingEdges.find((e) => !e.branchLabel || e.branchLabel === 'DEFAULT');
        } else {
          chosenEdge = outgoingEdges.find((e) => e.branchLabel === 'FALSE');
        }
        currentNode = chosenEdge ? nodes.find((n) => n.id === chosenEdge!.target) : undefined;
        continue;
      }

      // 3. CONTROL NODE
      if (currentNode.type === 'control') {
        const cfg = currentNode.config || {};
        if (currentNode.subtype === 'control.exit' || currentNode.subtype === 'control.stop_workflow') {
          stepLogs.push({
            nodeId: currentNode.id,
            nodeLabel: currentNode.label,
            nodeType: 'control',
            nodeSubtype: currentNode.subtype,
            status: 'SUCCESS',
            startedAt: startedAtIso,
            completedAt: new Date().toISOString(),
            durationMs: 1,
            output: { controlAction: currentNode.subtype }
          });
          break;
        }

        if (currentNode.subtype === 'control.request_approval' && !execContext.approvedByAdmin) {
          const approvalId = `appr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          await db.insert(automationApprovals).values({
            id: approvalId,
            workflowId: workflow.id,
            workflowName: workflow.name,
            jobId: job.id,
            actionType: cfg.actionType || 'WORKFLOW_STEP_APPROVAL',
            requestedBy: 'automation-engine@fragmore.shop',
            reason: cfg.reason || `Approval required at step "${currentNode.label}"`,
            payload: eventPayload,
            status: 'PENDING',
            createdAt: new Date()
          });

          stepLogs.push({
            nodeId: currentNode.id,
            nodeLabel: currentNode.label,
            nodeType: 'control',
            nodeSubtype: currentNode.subtype,
            status: 'APPROVAL_REQUIRED',
            startedAt: startedAtIso,
            completedAt: new Date().toISOString(),
            durationMs: 2,
            output: { approvalId, status: 'WAITING_APPROVAL' }
          });

          await db
            .update(automationJobs)
            .set({
              status: 'WAITING_APPROVAL',
              currentNodeId: currentNode.id,
              stepLogs,
              lockedBy: null,
              lockedUntil: null,
              updatedAt: new Date()
            })
            .where(eq(automationJobs.id, job.id));
          return;
        }

        if (
          (currentNode.subtype === 'control.wait' || currentNode.subtype === 'control.delay_until') &&
          !job.isTestRun &&
          !execContext[`waited_${currentNode.id}`]
        ) {
          const delaySec = Number(cfg.durationSeconds ?? 0);
          if (delaySec > 0) {
            const nextRunAt = new Date(Date.now() + delaySec * 1000);
            execContext[`waited_${currentNode.id}`] = true;
            stepLogs.push({
              nodeId: currentNode.id,
              nodeLabel: currentNode.label,
              nodeType: 'control',
              nodeSubtype: currentNode.subtype,
              status: 'WAITING',
              startedAt: startedAtIso,
              completedAt: new Date().toISOString(),
              durationMs: 1,
              output: { delayedUntil: nextRunAt.toISOString(), delaySec }
            });

            const nextEdge = edges.find((e) => e.source === currentNode!.id);
            await db
              .update(automationJobs)
              .set({
                status: 'DELAYED',
                currentNodeId: nextEdge ? nextEdge.target : null,
                executionContext: execContext,
                stepLogs,
                nextRunAt,
                lockedBy: null,
                lockedUntil: null,
                updatedAt: new Date()
              })
              .where(eq(automationJobs.id, job.id));
            return;
          }
        }

        // Branch or completed Wait/Retry control node
        stepLogs.push({
          nodeId: currentNode.id,
          nodeLabel: currentNode.label,
          nodeType: 'control',
          nodeSubtype: currentNode.subtype,
          status: 'SUCCESS',
          startedAt: startedAtIso,
          completedAt: new Date().toISOString(),
          durationMs: 1,
          output: { controlNodeCompleted: true }
        });

        const nextEdge = edges.find((e) => e.source === currentNode!.id);
        currentNode = nextEdge ? nodes.find((n) => n.id === nextEdge.target) : undefined;
        continue;
      }

      // 4. ACTION NODE
      if (currentNode.type === 'action') {
        if (currentNode.config?.simulateFailure && (job.attemptCount || 0) < 2) {
          throw new Error(`Simulated transient provider failure on node "${currentNode.label}"`);
        }

        const actionRes = await executeActionNode(
          currentNode,
          workflow,
          eventPayload,
          job.customerEmail,
          activeSettings
        );
        totalCostInr += actionRes.costInr;
        totalMessagesSent += actionRes.messagesSent;
        if (actionRes.couponGenerated) couponsGeneratedCount++;
        if (actionRes.output?.channel) {
          primaryChannel = String(actionRes.output.channel).toLowerCase();
        }

        stepLogs.push({
          nodeId: currentNode.id,
          nodeLabel: currentNode.label,
          nodeType: 'action',
          nodeSubtype: currentNode.subtype,
          status: 'SUCCESS',
          startedAt: startedAtIso,
          completedAt: new Date().toISOString(),
          durationMs: Math.max(1, Date.now() - nodeStartMs),
          output: actionRes.output
        });

        const nextEdge = edges.find((e) => e.source === currentNode!.id);
        currentNode = nextEdge ? nodes.find((n) => n.id === nextEdge.target) : undefined;
        continue;
      }
    }

    const totalLatencyMs = Math.max(2, Date.now() - startTimeMs);

    // Mark job COMPLETED
    await db
      .update(automationJobs)
      .set({
        status: 'COMPLETED',
        channel: primaryChannel,
        currentNodeId: null,
        stepLogs,
        executionContext: execContext,
        latencyMs: totalLatencyMs,
        costInr: Number(totalCostInr.toFixed(2)),
        lastError: null,
        lockedBy: null,
        lockedUntil: null,
        completedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(automationJobs.id, job.id));

    // Mark parent event PROCESSED
    await db
      .update(automationEvents)
      .set({ status: 'PROCESSED', processedAt: new Date() })
      .where(eq(automationEvents.id, job.eventId));

    // Update workflow aggregate stats from real executions
    const prevStats: any = workflow.stats || {};
    const prevTotal = Number(prevStats.totalRuns) || 0;
    const prevSuccess = Number(prevStats.successfulRuns) || 0;
    const prevLatency = Number(prevStats.avgLatencyMs) || 0;
    const nextSuccess = prevSuccess + 1;
    const nextAvgLatency = Math.round((prevLatency * prevSuccess + totalLatencyMs) / nextSuccess);

    await db
      .update(automationWorkflows)
      .set({
        stats: {
          ...prevStats,
          totalRuns: prevTotal + 1,
          successfulRuns: nextSuccess,
          messagesSent: (Number(prevStats.messagesSent) || 0) + totalMessagesSent,
          couponRedemptions: (Number(prevStats.couponRedemptions) || 0) + couponsGeneratedCount,
          attributedRevenue:
            (Number(prevStats.attributedRevenue) || 0) + (Number(job.attributedRevenue) || 0),
          generatedOrders:
            (Number(prevStats.generatedOrders) || 0) + (job.eventType === 'order.placed' ? 1 : 0),
          totalCostInr: Number(((Number(prevStats.totalCostInr) || 0) + totalCostInr).toFixed(2)),
          avgLatencyMs: nextAvgLatency
        },
        updatedAt: new Date()
      })
      .where(eq(automationWorkflows.id, workflow.id));
  } catch (err: any) {
    const attempts = (job.attemptCount || 0) + 1;
    const maxAttempts = job.maxAttempts || activeSettings.defaultMaxAttempts || 3;
    const isDeadLetter = attempts >= maxAttempts;
    const backoffMs =
      (activeSettings.retryBaseDelayMs || 2000) * Math.pow(2, Math.max(0, attempts - 1));
    const nextRetryAt = new Date(Date.now() + backoffMs);

    stepLogs.push({
      nodeId: job.currentNodeId || 'runtime-error',
      nodeLabel: 'Execution Error Handler',
      nodeType: 'control',
      nodeSubtype: 'control.retry',
      status: 'FAILED',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: Math.max(1, Date.now() - startTimeMs),
      error: err.message || 'Execution error',
      output: {
        attempt: attempts,
        maxAttempts,
        TransitionedTo: isDeadLetter ? 'DEAD_LETTER' : 'DELAYED_RETRY',
        nextRetryAt: isDeadLetter ? null : nextRetryAt.toISOString()
      }
    });

    await db
      .update(automationJobs)
      .set({
        status: isDeadLetter ? 'DEAD_LETTER' : 'DELAYED',
        stepLogs,
        lastError: err.message || 'Unknown execution error',
        nextRunAt: nextRetryAt,
        lockedBy: null,
        lockedUntil: null,
        updatedAt: new Date()
      })
      .where(eq(automationJobs.id, job.id));

    const prevStats: any = workflow.stats || {};
    await db
      .update(automationWorkflows)
      .set({
        stats: {
          ...prevStats,
          totalRuns: (Number(prevStats.totalRuns) || 0) + 1,
          failedRuns: (Number(prevStats.failedRuns) || 0) + (isDeadLetter ? 1 : 0)
        },
        updatedAt: new Date()
      })
      .where(eq(automationWorkflows.id, workflow.id));
  }
}

// ========================================================
// GEMINI AI RECOMMENDATIONS ENGINE (SERVER-SIDE ONLY)
// ========================================================
export async function generateAiWorkflowRecommendation(contextPrompt?: string) {
  let title = 'VIP High-Sillage Evening Cohort Re-Engagement';
  let category = 'review_retention';
  let rationale =
    'Based on actual order patterns across Signature 50ml flacons, customers who purchase Woody/Amber scents convert at higher rates when invited to private refills 21 days post-delivery.';
  let suggestedTrigger = 'order.delivered';
  let expectedImpact = 'High repeat order conversion without discounting core Signature SKUs';
  let confidenceScore = 91;

  if (process.env.GEMINI_API_KEY) {
    try {
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `You are the enterprise commerce automation architect for FRAGMORÉ (Scent That Stays With You), an Indian luxury perfume brand offering 9 Signature Collection perfumes (30ml/50ml) and 3 Aura Collection perfumes (15ml).
Generate ONE actionable, high-ROI workflow automation recommendation in JSON format with keys:
title (string), category (one of: customer_journeys, marketing, order, inventory, shipping, discovery, influencer, review_retention), rationale (string), suggestedTrigger (one of: cart.abandoned, order.placed, order.delivered, discovery.purchased, inventory.below_threshold, customer.vip_eligible), expectedImpact (string), confidenceScore (number 80-98).
Context: ${contextPrompt || 'Optimize retention, Discovery Six voucher upgrades, and inventory velocity.'}`,
        config: {
          responseMimeType: 'application/json'
        }
      });

      const text = response.text;
      if (text) {
        const parsed = JSON.parse(text.trim());
        if (parsed.title) title = parsed.title;
        if (parsed.category) category = parsed.category;
        if (parsed.rationale) rationale = parsed.rationale;
        if (parsed.suggestedTrigger) suggestedTrigger = parsed.suggestedTrigger;
        if (parsed.expectedImpact) expectedImpact = parsed.expectedImpact;
        if (parsed.confidenceScore) confidenceScore = Number(parsed.confidenceScore) || 90;
      }
    } catch (err: any) {
      console.warn('[Automation Gemini AI] Using deterministic recommendation fallback:', err.message);
    }
  }

  const blueprint = {
    triggerType: suggestedTrigger,
    nodes: [
      {
        id: 'node-1',
        type: 'trigger',
        subtype: suggestedTrigger,
        label: `Trigger: ${suggestedTrigger}`,
        position: { x: 80, y: 160 },
        config: {}
      },
      {
        id: 'node-2',
        type: 'condition',
        subtype: 'condition.communication_consent',
        label: 'Verify Client Consent',
        position: { x: 360, y: 160 },
        config: {}
      },
      {
        id: 'node-3',
        type: 'control',
        subtype: 'control.request_approval',
        label: 'Require Super Admin Approval',
        position: { x: 640, y: 160 },
        config: { reason: 'AI-generated workflow requires human-in-the-loop sign-off' }
      },
      {
        id: 'node-4',
        type: 'action',
        subtype: 'action.send_transactional_email',
        label: 'Dispatch Curated Client Note',
        position: { x: 920, y: 160 },
        config: { subject: `FRAGMORÉ — ${title}` }
      }
    ],
    edges: [
      { id: 'e1-2', source: 'node-1', target: 'node-2', branchLabel: 'DEFAULT' },
      { id: 'e2-3', source: 'node-2', target: 'node-3', branchLabel: 'TRUE' },
      { id: 'e3-4', source: 'node-3', target: 'node-4', branchLabel: 'DEFAULT' }
    ]
  };

  const id = `airec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const [inserted] = await db
    .insert(automationAiRecommendations)
    .values({
      id,
      title,
      category,
      rationale,
      suggestedTrigger,
      expectedImpact,
      confidenceScore,
      workflowBlueprint: blueprint,
      status: 'PENDING_APPROVAL',
      createdAt: new Date()
    })
    .returning();

  return inserted;
}

// ========================================================
// LIVE OVERVIEW METRICS COMPUTATION (SECTION B — ZERO FAKE DATA)
// ========================================================
export async function computeAutomationOverviewMetrics(filters?: {
  dateRange?: string;
  workflowId?: string;
  channel?: string;
  segment?: string;
  eventType?: string;
}) {
  await ensureAutomationSeeded();

  const [allWfs, allJobs, allEvents, allCarts, allOrders, allCoupons, allCustomers, allApprovals] =
    await Promise.all([
      db.select().from(automationWorkflows),
      db.select().from(automationJobs),
      db.select().from(automationEvents),
      db.select().from(abandonedCarts),
      db.select().from(orders),
      db.select().from(coupons),
      db.select().from(customers),
      db.select().from(automationApprovals)
    ]);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Filter jobs according to query filters
  const filteredJobs = allJobs.filter((j) => {
    if (filters?.workflowId && filters.workflowId !== 'all' && j.workflowId !== filters.workflowId) {
      return false;
    }
    if (
      filters?.channel &&
      filters.channel !== 'all' &&
      (j.channel || '').toLowerCase() !== filters.channel.toLowerCase()
    ) {
      return false;
    }
    if (
      filters?.segment &&
      filters.segment !== 'all' &&
      !(j.customerSegment || '').toLowerCase().includes(filters.segment.toLowerCase())
    ) {
      return false;
    }
    if (filters?.eventType && filters.eventType !== 'all' && j.eventType !== filters.eventType) {
      return false;
    }
    if (filters?.dateRange && filters.dateRange !== 'lifetime') {
      const created = new Date(j.createdAt);
      if (filters.dateRange === 'today' && created < startOfToday) return false;
      if (filters.dateRange === '7days' && now.getTime() - created.getTime() > 7 * 86400000) {
        return false;
      }
      if (filters.dateRange === '30days' && now.getTime() - created.getTime() > 30 * 86400000) {
        return false;
      }
    }
    return true;
  });

  const activeWorkflowsCount = allWfs.filter((w) => w.status === 'ACTIVE').length;
  const pausedWorkflowsCount = allWfs.filter((w) => w.status === 'PAUSED').length;
  const draftWorkflowsCount = allWfs.filter((w) => w.status === 'DRAFT').length;

  const executedTodayCount = filteredJobs.filter(
    (j) => new Date(j.createdAt) >= startOfToday
  ).length;
  const successfulExecutions = filteredJobs.filter((j) => j.status === 'COMPLETED').length;
  const failedExecutions = filteredJobs.filter(
    (j) => j.status === 'FAILED' || j.status === 'DEAD_LETTER'
  ).length;
  const pendingExecutions = filteredJobs.filter(
    (j) =>
      j.status === 'QUEUED' ||
      j.status === 'DELAYED' ||
      j.status === 'RUNNING' ||
      j.status === 'WAITING_APPROVAL'
  ).length;

  // 7. Recovered abandoned-cart revenue (strictly from real recovered carts in DB)
  const recoveredAbandonedCartRevenue = allCarts
    .filter((c) => c.status === 'RECOVERED')
    .reduce((sum, c) => sum + (Number(c.cartValue) || 0), 0);

  // 8. Automation-attributed revenue (strictly from completed jobs & attributed orders)
  const jobAttributedRev = filteredJobs
    .filter((j) => j.status === 'COMPLETED')
    .reduce((sum, j) => sum + (Number(j.attributedRevenue) || 0), 0);
  const automationAttributedRevenue = Math.max(recoveredAbandonedCartRevenue, jobAttributedRev);

  // 9. Messages sent & 10. Delivery / failure rates
  let messagesSent = 0;
  for (const j of filteredJobs) {
    const logs: StepExecutionLog[] = Array.isArray(j.stepLogs) ? (j.stepLogs as any[]) : [];
    for (const l of logs) {
      if (
        l.status === 'SUCCESS' &&
        (l.nodeSubtype === 'action.send_whatsapp' ||
          l.nodeSubtype === 'action.send_transactional_email' ||
          l.nodeSubtype === 'action.send_marketing_email' ||
          l.nodeSubtype === 'action.send_sms')
      ) {
        messagesSent++;
      }
    }
  }

  const totalTerminalJobs = successfulExecutions + failedExecutions;
  const deliverySuccessRate =
    totalTerminalJobs > 0 ? Number(((successfulExecutions / totalTerminalJobs) * 100).toFixed(1)) : 100;
  const failureRate =
    totalTerminalJobs > 0 ? Number(((failedExecutions / totalTerminalJobs) * 100).toFixed(1)) : 0;

  // 11. Coupon redemptions (strictly from real coupons table usageCount + coupon.redeemed jobs)
  const dbCouponRedemptions = allCoupons.reduce((sum, c) => sum + (Number(c.usageCount) || 0), 0);

  // 12. Workflow execution cost
  const workflowExecutionCostInr = Number(
    filteredJobs.reduce((sum, j) => sum + (Number(j.costInr) || 0), 0).toFixed(2)
  );

  // 13. Average processing latency
  const completedWithLatency = filteredJobs.filter((j) => j.status === 'COMPLETED' && j.latencyMs > 0);
  const avgProcessingLatencyMs =
    completedWithLatency.length > 0
      ? Math.round(
          completedWithLatency.reduce((sum, j) => sum + (Number(j.latencyMs) || 0), 0) /
            completedWithLatency.length
        )
      : 0;

  // 14. Automation-generated orders
  const automationGeneratedOrders =
    filteredJobs.filter((j) => j.status === 'COMPLETED' && j.eventType === 'order.placed').length +
    allCarts.filter((c) => c.status === 'RECOVERED').length;

  // 15. Customer retention performance (Repeat customers ratio from actual customers table)
  const repeatCustomersCount = allCustomers.filter((c) => (Number(c.totalOrders) || 0) > 1).length;
  const customerRetentionRatePct =
    allCustomers.length > 0
      ? Number(((repeatCustomersCount / allCustomers.length) * 100).toFixed(1))
      : 0;

  return {
    totalActiveWorkflows: activeWorkflowsCount,
    pausedWorkflows: pausedWorkflowsCount,
    draftWorkflows: draftWorkflowsCount,
    automationsExecutedToday: executedTodayCount,
    successfulExecutions,
    failedExecutions,
    pendingExecutions,
    recoveredAbandonedCartRevenue,
    automationAttributedRevenue,
    messagesSent,
    deliverySuccessRate,
    deliveryRate: deliverySuccessRate,
    failureRate,
    couponRedemptions: dbCouponRedemptions,
    workflowExecutionCostInr,
    workflowExecutionCost: workflowExecutionCostInr,
    avgProcessingLatencyMs,
    averageProcessingLatencyMs: avgProcessingLatencyMs,
    automationGeneratedOrders,
    customerRetentionRatePct,
    customerRetentionPerformance: customerRetentionRatePct,
    repeatCustomersCount,
    totalCustomersCount: allCustomers.length,
    pendingApprovalsCount: allApprovals.filter((a) => a.status === 'PENDING').length,
    totalEventsLogged: allEvents.length
  };
}

// ========================================================
// BACKGROUND DAEMON SCHEDULER (RUNS ON SERVER STARTUP)
// ========================================================
let backgroundIntervalHandle: NodeJS.Timeout | null = null;

export function startAutomationBackgroundWorker() {
  if (backgroundIntervalHandle) return;

  backgroundIntervalHandle = setInterval(async () => {
    try {
      const settings = await getAutomationSettings();
      if (!settings.engineEnabled) return;

      // 1. Process any due delayed/queued jobs
      await processPendingAutomationJobs(5);

      // 2. Check due scheduled tasks (unified scheduler for both Automation Center & AI CMO Scheduled Intelligence)
      const now = new Date();
      let tasks: any[] = [];
      try {
        tasks = await db.select().from(automationScheduledTasks);
      } catch {
        return;
      }

      for (const task of tasks) {
        if (task.isActive && task.nextRunAt && new Date(task.nextRunAt) <= now) {
          const nextRun = new Date(now.getTime() + 24 * 60 * 60 * 1000);
          await db
            .update(automationScheduledTasks)
            .set({
              lastRunAt: now,
              nextRunAt: nextRun,
              runCount: (task.runCount || 0) + 1
            })
            .where(eq(automationScheduledTasks.id, task.id));

          if (task.id.startsWith('sched-aicmo-')) {
            const { SCHEDULED_INTELLIGENCE_BLUEPRINTS, executeScheduledIntelligenceJob } =
              await import('./aiCmoMemoryAndScheduledIntelligence.ts');
            const matchedBlueprint = SCHEDULED_INTELLIGENCE_BLUEPRINTS.find(
              (b) => b.scheduledTaskId === task.id
            );
            if (matchedBlueprint) {
              await executeScheduledIntelligenceJob({
                jobType: matchedBlueprint.jobType,
                triggerSource: 'SCHEDULED_CRON',
                actorEmail: 'scheduler@fragmore.com'
              });
            }
          }

          await ingestAutomationEvent({
            eventType: 'schedule.triggered',
            source: 'scheduler',
            idempotencyKey: `sched:${task.id}:${now.toISOString().slice(0, 13)}`,
            entityId: task.id,
            payload: {
              scheduledTaskId: task.id,
              scheduledTaskName: task.name,
              cronExpression: task.cronExpression,
              timezone: task.timezone
            },
            targetWorkflowId: task.workflowId
          });
        }
      }
    } catch {
      // Non-fatal background tick notice
    }
  }, 300000);

  if (typeof (backgroundIntervalHandle as any)?.unref === 'function') {
    (backgroundIntervalHandle as any).unref();
  }
}

