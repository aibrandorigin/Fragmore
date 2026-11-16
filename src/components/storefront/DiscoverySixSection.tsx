import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { Check, ArrowRight, ShieldCheck, Gift, Sparkles } from 'lucide-react';
import { FragmoreBottleVisual, FRAGRANCE_JOURNEY_DATA } from './FragmoreBottleVisual';

export const DiscoverySixSection: React.FC = () => {
  const {
    products,
    addToCart,
    setSelectedProductSlug,
    setCurrentView,
    trackEvent,
    cms,
    showNotification
  } = useStore();

  const discoveryProduct =
    products.find((p) => p.slug === 'fragmore-discovery-six') || products[0];
  const discoveryVariants = discoveryProduct?.variants && discoveryProduct.variants.length > 0
    ? discoveryProduct.variants
    : [
        { id: 'disc-2ml', size: '2 ml', sku: 'FRG-DISC-002', mrp: 499, sellingPrice: 499, stockOnHand: 350, stockReserved: 0, stockAvailable: 350, isAvailable: true },
        { id: 'disc-10ml', size: '10 ml', sku: 'FRG-DISC-010', mrp: 1999, sellingPrice: 1499, stockOnHand: 200, stockReserved: 0, stockAvailable: 200, isAvailable: true }
      ];

  const [selectedVariantId, setSelectedVariantId] = useState<string>(() => discoveryVariants[0]?.id || 'disc-2ml');
  const activeVariant =
    discoveryVariants.find((v) => v.id === selectedVariantId) ||
    discoveryVariants.find((v) => v.size.includes('2')) ||
    discoveryVariants[0];

  const sellingPrice = activeVariant?.sellingPrice ?? 499;
  const mrp = activeVariant?.mrp ?? (activeVariant?.size?.includes('10') ? 1999 : 499);
  const savings = Math.max(0, mrp - sellingPrice);
  const voucherValue = cms?.discoveryVoucherValue || sellingPrice;

  const signatureOptions = FRAGRANCE_JOURNEY_DATA.map((item) => ({
    slug: item.slug,
    code: item.code,
    name: item.name,
    tagline: item.tagline,
    note: `${item.topNotes[0]} · ${item.heartNotes[0]} · ${item.baseNotes[0]}`
  }));

  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([
    'golden-hour',
    'blush-and-blossom',
    'violet-noir',
    'aqua-pulse',
    'luxe-heritage',
    'night-bloom'
  ]);

  const handleToggleFlavour = (slug: string) => {
    setSelectedSlugs((prev) => {
      if (prev.includes(slug)) {
        return prev.filter((s) => s !== slug);
      }
      if (prev.length >= 6) {
        showNotification('Your Coffret holds 6 vials — deselect one to swap or click any vial below.');
        return prev;
      }
      return [...prev, slug];
    });
  };

  const selectedFlavourNames = selectedSlugs.map(
    (s) => signatureOptions.find((o) => o.slug === s)?.name || s.toUpperCase()
  );

  const handleAddDiscovery = () => {
    if (selectedSlugs.length !== 6) {
      showNotification(`Please select ${6 - selectedSlugs.length} more Signature perfume${6 - selectedSlugs.length === 1 ? '' : 's'} to complete your 6-vial Discovery Set.`);
      return;
    }
    trackEvent('DiscoveryPurchased', {
      value: sellingPrice,
      currency: 'INR',
      selectedFlavours: selectedFlavourNames,
      size: activeVariant.size
    });
    addToCart(discoveryProduct, activeVariant.size, 1, selectedFlavourNames);
  };

  const handleViewPDP = () => {
    trackEvent('DiscoveryViewed', { slug: 'fragmore-discovery-six' });
    try {
      sessionStorage.setItem('fragmore_discovery_selection', JSON.stringify(selectedSlugs));
    } catch {}
    setSelectedProductSlug('fragmore-discovery-six');
    setCurrentView('pdp');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <section className="py-20 bg-[#FAF8F4] text-[#24211D] border-b border-[#DED7CC] relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="bg-[#FFFFFF] border border-[#DED7CC] rounded-2xl p-6 sm:p-10 lg:p-14 shadow-[0_14px_36px_rgba(36,33,29,0.06)] relative overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
            {/* Left 5 cols: Conversion pitch */}
            <div className="lg:col-span-5 space-y-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 text-xs font-mono tracking-[0.26em] uppercase text-[#9A783E] font-semibold">
                  <Gift className="w-3.5 h-3.5" />
                  <span>100% Value Back Voucher · Coffret Découverte</span>
                </div>
                <h2 className="font-serif text-3xl sm:text-5xl tracking-[0.14em] text-[#24211D] uppercase leading-tight">
                  Curate Your Six.
                </h2>
              </div>

              <p className="text-sm sm:text-base text-[#686158] leading-relaxed">
                Select your desired <strong>6 fragrances from our 9 Signature Perfumes</strong> to create your bespoke Discovery Coffret. Available in <strong>2 ml</strong> (₹499) and <strong>10 ml Deluxe</strong> (₹1,499) flacon sets with precision fine-mist sprayers.
              </p>

              {/* The Value Back Guarantee Callout */}
              <div className="p-4 sm:p-5 rounded-xl bg-[#F1EDE5] border border-[#DED7CC] space-y-1.5">
                <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#24211D]">
                  <ShieldCheck className="w-4 h-4 text-[#9A783E]" />
                  <span>The FRAGMORÉ Risk-Free Privilege</span>
                </div>
                <p className="text-xs text-[#686158] leading-relaxed">
                  Receive an immediate{' '}
                  <strong className="text-[#24211D]">
                    ₹{voucherValue.toLocaleString('en-IN')} privilege voucher
                  </strong>{' '}
                  inside your box. Apply it toward any 50ml full bottle purchase, making your Discovery Set virtually complimentary.
                </p>
              </div>

              {/* Feature Points */}
              <ul className="space-y-2.5 text-xs text-[#686158]">
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-[#9A783E] shrink-0" />
                  <span>Custom-curate any 6 Deluxe Spray Atomizers ({activeVariant.size}) from the 9 Signature creations</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-[#9A783E] shrink-0" />
                  <span>Collector’s presentation coffret with Olfactory Guide</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-[#9A783E] shrink-0" />
                  <span>Complimentary insured express delivery across all Indian pin codes</span>
                </li>
              </ul>

              {/* Selected Summary Pill Box */}
              <div className="p-3.5 rounded-xl bg-[#FAF8F4] border border-[#DED7CC] space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider">
                  <span className="text-[#686158]">Your Coffret Selection</span>
                  <span className={selectedSlugs.length === 6 ? 'text-emerald-700 font-bold' : 'text-[#9A783E] font-bold'}>
                    {selectedSlugs.length} / 6 Selected
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedFlavourNames.map((name, i) => (
                    <span
                      key={name}
                      className="px-2.5 py-1 rounded-full bg-[#FFFFFF] border border-[#DED7CC] text-[10px] font-mono text-[#24211D]"
                    >
                      {i + 1}. {name}
                    </span>
                  ))}
                  {selectedSlugs.length < 6 && (
                    <span className="px-2.5 py-1 rounded-full border border-dashed border-[#9A783E] text-[10px] font-mono text-[#9A783E]">
                      + Select {6 - selectedSlugs.length} more
                    </span>
                  )}
                </div>
              </div>

              {/* Variation Selector: 2ml vs 10ml */}
              <div className="space-y-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-[#686158] block font-semibold">
                  Select Discovery Flacon Size:
                </span>
                <div className="grid grid-cols-2 gap-3">
                  {discoveryVariants.map((v) => {
                    const isSelected = activeVariant.id === v.id;
                    const isTenMl = v.size.includes('10');
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setSelectedVariantId(v.id)}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                          isSelected
                            ? 'border-[#9A783E] bg-[#9A783E]/10 ring-1 ring-[#9A783E]'
                            : 'border-[#DED7CC] bg-[#FFFFFF] hover:border-[#9A783E]/50'
                        }`}
                      >
                        {isTenMl && (
                          <span className="absolute -top-2 right-2 px-1.5 py-0.5 rounded bg-emerald-700 text-white text-[9px] font-mono font-bold uppercase tracking-wider">
                            Save ₹500
                          </span>
                        )}
                        <div className="text-xs font-mono font-bold text-[#24211D]">
                          {isTenMl ? '10 ml Deluxe Vials' : '2 ml Discovery Vials'}
                        </div>
                        <div className="flex items-baseline gap-1.5 mt-1 font-mono">
                          <span className="text-sm font-bold text-[#9A783E] tabular-nums">
                            ₹{v.sellingPrice.toLocaleString('en-IN')}
                          </span>
                          {v.mrp > v.sellingPrice && (
                            <span className="text-[11px] text-[#686158] line-through tabular-nums">
                              MRP ₹{v.mrp.toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-[#686158] block mt-0.5">
                          {isTenMl ? '6 × 10 ml Coffret' : '6 × 2 ml Coffret'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Pricing & CTA */}
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-5">
                <div>
                  <div className="flex items-baseline gap-3 font-mono">
                    <span className="text-2xl sm:text-3xl font-bold text-[#24211D] tabular-nums">
                      ₹{sellingPrice.toLocaleString('en-IN')}
                    </span>
                    {mrp > sellingPrice && (
                      <span className="text-sm text-[#686158] line-through tabular-nums">
                        MRP ₹{mrp.toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-[#9A783E] block font-mono mt-0.5 font-semibold">
                    {savings > 0 ? `Save ₹${savings.toLocaleString('en-IN')} + ` : ''}Full ₹{voucherValue.toLocaleString('en-IN')} Voucher Included
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleAddDiscovery}
                    className={`px-6 py-3.5 rounded-full font-semibold text-xs tracking-[0.18em] uppercase transition-all duration-300 flex items-center gap-2 cursor-pointer ${
                      selectedSlugs.length === 6
                        ? 'bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4]'
                        : 'bg-[#F1EDE5] text-[#686158] border border-[#DED7CC]'
                    }`}
                  >
                    <span>
                      {selectedSlugs.length === 6
                        ? `Add ${activeVariant.size} Set`
                        : `Select ${6 - selectedSlugs.length} More`}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleViewPDP}
                    className="px-5 py-3.5 rounded-full border border-[#DED7CC] hover:border-[#9A783E] text-[#24211D] font-medium text-xs tracking-wider uppercase transition-colors cursor-pointer"
                  >
                    Details
                  </button>
                </div>
              </div>
            </div>

            {/* Right 7 cols: Live Presentation Coffret Box + Interactive 6-of-9 Signature Selector */}
            <div className="lg:col-span-7 bg-[#FAF8F4] border border-[#DED7CC] rounded-2xl p-5 sm:p-7 space-y-5">
              <div
                onClick={handleViewPDP}
                className="relative w-full rounded-xl overflow-hidden bg-[#FFFFFF] p-4 sm:p-5 flex flex-col items-center border border-[#DED7CC] cursor-pointer group"
              >
                <FragmoreBottleVisual
                  slug="fragmore-discovery-six"
                  size={activeVariant.size}
                  productName="DISCOVERY SIX COFFRET"
                  collection="Discovery Collection"
                  className="w-full h-60 sm:h-64 max-w-[320px]"
                  interactive
                  enableParallax
                  showGlow={false}
                  showShadow={true}
                  selectedDiscoverySlugs={selectedSlugs}
                />
                <span className="text-[10px] font-mono tracking-[0.22em] uppercase text-[#686158] mt-1 block text-center">
                  Live Coffret Preview · Updates With Your 6 Selected Signature Perfumes
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DED7CC] pb-2.5">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#9A783E]" />
                  <span className="text-[11px] font-mono tracking-[0.2em] uppercase text-[#24211D] font-semibold">
                    Select Desired 6 Flavours From The 9 Signature Perfumes
                  </span>
                </div>
                <span className="text-[11px] font-mono text-[#9A783E] font-semibold">
                  {selectedSlugs.length} / 6 Chosen
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {signatureOptions.map((vial) => {
                  const isSelected = selectedSlugs.includes(vial.slug);
                  const selectionNumber = selectedSlugs.indexOf(vial.slug) + 1;
                  return (
                    <button
                      key={vial.slug}
                      type="button"
                      onClick={() => handleToggleFlavour(vial.slug)}
                      className={`relative p-2.5 rounded-xl border flex items-center gap-2.5 text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#FFFFFF] border-[#9A783E] shadow-[0_6px_16px_rgba(154,120,62,0.12)] ring-1 ring-[#9A783E]'
                          : 'bg-[#FFFFFF]/70 border-[#DED7CC] hover:border-[#9A783E]/60 opacity-80 hover:opacity-100'
                      }`}
                    >
                      {/* Selection Check / Slot Badge */}
                      <div
                        className={`absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold transition-colors ${
                          isSelected
                            ? 'bg-[#9A783E] text-[#FAF8F4]'
                            : 'bg-[#F1EDE5] text-[#686158] border border-[#DED7CC]'
                        }`}
                      >
                        {isSelected ? selectionNumber : '+'}
                      </div>

                      <FragmoreBottleVisual
                        slug={vial.slug}
                        size="2 ml"
                        productName={vial.name}
                        className="w-9 h-14 shrink-0"
                        showGlow={false}
                        showShadow={false}
                      />
                      <div className="min-w-0 pr-4">
                        <span className="text-[9px] font-mono text-[#9A783E] block">
                          N° {vial.code}
                        </span>
                        <span className="font-serif text-[11px] tracking-[0.06em] font-semibold text-[#24211D] uppercase block truncate">
                          {vial.name}
                        </span>
                        <span className="text-[9px] text-[#686158] tracking-tight mt-0.5 block truncate">
                          {vial.note}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="text-center text-[11px] text-[#686158] font-mono border-t border-[#DED7CC] pt-3">
                Tap any fragrance above to customize your 6 × 2ml Deluxe Spray Atomizers
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
