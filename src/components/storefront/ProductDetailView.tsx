import React, { useState, useEffect, useRef, Suspense } from 'react';
import gsap from 'gsap';
import { useStore } from '../../context/StoreContext';
import { FragmoreBottleVisual, FRAGRANCE_JOURNEY_DATA } from './FragmoreBottleVisual';
import { PerfumeNotesPosterStage } from './PerfumeNotesPosterStage';
import {
  ArrowLeft,
  Star,
  Heart,
  ShoppingBag,
  ShieldCheck,
  Truck,
  Sparkles,
  CheckCircle2,
  Gift,
  ChevronDown,
  Box,
  Layers,
  Image as ImageIcon,
  Share2,
  Bell,
  Clock,
  Wind,
  AlertCircle,
  ArrowRight
} from 'lucide-react';

const LazyPerfumeBottle3D = React.lazy(() =>
  import('../3d/PerfumeBottle3D').then((m) => ({ default: m.PerfumeBottle3D }))
);

export const ProductDetailView: React.FC = () => {
  const {
    products,
    selectedProductSlug,
    setSelectedProductSlug,
    setSelectedCategoryFilter,
    setCurrentView,
    addToCart,
    toggleWishlist,
    isInWishlist,
    reviews,
    addReview,
    trackEvent,
    showNotification,
    addBackInStockRequest,
    customer,
    setIsAuthModalOpen
  } = useStore();

  const product =
    products.find((p) => p.slug === selectedProductSlug) ||
    products.find((p) => p.status === 'ACTIVE') ||
    products[0];

  const isArchivedProduct = product?.status === 'ARCHIVED' || product?.status === 'INACTIVE';

  // Only expose purchasable variants for public selection (never expose unpriced 2 ml or disabled 10 ml Aura)
  const publicVariants = React.useMemo(() => {
    if (!product) return [];
    const avail = product.variants.filter(
      (v) =>
        v.isAvailable !== false &&
        v.sellingPrice > 0 &&
        !(product.collection === 'Aura Collection' && v.size.trim().toLowerCase() === '10 ml')
    );
    return avail.length > 0 ? avail : product.variants;
  }, [product]);

  const getDefaultSize = (prod: typeof product) => {
    if (!prod) return '30 ml';
    const valid = prod.variants.filter(
      (v) =>
        v.isAvailable !== false &&
        v.sellingPrice > 0 &&
        !(prod.collection === 'Aura Collection' && v.size.trim().toLowerCase() === '10 ml')
    );
    if (prod.collection === 'Aura Collection') {
      return valid.find((v) => v.size === '15 ml')?.size || valid[0]?.size || '15 ml';
    }
    if (prod.collection === 'Discovery Collection' || prod.gender === 'discovery' || prod.slug === 'fragmore-discovery-six') {
      return valid.find((v) => v.size === '2 ml')?.size || valid[0]?.size || '2 ml';
    }
    return (
      valid.find((v) => v.size === '30 ml')?.size ||
      valid.find((v) => v.size === '50 ml')?.size ||
      valid[0]?.size ||
      prod.variants[0]?.size ||
      '30 ml'
    );
  };

  const [selectedSize, setSelectedSize] = useState<string>(() => getDefaultSize(product));
  const [quantity, setQuantity] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'parallax' | 'static' | '3d'>('parallax');
  const [selectedGalleryImage, setSelectedGalleryImage] = useState<string | null>(null);
  const [openAccordion, setOpenAccordion] = useState<string>('notes');
  const [sprayTriggerCount, setSprayTriggerCount] = useState<number>(0);
  const [isSprayingStudio, setIsSprayingStudio] = useState<boolean>(false);
  const [studioPointer, setStudioPointer] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [selectedDiscoverySlugs, setSelectedDiscoverySlugs] = useState<string[]>(() => {
    try {
      const saved = sessionStorage.getItem('fragmore_discovery_selection');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 6) return parsed;
      }
    } catch {}
    return [
      'golden-hour',
      'blush-and-blossom',
      'violet-noir',
      'aqua-pulse',
      'luxe-heritage',
      'night-bloom'
    ];
  });

  // Review Form State
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewName, setReviewName] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewContent, setReviewContent] = useState('');

  // Back in Stock State
  const [bisEmail, setBisEmail] = useState('');
  const [bisPhone, setBisPhone] = useState('');
  const [bisSubmitted, setBisSubmitted] = useState(false);

  useEffect(() => {
    if (product) {
      const defSize = getDefaultSize(product);
      setSelectedSize(defSize);
      setQuantity(1);
      setSelectedGalleryImage(null);
      setViewMode('parallax');
      const defVar = product.variants.find((v) => v.size === defSize) || product.variants[0];
      trackEvent('ViewContent', {
        content_name: product.name,
        content_ids: [product.id],
        content_type: 'product',
        value: defVar?.sellingPrice || 0,
        currency: 'INR'
      });
    }
  }, [product?.id]);

  if (!product) return null;

  const currentVariant =
    publicVariants.find((v) => v.size === selectedSize) ||
    publicVariants[0] ||
    product.variants[0];

  const hasApproved3DModel = Boolean(
    (currentVariant?.model3dUrl || currentVariant?.glbModelUrl || '').trim()
  );
  const rawAdditional =
    currentVariant?.additionalImageUrls || currentVariant?.additionalImages || [];
  const additionalImages: string[] = Array.isArray(rawAdditional)
    ? rawAdditional.filter(Boolean)
    : [];
  const posterImageUrl =
    currentVariant?.staticPosterImageUrl || currentVariant?.posterImage || '';

  const isVariantPurchasable =
    !isArchivedProduct &&
    !!currentVariant &&
    currentVariant.isAvailable !== false &&
    currentVariant.sellingPrice > 0 &&
    (currentVariant.stockManaged === false || currentVariant.stockAvailable > 0);

  const maxOrderQty =
    currentVariant?.stockManaged === false && currentVariant?.stockAvailable <= 0
      ? 10
      : Math.max(1, currentVariant?.stockAvailable || 1);

  const productReviews = (reviews || []).filter(
    (r) => r.productId === product.id && r.status === 'APPROVED'
  );

  const pdpLeftColRef = useRef<HTMLDivElement>(null);
  const pdpRightColRef = useRef<HTMLDivElement>(null);
  const relatedSectionRef = useRef<HTMLDivElement>(null);
  const relatedCardsRef = useRef<(HTMLDivElement | null)[]>([]);

  const relatedProducts = (products || [])
    .filter(
      (p) =>
        p.id !== product.id &&
        p.status === 'ACTIVE' &&
        p.gender !== 'discovery' &&
        (p.collection === product.collection || p.gender === product.gender)
    )
    .slice(0, 4);

  useEffect(() => {
    const mqMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mqMotion.matches) return;

    const tl = gsap.timeline({ delay: 0.22, defaults: { ease: 'power3.out' } });
    if (pdpLeftColRef.current) {
      tl.fromTo(
        pdpLeftColRef.current,
        { opacity: 0, y: 42, scale: 0.96 },
        { opacity: 1, y: 0, scale: 1, duration: 0.9 },
        0
      );
    }
    if (pdpRightColRef.current) {
      tl.fromTo(
        pdpRightColRef.current,
        { opacity: 0, y: 38 },
        { opacity: 1, y: 0, duration: 0.9 },
        0.12
      );
    }

    const relCards = relatedCardsRef.current.filter(Boolean) as HTMLDivElement[];
    if (relCards.length > 0) {
      gsap.set(relCards, { opacity: 0, y: 52, scale: 0.94 });
    }
    let relAnimated = false;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !relAnimated && relCards.length > 0) {
            relAnimated = true;
            gsap.to(relCards, {
              opacity: 1,
              y: 0,
              scale: 1,
              duration: 0.95,
              stagger: 0.1,
              ease: 'power3.out'
            });
          }
        });
      },
      { threshold: 0.15 }
    );
    if (relatedSectionRef.current) {
      observer.observe(relatedSectionRef.current);
    }

    return () => {
      tl.kill();
      observer.disconnect();
    };
  }, [product?.id]);

  const isDiscoveryProduct =
    product.slug === 'fragmore-discovery-six' ||
    product.collection === 'Discovery Collection' ||
    product.gender === 'discovery';

  const selectedDiscoveryFlavourNames = selectedDiscoverySlugs.map(
    (s) => FRAGRANCE_JOURNEY_DATA.find((f) => f.slug === s)?.name || s.toUpperCase()
  );

  const handleToggleDiscoveryFlavour = (slug: string) => {
    setSelectedDiscoverySlugs((prev) => {
      if (prev.includes(slug)) {
        return prev.filter((s) => s !== slug);
      }
      if (prev.length >= 6) {
        showNotification('Your Coffret holds 6 vials — deselect one to swap your selection.');
        return prev;
      }
      const next = [...prev, slug];
      try {
        sessionStorage.setItem('fragmore_discovery_selection', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleAddToCart = () => {
    if (!currentVariant) return;
    if (!customer) {
      showNotification('Please sign in to add items to your shopping bag.');
      setIsAuthModalOpen(true);
      return;
    }
    if (isDiscoveryProduct && selectedDiscoverySlugs.length !== 6) {
      showNotification(`Please select ${6 - selectedDiscoverySlugs.length} more Signature perfume${6 - selectedDiscoverySlugs.length === 1 ? '' : 's'} to complete your 6-vial Discovery Set.`);
      return;
    }
    addToCart(
      product,
      currentVariant.size,
      quantity,
      isDiscoveryProduct ? selectedDiscoveryFlavourNames : undefined
    );
  };

  const handleBuyNow = () => {
    if (!currentVariant) return;
    if (!customer) {
      showNotification('Please sign in to add items to your shopping bag and checkout.');
      setIsAuthModalOpen(true);
      return;
    }
    if (isDiscoveryProduct && selectedDiscoverySlugs.length !== 6) {
      showNotification(`Please select ${6 - selectedDiscoverySlugs.length} more Signature perfume${6 - selectedDiscoverySlugs.length === 1 ? '' : 's'} to complete your 6-vial Discovery Set.`);
      return;
    }
    addToCart(
      product,
      currentVariant.size,
      quantity,
      isDiscoveryProduct ? selectedDiscoveryFlavourNames : undefined
    );
    setCurrentView('checkout');
  };

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewName.trim() || !reviewTitle.trim() || !reviewContent.trim()) return;
    addReview({
      productId: product.id,
      productName: product.name,
      customerName: reviewName,
      rating: reviewRating,
      title: reviewTitle,
      content: reviewContent,
      isVerifiedPurchase: true
    });
    setReviewModalOpen(false);
    setReviewName('');
    setReviewTitle('');
    setReviewContent('');
  };

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/?product=${product.slug}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      showNotification('Product link copied to clipboard.');
    }
  };

  return (
    <div className="min-h-screen bg-[#08080A] text-[#F3EFE6] pt-20 pb-24">
      {/* Top Breadcrumb & Back Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between border-b border-white/10">
        <button
          onClick={() => setCurrentView('shop')}
          className="inline-flex items-center space-x-2 text-xs uppercase tracking-[0.2em] text-white/70 hover:text-[#D4AF37] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Catalogue</span>
        </button>

        <div className="hidden sm:flex items-center space-x-2 text-xs font-mono text-white/50">
          <button onClick={() => setCurrentView('storefront')} className="hover:text-white cursor-pointer">
            HOME
          </button>
          <span>/</span>
          <button
            onClick={() => {
              setSelectedCategoryFilter(product.collection);
              setCurrentView('shop');
            }}
            className="hover:text-white uppercase cursor-pointer"
          >
            {product.collection}
          </button>
          <span>/</span>
          <span className="text-[#D4AF37] uppercase">{product.name}</span>
        </div>

        <button
          onClick={handleShare}
          className="inline-flex items-center space-x-1.5 text-xs uppercase tracking-wider text-white/60 hover:text-white transition-colors cursor-pointer"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Share</span>
        </button>
      </div>

      {/* Archived Heritage Creation Redirect Banner (Preserves old URLs & historical order links) */}
      {isArchivedProduct && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h2 className="font-serif text-base sm:text-lg text-white uppercase tracking-wider mb-1">
                  Archived Edition — Preserved for Historical Reference
                </h2>
                <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">
                  {product.name} has been archived and is no longer part of the active public collection. Explore the current approved <strong>Signature Collection (9 fragrances)</strong> or <strong>Aura Collection (15 ml · ₹249 each)</strong>.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2.5 shrink-0">
              <button
                onClick={() => {
                  setSelectedCategoryFilter('Signature Collection');
                  setCurrentView('shop');
                }}
                className="px-4 py-2.5 rounded-lg bg-[#D4AF37] text-[#08080A] font-semibold text-xs uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span>Signature Collection</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setSelectedCategoryFilter('Aura Collection');
                  setCurrentView('shop');
                }}
                className="px-4 py-2.5 rounded-lg border border-amber-400/40 text-amber-200 hover:bg-amber-500/15 font-semibold text-xs uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span>Aura Collection · 15 ml</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main PDP Hero Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
          {/* LEFT COLUMN: Variant-Specific Visual Showcase */}
          <div ref={pdpLeftColRef} className="lg:col-span-6 lg:sticky lg:top-24 space-y-4 will-change-transform">
            <div className="relative rounded-2xl overflow-hidden border border-[#DED7CC] bg-gradient-to-b from-[#FFFFFF] via-[#FAF8F4] to-[#F1EDE5] min-h-[440px] sm:min-h-[540px] flex flex-col justify-between p-4 sm:p-6 shadow-[0_14px_34px_rgba(36,33,29,0.06)]">
              {/* Top Controls inside Visual Frame (Wraps cleanly on mobile so badges & toggle never overlap) */}
              <div className="relative z-20 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span className="px-2.5 sm:px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-[0.18em] bg-[#F1EDE5] border border-[#DED7CC] text-[#9A783E]">
                    {product.collection}
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider bg-[#FFFFFF] text-[#24211D] border border-[#DED7CC] font-semibold">
                    {currentVariant?.size}
                  </span>
                </div>

                {/* View Mode Toggle — Only shows genuine 3D option when an approved GLB/GLTF model URL exists */}
                <div className="flex items-center bg-[#F1EDE5] p-1 rounded-lg border border-[#DED7CC]">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedGalleryImage(null);
                      setViewMode('parallax');
                    }}
                    className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-[11px] sm:text-xs font-medium transition-all cursor-pointer ${
                      viewMode === 'parallax' && !selectedGalleryImage
                        ? 'bg-[#24211D] text-[#FAF8F4] shadow-xs'
                        : 'text-[#686158] hover:text-[#24211D]'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Interactive Studio</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedGalleryImage(null);
                      setViewMode('static');
                    }}
                    className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-[11px] sm:text-xs font-medium transition-all cursor-pointer ${
                      viewMode === 'static' && !selectedGalleryImage
                        ? 'bg-[#24211D] text-[#FAF8F4] shadow-xs'
                        : 'text-[#686158] hover:text-[#24211D]'
                    }`}
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Static Poster</span>
                  </button>
                  {hasApproved3DModel && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedGalleryImage(null);
                        setViewMode('3d');
                      }}
                      className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-[11px] sm:text-xs font-medium transition-all cursor-pointer ${
                        viewMode === '3d' && !selectedGalleryImage
                          ? 'bg-[#24211D] text-[#FAF8F4] shadow-xs'
                          : 'text-[#686158] hover:text-[#24211D]'
                      }`}
                    >
                      <Box className="w-3.5 h-3.5" />
                      <span>3D Model</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Center Stage: Selected Variant Visual (Tracks pointer left & right across the studio stage) */}
              <div
                onMouseMove={(e) => {
                  if (viewMode !== 'parallax') return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const nx = Math.max(-1, Math.min(1, ((e.clientX - rect.left) / rect.width - 0.5) * 2));
                  const ny = Math.max(-1, Math.min(1, ((e.clientY - rect.top) / rect.height - 0.5) * 2));
                  setStudioPointer({ x: nx, y: ny });
                }}
                onMouseLeave={() => setStudioPointer({ x: 0, y: 0 })}
                className="relative flex-1 flex flex-col items-center justify-center my-4 min-h-[340px]"
              >
                {selectedGalleryImage ? (
                  <img
                    src={selectedGalleryImage}
                    alt={`${product.name} ${currentVariant?.size}`}
                    loading="lazy"
                    className="max-h-[360px] w-auto object-contain rounded-xl shadow-2xl"
                  />
                ) : viewMode === '3d' && hasApproved3DModel ? (
                  <Suspense
                    fallback={
                      <div className="text-xs text-[#686158] uppercase tracking-widest">
                        Loading 3D Asset...
                      </div>
                    }
                  >
                    <LazyPerfumeBottle3D
                      fragranceName={product.name}
                      color={product.themeColor}
                      ambientColor={product.accentColor}
                      interactive={true}
                      className="w-full h-[380px] sm:h-[420px]"
                    />
                  </Suspense>
                ) : viewMode === 'static' ? (
                  /* Static Poster Mode Only: 4–5 Perfume Bottle Posters with Respective Notes in the Background */
                  <PerfumeNotesPosterStage
                    product={product}
                    currentVariant={currentVariant}
                    selectedDiscoverySlugs={isDiscoveryProduct ? selectedDiscoverySlugs : undefined}
                  />
                ) : (
                  /* Interactive Studio Mode (Unchanged) */
                  <div className="relative flex flex-col items-center justify-center py-2 w-full">
                    <FragmoreBottleVisual
                      slug={product.slug}
                      size={currentVariant?.size || selectedSize}
                      variant={currentVariant}
                      productName={product.name}
                      productTagline={product.subtitle}
                      collection={product.collection}
                      className="w-56 h-72 sm:w-64 sm:h-80"
                      interactive={true}
                      enableParallax={true}
                      showGlow={true}
                      showShadow={true}
                      sprayTriggerCount={sprayTriggerCount}
                      onSprayStateChange={setIsSprayingStudio}
                      selectedDiscoverySlugs={isDiscoveryProduct ? selectedDiscoverySlugs : undefined}
                      externalPointerOffset={studioPointer}
                    />

                    {!isDiscoveryProduct && (
                      <button
                        type="button"
                        onClick={() => setSprayTriggerCount((c) => c + 1)}
                        className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#FAF6EE] hover:bg-[#F3ECE1] border border-[#DED7CC] text-[10px] font-mono uppercase tracking-[0.18em] text-[#686158] hover:text-[#24211D] transition-all cursor-pointer shadow-xs active:scale-95"
                        aria-label="Lift cap and spray atomizer"
                      >
                        <Sparkles className="w-3 h-3 text-[#9A7432]" />
                        <span>{isSprayingStudio ? 'Atomizer Spraying...' : 'Lift Cap & Spray Flacon'}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Bottom Note Pills inside Visual Card */}
              <div className="relative z-20 flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-[#DED7CC]">
                <div className="flex flex-wrap items-center gap-1.5">
                  {product.families.map((fam) => (
                    <span
                      key={fam}
                      className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded bg-[#FFFFFF] text-[#24211D] border border-[#DED7CC]"
                    >
                      {fam}
                    </span>
                  ))}
                </div>
                <span className="text-[11px] font-mono text-[#686158]">
                  SKU: {currentVariant?.sku}
                </span>
              </div>
            </div>

            {/* Variant Thumbnail Strip if Additional Images or Static Poster exist */}
            {(additionalImages.length > 0 || posterImageUrl) && (
              <div className="flex items-center gap-3 overflow-x-auto py-1">
                <button
                  onClick={() => setSelectedGalleryImage(null)}
                  className={`px-3 py-2 rounded-lg border text-xs uppercase tracking-wider cursor-pointer ${
                    !selectedGalleryImage
                      ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-[#D4AF37]'
                      : 'border-white/10 bg-[#0E0E14] text-stone-400'
                  }`}
                >
                  Primary Bottle View
                </button>
                {posterImageUrl && (
                  <button
                    onClick={() => setSelectedGalleryImage(posterImageUrl)}
                    className={`px-3 py-2 rounded-lg border text-xs uppercase tracking-wider cursor-pointer ${
                      selectedGalleryImage === posterImageUrl
                        ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-[#D4AF37]'
                        : 'border-white/10 bg-[#0E0E14] text-stone-400'
                    }`}
                  >
                    Poster Image
                  </button>
                )}
                {additionalImages.map((imgUrl: string, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedGalleryImage(imgUrl)}
                    className={`px-3 py-2 rounded-lg border text-xs uppercase tracking-wider cursor-pointer ${
                      selectedGalleryImage === imgUrl
                        ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-[#D4AF37]'
                        : 'border-white/10 bg-[#0E0E14] text-stone-400'
                    }`}
                  >
                    View {idx + 2}
                  </button>
                ))}
              </div>
            )}

            {/* Quick Scent Architecture Summary Bar */}
            {(product.longevity || product.sillage) && (
              <div className="grid grid-cols-2 gap-3">
                {product.longevity && (
                  <div className="p-3.5 rounded-xl bg-[#0E0E14] border border-white/10 text-center">
                    <div className="flex items-center justify-center text-[#D4AF37] mb-1">
                      <Clock className="w-4 h-4 mr-1.5" />
                      <span className="text-[10px] font-mono uppercase tracking-wider">Longevity</span>
                    </div>
                    <p className="text-xs sm:text-sm font-semibold text-white">{product.longevity}</p>
                  </div>
                )}
                {product.sillage && (
                  <div className="p-3.5 rounded-xl bg-[#0E0E14] border border-white/10 text-center">
                    <div className="flex items-center justify-center text-[#D4AF37] mb-1">
                      <Wind className="w-4 h-4 mr-1.5" />
                      <span className="text-[10px] font-mono uppercase tracking-wider">Sillage</span>
                    </div>
                    <p className="text-xs sm:text-sm font-semibold text-white">{product.sillage}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Buying Box, Variant Selector, Notes Pyramid & Details */}
          <div ref={pdpRightColRef} className="lg:col-span-6 space-y-8 will-change-transform">
            {/* Title & Tagline */}
            <div className="space-y-3 border-b border-white/10 pb-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-[0.25em] text-[#D4AF37]">
                  {product.collection} · {currentVariant?.size}
                </span>

                {product.reviewCount > 0 && (
                  <a
                    href="#reviews"
                    className="flex items-center space-x-1.5 text-xs hover:text-[#D4AF37] transition-colors"
                  >
                    <div className="flex items-center text-amber-400">
                      <Star className="w-3.5 h-3.5 fill-current" />
                      <span className="ml-1 font-semibold text-white">{product.rating}</span>
                    </div>
                    <span className="text-white/50">({product.reviewCount} Reviews)</span>
                  </a>
                )}
              </div>

              <h1 className="font-serif text-4xl sm:text-5xl tracking-[0.12em] uppercase text-white font-normal">
                {product.name}
              </h1>

              <p className="text-base text-amber-200/90 font-serif italic">
                {product.subtitle || product.scentProfile}
              </p>

              <p className="text-sm sm:text-base text-[#D1CECB] font-light leading-relaxed pt-1">
                {product.description}
              </p>
            </div>

            {/* Pricing Block (Strictly Selling Price in INR — No invented MRP or discounts) */}
            {currentVariant && (
              <div className="space-y-2">
                <div className="flex items-baseline space-x-3">
                  <span className="text-3xl sm:text-4xl font-mono font-bold text-white tabular-nums">
                    ₹{currentVariant.sellingPrice.toLocaleString('en-IN')}
                  </span>
                  {currentVariant.mrp > currentVariant.sellingPrice && (
                    <span className="text-base font-mono text-white/40 line-through tabular-nums">
                      MRP ₹{currentVariant.mrp.toLocaleString('en-IN')}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-white/50 font-mono">
                  Inclusive of all taxes · Selected Variant SKU: {currentVariant.sku}
                </p>
              </div>
            )}

            {/* Size Variant Selector */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono uppercase tracking-[0.2em] text-white/80">
                  Select Bottle Size: <span className="text-[#D4AF37] font-bold">{currentVariant?.size}</span>
                </label>
                <span className="text-xs font-mono text-emerald-400 flex items-center">
                  <span className="w-2 h-2 rounded-full mr-1.5 bg-emerald-400" />
                  {currentVariant?.stockManaged === false && currentVariant?.stockAvailable === 0
                    ? 'Available for Order'
                    : currentVariant && currentVariant.stockAvailable > 0
                    ? `In Stock (${currentVariant.stockAvailable} available)`
                    : 'Currently Unavailable'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {publicVariants.map((v) => {
                  const isSelected = v.size === currentVariant?.size;
                  return (
                    <button
                      key={v.id}
                      onClick={() => setSelectedSize(v.size)}
                      className={`relative p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[#D4AF37] bg-[#D4AF37]/15 shadow-[0_0_20px_rgba(212,175,55,0.15)]'
                          : 'border-white/15 bg-[#0E0E14] hover:border-white/35'
                      }`}
                    >
                      <div className="text-xs font-mono uppercase font-bold text-white">{v.size}</div>
                      <div className="flex items-baseline gap-1.5 mt-1 font-mono">
                        <span className="text-sm font-bold text-[#D4AF37] tabular-nums">
                          ₹{v.sellingPrice.toLocaleString('en-IN')}
                        </span>
                        {v.mrp > v.sellingPrice && (
                          <span className="text-[10px] text-white/40 line-through tabular-nums">
                            ₹{v.mrp.toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] font-mono text-white/45 mt-0.5 truncate">
                        {v.sku}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom 6-Flavour Selector for Discovery Set */}
            {isDiscoveryProduct && (
              <div className="p-5 sm:p-6 rounded-2xl bg-[#FFFFFF] border border-[#DED7CC] space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DED7CC] pb-3">
                  <div>
                    <span className="text-xs font-mono uppercase tracking-[0.2em] text-[#9A783E] font-bold block">
                      Select Your Desired 6 Signature Perfumes
                    </span>
                    <span className="text-[11px] text-[#686158]">
                      Choose any 6 × {currentVariant?.size || '2 ml'} deluxe spray atomizers from the 9 Signature creations
                    </span>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-mono font-bold ${
                      selectedDiscoverySlugs.length === 6
                        ? 'bg-emerald-500/15 text-emerald-700 border border-emerald-500/30'
                        : 'bg-[#F1EDE5] text-[#9A783E] border border-[#DED7CC]'
                    }`}
                  >
                    {selectedDiscoverySlugs.length} / 6 Selected
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {FRAGRANCE_JOURNEY_DATA.map((item) => {
                    const isPicked = selectedDiscoverySlugs.includes(item.slug);
                    const slotIdx = selectedDiscoverySlugs.indexOf(item.slug) + 1;
                    return (
                      <button
                        key={item.slug}
                        type="button"
                        onClick={() => handleToggleDiscoveryFlavour(item.slug)}
                        className={`relative p-2.5 rounded-xl border flex items-center gap-2.5 text-left transition-all cursor-pointer ${
                          isPicked
                            ? 'bg-[#FAF8F4] border-[#9A783E] ring-1 ring-[#9A783E] shadow-xs'
                            : 'bg-[#FFFFFF] border-[#DED7CC] hover:border-[#9A783E]/60 opacity-80 hover:opacity-100'
                        }`}
                      >
                        <div
                          className={`absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold ${
                            isPicked
                              ? 'bg-[#9A783E] text-[#FAF8F4]'
                              : 'bg-[#F1EDE5] text-[#686158] border border-[#DED7CC]'
                          }`}
                        >
                          {isPicked ? slotIdx : '+'}
                        </div>
                        <FragmoreBottleVisual
                          slug={item.slug}
                          size="2 ml"
                          productName={item.name}
                          className="w-8 h-12 shrink-0"
                          showGlow={false}
                          showShadow={false}
                        />
                        <div className="min-w-0 pr-4">
                          <span className="text-[9px] font-mono text-[#9A783E] block">
                            N° {item.code}
                          </span>
                          <span className="font-serif text-[11px] font-bold text-[#24211D] uppercase block truncate">
                            {item.name}
                          </span>
                          <span className="text-[9px] text-[#686158] block truncate">
                            {item.topNotes[0]} · {item.baseNotes[0]}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Olfactory Pyramid (Supplied Top, Heart, Base Notes) */}
            <div className="p-6 rounded-2xl bg-[#0E0E14] border border-white/10 space-y-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <span className="text-xs font-mono uppercase tracking-[0.2em] text-[#D4AF37]">
                  Olfactory Architecture
                </span>
                <span className="text-[11px] text-white/50 font-mono">Top · Heart · Base Notes</span>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-12 gap-3 items-start">
                  <div className="col-span-4 sm:col-span-3">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-[#D4AF37] block">
                      Top Notes
                    </span>
                    <span className="text-[10px] text-white/40">Opening Accord</span>
                  </div>
                  <div className="col-span-8 sm:col-span-9 flex flex-wrap gap-1.5">
                    {product.notes.top.map((note) => (
                      <span
                        key={note}
                        className="px-3 py-1 rounded-full text-xs bg-white/5 border border-white/10 text-white"
                      >
                        {note}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-3 items-start border-t border-white/5 pt-3.5">
                  <div className="col-span-4 sm:col-span-3">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-[#D4AF37] block">
                      Heart Notes
                    </span>
                    <span className="text-[10px] text-white/40">Core Signature</span>
                  </div>
                  <div className="col-span-8 sm:col-span-9 flex flex-wrap gap-1.5">
                    {product.notes.heart.map((note) => (
                      <span
                        key={note}
                        className="px-3 py-1 rounded-full text-xs bg-white/5 border border-white/10 text-white"
                      >
                        {note}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-3 items-start border-t border-white/5 pt-3.5">
                  <div className="col-span-4 sm:col-span-3">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-[#D4AF37] block">
                      Base Notes
                    </span>
                    <span className="text-[10px] text-white/40">Lasting Trail</span>
                  </div>
                  <div className="col-span-8 sm:col-span-9 flex flex-wrap gap-1.5">
                    {product.notes.base.map((note) => (
                      <span
                        key={note}
                        className="px-3 py-1 rounded-full text-xs bg-white/5 border border-white/10 text-white"
                      >
                        {note}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Add to Bag & Express Buy CTA */}
            {isVariantPurchasable ? (
              <div className="space-y-3 pt-2">
                <div className="flex items-stretch gap-3">
                  {/* Quantity Selector */}
                  <div className="flex items-center border border-white/20 rounded-xl bg-[#0E0E14] px-2">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-9 h-11 text-white/70 hover:text-white font-mono text-lg cursor-pointer"
                    >
                      -
                    </button>
                    <span className="w-8 text-center font-mono text-sm font-semibold tabular-nums">
                      {quantity}
                    </span>
                    <button
                      onClick={() => setQuantity(Math.min(maxOrderQty, quantity + 1))}
                      className="w-9 h-11 text-white/70 hover:text-white font-mono text-lg cursor-pointer"
                    >
                      +
                    </button>
                  </div>

                  {/* Add to Cart Button */}
                  <button
                    onClick={handleAddToCart}
                    className="flex-1 min-h-[52px] bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] font-semibold text-xs sm:text-sm uppercase tracking-[0.2em] rounded-xl flex items-center justify-center space-x-2.5 transition-all shadow-lg shadow-[#D4AF37]/20 cursor-pointer"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>
                      Add {currentVariant?.size} to Bag — ₹
                      {((currentVariant?.sellingPrice || 0) * quantity).toLocaleString('en-IN')}
                    </span>
                  </button>

                  {/* Wishlist Button */}
                  <button
                    onClick={() => toggleWishlist(product.slug)}
                    aria-label="Save to Wishlist"
                    className={`w-13 min-h-[52px] rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                      isInWishlist(product.slug)
                        ? 'border-rose-500 bg-rose-500/15 text-rose-400'
                        : 'border-white/20 bg-[#0E0E14] text-white/70 hover:text-white hover:border-white/40'
                    }`}
                  >
                    <Heart className={`w-5 h-5 ${isInWishlist(product.slug) ? 'fill-current' : ''}`} />
                  </button>
                </div>

                <button
                  onClick={handleBuyNow}
                  className="w-full min-h-[48px] border border-[#D4AF37]/50 hover:border-[#D4AF37] bg-white/[0.03] hover:bg-[#D4AF37]/10 text-[#F3EFE6] text-xs uppercase tracking-[0.25em] font-semibold rounded-xl transition-all cursor-pointer"
                >
                  Instant Checkout (COD Available)
                </button>

                {/* Complimentary Cart Offers (₹999 -> 2ml Sample Free, ₹2,499 -> One Aura Perfume Free) */}
                <div className="p-4 rounded-xl bg-[#141218] border border-[#D4AF37]/35 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#D4AF37] font-semibold">
                    <Gift className="w-4 h-4 shrink-0" />
                    <span>Complimentary Bag Offers</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/10 flex items-center justify-between">
                      <div>
                        <span className="font-mono text-[#D4AF37] font-bold block">Orders Worth ₹999+</span>
                        <span className="text-white/80 text-[11px]">2 ml Sample Free + Free Shipping</span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-mono text-[10px] font-bold uppercase">
                        FREE
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/10 flex items-center justify-between">
                      <div>
                        <span className="font-mono text-[#D4AF37] font-bold block">Orders Worth ₹2,499+</span>
                        <span className="text-white/80 text-[11px]">One Aura Perfume Free (15 ml)</span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold uppercase">
                        FREE
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Back-in-Stock Capture Form */
              <div className="p-5 rounded-2xl bg-[#141218] border border-amber-500/30 space-y-4">
                <div className="flex items-center space-x-2 text-amber-400">
                  <Bell className="w-4 h-4" />
                  <span className="text-xs font-mono uppercase tracking-wider font-semibold">
                    {isArchivedProduct
                      ? 'Archived Creation — Notify Me of Re-Edition'
                      : 'Notify Me When Available'}
                  </span>
                </div>
                {bisSubmitted ? (
                  <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>You are on the priority list for {product.name} ({currentVariant?.size}).</span>
                  </p>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!bisEmail) return;
                      addBackInStockRequest(
                        product.id,
                        product.name,
                        currentVariant?.size || selectedSize,
                        bisEmail,
                        bisPhone
                      );
                      setBisSubmitted(true);
                    }}
                    className="grid grid-cols-1 sm:grid-cols-3 gap-2.5"
                  >
                    <input
                      type="email"
                      required
                      placeholder="Email Address"
                      value={bisEmail}
                      onChange={(e) => setBisEmail(e.target.value)}
                      className="bg-[#08080A] border border-white/15 rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                    />
                    <input
                      type="tel"
                      placeholder="WhatsApp Number"
                      value={bisPhone}
                      onChange={(e) => setBisPhone(e.target.value)}
                      className="bg-[#08080A] border border-white/15 rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                    />
                    <button
                      type="submit"
                      className="bg-[#D4AF37] text-[#08080A] font-semibold text-xs uppercase tracking-wider rounded-lg px-4 py-2.5 cursor-pointer"
                    >
                      Notify Me
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* Trust & Delivery Assurances */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
              <div className="flex items-center space-x-2.5 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <Truck className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <span className="text-[11px] text-white/80 leading-tight">
                  Express Insured Shipping Across India
                </span>
              </div>
              <div className="flex items-center space-x-2.5 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <ShieldCheck className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <span className="text-[11px] text-white/80 leading-tight">
                  Authentic FRAGMORÉ Creation
                </span>
              </div>
              <div className="flex items-center space-x-2.5 p-3 rounded-xl bg-white/[0.02] border border-white/5 col-span-2 sm:col-span-1">
                <Gift className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <span className="text-[11px] text-white/80 leading-tight">
                  Luxury Gift Coffret Packaging
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ACCORDION SECTIONS: NOTES, OCCASIONS, SHIPPING */}
        <div className="mt-16 max-w-4xl mx-auto space-y-3">
          <div className="border border-white/10 rounded-xl bg-[#0E0E14] overflow-hidden">
            <button
              onClick={() => setOpenAccordion(openAccordion === 'notes' ? '' : 'notes')}
              className="w-full p-5 flex items-center justify-between text-left font-serif text-lg tracking-wider uppercase text-white hover:text-[#D4AF37] transition-colors cursor-pointer"
            >
              <span>Olfactory Notes Breakdown</span>
              <ChevronDown
                className={`w-5 h-5 transition-transform ${
                  openAccordion === 'notes' ? 'rotate-180 text-[#D4AF37]' : ''
                }`}
              />
            </button>
            {openAccordion === 'notes' && (
              <div className="px-5 pb-6 border-t border-white/5 pt-4 space-y-4 text-xs">
                <div className="space-y-1">
                  <strong className="text-xs font-mono text-[#D4AF37] uppercase tracking-wider block">
                    Top Notes
                  </strong>
                  <p className="text-sm text-white">{product.notes.top.join(' · ')}</p>
                </div>
                <div className="space-y-1">
                  <strong className="text-xs font-mono text-[#D4AF37] uppercase tracking-wider block">
                    Heart Notes
                  </strong>
                  <p className="text-sm text-white">{product.notes.heart.join(' · ')}</p>
                </div>
                <div className="space-y-1">
                  <strong className="text-xs font-mono text-[#D4AF37] uppercase tracking-wider block">
                    Base Notes
                  </strong>
                  <p className="text-sm text-white">{product.notes.base.join(' · ')}</p>
                </div>
              </div>
            )}
          </div>

          <div className="border border-white/10 rounded-xl bg-[#0E0E14] overflow-hidden">
            <button
              onClick={() => setOpenAccordion(openAccordion === 'usage' ? '' : 'usage')}
              className="w-full p-5 flex items-center justify-between text-left font-serif text-lg tracking-wider uppercase text-white hover:text-[#D4AF37] transition-colors cursor-pointer"
            >
              <span>Occasion Associations & Application</span>
              <ChevronDown
                className={`w-5 h-5 transition-transform ${
                  openAccordion === 'usage' ? 'rotate-180 text-[#D4AF37]' : ''
                }`}
              />
            </button>
            {openAccordion === 'usage' && (
              <div className="px-5 pb-6 border-t border-white/5 pt-4 space-y-3 text-xs text-[#D1CECB] font-light leading-relaxed">
                {product.occasions.length > 0 && (
                  <p>
                    <strong>Occasion Associations:</strong> {product.occasions.join(', ')}.
                  </p>
                )}
                <p>
                  <strong>Fragrance Families:</strong> {product.families.join(', ')}.
                </p>
              </div>
            )}
          </div>

          <div className="border border-white/10 rounded-xl bg-[#0E0E14] overflow-hidden">
            <button
              onClick={() => setOpenAccordion(openAccordion === 'shipping' ? '' : 'shipping')}
              className="w-full p-5 flex items-center justify-between text-left font-serif text-lg tracking-wider uppercase text-white hover:text-[#D4AF37] transition-colors cursor-pointer"
            >
              <span>Shipping & Delivery</span>
              <ChevronDown
                className={`w-5 h-5 transition-transform ${
                  openAccordion === 'shipping' ? 'rotate-180 text-[#D4AF37]' : ''
                }`}
              />
            </button>
            {openAccordion === 'shipping' && (
              <div className="px-5 pb-6 border-t border-white/5 pt-4 text-xs text-[#D1CECB] space-y-2 leading-relaxed">
                <p>
                  All FRAGMORÉ flacons are dispatched in tamper-evident protective packaging via insured courier partners across India.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* VERIFIED CUSTOMER REVIEWS SECTION */}
        <div id="reviews" className="mt-20 border-t border-white/10 pt-12 max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <span className="text-xs font-mono tracking-widest text-[#D4AF37] uppercase">
                Customer Voices
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl tracking-wider uppercase font-light text-white">
                Verified Reviews ({productReviews.length})
              </h2>
            </div>
            <button
              onClick={() => setReviewModalOpen(true)}
              className="px-5 py-2.5 bg-white/10 hover:bg-[#D4AF37] hover:text-[#08080A] text-xs font-semibold uppercase tracking-wider rounded transition-colors self-start sm:self-auto cursor-pointer"
            >
              Write A Review
            </button>
          </div>

          <div className="space-y-4">
            {productReviews.length === 0 ? (
              <div className="p-8 text-center text-xs text-white/50 bg-[#0E0E14] rounded-xl border border-white/5">
                Be the first to share your experience with {product.name}.
              </div>
            ) : (
              productReviews.map((rev) => (
                <div
                  key={rev.id}
                  className="p-6 bg-[#0E0E14] border border-white/10 rounded-xl space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex text-amber-400">
                        {[...Array(rev.rating)].map((_, i) => (
                          <Star key={i} className="w-3.5 h-3.5 fill-current" />
                        ))}
                      </div>
                      <span className="text-xs font-semibold text-white">{rev.title}</span>
                    </div>
                    <span className="text-[11px] font-mono text-white/40">{rev.date}</span>
                  </div>

                  <p className="text-xs sm:text-sm text-[#D1CECB] font-light leading-relaxed">
                    {rev.content}
                  </p>

                  <div className="flex items-center gap-2 pt-2 text-[11px] text-white/60">
                    <span className="font-medium text-white">{rev.customerName}</span>
                    {rev.isVerifiedPurchase && (
                      <span className="text-emerald-400 flex items-center gap-1 font-mono text-[10px]">
                        <CheckCircle2 className="w-3 h-3" /> Verified Purchaser
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RELATED FRAGRANCES (4-Bottle Staggered Lineup Wave Matching Video 00:10-00:11) */}
        {relatedProducts.length > 0 && (
          <div ref={relatedSectionRef} className="mt-20 border-t border-white/10 pt-12">
            <div className="text-center mb-10 space-y-1">
              <span className="text-xs font-mono tracking-widest text-[#D4AF37] uppercase">
                From the {product.collection}
              </span>
              <h3 className="font-serif text-2xl sm:text-3xl tracking-widest uppercase font-light text-white">
                You May Also Admire
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
              {relatedProducts.map((rel, idx) => {
                const relVar =
                  rel.variants.find((v) => v.isAvailable !== false && v.sellingPrice > 0) ||
                  rel.variants[0];
                return (
                  <div
                    key={rel.id}
                    ref={(el) => {
                      relatedCardsRef.current[idx] = el;
                    }}
                    onClick={() => {
                      setSelectedProductSlug(rel.slug);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="p-5 bg-[#0E0E14] border border-white/10 hover:border-[#D4AF37] rounded-xl cursor-pointer transition-all duration-500 group flex flex-col justify-between will-change-transform hover:-translate-y-2"
                  >
                    <div className="h-52 w-full flex items-center justify-center mb-3 bg-white/[0.02] rounded-lg p-2 overflow-visible">
                      <div className="transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-2 group-hover:scale-105">
                        <FragmoreBottleVisual
                          slug={rel.slug}
                          size={relVar?.size}
                          variant={relVar}
                          productName={rel.name}
                          productTagline={rel.subtitle}
                          collection={rel.collection}
                          className="w-36 h-48"
                          interactive
                          showGlow={false}
                          showShadow={true}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-mono text-[#D4AF37] uppercase">
                        {rel.collection} · {relVar?.size}
                      </div>
                      <h4 className="font-serif text-lg text-white group-hover:text-[#D4AF37] uppercase transition-colors">
                        {rel.name}
                      </h4>
                      <p className="text-xs text-white/60 font-light line-clamp-1 mt-1">
                        {rel.subtitle || rel.scentProfile}
                      </p>
                      <span className="block mt-3 text-xs font-mono font-medium text-white tabular-nums">
                        ₹{(relVar?.sellingPrice || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* MOBILE STICKY BOTTOM BUY BAR */}
      {currentVariant && isVariantPurchasable && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0E0E14]/95 backdrop-blur-md border-t border-white/15 p-3 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center justify-between gap-3 shadow-2xl">
          <div>
            <span className="text-[10px] text-white/50 block font-mono">
              {product.name} ({currentVariant.size})
            </span>
            <span className="text-base font-bold font-mono text-[#F3EFE6] tabular-nums">
              ₹{currentVariant.sellingPrice.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddToCart}
              className="min-h-[44px] px-5 py-2.5 bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] text-xs font-semibold uppercase tracking-wider rounded-lg flex items-center gap-1.5 shadow-md shadow-[#D4AF37]/20 cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Add {currentVariant.size}</span>
            </button>
          </div>
        </div>
      )}

      {/* WRITE A REVIEW MODAL */}
      {reviewModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setReviewModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
        >
          <div className="bg-[#0E0E14] border border-white/15 w-full max-w-lg rounded-2xl p-6 sm:p-8 relative text-[#F3EFE6]">
            <h3 className="font-serif text-2xl tracking-wider uppercase text-white mb-4">
              Write A Review
            </h3>
            <form onSubmit={handleSubmitReview} className="space-y-4 text-xs">
              <div>
                <label className="block text-white/70 mb-1 font-mono">Rating (1 to 5 Stars)</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setReviewRating(num)}
                      className={`p-2 rounded border cursor-pointer ${
                        reviewRating >= num
                          ? 'border-amber-400 bg-amber-400/20 text-amber-400'
                          : 'border-white/20 text-white/40'
                      }`}
                    >
                      <Star className="w-4 h-4 fill-current" />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-white/70 mb-1 font-mono">Your Name</label>
                <input
                  type="text"
                  required
                  value={reviewName}
                  onChange={(e) => setReviewName(e.target.value)}
                  placeholder="Your Name"
                  className="w-full bg-[#08080A] border border-white/20 rounded p-2.5 text-white focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block text-white/70 mb-1 font-mono">Review Headline</label>
                <input
                  type="text"
                  required
                  value={reviewTitle}
                  onChange={(e) => setReviewTitle(e.target.value)}
                  placeholder="Summary of your experience"
                  className="w-full bg-[#08080A] border border-white/20 rounded p-2.5 text-white focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block text-white/70 mb-1 font-mono">Your Impressions</label>
                <textarea
                  required
                  rows={4}
                  value={reviewContent}
                  onChange={(e) => setReviewContent(e.target.value)}
                  placeholder="Share your thoughts on the notes and character of this fragrance..."
                  className="w-full bg-[#08080A] border border-white/20 rounded p-2.5 text-white focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setReviewModalOpen(false)}
                  className="px-4 py-2 border border-white/20 rounded text-white/70 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] font-semibold uppercase tracking-wider rounded cursor-pointer"
                >
                  Publish Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
