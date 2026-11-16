import crypto from 'crypto';
import { db } from '../db/index.ts';
import {
  erpAgencyProfiles,
  erpAgencyStaff,
  erpAgencyInvoices,
  erpCreativeRevisions,
  erpMarketingWorkspace,
  erpInterns,
  erpInternAttendance,
  erpInternSubmissions,
  erpInternEvaluations,
  erpEmployees,
  erpTasks,
  erpTaskComments,
  erpApprovals,
  erpAttachments,
  erpDepartments,
  erpRoles,
  erpPermissions,
  erpUserAccess,
  erpSamples,
  erpOnceEditions,
  erpFormulations,
  campaigns,
  influencers,
  influencerContentDeliverables,
  cmsSettings,
  analyticsTrackingLedger,
  orders
} from '../db/schema.ts';
import { eq, desc, sql, and } from 'drizzle-orm';
import {
  ORG_ID,
  ensureErpSeeded,
  getNextSequence,
  recordErpAuditLog,
  createErpNotification,
  ValidationError,
  NotFoundError,
  ConflictError,
  ForbiddenError,
  type ErpActorContext
} from './erpBusinessOsEngine.ts';

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
}

function currentIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

const DISCOUNT_ANTI_LUXURY_PATTERNS = [
  /\b\d+\s*%\s*off\b/i,
  /\bflat\s*(?:₹|rs\.?)?\s*\d+\s*off\b/i,
  /\bflash\s*sale\b/i,
  /\bclearance\b/i,
  /\bbogo\b/i,
  /\bbuy\s*1\s*get\s*1\b/i,
  /\bheavy\s*discount\b/i,
  /\bdiscount\s*blast\b/i,
  /\bcheap\b/i,
  /\bsteal\s*deal\b/i
];

export function evaluateLuxuryBrandPhilosophy(params: {
  title?: string;
  strategyType?: string;
  adScript?: string | null;
  captionCopy?: string | null;
  storytellingAngle?: string | null;
  valueAddOffer?: string | null;
  discountExceptionApproved?: boolean;
}) {
  const combined = [
    params.title || '',
    params.adScript || '',
    params.captionCopy || '',
    params.storytellingAngle || ''
  ].join(' ');
  const triggers: string[] = [];
  for (const rx of DISCOUNT_ANTI_LUXURY_PATTERNS) {
    const m = combined.match(rx);
    if (m) triggers.push(m[0]);
  }
  const isDiscountStrategy = params.strategyType === 'DISCOUNT_EXCEPTION';
  const hasViolation = (triggers.length > 0 || isDiscountStrategy) && !params.discountExceptionApproved;
  return {
    isLuxuryCompliant: !hasViolation && triggers.length === 0,
    detectedDiscountTriggers: triggers,
    requiresFounderException: hasViolation,
    guidance: hasViolation
      ? `FRAGMORÉ Luxury Guardrail: Avoid habitual discount-led copy (${triggers.join(', ') || 'DISCOUNT_EXCEPTION'}). Pivot to fragrance storytelling, bespoke value-add coffrets, discovery vials, or Founder-approved Limited Editions.`
      : 'Aligned with FRAGMORÉ aspiration, individuality, storytelling, and value-add luxury ethos.'
  };
}

let agencyHrSeedPromise: Promise<void> | null = null;

export async function ensureAgencyHrSeeded(): Promise<void> {
  await ensureErpSeeded();
  if (agencyHrSeedPromise) return agencyHrSeedPromise;
  agencyHrSeedPromise = (async () => {
    try {
      const existingAgency = await db.select().from(erpAgencyProfiles);
      if (!existingAgency.length) {
        const agencyId = 'agp-atelier-lumiere';
        await db.insert(erpAgencyProfiles).values({
          id: agencyId,
          organizationId: ORG_ID,
          agencyName: 'Maison Lumière Creative Atelier',
          legalName: 'Lumière Luxury Brand Studio LLP',
          primaryContactName: 'Kabir Mehta',
          primaryContactEmail: 'growth@fragmore.shop',
          specialization: 'Haute Parfumerie Storytelling, Editorial Cinema & Creator Seeding',
          websiteUrl: 'https://fragmore.shop',
          gstin: '27AAACL4419B1Z8',
          monthlyRetainerInr: 95000,
          billingCycleDay: 5,
          ndaSigned: true,
          luxuryPhilosophyPledge:
            'Strictly non-discount luxury positioning. Lead with ingredient provenance, individuality, tactile discovery vials, value-add coffret gifts, and scarce numbered editions.',
          contractStartDate: '2026-04-01',
          contractEndDate: '2027-03-31',
          status: 'ACTIVE'
        });

        await db
          .insert(erpAgencyStaff)
          .values([
            {
              id: 'ags-01',
              organizationId: ORG_ID,
              agencyId,
              staffCode: 'AG-STF-101',
              fullName: 'Kabir Mehta',
              email: 'growth@fragmore.shop',
              roleTitle: 'Brand Strategy & Account Director',
              specialty: 'Luxury Narrative & Meta/Google Attribution',
              accessLevel: 'ACCOUNT_LEAD',
              assignedChannels: ['META_ADS', 'GOOGLE_ADS', 'INFLUENCER'],
              status: 'ACTIVE'
            },
            {
              id: 'ags-02',
              organizationId: ORG_ID,
              agencyId,
              staffCode: 'AG-STF-102',
              fullName: 'Zoya Merchant',
              email: 'zoya.creative@lumierestudio.in',
              roleTitle: 'Senior Fragrance Copywriter & Film Director',
              specialty: '35mm Reels, Olfactory Scripts & Editorial Captions',
              accessLevel: 'CREATOR',
              assignedChannels: ['INSTAGRAM', 'META_ADS', 'EMAIL'],
              status: 'ACTIVE'
            },
            {
              id: 'ags-03',
              organizationId: ORG_ID,
              agencyId,
              staffCode: 'AG-STF-103',
              fullName: 'Devansh Kapoor',
              email: 'devansh.media@lumierestudio.in',
              roleTitle: 'Performance & Creator Seeding Analyst',
              specialty: 'Discovery-to-50ml Cohort ROAS & Creator Dispatch',
              accessLevel: 'PERFORMANCE_ANALYST',
              assignedChannels: ['GOOGLE_ADS', 'INFLUENCER', 'WHATSAPP'],
              status: 'ACTIVE'
            }
          ])
          .onConflictDoNothing();

        await db
          .insert(erpAgencyInvoices)
          .values([
            {
              id: 'aginv-01',
              organizationId: ORG_ID,
              agencyId,
              invoiceNumber: 'AG-INV-2026-1001',
              billingMonth: new Date().toISOString().slice(0, 7),
              invoiceDate: addDaysIso(-12),
              dueDate: addDaysIso(3),
              description: 'Monthly Creative Retainer + Grasse Storyline Film Production',
              retainerInr: 95000,
              productionExtrasInr: 25000,
              gstAmountInr: 21600,
              totalAmountInr: 141600,
              paidAmountInr: 141600,
              paymentReference: 'HDFC-NEFT-8841209',
              paymentDate: addDaysIso(-5),
              status: 'PAID',
              approvedByEmail: 'aibrandorigin@gmail.com',
              notes: 'Settled on schedule against NDA retainer agreement.',
              createdByEmail: 'growth@fragmore.shop'
            }
          ])
          .onConflictDoNothing();
      }

      // Enrich existing marketing workspace items with scripts, storytelling, and revisions if missing
      const mktItems = await db.select().from(erpMarketingWorkspace);
      for (const m of mktItems) {
        const revs = await db.select().from(erpCreativeRevisions).where(eq(erpCreativeRevisions.assetId, m.id));
        if (!revs.length) {
          const isApproved = m.status === 'APPROVED' || m.status === 'LIVE' || m.status === 'COMPLETED';
          const stage = isApproved ? 'APPROVED' : m.status === 'CLIENT_REVIEW' ? 'UNDER_REVIEW' : 'SUBMITTED';
          await db
            .update(erpMarketingWorkspace)
            .set({
              strategyType: m.strategyType || 'BRAND_STORYTELLING',
              adScript:
                m.adScript ||
                `[0:00-0:04] Macro amber extrait droplet on travertine.\n[0:04-0:12] Voiceover: "Not crafted for the crowd—composed for memory."`,
              captionCopy:
                m.captionCopy ||
                m.creativeCopy ||
                'Slow-macerated 32% Extrait de Parfum. Experience the story first with our numbered 2ML Discovery Atelier Kit.',
              storytellingAngle: m.storytellingAngle || 'Craft provenance & olfactory memory without discounting.',
              valueAddOffer: m.valueAddOffer || 'Complimentary 2ML Discovery Sample & Wax-Sealed Scent Card',
              visualCompliance: m.visualCompliance || {
                noDiscountFlash: true,
                editorialTypography: true,
                consistentPalette: true,
                bottleMockupApproved: true
              },
              approvalStage: stage,
              approvedByEmail: isApproved ? 'aibrandorigin@gmail.com' : null,
              approvedAt: isApproved ? new Date() : null
            })
            .where(eq(erpMarketingWorkspace.id, m.id));

          await db.insert(erpCreativeRevisions).values({
            id: makeId('crev'),
            organizationId: ORG_ID,
            assetId: m.id,
            revisionNumber: 1,
            adScript:
              m.adScript ||
              `[0:00-0:04] Macro amber extrait droplet on travertine.\n[0:04-0:12] Voiceover: "Not crafted for the crowd—composed for memory."`,
            captionCopy: m.creativeCopy || 'Slow-macerated 32% Extrait de Parfum storytelling copy.',
            deliverableUrl: m.deliverableUrl || null,
            storytellingAngle: 'Craft provenance & olfactory memory.',
            changeSummary: 'Initial agency submission aligned with luxury storytelling standard.',
            approvalStage: stage,
            reviewerEmail: isApproved ? 'aibrandorigin@gmail.com' : null,
            reviewerNotes: isApproved ? 'Founder approved visual cadence & non-discount copy.' : null,
            submittedByEmail: m.assigneeEmail || 'growth@fragmore.shop'
          });
        }
      }

      // Seed baseline intern attendance, submissions, and evaluation for existing interns if empty
      const ints = await db.select().from(erpInterns);
      if (ints.length) {
        for (const intern of ints) {
          const trackNorm =
            intern.track === 'FORMULATION_RD'
              ? 'PRODUCTION'
              : intern.track === 'DIGITAL_MARKETING'
              ? 'DIGITAL_MARKETING'
              : intern.track === 'SUPPLY_CHAIN'
              ? 'PROCUREMENT'
              : intern.track === 'FINANCE_OPS'
              ? 'FINANCE'
              : 'OPERATIONS';
          if (!intern.departmentTrack || intern.departmentTrack === 'DIGITAL_MARKETING') {
            await db
              .update(erpInterns)
              .set({
                departmentTrack: trackNorm,
                confidentialitySigned: true,
                canViewSensitiveFinancials: false,
                canViewFormulations: false
              })
              .where(eq(erpInterns.id, intern.id));
          }
        }

        const existingAtt = await db.select().from(erpInternAttendance);
        if (!existingAtt.length) {
          const today = currentIsoDate();
          const yesterday = addDaysIso(-1);
          await db.insert(erpInternAttendance).values([
            {
              id: makeId('att'),
              organizationId: ORG_ID,
              internId: ints[0].id,
              attendanceDate: today,
              workMode: 'LAB',
              checkInTime: '09:30',
              checkOutTime: '18:00',
              hoursLogged: 8.5,
              status: 'PRESENT',
              notes: 'Monitored cold-maceration ester logs & vial fill checks.',
              verifiedByEmail: ints[0].mentorEmail
            },
            {
              id: makeId('att'),
              organizationId: ORG_ID,
              internId: ints[0].id,
              attendanceDate: yesterday,
              workMode: 'LAB',
              checkInTime: '09:35',
              checkOutTime: '17:50',
              hoursLogged: 8.25,
              status: 'PRESENT',
              notes: 'Glass flacon batch visual inspection support.',
              verifiedByEmail: ints[0].mentorEmail
            },
            ...(ints[1]
              ? [
                  {
                    id: makeId('att'),
                    organizationId: ORG_ID,
                    internId: ints[1].id,
                    attendanceDate: today,
                    workMode: 'ATELIER_ONSITE',
                    checkInTime: '10:00',
                    checkOutTime: '18:30',
                    hoursLogged: 8.5,
                    status: 'PRESENT',
                    notes: 'Audited creator seeding unboxing captions & UTMs.',
                    verifiedByEmail: ints[1].mentorEmail
                  }
                ]
              : [])
          ]);
        }

        const existingSubs = await db.select().from(erpInternSubmissions);
        if (!existingSubs.length) {
          await db.insert(erpInternSubmissions).values([
            {
              id: makeId('sub'),
              organizationId: ORG_ID,
              internId: ints[0].id,
              submissionNumber: 'SUB-2026-1001',
              departmentTrack: 'PRODUCTION',
              title: '2ML Discovery Vial Fill-Weight Consistency Sheet',
              summary: 'Logged 50 sample vials tolerance measurements (+/-0.02ml) during bottling line trial.',
              deliverableUrl: 'https://fragmore.shop/internal/discovery-vial-trial',
              attachmentIds: [],
              approvalStage: 'APPROVED',
              reviewerEmail: ints[0].mentorEmail,
              reviewerFeedback: 'Thorough tolerance logging; cleared without exposing proprietary concentrate percentages.',
              submittedByEmail: ints[0].email,
              approvedAt: new Date()
            }
          ]);
        }

        const existingEvals = await db.select().from(erpInternEvaluations);
        if (!existingEvals.length) {
          await db.insert(erpInternEvaluations).values([
            {
              id: makeId('eval'),
              organizationId: ORG_ID,
              internId: ints[0].id,
              evaluationNumber: 'EVAL-2026-1001',
              evaluationDate: addDaysIso(-3),
              evaluatorEmail: ints[0].mentorEmail,
              executionScore: 4.8,
              storytellingCraftScore: 4.7,
              reliabilityScore: 4.9,
              overallRating: 4.8,
              strengths: 'Exceptional precision in laboratory documentation and adherence to NDA confidentiality.',
              growthAreas: 'Shadow QC team on packaging tensile inspections next fortnight.',
              recommendation: 'ENDORSE_FOR_CERTIFICATE',
              certificateEligible: true,
              notes: 'Mid-cohort review completed.'
            }
          ]);
        }
      }

      // Enhance existing tasks with checklists / approvalStage if empty
      const tsks = await db.select().from(erpTasks);
      for (const t of tsks) {
        if (!t.checklists) {
          await db
            .update(erpTasks)
            .set({
              approvalStage: t.status === 'DONE' ? 'COMPLETED' : t.status === 'IN_REVIEW' ? 'UNDER_REVIEW' : 'IN_PROGRESS',
              checklists: [
                { id: 'chk-1', text: 'Verify brief alignment with FRAGMORÉ guidelines', done: true },
                { id: 'chk-2', text: 'Upload final deliverable proof & attach file', done: t.status === 'DONE' }
              ],
              dependsOnTaskIds: [],
              activityLog: [
                {
                  timestamp: new Date().toISOString(),
                  actorEmail: t.createdByEmail,
                  action: 'CREATED',
                  detail: `Task ${t.taskNumber} assigned to ${t.assignedToEmail}`
                }
              ]
            })
            .where(eq(erpTasks.id, t.id));
        }
      }

      // Ensure live RBAC permissions for INTERN_VIEWER and MARKETING_AGENCY support collaborative submissions, tasks & non-sensitive reports
      const permUpdates = [
        { roleId: 'role-intern-viewer', moduleKey: 'hr', canView: true, canCreate: true, canEdit: true, canApprove: false, canDelete: false, canExport: true },
        { roleId: 'role-intern-viewer', moduleKey: 'marketing', canView: true, canCreate: true, canEdit: false, canApprove: false, canDelete: false, canExport: true },
        { roleId: 'role-intern-viewer', moduleKey: 'reports', canView: true, canCreate: false, canEdit: false, canApprove: false, canDelete: false, canExport: true },
        { roleId: 'role-agency-partner', moduleKey: 'marketing', canView: true, canCreate: true, canEdit: true, canApprove: false, canDelete: false, canExport: true },
        { roleId: 'role-agency-partner', moduleKey: 'hr', canView: true, canCreate: true, canEdit: true, canApprove: false, canDelete: false, canExport: true },
        { roleId: 'role-agency-partner', moduleKey: 'reports', canView: true, canCreate: false, canEdit: false, canApprove: false, canDelete: false, canExport: true }
      ];
      for (const pu of permUpdates) {
        await db
          .update(erpPermissions)
          .set({
            canView: pu.canView,
            canCreate: pu.canCreate,
            canEdit: pu.canEdit,
            canExport: pu.canExport,
            updatedAt: new Date()
          })
          .where(and(eq(erpPermissions.roleId, pu.roleId), eq(erpPermissions.moduleKey, pu.moduleKey)));
      }
    } catch (e) {
      console.warn('[Agency/HR Seed Notice]:', (e as any)?.message);
    }
  })();
  return agencyHrSeedPromise;
}

// ============================================================================
// 1. MARKETING AGENCY PROFILE, STAFF, LUXURY CAMPAIGNS & CREATIVE APPROVALS
// ============================================================================

export async function upsertAgencyProfile(
  actor: ErpActorContext,
  payload: {
    id?: string;
    agencyName: string;
    legalName: string;
    primaryContactName: string;
    primaryContactEmail: string;
    specialization: string;
    websiteUrl?: string;
    gstin?: string;
    monthlyRetainerInr: number;
    billingCycleDay?: number;
    ndaSigned?: boolean;
    luxuryPhilosophyPledge: string;
    contractStartDate?: string;
    contractEndDate?: string;
    status?: string;
  }
) {
  await ensureAgencyHrSeeded();
  if (!payload.agencyName?.trim() || !payload.primaryContactEmail?.trim()) {
    throw new ValidationError('Agency name and primary contact email are required.');
  }
  return await db.transaction(async (tx) => {
    if (payload.id) {
      const existing = await tx.select().from(erpAgencyProfiles).where(eq(erpAgencyProfiles.id, payload.id));
      if (!existing.length) throw new NotFoundError('Agency profile not found.');
      const [updated] = await tx
        .update(erpAgencyProfiles)
        .set({
          agencyName: payload.agencyName.trim(),
          legalName: payload.legalName?.trim() || existing[0].legalName,
          primaryContactName: payload.primaryContactName.trim(),
          primaryContactEmail: payload.primaryContactEmail.trim().toLowerCase(),
          specialization: payload.specialization?.trim() || existing[0].specialization,
          websiteUrl: payload.websiteUrl || null,
          gstin: payload.gstin?.trim().toUpperCase() || null,
          monthlyRetainerInr: Number(payload.monthlyRetainerInr || 0),
          billingCycleDay: Number(payload.billingCycleDay || 5),
          ndaSigned: payload.ndaSigned ?? existing[0].ndaSigned,
          luxuryPhilosophyPledge: payload.luxuryPhilosophyPledge?.trim() || existing[0].luxuryPhilosophyPledge,
          contractStartDate: payload.contractStartDate || existing[0].contractStartDate,
          contractEndDate: payload.contractEndDate || null,
          status: payload.status || existing[0].status,
          version: sql`${erpAgencyProfiles.version} + 1`,
          updatedAt: new Date()
        })
        .where(eq(erpAgencyProfiles.id, payload.id))
        .returning();
      await recordErpAuditLog(tx, {
        action: 'ERP_AGENCY_PROFILE_UPDATED',
        entity: 'erp_agency_profiles',
        entityId: updated.id,
        actorEmail: actor.email,
        actorRole: actor.roleCode,
        details: `Updated agency profile ${updated.agencyName}`
      });
      return updated;
    }

    const [created] = await tx
      .insert(erpAgencyProfiles)
      .values({
        id: makeId('agp'),
        organizationId: ORG_ID,
        agencyName: payload.agencyName.trim(),
        legalName: payload.legalName?.trim() || payload.agencyName.trim(),
        primaryContactName: payload.primaryContactName.trim(),
        primaryContactEmail: payload.primaryContactEmail.trim().toLowerCase(),
        specialization: payload.specialization || 'Luxury Fragrance Growth & Editorial',
        websiteUrl: payload.websiteUrl || null,
        gstin: payload.gstin?.trim().toUpperCase() || null,
        monthlyRetainerInr: Number(payload.monthlyRetainerInr || 85000),
        billingCycleDay: Number(payload.billingCycleDay || 5),
        ndaSigned: payload.ndaSigned ?? true,
        luxuryPhilosophyPledge:
          payload.luxuryPhilosophyPledge || 'Storytelling, rarity, and value-add discovery over discounting.',
        contractStartDate: payload.contractStartDate || currentIsoDate(),
        contractEndDate: payload.contractEndDate || addDaysIso(365),
        status: 'ACTIVE'
      })
      .returning();
    return created;
  });
}

export async function upsertAgencyStaff(
  actor: ErpActorContext,
  payload: {
    id?: string;
    agencyId: string;
    fullName: string;
    email: string;
    roleTitle: string;
    specialty: string;
    accessLevel: string;
    assignedChannels?: string[];
    provisionErpAccess?: boolean;
  }
) {
  await ensureAgencyHrSeeded();
  if (!payload.fullName?.trim() || !payload.email?.trim()) {
    throw new ValidationError('Agency staff full name and email are required.');
  }
  return await db.transaction(async (tx) => {
    const email = payload.email.trim().toLowerCase();
    const staffCode = await getNextSequence(tx, 'AGSTF');
    const [staff] = await tx
      .insert(erpAgencyStaff)
      .values({
        id: makeId('ags'),
        organizationId: ORG_ID,
        agencyId: payload.agencyId,
        staffCode,
        fullName: payload.fullName.trim(),
        email,
        roleTitle: payload.roleTitle.trim() || 'Creative Specialist',
        specialty: payload.specialty?.trim() || 'Editorial Storytelling',
        accessLevel: payload.accessLevel || 'CREATOR',
        assignedChannels: payload.assignedChannels || ['META_ADS', 'INSTAGRAM'],
        status: 'ACTIVE'
      })
      .onConflictDoUpdate({
        target: erpAgencyStaff.email,
        set: {
          fullName: payload.fullName.trim(),
          roleTitle: payload.roleTitle.trim() || 'Creative Specialist',
          specialty: payload.specialty?.trim() || 'Editorial Storytelling',
          accessLevel: payload.accessLevel || 'CREATOR',
          assignedChannels: payload.assignedChannels || ['META_ADS', 'INSTAGRAM'],
          updatedAt: new Date()
        }
      })
      .returning();

    if (payload.provisionErpAccess) {
      await tx
        .insert(erpUserAccess)
        .values({
          id: makeId('ua'),
          organizationId: ORG_ID,
          email,
          displayName: `${staff.fullName} (Agency)`,
          roleId: 'role-mkt-agency',
          departmentId: 'dept-mkt',
          isActive: true
        })
        .onConflictDoNothing();
    }

    await recordErpAuditLog(tx, {
      action: 'ERP_AGENCY_STAFF_SAVED',
      entity: 'erp_agency_staff',
      entityId: staff.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Saved agency staff account ${staff.fullName} (${email}) — ${staff.roleTitle}`
    });
    return staff;
  });
}

export async function saveLuxuryCampaignPlan(
  actor: ErpActorContext,
  payload: {
    id?: string;
    name: string;
    channel: string;
    budgetInr: number;
    spendInr?: number;
    revenueInr?: number;
    startDate?: string;
    endDate?: string;
    strategyType: string;
    storytellingNarrative: string;
    valueAddOffer?: string;
    limitedEditionCode?: string;
    targetAudience?: string;
    discountExceptionApproved?: boolean;
  }
) {
  await ensureAgencyHrSeeded();
  if (!payload.name?.trim()) throw new ValidationError('Campaign title is required.');

  const guardrail = evaluateLuxuryBrandPhilosophy({
    title: payload.name,
    strategyType: payload.strategyType,
    storytellingAngle: payload.storytellingNarrative,
    valueAddOffer: payload.valueAddOffer,
    discountExceptionApproved: payload.discountExceptionApproved && actor.isSuperAdmin
  });
  if (guardrail.requiresFounderException) {
    throw new ValidationError(guardrail.guidance);
  }

  return await db.transaction(async (tx) => {
    const metadata = {
      strategyType: payload.strategyType || 'BRAND_STORYTELLING',
      storytellingNarrative: payload.storytellingNarrative || '',
      valueAddOffer: payload.valueAddOffer || '2ML Complimentary Discovery Vial',
      limitedEditionCode: payload.limitedEditionCode || null,
      targetAudience: payload.targetAudience || 'Luxury Fragrance Collectors (Tier-1 India)',
      luxuryCompliant: guardrail.isLuxuryCompliant,
      updatedByEmail: actor.email
    };

    if (payload.id) {
      const [upd] = await tx
        .update(campaigns)
        .set({
          name: payload.name.trim(),
          channel: payload.channel || 'META_ADS',
          budget: Number(payload.budgetInr || 0),
          spend: Number(payload.spendInr || 0),
          revenue: Number(payload.revenueInr || 0),
          startDate: payload.startDate || currentIsoDate(),
          endDate: payload.endDate || addDaysIso(30),
          campaignMetadata: metadata
        })
        .where(eq(campaigns.id, payload.id))
        .returning();
      if (!upd) throw new NotFoundError('Campaign not found.');
      return upd;
    }

    const [created] = await tx
      .insert(campaigns)
      .values({
        id: makeId('cmp'),
        name: payload.name.trim(),
        channel: payload.channel || 'META_ADS',
        budget: Number(payload.budgetInr || 0),
        spend: Number(payload.spendInr || 0),
        revenue: Number(payload.revenueInr || 0),
        status: 'active',
        startDate: payload.startDate || currentIsoDate(),
        endDate: payload.endDate || addDaysIso(30),
        campaignMetadata: metadata
      })
      .returning();

    await recordErpAuditLog(tx, {
      action: 'ERP_LUXURY_CAMPAIGN_PLANNED',
      entity: 'campaigns',
      entityId: created.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Planned luxury campaign "${created.name}" (${payload.strategyType}) · Budget ₹${created.budget}`
    });
    return created;
  });
}

export async function saveCreativeAssetWithRevision(
  actor: ErpActorContext,
  payload: {
    id?: string;
    campaignId?: string;
    title: string;
    channel: string;
    creativeFormat: string;
    strategyType: string;
    targetAudience: string;
    budgetInr: number;
    spendInr?: number;
    revenueAttributedInr?: number;
    leadsCount?: number;
    scheduledDate?: string;
    adScript: string;
    captionCopy: string;
    storytellingAngle: string;
    valueAddOffer?: string;
    limitedEditionCode?: string;
    deliverableUrl?: string;
    changeSummary?: string;
    submitForApproval?: boolean;
    discountExceptionApproved?: boolean;
    visualCompliance?: Record<string, boolean>;
  }
) {
  await ensureAgencyHrSeeded();
  if (!payload.title?.trim()) throw new ValidationError('Creative deliverable title is required.');

  const guardrail = evaluateLuxuryBrandPhilosophy({
    title: payload.title,
    strategyType: payload.strategyType,
    adScript: payload.adScript,
    captionCopy: payload.captionCopy,
    storytellingAngle: payload.storytellingAngle,
    valueAddOffer: payload.valueAddOffer,
    discountExceptionApproved: payload.discountExceptionApproved && actor.isSuperAdmin
  });
  if (guardrail.requiresFounderException) {
    throw new ValidationError(guardrail.guidance);
  }

  return await db.transaction(async (tx) => {
    const targetStage = payload.submitForApproval ? 'SUBMITTED' : 'DRAFT';
    const legacyStatus = payload.submitForApproval ? 'CLIENT_REVIEW' : 'IN_PRODUCTION';

    if (payload.id) {
      const rows = await tx.select().from(erpMarketingWorkspace).where(eq(erpMarketingWorkspace.id, payload.id));
      if (!rows.length) throw new NotFoundError('Creative deliverable not found.');
      const cur = rows[0];
      const nextRev = (cur.currentRevision || 1) + 1;

      const [updated] = await tx
        .update(erpMarketingWorkspace)
        .set({
          campaignId: payload.campaignId ?? cur.campaignId,
          title: payload.title.trim(),
          channel: payload.channel || cur.channel,
          creativeFormat: payload.creativeFormat || cur.creativeFormat,
          strategyType: payload.strategyType || cur.strategyType,
          targetAudience: payload.targetAudience || cur.targetAudience,
          budgetInr: Number(payload.budgetInr ?? cur.budgetInr),
          spendInr: Number(payload.spendInr ?? cur.spendInr),
          revenueAttributedInr: Number(payload.revenueAttributedInr ?? cur.revenueAttributedInr),
          leadsCount: Number(payload.leadsCount ?? cur.leadsCount),
          scheduledDate: payload.scheduledDate || cur.scheduledDate,
          adScript: payload.adScript,
          captionCopy: payload.captionCopy,
          creativeCopy: payload.captionCopy,
          storytellingAngle: payload.storytellingAngle,
          valueAddOffer: payload.valueAddOffer || null,
          limitedEditionCode: payload.limitedEditionCode || null,
          deliverableUrl: payload.deliverableUrl ?? cur.deliverableUrl,
          visualCompliance: payload.visualCompliance || cur.visualCompliance,
          approvalStage: targetStage,
          status: legacyStatus,
          currentRevision: nextRev,
          version: sql`${erpMarketingWorkspace.version} + 1`,
          updatedAt: new Date()
        })
        .where(eq(erpMarketingWorkspace.id, cur.id))
        .returning();

      await tx.insert(erpCreativeRevisions).values({
        id: makeId('crev'),
        organizationId: ORG_ID,
        assetId: updated.id,
        revisionNumber: nextRev,
        adScript: payload.adScript,
        captionCopy: payload.captionCopy,
        deliverableUrl: payload.deliverableUrl || cur.deliverableUrl || null,
        storytellingAngle: payload.storytellingAngle,
        changeSummary: payload.changeSummary?.trim() || `Revision v${nextRev} updated by ${actor.email}`,
        approvalStage: targetStage,
        submittedByEmail: actor.email
      });

      if (payload.submitForApproval) {
        const aprNum = await getNextSequence(tx, 'APR');
        await tx.insert(erpApprovals).values({
          id: makeId('apr'),
          organizationId: ORG_ID,
          departmentId: 'dept-mkt',
          approvalNumber: aprNum,
          moduleKey: 'marketing',
          entityType: 'MARKETING_CREATIVE',
          entityId: updated.id,
          title: `Founder Review: ${updated.briefCode} — ${updated.title} (v${nextRev})`,
          summary: `${updated.channel} · ${updated.strategyType} · ${payload.storytellingAngle}`,
          amountInr: Number(updated.budgetInr || 0),
          requiredRoleCode: 'SUPER_ADMIN',
          requestedByEmail: actor.email,
          status: 'PENDING'
        });
      }

      return { asset: updated, revisionNumber: nextRev };
    }

    const briefCode = await getNextSequence(tx, 'MKT');
    const [created] = await tx
      .insert(erpMarketingWorkspace)
      .values({
        id: makeId('mkt'),
        organizationId: ORG_ID,
        campaignId: payload.campaignId || null,
        briefCode,
        title: payload.title.trim(),
        channel: payload.channel || 'META_ADS',
        creativeFormat: payload.creativeFormat || 'REEL',
        strategyType: payload.strategyType || 'BRAND_STORYTELLING',
        targetAudience: payload.targetAudience || 'Luxury Buyers Tier-1 Cities',
        budgetInr: Number(payload.budgetInr || 0),
        spendInr: Number(payload.spendInr || 0),
        revenueAttributedInr: Number(payload.revenueAttributedInr || 0),
        leadsCount: Number(payload.leadsCount || 0),
        assigneeEmail: actor.email,
        scheduledDate: payload.scheduledDate || currentIsoDate(),
        creativeCopy: payload.captionCopy,
        adScript: payload.adScript,
        captionCopy: payload.captionCopy,
        storytellingAngle: payload.storytellingAngle,
        valueAddOffer: payload.valueAddOffer || '2ML Complimentary Discovery Vial',
        limitedEditionCode: payload.limitedEditionCode || null,
        visualCompliance: payload.visualCompliance || {
          noDiscountFlash: true,
          editorialTypography: true,
          consistentPalette: true,
          bottleMockupApproved: Boolean(payload.deliverableUrl)
        },
        deliverableUrl: payload.deliverableUrl || null,
        approvalStage: targetStage,
        currentRevision: 1,
        status: legacyStatus
      })
      .returning();

    await tx.insert(erpCreativeRevisions).values({
      id: makeId('crev'),
      organizationId: ORG_ID,
      assetId: created.id,
      revisionNumber: 1,
      adScript: payload.adScript,
      captionCopy: payload.captionCopy,
      deliverableUrl: payload.deliverableUrl || null,
      storytellingAngle: payload.storytellingAngle,
      changeSummary: payload.changeSummary?.trim() || 'Initial creative brief & script created.',
      approvalStage: targetStage,
      submittedByEmail: actor.email
    });

    if (payload.submitForApproval) {
      const aprNum = await getNextSequence(tx, 'APR');
      await tx.insert(erpApprovals).values({
        id: makeId('apr'),
        organizationId: ORG_ID,
        departmentId: 'dept-mkt',
        approvalNumber: aprNum,
        moduleKey: 'marketing',
        entityType: 'MARKETING_CREATIVE',
        entityId: created.id,
        title: `Founder Review: ${created.briefCode} — ${created.title}`,
        summary: `${created.channel} · ${created.strategyType}`,
        amountInr: Number(created.budgetInr || 0),
        requiredRoleCode: 'SUPER_ADMIN',
        requestedByEmail: actor.email,
        status: 'PENDING'
      });
    }

    await recordErpAuditLog(tx, {
      action: 'ERP_CREATIVE_ASSET_SAVED',
      entity: 'erp_marketing_workspace',
      entityId: created.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Created creative asset ${briefCode} (${targetStage})`
    });

    return { asset: created, revisionNumber: 1 };
  });
}

export async function transitionCreativeApprovalStage(
  actor: ErpActorContext,
  assetId: string,
  payload: {
    targetStage: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'CHANGES_REQUESTED' | 'APPROVED' | 'PUBLISHED';
    feedback?: string;
  }
) {
  await ensureAgencyHrSeeded();
  const founderOnly = ['UNDER_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'PUBLISHED'].includes(payload.targetStage);
  if (founderOnly && !actor.isSuperAdmin && actor.roleCode !== 'MARKETING_AGENCY') {
    throw new ForbiddenError('Only Founder / Super Admin or Authorized Reviewer can perform this approval transition.');
  }
  if ((payload.targetStage === 'APPROVED' || payload.targetStage === 'PUBLISHED') && !actor.isSuperAdmin && !actor.permissions?.marketing?.canApprove) {
    throw new ForbiddenError('Founder / Marketing Approver authority is required to approve or publish creative deliverables.');
  }

  return await db.transaction(async (tx) => {
    const rows = await tx.select().from(erpMarketingWorkspace).where(eq(erpMarketingWorkspace.id, assetId));
    if (!rows.length) throw new NotFoundError('Creative asset not found.');
    const cur = rows[0];

    const mappedStatus =
      payload.targetStage === 'PUBLISHED'
        ? 'LIVE'
        : payload.targetStage === 'APPROVED'
        ? 'APPROVED'
        : payload.targetStage === 'SUBMITTED' || payload.targetStage === 'UNDER_REVIEW'
        ? 'CLIENT_REVIEW'
        : 'IN_PRODUCTION';

    const [updated] = await tx
      .update(erpMarketingWorkspace)
      .set({
        approvalStage: payload.targetStage,
        status: mappedStatus,
        founderFeedback: payload.feedback?.trim() || cur.founderFeedback,
        approvedByEmail: payload.targetStage === 'APPROVED' || payload.targetStage === 'PUBLISHED' ? actor.email : cur.approvedByEmail,
        approvedAt: payload.targetStage === 'APPROVED' ? new Date() : cur.approvedAt,
        version: sql`${erpMarketingWorkspace.version} + 1`,
        updatedAt: new Date()
      })
      .where(eq(erpMarketingWorkspace.id, cur.id))
      .returning();

    const nextRev = (cur.currentRevision || 1);
    await tx.insert(erpCreativeRevisions).values({
      id: makeId('crev'),
      organizationId: ORG_ID,
      assetId: cur.id,
      revisionNumber: nextRev,
      adScript: cur.adScript,
      captionCopy: cur.captionCopy,
      deliverableUrl: cur.deliverableUrl,
      storytellingAngle: cur.storytellingAngle,
      changeSummary: `Stage moved ${cur.approvalStage} → ${payload.targetStage}`,
      approvalStage: payload.targetStage,
      reviewerEmail: actor.email,
      reviewerNotes: payload.feedback?.trim() || null,
      submittedByEmail: actor.email
    });

    if (payload.targetStage === 'SUBMITTED') {
      const aprNum = await getNextSequence(tx, 'APR');
      await tx.insert(erpApprovals).values({
        id: makeId('apr'),
        organizationId: ORG_ID,
        departmentId: 'dept-mkt',
        approvalNumber: aprNum,
        moduleKey: 'marketing',
        entityType: 'MARKETING_CREATIVE',
        entityId: cur.id,
        title: `Founder Review: ${cur.briefCode} — ${cur.title}`,
        summary: `${cur.channel} · ${cur.strategyType}`,
        amountInr: Number(cur.budgetInr || 0),
        requiredRoleCode: 'SUPER_ADMIN',
        requestedByEmail: actor.email,
        status: 'PENDING'
      });
    } else if (payload.targetStage === 'APPROVED' || payload.targetStage === 'CHANGES_REQUESTED') {
      await tx
        .update(erpApprovals)
        .set({
          status: payload.targetStage === 'APPROVED' ? 'APPROVED' : 'REJECTED',
          decidedByEmail: actor.email,
          decisionNote: payload.feedback?.trim() || `Transitioned to ${payload.targetStage}`,
          decidedAt: new Date(),
          updatedAt: new Date()
        })
        .where(and(eq(erpApprovals.entityType, 'MARKETING_CREATIVE'), eq(erpApprovals.entityId, cur.id), eq(erpApprovals.status, 'PENDING')));
    }

    await recordErpAuditLog(tx, {
      action: `ERP_CREATIVE_${payload.targetStage}`,
      entity: 'erp_marketing_workspace',
      entityId: cur.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `${cur.briefCode} moved to ${payload.targetStage}${payload.feedback ? `: ${payload.feedback}` : ''}`
    });
    return updated;
  });
}

// ============================================================================
// 2. INFLUENCER DATABASE, SEEDING REQUESTS, SAMPLE DISPATCH & AGENCY INVOICES
// ============================================================================

export async function upsertInfluencerPartner(
  actor: ErpActorContext,
  payload: {
    name: string;
    handle: string;
    platform: string;
    referralCode: string;
    commissionRate: number;
    city?: string;
    shippingAddress?: string;
    niche?: string;
  }
) {
  await ensureAgencyHrSeeded();
  if (!payload.name?.trim() || !payload.handle?.trim() || !payload.referralCode?.trim()) {
    throw new ValidationError('Creator name, social handle, and referral code are required.');
  }
  const refCode = payload.referralCode.trim().toUpperCase();
  return await db.transaction(async (tx) => {
    const [partner] = await tx
      .insert(influencers)
      .values({
        id: makeId('inf'),
        name: payload.name.trim(),
        handle: payload.handle.trim(),
        platform: payload.platform || 'INSTAGRAM',
        referralCode: refCode,
        commissionRate: Number(payload.commissionRate || 12),
        status: 'active',
        partnerMetadata: {
          city: payload.city || 'Mumbai',
          shippingAddress: payload.shippingAddress || 'Address to be confirmed before dispatch',
          niche: payload.niche || 'Luxury Lifestyle & Niche Fragrance',
          onboardedBy: actor.email
        }
      })
      .onConflictDoUpdate({
        target: influencers.referralCode,
        set: {
          name: payload.name.trim(),
          handle: payload.handle.trim(),
          platform: payload.platform || 'INSTAGRAM',
          commissionRate: Number(payload.commissionRate || 12)
        }
      })
      .returning();

    await recordErpAuditLog(tx, {
      action: 'ERP_INFLUENCER_SAVED',
      entity: 'influencers',
      entityId: partner.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Saved creator partner ${partner.name} (${partner.handle} · ${partner.referralCode})`
    });
    return partner;
  });
}

export async function createInfluencerSeedingRequest(
  actor: ErpActorContext,
  payload: {
    influencerId: string;
    campaignName: string;
    deliverableTitle: string;
    sampleSku: string;
    quantityMl: number;
    recipientAddress: string;
    courierName?: string;
    awbNumber?: string;
    sampleCostInr?: number;
    commercialFeeInr?: number;
    followUpDate?: string;
  }
) {
  await ensureAgencyHrSeeded();
  const infRows = await db.select().from(influencers).where(eq(influencers.id, payload.influencerId));
  if (!infRows.length) throw new NotFoundError('Influencer partner not found.');
  const inf = infRows[0];
  if (!payload.deliverableTitle?.trim() || !payload.recipientAddress?.trim()) {
    throw new ValidationError('Deliverable title and shipping address are required for creator seeding.');
  }

  return await db.transaction(async (tx) => {
    const sampleNumber = await getNextSequence(tx, 'SMP');
    const isDispatched = Boolean(payload.awbNumber?.trim());

    const [sample] = await tx
      .insert(erpSamples)
      .values({
        id: makeId('smp'),
        organizationId: ORG_ID,
        sampleNumber,
        sampleType: 'INFLUENCER_SEEDING',
        purpose: 'INFLUENCER_SEEDING',
        workflowStage: isDispatched ? 'DISPATCHED' : 'REQUESTED',
        fragranceName: payload.sampleSku || 'Fragmoré 10ML Discovery Coffret',
        recipientType: 'INFLUENCER',
        recipientName: `${inf.name} (${inf.handle})`,
        recipientAddress: payload.recipientAddress.trim(),
        volumeMl: Number(payload.quantityMl || 10),
        quantityUnits: 1,
        costPerSampleInr: Number(payload.sampleCostInr || 480),
        totalCostInr: Number(payload.sampleCostInr || 480),
        preparerEmail: actor.email,
        requestedByEmail: actor.email,
        dispatchDate: isDispatched ? currentIsoDate() : null,
        courierName: payload.courierName || null,
        trackingNumber: payload.awbNumber || null,
        feedbackStatus: 'PENDING',
        followUpDate: payload.followUpDate || addDaysIso(7),
        evaluationNotes: `Campaign: ${payload.campaignName}`,
        status: isDispatched ? 'DISPATCHED' : 'REQUESTED'
      })
      .returning();

    const [deliverable] = await tx
      .insert(influencerContentDeliverables)
      .values({
        id: makeId('icd'),
        influencerId: inf.id,
        influencerName: inf.name,
        handle: inf.handle,
        platform: inf.platform,
        campaignName: payload.campaignName.trim(),
        deliverableTitle: payload.deliverableTitle.trim(),
        stage: isDispatched ? 'SAMPLE_SHIPPED' : 'BRIEF_ISSUED',
        sampleSku: `${sampleNumber} · ${payload.sampleSku || 'Discovery Coffret'}`,
        sampleAwb: payload.awbNumber || null,
        hasRequiredAdDisclosure: false,
        performanceMetrics: { views: 0, likes: 0, saves: 0, clicks: 0, orders: 0 },
        commercialFeeInr: Number(payload.commercialFeeInr || 0),
        paymentStatus: 'UNBILLED',
        timeline: [
          {
            at: new Date().toISOString(),
            actor: actor.email,
            event: `Seeding request ${sampleNumber} logged (${isDispatched ? `AWB ${payload.awbNumber}` : 'Awaiting dispatch'})`
          }
        ]
      })
      .returning();

    await createErpNotification(tx, {
      departmentCode: 'QC',
      severity: 'INFO',
      category: 'INFLUENCER_SEEDING',
      title: `Seeding Sample Request ${sampleNumber}`,
      message: `${inf.name} (${inf.handle}) — Dispatch ${payload.sampleSku} to ${payload.recipientAddress}`,
      linkModule: 'quality',
      linkEntityId: sample.id
    });

    return { sample, deliverable };
  });
}

export async function updateSeedingDispatchAndFeedback(
  actor: ErpActorContext,
  payload: {
    sampleId?: string;
    deliverableId?: string;
    courierName?: string;
    trackingNumber?: string;
    feedbackStatus?: string;
    feedbackNotes?: string;
    stage?: string;
    draftUrl?: string;
    publishedUrl?: string;
  }
) {
  await ensureAgencyHrSeeded();
  return await db.transaction(async (tx) => {
    let sample: any = null;
    let deliverable: any = null;
    if (payload.sampleId) {
      const [upd] = await tx
        .update(erpSamples)
        .set({
          courierName: payload.courierName || undefined,
          trackingNumber: payload.trackingNumber || undefined,
          dispatchDate: payload.trackingNumber ? currentIsoDate() : undefined,
          feedbackStatus: payload.feedbackStatus || undefined,
          feedbackSummary: payload.feedbackNotes || undefined,
          workflowStage: payload.trackingNumber ? 'DISPATCHED' : undefined,
          status: payload.trackingNumber ? 'DISPATCHED' : undefined,
          updatedAt: new Date()
        })
        .where(eq(erpSamples.id, payload.sampleId))
        .returning();
      sample = upd;
    }
    if (payload.deliverableId) {
      const [updDel] = await tx
        .update(influencerContentDeliverables)
        .set({
          sampleAwb: payload.trackingNumber || undefined,
          stage: payload.stage || (payload.trackingNumber ? 'SAMPLE_SHIPPED' : undefined),
          draftUrl: payload.draftUrl || undefined,
          publishedUrl: payload.publishedUrl || undefined,
          updatedAt: new Date()
        })
        .where(eq(influencerContentDeliverables.id, payload.deliverableId))
        .returning();
      deliverable = updDel;
    }
    await recordErpAuditLog(tx, {
      action: 'ERP_SEEDING_DISPATCH_UPDATED',
      entity: 'erp_samples',
      entityId: payload.sampleId || payload.deliverableId || 'seeding',
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Updated seeding dispatch (${payload.trackingNumber || 'status sync'})`
    });
    return { sample, deliverable };
  });
}

export async function saveAgencyInvoice(
  actor: ErpActorContext,
  payload: {
    id?: string;
    agencyId: string;
    billingMonth: string;
    description: string;
    retainerInr: number;
    productionExtrasInr?: number;
    gstRatePct?: number;
    action?: 'SAVE' | 'APPROVE' | 'MARK_PAID';
    paymentReference?: string;
  }
) {
  await ensureAgencyHrSeeded();
  return await db.transaction(async (tx) => {
    if (payload.id && (payload.action === 'APPROVE' || payload.action === 'MARK_PAID')) {
      const rows = await tx.select().from(erpAgencyInvoices).where(eq(erpAgencyInvoices.id, payload.id));
      if (!rows.length) throw new NotFoundError('Agency invoice not found.');
      const cur = rows[0];
      if (payload.action === 'MARK_PAID' && !payload.paymentReference?.trim()) {
        throw new ValidationError('Payment UTR/reference number is required to mark an agency invoice PAID.');
      }
      const [upd] = await tx
        .update(erpAgencyInvoices)
        .set({
          status: payload.action === 'APPROVE' ? 'APPROVED' : 'PAID',
          approvedByEmail: actor.email,
          paidAmountInr: payload.action === 'MARK_PAID' ? cur.totalAmountInr : cur.paidAmountInr,
          paymentReference: payload.paymentReference?.trim() || cur.paymentReference,
          paymentDate: payload.action === 'MARK_PAID' ? currentIsoDate() : cur.paymentDate,
          updatedAt: new Date()
        })
        .where(eq(erpAgencyInvoices.id, cur.id))
        .returning();
      return upd;
    }

    const retainer = round2(Number(payload.retainerInr || 0));
    const extras = round2(Number(payload.productionExtrasInr || 0));
    const gstRate = Number(payload.gstRatePct ?? 18);
    const gstAmt = round2(((retainer + extras) * gstRate) / 100);
    const total = round2(retainer + extras + gstAmt);
    const invNumber = await getNextSequence(tx, 'AGINV');

    const [created] = await tx
      .insert(erpAgencyInvoices)
      .values({
        id: makeId('aginv'),
        organizationId: ORG_ID,
        agencyId: payload.agencyId,
        invoiceNumber: invNumber,
        billingMonth: payload.billingMonth || new Date().toISOString().slice(0, 7),
        invoiceDate: currentIsoDate(),
        dueDate: addDaysIso(15),
        description: payload.description?.trim() || 'Monthly Agency Retainer & Production Services',
        retainerInr: retainer,
        productionExtrasInr: extras,
        gstAmountInr: gstAmt,
        totalAmountInr: total,
        paidAmountInr: 0,
        status: 'SUBMITTED',
        createdByEmail: actor.email
      })
      .returning();

    await recordErpAuditLog(tx, {
      action: 'ERP_AGENCY_INVOICE_SUBMITTED',
      entity: 'erp_agency_invoices',
      entityId: created.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Submitted agency invoice ${invNumber} for ₹${total}`
    });
    return created;
  });
}

export async function syncAuthorizedAdReporting(actor: ErpActorContext) {
  await ensureAgencyHrSeeded();
  const cmsRows = await db.select().from(cmsSettings).where(eq(cmsSettings.id, 'current'));
  const settings = (cmsRows[0]?.settings as any) || {};
  const metaCfg = settings?.integrations?.meta || settings?.meta || {};
  const googleCfg = settings?.integrations?.google || settings?.google || {};

  const metaAuthorized = Boolean(metaCfg?.pixelId && (metaCfg?.status === 'CONNECTED' || metaCfg?.conversionsApiToken));
  const googleAuthorized = Boolean(googleCfg?.googleAdsId || googleCfg?.ga4MeasurementId);

  const ledgerEvents = await db.select().from(analyticsTrackingLedger);
  const storeOrders = await db.select().from(orders);

  const metaPurchases = ledgerEvents.filter(
    (e) => String(e.eventSource || '').toUpperCase().includes('META') && e.eventName === 'PURCHASE'
  ).length;
  const googlePurchases = ledgerEvents.filter(
    (e) =>
      (String(e.eventSource || '').toUpperCase().includes('GA4') ||
        String(e.eventSource || '').toUpperCase().includes('GOOGLE')) &&
      e.eventName === 'PURCHASE'
  ).length;
  const totalAttrRevenue = storeOrders.reduce((s, o) => s + Number(o.totalAmount || 0), 0);

  await recordErpAuditLog(db, {
    action: 'ERP_AD_REPORTING_SYNC',
    entity: 'cms_settings',
    entityId: 'current',
    actorEmail: actor.email,
    actorRole: actor.roleCode,
    details: `Ad reporting check: Meta=${metaAuthorized ? 'AUTHORIZED' : 'NOT_CONFIGURED'}, Google=${googleAuthorized ? 'AUTHORIZED' : 'NOT_CONFIGURED'}`
  });

  return {
    metaAuthorized,
    googleAuthorized,
    metaPixelId: metaCfg?.pixelId || null,
    googleAdsId: googleCfg?.googleAdsId || null,
    ga4MeasurementId: googleCfg?.ga4MeasurementId || null,
    metaAttributedConversions: metaAuthorized ? metaPurchases : 0,
    googleAttributedConversions: googleAuthorized ? googlePurchases : 0,
    observedStoreRevenueInr: totalAttrRevenue,
    statusMessage:
      metaAuthorized || googleAuthorized
        ? 'Verified against live Admin Integrations settings & server attribution ledger.'
        : 'Meta Ads and Google Ads API tokens are not yet authorized in Integrations Settings. No live ad metrics fabricated.'
  };
}

// ============================================================================
// 3. INTERNSHIP MANAGEMENT (7 DEPARTMENTS, ATTENDANCE, SUBMISSIONS, EVALS, CERTS)
// ============================================================================

export async function upsertInternProfile(
  actor: ErpActorContext,
  payload: {
    id?: string;
    fullName: string;
    email: string;
    phone: string;
    university: string;
    departmentTrack: string;
    mentorEmail: string;
    startDate: string;
    endDate: string;
    stipendMonthlyInr: number;
    projectTitle: string;
    confidentialitySigned?: boolean;
    canViewSensitiveFinancials?: boolean;
    canViewFormulations?: boolean;
    provisionInternAccess?: boolean;
  }
) {
  await ensureAgencyHrSeeded();
  if (!payload.fullName?.trim() || !payload.email?.trim()) {
    throw new ValidationError('Intern name and email are required.');
  }
  const email = payload.email.trim().toLowerCase();
  const trackMap: Record<string, { deptId: string; legacyTrack: string }> = {
    SALES: { deptId: 'dept-crm', legacyTrack: 'DIGITAL_MARKETING' },
    DIGITAL_MARKETING: { deptId: 'dept-mkt', legacyTrack: 'DIGITAL_MARKETING' },
    OPERATIONS: { deptId: 'dept-exec', legacyTrack: 'SUPPLY_CHAIN' },
    PROCUREMENT: { deptId: 'dept-proc', legacyTrack: 'SUPPLY_CHAIN' },
    PRODUCTION: { deptId: 'dept-prod', legacyTrack: 'FORMULATION_RD' },
    HR: { deptId: 'dept-hr', legacyTrack: 'UI_UX' },
    FINANCE: { deptId: 'dept-fin', legacyTrack: 'FINANCE_OPS' }
  };
  const mapped = trackMap[payload.departmentTrack] || { deptId: 'dept-mkt', legacyTrack: 'DIGITAL_MARKETING' };

  return await db.transaction(async (tx) => {
    if (payload.id) {
      const [upd] = await tx
        .update(erpInterns)
        .set({
          fullName: payload.fullName.trim(),
          phone: payload.phone || '+91 98000 00000',
          university: payload.university.trim(),
          departmentId: mapped.deptId,
          track: mapped.legacyTrack,
          departmentTrack: payload.departmentTrack,
          mentorEmail: payload.mentorEmail.trim().toLowerCase(),
          startDate: payload.startDate || currentIsoDate(),
          endDate: payload.endDate || addDaysIso(90),
          stipendMonthlyInr: Number(payload.stipendMonthlyInr || 15000),
          projectTitle: payload.projectTitle.trim(),
          confidentialitySigned: payload.confidentialitySigned ?? true,
          canViewSensitiveFinancials: actor.isSuperAdmin ? Boolean(payload.canViewSensitiveFinancials) : false,
          canViewFormulations: actor.isSuperAdmin ? Boolean(payload.canViewFormulations) : false,
          version: sql`${erpInterns.version} + 1`,
          updatedAt: new Date()
        })
        .where(eq(erpInterns.id, payload.id))
        .returning();
      return upd;
    }

    const internCode = await getNextSequence(tx, 'INT');
    const [created] = await tx
      .insert(erpInterns)
      .values({
        id: makeId('int'),
        organizationId: ORG_ID,
        departmentId: mapped.deptId,
        internCode,
        fullName: payload.fullName.trim(),
        email,
        phone: payload.phone || '+91 98000 00000',
        university: payload.university.trim(),
        track: mapped.legacyTrack,
        departmentTrack: payload.departmentTrack || 'DIGITAL_MARKETING',
        mentorEmail: (payload.mentorEmail || actor.email).trim().toLowerCase(),
        startDate: payload.startDate || currentIsoDate(),
        endDate: payload.endDate || addDaysIso(90),
        stipendMonthlyInr: Number(payload.stipendMonthlyInr || 15000),
        projectTitle: payload.projectTitle.trim(),
        confidentialitySigned: payload.confidentialitySigned ?? true,
        canViewSensitiveFinancials: false,
        canViewFormulations: false,
        evaluationScore: 4.5,
        status: 'ACTIVE'
      })
      .returning();

    if (payload.provisionInternAccess) {
      await tx
        .insert(erpUserAccess)
        .values({
          id: makeId('ua'),
          organizationId: ORG_ID,
          email,
          displayName: `${created.fullName} (Intern)`,
          roleId: 'role-intern-viewer',
          departmentId: mapped.deptId,
          isActive: true
        })
        .onConflictDoNothing();
    }

    await recordErpAuditLog(tx, {
      action: 'ERP_INTERN_ONBOARDED',
      entity: 'erp_interns',
      entityId: created.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Onboarded ${internCode}: ${created.fullName} (${created.departmentTrack}) supervised by ${created.mentorEmail}`
    });
    return created;
  });
}

export async function recordInternAttendance(
  actor: ErpActorContext,
  payload: {
    internId: string;
    attendanceDate: string;
    workMode: string;
    checkInTime: string;
    checkOutTime?: string;
    hoursLogged: number;
    status: string;
    notes?: string;
  }
) {
  await ensureAgencyHrSeeded();
  const intRows = await db.select().from(erpInterns).where(eq(erpInterns.id, payload.internId));
  if (!intRows.length) throw new NotFoundError('Intern profile not found.');

  const [entry] = await db
    .insert(erpInternAttendance)
    .values({
      id: makeId('att'),
      organizationId: ORG_ID,
      internId: payload.internId,
      attendanceDate: payload.attendanceDate || currentIsoDate(),
      workMode: payload.workMode || 'ATELIER_ONSITE',
      checkInTime: payload.checkInTime || '09:30',
      checkOutTime: payload.checkOutTime || '18:00',
      hoursLogged: Number(payload.hoursLogged ?? 8),
      status: payload.status || 'PRESENT',
      notes: payload.notes || null,
      verifiedByEmail: actor.roleCode === 'INTERN_VIEWER' ? null : actor.email
    })
    .returning();
  return entry;
}

export async function submitInternWork(
  actor: ErpActorContext,
  payload: {
    internId: string;
    taskId?: string;
    departmentTrack: string;
    title: string;
    summary: string;
    deliverableUrl?: string;
    requestApproval?: boolean;
  }
) {
  await ensureAgencyHrSeeded();
  if (!payload.title?.trim() || !payload.summary?.trim()) {
    throw new ValidationError('Work submission title and summary are required.');
  }
  const intRows = await db.select().from(erpInterns).where(eq(erpInterns.id, payload.internId));
  if (!intRows.length) throw new NotFoundError('Intern profile not found.');
  const intern = intRows[0];

  return await db.transaction(async (tx) => {
    const subNum = await getNextSequence(tx, 'SUB');
    const stage = payload.requestApproval === false ? 'DRAFT' : 'SUBMITTED';
    const [submission] = await tx
      .insert(erpInternSubmissions)
      .values({
        id: makeId('sub'),
        organizationId: ORG_ID,
        internId: intern.id,
        taskId: payload.taskId || null,
        submissionNumber: subNum,
        departmentTrack: payload.departmentTrack || intern.departmentTrack,
        title: payload.title.trim(),
        summary: payload.summary.trim(),
        deliverableUrl: payload.deliverableUrl || null,
        attachmentIds: [],
        approvalStage: stage,
        submittedByEmail: actor.email
      })
      .returning();

    if (stage === 'SUBMITTED') {
      const aprNum = await getNextSequence(tx, 'APR');
      await tx.insert(erpApprovals).values({
        id: makeId('apr'),
        organizationId: ORG_ID,
        departmentId: intern.departmentId || 'dept-hr',
        approvalNumber: aprNum,
        moduleKey: 'hr',
        entityType: 'INTERN_SUBMISSION',
        entityId: submission.id,
        title: `Intern Submission ${subNum}: ${submission.title}`,
        summary: `${intern.fullName} (${intern.departmentTrack}) — ${submission.summary.slice(0, 120)}`,
        amountInr: 0,
        requiredRoleCode: 'HR_MANAGER',
        requestedByEmail: actor.email,
        status: 'PENDING'
      });
    }

    await recordErpAuditLog(tx, {
      action: 'ERP_INTERN_WORK_SUBMITTED',
      entity: 'erp_intern_submissions',
      entityId: submission.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `${subNum} submitted by ${intern.fullName} (${stage})`
    });
    return submission;
  });
}

export async function reviewInternSubmission(
  actor: ErpActorContext,
  submissionId: string,
  payload: {
    approvalStage: 'UNDER_REVIEW' | 'CHANGES_REQUESTED' | 'APPROVED' | 'COMPLETED';
    feedback?: string;
  }
) {
  if (actor.roleCode === 'INTERN_VIEWER') {
    throw new ForbiddenError('Interns cannot self-approve submissions. A supervisor or HR Manager must review.');
  }
  return await db.transaction(async (tx) => {
    const rows = await tx.select().from(erpInternSubmissions).where(eq(erpInternSubmissions.id, submissionId));
    if (!rows.length) throw new NotFoundError('Intern work submission not found.');
    const cur = rows[0];
    const [upd] = await tx
      .update(erpInternSubmissions)
      .set({
        approvalStage: payload.approvalStage,
        reviewerEmail: actor.email,
        reviewerFeedback: payload.feedback?.trim() || cur.reviewerFeedback,
        approvedAt: payload.approvalStage === 'APPROVED' || payload.approvalStage === 'COMPLETED' ? new Date() : cur.approvedAt,
        updatedAt: new Date()
      })
      .where(eq(erpInternSubmissions.id, cur.id))
      .returning();

    if (payload.approvalStage === 'APPROVED' || payload.approvalStage === 'CHANGES_REQUESTED') {
      await tx
        .update(erpApprovals)
        .set({
          status: payload.approvalStage === 'APPROVED' ? 'APPROVED' : 'REJECTED',
          decidedByEmail: actor.email,
          decisionNote: payload.feedback?.trim() || `Submission ${payload.approvalStage}`,
          decidedAt: new Date(),
          updatedAt: new Date()
        })
        .where(and(eq(erpApprovals.entityType, 'INTERN_SUBMISSION'), eq(erpApprovals.entityId, cur.id), eq(erpApprovals.status, 'PENDING')));
    }
    return upd;
  });
}

export async function recordInternEvaluation(
  actor: ErpActorContext,
  payload: {
    internId: string;
    executionScore: number;
    storytellingCraftScore: number;
    reliabilityScore: number;
    strengths: string;
    growthAreas?: string;
    recommendation: string;
    issueCertificate?: boolean;
  }
) {
  if (actor.roleCode === 'INTERN_VIEWER') {
    throw new ForbiddenError('Only HR Managers, Mentors, or Founders may record evaluations and issue completion certificates.');
  }
  if (!payload.strengths?.trim()) throw new ValidationError('Evaluation strengths feedback is required.');

  return await db.transaction(async (tx) => {
    const intRows = await tx.select().from(erpInterns).where(eq(erpInterns.id, payload.internId));
    if (!intRows.length) throw new NotFoundError('Intern profile not found.');
    const intern = intRows[0];

    const exec = Math.min(5, Math.max(1, Number(payload.executionScore || 4.5)));
    const craft = Math.min(5, Math.max(1, Number(payload.storytellingCraftScore || 4.5)));
    const rel = Math.min(5, Math.max(1, Number(payload.reliabilityScore || 4.5)));
    const avg = round2((exec + craft + rel) / 3);
    const evalNum = await getNextSequence(tx, 'EVAL');

    const [evaluation] = await tx
      .insert(erpInternEvaluations)
      .values({
        id: makeId('eval'),
        organizationId: ORG_ID,
        internId: intern.id,
        evaluationNumber: evalNum,
        evaluationDate: currentIsoDate(),
        evaluatorEmail: actor.email,
        executionScore: exec,
        storytellingCraftScore: craft,
        reliabilityScore: rel,
        overallRating: avg,
        strengths: payload.strengths.trim(),
        growthAreas: payload.growthAreas?.trim() || null,
        recommendation: payload.recommendation || 'ENDORSE_FOR_CERTIFICATE',
        certificateEligible: avg >= 3.5,
        notes: `Evaluated by ${actor.email}`
      })
      .returning();

    let certNum = intern.certificateNumber;
    if (payload.issueCertificate) {
      certNum = certNum || (await getNextSequence(tx, 'CERT'));
    }

    const [updatedIntern] = await tx
      .update(erpInterns)
      .set({
        evaluationScore: avg,
        certificateIssued: payload.issueCertificate ? true : intern.certificateIssued,
        certificateNumber: certNum,
        certificateIssuedAt: payload.issueCertificate ? new Date() : intern.certificateIssuedAt,
        status: payload.issueCertificate ? 'COMPLETED' : intern.status,
        version: sql`${erpInterns.version} + 1`,
        updatedAt: new Date()
      })
      .where(eq(erpInterns.id, intern.id))
      .returning();

    await recordErpAuditLog(tx, {
      action: payload.issueCertificate ? 'ERP_INTERN_CERTIFICATE_ISSUED' : 'ERP_INTERN_EVALUATED',
      entity: 'erp_interns',
      entityId: intern.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `${evalNum} for ${intern.fullName}: rating ${avg}/5${certNum ? ` · Certificate ${certNum}` : ''}`
    });
    return { evaluation, intern: updatedIntern };
  });
}

// ============================================================================
// 4. COLLABORATIVE TASK MANAGEMENT (KANBAN, DEPENDENCIES, CHECKLISTS, COMMENTS)
// ============================================================================

export async function saveCollaborativeTask(
  actor: ErpActorContext,
  payload: {
    id?: string;
    title?: string;
    description?: string;
    sourceModule?: string;
    priority?: string;
    assignedToEmail?: string;
    dueDate?: string;
    reminderAt?: string;
    status?: string;
    approvalStage?: string;
    dependsOnTaskIds?: string[];
    checklists?: Array<{ id: string; text: string; done: boolean }>;
    linkedEntityType?: string;
    linkedEntityId?: string;
    expectedVersion?: number;
  }
) {
  await ensureAgencyHrSeeded();
  return await db.transaction(async (tx) => {
    if (payload.id) {
      const rows = await tx.select().from(erpTasks).where(eq(erpTasks.id, payload.id));
      if (!rows.length) throw new NotFoundError('Task not found.');
      const cur = rows[0];
      if (payload.expectedVersion !== undefined && cur.version !== payload.expectedVersion) {
        throw new ConflictError('Task was modified concurrently by another collaborator.');
      }

      const targetStatus = payload.status || cur.status;
      const deps = payload.dependsOnTaskIds ?? ((cur.dependsOnTaskIds as string[]) || []);

      // Enforce prerequisite dependency guard before marking DONE
      if (targetStatus === 'DONE' && deps.length > 0) {
        const allTasks = await tx.select().from(erpTasks);
        const blocking = deps.filter((depId) => {
          const found = allTasks.find((t) => t.id === depId);
          return found && found.status !== 'DONE';
        });
        if (blocking.length > 0) {
          throw new ValidationError(
            `Cannot mark task DONE while ${blocking.length} prerequisite dependency task(s) are incomplete.`
          );
        }
      }

      const prevLogs = Array.isArray(cur.activityLog) ? (cur.activityLog as any[]) : [];
      const newLog = {
        timestamp: new Date().toISOString(),
        actorEmail: actor.email,
        action: 'UPDATED',
        detail: `Status: ${cur.status} → ${targetStatus}${payload.approvalStage ? ` · Approval: ${payload.approvalStage}` : ''}`
      };

      const targetApproval =
        payload.approvalStage ||
        (targetStatus === 'DONE'
          ? 'COMPLETED'
          : targetStatus === 'IN_REVIEW'
          ? 'UNDER_REVIEW'
          : cur.approvalStage);

      const [updated] = await tx
        .update(erpTasks)
        .set({
          title: payload.title?.trim() || cur.title,
          description: payload.description?.trim() || cur.description,
          priority: payload.priority || cur.priority,
          assignedToEmail: payload.assignedToEmail || cur.assignedToEmail,
          dueDate: payload.dueDate ?? cur.dueDate,
          reminderAt: payload.reminderAt ?? cur.reminderAt,
          status: targetStatus,
          approvalStage: targetApproval,
          dependsOnTaskIds: deps,
          checklists: payload.checklists ?? cur.checklists,
          activityLog: [...prevLogs, newLog].slice(-40),
          completedAt: targetStatus === 'DONE' ? new Date() : cur.completedAt,
          version: sql`${erpTasks.version} + 1`,
          updatedAt: new Date()
        })
        .where(eq(erpTasks.id, cur.id))
        .returning();

      return updated;
    }

    if (!payload.title?.trim()) throw new ValidationError('Task title is required.');
    const taskNumber = await getNextSequence(tx, 'TSK');
    const [created] = await tx
      .insert(erpTasks)
      .values({
        id: makeId('tsk'),
        organizationId: ORG_ID,
        departmentId: 'dept-exec',
        taskNumber,
        title: payload.title.trim(),
        description: payload.description?.trim() || payload.title.trim(),
        sourceModule: payload.sourceModule || 'marketing',
        linkedEntityType: payload.linkedEntityType || null,
        linkedEntityId: payload.linkedEntityId || null,
        priority: payload.priority || 'HIGH',
        assignedToEmail: (payload.assignedToEmail || actor.email).trim().toLowerCase(),
        createdByEmail: actor.email,
        dueDate: payload.dueDate || addDaysIso(5),
        reminderAt: payload.reminderAt || addDaysIso(3),
        approvalStage: payload.approvalStage || 'DRAFT',
        dependsOnTaskIds: payload.dependsOnTaskIds || [],
        checklists:
          payload.checklists && payload.checklists.length
            ? payload.checklists
            : [
                { id: 'chk-1', text: 'Complete primary deliverable draft', done: false },
                { id: 'chk-2', text: 'Attach review artifact & submit for approval', done: false }
              ],
        activityLog: [
          {
            timestamp: new Date().toISOString(),
            actorEmail: actor.email,
            action: 'CREATED',
            detail: `Task ${taskNumber} assigned to ${payload.assignedToEmail || actor.email}`
          }
        ],
        status: payload.status || 'TODO'
      })
      .returning();

    await recordErpAuditLog(tx, {
      action: 'ERP_COLLAB_TASK_CREATED',
      entity: 'erp_tasks',
      entityId: created.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Created task ${taskNumber}: ${created.title} (${created.priority})`
    });
    return created;
  });
}

export async function addTaskComment(
  actor: ErpActorContext,
  taskId: string,
  payload: { commentText: string; attachmentUrl?: string }
) {
  if (!payload.commentText?.trim()) throw new ValidationError('Comment message cannot be empty.');
  return await db.transaction(async (tx) => {
    const taskRows = await tx.select().from(erpTasks).where(eq(erpTasks.id, taskId));
    if (!taskRows.length) throw new NotFoundError('Task not found.');
    const task = taskRows[0];

    const [comment] = await tx
      .insert(erpTaskComments)
      .values({
        id: makeId('tcmt'),
        organizationId: ORG_ID,
        taskId,
        authorEmail: actor.email,
        authorRole: actor.roleCode,
        commentText: payload.commentText.trim(),
        attachmentUrl: payload.attachmentUrl || null
      })
      .returning();

    const prevLogs = Array.isArray(task.activityLog) ? (task.activityLog as any[]) : [];
    await tx
      .update(erpTasks)
      .set({
        activityLog: [
          ...prevLogs,
          {
            timestamp: new Date().toISOString(),
            actorEmail: actor.email,
            action: 'COMMENTED',
            detail: payload.commentText.trim().slice(0, 100)
          }
        ].slice(-40),
        updatedAt: new Date()
      })
      .where(eq(erpTasks.id, taskId));

    return comment;
  });
}

// ============================================================================
// 5. UNIFIED WORKSPACE SNAPSHOT + SENSITIVITY REDACTION + REPORT BUILDER
// ============================================================================

export async function getAgencyHrWorkspaceSnapshot(actor: ErpActorContext) {
  await ensureAgencyHrSeeded();

  const [
    agencyProfiles,
    agencyStaff,
    agencyInvoices,
    marketingAssets,
    creativeRevisions,
    storeCampaigns,
    influencerRows,
    influencerDeliverables,
    rawSamples,
    onceEditions,
    cmsRows,
    employees,
    interns,
    internAttendance,
    internSubmissions,
    internEvaluations,
    tasks,
    taskComments,
    attachments,
    departments,
    approvals,
    formulations
  ] = await Promise.all([
    db.select().from(erpAgencyProfiles),
    db.select().from(erpAgencyStaff).orderBy(erpAgencyStaff.staffCode),
    db.select().from(erpAgencyInvoices).orderBy(desc(erpAgencyInvoices.createdAt)),
    db.select().from(erpMarketingWorkspace).orderBy(desc(erpMarketingWorkspace.createdAt)),
    db.select().from(erpCreativeRevisions).orderBy(desc(erpCreativeRevisions.createdAt)),
    db.select().from(campaigns).orderBy(desc(campaigns.createdAt)),
    db.select().from(influencers).orderBy(desc(influencers.totalRevenue)),
    db.select().from(influencerContentDeliverables).orderBy(desc(influencerContentDeliverables.createdAt)),
    db.select().from(erpSamples).orderBy(desc(erpSamples.createdAt)),
    db.select().from(erpOnceEditions).orderBy(desc(erpOnceEditions.createdAt)),
    db.select().from(cmsSettings).where(eq(cmsSettings.id, 'current')),
    db.select().from(erpEmployees).orderBy(erpEmployees.employeeCode),
    db.select().from(erpInterns).orderBy(erpInterns.internCode),
    db.select().from(erpInternAttendance).orderBy(desc(erpInternAttendance.attendanceDate)),
    db.select().from(erpInternSubmissions).orderBy(desc(erpInternSubmissions.createdAt)),
    db.select().from(erpInternEvaluations).orderBy(desc(erpInternEvaluations.createdAt)),
    db.select().from(erpTasks).orderBy(desc(erpTasks.createdAt)),
    db.select().from(erpTaskComments).orderBy(desc(erpTaskComments.createdAt)),
    db.select().from(erpAttachments).orderBy(desc(erpAttachments.createdAt)),
    db.select().from(erpDepartments),
    db.select().from(erpApprovals).orderBy(desc(erpApprovals.createdAt)),
    db.select().from(erpFormulations)
  ]);

  // Sensitivity enforcement for Interns
  const matchedIntern = interns.find((i) => i.email.toLowerCase() === actor.email.toLowerCase());
  const isInternRole = actor.roleCode === 'INTERN_VIEWER';
  const canSeeFinancials = !isInternRole || Boolean(matchedIntern?.canViewSensitiveFinancials);
  const canSeeFormulations = !isInternRole || Boolean(matchedIntern?.canViewFormulations);

  const safeEmployees = canSeeFinancials
    ? employees
    : employees.map((e) => ({ ...e, monthlySalaryInr: null as any }));
  const safeAgencyProfiles = canSeeFinancials
    ? agencyProfiles
    : agencyProfiles.map((a) => ({ ...a, monthlyRetainerInr: null as any, gstin: '[REDACTED]' }));
  const safeAgencyInvoices = canSeeFinancials ? agencyInvoices : [];
  const safeInterns = canSeeFinancials
    ? interns
    : interns.map((i) => ({ ...i, stipendMonthlyInr: i.email === actor.email ? i.stipendMonthlyInr : (null as any) }));

  const settings = (cmsRows[0]?.settings as any) || {};
  const metaCfg = settings?.integrations?.meta || settings?.meta || {};
  const googleCfg = settings?.integrations?.google || settings?.google || {};
  const adIntegrations = {
    metaAuthorized: Boolean(metaCfg?.pixelId && (metaCfg?.status === 'CONNECTED' || metaCfg?.conversionsApiToken)),
    metaPixelId: metaCfg?.pixelId || null,
    googleAuthorized: Boolean(googleCfg?.googleAdsId || googleCfg?.ga4MeasurementId),
    googleAdsId: googleCfg?.googleAdsId || null,
    ga4MeasurementId: googleCfg?.ga4MeasurementId || null
  };

  // Department productivity aggregation for reports
  const deptProductivity = departments.map((dept) => {
    const deptTasks = tasks.filter((t) => t.sourceModule.toUpperCase() === dept.code || t.departmentId === dept.id);
    const doneCount = deptTasks.filter((t) => t.status === 'DONE').length;
    const activeInternsCount = interns.filter(
      (i) => i.departmentId === dept.id || i.departmentTrack === dept.name.toUpperCase()
    ).length;
    return {
      departmentCode: dept.code,
      departmentName: dept.name,
      totalTasks: deptTasks.length,
      completedTasks: doneCount,
      completionRatePct: deptTasks.length ? Math.round((doneCount / deptTasks.length) * 100) : 100,
      activeInterns: activeInternsCount
    };
  });

  const seedingSamples = rawSamples.filter(
    (s) =>
      s.purpose === 'INFLUENCER_SEEDING' ||
      s.recipientType === 'INFLUENCER' ||
      s.purpose === 'CORPORATE_PROPOSAL'
  );

  return {
    actor,
    securityBoundary: {
      isInternRestricted: isInternRole,
      canSeeSensitiveFinancials: canSeeFinancials,
      canSeeFormulations: canSeeFormulations,
      activeFormulationsCount: canSeeFormulations ? formulations.length : 0
    },
    agencyProfiles: safeAgencyProfiles,
    agencyStaff,
    agencyInvoices: safeAgencyInvoices,
    campaigns: storeCampaigns,
    marketingAssets,
    creativeRevisions,
    influencers: influencerRows,
    influencerDeliverables,
    seedingSamples,
    allSamples: rawSamples,
    onceEditions,
    adIntegrations,
    employees: safeEmployees,
    interns: safeInterns,
    internAttendance,
    internSubmissions,
    internEvaluations,
    tasks,
    taskComments,
    attachments,
    departments,
    approvals: approvals.filter((a) => a.moduleKey === 'marketing' || a.moduleKey === 'hr'),
    reports: {
      attendanceReport: internAttendance.map((a) => {
        const intr = interns.find((i) => i.id === a.internId);
        return {
          Date: a.attendanceDate,
          InternCode: intr?.internCode || a.internId,
          InternName: intr?.fullName || 'Intern',
          Department: intr?.departmentTrack || '—',
          WorkMode: a.workMode,
          CheckIn: a.checkInTime,
          CheckOut: a.checkOutTime || '—',
          Hours: a.hoursLogged,
          Status: a.status
        };
      }),
      tasksReport: tasks.map((t) => ({
        TaskNo: t.taskNumber,
        Title: t.title,
        Module: t.sourceModule,
        Assignee: t.assignedToEmail,
        Priority: t.priority,
        DueDate: t.dueDate || '—',
        KanbanStatus: t.status,
        ApprovalStage: t.approvalStage
      })),
      campaignPerformanceReport: storeCampaigns.map((c) => ({
        Campaign: c.name,
        Channel: c.channel,
        Strategy: (c.campaignMetadata as any)?.strategyType || 'BRAND_STORYTELLING',
        BudgetINR: canSeeFinancials ? c.budget : '[REDACTED]',
        SpendINR: canSeeFinancials ? c.spend : '[REDACTED]',
        RevenueINR: canSeeFinancials ? c.revenue : '[REDACTED]',
        ROAS: c.spend > 0 ? Number((c.revenue / c.spend).toFixed(2)) : 0,
        Status: c.status
      })),
      influencerActivityReport: influencerRows.map((inf) => ({
        Creator: inf.name,
        Handle: inf.handle,
        Platform: inf.platform,
        ReferralCode: inf.referralCode,
        Clicks: inf.clicks,
        Orders: inf.ordersCount,
        RevenueINR: canSeeFinancials ? inf.totalRevenue : '[REDACTED]',
        Status: inf.status
      })),
      samplingReport: seedingSamples.map((s) => ({
        SampleNo: s.sampleNumber,
        Fragrance: s.fragranceName,
        Purpose: s.purpose,
        Recipient: s.recipientName,
        QtyML: s.volumeMl,
        Courier: s.courierName || 'Pending',
        AWB: s.trackingNumber || 'Pending',
        Feedback: s.feedbackStatus || 'AWAITING_CONTENT',
        Status: s.status
      })),
      departmentProductivityReport: deptProductivity
    }
  };
}
