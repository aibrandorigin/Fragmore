import type { NoteMediaConfig } from '../types/index.ts';

export interface IngredientMediaEntry {
  key: string;
  label: string;
  alt: string;
  imageUrl: string;
  fallbackDataUri: string;
  isAbstractAccord: boolean;
  accentColor: string;
  subtitle?: string;
}

/**
 * Generates a vibrant, studio-lit SVG data URI as an instant poster / offline fallback
 * so ingredient tiles never break or cause layout shifts.
 */
function makeBotanicalSvgDataUri(
  title: string,
  primaryHex: string,
  secondaryHex: string,
  isAbstract: boolean
): string {
  const safeTitle = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const svg = isAbstract
    ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
        <defs>
          <radialGradient id="g" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stop-color="${primaryHex}" stop-opacity="0.95"/>
            <stop offset="55%" stop-color="${secondaryHex}" stop-opacity="0.88"/>
            <stop offset="100%" stop-color="#1E1B18" stop-opacity="1"/>
          </radialGradient>
        </defs>
        <rect width="160" height="160" rx="18" fill="url(#g)"/>
        <circle cx="80" cy="70" r="42" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="1.2" stroke-dasharray="3 3"/>
        <path d="M36 104 Q80 62 124 104" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="1.8"/>
        <text x="80" y="138" text-anchor="middle" fill="#FFFFFF" font-family="Georgia, serif" font-size="10" letter-spacing="1.5">ACCORD</text>
      </svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
        <defs>
          <radialGradient id="bg" cx="32%" cy="28%" r="78%">
            <stop offset="0%" stop-color="${primaryHex}"/>
            <stop offset="68%" stop-color="${secondaryHex}"/>
            <stop offset="100%" stop-color="#1C1916"/>
          </radialGradient>
          <linearGradient id="leaf" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.82"/>
            <stop offset="100%" stop-color="${primaryHex}" stop-opacity="0.45"/>
          </linearGradient>
        </defs>
        <rect width="160" height="160" rx="18" fill="url(#bg)"/>
        <circle cx="80" cy="74" r="38" fill="url(#leaf)" opacity="0.55"/>
        <path d="M80 34 C104 52 108 86 80 112 C52 86 56 52 80 34 Z" fill="url(#leaf)"/>
        <path d="M80 42 L80 106" stroke="rgba(255,255,255,0.65)" stroke-width="1.5" stroke-linecap="round"/>
        <text x="80" y="140" text-anchor="middle" fill="#FFFFFF" font-family="sans-serif" font-size="9.5" font-weight="600" letter-spacing="1">${safeTitle.slice(0, 16).toUpperCase()}</text>
      </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

interface RawCatalogEntry {
  label: string;
  alt: string;
  imageUrl: string;
  primaryHex: string;
  secondaryHex: string;
  isAbstractAccord: boolean;
  subtitle?: string;
}

const RAW_INGREDIENT_MAP: Record<string, RawCatalogEntry> = {
  // ============================================================================
  // ABSTRACT ACCORDS (Clearly marked mood illustrations — no invented ingredient)
  // ============================================================================
  'golden hour': {
    label: 'Golden Hour',
    alt: 'Warm golden sunset light atmospheric accord',
    imageUrl: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#F59E0B',
    secondaryHex: '#92400E',
    isAbstractAccord: true,
    subtitle: 'Luminous Sunset Accord'
  },
  'musky warm sunset': {
    label: 'Musky Warm Sunset',
    alt: 'Warm amber twilight horizon mood illustration',
    imageUrl: 'https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#D97706',
    secondaryHex: '#78350F',
    isAbstractAccord: true,
    subtitle: 'Radiant Horizon Accord'
  },
  'chic florals': {
    label: 'Chic Florals',
    alt: 'Soft pastel floral bouquet accord',
    imageUrl: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#F472B6',
    secondaryHex: '#9D174D',
    isAbstractAccord: true,
    subtitle: 'Bouquet Accord'
  },
  'woody petrol-edge': {
    label: 'Woody Petrol-Edge',
    alt: 'Dark charred timber and mineral nocturnal accord',
    imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#7C3AED',
    secondaryHex: '#312E81',
    isAbstractAccord: true,
    subtitle: 'Mineral Wood Accord'
  },
  'smoky richness': {
    label: 'Smoky Richness',
    alt: 'Warm aromatic incense and resinous smoke accord',
    imageUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#B45309',
    secondaryHex: '#451A03',
    isAbstractAccord: true,
    subtitle: 'Deep Resinous Accord'
  },
  'timeless powdery florals': {
    label: 'Timeless Powdery Florals',
    alt: 'Soft ivory silk and powdery petal accord',
    imageUrl: 'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#E5C378',
    secondaryHex: '#854D0E',
    isAbstractAccord: true,
    subtitle: 'Velvet Powder Accord'
  },
  'blush floral accord': {
    label: 'Blush Floral Accord',
    alt: 'Dewy pink evening petals floral accord',
    imageUrl: 'https://images.unsplash.com/photo-1519378058457-4c29a0a2efac?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#EC4899',
    secondaryHex: '#831843',
    isAbstractAccord: true,
    subtitle: 'Blush Petal Accord'
  },
  'sweet florals': {
    label: 'Sweet Florals',
    alt: 'Nectar-rich blooming petals accord',
    imageUrl: 'https://images.unsplash.com/photo-1468327768560-75b778cbb551?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#E879F9',
    secondaryHex: '#701A75',
    isAbstractAccord: true,
    subtitle: 'Nectar Floral Accord'
  },

  // ============================================================================
  // ACTUAL BOTANICAL & OLFACTORY INGREDIENTS (Vibrant Ingredient Photography)
  // ============================================================================
  citrus: {
    label: 'Citrus',
    alt: 'Fresh sun-ripened citrus slices with zest droplets',
    imageUrl: 'https://images.unsplash.com/photo-1590502593747-42a996133562?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#F59E0B',
    secondaryHex: '#B45309',
    isAbstractAccord: false
  },
  pear: {
    label: 'Pear',
    alt: 'Crisp golden orchard pear fruit',
    imageUrl: 'https://images.unsplash.com/photo-1514756331096-242fdeb70d4a?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#A3E635',
    secondaryHex: '#4D7C0F',
    isAbstractAccord: false
  },
  amber: {
    label: 'Amber',
    alt: 'Translucent golden amber resin crystals',
    imageUrl: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#D97706',
    secondaryHex: '#78350F',
    isAbstractAccord: false
  },
  vanilla: {
    label: 'Vanilla',
    alt: 'Cured Madagascar vanilla pods and orchid flower',
    imageUrl: 'https://images.unsplash.com/photo-1606923829579-0cb981a83e2e?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#D99B26',
    secondaryHex: '#713F12',
    isAbstractAccord: false
  },
  'cozy vanilla': {
    label: 'Cozy Vanilla',
    alt: 'Warm cured vanilla bean pods',
    imageUrl: 'https://images.unsplash.com/photo-1606923829579-0cb981a83e2e?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#D99B26',
    secondaryHex: '#713F12',
    isAbstractAccord: false
  },
  'warm vanilla': {
    label: 'Warm Vanilla',
    alt: 'Aromatic dark vanilla beans',
    imageUrl: 'https://images.unsplash.com/photo-1606923829579-0cb981a83e2e?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#D99B26',
    secondaryHex: '#713F12',
    isAbstractAccord: false
  },
  'soft woods': {
    label: 'Soft Woods',
    alt: 'Smooth blonde aromatic heartwood shavings',
    imageUrl: 'https://images.unsplash.com/photo-1546484396-fb3fc6f95f98?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#B45309',
    secondaryHex: '#57534E',
    isAbstractAccord: false
  },
  'warm wood': {
    label: 'Warm Wood',
    alt: 'Richly grained warm aromatic heartwood',
    imageUrl: 'https://images.unsplash.com/photo-1546484396-fb3fc6f95f98?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#9A3412',
    secondaryHex: '#431407',
    isAbstractAccord: false
  },
  'sparkling rose': {
    label: 'Sparkling Rose',
    alt: 'Dew-kissed pink Damask rose petals in bloom',
    imageUrl: 'https://images.unsplash.com/photo-1496062031456-07b8f162a322?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#F43F5E',
    secondaryHex: '#9F1239',
    isAbstractAccord: false
  },
  rose: {
    label: 'Rose',
    alt: 'Fresh velvety crimson rose blossom',
    imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#E11D48',
    secondaryHex: '#881337',
    isAbstractAccord: false
  },
  'dark rose': {
    label: 'Dark Rose',
    alt: 'Deep burgundy velvet rose petals',
    imageUrl: 'https://images.unsplash.com/photo-1548460464-2a68877c7a5f?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#9F1239',
    secondaryHex: '#4C0519',
    isAbstractAccord: false
  },
  'royal rose': {
    label: 'Royal Rose',
    alt: 'Lush Indian Kannauj rose petals',
    imageUrl: 'https://images.unsplash.com/photo-1496062031456-07b8f162a322?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#E11D48',
    secondaryHex: '#881337',
    isAbstractAccord: false
  },
  'orange blossom': {
    label: 'Orange Blossom',
    alt: 'Fragrant white orange tree blossoms with green leaves',
    imageUrl: 'https://images.unsplash.com/photo-1589216532372-1c2a367900d9?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#FB923C',
    secondaryHex: '#9A3412',
    isAbstractAccord: false
  },
  patchouli: {
    label: 'Patchouli',
    alt: 'Aromatic green patchouli botanical leaves',
    imageUrl: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#15803D',
    secondaryHex: '#14532D',
    isAbstractAccord: false
  },
  'violet leaf': {
    label: 'Violet Leaf',
    alt: 'Deep violet botanical leaves and blossoms',
    imageUrl: 'https://images.unsplash.com/photo-1534710961216-75c88202f43e?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#8B5CF6',
    secondaryHex: '#4C1D95',
    isAbstractAccord: false
  },
  nutmeg: {
    label: 'Nutmeg',
    alt: 'Whole grated aromatic nutmeg spice seeds',
    imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#B45309',
    secondaryHex: '#78350F',
    isAbstractAccord: false
  },
  'warm leather': {
    label: 'Warm Leather',
    alt: 'Supple hand-burnished saddle leather texture',
    imageUrl: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#92400E',
    secondaryHex: '#451A03',
    isAbstractAccord: false
  },
  'rich leather': {
    label: 'Rich Leather',
    alt: 'Deep artisanal grain leather hide',
    imageUrl: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#78350F',
    secondaryHex: '#291305',
    isAbstractAccord: false
  },
  'fresh grapefruit': {
    label: 'Fresh Grapefruit',
    alt: 'Ruby pink grapefruit cut in half with juicy segments',
    imageUrl: 'https://images.unsplash.com/photo-1577234286642-fc512a5f8f11?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#FB7185',
    secondaryHex: '#EA580C',
    isAbstractAccord: false
  },
  mint: {
    label: 'Mint',
    alt: 'Crisp vibrant green spearmint and peppermint leaves',
    imageUrl: 'https://images.unsplash.com/photo-1628556270448-4d4e4148e1b1?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#10B981',
    secondaryHex: '#065F46',
    isAbstractAccord: false
  },
  peppermint: {
    label: 'Peppermint',
    alt: 'Fresh green peppermint leaves',
    imageUrl: 'https://images.unsplash.com/photo-1628556270448-4d4e4148e1b1?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#10B981',
    secondaryHex: '#065F46',
    isAbstractAccord: false
  },
  cedarwood: {
    label: 'Cedarwood',
    alt: 'Aromatic Atlas cedarwood timber and needles',
    imageUrl: 'https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#B45309',
    secondaryHex: '#451A03',
    isAbstractAccord: false
  },
  'smoky incense': {
    label: 'Smoky Incense',
    alt: 'Burning aromatic frankincense resin and curling incense smoke',
    imageUrl: 'https://images.unsplash.com/photo-1602874801007-bd458bb1b8b6?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#94A3B8',
    secondaryHex: '#334155',
    isAbstractAccord: false
  },
  'tart raspberry': {
    label: 'Tart Raspberry',
    alt: 'Ripe crimson wild raspberries with fresh drupelets',
    imageUrl: 'https://images.unsplash.com/photo-1577069861033-55d04cec4ef5?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#E11D48',
    secondaryHex: '#881337',
    isAbstractAccord: false
  },
  saffron: {
    label: 'Saffron',
    alt: 'Crimson Kashmiri saffron stigma threads',
    imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#DC2626',
    secondaryHex: '#991B1B',
    isAbstractAccord: false
  },
  'airy gardenia': {
    label: 'Airy Gardenia',
    alt: 'Creamy white blooming gardenia petals',
    imageUrl: 'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#FDE68A',
    secondaryHex: '#B45309',
    isAbstractAccord: false
  },
  'pear blossom': {
    label: 'Pear Blossom',
    alt: 'Delicate spring pear tree blossoms',
    imageUrl: 'https://images.unsplash.com/photo-1522748906645-95d8adfd52c7?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#F9A8D4',
    secondaryHex: '#86EFAC',
    isAbstractAccord: false
  },
  'brown sugar sweetness': {
    label: 'Brown Sugar Sweetness',
    alt: 'Caramelized raw golden brown sugar crystals',
    imageUrl: 'https://images.unsplash.com/photo-1581441363689-1f3c3c414635?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#D97706',
    secondaryHex: '#78350F',
    isAbstractAccord: false
  },
  'soft musks': {
    label: 'Soft Musks',
    alt: 'Silky white cashmere and botanical ambrette musk',
    imageUrl: 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#E7E5E4',
    secondaryHex: '#78716C',
    isAbstractAccord: false
  },
  musk: {
    label: 'Musk',
    alt: 'Clean botanical white musk accord',
    imageUrl: 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#D6D3D1',
    secondaryHex: '#57534E',
    isAbstractAccord: false
  },
  blackcurrant: {
    label: 'Blackcurrant',
    alt: 'Glossy dark purple blackcurrant berries on stem',
    imageUrl: 'https://images.unsplash.com/photo-1596591606975-97ee5cef3a1e?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#9333EA',
    secondaryHex: '#3B0764',
    isAbstractAccord: false
  },
  aldehydes: {
    label: 'Aldehydes',
    alt: 'Effervescent sparkling crystal droplets in sunlight',
    imageUrl: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#FDE047',
    secondaryHex: '#A16207',
    isAbstractAccord: false
  },
  jasmine: {
    label: 'Jasmine',
    alt: 'Star-shaped white Sambac jasmine blossoms',
    imageUrl: 'https://images.unsplash.com/photo-1589216532372-1c2a367900d9?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#FEF08A',
    secondaryHex: '#CA8A04',
    isAbstractAccord: false
  },
  sandalwood: {
    label: 'Sandalwood',
    alt: 'Carved sacred Mysore sandalwood heartwood billets',
    imageUrl: 'https://images.unsplash.com/photo-1546484396-fb3fc6f95f98?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#D97706',
    secondaryHex: '#78350F',
    isAbstractAccord: false
  },
  peony: {
    label: 'Peony',
    alt: 'Lush pink ruffled peony flower in full bloom',
    imageUrl: 'https://images.unsplash.com/photo-1563241527-3004b7be0ffd?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#F472B6',
    secondaryHex: '#BE185D',
    isAbstractAccord: false
  },
  tulsi: {
    label: 'Tulsi',
    alt: 'Sacred green Indian holy basil Tulsi leaves',
    imageUrl: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#16A34A',
    secondaryHex: '#14532D',
    isAbstractAccord: false
  },
  tulasi: {
    label: 'Tulasi',
    alt: 'Sacred green Tulasi holy basil leaves',
    imageUrl: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#16A34A',
    secondaryHex: '#14532D',
    isAbstractAccord: false
  },
  lemon: {
    label: 'Lemon',
    alt: 'Bright yellow artisan lemon fruit with green leaf',
    imageUrl: 'https://images.unsplash.com/photo-1590502593747-42a996133562?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#FACC15',
    secondaryHex: '#A16207',
    isAbstractAccord: false
  },
  camphor: {
    label: 'Camphor',
    alt: 'Pure crystalline white camphor resin',
    imageUrl: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#38BDF8',
    secondaryHex: '#0369A1',
    isAbstractAccord: false
  },
  lotus: {
    label: 'Lotus',
    alt: 'Sacred pink water lotus flower blooming on calm water',
    imageUrl: 'https://images.unsplash.com/photo-1508615039623-a25605d2b022?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#F472B6',
    secondaryHex: '#9D174D',
    isAbstractAccord: false
  },
  'blue lotus': {
    label: 'Blue Lotus',
    alt: 'Rare sacred blue water lily lotus blossom',
    imageUrl: 'https://images.unsplash.com/photo-1508615039623-a25605d2b022?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#60A5FA',
    secondaryHex: '#1D4ED8',
    isAbstractAccord: false
  },
  nagachampa: {
    label: 'Nagachampa',
    alt: 'Golden sacred champaca temple blossom',
    imageUrl: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#F59E0B',
    secondaryHex: '#B45309',
    isAbstractAccord: false
  },
  turmeric: {
    label: 'Turmeric',
    alt: 'Vibrant golden turmeric rhizome root and powder',
    imageUrl: 'https://images.unsplash.com/photo-1615485500704-8e990f9900f7?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#EAB308',
    secondaryHex: '#A16207',
    isAbstractAccord: false
  },
  'lily of valley': {
    label: 'Lily of Valley',
    alt: 'Delicate white bell-shaped lily of the valley blossoms',
    imageUrl: 'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#86EFAC',
    secondaryHex: '#15803D',
    isAbstractAccord: false
  },
  mogra: {
    label: 'Mogra',
    alt: 'Fragrant white Indian Mogra jasmine buds',
    imageUrl: 'https://images.unsplash.com/photo-1589216532372-1c2a367900d9?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#FEF9C3',
    secondaryHex: '#A16207',
    isAbstractAccord: false
  },
  frangipani: {
    label: 'Frangipani',
    alt: 'Tropical white and yellow plumeria frangipani blossoms',
    imageUrl: 'https://images.unsplash.com/photo-1508615039623-a25605d2b022?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#FDE047',
    secondaryHex: '#CA8A04',
    isAbstractAccord: false
  },
  javadhu: {
    label: 'Javadhu',
    alt: 'Traditional South Indian herbal sandalwood and floral Javadhu powder',
    imageUrl: 'https://images.unsplash.com/photo-1546484396-fb3fc6f95f98?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#D97706',
    secondaryHex: '#78350F',
    isAbstractAccord: false
  },
  'wild lavender': {
    label: 'Wild Lavender',
    alt: 'Purple aromatic wild lavender flower spikes',
    imageUrl: 'https://images.unsplash.com/photo-1528756514091-dee5ecaa3278?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#A855F7',
    secondaryHex: '#581C87',
    isAbstractAccord: false
  },
  'kesar chandan': {
    label: 'Kesar Chandan',
    alt: 'Sacred saffron threads infused with golden sandalwood',
    imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#F59E0B',
    secondaryHex: '#9A3412',
    isAbstractAccord: false
  },
  eucalyptus: {
    label: 'Eucalyptus',
    alt: 'Silver-green aromatic eucalyptus leaves',
    imageUrl: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#2DD4BF',
    secondaryHex: '#115E59',
    isAbstractAccord: false
  },
  'ylang ylang': {
    label: 'Ylang Ylang',
    alt: 'Golden tropical Cananga odorata ylang ylang petals',
    imageUrl: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#FACC15',
    secondaryHex: '#854D0E',
    isAbstractAccord: false
  },
  cardamon: {
    label: 'Cardamon',
    alt: 'Green aromatic cardamom pods and spice seeds',
    imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=320&q=80',
    primaryHex: '#4ADE80',
    secondaryHex: '#166534',
    isAbstractAccord: false
  }
};

export function getIngredientMedia(
  rawNoteName: string,
  customNoteMedia?: Record<string, NoteMediaConfig>
): IngredientMediaEntry {
  const cleanKey = (rawNoteName || '').trim().toLowerCase();
  const custom =
    customNoteMedia?.[rawNoteName] ||
    customNoteMedia?.[cleanKey];

  const base = RAW_INGREDIENT_MAP[cleanKey];

  if (base) {
    const label = custom?.label?.trim() || base.label;
    const isAbstract =
      typeof custom?.isAbstract === 'boolean' ? custom.isAbstract : base.isAbstractAccord;
    const fallbackDataUri = makeBotanicalSvgDataUri(
      label,
      base.primaryHex,
      base.secondaryHex,
      isAbstract
    );
    return {
      key: cleanKey,
      label,
      alt: custom?.alt?.trim() || base.alt,
      imageUrl: custom?.imageUrl?.trim() || base.imageUrl,
      fallbackDataUri,
      isAbstractAccord: isAbstract,
      accentColor: base.primaryHex,
      subtitle: base.subtitle
    };
  }

  // Fallback for any custom Admin-added note
  const isAbstractGuess =
    cleanKey.includes('accord') ||
    cleanKey.includes('sunset') ||
    cleanKey.includes('richness') ||
    cleanKey.includes('edge');
  const label = custom?.label?.trim() || rawNoteName.trim();
  const isAbstract =
    typeof custom?.isAbstract === 'boolean' ? custom.isAbstract : isAbstractGuess;
  const fallbackDataUri = makeBotanicalSvgDataUri(
    label,
    '#C59F52',
    '#6E501D',
    isAbstract
  );

  return {
    key: cleanKey,
    label,
    alt: custom?.alt?.trim() || `${label} fragrance note`,
    imageUrl: custom?.imageUrl?.trim() || fallbackDataUri,
    fallbackDataUri,
    isAbstractAccord: isAbstract,
    accentColor: '#9A783E',
    subtitle: isAbstract ? 'Olfactory Accord' : undefined
  };
}

/**
 * Fragrance-Specific Artistic Mist Palettes for the 9 Signature Creations (Requirement 3)
 */
export interface FragranceSprayPalette {
  slug: string;
  primary: string;
  secondary: string;
  tertiary: string;
  label: string;
}

export const FRAGRANCE_SPRAY_PALETTES: Record<string, FragranceSprayPalette> = {
  'golden-hour': {
    slug: 'golden-hour',
    primary: '#D99B26',
    secondary: '#F5B942',
    tertiary: '#E5A93B',
    label: 'Golden Amber & Citrus Mist'
  },
  'blush-and-blossom': {
    slug: 'blush-and-blossom',
    primary: '#E86F88',
    secondary: '#F48C72',
    tertiary: '#F2A2B3',
    label: 'Rose Pink & Coral Mist'
  },
  'violet-noir': {
    slug: 'violet-noir',
    primary: '#8B5CF6',
    secondary: '#6D28D9',
    tertiary: '#A78BFA',
    label: 'Violet & Plum Mist'
  },
  'aqua-pulse': {
    slug: 'aqua-pulse',
    primary: '#14B8A6',
    secondary: '#0EA5E9',
    tertiary: '#34D399',
    label: 'Aqua & Fresh Mint Mist'
  },
  'luxe-heritage': {
    slug: 'luxe-heritage',
    primary: '#B45309',
    secondary: '#9F1239',
    tertiary: '#D97706',
    label: 'Bronze, Saffron & Burgundy Mist'
  },
  'flora-crush': {
    slug: 'flora-crush',
    primary: '#EC4899',
    secondary: '#84CC16',
    tertiary: '#F472B6',
    label: 'Blush Pink & Pear Green Mist'
  },
  'midnight-glow': {
    slug: 'midnight-glow',
    primary: '#BE123C',
    secondary: '#9D174D',
    tertiary: '#E11D48',
    label: 'Raspberry & Deep Rose Mist'
  },
  'silky-velvet': {
    slug: 'silky-velvet',
    primary: '#C5A059',
    secondary: '#D8C39A',
    tertiary: '#B38B45',
    label: 'Pearl Ivory & Champagne Mist'
  },
  'night-bloom': {
    slug: 'night-bloom',
    primary: '#C084FC',
    secondary: '#DB2777',
    tertiary: '#E879F9',
    label: 'Orchid Pink & Soft Mauve Mist'
  }
};

export function getSprayPaletteForSlug(slug: string): FragranceSprayPalette {
  return (
    FRAGRANCE_SPRAY_PALETTES[slug] || {
      slug,
      primary: '#9A783E',
      secondary: '#C5A059',
      tertiary: '#B38B45',
      label: 'Champagne Gold Mist'
    }
  );
}

/**
 * Mega Menu Column 4 — Shop By Note Profile Tiles (3 x 2 Grid)
 */
export interface NoteProfileTile {
  id: string;
  label: string;
  familyMatch: string[];
  imageUrl: string;
  fallbackDataUri: string;
  alt: string;
}

export const NOTE_PROFILE_CATALOG: NoteProfileTile[] = [
  {
    id: 'Gourmand',
    label: 'Gourmand',
    familyMatch: ['Gourmand', 'Sweet'],
    imageUrl: 'https://images.unsplash.com/photo-1606923829579-0cb981a83e2e?auto=format&fit=crop&w=320&q=80',
    fallbackDataUri: makeBotanicalSvgDataUri('Gourmand', '#D97706', '#78350F', false),
    alt: 'Gourmand note profile — Vanilla pods and warm brown sugar'
  },
  {
    id: 'Floral',
    label: 'Floral',
    familyMatch: ['Floral'],
    imageUrl: 'https://images.unsplash.com/photo-1496062031456-07b8f162a322?auto=format&fit=crop&w=320&q=80',
    fallbackDataUri: makeBotanicalSvgDataUri('Floral', '#F43F5E', '#9F1239', false),
    alt: 'Floral note profile — Fresh blooming rose and peony petals'
  },
  {
    id: 'Oud',
    label: 'Oud',
    familyMatch: ['Oud'],
    imageUrl: 'https://images.unsplash.com/photo-1546484396-fb3fc6f95f98?auto=format&fit=crop&w=320&q=80',
    fallbackDataUri: makeBotanicalSvgDataUri('Oud', '#78350F', '#291305', false),
    alt: 'Oud note profile — Aged agarwood resinous heartwood'
  },
  {
    id: 'Fruity',
    label: 'Fruity',
    familyMatch: ['Fruity', 'Citrus'],
    imageUrl: 'https://images.unsplash.com/photo-1577069861033-55d04cec4ef5?auto=format&fit=crop&w=320&q=80',
    fallbackDataUri: makeBotanicalSvgDataUri('Fruity', '#E11D48', '#881337', false),
    alt: 'Fruity note profile — Tart raspberry, blackcurrant and orchard pear'
  },
  {
    id: 'Fresh',
    label: 'Fresh',
    familyMatch: ['Fresh', 'Citrus'],
    imageUrl: 'https://images.unsplash.com/photo-1628556270448-4d4e4148e1b1?auto=format&fit=crop&w=320&q=80',
    fallbackDataUri: makeBotanicalSvgDataUri('Fresh', '#10B981', '#065F46', false),
    alt: 'Fresh note profile — Crisp mint leaves and grapefruit zest'
  },
  {
    id: 'Woody',
    label: 'Woody',
    familyMatch: ['Woody', 'Sacred Wood', 'Leather'],
    imageUrl: 'https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?auto=format&fit=crop&w=320&q=80',
    fallbackDataUri: makeBotanicalSvgDataUri('Woody', '#B45309', '#451A03', false),
    alt: 'Woody note profile — Cedarwood, Mysore sandalwood and warm woods'
  },
  {
    id: 'Amber',
    label: 'Amber & Spicy',
    familyMatch: ['Amber', 'Spicy'],
    imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=320&q=80',
    fallbackDataUri: makeBotanicalSvgDataUri('Amber', '#DC2626', '#78350F', false),
    alt: 'Amber and Spicy note profile — Golden amber resin, saffron and nutmeg'
  }
];
