import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import gsap from 'gsap';
import { useStore } from '../../context/StoreContext';
import {
  FragmoreBottleVisual,
  getBottleDataBySlug
} from './FragmoreBottleVisual';
import {
  getSprayPaletteForSlug,
  resolveNoteIngredient,
  ResolvedIngredientNote,
  FragranceSprayPalette
} from '../../data/noteIngredients';
import { ArrowRight, Sparkles, ShoppingBag, Wind } from 'lucide-react';

const APPROVED_SIGNATURE_SLUGS = [
  'golden-hour',
  'blush-and-blossom',
  'violet-noir',
  'aqua-pulse',
  'luxe-heritage',
  'flora-crush',
  'midnight-glow',
  'silky-velvet',
  'night-bloom'
];

interface SceneMistParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  maxAlpha: number;
  life: number;
  maxLife: number;
  rgb: [number, number, number];
  turbulencePhase: number;
  turbulenceSpeed: number;
}

const NoteTile: React.FC<{
  note: ResolvedIngredientNote;
  accentHex: string;
  compact?: boolean;
}> = ({ note, accentHex, compact = false }) => {
  const [imgError, setImgError] = useState(false);
  const showPhoto = Boolean(note.imageUrl && !note.isAbstract && !imgError);

  return (
    <div
      className={`group flex items-center gap-2.5 rounded-xl bg-[#FFFFFF] border border-[#DED7CC] hover:border-[#9A783E] transition-all duration-300 ${
        compact ? 'p-1.5 pr-2.5' : 'p-2 pr-3'
      }`}
    >
      {/* Reserved Square Thumbnail Dimension Prevents Layout Shifts */}
      <div
        className={`relative shrink-0 rounded-lg overflow-hidden border border-[#DED7CC] bg-[#F1EDE5] flex items-center justify-center ${
          compact ? 'w-9 h-9' : 'w-10 h-10'
        }`}
      >
        {showPhoto ? (
          <img
            src={note.imageUrl}
            alt={note.alt}
            width={40}
            height={40}
            loading="lazy"
            decoding="async"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          /* Honest Editorial Mood Swatch for Abstract Olfactory Accords */
          <div
            aria-label={note.alt}
            className="w-full h-full flex flex-col items-center justify-center text-center p-1"
            style={{
              background: `linear-gradient(135deg, ${
                note.moodSwatches?.[0] || accentHex
              } 0%, ${note.moodSwatches?.[1] || '#24211D'} 100%)`
            }}
          >
            <Sparkles className="w-3.5 h-3.5 text-white/90 drop-shadow-sm" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-[#24211D] leading-tight truncate">
          {note.label}
        </div>
        <div className="text-[9px] font-mono uppercase tracking-[0.14em] text-[#686158] truncate mt-0.5">
          {note.isAbstract ? note.subtitle || 'Olfactory Accord' : 'Botanical Note'}
        </div>
      </div>
    </div>
  );
};

export const FragranceScrollJourney: React.FC = () => {
  const {
    products,
    cms,
    setCurrentView,
    setSelectedProductSlug,
    addToCart
  } = useStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const stickyStageRef = useRef<HTMLDivElement>(null);
  const infoStageRef = useRef<HTMLDivElement>(null);
  const notesStageRef = useRef<HTMLDivElement>(null);
  const sprayCanvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const particlesRef = useRef<SceneMistParticle[]>([]);
  const prevIndexRef = useRef<number>(0);
  const fallbackPinRef = useRef<number>(0);

  const [activeIndex, setActiveIndex] = useState(0);
  const [continuousIndex, setContinuousIndex] = useState(0); // 0.00 -> 8.00 continuous scroll position
  const [fallbackTranslateY, setFallbackTranslateY] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isSprayingMist, setIsSprayingMist] = useState(false);

  // Build ordered list of the 9 approved Signature fragrances from database records
  const orderedSignatureProducts = useMemo(() => {
    const orderSlugs =
      Array.isArray(cms.scrollStoryFragrances) && cms.scrollStoryFragrances.length >= 9
        ? cms.scrollStoryFragrances.slice(0, 9)
        : APPROVED_SIGNATURE_SLUGS;

    return orderSlugs.map((slug, idx) => {
      const dbProd = products.find(
        (p) => p.slug === slug && p.status !== 'ARCHIVED' && p.status !== 'INACTIVE'
      );
      const visualMeta = getBottleDataBySlug(slug, dbProd?.name, dbProd?.subtitle);
      const sprayPalette = getSprayPaletteForSlug(slug);
      const rawNotes = dbProd?.notes || {
        top: visualMeta.topNotes,
        heart: visualMeta.heartNotes,
        base: visualMeta.baseNotes
      };
      const noteMediaMap = dbProd?.noteMedia;

      return {
        indexNumber: String(idx + 1).padStart(2, '0'),
        slug,
        product: dbProd,
        visual: visualMeta,
        sprayPalette,
        name: dbProd?.name || visualMeta.name,
        tagline: dbProd?.subtitle || dbProd?.scentProfile || visualMeta.tagline,
        description: dbProd?.description || visualMeta.description,
        notes: rawNotes,
        resolvedNotes: {
          top: (rawNotes.top || []).map((n) => resolveNoteIngredient(n, noteMediaMap)),
          heart: (rawNotes.heart || []).map((n) => resolveNoteIngredient(n, noteMediaMap)),
          base: (rawNotes.base || []).map((n) => resolveNoteIngredient(n, noteMediaMap))
        },
        variants:
          dbProd?.variants?.filter((v) => v.isAvailable && v.sellingPrice > 0) || [
            {
              id: `${slug}-30ml`,
              size: '30 ml',
              sku: '',
              mrp: 699,
              sellingPrice: 699,
              stockOnHand: 25,
              stockReserved: 0,
              stockAvailable: 25,
              isAvailable: true
            },
            {
              id: `${slug}-50ml`,
              size: '50 ml',
              sku: '',
              mrp: slug === 'luxe-heritage' ? 699 : 999,
              sellingPrice: slug === 'luxe-heritage' ? 699 : 999,
              stockOnHand: 25,
              stockReserved: 0,
              stockAvailable: 25,
              isAvailable: true
            }
          ]
      };
    });
  }, [products, cms.scrollStoryFragrances]);

  // Detect reduced motion preference
  useEffect(() => {
    const mqMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mqMotion.matches);
    const onMotionChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mqMotion.addEventListener('change', onMotionChange);
    return () => mqMotion.removeEventListener('change', onMotionChange);
  }, []);

  // Controlled Finite Fragrance-Colored Mist Burst Radiating from the Background Behind the Bottle
  const triggerSceneMistBurst = useCallback(
    (palette: FragranceSprayPalette) => {
      if (prefersReducedMotion) return;
      const canvas = sprayCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(280, rect.width || 380);
      const height = Math.max(320, rect.height || 400);

      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }

      // Smoothly fade any existing particles from previous fragrance scene before introducing new palette
      particlesRef.current.forEach((p) => {
        p.maxLife = Math.min(p.maxLife, p.life + 14);
        p.maxAlpha *= 0.45;
      });

      // Origin centered in the middle of the bottle (exact 50% 50% center)
      const originX = width * 0.5;
      const originY = height * 0.50;
      const burstCount = 104;
      const rgbChoices: [number, number, number][] = [
        palette.primaryRgb,
        palette.secondaryRgb,
        palette.tertiaryRgb
      ];

      for (let i = 0; i < burstCount; i++) {
        const isPlume = i < burstCount * 0.44;
        const angleRad = (i / burstCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.45;
        const startOffset = 22 + Math.random() * 44;
        const speed = isPlume ? 0.9 + Math.random() * 2.4 : 1.6 + Math.random() * 3.8;

        particlesRef.current.push({
          x: originX + Math.cos(angleRad) * startOffset,
          y: originY + Math.sin(angleRad) * (startOffset * 0.85),
          vx: Math.cos(angleRad) * speed,
          vy: Math.sin(angleRad) * (speed * 0.85) - 0.18,
          radius: isPlume ? 18 + Math.random() * 24 : 1.2 + Math.random() * 2.2,
          alpha: 0,
          maxAlpha: isPlume ? 0.16 + Math.random() * 0.14 : 0.28 + Math.random() * 0.34,
          life: 0,
          maxLife: 48 + Math.floor(Math.random() * 44),
          rgb: rgbChoices[i % 3],
          turbulencePhase: Math.random() * Math.PI * 2,
          turbulenceSpeed: 0.04 + Math.random() * 0.06
        });
      }

      setIsSprayingMist(true);

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }

      let frame = 0;
      const animateMist = () => {
        frame++;
        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, width, height);

        // Soft atmospheric background aura blooming behind the bottle body
        if (frame <= 54) {
          const haloProgress = frame / 54;
          const haloAlpha = Math.sin(haloProgress * Math.PI) * 0.24;
          const [r1, g1, b1] = palette.primaryRgb;
          const [r2, g2, b2] = palette.secondaryRgb;
          const haloRadius = Math.min(width, height) * (0.34 + haloProgress * 0.16);
          const grad = ctx.createRadialGradient(
            originX,
            originY,
            18,
            originX,
            originY,
            haloRadius
          );
          grad.addColorStop(0, `rgba(${r1}, ${g1}, ${b1}, ${haloAlpha.toFixed(3)})`);
          grad.addColorStop(0.55, `rgba(${r2}, ${g2}, ${b2}, ${(haloAlpha * 0.55).toFixed(3)})`);
          grad.addColorStop(1, `rgba(${r2}, ${g2}, ${b2}, 0)`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(originX, originY, haloRadius, 0, Math.PI * 2);
          ctx.fill();
        }

        let alive = 0;
        const pool = particlesRef.current;

        for (let i = 0; i < pool.length; i++) {
          const p = pool[i];
          if (p.life >= p.maxLife) continue;
          p.life++;
          alive++;

          p.vx *= 0.965;
          p.vy *= 0.965;
          p.turbulencePhase += p.turbulenceSpeed;
          p.x += p.vx + Math.cos(p.turbulencePhase) * 0.28;
          p.y += p.vy + Math.sin(p.turbulencePhase) * 0.28 - 0.05;

          const isSoftCloud = p.radius > 8;
          p.radius += isSoftCloud ? 0.45 : 0.015;

          const prog = p.life / p.maxLife;
          if (prog < 0.2) {
            p.alpha = (prog / 0.2) * p.maxAlpha;
          } else {
            p.alpha = (1 - (prog - 0.2) / 0.8) * p.maxAlpha;
          }

          const [r, g, b] = p.rgb;
          const safeAlpha = Math.max(0, p.alpha);

          if (isSoftCloud) {
            const cloudGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
            cloudGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${safeAlpha.toFixed(3)})`);
            cloudGrad.addColorStop(0.55, `rgba(${r}, ${g}, ${b}, ${(safeAlpha * 0.45).toFixed(3)})`);
            cloudGrad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
            ctx.fillStyle = cloudGrad;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${safeAlpha.toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        ctx.restore();

        if (alive > 0) {
          rafRef.current = requestAnimationFrame(animateMist);
        } else {
          particlesRef.current = [];
          rafRef.current = null;
          setIsSprayingMist(false);
        }
      };

      rafRef.current = requestAnimationFrame(animateMist);
    },
    [prefersReducedMotion]
  );

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  // Scroll-Driven Progression (Works across all viewports & guarantees zero empty white space below)
  useEffect(() => {
    if (prefersReducedMotion) return;

    const handleScroll = () => {
      const container = containerRef.current;
      const stage = stickyStageRef.current;
      if (!container || !stage) return;

      const rect = container.getBoundingClientRect();
      const stageHeight = stage.offsetHeight || window.innerHeight - 64;
      const headerOffset = window.innerWidth >= 640 ? 80 : 64;
      const totalScrollable = Math.max(1, rect.height - stageHeight);

      // Calculate how far the user has scrolled into the Signature Collection container
      const scrolled = headerOffset - rect.top;
      const clampedProgress = Math.max(0, Math.min(1, scrolled / totalScrollable));

      const count = orderedSignatureProducts.length;
      const exactFloat = clampedProgress * (count - 1);
      setContinuousIndex(exactFloat);

      const nextIndex = Math.min(count - 1, Math.max(0, Math.round(exactFloat)));
      setActiveIndex((prev) => (prev !== nextIndex ? nextIndex : prev));

      // Verify if native CSS position: sticky is holding the stage in place;
      // if any host/iframe overflow blocks native sticky, apply exact JS pin offset so there is NEVER empty white space below.
      const stageRect = stage.getBoundingClientRect();
      const naturalTopWithoutFallback = stageRect.top - fallbackPinRef.current;
      const desiredOffset = Math.max(0, Math.min(totalScrollable, scrolled));

      if (scrolled > 2 && Math.abs(naturalTopWithoutFallback - rect.top) < 4) {
        fallbackPinRef.current = desiredOffset;
        setFallbackTranslateY(desiredOffset);
      } else if (fallbackPinRef.current !== 0) {
        fallbackPinRef.current = 0;
        setFallbackTranslateY(0);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('scroll', handleScroll, { capture: true } as EventListenerOptions);
      window.removeEventListener('resize', handleScroll);
    };
  }, [orderedSignatureProducts.length, prefersReducedMotion]);

  // Coordinate Text/Notes Transition & Single Controlled Spray Burst on Active Flavour Change
  useEffect(() => {
    const current = orderedSignatureProducts[activeIndex];
    if (!current) return;

    const direction = activeIndex >= prevIndexRef.current ? 1 : -1;
    prevIndexRef.current = activeIndex;

    if (!prefersReducedMotion) {
      if (infoStageRef.current) {
        gsap.fromTo(
          infoStageRef.current,
          { opacity: 0.25, y: direction * 16 },
          { opacity: 1, y: 0, duration: 0.42, ease: 'power2.out', overwrite: true }
        );
      }
      if (notesStageRef.current) {
        gsap.fromTo(
          notesStageRef.current,
          { opacity: 0.25, y: direction * 16 },
          { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out', overwrite: true }
        );
      }

      // Trigger a single controlled fragrance-specific mist burst when entering the scene
      triggerSceneMistBurst(current.sprayPalette);
    }
  }, [activeIndex, orderedSignatureProducts, prefersReducedMotion, triggerSceneMistBurst]);

  const currentItem = orderedSignatureProducts[activeIndex] || orderedSignatureProducts[0];
  const currentPalette = currentItem.sprayPalette;
  const nextTransitionItem =
    orderedSignatureProducts[Math.min(orderedSignatureProducts.length - 1, activeIndex + 1)];

  const handleExploreFragrance = (slug: string) => {
    setSelectedProductSlug(slug);
    setCurrentView('product');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectFragranceStep = (index: number) => {
    setActiveIndex(index);
    setContinuousIndex(index);
    if (!containerRef.current || !stickyStageRef.current || prefersReducedMotion) return;
    const rect = containerRef.current.getBoundingClientRect();
    const headerOffset = window.innerWidth >= 640 ? 80 : 64;
    const containerTop = window.scrollY + rect.top - headerOffset;
    const stageHeight = stickyStageRef.current.offsetHeight || window.innerHeight - headerOffset;
    const totalScrollable = Math.max(1, rect.height - stageHeight);
    const count = orderedSignatureProducts.length;
    const targetScroll = containerTop + (index / Math.max(1, count - 1)) * totalScrollable;
    window.scrollTo({ top: targetScroll, behavior: 'smooth' });
  };

  // ============================================================================
  // REDUCED MOTION MODE: Normal Document Flow Grid of All 9 Signature Creations
  // ============================================================================
  if (prefersReducedMotion) {
    return (
      <section
        id="fragrance-journey-container"
        className="relative py-14 px-4 sm:px-6 lg:px-8 bg-[#FAF8F4] text-[#24211D] border-b border-[#DED7CC]"
      >
        <div className="max-w-7xl mx-auto">
          <header className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-[11px] font-mono uppercase tracking-[0.26em] text-[#9A783E] block mb-2">
              01 — 09 Olfactory Collection
            </span>
            <h2 className="font-serif text-2xl sm:text-4xl text-[#24211D] tracking-[0.12em] uppercase">
              THE SIGNATURE COLLECTION
            </h2>
            <p className="text-xs sm:text-sm text-[#686158] mt-2">
              Nine approved Eau de Parfum creations · 30 ml ₹699 · 50 ml ₹999
            </p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {orderedSignatureProducts.map((item) => (
              <article
                key={item.slug}
                className="rounded-2xl bg-[#FFFFFF] border border-[#DED7CC] p-6 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-[11px] font-mono text-[#9A783E] mb-3">
                    <span>{item.indexNumber} / 09</span>
                    <span>{item.sprayPalette.name}</span>
                  </div>
                  <div className="h-52 flex items-center justify-center my-2">
                    <FragmoreBottleVisual
                      slug={item.slug}
                      productName={item.name}
                      productTagline={item.tagline}
                      collection="Signature Collection"
                      size="50 ml"
                      className="w-36 h-48"
                      showGlow={false}
                      showShadow={true}
                    />
                  </div>
                  <h3 className="font-serif text-xl uppercase tracking-[0.12em] text-[#24211D] mt-2">
                    {item.name}
                  </h3>
                  <p className="text-xs text-[#686158] italic mb-4">{item.tagline}</p>

                  <div className="space-y-2 text-xs border-t border-[#DED7CC] pt-3 mb-4">
                    <div>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-[#686158] block">
                        Top Notes
                      </span>
                      <span className="text-[#24211D]">{item.notes.top.join(', ')}</span>
                    </div>
                    <div>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-[#686158] block">
                        Heart Notes
                      </span>
                      <span className="text-[#24211D]">{item.notes.heart.join(', ')}</span>
                    </div>
                    <div>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-[#686158] block">
                        Base Notes
                      </span>
                      <span className="text-[#24211D]">{item.notes.base.join(', ')}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-[#DED7CC]">
                  <button
                    type="button"
                    onClick={() => handleExploreFragrance(item.slug)}
                    className="flex-1 py-2.5 px-4 rounded-full bg-[#24211D] text-[#FAF8F4] text-xs font-semibold uppercase tracking-wider cursor-pointer"
                  >
                    Explore
                  </button>
                  {item.product && item.variants[0] && (
                    <button
                      type="button"
                      onClick={() => addToCart(item.product!, item.variants[0].size, 1)}
                      className="py-2.5 px-4 rounded-full border border-[#DED7CC] text-xs font-mono text-[#24211D] hover:border-[#9A783E] cursor-pointer"
                    >
                      + ₹{item.variants[0].sellingPrice}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // ============================================================================
  // SCROLL-SYNCHRONIZED SIGNATURE COLLECTION STAGE (All Viewports · Zero Dead Gap)
  // ============================================================================
  return (
    <section
      id="fragrance-journey-container"
      ref={containerRef}
      aria-label="Signature Collection Scroll Progression"
      className="relative h-[280vh] bg-[#FAF8F4] text-[#24211D] border-b border-[#DED7CC] select-none"
    >
      {/* Single Pinned Studio Stage (Native sticky + JS fallback guarantees zero empty white space below) */}
      <div
        ref={stickyStageRef}
        style={
          fallbackTranslateY > 0
            ? { transform: `translate3d(0, ${fallbackTranslateY}px, 0)` }
            : undefined
        }
        className="sticky top-16 sm:top-20 h-[calc(100vh-4rem)] sm:h-[calc(100vh-5rem)] w-full overflow-hidden flex flex-col justify-between bg-[#FAF8F4]"
      >
        {/* Studio Lighting & Restrained Fragrance-Specific Scent Accent Glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] rounded-full transition-all duration-500"
            style={{
              background: `radial-gradient(circle, ${currentPalette.primaryHex}24 0%, ${currentPalette.secondaryHex}10 48%, transparent 74%)`
            }}
          />
          <div
            className="absolute inset-x-0 bottom-0 h-[26%]"
            style={{
              background:
                'linear-gradient(180deg, transparent 0%, rgba(241, 237, 229, 0.72) 55%, #F1EDE5 100%)'
            }}
          />
        </div>

        {/* TOP BAR: Collection Header + Live Scroll Transition Indicator */}
        <div className="relative z-20 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-3 sm:pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#DED7CC]">
            <div className="flex items-center gap-2.5">
              <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-[0.24em] text-[#9A783E] font-semibold">
                SIGNATURE COLLECTION · {currentItem.indexNumber} / 09
              </span>
              <span className="hidden sm:inline text-[#DED7CC]">|</span>
              <span className="hidden sm:inline text-xs text-[#686158] tracking-[0.14em] uppercase">
                Scroll to transition flavours ({currentItem.name}
                {activeIndex < orderedSignatureProducts.length - 1 && nextTransitionItem
                  ? ` → ${nextTransitionItem.name}`
                  : ''}
                )
              </span>
            </div>

            {/* Artistic Scent Visualization Indicator */}
            <div className="flex items-center gap-2 text-[11px] font-mono text-[#686158]">
              <span
                className="w-2.5 h-2.5 rounded-full transition-colors duration-300"
                style={{ backgroundColor: currentPalette.primaryHex }}
              />
              <span>Scent Aura: {currentPalette.name}</span>
            </div>
          </div>
        </div>

        {/* CENTER STUDIO STAGE: Left Flavour Details | Center Scroll-Linked Bottle Transition | Right Ingredient Pyramid */}
        <div className="relative z-10 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 my-auto grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-8 items-center">
          {/* LEFT COLUMN (4 cols on desktop): Fragrance Number, Name, Tagline, Pricing & CTAs */}
          <div ref={infoStageRef} className="lg:col-span-4 space-y-2.5 sm:space-y-3.5 text-center lg:text-left order-2 lg:order-1">
            <div className="inline-flex items-center gap-2">
              <span
                className="font-mono text-[11px] sm:text-xs uppercase tracking-[0.24em] font-semibold"
                style={{ color: currentPalette.primaryHex }}
              >
                FLAVOUR {currentItem.indexNumber} / 09
              </span>
              <span className="text-[#686158] text-xs">·</span>
              <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-[0.2em] text-[#686158]">
                Eau de Parfum
              </span>
            </div>

            <h2 className="font-serif text-2xl sm:text-3xl lg:text-5xl text-[#24211D] tracking-[0.12em] uppercase leading-tight font-normal">
              {currentItem.name}
            </h2>

            <p className="font-serif text-base sm:text-lg lg:text-xl text-[#9A783E] italic">
              “{currentItem.tagline}”
            </p>

            <p className="hidden sm:block text-xs lg:text-sm text-[#686158] leading-relaxed line-clamp-2 lg:line-clamp-3">
              {currentItem.description}
            </p>

            {/* Approved Variants & Prices */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 pt-0.5">
              {currentItem.variants.map((v) => (
                <div
                  key={v.id}
                  className="px-3 py-1.5 rounded-xl bg-[#FFFFFF] border border-[#DED7CC] flex items-center gap-2 shadow-2xs"
                >
                  <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-[#686158]">
                    {v.size}
                  </span>
                  <span className="font-serif text-xs sm:text-sm font-semibold text-[#24211D]">
                    ₹{v.sellingPrice.toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>

            {/* Primary & Secondary Product CTAs */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => handleExploreFragrance(currentItem.slug)}
                className="min-h-[40px] sm:min-h-[44px] inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-semibold uppercase tracking-[0.18em] transition-all cursor-pointer shadow-sm"
              >
                <span>Explore {currentItem.name}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              {currentItem.product && currentItem.variants[0] && (
                <button
                  type="button"
                  onClick={() => addToCart(currentItem.product!, currentItem.variants[0].size, 1)}
                  className="min-h-[40px] sm:min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#FFFFFF] hover:bg-[#F1EDE5] border border-[#DED7CC] hover:border-[#9A783E] text-[#24211D] text-xs font-medium uppercase tracking-[0.14em] transition-all cursor-pointer"
                >
                  <ShoppingBag className="w-3.5 h-3.5 text-[#9A783E]" />
                  <span>
                    Add {currentItem.variants[0].size} · ₹{currentItem.variants[0].sellingPrice}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* CENTER COLUMN (4 cols on desktop): Continuous Scroll-Linked Multi-Bottle Flavour Transition Stage */}
          <div className="lg:col-span-4 flex flex-col items-center justify-center relative order-1 lg:order-2">
            <div className="relative w-full max-w-[380px] h-[230px] sm:h-[310px] lg:h-[360px] flex items-center justify-center overflow-visible">
              {/* High-DPI Fragrance-Specific Mist Backdrop Layered Behind the Bottle (z-0 / z-10) */}
              <div
                aria-hidden="true"
                className="absolute inset-4 rounded-full pointer-events-none z-0 transition-all duration-500"
                style={{
                  background: `radial-gradient(circle at 50% 50%, ${currentPalette.primaryHex}33 0%, ${currentPalette.secondaryHex}1A 48%, transparent 72%)`,
                  filter: 'blur(16px)'
                }}
              />
              <canvas
                ref={sprayCanvasRef}
                aria-hidden="true"
                className="absolute inset-0 w-full h-full pointer-events-none z-10"
              />

              {/* Continuous Scroll-Driven Bottle Progression (Shows previous, current, and next flavour transitioning with scroll) */}
              {orderedSignatureProducts.map((item, idx) => {
                const offset = idx - continuousIndex;
                if (Math.abs(offset) > 1.45) return null;

                const absOffset = Math.abs(offset);
                const translateX = offset * 135;
                const translateY = absOffset * 14;
                const scale = Math.max(0.68, 1 - absOffset * 0.26);
                const opacity = Math.max(0, 1 - absOffset * 0.68);
                const zIndex = Math.round(25 - absOffset * 10);

                return (
                  <div
                    key={item.slug}
                    onClick={() => handleSelectFragranceStep(idx)}
                    style={{
                      transform: `translate3d(${translateX.toFixed(1)}px, ${translateY.toFixed(
                        1
                      )}px, 0) scale(${scale.toFixed(3)})`,
                      opacity: Number(opacity.toFixed(3)),
                      zIndex
                    }}
                    className="absolute flex flex-col items-center justify-center cursor-pointer will-change-transform"
                  >
                    <FragmoreBottleVisual
                      slug={item.slug}
                      productName={item.name}
                      productTagline={item.tagline}
                      collection="Signature Collection"
                      size="50 ml"
                      className="w-40 h-56 sm:w-48 sm:h-64 lg:w-52 lg:h-72"
                      showGlow={false}
                      showShadow={absOffset < 0.5}
                    />
                  </div>
                );
              })}

              {/* Studio Pedestal Surface Under Active Flacon */}
              <div
                aria-hidden="true"
                className="absolute bottom-1 left-1/2 -translate-x-1/2 w-52 h-6 rounded-[50%] border border-[#DED7CC] pointer-events-none z-10"
                style={{
                  background: 'linear-gradient(180deg, #FFFFFF 0%, #F1EDE5 100%)',
                  boxShadow: '0 10px 24px rgba(36, 33, 29, 0.08)'
                }}
              />
            </div>

            {/* Replay Fragrance Mist Button */}
            <button
              type="button"
              onClick={() => triggerSceneMistBurst(currentPalette)}
              className="mt-1 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#FFFFFF] border border-[#DED7CC] hover:border-[#9A783E] text-[10px] sm:text-[11px] font-mono uppercase tracking-[0.16em] text-[#686158] hover:text-[#24211D] transition-all cursor-pointer z-30"
              aria-label={`Spray ${currentItem.name} scent mist`}
            >
              <Wind
                className={`w-3.5 h-3.5 ${isSprayingMist ? 'animate-pulse' : ''}`}
                style={{ color: currentPalette.primaryHex }}
              />
              <span>{isSprayingMist ? `${currentPalette.name} Mist...` : 'Experience Scent Mist'}</span>
            </button>
          </div>

          {/* RIGHT COLUMN (4 cols on desktop): Structured Olfactory Pyramid with Vibrant Ingredient Photography */}
          <div
            ref={notesStageRef}
            className="hidden lg:block lg:col-span-4 rounded-2xl bg-[#FFFFFF] border border-[#DED7CC] p-4 space-y-3 shadow-[0_8px_24px_rgba(36,33,29,0.05)] order-3"
          >
            <div className="flex items-center justify-between border-b border-[#DED7CC] pb-2">
              <span className="text-[11px] font-mono uppercase tracking-[0.22em] text-[#24211D] font-semibold">
                Olfactory Architecture
              </span>
              <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-[#9A783E]">
                {currentItem.name}
              </span>
            </div>

            {/* TOP NOTES */}
            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-[#686158] mb-1.5 flex items-center justify-between">
                <span>TOP NOTES</span>
                <span className="text-[9px] opacity-75">First Impression</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {currentItem.resolvedNotes.top.map((note) => (
                  <NoteTile
                    key={`desk-top-${currentItem.slug}-${note.rawName}`}
                    note={note}
                    accentHex={currentPalette.primaryHex}
                    compact
                  />
                ))}
              </div>
            </div>

            {/* HEART NOTES */}
            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-[#686158] mb-1.5 flex items-center justify-between">
                <span>HEART NOTES</span>
                <span className="text-[9px] opacity-75">Core Signature</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {currentItem.resolvedNotes.heart.map((note) => (
                  <NoteTile
                    key={`desk-heart-${currentItem.slug}-${note.rawName}`}
                    note={note}
                    accentHex={currentPalette.primaryHex}
                    compact
                  />
                ))}
              </div>
            </div>

            {/* BASE NOTES */}
            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-[#686158] mb-1.5 flex items-center justify-between">
                <span>BASE NOTES</span>
                <span className="text-[9px] opacity-75">Lasting Trail</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {currentItem.resolvedNotes.base.map((note) => (
                  <NoteTile
                    key={`desk-base-${currentItem.slug}-${note.rawName}`}
                    note={note}
                    accentHex={currentPalette.primaryHex}
                    compact
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM NAVIGATION RAIL: 01–09 Synchronized Flavour Selector */}
        <div className="relative z-20 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pb-3 sm:pb-4">
          <div className="grid grid-cols-3 sm:grid-cols-9 gap-1.5 pt-2.5 border-t border-[#DED7CC]">
            {orderedSignatureProducts.map((item, idx) => {
              const isCurrent = idx === activeIndex;
              return (
                <button
                  key={item.slug}
                  type="button"
                  onClick={() => handleSelectFragranceStep(idx)}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`group text-left p-1.5 sm:p-2 rounded-xl border transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-[#FFFFFF] border-[#9A783E] shadow-2xs'
                      : 'bg-transparent border-transparent hover:bg-[#FFFFFF]/70 hover:border-[#DED7CC] opacity-70 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span
                      className={`text-[9px] sm:text-[10px] font-mono font-bold ${
                        isCurrent ? 'text-[#24211D]' : 'text-[#686158]'
                      }`}
                    >
                      {item.indexNumber}
                    </span>
                    <span
                      className="w-2 h-2 rounded-full transition-transform group-hover:scale-125"
                      style={{ backgroundColor: item.sprayPalette.primaryHex }}
                    />
                  </div>
                  <div
                    className={`text-[9px] sm:text-[10px] uppercase tracking-wider truncate ${
                      isCurrent ? 'text-[#24211D] font-semibold' : 'text-[#686158]'
                    }`}
                  >
                    {item.name}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
