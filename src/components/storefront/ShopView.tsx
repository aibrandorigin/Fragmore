import React, { useState, useMemo, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useStore } from '../../context/StoreContext';
import { Heart, ShoppingBag, SlidersHorizontal, Compass, X } from 'lucide-react';
import { FragmoreBottleVisual } from './FragmoreBottleVisual';

export const ShopView: React.FC = () => {
  const {
    products,
    orders,
    selectedCategoryFilter,
    setSelectedCategoryFilter,
    setSelectedProductSlug,
    setCurrentView,
    addToCart,
    toggleWishlist,
    isInWishlist,
    setIsQuizOpen
  } = useStore();

  const [selectedFamily, setSelectedFamily] = useState<string>('All');
  const [selectedSizeFilter, setSelectedSizeFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<string>('featured');
  const [cardSelectedSize, setCardSelectedSize] = useState<Record<string, string>>({});
  const gridCardsRef = useRef<(HTMLDivElement | null)[]>([]);

  const families = [
    'All',
    'Floral',
    'Woody',
    'Amber',
    'Fresh',
    'Fruity',
    'Gourmand',
    'Spicy',
    'Leather',
    'Sacred Wood'
  ];
  const sizes = ['All', '15 ml', '30 ml', '50 ml'];

  // Compute real order sales count per product ID/name for Bestsellers ranking
  const salesByProduct = useMemo(() => {
    const map: Record<string, number> = {};
    for (const ord of orders) {
      if (ord.orderStatus === 'CANCELLED' || ord.orderStatus === 'RETURNED') continue;
      for (const item of ord.items || []) {
        const keyId = item.productId;
        const keyName = (item.productName || '').toUpperCase();
        if (keyId) map[keyId] = (map[keyId] || 0) + (item.quantity || 1);
        if (keyName) map[keyName] = (map[keyName] || 0) + (item.quantity || 1);
      }
    }
    return map;
  }, [orders]);

  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        if (p.status !== 'ACTIVE') return false;

        if (selectedCategoryFilter && selectedCategoryFilter !== 'all') {
          if (selectedCategoryFilter === 'Signature Collection') {
            if (p.collection !== 'Signature Collection') return false;
          } else if (
            selectedCategoryFilter === 'Aura Collection' ||
            selectedCategoryFilter === 'devotional'
          ) {
            if (p.collection !== 'Aura Collection' && p.gender !== 'devotional') return false;
          } else if (selectedCategoryFilter === 'bestsellers') {
            const soldCount =
              (salesByProduct[p.id] || 0) + (salesByProduct[p.name.toUpperCase()] || 0);
            if (!p.isBestSeller && soldCount <= 0) return false;
          } else if (selectedCategoryFilter === 'new-arrivals') {
            const isFlaggedNew =
              Boolean(p.isNewArrival) ||
              (p.badge || '').toLowerCase().includes('new') ||
              p.collection === 'Aura Collection';
            if (!isFlaggedNew && p.collection !== 'Signature Collection') return false;
          } else if (selectedCategoryFilter === 'discovery') {
            const isDiscoveryMatch =
              p.collection === 'Discovery Collection' ||
              p.gender === 'discovery' ||
              p.collection === 'Signature Collection' ||
              p.collection === 'Aura Collection';
            if (!isDiscoveryMatch) return false;
          } else if (selectedCategoryFilter.startsWith('occasion:')) {
            const targetOccasion = selectedCategoryFilter.replace('occasion:', '').trim().toLowerCase();
            const prodOccasions = (p.occasions || []).map((o) => o.toLowerCase());
            const matchesOccasion = prodOccasions.some(
              (o) =>
                o === targetOccasion ||
                o.includes(targetOccasion) ||
                targetOccasion.includes(o)
            );
            if (!matchesOccasion) return false;
          } else if (selectedCategoryFilter.startsWith('family:')) {
            const targetFamily = selectedCategoryFilter.replace('family:', '').trim().toLowerCase();
            const prodFamilies = (p.families || []).map((f) => f.toLowerCase());
            const matchesFamily = prodFamilies.some(
              (f) =>
                f === targetFamily ||
                f.includes(targetFamily) ||
                (targetFamily === 'fresh' && (f === 'citrus' || f === 'aromatic')) ||
                (targetFamily === 'gourmand' && f === 'sweet') ||
                (targetFamily === 'woody' && f === 'sacred wood')
            );
            if (!matchesFamily) return false;
          } else if (
            p.gender !== selectedCategoryFilter &&
            p.collection !== selectedCategoryFilter
          ) {
            return false;
          }
        }

        if (selectedFamily !== 'All') {
          const famLower = selectedFamily.toLowerCase();
          const hasFam = (p.families || []).some((f) => f.toLowerCase() === famLower);
          if (!hasFam) return false;
        }

        if (
          selectedSizeFilter !== 'All' &&
          !p.variants.some(
            (v) => v.size === selectedSizeFilter && v.isAvailable && v.sellingPrice > 0
          )
        ) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (selectedCategoryFilter === 'bestsellers') {
          const salesA =
            (salesByProduct[a.id] || 0) +
            (salesByProduct[a.name.toUpperCase()] || 0) +
            (a.isBestSeller ? 5 : 0);
          const salesB =
            (salesByProduct[b.id] || 0) +
            (salesByProduct[b.name.toUpperCase()] || 0) +
            (b.isBestSeller ? 5 : 0);
          if (salesB !== salesA) return salesB - salesA;
        }
        const priceA =
          a.variants.find((v) => v.isAvailable && v.sellingPrice > 0)?.sellingPrice ||
          a.variants[0]?.sellingPrice ||
          0;
        const priceB =
          b.variants.find((v) => v.isAvailable && v.sellingPrice > 0)?.sellingPrice ||
          b.variants[0]?.sellingPrice ||
          0;
        if (sortBy === 'price-asc') return priceA - priceB;
        if (sortBy === 'price-desc') return priceB - priceA;
        return 0;
      });
  }, [products, selectedCategoryFilter, selectedFamily, selectedSizeFilter, sortBy, salesByProduct]);

  useEffect(() => {
    const mqMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mqMotion.matches) return;
    const cards = gridCardsRef.current.slice(0, filteredProducts.length).filter(Boolean) as HTMLDivElement[];
    if (cards.length === 0) return;

    const tl = gsap.timeline({ delay: 0.12 });
    tl.fromTo(
      cards,
      { opacity: 0, y: 44, scale: 0.96 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.82,
        stagger: 0.08,
        ease: 'power3.out'
      }
    );
    return () => {
      tl.kill();
    };
  }, [filteredProducts]);

  const handleOpenProduct = (slug: string) => {
    setSelectedProductSlug(slug);
    setCurrentView('product');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const categoryTabs = [
    { id: 'all', label: 'Shop All' },
    { id: 'Signature Collection', label: 'Signature Collection (9)' },
    { id: 'Aura Collection', label: 'Aura Collection · 15 ml (3)' },
    { id: 'bestsellers', label: 'Bestsellers' },
    { id: 'new-arrivals', label: 'New Arrivals' },
    { id: 'discovery', label: 'Gift Sets & Discovery' }
  ];

  const getActiveFilterTitle = () => {
    if (selectedCategoryFilter === 'all') return 'ALL PUBLISHED FRAGRANCES';
    if (selectedCategoryFilter === 'devotional') return 'AURA COLLECTION';
    if (selectedCategoryFilter === 'bestsellers') return 'BESTSELLING CREATIONS';
    if (selectedCategoryFilter === 'new-arrivals') return 'NEW ARRIVALS';
    if (selectedCategoryFilter === 'discovery') return 'GIFT SETS & DISCOVERY';
    if (selectedCategoryFilter.startsWith('occasion:')) {
      return `OCCASION · ${selectedCategoryFilter.replace('occasion:', '').toUpperCase()}`;
    }
    if (selectedCategoryFilter.startsWith('family:')) {
      return `NOTE PROFILE · ${selectedCategoryFilter.replace('family:', '').toUpperCase()}`;
    }
    return selectedCategoryFilter.toUpperCase();
  };

  const getHeaderSubtitle = () => {
    if (selectedCategoryFilter === 'Signature Collection') {
      return 'Nine approved Eau de Parfum creations available in 30 ml (₹699) and 50 ml (₹999; Luxe Heritage ₹699).';
    }
    if (selectedCategoryFilter === 'Aura Collection' || selectedCategoryFilter === 'devotional') {
      return 'Scents for a higher you. A range of soulful fragrances inspired by tradition and devotion — 15 ml at ₹249 each.';
    }
    if (selectedCategoryFilter.startsWith('occasion:')) {
      return `Published FRAGMORÉ creations curated for ${selectedCategoryFilter.replace('occasion:', '')}.`;
    }
    if (selectedCategoryFilter.startsWith('family:')) {
      return `Published FRAGMORÉ creations featuring ${selectedCategoryFilter.replace('family:', '')} olfactory notes.`;
    }
    return 'Explore the published FRAGMORÉ Signature Collection (9 fragrances) and Aura Collection (3 fragrances · 15 ml at ₹249 each).';
  };

  return (
    <div className="min-h-screen pt-12 pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto bg-[var(--bg-main)] text-[var(--text-main)] transition-colors duration-300">
      {/* Header Banner */}
      <div className="text-center max-w-3xl mx-auto mb-10">
        <span className="text-xs font-mono uppercase tracking-[0.32em] text-[var(--accent-gold)] block mb-2.5">
          FRAGMORÉ Official Catalogue
        </span>
        <h1 className="font-serif text-3xl sm:text-5xl text-[var(--text-main)] tracking-[0.12em] uppercase mb-3">
          {getActiveFilterTitle()}
        </h1>
        <p className="text-[var(--text-secondary)] text-sm leading-relaxed">{getHeaderSubtitle()}</p>
      </div>

      {/* Category Pills & Filter Controls */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-5 mb-10 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-[var(--border-subtle)]">
          <div className="flex flex-wrap items-center gap-2">
            {categoryTabs.map((tab) => {
              const isActive =
                selectedCategoryFilter === tab.id ||
                (tab.id === 'Aura Collection' && selectedCategoryFilter === 'devotional');
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedCategoryFilter(tab.id)}
                  className={`px-4 py-2 rounded-full text-xs uppercase tracking-[0.16em] transition-all cursor-pointer border ${
                    isActive
                      ? 'bg-[var(--text-main)] text-[var(--bg-main)] border-[var(--text-main)] font-semibold shadow-xs'
                      : 'bg-[var(--bg-main)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-main)] hover:border-[var(--accent-gold)]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}

            {(selectedCategoryFilter.startsWith('occasion:') ||
              selectedCategoryFilter.startsWith('family:')) && (
              <button
                type="button"
                onClick={() => setSelectedCategoryFilter('all')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[var(--accent-gold)]/15 border border-[var(--accent-gold)] text-xs font-mono uppercase tracking-wider text-[var(--text-main)] cursor-pointer"
              >
                <span>{selectedCategoryFilter.replace(/^(occasion|family):/, '')}</span>
                <X className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsQuizOpen(true)}
            className="inline-flex items-center space-x-2 text-xs uppercase tracking-[0.16em] text-[var(--text-main)] hover:border-[var(--accent-gold)] px-4 py-2 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] transition-all cursor-pointer"
          >
            <Compass className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
            <span>Fragrance Finder Quiz</span>
          </button>
        </div>

        {/* Sub-filters */}
        <div className="pt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
              <span className="text-xs uppercase tracking-wider text-[var(--text-secondary)]">
                Note Profile:
              </span>
              <select
                value={selectedFamily}
                onChange={(e) => setSelectedFamily(e.target.value)}
                className="bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-gold)]"
              >
                {families.map((fam) => (
                  <option key={fam} value={fam}>
                    {fam}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-xs uppercase tracking-wider text-[var(--text-secondary)]">
                Size:
              </span>
              <select
                value={selectedSizeFilter}
                onChange={(e) => setSelectedSizeFilter(e.target.value)}
                className="bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-gold)]"
              >
                {sizes.map((sz) => (
                  <option key={sz} value={sz}>
                    {sz}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-xs font-mono text-[var(--text-secondary)]">
              {filteredProducts.length} Creations
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-gold)]"
            >
              <option value="featured">Sort: Featured</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Product Grid */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-20 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)]">
          <p className="font-serif text-2xl text-[var(--text-main)] mb-2">
            No creations match your current filter
          </p>
          <p className="text-[var(--text-secondary)] text-sm mb-6">
            Try clearing your scent profile, occasion, or bottle size filter to view the published collection.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedCategoryFilter('all');
              setSelectedFamily('All');
              setSelectedSizeFilter('All');
            }}
            className="px-6 py-2.5 bg-[var(--text-main)] text-[var(--bg-main)] font-semibold text-xs uppercase tracking-widest rounded-full cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredProducts.map((product, idx) => {
            const purchasableVariants = product.variants.filter(
              (v) => v.isAvailable !== false && v.sellingPrice > 0
            );
            const activeSize =
              cardSelectedSize[product.id] ||
              purchasableVariants[0]?.size ||
              product.variants[0]?.size ||
              '30 ml';
            const selectedVariant =
              purchasableVariants.find((v) => v.size === activeSize) ||
              purchasableVariants[0] ||
              product.variants[0];

            const wishlisted = isInWishlist(product.slug);
            const isVariantAvailable =
              !!selectedVariant &&
              selectedVariant.isAvailable !== false &&
              selectedVariant.sellingPrice > 0 &&
              (selectedVariant.stockManaged === false || selectedVariant.stockAvailable > 0);

            return (
              <div
                key={product.id}
                ref={(el) => {
                  gridCardsRef.current[idx] = el;
                }}
                className="group relative rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent-gold)] transition-all duration-500 overflow-hidden flex flex-col justify-between shadow-2xs hover:-translate-y-2 will-change-transform"
              >
                <div>
                  {/* Photographic Studio Flacon Stage */}
                  <div
                    onClick={() => handleOpenProduct(product.slug)}
                    className="relative h-80 cursor-pointer overflow-hidden flex flex-col items-center justify-center p-6 bg-[var(--bg-main)] border-b border-[var(--border-subtle)]"
                  >
                    {/* Subtle Studio Key Light & Plinth Gradient */}
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background:
                          'radial-gradient(circle at 50% 42%, var(--studio-key-light) 0%, var(--studio-side-fill) 62%, var(--bg-secondary) 100%)'
                      }}
                    />

                    {/* Top Badges */}
                    <div className="w-full flex items-center justify-between absolute top-4 left-0 px-4 z-10">
                      <span className="px-3 py-1 rounded-full bg-[var(--bg-surface)]/90 backdrop-blur-md border border-[var(--border-subtle)] text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--accent-gold)] font-medium">
                        {product.badge || product.collection}
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleWishlist(product.slug);
                        }}
                        aria-label="Toggle Wishlist"
                        className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
                          wishlisted
                            ? 'bg-rose-500/15 border-rose-500 text-rose-500'
                            : 'bg-[var(--bg-surface)]/90 border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${wishlisted ? 'fill-rose-500' : ''}`} />
                      </button>
                    </div>

                    {/* Variant-Matched Bottle Visual */}
                    <div className="my-auto flex flex-col items-center relative z-10 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-2.5 group-hover:scale-105">
                      <FragmoreBottleVisual
                        slug={product.slug}
                        size={selectedVariant?.size}
                        variant={selectedVariant}
                        productName={product.name}
                        productTagline={product.subtitle}
                        collection={product.collection}
                        className="w-40 h-56 group-hover:scale-105 transition-transform duration-500"
                        interactive
                        showGlow={false}
                        showShadow={true}
                      />
                    </div>

                    {/* Collection Tag */}
                    <div className="w-full flex items-center justify-between text-[10px] text-[var(--text-secondary)] uppercase tracking-widest z-10 mt-2">
                      <span>{product.collection}</span>
                      {selectedVariant?.sku && (
                        <span className="font-mono">{selectedVariant.sku}</span>
                      )}
                    </div>
                  </div>

                  {/* Product Details */}
                  <div className="p-6 pb-4">
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-[var(--accent-gold)] mb-1">
                      <span>{product.subtitle || product.scentProfile}</span>
                    </div>

                    <h3
                      onClick={() => handleOpenProduct(product.slug)}
                      className="font-serif text-2xl text-[var(--text-main)] tracking-wider mb-3 cursor-pointer group-hover:text-[var(--accent-gold)] transition-colors"
                    >
                      {product.name}
                    </h3>

                    {/* Structured Notes Summary */}
                    <div className="space-y-1.5 text-xs border-t border-[var(--border-subtle)] pt-3 mb-4">
                      <div className="flex justify-between gap-2">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-secondary)] shrink-0">
                          Top:
                        </span>
                        <span className="text-[var(--text-main)] text-right truncate">
                          {product.notes.top.join(', ')}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-secondary)] shrink-0">
                          Heart:
                        </span>
                        <span className="text-[var(--text-main)] text-right truncate">
                          {product.notes.heart.join(', ')}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-secondary)] shrink-0">
                          Base:
                        </span>
                        <span className="text-[var(--text-main)] text-right truncate">
                          {product.notes.base.join(', ')}
                        </span>
                      </div>
                    </div>

                    {/* Variant Size Selector Buttons */}
                    {purchasableVariants.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {purchasableVariants.map((v) => {
                          const isSelected = v.size === selectedVariant?.size;
                          return (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() =>
                                setCardSelectedSize((prev) => ({
                                  ...prev,
                                  [product.id]: v.size
                                }))
                              }
                              className={`px-3 py-1.5 rounded-lg text-[11px] font-mono uppercase tracking-wider border transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-[var(--text-main)] border-[var(--text-main)] text-[var(--bg-main)] font-semibold'
                                  : 'bg-[var(--bg-main)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--accent-gold)] hover:text-[var(--text-main)]'
                              }`}
                            >
                              {v.size} · ₹{v.sellingPrice.toLocaleString('en-IN')}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Price & Add to Bag */}
                <div className="px-6 pb-6 pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-[var(--text-secondary)] uppercase tracking-wider block">
                      {selectedVariant?.size || 'Edition'}
                    </span>
                    <div className="flex items-baseline space-x-2">
                      <span className="font-serif text-xl text-[var(--text-main)] font-semibold">
                        ₹{(selectedVariant?.sellingPrice || 0).toLocaleString('en-IN')}
                      </span>
                      {selectedVariant && selectedVariant.mrp > selectedVariant.sellingPrice && (
                        <span className="text-xs text-[var(--text-secondary)] line-through">
                          ₹{selectedVariant.mrp.toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      selectedVariant && addToCart(product, selectedVariant.size, 1)
                    }
                    disabled={!isVariantAvailable}
                    className={`px-4 py-2.5 rounded-full font-semibold text-xs uppercase tracking-wider flex items-center space-x-2 transition-all cursor-pointer ${
                      isVariantAvailable
                        ? 'bg-[var(--text-main)] text-[var(--bg-main)] hover:bg-[var(--accent-gold)]'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] cursor-not-allowed'
                    }`}
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>
                      {isVariantAvailable
                        ? `Add ${selectedVariant?.size || ''}`
                        : 'Unavailable'}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
