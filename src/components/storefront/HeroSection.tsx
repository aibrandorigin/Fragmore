import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play,
  Pause,
  ArrowRight,
  ShoppingBag,
  Sparkles,
  Eye,
  Check,
  ChevronRight,
  Droplets,
  Clock,
  Layers,
  Volume2,
  VolumeX
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import {
  FRAGRANCE_JOURNEY_DATA,
  REAL_GLASS_BOTTLE_IMAGES,
  FragranceJourneyBottleData
} from './FragmoreBottleVisual';
import {
  SIGNATURE_SPRAY_PALETTES,
  resolveNoteIngredient
} from '../../data/noteIngredients';

interface HeroSectionProps {
  onShopNow?: () => void;
  onDiscoverChange?: () => void;
  onTakeQuiz?: () => void;
}

const HERO_FRAGRANCES: Array<{
  slug: string;
  code: string;
  name: string;
  tagline: string;
  headline: string;
  italicWord: string;
  subtitle: string;
  bottleImage: string;
  themeColor: string;
  accentColor: string;
  topNotes: string[];
  heartNotes: string[];
  baseNotes: string[];
  sillage: string;
  longevity: string;
  sellingPrice: number;
  mrp: number;
}> = [
  {
    slug: 'golden-hour',
    code: '01',
    name: 'GOLDEN HOUR',
    tagline: 'Golden. Warm. Unforgettable.',
    headline: 'Sunlit Bergamot,',
    italicWord: 'Suspended in Amber.',
    subtitle: 'Bright Italian citrus and golden pear melting into a heart of musky sunset, anchored by Madagascar vanilla and rich woods.',
    bottleImage: '/images/products/real-glass-mild-gold.webp?v=7',
    themeColor: '#DDA137',
    accentColor: '#FCE8AC',
    topNotes: ['Italian Citrus', 'Golden Pear', 'Saffron'],
    heartNotes: ['Musky Sunset Accord', 'Sunlit Amber'],
    baseNotes: ['Bourbon Vanilla', 'Cedarwood', 'Soft Musk'],
    sillage: 'Imperial',
    longevity: '14+ Hours',
    sellingPrice: 3499,
    mrp: 4999,
  },
  {
    slug: 'blush-and-blossom',
    code: '02',
    name: 'BLUSH & BLOSSOM',
    tagline: 'Chic. Sparkling. Feminine.',
    headline: 'Sparkling Damask Rose,',
    italicWord: 'Crowned in Silk.',
    subtitle: 'Luminous French orange blossom and velvet centifolia rose floating over a decadent bed of spun vanilla and Indonesian patchouli.',
    bottleImage: '/images/products/real-glass-mild-gold.webp?v=7',
    themeColor: '#DF9580',
    accentColor: '#FADBD2',
    topNotes: ['Damask Rose', 'Orange Blossom', 'Pink Peppercorn'],
    heartNotes: ['Chic Florals', 'White Peony'],
    baseNotes: ['Spun Vanilla', 'Warm Patchouli', 'Cashmere Musk'],
    sillage: 'Enveloping',
    longevity: '12+ Hours',
    sellingPrice: 3499,
    mrp: 4999,
  },
  {
    slug: 'violet-noir',
    code: '03',
    name: 'VIOLET NOIR',
    tagline: 'Bold. Mysterious. Magnetic.',
    headline: 'French Violet Leaf,',
    italicWord: 'Draped in Leather.',
    subtitle: 'Crisp green violet leaves and fiery nutmeg layered atop supple Tuscan leather and smoky petrol woods for a magnetic aura.',
    bottleImage: '/images/products/real-glass-mild-gold.webp?v=7',
    themeColor: '#AC6F88',
    accentColor: '#EBD5DE',
    topNotes: ['French Violet Leaf', 'Ceylon Nutmeg'],
    heartNotes: ['Tuscan Leather', 'Smoked Birch'],
    baseNotes: ['Woody Petrol-Edge', 'Dark Cedar', 'Ambergris'],
    sillage: 'Imperial',
    longevity: '16+ Hours',
    sellingPrice: 3499,
    mrp: 4999,
  },
  {
    slug: 'aqua-pulse',
    code: '04',
    name: 'AQUA PULSE',
    tagline: 'Crisp. Oceanic. Invigorating.',
    headline: 'Mediterranean Salt,',
    italicWord: 'Surging in Driftwood.',
    subtitle: 'Cold ocean sea-spray, aromatic rosemary, and zesty grapefruit rushing through marine saline into sun-bleached coastal cedar.',
    bottleImage: '/images/products/real-glass-mild-gold.webp?v=7',
    themeColor: '#4A90A4',
    accentColor: '#C4E5EC',
    topNotes: ['Oceanic Saline', 'Pink Grapefruit', 'Crushed Mint'],
    heartNotes: ['Wild Rosemary', 'Marine Accord'],
    baseNotes: ['Coastal Driftwood', 'Grey Amber', 'White Cedar'],
    sillage: 'Moderate',
    longevity: '10+ Hours',
    sellingPrice: 3499,
    mrp: 4999,
  },
  {
    slug: 'luxe-heritage',
    code: '05',
    name: 'LUXE HERITAGE',
    tagline: 'Sacred. Imperial. Timeless.',
    headline: 'Aged Assam Oud,',
    italicWord: 'Infused with Royal Spice.',
    subtitle: 'Cardamom and saffron distilled with 30-year wild Assam agarwood, resinous frankincense, and imperial black amber.',
    bottleImage: '/images/products/real-glass-mild-gold.webp?v=7',
    themeColor: '#B08848',
    accentColor: '#E8D2A6',
    topNotes: ['Royal Cardamom', 'Kashmiri Saffron'],
    heartNotes: ['Sacred Assam Oud', 'Frankincense Resin'],
    baseNotes: ['Black Amber', 'Mysore Sandalwood', 'Vetiver'],
    sillage: 'Imperial',
    longevity: '18+ Hours',
    sellingPrice: 3899,
    mrp: 5499,
  },
];

const MINIMAL_SCENES = [
  '/videos/minimal-scene-01.jpg?v=7',
  '/videos/minimal-scene-02.jpg?v=7',
  '/videos/minimal-scene-03.jpg?v=7',
];

export const HeroSection: React.FC<HeroSectionProps> = ({
  onShopNow,
  onDiscoverChange,
  onTakeQuiz,
}) => {
  const {
    products,
    addToCart,
    setCurrentView,
    setSelectedProductSlug,
    setIsQuizOpen,
    showNotification,
  } = useStore();

  const [selectedFragranceIndex, setSelectedFragranceIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'video' | 'poster'>('video');
  const [isPlaying, setIsPlaying] = useState(true);
  const [videoReady, setVideoReady] = useState(false);
  const [fallbackSceneIdx, setFallbackSceneIdx] = useState(0);
  const [addedSlug, setAddedSlug] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mistCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const activeFragrance = HERO_FRAGRANCES[selectedFragranceIndex];

  // Match full product model from StoreContext for cart operations
  const activeProduct = useMemo(() => {
    return (
      products.find(
        (p) =>
          p.slug.toLowerCase() === activeFragrance.slug.toLowerCase() ||
          p.name.toLowerCase() === activeFragrance.name.toLowerCase()
      ) || products[0]
    );
  }, [products, activeFragrance.slug, activeFragrance.name]);

  const discoveryProduct = useMemo(() => {
    return products.find((p) => p.slug === 'fragmore-discovery-six');
  }, [products]);
  const discoveryPrice = discoveryProduct?.variants?.[0]?.sellingPrice ?? 499;

  // Subtle ambient golden mist particles drifting across the background
  useEffect(() => {
    const canvas = mistCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const w = canvas.width;
    const h = canvas.height;

    const particles = Array.from({ length: 42 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: 0.14 + Math.random() * 0.24,
      vy: -0.09 - Math.random() * 0.16,
      r: 1.4 + Math.random() * 3.2,
      a: 0.14 + Math.random() * 0.28,
      phase: Math.random() * Math.PI * 2,
    }));

    let tick = 0;
    const render = () => {
      tick += 0.015;
      ctx.clearRect(0, 0, w, h);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy + Math.sin(tick + p.phase) * 0.08;
        if (p.x > w + 20) p.x = -20;
        if (p.y < -20) p.y = h + 20;

        const alpha = p.a * (0.65 + 0.35 * Math.sin(tick * 1.4 + p.phase));
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3.5);
        grad.addColorStop(0, `rgba(248, 224, 166, ${alpha})`);
        grad.addColorStop(0.5, `rgba(212, 175, 55, ${alpha * 0.45})`);
        grad.addColorStop(1, 'rgba(212, 175, 55, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      if (isPlaying) {
        animId = requestAnimationFrame(render);
      }
    };

    if (isPlaying) {
      animId = requestAnimationFrame(render);
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [isPlaying]);

  // Fallback crossfade if video is still loading
  useEffect(() => {
    if (videoReady || !isPlaying) return;
    const timer = setInterval(() => {
      setFallbackSceneIdx((prev) => (prev + 1) % MINIMAL_SCENES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [videoReady, isPlaying]);

  const togglePlayPause = () => {
    const vid = videoRef.current;
    if (!vid) {
      setIsPlaying((prev) => !prev);
      return;
    }
    if (vid.paused) {
      vid
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(true));
    } else {
      vid.pause();
      setIsPlaying(false);
    }
  };

  const handleExploreClick = () => {
    if (onShopNow) {
      onShopNow();
      return;
    }
    const el = document.getElementById('catalogue-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleDiscoveryClick = () => {
    if (onDiscoverChange) {
      onDiscoverChange();
      return;
    }
    setSelectedProductSlug('fragmore-discovery-six');
    setCurrentView('pdp');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenProduct = (slug: string) => {
    setSelectedProductSlug(slug);
    setCurrentView('pdp');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleQuizClick = () => {
    if (onTakeQuiz) {
      onTakeQuiz();
      return;
    }
    setIsQuizOpen(true);
  };

  const handleQuickAdd = () => {
    if (!activeProduct) return;
    const variant = activeProduct.variants[0] || {
      id: `${activeProduct.id}-50ml`,
      size: '50 ml',
      sellingPrice: activeFragrance.sellingPrice,
      mrp: activeFragrance.mrp,
      sku: `FRG-${activeProduct.slug}-50`,
      stockOnHand: 100,
      stockReserved: 0,
      stockAvailable: 100,
      isAvailable: true,
    };
    addToCart(activeProduct, variant.size, 1);
    setAddedSlug(activeProduct.slug);
    showNotification(`Added 50ml flacon of ${activeFragrance.name} to your luxury cart.`);
    setTimeout(() => {
      setAddedSlug(null);
    }, 2400);
  };

  return (
    <section
      className="dark-luxury-stage relative min-h-[calc(100vh-4rem)] w-full overflow-hidden border-b border-[#D4AF37]/25 flex flex-col justify-between select-none"
      style={{
        backgroundColor: '#120F0D',
        color: '#FAF6EE',
      }}
    >
      {/* LAYER 0: BACKGROUND ATMOSPHERE (VIDEO OR BOTANICAL NOTES POSTER MODE) */}
      <div className="absolute inset-0 z-0 overflow-hidden bg-[#120F0D]">
        {viewMode === 'video' ? (
          <>
            {/* Seamless Fallback Studio Frames */}
            {MINIMAL_SCENES.map((src, idx) => (
              <img
                key={src}
                src={src}
                alt="FRAGMORÉ Minimalist Studio Collection"
                referrerPolicy="no-referrer"
                className={`absolute inset-0 h-full w-full object-cover object-right transition-opacity duration-1000 ${
                  idx === fallbackSceneIdx ? 'opacity-100' : 'opacity-0'
                }`}
              />
            ))}

            {/* Primary Minimalist Background Video (<video>) */}
            <video
              ref={videoRef}
              src="/videos/fragmore-minimal-bg.mp4?v=7"
              poster="/videos/minimal-poster.jpg?v=7"
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              onLoadedData={() => setVideoReady(true)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              className={`absolute inset-0 h-full w-full object-cover object-right transition-opacity duration-700 ${
                videoReady ? 'opacity-100' : 'opacity-0'
              }`}
            />
          </>
        ) : (
          /* ARTISANAL FLACON & NOTES POSTER BACKDROP */
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-[#0D0B0A]">
            {/* Atmospheric Botanical Aura Gradient */}
            <div
              className="absolute inset-0 opacity-40 transition-all duration-1000"
              style={{
                background: `radial-gradient(circle at 68% 45%, ${activeFragrance.themeColor}33 0%, rgba(18, 15, 13, 0.95) 70%)`,
              }}
            />

            {/* Subtle Respective Notes Macro Patterns in the Background */}
            <div className="absolute inset-0 opacity-15 pointer-events-none mix-blend-screen overflow-hidden">
              <div className="absolute top-1/4 right-1/4 w-[600px] h-[600px] rounded-full blur-3xl bg-gradient-to-br from-[#D4AF37]/30 to-[#FAF8F4]/10" />
              <div className="absolute bottom-10 right-10 text-[180px] font-serif font-light text-white/5 uppercase select-none tracking-tighter">
                {activeFragrance.name}
              </div>
            </div>

            {/* High-Resolution Perfume Bottle with Signature Glossy Black Cap on the Right */}
            <div className="absolute right-6 sm:right-16 lg:right-28 top-1/2 -translate-y-1/2 flex items-center justify-center">
              <div className="relative group">
                {/* Luminous Pedestal Glow */}
                <div
                  className="absolute -inset-10 rounded-full blur-3xl opacity-35 transition-all duration-700 pointer-events-none"
                  style={{ backgroundColor: activeFragrance.themeColor }}
                />

                {/* The Real Glass Bottle Render with Glossy Black Cap */}
                <img
                  src={activeFragrance.bottleImage}
                  alt={`${activeFragrance.name} with Glossy Black Cap`}
                  referrerPolicy="no-referrer"
                  className="relative z-10 w-64 sm:w-80 lg:w-96 max-h-[70vh] object-contain drop-shadow-[0_24px_50px_rgba(0,0,0,0.85)] filter brightness-105 hover:scale-105 transition-transform duration-500"
                />

                {/* Floating Note Badges on the Bottle */}
                <div className="absolute -left-6 top-1/4 z-20 hidden sm:flex flex-col gap-2">
                  <div className="px-3 py-1.5 rounded-lg bg-black/60 border border-[#D4AF37]/40 backdrop-blur-md text-[10px] font-mono tracking-widest text-[#FCE8AC] uppercase">
                    Top: {activeFragrance.topNotes[0]}
                  </div>
                  <div className="px-3 py-1.5 rounded-lg bg-black/60 border border-[#D4AF37]/40 backdrop-blur-md text-[10px] font-mono tracking-widest text-[#FCE8AC] uppercase">
                    Heart: {activeFragrance.heartNotes[0]}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Ambient Golden Mist Canvas */}
        <canvas
          ref={mistCanvasRef}
          width={960}
          height={540}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-75"
        />

        {/* Measured Luxury Contrast Scrim: Ensures 100% Text Contrast on the Left while Leaving the Right Open */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `
              linear-gradient(90deg, rgba(14, 11, 9, 0.94) 0%, rgba(14, 11, 9, 0.82) 42%, rgba(14, 11, 9, 0.28) 72%, rgba(14, 11, 9, 0.05) 100%),
              linear-gradient(180deg, rgba(14, 11, 9, 0.45) 0%, transparent 22%, transparent 70%, rgba(14, 11, 9, 0.88) 100%)
            `,
          }}
        />
      </div>

      {/* FOREGROUND: Elevated Left-Aligned Editorial Lockup (Right Side Open for Background Perfumes) */}
      <div className="relative z-10 mx-auto w-full max-w-[1440px] px-6 sm:px-10 lg:px-14 pt-16 sm:pt-20 lg:pt-24 pb-8 flex-1 flex flex-col justify-center">
        <div className="max-w-2xl space-y-6">
          {/* Top Bar Switcher: Mode Selector & Scent Kicker */}
          <div className="flex flex-wrap items-center gap-3">
            <div
              className="flex items-center gap-2 text-[11px] tracking-[0.24em] uppercase font-semibold"
              style={{ color: '#E5C378' }}
            >
              <span>MAISON FRAGMORÉ®</span>
              <span aria-hidden="true" style={{ color: '#D4AF37' }}>
                ·
              </span>
              <span style={{ color: '#EADFD0' }}>HAUTE PARFUMERIE</span>
            </div>

            {/* View Mode Toggle: Film vs Notes Posters */}
            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-black/40 border border-[#D4AF37]/30 backdrop-blur-md text-[10px] font-mono">
              <button
                type="button"
                onClick={() => setViewMode('video')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  viewMode === 'video'
                    ? 'bg-[#D4AF37] text-[#120F0D] font-bold'
                    : 'text-[#FAF6EE]/70 hover:text-[#FAF6EE]'
                }`}
              >
                Cinematic Film
              </button>
              <button
                type="button"
                onClick={() => setViewMode('poster')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  viewMode === 'poster'
                    ? 'bg-[#D4AF37] text-[#120F0D] font-bold'
                    : 'text-[#FAF6EE]/70 hover:text-[#FAF6EE]'
                }`}
              >
                Flacons &amp; Notes
              </button>
            </div>
          </div>

          {/* Dynamic Headline: Connected to Selected Fragrance */}
          <div className="space-y-2">
            <h1
              className="font-serif font-normal leading-[1.04] tracking-[-0.015em]"
              style={{
                color: '#FAF6EE',
                fontSize: 'clamp(2.4rem, 4.2vw, 4.1rem)',
                textWrap: 'balance',
              }}
            >
              {activeFragrance.headline}{' '}
              <span className="italic font-light" style={{ color: '#F5DA96' }}>
                {activeFragrance.italicWord}
              </span>
            </h1>
            <p
              className="text-base sm:text-lg leading-relaxed font-normal max-w-xl"
              style={{ color: '#EADFD0' }}
            >
              {activeFragrance.subtitle}
            </p>
          </div>

          {/* Olfactory Notes Triad (Top, Heart, Base) with Pure Luxury Typography */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-black/45 border border-[#D4AF37]/30 backdrop-blur-md max-w-xl space-y-2.5 shadow-2xs">
            <div className="flex items-center justify-between text-[11px] font-mono uppercase pb-2 border-b border-white/10">
              <span className="text-[#E5C378] font-bold tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>{activeFragrance.name} · Notes Pyramid</span>
              </span>
              <span className="text-white/60">Extrait de Parfum (32% Oil)</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-[10px] text-white/50 block font-mono uppercase tracking-widest">
                  Top Opening
                </span>
                <span className="font-serif text-[#FAF6EE] text-xs font-medium leading-snug">
                  {activeFragrance.topNotes.join(', ')}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[#E5C378] block font-mono uppercase tracking-widest">
                  Heart Body
                </span>
                <span className="font-serif text-[#FAF6EE] text-xs font-medium leading-snug">
                  {activeFragrance.heartNotes.join(', ')}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-white/50 block font-mono uppercase tracking-widest">
                  Base Drydown
                </span>
                <span className="font-serif text-[#FAF6EE] text-xs font-medium leading-snug">
                  {activeFragrance.baseNotes.join(', ')}
                </span>
              </div>
            </div>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex flex-wrap items-center gap-3.5 pt-1">
            <button
              type="button"
              onClick={handleExploreClick}
              style={{
                background: 'linear-gradient(95deg, #F5DA96 0%, #D8B144 52%, #BD8F26 100%)',
                color: '#120E0B',
                borderColor: '#F5DA96',
              }}
              className="group inline-flex items-center gap-2.5 rounded-xl border px-6 py-3.5 text-xs sm:text-sm font-bold uppercase tracking-[0.18em] shadow-[0_16px_34px_-10px_rgba(212,175,55,0.45)] hover:brightness-110 transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span style={{ color: '#120E0B' }}>Explore Full Catalogue</span>
              <ArrowRight
                className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1"
                style={{ color: '#120E0B' }}
              />
            </button>

            <button
              type="button"
              onClick={handleDiscoveryClick}
              style={{
                backgroundColor: '#FAF6EE',
                color: '#14100C',
                borderColor: '#E5C378',
              }}
              className="inline-flex items-center gap-2 rounded-xl border px-5 py-3.5 text-xs sm:text-sm font-bold uppercase tracking-[0.16em] hover:brightness-95 transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span style={{ color: '#14100C' }}>
                Discovery Six · ₹{discoveryPrice.toLocaleString('en-IN')}
              </span>
            </button>

            <button
              type="button"
              onClick={handleQuizClick}
              style={{
                backgroundColor: 'rgba(20, 16, 12, 0.75)',
                color: '#F5E6C8',
                borderColor: 'rgba(212, 175, 55, 0.42)',
              }}
              className="inline-flex items-center gap-2 rounded-xl border px-4 py-3.5 text-xs font-semibold uppercase tracking-[0.16em] backdrop-blur-md hover:brightness-125 transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Find Your Scent</span>
            </button>
          </div>
        </div>
      </div>

      {/* MINIMALIST BOTTOM BAR: Fragrance Navigation Switcher, Video Control, and Maison Trust Pillars */}
      <div className="relative z-10 mx-auto w-full max-w-[1440px] px-6 sm:px-10 lg:px-14 pb-6 pt-4 border-t border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Fragrance Carousel Jump Buttons */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          {HERO_FRAGRANCES.map((item, idx) => {
            const isSelected = idx === selectedFragranceIndex;
            return (
              <button
                key={item.slug}
                type="button"
                onClick={() => setSelectedFragranceIndex(idx)}
                className={`group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  isSelected
                    ? 'bg-[#D4AF37]/20 border border-[#D4AF37]/50 text-[#FAF6EE] font-semibold'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <span
                  className="font-mono text-[10px]"
                  style={{ color: isSelected ? '#F5DA96' : '#D4AF37' }}
                >
                  {item.code}
                </span>
                <span className="font-serif tracking-[0.06em] uppercase">
                  {item.name}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right Controls: Video Play/Pause & Maison Trust Note */}
        <div className="flex items-center gap-3 self-end md:self-auto">
          <span className="text-[11px] text-white/50 hidden lg:inline font-mono">
            Extrait de Parfum · Pure Botanical Maceration
          </span>

          {viewMode === 'video' && (
            <button
              type="button"
              onClick={togglePlayPause}
              style={{
                backgroundColor: 'rgba(18, 14, 11, 0.75)',
                color: '#FAF6EE',
                borderColor: 'rgba(212, 175, 55, 0.4)',
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.18em] backdrop-blur-md hover:brightness-125 transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3 h-3 text-[#E5C378]" />
                  <span>Pause Film</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 text-[#E5C378]" />
                  <span>Play Film</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
