import { auth } from './firebase';
import { getActiveErpRoleOverride } from './erpApi';

export type RewardsExportReportKey =
  | 'wallet_statement'
  | 'loyalty_ledger'
  | 'gift_card_issuance'
  | 'gift_card_redemption'
  | 'unredeemed_liability'
  | 'corporate_gift_cards'
  | 'referral_performance'
  | 'vip_tier_report'
  | 'campaign_reward_roi';

export interface CheckoutRewardsPreviewResponse {
  customerEmail: string;
  walletSummary: {
    totalAvailableInr: number;
    promoEligibleInr: number;
    refundEligibleInr: number;
  };
  loyaltySummary: {
    tierCode: string;
    availablePoints: number;
    pendingPoints: number;
    pointsToRupeeRateLabel: string;
  };
  verifiedGiftCard: {
    id: string;
    cardNumber: string;
    maskedCode: string;
    availableInr: number;
  } | null;
  breakdown: {
    cartSubtotalInr: number;
    couponDiscountInr: number;
    loyaltyPointsRedeemed: number;
    loyaltyDiscountInr: number;
    promoWalletAppliedInr: number;
    refundWalletAppliedInr: number;
    walletCreditsAppliedInr: number;
    giftWrapInr: number;
    taxableValueInr: number;
    gstAmountInr: number;
    shippingInr: number;
    grossInvoiceTotalInr: number;
    giftCardAppliedInr: number;
    finalPayableInr: number;
  };
  warnings: string[];
}

export interface CustomerRewardsPortalResponse {
  config: any;
  wallet: {
    id: string;
    customerEmail: string;
    totalAvailableInr: number;
    expiringWithin30DaysInr: number;
    pendingCreditsInr: number;
    totalReceivedInr: number;
    totalRedeemedInr: number;
    availableRefundInr: number;
    availablePromoInr: number;
    availableCashbackInr: number;
    availableGoodwillInr: number;
    availableReferralInr: number;
    [key: string]: any;
  };
  walletBuckets: any[];
  walletTransactions: any[];
  loyalty: {
    id: string;
    memberNumber: string;
    tierCode: string;
    availablePoints: number;
    pendingPoints: number;
    lifetimeEarnedPoints: number;
    lifetimeRedeemedPoints: number;
    qualifyingNetSpendInr: number;
    referralCode: string;
    currentTier?: any;
    nextTier?: any;
    spendToNextTierInr?: number;
    [key: string]: any;
  };
  tiers: any[];
  pointsLedger: any[];
  giftCards: any[];
  giftCardTransactions: any[];
  referrals: {
    referralCode: string;
    shareUrl: string;
    invitedConversions: any[];
    referredByConversion: any | null;
  };
  occasionGrants: any[];
}

async function buildRewardsHeaders(options: {
  mode: 'customer' | 'admin' | 'public';
  customerEmail?: string;
}): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  let fallbackEmail = options.customerEmail || '';
  try {
    const savedCustomer = localStorage.getItem('fragmore_customer_v1');
    if (savedCustomer) {
      const parsed = JSON.parse(savedCustomer);
      if (!fallbackEmail && parsed?.email) {
        fallbackEmail = String(parsed.email).trim().toLowerCase();
      }
      if (options.mode === 'admin' && parsed?.email) {
        headers['x-admin-email'] = String(parsed.email).trim().toLowerCase();
      }
    }
    if (options.mode === 'admin') {
      const savedRole = localStorage.getItem('fragmore_admin_role_v1');
      if (savedRole) headers['x-admin-role'] = savedRole;
      const erpOverride = getActiveErpRoleOverride();
      if (erpOverride) {
        headers['x-erp-role-code'] = erpOverride;
      } else if (!headers['x-admin-role']) {
        headers['x-admin-role'] = 'SUPER_ADMIN';
      }
    }
  } catch {
    // Ignore storage read issues
  }

  if (fallbackEmail) {
    headers['x-customer-email'] = fallbackEmail;
  }

  try {
    const currentUser = auth?.currentUser;
    if (currentUser) {
      const token = await currentUser.getIdToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      if (currentUser.email && !headers['x-customer-email']) {
        headers['x-customer-email'] = currentUser.email.trim().toLowerCase();
      }
    }
  } catch {
    // Proceed with explicit header context when Firebase session is not active
  }

  return headers;
}

async function requestRewardsJson<T>(
  path: string,
  mode: 'customer' | 'admin' | 'public',
  init?: RequestInit & { customerEmail?: string }
): Promise<T> {
  const baseHeaders = await buildRewardsHeaders({
    mode,
    customerEmail: init?.customerEmail
  });
  const res = await fetch(`/api/rewards${path}`, {
    ...init,
    headers: {
      ...baseHeaders,
      ...(init?.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Rewards API error (${res.status})`);
  }
  return data as T;
}

async function triggerBlobDownload(url: string, headers: Record<string, string>, fallbackName: string) {
  const res = await fetch(url, { method: 'GET', headers });
  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(errJson?.error || `Export failed (${res.status})`);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const fileName = match?.[1] || fallbackName;

  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(objUrl), 5000);
}

export const rewardsApi = {
  // Public Config
  getPublicConfig: () => requestRewardsJson<any>('/public-config', 'public'),

  // Storefront Gift Cards
  purchaseGiftCard: (payload: {
    cardFormat?: 'DIGITAL' | 'PHYSICAL';
    templateId?: string;
    occasion: string;
    amountInr: number;
    purchaserCustomerId?: string;
    purchaserName: string;
    purchaserEmail: string;
    senderName: string;
    recipientName: string;
    recipientEmail?: string;
    recipientPhone?: string;
    personalMessage?: string;
    scheduledDeliveryDate?: string;
    paymentMethodUsed?: string;
    verifiedGatewayPayment?: boolean;
    paymentReference?: string;
  }) =>
    requestRewardsJson<any>('/gift-cards/purchase', 'customer', {
      method: 'POST',
      customerEmail: payload.purchaserEmail,
      body: JSON.stringify(payload)
    }),

  confirmGiftCardPayment: (giftCardId: string, paymentReference: string, purchaserEmail?: string) =>
    requestRewardsJson<any>(`/gift-cards/${encodeURIComponent(giftCardId)}/confirm-payment`, purchaserEmail ? 'customer' : 'admin', {
      method: 'POST',
      customerEmail: purchaserEmail,
      body: JSON.stringify({ paymentReference })
    }),

  inquireGiftCardBalance: (redemptionCode: string, customerEmail?: string) =>
    requestRewardsJson<any>('/gift-cards/balance-inquiry', 'public', {
      method: 'POST',
      customerEmail,
      body: JSON.stringify({ redemptionCode })
    }),

  claimGiftCard: (redemptionCode: string, customerEmail: string, customerId?: string) =>
    requestRewardsJson<any>('/gift-cards/claim', 'customer', {
      method: 'POST',
      customerEmail,
      body: JSON.stringify({ redemptionCode, customerEmail, customerId })
    }),

  // Customer Portal (Authoritative DB state — zero localStorage caching)
  getCustomerPortal: (customerEmail: string) =>
    requestRewardsJson<any>(`/customer/${encodeURIComponent(customerEmail)}/portal`, 'customer', {
      customerEmail
    }),

  updateCustomerPreferences: (
    customerEmail: string,
    payload: {
      birthday?: string | null;
      anniversary?: string | null;
      preferredFragranceFamily?: string | null;
      giftingPreferences?: Record<string, any>;
      promoOptIn?: boolean;
    }
  ) =>
    requestRewardsJson<any>(`/customer/${encodeURIComponent(customerEmail)}/preferences`, 'customer', {
      method: 'PUT',
      customerEmail,
      body: JSON.stringify(payload)
    }),

  applyReferralCode: (customerEmail: string, referralCode: string, refereePhone?: string, refereeCustomerId?: string) =>
    requestRewardsJson<any>(`/customer/${encodeURIComponent(customerEmail)}/referrals/apply`, 'customer', {
      method: 'POST',
      customerEmail,
      body: JSON.stringify({ referralCode, refereePhone, refereeCustomerId })
    }),

  downloadCustomerStatement: async (
    customerEmail: string,
    reportKey: 'wallet_statement' | 'loyalty_ledger',
    format: 'pdf' | 'xlsx'
  ) => {
    const headers = await buildRewardsHeaders({ mode: 'customer', customerEmail });
    delete headers['Content-Type'];
    await triggerBlobDownload(
      `/api/rewards/customer/${encodeURIComponent(customerEmail)}/export/${reportKey}?format=${format}`,
      headers,
      `FRAGMORE_${reportKey.toUpperCase()}.${format}`
    );
  },

  // Checkout Rewards Preview & Atomic Redemption
  previewCheckoutRewards: (payload: {
    customerEmail: string;
    cartSubtotalInr: number;
    couponDiscountInr?: number;
    couponCode?: string | null;
    shippingInr?: number;
    giftWrapInr?: number;
    items?: any[];
    applyWalletCredits: boolean;
    requestedWalletAmountInr?: number;
    applyLoyaltyPoints: boolean;
    requestedLoyaltyPoints?: number;
    applyGiftCard: boolean;
    giftCardCodeOrNumber?: string;
  }) =>
    requestRewardsJson<any>('/checkout/preview', 'customer', {
      method: 'POST',
      customerEmail: payload.customerEmail,
      body: JSON.stringify(payload)
    }),

  redeemCheckoutRewards: (payload: {
    customerEmail: string;
    cartSubtotalInr: number;
    couponDiscountInr?: number;
    couponCode?: string | null;
    shippingInr?: number;
    giftWrapInr?: number;
    items?: any[];
    applyWalletCredits: boolean;
    requestedWalletAmountInr?: number;
    applyLoyaltyPoints: boolean;
    requestedLoyaltyPoints?: number;
    applyGiftCard: boolean;
    giftCardCodeOrNumber?: string;
    idempotencyKey: string;
    orderId?: string;
    orderNumber?: string;
  }) =>
    requestRewardsJson<any>('/checkout/redeem', 'customer', {
      method: 'POST',
      customerEmail: payload.customerEmail,
      body: JSON.stringify(payload)
    }),

  // Admin RBAC Workspace
  getAdminBootstrap: () => requestRewardsJson<any>('/admin/bootstrap', 'admin'),

  updateConfigSection: (section: string, patch: Record<string, any>) =>
    requestRewardsJson<any>(`/admin/config/${encodeURIComponent(section)}`, 'admin', {
      method: 'PUT',
      body: JSON.stringify(patch)
    }),

  updateLoyaltyTier: (tierCode: string, payload: Record<string, any>) =>
    requestRewardsJson<any>(`/admin/tiers/${encodeURIComponent(tierCode)}`, 'admin', {
      method: 'PUT',
      body: JSON.stringify(payload)
    }),

  issueWalletCreditAdmin: (payload: {
    customerEmail: string;
    customerName?: string;
    creditType: string;
    amountInr: number;
    reason: string;
    expiresInDays?: number;
    minOrderValueInr?: number;
    requireApproval?: boolean;
  }) =>
    requestRewardsJson<any>('/admin/wallets/issue', 'admin', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  debitWalletCreditAdmin: (payload: {
    customerEmail: string;
    amountInr: number;
    creditType?: string;
    reason: string;
  }) =>
    requestRewardsJson<any>('/admin/wallets/debit', 'admin', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  adjustLoyaltyPointsAdmin: (payload: {
    customerEmail: string;
    pointsDelta: number;
    reason: string;
    requireApproval?: boolean;
  }) =>
    requestRewardsJson<any>('/admin/loyalty/adjust', 'admin', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  grantOccasionRewardAdmin: (payload: { customerEmail: string; occasionType: string }) =>
    requestRewardsJson<any>('/admin/occasions/grant', 'admin', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  updateGiftCardStatusAdmin: (giftCardId: string, action: 'BLOCK' | 'UNBLOCK' | 'CANCEL', reason: string) =>
    requestRewardsJson<any>(`/admin/gift-cards/${encodeURIComponent(giftCardId)}/status`, 'admin', {
      method: 'POST',
      body: JSON.stringify({ action, reason })
    }),

  redeemGiftCardAtPosAdmin: (payload: {
    redemptionCodeOrQr: string;
    amountInr: number;
    posEventLocation: string;
    customerEmail?: string;
    orderReference?: string;
  }) =>
    requestRewardsJson<any>('/admin/gift-cards/pos-redeem', 'admin', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  createCorporateBatchAdmin: (payload: Record<string, any>) =>
    requestRewardsJson<any>('/admin/corporate-batches', 'admin', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  approveCorporateBatchPaymentAdmin: (batchId: string, paymentReference: string, erpInvoiceId?: string) =>
    requestRewardsJson<any>(`/admin/corporate-batches/${encodeURIComponent(batchId)}/approve-payment`, 'admin', {
      method: 'POST',
      body: JSON.stringify({ paymentReference, erpInvoiceId })
    }),

  createApprovalRequestAdmin: (payload: Record<string, any>) =>
    requestRewardsJson<any>('/admin/approvals', 'admin', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  decideApprovalRequestAdmin: (approvalId: string, decision: 'APPROVE' | 'REJECT', decisionNotes?: string) =>
    requestRewardsJson<any>(`/admin/approvals/${encodeURIComponent(approvalId)}/decide`, 'admin', {
      method: 'POST',
      body: JSON.stringify({ decision, decisionNotes })
    }),

  resolveFraudFlagAdmin: (flagId: string, status: string, resolutionNotes: string) =>
    requestRewardsJson<any>(`/admin/fraud-flags/${encodeURIComponent(flagId)}/resolve`, 'admin', {
      method: 'POST',
      body: JSON.stringify({ status, resolutionNotes })
    }),

  launchRewardsCampaignAdmin: (payload: {
    triggerKey: string;
    name?: string;
    channel?: string;
    subjectLine?: string;
    messagePreview?: string;
  }) =>
    requestRewardsJson<any>('/admin/campaigns/launch', 'admin', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  downloadAdminReport: async (
    reportKey: RewardsExportReportKey,
    format: 'pdf' | 'xlsx',
    filters?: { customerEmail?: string; dateFrom?: string; dateTo?: string }
  ) => {
    const headers = await buildRewardsHeaders({ mode: 'admin' });
    delete headers['Content-Type'];
    const qs = new URLSearchParams({ format });
    if (filters?.customerEmail) qs.set('customerEmail', filters.customerEmail);
    if (filters?.dateFrom) qs.set('dateFrom', filters.dateFrom);
    if (filters?.dateTo) qs.set('dateTo', filters.dateTo);
    await triggerBlobDownload(
      `/api/rewards/admin/export/${reportKey}?${qs.toString()}`,
      headers,
      `FRAGMORE_${reportKey.toUpperCase()}.${format}`
    );
  },

  // AI Rewards & Gifting Assistant
  askAiRewardsAssistant: (prompt: string, mode: 'customer' | 'admin', customerEmailContext?: string) =>
    requestRewardsJson<any>('/ai/assist', mode, {
      method: 'POST',
      customerEmail: mode === 'customer' ? customerEmailContext : undefined,
      body: JSON.stringify({ prompt, customerEmailContext })
    })
};
