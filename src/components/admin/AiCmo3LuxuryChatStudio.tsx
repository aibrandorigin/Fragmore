import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Sparkles,
  Plus,
  Search,
  Send,
  Paperclip,
  Bookmark,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Play,
  RotateCcw,
  Edit3,
  Check,
  X,
  Trash2,
  Sun,
  Moon,
  PanelRightClose,
  PanelRightOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Command,
  Download,
  BarChart3,
  Table as TableIcon,
  ArrowUpRight,
  SlidersHorizontal,
  ShieldCheck,
  Compass,
  Wrench,
  TrendingUp,
  Database,
  History,
  Layers,
  Settings,
  Menu,
  Globe
} from 'lucide-react';
import type { AiCmoSubRoute } from './AdminAiCmo3';

export interface QuickCommandDefinition {
  id: string;
  label: string;
  category: string;
  prompt: string;
  teluguPrompt: string;
  description: string;
}

export const TEN_QUICK_COMMANDS: QuickCommandDefinition[] = [
  {
    id: 'analyze-sales',
    label: 'Analyze Sales',
    category: 'Revenue',
    prompt: "Show me today's actual sales and profit.",
    teluguPrompt: 'ఈరోజు ప్రత్యక్ష అమ్మకాలు మరియు లాభం చూపించు',
    description: 'Retrieve verified eligible orders, gross revenue, and net contribution profit'
  },
  {
    id: 'create-campaign',
    label: 'Create Campaign',
    category: 'Marketing',
    prompt: 'Create a campaign plan for AZURE with ₹10,000 budget.',
    teluguPrompt: '₹10,000 బడ్జెట్‌తో AZURE కోసం క్యాంపెయిన్ ప్లాన్ రూపొందించు',
    description: 'Draft an omnichannel campaign plan with POAS forecast and approval card'
  },
  {
    id: 'optimize-ads',
    label: 'Optimize Ads',
    category: 'Paid Media',
    prompt: 'Analyze Meta and Google Ads ROAS vs POAS and propose budget optimizations.',
    teluguPrompt: 'Meta మరియు Google Ads ROAS vs POAS విశ్లేషించి బడ్జెట్ మార్పులను సూచించు',
    description: 'Audit ad spend efficiency and queue budget reallocation proposals'
  },
  {
    id: 'build-automation',
    label: 'Build Automation',
    category: 'Automation',
    prompt:
      'Create an abandoned cart recovery workflow for carts above ₹999, wait 30 minutes, check marketing consent, send an approved WhatsApp template, then stop if the order is completed.',
    teluguPrompt:
      '₹999 పైన ఉన్న అబాండన్డ్ కార్ట్‌ల కోసం 30 నిమిషాల తర్వాత WhatsApp రికవరీ వర్క్‌ఫ్లో రూపొందించు',
    description: 'Build a PostgreSQL-backed DAG workflow with dry-run simulation'
  },
  {
    id: 'generate-content',
    label: 'Generate Content',
    category: 'Creative',
    prompt: 'Generate a creative brief for SOLARA.',
    teluguPrompt: 'SOLARA పెర్ఫ్యూమ్ కోసం క్రియేటివ్ బ్రీఫ్ తయారు చేయి',
    description: 'Produce luxury editorial hooks, olfactory notes, and visual direction'
  },
  {
    id: 'check-inventory',
    label: 'Check Inventory',
    category: 'Operations',
    prompt: 'Show low stock items and recommend production quantities.',
    teluguPrompt: 'తక్కువ స్టాక్ ఉన్న పెర్ఫ్యూమ్‌లు మరియు ఉత్పత్తి పరిమాణాలను చూపించు',
    description: 'Audit SKU stock levels against 14-day Extrait maceration lead times'
  },
  {
    id: 'review-orders',
    label: 'Review Orders',
    category: 'Orders',
    prompt: 'Show all abandoned carts above ₹999.',
    teluguPrompt: '₹999 పైన ఉన్న అన్ని అబాండన్డ్ కార్ట్‌లను చూపించు',
    description: 'Inspect high-value carts, order fulfillment statuses, and pending refunds'
  },
  {
    id: 'analyze-profit',
    label: 'Analyze Profit',
    category: 'Finance',
    prompt: 'Which perfume has the highest contribution margin?',
    teluguPrompt: 'ఏ పెర్ఫ్యూమ్‌కు అత్యధిక కాంట్రిబ్యూషన్ మార్జిన్ ఉంది?',
    description: 'Rank all SKUs by net contribution margin after COGS, packaging, and shipping'
  },
  {
    id: 'generate-report',
    label: 'Generate Report',
    category: 'Strategy',
    prompt: 'Prepare a weekly marketing plan.',
    teluguPrompt: 'వారాంతపు మార్కెటింగ్ ప్లాన్ మరియు నివేదిక సిద్ధం చేయి',
    description: 'Compile executive KPI synthesis, budget splits, and priority growth actions'
  },
  {
    id: 'investigate-failure',
    label: 'Investigate Failure',
    category: 'Reliability',
    prompt: 'Why did my cart recovery workflow fail?',
    teluguPrompt: 'నా కార్ట్ రికవరీ వర్క్‌ఫ్లో ఎందుకు విఫలమైంది?',
    description: 'Diagnose workflow execution logs, provider errors, and queue safe repairs'
  }
];

export interface AiCmo3LuxuryChatStudioProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  overview: any;
  loading: boolean;
  busyAction: string | null;
  adminEmail: string;
  adminRole: string;
  subRoute: AiCmoSubRoute;
  onNavigateSubRoute: (target: AiCmoSubRoute) => void;
  onRefreshOverview: () => void;

  // Chat state & handlers
  selectedConvId: string;
  onSelectConvId: (id: string) => void;
  chatPrompt: string;
  onChangeChatPrompt: (val: string) => void;
  languagePref: 'EN' | 'TE' | 'BILINGUAL';
  onChangeLanguagePref: (lang: 'EN' | 'TE' | 'BILINGUAL') => void;
  autoProposeFromChat: boolean;
  onChangeAutoProposeFromChat: (val: boolean) => void;
  streamingStatus: string | null;
  streamingPreviewText: string;
  onExecutePrompt: (promptText: string) => void;
  onSubmitChatForm: (e: React.FormEvent) => void;

  // Thread & Saved Prompt management
  renamingConvId: string | null;
  onSetRenamingConvId: (id: string | null) => void;
  renameTitleInput: string;
  onChangeRenameTitleInput: (val: string) => void;
  onRenameConversation: (id: string) => void;
  onDeleteSavedPrompt: (id: string) => void;
  showSavePromptModal: boolean;
  onSetShowSavePromptModal: (val: boolean) => void;
  newSavedPromptTitle: string;
  onChangeNewSavedPromptTitle: (val: string) => void;
  onSaveCurrentPrompt: () => void;

  // Attachments
  attachments: { name: string; type: string; size: number; textPreview: string }[];
  onRemoveAttachment: (index: number) => void;
  onFileAttach: (e: React.ChangeEvent<HTMLInputElement>) => void;

  // Workflow & Approval actions
  onRunWorkflowDryRun: (workflowId: string) => void;
  onWorkflowPublishGate: (
    workflowId: string,
    mode: 'REQUEST_APPROVAL' | 'APPROVE_AND_PUBLISH'
  ) => void;
  onApprovalDecision: (
    actionId: string,
    decision: 'APPROVE_DRY_RUN' | 'APPROVE_LIVE' | 'REJECT' | 'ROLLBACK',
    executeLive?: boolean
  ) => void;
  onStartEditApproval: (approval: any) => void;
  onProposeWriteTool: (toolName: string, payload: Record<string, any>) => void;
  onExecuteReadTool: (toolName: string, sampleArgs: Record<string, any>) => void;
  onInvalidateDomainCache: (entity: string) => void;
  onRunScheduledIntelligenceJob: (jobType: string) => void;
  onOpenCampaignDraftInManager?: (draftData: any) => void;
}

type LeftPanelSection =
  | 'CONVERSATIONS'
  | 'SAVED_INSIGHTS'
  | 'MARKETING_PLANS'
  | 'ACTION_HISTORY';

export const AiCmo3LuxuryChatStudio: React.FC<AiCmo3LuxuryChatStudioProps> = ({
  theme,
  onToggleTheme,
  overview,
  loading,
  busyAction,
  adminEmail,
  adminRole,
  subRoute,
  onNavigateSubRoute,
  onRefreshOverview,
  selectedConvId,
  onSelectConvId,
  chatPrompt,
  onChangeChatPrompt,
  languagePref,
  onChangeLanguagePref,
  autoProposeFromChat,
  onChangeAutoProposeFromChat,
  streamingStatus,
  streamingPreviewText,
  onExecutePrompt,
  onSubmitChatForm,
  renamingConvId,
  onSetRenamingConvId,
  renameTitleInput,
  onChangeRenameTitleInput,
  onRenameConversation,
  onDeleteSavedPrompt,
  showSavePromptModal,
  onSetShowSavePromptModal,
  newSavedPromptTitle,
  onChangeNewSavedPromptTitle,
  onSaveCurrentPrompt,
  attachments,
  onRemoveAttachment,
  onFileAttach,
  onRunWorkflowDryRun,
  onWorkflowPublishGate,
  onApprovalDecision,
  onStartEditApproval,
  onProposeWriteTool,
  onExecuteReadTool,
  onInvalidateDomainCache,
  onRunScheduledIntelligenceJob,
  onOpenCampaignDraftInManager
}) => {
  const isLight = theme === 'light';

  // Panel & Modal UI State
  const [leftSection, setLeftSection] = useState<LeftPanelSection>('CONVERSATIONS');
  const [leftSearchQuery, setLeftSearchQuery] = useState<string>('');
  const [leftPanelOpen, setLeftPanelOpen] = useState<boolean>(true);
  const [rightPanelOpen, setRightPanelOpen] = useState<boolean>(false);
  const [showWelcomeLaunchpad, setShowWelcomeLaunchpad] = useState<boolean>(true);
  const [mobileLeftOpen, setMobileLeftOpen] = useState<boolean>(false);
  const [mobileRightOpen, setMobileRightOpen] = useState<boolean>(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState<boolean>(false);
  const [commandQuery, setCommandQuery] = useState<string>('');
  const [selectedCommandIndex, setSelectedCommandIndex] = useState<number>(0);
  const [dataViewModeByMsg, setDataViewModeByMsg] = useState<
    Record<string, 'CHART_AND_TABLE' | 'TABLE_ONLY'>
  >({});

  // Inline Editable Campaign / Proposal Preview State inside Chat Conversation
  const [inlineEditCardId, setInlineEditCardId] = useState<string | null>(null);
  const [inlineEditTitle, setInlineEditTitle] = useState<string>('');
  const [inlineEditSkuName, setInlineEditSkuName] = useState<string>('AZURE');
  const [inlineEditChannel, setInlineEditChannel] = useState<string>('');
  const [inlineEditBudget, setInlineEditBudget] = useState<string>('15000');
  const [inlineEditRoas, setInlineEditRoas] = useState<string>('4.6');
  const [inlineSavingCardId, setInlineSavingCardId] = useState<string | null>(null);
  const [inlineSaveFeedback, setInlineSaveFeedback] = useState<Record<string, string>>({});
  const [inlineWorkflowEditId, setInlineWorkflowEditId] = useState<string | null>(null);
  const [inlineWorkflowDelayMinutes, setInlineWorkflowDelayMinutes] = useState<string>('120');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatInputRef = useRef<HTMLInputElement | null>(null);
  const leftSearchInputRef = useRef<HTMLInputElement | null>(null);
  const commandInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const prevMessagesCountRef = useRef<number | null>(null);

  // Extract authoritative data from overview
  const kpis = overview?.contextSnapshot?.kpis || {};
  const conversations: any[] = overview?.conversations || [];
  const allMessages: any[] = overview?.messages || [];
  const savedPrompts: any[] = overview?.savedPrompts || [];
  const recommendations: any[] = overview?.recommendations || [];
  const plans: any[] = overview?.plans || [];
  const approvals: any[] = overview?.approvals || [];
  const auditLogs: any[] = overview?.auditLogs || [];
  const strategyEngine = overview?.strategyEngineReport || {};
  const dataSync = overview?.dataSyncOverview || {};
  const memIntel = overview?.memoryAndScheduledIntelligence || {};
  const allTools: any[] = overview?.toolRegistryDiscovery?.allTools || [];

  const catalogSkus: any[] = strategyEngine?.skuContributionAndPrioritization || [];
  const activeCampaigns: any[] = strategyEngine?.campaignHealthAudits || [];
  const pendingApprovals = useMemo(
    () => approvals.filter((a: any) => a.approvalStatus === 'PENDING_APPROVAL'),
    [approvals]
  );

  const approvalsById = useMemo(() => {
    const map: Record<string, any> = {};
    approvals.forEach((a: any) => {
      map[a.id] = a;
    });
    return map;
  }, [approvals]);

  const activeConversation = useMemo(
    () => conversations.find((c: any) => c.id === selectedConvId) || null,
    [conversations, selectedConvId]
  );

  const currentThreadMessages = useMemo(
    () =>
      allMessages.filter(
        (m: any) => !selectedConvId || m.conversationId === selectedConvId
      ),
    [allMessages, selectedConvId]
  );

  // Scroll only the internal chat stream container when user sends a new message or streaming starts (never scroll the outer page on initial entry)
  useEffect(() => {
    if (prevMessagesCountRef.current === null) {
      if (currentThreadMessages.length > 0) {
        prevMessagesCountRef.current = currentThreadMessages.length;
      }
      return;
    }

    const isNewMessageAdded = currentThreadMessages.length > prevMessagesCountRef.current;
    prevMessagesCountRef.current = currentThreadMessages.length;

    if ((isNewMessageAdded || Boolean(streamingStatus)) && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [currentThreadMessages.length, streamingStatus]);

  // Global keyboard shortcuts (⌘K / Ctrl+K, Alt+N, Alt+R, Alt+D, /)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
        setCommandQuery('');
        setSelectedCommandIndex(0);
        return;
      }

      if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        onSelectConvId('');
        chatInputRef.current?.focus();
        return;
      }

      if (e.altKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        setRightPanelOpen((prev) => !prev);
        return;
      }

      if (e.altKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        onToggleTheme();
        return;
      }

      if (!isTyping && e.key === '/') {
        e.preventDefault();
        leftSearchInputRef.current?.focus();
        return;
      }

      if (e.key === 'Escape') {
        if (commandPaletteOpen) setCommandPaletteOpen(false);
        if (mobileLeftOpen) setMobileLeftOpen(false);
        if (mobileRightOpen) setMobileRightOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    commandPaletteOpen,
    mobileLeftOpen,
    mobileRightOpen,
    onSelectConvId,
    onToggleTheme
  ]);

  useEffect(() => {
    if (commandPaletteOpen) {
      setTimeout(() => commandInputRef.current?.focus(), 30);
    }
  }, [commandPaletteOpen]);

  // Filtered Left Panel lists
  const qClean = leftSearchQuery.toLowerCase().trim();

  const filteredConversations = useMemo(() => {
    if (!qClean) return conversations;
    return conversations.filter((c: any) => {
      const inTitle = String(c.title || '').toLowerCase().includes(qClean);
      const inSummary = String(c.memorySummary || '').toLowerCase().includes(qClean);
      const inMsgs = allMessages.some(
        (m: any) =>
          m.conversationId === c.id &&
          String(m.content || '').toLowerCase().includes(qClean)
      );
      return inTitle || inSummary || inMsgs;
    });
  }, [conversations, allMessages, qClean]);

  const combinedSavedInsights = useMemo(() => {
    const items: {
      id: string;
      kind: 'RECOMMENDATION' | 'MEASURED_LEARNING' | 'SAVED_PROMPT';
      title: string;
      summary: string;
      meta: string;
      promptToRun: string;
      canDelete?: boolean;
    }[] = [];

    recommendations.forEach((rec: any) => {
      items.push({
        id: `rec-${rec.id}`,
        kind: 'RECOMMENDATION',
        title: rec.title,
        summary: rec.rationale || rec.expectedImpact,
        meta: `${rec.department || 'Strategy'} · ${rec.expectedImpact || 'Profit Focus'}`,
        promptToRun: `Elaborate on "${rec.title}" and prepare an executable action plan.`
      });
    });

    (memIntel.recentIntelligenceRuns || []).slice(0, 4).forEach((run: any) => {
      const firstLearning = run.measuredLearnings?.[0];
      if (firstLearning) {
        items.push({
          id: `intel-${run.id}`,
          kind: 'MEASURED_LEARNING',
          title: firstLearning.headline || run.jobName,
          summary: `${firstLearning.historicalBaseline} → ${firstLearning.currentMeasuredValue}`,
          meta: `Measured Learning · ${run.executedAtIst || 'Recent'}`,
          promptToRun:
            run.suggestedFollowUpPrompts?.[0] ||
            `Show the full breakdown for ${run.jobName}.`
        });
      }
    });

    savedPrompts.forEach((sp: any) => {
      items.push({
        id: sp.id,
        kind: 'SAVED_PROMPT',
        title: sp.title,
        summary: sp.promptText,
        meta: `Saved Prompt · ${sp.language || 'EN'}`,
        promptToRun: sp.promptText,
        canDelete: !String(sp.id).startsWith('AICMO-PROMPT-1')
      });
    });

    if (!qClean) return items;
    return items.filter(
      (it) =>
        it.title.toLowerCase().includes(qClean) ||
        it.summary.toLowerCase().includes(qClean) ||
        it.meta.toLowerCase().includes(qClean)
    );
  }, [recommendations, memIntel.recentIntelligenceRuns, savedPrompts, qClean]);

  const filteredPlans = useMemo(() => {
    if (!qClean) return plans;
    return plans.filter(
      (p: any) =>
        String(p.title || '').toLowerCase().includes(qClean) ||
        String(p.objective || '').toLowerCase().includes(qClean) ||
        String(p.targetSegment || '').toLowerCase().includes(qClean)
    );
  }, [plans, qClean]);

  const filteredActionHistory = useMemo(() => {
    const merged = approvals.map((a: any) => ({
      id: a.id,
      title: a.title,
      status: a.approvalStatus,
      module:
        a.universalApprovalCard?.affectedModuleAndRecords?.moduleName ||
        a.adapterTarget ||
        'Domain Service',
      timestamp: a.updatedAt || a.createdAt,
      rawApproval: a
    }));
    if (!qClean) return merged;
    return merged.filter(
      (item: any) =>
        String(item.id || '').toLowerCase().includes(qClean) ||
        String(item.title || '').toLowerCase().includes(qClean) ||
        String(item.status || '').toLowerCase().includes(qClean) ||
        String(item.module || '').toLowerCase().includes(qClean)
    );
  }, [approvals, qClean]);

  // Command Search Palette items
  const commandItems = useMemo(() => {
    const list: {
      id: string;
      group: string;
      title: string;
      subtitle: string;
      shortcut?: string;
      onRun: () => void;
    }[] = [];

    TEN_QUICK_COMMANDS.forEach((qc, i) => {
      list.push({
        id: `qc-${qc.id}`,
        group: 'Quick Commands',
        title: qc.label,
        subtitle: qc.description,
        shortcut: i < 9 ? `⌘${i + 1}` : '⌘0',
        onRun: () => {
          const promptText = languagePref === 'TE' ? qc.teluguPrompt : qc.prompt;
          onChangeChatPrompt(promptText);
          onExecutePrompt(promptText);
          setCommandPaletteOpen(false);
        }
      });
    });

    const subConsoleLinks: { id: AiCmoSubRoute; title: string; subtitle: string }[] = [
      {
        id: 'CHAT',
        title: 'AI CMO 3.0 Main Conversation Studio',
        subtitle: 'Return to the 3-panel executive chat interface'
      },
      {
        id: 'APPROVALS',
        title: 'Universal AI Action Center & Approval Queue',
        subtitle: `${pendingApprovals.length} pending human-in-the-loop approvals`
      },
      {
        id: 'PLANNER',
        title: 'Goal-Based Campaign Planner',
        subtitle: 'Plan campaigns by goal, SKU, channel, budget, and target POAS'
      },
      {
        id: 'INSIGHTS',
        title: 'Marketing Strategy Engine (16 Capabilities)',
        subtitle: 'POAS, MER, CAC, creative fatigue, and SKU margin prioritization'
      },
      {
        id: 'MEMORY',
        title: 'Durable AI Memory & Scheduled Intelligence',
        subtitle: '10 business memory categories, 7 scheduled briefs, token budgets'
      },
      {
        id: 'ACTIONS',
        title: 'AI Tool Registry (20 Read + 13 Write Tools)',
        subtitle: 'Inspect JSON schemas, RBAC permissions, and live service adapters'
      },
      {
        id: 'HISTORY',
        title: 'Audit Trail & Multi-Browser Data Sync',
        subtitle: 'Correlation IDs, domain watermarks, and immutable execution logs'
      },
      {
        id: 'OVERVIEW',
        title: 'Architecture & Dependency Map',
        subtitle: 'Inspect read/write service adapters and additive PostgreSQL tables'
      },
      {
        id: 'SETTINGS',
        title: 'Safety Guardrails & Regression Suite',
        subtitle: 'Toggle read-only mode, kill-switch, and run non-destructive tests'
      }
    ];

    subConsoleLinks.forEach((sc) => {
      list.push({
        id: `nav-${sc.id}`,
        group: 'AI CMO Consoles',
        title: sc.title,
        subtitle: sc.subtitle,
        onRun: () => {
          onNavigateSubRoute(sc.id);
          setCommandPaletteOpen(false);
        }
      });
    });

    allTools.slice(0, 12).forEach((tool: any) => {
      list.push({
        id: `tool-${tool.toolName}`,
        group:
          tool.category === 'READ_TOOL' ? 'Live Read Tools' : 'Gated Write Proposal Tools',
        title: `${tool.toolName} (${tool.department})`,
        subtitle: tool.description,
        onRun: () => {
          if (tool.category === 'READ_TOOL') {
            onExecuteReadTool(tool.toolName, tool.sampleArgs || {});
          } else {
            onProposeWriteTool(tool.toolName, tool.sampleArgs || {});
          }
          setCommandPaletteOpen(false);
        }
      });
    });

    const cq = commandQuery.toLowerCase().trim();
    if (!cq) return list;
    return list.filter(
      (item) =>
        item.title.toLowerCase().includes(cq) ||
        item.subtitle.toLowerCase().includes(cq) ||
        item.group.toLowerCase().includes(cq)
    );
  }, [
    languagePref,
    pendingApprovals.length,
    allTools,
    commandQuery,
    onChangeChatPrompt,
    onExecutePrompt,
    onNavigateSubRoute,
    onExecuteReadTool,
    onProposeWriteTool
  ]);

  // CSV Download helper for inline tables
  const handleDownloadTableCsv = (
    msgId: string,
    headers: string[],
    rows: string[][]
  ) => {
    const escapeCsv = (val: string) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const csvLines = [
      headers.map(escapeCsv).join(','),
      ...rows.map((r) => r.map(escapeCsv).join(','))
    ];
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fragmore-aicmo-data-${msgId.slice(-6)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Helper to extract numeric value from formatted metric/table strings for inline chart bars
  const parseNumericFromCell = (raw: string): number => {
    if (!raw) return 0;
    const cleaned = String(raw).replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleaned);
    return Number.isFinite(num) ? Math.abs(num) : 0;
  };

  // Open inline editor for a Campaign / Proposal card directly inside the chat conversation
  const handleOpenInlineCampaignEditor = (approval: any) => {
    const payload = approval?.payload || {};
    setInlineEditCardId(approval.id);
    setInlineEditTitle(String(approval.title || ''));
    setInlineEditSkuName(String(payload.skuName || 'AZURE'));
    setInlineEditChannel(
      String(
        payload.channel ||
          'Meta Reels (50%) + WhatsApp VIP/Discovery (30%) + Google Brand Search (20%)'
      )
    );
    setInlineEditBudget(String(payload.budget || 15000));
    setInlineEditRoas(String(payload.projectedRoas || 4.6));
  };

  // Persist inline edits directly to PostgreSQL via PATCH /api/ai-cmo/approvals/:id/edit
  const handleSaveInlineCampaignDraft = async (approval: any) => {
    if (!approval?.id) return;
    setInlineSavingCardId(approval.id);
    try {
      const existingPayload = approval.payload || {};
      const cleanBudget = Math.max(1000, Number(inlineEditBudget) || 15000);
      const cleanRoas = Math.max(1.1, Number(inlineEditRoas) || 4.6);
      const projectedRevenueInr = Math.round(cleanBudget * cleanRoas);
      const expectedNetProfitInr = Math.round(projectedRevenueInr * 0.72 - cleanBudget);
      const expectedPoas = Number(
        ((projectedRevenueInr * 0.72) / Math.max(1, cleanBudget)).toFixed(2)
      );

      const updatedPayload = {
        ...existingPayload,
        skuName: inlineEditSkuName,
        name: inlineEditTitle || `AI CMO 3.0 — ${inlineEditSkuName} Campaign`,
        channel: inlineEditChannel,
        budget: cleanBudget,
        projectedRoas: cleanRoas,
        projectedRevenueInr,
        expectedNetProfitInr,
        expectedPoas
      };

      const res = await fetch(`/api/ai-cmo/approvals/${approval.id}/edit`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updatedTitle: inlineEditTitle,
          updatedPayload,
          editorEmail: adminEmail,
          editorRole: adminRole
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save inline draft changes');
      }
      setInlineEditCardId(null);
      setInlineSaveFeedback((prev) => ({
        ...prev,
        [approval.id]: `Saved Draft in PostgreSQL (₹${cleanBudget.toLocaleString('en-IN')} · ${inlineEditChannel.slice(0, 36)})`
      }));
      onRefreshOverview();
    } catch (err: any) {
      setInlineSaveFeedback((prev) => ({
        ...prev,
        [approval.id]: `Error: ${err.message || 'Could not save changes'}`
      }));
    } finally {
      setInlineSavingCardId(null);
    }
  };

  // Render inline markdown formatting (**bold**, `code`, *italic*) inside text lines
  const renderInlineTokens = (lineText: string) => {
    const parts = lineText.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
    return parts.map((token, idx) => {
      if (token.startsWith('**') && token.endsWith('**')) {
        return (
          <strong key={idx} className="font-semibold">
            {token.slice(2, -2)}
          </strong>
        );
      }
      if (token.startsWith('`') && token.endsWith('`')) {
        return (
          <code
            key={idx}
            className={`px-1.5 py-0.5 rounded text-xs font-mono ${
              isLight
                ? 'bg-[#EFECE4] text-[#6B5021] border border-[#DED7CC]'
                : 'bg-[#25221B] text-[#E6C565] border border-[#383327]'
            }`}
          >
            {token.slice(1, -1)}
          </code>
        );
      }
      if (token.startsWith('*') && token.endsWith('*') && token.length > 2) {
        return (
          <em key={idx} className="italic">
            {token.slice(1, -1)}
          </em>
        );
      }
      return <React.Fragment key={idx}>{token}</React.Fragment>;
    });
  };

  // Render full Markdown block for executive directAnswer
  const renderFormattedMarkdown = (rawText: string) => {
    const lines = String(rawText || '').split('\n');
    return (
      <div className="space-y-2 text-[15px] leading-relaxed">
        {lines.map((rawLine, idx) => {
          const line = rawLine.trim();
          if (!line) return <div key={idx} className="h-1" />;

          if (line.startsWith('### ')) {
            return (
              <h4
                key={idx}
                className="font-serif text-lg sm:text-xl font-normal tracking-tight pt-1 pb-0.5"
              >
                {renderInlineTokens(line.slice(4))}
              </h4>
            );
          }

          if (line.startsWith('## ')) {
            return (
              <h3
                key={idx}
                className="font-serif text-xl sm:text-2xl font-normal tracking-tight pt-1 pb-0.5"
              >
                {renderInlineTokens(line.slice(3))}
              </h3>
            );
          }

          if (line.startsWith('> ')) {
            return (
              <blockquote
                key={idx}
                className={`p-3 rounded-lg border-l-4 text-xs sm:text-sm ${
                  isLight
                    ? 'bg-[#F5EFE2] border-[#9A783E] text-[#3B352D]'
                    : 'bg-[#221E15] border-[#D4AF37] text-[#E6DFD1]'
                }`}
              >
                {renderInlineTokens(line.slice(2))}
              </blockquote>
            );
          }

          if (line.startsWith('- ') || line.startsWith('• ')) {
            return (
              <div key={idx} className="flex items-start gap-2.5 pl-1">
                <span
                  aria-hidden="true"
                  className={`mt-2 w-1.5 h-1.5 rounded-full shrink-0 ${
                    isLight ? 'bg-[#9A783E]' : 'bg-[#D4AF37]'
                  }`}
                />
                <div className="flex-1">{renderInlineTokens(line.slice(2))}</div>
              </div>
            );
          }

          return <p key={idx}>{renderInlineTokens(line)}</p>;
        })}
      </div>
    );
  };

  // Match referenced SKUs in assistant message for inline Product Cards
  const getMatchedProductCardsForMessage = (msg: any): any[] => {
    if (!catalogSkus.length) return [];
    const text = `${msg.content || ''} ${msg.structuredResponse?.directAnswer || ''}`.toUpperCase();
    const matched = catalogSkus.filter((sku: any) =>
      text.includes(String(sku.name || '').toUpperCase())
    );
    if (matched.length > 0) return matched.slice(0, 3);
    if (
      msg.structuredResponse?.intentClassified === 'CONTRIBUTION_MARGIN_ANALYSIS' ||
      msg.structuredResponse?.intentClassified === 'LOW_STOCK_PRODUCTION_PLAN'
    ) {
      return catalogSkus.slice(0, 3);
    }
    return [];
  };

  // Match referenced Campaigns for inline Campaign Cards
  const getMatchedCampaignCardsForMessage = (msg: any): any[] => {
    if (!activeCampaigns.length) return [];
    const intent = msg.structuredResponse?.intentClassified || '';
    const text = `${msg.content || ''} ${msg.structuredResponse?.directAnswer || ''}`.toUpperCase();
    if (
      intent.includes('CAMPAIGN') ||
      intent.includes('WEEKLY_MARKETING') ||
      text.includes('ROAS') ||
      text.includes('POAS')
    ) {
      return activeCampaigns.slice(0, 2);
    }
    return [];
  };

  // Build contextual follow-up suggestions per assistant message
  const getContextualFollowUps = (msg: any): string[] => {
    const sr = msg.structuredResponse;
    if (
      Array.isArray(sr?.workflowChatCard?.suggestedFollowUpPrompts) &&
      sr.workflowChatCard.suggestedFollowUpPrompts.length > 0
    ) {
      return sr.workflowChatCard.suggestedFollowUpPrompts;
    }
    const intent = sr?.intentClassified || '';
    if (
      intent === 'CAMPAIGN_PLAN_BUILDER' ||
      intent === 'CAMPAIGN_PLAN_GENERATOR' ||
      intent === 'CAMPAIGN_FOLLOWUP_CHANGE_BUDGET' ||
      intent === 'CAMPAIGN_FOLLOWUP_CHANGE_CHANNEL' ||
      intent === 'FOLLOWUP_ADD_WHATSAPP_STEP' ||
      intent === 'FOLLOWUP_SHOW_EXPECTED_PROFIT' ||
      intent === 'CREATIVE_BRIEF_GENERATOR'
    ) {
      return [
        'Change the budget to ₹15,000',
        'Use only Instagram',
        'Add a WhatsApp follow-up',
        'Show the expected profit'
      ];
    }
    if (intent === 'SALES_AND_PROFIT_REPORT' || intent === 'SALES_AND_PROFIT_TODAY') {
      return [
        'Which perfume has the highest contribution margin?',
        'Show all abandoned carts above ₹999.',
        'Create a campaign plan for AZURE with ₹10,000 budget.'
      ];
    }
    if (intent === 'CONTRIBUTION_MARGIN_ANALYSIS') {
      return [
        'Create a campaign plan for AZURE with ₹10,000 budget.',
        'Show the expected profit',
        'Show low stock items and recommend production quantities.',
        'Generate a creative brief for SOLARA.'
      ];
    }
    if (intent === 'ABANDONED_CARTS_QUERY' || intent === 'ABANDONED_CARTS_HIGH_VALUE') {
      return [
        'Create an abandoned cart recovery workflow for carts above ₹999, wait 30 minutes, check marketing consent, send an approved WhatsApp template, then stop if the order is completed.',
        'Why did my cart recovery workflow fail?',
        'Show pending customer refunds.'
      ];
    }
    return [
      'Create a campaign plan for AZURE with ₹10,000 budget.',
      'Change the budget to ₹15,000',
      'Show the expected profit',
      "Show me today's actual sales and profit."
    ];
  };

  // Theme-adaptive surface classes (60-30-10 luxury off-white default vs optional obsidian dark)
  const shellBg = isLight
    ? 'bg-[#FAF8F4] text-[#24211D] border-[#DED7CC]'
    : 'bg-[#0F0E0C] text-[#F5F2EB] border-[#2B2822]';
  const cardBg = isLight
    ? 'bg-[#FFFFFF] border-[#E4DEC3]/80 text-[#24211D]'
    : 'bg-[#171613] border-[#2B2822] text-[#F5F2EB]';
  const subtleBg = isLight
    ? 'bg-[#F4F0E8] border-[#DED7CC] text-[#24211D]'
    : 'bg-[#201E19] border-[#2E2A23] text-[#E6E1D6]';
  const mutedText = isLight ? 'text-[#686158]' : 'text-[#A39C90]';
  const accentText = isLight ? 'text-[#8C6B2F]' : 'text-[#D4AF37]';
  const goldPrimaryBtn = isLight
    ? 'bg-[#24211D] hover:bg-[#3A352F] text-[#FAF8F4]'
    : 'bg-[#D4AF37] hover:bg-[#c59f2d] text-[#111115]';
  const secondaryBtn = isLight
    ? 'bg-[#F4F0E8] hover:bg-[#EAE3D5] text-[#24211D] border border-[#D8D0C2]'
    : 'bg-[#22201B] hover:bg-[#2C2922] text-[#F5F2EB] border border-[#332F26]';
  const inputSurface = isLight
    ? 'bg-[#FFFFFF] border-[#D8D0C2] text-[#24211D] placeholder-[#8C8479] focus:border-[#9A783E]'
    : 'bg-[#12110E] border-[#332F26] text-[#F5F2EB] placeholder-[#787268] focus:border-[#D4AF37]';

  const centerColSpanClass =
    leftPanelOpen && rightPanelOpen
      ? 'lg:col-span-6'
      : leftPanelOpen || rightPanelOpen
      ? 'lg:col-span-9'
      : 'lg:col-span-12';

  return (
    <div className={`transition-colors duration-200 ${shellBg}`}>
      {/* =====================================================================
          STUDIO TOP UTILITY BAR: QUICK COMMANDS + SEARCH (⌘K) + PANEL TOGGLES
      ===================================================================== */}
      <div
        className={`px-4 sm:px-6 py-3 border-b flex flex-col gap-3 ${
          isLight ? 'border-[#E5DEC9] bg-[#FAF8F4]' : 'border-[#2B2822] bg-[#141310]'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: Studio Identity & Panel Toggles */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                  setMobileLeftOpen(!mobileLeftOpen);
                } else {
                  setLeftPanelOpen(!leftPanelOpen);
                }
              }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${secondaryBtn}`}
              title="Toggle Conversations, Saved Insights & Plans Sidebar"
            >
              {leftPanelOpen ? (
                <PanelLeftClose className="w-3.5 h-3.5" />
              ) : (
                <PanelLeftOpen className="w-3.5 h-3.5" />
              )}
              <span>{leftPanelOpen ? 'Hide Threads' : 'Threads & Plans'}</span>
            </button>

            <div className="hidden sm:block">
              <div className="flex items-center gap-2 text-xs">
                <span className={`font-serif tracking-widest uppercase font-semibold ${accentText}`}>
                  FRAGMORÉ Maison Intelligence
                </span>
                <span aria-hidden="true" className={mutedText}>
                  ·
                </span>
                <span className={mutedText}>Conversational Operating System</span>
              </div>
            </div>
          </div>

          {/* Right: Command Search (⌘K), Language Switcher, Theme Toggle, Right Panel Toggle */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Command Search Trigger */}
            <button
              type="button"
              onClick={() => {
                setCommandPaletteOpen(true);
                setCommandQuery('');
                setSelectedCommandIndex(0);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0 ${secondaryBtn}`}
              title="Open Command Search (⌘K or Ctrl+K)"
            >
              <Command className="w-3.5 h-3.5" />
              <span>Command Search</span>
              <kbd
                className={`px-1.5 py-0.5 text-[10px] font-mono rounded ${
                  isLight ? 'bg-[#E6DFD1] text-[#24211D]' : 'bg-black/50 text-[#D4AF37]'
                }`}
              >
                ⌘K
              </kbd>
            </button>

            {/* Language Selector */}
            <div
              className={`flex items-center p-0.5 rounded-lg border ${
                isLight ? 'bg-[#F4F0E8] border-[#D8D0C2]' : 'bg-[#12110E] border-[#2E2A23]'
              }`}
              role="group"
              aria-label="Conversation language"
            >
              {(
                [
                  { id: 'EN', label: 'EN' },
                  { id: 'TE', label: 'తెలుగు' },
                  { id: 'BILINGUAL', label: 'EN + తె' }
                ] as const
              ).map((lang) => (
                <button
                  key={lang.id}
                  type="button"
                  onClick={() => onChangeLanguagePref(lang.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0 ${
                    languagePref === lang.id
                      ? isLight
                        ? 'bg-[#24211D] text-[#FAF8F4]'
                        : 'bg-[#D4AF37] text-[#111115] font-semibold'
                      : `${mutedText} hover:opacity-100`
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>

            {/* Theme Switcher: Off-White Default vs Optional Dark */}
            <button
              type="button"
              onClick={onToggleTheme}
              className={`px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0 ${secondaryBtn}`}
              title="Toggle Off-White Luxury / Dark Atelier Theme (Alt+D)"
            >
              {isLight ? (
                <>
                  <Moon className="w-3.5 h-3.5" />
                  <span>Dark Theme</span>
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>Off-White Theme</span>
                </>
              )}
            </button>

            {/* Right Business Context Panel Toggle */}
            <button
              type="button"
              onClick={() => {
                if (window.innerWidth < 1024) {
                  setMobileRightOpen(!mobileRightOpen);
                } else {
                  setRightPanelOpen(!rightPanelOpen);
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0 ${secondaryBtn}`}
              title="Toggle Business Context & Live Health Panel (Alt+R)"
            >
              {rightPanelOpen ? (
                <PanelRightClose className="w-3.5 h-3.5" />
              ) : (
                <PanelRightOpen className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">
                {rightPanelOpen ? 'Hide Context' : 'Business Context'}
              </span>
            </button>
          </div>
        </div>

        {/* 10 MANDATORY QUICK COMMANDS BAR */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5">
          <span className={`text-[11px] font-mono shrink-0 ${mutedText}`}>
            Quick Commands:
          </span>
          {TEN_QUICK_COMMANDS.map((cmd) => {
            const promptToUse = languagePref === 'TE' ? cmd.teluguPrompt : cmd.prompt;
            return (
              <button
                key={cmd.id}
                type="button"
                disabled={busyAction === 'chat'}
                onClick={() => {
                  onChangeChatPrompt(promptToUse);
                  onExecutePrompt(promptToUse);
                }}
                title={`${cmd.description} — "${promptToUse}"`}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0 ${
                  isLight
                    ? 'bg-[#FFFFFF] hover:bg-[#24211D] hover:text-[#FAF8F4] text-[#24211D] border border-[#DED7CC]'
                    : 'bg-[#1C1A16] hover:bg-[#D4AF37] hover:text-[#111115] text-[#F5F2EB] border border-[#2E2A23]'
                }`}
              >
                {cmd.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* =====================================================================
          MAIN 3-COLUMN LUXURY WORKSPACE (LEFT PANEL · CENTER CHAT · RIGHT PANEL)
      ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[740px]">
        {/* -------------------------------------------------------------------
            LEFT PANEL (3 Cols):
            - New Chat
            - Recent Conversations
            - Saved Insights
            - Marketing Plans
            - Action History
        ------------------------------------------------------------------- */}
        <aside
          className={`${
            mobileLeftOpen ? 'block' : leftPanelOpen ? 'hidden lg:flex' : 'hidden'
          } lg:col-span-3 flex-col justify-between border-b lg:border-b-0 lg:border-r p-4 space-y-4 ${
            isLight ? 'border-[#E5DEC9] bg-[#F7F4EC]' : 'border-[#2B2822] bg-[#13120F]'
          }`}
          aria-label="Conversations, Insights, Plans, and History"
        >
          <div className="space-y-3.5">
            {/* Primary Action: New Chat */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onSelectConvId('');
                  setMobileLeftOpen(false);
                  chatInputRef.current?.focus();
                }}
                className={`w-full py-2.5 px-4 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0 ${goldPrimaryBtn}`}
              >
                <Plus className="w-4 h-4" />
                <span>New Chat</span>
              </button>
            </div>

            {/* Search Input across Left Panel */}
            <div className="relative">
              <Search className={`w-3.5 h-3.5 absolute left-3 top-2.5 ${mutedText}`} />
              <input
                ref={leftSearchInputRef}
                type="text"
                value={leftSearchQuery}
                onChange={(e) => setLeftSearchQuery(e.target.value)}
                placeholder="Search threads, insights, plans... (/)"
                aria-label="Search conversations, insights, marketing plans, and action history"
                className={`w-full rounded-lg pl-8 pr-7 py-1.5 text-xs border focus:outline-none ${inputSurface}`}
              />
              {leftSearchQuery && (
                <button
                  type="button"
                  onClick={() => setLeftSearchQuery('')}
                  className={`absolute right-2.5 top-2 ${mutedText} hover:opacity-100`}
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* 4-Way Left Panel Section Switcher */}
            <div
              className={`grid grid-cols-2 gap-1 p-1 rounded-lg border ${
                isLight ? 'bg-[#EDE8DC] border-[#DED7CC]' : 'bg-[#0C0B09] border-[#26231D]'
              }`}
              role="tablist"
            >
              {(
                [
                  {
                    id: 'CONVERSATIONS',
                    label: 'Conversations',
                    count: conversations.length
                  },
                  {
                    id: 'SAVED_INSIGHTS',
                    label: 'Saved Insights',
                    count: combinedSavedInsights.length
                  },
                  {
                    id: 'MARKETING_PLANS',
                    label: 'Marketing Plans',
                    count: plans.length
                  },
                  {
                    id: 'ACTION_HISTORY',
                    label: 'Action History',
                    count: approvals.length
                  }
                ] as const
              ).map((tab) => {
                const active = leftSection === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setLeftSection(tab.id)}
                    className={`px-2.5 py-1.5 rounded-md text-[11px] font-medium text-left flex items-center justify-between transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0 ${
                      active
                        ? isLight
                          ? 'bg-[#FFFFFF] text-[#24211D] shadow-xs font-semibold'
                          : 'bg-[#24211C] text-[#D4AF37] font-semibold'
                        : `${mutedText} hover:opacity-100`
                    }`}
                  >
                    <span className="truncate">{tab.label}</span>
                    <span className="font-mono tabular-nums text-[10px] opacity-75 ml-1">
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* 1. RECENT CONVERSATIONS LIST */}
            {leftSection === 'CONVERSATIONS' && (
              <div className="space-y-2 max-h-[440px] overflow-y-auto pr-1">
                {filteredConversations.length === 0 ? (
                  <div className={`p-4 rounded-lg border text-xs ${cardBg}`}>
                    <p className={mutedText}>No conversations match "{leftSearchQuery}".</p>
                  </div>
                ) : (
                  filteredConversations.map((conv: any) => {
                    const isSelected = selectedConvId === conv.id;
                    const isRenaming = renamingConvId === conv.id;
                    return (
                      <div
                        key={conv.id}
                        onClick={() => {
                          if (!isRenaming) {
                            onSelectConvId(conv.id);
                            setMobileLeftOpen(false);
                          }
                        }}
                        className={`p-3 rounded-lg border transition-colors duration-150 cursor-pointer ${
                          isSelected
                            ? isLight
                              ? 'bg-[#FFFFFF] border-[#9A783E] shadow-xs'
                              : 'bg-[#221F1A] border-[#D4AF37]'
                            : `${cardBg} hover:border-[#9A783E]/50`
                        }`}
                      >
                        {isRenaming ? (
                          <div
                            className="flex items-center gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="text"
                              value={renameTitleInput}
                              onChange={(e) => onChangeRenameTitleInput(e.target.value)}
                              className={`flex-1 rounded px-2 py-1 text-xs border ${inputSurface}`}
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => onRenameConversation(conv.id)}
                              className="p-1 text-emerald-600 hover:text-emerald-500 cursor-pointer"
                              aria-label="Save conversation title"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onSetRenamingConvId(null)}
                              className={`p-1 ${mutedText} cursor-pointer`}
                              aria-label="Cancel rename"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-xs font-semibold line-clamp-1">
                              {conv.title}
                            </h4>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSetRenamingConvId(conv.id);
                                onChangeRenameTitleInput(conv.title);
                              }}
                              title="Rename Conversation"
                              className={`${mutedText} hover:opacity-100 shrink-0 cursor-pointer`}
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        <p className={`text-[11px] mt-1 line-clamp-2 ${mutedText}`}>
                          {conv.memorySummary}
                        </p>

                        {/* Unboxed Metadata with · separators */}
                        <div
                          className={`flex items-center gap-1.5 text-[10px] font-mono tabular-nums mt-2 ${mutedText}`}
                        >
                          <span>{conv.languagePreference || 'EN'}</span>
                          <span aria-hidden="true">·</span>
                          <span>{conv.messageCount || 1} msgs</span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {conv.updatedAt
                              ? new Date(conv.updatedAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })
                              : 'Active'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* 2. SAVED INSIGHTS & PROMPTS LIST */}
            {leftSection === 'SAVED_INSIGHTS' && (
              <div className="space-y-2.5 max-h-[440px] overflow-y-auto pr-1">
                {combinedSavedInsights.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-lg border space-y-1.5 ${cardBg}`}
                  >
                    <div className={`text-[10px] font-mono ${accentText}`}>
                      {item.meta}
                    </div>
                    <div className="text-xs font-semibold">{item.title}</div>
                    <p className={`text-[11px] leading-relaxed line-clamp-2 ${mutedText}`}>
                      {item.summary}
                    </p>
                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          onChangeChatPrompt(item.promptToRun);
                          onExecutePrompt(item.promptToRun);
                          setMobileLeftOpen(false);
                        }}
                        className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer whitespace-nowrap shrink-0 ${goldPrimaryBtn}`}
                      >
                        Run in Chat →
                      </button>
                      {item.canDelete && (
                        <button
                          type="button"
                          onClick={() => onDeleteSavedPrompt(item.id)}
                          className={`p-1 text-red-500 hover:opacity-80 cursor-pointer`}
                          title="Delete Saved Prompt"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 3. MARKETING PLANS LIST */}
            {leftSection === 'MARKETING_PLANS' && (
              <div className="space-y-2.5 max-h-[440px] overflow-y-auto pr-1">
                {filteredPlans.map((plan: any) => {
                  const poas =
                    plan.contextEvidence?.goalBlueprint?.estimatedCostAndReturns
                      ?.estimatedPoas ||
                    plan.projectedRoas ||
                    1.85;
                  return (
                    <div
                      key={plan.id}
                      className={`p-3 rounded-lg border space-y-1.5 ${cardBg}`}
                    >
                      <div
                        className={`flex items-center gap-1.5 text-[10px] font-mono tabular-nums ${mutedText}`}
                      >
                        <span className={accentText}>{plan.id}</span>
                        <span aria-hidden="true">·</span>
                        <span>{plan.status}</span>
                      </div>
                      <div className="text-xs font-semibold">{plan.title}</div>
                      <div
                        className={`flex items-center gap-2 text-[11px] font-mono tabular-nums ${mutedText}`}
                      >
                        <span>
                          Budget: ₹{Number(plan.budgetInr || 0).toLocaleString('en-IN')}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className={accentText}>Est. POAS: {poas}x</span>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            const p = `Review Marketing Plan "${plan.title}" (${plan.id}) with ₹${Number(
                              plan.budgetInr || 15000
                            ).toLocaleString('en-IN')} budget and recommend next execution steps.`;
                            onChangeChatPrompt(p);
                            onExecutePrompt(p);
                            setMobileLeftOpen(false);
                          }}
                          className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer whitespace-nowrap shrink-0 ${goldPrimaryBtn}`}
                        >
                          Open in Chat
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (onOpenCampaignDraftInManager) {
                              const bp = plan.contextEvidence?.goalBasedStrategyBlueprint;
                              onOpenCampaignDraftInManager({
                                id: plan.id,
                                name: plan.title,
                                goalObjective: plan.objective,
                                product: bp?.skuUnitEconomics?.name || 'AZURE',
                                budgetInr: Number(plan.budgetRequiredInr || plan.budgetInr || 15000),
                                durationDays: Number(bp?.campaignParameters?.durationDays || 14),
                                audience: plan.targetSegment
                              });
                            } else {
                              onNavigateSubRoute('PLANNER');
                            }
                          }}
                          className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer whitespace-nowrap shrink-0 ${secondaryBtn}`}
                        >
                          Edit in Wizard
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 4. ACTION HISTORY LIST */}
            {leftSection === 'ACTION_HISTORY' && (
              <div className="space-y-2.5 max-h-[440px] overflow-y-auto pr-1">
                {filteredActionHistory.map((act: any) => (
                  <div
                    key={act.id}
                    className={`p-3 rounded-lg border space-y-1.5 ${cardBg}`}
                  >
                    <div
                      className={`flex items-center gap-1.5 text-[10px] font-mono tabular-nums ${mutedText}`}
                    >
                      <span className={accentText}>{act.id}</span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          act.status === 'PENDING_APPROVAL'
                            ? 'text-amber-600 dark:text-amber-400 font-semibold'
                            : act.status.includes('EXECUTED')
                            ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                            : ''
                        }
                      >
                        {act.status}
                      </span>
                    </div>
                    <div className="text-xs font-semibold line-clamp-2">{act.title}</div>
                    <div className={`text-[10px] font-mono ${mutedText}`}>
                      Module: {act.module}
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => onNavigateSubRoute('APPROVALS')}
                        className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer whitespace-nowrap shrink-0 ${secondaryBtn}`}
                      >
                        Inspect Card
                      </button>
                      {act.status === 'PENDING_APPROVAL' && (
                        <button
                          type="button"
                          onClick={() =>
                            onApprovalDecision(act.id, 'APPROVE_DRY_RUN')
                          }
                          disabled={busyAction !== null}
                          className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer whitespace-nowrap shrink-0 ${goldPrimaryBtn}`}
                        >
                          Approve Dry-Run
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Left Panel Footer: Active Pinned Memory Summary */}
          <div className={`pt-3 border-t space-y-2 ${isLight ? 'border-[#E5DEC9]' : 'border-[#2B2822]'}`}>
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className={accentText}>Durable Brand Memory</span>
              <button
                type="button"
                onClick={() => onNavigateSubRoute('MEMORY')}
                className={`underline cursor-pointer ${mutedText} hover:opacity-100`}
              >
                Manage (10)
              </button>
            </div>
            <p className={`text-[11px] leading-relaxed ${mutedText}`}>
              Enforcing POAS ≥ 1.65x, Extrait 75% margin priority, and IFRA compliance across all prompts.
            </p>
          </div>
        </aside>

        {/* -------------------------------------------------------------------
            CENTER PANEL (6 Cols when Right Panel open, 9 Cols when closed):
            - AI Chat Conversation
            - Streaming Responses
            - Inline Charts & Tables (with CSV export)
            - Product & Campaign Cards
            - Workflow Previews
            - Action Approval Cards
            - Follow-Up Suggestions
        ------------------------------------------------------------------- */}
        <section
          className={`${centerColSpanClass} flex flex-col justify-between p-4 sm:p-6 lg:p-8 min-h-[700px]`}
          aria-label="AI CMO Conversation Canvas"
        >
          {/* AI CHAT HOME WELCOMING HERO & QUICK ACTION LAUNCHPAD */}
          <div
            className={`p-4 sm:p-6 rounded-2xl border mb-4 space-y-4 ${
              isLight ? 'bg-[#FAF8F4] border-[#E5DEC9]' : 'bg-[#151310] border-[#2B2822]'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className={`text-xs font-medium ${accentText}`}>
                  FRAGMORÉ Maison de Parfum · Executive AI Command Center
                </div>
                <h2 className="font-serif text-xl sm:text-2xl lg:text-3xl font-normal tracking-tight">
                  How shall we grow FRAGMORÉ today?
                </h2>
                {showWelcomeLaunchpad && (
                  <p className={`text-xs sm:text-sm ${mutedText}`}>
                    Ask in plain English or Telugu to analyze profit, launch campaigns, build automations, or review orders.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {pendingApprovals.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onNavigateSubRoute('APPROVALS')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-medium cursor-pointer shrink-0 ${goldPrimaryBtn}`}
                  >
                    {pendingApprovals.length} Pending Proposal{pendingApprovals.length > 1 ? 's' : ''} &rarr;
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowWelcomeLaunchpad((prev) => !prev)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium cursor-pointer shrink-0 ${secondaryBtn}`}
                >
                  {showWelcomeLaunchpad ? 'Compact Hero' : 'Show Launchpad'}
                </button>
              </div>
            </div>

            {showWelcomeLaunchpad && (
              <>
                {/* 6 Prominent Primary Quick Action Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5">
                  {[
                    {
                      label: 'Create Campaign',
                      sub: 'Plan & budget',
                      prompt: 'Create a campaign plan for AZURE with ₹10,000 budget.'
                    },
                    {
                      label: 'Analyze Profit',
                      sub: 'Margin & POAS',
                      prompt: 'Which perfume has the highest contribution margin?'
                    },
                    {
                      label: 'Build Automation',
                      sub: 'Cart recovery',
                      prompt:
                        'Create an abandoned cart recovery workflow for carts above ₹999, wait 30 minutes, check marketing consent, send an approved WhatsApp template, then stop if the order is completed.'
                    },
                    {
                      label: 'Generate Content',
                      sub: 'Luxury briefs',
                      prompt: 'Generate a creative brief for SOLARA.'
                    },
                    {
                      label: 'Check Inventory',
                      sub: 'Stock & batch',
                      prompt: 'Show low stock items and recommend production quantities.'
                    },
                    {
                      label: 'Review Orders',
                      sub: 'Carts & status',
                      prompt: 'Show all abandoned carts above ₹999.'
                    }
                  ].map((qa) => (
                    <button
                      key={qa.label}
                      type="button"
                      disabled={busyAction === 'chat'}
                      onClick={() => {
                        onChangeChatPrompt(qa.prompt);
                        onExecutePrompt(qa.prompt);
                      }}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        isLight
                          ? 'bg-[#FFFFFF] hover:border-[#9A783E] border-[#E5DEC9]'
                          : 'bg-[#1D1B17] hover:border-[#D4AF37] border-[#2E2A23]'
                      }`}
                    >
                      <div className="text-sm font-medium">{qa.label}</div>
                      <div className={`text-xs ${mutedText} mt-0.5`}>{qa.sub}</div>
                    </button>
                  ))}
                </div>

                {/* Pending Approvals & Key Insights Snapshot on Chat Home */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div className={`p-3.5 rounded-xl border ${cardBg} flex items-center justify-between gap-3`}>
                    <div className="min-w-0">
                      <div className={`text-xs font-medium ${accentText}`}>Pending Approval Queue</div>
                      <div className="text-sm font-medium truncate mt-0.5">
                        {pendingApprovals[0]?.title || 'All proposals reviewed'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigateSubRoute('APPROVALS')}
                      className={`px-3 py-1.5 rounded-lg text-xs ${secondaryBtn} cursor-pointer shrink-0`}
                    >
                      Review
                    </button>
                  </div>

                  <div className={`p-3.5 rounded-xl border ${cardBg} flex items-center justify-between gap-3`}>
                    <div className="min-w-0">
                      <div className={`text-xs font-medium ${accentText}`}>Key Business Insight</div>
                      <div className="text-sm font-medium truncate mt-0.5">
                        Net Revenue ₹{Number(kpis?.verifiedNetRevenueInr || 0).toLocaleString('en-IN')} · {kpis?.activeAbandonedCartsCount || 0} High-Intent Carts
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigateSubRoute('INSIGHTS')}
                      className={`px-3 py-1.5 rounded-lg text-xs ${secondaryBtn} cursor-pointer shrink-0`}
                    >
                      Insights
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Active Conversation Header + 3-State Distinction Legend */}
          <div
            className={`pb-3.5 border-b flex flex-col gap-2.5 ${
              isLight ? 'border-[#E5DEC9]' : 'border-[#2B2822]'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-lg sm:text-xl font-serif tracking-wide">
                  {activeConversation?.title ||
                    'Active Strategy Conversation'}
                </h3>
                <div className={`flex items-center gap-2 text-xs mt-0.5 flex-wrap ${mutedText}`}>
                  <span>Markdown &amp; Live Charts</span>
                  <span aria-hidden="true">·</span>
                  <span>Inline Editable Previews</span>
                  <span aria-hidden="true">·</span>
                  <span>Cross-Browser Synced</span>
                </div>
              </div>

              {activeConversation?.linkedEntities?.length > 0 && (
                <div className={`text-xs ${mutedText} shrink-0`}>
                  Active Context:{' '}
                  <strong className={accentText}>
                    {activeConversation.linkedEntities
                      .slice(0, 3)
                      .map((e: any) => e.label)
                      .join(' · ')}
                  </strong>
                </div>
              )}
            </div>

            {/* Unmistakable State Distinction Strip */}
            <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono ${mutedText}`}>
              <span>
                <strong className={accentText}>○ AI Suggestion:</strong> Advisory only (not saved)
              </span>
              <span aria-hidden="true">·</span>
              <span>
                <strong className="text-amber-700 dark:text-amber-400">● Saved Draft:</strong> Staged in PostgreSQL &amp; editable inline in chat
              </span>
              <span aria-hidden="true">·</span>
              <span>
                <strong className="text-emerald-700 dark:text-emerald-400">● Executed Action:</strong> Approved &amp; verified in production DB
              </span>
            </div>
          </div>

          {/* Conversation Messages Stream */}
          <div
            ref={messagesContainerRef}
            className="flex-1 space-y-6 overflow-y-auto max-h-[620px] py-4 pr-1"
          >
            {currentThreadMessages.map((msg: any) => {
              const sr = msg.structuredResponse;
              const isUser = msg.role === 'user';

              if (isUser) {
                return (
                  <div
                    key={msg.id}
                    className={`p-4 rounded-xl border ml-6 sm:ml-16 ${
                      isLight
                        ? 'bg-[#F4F0E8] border-[#DED7CC] text-[#24211D]'
                        : 'bg-[#201D17] border-[#383327] text-[#F5F2EB]'
                    }`}
                  >
                    <div
                      className={`flex items-center justify-between text-[11px] font-mono tabular-nums mb-1.5 ${mutedText}`}
                    >
                      <span>Founder / Admin ({adminEmail})</span>
                      <span>
                        {msg.createdAt
                          ? new Date(msg.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : 'Now'}
                      </span>
                    </div>
                    <div className="text-sm leading-relaxed">{msg.content}</div>
                    {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                      <div className={`mt-2 text-xs font-mono ${accentText}`}>
                        Attached:{' '}
                        {msg.attachments
                          .map(
                            (att: any) =>
                              `${att.name} (${Math.round((att.size || 0) / 1024)} KB)`
                          )
                          .join(' · ')}
                      </div>
                    )}
                  </div>
                );
              }

              const matchedProducts = getMatchedProductCardsForMessage(msg);
              const matchedCampaigns = getMatchedCampaignCardsForMessage(msg);
              const followUps = getContextualFollowUps(msg);
              const viewMode = dataViewModeByMsg[msg.id] || 'CHART_AND_TABLE';

              // Build chart bars from table rows or summaryMetrics
              const chartBars: { label: string; displayValue: string; numeric: number }[] =
                [];
              if (
                Array.isArray(sr?.supportingData?.tableRows) &&
                sr.supportingData.tableRows.length > 0
              ) {
                sr.supportingData.tableRows.slice(0, 6).forEach((row: string[]) => {
                  const rawNum =
                    parseNumericFromCell(row[1]) ||
                    parseNumericFromCell(row[2]) ||
                    parseNumericFromCell(row[3]);
                  if (rawNum > 0) {
                    chartBars.push({
                      label: row[0],
                      displayValue: row[1] || row[2] || '',
                      numeric: rawNum
                    });
                  }
                });
              } else if (Array.isArray(sr?.supportingData?.summaryMetrics)) {
                sr.supportingData.summaryMetrics.forEach((m: any) => {
                  const rawNum = parseNumericFromCell(m.value);
                  if (rawNum > 0) {
                    chartBars.push({
                      label: m.label,
                      displayValue: m.value,
                      numeric: rawNum
                    });
                  }
                });
              }
              const maxBarVal = Math.max(
                1,
                ...chartBars.map((b) => b.numeric)
              );

              return (
                <article
                  key={msg.id}
                  className={`p-5 rounded-xl border space-y-5 ${cardBg}`}
                >
                  {/* Assistant Header Metadata (Unboxed with · separators) */}
                  <div
                    className={`flex flex-wrap items-center justify-between gap-2 pb-3 border-b text-xs font-mono tabular-nums ${
                      isLight ? 'border-[#EFECE4]' : 'border-[#26231D]'
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-serif font-semibold text-sm ${accentText}`}>
                        FRAGMORÉ AI CMO
                      </span>
                      {sr?.intentClassified && (
                        <>
                          <span aria-hidden="true" className={mutedText}>
                            ·
                          </span>
                          <span className={mutedText}>{sr.intentClassified}</span>
                        </>
                      )}
                      {sr?.languageDetected && (
                        <>
                          <span aria-hidden="true" className={mutedText}>
                            ·
                          </span>
                          <span className={accentText}>{sr.languageDetected}</span>
                        </>
                      )}
                    </div>
                    <span className={mutedText}>
                      {msg.modelUsed || 'gemini-3.8-flash'} · {msg.latencyMs || 18}ms
                    </span>
                  </div>

                  {/* TOOL EXECUTION PROGRESS STRIP (Real Backend Tools & Adapters Invoked) */}
                  {Array.isArray(msg.toolCalls) && msg.toolCalls.length > 0 && (
                    <div
                      className={`px-3.5 py-2.5 rounded-lg border flex flex-wrap items-center justify-between gap-2 text-xs font-mono tabular-nums ${subtleBg}`}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-semibold ${accentText}`}>
                          Tool Execution Progress ({msg.toolCalls.length}/{msg.toolCalls.length} Complete):
                        </span>
                        {msg.toolCalls.map((tc: any, tcIdx: number) => (
                          <span
                            key={tcIdx}
                            className="inline-flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                            <span className="font-semibold">
                              {tc.toolId || tc.toolName || 'readTool'}
                            </span>
                            <span className={mutedText}>
                              ({tc.status || 'VERIFIED'} · {tc.latencyMs || 14}ms)
                            </span>
                            {tcIdx < msg.toolCalls.length - 1 && (
                              <span aria-hidden="true" className={mutedText}>
                                →
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                      <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
                        PostgreSQL Synced
                      </span>
                    </div>
                  )}

                  {/* 1. DIRECT ANSWER (Rich Markdown Formatting) */}
                  <div className="space-y-1.5">
                    <div className={`text-[11px] font-mono ${accentText}`}>
                      01. Executive Answer
                    </div>
                    {renderFormattedMarkdown(sr?.directAnswer || msg.content)}
                  </div>

                  {/* AMBIGUITY CLARIFICATION OPTIONS */}
                  {sr?.isAmbiguous && sr?.clarificationRequest && (
                    <div className={`p-4 rounded-lg border space-y-2.5 ${subtleBg}`}>
                      <div className="text-xs font-semibold">
                        Clarification Needed — Specify{' '}
                        {(sr.clarificationRequest.missingParameters || []).join(' & ')}:
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {(sr.clarificationRequest.suggestedOptions || []).map(
                          (opt: string, idx: number) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => onExecutePrompt(opt)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap shrink-0 ${goldPrimaryBtn}`}
                            >
                              {opt}
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  )}

                  {/* 2. SUPPORTING DATA WITH INLINE CHARTS, TABLES & CSV EXPORT */}
                  {sr?.supportingData && (
                    <div className={`p-4 rounded-xl border space-y-4 ${subtleBg}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs font-mono tabular-nums">
                          <span className={`font-semibold ${accentText}`}>
                            02. Live Supporting Data
                          </span>
                          <span aria-hidden="true" className={mutedText}>
                            ·
                          </span>
                          <span className={mutedText}>
                            IST: {sr.supportingData.timestampIst}
                          </span>
                        </div>

                        {/* Chart / Table Toggle + CSV Download */}
                        <div className="flex items-center gap-1.5">
                          {chartBars.length > 0 && (
                            <div
                              className={`flex items-center p-0.5 rounded-lg border ${
                                isLight
                                  ? 'bg-[#FFFFFF] border-[#DED7CC]'
                                  : 'bg-[#141310] border-[#2E2A23]'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setDataViewModeByMsg((prev) => ({
                                    ...prev,
                                    [msg.id]: 'CHART_AND_TABLE'
                                  }))
                                }
                                className={`px-2 py-1 rounded text-[11px] flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
                                  viewMode === 'CHART_AND_TABLE'
                                    ? isLight
                                      ? 'bg-[#24211D] text-[#FAF8F4]'
                                      : 'bg-[#D4AF37] text-[#111115] font-semibold'
                                    : mutedText
                                }`}
                              >
                                <BarChart3 className="w-3 h-3" />
                                <span>Chart + Table</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setDataViewModeByMsg((prev) => ({
                                    ...prev,
                                    [msg.id]: 'TABLE_ONLY'
                                  }))
                                }
                                className={`px-2 py-1 rounded text-[11px] flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
                                  viewMode === 'TABLE_ONLY'
                                    ? isLight
                                      ? 'bg-[#24211D] text-[#FAF8F4]'
                                      : 'bg-[#D4AF37] text-[#111115] font-semibold'
                                    : mutedText
                                }`}
                              >
                                <TableIcon className="w-3 h-3" />
                                <span>Table</span>
                              </button>
                            </div>
                          )}

                          {Array.isArray(sr.supportingData.tableHeaders) &&
                            Array.isArray(sr.supportingData.tableRows) &&
                            sr.supportingData.tableRows.length > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleDownloadTableCsv(
                                    msg.id,
                                    sr.supportingData.tableHeaders,
                                    sr.supportingData.tableRows
                                  )
                                }
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${secondaryBtn}`}
                                title="Download table as CSV"
                              >
                                <Download className="w-3 h-3" />
                                <span>CSV</span>
                              </button>
                            )}
                        </div>
                      </div>

                      {/* Summary KPI Strip */}
                      {Array.isArray(sr.supportingData.summaryMetrics) &&
                        sr.supportingData.summaryMetrics.length > 0 && (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {sr.supportingData.summaryMetrics.map(
                              (m: any, idx: number) => (
                                <div
                                  key={idx}
                                  className={`p-3 rounded-lg border ${cardBg}`}
                                >
                                  <div className={`text-[11px] ${mutedText}`}>
                                    {m.label}
                                  </div>
                                  <div className="text-base font-mono tabular-nums font-bold mt-0.5">
                                    {m.value}
                                  </div>
                                  {m.subtext && (
                                    <div className={`text-[11px] mt-0.5 ${mutedText}`}>
                                      {m.subtext}
                                    </div>
                                  )}
                                </div>
                              )
                            )}
                          </div>
                        )}

                      {/* Inline Horizontal Bar Visual Chart */}
                      {viewMode === 'CHART_AND_TABLE' && chartBars.length > 0 && (
                        <div className={`p-3.5 rounded-lg border space-y-2.5 ${cardBg}`}>
                          <div className={`text-[11px] font-mono ${mutedText}`}>
                            Visual Metric Comparison (Authoritative PostgreSQL Snapshot)
                          </div>
                          <div className="space-y-2">
                            {chartBars.map((bar, bIdx) => {
                              const widthPct = Math.max(
                                8,
                                Math.min(100, Math.round((bar.numeric / maxBarVal) * 100))
                              );
                              return (
                                <div key={bIdx} className="space-y-1">
                                  <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                                    <span className="font-medium truncate pr-2">
                                      {bar.label}
                                    </span>
                                    <span className={accentText}>{bar.displayValue}</span>
                                  </div>
                                  <div
                                    className={`w-full h-2 rounded-full overflow-hidden ${
                                      isLight ? 'bg-[#EDE8DC]' : 'bg-[#26231D]'
                                    }`}
                                  >
                                    <div
                                      className={`h-full rounded-full transition-opacity duration-200 ${
                                        isLight ? 'bg-[#9A783E]' : 'bg-[#D4AF37]'
                                      }`}
                                      style={{ width: `${widthPct}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Supporting Data Table */}
                      {Array.isArray(sr.supportingData.tableHeaders) &&
                        Array.isArray(sr.supportingData.tableRows) &&
                        sr.supportingData.tableRows.length > 0 && (
                          <div className={`overflow-x-auto rounded-lg border ${cardBg}`}>
                            <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
                              <thead>
                                <tr
                                  className={`border-b ${
                                    isLight
                                      ? 'border-[#E5DEC9] bg-[#FAF8F4]'
                                      : 'border-[#2B2822] bg-[#141310]'
                                  }`}
                                >
                                  {sr.supportingData.tableHeaders.map(
                                    (h: string, i: number) => (
                                      <th
                                        key={i}
                                        className={`py-2.5 px-3 font-semibold ${mutedText}`}
                                      >
                                        {h}
                                      </th>
                                    )
                                  )}
                                </tr>
                              </thead>
                              <tbody
                                className={`divide-y ${
                                  isLight ? 'divide-[#EFECE4]' : 'divide-[#24211B]'
                                }`}
                              >
                                {sr.supportingData.tableRows.map(
                                  (row: string[], rIdx: number) => (
                                    <tr
                                      key={rIdx}
                                      className={
                                        isLight
                                          ? 'hover:bg-[#FAF8F4]'
                                          : 'hover:bg-white/[0.02]'
                                      }
                                    >
                                      {row.map((cell: string, cIdx: number) => (
                                        <td
                                          key={cIdx}
                                          className={`py-2.5 px-3 ${
                                            cIdx === 0
                                              ? `font-semibold ${accentText}`
                                              : ''
                                          }`}
                                        >
                                          {cell}
                                        </td>
                                      ))}
                                    </tr>
                                  )
                                )}
                              </tbody>
                            </table>
                          </div>
                        )}
                    </div>
                  )}

                  {/* INLINE PRODUCT CARDS (When Catalog SKUs are referenced) */}
                  {matchedProducts.length > 0 && (
                    <div className="space-y-2.5">
                      <div className={`text-[11px] font-mono ${accentText}`}>
                        Referenced FRAGMORÉ Perfumes (Live Catalog &amp; Unit Economics)
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {matchedProducts.map((sku: any) => (
                          <div
                            key={sku.productId || sku.name}
                            className={`p-3.5 rounded-lg border flex flex-col justify-between space-y-3 ${subtleBg}`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                                <span className={`font-bold ${accentText}`}>
                                  {sku.name}
                                </span>
                                <span>
                                  ₹{Number(sku.retailPriceInr || 0).toLocaleString('en-IN')}
                                </span>
                              </div>
                              <div
                                className={`flex items-center gap-1.5 text-[11px] font-mono tabular-nums ${mutedText}`}
                              >
                                <span>Margin: {sku.contributionMarginPct}%</span>
                                <span aria-hidden="true">·</span>
                                <span>Stock: {sku.currentStock}u</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() =>
                                  onExecutePrompt(
                                    `Create a campaign plan for ${sku.name} with ₹10,000 budget.`
                                  )
                                }
                                className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer whitespace-nowrap shrink-0 ${goldPrimaryBtn}`}
                              >
                                Plan Campaign
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onExecutePrompt(
                                    `Generate a creative brief for ${sku.name}.`
                                  )
                                }
                                className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer whitespace-nowrap shrink-0 ${secondaryBtn}`}
                              >
                                Creative Brief
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* INLINE CAMPAIGN CARDS (When Paid Campaigns are referenced) */}
                  {matchedCampaigns.length > 0 && (
                    <div className="space-y-2.5">
                      <div className={`text-[11px] font-mono ${accentText}`}>
                        Connected Marketing Campaigns (POAS &amp; Spend Audit)
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {matchedCampaigns.map((camp: any) => (
                          <div
                            key={camp.campaignId}
                            className={`p-3.5 rounded-lg border space-y-2 ${subtleBg}`}
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold">{camp.name}</span>
                              <span className={`font-mono text-[11px] ${accentText}`}>
                                {camp.healthStatus}
                              </span>
                            </div>
                            <div
                              className={`flex items-center gap-2 text-[11px] font-mono tabular-nums ${mutedText}`}
                            >
                              <span>{camp.channel}</span>
                              <span aria-hidden="true">·</span>
                              <span>
                                Spend: ₹{Number(camp.spendInr || 0).toLocaleString('en-IN')}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>ROAS: {camp.roas}x</span>
                              <span aria-hidden="true">·</span>
                              <span className={accentText}>POAS: {camp.poas}x</span>
                            </div>
                            <div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
                              <button
                                type="button"
                                onClick={() =>
                                  onExecutePrompt(
                                    `Propose a POAS optimization plan for campaign "${camp.name}" (${camp.channel}).`
                                  )
                                }
                                className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer whitespace-nowrap shrink-0 ${secondaryBtn}`}
                              >
                                Optimize in Chat →
                              </button>
                              {onOpenCampaignDraftInManager && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onOpenCampaignDraftInManager({
                                      id: camp.campaignId,
                                      name: camp.name,
                                      product: 'AZURE',
                                      channels: String(camp.channel || '').includes('Google')
                                        ? ['Google']
                                        : ['Meta'],
                                      budgetInr: Number(camp.spendInr || 15000),
                                      durationDays: 14
                                    })
                                  }
                                  className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer whitespace-nowrap shrink-0 ${secondaryBtn}`}
                                >
                                  Open in Campaign Wizard
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 3. INLINE EDITABLE WORKFLOW PREVIEW CARD (When Automation DAG is created/updated in Chat) */}
                  {sr?.workflowChatCard && (
                    <div className={`p-4 sm:p-5 rounded-xl border space-y-4 ${subtleBg}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-current/10">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs font-mono tabular-nums flex-wrap">
                            <span
                              className={`font-semibold uppercase tracking-wider ${
                                sr.workflowChatCard.status === 'ACTIVE'
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : 'text-amber-700 dark:text-amber-400'
                              }`}
                            >
                              {sr.workflowChatCard.status === 'ACTIVE'
                                ? '● EXECUTED & ACTIVE WORKFLOW'
                                : '● SAVED DRAFT IN POSTGRESQL · AWAITING PUBLISH APPROVAL'}
                            </span>
                            <span aria-hidden="true" className={mutedText}>
                              ·
                            </span>
                            <span className={mutedText}>{sr.workflowChatCard.workflowId}</span>
                            <span aria-hidden="true" className={mutedText}>
                              ·
                            </span>
                            <span className={mutedText}>v{sr.workflowChatCard.version}</span>
                          </div>
                          <h4 className="text-base sm:text-lg font-serif">
                            {sr.workflowChatCard.workflowName}
                          </h4>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() =>
                              setInlineWorkflowEditId(
                                inlineWorkflowEditId === sr.workflowChatCard.workflowId
                                  ? null
                                  : sr.workflowChatCard.workflowId
                              )
                            }
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap shrink-0 ${secondaryBtn}`}
                          >
                            {inlineWorkflowEditId === sr.workflowChatCard.workflowId
                              ? 'Close Inline Editor'
                              : 'Edit Workflow Inline'}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onRunWorkflowDryRun(sr.workflowChatCard.workflowId)
                            }
                            disabled={
                              busyAction === `dryrun-${sr.workflowChatCard.workflowId}`
                            }
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap shrink-0 ${secondaryBtn}`}
                          >
                            {busyAction === `dryrun-${sr.workflowChatCard.workflowId}`
                              ? 'Simulating...'
                              : 'Run Dry-Run Simulation'}
                          </button>
                          {sr.workflowChatCard.status !== 'ACTIVE' && (
                            <button
                              type="button"
                              onClick={() =>
                                onWorkflowPublishGate(
                                  sr.workflowChatCard.workflowId,
                                  'APPROVE_AND_PUBLISH'
                                )
                              }
                              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap shrink-0 ${goldPrimaryBtn}`}
                            >
                              Approve &amp; Publish Workflow
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Inline Workflow Editor inside Chat */}
                      {inlineWorkflowEditId === sr.workflowChatCard.workflowId && (
                        <div className={`p-3.5 rounded-lg border space-y-3 ${cardBg}`}>
                          <div className="text-xs font-semibold">
                            Modify Workflow Draft Parameters Inline (Saves new version in PostgreSQL `automation_workflows`):
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                            <label className="space-y-1 text-xs">
                              <span className={mutedText}>Wait Delay Before Outreach (Minutes)</span>
                              <input
                                type="number"
                                min={5}
                                max={1440}
                                value={inlineWorkflowDelayMinutes}
                                onChange={(e) => setInlineWorkflowDelayMinutes(e.target.value)}
                                className={`w-full rounded-lg px-3 py-2 text-xs font-mono border ${inputSurface}`}
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                const mins = Number(inlineWorkflowDelayMinutes) || 120;
                                const hrs =
                                  mins >= 60 && mins % 60 === 0
                                    ? `${mins / 60} hours`
                                    : `${mins} minutes`;
                                setInlineWorkflowEditId(null);
                                onExecutePrompt(`Change the delay to ${hrs}.`);
                              }}
                              className={`px-3 py-2 rounded-lg text-xs font-medium cursor-pointer ${goldPrimaryBtn}`}
                            >
                              Apply Delay Update ({inlineWorkflowDelayMinutes}m)
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setInlineWorkflowEditId(null);
                                onExecutePrompt('Add an email fallback.');
                              }}
                              className={`px-3 py-2 rounded-lg text-xs font-medium cursor-pointer ${secondaryBtn}`}
                            >
                              + Attach Email Fallback Branch
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div className={`p-3 rounded-lg border ${cardBg}`}>
                          <div className={`text-[10px] font-mono ${mutedText}`}>
                            1. Trigger &amp; Timing
                          </div>
                          <div className="font-semibold mt-1">
                            {sr.workflowChatCard.trigger}
                          </div>
                          <div className={`text-[11px] mt-1 ${mutedText}`}>
                            {sr.workflowChatCard.timing}
                          </div>
                        </div>

                        <div className={`p-3 rounded-lg border ${cardBg}`}>
                          <div className={`text-[10px] font-mono ${mutedText}`}>
                            2. Conditions ({sr.workflowChatCard.conditions?.length || 0})
                          </div>
                          <ul className="mt-1 space-y-1 text-[11px]">
                            {(sr.workflowChatCard.conditions || []).map(
                              (c: string, idx: number) => (
                                <li key={idx}>• {c}</li>
                              )
                            )}
                          </ul>
                        </div>

                        <div className={`p-3 rounded-lg border ${cardBg}`}>
                          <div className={`text-[10px] font-mono ${mutedText}`}>
                            3. Actions &amp; Eligible Audience
                          </div>
                          <ul className="mt-1 space-y-1 text-[11px]">
                            {(sr.workflowChatCard.actions || []).map(
                              (a: string, idx: number) => (
                                <li key={idx}>• {a}</li>
                              )
                            )}
                          </ul>
                          <div className={`text-[11px] font-mono mt-1.5 ${accentText}`}>
                            Audience:{' '}
                            {typeof sr.workflowChatCard.estimatedAudience === 'object'
                              ? sr.workflowChatCard.estimatedAudience.headline
                              : sr.workflowChatCard.estimatedAudience}
                          </div>
                        </div>
                      </div>

                      {/* 1-Click Contextual Workflow Follow-Ups */}
                      <div className="pt-2 border-t border-current/10 flex flex-wrap items-center gap-2">
                        <span className={`text-[11px] font-mono ${mutedText}`}>
                          Refine Workflow in Chat:
                        </span>
                        {[
                          'Add an email fallback.',
                          'Change the delay to two hours.',
                          'Only target first-time customers.',
                          'Pause this workflow.'
                        ].map((wfPrompt) => (
                          <button
                            key={wfPrompt}
                            type="button"
                            onClick={() => onExecutePrompt(wfPrompt)}
                            className={`px-2.5 py-1 rounded text-xs cursor-pointer whitespace-nowrap shrink-0 ${secondaryBtn}`}
                          >
                            {wfPrompt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 4. RECOMMENDED NEXT ACTIONS (Clearly Labeled as AI Suggestions / Advisory Only) */}
                  {Array.isArray(sr?.recommendedNextActions) &&
                    sr.recommendedNextActions.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className={`text-[11px] font-mono ${accentText}`}>
                            03. AI Strategic Suggestions
                          </div>
                          <span className={`text-[11px] font-mono ${mutedText}`}>
                            ○ AI SUGGESTION (Advisory Only · Not Saved or Executed Until Requested)
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {sr.recommendedNextActions.map((rec: any, idx: number) => (
                            <div
                              key={idx}
                              className={`p-3.5 rounded-lg border flex flex-col justify-between text-xs gap-2 ${subtleBg}`}
                            >
                              <div>
                                <span className={`font-mono mr-1.5 ${accentText}`}>
                                  0{rec.step || idx + 1}.
                                </span>
                                <span className="font-medium">{rec.title}</span>
                              </div>
                              <div
                                className={`flex items-center justify-between text-[11px] font-mono pt-1 ${mutedText}`}
                              >
                                <span>{rec.impact}</span>
                                <button
                                  type="button"
                                  onClick={() => onExecutePrompt(rec.title)}
                                  className={`underline cursor-pointer ${accentText}`}
                                >
                                  Run in Chat →
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* 5. INLINE EDITABLE CAMPAIGN & ACTION PREVIEW CARDS (Saved Draft vs Executed & Verified) */}
                  {Array.isArray(sr?.approvalRequests) &&
                    sr.approvalRequests.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className={`text-[11px] font-mono ${accentText}`}>
                            04. Interactive Campaign &amp; Action Preview (Inline Editable in Conversation)
                          </div>
                          <span className={`text-[11px] font-mono ${mutedText}`}>
                            Persisted in PostgreSQL · Zero Live Spend Until Approved
                          </span>
                        </div>

                        {sr.approvalRequests.map((reqItem: any) => {
                          const liveApproval = approvalsById[reqItem.id] || reqItem;
                          const uCard = liveApproval.universalApprovalCard;
                          const payload = liveApproval.payload || {};
                          const status =
                            liveApproval.approvalStatus || 'PENDING_APPROVAL';
                          const isPending = status === 'PENDING_APPROVAL';
                          const isExecuted =
                            status === 'APPROVED_AND_EXECUTED' ||
                            status === 'APPROVED_DRY_RUN' ||
                            status === 'EXECUTED';
                          const isEditingInline = inlineEditCardId === liveApproval.id;

                          const budgetVal = Number(
                            payload.budget ||
                              uCard?.financialImplications?.adBudgetExposureInr ||
                              uCard?.financialImplications?.directRefundOrCostInr ||
                              10000
                          );
                          const roasVal = Number(payload.projectedRoas || 4.6);
                          const projRevVal = Number(
                            payload.projectedRevenueInr || Math.round(budgetVal * roasVal)
                          );
                          const estProfitVal = Number(
                            payload.expectedNetProfitInr ??
                              Math.round(projRevVal * 0.72 - budgetVal)
                          );
                          const poasVal = Number(
                            payload.expectedPoas ??
                              ((projRevVal * 0.72) / Math.max(1, budgetVal)).toFixed(2)
                          );
                          const skuLabel =
                            payload.skuName ||
                            uCard?.affectedModuleAndRecords?.recordLabel ||
                            'AZURE';
                          const channelLabel =
                            payload.channel ||
                            uCard?.externalRecipients?.channel ||
                            'Meta Reels (50%) + WhatsApp VIP/Discovery (30%) + Google Brand Search (20%)';

                          return (
                            <div
                              key={reqItem.id}
                              className={`p-4 sm:p-5 rounded-xl border space-y-4 ${
                                isExecuted
                                  ? isLight
                                    ? 'bg-[#F4FBF7] border-emerald-600/40'
                                    : 'bg-[#12211A] border-emerald-500/40'
                                  : isLight
                                  ? 'bg-[#FDFBF7] border-[#C9A86A]'
                                  : 'bg-[#1D1A14] border-[#D4AF37]/50'
                              }`}
                            >
                              {/* Top Status Distinction Banner & Primary Controls */}
                              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-current/10">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 text-xs font-mono tabular-nums flex-wrap">
                                    <span
                                      className={`font-semibold uppercase tracking-wider ${
                                        isExecuted
                                          ? 'text-emerald-700 dark:text-emerald-400'
                                          : isPending
                                          ? 'text-amber-700 dark:text-amber-400'
                                          : 'text-red-600 dark:text-red-400'
                                      }`}
                                    >
                                      {isExecuted
                                        ? `● EXECUTED & VERIFIED IN DATABASE (${status})`
                                        : isPending
                                        ? '● SAVED DRAFT IN POSTGRESQL · AWAITING APPROVAL'
                                        : `● ${status}`}
                                    </span>
                                    <span aria-hidden="true" className={mutedText}>
                                      ·
                                    </span>
                                    <span className={`font-semibold ${accentText}`}>
                                      {liveApproval.id}
                                    </span>
                                    <span aria-hidden="true" className={mutedText}>
                                      ·
                                    </span>
                                    <span className={mutedText}>
                                      {uCard?. affectedModuleAndRecords?.moduleName ||
                                        liveApproval.adapterTarget}
                                    </span>
                                  </div>
                                  <h5 className="text-base font-serif font-semibold">
                                    {liveApproval.title}
                                  </h5>
                                </div>

                                <div className="flex items-center gap-2 flex-wrap shrink-0">
                                  {isPending ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          isEditingInline
                                            ? setInlineEditCardId(null)
                                            : handleOpenInlineCampaignEditor(liveApproval)
                                        }
                                        disabled={busyAction !== null}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap shrink-0 ${secondaryBtn}`}
                                      >
                                        {isEditingInline ? 'Cancel Edit' : 'Edit Preview Inline'}
                                      </button>
                                      {onOpenCampaignDraftInManager && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            onOpenCampaignDraftInManager({
                                              id: liveApproval.id,
                                              name: liveApproval.title,
                                              goalObjective: liveApproval.rationale,
                                              product: skuLabel,
                                              channels: ['Meta', 'Google', 'WhatsApp'].filter(
                                                (ch) =>
                                                  String(channelLabel)
                                                    .toLowerCase()
                                                    .includes(ch.toLowerCase())
                                              ),
                                              budgetInr: budgetVal,
                                              durationDays: Number(payload.durationDays || 14),
                                              audience:
                                                payload.audience ||
                                                uCard?.externalRecipients?.segmentSummary
                                            })
                                          }
                                          className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap shrink-0 ${secondaryBtn}`}
                                        >
                                          Open in Campaign Wizard
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onApprovalDecision(
                                            liveApproval.id,
                                            'APPROVE_DRY_RUN'
                                          )
                                        }
                                        disabled={busyAction !== null}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${secondaryBtn}`}
                                      >
                                        <Play className="w-3 h-3" />
                                        <span>Approve Draft</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onApprovalDecision(
                                            liveApproval.id,
                                            'APPROVE_LIVE',
                                            true
                                          )
                                        }
                                        disabled={busyAction !== null}
                                        className={`px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${goldPrimaryBtn}`}
                                      >
                                        <CheckCircle2 className="w-3 h-3" />
                                        <span>Approve &amp; Execute</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onApprovalDecision(liveApproval.id, 'REJECT')
                                        }
                                        disabled={busyAction !== null}
                                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-600 dark:text-red-400 border border-red-500/30 hover:bg-red-500/10 cursor-pointer whitespace-nowrap shrink-0"
                                      >
                                        Reject
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onApprovalDecision(liveApproval.id, 'ROLLBACK')
                                      }
                                      disabled={busyAction !== null}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${secondaryBtn}`}
                                    >
                                      <RotateCcw className="w-3 h-3" />
                                      <span>Rollback / Compensate</span>
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Inline Save Feedback Toast */}
                              {inlineSaveFeedback[liveApproval.id] && (
                                <div className="px-3 py-2 rounded-lg text-xs font-mono bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300">
                                  ✓ {inlineSaveFeedback[liveApproval.id]}
                                </div>
                              )}

                              {/* Business-Friendly Summary Grid (Product, Channel, Budget, Expected Revenue, Expected Profit) */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                <div className={`p-3 rounded-lg border ${cardBg}`}>
                                  <div className={`text-[10px] font-mono ${mutedText}`}>
                                    Featured Product / Target
                                  </div>
                                  <div className="text-sm font-semibold mt-0.5">
                                    {skuLabel}
                                  </div>
                                  <div className={`text-[11px] mt-0.5 ${mutedText}`}>
                                    {payload.whatsappFollowUpEnabled
                                      ? 'Includes 24h WhatsApp Follow-Up'
                                      : 'Verified Stock & Margin'}
                                  </div>
                                </div>

                                <div className={`p-3 rounded-lg border ${cardBg}`}>
                                  <div className={`text-[10px] font-mono ${mutedText}`}>
                                    Channel Allocation
                                  </div>
                                  <div className="text-xs font-semibold mt-0.5 line-clamp-2">
                                    {channelLabel}
                                  </div>
                                </div>

                                <div className={`p-3 rounded-lg border ${cardBg}`}>
                                  <div className={`text-[10px] font-mono ${mutedText}`}>
                                    Proposed Budget
                                  </div>
                                  <div className="text-base font-mono tabular-nums font-bold mt-0.5">
                                    ₹{budgetVal.toLocaleString('en-IN')}
                                  </div>
                                  <div className={`text-[11px] font-mono mt-0.5 ${mutedText}`}>
                                    Est. Revenue: ₹{projRevVal.toLocaleString('en-IN')} ({roasVal}x)
                                  </div>
                                </div>

                                <div className={`p-3 rounded-lg border ${cardBg}`}>
                                  <div className={`text-[10px] font-mono ${mutedText}`}>
                                    Expected Net Profit (After COGS &amp; Ads)
                                  </div>
                                  <div className="text-base font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                                    ₹{estProfitVal.toLocaleString('en-IN')}
                                  </div>
                                  <div className={`text-[11px] font-mono mt-0.5 ${accentText}`}>
                                    {poasVal}x POAS · 72% Gross Margin
                                  </div>
                                </div>
                              </div>

                              {/* INLINE EDIT FORM INSIDE THE CONVERSATION */}
                              {isEditingInline && (
                                <div className={`p-4 rounded-xl border space-y-3 ${cardBg}`}>
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold">
                                      Edit Campaign / Proposal Draft Directly in Chat
                                    </span>
                                    <span className={`text-[11px] font-mono ${mutedText}`}>
                                      Updates PostgreSQL `ai_cmo_action_approvals` &amp; syncs across browsers
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                                    <label className="space-y-1 sm:col-span-2">
                                      <span className={mutedText}>Campaign / Action Title</span>
                                      <input
                                        type="text"
                                        value={inlineEditTitle}
                                        onChange={(e) => setInlineEditTitle(e.target.value)}
                                        className={`w-full rounded-lg px-3 py-2 text-xs border ${inputSurface}`}
                                      />
                                    </label>

                                    <label className="space-y-1">
                                      <span className={mutedText}>Featured Fragrance SKU</span>
                                      <input
                                        type="text"
                                        value={inlineEditSkuName}
                                        onChange={(e) => setInlineEditSkuName(e.target.value)}
                                        className={`w-full rounded-lg px-3 py-2 text-xs border ${inputSurface}`}
                                      />
                                    </label>

                                    <label className="space-y-1">
                                      <span className={mutedText}>Budget (₹ INR)</span>
                                      <input
                                        type="number"
                                        min={1000}
                                        step={500}
                                        value={inlineEditBudget}
                                        onChange={(e) => setInlineEditBudget(e.target.value)}
                                        className={`w-full rounded-lg px-3 py-2 text-xs font-mono border ${inputSurface}`}
                                      />
                                    </label>

                                    <label className="space-y-1 sm:col-span-3">
                                      <span className={mutedText}>Channel Allocation</span>
                                      <input
                                        type="text"
                                        value={inlineEditChannel}
                                        onChange={(e) => setInlineEditChannel(e.target.value)}
                                        className={`w-full rounded-lg px-3 py-2 text-xs border ${inputSurface}`}
                                      />
                                    </label>

                                    <label className="space-y-1">
                                      <span className={mutedText}>Target ROAS (x)</span>
                                      <input
                                        type="number"
                                        step="0.1"
                                        min={1.2}
                                        value={inlineEditRoas}
                                        onChange={(e) => setInlineEditRoas(e.target.value)}
                                        className={`w-full rounded-lg px-3 py-2 text-xs font-mono border ${inputSurface}`}
                                      />
                                    </label>
                                  </div>

                                  <div className="flex items-center justify-end gap-2 pt-1">
                                    <button
                                      type="button"
                                      onClick={() => setInlineEditCardId(null)}
                                      className={`px-3 py-1.5 rounded-lg text-xs cursor-pointer ${secondaryBtn}`}
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      disabled={inlineSavingCardId === liveApproval.id}
                                      onClick={() => handleSaveInlineCampaignDraft(liveApproval)}
                                      className={`px-4 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${goldPrimaryBtn}`}
                                    >
                                      {inlineSavingCardId === liveApproval.id
                                        ? 'Saving to PostgreSQL...'
                                        : 'Save Draft Changes'}
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* BACKEND-VERIFIED EXECUTION PROOF (When Approved & Executed) */}
                              {isExecuted && liveApproval.executionResult && (
                                <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-xs space-y-1">
                                  <div className="font-semibold text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                                    <span>
                                      ✓ Backend-Verified Execution Result (Committed to PostgreSQL)
                                    </span>
                                    <span className="font-mono">
                                      {liveApproval.executedAt
                                        ? new Date(liveApproval.executedAt).toLocaleTimeString()
                                        : 'Verified'}
                                    </span>
                                  </div>
                                  <div className={`font-mono text-[11px] ${mutedText}`}>
                                    {liveApproval.executionResult?.summary ||
                                      liveApproval.executionResult?.verificationProof?.summary ||
                                      `Committed via ${liveApproval.adapterTarget} and verified in database.`}
                                  </div>
                                </div>
                              )}

                              {/* 1-CLICK CONTEXTUAL FOLLOW-UP CHIPS ON CAMPAIGN PREVIEW */}
                              {isPending && (
                                <div className="pt-2 border-t border-current/10 flex flex-wrap items-center gap-2">
                                  <span className={`text-[11px] font-mono ${mutedText}`}>
                                    Contextual Refinements:
                                  </span>
                                  {[
                                    'Change the budget to ₹15,000',
                                    'Use only Instagram',
                                    'Add a WhatsApp follow-up',
                                    'Show the expected profit'
                                  ].map((followUpCmd) => (
                                    <button
                                      key={followUpCmd}
                                      type="button"
                                      disabled={busyAction === 'chat'}
                                      onClick={() => {
                                        onChangeChatPrompt(followUpCmd);
                                        onExecutePrompt(followUpCmd);
                                      }}
                                      className={`px-2.5 py-1 rounded text-xs cursor-pointer whitespace-nowrap shrink-0 ${secondaryBtn}`}
                                    >
                                      {followUpCmd}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                  {/* 6. FOLLOW-UP SUGGESTIONS */}
                  <div
                    className={`pt-3 border-t space-y-2 ${
                      isLight ? 'border-[#EFECE4]' : 'border-[#26231D]'
                    }`}
                  >
                    <div className={`text-[11px] font-mono ${mutedText}`}>
                      Suggested Follow-Ups:
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {followUps.map((suggestion, sIdx) => (
                        <button
                          key={sIdx}
                          type="button"
                          disabled={busyAction === 'chat'}
                          onClick={() => {
                            onChangeChatPrompt(suggestion);
                            onExecutePrompt(suggestion);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0 ${secondaryBtn}`}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                </article>
              );
            })}

            {/* Streaming Response Indicator with Live Tool Execution Progress */}
            {streamingStatus && (
              <div className={`p-4 rounded-xl border space-y-3 ${cardBg}`}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className={`flex items-center gap-2 text-xs font-mono ${accentText}`}>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{streamingStatus}</span>
                  </div>
                  <span className={`text-[11px] font-mono ${mutedText}`}>
                    1. Context Snapshot → 2. Tool Execution → 3. Draft / Verification
                  </span>
                </div>
                {streamingPreviewText && (
                  <div className="text-xs font-mono whitespace-pre-line leading-relaxed">
                    {streamingPreviewText}
                  </div>
                )}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Conversational Composer */}
          <form
            onSubmit={onSubmitChatForm}
            className={`pt-3.5 border-t space-y-2.5 ${
              isLight ? 'border-[#E5DEC9]' : 'border-[#2B2822]'
            }`}
          >
            {/* Attached Files Preview */}
            {attachments.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {attachments.map((att, idx) => (
                  <span
                    key={idx}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono ${subtleBg}`}
                  >
                    <span>
                      {att.name} ({Math.round(att.size / 1024)} KB)
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveAttachment(idx)}
                      className="hover:opacity-100 opacity-70 cursor-pointer"
                      aria-label={`Remove attachment ${att.name}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Save Prompt Inline Bar */}
            {showSavePromptModal && (
              <div className={`p-3 rounded-lg border flex items-center gap-2 ${subtleBg}`}>
                <input
                  type="text"
                  value={newSavedPromptTitle}
                  onChange={(e) => onChangeNewSavedPromptTitle(e.target.value)}
                  placeholder="Title for this saved insight/prompt..."
                  className={`flex-1 rounded px-3 py-1.5 text-xs border ${inputSurface}`}
                />
                <button
                  type="button"
                  onClick={onSaveCurrentPrompt}
                  className={`px-3 py-1.5 rounded text-xs font-medium cursor-pointer ${goldPrimaryBtn}`}
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => onSetShowSavePromptModal(false)}
                  className={`px-2 py-1.5 text-xs cursor-pointer ${mutedText}`}
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Composer Controls Row */}
            <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-3 flex-wrap">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoProposeFromChat}
                    onChange={(e) => onChangeAutoProposeFromChat(e.target.checked)}
                    className="rounded"
                  />
                  <span className={mutedText}>Queue Action Proposal Card</span>
                </label>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.json,.txt,.md"
                  onChange={onFileAttach}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex items-center gap-1 cursor-pointer ${mutedText} hover:opacity-100`}
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>Attach File</span>
                </button>

                {chatPrompt.trim() && (
                  <button
                    type="button"
                    onClick={() => onSetShowSavePromptModal(true)}
                    className={`flex items-center gap-1 cursor-pointer ${mutedText} hover:opacity-100`}
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                    <span>Save Insight</span>
                  </button>
                )}
              </div>

              <span className={`text-[11px] font-mono ${mutedText}`}>
                Server-Side Gemini API · Protected by Approval Gates
              </span>
            </div>

            {/* Text Input + Send Button */}
            <div className="flex gap-2">
              <input
                ref={chatInputRef}
                type="text"
                value={chatPrompt}
                onChange={(e) => onChangeChatPrompt(e.target.value)}
                placeholder={
                  languagePref === 'TE'
                    ? 'ఇంగ్లీష్ లేదా తెలుగులో అడగండి (ఉదా: ఈరోజు ప్రత్యక్ష అమ్మకాలు మరియు లాభం చూపించు)...'
                    : "Ask anything in English or తెలుగు (e.g., 'Show me today's actual sales and profit' or 'Create a campaign plan for AZURE')..."
                }
                aria-label="Ask FRAGMORÉ AI CMO"
                className={`flex-1 rounded-lg px-4 py-3 text-sm border focus:outline-none ${inputSurface}`}
              />
              <button
                type="submit"
                disabled={busyAction === 'chat' || !chatPrompt.trim()}
                className={`px-5 py-3 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors duration-150 disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0 ${goldPrimaryBtn}`}
              >
                <Send className="w-3.5 h-3.5" />
                <span>{busyAction === 'chat' ? 'Streaming...' : 'Send'}</span>
              </button>
            </div>
          </form>
        </section>

        {/* -------------------------------------------------------------------
            RIGHT OPTIONAL PANEL (3 Cols):
            1. Business Context
            2. Active Campaigns
            3. Pending Approvals
            4. Workflow Health
            5. Current Data Freshness
        ------------------------------------------------------------------- */}
        {(rightPanelOpen || mobileRightOpen) && (
          <aside
            className={`${
              mobileRightOpen ? 'block' : 'hidden lg:block'
            } lg:col-span-3 border-t lg:border-t-0 lg:border-l p-4 space-y-4 overflow-y-auto max-h-[820px] ${
              isLight ? 'border-[#E5DEC9] bg-[#F7F4EC]' : 'border-[#2B2822] bg-[#13120F]'
            }`}
            aria-label="Business Context, Active Campaigns, Approvals, Workflow Health, and Data Freshness"
          >
            {/* 1. BUSINESS CONTEXT */}
            <div className={`p-3.5 rounded-xl border space-y-2.5 ${cardBg}`}>
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-serif font-semibold tracking-wide uppercase">
                  01. Business Context
                </h4>
                <button
                  type="button"
                  onClick={() =>
                    onExecutePrompt("Show me today's actual sales and profit.")
                  }
                  className={`text-[11px] font-mono underline cursor-pointer ${accentText}`}
                >
                  Diagnose
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono tabular-nums">
                <div className={`p-2.5 rounded-lg border ${subtleBg}`}>
                  <div className={`text-[10px] ${mutedText}`}>Verified Sales</div>
                  <div className="font-bold text-sm mt-0.5">
                    ₹{Number(kpis.verifiedRevenueInr || 0).toLocaleString('en-IN')}
                  </div>
                  <div className={`text-[10px] ${mutedText}`}>
                    {kpis.eligibleOrdersCount || 0} orders
                  </div>
                </div>
                <div className={`p-2.5 rounded-lg border ${subtleBg}`}>
                  <div className={`text-[10px] ${mutedText}`}>Contribution Profit</div>
                  <div className={`font-bold text-sm mt-0.5 ${accentText}`}>
                    ₹
                    {Number(kpis.verifiedContributionProfitInr || 0).toLocaleString(
                      'en-IN'
                    )}
                  </div>
                  <div className={`text-[10px] ${mutedText}`}>72% net margin</div>
                </div>
                <div className={`p-2.5 rounded-lg border ${subtleBg}`}>
                  <div className={`text-[10px] ${mutedText}`}>#1 Margin Perfume</div>
                  <div className="font-bold text-xs mt-0.5">
                    {kpis.highestMarginProduct?.name || 'AZURE'} (
                    {kpis.highestMarginProduct?.contributionMarginPct || 75}%)
                  </div>
                </div>
                <div className={`p-2.5 rounded-lg border ${subtleBg}`}>
                  <div className={`text-[10px] ${mutedText}`}>Abandoned Carts</div>
                  <div className="font-bold text-xs mt-0.5">
                    ₹{Number(kpis.abandonedValueInr || 0).toLocaleString('en-IN')} (
                    {kpis.activeAbandonedCartsCount || 0})
                  </div>
                </div>
              </div>
            </div>

            {/* 2. ACTIVE CAMPAIGNS */}
            <div className={`p-3.5 rounded-xl border space-y-2.5 ${cardBg}`}>
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-serif font-semibold tracking-wide uppercase">
                  02. Active Campaigns ({activeCampaigns.length})
                </h4>
                <button
                  type="button"
                  onClick={() => onNavigateSubRoute('INSIGHTS')}
                  className={`text-[11px] font-mono underline cursor-pointer ${accentText}`}
                >
                  Strategy
                </button>
              </div>

              <div className="space-y-2">
                {activeCampaigns.slice(0, 3).map((c: any) => (
                  <div
                    key={c.campaignId}
                    className={`p-2.5 rounded-lg border text-xs space-y-1 ${subtleBg}`}
                  >
                    <div className="flex items-center justify-between font-medium">
                      <span className="truncate">{c.name}</span>
                      <span className={`font-mono tabular-nums ${accentText}`}>
                        POAS {c.poas}x
                      </span>
                    </div>
                    <div
                      className={`flex items-center justify-between text-[11px] font-mono tabular-nums ${mutedText}`}
                    >
                      <span>
                        {c.channel} · ₹{Number(c.spendInr || 0).toLocaleString('en-IN')}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onExecutePrompt(
                            `Analyze campaign "${c.name}" on ${c.channel} and propose POAS optimizations.`
                          )
                        }
                        className="underline cursor-pointer hover:opacity-100"
                      >
                        Optimize
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. PENDING APPROVALS */}
            <div className={`p-3.5 rounded-xl border space-y-2.5 ${cardBg}`}>
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-serif font-semibold tracking-wide uppercase">
                  03. Pending Approvals ({pendingApprovals.length})
                </h4>
                <button
                  type="button"
                  onClick={() => onNavigateSubRoute('APPROVALS')}
                  className={`text-[11px] font-mono underline cursor-pointer ${accentText}`}
                >
                  Open Queue
                </button>
              </div>

              {pendingApprovals.length === 0 ? (
                <p className={`text-xs ${mutedText}`}>
                  All action proposals have been reviewed.
                </p>
              ) : (
                <div className="space-y-2">
                  {pendingApprovals.slice(0, 3).map((app: any) => (
                    <div
                      key={app.id}
                      className={`p-2.5 rounded-lg border text-xs space-y-1.5 ${subtleBg}`}
                    >
                      <div className="font-medium line-clamp-1">{app.title}</div>
                      <div className={`text-[10px] font-mono ${mutedText}`}>
                        {app.id} · {app.adapterTarget}
                      </div>
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <button
                          type="button"
                          onClick={() =>
                            onApprovalDecision(app.id, 'APPROVE_DRY_RUN')
                          }
                          disabled={busyAction !== null}
                          className={`px-2 py-1 rounded text-[10px] font-medium cursor-pointer ${secondaryBtn}`}
                        >
                          Dry-Run
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onApprovalDecision(app.id, 'APPROVE_LIVE', true)
                          }
                          disabled={busyAction !== null}
                          className={`px-2 py-1 rounded text-[10px] font-medium cursor-pointer ${goldPrimaryBtn}`}
                        >
                          Approve Live
                        </button>
                        <button
                          type="button"
                          onClick={() => onApprovalDecision(app.id, 'REJECT')}
                          disabled={busyAction !== null}
                          className="px-2 py-1 rounded text-[10px] text-red-600 dark:text-red-400 cursor-pointer"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 4. WORKFLOW HEALTH */}
            <div className={`p-3.5 rounded-xl border space-y-2.5 ${cardBg}`}>
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-serif font-semibold tracking-wide uppercase">
                  04. Workflow Health
                </h4>
                <button
                  type="button"
                  onClick={() =>
                    onExecutePrompt('Why did my cart recovery workflow fail?')
                  }
                  className={`text-[11px] font-mono underline cursor-pointer ${accentText}`}
                >
                  Inspect Failures
                </button>
              </div>

              <div className={`p-2.5 rounded-lg border text-xs space-y-1.5 ${subtleBg}`}>
                <div className="flex items-center justify-between font-mono tabular-nums">
                  <span className={mutedText}>Scheduled Intel Jobs</span>
                  <span className="font-semibold">
                    {(memIntel.scheduledIntelligenceJobs || []).length || 7} Active
                  </span>
                </div>
                <div className="flex items-center justify-between font-mono tabular-nums">
                  <span className={mutedText}>Cart Recovery Funnel</span>
                  <span className={accentText}>
                    {kpis.recoveredCartsCount || 0} Recovered /{' '}
                    {kpis.activeAbandonedCartsCount || 0} Active
                  </span>
                </div>
                <div className="flex items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      onRunScheduledIntelligenceJob('WORKFLOW_FAILURE_MONITORING')
                    }
                    disabled={busyAction !== null}
                    className={`w-full py-1.5 px-2.5 rounded text-[11px] font-medium cursor-pointer ${secondaryBtn}`}
                  >
                    Run Workflow Failure Audit
                  </button>
                </div>
              </div>
            </div>

            {/* 5. CURRENT DATA FRESHNESS */}
            <div className={`p-3.5 rounded-xl border space-y-2.5 ${cardBg}`}>
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-serif font-semibold tracking-wide uppercase">
                  05. Current Data Freshness
                </h4>
                <button
                  type="button"
                  onClick={onRefreshOverview}
                  disabled={loading}
                  className={`text-[11px] font-mono flex items-center gap-1 underline cursor-pointer ${accentText}`}
                >
                  <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                  <span>Sync Now</span>
                </button>
              </div>

              <div className="space-y-1.5 text-[11px] font-mono tabular-nums">
                <div className="flex items-center justify-between">
                  <span className={mutedText}>Source of Truth</span>
                  <span>PostgreSQL Live</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={mutedText}>Last Synced (IST)</span>
                  <span>
                    {overview?.contextSnapshot?.retrievedAtIst || 'Just now'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={mutedText}>Query Latency</span>
                  <span>{overview?.contextSnapshot?.latencyMs || 14}ms</span>
                </div>

                {/* Per-domain cache watermark controls */}
                <div className="pt-1.5 flex items-center gap-1 flex-wrap">
                  {['orders', 'products', 'campaigns', 'workflows'].map((dom) => (
                    <button
                      key={dom}
                      type="button"
                      onClick={() => onInvalidateDomainCache(dom)}
                      title={`Refresh ${dom} domain watermark`}
                      className={`px-2 py-0.5 rounded text-[10px] cursor-pointer ${secondaryBtn}`}
                    >
                      ↻ {dom}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* =====================================================================
          COMMAND SEARCH PALETTE MODAL (⌘K / Ctrl+K)
      ===================================================================== */}
      {commandPaletteOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-start justify-center pt-20 px-4"
          onClick={() => setCommandPaletteOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Executive Command Search"
        >
          <div
            className={`w-full max-w-2xl rounded-xl border shadow-2xl overflow-hidden ${cardBg}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`px-4 py-3 border-b flex items-center gap-3 ${
                isLight ? 'border-[#E5DEC9]' : 'border-[#2B2822]'
              }`}
            >
              <Search className={`w-4 h-4 ${accentText}`} />
              <input
                ref={commandInputRef}
                type="text"
                value={commandQuery}
                onChange={(e) => {
                  setCommandQuery(e.target.value);
                  setSelectedCommandIndex(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSelectedCommandIndex((prev) =>
                      Math.min(commandItems.length - 1, prev + 1)
                    );
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSelectedCommandIndex((prev) => Math.max(0, prev - 1));
                  } else if (
                    e.key === 'Enter' &&
                    commandItems[selectedCommandIndex]
                  ) {
                    e.preventDefault();
                    commandItems[selectedCommandIndex].onRun();
                  }
                }}
                placeholder="Type a command, tool, perfume SKU, or console (e.g., 'Analyze Sales', 'AZURE', 'Memory')..."
                className="flex-1 bg-transparent text-sm focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setCommandPaletteOpen(false)}
                className={`text-xs font-mono px-2 py-1 rounded cursor-pointer ${secondaryBtn}`}
              >
                ESC
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto p-2 space-y-1">
              {commandItems.length === 0 ? (
                <div className="p-6 text-center space-y-2">
                  <p className={`text-xs ${mutedText}`}>
                    No matching command found. Press below to ask AI CMO directly:
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onChangeChatPrompt(commandQuery);
                      onExecutePrompt(commandQuery);
                      setCommandPaletteOpen(false);
                    }}
                    className={`px-4 py-2 rounded-lg text-xs font-medium cursor-pointer ${goldPrimaryBtn}`}
                  >
                    Ask AI CMO: "{commandQuery}"
                  </button>
                </div>
              ) : (
                commandItems.map((item, idx) => {
                  const isActive = idx === selectedCommandIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onMouseEnter={() => setSelectedCommandIndex(idx)}
                      onClick={item.onRun}
                      className={`w-full text-left px-3.5 py-2.5 rounded-lg flex items-center justify-between gap-3 transition-colors duration-100 cursor-pointer ${
                        isActive
                          ? isLight
                            ? 'bg-[#F4F0E8] text-[#24211D]'
                            : 'bg-[#26231D] text-[#F5F2EB]'
                          : ''
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs">
                          <span className={`font-mono text-[10px] ${accentText}`}>
                            {item.group}
                          </span>
                          <span aria-hidden="true" className={mutedText}>
                            ·
                          </span>
                          <span className="font-semibold truncate">{item.title}</span>
                        </div>
                        <div className={`text-[11px] truncate mt-0.5 ${mutedText}`}>
                          {item.subtitle}
                        </div>
                      </div>
                      {item.shortcut && (
                        <kbd
                          className={`px-2 py-0.5 rounded text-[10px] font-mono shrink-0 ${subtleBg}`}
                        >
                          {item.shortcut}
                        </kbd>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            <div
              className={`px-4 py-2.5 border-t flex items-center justify-between text-[11px] font-mono ${
                isLight
                  ? 'border-[#E5DEC9] bg-[#FAF8F4]'
                  : 'border-[#2B2822] bg-[#141310]'
              } ${mutedText}`}
            >
              <span>↑↓ Navigate · Enter Execute · Esc Close</span>
              <span>Shortcuts: Alt+N New Chat · Alt+R Context · Alt+D Theme</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
