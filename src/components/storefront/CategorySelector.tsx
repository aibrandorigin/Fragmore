import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useStore } from '../../context/StoreContext';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import { FragmoreBottleVisual } from './FragmoreBottleVisual';

interface CatalogueBottleItem {
  slug: string;
  name: string;
  tagline: string;
  size: string;
  collection: string;
}

interface CatalogueCardConfig {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  isAura?: boolean;
  bottles: CatalogueBottleItem[];
}

export const CategorySelector: React.FC = () => {
  const { products, setSelectedCategoryFilter, setCurrentView } = useStore();
  const sectionRef = useRef<HTMLElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

  const publishedProducts = products.filter(
    (p) => p.status !== 'ARCHIVED' && p.status !== 'INACTIVE' && p.gender !== 'discovery'
  );
  const signatureCount =
    publishedProducts.filter((p) => p.collection === 'Signature Collection').length || 9;
  const auraCount =
    publishedProducts.filter((p) => p.collection === 'Aura Collection').length || 3;

  const collections: CatalogueCardConfig[] = [
    {
      id: 'Signature Collection',
      title: 'SIGNATURE COLLECTION',
      subtitle: `${signatureCount} Approved Creations · 30 ml ₹699 · 50 ml ₹999`,
      description:
        'Golden Hour, Blush & Blossom, Violet Noir, Aqua Pulse, Luxe Heritage, Flora Crush, Midnight Glow, Silky Velvet and Night Bloom.',
      badge: '01 – 09 · SIGNATURE',
      bottles: [
        {
          slug: 'violet-noir',
          name: 'VIOLET NOIR',
          tagline: 'Bold. Mysterious. Magnetic.',
          size: '50 ml',
          collection: 'Signature Collection',
        },
        {
          slug: 'golden-hour',
          name: 'GOLDEN HOUR',
          tagline: 'Golden. Warm. Unforgettable.',
          size: '50 ml',
          collection: 'Signature Collection',
        },
        {
          slug: 'aqua-pulse',
          name: 'AQUA PULSE',
          tagline: 'Fresh. Energetic. Modern.',
          size: '50 ml',
          collection: 'Signature Collection',
        },
      ],
    },
    {
      id: 'Aura Collection',
      title: 'AURA COLLECTION',
      subtitle: `${auraCount} Sacred Creations · 15 ml · ₹249 Each`,
      description:
        'Scents for a higher you. Moksha Essence, Temple Flora and Divine Aura — soulful fragrances inspired by tradition and devotion.',
      badge: '15 ML · ₹249 EACH',
      isAura: true,
      bottles: [
        {
          slug: 'temple-flora',
          name: 'TEMPLE FLORA',
          tagline: 'Divine. Floral. Uplifting.',
          size: '15 ml',
          collection: 'Aura Collection',
        },
        {
          slug: 'moksha-essence',
          name: 'MOKSHA ESSENCE',
          tagline: 'Calm. Pure. Centered.',
          size: '15 ml',
          collection: 'Aura Collection',
        },
        {
          slug: 'divine-aura',
          name: 'DIVINE AURA',
          tagline: 'Sacred. Soothing. Eternal.',
          size: '15 ml',
          collection: 'Aura Collection',
        },
      ],
    },
    {
      id: 'women',
      title: 'FEMININE & FLORAL',
      subtitle: 'Blush & Blossom · Flora Crush · Silky Velvet · Night Bloom',
      description:
        'Sparkling rose, airy gardenia, timeless powdery aldehydes, and blush peony crafted for luminous everyday and evening wear.',
      badge: 'FOR HER',
      bottles: [
        {
          slug: 'flora-crush',
          name: 'FLORA CRUSH',
          tagline: 'Playful. Romantic. Addictive.',
          size: '50 ml',
          collection: 'Signature Collection',
        },
        {
          slug: 'blush-and-blossom',
          name: 'BLUSH & BLOSSOM',
          tagline: 'Chic. Sparkling. Feminine.',
          size: '50 ml',
          collection: 'Signature Collection',
        },
        {
          slug: 'night-bloom',
          name: 'NIGHT BLOOM',
          tagline: 'Sensual. Playful. Unforgettable.',
          size: '50 ml',
          collection: 'Signature Collection',
        },
      ],
    },
    {
      id: 'unisex',
      title: 'UNISEX & MODERN',
      subtitle: 'Golden Hour · Violet Noir · Aqua Pulse · Luxe Heritage · Midnight Glow',
      description:
        'Warm amber sunset, magnetic leather, crisp grapefruit with smoky incense, saffron woods, and dark rose blackcurrant.',
      badge: 'UNISEX & FOR HIM',
      bottles: [
        {
          slug: 'violet-noir',
          name: 'VIOLET NOIR',
          tagline: 'Bold. Mysterious. Magnetic.',
          size: '50 ml',
          collection: 'Signature Collection',
        },
        {
          slug: 'luxe-heritage',
          name: 'LUXE HERITAGE',
          tagline: 'Rich. Intense. Timeless.',
          size: '50 ml',
          collection: 'Signature Collection',
        },
        {
          slug: 'aqua-pulse',
          name: 'AQUA PULSE',
          tagline: 'Fresh. Energetic. Modern.',
          size: '50 ml',
          collection: 'Signature Collection',
        },
      ],
    },
  ];

  useEffect(() => {
    const mqMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mqMotion.matches) return;
    const cards = cardsRef.current.filter(Boolean) as HTMLDivElement[];
    if (cards.length === 0) return;

    gsap.set(cards, { opacity: 0, y: 48, scale: 0.96 });
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
              duration: 0.9,
              stagger: 0.11,
              ease: 'power3.out',
            });
          }
        });
      },
      { threshold: 0.15 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const handleSelect = (catId: string) => {
    setSelectedCategoryFilter(catId);
    setCurrentView('shop');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <section
      ref={sectionRef}
      className="py-20 px-4 sm:px-6 lg:px-8 bg-[#FAF8F4] text-[#24211D] border-b border-[#DED7CC]"
    >
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12">
          <div>
            <span className="text-xs font-mono uppercase tracking-[0.3em] text-[#9A783E] block mb-2.5">
              Olfactory Wardrobe
            </span>
            <h2 className="font-serif text-3xl sm:text-5xl text-[#24211D] tracking-[0.1em] uppercase">
              EXPLORE THE CATALOGUE
            </h2>
          </div>
          <div className="mt-4 md:mt-0 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => handleSelect('all')}
              className="px-6 py-3 rounded-full bg-[#FFFFFF] border border-[#DED7CC] text-xs uppercase tracking-[0.2em] text-[#24211D] hover:border-[#9A783E] hover:text-[#9A783E] transition-colors cursor-pointer shadow-2xs"
            >
              View All {publishedProducts.length} Published Fragrances
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {collections.map((cat, idx) => (
            <div
              key={cat.id}
              ref={(el) => {
                cardsRef.current[idx] = el;
              }}
              onClick={() => handleSelect(cat.id)}
              className="group relative rounded-2xl p-6 bg-[#FFFFFF] border border-[#DED7CC] hover:border-[#9A783E] transition-all duration-500 cursor-pointer flex flex-col justify-between min-h-[420px] overflow-hidden shadow-[0_8px_24px_rgba(36,33,29,0.05)] hover:shadow-[0_16px_36px_rgba(36,33,29,0.1)] hover:-translate-y-2 will-change-transform"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#9A783E] flex items-center gap-1.5 font-semibold">
                    {cat.isAura && <Sparkles className="w-3 h-3 text-[#9A783E]" />}
                    <span>{cat.badge}</span>
                  </span>
                  <div className="w-8 h-8 rounded-full bg-[#F1EDE5] border border-[#DED7CC] flex items-center justify-center text-[#24211D] group-hover:bg-[#24211D] group-hover:text-[#FAF8F4] transition-colors">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>

                {/* Respective Studio Bottles Showcase */}
                <div className="relative h-48 rounded-xl bg-gradient-to-b from-[#FCF9F4] via-[#F6F0E6] to-[#EDE4D5] border border-[#DED7CC]/80 flex items-end justify-center mb-4 px-2 pt-3 pb-2 overflow-hidden">
                  <div className="relative w-full h-full flex items-end justify-center">
                    {cat.bottles.map((bottle, bIdx) => {
                      const isCenter = bIdx === 1;
                      const positionClass =
                        bIdx === 0
                          ? '-mr-5 sm:-mr-6 z-10 opacity-90 scale-[0.86] -rotate-3 group-hover:-translate-x-1.5 group-hover:-translate-y-1'
                          : bIdx === 2
                          ? '-ml-5 sm:-ml-6 z-10 opacity-90 scale-[0.86] rotate-3 group-hover:translate-x-1.5 group-hover:-translate-y-1'
                          : 'z-20 scale-100 group-hover:-translate-y-2 group-hover:scale-[1.06]';

                      return (
                        <div
                          key={`${cat.id}-${bottle.slug}-${bIdx}`}
                          className={`relative flex items-center justify-center transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${positionClass}`}
                        >
                          <FragmoreBottleVisual
                            slug={bottle.slug}
                            productName={bottle.name}
                            productTagline={bottle.tagline}
                            collection={bottle.collection}
                            size={bottle.size}
                            className={isCenter ? 'w-28 h-40' : 'w-24 h-36'}
                            showGlow={false}
                            showShadow={isCenter}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                <p className="text-[11px] uppercase tracking-[0.16em] text-[#9A783E] mb-1.5 font-medium">
                  {cat.subtitle}
                </p>
                <h3 className="font-serif text-xl text-[#24211D] tracking-[0.1em] uppercase mb-2">
                  {cat.title}
                </h3>
              </div>

              <div className="pt-4 border-t border-[#DED7CC]">
                <p className="text-xs text-[#686158] leading-relaxed mb-3 line-clamp-3">
                  {cat.description}
                </p>
                <span className="inline-flex items-center text-[11px] uppercase tracking-[0.22em] text-[#24211D] group-hover:text-[#9A783E] transition-colors font-semibold">
                  Explore Selection →
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
