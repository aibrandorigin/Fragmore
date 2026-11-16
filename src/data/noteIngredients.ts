import type { NoteMediaConfig } from '../types/index.ts';

export interface ResolvedIngredientNote {
  rawName: string;
  label: string;
  imageUrl?: string;
  alt: string;
  isAbstract: boolean;
  moodSwatches?: [string, string];
  subtitle?: string;
}

export interface FragranceSprayPalette {
  slug: string;
  name: string;
  primaryHex: string;
  secondaryHex: string;
  tertiaryHex: string;
  primaryRgb: [number, number, number];
  secondaryRgb: [number, number, number];
  tertiaryRgb: [number, number, number];
  description: string;
}

export const SIGNATURE_SPRAY_PALETTES: Record<string, FragranceSprayPalette> = {
  'golden-hour': {
    slug: 'golden-hour',
    name: 'Golden Amber & Citrus',
    primaryHex: '#D99B26',
    secondaryHex: '#F4C44E',
    tertiaryHex: '#B87B1E',
    primaryRgb: [217, 155, 38],
    secondaryRgb: [244, 196, 78],
    tertiaryRgb: [184, 123, 30],
    description: 'Golden amber and sunlit citrus mist'
  },
  'blush-and-blossom': {
    slug: 'blush-and-blossom',
    name: 'Rose Pink & Coral',
    primaryHex: '#E06D85',
    secondaryHex: '#F29CAE',
    tertiaryHex: '#E88D72',
    primaryRgb: [224, 109, 133],
    secondaryRgb: [242, 156, 174],
    tertiaryRgb: [232, 141, 114],
    description: 'Velvet rose pink and warm coral mist'
  },
  'violet-noir': {
    slug: 'violet-noir',
    name: 'Violet & Plum',
    primaryHex: '#8A4FFF',
    secondaryHex: '#B185DB',
    tertiaryHex: '#6D2E8C',
    primaryRgb: [138, 79, 255],
    secondaryRgb: [177, 133, 219],
    tertiaryRgb: [109, 46, 140],
    description: 'Nocturnal violet and smoked plum mist'
  },
  'aqua-pulse': {
    slug: 'aqua-pulse',
    name: 'Aqua & Fresh Mint',
    primaryHex: '#2AB7CA',
    secondaryHex: '#56D8C8',
    tertiaryHex: '#1C96A8',
    primaryRgb: [42, 183, 202],
    secondaryRgb: [86, 216, 200],
    tertiaryRgb: [28, 150, 168],
    description: 'Crystalline aqua and crushed mint mist'
  },
  'luxe-heritage': {
    slug: 'luxe-heritage',
    name: 'Bronze, Saffron & Burgundy',
    primaryHex: '#C86D28',
    secondaryHex: '#9E2A2B',
    tertiaryHex: '#D49A3D',
    primaryRgb: [200, 109, 40],
    secondaryRgb: [158, 42, 43],
    tertiaryRgb: [212, 154, 61],
    description: 'Spiced saffron, burnished bronze and burgundy mist'
  },
  'flora-crush': {
    slug: 'flora-crush',
    name: 'Blush Pink & Pear Green',
    primaryHex: '#E57A93',
    secondaryHex: '#9BC556',
    tertiaryHex: '#F3A6B8',
    primaryRgb: [229, 122, 147],
    secondaryRgb: [155, 197, 86],
    tertiaryRgb: [243, 166, 184],
    description: 'Blush gardenia pink and crisp pear blossom green mist'
  },
  'midnight-glow': {
    slug: 'midnight-glow',
    name: 'Raspberry & Deep Rose',
    primaryHex: '#C92A52',
    secondaryHex: '#E56B86',
    tertiaryHex: '#8C1D40',
    primaryRgb: [201, 42, 82],
    secondaryRgb: [229, 107, 134],
    tertiaryRgb: [140, 29, 64],
    description: 'Lush raspberry and nocturnal crimson rose mist'
  },
  'silky-velvet': {
    slug: 'silky-velvet',
    name: 'Pearl Ivory & Champagne',
    primaryHex: '#C4A777',
    secondaryHex: '#E3D3B6',
    tertiaryHex: '#9A783E',
    primaryRgb: [196, 167, 119],
    secondaryRgb: [227, 211, 182],
    tertiaryRgb: [154, 120, 62],
    description: 'Luminous pearl ivory and warm champagne mist'
  },
  'night-bloom': {
    slug: 'night-bloom',
    name: 'Orchid Pink & Soft Mauve',
    primaryHex: '#B565A7',
    secondaryHex: '#D696C8',
    tertiaryHex: '#8E4585',
    primaryRgb: [181, 101, 167],
    secondaryRgb: [214, 150, 200],
    tertiaryRgb: [142, 69, 133],
    description: 'Sensual orchid pink and twilight mauve mist'
  }
};

export const getSprayPaletteForSlug = (slug: string): FragranceSprayPalette => {
  const clean = (slug || '').toLowerCase().replace(/^prod-/, '');
  return SIGNATURE_SPRAY_PALETTES[clean] || SIGNATURE_SPRAY_PALETTES['golden-hour'];
};

// Curated high-resolution ingredient photography & explicit abstract accord treatments
const INGREDIENT_CATALOG: Record<
  string,
  {
    label: string;
    imageUrl?: string;
    alt: string;
    isAbstract: boolean;
    moodSwatches?: [string, string];
    subtitle?: string;
  }
> = {
  // Botanicals, Fruits, Woods, Resins & Spices (Real Ingredient Photography)
  citrus: {
    label: 'Citrus',
    imageUrl: 'https://images.unsplash.com/photo-1590502593747-42a996133562?auto=format&fit=crop&w=240&q=80',
    alt: 'Fresh sun-ripened citrus slices with zest droplets',
    isAbstract: false
  },
  pear: {
    label: 'Pear',
    imageUrl: 'https://images.unsplash.com/photo-1514756331096-242fdeb70d4a?auto=format&fit=crop&w=240&q=80',
    alt: 'Crisp golden orchard pear photography',
    isAbstract: false
  },
  'pear blossom': {
    label: 'Pear Blossom',
    imageUrl: 'https://images.unsplash.com/photo-1522748906645-95d8adfd52c7?auto=format&fit=crop&w=240&q=80',
    alt: 'Delicate white spring pear blossom petals',
    isAbstract: false
  },
  amber: {
    label: 'Amber',
    imageUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=240&q=80',
    alt: 'Warm golden translucent amber resin',
    isAbstract: false
  },
  vanilla: {
    label: 'Vanilla',
    imageUrl: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=240&q=80',
    alt: 'Cured Madagascar vanilla pods and warm orchid beans',
    isAbstract: false
  },
  'cozy vanilla': {
    label: 'Cozy Vanilla',
    imageUrl: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=240&q=80',
    alt: 'Rich aromatic vanilla bean pods',
    isAbstract: false
  },
  'warm vanilla': {
    label: 'Warm Vanilla',
    imageUrl: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=240&q=80',
    alt: 'Warm vanilla pods and golden spice',
    isAbstract: false
  },
  'soft woods': {
    label: 'Soft Woods',
    imageUrl: 'https://images.unsplash.com/photo-1546484396-fb3fc6f95f98?auto=format&fit=crop&w=240&q=80',
    alt: 'Warm blonde aromatic heartwood shavings',
    isAbstract: false
  },
  'warm wood': {
    label: 'Warm Wood',
    imageUrl: 'https://images.unsplash.com/photo-1546484396-fb3fc6f95f98?auto=format&fit=crop&w=240&q=80',
    alt: 'Seasoned aromatic heartwood',
    isAbstract: false
  },
  peony: {
    label: 'Peony',
    imageUrl: 'https://images.unsplash.com/photo-1563241527-3004b7be0ffd?auto=format&fit=crop&w=240&q=80',
    alt: 'Plush blush pink peony petals in bloom',
    isAbstract: false
  },
  rose: {
    label: 'Rose',
    imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=240&q=80',
    alt: 'Velvety crimson Damask rose petals',
    isAbstract: false
  },
  'dark rose': {
    label: 'Dark Rose',
    imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=240&q=80',
    alt: 'Deep nocturnal crimson rose bloom',
    isAbstract: false
  },
  'royal rose': {
    label: 'Royal Rose',
    imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=240&q=80',
    alt: 'Fresh royal rose petals',
    isAbstract: false
  },
  osmanthus: {
    label: 'Osmanthus',
    imageUrl: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=240&q=80',
    alt: 'Golden apricot-scented osmanthus blossoms',
    isAbstract: false
  },
  patchouli: {
    label: 'Patchouli',
    imageUrl: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=240&q=80',
    alt: 'Botanical aromatic patchouli leaves',
    isAbstract: false
  },
  sandalwood: {
    label: 'Sandalwood',
    imageUrl: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=240&q=80',
    alt: 'Creamy Mysore sandalwood heartwood billets',
    isAbstract: false
  },
  lavender: {
    label: 'Lavender',
    imageUrl: 'https://images.unsplash.com/photo-1528756514091-dee5ecaa3278?auto=format&fit=crop&w=240&q=80',
    alt: 'Fresh purple Provençal lavender sprigs',
    isAbstract: false
  },
  'wild lavender': {
    label: 'Wild Lavender',
    imageUrl: 'https://images.unsplash.com/photo-1528756514091-dee5ecaa3278?auto=format&fit=crop&w=240&q=80',
    alt: 'Wild lavender blossoms',
    isAbstract: false
  },
  'lemon zest': {
    label: 'Lemon Zest',
    imageUrl: 'https://images.unsplash.com/photo-1590502593747-42a996133562?auto=format&fit=crop&w=240&q=80',
    alt: 'Bright aromatic lemon zest peel',
    isAbstract: false
  },
  'amalfi lemon': {
    label: 'Amalfi Lemon',
    imageUrl: 'https://images.unsplash.com/photo-1590502593747-42a996133562?auto=format&fit=crop&w=240&q=80',
    alt: 'Sun-drenched Italian Amalfi lemons',
    isAbstract: false
  },
  lemon: {
    label: 'Lemon',
    imageUrl: 'https://images.unsplash.com/photo-1590502593747-42a996133562?auto=format&fit=crop&w=240&q=80',
    alt: 'Fresh yellow lemon fruit',
    isAbstract: false
  },
  'crisp apple': {
    label: 'Crisp Apple',
    imageUrl: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=240&q=80',
    alt: 'Dewy crisp orchard apple',
    isAbstract: false
  },
  vetiver: {
    label: 'Vetiver',
    imageUrl: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=240&q=80',
    alt: 'Earthy aromatic vetiver grass roots',
    isAbstract: false
  },
  mint: {
    label: 'Mint',
    imageUrl: 'https://images.unsplash.com/photo-1628556270448-4d4e4148e1b1?auto=format&fit=crop&w=240&q=80',
    alt: 'Crushed vibrant green spearmint leaves',
    isAbstract: false
  },
  'green nuances': {
    label: 'Green Botanicals',
    imageUrl: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=240&q=80',
    alt: 'Fresh dewy green botanical foliage',
    isAbstract: false
  },
  'fresh spicy coriander': {
    label: 'Coriander Seed',
    imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=240&q=80',
    alt: 'Aromatic spiced coriander seeds',
    isAbstract: false
  },
  jasmine: {
    label: 'Jasmine',
    imageUrl: 'https://images.unsplash.com/photo-1592729645009-b96d1e63d14b?auto=format&fit=crop&w=240&q=80',
    alt: 'Star-shaped white night-blooming jasmine flowers',
    isAbstract: false
  },
  geranium: {
    label: 'Geranium',
    imageUrl: 'https://images.unsplash.com/photo-1468327768560-75b778cbb551?auto=format&fit=crop&w=240&q=80',
    alt: 'Rose-scented vibrant geranium petals',
    isAbstract: false
  },
  cedar: {
    label: 'Cedarwood',
    imageUrl: 'https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?auto=format&fit=crop&w=240&q=80',
    alt: 'Atlas cedarwood bark and aromatic timber',
    isAbstract: false
  },
  oakmoss: {
    label: 'Oakmoss',
    imageUrl: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=240&q=80',
    alt: 'Velvety forest oakmoss and lichen',
    isAbstract: false
  },
  'rich leather': {
    label: 'Rich Leather',
    imageUrl: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=240&q=80',
    alt: 'Supple burnished artisanal saddle leather',
    isAbstract: false
  },
  'tart raspberry': {
    label: 'Tart Raspberry',
    imageUrl: 'https://images.unsplash.com/photo-1577069861033-55d04cec4ef5?auto=format&fit=crop&w=240&q=80',
    alt: 'Ripe ruby-red raspberries',
    isAbstract: false
  },
  saffron: {
    label: 'Saffron',
    imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=240&q=80',
    alt: 'Crimson Kashmiri saffron threads',
    isAbstract: false
  },
  'airy gardenia': {
    label: 'Airy Gardenia',
    imageUrl: 'https://images.unsplash.com/photo-1592729645009-b96d1e63d14b?auto=format&fit=crop&w=240&q=80',
    alt: 'Creamy white velvet gardenia petals',
    isAbstract: false
  },
  blackcurrant: {
    label: 'Blackcurrant',
    imageUrl: 'https://images.unsplash.com/photo-1596363505729-4190a9506133?auto=format&fit=crop&w=240&q=80',
    alt: 'Dark glossy cassis blackcurrant berries',
    isAbstract: false
  },
  'sparkling rose': {
    label: 'Sparkling Rose',
    imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=240&q=80',
    alt: 'Dew-kissed sparkling Damask rose petals',
    isAbstract: false
  },
  'orange blossom': {
    label: 'Orange Blossom',
    imageUrl: 'https://images.unsplash.com/photo-1522748906645-95d8adfd52c7?auto=format&fit=crop&w=240&q=80',
    alt: 'Fragrant white neroli orange blossoms',
    isAbstract: false
  },
  'chic florals': {
    label: 'Chic Florals',
    imageUrl: 'https://images.unsplash.com/photo-1563241527-3004b7be0ffd?auto=format&fit=crop&w=240&q=80',
    alt: 'Luminous haute couture floral bouquet',
    isAbstract: false
  },
  'violet leaf': {
    label: 'Violet Leaf',
    imageUrl: 'https://images.unsplash.com/photo-1468327768560-75b778cbb551?auto=format&fit=crop&w=240&q=80',
    alt: 'Velvety violet leaves and purple blooms',
    isAbstract: false
  },
  nutmeg: {
    label: 'Nutmeg',
    imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=240&q=80',
    alt: 'Whole grated aromatic nutmeg spice',
    isAbstract: false
  },
  'warm leather': {
    label: 'Warm Leather',
    imageUrl: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=240&q=80',
    alt: 'Warm artisanal grained leather',
    isAbstract: false
  },
  'woody petrol-edge': {
    label: 'Smoked Dark Woods',
    imageUrl: 'https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?auto=format&fit=crop&w=240&q=80',
    alt: 'Charred dark resinous heartwood',
    isAbstract: false
  },
  'fresh grapefruit': {
    label: 'Fresh Grapefruit',
    imageUrl: 'https://images.unsplash.com/photo-1590502593747-42a996133562?auto=format&fit=crop&w=240&q=80',
    alt: 'Ruby pink grapefruit citrus slices',
    isAbstract: false
  },
  cedarwood: {
    label: 'Cedarwood',
    imageUrl: 'https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?auto=format&fit=crop&w=240&q=80',
    alt: 'Noble Atlas cedarwood timber',
    isAbstract: false
  },
  'smoky incense': {
    label: 'Smoky Incense',
    imageUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=240&q=80',
    alt: 'Sacred frankincense and myrrh resin tears',
    isAbstract: false
  },
  tulsi: {
    label: 'Sacred Tulsi',
    imageUrl: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=240&q=80',
    alt: 'Fresh green sacred holy basil tulsi leaves',
    isAbstract: false
  },
  tulasi: {
    label: 'Sacred Tulasi',
    imageUrl: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=240&q=80',
    alt: 'Fresh green sacred holy basil tulasi leaves',
    isAbstract: false
  },
  camphor: {
    label: 'Pure Camphor',
    imageUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=240&q=80',
    alt: 'Crystalline aromatic botanical camphor',
    isAbstract: false
  },
  lotus: {
    label: 'Sacred Lotus',
    imageUrl: 'https://images.unsplash.com/photo-1563241527-3004b7be0ffd?auto=format&fit=crop&w=240&q=80',
    alt: 'Serene pink sacred lotus flower in bloom',
    isAbstract: false
  },
  'blue lotus': {
    label: 'Blue Lotus',
    imageUrl: 'https://images.unsplash.com/photo-1468327768560-75b778cbb551?auto=format&fit=crop&w=240&q=80',
    alt: 'Rare sacred blue water lily lotus petals',
    isAbstract: false
  },
  nagachampa: {
    label: 'Nagachampa',
    imageUrl: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=240&q=80',
    alt: 'Golden sacred champaca temple blossoms',
    isAbstract: false
  },
  turmeric: {
    label: 'Golden Turmeric',
    imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=240&q=80',
    alt: 'Warm golden aromatic turmeric root',
    isAbstract: false
  },
  'lily of valley': {
    label: 'Lily of the Valley',
    imageUrl: 'https://images.unsplash.com/photo-1522748906645-95d8adfd52c7?auto=format&fit=crop&w=240&q=80',
    alt: 'Delicate white bell-shaped lily of the valley blooms',
    isAbstract: false
  },
  mogra: {
    label: 'Mogra Jasmine',
    imageUrl: 'https://images.unsplash.com/photo-1592729645009-b96d1e63d14b?auto=format&fit=crop&w=240&q=80',
    alt: 'Lush white Indian mogra Arabian jasmine buds',
    isAbstract: false
  },
  frangipani: {
    label: 'Frangipani',
    imageUrl: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=240&q=80',
    alt: 'Creamy white and gold temple plumeria frangipani',
    isAbstract: false
  },
  javadhu: {
    label: 'Javadhu Attar',
    imageUrl: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=240&q=80',
    alt: 'Traditional South Indian sandalwood and floral herbs',
    isAbstract: false
  },
  'kesar chandan': {
    label: 'Kesar Chandan',
    imageUrl: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=240&q=80',
    alt: 'Royal saffron infused Mysore sandalwood',
    isAbstract: false
  },
  peppermint: {
    label: 'Peppermint',
    imageUrl: 'https://images.unsplash.com/photo-1628556270448-4d4e4148e1b1?auto=format&fit=crop&w=240&q=80',
    alt: 'Cool crisp botanical peppermint leaves',
    isAbstract: false
  },
  eucalyptus: {
    label: 'Eucalyptus',
    imageUrl: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=240&q=80',
    alt: 'Silvery-green aromatic eucalyptus leaves',
    isAbstract: false
  },
  'ylang ylang': {
    label: 'Ylang Ylang',
    imageUrl: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=240&q=80',
    alt: 'Tropical golden ylang ylang star petals',
    isAbstract: false
  },
  cardamon: {
    label: 'Green Cardamom',
    imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=240&q=80',
    alt: 'Crushed green aromatic cardamom pods',
    isAbstract: false
  },
  cardamom: {
    label: 'Green Cardamom',
    imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=240&q=80',
    alt: 'Crushed green aromatic cardamom pods',
    isAbstract: false
  },

  // Abstract Olfactory Accords (Explicitly treated as mood/editorial accords without inventing fake botanicals)
  'golden hour': {
    label: 'Golden Hour Accord',
    alt: 'Warm golden sunset radiance accord',
    isAbstract: true,
    moodSwatches: ['#F4C44E', '#B87B1E'],
    subtitle: 'Solar Accord'
  },
  'musky warm sunset': {
    label: 'Musky Warm Sunset',
    alt: 'Abstract olfactory accord of warm sunset amber and skin musk',
    isAbstract: true,
    moodSwatches: ['#E08E45', '#8C4A27'],
    subtitle: 'Atmosphere Accord'
  },
  'earthy accord': {
    label: 'Earthy Accord',
    alt: 'Abstract mineral petrichor and warm earth accord',
    isAbstract: true,
    moodSwatches: ['#6D5947', '#382E25'],
    subtitle: 'Mineral Accord'
  },
  smoke: {
    label: 'Incense Smoke',
    alt: 'Abstract wisp of aromatic resin smoke',
    isAbstract: true,
    moodSwatches: ['#7E6B8F', '#32293D'],
    subtitle: 'Smoky Accord'
  },
  'smoky richness': {
    label: 'Smoky Richness',
    alt: 'Abstract accord of charred woods and warm incense',
    isAbstract: true,
    moodSwatches: ['#9E2A2B', '#3E1F09'],
    subtitle: 'Resinous Accord'
  },
  'brown sugar sweetness': {
    label: 'Brown Sugar Accord',
    alt: 'Caramelized Demerara brown sugar gourmand accord',
    isAbstract: true,
    moodSwatches: ['#C87D4B', '#6E3B1E'],
    subtitle: 'Gourmand Accord'
  },
  'soft musks': {
    label: 'Soft Musks',
    alt: 'Sheer cashmere white musk accord',
    isAbstract: true,
    moodSwatches: ['#EFE6D5', '#C4B5A6'],
    subtitle: 'Sensual Accord'
  },
  musk: {
    label: 'Velvet Musk',
    alt: 'Clean skin musk olfactory accord',
    isAbstract: true,
    moodSwatches: ['#E6DEC8', '#B5A68F'],
    subtitle: 'Skin Accord'
  },
  'timeless powdery florals': {
    label: 'Powdery Florals',
    alt: 'Classic iris and silk powder floral accord',
    isAbstract: true,
    moodSwatches: ['#E8DFF5', '#B8A6D9'],
    subtitle: 'Haute Accord'
  },
  aldehydes: {
    label: 'Sparkling Aldehydes',
    alt: 'Effervescent champagne aldehyde accord',
    isAbstract: true,
    moodSwatches: ['#FAF3E3', '#D4AF37'],
    subtitle: 'Luminous Accord'
  },
  'blush floral accord': {
    label: 'Blush Floral Accord',
    alt: 'Dewy pink petal bouquet accord',
    isAbstract: true,
    moodSwatches: ['#F3A6B8', '#B565A7'],
    subtitle: 'Bouquet Accord'
  },
  'sweet florals': {
    label: 'Sweet Florals',
    alt: 'Nectar-kissed nocturnal blossom accord',
    isAbstract: true,
    moodSwatches: ['#E57A93', '#8E4585'],
    subtitle: 'Nectar Accord'
  }
};

export function resolveNoteIngredient(
  noteName: string,
  productNoteMedia?: Record<string, NoteMediaConfig>
): ResolvedIngredientNote {
  const cleanRaw = (noteName || '').trim();
  const key = cleanRaw.toLowerCase();

  const customOverride =
    productNoteMedia?.[cleanRaw] ||
    productNoteMedia?.[key] ||
    (productNoteMedia
      ? Object.entries(productNoteMedia).find(([k]) => k.toLowerCase() === key)?.[1]
      : undefined);

  const catalogEntry = INGREDIENT_CATALOG[key];

  if (customOverride) {
    const hasCustomImage = Boolean(customOverride.imageUrl && customOverride.imageUrl.trim());
    return {
      rawName: cleanRaw,
      label: customOverride.label?.trim() || catalogEntry?.label || cleanRaw,
      imageUrl: hasCustomImage ? customOverride.imageUrl!.trim() : catalogEntry?.imageUrl,
      alt:
        customOverride.alt?.trim() ||
        catalogEntry?.alt ||
        `${customOverride.label || cleanRaw} fragrance note`,
      isAbstract:
        customOverride.isAbstract !== undefined
          ? customOverride.isAbstract
          : hasCustomImage
          ? false
          : catalogEntry?.isAbstract ?? true,
      moodSwatches: catalogEntry?.moodSwatches || ['#D4AF37', '#78350F'],
      subtitle: catalogEntry?.subtitle || 'Olfactory Accord'
    };
  }

  if (catalogEntry) {
    return {
      rawName: cleanRaw,
      label: catalogEntry.label,
      imageUrl: catalogEntry.imageUrl,
      alt: catalogEntry.alt,
      isAbstract: catalogEntry.isAbstract,
      moodSwatches: catalogEntry.moodSwatches,
      subtitle: catalogEntry.subtitle
    };
  }

  // Fallback for any custom note added in Admin without an image URL: treat honestly as an Olfactory Accord
  return {
    rawName: cleanRaw,
    label: cleanRaw,
    alt: `${cleanRaw} olfactory note`,
    isAbstract: true,
    moodSwatches: ['#D0AE70', '#686158'],
    subtitle: 'Olfactory Note'
  };
}
