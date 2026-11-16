import crypto from 'crypto';
import { eq, desc, asc, sql, and, inArray } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  erpOrganizations,
  erpLeads,
  erpProposals,
  erpQuotations,
  erpInvoices,
  erpPayments,
  erpTasks,
  erpApprovals,
  erpAttachments,
  erpFinishedGoods,
  erpPricingAuditLogs,
  erpDealActivities,
  products,
  customers,
  orders,
  erpUserAccess
} from '../db/schema.ts';
import {
  ORG_ID,
  getNextSequence,
  recordErpAuditLog,
  createErpNotification,
  ensureErpSeeded,
  createGstInvoiceTransaction,
  recordPaymentTransaction,
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
  type ErpActorContext
} from './erpBusinessOsEngine.ts';

// ============================================================================
// DOMAIN CONSTANTS (11 Categories, 8 Proposal Types, 12-Stage Lifecycle)
// ============================================================================

export const CUSTOMER_CATEGORIES = [
  { code: 'DIRECT_CONSUMER', label: 'Direct Consumers' },
  { code: 'RESELLER', label: 'Resellers' },
  { code: 'RETAILER', label: 'Retailers' },
  { code: 'DISTRIBUTOR', label: 'Distributors' },
  { code: 'STOCKIST', label: 'Stockists' },
  { code: 'CORPORATE_GIFTING', label: 'Corporate Gifting Buyers' },
  { code: 'WEDDING_PLANNER', label: 'Wedding Planners' },
  { code: 'EVENT_MANAGER', label: 'Event Managers' },
  { code: 'HOTEL_HOSPITALITY', label: 'Hotels & Hospitality Businesses' },
  { code: 'PERFUME_BAR_CUSTOMER', label: 'Perfume Bar Customers' },
  { code: 'AGENCY_INSTITUTIONAL', label: 'Agencies & Institutional Buyers' }
] as const;

export const PROPOSAL_TYPES = [
  { code: 'CORPORATE_GIFTING', label: 'Corporate Gifting' },
  { code: 'EMPLOYEE_GIFTING', label: 'Employee Gifting' },
  { code: 'WEDDING_RETURN_GIFTS', label: 'Wedding Return Gifts' },
  { code: 'PERFUME_BAR_EVENT', label: 'Perfume Bar Event Activations' },
  { code: 'BULK_PERFUME_ORDER', label: 'Bulk Perfume Orders' },
  { code: 'RETAILER_DISTRIBUTOR_PARTNERSHIP', label: 'Retailer & Distributor Partnerships' },
  { code: 'CUSTOM_FRAGRANCE_EXPERIENCE', label: 'Customized Fragrance Experiences' },
  { code: 'SPECIAL_COLLECTION_PACKAGE', label: 'Special Collections & Gifting Packages' }
] as const;

export const CRM_WORKFLOW_STAGES = [
  'LEAD',
  'REQUIREMENT',
  'PROPOSAL_DRAFT',
  'INTERNAL_APPROVAL',
  'SENT',
  'CLIENT_NEGOTIATION',
  'REVISED_PROPOSAL',
  'ACCEPTED',
  'SALES_ORDER',
  'INVOICE',
  'PAYMENT',
  'FULFILMENT'
] as const;

export const LEAD_SOURCES = [
  'Website Inquiry',
  'Perfume Bar Walk-In',
  'Instagram / Meta',
  'Influencer Seeding',
  'LinkedIn Outbound',
  'Wedding Concierge Referral',
  'Hospitality Partnership',
  'Trade Show / Exhibition',
  'Direct Referral'
] as const;

export const MAX_SELF_APPROVE_DISCOUNT_PCT = 10;

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
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

function mapWorkflowToLegacyLeadStage(workflowStage: string): string {
  switch (workflowStage) {
    case 'LEAD':
      return 'NEW';
    case 'REQUIREMENT':
    case 'PROPOSAL_DRAFT':
    case 'INTERNAL_APPROVAL':
      return 'QUALIFIED';
    case 'SENT':
      return 'PROPOSAL_SENT';
    case 'CLIENT_NEGOTIATION':
    case 'REVISED_PROPOSAL':
      return 'NEGOTIATION';
    case 'ACCEPTED':
    case 'SALES_ORDER':
    case 'INVOICE':
    case 'PAYMENT':
    case 'FULFILMENT':
      return 'WON';
    case 'LOST':
      return 'LOST';
    default:
      return 'NEW';
  }
}

function defaultProbabilityForStage(workflowStage: string): number {
  switch (workflowStage) {
    case 'LEAD':
      return 20;
    case 'REQUIREMENT':
      return 35;
    case 'PROPOSAL_DRAFT':
      return 45;
    case 'INTERNAL_APPROVAL':
      return 55;
    case 'SENT':
      return 65;
    case 'CLIENT_NEGOTIATION':
    case 'REVISED_PROPOSAL':
      return 75;
    case 'ACCEPTED':
      return 90;
    case 'SALES_ORDER':
    case 'INVOICE':
    case 'PAYMENT':
    case 'FULFILMENT':
      return 100;
    case 'LOST':
      return 0;
    default:
      return 25;
  }
}

function hasPricingApprovalPrivilege(actor: ErpActorContext): boolean {
  return Boolean(
    actor.isSuperAdmin ||
      actor.permissions?.proposals?.canApprove ||
      actor.permissions?.sales?.canApprove
  );
}

// ============================================================================
// CATALOGUE LOOKUP & COSTING MATRIX
// ============================================================================

export async function getCatalogueWithCosting() {
  const [prodRows, fgRows] = await Promise.all([
    db.select().from(products).where(eq(products.status, 'ACTIVE')).orderBy(asc(products.name)),
    db.select().from(erpFinishedGoods)
  ]);

  const fgBySku = new Map<string, any>();
  for (const fg of fgRows) {
    fgBySku.set(String(fg.sku || '').toUpperCase(), fg);
  }

  const catalogueItems: Array<{
    productId: string;
    slug: string;
    name: string;
    collection: string;
    themeColor: string;
    sku: string;
    size: string;
    mrpInr: number;
    storefrontSellingPriceInr: number;
    catalogueUnitPriceInr: number;
    hsnCode: string;
    gstRatePct: number;
    unitManufacturingCostInr: number;
    stockAvailable: number;
  }> = [];

  for (const p of prodRows) {
    const variants: any[] = Array.isArray(p.variants) ? p.variants : [];
    for (const v of variants) {
      const sku = String(v.sku || `FRG-${p.id}-${v.size || '50ML'}`).toUpperCase();
      const fg = fgBySku.get(sku);
      const mrp = Number(v.mrp || v.sellingPrice || 1499);
      const selling = Number(v.sellingPrice || mrp);
      const preGstCataloguePrice = round2(selling / 1.18);
      const unitCogs = fg ? Number(fg.unitManufacturingCostInr || 420) : round2(preGstCataloguePrice * 0.28);
      catalogueItems.push({
        productId: p.id,
        slug: p.slug,
        name: p.name,
        collection: p.collection,
        themeColor: p.themeColor || '#C5A059',
        sku,
        size: String(v.size || '50 ml'),
        mrpInr: mrp,
        storefrontSellingPriceInr: selling,
        catalogueUnitPriceInr: preGstCataloguePrice,
        hsnCode: fg?.hsnCode || '33030050',
        gstRatePct: Number(fg?.gstRatePct ?? 18),
        unitManufacturingCostInr: unitCogs,
        stockAvailable: fg ? Number(fg.quantityAvailable || 0) : Number(v.stockAvailable || v.stockOnHand || 0)
      });
    }
  }

  return catalogueItems;
}

// ============================================================================
// IDEMPOTENT BACKFILL & COMMERCIAL SEEDING
// ============================================================================

export async function ensureCommercialCrmSeeded() {
  await ensureErpSeeded();

  const existingActivities = await db.select().from(erpDealActivities).limit(1);
  if (existingActivities.length > 0) return;

  await db.transaction(async (tx) => {
    const leads = await tx.select().from(erpLeads);
    const props = await tx.select().from(erpProposals);
    const qts = await tx.select().from(erpQuotations);

    // Enrich existing seeded leads without mutating core identity
    for (const l of leads) {
      if (l.id === 'lead-taj-01') {
        await tx
          .update(erpLeads)
          .set({
            customerCategory: 'HOTEL_HOSPITALITY',
            workflowStage: 'SENT',
            probabilityPct: 75,
            clientGstin: '27AAACT3957G1ZX',
            clientAddress: 'Apollo Bunder, Colaba, Mumbai 400001',
            requirementsSummary: '300 signature 50ml flacons with gold foil embossed hospitality sleeve & turn-down storytelling cards.',
            expectedQuantity: 300,
            contactHistory: [
              {
                id: 'ch-taj-01',
                channel: 'MEETING',
                summary: 'Presented Golden Hour & Moksha Essence VIP amenity tray at Taj Colaba.',
                outcome: 'Requested formal Tier-A/Tier-B corporate proposal and GST proforma.',
                contactDate: currentIsoDate(),
                actorEmail: l.assignedToEmail
              }
            ],
            reminderNotes: 'Confirm gold-leaf sleeve monogram artwork sign-off before PO lock.'
          })
          .where(eq(erpLeads.id, l.id));
      } else if (l.id === 'lead-deloitte-02') {
        await tx
          .update(erpLeads)
          .set({
            customerCategory: 'CORPORATE_GIFTING',
            workflowStage: 'REQUIREMENT',
            probabilityPct: 50,
            clientAddress: 'RMZ Ecoworld, Outer Ring Road, Bengaluru 560103',
            requirementsSummary: '150 festive executive hampers featuring Discovery Six + Velvet Noir gift sleeve.',
            expectedQuantity: 150,
            contactHistory: [
              {
                id: 'ch-del-01',
                channel: 'CALL',
                summary: 'Discovery call with Procurement Lead on Diwali & Q4 partner gifting SLA.',
                outcome: 'Sample coffret dispatch requested prior to commercial quotation.',
                contactDate: currentIsoDate(),
                actorEmail: l.assignedToEmail
              }
            ]
          })
          .where(eq(erpLeads.id, l.id));
      }
    }

    // Seed additional diverse category leads (Wedding Planner + Stockist/Distributor) if absent
    const extraLeads = [
      {
        id: 'lead-wed-03',
        organizationId: ORG_ID,
        leadNumber: 'LD-2026-1003',
        companyName: 'Aurelia Bespoke Weddings',
        contactName: 'Rhea Oberoi',
        email: 'rhea@aureliaweddings.in',
        phone: '+91 98204 55120',
        city: 'Udaipur',
        state: 'Rajasthan',
        leadType: 'WEDDING_CONCIERGE',
        customerCategory: 'WEDDING_PLANNER',
        source: 'Wedding Concierge Referral',
        estimatedValueInr: 420000,
        probabilityPct: 65,
        stage: 'PROPOSAL_SENT',
        workflowStage: 'CLIENT_NEGOTIATION',
        clientAddress: 'City Palace Road, Udaipur, Rajasthan 313001',
        requirementsSummary: '220 customized monogrammed 30ml return gifts + Live Perfume Bar activation for Sangeet evening.',
        eventDate: addDaysIso(42),
        expectedQuantity: 220,
        contactHistory: [
          {
            id: 'ch-wed-01',
            channel: 'WHATSAPP',
            summary: 'Shared Perfume Bar counter moodboard and 3 floral-amber scent shortlist.',
            outcome: 'Client requested Perfume Bar event staffing + return gift combo pricing.',
            contactDate: currentIsoDate(),
            actorEmail: 'admin@fragmore.com'
          }
        ],
        reminderNotes: 'Send revised v2 proposal optimizing Perfume Bar setup fee.',
        assignedToEmail: 'admin@fragmore.com',
        nextFollowUpDate: addDaysIso(3),
        notes: 'Destination palace wedding — requires 2 mixology ambassadors on site.'
      },
      {
        id: 'lead-dist-04',
        organizationId: ORG_ID,
        leadNumber: 'LD-2026-1004',
        companyName: 'Maison Luxe Retail Distributors LLP',
        contactName: 'Karan Malhotra',
        email: 'karan@maisonluxeretail.in',
        phone: '+91 98112 77890',
        city: 'New Delhi',
        state: 'Delhi',
        leadType: 'RETAILER_PARTNERSHIP',
        customerCategory: 'DISTRIBUTOR',
        source: 'Trade Show / Exhibition',
        estimatedValueInr: 850000,
        probabilityPct: 40,
        stage: 'QUALIFIED',
        workflowStage: 'PROPOSAL_DRAFT',
        clientGstin: '07AABCM9124K1Z2',
        clientAddress: 'Khan Market Annex, New Delhi 110003',
        requirementsSummary: 'Multi-city boutique stockist rollout across 6 NCR luxury lifestyle stores with tester plinths.',
        expectedQuantity: 600,
        contactHistory: [
          {
            id: 'ch-dist-01',
            channel: 'EMAIL',
            summary: 'Received distributor margin slab expectations (28% wholesale margin + tester allocation).',
            outcome: 'Finance & Sales Director reviewing partner slab approval.',
            contactDate: currentIsoDate(),
            actorEmail: 'admin@fragmore.com'
          }
        ],
        reminderNotes: 'Prepare Retailer & Distributor Partnership proposal with quarterly MOQ milestones.',
        assignedToEmail: 'admin@fragmore.com',
        nextFollowUpDate: addDaysIso(5),
        notes: 'High-volume North India retail anchor opportunity.'
      }
    ];

    for (const nl of extraLeads) {
      await tx.insert(erpLeads).values(nl).onConflictDoNothing();
    }

    // Enrich seeded proposal if present
    for (const p of props) {
      if (p.id === 'prop-taj-01') {
        const sub = Number(p.estimatedValueInr || 389000);
        const setupCostInr = 25000;
        const staffingCostInr = 18000;
        const shippingInr = 6500;
        const baseTax = round2((sub + setupCostInr + staffingCostInr) * 0.18);
        await tx
          .update(erpProposals)
          .set({
            proposalDate: currentIsoDate(),
            proposalType: 'CORPORATE_GIFTING',
            versionGroupId: 'vg-taj-01',
            proposalVersionNumber: 1,
            clientPhone: '+91 22 6665 3366',
            clientAddress: 'Apollo Bunder, Colaba, Mumbai 400001',
            clientGstin: '27AAACT3957G1ZX',
            placeOfSupplyState: 'Maharashtra',
            eventRequirements: {
              eventType: 'VIP Hospitality Suite Turn-Down & Executive Gifting',
              guestCount: 300,
              city: 'Mumbai',
              brandingNotes: 'Gold-foil Taj Chambers crest embossed on velvet rigid box'
            },
            customizationSpecs: 'Custom engraved brass neck collar + blind-debossed gold crest rigid keepsake coffret.',
            deliverables: [
              '300 × Golden Hour & Luxe Heritage 50 ml Extrait Flacons',
              '300 × Custom Rigid Gold-Foil Gifting Coffrets & Note Cards',
              'Dedicated Quality Inspection Certificate & IFRA Dossier',
              'White-Glove Temperature-Controlled Mumbai Delivery'
            ],
            packageOptions: [
              {
                packageName: 'Signature Suite Amenity Tier',
                description: '300 × 50 ml flacons in monogrammed rigid coffrets',
                subtotalInr: sub,
                recommended: true
              },
              {
                packageName: 'Imperial VIP Suite + Discovery Tier',
                description: '300 × 50 ml flacons + 300 × Discovery Six Miniature Travel Sets',
                subtotalInr: round2(sub * 1.38),
                recommended: false
              }
            ],
            selectedPackageName: 'Signature Suite Amenity Tier',
            subtotalInr: sub,
            discountInr: 0,
            taxInr: baseTax,
            shippingInr,
            setupCostInr,
            staffingCostInr,
            grandTotalInr: round2(sub + setupCostInr + staffingCostInr + shippingInr + baseTax),
            paymentMilestones: [
              { milestoneName: 'Booking & Custom Foil Tooling Advance', pct: 50, amountInr: round2((sub + setupCostInr + staffingCostInr + shippingInr + baseTax) * 0.5), triggerCondition: 'Upon Proposal Acceptance' },
              { milestoneName: 'Pre-Dispatch QA Balance', pct: 50, amountInr: round2((sub + setupCostInr + staffingCostInr + shippingInr + baseTax) * 0.5), triggerCondition: 'Against Batched QA Release Note' }
            ],
            termsAndConditions: '1. Custom foil tooling requires 7 working days post artwork sign-off.\n2. Prices quoted are exclusive of 18% GST (CGST 9% + SGST 9% within Maharashtra).\n3. Quote validity 30 days from date of issue.',
            approvalStatus: 'APPROVED',
            sentAt: new Date(),
            status: 'SENT'
          })
          .where(eq(erpProposals.id, p.id));
      }
    }

    for (const q of qts) {
      if (q.id === 'qt-taj-01') {
        await tx
          .update(erpQuotations)
          .set({
            quotationDate: currentIsoDate(),
            quotationVersionNumber: 1,
            freightInr: 4500,
            approvalStatus: 'APPROVED',
            requiresPricingApproval: false,
            maxDiscountPctApplied: 8,
            notes: 'Approved corporate suite slab (-8% institutional privilege vs retail base).'
          })
          .where(eq(erpQuotations.id, q.id));

        await tx
          .insert(erpPricingAuditLogs)
          .values({
            id: 'paudit-seed-01',
            organizationId: ORG_ID,
            entityType: 'QUOTATION',
            entityId: q.id,
            entityNumber: q.quotationNumber,
            sku: 'FRG-GOLD-50',
            itemDescription: 'Golden Hour 50ml Extrait de Parfum — Corporate Tier',
            catalogueUnitPriceInr: 1270.34,
            previousUnitPriceInr: 1270.34,
            newUnitPriceInr: 1168.71,
            discountPct: 8,
            reason: 'Institutional hospitality suite slab for 300+ units',
            approvalRequired: false,
            approvalStatus: 'APPROVED',
            approvedByEmail: 'admin@fragmore.com',
            changedByEmail: q.createdByEmail,
            changedByRole: 'SUPER_ADMIN'
          })
          .onConflictDoNothing();
      }
    }

    await tx
      .insert(erpDealActivities)
      .values([
        {
          id: 'dact-seed-01',
          organizationId: ORG_ID,
          leadId: 'lead-taj-01',
          proposalId: 'prop-taj-01',
          quotationId: 'qt-taj-01',
          stage: 'SENT',
          activityType: 'PROPOSAL_VERSION',
          summary: 'Proposal PRP-2026-1001 v1 & GST Quotation QT-2026-1001 shared with Taj Lands End Hospitality.',
          performedByEmail: 'admin@fragmore.com'
        },
        {
          id: 'dact-seed-02',
          organizationId: ORG_ID,
          leadId: 'lead-wed-03',
          stage: 'CLIENT_NEGOTIATION',
          activityType: 'CONTACT_LOG',
          summary: 'Logged WhatsApp consultation with Aurelia Bespoke Weddings for 220 monogrammed wedding favors + Perfume Bar.',
          performedByEmail: 'admin@fragmore.com'
        }
      ])
      .onConflictDoNothing();
  });
}

// ============================================================================
// CRM LEAD MANAGEMENT, CONTACT HISTORY & FOLLOW-UP REMINDERS
// ============================================================================

export async function upsertCrmLeadAdvanced(
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
    customerCategory: string;
    source?: string;
    estimatedValueInr: number;
    probabilityPct?: number;
    workflowStage?: string;
    clientGstin?: string;
    clientAddress?: string;
    requirementsSummary?: string;
    eventDate?: string;
    expectedQuantity?: number;
    assignedToEmail?: string;
    nextFollowUpDate?: string;
    reminderNotes?: string;
    notes?: string;
    createFollowUpTask?: boolean;
  }
) {
  if (!payload.companyName?.trim() || !payload.contactName?.trim() || !payload.email?.trim()) {
    throw new ValidationError('Company/client name, contact person, and email are required.');
  }

  return await db.transaction(async (tx) => {
    const workflowStage = payload.workflowStage || 'LEAD';
    const probabilityPct =
      payload.probabilityPct !== undefined
        ? Math.max(0, Math.min(100, Math.round(Number(payload.probabilityPct))))
        : defaultProbabilityForStage(workflowStage);
    const legacyStage = mapWorkflowToLegacyLeadStage(workflowStage);
    const category = payload.customerCategory || 'CORPORATE_GIFTING';
    const assignee = payload.assignedToEmail || actor.email;

    if (payload.id) {
      const existing = await tx.select().from(erpLeads).where(eq(erpLeads.id, payload.id));
      if (!existing.length) throw new NotFoundError('CRM Lead not found.');

      const [updated] = await tx
        .update(erpLeads)
        .set({
          companyName: payload.companyName.trim(),
          contactName: payload.contactName.trim(),
          email: payload.email.trim().toLowerCase(),
          phone: payload.phone.trim(),
          city: payload.city || existing[0].city,
          state: payload.state || existing[0].state,
          leadType: payload.leadType || category,
          customerCategory: category,
          source: payload.source || existing[0].source,
          estimatedValueInr: Math.max(0, Math.round(Number(payload.estimatedValueInr || 0))),
          probabilityPct,
          stage: legacyStage,
          workflowStage,
          clientGstin: payload.clientGstin ?? existing[0].clientGstin,
          clientAddress: payload.clientAddress ?? existing[0].clientAddress,
          requirementsSummary: payload.requirementsSummary ?? existing[0].requirementsSummary,
          eventDate: payload.eventDate ?? existing[0].eventDate,
          expectedQuantity: payload.expectedQuantity ?? existing[0].expectedQuantity,
          assignedToEmail: assignee,
          nextFollowUpDate: payload.nextFollowUpDate ?? existing[0].nextFollowUpDate,
          reminderNotes: payload.reminderNotes ?? existing[0].reminderNotes,
          notes: payload.notes ?? existing[0].notes,
          version: sql`${erpLeads.version} + 1`,
          updatedAt: new Date()
        })
        .where(eq(erpLeads.id, payload.id))
        .returning();

      await tx.insert(erpDealActivities).values({
        id: makeId('dact'),
        organizationId: ORG_ID,
        leadId: updated.id,
        stage: updated.workflowStage,
        activityType: 'LEAD_CAPTURE',
        summary: `Updated CRM deal ${updated.leadNumber} (${updated.companyName} · ${category}, Prob ${updated.probabilityPct}%).`,
        performedByEmail: actor.email
      });

      await recordErpAuditLog(tx, {
        action: 'CRM_LEAD_UPDATED',
        entity: 'erp_leads',
        entityId: updated.id,
        actorEmail: actor.email,
        actorRole: actor.roleCode,
        details: `Updated ${updated.leadNumber} (${updated.companyName}) stage=${updated.workflowStage}`
      });

      return updated;
    }

    const leadNumber = await getNextSequence(tx, 'LD');
    const leadId = makeId('lead');
    const [created] = await tx
      .insert(erpLeads)
      .values({
        id: leadId,
        organizationId: ORG_ID,
        leadNumber,
        companyName: payload.companyName.trim(),
        contactName: payload.contactName.trim(),
        email: payload.email.trim().toLowerCase(),
        phone: payload.phone.trim(),
        city: payload.city || 'Mumbai',
        state: payload.state || 'Maharashtra',
        leadType: payload.leadType || category,
        customerCategory: category,
        source: payload.source || 'Website Inquiry',
        estimatedValueInr: Math.max(0, Math.round(Number(payload.estimatedValueInr || 0))),
        probabilityPct,
        stage: legacyStage,
        workflowStage,
        clientGstin: payload.clientGstin || null,
        clientAddress: payload.clientAddress || null,
        requirementsSummary: payload.requirementsSummary || null,
        eventDate: payload.eventDate || null,
        expectedQuantity: payload.expectedQuantity ? Number(payload.expectedQuantity) : null,
        contactHistory: [],
        reminderNotes: payload.reminderNotes || null,
        assignedToEmail: assignee,
        nextFollowUpDate: payload.nextFollowUpDate || addDaysIso(2),
        notes: payload.notes || null,
        status: 'ACTIVE'
      })
      .returning();

    if (payload.createFollowUpTask !== false && (payload.nextFollowUpDate || payload.reminderNotes)) {
      const taskNumber = await getNextSequence(tx, 'TSK');
      await tx.insert(erpTasks).values({
        id: makeId('tsk'),
        organizationId: ORG_ID,
        taskNumber,
        title: `Follow up: ${created.companyName} (${created.leadNumber})`,
        description: payload.reminderNotes || payload.requirementsSummary || `Initial outreach for ${category} inquiry.`,
        sourceModule: 'CRM',
        linkedEntityType: 'erp_leads',
        linkedEntityId: created.id,
        assignedToEmail: assignee,
        createdByEmail: actor.email,
        priority: Number(created.estimatedValueInr) >= 250000 ? 'HIGH' : 'MEDIUM',
        dueDate: created.nextFollowUpDate || addDaysIso(2),
        status: 'TODO'
      });
    }

    await tx.insert(erpDealActivities).values({
      id: makeId('dact'),
      organizationId: ORG_ID,
      leadId: created.id,
      stage: created.workflowStage,
      activityType: 'LEAD_CAPTURE',
      summary: `Captured ${category} lead ${leadNumber}: ${created.companyName} (₹${created.estimatedValueInr.toLocaleString('en-IN')}, ${created.probabilityPct}%).`,
      performedByEmail: actor.email
    });

    await recordErpAuditLog(tx, {
      action: 'CRM_LEAD_CREATED',
      entity: 'erp_leads',
      entityId: created.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Created CRM lead ${leadNumber} (${created.companyName} · ${category})`
    });

    return created;
  });
}

export async function logLeadContactAndTask(
  actor: ErpActorContext,
  leadId: string,
  payload: {
    channel: 'CALL' | 'EMAIL' | 'WHATSAPP' | 'MEETING' | 'SAMPLE';
    summary: string;
    outcome?: string;
    contactDate?: string;
    nextFollowUpDate?: string;
    reminderNotes?: string;
    taskTitle?: string;
    taskPriority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    updatedProbabilityPct?: number;
    updatedWorkflowStage?: string;
  }
) {
  if (!payload.summary?.trim()) {
    throw new ValidationError('Contact interaction summary is required.');
  }

  return await db.transaction(async (tx) => {
    const rows = await tx.select().from(erpLeads).where(eq(erpLeads.id, leadId));
    if (!rows.length) throw new NotFoundError('CRM Lead not found.');
    const lead = rows[0];

    const history = Array.isArray(lead.contactHistory) ? [...(lead.contactHistory as any[])] : [];
    const entry = {
      id: makeId('ch'),
      channel: payload.channel || 'CALL',
      summary: payload.summary.trim(),
      outcome: payload.outcome?.trim() || 'Follow-up scheduled',
      contactDate: payload.contactDate || currentIsoDate(),
      actorEmail: actor.email
    };
    history.unshift(entry);

    const nextWorkflow = payload.updatedWorkflowStage || lead.workflowStage;
    const nextProb =
      payload.updatedProbabilityPct !== undefined
        ? Math.max(0, Math.min(100, Math.round(Number(payload.updatedProbabilityPct))))
        : lead.probabilityPct;

    const [updated] = await tx
      .update(erpLeads)
      .set({
        contactHistory: history,
        nextFollowUpDate: payload.nextFollowUpDate ?? lead.nextFollowUpDate,
        reminderNotes: payload.reminderNotes ?? lead.reminderNotes,
        workflowStage: nextWorkflow,
        stage: mapWorkflowToLegacyLeadStage(nextWorkflow),
        probabilityPct: nextProb,
        version: sql`${erpLeads.version} + 1`,
        updatedAt: new Date()
      })
      .where(eq(erpLeads.id, leadId))
      .returning();

    let createdTask: any = null;
    if (payload.taskTitle?.trim() || payload.nextFollowUpDate) {
      const taskNumber = await getNextSequence(tx, 'TSK');
      const [tsk] = await tx
        .insert(erpTasks)
        .values({
          id: makeId('tsk'),
          organizationId: ORG_ID,
          taskNumber,
          title: payload.taskTitle?.trim() || `Follow-up (${payload.channel}): ${lead.companyName}`,
          description: payload.reminderNotes || payload.summary.trim(),
          sourceModule: 'CRM',
          linkedEntityType: 'erp_leads',
          linkedEntityId: lead.id,
          assignedToEmail: lead.assignedToEmail,
          createdByEmail: actor.email,
          priority: payload.taskPriority || 'MEDIUM',
          dueDate: payload.nextFollowUpDate || lead.nextFollowUpDate || addDaysIso(2),
          status: 'TODO'
        })
        .returning();
      createdTask = tsk;
    }

    await tx.insert(erpDealActivities).values({
      id: makeId('dact'),
      organizationId: ORG_ID,
      leadId: lead.id,
      stage: nextWorkflow,
      activityType: 'CONTACT_LOG',
      summary: `[${payload.channel}] ${payload.summary.trim()}${payload.outcome ? ` -> ${payload.outcome.trim()}` : ''}`,
      payload: { entry, createdTaskId: createdTask?.id || null },
      performedByEmail: actor.email
    });

    return { lead: updated, entry, task: createdTask };
  });
}

export async function advanceDealWorkflowStage(
  actor: ErpActorContext,
  leadId: string,
  targetStage: string,
  notes?: string
) {
  const validStages = new Set<string>([...CRM_WORKFLOW_STAGES, 'LOST']);
  if (!validStages.has(targetStage)) {
    throw new ValidationError(`Invalid workflow stage "${targetStage}".`);
  }

  return await db.transaction(async (tx) => {
    const rows = await tx.select().from(erpLeads).where(eq(erpLeads.id, leadId));
    if (!rows.length) throw new NotFoundError('CRM Lead not found.');
    const lead = rows[0];

    const [updated] = await tx
      .update(erpLeads)
      .set({
        workflowStage: targetStage,
        stage: mapWorkflowToLegacyLeadStage(targetStage),
        probabilityPct: defaultProbabilityForStage(targetStage),
        notes: notes ? `${lead.notes ? lead.notes + '\n' : ''}[${currentIsoDate()} ${targetStage}] ${notes}` : lead.notes,
        version: sql`${erpLeads.version} + 1`,
        updatedAt: new Date()
      })
      .where(eq(erpLeads.id, leadId))
      .returning();

    await tx.insert(erpDealActivities).values({
      id: makeId('dact'),
      organizationId: ORG_ID,
      leadId: lead.id,
      stage: targetStage,
      activityType: 'STAGE_TRANSITION',
      summary: `Moved ${lead.leadNumber} (${lead.companyName}) from ${lead.workflowStage} to ${targetStage}.${notes ? ` Note: ${notes}` : ''}`,
      performedByEmail: actor.email
    });

    await recordErpAuditLog(tx, {
      action: 'CRM_WORKFLOW_ADVANCED',
      entity: 'erp_leads',
      entityId: lead.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `${lead.leadNumber}: ${lead.workflowStage} -> ${targetStage}`
    });

    return updated;
  });
}

// ============================================================================
// CORPORATE PROPOSAL BUILDER, MULTI-VERSIONING & APPROVAL CONTROL
// ============================================================================

export async function saveProposalAdvanced(
  actor: ErpActorContext,
  payload: {
    id?: string;
    createNewVersion?: boolean;
    parentProposalId?: string;
    leadId?: string;
    proposalType: string;
    title: string;
    clientCompany: string;
    clientContactName: string;
    clientEmail: string;
    clientPhone?: string;
    clientAddress?: string;
    clientGstin?: string;
    placeOfSupplyState?: string;
    scopeSummary: string;
    eventRequirements?: {
      eventType?: string;
      eventDate?: string;
      guestCount?: number;
      city?: string;
      brandingNotes?: string;
    };
    customizationSpecs?: string;
    deliverables?: string[];
    lineItems: Array<{
      productId?: string;
      slug?: string;
      themeColor?: string;
      sku?: string;
      description: string;
      size?: string;
      hsnCode?: string;
      qty: number;
      catalogueUnitPriceInr?: number;
      unitPriceInr: number;
      gstRatePct?: number;
      pricingReason?: string;
    }>;
    packageOptions?: Array<{
      packageName: string;
      description: string;
      items?: any[];
      subtotalInr: number;
      recommended?: boolean;
    }>;
    selectedPackageName?: string;
    discountInr?: number;
    shippingInr?: number;
    setupCostInr?: number;
    staffingCostInr?: number;
    paymentMilestones?: Array<{
      milestoneName: string;
      pct: number;
      amountInr?: number;
      triggerCondition: string;
    }>;
    termsAndConditions?: string;
    validUntil?: string;
    changeSummary?: string;
    negotiationNotes?: string;
    submitForApproval?: boolean;
  }
) {
  if (!payload.title?.trim() || !payload.clientCompany?.trim() || !payload.lineItems?.length) {
    throw new ValidationError('Proposal title, client company, and at least one line item are required.');
  }

  const catalogue = await getCatalogueWithCosting();
  const catBySku = new Map<string, any>();
  for (const c of catalogue) catBySku.set(c.sku.toUpperCase(), c);

  return await db.transaction(async (tx) => {
    const [org] = await tx.select().from(erpOrganizations).where(eq(erpOrganizations.id, ORG_ID));
    const orgState = (org?.stateName || 'Maharashtra').trim().toLowerCase();
    const supplyState = payload.placeOfSupplyState || 'Maharashtra';

    let existingParent: any = null;
    if (payload.parentProposalId) {
      const pRows = await tx.select().from(erpProposals).where(eq(erpProposals.id, payload.parentProposalId));
      if (!pRows.length) throw new NotFoundError('Parent proposal not found for revision.');
      existingParent = pRows[0];
    } else if (payload.id) {
      const eRows = await tx.select().from(erpProposals).where(eq(erpProposals.id, payload.id));
      if (!eRows.length) throw new NotFoundError('Proposal not found.');
      existingParent = eRows[0];
    }

    const previousItemsBySku = new Map<string, number>();
    if (existingParent && Array.isArray(existingParent.lineItems)) {
      for (const prev of existingParent.lineItems as any[]) {
        previousItemsBySku.set(String(prev.sku || prev.description).toUpperCase(), Number(prev.unitPriceInr || 0));
      }
    }

    const normalizedLines = payload.lineItems.map((it) => {
      const skuKey = String(it.sku || it.description || 'FRG-CUSTOM').toUpperCase();
      const cat = catBySku.get(skuKey);
      const qty = Math.max(1, Math.round(Number(it.qty || 1)));
      const catUnitPrice = round2(Number(it.catalogueUnitPriceInr ?? cat?.catalogueUnitPriceInr ?? it.unitPriceInr ?? 0));
      const unitPriceInr = round2(Math.max(0, Number(it.unitPriceInr || 0)));
      const gstRatePct = Number(it.gstRatePct ?? cat?.gstRatePct ?? 18);
      const totalInr = round2(qty * unitPriceInr);
      const lineDiscountPct = catUnitPrice > 0 ? round2(((catUnitPrice - unitPriceInr) / catUnitPrice) * 100) : 0;

      return {
        productId: it.productId || cat?.productId || null,
        slug: it.slug || cat?.slug || 'golden-hour',
        themeColor: it.themeColor || cat?.themeColor || '#C5A059',
        sku: cat?.sku || it.sku || 'FRG-CUSTOM',
        description: it.description,
        size: it.size || cat?.size || '50 ml',
        hsnCode: it.hsnCode || cat?.hsnCode || '33030050',
        qty,
        catalogueUnitPriceInr: catUnitPrice,
        unitPriceInr,
        gstRatePct,
        discountPct: lineDiscountPct,
        pricingReason: it.pricingReason || '',
        totalInr
      };
    });

    const subtotalInr = round2(normalizedLines.reduce((s, l) => s + l.totalInr, 0));
    const discountInr = round2(Math.max(0, Math.min(subtotalInr, Number(payload.discountInr || 0))));
    const setupCostInr = round2(Math.max(0, Number(payload.setupCostInr || 0)));
    const staffingCostInr = round2(Math.max(0, Number(payload.staffingCostInr || 0)));
    const shippingInr = round2(Math.max(0, Number(payload.shippingInr || 0)));

    const taxableTotal = round2(Math.max(0, subtotalInr - discountInr) + setupCostInr + staffingCostInr);
    const avgGstPct = normalizedLines.length ? normalizedLines[0].gstRatePct : 18;
    const taxInr = round2((taxableTotal * avgGstPct) / 100);
    const grandTotalInr = round2(taxableTotal + shippingInr + taxInr);

    // Check pricing override threshold
    const overallExtraDiscountPct = subtotalInr > 0 ? round2((discountInr / subtotalInr) * 100) : 0;
    const maxLineDiscountPct = normalizedLines.reduce((m, l) => Math.max(m, l.discountPct), 0);
    const maxDiscount = Math.max(maxLineDiscountPct, overallExtraDiscountPct);
    const isPrivilegedApprover = hasPricingApprovalPrivilege(actor);
    const requiresApproval =
      maxDiscount > MAX_SELF_APPROVE_DISCOUNT_PCT ||
      (!isPrivilegedApprover && maxDiscount > 5) ||
      Boolean(payload.submitForApproval);

    const approvalStatus = requiresApproval ? 'PENDING_APPROVAL' : 'APPROVED';
    const nextStatus = requiresApproval
      ? 'INTERNAL_APPROVAL'
      : payload.createNewVersion
      ? 'REVISED_PROPOSAL'
      : 'PROPOSAL_DRAFT';

    // Determine version sequence
    let proposalId = payload.id && !payload.createNewVersion ? payload.id : makeId('prop');
    let proposalNumber: string;
    let versionGroupId: string;
    let proposalVersionNumber = 1;
    let parentId: string | null = null;

    if (payload.createNewVersion && existingParent) {
      versionGroupId = existingParent.versionGroupId || existingParent.id;
      const siblings = await tx
        .select()
        .from(erpProposals)
        .where(eq(erpProposals.versionGroupId, versionGroupId));
      const maxVer = siblings.reduce((m, s) => Math.max(m, Number(s.proposalVersionNumber || 1)), Number(existingParent.proposalVersionNumber || 1));
      proposalVersionNumber = maxVer + 1;
      parentId = existingParent.id;
      const baseNum = existingParent.proposalNumber.replace(/-V\d+$/i, '');
      proposalNumber = `${baseNum}-V${proposalVersionNumber}`;
    } else if (payload.id && existingParent) {
      proposalNumber = existingParent.proposalNumber;
      versionGroupId = existingParent.versionGroupId || existingParent.id;
      proposalVersionNumber = existingParent.proposalVersionNumber || 1;
      parentId = existingParent.parentProposalId;
    } else {
      proposalNumber = await getNextSequence(tx, 'PRP');
      versionGroupId = makeId('vg');
    }

    const normalizedMilestones = (payload.paymentMilestones?.length
      ? payload.paymentMilestones
      : [
          { milestoneName: 'Booking & Production Advance', pct: 50, triggerCondition: 'On Proposal Acceptance' },
          { milestoneName: 'Dispatch Readiness Balance', pct: 50, triggerCondition: 'Prior to Dispatch' }
        ]
    ).map((m) => ({
      milestoneName: m.milestoneName,
      pct: Number(m.pct || 0),
      amountInr: round2((grandTotalInr * Number(m.pct || 0)) / 100),
      triggerCondition: m.triggerCondition
    }));

    const propValues = {
      id: proposalId,
      organizationId: ORG_ID,
      leadId: payload.leadId || existingParent?.leadId || null,
      customerId: existingParent?.customerId || null,
      proposalNumber,
      proposalDate: currentIsoDate(),
      proposalType: payload.proposalType || 'CORPORATE_GIFTING',
      versionGroupId,
      proposalVersionNumber,
      parentProposalId: parentId,
      title: payload.title.trim(),
      clientCompany: payload.clientCompany.trim(),
      clientContactName: payload.clientContactName.trim(),
      clientEmail: payload.clientEmail.trim(),
      clientPhone: payload.clientPhone || existingParent?.clientPhone || null,
      clientAddress: payload.clientAddress || existingParent?.clientAddress || null,
      clientGstin: payload.clientGstin || existingParent?.clientGstin || null,
      placeOfSupplyState: supplyState,
      scopeSummary: payload.scopeSummary.trim(),
      eventRequirements: payload.eventRequirements || existingParent?.eventRequirements || null,
      customizationSpecs: payload.customizationSpecs || existingParent?.customizationSpecs || null,
      deliverables: payload.deliverables || existingParent?.deliverables || [],
      lineItems: normalizedLines,
      packageOptions: payload.packageOptions || existingParent?.packageOptions || [],
      selectedPackageName: payload.selectedPackageName || payload.packageOptions?.[0]?.packageName || null,
      subtotalInr,
      discountInr,
      taxInr,
      shippingInr,
      setupCostInr,
      staffingCostInr,
      grandTotalInr,
      estimatedValueInr: Math.round(grandTotalInr),
      paymentMilestones: normalizedMilestones,
      termsAndConditions:
        payload.termsAndConditions ||
        existingParent?.termsAndConditions ||
        `1. Supply State: ${supplyState} (${supplyState.trim().toLowerCase() === orgState ? 'CGST+SGST' : 'IGST'} applicable).\n2. Quote valid until ${payload.validUntil || addDaysIso(30)}.`,
      validUntil: payload.validUntil || addDaysIso(30),
      preparedByEmail: actor.email,
      approvedByEmail: requiresApproval ? null : actor.email,
      approvalStatus,
      negotiationNotes: payload.negotiationNotes || null,
      changeSummary:
        payload.changeSummary ||
        (payload.createNewVersion ? `Created revision v${proposalVersionNumber} from ${existingParent?.proposalNumber}` : 'Initial proposal specification'),
      status: nextStatus
    };

    let savedProposal: any;
    if (payload.id && !payload.createNewVersion && existingParent) {
      const [upd] = await tx
        .update(erpProposals)
        .set({
          ...propValues,
          version: sql`${erpProposals.version} + 1`,
          updatedAt: new Date()
        })
        .where(eq(erpProposals.id, proposalId))
        .returning();
      savedProposal = upd;
    } else {
      const [ins] = await tx.insert(erpProposals).values(propValues).returning();
      savedProposal = ins;
    }

    // Record Pricing Audit Logs for any discount or negotiated price changes
    for (const line of normalizedLines) {
      const skuKey = String(line.sku || line.description).toUpperCase();
      const prevPrice = previousItemsBySku.get(skuKey) ?? line.catalogueUnitPriceInr;
      if (line.unitPriceInr !== prevPrice || line.discountPct > 0) {
        await tx.insert(erpPricingAuditLogs).values({
          id: makeId('paudit'),
          organizationId: ORG_ID,
          entityType: 'PROPOSAL',
          entityId: savedProposal.id,
          entityNumber: savedProposal.proposalNumber,
          sku: line.sku,
          itemDescription: line.description,
          catalogueUnitPriceInr: line.catalogueUnitPriceInr,
          previousUnitPriceInr: prevPrice,
          newUnitPriceInr: line.unitPriceInr,
          discountPct: line.discountPct,
          reason: line.pricingReason || payload.changeSummary || payload.negotiationNotes || 'Commercial proposal negotiated rate',
          approvalRequired: requiresApproval,
          approvalStatus,
          approvedByEmail: requiresApproval ? null : actor.email,
          changedByEmail: actor.email,
          changedByRole: actor.roleCode
        });
      }
    }

    // Trigger Internal Approval workflow when threshold exceeded
    if (requiresApproval) {
      const approvalNumber = await getNextSequence(tx, 'APR');
      await tx.insert(erpApprovals).values({
        id: makeId('apr'),
        organizationId: ORG_ID,
        approvalNumber,
        entityType: 'PROPOSAL_PRICING_OVERRIDE',
        entityId: savedProposal.id,
        moduleKey: 'proposals',
        title: `Approve Proposal ${savedProposal.proposalNumber} (${maxDiscount}% max discount · ₹${grandTotalInr.toLocaleString('en-IN')})`,
        summary: `${actor.email} requested negotiated pricing approval for ${savedProposal.clientCompany} (${maxDiscount}% discount).`,
        requestedByEmail: actor.email,
        amountInr: grandTotalInr,
        status: 'PENDING'
      });

      await createErpNotification(tx, {
        category: 'COMMERCIAL',
        title: `Pricing Approval Required: ${savedProposal.proposalNumber}`,
        message: `${actor.email} submitted ${savedProposal.proposalNumber} with ${maxDiscount}% discount for ${savedProposal.clientCompany}.`,
        severity: 'WARNING',
        linkModule: 'proposals',
        linkEntityId: savedProposal.id
      });
    }

    // Sync linked CRM Lead stage
    if (savedProposal.leadId) {
      const targetLeadStage = requiresApproval
        ? 'INTERNAL_APPROVAL'
        : payload.createNewVersion
        ? 'REVISED_PROPOSAL'
        : 'PROPOSAL_DRAFT';
      await tx
        .update(erpLeads)
        .set({
          workflowStage: targetLeadStage,
          stage: mapWorkflowToLegacyLeadStage(targetLeadStage),
          probabilityPct: defaultProbabilityForStage(targetLeadStage),
          estimatedValueInr: Math.round(grandTotalInr),
          version: sql`${erpLeads.version} + 1`,
          updatedAt: new Date()
        })
        .where(eq(erpLeads.id, savedProposal.leadId));
    }

    await tx.insert(erpDealActivities).values({
      id: makeId('dact'),
      organizationId: ORG_ID,
      leadId: savedProposal.leadId || null,
      proposalId: savedProposal.id,
      stage: nextStatus,
      activityType: payload.createNewVersion ? 'PROPOSAL_VERSION' : 'PROPOSAL_DRAFT',
      summary: `${payload.createNewVersion ? 'Revised proposal' : 'Saved proposal'} ${savedProposal.proposalNumber} (v${savedProposal.proposalVersionNumber}) = ₹${grandTotalInr.toLocaleString('en-IN')} (${approvalStatus}).`,
      performedByEmail: actor.email
    });

    await recordErpAuditLog(tx, {
      action: payload.createNewVersion ? 'ERP_PROPOSAL_VERSION_CREATED' : 'ERP_PROPOSAL_SAVED',
      entity: 'erp_proposals',
      entityId: savedProposal.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `${savedProposal.proposalNumber} v${savedProposal.proposalVersionNumber} ₹${grandTotalInr} approval=${approvalStatus}`
    });

    return { proposal: savedProposal, requiresApproval };
  });
}

export async function updateProposalStatusAndAcceptance(
  actor: ErpActorContext,
  proposalId: string,
  payload: {
    action: 'APPROVE' | 'REJECT' | 'SEND' | 'NEGOTIATE' | 'ACCEPT';
    notes?: string;
    acceptedByName?: string;
    acceptedByEmail?: string;
    acceptanceRef?: string;
    selectedPackageName?: string;
  }
) {
  return await db.transaction(async (tx) => {
    const rows = await tx.select().from(erpProposals).where(eq(erpProposals.id, proposalId));
    if (!rows.length) throw new NotFoundError('Proposal not found.');
    const prop = rows[0];

    let nextStatus = prop.status;
    let approvalStatus = prop.approvalStatus;
    let approvedByEmail = prop.approvedByEmail;
    let sentAt = prop.sentAt;
    let acceptedAt = prop.acceptedAt;
    let acceptedByName = prop.acceptedByName;
    let acceptedByEmail = prop.acceptedByEmail;
    let acceptanceRef = prop.acceptanceRef;
    let nextLeadWorkflow: string | null = null;

    if (payload.action === 'APPROVE' || payload.action === 'REJECT') {
      if (!hasPricingApprovalPrivilege(actor)) {
        throw new ForbiddenError('Forbidden: Proposal pricing approval requires Sales/Proposals Approve permission.');
      }
      approvalStatus = payload.action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
      approvedByEmail = actor.email;
      nextStatus = payload.action === 'APPROVE' ? 'PROPOSAL_DRAFT' : 'REJECTED';
      nextLeadWorkflow = payload.action === 'APPROVE' ? 'PROPOSAL_DRAFT' : 'CLIENT_NEGOTIATION';

      await tx
        .update(erpPricingAuditLogs)
        .set({ approvalStatus, approvedByEmail: actor.email })
        .where(and(eq(erpPricingAuditLogs.entityType, 'PROPOSAL'), eq(erpPricingAuditLogs.entityId, prop.id)));

      await tx
        .update(erpApprovals)
        .set({ status: approvalStatus, decidedByEmail: actor.email, decisionNote: payload.notes || null, decidedAt: new Date() })
        .where(and(eq(erpApprovals.entityId, prop.id), eq(erpApprovals.status, 'PENDING')));
    } else if (payload.action === 'SEND') {
      if (prop.approvalStatus === 'PENDING_APPROVAL') {
        throw new ValidationError(`Proposal ${prop.proposalNumber} is locked in Internal Approval before sending to client.`);
      }
      if (prop.approvalStatus === 'REJECTED') {
        throw new ValidationError(`Proposal ${prop.proposalNumber} pricing was rejected. Create a revised version before sending.`);
      }
      nextStatus = 'SENT';
      sentAt = new Date();
      nextLeadWorkflow = 'SENT';
    } else if (payload.action === 'NEGOTIATE') {
      nextStatus = 'CLIENT_NEGOTIATION';
      nextLeadWorkflow = 'CLIENT_NEGOTIATION';
    } else if (payload.action === 'ACCEPT') {
      if (prop.approvalStatus === 'PENDING_APPROVAL') {
        throw new ValidationError(`Proposal ${prop.proposalNumber} must clear Internal Approval before client acceptance.`);
      }
      if (!payload.acceptedByName?.trim()) {
        throw new ValidationError('Client signatory name is required to record proposal acceptance.');
      }
      nextStatus = 'ACCEPTED';
      acceptedAt = new Date();
      acceptedByName = payload.acceptedByName.trim();
      acceptedByEmail = payload.acceptedByEmail?.trim() || prop.clientEmail;
      acceptanceRef = payload.acceptanceRef?.trim() || `ACCEPT-${prop.proposalNumber}`;
      nextLeadWorkflow = 'ACCEPTED';
    }

    const [updated] = await tx
      .update(erpProposals)
      .set({
        status: nextStatus,
        approvalStatus,
        approvedByEmail,
        sentAt,
        acceptedAt,
        acceptedByName,
        acceptedByEmail,
        acceptanceRef,
        selectedPackageName: payload.selectedPackageName || prop.selectedPackageName,
        negotiationNotes: payload.notes ? `${prop.negotiationNotes ? prop.negotiationNotes + '\n' : ''}${payload.notes}` : prop.negotiationNotes,
        version: sql`${erpProposals.version} + 1`,
        updatedAt: new Date()
      })
      .where(eq(erpProposals.id, prop.id))
      .returning();

    if (prop.leadId && nextLeadWorkflow) {
      await tx
        .update(erpLeads)
        .set({
          workflowStage: nextLeadWorkflow,
          stage: mapWorkflowToLegacyLeadStage(nextLeadWorkflow),
          probabilityPct: defaultProbabilityForStage(nextLeadWorkflow),
          version: sql`${erpLeads.version} + 1`,
          updatedAt: new Date()
        })
        .where(eq(erpLeads.id, prop.leadId));
    }

    await tx.insert(erpDealActivities).values({
      id: makeId('dact'),
      organizationId: ORG_ID,
      leadId: prop.leadId || null,
      proposalId: prop.id,
      stage: nextStatus,
      activityType: payload.action === 'ACCEPT' ? 'ACCEPTANCE' : payload.action === 'NEGOTIATE' ? 'NEGOTIATION' : 'APPROVAL_DECISION',
      summary: `Proposal ${prop.proposalNumber}: action=${payload.action} -> ${nextStatus}.${acceptedByName ? ` Accepted by ${acceptedByName} (${acceptanceRef}).` : ''}${payload.notes ? ` Note: ${payload.notes}` : ''}`,
      performedByEmail: actor.email
    });

    return updated;
  });
}

export async function compareProposalVersions(proposalIdA: string, proposalIdB: string) {
  const rows = await db
    .select()
    .from(erpProposals)
    .where(inArray(erpProposals.id, [proposalIdA, proposalIdB]));
  if (rows.length < 2 && proposalIdA !== proposalIdB) {
    throw new NotFoundError('One or both proposals selected for comparison were not found.');
  }
  const propA = rows.find((r) => r.id === proposalIdA) || rows[0];
  const propB = rows.find((r) => r.id === proposalIdB) || rows[0];

  const aLines: any[] = Array.isArray(propA.lineItems) ? propA.lineItems : [];
  const bLines: any[] = Array.isArray(propB.lineItems) ? propB.lineItems : [];

  const allSkus = Array.from(
    new Set([...aLines.map((i) => String(i.sku || i.description)), ...bLines.map((i) => String(i.sku || i.description))])
  );

  const lineDiffs = allSkus.map((key) => {
    const la = aLines.find((i) => String(i.sku || i.description) === key);
    const lb = bLines.find((i) => String(i.sku || i.description) === key);
    const qtyA = Number(la?.qty || 0);
    const qtyB = Number(lb?.qty || 0);
    const priceA = Number(la?.unitPriceInr || 0);
    const priceB = Number(lb?.unitPriceInr || 0);
    const totalA = Number(la?.totalInr || 0);
    const totalB = Number(lb?.totalInr || 0);
    return {
      sku: key,
      description: lb?.description || la?.description || key,
      qtyA,
      qtyB,
      qtyDelta: qtyB - qtyA,
      unitPriceA: priceA,
      unitPriceB: priceB,
      unitPriceDelta: round2(priceB - priceA),
      lineTotalA: totalA,
      lineTotalB: totalB,
      lineTotalDelta: round2(totalB - totalA)
    };
  });

  return {
    baseProposal: propA,
    revisedProposal: propB,
    summaryDiff: {
      subtotalDeltaInr: round2(Number(propB.subtotalInr || 0) - Number(propA.subtotalInr || 0)),
      discountDeltaInr: round2(Number(propB.discountInr || 0) - Number(propA.discountInr || 0)),
      setupDeltaInr: round2(Number(propB.setupCostInr || 0) - Number(propA.setupCostInr || 0)),
      staffingDeltaInr: round2(Number(propB.staffingCostInr || 0) - Number(propA.staffingCostInr || 0)),
      shippingDeltaInr: round2(Number(propB.shippingInr || 0) - Number(propA.shippingInr || 0)),
      taxDeltaInr: round2(Number(propB.taxInr || 0) - Number(propA.taxInr || 0)),
      grandTotalDeltaInr: round2(Number(propB.grandTotalInr || 0) - Number(propA.grandTotalInr || 0))
    },
    lineDiffs
  };
}

// ============================================================================
// CATALOGUE-LINKED QUOTATION BUILDER & PERMISSION-CONTROLLED PRICING AUDIT
// ============================================================================

export async function createOrUpdateQuotationAdvanced(
  actor: ErpActorContext,
  payload: {
    id?: string;
    createRevision?: boolean;
    proposalId?: string;
    leadId?: string;
    clientName: string;
    clientEmail: string;
    clientGstin?: string;
    placeOfSupplyState?: string;
    discountInr?: number;
    freightInr?: number;
    paymentTerms?: string;
    validUntil?: string;
    notes?: string;
    items: Array<{
      sku: string;
      description?: string;
      qty: number;
      unitPriceInr?: number;
      discountPct?: number;
      pricingReason?: string;
    }>;
  }
) {
  if (!payload.clientName?.trim() || !payload.items?.length) {
    throw new ValidationError('Client name and at least one catalogue line item are required.');
  }

  const catalogue = await getCatalogueWithCosting();
  const catBySku = new Map<string, any>();
  for (const c of catalogue) catBySku.set(c.sku.toUpperCase(), c);

  return await db.transaction(async (tx) => {
    const [org] = await tx.select().from(erpOrganizations).where(eq(erpOrganizations.id, ORG_ID));
    const orgState = (org?.stateName || 'Maharashtra').trim().toLowerCase();
    const supplyState = payload.placeOfSupplyState || 'Maharashtra';
    const isInterState = supplyState.trim().toLowerCase() !== orgState;

    let existingQt: any = null;
    if (payload.id) {
      const eRows = await tx.select().from(erpQuotations).where(eq(erpQuotations.id, payload.id));
      if (!eRows.length) throw new NotFoundError('Quotation not found.');
      existingQt = eRows[0];
    }

    const prevPriceBySku = new Map<string, number>();
    if (existingQt && Array.isArray(existingQt.items)) {
      for (const oldItem of existingQt.items as any[]) {
        prevPriceBySku.set(String(oldItem.sku).toUpperCase(), Number(oldItem.unitPriceInr || 0));
      }
    }

    const computedLines = payload.items.map((it) => {
      const skuKey = String(it.sku || '').toUpperCase();
      const cat = catBySku.get(skuKey);
      const qty = Math.max(1, Math.round(Number(it.qty || 1)));
      const catUnitPrice = round2(Number(cat?.catalogueUnitPriceInr ?? it.unitPriceInr ?? 0));
      let negotiatedUnitPrice: number;
      if (it.unitPriceInr !== undefined && it.unitPriceInr !== null && Number(it.unitPriceInr) > 0) {
        negotiatedUnitPrice = round2(Number(it.unitPriceInr));
      } else if (it.discountPct !== undefined) {
        negotiatedUnitPrice = round2(catUnitPrice * (1 - Number(it.discountPct) / 100));
      } else {
        negotiatedUnitPrice = catUnitPrice;
      }

      const discountPct = catUnitPrice > 0 ? round2(((catUnitPrice - negotiatedUnitPrice) / catUnitPrice) * 100) : 0;
      const gstRatePct = Number(cat?.gstRatePct ?? 18);
      const taxableLine = round2(qty * negotiatedUnitPrice);
      const taxLine = round2((taxableLine * gstRatePct) / 100);
      const unitCogs = Number(cat?.unitManufacturingCostInr ?? round2(catUnitPrice * 0.28));

      return {
        productId: cat?.productId || null,
        slug: cat?.slug || 'golden-hour',
        themeColor: cat?.themeColor || '#C5A059',
        sku: cat?.sku || skuKey,
        description: it.description?.trim() || (cat ? `${cat.name} (${cat.size})` : skuKey),
        size: cat?.size || '50 ml',
        hsnCode: cat?.hsnCode || '33030050',
        qty,
        catalogueUnitPriceInr: catUnitPrice,
        unitPriceInr: negotiatedUnitPrice,
        discountInr: round2(Math.max(0, (catUnitPrice - negotiatedUnitPrice) * qty)),
        discountPct,
        gstRatePct,
        unitManufacturingCostInr: unitCogs,
        pricingReason: it.pricingReason?.trim() || '',
        lineTotalInr: round2(taxableLine + taxLine)
      };
    });

    // Enforce reason if a user explicitly overrides price below catalogue rate by >0%
    for (const ln of computedLines) {
      if (ln.discountPct > 0.5 && !ln.pricingReason) {
        ln.pricingReason = `Negotiated B2B volume rate (-${ln.discountPct}% vs catalogue base)`;
      }
    }

    const subtotalInr = round2(computedLines.reduce((s, l) => s + l.qty * l.unitPriceInr, 0));
    const discountInr = round2(Math.max(0, Math.min(subtotalInr, Number(payload.discountInr || 0))));
    const freightInr = round2(Math.max(0, Number(payload.freightInr || 0)));
    const taxableAmountInr = round2(Math.max(0, subtotalInr - discountInr));

    const totalTaxInr = round2((taxableAmountInr * 18) / 100);
    const cgstInr = isInterState ? 0 : round2(totalTaxInr / 2);
    const sgstInr = isInterState ? 0 : round2(totalTaxInr - cgstInr);
    const igstInr = isInterState ? totalTaxInr : 0;
    const totalInr = round2(taxableAmountInr + cgstInr + sgstInr + igstInr + freightInr);

    const overallExtraDiscountPct = subtotalInr > 0 ? round2((discountInr / subtotalInr) * 100) : 0;
    const maxLineDiscountPct = computedLines.reduce((m, l) => Math.max(m, l.discountPct), 0);
    const maxDiscountPctApplied = round2(Math.max(maxLineDiscountPct, overallExtraDiscountPct));

    const isPrivileged = hasPricingApprovalPrivilege(actor);
    const requiresPricingApproval = maxDiscountPctApplied > MAX_SELF_APPROVE_DISCOUNT_PCT || (!isPrivileged && maxDiscountPctApplied > 5);
    const approvalStatus = requiresPricingApproval ? 'PENDING_APPROVAL' : 'APPROVED';
    const qtStatus = requiresPricingApproval ? 'PENDING_APPROVAL' : 'APPROVED';

    let quotationId = payload.id && !payload.createRevision ? payload.id : makeId('qt');
    let quotationNumber: string;
    let quotationVersionNumber = 1;
    let parentQuotationId: string | null = null;

    if (payload.createRevision && existingQt) {
      quotationVersionNumber = Number(existingQt.quotationVersionNumber || 1) + 1;
      parentQuotationId = existingQt.id;
      const baseNum = existingQt.quotationNumber.replace(/-V\d+$/i, '');
      quotationNumber = `${baseNum}-V${quotationVersionNumber}`;
    } else if (payload.id && existingQt) {
      quotationNumber = existingQt.quotationNumber;
      quotationVersionNumber = existingQt.quotationVersionNumber || 1;
      parentQuotationId = existingQt.parentQuotationId;
    } else {
      quotationNumber = await getNextSequence(tx, 'QT');
    }

    const qtValues = {
      id: quotationId,
      organizationId: ORG_ID,
      proposalId: payload.proposalId || existingQt?.proposalId || null,
      leadId: payload.leadId || existingQt?.leadId || null,
      customerId: existingQt?.customerId || null,
      quotationNumber,
      quotationDate: currentIsoDate(),
      quotationVersionNumber,
      parentQuotationId,
      clientName: payload.clientName.trim(),
      clientEmail: payload.clientEmail.trim(),
      clientGstin: payload.clientGstin || null,
      placeOfSupplyState: supplyState,
      isInterState,
      items: computedLines,
      subtotalInr,
      discountInr,
      taxableAmountInr,
      cgstInr,
      sgstInr,
      igstInr,
      freightInr,
      totalInr,
      paymentTerms: payload.paymentTerms || '50% Advance, 50% Prior to Dispatch',
      validUntil: payload.validUntil || addDaysIso(15),
      approvalStatus,
      requiresPricingApproval,
      maxDiscountPctApplied,
      notes: payload.notes || null,
      createdByEmail: actor.email,
      approvedByEmail: requiresPricingApproval ? null : actor.email,
      status: qtStatus
    };

    let savedQt: any;
    if (payload.id && !payload.createRevision && existingQt) {
      const [upd] = await tx
        .update(erpQuotations)
        .set({
          ...qtValues,
          version: sql`${erpQuotations.version} + 1`,
          updatedAt: new Date()
        })
        .where(eq(erpQuotations.id, quotationId))
        .returning();
      savedQt = upd;
    } else {
      const [ins] = await tx.insert(erpQuotations).values(qtValues).returning();
      savedQt = ins;
    }

    // Link Proposal if provided
    if (savedQt.proposalId) {
      await tx
        .update(erpProposals)
        .set({ convertedQuotationId: savedQt.id, updatedAt: new Date() })
        .where(eq(erpProposals.id, savedQt.proposalId));
    }

    // Immutable Pricing Audit Logs
    for (const ln of computedLines) {
      const prevPrice = prevPriceBySku.get(ln.sku.toUpperCase()) ?? ln.catalogueUnitPriceInr;
      if (ln.unitPriceInr !== prevPrice || ln.discountPct > 0 || ln.pricingReason) {
        await tx.insert(erpPricingAuditLogs).values({
          id: makeId('paudit'),
          organizationId: ORG_ID,
          entityType: 'QUOTATION',
          entityId: savedQt.id,
          entityNumber: savedQt.quotationNumber,
          sku: ln.sku,
          itemDescription: ln.description,
          catalogueUnitPriceInr: ln.catalogueUnitPriceInr,
          previousUnitPriceInr: prevPrice,
          newUnitPriceInr: ln.unitPriceInr,
          discountPct: ln.discountPct,
          reason: ln.pricingReason || payload.notes || 'Standard B2B quotation pricing',
          approvalRequired: requiresPricingApproval,
          approvalStatus,
          approvedByEmail: requiresPricingApproval ? null : actor.email,
          changedByEmail: actor.email,
          changedByRole: actor.roleCode
        });
      }
    }

    if (requiresPricingApproval) {
      const approvalNumber = await getNextSequence(tx, 'APR');
      await tx.insert(erpApprovals).values({
        id: makeId('apr'),
        organizationId: ORG_ID,
        approvalNumber,
        entityType: 'QUOTATION_PRICING_OVERRIDE',
        entityId: savedQt.id,
        moduleKey: 'proposals',
        title: `Approve Quotation ${savedQt.quotationNumber} (${maxDiscountPctApplied}% discount · ₹${totalInr.toLocaleString('en-IN')})`,
        summary: `${actor.email} requested pricing override approval for ${savedQt.clientName} (${maxDiscountPctApplied}% discount).`,
        requestedByEmail: actor.email,
        amountInr: totalInr,
        status: 'PENDING'
      });
    }

    if (savedQt.leadId && requiresPricingApproval) {
      await tx
        .update(erpLeads)
        .set({ workflowStage: 'INTERNAL_APPROVAL', stage: 'QUALIFIED', updatedAt: new Date() })
        .where(eq(erpLeads.id, savedQt.leadId));
    }

    await tx.insert(erpDealActivities).values({
      id: makeId('dact'),
      organizationId: ORG_ID,
      leadId: savedQt.leadId || null,
      proposalId: savedQt.proposalId || null,
      quotationId: savedQt.id,
      stage: qtStatus,
      activityType: 'QUOTATION_ISSUED',
      summary: `Created Quotation ${savedQt.quotationNumber} (v${savedQt.quotationVersionNumber}) = ₹${totalInr.toLocaleString('en-IN')} (${approvalStatus}, max discount ${maxDiscountPctApplied}%).`,
      performedByEmail: actor.email
    });

    await recordErpAuditLog(tx, {
      action: 'ERP_QUOTATION_SAVED',
      entity: 'erp_quotations',
      entityId: savedQt.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `${savedQt.quotationNumber} ₹${totalInr} maxDiscount=${maxDiscountPctApplied}% approval=${approvalStatus}`
    });

    return { quotation: savedQt, requiresPricingApproval };
  });
}

export async function approveOrAcceptQuotation(
  actor: ErpActorContext,
  quotationId: string,
  payload: {
    action: 'APPROVE' | 'REJECT' | 'SEND' | 'ACCEPT';
    notes?: string;
    acceptedByName?: string;
    acceptedByEmail?: string;
  }
) {
  return await db.transaction(async (tx) => {
    const rows = await tx.select().from(erpQuotations).where(eq(erpQuotations.id, quotationId));
    if (!rows.length) throw new NotFoundError('Quotation not found.');
    const qt = rows[0];

    let status = qt.status;
    let approvalStatus = qt.approvalStatus;
    let approvedByEmail = qt.approvedByEmail;
    let acceptedByName = qt.acceptedByName;
    let acceptedByEmail = qt.acceptedByEmail;
    let acceptedAt = qt.acceptedAt;
    let nextLeadStage: string | null = null;

    if (payload.action === 'APPROVE' || payload.action === 'REJECT') {
      if (!hasPricingApprovalPrivilege(actor)) {
        throw new ForbiddenError('Forbidden: Approving negotiated quotation discounts requires Proposals/Sales Approve privilege.');
      }
      approvalStatus = payload.action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
      approvedByEmail = actor.email;
      status = payload.action === 'APPROVE' ? 'APPROVED' : 'EXPIRED';
      nextLeadStage = payload.action === 'APPROVE' ? 'SENT' : 'CLIENT_NEGOTIATION';

      await tx
        .update(erpPricingAuditLogs)
        .set({ approvalStatus, approvedByEmail: actor.email })
        .where(and(eq(erpPricingAuditLogs.entityType, 'QUOTATION'), eq(erpPricingAuditLogs.entityId, qt.id)));

      await tx
        .update(erpApprovals)
        .set({ status: approvalStatus, decidedByEmail: actor.email, decisionNote: payload.notes || null, decidedAt: new Date() })
        .where(and(eq(erpApprovals.entityId, qt.id), eq(erpApprovals.status, 'PENDING')));
    } else if (payload.action === 'SEND') {
      if (qt.approvalStatus === 'PENDING_APPROVAL') {
        throw new ValidationError(`Quotation ${qt.quotationNumber} requires pricing approval before sending.`);
      }
      status = 'SENT';
      nextLeadStage = 'SENT';
    } else if (payload.action === 'ACCEPT') {
      if (qt.approvalStatus !== 'APPROVED') {
        throw new ValidationError(`Quotation ${qt.quotationNumber} must be APPROVED before client acceptance.`);
      }
      status = 'ACCEPTED';
      acceptedByName = payload.acceptedByName?.trim() || qt.clientName;
      acceptedByEmail = payload.acceptedByEmail?.trim() || qt.clientEmail;
      acceptedAt = new Date();
      nextLeadStage = 'ACCEPTED';
    }

    const [updated] = await tx
      .update(erpQuotations)
      .set({
        status,
        approvalStatus,
        approvedByEmail,
        acceptedByName,
        acceptedByEmail,
        acceptedAt,
        notes: payload.notes ? `${qt.notes ? qt.notes + '\n' : ''}${payload.notes}` : qt.notes,
        version: sql`${erpQuotations.version} + 1`,
        updatedAt: new Date()
      })
      .where(eq(erpQuotations.id, qt.id))
      .returning();

    if (qt.leadId && nextLeadStage) {
      await tx
        .update(erpLeads)
        .set({
          workflowStage: nextLeadStage,
          stage: mapWorkflowToLegacyLeadStage(nextLeadStage),
          probabilityPct: defaultProbabilityForStage(nextLeadStage),
          updatedAt: new Date()
        })
        .where(eq(erpLeads.id, qt.leadId));
    }

    await tx.insert(erpDealActivities).values({
      id: makeId('dact'),
      organizationId: ORG_ID,
      leadId: qt.leadId || null,
      proposalId: qt.proposalId || null,
      quotationId: qt.id,
      stage: status,
      activityType: payload.action === 'ACCEPT' ? 'ACCEPTANCE' : 'APPROVAL_DECISION',
      summary: `Quotation ${qt.quotationNumber}: ${payload.action} -> ${status}.${payload.notes ? ` Note: ${payload.notes}` : ''}`,
      performedByEmail: actor.email
    });

    return updated;
  });
}

// ============================================================================
// END-TO-END CONVERSION: ACCEPTED PROPOSAL / QUOTATION -> SALES ORDER -> INVOICE -> PAYMENT -> FULFILMENT
// ============================================================================

export async function convertCommercialToSalesOrder(
  actor: ErpActorContext,
  payload: {
    proposalId?: string;
    quotationId?: string;
    shippingAddress?: { addressLine1?: string; city?: string; state?: string; pincode?: string };
    notes?: string;
  }
) {
  if (!payload.proposalId && !payload.quotationId) {
    throw new ValidationError('Either a Quotation ID or Proposal ID is required to generate a Sales Order.');
  }

  return await db.transaction(async (tx) => {
    let qt: any = null;
    let prop: any = null;
    let leadId: string | null = null;

    if (payload.quotationId) {
      const qRows = await tx.select().from(erpQuotations).where(eq(erpQuotations.id, payload.quotationId));
      if (!qRows.length) throw new NotFoundError('Quotation not found.');
      qt = qRows[0];
      if (qt.approvalStatus === 'PENDING_APPROVAL' || qt.approvalStatus === 'REJECTED') {
        throw new ValidationError(`Quotation ${qt.quotationNumber} pricing status is ${qt.approvalStatus} and cannot convert to Sales Order.`);
      }
      if (qt.convertedOrderId) {
        const existingOrd = await tx.select().from(orders).where(eq(orders.id, qt.convertedOrderId));
        if (existingOrd.length) return { order: existingOrd[0], quotation: qt, proposal: null, deduplicated: true };
      }
      leadId = qt.leadId || null;
      if (qt.proposalId) {
        const pRows = await tx.select().from(erpProposals).where(eq(erpProposals.id, qt.proposalId));
        prop = pRows[0] || null;
      }
    } else if (payload.proposalId) {
      const pRows = await tx.select().from(erpProposals).where(eq(erpProposals.id, payload.proposalId));
      if (!pRows.length) throw new NotFoundError('Proposal not found.');
      prop = pRows[0];
      if (prop.approvalStatus === 'PENDING_APPROVAL' || prop.approvalStatus === 'REJECTED') {
        throw new ValidationError(`Proposal ${prop.proposalNumber} approval status is ${prop.approvalStatus} and cannot convert.`);
      }
      if (prop.convertedOrderId) {
        const existingOrd = await tx.select().from(orders).where(eq(orders.id, prop.convertedOrderId));
        if (existingOrd.length) return { order: existingOrd[0], quotation: null, proposal: prop, deduplicated: true };
      }
      leadId = prop.leadId || null;
    }

    const clientName = qt ? qt.clientName : prop.clientCompany;
    const clientEmail = (qt ? qt.clientEmail : prop.clientEmail).toLowerCase();
    const clientPhone = prop?.clientPhone || '+91 98200 00000';
    const supplyState = qt ? qt.placeOfSupplyState : prop.placeOfSupplyState || 'Maharashtra';

    // Link existing customer by email OR create dedicated B2B customer profile (never touching other customers)
    let customerRow: any = null;
    const existingCust = await tx.select().from(customers).where(eq(customers.email, clientEmail));
    if (existingCust.length) {
      customerRow = existingCust[0];
    } else {
      const newCustId = makeId('cust-b2b');
      const [insertedCust] = await tx
        .insert(customers)
        .values({
          id: newCustId,
          name: clientName,
          email: clientEmail,
          phone: clientPhone,
          city: payload.shippingAddress?.city || supplyState,
          state: supplyState,
          tier: 'Platinum',
          tags: ['B2B', 'Corporate', 'ERP'],
          totalOrders: 0,
          totalSpend: 0,
          source: 'ERP Commercial Pipeline',
          notes: `Auto-linked via B2B Sales Order conversion (${qt?.quotationNumber || prop?.proposalNumber}).`
        })
        .returning();
      customerRow = insertedCust;
    }

    const sourceItems: any[] = qt ? (qt.items as any[]) : (prop.lineItems as any[]);
    const orderItems = sourceItems.map((it) => ({
      productId: it.productId || 'custom-b2b',
      productName: it.description,
      size: it.size || '50 ml',
      sku: it.sku || 'FRG-B2B',
      quantity: Number(it.qty || 1),
      unitPrice: Math.round(Number(it.unitPriceInr || 0))
    }));

    const subtotal = Math.round(Number(qt ? qt.subtotalInr : prop.subtotalInr));
    const discount = Math.round(Number(qt ? qt.discountInr : prop.discountInr));
    const taxAmount = Math.round(Number(qt ? qt.cgstInr + qt.sgstInr + qt.igstInr : prop.taxInr));
    const shippingAmount = Math.round(Number(qt ? qt.freightInr : Number(prop.shippingInr || 0) + Number(prop.setupCostInr || 0) + Number(prop.staffingCostInr || 0)));
    const totalAmount = Math.round(Number(qt ? qt.totalInr : prop.grandTotalInr));

    const orderSeq = await getNextSequence(tx, 'ORD');
    const b2bOrderNumber = orderSeq.replace('ORD-', 'ORD-B2B-');
    const orderId = makeId('ord-b2b');

    const [createdOrder] = await tx
      .insert(orders)
      .values({
        id: orderId,
        orderNumber: b2bOrderNumber,
        customerId: customerRow.id,
        customerName: clientName,
        customerEmail: clientEmail,
        customerPhone: clientPhone,
        shippingAddress: {
          addressLine1: payload.shippingAddress?.addressLine1 || prop?.clientAddress || `${supplyState} Corporate Delivery`,
          city: payload.shippingAddress?.city || supplyState,
          state: supplyState,
          pincode: payload.shippingAddress?.pincode || '400001'
        },
        items: orderItems,
        subtotal,
        discount,
        couponCode: null,
        taxAmount,
        shippingAmount,
        totalAmount,
        paymentMethod: 'B2B_INVOICE_NEFT',
        paymentStatus: 'PENDING',
        orderStatus: 'CONFIRMED',
        notes: payload.notes || `Converted from ${qt?.quotationNumber || prop?.proposalNumber}`,
        opsMetadata: {
          channel: 'B2B_COMMERCIAL',
          leadId,
          proposalId: prop?.id || null,
          quotationId: qt?.id || null,
          createdByEmail: actor.email
        }
      })
      .returning();

    // Update customer aggregates
    await tx
      .update(customers)
      .set({
        totalOrders: sql`${customers.totalOrders} + 1`,
        totalSpend: sql`${customers.totalSpend} + ${totalAmount}`
      })
      .where(eq(customers.id, customerRow.id));

    if (qt) {
      await tx
        .update(erpQuotations)
        .set({
          convertedOrderId: createdOrder.id,
          status: qt.status === 'DRAFT' || qt.status === 'APPROVED' || qt.status === 'SENT' ? 'ACCEPTED' : qt.status,
          version: sql`${erpQuotations.version} + 1`,
          updatedAt: new Date()
        })
        .where(eq(erpQuotations.id, qt.id));
    }

    if (prop) {
      await tx
        .update(erpProposals)
        .set({
          convertedOrderId: createdOrder.id,
          status: 'CONVERTED',
          version: sql`${erpProposals.version} + 1`,
          updatedAt: new Date()
        })
        .where(eq(erpProposals.id, prop.id));
    }

    if (leadId) {
      await tx
        .update(erpLeads)
        .set({
          workflowStage: 'SALES_ORDER',
          stage: 'WON',
          probabilityPct: 100,
          convertedCustomerId: customerRow.id,
          linkedOrderId: createdOrder.id,
          version: sql`${erpLeads.version} + 1`,
          updatedAt: new Date()
        })
        .where(eq(erpLeads.id, leadId));
    }

    await tx.insert(erpDealActivities).values({
      id: makeId('dact'),
      organizationId: ORG_ID,
      leadId,
      proposalId: prop?.id || null,
      quotationId: qt?.id || null,
      orderId: createdOrder.id,
      stage: 'SALES_ORDER',
      activityType: 'SALES_ORDER',
      summary: `Converted ${qt?.quotationNumber || prop?.proposalNumber} to B2B Sales Order ${createdOrder.orderNumber} (₹${totalAmount.toLocaleString('en-IN')}).`,
      performedByEmail: actor.email
    });

    await recordErpAuditLog(tx, {
      action: 'ERP_SALES_ORDER_CONVERTED',
      entity: 'orders',
      entityId: createdOrder.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Converted to Sales Order ${createdOrder.orderNumber} ₹${totalAmount}`
    });

    return { order: createdOrder, quotation: qt, proposal: prop, deduplicated: false };
  });
}

export async function progressCommercialOrderWorkflow(
  actor: ErpActorContext,
  orderId: string,
  payload: {
    action: 'CREATE_INVOICE' | 'RECORD_PAYMENT' | 'DISPATCH_FULFILMENT';
    quotationId?: string;
    invoiceId?: string;
    paymentMethod?: string;
    referenceNumber?: string;
    amountInr?: number;
    courierName?: string;
    awbNumber?: string;
    trackingUrl?: string;
    orderStatus?: 'SHIPPED' | 'DELIVERED';
  }
) {
  const ordRows = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!ordRows.length) throw new NotFoundError('Sales Order not found.');
  const ord = ordRows[0];
  const ops: any = ord.opsMetadata || {};
  const leadId: string | null = ops.leadId || null;

  if (payload.action === 'CREATE_INVOICE') {
    const quotationId = payload.quotationId || ops.quotationId || undefined;
    const res = await createGstInvoiceTransaction(actor, quotationId ? { quotationId } : { orderId: ord.id });
    const inv = res.invoice;

    await db.transaction(async (tx) => {
      if (quotationId) {
        await tx
          .update(erpQuotations)
          .set({ convertedInvoiceId: inv.id, status: 'CONVERTED', updatedAt: new Date() })
          .where(eq(erpQuotations.id, quotationId));
      }
      await tx
        .update(orders)
        .set({
          opsMetadata: { ...ops, invoiceId: inv.id, invoiceNumber: inv.invoiceNumber }
        })
        .where(eq(orders.id, ord.id));

      if (leadId) {
        await tx
          .update(erpLeads)
          .set({ workflowStage: 'INVOICE', stage: 'WON', probabilityPct: 100, updatedAt: new Date() })
          .where(eq(erpLeads.id, leadId));
      }

      await tx.insert(erpDealActivities).values({
        id: makeId('dact'),
        organizationId: ORG_ID,
        leadId,
        quotationId: quotationId || null,
        orderId: ord.id,
        invoiceId: inv.id,
        stage: 'INVOICE',
        activityType: 'INVOICE',
        summary: `Issued GST Tax Invoice ${inv.invoiceNumber} for Sales Order ${ord.orderNumber} (₹${inv.grandTotalInr.toLocaleString('en-IN')}).`,
        performedByEmail: actor.email
      });
    });

    return { action: 'CREATE_INVOICE', invoice: inv };
  }

  if (payload.action === 'RECORD_PAYMENT') {
    const targetInvoiceId = payload.invoiceId || ops.invoiceId;
    if (!targetInvoiceId) {
      throw new ValidationError('Issue GST Invoice before recording B2B payment against the Sales Order.');
    }
    const invRows = await db.select().from(erpInvoices).where(eq(erpInvoices.id, targetInvoiceId));
    if (!invRows.length) throw new NotFoundError('Referenced GST Invoice not found.');
    const inv = invRows[0];

    const payRes = await recordPaymentTransaction(actor, {
      direction: 'INBOUND_RECEIPT',
      partyType: 'CUSTOMER',
      partyName: inv.customerName,
      invoiceId: inv.id,
      method: payload.paymentMethod || 'NEFT',
      referenceNumber: payload.referenceNumber?.trim() || `UTR-${Date.now().toString().slice(-6)}`,
      amountInr: Number(payload.amountInr || inv.balanceDueInr),
      notes: `Settlement for Sales Order ${ord.orderNumber}`
    });

    const updatedInv = (payRes as any).updatedInvoice || null;
    const isFullyPaid = Number(updatedInv?.balanceDueInr ?? 0) <= 0.05;
    await db.transaction(async (tx) => {
      await tx
        .update(orders)
        .set({
          paymentStatus: isFullyPaid ? 'PAID' : 'PARTIAL'
        })
        .where(eq(orders.id, ord.id));

      if (leadId) {
        await tx
          .update(erpLeads)
          .set({ workflowStage: 'PAYMENT', stage: 'WON', probabilityPct: 100, updatedAt: new Date() })
          .where(eq(erpLeads.id, leadId));
      }

      await tx.insert(erpDealActivities).values({
        id: makeId('dact'),
        organizationId: ORG_ID,
        leadId,
        orderId: ord.id,
        invoiceId: inv.id,
        stage: 'PAYMENT',
        activityType: 'PAYMENT',
        summary: `Recorded inbound payment ${payRes.payment.paymentNumber} (₹${payRes.payment.amountInr.toLocaleString('en-IN')}) for ${ord.orderNumber}.`,
        performedByEmail: actor.email
      });
    });

    return { action: 'RECORD_PAYMENT', payment: payRes.payment, invoice: updatedInv };
  }

  // DISPATCH_FULFILMENT
  const courierName = payload.courierName?.trim() || 'BlueDart Luxury Air';
  const awbNumber = payload.awbNumber?.trim() || `BD-${Date.now().toString().slice(-8)}`;
  const targetOrderStatus = payload.orderStatus || 'SHIPPED';

  const updatedOrder = await db.transaction(async (tx) => {
    const [upd] = await tx
      .update(orders)
      .set({
        courierName,
        awbNumber,
        trackingUrl: payload.trackingUrl?.trim() || `https://track.fragmore.shop/${awbNumber}`,
        orderStatus: targetOrderStatus,
        opsMetadata: { ...ops, fulfilledByEmail: actor.email, fulfilledAt: new Date().toISOString() }
      })
      .where(eq(orders.id, ord.id))
      .returning();

    if (leadId) {
      await tx
        .update(erpLeads)
        .set({ workflowStage: 'FULFILMENT', stage: 'WON', probabilityPct: 100, updatedAt: new Date() })
        .where(eq(erpLeads.id, leadId));
    }

    await tx.insert(erpDealActivities).values({
      id: makeId('dact'),
      organizationId: ORG_ID,
      leadId,
      orderId: ord.id,
      invoiceId: ops.invoiceId || null,
      stage: 'FULFILMENT',
      activityType: 'FULFILMENT',
      summary: `Dispatched Sales Order ${ord.orderNumber} via ${courierName} (AWB: ${awbNumber}) -> ${targetOrderStatus}.`,
      performedByEmail: actor.email
    });

    return upd;
  });

  return { action: 'DISPATCH_FULFILMENT', order: updatedOrder };
}

// ============================================================================
// WORKSPACE SNAPSHOT & ANALYTICS
// ============================================================================

export async function getCommercialCrmWorkspaceSnapshot(actor: ErpActorContext) {
  await ensureCommercialCrmSeeded();

  const [
    catalogue,
    leads,
    proposals,
    quotations,
    invoices,
    b2bOrders,
    pricingAuditLogs,
    dealActivities,
    crmTasks,
    teamAccess,
    attachments
  ] = await Promise.all([
    getCatalogueWithCosting(),
    db.select().from(erpLeads).orderBy(desc(erpLeads.updatedAt)),
    db.select().from(erpProposals).orderBy(desc(erpProposals.createdAt)),
    db.select().from(erpQuotations).orderBy(desc(erpQuotations.createdAt)),
    db.select().from(erpInvoices).orderBy(desc(erpInvoices.createdAt)),
    db.select().from(orders).orderBy(desc(orders.createdAt)),
    db.select().from(erpPricingAuditLogs).orderBy(desc(erpPricingAuditLogs.createdAt)).limit(100),
    db.select().from(erpDealActivities).orderBy(desc(erpDealActivities.createdAt)).limit(100),
    db.select().from(erpTasks).where(eq(erpTasks.sourceModule, 'CRM')).orderBy(desc(erpTasks.createdAt)).limit(80),
    db.select().from(erpUserAccess).where(eq(erpUserAccess.isActive, true)),
    db.select().from(erpAttachments).where(inArray(erpAttachments.entityType, ['erp_leads', 'PROPOSAL', 'QUOTATION', 'LEAD', 'CRM'])).orderBy(desc(erpAttachments.createdAt))
  ]);

  const b2bFilteredOrders = b2bOrders.filter(
    (o) => String(o.orderNumber || '').startsWith('ORD-B2B-') || (o.opsMetadata as any)?.channel === 'B2B_COMMERCIAL'
  );

  // Analytics & Conversion Metrics
  const totalPipelineInr = leads
    .filter((l) => l.workflowStage !== 'LOST')
    .reduce((s, l) => s + Number(l.estimatedValueInr || 0), 0);

  const weightedPipelineInr = round2(
    leads
      .filter((l) => l.workflowStage !== 'LOST')
      .reduce((s, l) => s + (Number(l.estimatedValueInr || 0) * Number(l.probabilityPct || 25)) / 100, 0)
  );

  const wonDealsCount = leads.filter((l) =>
    ['ACCEPTED', 'SALES_ORDER', 'INVOICE', 'PAYMENT', 'FULFILMENT'].includes(l.workflowStage)
  ).length;
  const activeClosedDenominator = leads.filter((l) => l.workflowStage !== 'LEAD').length || leads.length || 1;
  const conversionRatePct = round2((wonDealsCount / Math.max(1, leads.length)) * 100);

  const acceptedProposalsCount = proposals.filter((p) => ['ACCEPTED', 'CONVERTED'].includes(p.status)).length;
  const pendingApprovalsCount =
    proposals.filter((p) => p.approvalStatus === 'PENDING_APPROVAL').length +
    quotations.filter((q) => q.approvalStatus === 'PENDING_APPROVAL').length;

  const byCategoryMap = new Map<string, { categoryCode: string; label: string; count: number; totalValueInr: number; weightedValueInr: number }>();
  for (const cat of CUSTOMER_CATEGORIES) {
    byCategoryMap.set(cat.code, {
      categoryCode: cat.code,
      label: cat.label,
      count: 0,
      totalValueInr: 0,
      weightedValueInr: 0
    });
  }
  for (const l of leads) {
    const row = byCategoryMap.get(l.customerCategory) || {
      categoryCode: l.customerCategory,
      label: l.customerCategory,
      count: 0,
      totalValueInr: 0,
      weightedValueInr: 0
    };
    row.count += 1;
    row.totalValueInr += Number(l.estimatedValueInr || 0);
    row.weightedValueInr = round2(row.weightedValueInr + (Number(l.estimatedValueInr || 0) * Number(l.probabilityPct || 25)) / 100);
    byCategoryMap.set(l.customerCategory, row);
  }

  const stageFunnel = CRM_WORKFLOW_STAGES.map((stage) => {
    const matches = leads.filter((l) => l.workflowStage === stage);
    return {
      stage,
      count: matches.length,
      valueInr: matches.reduce((s, l) => s + Number(l.estimatedValueInr || 0), 0)
    };
  });

  // Internal Costing Margin Summary across Quotations
  const quotationMargins = quotations.map((qt) => {
    const items: any[] = Array.isArray(qt.items) ? qt.items : [];
    const totalCogs = round2(
      items.reduce((s, it) => s + Number(it.unitManufacturingCostInr || Number(it.catalogueUnitPriceInr || 0) * 0.28) * Number(it.qty || 1), 0)
    );
    const netRevenue = Number(qt.taxableAmountInr || 0);
    const grossMarginInr = round2(netRevenue - totalCogs);
    const grossMarginPct = netRevenue > 0 ? round2((grossMarginInr / netRevenue) * 100) : 0;
    return {
      quotationId: qt.id,
      quotationNumber: qt.quotationNumber,
      clientName: qt.clientName,
      netRevenueInr: netRevenue,
      estimatedCogsInr: totalCogs,
      grossMarginInr,
      grossMarginPct
    };
  });

  return {
    actor: {
      email: actor.email,
      roleCode: actor.roleCode,
      canApprovePricing: hasPricingApprovalPrivilege(actor)
    },
    customerCategories: CUSTOMER_CATEGORIES,
    proposalTypes: PROPOSAL_TYPES,
    workflowStages: CRM_WORKFLOW_STAGES,
    leadSources: LEAD_SOURCES,
    catalogue,
    leads,
    proposals,
    quotations,
    invoices,
    b2bOrders: b2bFilteredOrders,
    pricingAuditLogs,
    dealActivities,
    crmTasks,
    teamAssignees: teamAccess.map((u) => ({ email: u.email, displayName: u.displayName || u.email, roleCode: u.roleId })),
    attachments,
    analytics: {
      totalLeads: leads.length,
      totalPipelineInr,
      weightedPipelineInr,
      wonDealsCount,
      conversionRatePct,
      proposalsCount: proposals.length,
      acceptedProposalsCount,
      quotationsCount: quotations.length,
      pendingApprovalsCount,
      overdueRemindersCount: leads.filter((l) => l.nextFollowUpDate && l.nextFollowUpDate < currentIsoDate() && l.workflowStage !== 'FULFILMENT' && l.workflowStage !== 'LOST').length,
      activeClosedDenominator,
      byCategory: Array.from(byCategoryMap.values()),
      stageFunnel,
      quotationMargins
    }
  };
}
