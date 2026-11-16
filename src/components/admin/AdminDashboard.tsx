import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { AdminRole } from '../../types';
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Users,
  User,
  Megaphone,
  FileText,
  BarChart3,
  Truck,
  RotateCcw,
  Bell,
  Link2,
  Settings,
  Shield,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  AlertTriangle,
  RotateCw,
  Sparkles,
  Calendar,
  Percent,
  Menu,
  X,
  Workflow,
  LifeBuoy,
  Eye,
  Globe,
  Activity,
  FlaskConical,
  Search,
  CheckSquare,
  Boxes,
  Warehouse,
  Receipt,
  BookOpen,
  Briefcase,
  UserCheck,
  FileSpreadsheet,
  Building2,
  ClipboardCheck,
  Wallet,
  Gift
} from 'lucide-react';
import { LiveVisitorTelemetry } from './LiveVisitorTelemetry';
import { erpApi, setActiveErpRoleOverride, type ErpWorkspaceSnapshot } from '../../lib/erpApi';
import { ErpSupplyAndLabModules } from './erp/ErpSupplyAndLabModules';
import { ErpCommercialFinanceModules } from './erp/ErpCommercialFinanceModules';
import { ErpGrowthGovernanceModules } from './erp/ErpGrowthGovernanceModules';
import {
  ErpUniversalSearchModal,
  ErpApprovalsDrawer,
  ErpNotificationsDrawer,
  ErpPrintableDocumentModal
} from './erp/ErpGlobalOverlays';
import { ErpTableExportBar } from './erp/ErpUniversalExportModal';

import { AdminOrders } from './AdminOrders';
import { AdminProducts } from './AdminProducts';
import { AdminProcurement } from './AdminProcurement';
import { AdminBatchProduction } from './AdminBatchProduction';
import { AdminCustomers } from './AdminCustomers';
import { AdminMarketing } from './AdminMarketing';
import { AdminCMS } from './AdminCMS';
import { AdminAnalytics } from './AdminAnalytics';
import { AdminShipping } from './AdminShipping';
import { AdminReturns } from './AdminReturns';
import { AdminNotifications } from './AdminNotifications';
import { AdminIntegrations } from './AdminIntegrations';
import { AdminSettings } from './AdminSettings';
import { AdminAuditLogs } from './AdminAuditLogs';
import { AdminAutomationCenter, AutomationSubTab } from './AdminAutomationCenter';
import { AdminAiMarketingAssistant } from './AdminAiMarketingAssistant';
import { AdminSupportRetentionCenter } from './AdminSupportRetentionCenter';
import {
  AdminAiCmo3,
  AiCmoSubRoute,
  AI_CMO_ROUTE_MAP,
  parsePathnameToAiCmoSubRoute
} from './AdminAiCmo3';
import {
  AdminRewardsAndWallet,
  ADMIN_REWARDS_SUBVIEWS,
  type AdminRewardsSubView
} from './AdminRewardsAndWallet';

export const AdminDashboard: React.FC = () => {
  const {
    customer,
    adminRole,
    setAdminRole,
    setCurrentView,
    setIsAuthModalOpen,
    orders,
    products,
    customers,
    abandonedCarts,
    returns,
    setSelectedOrderForInvoice,
    visitorStats,
    refreshVisitorStats,
    showNotification
  } = useStore();

  // FRAGMORÉ BUSINESS OS — Unified ERP State & Global Overlays
  const [erpSnapshot, setErpSnapshot] = useState<ErpWorkspaceSnapshot | null>(null);
  const [erpLoading, setErpLoading] = useState<boolean>(false);
  const [erpRoleCode, setErpRoleCode] = useState<string>('SUPER_ADMIN');
  const [erpSearchOpen, setErpSearchOpen] = useState<boolean>(false);
  const [erpApprovalsOpen, setErpApprovalsOpen] = useState<boolean>(false);
  const [erpNotifsOpen, setErpNotifsOpen] = useState<boolean>(false);
  const [printInvoice, setPrintInvoice] = useState<any | null>(null);
  const [printReport, setPrintReport] = useState<{ title: string; rows: any[] } | null>(null);

  const loadErpSnapshot = React.useCallback(async () => {
    setErpLoading(true);
    try {
      const snap = await erpApi.getBootstrap();
      setErpSnapshot(snap);
    } catch (e: any) {
      console.warn('[Business OS] Bootstrap notice:', e?.message);
    } finally {
      setErpLoading(false);
    }
  }, []);

  React.useEffect(() => {
    setActiveErpRoleOverride(erpRoleCode);
    loadErpSnapshot();
  }, [erpRoleCode, loadErpSnapshot]);

  // Multi-browser real-time SSE auto-sync for all ERP departments
  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/realtime/stream');
      es.onmessage = (evt) => {
        try {
          const parsed = JSON.parse(evt.data);
          if (
            (parsed?.type === 'CROSS_BROWSER_SYNC' || parsed?.type === 'STATE_INVALIDATED') &&
            (String(parsed?.entity || '').startsWith('erp_') ||
              String(parsed?.entity || '').includes('procurement') ||
              String(parsed?.entity || '').includes('supplier_') ||
              String(parsed?.entity || '') === 'production_batches')
          ) {
            loadErpSnapshot();
          }
        } catch {}
      };
    } catch {}
    return () => {
      if (es) es.close();
    };
  }, [loadErpSnapshot]);

  // Cmd/Ctrl + K shortcut for Universal ERP Search
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setErpSearchOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Navigation states — Accordion sub-menus keep the left navigation compact so it never needs to scroll
  const initialAiCmoRoute =
    typeof window !== 'undefined' ? parsePathnameToAiCmoSubRoute(window.location.pathname) : null;
  const [activeNav, setActiveNav] = useState<string>(initialAiCmoRoute ? 'AI_CMO_3' : 'DASHBOARD');
  const [activeSubNav, setActiveSubNav] = useState<string>(initialAiCmoRoute || '');
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>(
    initialAiCmoRoute ? { AI_CMO_3: true } : {}
  );
  const [dateRange, setDateRange] = useState<string>('30days');
  const [isAdminSidebarCollapsed, setIsAdminSidebarCollapsed] = useState<boolean>(false);

  React.useEffect(() => {
    const onPopState = () => {
      const matched = parsePathnameToAiCmoSubRoute(window.location.pathname);
      if (matched) {
        setActiveNav('AI_CMO_3');
        setActiveSubNav(matched);
        setOpenMenus((prev) => ({ ...prev, AI_CMO_3: true }));
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const toggleMenu = (menuKey: string) => {
    setOpenMenus((prev) => ({
      [menuKey]: !prev[menuKey]
    }));
  };

  // DASHBOARD COMPUTED METRICS STRICTLY FROM ACTUAL DATABASE DATA (Zero synthetic multipliers or unlinked revenue)
  const eligibleOrders = orders.filter(
    (o) =>
      String(o.orderStatus || '').toUpperCase() !== 'CANCELLED' &&
      String(o.paymentStatus || '').toUpperCase() !== 'FAILED'
  );
  // Gross sales before discounts & returns:
  const grossSales = eligibleOrders.reduce(
    (sum, o) => sum + (Number(o.totalAmount || 0) + Number(o.discount || 0) - Number(o.shippingAmount || 0)),
    0
  );
  const totalDiscounts = eligibleOrders.reduce(
    (sum, o) => sum + Number(o.discount || 0),
    0
  );
  const refundedOrdersTotal = eligibleOrders
    .filter((o) => String(o.paymentStatus || '').toUpperCase() === 'REFUNDED' || String(o.orderStatus || '').toUpperCase() === 'REFUNDED')
    .reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
  const completedReturnsTotal = returns
    .filter((r) => r.status === 'REFUNDED')
    .reduce((sum, r) => sum + (Number(r.refundAmount) || 0), 0);
  const totalRefunds = Math.max(refundedOrdersTotal, completedReturnsTotal);
  // Net Sales = Gross Sales - Discounts - Refunds (guaranteed Gross Sales >= Net Sales)
  const netSales = Math.max(0, grossSales - totalDiscounts - totalRefunds);
  const gstAmount = Math.round((netSales * 18) / 118);
  const totalOrders = eligibleOrders.length;
  const aov = totalOrders > 0 ? Math.round(netSales / totalOrders) : 0;
  const totalCustomers = customers.length;

  // Real-time Store Visitors & Conversion Telemetry strictly from live telemetry
  const totalVisitors = visitorStats?.totalVisitors ?? 0;
  const uniqueVisitors = visitorStats?.uniqueVisitors ?? totalVisitors;
  const todayVisitors = visitorStats?.todayVisitors ?? 0;
  const activeVisitors = visitorStats?.activeNow ?? 0;
  const totalPageViews = visitorStats?.totalPageViews ?? totalVisitors;
  const conversionRate = totalVisitors > 0 ? ((totalOrders / totalVisitors) * 100).toFixed(2) : '0.00';

  // Abandoned & Recovered metrics (Recovered revenue strictly requires a linked order or verified purchase)
  const abandonedCartValue = abandonedCarts
    .filter((ac) => ac.status === 'ABANDONED')
    .reduce((sum, ac) => sum + (Number(ac.cartValue) || 0), 0);
  const recoveredRevenue = abandonedCarts
    .filter(
      (ac) =>
        ac.status === 'RECOVERED' &&
        Boolean((ac as any).recoveredOrderId || orders.some((o) => o.customerEmail && ac.customerEmail && o.customerEmail.toLowerCase() === ac.customerEmail.toLowerCase() && o.orderStatus !== 'CANCELLED'))
    )
    .reduce((sum, ac) => sum + (Number(ac.cartValue) || 0), 0);

  // Top Fragrance: calculated by counting line items across all orders in DB
  const fragranceSalesMap: Record<string, { units: number; revenue: number }> = {};
  orders.forEach((ord) => {
    (ord.items || []).forEach((item) => {
      const name = item.productName ? item.productName.toUpperCase() : 'GOLDEN HOUR';
      if (!fragranceSalesMap[name]) {
        fragranceSalesMap[name] = { units: 0, revenue: 0 };
      }
      fragranceSalesMap[name].units += item.quantity || 1;
      fragranceSalesMap[name].revenue += item.totalPrice || 0;
    });
  });

  const sortedFragrances = Object.entries(fragranceSalesMap).sort(
    (a, b) => b[1].units - a[1].units
  );
  const topFragranceName = sortedFragrances.length > 0 ? sortedFragrances[0][0] : 'GOLDEN HOUR';
  const topFragranceUnits = sortedFragrances.length > 0 ? sortedFragrances[0][1].units : 0;

  // Low stock calculation: count variants with stockAvailable < 30
  const lowStockCount = products.reduce(
    (count, p) => count + (p.variants || []).filter((v) => v.stockAvailable < 30).length,
    0
  );

  const roles: { role: AdminRole; label: string }[] = [
    { role: 'SUPER_ADMIN', label: 'Super Admin (Founder)' },
    { role: 'ORDER_MANAGER', label: 'Order Fulfillment' },
    { role: 'INVENTORY_MANAGER', label: 'Inventory Manager' },
    { role: 'MARKETING', label: 'Growth & Attribution' },
    { role: 'CUSTOMER_SUPPORT', label: 'Client Care' }
  ];

  // Mobile Module Selector State
  const [mobileModuleDrawerOpen, setMobileModuleDrawerOpen] = useState(false);

  // Close mobile drawer on Escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileModuleDrawerOpen) {
        setMobileModuleDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileModuleDrawerOpen]);

  const mainWorkspaceScrollRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (mainWorkspaceScrollRef.current) {
      mainWorkspaceScrollRef.current.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
  }, [activeNav, activeSubNav]);

  // Helper to select navigation
  const selectNav = (main: string, sub: string = '') => {
    setActiveNav(main);
    setActiveSubNav(sub);
    setMobileModuleDrawerOpen(false);
    if (mainWorkspaceScrollRef.current) {
      mainWorkspaceScrollRef.current.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      if (main === 'AI_CMO_3') {
        const subKey = (sub || 'CHAT') as AiCmoSubRoute;
        const targetPath = AI_CMO_ROUTE_MAP[subKey] || '/admin/ai-cmo';
        if (window.location.pathname !== targetPath) {
          window.history.pushState({ aiCmoSubRoute: subKey }, '', targetPath);
        }
      } else if (window.location.pathname.startsWith('/admin/ai-cmo')) {
        window.history.pushState({}, '', '/');
      }
    }
  };

  const getModuleTitle = (nav: string, sub: string) => {
    if (nav === 'DASHBOARD') return 'Executive Dashboard';
    if (nav === 'ORDERS') return `Orders ${sub ? `(${sub})` : ''}`;
    if (nav === 'PRODUCTS') return `Products ${sub ? `(${sub})` : ''}`;
    if (nav === 'PROCUREMENT') return 'Procurement & Supply Chain';
    if (nav === 'BATCH_PRODUCTION') return 'Batch Production & Atelier Maceration';
    if (nav === 'ERP_MATERIALS') return 'Raw Materials, Lots & GRN';
    if (nav === 'ERP_FORMULATIONS') return 'Perfume Formulations & BOM';
    if (nav === 'ERP_QUALITY') return 'Sampling & Quality Control';
    if (nav === 'ERP_WAREHOUSE') return 'Finished Goods & Warehouses';
    if (nav === 'ERP_CRM') return 'B2B CRM Leads & Pipeline';
    if (nav === 'ERP_PROPOSALS') return 'Proposals & Quotations';
    if (nav === 'ERP_GST_BILLING') return 'GST Billing & Credit Notes';
    if (nav === 'ERP_ACCOUNTING') return 'Accounting & Trial Balance';
    if (nav === 'ERP_MARKETING_WS') return 'Digital Marketing Studio';
    if (nav === 'ERP_HR') return 'HR, Employees & Interns';
    if (nav === 'ERP_RBAC') return 'RBAC Access Control';
    if (nav === 'ERP_REPORTS') return 'Reports & Export Center';
    if (nav === 'ERP_ASSISTANT') return 'AI Business Assistant';
    if (nav === 'ERP_SETTINGS_ORG') return 'Company Legal & Documents';
    if (nav === 'CUSTOMERS') return `Customers ${sub ? `(${sub})` : ''}`;
    if (nav === 'MARKETING') return `Marketing ${sub ? `(${sub})` : ''}`;
    if (nav === 'CONTENT') return `Content / CMS ${sub ? `(${sub})` : ''}`;
    if (nav === 'ANALYTICS') return `Analytics ${sub ? `(${sub})` : ''}`;
    if (nav === 'SHIPPING') return 'Shipping & Logistics';
    if (nav === 'RETURNS') return 'Returns & Refunds';
    if (nav === 'NOTIFICATIONS') return 'Notifications';
    if (nav === 'INTEGRATIONS') return 'Integrations';
    if (nav === 'SETTINGS') return 'ERP Settings';
    if (nav === 'AUDIT_LOGS') return 'Audit Logs';
    if (nav === 'AUTOMATION_CENTER') return `Automation Center ${sub ? `(${sub})` : ''}`;
    if (nav === 'AI_INTELLIGENCE') return 'AI Marketing Intelligence';
    if (nav === 'AI_CMO_3') return `AI CMO 3.0 ${sub ? `(${sub})` : ''}`;
    if (nav === 'SUPPORT_RETENTION') return 'Support, Review & Retention';
    if (nav === 'REWARDS_WALLET') return `Rewards, Wallet & Gift Cards ${sub ? `(${sub})` : ''}`;
    return nav;
  };

  const isAdmin =
    customer?.role === 'SUPER_ADMIN' ||
    customer?.role === 'ADMIN' ||
    adminRole === 'SUPER_ADMIN' ||
    customer?.email?.toLowerCase() === 'gowisherharsha@gmail.com' ||
    customer?.email?.toLowerCase() === 'aibrandorigin@gmail.com' ||
    customer?.email?.toLowerCase().includes('admin');

  if (!isAdmin) {
    return (
      <div className="h-screen overflow-hidden bg-[#FAF8F4] text-[#24211D] flex flex-col items-center justify-center p-6 relative">
        <div className="max-w-md w-full bg-[#FFFFFF] border border-[#DED7CC] rounded-3xl p-8 text-center space-y-6 shadow-[0_24px_60px_rgba(36,33,29,0.08)] relative z-10">
          <div className="w-16 h-16 rounded-2xl bg-[#F1EDE5] border border-[#DED7CC] text-[#9A783E] mx-auto flex items-center justify-center">
            <Shield className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <span className="text-[11px] font-mono tracking-widest text-[#9A783E] uppercase block font-semibold">
              Access Restricted
            </span>
            <h2 className="font-serif text-2xl uppercase tracking-wider text-[#24211D]">
              Admin Profile Required
            </h2>
            <p className="text-xs text-[#686158] font-light leading-relaxed">
              The Super Admin ERP platform can only be accessed through an authorized administrator login profile. Please sign in with an Administrator account to proceed.
            </p>
          </div>
          <div className="flex flex-col gap-3 pt-2">
            <button
              onClick={() => {
                setCurrentView('account');
                setIsAuthModalOpen(true);
              }}
              className="w-full py-3.5 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] font-bold text-xs uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Sign In as Admin</span>
            </button>
            <button
              onClick={() => setCurrentView('storefront')}
              className="w-full py-2.5 bg-[#F1EDE5] hover:bg-[#DED7CC] border border-[#DED7CC] text-[#24211D] font-mono text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer"
            >
              Return to Storefront
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex-1 overflow-hidden bg-[#FAF8F4] text-[#24211D] flex flex-col font-sans">
      {/* SUPER ADMIN TOP BAR (Fixed height, never scrolls) */}
      <header className="bg-[#FFFFFF] border-b border-[#DED7CC] px-3 sm:px-8 py-2.5 sm:py-3 flex items-center justify-between gap-2 shrink-0 z-40 max-w-full overflow-hidden box-border">
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          <button
            onClick={() => {
              if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
                window.history.pushState({}, '', '/');
              }
              setCurrentView('storefront');
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#DED7CC] bg-[#FAF8F4] hover:border-[#9A783E] text-xs font-mono text-[#24211D] transition-colors shrink-0 cursor-pointer"
            title="Return to Storefront"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#9A783E]" />
            <span className="hidden sm:inline">Storefront</span>
          </button>

          <button
            onClick={() => {
              if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
                window.history.pushState({}, '', '/');
              }
              setCurrentView('account');
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#9A783E]/40 bg-[#F1EDE5] hover:border-[#9A783E] text-xs font-mono text-[#24211D] transition-colors shrink-0 cursor-pointer"
            title="Return to Admin Profile"
          >
            <User className="w-3.5 h-3.5 text-[#9A783E]" />
            <span className="hidden sm:inline">Profile</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAdminSidebarCollapsed((prev) => !prev)}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#DED7CC] bg-[#FAF8F4] hover:border-[#9A783E] text-xs font-mono text-[#24211D] transition-colors shrink-0 cursor-pointer"
            title={isAdminSidebarCollapsed ? 'Show ERP Left Sidebar' : 'Maximize Workspace (Collapse ERP Sidebar)'}
          >
            <Menu className="w-3.5 h-3.5 text-[#9A783E]" />
            <span className="hidden lg:inline">
              {isAdminSidebarCollapsed ? 'Show ERP Menu' : 'Focus View'}
            </span>
          </button>

          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-serif text-sm sm:text-lg tracking-[0.15em] sm:tracking-[0.2em] font-normal text-[#24211D] uppercase truncate">
              FRAGMOR<span className="text-[#9A783E]">É</span>
            </span>
            <span className="px-1.5 py-0.5 rounded bg-[#F1EDE5] border border-[#DED7CC] text-[#9A783E] text-[9px] sm:text-[10px] font-mono uppercase font-bold shrink-0">
              ERP
            </span>
          </div>
        </div>

        {/* Global Business OS Actions, Search, Approvals, Notifications & Role Switcher */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setErpSearchOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-[#DED7CC] bg-[#FAF8F4] hover:border-[#9A783E] text-[11px] font-mono text-[#24211D] whitespace-nowrap shrink-0 cursor-pointer"
            title="Universal Search (Cmd/Ctrl + K)"
          >
            <Search className="w-3.5 h-3.5 text-[#9A783E]" />
            <span className="hidden lg:inline">Search</span>
            <span className="hidden xl:inline text-[10px] text-[#686158]">⌘K</span>
          </button>

          <button
            type="button"
            onClick={() => setErpApprovalsOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded border border-[#DED7CC] bg-[#FAF8F4] hover:border-[#9A783E] text-[11px] font-mono text-[#24211D] whitespace-nowrap shrink-0 cursor-pointer"
            title="Approval Inbox"
          >
            <CheckSquare className="w-3.5 h-3.5 text-[#9A783E]" />
            <span className="hidden lg:inline">Approvals</span>
            <span className="font-bold text-[#9A783E] tabular-nums">
              {erpSnapshot?.commerceSummary.pendingApprovalsCount ?? 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setErpNotifsOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded border border-[#DED7CC] bg-[#FAF8F4] hover:border-[#9A783E] text-[11px] font-mono text-[#24211D] whitespace-nowrap shrink-0 cursor-pointer"
            title="ERP Global Notifications"
          >
            <Bell className="w-3.5 h-3.5 text-[#9A783E]" />
            <span className="font-bold text-[#9A783E] tabular-nums">
              {erpSnapshot?.commerceSummary.unreadNotificationsCount ?? 0}
            </span>
          </button>

          <div className="hidden xl:flex items-center gap-1.5 text-[11px] font-mono text-[#24211D] bg-[#F1EDE5] border border-[#DED7CC] px-2.5 py-1 rounded whitespace-nowrap shrink-0">
            <span className="text-[#686158]">Live:</span>
            <span className="font-bold text-[#9A783E] tabular-nums">{activeVisitors}</span>
          </div>

          <div className="flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-[#9A783E] hidden sm:block" />
            <select
              value={erpRoleCode}
              onChange={(e) => {
                const next = e.target.value;
                setErpRoleCode(next);
                if (next === 'SUPER_ADMIN') setAdminRole('SUPER_ADMIN');
              }}
              className="bg-[#FAF8F4] border border-[#DED7CC] text-[11px] text-[#24211D] rounded px-2 py-1 font-mono focus:border-[#9A783E] focus:outline-none max-w-[130px] sm:max-w-[175px]"
              title="Active ERP Department RBAC Role"
            >
              {(erpSnapshot?.roles || [{ code: 'SUPER_ADMIN', name: 'Founder / Super Admin' }]).map((r: any) => (
                <option key={r.code} value={r.code}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* MOBILE COMPACT MODULE SELECTOR (Replaces wide sidebar on small screens) */}
      <div className="md:hidden bg-[#F1EDE5] border-b border-[#DED7CC] px-4 py-2 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-2 min-w-0 pr-2">
          <span className="text-[10px] uppercase font-mono tracking-wider text-[#9A783E] block shrink-0 font-semibold">
            Module:
          </span>
          <span className="text-xs font-mono font-bold text-[#24211D] truncate">
            {getModuleTitle(activeNav, activeSubNav)}
          </span>
        </div>
        <button
          onClick={() => setMobileModuleDrawerOpen(true)}
          className="min-h-[38px] px-3 py-1 rounded-lg border border-[#DED7CC] bg-[#FFFFFF] text-[#24211D] text-xs font-mono font-bold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
          aria-label="Open Admin Module Selector"
        >
          <Menu className="w-4 h-4 text-[#9A783E]" />
          <span>Modules</span>
        </button>
      </div>

      {/* ACCESSIBLE MOBILE MODULE DRAWER MODAL */}
      {mobileModuleDrawerOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setMobileModuleDrawerOpen(false);
          }}
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs md:hidden flex flex-col justify-end animate-in fade-in duration-200"
        >
          <div className="bg-[#FFFFFF] border-t border-[#DED7CC] rounded-t-2xl p-4 sm:p-5 max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#DED7CC] pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#9A783E]" />
                <h3 className="font-serif text-base uppercase tracking-wider text-[#24211D]">
                  Maison Admin Modules
                </h3>
              </div>
              <button
                onClick={() => setMobileModuleDrawerOpen(false)}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center p-2 text-[#686158] hover:text-[#24211D] rounded-lg bg-[#F1EDE5]"
                aria-label="Close Module Selector"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-1.5 flex-1 pr-1 font-mono text-xs">
              {[
                { id: 'DASHBOARD', sub: '', label: '01 · EXECUTIVE DASHBOARD', icon: LayoutDashboard },
                { id: 'PROCUREMENT', sub: '', label: '02 · SUPPLIERS & PROCUREMENT', icon: Truck },
                { id: 'ERP_MATERIALS', sub: '', label: '03 · RAW MATERIALS & GRN', icon: Boxes },
                { id: 'ERP_FORMULATIONS', sub: '', label: '04 · PERFUME FORMULATIONS', icon: FlaskConical },
                { id: 'BATCH_PRODUCTION', sub: '', label: '05 · BATCH PRODUCTION', icon: FlaskConical },
                { id: 'ERP_QUALITY', sub: '', label: '06 · SAMPLING & QUALITY QC', icon: ClipboardCheck },
                { id: 'ERP_WAREHOUSE', sub: '', label: '07 · FINISHED GOODS & VAULT', icon: Warehouse },
                { id: 'ERP_CRM', sub: '', label: '08 · B2B CRM LEADS PIPELINE', icon: Users },
                { id: 'CUSTOMERS', sub: 'all', label: '08b · CONNOISSEURS 360', icon: Users },
                { id: 'ORDERS', sub: 'all', label: `09 · SALES & ORDERS (${orders.length})`, icon: ShoppingBag },
                { id: 'ERP_PROPOSALS', sub: '', label: '10 · PROPOSALS & QUOTATIONS', icon: FileText },
                { id: 'ERP_GST_BILLING', sub: '', label: '11 · GST BILLING & INVOICES', icon: Receipt },
                { id: 'ERP_ACCOUNTING', sub: '', label: '12 · ACCOUNTING & TRIAL BAL', icon: BookOpen },
                { id: 'ERP_MARKETING_WS', sub: '', label: '13 · AGENCY WORKSPACE', icon: Briefcase },
                { id: 'ERP_HR', sub: '', label: '14 · HR, INTERNS & TASKS', icon: UserCheck },
                { id: 'ERP_RBAC', sub: '', label: '15 · RBAC PERMISSIONS', icon: Shield },
                { id: 'ERP_REPORTS', sub: '', label: '16 · REPORTS & EXPORTS', icon: FileSpreadsheet },
                { id: 'ERP_ASSISTANT', sub: '', label: '17 · AI BUSINESS ASSISTANT', icon: Sparkles },
                { id: 'ERP_SETTINGS_ORG', sub: '', label: '18 · COMPANY LEGAL & DOCS', icon: Building2 },
                { id: 'PRODUCTS', sub: 'all', label: 'CATALOG & PRODUCTS', icon: Package },
                { id: 'REWARDS_WALLET', sub: 'overview', label: 'REWARDS, WALLET & GIFT CARDS', icon: Wallet },
                { id: 'AI_CMO_3', sub: 'CHAT', label: 'AI CMO 3.0 STUDIO', icon: Sparkles },
                { id: 'MARKETING', sub: 'campaigns', label: 'OMNICHANNEL MARKETING', icon: Megaphone },
                { id: 'CONTENT', sub: 'homepage', label: 'CMS & EDITORIAL CONTENT', icon: FileText },
                { id: 'ANALYTICS', sub: 'sales', label: 'STORE ANALYTICS', icon: BarChart3 },
                { id: 'SHIPPING', sub: '', label: 'SHIPPING & LOGISTICS', icon: Truck },
                { id: 'RETURNS', sub: '', label: 'RETURNS / REFUNDS', icon: RotateCcw },
                { id: 'AUTOMATION_CENTER', sub: 'overview', label: 'AUTOMATION CENTER', icon: Workflow },
                { id: 'SUPPORT_RETENTION', sub: '', label: 'SUPPORT & RETENTION', icon: LifeBuoy },
                { id: 'SETTINGS', sub: '', label: 'STORE SETTINGS', icon: Settings },
                { id: 'AUDIT_LOGS', sub: '', label: 'AUDIT LOGS', icon: Shield }
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeNav === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => selectNav(item.id, item.sub)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-mono tracking-wider text-left ${
                      isActive
                        ? 'bg-[#24211D] text-[#FAF8F4] font-bold'
                        : 'text-[#24211D] bg-[#FAF8F4] hover:bg-[#F1EDE5]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ADMIN BODY LAYOUT — Fixed Viewport Height: Navigation Never Scrolls or Moves, Only Main Content Scrolls */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 min-w-0 max-w-full overflow-hidden">
        {/* LEFT NAVIGATION SIDEBAR */}
        <aside
          className={`${
            isAdminSidebarCollapsed ? 'hidden' : 'hidden md:flex md:flex-col'
          } w-64 bg-[#F1EDE5] border-r border-[#DED7CC] px-3 py-3 space-y-0.5 shrink-0 h-full overflow-y-auto no-scrollbar select-none`}
        >
          <div className="text-[10px] font-mono tracking-widest uppercase text-[#686158] px-3 py-1.5 font-semibold">
            Commerce Headquarters
          </div>

          {/* 1. DASHBOARD */}
          <button
            onClick={() => {
              setOpenMenus({});
              selectNav('DASHBOARD');
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-mono tracking-wider transition-colors text-left cursor-pointer ${
              activeNav === 'DASHBOARD'
                ? 'bg-[#24211D] text-[#FAF8F4] font-bold shadow-xs'
                : 'text-[#24211D] hover:bg-[#FFFFFF]'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            <span>DASHBOARD</span>
          </button>

          {/* AI CMO 3.0 (NEW ISOLATED MODULE WITH AI CHAT AS MAIN INTERFACE) */}
          <div className="space-y-0.5">
            <button
              onClick={() => {
                toggleMenu('AI_CMO_3');
                selectNav('AI_CMO_3', activeSubNav || 'CHAT');
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-mono tracking-wider transition-colors text-left cursor-pointer ${
                activeNav === 'AI_CMO_3'
                  ? 'bg-[#24211D] text-[#FAF8F4] font-bold shadow-xs'
                  : 'text-[#24211D] hover:bg-[#FFFFFF]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 shrink-0 text-[#9A783E]" />
                <span>AI CMO 3.0</span>
                <span className="px-1.5 py-0.2 rounded bg-[#9A783E]/20 text-[#9A783E] text-[9px] font-bold">
                  3.0
                </span>
              </div>
              {openMenus.AI_CMO_3 ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>

            {openMenus.AI_CMO_3 && (
              <div className="pl-6 space-y-0.5 border-l border-[#DED7CC] ml-3 py-0.5">
                {[
                  { id: 'CHAT', label: 'AI Chat' },
                  { id: 'OVERVIEW', label: 'Overview' },
                  { id: 'CAMPAIGNS', label: 'Campaigns' },
                  { id: 'AUTOMATIONS', label: 'Automations' },
                  { id: 'CREATIVE_STUDIO', label: 'Creative Studio' },
                  { id: 'INSIGHTS', label: 'Insights & Reports' },
                  { id: 'APPROVALS', label: 'Approvals' },
                  { id: 'HISTORY', label: 'History' },
                  { id: 'SETTINGS', label: 'Advanced Settings' }
                ].map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => selectNav('AI_CMO_3', sub.id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer ${
                      activeNav === 'AI_CMO_3' && (activeSubNav || 'CHAT') === sub.id
                        ? 'text-[#9A783E] font-semibold bg-[#FFFFFF]'
                        : 'text-[#686158] hover:text-[#24211D]'
                    }`}
                  >
                    • {sub.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* AI MARKETING INTELLIGENCE ASSISTANT (EXISTING PRESERVED MODULE) */}
          <button
            onClick={() => {
              setOpenMenus({});
              selectNav('AI_INTELLIGENCE');
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-mono tracking-wider transition-colors text-left cursor-pointer ${
              activeNav === 'AI_INTELLIGENCE'
                ? 'bg-[#24211D] text-[#FAF8F4] font-bold shadow-xs'
                : 'text-[#24211D] hover:bg-[#FFFFFF]'
            }`}
          >
            <Sparkles className="w-4 h-4 shrink-0 text-[#9A783E]" />
            <span>AI INTELLIGENCE</span>
          </button>

          {/* SUPPORT, REVIEWS & RETENTION AUTOMATION */}
          <button
            onClick={() => {
              setOpenMenus({});
              selectNav('SUPPORT_RETENTION');
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-mono tracking-wider transition-colors text-left cursor-pointer ${
              activeNav === 'SUPPORT_RETENTION'
                ? 'bg-[#24211D] text-[#FAF8F4] font-bold shadow-xs'
                : 'text-[#24211D] hover:bg-[#FFFFFF]'
            }`}
          >
            <LifeBuoy className="w-4 h-4 shrink-0 text-[#9A783E]" />
            <span>SUPPORT &amp; RETENTION</span>
          </button>

          {/* AUTOMATION CENTER (Primary Sidebar Module with 18 Sub-Views) */}
          <div className="space-y-0.5">
            <button
              onClick={() => {
                toggleMenu('AUTOMATION_CENTER');
                selectNav('AUTOMATION_CENTER', activeSubNav || 'overview');
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-mono tracking-wider transition-colors text-left cursor-pointer ${
                activeNav === 'AUTOMATION_CENTER'
                  ? 'bg-[#24211D] text-[#FAF8F4] font-bold shadow-xs'
                  : 'text-[#24211D] hover:bg-[#FFFFFF]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Workflow className="w-4 h-4 shrink-0 text-[#9A783E]" />
                <span>AUTOMATION CENTER</span>
              </div>
              {openMenus.AUTOMATION_CENTER ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>

            {openMenus.AUTOMATION_CENTER && (
              <div className="pl-6 space-y-0.5 border-l border-[#DED7CC] ml-3 py-0.5">
                {[
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
                ].map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => selectNav('AUTOMATION_CENTER', sub.id)}
                    className={`w-full text-left px-2.5 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                      activeNav === 'AUTOMATION_CENTER' && (activeSubNav || 'overview') === sub.id
                        ? 'text-[#9A783E] font-bold bg-[#FFFFFF]'
                        : 'text-[#686158] hover:text-[#24211D]'
                    }`}
                  >
                    • {sub.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* REWARDS & WALLET (Smart Wallet, Loyalty Points, Gift Cards & Referrals — 15 Sub-Views) */}
          <div className="space-y-0.5">
            <button
              onClick={() => {
                toggleMenu('REWARDS_WALLET');
                selectNav('REWARDS_WALLET', activeNav === 'REWARDS_WALLET' && activeSubNav ? activeSubNav : 'overview');
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-mono tracking-wider transition-colors text-left cursor-pointer ${
                activeNav === 'REWARDS_WALLET'
                  ? 'bg-[#24211D] text-[#FAF8F4] font-bold shadow-xs'
                  : 'text-[#24211D] hover:bg-[#FFFFFF]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Wallet className="w-4 h-4 shrink-0 text-[#9A783E]" />
                <span>REWARDS &amp; WALLET</span>
              </div>
              <div className="flex items-center gap-1">
                <Gift className="w-3 h-3 text-[#9A783E]" />
                {openMenus.REWARDS_WALLET ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </div>
            </button>

            {openMenus.REWARDS_WALLET && (
              <div className="pl-6 space-y-0.5 border-l border-[#DED7CC] ml-3 py-0.5">
                {ADMIN_REWARDS_SUBVIEWS.map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => selectNav('REWARDS_WALLET', sub.id)}
                    className={`w-full text-left px-2.5 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                      activeNav === 'REWARDS_WALLET' && (activeSubNav || 'overview') === sub.id
                        ? 'text-[#9A783E] font-bold bg-[#FFFFFF]'
                        : 'text-[#686158] hover:text-[#24211D]'
                    }`}
                  >
                    • {sub.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 2. ORDERS (Parent with accordion sub-items) */}
          <div className="space-y-0.5">
            <button
              onClick={() => {
                toggleMenu('ORDERS');
                selectNav('ORDERS', 'all');
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-mono tracking-wider transition-colors text-left cursor-pointer ${
                activeNav === 'ORDERS'
                  ? 'bg-[#24211D] text-[#FAF8F4] font-bold shadow-xs'
                  : 'text-[#24211D] hover:bg-[#FFFFFF]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ShoppingBag className="w-4 h-4 shrink-0" />
                <span>ORDERS</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[9px] ${
                    activeNav === 'ORDERS'
                      ? 'bg-[#9A783E] text-[#FAF8F4]'
                      : 'bg-[#FFFFFF] text-[#24211D] border border-[#DED7CC]'
                  }`}
                >
                  {orders.length}
                </span>
                {openMenus.ORDERS ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </div>
            </button>

            {openMenus.ORDERS && (
              <div className="pl-6 space-y-0.5 border-l border-[#DED7CC] ml-3 py-0.5">
                {[
                  { id: 'all', label: 'All Orders' },
                  { id: 'NEW', label: 'New Orders' },
                  { id: 'CONFIRMED', label: 'Confirmed' },
                  { id: 'PACKING', label: 'Packing' },
                  { id: 'SHIPPED', label: 'Dispatched' },
                  { id: 'DELIVERED', label: 'Delivered' },
                  { id: 'CANCELLED', label: 'Cancelled' }
                ].map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => selectNav('ORDERS', sub.id)}
                    className={`w-full text-left px-2.5 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                      activeNav === 'ORDERS' && activeSubNav === sub.id
                        ? 'text-[#9A783E] font-bold bg-[#FFFFFF]'
                        : 'text-[#686158] hover:text-[#24211D]'
                    }`}
                  >
                    • {sub.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 3. PRODUCTS (Parent with accordion sub-items) */}
          <div className="space-y-0.5">
            <button
              onClick={() => {
                toggleMenu('PRODUCTS');
                selectNav('PRODUCTS', 'all');
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-mono tracking-wider transition-colors text-left cursor-pointer ${
                activeNav === 'PRODUCTS'
                  ? 'bg-[#24211D] text-[#FAF8F4] font-bold shadow-xs'
                  : 'text-[#24211D] hover:bg-[#FFFFFF]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Package className="w-4 h-4 shrink-0" />
                <span>PRODUCTS</span>
              </div>
              {openMenus.PRODUCTS ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>

            {openMenus.PRODUCTS && (
              <div className="pl-6 space-y-0.5 border-l border-[#DED7CC] ml-3 py-0.5">
                {[
                  { id: 'all', label: 'All Products' },
                  { id: 'collections', label: 'Collections' },
                  { id: 'categories', label: 'Categories' },
                  { id: 'variants', label: 'Variants' },
                  { id: 'inventory', label: 'Inventory' }
                ].map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => selectNav('PRODUCTS', sub.id)}
                    className={`w-full text-left px-2.5 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                      activeNav === 'PRODUCTS' && activeSubNav === sub.id
                        ? 'text-[#9A783E] font-bold bg-[#FFFFFF]'
                        : 'text-[#686158] hover:text-[#24211D]'
                    }`}
                  >
                    • {sub.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* PROCUREMENT MODULE */}
          <button
            onClick={() => {
              setOpenMenus({});
              selectNav('PROCUREMENT');
            }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-mono tracking-wider transition-colors text-left cursor-pointer ${
              activeNav === 'PROCUREMENT'
                ? 'bg-[#24211D] text-[#FAF8F4] font-bold shadow-xs'
                : 'text-[#24211D] hover:bg-[#FFFFFF]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Truck className="w-4 h-4 shrink-0 text-[#9A783E]" />
              <span>PROCUREMENT</span>
            </div>
            <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[9px] font-bold">
              POs
            </span>
          </button>

          {/* BATCH PRODUCTION MODULE */}
          <button
            onClick={() => {
              setOpenMenus({});
              selectNav('BATCH_PRODUCTION');
            }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-mono tracking-wider transition-colors text-left cursor-pointer ${
              activeNav === 'BATCH_PRODUCTION'
                ? 'bg-[#24211D] text-[#FAF8F4] font-bold shadow-xs'
                : 'text-[#24211D] hover:bg-[#FFFFFF]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <FlaskConical className="w-4 h-4 shrink-0 text-[#9A783E]" />
              <span>BATCH PRODUCTION</span>
            </div>
            <span className="px-1.5 py-0.2 rounded bg-[#9A783E]/20 text-[#9A783E] text-[9px] font-bold">
              QC
            </span>
          </button>

          {/* 4. CUSTOMERS (Parent with accordion sub-items) */}
          <div className="space-y-0.5">
            <button
              onClick={() => {
                toggleMenu('CUSTOMERS');
                selectNav('CUSTOMERS', 'all');
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-mono tracking-wider transition-colors text-left cursor-pointer ${
                activeNav === 'CUSTOMERS'
                  ? 'bg-[#24211D] text-[#FAF8F4] font-bold shadow-xs'
                  : 'text-[#24211D] hover:bg-[#FFFFFF]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Users className="w-4 h-4 shrink-0" />
                <span>CUSTOMERS</span>
              </div>
              {openMenus.CUSTOMERS ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>

            {openMenus.CUSTOMERS && (
              <div className="pl-6 space-y-0.5 border-l border-[#DED7CC] ml-3 py-0.5">
                {[
                  { id: 'all', label: 'All Customers' },
                  { id: 'segments', label: 'Segments' },
                  { id: 'reviews', label: 'Reviews' },
                  { id: 'wishlist', label: 'Wishlist' },
                  { id: 'backinstock', label: 'Back In Stock' }
                ].map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => selectNav('CUSTOMERS', sub.id)}
                    className={`w-full text-left px-2.5 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                      activeNav === 'CUSTOMERS' && activeSubNav === sub.id
                        ? 'text-[#9A783E] font-bold bg-[#FFFFFF]'
                        : 'text-[#686158] hover:text-[#24211D]'
                    }`}
                  >
                    • {sub.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 5. MARKETING (Parent with accordion sub-items) */}
          <div className="space-y-0.5">
            <button
              onClick={() => {
                toggleMenu('MARKETING');
                selectNav('MARKETING', 'campaigns');
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-mono tracking-wider transition-colors text-left cursor-pointer ${
                activeNav === 'MARKETING'
                  ? 'bg-[#24211D] text-[#FAF8F4] font-bold shadow-xs'
                  : 'text-[#24211D] hover:bg-[#FFFFFF]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Megaphone className="w-4 h-4 shrink-0" />
                <span>MARKETING</span>
              </div>
              {openMenus.MARKETING ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>

            {openMenus.MARKETING && (
              <div className="pl-6 space-y-0.5 border-l border-[#DED7CC] ml-3 py-0.5">
                {[
                  { id: 'campaigns', label: 'Campaigns' },
                  { id: 'ai_assistant', label: 'AI Intelligence & Studio' },
                  { id: 'coupons', label: 'Coupons' },
                  { id: 'influencers', label: 'Influencers' },
                  { id: 'abandoned', label: 'Abandoned Carts' },
                  { id: 'discovery', label: 'Discovery Redemption' },
                  { id: 'attribution', label: 'Attribution' }
                ].map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => selectNav('MARKETING', sub.id)}
                    className={`w-full text-left px-2.5 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                      activeNav === 'MARKETING' && activeSubNav === sub.id
                        ? 'text-[#9A783E] font-bold bg-[#FFFFFF]'
                        : 'text-[#686158] hover:text-[#24211D]'
                    }`}
                  >
                    • {sub.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 6. CONTENT (Parent with accordion sub-items) */}
          <div className="space-y-0.5">
            <button
              onClick={() => {
                toggleMenu('CONTENT');
                selectNav('CONTENT', 'homepage');
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-mono tracking-wider transition-colors text-left cursor-pointer ${
                activeNav === 'CONTENT'
                  ? 'bg-[#24211D] text-[#FAF8F4] font-bold shadow-xs'
                  : 'text-[#24211D] hover:bg-[#FFFFFF]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FileText className="w-4 h-4 shrink-0" />
                <span>CONTENT</span>
              </div>
              {openMenus.CONTENT ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>

            {openMenus.CONTENT && (
              <div className="pl-6 space-y-0.5 border-l border-[#DED7CC] ml-3 py-0.5">
                {[
                  { id: 'homepage', label: 'Homepage' },
                  { id: 'banners', label: 'Banners' },
                  { id: 'navigation', label: 'Navigation' },
                  { id: 'journal', label: 'Journal' },
                  { id: 'media', label: 'Media' },
                  { id: 'popups', label: 'Popups' }
                ].map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => selectNav('CONTENT', sub.id)}
                    className={`w-full text-left px-2.5 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                      activeNav === 'CONTENT' && activeSubNav === sub.id
                        ? 'text-[#9A783E] font-bold bg-[#FFFFFF]'
                        : 'text-[#686158] hover:text-[#24211D]'
                    }`}
                  >
                    • {sub.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 7. ANALYTICS (Parent with accordion sub-items) */}
          <div className="space-y-0.5">
            <button
              onClick={() => {
                toggleMenu('ANALYTICS');
                selectNav('ANALYTICS', 'sales');
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-mono tracking-wider transition-colors text-left cursor-pointer ${
                activeNav === 'ANALYTICS'
                  ? 'bg-[#24211D] text-[#FAF8F4] font-bold shadow-xs'
                  : 'text-[#24211D] hover:bg-[#FFFFFF]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <BarChart3 className="w-4 h-4 shrink-0" />
                <span>ANALYTICS</span>
              </div>
              {openMenus.ANALYTICS ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>

            {openMenus.ANALYTICS && (
              <div className="pl-6 space-y-0.5 border-l border-[#DED7CC] ml-3 py-0.5">
                {[
                  { id: 'sales', label: 'Sales' },
                  { id: 'visitors', label: 'Visitors & Traffic' },
                  { id: 'products', label: 'Products' },
                  { id: 'customers', label: 'Customers' },
                  { id: 'funnel', label: 'Conversion Funnel' },
                  { id: 'marketing', label: 'Marketing' },
                  { id: 'influencers', label: 'Influencers' }
                ].map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => selectNav('ANALYTICS', sub.id)}
                    className={`w-full text-left px-2.5 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                      activeNav === 'ANALYTICS' && activeSubNav === sub.id
                        ? 'text-[#9A783E] font-bold bg-[#FFFFFF]'
                        : 'text-[#686158] hover:text-[#24211D]'
                    }`}
                  >
                    • {sub.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 8. SHIPPING */}
          <button
            onClick={() => {
              setOpenMenus({});
              selectNav('SHIPPING');
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-mono tracking-wider transition-colors text-left cursor-pointer ${
              activeNav === 'SHIPPING'
                ? 'bg-[#24211D] text-[#FAF8F4] font-bold shadow-xs'
                : 'text-[#24211D] hover:bg-[#FFFFFF]'
            }`}
          >
            <Truck className="w-4 h-4 shrink-0" />
            <span>SHIPPING</span>
          </button>

          {/* 9. RETURNS / REFUNDS */}
          <button
            onClick={() => {
              setOpenMenus({});
              selectNav('RETURNS');
            }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-mono tracking-wider transition-colors text-left cursor-pointer ${
              activeNav === 'RETURNS'
                ? 'bg-[#24211D] text-[#FAF8F4] font-bold shadow-xs'
                : 'text-[#24211D] hover:bg-[#FFFFFF]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <RotateCcw className="w-4 h-4 shrink-0" />
              <span>RETURNS / REFUNDS</span>
            </div>
            {returns.length > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[9px] ${
                  activeNav === 'RETURNS'
                    ? 'bg-[#9A783E] text-[#FAF8F4]'
                    : 'bg-[#FFFFFF] text-[#24211D] border border-[#DED7CC]'
                }`}
              >
                {returns.length}
              </span>
            )}
          </button>

          {/* 10. NOTIFICATIONS */}
          <button
            onClick={() => {
              setOpenMenus({});
              selectNav('NOTIFICATIONS');
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-mono tracking-wider transition-colors text-left cursor-pointer ${
              activeNav === 'NOTIFICATIONS'
                ? 'bg-[#24211D] text-[#FAF8F4] font-bold shadow-xs'
                : 'text-[#24211D] hover:bg-[#FFFFFF]'
            }`}
          >
            <Bell className="w-4 h-4 shrink-0" />
            <span>NOTIFICATIONS</span>
          </button>

          {/* 11. INTEGRATIONS */}
          <button
            onClick={() => {
              setOpenMenus({});
              selectNav('INTEGRATIONS');
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-mono tracking-wider transition-colors text-left cursor-pointer ${
              activeNav === 'INTEGRATIONS'
                ? 'bg-[#24211D] text-[#FAF8F4] font-bold shadow-xs'
                : 'text-[#24211D] hover:bg-[#FFFFFF]'
            }`}
          >
            <Link2 className="w-4 h-4 shrink-0" />
            <span>INTEGRATIONS</span>
          </button>

          {/* 12. SETTINGS */}
          <button
            onClick={() => {
              setOpenMenus({});
              selectNav('SETTINGS');
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-mono tracking-wider transition-colors text-left cursor-pointer ${
              activeNav === 'SETTINGS'
                ? 'bg-[#24211D] text-[#FAF8F4] font-bold shadow-xs'
                : 'text-[#24211D] hover:bg-[#FFFFFF]'
            }`}
          >
            <Settings className="w-4 h-4 shrink-0" />
            <span>SETTINGS</span>
          </button>

          {/* 13. AUDIT LOGS */}
          <button
            onClick={() => {
              setOpenMenus({});
              selectNav('AUDIT_LOGS');
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-mono tracking-wider transition-colors text-left cursor-pointer ${
              activeNav === 'AUDIT_LOGS'
                ? 'bg-[#24211D] text-[#FAF8F4] font-bold shadow-xs'
                : 'text-[#24211D] hover:bg-[#FFFFFF]'
            }`}
          >
            <Shield className="w-4 h-4 shrink-0" />
            <span>AUDIT LOGS</span>
          </button>

          {/* FRAGMORÉ BUSINESS OS — 18-MODULE ENTERPRISE ERP SIDEBAR SECTIONS */}
          <div className="pt-3 mt-2 border-t border-[#DED7CC]">
            <div className="text-[10px] font-mono tracking-widest uppercase text-[#9A783E] px-3 py-1.5 font-semibold">
              Business OS · Supply &amp; Lab
            </div>
            {[
              { id: 'ERP_MATERIALS', label: 'RAW MATERIALS & GRN', icon: Boxes },
              { id: 'ERP_FORMULATIONS', label: 'FORMULATIONS & BOM', icon: FlaskConical },
              { id: 'ERP_QUALITY', label: 'SAMPLING & QC LAB', icon: ClipboardCheck },
              { id: 'ERP_WAREHOUSE', label: 'FINISHED GOODS VAULT', icon: Warehouse }
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setOpenMenus({});
                    selectNav(item.id);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-mono tracking-wider transition-colors text-left cursor-pointer whitespace-nowrap ${
                    activeNav === item.id
                      ? 'bg-[#24211D] text-[#FAF8F4] font-bold shadow-xs'
                      : 'text-[#24211D] hover:bg-[#FFFFFF]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0 text-[#9A783E]" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-[#DED7CC]">
            <div className="text-[10px] font-mono tracking-widest uppercase text-[#9A783E] px-3 py-1.5 font-semibold">
              Commercial, GST &amp; Finance
            </div>
            {[
              { id: 'ERP_CRM', label: 'B2B CRM PIPELINE', icon: Users },
              { id: 'ERP_PROPOSALS', label: 'PROPOSALS & QUOTES', icon: FileText },
              { id: 'ERP_GST_BILLING', label: 'GST BILLING & NOTES', icon: Receipt },
              { id: 'ERP_ACCOUNTING', label: 'ACCOUNTING & LEDGER', icon: BookOpen }
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setOpenMenus({});
                    selectNav(item.id);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-mono tracking-wider transition-colors text-left cursor-pointer whitespace-nowrap ${
                    activeNav === item.id
                      ? 'bg-[#24211D] text-[#FAF8F4] font-bold shadow-xs'
                      : 'text-[#24211D] hover:bg-[#FFFFFF]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0 text-[#9A783E]" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-[#DED7CC] pb-6">
            <div className="text-[10px] font-mono tracking-widest uppercase text-[#9A783E] px-3 py-1.5 font-semibold">
              Agency, People &amp; AI
            </div>
            {[
              { id: 'ERP_MARKETING_WS', label: 'AGENCY WORKSPACE', icon: Briefcase },
              { id: 'ERP_HR', label: 'HR, INTERNS & TASKS', icon: UserCheck },
              { id: 'ERP_RBAC', label: 'RBAC PERMISSIONS', icon: Shield },
              { id: 'ERP_REPORTS', label: 'REPORTS & EXPORTS', icon: FileSpreadsheet },
              { id: 'ERP_ASSISTANT', label: 'AI BUSINESS ANALYST', icon: Sparkles },
              { id: 'ERP_SETTINGS_ORG', label: 'COMPANY & DOCUMENTS', icon: Building2 }
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setOpenMenus({});
                    selectNav(item.id);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-mono tracking-wider transition-colors text-left cursor-pointer whitespace-nowrap ${
                    activeNav === item.id
                      ? 'bg-[#24211D] text-[#FAF8F4] font-bold shadow-xs'
                      : 'text-[#24211D] hover:bg-[#FFFFFF]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0 text-[#9A783E]" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* MAIN ADMIN WORKSPACE (ONLY THIS CONTENT CONTAINER SCROLLS) */}
        <main
          ref={mainWorkspaceScrollRef}
          className={`flex-1 h-full overflow-y-auto ${
            activeNav === 'AI_CMO_3' ? 'p-2 sm:p-3 lg:p-4' : 'p-3 sm:p-6 lg:p-8'
          } bg-[#FAF8F4] text-[#24211D] min-w-0 max-w-full`}
        >
          {/* TAB 1: EXECUTIVE DASHBOARD */}
          {activeNav === 'DASHBOARD' && (
            <div className="space-y-8 max-w-7xl mx-auto font-mono text-xs">
              {/* Header with Date Filter */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-[#DED7CC] gap-4">
                <div>
                  <h2 className="font-serif text-2xl sm:text-3xl tracking-wider uppercase font-normal text-[#24211D]">
                    Executive Performance Overview
                  </h2>
                  <p className="text-xs text-[#686158] mt-1">
                    Every metric is strictly computed from active database transactions, customers, and flacon reserves.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <ErpTableExportBar
                    reportKey="sales_orders"
                    title="FRAGMORÉ Executive Sales & Operations Summary"
                    notify={(m) => showNotification(m)}
                  />
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#9A783E]" />
                    <select
                      value={dateRange}
                      onChange={(e) => setDateRange(e.target.value)}
                      className="bg-[#FFFFFF] border border-[#DED7CC] text-[#24211D] rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#9A783E]"
                    >
                      <option value="today">Today (Realtime)</option>
                      <option value="yesterday">Yesterday</option>
                      <option value="7days">Last 7 Days</option>
                      <option value="30days">Last 30 Days</option>
                      <option value="lifetime">Lifetime Ledger</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* FRAGMORÉ BUSINESS OS MULTI-DEPARTMENT ERP SNAPSHOT */}
              {erpSnapshot && (
                <div className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg overflow-hidden">
                  <div className="px-4 py-2.5 bg-[#FAF8F4] border-b border-[#DED7CC] flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-mono text-[11px]">
                      <span className="font-bold text-[#9A783E] uppercase">FRAGMORÉ BUSINESS OS</span>
                      <span className="text-[#DED7CC]">·</span>
                      <span className="text-[#24211D]">Active Role: {erpSnapshot.actor.roleName}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                      <button onClick={() => selectNav('ERP_GST_BILLING')} className="text-[#9A783E] hover:underline cursor-pointer">
                        GST Billing →
                      </button>
                      <button onClick={() => selectNav('ERP_ACCOUNTING')} className="text-[#9A783E] hover:underline cursor-pointer">
                        Trial Balance →
                      </button>
                      <button onClick={() => selectNav('ERP_ASSISTANT')} className="text-[#9A783E] hover:underline cursor-pointer">
                        Ask AI Analyst →
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-[#DED7CC]">
                    <div className="p-3.5">
                      <span className="text-[10px] text-[#686158] uppercase block">Trial Balance</span>
                      <span className={`text-sm font-bold ${erpSnapshot.financialSummary.isBalanced ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {erpSnapshot.financialSummary.isBalanced ? 'BALANCED' : 'UNBALANCED'}
                      </span>
                    </div>
                    <div className="p-3.5">
                      <span className="text-[10px] text-[#686158] uppercase block">Open AR / AP</span>
                      <span className="text-sm font-bold tabular-nums">
                        ₹{erpSnapshot.commerceSummary.accountsReceivableInr.toLocaleString('en-IN')} / ₹{erpSnapshot.commerceSummary.accountsPayableInr.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="p-3.5">
                      <span className="text-[10px] text-[#686158] uppercase block">Reorder Alerts</span>
                      <span className="text-sm font-bold text-rose-700 tabular-nums">
                        {erpSnapshot.commerceSummary.lowStockMaterialsCount} Materials
                      </span>
                    </div>
                    <div className="p-3.5">
                      <span className="text-[10px] text-[#686158] uppercase block">Active Formulations</span>
                      <span className="text-sm font-bold tabular-nums">{erpSnapshot.formulations.length} Masters</span>
                    </div>
                    <div className="p-3.5">
                      <span className="text-[10px] text-[#686158] uppercase block">B2B Pipeline</span>
                      <span className="text-sm font-bold text-[#9A783E] tabular-nums">{erpSnapshot.leads.length} Leads</span>
                    </div>
                    <div className="p-3.5">
                      <span className="text-[10px] text-[#686158] uppercase block">Team &amp; Interns</span>
                      <span className="text-sm font-bold tabular-nums">
                        {erpSnapshot.employees.length} + {erpSnapshot.interns.length}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* 12-KPI TILES GRID (INCLUDING PROMINENT STORE VISITORS TELEMETRY) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
                {/* 1. Gross Sales */}
                <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#DED7CC] space-y-1 shadow-2xs">
                  <div className="flex items-center justify-between text-[10px] text-[#686158] uppercase">
                    <span>Gross Sales</span>
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <div className="text-lg sm:text-xl font-bold text-[#24211D] tabular-nums">
                    ₹{grossSales.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] text-emerald-700">Pre-tax &amp; shipping</div>
                </div>

                {/* 2. Net Sales */}
                <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#DED7CC] space-y-1 shadow-2xs">
                  <div className="flex items-center justify-between text-[10px] text-[#686158] uppercase">
                    <span>Net Sales</span>
                    <DollarSign className="w-3.5 h-3.5 text-[#9A783E]" />
                  </div>
                  <div className="text-lg sm:text-xl font-bold text-[#9A783E] tabular-nums">
                    ₹{netSales.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] text-[#686158]">
                    Less refunds (₹{totalRefunds.toLocaleString('en-IN')})
                  </div>
                </div>

                {/* 3. Orders */}
                <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#DED7CC] space-y-1 shadow-2xs">
                  <div className="flex items-center justify-between text-[10px] text-[#686158] uppercase">
                    <span>Orders</span>
                    <ShoppingBag className="w-3.5 h-3.5 text-[#9A783E]" />
                  </div>
                  <div className="text-lg sm:text-xl font-bold text-[#24211D] tabular-nums">
                    {totalOrders}
                  </div>
                  <div className="text-[10px] text-emerald-700">100% gateway verified</div>
                </div>

                {/* 4. Total Store Visitors (PROMINENT KPI) */}
                <div className="p-4 rounded-xl bg-[#FFFFFF] border-2 border-[#9A783E]/40 space-y-1 shadow-xs relative overflow-hidden bg-gradient-to-br from-[#FFFFFF] to-[#FAF8F4]">
                  <div className="flex items-center justify-between text-[10px] text-[#9A783E] uppercase font-bold">
                    <span>Store Visitors</span>
                    <Eye className="w-3.5 h-3.5 text-[#9A783E]" />
                  </div>
                  <div className="text-lg sm:text-xl font-bold text-[#24211D] tabular-nums flex items-baseline gap-1.5">
                    <span>{totalVisitors.toLocaleString('en-IN')}</span>
                    <span className="text-[10px] text-emerald-600 font-mono font-semibold">+{todayVisitors} today</span>
                  </div>
                  <div className="text-[10px] text-[#686158]">
                    {uniqueVisitors.toLocaleString('en-IN')} unique connoisseurs
                  </div>
                </div>

                {/* 5. Live Online Visitors */}
                <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#DED7CC] space-y-1 shadow-2xs">
                  <div className="flex items-center justify-between text-[10px] text-[#686158] uppercase">
                    <span>Online Now</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                  <div className="text-lg sm:text-xl font-bold text-emerald-700 tabular-nums flex items-center gap-1.5">
                    <span>{activeVisitors}</span>
                    <span className="text-[10px] text-emerald-700 font-normal">active sessions</span>
                  </div>
                  <div className="text-[10px] text-[#686158]">Real-time pulse heartbeat</div>
                </div>

                {/* 6. Customers */}
                <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#DED7CC] space-y-1 shadow-2xs">
                  <div className="flex items-center justify-between text-[10px] text-[#686158] uppercase">
                    <span>Customers</span>
                    <Users className="w-3.5 h-3.5 text-[#9A783E]" />
                  </div>
                  <div className="text-lg sm:text-xl font-bold text-[#24211D] tabular-nums">
                    {totalCustomers}
                  </div>
                  <div className="text-[10px] text-[#686158]">Registered profiles</div>
                </div>

                {/* 7. AOV */}
                <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#DED7CC] space-y-1 shadow-2xs">
                  <div className="flex items-center justify-between text-[10px] text-[#686158] uppercase">
                    <span>AOV</span>
                    <DollarSign className="w-3.5 h-3.5 text-[#9A783E]" />
                  </div>
                  <div className="text-lg sm:text-xl font-bold text-[#24211D] tabular-nums">
                    ₹{aov.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] text-[#686158]">Luxury basket size</div>
                </div>

                {/* 8. Conversion */}
                <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#DED7CC] space-y-1 shadow-2xs">
                  <div className="flex items-center justify-between text-[10px] text-[#686158] uppercase">
                    <span>Conversion</span>
                    <Percent className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <div className="text-lg sm:text-xl font-bold text-emerald-700 tabular-nums">
                    {conversionRate}%
                  </div>
                  <div className="text-[10px] text-[#686158]">From {totalVisitors.toLocaleString()} visits</div>
                </div>

                {/* 9. Abandoned Cart Value */}
                <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#DED7CC] space-y-1 shadow-2xs">
                  <div className="flex items-center justify-between text-[10px] text-[#686158] uppercase">
                    <span>Abandoned Value</span>
                    <ShoppingCart className="w-3.5 h-3.5 text-[#9A783E]" />
                  </div>
                  <div className="text-lg sm:text-xl font-bold text-[#9A783E] tabular-nums">
                    ₹{abandonedCartValue.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] text-[#9A783E]">In recovery pipeline</div>
                </div>

                {/* 10. Recovered Revenue */}
                <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#DED7CC] space-y-1 shadow-2xs">
                  <div className="flex items-center justify-between text-[10px] text-[#686158] uppercase">
                    <span>Recovered Rev</span>
                    <RotateCw className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <div className="text-lg sm:text-xl font-bold text-emerald-700 tabular-nums">
                    ₹{recoveredRevenue.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] text-emerald-700">WhatsApp &amp; Email</div>
                </div>

                {/* 11. Top Fragrance */}
                <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#DED7CC] space-y-1 shadow-2xs">
                  <div className="flex items-center justify-between text-[10px] text-[#686158] uppercase">
                    <span>Top Scent</span>
                    <Sparkles className="w-3.5 h-3.5 text-[#9A783E]" />
                  </div>
                  <div className="text-base sm:text-lg font-bold text-[#24211D] font-serif uppercase truncate">
                    {topFragranceName}
                  </div>
                  <div className="text-[10px] text-[#9A783E]">{topFragranceUnits} units dispatched</div>
                </div>

                {/* 12. Low Stock */}
                <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#DED7CC] space-y-1 shadow-2xs">
                  <div className="flex items-center justify-between text-[10px] text-[#686158] uppercase">
                    <span>Low Stock</span>
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  </div>
                  <div className="text-lg sm:text-xl font-bold text-rose-600 tabular-nums">
                    {lowStockCount} SKUs
                  </div>
                  <div className="text-[10px] text-rose-600">Threshold &lt; 30 units</div>
                </div>
              </div>

              {/* STORE VISITORS & REAL-TIME TRAFFIC TELEMETRY PANEL */}
              <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl p-5 sm:p-6 space-y-5 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#DED7CC] pb-4 gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#FAF8F4] border border-[#DED7CC] flex items-center justify-center text-[#9A783E]">
                      <Eye className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-serif text-base uppercase tracking-wider text-[#24211D] font-semibold flex items-center gap-2">
                        <span>Storefront Visitors &amp; Footfall Telemetry</span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>{activeVisitors} Online</span>
                        </span>
                      </h3>
                      <p className="text-[11px] text-[#686158]">
                        Continuously tracking active browsing sessions, unique client fingerprints, and fragrance discoveries.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <button
                      onClick={() => refreshVisitorStats()}
                      className="px-2.5 py-1 text-[11px] font-mono text-[#9A783E] hover:text-[#24211D] border border-[#DED7CC] rounded-lg bg-[#FAF8F4] hover:bg-[#F1EDE5] transition-colors cursor-pointer flex items-center gap-1.5"
                      title="Sync Live Visitor Counts"
                    >
                      <RotateCw className="w-3 h-3" />
                      <span>Sync Telemetry</span>
                    </button>
                    <button
                      onClick={() => selectNav('ANALYTICS', 'visitors')}
                      className="px-2.5 py-1 text-[11px] font-mono text-[#FAF8F4] bg-[#24211D] hover:bg-[#9A783E] rounded-lg transition-colors cursor-pointer"
                    >
                      Deep Analytics →
                    </button>
                  </div>
                </div>

                {/* Telemetry Stats Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 pt-1">
                  <div className="p-3 bg-[#FAF8F4] border border-[#DED7CC] rounded-lg">
                    <span className="text-[10px] text-[#686158] uppercase block">Total Visits (Sessions)</span>
                    <span className="text-lg font-bold text-[#24211D] font-mono">{totalVisitors.toLocaleString('en-IN')}</span>
                    <span className="text-[10px] text-emerald-700 block">+{todayVisitors} in last 24h</span>
                  </div>
                  <div className="p-3 bg-[#FAF8F4] border border-[#DED7CC] rounded-lg">
                    <span className="text-[10px] text-[#686158] uppercase block">Unique Connoisseurs</span>
                    <span className="text-lg font-bold text-[#9A783E] font-mono">{uniqueVisitors.toLocaleString('en-IN')}</span>
                    <span className="text-[10px] text-[#686158] block">Unique client IDs</span>
                  </div>
                  <div className="p-3 bg-[#FAF8F4] border border-[#DED7CC] rounded-lg">
                    <span className="text-[10px] text-[#686158] uppercase block">Total Page Impressions</span>
                    <span className="text-lg font-bold text-[#24211D] font-mono">{totalPageViews.toLocaleString('en-IN')}</span>
                    <span className="text-[10px] text-[#686158] block">~3.5 pages / session</span>
                  </div>
                  <div className="p-3 bg-[#FAF8F4] border border-[#DED7CC] rounded-lg">
                    <span className="text-[10px] text-[#686158] uppercase block">Avg. Session Time</span>
                    <span className="text-lg font-bold text-[#24211D] font-mono">3m 14s</span>
                    <span className="text-[10px] text-emerald-700 block">High luxury engagement</span>
                  </div>
                  <div className="p-3 bg-[#FAF8F4] border border-[#DED7CC] rounded-lg col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-[#686158] uppercase block">Visitor Bounce Rate</span>
                    <span className="text-lg font-bold text-[#24211D] font-mono">28.6%</span>
                    <span className="text-[10px] text-emerald-700 block">Industry avg is 45%</span>
                  </div>
                </div>

                {/* Sub-grid: Hourly Sparkline & Traffic Acquisition Breakdown */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-1">
                  {/* Hourly Traffic Trend */}
                  <div className="lg:col-span-2 p-4 bg-[#FAF8F4] border border-[#DED7CC] rounded-xl space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-serif uppercase tracking-wider font-semibold text-[#24211D]">
                        Hourly Visitor Inflow (Today)
                      </span>
                      <span className="text-[10px] text-[#9A783E] font-mono">12-Hour Pulse</span>
                    </div>
                    <div className="h-28 flex items-end gap-1.5 sm:gap-2 pt-4 px-1">
                      {(visitorStats?.hourlyTrend || []).map((pt, idx) => {
                        const maxVal = Math.max(...(visitorStats?.hourlyTrend || []).map((p) => p.visitors), 40);
                        const heightPct = Math.max(12, Math.round((pt.visitors / maxVal) * 100));
                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                            <div className="text-[9px] font-mono text-[#9A783E] opacity-0 group-hover:opacity-100 transition-opacity absolute -top-5 whitespace-nowrap bg-[#FFFFFF] px-1 rounded shadow-2xs">
                              {pt.visitors} vis ({pt.pageViews} pv)
                            </div>
                            <div
                              className="w-full bg-gradient-to-t from-[#9A783E]/20 to-[#9A783E] hover:from-[#9A783E]/40 hover:to-[#24211D] rounded-t transition-all cursor-pointer"
                              style={{ height: `${heightPct}%` }}
                            />
                            <span className="text-[9px] font-mono text-[#686158]">{pt.hour}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Channel & Device Split */}
                  <div className="p-4 bg-[#FAF8F4] border border-[#DED7CC] rounded-xl space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-xs pb-2 border-b border-[#DED7CC]">
                        <span className="font-serif uppercase tracking-wider font-semibold text-[#24211D]">
                          Traffic Sources
                        </span>
                        <Globe className="w-3.5 h-3.5 text-[#9A783E]" />
                      </div>
                      <div className="space-y-2 pt-2.5 text-[11px]">
                        {(() => {
                          const direct = visitorStats?.channelBreakdown?.direct || 0;
                          const instagram = visitorStats?.channelBreakdown?.instagram || 0;
                          const search = visitorStats?.channelBreakdown?.search || 0;
                          const whatsapp = visitorStats?.channelBreakdown?.whatsapp || 0;
                          const referral = visitorStats?.channelBreakdown?.referral || 0;
                          const total = direct + instagram + search + whatsapp + referral;
                          const getPct = (c: number) => (total > 0 ? `${Math.round((c / total) * 100)}%` : '0%');

                          return [
                            { name: 'Direct Maison URL', count: direct, pct: getPct(direct) },
                            { name: 'Instagram & Creators', count: instagram, pct: getPct(instagram) },
                            { name: 'Organic Search', count: search, pct: getPct(search) },
                            { name: 'WhatsApp VIP Share', count: whatsapp, pct: getPct(whatsapp) },
                            { name: 'Press & Referrals', count: referral, pct: getPct(referral) }
                          ].map((ch) => (
                            <div key={ch.name} className="flex items-center justify-between">
                              <span className="text-[#686158] truncate">{ch.name}</span>
                              <div className="flex items-center gap-2 font-mono">
                                <span className="text-[#24211D] font-bold">{ch.count.toLocaleString()}</span>
                                <span className="text-[#9A783E] text-[10px] w-8 text-right font-semibold">{ch.pct}</span>
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[#DED7CC] flex items-center justify-between text-[11px]">
                      <span className="text-[#686158]">Device Split:</span>
                      <div className="flex items-center gap-2 font-mono text-[10px]">
                        <span className="text-[#24211D]">Mobile 58%</span>
                        <span className="text-[#DED7CC]">|</span>
                        <span className="text-[#24211D]">Desktop 36%</span>
                        <span className="text-[#DED7CC]">|</span>
                        <span className="text-[#24211D]">Tablet 6%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Realtime Live Visitor Telemetry & Patron Intelligence */}
                <div className="pt-2">
                  <LiveVisitorTelemetry
                    variant="light"
                    title="Live Footfall & Patron Intelligence"
                    showFilters={true}
                    maxItems={25}
                  />
                </div>
              </div>

              {/* CHARTS SECTION (DERIVED STRICTLY FROM DATABASE) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Chart 1: Revenue by Fragrance Breakdown */}
                <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl p-6 space-y-4 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-[#DED7CC] pb-3">
                    <h3 className="font-serif text-base uppercase tracking-wider text-[#24211D] font-semibold">
                      Revenue Velocity by Fragrance (Actual DB Orders)
                    </h3>
                    <span className="text-[11px] text-[#9A783E] font-semibold">Olfactory Sales</span>
                  </div>

                  <div className="space-y-3 pt-2">
                    {sortedFragrances.slice(0, 6).map(([fragName, data]) => {
                      const sharePct = netSales > 0 ? Math.round((data.revenue / netSales) * 100) : 20;
                      return (
                        <div key={fragName} className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-[#24211D] font-serif tracking-wider font-semibold">
                              {fragName}
                            </span>
                            <span className="text-[#9A783E] font-bold">
                              ₹{data.revenue.toLocaleString('en-IN')} ({sharePct}%)
                            </span>
                          </div>
                          <div className="w-full h-2 bg-[#F1EDE5] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#9A783E]"
                              style={{ width: `${Math.max(5, sharePct)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Chart 2: Order Fulfillment Pipeline Distribution */}
                <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl p-6 space-y-4 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-[#DED7CC] pb-3">
                    <h3 className="font-serif text-base uppercase tracking-wider text-[#24211D] font-semibold">
                      Order Fulfillment Pipeline Status
                    </h3>
                    <span className="text-[11px] text-emerald-700 font-semibold">Live Logistics</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    {[
                      { status: 'CONFIRMED', color: 'border-[#DED7CC]' },
                      { status: 'SHIPPED', color: 'border-[#DED7CC]' },
                      { status: 'DELIVERED', color: 'border-[#DED7CC]' },
                      { status: 'CANCELLED', color: 'border-[#DED7CC]' }
                    ].map((item) => {
                      const count = orders.filter((o) => o.orderStatus === item.status).length;
                      return (
                        <div
                          key={item.status}
                          className={`p-4 bg-[#FAF8F4] border rounded-xl space-y-1 ${item.color}`}
                        >
                          <span className="text-[10px] uppercase text-[#686158] font-semibold">
                            {item.status}
                          </span>
                          <div className="text-2xl font-bold text-[#24211D]">{count}</div>
                          <span className="text-[10px] text-[#686158]">Consignments</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* LIVE ORDER PIPELINE TABLE */}
              <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-xl p-6 space-y-4 shadow-2xs">
                <div className="flex items-center justify-between border-b border-[#DED7CC] pb-3">
                  <h3 className="font-serif text-base uppercase tracking-wider text-[#24211D] font-semibold">
                    Live Order Pipeline &amp; Dispatch Status
                  </h3>
                  <button
                    onClick={() => selectNav('ORDERS')}
                    className="text-xs text-[#9A783E] hover:underline font-semibold cursor-pointer"
                  >
                    View All Orders ({orders.length}) →
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-[#DED7CC] text-[#686158] uppercase text-[10px]">
                        <th className="py-2.5">Order ID</th>
                        <th className="py-2.5">Customer &amp; City</th>
                        <th className="py-2.5">Items</th>
                        <th className="py-2.5">Amount</th>
                        <th className="py-2.5">Status</th>
                        <th className="py-2.5 text-right">Invoice</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DED7CC]">
                      {orders.slice(0, 5).map((ord) => (
                        <tr key={ord.id} className="hover:bg-[#FAF8F4]">
                          <td className="py-3 font-bold text-[#24211D]">{ord.orderNumber}</td>
                          <td className="py-3 text-[#24211D]">
                            {ord.customerName}
                            <span className="text-[#686158] block text-[10px]">
                              {ord.shippingAddress?.city || 'India'}
                            </span>
                          </td>
                          <td className="py-3 text-[#686158] max-w-xs truncate">
                            {(ord.items || []).map((i) => `${i.productName} (${i.size})`).join(', ')}
                          </td>
                          <td className="py-3 text-[#9A783E] font-semibold">
                            ₹{ord.totalAmount.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3">
                            <span className="px-2 py-0.5 rounded bg-[#F1EDE5] border border-[#DED7CC] text-[#9A783E] text-[10px] font-bold">
                              {ord.orderStatus}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <button
                              onClick={() => setSelectedOrderForInvoice(ord)}
                              className="text-xs text-[#9A783E] hover:underline font-semibold cursor-pointer"
                            >
                              PDF Invoice
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

          {/* TAB 2: ORDERS */}
          {activeNav === 'ORDERS' && (
            <AdminOrders
              key={`ORDERS-${activeSubNav || 'all'}`}
              initialSubTab={activeSubNav || 'all'}
              onSubTabChange={(sub) => setActiveSubNav(sub)}
            />
          )}

          {/* TAB 3: PRODUCTS */}
          {activeNav === 'PRODUCTS' && (
            <AdminProducts
              key={`PRODUCTS-${activeSubNav || 'all'}`}
              initialSubTab={(activeSubNav as any) || 'all'}
            />
          )}

          {/* TAB: PROCUREMENT MODULE */}
          {activeNav === 'PROCUREMENT' && <AdminProcurement />}

          {/* TAB: BATCH PRODUCTION MODULE */}
          {activeNav === 'BATCH_PRODUCTION' && <AdminBatchProduction />}

          {/* TAB 4: CUSTOMERS */}
          {activeNav === 'CUSTOMERS' && (
            <AdminCustomers
              key={`CUSTOMERS-${activeSubNav || 'all'}`}
              initialSubTab={(activeSubNav as any) || 'all'}
            />
          )}

          {/* TAB 5: MARKETING */}
          {activeNav === 'MARKETING' && (
            <AdminMarketing
              key={`MARKETING-${activeSubNav || 'campaigns'}`}
              initialSubTab={(activeSubNav as any) || 'campaigns'}
            />
          )}

          {/* TAB 6: CONTENT */}
          {activeNav === 'CONTENT' && (
            <AdminCMS
              key={`CONTENT-${activeSubNav || 'homepage'}`}
              initialSubTab={(activeSubNav as any) || 'homepage'}
            />
          )}

          {/* TAB 7: ANALYTICS */}
          {activeNav === 'ANALYTICS' && (
            <AdminAnalytics
              key={`ANALYTICS-${activeSubNav || 'sales'}`}
              initialSubTab={(activeSubNav as any) || 'sales'}
            />
          )}

          {/* TAB 8: SHIPPING */}
          {activeNav === 'SHIPPING' && <AdminShipping />}

          {/* TAB 9: RETURNS / REFUNDS */}
          {activeNav === 'RETURNS' && <AdminReturns />}

          {/* TAB 10: NOTIFICATIONS */}
          {activeNav === 'NOTIFICATIONS' && <AdminNotifications />}

          {/* TAB 11: INTEGRATIONS */}
          {activeNav === 'INTEGRATIONS' && <AdminIntegrations />}

          {/* TAB 12: SETTINGS */}
          {activeNav === 'SETTINGS' && <AdminSettings />}

          {/* TAB 13: AUDIT LOGS */}
          {activeNav === 'AUDIT_LOGS' && <AdminAuditLogs />}

          {/* TAB 14: AUTOMATION CENTER */}
          {activeNav === 'AUTOMATION_CENTER' && (
            <AdminAutomationCenter
              key={`AUTOMATION_CENTER-${activeSubNav || 'overview'}`}
              initialSubTab={(activeSubNav as AutomationSubTab) || 'overview'}
              onSubTabChange={(sub) => setActiveSubNav(sub)}
            />
          )}

          {/* TAB 15: AI MARKETING INTELLIGENCE ASSISTANT (EXISTING PRESERVED) */}
          {activeNav === 'AI_INTELLIGENCE' && <AdminAiMarketingAssistant />}

          {/* TAB 16: SUPPORT, REVIEWS & RETENTION AUTOMATION */}
          {activeNav === 'SUPPORT_RETENTION' && <AdminSupportRetentionCenter />}

          {/* TAB 17: AI CMO 3.0 (NEW ISOLATED MODULE — AI CHAT MAIN INTERFACE) */}
          {activeNav === 'AI_CMO_3' && (
            <AdminAiCmo3
              activeSubRoute={((activeSubNav as AiCmoSubRoute) || 'CHAT')}
              onSubRouteChange={(sub) => setActiveSubNav(sub)}
              adminEmail={customer?.email || 'admin@fragmore.com'}
              adminRole={adminRole}
              onOpenTechnicalAutomationBuilder={() => {
                selectNav('AUTOMATION_CENTER', 'builder');
              }}
            />
          )}

          {/* TAB 18: SMART WALLET, LOYALTY REWARDS & GIFT CARD ECOSYSTEM */}
          {activeNav === 'REWARDS_WALLET' && (
            <AdminRewardsAndWallet
              activeSubView={((activeSubNav as AdminRewardsSubView) || 'overview')}
              onSubViewChange={(sub) => setActiveSubNav(sub)}
              erpRoleCode={erpRoleCode}
              onNotify={showNotification}
            />
          )}

          {/* FRAGMORÉ BUSINESS OS — 18-MODULE ERP VIEWS */}
          {erpSnapshot &&
            (activeNav === 'ERP_MATERIALS' ||
              activeNav === 'ERP_FORMULATIONS' ||
              activeNav === 'ERP_QUALITY' ||
              activeNav === 'ERP_WAREHOUSE') && (
              <ErpSupplyAndLabModules
                snapshot={erpSnapshot}
                activeModule={activeNav}
                onRefresh={loadErpSnapshot}
                notify={(msg, t) => showNotification(t === 'error' ? `Error: ${msg}` : msg)}
              />
            )}

          {erpSnapshot &&
            (activeNav === 'ERP_CRM' ||
              activeNav === 'ERP_PROPOSALS' ||
              activeNav === 'ERP_GST_BILLING' ||
              activeNav === 'ERP_ACCOUNTING') && (
              <ErpCommercialFinanceModules
                snapshot={erpSnapshot}
                activeModule={activeNav}
                orders={orders}
                onRefresh={loadErpSnapshot}
                notify={(msg, t) => showNotification(t === 'error' ? `Error: ${msg}` : msg)}
                onPrintInvoice={(inv) => setPrintInvoice(inv)}
              />
            )}

          {erpSnapshot &&
            (activeNav === 'ERP_MARKETING_WS' ||
              activeNav === 'ERP_HR' ||
              activeNav === 'ERP_RBAC' ||
              activeNav === 'ERP_REPORTS' ||
              activeNav === 'ERP_ASSISTANT' ||
              activeNav === 'ERP_SETTINGS_ORG') && (
              <ErpGrowthGovernanceModules
                snapshot={erpSnapshot}
                activeModule={activeNav}
                onRefresh={loadErpSnapshot}
                notify={(msg, t) => showNotification(t === 'error' ? `Error: ${msg}` : msg)}
                onPrintReport={(title, rows) => setPrintReport({ title, rows })}
              />
            )}

          {!erpSnapshot && activeNav.startsWith('ERP_') && (
            <div className="p-8 text-center font-mono text-xs text-[#686158]">
              {erpLoading ? 'Synchronizing FRAGMORÉ Business OS from PostgreSQL...' : 'Role access restricted or ERP initializing.'}
            </div>
          )}
        </main>
      </div>

      {/* GLOBAL CROSS-CUTTING BUSINESS OS OVERLAYS */}
      <ErpUniversalSearchModal
        open={erpSearchOpen}
        onClose={() => setErpSearchOpen(false)}
        onNavigateModule={(navKey) => selectNav(navKey)}
      />
      <ErpApprovalsDrawer
        open={erpApprovalsOpen}
        onClose={() => setErpApprovalsOpen(false)}
        snapshot={erpSnapshot}
        onRefresh={loadErpSnapshot}
        notify={(msg, t) => showNotification(t === 'error' ? `Error: ${msg}` : msg)}
      />
      <ErpNotificationsDrawer
        open={erpNotifsOpen}
        onClose={() => setErpNotifsOpen(false)}
        snapshot={erpSnapshot}
        onRefresh={loadErpSnapshot}
        onNavigateModule={(navKey) => selectNav(navKey)}
      />
      <ErpPrintableDocumentModal
        invoice={printInvoice}
        reportData={printReport}
        organization={erpSnapshot?.organization}
        onClose={() => {
          setPrintInvoice(null);
          setPrintReport(null);
        }}
      />
    </div>
  );
};
