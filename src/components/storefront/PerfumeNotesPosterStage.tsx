import React, { useState, useMemo } from 'react';
import { Product, ProductVariant, StaticPosterSlotConfig } from '../../types';
import { FragmoreBottleVisual, getScentPalette } from './FragmoreBottleVisual';
import { resolveNoteIngredient, getSprayPaletteForSlug, ResolvedIngredientNote } from '../../data/noteIngredients';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

interface PerfumeNotesPosterStageProps {
  product: Product;
  currentVariant?: ProductVariant;
  selectedDiscoverySlugs?: string[];
}

interface ResolvedPosterSlide {
  slotIndex: number;
  title: string;
  subtitle: string;
  kicker: string;
  noteFocus: 'all' | 'top' | 'heart' | 'base' | 'collector';
  bottleImageUrl?: string;
  customPosterUrl?: string;
  useNotesBackground: boolean;
  featuredNotes: ResolvedIngredientNote[];
}

export const PerfumeNotesPosterStage: React.FC<PerfumeNotesPosterStageProps> = ({
  product,
  currentVariant,
  selectedDiscoverySlugs,
}) => {
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);

  const scentPalette = useMemo(
    () => getScentPalette(product.slug || product.name),
    [product.slug, product.name]
  );
  const sprayPalette = useMemo(
    () => getSprayPaletteForSlug(product.slug),
    [product.slug]
  );

  const resolvedTopNotes = useMemo(
    () => (product.notes?.top || []).map((n) => resolveNoteIngredient(n, product.noteMedia)),
    [product.notes?.top, product.noteMedia]
  );
  const resolvedHeartNotes = useMemo(
    () => (product.notes?.heart || []).map((n) => resolveNoteIngredient(n, product.noteMedia)),
    [product.notes?.heart, product.noteMedia]
  );
  const resolvedBaseNotes = useMemo(
    () => (product.notes?.base || []).map((n) => resolveNoteIngredient(n, product.noteMedia)),
    [product.notes?.base, product.noteMedia]
  );
  const allResolvedNotes = useMemo(
    () => [...resolvedTopNotes, ...resolvedHeartNotes, ...resolvedBaseNotes],
    [resolvedTopNotes, resolvedHeartNotes, resolvedBaseNotes]
  );

  // Build the 5 Static Poster slides combining any Admin-configured 4-5 poster images with the respective notes backgrounds
  const posterSlides: ResolvedPosterSlide[] = useMemo(() => {
    const variantPosters = currentVariant?.staticPosters || product.staticPosters || [];
    const legacyUrls: string[] = [
      ...(currentVariant?.staticPosterUrls || product.staticPosterUrls || []),
      currentVariant?.staticPosterImageUrl || currentVariant?.posterImage || '',
      ...(currentVariant?.additionalImageUrls || currentVariant?.additionalImages || []),
    ].filter(Boolean);

    const defaultTemplates: Array<{
      slotIndex: number;
      title: string;
      subtitle: string;
      kicker: string;
      noteFocus: 'all' | 'top' | 'heart' | 'base' | 'collector';
      notes: ResolvedIngredientNote[];
    }> = [
      {
        slotIndex: 1,
        title: 'Olfactory Notes Composition',
        subtitle: `Top, Heart & Base Botanicals · ${product.name}`,
        kicker: 'POSTER 01 · COMPLETE NOTES BACKDROP',
        noteFocus: 'all',
        notes: allResolvedNotes.slice(0, 6),
      },
      {
        slotIndex: 2,
        title: 'Opening Top Notes Aura',
        subtitle: (product.notes?.top || []).join(' · ') || 'Luminous Opening Accord',
        kicker: 'POSTER 02 · TOP NOTES BOTANICALS',
        noteFocus: 'top',
        notes: resolvedTopNotes.length > 0 ? resolvedTopNotes : allResolvedNotes.slice(0, 3),
      },
      {
        slotIndex: 3,
        title: 'Heart Signature Botanicals',
        subtitle: (product.notes?.heart || []).join(' · ') || 'Core Floral & Spice Heart',
        kicker: 'POSTER 03 · HEART NOTES BACKDROP',
        noteFocus: 'heart',
        notes: resolvedHeartNotes.length > 0 ? resolvedHeartNotes : allResolvedNotes.slice(0, 3),
      },
      {
        slotIndex: 4,
        title: 'Base Notes & Lasting Trail',
        subtitle: (product.notes?.base || []).join(' · ') || 'Resinous Woods & Warm Amber',
        kicker: 'POSTER 04 · BASE NOTES ARCHITECTURE',
        noteFocus: 'base',
        notes: resolvedBaseNotes.length > 0 ? resolvedBaseNotes : allResolvedNotes.slice(-3),
      },
      {
        slotIndex: 5,
        title: 'Collector Edition Archive',
        subtitle: `${product.collection} · ${currentVariant?.size || '50 ml'}`,
        kicker: 'POSTER 05 · HAUTE PARFUMERIE ARCHIVE',
        noteFocus: 'collector',
        notes: allResolvedNotes.slice(0, 6),
      },
    ];

    return defaultTemplates.map((tpl, index) => {
      const adminSlot: StaticPosterSlotConfig | undefined =
        variantPosters.find((p) => p.slotIndex === tpl.slotIndex) || variantPosters[index];
      const fallbackUrl = legacyUrls[index] || '';

      const bottleImg = adminSlot?.bottleImageUrl?.trim() || fallbackUrl || undefined;
      const customPoster = adminSlot?.customPosterUrl?.trim() || undefined;
      const useNotesBg =
        adminSlot?.useNotesBackground !== undefined ? adminSlot.useNotesBackground : true;

      return {
        slotIndex: tpl.slotIndex,
        title: adminSlot?.title?.trim() || tpl.title,
        subtitle: tpl.subtitle,
        kicker: tpl.kicker,
        noteFocus: adminSlot?.noteFocus || tpl.noteFocus,
        bottleImageUrl: bottleImg,
        customPosterUrl: customPoster,
        useNotesBackground: useNotesBg,
        featuredNotes: tpl.notes,
      };
    });
  }, [
    currentVariant,
    product,
    allResolvedNotes,
    resolvedTopNotes,
    resolvedHeartNotes,
    resolvedBaseNotes,
  ]);

  const currentSlide = posterSlides[activeSlideIdx] || posterSlides[0];
  const photoNotes = currentSlide.featuredNotes.filter((n) => n.imageUrl);

  const handlePrev = () => {
    setActiveSlideIdx((prev) => (prev === 0 ? posterSlides.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setActiveSlideIdx((prev) => (prev === posterSlides.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="w-full flex flex-col gap-3 select-none">
      {/* Main Static Poster Canvas with Perfume Bottle + Respective Notes in the Background */}
      <div
        className="dark-luxury-stage relative w-full min-h-[390px] sm:min-h-[430px] rounded-2xl overflow-hidden border border-[#C5A059]/40 bg-[#0D0B09] text-[#FAF6EE] shadow-[0_24px_60px_rgba(12,9,6,0.45)] flex flex-col justify-between p-4 sm:p-5"
        style={{ backgroundColor: '#0D0B09', color: '#FAF6EE' }}
      >
        {/* If Admin provided a full custom poster image and disabled notes background */}
        {!currentSlide.useNotesBackground && currentSlide.customPosterUrl ? (
          <img
            src={currentSlide.customPosterUrl}
            alt={`${product.name} — ${currentSlide.title}`}
            className="absolute inset-0 w-full h-full object-cover z-0"
          />
        ) : (
          /* RESPECTIVE OLFACTORY NOTES BACKGROUND MOSAIC & ATMOSPHERE */
          <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
            {/* Layer A: Botanical Ingredient Photography Collage in Background */}
            {photoNotes.length > 0 && (
              <div
                className={`absolute inset-0 grid ${
                  photoNotes.length === 1
                    ? 'grid-cols-1'
                    : photoNotes.length === 2
                    ? 'grid-cols-2'
                    : 'grid-cols-3'
                } gap-0.5 opacity-42`}
              >
                {photoNotes.slice(0, 6).map((note, idx) => (
                  <div
                    key={`${note.rawName}-${idx}`}
                    className="relative w-full h-full overflow-hidden"
                  >
                    <img
                      src={note.imageUrl}
                      alt={note.alt}
                      loading="lazy"
                      className="w-full h-full object-cover scale-105 transition-transform duration-1000"
                      style={{
                        filter: 'saturate(1.18) contrast(1.06)',
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0D0B09] via-[#0D0B09]/35 to-[#0D0B09]/55" />
                  </div>
                ))}
              </div>
            )}

            {/* Layer B: Scent-Matched Radial Sunburst & Chiaroscuro Vignette */}
            <div
              className="absolute inset-0"
              style={{
                background: `
                  radial-gradient(circle at 50% 50%, ${sprayPalette.primaryHex}48 0%, ${scentPalette.liquidMid}28 42%, rgba(13, 11, 9, 0.88) 78%),
                  linear-gradient(180deg, rgba(13, 11, 9, 0.72) 0%, rgba(13, 11, 9, 0.25) 45%, rgba(13, 11, 9, 0.88) 100%)
                `,
              }}
            />

            {/* Layer C: Architectural Gold Frame Hairline inside the Poster */}
            <div className="absolute inset-3 rounded-xl border border-[#D4AF37]/25 pointer-events-none" />
          </div>
        )}

        {/* TOP POSTER HEADER: Maison Branding & Active Poster Kicker */}
        <div className="relative z-20 flex items-start justify-between gap-2 border-b border-white/15 pb-2.5">
          <div>
            <div className="text-[9px] sm:text-[10px] font-mono uppercase tracking-[0.24em] text-[#D8B572]">
              {currentSlide.kicker}
            </div>
            <div className="font-serif text-sm sm:text-base tracking-[0.12em] uppercase text-[#FAF6EE] font-semibold">
              {currentSlide.title}
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-[#E6D5B8] block">
              FRAGMORÉ®
            </span>
            <span className="text-[9px] font-mono text-white/60">
              {activeSlideIdx + 1} / {posterSlides.length}
            </span>
          </div>
        </div>

        {/* CENTER POSTER STAGE: Floating Respective Note Portraits + Perfume Bottle in Foreground */}
        <div className="relative z-20 flex-1 grid grid-cols-12 items-center my-2 gap-2">
          {/* Left Floating Botanical Notes Column */}
          <div className="col-span-3 flex flex-col gap-2 z-20">
            {currentSlide.featuredNotes
              .filter((_, i) => i % 2 === 0)
              .slice(0, 3)
              .map((note, idx) => (
                <div
                  key={`left-note-${note.rawName}-${idx}`}
                  className="rounded-xl bg-[#14110E]/80 backdrop-blur-md border border-[#D4AF37]/35 p-1.5 sm:p-2 flex items-center gap-2 shadow-lg"
                >
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg overflow-hidden shrink-0 border border-[#D4AF37]/40 bg-[#1F1A15] flex items-center justify-center">
                    {note.imageUrl ? (
                      <img
                        src={note.imageUrl}
                        alt={note.alt}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-[#D8B572]" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[8px] font-mono uppercase tracking-widest text-[#D8B572] block truncate">
                      {currentSlide.noteFocus === 'top'
                        ? 'Top Note'
                        : currentSlide.noteFocus === 'heart'
                        ? 'Heart Note'
                        : currentSlide.noteFocus === 'base'
                        ? 'Base Note'
                        : idx === 0
                        ? 'Top Note'
                        : idx === 1
                        ? 'Heart Note'
                        : 'Base Note'}
                    </span>
                    <span className="text-[10px] sm:text-xs font-serif font-semibold text-white block truncate">
                      {note.label}
                    </span>
                  </div>
                </div>
              ))}
          </div>

          {/* Center Foreground Perfume Bottle */}
          <div className="col-span-6 flex flex-col items-center justify-center relative">
            {/* Luminous Halo Behind Bottle */}
            <div
              className="pointer-events-none absolute w-44 h-44 sm:w-52 sm:h-52 rounded-full blur-2xl"
              style={{
                background: `radial-gradient(circle, ${sprayPalette.primaryHex}65 0%, transparent 70%)`,
              }}
            />

            {currentSlide.bottleImageUrl ? (
              <div className="relative z-10 flex items-center justify-center h-60 sm:h-68">
                <img
                  src={currentSlide.bottleImageUrl}
                  alt={`${product.name} ${currentVariant?.size || ''}`}
                  className="max-h-60 sm:max-h-68 w-auto object-contain drop-shadow-[0_22px_36px_rgba(0,0,0,0.65)]"
                />
              </div>
            ) : (
              <FragmoreBottleVisual
                slug={product.slug}
                size={currentVariant?.size}
                variant={currentVariant}
                productName={product.name}
                productTagline={product.subtitle}
                collection={product.collection}
                selectedDiscoverySlugs={selectedDiscoverySlugs}
                className="w-44 h-60 sm:w-48 sm:h-64"
                interactive={false}
                showGlow={false}
                showShadow={true}
              />
            )}
          </div>

          {/* Right Floating Botanical Notes Column */}
          <div className="col-span-3 flex flex-col gap-2 z-20">
            {currentSlide.featuredNotes
              .filter((_, i) => i % 2 === 1)
              .slice(0, 3)
              .map((note, idx) => (
                <div
                  key={`right-note-${note.rawName}-${idx}`}
                  className="rounded-xl bg-[#14110E]/80 backdrop-blur-md border border-[#D4AF37]/35 p-1.5 sm:p-2 flex items-center gap-2 shadow-lg"
                >
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg overflow-hidden shrink-0 border border-[#D4AF37]/40 bg-[#1F1A15] flex items-center justify-center">
                    {note.imageUrl ? (
                      <img
                        src={note.imageUrl}
                        alt={note.alt}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-[#D8B572]" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[8px] font-mono uppercase tracking-widest text-[#D8B572] block truncate">
                      {currentSlide.noteFocus === 'top'
                        ? 'Top Note'
                        : currentSlide.noteFocus === 'heart'
                        ? 'Heart Note'
                        : currentSlide.noteFocus === 'base'
                        ? 'Base Note'
                        : idx === 0
                        ? 'Opening'
                        : idx === 1
                        ? 'Heart'
                        : 'Base'}
                    </span>
                    <span className="text-[10px] sm:text-xs font-serif font-semibold text-white block truncate">
                      {note.label}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* BOTTOM POSTER FOOTER: Complete Olfactory Strip & Prev/Next Controls */}
        <div className="relative z-20 flex items-center justify-between gap-2 pt-2.5 border-t border-white/15">
          <div className="min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-[#D8B572] truncate">
              {product.name} · {currentVariant?.size || '50 ml'}
            </div>
            <div className="text-[11px] text-white/75 truncate">{currentSlide.subtitle}</div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous static poster"
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-[#D4AF37] text-white hover:text-[#0D0B09] border border-white/15 flex items-center justify-center transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Next static poster"
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-[#D4AF37] text-white hover:text-[#0D0B09] border border-white/15 flex items-center justify-center transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 5-Poster Thumbnail Selector Strip (Shown Exclusively in Static Poster Mode) */}
      <div className="grid grid-cols-5 gap-2">
        {posterSlides.map((slide, idx) => {
          const isSelected = idx === activeSlideIdx;
          const thumbNoteImg = slide.featuredNotes.find((n) => n.imageUrl)?.imageUrl;
          return (
            <button
              key={slide.slotIndex}
              type="button"
              onClick={() => setActiveSlideIdx(idx)}
              className={`group relative rounded-xl overflow-hidden border p-1.5 text-left transition-all cursor-pointer ${
                isSelected
                  ? 'border-[#9A783E] bg-[#24211D] text-[#FAF8F4] ring-1 ring-[#9A783E] shadow-sm'
                  : 'border-[#DED7CC] bg-[#FFFFFF] text-[#24211D] hover:border-[#9A783E]/70'
              }`}
            >
              <div className="relative h-14 rounded-lg overflow-hidden bg-[#14110E] mb-1 flex items-center justify-center">
                {thumbNoteImg && (
                  <img
                    src={thumbNoteImg}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 w-full h-full object-cover opacity-45"
                  />
                )}
                <div className="relative z-10 h-12 w-9 flex items-center justify-center">
                  {slide.bottleImageUrl ? (
                    <img
                      src={slide.bottleImageUrl}
                      alt={slide.title}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <FragmoreBottleVisual
                      slug={product.slug}
                      size={currentVariant?.size}
                      productName={product.name}
                      collection={product.collection}
                      className="w-8 h-12"
                      showGlow={false}
                      showShadow={false}
                    />
                  )}
                </div>
              </div>
              <div className="text-[9px] font-mono uppercase tracking-wider text-[#9A783E] truncate">
                0{slide.slotIndex} · {slide.noteFocus.toUpperCase()}
              </div>
              <div className="text-[10px] font-medium truncate leading-tight">
                {slide.title}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
