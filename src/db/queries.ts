import { db } from './index.ts';
import {
  products,
  orders,
  customers,
  reviews,
  coupons,
  influencers,
  abandonedCarts,
  cmsSettings,
  campaigns,
  returnsRefunds,
  backInStock,
  auditLogs,
  users,
  automationEvents,
  automationJobs
} from './schema.ts';
import { eq, desc, or } from 'drizzle-orm';
import {
  INITIAL_PRODUCTS,
  INITIAL_COUPONS,
  INITIAL_INFLUENCERS,
  INITIAL_REVIEWS,
  INITIAL_ORDERS,
  INITIAL_ABANDONED_CARTS,
  INITIAL_CMS,
  INITIAL_CUSTOMERS,
  INITIAL_CAMPAIGNS,
  INITIAL_RETURNS,
  INITIAL_BACK_IN_STOCK,
  INITIAL_AUDIT_LOGS
} from '../data/initialData.ts';

// ==========================================
// PRODUCTS
// ==========================================
export async function getAllProducts() {
  try {
    return await db.select().from(products);
  } catch (error) {
    console.error('Failed to get products:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function upsertProduct(productData: any) {
  try {
    const existing = await db.select().from(products).where(eq(products.id, productData.id)).limit(1);
    if (existing.length > 0) {
      const result = await db.update(products)
        .set({
          slug: productData.slug,
          name: productData.name,
          subtitle: productData.subtitle,
          gender: productData.gender,
          collection: productData.collection,
          scentProfile: productData.scentProfile,
          description: productData.description,
          story: productData.story,
          notes: productData.notes,
          families: productData.families,
          occasions: productData.occasions,
          longevity: productData.longevity,
          sillage: productData.sillage,
          rating: productData.rating,
          reviewCount: productData.reviewCount,
          isNewArrival: productData.isNewArrival ?? false,
          isBestSeller: productData.isBestSeller ?? false,
          status: productData.status || 'ACTIVE',
          variants: productData.variants,
          themeColor: productData.themeColor,
          accentColor: productData.accentColor,
          badge: productData.badge,
          features: productData.features,
        })
        .where(eq(products.id, productData.id))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(products)
        .values({
          id: productData.id,
          slug: productData.slug,
          name: productData.name,
          subtitle: productData.subtitle,
          gender: productData.gender,
          collection: productData.collection,
          scentProfile: productData.scentProfile,
          description: productData.description,
          story: productData.story,
          notes: productData.notes,
          families: productData.families,
          occasions: productData.occasions,
          longevity: productData.longevity,
          sillage: productData.sillage,
          rating: productData.rating,
          reviewCount: productData.reviewCount,
          isNewArrival: productData.isNewArrival ?? false,
          isBestSeller: productData.isBestSeller ?? false,
          status: productData.status || 'ACTIVE',
          variants: productData.variants,
          themeColor: productData.themeColor,
          accentColor: productData.accentColor,
          badge: productData.badge,
          features: productData.features,
        })
        .returning();
      return result[0];
    }
  } catch (error) {
    console.error('Failed to upsert product:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function deleteProductById(id: string) {
  try {
    return await db.delete(products).where(eq(products.id, id)).returning();
  } catch (error) {
    console.error('Failed to delete product:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// ==========================================
// ORDERS
// ==========================================
export async function getAllOrders() {
  try {
    return await db.select().from(orders).orderBy(desc(orders.createdAt));
  } catch (error) {
    console.error('Failed to get orders:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function insertOrder(orderData: any) {
  try {
    const result = await db.insert(orders)
      .values({
        id: orderData.id,
        orderNumber: orderData.orderNumber,
        customerId: orderData.customerId,
        customerName: orderData.customerName,
        customerEmail: orderData.customerEmail,
        customerPhone: orderData.customerPhone,
        shippingAddress: orderData.shippingAddress,
        items: orderData.items,
        subtotal: orderData.subtotal,
        discount: orderData.discount || 0,
        couponCode: orderData.couponCode || null,
        taxAmount: orderData.taxAmount || 0,
        shippingAmount: orderData.shippingAmount || 0,
        totalAmount: orderData.totalAmount,
        paymentMethod: orderData.paymentMethod,
        paymentStatus: orderData.paymentStatus,
        transactionId: orderData.transactionId || null,
        orderStatus: orderData.orderStatus || 'NEW',
        awbNumber: orderData.awbNumber || null,
        courierName: orderData.courierName || null,
        trackingUrl: orderData.trackingUrl || null,
        attribution: orderData.attribution || null,
        notes: orderData.notes || null,
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error('Failed to insert order:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function updateOrderStatus(orderId: string, status: string, trackingInfo?: { awbNumber?: string; courierName?: string; trackingUrl?: string }) {
  try {
    const result = await db.update(orders)
      .set({
        orderStatus: status,
        ...(trackingInfo?.awbNumber ? { awbNumber: trackingInfo.awbNumber } : {}),
        ...(trackingInfo?.courierName ? { courierName: trackingInfo.courierName } : {}),
        ...(trackingInfo?.trackingUrl ? { trackingUrl: trackingInfo.trackingUrl } : {}),
      })
      .where(eq(orders.id, orderId))
      .returning();
    return result[0];
  } catch (error) {
    console.error('Failed to update order status:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function deleteOrderById(id: string) {
  try {
    return await db.delete(orders).where(eq(orders.id, id)).returning();
  } catch (error) {
    console.error('Failed to delete order:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// ==========================================
// CUSTOMERS
// ==========================================
export async function getAllCustomers() {
  try {
    const custs = await db.select().from(customers).orderBy(desc(customers.createdAt));
    const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
    const registeredEmails = new Set(custs.map((c) => (c.email || '').trim().toLowerCase()));
    const extraUsers = [];
    for (const u of allUsers) {
      const emailLower = (u.email || '').trim().toLowerCase();
      if (emailLower && !registeredEmails.has(emailLower)) {
        registeredEmails.add(emailLower);
        // Never fabricate missing customer names, mobile numbers or email addresses
        extraUsers.push({
          id: `cust-${u.uid}`,
          name: u.displayName ? u.displayName.trim() : '',
          email: u.email ? u.email.trim() : '',
          phone: u.phone ? u.phone.trim() : '',
          city: null,
          state: null,
          tier: 'Member',
          tags: ['New registered customers'],
          totalOrders: 0,
          totalSpend: 0,
          addresses: [],
          notes: null,
          favouriteFragrance: null,
          source: 'Web Account Registration',
          influencer: null,
          utmSource: null,
          utmCampaign: null,
          communicationHistory: [],
          wishlistSlugs: [],
          crmMetadata: {},
          createdAt: u.createdAt
        });
      }
    }
    return [...custs, ...extraUsers];
  } catch (error) {
    console.error('Failed to get customers:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getAdminCustomerAnalytics() {
  try {
    const [
      allCustomers,
      allUsers,
      allOrders,
      allRefunds,
      allCarts,
      allReviews,
      allCoupons,
      allEvents,
      allJobs
    ] = await Promise.all([
      db.select().from(customers).orderBy(desc(customers.createdAt)),
      db.select().from(users).orderBy(desc(users.createdAt)),
      db.select().from(orders).orderBy(desc(orders.createdAt)),
      db.select().from(returnsRefunds).orderBy(desc(returnsRefunds.createdAt)),
      db.select().from(abandonedCarts).orderBy(desc(abandonedCarts.createdAt)),
      db.select().from(reviews).orderBy(desc(reviews.createdAt)),
      db.select().from(coupons),
      db.select().from(automationEvents).orderBy(desc(automationEvents.createdAt)).limit(500),
      db.select().from(automationJobs).orderBy(desc(automationJobs.createdAt)).limit(500)
    ]);

    // Build refund map: orderId -> total refunded integer amount (deduct approved/processed/refunded amounts)
    const refundMap = new Map<string, number>();
    for (const ref of allRefunds) {
      if (ref.orderId && ref.refundAmount) {
        const refStatus = (ref.status || 'PROCESSED').trim().toUpperCase();
        if (refStatus !== 'REJECTED' && refStatus !== 'CANCELLED') {
          const current = refundMap.get(ref.orderId) || 0;
          refundMap.set(ref.orderId, current + Math.round(Number(ref.refundAmount)));
        }
      }
    }

    // Deduplicate orders by id
    const uniqueOrdersMap = new Map<string, (typeof allOrders)[0]>();
    for (const ord of allOrders) {
      if (ord.id && !uniqueOrdersMap.has(ord.id)) {
        uniqueOrdersMap.set(ord.id, ord);
      }
    }
    const uniqueOrders = Array.from(uniqueOrdersMap.values());

    // Merge registered accounts from users table without fabricating missing names/phones/emails
    const registeredEmails = new Set(allCustomers.map((c) => (c.email || '').trim().toLowerCase()));
    const syntheticFromUsers = [];
    for (const u of allUsers) {
      const emailLower = (u.email || '').trim().toLowerCase();
      if (emailLower && !registeredEmails.has(emailLower)) {
        registeredEmails.add(emailLower);
        syntheticFromUsers.push({
          id: `cust-${u.uid}`,
          name: u.displayName ? u.displayName.trim() : '',
          email: u.email ? u.email.trim() : '',
          phone: u.phone ? u.phone.trim() : '',
          city: null,
          state: null,
          tier: 'Silver',
          tags: ['New registered customers'],
          totalOrders: 0,
          totalSpend: 0,
          addresses: [],
          notes: null,
          favouriteFragrance: null,
          source: 'Web Account Registration',
          influencer: null,
          utmSource: null,
          utmCampaign: null,
          communicationHistory: [],
          wishlistSlugs: [],
          crmMetadata: {},
          createdAt: u.createdAt
        });
      }
    }
    const combinedCustomers = [...allCustomers, ...syntheticFromUsers];

    const SIGNATURE_KEYWORDS = ['AZURE', 'IGNITE', 'ROSELLE', 'ÉLAN', 'ELAN', 'SUEDE', 'SOLARA', 'GOLDEN HOUR', 'SIGNATURE', 'EXTRAIT'];
    const DEVOTIONAL_KEYWORDS = ['AARADHYA', 'SAMARPAN', 'ANANTA', 'DEVOTIONAL', 'SACRED'];
    const activeCouponCodes = allCoupons.filter((c) => c.isActive).map((c) => c.code.toUpperCase());
    const nowMs = Date.now();

    return combinedCustomers.map((cust) => {
      const custEmail = cust.email ? cust.email.trim().toLowerCase() : '';
      const custId = cust.id ? cust.id.trim() : '';
      const custPhone = cust.phone ? cust.phone.replace(/[^0-9]/g, '') : '';
      const crmMeta: Record<string, any> =
        cust.crmMetadata && typeof cust.crmMetadata === 'object'
          ? { ...(cust.crmMetadata as Record<string, any>) }
          : {};

      // Match orders for this customer by ID, normalized email, or verified 10-digit phone
      const matchingOrders = uniqueOrders.filter((ord) => {
        const orderEmail = ord.customerEmail ? ord.customerEmail.trim().toLowerCase() : '';
        const orderCustId = ord.customerId ? ord.customerId.trim() : '';
        const orderPhone = ord.customerPhone ? ord.customerPhone.replace(/[^0-9]/g, '') : '';
        const phoneMatch =
          custPhone &&
          orderPhone &&
          custPhone.length >= 10 &&
          orderPhone.endsWith(custPhone.slice(-10));
        return (
          (custEmail && orderEmail === custEmail) ||
          (custId && orderCustId === custId) ||
          Boolean(phoneMatch)
        );
      });

      // Qualifying completed orders: exclude cancelled and failed orders
      const qualifyingOrders = matchingOrders.filter((ord) => {
        const payStatus = (ord.paymentStatus || '').trim().toUpperCase();
        const ordStatus = (ord.orderStatus || '').trim().toUpperCase();
        const isConfirmedOrPaid =
          payStatus === 'PAID' ||
          payStatus === 'COMPLETED' ||
          ordStatus === 'CONFIRMED' ||
          ordStatus === 'PACKING' ||
          ordStatus === 'PROCESSING' ||
          ordStatus === 'SHIPPED' ||
          ordStatus === 'DELIVERED';
        const notCancelledOrReturned =
          ordStatus !== 'CANCELLED' &&
          ordStatus !== 'FAILED' &&
          ordStatus !== 'RETURNED' &&
          payStatus !== 'FAILED' &&
          payStatus !== 'REFUNDED';
        return isConfirmedOrPaid && notCancelledOrReturned;
      });

      let confirmedCount = 0;
      let grossSpend = 0;
      let totalDiscounts = 0;
      let totalRefundsDeducted = 0;
      let totalNetPurchaseValue = 0;
      let hasSingleOrderReaching5k = false;
      let latestPurchaseDate = null as Date | null;
      let isDiscoveryBuyer = false;
      let isSignatureBuyer = false;
      let isDevotionalBuyer = false;
      const couponsUsedSet = new Set<string>();
      const productFrequencyMap: Record<string, number> = {};

      const enrichedOrderHistory = matchingOrders.map((ord) => {
        const refundDeduction = refundMap.get(ord.id) || 0;
        const ordDiscount = Number(ord.discount) || 0;
        const ordSubtotal = Number(ord.subtotal) || Number(ord.totalAmount) || 0;
        const isQualifying = qualifyingOrders.some((q) => q.id === ord.id);
        const netOrderSpend = isQualifying
          ? Math.max(0, Math.floor(Number(ord.totalAmount) - refundDeduction))
          : 0;

        if (ord.couponCode) {
          couponsUsedSet.add(String(ord.couponCode).toUpperCase());
        }

        const itemsList: any[] = Array.isArray(ord.items) ? ord.items : [];
        for (const item of itemsList) {
          const pName = String(item.productName || '').toUpperCase();
          const pSku = String(item.sku || '').toUpperCase();
          const pSize = String(item.size || '').toLowerCase();
          if (pName) {
            productFrequencyMap[pName] = (productFrequencyMap[pName] || 0) + (Number(item.quantity) || 1);
          }
          if (isQualifying && netOrderSpend > 0) {
            if (pName.includes('DISCOVERY') || pSku.includes('DISC') || pSize.includes('2ml')) {
              isDiscoveryBuyer = true;
            }
            if (SIGNATURE_KEYWORDS.some((kw) => pName.includes(kw))) {
              isSignatureBuyer = true;
            }
            if (DEVOTIONAL_KEYWORDS.some((kw) => pName.includes(kw))) {
              isDevotionalBuyer = true;
            }
          }
        }

        if (isQualifying && netOrderSpend > 0) {
          confirmedCount++;
          grossSpend += ordSubtotal;
          totalDiscounts += ordDiscount;
          totalRefundsDeducted += refundDeduction;
          totalNetPurchaseValue += netOrderSpend;

          // VIP RULE: Automatically assign VIP status when cumulative qualifying completed purchases reach ₹5,000,
          // OR one qualifying completed order reaches ₹5,000 (using net eligible purchase value after discounts and refunds)
          if (netOrderSpend >= 5000) {
            hasSingleOrderReaching5k = true;
          }

          if (ord.createdAt) {
            const d = new Date(ord.createdAt);
            if (!latestPurchaseDate || d > latestPurchaseDate) {
              latestPurchaseDate = d;
            }
          }
        }

        return {
          id: ord.id,
          orderNumber: ord.orderNumber,
          createdAt: ord.createdAt,
          orderStatus: ord.orderStatus,
          paymentStatus: ord.paymentStatus,
          paymentMethod: ord.paymentMethod,
          subtotal: ordSubtotal,
          discount: ordDiscount,
          refundedAmount: refundDeduction,
          totalAmount: ord.totalAmount,
          netEligibleValue: netOrderSpend,
          couponCode: ord.couponCode,
          items: itemsList
        };
      });

      // Check existing tags for devotional / discovery affinity as well
      const rawTags: string[] = Array.isArray(cust.tags) ? (cust.tags as string[]) : [];
      if (rawTags.some((t) => t.toLowerCase().includes('devotional'))) {
        isDevotionalBuyer = true;
      }
      if (rawTags.some((t) => t.toLowerCase().includes('discovery'))) {
        isDiscoveryBuyer = true;
      }

      // VIP RULE EVALUATION (Recalculated dynamically after discounts, refunds & cancellations)
      const isVip = hasSingleOrderReaching5k || totalNetPurchaseValue >= 5000;
      const vipQualificationReason = isVip
        ? hasSingleOrderReaching5k
          ? 'Single qualifying completed order reached ₹5,000+ (net of discounts & refunds)'
          : 'Cumulative qualifying completed purchases reached ₹5,000+ (net of discounts & refunds)'
        : `₹${Math.max(0, 5000 - totalNetPurchaseValue).toLocaleString('en-IN')} away from ₹5,000 VIP threshold`;

      let classification: 'NEW' | 'CUSTOMER' | 'VIP';
      if (isVip) {
        classification = 'VIP';
      } else if (confirmedCount === 0 || totalNetPurchaseValue === 0) {
        classification = 'NEW';
      } else {
        classification = 'CUSTOMER';
      }

      const regDateObj = cust.createdAt ? new Date(cust.createdAt) : new Date();
      const daysSinceRegistration = Math.max(
        0,
        Math.floor((nowMs - regDateObj.getTime()) / (1000 * 60 * 60 * 24))
      );
      const daysSinceLastOrder = latestPurchaseDate
        ? Math.max(0, Math.floor((nowMs - latestPurchaseDate.getTime()) / (1000 * 60 * 60 * 24)))
        : 999;

      // Customer events from automation_events
      const customerEvents = allEvents.filter((ev) => {
        const evEmail = (ev.customerEmail || (ev.payload as any)?.customerEmail || '')
          .trim()
          .toLowerCase();
        const evCustId = String((ev.payload as any)?.customerId || ev.entityId || '').trim();
        return (custEmail && evEmail === custEmail) || (custId && evCustId === custId);
      });

      // Customer jobs / active workflows from automation_jobs
      const customerJobs = allJobs.filter((jb) => {
        const jbEmail = (jb.customerEmail || '').trim().toLowerCase();
        return custEmail && jbEmail === custEmail;
      });

      // Customer abandoned carts
      const customerCarts = allCarts.filter(
        (c) => custEmail && (c.customerEmail || '').trim().toLowerCase() === custEmail
      );
      const hasAbandonedCheckout =
        customerCarts.some((c) => String(c.status).toUpperCase() === 'ABANDONED') ||
        (confirmedCount === 0 &&
          customerEvents.some(
            (e) => e.eventType === 'checkout.started' || e.eventType === 'cart.abandoned'
          ));

      // Customer returns & complaints
      const customerReturns = allRefunds.filter((r) => {
        const matchesOrder = matchingOrders.some((o) => o.id === r.orderId || o.orderNumber === r.orderNumber);
        const matchesName =
          cust.name && r.customerName && r.customerName.toLowerCase() === cust.name.toLowerCase();
        return matchesOrder || matchesName;
      });
      const supportIssuesList: any[] = [
        ...(Array.isArray(crmMeta.supportIssues) ? crmMeta.supportIssues : []),
        ...customerReturns.map((r) => ({
          id: r.id,
          type: 'RETURN_REFUND',
          orderNumber: r.orderNumber,
          reason: r.reason,
          amount: r.refundAmount,
          status: r.status,
          createdAt: r.createdAt
        }))
      ];
      const hasUnresolvedComplaints = supportIssuesList.some((iss) => {
        const st = String(iss.status || '').toUpperCase();
        return st !== 'REFUNDED' && st !== 'RESOLVED' && st !== 'CLOSED' && st !== 'REJECTED';
      });

      // Customer reviews
      const customerReviews = allReviews.filter(
        (rv) =>
          (cust.name && rv.authorName && rv.authorName.toLowerCase() === cust.name.toLowerCase()) ||
          customerEvents.some((e) => e.eventType === 'review.submitted' && (e.payload as any)?.reviewId === rv.id)
      );

      // Unused vouchers calculation
      const issuedVouchers: string[] = Array.isArray(crmMeta.issuedVouchers)
        ? crmMeta.issuedVouchers
        : [];
      const allEligibleVouchers = Array.from(new Set([...activeCouponCodes, ...issuedVouchers]));
      const unusedVouchers = allEligibleVouchers.filter((code) => !couponsUsedSet.has(code));

      // ==========================================================
      // COMPUTE ALL 14 REQUIRED DYNAMIC CUSTOMER SEGMENTS
      // ==========================================================
      const dynamicSegments: string[] = [];

      // 1. New registered customers
      if (confirmedCount === 0 || daysSinceRegistration <= 30) {
        dynamicSegments.push('New registered customers');
      }
      // 2. Visitors without purchases
      if (confirmedCount === 0) {
        dynamicSegments.push('Visitors without purchases');
      }
      // 3. First-time buyers
      if (confirmedCount === 1) {
        dynamicSegments.push('First-time buyers');
      }
      // 4. Repeat buyers
      if (confirmedCount >= 2) {
        dynamicSegments.push('Repeat buyers');
      }
      // 5. High-value customers
      const aov = confirmedCount > 0 ? Math.round(totalNetPurchaseValue / confirmedCount) : 0;
      if (totalNetPurchaseValue >= 3500 || aov >= 2500) {
        dynamicSegments.push('High-value customers');
      }
      // 6. VIP customers (Net qualifying spend >= ₹5,000 or single qualifying order >= ₹5,000)
      if (isVip) {
        dynamicSegments.push('VIP customers');
      }
      // 7. Discovery buyers
      if (isDiscoveryBuyer) {
        dynamicSegments.push('Discovery buyers');
      }
      // 8. Signature fragrance buyers
      if (isSignatureBuyer) {
        dynamicSegments.push('Signature fragrance buyers');
      }
      // 9. Devotional fragrance buyers
      if (isDevotionalBuyer) {
        dynamicSegments.push('Devotional fragrance buyers');
      }
      // 10. Inactive customers (45 / 60 / 90 days without purchase)
      const isInactive =
        (confirmedCount > 0 && daysSinceLastOrder >= 45) ||
        (confirmedCount === 0 && daysSinceRegistration >= 45);
      if (isInactive || crmMeta.inactiveDaysOverride >= 45) {
        dynamicSegments.push('Inactive customers');
      }
      // 11. Abandoned checkout customers
      if (hasAbandonedCheckout) {
        dynamicSegments.push('Abandoned checkout customers');
      }
      // 12. Customers eligible for replenishment
      if ((confirmedCount > 0 && daysSinceLastOrder >= 30) || crmMeta.replenishmentEligible) {
        dynamicSegments.push('Customers eligible for replenishment');
      }
      // 13. Customers with unresolved complaints
      if (hasUnresolvedComplaints) {
        dynamicSegments.push('Customers with unresolved complaints');
      }
      // 14. Customers with unused vouchers
      if (unusedVouchers.length > 0) {
        dynamicSegments.push('Customers with unused vouchers');
      }

      // Determine top favourite fragrance from actual orders if available, otherwise stored preference
      const sortedBoughtProducts = Object.entries(productFrequencyMap).sort((a, b) => b[1] - a[1]);
      const resolvedFavouriteFragrance =
        sortedBoughtProducts.length > 0
          ? sortedBoughtProducts[0][0]
          : cust.favouriteFragrance || null;

      // Communication Consent & Rules state
      const consentConfig = {
        emailTransactional: true,
        whatsappTransactional: true,
        smsTransactional: true,
        emailPromotional: crmMeta.consent?.emailPromotional ?? true,
        whatsappPromotional: crmMeta.consent?.whatsappPromotional ?? true,
        smsPromotional: crmMeta.consent?.smsPromotional ?? false,
        marketingOptIn: crmMeta.consent?.marketingOptIn ?? true,
        unsubscribed: Boolean(crmMeta.consent?.unsubscribed),
        unsubscribedAt: crmMeta.consent?.unsubscribedAt || null,
        quietHours: '22:00 – 09:00 IST',
        frequencyCapPerWeek: crmMeta.consent?.frequencyCapPerWeek ?? 3
      };

      // Communication timeline (combine stored communicationHistory + automation job step logs)
      const storedComms: any[] = Array.isArray(cust.communicationHistory)
        ? (cust.communicationHistory as any[])
        : [];
      const jobComms: any[] = [];
      for (const jb of customerJobs) {
        const sLogs: any[] = Array.isArray(jb.stepLogs) ? (jb.stepLogs as any[]) : [];
        for (const sl of sLogs) {
          if (
            sl.nodeSubtype === 'action.send_whatsapp' ||
            sl.nodeSubtype === 'action.send_transactional_email' ||
            sl.nodeSubtype === 'action.send_marketing_email' ||
            sl.nodeSubtype === 'action.send_sms'
          ) {
            const isPromo = sl.nodeSubtype === 'action.send_marketing_email' || sl.output?.category === 'PROMOTIONAL';
            jobComms.push({
              id: `${jb.id}-${sl.nodeId}`,
              date: sl.completedAt ? String(sl.completedAt).split('T')[0] : new Date(jb.createdAt).toISOString().split('T')[0],
              timestamp: sl.completedAt || jb.createdAt,
              channel: String(sl.output?.channel || 'EMAIL').toUpperCase(),
              category: isPromo ? 'PROMOTIONAL' : 'TRANSACTIONAL',
              subject: `${jb.workflowName}: ${sl.nodeLabel}`,
              template: sl.output?.template || sl.nodeLabel,
              status: sl.status === 'SUCCESS' ? 'SENT' : sl.status
            });
          }
        }
      }
      const unifiedCommTimeline = [
        ...jobComms,
        ...storedComms.map((c) => ({
          ...c,
          category: c.category || 'TRANSACTIONAL',
          timestamp: c.timestamp || c.date
        }))
      ];

      // Loyalty benefits
      const loyaltyBenefits: string[] = [];
      if (isVip) {
        loyaltyBenefits.push('VIP Private Atelier Concierge & Priority Allocation');
        loyaltyBenefits.push('Complimentary Artisanal Engraving & Gift Wrapping');
      }
      if (confirmedCount >= 2) {
        loyaltyBenefits.push('Repeat Connoisseur Loyalty Privilege');
      }
      if (isDiscoveryBuyer) {
        loyaltyBenefits.push('Discovery Set Bounce-Back Credit Eligibility');
      }
      if (crmMeta.birthday) {
        loyaltyBenefits.push(`Birthday Connoisseur Gift (${crmMeta.birthday})`);
      }

      // First visit, latest visit, and last activity
      const firstVisitAt =
        crmMeta.firstVisitAt ||
        (customerEvents.length > 0
          ? customerEvents[customerEvents.length - 1].createdAt
          : cust.createdAt);
      const latestVisitAt =
        crmMeta.lastVisitAt ||
        (customerEvents.length > 0 ? customerEvents[0].createdAt : latestPurchaseDate || cust.createdAt);
      const lastActivityEvent =
        customerEvents[0]?.eventType ||
        (confirmedCount > 0 ? 'order.placed' : 'customer.registered');

      const formattedLastPurchase =
        confirmedCount > 0 && latestPurchaseDate
          ? latestPurchaseDate.toISOString().split('T')[0]
          : 'No purchases yet';

      const accountCreationDate = cust.createdAt
        ? new Date(cust.createdAt).toISOString().split('T')[0]
        : '2026-10-01';

      const failedPaymentsCount =
        matchingOrders.filter((o) => String(o.paymentStatus).toUpperCase() === 'FAILED').length +
        customerEvents.filter((e) => e.eventType === 'payment.failed').length;

      return {
        id: cust.id,
        name: cust.name || '',
        email: cust.email || '',
        phone: cust.phone && cust.phone.trim() ? cust.phone.trim() : null,
        city: cust.city || (matchingOrders[0]?.shippingAddress as any)?.city || null,
        state: cust.state || (matchingOrders[0]?.shippingAddress as any)?.state || null,
        tier: isVip ? 'VIP' : confirmedCount >= 2 ? 'Gold' : 'Silver',
        tags: dynamicSegments,
        segments: dynamicSegments,
        dynamicSegments,
        createdAt: cust.createdAt,
        accountCreationDate,
        registeredDate: accountCreationDate,
        classification,
        isVip,
        vipQualificationReason,
        confirmedOrdersCount: confirmedCount,
        ordersCount: confirmedCount,
        grossSpend: Math.floor(grossSpend),
        totalDiscounts: Math.floor(totalDiscounts),
        totalRefunds: Math.floor(totalRefundsDeducted),
        totalPurchaseValue: Math.floor(totalNetPurchaseValue),
        totalSpend: Math.floor(totalNetPurchaseValue),
        aov,
        lastPurchaseDate: formattedLastPurchase,
        lastOrderDate: formattedLastPurchase,
        daysSinceLastOrder,
        favouriteFragrance: resolvedFavouriteFragrance || 'Not specified',
        isDiscoveryBuyer,
        isSignatureBuyer,
        isDevotionalBuyer,
        source: cust.source || 'Direct Registration',
        influencer: cust.influencer || null,
        utmSource: cust.utmSource || (matchingOrders[0]?.attribution as any)?.utm_source || null,
        utmCampaign: cust.utmCampaign || (matchingOrders[0]?.attribution as any)?.utm_campaign || null,
        notes: cust.notes || null,
        addresses: Array.isArray(cust.addresses) ? cust.addresses : [],
        wishlistSlugs: Array.isArray(cust.wishlistSlugs) ? cust.wishlistSlugs : [],
        reviewsCount: customerReviews.length,
        abandonedCartsCount: customerCarts.length,
        couponsUsed: Array.from(couponsUsedSet),
        unusedVouchers,
        communicationHistory: unifiedCommTimeline,
        crmMetadata: {
          ...crmMeta,
          verifiedEmail: crmMeta.verifiedEmail ?? Boolean(custEmail),
          verifiedPhone: crmMeta.verifiedPhone ?? Boolean(custPhone.length >= 10),
          birthday: crmMeta.birthday || null,
          firstVisitAt,
          latestVisitAt,
          lastActivityEvent,
          consent: consentConfig,
          loyaltyBenefits,
          supportIssues: supportIssuesList,
          productViewsCount:
            customerEvents.filter((e) => e.eventType === 'product.viewed').length ||
            (Array.isArray(crmMeta.viewedProducts) ? crmMeta.viewedProducts.length : 0),
          wishlistUpdatesCount:
            customerEvents.filter((e) => e.eventType === 'wishlist.updated').length +
            (Array.isArray(cust.wishlistSlugs) ? cust.wishlistSlugs.length : 0),
          addToCartCount:
            customerEvents.filter((e) => e.eventType === 'product.added_to_cart').length +
            customerCarts.length,
          checkoutAttemptsCount:
            customerEvents.filter((e) => e.eventType === 'checkout.started').length +
            matchingOrders.length,
          failedPaymentsCount
        },
        customer360: {
          orderHistory: enrichedOrderHistory,
          eventsTimeline: customerEvents.slice(0, 30),
          activeWorkflows: customerJobs.slice(0, 20),
          supportIssues: supportIssuesList,
          loyaltyBenefits,
          consent: consentConfig,
          consentStatus: consentConfig,
          unusedVouchers,
          redeemedCoupons: Array.from(couponsUsedSet)
        }
      };
    });
  } catch (error) {
    console.error('Failed to calculate admin customer analytics:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export const DYNAMIC_CUSTOMER_SEGMENTS = [
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
] as const;

export async function recalculateCustomerLifecycleState(
  identifier?:
    | string
    | {
        customerId?: string;
        email?: string;
        orderId?: string;
      }
) {
  try {
    const analytics = await getAdminCustomerAnalytics();
    const idObj =
      typeof identifier === 'string'
        ? {
            customerId: identifier,
            email: identifier,
            orderId: identifier
          }
        : identifier;

    const target = analytics.find((c) => {
      if (idObj?.customerId && c.id === idObj.customerId) return true;
      if (idObj?.email && c.email && c.email.toLowerCase() === idObj.email.toLowerCase()) return true;
      if (
        idObj?.orderId &&
        c.customer360?.orderHistory?.some((o: any) => o.id === idObj.orderId)
      ) {
        return true;
      }
      return false;
    });

    if (!target || !target.email) return null;

    await upsertCustomer({
      id: target.id,
      name: target.name,
      email: target.email,
      phone: target.phone || '',
      city: target.city,
      state: target.state,
      tier: target.isVip ? 'VIP' : target.confirmedOrdersCount >= 2 ? 'Gold' : 'Silver',
      tags: target.dynamicSegments,
      totalOrders: target.confirmedOrdersCount,
      totalSpend: target.totalPurchaseValue,
      crmMetadata: target.crmMetadata
    });

    return {
      ...target,
      qualifyingCount: target.confirmedOrdersCount,
      netSpend: target.totalPurchaseValue
    };
  } catch (err) {
    console.warn('[CRM Recalculate Notice]:', err);
    return null;
  }
}

export async function upsertCustomer(customerData: any) {
  try {
    const conditions = [];
    if (customerData.id) conditions.push(eq(customers.id, customerData.id));
    if (customerData.email && customerData.email.trim()) conditions.push(eq(customers.email, customerData.email.trim()));
    if (customerData.phone && customerData.phone.trim()) conditions.push(eq(customers.phone, customerData.phone.trim()));

    const existing = conditions.length > 0
      ? await db
          .select()
          .from(customers)
          .where(conditions.length === 1 ? conditions[0] : or(...conditions))
          .limit(1)
      : [];

    const safeTags = Array.isArray(customerData.tags)
      ? customerData.tags
      : Array.isArray(customerData.segments)
      ? customerData.segments
      : existing[0]?.tags || ['New registered customers'];

    const safeOrders =
      customerData.totalOrders !== undefined
        ? Number(customerData.totalOrders)
        : customerData.ordersCount !== undefined
        ? Number(customerData.ordersCount)
        : existing[0]?.totalOrders || 0;

    const safeSpend =
      customerData.totalSpend !== undefined
        ? Number(customerData.totalSpend)
        : existing[0]?.totalSpend || 0;

    const safeAddresses = Array.isArray(customerData.addresses)
      ? customerData.addresses
      : existing[0]?.addresses || [];

    const safeComm = Array.isArray(customerData.communicationHistory)
      ? customerData.communicationHistory
      : existing[0]?.communicationHistory || [];

    const safeWishlist = Array.isArray(customerData.wishlistSlugs)
      ? customerData.wishlistSlugs
      : existing[0]?.wishlistSlugs || [];

    const existingMeta: Record<string, any> =
      existing[0]?.crmMetadata && typeof existing[0].crmMetadata === 'object'
        ? (existing[0].crmMetadata as Record<string, any>)
        : {};
    const incomingMeta: Record<string, any> =
      customerData.crmMetadata && typeof customerData.crmMetadata === 'object'
        ? customerData.crmMetadata
        : {};
    const mergedCrmMetadata = {
      ...existingMeta,
      ...incomingMeta,
      lastVisitAt: incomingMeta.lastVisitAt || existingMeta.lastVisitAt || new Date().toISOString(),
      firstVisitAt: existingMeta.firstVisitAt || incomingMeta.firstVisitAt || new Date().toISOString()
    };

    // Never fabricate missing customer names, mobile numbers or email addresses
    const cleanName =
      customerData.name !== undefined
        ? String(customerData.name).trim()
        : existing[0]?.name ?? '';
    const cleanEmail =
      customerData.email !== undefined
        ? String(customerData.email).trim()
        : existing[0]?.email ?? '';
    const cleanPhone =
      customerData.phone !== undefined
        ? String(customerData.phone || '').trim()
        : existing[0]?.phone ?? '';

    if (existing.length > 0) {
      const targetId = existing[0].id;
      const result = await db
        .update(customers)
        .set({
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          city: customerData.city !== undefined ? customerData.city : existing[0].city,
          state: customerData.state !== undefined ? customerData.state : existing[0].state,
          tier: customerData.tier || existing[0].tier || 'Silver',
          tags: safeTags,
          totalOrders: safeOrders,
          totalSpend: safeSpend,
          addresses: safeAddresses,
          notes: customerData.notes !== undefined ? customerData.notes : existing[0].notes,
          favouriteFragrance:
            customerData.favouriteFragrance !== undefined
              ? customerData.favouriteFragrance
              : existing[0].favouriteFragrance,
          source: customerData.source || existing[0].source || 'Direct Registration',
          influencer:
            customerData.influencer !== undefined
              ? customerData.influencer
              : existing[0].influencer || null,
          utmSource:
            customerData.utmSource !== undefined
              ? customerData.utmSource
              : existing[0].utmSource || null,
          utmCampaign:
            customerData.utmCampaign !== undefined
              ? customerData.utmCampaign
              : existing[0].utmCampaign || null,
          communicationHistory: safeComm,
          wishlistSlugs: safeWishlist,
          crmMetadata: mergedCrmMetadata
        })
        .where(eq(customers.id, targetId))
        .returning();
      return result[0];
    } else {
      const newId = customerData.id || 'cust-' + Math.random().toString(36).substring(2, 8);
      const result = await db
        .insert(customers)
        .values({
          id: newId,
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          city: customerData.city || null,
          state: customerData.state || null,
          tier: customerData.tier || 'Silver',
          tags: safeTags,
          totalOrders: safeOrders,
          totalSpend: safeSpend,
          addresses: safeAddresses,
          notes: customerData.notes || null,
          favouriteFragrance: customerData.favouriteFragrance || null,
          source: customerData.source || 'Direct Registration',
          influencer: customerData.influencer || null,
          utmSource: customerData.utmSource || null,
          utmCampaign: customerData.utmCampaign || null,
          communicationHistory: safeComm,
          wishlistSlugs: safeWishlist,
          crmMetadata: mergedCrmMetadata
        })
        .returning();
      return result[0];
    }
  } catch (error) {
    console.error('Failed to upsert customer:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function deleteCustomerById(id: string) {
  try {
    return await db.delete(customers).where(eq(customers.id, id)).returning();
  } catch (error) {
    console.error('Failed to delete customer:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// ==========================================
// REVIEWS
// ==========================================
export async function getAllReviews() {
  try {
    return await db.select().from(reviews).orderBy(desc(reviews.createdAt));
  } catch (error) {
    console.error('Failed to get reviews:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function insertReview(reviewData: any) {
  try {
    const result = await db.insert(reviews)
      .values({
        id: reviewData.id,
        productId: reviewData.productId || null,
        productSlug: reviewData.productSlug,
        authorName: reviewData.authorName,
        rating: reviewData.rating,
        title: reviewData.title,
        comment: reviewData.comment,
        verified: reviewData.verified ?? true,
        helpfulCount: reviewData.helpfulCount || 0,
        status: reviewData.status || 'approved',
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error('Failed to insert review:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function deleteReviewById(id: string) {
  try {
    return await db.delete(reviews).where(eq(reviews.id, id)).returning();
  } catch (error) {
    console.error('Failed to delete review:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// ==========================================
// COUPONS
// ==========================================
export async function getAllCoupons() {
  try {
    return await db.select().from(coupons).orderBy(desc(coupons.createdAt));
  } catch (error) {
    console.error('Failed to get coupons:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function upsertCoupon(couponData: any) {
  try {
    const existing = await db.select().from(coupons).where(eq(coupons.code, couponData.code)).limit(1);
    if (existing.length > 0) {
      const result = await db.update(coupons)
        .set({
          discountType: couponData.discountType,
          value: couponData.value,
          minOrderValue: couponData.minOrderValue || 0,
          maxDiscount: couponData.maxDiscount || null,
          expiryDate: couponData.expiryDate || null,
          usageLimit: couponData.usageLimit || null,
          usageCount: couponData.usageCount || 0,
          isActive: couponData.isActive ?? true,
          description: couponData.description || null,
        })
        .where(eq(coupons.code, couponData.code))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(coupons)
        .values({
          code: couponData.code,
          discountType: couponData.discountType,
          value: couponData.value,
          minOrderValue: couponData.minOrderValue || 0,
          maxDiscount: couponData.maxDiscount || null,
          expiryDate: couponData.expiryDate || null,
          usageLimit: couponData.usageLimit || null,
          usageCount: couponData.usageCount || 0,
          isActive: couponData.isActive ?? true,
          description: couponData.description || null,
        })
        .returning();
      return result[0];
    }
  } catch (error) {
    console.error('Failed to upsert coupon:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function deleteCouponByCode(code: string) {
  try {
    return await db.delete(coupons).where(eq(coupons.code, code)).returning();
  } catch (error) {
    console.error('Failed to delete coupon:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// ==========================================
// INFLUENCERS
// ==========================================
export async function getAllInfluencers() {
  try {
    return await db.select().from(influencers).orderBy(desc(influencers.createdAt));
  } catch (error) {
    console.error('Failed to get influencers:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function upsertInfluencer(influencerData: any) {
  try {
    const existing = await db.select().from(influencers).where(eq(influencers.id, influencerData.id)).limit(1);
    if (existing.length > 0) {
      const result = await db.update(influencers)
        .set({
          name: influencerData.name,
          handle: influencerData.handle,
          platform: influencerData.platform,
          referralCode: influencerData.referralCode,
          commissionRate: influencerData.commissionRate,
          totalRevenue: influencerData.totalRevenue || 0,
          clicks: influencerData.clicks || 0,
          ordersCount: influencerData.ordersCount || 0,
          status: influencerData.status || 'active',
        })
        .where(eq(influencers.id, influencerData.id))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(influencers)
        .values({
          id: influencerData.id,
          name: influencerData.name,
          handle: influencerData.handle,
          platform: influencerData.platform,
          referralCode: influencerData.referralCode,
          commissionRate: influencerData.commissionRate,
          totalRevenue: influencerData.totalRevenue || 0,
          clicks: influencerData.clicks || 0,
          ordersCount: influencerData.ordersCount || 0,
          status: influencerData.status || 'active',
        })
        .returning();
      return result[0];
    }
  } catch (error) {
    console.error('Failed to upsert influencer:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function deleteInfluencerById(id: string) {
  try {
    return await db.delete(influencers).where(eq(influencers.id, id)).returning();
  } catch (error) {
    console.error('Failed to delete influencer:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// ==========================================
// ABANDONED CARTS
// ==========================================
export async function getAllAbandonedCarts() {
  try {
    return await db.select().from(abandonedCarts).orderBy(desc(abandonedCarts.createdAt));
  } catch (error) {
    console.error('Failed to get abandoned carts:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function upsertAbandonedCart(cartData: any) {
  try {
    const existing = await db.select().from(abandonedCarts).where(eq(abandonedCarts.id, cartData.id)).limit(1);
    if (existing.length > 0) {
      const result = await db.update(abandonedCarts)
        .set({
          customerEmail: cartData.customerEmail,
          customerPhone: cartData.customerPhone,
          customerName: cartData.customerName || null,
          items: cartData.items,
          cartValue: cartData.cartValue,
          couponCode: cartData.couponCode || null,
          lastActivity: new Date(),
          status: cartData.status || 'ABANDONED',
          recoveredAt: cartData.recoveredAt ? new Date(cartData.recoveredAt) : null,
          attribution: cartData.attribution || null,
          recoverySentEmail: cartData.recoverySentEmail ?? false,
          recoverySentWhatsApp: cartData.recoverySentWhatsApp ?? false,
          recoverySentSMS: cartData.recoverySentSMS ?? false,
        })
        .where(eq(abandonedCarts.id, cartData.id))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(abandonedCarts)
        .values({
          id: cartData.id,
          customerEmail: cartData.customerEmail,
          customerPhone: cartData.customerPhone,
          customerName: cartData.customerName || null,
          items: cartData.items,
          cartValue: cartData.cartValue,
          couponCode: cartData.couponCode || null,
          lastActivity: new Date(),
          status: cartData.status || 'ABANDONED',
          recoveredAt: cartData.recoveredAt ? new Date(cartData.recoveredAt) : null,
          attribution: cartData.attribution || null,
          recoverySentEmail: cartData.recoverySentEmail ?? false,
          recoverySentWhatsApp: cartData.recoverySentWhatsApp ?? false,
          recoverySentSMS: cartData.recoverySentSMS ?? false,
        })
        .returning();
      return result[0];
    }
  } catch (error) {
    console.error('Failed to upsert abandoned cart:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function deleteAbandonedCartById(id: string) {
  try {
    return await db.delete(abandonedCarts).where(eq(abandonedCarts.id, id)).returning();
  } catch (error) {
    console.error('Failed to delete abandoned cart:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// ==========================================
// CMS SETTINGS
// ==========================================
function sanitizeCmsObject(raw: any): any {
  if (!raw || typeof raw !== 'object') return raw;
  const clone = { ...raw };
  const legacyRegex = /memories\s*(?:and|&)\s*health|scents\s+that\s+stay\s+with\s+you/gi;
  const hpRegex = /\bhaute\s+parfumerie\b\s*·?\s*/gi;
  for (const key of Object.keys(clone)) {
    if (typeof clone[key] === 'string') {
      if (legacyRegex.test(clone[key])) {
        clone[key] = clone[key].replace(legacyRegex, 'Scent That Stays With You');
      }
      if (hpRegex.test(clone[key])) {
        clone[key] = clone[key].replace(hpRegex, '').trim();
      }
    }
  }
  if (typeof clone.heroHeadline === 'string' && /memories\s*(?:and|&)\s*health|scent/i.test(clone.heroHeadline)) {
    clone.heroHeadline = 'SCENT THAT STAYS WITH YOU.';
  }
  return clone;
}

export async function getCMSSettings() {
  try {
    const result = await db.select().from(cmsSettings).where(eq(cmsSettings.id, 'current')).limit(1);
    const settings = result[0]?.settings || null;
    return settings ? sanitizeCmsObject(settings) : null;
  } catch (error) {
    console.error('Failed to get CMS settings:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function updateCMSSettings(settingsData: any) {
  try {
    const existing = await db.select().from(cmsSettings).where(eq(cmsSettings.id, 'current')).limit(1);
    if (existing.length > 0) {
      const result = await db.update(cmsSettings)
        .set({
          settings: settingsData,
          updatedAt: new Date(),
        })
        .where(eq(cmsSettings.id, 'current'))
        .returning();
      return result[0].settings;
    } else {
      const result = await db.insert(cmsSettings)
        .values({
          id: 'current',
          settings: settingsData,
        })
        .returning();
      return result[0].settings;
    }
  } catch (error) {
    console.error('Failed to update CMS settings:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// ==========================================
// AUDIT LOGS
// ==========================================
export async function getAllAuditLogs() {
  try {
    return await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(100);
  } catch (error) {
    console.error('Failed to get audit logs:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function insertAuditLog(logData: any) {
  try {
    const result = await db.insert(auditLogs)
      .values({
        id: logData.id || `audit-${Date.now()}`,
        action: logData.action,
        adminEmail: logData.adminEmail,
        details: logData.details || null,
        metadata: logData.metadata || null,
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error('Failed to insert audit log:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// ==========================================
// CAMPAIGNS, RETURNS & BACK IN STOCK
// ==========================================
export async function getAllCampaigns() {
  try {
    return await db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
  } catch (error) {
    console.error('Failed to get campaigns:', error);
    return [];
  }
}

export async function upsertCampaign(campData: any) {
  try {
    const existing = await db.select().from(campaigns).where(eq(campaigns.id, campData.id)).limit(1);
    if (existing.length > 0) {
      const result = await db.update(campaigns)
        .set({
          name: campData.name,
          channel: campData.channel || campData.type || 'EMAIL',
          budget: Number(campData.budget) || 0,
          spend: Number(campData.spend) || 0,
          revenue: Number(campData.revenueGenerated ?? campData.revenue) || 0,
          status: campData.status || 'ACTIVE',
          startDate: campData.scheduledDate || campData.startDate || null,
          endDate: campData.endDate || null,
        })
        .where(eq(campaigns.id, campData.id))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(campaigns)
        .values({
          id: campData.id,
          name: campData.name,
          channel: campData.channel || campData.type || 'EMAIL',
          budget: Number(campData.budget) || 0,
          spend: Number(campData.spend) || 0,
          revenue: Number(campData.revenueGenerated ?? campData.revenue) || 0,
          status: campData.status || 'ACTIVE',
          startDate: campData.scheduledDate || campData.startDate || null,
          endDate: campData.endDate || null,
        })
        .returning();
      return result[0];
    }
  } catch (error) {
    console.error('Failed to upsert campaign:', error);
    throw new Error('Database query failed.', { cause: error });
  }
}

export async function deleteCampaignById(id: string) {
  try {
    return await db.delete(campaigns).where(eq(campaigns.id, id)).returning();
  } catch (error) {
    console.error('Failed to delete campaign:', error);
    throw new Error('Database query failed.', { cause: error });
  }
}

export async function getAllReturns() {
  try {
    return await db.select().from(returnsRefunds).orderBy(desc(returnsRefunds.createdAt));
  } catch (error) {
    console.error('Failed to get returns:', error);
    return [];
  }
}

export async function upsertReturn(retData: any) {
  try {
    const existing = await db.select().from(returnsRefunds).where(eq(returnsRefunds.id, retData.id)).limit(1);
    if (existing.length > 0) {
      const result = await db.update(returnsRefunds)
        .set({
          status: retData.status || 'PENDING',
          refundAmount: Number(retData.refundAmount) || 0,
          reason: retData.reason || '',
          items: retData.items || [{ productName: retData.productName, size: retData.size, quantity: retData.quantity, restockInventory: retData.restockInventory }],
        })
        .where(eq(returnsRefunds.id, retData.id))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(returnsRefunds)
        .values({
          id: retData.id,
          orderId: retData.orderId || retData.orderNumber || 'ord-unknown',
          orderNumber: retData.orderNumber || 'FRG-0000',
          customerName: retData.customerName || 'Valued Client',
          items: retData.items || [{ productName: retData.productName, size: retData.size, quantity: retData.quantity, restockInventory: retData.restockInventory }],
          reason: retData.reason || 'Customer return request',
          refundAmount: Number(retData.refundAmount) || 0,
          status: retData.status || 'PENDING',
        })
        .returning();
      return result[0];
    }
  } catch (error) {
    console.error('Failed to upsert return:', error);
    throw new Error('Database query failed.', { cause: error });
  }
}

export async function getAllBackInStock() {
  try {
    return await db.select().from(backInStock).orderBy(desc(backInStock.createdAt));
  } catch (error) {
    console.error('Failed to get back in stock:', error);
    return [];
  }
}

export async function upsertBackInStock(bisData: any) {
  try {
    const existing = await db.select().from(backInStock).where(eq(backInStock.id, bisData.id)).limit(1);
    if (existing.length > 0) {
      const result = await db.update(backInStock)
        .set({
          notified: bisData.status === 'NOTIFIED' || Boolean(bisData.notified),
        })
        .where(eq(backInStock.id, bisData.id))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(backInStock)
        .values({
          id: bisData.id,
          productSlug: bisData.productSlug || bisData.productName || bisData.productId || 'signature',
          variantSize: bisData.size || bisData.variantSize || '100 ml',
          customerEmail: bisData.customerEmail || '',
          notified: bisData.status === 'NOTIFIED' || Boolean(bisData.notified),
        })
        .returning();
      return result[0];
    }
  } catch (error) {
    console.error('Failed to upsert back in stock:', error);
    throw new Error('Database query failed.', { cause: error });
  }
}

export async function deleteBackInStockById(id: string) {
  try {
    return await db.delete(backInStock).where(eq(backInStock.id, id)).returning();
  } catch (error) {
    console.error('Failed to delete back in stock:', error);
    throw new Error('Database query failed.', { cause: error });
  }
}

// ==========================================
// SEEDING CLOUD SQL DATABASE
// ==========================================
export async function seedInitialDataIfEmpty() {
  try {
    const [existingProducts, existingCms] = await Promise.all([
      db.select().from(products),
      db.select().from(cmsSettings).where(eq(cmsSettings.id, 'current')).limit(1)
    ]);
    const currentCmsMeta = sanitizeCmsObject((existingCms[0]?.settings || {}) as any);
    if (
      existingProducts.length >= INITIAL_PRODUCTS.length &&
      currentCmsMeta.catalogueMigratedV2 &&
      currentCmsMeta.catalogueMigratedV3
    ) {
      return;
    }

    if (existingProducts.length === 0) {
      console.log('[Firestore] Seeding initial products...');
      for (const prod of INITIAL_PRODUCTS) {
        await upsertProduct(prod);
      }
    } else {
      // Idempotently insert any newly approved Signature or Aura Collection products that do not yet exist
      for (const prod of INITIAL_PRODUCTS) {
        const exists = existingProducts.some(p => p.id === prod.id || p.slug === prod.slug);
        if (!exists) {
          console.log(`[Firestore] Inserting approved catalogue product: ${prod.name} (${prod.slug})`);
          await upsertProduct(prod);
        }
      }
    }

    const currentCoupons = await db.select().from(coupons).limit(1);
    if (currentCoupons.length === 0) {
      console.log('[Cloud SQL] Seeding initial coupons...');
      for (const coup of INITIAL_COUPONS) {
        await upsertCoupon({
          code: coup.code,
          discountType: coup.discountType,
          value: coup.value,
          minOrderValue: coup.minCartValue || 0,
          maxDiscount: coup.maxDiscount || null,
          expiryDate: coup.expiryDate || null,
          usageLimit: coup.usageLimit || null,
          usageCount: coup.timesUsed || 0,
          isActive: coup.isActive ?? true,
          description: coup.description || null,
        });
      }
    }

    const currentInfluencers = await db.select().from(influencers).limit(1);
    if (currentInfluencers.length === 0) {
      console.log('[Cloud SQL] Seeding initial influencers...');
      for (const inf of INITIAL_INFLUENCERS) {
        await upsertInfluencer({
          id: inf.id,
          name: inf.name,
          handle: inf.name,
          platform: 'Instagram',
          referralCode: inf.code,
          commissionRate: inf.commissionPercentage,
          totalRevenue: inf.totalRevenue,
          clicks: inf.clicks,
          ordersCount: inf.orders,
          status: (inf.status || 'ACTIVE').toLowerCase(),
        });
      }
    }

    const currentReviews = await db.select().from(reviews).limit(1);
    if (currentReviews.length === 0) {
      console.log('[Cloud SQL] Seeding initial reviews...');
      for (const rev of INITIAL_REVIEWS) {
        await insertReview({
          id: rev.id,
          productId: rev.productId,
          productSlug: rev.productName.toLowerCase().replace(/\s+/g, '-'),
          authorName: rev.customerName,
          rating: rev.rating,
          title: rev.title,
          comment: rev.content,
          verified: rev.isVerifiedPurchase,
          helpfulCount: 5,
          status: rev.status.toLowerCase(),
        });
      }
    }

    const currentOrders = await db.select().from(orders).limit(1);
    if (currentOrders.length === 0) {
      console.log('[Cloud SQL] Seeding initial orders...');
      for (const ord of INITIAL_ORDERS) {
        await insertOrder(ord);
      }
    }

    const currentCustomers = await db.select().from(customers).limit(1);
    if (currentCustomers.length === 0) {
      console.log('[Cloud SQL] Seeding initial customers...');
      for (const cust of (INITIAL_CUSTOMERS as any[])) {
        await upsertCustomer({
          id: cust.id,
          name: cust.name,
          email: cust.email,
          phone: cust.phone,
          city: cust.shippingAddress?.city || 'Mumbai',
          state: cust.shippingAddress?.state || 'Maharashtra',
          tier: cust.segments?.includes('VIP') ? 'Gold' : 'Silver',
          tags: cust.segments || [],
          totalOrders: cust.ordersCount || 1,
          totalSpend: cust.totalSpend || 0,
          addresses: cust.shippingAddress ? [cust.shippingAddress] : [],
          notes: cust.notes || null,
        });
      }
    }

    const currentCms = await db.select().from(cmsSettings).limit(1);
    if (currentCms.length === 0) {
      console.log('[Cloud SQL] Seeding initial CMS settings...');
      await updateCMSSettings({ ...INITIAL_CMS, catalogueMigratedV2: true });
    } else {
      const cmsData = sanitizeCmsObject((currentCms[0]?.settings || {}) as any);
      if (!cmsData.catalogueMigratedV2 || !cmsData.catalogueMigratedV3) {
        console.log('[Cloud SQL] Running idempotent catalogue migration V3 (Archiving superseded fragrances, syncing taxonomy & sanitizing CMS)...');
        const supersededSlugs = ['azure', 'ignite', 'roselle', 'elan', 'suede', 'solara', 'aaradhya', 'samarpan', 'ananta'];
        const allProds = await db.select().from(products);
        for (const p of allProds) {
          if (supersededSlugs.includes(p.slug)) {
            const updatedVariants = Array.isArray(p.variants)
              ? p.variants.map((v: any) =>
                  String(v.size).trim().toLowerCase() === '10 ml'
                    ? { ...v, isAvailable: false }
                    : v
                )
              : p.variants;
            await db.update(products)
              .set({ status: 'ARCHIVED', variants: updatedVariants })
              .where(eq(products.id, p.id));
          } else {
            const approvedInit = INITIAL_PRODUCTS.find((ip) => ip.slug === p.slug);
            if (approvedInit) {
              await db.update(products)
                .set({
                  families: approvedInit.families,
                  occasions: approvedInit.occasions
                })
                .where(eq(products.id, p.id));
            }
          }
        }
        await updateCMSSettings({
          ...INITIAL_CMS,
          ...cmsData,
          heroHeadline:
            !cmsData.heroHeadline || /memories\s*(?:and|&)\s*health|scents\s+that\s+stay\s+with\s+you/i.test(cmsData.heroHeadline)
              ? 'SCENT THAT STAYS WITH YOU.'
              : cmsData.heroHeadline,
          fragranceDisplayOrder: INITIAL_CMS.fragranceDisplayOrder,
          scrollStoryFragrances: INITIAL_CMS.scrollStoryFragrances,
          atelierConcierge: cmsData.atelierConcierge || INITIAL_CMS.atelierConcierge,
          catalogueMigratedV2: true,
          catalogueMigratedV3: true,
        });
      }
    }

    const currentAbandoned = await db.select().from(abandonedCarts).limit(1);
    if (currentAbandoned.length === 0) {
      console.log('[Cloud SQL] Seeding initial abandoned carts...');
      for (const cart of INITIAL_ABANDONED_CARTS) {
        await upsertAbandonedCart({
          id: cart.id,
          customerEmail: cart.customerEmail,
          customerPhone: cart.customerPhone,
          customerName: cart.customerName,
          items: cart.items,
          cartValue: cart.cartValue,
          couponCode: cart.couponCode,
          status: cart.status,
          recoveredAt: cart.recoveredAt ? new Date(cart.recoveredAt) : null,
          attribution: cart.attribution,
          recoverySentEmail: cart.recoverySentEmail,
          recoverySentWhatsApp: cart.recoverySentWhatsApp,
          recoverySentSMS: cart.recoverySentSMS,
        });
      }
    }

    console.log('[Cloud SQL] Seeding check completed.');
  } catch (error) {
    console.error('[Cloud SQL] Seeding failed:', error);
  }
}
