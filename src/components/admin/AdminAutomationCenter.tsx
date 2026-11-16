import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useStore } from '../../context/StoreContext';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  Cpu,
  Database,
  DollarSign,
  Eye,
  Filter,
  GitBranch,
  History,
  KeyRound,
  Layers,
  Link2,
  Lock,
  Mail,
  MessageSquare,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Send,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Tag,
  Terminal,
  Trash2,
  Truck,
  Users,
  Workflow,
  XCircle,
  Zap
} from 'lucide-react';
import { AdminCoupons } from './AdminCoupons';
import { AdminInfluencers } from './AdminInfluencers';
import { AdminProductionAuditAndInspector } from './AdminProductionAuditAndInspector';
import { AdminEnterpriseArchitectureAudit } from './AdminEnterpriseArchitectureAudit';

export type AutomationSubTab =
  | 'overview'
  | 'builder'
  | 'templates'
  | 'customer_journeys'
  | 'marketing'
  | 'order'
  | 'inventory'
  | 'shipping'
  | 'discovery'
  | 'influencer'
  | 'review_retention'
  | 'scheduled'
  | 'events'
  | 'history'
  | 'failed'
  | 'production_audit'
  | 'enterprise_audit'
  | 'integrations'
  | 'ai_recommendations'
  | 'settings';

interface WorkflowNode {
  id: string;
  category: 'TRIGGER' | 'CONDITION' | 'ACTION' | 'CONTROL';
  type: string;
  label: string;
  position: { x: number; y: number };
  config: Record<string, any>;
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  branch?: 'TRUE' | 'FALSE' | 'DEFAULT';
}

// Complete catalog of required Triggers (20), Conditions (13), Actions (14), and Control Nodes (7)
export const TRIGGER_CATALOG = [
  { type: 'customer.registered', label: 'Customer registered' },
  { type: 'customer.logged_in', label: 'Customer logged in' },
  { type: 'product.viewed', label: 'Product viewed' },
  { type: 'product.added_to_cart', label: 'Product added to cart' },
  { type: 'cart.abandoned', label: 'Cart abandoned' },
  { type: 'checkout.started', label: 'Checkout started' },
  { type: 'payment.succeeded', label: 'Payment succeeded' },
  { type: 'payment.failed', label: 'Payment failed' },
  { type: 'order.placed', label: 'Order placed' },
  { type: 'order.cancelled', label: 'Order cancelled' },
  { type: 'order.dispatched', label: 'Order dispatched' },
  { type: 'order.delivered', label: 'Order delivered' },
  { type: 'refund.completed', label: 'Refund completed' },
  { type: 'review.submitted', label: 'Review submitted' },
  { type: 'coupon.redeemed', label: 'Coupon redeemed' },
  { type: 'discovery.purchased', label: 'Discovery kit purchased' },
  { type: 'inventory.below_threshold', label: 'Inventory below threshold' },
  { type: 'vip.eligible', label: 'Customer reaches VIP eligibility' },
  { type: 'order.first_purchase', label: 'First purchase completed' },
  { type: 'order.repeat_purchase', label: 'Repeat customer order (2+)' },
  { type: 'customer.inactive', label: 'Inactive customer (45/60/90d)' },
  { type: 'customer.birthday', label: 'Customer birthday (voluntary)' },
  { type: 'customer.verified', label: 'Verified mobile / email' },
  { type: 'customer.visited', label: 'Customer visit tracked' },
  { type: 'wishlist.updated', label: 'Wishlist updated' },
  { type: 'return.requested', label: 'Order return requested' },
  { type: 'campaign.attributed', label: 'Campaign attribution captured' },
  { type: 'schedule.triggered', label: 'Scheduled date/time' },
  { type: 'webhook.received', label: 'Webhook received' }
];

export const CONDITION_CATALOG = [
  { type: 'logic_group', label: 'AND / OR logic' },
  { type: 'customer_segment', label: 'Customer segment' },
  { type: 'purchase_history', label: 'Purchase history' },
  { type: 'cart_value', label: 'Cart value' },
  { type: 'product_category', label: 'Product category' },
  { type: 'specific_sku', label: 'Specific SKU' },
  { type: 'order_status', label: 'Order status' },
  { type: 'customer_location', label: 'Customer location' },
  { type: 'campaign_source', label: 'Campaign source' },
  { type: 'coupon_eligibility', label: 'Coupon eligibility' },
  { type: 'inventory_availability', label: 'Inventory availability' },
  { type: 'communication_consent', label: 'Communication consent' },
  { type: 'previous_workflow_execution', label: 'Previous workflow execution' }
];

export const ACTION_CATALOG = [
  { type: 'send_whatsapp_template', label: 'Send approved WhatsApp template' },
  { type: 'send_transactional_email', label: 'Send transactional email' },
  { type: 'send_marketing_email', label: 'Send permitted marketing email' },
  { type: 'send_sms', label: 'Send SMS through configured provider' },
  { type: 'generate_coupon', label: 'Generate coupon' },
  { type: 'assign_customer_segment', label: 'Assign customer segment' },
  { type: 'create_admin_notification', label: 'Create admin notification' },
  { type: 'create_staff_task', label: 'Create staff task' },
  { type: 'update_order_status', label: 'Update order status through authorized transition' },
  { type: 'reserve_or_release_inventory', label: 'Reserve or release inventory' },
  { type: 'add_to_campaign_audience', label: 'Add customer to campaign audience' },
  { type: 'record_attribution_event', label: 'Record attribution event' },
  { type: 'trigger_external_webhook', label: 'Trigger authorized external webhook' },
  { type: 'create_ai_recommendation', label: 'Create AI-generated recommendation for approval' }
];

export const CONTROL_CATALOG = [
  { type: 'wait', label: 'Wait' },
  { type: 'delay_until', label: 'Delay until specific time' },
  { type: 'branch', label: 'Branch' },
  { type: 'exit', label: 'Exit' },
  { type: 'retry', label: 'Retry' },
  { type: 'stop_workflow', label: 'Stop workflow' },
  { type: 'request_admin_approval', label: 'Request admin approval' }
];

const SUB_TABS: { id: AutomationSubTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'builder', label: 'Workflow Builder' },
  { id: 'templates', label: 'Automation Templates' },
  { id: 'customer_journeys', label: 'Customer Journeys' },
  { id: 'marketing', label: 'Marketing Automation' },
  { id: 'order', label: 'Order Automation' },
  { id: 'inventory', label: 'Inventory Automation' },
  { id: 'shipping', label: 'Shipping Automation' },
  { id: 'discovery', label: 'Discovery Automation' },
  { id: 'influencer', label: 'Influencer Automation' },
  { id: 'review_retention', label: 'Review & Retention' },
  { id: 'scheduled', label: 'Scheduled Jobs' },
  { id: 'events', label: 'Event Inspector' },
  { id: 'history', label: 'Execution History' },
  { id: 'failed', label: 'Failed Jobs & DLQ' },
  { id: 'production_audit', label: 'Production Audit & Chaos Suite' },
  { id: 'enterprise_audit', label: 'E2E Architecture & 7 Journeys' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'ai_recommendations', label: 'AI Recommendations' },
  { id: 'settings', label: 'Automation Settings' }
];

interface Props {
  initialSubTab?: AutomationSubTab;
  onSubTabChange?: (sub: AutomationSubTab) => void;
}

export const AdminAutomationCenter: React.FC<Props> = ({
  initialSubTab = 'overview',
  onSubTabChange
}) => {
  const { customer, adminRole, showNotification } = useStore();
  const [subTab, setSubTab] = useState<AutomationSubTab>(initialSubTab);

  useEffect(() => {
    if (initialSubTab && initialSubTab !== subTab) {
      setSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  const handleTabSelect = (tab: AutomationSubTab) => {
    setSubTab(tab);
    if (onSubTabChange) onSubTabChange(tab);
  };

  // Core state hydrated from live PostgreSQL backend
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<any>(null);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [integrations, setIntegrations] = useState<any[]>([]);

  // Overview filters
  const [dateRangeFilter, setDateRangeFilter] = useState('30days');
  const [workflowFilter, setWorkflowFilter] = useState('ALL');
  const [channelFilter, setChannelFilter] = useState('ALL');
  const [segmentFilter, setSegmentFilter] = useState('ALL');
  const [eventTypeFilter, setEventTypeFilter] = useState('ALL');

  // Visual Workflow Builder state
  const [activeWorkflowId, setActiveWorkflowId] = useState<string>('');
  const [wfName, setWfName] = useState('Abandoned Cart Multi-Channel Recovery');
  const [wfDescription, setWfDescription] = useState(
    'Evaluates high-intent abandoned carts and executes consented recovery steps.'
  );
  const [wfCategory, setWfCategory] = useState('MARKETING');
  const [wfStatus, setWfStatus] = useState('DRAFT');
  const [wfTriggerType, setWfTriggerType] = useState('cart.abandoned');
  const [wfChannel, setWfChannel] = useState('WHATSAPP');
  const [wfSegment, setWfSegment] = useState('All Customers');
  const [wfMaxExecutions, setWfMaxExecutions] = useState<number>(0);
  const [wfAllowedRoles, setWfAllowedRoles] = useState<string[]>(['SUPER_ADMIN']);
  const [wfNodes, setWfNodes] = useState<WorkflowNode[]>([]);
  const [wfEdges, setWfEdges] = useState<WorkflowEdge[]>([]);
  const [wfVersionHistory, setWfVersionHistory] = useState<any[]>([]);
  const [wfVersion, setWfVersion] = useState<number>(1);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [versionModalOpen, setVersionModalOpen] = useState(false);

  // Dragging state on builder canvas
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [newEdgeSource, setNewEdgeSource] = useState<string>('');
  const [newEdgeTarget, setNewEdgeTarget] = useState<string>('');
  const [newEdgeBranch, setNewEdgeBranch] = useState<'DEFAULT' | 'TRUE' | 'FALSE'>('DEFAULT');

  // Modals / Inspectors
  const [selectedJobForLogs, setSelectedJobForLogs] = useState<any | null>(null);
  const [selectedEventForInspect, setSelectedEventForInspect] = useState<any | null>(null);
  const [customEventType, setCustomEventType] = useState('cart.abandoned');
  const [customEventEmail, setCustomEventEmail] = useState('gowisherharsha@gmail.com');
  const [customEventPayload, setCustomEventPayload] = useState(
    JSON.stringify({ cartValue: 4800, productCategory: 'Extrait de Parfum', consent: true }, null, 2)
  );
  const [verifyingProvider, setVerifyingProvider] = useState<string | null>(null);
  const [providerTestResults, setProviderTestResults] = useState<Record<string, any>>({});
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // New Schedule Form
  const [newSchedName, setNewSchedName] = useState('');
  const [newSchedCron, setNewSchedCron] = useState('0 10 * * *');
  const [newSchedWorkflowId, setNewSchedWorkflowId] = useState('');

  // Customer Lifecycle CRM & Customer 360 State
  const [crmCustomers, setCrmCustomers] = useState<any[]>([]);
  const [crmAnalytics, setCrmAnalytics] = useState<any | null>(null);
  const [crmSegmentFilter, setCrmSegmentFilter] = useState<string>('ALL');
  const [crmSearchQuery, setCrmSearchQuery] = useState<string>('');
  const [selectedCustomer360, setSelectedCustomer360] = useState<any | null>(null);
  const [isRecalculatingCrm, setIsRecalculatingCrm] = useState<boolean>(false);
  const [newSupportIssueText, setNewSupportIssueText] = useState<string>('');

  const DYNAMIC_SEGMENTS_LIST = [
    'New registered customers',
    'Visitors without purchases',
    'First-time buyers',
    'Repeat buyers',
    'High-value customers',
    'VIP customers',
    'Discovery buyers',
    'Signature fragrance buyers',
    'Devotional fragrance buyers',
    'Inactive customers',
    'Abandoned checkout customers',
    'Customers eligible for replenishment',
    'Customers with unresolved complaints',
    'Customers with unused vouchers'
  ];

  const getAuthHeaders = useCallback(() => {
    return {
      'Content-Type': 'application/json',
      'x-admin-role': adminRole || 'SUPER_ADMIN',
      'x-admin-email': customer?.email || 'gowisherharsha@gmail.com'
    };
  }, [adminRole, customer]);

  const fetchCrmCustomers = useCallback(async () => {
    try {
      const res = await fetch('/api/automation/crm/customers', {
        headers: getAuthHeaders()
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.customers)) {
        setCrmCustomers(data.customers);
        if (selectedCustomer360) {
          const refreshed = data.customers.find((c: any) => c.id === selectedCustomer360.id);
          if (refreshed) setSelectedCustomer360(refreshed);
        }
      }
      if (data.analytics) {
        setCrmAnalytics(data.analytics);
      }
    } catch (err: any) {
      console.warn('[CRM Fetch]', err.message);
    }
  }, [getAuthHeaders, selectedCustomer360]);

  const handleUpdateCustomerConsent = async (
    custId: string,
    updates: Record<string, any>
  ) => {
    try {
      const res = await fetch(`/api/automation/crm/customers/${custId}/consent`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update customer CRM profile');
      if (data.customer) {
        setSelectedCustomer360(data.customer);
      }
      await fetchCrmCustomers();
      showNotification(
        data.cancelledCampaignJobs > 0
          ? `Customer preferences saved. Stopped ${data.cancelledCampaignJobs} active promotional campaign job(s).`
          : 'Customer 360 consent & lifecycle profile synchronized.'
      );
    } catch (err: any) {
      showNotification(`Error: ${err.message}`);
    }
  };

  const handleRecalculateAllCrm = async (customerId?: string) => {
    setIsRecalculatingCrm(true);
    try {
      const res = await fetch('/api/automation/crm/recalculate', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(customerId ? { customerId } : {})
      });
      if (!res.ok) throw new Error('Recalculation failed');
      await fetchCrmCustomers();
      showNotification('VIP status (₹5,000 net rule) & all 14 dynamic segments recalculated from live database.');
    } catch (err: any) {
      showNotification(`Error: ${err.message}`);
    } finally {
      setIsRecalculatingCrm(false);
    }
  };

  const fetchAutomationOverview = useCallback(async () => {
    try {
      const qs = new URLSearchParams({
        dateRange: dateRangeFilter,
        workflowId: workflowFilter,
        channel: channelFilter,
        segment: segmentFilter,
        eventType: eventTypeFilter
      }).toString();

      const res = await fetch(`/api/automation/overview?${qs}`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Failed to load Automation Center telemetry');
      const data = await res.json();

      setKpis(data.kpis);
      setWorkflows(data.workflows || []);
      setRecentEvents(data.recentEvents || []);
      setRecentJobs(data.recentJobs || []);
      setSchedules(data.schedules || []);
      setApprovals(data.approvals || []);
      setRecommendations(data.recommendations || []);
      setSettings(data.settings || null);
      setIntegrations(data.integrations || []);

      // Load first workflow into builder if none selected yet
      if (!activeWorkflowId && Array.isArray(data.workflows) && data.workflows.length > 0) {
        loadWorkflowIntoBuilder(data.workflows[0]);
      }
    } catch (err: any) {
      console.warn('[Automation Center Fetch]', err.message);
    } finally {
      setLoading(false);
    }
  }, [
    dateRangeFilter,
    workflowFilter,
    channelFilter,
    segmentFilter,
    eventTypeFilter,
    activeWorkflowId,
    getAuthHeaders
  ]);

  useEffect(() => {
    fetchAutomationOverview();
    fetchCrmCustomers();
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchAutomationOverview();
      fetchCrmCustomers();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchAutomationOverview, fetchCrmCustomers]);

  const loadWorkflowIntoBuilder = (wf: any) => {
    setActiveWorkflowId(wf.id);
    setWfName(wf.name || 'Untitled Workflow');
    setWfDescription(wf.description || '');
    setWfCategory(wf.category || 'MARKETING');
    setWfStatus(wf.status || 'DRAFT');
    setWfTriggerType(wf.triggerType || 'order.placed');
    setWfChannel(wf.channel || 'INTERNAL');
    setWfSegment(wf.segment || 'All Customers');
    setWfMaxExecutions(Number(wf.maxExecutions) || 0);
    setWfAllowedRoles(Array.isArray(wf.allowedRoles) ? wf.allowedRoles : ['SUPER_ADMIN']);
    setWfNodes(Array.isArray(wf.nodes) ? wf.nodes : []);
    setWfEdges(Array.isArray(wf.edges) ? wf.edges : []);
    setWfVersionHistory(Array.isArray(wf.versionHistory) ? wf.versionHistory : []);
    setWfVersion(Number(wf.version) || 1);
    setSelectedNodeId(Array.isArray(wf.nodes) && wf.nodes[0] ? wf.nodes[0].id : null);
  };

  const createBlankWorkflow = () => {
    const newId = `wf-custom-${Date.now().toString(36)}`;
    const triggerNode: WorkflowNode = {
      id: 'n-trigger-1',
      category: 'TRIGGER',
      type: 'order.placed',
      label: 'Order placed',
      position: { x: 60, y: 140 },
      config: {}
    };
    const condNode: WorkflowNode = {
      id: 'n-cond-1',
      category: 'CONDITION',
      type: 'cart_value',
      label: 'Order Value >= ₹2,500',
      position: { x: 350, y: 140 },
      config: { operator: 'gte', minAmount: 2500, logicOperator: 'AND' }
    };
    const actionNode: WorkflowNode = {
      id: 'n-act-1',
      category: 'ACTION',
      type: 'create_admin_notification',
      label: 'Create Admin Notification',
      position: { x: 650, y: 140 },
      config: { message: 'High-value order placed and verified by workflow.' }
    };
    setActiveWorkflowId(newId);
    setWfName('New Custom FRAGMORÉ Workflow');
    setWfDescription('Custom multi-step DAG automation.');
    setWfCategory('ORDER');
    setWfStatus('DRAFT');
    setWfTriggerType('order.placed');
    setWfChannel('INTERNAL');
    setWfSegment('All Customers');
    setWfMaxExecutions(0);
    setWfAllowedRoles(['SUPER_ADMIN']);
    setWfNodes([triggerNode, condNode, actionNode]);
    setWfEdges([
      { id: 'e-1', source: 'n-trigger-1', target: 'n-cond-1' },
      { id: 'e-2', source: 'n-cond-1', target: 'n-act-1', branch: 'TRUE' }
    ]);
    setWfVersion(1);
    setWfVersionHistory([]);
    setSelectedNodeId(triggerNode.id);
    handleTabSelect('builder');
  };

  // Add node from catalog to visual builder canvas
  const handleAddNodeToCanvas = (
    category: 'TRIGGER' | 'CONDITION' | 'ACTION' | 'CONTROL',
    type: string,
    label: string
  ) => {
    const newNodeId = `node-${Date.now().toString(36).slice(-4)}-${Math.random().toString(36).slice(2, 5)}`;
    const offsetIndex = wfNodes.length;
    const defaultConfig: Record<string, any> = {};

    if (category === 'TRIGGER') {
      setWfTriggerType(type);
    }
    if (type === 'cart_value' || type === 'purchase_history') {
      defaultConfig.operator = 'gte';
      defaultConfig.minAmount = 2000;
    } else if (type === 'generate_coupon') {
      defaultConfig.prefix = 'FRAG';
      defaultConfig.discountType = 'PERCENTAGE';
      defaultConfig.value = 10;
      defaultConfig.minOrderValue = 1500;
    } else if (type === 'wait') {
      defaultConfig.durationSeconds = 60;
    } else if (type === 'assign_customer_segment') {
      defaultConfig.segment = 'VIP Collector';
    } else if (type === 'create_admin_notification') {
      defaultConfig.message = `Executed ${label}`;
    }

    const newNode: WorkflowNode = {
      id: newNodeId,
      category,
      type,
      label,
      position: {
        x: Math.min(760, 80 + (offsetIndex % 4) * 230),
        y: 80 + Math.floor(offsetIndex / 4) * 130
      },
      config: defaultConfig
    };

    setWfNodes((prev) => {
      const next = [...prev, newNode];
      if (prev.length > 0) {
        const lastNode = prev[prev.length - 1];
        setWfEdges((edges) => [
          ...edges,
          {
            id: `edge-${Date.now().toString(36)}`,
            source: lastNode.id,
            target: newNode.id,
            branch: lastNode.category === 'CONDITION' ? 'TRUE' : 'DEFAULT'
          }
        ]);
      }
      return next;
    });
    setSelectedNodeId(newNodeId);
  };

  // Dragging nodes on canvas
  const handleNodeMouseDown = (e: React.MouseEvent, node: WorkflowNode) => {
    e.stopPropagation();
    setSelectedNodeId(node.id);
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setDraggingNodeId(node.id);
    setDragOffset({
      x: e.clientX - rect.left - node.position.x,
      y: e.clientY - rect.top - node.position.y
    });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!draggingNodeId || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const nextX = Math.max(16, Math.min(rect.width - 210, Math.round(e.clientX - rect.left - dragOffset.x)));
    const nextY = Math.max(16, Math.min(rect.height - 90, Math.round(e.clientY - rect.top - dragOffset.y)));
    setWfNodes((prev) =>
      prev.map((n) => (n.id === draggingNodeId ? { ...n, position: { x: nextX, y: nextY } } : n))
    );
  };

  const handleCanvasMouseUp = () => {
    setDraggingNodeId(null);
  };

  // Save or Publish workflow to PostgreSQL backend
  const handleSaveWorkflow = async (desiredStatus?: string) => {
    try {
      const res = await fetch('/api/automation/workflows', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          id: activeWorkflowId || undefined,
          name: wfName,
          description: wfDescription,
          category: wfCategory,
          status: desiredStatus || wfStatus,
          triggerType: wfTriggerType,
          channel: wfChannel,
          segment: wfSegment,
          maxExecutions: wfMaxExecutions,
          allowedRoles: wfAllowedRoles,
          nodes: wfNodes,
          edges: wfEdges,
          changeNote: desiredStatus === 'ACTIVE' ? 'Published workflow' : 'Saved workflow configuration'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save workflow');

      loadWorkflowIntoBuilder(data.workflow);
      await fetchAutomationOverview();

      if (data.governance?.requiresApproval && desiredStatus === 'ACTIVE') {
        showNotification(
          `Governance Gate: Workflow requires Super Admin approval (${data.governance.reasons.join('; ')}). Queued in Approvals.`
        );
      } else {
        showNotification(`Workflow "${data.workflow.name}" persisted (v${data.workflow.version}).`);
      }
    } catch (err: any) {
      showNotification(`Error: ${err.message}`);
    }
  };

  const handleWorkflowStatusChange = async (workflowId: string, status: string) => {
    try {
      const res = await fetch(`/api/automation/workflows/${workflowId}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Status update failed');
      if (workflowId === activeWorkflowId) {
        setWfStatus(data.status);
      }
      await fetchAutomationOverview();
      if (data.status === 'PENDING_APPROVAL') {
        showNotification('Workflow queued for Super Admin Governance Approval before activation.');
      } else {
        showNotification(`Workflow status updated to ${data.status}.`);
      }
    } catch (err: any) {
      showNotification(`Error: ${err.message}`);
    }
  };

  const handleDuplicateWorkflow = async (workflowId: string) => {
    try {
      const res = await fetch(`/api/automation/workflows/${workflowId}/duplicate`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Duplicate failed');
      await fetchAutomationOverview();
      loadWorkflowIntoBuilder(data.workflow);
      handleTabSelect('builder');
      showNotification(`Duplicated as "${data.workflow.name}".`);
    } catch (err: any) {
      showNotification(`Error: ${err.message}`);
    }
  };

  const handleRollbackWorkflow = async (targetVersion: number) => {
    if (!activeWorkflowId) return;
    try {
      const res = await fetch(`/api/automation/workflows/${activeWorkflowId}/rollback`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ version: targetVersion })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Rollback failed');
      loadWorkflowIntoBuilder(data.workflow);
      setVersionModalOpen(false);
      await fetchAutomationOverview();
      showNotification(`Rolled back workflow to snapshot v${targetVersion}.`);
    } catch (err: any) {
      showNotification(`Error: ${err.message}`);
    }
  };

  const handleTestWorkflowRun = async (workflowId: string) => {
    try {
      const res = await fetch(`/api/automation/workflows/${workflowId}/test`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          payload: {
            customerEmail: customer?.email || 'gowisherharsha@gmail.com',
            cartValue: 4800,
            totalAmount: 4800,
            productCategory: 'Extrait de Parfum',
            stockAvailable: 12,
            rating: 5,
            consent: true
          }
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Test execution failed');
      await fetchAutomationOverview();
      if (data.job) {
        setSelectedJobForLogs(data.job);
      }
      showNotification(
        `Real backend test run finished with status: ${data.execution?.status || 'COMPLETED'}.`
      );
    } catch (err: any) {
      showNotification(`Error: ${err.message}`);
    }
  };

  const handleReprocessJob = async (jobId: string) => {
    try {
      const res = await fetch(`/api/automation/jobs/${jobId}/reprocess`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reprocess failed');
      await fetchAutomationOverview();
      showNotification(`Job ${jobId} reprocessed on backend (${data.result?.status || 'COMPLETED'}).`);
    } catch (err: any) {
      showNotification(`Error: ${err.message}`);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      const res = await fetch(`/api/automation/jobs/${jobId}/cancel`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Cancel failed');
      await fetchAutomationOverview();
      showNotification(`Job ${jobId} cancelled.`);
    } catch (err: any) {
      showNotification(`Error: ${err.message}`);
    }
  };

  const handleApprovalDecision = async (approvalId: string, decision: 'APPROVED' | 'REJECTED') => {
    try {
      const res = await fetch(`/api/automation/approvals/${approvalId}/decision`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ decision })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Decision failed');
      await fetchAutomationOverview();
      showNotification(`Governance request ${decision.toLowerCase()}.`);
    } catch (err: any) {
      showNotification(`Error: ${err.message}`);
    }
  };

  const handleDispatchLiveEvent = async () => {
    try {
      let parsedPayload: Record<string, any> = {};
      try {
        parsedPayload = JSON.parse(customEventPayload || '{}');
      } catch {
        throw new Error('Event payload must be valid JSON.');
      }
      const res = await fetch('/api/automation/events', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          eventType: customEventType,
          source: 'admin_event_inspector',
          idempotencyKey: `manual_${customEventType}_${Date.now()}`,
          customerEmail: customEventEmail,
          payload: {
            ...parsedPayload,
            customerEmail: customEventEmail
          }
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Event dispatch failed');
      await fetchAutomationOverview();
      showNotification(
        `Event "${customEventType}" persisted (${data.eventId}) & queued ${data.jobsCreated || 0} workflow job(s).`
      );
    } catch (err: any) {
      showNotification(`Error: ${err.message}`);
    }
  };

  const handleVerifyIntegration = async (providerId: string) => {
    setVerifyingProvider(providerId);
    try {
      const res = await fetch('/api/automation/integrations/verify', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ providerId })
      });
      const data = await res.json();
      setProviderTestResults((prev) => ({ ...prev, [providerId]: data }));
      await fetchAutomationOverview();
      showNotification(`${providerId.toUpperCase()}: ${data.detail}`);
    } catch (err: any) {
      showNotification(`Verification failed: ${err.message}`);
    } finally {
      setVerifyingProvider(null);
    }
  };

  const handleGenerateAiRecommendations = async () => {
    setIsGeneratingAi(true);
    try {
      const res = await fetch('/api/automation/ai-recommendations/generate', {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI generation failed');
      await fetchAutomationOverview();
      showNotification('Generated new AI workflow optimization from live database metrics.');
    } catch (err: any) {
      showNotification(`Error: ${err.message}`);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleAiRecommendationDecision = async (recId: string, decision: 'APPROVED' | 'REJECTED') => {
    try {
      const res = await fetch(`/api/automation/ai-recommendations/${recId}/decision`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ decision })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update recommendation');
      await fetchAutomationOverview();
      showNotification(
        decision === 'APPROVED'
          ? 'AI Recommendation approved and converted into a Draft Workflow in Builder.'
          : 'AI Recommendation dismissed.'
      );
    } catch (err: any) {
      showNotification(`Error: ${err.message}`);
    }
  };

  const handleCreateSchedule = async () => {
    if (!newSchedName.trim()) {
      showNotification('Please provide a schedule name.');
      return;
    }
    try {
      const res = await fetch('/api/automation/schedules', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: newSchedName.trim(),
          workflowId: newSchedWorkflowId || (workflows[0]?.id ?? null),
          cronExpression: newSchedCron,
          timezone: 'Asia/Kolkata',
          status: 'ACTIVE'
        })
      });
      if (!res.ok) throw new Error('Failed to create scheduled job');
      setNewSchedName('');
      await fetchAutomationOverview();
      showNotification('Scheduled job persisted with Asia/Kolkata timezone.');
    } catch (err: any) {
      showNotification(`Error: ${err.message}`);
    }
  };

  const handleRunScheduleNow = async (schedId: string) => {
    try {
      const res = await fetch(`/api/automation/schedules/${schedId}/run`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Failed to run scheduled task');
      await fetchAutomationOverview();
      showNotification('Scheduled task executed on backend.');
    } catch (err: any) {
      showNotification(`Error: ${err.message}`);
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    try {
      const res = await fetch('/api/automation/settings', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save settings');
      setSettings(data.settings);
      showNotification('Automation Engine & Governance Settings saved to PostgreSQL.');
    } catch (err: any) {
      showNotification(`Error: ${err.message}`);
    }
  };

  const handlePurgeRetention = async () => {
    try {
      const res = await fetch('/api/automation/retention/purge', {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Retention purge failed');
      await fetchAutomationOverview();
      showNotification(`Data retention check complete (cutoff: ${new Date(data.cutoffDate).toLocaleDateString()}).`);
    } catch (err: any) {
      showNotification(`Error: ${err.message}`);
    }
  };

  const selectedNode = wfNodes.find((n) => n.id === selectedNodeId) || null;

  // Helper to render domain-specific views (Customer Journeys, Marketing, Order, Inventory, Shipping, Discovery, Influencer, Review & Retention)
  const renderDomainAutomationView = (
    domainCategory: string,
    title: string,
    subtitle: string,
    recommendedTrigger: string
  ) => {
    const domainWorkflows = workflows.filter(
      (w) => String(w.category || '').toUpperCase() === domainCategory.toUpperCase()
    );
    const domainJobs = recentJobs.filter((j) =>
      domainWorkflows.some((w) => w.id === j.workflowId)
    );

    return (
      <div className="space-y-6">
        <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#9A783E] font-bold">
              FRAGMORÉ DOMAIN AUTOMATION • {domainCategory}
            </span>
            <h3 className="font-serif text-xl uppercase tracking-wider text-[#24211D] mt-1">
              {title}
            </h3>
            <p className="text-xs text-[#686158] mt-1">{subtitle}</p>
          </div>
          <button
            onClick={() => {
              createBlankWorkflow();
              setWfCategory(domainCategory);
              setWfTriggerType(recommendedTrigger);
              setWfName(`${title} Workflow`);
            }}
            className="px-4 py-2.5 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] rounded-lg text-xs font-mono uppercase tracking-wider font-bold flex items-center gap-2 shrink-0 cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New {domainCategory} Workflow</span>
          </button>
        </div>

        {/* Domain Workflows */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {domainWorkflows.map((wf) => (
            <div
              key={wf.id}
              className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl p-5 space-y-4 shadow-2xs"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                        wf.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : wf.status === 'PENDING_APPROVAL'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-[#F1EDE5] text-[#686158] border border-[#DED7CC]'
                      }`}
                    >
                      {wf.status}
                    </span>
                    <span className="text-[10px] font-mono text-[#9A783E] font-bold">
                      v{wf.version || 1} • Trigger: {wf.triggerType}
                    </span>
                  </div>
                  <h4 className="font-serif text-base uppercase tracking-wider text-[#24211D] mt-2 font-semibold">
                    {wf.name}
                  </h4>
                  <p className="text-xs text-[#686158] mt-1">{wf.description}</p>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 pt-2 border-t border-[#DED7CC] text-center">
                <div className="p-2 bg-[#FAF8F4] rounded-lg">
                  <div className="text-[10px] text-[#686158]">Nodes</div>
                  <div className="text-sm font-bold text-[#24211D]">
                    {Array.isArray(wf.nodes) ? wf.nodes.length : 0}
                  </div>
                </div>
                <div className="p-2 bg-[#FAF8F4] rounded-lg">
                  <div className="text-[10px] text-[#686158]">Runs</div>
                  <div className="text-sm font-bold text-[#24211D]">{wf.executionCount || 0}</div>
                </div>
                <div className="p-2 bg-[#FAF8F4] rounded-lg">
                  <div className="text-[10px] text-[#686158]">Succeeded</div>
                  <div className="text-sm font-bold text-emerald-700">{wf.successCount || 0}</div>
                </div>
                <div className="p-2 bg-[#FAF8F4] rounded-lg">
                  <div className="text-[10px] text-[#686158]">Revenue</div>
                  <div className="text-sm font-bold text-[#9A783E]">
                    ₹{Number(wf.revenueAttributed || 0).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2">
                <button
                  onClick={() => {
                    loadWorkflowIntoBuilder(wf);
                    handleTabSelect('builder');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#24211D] text-[#FAF8F4] text-[11px] font-mono font-bold hover:bg-[#9A783E] transition-colors cursor-pointer"
                >
                  Open in Builder
                </button>
                <button
                  onClick={() => handleTestWorkflowRun(wf.id)}
                  className="px-3 py-1.5 rounded-lg bg-[#F1EDE5] border border-[#DED7CC] text-[#24211D] text-[11px] font-mono font-bold hover:border-[#9A783E] cursor-pointer"
                >
                  Run Backend Test
                </button>
                {wf.status === 'ACTIVE' ? (
                  <button
                    onClick={() => handleWorkflowStatusChange(wf.id, 'PAUSED')}
                    className="px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-[11px] font-mono font-bold cursor-pointer"
                  >
                    Pause
                  </button>
                ) : (
                  <button
                    onClick={() => handleWorkflowStatusChange(wf.id, 'ACTIVE')}
                    className="px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 text-[11px] font-mono font-bold cursor-pointer"
                  >
                    Activate
                  </button>
                )}
                <button
                  onClick={() => handleDuplicateWorkflow(wf.id)}
                  className="px-3 py-1.5 rounded-lg bg-[#FAF8F4] border border-[#DED7CC] text-[#686158] text-[11px] font-mono hover:text-[#24211D] cursor-pointer"
                >
                  Duplicate
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Recent Domain Executions */}
        <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl p-5 space-y-3">
          <h4 className="font-serif text-sm uppercase tracking-wider text-[#24211D] font-semibold">
            Recent {title} Backend Executions ({domainJobs.length})
          </h4>
          {domainJobs.length === 0 ? (
            <p className="text-xs text-[#686158] py-4">
              No executions recorded yet for this domain. Click &ldquo;Run Backend Test&rdquo; above or trigger a live storefront event.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-[#DED7CC] text-[10px] uppercase text-[#686158]">
                    <th className="py-2">Job ID</th>
                    <th className="py-2">Workflow</th>
                    <th className="py-2">Trigger Event</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Latency</th>
                    <th className="py-2 text-right">Step Trace</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DED7CC]">
                  {domainJobs.slice(0, 10).map((job) => (
                    <tr key={job.id} className="hover:bg-[#FAF8F4]">
                      <td className="py-2.5 font-bold text-[#24211D]">{job.id}</td>
                      <td className="py-2.5 text-[#24211D]">{job.workflowName}</td>
                      <td className="py-2.5 text-[#9A783E]">{job.triggerType}</td>
                      <td className="py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            job.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-700'
                              : job.status === 'FAILED' || job.status === 'DEAD_LETTER'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {job.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-[#686158]">{job.latencyMs || 0} ms</td>
                      <td className="py-2.5 text-right">
                        <button
                          onClick={() => setSelectedJobForLogs(job)}
                          className="text-[#9A783E] hover:underline font-bold cursor-pointer"
                        >
                          Inspect Trace
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-mono text-xs text-[#24211D]">
      {/* TOP HEADER & SUB-NAVIGATION BAR */}
      <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl p-5 space-y-4 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#DED7CC] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-[#F1EDE5] border border-[#DED7CC] text-[#9A783E] text-[10px] font-bold uppercase tracking-widest">
                Enterprise Event &amp; DAG Queue Engine
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-emerald-700 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                PostgreSQL Worker Active (Asia/Kolkata)
              </span>
            </div>
            <h2 className="font-serif text-2xl sm:text-3xl tracking-wider uppercase font-normal text-[#24211D] mt-1">
              FRAGMORÉ Automation Center
            </h2>
            <p className="text-xs text-[#686158]">
              Durable server-side workflow orchestration, idempotent event ingestion, and RBAC governance.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={fetchAutomationOverview}
              className="px-3 py-2 rounded-lg border border-[#DED7CC] bg-[#FAF8F4] hover:border-[#9A783E] text-[#24211D] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#9A783E]" />
              <span>Sync Telemetry</span>
            </button>
            <button
              onClick={createBlankWorkflow}
              className="px-4 py-2 rounded-lg bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Workflow</span>
            </button>
          </div>
        </div>

        {/* 18 SUB-MODULE PILLS */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {SUB_TABS.map((tab) => {
            const isActive = subTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabSelect(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-mono whitespace-nowrap transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#24211D] text-[#FAF8F4] font-bold shadow-2xs'
                    : 'bg-[#FAF8F4] text-[#686158] hover:text-[#24211D] border border-[#DED7CC]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 1. OVERVIEW DASHBOARD (15 LIVE KPIs + 5 FILTERS + APPROVALS QUEUE)   */}
      {/* ===================================================================== */}
      {subTab === 'overview' && (
        <div className="space-y-6">
          {/* 5 Filters Bar */}
          <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="text-[10px] uppercase text-[#686158] block mb-1 font-semibold">
                1. Date Window
              </label>
              <select
                value={dateRangeFilter}
                onChange={(e) => setDateRangeFilter(e.target.value)}
                className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-2.5 py-1.5 text-xs text-[#24211D]"
              >
                <option value="today">Today (IST)</option>
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
                <option value="lifetime">All Time Ledger</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase text-[#686158] block mb-1 font-semibold">
                2. Workflow
              </label>
              <select
                value={workflowFilter}
                onChange={(e) => setWorkflowFilter(e.target.value)}
                className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-2.5 py-1.5 text-xs text-[#24211D]"
              >
                <option value="ALL">All Workflows ({workflows.length})</option>
                {workflows.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase text-[#686158] block mb-1 font-semibold">
                3. Channel
              </label>
              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
                className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-2.5 py-1.5 text-xs text-[#24211D]"
              >
                <option value="ALL">All Channels</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="EMAIL">Email</option>
                <option value="SMS">SMS</option>
                <option value="INTERNAL">Internal ERP</option>
                <option value="WEBHOOK">Webhook</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase text-[#686158] block mb-1 font-semibold">
                4. Customer Segment
              </label>
              <select
                value={segmentFilter}
                onChange={(e) => setSegmentFilter(e.target.value)}
                className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-2.5 py-1.5 text-xs text-[#24211D]"
              >
                <option value="ALL">All Segments</option>
                <option value="New Customers">New Customers</option>
                <option value="VIP Collector">VIP Collector</option>
                <option value="Discovery Buyers">Discovery Buyers</option>
                <option value="High Intent Cart">High Intent Cart</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase text-[#686158] block mb-1 font-semibold">
                5. Event Type
              </label>
              <select
                value={eventTypeFilter}
                onChange={(e) => setEventTypeFilter(e.target.value)}
                className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-2.5 py-1.5 text-xs text-[#24211D]"
              >
                <option value="ALL">All 20 Event Types</option>
                {TRIGGER_CATALOG.map((t) => (
                  <option key={t.type} value={t.type}>
                    {t.label} ({t.type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Pending Governance Approvals Alert Banner */}
          {approvals.filter((a) => a.status === 'PENDING').length > 0 && (
            <div className="bg-amber-50/90 border border-amber-300 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-900 font-bold">
                  <ShieldAlert className="w-4 h-4 text-amber-700" />
                  <span>
                    Super Admin Security &amp; Governance Approval Required (
                    {approvals.filter((a) => a.status === 'PENDING').length})
                  </span>
                </div>
                <span className="text-[10px] uppercase font-bold text-amber-800">
                  High-Impact Action Gate
                </span>
              </div>
              <div className="space-y-2">
                {approvals
                  .filter((a) => a.status === 'PENDING')
                  .map((app) => (
                    <div
                      key={app.id}
                      className="bg-[#FFFFFF] border border-amber-200 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="font-bold text-[#24211D]">{app.workflowName}</div>
                        <div className="text-[11px] text-[#686158]">{app.reason}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleApprovalDecision(app.id, 'APPROVED')}
                          className="px-3 py-1.5 rounded bg-emerald-700 text-white text-[11px] font-bold hover:bg-emerald-800 cursor-pointer"
                        >
                          Approve &amp; Authorize
                        </button>
                        <button
                          onClick={() => handleApprovalDecision(app.id, 'REJECTED')}
                          className="px-3 py-1.5 rounded bg-rose-100 text-rose-800 text-[11px] font-bold hover:bg-rose-200 cursor-pointer"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* 15 REQUIRED KPI TILES GRID */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              {
                label: '1. Active Workflows',
                value: kpis?.totalActiveWorkflows ?? 0,
                sub: 'Live in production',
                tone: 'text-emerald-700'
              },
              {
                label: '2. Paused Workflows',
                value: kpis?.pausedWorkflows ?? 0,
                sub: 'Draft or paused',
                tone: 'text-[#686158]'
              },
              {
                label: '3. Executed Today',
                value: kpis?.automationsExecutedToday ?? 0,
                sub: 'IST 24h cycle',
                tone: 'text-[#24211D]'
              },
              {
                label: '4. Successful Executions',
                value: kpis?.successfulExecutions ?? 0,
                sub: 'Verified completions',
                tone: 'text-emerald-700'
              },
              {
                label: '5. Failed Executions',
                value: kpis?.failedExecutions ?? 0,
                sub: 'Includes DLQ items',
                tone: 'text-rose-600'
              },
              {
                label: '6. Pending Executions',
                value: kpis?.pendingExecutions ?? 0,
                sub: 'Queued / waiting',
                tone: 'text-amber-700'
              },
              {
                label: '7. Recovered Cart Rev',
                value: `₹${Number(kpis?.recoveredAbandonedCartRevenue ?? 0).toLocaleString('en-IN')}`,
                sub: 'Actual DB recovery',
                tone: 'text-[#9A783E]'
              },
              {
                label: '8. Attributed Revenue',
                value: `₹${Number(kpis?.automationAttributedRevenue ?? 0).toLocaleString('en-IN')}`,
                sub: 'Workflow-linked orders',
                tone: 'text-[#9A783E]'
              },
              {
                label: '9. Messages Sent',
                value: kpis?.messagesSent ?? 0,
                sub: 'Across all channels',
                tone: 'text-[#24211D]'
              },
              {
                label: '10. Delivery / Fail Rate',
                value: `${kpis?.deliveryRate ?? 100}% / ${kpis?.failureRate ?? 0}%`,
                sub: 'Provider callbacks',
                tone: 'text-emerald-700'
              },
              {
                label: '11. Coupon Redemptions',
                value: kpis?.couponRedemptions ?? 0,
                sub: 'Automation vouchers',
                tone: 'text-[#9A783E]'
              },
              {
                label: '12. Execution Cost',
                value: `₹${Number(kpis?.workflowExecutionCost ?? 0).toFixed(2)}`,
                sub: 'Compute & messaging',
                tone: 'text-[#24211D]'
              },
              {
                label: '13. Avg Latency',
                value: `${kpis?.averageProcessingLatencyMs ?? 0} ms`,
                sub: 'Server DAG step time',
                tone: 'text-[#24211D]'
              },
              {
                label: '14. Generated Orders',
                value: kpis?.automationGeneratedOrders ?? 0,
                sub: 'Direct conversions',
                tone: 'text-emerald-700'
              },
              {
                label: '15. Customer Retention',
                value: `${kpis?.customerRetentionPerformance ?? 0}%`,
                sub: 'Repeat connoisseurs',
                tone: 'text-[#9A783E]'
              }
            ].map((tile) => (
              <div
                key={tile.label}
                className="p-4 rounded-xl bg-[#FFFFFF] border border-[#DED7CC] space-y-1 shadow-2xs"
              >
                <div className="text-[10px] uppercase text-[#686158] font-semibold">
                  {tile.label}
                </div>
                <div className={`text-xl font-bold tabular-nums ${tile.tone}`}>{tile.value}</div>
                <div className="text-[10px] text-[#686158]">{tile.sub}</div>
              </div>
            ))}
          </div>

          {/* Active Workflows Table & Quick Operations */}
          <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl p-6 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[#DED7CC] pb-3">
              <div>
                <h3 className="font-serif text-base uppercase tracking-wider text-[#24211D] font-semibold">
                  Centralized Workflows Registry ({workflows.length})
                </h3>
                <p className="text-[11px] text-[#686158]">
                  Persisted in PostgreSQL `automation_workflows` — continues running across logouts and restarts.
                </p>
              </div>
              <button
                onClick={() => handleTabSelect('builder')}
                className="text-xs text-[#9A783E] font-bold hover:underline cursor-pointer"
              >
                Open Visual DAG Editor →
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#DED7CC] text-[10px] uppercase text-[#686158]">
                    <th className="py-2.5">Workflow Name</th>
                    <th className="py-2.5">Category</th>
                    <th className="py-2.5">Trigger Event</th>
                    <th className="py-2.5">Status</th>
                    <th className="py-2.5">Version</th>
                    <th className="py-2.5">Runs (OK / Fail)</th>
                    <th className="py-2.5 text-right">Operations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DED7CC]">
                  {workflows.map((wf) => (
                    <tr key={wf.id} className="hover:bg-[#FAF8F4]">
                      <td className="py-3 font-bold text-[#24211D]">
                        {wf.name}
                        {wf.requiresApproval && (
                          <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px]">
                            GOVERNED
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-[#686158]">{wf.category}</td>
                      <td className="py-3 text-[#9A783E] font-semibold">{wf.triggerType}</td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            wf.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : wf.status === 'PENDING_APPROVAL'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-[#F1EDE5] text-[#686158] border border-[#DED7CC]'
                          }`}
                        >
                          {wf.status}
                        </span>
                      </td>
                      <td className="py-3 text-[#686158]">v{wf.version || 1}</td>
                      <td className="py-3">
                        <span className="font-bold text-[#24211D]">{wf.executionCount || 0}</span> (
                        <span className="text-emerald-700">{wf.successCount || 0}</span> /{' '}
                        <span className="text-rose-600">{wf.failureCount || 0}</span>)
                      </td>
                      <td className="py-3 text-right space-x-1.5">
                        <button
                          onClick={() => {
                            loadWorkflowIntoBuilder(wf);
                            handleTabSelect('builder');
                          }}
                          className="px-2.5 py-1 rounded bg-[#F1EDE5] hover:bg-[#24211D] hover:text-[#FAF8F4] text-[#24211D] text-[10px] font-bold cursor-pointer transition-colors"
                        >
                          Edit DAG
                        </button>
                        <button
                          onClick={() => handleTestWorkflowRun(wf.id)}
                          className="px-2.5 py-1 rounded border border-[#9A783E] text-[#9A783E] hover:bg-[#9A783E] hover:text-white text-[10px] font-bold cursor-pointer transition-colors"
                        >
                          Test Run
                        </button>
                        {wf.status === 'ACTIVE' ? (
                          <button
                            onClick={() => handleWorkflowStatusChange(wf.id, 'PAUSED')}
                            className="px-2.5 py-1 rounded bg-amber-50 text-amber-800 text-[10px] font-bold cursor-pointer"
                          >
                            Pause
                          </button>
                        ) : (
                          <button
                            onClick={() => handleWorkflowStatusChange(wf.id, 'ACTIVE')}
                            className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-800 text-[10px] font-bold cursor-pointer"
                          >
                            Publish
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 2. VISUAL WORKFLOW BUILDER (DRAG & DROP DAG + NODE INSPECTOR + OPS)   */}
      {/* ===================================================================== */}
      {subTab === 'builder' && (
        <div className="space-y-4">
          {/* Workflow Operations Toolbar */}
          <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={activeWorkflowId}
                onChange={(e) => {
                  const found = workflows.find((w) => w.id === e.target.value);
                  if (found) loadWorkflowIntoBuilder(found);
                }}
                className="bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2 text-xs font-bold text-[#24211D]"
              >
                {workflows.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.status} • v{w.version})
                  </option>
                ))}
              </select>

              <input
                type="text"
                value={wfName}
                onChange={(e) => setWfName(e.target.value)}
                placeholder="Workflow Name"
                className="bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-1.5 text-xs font-bold text-[#24211D] min-w-[230px]"
              />

              <select
                value={wfCategory}
                onChange={(e) => setWfCategory(e.target.value)}
                className="bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-2.5 py-1.5 text-xs text-[#24211D]"
              >
                <option value="CUSTOMER_JOURNEY">Customer Journey</option>
                <option value="MARKETING">Marketing</option>
                <option value="ORDER">Order</option>
                <option value="INVENTORY">Inventory</option>
                <option value="SHIPPING">Shipping</option>
                <option value="DISCOVERY">Discovery</option>
                <option value="INFLUENCER">Influencer</option>
                <option value="RETENTION">Review &amp; Retention</option>
              </select>

              <span
                className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase ${
                  wfStatus === 'ACTIVE'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-[#F1EDE5] text-[#9A783E] border border-[#DED7CC]'
                }`}
              >
                {wfStatus} • v{wfVersion}
              </span>
            </div>

            {/* Workflow Lifecycle Operations: Draft, Test, Publish, Pause/Resume, Duplicate, Version History/Rollback */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleSaveWorkflow('DRAFT')}
                className="px-3 py-1.5 rounded-lg border border-[#DED7CC] bg-[#FAF8F4] hover:border-[#24211D] text-xs font-bold cursor-pointer"
              >
                Save Draft
              </button>
              <button
                onClick={() => activeWorkflowId && handleTestWorkflowRun(activeWorkflowId)}
                className="px-3 py-1.5 rounded-lg border border-[#9A783E] bg-[#F1EDE5] text-[#24211D] hover:bg-[#9A783E] hover:text-white text-xs font-bold cursor-pointer transition-colors"
              >
                Test Execute
              </button>
              <button
                onClick={() => handleSaveWorkflow('ACTIVE')}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer"
              >
                Publish Live
              </button>
              {wfStatus === 'ACTIVE' ? (
                <button
                  onClick={() => activeWorkflowId && handleWorkflowStatusChange(activeWorkflowId, 'PAUSED')}
                  className="px-3 py-1.5 rounded-lg bg-amber-100 text-amber-900 text-xs font-bold cursor-pointer"
                >
                  Pause
                </button>
              ) : (
                <button
                  onClick={() => activeWorkflowId && handleWorkflowStatusChange(activeWorkflowId, 'ACTIVE')}
                  className="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-900 text-xs font-bold cursor-pointer"
                >
                  Resume
                </button>
              )}
              <button
                onClick={() => activeWorkflowId && handleDuplicateWorkflow(activeWorkflowId)}
                className="px-3 py-1.5 rounded-lg border border-[#DED7CC] bg-[#FAF8F4] text-xs font-bold cursor-pointer"
              >
                Duplicate
              </button>
              <button
                onClick={() => setVersionModalOpen(true)}
                className="px-3 py-1.5 rounded-lg border border-[#DED7CC] bg-[#FAF8F4] text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <History className="w-3.5 h-3.5 text-[#9A783E]" />
                <span>Versions ({wfVersionHistory.length})</span>
              </button>
            </div>
          </div>

          {/* 3-Column Builder Workspace: Palette | Interactive DAG Canvas | Node & RBAC Inspector */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* LEFT: Node Palette (All 20 Triggers, 13 Conditions, 14 Actions, 7 Controls) */}
            <div className="lg:col-span-3 bg-[#FFFFFF] border border-[#DED7CC] rounded-xl p-4 space-y-4 max-h-[680px] overflow-y-auto">
              <div className="border-b border-[#DED7CC] pb-2">
                <h4 className="font-serif text-sm uppercase tracking-wider text-[#24211D] font-bold">
                  Node Library
                </h4>
                <p className="text-[10px] text-[#686158]">
                  Click any node to append to canvas, then drag nodes to arrange DAG.
                </p>
              </div>

              {/* Triggers (20) */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold uppercase text-[#9A783E] tracking-wider">
                  Triggers ({TRIGGER_CATALOG.length})
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                  {TRIGGER_CATALOG.map((item) => (
                    <button
                      key={item.type}
                      onClick={() => handleAddNodeToCanvas('TRIGGER', item.type, item.label)}
                      className="w-full text-left px-2.5 py-1.5 rounded bg-[#FAF8F4] hover:bg-[#F1EDE5] border border-[#DED7CC] text-[11px] flex items-center justify-between cursor-pointer"
                    >
                      <span className="truncate">{item.label}</span>
                      <Plus className="w-3 h-3 text-[#9A783E] shrink-0" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Conditions (13) */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold uppercase text-sky-700 tracking-wider">
                  Conditions ({CONDITION_CATALOG.length})
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                  {CONDITION_CATALOG.map((item) => (
                    <button
                      key={item.type}
                      onClick={() => handleAddNodeToCanvas('CONDITION', item.type, item.label)}
                      className="w-full text-left px-2.5 py-1.5 rounded bg-[#FAF8F4] hover:bg-sky-50 border border-[#DED7CC] text-[11px] flex items-center justify-between cursor-pointer"
                    >
                      <span className="truncate">{item.label}</span>
                      <Plus className="w-3 h-3 text-sky-700 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions (14) */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold uppercase text-emerald-700 tracking-wider">
                  Actions ({ACTION_CATALOG.length})
                </div>
                <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
                  {ACTION_CATALOG.map((item) => (
                    <button
                      key={item.type}
                      onClick={() => handleAddNodeToCanvas('ACTION', item.type, item.label)}
                      className="w-full text-left px-2.5 py-1.5 rounded bg-[#FAF8F4] hover:bg-emerald-50 border border-[#DED7CC] text-[11px] flex items-center justify-between cursor-pointer"
                    >
                      <span className="truncate">{item.label}</span>
                      <Plus className="w-3 h-3 text-emerald-700 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Control Nodes (7) */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold uppercase text-purple-700 tracking-wider">
                  Control Nodes ({CONTROL_CATALOG.length})
                </div>
                <div className="space-y-1">
                  {CONTROL_CATALOG.map((item) => (
                    <button
                      key={item.type}
                      onClick={() => handleAddNodeToCanvas('CONTROL', item.type, item.label)}
                      className="w-full text-left px-2.5 py-1.5 rounded bg-[#FAF8F4] hover:bg-purple-50 border border-[#DED7CC] text-[11px] flex items-center justify-between cursor-pointer"
                    >
                      <span className="truncate">{item.label}</span>
                      <Plus className="w-3 h-3 text-purple-700 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* CENTER: Interactive Drag-and-Drop SVG + Node DAG Canvas */}
            <div className="lg:col-span-6 bg-[#FFFFFF] border border-[#DED7CC] rounded-xl flex flex-col overflow-hidden">
              <div className="px-4 py-2.5 bg-[#F1EDE5] border-b border-[#DED7CC] flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-[#24211D]">
                  Visual DAG Canvas ({wfNodes.length} Nodes • {wfEdges.length} Transitions)
                </span>
                {/* Edge Creator */}
                <div className="flex items-center gap-1.5 text-[10px]">
                  <select
                    value={newEdgeSource}
                    onChange={(e) => setNewEdgeSource(e.target.value)}
                    className="bg-[#FFFFFF] border border-[#DED7CC] rounded px-1.5 py-1"
                  >
                    <option value="">From Node...</option>
                    {wfNodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.label}
                      </option>
                    ))}
                  </select>
                  <span>→</span>
                  <select
                    value={newEdgeTarget}
                    onChange={(e) => setNewEdgeTarget(e.target.value)}
                    className="bg-[#FFFFFF] border border-[#DED7CC] rounded px-1.5 py-1"
                  >
                    <option value="">To Node...</option>
                    {wfNodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={newEdgeBranch}
                    onChange={(e) => setNewEdgeBranch(e.target.value as any)}
                    className="bg-[#FFFFFF] border border-[#DED7CC] rounded px-1.5 py-1"
                  >
                    <option value="DEFAULT">NEXT</option>
                    <option value="TRUE">IF TRUE</option>
                    <option value="FALSE">IF FALSE</option>
                  </select>
                  <button
                    onClick={() => {
                      if (!newEdgeSource || !newEdgeTarget || newEdgeSource === newEdgeTarget) return;
                      setWfEdges((prev) => [
                        ...prev,
                        {
                          id: `e-${Date.now().toString(36)}`,
                          source: newEdgeSource,
                          target: newEdgeTarget,
                          branch: newEdgeBranch
                        }
                      ]);
                    }}
                    className="px-2 py-1 rounded bg-[#24211D] text-[#FAF8F4] font-bold cursor-pointer"
                  >
                    Link
                  </button>
                </div>
              </div>

              <div
                ref={canvasRef}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
                className="relative flex-1 min-h-[580px] bg-[#FAF8F4] overflow-auto select-none"
                style={{
                  backgroundImage: 'radial-gradient(#DED7CC 1px, transparent 1px)',
                  backgroundSize: '20px 20px'
                }}
              >
                {/* SVG Edges Layer */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  {wfEdges.map((edge) => {
                    const src = wfNodes.find((n) => n.id === edge.source);
                    const tgt = wfNodes.find((n) => n.id === edge.target);
                    if (!src || !tgt) return null;
                    const x1 = src.position.x + 190;
                    const y1 = src.position.y + 38;
                    const x2 = tgt.position.x;
                    const y2 = tgt.position.y + 38;
                    const midX = (x1 + x2) / 2;
                    const strokeColor =
                      edge.branch === 'FALSE'
                        ? '#e11d48'
                        : edge.branch === 'TRUE'
                        ? '#047857'
                        : '#9A783E';
                    return (
                      <g key={edge.id}>
                        <path
                          d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                          fill="none"
                          stroke={strokeColor}
                          strokeWidth={2.2}
                        />
                        {edge.branch && edge.branch !== 'DEFAULT' && (
                          <text
                            x={midX - 14}
                            y={(y1 + y2) / 2 - 6}
                            fill={strokeColor}
                            fontSize="9"
                            fontWeight="bold"
                          >
                            {edge.branch}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>

                {/* Draggable DAG Nodes */}
                {wfNodes.map((node) => {
                  const isSelected = node.id === selectedNodeId;
                  const badgeTone =
                    node.category === 'TRIGGER'
                      ? 'bg-[#9A783E] text-white'
                      : node.category === 'CONDITION'
                      ? 'bg-sky-700 text-white'
                      : node.category === 'CONTROL'
                      ? 'bg-purple-700 text-white'
                      : 'bg-emerald-700 text-white';

                  return (
                    <div
                      key={node.id}
                      onMouseDown={(e) => handleNodeMouseDown(e, node)}
                      style={{
                        left: `${node.position.x}px`,
                        top: `${node.position.y}px`,
                        width: '192px'
                      }}
                      className={`absolute rounded-xl bg-[#FFFFFF] p-3 cursor-grab active:cursor-grabbing transition-shadow ${
                        isSelected
                          ? 'border-2 border-[#9A783E] shadow-lg'
                          : 'border border-[#DED7CC] shadow-xs hover:border-[#9A783E]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${badgeTone}`}>
                          {node.category}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setWfNodes((prev) => prev.filter((n) => n.id !== node.id));
                            setWfEdges((prev) =>
                              prev.filter((ed) => ed.source !== node.id && ed.target !== node.id)
                            );
                          }}
                          className="text-[#686158] hover:text-rose-600 cursor-pointer"
                          title="Remove node"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="font-bold text-[11px] text-[#24211D] leading-snug">
                        {node.label}
                      </div>
                      <div className="text-[9px] text-[#686158] truncate mt-0.5">{node.type}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RIGHT: Node Configuration Inspector & RBAC / Limits */}
            <div className="lg:col-span-3 bg-[#FFFFFF] border border-[#DED7CC] rounded-xl p-4 space-y-5 max-h-[680px] overflow-y-auto">
              {selectedNode ? (
                <div className="space-y-3">
                  <div className="border-b border-[#DED7CC] pb-2">
                    <span className="text-[10px] font-bold uppercase text-[#9A783E]">
                      {selectedNode.category} NODE INSPECTOR
                    </span>
                    <h4 className="font-serif text-sm uppercase tracking-wider text-[#24211D] font-bold">
                      {selectedNode.label}
                    </h4>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase text-[#686158] block mb-1">
                      Display Label
                    </label>
                    <input
                      type="text"
                      value={selectedNode.label}
                      onChange={(e) => {
                        const val = e.target.value;
                        setWfNodes((prev) =>
                          prev.map((n) => (n.id === selectedNode.id ? { ...n, label: val } : n))
                        );
                      }}
                      className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-2.5 py-1.5 text-xs"
                    />
                  </div>

                  {/* Condition-specific parameters */}
                  {selectedNode.category === 'CONDITION' && (
                    <div className="space-y-2.5 pt-2 border-t border-[#DED7CC]">
                      <div>
                        <label className="text-[10px] uppercase text-[#686158] block mb-1">
                          Boolean Logic Operator (AND / OR)
                        </label>
                        <select
                          value={selectedNode.config?.logicOperator || 'AND'}
                          onChange={(e) => {
                            const logicOperator = e.target.value;
                            setWfNodes((prev) =>
                              prev.map((n) =>
                                n.id === selectedNode.id
                                  ? { ...n, config: { ...n.config, logicOperator } }
                                  : n
                              )
                            );
                          }}
                          className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-2.5 py-1.5 text-xs"
                        >
                          <option value="AND">AND (All rules must pass)</option>
                          <option value="OR">OR (Any rule can pass)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] uppercase text-[#686158] block mb-1">
                          Threshold / Expected Value
                        </label>
                        <input
                          type="text"
                          value={
                            selectedNode.config?.value ??
                            selectedNode.config?.minAmount ??
                            selectedNode.config?.segment ??
                            ''
                          }
                          onChange={(e) => {
                            const raw = e.target.value;
                            const num = Number(raw);
                            setWfNodes((prev) =>
                              prev.map((n) =>
                                n.id === selectedNode.id
                                  ? {
                                      ...n,
                                      config: {
                                        ...n.config,
                                        value: Number.isNaN(num) ? raw : num,
                                        minAmount: Number.isNaN(num) ? n.config.minAmount : num,
                                        segment: raw
                                      }
                                    }
                                  : n
                              )
                            );
                          }}
                          placeholder="e.g. 2500 or VIP Collector"
                          className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-2.5 py-1.5 text-xs"
                        />
                      </div>
                    </div>
                  )}

                  {/* Action-specific parameters */}
                  {selectedNode.category === 'ACTION' && (
                    <div className="space-y-2.5 pt-2 border-t border-[#DED7CC]">
                      {selectedNode.type === 'generate_coupon' && (
                        <>
                          <div>
                            <label className="text-[10px] uppercase text-[#686158] block mb-1">
                              Coupon Prefix
                            </label>
                            <input
                              type="text"
                              value={selectedNode.config?.prefix || 'FRAG'}
                              onChange={(e) =>
                                setWfNodes((prev) =>
                                  prev.map((n) =>
                                    n.id === selectedNode.id
                                      ? { ...n, config: { ...n.config, prefix: e.target.value } }
                                      : n
                                  )
                                )
                              }
                              className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-2.5 py-1.5 text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase text-[#686158] block mb-1">
                              Discount Value (% or ₹)
                            </label>
                            <input
                              type="number"
                              value={selectedNode.config?.value ?? 10}
                              onChange={(e) =>
                                setWfNodes((prev) =>
                                  prev.map((n) =>
                                    n.id === selectedNode.id
                                      ? {
                                          ...n,
                                          config: { ...n.config, value: Number(e.target.value) }
                                        }
                                      : n
                                  )
                                )
                              }
                              className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-2.5 py-1.5 text-xs"
                            />
                          </div>
                        </>
                      )}

                      <div>
                        <label className="text-[10px] uppercase text-[#686158] block mb-1">
                          Template / Message / Endpoint / Segment
                        </label>
                        <input
                          type="text"
                          value={
                            selectedNode.config?.templateName ||
                            selectedNode.config?.message ||
                            selectedNode.config?.segment ||
                            selectedNode.config?.url ||
                            ''
                          }
                          onChange={(e) => {
                            const v = e.target.value;
                            setWfNodes((prev) =>
                              prev.map((n) =>
                                n.id === selectedNode.id
                                  ? {
                                      ...n,
                                      config: {
                                        ...n.config,
                                        templateName: v,
                                        message: v,
                                        segment: v,
                                        url: v
                                      }
                                    }
                                  : n
                              )
                            );
                          }}
                          placeholder="Template name, message or URL"
                          className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-2.5 py-1.5 text-xs"
                        />
                      </div>
                    </div>
                  )}

                  {/* Control-specific parameters */}
                  {selectedNode.category === 'CONTROL' && (
                    <div className="space-y-2.5 pt-2 border-t border-[#DED7CC]">
                      <div>
                        <label className="text-[10px] uppercase text-[#686158] block mb-1">
                          Wait Seconds / Target ISO Time / Reason
                        </label>
                        <input
                          type="text"
                          value={
                            selectedNode.config?.durationSeconds ??
                            selectedNode.config?.targetTime ??
                            selectedNode.config?.reason ??
                            ''
                          }
                          onChange={(e) => {
                            const v = e.target.value;
                            const num = Number(v);
                            setWfNodes((prev) =>
                              prev.map((n) =>
                                n.id === selectedNode.id
                                  ? {
                                      ...n,
                                      config: {
                                        ...n.config,
                                        durationSeconds: Number.isNaN(num) ? 0 : num,
                                        targetTime: v,
                                        reason: v
                                      }
                                    }
                                  : n
                              )
                            );
                          }}
                          placeholder="e.g. 3600 or approval note"
                          className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-2.5 py-1.5 text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-[#686158]">
                  Select any node on the canvas to configure its parameters.
                </div>
              )}

              {/* Workflow-level Execution Limits & RBAC */}
              <div className="pt-4 border-t border-[#DED7CC] space-y-3">
                <span className="text-[10px] font-bold uppercase text-[#24211D] block">
                  Operational Limits &amp; RBAC
                </span>
                <div>
                  <label className="text-[10px] uppercase text-[#686158] block mb-1">
                    Maximum Execution Limit (0 = Unlimited)
                  </label>
                  <input
                    type="number"
                    value={wfMaxExecutions}
                    onChange={(e) => setWfMaxExecutions(Number(e.target.value) || 0)}
                    className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-[#686158] block mb-1">
                    Authorized Admin Roles
                  </label>
                  <input
                    type="text"
                    value={wfAllowedRoles.join(', ')}
                    onChange={(e) =>
                      setWfAllowedRoles(
                        e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean)
                      )
                    }
                    className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-2.5 py-1.5 text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Version History & Rollback Modal */}
          {versionModalOpen && (
            <div
              onClick={(e) => {
                if (e.target === e.currentTarget) setVersionModalOpen(false);
              }}
              className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
            >
              <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-[#DED7CC] pb-3">
                  <h3 className="font-serif text-lg uppercase text-[#24211D]">
                    Workflow Version History &amp; Rollback
                  </h3>
                  <button
                    onClick={() => setVersionModalOpen(false)}
                    className="text-xs font-bold text-[#686158] hover:text-[#24211D] cursor-pointer"
                  >
                    Close
                  </button>
                </div>
                {wfVersionHistory.length === 0 ? (
                  <p className="text-xs text-[#686158]">
                    Currently on initial snapshot v{wfVersion}. Saving changes automatically records immutable rollback points.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {wfVersionHistory.map((vh: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg bg-[#FAF8F4] border border-[#DED7CC] flex items-center justify-between"
                      >
                        <div>
                          <div className="font-bold text-[#24211D]">
                            Snapshot v{vh.version} — {vh.note || 'Saved revision'}
                          </div>
                          <div className="text-[10px] text-[#686158]">
                            {vh.savedAt} by {vh.savedBy || 'Super Admin'}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRollbackWorkflow(vh.version)}
                          className="px-3 py-1 rounded bg-[#24211D] text-[#FAF8F4] text-[10px] font-bold hover:bg-[#9A783E] cursor-pointer"
                        >
                          Rollback to v{vh.version}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 3. AUTOMATION TEMPLATES                                               */}
      {/* ===================================================================== */}
      {subTab === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {workflows.map((wf) => (
            <div
              key={wf.id}
              className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl p-5 space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded bg-[#F1EDE5] text-[#9A783E] text-[10px] font-bold">
                    {wf.category}
                  </span>
                  <span className="text-[10px] text-[#686158]">Trigger: {wf.triggerType}</span>
                </div>
                <h3 className="font-serif text-base uppercase tracking-wider text-[#24211D] font-bold">
                  {wf.name}
                </h3>
                <p className="text-xs text-[#686158]">{wf.description}</p>
              </div>
              <div className="flex items-center gap-2 pt-3 border-t border-[#DED7CC]">
                <button
                  onClick={() => {
                    loadWorkflowIntoBuilder(wf);
                    handleTabSelect('builder');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#24211D] text-[#FAF8F4] text-xs font-bold cursor-pointer"
                >
                  Customize in Builder
                </button>
                <button
                  onClick={() => handleDuplicateWorkflow(wf.id)}
                  className="px-3 py-1.5 rounded-lg bg-[#F1EDE5] border border-[#DED7CC] text-[#24211D] text-xs font-bold cursor-pointer"
                >
                  Clone Blueprint
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 4–11. DOMAIN AUTOMATION VIEWS                                         */}
      {/* ===================================================================== */}
      {subTab === 'customer_journeys' && (
        <div className="space-y-6">
          {/* Header & VIP Rule Banner */}
          <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded bg-[#24211D] text-[#FAF8F4] text-[10px] font-bold uppercase tracking-wider">
                  Customer Lifecycle CRM &amp; Customer 360
                </span>
                <span className="px-2.5 py-0.5 rounded bg-amber-50 border border-amber-300 text-[#9A783E] text-[10px] font-bold uppercase">
                  VIP Rule: Net Qualifying Purchases &ge; ₹5,000 or Single Order &ge; ₹5,000 (Admin-Only Visibility)
                </span>
              </div>
              <h3 className="font-serif text-lg uppercase tracking-wider text-[#24211D] font-bold">
                Dynamic Customer Segmentation, Lifecycle Workflows &amp; Unified 360 Dossiers
              </h3>
              <p className="text-xs text-[#686158]">
                Synchronizes all 15 customer lifecycle events in real time without fabricating missing names, mobile numbers, or emails. Recalculates VIP status automatically after discounts, cancellations, and refunds.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleRecalculateAllCrm()}
                disabled={isRecalculatingCrm}
                className="px-3.5 py-2 rounded-lg bg-[#F1EDE5] border border-[#DED7CC] hover:border-[#9A783E] text-[#24211D] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[#9A783E] ${isRecalculatingCrm ? 'animate-spin' : ''}`} />
                <span>{isRecalculatingCrm ? 'Recalculating...' : 'Recalculate VIP & 14 Segments'}</span>
              </button>
              <button
                onClick={createBlankWorkflow}
                className="px-3.5 py-2 rounded-lg bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Journey Workflow</span>
              </button>
            </div>
          </div>

          {/* 14 Dynamic Customer Segments Grid */}
          <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#DED7CC] pb-3">
              <div>
                <h4 className="font-serif text-sm uppercase tracking-wider text-[#24211D] font-bold">
                  14 Dynamic Customer Segments (Live Database Classification)
                </h4>
                <p className="text-[11px] text-[#686158]">
                  Click any segment to filter the Customer 360 directory below.
                </p>
              </div>
              {crmSegmentFilter !== 'ALL' && (
                <button
                  onClick={() => setCrmSegmentFilter('ALL')}
                  className="px-3 py-1 rounded bg-[#24211D] text-[#FAF8F4] text-[10px] font-bold cursor-pointer self-start"
                >
                  Clear Filter ({crmSegmentFilter}) ×
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5">
              {DYNAMIC_SEGMENTS_LIST.map((segName, idx) => {
                const count =
                  crmAnalytics?.dynamicSegments?.[segName] ??
                  crmCustomers.filter(
                    (c) =>
                      (Array.isArray(c.dynamicSegments) && c.dynamicSegments.includes(segName)) ||
                      (Array.isArray(c.tags) && c.tags.includes(segName))
                  ).length;
                const isSelected = crmSegmentFilter === segName;
                const isVipSeg = segName === 'VIP customers';
                return (
                  <button
                    key={segName}
                    onClick={() => setCrmSegmentFilter(isSelected ? 'ALL' : segName)}
                    className={`text-left p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-[#24211D] text-[#FAF8F4] border-[#24211D] shadow-md'
                        : isVipSeg
                        ? 'bg-amber-50/70 border-amber-300 hover:border-[#9A783E] text-[#24211D]'
                        : 'bg-[#FAF8F4] border-[#DED7CC] hover:border-[#9A783E] text-[#24211D]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`text-[9px] font-bold uppercase ${
                          isSelected ? 'text-[#E5C378]' : 'text-[#9A783E]'
                        }`}
                      >
                        #{idx + 1} {isVipSeg ? '• ADMIN ONLY' : ''}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                          isSelected
                            ? 'bg-[#9A783E] text-white'
                            : 'bg-[#FFFFFF] text-[#24211D] border border-[#DED7CC]'
                        }`}
                      >
                        {count}
                      </span>
                    </div>
                    <div className="text-[11px] font-bold leading-snug mt-2">{segName}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 6 Configurable Lifecycle Automations */}
          <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl p-5 space-y-4">
            <div className="border-b border-[#DED7CC] pb-3 flex items-center justify-between">
              <div>
                <h4 className="font-serif text-sm uppercase tracking-wider text-[#24211D] font-bold">
                  6 Configurable Lifecycle Automations (WELCOME • FIRST PURCHASE • REPEAT • VIP • INACTIVE • BIRTHDAY)
                </h4>
                <p className="text-[11px] text-[#686158]">
                  Every lifecycle journey enforces consent rules, separates transactional vs promotional messages, and persists in PostgreSQL.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                {
                  stage: 'WELCOME',
                  wfId: 'wf-customer-welcome-journey',
                  flow: 'Registration → verify communication permissions → send permitted welcome communication'
                },
                {
                  stage: 'FIRST PURCHASE',
                  wfId: 'wf-lifecycle-first-purchase',
                  flow: 'Successful paid order → order confirmation → fulfillment journey → delivery → review invitation'
                },
                {
                  stage: 'REPEAT CUSTOMER',
                  wfId: 'wf-lifecycle-repeat-customer',
                  flow: 'Second completed order → update customer segment → optional loyalty benefit'
                },
                {
                  stage: 'VIP (₹5,000 RULE)',
                  wfId: 'wf-vip-tier-elevation',
                  flow: 'Customer reaches ₹5,000 net spend → assign VIP status → notify Admin → prepare exclusive offer subject to approval'
                },
                {
                  stage: 'INACTIVE (45/60/90D)',
                  wfId: 'wf-lifecycle-inactive-winback',
                  flow: 'No completed purchase for 45/60/90 days → evaluate marketing consent → send relevant win-back campaign'
                },
                {
                  stage: 'BIRTHDAY (VOLUNTARY)',
                  wfId: 'wf-lifecycle-birthday-offer',
                  flow: 'Only if voluntarily provided → verify consent → schedule optional birthday offer'
                }
              ].map((item) => {
                const wf = workflows.find((w) => w.id === item.wfId);
                return (
                  <div
                    key={item.stage}
                    className="p-4 rounded-xl bg-[#FAF8F4] border border-[#DED7CC] flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded bg-[#24211D] text-[#E5C378] text-[10px] font-bold uppercase">
                          {item.stage}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            wf?.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {wf?.status || 'SEEDED'}
                        </span>
                      </div>
                      <div className="font-bold text-xs text-[#24211D]">
                        {wf?.name || item.stage}
                      </div>
                      <p className="text-[11px] text-[#686158] leading-relaxed">{item.flow}</p>
                    </div>

                    <div className="pt-2 border-t border-[#DED7CC] flex items-center justify-between gap-2 text-[10px]">
                      <span className="text-[#686158]">
                        Runs: <strong className="text-[#24211D]">{wf?.executionCount || 0}</strong>
                      </span>
                      {wf && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleTestWorkflowRun(wf.id)}
                            className="px-2 py-1 rounded bg-[#FFFFFF] border border-[#DED7CC] hover:border-[#9A783E] font-bold text-[#24211D] cursor-pointer"
                          >
                            Test Run
                          </button>
                          <button
                            onClick={() => {
                              loadWorkflowIntoBuilder(wf);
                              handleTabSelect('builder');
                            }}
                            className="px-2.5 py-1 rounded bg-[#24211D] text-[#FAF8F4] font-bold cursor-pointer"
                          >
                            Configure DAG
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Unified Customer 360 Directory */}
          <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DED7CC] pb-3">
              <div>
                <h4 className="font-serif text-base uppercase tracking-wider text-[#24211D] font-bold">
                  Unified Customer 360 Directory ({crmCustomers.length} Synchronized Profiles)
                </h4>
                <p className="text-xs text-[#686158]">
                  Click any customer to inspect their complete Customer 360 Dossier: Lifetime Net Revenue, Order History, Last Activity, Source Attribution, Product Preferences, Consent Status, Admin-Only VIP Status, Loyalty Benefits, Coupon History, Communication Timeline, Active Workflows, and Support Issues.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={crmSearchQuery}
                  onChange={(e) => setCrmSearchQuery(e.target.value)}
                  placeholder="Search email, name, phone, segment..."
                  className="bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-1.5 text-xs min-w-[240px]"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#DED7CC] text-[10px] uppercase text-[#686158]">
                    <th className="py-2.5">Customer Profile</th>
                    <th className="py-2.5">VIP Status (Admin-Only)</th>
                    <th className="py-2.5">Lifetime Net Revenue</th>
                    <th className="py-2.5">Orders</th>
                    <th className="py-2.5">Dynamic Segments</th>
                    <th className="py-2.5">Consent Status</th>
                    <th className="py-2.5">Last Activity</th>
                    <th className="py-2.5 text-right">Customer 360</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DED7CC]">
                  {crmCustomers
                    .filter((c) => {
                      if (crmSegmentFilter !== 'ALL') {
                        const segs = Array.isArray(c.dynamicSegments)
                          ? c.dynamicSegments
                          : Array.isArray(c.tags)
                          ? c.tags
                          : [];
                        if (!segs.includes(crmSegmentFilter)) return false;
                      }
                      if (crmSearchQuery.trim()) {
                        const q = crmSearchQuery.toLowerCase();
                        const matchName = (c.name || '').toLowerCase().includes(q);
                        const matchEmail = (c.email || '').toLowerCase().includes(q);
                        const matchPhone = (c.phone || '').toLowerCase().includes(q);
                        const matchSeg = (c.dynamicSegments || []).some((s: string) =>
                          s.toLowerCase().includes(q)
                        );
                        return matchName || matchEmail || matchPhone || matchSeg;
                      }
                      return true;
                    })
                    .map((cust) => {
                      const c360 = cust.customer360 || {};
                      const isVip = Boolean(cust.isVip || c360.vipStatus || cust.tier === 'VIP');
                      const netRev = Number(
                        c360.lifetimeNetRevenue ?? cust.netPurchaseValue ?? cust.totalSpend ?? 0
                      );
                      const consent = c360.consentStatus || cust.crmMetadata?.consent || {};
                      const isUnsub = Boolean(consent.unsubscribed || consent.marketingOptIn === false);
                      const segs: string[] = Array.isArray(cust.dynamicSegments)
                        ? cust.dynamicSegments
                        : Array.isArray(cust.tags)
                        ? cust.tags
                        : [];

                      return (
                        <tr key={cust.id} className="hover:bg-[#FAF8F4]">
                          <td className="py-3">
                            <div className="font-bold text-[#24211D]">
                              {cust.name || <span className="italic text-[#686158]">Name not provided</span>}
                            </div>
                            <div className="text-[10px] text-[#686158]">
                              {cust.email || 'No email'} • {cust.phone || 'No mobile'}
                            </div>
                          </td>
                          <td className="py-3">
                            {isVip ? (
                              <span className="px-2 py-0.5 rounded bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-bold uppercase">
                                ★ VIP (Admin Only)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-[#F1EDE5] text-[#686158] text-[10px] font-bold">
                                {cust.tier || 'Member'}
                              </span>
                            )}
                          </td>
                          <td className="py-3">
                            <div className="font-bold text-emerald-700">
                              ₹{netRev.toLocaleString('en-IN')}
                            </div>
                            {Number(c360.refundedTotal) > 0 && (
                              <div className="text-[9px] text-rose-700">
                                Net after ₹{Number(c360.refundedTotal).toLocaleString('en-IN')} refund
                              </div>
                            )}
                          </td>
                          <td className="py-3 font-bold text-[#24211D]">
                            {c360.qualifyingOrdersCount ?? cust.totalOrders ?? 0}
                          </td>
                          <td className="py-3 max-w-[260px]">
                            <div className="flex flex-wrap gap-1">
                              {segs.slice(0, 3).map((s: string) => (
                                <span
                                  key={s}
                                  className="px-1.5 py-0.5 rounded bg-[#F1EDE5] border border-[#DED7CC] text-[9px] font-bold text-[#24211D]"
                                >
                                  {s}
                                </span>
                              ))}
                              {segs.length > 3 && (
                                <span className="text-[9px] text-[#9A783E] font-bold">
                                  +{segs.length - 3} more
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                isUnsub
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {isUnsub ? 'UNSUBSCRIBED (Transactional Only)' : 'OPTED IN'}
                            </span>
                          </td>
                          <td className="py-3 text-[#686158] text-[10px]">
                            <div>{c360.lastActivityEvent || 'Account Sync'}</div>
                            <div>{cust.lastActiveDate || '—'}</div>
                          </td>
                          <td className="py-3 text-right">
                            <button
                              onClick={() => setSelectedCustomer360(cust)}
                              className="px-3 py-1.5 rounded-lg bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-[10px] font-bold cursor-pointer transition-colors"
                            >
                              Open Customer 360 →
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Unified Customer 360 Full Profile Modal */}
          {selectedCustomer360 && (() => {
            const c = selectedCustomer360;
            const c360 = c.customer360 || {};
            const consent = c360.consentStatus || c.crmMetadata?.consent || {};
            const isVip = Boolean(c.isVip || c360.vipStatus || c.tier === 'VIP');
            const netRevenue = Number(c360.lifetimeNetRevenue ?? c.netPurchaseValue ?? c.totalSpend ?? 0);
            const grossRevenue = Number(c360.grossRevenue ?? c.totalSpend ?? 0);
            const refundedTotal = Number(c360.refundedTotal ?? 0);
            const segs: string[] = Array.isArray(c.dynamicSegments) ? c.dynamicSegments : c.tags || [];
            const orderHist: any[] = Array.isArray(c360.orderHistory) ? c360.orderHistory : [];
            const commTimeline: any[] = Array.isArray(c360.communicationTimeline)
              ? c360.communicationTimeline
              : Array.isArray(c.communicationHistory)
              ? c.communicationHistory
              : [];
            const activeWfs: any[] = Array.isArray(c360.activeWorkflows) ? c360.activeWorkflows : [];
            const supportIssues: any[] = Array.isArray(c360.supportIssues) ? c360.supportIssues : [];
            const loyaltyBenefits: string[] = Array.isArray(c360.loyaltyBenefits) ? c360.loyaltyBenefits : [];
            const couponHistory: string[] = Array.isArray(c360.couponHistory) ? c360.couponHistory : [];
            const unusedVouchers: string[] = Array.isArray(c360.unusedVouchers) ? c360.unusedVouchers : [];
            const eventsTimeline: any[] = Array.isArray(c360.eventsTimeline) ? c360.eventsTimeline : [];

            return (
              <div
                onClick={(e) => {
                  if (e.target === e.currentTarget) setSelectedCustomer360(null);
                }}
                className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto"
              >
                <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl">
                  {/* Modal Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#DED7CC] pb-4 gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded bg-[#24211D] text-[#E5C378] text-[10px] font-bold uppercase">
                          UNIFIED CUSTOMER 360 DOSSIER
                        </span>
                        {isVip && (
                          <span className="px-2.5 py-0.5 rounded bg-amber-100 border border-amber-400 text-amber-900 text-[10px] font-bold uppercase">
                            ★ VIP COLLECTOR (VISIBLE ONLY IN ADMIN)
                          </span>
                        )}
                        <span className="text-[10px] text-[#686158]">ID: {c.id}</span>
                      </div>
                      <h3 className="font-serif text-2xl uppercase tracking-wider text-[#24211D] font-bold mt-1">
                        {c.name || 'Name Not Provided (Unfabricated)'}
                      </h3>
                      <p className="text-xs text-[#686158]">
                        Email: <strong className="text-[#24211D]">{c.email || 'Not provided'}</strong>{' '}
                        {c360.profile?.emailVerified ? '✓ Verified' : ''} • Mobile:{' '}
                        <strong className="text-[#24211D]">{c.phone || 'Not provided'}</strong>{' '}
                        {c360.profile?.mobileVerified ? '✓ Verified' : ''} • Location:{' '}
                        <strong className="text-[#24211D]">
                          {[c.city, c.state].filter(Boolean).join(', ') || 'Not provided'}
                        </strong>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 self-start">
                      <button
                        onClick={() => handleRecalculateAllCrm(c.id)}
                        className="px-3 py-1.5 rounded-lg bg-[#F1EDE5] border border-[#DED7CC] text-xs font-bold text-[#24211D] cursor-pointer"
                      >
                        Recalculate VIP Status
                      </button>
                      <button
                        onClick={() => setSelectedCustomer360(null)}
                        className="px-3.5 py-1.5 rounded-lg bg-[#24211D] text-[#FAF8F4] text-xs font-bold cursor-pointer"
                      >
                        Close 360
                      </button>
                    </div>
                  </div>

                  {/* Top KPI Strip: Net Revenue, VIP Status, Activity, Attribution */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="p-4 rounded-xl bg-[#FAF8F4] border border-[#DED7CC] space-y-1">
                      <span className="text-[10px] uppercase text-[#686158] font-bold">
                        Lifetime Net Revenue (After Discounts &amp; Refunds)
                      </span>
                      <div className="font-serif text-2xl font-bold text-emerald-700">
                        ₹{netRevenue.toLocaleString('en-IN')}
                      </div>
                      <div className="text-[10px] text-[#686158]">
                        Gross: ₹{grossRevenue.toLocaleString('en-IN')} • Refunds: ₹{refundedTotal.toLocaleString('en-IN')}
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-[#FAF8F4] border border-[#DED7CC] space-y-1">
                      <span className="text-[10px] uppercase text-[#686158] font-bold">
                        VIP Rule Status (&ge; ₹5,000 Net)
                      </span>
                      <div className="font-serif text-xl font-bold text-[#24211D]">
                        {isVip ? '★ VIP Qualified' : `₹${Math.max(0, 5000 - netRevenue).toLocaleString('en-IN')} to VIP`}
                      </div>
                      <div className="text-[10px] text-[#9A783E] font-bold">
                        Max Single Order: ₹{Number(c360.maxSingleOrderNet ?? 0).toLocaleString('en-IN')}
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-[#FAF8F4] border border-[#DED7CC] space-y-1">
                      <span className="text-[10px] uppercase text-[#686158] font-bold">
                        Last Activity &amp; Visits
                      </span>
                      <div className="font-bold text-xs text-[#24211D]">
                        {c360.lastActivityEvent || 'Account Active'} ({c.lastActiveDate || 'Today'})
                      </div>
                      <div className="text-[10px] text-[#686158]">
                        Views: {c.crmMetadata?.productViewsCount ?? 0} • Wishlist: {(c.wishlistSlugs || []).length} • Cart Adds: {c.crmMetadata?.addToCartCount ?? 0}
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-[#FAF8F4] border border-[#DED7CC] space-y-1">
                      <span className="text-[10px] uppercase text-[#686158] font-bold">
                        Source &amp; Campaign Attribution
                      </span>
                      <div className="font-bold text-xs text-[#24211D]">
                        {c360.sourceAttribution?.source || c.source || 'Direct Website'}
                      </div>
                      <div className="text-[10px] text-[#686158]">
                        UTM: {c360.sourceAttribution?.utmSource || 'direct'} / {c360.sourceAttribution?.utmCampaign || 'organic'}
                      </div>
                    </div>
                  </div>

                  {/* Active Dynamic Segments */}
                  <div className="p-4 rounded-xl bg-[#FAF8F4] border border-[#DED7CC] space-y-2">
                    <span className="text-[10px] font-bold uppercase text-[#9A783E] block">
                      Assigned Dynamic Customer Segments ({segs.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {segs.map((s) => (
                        <span
                          key={s}
                          className="px-2.5 py-1 rounded-lg bg-[#FFFFFF] border border-[#DED7CC] text-xs font-bold text-[#24211D]"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Grid of 360 Sections */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Consent Status & Communication Preferences */}
                    <div className="p-4 rounded-xl bg-[#FAF8F4] border border-[#DED7CC] space-y-3">
                      <div className="flex items-center justify-between border-b border-[#DED7CC] pb-2">
                        <span className="text-xs font-bold uppercase text-[#24211D]">
                          Consent Status &amp; Communication Governance
                        </span>
                        <span className="text-[10px] text-[#9A783E] font-bold">
                          Quiet Hours: {consent.quietHoursStart || '22:00'}–{consent.quietHoursEnd || '09:00'} IST
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!consent.unsubscribed && consent.emailPromotional !== false}
                            onChange={(e) =>
                              handleUpdateCustomerConsent(c.id, {
                                emailPromotional: e.target.checked,
                                unsubscribed: false
                              })
                            }
                          />
                          <span>Email Promotional Opt-In</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!consent.unsubscribed && consent.whatsappPromotional !== false}
                            onChange={(e) =>
                              handleUpdateCustomerConsent(c.id, {
                                whatsappPromotional: e.target.checked,
                                unsubscribed: false
                              })
                            }
                          />
                          <span>WhatsApp Approved Templates</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!consent.unsubscribed && Boolean(consent.smsPromotional)}
                            onChange={(e) =>
                              handleUpdateCustomerConsent(c.id, {
                                smsPromotional: e.target.checked,
                                unsubscribed: false
                              })
                            }
                          />
                          <span>SMS Promotional Opt-In</span>
                        </label>
                        <label className="flex items-center gap-2 text-rose-700 font-bold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(consent.unsubscribed)}
                            onChange={(e) =>
                              handleUpdateCustomerConsent(c.id, {
                                unsubscribed: e.target.checked,
                                marketingOptIn: !e.target.checked
                              })
                            }
                          />
                          <span>Unsubscribed (Stop Campaigns)</span>
                        </label>
                      </div>
                      <div className="pt-2 border-t border-[#DED7CC] flex items-center justify-between text-[11px]">
                        <span className="text-[#686158]">
                          Voluntary Birthday: <strong className="text-[#24211D]">{c360.profile?.birthday || 'Not provided'}</strong>
                        </span>
                        <input
                          type="date"
                          value={c360.profile?.birthday || ''}
                          onChange={(e) =>
                            handleUpdateCustomerConsent(c.id, { birthday: e.target.value || null })
                          }
                          className="bg-[#FFFFFF] border border-[#DED7CC] rounded px-2 py-0.5 text-[11px]"
                        />
                      </div>
                    </div>

                    {/* Product Preferences, Loyalty Benefits & Coupon History */}
                    <div className="p-4 rounded-xl bg-[#FAF8F4] border border-[#DED7CC] space-y-3">
                      <div className="border-b border-[#DED7CC] pb-2">
                        <span className="text-xs font-bold uppercase text-[#24211D]">
                          Product Preferences, Loyalty Benefits &amp; Coupons
                        </span>
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <div>
                          <span className="text-[#686158]">Favourite Fragrance: </span>
                          <strong className="text-[#24211D]">
                            {c360.productPreferences?.favouriteFragrance || 'None recorded yet'}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[#686158]">Wishlist Slugs: </span>
                          <strong className="text-[#24211D]">
                            {(c360.productPreferences?.wishlistSlugs || c.wishlistSlugs || []).join(', ') || 'Empty'}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[#686158]">Loyalty Benefits: </span>
                          <strong className="text-[#9A783E]">
                            {loyaltyBenefits.join(' • ') || 'Standard House Member'}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[#686158]">Redeemed Coupons: </span>
                          <strong className="text-[#24211D]">
                            {couponHistory.join(', ') || 'None redeemed yet'}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[#686158]">Unused Vouchers Eligible: </span>
                          <strong className="text-emerald-700">
                            {unusedVouchers.slice(0, 5).join(', ') || 'None'}
                          </strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Order History & Active Workflows */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-[#FAF8F4] border border-[#DED7CC] space-y-2">
                      <span className="text-xs font-bold uppercase text-[#24211D] block border-b border-[#DED7CC] pb-2">
                        Order History ({orderHist.length})
                      </span>
                      {orderHist.length === 0 ? (
                        <p className="text-xs text-[#686158]">No orders placed yet.</p>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {orderHist.map((o: any) => (
                            <div
                              key={o.id}
                              className="p-2.5 rounded bg-[#FFFFFF] border border-[#DED7CC] flex items-center justify-between text-xs"
                            >
                              <div>
                                <div className="font-bold text-[#24211D]">{o.orderNumber}</div>
                                <div className="text-[10px] text-[#686158]">
                                  {o.createdAt ? new Date(o.createdAt).toLocaleDateString() : ''} • {o.orderStatus} ({o.paymentStatus})
                                </div>
                              </div>
                              <div className="font-bold text-emerald-700">
                                ₹{Number(o.totalAmount || 0).toLocaleString('en-IN')}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="p-4 rounded-xl bg-[#FAF8F4] border border-[#DED7CC] space-y-2">
                      <span className="text-xs font-bold uppercase text-[#24211D] block border-b border-[#DED7CC] pb-2">
                        Active &amp; Recent Workflows ({activeWfs.length})
                      </span>
                      {activeWfs.length === 0 ? (
                        <p className="text-xs text-[#686158]">No workflow executions recorded for this customer yet.</p>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {activeWfs.map((wf: any) => (
                            <div
                              key={wf.jobId}
                              className="p-2.5 rounded bg-[#FFFFFF] border border-[#DED7CC] flex items-center justify-between text-xs"
                            >
                              <div>
                                <div className="font-bold text-[#24211D]">{wf.workflowName}</div>
                                <div className="text-[10px] text-[#686158]">
                                  Trigger: {wf.eventType} • {wf.updatedAt ? new Date(wf.updatedAt).toLocaleString() : ''}
                                </div>
                              </div>
                              <span className="px-2 py-0.5 rounded bg-[#F1EDE5] text-[#9A783E] text-[10px] font-bold">
                                {wf.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Communication Timeline & Support Issues */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-[#FAF8F4] border border-[#DED7CC] space-y-2">
                      <span className="text-xs font-bold uppercase text-[#24211D] block border-b border-[#DED7CC] pb-2">
                        Complete Communication Timeline ({commTimeline.length})
                      </span>
                      {commTimeline.length === 0 ? (
                        <p className="text-xs text-[#686158]">No messages sent yet.</p>
                      ) : (
                        <div className="space-y-2 max-h-52 overflow-y-auto">
                          {commTimeline.map((msg: any, idx: number) => (
                            <div
                              key={msg.id || idx}
                              className="p-2.5 rounded bg-[#FFFFFF] border border-[#DED7CC] space-y-1 text-xs"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-[#24211D]">
                                  [{msg.channel}] {msg.type || 'TRANSACTIONAL'}
                                </span>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                    String(msg.status || '').startsWith('BLOCKED')
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-emerald-50 text-emerald-700'
                                  }`}
                                >
                                  {msg.status}
                                </span>
                              </div>
                              <div className="text-[11px] text-[#24211D]">{msg.subject}</div>
                              <div className="text-[10px] text-[#686158]">
                                {msg.date} {msg.complianceNote ? `• ${msg.complianceNote}` : ''}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="p-4 rounded-xl bg-[#FAF8F4] border border-[#DED7CC] space-y-3">
                      <span className="text-xs font-bold uppercase text-[#24211D] block border-b border-[#DED7CC] pb-2">
                        Support Issues, Returns &amp; Complaints ({supportIssues.length})
                      </span>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newSupportIssueText}
                          onChange={(e) => setNewSupportIssueText(e.target.value)}
                          placeholder="Log support complaint or concierge ticket..."
                          className="flex-1 bg-[#FFFFFF] border border-[#DED7CC] rounded px-2.5 py-1.5 text-xs"
                        />
                        <button
                          onClick={() => {
                            if (!newSupportIssueText.trim()) return;
                            const nextIssues = [
                              {
                                id: `iss-${Date.now()}`,
                                type: 'SUPPORT_COMPLAINT',
                                subject: newSupportIssueText.trim(),
                                status: 'OPEN',
                                createdAt: new Date().toISOString()
                              },
                              ...supportIssues
                            ];
                            setNewSupportIssueText('');
                            handleUpdateCustomerConsent(c.id, { supportIssues: nextIssues });
                          }}
                          className="px-3 py-1.5 rounded bg-[#24211D] text-[#FAF8F4] text-xs font-bold cursor-pointer"
                        >
                          Log Issue
                        </button>
                      </div>
                      {supportIssues.length === 0 ? (
                        <p className="text-xs text-[#686158]">Zero open complaints or return issues.</p>
                      ) : (
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {supportIssues.map((iss: any) => (
                            <div
                              key={iss.id}
                              className="p-2.5 rounded bg-[#FFFFFF] border border-[#DED7CC] flex items-center justify-between text-xs"
                            >
                              <div>
                                <div className="font-bold text-[#24211D]">{iss.subject}</div>
                                <div className="text-[10px] text-[#686158]">
                                  {iss.type} • {iss.status}
                                </div>
                              </div>
                              {iss.status !== 'RESOLVED' && (
                                <button
                                  onClick={() => {
                                    const updatedIssues = supportIssues.map((item: any) =>
                                      item.id === iss.id ? { ...item, status: 'RESOLVED' } : item
                                    );
                                    handleUpdateCustomerConsent(c.id, { supportIssues: updatedIssues });
                                  }}
                                  className="px-2 py-1 rounded bg-emerald-700 text-white text-[10px] font-bold cursor-pointer"
                                >
                                  Mark Resolved
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Synchronized Customer Events Stream */}
                  <div className="p-4 rounded-xl bg-[#FAF8F4] border border-[#DED7CC] space-y-2">
                    <span className="text-xs font-bold uppercase text-[#24211D] block border-b border-[#DED7CC] pb-2">
                      Synchronized Customer Lifecycle Events ({eventsTimeline.length})
                    </span>
                    <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto">
                      {eventsTimeline.map((ev: any) => (
                        <div
                          key={ev.id}
                          className="px-2.5 py-1.5 rounded bg-[#FFFFFF] border border-[#DED7CC] text-[10px]"
                        >
                          <strong className="text-[#9A783E]">{ev.eventType}</strong> •{' '}
                          <span className="text-[#686158]">
                            {ev.createdAt ? new Date(ev.createdAt).toLocaleString() : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {subTab === 'marketing' &&
        renderDomainAutomationView(
          'MARKETING',
          'Marketing & Abandoned Cart Recovery',
          'Multi-channel consented cart recovery, dynamic voucher generation, and campaign audience sync.',
          'cart.abandoned'
        )}

      {subTab === 'order' &&
        renderDomainAutomationView(
          'ORDER',
          'Order & Payment Lifecycle Automation',
          'Payment confirmation, high-value order tagging, cancellation handling, and refund verification.',
          'order.placed'
        )}

      {subTab === 'inventory' &&
        renderDomainAutomationView(
          'INVENTORY',
          'Inventory & Flacon Reserve Automation',
          'Real-time low-stock threshold alerts, automatic stock reservation/release, and restock tasks.',
          'inventory.below_threshold'
        )}

      {subTab === 'shipping' &&
        renderDomainAutomationView(
          'SHIPPING',
          'Shipping & Logistics Dispatch Automation',
          'AWB courier tracking notifications, dispatch alerts, and delivery confirmation triggers.',
          'order.dispatched'
        )}

      {subTab === 'discovery' && (
        <div className="space-y-8">
          <div className="bg-[#0E0E14] rounded-2xl p-6 border border-[#DED7CC] shadow-lg">
            <AdminCoupons initialView="discovery_journeys" />
          </div>
          {renderDomainAutomationView(
            'DISCOVERY',
            'Discovery Kit 2ml/8ml-to-100ml Conversion Workflows',
            'Automated workflow blueprints triggered on discovery kit purchases and post-delivery favorite selection.',
            'discovery.purchased'
          )}
        </div>
      )}

      {subTab === 'influencer' && (
        <div className="space-y-8">
          <div className="bg-[#0E0E14] rounded-2xl p-6 border border-[#DED7CC] shadow-lg">
            <AdminInfluencers initialView="roster_tracking" />
          </div>
          {renderDomainAutomationView(
            'INFLUENCER',
            'Influencer & Creator Attribution Automation',
            'Tracks creator referral coupon redemptions and logs partner commission attribution events.',
            'coupon.redeemed'
          )}
        </div>
      )}

      {subTab === 'review_retention' && (
        <div className="space-y-8">
          <div className="bg-[#0E0E14] rounded-2xl p-6 border border-[#DED7CC] shadow-lg">
            <AdminCoupons initialView="loyalty" />
          </div>
          {renderDomainAutomationView(
            'RETENTION',
            'Review Solicitation & Connoisseur Retention',
            'Post-delivery fragrance review prompts, 5-star VIP tagging, and repeat purchase journeys.',
            'order.delivered'
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 12. SCHEDULED JOBS (TIMEZONE-AWARE ASIA/KOLKATA)                      */}
      {/* ===================================================================== */}
      {subTab === 'scheduled' && (
        <div className="space-y-6">
          <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl p-5 space-y-4">
            <h3 className="font-serif text-base uppercase tracking-wider text-[#24211D] font-bold">
              Create Timezone-Aware Scheduled Job (Asia/Kolkata)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input
                type="text"
                value={newSchedName}
                onChange={(e) => setNewSchedName(e.target.value)}
                placeholder="Job Name (e.g. Daily Low Stock Audit)"
                className="bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2 text-xs"
              />
              <input
                type="text"
                value={newSchedCron}
                onChange={(e) => setNewSchedCron(e.target.value)}
                placeholder="Cron (e.g. 0 9 * * *)"
                className="bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2 text-xs"
              />
              <select
                value={newSchedWorkflowId}
                onChange={(e) => setNewSchedWorkflowId(e.target.value)}
                className="bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2 text-xs"
              >
                {workflows.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
              <button
                onClick={handleCreateSchedule}
                className="px-4 py-2 rounded-lg bg-[#24211D] text-[#FAF8F4] text-xs font-bold hover:bg-[#9A783E] cursor-pointer"
              >
                Create Schedule
              </button>
            </div>
          </div>

          <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl p-5 space-y-4">
            <h3 className="font-serif text-base uppercase tracking-wider text-[#24211D] font-bold">
              Active Scheduled Tasks ({schedules.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#DED7CC] text-[10px] uppercase text-[#686158]">
                    <th className="py-2">Schedule Name</th>
                    <th className="py-2">Cron</th>
                    <th className="py-2">Timezone</th>
                    <th className="py-2">Next Run</th>
                    <th className="py-2">Last Run</th>
                    <th className="py-2">Status</th>
                    <th className="py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DED7CC]">
                  {schedules.map((sch) => (
                    <tr key={sch.id} className="hover:bg-[#FAF8F4]">
                      <td className="py-3 font-bold text-[#24211D]">{sch.name}</td>
                      <td className="py-3 text-[#9A783E] font-bold">{sch.cronExpression}</td>
                      <td className="py-3 text-[#686158]">{sch.timezone}</td>
                      <td className="py-3 text-[#24211D]">
                        {sch.nextRunAt ? new Date(sch.nextRunAt).toLocaleString() : '—'}
                      </td>
                      <td className="py-3 text-[#686158]">
                        {sch.lastRunAt ? new Date(sch.lastRunAt).toLocaleString() : 'Never'}
                      </td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                          {sch.status}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => handleRunScheduleNow(sch.id)}
                          className="px-3 py-1 rounded bg-[#24211D] text-[#FAF8F4] text-[10px] font-bold hover:bg-[#9A783E] cursor-pointer"
                        >
                          Execute Now
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 13. EVENT INSPECTOR (14-FIELD LEDGER + REPLAY + LIVE DISPATCHER)      */}
      {/* ===================================================================== */}
      {subTab === 'events' && (
        <div className="space-y-6">
          <AdminProductionAuditAndInspector initialView="inspector" compactHeader={false} />

          <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl p-5 space-y-4">
            <h3 className="font-serif text-base uppercase tracking-wider text-[#24211D] font-bold">
              Dispatch Real Server-Side Event (Idempotent Ingestion)
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] uppercase text-[#686158] block mb-1">
                    Event Type (All 20 Supported)
                  </label>
                  <select
                    value={customEventType}
                    onChange={(e) => setCustomEventType(e.target.value)}
                    className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2 text-xs"
                  >
                    {TRIGGER_CATALOG.map((t) => (
                      <option key={t.type} value={t.type}>
                        {t.label} ({t.type})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase text-[#686158] block mb-1">
                    Target Customer Email
                  </label>
                  <input
                    type="email"
                    value={customEventEmail}
                    onChange={(e) => setCustomEventEmail(e.target.value)}
                    className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2 text-xs"
                  />
                </div>
                <button
                  onClick={handleDispatchLiveEvent}
                  className="w-full py-2.5 rounded-lg bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors"
                >
                  Ingest &amp; Execute Matching Workflows
                </button>
              </div>
              <div className="lg:col-span-2">
                <label className="text-[10px] uppercase text-[#686158] block mb-1">
                  Event JSON Payload
                </label>
                <textarea
                  rows={5}
                  value={customEventPayload}
                  onChange={(e) => setCustomEventPayload(e.target.value)}
                  className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg p-3 text-xs font-mono"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 14. EXECUTION HISTORY (PERSISTENT QUEUE + STEP LOGS)                  */}
      {/* ===================================================================== */}
      {subTab === 'history' && (
        <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#DED7CC] pb-3">
            <div>
              <h3 className="font-serif text-base uppercase tracking-wider text-[#24211D] font-bold">
                Workflow Execution History (`automation_jobs` • {recentJobs.length})
              </h3>
              <p className="text-xs text-[#686158]">
                Every execution is persisted in PostgreSQL with node-by-node structured step logs.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#DED7CC] text-[10px] uppercase text-[#686158]">
                  <th className="py-2.5">Job ID</th>
                  <th className="py-2.5">Workflow</th>
                  <th className="py-2.5">Trigger</th>
                  <th className="py-2.5">Status</th>
                  <th className="py-2.5">Attempts</th>
                  <th className="py-2.5">Latency</th>
                  <th className="py-2.5">Created</th>
                  <th className="py-2.5 text-right">Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DED7CC]">
                {recentJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-[#FAF8F4]">
                    <td className="py-3 font-bold text-[#24211D]">{job.id}</td>
                    <td className="py-3 text-[#24211D]">{job.workflowName}</td>
                    <td className="py-3 text-[#9A783E]">{job.triggerType}</td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          job.status === 'COMPLETED'
                            ? 'bg-emerald-50 text-emerald-700'
                            : job.status === 'FAILED' || job.status === 'DEAD_LETTER'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-amber-50 text-amber-800'
                        }`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="py-3 text-[#686158]">
                      {job.attempts}/{job.maxAttempts}
                    </td>
                    <td className="py-3 text-[#686158]">{job.latencyMs || 0} ms</td>
                    <td className="py-3 text-[#686158]">
                      {job.createdAt ? new Date(job.createdAt).toLocaleString() : '—'}
                    </td>
                    <td className="py-3 text-right space-x-2">
                      <button
                        onClick={() => setSelectedJobForLogs(job)}
                        className="px-2.5 py-1 rounded bg-[#F1EDE5] text-[#24211D] text-[10px] font-bold cursor-pointer"
                      >
                        Step Logs ({Array.isArray(job.stepLogs) ? job.stepLogs.length : 0})
                      </button>
                      <button
                        onClick={() => handleReprocessJob(job.id)}
                        className="px-2.5 py-1 rounded bg-[#24211D] text-[#FAF8F4] text-[10px] font-bold cursor-pointer"
                      >
                        Reprocess
                      </button>
                      {(job.status === 'PENDING' || job.status === 'WAITING') && (
                        <button
                          onClick={() => handleCancelJob(job.id)}
                          className="px-2.5 py-1 rounded bg-rose-100 text-rose-800 text-[10px] font-bold cursor-pointer"
                        >
                          Cancel
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

      {/* ===================================================================== */}
      {/* 15. FAILED JOBS & DEAD-LETTER QUEUE (MANUAL REPROCESSING)             */}
      {/* ===================================================================== */}
      {subTab === 'failed' && (
        <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#DED7CC] pb-3">
            <div>
              <h3 className="font-serif text-base uppercase tracking-wider text-[#24211D] font-bold">
                Failed Jobs &amp; Dead-Letter Queue (DLQ)
              </h3>
              <p className="text-xs text-[#686158]">
                Jobs that exhausted exponential backoff retries or hit provider errors can be inspected and manually reprocessed.
              </p>
            </div>
          </div>

          {recentJobs.filter(
            (j) => j.status === 'FAILED' || j.status === 'DEAD_LETTER' || j.status === 'RETRYING'
          ).length === 0 ? (
            <div className="p-8 text-center space-y-2 bg-[#FAF8F4] rounded-xl border border-[#DED7CC]">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
              <div className="font-serif text-base uppercase text-[#24211D]">
                Zero Failed or Dead-Letter Jobs
              </div>
              <p className="text-xs text-[#686158]">
                All queued workflow executions have completed cleanly.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentJobs
                .filter(
                  (j) =>
                    j.status === 'FAILED' || j.status === 'DEAD_LETTER' || j.status === 'RETRYING'
                )
                .map((job) => (
                  <div
                    key={job.id}
                    className="p-4 rounded-xl bg-rose-50/40 border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold">
                          {job.status}
                        </span>
                        <span className="font-bold text-[#24211D]">
                          {job.workflowName} ({job.id})
                        </span>
                      </div>
                      <div className="text-xs text-rose-700 font-semibold">
                        Error: {job.lastError || 'Execution error'}
                      </div>
                      <div className="text-[10px] text-[#686158]">
                        Attempts: {job.attempts}/{job.maxAttempts} • Next retry:{' '}
                        {job.nextRunAt ? new Date(job.nextRunAt).toLocaleString() : 'Manual'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setSelectedJobForLogs(job)}
                        className="px-3 py-1.5 rounded bg-[#FFFFFF] border border-[#DED7CC] text-xs font-bold cursor-pointer"
                      >
                        Inspect Logs
                      </button>
                      <button
                        onClick={() => handleReprocessJob(job.id)}
                        className="px-3.5 py-1.5 rounded bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-bold cursor-pointer"
                      >
                        Manual Reprocess Now
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}

          <AdminProductionAuditAndInspector initialView="reliability" compactHeader={true} />
        </div>
      )}

      {/* ===================================================================== */}
      {/* 15B. PRODUCTION AUDIT, RECONCILIATION & 12-SCENARIO CHAOS SUITE       */}
      {/* ===================================================================== */}
      {subTab === 'production_audit' && (
        <AdminProductionAuditAndInspector initialView="audit" compactHeader={false} />
      )}

      {/* ===================================================================== */}
      {/* 15C. ENTERPRISE E2E INTEGRATION AUDIT, 7 JOURNEYS & 10 DELIVERABLES   */}
      {/* ===================================================================== */}
      {subTab === 'enterprise_audit' && <AdminEnterpriseArchitectureAudit />}

      {/* ===================================================================== */}
      {/* 16. INTEGRATIONS & REAL PROVIDER VERIFICATION                         */}
      {/* ===================================================================== */}
      {subTab === 'integrations' && (
        <div className="space-y-4">
          <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl p-5">
            <h3 className="font-serif text-base uppercase tracking-wider text-[#24211D] font-bold">
              Automation Provider &amp; Infrastructure Verification
            </h3>
            <p className="text-xs text-[#686158] mt-1">
              Honest live verification: no integration is reported as active unless verified through a real backend probe.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {integrations.map((prov) => {
              const testRes = providerTestResults[prov.id];
              return (
                <div
                  key={prov.id}
                  className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl p-5 space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-serif text-base uppercase text-[#24211D] font-bold">
                        {prov.name}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          prov.configured
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {prov.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#686158]">
                      Required Env: <span className="font-bold text-[#24211D]">{prov.envRequired}</span>
                    </div>
                    {testRes && (
                      <div
                        className={`p-2.5 rounded-lg text-[11px] ${
                          testRes.verified
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-50 text-amber-900 border border-amber-200'
                        }`}
                      >
                        {testRes.detail} ({testRes.latencyMs} ms)
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-[#DED7CC] flex items-center justify-between">
                    <span className="text-[10px] text-[#686158]">
                      {prov.verified ? 'Verified operational' : 'Pending external credentials'}
                    </span>
                    <button
                      onClick={() => handleVerifyIntegration(prov.id)}
                      disabled={verifyingProvider === prov.id}
                      className="px-3 py-1.5 rounded-lg bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-bold cursor-pointer"
                    >
                      {verifyingProvider === prov.id ? 'Testing...' : 'Run Live Verification'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 17. AI RECOMMENDATIONS (SERVER-SIDE GEMINI + ADMIN APPROVAL)          */}
      {/* ===================================================================== */}
      {subTab === 'ai_recommendations' && (
        <div className="space-y-6">
          <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-serif text-base uppercase tracking-wider text-[#24211D] font-bold">
                AI Workflow Optimization Studio
              </h3>
              <p className="text-xs text-[#686158] mt-1">
                Analyzes actual FRAGMORÉ orders, abandoned carts, and SKU stock levels to propose high-ROI workflows for Super Admin approval.
              </p>
            </div>
            <button
              onClick={handleGenerateAiRecommendations}
              disabled={isGeneratingAi}
              className="px-4 py-2.5 rounded-lg bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-bold flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-[#9A783E]" />
              <span>{isGeneratingAi ? 'Analyzing Store Data...' : 'Generate AI Recommendation'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recommendations.map((rec) => (
              <div
                key={rec.id}
                className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded bg-[#F1EDE5] text-[#9A783E] text-[10px] font-bold">
                    {rec.category} • {rec.confidence}% Confidence
                  </span>
                  <span className="text-[10px] font-bold text-[#686158]">{rec.status}</span>
                </div>
                <h4 className="font-serif text-base uppercase text-[#24211D] font-bold">
                  {rec.title}
                </h4>
                <p className="text-xs text-[#686158]">{rec.rationale}</p>
                <div className="text-xs font-bold text-emerald-700">
                  Projected Impact: {rec.estimatedImpact}
                </div>
                {rec.status === 'PENDING_APPROVAL' && (
                  <div className="flex items-center gap-2 pt-2 border-t border-[#DED7CC]">
                    <button
                      onClick={() => handleAiRecommendationDecision(rec.id, 'APPROVED')}
                      className="px-3 py-1.5 rounded bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                    >
                      Approve &amp; Build Draft Workflow
                    </button>
                    <button
                      onClick={() => handleAiRecommendationDecision(rec.id, 'REJECTED')}
                      className="px-3 py-1.5 rounded bg-rose-100 text-rose-800 text-xs font-bold cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 18. AUTOMATION SETTINGS & SECURITY GOVERNANCE                         */}
      {/* ===================================================================== */}
      {subTab === 'settings' && settings && (
        <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl p-6 space-y-6">
          <div className="border-b border-[#DED7CC] pb-3 flex items-center justify-between">
            <div>
              <h3 className="font-serif text-lg uppercase tracking-wider text-[#24211D] font-bold">
                Engine Concurrency, Rate Limits, Retention &amp; Security Governance
              </h3>
              <p className="text-xs text-[#686158]">
                Persisted in `automation_settings` — enforced on every server-side workflow run.
              </p>
            </div>
            <button
              onClick={handleSaveSettings}
              className="px-4 py-2 rounded-lg bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-bold cursor-pointer"
            >
              Save Engine Settings
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] uppercase text-[#686158] block mb-1 font-bold">
                Max Concurrent Worker Jobs
              </label>
              <input
                type="number"
                value={settings.maxConcurrency ?? 5}
                onChange={(e) =>
                  setSettings({ ...settings, maxConcurrency: Number(e.target.value) })
                }
                className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase text-[#686158] block mb-1 font-bold">
                Global Rate Limit (Jobs / Minute)
              </label>
              <input
                type="number"
                value={settings.globalRateLimitPerMinute ?? 120}
                onChange={(e) =>
                  setSettings({ ...settings, globalRateLimitPerMinute: Number(e.target.value) })
                }
                className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase text-[#686158] block mb-1 font-bold">
                Default Max Retries (Exponential Backoff)
              </label>
              <input
                type="number"
                value={settings.defaultMaxRetries ?? 3}
                onChange={(e) =>
                  setSettings({ ...settings, defaultMaxRetries: Number(e.target.value) })
                }
                className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase text-[#686158] block mb-1 font-bold">
                Approval Threshold: High-Value Discount (%)
              </label>
              <input
                type="number"
                value={settings.highDiscountThresholdPercent ?? 25}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    highDiscountThresholdPercent: Number(e.target.value)
                  })
                }
                className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase text-[#686158] block mb-1 font-bold">
                Approval Threshold: Bulk Inventory Delta (Units)
              </label>
              <input
                type="number"
                value={settings.bulkInventoryThresholdUnits ?? 50}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    bulkInventoryThresholdUnits: Number(e.target.value)
                  })
                }
                className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase text-[#686158] block mb-1 font-bold">
                Data Retention Window (Days)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={settings.dataRetentionDays ?? 90}
                  onChange={(e) =>
                    setSettings({ ...settings, dataRetentionDays: Number(e.target.value) })
                  }
                  className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2 text-xs"
                />
                <button
                  onClick={handlePurgeRetention}
                  className="px-3 py-2 rounded-lg bg-[#F1EDE5] border border-[#DED7CC] text-[10px] font-bold shrink-0 cursor-pointer"
                >
                  Run Purge
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#FAF8F4] border border-[#DED7CC] flex items-center justify-between">
            <div>
              <div className="font-bold text-[#24211D]">
                Emergency Global Automation Kill-Switch
              </div>
              <div className="text-[11px] text-[#686158]">
                Immediately pauses all background job processing while preserving incoming events in the queue.
              </div>
            </div>
            <button
              onClick={() =>
                setSettings({ ...settings, emergencyPauseAll: !settings.emergencyPauseAll })
              }
              className={`px-4 py-2 rounded-lg text-xs font-bold cursor-pointer ${
                settings.emergencyPauseAll
                  ? 'bg-rose-600 text-white'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-300'
              }`}
            >
              {settings.emergencyPauseAll ? 'PAUSED (Click to Resume)' : 'ENGINE RUNNING'}
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: STEP EXECUTION TRACE LOGS                                      */}
      {/* ===================================================================== */}
      {selectedJobForLogs && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedJobForLogs(null);
          }}
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
        >
          <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#DED7CC] pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase text-[#9A783E]">
                  STRUCTURED EXECUTION TRACE
                </span>
                <h3 className="font-serif text-lg uppercase text-[#24211D]">
                  {selectedJobForLogs.workflowName} ({selectedJobForLogs.id})
                </h3>
              </div>
              <button
                onClick={() => setSelectedJobForLogs(null)}
                className="px-3 py-1 rounded bg-[#F1EDE5] text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {(Array.isArray(selectedJobForLogs.stepLogs)
                ? selectedJobForLogs.stepLogs
                : []
              ).map((step: any, i: number) => (
                <div
                  key={i}
                  className="p-3 rounded-lg bg-[#FAF8F4] border border-[#DED7CC] space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#24211D]">
                      {i + 1}. [{step.nodeType}] {step.nodeLabel}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        step.status === 'FAILED'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {step.status} ({step.durationMs || 0} ms)
                    </span>
                  </div>
                  <div className="text-[11px] text-[#686158]">{step.detail}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: EVENT JSON PAYLOAD INSPECTOR                                   */}
      {/* ===================================================================== */}
      {selectedEventForInspect && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedEventForInspect(null);
          }}
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
        >
          <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#DED7CC] pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase text-[#9A783E]">
                  IMMUTABLE EVENT PAYLOAD
                </span>
                <h3 className="font-serif text-lg uppercase text-[#24211D]">
                  {selectedEventForInspect.eventType} ({selectedEventForInspect.id})
                </h3>
              </div>
              <button
                onClick={() => setSelectedEventForInspect(null)}
                className="px-3 py-1 rounded bg-[#F1EDE5] text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
            <pre className="p-4 rounded-xl bg-[#FAF8F4] border border-[#DED7CC] text-[11px] overflow-x-auto max-h-80">
              {JSON.stringify(selectedEventForInspect, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
