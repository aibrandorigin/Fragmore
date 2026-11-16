import React, { useState, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { rewardsApi } from '../../lib/rewardsApi';
import {
  Gift,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  Calendar,
  ArrowRight,
  ArrowLeft,
  Copy,
  Search,
  Lock,
  Building2,
  CreditCard
} from 'lucide-react';

const PRESET_DENOMINATIONS = [500, 1000, 2000, 3000, 5000];

const OCCASIONS = [
  'Birthday',
  'Anniversary',
  'Wedding',
  'Congratulations',
  'Festival',
  'Thank You',
  'Corporate Gift'
];

const CARD_TEMPLATES = [
  {
    id: 'ivory-champagne-atelier',
    name: 'Ivory & Champagne Atelier',
    subtitle: 'Signature Warm Parchment & Gold Foil',
    bgClass: 'bg-gradient-to-br from-[#FAF8F4] via-[#F2ECE1] to-[#E6DEC8] text-[#24211D] border-[#9A783E]/50',
    accentClass: 'text-[#9A783E]'
  },
  {
    id: 'obsidian-gold-monolith',
    name: 'Obsidian & 24K Monolith',
    subtitle: 'Nocturnal Worli Vault Edition',
    bgClass: 'bg-gradient-to-br from-[#0B0B0F] via-[#15151E] to-[#231F18] text-[#FAF8F4] border-[#D4AF37]/50',
    accentClass: 'text-[#D4AF37]'
  },
  {
    id: 'royal-wedding-coffret',
    name: 'Royal Trousseau Coffret',
    subtitle: 'Velvet Crimson & Antique Brass',
    bgClass: 'bg-gradient-to-br from-[#2B0F16] via-[#3D1520] to-[#1D0B10] text-[#FAF8F4] border-[#E5C378]/50',
    accentClass: 'text-[#E5C378]'
  },
  {
    id: 'festive-saffron-silk',
    name: 'Sacred Saffron & Mysuru Silk',
    subtitle: 'Celebratory Amber & Sandalwood',
    bgClass: 'bg-gradient-to-br from-[#3B2313] via-[#54321B] to-[#24150B] text-[#FAF8F4] border-[#F0C775]/50',
    accentClass: 'text-[#F0C775]'
  }
];

export const GiftCardsStoreView: React.FC = () => {
  const { customer, setCurrentView, setIsAuthModalOpen, showNotification } = useStore();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [cardFormat, setCardFormat] = useState<'DIGITAL' | 'PHYSICAL'>('DIGITAL');
  const [selectedPreset, setSelectedPreset] = useState<number | 'CUSTOM'>(2000);
  const [customAmount, setCustomAmount] = useState<string>('2500');
  const [templateId, setTemplateId] = useState<string>(CARD_TEMPLATES[0].id);

  // Step 2: Personalization
  const [occasion, setOccasion] = useState<string>('Birthday');
  const [recipientName, setRecipientName] = useState<string>('');
  const [recipientEmail, setRecipientEmail] = useState<string>('');
  const [recipientPhone, setRecipientPhone] = useState<string>('');
  const [senderName, setSenderName] = useState<string>(customer?.name || '');
  const [purchaserEmail, setPurchaserEmail] = useState<string>(customer?.email || '');
  const [personalMessage, setPersonalMessage] = useState<string>(
    'May you discover a signature scent that lingers as beautifully as this moment.'
  );
  const [scheduledDate, setScheduledDate] = useState<string>(new Date().toISOString().slice(0, 10));

  // Step 3: Payment & Issuance State
  const [paymentMode, setPaymentMode] = useState<'INSTANT_VERIFIED_PREPAID' | 'CREATE_PENDING_ORDER'>(
    'INSTANT_VERIFIED_PREPAID'
  );
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdOrderResult, setCreatedOrderResult] = useState<any | null>(null);

  // Balance Inquiry & Claim Drawer State
  const [lookupCode, setLookupCode] = useState<string>('');
  const [lookupLoading, setLookupLoading] = useState<boolean>(false);
  const [lookupResult, setLookupResult] = useState<any | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  useEffect(() => {
    if (customer?.name && !senderName) setSenderName(customer.name);
    if (customer?.email && !purchaserEmail) setPurchaserEmail(customer.email);
  }, [customer, senderName, purchaserEmail]);

  const effectiveAmount =
    selectedPreset === 'CUSTOM' ? Math.max(0, Number(customAmount) || 0) : selectedPreset;

  const activeTemplate = CARD_TEMPLATES.find((t) => t.id === templateId) || CARD_TEMPLATES[0];

  const handleProceedToStep2 = () => {
    setErrorMsg(null);
    if (effectiveAmount < 250 || effectiveAmount > 25000) {
      setErrorMsg('Please choose a gift card value between ₹250 and ₹25,000.');
      return;
    }
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleProceedToStep3 = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!recipientName.trim() || !senderName.trim() || !purchaserEmail.trim()) {
      setErrorMsg('Recipient name, your name, and your receipt email are required.');
      return;
    }
    if (cardFormat === 'DIGITAL' && !recipientEmail.trim() && !recipientPhone.trim()) {
      setErrorMsg('Please provide the recipient’s email address or WhatsApp mobile number for digital delivery.');
      return;
    }
    setStep(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCompletePurchase = async () => {
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const isInstantPaid = paymentMode === 'INSTANT_VERIFIED_PREPAID';
      const payRef = isInstantPaid ? `UPI-FRGM-${Date.now().toString().slice(-8)}` : undefined;
      const res = await rewardsApi.purchaseGiftCard({
        cardFormat,
        templateId,
        occasion,
        amountInr: effectiveAmount,
        purchaserCustomerId: customer?.id,
        purchaserName: senderName.trim(),
        purchaserEmail: purchaserEmail.trim(),
        senderName: senderName.trim(),
        recipientName: recipientName.trim(),
        recipientEmail: recipientEmail.trim() || undefined,
        recipientPhone: recipientPhone.trim() || undefined,
        personalMessage: personalMessage.trim(),
        scheduledDeliveryDate: scheduledDate,
        paymentMethodUsed: 'UPI_CARD_NETBANKING',
        verifiedGatewayPayment: isInstantPaid,
        paymentReference: payRef
      });
      setCreatedOrderResult(res);
      showNotification(
        isInstantPaid
          ? `Gift Card ${res.giftCard.cardNumber} activated & ready!`
          : `Gift Card ${res.giftCard.cardNumber} created in PENDING_PAYMENT state.`
      );
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to process Gift Card order.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmPendingCardPayment = async () => {
    if (!createdOrderResult?.giftCard?.id) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const ref = `PGW-VERIFIED-${Date.now().toString().slice(-8)}`;
      const activated = await rewardsApi.confirmGiftCardPayment(
        createdOrderResult.giftCard.id,
        ref,
        purchaserEmail.trim()
      );
      setCreatedOrderResult(activated);
      showNotification(`Payment verified! Gift Card ${activated.giftCard.cardNumber} is now ACTIVE.`);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBalanceLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupCode.trim()) return;
    setLookupLoading(true);
    setLookupError(null);
    setLookupResult(null);
    try {
      const res = await rewardsApi.inquireGiftCardBalance(lookupCode.trim(), customer?.email);
      setLookupResult(res.giftCard);
    } catch (err: any) {
      setLookupError(err.message);
    } finally {
      setLookupLoading(false);
    }
  };

  const handleClaimLookedUpCard = async () => {
    if (!customer?.email) {
      setIsAuthModalOpen(true);
      return;
    }
    setLookupLoading(true);
    setLookupError(null);
    try {
      const res = await rewardsApi.claimGiftCard(lookupCode.trim(), customer.email, customer.id);
      setLookupResult(res.giftCard);
      showNotification(`Gift Card ${res.giftCard.cardNumber} claimed to your FRAGMORÉ account!`);
    } catch (err: any) {
      setLookupError(err.message);
    } finally {
      setLookupLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-16">
        {/* HERO HEADER */}
        <div className="border-b border-[var(--border-subtle)] pb-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="text-xs font-mono uppercase tracking-[0.28em] text-[var(--accent-gold)]">
              Maison Gifting Atelier · Worli, Mumbai
            </div>
            <h1 className="font-serif text-3xl sm:text-5xl tracking-[0.14em] uppercase font-normal text-[var(--text-main)]">
              Gift FRAGMORÉ
            </h1>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed font-light">
              Offer the luxury of personal scent selection. Redeemable online across our Signature Collection, Aura
              creations, Discovery Sets, and in person at FRAGMORÉ Perfume Bar experiences.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-mono uppercase tracking-wider text-[var(--text-secondary)]">
            <span className={step === 1 ? 'text-[var(--accent-gold)] font-semibold' : ''}>01 Select Value</span>
            <span>→</span>
            <span className={step === 2 ? 'text-[var(--accent-gold)] font-semibold' : ''}>02 Personalize</span>
            <span>→</span>
            <span className={step === 3 ? 'text-[var(--accent-gold)] font-semibold' : ''}>03 Payment &amp; Issue</span>
          </div>
        </div>

        {/* MAIN 2-COLUMN BUILDER + LIVE ATELIER CARD PREVIEW */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* LEFT: 3-STEP INTERACTIVE FLOW */}
          <div className="lg:col-span-7 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-6 sm:p-9 shadow-xs space-y-7">
            {errorMsg && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 text-xs font-mono">
                {errorMsg}
              </div>
            )}

            {/* STEP 1: CHOOSE DENOMINATION, FORMAT & TEMPLATE */}
            {step === 1 && !createdOrderResult && (
              <div className="space-y-7">
                <div className="space-y-2">
                  <span className="text-[11px] font-mono uppercase tracking-[0.22em] text-[var(--accent-gold)] block">
                    Step 01 of 03
                  </span>
                  <h2 className="font-serif text-2xl uppercase tracking-wider text-[var(--text-main)]">
                    Choose Presentation &amp; Value
                  </h2>
                </div>

                {/* Format Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {[
                    {
                      id: 'DIGITAL' as const,
                      title: 'Digital Gift Card',
                      desc: 'Instant or scheduled email & WhatsApp concierge delivery'
                    },
                    {
                      id: 'PHYSICAL' as const,
                      title: 'Physical Luxury Card',
                      desc: 'Gold-foiled keepsake card sealed in a FRAGMORÉ Worli envelope'
                    }
                  ].map((fmt) => (
                    <button
                      key={fmt.id}
                      type="button"
                      onClick={() => setCardFormat(fmt.id)}
                      className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                        cardFormat === fmt.id
                          ? 'border-[var(--accent-gold)] bg-[var(--bg-secondary)]/70'
                          : 'border-[var(--border-subtle)] bg-[var(--bg-main)] hover:border-[var(--accent-gold)]/50'
                      }`}
                    >
                      <div className="font-serif text-sm uppercase tracking-wider text-[var(--text-main)] font-semibold">
                        {fmt.title}
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">{fmt.desc}</p>
                    </button>
                  ))}
                </div>

                {/* Denomination Grid */}
                <div className="space-y-3">
                  <label className="text-xs font-mono uppercase tracking-wider text-[var(--text-secondary)] block">
                    Select Denomination (INR)
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                    {PRESET_DENOMINATIONS.map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setSelectedPreset(amt)}
                        className={`py-3 px-2 rounded-xl border font-mono text-xs font-semibold tabular-nums transition-all cursor-pointer ${
                          selectedPreset === amt
                            ? 'bg-[var(--text-main)] text-[var(--bg-main)] border-[var(--text-main)]'
                            : 'bg-[var(--bg-main)] text-[var(--text-main)] border-[var(--border-subtle)] hover:border-[var(--accent-gold)]'
                        }`}
                      >
                        ₹{amt.toLocaleString('en-IN')}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setSelectedPreset('CUSTOM')}
                      className={`py-3 px-2 rounded-xl border font-mono text-xs font-semibold uppercase transition-all cursor-pointer ${
                        selectedPreset === 'CUSTOM'
                          ? 'bg-[var(--text-main)] text-[var(--bg-main)] border-[var(--text-main)]'
                          : 'bg-[var(--bg-main)] text-[var(--text-main)] border-[var(--border-subtle)] hover:border-[var(--accent-gold)]'
                      }`}
                    >
                      Custom
                    </button>
                  </div>

                  {selectedPreset === 'CUSTOM' && (
                    <div className="pt-2">
                      <label className="text-[11px] font-mono text-[var(--text-secondary)] block mb-1">
                        Enter Custom Value (₹250 – ₹25,000)
                      </label>
                      <input
                        type="number"
                        min={250}
                        max={25000}
                        step={50}
                        value={customAmount}
                        onChange={(e) => setCustomAmount(e.target.value)}
                        className="w-full sm:w-64 bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-xl px-4 py-2.5 font-mono text-sm tabular-nums text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-gold)]"
                      />
                    </div>
                  )}
                </div>

                {/* Card Aesthetic Template */}
                <div className="space-y-3">
                  <label className="text-xs font-mono uppercase tracking-wider text-[var(--text-secondary)] block">
                    Card Aesthetic
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {CARD_TEMPLATES.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => setTemplateId(tpl.id)}
                        className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                          templateId === tpl.id
                            ? 'border-[var(--accent-gold)] bg-[var(--bg-secondary)]/60'
                            : 'border-[var(--border-subtle)] bg-[var(--bg-main)] hover:border-[var(--accent-gold)]/50'
                        }`}
                      >
                        <div className="font-serif text-xs uppercase tracking-wider font-semibold text-[var(--text-main)]">
                          {tpl.name}
                        </div>
                        <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">{tpl.subtitle}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleProceedToStep2}
                  className="w-full py-4 rounded-xl bg-[var(--text-main)] hover:bg-[var(--accent-gold)] text-[var(--bg-main)] text-xs font-mono font-semibold uppercase tracking-[0.22em] transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Personalize Gift Card</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* STEP 2: PERSONALIZE */}
            {step === 2 && !createdOrderResult && (
              <form onSubmit={handleProceedToStep3} className="space-y-5">
                <div className="space-y-2">
                  <span className="text-[11px] font-mono uppercase tracking-[0.22em] text-[var(--accent-gold)] block">
                    Step 02 of 03
                  </span>
                  <h2 className="font-serif text-2xl uppercase tracking-wider text-[var(--text-main)]">
                    Personalize Your Dedication
                  </h2>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-mono uppercase tracking-wider text-[var(--text-secondary)] block">
                    Occasion
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {OCCASIONS.map((occ) => (
                      <button
                        key={occ}
                        type="button"
                        onClick={() => setOccasion(occ)}
                        className={`px-3.5 py-1.5 rounded-lg border text-xs font-mono transition-colors cursor-pointer ${
                          occasion === occ
                            ? 'bg-[var(--text-main)] text-[var(--bg-main)] border-[var(--text-main)]'
                            : 'bg-[var(--bg-main)] text-[var(--text-main)] border-[var(--border-subtle)] hover:border-[var(--accent-gold)]'
                        }`}
                      >
                        {occ}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                  <div className="space-y-1">
                    <label className="text-[var(--text-secondary)] block">Recipient Full Name *</label>
                    <input
                      type="text"
                      required
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      placeholder="e.g. Ananya Singhania"
                      className="w-full bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-xl px-3.5 py-2.5 text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-gold)]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[var(--text-secondary)] block">Recipient Email {cardFormat === 'DIGITAL' ? '*' : ''}</label>
                    <input
                      type="email"
                      required={cardFormat === 'DIGITAL' && !recipientPhone}
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      placeholder="recipient@domain.com"
                      className="w-full bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-xl px-3.5 py-2.5 text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-gold)]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[var(--text-secondary)] block">Recipient WhatsApp / Mobile</label>
                    <input
                      type="tel"
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(e.target.value)}
                      placeholder="+91 98200 00000"
                      className="w-full bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-xl px-3.5 py-2.5 text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-gold)]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[var(--text-secondary)] block">Scheduled Delivery Date</label>
                    <div className="relative">
                      <input
                        type="date"
                        min={new Date().toISOString().slice(0, 10)}
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="w-full bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-xl px-3.5 py-2.5 text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-gold)]"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[var(--text-secondary)] block">From (Sender Name) *</label>
                    <input
                      type="text"
                      required
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="Your Name"
                      className="w-full bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-xl px-3.5 py-2.5 text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-gold)]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[var(--text-secondary)] block">Your Receipt Email *</label>
                    <input
                      type="email"
                      required
                      value={purchaserEmail}
                      onChange={(e) => setPurchaserEmail(e.target.value)}
                      placeholder="your.email@domain.com"
                      className="w-full bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-xl px-3.5 py-2.5 text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-gold)]"
                    />
                  </div>
                </div>

                <div className="space-y-1 text-xs font-mono">
                  <label className="text-[var(--text-secondary)] block">Personal Message (Max 240 chars)</label>
                  <textarea
                    rows={3}
                    maxLength={240}
                    value={personalMessage}
                    onChange={(e) => setPersonalMessage(e.target.value)}
                    className="w-full bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-xl p-3.5 text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-gold)]"
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-5 py-3.5 rounded-xl border border-[var(--border-subtle)] text-xs font-mono uppercase tracking-wider text-[var(--text-main)] cursor-pointer flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3.5 rounded-xl bg-[var(--text-main)] hover:bg-[var(--accent-gold)] text-[var(--bg-main)] text-xs font-mono font-semibold uppercase tracking-[0.2em] transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Review &amp; Proceed to Payment</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: PREPAID PAYMENT & POST-PAYMENT ACTIVATION */}
            {step === 3 && !createdOrderResult && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <span className="text-[11px] font-mono uppercase tracking-[0.22em] text-[var(--accent-gold)] block">
                    Step 03 of 03
                  </span>
                  <h2 className="font-serif text-2xl uppercase tracking-wider text-[var(--text-main)]">
                    Prepaid Authorization &amp; Activation
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    For security and anti-fraud protection, FRAGMORÉ Gift Cards activate and release their cryptographic
                    redemption code strictly after confirmed payment. Gift cards cannot be purchased with COD, another
                    gift card, or promotional credits.
                  </p>
                </div>

                <div className="space-y-3">
                  <label
                    onClick={() => setPaymentMode('INSTANT_VERIFIED_PREPAID')}
                    className={`flex items-start gap-3.5 p-4 rounded-xl border cursor-pointer transition-all ${
                      paymentMode === 'INSTANT_VERIFIED_PREPAID'
                        ? 'border-[var(--accent-gold)] bg-[var(--bg-secondary)]/60'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-main)]'
                    }`}
                  >
                    <input
                      type="radio"
                      checked={paymentMode === 'INSTANT_VERIFIED_PREPAID'}
                      onChange={() => setPaymentMode('INSTANT_VERIFIED_PREPAID')}
                      className="mt-1 accent-[var(--accent-gold)]"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 font-mono text-xs font-semibold text-[var(--text-main)] uppercase">
                        <CreditCard className="w-4 h-4 text-[var(--accent-gold)]" />
                        <span>Instant Prepaid Authorization (UPI / Card / NetBanking)</span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)]">
                        Completes verified payment immediately, records deferred liability (GL 2310), and issues the
                        active gift card credential.
                      </p>
                    </div>
                  </label>

                  <label
                    onClick={() => setPaymentMode('CREATE_PENDING_ORDER')}
                    className={`flex items-start gap-3.5 p-4 rounded-xl border cursor-pointer transition-all ${
                      paymentMode === 'CREATE_PENDING_ORDER'
                        ? 'border-[var(--accent-gold)] bg-[var(--bg-secondary)]/60'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-main)]'
                    }`}
                  >
                    <input
                      type="radio"
                      checked={paymentMode === 'CREATE_PENDING_ORDER'}
                      onChange={() => setPaymentMode('CREATE_PENDING_ORDER')}
                      className="mt-1 accent-[var(--accent-gold)]"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 font-mono text-xs font-semibold text-[var(--text-main)] uppercase">
                        <Lock className="w-4 h-4 text-[var(--accent-gold)]" />
                        <span>Reserve Order &amp; Pay via Bank / Concierge Link (Holds Activation)</span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)]">
                        Creates the gift card in PENDING_PAYMENT state with ₹0 spendable balance until payment is
                        confirmed.
                      </p>
                    </div>
                  </label>
                </div>

                <div className="p-4 rounded-xl bg-[var(--bg-main)] border border-[var(--border-subtle)] space-y-2 font-mono text-xs">
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Gift Card Face Value</span>
                    <span className="font-semibold tabular-nums">₹{effectiveAmount.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">GST at Issuance (Voucher Multi-Purpose Supply)</span>
                    <span className="tabular-nums">₹0 (Taxed on Fragrance Redemption)</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-[var(--border-subtle)] text-sm font-bold">
                    <span>Total Payable</span>
                    <span className="text-[var(--accent-gold)] tabular-nums">
                      ₹{effectiveAmount.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="px-5 py-3.5 rounded-xl border border-[var(--border-subtle)] text-xs font-mono uppercase tracking-wider text-[var(--text-main)] cursor-pointer"
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleCompletePurchase}
                    className="flex-1 py-4 rounded-xl bg-[var(--text-main)] hover:bg-[var(--accent-gold)] text-[var(--bg-main)] text-xs font-mono font-semibold uppercase tracking-[0.2em] transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>
                      {submitting
                        ? 'Authorizing...'
                        : paymentMode === 'INSTANT_VERIFIED_PREPAID'
                        ? `Pay ₹${effectiveAmount.toLocaleString('en-IN')} & Issue Gift Card`
                        : 'Create Pending Gift Card Order'}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* POST-ORDER CONFIRMATION & CREDENTIAL REVEAL */}
            {createdOrderResult && (
              <div className="space-y-6 py-2">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-[var(--accent-gold)]/15 border border-[var(--accent-gold)] flex items-center justify-center text-[var(--accent-gold)]">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-[var(--accent-gold)] block">
                      {createdOrderResult.giftCard.paymentStatus === 'PAID'
                        ? 'Payment Confirmed · Gift Card Active'
                        : 'Awaiting Payment Confirmation'}
                    </span>
                    <h3 className="font-serif text-2xl uppercase tracking-wider text-[var(--text-main)]">
                      {createdOrderResult.giftCard.cardNumber}
                    </h3>
                  </div>
                </div>

                {createdOrderResult.deliveryCredential?.redemptionCode ? (
                  <div className="p-5 rounded-xl bg-[var(--bg-main)] border border-[var(--accent-gold)] space-y-3">
                    <div className="text-[11px] font-mono uppercase tracking-widest text-[var(--accent-gold)] font-semibold">
                      Authorized Recipient Redemption Code (Shown Once Upon Verified Payment)
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <code className="font-mono text-base sm:text-lg font-bold tracking-widest text-[var(--text-main)] tabular-nums">
                        {createdOrderResult.deliveryCredential.redemptionCode}
                      </code>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(createdOrderResult.deliveryCredential.redemptionCode);
                          showNotification('Redemption code copied to clipboard');
                        }}
                        className="px-3.5 py-2 rounded-lg bg-[var(--text-main)] text-[var(--bg-main)] text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Code</span>
                      </button>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Recipient <strong>{createdOrderResult.giftCard.recipientName}</strong> can claim this code inside{' '}
                      <strong>My Account → Gift Cards</strong> or apply it directly at FRAGMORÉ checkout.
                    </p>
                  </div>
                ) : (
                  <div className="p-5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                    <div className="text-xs font-mono font-semibold uppercase tracking-wider text-amber-800">
                      Status: PENDING_PAYMENT (Spendable Balance: ₹0)
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      Per FRAGMORÉ security controls, secret redemption codes are withheld until payment is verified.
                      Complete gateway verification below to activate the card.
                    </p>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={handleConfirmPendingCardPayment}
                      className="px-4 py-2.5 rounded-lg bg-[var(--text-main)] text-[var(--bg-main)] text-xs font-mono uppercase tracking-wider cursor-pointer"
                    >
                      {submitting ? 'Verifying Payment...' : 'Complete Verified Payment & Activate Now'}
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCreatedOrderResult(null);
                      setStep(1);
                    }}
                    className="px-5 py-2.5 rounded-xl border border-[var(--border-subtle)] text-xs font-mono uppercase tracking-wider cursor-pointer"
                  >
                    Send Another Gift Card
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentView('account')}
                    className="px-5 py-2.5 rounded-xl bg-[var(--text-main)] text-[var(--bg-main)] text-xs font-mono uppercase tracking-wider cursor-pointer"
                  >
                    Open My Gift Cards &amp; Wallet →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: LIVE LUXURY GIFT CARD PREVIEW + BALANCE CHECKER */}
          <div className="lg:col-span-5 space-y-6">
            {/* Visual Card */}
            <div
              className={`rounded-2xl border p-7 sm:p-8 shadow-[0_24px_60px_rgba(36,33,29,0.14)] space-y-8 transition-all duration-300 ${activeTemplate.bgClass}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className={`text-[10px] font-mono uppercase tracking-[0.26em] block ${activeTemplate.accentClass}`}>
                    {occasion} Privilege
                  </span>
                  <div className="font-serif text-xl sm:text-2xl tracking-[0.22em] uppercase mt-1">
                    FRAGMOR<span className={activeTemplate.accentClass}>É</span>
                  </div>
                </div>
                <div className="text-right font-mono">
                  <span className="text-[10px] uppercase opacity-70 block">{cardFormat}</span>
                  <span className={`text-2xl sm:text-3xl font-bold tabular-nums ${activeTemplate.accentClass}`}>
                    ₹{effectiveAmount.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div className="min-h-[76px] border-y border-current/15 py-4 space-y-2">
                <div className="text-xs font-mono opacity-80">
                  For: <strong>{recipientName || 'Your Honored Recipient'}</strong>
                </div>
                <p className="font-serif italic text-sm leading-relaxed opacity-90">
                  “{personalMessage || 'A bespoke olfactory experience awaits your selection.'}”
                </p>
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono opacity-80">
                <span>From: {senderName || 'FRAGMORÉ Patron'}</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{scheduledDate}</span>
                </span>
              </div>
            </div>

            {/* BALANCE INQUIRY & CLAIM WIDGET */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Gift className="w-4 h-4 text-[var(--accent-gold)]" />
                <h3 className="font-serif text-base uppercase tracking-wider text-[var(--text-main)]">
                  Check Gift Card Balance or Claim
                </h3>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                Received a FRAGMORÉ Gift Card? Enter your 16-character redemption code to inspect its live balance or
                bind it to your account.
              </p>
              <form onSubmit={handleBalanceLookup} className="flex gap-2">
                <input
                  type="text"
                  value={lookupCode}
                  onChange={(e) => setLookupCode(e.target.value.toUpperCase())}
                  placeholder="FRGM-XXXX-XXXX-XXXX"
                  className="flex-1 bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-xl px-3.5 py-2.5 text-xs font-mono uppercase tracking-wider text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-gold)]"
                />
                <button
                  type="submit"
                  disabled={lookupLoading}
                  className="px-4 py-2.5 rounded-xl bg-[var(--text-main)] text-[var(--bg-main)] text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>{lookupLoading ? '...' : 'Verify'}</span>
                </button>
              </form>

              {lookupError && <div className="text-xs font-mono text-rose-600">{lookupError}</div>}

              {lookupResult && (
                <div className="p-4 rounded-xl bg-[var(--bg-main)] border border-[var(--border-subtle)] space-y-2.5 font-mono text-xs">
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Card Number:</span>
                    <span className="font-semibold">{lookupResult.cardNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Available Balance:</span>
                    <span className="text-sm font-bold text-[var(--accent-gold)] tabular-nums">
                      ₹{Number(lookupResult.remainingBalanceInr || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Status / Valid Until:</span>
                    <span>
                      {lookupResult.status} · {new Date(lookupResult.expiresAt).toLocaleDateString('en-IN')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleClaimLookedUpCard}
                    className="w-full mt-2 py-2.5 rounded-lg bg-[var(--accent-gold)] text-white text-xs font-semibold uppercase tracking-wider cursor-pointer"
                  >
                    {customer ? 'Claim Into My FRAGMORÉ Account' : 'Sign In to Claim Card'}
                  </button>
                </div>
              )}
            </div>

            {/* CORPORATE & WEDDING BULK GIFTING NOTE */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-6 space-y-3">
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[var(--accent-gold)]">
                <Building2 className="w-4 h-4" />
                <span>Corporate, Wedding &amp; Event Gifting</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Planning executive gifting, employee appreciation, luxury wedding return gifts, or Perfume Bar event
                vouchers? Our B2B Desk issues co-branded bulk digital &amp; physical gift card batches with GST
                documentation.
              </p>
              <div className="text-[11px] font-mono text-[var(--text-main)]">
                Concierge Desk: <span className="text-[var(--accent-gold)]">concierge@fragmore.shop</span> · Partial
                redemptions supported for 12 months.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
