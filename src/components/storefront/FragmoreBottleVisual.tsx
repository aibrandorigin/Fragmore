import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';

export interface FragranceJourneyBottleData {
  slug: string;
  code: string;
  name: string;
  tagline: string;
  description: string;
  topNotes: string[];
  heartNotes: string[];
  baseNotes: string[];
  liquidTopHex: string;
  liquidMidHex: string;
  liquidBottomHex: string;
  capAccentHex: string;
  glowRgba: string;
  realBottleImage: string;
}

export const REAL_GLASS_BOTTLE_IMAGES: Record<string, string> = {
  amber: '/images/products/real-glass-mild-gold.webp?v=7',
  rose: '/images/products/real-glass-mild-gold.webp?v=7',
  violet: '/images/products/real-glass-mild-gold.webp?v=7',
  aqua: '/images/products/real-glass-mild-gold.webp?v=7',
  oud: '/images/products/real-glass-mild-gold.webp?v=7',
  emerald: '/images/products/real-glass-mild-gold.webp?v=7',
};

export const REAL_GLASS_15ML_IMAGES: Record<string, string> = {
  amber: '/images/products/real-glass-15ml-mild-gold.webp?v=7',
  rose: '/images/products/real-glass-15ml-mild-gold.webp?v=7',
  violet: '/images/products/real-glass-15ml-mild-gold.webp?v=7',
  aqua: '/images/products/real-glass-15ml-mild-gold.webp?v=7',
  oud: '/images/products/real-glass-15ml-mild-gold.webp?v=7',
  emerald: '/images/products/real-glass-15ml-mild-gold.webp?v=7',
};

export const REAL_GLASS_2ML_IMAGES: Record<string, string> = {
  amber: '/images/products/real-glass-2ml-mild-gold.webp?v=7',
  rose: '/images/products/real-glass-2ml-mild-gold.webp?v=7',
  violet: '/images/products/real-glass-2ml-mild-gold.webp?v=7',
  aqua: '/images/products/real-glass-2ml-mild-gold.webp?v=7',
  oud: '/images/products/real-glass-2ml-mild-gold.webp?v=7',
  emerald: '/images/products/real-glass-2ml-mild-gold.webp?v=7',
};


export const FRAGRANCE_JOURNEY_DATA: FragranceJourneyBottleData[] = [
  {
    slug: 'golden-hour',
    code: '01',
    name: 'GOLDEN HOUR',
    tagline: 'Golden. Warm. Unforgettable.',
    description:
      'Golden. Warm. Unforgettable. Opening with Golden hour, Citrus, and Pear, unfolding into a heart of Musky Warm Sunset, and resting on Amber, Vanilla, and Soft Woods.',
    topNotes: ['Golden hour', 'Citrus', 'Pear'],
    heartNotes: ['Musky Warm Sunset'],
    baseNotes: ['Amber', 'Vanilla', 'Soft Woods'],
    liquidTopHex: '#F9EDC2',
    liquidMidHex: '#EDD388',
    liquidBottomHex: '#DFBC63',
    capAccentHex: '#C6902E',
    glowRgba: 'rgba(235, 206, 130, 0.28)',
    realBottleImage: REAL_GLASS_BOTTLE_IMAGES.amber,
  },
  {
    slug: 'blush-and-blossom',
    code: '02',
    name: 'BLUSH & BLOSSOM',
    tagline: 'Chic. Sparkling. Feminine.',
    description:
      'Chic. Sparkling. Feminine. A luminous opening of Sparkling Rose and Orange Blossom, leading into Chic Florals and a warm base of Vanilla and Patchouli.',
    topNotes: ['Sparkling Rose', 'Orange Blossom'],
    heartNotes: ['Chic Florals'],
    baseNotes: ['Vanilla', 'Patchouli'],
    liquidTopHex: '#F9EDC2',
    liquidMidHex: '#EDD388',
    liquidBottomHex: '#DFBC63',
    capAccentHex: '#C97A6A',
    glowRgba: 'rgba(235, 206, 130, 0.28)',
    realBottleImage: REAL_GLASS_BOTTLE_IMAGES.rose,
  },
  {
    slug: 'violet-noir',
    code: '03',
    name: 'VIOLET NOIR',
    tagline: 'Bold. Mysterious. Magnetic.',
    description:
      'Bold. Mysterious. Magnetic. Crafted with Violet Leaf and Nutmeg at the top, a heart of Warm Leather, and a distinctive Woody Petrol-Edge base.',
    topNotes: ['Violet Leaf', 'Nutmeg'],
    heartNotes: ['Warm Leather'],
    baseNotes: ['Woody Petrol-Edge'],
    liquidTopHex: '#F9EDC2',
    liquidMidHex: '#EDD388',
    liquidBottomHex: '#DFBC63',
    capAccentHex: '#8E629E',
    glowRgba: 'rgba(235, 206, 130, 0.28)',
    realBottleImage: REAL_GLASS_BOTTLE_IMAGES.violet,
  },
  {
    slug: 'aqua-pulse',
    code: '04',
    name: 'AQUA PULSE',
    tagline: 'Fresh. Energetic. Modern.',
    description:
      'Fresh. Energetic. Modern. An invigorating rush of Fresh Grapefruit and Mint over a crisp Cedarwood heart and a trail of Smoky Incense.',
    topNotes: ['Fresh Grapefruit', 'Mint'],
    heartNotes: ['Cedarwood'],
    baseNotes: ['Smoky Incense'],
    liquidTopHex: '#F9EDC2',
    liquidMidHex: '#EDD388',
    liquidBottomHex: '#DFBC63',
    capAccentHex: '#4A8996',
    glowRgba: 'rgba(235, 206, 130, 0.28)',
    realBottleImage: REAL_GLASS_BOTTLE_IMAGES.aqua,
  },
  {
    slug: 'luxe-heritage',
    code: '05',
    name: 'LUXE HERITAGE',
    tagline: 'Rich. Intense. Timeless.',
    description:
      'Rich. Intense. Timeless. Combining Rich Leather and Tart Raspberry in the opening, a heart of Saffron and Warm Wood, and a base of Smoky Richness.',
    topNotes: ['Rich Leather', 'Tart Raspberry'],
    heartNotes: ['Saffron', 'Warm Wood'],
    baseNotes: ['Smoky Richness'],
    liquidTopHex: '#F9EDC2',
    liquidMidHex: '#EDD388',
    liquidBottomHex: '#DFBC63',
    capAccentHex: '#B87828',
    glowRgba: 'rgba(235, 206, 130, 0.28)',
    realBottleImage: REAL_GLASS_BOTTLE_IMAGES.oud,
  },
  {
    slug: 'flora-crush',
    code: '06',
    name: 'FLORA CRUSH',
    tagline: 'Playful. Romantic. Addictive.',
    description:
      'Playful. Romantic. Addictive. Airy Gardenia and Pear Blossom meet Brown Sugar Sweetness, settling into Soft Musks and Amber.',
    topNotes: ['Airy Gardenia', 'Pear Blossom'],
    heartNotes: ['Brown Sugar Sweetness'],
    baseNotes: ['Soft Musks', 'Amber'],
    liquidTopHex: '#F9EDC2',
    liquidMidHex: '#EDD388',
    liquidBottomHex: '#DFBC63',
    capAccentHex: '#C86D5B',
    glowRgba: 'rgba(235, 206, 130, 0.28)',
    realBottleImage: REAL_GLASS_BOTTLE_IMAGES.rose,
  },
  {
    slug: 'midnight-glow',
    code: '07',
    name: 'MIDNIGHT GLOW',
    tagline: 'Seductive. Radiant. Captivating.',
    description:
      'Seductive. Radiant. Captivating. Tart Raspberry and Dark Rose open into a luscious Blackcurrant heart over Cozy Vanilla and Musk.',
    topNotes: ['Tart Raspberry', 'Dark Rose'],
    heartNotes: ['Blackcurrant'],
    baseNotes: ['Cozy Vanilla', 'Musk'],
    liquidTopHex: '#F9EDC2',
    liquidMidHex: '#EDD388',
    liquidBottomHex: '#DFBC63',
    capAccentHex: '#636C96',
    glowRgba: 'rgba(235, 206, 130, 0.28)',
    realBottleImage: REAL_GLASS_BOTTLE_IMAGES.violet,
  },
  {
    slug: 'silky-velvet',
    code: '08',
    name: 'SILKY VELVET',
    tagline: 'Classic. Elegant. Enduring.',
    description:
      'Classic. Elegant. Enduring. Timeless Powdery Florals unfold into Aldehydes, Rose, and Jasmine, grounded by pure Sandalwood.',
    topNotes: ['Timeless Powdery Florals'],
    heartNotes: ['Aldehydes', 'Rose', 'Jasmine'],
    baseNotes: ['Sandalwood'],
    liquidTopHex: '#F9EDC2',
    liquidMidHex: '#EDD388',
    liquidBottomHex: '#DFBC63',
    capAccentHex: '#C9986A',
    glowRgba: 'rgba(235, 206, 130, 0.28)',
    realBottleImage: REAL_GLASS_BOTTLE_IMAGES.amber,
  },
  {
    slug: 'night-bloom',
    code: '09',
    name: 'NIGHT BLOOM',
    tagline: 'Sensual. Playful. Unforgettable.',
    description:
      'Sensual. Playful. Unforgettable. Opening with a Blush Floral Accord, blooming into Peony, Rose, and Sweet Florals over Warm Vanilla and Musk.',
    topNotes: ['Blush Floral Accord'],
    heartNotes: ['Peony', 'Rose', 'Sweet Florals'],
    baseNotes: ['Warm Vanilla', 'Musk'],
    liquidTopHex: '#F9EDC2',
    liquidMidHex: '#EDD388',
    liquidBottomHex: '#DFBC63',
    capAccentHex: '#B84B59',
    glowRgba: 'rgba(235, 206, 130, 0.28)',
    realBottleImage: REAL_GLASS_BOTTLE_IMAGES.rose,
  },
];

const AURA_COLLECTION_BOTTLE_DATA: FragranceJourneyBottleData[] = [
  {
    slug: 'moksha-essence',
    code: 'A1',
    name: 'MOKSHA ESSENCE',
    tagline: 'Calm. Pure. Centered.',
    description:
      'Calm. Pure. Centered. Crafted with Tulsi, Lemon, and Camphor at the top, a heart of Jasmine, Lotus, and Rose, and a base of Sandalwood, Nagachampa, and Turmeric.',
    topNotes: ['Tulsi', 'Lemon', 'Camphor'],
    heartNotes: ['Jasmine', 'Lotus', 'Rose'],
    baseNotes: ['Sandalwood', 'Nagachampa', 'Turmeric'],
    liquidTopHex: '#F9EDC2',
    liquidMidHex: '#EDD388',
    liquidBottomHex: '#DFBC63',
    capAccentHex: '#C6902E',
    glowRgba: 'rgba(235, 206, 130, 0.28)',
    realBottleImage: REAL_GLASS_15ML_IMAGES.amber,
  },
  {
    slug: 'temple-flora',
    code: 'A2',
    name: 'TEMPLE FLORA',
    tagline: 'Divine. Floral. Uplifting.',
    description:
      'Divine. Floral. Uplifting. Opening with Lily of Valley and Patchouli, unfolding into Mogra, Lotus, and Frangipani, and resting on Javadhu, Wild Lavender, and Royal Rose.',
    topNotes: ['Lily of Valley', 'Patchouli'],
    heartNotes: ['Mogra', 'Lotus', 'Frangipani'],
    baseNotes: ['Javadhu', 'Wild Lavender', 'Royal Rose'],
    liquidTopHex: '#F9EDC2',
    liquidMidHex: '#EDD388',
    liquidBottomHex: '#DFBC63',
    capAccentHex: '#C97A6A',
    glowRgba: 'rgba(235, 206, 130, 0.28)',
    realBottleImage: REAL_GLASS_15ML_IMAGES.rose,
  },
  {
    slug: 'divine-aura',
    code: 'A3',
    name: 'DIVINE AURA',
    tagline: 'Sacred. Soothing. Eternal.',
    description:
      'Sacred. Soothing. Eternal. Crafted with Tulasi, Camphor, and Saffron at the top, a heart of Blue Lotus, Kesar Chandan, Peppermint, and Eucalyptus, and a base of Ylang Ylang and Cardamon.',
    topNotes: ['Tulasi', 'Camphor', 'Saffron'],
    heartNotes: ['Blue Lotus', 'Kesar Chandan', 'Peppermint', 'Eucalyptus'],
    baseNotes: ['Ylang Ylang', 'Cardamon'],
    liquidTopHex: '#F9EDC2',
    liquidMidHex: '#EDD388',
    liquidBottomHex: '#DFBC63',
    capAccentHex: '#B87828',
    glowRgba: 'rgba(235, 206, 130, 0.28)',
    realBottleImage: REAL_GLASS_15ML_IMAGES.oud,
  },
];

export function getBottleDataBySlug(
  slug?: string,
  fallbackName?: string,
  fallbackTagline?: string
): FragranceJourneyBottleData {
  const s = (slug || fallbackName || '').toLowerCase();
  const allApproved = [...FRAGRANCE_JOURNEY_DATA, ...AURA_COLLECTION_BOTTLE_DATA];
  const matched = allApproved.find(
    (item) =>
      s.includes(item.slug) ||
      s.includes(item.name.toLowerCase()) ||
      (item.slug === 'blush-and-blossom' && s.includes('blush'))
  );
  if (matched) {
    return fallbackTagline ? { ...matched, tagline: fallbackTagline } : matched;
  }

  if (s.includes('azure') || s.includes('aqua') || s.includes('ocean')) {
    return {
      ...FRAGRANCE_JOURNEY_DATA[3],
      name: (fallbackName || 'AQUA PULSE').toUpperCase(),
      tagline: fallbackTagline || FRAGRANCE_JOURNEY_DATA[3].tagline,
    };
  }
  if (s.includes('rose') || s.includes('blush') || s.includes('flora') || s.includes('night-bloom') || s.includes('temple')) {
    return {
      ...FRAGRANCE_JOURNEY_DATA[1],
      name: (fallbackName || 'BLUSH & BLOSSOM').toUpperCase(),
      tagline: fallbackTagline || FRAGRANCE_JOURNEY_DATA[1].tagline,
    };
  }
  if (s.includes('violet') || s.includes('noir') || s.includes('midnight') || s.includes('ignite')) {
    return {
      ...FRAGRANCE_JOURNEY_DATA[2],
      name: (fallbackName || 'VIOLET NOIR').toUpperCase(),
      tagline: fallbackTagline || FRAGRANCE_JOURNEY_DATA[2].tagline,
    };
  }
  if (s.includes('luxe') || s.includes('heritage') || s.includes('suede') || s.includes('divine')) {
    return {
      ...FRAGRANCE_JOURNEY_DATA[4],
      name: (fallbackName || 'LUXE HERITAGE').toUpperCase(),
      tagline: fallbackTagline || FRAGRANCE_JOURNEY_DATA[4].tagline,
    };
  }

  return {
    ...FRAGRANCE_JOURNEY_DATA[0],
    name: (fallbackName || FRAGRANCE_JOURNEY_DATA[0].name).toUpperCase(),
    tagline: fallbackTagline || FRAGRANCE_JOURNEY_DATA[0].tagline,
  };
}

export interface ScentPalette {
  id: string;
  liquidTop: string;
  liquidMid: string;
  liquidDeep: string;
  liquidRim: string;
  causticGlow: string;
  capShellBase: string;
  capShellHighlight: string;
  capTortoiseVein: string;
  collarGold: string;
  labelCream: string;
  labelBorder: string;
  mistRgb: string;
  realBottleImage: string;
  realBottle15mlImage: string;
  realVial2mlImage: string;
}

export const SCENT_PALETTES: Record<string, ScentPalette> = {
  amber: {
    id: 'amber',
    liquidTop: '#F9EDC2',
    liquidMid: '#EDD388',
    liquidDeep: '#DFBC63',
    liquidRim: '#FFF6D6',
    causticGlow: 'rgba(235, 206, 130, 0.28)',
    capShellBase: '#060608',
    capShellHighlight: '#2B2B32',
    capTortoiseVein: '#4A4A54',
    collarGold: '#D9B678',
    labelCream: '#F4ECE1',
    labelBorder: '#C7A467',
    mistRgb: '250, 240, 210',
    realBottleImage: REAL_GLASS_BOTTLE_IMAGES.amber,
    realBottle15mlImage: REAL_GLASS_15ML_IMAGES.amber,
    realVial2mlImage: REAL_GLASS_2ML_IMAGES.amber,
  },
  rose: {
    id: 'rose',
    liquidTop: '#F9EDC2',
    liquidMid: '#EDD388',
    liquidDeep: '#DFBC63',
    liquidRim: '#FFF6D6',
    causticGlow: 'rgba(235, 206, 130, 0.28)',
    capShellBase: '#060608',
    capShellHighlight: '#2B2B32',
    capTortoiseVein: '#4A4A54',
    collarGold: '#DEC696',
    labelCream: '#F7EFEA',
    labelBorder: '#CFA396',
    mistRgb: '250, 240, 210',
    realBottleImage: REAL_GLASS_BOTTLE_IMAGES.rose,
    realBottle15mlImage: REAL_GLASS_15ML_IMAGES.rose,
    realVial2mlImage: REAL_GLASS_2ML_IMAGES.rose,
  },
  violet: {
    id: 'violet',
    liquidTop: '#F9EDC2',
    liquidMid: '#EDD388',
    liquidDeep: '#DFBC63',
    liquidRim: '#FFF6D6',
    causticGlow: 'rgba(235, 206, 130, 0.28)',
    capShellBase: '#060608',
    capShellHighlight: '#2B2B32',
    capTortoiseVein: '#4A4A54',
    collarGold: '#D5B887',
    labelCream: '#F3ECEF',
    labelBorder: '#B89E72',
    mistRgb: '250, 240, 210',
    realBottleImage: REAL_GLASS_BOTTLE_IMAGES.violet,
    realBottle15mlImage: REAL_GLASS_15ML_IMAGES.violet,
    realVial2mlImage: REAL_GLASS_2ML_IMAGES.violet,
  },
  aqua: {
    id: 'aqua',
    liquidTop: '#F9EDC2',
    liquidMid: '#EDD388',
    liquidDeep: '#DFBC63',
    liquidRim: '#FFF6D6',
    causticGlow: 'rgba(235, 206, 130, 0.28)',
    capShellBase: '#060608',
    capShellHighlight: '#2B2B32',
    capTortoiseVein: '#4A4A54',
    collarGold: '#DEC696',
    labelCream: '#F2F5F4',
    labelBorder: '#B8B092',
    mistRgb: '250, 240, 210',
    realBottleImage: REAL_GLASS_BOTTLE_IMAGES.aqua,
    realBottle15mlImage: REAL_GLASS_15ML_IMAGES.aqua,
    realVial2mlImage: REAL_GLASS_2ML_IMAGES.aqua,
  },
  oud: {
    id: 'oud',
    liquidTop: '#F9EDC2',
    liquidMid: '#EDD388',
    liquidDeep: '#DFBC63',
    liquidRim: '#FFF6D6',
    causticGlow: 'rgba(235, 206, 130, 0.28)',
    capShellBase: '#060608',
    capShellHighlight: '#2B2B32',
    capTortoiseVein: '#4A4A54',
    collarGold: '#D4AC63',
    labelCream: '#F3E9DA',
    labelBorder: '#C29B56',
    mistRgb: '250, 240, 210',
    realBottleImage: REAL_GLASS_BOTTLE_IMAGES.oud,
    realBottle15mlImage: REAL_GLASS_15ML_IMAGES.oud,
    realVial2mlImage: REAL_GLASS_2ML_IMAGES.oud,
  },
  emerald: {
    id: 'emerald',
    liquidTop: '#F9EDC2',
    liquidMid: '#EDD388',
    liquidDeep: '#DFBC63',
    liquidRim: '#FFF6D6',
    causticGlow: 'rgba(235, 206, 130, 0.28)',
    capShellBase: '#060608',
    capShellHighlight: '#2B2B32',
    capTortoiseVein: '#4A4A54',
    collarGold: '#D8BA7E',
    labelCream: '#F2F4EF',
    labelBorder: '#B7AB83',
    mistRgb: '250, 240, 210',
    realBottleImage: REAL_GLASS_BOTTLE_IMAGES.emerald,
    realBottle15mlImage: REAL_GLASS_15ML_IMAGES.emerald,
    realVial2mlImage: REAL_GLASS_2ML_IMAGES.emerald,
  },
};

export function getScentPalette(slugOrName?: string): ScentPalette {
  const s = (slugOrName || '').toLowerCase();
  if (s.includes('blush') || s.includes('rose') || s.includes('roselle') || s.includes('flora') || s.includes('night-bloom') || s.includes('temple')) {
    return SCENT_PALETTES.rose;
  }
  if (s.includes('violet') || s.includes('noir') || s.includes('midnight')) {
    return SCENT_PALETTES.violet;
  }
  if (s.includes('aqua') || s.includes('azure') || s.includes('pulse') || s.includes('marine') || s.includes('ocean')) {
    return SCENT_PALETTES.aqua;
  }
  if (s.includes('luxe') || s.includes('heritage') || s.includes('oud') || s.includes('suede') || s.includes('ignite') || s.includes('divine')) {
    return SCENT_PALETTES.oud;
  }
  return SCENT_PALETTES.amber;
}

export interface FragmoreBottleVisualProps {
  slug?: string;
  name?: string;
  productName?: string;
  productTagline?: string;
  collection?: string;
  subtitle?: string;
  volume?: string;
  size?: string;
  variant?: 'hero' | 'card' | 'detail' | 'mini' | 'vial' | 'coffret' | { size?: string; [key: string]: any };
  interactive?: boolean;
  enableParallax?: boolean;
  showGlow?: boolean;
  showShadow?: boolean;
  showReflections?: boolean;
  darkSurface?: boolean;
  selectedDiscoverySlugs?: string[];
  sprayTriggerCount?: number;
  onSprayStateChange?: (isSpraying: boolean) => void;
  externalPointerOffset?: { x: number; y: number };
  className?: string;
  onSpray?: () => void;
}

interface MistParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  decay: number;
}

const DISCOVERY_COFFRET_BOTTLES = [
  { slug: 'golden-hour', code: '01', name: 'GOLDEN HOUR', img: REAL_GLASS_2ML_IMAGES.amber, note: 'Golden Warm' },
  { slug: 'blush-and-blossom', code: '02', name: 'BLUSH & BLOSSOM', img: REAL_GLASS_2ML_IMAGES.rose, note: 'Sparkling Rose' },
  { slug: 'violet-noir', code: '03', name: 'VIOLET NOIR', img: REAL_GLASS_2ML_IMAGES.violet, note: 'Warm Leather' },
  { slug: 'aqua-pulse', code: '04', name: 'AQUA PULSE', img: REAL_GLASS_2ML_IMAGES.aqua, note: 'Fresh Citrus' },
  { slug: 'luxe-heritage', code: '05', name: 'LUXE HERITAGE', img: REAL_GLASS_2ML_IMAGES.oud, note: 'Saffron Wood' },
  { slug: 'night-bloom', code: '09', name: 'NIGHT BLOOM', img: REAL_GLASS_2ML_IMAGES.rose, note: 'Blush Peony' },
];

export const FragmoreBottleVisual: React.FC<FragmoreBottleVisualProps> = ({
  slug,
  name,
  productName,
  productTagline,
  collection,
  subtitle = 'EAU DE PARFUM',
  volume,
  size = 'md',
  variant = 'card',
  interactive = false,
  showGlow = true,
  showShadow = true,
  selectedDiscoverySlugs,
  sprayTriggerCount,
  onSprayStateChange,
  className = '',
  onSpray,
}) => {
  const effectiveName = name || productName;
  const bottleData = getBottleDataBySlug(slug, effectiveName, productTagline);
  const palette = getScentPalette(slug || effectiveName || bottleData.slug);
  const [isHovered, setIsHovered] = useState(false);
  const [isSpraying, setIsSpraying] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const nozzleRef = useRef<HTMLDivElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const prevSprayCountRef = useRef<number>(sprayTriggerCount || 0);

  const variantSizeStr =
    typeof variant === 'object' && variant !== null && typeof variant.size === 'string'
      ? variant.size
      : '';
  const variantMode = typeof variant === 'string' ? variant : 'card';

  const normalizedSize = (size !== 'md' ? size : variantSizeStr || size || '').toLowerCase().trim();

  const displayTitle = (effectiveName || bottleData.name || 'GOLDEN HOUR')
    .replace(/^fragmor[eé]\s+/i, '')
    .toUpperCase();

  const slugLower = (slug || '').toLowerCase();
  const collectionLower = (collection || '').toLowerCase();

  const isCoffret =
    variantMode === 'coffret' ||
    normalizedSize.includes('6') ||
    slugLower.includes('discovery') ||
    displayTitle.includes('DISCOVERY');

  const isSmallVial =
    !isCoffret &&
    (variantMode === 'vial' || normalizedSize === '2 ml' || normalizedSize === '2ml');

  const isAura15ml =
    !isCoffret &&
    !isSmallVial &&
    (normalizedSize === '15 ml' ||
      normalizedSize === '15ml' ||
      collectionLower.includes('aura') ||
      collectionLower.includes('devotional') ||
      slugLower.includes('moksha-essence') ||
      slugLower.includes('temple-flora') ||
      slugLower.includes('divine-aura') ||
      displayTitle === 'MOKSHA ESSENCE' ||
      displayTitle === 'TEMPLE FLORA' ||
      displayTitle === 'DIVINE AURA');

  const is30mlBottle =
    !isCoffret &&
    !isSmallVial &&
    !isAura15ml &&
    (normalizedSize === '30 ml' || normalizedSize === '30ml');

  const resolvedVolume =
    volume ||
    variantSizeStr ||
    (normalizedSize.includes('ml')
      ? size
      : isSmallVial
      ? '2 ml'
      : isAura15ml
      ? '15 ml'
      : isCoffret
      ? '6 × 2 ml'
      : '50 ml');

  const triggerMistBurst = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }

    setIsSpraying(true);
    if (onSprayStateChange) onSprayStateChange(true);
    if (onSpray) onSpray();

    const w = canvas.width;
    const h = canvas.height;

    // The sprayer nozzle is revealed at the neck of the bottle when the cap opens.
    // Calculate the exact position of the sprayer nozzle orifice so the spray emanates directly from it.
    const canvasRect = canvas.getBoundingClientRect();
    const nozzleEl = nozzleRef.current;
    const nozzleRect = nozzleEl ? nozzleEl.getBoundingClientRect() : null;

    let originX = w * 0.507;
    // Default fallback based on bottle geometry if DOM rect is not yet measured
    let originY = h * (isSmallVial ? 0.385 : isAura15ml ? 0.405 : 0.388);

    if (nozzleRect && canvasRect.width > 0 && canvasRect.height > 0) {
      const scaleX = w / canvasRect.width;
      const scaleY = h / canvasRect.height;
      originX = (nozzleRect.left + nozzleRect.width * 0.5 - canvasRect.left) * scaleX;
      // The orifice hole is located in the upper portion of the sprayer nozzle head
      originY = (nozzleRect.top + nozzleRect.height * 0.36 - canvasRect.top) * scaleY;
    }

    const particles: MistParticle[] = Array.from({ length: 86 }, (_, i) => {
      // Realistic atomizer plume spraying upward and fanning outward from the sprayer nozzle orifice
      const spread = (Math.random() - 0.5) * 1.32; // ~75 degree spray cone
      const angle = -Math.PI / 2 + spread;
      const speed = 2.0 + Math.random() * 4.4;
      const isFineDroplet = i % 3 === 0;

      return {
        x: originX + (Math.random() - 0.5) * 4,
        y: originY + (Math.random() - 0.5) * 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.38,
        radius: isFineDroplet ? 1.5 + Math.random() * 2.0 : 2.4 + Math.random() * 4.6,
        alpha: 0.72 + Math.random() * 0.28,
        decay: isFineDroplet ? 0.009 + Math.random() * 0.010 : 0.012 + Math.random() * 0.013,
      };
    });

    const renderFrame = () => {
      ctx.clearRect(0, 0, w, h);
      let alive = false;
      for (const p of particles) {
        if (p.alpha <= 0) continue;
        alive = true;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.982;
        p.vy *= 0.976;
        p.vy -= 0.018; // gentle atmospheric buoyancy of fine perfume vapor
        p.radius += 0.15; // natural vapor cloud expansion
        p.alpha -= p.decay;

        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * 2.4);
        grad.addColorStop(0, `rgba(255, 252, 245, ${Math.max(0, p.alpha)})`);
        grad.addColorStop(0.46, `rgba(${palette.mistRgb}, ${Math.max(0, p.alpha * 0.72)})`);
        grad.addColorStop(1, `rgba(${palette.mistRgb}, 0)`);

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 2.4, 0, Math.PI * 2);
        ctx.fill();
      }

      if (alive) {
        animFrameRef.current = requestAnimationFrame(renderFrame);
      } else {
        ctx.clearRect(0, 0, w, h);
        setIsSpraying(false);
        if (onSprayStateChange) onSprayStateChange(false);
      }
    };

    animFrameRef.current = requestAnimationFrame(renderFrame);
  }, [palette.mistRgb, isSmallVial, isAura15ml, onSpray, onSprayStateChange]);

  useEffect(() => {
    if (
      typeof sprayTriggerCount === 'number' &&
      sprayTriggerCount > prevSprayCountRef.current
    ) {
      prevSprayCountRef.current = sprayTriggerCount;
      triggerMistBurst();
    }
  }, [sprayTriggerCount, triggerMistBurst]);

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const sizeContainerClasses: Record<string, string> = {
    xs: 'h-24',
    sm: 'h-44',
    md: 'h-64',
    lg: 'h-80',
    xl: 'h-[430px]',
    hero: 'h-[470px] sm:h-[530px]',
  };

  const hasCustomSizeClasses = /\b(h-|w-|size-)/.test(className);
  const containerSizeClass =
    sizeContainerClasses[normalizedSize] || (hasCustomSizeClasses ? '' : 'w-full h-full');

  // 6 × 2 ml Discovery Six Coffret using dedicated 2 ml real glass sample vials
  if (isCoffret) {
    const coffretItems =
      selectedDiscoverySlugs && selectedDiscoverySlugs.length > 0
        ? Array.from({ length: 6 }, (_, idx) => {
            const slugItem = selectedDiscoverySlugs[idx];
            if (!slugItem) return null;
            const bData = getBottleDataBySlug(slugItem, slugItem);
            const bPalette = getScentPalette(slugItem);
            return {
              code: bData.code || `0${idx + 1}`,
              name: bData.name,
              img: bPalette.realVial2mlImage,
            };
          })
        : DISCOVERY_COFFRET_BOTTLES;

    return (
      <div
        className={`relative flex flex-col items-center justify-center select-none ${containerSizeClass} ${className}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {showGlow && (
          <div
            className="pointer-events-none absolute inset-0 rounded-full blur-3xl transition-opacity duration-700"
            style={{
              background: `radial-gradient(circle, ${palette.causticGlow} 0%, transparent 70%)`,
              opacity: isHovered ? 0.9 : 0.55,
            }}
          />
        )}

        <div className="relative z-10 w-full max-w-[420px] rounded-2xl border border-[#C5A059]/35 bg-gradient-to-b from-[#FAF6EE] via-[#F3ECE0] to-[#EAE0D0] p-3.5 sm:p-4 shadow-[0_24px_50px_-18px_rgba(24,18,12,0.28)]">
          <div className="mb-2.5 flex items-center justify-between border-b border-[#C5A059]/25 pb-2">
            <div>
              <p className="font-serif text-xs sm:text-sm tracking-[0.26em] text-[#1A1614] font-semibold">
                FRAGMORÉ
              </p>
              <p className="text-[9px] tracking-[0.22em] uppercase text-[#7A6B58]">
                {collection || 'Coffret Découverte · 6 × 2 ml Sample Vials'}
              </p>
            </div>
            <span className="text-[10px] font-mono tracking-[0.14em] text-[#9A7432] uppercase">
              6 × 2 ml
            </span>
          </div>

          <div className="grid grid-cols-6 gap-1.5 sm:gap-2 items-end pt-1">
            {coffretItems.map((item, idx) =>
              item ? (
                <div
                  key={`${item.code}-${idx}`}
                  className="group/vial flex flex-col items-center rounded-lg bg-[#FDFBF7]/95 border border-[#E5DAC8] px-1 pt-1.5 pb-1.5 shadow-sm transition-transform duration-300 hover:-translate-y-1"
                >
                  <div className="relative aspect-[1084/1451] w-full overflow-hidden">
                    <img
                      src={item.img}
                      alt={`FRAGMORÉ ${item.name} 2 ml Vial`}
                      width={1084}
                      height={1451}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-contain drop-shadow-[0_6px_10px_rgba(20,15,10,0.18)]"
                    />
                    {/* Coordinate-Locked 2ml Vial Label Overlay inside each Coffret Vial */}
                    <svg
                      viewBox="0 0 1084 1451"
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 h-full w-full mix-blend-multiply"
                    >
                      <text
                        x="542"
                        y="776"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#161210"
                        fillOpacity="0.95"
                        fontSize="21"
                        fontWeight="700"
                        letterSpacing="0.06em"
                        style={{
                          fontFamily: "'Cormorant Garamond', 'Playfair Display', Georgia, serif",
                        }}
                      >
                        FRAGMORÉ
                        <tspan baselineShift="super" fontSize="11">
                          ®
                        </tspan>
                      </text>
                      <text
                        x="542"
                        y="814"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#2A231E"
                        fillOpacity="0.85"
                        fontSize="9.5"
                        fontWeight="600"
                        letterSpacing="0.16em"
                        style={{
                          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                        }}
                      >
                        EAU DE PARFUM
                      </text>
                      <line
                        x1="484"
                        y1="858"
                        x2="600"
                        y2="858"
                        stroke="#241E1A"
                        strokeOpacity="0.28"
                        strokeWidth="1.5"
                      />
                      <text
                        x="542"
                        y="936"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#181412"
                        fillOpacity="0.95"
                        fontSize="14.5"
                        fontWeight="700"
                        letterSpacing="0.05em"
                        textLength={item.name.length > 11 ? 152 : undefined}
                        lengthAdjust={item.name.length > 11 ? 'spacingAndGlyphs' : undefined}
                        style={{
                          fontFamily: "'Cormorant Garamond', 'Playfair Display', Georgia, serif",
                        }}
                      >
                        {item.name}
                      </text>
                      <text
                        x="542"
                        y="1042"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#241E1B"
                        fillOpacity="0.88"
                        fontSize="18"
                        fontWeight="600"
                        letterSpacing="0.08em"
                        style={{
                          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                        }}
                      >
                        2 ml
                      </text>
                    </svg>
                  </div>
                  <span className="mt-1 text-[7px] font-mono tracking-widest text-[#8C7A65]">
                    {item.code} · 2 ML
                  </span>
                  <span className="text-[7px] font-serif font-semibold tracking-wider text-[#1F1A16] truncate max-w-full">
                    {item.name.split(' ')[0]}
                  </span>
                </div>
              ) : (
                <div
                  key={`empty-${idx}`}
                  className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#C5A059]/45 bg-[#FAF6EE]/60 px-1 py-6 text-center"
                >
                  <span className="text-[9px] font-mono text-[#9A7432]">+{idx + 1}</span>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    );
  }

  // Select the exact real glass bottle image & cap geometry for 2ml Vial, 15ml Aura Bottle, or 30ml/50ml Signature Bottle
  const activeBottleImage = isSmallVial
    ? palette.realVial2mlImage
    : isAura15ml
    ? palette.realBottle15mlImage
    : palette.realBottleImage;

  const capBottomPercent = isSmallVial ? 30.2 : isAura15ml ? 32.05 : 29.75;
  // Precise collar-anchored calculation: nozzle base sits flush on the bottle collar with zero gap
  const nozzleHeightVal = isSmallVial ? 4.0 : 4.4;
  const nozzleTopPercent = `${capBottomPercent - nozzleHeightVal}%`;
  const nozzleHeightPercent = `${nozzleHeightVal}%`;

  const bottleScaleClass = is30mlBottle ? 'scale-[0.94]' : 'scale-100';

  const titleLength = displayTitle.length;

  return (
    <div
      className={`relative flex items-center justify-center select-none ${containerSizeClass} ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Ambient Optical Caustic Glow behind the Real Glass Bottle */}
      {showGlow && (
        <div
          className="pointer-events-none absolute inset-0 rounded-full blur-3xl transition-opacity duration-700"
          style={{
            background: `radial-gradient(circle at 50% 50%, ${palette.causticGlow} 0%, transparent 68%)`,
            opacity: isHovered || isSpraying ? 0.95 : 0.6,
          }}
        />
      )}

      {/* Studio Pedestal Contact Shadow */}
      {showShadow && (
        <div
          className="pointer-events-none absolute bottom-[3%] left-1/2 -translate-x-1/2 w-[56%] h-[6%] rounded-full blur-md transition-all duration-500"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(24, 16, 10, 0.34) 0%, rgba(24, 16, 10, 0.12) 55%, transparent 80%)',
            transform: `translateX(-50%) scale(${isHovered ? 0.94 : 1})`,
          }}
        />
      )}

      {/* Exact 1084:1451 Aspect Wrapper so paper label typography locks 1:1 to the real glass bottle */}
      <motion.div
        whileHover={interactive ? { y: -4 } : undefined}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        onClick={interactive ? triggerMistBurst : undefined}
        className={`relative z-10 h-full max-h-full aspect-[1084/1451] flex items-center justify-center ${bottleScaleClass} ${
          interactive ? 'cursor-pointer' : ''
        }`}
      >
        {/* Atomizer Mist Canvas Overlay - Positioned over the sprayer nozzle and above the bottle */}
        <canvas
          ref={canvasRef}
          width={420}
          height={560}
          className="pointer-events-none absolute -top-[25%] -bottom-[5%] -left-[15%] -right-[15%] z-40 w-[130%] h-[130%]"
        />

        {/* Layer 1: Real Glass Bottle Body & Collar (in normal flow so aspect box always has intrinsic dimensions) */}
        <img
          src={activeBottleImage}
          alt={`FRAGMORÉ ${displayTitle} ${resolvedVolume} Real Glass Flacon`}
          width={1084}
          height={1451}
          referrerPolicy="no-referrer"
          draggable={false}
          className="pointer-events-none relative z-10 h-full w-full object-contain drop-shadow-[0_18px_32px_rgba(24,16,10,0.22)]"
          style={{
            clipPath: `inset(${capBottomPercent}% 0 0 0)`,
          }}
        />

        {/* Layer 2: Brushed Champagne-Gold Atomizer Nozzle (positioned flush on bottle collar, shifted slightly right) */}
        <div
          ref={nozzleRef}
          className="pointer-events-none absolute z-15 flex flex-col items-center transition-all duration-300"
          style={{
            left: '50.7%',
            top: nozzleTopPercent,
            width: isSmallVial ? '6.4%' : isAura15ml ? '7.5%' : '8.6%',
            height: nozzleHeightPercent,
            transform: `translateX(-50%) translateY(${isSpraying ? '6%' : '0%'})`,
          }}
        >
          {/* Actuator Head with Centered Spray Nozzle Orifice */}
          <div className="relative w-full h-[72%] rounded-t-[3px] bg-gradient-to-r from-[#7D5C28] via-[#E8CD94] to-[#8C6730] border border-[#725221]/45 shadow-sm flex items-center justify-center">
            {/* Fine metallic brushed top highlight */}
            <div className="absolute inset-x-1 top-0.5 h-[1.5px] bg-white/45 rounded-full" />
            {/* Spray Nozzle Orifice - Centered in the middle */}
            <div className="relative w-[26%] h-[34%] rounded-full bg-[#18120A] border border-[#4A381C] flex items-center justify-center shadow-inner">
              <div className="w-[45%] h-[45%] rounded-full bg-[#050403]" />
            </div>
          </div>
          {/* Metallic Collar Ring seamlessly resting on bottle collar */}
          <div className="w-[82%] h-[28%] bg-gradient-to-r from-[#6E4F20] via-[#DDBE83] to-[#755523] border-x border-[#5A401A]/40" />
        </div>

        {/* Layer 3: Real Cap — lifts straight up smoothly in the middle when spraying */}
        <img
          src={activeBottleImage}
          alt=""
          aria-hidden="true"
          referrerPolicy="no-referrer"
          draggable={false}
          className="pointer-events-none absolute inset-0 z-20 h-full w-full object-contain transition-transform duration-500 ease-out"
          style={{
            clipPath: `inset(0 0 ${100 - capBottomPercent - 0.1}% 0)`,
            transform: isSpraying
              ? 'translateY(-14%)'
              : isHovered && interactive
              ? 'translateY(-1.8%)'
              : 'translateY(0%)',
          }}
        />

        {/* Layer 4: Coordinate-Locked 1084×1451 SVG Label Typography — Fits Strictly Inside the Cream Paper Label */}
        {isSmallVial ? (
          /* 2 ml Discovery Sample Vial Label Geometry (x: 452..632, width: 180, centerX: 542) */
          <svg
            viewBox="0 0 1084 1451"
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-20 h-full w-full mix-blend-multiply"
          >
            <text
              x="542"
              y="776"
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#161210"
              fillOpacity="0.94"
              fontSize="21.5"
              fontWeight="600"
              letterSpacing="0.06em"
              style={{
                fontFamily: "'Cormorant Garamond', 'Playfair Display', Georgia, serif",
              }}
            >
              FRAGMORÉ
              <tspan baselineShift="super" fontSize="11">
                ®
              </tspan>
            </text>
            <text
              x="542"
              y="814"
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#2A231E"
              fillOpacity="0.82"
              fontSize="9.5"
              fontWeight="600"
              letterSpacing="0.18em"
              style={{
                fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
              }}
            >
              {subtitle}
            </text>
            <line
              x1="484"
              y1="858"
              x2="600"
              y2="858"
              stroke="#241E1A"
              strokeOpacity="0.24"
              strokeWidth="1.4"
            />
            <text
              x="542"
              y="936"
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#181412"
              fillOpacity="0.94"
              fontSize={titleLength > 13 ? 13 : titleLength > 10 ? 14.5 : 16}
              fontWeight="600"
              letterSpacing={titleLength > 12 ? '0.04em' : '0.08em'}
              textLength={titleLength > 11 ? 154 : undefined}
              lengthAdjust={titleLength > 11 ? 'spacingAndGlyphs' : undefined}
              style={{
                fontFamily: "'Cormorant Garamond', 'Playfair Display', Georgia, serif",
              }}
            >
              {displayTitle}
            </text>
            <text
              x="542"
              y="1042"
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#241E1B"
              fillOpacity="0.85"
              fontSize="17.5"
              fontWeight="500"
              letterSpacing="0.08em"
              style={{
                fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
              }}
            >
              {resolvedVolume}
            </text>
          </svg>
        ) : isAura15ml ? (
          /* 15 ml Aura Collection Cylindrical Flacon Label Geometry (x: 410..674, width: 264, centerX: 542) */
          <svg
            viewBox="0 0 1084 1451"
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-20 h-full w-full mix-blend-multiply"
          >
            <text
              x="542"
              y="788"
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#161210"
              fillOpacity="0.93"
              fontSize="30.5"
              fontWeight="600"
              letterSpacing="0.07em"
              style={{
                fontFamily: "'Cormorant Garamond', 'Playfair Display', Georgia, serif",
              }}
            >
              FRAGMORÉ
              <tspan baselineShift="super" fontSize="14">
                ®
              </tspan>
            </text>
            <text
              x="542"
              y="832"
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#2A231E"
              fillOpacity="0.82"
              fontSize="12.5"
              fontWeight="600"
              letterSpacing="0.24em"
              style={{
                fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
              }}
            >
              {subtitle}
            </text>
            <line
              x1="464"
              y1="882"
              x2="620"
              y2="882"
              stroke="#241E1A"
              strokeOpacity="0.24"
              strokeWidth="1.5"
            />
            <text
              x="542"
              y="958"
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#181412"
              fillOpacity="0.93"
              fontSize={titleLength > 13 ? 19 : titleLength > 11 ? 21 : 23}
              fontWeight="600"
              letterSpacing={titleLength > 13 ? '0.06em' : '0.1em'}
              textLength={titleLength > 12 ? 226 : undefined}
              lengthAdjust={titleLength > 12 ? 'spacingAndGlyphs' : undefined}
              style={{
                fontFamily: "'Cormorant Garamond', 'Playfair Display', Georgia, serif",
              }}
            >
              {displayTitle}
            </text>
            <text
              x="542"
              y="1062"
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#241E1B"
              fillOpacity="0.84"
              fontSize="21"
              fontWeight="500"
              letterSpacing="0.1em"
              style={{
                fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
              }}
            >
              {resolvedVolume}
            </text>
          </svg>
        ) : (
          /* 50 ml / 30 ml Signature Spherical-Cap Flacon Label Geometry (x: 348..736, width: 388, centerX: 542) */
          <svg
            viewBox="0 0 1084 1451"
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-20 h-full w-full mix-blend-multiply"
          >
            <text
              x="542"
              y="795"
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#161210"
              fillOpacity="0.93"
              fontSize="43"
              fontWeight="600"
              letterSpacing="0.08em"
              style={{
                fontFamily: "'Cormorant Garamond', 'Playfair Display', Georgia, serif",
              }}
            >
              FRAGMORÉ
              <tspan baselineShift="super" fontSize="18">
                ®
              </tspan>
            </text>
            <text
              x="542"
              y="844"
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#2A231E"
              fillOpacity="0.82"
              fontSize="16.5"
              fontWeight="600"
              letterSpacing="0.28em"
              style={{
                fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
              }}
            >
              {subtitle}
            </text>
            <line
              x1="452"
              y1="898"
              x2="632"
              y2="898"
              stroke="#241E1A"
              strokeOpacity="0.22"
              strokeWidth="1.5"
            />
            <text
              x="542"
              y="976"
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#181412"
              fillOpacity="0.93"
              fontSize={titleLength > 13 ? 25 : titleLength > 11 ? 27.5 : 30}
              fontWeight="600"
              letterSpacing={titleLength > 13 ? '0.07em' : titleLength > 11 ? '0.11em' : '0.14em'}
              textLength={titleLength > 13 ? 304 : undefined}
              lengthAdjust={titleLength > 13 ? 'spacingAndGlyphs' : undefined}
              style={{
                fontFamily: "'Cormorant Garamond', 'Playfair Display', Georgia, serif",
              }}
            >
              {displayTitle}
            </text>
            <text
              x="542"
              y="1078"
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#241E1B"
              fillOpacity="0.84"
              fontSize="23"
              fontWeight="500"
              letterSpacing="0.1em"
              style={{
                fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
              }}
            >
              {resolvedVolume}
            </text>
          </svg>
        )}
      </motion.div>
    </div>
  );
};

export default FragmoreBottleVisual;
