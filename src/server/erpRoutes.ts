import fs from 'fs';
import { Router, type Request, type Response } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { db } from '../db/index.ts';
import { erpNotifications } from '../db/schema.ts';
import { eq } from 'drizzle-orm';
import { broadcastCrossBrowserSyncEvent } from './productionAuditAndReliabilityEngine.ts';
import {
  resolveErpActor,
  assertErpPermission,
  getErpWorkspaceSnapshot,
  createOrUpdateMaterial,
  createWarehouse,
  createGoodsReceiptTransaction,
  createFormulationWithVersion,
  recordSampleEvaluation,
  recordQcInspectionTransaction,
  adjustFinishedGoodsWarehouseBin,
  createOrUpdateLead,
  convertLeadToCustomerTransaction,
  createProposal,
  createQuotationWithGst,
  createGstInvoiceTransaction,
  recordPaymentTransaction,
  issueCreditNoteTransaction,
  createManualAccountingJournal,
  createMarketingBrief,
  createEmployeeRecord,
  createInternRecord,
  createOrUpdateTask,
  decideApprovalItem,
  updateRolePermissionMatrix,
  assignUserErpAccess,
  updateOrganizationSettings,
  addDocumentAttachment,
  searchErpEntities,
  importErpCsvRows,
  ErpError,
  type ErpActorContext,
  type ErpModuleKey,
  type ErpActionKey
} from './erpBusinessOsEngine.ts';

import {
  getProcurementWorkspaceSnapshot,
  upsertProcurementSupplier,
  createPurchaseRequisition,
  createProcurementRfq,
  recordSupplierQuotation,
  createPurchaseOrderTransaction,
  awardQuotationAndCreatePoTransaction,
  cancelPurchaseOrderTransaction,
  createPartialOrFullGrnTransaction,
  inspectAndApproveGrnTransaction,
  postVendorInvoiceTransaction,
  approveAndPostVendorInvoiceTransaction,
  issueDebitNoteTransaction,
  recordSupplierPaymentTransaction
} from './erpProcurementEngine.ts';
import {
  getManufacturingWorkspaceSnapshot,
  saveMaterialWithDensity,
  convertMaterialQty,
  postStockMovementTransaction,
  saveFormulationAdvanced,
  createBatchPlanTransaction,
  advanceBatchStageTransaction,
  recordBatchReworkOrScrapTransaction,
  getBatchTraceabilityReport,
  createOnceEditionTransaction,
  launchOnceCampaignBatchTransaction,
  permanentlyCloseOnceEditionTransaction
} from './erpManufacturingEngine.ts';
import {
  getSamplingQcWorkspaceSnapshot,
  createSampleRequestTransaction,
  advanceSampleWorkflowTransaction,
  linkSampleConversionTransaction,
  upsertQcChecklist,
  recordDetailedQcInspectionTransaction,
  authorizeFormulationComplianceTransaction
} from './erpQualityAndSamplingEngine.ts';
import {
  getCommercialCrmWorkspaceSnapshot,
  upsertCrmLeadAdvanced,
  logLeadContactAndTask,
  advanceDealWorkflowStage,
  saveProposalAdvanced,
  updateProposalStatusAndAcceptance,
  compareProposalVersions,
  createOrUpdateQuotationAdvanced,
  approveOrAcceptQuotation,
  convertCommercialToSalesOrder,
  progressCommercialOrderWorkflow
} from './erpCommercialCrmEngine.ts';
import {
  getGstAccountingWorkspaceSnapshot,
  updateGstAndPolicyConfig,
  upsertHsnSacRule,
  decideHsnSacVerification,
  createSalesBillingDocument,
  convertProformaToTaxInvoice,
  updateInvoiceStatutoryCompliance,
  recordCustomerAdvanceReceipt,
  recordAccountPaymentReceiptOrPayout,
  issueSalesDebitNoteTransaction,
  createDeliveryChallanTransaction,
  convertChallanToTaxInvoice,
  processSalesReturnTransaction,
  upsertChartOfAccount,
  reverseAccountingJournalTransaction,
  recordExpenseOrPettyCashVoucher,
  importBankStatementLines,
  reconcileBankStatementLine,
  runAccountingVerificationSuite,
  decideAccountingReadiness
} from './erpGstAccountingEngine.ts';
import {
  getAgencyHrWorkspaceSnapshot,
  evaluateLuxuryBrandPhilosophy,
  upsertAgencyProfile,
  upsertAgencyStaff,
  saveLuxuryCampaignPlan,
  saveCreativeAssetWithRevision,
  transitionCreativeApprovalStage,
  upsertInfluencerPartner,
  createInfluencerSeedingRequest,
  updateSeedingDispatchAndFeedback,
  saveAgencyInvoice,
  syncAuthorizedAdReporting,
  upsertInternProfile,
  recordInternAttendance,
  submitInternWork,
  reviewInternSubmission,
  recordInternEvaluation,
  saveCollaborativeTask,
  addTaskComment
} from './erpAgencyHrWorkspaceEngine.ts';
import {
  getReportCatalogForActor,
  previewReportData,
  createExportJob,
  retryExportJob,
  listExportJobs,
  getExportJobById,
  verifyAndReadExportDownload
} from './erpReportingExportEngine.ts';
import {
  getErpAiAssistantBootstrap,
  runErpAiBusinessAssistant,
  confirmErpAiPendingAction,
  cancelErpAiPendingAction,
  evaluateAndSyncErpAlerts,
  updateErpAlertRule,
  runFinalErpSystemVerificationSuite,
  getLatestSystemVerificationReport
} from './erpAiAssistantAndAlertsEngine.ts';

export const erpRouter = Router();

async function getActorFromRequest(req: Request): Promise<ErpActorContext> {
  let verifiedEmail: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1];
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      if (decoded?.email) verifiedEmail = decoded.email;
    } catch {
      // Fallback to verified admin session headers if Firebase admin token not verified locally
    }
  }
  return resolveErpActor({
    verifiedEmail,
    headerEmail: req.headers['x-admin-email'] as string | undefined,
    headerAdminRole: req.headers['x-admin-role'] as string | undefined,
    headerErpRoleCode: req.headers['x-erp-role-code'] as string | undefined
  });
}

function handleErpError(res: Response, err: any) {
  if (err instanceof ErpError) {
    return res.status(err.status).json({ error: err.message, code: err.code });
  }
  console.error('[ERP API Error]:', err);
  return res.status(500).json({ error: err?.message || 'Internal ERP server error' });
}

function withErpAccess(
  moduleKey: ErpModuleKey,
  action: ErpActionKey,
  handler: (req: Request, res: Response, actor: ErpActorContext) => Promise<any>,
  broadcastEntity?: string
) {
  return async (req: Request, res: Response) => {
    try {
      const actor = await getActorFromRequest(req);
      assertErpPermission(actor, moduleKey, action);
      const result = await handler(req, res, actor);
      if (broadcastEntity && req.method !== 'GET') {
        broadcastCrossBrowserSyncEvent({
          type: 'STATE_INVALIDATED',
          entity: broadcastEntity,
          summary: `${broadcastEntity} updated by ${actor.email} (${actor.roleCode})`
        });
      }
      if (!res.headersSent) {
        res.json(result);
      }
    } catch (err) {
      if (!res.headersSent) handleErpError(res, err);
    }
  };
}

// 1. Unified Workspace Bootstrap (Filtered by actor permissions metadata)
erpRouter.get(
  '/bootstrap',
  withErpAccess('executive', 'view', async (_req, _res, actor) => {
    return getErpWorkspaceSnapshot(actor);
  })
);

// 2. Actor Context & Permissions Check
erpRouter.get('/me', async (req, res) => {
  try {
    const actor = await getActorFromRequest(req);
    res.json({ actor });
  } catch (err) {
    handleErpError(res, err);
  }
});

// 3. Warehouses, Raw Materials & Goods Receipts
erpRouter.post(
  '/warehouses',
  withErpAccess('warehouse', 'create', async (req, _res, actor) => {
    return { success: true, warehouse: await createWarehouse(actor, req.body) };
  }, 'erp_warehouses')
);

erpRouter.post(
  '/materials',
  withErpAccess('materials', 'create', async (req, _res, actor) => {
    return { success: true, material: await createOrUpdateMaterial(actor, req.body) };
  }, 'erp_materials')
);

erpRouter.post(
  '/goods-receipts',
  withErpAccess('procurement', 'create', async (req, _res, actor) => {
    return { success: true, ...(await createGoodsReceiptTransaction(actor, req.body)) };
  }, 'erp_goods_receipts')
);

// 4. Formulations & Versions
erpRouter.post(
  '/formulations',
  withErpAccess('formulations', 'create', async (req, _res, actor) => {
    return { success: true, ...(await createFormulationWithVersion(actor, req.body)) };
  }, 'erp_formulations')
);

// 5. Sampling & Quality Control (QC)
erpRouter.post(
  '/samples',
  withErpAccess('quality', 'create', async (req, _res, actor) => {
    return { success: true, sample: await recordSampleEvaluation(actor, req.body) };
  }, 'erp_samples')
);

erpRouter.post(
  '/qc-records',
  withErpAccess('quality', 'create', async (req, _res, actor) => {
    return { success: true, qcRecord: await recordQcInspectionTransaction(actor, req.body) };
  }, 'erp_qc_records')
);

// 6. Finished Goods Warehouse Bins
erpRouter.patch(
  '/finished-goods/:id',
  withErpAccess('warehouse', 'edit', async (req, _res, actor) => {
    return { success: true, finishedGood: await adjustFinishedGoodsWarehouseBin(actor, { ...req.body, id: req.params.id }) };
  }, 'erp_finished_goods')
);

// 7. B2B CRM Leads, Proposals & Quotations
erpRouter.post(
  '/leads',
  withErpAccess('crm', 'create', async (req, _res, actor) => {
    return { success: true, lead: await createOrUpdateLead(actor, req.body) };
  }, 'erp_leads')
);

erpRouter.post(
  '/leads/:id/convert',
  withErpAccess('crm', 'approve', async (req, _res, actor) => {
    return { success: true, ...(await convertLeadToCustomerTransaction(actor, req.params.id)) };
  }, 'erp_leads')
);

erpRouter.post(
  '/proposals',
  withErpAccess('proposals', 'create', async (req, _res, actor) => {
    return { success: true, proposal: await createProposal(actor, req.body) };
  }, 'erp_proposals')
);

erpRouter.post(
  '/quotations',
  withErpAccess('proposals', 'create', async (req, _res, actor) => {
    return { success: true, quotation: await createQuotationWithGst(actor, req.body) };
  }, 'erp_quotations')
);

// 8. GST Billing, Credit Notes, Payments & Double-Entry Journals
erpRouter.post(
  '/invoices',
  withErpAccess('gst_billing', 'create', async (req, _res, actor) => {
    return { success: true, ...(await createGstInvoiceTransaction(actor, req.body)) };
  }, 'erp_invoices')
);

erpRouter.post(
  '/credit-notes',
  withErpAccess('gst_billing', 'create', async (req, _res, actor) => {
    return { success: true, ...(await issueCreditNoteTransaction(actor, req.body)) };
  }, 'erp_credit_notes')
);

erpRouter.post(
  '/payments',
  withErpAccess('accounting', 'create', async (req, _res, actor) => {
    return { success: true, ...(await recordPaymentTransaction(actor, req.body)) };
  }, 'erp_payments')
);

erpRouter.post(
  '/journals',
  withErpAccess('accounting', 'create', async (req, _res, actor) => {
    return { success: true, journal: await createManualAccountingJournal(actor, req.body) };
  }, 'erp_accounting_journals')
);

// 9. Digital Marketing Workspace
erpRouter.post(
  '/marketing-workspace',
  withErpAccess('marketing', 'create', async (req, _res, actor) => {
    return { success: true, brief: await createMarketingBrief(actor, req.body) };
  }, 'erp_marketing_workspace')
);

// 10. HR: Employees, Interns & Cross-Department Tasks
erpRouter.post(
  '/employees',
  withErpAccess('hr', 'create', async (req, _res, actor) => {
    return { success: true, employee: await createEmployeeRecord(actor, req.body) };
  }, 'erp_employees')
);

erpRouter.post(
  '/interns',
  withErpAccess('hr', 'create', async (req, _res, actor) => {
    return { success: true, intern: await createInternRecord(actor, req.body) };
  }, 'erp_interns')
);

erpRouter.post(
  '/tasks',
  withErpAccess('hr', 'create', async (req, _res, actor) => {
    return { success: true, task: await createOrUpdateTask(actor, req.body) };
  }, 'erp_tasks')
);

erpRouter.patch(
  '/tasks/:id',
  withErpAccess('hr', 'edit', async (req, _res, actor) => {
    return { success: true, task: await createOrUpdateTask(actor, { ...req.body, id: req.params.id }) };
  }, 'erp_tasks')
);

// 11. Approval Inbox, Notifications & Attachments
erpRouter.post(
  '/approvals/:id/decide',
  withErpAccess('executive', 'approve', async (req, _res, actor) => {
    return {
      success: true,
      approval: await decideApprovalItem(actor, {
        approvalId: req.params.id,
        decision: req.body.decision,
        note: req.body.note
      })
    };
  }, 'erp_approvals')
);

erpRouter.post(
  '/notifications/:id/read',
  withErpAccess('executive', 'view', async (req) => {
    await db
      .update(erpNotifications)
      .set({ isRead: true, readAt: new Date() })
      .where(eq(erpNotifications.id, req.params.id));
    return { success: true };
  }, 'erp_notifications')
);

erpRouter.post(
  '/attachments',
  withErpAccess('executive', 'create', async (req, _res, actor) => {
    return { success: true, attachment: await addDocumentAttachment(actor, req.body) };
  }, 'erp_attachments')
);

// 12. RBAC Permissions & User Access Management
erpRouter.put(
  '/rbac/permissions',
  withErpAccess('rbac', 'edit', async (req, _res, actor) => {
    return { success: true, permission: await updateRolePermissionMatrix(actor, req.body) };
  }, 'erp_permissions')
);

erpRouter.post(
  '/rbac/users',
  withErpAccess('rbac', 'create', async (req, _res, actor) => {
    return { success: true, userAccess: await assignUserErpAccess(actor, req.body) };
  }, 'erp_user_access')
);

// 13. Organization / Company Settings
erpRouter.put(
  '/organization',
  withErpAccess('settings', 'edit', async (req, _res, actor) => {
    return { success: true, organization: await updateOrganizationSettings(actor, req.body) };
  }, 'erp_organizations')
);

// 14. Universal Search, CSV Data Import & AI Business Assistant
erpRouter.get(
  '/search',
  withErpAccess('executive', 'view', async (req) => {
    const q = String(req.query.q || '');
    return { results: await searchErpEntities(q) };
  })
);

erpRouter.post(
  '/import',
  withErpAccess('materials', 'create', async (req, _res, actor) => {
    return { success: true, ...(await importErpCsvRows(actor, req.body)) };
  }, 'erp_import')
);

erpRouter.get(
  '/assistant/bootstrap',
  withErpAccess('assistant', 'view', async (_req, _res, actor) => {
    return getErpAiAssistantBootstrap(actor);
  })
);

erpRouter.post(
  '/assistant/query',
  withErpAccess('assistant', 'view', async (req, _res, actor) => {
    return { success: true, ...(await runErpAiBusinessAssistant(actor, req.body)) };
  })
);

erpRouter.post('/assistant/confirm/:id', async (req, res) => {
  try {
    const actor = await getActorFromRequest(req);
    const confirmation = await confirmErpAiPendingAction(actor, req.params.id);
    broadcastCrossBrowserSyncEvent({
      type: 'STATE_INVALIDATED',
      entity: 'erp_ai_action_confirmations',
      summary: `Confirmed AI action ${confirmation.confirmationCode} by ${actor.email}`
    });
    res.json({ success: true, confirmation });
  } catch (err) {
    handleErpError(res, err);
  }
});

erpRouter.post('/assistant/cancel/:id', async (req, res) => {
  try {
    const actor = await getActorFromRequest(req);
    const confirmation = await cancelErpAiPendingAction(actor, req.params.id);
    res.json({ success: true, confirmation });
  } catch (err) {
    handleErpError(res, err);
  }
});

// 15. FRAGMORÉ PROCUREMENT MANAGEMENT OS WORKFLOW ROUTES
erpRouter.get(
  '/procurement/snapshot',
  withErpAccess('procurement', 'view', async () => {
    return getProcurementWorkspaceSnapshot();
  })
);

erpRouter.post(
  '/procurement/suppliers',
  withErpAccess('procurement', 'create', async (req, _res, actor) => {
    return { success: true, supplier: await upsertProcurementSupplier(actor, req.body) };
  }, 'procurement_suppliers')
);

erpRouter.post(
  '/procurement/requisitions',
  withErpAccess('procurement', 'create', async (req, _res, actor) => {
    return { success: true, requisition: await createPurchaseRequisition(actor, req.body) };
  }, 'erp_purchase_requisitions')
);

erpRouter.post(
  '/procurement/rfqs',
  withErpAccess('procurement', 'create', async (req, _res, actor) => {
    return { success: true, rfq: await createProcurementRfq(actor, req.body) };
  }, 'erp_rfqs')
);

erpRouter.post(
  '/procurement/quotations',
  withErpAccess('procurement', 'create', async (req, _res, actor) => {
    return { success: true, quotation: await recordSupplierQuotation(actor, req.body) };
  }, 'erp_supplier_quotations')
);

erpRouter.post(
  '/procurement/quotations/:id/award',
  withErpAccess('procurement', 'approve', async (req, _res, actor) => {
    return { success: true, ...(await awardQuotationAndCreatePoTransaction(actor, req.params.id)) };
  }, 'supplier_purchase_orders')
);

erpRouter.post(
  '/procurement/purchase-orders',
  withErpAccess('procurement', 'create', async (req, _res, actor) => {
    return { success: true, purchaseOrder: await createPurchaseOrderTransaction(actor, req.body) };
  }, 'supplier_purchase_orders')
);

erpRouter.post(
  '/procurement/purchase-orders/:id/cancel',
  withErpAccess('procurement', 'edit', async (req, _res, actor) => {
    return { success: true, purchaseOrder: await cancelPurchaseOrderTransaction(actor, req.params.id, req.body.reason) };
  }, 'supplier_purchase_orders')
);

erpRouter.post(
  '/procurement/grns',
  withErpAccess('procurement', 'create', async (req, _res, actor) => {
    return { success: true, ...(await createPartialOrFullGrnTransaction(actor, req.body)) };
  }, 'erp_goods_receipts')
);

erpRouter.post(
  '/procurement/grns/:id/inspect',
  withErpAccess('quality', 'approve', async (req, _res, actor) => {
    return { success: true, ...(await inspectAndApproveGrnTransaction(actor, { ...req.body, grnId: req.params.id })) };
  }, 'erp_goods_receipts')
);

erpRouter.post(
  '/procurement/vendor-invoices',
  withErpAccess('procurement', 'create', async (req, _res, actor) => {
    return { success: true, ...(await postVendorInvoiceTransaction(actor, req.body)) };
  }, 'erp_vendor_invoices')
);

erpRouter.post(
  '/procurement/vendor-invoices/:id/approve',
  withErpAccess('accounting', 'approve', async (req, _res, actor) => {
    return { success: true, ...(await approveAndPostVendorInvoiceTransaction(actor, req.params.id)) };
  }, 'erp_vendor_invoices')
);

erpRouter.post(
  '/procurement/debit-notes',
  withErpAccess('procurement', 'create', async (req, _res, actor) => {
    return { success: true, ...(await issueDebitNoteTransaction(actor, req.body)) };
  }, 'erp_debit_notes')
);

erpRouter.post(
  '/procurement/payments',
  withErpAccess('accounting', 'create', async (req, _res, actor) => {
    return { success: true, ...(await recordSupplierPaymentTransaction(actor, req.body)) };
  }, 'erp_payments')
);

// 16. ADVANCED INVENTORY, DENSITY CONVERSION, FORMULATION BOM, 11-STAGE BATCHES & THE ONCE COLLECTION
erpRouter.get(
  '/manufacturing/snapshot',
  withErpAccess('batches', 'view', async (_req, _res, actor) => {
    return getManufacturingWorkspaceSnapshot(actor);
  })
);

erpRouter.post(
  '/manufacturing/materials',
  withErpAccess('materials', 'create', async (req, _res, actor) => {
    return { success: true, material: await saveMaterialWithDensity(actor, req.body) };
  }, 'erp_materials')
);

erpRouter.post(
  '/manufacturing/convert-units',
  withErpAccess('materials', 'view', async (req) => {
    return { success: true, ...convertMaterialQty(req.body) };
  })
);

erpRouter.post(
  '/manufacturing/stock-movements',
  withErpAccess('materials', 'edit', async (req, _res, actor) => {
    return { success: true, ...(await postStockMovementTransaction(actor, req.body)) };
  }, 'erp_stock_movements')
);

erpRouter.post(
  '/manufacturing/formulations',
  withErpAccess('formulations', 'create', async (req, _res, actor) => {
    return { success: true, ...(await saveFormulationAdvanced(actor, req.body)) };
  }, 'erp_formulations')
);

erpRouter.post(
  '/manufacturing/batches',
  withErpAccess('batches', 'create', async (req, _res, actor) => {
    return { success: true, ...(await createBatchPlanTransaction(actor, req.body)) };
  }, 'production_batches')
);

erpRouter.post(
  '/manufacturing/batches/:id/stage',
  withErpAccess('batches', 'edit', async (req, _res, actor) => {
    return { success: true, ...(await advanceBatchStageTransaction(actor, { ...req.body, batchId: req.params.id })) };
  }, 'production_batches')
);

erpRouter.post(
  '/manufacturing/batches/:id/rework',
  withErpAccess('batches', 'edit', async (req, _res, actor) => {
    return { success: true, ...(await recordBatchReworkOrScrapTransaction(actor, { ...req.body, batchId: req.params.id })) };
  }, 'production_batches')
);

erpRouter.get(
  '/manufacturing/batches/:id/traceability',
  withErpAccess('batches', 'view', async (req) => {
    return getBatchTraceabilityReport(req.params.id);
  })
);

erpRouter.post(
  '/manufacturing/once-editions',
  withErpAccess('batches', 'create', async (req, _res, actor) => {
    return { success: true, edition: await createOnceEditionTransaction(actor, req.body) };
  }, 'erp_once_editions')
);

erpRouter.post(
  '/manufacturing/once-editions/:id/launch',
  withErpAccess('batches', 'approve', async (req, _res, actor) => {
    return { success: true, ...(await launchOnceCampaignBatchTransaction(actor, req.params.id, req.body)) };
  }, 'erp_once_editions')
);

erpRouter.post(
  '/manufacturing/once-editions/:id/close',
  withErpAccess('batches', 'approve', async (req, _res, actor) => {
    return { success: true, edition: await permanentlyCloseOnceEditionTransaction(actor, req.params.id, req.body?.notes) };
  }, 'erp_once_editions')
);

// 17. FRAGMORÉ SAMPLING, R&D WORKFLOW, CONFIGURABLE CHECKLISTS, CAPA & COMPLIANCE GUARD
erpRouter.get(
  '/sampling-qc/snapshot',
  withErpAccess('quality', 'view', async (_req, _res, actor) => {
    return getSamplingQcWorkspaceSnapshot(actor);
  })
);

erpRouter.post(
  '/sampling-qc/samples',
  withErpAccess('quality', 'create', async (req, _res, actor) => {
    return { success: true, sample: await createSampleRequestTransaction(actor, req.body) };
  }, 'erp_samples')
);

erpRouter.post(
  '/sampling-qc/samples/:id/workflow',
  withErpAccess('quality', 'edit', async (req, _res, actor) => {
    return { success: true, ...(await advanceSampleWorkflowTransaction(actor, { ...req.body, sampleId: req.params.id })) };
  }, 'erp_samples')
);

erpRouter.post(
  '/sampling-qc/samples/:id/conversion',
  withErpAccess('quality', 'edit', async (req, _res, actor) => {
    return { success: true, sample: await linkSampleConversionTransaction(actor, { ...req.body, sampleId: req.params.id }) };
  }, 'erp_samples')
);

erpRouter.post(
  '/sampling-qc/checklists',
  withErpAccess('quality', 'create', async (req, _res, actor) => {
    return { success: true, checklist: await upsertQcChecklist(actor, req.body) };
  }, 'erp_qc_checklists')
);

erpRouter.post(
  '/sampling-qc/qc-records',
  withErpAccess('quality', 'create', async (req, _res, actor) => {
    return { success: true, qcRecord: await recordDetailedQcInspectionTransaction(actor, req.body) };
  }, 'erp_qc_records')
);

erpRouter.post(
  '/sampling-qc/formulations/:versionId/authorize-compliance',
  withErpAccess('quality', 'approve', async (req, _res, actor) => {
    return {
      success: true,
      version: await authorizeFormulationComplianceTransaction(actor, { ...req.body, formulationVersionId: req.params.versionId })
    };
  }, 'erp_formulation_versions')
);

// 18. SALES CRM (11 CATEGORIES), CORPORATE PROPOSAL BUILDER, QUOTATIONS & 12-STAGE DEAL WORKFLOW
erpRouter.get(
  '/commercial/snapshot',
  withErpAccess('crm', 'view', async (_req, _res, actor) => {
    return getCommercialCrmWorkspaceSnapshot(actor);
  })
);

erpRouter.post(
  '/commercial/leads',
  withErpAccess('crm', 'create', async (req, _res, actor) => {
    return { success: true, lead: await upsertCrmLeadAdvanced(actor, req.body) };
  }, 'erp_leads')
);

erpRouter.post(
  '/commercial/leads/:id/contact',
  withErpAccess('crm', 'edit', async (req, _res, actor) => {
    return { success: true, ...(await logLeadContactAndTask(actor, req.params.id, req.body)) };
  }, 'erp_leads')
);

erpRouter.post(
  '/commercial/leads/:id/workflow',
  withErpAccess('crm', 'edit', async (req, _res, actor) => {
    return {
      success: true,
      lead: await advanceDealWorkflowStage(actor, req.params.id, req.body?.workflowStage, req.body?.notes)
    };
  }, 'erp_leads')
);

erpRouter.post(
  '/commercial/proposals',
  withErpAccess('proposals', 'create', async (req, _res, actor) => {
    return { success: true, ...(await saveProposalAdvanced(actor, req.body)) };
  }, 'erp_proposals')
);

erpRouter.post(
  '/commercial/proposals/:id/status',
  withErpAccess('proposals', 'edit', async (req, _res, actor) => {
    return { success: true, proposal: await updateProposalStatusAndAcceptance(actor, req.params.id, req.body) };
  }, 'erp_proposals')
);

erpRouter.get(
  '/commercial/proposals/:id/compare/:otherId',
  withErpAccess('proposals', 'view', async (req) => {
    return { success: true, comparison: await compareProposalVersions(req.params.id, req.params.otherId) };
  })
);

erpRouter.post(
  '/commercial/quotations',
  withErpAccess('sales', 'create', async (req, _res, actor) => {
    return { success: true, ...(await createOrUpdateQuotationAdvanced(actor, req.body)) };
  }, 'erp_quotations')
);

erpRouter.post(
  '/commercial/quotations/:id/status',
  withErpAccess('sales', 'edit', async (req, _res, actor) => {
    return { success: true, quotation: await approveOrAcceptQuotation(actor, req.params.id, req.body) };
  }, 'erp_quotations')
);

erpRouter.post(
  '/commercial/convert-to-order',
  withErpAccess('sales', 'create', async (req, _res, actor) => {
    return { success: true, ...(await convertCommercialToSalesOrder(actor, req.body)) };
  }, 'orders')
);

erpRouter.post(
  '/commercial/orders/:orderId/progress',
  withErpAccess('sales', 'edit', async (req, _res, actor) => {
    return { success: true, ...(await progressCommercialOrderWorkflow(actor, req.params.orderId, req.body)) };
  }, 'orders')
);

// 19. INTEGRATED GST BILLING & DOUBLE-ENTRY ACCOUNTING WORKSPACE ROUTES
erpRouter.get(
  '/gst-accounting/snapshot',
  withErpAccess('accounting', 'view', async (_req, _res, actor) => {
    return getGstAccountingWorkspaceSnapshot(actor);
  })
);

erpRouter.put(
  '/gst-accounting/config',
  withErpAccess('gst_billing', 'approve', async (req, _res, actor) => {
    return { success: true, organization: await updateGstAndPolicyConfig(actor, req.body) };
  }, 'erp_organizations')
);

erpRouter.post(
  '/gst-accounting/hsn-sac',
  withErpAccess('gst_billing', 'create', async (req, _res, actor) => {
    return { success: true, hsnRule: await upsertHsnSacRule(actor, req.body) };
  }, 'erp_hsn_sac_master')
);

erpRouter.post(
  '/gst-accounting/hsn-sac/:id/verify',
  withErpAccess('gst_billing', 'approve', async (req, _res, actor) => {
    return { success: true, hsnRule: await decideHsnSacVerification(actor, req.params.id, req.body?.action) };
  }, 'erp_hsn_sac_master')
);

erpRouter.post(
  '/gst-accounting/billing-documents',
  withErpAccess('gst_billing', 'create', async (req, _res, actor) => {
    return { success: true, ...(await createSalesBillingDocument(actor, req.body)) };
  }, 'erp_invoices')
);

erpRouter.post(
  '/gst-accounting/proformas/:id/convert',
  withErpAccess('gst_billing', 'create', async (req, _res, actor) => {
    return { success: true, ...(await convertProformaToTaxInvoice(actor, req.params.id)) };
  }, 'erp_invoices')
);

erpRouter.patch(
  '/gst-accounting/invoices/:id/statutory',
  withErpAccess('gst_billing', 'edit', async (req, _res, actor) => {
    return { success: true, invoice: await updateInvoiceStatutoryCompliance(actor, req.params.id, req.body) };
  }, 'erp_invoices')
);

erpRouter.post(
  '/gst-accounting/advances',
  withErpAccess('accounting', 'create', async (req, _res, actor) => {
    return { success: true, ...(await recordCustomerAdvanceReceipt(actor, req.body)) };
  }, 'erp_payments')
);

erpRouter.post(
  '/gst-accounting/payments',
  withErpAccess('accounting', 'create', async (req, _res, actor) => {
    return { success: true, ...(await recordAccountPaymentReceiptOrPayout(actor, req.body)) };
  }, 'erp_payments')
);

erpRouter.post(
  '/gst-accounting/sales-debit-notes',
  withErpAccess('gst_billing', 'create', async (req, _res, actor) => {
    return { success: true, ...(await issueSalesDebitNoteTransaction(actor, req.body)) };
  }, 'erp_sales_debit_notes')
);

erpRouter.post(
  '/gst-accounting/delivery-challans',
  withErpAccess('gst_billing', 'create', async (req, _res, actor) => {
    return { success: true, challan: await createDeliveryChallanTransaction(actor, req.body) };
  }, 'erp_delivery_challans')
);

erpRouter.post(
  '/gst-accounting/delivery-challans/:id/convert',
  withErpAccess('gst_billing', 'create', async (req, _res, actor) => {
    return { success: true, ...(await convertChallanToTaxInvoice(actor, req.params.id)) };
  }, 'erp_delivery_challans')
);

erpRouter.post(
  '/gst-accounting/sales-returns',
  withErpAccess('gst_billing', 'create', async (req, _res, actor) => {
    return { success: true, ...(await processSalesReturnTransaction(actor, req.body)) };
  }, 'erp_sales_returns')
);

erpRouter.post(
  '/gst-accounting/coa',
  withErpAccess('accounting', 'create', async (req, _res, actor) => {
    return { success: true, account: await upsertChartOfAccount(actor, req.body) };
  }, 'erp_chart_of_accounts')
);

erpRouter.post(
  '/gst-accounting/journals/:id/reverse',
  withErpAccess('accounting', 'approve', async (req, _res, actor) => {
    return { success: true, ...(await reverseAccountingJournalTransaction(actor, req.params.id, req.body?.reason)) };
  }, 'erp_accounting_journals')
);

erpRouter.post(
  '/gst-accounting/expenses',
  withErpAccess('accounting', 'create', async (req, _res, actor) => {
    return { success: true, ...(await recordExpenseOrPettyCashVoucher(actor, req.body)) };
  }, 'erp_expenses_and_petty_cash')
);

erpRouter.post(
  '/gst-accounting/bank-statements/import',
  withErpAccess('accounting', 'create', async (req, _res, actor) => {
    return { success: true, ...(await importBankStatementLines(actor, req.body)) };
  }, 'erp_bank_statements')
);

erpRouter.post(
  '/gst-accounting/bank-statements/:id/reconcile',
  withErpAccess('accounting', 'edit', async (req, _res, actor) => {
    return { success: true, line: await reconcileBankStatementLine(actor, req.params.id, req.body) };
  }, 'erp_bank_statements')
);

erpRouter.post(
  '/gst-accounting/verification/run',
  withErpAccess('accounting', 'view', async (_req, _res, actor) => {
    return { success: true, signoff: await runAccountingVerificationSuite(actor) };
  }, 'erp_accountant_signoffs')
);

erpRouter.post(
  '/gst-accounting/verification/:id/decide',
  withErpAccess('accounting', 'approve', async (req, _res, actor) => {
    return { success: true, signoff: await decideAccountingReadiness(actor, req.params.id, req.body) };
  }, 'erp_accountant_signoffs')
);

// 20. COLLABORATIVE MARKETING AGENCY, HR, INTERNSHIP & KANBAN WORKSPACE ROUTES
erpRouter.get('/agency-hr/snapshot', async (req, res) => {
  try {
    const actor = await getActorFromRequest(req);
    if (!actor.isSuperAdmin && !actor.permissions.marketing?.canView && !actor.permissions.hr?.canView) {
      assertErpPermission(actor, 'hr', 'view');
    }
    const snapshot = await getAgencyHrWorkspaceSnapshot(actor);
    res.json(snapshot);
  } catch (err) {
    handleErpError(res, err);
  }
});

erpRouter.post(
  '/agency-hr/brand-guard-check',
  withErpAccess('marketing', 'view', async (req) => {
    return { success: true, check: evaluateLuxuryBrandPhilosophy(req.body || {}) };
  })
);

erpRouter.post(
  '/agency-hr/agency-profile',
  withErpAccess('marketing', 'edit', async (req, _res, actor) => {
    return { success: true, profile: await upsertAgencyProfile(actor, req.body) };
  }, 'erp_agency_profiles')
);

erpRouter.post(
  '/agency-hr/agency-staff',
  withErpAccess('marketing', 'create', async (req, _res, actor) => {
    return { success: true, staff: await upsertAgencyStaff(actor, req.body) };
  }, 'erp_agency_staff')
);

erpRouter.post(
  '/agency-hr/campaigns',
  withErpAccess('marketing', 'create', async (req, _res, actor) => {
    return { success: true, campaign: await saveLuxuryCampaignPlan(actor, req.body) };
  }, 'campaigns')
);

erpRouter.post(
  '/agency-hr/creatives',
  withErpAccess('marketing', 'create', async (req, _res, actor) => {
    return { success: true, ...(await saveCreativeAssetWithRevision(actor, req.body)) };
  }, 'erp_marketing_workspace')
);

erpRouter.post(
  '/agency-hr/creatives/:id/stage',
  withErpAccess('marketing', 'view', async (req, _res, actor) => {
    // Founder approval checks happen inside transitionCreativeApprovalStage; agency creators can move DRAFT -> SUBMITTED
    if (!actor.isSuperAdmin && !actor.permissions.marketing?.canEdit && !actor.permissions.marketing?.canCreate) {
      assertErpPermission(actor, 'marketing', 'edit');
    }
    return { success: true, asset: await transitionCreativeApprovalStage(actor, req.params.id, req.body) };
  }, 'erp_marketing_workspace')
);

erpRouter.post(
  '/agency-hr/influencers',
  withErpAccess('marketing', 'create', async (req, _res, actor) => {
    return { success: true, influencer: await upsertInfluencerPartner(actor, req.body) };
  }, 'influencers')
);

erpRouter.post(
  '/agency-hr/seeding',
  withErpAccess('marketing', 'create', async (req, _res, actor) => {
    return { success: true, ...(await createInfluencerSeedingRequest(actor, req.body)) };
  }, 'erp_samples')
);

erpRouter.post(
  '/agency-hr/seeding/:sampleId/dispatch',
  withErpAccess('marketing', 'edit', async (req, _res, actor) => {
    return { success: true, sample: await updateSeedingDispatchAndFeedback(actor, { ...req.body, sampleId: req.params.sampleId }) };
  }, 'erp_samples')
);

erpRouter.post(
  '/agency-hr/agency-invoices',
  withErpAccess('marketing', 'create', async (req, _res, actor) => {
    return { success: true, invoice: await saveAgencyInvoice(actor, req.body) };
  }, 'erp_agency_invoices')
);

erpRouter.post(
  '/agency-hr/ad-sync',
  withErpAccess('marketing', 'view', async (_req, _res, actor) => {
    return { success: true, ...(await syncAuthorizedAdReporting(actor)) };
  })
);

erpRouter.post(
  '/agency-hr/interns',
  withErpAccess('hr', 'create', async (req, _res, actor) => {
    return { success: true, intern: await upsertInternProfile(actor, req.body) };
  }, 'erp_interns')
);

erpRouter.post(
  '/agency-hr/attendance',
  withErpAccess('hr', 'create', async (req, _res, actor) => {
    return { success: true, attendance: await recordInternAttendance(actor, req.body) };
  }, 'erp_intern_attendance')
);

erpRouter.post(
  '/agency-hr/submissions',
  withErpAccess('hr', 'create', async (req, _res, actor) => {
    return { success: true, submission: await submitInternWork(actor, req.body) };
  }, 'erp_intern_submissions')
);

erpRouter.post(
  '/agency-hr/submissions/:id/review',
  withErpAccess('hr', 'approve', async (req, _res, actor) => {
    return { success: true, submission: await reviewInternSubmission(actor, req.params.id, req.body) };
  }, 'erp_intern_submissions')
);

erpRouter.post(
  '/agency-hr/evaluations',
  withErpAccess('hr', 'approve', async (req, _res, actor) => {
    return { success: true, ...(await recordInternEvaluation(actor, req.body)) };
  }, 'erp_intern_evaluations')
);

erpRouter.post(
  '/agency-hr/tasks',
  withErpAccess('hr', 'create', async (req, _res, actor) => {
    return { success: true, task: await saveCollaborativeTask(actor, req.body) };
  }, 'erp_tasks')
);

erpRouter.post(
  '/agency-hr/tasks/:id/comments',
  withErpAccess('hr', 'view', async (req, _res, actor) => {
    return { success: true, comment: await addTaskComment(actor, req.params.id, req.body) };
  }, 'erp_task_comments')
);

// 21. CENTRALIZED REPORTING & DOCUMENT EXPORT ENGINE ROUTES (.XLSX, .PDF, PREVIEW, ASYNC JOBS & SIGNED DOWNLOADS)
erpRouter.get('/exports/catalog', async (req, res) => {
  try {
    const actor = await getActorFromRequest(req);
    const catalog = getReportCatalogForActor(actor);
    const jobs = await listExportJobs(actor);
    res.json({ actor, catalog, jobs });
  } catch (err) {
    handleErpError(res, err);
  }
});

erpRouter.post('/exports/preview', async (req, res) => {
  try {
    const actor = await getActorFromRequest(req);
    const preview = await previewReportData(actor, req.body || {});
    res.json(preview);
  } catch (err) {
    handleErpError(res, err);
  }
});

erpRouter.post('/exports/jobs', async (req, res) => {
  try {
    const actor = await getActorFromRequest(req);
    const result = await createExportJob(actor, req.body || {});
    res.status(result.queued ? 202 : 200).json({ success: true, ...result });
  } catch (err) {
    handleErpError(res, err);
  }
});

erpRouter.get('/exports/jobs', async (req, res) => {
  try {
    const actor = await getActorFromRequest(req);
    res.json({ jobs: await listExportJobs(actor) });
  } catch (err) {
    handleErpError(res, err);
  }
});

erpRouter.get('/exports/jobs/:id', async (req, res) => {
  try {
    const actor = await getActorFromRequest(req);
    res.json({ job: await getExportJobById(actor, req.params.id) });
  } catch (err) {
    handleErpError(res, err);
  }
});

erpRouter.post('/exports/jobs/:id/retry', async (req, res) => {
  try {
    const actor = await getActorFromRequest(req);
    const result = await retryExportJob(actor, req.params.id);
    res.json({ success: true, ...result });
  } catch (err) {
    handleErpError(res, err);
  }
});

erpRouter.get('/exports/download/:id', async (req, res) => {
  try {
    const actor = await getActorFromRequest(req);
    const token = String(req.query.token || '');
    const verified = await verifyAndReadExportDownload(actor, req.params.id, token);
    res.setHeader('Content-Type', verified.mimeType);
    res.setHeader('Content-Length', String(verified.sizeBytes));
    res.setHeader('Content-Disposition', `attachment; filename="${verified.fileName}"`);
    res.setHeader('Cache-Control', 'no-store');
    const stream = fs.createReadStream(verified.storagePath);
    stream.on('error', (err) => {
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      }
    });
    stream.pipe(res);
  } catch (err) {
    handleErpError(res, err);
  }
});

// 22. CONFIGURABLE ERP ALERTS AUTOMATION & FINAL 10-WORKFLOW SYSTEM AUDIT ROUTES
erpRouter.get('/alerts/live', async (req, res) => {
  try {
    const actor = await getActorFromRequest(req);
    res.json(await evaluateAndSyncErpAlerts(actor));
  } catch (err) {
    handleErpError(res, err);
  }
});

erpRouter.post('/alerts/sync', async (req, res) => {
  try {
    const actor = await getActorFromRequest(req);
    res.json({ success: true, ...(await evaluateAndSyncErpAlerts(actor, { syncNotifications: true })) });
  } catch (err) {
    handleErpError(res, err);
  }
});

erpRouter.put('/alerts/rules/:ruleKey', async (req, res) => {
  try {
    const actor = await getActorFromRequest(req);
    const rule = await updateErpAlertRule(actor, req.params.ruleKey, req.body || {});
    res.json({ success: true, rule });
  } catch (err) {
    handleErpError(res, err);
  }
});

erpRouter.get(
  '/system-audit/latest',
  withErpAccess('executive', 'view', async () => {
    return { report: getLatestSystemVerificationReport() };
  })
);

erpRouter.post('/system-audit/run-10-workflows', async (req, res) => {
  try {
    const actor = await getActorFromRequest(req);
    const report = await runFinalErpSystemVerificationSuite(actor);
    res.json({ success: true, report });
  } catch (err) {
    handleErpError(res, err);
  }
});
