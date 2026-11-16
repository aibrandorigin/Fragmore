import {
  Product,
  Order,
  CustomerProfile,
  Review,
  Coupon,
  Influencer,
  AbandonedCart,
  CMSSettings,
  AuditLog,
  Campaign,
  ReturnRefund,
  BackInStockItem,
  VisitorStats
} from '../types';
import { auth } from './firebase';

async function getAuthHeader(): Promise<HeadersInit> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  try {
    const savedRole = localStorage.getItem('fragmore_admin_role_v1');
    const savedCustomer = localStorage.getItem('fragmore_customer_v1');
    if (savedRole && savedRole !== 'CUSTOMER') {
      headers['x-admin-role'] = savedRole;
    }
    if (savedCustomer) {
      const parsed = JSON.parse(savedCustomer);
      if (parsed?.email) {
        headers['x-admin-email'] = parsed.email;
      }
      if (parsed?.role && parsed.role !== 'CUSTOMER' && !headers['x-admin-role']) {
        headers['x-admin-role'] = parsed.role;
      }
    }
  } catch {
    // Non-fatal
  }
  try {
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch (err) {
    // Non-fatal, continue with unauthenticated request
  }
  return headers;
}

export const cloudSqlApi = {
  // Health
  checkHealth: async () => {
    const res = await fetch('/api/health');
    return res.json();
  },

  // Seed
  seedDatabase: async () => {
    const headers = await getAuthHeader();
    const res = await fetch('/api/seed', { method: 'POST', headers });
    return res.json();
  },

  // Users
  syncUser: async (
    uid: string,
    email: string,
    displayName?: string,
    phone?: string,
    extra?: { addresses?: any[]; wishlistSlugs?: string[]; notes?: string; source?: string }
  ) => {
    const headers = await getAuthHeader();
    const res = await fetch('/api/users/sync', {
      method: 'POST',
      headers,
      body: JSON.stringify({ uid, email, displayName, phone, ...(extra || {}) }),
    });
    return res.json();
  },

  // Products
  getProducts: async (): Promise<Product[]> => {
    const res = await fetch('/api/products');
    if (!res.ok) throw new Error('Failed to fetch products from Cloud SQL');
    return res.json();
  },

  saveProduct: async (product: Product): Promise<{ success: boolean; product: Product }> => {
    const headers = await getAuthHeader();
    const res = await fetch('/api/products', {
      method: 'POST',
      headers,
      body: JSON.stringify(product),
    });
    if (!res.ok) throw new Error('Failed to save product to Cloud SQL');
    return res.json();
  },

  deleteProduct: async (id: string): Promise<{ success: boolean }> => {
    const headers = await getAuthHeader();
    const res = await fetch(`/api/products/${id}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) throw new Error('Failed to delete product from Cloud SQL');
    return res.json();
  },

  // Orders
  getOrders: async (): Promise<Order[]> => {
    const res = await fetch('/api/orders');
    if (!res.ok) throw new Error('Failed to fetch orders from Cloud SQL');
    return res.json();
  },

  createOrder: async (order: Order): Promise<{ success: boolean; order: Order }> => {
    const headers = await getAuthHeader();
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers,
      body: JSON.stringify(order),
    });
    if (!res.ok) throw new Error('Failed to create order in Cloud SQL');
    return res.json();
  },

  updateOrderStatus: async (
    orderId: string,
    status: string,
    tracking?: { awbNumber?: string; courierName?: string; trackingUrl?: string }
  ): Promise<{ success: boolean; order: Order }> => {
    const headers = await getAuthHeader();
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status, ...tracking }),
    });
    if (!res.ok) throw new Error('Failed to update order status in Cloud SQL');
    return res.json();
  },

  deleteOrder: async (id: string): Promise<{ success: boolean }> => {
    const headers = await getAuthHeader();
    const res = await fetch(`/api/orders/${id}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) throw new Error('Failed to delete order from Cloud SQL');
    return res.json();
  },

  // Customers
  getCustomers: async (): Promise<CustomerProfile[]> => {
    const res = await fetch('/api/customers');
    if (!res.ok) throw new Error('Failed to fetch customers from Cloud SQL');
    return res.json();
  },

  getAdminCustomers: async (adminRole?: string, adminEmail?: string): Promise<CustomerProfile[]> => {
    const headers = await getAuthHeader();
    if (adminRole) {
      (headers as any)['x-admin-role'] = adminRole;
    }
    if (adminEmail) {
      (headers as any)['x-admin-email'] = adminEmail;
    }
    const res = await fetch('/api/admin/customers', { headers });
    if (!res.ok) throw new Error('Failed to fetch admin customer classifications');
    return res.json();
  },

  saveCustomer: async (customer: CustomerProfile): Promise<{ success: boolean; customer: CustomerProfile }> => {
    const headers = await getAuthHeader();
    const res = await fetch('/api/customers', {
      method: 'POST',
      headers,
      body: JSON.stringify(customer),
    });
    if (!res.ok) throw new Error('Failed to save customer to Cloud SQL');
    return res.json();
  },

  deleteCustomer: async (id: string): Promise<{ success: boolean }> => {
    const headers = await getAuthHeader();
    const res = await fetch(`/api/customers/${id}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) throw new Error('Failed to delete customer from Cloud SQL');
    return res.json();
  },

  // Reviews
  getReviews: async (): Promise<Review[]> => {
    const res = await fetch('/api/reviews');
    if (!res.ok) throw new Error('Failed to fetch reviews from Cloud SQL');
    return res.json();
  },

  submitReview: async (review: Review): Promise<{ success: boolean; review: Review }> => {
    const headers = await getAuthHeader();
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers,
      body: JSON.stringify(review),
    });
    if (!res.ok) throw new Error('Failed to submit review to Cloud SQL');
    return res.json();
  },

  deleteReview: async (id: string): Promise<{ success: boolean }> => {
    const headers = await getAuthHeader();
    const res = await fetch(`/api/reviews/${id}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) throw new Error('Failed to delete review from Cloud SQL');
    return res.json();
  },

  // Coupons
  getCoupons: async (): Promise<Coupon[]> => {
    const res = await fetch('/api/coupons');
    if (!res.ok) throw new Error('Failed to fetch coupons from Cloud SQL');
    return res.json();
  },

  saveCoupon: async (coupon: Coupon): Promise<{ success: boolean; coupon: Coupon }> => {
    const headers = await getAuthHeader();
    const res = await fetch('/api/coupons', {
      method: 'POST',
      headers,
      body: JSON.stringify(coupon),
    });
    if (!res.ok) throw new Error('Failed to save coupon to Cloud SQL');
    return res.json();
  },

  deleteCoupon: async (code: string): Promise<{ success: boolean }> => {
    const headers = await getAuthHeader();
    const res = await fetch(`/api/coupons/${code}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) throw new Error('Failed to delete coupon from Cloud SQL');
    return res.json();
  },

  // Influencers
  getInfluencers: async (): Promise<Influencer[]> => {
    const res = await fetch('/api/influencers');
    if (!res.ok) throw new Error('Failed to fetch influencers from Cloud SQL');
    return res.json();
  },

  saveInfluencer: async (influencer: Influencer): Promise<{ success: boolean; influencer: Influencer }> => {
    const headers = await getAuthHeader();
    const res = await fetch('/api/influencers', {
      method: 'POST',
      headers,
      body: JSON.stringify(influencer),
    });
    if (!res.ok) throw new Error('Failed to save influencer to Cloud SQL');
    return res.json();
  },

  deleteInfluencer: async (id: string): Promise<{ success: boolean }> => {
    const headers = await getAuthHeader();
    const res = await fetch(`/api/influencers/${id}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) throw new Error('Failed to delete influencer from Cloud SQL');
    return res.json();
  },

  // Abandoned Carts
  getAbandonedCarts: async (): Promise<AbandonedCart[]> => {
    const res = await fetch('/api/abandoned-carts');
    if (!res.ok) throw new Error('Failed to fetch abandoned carts from Cloud SQL');
    return res.json();
  },

  saveAbandonedCart: async (cart: AbandonedCart): Promise<{ success: boolean; cart: AbandonedCart }> => {
    const headers = await getAuthHeader();
    const res = await fetch('/api/abandoned-carts', {
      method: 'POST',
      headers,
      body: JSON.stringify(cart),
    });
    if (!res.ok) throw new Error('Failed to save abandoned cart to Cloud SQL');
    return res.json();
  },

  deleteAbandonedCart: async (id: string): Promise<{ success: boolean }> => {
    const headers = await getAuthHeader();
    const res = await fetch(`/api/abandoned-carts/${id}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) throw new Error('Failed to delete abandoned cart from Cloud SQL');
    return res.json();
  },

  // CMS Settings
  getCMS: async (): Promise<CMSSettings> => {
    const res = await fetch('/api/cms');
    if (!res.ok) throw new Error('Failed to fetch CMS settings from Cloud SQL');
    return res.json();
  },

  saveCMS: async (cms: CMSSettings): Promise<{ success: boolean; settings: CMSSettings }> => {
    const headers = await getAuthHeader();
    const res = await fetch('/api/cms', {
      method: 'POST',
      headers,
      body: JSON.stringify(cms),
    });
    if (!res.ok) {
      let errMsg = 'Failed to save CMS settings to Cloud SQL';
      try {
        const errData = await res.json();
        if (errData?.error) errMsg = errData.error;
      } catch {}
      throw new Error(errMsg);
    }
    return res.json();
  },

  // Audit Logs
  getAuditLogs: async (): Promise<AuditLog[]> => {
    const res = await fetch('/api/audit-logs');
    if (!res.ok) throw new Error('Failed to fetch audit logs from Cloud SQL');
    return res.json();
  },

  logAction: async (action: string, adminEmail: string, details?: string, metadata?: any): Promise<void> => {
    try {
      const headers = await getAuthHeader();
      await fetch('/api/audit-logs', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action, adminEmail, details, metadata }),
      });
    } catch (e) {
      console.warn('Failed to record audit log:', e);
    }
  },

  // Campaigns
  getCampaigns: async (): Promise<Campaign[]> => {
    const res = await fetch('/api/campaigns');
    if (!res.ok) throw new Error('Failed to fetch campaigns');
    return res.json();
  },

  saveCampaign: async (campaign: Campaign): Promise<any> => {
    const headers = await getAuthHeader();
    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers,
      body: JSON.stringify(campaign),
    });
    return res.json();
  },

  deleteCampaign: async (id: string): Promise<any> => {
    const headers = await getAuthHeader();
    const res = await fetch(`/api/campaigns/${id}`, {
      method: 'DELETE',
      headers,
    });
    return res.json();
  },

  // Returns
  getReturns: async (): Promise<ReturnRefund[]> => {
    const res = await fetch('/api/returns');
    if (!res.ok) throw new Error('Failed to fetch returns');
    return res.json();
  },

  saveReturn: async (ret: ReturnRefund): Promise<any> => {
    const headers = await getAuthHeader();
    const res = await fetch('/api/returns', {
      method: 'POST',
      headers,
      body: JSON.stringify(ret),
    });
    return res.json();
  },

  // Back in Stock
  getBackInStock: async (): Promise<BackInStockItem[]> => {
    const res = await fetch('/api/back-in-stock');
    if (!res.ok) throw new Error('Failed to fetch back in stock');
    return res.json();
  },

  saveBackInStock: async (item: BackInStockItem): Promise<any> => {
    const headers = await getAuthHeader();
    const res = await fetch('/api/back-in-stock', {
      method: 'POST',
      headers,
      body: JSON.stringify(item),
    });
    return res.json();
  },

  deleteBackInStock: async (id: string): Promise<any> => {
    const headers = await getAuthHeader();
    const res = await fetch(`/api/back-in-stock/${id}`, {
      method: 'DELETE',
      headers,
    });
    return res.json();
  },

  // Visitor Telemetry & Traffic Analytics
  getVisitorStats: async (): Promise<VisitorStats> => {
    const headers = await getAuthHeader();
    const res = await fetch('/api/analytics/visitors', { headers });
    if (!res.ok) throw new Error('Failed to fetch visitor stats');
    return res.json();
  },

  trackVisit: async (payload: {
    visitorId: string;
    sessionId?: string;
    page?: string;
    referrer?: string;
    device?: 'mobile' | 'desktop' | 'tablet';
    city?: string;
    isNewVisitor?: boolean;
    isNewSession?: boolean;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    isLoggedIn?: boolean;
    cartValue?: number;
    cartItemsCount?: number;
    productSlug?: string;
  }): Promise<VisitorStats> => {
    const headers = await getAuthHeader();
    const res = await fetch('/api/analytics/track-visit', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to track visit');
    return res.json();
  },

  sendHeartbeat: async (payload: string | {
    visitorId: string;
    page?: string;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    isLoggedIn?: boolean;
    cartValue?: number;
    cartItemsCount?: number;
    productSlug?: string;
    city?: string;
    device?: 'mobile' | 'desktop' | 'tablet';
  }): Promise<void> => {
    try {
      const headers = await getAuthHeader();
      const body = typeof payload === 'string' ? { visitorId: payload } : payload;
      await fetch('/api/analytics/heartbeat', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
    } catch {
      // Non-fatal
    }
  },

  createAssistedCart: async (payload: any): Promise<{ success: boolean; cartId: string; cart: any }> => {
    const headers = await getAuthHeader();
    const res = await fetch('/api/assisted-cart', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to create assisted cart');
    return res.json();
  },

  getAssistedCart: async (cartId: string): Promise<any> => {
    const headers = await getAuthHeader();
    const res = await fetch(`/api/assisted-cart/${encodeURIComponent(cartId)}`, {
      method: 'GET',
      headers,
    });
    if (!res.ok) throw new Error('Failed to fetch assisted cart');
    return res.json();
  },
};
