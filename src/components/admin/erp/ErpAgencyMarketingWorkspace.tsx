import React, { useEffect, useState, useCallback } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Send,
  History,
  Sparkles,
  Truck,
  Calendar,
  FileCheck2
} from 'lucide-react';
import { erpApi, type ErpAgencyHrSnapshot } from '../../../lib/erpApi';
import { ErpTableExportBar } from './ErpUniversalExportModal';

interface Props {
  onParentRefresh: () => Promise<void>;
  notify: (msg: string, type?: 'success' | 'error') => void;
}

const APPROVAL_STAGES = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'CHANGES_REQUESTED',
  'APPROVED',
  'PUBLISHED'
] as const;

export const ErpAgencyMarketingWorkspace: React.FC<Props> = ({ onParentRefresh, notify }) => {
  const [snap, setSnap] = useState<ErpAgencyHrSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'creatives' | 'campaigns' | 'influencers' | 'agency' | 'performance'
  >('creatives');

  // Selected Creative for Revision History & Founder Review
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState('');

  // Creative Studio Form
  const [creativeForm, setCreativeForm] = useState({
    id: '',
    title: '',
    channel: 'INSTAGRAM',
    creativeFormat: 'REEL',
    strategyType: 'BRAND_STORYTELLING',
    targetAudience: 'Discerning Fine-Fragrance Collectors (Tier-1 Metro)',
    budgetInr: 85000,
    scheduledDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
    storytellingAngle: 'Cold-macerated 32% Extrait de Parfum — composed for individuality, never mass-discounted.',
    valueAddOffer: 'Complimentary 2ML Numbered Discovery Vial + Scent Blotter',
    limitedEditionCode: '',
    adScript: '',
    captionCopy: '',
    deliverableUrl: '',
    changeSummary: 'Initial agency creative submission',
    submitForApproval: true
  });
  const [guardCheck, setGuardCheck] = useState<{
    isLuxuryCompliant: boolean;
    detectedDiscountTriggers: string[];
    guidance: string;
  } | null>(null);

  // Campaign Form
  const [campForm, setCampForm] = useState({
    name: '',
    channel: 'META_ADS',
    strategyType: 'BRAND_STORYTELLING',
    budgetInr: 150000,
    storytellingTheme: 'Ingredient Provenance & Personal Olfactory Signature',
    valueAddGift: '2ML Discovery Atelier Vial Trio',
    limitedEditionId: '',
    discountExceptionApproved: false
  });

  // Influencer & Seeding Forms
  const [infForm, setInfForm] = useState({
    name: '',
    handle: '',
    platform: 'INSTAGRAM',
    followersCount: 85000,
    commissionPercent: 12
  });
  const [seedForm, setSeedForm] = useState({
    influencerId: '',
    fragranceName: 'SUEDE — Oud & Leather Extrait',
    volumeMl: 10,
    quantityUnits: 2,
    campaignName: 'Atelier Discovery Seeding',
    deliverableTitle: 'First-Impression Storytelling Reel (Non-Discount)',
    recipientAddress: 'Bandra West, Mumbai 400050'
  });
  const [dispatchForm, setDispatchForm] = useState({
    sampleId: '',
    courierName: 'BlueDart Luxury Air',
    trackingNumber: '',
    feedbackStatus: 'PENDING',
    publishedUrl: ''
  });

  // Agency Staff & Invoice Forms
  const [staffForm, setStaffForm] = useState({
    fullName: '',
    email: '',
    roleTitle: 'Editorial Art Director',
    specialty: 'Luxury Visual Identity & Bottle Still-Life',
    accessLevel: 'CREATOR'
  });
  const [invForm, setInvForm] = useState({
    billingMonth: new Date().toISOString().slice(0, 7),
    description: 'Monthly Luxury Brand Retainer & Campaign Production',
    retainerInr: 95000,
    productionExtrasInr: 15000,
    gstRatePct: 18,
    status: 'SUBMITTED'
  });

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    try {
      const data = await erpApi.getAgencyHrSnapshot();
      setSnap(data);
      if (data.influencers.length && !seedForm.influencerId) {
        setSeedForm((prev) => ({ ...prev, influencerId: data.influencers[0].id }));
      }
      if (data.seedingSamples.length && !dispatchForm.sampleId) {
        setDispatchForm((prev) => ({ ...prev, sampleId: data.seedingSamples[0].id }));
      }
    } catch (e: any) {
      notify(e?.message || 'Failed to load Marketing Agency Workspace', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

  // Live Luxury Brand Philosophy Guardrail check as user types copy
  useEffect(() => {
    const combined = `${creativeForm.title} ${creativeForm.adScript} ${creativeForm.captionCopy} ${creativeForm.storytellingAngle}`;
    const discountRx = /\b(\d+\s*%\s*off|flat\s*\d+\s*off|flash\s*sale|clearance|bogo|buy\s*1\s*get\s*1|heavy\s*discount|steal\s*deal)\b/gi;
    const matches = combined.match(discountRx) || [];
    setGuardCheck({
      isLuxuryCompliant: matches.length === 0 && creativeForm.strategyType !== 'DISCOUNT_EXCEPTION',
      detectedDiscountTriggers: matches,
      guidance:
        matches.length > 0
          ? `Habitual discount trigger detected (${matches.join(', ')}). Replace with fragrance storytelling, discovery vials, or value-add coffret gifts.`
          : 'Copy honors FRAGMORÉ luxury-first positioning: aspiration, individuality & olfactory storytelling.'
    });
  }, [creativeForm.title, creativeForm.adScript, creativeForm.captionCopy, creativeForm.storytellingAngle, creativeForm.strategyType]);

  const runMutation = async (fn: () => Promise<void>, successMessage: string) => {
    setBusy(true);
    try {
      await fn();
      await loadSnapshot();
      await onParentRefresh();
      notify(successMessage, 'success');
    } catch (e: any) {
      notify(e?.message || 'Operation failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading && !snap) {
    return (
      <div className="p-10 text-center text-xs font-mono text-[#686158]">
        Loading FRAGMORÉ Collaborative Marketing Agency Studio...
      </div>
    );
  }
  if (!snap) return null;

  const agency = snap.agencyProfiles[0] || {};
  const canSeeFinancials = snap.securityBoundary.canSeeSensitiveFinancials;
  const isFounderOrApprover =
    snap.actor.isSuperAdmin || Boolean(snap.actor.permissions?.marketing?.canApprove);

  const totalBudget = snap.campaigns.reduce((s, c) => s + Number(c.budget || 0), 0);
  const totalSpend = snap.campaigns.reduce((s, c) => s + Number(c.spend || 0), 0);
  const totalRevenue = snap.campaigns.reduce((s, c) => s + Number(c.revenue || 0), 0);
  const blendedRoas = totalSpend > 0 ? (totalRevenue / totalSpend).toFixed(2) : '0.00';

  const selectedAsset = snap.marketingAssets.find((a) => a.id === selectedAssetId) || snap.marketingAssets[0] || null;
  const selectedRevisions = selectedAsset
    ? snap.creativeRevisions.filter((r) => r.assetId === selectedAsset.id)
    : [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header & Universal Export */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-[#DED7CC] pb-4">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-widest text-[#9A783E]">
            Module 13 · Collaborative Luxury Brand &amp; Agency Workspace
          </p>
          <h2 className="font-serif text-2xl sm:text-3xl text-[#24211D] uppercase tracking-wider mt-1">
            Marketing Agency, Content Studio &amp; Creator Seeding
          </h2>
          <p className="text-xs text-[#686158] mt-1">
            Luxury-First Guardrail Active: Storytelling, Individuality, Discovery Samples, Value-Add Coffrets &amp; Limited Editions.
          </p>
        </div>
        <ErpTableExportBar
          reportKey="marketing_campaigns"
          title="FRAGMORÉ Luxury Marketing & Attribution Ledger"
          notify={notify}
        />
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 border border-[#DED7CC] bg-[#FFFFFF] divide-y sm:divide-y-0 sm:divide-x divide-[#DED7CC] rounded-lg">
        <div className="p-4">
          <span className="text-[10px] font-mono uppercase text-[#686158] block">Agency Partner</span>
          <span className="text-sm font-semibold text-[#24211D] block truncate mt-0.5">
            {agency.agencyName || 'Maison Lumière'}
          </span>
          <span className="text-[10px] font-mono text-[#9A783E]">{snap.agencyStaff.length} Active Staff</span>
        </div>
        <div className="p-4">
          <span className="text-[10px] font-mono uppercase text-[#686158] block">Campaign Budget</span>
          <span className="text-xl font-mono font-bold tabular-nums text-[#24211D]">
            {canSeeFinancials ? `₹${totalBudget.toLocaleString('en-IN')}` : 'Restricted'}
          </span>
        </div>
        <div className="p-4">
          <span className="text-[10px] font-mono uppercase text-[#686158] block">Authorized Spend</span>
          <span className="text-xl font-mono font-bold tabular-nums text-[#24211D]">
            {canSeeFinancials ? `₹${totalSpend.toLocaleString('en-IN')}` : 'Restricted'}
          </span>
        </div>
        <div className="p-4">
          <span className="text-[10px] font-mono uppercase text-[#686158] block">Attributed Revenue</span>
          <span className="text-xl font-mono font-bold tabular-nums text-[#9A783E]">
            {canSeeFinancials ? `₹${totalRevenue.toLocaleString('en-IN')}` : 'Restricted'}
          </span>
        </div>
        <div className="p-4">
          <span className="text-[10px] font-mono uppercase text-[#686158] block">Blended ROAS</span>
          <span className="text-xl font-mono font-bold tabular-nums text-emerald-700">{blendedRoas}x</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-[#DED7CC] pb-3">
        {[
          { id: 'creatives', label: `Content Calendar & Approvals (${snap.marketingAssets.length})` },
          { id: 'campaigns', label: `Luxury Campaigns & Ad Sync (${snap.campaigns.length})` },
          { id: 'influencers', label: `Creator Seeding & Dispatch (${snap.influencers.length})` },
          { id: 'agency', label: `Agency Profile, Staff & Billing (${snap.agencyInvoices.length})` },
          { id: 'performance', label: 'Monthly Performance Reports' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3.5 py-2 rounded text-xs font-mono uppercase cursor-pointer transition-colors ${
              activeTab === tab.id
                ? 'bg-[#24211D] text-[#FAF8F4]'
                : 'bg-[#FFFFFF] border border-[#DED7CC] text-[#24211D] hover:border-[#9A783E]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: MONTHLY CONTENT CALENDAR, CREATIVE BRIEFS, SCRIPTS, FOUNDER APPROVAL & REVISION HISTORY */}
      {activeTab === 'creatives' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Calendar & Deliverables Table + Selected Asset Founder Review */}
          <div className="lg:col-span-7 space-y-5">
            <div className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-[#FAF8F4] border-b border-[#DED7CC] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#9A783E]" />
                  <h3 className="text-xs font-mono uppercase font-semibold text-[#24211D]">
                    Monthly Content Calendar &amp; Creative Approval Pipeline
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-[#686158]">Click row to inspect revisions</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                    <tr>
                      <th className="py-2.5 px-3">Date / Brief #</th>
                      <th className="py-2.5 px-3">Deliverable &amp; Strategy</th>
                      <th className="py-2.5 px-3">Channel</th>
                      <th className="py-2.5 px-3 text-right">Rev</th>
                      <th className="py-2.5 px-3">Approval Stage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DED7CC]">
                    {snap.marketingAssets.map((m) => {
                      const isSelected = selectedAsset?.id === m.id;
                      return (
                        <tr
                          key={m.id}
                          onClick={() => setSelectedAssetId(m.id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-[#FAF8F4]' : 'hover:bg-[#FAF8F4]/60'
                          }`}
                        >
                          <td className="py-2.5 px-3 font-mono tabular-nums">
                            <span className="text-[#9A783E] font-bold block">{m.briefCode}</span>
                            <span className="text-[10px] text-[#686158]">{m.scheduledDate || 'Unscheduled'}</span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-[#24211D] block">{m.title}</span>
                            <span className="text-[10px] font-mono text-[#686158]">{m.strategyType}</span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-[#686158]">
                            {m.channel} · {m.creativeFormat}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-right tabular-nums">v{m.currentRevision || 1}</td>
                          <td className="py-2.5 px-3 font-mono text-[11px]">
                            <span className="inline-flex items-center gap-1.5">
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  m.approvalStage === 'APPROVED' || m.approvalStage === 'PUBLISHED'
                                    ? 'bg-emerald-600'
                                    : m.approvalStage === 'CHANGES_REQUESTED'
                                    ? 'bg-amber-600'
                                    : 'bg-[#9A783E]'
                                }`}
                              />
                              <span>{m.approvalStage}</span>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Selected Creative Inspector: Ad Script, Caption, Founder Approval & Revision History */}
            {selectedAsset && (
              <div className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-5 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#DED7CC] pb-3">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-[#9A783E]">
                      {selectedAsset.briefCode} · Revision v{selectedAsset.currentRevision || 1} · Stage: {selectedAsset.approvalStage}
                    </span>
                    <h4 className="font-serif text-lg text-[#24211D]">{selectedAsset.title}</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setCreativeForm({
                        id: selectedAsset.id,
                        title: selectedAsset.title,
                        channel: selectedAsset.channel,
                        creativeFormat: selectedAsset.creativeFormat,
                        strategyType: selectedAsset.strategyType || 'BRAND_STORYTELLING',
                        targetAudience: selectedAsset.targetAudience || '',
                        budgetInr: Number(selectedAsset.budgetInr || 0),
                        scheduledDate: selectedAsset.scheduledDate || '',
                        storytellingAngle: selectedAsset.storytellingAngle || '',
                        valueAddOffer: selectedAsset.valueAddOffer || '',
                        limitedEditionCode: selectedAsset.limitedEditionCode || '',
                        adScript: selectedAsset.adScript || '',
                        captionCopy: selectedAsset.captionCopy || selectedAsset.creativeCopy || '',
                        deliverableUrl: selectedAsset.deliverableUrl || '',
                        changeSummary: `Agency revision v${Number(selectedAsset.currentRevision || 1) + 1}`,
                        submitForApproval: true
                      })
                    }
                    className="px-3 py-1.5 border border-[#DED7CC] hover:border-[#9A783E] rounded text-[11px] font-mono uppercase cursor-pointer"
                  >
                    Load into Editor for New Revision
                  </button>
                </div>

                {/* Stage Progression Bar */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-[10px] font-mono">
                  {APPROVAL_STAGES.map((st) => {
                    const active = selectedAsset.approvalStage === st;
                    return (
                      <div
                        key={st}
                        className={`px-2 py-1.5 rounded border text-center truncate ${
                          active
                            ? 'bg-[#24211D] text-[#FAF8F4] border-[#24211D] font-bold'
                            : 'bg-[#FAF8F4] text-[#686158] border-[#DED7CC]'
                        }`}
                      >
                        {st.replace('_', ' ')}
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-[#FAF8F4] border border-[#DED7CC] rounded">
                    <span className="text-[10px] font-mono uppercase text-[#686158] block mb-1">Ad Script / Storyboard</span>
                    <pre className="whitespace-pre-wrap font-sans text-xs text-[#24211D]">
                      {selectedAsset.adScript || 'No script uploaded yet.'}
                    </pre>
                  </div>
                  <div className="p-3 bg-[#FAF8F4] border border-[#DED7CC] rounded space-y-2">
                    <div>
                      <span className="text-[10px] font-mono uppercase text-[#686158] block mb-1">Caption &amp; Storytelling</span>
                      <p className="text-xs text-[#24211D]">
                        {selectedAsset.captionCopy || selectedAsset.creativeCopy || '—'}
                      </p>
                    </div>
                    {selectedAsset.valueAddOffer && (
                      <p className="text-[11px] font-mono text-[#9A783E]">
                        Value-Add Offer: {selectedAsset.valueAddOffer}
                      </p>
                    )}
                    {selectedAsset.deliverableUrl && (
                      <p className="text-[11px] font-mono text-[#686158] truncate">
                        Asset Link: {selectedAsset.deliverableUrl}
                      </p>
                    )}
                  </div>
                </div>

                {/* Founder / Reviewer Decision Controls */}
                <div className="border-t border-[#DED7CC] pt-3 space-y-2.5">
                  <input
                    placeholder="Founder / Brand Director review feedback or revision notes..."
                    value={reviewFeedback}
                    onChange={(e) => setReviewFeedback(e.target.value)}
                    className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      disabled={busy}
                      onClick={() =>
                        runMutation(
                          () =>
                            erpApi.transitionCreativeStage(selectedAsset.id, {
                              targetStage: 'SUBMITTED',
                              feedback: reviewFeedback || 'Submitted by agency for Founder review'
                            }),
                          'Creative submitted for Founder review.'
                        )
                      }
                      className="px-3 py-1.5 border border-[#DED7CC] hover:border-[#24211D] rounded text-[11px] font-mono uppercase cursor-pointer"
                    >
                      Submit for Review
                    </button>
                    {isFounderOrApprover && (
                      <>
                        <button
                          disabled={busy}
                          onClick={() =>
                            runMutation(
                              () =>
                                erpApi.transitionCreativeStage(selectedAsset.id, {
                                  targetStage: 'UNDER_REVIEW',
                                  feedback: reviewFeedback || 'Under Founder creative review'
                                }),
                              'Marked Under Review.'
                            )
                          }
                          className="px-3 py-1.5 border border-[#DED7CC] hover:border-[#9A783E] rounded text-[11px] font-mono uppercase cursor-pointer"
                        >
                          Mark Under Review
                        </button>
                        <button
                          disabled={busy}
                          onClick={() =>
                            runMutation(
                              () =>
                                erpApi.transitionCreativeStage(selectedAsset.id, {
                                  targetStage: 'CHANGES_REQUESTED',
                                  feedback: reviewFeedback || 'Refine visual pacing & storytelling hook'
                                }),
                              'Changes requested from agency.'
                            )
                          }
                          className="px-3 py-1.5 border border-amber-700 text-amber-800 rounded text-[11px] font-mono uppercase cursor-pointer"
                        >
                          Request Changes
                        </button>
                        <button
                          disabled={busy}
                          onClick={() =>
                            runMutation(
                              () =>
                                erpApi.transitionCreativeStage(selectedAsset.id, {
                                  targetStage: 'APPROVED',
                                  feedback: reviewFeedback || 'Founder approved for luxury release'
                                }),
                              'Founder approved creative asset.'
                            )
                          }
                          className="px-3 py-1.5 bg-emerald-800 text-white rounded text-[11px] font-mono uppercase cursor-pointer"
                        >
                          Founder Approve
                        </button>
                        <button
                          disabled={busy || selectedAsset.approvalStage !== 'APPROVED'}
                          onClick={() =>
                            runMutation(
                              () =>
                                erpApi.transitionCreativeStage(selectedAsset.id, {
                                  targetStage: 'PUBLISHED',
                                  feedback: reviewFeedback || 'Published live across authorized channel'
                                }),
                              'Creative published live.'
                            )
                          }
                          className="px-3 py-1.5 bg-[#24211D] text-[#FAF8F4] rounded text-[11px] font-mono uppercase cursor-pointer disabled:opacity-40"
                        >
                          Publish Live
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Creative Revision History */}
                <div className="border-t border-[#DED7CC] pt-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <History className="w-3.5 h-3.5 text-[#9A783E]" />
                    <span className="text-[11px] font-mono uppercase font-semibold text-[#24211D]">
                      Immutable Creative Revision History ({selectedRevisions.length})
                    </span>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedRevisions.map((rev) => (
                      <div key={rev.id} className="p-2.5 bg-[#FAF8F4] border border-[#DED7CC] rounded text-xs">
                        <div className="flex justify-between font-mono text-[10px] text-[#686158]">
                          <span>
                            v{rev.revisionNumber} · {rev.approvalStage} · By {rev.submittedByEmail}
                          </span>
                          <span className="tabular-nums">{String(rev.createdAt || '').slice(0, 16).replace('T', ' ')}</span>
                        </div>
                        <p className="text-[#24211D] font-medium mt-1">{rev.changeSummary}</p>
                        {rev.reviewerNotes && (
                          <p className="text-[11px] text-[#9A783E] mt-0.5">Reviewer Note: {rev.reviewerNotes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right: Creative Brief, Ad Script, Caption & Upload Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runMutation(async () => {
                await erpApi.saveCreativeAsset({
                  ...creativeForm,
                  id: creativeForm.id || undefined
                });
                setCreativeForm({
                  ...creativeForm,
                  id: '',
                  title: '',
                  adScript: '',
                  captionCopy: '',
                  deliverableUrl: ''
                });
              }, creativeForm.id ? 'Saved new creative revision.' : 'Created luxury creative brief & script.');
            }}
            className="lg:col-span-5 border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-5 space-y-3 h-fit"
          >
            <div className="flex items-center justify-between border-b border-[#DED7CC] pb-2">
              <h3 className="text-xs font-mono uppercase font-semibold text-[#24211D]">
                {creativeForm.id ? 'Upload New Creative Revision' : 'New Creative Brief, Script & Upload'}
              </h3>
              {creativeForm.id && (
                <button
                  type="button"
                  onClick={() => setCreativeForm({ ...creativeForm, id: '', title: '' })}
                  className="text-[10px] font-mono text-[#9A783E] underline cursor-pointer"
                >
                  Clear Edit Mode
                </button>
              )}
            </div>

            {/* Live Luxury Brand Philosophy Guardrail Banner */}
            {guardCheck && (
              <div
                className={`p-3 rounded border text-xs flex items-start gap-2 ${
                  guardCheck.isLuxuryCompliant
                    ? 'bg-[#FAF8F4] border-[#DED7CC] text-[#24211D]'
                    : 'bg-amber-50 border-amber-300 text-amber-900'
                }`}
              >
                {guardCheck.isLuxuryCompliant ? (
                  <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                )}
                <span>{guardCheck.guidance}</span>
              </div>
            )}

            <input
              required
              placeholder="Deliverable Title (e.g., Grasse Jasmine 35mm Story Film)"
              value={creativeForm.title}
              onChange={(e) => setCreativeForm({ ...creativeForm, title: e.target.value })}
              className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
            />

            <div className="grid grid-cols-2 gap-2">
              <select
                value={creativeForm.channel}
                onChange={(e) => setCreativeForm({ ...creativeForm, channel: e.target.value })}
                className="px-2.5 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              >
                <option value="INSTAGRAM">Instagram Editorial</option>
                <option value="META_ADS">Meta Luxury Video</option>
                <option value="GOOGLE_ADS">Google Search / YouTube</option>
                <option value="INFLUENCER">Creator Seeding Brief</option>
                <option value="WHATSAPP">WhatsApp Private Client</option>
                <option value="EMAIL">Atelier Editorial Letter</option>
              </select>
              <select
                value={creativeForm.creativeFormat}
                onChange={(e) => setCreativeForm({ ...creativeForm, creativeFormat: e.target.value })}
                className="px-2.5 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              >
                <option value="REEL">Cinema Reel (9:16)</option>
                <option value="CAROUSEL">Olfactory Notes Carousel</option>
                <option value="STATIC_POST">Editorial Still-Life</option>
                <option value="SEARCH_AD">High-Intent Search Copy</option>
                <option value="EMAIL_FLOW">Private Client Dispatch</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select
                value={creativeForm.strategyType}
                onChange={(e) => setCreativeForm({ ...creativeForm, strategyType: e.target.value })}
                className="px-2.5 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              >
                <option value="BRAND_STORYTELLING">Fragrance Storytelling</option>
                <option value="DISCOVERY_SAMPLING">Discovery Sample Journey</option>
                <option value="VALUE_ADD_GIFTING">Value-Add Gift / Coffret</option>
                <option value="LIMITED_EDITION_LAUNCH">Limited-Edition Drop</option>
                <option value="EXPERIENTIAL_ATELIER">Perfume Bar / Experiential</option>
              </select>
              <input
                type="date"
                value={creativeForm.scheduledDate}
                onChange={(e) => setCreativeForm({ ...creativeForm, scheduledDate: e.target.value })}
                className="px-2.5 py-2 border border-[#DED7CC] rounded text-xs font-mono bg-[#FAF8F4] tabular-nums"
              />
            </div>

            <input
              placeholder="Value-Add Gift / Discovery Offer (e.g., Complimentary 2ML Discovery Vial)"
              value={creativeForm.valueAddOffer}
              onChange={(e) => setCreativeForm({ ...creativeForm, valueAddOffer: e.target.value })}
              className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
            />

            {snap.onceEditions.length > 0 && (
              <select
                value={creativeForm.limitedEditionCode}
                onChange={(e) => setCreativeForm({ ...creativeForm, limitedEditionCode: e.target.value })}
                className="w-full px-2.5 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              >
                <option value="">Optional: Link Limited-Edition ("The Once Collection")</option>
                {snap.onceEditions.map((ed) => (
                  <option key={ed.id} value={ed.editionCode}>
                    {ed.editionCode} — {ed.editionName} ({ed.declaredQuantity} Numbered Bottles)
                  </option>
                ))}
              </select>
            )}

            <textarea
              rows={3}
              placeholder="Ad Script / Scene-by-Scene Visual & Voiceover Direction..."
              value={creativeForm.adScript}
              onChange={(e) => setCreativeForm({ ...creativeForm, adScript: e.target.value })}
              className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
            />

            <textarea
              rows={3}
              required
              placeholder="Editorial Caption & Olfactory Storytelling Copy..."
              value={creativeForm.captionCopy}
              onChange={(e) => setCreativeForm({ ...creativeForm, captionCopy: e.target.value })}
              className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
            />

            <input
              placeholder="Content Asset URL / Drive Proof Link (https://...)"
              value={creativeForm.deliverableUrl}
              onChange={(e) => setCreativeForm({ ...creativeForm, deliverableUrl: e.target.value })}
              className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs font-mono bg-[#FAF8F4]"
            />

            <input
              placeholder="Revision Summary Note"
              value={creativeForm.changeSummary}
              onChange={(e) => setCreativeForm({ ...creativeForm, changeSummary: e.target.value })}
              className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
            />

            <button
              disabled={busy}
              type="submit"
              className="w-full py-2.5 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono uppercase rounded flex items-center justify-center gap-2 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{creativeForm.id ? 'Save Revision & Submit' : 'Submit Creative to Founder Queue'}</span>
            </button>
          </form>
        </div>
      )}

      {/* TAB 2: LUXURY CAMPAIGN PLANNING, BUDGETS, META/GOOGLE ADS INTEGRATION & ATTRIBUTION */}
      {activeTab === 'campaigns' && (
        <div className="space-y-6">
          {/* Meta & Google Ads Authorized Integration Strip */}
          <div className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#9A783E]">
                Authorized Paid Media &amp; First-Party Attribution Status
              </span>
              <div className="flex flex-wrap gap-6 text-xs font-mono">
                <span>
                  Meta Ads / CAPI:{' '}
                  <strong className={snap.adIntegrations.metaAuthorized ? 'text-emerald-700' : 'text-[#686158]'}>
                    {snap.adIntegrations.metaAuthorized
                      ? `AUTHORIZED (Pixel ${snap.adIntegrations.metaPixelId})`
                      : 'AWAITING CREDENTIALS IN CMS INTEGRATIONS'}
                  </strong>
                </span>
                <span>
                  Google Ads / GA4:{' '}
                  <strong className={snap.adIntegrations.googleAuthorized ? 'text-emerald-700' : 'text-[#686158]'}>
                    {snap.adIntegrations.googleAuthorized
                      ? `AUTHORIZED (${snap.adIntegrations.googleAdsId || snap.adIntegrations.ga4MeasurementId})`
                      : 'AWAITING CREDENTIALS IN CMS INTEGRATIONS'}
                  </strong>
                </span>
              </div>
              <p className="text-[11px] text-[#686158]">
                Zero synthetic ad metrics: ROAS and conversions reconcile directly against verified PostgreSQL orders &amp; UTM attribution.
              </p>
            </div>
            <button
              disabled={busy}
              onClick={() => runMutation(() => erpApi.syncAdReporting(), 'Reconciled campaign attribution with verified orders.')}
              className="px-3.5 py-2 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] rounded text-xs font-mono uppercase flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reconcile Attribution</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 border border-[#DED7CC] bg-[#FFFFFF] rounded-lg overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                  <tr>
                    <th className="py-2.5 px-3">Campaign &amp; Luxury Pillar</th>
                    <th className="py-2.5 px-3">Channel</th>
                    <th className="py-2.5 px-3 text-right">Budget</th>
                    <th className="py-2.5 px-3 text-right">Spend</th>
                    <th className="py-2.5 px-3 text-right">Attributed Rev</th>
                    <th className="py-2.5 px-3 text-right">ROAS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DED7CC]">
                  {snap.campaigns.map((c) => {
                    const meta = (c.campaignMetadata as any) || {};
                    const roas = Number(c.spend) > 0 ? (Number(c.revenue) / Number(c.spend)).toFixed(2) : '0.00';
                    return (
                      <tr key={c.id}>
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-[#24211D] block">{c.name}</span>
                          <span className="text-[10px] font-mono text-[#9A783E]">
                            {meta.strategyType || 'BRAND_STORYTELLING'}
                            {meta.valueAddGift ? ` · ${meta.valueAddGift}` : ''}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px]">{c.channel}</td>
                        <td className="py-2.5 px-3 font-mono text-right tabular-nums">
                          {canSeeFinancials ? `₹${Number(c.budget || 0).toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-right tabular-nums">
                          {canSeeFinancials ? `₹${Number(c.spend || 0).toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-right tabular-nums font-semibold text-[#9A783E]">
                          {canSeeFinancials ? `₹${Number(c.revenue || 0).toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-right tabular-nums text-emerald-700">{roas}x</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                runMutation(async () => {
                  await erpApi.saveLuxuryCampaign(campForm);
                  setCampForm({ ...campForm, name: '' });
                }, 'Luxury campaign plan saved.');
              }}
              className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4 space-y-3 h-fit"
            >
              <h3 className="text-xs font-mono uppercase font-semibold border-b border-[#DED7CC] pb-2">
                Plan Luxury Campaign
              </h3>
              <input
                required
                placeholder="Campaign Name (No habitual % off copy)"
                value={campForm.name}
                onChange={(e) => setCampForm({ ...campForm, name: e.target.value })}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={campForm.channel}
                  onChange={(e) => setCampForm({ ...campForm, channel: e.target.value })}
                  className="px-2 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                >
                  <option value="META_ADS">Meta Ads</option>
                  <option value="GOOGLE_ADS">Google Search</option>
                  <option value="INSTAGRAM">Instagram Organic</option>
                  <option value="INFLUENCER">Creator Seeding</option>
                  <option value="WHATSAPP">WhatsApp VIP</option>
                </select>
                <select
                  value={campForm.strategyType}
                  onChange={(e) => setCampForm({ ...campForm, strategyType: e.target.value })}
                  className="px-2 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                >
                  <option value="BRAND_STORYTELLING">Storytelling</option>
                  <option value="DISCOVERY_SAMPLING">Discovery Samples</option>
                  <option value="VALUE_ADD_GIFTING">Value-Add Gift</option>
                  <option value="LIMITED_EDITION_LAUNCH">Limited Edition</option>
                </select>
              </div>
              <input
                type="number"
                placeholder="Allocated Budget (INR)"
                value={campForm.budgetInr}
                onChange={(e) => setCampForm({ ...campForm, budgetInr: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4] tabular-nums"
              />
              <input
                placeholder="Storytelling Pillar / Olfactory Hook"
                value={campForm.storytellingTheme}
                onChange={(e) => setCampForm({ ...campForm, storytellingTheme: e.target.value })}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              />
              <input
                placeholder="Value-Add Gift / Discovery Vial Inclusion"
                value={campForm.valueAddGift}
                onChange={(e) => setCampForm({ ...campForm, valueAddGift: e.target.value })}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              />
              <button
                disabled={busy}
                type="submit"
                className="w-full py-2.5 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono uppercase rounded cursor-pointer"
              >
                Create Campaign Plan
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 3: INFLUENCER DATABASE, SEEDING REQUESTS & SAMPLE DISPATCH TRACKING */}
      {activeTab === 'influencers' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 border border-[#DED7CC] bg-[#FFFFFF] rounded-lg overflow-x-auto">
              <div className="px-4 py-3 bg-[#FAF8F4] border-b border-[#DED7CC] flex items-center justify-between">
                <h3 className="text-xs font-mono uppercase font-semibold">Creator Roster &amp; Attribution</h3>
                <ErpTableExportBar reportKey="influencer_activity" notify={notify} />
              </div>
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                  <tr>
                    <th className="py-2.5 px-3">Creator / Handle</th>
                    <th className="py-2.5 px-3">Platform</th>
                    <th className="py-2.5 px-3">Code</th>
                    <th className="py-2.5 px-3 text-right">Clicks / Orders</th>
                    <th className="py-2.5 px-3 text-right">Attributed Sales</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DED7CC]">
                  {snap.influencers.map((inf) => (
                    <tr key={inf.id}>
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-[#24211D] block">{inf.name}</span>
                        <span className="text-[11px] font-mono text-[#686158]">{inf.handle}</span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px]">{inf.platform}</td>
                      <td className="py-2.5 px-3 font-mono text-[#9A783E]">{inf.referralCode}</td>
                      <td className="py-2.5 px-3 font-mono text-right tabular-nums">
                        {inf.clicks} / {inf.ordersCount}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-right tabular-nums font-semibold">
                        {canSeeFinancials ? `₹${Number(inf.totalRevenue || 0).toLocaleString('en-IN')}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                runMutation(async () => {
                  await erpApi.saveInfluencerPartner(infForm);
                  setInfForm({ ...infForm, name: '', handle: '' });
                }, 'Creator onboarded to influencer database.');
              }}
              className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4 space-y-3 h-fit"
            >
              <h3 className="text-xs font-mono uppercase font-semibold border-b border-[#DED7CC] pb-2">
                Add Creator Partner
              </h3>
              <input
                required
                placeholder="Creator Full Name"
                value={infForm.name}
                onChange={(e) => setInfForm({ ...infForm, name: e.target.value })}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              />
              <input
                required
                placeholder="@handle"
                value={infForm.handle}
                onChange={(e) => setInfForm({ ...infForm, handle: e.target.value })}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
              />
              <select
                value={infForm.platform}
                onChange={(e) => setInfForm({ ...infForm, platform: e.target.value })}
                className="w-full px-2.5 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              >
                <option value="INSTAGRAM">Instagram</option>
                <option value="YOUTUBE">YouTube</option>
                <option value="EDITORIAL_BLOG">Fragrance Editorial</option>
              </select>
              <button
                disabled={busy}
                type="submit"
                className="w-full py-2.5 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono uppercase rounded cursor-pointer"
              >
                Save Creator
              </button>
            </form>
          </div>

          {/* Seeding Request & Sample Dispatch Tracking */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                runMutation(async () => {
                  await erpApi.createSeedingRequest(seedForm);
                }, 'Influencer seeding sample & deliverable queued.');
              }}
              className="lg:col-span-4 border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4 space-y-3"
            >
              <h3 className="text-xs font-mono uppercase font-semibold border-b border-[#DED7CC] pb-2">
                Request Creator Seeding Kit
              </h3>
              <select
                required
                value={seedForm.influencerId}
                onChange={(e) => setSeedForm({ ...seedForm, influencerId: e.target.value })}
                className="w-full px-2.5 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              >
                <option value="">Select Creator</option>
                {snap.influencers.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.handle})
                  </option>
                ))}
              </select>
              <input
                required
                placeholder="Fragrance / Discovery Kit"
                value={seedForm.fragranceName}
                onChange={(e) => setSeedForm({ ...seedForm, fragranceName: e.target.value })}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="Volume (mL)"
                  value={seedForm.volumeMl}
                  onChange={(e) => setSeedForm({ ...seedForm, volumeMl: Number(e.target.value) })}
                  className="px-3 py-2 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4] tabular-nums"
                />
                <input
                  type="number"
                  placeholder="Units"
                  value={seedForm.quantityUnits}
                  onChange={(e) => setSeedForm({ ...seedForm, quantityUnits: Number(e.target.value) })}
                  className="px-3 py-2 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4] tabular-nums"
                />
              </div>
              <input
                placeholder="Expected Deliverable Title"
                value={seedForm.deliverableTitle}
                onChange={(e) => setSeedForm({ ...seedForm, deliverableTitle: e.target.value })}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              />
              <button
                disabled={busy}
                type="submit"
                className="w-full py-2 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono uppercase rounded cursor-pointer"
              >
                Create Seeding Sample
              </button>
            </form>

            <div className="lg:col-span-8 border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DED7CC] pb-2">
                <h3 className="text-xs font-mono uppercase font-semibold flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-[#9A783E]" />
                  <span>Sample Dispatch &amp; Content Tracking ({snap.seedingSamples.length})</span>
                </h3>
                <ErpTableExportBar reportKey="sampling_register" notify={notify} />
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!dispatchForm.sampleId) return;
                  runMutation(async () => {
                    await erpApi.updateSeedingDispatch(dispatchForm.sampleId, dispatchForm);
                    setDispatchForm({ ...dispatchForm, trackingNumber: '', publishedUrl: '' });
                  }, 'Updated sample courier AWB & creator content status.');
                }}
                className="grid grid-cols-1 sm:grid-cols-4 gap-2 bg-[#FAF8F4] p-3 rounded border border-[#DED7CC]"
              >
                <select
                  value={dispatchForm.sampleId}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, sampleId: e.target.value })}
                  className="px-2 py-1.5 bg-[#FFFFFF] border border-[#DED7CC] rounded text-xs font-mono"
                >
                  {snap.seedingSamples.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.sampleNumber} — {s.recipientName}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="AWB Tracking #"
                  value={dispatchForm.trackingNumber}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, trackingNumber: e.target.value })}
                  className="px-2.5 py-1.5 bg-[#FFFFFF] border border-[#DED7CC] rounded text-xs font-mono"
                />
                <input
                  placeholder="Live Post URL (optional)"
                  value={dispatchForm.publishedUrl}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, publishedUrl: e.target.value })}
                  className="px-2.5 py-1.5 bg-[#FFFFFF] border border-[#DED7CC] rounded text-xs font-mono"
                />
                <button
                  disabled={busy || !dispatchForm.sampleId}
                  type="submit"
                  className="py-1.5 px-3 bg-[#24211D] text-[#FAF8F4] rounded text-xs font-mono uppercase cursor-pointer"
                >
                  Update Dispatch
                </button>
              </form>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                    <tr>
                      <th className="py-2 px-3">Sample #</th>
                      <th className="py-2 px-3">Recipient / Fragrance</th>
                      <th className="py-2 px-3">Courier &amp; AWB</th>
                      <th className="py-2 px-3">Stage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DED7CC]">
                    {snap.seedingSamples.slice(0, 10).map((s) => (
                      <tr key={s.id}>
                        <td className="py-2 px-3 font-mono font-bold text-[#9A783E]">{s.sampleNumber}</td>
                        <td className="py-2 px-3">
                          <span className="font-semibold block">{s.recipientName}</span>
                          <span className="text-[11px] text-[#686158]">
                            {s.fragranceName} ({s.volumeMl}mL)
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px]">
                          {s.courierName || 'Pending'} · {s.trackingNumber || 'Awaiting AWB'}
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px]">{s.workflowStage || s.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: AGENCY PROFILE, STAFF ACCOUNTS & RETAINER INVOICES */}
      {activeTab === 'agency' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-6">
            <div className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-5 space-y-3">
              <div className="flex justify-between items-start border-b border-[#DED7CC] pb-3">
                <div>
                  <span className="text-[10px] font-mono uppercase text-[#9A783E]">Organization Profile</span>
                  <h3 className="font-serif text-xl text-[#24211D]">{agency.agencyName}</h3>
                  <p className="text-xs text-[#686158]">{agency.legalName} · GSTIN: {agency.gstin}</p>
                </div>
                <span className="text-xs font-mono text-emerald-700">NDA SIGNED · {agency.status}</span>
              </div>
              <p className="text-xs text-[#24211D] bg-[#FAF8F4] p-3 rounded border border-[#DED7CC]">
                <strong>Luxury Philosophy Pledge:</strong> {agency.luxuryPhilosophyPledge}
              </p>

              <h4 className="text-xs font-mono uppercase font-semibold pt-2">Agency Staff Accounts ({snap.agencyStaff.length})</h4>
              <div className="overflow-x-auto border border-[#DED7CC] rounded">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                    <tr>
                      <th className="py-2 px-3">Code / Name</th>
                      <th className="py-2 px-3">Role &amp; Specialty</th>
                      <th className="py-2 px-3">Access</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DED7CC]">
                    {snap.agencyStaff.map((st) => (
                      <tr key={st.id}>
                        <td className="py-2 px-3">
                          <span className="font-mono text-[#9A783E] font-bold block">{st.staffCode}</span>
                          <span className="font-semibold">{st.fullName}</span>
                          <span className="block text-[10px] text-[#686158]">{st.email}</span>
                        </td>
                        <td className="py-2 px-3">
                          <span className="block font-medium">{st.roleTitle}</span>
                          <span className="text-[11px] text-[#686158]">{st.specialty}</span>
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px]">{st.accessLevel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Agency Invoices Ledger */}
            {canSeeFinancials && (
              <div className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg overflow-x-auto">
                <div className="px-4 py-3 bg-[#FAF8F4] border-b border-[#DED7CC]">
                  <h3 className="text-xs font-mono uppercase font-semibold">Agency Retainer Invoices &amp; Settlement</h3>
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                    <tr>
                      <th className="py-2 px-3">Invoice #</th>
                      <th className="py-2 px-3">Month / Scope</th>
                      <th className="py-2 px-3 text-right">Total (Incl. GST)</th>
                      <th className="py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DED7CC]">
                    {snap.agencyInvoices.map((inv) => (
                      <tr key={inv.id}>
                        <td className="py-2 px-3 font-mono font-bold text-[#9A783E]">{inv.invoiceNumber}</td>
                        <td className="py-2 px-3">
                          <span className="font-mono block">{inv.billingMonth}</span>
                          <span className="text-[11px] text-[#686158]">{inv.description}</span>
                        </td>
                        <td className="py-2 px-3 font-mono text-right tabular-nums">
                          ₹{Number(inv.totalAmountInr || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px]">{inv.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="lg:col-span-5 space-y-5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                runMutation(async () => {
                  await erpApi.saveAgencyStaff({ ...staffForm, agencyId: agency.id });
                  setStaffForm({ ...staffForm, fullName: '', email: '' });
                }, 'Agency staff account provisioned.');
              }}
              className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4 space-y-3"
            >
              <h3 className="text-xs font-mono uppercase font-semibold border-b border-[#DED7CC] pb-2">
                Add Agency Staff Account
              </h3>
              <input
                required
                placeholder="Staff Full Name"
                value={staffForm.fullName}
                onChange={(e) => setStaffForm({ ...staffForm, fullName: e.target.value })}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              />
              <input
                required
                type="email"
                placeholder="Agency Work Email"
                value={staffForm.email}
                onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              />
              <input
                required
                placeholder="Role Title"
                value={staffForm.roleTitle}
                onChange={(e) => setStaffForm({ ...staffForm, roleTitle: e.target.value })}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              />
              <button
                disabled={busy}
                type="submit"
                className="w-full py-2 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono uppercase rounded cursor-pointer"
              >
                Provision Agency Seat
              </button>
            </form>

            {canSeeFinancials && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  runMutation(async () => {
                    await erpApi.saveAgencyInvoice({ ...invForm, agencyId: agency.id });
                  }, 'Agency invoice logged.');
                }}
                className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4 space-y-3"
              >
                <h3 className="text-xs font-mono uppercase font-semibold border-b border-[#DED7CC] pb-2">
                  Submit Agency Retainer Invoice
                </h3>
                <input
                  type="month"
                  value={invForm.billingMonth}
                  onChange={(e) => setInvForm({ ...invForm, billingMonth: e.target.value })}
                  className="w-full px-3 py-2 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
                />
                <input
                  required
                  placeholder="Scope Description"
                  value={invForm.description}
                  onChange={(e) => setInvForm({ ...invForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    placeholder="Retainer ₹"
                    value={invForm.retainerInr}
                    onChange={(e) => setInvForm({ ...invForm, retainerInr: Number(e.target.value) })}
                    className="px-3 py-2 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4] tabular-nums"
                  />
                  <input
                    type="number"
                    placeholder="Production Extras ₹"
                    value={invForm.productionExtrasInr}
                    onChange={(e) => setInvForm({ ...invForm, productionExtrasInr: Number(e.target.value) })}
                    className="px-3 py-2 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4] tabular-nums"
                  />
                </div>
                <button
                  disabled={busy}
                  type="submit"
                  className="w-full py-2 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono uppercase rounded cursor-pointer"
                >
                  Log Agency Invoice
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: MONTHLY PERFORMANCE REPORTS & DELIVERABLES */}
      {activeTab === 'performance' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              key: 'marketing_campaigns',
              title: 'Monthly Luxury Campaign Performance & Attribution',
              desc: 'Spend, attributed D2C/B2B orders, ROAS, and non-discount storytelling pillars.'
            },
            {
              key: 'influencer_activity',
              title: 'Influencer Seeding & Referral Conversion Report',
              desc: 'Creator partner referral codes, clicks, converted orders, and attributed sales.'
            },
            {
              key: 'sampling_register',
              title: 'Discovery & Creator Sample Dispatch Register',
              desc: 'Prepared discovery vials, courier AWB tracking, landed cost, and feedback status.'
            }
          ].map((rep) => (
            <div
              key={rep.key}
              className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-5 flex flex-col justify-between space-y-4"
            >
              <div>
                <FileCheck2 className="w-5 h-5 text-[#9A783E] mb-2" />
                <h3 className="font-serif text-lg text-[#24211D]">{rep.title}</h3>
                <p className="text-xs text-[#686158] mt-1">{rep.desc}</p>
              </div>
              <div className="pt-3 border-t border-[#DED7CC]">
                <ErpTableExportBar reportKey={rep.key} title={rep.title} notify={notify} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
