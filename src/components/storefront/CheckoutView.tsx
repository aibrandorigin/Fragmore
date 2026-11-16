import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../../context/StoreContext';
import { PaymentMethod, Order } from '../../types';
import { detectCityAndStateFromPincode } from '../../utils/pincodeLookup';
import {
  rewardsApi,
  type CheckoutRewardsPreviewResponse,
  type CustomerRewardsPortalResponse
} from '../../lib/rewardsApi';
import {
  ShieldCheck,
  Truck,
  CheckCircle2,
  Lock,
  ArrowRight,
  FileText,
  Package,
  MapPin,
  Wallet,
  Award,
  Gift,
  AlertCircle,
  Sparkles
} from 'lucide-react';

export const CheckoutView: React.FC = () => {
  const {
    cart,
    customer,
    setIsAuthModalOpen,
    createOrder,
    addOrUpdateAddress,
    setCurrentView,
    setSelectedOrderForInvoice,
    attribution,
    trackEvent,
    showNotification
  } = useStore();

  const [step, setStep] = useState<'address' | 'payment' | 'confirmation'>('address');

  // Address fields
  const [fullName, setFullName] = useState(customer?.name || '');
  const [email, setEmail] = useState(customer?.email || '');
  const [phone, setPhone] = useState(customer?.phone || '');
  const [addressLine1, setAddressLine1] = useState(
    customer?.addresses?.[0]?.addressLine1 || ''
  );
  const [addressLine2, setAddressLine2] = useState(
    customer?.addresses?.[0]?.addressLine2 || ''
  );
  const [city, setCity] = useState(customer?.addresses?.[0]?.city || '');
  const [state, setState] = useState(customer?.addresses?.[0]?.state || '');
  const [pincode, setPincode] = useState(customer?.addresses?.[0]?.pincode || '');
  const [pincodeDetectedInfo, setPincodeDetectedInfo] = useState<string | null>(null);

  // Payment fields (Preserves Cash On Delivery - COD + Optional Wallet / Loyalty / Gift Card Tender)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('COD');
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);

  // Authoritative Server-Backed Rewards, Wallet & Gift Card Redemption State (Never stored in localStorage)
  const [portalSnapshot, setPortalSnapshot] = useState<CustomerRewardsPortalResponse | null>(null);
  const [applyWalletCredits, setApplyWalletCredits] = useState<boolean>(false);
  const [applyLoyaltyPoints, setApplyLoyaltyPoints] = useState<boolean>(false);
  const [applyGiftCard, setApplyGiftCard] = useState<boolean>(false);
  const [giftCardCodeOrNumber, setGiftCardCodeOrNumber] = useState<string>('');
  const [rewardsPreview, setRewardsPreview] = useState<CheckoutRewardsPreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [redemptionError, setRedemptionError] = useState<string | null>(null);
  const [capturedSummary, setCapturedSummary] = useState<{
    reservationNumber: string;
    walletAppliedInr: number;
    loyaltyPointsRedeemed: number;
    loyaltyDiscountInr: number;
    giftCardAppliedInr: number;
    giftCardNumber?: string | null;
  } | null>(null);

  // Load customer's authoritative Wallet, Loyalty & Claimed Gift Cards from PostgreSQL
  useEffect(() => {
    const activeEmail = (customer?.email || email || '').trim().toLowerCase();
    if (!activeEmail) return;
    let cancelled = false;
    rewardsApi
      .getCustomerPortal(activeEmail)
      .then((snap) => {
        if (!cancelled) setPortalSnapshot(snap);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [customer?.email, email]);

  // Recompute authoritative server preview whenever cart or reward selections change
  const refreshServerRewardsPreview = useCallback(async () => {
    const activeEmail = (customer?.email || email || '').trim().toLowerCase();
    if (!activeEmail || cart.items.length === 0) {
      setRewardsPreview(null);
      return;
    }
    if (!applyWalletCredits && !applyLoyaltyPoints && !applyGiftCard) {
      setRewardsPreview(null);
      setRedemptionError(null);
      return;
    }
    if (applyGiftCard && !giftCardCodeOrNumber.trim()) {
      // Wait until customer selects a claimed card or enters a code
      if (!applyWalletCredits && !applyLoyaltyPoints) {
        setRewardsPreview(null);
        return;
      }
    }

    setPreviewLoading(true);
    setRedemptionError(null);
    try {
      const preview = await rewardsApi.previewCheckoutRewards({
        customerEmail: activeEmail,
        cartSubtotalInr: cart.subtotal,
        couponDiscountInr: cart.discount,
        couponCode: cart.appliedCoupon,
        shippingInr: cart.shippingFee,
        giftWrapInr: cart.giftWrap ? cart.giftWrapFee : 0,
        items: cart.items.map((i) => ({
          productId: i.productId,
          productName: i.productName,
          sku: i.sku,
          quantity: i.quantity,
          totalPrice: i.sellingPrice * i.quantity
        })),
        applyWalletCredits,
        applyLoyaltyPoints,
        applyGiftCard: applyGiftCard && Boolean(giftCardCodeOrNumber.trim()),
        giftCardCodeOrNumber: applyGiftCard ? giftCardCodeOrNumber.trim() : undefined
      });
      setRewardsPreview(preview);
    } catch (err: any) {
      setRedemptionError(err?.message || 'Unable to validate reward redemption right now.');
    } finally {
      setPreviewLoading(false);
    }
  }, [
    customer?.email,
    email,
    cart.items,
    cart.subtotal,
    cart.discount,
    cart.appliedCoupon,
    cart.shippingFee,
    cart.giftWrap,
    cart.giftWrapFee,
    applyWalletCredits,
    applyLoyaltyPoints,
    applyGiftCard,
    giftCardCodeOrNumber
  ]);

  useEffect(() => {
    const t = setTimeout(() => {
      refreshServerRewardsPreview();
    }, 220);
    return () => clearTimeout(t);
  }, [refreshServerRewardsPreview]);

  const handlePincodeChange = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 6);
    setPincode(clean);
    if (clean.length < 3) {
      setPincodeDetectedInfo(null);
      return;
    }
    detectCityAndStateFromPincode(clean, (detected) => {
      setCity(detected.city);
      setState(detected.state);
      if (clean.length === 6) {
        setPincodeDetectedInfo(
          `${detected.city}, ${detected.state}${detected.locality ? ` (${detected.locality})` : ''}`
        );
      } else {
        setPincodeDetectedInfo(`${detected.city}, ${detected.state}`);
      }
    });
  };

  if (!customer && !completedOrder) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6 space-y-4">
        <Lock className="w-12 h-12 text-[#D4AF37]" />
        <h2 className="font-serif text-2xl uppercase tracking-wider text-white">
          Sign In Required for Checkout
        </h2>
        <p className="text-xs text-white/60 max-w-sm">
          Please sign in to your FRAGMORÉ account to add items to your bag and complete your order.
        </p>
        <button
          onClick={() => setIsAuthModalOpen(true)}
          className="px-6 py-2.5 bg-[#D4AF37] text-[#08080A] text-xs font-semibold uppercase tracking-wider rounded cursor-pointer"
        >
          Sign In to Continue
        </button>
      </div>
    );
  }

  if (cart.items.length === 0 && !completedOrder) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6 space-y-4">
        <Package className="w-12 h-12 text-[#D4AF37]" />
        <h2 className="font-serif text-2xl uppercase tracking-wider text-white">Your bag is empty</h2>
        <button
          onClick={() => setCurrentView('shop')}
          className="px-6 py-2.5 bg-[#D4AF37] text-[#08080A] text-xs font-semibold uppercase tracking-wider rounded cursor-pointer"
        >
          Return to Shop
        </button>
      </div>
    );
  }

  const activeEmailLower = (customer?.email || email || '').trim().toLowerCase();
  const effectivePayableInr = rewardsPreview ? rewardsPreview.breakdown.finalPayableInr : cart.total;
  const effectiveGstInr = rewardsPreview ? rewardsPreview.breakdown.gstAmountInr : cart.estimatedTax;
  const claimedActiveCards = (Array.isArray(portalSnapshot?.giftCards) ? portalSnapshot.giftCards : []).filter(
    (gc: any) =>
      gc.paymentStatus === 'PAID' &&
      (gc.status === 'ACTIVE' || gc.status === 'SCHEDULED') &&
      Number(gc.remainingBalanceInr) > 0 &&
      String(gc.claimedByEmail || '').toLowerCase() === activeEmailLower
  );

  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !phone || !addressLine1 || !pincode) {
      return;
    }
    if (customer) {
      addOrUpdateAddress({
        id: customer.addresses?.[0]?.id || 'addr-' + Math.random().toString(36).substring(2, 7),
        fullName,
        email,
        phone,
        addressLine1,
        addressLine2,
        city,
        state,
        pincode,
        isDefault: true
      });
    }
    trackEvent('AddShippingInfo', {
      city,
      state,
      pincode,
      cartTotal: effectivePayableInr
    });
    setStep('payment');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExecutePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setRedemptionError(null);

    if (applyGiftCard && !giftCardCodeOrNumber.trim()) {
      setRedemptionError('Please enter your FRAGMORÉ Gift Card redemption code or select a claimed card.');
      return;
    }

    setIsProcessing(true);

    trackEvent('AddPaymentInfo', {
      paymentMethod,
      cartTotal: effectivePayableInr
    });

    const activeEmail = (customer?.email || email || '').trim().toLowerCase();
    const wantsRewardsRedemption =
      Boolean(activeEmail) &&
      (applyWalletCredits || applyLoyaltyPoints || (applyGiftCard && Boolean(giftCardCodeOrNumber.trim())));

    let reservationRecord: any = null;
    if (wantsRewardsRedemption) {
      try {
        const idempotencyKey = `chk_${activeEmail}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const captureRes = await rewardsApi.redeemCheckoutRewards({
          customerEmail: activeEmail,
          cartSubtotalInr: cart.subtotal,
          couponDiscountInr: cart.discount,
          couponCode: cart.appliedCoupon,
          shippingInr: cart.shippingFee,
          giftWrapInr: cart.giftWrap ? cart.giftWrapFee : 0,
          items: cart.items.map((i) => ({
            productId: i.productId,
            productName: i.productName,
            sku: i.sku,
            quantity: i.quantity,
            totalPrice: i.sellingPrice * i.quantity
          })),
          applyWalletCredits,
          applyLoyaltyPoints,
          applyGiftCard: applyGiftCard && Boolean(giftCardCodeOrNumber.trim()),
          giftCardCodeOrNumber: applyGiftCard ? giftCardCodeOrNumber.trim() : undefined,
          idempotencyKey
        });
        reservationRecord = captureRes.reservation;
      } catch (err: any) {
        setIsProcessing(false);
        setRedemptionError(err?.message || 'Reward or Gift Card validation failed. No funds were deducted.');
        return;
      }
    }

    const finalAmountToPay = reservationRecord
      ? Number(reservationRecord.finalPayableInr)
      : effectivePayableInr;
    const finalTaxAmount = reservationRecord
      ? Number(reservationRecord.gstAmountInr)
      : effectiveGstInr;
    const combinedDiscountInr =
      cart.discount +
      (reservationRecord ? Number(reservationRecord.loyaltyDiscountInr || 0) : 0) +
      (reservationRecord ? Number(reservationRecord.walletAppliedInr || 0) : 0) +
      (reservationRecord ? Number(reservationRecord.giftCardAppliedInr || 0) : 0);

    const redemptionNoteParts: string[] = [];
    if (cart.giftWrap) redemptionNoteParts.push('Includes luxury gift box & golden wax seal.');
    if (reservationRecord) {
      if (Number(reservationRecord.walletAppliedInr) > 0) {
        redemptionNoteParts.push(`Wallet Applied: ₹${Number(reservationRecord.walletAppliedInr).toFixed(2)}`);
      }
      if (Number(reservationRecord.loyaltyPointsRedeemed) > 0) {
        redemptionNoteParts.push(
          `Loyalty Redeemed: ${reservationRecord.loyaltyPointsRedeemed} pts (₹${Number(reservationRecord.loyaltyDiscountInr).toFixed(2)})`
        );
      }
      if (Number(reservationRecord.giftCardAppliedInr) > 0) {
        redemptionNoteParts.push(
          `Gift Card (${reservationRecord.giftCardNumber || 'Applied'}): ₹${Number(reservationRecord.giftCardAppliedInr).toFixed(2)}`
        );
      }
    }

    const orderPayload: any = {
      customerId: customer?.id || 'cust-guest',
      customerName: fullName,
      customerEmail: email,
      customerPhone: phone,
      shippingAddress: {
        id: 'addr-' + Math.random().toString(36).substring(2, 7),
        fullName,
        email,
        phone,
        addressLine1,
        addressLine2,
        city,
        state,
        pincode,
        isDefault: true
      },
      items: [
        ...cart.items.map((i) => ({
          productId: i.productId,
          productName: i.productName,
          size: i.size,
          sku: i.sku,
          quantity: i.quantity,
          unitPrice: i.sellingPrice,
          totalPrice: i.sellingPrice * i.quantity,
          selectedFlavours: i.selectedFlavours
        })),
        ...(cart.subtotal >= 999
          ? [
              {
                productId: 'free-sample-2ml',
                productName: 'FREE GIFT: 2 ml Sample Atomizer',
                size: '2 ml',
                sku: 'FRG-GIFT-2ML',
                quantity: 1,
                unitPrice: 0,
                totalPrice: 0
              }
            ]
          : []),
        ...(cart.subtotal >= 2499
          ? [
              {
                productId: 'free-aura-15ml',
                productName: 'FREE GIFT: One Aura Perfume',
                size: '15 ml',
                sku: 'FRG-GIFT-AURA15',
                quantity: 1,
                unitPrice: 0,
                totalPrice: 0
              }
            ]
          : [])
      ],
      subtotal: cart.subtotal,
      discount: combinedDiscountInr,
      couponCode: cart.appliedCoupon || undefined,
      taxAmount: finalTaxAmount,
      shippingAmount: cart.shippingFee,
      totalAmount: finalAmountToPay,
      paymentMethod: 'COD',
      paymentStatus: finalAmountToPay <= 0 ? 'PAID' : 'PENDING',
      transactionId:
        finalAmountToPay <= 0
          ? `REWARDS_SETTLED_${Math.floor(10000000 + Math.random() * 90000000)}`
          : `COD_${Math.floor(10000000 + Math.random() * 90000000)}`,
      orderStatus: 'CONFIRMED',
      attribution: {
        ...attribution,
        landingPage: window.location.pathname
      },
      notes: redemptionNoteParts.length > 0 ? redemptionNoteParts.join(' · ') : undefined,
      rewardsRedemption: reservationRecord
        ? {
            alreadyCapturedOnServer: true,
            reservationId: reservationRecord.id
          }
        : undefined
    };

    const order = createOrder(orderPayload);

    if (reservationRecord) {
      setCapturedSummary({
        reservationNumber: reservationRecord.reservationNumber,
        walletAppliedInr: Number(reservationRecord.walletAppliedInr) || 0,
        loyaltyPointsRedeemed: Number(reservationRecord.loyaltyPointsRedeemed) || 0,
        loyaltyDiscountInr: Number(reservationRecord.loyaltyDiscountInr) || 0,
        giftCardAppliedInr: Number(reservationRecord.giftCardAppliedInr) || 0,
        giftCardNumber: reservationRecord.giftCardNumber
      });
      showNotification(`Order ${order.orderNumber} confirmed with FRAGMORÉ Rewards & Tender applied.`);
    }

    setCompletedOrder(order);
    setIsProcessing(false);
    setStep('confirmation');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderRewardsRedemptionControls = () => {
    const availWallet = Number(portalSnapshot?.wallet?.totalAvailableInr || 0);
    const availPoints = Number(portalSnapshot?.loyalty?.availablePoints || 0);
    const tierName = portalSnapshot?.loyalty?.currentTier?.tierName || 'Silver Member';

    return (
      <div className="bg-[#121218] border border-[#D4AF37]/30 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#D4AF37]" />
            <h4 className="font-serif text-sm tracking-wider uppercase text-white">
              FRAGMORÉ Wallet, Privileges &amp; Gift Card
            </h4>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-[#D4AF37]">
            {tierName}
          </span>
        </div>

        <div className="space-y-2.5 text-xs font-mono">
          {/* 1. Apply Wallet Credits */}
          <label className="flex items-start justify-between gap-3 p-3 rounded-lg bg-[#08080A] border border-white/10 hover:border-[#D4AF37]/40 cursor-pointer transition-colors">
            <div className="flex items-start gap-2.5">
              <input
                type="checkbox"
                checked={applyWalletCredits}
                disabled={availWallet <= 0}
                onChange={(e) => setApplyWalletCredits(e.target.checked)}
                className="mt-0.5 accent-[#D4AF37]"
              />
              <div>
                <span className="text-white font-semibold flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>Apply eligible Wallet Credits</span>
                </span>
                <span className="text-[11px] text-white/50 block mt-0.5 font-sans">
                  Available Balance: ₹{availWallet.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (Auto-applies earliest expiring eligible credits)
                </span>
              </div>
            </div>
            {rewardsPreview && rewardsPreview.breakdown.walletCreditsAppliedInr > 0 && (
              <span className="text-emerald-400 font-bold shrink-0 tabular-nums">
                -₹{rewardsPreview.breakdown.walletCreditsAppliedInr.toLocaleString('en-IN')}
              </span>
            )}
          </label>

          {/* 2. Redeem Loyalty Points */}
          <label className="flex items-start justify-between gap-3 p-3 rounded-lg bg-[#08080A] border border-white/10 hover:border-[#D4AF37]/40 cursor-pointer transition-colors">
            <div className="flex items-start gap-2.5">
              <input
                type="checkbox"
                checked={applyLoyaltyPoints}
                disabled={availPoints < 100}
                onChange={(e) => setApplyLoyaltyPoints(e.target.checked)}
                className="mt-0.5 accent-[#D4AF37]"
              />
              <div>
                <span className="text-white font-semibold flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>Redeem FRAGMORÉ Privileges Points</span>
                </span>
                <span className="text-[11px] text-white/50 block mt-0.5 font-sans">
                  Available: {availPoints.toLocaleString('en-IN')} pts (100 pts = ₹10 · Min 100 pts · Up to tier cap)
                </span>
              </div>
            </div>
            {rewardsPreview && rewardsPreview.breakdown.loyaltyDiscountInr > 0 && (
              <span className="text-emerald-400 font-bold shrink-0 tabular-nums">
                -₹{rewardsPreview.breakdown.loyaltyDiscountInr.toLocaleString('en-IN')}
              </span>
            )}
          </label>

          {/* 3. Redeem Gift Card */}
          <div className="p-3 rounded-lg bg-[#08080A] border border-white/10 space-y-2.5">
            <label className="flex items-start justify-between gap-3 cursor-pointer">
              <div className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={applyGiftCard}
                  onChange={(e) => setApplyGiftCard(e.target.checked)}
                  className="mt-0.5 accent-[#D4AF37]"
                />
                <div>
                  <span className="text-white font-semibold flex items-center gap-1.5">
                    <Gift className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span>Redeem FRAGMORÉ Gift Card</span>
                  </span>
                  <span className="text-[11px] text-white/50 block mt-0.5 font-sans">
                    Supports partial redemption — unused balance remains active on your card
                  </span>
                </div>
              </div>
              {rewardsPreview && rewardsPreview.breakdown.giftCardAppliedInr > 0 && (
                <span className="text-emerald-400 font-bold shrink-0 tabular-nums">
                  -₹{rewardsPreview.breakdown.giftCardAppliedInr.toLocaleString('en-IN')}
                </span>
              )}
            </label>

            {applyGiftCard && (
              <div className="pl-6 space-y-2 pt-1">
                {claimedActiveCards.length > 0 && (
                  <select
                    value={claimedActiveCards.some((c: any) => c.cardNumber === giftCardCodeOrNumber) ? giftCardCodeOrNumber : ''}
                    onChange={(e) => {
                      if (e.target.value) setGiftCardCodeOrNumber(e.target.value);
                    }}
                    className="w-full bg-[#121218] border border-white/20 rounded px-3 py-2 text-xs text-white focus:border-[#D4AF37] focus:outline-none"
                  >
                    <option value="">Select a claimed Gift Card from your vault...</option>
                    {claimedActiveCards.map((gc: any) => (
                      <option key={gc.id} value={gc.cardNumber}>
                        {gc.cardNumber} ({gc.maskedCode}) — Balance ₹{Number(gc.remainingBalanceInr).toLocaleString('en-IN')}
                      </option>
                    ))}
                  </select>
                )}
                <input
                  type="text"
                  value={giftCardCodeOrNumber}
                  onChange={(e) => setGiftCardCodeOrNumber(e.target.value.toUpperCase())}
                  placeholder="Enter code FRGM-XXXX-XXXX-XXXX or claimed GC-FRG-..."
                  className="w-full bg-[#121218] border border-white/20 rounded px-3 py-2 text-xs text-white uppercase tracking-wider focus:border-[#D4AF37] focus:outline-none"
                />
              </div>
            )}
          </div>
        </div>

        {previewLoading && (
          <p className="text-[11px] font-mono text-[#D4AF37]">
            Validating balances with FRAGMORÉ Firebase Firestore ledger...
          </p>
        )}

        {rewardsPreview?.warnings && rewardsPreview.warnings.length > 0 && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-1 text-[11px] text-amber-200 font-sans">
            {rewardsPreview.warnings.map((w, idx) => (
              <div key={idx} className="flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-[#D4AF37] shrink-0 mt-0.5" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

        {redemptionError && (
          <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{redemptionError}</span>
          </div>
        )}
      </div>
    );
  };

  const renderOrderPriceBreakdown = () => (
    <div className="space-y-1.5 text-xs font-mono pt-3 border-t border-white/10 text-white/70">
      <div className="flex justify-between">
        <span>Cart Subtotal</span>
        <span className="text-white tabular-nums">₹{cart.subtotal.toLocaleString('en-IN')}</span>
      </div>
      {cart.discount > 0 && (
        <div className="flex justify-between text-emerald-400">
          <span>Coupon Discount ({cart.appliedCoupon})</span>
          <span className="tabular-nums">-₹{cart.discount.toLocaleString('en-IN')}</span>
        </div>
      )}
      {rewardsPreview && rewardsPreview.breakdown.loyaltyDiscountInr > 0 && (
        <div className="flex justify-between text-emerald-400">
          <span>Loyalty Redemption ({rewardsPreview.breakdown.loyaltyPointsRedeemed} pts)</span>
          <span className="tabular-nums">-₹{rewardsPreview.breakdown.loyaltyDiscountInr.toLocaleString('en-IN')}</span>
        </div>
      )}
      {rewardsPreview && rewardsPreview.breakdown.promoWalletAppliedInr > 0 && (
        <div className="flex justify-between text-emerald-400">
          <span>Promotional Wallet Credit</span>
          <span className="tabular-nums">-₹{rewardsPreview.breakdown.promoWalletAppliedInr.toLocaleString('en-IN')}</span>
        </div>
      )}
      {cart.giftWrap && (
        <div className="flex justify-between">
          <span>Gift Box Wrap</span>
          <span className="tabular-nums">₹{cart.giftWrapFee}</span>
        </div>
      )}
      <div className="flex justify-between">
        <span>Shipping</span>
        <span className={cart.shippingFee === 0 ? 'text-emerald-400 font-semibold' : 'tabular-nums'}>
          {cart.shippingFee === 0 ? 'COMPLIMENTARY' : `₹${cart.shippingFee}`}
        </span>
      </div>
      <div className="flex justify-between text-[11px] text-white/40">
        <span>Applicable GST (18%)</span>
        <span className="tabular-nums">₹{effectiveGstInr.toLocaleString('en-IN')}</span>
      </div>
      {rewardsPreview && rewardsPreview.breakdown.refundWalletAppliedInr > 0 && (
        <div className="flex justify-between text-[#E5C378]">
          <span>Wallet Refund Store Credit Applied</span>
          <span className="tabular-nums">-₹{rewardsPreview.breakdown.refundWalletAppliedInr.toLocaleString('en-IN')}</span>
        </div>
      )}
      {rewardsPreview && rewardsPreview.breakdown.giftCardAppliedInr > 0 && (
        <div className="flex justify-between text-[#E5C378]">
          <span>
            Gift Card Value Applied{' '}
            {rewardsPreview.verifiedGiftCard?.cardNumber ? `(${rewardsPreview.verifiedGiftCard.cardNumber})` : ''}
          </span>
          <span className="tabular-nums">-₹{rewardsPreview.breakdown.giftCardAppliedInr.toLocaleString('en-IN')}</span>
        </div>
      )}
      <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-white/10">
        <span>Final Amount Payable</span>
        <span className="text-[#D4AF37] tabular-nums">
          ₹{effectivePayableInr.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#08080A] text-[#F3EFE6] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* CHECKOUT HEADER */}
        <div className="flex items-center justify-between pb-8 border-b border-white/10 mb-10">
          <div>
            <span className="text-xs font-mono tracking-widest text-[#D4AF37] uppercase">
              Secure Encrypted Checkout
            </span>
            <h1 className="font-serif text-2xl sm:text-3xl tracking-widest font-light text-white uppercase">
              FRAGMORÉ Concierge
            </h1>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
            <Lock className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">256-Bit SSL Secured</span>
          </div>
        </div>

        {/* STEPPER TEXT REPRESENTATION */}
        {step !== 'confirmation' && (
          <div className="flex items-center gap-3 text-xs font-mono tracking-widest uppercase mb-8 text-white/50">
            <span className={step === 'address' ? 'text-[#D4AF37] font-semibold' : 'text-white'}>
              01 Delivery Address
            </span>
            <span>→</span>
            <span className={step === 'payment' ? 'text-[#D4AF37] font-semibold' : ''}>
              02 Secure Payment
            </span>
            <span>→</span>
            <span>03 Confirmation</span>
          </div>
        )}

        {/* STEP 1: ADDRESS FORM */}
        {step === 'address' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-7">
              <form onSubmit={handleAddressSubmit} className="space-y-6">
                <div className="bg-[#121218] border border-white/10 rounded-xl p-6 sm:p-8 space-y-4">
                  <h3 className="font-serif text-lg tracking-wider uppercase text-white mb-2">
                    Shipping &amp; Contact Information
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-mono text-white/70 block">Full Name *</label>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Rohan Mehra"
                        className="w-full bg-[#08080A] border border-white/20 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-mono text-white/70 block">Phone (+91) *</label>
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+91 98201 44521"
                        className="w-full bg-[#08080A] border border-white/20 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#D4AF37] font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-mono text-white/70 block">Email Address *</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="rohan.mehra@gmail.com"
                      className="w-full bg-[#08080A] border border-white/20 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                    />
                    <span className="text-[10px] text-white/40 block">
                      Order confirmation &amp; AWB tracking sent here.
                    </span>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-mono text-white/70 block">
                      Flat / House No. / Building / Street *
                    </label>
                    <input
                      type="text"
                      required
                      value={addressLine1}
                      onChange={(e) => setAddressLine1(e.target.value)}
                      placeholder="Penthouse 14B, Lodha Bellissimo"
                      className="w-full bg-[#08080A] border border-white/20 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-mono text-white/70 block">
                      Area / Landmark (Optional)
                    </label>
                    <input
                      type="text"
                      value={addressLine2}
                      onChange={(e) => setAddressLine2(e.target.value)}
                      placeholder="NM Joshi Marg, Mahalaxmi"
                      className="w-full bg-[#08080A] border border-white/20 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-mono text-white/70 block">PIN Code *</label>
                      <input
                        type="text"
                        required
                        maxLength={6}
                        value={pincode}
                        onChange={(e) => handlePincodeChange(e.target.value)}
                        placeholder="e.g. 400011"
                        className="w-full bg-[#08080A] border border-white/20 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#D4AF37] font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-mono text-white/70 block">City *</label>
                      <input
                        type="text"
                        required
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Auto-detected from PIN"
                        className="w-full bg-[#08080A] border border-white/20 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-mono text-white/70 block">State *</label>
                      <input
                        type="text"
                        required
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        placeholder="Auto-detected from PIN"
                        className="w-full bg-[#08080A] border border-white/20 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                      />
                    </div>
                  </div>
                  {pincodeDetectedInfo && (
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span>Location detected from PIN code: {pincodeDetectedInfo}</span>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full py-4 bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] font-semibold text-xs tracking-[0.2em] uppercase rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#D4AF37]/20 cursor-pointer"
                >
                  <span>Continue to Payment</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>

            {/* ORDER SUMMARY & REWARDS PREVIEW RIGHT */}
            <div className="lg:col-span-5 space-y-5">
              {renderRewardsRedemptionControls()}

              <div className="bg-[#121218] border border-white/10 rounded-xl p-6 space-y-4">
                <h3 className="font-serif text-lg tracking-wider uppercase text-white border-b border-white/10 pb-3">
                  Bag Summary ({cart.items.reduce((s, i) => s + i.quantity, 0)})
                </h3>
                <div className="space-y-3 max-h-60 overflow-y-auto divide-y divide-white/5 pr-1">
                  {cart.items.map((i) => (
                    <div key={i.variantId} className="pt-3 first:pt-0 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-serif text-white uppercase block">{i.productName}</span>
                        <span className="text-[11px] font-mono text-[#A3A3B0]">
                          {i.size} × {i.quantity}
                        </span>
                      </div>
                      <span className="font-mono text-white font-medium tabular-nums">
                        ₹{(i.sellingPrice * i.quantity).toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                  {cart.subtotal >= 999 && (
                    <div className="pt-3 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-serif text-emerald-400 uppercase block">2 ml Sample Atomizer</span>
                        <span className="text-[11px] font-mono text-emerald-400/70">
                          ₹999+ Complimentary Gift × 1
                        </span>
                      </div>
                      <span className="font-mono text-emerald-400 font-bold">FREE</span>
                    </div>
                  )}
                  {cart.subtotal >= 2499 && (
                    <div className="pt-3 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-serif text-[#D4AF37] uppercase block">One Aura Perfume (15 ml)</span>
                        <span className="text-[11px] font-mono text-[#D4AF37]/80">
                          ₹2,499+ Complimentary Gift × 1
                        </span>
                      </div>
                      <span className="font-mono text-[#D4AF37] font-bold">FREE</span>
                    </div>
                  )}
                </div>

                {renderOrderPriceBreakdown()}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: PAYMENT METHOD & REWARDS TENDER */}
        {step === 'payment' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-7">
              <form onSubmit={handleExecutePayment} className="space-y-6">
                {renderRewardsRedemptionControls()}

                <div className="bg-[#121218] border border-white/10 rounded-xl p-6 sm:p-8 space-y-6">
                  <h3 className="font-serif text-lg tracking-wider uppercase text-white">
                    {effectivePayableInr <= 0
                      ? 'Balance Fully Covered by FRAGMORÉ Rewards / Gift Card'
                      : 'Payment Method for Remaining Balance'}
                  </h3>

                  {effectivePayableInr <= 0 ? (
                    <div className="p-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 flex items-start gap-3 text-xs">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <strong className="text-white font-mono uppercase block">
                          ₹0 Remaining Payable — Instant Settlement
                        </strong>
                        <p className="text-white/70 font-light">
                          Your entire order value is settled by your applied FRAGMORÉ Wallet / Gift Card tender. No additional cash payment is required on delivery.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <label
                        onClick={() => setPaymentMethod('COD')}
                        className="flex items-start gap-4 p-4 rounded-xl border border-[#D4AF37] bg-[#D4AF37]/10 cursor-pointer transition-all"
                      >
                        <input
                          type="radio"
                          name="payMethod"
                          checked={paymentMethod === 'COD'}
                          onChange={() => setPaymentMethod('COD')}
                          className="mt-1 accent-[#D4AF37]"
                        />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <Truck className="w-4 h-4 text-[#D4AF37]" />
                            <strong className="text-white text-xs uppercase font-mono">
                              Cash On Delivery (COD)
                            </strong>
                          </div>
                          <p className="text-[11px] text-white/60 font-light">
                            Pay ₹{effectivePayableInr.toLocaleString('en-IN')} at your doorstep when your order arrives.
                          </p>
                        </div>
                      </label>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setStep('address')}
                    className="px-6 py-4 border border-white/20 rounded-lg text-xs font-mono uppercase tracking-wider text-white/80 hover:text-white cursor-pointer"
                  >
                    ← Back to Address
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessing || previewLoading}
                    className="flex-1 py-4 bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] font-semibold text-xs tracking-[0.2em] uppercase rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#D4AF37]/20 disabled:opacity-50 cursor-pointer"
                  >
                    {isProcessing ? (
                      <span>Locking Ledger &amp; Confirming Order...</span>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>
                          {effectivePayableInr <= 0
                            ? 'Confirm Fully Settled Order (₹0 Payable)'
                            : `Place COD Order (₹${effectivePayableInr.toLocaleString('en-IN')})`}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Delivery address + itemized breakdown review */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-[#121218] border border-white/10 rounded-xl p-6 space-y-4 text-xs">
                <h4 className="font-serif text-base tracking-wider uppercase text-white border-b border-white/10 pb-2">
                  Delivering To:
                </h4>
                <p className="font-medium text-white">{fullName}</p>
                <p className="text-white/70">
                  {addressLine1} {addressLine2}
                </p>
                <p className="text-white/70">
                  {city}, {state} - {pincode}
                </p>
                <p className="text-white/70 font-mono">Phone: {phone}</p>

                {renderOrderPriceBreakdown()}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: ORDER CONFIRMATION SCREEN */}
        {step === 'confirmation' && completedOrder && (
          <div className="max-w-2xl mx-auto bg-[#121218] border border-[#D4AF37]/40 rounded-2xl p-8 sm:p-12 text-center space-y-6 animate-in fade-in zoom-in-95 duration-500 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37] flex items-center justify-center mx-auto text-[#D4AF37]">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <span className="text-xs font-mono tracking-[0.3em] uppercase text-[#D4AF37] block">
                Payment Authorized &amp; Verified
              </span>
              <h2 className="font-serif text-3xl sm:text-4xl tracking-widest uppercase font-light text-white">
                Order Confirmed
              </h2>
              <p className="text-xs text-white/60 font-mono">
                Order ID: <strong className="text-white">{completedOrder.orderNumber}</strong> · Txn:{' '}
                {completedOrder.transactionId}
              </p>
            </div>

            <div className="p-4 bg-white/5 rounded-xl border border-white/10 text-left text-xs font-mono space-y-2 text-white/80">
              <div className="flex justify-between">
                <span>Customer:</span>
                <span className="text-white">{completedOrder.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span>Dispatched To:</span>
                <span className="text-white">
                  {completedOrder.shippingAddress.city}, {completedOrder.shippingAddress.pincode}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Payment Mode:</span>
                <span className="text-white">
                  {completedOrder.totalAmount <= 0 ? 'FRAGMORÉ Wallet / Gift Card Settled' : completedOrder.paymentMethod}
                </span>
              </div>
              {capturedSummary && (
                <>
                  {capturedSummary.walletAppliedInr > 0 && (
                    <div className="flex justify-between text-emerald-400">
                      <span>Wallet Credits Redeemed:</span>
                      <span>-₹{capturedSummary.walletAppliedInr.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  {capturedSummary.loyaltyDiscountInr > 0 && (
                    <div className="flex justify-between text-emerald-400">
                      <span>Privileges Points Redeemed ({capturedSummary.loyaltyPointsRedeemed} pts):</span>
                      <span>-₹{capturedSummary.loyaltyDiscountInr.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  {capturedSummary.giftCardAppliedInr > 0 && (
                    <div className="flex justify-between text-[#E5C378]">
                      <span>Gift Card Applied ({capturedSummary.giftCardNumber || 'Card'}):</span>
                      <span>-₹{capturedSummary.giftCardAppliedInr.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                </>
              )}
              <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-white/10">
                <span>Final Payable Amount:</span>
                <span className="text-[#D4AF37]">
                  ₹{completedOrder.totalAmount.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Actions: View Invoice, Track Order, Return to Store */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
              <button
                onClick={() => setSelectedOrderForInvoice(completedOrder)}
                className="w-full sm:w-auto px-6 py-3 border border-[#D4AF37]/50 hover:border-[#D4AF37] text-[#E5C378] text-xs font-mono uppercase tracking-wider rounded flex items-center justify-center gap-2 cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>View GST Tax Invoice</span>
              </button>
              <button
                onClick={() => {
                  setCurrentView('account');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="w-full sm:w-auto px-6 py-3 bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] text-xs font-semibold uppercase tracking-wider rounded flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Open Account &amp; Rewards</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
