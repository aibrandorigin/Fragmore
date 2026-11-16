import React, { useMemo, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useStore } from '../../context/StoreContext';
import { Sparkles, ShoppingBag, ArrowRight } from 'lucide-react';
import { FragmoreBottleVisual } from './FragmoreBottleVisual';

const APPROVED_AURA_SLUGS = ['moksha-essence', 'temple-flora', 'divine-aura'];

export const DevotionalCollection: React.FC = () => {
  const { products, setSelectedProductSlug, setCurrentView, setSelectedCategoryFilter, addToCart } = useStore();
  const sectionRef = useRef<HTMLElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

  const auraProducts = useMemo(() => {
    const activeAura = products.filter(
      (p) =>
        p.status !== 'ARCHIVED' &&
        p.status !== 'INACTIVE' &&
        (p.collection === 'Aura Collection' || APPROVED_AURA_SLUGS.includes(p.slug))
    );
    return APPROVED_AURA_SLUGS.map((slug) => activeAura.find((p) => p.slug === slug)).filter(
      Boolean
    ) as typeof products;
  }, [products]);

  useEffect(() => {
    const mqMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mqMotion.matches) return;
    const cards = cardsRef.current.filter(Boolean) as HTMLDivElement[];
    if (cards.length === 0) return;

    gsap.set(cards, { opacity: 0, y: 52, scale: 0.95 });
    let hasAnimated = false;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated) {
            hasAnimated = true;
            gsap.to(cards, {
              opacity: 1,
              y: 0,
              scale: 1,
              duration: 0.95,
              stagger: 0.14,
              ease: 'power3.out'
            });
          }
        });
      },
      { threshold: 0.15 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, [auraProducts.length]);

  const handleOpenProduct = (slug: string) => {
    setSelectedProductSlug(slug);
    setCurrentView('product');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <section
      ref={sectionRef}
      id="aura-collection-section"
      className="py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden bg-[#F1EDE5] text-[#24211D] border-b border-[#DED7CC]"
    >
      <div className="max-w-7xl mx-auto relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 mb-3 text-xs font-mono uppercase tracking-[0.28em] text-[#9A783E] font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-[#9A783E]" />
            <span>15 ml · ₹249 each</span>
          </div>

          <h2 className="font-serif text-3xl sm:text-5xl text-[#24211D] tracking-[0.14em] uppercase mb-3 leading-tight">
            AURA COLLECTION
          </h2>

          <p className="font-serif text-xl sm:text-2xl text-[#9A783E] italic mb-4">
            Scents for a higher you.
          </p>

          <p className="text-[#686158] text-sm sm:text-base leading-relaxed max-w-2xl mx-auto">
            A range of soulful fragrances inspired by tradition and devotion, crafted to bring calm, clarity and divine energy into your everyday life.
          </p>
        </div>

        {/* 3 Aura Fragrances Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {auraProducts.map((product, index) => {
            const variant15ml =
              product.variants.find((v) => v.size.toLowerCase() === '15 ml') ||
              product.variants[0];
            const sellingPrice = variant15ml ? variant15ml.sellingPrice : 249;
            const codeLabel = `A${index + 1}`;

            return (
              <div
                key={product.id}
                ref={(el) => {
                  cardsRef.current[index] = el;
                }}
                className="group relative rounded-2xl overflow-hidden bg-[#FFFFFF] border border-[#DED7CC] hover:border-[#9A783E] transition-all duration-500 flex flex-col justify-between p-7 sm:p-8 shadow-[0_10px_30px_rgba(36,33,29,0.06)] hover:-translate-y-2 will-change-transform"
              >
                <div>
                  {/* Top Index & Approved 15 ml Price */}
                  <div className="flex items-center justify-between mb-5 text-[11px] font-mono uppercase tracking-[0.22em]">
                    <span className="text-[#9A783E] font-semibold">
                      {codeLabel} · AURA COLLECTION
                    </span>
                    <span className="text-[#24211D] font-semibold">
                      15 ml · ₹{sellingPrice}
                    </span>
                  </div>

                  {/* Visual Container */}
                  <div
                    onClick={() => handleOpenProduct(product.slug)}
                    className="relative h-64 rounded-xl mb-6 flex flex-col items-center justify-center overflow-hidden border border-[#DED7CC] bg-[#FAF8F4] cursor-pointer"
                  >
                    <div className="w-full h-56 flex items-center justify-center transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-2 group-hover:scale-105">
                      <FragmoreBottleVisual
                        slug={product.slug}
                        size="15 ml"
                        variant={variant15ml}
                        productName={product.name}
                        productTagline={product.subtitle}
                        collection="Aura Collection"
                        className="w-full h-56"
                        interactive
                        showGlow={false}
                        showShadow={true}
                      />
                    </div>
                  </div>

                  {/* Fragrance Name & Tagline */}
                  <div className="mb-4">
                    <h3
                      onClick={() => handleOpenProduct(product.slug)}
                      className="font-serif text-2xl text-[#24211D] tracking-[0.12em] uppercase mb-1 cursor-pointer group-hover:text-[#9A783E] transition-colors"
                    >
                      {product.name}
                    </h3>
                    <p className="text-xs uppercase tracking-[0.18em] text-[#9A783E] font-medium">
                      {product.subtitle || product.scentProfile}
                    </p>
                  </div>

                  {/* Exact Supplied Notes */}
                  <div className="space-y-2.5 pt-4 border-t border-[#DED7CC] mb-6 text-xs">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#686158] block mb-0.5">
                        Top Notes
                      </span>
                      <span className="text-[#24211D] font-medium">{product.notes.top.join(', ')}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#686158] block mb-0.5">
                        Heart Notes
                      </span>
                      <span className="text-[#24211D] font-medium">{product.notes.heart.join(', ')}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#686158] block mb-0.5">
                        Base Notes
                      </span>
                      <span className="text-[#24211D] font-medium">{product.notes.base.join(', ')}</span>
                    </div>
                  </div>
                </div>

                {/* Price & Actions */}
                <div className="pt-5 border-t border-[#DED7CC] flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] text-[#686158] font-mono uppercase tracking-[0.2em] block">
                      15 ml Bottle
                    </span>
                    <div className="flex items-baseline space-x-2">
                      <span className="font-serif text-2xl text-[#24211D] font-semibold">
                        ₹{sellingPrice.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => handleOpenProduct(product.slug)}
                      className="px-3.5 py-2.5 rounded-lg border border-[#DED7CC] text-[#24211D] hover:border-[#9A783E] text-xs uppercase tracking-wider transition-colors cursor-pointer"
                    >
                      Details
                    </button>
                    <button
                      type="button"
                      onClick={() => addToCart(product, '15 ml', 1)}
                      className="px-4 py-2.5 rounded-lg bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] font-semibold text-xs uppercase tracking-wider flex items-center space-x-1.5 transition-all cursor-pointer"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>Add 15 ml</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Explore Full Aura Collection CTA */}
        <div className="mt-12 text-center">
          <button
            type="button"
            onClick={() => {
              setSelectedCategoryFilter('Aura Collection');
              setCurrentView('shop');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="inline-flex items-center space-x-3 px-7 py-3.5 rounded-full border border-[#DED7CC] bg-[#FFFFFF] hover:border-[#9A783E] text-[#24211D] text-xs font-semibold uppercase tracking-[0.22em] transition-all cursor-pointer shadow-2xs"
          >
            <span>Shop Aura Collection · 15 ml · ₹249 Each</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#9A783E]" />
          </button>
        </div>
      </div>
    </section>
  );
};
