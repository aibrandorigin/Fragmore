export type FragranceGender = 'men' | 'women' | 'unisex' | 'devotional' | 'discovery';

export type FragranceFamily = 
  | 'Fresh' 
  | 'Aromatic' 
  | 'Woody' 
  | 'Spicy' 
  | 'Leather' 
  | 'Fruity' 
  | 'Floral' 
  | 'Sweet' 
  | 'Amber' 
  | 'Citrus' 
  | 'Musk'
  | 'Gourmand'
  | 'Sacred Wood'
  | string;

export interface StaticPosterSlotConfig {
  id: string;
  slotIndex: number; // 1 to 5
  title?: string;
  noteFocus?: 'all' | 'top' | 'heart' | 'base' | 'collector';
  bottleImageUrl?: string; // Optional admin-supplied bottle image to composite over the respective notes background
  customPosterUrl?: string; // Optional full poster image URL
  useNotesBackground?: boolean; // Defaults to true so bottle is shown with its respective notes in the background
}

export interface ProductVariant {
  id: string;
  size: string; // e.g. "2 ml", "15 ml", "30 ml", "50 ml"
  sku: string;
  mrp: number;
  sellingPrice: number;
  stockOnHand: number;
  stockReserved: number;
  stockAvailable: number;
  isAvailable: boolean;
  stockManaged?: boolean;
  frontImage?: string;
  frontImageUrl?: string;
  additionalImages?: string[];
  additionalImageUrls?: string[];
  transparentRender?: string;
  transparentBottleRenderUrl?: string;
  glbModelUrl?: string;
  model3dUrl?: string;
  posterImage?: string;
  staticPosterImageUrl?: string;
  staticPosterUrls?: string[];
  staticPosters?: StaticPosterSlotConfig[];
}

export interface FragranceNotePyramid {
  top: string[];
  heart: string[];
  base: string[];
}

export interface NoteMediaConfig {
  label?: string;
  imageUrl?: string;
  alt?: string;
  isAbstract?: boolean;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  subtitle: string;
  tagline?: string;
  gender: FragranceGender;
  collection: 'Signature Collection' | 'Aura Collection' | 'Discovery Collection' | 'Main Collection' | 'Devotional Trilogy' | string;
  scentProfile: string;
  description: string;
  story: string;
  notes: FragranceNotePyramid;
  noteMedia?: Record<string, NoteMediaConfig>;
  staticPosterUrls?: string[];
  staticPosters?: StaticPosterSlotConfig[];
  families: FragranceFamily[];
  occasions: string[];
  longevity: string;
  sillage: 'Intimate' | 'Moderate' | 'Enveloping' | 'Imperial' | 'Curated Range' | '';
  rating: number;
  reviewCount: number;
  isNewArrival?: boolean;
  isBestSeller?: boolean;
  status: 'ACTIVE' | 'DRAFT' | 'OUT_OF_STOCK' | 'ARCHIVED' | 'INACTIVE';
  variants: ProductVariant[];
  themeColor: string;
  accentColor: string;
  badge?: string;
  features: string[];
}

export interface CartItem {
  productId: string;
  productName: string;
  slug: string;
  variantId: string;
  size: string;
  sku: string;
  sellingPrice: number;
  mrp: number;
  quantity: number;
  themeColor: string;
  selectedFlavours?: string[];
}

export interface Cart {
  items: CartItem[];
  subtotal: number;
  discount: number;
  appliedCoupon: string | null;
  giftWrap: boolean;
  giftWrapFee: number;
  shippingFee: number;
  estimatedTax: number;
  total: number;
  freeShippingThreshold: number;
}

export type OrderStatus = 
  | 'NEW' 
  | 'CONFIRMED' 
  | 'PACKING' 
  | 'SHIPPED' 
  | 'OUT_FOR_DELIVERY' 
  | 'DELIVERED' 
  | 'CANCELLED' 
  | 'RETURNED' 
  | 'REFUNDED';

export type PaymentMethod = 'UPI' | 'CARDS' | 'NETBANKING' | 'WALLETS' | 'COD';

export interface CustomerAddress {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  isDefault?: boolean;
}

export interface OrderItem {
  productId: string;
  productName: string;
  size: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  selectedFlavours?: string[];
}

export interface MarketingAttribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  referrer?: string;
  landingPage?: string;
  firstTouch?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  createdAt: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: CustomerAddress;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  couponCode?: string;
  taxAmount: number; // 18% GST (CGST 9% + SGST 9% or IGST 18%)
  shippingAmount: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: 'PAID' | 'PENDING' | 'FAILED' | 'REFUNDED';
  transactionId?: string;
  orderStatus: OrderStatus;
  awbNumber?: string;
  courierName?: string;
  trackingUrl?: string;
  attribution?: MarketingAttribution;
  notes?: string;
}

export interface AbandonedCart {
  id: string;
  customerEmail: string;
  customerPhone: string;
  customerName?: string;
  items: CartItem[];
  cartValue: number;
  couponCode?: string;
  lastActivity: string;
  status: 'ACTIVE' | 'ABANDONED' | 'RECOVERED' | 'EXPIRED';
  recoveredAt?: string;
  attribution?: MarketingAttribution;
  recoverySentEmail: boolean;
  recoverySentWhatsApp: boolean;
  recoverySentSMS: boolean;
}

export interface Coupon {
  code: string;
  discountType: 'PERCENTAGE' | 'FLAT' | 'FREE_SHIPPING' | 'DISCOVERY_VOUCHER';
  value: number; // e.g. 10 for 10% or 1499 for ₹1499 flat
  minCartValue: number;
  maxDiscount?: number;
  usageLimit: number;
  timesUsed: number;
  isActive: boolean;
  description: string;
  expiryDate: string;
}

export interface Influencer {
  id: string;
  name: string;
  instagramHandle?: string;
  code: string;
  discountPercentage?: number;
  commissionPercentage: number;
  campaign: string;
  clicks: number;
  orders: number;
  totalRevenue: number;
  totalCommission: number;
  status: 'ACTIVE' | 'PAUSED';
}

export interface Review {
  id: string;
  productId: string;
  productName: string;
  customerName: string;
  rating: number; // 1 to 5
  title: string;
  content: string;
  isVerifiedPurchase: boolean;
  date: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
}

export interface MarketingEvent {
  id: string;
  eventName: string;
  timestamp: string;
  payload: Record<string, any>;
  channels: ('META_PIXEL' | 'GA4' | 'GTM' | 'GOOGLE_ADS')[];
}

export type AdminRole = 
  | 'SUPER_ADMIN' 
  | 'ADMIN' 
  | 'ORDER_MANAGER' 
  | 'INVENTORY_MANAGER' 
  | 'MARKETING' 
  | 'CUSTOMER_SUPPORT';

export interface AtelierConciergeService {
  id: string;
  title: string;
  description: string;
  buttonLabel: string;
  buttonDestination: string;
  displayOrder: number;
}

export interface AtelierConciergeConfig {
  visible: boolean;
  displayOrder: number;
  heading: string;
  subtitle: string;
  description: string;
  services: AtelierConciergeService[];
  primaryButtonLabel?: string;
  primaryButtonDestination?: string;
  secondaryButtonLabel?: string;
  secondaryButtonDestination?: string;
  whatsappNumber: string;
  email: string;
  openingHours: string;
  supportingImage?: string;
  supportingImageUrl?: string;
  supportingImageAlt: string;
}

export interface CMSSettings {
  launchMode: boolean;
  launchDate: string;
  heroHeadline: string;
  heroTagline: string;
  heroSubtagline?: string;
  heroCtaText?: string;
  heroCtaDestination?: string;
  heroFeaturedProductSlug?: string;
  heroPosterImageUrl?: string;
  heroBottleModelUrl?: string;
  heroLayeredBottleUrl?: string;
  heroLayeredCapUrl?: string;
  heroLayeredAtomizerUrl?: string;
  heroInteractionHint?: string;
  heroAnimationEnabled?: boolean;
  heroStaticFallbackUrl?: string;
  announcementBarText: string;
  announcementBarActive: boolean;
  freeShippingThreshold: number;
  discoveryVoucherValue: number;
  contactEmail: string;
  contactPhone: string;
  headquarters: string;
  gstNumber: string;
  logoText?: string;
  faviconUrl?: string;
  instagramUrl?: string;
  youtubeUrl?: string;
  twitterUrl?: string;
  pinterestUrl?: string;
  promoBannerText?: string;
  promoBannerActive?: boolean;
  popupActive?: boolean;
  popupTitle?: string;
  popupDiscount?: string;
  fragranceDisplayOrder?: string[];
  scrollStoryFragrances?: string[];
  logoUrl?: string;
  heroVideoUrl?: string;
  showcaseVideoUrl?: string;
  bottleRenders?: Record<string, string>;
  footerAtelierLocations?: string;
  footerCopyright?: string;
  offerHeadline?: string;
  offerDescription?: string;
  whatsappSupportNumber?: string;
  conciergeHours?: string;
  journalArticles?: JournalArticle[];
  atelierConcierge?: AtelierConciergeConfig;
  catalogueMigratedV2?: boolean;
  catalogueMigratedV3?: boolean;
}

export interface JournalArticle {
  id: string;
  title: string;
  slug: string;
  category: string;
  readTime: string;
  date: string;
  excerpt: string;
  content?: string;
  published: boolean;
}

export interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId?: string;
  user: string;
  role: AdminRole;
  timestamp: string;
  details: string;
}

export interface CustomerCommunication {
  id: string;
  date: string;
  channel: 'EMAIL' | 'WHATSAPP' | 'SMS';
  subject: string;
  status: 'SENT' | 'DELIVERED' | 'READ';
}

export interface CustomerProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  registeredDate: string;
  accountCreationDate?: string;
  segments: string[];
  totalSpend: number;
  ordersCount: number;
  aov: number;
  lastOrderDate: string;
  lastPurchaseDate?: string;
  daysSinceLastOrder: number;
  favouriteFragrance: string;
  isDiscoveryBuyer: boolean;
  wishlistSlugs: string[];
  reviewsCount: number;
  abandonedCartsCount: number;
  couponsUsed: string[];
  source: string;
  influencer?: string;
  utmSource?: string;
  utmCampaign?: string;
  notes?: string;
  communicationHistory: CustomerCommunication[];
  addresses?: CustomerAddress[];
  createdAt?: string;
  classification?: 'NEW' | 'CUSTOMER' | 'VIP';
  confirmedOrdersCount?: number;
  totalPurchaseValue?: number;
}

export interface Campaign {
  id: string;
  name: string;
  type: 'EMAIL' | 'WHATSAPP' | 'SMS' | 'BANNER';
  status: 'ACTIVE' | 'SCHEDULED' | 'COMPLETED' | 'PAUSED';
  targetSegment: string;
  scheduledDate: string;
  sentCount: number;
  openRate: number;
  clicksCount: number;
  revenueGenerated: number;
}

export interface ReturnRefund {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  requestDate: string;
  reason: string;
  productName: string;
  size: string;
  quantity: number;
  refundAmount: number;
  status: 'REQUESTED' | 'IN_INSPECTION' | 'APPROVED' | 'REFUNDED' | 'REJECTED';
  restockInventory: boolean;
  notes?: string;
}

export interface BackInStockItem {
  id: string;
  productId: string;
  productName: string;
  size: string;
  customerEmail: string;
  customerPhone: string;
  requestedAt: string;
  status: 'WAITING' | 'NOTIFIED';
}

export interface IntegrationConfig {
  meta: {
    pixelId: string;
    conversionsApiToken: string;
    testEventCode: string;
    status: 'CONNECTED' | 'DISCONNECTED';
    lastTested?: string;
  };
  google: {
    ga4MeasurementId: string;
    gtmId: string;
    googleAdsId: string;
    merchantCenterId: string;
    status: 'CONNECTED' | 'DISCONNECTED';
    lastTested?: string;
  };
  whatsapp: {
    provider: 'Meta Cloud API' | 'Interakt' | 'Wati' | 'Gupshup';
    apiKey: string;
    phoneNumberId: string;
    templates: { name: string; status: 'APPROVED' | 'PENDING' }[];
    status: 'CONNECTED' | 'DISCONNECTED';
  };
  sms: {
    provider: 'Fast2SMS' | 'Msg91' | 'Twilio';
    apiKey: string;
    senderId: string;
    status: 'CONNECTED' | 'DISCONNECTED';
  };
  email: {
    provider: 'SendGrid' | 'Postmark' | 'Amazon SES' | 'Custom SMTP';
    smtpHost: string;
    smtpPort: string;
    apiKey: string;
    fromEmail: string;
    status: 'CONNECTED' | 'DISCONNECTED';
  };
  payment: {
    gateway: 'Razorpay' | 'Cashfree' | 'PhonePe';
    keyId: string;
    keySecret: string;
    webhookSecret: string;
    environment: 'LIVE' | 'TEST';
    status: 'CONNECTED' | 'DISCONNECTED';
  };
  shipping: {
    provider: 'Shiprocket' | 'Delhivery' | 'Blue Dart';
    apiEmail: string;
    apiKey: string;
    warehousePincode: string;
    status: 'CONNECTED' | 'DISCONNECTED';
  };
}

export interface VisitorSessionRecord {
  id: string;
  visitorId: string;
  page: string;
  device: 'mobile' | 'desktop' | 'tablet';
  channel: 'direct' | 'instagram' | 'search' | 'whatsapp' | 'referral';
  location: string;
  timestamp: string;
  durationSeconds: number;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  isLoggedIn?: boolean;
  cartValue?: number;
  cartItemsCount?: number;
  productSlug?: string;
  ip?: string;
  isLive?: boolean;
}

export interface VisitorStats {
  totalVisitors: number;
  uniqueVisitors: number;
  todayVisitors: number;
  activeNow: number;
  totalPageViews: number;
  avgSessionDurationSeconds: number;
  bounceRate: number;
  deviceBreakdown: {
    mobile: number;
    desktop: number;
    tablet: number;
  };
  channelBreakdown: {
    direct: number;
    instagram: number;
    search: number;
    whatsapp: number;
    referral: number;
  };
  topLocations: { city: string; count: number; percentage: number }[];
  hourlyTrend: { hour: string; visitors: number; pageViews: number }[];
  recentVisits: VisitorSessionRecord[];
  liveVisitors?: VisitorSessionRecord[];
}

