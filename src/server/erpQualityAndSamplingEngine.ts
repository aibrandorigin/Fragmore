import crypto from 'crypto';
import { eq, desc, sql, and, asc } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  erpSamples,
  erpSampleEvents,
  erpQcRecords,
  erpQcChecklists,
  erpFormulations,
  erpFormulationVersions,
  erpMaterials,
  erpStockLots,
  erpStockMovements,
  erpAccountingJournals,
  erpApprovals,
  erpAttachments,
  erpLeads,
  erpMarketingWorkspace,
  influencerContentDeliverables,
  productionBatches,
  customers,
  orders
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
import { appendStockMovementTx } from './erpManufacturingEngine.ts';

// ============================================================================
// CONSTANTS & DOMAIN DEFINITIONS
// ============================================================================

export const SAMPLE_PURPOSES = [
  { code: 'NEW_FORMULA_DEV', label: 'New Perfume Formulation Development', defaultRecipientType: 'INTERNAL' },
  { code: 'FORMULA_REVISION', label: 'Formula Revisions & Iteration', defaultRecipientType: 'INTERNAL' },
  { code: 'CUSTOMER_TRIAL', label: 'Customer Trials & Bespoke Consultations', defaultRecipientType: 'CUSTOMER' },
  { code: 'INFLUENCER_SEEDING', label: 'Influencer Seeding & Creator Campaigns', defaultRecipientType: 'INFLUENCER' },
  { code: 'RETAILER_TESTING', label: 'Retailer & Distributor Testing', defaultRecipientType: 'RETAILER' },
  { code: 'CORPORATE_PROPOSAL', label: 'Corporate Proposals & Hospitality Pitch', defaultRecipientType: 'CORPORATE' },
  { code: 'PERFUME_BAR_DEMO', label: 'Perfume Bar Demonstrations & Events', defaultRecipientType: 'PERFUME_BAR' },
  { code: 'INTERNAL_QC', label: 'Internal Quality Evaluation & Stability', defaultRecipientType: 'INTERNAL' }
] as const;

export const SAMPLE_WORKFLOW_STAGES = [
  'REQUESTED',
  'APPROVED',
  'MATERIAL_ISSUED',
  'PREPARED',
  'TESTING',
  'FEEDBACK',
  'REVISION_REQUIRED',
  'APPROVED_FOR_DISPATCH',
  'DISPATCHED',
  'ARCHIVED'
] as const;

export type SampleWorkflowStage = (typeof SAMPLE_WORKFLOW_STAGES)[number];

export const QC_INSPECTION_TYPES = [
  'SAMPLE_EVALUATION',
  'FINISHED_BATCH_RELEASE',
  'IN_PROCESS_MACERATION',
  'RAW_MATERIAL_INWARD',
  'STABILITY_AUDIT'
] as const;

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
}

function round2(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function round4(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 10000) / 10000;
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

function recomputeSampleTotals(sample: {
  rawMaterialCostInr: number;
  vialCostInr: number;
  labelCostInr: number;
  packagingCostInr: number;
  shippingCostInr: number;
  handlingCostInr: number;
  quantityUnits: number;
}) {
  const totalCostInr = round2(
    Number(sample.rawMaterialCostInr || 0) +
      Number(sample.vialCostInr || 0) +
      Number(sample.labelCostInr || 0) +
      Number(sample.packagingCostInr || 0) +
      Number(sample.shippingCostInr || 0) +
      Number(sample.handlingCostInr || 0)
  );
  const units = Math.max(1, Number(sample.quantityUnits || 1));
  const costPerSampleInr = round2(totalCostInr / units);
  return { totalCostInr, costPerSampleInr };
}

// ============================================================================
// IDEMPOTENT SAMPLING, CHECKLIST & QC SEEDING
// ============================================================================

let sqSeedPromise: Promise<void> | null = null;

export async function ensureSamplingQcSeeded(): Promise<void> {
  await ensureErpSeeded();
  if (sqSeedPromise) return sqSeedPromise;

  sqSeedPromise = (async () => {
    try {
      // 1. Seed Configurable QC Checklists
      const existingChecklists = await db.select().from(erpQcChecklists);
      if (!existingChecklists.length) {
        await db
          .insert(erpQcChecklists)
          .values([
            {
              id: 'qchk-sample-01',
              organizationId: ORG_ID,
              checklistCode: 'QCHK-SMP-2026',
              name: 'Sample Evaluation & Stability Protocol (Mild Gold Standard)',
              inspectionType: 'SAMPLE_EVALUATION',
              criteria: [
                {
                  criterionId: 'crit-app',
                  parameter: 'Visual Appearance & Clarity',
                  testMethod: 'Visual light-box turbidity scan (20°C & 4°C)',
                  expectedSpec: 'Clear, homogeneous, zero sediment or wax precipitation',
                  isCritical: true
                },
                {
                  criterionId: 'crit-col',
                  parameter: 'Juice Colour Grade',
                  testMethod: 'Visual Tint & Lovibond Reference',
                  expectedSpec: 'Mild gold pale amber tint within brand standard',
                  isCritical: true
                },
                {
                  criterionId: 'crit-odour',
                  parameter: 'Olfactory Profile vs Master Standard',
                  testMethod: 'Blind blotter dry-down at 15m, 2h, 6h',
                  expectedSpec: 'Conforms to master top/heart/base pyramid',
                  isCritical: true
                },
                {
                  criterionId: 'crit-fill',
                  parameter: 'Fill Volume Accuracy (±3%)',
                  testMethod: 'Gravimetric fill check using validated density',
                  acceptanceMin: 97,
                  acceptanceMax: 103,
                  expectedSpec: '97% – 103% of nominal vial/bottle volume',
                  unit: '% of nominal',
                  isCritical: true
                },
                {
                  criterionId: 'crit-pkg',
                  parameter: 'Crimping, Atomizer & Label Verification',
                  testMethod: 'Leak-vacuum & mist plume inspection',
                  expectedSpec: 'Zero micro-leakage, clean batch/sample label legibility',
                  isCritical: false
                }
              ],
              isActive: true,
              createdByEmail: 'qc@fragmore.shop'
            },
            {
              id: 'qchk-batch-01',
              organizationId: ORG_ID,
              checklistCode: 'QCHK-BAT-2026',
              name: 'Finished Extrait Batch Release COA Protocol',
              inspectionType: 'FINISHED_BATCH_RELEASE',
              criteria: [
                {
                  criterionId: 'crit-gcms',
                  parameter: 'GC-MS Chromatogram Fingerprint Match',
                  testMethod: 'Agilent GC-MS Capillary Column Comparison',
                  acceptanceMin: 98.5,
                  acceptanceMax: 100,
                  expectedSpec: '>= 98.5% similarity index vs master archive',
                  unit: '%',
                  isCritical: true
                },
                {
                  criterionId: 'crit-abv',
                  parameter: 'Ethanol ABV Proof Concentration',
                  testMethod: 'Anton Paar Digital Hydrometer at 20°C',
                  acceptanceMin: 70,
                  acceptanceMax: 84,
                  expectedSpec: '70.0% – 84.0% ABV per concentration class',
                  unit: '%',
                  isCritical: true
                },
                {
                  criterionId: 'crit-sg',
                  parameter: 'Specific Gravity (20°C)',
                  testMethod: 'Oscillating U-Tube Density Meter',
                  acceptanceMin: 0.82,
                  acceptanceMax: 0.885,
                  expectedSpec: '0.820 – 0.885 g/mL',
                  unit: 'g/mL',
                  isCritical: true
                },
                {
                  criterionId: 'crit-micro',
                  parameter: 'Microbiological Total Aerobic Count',
                  testMethod: 'USP <61> Membrane Filtration',
                  expectedSpec: '< 100 CFU/g, zero Pseudomonas/Staph',
                  isCritical: true
                }
              ],
              isActive: true,
              createdByEmail: 'qc@fragmore.shop'
            },
            {
              id: 'qchk-rm-01',
              organizationId: ORG_ID,
              checklistCode: 'QCHK-RM-2026',
              name: 'Incoming Fragrance Oil & Solvent Acceptance Checklist',
              inspectionType: 'RAW_MATERIAL_INWARD',
              criteria: [
                {
                  criterionId: 'crit-ri',
                  parameter: 'Refractive Index at 20°C',
                  testMethod: 'Abbe Refractometer',
                  acceptanceMin: 1.355,
                  acceptanceMax: 1.54,
                  expectedSpec: 'Within +/- 0.005 of Supplier CoA',
                  unit: 'nD20',
                  isCritical: true
                },
                {
                  criterionId: 'crit-coa',
                  parameter: 'Supplier COA & IFRA Allergen Sheet Attached',
                  testMethod: 'Document audit',
                  expectedSpec: 'Signed lot CoA & allergen breakdown present',
                  isCritical: true
                }
              ],
              isActive: true,
              createdByEmail: 'qc@fragmore.shop'
            }
          ])
          .onConflictDoNothing();
      }

      // 2. Ensure Master Seeded Formulations Have Explicit Documented Evidence Refs (not empty-compliant)
      const masterSeedVers = ['fver-frm-golden-hour-v2', 'fver-frm-oblique-woods-v1', 'fver-frm-velvet-nocturne-v1'];
      for (const vid of masterSeedVers) {
        await db
          .update(erpFormulationVersions)
          .set({
            safetyStatus: 'SAFETY_VERIFIED',
            regulatoryAuthorizationBy: 'qc@fragmore.shop',
            regulatoryAuthorizedAt: new Date(),
            supportingEvidenceRef: 'QC-FRG-2026-1001 · External IFRA 51st Amendment Dossier',
            ifraDossierRef: `IFRA-51-CERT-${vid.toUpperCase()}`,
            complianceNotes: 'Verified against IFRA 51st Amendment Cat-4 dermal limits with GC-MS archive.'
          })
          .where(and(eq(erpFormulationVersions.id, vid), sql`regulatory_authorization_by IS NULL`));
      }

      // 3. Backfill / Seed Rich Samples Across All Key Purposes & Stages
      // Update legacy smp-001 and smp-002 cleanly if they are still on default workflowStage
      await db
        .update(erpSamples)
        .set({
          purpose: 'INTERNAL_QC',
          workflowStage: 'APPROVED_FOR_DISPATCH',
          recipientType: 'INTERNAL',
          quantityUnits: 5,
          preparerEmail: 'perfumer@fragmore.shop',
          preparationDate: addDaysIso(-12),
          approvedByEmail: 'aibrandorigin@gmail.com',
          approvedAt: new Date(Date.now() - 10 * 86400000),
          feedbackStatus: 'RECEIVED_POSITIVE',
          feedbackSummary: 'Zero precipitation after 72h freeze-thaw cycle; clear mild gold colour confirmed.',
          rawMaterialLotRefs: [
            {
              materialId: 'mat-conc-gold',
              materialCode: 'MAT-CONC-001',
              materialName: 'Golden Hour Extrait Compound',
              lotNumber: 'LOT-CONC-2026-01',
              qtyIssued: 0.021,
              uom: 'kg',
              unitCostInr: 11800,
              lineCostInr: 247.8,
              componentRole: 'CONCENTRATE'
            },
            {
              materialId: 'mat-solv-eth',
              materialCode: 'MAT-SOLV-001',
              materialName: 'Organic Denatured Perfumery Ethanol (99.9%)',
              lotNumber: 'LOT-ETH-2026-01',
              qtyIssued: 0.054,
              uom: 'kg',
              unitCostInr: 320,
              lineCostInr: 17.28,
              componentRole: 'SOLVENT'
            }
          ],
          rawMaterialCostInr: 265.08,
          vialCostInr: 185,
          labelCostInr: 45,
          packagingCostInr: 120,
          shippingCostInr: 0,
          handlingCostInr: 50,
          totalCostInr: 665.08,
          costPerSampleInr: 133.02,
          materialIssued: true,
          stageHistory: [
            { stage: 'REQUESTED', action: 'Sample requested for freeze-thaw stability QC', actorEmail: 'perfumer@fragmore.shop', timestamp: addDaysIso(-14) },
            { stage: 'MATERIAL_ISSUED', action: 'Issued concentrate & ethanol lots', actorEmail: 'ops@fragmore.shop', timestamp: addDaysIso(-13) },
            { stage: 'TESTING', action: 'QC-FRG-2026-1001 PASSED', actorEmail: 'qc@fragmore.shop', timestamp: addDaysIso(-10) },
            { stage: 'APPROVED_FOR_DISPATCH', action: 'QC verified', actorEmail: 'qc@fragmore.shop', timestamp: addDaysIso(-10) }
          ]
        })
        .where(and(eq(erpSamples.id, 'smp-001'), eq(erpSamples.workflowStage, 'REQUESTED')));

      await db
        .update(erpSamples)
        .set({
          purpose: 'CORPORATE_PROPOSAL',
          workflowStage: 'DISPATCHED',
          recipientType: 'CORPORATE',
          recipientCompany: 'Taj Falaknuma Hospitality Group',
          recipientPhone: '+91 98201 44120',
          recipientAddress: 'Engine Bowli, Falaknuma, Hyderabad, Telangana 500053',
          quantityUnits: 4,
          preparerEmail: 'perfumer@fragmore.shop',
          preparationDate: addDaysIso(-6),
          approvedByEmail: 'aibrandorigin@gmail.com',
          approvedAt: new Date(Date.now() - 5 * 86400000),
          dispatchDate: addDaysIso(-4),
          courierName: 'BlueDart Luxury Air',
          trackingNumber: 'BD-HYD-8841209',
          followUpDate: addDaysIso(2),
          feedbackStatus: 'PENDING',
          leadId: 'lead-taj-01',
          rawMaterialLotRefs: [
            {
              materialId: 'mat-conc-oblique',
              materialCode: 'MAT-CONC-002',
              materialName: 'Oblique Woods Botanical Accord',
              lotNumber: 'LOT-CONC-2026-02',
              qtyIssued: 0.014,
              uom: 'kg',
              unitCostInr: 12400,
              lineCostInr: 173.6,
              componentRole: 'CONCENTRATE'
            }
          ],
          rawMaterialCostInr: 192,
          vialCostInr: 160,
          labelCostInr: 60,
          packagingCostInr: 280,
          shippingCostInr: 320,
          handlingCostInr: 90,
          totalCostInr: 1102,
          costPerSampleInr: 275.5,
          materialIssued: true,
          stageHistory: [
            { stage: 'REQUESTED', action: 'Corporate proposal sample kit requested', actorEmail: 'sales@fragmore.shop', timestamp: addDaysIso(-7) },
            { stage: 'DISPATCHED', action: 'Shipped via BlueDart Luxury Air (BD-HYD-8841209)', actorEmail: 'ops@fragmore.shop', timestamp: addDaysIso(-4) }
          ]
        })
        .where(and(eq(erpSamples.id, 'smp-002'), eq(erpSamples.workflowStage, 'REQUESTED')));

      // Seed Influencer Seeding, Retailer Testing & Perfume Bar Demo samples if not present
      const existingById = await db.select({ id: erpSamples.id }).from(erpSamples);
      const idSet = new Set(existingById.map((r) => r.id));

      const extraSamples: any[] = [];
      if (!idSet.has('smp-003')) {
        extraSamples.push({
          id: 'smp-003',
          organizationId: ORG_ID,
          formulationId: 'frm-velvet-nocturne',
          formulationVersionId: 'fver-frm-velvet-nocturne-v1',
          sampleNumber: 'SMP-FRG-2026-1003',
          sampleType: 'INFLUENCER_SEEDING',
          purpose: 'INFLUENCER_SEEDING',
          workflowStage: 'DISPATCHED',
          fragranceName: 'VELVET NOCTURNE (Creator Seeding Kit)',
          quantityUnits: 3,
          volumeMl: 15,
          preparerEmail: 'perfumer@fragmore.shop',
          preparationDate: addDaysIso(-5),
          approvedByEmail: 'aibrandorigin@gmail.com',
          approvedAt: new Date(Date.now() - 4 * 86400000),
          recipientType: 'INFLUENCER',
          recipientName: 'Aarohi Kapoor (@aarohiscents)',
          recipientCompany: 'Creator Studio Mumbai',
          recipientEmail: 'aarohi@scentatelier.in',
          recipientPhone: '+91 98211 77400',
          recipientAddress: 'Pali Hill, Bandra West, Mumbai 400050',
          dispatchDate: addDaysIso(-3),
          courierName: 'Delhivery Express Same-Day',
          trackingNumber: 'DLV-BOM-491022',
          followUpDate: addDaysIso(4),
          olfactoryScore: 9.5,
          longevityHours: 12.0,
          evaluationNotes: 'Sent alongside Velvet Nocturne monsoon reel brief.',
          feedbackStatus: 'RECEIVED_POSITIVE',
          feedbackSummary: 'Creator confirmed dry-down projection matches dark luxury storyboard.',
          marketingBriefId: 'mkt-ws-01',
          rawMaterialCostInr: 285,
          vialCostInr: 210,
          labelCostInr: 75,
          packagingCostInr: 340,
          shippingCostInr: 180,
          handlingCostInr: 75,
          totalCostInr: 1165,
          costPerSampleInr: 388.33,
          materialIssued: true,
          requestedByEmail: 'growth@fragmore.shop',
          status: 'DISPATCHED',
          stageHistory: [
            { stage: 'REQUESTED', action: 'Influencer creator seeding requested for MKT-2026-1001', actorEmail: 'growth@fragmore.shop', timestamp: addDaysIso(-6) },
            { stage: 'APPROVED_FOR_DISPATCH', action: 'QC verified mild gold batch alignment', actorEmail: 'qc@fragmore.shop', timestamp: addDaysIso(-4) },
            { stage: 'DISPATCHED', action: 'Dispatched Delhivery Express DLV-BOM-491022', actorEmail: 'ops@fragmore.shop', timestamp: addDaysIso(-3) }
          ]
        });
      }

      if (!idSet.has('smp-004')) {
        extraSamples.push({
          id: 'smp-004',
          organizationId: ORG_ID,
          formulationId: 'frm-golden-hour',
          formulationVersionId: 'fver-frm-golden-hour-v2',
          sampleNumber: 'SMP-FRG-2026-1004',
          sampleType: 'RETAILER_TESTING',
          purpose: 'RETAILER_TESTING',
          workflowStage: 'FEEDBACK',
          fragranceName: 'GOLDEN HOUR (Boutique Tester Trio)',
          quantityUnits: 6,
          volumeMl: 15,
          preparerEmail: 'perfumer@fragmore.shop',
          preparationDate: addDaysIso(-11),
          approvedByEmail: 'aibrandorigin@gmail.com',
          approvedAt: new Date(Date.now() - 10 * 86400000),
          recipientType: 'RETAILER',
          recipientName: 'Nandini Verma (Meridian Concept Store)',
          recipientCompany: 'Meridian Capital & Retail Collective',
          recipientEmail: 'nandini.verma@meridiancap.in',
          recipientPhone: '+91 98190 33110',
          recipientAddress: 'Kala Ghoda Fort, Mumbai 400001',
          dispatchDate: addDaysIso(-9),
          courierName: 'Atelier White-Glove Courier',
          trackingNumber: 'AWG-MUM-1094',
          followUpDate: addDaysIso(-1),
          olfactoryScore: 9.7,
          longevityHours: 11.5,
          evaluationNotes: '3-unit boutique shelf tester set for Meridian Luxury Edit.',
          feedbackStatus: 'CONVERTED',
          feedbackSummary: 'Retailer confirmed initial 60-bottle placement commitment.',
          leadId: 'lead-deloitte-02',
          conversionValueInr: 285000,
          rawMaterialCostInr: 490,
          vialCostInr: 360,
          labelCostInr: 120,
          packagingCostInr: 450,
          shippingCostInr: 250,
          handlingCostInr: 100,
          totalCostInr: 1770,
          costPerSampleInr: 295,
          materialIssued: true,
          requestedByEmail: 'sales@fragmore.shop',
          status: 'FEEDBACK',
          stageHistory: [
            { stage: 'REQUESTED', action: 'Retailer tester kit requested for CRM lead', actorEmail: 'sales@fragmore.shop', timestamp: addDaysIso(-12) },
            { stage: 'DISPATCHED', action: 'Hand-delivered via AWG-MUM-1094', actorEmail: 'sales@fragmore.shop', timestamp: addDaysIso(-9) },
            { stage: 'FEEDBACK', action: 'Converted to ₹2,85,000 boutique order commitment', actorEmail: 'sales@fragmore.shop', timestamp: addDaysIso(-2) }
          ]
        });
      }

      if (!idSet.has('smp-005')) {
        extraSamples.push({
          id: 'smp-005',
          organizationId: ORG_ID,
          formulationId: 'frm-oblique-woods',
          formulationVersionId: 'fver-frm-oblique-woods-v1',
          sampleNumber: 'SMP-FRG-2026-1005',
          sampleType: 'PERFUME_BAR_DEMO',
          purpose: 'PERFUME_BAR_DEMO',
          workflowStage: 'TESTING',
          fragranceName: 'OBLIQUE WOODS · Live Perfume Bar Concentrates',
          quantityUnits: 8,
          volumeMl: 30,
          preparerEmail: 'perfumer@fragmore.shop',
          preparationDate: addDaysIso(-2),
          approvedByEmail: 'perfumer@fragmore.shop',
          approvedAt: new Date(Date.now() - 2 * 86400000),
          recipientType: 'PERFUME_BAR',
          recipientName: 'FRAGMORÉ Pop-Up Perfume Bar — Jio World Drive',
          recipientCompany: 'FRAGMORÉ Brand Experience',
          recipientEmail: 'concierge@fragmore.shop',
          olfactoryScore: 9.4,
          longevityHours: 13.0,
          evaluationNotes: 'Demonstration decanters awaiting final mild gold tint & atomizer spray QC.',
          feedbackStatus: 'PENDING',
          rawMaterialCostInr: 920,
          vialCostInr: 560,
          labelCostInr: 160,
          packagingCostInr: 320,
          shippingCostInr: 0,
          handlingCostInr: 120,
          totalCostInr: 2080,
          costPerSampleInr: 260,
          materialIssued: true,
          requestedByEmail: 'growth@fragmore.shop',
          status: 'TESTING',
          stageHistory: [
            { stage: 'REQUESTED', action: 'Perfume Bar demonstration flasks requested', actorEmail: 'growth@fragmore.shop', timestamp: addDaysIso(-3) },
            { stage: 'TESTING', action: 'Submitted to QC Lab for atomizer & mild gold tint check', actorEmail: 'perfumer@fragmore.shop', timestamp: addDaysIso(-1) }
          ]
        });
      }

      if (extraSamples.length) {
        for (const s of extraSamples) {
          await db.insert(erpSamples).values(s).onConflictDoNothing();
        }
      }

      // 4. Seed Linked QC Retest & CAPA History
      const existingQcRows = await db.select({ id: erpQcRecords.id }).from(erpQcRecords);
      const qcIds = new Set(existingQcRows.map((q) => q.id));

      // Update qc-001 with certificate & detailed fields if needed
      await db
        .update(erpQcRecords)
        .set({
          sampleId: 'smp-001',
          checklistId: 'qchk-batch-01',
          checklistName: 'Finished Extrait Batch Release COA Protocol',
          appearanceResult: 'CLEAR_HOMOGENEOUS',
          odourResult: 'CONFORMS_TO_MASTER',
          colourResult: 'MILD_GOLD_CLEAR',
          targetFillVolumeMl: 50,
          actualFillVolumeMl: 50.2,
          packagingInspectionResult: 'PASS',
          stabilityObservations: 'Passed 72h 4°C/-4°C chill cycle and UV amber check with zero haze.',
          supportingEvidenceRef: 'GCMS-LOG-2026-GH02 · UV-CELL-88',
          certificateNumber: 'COA-FRG-2026-1001',
          certificateIssuedAt: new Date(Date.now() - 10 * 86400000),
          approvalHistory: [
            { decision: 'PASSED', actorEmail: 'qc@fragmore.shop', timestamp: addDaysIso(-10), notes: 'Master release approved; COA issued.' }
          ]
        })
        .where(and(eq(erpQcRecords.id, 'qc-001'), sql`certificate_number IS NULL`));

      if (!qcIds.has('qc-002')) {
        await db
          .insert(erpQcRecords)
          .values({
            id: 'qc-002',
            organizationId: ORG_ID,
            qcNumber: 'QC-FRG-2026-1002',
            inspectionType: 'SAMPLE_EVALUATION',
            sampleId: 'smp-005',
            subjectName: 'OBLIQUE WOODS Perfume Bar Trial #1 (Cloudy Chill Run)',
            checklistId: 'qchk-sample-01',
            checklistName: 'Sample Evaluation & Stability Protocol (Mild Gold Standard)',
            checklistResults: [
              { criterionId: 'crit-app', parameter: 'Visual Appearance & Clarity', targetSpec: 'Clear, zero sediment', measuredValue: 'Slight chill haze at 4°C', isCritical: true, passed: false },
              { criterionId: 'crit-col', parameter: 'Juice Colour Grade', targetSpec: 'Mild gold pale amber', measuredValue: 'Mild Gold', isCritical: true, passed: true },
              { criterionId: 'crit-fill', parameter: 'Fill Volume Accuracy (±3%)', targetSpec: '97–103%', measuredValue: '99.4%', isCritical: true, passed: true }
            ],
            abvTestedPct: 76.2,
            specificGravity: 0.851,
            refractiveIndex: 1.371,
            gcmsMatchPct: 98.9,
            appearanceResult: 'SLIGHT_CHILL_HAZE',
            odourResult: 'CONFORMS_TO_MASTER',
            colourResult: 'MILD_GOLD_SLIGHT_HAZE',
            targetFillVolumeMl: 30,
            actualFillVolumeMl: 29.8,
            packagingInspectionResult: 'PASS',
            stabilityObservations: 'Micro-terpene cloudiness observed below 6°C; requires 48h chill-filtration at -2°C.',
            clarityResult: 'SLIGHT_HAZE',
            olfactoryResult: 'CONFORMS',
            microbiologyPass: true,
            decision: 'FAILED',
            correctiveAction: 'Hold decanters and perform 1-micron cold-chill filtration at -2°C before retesting.',
            capaStatus: 'VERIFIED_CLOSED',
            retestCount: 1,
            supportingEvidenceRef: 'CHILL-FILTER-CAPA-1002',
            approvalHistory: [
              { decision: 'FAILED', actorEmail: 'qc@fragmore.shop', timestamp: addDaysIso(-2), notes: 'Rejected for chill haze; CAPA issued.' }
            ],
            inspectorEmail: 'qc@fragmore.shop',
            approvedByEmail: 'qc@fragmore.shop',
            approvedAt: new Date(Date.now() - 2 * 86400000),
            status: 'COMPLETED'
          })
          .onConflictDoNothing();
      }

      if (!qcIds.has('qc-003')) {
        await db
          .insert(erpQcRecords)
          .values({
            id: 'qc-003',
            organizationId: ORG_ID,
            qcNumber: 'QC-FRG-2026-1003',
            inspectionType: 'SAMPLE_EVALUATION',
            sampleId: 'smp-005',
            retestOfQcId: 'qc-002',
            retestCount: 1,
            subjectName: 'OBLIQUE WOODS Perfume Bar Trial #1 (Post Chill-Filtration Retest)',
            checklistId: 'qchk-sample-01',
            checklistName: 'Sample Evaluation & Stability Protocol (Mild Gold Standard)',
            checklistResults: [
              { criterionId: 'crit-app', parameter: 'Visual Appearance & Clarity', targetSpec: 'Clear, zero sediment', measuredValue: 'Crystal clear at 2°C', isCritical: true, passed: true },
              { criterionId: 'crit-col', parameter: 'Juice Colour Grade', targetSpec: 'Mild gold pale amber', measuredValue: 'Mild Gold Clear', isCritical: true, passed: true },
              { criterionId: 'crit-fill', parameter: 'Fill Volume Accuracy (±3%)', targetSpec: '97–103%', measuredValue: '100.3%', isCritical: true, passed: true }
            ],
            abvTestedPct: 76.4,
            specificGravity: 0.85,
            refractiveIndex: 1.371,
            gcmsMatchPct: 99.3,
            appearanceResult: 'CLEAR_HOMOGENEOUS',
            odourResult: 'CONFORMS_TO_MASTER',
            colourResult: 'MILD_GOLD_CLEAR',
            targetFillVolumeMl: 30,
            actualFillVolumeMl: 30.1,
            packagingInspectionResult: 'PASS',
            stabilityObservations: 'Post-filtration retest passed 24h at 2°C with zero haze.',
            clarityResult: 'CRYSTAL_CLEAR',
            olfactoryResult: 'CONFORMS',
            microbiologyPass: true,
            decision: 'PASSED',
            correctiveAction: 'CAPA chill-filtration verified effective.',
            capaStatus: 'VERIFIED_CLOSED',
            supportingEvidenceRef: 'RETEST-FILT-LOG-1003',
            certificateNumber: 'COA-FRG-2026-1003',
            certificateIssuedAt: new Date(Date.now() - 86400000),
            approvalHistory: [
              { decision: 'PASSED', actorEmail: 'qc@fragmore.shop', timestamp: addDaysIso(-1), notes: 'Retest verified & approved.' }
            ],
            inspectorEmail: 'qc@fragmore.shop',
            approvedByEmail: 'qc@fragmore.shop',
            approvedAt: new Date(Date.now() - 86400000),
            status: 'COMPLETED'
          })
          .onConflictDoNothing();
      }
    } catch (err) {
      sqSeedPromise = null;
      throw err;
    }
  })();

  return sqSeedPromise;
}

// ============================================================================
// CREATE SAMPLE REQUEST (8 PURPOSES, COSTING, CRM & MARKETING INTEGRATION)
// ============================================================================

export async function createSampleRequestTransaction(
  actor: ErpActorContext,
  payload: {
    purpose: string;
    formulationId?: string;
    formulationVersionId?: string;
    batchId?: string;
    parentSampleId?: string;
    fragranceName?: string;
    quantityUnits?: number;
    volumeMl?: number;
    preparationDate?: string;
    recipientType?: string;
    recipientName?: string;
    recipientCompany?: string;
    recipientEmail?: string;
    recipientPhone?: string;
    recipientAddress?: string;
    followUpDate?: string;
    leadId?: string;
    customerId?: string;
    marketingBriefId?: string;
    influencerDeliverableId?: string;
    rawMaterialLotRefs?: Array<{
      materialId?: string;
      materialCode?: string;
      materialName: string;
      lotId?: string;
      lotNumber?: string;
      qtyIssued: number;
      uom: string;
      unitCostInr?: number;
      componentRole?: string;
    }>;
    rawMaterialCostInr?: number;
    vialCostInr?: number;
    labelCostInr?: number;
    packagingCostInr?: number;
    shippingCostInr?: number;
    handlingCostInr?: number;
    evaluationNotes?: string;
  }
) {
  await ensureSamplingQcSeeded();

  const purposeObj = SAMPLE_PURPOSES.find((p) => p.code === payload.purpose);
  if (!purposeObj) {
    throw new ValidationError(
      `Invalid sample purpose "${payload.purpose}". Allowed: ${SAMPLE_PURPOSES.map((p) => p.code).join(', ')}`
    );
  }

  return await db.transaction(async (tx) => {
    let formula: any = null;
    let formulaVer: any = null;
    if (payload.formulationId) {
      const fRows = await tx.select().from(erpFormulations).where(eq(erpFormulations.id, payload.formulationId));
      formula = fRows[0] || null;
      if (!formula) throw new NotFoundError('Selected formulation not found.');
    }
    if (payload.formulationVersionId) {
      const vRows = await tx
        .select()
        .from(erpFormulationVersions)
        .where(eq(erpFormulationVersions.id, payload.formulationVersionId));
      formulaVer = vRows[0] || null;
    } else if (formula) {
      const vRows = await tx
        .select()
        .from(erpFormulationVersions)
        .where(eq(erpFormulationVersions.formulationId, formula.id))
        .orderBy(desc(erpFormulationVersions.versionNumber))
        .limit(1);
      formulaVer = vRows[0] || null;
    }

    const fragranceName = payload.fragranceName?.trim() || (formula ? `${formula.name} (R&D Sample)` : '');
    if (!fragranceName) {
      throw new ValidationError('Fragrance or sample title is required.');
    }

    const quantityUnits = Math.max(1, Math.round(Number(payload.quantityUnits || 1)));
    const volumeMl = Math.max(1, Math.round(Number(payload.volumeMl || 10)));

    let revisionNumber = 1;
    if (payload.parentSampleId) {
      const pRows = await tx.select().from(erpSamples).where(eq(erpSamples.id, payload.parentSampleId));
      if (pRows.length) {
        revisionNumber = Number(pRows[0].revisionNumber || 1) + 1;
      }
    }

    // Calculate estimated / planned cost breakdown if user hasn't overridden rawMaterialCostInr
    let rawMaterialCostInr = Number(payload.rawMaterialCostInr || 0);
    if (rawMaterialCostInr <= 0 && Array.isArray(payload.rawMaterialLotRefs) && payload.rawMaterialLotRefs.length) {
      rawMaterialCostInr = round2(
        payload.rawMaterialLotRefs.reduce(
          (s, r) => s + Number(r.qtyIssued || 0) * Number(r.unitCostInr || 0),
          0
        )
      );
    } else if (rawMaterialCostInr <= 0 && formulaVer) {
      // Formula costPerKgInr scaled to sample volume
      const litersTotal = (quantityUnits * volumeMl) / 1000;
      rawMaterialCostInr = round2(litersTotal * 0.85 * Number(formulaVer.costPerKgInr || 3200));
    }

    const vialCostInr = round2(payload.vialCostInr ?? quantityUnits * (volumeMl <= 5 ? 24 : volumeMl <= 15 ? 48 : 85));
    const labelCostInr = round2(payload.labelCostInr ?? quantityUnits * 15);
    const packagingCostInr = round2(
      payload.packagingCostInr ??
        (['INFLUENCER_SEEDING', 'RETAILER_TESTING', 'CORPORATE_PROPOSAL'].includes(purposeObj.code)
          ? quantityUnits * 80
          : quantityUnits * 20)
    );
    const shippingCostInr = round2(payload.shippingCostInr ?? 0);
    const handlingCostInr = round2(payload.handlingCostInr ?? 35);

    const { totalCostInr, costPerSampleInr } = recomputeSampleTotals({
      rawMaterialCostInr,
      vialCostInr,
      labelCostInr,
      packagingCostInr,
      shippingCostInr,
      handlingCostInr,
      quantityUnits
    });

    const sampleNumber = await getNextSequence(tx, 'SMP');
    const nowIso = new Date().toISOString();
    const initialHistory = [
      {
        stage: 'REQUESTED',
        action: `Sample request created (${purposeObj.label})`,
        actorEmail: actor.email,
        timestamp: nowIso,
        note: payload.evaluationNotes || undefined
      }
    ];

    const [created] = await tx
      .insert(erpSamples)
      .values({
        id: makeId('smp'),
        organizationId: ORG_ID,
        formulationId: formula?.id || null,
        formulationVersionId: formulaVer?.id || null,
        batchId: payload.batchId || null,
        sampleNumber,
        sampleType: purposeObj.code,
        purpose: purposeObj.code,
        workflowStage: 'REQUESTED',
        fragranceName,
        rawMaterialLotRefs: payload.rawMaterialLotRefs || [],
        preparationDate: payload.preparationDate || currentIsoDate(),
        quantityUnits,
        volumeMl,
        preparerEmail: actor.email,
        recipientType: payload.recipientType || purposeObj.defaultRecipientType,
        recipientName: payload.recipientName?.trim() || null,
        recipientCompany: payload.recipientCompany?.trim() || null,
        recipientEmail: payload.recipientEmail?.trim() || null,
        recipientPhone: payload.recipientPhone?.trim() || null,
        recipientAddress: payload.recipientAddress?.trim() || null,
        followUpDate: payload.followUpDate || addDaysIso(7),
        evaluationNotes: payload.evaluationNotes || null,
        feedbackStatus: 'PENDING',
        rawMaterialCostInr,
        vialCostInr,
        labelCostInr,
        packagingCostInr,
        shippingCostInr,
        handlingCostInr,
        totalCostInr,
        costPerSampleInr,
        leadId: payload.leadId || null,
        customerId: payload.customerId || null,
        marketingBriefId: payload.marketingBriefId || null,
        influencerDeliverableId: payload.influencerDeliverableId || null,
        parentSampleId: payload.parentSampleId || null,
        revisionNumber,
        materialIssued: false,
        stageHistory: initialHistory,
        requestedByEmail: actor.email,
        status: 'REQUESTED'
      })
      .returning();

    await tx.insert(erpSampleEvents).values({
      id: makeId('smpev'),
      organizationId: ORG_ID,
      sampleId: created.id,
      sampleNumber: created.sampleNumber,
      fromStage: null,
      toStage: 'REQUESTED',
      eventType: payload.parentSampleId ? 'REVISION' : 'STAGE_TRANSITION',
      summary: `Created ${sampleNumber} (${purposeObj.label}) — ${quantityUnits} × ${volumeMl}mL`,
      payload: { purpose: purposeObj.code, formulationId: formula?.id, versionNumber: formulaVer?.versionNumber, revisionNumber },
      performedByEmail: actor.email
    });

    await recordErpAuditLog(tx, {
      action: 'ERP_SAMPLE_REQUEST_CREATED',
      entity: 'erp_samples',
      entityId: created.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Requested ${sampleNumber} (${purposeObj.code}) · ${fragranceName} · Est ₹${totalCostInr}`
    });

    return created;
  });
}

// ============================================================================
// 8-STAGE SAMPLING WORKFLOW ENGINE (APPROVAL -> MATERIAL ISSUE -> PREP -> QC -> FEEDBACK -> DISPATCH/ARCHIVE)
// ============================================================================

export async function advanceSampleWorkflowTransaction(
  actor: ErpActorContext,
  payload: {
    sampleId: string;
    targetStage: SampleWorkflowStage;
    expectedVersion?: number;
    note?: string;
    // Material Issue payload
    materialIssues?: Array<{
      materialId: string;
      lotId?: string;
      qtyIssued: number;
      componentRole: 'CONCENTRATE' | 'SOLVENT' | 'VIAL' | 'LABEL' | 'PACKAGING' | 'OTHER';
    }>;
    // Prep payload
    preparationDate?: string;
    preparerEmail?: string;
    // Feedback payload
    olfactoryScore?: number;
    longevityHours?: number;
    feedbackStatus?: 'PENDING' | 'RECEIVED_POSITIVE' | 'REVISION_NEEDED' | 'CONVERTED' | 'NO_RESPONSE';
    feedbackSummary?: string;
    followUpDate?: string;
    // Revision creation
    createRevisionSample?: boolean;
    revisionNotes?: string;
    // Dispatch payload
    dispatchDate?: string;
    courierName?: string;
    trackingNumber?: string;
    recipientName?: string;
    recipientPhone?: string;
    recipientAddress?: string;
    shippingCostInr?: number;
    handlingCostInr?: number;
    vialCostInr?: number;
    labelCostInr?: number;
    packagingCostInr?: number;
    // Override QC note if shipping internal/raw mock sample
    overrideQcNote?: string;
  }
) {
  await ensureSamplingQcSeeded();
  if (!SAMPLE_WORKFLOW_STAGES.includes(payload.targetStage)) {
    throw new ValidationError(`Unsupported sample workflow stage "${payload.targetStage}".`);
  }

  return await db.transaction(async (tx) => {
    const existingRows = await tx.select().from(erpSamples).where(eq(erpSamples.id, payload.sampleId)).for('update');
    if (!existingRows.length) throw new NotFoundError('Sample record not found.');
    const sample = existingRows[0];

    if (payload.expectedVersion !== undefined && sample.version !== payload.expectedVersion) {
      throw new ConflictError('Sample record was updated by another user. Please refresh.');
    }

    const fromStage = sample.workflowStage;
    const nowIso = new Date().toISOString();
    const updates: Record<string, any> = {
      workflowStage: payload.targetStage,
      status: payload.targetStage,
      version: sql`${erpSamples.version} + 1`,
      updatedAt: new Date()
    };

    let eventType = 'STAGE_TRANSITION';
    let summary = `${sample.sampleNumber}: ${fromStage} → ${payload.targetStage}`;
    const issuedLotRefs: any[] = Array.isArray(sample.rawMaterialLotRefs) ? [...sample.rawMaterialLotRefs] : [];
    let spawnRevisionSample: any = null;

    // Stage 2: APPROVAL
    if (payload.targetStage === 'APPROVED') {
      if (!actor.isSuperAdmin && !actor.permissions.quality?.canApprove && actor.roleCode !== 'FORMULATOR' && actor.roleCode !== 'QC_ANALYST') {
        throw new ForbiddenError('Only Super Admin, Perfumer, or QC Approver can authorize sample requests.');
      }
      updates.approvedByEmail = actor.email;
      updates.approvedAt = new Date();
      summary = `${sample.sampleNumber} approved for material issue by ${actor.email}`;
    }

    // Stage 3: MATERIAL_ISSUE (FIFO Stock Lot Deduction + Immutable Stock Movement Ledger + Itemized Cost + Journal)
    if (payload.targetStage === 'MATERIAL_ISSUED') {
      if (sample.materialIssued) {
        throw new ValidationError('Materials have already been issued for this sample.');
      }

      const issuesToProcess = Array.isArray(payload.materialIssues) && payload.materialIssues.length ? payload.materialIssues : [];
      let rawMatCost = 0;
      let vialCost = Number(payload.vialCostInr ?? sample.vialCostInr ?? 0);
      let labelCost = Number(payload.labelCostInr ?? sample.labelCostInr ?? 0);
      let pkgCost = Number(payload.packagingCostInr ?? sample.packagingCostInr ?? 0);
      const processedRefs: any[] = [];

      for (const reqItem of issuesToProcess) {
        const qtyNeeded = Number(reqItem.qtyIssued || 0);
        if (qtyNeeded <= 0) continue;

        // Lock matching lots FIRST, then parent material (consistent lock order: erpStockLots -> erpMaterials)
        const candidateLots = reqItem.lotId
          ? await tx.select().from(erpStockLots).where(eq(erpStockLots.id, reqItem.lotId)).for('update')
          : await tx
              .select()
              .from(erpStockLots)
              .where(eq(erpStockLots.materialId, reqItem.materialId))
              .orderBy(asc(erpStockLots.receivedDate), asc(erpStockLots.id))
              .for('update');

        const matRows = await tx.select().from(erpMaterials).where(eq(erpMaterials.id, reqItem.materialId)).for('update');
        if (!matRows.length) throw new NotFoundError(`Material ${reqItem.materialId} not found.`);
        const mat = matRows[0];

        let remainingToIssue = round4(qtyNeeded);
        let matLineCost = 0;
        let runningMatStock = Number(mat.currentStock || 0);

        for (const lot of candidateLots) {
          if (remainingToIssue <= 0) break;
          const avail = Number(lot.availableQty || 0);
          if (avail <= 0) continue;

          const take = round4(Math.min(avail, remainingToIssue));
          const unitCost = Number(lot.unitCostInr || mat.unitCostInr || 0);
          const lineCost = round2(take * unitCost);
          matLineCost = round2(matLineCost + lineCost);

          const nextLotAvail = round4(avail - take);
          const nextLotConsumed = round4(Number(lot.consumedQty || 0) + take);
          await tx
            .update(erpStockLots)
            .set({
              availableQty: nextLotAvail,
              consumedQty: nextLotConsumed,
              status: nextLotAvail <= 0 ? 'DEPLETED' : 'ACTIVE',
              version: sql`${erpStockLots.version} + 1`,
              updatedAt: new Date()
            })
            .where(eq(erpStockLots.id, lot.id));

          const beforeStock = runningMatStock;
          runningMatStock = round4(Math.max(0, runningMatStock - take));
          await tx
            .update(erpMaterials)
            .set({
              currentStock: runningMatStock,
              status: runningMatStock <= Number(mat.reorderLevel || 0) ? 'LOW_STOCK' : 'OPTIMAL',
              version: sql`${erpMaterials.version} + 1`,
              updatedAt: new Date()
            })
            .where(eq(erpMaterials.id, mat.id));

          await appendStockMovementTx(tx, {
            stockCategory: 'SAMPLE',
            movementType: 'SAMPLE_ISSUE',
            materialId: mat.id,
            materialCode: mat.code,
            materialName: mat.name,
            lotId: lot.id,
            lotNumber: lot.lotNumber,
            warehouseId: lot.warehouseId,
            warehouseLocation: lot.warehouseLocation || null,
            qtyDelta: -take,
            uom: mat.uom,
            balanceBefore: beforeStock,
            balanceAfter: runningMatStock,
            unitCostInr: unitCost,
            densityUsedGPerMl: mat.densityGPerMl ?? null,
            referenceType: 'SAMPLE',
            referenceId: sample.id,
            reason: `Sample Material Issue for ${sample.sampleNumber} (${sample.purpose})`,
            performedByEmail: actor.email,
            idempotencyKey: `smp-iss-${sample.id}-${lot.id}-${take}`
          });

          processedRefs.push({
            materialId: mat.id,
            materialCode: mat.code,
            materialName: mat.name,
            lotId: lot.id,
            lotNumber: lot.lotNumber,
            qtyIssued: take,
            uom: mat.uom,
            unitCostInr: unitCost,
            lineCostInr: lineCost,
            componentRole: reqItem.componentRole || 'OTHER'
          });

          mat.currentStock = runningMatStock;
          remainingToIssue = round4(remainingToIssue - take);
        }

        if (remainingToIssue > 0.0001) {
          throw new ValidationError(
            `Insufficient stock lot balance for "${mat.name}": short by ${remainingToIssue} ${mat.uom}.`
          );
        }

        if (reqItem.componentRole === 'VIAL') {
          vialCost = round2(vialCost + matLineCost);
        } else if (reqItem.componentRole === 'LABEL') {
          labelCost = round2(labelCost + matLineCost);
        } else if (reqItem.componentRole === 'PACKAGING') {
          pkgCost = round2(pkgCost + matLineCost);
        } else {
          rawMatCost = round2(rawMatCost + matLineCost);
        }
      }

      if (processedRefs.length) {
        updates.rawMaterialLotRefs = [...issuedLotRefs, ...processedRefs];
        if (rawMatCost > 0) updates.rawMaterialCostInr = rawMatCost;
        updates.vialCostInr = vialCost;
        updates.labelCostInr = labelCost;
        updates.packagingCostInr = pkgCost;
      }

      updates.materialIssued = true;
      eventType = 'MATERIAL_ISSUE';

      const finalRaw = Number(updates.rawMaterialCostInr ?? sample.rawMaterialCostInr ?? 0);
      const finalVial = Number(updates.vialCostInr ?? sample.vialCostInr ?? 0);
      const finalLabel = Number(updates.labelCostInr ?? sample.labelCostInr ?? 0);
      const finalPkg = Number(updates.packagingCostInr ?? sample.packagingCostInr ?? 0);
      const totalIssuedCost = round2(finalRaw + finalVial + finalLabel + finalPkg);

      const totals = recomputeSampleTotals({
        rawMaterialCostInr: finalRaw,
        vialCostInr: finalVial,
        labelCostInr: finalLabel,
        packagingCostInr: finalPkg,
        shippingCostInr: Number(sample.shippingCostInr || 0),
        handlingCostInr: Number(sample.handlingCostInr || 0),
        quantityUnits: Number(sample.quantityUnits || 1)
      });
      updates.totalCostInr = totals.totalCostInr;
      updates.costPerSampleInr = totals.costPerSampleInr;

      // Post balanced R&D / Sampling Material Absorption Journal if actual lot deduction > 0
      if (processedRefs.length && totalIssuedCost > 0) {
        const jrnNum = await getNextSequence(tx, 'JRN');
        const expenseAcct =
          sample.purpose === 'INFLUENCER_SEEDING'
            ? { code: '5210', name: 'Influencer Seeding & Creator Marketing Expense' }
            : { code: '5140', name: 'R&D Sampling & Trial Material Expense' };

        await tx.insert(erpAccountingJournals).values({
          id: makeId('jrn'),
          organizationId: ORG_ID,
          journalNumber: jrnNum,
          entryDate: currentIsoDate(),
          fiscalPeriod: getFiscalPeriod(),
          sourceModule: 'SAMPLING_RD',
          sourceEntityId: sample.id,
          narration: `Sample material issue absorption for ${sample.sampleNumber} (${sample.purpose})`,
          lines: [
            {
              accountCode: expenseAcct.code,
              accountName: expenseAcct.name,
              accountType: 'EXPENSE',
              debitInr: totalIssuedCost,
              creditInr: 0,
              costCenter: sample.purpose === 'INFLUENCER_SEEDING' ? 'CC-MKT' : 'CC-RD'
            },
            {
              accountCode: '1200',
              accountName: 'Raw Materials & Flacon Inventory',
              accountType: 'ASSET',
              debitInr: 0,
              creditInr: totalIssuedCost,
              costCenter: 'CC-220'
            }
          ],
          totalDebitInr: totalIssuedCost,
          totalCreditInr: totalIssuedCost,
          isBalanced: true,
          postedByEmail: actor.email,
          status: 'POSTED'
        });
      }

      summary = processedRefs.length
        ? `Issued ${processedRefs.length} stock lot allocations for ${sample.sampleNumber} (₹${totalIssuedCost})`
        : `Marked material issue verified for ${sample.sampleNumber}`;
    }

    // Stage 4: PREPARED
    if (payload.targetStage === 'PREPARED') {
      updates.preparationDate = payload.preparationDate || sample.preparationDate || currentIsoDate();
      updates.preparerEmail = payload.preparerEmail || actor.email;
      summary = `${sample.sampleNumber} compounded & filled by ${updates.preparerEmail}`;
    }

    // Stage 5: TESTING
    if (payload.targetStage === 'TESTING') {
      summary = `${sample.sampleNumber} queued into QC laboratory testing`;
    }

    // Stage 6: FEEDBACK
    if (payload.targetStage === 'FEEDBACK') {
      if (payload.olfactoryScore !== undefined) updates.olfactoryScore = Number(payload.olfactoryScore);
      if (payload.longevityHours !== undefined) updates.longevityHours = Number(payload.longevityHours);
      updates.feedbackStatus = payload.feedbackStatus || 'RECEIVED_POSITIVE';
      if (payload.feedbackSummary) updates.feedbackSummary = payload.feedbackSummary;
      if (payload.followUpDate) updates.followUpDate = payload.followUpDate;
      updates.feedbackReceivedAt = new Date();
      eventType = 'FEEDBACK';
      summary = `Feedback recorded (${updates.feedbackStatus}): ${payload.feedbackSummary || payload.note || 'Logged evaluator score'}`;
    }

    // Stage 7A: REVISION_REQUIRED (Optionally clones into child revision sample)
    if (payload.targetStage === 'REVISION_REQUIRED') {
      updates.feedbackStatus = 'REVISION_NEEDED';
      if (payload.feedbackSummary) updates.feedbackSummary = payload.feedbackSummary;
      eventType = 'REVISION';
      summary = `Revision flagged for ${sample.sampleNumber}: ${payload.revisionNotes || payload.note || 'Formula adjustment requested'}`;

      if (payload.createRevisionSample) {
        const nextSampleNum = await getNextSequence(tx, 'SMP');
        const nextRev = Number(sample.revisionNumber || 1) + 1;
        const [revSample] = await tx
          .insert(erpSamples)
          .values({
            id: makeId('smp'),
            organizationId: ORG_ID,
            formulationId: sample.formulationId,
            formulationVersionId: sample.formulationVersionId,
            sampleNumber: nextSampleNum,
            sampleType: 'FORMULA_REVISION',
            purpose: 'FORMULA_REVISION',
            workflowStage: 'REQUESTED',
            fragranceName: `${sample.fragranceName} (Rev ${nextRev})`,
            quantityUnits: sample.quantityUnits,
            volumeMl: sample.volumeMl,
            preparerEmail: actor.email,
            preparationDate: currentIsoDate(),
            recipientType: sample.recipientType,
            recipientName: sample.recipientName,
            recipientCompany: sample.recipientCompany,
            recipientEmail: sample.recipientEmail,
            recipientPhone: sample.recipientPhone,
            recipientAddress: sample.recipientAddress,
            leadId: sample.leadId,
            marketingBriefId: sample.marketingBriefId,
            influencerDeliverableId: sample.influencerDeliverableId,
            parentSampleId: sample.id,
            revisionNumber: nextRev,
            evaluationNotes: payload.revisionNotes || payload.note || `Revision of ${sample.sampleNumber}`,
            feedbackStatus: 'PENDING',
            requestedByEmail: actor.email,
            status: 'REQUESTED',
            stageHistory: [
              {
                stage: 'REQUESTED',
                action: `Spawned Revision #${nextRev} from ${sample.sampleNumber}`,
                actorEmail: actor.email,
                timestamp: nowIso
              }
            ]
          })
          .returning();

        spawnRevisionSample = revSample;
        await tx.insert(erpSampleEvents).values({
          id: makeId('smpev'),
          organizationId: ORG_ID,
          sampleId: revSample.id,
          sampleNumber: revSample.sampleNumber,
          fromStage: null,
          toStage: 'REQUESTED',
          eventType: 'REVISION',
          summary: `Revision ${nextRev} created from ${sample.sampleNumber}`,
          payload: { parentSampleId: sample.id },
          performedByEmail: actor.email
        });
      }
    }

    // Stage 7B: APPROVED_FOR_DISPATCH
    if (payload.targetStage === 'APPROVED_FOR_DISPATCH') {
      const linkedQcs = await tx.select().from(erpQcRecords).where(eq(erpQcRecords.sampleId, sample.id));
      const hasPassedQc = linkedQcs.some((q) => q.decision === 'PASSED');
      if (!hasPassedQc && !payload.overrideQcNote?.trim()) {
        throw new ValidationError(
          'Cannot approve sample for dispatch without a PASSED QC record linked to this sample (or provide a documented supervisor QC waiver note).'
        );
      }
      if (!sample.approvedByEmail) updates.approvedByEmail = actor.email;
      if (!sample.approvedAt) updates.approvedAt = new Date();
      summary = hasPassedQc
        ? `${sample.sampleNumber} cleared for dispatch after verified PASSED QC`
        : `${sample.sampleNumber} cleared for internal/demo dispatch with documented note: ${payload.overrideQcNote}`;
    }

    // Stage 8A: DISPATCHED (Courier Tracking + Costing + CRM & Marketing Sync + Shipping Journal)
    if (payload.targetStage === 'DISPATCHED') {
      updates.dispatchDate = payload.dispatchDate || currentIsoDate();
      updates.courierName = payload.courierName?.trim() || sample.courierName || 'BlueDart Priority';
      updates.trackingNumber = payload.trackingNumber?.trim() || sample.trackingNumber || `TRK-${Date.now().toString().slice(-7)}`;
      if (payload.recipientName) updates.recipientName = payload.recipientName.trim();
      if (payload.recipientPhone) updates.recipientPhone = payload.recipientPhone.trim();
      if (payload.recipientAddress) updates.recipientAddress = payload.recipientAddress.trim();
      updates.followUpDate = payload.followUpDate || sample.followUpDate || addDaysIso(7);

      const newShipping = Number(payload.shippingCostInr ?? sample.shippingCostInr ?? 0);
      const newHandling = Number(payload.handlingCostInr ?? sample.handlingCostInr ?? 0);
      updates.shippingCostInr = round2(newShipping);
      updates.handlingCostInr = round2(newHandling);

      const totals = recomputeSampleTotals({
        rawMaterialCostInr: Number(sample.rawMaterialCostInr || 0),
        vialCostInr: Number(payload.vialCostInr ?? sample.vialCostInr ?? 0),
        labelCostInr: Number(payload.labelCostInr ?? sample.labelCostInr ?? 0),
        packagingCostInr: Number(payload.packagingCostInr ?? sample.packagingCostInr ?? 0),
        shippingCostInr: newShipping,
        handlingCostInr: newHandling,
        quantityUnits: Number(sample.quantityUnits || 1)
      });
      updates.totalCostInr = totals.totalCostInr;
      updates.costPerSampleInr = totals.costPerSampleInr;
      eventType = 'DISPATCH';
      summary = `Dispatched ${sample.sampleNumber} via ${updates.courierName} (${updates.trackingNumber})`;

      // Post balanced logistics journal when shipping + handling added cleanly
      const logisticsAdded = round2(
        Math.max(0, newShipping - Number(sample.shippingCostInr || 0)) +
          Math.max(0, newHandling - Number(sample.handlingCostInr || 0))
      );
      if (logisticsAdded > 0) {
        const jrnNum = await getNextSequence(tx, 'JRN');
        await tx.insert(erpAccountingJournals).values({
          id: makeId('jrn'),
          organizationId: ORG_ID,
          journalNumber: jrnNum,
          entryDate: currentIsoDate(),
          fiscalPeriod: getFiscalPeriod(),
          sourceModule: 'SAMPLING_RD',
          sourceEntityId: sample.id,
          narration: `Sample courier & handling expense for ${sample.sampleNumber} (${updates.courierName})`,
          lines: [
            {
              accountCode: '5220',
              accountName: 'Sample Dispatch & Courier Logistics',
              accountType: 'EXPENSE',
              debitInr: logisticsAdded,
              creditInr: 0,
              costCenter: sample.purpose === 'INFLUENCER_SEEDING' ? 'CC-MKT' : 'CC-SLS'
            },
            {
              accountCode: '1010',
              accountName: 'HDFC Operating Bank Account',
              accountType: 'ASSET',
              debitInr: 0,
              creditInr: logisticsAdded,
              costCenter: 'CC-100'
            }
          ],
          totalDebitInr: logisticsAdded,
          totalCreditInr: logisticsAdded,
          isBalanced: true,
          postedByEmail: actor.email,
          status: 'POSTED'
        });
      }

      // Sync Influencer Content Deliverables if linked
      if (sample.influencerDeliverableId) {
        const delivRows = await tx
          .select()
          .from(influencerContentDeliverables)
          .where(eq(influencerContentDeliverables.id, sample.influencerDeliverableId));
        if (delivRows.length) {
          const d = delivRows[0];
          const prevTimeline = Array.isArray(d.timeline) ? d.timeline : [];
          await tx
            .update(influencerContentDeliverables)
            .set({
              stage: d.stage === 'BRIEF_ISSUED' ? 'SAMPLE_SHIPPED' : d.stage,
              sampleSku: sample.sampleNumber,
              sampleAwb: `${updates.courierName} · ${updates.trackingNumber}`,
              timeline: [
                ...prevTimeline,
                {
                  date: currentIsoDate(),
                  event: `Sample ${sample.sampleNumber} dispatched (${updates.courierName} ${updates.trackingNumber})`,
                  actor: actor.email
                }
              ],
              updatedAt: new Date()
            })
            .where(eq(influencerContentDeliverables.id, d.id));
        }
      }

      // Sync CRM Lead follow-up if linked
      if (sample.leadId) {
        const leadRows = await tx.select().from(erpLeads).where(eq(erpLeads.id, sample.leadId));
        if (leadRows.length) {
          const lead = leadRows[0];
          await tx
            .update(erpLeads)
            .set({
              nextFollowUpDate: updates.followUpDate,
              notes: `${lead.notes ? `${lead.notes}\n` : ''}[${currentIsoDate()}] Sample ${sample.sampleNumber} dispatched (${updates.courierName} ${updates.trackingNumber}).`,
              version: sql`${erpLeads.version} + 1`,
              updatedAt: new Date()
            })
            .where(eq(erpLeads.id, lead.id));
        }
      }
    }

    // Stage 8B: ARCHIVED
    if (payload.targetStage === 'ARCHIVED') {
      summary = `Sample ${sample.sampleNumber} archived by ${actor.email}`;
    }

    const prevHist = Array.isArray(sample.stageHistory) ? sample.stageHistory : [];
    updates.stageHistory = [
      ...prevHist,
      {
        stage: payload.targetStage,
        action: summary,
        actorEmail: actor.email,
        timestamp: nowIso,
        note: payload.note || undefined
      }
    ];

    const [updated] = await tx.update(erpSamples).set(updates).where(eq(erpSamples.id, sample.id)).returning();

    await tx.insert(erpSampleEvents).values({
      id: makeId('smpev'),
      organizationId: ORG_ID,
      sampleId: sample.id,
      sampleNumber: sample.sampleNumber,
      fromStage,
      toStage: payload.targetStage,
      eventType,
      summary,
      payload: { note: payload.note, trackingNumber: updates.trackingNumber, feedbackStatus: updates.feedbackStatus },
      performedByEmail: actor.email
    });

    await recordErpAuditLog(tx, {
      action: `ERP_SAMPLE_${payload.targetStage}`,
      entity: 'erp_samples',
      entityId: sample.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: summary
    });

    return { sample: updated, revisionSample: spawnRevisionSample };
  });
}

// ============================================================================
// RETAILER / B2B SAMPLE CONVERSION LINKING
// ============================================================================

export async function linkSampleConversionTransaction(
  actor: ErpActorContext,
  payload: {
    sampleId: string;
    leadId?: string;
    convertedToOrderId?: string;
    conversionValueInr: number;
    feedbackSummary?: string;
  }
) {
  await ensureSamplingQcSeeded();
  if (Number(payload.conversionValueInr || 0) <= 0) {
    throw new ValidationError('Conversion revenue value (INR) must be greater than zero.');
  }

  return await db.transaction(async (tx) => {
    const rows = await tx.select().from(erpSamples).where(eq(erpSamples.id, payload.sampleId));
    if (!rows.length) throw new NotFoundError('Sample record not found.');
    const sample = rows[0];

    const prevHist = Array.isArray(sample.stageHistory) ? sample.stageHistory : [];
    const summary = `Converted sample ${sample.sampleNumber} to commercial order value ₹${Number(payload.conversionValueInr).toLocaleString('en-IN')}`;

    const [updated] = await tx
      .update(erpSamples)
      .set({
        feedbackStatus: 'CONVERTED',
        feedbackSummary: payload.feedbackSummary || summary,
        feedbackReceivedAt: new Date(),
        leadId: payload.leadId || sample.leadId,
        convertedToOrderId: payload.convertedToOrderId || sample.convertedToOrderId || `ORD-CONV-${Date.now().toString().slice(-5)}`,
        conversionValueInr: round2(Number(payload.conversionValueInr)),
        stageHistory: [
          ...prevHist,
          { stage: sample.workflowStage, action: summary, actorEmail: actor.email, timestamp: new Date().toISOString() }
        ],
        version: sql`${erpSamples.version} + 1`,
        updatedAt: new Date()
      })
      .where(eq(erpSamples.id, sample.id))
      .returning();

    if (updated.leadId) {
      await tx
        .update(erpLeads)
        .set({
          stage: 'WON',
          notes: `Sample ${sample.sampleNumber} converted cleanly (₹${payload.conversionValueInr}).`,
          updatedAt: new Date()
        })
        .where(eq(erpLeads.id, updated.leadId));
    }

    await tx.insert(erpSampleEvents).values({
      id: makeId('smpev'),
      organizationId: ORG_ID,
      sampleId: sample.id,
      sampleNumber: sample.sampleNumber,
      fromStage: sample.workflowStage,
      toStage: sample.workflowStage,
      eventType: 'CONVERSION',
      summary,
      payload: { conversionValueInr: payload.conversionValueInr, orderId: updated.convertedToOrderId },
      performedByEmail: actor.email
    });

    return updated;
  });
}

// ============================================================================
// CONFIGURABLE QC CHECKLISTS & LABORATORY INSPECTIONS + CAPA / RETESTING
// ============================================================================

export async function upsertQcChecklist(
  actor: ErpActorContext,
  payload: {
    id?: string;
    checklistCode?: string;
    name: string;
    inspectionType: string;
    criteria: Array<{
      criterionId?: string;
      parameter: string;
      testMethod: string;
      acceptanceMin?: number;
      acceptanceMax?: number;
      expectedSpec: string;
      unit?: string;
      isCritical?: boolean;
    }>;
    isActive?: boolean;
  }
) {
  await ensureSamplingQcSeeded();
  if (!payload.name?.trim()) throw new ValidationError('Checklist name is required.');
  if (!Array.isArray(payload.criteria) || !payload.criteria.length) {
    throw new ValidationError('At least one QC acceptance criterion is required.');
  }

  return await db.transaction(async (tx) => {
    const normalizedCriteria = payload.criteria.map((c, idx) => ({
      criterionId: c.criterionId || `crit-${idx + 1}`,
      parameter: String(c.parameter || '').trim(),
      testMethod: String(c.testMethod || 'Visual / Lab SOP').trim(),
      acceptanceMin: c.acceptanceMin !== undefined && c.acceptanceMin !== null ? Number(c.acceptanceMin) : undefined,
      acceptanceMax: c.acceptanceMax !== undefined && c.acceptanceMax !== null ? Number(c.acceptanceMax) : undefined,
      expectedSpec: String(c.expectedSpec || 'Conforms').trim(),
      unit: c.unit || undefined,
      isCritical: c.isCritical !== false
    }));

    if (payload.id) {
      const [updated] = await tx
        .update(erpQcChecklists)
        .set({
          name: payload.name.trim(),
          inspectionType: payload.inspectionType,
          criteria: normalizedCriteria,
          isActive: payload.isActive !== false,
          version: sql`${erpQcChecklists.version} + 1`,
          updatedAt: new Date()
        })
        .where(eq(erpQcChecklists.id, payload.id))
        .returning();
      if (!updated) throw new NotFoundError('QC Checklist not found.');
      return updated;
    }

    const code = payload.checklistCode?.trim() || (await getNextSequence(tx, 'QCHK'));
    const [created] = await tx
      .insert(erpQcChecklists)
      .values({
        id: makeId('qchk'),
        organizationId: ORG_ID,
        checklistCode: code,
        name: payload.name.trim(),
        inspectionType: payload.inspectionType,
        criteria: normalizedCriteria,
        isActive: payload.isActive !== false,
        createdByEmail: actor.email
      })
      .returning();
    return created;
  });
}

export async function recordDetailedQcInspectionTransaction(
  actor: ErpActorContext,
  payload: {
    inspectionType: string;
    batchId?: string;
    sampleId?: string;
    grnId?: string;
    subjectName: string;
    checklistId?: string;
    checklistResults?: Array<{
      criterionId: string;
      parameter: string;
      targetSpec: string;
      measuredValue: string;
      isCritical: boolean;
      passed: boolean;
      notes?: string;
    }>;
    appearanceResult: string;
    odourResult: string;
    colourResult: string;
    targetFillVolumeMl?: number;
    actualFillVolumeMl?: number;
    packagingInspectionResult: string;
    stabilityObservations?: string;
    abvTestedPct: number;
    specificGravity?: number;
    refractiveIndex?: number;
    gcmsMatchPct: number;
    microbiologyPass?: boolean;
    labTests?: Record<string, any>;
    decision: 'PASSED' | 'FAILED' | 'QUARANTINED';
    correctiveAction?: string;
    supportingEvidenceRef?: string;
    retestOfQcId?: string;
  }
) {
  await ensureSamplingQcSeeded();
  if (!payload.subjectName?.trim()) throw new ValidationError('Inspection subject name is required.');
  if ((payload.decision === 'FAILED' || payload.decision === 'QUARANTINED') && !payload.correctiveAction?.trim()) {
    throw new ValidationError('Corrective action (CAPA) is mandatory when QC decision is FAILED or QUARANTINED.');
  }

  return await db.transaction(async (tx) => {
    let checklistName: string | null = null;
    if (payload.checklistId) {
      const chkRows = await tx.select().from(erpQcChecklists).where(eq(erpQcChecklists.id, payload.checklistId));
      if (chkRows.length) checklistName = chkRows[0].name;
    }

    // Critical checklist gate: cannot PASS if any critical checklist criterion explicitly failed
    if (payload.decision === 'PASSED' && Array.isArray(payload.checklistResults)) {
      const failedCrit = payload.checklistResults.find((c) => c.isCritical && !c.passed);
      if (failedCrit) {
        throw new ValidationError(
          `Cannot mark QC PASSED while critical checklist criterion "${failedCrit.parameter}" failed.`
        );
      }
    }

    let retestCount = 0;
    let origQc: any = null;
    if (payload.retestOfQcId) {
      const origRows = await tx.select().from(erpQcRecords).where(eq(erpQcRecords.id, payload.retestOfQcId));
      if (!origRows.length) throw new NotFoundError('Original QC record for retesting not found.');
      origQc = origRows[0];
      retestCount = Number(origQc.retestCount || 0) + 1;
    }

    const qcNumber = await getNextSequence(tx, 'QC');
    const canApproveNow = actor.isSuperAdmin || actor.permissions.quality?.canApprove || actor.roleCode === 'QC_ANALYST' || actor.roleCode === 'FORMULATOR';
    const hasEvidenceForCoa = Boolean(payload.supportingEvidenceRef?.trim()) && payload.decision === 'PASSED' && canApproveNow;
    const certificateNumber = hasEvidenceForCoa ? await getNextSequence(tx, 'COA') : null;

    const approvalHistory = [
      {
        decision: payload.decision,
        actorEmail: actor.email,
        timestamp: new Date().toISOString(),
        notes: payload.decision === 'PASSED' ? 'QC evaluation logged & signed' : payload.correctiveAction
      }
    ];

    const [qc] = await tx
      .insert(erpQcRecords)
      .values({
        id: makeId('qc'),
        organizationId: ORG_ID,
        qcNumber,
        inspectionType: payload.inspectionType || 'SAMPLE_EVALUATION',
        batchId: payload.batchId || origQc?.batchId || null,
        grnId: payload.grnId || origQc?.grnId || null,
        sampleId: payload.sampleId || origQc?.sampleId || null,
        subjectName: payload.subjectName.trim(),
        checklistId: payload.checklistId || null,
        checklistName,
        checklistResults: payload.checklistResults || null,
        abvTestedPct: Number(payload.abvTestedPct || 80),
        specificGravity: Number(payload.specificGravity || 0.845),
        refractiveIndex: Number(payload.refractiveIndex || 1.368),
        gcmsMatchPct: Number(payload.gcmsMatchPct || 99.2),
        appearanceResult: payload.appearanceResult || 'CLEAR_HOMOGENEOUS',
        odourResult: payload.odourResult || 'CONFORMS_TO_MASTER',
        colourResult: payload.colourResult || 'MILD_GOLD_CLEAR',
        targetFillVolumeMl: payload.targetFillVolumeMl !== undefined ? Number(payload.targetFillVolumeMl) : null,
        actualFillVolumeMl: payload.actualFillVolumeMl !== undefined ? Number(payload.actualFillVolumeMl) : null,
        packagingInspectionResult: payload.packagingInspectionResult || 'PASS',
        stabilityObservations: payload.stabilityObservations || null,
        labTests: payload.labTests || null,
        clarityResult: payload.appearanceResult || 'CRYSTAL_CLEAR',
        olfactoryResult: payload.odourResult || 'CONFORMS',
        microbiologyPass: payload.microbiologyPass !== false,
        decision: payload.decision,
        correctiveAction: payload.correctiveAction || null,
        capaStatus:
          payload.decision === 'FAILED' || payload.decision === 'QUARANTINED'
            ? 'OPEN'
            : origQc
            ? 'VERIFIED_CLOSED'
            : 'NONE',
        retestOfQcId: origQc?.id || null,
        retestCount,
        approvalHistory,
        supportingEvidenceRef: payload.supportingEvidenceRef?.trim() || null,
        certificateNumber,
        certificateIssuedAt: certificateNumber ? new Date() : null,
        inspectorEmail: actor.email,
        approvedByEmail: canApproveNow ? actor.email : null,
        approvedAt: canApproveNow ? new Date() : null,
        status: payload.decision === 'QUARANTINED' ? 'QUARANTINED' : 'COMPLETED'
      })
      .returning();

    // Update original failed QC record if this is a retest
    if (origQc) {
      await tx
        .update(erpQcRecords)
        .set({
          retestCount,
          capaStatus: payload.decision === 'PASSED' ? 'VERIFIED_CLOSED' : 'IN_PROGRESS',
          updatedAt: new Date()
        })
        .where(eq(erpQcRecords.id, origQc.id));
    }

    // Sync Batch QC status if linked
    if (qc.batchId) {
      await tx
        .update(productionBatches)
        .set({ qcStatus: payload.decision, updatedAt: new Date() })
        .where(eq(productionBatches.id, qc.batchId));
    }

    // Log event on linked Sample (IMPORTANT: Never auto-approve formulation IFRA compliance!)
    if (qc.sampleId) {
      const sRows = await tx.select().from(erpSamples).where(eq(erpSamples.id, qc.sampleId));
      if (sRows.length) {
        const smp = sRows[0];
        await tx.insert(erpSampleEvents).values({
          id: makeId('smpev'),
          organizationId: ORG_ID,
          sampleId: smp.id,
          sampleNumber: smp.sampleNumber,
          fromStage: smp.workflowStage,
          toStage: smp.workflowStage,
          eventType: 'QC_TEST',
          summary: `QC ${qcNumber} ${payload.decision}${certificateNumber ? ` (COA ${certificateNumber})` : ''}`,
          payload: { qcId: qc.id, decision: payload.decision, retestOfQcId: origQc?.id },
          performedByEmail: actor.email
        });
      }
    }

    if (payload.decision === 'FAILED' || payload.decision === 'QUARANTINED') {
      await createErpNotification(tx, {
        departmentCode: 'QC',
        severity: 'CRITICAL',
        category: 'QC_CAPA_HOLD',
        title: `QC ${payload.decision} · ${qcNumber}`,
        message: `${qc.subjectName} requires CAPA: ${payload.correctiveAction}`,
        linkModule: 'quality',
        linkEntityId: qc.id
      });
    }

    await recordErpAuditLog(tx, {
      action: 'ERP_QC_DETAILED_RECORDED',
      entity: 'erp_qc_records',
      entityId: qc.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Recorded ${qcNumber} (${qc.inspectionType}) decision=${qc.decision}${certificateNumber ? ` COA=${certificateNumber}` : ''}`
    });

    return qc;
  });
}

// ============================================================================
// EXPLICIT FORMULATION REGULATORY COMPLIANCE AUTHORIZATION GUARD
// ============================================================================

export async function authorizeFormulationComplianceTransaction(
  actor: ErpActorContext,
  payload: {
    formulationVersionId: string;
    ifraComplianceStatus: 'COMPLIANT' | 'RESTRICTED' | 'NON_COMPLIANT';
    safetyStatus: 'SAFETY_VERIFIED' | 'FLAGGED';
    supportingEvidenceRef: string;
    ifraDossierRef: string;
    complianceNotes?: string;
  }
) {
  await ensureSamplingQcSeeded();

  if (!actor.isSuperAdmin && actor.roleCode !== 'QC_ANALYST' && actor.roleCode !== 'FORMULATOR' && !actor.permissions.quality?.canApprove) {
    throw new ForbiddenError(
      'Only authorized Super Admin, Head Formulator, or QC/Regulatory Chemist roles can sign off formulation compliance.'
    );
  }

  if (!payload.supportingEvidenceRef?.trim() || payload.supportingEvidenceRef.trim().length < 4) {
    throw new ValidationError(
      'Regulatory Compliance Guard: Documented supporting evidence reference (lab test / CoA / IFRA calculation ID) is required before marking a formulation compliant or safe.'
    );
  }

  if (!payload.ifraDossierRef?.trim() || payload.ifraDossierRef.trim().length < 4) {
    throw new ValidationError(
      'Regulatory Compliance Guard: A signed IFRA Dossier / Certificate reference ID is mandatory.'
    );
  }

  return await db.transaction(async (tx) => {
    const vRows = await tx
      .select()
      .from(erpFormulationVersions)
      .where(eq(erpFormulationVersions.id, payload.formulationVersionId));
    if (!vRows.length) throw new NotFoundError('Formulation version not found.');
    const ver = vRows[0];

    const [updated] = await tx
      .update(erpFormulationVersions)
      .set({
        ifraComplianceStatus: payload.ifraComplianceStatus,
        safetyStatus: payload.safetyStatus,
        regulatoryAuthorizationBy: actor.email,
        regulatoryAuthorizedAt: new Date(),
        supportingEvidenceRef: payload.supportingEvidenceRef.trim(),
        ifraDossierRef: payload.ifraDossierRef.trim(),
        complianceNotes:
          payload.complianceNotes?.trim() ||
          `Explicitly authorized by ${actor.email} with evidence ${payload.supportingEvidenceRef.trim()}`
      })
      .where(eq(erpFormulationVersions.id, ver.id))
      .returning();

    await tx.insert(erpAttachments).values({
      id: makeId('att'),
      organizationId: ORG_ID,
      entityType: 'FORMULATION',
      entityId: ver.formulationId,
      fileName: `${payload.ifraDossierRef.trim()}.pdf`,
      documentType: 'IFRA_REGULATORY_AUTHORIZATION',
      mimeType: 'application/pdf',
      fileSizeBytes: 0,
      storageUrlOrData: `evidence://${payload.supportingEvidenceRef.trim()}`,
      notes: `Compliance: ${payload.ifraComplianceStatus} / ${payload.safetyStatus} — Authorized by ${actor.email}`,
      uploadedByEmail: actor.email
    });

    await recordErpAuditLog(tx, {
      action: 'ERP_FORMULATION_COMPLIANCE_AUTHORIZED',
      entity: 'erp_formulation_versions',
      entityId: ver.id,
      actorEmail: actor.email,
      actorRole: actor.roleCode,
      details: `Authorized formulation v${ver.versionNumber}: IFRA=${payload.ifraComplianceStatus}, Safety=${payload.safetyStatus}, Evidence=${payload.supportingEvidenceRef.trim()}`
    });

    return updated;
  });
}

// ============================================================================
// COMPREHENSIVE SNAPSHOT & 7 ANALYTICS REPORTS ENGINE
// ============================================================================

export async function getSamplingQcWorkspaceSnapshot(actor: ErpActorContext) {
  await ensureSamplingQcSeeded();

  const [
    checklists,
    samples,
    sampleEvents,
    qcRecords,
    formulations,
    formulationVersions,
    materials,
    lots,
    sampleMovements,
    batches,
    leads,
    marketingWorkspace,
    influencerDeliverables,
    storeCustomers,
    storeOrders
  ] = await Promise.all([
    db.select().from(erpQcChecklists).orderBy(erpQcChecklists.checklistCode),
    db.select().from(erpSamples).orderBy(desc(erpSamples.createdAt)),
    db.select().from(erpSampleEvents).orderBy(desc(erpSampleEvents.createdAt)).limit(250),
    db.select().from(erpQcRecords).orderBy(desc(erpQcRecords.createdAt)),
    db.select().from(erpFormulations).orderBy(erpFormulations.formulaCode),
    db.select().from(erpFormulationVersions).orderBy(desc(erpFormulationVersions.versionNumber)),
    db.select().from(erpMaterials).orderBy(erpMaterials.code),
    db.select().from(erpStockLots).orderBy(asc(erpStockLots.receivedDate)),
    db.select().from(erpStockMovements).where(eq(erpStockMovements.movementType, 'SAMPLE_ISSUE')).orderBy(desc(erpStockMovements.createdAt)),
    db.select().from(productionBatches).orderBy(desc(productionBatches.createdAt)),
    db.select().from(erpLeads).orderBy(desc(erpLeads.createdAt)),
    db.select().from(erpMarketingWorkspace).orderBy(desc(erpMarketingWorkspace.createdAt)),
    db.select().from(influencerContentDeliverables).orderBy(desc(influencerContentDeliverables.createdAt)),
    db.select().from(customers).orderBy(desc(customers.createdAt)),
    db.select().from(orders).orderBy(desc(orders.createdAt))
  ]);

  // Report 1: Sample Development History (R&D lineage & iteration scores)
  const sampleDevelopmentHistory = samples
    .filter((s) => ['NEW_FORMULA_DEV', 'FORMULA_REVISION', 'INTERNAL_QC'].includes(s.purpose))
    .map((s) => ({
      sampleNumber: s.sampleNumber,
      fragranceName: s.fragranceName,
      purpose: s.purpose,
      workflowStage: s.workflowStage,
      revisionNumber: s.revisionNumber,
      parentSampleId: s.parentSampleId,
      preparationDate: s.preparationDate,
      preparerEmail: s.preparerEmail || s.requestedByEmail,
      olfactoryScore: s.olfactoryScore,
      longevityHours: s.longevityHours,
      totalCostInr: s.totalCostInr,
      evaluationNotes: s.evaluationNotes
    }));

  // Report 2: Sample Consumption (Units, mL & Stock Lot Ledger Consumption)
  const totalSampleUnits = samples.reduce((s, x) => s + Number(x.quantityUnits || 0), 0);
  const totalSampleVolumeMl = samples.reduce((s, x) => s + Number(x.quantityUnits || 0) * Number(x.volumeMl || 0), 0);
  const consumptionByPurpose = SAMPLE_PURPOSES.map((p) => {
    const group = samples.filter((s) => s.purpose === p.code);
    return {
      purpose: p.code,
      label: p.label,
      samplesCount: group.length,
      unitsConsumed: group.reduce((s, x) => s + Number(x.quantityUnits || 0), 0),
      volumeMl: group.reduce((s, x) => s + Number(x.quantityUnits || 0) * Number(x.volumeMl || 0), 0),
      totalCostInr: round2(group.reduce((s, x) => s + Number(x.totalCostInr || 0), 0))
    };
  });

  // Report 3: QC Rejection & CAPA Rate
  const totalQc = qcRecords.length;
  const passedQc = qcRecords.filter((q) => q.decision === 'PASSED').length;
  const failedQc = qcRecords.filter((q) => q.decision === 'FAILED').length;
  const quarantinedQc = qcRecords.filter((q) => q.decision === 'QUARANTINED').length;
  const qcRejectionRatePct = totalQc > 0 ? round2(((failedQc + quarantinedQc) / totalQc) * 100) : 0;
  const openCapasCount = qcRecords.filter((q) => ['OPEN', 'IN_PROGRESS'].includes(q.capaStatus)).length;

  // Report 4: Pending Feedback & Follow-Ups
  const todayStr = currentIsoDate();
  const pendingFeedbackList = samples
    .filter((s) => s.feedbackStatus === 'PENDING' && s.workflowStage !== 'ARCHIVED')
    .map((s) => ({
      id: s.id,
      sampleNumber: s.sampleNumber,
      fragranceName: s.fragranceName,
      purpose: s.purpose,
      workflowStage: s.workflowStage,
      recipientName: s.recipientName || s.recipientCompany || 'Internal',
      recipientEmail: s.recipientEmail,
      dispatchDate: s.dispatchDate,
      trackingNumber: s.trackingNumber,
      followUpDate: s.followUpDate,
      isOverdue: Boolean(s.followUpDate && s.followUpDate < todayStr),
      totalCostInr: s.totalCostInr
    }));

  // Report 5: Influencer Sample Cost Report (Integrated with Marketing Agency & Creator Deliverables)
  const influencerSamples = samples.filter((s) => s.purpose === 'INFLUENCER_SEEDING');
  const influencerSampleCostInr = round2(influencerSamples.reduce((s, x) => s + Number(x.totalCostInr || 0), 0));
  const influencerSampleCostReport = influencerSamples.map((s) => {
    const brief = marketingWorkspace.find((m) => m.id === s.marketingBriefId);
    const deliverable = influencerDeliverables.find((d) => d.id === s.influencerDeliverableId);
    return {
      sampleNumber: s.sampleNumber,
      fragranceName: s.fragranceName,
      recipientName: s.recipientName,
      marketingBriefCode: brief?.briefCode || null,
      marketingBriefTitle: brief?.title || null,
      deliverableTitle: deliverable?.deliverableTitle || null,
      deliverableStage: deliverable?.stage || null,
      trackingNumber: s.trackingNumber,
      rawMaterialCostInr: s.rawMaterialCostInr,
      vialLabelPkgCostInr: round2(Number(s.vialCostInr || 0) + Number(s.labelCostInr || 0) + Number(s.packagingCostInr || 0)),
      shippingHandlingCostInr: round2(Number(s.shippingCostInr || 0) + Number(s.handlingCostInr || 0)),
      totalCostInr: s.totalCostInr,
      feedbackStatus: s.feedbackStatus
    };
  });

  // Report 6: Retailer / Commercial Sample Conversion Report (Integrated with CRM)
  const commercialSamples = samples.filter((s) =>
    ['RETAILER_TESTING', 'CORPORATE_PROPOSAL', 'CUSTOMER_TRIAL'].includes(s.purpose)
  );
  const convertedCommercial = commercialSamples.filter((s) => s.feedbackStatus === 'CONVERTED' || Number(s.conversionValueInr || 0) > 0);
  const retailerConversionRatePct =
    commercialSamples.length > 0 ? round2((convertedCommercial.length / commercialSamples.length) * 100) : 0;
  const totalCommercialSampleCostInr = round2(commercialSamples.reduce((s, x) => s + Number(x.totalCostInr || 0), 0));
  const totalConversionRevenueInr = round2(convertedCommercial.reduce((s, x) => s + Number(x.conversionValueInr || 0), 0));

  // Report 7: R&D Expenditure Breakdown
  const rdExpenditure = {
    rawMaterialCostInr: round2(samples.reduce((s, x) => s + Number(x.rawMaterialCostInr || 0), 0)),
    vialCostInr: round2(samples.reduce((s, x) => s + Number(x.vialCostInr || 0), 0)),
    labelCostInr: round2(samples.reduce((s, x) => s + Number(x.labelCostInr || 0), 0)),
    packagingCostInr: round2(samples.reduce((s, x) => s + Number(x.packagingCostInr || 0), 0)),
    shippingCostInr: round2(samples.reduce((s, x) => s + Number(x.shippingCostInr || 0), 0)),
    handlingCostInr: round2(samples.reduce((s, x) => s + Number(x.handlingCostInr || 0), 0)),
    grandTotalInr: round2(samples.reduce((s, x) => s + Number(x.totalCostInr || 0), 0))
  };

  return {
    actor,
    purposes: SAMPLE_PURPOSES,
    workflowStages: SAMPLE_WORKFLOW_STAGES,
    checklists,
    samples,
    sampleEvents,
    qcRecords,
    formulations,
    formulationVersions,
    materials,
    lots,
    sampleMovements,
    batches,
    leads,
    marketingWorkspace,
    influencerDeliverables,
    customers: storeCustomers,
    orders: storeOrders,
    reports: {
      sampleDevelopmentHistory,
      sampleConsumption: {
        totalSampleUnits,
        totalSampleVolumeMl,
        stockLedgerIssuesCount: sampleMovements.length,
        byPurpose: consumptionByPurpose
      },
      qcRejectionStats: {
        totalQc,
        passedQc,
        failedQc,
        quarantinedQc,
        qcRejectionRatePct,
        openCapasCount
      },
      pendingFeedbackList,
      influencerSampleCostReport: {
        count: influencerSamples.length,
        totalSpendInr: influencerSampleCostInr,
        rows: influencerSampleCostReport
      },
      retailerSampleConversion: {
        totalCommercialSamples: commercialSamples.length,
        convertedCount: convertedCommercial.length,
        conversionRatePct: retailerConversionRatePct,
        totalSampleCostInr: totalCommercialSampleCostInr,
        totalConversionRevenueInr,
        roiMultiple: totalCommercialSampleCostInr > 0 ? round2(totalConversionRevenueInr / totalCommercialSampleCostInr) : 0,
        rows: commercialSamples
      },
      rdExpenditure
    }
  };
}
