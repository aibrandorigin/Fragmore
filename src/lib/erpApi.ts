import { auth } from './firebase';

export interface ErpPermissionRow {
  id: string;
  roleId: string;
  moduleKey: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canApprove: boolean;
  canDelete: boolean;
  canExport: boolean;
}

export interface ErpActorContext {
  email: string;
  displayName: string;
  roleId: string;
  roleCode: string;
  roleName: string;
  departmentCode: string;
  isSuperAdmin: boolean;
  permissions: Record<
    string,
    {
      canView: boolean;
      canCreate: boolean;
      canEdit: boolean;
      canApprove: boolean;
      canDelete: boolean;
      canExport: boolean;
    }
  >;
}

export interface ErpWorkspaceSnapshot {
  actor: ErpActorContext;
  organization: any;
  departments: any[];
  roles: any[];
  permissions: ErpPermissionRow[];
  userAccess: any[];
  warehouses: any[];
  materials: any[];
  goodsReceipts: any[];
  stockLots: any[];
  formulations: any[];
  formulationVersions: any[];
  samples: any[];
  qcRecords: any[];
  finishedGoods: any[];
  leads: any[];
  proposals: any[];
  quotations: any[];
  invoices: any[];
  creditNotes: any[];
  payments: any[];
  journals: any[];
  financialSummary: {
    accounts: Array<{
      accountCode: string;
      accountName: string;
      accountType: string;
      debitInr: number;
      creditInr: number;
      netBalanceInr: number;
    }>;
    totalDebits: number;
    totalCredits: number;
    isBalanced: boolean;
    totalRevenueInr: number;
    totalExpenseInr: number;
    netProfitInr: number;
  };
  marketingWorkspace: any[];
  employees: any[];
  interns: any[];
  tasks: any[];
  approvals: any[];
  attachments: any[];
  notifications: any[];
  procurement: {
    purchaseOrders: any[];
    suppliers: any[];
  };
  batches: any[];
  commerceSummary: {
    storeOrdersCount: number;
    storeCustomersCount: number;
    storeProductsCount: number;
    storeCampaignsCount: number;
    totalOrderRevenueInr: number;
    totalInvoicedInr: number;
    accountsReceivableInr: number;
    accountsPayableInr: number;
    lowStockMaterialsCount: number;
    pendingApprovalsCount: number;
    unreadNotificationsCount: number;
  };
}

let activeErpRoleOverride: string = '';

export function setActiveErpRoleOverride(roleCode: string) {
  activeErpRoleOverride = roleCode;
}

export function getActiveErpRoleOverride(): string {
  return activeErpRoleOverride;
}

async function buildErpHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  try {
    const savedRole = localStorage.getItem('fragmore_admin_role_v1');
    const savedCustomer = localStorage.getItem('fragmore_customer_v1');
    if (savedRole) headers['x-admin-role'] = savedRole;
    if (savedCustomer) {
      const parsed = JSON.parse(savedCustomer);
      if (parsed?.email) headers['x-admin-email'] = parsed.email;
    }
    if (activeErpRoleOverride) {
      headers['x-erp-role-code'] = activeErpRoleOverride;
    }
  } catch {
    // Non-fatal
  }
  try {
    const user = auth.currentUser;
    if (user) {
      headers['Authorization'] = `Bearer ${await user.getIdToken()}`;
    }
  } catch {
    // Non-fatal
  }
  return headers;
}

async function erpFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = await buildErpHeaders();
  const res = await fetch(`/api/erp${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `ERP request failed (${res.status})`);
  }
  return data;
}

export const erpApi = {
  getBootstrap: (): Promise<ErpWorkspaceSnapshot> => erpFetch('/bootstrap'),
  createWarehouse: (payload: any) => erpFetch('/warehouses', { method: 'POST', body: JSON.stringify(payload) }),
  saveMaterial: (payload: any) => erpFetch('/materials', { method: 'POST', body: JSON.stringify(payload) }),
  postGoodsReceipt: (payload: any) => erpFetch('/goods-receipts', { method: 'POST', body: JSON.stringify(payload) }),
  saveFormulation: (payload: any) => erpFetch('/formulations', { method: 'POST', body: JSON.stringify(payload) }),
  createSample: (payload: any) => erpFetch('/samples', { method: 'POST', body: JSON.stringify(payload) }),
  createQcRecord: (payload: any) => erpFetch('/qc-records', { method: 'POST', body: JSON.stringify(payload) }),
  adjustFinishedGood: (id: string, payload: any) => erpFetch(`/finished-goods/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  saveLead: (payload: any) => erpFetch('/leads', { method: 'POST', body: JSON.stringify(payload) }),
  convertLead: (id: string) => erpFetch(`/leads/${id}/convert`, { method: 'POST', body: JSON.stringify({}) }),
  createProposal: (payload: any) => erpFetch('/proposals', { method: 'POST', body: JSON.stringify(payload) }),
  createQuotation: (payload: any) => erpFetch('/quotations', { method: 'POST', body: JSON.stringify(payload) }),
  createInvoice: (payload: any) => erpFetch('/invoices', { method: 'POST', body: JSON.stringify(payload) }),
  issueCreditNote: (payload: any) => erpFetch('/credit-notes', { method: 'POST', body: JSON.stringify(payload) }),
  recordPayment: (payload: any) => erpFetch('/payments', { method: 'POST', body: JSON.stringify(payload) }),
  createJournal: (payload: any) => erpFetch('/journals', { method: 'POST', body: JSON.stringify(payload) }),
  createMarketingBrief: (payload: any) => erpFetch('/marketing-workspace', { method: 'POST', body: JSON.stringify(payload) }),
  createEmployee: (payload: any) => erpFetch('/employees', { method: 'POST', body: JSON.stringify(payload) }),
  createIntern: (payload: any) => erpFetch('/interns', { method: 'POST', body: JSON.stringify(payload) }),
  saveTask: (payload: any) =>
    payload.id
      ? erpFetch(`/tasks/${payload.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
      : erpFetch('/tasks', { method: 'POST', body: JSON.stringify(payload) }),
  decideApproval: (id: string, decision: 'APPROVED' | 'REJECTED', note?: string) =>
    erpFetch(`/approvals/${id}/decide`, { method: 'POST', body: JSON.stringify({ decision, note }) }),
  markNotificationRead: (id: string) => erpFetch(`/notifications/${id}/read`, { method: 'POST', body: JSON.stringify({}) }),
  addAttachment: (payload: any) => erpFetch('/attachments', { method: 'POST', body: JSON.stringify(payload) }),
  updatePermission: (payload: any) => erpFetch('/rbac/permissions', { method: 'PUT', body: JSON.stringify(payload) }),
  assignUserAccess: (payload: any) => erpFetch('/rbac/users', { method: 'POST', body: JSON.stringify(payload) }),
  updateOrganization: (payload: any) => erpFetch('/organization', { method: 'PUT', body: JSON.stringify(payload) }),
  search: (q: string): Promise<{ results: any[] }> => erpFetch(`/search?q=${encodeURIComponent(q)}`),
  importCsv: (targetEntity: 'materials' | 'leads', rows: any[]) =>
    erpFetch('/import', { method: 'POST', body: JSON.stringify({ targetEntity, rows }) }),
  getAssistantBootstrap: () => erpFetch('/assistant/bootstrap'),
  askAssistant: (prompt: string) => erpFetch('/assistant/query', { method: 'POST', body: JSON.stringify({ prompt }) }),
  confirmAssistantAction: (id: string) =>
    erpFetch(`/assistant/confirm/${encodeURIComponent(id)}`, { method: 'POST', body: JSON.stringify({}) }),
  cancelAssistantAction: (id: string) =>
    erpFetch(`/assistant/cancel/${encodeURIComponent(id)}`, { method: 'POST', body: JSON.stringify({}) }),
  evaluateLiveAlerts: () => erpFetch('/alerts/live'),
  syncLiveAlertsToNotifications: () => erpFetch('/alerts/sync', { method: 'POST', body: JSON.stringify({}) }),
  updateAlertRule: (ruleKey: string, payload: any) =>
    erpFetch(`/alerts/rules/${encodeURIComponent(ruleKey)}`, { method: 'PUT', body: JSON.stringify(payload) }),
  getLatestSystemAudit: () => erpFetch('/system-audit/latest'),
  runFinal10WorkflowAudit: () =>
    erpFetch('/system-audit/run-10-workflows', { method: 'POST', body: JSON.stringify({}) }),

  // FRAGMORÉ Procurement Management OS
  getProcurementSnapshot: (): Promise<ErpProcurementSnapshot> => erpFetch('/procurement/snapshot'),
  upsertProcurementSupplier: (payload: any) =>
    erpFetch('/procurement/suppliers', { method: 'POST', body: JSON.stringify(payload) }),
  createPurchaseRequisition: (payload: any) =>
    erpFetch('/procurement/requisitions', { method: 'POST', body: JSON.stringify(payload) }),
  createProcurementRfq: (payload: any) =>
    erpFetch('/procurement/rfqs', { method: 'POST', body: JSON.stringify(payload) }),
  recordSupplierQuotation: (payload: any) =>
    erpFetch('/procurement/quotations', { method: 'POST', body: JSON.stringify(payload) }),
  awardQuotationToPo: (quotationId: string) =>
    erpFetch(`/procurement/quotations/${quotationId}/award`, { method: 'POST', body: JSON.stringify({}) }),
  createProcurementPo: (payload: any) =>
    erpFetch('/procurement/purchase-orders', { method: 'POST', body: JSON.stringify(payload) }),
  cancelProcurementPo: (poId: string, reason: string) =>
    erpFetch(`/procurement/purchase-orders/${poId}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
  createProcurementGrn: (payload: any) =>
    erpFetch('/procurement/grns', { method: 'POST', body: JSON.stringify(payload) }),
  inspectProcurementGrn: (grnId: string, payload: any) =>
    erpFetch(`/procurement/grns/${grnId}/inspect`, { method: 'POST', body: JSON.stringify(payload) }),
  postVendorInvoice: (payload: any) =>
    erpFetch('/procurement/vendor-invoices', { method: 'POST', body: JSON.stringify(payload) }),
  approveVendorInvoice: (invoiceId: string) =>
    erpFetch(`/procurement/vendor-invoices/${invoiceId}/approve`, { method: 'POST', body: JSON.stringify({}) }),
  issueDebitNote: (payload: any) =>
    erpFetch('/procurement/debit-notes', { method: 'POST', body: JSON.stringify(payload) }),
  recordSupplierPayment: (payload: any) =>
    erpFetch('/procurement/payments', { method: 'POST', body: JSON.stringify(payload) }),

  // FRAGMORÉ Advanced Inventory & Perfume Manufacturing OS
  getManufacturingSnapshot: (): Promise<ErpManufacturingSnapshot> => erpFetch('/manufacturing/snapshot'),
  saveManufacturingMaterial: (payload: any) =>
    erpFetch('/manufacturing/materials', { method: 'POST', body: JSON.stringify(payload) }),
  convertMaterialUnits: (payload: {
    qty: number;
    fromUom: string;
    toUom: string;
    densityGPerMl?: number | null;
    densityValidated?: boolean;
    materialName?: string;
  }) => erpFetch('/manufacturing/convert-units', { method: 'POST', body: JSON.stringify(payload) }),
  postStockMovement: (payload: any) =>
    erpFetch('/manufacturing/stock-movements', { method: 'POST', body: JSON.stringify(payload) }),
  saveFormulationAdvanced: (payload: any) =>
    erpFetch('/manufacturing/formulations', { method: 'POST', body: JSON.stringify(payload) }),
  createBatchPlan: (payload: any) =>
    erpFetch('/manufacturing/batches', { method: 'POST', body: JSON.stringify(payload) }),
  advanceBatchStage: (batchId: string, payload: any) =>
    erpFetch(`/manufacturing/batches/${batchId}/stage`, { method: 'POST', body: JSON.stringify(payload) }),
  recordBatchRework: (batchId: string, payload: any) =>
    erpFetch(`/manufacturing/batches/${batchId}/rework`, { method: 'POST', body: JSON.stringify(payload) }),
  getBatchTraceability: (batchId: string) =>
    erpFetch(`/manufacturing/batches/${batchId}/traceability`),
  createOnceEdition: (payload: any) =>
    erpFetch('/manufacturing/once-editions', { method: 'POST', body: JSON.stringify(payload) }),
  launchOnceCampaign: (editionId: string, payload: any = {}) =>
    erpFetch(`/manufacturing/once-editions/${editionId}/launch`, { method: 'POST', body: JSON.stringify(payload) }),
  closeOnceEdition: (editionId: string, notes?: string) =>
    erpFetch(`/manufacturing/once-editions/${editionId}/close`, { method: 'POST', body: JSON.stringify({ notes }) }),

  // FRAGMORÉ Sampling, R&D & Quality Control OS
  getSamplingQcSnapshot: (): Promise<ErpSamplingQcSnapshot> => erpFetch('/sampling-qc/snapshot'),
  createSampleRequest: (payload: any) =>
    erpFetch('/sampling-qc/samples', { method: 'POST', body: JSON.stringify(payload) }),
  advanceSampleWorkflow: (sampleId: string, payload: any) =>
    erpFetch(`/sampling-qc/samples/${sampleId}/workflow`, { method: 'POST', body: JSON.stringify(payload) }),
  linkSampleConversion: (sampleId: string, payload: any) =>
    erpFetch(`/sampling-qc/samples/${sampleId}/conversion`, { method: 'POST', body: JSON.stringify(payload) }),
  upsertQcChecklist: (payload: any) =>
    erpFetch('/sampling-qc/checklists', { method: 'POST', body: JSON.stringify(payload) }),
  recordDetailedQc: (payload: any) =>
    erpFetch('/sampling-qc/qc-records', { method: 'POST', body: JSON.stringify(payload) }),
  authorizeFormulationCompliance: (versionId: string, payload: any) =>
    erpFetch(`/sampling-qc/formulations/${versionId}/authorize-compliance`, { method: 'POST', body: JSON.stringify(payload) }),

  // FRAGMORÉ Sales CRM (11 Categories), Corporate Proposal Builder & Quotations OS
  getCommercialSnapshot: (): Promise<ErpCommercialCrmSnapshot> => erpFetch('/commercial/snapshot'),
  saveCommercialLead: (payload: any) =>
    erpFetch('/commercial/leads', { method: 'POST', body: JSON.stringify(payload) }),
  logCommercialLeadContact: (leadId: string, payload: any) =>
    erpFetch(`/commercial/leads/${leadId}/contact`, { method: 'POST', body: JSON.stringify(payload) }),
  advanceCommercialLeadWorkflow: (leadId: string, workflowStage: string, notes?: string) =>
    erpFetch(`/commercial/leads/${leadId}/workflow`, { method: 'POST', body: JSON.stringify({ workflowStage, notes }) }),
  saveCommercialProposal: (payload: any) =>
    erpFetch('/commercial/proposals', { method: 'POST', body: JSON.stringify(payload) }),
  updateCommercialProposalStatus: (proposalId: string, payload: any) =>
    erpFetch(`/commercial/proposals/${proposalId}/status`, { method: 'POST', body: JSON.stringify(payload) }),
  compareProposalVersions: (proposalIdA: string, proposalIdB: string) =>
    erpFetch(`/commercial/proposals/${proposalIdA}/compare/${proposalIdB}`),
  saveCommercialQuotation: (payload: any) =>
    erpFetch('/commercial/quotations', { method: 'POST', body: JSON.stringify(payload) }),
  updateCommercialQuotationStatus: (quotationId: string, payload: any) =>
    erpFetch(`/commercial/quotations/${quotationId}/status`, { method: 'POST', body: JSON.stringify(payload) }),
  convertCommercialToOrder: (payload: { proposalId?: string; quotationId?: string; shippingAddress?: any; notes?: string }) =>
    erpFetch('/commercial/convert-to-order', { method: 'POST', body: JSON.stringify(payload) }),
  progressCommercialOrder: (orderId: string, payload: any) =>
    erpFetch(`/commercial/orders/${orderId}/progress`, { method: 'POST', body: JSON.stringify(payload) }),

  // FRAGMORÉ Integrated GST Billing & Double-Entry Accounting OS
  getGstAccountingSnapshot: (): Promise<ErpGstAccountingSnapshot> => erpFetch('/gst-accounting/snapshot'),
  updateGstAndPolicyConfig: (payload: any) =>
    erpFetch('/gst-accounting/config', { method: 'PUT', body: JSON.stringify(payload) }),
  upsertHsnSacRule: (payload: any) =>
    erpFetch('/gst-accounting/hsn-sac', { method: 'POST', body: JSON.stringify(payload) }),
  verifyHsnSacRule: (id: string, action: 'ADMIN_APPROVE' | 'ACCOUNTANT_VERIFY') =>
    erpFetch(`/gst-accounting/hsn-sac/${id}/verify`, { method: 'POST', body: JSON.stringify({ action }) }),
  createSalesBillingDoc: (payload: any) =>
    erpFetch('/gst-accounting/billing-documents', { method: 'POST', body: JSON.stringify(payload) }),
  convertProformaToInvoice: (proformaId: string) =>
    erpFetch(`/gst-accounting/proformas/${proformaId}/convert`, { method: 'POST', body: JSON.stringify({}) }),
  updateInvoiceStatutory: (invoiceId: string, payload: any) =>
    erpFetch(`/gst-accounting/invoices/${invoiceId}/statutory`, { method: 'PATCH', body: JSON.stringify(payload) }),
  recordCustomerAdvance: (payload: any) =>
    erpFetch('/gst-accounting/advances', { method: 'POST', body: JSON.stringify(payload) }),
  recordAccountPayment: (payload: any) =>
    erpFetch('/gst-accounting/payments', { method: 'POST', body: JSON.stringify(payload) }),
  issueSalesDebitNote: (payload: any) =>
    erpFetch('/gst-accounting/sales-debit-notes', { method: 'POST', body: JSON.stringify(payload) }),
  createDeliveryChallan: (payload: any) =>
    erpFetch('/gst-accounting/delivery-challans', { method: 'POST', body: JSON.stringify(payload) }),
  convertChallanToInvoice: (challanId: string) =>
    erpFetch(`/gst-accounting/delivery-challans/${challanId}/convert`, { method: 'POST', body: JSON.stringify({}) }),
  processSalesReturn: (payload: any) =>
    erpFetch('/gst-accounting/sales-returns', { method: 'POST', body: JSON.stringify(payload) }),
  upsertChartOfAccount: (payload: any) =>
    erpFetch('/gst-accounting/coa', { method: 'POST', body: JSON.stringify(payload) }),
  reverseAccountingJournal: (journalId: string, reason: string) =>
    erpFetch(`/gst-accounting/journals/${journalId}/reverse`, { method: 'POST', body: JSON.stringify({ reason }) }),
  recordExpenseOrPettyCash: (payload: any) =>
    erpFetch('/gst-accounting/expenses', { method: 'POST', body: JSON.stringify(payload) }),
  importBankStatement: (payload: any) =>
    erpFetch('/gst-accounting/bank-statements/import', { method: 'POST', body: JSON.stringify(payload) }),
  reconcileBankLine: (lineId: string, payload: any) =>
    erpFetch(`/gst-accounting/bank-statements/${lineId}/reconcile`, { method: 'POST', body: JSON.stringify(payload) }),
  runAccountingVerification: () =>
    erpFetch('/gst-accounting/verification/run', { method: 'POST', body: JSON.stringify({}) }),
  decideAccountingReadiness: (signoffId: string, payload: { decision: 'ACCEPTED_PRODUCTION_READY' | 'REJECTED_NEEDS_CORRECTION'; notes?: string }) =>
    erpFetch(`/gst-accounting/verification/${signoffId}/decide`, { method: 'POST', body: JSON.stringify(payload) }),

  // FRAGMORÉ Collaborative Marketing Agency, HR, Internship & Kanban Workspace
  getAgencyHrSnapshot: (): Promise<ErpAgencyHrSnapshot> => erpFetch('/agency-hr/snapshot'),
  checkBrandGuard: (payload: any) =>
    erpFetch('/agency-hr/brand-guard-check', { method: 'POST', body: JSON.stringify(payload) }),
  saveAgencyProfile: (payload: any) =>
    erpFetch('/agency-hr/agency-profile', { method: 'POST', body: JSON.stringify(payload) }),
  saveAgencyStaff: (payload: any) =>
    erpFetch('/agency-hr/agency-staff', { method: 'POST', body: JSON.stringify(payload) }),
  saveLuxuryCampaign: (payload: any) =>
    erpFetch('/agency-hr/campaigns', { method: 'POST', body: JSON.stringify(payload) }),
  saveCreativeAsset: (payload: any) =>
    erpFetch('/agency-hr/creatives', { method: 'POST', body: JSON.stringify(payload) }),
  transitionCreativeStage: (assetId: string, payload: { targetStage: string; feedback?: string }) =>
    erpFetch(`/agency-hr/creatives/${assetId}/stage`, { method: 'POST', body: JSON.stringify(payload) }),
  saveInfluencerPartner: (payload: any) =>
    erpFetch('/agency-hr/influencers', { method: 'POST', body: JSON.stringify(payload) }),
  createSeedingRequest: (payload: any) =>
    erpFetch('/agency-hr/seeding', { method: 'POST', body: JSON.stringify(payload) }),
  updateSeedingDispatch: (sampleId: string, payload: any) =>
    erpFetch(`/agency-hr/seeding/${sampleId}/dispatch`, { method: 'POST', body: JSON.stringify(payload) }),
  saveAgencyInvoice: (payload: any) =>
    erpFetch('/agency-hr/agency-invoices', { method: 'POST', body: JSON.stringify(payload) }),
  syncAdReporting: () =>
    erpFetch('/agency-hr/ad-sync', { method: 'POST', body: JSON.stringify({}) }),
  saveInternProfile: (payload: any) =>
    erpFetch('/agency-hr/interns', { method: 'POST', body: JSON.stringify(payload) }),
  recordInternAttendance: (payload: any) =>
    erpFetch('/agency-hr/attendance', { method: 'POST', body: JSON.stringify(payload) }),
  submitInternWork: (payload: any) =>
    erpFetch('/agency-hr/submissions', { method: 'POST', body: JSON.stringify(payload) }),
  reviewInternSubmission: (submissionId: string, payload: { decision: 'UNDER_REVIEW' | 'CHANGES_REQUESTED' | 'APPROVED'; feedback?: string }) =>
    erpFetch(`/agency-hr/submissions/${submissionId}/review`, { method: 'POST', body: JSON.stringify(payload) }),
  recordInternEvaluation: (payload: any) =>
    erpFetch('/agency-hr/evaluations', { method: 'POST', body: JSON.stringify(payload) }),
  saveCollabTask: (payload: any) =>
    erpFetch('/agency-hr/tasks', { method: 'POST', body: JSON.stringify(payload) }),
  addTaskComment: (taskId: string, payload: { commentText: string; attachmentUrl?: string }) =>
    erpFetch(`/agency-hr/tasks/${taskId}/comments`, { method: 'POST', body: JSON.stringify(payload) }),

  // FRAGMORÉ Centralized Reporting & Document Export Engine (.XLSX & .PDF)
  getExportCatalog: (): Promise<{ actor: ErpActorContext; catalog: any[]; jobs: any[] }> =>
    erpFetch('/exports/catalog'),
  previewReport: (payload: { reportKey: string; filters?: any }) =>
    erpFetch('/exports/preview', { method: 'POST', body: JSON.stringify(payload) }),
  createExportJob: (payload: { reportKey: string; format: 'XLSX' | 'PDF'; asyncMode?: boolean; filters?: any }) =>
    erpFetch('/exports/jobs', { method: 'POST', body: JSON.stringify(payload) }),
  listExportJobs: (): Promise<{ jobs: any[] }> =>
    erpFetch('/exports/jobs'),
  getExportJob: (jobId: string): Promise<{ job: any }> =>
    erpFetch(`/exports/jobs/${jobId}`),
  retryExportJob: (jobId: string) =>
    erpFetch(`/exports/jobs/${jobId}/retry`, { method: 'POST', body: JSON.stringify({}) })
};

export interface ErpSamplingQcSnapshot {
  actor: ErpActorContext;
  purposes: Array<{ code: string; label: string; defaultRecipientType: string }>;
  workflowStages: string[];
  checklists: any[];
  samples: any[];
  sampleEvents: any[];
  qcRecords: any[];
  formulations: any[];
  formulationVersions: any[];
  materials: any[];
  lots: any[];
  sampleMovements: any[];
  batches: any[];
  leads: any[];
  marketingWorkspace: any[];
  influencerDeliverables: any[];
  customers: any[];
  orders: any[];
  reports: {
    sampleDevelopmentHistory: any[];
    sampleConsumption: {
      totalSampleUnits: number;
      totalSampleVolumeMl: number;
      stockLedgerIssuesCount: number;
      byPurpose: Array<{ purpose: string; label: string; samplesCount: number; unitsConsumed: number; volumeMl: number; totalCostInr: number }>;
    };
    qcRejectionStats: {
      totalQc: number;
      passedQc: number;
      failedQc: number;
      quarantinedQc: number;
      qcRejectionRatePct: number;
      openCapasCount: number;
    };
    pendingFeedbackList: any[];
    influencerSampleCostReport: {
      count: number;
      totalSpendInr: number;
      rows: any[];
    };
    retailerSampleConversion: {
      totalCommercialSamples: number;
      convertedCount: number;
      conversionRatePct: number;
      totalSampleCostInr: number;
      totalConversionRevenueInr: number;
      roiMultiple: number;
      rows: any[];
    };
    rdExpenditure: {
      rawMaterialCostInr: number;
      vialCostInr: number;
      labelCostInr: number;
      packagingCostInr: number;
      shippingCostInr: number;
      handlingCostInr: number;
      grandTotalInr: number;
    };
  };
}

export interface ErpManufacturingSnapshot {
  actor: ErpActorContext;
  materials: any[];
  lots: any[];
  movements: any[];
  warehouses: any[];
  formulations: any[];
  formulationVersions: any[];
  batches: any[];
  batchEvents: any[];
  qcRecords: any[];
  finishedGoods: any[];
  onceEditions: any[];
  onceSerialsCountByEdition: Record<string, number>;
  onceSerialsPreview: any[];
  kpis: {
    totalMaterials: number;
    totalActiveLots: number;
    totalMovements: number;
    lowStockCount: number;
    missingDensityFluidsCount: number;
    activeBatchesCount: number;
    releasedBatchesCount: number;
    onceEditionsCount: number;
    onceClosedCount: number;
    valuationByCategory: Record<string, number>;
  };
}

export interface ErpProcurementSnapshot {
  categories: Array<{ code: string; label: string }>;
  suppliers: any[];
  requisitions: any[];
  rfqs: any[];
  supplierQuotations: any[];
  purchaseOrders: any[];
  goodsReceipts: any[];
  vendorInvoices: any[];
  debitNotes: any[];
  vendorPayments: any[];
  materials: any[];
  warehouses: any[];
  batches: any[];
  qcRecords: any[];
  attachments: any[];
  reorderAlerts: any[];
  kpis: {
    totalSpendInr: number;
    activePosCount: number;
    openRequisitionsCount: number;
    openRfqsCount: number;
    pendingQcGrnsCount: number;
    totalOutstandingApInr: number;
    totalAdvancePaidInr: number;
    lowStockAlertsCount: number;
    avgSupplierOnTimePct: number;
  };
}

export interface ErpCommercialCrmSnapshot {
  actor: { email: string; roleCode: string; canApprovePricing: boolean };
  customerCategories: Array<{ code: string; label: string }>;
  proposalTypes: Array<{ code: string; label: string }>;
  workflowStages: string[];
  leadSources: string[];
  catalogue: Array<{
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
  }>;
  leads: any[];
  proposals: any[];
  quotations: any[];
  invoices: any[];
  b2bOrders: any[];
  pricingAuditLogs: any[];
  dealActivities: any[];
  crmTasks: any[];
  teamAssignees: Array<{ email: string; displayName: string; roleCode: string }>;
  attachments: any[];
  analytics: {
    totalLeads: number;
    totalPipelineInr: number;
    weightedPipelineInr: number;
    wonDealsCount: number;
    conversionRatePct: number;
    proposalsCount: number;
    acceptedProposalsCount: number;
    quotationsCount: number;
    pendingApprovalsCount: number;
    overdueRemindersCount: number;
    byCategory: Array<{ categoryCode: string; label: string; count: number; totalValueInr: number; weightedValueInr: number }>;
    stageFunnel: Array<{ stage: string; count: number; valueInr: number }>;
    quotationMargins: Array<{
      quotationId: string;
      quotationNumber: string;
      clientName: string;
      netRevenueInr: number;
      estimatedCogsInr: number;
      grossMarginInr: number;
      grossMarginPct: number;
    }>;
  };
}

export interface ErpGstAccountingSnapshot {
  actor: {
    email: string;
    roleCode: string;
    canApprove: boolean;
    canEditGst: boolean;
  };
  organization: any;
  indianStates: Array<{ code: string; name: string }>;
  sequences: any[];
  chartOfAccounts: any[];
  hsnSacMaster: any[];
  invoices: any[];
  creditNotes: any[];
  salesDebitNotes: any[];
  deliveryChallans: any[];
  salesReturns: any[];
  payments: any[];
  journals: any[];
  glLedgerEntries: Array<{
    journalId: string;
    journalNumber: string;
    entryDate: string;
    sourceModule: string;
    narration: string;
    accountCode: string;
    accountName: string;
    accountType: string;
    debitInr: number;
    creditInr: number;
    isReversal: boolean;
  }>;
  expenses: any[];
  bankStatements: any[];
  vendorInvoices: any[];
  vendorDebitNotes: any[];
  purchaseOrders: any[];
  signoffs: any[];
  storeOrders: any[];
  storeCustomers: any[];
  customerLedgers: Array<{
    customerName: string;
    customerEmail: string;
    invoicedInr: number;
    debitNotesInr: number;
    paidInr: number;
    creditNotesInr: number;
    advanceRemainingInr: number;
    balanceDueInr: number;
  }>;
  supplierLedgers: Array<{
    supplierId: string;
    supplierCode: string;
    supplierName: string;
    gstin: string | null;
    totalBilledInr: number;
    totalPaidInr: number;
    totalDebitNotesInr: number;
    outstandingPayableInr: number;
  }>;
  financialStatements: {
    trialBalance: {
      accounts: Array<{
        accountCode: string;
        accountName: string;
        accountType: string;
        subGroup: string;
        debitInr: number;
        creditInr: number;
        netBalanceInr: number;
        netPaise: number;
      }>;
      totalDebitsInr: number;
      totalCreditsInr: number;
      isBalanced: boolean;
      unbalancedJournalsCount: number;
    };
    profitAndLoss: {
      revenueLines: any[];
      totalRevenueInr: number;
      cogsLines: any[];
      totalCogsInr: number;
      grossProfitInr: number;
      opexLines: any[];
      totalOpexInr: number;
      netProfitInr: number;
    };
    balanceSheet: {
      assetLines: any[];
      totalAssetsInr: number;
      liabilityLines: any[];
      totalLiabilitiesInr: number;
      equityLines: any[];
      shareCapitalInr: number;
      currentPeriodEarningsInr: number;
      totalLiabilitiesAndEquityInr: number;
      isBalanced: boolean;
    };
    cashFlow: {
      receiptsFromCustomersInr: number;
      paymentsToSuppliersInr: number;
      operatingExpensesPaidInr: number;
      otherOperatingCashInr: number;
      netOperatingCashFlowInr: number;
      financingCapitalInflowInr: number;
      closingCashAndBankInr: number;
    };
    cashAndBankBooks: Array<{
      accountCode: string;
      accountName: string;
      debitTotalInr: number;
      creditTotalInr: number;
      closingBalanceInr: number;
      entriesCount: number;
    }>;
    inventoryValuation: {
      policy: string;
      rmLotsPhysicalValuationInr: number;
      wipFloorValuationInr: number;
      fgBinsPhysicalValuationInr: number;
      gl1200BalanceInr: number;
      gl1210BalanceInr: number;
      gl1220BalanceInr: number;
      glCogs5000Inr: number;
    };
    bankReconciliation: {
      glBankBookBalanceInr: number;
      latestStatementBalanceInr: number;
      matchedCount: number;
      unmatchedCount: number;
      unreconciledPaymentsCount: number;
    };
  };
  gstRegisters: {
    outputTaxSummary: {
      taxableSalesInr: number;
      outputCgstInr: number;
      outputSgstInr: number;
      outputIgstInr: number;
      b2bCount: number;
      b2cCount: number;
      proformaCount: number;
    };
    inputTaxSummary: {
      taxablePurchasesInr: number;
      inputCgstInr: number;
      inputSgstInr: number;
      inputIgstInr: number;
    };
    totalOutputGstInr: number;
    totalInputGstInr: number;
    netGstPayableInr: number;
    hsnSummary: Array<{
      hsnCode: string;
      totalQty: number;
      taxableValueInr: number;
      cgstInr: number;
      sgstInr: number;
      igstInr: number;
      totalInr: number;
    }>;
  };
}

export interface ErpAgencyHrSnapshot {
  actor: ErpActorContext;
  securityBoundary: {
    isInternRestricted: boolean;
    canSeeSensitiveFinancials: boolean;
    canSeeFormulations: boolean;
    activeFormulationsCount: number;
  };
  agencyProfiles: any[];
  agencyStaff: any[];
  agencyInvoices: any[];
  campaigns: any[];
  marketingAssets: any[];
  creativeRevisions: any[];
  influencers: any[];
  influencerDeliverables: any[];
  seedingSamples: any[];
  allSamples: any[];
  onceEditions: any[];
  adIntegrations: {
    metaAuthorized: boolean;
    metaPixelId: string | null;
    googleAuthorized: boolean;
    googleAdsId: string | null;
    ga4MeasurementId: string | null;
  };
  employees: any[];
  interns: any[];
  internAttendance: any[];
  internSubmissions: any[];
  internEvaluations: any[];
  tasks: any[];
  taskComments: any[];
  attachments: any[];
  departments: any[];
  approvals: any[];
  reports: {
    attendanceReport: any[];
    tasksReport: any[];
    campaignPerformanceReport: any[];
    influencerActivityReport: any[];
    samplingReport: any[];
    departmentProductivityReport: any[];
  };
}

/**
 * Verified binary download helper: confirms HTTP 200, valid MIME header, non-empty Blob,
 * and valid binary signature (%PDF- or PK\x03\x04) BEFORE triggering download or returning success.
 */
export async function downloadVerifiedExportFile(
  downloadUrl: string,
  fallbackFileName?: string
): Promise<{ fileName: string; sizeBytes: number; mimeType: string }> {
  const headers = await buildErpHeaders();
  delete headers['Content-Type'];

  const res = await fetch(downloadUrl, { method: 'GET', headers });
  if (!res.ok) {
    const errPayload = await res.json().catch(() => ({}));
    throw new Error(errPayload?.error || `Document download failed (HTTP ${res.status})`);
  }

  const mimeType = res.headers.get('content-type') || '';
  if (mimeType.includes('application/json')) {
    const errPayload = await res.json().catch(() => ({}));
    throw new Error(errPayload?.error || 'Server returned JSON instead of binary document.');
  }

  const disposition = res.headers.get('content-disposition') || '';
  const fnMatch = disposition.match(/filename="?([^";]+)"?/i);
  const fileName = fnMatch?.[1] || fallbackFileName || 'fragmore-export.xlsx';

  const blob = await res.blob();
  if (!blob || blob.size === 0) {
    throw new Error('Downloaded file was empty (0 bytes).');
  }

  // Inspect magic bytes to verify genuine PDF or OpenXML .xlsx
  const headBuf = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
  if (fileName.endsWith('.pdf') || mimeType.includes('pdf')) {
    const magic = String.fromCharCode(...headBuf);
    if (!magic.startsWith('%PDF-')) {
      throw new Error('Generated PDF failed header integrity check.');
    }
  } else if (fileName.endsWith('.xlsx') || mimeType.includes('spreadsheetml')) {
    if (headBuf[0] !== 0x50 || headBuf[1] !== 0x4b) {
      throw new Error('Generated .xlsx workbook failed OpenXML ZIP signature check.');
    }
  }

  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);

  return { fileName, sizeBytes: blob.size, mimeType };
}

export function downloadCsvFile(filename: string, rows: Array<Record<string, any>>) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const esc = (v: any) => {
    let str = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    if (/^[=+\-@\t\r]/.test(str) || /^[=+\-@\t\r]/.test(str.trimStart())) {
      str = `'${str}`;
    }
    return `"${str.replace(/"/g, '""')}"`;
  };
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function downloadExcelSpreadsheet(
  filename: string,
  sheetTitle: string,
  rows: Array<Record<string, any>>
) {
  if (!rows.length) {
    throw new Error('No records available to export.');
  }
  const cleanFile = filename.replace(/\.(xls|xlsx)$/i, '') + '.xlsx';
  const res = await erpApi.createExportJob({
    reportKey: 'custom_table',
    format: 'XLSX',
    filters: {
      customTitle: sheetTitle,
      customRows: rows.slice(0, 1000)
    }
  });
  if (res?.queued && res?.job?.id) {
    for (let attempt = 0; attempt < 20; attempt++) {
      await new Promise((r) => setTimeout(r, 400));
      const { job } = await erpApi.getExportJob(res.job.id);
      if (job.status === 'COMPLETED' && job.downloadUrl) {
        return downloadVerifiedExportFile(job.downloadUrl, cleanFile);
      }
      if (job.status === 'FAILED') {
        throw new Error(job.errorMessage || 'Async Excel export job failed.');
      }
    }
    throw new Error('Large Excel export is still processing in background. Open Reports & Exports to download.');
  }
  if (!res?.downloadUrl) {
    throw new Error('Server did not return a signed download URL.');
  }
  return downloadVerifiedExportFile(res.downloadUrl, cleanFile);
}

export async function downloadCompleteDatabaseBackup(
  format: 'json' | 'xlsx' = 'json'
): Promise<{
  fileName: string;
  sizeBytes: number;
  totalCollections: number;
  populatedCollections: number;
  totalDocuments: number;
}> {
  const headers = await buildErpHeaders();
  delete headers['Content-Type'];

  const res = await fetch(`/api/admin/database/export?format=${format}`, {
    method: 'GET',
    headers
  });

  if (!res.ok) {
    const errPayload = await res.json().catch(() => ({}));
    throw new Error(errPayload?.error || `Database backup failed (HTTP ${res.status})`);
  }

  const totalCollections = Number(res.headers.get('x-database-collections-total') || 0);
  const populatedCollections = Number(res.headers.get('x-database-collections-populated') || 0);
  const totalDocuments = Number(res.headers.get('x-database-documents-total') || 0);

  const disposition = res.headers.get('content-disposition') || '';
  const fnMatch = disposition.match(/filename="?([^";]+)"?/i);
  const fallbackName = `FRAGMORE_Complete_Database_${new Date().toISOString().slice(0, 10)}.${format}`;
  const fileName = fnMatch?.[1] || fallbackName;

  const blob = await res.blob();
  if (!blob || blob.size === 0) {
    throw new Error('Downloaded database backup was empty.');
  }

  if (format === 'xlsx') {
    const head = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
    if (head[0] !== 0x50 || head[1] !== 0x4b) {
      throw new Error('Complete database .xlsx failed OpenXML signature check.');
    }
  }

  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);

  return {
    fileName,
    sizeBytes: blob.size,
    totalCollections,
    populatedCollections,
    totalDocuments
  };
}

