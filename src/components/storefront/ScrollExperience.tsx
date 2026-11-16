import React, { useState, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { PerfumeBottle3D } from '../3d/PerfumeBottle3D';
import { ArrowRight, ChevronLeft, ChevronRight, ShoppingBag, Eye } from 'lucide-react';

interface SceneConfig {
  id: string;
  name: string;
  slug: string;
  subtitle: string;
  notesTitle: string[];
  description: string;
  bgGradient: string;
  bottleColor: string;
  ambientColor: string;
  atmosphereText: string;
  price: number;
}

const SCENES: SceneConfig[] = [
  {
    id: 'azure',
    name: 'AZURE',
    slug: 'azure',
    subtitle: 'Extrait de Parfum',
    notesTitle: ['FRESH', 'AROMATIC', 'WOODY'],
    description: 'Cool sea mist, crisp Italian bergamot and noble Atlas cedarwood. Clean blue reflections of twilight ocean waters.',
    bgGradient: 'from-[#03132B] via-[#081F3D] to-[#050C17]',
    bottleColor: '#E8C978',
    ambientColor: '#38BDF8',
    atmosphereText: 'Cool mist & oceanic minerals',
    price: 3899
  },
  {
    id: 'ignite',
    name: 'IGNITE',
    slug: 'ignite',
    subtitle: 'Extrait de Parfum',
    notesTitle: ['SPICY', 'LEATHER', 'WOODY'],
    description: 'Smoldering black cardamom, hand-tanned Italian leather and smoky dark oud rising like sparks into charcoal skies.',
    bgGradient: 'from-[#261005] via-[#1C0D08] to-[#0A0503]',
    bottleColor: '#E8C978',
    ambientColor: '#F97316',
    atmosphereText: 'Ember warmth & smoked leather',
    price: 3899
  },
  {
    id: 'roselle',
    name: 'ROSELLE',
    slug: 'roselle',
    subtitle: 'Eau de Parfum Nectar',
    notesTitle: ['FRUITY', 'FLORAL', 'SWEET'],
    description: 'Dewy centifolia rose absolute, wild frosted raspberries, and intoxicating Madagascan vanilla praline.',
    bgGradient: 'from-[#2D0B18] via-[#1F0711] to-[#0D0407]',
    bottleColor: '#E8C978',
    ambientColor: '#F472B6',
    atmosphereText: 'Centifolia petals & frosted lychee',
    price: 3899
  },
  {
    id: 'elan',
    name: 'ÉLAN',
    slug: 'elan',
    subtitle: 'Extrait de Parfum',
    notesTitle: ['AMBER', 'FLORAL', 'SPICY'],
    description: 'Luminous ribbons of royal Kashmiri saffron, midnight blooming jasmine, and molten liquid amber.',
    bgGradient: 'from-[#261E0A] via-[#1B1506] to-[#0C0903]',
    bottleColor: '#E8C978',
    ambientColor: '#FDE047',
    atmosphereText: 'Champagne ribbons & liquid amber',
    price: 3899
  },
  {
    id: 'suede',
    name: 'SUEDE',
    slug: 'suede',
    subtitle: 'Extrait de Parfum',
    notesTitle: ['LEATHER', 'AMBER', 'WOODY'],
    description: 'Tactile Tuscan glove suede, velvety Florentine orris, and golden incense drifting across aged sandalwood.',
    bgGradient: 'from-[#1E0F07] via-[#150A05] to-[#080402]',
    bottleColor: '#E8C978',
    ambientColor: '#D97706',
    atmosphereText: 'Bronze leather & warm shadows',
    price: 3899
  },
  {
    id: 'solara',
    name: 'SOLARA',
    slug: 'solara',
    subtitle: 'Eau de Parfum Lumineuse',
    notesTitle: ['CITRUS', 'MUSK', 'FRESH'],
    description: 'Zesty sun-drenched Calabrian citruses, fresh neroli blossoms, and an addictive cocoon of golden skin musk.',
    bgGradient: 'from-[#2C1405] via-[#1E0E04] to-[#0C0602]',
    bottleColor: '#E8C978',
    ambientColor: '#FDBA74',
    atmosphereText: 'Sunlight haze & golden musk',
    price: 3899
  }
];

export const ScrollExperience: React.FC = () => {
  const { setCurrentView, setSelectedProductSlug, products, addToCart, trackEvent } = useStore();
  const [activeIndex, setActiveIndex] = useState(0);
  const [showFinale, setShowFinale] = useState(false);

  const currentScene = SCENES[activeIndex];

  const handleNext = () => {
    if (activeIndex < SCENES.length - 1) {
      setActiveIndex(activeIndex + 1);
    } else {
      setShowFinale(true);
    }
  };

  const handlePrev = () => {
    if (showFinale) {
      setShowFinale(false);
    } else if (activeIndex > 0) {
      setActiveIndex(activeIndex - 1);
    }
  };

  const handleDiscover = (slug: string) => {
    trackEvent('ViewItem', { slug, location: 'scroll_story' });
    setSelectedProductSlug(slug);
    setCurrentView('pdp');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleQuickAdd = (slug: string) => {
    const prod = products.find((p) => p.slug === slug);
    if (prod) {
      addToCart(prod, '50 ml');
    }
  };

  return (
    <section
      id="fragrance-journey"
      className="relative w-full min-h-screen py-16 sm:py-24 overflow-hidden transition-colors duration-1000 ease-in-out border-t border-b border-white/5"
      style={{
        background: showFinale
          ? 'radial-gradient(ellipse at center, #161622 0%, #08080A 100%)'
          : undefined
      }}
    >
      {/* Dynamic Background Gradient */}
      {!showFinale && (
        <div
          className={`absolute inset-0 bg-gradient-to-b ${currentScene.bgGradient} opacity-90 transition-all duration-1000 pointer-events-none`}
        />
      )}

      {/* Atmospheric particle glow overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <div
          className="absolute w-96 h-96 rounded-full blur-[140px] top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-colors duration-1000"
          style={{ backgroundColor: showFinale ? '#D4AF37' : currentScene.ambientColor }}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Navigation Step Indicators */}
        <div className="flex items-center justify-between pb-8 border-b border-white/10 mb-8">
          <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto no-scrollbar">
            {SCENES.map((scene, idx) => (
              <button
                key={scene.id}
                onClick={() => {
                  setShowFinale(false);
                  setActiveIndex(idx);
                }}
                className={`py-1.5 px-3 text-[11px] font-mono tracking-widest uppercase transition-all duration-300 border-b-2 whitespace-nowrap ${
                  !showFinale && activeIndex === idx
                    ? 'border-[#D4AF37] text-[#D4AF37] font-semibold'
                    : 'border-transparent text-white/40 hover:text-white/80'
                }`}
              >
                0{idx + 1} {scene.name}
              </button>
            ))}
            <button
              onClick={() => setShowFinale(true)}
              className={`py-1.5 px-3 text-[11px] font-mono tracking-widest uppercase transition-all duration-300 border-b-2 whitespace-nowrap ${
                showFinale
                  ? 'border-[#D4AF37] text-[#D4AF37] font-semibold'
                  : 'border-transparent text-[#E5C378]/60 hover:text-[#E5C378]'
              }`}
            >
              Finale: All Six
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={handlePrev}
              disabled={activeIndex === 0 && !showFinale}
              className="p-2 rounded-full border border-white/10 hover:border-white/30 text-white disabled:opacity-20 transition-opacity"
              aria-label="Previous fragrance"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNext}
              disabled={showFinale}
              className="p-2 rounded-full border border-white/10 hover:border-white/30 text-white disabled:opacity-20 transition-opacity"
              aria-label="Next fragrance"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* SCENE CONTENT OR FINALE */}
        {!showFinale ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center min-h-[550px]">
            
            {/* LEFT: EDITORIAL FRAGRANCE STORY & NOTES */}
            <div className="lg:col-span-5 order-2 lg:order-1 flex flex-col justify-center space-y-6 animate-in fade-in slide-in-from-left-6 duration-700">
              <div className="space-y-2">
                <span className="text-xs font-mono tracking-[0.3em] uppercase text-[#E5C378]">
                  0{activeIndex + 1} / 06 · {currentScene.subtitle}
                </span>
                <h2 className="font-serif text-4xl sm:text-6xl tracking-[0.2em] font-light text-[#F3EFE6] uppercase">
                  {currentScene.name}
                </h2>
              </div>

              {/* Fragrance Notes Headline in pure typography */}
              <div className="flex items-center gap-3 text-xs sm:text-sm font-medium tracking-[0.25em] text-[#D4AF37] uppercase">
                {currentScene.notesTitle.map((note, i) => (
                  <React.Fragment key={note}>
                    <span>{note}</span>
                    {i < currentScene.notesTitle.length - 1 && (
                      <span className="text-white/30">·</span>
                    )}
                  </React.Fragment>
                ))}
              </div>

              <p className="text-sm sm:text-base leading-relaxed text-[#D1CECB] font-light max-w-lg">
                {currentScene.description}
              </p>

              {/* Atmosphere description */}
              <div className="text-xs text-white/50 tracking-wider flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
                <span>Atmosphere: {currentScene.atmosphereText}</span>
              </div>

              {/* CTAs */}
              <div className="pt-4 flex flex-wrap items-center gap-4">
                <button
                  onClick={() => handleDiscover(currentScene.slug)}
                  className="px-7 py-3 bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] font-semibold text-xs tracking-[0.2em] uppercase transition-all duration-300 flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  <span>Discover {currentScene.name}</span>
                </button>
                <button
                  onClick={() => handleQuickAdd(currentScene.slug)}
                  className="px-6 py-3 border border-white/20 hover:border-[#D4AF37] bg-white/5 hover:bg-white/10 text-white font-medium text-xs tracking-[0.2em] uppercase transition-all duration-300 flex items-center gap-2"
                >
                  <ShoppingBag className="w-4 h-4 text-[#D4AF37]" />
                  <span>Shop 50ml · ₹{currentScene.price.toLocaleString('en-IN')}</span>
                </button>
              </div>
            </div>

            {/* RIGHT: PINNED 3D PERFUME BOTTLE WITH DYNAMIC ATMOSPHERE */}
            <div className="lg:col-span-7 order-1 lg:order-2 h-[420px] sm:h-[540px] flex items-center justify-center relative">
              <div className="w-full h-full">
                <PerfumeBottle3D
                  key={currentScene.id}
                  color={currentScene.bottleColor}
                  ambientColor={currentScene.ambientColor}
                  fragranceName={currentScene.name}
                  mode="single"
                  interactive={true}
                  className="w-full h-full"
                />
              </div>
            </div>

          </div>
        ) : (
          /* FINALE: ALL SIX BOTTLES SHOWCASE */
          <div className="flex flex-col items-center justify-center text-center space-y-8 py-8 animate-in fade-in zoom-in-95 duration-1000">
            <div className="space-y-3 max-w-2xl">
              <span className="text-xs font-mono tracking-[0.35em] text-[#D4AF37] uppercase">
                The Complete Main Collection
              </span>
              <h2 className="font-serif text-3xl sm:text-5xl md:text-6xl tracking-[0.25em] font-light text-[#F3EFE6] uppercase leading-tight">
                Find The Memory<br />That Stays.
              </h2>
              <p className="text-sm sm:text-base text-[#D1CECB] font-light max-w-lg mx-auto">
                Six extraordinary olfactive architectures designed to evoke memory, stillness, and magnetic presence.
              </p>
            </div>

            {/* 3D Arc of All Six Bottles */}
            <div className="w-full max-w-4xl h-[420px] sm:h-[480px]">
              <PerfumeBottle3D
                mode="all-six"
                interactive={true}
                className="w-full h-full"
              />
            </div>

            {/* Finale CTAs */}
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <button
                onClick={() => {
                  trackEvent('ShopClick', { location: 'scroll_finale_shop' });
                  setCurrentView('shop');
                }}
                className="w-full sm:w-auto px-8 py-4 bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] font-semibold text-xs tracking-[0.25em] uppercase transition-all duration-300"
              >
                Shop The Collection
              </button>
              <button
                onClick={() => handleDiscover('fragmore-discovery-six')}
                className="w-full sm:w-auto px-8 py-4 border border-[#D4AF37]/50 hover:border-[#D4AF37] bg-white/5 hover:bg-white/10 text-[#F3EFE6] font-medium text-xs tracking-[0.25em] uppercase transition-all duration-300 flex items-center justify-center gap-2"
              >
                <span>Discovery Six (2ml &amp; 10ml)</span>
                <ArrowRight className="w-4 h-4 text-[#D4AF37]" />
              </button>
            </div>
          </div>
        )}

      </div>
    </section>
  );
};
