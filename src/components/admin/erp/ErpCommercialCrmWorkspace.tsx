import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Printer,
  FileSpreadsheet,
  Plus,
  Trash2,
  CheckCircle2,
  ShieldAlert,
  GitCompare,
  ArrowRight,
  PhoneCall,
  CalendarClock,
  FileCheck,
  Truck,
  CreditCard,
  Receipt
} from 'lucide-react';
import {
  erpApi,
  downloadCsvFile,
  downloadExcelSpreadsheet,
  type ErpWorkspaceSnapshot,
  type ErpCommercialCrmSnapshot
} from '../../../lib/erpApi';
import { CommercialProposalPrintModal } from './CommercialProposalPrintModal';
import { ErpTableExportBar } from './ErpUniversalExportModal';

interface Props {
  workspaceSnapshot: ErpWorkspaceSnapshot;
  activeModule: 'ERP_CRM' | 'ERP_PROPOSALS';
  onRefreshParent: () => Promise<void>;
  notify: (msg: string, type?: 'success' | 'error') => void;
  onPrintInvoice: (invoice: any) => void;
}

const fmt = (n: number) => `₹${Math.round(Number(n || 0)).toLocaleString('en-IN')}`;

const addDays = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

export const ErpCommercialCrmWorkspace: React.FC<Props> = ({
  workspaceSnapshot,
  activeModule,
  onRefreshParent,
  notify,
  onPrintInvoice
}) => {
  const [snap, setSnap] = useState<ErpCommercialCrmSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Sub-tabs
  const [crmTab, setCrmTab] = useState<'pipeline' | 'capture' | 'activities' | 'analytics'>('pipeline');
  const [propTab, setPropTab] = useState<
    'proposals' | 'proposal_builder' | 'quotations' | 'order_fulfilment' | 'pricing_audit'
  >('proposals');

  // CRM Filters & Selection
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [stageFilter, setStageFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');

  // CRM Lead Form
  const [leadForm, setLeadForm] = useState<any>({
    id: '',
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    city: 'Mumbai',
    state: 'Maharashtra',
    customerCategory: 'CORPORATE_GIFTING',
    source: 'Website Inquiry',
    estimatedValueInr: 180000,
    probabilityPct: 35,
    workflowStage: 'LEAD',
    clientGstin: '',
    clientAddress: '',
    requirementsSummary: '',
    eventDate: '',
    expectedQuantity: 100,
    assignedToEmail: workspaceSnapshot.actor?.email || 'admin@fragmore.com',
    nextFollowUpDate: addDays(3),
    reminderNotes: '',
    notes: ''
  });

  // Contact Log & Reminder Task Form
  const [contactForm, setContactForm] = useState({
    leadId: '',
    channel: 'CALL' as 'CALL' | 'EMAIL' | 'WHATSAPP' | 'MEETING' | 'SAMPLE',
    summary: '',
    outcome: '',
    nextFollowUpDate: addDays(3),
    taskTitle: '',
    taskPriority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
    reminderNotes: '',
    updatedProbabilityPct: ''
  });

  // Document Attachment Form
  const [docForm, setDocForm] = useState({
    entityId: '',
    fileName: '',
    fileUrl: '',
    documentType: 'CLIENT_BRIEF'
  });

  // Corporate Proposal Builder State
  const [proposalForm, setProposalForm] = useState<any>({
    id: '',
    createNewVersion: false,
    parentProposalId: '',
    leadId: '',
    proposalType: 'CORPORATE_GIFTING',
    title: 'Bespoke Fragrance Gifting & Event Dossier',
    clientCompany: '',
    clientContactName: '',
    clientEmail: '',
    clientPhone: '',
    clientAddress: '',
    clientGstin: '',
    placeOfSupplyState: 'Maharashtra',
    scopeSummary: 'Curated signature Extrait de Parfum flacons with bespoke monogrammed rigid sleeves.',
    eventType: 'Corporate Celebration',
    eventDate: '',
    guestCount: 150,
    eventCity: 'Mumbai',
    brandingNotes: 'Gold-foil crest sleeve with custom message insert',
    customizationSpecs: 'Custom brass collar engraving & blind-debossed rigid keepsake box',
    deliverablesText:
      'Signature Extrait de Parfum Flacons\nCustom Gold-Foil Rigid Gift Sleeves\nBatch Quality & IFRA Dossier\nTemperature-Controlled Logistics',
    lineItems: [] as Array<{
      sku: string;
      description: string;
      size: string;
      qty: number;
      catalogueUnitPriceInr: number;
      unitPriceInr: number;
      gstRatePct: number;
      pricingReason: string;
    }>,
    packageOptions: [
      { packageName: 'Signature Gift Tier', description: 'Standard 50ml flacons with embossed rigid sleeve', subtotalInr: 150000, recommended: true },
      { packageName: 'Atelier VIP + Perfume Bar Tier', description: '50ml flacons + 6x2ml Discovery Set + Live Mixologist Counter', subtotalInr: 235000, recommended: false }
    ],
    discountInr: 0,
    setupCostInr: 15000,
    staffingCostInr: 0,
    shippingInr: 3500,
    paymentMilestones: [
      { milestoneName: 'Booking & Artwork Advance', pct: 50, triggerCondition: 'On Proposal Acceptance' },
      { milestoneName: 'Pre-Dispatch QA Balance', pct: 50, triggerCondition: 'Against Batched QA Release' }
    ],
    termsAndConditions:
      '1. Lead time: 10 working days post artwork sign-off & advance receipt.\n2. Applicable GST (CGST+SGST within Maharashtra or IGST outside Maharashtra) is billed at 18%.\n3. Quote valid for 30 days from date of issue.',
    validUntil: addDays(30),
    changeSummary: '',
    negotiationNotes: '',
    submitForApproval: false
  });

  // Catalogue Quotation Builder State
  const [qtForm, setQtForm] = useState<any>({
    leadId: '',
    proposalId: '',
    clientName: '',
    clientEmail: '',
    clientGstin: '',
    placeOfSupplyState: 'Maharashtra',
    discountInr: 0,
    freightInr: 2500,
    paymentTerms: '50% Advance, 50% Prior to Dispatch',
    validUntil: addDays(15),
    notes: '',
    items: [] as Array<{
      sku: string;
      description: string;
      qty: number;
      catalogueUnitPriceInr: number;
      unitPriceInr: number;
      unitManufacturingCostInr: number;
      pricingReason: string;
    }>
  });

  // Print / Accept / Compare / Order Action Modals
  const [printModal, setPrintModal] = useState<{ mode: 'PROPOSAL' | 'QUOTATION'; record: any } | null>(null);
  const [acceptModal, setAcceptModal] = useState<{
    type: 'PROPOSAL' | 'QUOTATION';
    record: any;
    acceptedByName: string;
    acceptedByEmail: string;
    acceptanceRef: string;
    notes: string;
  } | null>(null);
  const [versionCompareModal, setVersionCompareModal] = useState<any | null>(null);
  const [comparePick, setComparePick] = useState<{ baseId: string; revisedId: string }>({ baseId: '', revisedId: '' });
  const [orderProgressModal, setOrderProgressModal] = useState<{
    order: any;
    mode: 'PAYMENT' | 'DISPATCH';
    method: string;
    referenceNumber: string;
    amountInr: number;
    courierName: string;
    awbNumber: string;
  } | null>(null);

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    try {
      const data = await erpApi.getCommercialSnapshot();
      setSnap(data);
      setSelectedLeadId((prev) => prev || data.leads[0]?.id || '');
      setContactForm((prev) => ({ ...prev, leadId: prev.leadId || data.leads[0]?.id || '' }));

      // Populate default line item from live catalogue if empty
      if (data.catalogue.length > 0) {
        const firstSku = data.catalogue[0];
        setProposalForm((prev: any) =>
          prev.lineItems.length > 0
            ? prev
            : {
                ...prev,
                leadId: prev.leadId || data.leads[0]?.id || '',
                lineItems: [
                  {
                    sku: firstSku.sku,
                    description: `${firstSku.name} (${firstSku.size})`,
                    size: firstSku.size,
                    qty: 50,
                    catalogueUnitPriceInr: firstSku.catalogueUnitPriceInr,
                    unitPriceInr: firstSku.catalogueUnitPriceInr,
                    gstRatePct: firstSku.gstRatePct,
                    pricingReason: ''
                  }
                ]
              }
        );
        setQtForm((prev: any) =>
          prev.items.length > 0
            ? prev
            : {
                ...prev,
                items: [
                  {
                    sku: firstSku.sku,
                    description: `${firstSku.name} (${firstSku.size})`,
                    qty: 25,
                    catalogueUnitPriceInr: firstSku.catalogueUnitPriceInr,
                    unitPriceInr: firstSku.catalogueUnitPriceInr,
                    unitManufacturingCostInr: firstSku.unitManufacturingCostInr,
                    pricingReason: ''
                  }
                ]
              }
        );
      }
    } catch (e: any) {
      notify(e?.message || 'Failed to load commercial CRM workspace', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

  const runAction = async (fn: () => Promise<any>, okMsg: string) => {
    setBusy(true);
    try {
      const res = await fn();
      await Promise.all([loadSnapshot(), onRefreshParent()]);
      notify(okMsg, 'success');
      return res;
    } catch (e: any) {
      notify(e?.message || 'Operation failed', 'error');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const catalogue = snap?.catalogue || [];

  const filteredLeads = useMemo(() => {
    if (!snap) return [];
    const q = searchQuery.trim().toLowerCase();
    return snap.leads.filter((l) => {
      if (categoryFilter !== 'ALL' && l.customerCategory !== categoryFilter) return false;
      if (stageFilter !== 'ALL' && l.workflowStage !== stageFilter) return false;
      if (
        q &&
        !`${l.leadNumber} ${l.companyName} ${l.contactName} ${l.email} ${l.city}`.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [snap, categoryFilter, stageFilter, searchQuery]);

  const selectedLead = useMemo(() => {
    if (!snap) return null;
    return snap.leads.find((l) => l.id === selectedLeadId) || snap.leads[0] || null;
  }, [snap, selectedLeadId]);

  const categoryLabelMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of snap?.customerCategories || []) m.set(c.code, c.label);
    return m;
  }, [snap]);

  // Proposal live calculation preview
  const propCalc = useMemo(() => {
    const sub = (proposalForm.lineItems || []).reduce(
      (s: number, it: any) => s + Number(it.qty || 0) * Number(it.unitPriceInr || 0),
      0
    );
    const disc = Math.min(sub, Number(proposalForm.discountInr || 0));
    const setup = Number(proposalForm.setupCostInr || 0);
    const staffing = Number(proposalForm.staffingCostInr || 0);
    const ship = Number(proposalForm.shippingInr || 0);
    const taxable = Math.max(0, sub - disc) + setup + staffing;
    const tax = taxable * 0.18;
    return {
      subtotal: Math.round(sub),
      taxable: Math.round(taxable),
      tax: Math.round(tax),
      grandTotal: Math.round(taxable + tax + ship)
    };
  }, [proposalForm]);

  // Quotation live calculation & margin preview
  const qtCalc = useMemo(() => {
    const sub = (qtForm.items || []).reduce((s: number, it: any) => s + Number(it.qty || 0) * Number(it.unitPriceInr || 0), 0);
    const cogs = (qtForm.items || []).reduce(
      (s: number, it: any) => s + Number(it.qty || 0) * Number(it.unitManufacturingCostInr || 0),
      0
    );
    const disc = Math.min(sub, Number(qtForm.discountInr || 0));
    const taxable = Math.max(0, sub - disc);
    const tax = taxable * 0.18;
    const freight = Number(qtForm.freightInr || 0);
    const grandTotal = taxable + tax + freight;
    const maxLineDisc = (qtForm.items || []).reduce((m: number, it: any) => {
      const base = Number(it.catalogueUnitPriceInr || 0);
      const pct = base > 0 ? ((base - Number(it.unitPriceInr || 0)) / base) * 100 : 0;
      return Math.max(m, pct);
    }, 0);
    const overallDisc = sub > 0 ? (disc / sub) * 100 : 0;
    const maxDiscPct = Math.round(Math.max(maxLineDisc, overallDisc) * 10) / 10;
    const marginInr = taxable - cogs;
    const marginPct = taxable > 0 ? Math.round((marginInr / taxable) * 1000) / 10 : 0;
    return {
      subtotal: Math.round(sub),
      taxable: Math.round(taxable),
      tax: Math.round(tax),
      grandTotal: Math.round(grandTotal),
      cogs: Math.round(cogs),
      marginInr: Math.round(marginInr),
      marginPct,
      maxDiscPct,
      requiresApproval: maxDiscPct > 10 || (!snap?.actor?.canApprovePricing && maxDiscPct > 5)
    };
  }, [qtForm, snap]);

  // Quick Launchers from Lead into Proposal / Quotation
  const launchProposalFromLead = (lead: any) => {
    setProposalForm((prev: any) => ({
      ...prev,
      id: '',
      createNewVersion: false,
      parentProposalId: '',
      leadId: lead.id,
      proposalType:
        lead.customerCategory === 'WEDDING_PLANNER'
          ? 'WEDDING_RETURN_GIFTS'
          : lead.customerCategory === 'HOTEL_HOSPITALITY'
          ? 'CUSTOM_FRAGRANCE_EXPERIENCE'
          : lead.customerCategory === 'DISTRIBUTOR' || lead.customerCategory === 'RETAILER' || lead.customerCategory === 'STOCKIST'
          ? 'RETAILER_DISTRIBUTOR_PARTNERSHIP'
          : lead.customerCategory === 'PERFUME_BAR_CUSTOMER' || lead.customerCategory === 'EVENT_MANAGER'
          ? 'PERFUME_BAR_EVENT'
          : 'CORPORATE_GIFTING',
      title: `FRAGMORÉ ${categoryLabelMap.get(lead.customerCategory) || 'Bespoke'} Proposal — ${lead.companyName}`,
      clientCompany: lead.companyName,
      clientContactName: lead.contactName,
      clientEmail: lead.email,
      clientPhone: lead.phone,
      clientAddress: lead.clientAddress || `${lead.city}, ${lead.state}`,
      clientGstin: lead.clientGstin || '',
      placeOfSupplyState: lead.state || 'Maharashtra',
      scopeSummary: lead.requirementsSummary || prev.scopeSummary,
      eventDate: lead.eventDate || '',
      guestCount: lead.expectedQuantity || 100,
      eventCity: lead.city || 'Mumbai'
    }));
    setPropTab('proposal_builder');
    notify(`Loaded ${lead.companyName} into Corporate Proposal Builder.`, 'success');
  };

  const launchQuotationFromLeadOrProposal = (source: any, fromProposal = false) => {
    if (fromProposal) {
      const items = (source.lineItems || []).map((li: any) => {
        const cat = catalogue.find((c) => c.sku.toUpperCase() === String(li.sku || '').toUpperCase());
        return {
          sku: li.sku || cat?.sku || catalogue[0]?.sku || 'FRG-GOLD-50',
          description: li.description,
          qty: Number(li.qty || 1),
          catalogueUnitPriceInr: Number(li.catalogueUnitPriceInr ?? cat?.catalogueUnitPriceInr ?? li.unitPriceInr),
          unitPriceInr: Number(li.unitPriceInr || cat?.catalogueUnitPriceInr || 1270),
          unitManufacturingCostInr: Number(cat?.unitManufacturingCostInr ?? 380),
          pricingReason: `Converted from Proposal ${source.proposalNumber}`
        };
      });
      setQtForm({
        leadId: source.leadId || '',
        proposalId: source.id,
        clientName: source.clientCompany,
        clientEmail: source.clientEmail,
        clientGstin: source.clientGstin || '',
        placeOfSupplyState: source.placeOfSupplyState || 'Maharashtra',
        discountInr: Number(source.discountInr || 0),
        freightInr: Number(source.shippingInr || 0),
        paymentTerms: '50% Advance, 50% Prior to Dispatch',
        validUntil: addDays(15),
        notes: `Linked to ${source.proposalNumber} v${source.proposalVersionNumber || 1}`,
        items
      });
    } else {
      setQtForm((prev: any) => ({
        ...prev,
        leadId: source.id,
        proposalId: '',
        clientName: source.companyName,
        clientEmail: source.email,
        clientGstin: source.clientGstin || '',
        placeOfSupplyState: source.state || 'Maharashtra',
        notes: `Direct GST Quotation for CRM Lead ${source.leadNumber}`
      }));
    }
    setPropTab('quotations');
  };

  const loadProposalRevision = (prop: any) => {
    setProposalForm({
      id: '',
      createNewVersion: true,
      parentProposalId: prop.id,
      leadId: prop.leadId || '',
      proposalType: prop.proposalType || 'CORPORATE_GIFTING',
      title: prop.title,
      clientCompany: prop.clientCompany,
      clientContactName: prop.clientContactName,
      clientEmail: prop.clientEmail,
      clientPhone: prop.clientPhone || '',
      clientAddress: prop.clientAddress || '',
      clientGstin: prop.clientGstin || '',
      placeOfSupplyState: prop.placeOfSupplyState || 'Maharashtra',
      scopeSummary: prop.scopeSummary,
      eventType: prop.eventRequirements?.eventType || '',
      eventDate: prop.eventRequirements?.eventDate || '',
      guestCount: prop.eventRequirements?.guestCount || 100,
      eventCity: prop.eventRequirements?.city || prop.placeOfSupplyState,
      brandingNotes: prop.eventRequirements?.brandingNotes || '',
      customizationSpecs: prop.customizationSpecs || '',
      deliverablesText: Array.isArray(prop.deliverables) ? prop.deliverables.join('\n') : '',
      lineItems: (prop.lineItems || []).map((li: any) => ({
        sku: li.sku || 'FRG-GOLD-50',
        description: li.description,
        size: li.size || '50 ml',
        qty: Number(li.qty || 1),
        catalogueUnitPriceInr: Number(li.catalogueUnitPriceInr || li.unitPriceInr || 1270),
        unitPriceInr: Number(li.unitPriceInr || 1270),
        gstRatePct: Number(li.gstRatePct || 18),
        pricingReason: li.pricingReason || ''
      })),
      packageOptions: Array.isArray(prop.packageOptions) ? prop.packageOptions : [],
      discountInr: Number(prop.discountInr || 0),
      setupCostInr: Number(prop.setupCostInr || 0),
      staffingCostInr: Number(prop.staffingCostInr || 0),
      shippingInr: Number(prop.shippingInr || 0),
      paymentMilestones: Array.isArray(prop.paymentMilestones) ? prop.paymentMilestones : [],
      termsAndConditions: prop.termsAndConditions || '',
      validUntil: prop.validUntil || addDays(30),
      changeSummary: `Negotiated revision from ${prop.proposalNumber}`,
      negotiationNotes: '',
      submitForApproval: false
    });
    setPropTab('proposal_builder');
  };

  if (loading && !snap) {
    return (
      <div className="max-w-7xl mx-auto p-6 space-y-4">
        <div className="h-10 bg-[#EDE7DC] animate-pulse w-1/3" />
        <div className="h-24 bg-[#EDE7DC] animate-pulse w-full" />
        <div className="h-72 bg-[#EDE7DC] animate-pulse w-full" />
      </div>
    );
  }

  if (!snap) return null;

  // ==========================================================================
  // RENDER MODULE 08: SALES CRM (11 CATEGORIES, CONTACT LOG, TASKS & ANALYTICS)
  // ==========================================================================
  if (activeModule === 'ERP_CRM') {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header Bar */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-[#DED7CC] pb-4">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-widest text-[#9A783E]">
              Module 08 · Sales CRM, 11 Buyer Segments &amp; Pipeline
            </p>
            <h2 className="font-serif text-2xl sm:text-3xl text-[#24211D] uppercase tracking-wider mt-1">
              Commercial CRM &amp; Deal Lifecycle
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'pipeline', label: `Pipeline (${snap.leads.length})` },
              { id: 'capture', label: leadForm.id ? 'Edit Lead' : 'Capture Lead' },
              { id: 'activities', label: `Contacts & Tasks (${snap.crmTasks.length})` },
              { id: 'analytics', label: 'Conversion Analytics' }
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setCrmTab(t.id as any)}
                className={`px-3 py-1.5 text-xs font-mono border whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  crmTab === t.id
                    ? 'bg-[#24211D] text-[#FAF8F4] border-[#24211D]'
                    : 'bg-white text-[#24211D] border-[#DED7CC] hover:border-[#9A783E]'
                }`}
              >
                {t.label}
              </button>
            ))}
            <ErpTableExportBar
              reportKey="custom_table"
              title="FRAGMORÉ Commercial Sales CRM Pipeline"
              customRows={snap.leads}
              notify={notify}
            />
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-5 border border-[#DED7CC] bg-white divide-y sm:divide-y-0 sm:divide-x divide-[#DED7CC]">
          <div className="p-4">
            <span className="text-[11px] font-mono uppercase text-[#686158] block">Gross Pipeline</span>
            <span className="text-xl font-mono font-bold text-[#24211D] tabular-nums">
              {fmt(snap.analytics.totalPipelineInr)}
            </span>
          </div>
          <div className="p-4">
            <span className="text-[11px] font-mono uppercase text-[#686158] block">Probability-Weighted</span>
            <span className="text-xl font-mono font-bold text-[#9A783E] tabular-nums">
              {fmt(snap.analytics.weightedPipelineInr)}
            </span>
          </div>
          <div className="p-4">
            <span className="text-[11px] font-mono uppercase text-[#686158] block">Won / Accepted Deals</span>
            <span className="text-xl font-mono font-bold text-[#16A34A] tabular-nums">
              {snap.analytics.wonDealsCount} / {snap.analytics.totalLeads}
            </span>
          </div>
          <div className="p-4">
            <span className="text-[11px] font-mono uppercase text-[#686158] block">Conversion Rate</span>
            <span className="text-xl font-mono font-bold text-[#24211D] tabular-nums">
              {snap.analytics.conversionRatePct}%
            </span>
          </div>
          <div className="p-4">
            <span className="text-[11px] font-mono uppercase text-[#686158] block">Overdue Follow-Ups</span>
            <span
              className={`text-xl font-mono font-bold tabular-nums ${
                snap.analytics.overdueRemindersCount > 0 ? 'text-[#DC2626]' : 'text-[#24211D]'
              }`}
            >
              {snap.analytics.overdueRemindersCount}
            </span>
          </div>
        </div>

        {/* CRM TAB 1: PIPELINE & 12-STAGE INSPECTION */}
        {crmTab === 'pipeline' && (
          <div className="space-y-4">
            {/* Filter Toolbar */}
            <div className="flex flex-wrap items-center gap-3 p-3 bg-white border border-[#DED7CC]">
              <input
                type="search"
                placeholder="Search lead #, company, contact or city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 min-w-[200px] px-3 py-1.5 border border-[#DED7CC] bg-[#FAF8F4] text-xs"
              />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-2.5 py-1.5 border border-[#DED7CC] bg-[#FAF8F4] text-xs font-mono"
              >
                <option value="ALL">All 11 Customer Categories</option>
                {snap.customerCategories.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="px-2.5 py-1.5 border border-[#DED7CC] bg-[#FAF8F4] text-xs font-mono"
              >
                <option value="ALL">All 12 Workflow Stages</option>
                {snap.workflowStages.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, ' ')}
                  </option>
                ))}
                <option value="LOST">LOST</option>
              </select>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Leads Table */}
              <div className="xl:col-span-2 border border-[#DED7CC] bg-white overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                    <tr>
                      <th className="py-2.5 px-3">Lead / Organization</th>
                      <th className="py-2.5 px-3">Category &amp; Source</th>
                      <th className="py-2.5 px-3 text-right">Value / Prob</th>
                      <th className="py-2.5 px-3">Workflow Stage</th>
                      <th className="py-2.5 px-3">Follow-Up</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DED7CC]">
                    {filteredLeads.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-[#686158] font-mono">
                          No leads match current filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredLeads.map((l) => {
                        const isSelected = selectedLead?.id === l.id;
                        const weighted = Math.round((Number(l.estimatedValueInr || 0) * Number(l.probabilityPct || 0)) / 100);
                        return (
                          <tr
                            key={l.id}
                            onClick={() => setSelectedLeadId(l.id)}
                            className={`cursor-pointer transition-colors ${isSelected ? 'bg-[#FAF8F4]' : 'hover:bg-[#FAF8F4]'}`}
                          >
                            <td className="py-2.5 px-3">
                              <span className="font-mono font-bold text-[#9A783E] block">{l.leadNumber}</span>
                              <span className="font-semibold text-[#24211D] block">{l.companyName}</span>
                              <span className="text-[11px] text-[#686158]">
                                {l.contactName} · {l.city}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-[11px] text-[#4A433B]">
                              <span className="font-medium block">
                                {categoryLabelMap.get(l.customerCategory) || l.customerCategory}
                              </span>
                              <span className="text-[#686158]">Source: {l.source}</span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                              <span className="font-bold text-[#24211D] block">{fmt(l.estimatedValueInr)}</span>
                              <span className="text-[10px] text-[#9A783E]">
                                {l.probabilityPct}% (Wt {fmt(weighted)})
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] font-semibold text-[#24211D]">
                              {String(l.workflowStage || l.stage).replace(/_/g, ' ')}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-[#686158] tabular-nums">
                              {l.nextFollowUpDate || '—'}
                              <span className="block text-[10px] truncate max-w-[110px]">{l.assignedToEmail}</span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Selected Deal Workbench */}
              {selectedLead && (
                <div className="border border-[#DED7CC] bg-white p-4 space-y-4 h-fit">
                  <div className="border-b border-[#DED7CC] pb-3 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-wider text-[#9A783E]">
                        {selectedLead.leadNumber} · {categoryLabelMap.get(selectedLead.customerCategory)}
                      </p>
                      <h3 className="text-base font-serif font-semibold text-[#24211D]">{selectedLead.companyName}</h3>
                      <p className="text-xs text-[#686158]">
                        {selectedLead.contactName} · {selectedLead.phone}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setLeadForm({
                          ...selectedLead,
                          eventDate: selectedLead.eventDate || '',
                          expectedQuantity: selectedLead.expectedQuantity || 100
                        });
                        setCrmTab('capture');
                      }}
                      className="px-2.5 py-1 border border-[#DED7CC] text-[11px] font-mono hover:border-[#9A783E] cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Edit
                    </button>
                  </div>

                  {selectedLead.requirementsSummary && (
                    <div className="text-xs text-[#4A433B] bg-[#FAF8F4] p-2.5 border border-[#DED7CC]">
                      <span className="text-[10px] font-mono uppercase text-[#9A783E] block mb-0.5">Requirements</span>
                      {selectedLead.requirementsSummary}
                    </div>
                  )}

                  {/* 12-Stage Lifecycle Stepper */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono uppercase text-[#686158] block">
                      Deal Lifecycle Stage (12 Stages)
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={selectedLead.workflowStage}
                        disabled={busy}
                        onChange={(e) =>
                          runAction(
                            () => erpApi.advanceCommercialLeadWorkflow(selectedLead.id, e.target.value),
                            `Moved ${selectedLead.leadNumber} to ${e.target.value}.`
                          )
                        }
                        className="flex-1 px-2.5 py-1.5 border border-[#DED7CC] bg-[#FAF8F4] text-xs font-mono"
                      >
                        {snap.workflowStages.map((st, idx) => (
                          <option key={st} value={st}>
                            {idx + 1}. {st.replace(/_/g, ' ')}
                          </option>
                        ))}
                        <option value="LOST">LOST</option>
                      </select>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setContactForm({ ...contactForm, leadId: selectedLead.id });
                        setCrmTab('activities');
                      }}
                      className="px-2.5 py-2 border border-[#DED7CC] bg-white hover:bg-[#FAF8F4] text-[11px] font-mono flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <PhoneCall className="w-3.5 h-3.5 text-[#9A783E]" /> Log Contact / Task
                    </button>
                    {selectedLead.convertedCustomerId ? (
                      <div className="px-2.5 py-2 border border-[#DED7CC] bg-[#FAF8F4] text-[11px] font-mono text-[#16A34A] flex items-center justify-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Customer Linked
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          runAction(
                            () => erpApi.convertLead(selectedLead.id),
                            `Converted ${selectedLead.companyName} to persistent Storefront Customer.`
                          )
                        }
                        className="px-2.5 py-2 border border-[#DED7CC] bg-white hover:bg-[#FAF8F4] text-[11px] font-mono cursor-pointer whitespace-nowrap"
                      >
                        Convert Customer
                      </button>
                    )}
                  </div>

                  {/* Contact History Preview */}
                  <div className="border-t border-[#DED7CC] pt-3 space-y-2">
                    <p className="text-[10px] font-mono uppercase text-[#686158]">
                      Recent Contact History ({Array.isArray(selectedLead.contactHistory) ? selectedLead.contactHistory.length : 0})
                    </p>
                    <div className="space-y-1.5 max-h-44 overflow-y-auto">
                      {Array.isArray(selectedLead.contactHistory) && selectedLead.contactHistory.length > 0 ? (
                        selectedLead.contactHistory.map((ch: any) => (
                          <div key={ch.id} className="text-[11px] border-b border-[#EFEAE2] pb-1.5">
                            <div className="flex justify-between font-mono text-[10px] text-[#9A783E]">
                              <span>{ch.channel}</span>
                              <span>{ch.contactDate}</span>
                            </div>
                            <p className="text-[#24211D]">{ch.summary}</p>
                            {ch.outcome && <p className="text-[#686158]">Outcome: {ch.outcome}</p>}
                          </div>
                        ))
                      ) : (
                        <p className="text-[11px] text-[#686158]">No interactions logged yet.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CRM TAB 2: CAPTURE / EDIT LEAD */}
        {crmTab === 'capture' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runAction(async () => {
                await erpApi.saveCommercialLead({
                  ...leadForm,
                  createFollowUpTask: true
                });
                setLeadForm({
                  id: '',
                  companyName: '',
                  contactName: '',
                  email: '',
                  phone: '',
                  city: 'Mumbai',
                  state: 'Maharashtra',
                  customerCategory: 'CORPORATE_GIFTING',
                  source: 'Website Inquiry',
                  estimatedValueInr: 180000,
                  probabilityPct: 35,
                  workflowStage: 'LEAD',
                  clientGstin: '',
                  clientAddress: '',
                  requirementsSummary: '',
                  eventDate: '',
                  expectedQuantity: 100,
                  assignedToEmail: workspaceSnapshot.actor?.email || 'admin@fragmore.com',
                  nextFollowUpDate: addDays(3),
                  reminderNotes: '',
                  notes: ''
                });
                setCrmTab('pipeline');
              }, 'Lead saved cleanly to Firebase Firestore CRM.');
            }}
            className="border border-[#DED7CC] bg-white p-6 space-y-5"
          >
            <div className="flex items-center justify-between border-b border-[#DED7CC] pb-3">
              <h3 className="text-sm font-serif uppercase tracking-wider font-semibold">
                {leadForm.id ? `Edit CRM Deal (${leadForm.leadNumber || ''})` : 'Register New Lead (All 11 Categories)'}
              </h3>
              {leadForm.id && (
                <button
                  type="button"
                  onClick={() =>
                    setLeadForm({
                      ...leadForm,
                      id: '',
                      companyName: '',
                      contactName: '',
                      email: '',
                      phone: ''
                    })
                  }
                  className="text-xs font-mono text-[#686158] hover:text-[#24211D] cursor-pointer"
                >
                  Reset to New Lead
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] font-mono uppercase text-[#686158] block mb-1">Customer Category *</label>
                <select
                  value={leadForm.customerCategory}
                  onChange={(e) => setLeadForm({ ...leadForm, customerCategory: e.target.value })}
                  className="w-full px-3 py-2 border border-[#DED7CC] bg-[#FAF8F4] text-xs"
                >
                  {snap.customerCategories.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase text-[#686158] block mb-1">Company / Organization *</label>
                <input
                  required
                  value={leadForm.companyName}
                  onChange={(e) => setLeadForm({ ...leadForm, companyName: e.target.value })}
                  placeholder="e.g. Oberoi Hotels / Aurelia Weddings"
                  className="w-full px-3 py-2 border border-[#DED7CC] bg-[#FAF8F4] text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase text-[#686158] block mb-1">Primary Contact Person *</label>
                <input
                  required
                  value={leadForm.contactName}
                  onChange={(e) => setLeadForm({ ...leadForm, contactName: e.target.value })}
                  className="w-full px-3 py-2 border border-[#DED7CC] bg-[#FAF8F4] text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase text-[#686158] block mb-1">Email *</label>
                <input
                  required
                  type="email"
                  value={leadForm.email}
                  onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-[#DED7CC] bg-[#FAF8F4] text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase text-[#686158] block mb-1">Phone *</label>
                <input
                  required
                  value={leadForm.phone}
                  onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-[#DED7CC] bg-[#FAF8F4] text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase text-[#686158] block mb-1">Source Attribution</label>
                <select
                  value={leadForm.source}
                  onChange={(e) => setLeadForm({ ...leadForm, source: e.target.value })}
                  className="w-full px-3 py-2 border border-[#DED7CC] bg-[#FAF8F4] text-xs"
                >
                  {snap.leadSources.map((src) => (
                    <option key={src} value={src}>
                      {src}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase text-[#686158] block mb-1">Deal Value (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={leadForm.estimatedValueInr}
                  onChange={(e) => setLeadForm({ ...leadForm, estimatedValueInr: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-[#DED7CC] bg-[#FAF8F4] text-xs font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase text-[#686158] block mb-1">Win Probability (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={leadForm.probabilityPct}
                  onChange={(e) => setLeadForm({ ...leadForm, probabilityPct: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-[#DED7CC] bg-[#FAF8F4] text-xs font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase text-[#686158] block mb-1">Assigned Owner</label>
                <select
                  value={leadForm.assignedToEmail}
                  onChange={(e) => setLeadForm({ ...leadForm, assignedToEmail: e.target.value })}
                  className="w-full px-3 py-2 border border-[#DED7CC] bg-[#FAF8F4] text-xs font-mono"
                >
                  {snap.teamAssignees.map((u) => (
                    <option key={u.email} value={u.email}>
                      {u.displayName} ({u.roleCode})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase text-[#686158] block mb-1">City</label>
                <input
                  value={leadForm.city}
                  onChange={(e) => setLeadForm({ ...leadForm, city: e.target.value })}
                  className="w-full px-3 py-2 border border-[#DED7CC] bg-[#FAF8F4] text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase text-[#686158] block mb-1">State (GST Supply)</label>
                <input
                  value={leadForm.state}
                  onChange={(e) => setLeadForm({ ...leadForm, state: e.target.value })}
                  className="w-full px-3 py-2 border border-[#DED7CC] bg-[#FAF8F4] text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase text-[#686158] block mb-1">Client GSTIN (Optional)</label>
                <input
                  value={leadForm.clientGstin || ''}
                  onChange={(e) => setLeadForm({ ...leadForm, clientGstin: e.target.value })}
                  placeholder="27AABCM..."
                  className="w-full px-3 py-2 border border-[#DED7CC] bg-[#FAF8F4] text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase text-[#686158] block mb-1">Expected Quantity (Units)</label>
                <input
                  type="number"
                  min={1}
                  value={leadForm.expectedQuantity || 100}
                  onChange={(e) => setLeadForm({ ...leadForm, expectedQuantity: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-[#DED7CC] bg-[#FAF8F4] text-xs font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase text-[#686158] block mb-1">Event / Target Date</label>
                <input
                  type="date"
                  value={leadForm.eventDate || ''}
                  onChange={(e) => setLeadForm({ ...leadForm, eventDate: e.target.value })}
                  className="w-full px-3 py-2 border border-[#DED7CC] bg-[#FAF8F4] text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase text-[#686158] block mb-1">Next Follow-Up Reminder</label>
                <input
                  type="date"
                  value={leadForm.nextFollowUpDate || ''}
                  onChange={(e) => setLeadForm({ ...leadForm, nextFollowUpDate: e.target.value })}
                  className="w-full px-3 py-2 border border-[#DED7CC] bg-[#FAF8F4] text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-mono uppercase text-[#686158] block mb-1">Requirements Summary</label>
                <textarea
                  rows={2}
                  value={leadForm.requirementsSummary || ''}
                  onChange={(e) => setLeadForm({ ...leadForm, requirementsSummary: e.target.value })}
                  placeholder="Product preferences, custom sleeve engraving, Perfume Bar activation requirements..."
                  className="w-full px-3 py-2 border border-[#DED7CC] bg-[#FAF8F4] text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase text-[#686158] block mb-1">
                  Reminder &amp; Qualification Notes
                </label>
                <textarea
                  rows={2}
                  value={leadForm.reminderNotes || ''}
                  onChange={(e) => setLeadForm({ ...leadForm, reminderNotes: e.target.value })}
                  placeholder="Next action reminder synced automatically to ERP task queue..."
                  className="w-full px-3 py-2 border border-[#DED7CC] bg-[#FAF8F4] text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={busy}
                className="px-6 py-2.5 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono uppercase tracking-wider cursor-pointer whitespace-nowrap"
              >
                {leadForm.id ? 'Update Lead Record' : 'Persist CRM Lead & Schedule Reminder'}
              </button>
            </div>
          </form>
        )}

        {/* CRM TAB 3: CONTACT HISTORY, FOLLOW-UP TASKS & LINKED DOCUMENTS */}
        {crmTab === 'activities' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Log Contact & Follow-up Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!contactForm.leadId) return;
                runAction(async () => {
                  await erpApi.logCommercialLeadContact(contactForm.leadId, {
                    ...contactForm,
                    updatedProbabilityPct: contactForm.updatedProbabilityPct ? Number(contactForm.updatedProbabilityPct) : undefined
                  });
                  setContactForm({
                    ...contactForm,
                    summary: '',
                    outcome: '',
                    taskTitle: '',
                    reminderNotes: ''
                  });
                }, 'Contact interaction logged and follow-up task scheduled.');
              }}
              className="border border-[#DED7CC] bg-white p-4 space-y-3 h-fit"
            >
              <h3 className="text-xs font-mono uppercase font-semibold border-b border-[#DED7CC] pb-2">
                Log Contact &amp; Follow-Up Task
              </h3>
              <select
                required
                value={contactForm.leadId}
                onChange={(e) => setContactForm({ ...contactForm, leadId: e.target.value })}
                className="w-full px-2.5 py-2 border border-[#DED7CC] bg-[#FAF8F4] text-xs"
              >
                <option value="">-- Select Lead --</option>
                {snap.leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.leadNumber} · {l.companyName}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={contactForm.channel}
                  onChange={(e) => setContactForm({ ...contactForm, channel: e.target.value as any })}
                  className="w-full px-2.5 py-2 border border-[#DED7CC] bg-[#FAF8F4] text-xs font-mono"
                >
                  <option value="CALL">Phone Call</option>
                  <option value="EMAIL">Email</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="MEETING">In-Person Meeting</option>
                  <option value="SAMPLE">Sample Review</option>
                </select>
                <input
                  type="number"
                  min={0}
                  max={100}
                  placeholder="Update Prob %"
                  value={contactForm.updatedProbabilityPct}
                  onChange={(e) => setContactForm({ ...contactForm, updatedProbabilityPct: e.target.value })}
                  className="w-full px-2.5 py-2 border border-[#DED7CC] bg-[#FAF8F4] text-xs font-mono"
                />
              </div>
              <textarea
                required
                rows={2}
                placeholder="Interaction summary..."
                value={contactForm.summary}
                onChange={(e) => setContactForm({ ...contactForm, summary: e.target.value })}
                className="w-full px-2.5 py-2 border border-[#DED7CC] bg-[#FAF8F4] text-xs"
              />
              <input
                placeholder="Outcome / Client response"
                value={contactForm.outcome}
                onChange={(e) => setContactForm({ ...contactForm, outcome: e.target.value })}
                className="w-full px-2.5 py-2 border border-[#DED7CC] bg-[#FAF8F4] text-xs"
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-mono text-[#686158]">Follow-Up Date</label>
                  <input
                    type="date"
                    value={contactForm.nextFollowUpDate}
                    onChange={(e) => setContactForm({ ...contactForm, nextFollowUpDate: e.target.value })}
                    className="w-full px-2 py-1.5 border border-[#DED7CC] bg-[#FAF8F4] text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-[#686158]">Task Priority</label>
                  <select
                    value={contactForm.taskPriority}
                    onChange={(e) => setContactForm({ ...contactForm, taskPriority: e.target.value as any })}
                    className="w-full px-2 py-1.5 border border-[#DED7CC] bg-[#FAF8F4] text-xs font-mono"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="URGENT">URGENT</option>
                  </select>
                </div>
              </div>
              <input
                placeholder="Follow-up Task Title (optional)"
                value={contactForm.taskTitle}
                onChange={(e) => setContactForm({ ...contactForm, taskTitle: e.target.value })}
                className="w-full px-2.5 py-2 border border-[#DED7CC] bg-[#FAF8F4] text-xs"
              />
              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono uppercase cursor-pointer"
              >
                Save Interaction &amp; Reminder
              </button>

              {/* Document Link Form */}
              <div className="pt-4 border-t border-[#DED7CC] space-y-2">
                <p className="text-[10px] font-mono uppercase text-[#9A783E] font-semibold">Attach Deal Document</p>
                <input
                  placeholder="Document Title (e.g. Taj Artwork Signoff PDF)"
                  value={docForm.fileName}
                  onChange={(e) => setDocForm({ ...docForm, fileName: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-[#DED7CC] bg-[#FAF8F4] text-xs"
                />
                <input
                  placeholder="URL / Storage Reference"
                  value={docForm.fileUrl}
                  onChange={(e) => setDocForm({ ...docForm, fileUrl: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-[#DED7CC] bg-[#FAF8F4] text-xs font-mono"
                />
                <button
                  type="button"
                  disabled={busy || !docForm.fileName || !docForm.fileUrl}
                  onClick={() =>
                    runAction(async () => {
                      await erpApi.addAttachment({
                        moduleKey: 'crm',
                        entityType: 'erp_leads',
                        entityId: docForm.entityId || contactForm.leadId || snap.leads[0]?.id,
                        fileName: docForm.fileName,
                        fileUrl: docForm.fileUrl,
                        documentType: docForm.documentType
                      });
                      setDocForm({ ...docForm, fileName: '', fileUrl: '' });
                    }, 'Document attached to CRM deal.')
                  }
                  className="w-full py-2 border border-[#DED7CC] bg-[#FAF8F4] hover:border-[#9A783E] text-xs font-mono cursor-pointer"
                >
                  Attach Reference Document
                </button>
              </div>
            </form>

            {/* Follow-up Tasks & Deal Timeline */}
            <div className="lg:col-span-2 space-y-5">
              <div className="border border-[#DED7CC] bg-white">
                <div className="px-4 py-3 border-b border-[#DED7CC] bg-[#FAF8F4] flex items-center justify-between">
                  <span className="text-xs font-mono uppercase font-semibold flex items-center gap-1.5">
                    <CalendarClock className="w-3.5 h-3.5 text-[#9A783E]" /> CRM Follow-Up Tasks &amp; Reminders
                  </span>
                  <span className="text-[11px] font-mono text-[#686158]">{snap.crmTasks.length} scheduled</span>
                </div>
                <div className="divide-y divide-[#DED7CC] max-h-72 overflow-y-auto">
                  {snap.crmTasks.length === 0 ? (
                    <p className="p-4 text-xs font-mono text-[#686158]">No CRM tasks queued.</p>
                  ) : (
                    snap.crmTasks.map((t) => (
                      <div key={t.id} className="p-3 flex items-center justify-between gap-4 text-xs">
                        <div>
                          <p className="font-semibold text-[#24211D]">
                            {t.taskNumber} · {t.title}
                          </p>
                          <p className="text-[11px] text-[#686158]">{t.description}</p>
                          <p className="text-[10px] font-mono text-[#9A783E] mt-0.5 tabular-nums">
                            Due {t.dueDate} · Priority {t.priority} · Owner {t.assignedToEmail}
                          </p>
                        </div>
                        {t.status === 'DONE' ? (
                          <span className="text-[11px] font-mono text-[#16A34A] whitespace-nowrap">Completed</span>
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              runAction(() => erpApi.saveTask({ id: t.id, status: 'DONE' }), `Completed ${t.taskNumber}.`)
                            }
                            className="px-2.5 py-1 border border-[#DED7CC] text-[11px] font-mono hover:border-[#16A34A] hover:text-[#16A34A] cursor-pointer whitespace-nowrap shrink-0"
                          >
                            Mark Done
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="border border-[#DED7CC] bg-white">
                <div className="px-4 py-3 border-b border-[#DED7CC] bg-[#FAF8F4] flex items-center justify-between">
                  <span className="text-xs font-mono uppercase font-semibold">Deal Activity &amp; Document Log</span>
                  <span className="text-[11px] font-mono text-[#686158]">{snap.attachments.length} docs</span>
                </div>
                <div className="divide-y divide-[#DED7CC] max-h-72 overflow-y-auto">
                  {snap.dealActivities.slice(0, 20).map((act) => (
                    <div key={act.id} className="px-4 py-2.5 text-xs flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-mono uppercase text-[#9A783E] mr-2">[{act.stage}]</span>
                        <span className="text-[#24211D]">{act.summary}</span>
                      </div>
                      <span className="text-[10px] font-mono text-[#686158] whitespace-nowrap shrink-0">
                        {String(act.createdAt).slice(0, 10)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CRM TAB 4: CONVERSION & CATEGORY ANALYTICS */}
        {crmTab === 'analytics' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="border border-[#DED7CC] bg-white overflow-x-auto">
              <div className="px-4 py-3 border-b border-[#DED7CC] bg-[#FAF8F4] flex items-center justify-between">
                <span className="text-xs font-mono uppercase font-semibold">Pipeline by Customer Category (11 Segments)</span>
                <button
                  type="button"
                  onClick={() =>
                    downloadExcelSpreadsheet(
                      'fragmore-crm-category-analytics.xls',
                      'CRM Pipeline by Customer Category',
                      snap.analytics.byCategory
                    )
                  }
                  className="text-[11px] font-mono text-[#9A783E] hover:underline cursor-pointer"
                >
                  Export Excel
                </button>
              </div>
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                  <tr>
                    <th className="py-2 px-3">Customer Category</th>
                    <th className="py-2 px-3 text-right">Deals</th>
                    <th className="py-2 px-3 text-right">Gross Value</th>
                    <th className="py-2 px-3 text-right">Weighted Forecast</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DED7CC]">
                  {snap.analytics.byCategory.map((c) => (
                    <tr key={c.categoryCode}>
                      <td className="py-2 px-3 font-medium text-[#24211D]">{c.label}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums">{c.count}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums">{fmt(c.totalValueInr)}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-[#9A783E]">
                        {fmt(c.weightedValueInr)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border border-[#DED7CC] bg-white overflow-x-auto">
              <div className="px-4 py-3 border-b border-[#DED7CC] bg-[#FAF8F4]">
                <span className="text-xs font-mono uppercase font-semibold">12-Stage Commercial Conversion Funnel</span>
              </div>
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                  <tr>
                    <th className="py-2 px-3">Lifecycle Stage</th>
                    <th className="py-2 px-3 text-right">Active Deals</th>
                    <th className="py-2 px-3 text-right">Stage Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DED7CC]">
                  {snap.analytics.stageFunnel.map((sf, idx) => (
                    <tr key={sf.stage}>
                      <td className="py-2 px-3 font-mono text-[11px]">
                        {idx + 1}. {sf.stage.replace(/_/g, ' ')}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums">{sf.count}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold">{fmt(sf.valueInr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================================================
  // RENDER MODULE 10: CORPORATE PROPOSALS, QUOTATIONS, PRICING AUDIT & ORDER FULFILMENT
  // ==========================================================================
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header & Navigation */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-[#DED7CC] pb-4">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-widest text-[#9A783E]">
            Module 10 · Corporate Proposals, Catalogue Quotations &amp; Pricing Control
          </p>
          <h2 className="font-serif text-2xl sm:text-3xl text-[#24211D] uppercase tracking-wider mt-1">
            Commercial Proposals &amp; Quote-to-Cash
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'proposals', label: `Proposals (${snap.proposals.length})` },
            { id: 'proposal_builder', label: proposalForm.createNewVersion ? 'Revise Proposal' : 'Proposal Builder' },
            { id: 'quotations', label: `Quotations (${snap.quotations.length})` },
            { id: 'order_fulfilment', label: `Orders & Cash (${snap.b2bOrders.length})` },
            { id: 'pricing_audit', label: `Pricing Audit (${snap.pricingAuditLogs.length})` }
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setPropTab(t.id as any)}
              className={`px-3 py-1.5 text-xs font-mono border whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                propTab === t.id
                  ? 'bg-[#24211D] text-[#FAF8F4] border-[#24211D]'
                  : 'bg-white text-[#24211D] border-[#DED7CC] hover:border-[#9A783E]'
              }`}
            >
              {t.label}
            </button>
          ))}
          <ErpTableExportBar
            reportKey={propTab === 'quotations' ? 'quotations_register' : 'corporate_proposals'}
            notify={notify}
          />
        </div>
      </div>

      {/* Executive KPI Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 border border-[#DED7CC] bg-white divide-y sm:divide-y-0 sm:divide-x divide-[#DED7CC]">
        <div className="p-4">
          <span className="text-[11px] font-mono uppercase text-[#686158] block">Corporate Proposals</span>
          <span className="text-xl font-mono font-bold tabular-nums">{snap.proposals.length}</span>
          <span className="text-[10px] font-mono text-[#16A34A] block">
            {snap.analytics.acceptedProposalsCount} Accepted / Converted
          </span>
        </div>
        <div className="p-4">
          <span className="text-[11px] font-mono uppercase text-[#686158] block">Commercial Quotations</span>
          <span className="text-xl font-mono font-bold text-[#9A783E] tabular-nums">{snap.quotations.length}</span>
        </div>
        <div className="p-4">
          <span className="text-[11px] font-mono uppercase text-[#686158] block">Pending Pricing Approvals</span>
          <span
            className={`text-xl font-mono font-bold tabular-nums ${
              snap.analytics.pendingApprovalsCount > 0 ? 'text-[#D97706]' : 'text-[#24211D]'
            }`}
          >
            {snap.analytics.pendingApprovalsCount}
          </span>
        </div>
        <div className="p-4">
          <span className="text-[11px] font-mono uppercase text-[#686158] block">B2B Sales Orders</span>
          <span className="text-xl font-mono font-bold text-[#24211D] tabular-nums">{snap.b2bOrders.length}</span>
        </div>
      </div>

      {/* PROP TAB 1: PROPOSALS REGISTER & VERSION COMPARISON */}
      {propTab === 'proposals' && (
        <div className="space-y-4">
          {/* Quick Version Compare Bar */}
          {snap.proposals.length >= 2 && (
            <div className="p-3 border border-[#DED7CC] bg-white flex flex-wrap items-center gap-3">
              <span className="text-[11px] font-mono uppercase font-semibold text-[#9A783E] flex items-center gap-1.5">
                <GitCompare className="w-3.5 h-3.5" /> Side-by-Side Version Comparison
              </span>
              <select
                value={comparePick.baseId || snap.proposals[snap.proposals.length - 1]?.id || ''}
                onChange={(e) => setComparePick({ ...comparePick, baseId: e.target.value })}
                className="px-2.5 py-1.5 border border-[#DED7CC] bg-[#FAF8F4] text-xs font-mono"
              >
                {snap.proposals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.proposalNumber} (v{p.proposalVersionNumber || 1}) · {p.clientCompany}
                  </option>
                ))}
              </select>
              <span className="text-xs font-mono text-[#686158]">vs</span>
              <select
                value={comparePick.revisedId || snap.proposals[0]?.id || ''}
                onChange={(e) => setComparePick({ ...comparePick, revisedId: e.target.value })}
                className="px-2.5 py-1.5 border border-[#DED7CC] bg-[#FAF8F4] text-xs font-mono"
              >
                {snap.proposals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.proposalNumber} (v{p.proposalVersionNumber || 1}) · {p.clientCompany}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  const idA = comparePick.baseId || snap.proposals[snap.proposals.length - 1]?.id;
                  const idB = comparePick.revisedId || snap.proposals[0]?.id;
                  if (!idA || !idB) return;
                  try {
                    const res = await erpApi.compareProposalVersions(idA, idB);
                    setVersionCompareModal(res.comparison);
                  } catch (e: any) {
                    notify(e?.message || 'Comparison failed', 'error');
                  }
                }}
                className="px-3 py-1.5 bg-[#24211D] text-white text-xs font-mono hover:bg-[#9A783E] cursor-pointer whitespace-nowrap shrink-0"
              >
                Compare Versions
              </button>
            </div>
          )}

          <div className="border border-[#DED7CC] bg-white overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                <tr>
                  <th className="py-2.5 px-3">Proposal # &amp; Ver</th>
                  <th className="py-2.5 px-3">Type / Client</th>
                  <th className="py-2.5 px-3 text-right">Setup / Staffing / Freight</th>
                  <th className="py-2.5 px-3 text-right">Grand Total</th>
                  <th className="py-2.5 px-3">Stage / Approval</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DED7CC]">
                {snap.proposals.map((p) => (
                  <tr key={p.id} className="hover:bg-[#FAF8F4]">
                    <td className="py-2.5 px-3">
                      <span className="font-mono font-bold text-[#9A783E] block">
                        {p.proposalNumber} · v{p.proposalVersionNumber || 1}
                      </span>
                      <span className="text-[10px] font-mono text-[#686158]">Valid: {p.validUntil}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-semibold text-[#24211D] block">{p.title}</span>
                      <span className="text-[11px] text-[#686158]">
                        {p.clientCompany} · {String(p.proposalType || '').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[11px] text-[#686158]">
                      Setup {fmt(p.setupCostInr)} · Staff {fmt(p.staffingCostInr)}
                      <span className="block">Ship {fmt(p.shippingInr)} · Tax {fmt(p.taxInr)}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-[#24211D]">
                      {fmt(p.grandTotalInr || p.estimatedValueInr)}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px]">
                      <span className="block font-semibold text-[#24211D]">{p.status}</span>
                      <span
                        className={`text-[10px] ${
                          p.approvalStatus === 'PENDING_APPROVAL'
                            ? 'text-[#D97706]'
                            : p.approvalStatus === 'REJECTED'
                            ? 'text-[#DC2626]'
                            : 'text-[#16A34A]'
                        }`}
                      >
                        {p.approvalStatus}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setPrintModal({ mode: 'PROPOSAL', record: p })}
                        className="text-[11px] font-mono text-[#24211D] hover:text-[#9A783E] cursor-pointer"
                      >
                        Branded PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => loadProposalRevision(p)}
                        className="text-[11px] font-mono text-[#9A783E] hover:underline cursor-pointer"
                      >
                        New Revision
                      </button>
                      {p.approvalStatus === 'PENDING_APPROVAL' && snap.actor.canApprovePricing && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            runAction(
                              () => erpApi.updateCommercialProposalStatus(p.id, { action: 'APPROVE' }),
                              `Approved ${p.proposalNumber} pricing.`
                            )
                          }
                          className="text-[11px] font-mono text-[#16A34A] hover:underline cursor-pointer"
                        >
                          Approve
                        </button>
                      )}
                      {p.approvalStatus === 'APPROVED' && ['PROPOSAL_DRAFT', 'REVISED_PROPOSAL', 'DRAFT'].includes(p.status) && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            runAction(
                              () => erpApi.updateCommercialProposalStatus(p.id, { action: 'SEND' }),
                              `Marked ${p.proposalNumber} as SENT to client.`
                            )
                          }
                          className="text-[11px] font-mono text-[#24211D] hover:underline cursor-pointer"
                        >
                          Send
                        </button>
                      )}
                      {p.approvalStatus === 'APPROVED' && !['ACCEPTED', 'CONVERTED', 'REJECTED'].includes(p.status) && (
                        <button
                          type="button"
                          onClick={() =>
                            setAcceptModal({
                              type: 'PROPOSAL',
                              record: p,
                              acceptedByName: p.clientContactName || p.clientCompany,
                              acceptedByEmail: p.clientEmail,
                              acceptanceRef: `PO-${p.proposalNumber}`,
                              notes: ''
                            })
                          }
                          className="text-[11px] font-mono text-[#16A34A] hover:underline cursor-pointer"
                        >
                          Record Accept
                        </button>
                      )}
                      {p.approvalStatus === 'APPROVED' && !p.convertedQuotationId && (
                        <button
                          type="button"
                          onClick={() => launchQuotationFromLeadOrProposal(p, true)}
                          className="text-[11px] font-mono text-[#9A783E] hover:underline cursor-pointer"
                        >
                          To Quote →
                        </button>
                      )}
                      {p.status === 'ACCEPTED' && !p.convertedOrderId && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            runAction(async () => {
                              await erpApi.convertCommercialToOrder({ proposalId: p.id });
                              setPropTab('order_fulfilment');
                            }, `Converted ${p.proposalNumber} to persistent B2B Sales Order.`)
                          }
                          className="px-2 py-0.5 bg-[#24211D] text-white text-[10px] font-mono cursor-pointer"
                        >
                          Create Order
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PROP TAB 2: CORPORATE PROPOSAL BUILDER (ALL 8 PROPOSAL TYPES) */}
      {propTab === 'proposal_builder' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runAction(async () => {
              await erpApi.saveCommercialProposal({
                ...proposalForm,
                eventRequirements: {
                  eventType: proposalForm.eventType,
                  eventDate: proposalForm.eventDate,
                  guestCount: Number(proposalForm.guestCount || 0),
                  city: proposalForm.eventCity,
                  brandingNotes: proposalForm.brandingNotes
                },
                deliverables: String(proposalForm.deliverablesText || '')
                  .split('\n')
                  .map((s) => s.trim())
                  .filter(Boolean)
              });
              setPropTab('proposals');
            }, proposalForm.createNewVersion ? 'New Proposal Revision persisted.' : 'Corporate Proposal drafted & saved.');
          }}
          className="border border-[#DED7CC] bg-white p-6 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DED7CC] pb-3">
            <div>
              <h3 className="text-sm font-serif uppercase tracking-wider font-semibold text-[#24211D]">
                {proposalForm.createNewVersion ? 'Create Revised Proposal Version' : 'Corporate Proposal Builder (8 Formats)'}
              </h3>
              <p className="text-xs text-[#686158]">
                Includes package options, setup &amp; staffing costs, payment milestones, customization &amp; pricing approval control.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={proposalForm.leadId}
                onChange={(e) => {
                  const l = snap.leads.find((x) => x.id === e.target.value);
                  if (l) launchProposalFromLead(l);
                }}
                className="px-2.5 py-1.5 border border-[#DED7CC] bg-[#FAF8F4] text-xs font-mono"
              >
                <option value="">-- Pull From CRM Lead --</option>
                {snap.leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.leadNumber} · {l.companyName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-mono uppercase text-[#686158] block mb-1">Proposal Category *</label>
              <select
                value={proposalForm.proposalType}
                onChange={(e) => setProposalForm({ ...proposalForm, proposalType: e.target.value })}
                className="w-full px-3 py-2 border border-[#DED7CC] bg-[#FAF8F4] text-xs"
              >
                {snap.proposalTypes.map((pt) => (
                  <option key={pt.code} value={pt.code}>
                    {pt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] font-mono uppercase text-[#686158] block mb-1">Proposal Title *</label>
              <input
                required
                value={proposalForm.title}
                onChange={(e) => setProposalForm({ ...proposalForm, title: e.target.value })}
                className="w-full px-3 py-2 border border-[#DED7CC] bg-[#FAF8F4] text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase text-[#686158] block mb-1">Client Company *</label>
              <input
                required
                value={proposalForm.clientCompany}
                onChange={(e) => setProposalForm({ ...proposalForm, clientCompany: e.target.value })}
                className="w-full px-3 py-2 border border-[#DED7CC] bg-[#FAF8F4] text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase text-[#686158] block mb-1">Contact Name *</label>
              <input
                required
                value={proposalForm.clientContactName}
                onChange={(e) => setProposalForm({ ...proposalForm, clientContactName: e.target.value })}
                className="w-full px-3 py-2 border border-[#DED7CC] bg-[#FAF8F4] text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase text-[#686158] block mb-1">Client Email *</label>
              <input
                required
                type="email"
                value={proposalForm.clientEmail}
                onChange={(e) => setProposalForm({ ...proposalForm, clientEmail: e.target.value })}
                className="w-full px-3 py-2 border border-[#DED7CC] bg-[#FAF8F4] text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase text-[#686158] block mb-1">Supply State</label>
              <input
                value={proposalForm.placeOfSupplyState}
                onChange={(e) => setProposalForm({ ...proposalForm, placeOfSupplyState: e.target.value })}
                className="w-full px-3 py-2 border border-[#DED7CC] bg-[#FAF8F4] text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase text-[#686158] block mb-1">Client GSTIN</label>
              <input
                value={proposalForm.clientGstin}
                onChange={(e) => setProposalForm({ ...proposalForm, clientGstin: e.target.value })}
                className="w-full px-3 py-2 border border-[#DED7CC] bg-[#FAF8F4] text-xs font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase text-[#686158] block mb-1">Valid Until</label>
              <input
                type="date"
                value={proposalForm.validUntil}
                onChange={(e) => setProposalForm({ ...proposalForm, validUntil: e.target.value })}
                className="w-full px-3 py-2 border border-[#DED7CC] bg-[#FAF8F4] text-xs font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-mono uppercase text-[#686158] block mb-1">Scope &amp; Event Brief</label>
              <textarea
                rows={2}
                required
                value={proposalForm.scopeSummary}
                onChange={(e) => setProposalForm({ ...proposalForm, scopeSummary: e.target.value })}
                className="w-full px-3 py-2 border border-[#DED7CC] bg-[#FAF8F4] text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase text-[#686158] block mb-1">
                Customization &amp; Monogramming Specs
              </label>
              <textarea
                rows={2}
                value={proposalForm.customizationSpecs}
                onChange={(e) => setProposalForm({ ...proposalForm, customizationSpecs: e.target.value })}
                className="w-full px-3 py-2 border border-[#DED7CC] bg-[#FAF8F4] text-xs"
              />
            </div>
          </div>

          {/* Catalogue Product Line Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase font-semibold text-[#9A783E]">
                Product Selection (Approved Storefront Catalogue)
              </span>
              <button
                type="button"
                onClick={() => {
                  const c = catalogue[0];
                  if (!c) return;
                  setProposalForm({
                    ...proposalForm,
                    lineItems: [
                      ...proposalForm.lineItems,
                      {
                        sku: c.sku,
                        description: `${c.name} (${c.size})`,
                        size: c.size,
                        qty: 25,
                        catalogueUnitPriceInr: c.catalogueUnitPriceInr,
                        unitPriceInr: c.catalogueUnitPriceInr,
                        gstRatePct: c.gstRatePct,
                        pricingReason: ''
                      }
                    ]
                  });
                }}
                className="px-2.5 py-1 border border-[#DED7CC] text-xs font-mono flex items-center gap-1 hover:border-[#9A783E] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Catalogue Product
              </button>
            </div>
            <div className="border border-[#DED7CC] overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                  <tr>
                    <th className="py-2 px-3">Catalogue SKU</th>
                    <th className="py-2 px-3">Qty</th>
                    <th className="py-2 px-3 text-right">Catalogue Base</th>
                    <th className="py-2 px-3 text-right">Proposed Rate (₹)</th>
                    <th className="py-2 px-3">Pricing Reason (if discounted)</th>
                    <th className="py-2 px-3 text-right">Amount</th>
                    <th className="py-2 px-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DED7CC]">
                  {proposalForm.lineItems.map((li: any, idx: number) => (
                    <tr key={idx}>
                      <td className="py-2 px-3 min-w-[220px]">
                        <select
                          value={li.sku}
                          onChange={(e) => {
                            const c = catalogue.find((x) => x.sku === e.target.value);
                            if (!c) return;
                            const next = [...proposalForm.lineItems];
                            next[idx] = {
                              ...next[idx],
                              sku: c.sku,
                              description: `${c.name} (${c.size})`,
                              size: c.size,
                              catalogueUnitPriceInr: c.catalogueUnitPriceInr,
                              unitPriceInr: c.catalogueUnitPriceInr
                            };
                            setProposalForm({ ...proposalForm, lineItems: next });
                          }}
                          className="w-full px-2 py-1 border border-[#DED7CC] bg-[#FAF8F4] text-xs"
                        >
                          {catalogue.map((c) => (
                            <option key={c.sku} value={c.sku}>
                              {c.name} · {c.size} ({fmt(c.catalogueUnitPriceInr)})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-3 w-20">
                        <input
                          type="number"
                          min={1}
                          value={li.qty}
                          onChange={(e) => {
                            const next = [...proposalForm.lineItems];
                            next[idx] = { ...next[idx], qty: Number(e.target.value) };
                            setProposalForm({ ...proposalForm, lineItems: next });
                          }}
                          className="w-full px-2 py-1 border border-[#DED7CC] bg-[#FAF8F4] font-mono text-xs tabular-nums"
                        />
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-[#686158]">
                        {fmt(li.catalogueUnitPriceInr)}
                      </td>
                      <td className="py-2 px-3 w-28">
                        <input
                          type="number"
                          min={1}
                          value={li.unitPriceInr}
                          onChange={(e) => {
                            const next = [...proposalForm.lineItems];
                            next[idx] = { ...next[idx], unitPriceInr: Number(e.target.value) };
                            setProposalForm({ ...proposalForm, lineItems: next });
                          }}
                          className="w-full px-2 py-1 border border-[#DED7CC] bg-[#FAF8F4] font-mono text-xs text-right tabular-nums"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          placeholder="Reason for rate negotiation..."
                          value={li.pricingReason || ''}
                          onChange={(e) => {
                            const next = [...proposalForm.lineItems];
                            next[idx] = { ...next[idx], pricingReason: e.target.value };
                            setProposalForm({ ...proposalForm, lineItems: next });
                          }}
                          className="w-full px-2 py-1 border border-[#DED7CC] bg-[#FAF8F4] text-xs"
                        />
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold tabular-nums">
                        {fmt(li.qty * li.unitPriceInr)}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {proposalForm.lineItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setProposalForm({
                                ...proposalForm,
                                lineItems: proposalForm.lineItems.filter((_: any, i: number) => i !== idx)
                              })
                            }
                            className="text-[#686158] hover:text-[#DC2626] cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Setup, Staffing, Shipping, Discount & Milestones */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="text-[10px] font-mono uppercase text-[#686158] block mb-1">Privilege Discount (₹)</label>
              <input
                type="number"
                min={0}
                value={proposalForm.discountInr}
                onChange={(e) => setProposalForm({ ...proposalForm, discountInr: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 border border-[#DED7CC] bg-[#FAF8F4] font-mono text-xs tabular-nums"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase text-[#686158] block mb-1">Setup / Tooling Cost (₹)</label>
              <input
                type="number"
                min={0}
                value={proposalForm.setupCostInr}
                onChange={(e) => setProposalForm({ ...proposalForm, setupCostInr: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 border border-[#DED7CC] bg-[#FAF8F4] font-mono text-xs tabular-nums"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase text-[#686158] block mb-1">On-Site Staffing (₹)</label>
              <input
                type="number"
                min={0}
                value={proposalForm.staffingCostInr}
                onChange={(e) => setProposalForm({ ...proposalForm, staffingCostInr: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 border border-[#DED7CC] bg-[#FAF8F4] font-mono text-xs tabular-nums"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase text-[#686158] block mb-1">Shipping / Logistics (₹)</label>
              <input
                type="number"
                min={0}
                value={proposalForm.shippingInr}
                onChange={(e) => setProposalForm({ ...proposalForm, shippingInr: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 border border-[#DED7CC] bg-[#FAF8F4] font-mono text-xs tabular-nums"
              />
            </div>
            <div className="p-2.5 border border-[#9A783E] bg-[#FAF8F4]">
              <span className="text-[10px] font-mono uppercase text-[#9A783E] block">Est. Grand Total (Incl GST)</span>
              <span className="text-base font-mono font-bold text-[#24211D] tabular-nums">{fmt(propCalc.grandTotal)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-mono uppercase text-[#686158] block mb-1">Deliverables (One per line)</label>
              <textarea
                rows={3}
                value={proposalForm.deliverablesText}
                onChange={(e) => setProposalForm({ ...proposalForm, deliverablesText: e.target.value })}
                className="w-full px-3 py-2 border border-[#DED7CC] bg-[#FAF8F4] text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase text-[#686158] block mb-1">Terms &amp; Conditions</label>
              <textarea
                rows={3}
                value={proposalForm.termsAndConditions}
                onChange={(e) => setProposalForm({ ...proposalForm, termsAndConditions: e.target.value })}
                className="w-full px-3 py-2 border border-[#DED7CC] bg-[#FAF8F4] text-xs"
              />
            </div>
          </div>

          {proposalForm.createNewVersion && (
            <div>
              <label className="text-[10px] font-mono uppercase text-[#9A783E] block mb-1">
                Revision Change Summary *
              </label>
              <input
                required
                value={proposalForm.changeSummary}
                onChange={(e) => setProposalForm({ ...proposalForm, changeSummary: e.target.value })}
                className="w-full px-3 py-2 border border-[#9A783E] bg-[#FAF8F4] text-xs"
              />
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#DED7CC]">
            <label className="flex items-center gap-2 text-xs font-mono text-[#24211D]">
              <input
                type="checkbox"
                checked={proposalForm.submitForApproval}
                onChange={(e) => setProposalForm({ ...proposalForm, submitForApproval: e.target.checked })}
              />
              Route explicitly through Internal Pricing Approval queue (discounts &gt; 10% auto-trigger approval)
            </label>
            <button
              type="submit"
              disabled={busy}
              className="px-6 py-2.5 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono uppercase cursor-pointer whitespace-nowrap"
            >
              {proposalForm.createNewVersion ? 'Save New Proposal Version' : 'Save Corporate Proposal'}
            </button>
          </div>
        </form>
      )}

      {/* PROP TAB 3: CATALOGUE-LINKED QUOTATION BUILDER & REGISTER */}
      {propTab === 'quotations' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Quotations Register */}
          <div className="xl:col-span-2 border border-[#DED7CC] bg-white overflow-x-auto h-fit">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                <tr>
                  <th className="py-2.5 px-3">Quotation #</th>
                  <th className="py-2.5 px-3">Client / GST State</th>
                  <th className="py-2.5 px-3 text-right">Tax / Freight</th>
                  <th className="py-2.5 px-3 text-right">Total / Max Disc</th>
                  <th className="py-2.5 px-3">Pricing Status</th>
                  <th className="py-2.5 px-3 text-right">Workflow Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DED7CC]">
                {snap.quotations.map((q) => (
                  <tr key={q.id} className="hover:bg-[#FAF8F4]">
                    <td className="py-2.5 px-3 font-mono font-bold text-[#9A783E]">
                      {q.quotationNumber}
                      <span className="block text-[10px] font-normal text-[#686158]">v{q.quotationVersionNumber || 1}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-semibold text-[#24211D] block">{q.clientName}</span>
                      <span className="text-[10px] font-mono text-[#686158]">
                        {q.placeOfSupplyState} {q.clientGstin ? `· ${q.clientGstin}` : ''}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[11px] text-[#686158]">
                      {q.isInterState ? `IGST ${fmt(q.igstInr)}` : `CGST+SGST ${fmt(Number(q.cgstInr) + Number(q.sgstInr))}`}
                      <span className="block">Frt {fmt(q.freightInr || 0)}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      <span className="font-bold text-[#24211D] block">{fmt(q.totalInr)}</span>
                      <span className="text-[10px] text-[#686158]">Max Disc {Number(q.maxDiscountPctApplied || 0)}%</span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px]">
                      <span className="block font-semibold text-[#24211D]">{q.status}</span>
                      <span
                        className={`text-[10px] ${
                          q.approvalStatus === 'PENDING_APPROVAL'
                            ? 'text-[#D97706]'
                            : q.approvalStatus === 'REJECTED'
                            ? 'text-[#DC2626]'
                            : 'text-[#16A34A]'
                        }`}
                      >
                        {q.approvalStatus}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setPrintModal({ mode: 'QUOTATION', record: q })}
                        className="text-[11px] font-mono text-[#24211D] hover:text-[#9A783E] cursor-pointer"
                      >
                        PDF / Margin XLS
                      </button>
                      {q.approvalStatus === 'PENDING_APPROVAL' && snap.actor.canApprovePricing && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            runAction(
                              () => erpApi.updateCommercialQuotationStatus(q.id, { action: 'APPROVE' }),
                              `Approved negotiated pricing on ${q.quotationNumber}.`
                            )
                          }
                          className="text-[11px] font-mono text-[#16A34A] hover:underline cursor-pointer"
                        >
                          Approve
                        </button>
                      )}
                      {q.approvalStatus === 'APPROVED' && q.status !== 'ACCEPTED' && q.status !== 'CONVERTED' && (
                        <button
                          type="button"
                          onClick={() =>
                            setAcceptModal({
                              type: 'QUOTATION',
                              record: q,
                              acceptedByName: q.clientName,
                              acceptedByEmail: q.clientEmail,
                              acceptanceRef: `QT-OK-${q.quotationNumber}`,
                              notes: ''
                            })
                          }
                          className="text-[11px] font-mono text-[#16A34A] hover:underline cursor-pointer"
                        >
                          Accept
                        </button>
                      )}
                      {q.approvalStatus === 'APPROVED' && !q.convertedOrderId && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            runAction(async () => {
                              await erpApi.convertCommercialToOrder({ quotationId: q.id });
                              setPropTab('order_fulfilment');
                            }, `Converted ${q.quotationNumber} into B2B Sales Order.`)
                          }
                          className="px-2 py-0.5 bg-[#24211D] text-white text-[10px] font-mono cursor-pointer"
                        >
                          Sales Order →
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Catalogue-Linked Quotation Builder Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runAction(async () => {
                const res = await erpApi.saveCommercialQuotation(qtForm);
                if (res?.requiresPricingApproval) {
                  notify(
                    `Quotation ${res.quotation.quotationNumber} queued for Internal Pricing Approval (${qtCalc.maxDiscPct}% discount).`,
                    'error'
                  );
                }
                setQtForm({
                  ...qtForm,
                  clientName: '',
                  clientEmail: '',
                  clientGstin: '',
                  notes: ''
                });
              }, 'Catalogue GST Quotation generated & pricing audit logged.');
            }}
            className="border border-[#DED7CC] bg-white p-4 space-y-3 h-fit"
          >
            <h3 className="text-xs font-mono uppercase font-semibold border-b border-[#DED7CC] pb-2">
              Issue Catalogue GST Quotation
            </h3>
            <select
              value={qtForm.leadId}
              onChange={(e) => {
                const l = snap.leads.find((x) => x.id === e.target.value);
                if (l) launchQuotationFromLeadOrProposal(l, false);
              }}
              className="w-full px-2.5 py-2 border border-[#DED7CC] bg-[#FAF8F4] text-xs font-mono"
            >
              <option value="">-- Optional: Pull CRM Lead --</option>
              {snap.leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.leadNumber} · {l.companyName}
                </option>
              ))}
            </select>

            <input
              required
              placeholder="Client / Corporate Name"
              value={qtForm.clientName}
              onChange={(e) => setQtForm({ ...qtForm, clientName: e.target.value })}
              className="w-full px-3 py-2 border border-[#DED7CC] bg-[#FAF8F4] text-xs"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                required
                type="email"
                placeholder="Client Email"
                value={qtForm.clientEmail}
                onChange={(e) => setQtForm({ ...qtForm, clientEmail: e.target.value })}
                className="w-full px-2.5 py-2 border border-[#DED7CC] bg-[#FAF8F4] text-xs"
              />
              <input
                placeholder="Supply State"
                value={qtForm.placeOfSupplyState}
                onChange={(e) => setQtForm({ ...qtForm, placeOfSupplyState: e.target.value })}
                className="w-full px-2.5 py-2 border border-[#DED7CC] bg-[#FAF8F4] text-xs"
              />
            </div>
            <input
              placeholder="Client GSTIN (optional)"
              value={qtForm.clientGstin}
              onChange={(e) => setQtForm({ ...qtForm, clientGstin: e.target.value })}
              className="w-full px-3 py-2 border border-[#DED7CC] bg-[#FAF8F4] font-mono text-xs"
            />

            {/* Catalogue Items */}
            <div className="space-y-2 border-t border-[#DED7CC] pt-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-[#9A783E] font-semibold">
                  Catalogue Line Items (HSN 33030050)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const c = catalogue[0];
                    if (!c) return;
                    setQtForm({
                      ...qtForm,
                      items: [
                        ...qtForm.items,
                        {
                          sku: c.sku,
                          description: `${c.name} (${c.size})`,
                          qty: 10,
                          catalogueUnitPriceInr: c.catalogueUnitPriceInr,
                          unitPriceInr: c.catalogueUnitPriceInr,
                          unitManufacturingCostInr: c.unitManufacturingCostInr,
                          pricingReason: ''
                        }
                      ]
                    });
                  }}
                  className="text-[11px] font-mono text-[#9A783E] hover:underline cursor-pointer"
                >
                  + Add SKU
                </button>
              </div>

              {qtForm.items.map((it: any, idx: number) => (
                <div key={idx} className="p-2.5 border border-[#DED7CC] bg-[#FAF8F4] space-y-2 text-xs">
                  <select
                    value={it.sku}
                    onChange={(e) => {
                      const c = catalogue.find((x) => x.sku === e.target.value);
                      if (!c) return;
                      const next = [...qtForm.items];
                      next[idx] = {
                        ...next[idx],
                        sku: c.sku,
                        description: `${c.name} (${c.size})`,
                        catalogueUnitPriceInr: c.catalogueUnitPriceInr,
                        unitPriceInr: c.catalogueUnitPriceInr,
                        unitManufacturingCostInr: c.unitManufacturingCostInr
                      };
                      setQtForm({ ...qtForm, items: next });
                    }}
                    className="w-full px-2 py-1.5 border border-[#DED7CC] bg-white text-xs"
                  >
                    {catalogue.map((c) => (
                      <option key={c.sku} value={c.sku}>
                        {c.name} · {c.size} (Base {fmt(c.catalogueUnitPriceInr)})
                      </option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-mono text-[#686158]">Qty</label>
                      <input
                        type="number"
                        min={1}
                        value={it.qty}
                        onChange={(e) => {
                          const next = [...qtForm.items];
                          next[idx] = { ...next[idx], qty: Number(e.target.value) };
                          setQtForm({ ...qtForm, items: next });
                        }}
                        className="w-full px-2 py-1 border border-[#DED7CC] bg-white font-mono text-xs tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-mono text-[#686158]">Negotiated Rate Ex-GST</label>
                      <input
                        type="number"
                        min={1}
                        value={it.unitPriceInr}
                        onChange={(e) => {
                          const next = [...qtForm.items];
                          next[idx] = { ...next[idx], unitPriceInr: Number(e.target.value) };
                          setQtForm({ ...qtForm, items: next });
                        }}
                        className="w-full px-2 py-1 border border-[#DED7CC] bg-white font-mono text-xs tabular-nums"
                      />
                    </div>
                  </div>
                  {it.unitPriceInr < it.catalogueUnitPriceInr && (
                    <input
                      placeholder="Mandatory reason for negotiated discount..."
                      value={it.pricingReason}
                      onChange={(e) => {
                        const next = [...qtForm.items];
                        next[idx] = { ...next[idx], pricingReason: e.target.value };
                        setQtForm({ ...qtForm, items: next });
                      }}
                      className="w-full px-2 py-1 border border-[#9A783E] bg-white text-[11px]"
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-mono text-[#686158]">Extra Discount (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={qtForm.discountInr}
                  onChange={(e) => setQtForm({ ...qtForm, discountInr: Number(e.target.value) })}
                  className="w-full px-2.5 py-1.5 border border-[#DED7CC] bg-[#FAF8F4] font-mono text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-[#686158]">Freight (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={qtForm.freightInr}
                  onChange={(e) => setQtForm({ ...qtForm, freightInr: Number(e.target.value) })}
                  className="w-full px-2.5 py-1.5 border border-[#DED7CC] bg-[#FAF8F4] font-mono text-xs tabular-nums"
                />
              </div>
            </div>

            {/* Live Margin & Approval Preview */}
            <div className="p-3 border border-[#DED7CC] bg-[#FAF8F4] space-y-1 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-[#686158]">Net Total + GST + Freight</span>
                <span className="font-bold text-[#24211D] tabular-nums">{fmt(qtCalc.grandTotal)}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-[#686158]">Est. Internal Gross Margin</span>
                <span className="text-[#16A34A] tabular-nums">
                  {fmt(qtCalc.marginInr)} ({qtCalc.marginPct}%)
                </span>
              </div>
              {qtCalc.requiresApproval && (
                <div className="pt-1 flex items-center gap-1.5 text-[11px] text-[#D97706]">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                  <span>Discount {qtCalc.maxDiscPct}% triggers Internal Approval lock before sending</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono uppercase cursor-pointer"
            >
              Issue Catalogue GST Quotation
            </button>
          </form>
        </div>
      )}

      {/* PROP TAB 4: B2B SALES ORDER -> INVOICE -> PAYMENT -> FULFILMENT */}
      {propTab === 'order_fulfilment' && (
        <div className="border border-[#DED7CC] bg-white overflow-x-auto">
          <div className="px-4 py-3 border-b border-[#DED7CC] bg-[#FAF8F4] flex items-center justify-between">
            <span className="text-xs font-mono uppercase font-semibold">
              B2B Order-to-Cash Execution (Sales Order → GST Invoice → Payment → Fulfilment)
            </span>
            <button
              type="button"
              onClick={() => downloadCsvFile('fragmore-b2b-sales-orders.csv', snap.b2bOrders)}
              className="text-[11px] font-mono text-[#9A783E] hover:underline cursor-pointer"
            >
              Export CSV
            </button>
          </div>
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
              <tr>
                <th className="py-2.5 px-3">B2B Order #</th>
                <th className="py-2.5 px-3">Client / Email</th>
                <th className="py-2.5 px-3 text-right">Order Value</th>
                <th className="py-2.5 px-3">Payment Status</th>
                <th className="py-2.5 px-3">Fulfilment / AWB</th>
                <th className="py-2.5 px-3 text-right">12-Stage Progression</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DED7CC]">
              {snap.b2bOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center font-mono text-[#686158]">
                    No B2B Sales Orders generated yet. Accept a Corporate Proposal or Quotation and click Create Order.
                  </td>
                </tr>
              ) : (
                snap.b2bOrders.map((ord) => {
                  const ops: any = ord.opsMetadata || {};
                  const linkedInv = snap.invoices.find((i) => i.id === ops.invoiceId);
                  return (
                    <tr key={ord.id} className="hover:bg-[#FAF8F4]">
                      <td className="py-2.5 px-3 font-mono font-bold text-[#9A783E]">
                        {ord.orderNumber}
                        <span className="block text-[10px] font-normal text-[#686158]">{ord.orderStatus}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-[#24211D] block">{ord.customerName}</span>
                        <span className="text-[11px] text-[#686158]">{ord.customerEmail}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums">
                        {fmt(ord.totalAmount)}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px]">
                        <span className={ord.paymentStatus === 'PAID' ? 'text-[#16A34A] font-semibold' : 'text-[#D97706]'}>
                          {ord.paymentStatus}
                        </span>
                        {linkedInv && (
                          <span className="block text-[10px] text-[#686158]">
                            {linkedInv.invoiceNumber} (Due {fmt(linkedInv.balanceDueInr)})
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-[#686158]">
                        {ord.awbNumber ? (
                          <span>
                            {ord.courierName} · {ord.awbNumber}
                          </span>
                        ) : (
                          <span>Awaiting Dispatch</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right space-x-2 whitespace-nowrap">
                        {!linkedInv ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              runAction(
                                () =>
                                  erpApi.progressCommercialOrder(ord.id, {
                                    action: 'CREATE_INVOICE',
                                    quotationId: ops.quotationId
                                  }),
                                `Generated GST Invoice & AR Journal for ${ord.orderNumber}.`
                              )
                            }
                            className="px-2.5 py-1 bg-[#24211D] text-white text-[11px] font-mono inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Receipt className="w-3 h-3" /> Issue GST Invoice
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => onPrintInvoice(linkedInv)}
                              className="text-[11px] font-mono text-[#24211D] hover:text-[#9A783E] cursor-pointer"
                            >
                              Invoice PDF
                            </button>
                            {Number(linkedInv.balanceDueInr) > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setOrderProgressModal({
                                    order: ord,
                                    mode: 'PAYMENT',
                                    method: 'NEFT',
                                    referenceNumber: `UTR-${Date.now().toString().slice(-6)}`,
                                    amountInr: Number(linkedInv.balanceDueInr),
                                    courierName: 'BlueDart Luxury Air',
                                    awbNumber: ''
                                  })
                                }
                                className="px-2.5 py-1 border border-[#16A34A] text-[#16A34A] text-[11px] font-mono inline-flex items-center gap-1 cursor-pointer"
                              >
                                <CreditCard className="w-3 h-3" /> Record Payment
                              </button>
                            )}
                          </>
                        )}
                        {!ord.awbNumber && (
                          <button
                            type="button"
                            onClick={() =>
                              setOrderProgressModal({
                                order: ord,
                                mode: 'DISPATCH',
                                method: 'NEFT',
                                referenceNumber: '',
                                amountInr: 0,
                                courierName: 'BlueDart Luxury Air',
                                awbNumber: `BD-${Date.now().toString().slice(-7)}`
                              })
                            }
                            className="px-2.5 py-1 border border-[#9A783E] text-[#9A783E] text-[11px] font-mono inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Truck className="w-3 h-3" /> Dispatch
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* PROP TAB 5: PERMISSION-CONTROLLED PRICING AUDIT LOG */}
      {propTab === 'pricing_audit' && (
        <div className="border border-[#DED7CC] bg-white overflow-x-auto">
          <div className="px-4 py-3 border-b border-[#DED7CC] bg-[#FAF8F4] flex items-center justify-between">
            <span className="text-xs font-mono uppercase font-semibold">
              Immutable Pricing Override &amp; Discount Approval Log
            </span>
            <button
              type="button"
              onClick={() =>
                downloadExcelSpreadsheet(
                  'fragmore-pricing-audit-log.xls',
                  'FRAGMORÉ Pricing Override Audit Ledger',
                  snap.pricingAuditLogs
                )
              }
              className="text-[11px] font-mono text-[#9A783E] hover:underline cursor-pointer"
            >
              Export Audit Excel
            </button>
          </div>
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
              <tr>
                <th className="py-2.5 px-3">Document</th>
                <th className="py-2.5 px-3">SKU / Description</th>
                <th className="py-2.5 px-3 text-right">Catalogue Rate</th>
                <th className="py-2.5 px-3 text-right">Negotiated Rate</th>
                <th className="py-2.5 px-3 text-right">Disc %</th>
                <th className="py-2.5 px-3">Reason &amp; Actor</th>
                <th className="py-2.5 px-3">Approval</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DED7CC]">
              {snap.pricingAuditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-[#FAF8F4]">
                  <td className="py-2.5 px-3 font-mono font-bold text-[#9A783E]">
                    {log.entityNumber}
                    <span className="block text-[10px] font-normal text-[#686158]">{log.entityType}</span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="font-semibold text-[#24211D] block">{log.itemDescription}</span>
                    <span className="text-[10px] font-mono text-[#686158]">{log.sku}</span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#686158]">
                    {fmt(log.catalogueUnitPriceInr)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-[#24211D]">
                    {fmt(log.newUnitPriceInr)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-[#D97706]">
                    {log.discountPct}%
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="block text-[#24211D]">{log.reason}</span>
                    <span className="text-[10px] font-mono text-[#686158]">
                      By {log.changedByEmail} ({log.changedByRole})
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[11px]">
                    <span
                      className={
                        log.approvalStatus === 'PENDING_APPROVAL'
                          ? 'text-[#D97706] font-semibold'
                          : log.approvalStatus === 'REJECTED'
                          ? 'text-[#DC2626]'
                          : 'text-[#16A34A]'
                      }
                    >
                      {log.approvalStatus}
                    </span>
                    {log.approvedByEmail && (
                      <span className="block text-[10px] text-[#686158]">{log.approvedByEmail}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* BRANDED PDF PROPOSAL / QUOTATION MODAL */}
      {printModal && (
        <CommercialProposalPrintModal
          mode={printModal.mode}
          record={printModal.record}
          catalogue={catalogue}
          onClose={() => setPrintModal(null)}
        />
      )}

      {/* CLIENT ACCEPTANCE MODAL */}
      {acceptModal && (
        <div className="fixed inset-0 z-[105] bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runAction(async () => {
                if (acceptModal.type === 'PROPOSAL') {
                  await erpApi.updateCommercialProposalStatus(acceptModal.record.id, {
                    action: 'ACCEPT',
                    acceptedByName: acceptModal.acceptedByName,
                    acceptedByEmail: acceptModal.acceptedByEmail,
                    acceptanceRef: acceptModal.acceptanceRef,
                    notes: acceptModal.notes
                  });
                } else {
                  await erpApi.updateCommercialQuotationStatus(acceptModal.record.id, {
                    action: 'ACCEPT',
                    acceptedByName: acceptModal.acceptedByName,
                    acceptedByEmail: acceptModal.acceptedByEmail,
                    notes: acceptModal.notes
                  });
                }
                setAcceptModal(null);
              }, 'Client acceptance recorded and workflow advanced to ACCEPTED.');
            }}
            className="w-full max-w-md bg-white border border-[#DED7CC] p-5 space-y-3"
          >
            <h3 className="text-sm font-serif uppercase font-semibold text-[#24211D]">
              Record Client Acceptance ({acceptModal.type === 'PROPOSAL' ? acceptModal.record.proposalNumber : acceptModal.record.quotationNumber})
            </h3>
            <input
              required
              placeholder="Client Signatory Name"
              value={acceptModal.acceptedByName}
              onChange={(e) => setAcceptModal({ ...acceptModal, acceptedByName: e.target.value })}
              className="w-full px-3 py-2 border border-[#DED7CC] bg-[#FAF8F4] text-xs"
            />
            <input
              required
              type="email"
              placeholder="Signatory Email"
              value={acceptModal.acceptedByEmail}
              onChange={(e) => setAcceptModal({ ...acceptModal, acceptedByEmail: e.target.value })}
              className="w-full px-3 py-2 border border-[#DED7CC] bg-[#FAF8F4] text-xs"
            />
            <input
              placeholder="Client PO / Acceptance Reference"
              value={acceptModal.acceptanceRef}
              onChange={(e) => setAcceptModal({ ...acceptModal, acceptanceRef: e.target.value })}
              className="w-full px-3 py-2 border border-[#DED7CC] bg-[#FAF8F4] text-xs font-mono"
            />
            <textarea
              rows={2}
              placeholder="Notes (optional)"
              value={acceptModal.notes}
              onChange={(e) => setAcceptModal({ ...acceptModal, notes: e.target.value })}
              className="w-full px-3 py-2 border border-[#DED7CC] bg-[#FAF8F4] text-xs"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAcceptModal(null)}
                className="px-3 py-1.5 border border-[#DED7CC] text-xs font-mono cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-1.5 bg-[#16A34A] text-white text-xs font-mono cursor-pointer"
              >
                Confirm Acceptance
              </button>
            </div>
          </form>
        </div>
      )}

      {/* VERSION COMPARISON MODAL */}
      {versionCompareModal && (
        <div className="fixed inset-0 z-[105] bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-white border border-[#DED7CC] p-5 space-y-4 max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#DED7CC] pb-3">
              <div>
                <p className="text-[10px] font-mono uppercase text-[#9A783E]">Proposal Version Comparison</p>
                <h3 className="text-base font-serif font-semibold text-[#24211D]">
                  {versionCompareModal.baseProposal.proposalNumber} (v{versionCompareModal.baseProposal.proposalVersionNumber}) vs{' '}
                  {versionCompareModal.revisedProposal.proposalNumber} (v{versionCompareModal.revisedProposal.proposalVersionNumber})
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    downloadExcelSpreadsheet(
                      `version_compare_${versionCompareModal.baseProposal.proposalNumber}_vs_${versionCompareModal.revisedProposal.proposalNumber}.xls`,
                      'Proposal Version Diff',
                      versionCompareModal.lineDiffs
                    )
                  }
                  className="px-3 py-1 border border-[#DED7CC] text-xs font-mono hover:border-[#9A783E] cursor-pointer"
                >
                  Export Diff (.xls)
                </button>
                <button
                  type="button"
                  onClick={() => setVersionCompareModal(null)}
                  className="px-3 py-1 border border-[#DED7CC] text-xs font-mono cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="p-2.5 border border-[#DED7CC] bg-[#FAF8F4]">
                <span className="text-[10px] text-[#686158] block">Subtotal Δ</span>
                <span className="font-bold tabular-nums">{fmt(versionCompareModal.summaryDiff.subtotalDeltaInr)}</span>
              </div>
              <div className="p-2.5 border border-[#DED7CC] bg-[#FAF8F4]">
                <span className="text-[10px] text-[#686158] block">Setup + Staffing Δ</span>
                <span className="font-bold tabular-nums">
                  {fmt(versionCompareModal.summaryDiff.setupDeltaInr + versionCompareModal.summaryDiff.staffingDeltaInr)}
                </span>
              </div>
              <div className="p-2.5 border border-[#DED7CC] bg-[#FAF8F4]">
                <span className="text-[10px] text-[#686158] block">Tax Δ</span>
                <span className="font-bold tabular-nums">{fmt(versionCompareModal.summaryDiff.taxDeltaInr)}</span>
              </div>
              <div className="p-2.5 border border-[#9A783E] bg-[#FAF8F4]">
                <span className="text-[10px] text-[#9A783E] block">Grand Total Δ</span>
                <span className="font-bold text-[#24211D] tabular-nums">
                  {fmt(versionCompareModal.summaryDiff.grandTotalDeltaInr)}
                </span>
              </div>
            </div>

            <table className="w-full text-left text-xs border border-[#DED7CC]">
              <thead className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                <tr>
                  <th className="py-2 px-3">SKU / Line</th>
                  <th className="py-2 px-3 text-right">Qty A → B</th>
                  <th className="py-2 px-3 text-right">Unit Rate A → B</th>
                  <th className="py-2 px-3 text-right">Line Total Δ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DED7CC]">
                {versionCompareModal.lineDiffs.map((ld: any, idx: number) => (
                  <tr key={idx}>
                    <td className="py-2 px-3">
                      <span className="font-medium block">{ld.description}</span>
                      <span className="text-[10px] font-mono text-[#686158]">{ld.sku}</span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">
                      {ld.qtyA} → {ld.qtyB}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">
                      {fmt(ld.unitPriceA)} → {fmt(ld.unitPriceB)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold tabular-nums text-[#9A783E]">
                      {fmt(ld.lineTotalDelta)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PAYMENT OR DISPATCH FULFILMENT MODAL */}
      {orderProgressModal && (
        <div className="fixed inset-0 z-[105] bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runAction(async () => {
                if (orderProgressModal.mode === 'PAYMENT') {
                  await erpApi.progressCommercialOrder(orderProgressModal.order.id, {
                    action: 'RECORD_PAYMENT',
                    paymentMethod: orderProgressModal.method,
                    referenceNumber: orderProgressModal.referenceNumber,
                    amountInr: orderProgressModal.amountInr
                  });
                } else {
                  await erpApi.progressCommercialOrder(orderProgressModal.order.id, {
                    action: 'DISPATCH_FULFILMENT',
                    courierName: orderProgressModal.courierName,
                    awbNumber: orderProgressModal.awbNumber,
                    orderStatus: 'SHIPPED'
                  });
                }
                setOrderProgressModal(null);
              }, orderProgressModal.mode === 'PAYMENT' ? 'Payment recorded & General Ledger updated.' : 'Order dispatched & stage moved to FULFILMENT.');
            }}
            className="w-full max-w-md bg-white border border-[#DED7CC] p-5 space-y-3"
          >
            <h3 className="text-sm font-serif uppercase font-semibold text-[#24211D]">
              {orderProgressModal.mode === 'PAYMENT'
                ? `Record Payment (${orderProgressModal.order.orderNumber})`
                : `Dispatch Fulfilment (${orderProgressModal.order.orderNumber})`}
            </h3>
            {orderProgressModal.mode === 'PAYMENT' ? (
              <>
                <select
                  value={orderProgressModal.method}
                  onChange={(e) => setOrderProgressModal({ ...orderProgressModal, method: e.target.value })}
                  className="w-full px-3 py-2 border border-[#DED7CC] bg-[#FAF8F4] text-xs font-mono"
                >
                  <option value="NEFT">NEFT / RTGS</option>
                  <option value="UPI">Corporate UPI</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="RAZORPAY">Razorpay Payment Link</option>
                </select>
                <input
                  required
                  placeholder="UTR / Reference Number"
                  value={orderProgressModal.referenceNumber}
                  onChange={(e) => setOrderProgressModal({ ...orderProgressModal, referenceNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-[#DED7CC] bg-[#FAF8F4] text-xs font-mono"
                />
                <input
                  required
                  type="number"
                  min={1}
                  value={orderProgressModal.amountInr}
                  onChange={(e) => setOrderProgressModal({ ...orderProgressModal, amountInr: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-[#DED7CC] bg-[#FAF8F4] text-xs font-mono tabular-nums"
                />
              </>
            ) : (
              <>
                <input
                  required
                  placeholder="Courier Partner"
                  value={orderProgressModal.courierName}
                  onChange={(e) => setOrderProgressModal({ ...orderProgressModal, courierName: e.target.value })}
                  className="w-full px-3 py-2 border border-[#DED7CC] bg-[#FAF8F4] text-xs"
                />
                <input
                  required
                  placeholder="AWB Tracking Number"
                  value={orderProgressModal.awbNumber}
                  onChange={(e) => setOrderProgressModal({ ...orderProgressModal, awbNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-[#DED7CC] bg-[#FAF8F4] text-xs font-mono"
                />
              </>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setOrderProgressModal(null)}
                className="px-3 py-1.5 border border-[#DED7CC] text-xs font-mono cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-1.5 bg-[#24211D] text-white text-xs font-mono cursor-pointer"
              >
                Confirm &amp; Post
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
