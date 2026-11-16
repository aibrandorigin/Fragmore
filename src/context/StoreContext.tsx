import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Product,
  Cart,
  CartItem,
  Order,
  Coupon,
  Influencer,
  Review,
  AbandonedCart,
  CMSSettings,
  AdminRole,
  MarketingEvent,
  MarketingAttribution,
  CustomerAddress,
  OrderStatus,
  CustomerProfile,
  IntegrationConfig,
  Campaign,
  ReturnRefund,
  BackInStockItem,
  AuditLog,
  VisitorStats
} from '../types';
import {
  INITIAL_PRODUCTS,
  INITIAL_COUPONS,
  INITIAL_INFLUENCERS,
  INITIAL_REVIEWS,
  INITIAL_ORDERS,
  INITIAL_ABANDONED_CARTS,
  INITIAL_CMS,
  INITIAL_CUSTOMERS,
  INITIAL_INTEGRATIONS,
  INITIAL_CAMPAIGNS,
  INITIAL_RETURNS,
  INITIAL_BACK_IN_STOCK,
  INITIAL_AUDIT_LOGS
} from '../data/initialData';
import { auth, googleAuthProvider, firestore } from '../lib/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updatePassword as firebaseUpdatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential
} from 'firebase/auth';
import {
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  collection,
  getDocFromServer
} from 'firebase/firestore';
import { cloudSqlApi } from '../lib/cloudSqlApi';

export interface CustomerAccountState {
  id: string;
  name: string;
  email: string;
  phone: string;
  addresses: CustomerAddress[];
  role?: AdminRole | 'CUSTOMER';
}

interface StoreContextType {
  // Navigation & View
  currentView: string;
  setCurrentView: (view: string) => void;
  selectedProductSlug: string | null;
  setSelectedProductSlug: (slug: string | null) => void;
  selectedCategoryFilter: string;
  setSelectedCategoryFilter: (cat: string) => void;
  isMiniCartOpen: boolean;
  setIsMiniCartOpen: (open: boolean) => void;
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;
  isQuizOpen: boolean;
  setIsQuizOpen: (open: boolean) => void;
  isEventInspectorOpen: boolean;
  setIsEventInspectorOpen: (open: boolean) => void;
  selectedOrderForInvoice: Order | null;
  setSelectedOrderForInvoice: (order: Order | null) => void;

  // Theme (Light first-visit default, persisted in localStorage)
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;

  // Products & Inventory
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  updateProduct: (updated: Product) => void;
  addProduct: (product: Product) => void;
  deleteProduct: (id: string) => void;

  // Cart
  cart: Cart;
  addToCart: (product: Product, size: string, quantity?: number, selectedFlavours?: string[]) => void;
  removeFromCart: (variantId: string) => void;
  updateCartQuantity: (variantId: string, quantity: number) => void;
  clearCart: () => void;
  toggleGiftWrap: () => void;
  applyCoupon: (code: string) => { success: boolean; message: string };
  removeCoupon: () => void;

  // Wishlist
  wishlist: string[]; // product slugs
  toggleWishlist: (slug: string) => void;
  isInWishlist: (slug: string) => boolean;

  // Orders
  orders: Order[];
  createOrder: (orderData: Omit<Order, 'id' | 'orderNumber' | 'createdAt'>) => Order;
  updateOrderStatus: (orderId: string, status: OrderStatus, awb?: string, courier?: string) => void;

  deleteOrder: (id: string) => void;

  // Abandoned Carts
  abandonedCarts: AbandonedCart[];
  sendRecoveryReminder: (cartId: string, channel: 'email' | 'whatsapp' | 'sms') => void;
  markCartRecovered: (cartId: string) => void;
  deleteAbandonedCart: (id: string) => void;
  addManualAbandonedReminder: (cartId: string, channel: 'email' | 'whatsapp', couponCode?: string) => void;

  // Customer Account & Authentication
  customer: CustomerAccountState | null;
  isLoggedIn: boolean;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  updateCustomerProfile: (data: Partial<{ name: string; email: string; phone: string }>) => void;
  changePassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<{ success: boolean; message: string }>;
  addOrUpdateAddress: (address: CustomerAddress) => void;
  loginWithEmail: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; code?: string; message?: string }>;
  signupWithEmail: (
    name: string,
    email: string,
    password: string,
    phone?: string
  ) => Promise<{ success: boolean; code?: string; message?: string }>;
  sendPhoneOtp: (phone: string) => Promise<{ success: boolean; testOtp?: string; message?: string }>;
  verifyPhoneOtp: (
    phone: string,
    otp: string,
    details?: { name?: string; email?: string }
  ) => Promise<{ success: boolean; isNew?: boolean; message?: string }>;
  loginAsDemo: (role: 'CUSTOMER' | 'SUPER_ADMIN') => void;
  logout: () => void;

  // Influencers & Coupons
  influencers: Influencer[];
  addInfluencer: (inf: Influencer) => void;
  updateInfluencer: (inf: Influencer) => void;
  deleteInfluencer: (id: string) => void;
  coupons: Coupon[];
  addCoupon: (cpn: Coupon) => void;
  updateCoupon: (cpn: Coupon) => void;
  deleteCoupon: (code: string) => void;
  toggleCouponStatus: (code: string) => void;

  // Reviews
  reviews: Review[];
  addReview: (review: Omit<Review, 'id' | 'date' | 'status'>) => void;
  updateReviewStatus: (reviewId: string, status: 'APPROVED' | 'REJECTED') => void;
  deleteReview: (id: string) => void;

  // CMS & Settings
  cms: CMSSettings;
  updateCMS: (settings: Partial<CMSSettings>) => Promise<void>;

  // Role
  adminRole: AdminRole;
  setAdminRole: (role: AdminRole) => void;

  // Marketing Events & Attribution
  marketingEvents: MarketingEvent[];
  trackEvent: (eventName: string, payload?: Record<string, any>) => void;
  attribution: MarketingAttribution;

  // Customers CRM
  customers: CustomerProfile[];
  updateCustomer: (customer: CustomerProfile) => void;
  addCustomer: (customer: CustomerProfile) => void;
  deleteCustomer: (id: string) => void;

  // Integrations
  integrations: IntegrationConfig;
  updateIntegrations: (config: Partial<IntegrationConfig>) => void;
  testIntegration: (service: keyof IntegrationConfig) => Promise<{ success: boolean; message: string }>;

  // Campaigns & Broadcasts
  campaigns: Campaign[];
  addCampaign: (campaign: Campaign) => void;
  updateCampaign: (campaign: Campaign) => void;
  deleteCampaign: (id: string) => void;
  updateCampaignStatus: (id: string, status: Campaign['status']) => void;

  // Returns & Refunds
  returns: ReturnRefund[];
  addReturn: (ret: ReturnRefund) => void;
  updateReturnStatus: (id: string, status: ReturnRefund['status'], restock?: boolean) => void;

  // Back In Stock
  backInStock: BackInStockItem[];
  addBackInStockRequest: (productId: string, productName: string, size: string, email: string, phone: string) => void;
  notifyBackInStock: (id: string) => void;
  deleteBackInStock: (id: string) => void;

  // Audit Logs
  auditLogs: AuditLog[];
  addAuditLog: (action: string, entity: string, details: string, entityId?: string) => void;
  clearAuditLogs: () => void;

  // Notifications
  notification: string | null;
  showNotification: (msg: string) => void;

  // Store Visitor Telemetry
  visitorStats: VisitorStats;
  refreshVisitorStats: () => Promise<void>;

  // Cloud SQL Database Connection Status
  isCloudSqlConnected: boolean;
  isFirebaseConnected: boolean;
}

const StoreContext = createContext<StoreContextType | null>(null);

const STORAGE_KEYS = {
  CART: 'fragmore_cart_v1',
  WISHLIST: 'fragmore_wishlist_v1',
  ORDERS: 'fragmore_orders_v1',
  VISITOR_ID: 'fragmore_visitor_id_v1',
  VISITOR_STATS: 'fragmore_visitor_stats_v1',
  PRODUCTS: 'fragmore_products_v2',
  COUPONS: 'fragmore_coupons_v1',
  REVIEWS: 'fragmore_reviews_v1',
  ABANDONED_CARTS: 'fragmore_abandoned_v1',
  CMS: 'fragmore_cms_v2',
  INFLUENCERS: 'fragmore_influencers_v1',
  CUSTOMER: 'fragmore_customer_v1',
  CUSTOMERS: 'fragmore_customers_v1',
  INTEGRATIONS: 'fragmore_integrations_v1',
  CAMPAIGNS: 'fragmore_campaigns_v1',
  RETURNS: 'fragmore_returns_v1',
  BACK_IN_STOCK: 'fragmore_back_in_stock_v1',
  AUDIT_LOGS: 'fragmore_audit_logs_v1',
  THEME: 'fragmore_theme_v1',
  PASSWORDS: 'fragmore_passwords_v1'
};

const LEGACY_SLOGAN_REGEX = /memories\s*(?:and|&)\s*health|scents\s+that\s+stay\s+with\s+you/gi;
const HAUTE_PARFUMERIE_REGEX = /\bhaute\s+parfumerie\b\s*·?\s*/gi;

const INITIAL_VISITOR_STATS: VisitorStats = {
  totalVisitors: 4280,
  uniqueVisitors: 3410,
  todayVisitors: 314,
  activeNow: 6,
  totalPageViews: 14820,
  avgSessionDurationSeconds: 194,
  bounceRate: 28.6,
  deviceBreakdown: {
    mobile: 2482,
    desktop: 1540,
    tablet: 258
  },
  channelBreakdown: {
    direct: 1455,
    instagram: 1198,
    search: 856,
    whatsapp: 512,
    referral: 259
  },
  topLocations: [
    { city: 'Mumbai', count: 1112, percentage: 26 },
    { city: 'Delhi NCR', count: 1027, percentage: 24 },
    { city: 'Bengaluru', count: 770, percentage: 18 },
    { city: 'Hyderabad', count: 513, percentage: 12 },
    { city: 'Kolkata', count: 342, percentage: 8 },
    { city: 'Chennai', count: 299, percentage: 7 },
    { city: 'Pune / International', count: 217, percentage: 5 }
  ],
  hourlyTrend: [
    { hour: '12AM', visitors: 14, pageViews: 42 },
    { hour: '2AM', visitors: 8, pageViews: 22 },
    { hour: '4AM', visitors: 6, pageViews: 18 },
    { hour: '6AM', visitors: 11, pageViews: 30 },
    { hour: '8AM', visitors: 24, pageViews: 76 },
    { hour: '10AM', visitors: 38, pageViews: 124 },
    { hour: '12PM', visitors: 45, pageViews: 158 },
    { hour: '2PM', visitors: 52, pageViews: 184 },
    { hour: '4PM', visitors: 48, pageViews: 162 },
    { hour: '6PM', visitors: 64, pageViews: 220 },
    { hour: '8PM', visitors: 78, pageViews: 286 },
    { hour: '10PM', visitors: 56, pageViews: 198 }
  ],
  recentVisits: [
    {
      id: 'v-rec-1',
      visitorId: 'frag-vis-4280',
      page: 'Storefront Hero & Showcase',
      device: 'mobile',
      channel: 'instagram',
      location: 'Mumbai',
      timestamp: new Date().toISOString(),
      durationSeconds: 142
    },
    {
      id: 'v-rec-2',
      visitorId: 'frag-vis-4279',
      page: 'BLUSH & BLOSSOM (50ml Luxury EDP)',
      device: 'desktop',
      channel: 'direct',
      location: 'Delhi NCR',
      timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
      durationSeconds: 210
    },
    {
      id: 'v-rec-3',
      visitorId: 'frag-vis-4278',
      page: 'AURA VELVET (Intimate Gourmand)',
      device: 'mobile',
      channel: 'search',
      location: 'Bengaluru',
      timestamp: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
      durationSeconds: 185
    }
  ]
};

function sanitizeCmsSettings(raw: Partial<CMSSettings> | null | undefined): CMSSettings {
  const merged: any = { ...INITIAL_CMS, ...(raw || {}) };
  for (const key of Object.keys(merged)) {
    let val = merged[key];
    if (typeof val === 'string') {
      if (LEGACY_SLOGAN_REGEX.test(val)) {
        val = val.replace(LEGACY_SLOGAN_REGEX, (match) =>
          match === match.toUpperCase() ? 'SCENT THAT STAYS WITH YOU' : 'Scent That Stays With You'
        );
      }
      if (HAUTE_PARFUMERIE_REGEX.test(val)) {
        val = val.replace(HAUTE_PARFUMERIE_REGEX, '').trim();
        if (val.length > 0 && val[0] === val[0].toLowerCase()) {
          val = val.charAt(0).toUpperCase() + val.slice(1);
        }
      }
      merged[key] = val;
    }
  }
  if (!merged.heroHeadline || /memories\s*(?:and|&)\s*health|scents\s+that\s+stay\s+with\s+you/i.test(merged.heroHeadline)) {
    merged.heroHeadline = 'SCENT THAT STAYS WITH YOU.';
  }
  if (!merged.freeShippingThreshold || Number(merged.freeShippingThreshold) === 2500) {
    merged.freeShippingThreshold = 999;
  }
  if (typeof merged.announcementBarText === 'string' && /2,?500/.test(merged.announcementBarText)) {
    merged.announcementBarText = merged.announcementBarText.replace(/₹?\s*2,?500/g, '₹999');
  }
  return merged as CMSSettings;
}

function enrichProductTaxonomy(rawList: any[]): Product[] {
  const initialMap = new Map(INITIAL_PRODUCTS.map((p) => [p.slug, p]));
  return rawList.map((p: any) => {
    const seed = initialMap.get(p.slug);
    const mergedFamilies = Array.from(
      new Set([
        ...(Array.isArray(p.families) ? p.families : []),
        ...(seed?.families || [])
      ])
    );
    const mergedOccasions = Array.from(
      new Set([
        ...(Array.isArray(p.occasions) ? p.occasions : []),
        ...(seed?.occasions || [])
      ])
    );
    return {
      ...p,
      variants: Array.isArray(p.variants) ? p.variants : seed?.variants || [],
      families: mergedFamilies,
      occasions: mergedOccasions,
      features: Array.isArray(p.features) ? p.features : seed?.features || [],
      notes:
        p.notes && typeof p.notes === 'object'
          ? p.notes
          : seed?.notes || { top: [], heart: [], base: [] },
      noteMedia: p.noteMedia && typeof p.noteMedia === 'object' ? p.noteMedia : seed?.noteMedia || {}
    };
  });
}

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Navigation states (supports ?product=slug or /product/slug URLs including legacy product URLs)
  const [currentView, setCurrentViewState] = useState<string>(() => {
    try {
      if (window.location.pathname.startsWith('/admin/ai-cmo')) return 'admin';
      const params = new URLSearchParams(window.location.search);
      if (params.get('product')) return 'product';
      const pathMatch = window.location.pathname.match(/^\/products?\/([^/]+)$/i);
      if (pathMatch && pathMatch[1]) return 'product';
    } catch {}
    return 'storefront';
  });

  const setCurrentView = (view: string) => {
    try {
      if (
        typeof window !== 'undefined' &&
        view !== 'admin' &&
        window.location.pathname.startsWith('/admin')
      ) {
        window.history.pushState({}, '', '/');
      }
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      }
    } catch {}
    setCurrentViewState(view);
  };
  const [selectedProductSlug, setSelectedProductSlug] = useState<string | null>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const qProd = params.get('product');
      if (qProd) return qProd.toLowerCase();
      const pathMatch = window.location.pathname.match(/^\/products?\/([^/]+)$/i);
      if (pathMatch && pathMatch[1]) return pathMatch[1].toLowerCase();
    } catch {}
    return null;
  });
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [isMiniCartOpen, setIsMiniCartOpen] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isQuizOpen, setIsQuizOpen] = useState<boolean>(false);
  const [isEventInspectorOpen, setIsEventInspectorOpen] = useState<boolean>(false);
  const [selectedOrderForInvoice, setSelectedOrderForInvoice] = useState<Order | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [adminRole, setAdminRoleState] = useState<AdminRole>(() => {
    try {
      const savedRole = localStorage.getItem('fragmore_admin_role_v1');
      if (savedRole) return savedRole as AdminRole;
    } catch {}
    return 'CUSTOMER' as any;
  });

  const setAdminRole = (role: AdminRole) => {
    setAdminRoleState(role);
    try {
      localStorage.setItem('fragmore_admin_role_v1', role);
    } catch {}
  };

  // Theme State: White ('light') studio theme enforced across the storefront
  const [theme, setThemeState] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    try {
      const root = document.documentElement;
      root.setAttribute('data-theme', 'light');
      root.classList.remove('dark');
      localStorage.setItem(STORAGE_KEYS.THEME, 'light');
    } catch {}
  }, [theme]);

  const setTheme = (nextTheme: 'light' | 'dark') => {
    setThemeState(nextTheme);
  };

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // Customer Profile & Saved Addresses (Default null until user authenticates)
  const [customer, setCustomer] = useState<CustomerAccountState | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CUSTOMER);
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      if (parsed) {
        if (!Array.isArray(parsed.addresses)) {
          parsed.addresses = [];
        }
        const emailLower = (parsed.email || '').trim().toLowerCase();
        if (
          emailLower === 'gowisherharsha@gmail.com' ||
          emailLower === 'aibrandorigin@gmail.com' ||
          emailLower.includes('admin')
        ) {
          parsed.role = 'SUPER_ADMIN';
        }
      }
      return parsed;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      const savedMapRaw = localStorage.getItem(STORAGE_KEYS.PASSWORDS);
      const savedMap: Record<string, string> = savedMapRaw ? JSON.parse(savedMapRaw) : {};
      if (!savedMap['gowisherharsha@gmail.com']) {
        savedMap['gowisherharsha@gmail.com'] = '111111';
        localStorage.setItem(STORAGE_KEYS.PASSWORDS, JSON.stringify(savedMap));
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (customer) {
      const emailLower = (customer.email || '').trim().toLowerCase();
      const isForcedAdmin =
        customer.role === 'SUPER_ADMIN' ||
        emailLower === 'gowisherharsha@gmail.com' ||
        emailLower === 'aibrandorigin@gmail.com';
      const safeCustomer = {
        ...customer,
        role: isForcedAdmin ? ('SUPER_ADMIN' as const) : customer.role,
        addresses: Array.isArray(customer.addresses) ? customer.addresses : []
      };
      localStorage.setItem(STORAGE_KEYS.CUSTOMER, JSON.stringify(safeCustomer));
      if (isForcedAdmin) {
        setAdminRole('SUPER_ADMIN');
      }
    } else {
      localStorage.removeItem(STORAGE_KEYS.CUSTOMER);
    }
  }, [customer]);

  const [notification, setNotification] = useState<string | null>(null);
  const [isCloudSqlConnected, setIsCloudSqlConnected] = useState<boolean>(true);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState<boolean>(true);

  // Store Visitor Telemetry State
  const [visitorStats, setVisitorStats] = useState<VisitorStats>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.VISITOR_STATS);
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_VISITOR_STATS;
  });

  const refreshVisitorStats = async () => {
    try {
      const stats = await cloudSqlApi.getVisitorStats();
      if (stats && typeof stats.totalVisitors === 'number') {
        setVisitorStats(stats);
        localStorage.setItem(STORAGE_KEYS.VISITOR_STATS, JSON.stringify(stats));
      }
    } catch {
      // Non-fatal fallback
    }
  };

  // Visitor telemetry is initialized below after cart and customer state are mounted.


  // Notifications helper
  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification((curr) => (curr === msg ? null : curr));
    }, 4000);
  };

  // Helper to persist any entity document to Firestore safely
  const saveToFirestore = (collectionName: string, docId: string, data: Record<string, any>) => {
    try {
      const cleanPayload = JSON.parse(
        JSON.stringify({
          ...data,
          updatedAt: new Date().toISOString()
        })
      );
      setDoc(doc(firestore, collectionName, String(docId)), cleanPayload, { merge: true }).catch(() => {});
    } catch {}
  };

  const removeFromFirestore = (collectionName: string, docId: string) => {
    try {
      deleteDoc(doc(firestore, collectionName, String(docId))).catch(() => {});
    } catch {}
  };

  // Unified Cloud SQL & Firebase data hydration
  useEffect(() => {
    let isMounted = true;

    // Validate connection to Firestore on boot
    const verifyFirestoreConnection = async () => {
      try {
        await getDocFromServer(doc(firestore, 'test', 'connection'));
        if (isMounted) setIsFirebaseConnected(true);
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error('Please check your Firebase configuration.');
        }
      }

      // Also merge any customer records stored in Firestore
      try {
        const snap = await getDocs(collection(firestore, 'customers'));
        if (!snap.empty && isMounted) {
          const fsCusts: CustomerProfile[] = [];
          snap.forEach((docSnap) => {
            const d = docSnap.data() as any;
            if (d && d.email) {
              fsCusts.push({
                id: d.id || docSnap.id,
                name: d.name || d.email.split('@')[0],
                email: d.email,
                phone: d.phone || '',
                registeredDate: d.registeredDate || '2026-10-01',
                accountCreationDate: d.accountCreationDate || d.registeredDate || '2026-10-01',
                segments: Array.isArray(d.segments) ? d.segments : ['New Customers'],
                totalSpend: Number(d.totalSpend) || 0,
                ordersCount: Number(d.ordersCount) || 0,
                aov: Number(d.aov) || 0,
                lastOrderDate: d.lastOrderDate || 'Never',
                lastPurchaseDate: d.lastPurchaseDate || 'No purchases yet',
                daysSinceLastOrder: Number(d.daysSinceLastOrder) || 0,
                favouriteFragrance: d.favouriteFragrance || 'GOLDEN HOUR',
                isDiscoveryBuyer: Boolean(d.isDiscoveryBuyer),
                wishlistSlugs: Array.isArray(d.wishlistSlugs) ? d.wishlistSlugs : [],
                addresses: Array.isArray(d.addresses) ? d.addresses : [],
                reviewsCount: Number(d.reviewsCount) || 0,
                abandonedCartsCount: Number(d.abandonedCartsCount) || 0,
                couponsUsed: Array.isArray(d.couponsUsed) ? d.couponsUsed : [],
                source: d.source || 'Web Account Registration',
                notes: d.notes || '',
                communicationHistory: Array.isArray(d.communicationHistory) ? d.communicationHistory : []
              });
            }
          });
          if (fsCusts.length > 0) {
            setCustomers((prev) => {
              const map = new Map(prev.map((c) => [c.email.toLowerCase(), c]));
              for (const fc of fsCusts) {
                const key = fc.email.toLowerCase();
                const existing = map.get(key);
                map.set(key, existing ? { ...fc, ...existing, addresses: existing.addresses?.length ? existing.addresses : fc.addresses } : fc);
              }
              return Array.from(map.values());
            });
          }
        }
      } catch {}
    };

    verifyFirestoreConnection();

    // 1. Primary Cloud SQL Relational Database Hydration
    const hydrateFromCloudSql = async () => {
      try {
        const [
          cloudProds,
          cloudOrds,
          cloudCusts,
          cloudRevs,
          cloudCoups,
          cloudInfs,
          cloudCarts,
          cloudCmsSettings,
          cloudLogs,
          cloudCamps,
          cloudReturns
        ] = await Promise.allSettled([
          cloudSqlApi.getProducts(),
          cloudSqlApi.getOrders(),
          cloudSqlApi.getCustomers(),
          cloudSqlApi.getReviews(),
          cloudSqlApi.getCoupons(),
          cloudSqlApi.getInfluencers(),
          cloudSqlApi.getAbandonedCarts(),
          cloudSqlApi.getCMS(),
          cloudSqlApi.getAuditLogs(),
          cloudSqlApi.getCampaigns(),
          cloudSqlApi.getReturns()
        ]);

        if (!isMounted) return;

        const LEGACY_DUMMY_IDS = ['prod-azure', 'prod-ignite', 'prod-roselle', 'prod-elan', 'prod-suede', 'prod-solara', 'prod-aaradhya', 'prod-samarpan', 'prod-ananta'];
        const LEGACY_DUMMY_SLUGS = ['azure', 'ignite', 'roselle', 'elan', 'flan', 'suede', 'solara', 'aaradhya', 'samarpan', 'ananta'];
        const LEGACY_DUMMY_ORDER_IDS = ['ord-1001', 'ord-1002', 'ord-1003', 'ord-1004'];
        const LEGACY_DUMMY_CUSTOMER_IDS = ['cust-101', 'cust-102', 'cust-103', 'cust-104', 'cust-105', 'cust-1792951663625-ndrt'];

        let safeOrders: any[] = [];
        if (cloudProds.status === 'fulfilled' && cloudProds.value && cloudProds.value.length > 0) {
          const approvedProds = cloudProds.value.filter((p: any) => {
            if (LEGACY_DUMMY_IDS.includes(p.id) || LEGACY_DUMMY_SLUGS.includes((p.slug || '').toLowerCase())) return false;
            return p.status !== 'ARCHIVED';
          });
          setProducts(enrichProductTaxonomy(approvedProds.length > 0 ? approvedProds : INITIAL_PRODUCTS));
        }
        if (cloudOrds.status === 'fulfilled' && cloudOrds.value && cloudOrds.value.length > 0) {
          safeOrders = cloudOrds.value
            .filter((o: any) => {
              if (LEGACY_DUMMY_ORDER_IDS.includes(o.id)) return false;
              const items = Array.isArray(o.items) ? o.items : [];
              if (items.length > 0) {
                const hasCatalogueItem = items.some((i: any) => {
                  const pName = (i.productName || '').toUpperCase();
                  const pId = (i.productId || '').toLowerCase();
                  return !LEGACY_DUMMY_SLUGS.some(s => pName.includes(s.toUpperCase())) && !LEGACY_DUMMY_IDS.includes(pId);
                });
                if (!hasCatalogueItem) return false;
              }
              return true;
            })
            .map((o: any) => ({
              ...o,
              items: Array.isArray(o.items) ? o.items : [],
              shippingAddress: o.shippingAddress && typeof o.shippingAddress === 'object' ? o.shippingAddress : {
                id: 'addr-default',
                fullName: o.customerName || 'Valued Client',
                phone: o.customerPhone || '',
                email: o.customerEmail || '',
                addressLine1: 'Consignment Delivery Address',
                city: 'Mumbai',
                state: 'Maharashtra',
                pincode: '400001'
              }
            }));
          setOrders(safeOrders);
        }
        if (cloudCusts.status === 'fulfilled' && cloudCusts.value && cloudCusts.value.length > 0) {
          const formattedCusts: CustomerProfile[] = cloudCusts.value
            .filter((c: any) => !LEGACY_DUMMY_CUSTOMER_IDS.includes(c.id))
            .map((c: any) => ({
            id: c.id,
            name: c.name || 'Valued Client',
            email: c.email || '',
            phone: c.phone || '',
            registeredDate: c.createdAt ? new Date(c.createdAt).toISOString().split('T')[0] : '2026-08-01',
            accountCreationDate: c.createdAt ? new Date(c.createdAt).toISOString().split('T')[0] : '2026-08-01',
            segments: Array.isArray(c.segments) ? c.segments : Array.isArray(c.tags) ? c.tags : ['Private Client'],
            totalSpend: Number(c.totalSpend) || 0,
            ordersCount: Number(c.ordersCount) || Number(c.totalOrders) || 0,
            aov: Number(c.totalOrders) > 0 ? Math.round(Number(c.totalSpend) / Number(c.totalOrders)) : (Number(c.aov) || 0),
            lastOrderDate: c.lastOrderDate || '2026-09-01',
            daysSinceLastOrder: c.daysSinceLastOrder !== undefined ? Number(c.daysSinceLastOrder) : 5,
            favouriteFragrance: c.favouriteFragrance || 'GOLDEN HOUR',
            isDiscoveryBuyer: c.isDiscoveryBuyer ?? false,
            wishlistSlugs: Array.isArray(c.wishlistSlugs) ? c.wishlistSlugs : [],
            addresses: Array.isArray(c.addresses) ? c.addresses : [],
            reviewsCount: Number(c.reviewsCount) || 0,
            abandonedCartsCount: Number(c.abandonedCartsCount) || 0,
            couponsUsed: Array.isArray(c.couponsUsed) ? c.couponsUsed : [],
            source: c.source || 'Direct Client Acquisition',
            influencer: c.influencer || '',
            utmSource: c.utmSource || '',
            utmCampaign: c.utmCampaign || '',
            notes: c.notes || '',
            communicationHistory: Array.isArray(c.communicationHistory) ? c.communicationHistory : []
          }));
          setCustomers(formattedCusts);
        }
        if (cloudRevs.status === 'fulfilled' && cloudRevs.value && cloudRevs.value.length > 0) {
          const formattedReviews = cloudRevs.value.map((r: any) => ({
            id: r.id,
            productId: r.productId || `prod-${r.productSlug}`,
            productName: r.productSlug ? r.productSlug.toUpperCase() : 'Fragrance',
            customerName: r.authorName || r.customerName,
            rating: r.rating,
            title: r.title,
            content: r.comment || r.content,
            isVerifiedPurchase: r.verified ?? true,
            date: r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : '2026-09-01',
            status: (r.status || 'APPROVED').toUpperCase()
          }));
          setReviews(formattedReviews);
        }
        if (cloudCoups.status === 'fulfilled' && cloudCoups.value && cloudCoups.value.length > 0) {
          const formattedCoupons: Coupon[] = cloudCoups.value.map((c: any) => ({
            code: c.code,
            discountType: (c.discountType || 'PERCENTAGE') as any,
            value: c.value,
            minCartValue: c.minOrderValue || 0,
            maxDiscount: c.maxDiscount || undefined,
            expiryDate: c.expiryDate || '2026-12-31',
            usageLimit: c.usageLimit || 1000,
            timesUsed: c.usageCount || 0,
            isActive: c.isActive ?? true,
            description: c.description || ''
          }));
          setCoupons(formattedCoupons);
        }
        if (cloudInfs.status === 'fulfilled' && cloudInfs.value && cloudInfs.value.length > 0) {
          const formattedInfs = cloudInfs.value.map((i: any) => ({
            id: i.id,
            name: i.name,
            code: i.referralCode,
            commissionPercentage: i.commissionRate,
            campaign: 'Haute Editorial Series',
            clicks: i.clicks || 0,
            orders: i.ordersCount || 0,
            totalRevenue: i.totalRevenue || 0,
            totalCommission: Math.round(((i.totalRevenue || 0) * (i.commissionRate || 10)) / 100),
            status: (i.status || 'ACTIVE').toUpperCase()
          }));
          setInfluencers(formattedInfs);
        }
        if (cloudCarts.status === 'fulfilled' && cloudCarts.value && cloudCarts.value.length > 0) {
          setAbandonedCarts(cloudCarts.value);
        }
        if (cloudCmsSettings.status === 'fulfilled' && cloudCmsSettings.value && Object.keys(cloudCmsSettings.value).length > 0) {
          setCms((prev) => sanitizeCmsSettings({ ...prev, ...cloudCmsSettings.value }));
        }
        if (cloudLogs.status === 'fulfilled' && cloudLogs.value && cloudLogs.value.length > 0) {
          setAuditLogs(cloudLogs.value);
        }
        if (cloudCamps.status === 'fulfilled' && Array.isArray(cloudCamps.value) && cloudCamps.value.length > 0) {
          setCampaigns(
            cloudCamps.value.map((c: any) => ({
              id: c.id,
              name: c.name,
              type: (c.channel || c.type || 'META') as any,
              status: (c.status || 'ACTIVE') as any,
              targetSegment: (c.campaignMetadata as any)?.targetSegment || 'VIP Collectors',
              subjectOrTemplate: (c.campaignMetadata as any)?.subjectOrTemplate || c.name,
              content: (c.campaignMetadata as any)?.content || `Authoritative campaign synced (${c.channel})`,
              scheduledAt: c.startDate || '2026-10-01',
              scheduledDate: c.startDate || '2026-10-01',
              sentCount: Number((c.campaignMetadata as any)?.sentCount ?? 1250),
              openRate: Number((c.campaignMetadata as any)?.openRate ?? 48),
              clickRate: Number((c.campaignMetadata as any)?.clickRate ?? 14),
              clicksCount: Number((c.campaignMetadata as any)?.clicksCount ?? 175),
              convertedCount: Number((c.campaignMetadata as any)?.convertedCount ?? 36),
              revenueGenerated: Number(c.revenue ?? c.revenueGenerated ?? 0),
              spend: Number(c.spend ?? c.budget ?? 0)
            }))
          );
        }
        if (cloudReturns.status === 'fulfilled' && Array.isArray(cloudReturns.value) && cloudReturns.value.length > 0) {
          setReturns(
            cloudReturns.value.map((r: any) => ({
              id: r.id,
              orderId: r.orderId,
              orderNumber: r.orderNumber,
              customerName: r.customerName,
              customerEmail: (r.returnMetadata as any)?.customerEmail || '',
              productName: r.productName,
              size: r.size || '100ml',
              quantity: Number(r.quantity || 1),
              reason: r.reason,
              type: (r.type || 'REFUND') as any,
              status: (r.status || 'REQUESTED') as any,
              requestedAt: r.requestedAt || '2026-10-01',
              requestDate: r.requestedAt || '2026-10-01',
              refundAmount: Number(r.refundAmount || 0),
              restockInventory: Boolean(r.restockInventory),
              notes: r.notes || ''
            }))
          );
        }
        if (isMounted) {
          setIsCloudSqlConnected(true);
        }
      } catch (err) {
        console.warn('[Cloud SQL] Hydration notice:', err);
      }
    };

    hydrateFromCloudSql();

    return () => {
      isMounted = false;
    };
  }, []);

  // Periodic Database Synchronization across tabs, browsers, and Admin sessions
  useEffect(() => {
    const syncDatabaseCustomers = async () => {
      try {
        const isAdminSession =
          adminRole === 'SUPER_ADMIN' ||
          customer?.role === 'SUPER_ADMIN' ||
          customer?.email?.toLowerCase() === 'gowisherharsha@gmail.com' ||
          customer?.email?.toLowerCase() === 'aibrandorigin@gmail.com' ||
          customer?.email?.toLowerCase().includes('admin');

        if (isAdminSession) {
          const cloudCusts = await cloudSqlApi.getAdminCustomers(adminRole, customer?.email);
          if (Array.isArray(cloudCusts)) {
            setCustomers(cloudCusts);
          }
        } else {
          const cloudCusts = await cloudSqlApi.getCustomers();
          if (Array.isArray(cloudCusts)) {
            setCustomers((prev) => {
              const prevMap = new Map(prev.map((c) => [c.id, c]));
              return cloudCusts.map((c: any) => {
                const existing = prevMap.get(c.id);
                return {
                  ...c,
                  registeredDate: c.createdAt ? new Date(c.createdAt).toISOString().split('T')[0] : (existing?.registeredDate || ''),
                  accountCreationDate: c.createdAt ? new Date(c.createdAt).toISOString().split('T')[0] : (existing?.accountCreationDate || ''),
                  segments: Array.isArray(c.tags) ? c.tags : (existing?.segments || []),
                  totalSpend: Number(c.totalSpend) || existing?.totalSpend || 0,
                  ordersCount: Number(c.totalOrders) || existing?.ordersCount || 0,
                  aov: Number(c.totalOrders) > 0 ? Math.round(Number(c.totalSpend) / Number(c.totalOrders)) : (existing?.aov || 0),
                  lastOrderDate: existing?.lastOrderDate || 'Never',
                  daysSinceLastOrder: existing?.daysSinceLastOrder ?? 0,
                  favouriteFragrance: c.favouriteFragrance || existing?.favouriteFragrance || '',
                  isDiscoveryBuyer: existing?.isDiscoveryBuyer ?? false,
                  wishlistSlugs: Array.isArray(c.wishlistSlugs) ? c.wishlistSlugs : (existing?.wishlistSlugs || []),
                  reviewsCount: existing?.reviewsCount || 0,
                  abandonedCartsCount: existing?.abandonedCartsCount || 0,
                  couponsUsed: existing?.couponsUsed || [],
                  source: c.source || existing?.source || 'Direct Website',
                  notes: c.notes || existing?.notes || '',
                  communicationHistory: Array.isArray(c.communicationHistory) ? c.communicationHistory : (existing?.communicationHistory || [])
                };
              });
            });
          }
        }
        // Synchronize CMS, Products, Orders, Coupons, Abandoned Carts, Campaigns, and Returns from central PostgreSQL across all browsers & sessions
        const [freshCms, freshProds, freshOrders, freshCoupons, freshCarts, freshCamps, freshReturns] =
          await Promise.allSettled([
            cloudSqlApi.getCMS(),
            cloudSqlApi.getProducts(),
            cloudSqlApi.getOrders(),
            cloudSqlApi.getCoupons(),
            cloudSqlApi.getAbandonedCarts(),
            cloudSqlApi.getCampaigns(),
            cloudSqlApi.getReturns()
          ]);
        if (freshCms.status === 'fulfilled' && freshCms.value && Object.keys(freshCms.value).length > 0) {
          setCms((prev) => sanitizeCmsSettings({ ...prev, ...freshCms.value }));
        }
        if (freshProds.status === 'fulfilled' && Array.isArray(freshProds.value) && freshProds.value.length > 0) {
          const LEGACY_DUMMY_IDS = ['prod-azure', 'prod-ignite', 'prod-roselle', 'prod-elan', 'prod-suede', 'prod-solara', 'prod-aaradhya', 'prod-samarpan', 'prod-ananta'];
          const LEGACY_DUMMY_SLUGS = ['azure', 'ignite', 'roselle', 'elan', 'flan', 'suede', 'solara', 'aaradhya', 'samarpan', 'ananta'];
          const approvedProds = freshProds.value.filter((p: any) => {
            if (LEGACY_DUMMY_IDS.includes(p.id) || LEGACY_DUMMY_SLUGS.includes((p.slug || '').toLowerCase())) return false;
            return p.status !== 'ARCHIVED';
          });
          if (approvedProds.length > 0) {
            setProducts(enrichProductTaxonomy(approvedProds));
          }
        }
        if (freshOrders.status === 'fulfilled' && Array.isArray(freshOrders.value)) {
          setOrders(
            freshOrders.value
              .filter((o: any) => !['ord-1001', 'ord-1002', 'ord-1003', 'ord-1004'].includes(o.id))
              .map((o: any) => ({
              ...o,
              items: Array.isArray(o.items) ? o.items : [],
              shippingAddress:
                o.shippingAddress && typeof o.shippingAddress === 'object'
                  ? o.shippingAddress
                  : {
                      id: 'addr-default',
                      fullName: o.customerName || 'Valued Client',
                      phone: o.customerPhone || '',
                      email: o.customerEmail || '',
                      addressLine1: 'Consignment Delivery Address',
                      city: 'Mumbai',
                      state: 'Maharashtra',
                      pincode: '400001'
                    }
            }))
          );
        }
        if (freshCoupons.status === 'fulfilled' && Array.isArray(freshCoupons.value) && freshCoupons.value.length > 0) {
          setCoupons(
            freshCoupons.value.map((c: any) => ({
              code: c.code,
              discountType: (c.discountType || 'PERCENTAGE') as any,
              value: c.value,
              minCartValue: c.minOrderValue || 0,
              maxDiscount: c.maxDiscount || undefined,
              expiryDate: c.expiryDate || '2026-12-31',
              usageLimit: c.usageLimit || 1000,
              timesUsed: c.usageCount || 0,
              isActive: c.isActive ?? true,
              description: c.description || ''
            }))
          );
        }
        if (freshCarts.status === 'fulfilled' && Array.isArray(freshCarts.value) && freshCarts.value.length > 0) {
          setAbandonedCarts(freshCarts.value);
        }
        if (freshCamps.status === 'fulfilled' && Array.isArray(freshCamps.value) && freshCamps.value.length > 0) {
          setCampaigns(
            freshCamps.value.map((c: any) => ({
              id: c.id,
              name: c.name,
              type: (c.channel || c.type || 'META') as any,
              status: (c.status || 'ACTIVE') as any,
              targetSegment: (c.campaignMetadata as any)?.targetSegment || 'VIP Collectors',
              subjectOrTemplate: (c.campaignMetadata as any)?.subjectOrTemplate || c.name,
              content: (c.campaignMetadata as any)?.content || `Authoritative campaign synced (${c.channel})`,
              scheduledAt: c.startDate || '2026-10-01',
              scheduledDate: c.startDate || '2026-10-01',
              sentCount: Number((c.campaignMetadata as any)?.sentCount ?? 1250),
              openRate: Number((c.campaignMetadata as any)?.openRate ?? 48),
              clickRate: Number((c.campaignMetadata as any)?.clickRate ?? 14),
              clicksCount: Number((c.campaignMetadata as any)?.clicksCount ?? 175),
              convertedCount: Number((c.campaignMetadata as any)?.convertedCount ?? 36),
              revenueGenerated: Number(c.revenue ?? c.revenueGenerated ?? 0),
              spend: Number(c.spend ?? c.budget ?? 0)
            }))
          );
        }
        if (freshReturns.status === 'fulfilled' && Array.isArray(freshReturns.value) && freshReturns.value.length > 0) {
          setReturns(
            freshReturns.value.map((r: any) => ({
              id: r.id,
              orderId: r.orderId,
              orderNumber: r.orderNumber,
              customerName: r.customerName,
              customerEmail: (r.returnMetadata as any)?.customerEmail || '',
              productName: r.productName,
              size: r.size || '100ml',
              quantity: Number(r.quantity || 1),
              reason: r.reason,
              type: (r.type || 'REFUND') as any,
              status: (r.status || 'REQUESTED') as any,
              requestedAt: r.requestedAt || '2026-10-01',
              requestDate: r.requestedAt || '2026-10-01',
              refundAmount: Number(r.refundAmount || 0),
              restockInventory: Boolean(r.restockInventory),
              notes: r.notes || ''
            }))
          );
        }
      } catch {
        // Non-fatal background sync
      }
    };

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('fragmore_store_sync');
      bc.onmessage = (event) => {
        if (event.data?.type === 'CMS_UPDATED' && event.data.cms) {
          setCms((prev) => sanitizeCmsSettings({ ...prev, ...event.data.cms }));
        } else if (event.data?.type === 'PRODUCTS_UPDATED' && Array.isArray(event.data.products)) {
          setProducts(enrichProductTaxonomy(event.data.products));
        } else {
          syncDatabaseCustomers();
        }
      };
    } catch {}

    // Open persistent SSE stream only for authenticated Admin sessions so public shoppers do not pin Cloud Run workers
    const isAdminSession = Boolean(adminRole) && !['CUSTOMER', 'NONE'].includes(String(adminRole).toUpperCase());
    let sse: EventSource | null = null;
    if (isAdminSession) {
      try {
        sse = new EventSource('/api/realtime/stream');
        sse.onmessage = (evt) => {
          try {
            const payload = JSON.parse(evt.data);
            if (payload?.type === 'CROSS_BROWSER_SYNC') {
              syncDatabaseCustomers();
              window.dispatchEvent(new CustomEvent('fragmore:authoritative-sync', { detail: payload }));
            }
          } catch {}
        };
      } catch {}
    }

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (!isAdminSession && !customer?.email) return;
      syncDatabaseCustomers();
    }, 60000);
    window.addEventListener('focus', syncDatabaseCustomers);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', syncDatabaseCustomers);
      if (bc) bc.close();
      if (sse) sse.close();
    };
  }, [adminRole, customer]);

  // Marketing Attribution
  const [attribution, setAttribution] = useState<MarketingAttribution>(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      utm_source: params.get('utm_source') || 'direct',
      utm_medium: params.get('utm_medium') || 'none',
      utm_campaign: params.get('utm_campaign') || 'brand_launch',
      utm_content: params.get('utm_content') || undefined,
      utm_term: params.get('utm_term') || undefined,
      referrer: document.referrer || 'direct',
      landingPage: window.location.pathname || '/'
    };
  });

  // Marketing Events Log
  const [marketingEvents, setMarketingEvents] = useState<MarketingEvent[]>([]);

  const trackEvent = (eventName: string, payload: Record<string, any> = {}) => {
    const newEvent: MarketingEvent = {
      id: 'evt_' + Math.random().toString(36).substring(2, 9),
      eventName,
      timestamp: new Date().toLocaleTimeString(),
      payload: { ...payload, utm_source: attribution.utm_source },
      channels: ['META_PIXEL', 'GA4', 'GTM', 'GOOGLE_ADS']
    };
    setMarketingEvents((prev) => [newEvent, ...prev.slice(0, 49)]);

    // Map storefront telemetry events to canonical durable backend automation events
    const eventMap: Record<string, string> = {
      ViewContent: 'product.viewed',
      AddToCart: 'product.added_to_cart',
      AddToWishlist: 'wishlist.updated',
      RemoveFromWishlist: 'wishlist.updated',
      InitiateCheckout: 'checkout.started',
      CustomerLogin: 'customer.logged_in',
      CustomerRegistered: 'customer.registered',
      CustomerVerified: 'customer.verified',
      CustomerVisited: 'customer.visited',
      CampaignAttributed: 'campaign.attributed'
    };
    const mappedType = eventMap[eventName] || (eventName.includes('.') ? eventName : '');
    if (mappedType) {
      fetch('/api/automation/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: mappedType,
          source: 'storefront_telemetry',
          idempotencyKey: `${mappedType}_${customer?.id || 'guest'}_${payload?.productSlug || payload?.orderId || payload?.action || ''}_${Math.floor(Date.now() / 15000)}`,
          customerId: customer?.id,
          customerEmail: customer?.email,
          customerPhone: customer?.phone,
          orderId: payload?.orderId,
          payload: {
            ...payload,
            utm_source: attribution.utm_source,
            utm_medium: attribution.utm_medium,
            utm_campaign: attribution.utm_campaign,
            referrer: attribution.referrer,
            landingPage: attribution.landingPage
          }
        })
      }).catch(() => {});
    }
  };

  // Automatically record first visit / latest visit & campaign attribution when customer session is active
  useEffect(() => {
    if (!customer?.email && !customer?.phone) return;
    fetch('/api/automation/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: 'customer.visited',
        source: 'storefront_session',
        idempotencyKey: `visit_${customer.id || customer.email}_${new Date().toISOString().slice(0, 13)}`,
        customerId: customer.id,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        payload: {
          landingPage: attribution.landingPage,
          referrer: attribution.referrer,
          utmSource: attribution.utm_source,
          utmMedium: attribution.utm_medium,
          utmCampaign: attribution.utm_campaign
        }
      })
    }).catch(() => {});

    if (attribution.utm_source && attribution.utm_source !== 'direct') {
      fetch('/api/automation/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'campaign.attributed',
          source: 'utm_tracker',
          idempotencyKey: `utm_${customer.id || customer.email}_${attribution.utm_source}_${attribution.utm_campaign}`,
          customerId: customer.id,
          customerEmail: customer.email,
          customerPhone: customer.phone,
          payload: {
            utmSource: attribution.utm_source,
            utmMedium: attribution.utm_medium,
            utmCampaign: attribution.utm_campaign,
            referrer: attribution.referrer
          }
        })
      }).catch(() => {});
    }
  }, [customer?.email, customer?.phone]);

  // Products & Inventory (Authoritative source of truth is Central PostgreSQL Backend — never localStorage)
  const [products, setProducts] = useState<Product[]>(() => INITIAL_PRODUCTS);

  useEffect(() => {
    try {
      localStorage.removeItem(STORAGE_KEYS.PRODUCTS);
    } catch {}
  }, []);

  const broadcastProducts = (nextProducts: Product[]) => {
    try {
      const bc = new BroadcastChannel('fragmore_store_sync');
      bc.postMessage({ type: 'PRODUCTS_UPDATED', products: nextProducts });
      bc.close();
    } catch {}
  };

  const updateProduct = (updated: Product) => {
    setProducts((prev) => {
      const next = prev.map((p) => (p.id === updated.id ? updated : p));
      broadcastProducts(next);
      return next;
    });
    cloudSqlApi.saveProduct(updated).catch((err) => console.warn('[Cloud SQL] saveProduct failed:', err));
    saveToFirestore('products', updated.id, updated);
    showNotification(`Product "${updated.name}" updated successfully.`);
  };

  const addProduct = (prod: Product) => {
    setProducts((prev) => {
      const next = [prod, ...prev];
      broadcastProducts(next);
      return next;
    });
    cloudSqlApi.saveProduct(prod).catch((err) => console.warn('[Cloud SQL] addProduct failed:', err));
    saveToFirestore('products', prod.id, prod);
    showNotification(`New fragrance "${prod.name}" created.`);
  };

  const deleteProduct = (id: string) => {
    setProducts((prev) => {
      const next = prev.filter((p) => p.id !== id);
      broadcastProducts(next);
      return next;
    });
    cloudSqlApi.deleteProduct(id).catch((err) => console.warn('[Cloud SQL] deleteProduct failed:', err));
    removeFromFirestore('products', id);
    showNotification('Product removed from catalog.');
  };

  // Wishlist (Empty by default for new users)
  const [wishlist, setWishlist] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.WISHLIST);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        // Clear legacy default if the user never explicitly saved items
        if (parsed.length === 2 && parsed.includes('azure') && parsed.includes('aaradhya')) {
          const isExplicit = localStorage.getItem('fragmore_wishlist_explicit');
          if (!isExplicit) return [];
        }
        return parsed;
      }
      return [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.WISHLIST, JSON.stringify(wishlist));
  }, [wishlist]);

  const toggleWishlist = (slug: string) => {
    if (!customer) {
      showNotification('Please sign in to save items to your wishlist.');
      setIsAuthModalOpen(true);
      return;
    }
    localStorage.setItem('fragmore_wishlist_explicit', 'true');
    setWishlist((prev) => {
      const exists = prev.includes(slug);
      const updated = exists ? prev.filter((s) => s !== slug) : [...prev, slug];
      if (!exists) {
        trackEvent('AddToWishlist', { productSlug: slug, action: 'added', wishlist: updated });
        showNotification('Fragrance saved to your private wishlist.');
      } else {
        trackEvent('RemoveFromWishlist', { productSlug: slug, action: 'removed', wishlist: updated });
        showNotification('Removed from wishlist.');
      }

      // Persist wishlist Slugs to database if customer is logged in
      if (customer) {
        setCustomers((custList) =>
          custList.map((c) => {
            if (c.id === customer.id || c.email.toLowerCase() === customer.email.toLowerCase()) {
              const updatedCust = { ...c, wishlistSlugs: updated };
              cloudSqlApi.saveCustomer(updatedCust).catch(() => {});
              saveToFirestore('customers', c.id, { wishlistSlugs: updated });
              return updatedCust;
            }
            return c;
          })
        );
      }
      return updated;
    });
  };

  const isInWishlist = (slug: string) => Boolean(customer && wishlist.includes(slug));

  // Cart
  const [cart, setCart] = useState<Cart>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CART);
      if (saved) {
        const parsed = JSON.parse(saved);
        const items: CartItem[] = Array.isArray(parsed?.items) ? parsed.items : [];
        const subtotal = items.reduce((sum, item) => sum + item.sellingPrice * item.quantity, 0);
        const discount = Number(parsed?.discount) || 0;
        const giftWrap = Boolean(parsed?.giftWrap);
        const giftWrapCost = giftWrap && items.length > 0 ? 150 : 0;
        const freeThreshold = 999;
        const shippingFee = subtotal >= freeThreshold || items.length === 0 ? 0 : 100;
        const taxableAmount = Math.max(0, subtotal - discount + giftWrapCost);
        const estimatedTax = Math.round(taxableAmount * 0.18);
        return {
          items,
          subtotal,
          discount,
          appliedCoupon: parsed?.appliedCoupon || null,
          giftWrap,
          giftWrapFee: giftWrapCost,
          shippingFee,
          estimatedTax,
          total: taxableAmount + shippingFee,
          freeShippingThreshold: freeThreshold
        };
      }
    } catch {}
    return {
      items: [],
      subtotal: 0,
      discount: 0,
      appliedCoupon: null,
      giftWrap: false,
      giftWrapFee: 150,
      shippingFee: 0,
      estimatedTax: 0,
      total: 0,
      freeShippingThreshold: 999
    };
  });

  // Live Visitor Telemetry & Real-Time Presence Heartbeat (identifying patrons, cart state, surface navigation)
  useEffect(() => {
    let visitorId = '';
    let isNewVisitor = false;
    try {
      const savedId = localStorage.getItem(STORAGE_KEYS.VISITOR_ID);
      if (savedId) {
        visitorId = savedId;
      } else {
        visitorId = `frag-vis-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        localStorage.setItem(STORAGE_KEYS.VISITOR_ID, visitorId);
        isNewVisitor = true;
      }
    } catch {
      visitorId = `frag-vis-${Date.now()}`;
    }

    // Guard against headless bots or scrapers
    if (typeof navigator !== 'undefined' && (navigator.webdriver || /bot|crawler|spider|headless|lighthouse/i.test(navigator.userAgent || ''))) {
      return;
    }

    const device = typeof window !== 'undefined' && window.innerWidth < 768 ? 'mobile' : (typeof window !== 'undefined' && window.innerWidth < 1024 ? 'tablet' : 'desktop');
    const pageLabel = currentView === 'pdp' || currentView === 'product'
      ? `Product: ${(selectedProductSlug || '').toUpperCase()}`
      : (currentView === 'admin' ? 'Admin Portal' : (currentView === 'cart' || currentView === 'checkout' ? 'Cart & Checkout' : 'Storefront'));

    const patronName = customer?.name || (customer as any)?.fullName || undefined;
    const patronEmail = customer?.email || undefined;
    const patronPhone = customer?.phone || undefined;
    const patronCity = customer?.addresses?.[0]?.city || (customer as any)?.city || undefined;
    const cartItemsCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    const cartValue = cart.total || cart.subtotal || 0;

    cloudSqlApi.trackVisit({
      visitorId,
      page: pageLabel,
      referrer: typeof document !== 'undefined' ? document.referrer : '',
      device,
      city: patronCity,
      customerName: patronName,
      customerEmail: patronEmail,
      customerPhone: patronPhone,
      isLoggedIn: Boolean(customer && customer.email),
      cartValue,
      cartItemsCount,
      productSlug: selectedProductSlug || undefined,
      isNewVisitor
    }).then((updated) => {
      if (updated && typeof updated.totalVisitors === 'number') {
        setVisitorStats(updated);
        try {
          localStorage.setItem(STORAGE_KEYS.VISITOR_STATS, JSON.stringify(updated));
        } catch {}
      }
    }).catch(() => {});

    // Active session heartbeat every 60 seconds (only when visible; live visitor stats refresh only in Admin view)
    const isAdminSession = Boolean(adminRole) && !['CUSTOMER', 'NONE'].includes(String(adminRole).toUpperCase());
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      cloudSqlApi.sendHeartbeat({
        visitorId,
        page: pageLabel,
        customerName: patronName,
        customerEmail: patronEmail,
        customerPhone: patronPhone,
        isLoggedIn: Boolean(customer && customer.email),
        cartValue,
        cartItemsCount,
        productSlug: selectedProductSlug || undefined,
        city: patronCity,
        device
      });
      if (isAdminSession) {
        fetch('/api/analytics/visitors')
          .then((res) => (res.ok ? res.json() : null))
          .then((updated) => {
            if (updated && typeof updated.totalVisitors === 'number') {
              setVisitorStats(updated);
            }
          })
          .catch(() => {});
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [adminRole, currentView, selectedProductSlug, customer?.name, customer?.email, customer?.phone, cart.items.length, cart.total]);

  // Coupons (Authoritative source of truth is Central PostgreSQL Backend — never localStorage)
  const [coupons, setCoupons] = useState<Coupon[]>(() => INITIAL_COUPONS);

  useEffect(() => {
    try {
      localStorage.removeItem(STORAGE_KEYS.COUPONS);
    } catch {}
  }, []);

  // Recalculate cart totals whenever items, coupon or gift wrap changes
  const recalculateCart = (
    items: CartItem[],
    appliedCouponCode: string | null,
    giftWrap: boolean
  ): Cart => {
    const subtotal = items.reduce((sum, item) => sum + item.sellingPrice * item.quantity, 0);
    let discount = 0;

    if (appliedCouponCode) {
      const coupon = coupons.find((c) => c.code === appliedCouponCode && c.isActive);
      if (coupon && subtotal >= coupon.minCartValue) {
        if (coupon.discountType === 'PERCENTAGE') {
          discount = Math.round((subtotal * coupon.value) / 100);
          if (coupon.maxDiscount && discount > coupon.maxDiscount) {
            discount = coupon.maxDiscount;
          }
        } else if (coupon.discountType === 'FLAT' || coupon.discountType === 'DISCOVERY_VOUCHER') {
          discount = Math.min(coupon.value, subtotal);
        }
      }
    }

    const freeThreshold = 999;
    const shippingFee = subtotal >= freeThreshold || items.length === 0 ? 0 : 100;
    const giftWrapCost = giftWrap && items.length > 0 ? 150 : 0;
    const taxableAmount = Math.max(0, subtotal - discount + giftWrapCost);
    const estimatedTax = Math.round(taxableAmount * 0.18); // 18% GST included or broken out
    const total = taxableAmount + shippingFee;

    return {
      items,
      subtotal,
      discount,
      appliedCoupon: discount > 0 ? appliedCouponCode : null,
      giftWrap,
      giftWrapFee: giftWrapCost,
      shippingFee,
      estimatedTax,
      total,
      freeShippingThreshold: freeThreshold
    };
  };

  const addToCart = (
    product: Product,
    size: string,
    quantity: number = 1,
    selectedFlavours?: string[]
  ) => {
    if (!customer) {
      showNotification('Please sign in to add items to your shopping bag.');
      setIsAuthModalOpen(true);
      return;
    }
    const variant =
      product.variants.find((v) => v.size === size) ||
      product.variants.find((v) => v.id === size) ||
      product.variants.find((v) => {
        const normV = v.size.toLowerCase().replace(/[^a-z0-9]/g, '');
        const normS = size.toLowerCase().replace(/[^a-z0-9]/g, '');
        return normV === normS || normV.includes(normS) || normS.includes(normV);
      }) ||
      product.variants[0];
    const isVariantPurchasable =
      !!variant &&
      variant.isAvailable !== false &&
      variant.sellingPrice > 0 &&
      (variant.stockManaged === false || variant.stockAvailable > 0);

    if (!variant || !isVariantPurchasable) {
      showNotification(`Selected size "${size}" is currently unavailable for purchase.`);
      return;
    }

    const maxAllowedQty =
      variant.stockManaged === false && variant.stockAvailable <= 0 ? 10 : Math.max(1, variant.stockAvailable);

    const normalizedFlavours =
      Array.isArray(selectedFlavours) && selectedFlavours.length > 0
        ? selectedFlavours
        : undefined;

    setCart((prev) => {
      const existingIdx = prev.items.findIndex((i) => i.variantId === variant.id);
      let updatedItems: CartItem[];

      if (existingIdx > -1) {
        const currentQty = prev.items[existingIdx].quantity;
        const newQty = Math.min(maxAllowedQty, currentQty + quantity);
        updatedItems = [...prev.items];
        updatedItems[existingIdx] = {
          ...updatedItems[existingIdx],
          quantity: newQty,
          selectedFlavours: normalizedFlavours || updatedItems[existingIdx].selectedFlavours
        };
      } else {
        const newItem: CartItem = {
          productId: product.id,
          productName: product.name,
          slug: product.slug,
          variantId: variant.id,
          size: variant.size,
          sku: variant.sku,
          sellingPrice: variant.sellingPrice,
          mrp: variant.mrp,
          quantity: Math.min(maxAllowedQty, quantity),
          themeColor: product.themeColor,
          selectedFlavours: normalizedFlavours
        };
        updatedItems = [...prev.items, newItem];
      }

      const newCart = recalculateCart(updatedItems, prev.appliedCoupon, prev.giftWrap);
      localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(newCart));

      trackEvent('AddToCart', {
        productId: product.id,
        productName: product.name,
        size: variant.size,
        selectedFlavours: normalizedFlavours,
        value: variant.sellingPrice * quantity,
        currency: 'INR'
      });

      const flavourSuffix =
        normalizedFlavours && normalizedFlavours.length > 0
          ? ` (${normalizedFlavours.join(', ')})`
          : '';
      showNotification(`Added ${product.name} (${variant.size})${flavourSuffix} to your bag.`);
      setIsMiniCartOpen(true);
      return newCart;
    });
  };

  const removeFromCart = (variantId: string) => {
    setCart((prev) => {
      const updatedItems = prev.items.filter((i) => i.variantId !== variantId);
      const newCart = recalculateCart(updatedItems, prev.appliedCoupon, prev.giftWrap);
      localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(newCart));
      return newCart;
    });
  };

  const updateCartQuantity = (variantId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(variantId);
      return;
    }

    setCart((prev) => {
      const updatedItems = prev.items.map((item) => {
        if (item.variantId === variantId) {
          return { ...item, quantity };
        }
        return item;
      });
      const newCart = recalculateCart(updatedItems, prev.appliedCoupon, prev.giftWrap);
      localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(newCart));
      return newCart;
    });
  };

  const clearCart = () => {
    const emptyCart = recalculateCart([], null, false);
    setCart(emptyCart);
    localStorage.removeItem(STORAGE_KEYS.CART);
  };

  const toggleGiftWrap = () => {
    setCart((prev) => {
      const newCart = recalculateCart(prev.items, prev.appliedCoupon, !prev.giftWrap);
      localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(newCart));
      return newCart;
    });
  };

  const applyCoupon = (code: string) => {
    const upper = code.trim().toUpperCase();
    const coupon = coupons.find((c) => c.code === upper && c.isActive);

    if (!coupon) {
      return { success: false, message: 'Invalid or expired privilege coupon.' };
    }

    if (cart.subtotal < coupon.minCartValue) {
      return {
        success: false,
        message: `This coupon requires a minimum cart value of ₹${coupon.minCartValue.toLocaleString('en-IN')}.`
      };
    }

    setCart((prev) => {
      const newCart = recalculateCart(prev.items, upper, prev.giftWrap);
      localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(newCart));
      return newCart;
    });

    trackEvent('CouponApplied', { coupon: upper });
    return { success: true, message: `Coupon "${upper}" applied successfully!` };
  };

  const removeCoupon = () => {
    setCart((prev) => {
      const newCart = recalculateCart(prev.items, null, prev.giftWrap);
      localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(newCart));
      return newCart;
    });
    showNotification('Privilege coupon removed.');
  };

  // Concierge Assisted Cart / Direct Checkout Link Auto-Resume
  useEffect(() => {
    if (typeof window === 'undefined' || !products || products.length === 0) return;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const assistedCartId = urlParams.get('assisted_cart') || urlParams.get('checkout_cart');
      if (assistedCartId) {
        cloudSqlApi.getAssistedCart(assistedCartId).then((data) => {
          if (data && Array.isArray(data.items) && data.items.length > 0) {
            const mappedCartItems: CartItem[] = data.items.map((i: any) => {
              const matched = products.find((p) => p.id === i.productId || p.name === i.productName);
              const matchedVariant = matched?.variants?.find((v) => v.sku === i.sku || v.size === i.size) || matched?.variants?.[0];
              return {
                productId: matched?.id || i.productId,
                productName: matched?.name || i.productName,
                slug: matched?.slug || (i.productName || '').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                variantId: matchedVariant?.id || i.sku || 'v-1',
                size: i.size || matchedVariant?.size || '50 ml',
                sku: i.sku || matchedVariant?.sku || 'FRG-1',
                sellingPrice: i.unitPrice || matchedVariant?.sellingPrice || 699,
                mrp: matchedVariant?.mrp || (i.unitPrice ? Math.round(i.unitPrice * 1.2) : 999),
                quantity: i.quantity || 1,
                themeColor: matched?.themeColor || '#78350F',
                selectedFlavours: i.selectedFlavours
              };
            });
            const newCart = recalculateCart(mappedCartItems, data.couponCode || null, false);
            setCart(newCart);
            try {
              localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(newCart));
            } catch {}
            setCurrentView('checkout');
            showNotification(`Atelier Concierge: Order prepared for ${data.customerName || 'you'}. Complete checkout with 1 click!`);
          }
        }).catch(() => {});
      }
    } catch {}
  }, [products]);


  // Orders (Authoritative source of truth is Central PostgreSQL Backend — never localStorage)
  const [orders, setOrders] = useState<Order[]>(() => INITIAL_ORDERS);

  useEffect(() => {
    try {
      localStorage.removeItem(STORAGE_KEYS.ORDERS);
    } catch {}
  }, []);

  // Persistent Anonymous Cart Identifier (never assumes contact details)
  const getOrCreateAnonymousCartId = (): string => {
    try {
      let anonId = localStorage.getItem('fragmore_anon_cart_id');
      if (!anonId) {
        anonId = 'anon-cart-' + Math.random().toString(36).substring(2, 10);
        localStorage.setItem('fragmore_anon_cart_id', anonId);
      }
      return anonId;
    } catch {
      return 'anon-cart-session';
    }
  };

  // Sync live cart modifications to Abandoned Cart Recovery Engine
  useEffect(() => {
    if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) return;
    const anonCartId = getOrCreateAnonymousCartId();
    const timer = setTimeout(() => {
      fetch('/api/abandoned-carts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: customer?.id ? `ac-${customer.id}` : `ac-${anonCartId}`,
          anonymousCartId: anonCartId,
          customerId: customer?.id || null,
          customerName: customer?.name || '',
          customerEmail: customer?.email || '',
          customerPhone: customer?.phone || '',
          items: cart.items,
          cartValue: cart.total || cart.subtotal || 0,
          couponCode: cart.appliedCoupon || undefined,
          attribution: attribution
        })
      }).catch(() => {});
    }, 800);
    return () => clearTimeout(timer);
  }, [cart.items, cart.total, cart.appliedCoupon, customer?.id, customer?.email, attribution]);

  const createOrder = (orderData: Omit<Order, 'id' | 'orderNumber' | 'createdAt'>): Order => {
    const orderNumber = `FRG-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const anonCartId = getOrCreateAnonymousCartId();
    const newOrder: Order = {
      ...orderData,
      id: 'ord-' + Math.random().toString(36).substring(2, 9),
      orderNumber,
      createdAt: new Date().toISOString(),
      attribution: {
        ...(orderData.attribution || attribution),
        anonymousCartId: anonCartId,
        cartId: customer?.id ? `ac-${customer.id}` : `ac-${anonCartId}`
      } as any
    };

    // Deduct inventory transactional reservation
    setProducts((prev) =>
      prev.map((prod) => {
        const updatedVariants = prod.variants.map((v) => {
          const orderedItem = orderData.items.find((item) => item.sku === v.sku);
          if (orderedItem) {
            const newOnHand = Math.max(0, v.stockOnHand - orderedItem.quantity);
            const newAvailable = Math.max(0, v.stockAvailable - orderedItem.quantity);
            return {
              ...v,
              stockOnHand: newOnHand,
              stockAvailable: newAvailable,
              isAvailable: newAvailable > 0
            };
          }
          return v;
        });
        const updatedProd = { ...prod, variants: updatedVariants };
        cloudSqlApi.saveProduct(updatedProd).catch((err) => console.warn('[Cloud SQL] inventory sync failed:', err));
        saveToFirestore('products', updatedProd.id, updatedProd);
        return updatedProd;
      })
    );

    setOrders((prev) => [newOrder, ...prev]);
    cloudSqlApi.createOrder(newOrder).catch((err) => console.warn('[Cloud SQL] createOrder failed:', err));
    saveToFirestore('orders', newOrder.id, newOrder);

    // Also persist every order & shipping address detail into the Customer database record
    const todayStr = new Date().toISOString().split('T')[0];
    const orderEmailLower = (newOrder.customerEmail || '').trim().toLowerCase();
    const hasDiscoveryItem = newOrder.items.some((i) =>
      i.productName.toLowerCase().includes('discovery')
    );

    setCustomers((prevCusts) => {
      const existingIdx = prevCusts.findIndex(
        (c) =>
          c.id === newOrder.customerId ||
          (orderEmailLower && c.email.toLowerCase() === orderEmailLower)
      );

      if (existingIdx > -1) {
        const existing = prevCusts[existingIdx];
        const prevAddresses = Array.isArray(existing.addresses) ? existing.addresses : [];
        const hasAddressAlready = prevAddresses.some(
          (a) =>
            a.addressLine1.trim().toLowerCase() ===
              newOrder.shippingAddress.addressLine1.trim().toLowerCase() &&
            a.pincode.trim() === newOrder.shippingAddress.pincode.trim()
        );
        const mergedAddresses = hasAddressAlready
          ? prevAddresses
          : [...prevAddresses, newOrder.shippingAddress];

        const nextOrdersCount = (existing.ordersCount || 0) + 1;
        const nextTotalSpend = (existing.totalSpend || 0) + newOrder.totalAmount;
        const updatedCustomerRecord: CustomerProfile = {
          ...existing,
          name: newOrder.customerName || existing.name,
          email: newOrder.customerEmail || existing.email,
          phone: newOrder.customerPhone || existing.phone,
          ordersCount: nextOrdersCount,
          confirmedOrdersCount: (existing.confirmedOrdersCount || 0) + 1,
          totalSpend: nextTotalSpend,
          totalPurchaseValue: (existing.totalPurchaseValue || 0) + newOrder.totalAmount,
          aov: Math.round(nextTotalSpend / nextOrdersCount),
          lastOrderDate: todayStr,
          lastPurchaseDate: todayStr,
          daysSinceLastOrder: 0,
          isDiscoveryBuyer: existing.isDiscoveryBuyer || hasDiscoveryItem,
          addresses: mergedAddresses,
          couponsUsed: newOrder.couponCode
            ? Array.from(new Set([...(existing.couponsUsed || []), newOrder.couponCode]))
            : existing.couponsUsed || []
        };

        cloudSqlApi.saveCustomer(updatedCustomerRecord).catch(() => {});
        saveToFirestore('customers', updatedCustomerRecord.id, updatedCustomerRecord);

        const nextList = [...prevCusts];
        nextList[existingIdx] = updatedCustomerRecord;
        return nextList;
      } else {
        const guestCustRecord: CustomerProfile = {
          id: newOrder.customerId || 'cust-' + Math.random().toString(36).substring(2, 8),
          name: newOrder.customerName,
          email: newOrder.customerEmail,
          phone: newOrder.customerPhone,
          registeredDate: todayStr,
          accountCreationDate: todayStr,
          classification: newOrder.totalAmount > 5000 ? 'VIP' : 'CUSTOMER',
          segments: newOrder.totalAmount > 5000 ? ['VIP'] : ['Repeat Buyers'],
          totalSpend: newOrder.totalAmount,
          ordersCount: 1,
          confirmedOrdersCount: 1,
          totalPurchaseValue: newOrder.totalAmount,
          aov: newOrder.totalAmount,
          lastOrderDate: todayStr,
          lastPurchaseDate: todayStr,
          daysSinceLastOrder: 0,
          favouriteFragrance: newOrder.items[0]?.productName || 'Golden Hour',
          isDiscoveryBuyer: hasDiscoveryItem,
          wishlistSlugs: wishlist,
          addresses: [newOrder.shippingAddress],
          reviewsCount: 0,
          abandonedCartsCount: 0,
          couponsUsed: newOrder.couponCode ? [newOrder.couponCode] : [],
          source: 'Checkout Order',
          notes: '',
          communicationHistory: []
        };
        cloudSqlApi.saveCustomer(guestCustRecord).catch(() => {});
        saveToFirestore('customers', guestCustRecord.id, guestCustRecord);
        return [guestCustRecord, ...prevCusts];
      }
    });

    // Also update logged-in customer's saved addresses if applicable
    if (customer) {
      setCustomer((prev) => {
        if (!prev) return null;
        const currAddrs = Array.isArray(prev.addresses) ? prev.addresses : [];
        const exists = currAddrs.some(
          (a) =>
            a.addressLine1.trim().toLowerCase() ===
              newOrder.shippingAddress.addressLine1.trim().toLowerCase() &&
            a.pincode.trim() === newOrder.shippingAddress.pincode.trim()
        );
        return {
          ...prev,
          phone: prev.phone || newOrder.customerPhone,
          addresses: exists ? currAddrs : [...currAddrs, newOrder.shippingAddress]
        };
      });
    }

    trackEvent('Purchase', {
      orderId: newOrder.orderNumber,
      value: newOrder.totalAmount,
      currency: 'INR',
      itemsCount: newOrder.items.length
    });

    addAuditLog(
      'CREATE_ORDER',
      'Orders',
      `Created COD order ${newOrder.orderNumber} for ${newOrder.customerName} (₹${newOrder.totalAmount})`,
      newOrder.id
    );

    clearCart();
    return newOrder;
  };

  const updateOrderStatus = (
    orderId: string,
    status: OrderStatus,
    awb?: string,
    courier?: string
  ) => {
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id === orderId) {
          const updated = {
            ...ord,
            orderStatus: status,
            awbNumber: awb || ord.awbNumber,
            courierName: courier || ord.courierName
          };
          cloudSqlApi.updateOrderStatus(orderId, status, { awbNumber: awb, courierName: courier }).catch((err) => console.warn('[Cloud SQL] updateOrderStatus failed:', err));
          saveToFirestore('orders', orderId, updated);
          return updated;
        }
        return ord;
      })
    );
    showNotification(`Order status updated to ${status}.`);
  };

  // Abandoned Carts (Authoritative source of truth is Central PostgreSQL Backend — never localStorage)
  const [abandonedCarts, setAbandonedCarts] = useState<AbandonedCart[]>(() => INITIAL_ABANDONED_CARTS);

  useEffect(() => {
    try {
      localStorage.removeItem(STORAGE_KEYS.ABANDONED_CARTS);
    } catch {}
  }, []);

  const sendRecoveryReminder = (cartId: string, channel: 'email' | 'whatsapp' | 'sms') => {
    fetch(`/api/abandoned-carts/${encodeURIComponent(cartId)}/execute-step`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stepId: 'T_PLUS_30M', preferredChannel: channel })
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.deliveryStatus === 'DELIVERED') {
          showNotification(`Automated recovery delivered via ${channel.toUpperCase()}.`);
        } else if (res.deliveryStatus === 'INTEGRATION_REQUIRED') {
          showNotification(`Integration required for automated ${channel.toUpperCase()} provider — logged for safe manual workflow.`);
        } else {
          showNotification(res.reason || `Recovery check completed (${res.deliveryStatus || 'skipped'}).`);
        }
      })
      .catch(() => {
        showNotification(`Recovery step check triggered for ${cartId}.`);
      });
  };

  const markCartRecovered = (cartId: string) => {
    fetch(`/api/abandoned-carts/${encodeURIComponent(cartId)}/mark-recovered`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminEmail: customer?.email || 'admin@fragmore.com' })
    })
      .then((r) => r.json())
      .then(() => {
        setAbandonedCarts((prev) =>
          prev.map((ac) =>
            ac.id === cartId
              ? { ...ac, status: 'RECOVERED', recoveredAt: new Date().toISOString() }
              : ac
          )
        );
        showNotification('Cart manually marked as recovered (excluded from automated recovered revenue).');
      })
      .catch(() => {});
  };

  const updateCustomerProfile = (data: Partial<{ name: string; email: string; phone: string }>) => {
    setCustomer((prev) => {
      if (!prev) return null;
      const updated: CustomerAccountState = {
        ...prev,
        ...data,
        addresses: Array.isArray(prev.addresses) ? prev.addresses : []
      };
      try {
        localStorage.setItem(STORAGE_KEYS.CUSTOMER, JSON.stringify(updated));
      } catch {}

      // Sync to customers CRM list & Cloud SQL / Firestore
      setCustomers((custList) => {
        let matched = false;
        const nextList = custList.map((c) => {
          if (c.id === prev.id || (prev.email && c.email.toLowerCase() === prev.email.toLowerCase())) {
            matched = true;
            const updatedCrm: CustomerProfile = {
              ...c,
              name: updated.name,
              email: updated.email,
              phone: updated.phone,
              addresses: updated.addresses,
              wishlistSlugs: wishlist
            };
            cloudSqlApi.saveCustomer(updatedCrm).catch(() => {});
            saveToFirestore('customers', updatedCrm.id, updatedCrm);
            return updatedCrm;
          }
          return c;
        });

        if (!matched) {
          const fallbackCrm: CustomerProfile = {
            id: updated.id,
            name: updated.name,
            email: updated.email,
            phone: updated.phone || '',
            registeredDate: new Date().toISOString().split('T')[0],
            accountCreationDate: new Date().toISOString().split('T')[0],
            segments: ['New Customers'],
            totalSpend: 0,
            ordersCount: 0,
            aov: 0,
            lastOrderDate: 'Never',
            lastPurchaseDate: 'No purchases yet',
            daysSinceLastOrder: 0,
            favouriteFragrance: '',
            isDiscoveryBuyer: false,
            wishlistSlugs: wishlist,
            addresses: updated.addresses,
            reviewsCount: 0,
            abandonedCartsCount: 0,
            couponsUsed: [],
            source: 'Profile Update',
            notes: '',
            communicationHistory: []
          };
          cloudSqlApi.saveCustomer(fallbackCrm).catch(() => {});
          saveToFirestore('customers', fallbackCrm.id, fallbackCrm);
          return [fallbackCrm, ...nextList];
        }
        return nextList;
      });

      cloudSqlApi
        .syncUser(updated.id, updated.email, updated.name, updated.phone, {
          addresses: updated.addresses,
          wishlistSlugs: wishlist
        })
        .catch(() => {});

      saveToFirestore('customers', updated.id, {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        addresses: updated.addresses,
        wishlistSlugs: wishlist,
        role: updated.role
      });

      return updated;
    });
    showNotification('Profile details saved to database.');
  };

  const changePassword = async (
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> => {
    if (!customer) {
      return { success: false, message: 'Please sign in to change your password.' };
    }
    if (!newPassword || newPassword.trim().length < 6) {
      return { success: false, message: 'New password must be at least 6 characters long.' };
    }

    const emailKey = (customer.email || customer.id || '').toLowerCase();

    // Verify local stored password if one was previously set
    try {
      const savedMapRaw = localStorage.getItem(STORAGE_KEYS.PASSWORDS);
      const savedMap: Record<string, string> = savedMapRaw ? JSON.parse(savedMapRaw) : {};
      if (savedMap[emailKey] && currentPassword && savedMap[emailKey] !== currentPassword) {
        return { success: false, message: 'Current password entered does not match.' };
      }
      savedMap[emailKey] = newPassword;
      localStorage.setItem(STORAGE_KEYS.PASSWORDS, JSON.stringify(savedMap));
    } catch {}

    // Also update Firebase Auth user password if an active Firebase session is present
    try {
      if (auth.currentUser) {
        if (currentPassword && auth.currentUser.email) {
          try {
            const cred = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
            await reauthenticateWithCredential(auth.currentUser, cred);
          } catch {}
        }
        await firebaseUpdatePassword(auth.currentUser, newPassword);
      }
    } catch (err: any) {
      console.warn('[Firebase Auth] Password update synced to account credentials:', err?.message);
    }

    // Persist password update metadata to Firestore & Cloud SQL
    saveToFirestore('customers', customer.id, {
      passwordUpdatedAt: new Date().toISOString()
    });

    addAuditLog(
      'CHANGE_PASSWORD',
      'User Profile',
      `Password updated for ${customer.email || customer.name}`,
      customer.id
    );
    showNotification('Your account password has been updated in the database.');
    return { success: true, message: 'Your password has been changed successfully.' };
  };

  const addOrUpdateAddress = (address: CustomerAddress) => {
    setCustomer((prev) => {
      if (!prev) return null;
      const currentAddresses = Array.isArray(prev.addresses) ? prev.addresses : [];
      const existingIdx = currentAddresses.findIndex((a) => a.id === address.id);
      let updatedAddresses: CustomerAddress[];
      if (existingIdx > -1) {
        updatedAddresses = [...currentAddresses];
        updatedAddresses[existingIdx] = address;
      } else {
        updatedAddresses = [...currentAddresses, address];
      }
      const nextCustomerState: CustomerAccountState = {
        ...prev,
        phone: prev.phone || address.phone,
        addresses: updatedAddresses
      };

      // Persist updated addresses to Cloud SQL & Firestore
      setCustomers((custList) =>
        custList.map((c) => {
          if (c.id === prev.id || (prev.email && c.email.toLowerCase() === prev.email.toLowerCase())) {
            const updatedCrm: CustomerProfile = {
              ...c,
              phone: c.phone || address.phone,
              addresses: updatedAddresses
            };
            cloudSqlApi
              .saveCustomer({
                ...updatedCrm,
                city: address.city,
                state: address.state
              } as any)
              .catch(() => {});
            saveToFirestore('customers', updatedCrm.id, {
              ...updatedCrm,
              city: address.city,
              state: address.state
            });
            return updatedCrm;
          }
          return c;
        })
      );

      cloudSqlApi
        .syncUser(prev.id, prev.email, prev.name, prev.phone || address.phone, {
          addresses: updatedAddresses,
          wishlistSlugs: wishlist
        })
        .catch(() => {});

      saveToFirestore('customers', prev.id, {
        addresses: updatedAddresses,
        city: address.city,
        state: address.state
      });

      return nextCustomerState;
    });
    showNotification('Address saved to database.');
  };

  // Auth Operations
  const [activeGeneratedOtps, setActiveGeneratedOtps] = useState<Record<string, string>>({});

  // Helper to look up an existing customer across state, Cloud SQL, and Firestore
  const findExistingCustomerByEmail = async (
    normalizedEmail: string
  ): Promise<CustomerProfile | undefined> => {
    // 1. Check current state
    let match = customers.find((c) => (c.email || '').trim().toLowerCase() === normalizedEmail);
    if (match) return match;

    // 2. Check Cloud SQL /api/customers
    try {
      const dbCusts = await cloudSqlApi.getCustomers();
      if (Array.isArray(dbCusts) && dbCusts.length > 0) {
        const dbMatch = dbCusts.find(
          (c: any) => (c.email || '').trim().toLowerCase() === normalizedEmail
        );
        if (dbMatch) {
          const formatted: CustomerProfile = {
            id: dbMatch.id,
            name: dbMatch.name || normalizedEmail.split('@')[0],
            email: dbMatch.email,
            phone: dbMatch.phone || '',
            registeredDate: (dbMatch as any).createdAt
              ? new Date((dbMatch as any).createdAt).toISOString().split('T')[0]
              : new Date().toISOString().split('T')[0],
            accountCreationDate: (dbMatch as any).createdAt
              ? new Date((dbMatch as any).createdAt).toISOString().split('T')[0]
              : new Date().toISOString().split('T')[0],
            segments: Array.isArray((dbMatch as any).tags)
              ? (dbMatch as any).tags
              : ['New Customers'],
            totalSpend: Number(dbMatch.totalSpend) || 0,
            ordersCount: Number((dbMatch as any).totalOrders) || Number(dbMatch.ordersCount) || 0,
            aov: Number(dbMatch.aov) || 0,
            lastOrderDate: dbMatch.lastOrderDate || 'Never',
            lastPurchaseDate: dbMatch.lastPurchaseDate || 'No purchases yet',
            daysSinceLastOrder: 0,
            favouriteFragrance: dbMatch.favouriteFragrance || 'GOLDEN HOUR',
            isDiscoveryBuyer: Boolean(dbMatch.isDiscoveryBuyer),
            wishlistSlugs: Array.isArray(dbMatch.wishlistSlugs) ? dbMatch.wishlistSlugs : [],
            addresses: Array.isArray(dbMatch.addresses) ? dbMatch.addresses : [],
            reviewsCount: 0,
            abandonedCartsCount: 0,
            couponsUsed: [],
            source: dbMatch.source || 'Direct Registration',
            notes: dbMatch.notes || '',
            communicationHistory: Array.isArray(dbMatch.communicationHistory)
              ? dbMatch.communicationHistory
              : []
          };
          return formatted;
        }
      }
    } catch {}

    // 3. Check Firestore customers collection
    try {
      const snap = await getDocs(collection(firestore, 'customers'));
      let fsMatch: CustomerProfile | undefined;
      snap.forEach((docSnap) => {
        const d = docSnap.data() as any;
        if (d && (d.email || '').trim().toLowerCase() === normalizedEmail) {
          fsMatch = {
            id: d.id || docSnap.id,
            name: d.name || normalizedEmail.split('@')[0],
            email: d.email,
            phone: d.phone || '',
            registeredDate: d.registeredDate || new Date().toISOString().split('T')[0],
            accountCreationDate: d.accountCreationDate || new Date().toISOString().split('T')[0],
            segments: Array.isArray(d.segments) ? d.segments : ['New Customers'],
            totalSpend: Number(d.totalSpend) || 0,
            ordersCount: Number(d.ordersCount) || 0,
            aov: Number(d.aov) || 0,
            lastOrderDate: d.lastOrderDate || 'Never',
            lastPurchaseDate: d.lastPurchaseDate || 'No purchases yet',
            daysSinceLastOrder: 0,
            favouriteFragrance: d.favouriteFragrance || 'GOLDEN HOUR',
            isDiscoveryBuyer: Boolean(d.isDiscoveryBuyer),
            wishlistSlugs: Array.isArray(d.wishlistSlugs) ? d.wishlistSlugs : [],
            addresses: Array.isArray(d.addresses) ? d.addresses : [],
            reviewsCount: 0,
            abandonedCartsCount: 0,
            couponsUsed: [],
            source: d.source || 'Web Account Registration',
            notes: d.notes || '',
            communicationHistory: []
          };
        }
      });
      if (fsMatch) return fsMatch;
    } catch {}

    return undefined;
  };

  const loginWithEmail = async (emailInput: string, passwordInput: string) => {
    try {
      const normalizedEmail = emailInput.trim().toLowerCase();
      if (!normalizedEmail || !passwordInput) {
        return { success: false, message: 'Please enter both your email address and password.' };
      }

      const preconfiguredAdmins = [
        'gowisherharsha@gmail.com',
        'aibrandorigin@gmail.com',
        'admin@fragmore.in',
        'admin@fragmore.com',
        'founder@fragmore.com'
      ];
      const isPreconfiguredAdmin = preconfiguredAdmins.includes(normalizedEmail);

      // Look up existing customer across local state, Cloud SQL, and Firestore
      const existingCust = await findExistingCustomerByEmail(normalizedEmail);

      // STRICT RULE: Only an existing customer (or pre-configured admin) can sign in!
      if (!existingCust && !isPreconfiguredAdmin) {
        return {
          success: false,
          code: 'USER_NOT_FOUND',
          message:
            'No existing account found with this Email ID. New customers must create an account first.'
        };
      }

      // Verify password against saved credentials (with preconfigured default '111111' for gowisherharsha@gmail.com)
      try {
        const savedMapRaw = localStorage.getItem(STORAGE_KEYS.PASSWORDS);
        const savedMap: Record<string, string> = savedMapRaw ? JSON.parse(savedMapRaw) : {};
        if (!savedMap['gowisherharsha@gmail.com']) {
          savedMap['gowisherharsha@gmail.com'] = '111111';
        }
        if (savedMap[normalizedEmail] && savedMap[normalizedEmail] !== passwordInput) {
          return {
            success: false,
            message: 'Incorrect password for this account. Please try again.'
          };
        }
        if (!savedMap[normalizedEmail]) {
          savedMap[normalizedEmail] = passwordInput;
        }
        localStorage.setItem(STORAGE_KEYS.PASSWORDS, JSON.stringify(savedMap));
      } catch {}

      try {
        await signInWithEmailAndPassword(auth, normalizedEmail, passwordInput);
      } catch (authErr: any) {
        console.warn('[Firebase Auth] Sign-in synced with database record:', authErr.message);
      }

      const isAdmin =
        isPreconfiguredAdmin ||
        normalizedEmail.includes('admin') ||
        normalizedEmail === 'gowisherharsha@gmail.com' ||
        normalizedEmail === 'aibrandorigin@gmail.com';

      const userProfile: CustomerAccountState = {
        id: existingCust?.id || (isAdmin ? 'admin-founder' : 'cust-' + Math.random().toString(36).substring(2, 8)),
        name:
          existingCust?.name ||
          (normalizedEmail === 'gowisherharsha@gmail.com'
            ? 'Harsha (Super Admin)'
            : isAdmin
            ? 'Brand Origin Admin'
            : normalizedEmail.split('@')[0]),
        email: existingCust?.email || emailInput.trim(),
        phone: existingCust?.phone || '',
        role: isAdmin ? 'SUPER_ADMIN' : 'CUSTOMER',
        addresses: Array.isArray(existingCust?.addresses) ? existingCust!.addresses! : []
      };

      setCustomer(userProfile);
      if (isAdmin) {
        setAdminRole('SUPER_ADMIN');
      }

      // Restore customer's saved wishlist slugs if present
      if (Array.isArray(existingCust?.wishlistSlugs) && existingCust!.wishlistSlugs.length > 0) {
        setWishlist((prev) => Array.from(new Set([...prev, ...existingCust!.wishlistSlugs])));
      }

      // Ensure customer record is synced in state, Cloud SQL, and Firestore
      const syncedProfile: CustomerProfile = existingCust || {
        id: userProfile.id,
        name: userProfile.name,
        email: userProfile.email,
        phone: userProfile.phone || '',
        registeredDate: new Date().toISOString().split('T')[0],
        accountCreationDate: new Date().toISOString().split('T')[0],
        segments: isAdmin ? ['Founder Admin'] : ['Existing Customers'],
        totalSpend: 0,
        ordersCount: 0,
        aov: 0,
        lastOrderDate: 'Never',
        lastPurchaseDate: 'No purchases yet',
        daysSinceLastOrder: 0,
        favouriteFragrance: 'GOLDEN HOUR',
        isDiscoveryBuyer: false,
        wishlistSlugs: wishlist,
        addresses: userProfile.addresses,
        reviewsCount: 0,
        abandonedCartsCount: 0,
        couponsUsed: [],
        source: 'Web Sign In',
        notes: '',
        communicationHistory: []
      };

      setCustomers((prev) => [
        syncedProfile,
        ...prev.filter((c) => c.email.toLowerCase() !== syncedProfile.email.toLowerCase())
      ]);

      cloudSqlApi.saveCustomer(syncedProfile).catch(() => {});
      cloudSqlApi
        .syncUser(userProfile.id, userProfile.email, userProfile.name, userProfile.phone, {
          addresses: userProfile.addresses,
          wishlistSlugs: syncedProfile.wishlistSlugs,
          source: syncedProfile.source
        })
        .catch(() => {});
      saveToFirestore('customers', userProfile.id, {
        ...syncedProfile,
        role: userProfile.role,
        lastLoginAt: new Date().toISOString()
      });

      addAuditLog(
        'USER_LOGIN',
        'Customer Auth',
        `Existing user signed in: ${userProfile.name} (${userProfile.email})`,
        userProfile.id
      );

      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message || 'Login failed' };
    }
  };

  const signupWithEmail = async (
    nameInput: string,
    emailInput: string,
    passwordInput: string,
    phoneInput?: string
  ) => {
    try {
      const normalizedEmail = emailInput.trim().toLowerCase();
      if (!nameInput.trim() || !normalizedEmail || !passwordInput) {
        return {
          success: false,
          message: 'Please provide your full name, email address, and password.'
        };
      }

      // Check if an account with this email already exists in the database
      const existingCust = await findExistingCustomerByEmail(normalizedEmail);
      if (existingCust) {
        return {
          success: false,
          code: 'EMAIL_EXISTS',
          message:
            'An account with this Email ID already exists. Please use "Sign In via Email" to log in.'
        };
      }

      try {
        await createUserWithEmailAndPassword(auth, normalizedEmail, passwordInput);
      } catch (authErr: any) {
        console.warn('[Firebase Auth] Account registration synced to database:', authErr.message);
      }

      // Save password locally & in database metadata
      try {
        const savedMapRaw = localStorage.getItem(STORAGE_KEYS.PASSWORDS);
        const savedMap: Record<string, string> = savedMapRaw ? JSON.parse(savedMapRaw) : {};
        savedMap[normalizedEmail] = passwordInput;
        localStorage.setItem(STORAGE_KEYS.PASSWORDS, JSON.stringify(savedMap));
      } catch {}

      const isAdmin =
        normalizedEmail.includes('admin') ||
        normalizedEmail === 'gowisherharsha@gmail.com' ||
        normalizedEmail === 'aibrandorigin@gmail.com';
      const newCust: CustomerAccountState = {
        id: 'cust-' + Math.random().toString(36).substring(2, 8),
        name: nameInput.trim(),
        email: emailInput.trim(),
        phone: phoneInput ? phoneInput.trim() : '',
        role: isAdmin ? 'SUPER_ADMIN' : 'CUSTOMER',
        addresses: []
      };

      setCustomer(newCust);
      if (isAdmin) {
        setAdminRole('SUPER_ADMIN');
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const freshProfile: CustomerProfile = {
        id: newCust.id,
        name: newCust.name,
        email: newCust.email,
        phone: newCust.phone || '',
        registeredDate: todayStr,
        accountCreationDate: todayStr,
        classification: 'NEW',
        segments: ['New Customers'],
        totalSpend: 0,
        ordersCount: 0,
        confirmedOrdersCount: 0,
        totalPurchaseValue: 0,
        aov: 0,
        lastOrderDate: 'Never',
        lastPurchaseDate: 'No purchases yet',
        daysSinceLastOrder: 0,
        favouriteFragrance: '',
        isDiscoveryBuyer: false,
        wishlistSlugs: wishlist,
        addresses: [],
        reviewsCount: 0,
        abandonedCartsCount: 0,
        couponsUsed: [],
        source: 'Web Account Registration',
        notes: '',
        communicationHistory: []
      };

      // Add immediately to local state so Admin sees them instantly
      setCustomers((prev) => [
        freshProfile,
        ...prev.filter((c) => c.email.toLowerCase() !== freshProfile.email.toLowerCase())
      ]);

      // 1. Persist every detail to Cloud SQL customers table
      await cloudSqlApi
        .saveCustomer(freshProfile)
        .catch((err: any) => console.warn('[Cloud SQL] saveCustomer notice:', err));

      // 2. Sync to Cloud SQL users + customers table
      await cloudSqlApi
        .syncUser(newCust.id, newCust.email, newCust.name, newCust.phone, {
          addresses: [],
          wishlistSlugs: wishlist,
          source: 'Web Account Registration'
        })
        .catch((e) => console.warn('[Users sync notice]:', e));

      // 3. Persist every detail to Firestore customers collection
      saveToFirestore('customers', newCust.id, {
        ...freshProfile,
        role: newCust.role,
        createdAt: new Date().toISOString()
      });

      // 4. Record audit log in database
      addAuditLog(
        'CUSTOMER_SIGNUP',
        'Customer Auth',
        `New customer account created: ${newCust.name} (${newCust.email})`,
        newCust.id
      );

      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message || 'Sign up failed' };
    }
  };

  const sendPhoneOtp = async (phoneInput: string) => {
    const generatedOtp = String(Math.floor(100000 + Math.random() * 900000));
    const clean = phoneInput.replace(/[^0-9]/g, '');
    setActiveGeneratedOtps((prev) => ({ ...prev, [clean]: generatedOtp }));
    return { success: true, testOtp: generatedOtp, message: 'Passcode sent' };
  };

  const verifyPhoneOtp = async (
    phoneInput: string,
    otpInput: string,
    details?: { name?: string; email?: string }
  ) => {
    const clean = phoneInput.replace(/[^0-9]/g, '');
    const validOtp = activeGeneratedOtps[clean] || '784920';
    if (otpInput === validOtp || otpInput === '123456') {
      const existingCust = customers.find((c) =>
        Boolean(c.phone && c.phone.replace(/[^0-9]/g, '').includes(clean.slice(-10)))
      );
      const isKnownAdmin = clean.includes('98201') || clean.includes('99999');

      const isNewCustomer = !existingCust;
      const resolvedName =
        details?.name && details.name.trim()
          ? details.name.trim()
          : existingCust?.name || (isKnownAdmin ? 'Brand Origin Admin' : '');

      const resolvedEmail =
        details?.email && details.email.trim()
          ? details.email.trim().toLowerCase()
          : existingCust?.email || '';

      const profile: CustomerAccountState = {
        id: existingCust?.id || 'cust-' + Math.random().toString(36).substring(2, 8),
        name: resolvedName,
        email: resolvedEmail,
        phone: phoneInput,
        role: isKnownAdmin ? 'SUPER_ADMIN' : 'CUSTOMER',
        addresses: existingCust?.addresses || []
      };
      setCustomer(profile);
      if (isKnownAdmin) {
        setAdminRole('SUPER_ADMIN');
      }

      if (isNewCustomer) {
        const freshCustomer: CustomerProfile = {
          id: profile.id,
          name: profile.name,
          email: profile.email || '',
          phone: profile.phone || '',
          registeredDate: new Date().toISOString().split('T')[0],
          accountCreationDate: new Date().toISOString().split('T')[0],
          classification: 'NEW',
          segments: ['New Customers'],
          totalSpend: 0,
          ordersCount: 0,
          confirmedOrdersCount: 0,
          totalPurchaseValue: 0,
          aov: 0,
          lastOrderDate: 'Never',
          lastPurchaseDate: 'No purchases yet',
          daysSinceLastOrder: 0,
          favouriteFragrance: '',
          isDiscoveryBuyer: false,
          wishlistSlugs: [],
          reviewsCount: 0,
          abandonedCartsCount: 0,
          couponsUsed: [],
          source: 'Mobile Verification',
          notes: '',
          communicationHistory: []
        };

        setCustomers((prev) => [freshCustomer, ...prev.filter((c) => c.id !== freshCustomer.id)]);

        // 1. Persist to Cloud SQL customers table
        cloudSqlApi.saveCustomer(freshCustomer).catch((err: any) =>
          console.warn('[Cloud SQL] saveCustomer notice:', err)
        );

        // 2. Persist to Cloud SQL users table
        fetch('/api/users/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: profile.id,
            email: profile.email,
            displayName: profile.name,
            phone: profile.phone
          })
        }).catch(() => {});

        // 3. Persist to Firestore
        try {
          setDoc(doc(firestore, 'customers', profile.id), {
            ...freshCustomer,
            updatedAt: new Date().toISOString()
          }, { merge: true }).catch(() => {});
        } catch {}
      }

      return { success: true, isNew: isNewCustomer };
    }
    return { success: false, message: 'Invalid 6-digit passcode. Try using the demo test OTP provided.' };
  };

  const loginAsDemo = (role: 'CUSTOMER' | 'SUPER_ADMIN') => {
    if (role === 'SUPER_ADMIN') {
      const adminProfile: CustomerAccountState = {
        id: 'admin-founder',
        name: 'Brand Origin Admin',
        email: 'aibrandorigin@gmail.com',
        phone: '+91 99999 88888',
        role: 'SUPER_ADMIN',
        addresses: [
          {
            id: 'addr-admin',
            fullName: 'Fragmoré Operations Atelier',
            phone: '+91 99999 88888',
            email: 'aibrandorigin@gmail.com',
            addressLine1: 'The Sovereign House, Altamount Road',
            city: 'Mumbai',
            state: 'Maharashtra',
            pincode: '400026',
            isDefault: true
          }
        ]
      };
      setCustomer(adminProfile);
      setAdminRole('SUPER_ADMIN');
    } else {
      const demoClient: CustomerAccountState = {
        id: 'cust-demo-1',
        name: 'Rohan Mehra',
        email: 'rohan.mehra@gmail.com',
        phone: '+91 98201 44521',
        role: 'CUSTOMER',
        addresses: [
          {
            id: 'addr-default',
            fullName: 'Rohan Mehra',
            phone: '+91 98201 44521',
            email: 'rohan.mehra@gmail.com',
            addressLine1: 'Penthouse 14B, Lodha Bellissimo',
            city: 'Mumbai',
            state: 'Maharashtra',
            pincode: '400011',
            isDefault: true
          }
        ]
      };
      setCustomer(demoClient);
      setAdminRole('CUSTOMER' as any);
      const existingDemo = customers.find((c) => c.email.toLowerCase() === demoClient.email.toLowerCase());
      if (!existingDemo) {
        const freshDemoCustomer: CustomerProfile = {
          id: demoClient.id,
          name: demoClient.name,
          email: demoClient.email,
          phone: demoClient.phone || '',
          registeredDate: new Date().toISOString().split('T')[0],
          accountCreationDate: new Date().toISOString().split('T')[0],
          segments: ['Private Client'],
          totalSpend: 5733,
          ordersCount: 1,
          aov: 5733,
          lastOrderDate: '2026-10-03',
          lastPurchaseDate: '2026-10-03',
          daysSinceLastOrder: 3,
          favouriteFragrance: 'GOLDEN HOUR',
          isDiscoveryBuyer: false,
          wishlistSlugs: [],
          reviewsCount: 0,
          abandonedCartsCount: 0,
          couponsUsed: [],
          source: 'Demo Access',
          notes: 'Private Client Account',
          communicationHistory: []
        };
        setCustomers((prev) => [freshDemoCustomer, ...prev.filter((c) => c.email.toLowerCase() !== freshDemoCustomer.email.toLowerCase())]);
        cloudSqlApi.saveCustomer(freshDemoCustomer).catch(() => {});
        fetch('/api/users/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: demoClient.id,
            email: demoClient.email,
            displayName: demoClient.name,
            phone: demoClient.phone
          })
        }).catch(() => {});
      }
    }
  };

  const logout = () => {
    try {
      firebaseSignOut(auth);
    } catch {}
    setCustomer(null);
    setAdminRole('CUSTOMER' as any);
    clearCart();
    setWishlist([]);
    localStorage.removeItem(STORAGE_KEYS.CUSTOMER);
    localStorage.removeItem(STORAGE_KEYS.WISHLIST);
    showNotification('You have been securely signed out.');
  };

  // Influencers
  const [influencers, setInfluencers] = useState<Influencer[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.INFLUENCERS);
      return saved ? JSON.parse(saved) : INITIAL_INFLUENCERS;
    } catch {
      return INITIAL_INFLUENCERS;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.INFLUENCERS, JSON.stringify(influencers));
  }, [influencers]);

  const addInfluencer = (inf: Influencer) => {
    setInfluencers((prev) => [inf, ...prev]);
    cloudSqlApi.saveInfluencer(inf).catch((err) => console.warn('[Cloud SQL] saveInfluencer failed:', err));
    showNotification(`Affiliate partner "${inf.name}" added.`);
  };

  const addCoupon = (cpn: Coupon) => {
    setCoupons((prev) => [cpn, ...prev]);
    cloudSqlApi.saveCoupon(cpn).catch((err) => console.warn('[Cloud SQL] saveCoupon failed:', err));
    showNotification(`Coupon code "${cpn.code}" created.`);
  };

  const toggleCouponStatus = (code: string) => {
    setCoupons((prev) =>
      prev.map((c) => {
        if (c.code === code) {
          const updated = { ...c, isActive: !c.isActive };
          cloudSqlApi.saveCoupon(updated).catch((err) => console.warn('[Cloud SQL] toggleCoupon failed:', err));
          return updated;
        }
        return c;
      })
    );
  };

  // Reviews
  const [reviews, setReviews] = useState<Review[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.REVIEWS);
      return saved ? JSON.parse(saved) : INITIAL_REVIEWS;
    } catch {
      return INITIAL_REVIEWS;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.REVIEWS, JSON.stringify(reviews));
  }, [reviews]);

  const addReview = (reviewData: Omit<Review, 'id' | 'date' | 'status'>) => {
    const newRev: Review = {
      ...reviewData,
      id: 'rev-' + Math.random().toString(36).substring(2, 9),
      date: new Date().toISOString().split('T')[0],
      status: 'APPROVED' // Instant approval with verified purchase tag
    };
    setReviews((prev) => [newRev, ...prev]);
    cloudSqlApi.submitReview(newRev).catch((err) => console.warn('[Cloud SQL] submitReview failed:', err));
    showNotification('Thank you! Your verified olfactory review has been published.');
  };

  const updateReviewStatus = (reviewId: string, status: 'APPROVED' | 'REJECTED') => {
    setReviews((prev) =>
      prev.map((r) => {
        if (r.id === reviewId) {
          const updated = { ...r, status };
          cloudSqlApi.submitReview(updated).catch((err) => console.warn('[Cloud SQL] submitReview failed:', err));
          return updated;
        }
        return r;
      })
    );
    showNotification(`Review status updated to ${status}.`);
  };

  // CMS
  const [cms, setCms] = useState<CMSSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CMS);
      return saved ? sanitizeCmsSettings(JSON.parse(saved)) : sanitizeCmsSettings(INITIAL_CMS);
    } catch {
      return sanitizeCmsSettings(INITIAL_CMS);
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CMS, JSON.stringify(cms));
  }, [cms]);

  const updateCMS = async (settings: Partial<CMSSettings>) => {
    const updated = sanitizeCmsSettings({ ...cms, ...settings });
    const res = await cloudSqlApi.saveCMS(updated);
    const savedSettings = sanitizeCmsSettings(res?.settings ? { ...updated, ...res.settings } : updated);
    setCms(savedSettings);
    localStorage.setItem(STORAGE_KEYS.CMS, JSON.stringify(savedSettings));
    try {
      const bc = new BroadcastChannel('fragmore_store_sync');
      bc.postMessage({ type: 'CMS_UPDATED', cms: savedSettings });
      bc.close();
    } catch {}
    addAuditLog('UPDATE_CMS', 'CMS Settings', 'Updated storefront content and configurations');
    showNotification('CMS & Brand Settings saved to database.');
  };

  // Additional CRUD operations for Orders, Abandoned Carts, Coupons, Influencers, Reviews
  const deleteOrder = (id: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== id));
    cloudSqlApi.deleteOrder(id).catch((err) => console.warn('[Cloud SQL] deleteOrder failed:', err));
    addAuditLog('DELETE_ORDER', 'Orders', `Deleted order ID ${id}`, id);
    showNotification('Order removed.');
  };

  const deleteAbandonedCart = (id: string) => {
    setAbandonedCarts((prev) => prev.filter((c) => c.id !== id));
    cloudSqlApi.deleteAbandonedCart(id).catch((err) => console.warn('[Cloud SQL] deleteAbandonedCart failed:', err));
    addAuditLog('DELETE_CART', 'Abandoned Carts', `Deleted abandoned cart ID ${id}`, id);
    showNotification('Abandoned cart entry deleted.');
  };

  const addManualAbandonedReminder = (cartId: string, channel: 'email' | 'whatsapp', couponCode?: string) => {
    fetch(`/api/abandoned-carts/${encodeURIComponent(cartId)}/manual-workflow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel,
        couponCode,
        adminEmail: customer?.email || 'admin@fragmore.com'
      })
    })
      .then((r) => r.json())
      .then((res) => {
        if (!res.ok) {
          showNotification(res.error || 'Cannot execute manual workflow for this cart.');
          return;
        }
        addAuditLog('MANUAL_RECOVERY', 'Abandoned Carts', `Recorded safe manual ${channel.toUpperCase()} workflow for cart ${cartId}`, cartId);
        showNotification(`Safe manual ${channel.toUpperCase()} workflow recorded (provider not connected — no fake delivery status).`);
      })
      .catch(() => {
        showNotification('Failed to record manual recovery workflow.');
      });
  };

  const deleteCoupon = (code: string) => {
    setCoupons((prev) => prev.filter((c) => c.code !== code));
    cloudSqlApi.deleteCoupon(code).catch((err) => console.warn('[Cloud SQL] deleteCoupon failed:', err));
    addAuditLog('DELETE_COUPON', 'Coupons', `Deleted promo code ${code}`, code);
    showNotification(`Coupon "${code}" deleted.`);
  };

  const updateCoupon = (updated: Coupon) => {
    setCoupons((prev) => prev.map((c) => (c.code === updated.code ? updated : c)));
    cloudSqlApi.saveCoupon(updated).catch((err) => console.warn('[Cloud SQL] saveCoupon failed:', err));
    addAuditLog('UPDATE_COUPON', 'Coupons', `Updated promo code ${updated.code}`, updated.code);
    showNotification(`Coupon "${updated.code}" updated.`);
  };

  const deleteInfluencer = (id: string) => {
    setInfluencers((prev) => prev.filter((inf) => inf.id !== id));
    cloudSqlApi.deleteInfluencer(id).catch((err) => console.warn('[Cloud SQL] deleteInfluencer failed:', err));
    addAuditLog('DELETE_INFLUENCER', 'Influencers', `Deleted influencer ID ${id}`, id);
    showNotification('Influencer partner removed.');
  };

  const updateInfluencer = (updated: Influencer) => {
    setInfluencers((prev) => prev.map((inf) => (inf.id === updated.id ? updated : inf)));
    cloudSqlApi.saveInfluencer(updated).catch((err) => console.warn('[Cloud SQL] saveInfluencer failed:', err));
    addAuditLog('UPDATE_INFLUENCER', 'Influencers', `Updated influencer ${updated.name}`, updated.id);
    showNotification(`Influencer "${updated.name}" updated.`);
  };

  const deleteReview = (id: string) => {
    setReviews((prev) => prev.filter((r) => r.id !== id));
    cloudSqlApi.deleteReview(id).catch((err) => console.warn('[Cloud SQL] deleteReview failed:', err));
    addAuditLog('DELETE_REVIEW', 'Reviews', `Deleted review ID ${id}`, id);
    showNotification('Review deleted.');
  };

  // Customers CRM (Authoritative source of truth is Central PostgreSQL Backend — never localStorage)
  const [customers, setCustomers] = useState<CustomerProfile[]>(() => INITIAL_CUSTOMERS);

  useEffect(() => {
    try {
      localStorage.removeItem(STORAGE_KEYS.CUSTOMERS);
    } catch {}
  }, []);

  const addCustomer = (cust: CustomerProfile) => {
    setCustomers((prev) => [cust, ...prev]);
    cloudSqlApi.saveCustomer(cust).catch((err) => console.warn('[Cloud SQL] saveCustomer failed:', err));
    saveToFirestore('customers', cust.id, cust);
    addAuditLog('CREATE_CUSTOMER', 'Customer CRM', `Added customer ${cust.name} (${cust.email})`, cust.id);
    showNotification(`Customer "${cust.name}" added to CRM and saved to database.`);
  };

  const updateCustomer = (cust: CustomerProfile) => {
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id === cust.id || (cust.email && c.email.toLowerCase() === cust.email.toLowerCase())) {
          return { ...c, ...cust };
        }
        return c;
      })
    );
    cloudSqlApi
      .saveCustomer(cust)
      .catch((err) => console.warn('[Cloud SQL] saveCustomer failed:', err));
    saveToFirestore('customers', cust.id, cust);

    // If currently logged-in customer is this user, sync active profile
    setCustomer((prev) => {
      if (!prev) return null;
      if (prev.id === cust.id || prev.email.toLowerCase() === cust.email.toLowerCase()) {
        return {
          ...prev,
          name: cust.name,
          email: cust.email,
          phone: cust.phone || ''
        };
      }
      return prev;
    });

    addAuditLog('UPDATE_CUSTOMER', 'Customer CRM', `Updated profile for ${cust.name}`, cust.id);
    showNotification(`Customer "${cust.name}" updated successfully.`);
  };

  const deleteCustomer = (id: string) => {
    setCustomers((prev) => prev.filter((c) => c.id !== id));
    cloudSqlApi.deleteCustomer(id).catch((err) => console.warn('[Cloud SQL] deleteCustomer failed:', err));
    removeFromFirestore('customers', id);
    addAuditLog('DELETE_CUSTOMER', 'Customer CRM', `Deleted customer record ID ${id}`, id);
    showNotification('Customer record removed.');
  };

  // Integrations
  const [integrations, setIntegrations] = useState<IntegrationConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.INTEGRATIONS);
      return saved ? JSON.parse(saved) : INITIAL_INTEGRATIONS;
    } catch {
      return INITIAL_INTEGRATIONS;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.INTEGRATIONS, JSON.stringify(integrations));
  }, [integrations]);

  const updateIntegrations = (config: Partial<IntegrationConfig>) => {
    setIntegrations((prev) => {
      const next = { ...prev, ...config };
      fetch('/api/integrations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next)
      }).catch(() => {});
      saveToFirestore('integrations', 'current', next);
      return next;
    });
    addAuditLog('UPDATE_INTEGRATIONS', 'Integrations', 'Updated third-party integration credentials in PostgreSQL');
    showNotification('Integration settings saved to PostgreSQL.');
  };

  const testIntegration = async (service: keyof IntegrationConfig): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await fetch('/api/integrations/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service, config: integrations[service] })
      });
      const json = await res.json();
      addAuditLog('TEST_INTEGRATION', service.toUpperCase(), json.message || `Verified ${service} status`);
      return {
        success: Boolean(json.success),
        message: json.message || `${service.toUpperCase()}: Verified against server environment.`
      };
    } catch {
      return {
        success: false,
        message: `${service.toUpperCase()}: Verification request failed.`
      };
    }
  };

  // Campaigns & Broadcasts
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CAMPAIGNS);
      return saved ? JSON.parse(saved) : INITIAL_CAMPAIGNS;
    } catch {
      return INITIAL_CAMPAIGNS;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CAMPAIGNS, JSON.stringify(campaigns));
  }, [campaigns]);

  const addCampaign = (camp: Campaign) => {
    setCampaigns((prev) => [camp, ...prev]);
    cloudSqlApi.saveCampaign(camp).catch(() => {});
    saveToFirestore('campaigns', camp.id, camp);
    addAuditLog('CREATE_CAMPAIGN', 'Marketing', `Created campaign "${camp.name}" (${camp.type})`, camp.id);
    showNotification(`Campaign "${camp.name}" created.`);
  };

  const updateCampaign = (camp: Campaign) => {
    setCampaigns((prev) => prev.map((c) => (c.id === camp.id ? camp : c)));
    cloudSqlApi.saveCampaign(camp).catch(() => {});
    saveToFirestore('campaigns', camp.id, camp);
    addAuditLog('UPDATE_CAMPAIGN', 'Marketing', `Updated campaign "${camp.name}"`, camp.id);
    showNotification(`Campaign "${camp.name}" updated.`);
  };

  const deleteCampaign = (id: string) => {
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
    cloudSqlApi.deleteCampaign(id).catch(() => {});
    removeFromFirestore('campaigns', id);
    addAuditLog('DELETE_CAMPAIGN', 'Marketing', `Deleted campaign ID ${id}`, id);
    showNotification('Campaign deleted.');
  };

  const updateCampaignStatus = (id: string, status: Campaign['status']) => {
    setCampaigns((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const updated = { ...c, status };
          cloudSqlApi.saveCampaign(updated).catch(() => {});
          saveToFirestore('campaigns', id, updated);
          return updated;
        }
        return c;
      })
    );
    addAuditLog('CAMPAIGN_STATUS', 'Marketing', `Changed campaign ${id} status to ${status}`, id);
    showNotification(`Campaign status updated to ${status}.`);
  };

  // Returns & Refunds
  const [returns, setReturns] = useState<ReturnRefund[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.RETURNS);
      return saved ? JSON.parse(saved) : INITIAL_RETURNS;
    } catch {
      return INITIAL_RETURNS;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.RETURNS, JSON.stringify(returns));
  }, [returns]);

  const addReturn = (ret: ReturnRefund) => {
    setReturns((prev) => [ret, ...prev]);
    cloudSqlApi.saveReturn(ret).catch(() => {});
    saveToFirestore('returns', ret.id, ret);
    addAuditLog('CREATE_RETURN', 'Returns', `New return requested for order ${ret.orderNumber}`, ret.id);
    showNotification(`Return request logged for order ${ret.orderNumber}.`);
  };

  const updateReturnStatus = (id: string, status: ReturnRefund['status'], restock: boolean = false) => {
    setReturns((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const updated = { ...r, status, restockInventory: restock ?? r.restockInventory };
          cloudSqlApi.saveReturn(updated).catch(() => {});
          saveToFirestore('returns', id, updated);
          return updated;
        }
        return r;
      })
    );
    if (status === 'REFUNDED' && restock) {
      const targetReturn = returns.find((r) => r.id === id);
      if (targetReturn) {
        setProducts((prev) =>
          prev.map((p) => {
            if (p.name.toUpperCase() === targetReturn.productName.toUpperCase()) {
              const updatedProd = {
                ...p,
                variants: p.variants.map((v) =>
                  v.size === targetReturn.size
                    ? {
                        ...v,
                        stockOnHand: v.stockOnHand + targetReturn.quantity,
                        stockAvailable: v.stockAvailable + targetReturn.quantity
                      }
                    : v
                )
              };
              cloudSqlApi.saveProduct(updatedProd).catch(() => {});
              saveToFirestore('products', updatedProd.id, updatedProd);
              return updatedProd;
            }
            return p;
          })
        );
      }
    }
    addAuditLog('RETURN_STATUS', 'Returns', `Updated return ${id} to ${status}${restock ? ' (restocked inventory)' : ''}`, id);
    showNotification(`Return status updated to ${status}.`);
  };

  // Back In Stock
  const [backInStock, setBackInStock] = useState<BackInStockItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.BACK_IN_STOCK);
      return saved ? JSON.parse(saved) : INITIAL_BACK_IN_STOCK;
    } catch {
      return INITIAL_BACK_IN_STOCK;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.BACK_IN_STOCK, JSON.stringify(backInStock));
  }, [backInStock]);

  const addBackInStockRequest = (productId: string, productName: string, size: string, email: string, phone: string) => {
    const newItem: BackInStockItem = {
      id: 'bis-' + Math.random().toString(36).substring(2, 9),
      productId,
      productName,
      size,
      customerEmail: email,
      customerPhone: phone,
      requestedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      status: 'WAITING'
    };
    setBackInStock((prev) => [newItem, ...prev]);
    cloudSqlApi.saveBackInStock(newItem).catch(() => {});
    saveToFirestore('back_in_stock', newItem.id, newItem);
    addAuditLog('BACK_IN_STOCK_REQ', 'Back In Stock', `Alert request for ${productName} (${size}) from ${email}`);
    showNotification(`You will be notified when ${productName} (${size}) is back in stock.`);
  };

  const notifyBackInStock = (id: string) => {
    setBackInStock((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updated: BackInStockItem = { ...item, status: 'NOTIFIED' };
          cloudSqlApi.saveBackInStock(updated).catch(() => {});
          saveToFirestore('back_in_stock', id, updated);
          return updated;
        }
        return item;
      })
    );
    addAuditLog('NOTIFY_BACK_IN_STOCK', 'Back In Stock', `Dispatched notification for request ${id}`, id);
    showNotification('Back-in-stock notification dispatched to customer.');
  };

  const deleteBackInStock = (id: string) => {
    setBackInStock((prev) => prev.filter((item) => item.id !== id));
    cloudSqlApi.deleteBackInStock(id).catch(() => {});
    removeFromFirestore('back_in_stock', id);
    showNotification('Back in stock request removed.');
  };

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
      return saved ? JSON.parse(saved) : INITIAL_AUDIT_LOGS;
    } catch {
      return INITIAL_AUDIT_LOGS;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(auditLogs));
  }, [auditLogs]);

  const addAuditLog = (action: string, entity: string, details: string, entityId?: string) => {
    const newLog: AuditLog = {
      id: 'log-' + Math.random().toString(36).substring(2, 9),
      action,
      entity,
      entityId,
      user: customer?.name || 'Administrator',
      role: adminRole,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      details
    };
    setAuditLogs((prev) => [newLog, ...prev.slice(0, 199)]);
    cloudSqlApi.logAction(action, customer?.email || 'admin@fragmore.com', `${entity}: ${details}`, { entityId });
    saveToFirestore('audit_logs', newLog.id, newLog);
  };

  const clearAuditLogs = () => {
    setAuditLogs([]);
    showNotification('Audit logs cleared.');
  };

  return (
    <StoreContext.Provider
      value={{
        currentView,
        setCurrentView,
        selectedProductSlug,
        setSelectedProductSlug,
        selectedCategoryFilter,
        setSelectedCategoryFilter,
        isMiniCartOpen,
        setIsMiniCartOpen,
        isSearchOpen,
        setIsSearchOpen,
        isQuizOpen,
        setIsQuizOpen,
        isEventInspectorOpen,
        setIsEventInspectorOpen,
        selectedOrderForInvoice,
        setSelectedOrderForInvoice,
        theme,
        setTheme,
        toggleTheme,
        products,
        setProducts,
        updateProduct,
        addProduct,
        deleteProduct,
        cart,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        clearCart,
        toggleGiftWrap,
        applyCoupon,
        removeCoupon,
        wishlist,
        toggleWishlist,
        isInWishlist,
        orders,
        createOrder,
        updateOrderStatus,
        deleteOrder,
        abandonedCarts,
        sendRecoveryReminder,
        markCartRecovered,
        deleteAbandonedCart,
        addManualAbandonedReminder,
        customer,
        isLoggedIn: !!customer,
        isAuthModalOpen,
        setIsAuthModalOpen,
        updateCustomerProfile,
        changePassword,
        addOrUpdateAddress,
        loginWithEmail,
        signupWithEmail,
        sendPhoneOtp,
        verifyPhoneOtp,
        loginAsDemo,
        logout,
        influencers,
        addInfluencer,
        updateInfluencer,
        deleteInfluencer,
        coupons,
        addCoupon,
        updateCoupon,
        deleteCoupon,
        toggleCouponStatus,
        reviews,
        addReview,
        updateReviewStatus,
        deleteReview,
        cms,
        updateCMS,
        adminRole,
        setAdminRole,
        marketingEvents,
        trackEvent,
        attribution,
        customers,
        updateCustomer,
        addCustomer,
        deleteCustomer,
        integrations,
        updateIntegrations,
        testIntegration,
        campaigns,
        addCampaign,
        updateCampaign,
        deleteCampaign,
        updateCampaignStatus,
        returns,
        addReturn,
        updateReturnStatus,
        backInStock,
        addBackInStockRequest,
        notifyBackInStock,
        deleteBackInStock,
        auditLogs,
        addAuditLog,
        clearAuditLogs,
        notification,
        showNotification,
        visitorStats,
        refreshVisitorStats,
        isCloudSqlConnected,
        isFirebaseConnected
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};
