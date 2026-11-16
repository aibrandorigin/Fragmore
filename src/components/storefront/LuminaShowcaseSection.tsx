import React, { useEffect, useRef, useMemo, useState } from 'react';
import gsap from 'gsap';
import { useStore } from '../../context/StoreContext';
import { FragmoreBottleVisual } from './FragmoreBottleVisual';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const ALL_NINE_SIGNATURE_SLUGS = [
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

export const LuminaShowcaseSection: React.FC = () => {
  const {
    products,
    setSelectedProductSlug,
    setCurrentView,
    trackEvent
  } = useStore();

  const bottomStripRef = useRef<HTMLDivElement>(null);
  const marqueeTrackRef = useRef<HTMLDivElement>(null);
  const isPausedRef = useRef(false);
  const offsetPxRef = useRef(0);
  const singleSetWidthRef = useRef(0);
  const [isHovered, setIsHovered] = useState(false);

  const publishedProducts = useMemo(
    () => products.filter((p) => p.status !== 'ARCHIVED' && p.status !== 'INACTIVE'),
    [products]
  );

  // All 9 Signature Perfumes (01 to 09) for the Black Scrolling Section
  const allNineSignatureProducts = useMemo(() => {
    const matched = ALL_NINE_SIGNATURE_SLUGS.map((slug, index) => {
      const prod = publishedProducts.find((p) => p.slug === slug);
      if (!prod) return null;
      return {
        product: prod,
        indexLabel: String(index + 1).padStart(2, '0')
      };
    }).filter(Boolean) as { product: (typeof products)[number]; indexLabel: string }[];

    if (matched.length > 0) return matched;

    return publishedProducts
      .filter((p) => p.collection === 'Signature Collection')
      .slice(0, 9)
      .map((prod, idx) => ({
        product: prod,
        indexLabel: String(idx + 1).padStart(2, '0')
      }));
  }, [publishedProducts]);

  // Duplicate the 01-09 list so the horizontal scroll loops seamlessly from 09 back to 01
  const loopingNineItems = useMemo(
    () => [...allNineSignatureProducts, ...allNineSignatureProducts],
    [allNineSignatureProducts]
  );

  // Scroll-triggered reveal for the black gallery strip
  useEffect(() => {
    const mqMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mqMotion.matches) return;

    if (bottomStripRef.current) {
      gsap.set(bottomStripRef.current, { opacity: 0, y: 40 });
    }

    let bottomAnimated = false;

    const bottomObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !bottomAnimated && bottomStripRef.current) {
            bottomAnimated = true;
            gsap.to(bottomStripRef.current, {
              opacity: 1,
              y: 0,
              duration: 0.9,
              ease: 'power3.out'
            });
          }
        });
      },
      { threshold: 0.1 }
    );

    if (bottomStripRef.current) bottomObserver.observe(bottomStripRef.current);

    return () => {
      bottomObserver.disconnect();
    };
  }, []);

  // Continuous 60fps horizontal scrolling of all 01–09 perfumes inside the black strip
  useEffect(() => {
    const mqMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mqMotion.matches) return;

    const track = marqueeTrackRef.current;
    if (!track) return;

    const measureWidth = () => {
      if (!track) return;
      singleSetWidthRef.current = track.scrollWidth / 2;
    };

    measureWidth();
    window.addEventListener('resize', measureWidth, { passive: true });

    let rafId: number | null = null;
    let lastScrollY = window.scrollY || 0;
    let scrollBoost = 0;

    const handleWindowScroll = () => {
      const currentY = window.scrollY || 0;
      const delta = Math.abs(currentY - lastScrollY);
      lastScrollY = currentY;
      scrollBoost = Math.min(scrollBoost + delta * 0.06, 3.2);
    };

    window.addEventListener('scroll', handleWindowScroll, { passive: true });

    const tick = () => {
      const setWidth = singleSetWidthRef.current || track.scrollWidth / 2;
      if (setWidth > 0) {
        const baseSpeed = isPausedRef.current ? 0 : 0.85;
        scrollBoost *= 0.92;
        offsetPxRef.current += baseSpeed + (isPausedRef.current ? 0 : scrollBoost);

        if (offsetPxRef.current >= setWidth) {
          offsetPxRef.current -= setWidth;
        } else if (offsetPxRef.current < 0) {
          offsetPxRef.current += setWidth;
        }

        track.style.transform = `translate3d(${-offsetPxRef.current.toFixed(2)}px, 0, 0)`;
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', measureWidth);
      window.removeEventListener('scroll', handleWindowScroll);
    };
  }, [loopingNineItems.length]);

  const handleStepScroll = (direction: 'prev' | 'next') => {
    const track = marqueeTrackRef.current;
    if (!track) return;
    const setWidth = singleSetWidthRef.current || track.scrollWidth / 2;
    if (setWidth <= 0) return;

    const stepPx = 280;
    const target =
      direction === 'next'
        ? offsetPxRef.current + stepPx
        : offsetPxRef.current - stepPx;

    gsap.to(offsetPxRef, {
      current: target,
      duration: 0.65,
      ease: 'power3.out',
      onUpdate: () => {
        if (offsetPxRef.current >= setWidth) {
          offsetPxRef.current -= setWidth;
        } else if (offsetPxRef.current < 0) {
          offsetPxRef.current += setWidth;
        }
        if (marqueeTrackRef.current) {
          marqueeTrackRef.current.style.transform = `translate3d(${-offsetPxRef.current.toFixed(
            2
          )}px, 0, 0)`;
        }
      }
    });
  };

  const handleOpenProduct = (slug: string) => {
    trackEvent('ShowcaseProductClick', { slug });
    setSelectedProductSlug(slug);
    setCurrentView('product');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <section
      aria-label="FRAGMORÉ 01–09 Signature Scrolling Showcase"
      className="relative w-full overflow-hidden border-b border-[#DED7CC]"
    >
      {/* BLACK CONTRAST GALLERY WITH ALL 01–09 PERFUMES SCROLLING */}
      <div
        ref={bottomStripRef}
        onMouseEnter={() => {
          isPausedRef.current = true;
          setIsHovered(true);
        }}
        onMouseLeave={() => {
          isPausedRef.current = false;
          setIsHovered(false);
        }}
        className="lumina-dark-gallery-strip w-full py-12 sm:py-16 overflow-hidden relative select-none"
      >
        {/* Top Bar inside Black Section: 01–09 Index Label + Manual Scroll Controls */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 mb-7 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#D4AF37]">
              01 — 09 · SIGNATURE COLLECTION
            </span>
            <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-[0.2em] text-[#FAF8F4]/55">
              {isHovered ? 'Paused · Click any fragrance to explore' : 'Scrolling 01 to 09'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleStepScroll('prev')}
              aria-label="Scroll previous fragrance"
              className="w-9 h-9 rounded-full border border-white/20 hover:border-[#D4AF37] text-[#FAF8F4] hover:text-[#D4AF37] flex items-center justify-center transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleStepScroll('next')}
              aria-label="Scroll next fragrance"
              className="w-9 h-9 rounded-full border border-white/20 hover:border-[#D4AF37] text-[#FAF8F4] hover:text-[#D4AF37] flex items-center justify-center transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Continuous Horizontal Scrolling Track of All 9 Signature Perfumes (01 to 09) */}
        <div className="w-full overflow-hidden">
          <div
            ref={marqueeTrackRef}
            className="flex items-stretch gap-5 sm:gap-6 px-4 sm:px-6 w-max will-change-transform"
          >
            {loopingNineItems.map(({ product, indexLabel }, loopIdx) => {
              const defaultVariant =
                product.variants.find((v) => v.size === '50 ml' && v.isAvailable) ||
                product.variants.find((v) => v.isAvailable && v.sellingPrice > 0) ||
                product.variants[0];
              const sellingPrice = defaultVariant?.sellingPrice || 699;

              return (
                <div
                  key={`${product.id}-${loopIdx}`}
                  onClick={() => handleOpenProduct(product.slug)}
                  className="group relative w-[230px] sm:w-[256px] shrink-0 bg-[#FAF8F4] p-4 sm:p-5 flex flex-col items-center justify-between min-h-[300px] sm:min-h-[340px] cursor-pointer overflow-hidden transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-2.5"
                >
                  {/* Top Index 01 to 09 & Price */}
                  <div className="w-full flex items-center justify-between text-[11px] font-mono uppercase tracking-[0.2em] text-[#686158]">
                    <span className="font-semibold text-[#24211D]">{indexLabel}</span>
                    <span className="text-[#9A783E] font-semibold tabular-nums">
                      ₹{sellingPrice.toLocaleString('en-IN')}
                    </span>
                  </div>

                  {/* Centered Bottle Portrait inside White Frame */}
                  <div className="w-full h-48 sm:h-56 flex items-center justify-center my-2 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.07]">
                    <FragmoreBottleVisual
                      slug={product.slug}
                      size={defaultVariant?.size || '50 ml'}
                      variant={defaultVariant}
                      productName={product.name}
                      productTagline={product.subtitle}
                      collection={product.collection}
                      className="w-36 h-44 sm:w-40 sm:h-52"
                      interactive
                      showGlow={false}
                      showShadow={true}
                    />
                  </div>

                  {/* Bottom Fragrance Name & Tagline */}
                  <div className="w-full text-center pt-2.5 border-t border-[#DED7CC]/70">
                    <div className="font-serif text-xs sm:text-sm uppercase tracking-[0.16em] text-[#24211D] group-hover:text-[#9A783E] transition-colors truncate font-medium">
                      {product.name}
                    </div>
                    <div className="text-[10px] text-[#686158] truncate mt-0.5">
                      {product.subtitle || product.scentProfile}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
