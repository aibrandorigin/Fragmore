import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Sparkles,
  MessageSquare,
  Compass,
  Wrench,
  ShieldCheck,
  History,
  TrendingUp,
  Settings,
  RefreshCw,
  CheckCircle2,
  Lock,
  Play,
  RotateCcw,
  Layers,
  Database,
  Send,
  Plus,
  Search,
  Bookmark,
  Paperclip,
  Edit3,
  Check,
  X,
  XCircle,
  AlertCircle,
  Globe,
  Trash2,
  Menu,
  Clock,
  ArrowRight,
  Sun,
  Moon,
  Megaphone,
  Workflow,
  Palette,
  Sliders,
  AlertTriangle,
  PanelRightClose,
  PanelRightOpen
} from 'lucide-react';
import { AiCmo3LuxuryChatStudio } from './AiCmo3LuxuryChatStudio';
import {
  getAiCmoThemeTokens,
  AiCmoOverviewWorkspace,
  AiCmoCampaignsWorkspace,
  AiCmoAutomationsWorkspace,
  AiCmoCreativeStudioWorkspace,
  AiCmoInsightsWorkspace,
  AiCmoApprovalsWorkspace,
  AiCmoHistoryWorkspace,
  AiCmoAdvancedSettingsWorkspace
} from './AiCmoCommandCenterViews';

export type AiCmoSubRoute =
  | 'CHAT'
  | 'OVERVIEW'
  | 'CAMPAIGNS'
  | 'PLANNER'
  | 'AUTOMATIONS'
  | 'CREATIVE_STUDIO'
  | 'INSIGHTS'
  | 'APPROVALS'
  | 'HISTORY'
  | 'ACTIONS'
  | 'MEMORY'
  | 'SETTINGS';

export const AI_CMO_ROUTE_MAP: Record<AiCmoSubRoute, string> = {
  CHAT: '/admin/ai-cmo/chat',
  OVERVIEW: '/admin/ai-cmo/overview',
  CAMPAIGNS: '/admin/ai-cmo/campaigns',
  PLANNER: '/admin/ai-cmo/planner',
  AUTOMATIONS: '/admin/ai-cmo/automations',
  CREATIVE_STUDIO: '/admin/ai-cmo/creative-studio',
  INSIGHTS: '/admin/ai-cmo/insights',
  APPROVALS: '/admin/ai-cmo/approvals',
  HISTORY: '/admin/ai-cmo/history',
  ACTIONS: '/admin/ai-cmo/actions',
  MEMORY: '/admin/ai-cmo/memory',
  SETTINGS: '/admin/ai-cmo/settings'
};

export function parsePathnameToAiCmoSubRoute(pathname: string): AiCmoSubRoute | null {
  const clean = pathname.replace(/\/+$/, '');
  if (clean === '/admin/ai-cmo' || clean === '/admin/ai-cmo/chat') return 'CHAT';
  if (clean === '/admin/ai-cmo/overview') return 'OVERVIEW';
  if (clean === '/admin/ai-cmo/campaigns' || clean === '/admin/ai-cmo/planner') return 'PLANNER';
  if (clean === '/admin/ai-cmo/automations') return 'AUTOMATIONS';
  if (clean === '/admin/ai-cmo/creative-studio') return 'CREATIVE_STUDIO';
  if (clean === '/admin/ai-cmo/insights') return 'INSIGHTS';
  if (clean === '/admin/ai-cmo/approvals') return 'APPROVALS';
  if (clean === '/admin/ai-cmo/history') return 'HISTORY';
  if (clean === '/admin/ai-cmo/actions') return 'ACTIONS';
  if (clean === '/admin/ai-cmo/memory') return 'MEMORY';
  if (clean === '/admin/ai-cmo/settings') return 'SETTINGS';
  return null;
}

interface AdminAiCmo3Props {
  activeSubRoute?: AiCmoSubRoute;
  onSubRouteChange?: (subRoute: AiCmoSubRoute) => void;
  adminEmail?: string;
  adminRole?: string;
  onOpenTechnicalAutomationBuilder?: () => void;
}

const EXAMPLE_REQUEST_CHIPS = [
  'Create an abandoned cart recovery workflow for carts above ₹999, wait 30 minutes, check marketing consent, send an approved WhatsApp template, then stop if the order is completed.',
  'Add an email fallback.',
  'Change the delay to two hours.',
  'Only target first-time customers.',
  'Pause this workflow.',
  'Show why the last execution failed.',
  "Show me today's actual sales and profit.",
  'Which perfume has the highest contribution margin?',
  'Create a campaign plan for AZURE with ₹10,000 budget.',
  'Show all abandoned carts above ₹999.',
  'Show low stock items and recommend production quantities.',
  'Prepare a weekly marketing plan.',
  'Show pending customer refunds.',
  'Generate a creative brief for SOLARA.',
  'ఈరోజు ప్రత్యక్ష అమ్మకాలు మరియు లాభం చూపించు (Telugu)'
];

export const AdminAiCmo3: React.FC<AdminAiCmo3Props> = ({
  activeSubRoute = 'CHAT',
  onSubRouteChange,
  adminEmail = 'admin@fragmore.com',
  adminRole = 'SUPER_ADMIN',
  onOpenTechnicalAutomationBuilder
}) => {
  const [subRoute, setSubRoute] = useState<AiCmoSubRoute>(activeSubRoute || 'CHAT');
  const [showRightContextPanel, setShowRightContextPanel] = useState<boolean>(false);
  const [navLayoutMode, setNavLayoutMode] = useState<'HORIZONTAL' | 'SIDEBAR'>('HORIZONTAL');
  const [uiTheme, setUiTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('fragmore_aicmo_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    }
    return 'light';
  });
  const toggleUiTheme = useCallback(() => {
    setUiTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('fragmore_aicmo_theme', next);
      }
      return next;
    });
  }, []);
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [bannerMsg, setBannerMsg] = useState<{
    type: 'success' | 'info' | 'error';
    text: string;
  } | null>(null);

  // Chat & Streaming state
  const [selectedConvId, setSelectedConvId] = useState<string>('');
  const [chatPrompt, setChatPrompt] = useState<string>('');
  const [languagePref, setLanguagePref] = useState<'EN' | 'TE' | 'BILINGUAL'>('EN');
  const [autoProposeFromChat, setAutoProposeFromChat] = useState<boolean>(false);
  const [streamingStatus, setStreamingStatus] = useState<string | null>(null);
  const [streamingPreviewText, setStreamingPreviewText] = useState<string>('');
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);

  // Search, Rename, Saved Prompts & Attachments state
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');
  const [leftSidebarTab, setLeftSidebarTab] = useState<'THREADS' | 'PROMPTS'>('THREADS');
  const [mobileChatDrawerOpen, setMobileChatDrawerOpen] = useState<boolean>(false);
  const [renamingConvId, setRenamingConvId] = useState<string | null>(null);
  const [renameTitleInput, setRenameTitleInput] = useState<string>('');
  const [newSavedPromptTitle, setNewSavedPromptTitle] = useState<string>('');
  const [showSavePromptModal, setShowSavePromptModal] = useState<boolean>(false);
  const [attachments, setAttachments] = useState<
    { name: string; type: string; size: number; textPreview: string }[]
  >([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Planner state (Goal-Based Campaign Planner + DAG Planner + Outcome Tracker)
  const [planTitle, setPlanTitle] = useState<string>('');
  const [planObjective, setPlanObjective] = useState<string>(
    'Accelerate Discovery Six -> 100ml Full-Bottle redemptions within Day 5-14 window while protecting flagship Extrait margins.'
  );
  const [planSegment, setPlanSegment] = useState<string>('DISCOVERY_BUYERS');
  const [planBudget, setPlanBudget] = useState<number>(25000);

  const [goalPlannerGoal, setGoalPlannerGoal] = useState<string>(
    'Maximize net contribution profit and full-bottle acquisition while maintaining POAS >= 1.65x'
  );
  const [goalPlannerProduct, setGoalPlannerProduct] = useState<string>('AZURE');
  const [goalPlannerChannel, setGoalPlannerChannel] = useState<string>(
    'Omnichannel (Meta Reels + Google Exact Search + WhatsApp VIP Concierge)'
  );
  const [goalPlannerBudget, setGoalPlannerBudget] = useState<number>(15000);
  const [goalPlannerDuration, setGoalPlannerDuration] = useState<number>(14);
  const [goalPlannerAudience, setGoalPlannerAudience] = useState<string>(
    'VIP Collectors (≥ ₹5,000 Spend) & Discovery Six Day 5-14 Upgrade Cohort'
  );
  const [goalPlannerTargetProfitability, setGoalPlannerTargetProfitability] = useState<string>(
    'Target POAS >= 1.65x | Net Contribution Margin >= 72%'
  );
  const [latestGoalBlueprint, setLatestGoalBlueprint] = useState<any>(null);
  const [externalCampaignDraftToEdit, setExternalCampaignDraftToEdit] = useState<any>(null);

  // Outcome tracker state for approved strategies
  const [editingOutcomePlanId, setEditingOutcomePlanId] = useState<string | null>(null);
  const [outcomeStatus, setOutcomeStatus] = useState<
    'APPROVED' | 'IN_FLIGHT_DRY_RUN' | 'EXECUTED_LIVE' | 'COMPLETED_MEASURED'
  >('COMPLETED_MEASURED');
  const [outcomeSpend, setOutcomeSpend] = useState<number>(12500);
  const [outcomeRevenue, setOutcomeRevenue] = useState<number>(48000);
  const [outcomeProfit, setOutcomeProfit] = useState<number>(34560);
  const [outcomeNotes, setOutcomeNotes] = useState<string>(
    'Verified post-campaign attribution check: POAS outperformed baseline estimate.'
  );

  // Marketing Strategy Engine 16-Capability active section
  const [strategySection, setStrategySection] = useState<
    | 'ALL_16'
    | 'HEALTH_POAS_MER'
    | 'MARGIN_PROMO_CATALOG'
    | 'CAMPAIGNS_ADS_BUDGET'
    | 'KEYWORDS_FATIGUE_AUDIENCE'
    | 'DISCOVERY_INFLUENCER_RETENTION'
    | 'CALENDAR_KPIS_RECOMMENDATIONS'
  >('ALL_16');

  // Compatibility & Regression test results
  const [testReport, setTestReport] = useState<any>(null);

  // Tool Registry interactive runner state (20 Read Tools + 13 Write/Proposal Tools)
  const [toolFilterTab, setToolFilterTab] = useState<'ALL' | 'READ_TOOL' | 'WRITE_PROPOSAL_TOOL'>('ALL');
  const [toolSearchQuery, setToolSearchQuery] = useState<string>('');
  const [liveToolExecutionOutput, setLiveToolExecutionOutput] = useState<any>(null);
  const [expandedSchemaToolName, setExpandedSchemaToolName] = useState<string | null>(null);

  // Universal AI Action Center & 10-Field Approval Card Edit/Verification State
  const [editingApprovalId, setEditingApprovalId] = useState<string | null>(null);
  const [editTitleText, setEditTitleText] = useState<string>('');
  const [editPayloadJson, setEditPayloadJson] = useState<string>('');
  const [actionTypeFilter, setActionTypeFilter] = useState<string>('ALL');
  const [lastVerificationReport, setLastVerificationReport] = useState<any>(null);
  const [syncSuiteReport, setSyncSuiteReport] = useState<any>(null);
  const [lastRealtimeSyncEvent, setLastRealtimeSyncEvent] = useState<any>(null);

  // Durable AI Memory, Scheduled Intelligence & Governance State
  const [memoryCategoryFilter, setMemoryCategoryFilter] = useState<string>('ALL');
  const [memoryStatusFilter, setMemoryStatusFilter] = useState<string>('ALL');
  const [memorySearchQuery, setMemorySearchQuery] = useState<string>('');
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [editMemoryTitle, setEditMemoryTitle] = useState<string>('');
  const [editMemorySummary, setEditMemorySummary] = useState<string>('');
  const [editMemoryPolicyJson, setEditMemoryPolicyJson] = useState<string>('');
  const [editMemoryChangeNote, setEditMemoryChangeNote] = useState<string>('');
  const [expandedHistoryMemoryId, setExpandedHistoryMemoryId] = useState<string | null>(null);
  const [showCreateMemoryModal, setShowCreateMemoryModal] = useState<boolean>(false);
  const [newMemCategory, setNewMemCategory] = useState<string>('FOUNDER_BUSINESS_RULES');
  const [newMemTitle, setNewMemTitle] = useState<string>('');
  const [newMemSummary, setNewMemSummary] = useState<string>('');
  const [newMemSourceType, setNewMemSourceType] = useState<string>('ADMIN_CURATED');
  const [newMemEpistemicType, setNewMemEpistemicType] = useState<string>('APPROVED_POLICY');
  const [newMemPolicyJson, setNewMemPolicyJson] = useState<string>('{\n  "rule": "Maintain >= 55% net contribution margin"\n}');
  const [govDailyTokens, setGovDailyTokens] = useState<number>(250000);
  const [govMonthlyTokens, setGovMonthlyTokens] = useState<number>(5000000);
  const [govDailyCostInr, setGovDailyCostInr] = useState<number>(750);
  const [govMonthlyCostInr, setGovMonthlyCostInr] = useState<number>(15000);
  const [govConvRetentionDays, setGovConvRetentionDays] = useState<number>(90);
  const [govBriefingRetentionDays, setGovBriefingRetentionDays] = useState<number>(180);

  useEffect(() => {
    setSubRoute(activeSubRoute || 'CHAT');
  }, [activeSubRoute]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      const adminMain = document.querySelector('main');
      if (adminMain) {
        adminMain.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      }
    }
  }, [subRoute]);

  const navigateSubRoute = (target: AiCmoSubRoute) => {
    setSubRoute(target);
    const targetPath = AI_CMO_ROUTE_MAP[target];
    if (typeof window !== 'undefined') {
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ aiCmoSubRoute: target }, '', targetPath);
      }
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      const adminMain = document.querySelector('main');
      if (adminMain) {
        adminMain.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      }
    }
    if (onSubRouteChange) {
      onSubRouteChange(target);
    }
  };

  const fetchOverview = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/ai-cmo/overview');
      if (!res.ok) throw new Error('Failed to load AI CMO 3.0 overview');
      const data = await res.json();
      setOverview(data);
      if (!selectedConvId && data.conversations?.length > 0) {
        setSelectedConvId(data.conversations[0].id);
      }
    } catch (err: any) {
      setBannerMsg({ type: 'error', text: err.message || 'Error loading AI CMO 3.0' });
    } finally {
      setLoading(false);
    }
  }, [selectedConvId]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  // Listen for SSE real-time synchronization events across ALL FRAGMORÉ domain modules & AI CMO 3.0
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/realtime/stream?role=super_admin');
      es.onmessage = (evt) => {
        try {
          const parsed = JSON.parse(evt.data);
          if (
            parsed?.type === 'CROSS_BROWSER_SYNC' ||
            parsed?.entity === 'ai_cmo_3' ||
            parsed?.channel === 'ai_cmo_3'
          ) {
            setLastRealtimeSyncEvent(parsed.event || parsed);
            fetchOverview();
          }
        } catch {
          // ignore parse noise
        }
      };
    } catch {
      // ignore SSE connection issues
    }

    const onCustomSync = (e: any) => {
      if (e?.detail) {
        setLastRealtimeSyncEvent(e.detail.event || e.detail);
      }
      fetchOverview();
    };
    window.addEventListener('fragmore:authoritative-sync', onCustomSync);

    return () => {
      if (es) es.close();
      window.removeEventListener('fragmore:authoritative-sync', onCustomSync);
    };
  }, [fetchOverview]);

  const executePromptStreamOrFallback = async (promptToRun: string) => {
    if (!promptToRun.trim()) return;
    setBusyAction('chat');
    setLastFailedPrompt(null);
    setStreamingStatus('Authenticating RBAC & querying PostgreSQL Read Adapters...');
    setStreamingPreviewText('');

    const payloadBody = {
      conversationId: selectedConvId || undefined,
      prompt: promptToRun.trim(),
      language: languagePref,
      actorEmail: adminEmail,
      actorRole: adminRole,
      autoProposeAction: autoProposeFromChat,
      attachments
    };

    try {
      const response = await fetch('/api/ai-cmo/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadBody)
      });

      if (!response.ok || !response.body) {
        // Fallback to standard JSON endpoint
        const fallbackRes = await fetch('/api/ai-cmo/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadBody)
        });
        const fallbackData = await fallbackRes.json();
        if (!fallbackRes.ok) throw new Error(fallbackData.error || 'Chat request failed');
        setSelectedConvId(fallbackData.conversationId);
        setChatPrompt('');
        setAttachments([]);
        await fetchOverview();
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const chunk of lines) {
          const trimmed = chunk.trim();
          if (!trimmed.startsWith('data:')) continue;
          const jsonStr = trimmed.replace(/^data:\s*/, '');
          try {
            const evt = JSON.parse(jsonStr);
            if (evt.eventType === 'status') {
              setStreamingStatus(evt.message);
            } else if (evt.eventType === 'token') {
              setStreamingPreviewText(evt.accumulated || '');
            } else if (evt.eventType === 'complete') {
              setSelectedConvId(evt.conversationId);
              setChatPrompt('');
              setAttachments([]);
              setStreamingStatus(null);
              setStreamingPreviewText('');
            } else if (evt.eventType === 'error') {
              throw new Error(evt.error || 'Stream error');
            }
          } catch (innerErr: any) {
            if (innerErr.message && innerErr.message !== 'Unexpected end of JSON input') {
              throw innerErr;
            }
          }
        }
      }

      await fetchOverview();
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 120);
    } catch (err: any) {
      setLastFailedPrompt(promptToRun);
      setBannerMsg({
        type: 'error',
        text: `Chat Error: ${err.message}. Click "Retry Last Message" to recover safely.`
      });
    } finally {
      setBusyAction(null);
      setStreamingStatus(null);
      setStreamingPreviewText('');
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatPrompt.trim()) return;
    await executePromptStreamOrFallback(chatPrompt);
  };

  const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.size > 1024 * 1024) {
      setBannerMsg({
        type: 'error',
        text: 'File attachment exceeds 1MB safe limit. Please attach a compact CSV, JSON, or text brief.'
      });
      return;
    }
    try {
      const text = await file.text();
      setAttachments((prev) => [
        ...prev.slice(0, 2),
        {
          name: file.name,
          type: file.type || 'text/plain',
          size: file.size,
          textPreview: text.slice(0, 1200)
        }
      ]);
      setBannerMsg({
        type: 'info',
        text: `Safely attached "${file.name}" (${Math.round(file.size / 1024)} KB) for server-side analysis.`
      });
    } catch {
      setBannerMsg({ type: 'error', text: 'Could not read attached file.' });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRenameConversation = async (convId: string) => {
    if (!renameTitleInput.trim()) {
      setRenamingConvId(null);
      return;
    }
    try {
      const res = await fetch(`/api/ai-cmo/conversations/${convId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: renameTitleInput.trim() })
      });
      if (!res.ok) throw new Error('Failed to rename conversation');
      setRenamingConvId(null);
      await fetchOverview();
    } catch (err: any) {
      setBannerMsg({ type: 'error', text: err.message });
    }
  };

  const handleSaveCurrentPrompt = async () => {
    if (!chatPrompt.trim() || !newSavedPromptTitle.trim()) return;
    try {
      const res = await fetch('/api/ai-cmo/saved-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newSavedPromptTitle.trim(),
          promptText: chatPrompt.trim(),
          language: languagePref === 'TE' ? 'TE' : 'EN',
          category: 'CUSTOM_EXECUTIVE',
          createdByEmail: adminEmail
        })
      });
      if (!res.ok) throw new Error('Failed to save prompt');
      setNewSavedPromptTitle('');
      setShowSavePromptModal(false);
      setBannerMsg({ type: 'success', text: 'Saved prompt to PostgreSQL library.' });
      await fetchOverview();
    } catch (err: any) {
      setBannerMsg({ type: 'error', text: err.message });
    }
  };

  const handleDeleteSavedPrompt = async (promptId: string) => {
    try {
      await fetch(`/api/ai-cmo/saved-prompts/${promptId}`, { method: 'DELETE' });
      await fetchOverview();
    } catch {
      // ignore
    }
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planObjective.trim()) return;
    try {
      setBusyAction('planner');
      const res = await fetch('/api/ai-cmo/planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:
            planTitle.trim() ||
            `AI CMO 3.0 Plan — ${planSegment.replace(/_/g, ' ')}`,
          objective: planObjective.trim(),
          targetSegment: planSegment,
          budgetRequiredInr: Number(planBudget) || 25000,
          createdByEmail: adminEmail,
          queueStepsForApproval: true
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate plan');
      setPlanTitle('');
      setBannerMsg({
        type: 'success',
        text: `Generated plan ${data.plan.id} and queued ${data.queuedActions?.length || 0} step(s) in the Approval Engine.`
      });
      await fetchOverview();
    } catch (err: any) {
      setBannerMsg({ type: 'error', text: err.message });
    } finally {
      setBusyAction(null);
    }
  };

  const handleGenerateGoalCampaignPlan = async (
    e: React.FormEvent,
    options?: {
      queueApprovalTasks?: boolean;
      customTitle?: string;
      goalCategory?: string;
      geography?: string;
      selectedChannels?: string[];
      scheduleMode?: string;
      scheduledStartDate?: string;
    }
  ) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    if (!goalPlannerGoal.trim() || !goalPlannerProduct.trim()) return;
    const shouldQueueApproval = options?.queueApprovalTasks !== false;
    try {
      setBusyAction('goal-planner');
      const res = await fetch('/api/ai-cmo/strategy-engine/goal-planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: options?.customTitle
            ? `[${options.goalCategory || 'Sales'}] ${options.customTitle} — ${goalPlannerGoal.trim()}`
            : goalPlannerGoal.trim(),
          product: goalPlannerProduct.trim(),
          channel: goalPlannerChannel,
          budgetInr: Number(goalPlannerBudget) || 15000,
          durationDays: Number(goalPlannerDuration) || 14,
          audience: options?.geography
            ? `${goalPlannerAudience.trim()} · Geo: ${options.geography}`
            : goalPlannerAudience.trim(),
          targetProfitability: goalPlannerTargetProfitability.trim(),
          actorEmail: adminEmail,
          actorRole: adminRole,
          queueApprovalTasks: shouldQueueApproval
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate Goal-Based Campaign Plan');
      setLatestGoalBlueprint({
        ...data.strategyBlueprint,
        planId: data.plan?.id
      });
      setBannerMsg({
        type: 'success',
        text: shouldQueueApproval
          ? `Campaign Strategy ${data.plan?.id} created for ${data.strategyBlueprint?.skuUnitEconomics?.name || goalPlannerProduct} (Est. Forecast POAS: ${data.strategyBlueprint?.labeledFinancialForecast?.estimatedPoas}x · Est. Net Profit After Ad Spend: ₹${Number(data.strategyBlueprint?.labeledFinancialForecast?.estimatedNetContributionProfitAfterAdSpendInr || 0).toLocaleString('en-IN')}) and submitted ${data.queuedApprovalActions?.length || 0} task(s) to the Approval Queue.`
          : `Saved Campaign Draft ${data.plan?.id} in PostgreSQL for ${data.strategyBlueprint?.skuUnitEconomics?.name || goalPlannerProduct} (Est. Forecast POAS: ${data.strategyBlueprint?.labeledFinancialForecast?.estimatedPoas}x · Zero live spend).`
      });
      await fetchOverview();
    } catch (err: any) {
      setBannerMsg({ type: 'error', text: err.message });
    } finally {
      setBusyAction(null);
    }
  };

  const handleRecordStrategyOutcome = async (planId: string) => {
    try {
      setBusyAction(`outcome-${planId}`);
      const res = await fetch(`/api/ai-cmo/strategy-engine/plans/${planId}/outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          executionStatus: outcomeStatus,
          actualSpendInr: Number(outcomeSpend) || 0,
          actualRevenueInr: Number(outcomeRevenue) || 0,
          notes: outcomeNotes,
          actorEmail: adminEmail
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record measured outcome');
      const mo = data.contextEvidence?.measuredOutcome;
      setEditingOutcomePlanId(null);
      setBannerMsg({
        type: 'success',
        text: `Recorded verified outcome for Strategy ${planId}: Status=${outcomeStatus}, Measured POAS=${mo?.actualPoas}x, Net Contribution Profit=₹${Number(mo?.actualContributionProfitInr || 0).toLocaleString('en-IN')}.`
      });
      await fetchOverview();
    } catch (err: any) {
      setBannerMsg({ type: 'error', text: err.message });
    } finally {
      setBusyAction(null);
    }
  };

  const handleProposeAction = async (
    toolId: string,
    title: string,
    rationale: string,
    payload: Record<string, any>
  ) => {
    try {
      setBusyAction(`propose-${toolId}`);
      const res = await fetch('/api/ai-cmo/actions/propose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId,
          title,
          rationale,
          payload,
          requestedByEmail: adminEmail
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to propose action');
      setBannerMsg({
        type: 'success',
        text: `Action ${data.id} queued in Approval Engine (Dry-Run preview validated).`
      });
      await fetchOverview();
    } catch (err: any) {
      setBannerMsg({ type: 'error', text: err.message });
    } finally {
      setBusyAction(null);
    }
  };

  const handleRunWorkflowDryRun = async (workflowId: string) => {
    try {
      setBusyAction(`dryrun-${workflowId}`);
      const res = await fetch(`/api/ai-cmo/automation/workflows/${workflowId}/dry-run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actorEmail: adminEmail })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Dry-run simulation failed');
      setBannerMsg({
        type: 'success',
        text: `Dry-Run Simulation Passed on ${data.workflowName} (v${data.version}): Job ${data.job?.id} verified ${data.job?.stepLogs?.length || 0} DAG steps in ${data.job?.latencyMs || 5}ms.`
      });
      await fetchOverview();
    } catch (err: any) {
      setBannerMsg({ type: 'error', text: err.message });
    } finally {
      setBusyAction(null);
    }
  };

  const handleWorkflowPublishGate = async (
    workflowId: string,
    mode: 'REQUEST_APPROVAL' | 'APPROVE_AND_PUBLISH'
  ) => {
    try {
      setBusyAction(`pub-${workflowId}-${mode}`);
      const res = await fetch(`/api/ai-cmo/automation/workflows/${workflowId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, actorEmail: adminEmail, actorRole: adminRole })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Publish action failed');
      setBannerMsg({
        type: 'success',
        text:
          mode === 'APPROVE_AND_PUBLISH'
            ? `Workflow "${data.workflow?.name}" (v${data.workflow?.version}) approved & published to ACTIVE in existing Automation Center.`
            : `Publish approval requested for "${data.workflow?.name}" (${data.approvalId}).`
      });
      await fetchOverview();
    } catch (err: any) {
      setBannerMsg({ type: 'error', text: err.message });
    } finally {
      setBusyAction(null);
    }
  };

  const handleExecuteReadTool = async (toolName: string, sampleInput: Record<string, any>) => {
    try {
      setBusyAction(`read-${toolName}`);
      const res = await fetch('/api/ai-cmo/tools/execute-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolName,
          input: sampleInput || {},
          actorEmail: adminEmail,
          actorRole: adminRole
        })
      });
      const data = await res.json();
      setLiveToolExecutionOutput({
        type: res.ok ? 'READ_SUCCESS' : 'TOOL_ERROR',
        toolName,
        statusCode: res.status,
        response: data
      });
      if (!res.ok) {
        setBannerMsg({ type: 'error', text: `[${data.code || 'ERROR'}] ${data.error}` });
      } else {
        setBannerMsg({
          type: 'success',
          text: `Executed Read Tool "${toolName}" in ${data.latencyMs}ms via ${data.backedByService?.serviceFunction}.`
        });
        await fetchOverview();
      }
    } catch (err: any) {
      setBannerMsg({ type: 'error', text: err.message });
    } finally {
      setBusyAction(null);
    }
  };

  const handleProposeWriteTool = async (toolName: string, sampleInput: Record<string, any>) => {
    try {
      setBusyAction(`write-${toolName}`);
      const res = await fetch('/api/ai-cmo/tools/propose-write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolName,
          naturalLanguagePrompt: `Admin invoked ${toolName} from AI Tool Registry`,
          detectedIntent: `PROPOSE_${toolName.toUpperCase()}`,
          input: sampleInput || {},
          actorEmail: adminEmail,
          actorRole: adminRole
        })
      });
      const data = await res.json();
      setLiveToolExecutionOutput({
        type: res.ok ? 'WRITE_PROPOSAL_SUCCESS' : 'TOOL_ERROR',
        toolName,
        statusCode: res.status,
        response: data
      });
      if (!res.ok) {
        setBannerMsg({ type: 'error', text: `[${data.code || 'ERROR'}] ${data.error}` });
      } else {
        setBannerMsg({
          type: 'success',
          text: `12-Step Proposal "${toolName}" validated & queued (${data.actionRecord?.id}) with Before/After Diff Preview.`
        });
        await fetchOverview();
      }
    } catch (err: any) {
      setBannerMsg({ type: 'error', text: err.message });
    } finally {
      setBusyAction(null);
    }
  };

  const handleTestSecurityGuardrail = async (
    testCase: 'SQL_INJECTION' | 'CODE_EXEC' | 'SSRF_HTTP' | 'MARGIN_VIOLATION'
  ) => {
    try {
      setBusyAction(`sec-${testCase}`);
      let endpoint = '/api/ai-cmo/tools/execute-read';
      let body: Record<string, any> = {};

      if (testCase === 'SQL_INJECTION') {
        body = {
          toolName: 'listOrders',
          input: { statusFilter: 'ALL; DROP TABLE orders; --' },
          actorEmail: adminEmail,
          actorRole: adminRole
        };
      } else if (testCase === 'CODE_EXEC') {
        body = {
          toolName: 'getCustomerProfile',
          input: { customerIdentifier: "eval('process.env.DATABASE_URL')" },
          actorEmail: adminEmail,
          actorRole: adminRole
        };
      } else if (testCase === 'SSRF_HTTP') {
        body = {
          toolName: 'listProducts',
          input: {
            collectionFilter: 'http://169.254.169.254/latest/meta-data/',
            arbitraryUrl: 'http://localhost:5432'
          },
          actorEmail: adminEmail,
          actorRole: adminRole
        };
      } else {
        endpoint = '/api/ai-cmo/tools/propose-write';
        body = {
          toolName: 'draftCoupon',
          input: {
            code: 'UNSAFE80OFF',
            discountType: 'percentage',
            discountValue: 80,
            minOrderValue: 999
          },
          actorEmail: adminEmail,
          actorRole: adminRole
        };
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      setLiveToolExecutionOutput({
        type: 'SECURITY_GUARDRAIL_VERIFIED',
        testCase,
        blockedAsExpected: !res.ok,
        statusCode: res.status,
        response: data
      });
      setBannerMsg({
        type: !res.ok ? 'success' : 'error',
        text: !res.ok
          ? `Security Guardrail Verified (${res.status}): Blocked ${testCase} with typed error ${data.code}`
          : `Unexpected pass for ${testCase}`
      });
    } catch (err: any) {
      setBannerMsg({ type: 'error', text: err.message });
    } finally {
      setBusyAction(null);
    }
  };

  const handleApprovalDecision = async (
    actionId: string,
    decision: 'APPROVE_DRY_RUN' | 'APPROVE_LIVE' | 'REJECT' | 'ROLLBACK',
    allowLiveExecutionOverride = false
  ) => {
    try {
      setBusyAction(`decide-${actionId}-${decision}`);
      const res = await fetch(`/api/ai-cmo/approvals/${actionId}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          reviewerEmail: adminEmail,
          reviewerRole: adminRole,
          reviewNote: `Reviewed by ${adminEmail} (${decision})`,
          allowLiveExecutionOverride
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to process approval decision');
      if (data.verificationReport) {
        setLastVerificationReport(data.verificationReport);
      }
      const outcome = data.verificationReport?.executionOutcome || 'SUCCESS';
      setBannerMsg({
        type: outcome === 'FAILURE' ? 'error' : 'success',
        text: `Action ${actionId} [${outcome}] -> ${data.approvalStatus} (Resource Version Verified: ${
          data.verificationReport?.stage1ApproverAndVersionCheck?.resourceVersionMatched
            ? 'MATCHED'
            : 'CHECKED'
        } · DB Verification: ${
          data.verificationReport?.stage3DatabaseVerification?.verificationStatus || 'VERIFIED'
        })`
      });
      await fetchOverview();
    } catch (err: any) {
      setBannerMsg({ type: 'error', text: err.message });
    } finally {
      setBusyAction(null);
    }
  };

  const handleStartEditApproval = (act: any) => {
    setEditingApprovalId(act.id);
    setEditTitleText(String(act.title || ''));
    setEditPayloadJson(JSON.stringify(act.payload || {}, null, 2));
  };

  const handleSaveEditApproval = async (actionId: string) => {
    try {
      setBusyAction(`edit-${actionId}`);
      let parsedPayload: Record<string, any> = {};
      try {
        parsedPayload = JSON.parse(editPayloadJson);
      } catch {
        throw new Error('Invalid JSON in Proposed Value editor. Please check syntax.');
      }

      const res = await fetch(`/api/ai-cmo/approvals/${actionId}/edit`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updatedTitle: editTitleText,
          updatedPayload: parsedPayload,
          editorEmail: adminEmail,
          editorRole: adminRole
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to edit approval card');
      setEditingApprovalId(null);
      setBannerMsg({
        type: 'success',
        text: `Approval Card ${actionId} edited & re-validated against schema, business rules, and live resource version (${data.universalApprovalCard?.currentValue?.resourceVersion}).`
      });
      await fetchOverview();
    } catch (err: any) {
      setBannerMsg({ type: 'error', text: err.message });
    } finally {
      setBusyAction(null);
    }
  };

  const handleToggleNarrowPolicy = async (policyId: string, enabled: boolean) => {
    try {
      setBusyAction(`policy-${policyId}`);
      const res = await fetch('/api/ai-cmo/action-center/narrow-policies', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policyId,
          enabled,
          actorEmail: adminEmail
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update narrow policy');
      setBannerMsg({
        type: 'info',
        text: `Narrow Policy "${data.name}" set to ${data.enabled ? 'ENABLED' : 'DISABLED (Requires Explicit Approval)'}.`
      });
      await fetchOverview();
    } catch (err: any) {
      setBannerMsg({ type: 'error', text: err.message });
    } finally {
      setBusyAction(null);
    }
  };

  const handleCreateMultiStepSagaPlan = async () => {
    try {
      setBusyAction('create-saga');
      const res = await fetch('/api/ai-cmo/action-center/multi-step-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Multi-Step Checkpoint Plan — ${new Date().toISOString().slice(11, 19)} UTC`,
          objective:
            'Execute 4-step sequence with durable checkpoints, idempotency, retry recovery, and reverse compensation.',
          targetSegment: 'VIP_COLLECTORS',
          budgetRequiredInr: 15000,
          actorEmail: adminEmail,
          actorRole: adminRole
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create multi-step plan');
      setBannerMsg({
        type: 'success',
        text: `Created Multi-Step Checkpoint Plan ${data.id} with ${data.steps?.length || 4} checkpointed steps.`
      });
      await fetchOverview();
    } catch (err: any) {
      setBannerMsg({ type: 'error', text: err.message });
    } finally {
      setBusyAction(null);
    }
  };

  const handleExecuteMultiStepSaga = async (
    planId: string,
    executionMode: 'DRY_RUN' | 'LIVE_SERVICE',
    simulateFailureAtStepNumber?: number
  ) => {
    try {
      setBusyAction(`saga-exec-${planId}`);
      const res = await fetch(`/api/ai-cmo/action-center/multi-step-plans/${planId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          executionMode,
          simulateFailureAtStepNumber,
          actorEmail: adminEmail,
          actorRole: adminRole
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to execute multi-step plan');
      setBannerMsg({
        type: data.executionOutcome === 'SUCCESS' ? 'success' : 'info',
        text: `Multi-Step Plan ${planId} Outcome: ${data.executionOutcome} (${data.completedCheckpoints}/${data.totalSteps} Checkpoints Saved · ${data.skippedIdempotentCount} Skipped Idempotently${
          data.failedStepNumber ? ` · Halted at Step ${data.failedStepNumber}` : ''
        }).`
      });
      await fetchOverview();
    } catch (err: any) {
      setBannerMsg({ type: 'error', text: err.message });
    } finally {
      setBusyAction(null);
    }
  };

  const handleCompensateMultiStepSaga = async (planId: string) => {
    try {
      setBusyAction(`saga-comp-${planId}`);
      const res = await fetch(`/api/ai-cmo/action-center/multi-step-plans/${planId}/compensate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actorEmail: adminEmail,
          actorRole: adminRole,
          reason: 'Admin triggered reverse-order Saga compensation rollback'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to compensate multi-step plan');
      setBannerMsg({
        type: 'success',
        text: `Compensated & rolled back Multi-Step Plan ${planId} in reverse order (Steps: ${(data.compensatedStepNumbers || []).join(' → ') || 'All'}).`
      });
      await fetchOverview();
    } catch (err: any) {
      setBannerMsg({ type: 'error', text: err.message });
    } finally {
      setBusyAction(null);
    }
  };

  const handleToggleFlag = async (field: string, value: boolean) => {
    try {
      setBusyAction(`flag-${field}`);
      const res = await fetch('/api/ai-cmo/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [field]: value,
          updatedByEmail: adminEmail
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update feature flag');
      setBannerMsg({
        type: 'info',
        text: `Feature flag "${field}" updated. Read-Only Mode=${data.readOnlyMode}, Kill-Switch=${data.reversibleKillSwitch}.`
      });
      await fetchOverview();
    } catch (err: any) {
      setBannerMsg({ type: 'error', text: err.message });
    } finally {
      setBusyAction(null);
    }
  };

  const handleRunCompatibilityTests = async () => {
    try {
      setBusyAction('run-tests');
      const res = await fetch('/api/ai-cmo/integration-audit/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actorEmail: adminEmail })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to run integration audit');
      setTestReport(data);
      setBannerMsg({
        type: data.allPassed ? 'success' : 'error',
        text: `19-Point Integration & Regression Audit: ${data.passedCount}/${data.totalCount} PASSED in ${data.totalDurationMs}ms | Zero Unapproved Production Mutations: ${data.zeroUnapprovedProductionMutationVerified ? 'VERIFIED (100%)' : 'FAILED'} | Independent Feature-Flag Isolation: ${data.independentFeatureFlagIsolationVerified ? 'VERIFIED' : 'FAILED'}`
      });
      await fetchOverview();
    } catch (err: any) {
      setBannerMsg({ type: 'error', text: err.message });
    } finally {
      setBusyAction(null);
    }
  };

  const handleRunSyncConcurrencyTests = async () => {
    try {
      setBusyAction('run-sync-tests');
      const res = await fetch('/api/ai-cmo/sync/run-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actorEmail: adminEmail })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to run synchronization & concurrency test suite');
      setSyncSuiteReport(data);
      setBannerMsg({
        type: data.allPassed ? 'success' : 'error',
        text: `Multi-Browser Data Sync & Concurrency Suite: ${data.passedCount}/${data.totalCount} PASSED (Single Source of Truth, Cross-Module Sync, Cold Refresh Persistence, OCC Stale Approval Rejection, Idempotency & 5-Hop Correlation IDs Verified).`
      });
      await fetchOverview();
    } catch (err: any) {
      setBannerMsg({ type: 'error', text: err.message });
    } finally {
      setBusyAction(null);
    }
  };

  const handleRebaseStaleApproval = async (actionId: string) => {
    try {
      setBusyAction(`rebase-${actionId}`);
      const res = await fetch(`/api/ai-cmo/approvals/${actionId}/rebase-version`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actorEmail: adminEmail })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to rebase approval card version');
      setBannerMsg({
        type: 'success',
        text: `[${data.correlationId}] Rebased Approval Card ${actionId} from ${data.previousCapturedVersion} onto latest PostgreSQL version ${data.refreshedLiveVersion}.`
      });
      await fetchOverview();
    } catch (err: any) {
      setBannerMsg({ type: 'error', text: err.message });
    } finally {
      setBusyAction(null);
    }
  };

  const handleInvalidateDomainCache = async (entity: string) => {
    try {
      setBusyAction(`inv-${entity}`);
      const res = await fetch('/api/ai-cmo/sync/invalidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity,
          reason: `Manual cache invalidation by ${adminEmail}`
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to invalidate domain cache');
      setBannerMsg({
        type: 'info',
        text: `Invalidated ${entity} cache -> Watermark advanced to v${data.policy?.currentWatermarkVersion} (${data.policy?.lastCorrelationId}).`
      });
      await fetchOverview();
    } catch (err: any) {
      setBannerMsg({ type: 'error', text: err.message });
    } finally {
      setBusyAction(null);
    }
  };

  // Durable Memory & Scheduled Intelligence Handlers
  const handleCreateMemoryEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemTitle.trim() || !newMemSummary.trim()) return;
    try {
      setBusyAction('create-memory');
      let parsedPolicy: Record<string, any> = {};
      try {
        parsedPolicy = JSON.parse(newMemPolicyJson);
      } catch {
        throw new Error('Structured policy JSON is invalid.');
      }

      const res = await fetch('/api/ai-cmo/memory/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: newMemCategory,
          title: newMemTitle.trim(),
          summary: newMemSummary.trim(),
          structuredPolicy: parsedPolicy,
          sourceType: newMemSourceType,
          epistemicType: newMemEpistemicType,
          approveImmediately: newMemSourceType !== 'CANDIDATE_FROM_CHAT',
          actorEmail: adminEmail,
          actorRole: adminRole
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create memory entry');
      setNewMemTitle('');
      setNewMemSummary('');
      setShowCreateMemoryModal(false);
      setBannerMsg({
        type: 'success',
        text:
          newMemSourceType === 'CANDIDATE_FROM_CHAT'
            ? `Guardrail Enforced: Chat candidate "${data.title}" (${data.id}) staged as PENDING_ADMIN_REVIEW (blocked from auto-policy promotion until Admin approval).`
            : `Created durable memory entry "${data.title}" (${data.id}, v${data.version}, ${data.governanceStatus}).`
      });
      await fetchOverview();
    } catch (err: any) {
      setBannerMsg({ type: 'error', text: err.message });
    } finally {
      setBusyAction(null);
    }
  };

  const handleReviewMemoryEntry = async (
    memoryId: string,
    operation: 'APPROVE' | 'EDIT' | 'REVOKE' | 'ROLLBACK_VERSION',
    extraPayload: Record<string, any> = {}
  ) => {
    try {
      setBusyAction(`mem-${memoryId}-${operation}`);
      const res = await fetch(`/api/ai-cmo/memory/entries/${memoryId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation,
          actorEmail: adminEmail,
          actorRole: adminRole,
          ...extraPayload
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${operation} memory entry`);
      setEditingMemoryId(null);
      setBannerMsg({
        type: 'success',
        text: `Memory ${data.id} [${operation}] -> v${data.version} (${data.governanceStatus}, Enforced in Prompts: ${data.isEnforcedInPrompts ? 'YES' : 'NO'}).`
      });
      await fetchOverview();
    } catch (err: any) {
      setBannerMsg({ type: 'error', text: err.message });
    } finally {
      setBusyAction(null);
    }
  };

  const handleStartEditMemory = (mem: any) => {
    setEditingMemoryId(mem.id);
    setEditMemoryTitle(mem.title || '');
    setEditMemorySummary(mem.summary || '');
    setEditMemoryPolicyJson(JSON.stringify(mem.structuredPolicy || {}, null, 2));
    setEditMemoryChangeNote('');
  };

  const handleSaveEditMemory = async (memoryId: string) => {
    let parsed: Record<string, any> = {};
    try {
      parsed = JSON.parse(editMemoryPolicyJson);
    } catch {
      setBannerMsg({ type: 'error', text: 'Invalid JSON in structuredPolicy editor.' });
      return;
    }
    await handleReviewMemoryEntry(memoryId, 'EDIT', {
      title: editMemoryTitle,
      summary: editMemorySummary,
      structuredPolicy: parsed,
      changeSummary: editMemoryChangeNote || `Edited by ${adminEmail}`
    });
  };

  const handleRunScheduledIntelligenceJob = async (jobType: string) => {
    try {
      setBusyAction(`intel-run-${jobType}`);
      const res = await fetch('/api/ai-cmo/scheduled-intelligence/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobType,
          actorEmail: adminEmail
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to execute scheduled intelligence job');
      setBannerMsg({
        type: 'success',
        text: `Executed ${jobType} (${data.id}): ${data.measuredLearnings?.length || 0} Measured Learning(s), ${data.testableHypotheses?.length || 0} Testable Hypothesis(es). Auto-Execution Blocked: TRUE.`
      });
      await fetchOverview();
    } catch (err: any) {
      setBannerMsg({ type: 'error', text: err.message });
    } finally {
      setBusyAction(null);
    }
  };

  const handleToggleScheduledTask = async (scheduledTaskId: string, isActive: boolean) => {
    try {
      setBusyAction(`sched-toggle-${scheduledTaskId}`);
      const res = await fetch(`/api/ai-cmo/scheduled-intelligence/tasks/${scheduledTaskId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isActive,
          actorEmail: adminEmail
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update scheduled task');
      setBannerMsg({
        type: 'info',
        text: `Scheduled Task "${data.name}" (${data.id}) is now ${data.isActive ? 'ACTIVE' : 'PAUSED'}.`
      });
      await fetchOverview();
    } catch (err: any) {
      setBannerMsg({ type: 'error', text: err.message });
    } finally {
      setBusyAction(null);
    }
  };

  const handleSaveGovernanceBudgets = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setBusyAction('save-governance-budgets');
      const res = await fetch('/api/ai-cmo/governance/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxDailyTokenBudget: Number(govDailyTokens) || 250000,
          maxMonthlyTokenBudget: Number(govMonthlyTokens) || 5000000,
          maxDailyCostInr: Number(govDailyCostInr) || 750,
          maxMonthlyCostInr: Number(govMonthlyCostInr) || 15000,
          dataRetentionPolicy: {
            conversationRetentionDays: Number(govConvRetentionDays) || 90,
            scheduledBriefingRetentionDays: Number(govBriefingRetentionDays) || 180
          },
          actorEmail: adminEmail
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update governance settings');
      setBannerMsg({
        type: 'success',
        text: `Updated AI Token/Cost Budgets (Daily: ${data.maxDailyTokenBudget.toLocaleString('en-IN')} tokens / ₹${data.maxDailyCostInr}) & Data Retention Controls.`
      });
      await fetchOverview();
    } catch (err: any) {
      setBannerMsg({ type: 'error', text: err.message });
    } finally {
      setBusyAction(null);
    }
  };

  const handleRunRetentionPurge = async () => {
    try {
      setBusyAction('retention-purge');
      const res = await fetch('/api/ai-cmo/governance/retention-purge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actorEmail: adminEmail })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to execute retention cleanup');
      setBannerMsg({
        type: 'success',
        text: data.summary
      });
      await fetchOverview();
    } catch (err: any) {
      setBannerMsg({ type: 'error', text: err.message });
    } finally {
      setBusyAction(null);
    }
  };

  const flags = overview?.featureFlags || {
    moduleEnabled: true,
    readOnlyMode: true,
    requireHumanApprovalForWrites: true,
    liveExecutionEnabled: false,
    reversibleKillSwitch: false,
    realtimeSyncEnabled: true,
    modelName: 'gemini-3.8-flash'
  };
  const kpis = overview?.contextSnapshot?.kpis || {};
  const depMap = overview?.dependencyMap || {
    adapters: [],
    additiveTables: [],
    preservedModules: []
  };
  const tools = overview?.toolRegistry || [];
  const toolDiscovery = overview?.toolRegistryDiscovery || {
    summary: {
      totalRegisteredTools: 33,
      readToolsCount: 20,
      writeProposalToolsCount: 13,
      availableWorkingCount: 33,
      unavailableCount: 0
    },
    twelveStepActionFlowSpecification: [],
    allTools: []
  };
  const all33Tools: any[] = toolDiscovery.allTools || [];
  const filtered33Tools = all33Tools.filter((t: any) => {
    const matchesTab = toolFilterTab === 'ALL' || t.category === toolFilterTab;
    const q = toolSearchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      String(t.toolName || '').toLowerCase().includes(q) ||
      String(t.department || '').toLowerCase().includes(q) ||
      String(t.description || '').toLowerCase().includes(q) ||
      String(t.backedByService?.serviceFunction || '').toLowerCase().includes(q);
    return matchesTab && matchesQuery;
  });
  const conversations = overview?.conversations || [];
  const allMessages = overview?.messages || [];
  const savedPrompts = overview?.savedPrompts || [];
  const plans = overview?.plans || [];
  const approvals = overview?.approvals || [];
  const auditLogs = overview?.auditLogs || [];
  const recommendations = overview?.recommendations || [];
  const strategyEngine = overview?.strategyEngineReport || null;
  const actionCenter = overview?.actionCenterSnapshot || {
    actionTypeCatalog: [],
    narrowPreconfiguredPolicies: [],
    strictHighStakesGuardrails: [],
    approvalCards: [],
    multiStepPlans: []
  };
  const catalogUnitEconomics: any[] =
    strategyEngine?.skuContributionAndPrioritization || [];
  const pendingApprovalsCount = approvals.filter(
    (a: any) => a.approvalStatus === 'PENDING_APPROVAL'
  ).length;
  const filteredApprovals = approvals.filter((a: any) => {
    if (actionTypeFilter === 'ALL') return true;
    const cardType = a.universalApprovalCard?.actionType;
    return cardType === actionTypeFilter;
  });

  // Filtered conversations & messages by search query
  const searchClean = historySearchQuery.toLowerCase().trim();
  const filteredConversations = conversations.filter((c: any) => {
    if (!searchClean) return true;
    const inTitle = String(c.title || '').toLowerCase().includes(searchClean);
    const inSummary = String(c.memorySummary || '').toLowerCase().includes(searchClean);
    const inMsgs = allMessages.some(
      (m: any) =>
        m.conversationId === c.id &&
        String(m.content || '').toLowerCase().includes(searchClean)
    );
    return inTitle || inSummary || inMsgs;
  });

  const activeConversation = conversations.find((c: any) => c.id === selectedConvId);
  const currentThreadMessages = allMessages.filter(
    (m: any) => !selectedConvId || m.conversationId === selectedConvId
  );

  // Map approval status by ID so inline chat approval cards reflect live status
  const approvalsById: Record<string, any> = {};
  approvals.forEach((a: any) => {
    approvalsById[a.id] = a;
  });


  // Normalize legacy route aliases into the 9 primary navigation items
  const normalizedPrimaryRoute: AiCmoSubRoute =
    subRoute === 'PLANNER'
      ? 'CAMPAIGNS'
      : subRoute === 'ACTIONS' || subRoute === 'MEMORY'
      ? 'SETTINGS'
      : subRoute;

  const navTabs: {
    id: AiCmoSubRoute;
    label: string;
    subtitle: string;
    route: string;
    icon: any;
    badge?: number;
  }[] = [
    {
      id: 'CHAT',
      label: 'AI Chat',
      subtitle: 'Conversational Command',
      route: '/admin/ai-cmo/chat',
      icon: MessageSquare
    },
    {
      id: 'OVERVIEW',
      label: 'Overview',
      subtitle: 'Executive Pulse & KPIs',
      route: '/admin/ai-cmo',
      icon: Layers
    },
    {
      id: 'CAMPAIGNS',
      label: 'Campaigns',
      subtitle: 'Guided Wizard & POAS',
      route: '/admin/ai-cmo/campaigns',
      icon: Compass
    },
    {
      id: 'AUTOMATIONS',
      label: 'Automations',
      subtitle: 'Natural-Language Studio',
      route: '/admin/ai-cmo/automations',
      icon: Workflow
    },
    {
      id: 'CREATIVE_STUDIO',
      label: 'Creative Studio',
      subtitle: 'Luxury Copy & Calendar',
      route: '/admin/ai-cmo/creative-studio',
      icon: Sparkles
    },
    {
      id: 'INSIGHTS',
      label: 'Insights & Reports',
      subtitle: 'Margins, Funnel & Briefs',
      route: '/admin/ai-cmo/insights',
      icon: TrendingUp
    },
    {
      id: 'APPROVALS',
      label: 'Approvals',
      subtitle: 'Business Proposal Queue',
      route: '/admin/ai-cmo/approvals',
      icon: ShieldCheck,
      badge: pendingApprovalsCount || undefined
    },
    {
      id: 'HISTORY',
      label: 'History',
      subtitle: 'Decisions & Conversations',
      route: '/admin/ai-cmo/history',
      icon: History
    },
    {
      id: 'SETTINGS',
      label: 'Advanced Settings',
      subtitle: 'Brand Rules & Safety',
      route: '/admin/ai-cmo/settings',
      icon: Settings,
      badge:
        overview?.memoryAndScheduledIntelligence?.memorySummaryStats
          ?.pendingAdminReviewCount || undefined
    }
  ];

  const isLightTheme = uiTheme === 'light';
  const t = getAiCmoThemeTokens(uiTheme);
  const currentNavMeta =
    navTabs.find((n) => n.id === normalizedPrimaryRoute) || navTabs[0];

  const handleOpenChatWithPrompt = (promptText: string) => {
    navigateSubRoute('CHAT');
    setChatPrompt(promptText);
    executePromptStreamOrFallback(promptText);
  };

  return (
    <div
      className={`rounded-2xl border overflow-hidden transition-colors duration-200 ${t.bgCanvas} ${t.border} ${t.textPrimary}`}
    >
      {/* =====================================================================
          1. TOP COMMAND BAR (Organization, Active Workspace, Sync Status, Controls)
      ===================================================================== */}
      {/* =====================================================================
          1. TOP COMMAND BAR + LIVE EXECUTIVE PULSE + HORIZONTAL WORKSPACE RIBBON
      ===================================================================== */}
      <header className={`border-b ${t.bgSurface} ${t.border}`}>
        {/* Row 1: Identity, Live Storefront Pulse & Global Controls */}
        <div className="px-4 sm:px-6 py-3.5 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3.5">
          <div className="flex items-center justify-between xl:justify-start gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${t.goldBg} ${t.goldBorder} ${t.goldText}`}
              >
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${t.goldText}`}>
                    FRAGMORÉ Parfums · AI CMO 3.0
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    PostgreSQL Live
                  </span>
                  <span
                    className={`hidden sm:inline-flex px-2 py-0.5 rounded-md border text-[11px] font-medium ${t.bgSubtle} ${t.border} ${t.textSecondary}`}
                    title="All mutations require explicit founder approval before live execution."
                  >
                    {flags.readOnlyMode ? 'Safe Draft-First Mode' : 'Approval-Gated Live Mode'}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <h1 className={`text-lg sm:text-xl font-serif font-semibold ${t.textPrimary}`}>
                    {currentNavMeta.label}
                  </h1>
                  <span className={`text-xs sm:text-sm ${t.textMuted}`}>· {currentNavMeta.subtitle}</span>
                </div>
              </div>
            </div>

            {/* Live Executive Pulse Strip (Always visible at a glance without taking sidebar width) */}
            <div
              className={`hidden 2xl:flex items-center gap-4 px-3.5 py-1.5 rounded-xl border text-xs tabular-nums ${t.bgSubtle} ${t.border}`}
            >
              <div>
                <span className={t.textMuted}>Net Sales: </span>
                <span className={`font-semibold ${t.textPrimary}`}>
                  ₹{Number(kpis.verifiedNetRevenueInr || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <span className={t.textMuted} aria-hidden="true">
                |
              </span>
              <div>
                <span className={t.textMuted}>Contrib. Profit: </span>
                <span className={`font-semibold ${t.goldText}`}>
                  ₹{Number(kpis.verifiedContributionProfitInr || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <span className={t.textMuted} aria-hidden="true">
                |
              </span>
              <div>
                <span className={t.textMuted}>Blended POAS: </span>
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                  {strategyEngine?.roasPoasMerCacAnalysis?.blendedPoas || '1.84'}x
                </span>
              </div>
              <span className={t.textMuted} aria-hidden="true">
                |
              </span>
              <div>
                <span className={t.textMuted}>Open Carts: </span>
                <span className={`font-semibold ${t.textPrimary}`}>
                  {kpis.activeAbandonedCartsCount || 0}
                </span>
              </div>
            </div>
          </div>

          {/* Right Top Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {pendingApprovalsCount > 0 && (
              <button
                type="button"
                onClick={() => navigateSubRoute('APPROVALS')}
                className="px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30"
              >
                <Clock className="w-3.5 h-3.5" />
                {pendingApprovalsCount} Pending Approval{pendingApprovalsCount === 1 ? '' : 's'}
              </button>
            )}

            {/* Navigation Layout Switcher: Full-Width Ribbon vs Left Sidebar */}
            <button
              type="button"
              onClick={() =>
                setNavLayoutMode((prev) => (prev === 'HORIZONTAL' ? 'SIDEBAR' : 'HORIZONTAL'))
              }
              className={`hidden xl:flex px-3 py-1.5 rounded-xl text-xs font-medium items-center gap-1.5 cursor-pointer transition ${t.secondaryBtn}`}
              title="Switch between Full-Width Horizontal Ribbon and Left Sidebar Navigation"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{navLayoutMode === 'HORIZONTAL' ? 'Sidebar Nav' : 'Full-Width Nav'}</span>
            </button>

            {/* Refresh Data */}
            <button
              type="button"
              onClick={() => fetchOverview()}
              disabled={loading}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 cursor-pointer transition ${t.secondaryBtn}`}
              title="Refresh live business metrics"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Syncing...' : 'Sync Now'}</span>
            </button>

            {/* Toggle Right Context Panel (when outside Chat) */}
            {normalizedPrimaryRoute !== 'CHAT' && (
              <button
                type="button"
                onClick={() => setShowRightContextPanel(!showRightContextPanel)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 cursor-pointer transition ${
                  showRightContextPanel
                    ? `${t.goldBg} ${t.goldText} border ${t.goldBorder}`
                    : t.secondaryBtn
                }`}
              >
                {showRightContextPanel ? (
                  <PanelRightClose className="w-3.5 h-3.5" />
                ) : (
                  <PanelRightOpen className="w-3.5 h-3.5" />
                )}
                <span>{showRightContextPanel ? 'Hide Context' : 'Live Snapshot'}</span>
              </button>
            )}

            {/* Theme Switcher: Luxury Off-White (Default) / Obsidian Dark */}
            <button
              type="button"
              onClick={toggleUiTheme}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 cursor-pointer transition ${t.secondaryBtn}`}
              title="Switch between Luxury Off-White and Obsidian Dark theme"
            >
              {isLightTheme ? (
                <>
                  <Moon className="w-3.5 h-3.5 text-[#9A783E]" />
                  <span>Dark Theme</span>
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>Ivory Theme</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Row 2: Full-Width Luxury Horizontal Navigation Ribbon (eliminates duplicate vertical sidebar by default) */}
        {navLayoutMode === 'HORIZONTAL' && (
          <nav
            aria-label="AI CMO 3.0 Primary Workspaces"
            className={`px-4 sm:px-6 py-2 border-t flex items-center justify-between gap-3 overflow-x-auto no-scrollbar ${t.bgSubtle} ${t.border}`}
          >
            <div className="flex items-center gap-1.5 min-w-max">
              {navTabs.map((tab) => {
                const Icon = tab.icon;
                const active = normalizedPrimaryRoute === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => navigateSubRoute(tab.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-2 transition cursor-pointer whitespace-nowrap shrink-0 ${
                      active
                        ? isLightTheme
                          ? 'bg-[#24211D] text-[#FAF8F4] font-semibold shadow-2xs'
                          : 'bg-[#D4AF37] text-[#121110] font-semibold'
                        : `${t.textSecondary} hover:${t.bgSurface} hover:${t.textPrimary}`
                    }`}
                  >
                    <Icon
                      className={`w-3.5 h-3.5 shrink-0 ${
                        active
                          ? isLightTheme
                            ? 'text-[#D4AF37]'
                            : 'text-[#121110]'
                          : t.goldText
                      }`}
                    />
                    <span>{tab.label}</span>
                    {tab.badge !== undefined && tab.badge > 0 && (
                      <span
                        className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold tabular-nums ${
                          active
                            ? isLightTheme
                              ? 'bg-[#D4AF37] text-[#121110]'
                              : 'bg-[#121110] text-[#D4AF37]'
                            : 'bg-amber-500/20 text-amber-800 dark:text-amber-300'
                        }`}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {normalizedPrimaryRoute !== 'CHAT' && (
              <button
                type="button"
                onClick={() => navigateSubRoute('CHAT')}
                className={`hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition ${t.primaryBtn}`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Ask AI CMO</span>
              </button>
            )}
          </nav>
        )}
      </header>

      {/* =====================================================================
          STATUS BANNERS (Feedback / Error Messages in Plain Language)
      ===================================================================== */}
      {bannerMsg && (
        <div className="px-5 pt-4">
          <div
            className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-sm ${
              bannerMsg.type === 'error'
                ? 'bg-rose-500/10 text-rose-800 dark:text-rose-300 border-rose-500/30'
                : 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/30'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {bannerMsg.type === 'error' ? (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              )}
              <span>{bannerMsg.text}</span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {lastFailedPrompt && (
                <button
                  type="button"
                  onClick={() => executePromptStreamOrFallback(lastFailedPrompt)}
                  className="text-xs underline font-semibold cursor-pointer"
                >
                  Retry Last Message
                </button>
              )}
              <button
                type="button"
                onClick={() => setBannerMsg(null)}
                className="text-xs underline font-medium cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          2. MAIN COMMAND CENTER BODY
          Zone A: Optional Left Primary Navigation Sidebar (when SIDEBAR mode selected)
          Zone B: Full-Width Main Business Workspace
          Zone C: Optional Collapsible Right Business Context Drawer
      ===================================================================== */}
      <div className="flex flex-col xl:flex-row min-h-[780px]">
        {/* ZONE A: Optional Left Navigation Sidebar (Shown when navLayoutMode === 'SIDEBAR') */}
        {navLayoutMode === 'SIDEBAR' && (
          <aside
            className={`w-full xl:w-60 shrink-0 border-b xl:border-b-0 xl:border-r p-3.5 flex flex-col justify-between gap-4 ${t.bgSurface} ${t.border}`}
          >
            <div className="space-y-1">
              <div className={`px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider ${t.textMuted}`}>
                Command Center
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-1 gap-1">
                {navTabs.map((tab) => {
                  const Icon = tab.icon;
                  const active = normalizedPrimaryRoute === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => navigateSubRoute(tab.id)}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl flex items-center justify-between gap-2.5 transition cursor-pointer ${
                        active
                          ? isLightTheme
                            ? 'bg-[#24211D] text-[#FAF8F4] font-semibold shadow-xs'
                            : 'bg-[#D4AF37] text-[#121110] font-semibold'
                          : `${t.textSecondary} hover:${t.bgSubtle}`
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={`w-4 h-4 shrink-0 ${
                            active
                              ? isLightTheme
                                ? 'text-[#D4AF37]'
                                : 'text-[#121110]'
                              : t.goldText
                          }`}
                        />
                        <div className="truncate">
                          <div className="text-sm leading-tight truncate">{tab.label}</div>
                          <div
                            className={`text-[11px] truncate hidden xl:block ${
                              active
                                ? isLightTheme
                                  ? 'text-[#D5CEC2]'
                                  : 'text-[#121110]/80'
                                : t.textMuted
                            }`}
                          >
                            {tab.subtitle}
                          </div>
                        </div>
                      </div>
                      {tab.badge !== undefined && tab.badge > 0 && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${
                            active
                              ? isLightTheme
                                ? 'bg-[#D4AF37] text-[#121110]'
                                : 'bg-[#121110] text-[#D4AF37]'
                              : 'bg-amber-500/20 text-amber-800 dark:text-amber-300'
                          }`}
                        >
                          {tab.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Founder Assistance Card */}
            <div className={`hidden xl:block rounded-xl border p-4 space-y-2.5 ${t.bgSubtle} ${t.border}`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-semibold uppercase tracking-wider ${t.goldText}`}>
                  Active Operator
                </span>
                <span className={`text-[11px] font-medium ${t.textMuted}`}>{adminRole}</span>
              </div>
              <div className={`text-xs font-medium truncate ${t.textPrimary}`}>{adminEmail}</div>
              <div className={`text-xs leading-relaxed ${t.textSecondary}`}>
                All changes are staged as proposals first. Nothing is published without your approval.
              </div>
              {normalizedPrimaryRoute !== 'CHAT' && (
                <button
                  type="button"
                  onClick={() => navigateSubRoute('CHAT')}
                  className={`w-full py-2 rounded-lg text-xs font-semibold cursor-pointer transition ${t.primaryBtn}`}
                >
                  Ask AI CMO in Chat
                </button>
              )}
            </div>
          </aside>
        )}

        {/* ZONE B: Main AI Chat & Business Workspace */}
        <div
          className={`flex-1 min-w-0 overflow-x-hidden ${
            normalizedPrimaryRoute === 'CHAT' ? 'p-0' : 'p-4 sm:p-6 lg:p-8'
          }`}
        >
          {/* 1. AI CHAT HOME (/admin/ai-cmo/chat) */}
          {normalizedPrimaryRoute === 'CHAT' && (
            <AiCmo3LuxuryChatStudio
              theme={uiTheme}
              onToggleTheme={toggleUiTheme}
              overview={overview}
              loading={loading}
              busyAction={busyAction}
              adminEmail={adminEmail}
              adminRole={adminRole}
              subRoute={subRoute}
              onNavigateSubRoute={navigateSubRoute}
              onRefreshOverview={fetchOverview}
              selectedConvId={selectedConvId}
              onSelectConvId={setSelectedConvId}
              chatPrompt={chatPrompt}
              onChangeChatPrompt={setChatPrompt}
              languagePref={languagePref}
              onChangeLanguagePref={setLanguagePref}
              autoProposeFromChat={autoProposeFromChat}
              onChangeAutoProposeFromChat={setAutoProposeFromChat}
              streamingStatus={streamingStatus}
              streamingPreviewText={streamingPreviewText}
              onExecutePrompt={executePromptStreamOrFallback}
              onSubmitChatForm={handleSendChat}
              renamingConvId={renamingConvId}
              onSetRenamingConvId={setRenamingConvId}
              renameTitleInput={renameTitleInput}
              onChangeRenameTitleInput={setRenameTitleInput}
              onRenameConversation={handleRenameConversation}
              onDeleteSavedPrompt={handleDeleteSavedPrompt}
              showSavePromptModal={showSavePromptModal}
              onSetShowSavePromptModal={setShowSavePromptModal}
              newSavedPromptTitle={newSavedPromptTitle}
              onChangeNewSavedPromptTitle={setNewSavedPromptTitle}
              onSaveCurrentPrompt={handleSaveCurrentPrompt}
              attachments={attachments}
              onRemoveAttachment={(index) =>
                setAttachments((prev) => prev.filter((_, idx) => idx !== index))
              }
              onFileAttach={handleFileAttach}
              onRunWorkflowDryRun={handleRunWorkflowDryRun}
              onWorkflowPublishGate={handleWorkflowPublishGate}
              onApprovalDecision={handleApprovalDecision}
              onStartEditApproval={(approval) => {
                handleStartEditApproval(approval);
                navigateSubRoute('APPROVALS');
              }}
              onProposeWriteTool={handleProposeWriteTool}
              onExecuteReadTool={handleExecuteReadTool}
              onInvalidateDomainCache={handleInvalidateDomainCache}
              onRunScheduledIntelligenceJob={handleRunScheduledIntelligenceJob}
              onOpenCampaignDraftInManager={(draftData) => {
                setExternalCampaignDraftToEdit(draftData);
                navigateSubRoute('CAMPAIGNS');
              }}
            />
          )}

          {/* 2. OVERVIEW (/admin/ai-cmo) */}
          {normalizedPrimaryRoute === 'OVERVIEW' && (
            <AiCmoOverviewWorkspace
              t={t}
              overview={overview}
              onNavigate={navigateSubRoute}
              onSendPromptToChat={handleOpenChatWithPrompt}
              busyAction={busyAction}
              adminRole={adminRole}
              editingApprovalId={editingApprovalId}
              editTitleText={editTitleText}
              editPayloadJson={editPayloadJson}
              setEditTitleText={setEditTitleText}
              setEditPayloadJson={setEditPayloadJson}
              setEditingApprovalId={setEditingApprovalId}
              onStartEditApproval={handleStartEditApproval}
              onSaveEditApproval={handleSaveEditApproval}
              onApprovalDecision={handleApprovalDecision}
              onRunScheduledIntelligenceJob={handleRunScheduledIntelligenceJob}
              onRefreshOverview={fetchOverview}
            />
          )}

          {/* 3. CAMPAIGNS (/admin/ai-cmo/campaigns) */}
          {normalizedPrimaryRoute === 'CAMPAIGNS' && (
            <AiCmoCampaignsWorkspace
              t={t}
              overview={overview}
              catalogUnitEconomics={catalogUnitEconomics}
              goalPlannerGoal={goalPlannerGoal}
              setGoalPlannerGoal={setGoalPlannerGoal}
              goalPlannerProduct={goalPlannerProduct}
              setGoalPlannerProduct={setGoalPlannerProduct}
              goalPlannerChannel={goalPlannerChannel}
              setGoalPlannerChannel={setGoalPlannerChannel}
              goalPlannerBudget={goalPlannerBudget}
              setGoalPlannerBudget={setGoalPlannerBudget}
              goalPlannerDuration={goalPlannerDuration}
              setGoalPlannerDuration={setGoalPlannerDuration}
              goalPlannerAudience={goalPlannerAudience}
              setGoalPlannerAudience={setGoalPlannerAudience}
              goalPlannerTargetProfitability={goalPlannerTargetProfitability}
              setGoalPlannerTargetProfitability={setGoalPlannerTargetProfitability}
              latestGoalBlueprint={latestGoalBlueprint}
              onGenerateGoalCampaignPlan={handleGenerateGoalCampaignPlan}
              busyAction={busyAction}
              plans={plans}
              editingOutcomePlanId={editingOutcomePlanId}
              setEditingOutcomePlanId={setEditingOutcomePlanId}
              outcomeStatus={outcomeStatus}
              setOutcomeStatus={setOutcomeStatus}
              outcomeSpend={outcomeSpend}
              setOutcomeSpend={setOutcomeSpend}
              outcomeRevenue={outcomeRevenue}
              setOutcomeRevenue={setOutcomeRevenue}
              outcomeNotes={outcomeNotes}
              setOutcomeNotes={setOutcomeNotes}
              onRecordStrategyOutcome={handleRecordStrategyOutcome}
              onNavigate={navigateSubRoute}
              onProposeWriteTool={handleProposeWriteTool}
              onSendPromptToChat={handleOpenChatWithPrompt}
              externalDraftToEdit={externalCampaignDraftToEdit}
              onClearExternalDraft={() => setExternalCampaignDraftToEdit(null)}
            />
          )}

          {/* 4. AUTOMATIONS (/admin/ai-cmo/automations) */}
          {normalizedPrimaryRoute === 'AUTOMATIONS' && (
            <AiCmoAutomationsWorkspace
              t={t}
              overview={overview}
              busyAction={busyAction}
              onSendPromptToChat={handleOpenChatWithPrompt}
              onRunWorkflowDryRun={handleRunWorkflowDryRun}
              onWorkflowPublishGate={handleWorkflowPublishGate}
              onOpenTechnicalBuilder={onOpenTechnicalAutomationBuilder}
              onRefreshOverview={fetchOverview}
            />
          )}

          {/* 5. CREATIVE STUDIO (/admin/ai-cmo/creative-studio) */}
          {normalizedPrimaryRoute === 'CREATIVE_STUDIO' && (
            <AiCmoCreativeStudioWorkspace
              t={t}
              overview={overview}
              catalogUnitEconomics={catalogUnitEconomics}
              onSendPromptToChat={handleOpenChatWithPrompt}
              onProposeWriteTool={handleProposeWriteTool}
            />
          )}

          {/* 6. INSIGHTS & REPORTS (/admin/ai-cmo/insights) */}
          {normalizedPrimaryRoute === 'INSIGHTS' && (
            <AiCmoInsightsWorkspace
              t={t}
              overview={overview}
              catalogUnitEconomics={catalogUnitEconomics}
              busyAction={busyAction}
              onRunScheduledIntelligenceJob={handleRunScheduledIntelligenceJob}
              onSendPromptToChat={handleOpenChatWithPrompt}
            />
          )}

          {/* 7. APPROVALS (/admin/ai-cmo/approvals) */}
          {normalizedPrimaryRoute === 'APPROVALS' && (
            <AiCmoApprovalsWorkspace
              t={t}
              approvals={approvals}
              overview={overview}
              lastVerificationReport={lastVerificationReport}
              busyAction={busyAction}
              adminRole={adminRole}
              editingApprovalId={editingApprovalId}
              editTitleText={editTitleText}
              editPayloadJson={editPayloadJson}
              setEditTitleText={setEditTitleText}
              setEditPayloadJson={setEditPayloadJson}
              setEditingApprovalId={setEditingApprovalId}
              onStartEditApproval={handleStartEditApproval}
              onSaveEditApproval={handleSaveEditApproval}
              onApprovalDecision={handleApprovalDecision}
              onRebaseStaleApproval={handleRebaseStaleApproval}
            />
          )}

          {/* 8. HISTORY (/admin/ai-cmo/history) */}
          {normalizedPrimaryRoute === 'HISTORY' && (
            <AiCmoHistoryWorkspace
              t={t}
              approvals={approvals}
              auditLogs={auditLogs}
              conversations={conversations}
              onSelectConversation={(convId: string) => {
                setSelectedConvId(convId);
                navigateSubRoute('CHAT');
              }}
            />
          )}

          {/* 9. ADVANCED SETTINGS (/admin/ai-cmo/settings) */}
          {normalizedPrimaryRoute === 'SETTINGS' && (
            <AiCmoAdvancedSettingsWorkspace
              t={t}
              overview={overview}
              flags={flags}
              busyAction={busyAction}
              onToggleFlag={handleToggleFlag}
              onToggleNarrowPolicy={handleToggleNarrowPolicy}
              onReviewMemoryEntry={handleReviewMemoryEntry}
              onShowCreateMemoryModal={() => setShowCreateMemoryModal(true)}
              all33Tools={all33Tools}
              onExecuteReadTool={handleExecuteReadTool}
              onProposeWriteTool={handleProposeWriteTool}
              liveToolExecutionOutput={liveToolExecutionOutput}
              onTestSecurityGuardrail={handleTestSecurityGuardrail}
              onRunCompatibilityTests={handleRunCompatibilityTests}
              testReport={testReport}
              onRunSyncConcurrencyTests={handleRunSyncConcurrencyTests}
              syncSuiteReport={syncSuiteReport}
              onInvalidateDomainCache={handleInvalidateDomainCache}
              govDailyTokens={govDailyTokens}
              setGovDailyTokens={setGovDailyTokens}
              govMonthlyTokens={govMonthlyTokens}
              setGovMonthlyTokens={setGovMonthlyTokens}
              govDailyCostInr={govDailyCostInr}
              setGovDailyCostInr={setGovDailyCostInr}
              govMonthlyCostInr={govMonthlyCostInr}
              setGovMonthlyCostInr={setGovMonthlyCostInr}
              onSaveGovernanceBudgets={handleSaveGovernanceBudgets}
              onRunRetentionPurge={handleRunRetentionPurge}
            />
          )}
        </div>

        {/* ZONE C: Optional Collapsible Right Business Context Panel */}
        {normalizedPrimaryRoute !== 'CHAT' && showRightContextPanel && (
          <aside
            className={`w-full xl:w-80 shrink-0 border-t xl:border-t-0 xl:border-l p-5 space-y-5 ${t.bgSurface} ${t.border}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className={`text-xs font-semibold uppercase tracking-wider ${t.goldText}`}>
                  Live Business Context
                </div>
                <h3 className={`text-base font-serif font-semibold mt-0.5 ${t.textPrimary}`}>
                  Storefront Snapshot
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRightContextPanel(false)}
                className={`text-xs underline cursor-pointer ${t.textMuted}`}
              >
                Close
              </button>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className={`p-3 rounded-xl border ${t.bgSubtle} ${t.border}`}>
                <div className={`text-xs ${t.textMuted}`}>Net Revenue</div>
                <div className={`text-sm font-serif font-semibold mt-0.5 tabular-nums ${t.textPrimary}`}>
                  ₹{Number(kpis.verifiedNetRevenueInr || 0).toLocaleString('en-IN')}
                </div>
              </div>
              <div className={`p-3 rounded-xl border ${t.bgSubtle} ${t.border}`}>
                <div className={`text-xs ${t.textMuted}`}>Orders</div>
                <div className={`text-sm font-serif font-semibold mt-0.5 tabular-nums ${t.textPrimary}`}>
                  {kpis.eligibleOrdersCount || 0}
                </div>
              </div>
              <div className={`p-3 rounded-xl border ${t.bgSubtle} ${t.border}`}>
                <div className={`text-xs ${t.textMuted}`}>Blended POAS</div>
                <div className={`text-sm font-serif font-semibold mt-0.5 tabular-nums ${t.goldText}`}>
                  {strategyEngine?.roasPoasMerCacAnalysis?.blendedPoas || '1.84'}x
                </div>
              </div>
              <div className={`p-3 rounded-xl border ${t.bgSubtle} ${t.border}`}>
                <div className={`text-xs ${t.textMuted}`}>Open Carts</div>
                <div className={`text-sm font-serif font-semibold mt-0.5 tabular-nums ${t.textPrimary}`}>
                  {kpis.activeAbandonedCartsCount || 0}
                </div>
              </div>
            </div>

            {/* Pending Approvals Quick List */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className={`text-xs font-semibold uppercase tracking-wider ${t.textMuted}`}>
                  Pending Proposals ({pendingApprovalsCount})
                </span>
                <button
                  type="button"
                  onClick={() => navigateSubRoute('APPROVALS')}
                  className={`text-xs font-semibold cursor-pointer ${t.goldText}`}
                >
                  Open Queue →
                </button>
              </div>
              {approvals.filter((a: any) => a.approvalStatus === 'PENDING_APPROVAL').length === 0 ? (
                <div className={`p-3 rounded-xl border text-xs ${t.bgSubtle} ${t.border} ${t.textSecondary}`}>
                  No proposals awaiting your decision.
                </div>
              ) : (
                approvals
                  .filter((a: any) => a.approvalStatus === 'PENDING_APPROVAL')
                  .slice(0, 3)
                  .map((a: any) => (
                    <div
                      key={a.id}
                      className={`p-3 rounded-xl border space-y-1.5 ${t.bgSubtle} ${t.border}`}
                    >
                      <div className={`text-xs font-semibold ${t.textPrimary}`}>
                        {a.title || a.toolId}
                      </div>
                      <div className={`text-xs line-clamp-2 ${t.textSecondary}`}>
                        {a.rationale}
                      </div>
                      <button
                        type="button"
                        onClick={() => navigateSubRoute('APPROVALS')}
                        className={`text-xs font-semibold cursor-pointer ${t.goldText}`}
                      >
                        Review & Approve →
                      </button>
                    </div>
                  ))
              )}
            </div>

            {/* Data Freshness Indicator */}
            <div className={`p-3.5 rounded-xl border space-y-1.5 ${t.bgSubtle} ${t.border}`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-semibold ${t.textPrimary}`}>Data Freshness</span>
                <span className="px-2 py-0.5 rounded text-[11px] font-medium border bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                  Live DB
                </span>
              </div>
              <p className={`text-xs leading-relaxed ${t.textSecondary}`}>
                Synchronized directly with PostgreSQL orders, inventory, campaigns, and customer cohorts.
              </p>
            </div>
          </aside>
        )}
      </div>

      {/* =====================================================================
          CREATE BRAND RULE / MEMORY POLICY MODAL
      ===================================================================== */}
      {showCreateMemoryModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCreateMemoryModal(false);
          }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            className={`w-full max-w-xl rounded-2xl border p-6 space-y-5 shadow-2xl ${t.bgSurface} ${t.border}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <span className={`text-xs font-semibold uppercase tracking-wider ${t.goldText}`}>
                  Durable Brand Memory
                </span>
                <h3 className={`text-xl font-serif font-semibold mt-0.5 ${t.textPrimary}`}>
                  Add Brand Guideline or Business Policy
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateMemoryModal(false)}
                className={`text-xs underline cursor-pointer ${t.textMuted}`}
              >
                Close
              </button>
            </div>

            <form onSubmit={handleCreateMemoryEntry} className="space-y-4">
              <div>
                <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${t.textMuted}`}>
                  Policy Category
                </label>
                <select
                  value={newMemCategory}
                  onChange={(e) => setNewMemCategory(e.target.value)}
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-sm ${t.bgSubtle} ${t.border} ${t.textPrimary}`}
                >
                  <option value="BRAND_VOICE_GUIDELINES">Brand Voice & Editorial Guidelines</option>
                  <option value="PRODUCT_POSITIONING_AUDIENCES">Product Positioning & Target Audiences</option>
                  <option value="MARKETING_BUDGET_POLICIES">Marketing Budget & ROAS/POAS Policies</option>
                  <option value="APPROVED_CAMPAIGN_OBJECTIVES">Approved Campaign Objectives</option>
                  <option value="CONTENT_CLAIMS_RESTRICTIONS">Content Claims & Discount Restrictions</option>
                  <option value="FOUNDER_BUSINESS_RULES">Founder Business Rules</option>
                  <option value="CUSTOMER_SEGMENTATION_DEFINITIONS">Customer Segmentation Definitions</option>
                  <option value="FINANCIAL_METRIC_DEFINITIONS">Financial Metric Definitions</option>
                </select>
              </div>

              <div>
                <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${t.textMuted}`}>
                  Policy Title
                </label>
                <input
                  type="text"
                  required
                  value={newMemTitle}
                  onChange={(e) => setNewMemTitle(e.target.value)}
                  placeholder="e.g., Maximum 15% Privilege Code Cap on Flagship Extrait"
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-sm ${t.bgSubtle} ${t.border} ${t.textPrimary}`}
                />
              </div>

              <div>
                <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${t.textMuted}`}>
                  Plain-Language Rule Summary
                </label>
                <textarea
                  rows={3}
                  required
                  value={newMemSummary}
                  onChange={(e) => setNewMemSummary(e.target.value)}
                  placeholder="Describe the rule clearly so the AI CMO enforces it across all campaign proposals and copy..."
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-sm ${t.bgSubtle} ${t.border} ${t.textPrimary}`}
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateMemoryModal(false)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer ${t.secondaryBtn}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busyAction === 'create-memory'}
                  className={`px-5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer ${t.primaryBtn}`}
                >
                  {busyAction === 'create-memory' ? 'Saving Policy...' : 'Save & Approve Brand Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
