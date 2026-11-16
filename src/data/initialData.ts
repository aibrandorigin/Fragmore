import type {
  Product,
  Coupon,
  Influencer,
  Review,
  Order,
  AbandonedCart,
  CMSSettings,
  CustomerProfile,
  IntegrationConfig,
  Campaign,
  ReturnRefund,
  BackInStockItem,
  AuditLog
} from '../types/index.ts';

export const INITIAL_PRODUCTS: Product[] = [
  // ==========================================================
  // SIGNATURE COLLECTION (9 Approved Fragrances)
  // ==========================================================
  {
    id: 'prod-golden-hour',
    name: 'GOLDEN HOUR',
    slug: 'golden-hour',
    subtitle: 'Golden. Warm. Unforgettable.',
    tagline: 'Golden. Warm. Unforgettable.',
    gender: 'unisex',
    collection: 'Signature Collection',
    scentProfile: 'Golden. Warm. Unforgettable.',
    description: 'Golden. Warm. Unforgettable. Opening with Golden hour, Citrus, and Pear, unfolding into a heart of Musky Warm Sunset, and resting on Amber, Vanilla, and Soft Woods.',
    story: 'Golden. Warm. Unforgettable. Crafted for luminous presence from sunset to twilight.',
    notes: {
      top: ['Golden hour', 'Citrus', 'Pear'],
      heart: ['Musky Warm Sunset'],
      base: ['Amber', 'Vanilla', 'Soft Woods']
    },
    families: ['Amber', 'Citrus', 'Fruity', 'Woody', 'Gourmand'],
    occasions: ['Day', 'Daily', 'Evening', 'Vacation'],
    longevity: '',
    sillage: '',
    rating: 5.0,
    reviewCount: 0,
    isBestSeller: true,
    status: 'ACTIVE',
    themeColor: '#92400E',
    accentColor: '#F59E0B',
    features: [],
    variants: [
      { id: 'golden-hour-30ml', size: '30 ml', sku: 'FRG-GH-030', mrp: 699, sellingPrice: 699, stockOnHand: 0, stockReserved: 0, stockAvailable: 0, isAvailable: true, stockManaged: false },
      { id: 'golden-hour-50ml', size: '50 ml', sku: 'FRG-GH-050', mrp: 999, sellingPrice: 999, stockOnHand: 0, stockReserved: 0, stockAvailable: 0, isAvailable: true, stockManaged: false }
    ]
  },
  {
    id: 'prod-blush-and-blossom',
    name: 'BLUSH & BLOSSOM',
    slug: 'blush-and-blossom',
    subtitle: 'Chic. Sparkling. Feminine.',
    tagline: 'Chic. Sparkling. Feminine.',
    gender: 'women',
    collection: 'Signature Collection',
    scentProfile: 'Chic. Sparkling. Feminine.',
    description: 'Chic. Sparkling. Feminine. A luminous opening of Sparkling Rose and Orange Blossom, leading into Chic Florals and a warm base of Vanilla and Patchouli.',
    story: 'Chic. Sparkling. Feminine. A radiant celebration of modern floral grace.',
    notes: {
      top: ['Sparkling Rose', 'Orange Blossom'],
      heart: ['Chic Florals'],
      base: ['Vanilla', 'Patchouli']
    },
    families: ['Floral', 'Sweet', 'Gourmand'],
    occasions: ['Day', 'Wedding', 'Party', 'Daily'],
    longevity: '',
    sillage: '',
    rating: 5.0,
    reviewCount: 0,
    isBestSeller: true,
    status: 'ACTIVE',
    themeColor: '#9D174D',
    accentColor: '#F472B6',
    features: [],
    variants: [
      { id: 'blush-and-blossom-30ml', size: '30 ml', sku: 'FRG-BB-030', mrp: 699, sellingPrice: 699, stockOnHand: 0, stockReserved: 0, stockAvailable: 0, isAvailable: true, stockManaged: false },
      { id: 'blush-and-blossom-50ml', size: '50 ml', sku: 'FRG-BB-050', mrp: 999, sellingPrice: 999, stockOnHand: 0, stockReserved: 0, stockAvailable: 0, isAvailable: true, stockManaged: false }
    ]
  },
  {
    id: 'prod-violet-noir',
    name: 'VIOLET NOIR',
    slug: 'violet-noir',
    subtitle: 'Bold. Mysterious. Magnetic.',
    tagline: 'Bold. Mysterious. Magnetic.',
    gender: 'men',
    collection: 'Signature Collection',
    scentProfile: 'Bold. Mysterious. Magnetic.',
    description: 'Bold. Mysterious. Magnetic. Crafted with Violet Leaf and Nutmeg at the top, a heart of Warm Leather, and a distinctive Woody Petrol-Edge base.',
    story: 'Bold. Mysterious. Magnetic. A commanding nocturnal statement.',
    notes: {
      top: ['Violet Leaf', 'Nutmeg'],
      heart: ['Warm Leather'],
      base: ['Woody Petrol-Edge']
    },
    families: ['Leather', 'Woody', 'Spicy'],
    occasions: ['Night', 'Party', 'Office'],
    longevity: '',
    sillage: '',
    rating: 5.0,
    reviewCount: 0,
    isBestSeller: true,
    status: 'ACTIVE',
    themeColor: '#4C1D95',
    accentColor: '#A78BFA',
    features: [],
    variants: [
      { id: 'violet-noir-30ml', size: '30 ml', sku: 'FRG-VN-030', mrp: 699, sellingPrice: 699, stockOnHand: 0, stockReserved: 0, stockAvailable: 0, isAvailable: true, stockManaged: false },
      { id: 'violet-noir-50ml', size: '50 ml', sku: 'FRG-VN-050', mrp: 999, sellingPrice: 999, stockOnHand: 0, stockReserved: 0, stockAvailable: 0, isAvailable: true, stockManaged: false }
    ]
  },
  {
    id: 'prod-aqua-pulse',
    name: 'AQUA PULSE',
    slug: 'aqua-pulse',
    subtitle: 'Fresh. Energetic. Modern.',
    tagline: 'Fresh. Energetic. Modern.',
    gender: 'men',
    collection: 'Signature Collection',
    scentProfile: 'Fresh. Energetic. Modern.',
    description: 'Fresh. Energetic. Modern. An invigorating rush of Fresh Grapefruit and Mint over a crisp Cedarwood heart and a trail of Smoky Incense.',
    story: 'Fresh. Energetic. Modern. Crisp citrus vitality balanced with grounding wood and incense.',
    notes: {
      top: ['Fresh Grapefruit', 'Mint'],
      heart: ['Cedarwood'],
      base: ['Smoky Incense']
    },
    families: ['Fresh', 'Citrus', 'Fruity', 'Woody'],
    occasions: ['Day', 'Daily', 'Office', 'Gym', 'Vacation'],
    longevity: '',
    sillage: '',
    rating: 5.0,
    reviewCount: 0,
    status: 'ACTIVE',
    themeColor: '#0369A1',
    accentColor: '#38BDF8',
    features: [],
    variants: [
      { id: 'aqua-pulse-30ml', size: '30 ml', sku: 'FRG-AP-030', mrp: 699, sellingPrice: 699, stockOnHand: 0, stockReserved: 0, stockAvailable: 0, isAvailable: true, stockManaged: false },
      { id: 'aqua-pulse-50ml', size: '50 ml', sku: 'FRG-AP-050', mrp: 999, sellingPrice: 999, stockOnHand: 0, stockReserved: 0, stockAvailable: 0, isAvailable: true, stockManaged: false }
    ]
  },
  {
    id: 'prod-luxe-heritage',
    name: 'LUXE HERITAGE',
    slug: 'luxe-heritage',
    subtitle: 'Rich. Intense. Timeless.',
    tagline: 'Rich. Intense. Timeless.',
    gender: 'unisex',
    collection: 'Signature Collection',
    scentProfile: 'Rich. Intense. Timeless.',
    description: 'Rich. Intense. Timeless. Combining Rich Leather and Tart Raspberry in the opening, a heart of Saffron and Warm Wood, and a base of Smoky Richness.',
    story: 'Rich. Intense. Timeless. An enduring expression of leather, saffron, and warm wood.',
    notes: {
      top: ['Rich Leather', 'Tart Raspberry'],
      heart: ['Saffron', 'Warm Wood'],
      base: ['Smoky Richness']
    },
    families: ['Leather', 'Woody', 'Spicy', 'Fruity'],
    occasions: ['Night', 'Wedding', 'Office', 'Party'],
    longevity: '',
    sillage: '',
    rating: 5.0,
    reviewCount: 0,
    isBestSeller: true,
    status: 'ACTIVE',
    themeColor: '#78350F',
    accentColor: '#D97706',
    features: [],
    variants: [
      { id: 'luxe-heritage-30ml', size: '30 ml', sku: 'FRG-LH-030', mrp: 699, sellingPrice: 699, stockOnHand: 0, stockReserved: 0, stockAvailable: 0, isAvailable: true, stockManaged: false },
      { id: 'luxe-heritage-50ml', size: '50 ml', sku: 'FRG-LH-050', mrp: 699, sellingPrice: 699, stockOnHand: 0, stockReserved: 0, stockAvailable: 0, isAvailable: true, stockManaged: false }
    ]
  },
  {
    id: 'prod-flora-crush',
    name: 'FLORA CRUSH',
    slug: 'flora-crush',
    subtitle: 'Playful. Romantic. Addictive.',
    tagline: 'Playful. Romantic. Addictive.',
    gender: 'women',
    collection: 'Signature Collection',
    scentProfile: 'Playful. Romantic. Addictive.',
    description: 'Playful. Romantic. Addictive. Airy Gardenia and Pear Blossom meet Brown Sugar Sweetness, settling into Soft Musks and Amber.',
    story: 'Playful. Romantic. Addictive. Delicate white petals wrapped in warm sweetness.',
    notes: {
      top: ['Airy Gardenia', 'Pear Blossom'],
      heart: ['Brown Sugar Sweetness'],
      base: ['Soft Musks', 'Amber']
    },
    families: ['Floral', 'Gourmand', 'Sweet', 'Amber'],
    occasions: ['Day', 'Daily', 'Party', 'Vacation'],
    longevity: '',
    sillage: '',
    rating: 5.0,
    reviewCount: 0,
    status: 'ACTIVE',
    themeColor: '#BE185D',
    accentColor: '#FB7185',
    features: [],
    variants: [
      { id: 'flora-crush-30ml', size: '30 ml', sku: 'FRG-FC-030', mrp: 699, sellingPrice: 699, stockOnHand: 0, stockReserved: 0, stockAvailable: 0, isAvailable: true, stockManaged: false },
      { id: 'flora-crush-50ml', size: '50 ml', sku: 'FRG-FC-050', mrp: 999, sellingPrice: 999, stockOnHand: 0, stockReserved: 0, stockAvailable: 0, isAvailable: true, stockManaged: false }
    ]
  },
  {
    id: 'prod-midnight-glow',
    name: 'MIDNIGHT GLOW',
    slug: 'midnight-glow',
    subtitle: 'Seductive. Radiant. Captivating.',
    tagline: 'Seductive. Radiant. Captivating.',
    gender: 'women',
    collection: 'Signature Collection',
    scentProfile: 'Seductive. Radiant. Captivating.',
    description: 'Seductive. Radiant. Captivating. Tart Raspberry and Dark Rose open into a luscious Blackcurrant heart over Cozy Vanilla and Musk.',
    story: 'Seductive. Radiant. Captivating. Dark rose and berry accords illuminated by warm vanilla.',
    notes: {
      top: ['Tart Raspberry', 'Dark Rose'],
      heart: ['Blackcurrant'],
      base: ['Cozy Vanilla', 'Musk']
    },
    families: ['Fruity', 'Floral', 'Gourmand', 'Musk'],
    occasions: ['Night', 'Party', 'Wedding'],
    longevity: '',
    sillage: '',
    rating: 5.0,
    reviewCount: 0,
    isNewArrival: true,
    status: 'ACTIVE',
    themeColor: '#701A75',
    accentColor: '#E879F9',
    features: [],
    variants: [
      { id: 'midnight-glow-30ml', size: '30 ml', sku: 'FRG-MG-030', mrp: 699, sellingPrice: 699, stockOnHand: 0, stockReserved: 0, stockAvailable: 0, isAvailable: true, stockManaged: false },
      { id: 'midnight-glow-50ml', size: '50 ml', sku: 'FRG-MG-050', mrp: 999, sellingPrice: 999, stockOnHand: 0, stockReserved: 0, stockAvailable: 0, isAvailable: true, stockManaged: false }
    ]
  },
  {
    id: 'prod-silky-velvet',
    name: 'SILKY VELVET',
    slug: 'silky-velvet',
    subtitle: 'Classic. Elegant. Enduring.',
    tagline: 'Classic. Elegant. Enduring.',
    gender: 'unisex',
    collection: 'Signature Collection',
    scentProfile: 'Classic. Elegant. Enduring.',
    description: 'Classic. Elegant. Enduring. Timeless Powdery Florals unfold into Aldehydes, Rose, and Jasmine, grounded by pure Sandalwood.',
    story: 'Classic. Elegant. Enduring. A poised bouquet of powdery florals and smooth sandalwood.',
    notes: {
      top: ['Timeless Powdery Florals'],
      heart: ['Aldehydes', 'Rose', 'Jasmine'],
      base: ['Sandalwood']
    },
    families: ['Floral', 'Woody'],
    occasions: ['Day', 'Office', 'Daily', 'Wedding'],
    longevity: '',
    sillage: '',
    rating: 5.0,
    reviewCount: 0,
    status: 'ACTIVE',
    themeColor: '#78590C',
    accentColor: '#FBBF24',
    features: [],
    variants: [
      { id: 'silky-velvet-30ml', size: '30 ml', sku: 'FRG-SV-030', mrp: 699, sellingPrice: 699, stockOnHand: 0, stockReserved: 0, stockAvailable: 0, isAvailable: true, stockManaged: false },
      { id: 'silky-velvet-50ml', size: '50 ml', sku: 'FRG-SV-050', mrp: 999, sellingPrice: 999, stockOnHand: 0, stockReserved: 0, stockAvailable: 0, isAvailable: true, stockManaged: false }
    ]
  },
  {
    id: 'prod-night-bloom',
    name: 'NIGHT BLOOM',
    slug: 'night-bloom',
    subtitle: 'Sensual. Playful. Unforgettable.',
    tagline: 'Sensual. Playful. Unforgettable.',
    gender: 'women',
    collection: 'Signature Collection',
    scentProfile: 'Sensual. Playful. Unforgettable.',
    description: 'Sensual. Playful. Unforgettable. Opening with a Blush Floral Accord, blooming into Peony, Rose, and Sweet Florals over Warm Vanilla and Musk.',
    story: 'Sensual. Playful. Unforgettable. Evening blossoms wrapped in warm vanilla and soft musk.',
    notes: {
      top: ['Blush Floral Accord'],
      heart: ['Peony', 'Rose', 'Sweet Florals'],
      base: ['Warm Vanilla', 'Musk']
    },
    families: ['Floral', 'Gourmand', 'Sweet', 'Musk'],
    occasions: ['Night', 'Party', 'Wedding'],
    longevity: '',
    sillage: '',
    rating: 5.0,
    reviewCount: 0,
    isNewArrival: true,
    status: 'ACTIVE',
    themeColor: '#831843',
    accentColor: '#F472B6',
    features: [],
    variants: [
      { id: 'night-bloom-30ml', size: '30 ml', sku: 'FRG-NB-030', mrp: 699, sellingPrice: 699, stockOnHand: 0, stockReserved: 0, stockAvailable: 0, isAvailable: true, stockManaged: false },
      { id: 'night-bloom-50ml', size: '50 ml', sku: 'FRG-NB-050', mrp: 999, sellingPrice: 999, stockOnHand: 0, stockReserved: 0, stockAvailable: 0, isAvailable: true, stockManaged: false }
    ]
  },

  // ==========================================================
  // AURA COLLECTION (3 Approved Fragrances · 15 ml · ₹249 each)
  // ==========================================================
  {
    id: 'prod-moksha-essence',
    name: 'MOKSHA ESSENCE',
    slug: 'moksha-essence',
    subtitle: 'Calm. Pure. Centered.',
    tagline: 'Calm. Pure. Centered.',
    gender: 'devotional',
    collection: 'Aura Collection',
    scentProfile: 'Calm. Pure. Centered.',
    description: 'Calm. Pure. Centered. A soulful fragrance inspired by tradition and devotion, crafted with Tulsi, Lemon, and Camphor at the top, a heart of Jasmine, Lotus, and Rose, and a base of Sandalwood, Nagachampa, and Turmeric.',
    story: 'A range of soulful fragrances inspired by tradition and devotion, crafted to bring calm, clarity and divine energy into your everyday life.',
    notes: {
      top: ['Tulsi', 'Lemon', 'Camphor'],
      heart: ['Jasmine', 'Lotus', 'Rose'],
      base: ['Sandalwood', 'Nagachampa', 'Turmeric']
    },
    families: ['Sacred Wood', 'Floral', 'Fresh', 'Woody'],
    occasions: ['Daily', 'Day', 'Tradition & Devotion'],
    longevity: '',
    sillage: '',
    rating: 5.0,
    reviewCount: 0,
    isBestSeller: true,
    status: 'ACTIVE',
    themeColor: '#713F12',
    accentColor: '#EAB308',
    features: [],
    variants: [
      { id: 'moksha-essence-15ml', size: '15 ml', sku: 'FRG-ME-015', mrp: 249, sellingPrice: 249, stockOnHand: 0, stockReserved: 0, stockAvailable: 0, isAvailable: true, stockManaged: false }
    ]
  },
  {
    id: 'prod-temple-flora',
    name: 'TEMPLE FLORA',
    slug: 'temple-flora',
    subtitle: 'Divine. Floral. Uplifting.',
    tagline: 'Divine. Floral. Uplifting.',
    gender: 'devotional',
    collection: 'Aura Collection',
    scentProfile: 'Divine. Floral. Uplifting.',
    description: 'Divine. Floral. Uplifting. Opening with Lily of Valley and Patchouli, unfolding into Mogra, Lotus, and Frangipani, and resting on Javadhu, Wild Lavender, and Royal Rose.',
    story: 'A range of soulful fragrances inspired by tradition and devotion, crafted to bring calm, clarity and divine energy into your everyday life.',
    notes: {
      top: ['Lily of Valley', 'Patchouli'],
      heart: ['Mogra', 'Lotus', 'Frangipani'],
      base: ['Javadhu', 'Wild Lavender', 'Royal Rose']
    },
    families: ['Floral', 'Sacred Wood'],
    occasions: ['Day', 'Daily', 'Wedding', 'Tradition & Devotion'],
    longevity: '',
    sillage: '',
    rating: 5.0,
    reviewCount: 0,
    status: 'ACTIVE',
    themeColor: '#881337',
    accentColor: '#FB7185',
    features: [],
    variants: [
      { id: 'temple-flora-15ml', size: '15 ml', sku: 'FRG-TF-015', mrp: 249, sellingPrice: 249, stockOnHand: 0, stockReserved: 0, stockAvailable: 0, isAvailable: true, stockManaged: false }
    ]
  },
  {
    id: 'prod-divine-aura',
    name: 'DIVINE AURA',
    slug: 'divine-aura',
    subtitle: 'Sacred. Soothing. Eternal.',
    tagline: 'Sacred. Soothing. Eternal.',
    gender: 'devotional',
    collection: 'Aura Collection',
    scentProfile: 'Sacred. Soothing. Eternal.',
    description: 'Sacred. Soothing. Eternal. Crafted with Tulasi, Camphor, and Saffron at the top, a heart of Blue Lotus, Kesar Chandan, Peppermint, and Eucalyptus, and a base of Ylang Ylang and Cardamon.',
    story: 'A range of soulful fragrances inspired by tradition and devotion, crafted to bring calm, clarity and divine energy into your everyday life.',
    notes: {
      top: ['Tulasi', 'Camphor', 'Saffron'],
      heart: ['Blue Lotus', 'Kesar Chandan', 'Peppermint', 'Eucalyptus'],
      base: ['Ylang Ylang', 'Cardamon']
    },
    families: ['Sacred Wood', 'Spicy', 'Floral', 'Fresh'],
    occasions: ['Daily', 'Night', 'Tradition & Devotion'],
    longevity: '',
    sillage: '',
    rating: 5.0,
    reviewCount: 0,
    isBestSeller: true,
    status: 'ACTIVE',
    themeColor: '#7C2D12',
    accentColor: '#F59E0B',
    features: [],
    variants: [
      { id: 'divine-aura-15ml', size: '15 ml', sku: 'FRG-DA-015', mrp: 249, sellingPrice: 249, stockOnHand: 0, stockReserved: 0, stockAvailable: 0, isAvailable: true, stockManaged: false }
    ]
  },

  // ==========================================================
  // DISCOVERY COLLECTION (Preserved per owner instructions)
  // ==========================================================
  {
    id: 'prod-discovery-six',
    name: 'FRAGMORÉ DISCOVERY SIX',
    slug: 'fragmore-discovery-six',
    subtitle: 'Coffret Découverte',
    gender: 'discovery',
    collection: 'Discovery Collection',
    scentProfile: 'Curated 6-Vial Discovery Coffret',
    description: 'Experience the complete universe of FRAGMORÉ. Includes deluxe atomizers in a bespoke presentation coffret. Available in 2 ml and 10 ml flacon variations.',
    story: 'Finding your signature fragrance is a deeply personal odyssey. The Discovery Six allows you to live with each fragrance across skin, seasons, and moments before committing to a full flacon. Includes our 100% Value Back Voucher.',
    notes: {
      top: ['Golden Hour (Warm Amber)', 'Blush & Blossom (Sparkling Rose)', 'Violet Noir (Warm Leather)'],
      heart: ['Aqua Pulse (Fresh Citrus)', 'Luxe Heritage (Saffron Wood)', 'Night Bloom (Blush Peony)'],
      base: ['6 Glass Sample Vials', 'Fine-Mist Gold Atomizers', 'Olfactory Guidebook']
    },
    families: ['Fresh', 'Aromatic', 'Woody', 'Spicy', 'Floral', 'Amber'],
    occasions: ['Curated Gifting', 'Fragrance Wardrobing', 'First-Time Exploration', 'Travel'],
    longevity: 'Complete Range (8–14 Hours)',
    sillage: 'Curated Range',
    rating: 4.96,
    reviewCount: 310,
    isBestSeller: true,
    status: 'ACTIVE',
    themeColor: '#0E0E12',
    accentColor: '#D4AF37',
    features: ['6 Deluxe Spray Atomizers', 'Includes 100% Value Back Voucher for full bottle', 'Complimentary Express Delivery'],
    variants: [
      { id: 'disc-2ml', size: '2 ml', sku: 'FRG-DISC-002', mrp: 499, sellingPrice: 499, stockOnHand: 350, stockReserved: 0, stockAvailable: 350, isAvailable: true, stockManaged: true },
      { id: 'disc-10ml', size: '10 ml', sku: 'FRG-DISC-010', mrp: 1999, sellingPrice: 1499, stockOnHand: 200, stockReserved: 0, stockAvailable: 200, isAvailable: true, stockManaged: true }
    ]
  }
];

export const INITIAL_COUPONS: Coupon[] = [
  {
    code: 'FIRST10',
    discountType: 'PERCENTAGE',
    value: 10,
    minCartValue: 1999,
    maxDiscount: 1000,
    usageLimit: 500,
    timesUsed: 124,
    isActive: true,
    description: '10% off on your inaugural FRAGMORÉ order above ₹1,999',
    expiryDate: '2026-12-31'
  },
  {
    code: 'DISCOVERY1499',
    discountType: 'DISCOVERY_VOUCHER',
    value: 1499,
    minCartValue: 3899,
    usageLimit: 1000,
    timesUsed: 89,
    isActive: true,
    description: 'Redeem your ₹1,499 Discovery Six value toward any 50ml or 100ml flacon',
    expiryDate: '2026-12-31'
  },
  {
    code: 'ROYALTY',
    discountType: 'FLAT',
    value: 500,
    minCartValue: 4999,
    usageLimit: 300,
    timesUsed: 45,
    isActive: true,
    description: 'Flat ₹500 privileged saving on orders above ₹4,999',
    expiryDate: '2026-12-31'
  },
  {
    code: 'FREESHIP',
    discountType: 'FREE_SHIPPING',
    value: 200,
    minCartValue: 999,
    usageLimit: 1000,
    timesUsed: 215,
    isActive: true,
    description: 'Complimentary white-glove express insured delivery',
    expiryDate: '2026-12-31'
  }
];

export const INITIAL_INFLUENCERS: Influencer[] = [
  {
    id: 'inf-1',
    name: 'Kavya S. (The Scent Connoisseur)',
    code: 'GOLDEN10',
    commissionPercentage: 10,
    campaign: 'Signature Launch',
    clicks: 0,
    orders: 0,
    totalRevenue: 0,
    totalCommission: 0,
    status: 'ACTIVE'
  },
  {
    id: 'inf-2',
    name: 'Vikramaditya Roy',
    code: 'VIOLET10',
    commissionPercentage: 10,
    campaign: 'Nocturnal Series',
    clicks: 0,
    orders: 0,
    totalRevenue: 0,
    totalCommission: 0,
    status: 'ACTIVE'
  },
  {
    id: 'inf-3',
    name: 'Ananya Mehra',
    code: 'AURA10',
    commissionPercentage: 10,
    campaign: 'Aura Collection',
    clicks: 0,
    orders: 0,
    totalRevenue: 0,
    totalCommission: 0,
    status: 'ACTIVE'
  }
];

export const INITIAL_REVIEWS: Review[] = [
  {
    id: 'rev-1',
    productId: 'prod-golden-hour',
    productName: 'GOLDEN HOUR',
    customerName: 'Aditya Singhania',
    rating: 5,
    title: 'An absolute masterpiece of warm amber and pear',
    content: 'Golden Hour is captivating. The pear and citrus opening with the musky sunset heart lasted past 12 hours on linen. Truly unforgettable presence.',
    isVerifiedPurchase: true,
    date: '2026-08-14',
    status: 'APPROVED'
  },
  {
    id: 'rev-2',
    productId: 'prod-violet-noir',
    productName: 'VIOLET NOIR',
    customerName: 'Karanvir Malhotra',
    rating: 5,
    title: 'Dark, leather, and commanding sillage',
    content: 'The violet leaf and warm leather opening is extraordinary. A truly sophisticated evening statement. Worth every single rupee.',
    isVerifiedPurchase: true,
    date: '2026-08-20',
    status: 'APPROVED'
  },
  {
    id: 'rev-3',
    productId: 'prod-blush-and-blossom',
    productName: 'BLUSH & BLOSSOM',
    customerName: 'Dr. Meera Nambiar',
    rating: 5,
    title: 'The purest sparkling rose and orange blossom',
    content: 'Opens with sparkling rose and blossoms into chic florals over vanilla and patchouli. Gentle on the skin and exquisitely balanced.',
    isVerifiedPurchase: true,
    date: '2026-09-02',
    status: 'APPROVED'
  },
  {
    id: 'rev-4',
    productId: 'prod-moksha-essence',
    productName: 'MOKSHA ESSENCE',
    customerName: 'Suresh Narayanan',
    rating: 5,
    title: 'Divine peace in a flacon — authentic Sandalwood and Tulsi',
    content: 'The authentic sandalwood and tulsi bring an instant sense of sacred calm and divine energy. Truly a soulful fragrance.',
    isVerifiedPurchase: true,
    date: '2026-09-10',
    status: 'APPROVED'
  },
  {
    id: 'rev-5',
    productId: 'prod-luxe-heritage',
    productName: 'LUXE HERITAGE',
    customerName: 'Radhika Jhunjhunwala',
    rating: 5,
    title: 'Rich leather and saffron royalty',
    content: 'Wore this for an evening gala and received continuous compliments. The saffron and smoky richness linger beautifully.',
    isVerifiedPurchase: true,
    date: '2026-09-18',
    status: 'APPROVED'
  },
  {
    id: 'rev-6',
    productId: 'prod-discovery-six',
    productName: 'FRAGMORÉ DISCOVERY SIX',
    customerName: 'Pooja Tandon',
    rating: 5,
    title: 'Brilliant concept and the voucher made it virtually free!',
    content: 'Testing the atomizers over two weeks was such a luxurious experience. Living with each flacon before choosing a full bottle is brilliant.',
    isVerifiedPurchase: true,
    date: '2026-09-22',
    status: 'APPROVED'
  }
];

export const INITIAL_ORDERS: Order[] = [];

export const INITIAL_ABANDONED_CARTS: AbandonedCart[] = [];

export const INITIAL_CMS: CMSSettings = {
  launchMode: false,
  launchDate: '2026-10-15T00:00:00',
  heroHeadline: 'SCENT THAT STAYS WITH YOU.',
  heroTagline: 'Crafted with fine botanical extracts, noble woods, and soulful Indian heritage.',
  heroSubtagline: 'Grasse & Kannauj',
  heroCtaText: 'SHOP NOW',
  heroCtaDestination: 'featured-product',
  heroFeaturedProductSlug: 'golden-hour',
  heroPosterImageUrl: '',
  heroBottleModelUrl: '',
  heroLayeredBottleUrl: '',
  heroLayeredCapUrl: '',
  heroLayeredAtomizerUrl: '',
  heroInteractionHint: 'Tap the bottle to experience the scent.',
  heroAnimationEnabled: true,
  heroStaticFallbackUrl: '',
  announcementBarText: 'Complimentary Express Delivery on all orders above ₹999 · Handcrafted with pure botanical absolutes',
  announcementBarActive: true,
  freeShippingThreshold: 999,
  discoveryVoucherValue: 499,
  contactEmail: 'concierge@fragmore.com',
  contactPhone: '+91 (022) 6912 8800',
  headquarters: 'FRAGMORÉ, Worli Sea Face, Mumbai 400018, India',
  gstNumber: '27AABCF1234M1Z8',
  logoText: 'FRAGMORÉ',
  faviconUrl: '/favicon.ico',
  instagramUrl: 'https://instagram.com/fragmore.parfums',
  youtubeUrl: 'https://youtube.com/@fragmore',
  twitterUrl: 'https://x.com/fragmoreparfums',
  pinterestUrl: 'https://pinterest.com/fragmore',
  promoBannerText: 'LIMITED EDITION: Discovery Six includes ₹1,499 upgrade voucher',
  promoBannerActive: true,
  popupActive: false,
  popupTitle: 'Welcome to the World of FRAGMORÉ',
  popupDiscount: '10% off your inaugural creation with code PRIVILEGE10',
  fragranceDisplayOrder: [
    'golden-hour',
    'blush-and-blossom',
    'violet-noir',
    'aqua-pulse',
    'luxe-heritage',
    'flora-crush',
    'midnight-glow',
    'silky-velvet',
    'night-bloom'
  ],
  scrollStoryFragrances: [
    'golden-hour',
    'blush-and-blossom',
    'violet-noir',
    'aqua-pulse',
    'luxe-heritage',
    'flora-crush',
    'midnight-glow',
    'silky-velvet',
    'night-bloom'
  ],
  atelierConcierge: {
    visible: true,
    displayOrder: 1,
    heading: 'ATELIER CONCIERGE',
    subtitle: 'Bespoke Olfactory Guidance & Client Care',
    description: 'Experience private consultations, fragrance wardrobe curation, and dedicated order assistance with a FRAGMORÉ specialist.',
    whatsappNumber: '+91 98200 00000',
    email: 'concierge@fragmore.com',
    openingHours: 'Mon – Sat · 10:00 AM – 8:00 PM IST',
    supportingImageUrl: '/assets/editorial-flacon.webp',
    supportingImageAlt: 'FRAGMORÉ Atelier Concierge Private Consultation',
    services: [
      {
        id: 'svc-consultation',
        title: 'Private Scent Consultation',
        description: 'Speak with an olfactory specialist to discover your signature creation from our Signature or Aura Collection.',
        buttonLabel: 'Take Fragrance Finder',
        buttonDestination: 'QUIZ',
        displayOrder: 1
      },
      {
        id: 'svc-gifting',
        title: 'Bespoke Gifting & Engraving',
        description: 'Arrange luxury gift wrapping, personalized message cards, and ceremonial presentation for special occasions.',
        buttonLabel: 'Explore Collections',
        buttonDestination: 'SHOP:all',
        displayOrder: 2
      },
      {
        id: 'svc-client-care',
        title: 'Order & Delivery Assistance',
        description: 'Direct priority assistance for existing orders, shipping updates, and bespoke requests via WhatsApp or email.',
        buttonLabel: 'Track an Order',
        buttonDestination: 'TRACK_ORDER',
        displayOrder: 3
      }
    ]
  }
};

export const INITIAL_CUSTOMERS: CustomerProfile[] = [];

export const INITIAL_INTEGRATIONS: IntegrationConfig = {
  meta: {
    pixelId: '984120938472910',
    conversionsApiToken: 'EAAG9...[MASKED_ENCRYPTED_KEY_4f89]',
    testEventCode: 'TEST98231',
    status: 'CONNECTED',
    lastTested: '2026-09-27 10:14 IST'
  },
  google: {
    ga4MeasurementId: 'G-FRAGMORE88',
    gtmId: 'GTM-WM39KLX',
    googleAdsId: 'AW-981240182',
    merchantCenterId: 'MC-50192834',
    status: 'CONNECTED',
    lastTested: '2026-09-27 09:30 IST'
  },
  whatsapp: {
    provider: 'Meta Cloud API',
    apiKey: 'waba_live_sec_9938...[MASKED]',
    phoneNumberId: '109283746501928',
    templates: [
      { name: 'order_dispatched_awb', status: 'APPROVED' },
      { name: 'abandoned_cart_reminder_1hr', status: 'APPROVED' },
      { name: 'vip_concierge_invite', status: 'APPROVED' }
    ],
    status: 'CONNECTED'
  },
  sms: {
    provider: 'Msg91',
    apiKey: 'msg91_auth_9018...[MASKED]',
    senderId: 'FRGMOR',
    status: 'CONNECTED'
  },
  email: {
    provider: 'SendGrid',
    smtpHost: 'smtp.sendgrid.net',
    smtpPort: '587',
    apiKey: 'SG.e9841...[MASKED]',
    fromEmail: 'concierge@fragmore.com',
    status: 'CONNECTED'
  },
  payment: {
    gateway: 'Razorpay',
    keyId: 'rzp_live_FRAGMORE993',
    keySecret: 'sec_rzp_9841...[MASKED]',
    webhookSecret: 'whsec_9941829381',
    environment: 'LIVE',
    status: 'CONNECTED'
  },
  shipping: {
    provider: 'Shiprocket',
    apiEmail: 'logistics@fragmore.com',
    apiKey: 'sr_token_live_9921...[MASKED]',
    warehousePincode: '400018',
    status: 'CONNECTED'
  }
};

export const INITIAL_CAMPAIGNS: Campaign[] = [
  {
    id: 'camp-1',
    name: 'Aura Collection Devotional Release',
    type: 'WHATSAPP',
    status: 'ACTIVE',
    targetSegment: 'VIP & Repeat Buyers',
    scheduledDate: '2026-09-20',
    sentCount: 0,
    openRate: 0,
    clicksCount: 0,
    revenueGenerated: 0
  },
  {
    id: 'camp-2',
    name: 'Discovery Set Upgrade Reminder',
    type: 'EMAIL',
    status: 'ACTIVE',
    targetSegment: 'Discovery Buyers without Full Bottle',
    scheduledDate: '2026-09-23',
    sentCount: 0,
    openRate: 0,
    clicksCount: 0,
    revenueGenerated: 0
  },
  {
    id: 'camp-3',
    name: 'Signature Collection Showcase',
    type: 'BANNER',
    status: 'SCHEDULED',
    targetSegment: 'All Storefront Visitors',
    scheduledDate: '2026-10-01',
    sentCount: 0,
    openRate: 0,
    clicksCount: 0,
    revenueGenerated: 0
  }
];

export const INITIAL_RETURNS: ReturnRefund[] = [];

export const INITIAL_BACK_IN_STOCK: BackInStockItem[] = [];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [];


