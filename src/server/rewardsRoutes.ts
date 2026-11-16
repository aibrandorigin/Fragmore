import { Router, type Request, type Response } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { db } from '../db/index.ts';
import { loyaltyTiers, giftCards, campaigns } from '../db/schema.ts';
import { eq, asc } from 'drizzle-orm';
import { ErpError, ForbiddenError, ValidationError, NotFoundError, recordErpAuditLog } from './erpBusinessOsEngine.ts';
import { broadcastCrossBrowserSyncEvent } from './productionAuditAndReliabilityEngine.ts';
import {
  resolveRewardsRoleFromHeaders,
  assertCustomerOwnershipOrStaff,
  assertRewardsStaffRoles,
  ensureRewardsEcosystemSeeded,
  getRewardsMasterConfig,
  issueWalletCreditTransaction,
  debitOrReverseWalletAdminTransaction,
  adjustLoyaltyPointsAdminTransaction,
  createGiftCardOrderTransaction,
  confirmGiftCardPaymentAndActivate,
  inquireGiftCardBalanceSecure,
  claimGiftCardToCustomerAccount,
  redeemGiftCardAtEventOrPosTransaction,
  blockOrCancelGiftCardAdminTransaction,
  createCorporateGiftCardBatchTransaction,
  approveCorporateBatchAndIssueCardsTransaction,
  registerReferralAttribution,
  updateCustomerLoyaltyPreferences,
  grantOccasionRewardIfEligible,
  calculateCheckoutRewardsPreview,
  reserveAndCaptureCheckoutRewardsTransaction,
  restoreRedeemedRewardsOnCancelOrPaymentFailure,
  createRewardsApprovalRequest,
  decideRewardsApprovalRequest,
  getCustomerRewardsPortalSnapshot,
  getAdminRewardsWorkspaceSnapshot,
  updateRewardsConfigurationSection,
  upsertLoyaltyTierAdmin,
  resolveFraudFlagAdmin,
  type RewardsActor,
  type WalletCreditType,
  type LoyaltyTierCode
} from './rewardsWalletGiftCardEngine.ts';
import {
  REWARDS_CAMPAIGN_TEMPLATES,
  generateRewardsExcelBuffer,
  generateRewardsPdfBuffer,
  runAiRewardsAssistant,
  type RewardsExportReportKey
} from './rewardsExportAndAiEngine.ts';

export const rewardsRouter = Router();

async function resolveActorFromRequest(req: Request): Promise<RewardsActor> {
  let verifiedEmail: string | undefined;
  const authHeader = String(req.headers.authorization || '');
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) {
      try {
        const decoded = await adminAuth.verifyIdToken(token);
        if (decoded?.email) {
          verifiedEmail = decoded.email.trim().toLowerCase();
        }
      } catch {
        // Fallback to explicit headers in dev/preview if Firebase token is absent or expired
      }
    }
  }

  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ipAddress = forwarded || req.socket?.remoteAddress || '127.0.0.1';

  return resolveRewardsRoleFromHeaders({
    verifiedEmail,
    headerAdminEmail: req.headers['x-admin-email'] as string | undefined,
    headerAdminRole: req.headers['x-admin-role'] as string | undefined,
    headerErpRoleCode: req.headers['x-erp-role-code'] as string | undefined,
    headerCustomerEmail: req.headers['x-customer-email'] as string | undefined,
    ipAddress
  });
}

function handleRewardsError(res: Response, err: any) {
  if (err instanceof ErpError) {
    return res.status(err.status || 400).json({
      error: err.message,
      code: err.code
    });
  }
  console.error('[Rewards & Wallet API Error]:', err);
  return res.status(500).json({
    error: err?.message || 'Unexpected Rewards & Wallet system error'
  });
}

// ============================================================================
// 1. PUBLIC STOREFRONT CONFIGURATION (GIFT FRAGMORÉ & PRIVILEGES OVERVIEW)
// ============================================================================

rewardsRouter.get('/public-config', async (_req: Request, res: Response) => {
  try {
    await ensureRewardsEcosystemSeeded();
    const [cfg, tiers] = await Promise.all([
      getRewardsMasterConfig(),
      db.select().from(loyaltyTiers).where(eq(loyaltyTiers.isActive, true)).orderBy(asc(loyaltyTiers.sortOrder))
    ]);

    res.json({
      walletConfig: cfg.walletConfig,
      loyaltyConfig: cfg.loyaltyConfig,
      giftCardConfig: cfg.giftCardConfig,
      referralConfig: cfg.referralConfig,
      occasionConfig: cfg.occasionConfig,
      checkoutRulesConfig: cfg.checkoutRulesConfig,
      tiers,
      campaignTemplates: REWARDS_CAMPAIGN_TEMPLATES
    });
  } catch (err) {
    handleRewardsError(res, err);
  }
});

// ============================================================================
// 2. DIGITAL & PHYSICAL GIFT CARDS — PURCHASE, CONFIRM PAYMENT, LOOKUP & CLAIM
// ============================================================================

rewardsRouter.post('/gift-cards/purchase', async (req: Request, res: Response) => {
  try {
    const actor = await resolveActorFromRequest(req);
    const body = req.body || {};
    const payMethod = String(body.paymentMethodUsed || 'ONLINE_GATEWAY').toUpperCase();
    if (payMethod === 'COD') {
      throw new ValidationError('Cash on Delivery is not supported for Digital or Physical Gift Cards. Prepaid payment confirmation is required.');
    }

    // Activate immediately ONLY when payment gateway verification reference is explicitly supplied
    const paymentConfirmedImmediately = Boolean(body.verifiedGatewayPayment === true && body.paymentReference);

    const created = await createGiftCardOrderTransaction({
      cardFormat: body.cardFormat || 'DIGITAL',
      templateId: body.templateId || 'ivory-champagne-atelier',
      occasion: body.occasion || 'Congratulations',
      amountInr: Number(body.amountInr) || 0,
      purchaserCustomerId: body.purchaserCustomerId,
      purchaserName: String(body.purchaserName || body.senderName || 'FRAGMORÉ Patron'),
      purchaserEmail: String(body.purchaserEmail || actor.email || ''),
      senderName: String(body.senderName || body.purchaserName || 'FRAGMORÉ Patron'),
      recipientName: String(body.recipientName || ''),
      recipientEmail: body.recipientEmail,
      recipientPhone: body.recipientPhone,
      personalMessage: body.personalMessage,
      scheduledDeliveryDate: body.scheduledDeliveryDate,
      paymentMethodUsed: payMethod,
      paymentConfirmedImmediately,
      purchaseOrderId: body.purchaseOrderId,
      purchaseOrderNumber: body.purchaseOrderNumber,
      actorEmail: actor.email || body.purchaserEmail
    });

    broadcastCrossBrowserSyncEvent({
      entity: 'GIFT_CARDS',
      action: 'CREATE',
      recordId: created.giftCard.id,
      summary: `Gift Card ${created.giftCard.cardNumber} (${created.giftCard.status})`
    });

    res.json({ success: true, ...created });
  } catch (err) {
    handleRewardsError(res, err);
  }
});

rewardsRouter.post('/gift-cards/:id/confirm-payment', async (req: Request, res: Response) => {
  try {
    const actor = await resolveActorFromRequest(req);
    const paymentReference = String(req.body?.paymentReference || '').trim();
    if (!paymentReference) {
      throw new ValidationError('Verified payment gateway transaction reference is required to activate a gift card.');
    }

    const [card] = await db.select().from(giftCards).where(eq(giftCards.id, req.params.id)).limit(1);
    if (!card) throw new NotFoundError('Gift card not found.');

    // Allow either the verified purchaser completing gateway callback OR authorized finance/admin staff
    if (actor.isAdminStaff) {
      assertRewardsStaffRoles(
        actor,
        ['SUPER_ADMIN', 'FINANCE_CONTROLLER', 'SALES_CRM'],
        'Confirm Gift Card Payment & Activate'
      );
    } else if (!actor.email || actor.email.toLowerCase() !== card.purchaserEmail.toLowerCase()) {
      throw new ForbiddenError('Forbidden (403): Only the card purchaser or authorized Finance Admin can confirm gift card payment.');
    }

    const activated = await confirmGiftCardPaymentAndActivate({
      giftCardId: card.id,
      paymentReference,
      actorEmail: actor.email || card.purchaserEmail,
      actorRole: actor.role
    });

    broadcastCrossBrowserSyncEvent({
      entity: 'GIFT_CARDS',
      action: 'PAYMENT_CONFIRMED',
      recordId: card.id,
      summary: `Gift Card ${card.cardNumber} activated`
    });

    res.json({ success: true, ...activated });
  } catch (err) {
    handleRewardsError(res, err);
  }
});

rewardsRouter.post('/gift-cards/balance-inquiry', async (req: Request, res: Response) => {
  try {
    const actor = await resolveActorFromRequest(req);
    const actorKey = String(req.body?.actorKey || actor.email || actor.ipAddress || 'anon-lookup');
    const result = await inquireGiftCardBalanceSecure({
      redemptionCode: String(req.body?.redemptionCode || ''),
      actorKey
    });
    res.json({ success: true, giftCard: result });
  } catch (err) {
    handleRewardsError(res, err);
  }
});

rewardsRouter.post('/gift-cards/claim', async (req: Request, res: Response) => {
  try {
    const actor = await resolveActorFromRequest(req);
    const targetEmail = String(req.body?.customerEmail || actor.email || '').trim().toLowerCase();
    await assertCustomerOwnershipOrStaff(actor, targetEmail, false);

    const claimed = await claimGiftCardToCustomerAccount({
      redemptionCode: String(req.body?.redemptionCode || ''),
      customerEmail: targetEmail,
      customerId: req.body?.customerId,
      actorKey: actor.email || actor.ipAddress
    });

    broadcastCrossBrowserSyncEvent({
      entity: 'GIFT_CARDS',
      action: 'CLAIM',
      recordId: claimed.id,
      summary: `Gift Card ${claimed.cardNumber} claimed by ${targetEmail}`
    });

    res.json({ success: true, giftCard: claimed });
  } catch (err) {
    handleRewardsError(res, err);
  }
});

// ============================================================================
// 3. CUSTOMER ACCOUNT PORTAL (STRICT CROSS-CUSTOMER 403 OWNERSHIP GUARD)
// ============================================================================

rewardsRouter.get('/customer/:email/portal', async (req: Request, res: Response) => {
  try {
    const actor = await resolveActorFromRequest(req);
    const targetEmail = decodeURIComponent(req.params.email).trim().toLowerCase();
    await assertCustomerOwnershipOrStaff(actor, targetEmail, true);

    const snapshot = await getCustomerRewardsPortalSnapshot(targetEmail);
    res.json(snapshot);
  } catch (err) {
    handleRewardsError(res, err);
  }
});

rewardsRouter.put('/customer/:email/preferences', async (req: Request, res: Response) => {
  try {
    const actor = await resolveActorFromRequest(req);
    const targetEmail = decodeURIComponent(req.params.email).trim().toLowerCase();
    await assertCustomerOwnershipOrStaff(actor, targetEmail, false);

    const updated = await updateCustomerLoyaltyPreferences({
      customerEmail: targetEmail,
      birthday: req.body?.birthday,
      anniversary: req.body?.anniversary,
      preferredFragranceFamily: req.body?.preferredFragranceFamily,
      giftingPreferences: req.body?.giftingPreferences,
      promoOptIn: req.body?.promoOptIn
    });

    res.json({ success: true, loyalty: updated });
  } catch (err) {
    handleRewardsError(res, err);
  }
});

rewardsRouter.post('/customer/:email/referrals/apply', async (req: Request, res: Response) => {
  try {
    const actor = await resolveActorFromRequest(req);
    const targetEmail = decodeURIComponent(req.params.email).trim().toLowerCase();
    await assertCustomerOwnershipOrStaff(actor, targetEmail, false);

    const conversion = await registerReferralAttribution({
      referralCode: String(req.body?.referralCode || ''),
      refereeEmail: targetEmail,
      refereePhone: req.body?.refereePhone,
      refereeCustomerId: req.body?.refereeCustomerId,
      ipAddress: req.body?.ipAddress || actor.ipAddress,
      deviceFingerprint: req.body?.deviceFingerprint,
      shippingAddressText: req.body?.shippingAddressText
    });

    res.json({ success: true, conversion });
  } catch (err) {
    handleRewardsError(res, err);
  }
});

rewardsRouter.get('/customer/:email/export/:reportKey', async (req: Request, res: Response) => {
  try {
    const actor = await resolveActorFromRequest(req);
    const targetEmail = decodeURIComponent(req.params.email).trim().toLowerCase();
    await assertCustomerOwnershipOrStaff(actor, targetEmail, true);

    const reportKey = req.params.reportKey as RewardsExportReportKey;
    if (reportKey !== 'wallet_statement' && reportKey !== 'loyalty_ledger') {
      throw new ForbiddenError('Customers can export personal Wallet Statements and Loyalty Ledgers only.');
    }

    const format = String(req.query.format || 'pdf').toLowerCase();
    if (format === 'xlsx' || format === 'excel') {
      const { buffer, fileName } = await generateRewardsExcelBuffer({
        reportKey,
        actor,
        customerEmailFilter: targetEmail,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined
      });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      return res.send(buffer);
    }

    const { buffer, fileName } = await generateRewardsPdfBuffer({
      reportKey,
      actor,
      customerEmailFilter: targetEmail,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.send(buffer);
  } catch (err) {
    handleRewardsError(res, err);
  }
});

// ============================================================================
// 4. CHECKOUT REWARDS PREVIEW, ATOMIC FOR-UPDATE REDEMPTION & RESTORATION
// ============================================================================

rewardsRouter.post('/checkout/preview', async (req: Request, res: Response) => {
  try {
    const actor = await resolveActorFromRequest(req);
    const customerEmail = String(req.body?.customerEmail || actor.email || '').trim().toLowerCase();
    await assertCustomerOwnershipOrStaff(actor, customerEmail, true);

    const preview = await calculateCheckoutRewardsPreview({
      customerEmail,
      cartSubtotalInr: Number(req.body?.cartSubtotalInr) || 0,
      couponDiscountInr: Number(req.body?.couponDiscountInr) || 0,
      couponCode: req.body?.couponCode || null,
      shippingInr: Number(req.body?.shippingInr) || 0,
      giftWrapInr: Number(req.body?.giftWrapInr) || 0,
      items: Array.isArray(req.body?.items) ? req.body.items : [],
      applyWalletCredits: Boolean(req.body?.applyWalletCredits),
      requestedWalletAmountInr:
        req.body?.requestedWalletAmountInr !== undefined ? Number(req.body.requestedWalletAmountInr) : undefined,
      applyLoyaltyPoints: Boolean(req.body?.applyLoyaltyPoints),
      requestedLoyaltyPoints:
        req.body?.requestedLoyaltyPoints !== undefined ? Number(req.body.requestedLoyaltyPoints) : undefined,
      applyGiftCard: Boolean(req.body?.applyGiftCard),
      giftCardCodeOrNumber: req.body?.giftCardCodeOrNumber,
      actorIp: actor.ipAddress
    });

    res.json(preview);
  } catch (err) {
    handleRewardsError(res, err);
  }
});

rewardsRouter.post('/checkout/redeem', async (req: Request, res: Response) => {
  try {
    const actor = await resolveActorFromRequest(req);
    const customerEmail = String(req.body?.customerEmail || actor.email || '').trim().toLowerCase();
    await assertCustomerOwnershipOrStaff(actor, customerEmail, false);

    const redeemed = await reserveAndCaptureCheckoutRewardsTransaction({
      customerEmail,
      cartSubtotalInr: Number(req.body?.cartSubtotalInr) || 0,
      couponDiscountInr: Number(req.body?.couponDiscountInr) || 0,
      couponCode: req.body?.couponCode || null,
      shippingInr: Number(req.body?.shippingInr) || 0,
      giftWrapInr: Number(req.body?.giftWrapInr) || 0,
      items: Array.isArray(req.body?.items) ? req.body.items : [],
      applyWalletCredits: Boolean(req.body?.applyWalletCredits),
      requestedWalletAmountInr:
        req.body?.requestedWalletAmountInr !== undefined ? Number(req.body.requestedWalletAmountInr) : undefined,
      applyLoyaltyPoints: Boolean(req.body?.applyLoyaltyPoints),
      requestedLoyaltyPoints:
        req.body?.requestedLoyaltyPoints !== undefined ? Number(req.body.requestedLoyaltyPoints) : undefined,
      applyGiftCard: Boolean(req.body?.applyGiftCard),
      giftCardCodeOrNumber: req.body?.giftCardCodeOrNumber,
      actorIp: actor.ipAddress,
      idempotencyKey: String(req.body?.idempotencyKey || ''),
      orderId: req.body?.orderId,
      orderNumber: req.body?.orderNumber,
      captureImmediately: req.body?.captureImmediately !== false
    });

    broadcastCrossBrowserSyncEvent({
      entity: 'REWARDS_ECOSYSTEM',
      action: 'CHECKOUT_REDEMPTION',
      recordId: redeemed.reservation.id,
      summary: `Checkout rewards redeemed (${customerEmail})`
    });

    res.json({ success: true, ...redeemed });
  } catch (err) {
    handleRewardsError(res, err);
  }
});

rewardsRouter.post('/checkout/restore', async (req: Request, res: Response) => {
  try {
    const actor = await resolveActorFromRequest(req);
    if (!actor.isAdminStaff && !actor.email) {
      throw new ForbiddenError('Authentication required to restore checkout rewards.');
    }

    const restored = await restoreRedeemedRewardsOnCancelOrPaymentFailure({
      orderId: req.body?.orderId,
      reservationId: req.body?.reservationId,
      reason: String(req.body?.reason || 'Payment failed or checkout cancelled'),
      actorEmail: actor.email || 'checkout@fragmore.shop'
    });

    res.json({ success: true, ...restored });
  } catch (err) {
    handleRewardsError(res, err);
  }
});

// ============================================================================
// 5. SUPER ADMIN & ROLE-BASED REWARDS & WALLET WORKSPACE
// ============================================================================

rewardsRouter.get('/admin/bootstrap', async (req: Request, res: Response) => {
  try {
    const actor = await resolveActorFromRequest(req);
    const snapshot = await getAdminRewardsWorkspaceSnapshot(actor);
    res.json({
      ...snapshot,
      campaignTemplates: REWARDS_CAMPAIGN_TEMPLATES
    });
  } catch (err) {
    handleRewardsError(res, err);
  }
});

rewardsRouter.put('/admin/config/:section', async (req: Request, res: Response) => {
  try {
    const actor = await resolveActorFromRequest(req);
    const updated = await updateRewardsConfigurationSection({
      section: req.params.section as any,
      patch: req.body || {},
      actor
    });
    res.json({ success: true, config: updated });
  } catch (err) {
    handleRewardsError(res, err);
  }
});

rewardsRouter.put('/admin/tiers/:tierCode', async (req: Request, res: Response) => {
  try {
    const actor = await resolveActorFromRequest(req);
    const updated = await upsertLoyaltyTierAdmin({
      tierCode: req.params.tierCode as LoyaltyTierCode,
      tierName: String(req.body?.tierName || req.params.tierCode),
      tagline: String(req.body?.tagline || ''),
      minQualifyingSpendInr: Number(req.body?.minQualifyingSpendInr) || 0,
      minQualifyingOrders: Number(req.body?.minQualifyingOrders) || 0,
      pointsMultiplier: Number(req.body?.pointsMultiplier) || 1,
      earnBonusPct: Number(req.body?.earnBonusPct) || 0,
      durationMonths: Number(req.body?.durationMonths) || 12,
      renewalSpendInr: Number(req.body?.renewalSpendInr) || 0,
      maxRedemptionOrderPct: Number(req.body?.maxRedemptionOrderPct) || 20,
      benefits: req.body?.benefits,
      actor
    });
    res.json({ success: true, tier: updated });
  } catch (err) {
    handleRewardsError(res, err);
  }
});

rewardsRouter.post('/admin/wallets/issue', async (req: Request, res: Response) => {
  try {
    const actor = await resolveActorFromRequest(req);
    assertRewardsStaffRoles(
      actor,
      ['SUPER_ADMIN', 'FINANCE_CONTROLLER', 'MARKETING_MANAGER', 'CUSTOMER_SUPPORT'],
      'Issue Wallet Credit'
    );

    const creditType = (req.body?.creditType || 'GOODWILL_CREDIT') as WalletCreditType;
    const amountInr = Number(req.body?.amountInr) || 0;
    const customerEmail = String(req.body?.customerEmail || '').trim().toLowerCase();
    const reason = String(req.body?.reason || '').trim();

    if (actor.role === 'MARKETING_MANAGER' && creditType !== 'PROMOTIONAL_CREDIT') {
      throw new ForbiddenError('Marketing Manager can only issue PROMOTIONAL_CREDIT campaign allowances.');
    }

    // Customer Support or explicit dual-control flag always enters PENDING_APPROVAL queue
    if (actor.role === 'CUSTOMER_SUPPORT' || req.body?.requireApproval === true) {
      const approval = await createRewardsApprovalRequest({
        requestSource: actor.role === 'CUSTOMER_SUPPORT' ? 'CUSTOMER_SUPPORT' : 'ADMIN_CONSOLE',
        actionType: 'WALLET_CREDIT_ISSUE',
        targetCustomerEmail: customerEmail,
        amountInr,
        creditType,
        reason,
        payload: {
          expiresInDays: req.body?.expiresInDays,
          minOrderValueInr: req.body?.minOrderValueInr
        },
        actor
      });
      return res.json({ success: true, queuedForApproval: true, approval });
    }

    const result = await issueWalletCreditTransaction({
      customerEmail,
      customerName: req.body?.customerName,
      creditType,
      amountInr,
      sourceType: req.body?.sourceType || 'ADMIN_MANUAL_GRANT',
      sourceRefId: req.body?.sourceRefId,
      reason,
      minOrderValueInr: req.body?.minOrderValueInr !== undefined ? Number(req.body.minOrderValueInr) : undefined,
      maxOrderPct: req.body?.maxOrderPct !== undefined ? Number(req.body.maxOrderPct) : undefined,
      expiresInDays: req.body?.expiresInDays !== undefined ? Number(req.body.expiresInDays) : undefined,
      customerOptedInStoreCredit: Boolean(req.body?.customerOptedInStoreCredit),
      idempotencyKey: String(req.body?.idempotencyKey || `adm_wlt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`),
      actorEmail: actor.email,
      actorRole: actor.role
    });

    res.json({ success: true, queuedForApproval: false, ...result });
  } catch (err) {
    handleRewardsError(res, err);
  }
});

rewardsRouter.post('/admin/wallets/debit', async (req: Request, res: Response) => {
  try {
    const actor = await resolveActorFromRequest(req);
    assertRewardsStaffRoles(actor, ['SUPER_ADMIN', 'FINANCE_CONTROLLER'], 'Debit or Reverse Wallet Credit');

    const result = await debitOrReverseWalletAdminTransaction({
      customerEmail: String(req.body?.customerEmail || ''),
      amountInr: Number(req.body?.amountInr) || 0,
      creditType: req.body?.creditType,
      reason: String(req.body?.reason || ''),
      idempotencyKey: String(req.body?.idempotencyKey || `adm_wlt_deb_${Date.now()}`),
      actorEmail: actor.email,
      actorRole: actor.role
    });

    res.json({ success: true, ...result });
  } catch (err) {
    handleRewardsError(res, err);
  }
});

rewardsRouter.post('/admin/loyalty/adjust', async (req: Request, res: Response) => {
  try {
    const actor = await resolveActorFromRequest(req);
    assertRewardsStaffRoles(
      actor,
      ['SUPER_ADMIN', 'FINANCE_CONTROLLER', 'MARKETING_MANAGER', 'CUSTOMER_SUPPORT'],
      'Adjust Loyalty Points'
    );

    const customerEmail = String(req.body?.customerEmail || '').trim().toLowerCase();
    const pointsDelta = Math.trunc(Number(req.body?.pointsDelta) || 0);
    const reason = String(req.body?.reason || '').trim();

    if (actor.role === 'CUSTOMER_SUPPORT' || req.body?.requireApproval === true) {
      const approval = await createRewardsApprovalRequest({
        requestSource: actor.role === 'CUSTOMER_SUPPORT' ? 'CUSTOMER_SUPPORT' : 'ADMIN_CONSOLE',
        actionType: 'LOYALTY_POINTS_ADJUST',
        targetCustomerEmail: customerEmail,
        pointsDelta,
        reason,
        payload: {},
        actor
      });
      return res.json({ success: true, queuedForApproval: true, approval });
    }

    const result = await adjustLoyaltyPointsAdminTransaction({
      customerEmail,
      pointsDelta,
      reason,
      idempotencyKey: String(req.body?.idempotencyKey || `adm_loy_${Date.now()}`),
      actorEmail: actor.email,
      actorRole: actor.role
    });

    res.json({ success: true, queuedForApproval: false, ...result });
  } catch (err) {
    handleRewardsError(res, err);
  }
});

rewardsRouter.post('/admin/occasions/grant', async (req: Request, res: Response) => {
  try {
    const actor = await resolveActorFromRequest(req);
    assertRewardsStaffRoles(actor, ['SUPER_ADMIN', 'MARKETING_MANAGER'], 'Grant Occasion Reward');

    const grant = await grantOccasionRewardIfEligible({
      customerEmail: String(req.body?.customerEmail || ''),
      occasionType: req.body?.occasionType || 'BIRTHDAY',
      actorEmail: actor.email,
      actorRole: actor.role
    });

    res.json({ success: true, grant });
  } catch (err) {
    handleRewardsError(res, err);
  }
});

rewardsRouter.post('/admin/gift-cards/:id/status', async (req: Request, res: Response) => {
  try {
    const actor = await resolveActorFromRequest(req);
    const updated = await blockOrCancelGiftCardAdminTransaction({
      giftCardId: req.params.id,
      action: req.body?.action || 'BLOCK',
      reason: String(req.body?.reason || ''),
      actor
    });

    res.json({ success: true, giftCard: updated });
  } catch (err) {
    handleRewardsError(res, err);
  }
});

rewardsRouter.post('/admin/gift-cards/pos-redeem', async (req: Request, res: Response) => {
  try {
    const actor = await resolveActorFromRequest(req);
    const result = await redeemGiftCardAtEventOrPosTransaction({
      redemptionCodeOrQr: String(req.body?.redemptionCodeOrQr || ''),
      amountInr: Number(req.body?.amountInr) || 0,
      posEventLocation: String(req.body?.posEventLocation || 'Worli Perfume Bar Atelier'),
      customerEmail: req.body?.customerEmail,
      orderReference: req.body?.orderReference,
      staffActor: actor,
      idempotencyKey: String(req.body?.idempotencyKey || `pos_gc_${Date.now()}`)
    });

    res.json({ success: true, ...result });
  } catch (err) {
    handleRewardsError(res, err);
  }
});

rewardsRouter.post('/admin/corporate-batches', async (req: Request, res: Response) => {
  try {
    const actor = await resolveActorFromRequest(req);
    const batch = await createCorporateGiftCardBatchTransaction({
      companyName: String(req.body?.companyName || ''),
      contactName: String(req.body?.contactName || ''),
      contactEmail: String(req.body?.contactEmail || ''),
      contactPhone: String(req.body?.contactPhone || ''),
      customerGstin: req.body?.customerGstin,
      category: req.body?.category,
      erpProposalId: req.body?.erpProposalId,
      erpQuotationId: req.body?.erpQuotationId,
      templateId: req.body?.templateId,
      occasion: req.body?.occasion,
      quantity: Number(req.body?.quantity) || 0,
      denominationInr: Number(req.body?.denominationInr) || 0,
      corporateDiscountPct: Number(req.body?.corporateDiscountPct) || 0,
      scheduledDistributionDate: req.body?.scheduledDistributionDate,
      recipients: Array.isArray(req.body?.recipients) ? req.body.recipients : undefined,
      notes: req.body?.notes,
      actor
    });

    res.json({ success: true, batch });
  } catch (err) {
    handleRewardsError(res, err);
  }
});

rewardsRouter.post('/admin/corporate-batches/:id/approve-payment', async (req: Request, res: Response) => {
  try {
    const actor = await resolveActorFromRequest(req);
    const result = await approveCorporateBatchAndIssueCardsTransaction({
      batchId: req.params.id,
      paymentReference: String(req.body?.paymentReference || ''),
      erpInvoiceId: req.body?.erpInvoiceId,
      actor
    });

    res.json({ success: true, ...result });
  } catch (err) {
    handleRewardsError(res, err);
  }
});

rewardsRouter.post('/admin/approvals', async (req: Request, res: Response) => {
  try {
    const actor = await resolveActorFromRequest(req);
    assertRewardsStaffRoles(
      actor,
      ['SUPER_ADMIN', 'FINANCE_CONTROLLER', 'MARKETING_MANAGER', 'CUSTOMER_SUPPORT', 'SALES_CRM'],
      'Submit Approval Request'
    );

    const approval = await createRewardsApprovalRequest({
      requestSource: req.body?.requestSource || 'ADMIN_CONSOLE',
      actionType: req.body?.actionType || 'WALLET_CREDIT_ISSUE',
      targetCustomerEmail: req.body?.targetCustomerEmail,
      targetEntityId: req.body?.targetEntityId,
      amountInr: req.body?.amountInr,
      pointsDelta: req.body?.pointsDelta,
      creditType: req.body?.creditType,
      reason: String(req.body?.reason || ''),
      payload: req.body?.payload || {},
      actor
    });

    res.json({ success: true, approval });
  } catch (err) {
    handleRewardsError(res, err);
  }
});

rewardsRouter.post('/admin/approvals/:id/decide', async (req: Request, res: Response) => {
  try {
    const actor = await resolveActorFromRequest(req);
    const decided = await decideRewardsApprovalRequest({
      approvalId: req.params.id,
      decision: req.body?.decision === 'REJECT' ? 'REJECT' : 'APPROVE',
      decisionNotes: req.body?.decisionNotes,
      actor
    });

    res.json({ success: true, approval: decided });
  } catch (err) {
    handleRewardsError(res, err);
  }
});

rewardsRouter.post('/admin/fraud-flags/:id/resolve', async (req: Request, res: Response) => {
  try {
    const actor = await resolveActorFromRequest(req);
    const resolved = await resolveFraudFlagAdmin({
      flagId: req.params.id,
      status: req.body?.status || 'DISMISSED',
      resolutionNotes: String(req.body?.resolutionNotes || ''),
      actor
    });

    res.json({ success: true, flag: resolved });
  } catch (err) {
    handleRewardsError(res, err);
  }
});

rewardsRouter.post('/admin/campaigns/launch', async (req: Request, res: Response) => {
  try {
    const actor = await resolveActorFromRequest(req);
    assertRewardsStaffRoles(actor, ['SUPER_ADMIN', 'MARKETING_MANAGER'], 'Launch Rewards Lifecycle Campaign');

    const triggerKey = String(req.body?.triggerKey || 'WELCOME_LOYALTY');
    const tpl =
      REWARDS_CAMPAIGN_TEMPLATES.find((t) => t.triggerKey === triggerKey) || REWARDS_CAMPAIGN_TEMPLATES[0];

    const campId = `camp-rwd-${triggerKey.toLowerCase()}`;
    const existing = await db.select().from(campaigns).where(eq(campaigns.id, campId)).limit(1);

    const prevMeta = (existing[0]?.campaignMetadata as any) || {};
    const payload = {
      id: campId,
      name: String(req.body?.name || `FRAGMORÉ Privileges — ${tpl.title}`),
      channel: String(req.body?.channel || tpl.channel),
      budget: existing[0]?.budget ?? 0,
      spend: existing[0]?.spend ?? 0,
      revenue: existing[0]?.revenue ?? 0,
      status: String(req.body?.status || 'ACTIVE'),
      startDate: existing[0]?.startDate || new Date().toISOString().slice(0, 10),
      endDate: existing[0]?.endDate || null,
      campaignMetadata: {
        ...prevMeta,
        triggerKey,
        segment: String(req.body?.segment || 'Enrolled Privileges Members (Consent Verified)'),
        subjectLine: String(req.body?.subjectLine || tpl.subjectLine),
        messagePreview: String(req.body?.messagePreview || tpl.luxuryCopy),
        sentCount: prevMeta.sentCount || 0,
        openRate: prevMeta.openRate || 0,
        clickRate: prevMeta.clickRate || 0
      }
    };

    if (existing[0]) {
      await db.update(campaigns).set(payload).where(eq(campaigns.id, campId));
    } else {
      await db.insert(campaigns).values(payload);
    }

    await recordErpAuditLog(db, {
      action: 'REWARDS_CAMPAIGN_ACTIVATED',
      entity: 'campaigns',
      entityId: campId,
      actorEmail: actor.email,
      actorRole: actor.role,
      details: `Activated luxury rewards lifecycle campaign ${payload.name} (${triggerKey})`
    });

    res.json({ success: true, campaign: payload });
  } catch (err) {
    handleRewardsError(res, err);
  }
});

rewardsRouter.get('/admin/export/:reportKey', async (req: Request, res: Response) => {
  try {
    const actor = await resolveActorFromRequest(req);
    const reportKey = req.params.reportKey as RewardsExportReportKey;
    const format = String(req.query.format || 'pdf').toLowerCase();

    if (format === 'xlsx' || format === 'excel') {
      const { buffer, fileName } = await generateRewardsExcelBuffer({
        reportKey,
        actor,
        customerEmailFilter: req.query.customerEmail as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined
      });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      return res.send(buffer);
    }

    const { buffer, fileName } = await generateRewardsPdfBuffer({
      reportKey,
      actor,
      customerEmailFilter: req.query.customerEmail as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.send(buffer);
  } catch (err) {
    handleRewardsError(res, err);
  }
});

// ============================================================================
// 6. AI REWARDS & GIFTING CONCIERGE ASSISTANT (CONFIRMATION-GATED)
// ============================================================================

rewardsRouter.post('/ai/assist', async (req: Request, res: Response) => {
  try {
    const actor = await resolveActorFromRequest(req);
    const response = await runAiRewardsAssistant({
      prompt: String(req.body?.prompt || ''),
      actor,
      customerEmailContext: req.body?.customerEmailContext
    });
    res.json({ success: true, ...response });
  } catch (err) {
    handleRewardsError(res, err);
  }
});
