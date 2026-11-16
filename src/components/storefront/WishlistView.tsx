import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { FragmoreBottleVisual } from './FragmoreBottleVisual';
import { Heart, ShoppingBag, ArrowLeft, Trash2, Sparkles, Check, ExternalLink } from 'lucide-react';

export const WishlistView: React.FC = () => {
  const {
    wishlist,
    products,
    toggleWishlist,
    addToCart,
    setSelectedProductSlug,
    setCurrentView,
    showNotification,
    customer,
    setIsAuthModalOpen
  } = useStore();

  // Selected variant size for each product card
  const [selectedSizes, setSelectedSizes] = useState<Record<string, string>>({});
  const [addedItemSlug, setAddedItemSlug] = useState<string | null>(null);

  // Filter products that are in the user's wishlist (only when signed in)
  const wishlistedProducts = customer ? products.filter((p) => wishlist.includes(p.slug)) : [];

  const handleSizeChange = (productSlug: string, size: string) => {
    setSelectedSizes((prev) => ({ ...prev, [productSlug]: size }));
  };

  const handleAddToCart = (product: (typeof products)[0]) => {
    if (!customer) {
      showNotification('Please sign in to add items to your shopping bag.');
      setIsAuthModalOpen(true);
      return;
    }
    const validVars = product.variants.filter((v) => v.isAvailable !== false && v.sellingPrice > 0);
    const chosenSize =
      selectedSizes[product.slug] || validVars[0]?.size || product.variants[0]?.size || '30 ml';
    addToCart(product, chosenSize, 1);
    setAddedItemSlug(product.slug);
    showNotification(`Added ${product.name} (${chosenSize}) to your bag.`);
    setTimeout(() => {
      setAddedItemSlug(null);
    }, 2000);
  };

  const handleOpenPdp = (slug: string) => {
    setSelectedProductSlug(slug);
    setCurrentView('product');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#08080A] text-[#F3EFE6] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* Header Breadcrumb & Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-8 border-b border-white/10 gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono tracking-widest text-[#D4AF37] uppercase mb-2">
              <Heart className="w-4 h-4 fill-[#D4AF37] text-[#D4AF37]" />
              <span>Personal Olfactory Curation</span>
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl tracking-widest font-light text-white uppercase">
              My Wishlist
            </h1>
            <p className="text-xs text-white/60 font-mono mt-1">
              {wishlistedProducts.length === 1
                ? '1 Creation Saved'
                : `${wishlistedProducts.length} Creations Saved`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentView('shop')}
              className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-mono uppercase tracking-wider text-white rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Continue Shopping</span>
            </button>
            <button
              onClick={() => setCurrentView('storefront')}
              className="px-5 py-2.5 border border-[#D4AF37]/50 text-[#E5C378] hover:bg-[#D4AF37]/10 text-xs font-mono uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
            >
              Explore Maison
            </button>
          </div>
        </div>

        {/* Empty State */}
        {wishlistedProducts.length === 0 ? (
          <div className="py-24 text-center max-w-lg mx-auto bg-[#0E0E14] border border-white/10 rounded-2xl p-8 sm:p-12 space-y-6">
            <div className="w-20 h-20 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center mx-auto text-[#D4AF37]">
              <Heart className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h2 className="font-serif text-2xl uppercase tracking-wider text-white">
                Your Wishlist is Empty
              </h2>
              <p className="text-xs text-white/60 leading-relaxed font-light">
                You have not saved any fragrances yet. Explore the Signature Collection or the Aura Collection (15 ml · ₹249 each) and tap the heart icon on any creation to save it here.
              </p>
            </div>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => setCurrentView('shop')}
                className="w-full sm:w-auto px-7 py-3 bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] font-semibold text-xs uppercase tracking-widest rounded-lg transition-all shadow-lg shadow-[#D4AF37]/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Explore Fragrance Catalogue</span>
              </button>
            </div>
          </div>
        ) : (
          /* Wishlist Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {wishlistedProducts.map((prod) => {
              const purchasableVars = prod.variants.filter(
                (v) => v.isAvailable !== false && v.sellingPrice > 0
              );
              const variants =
                purchasableVars.length > 0 ? purchasableVars : prod.variants;
              const currentSelectedSize =
                selectedSizes[prod.slug] || variants[0]?.size || '30 ml';
              const currentVariant =
                variants.find((v) => v.size === currentSelectedSize) || variants[0];

              return (
                <div
                  key={prod.id}
                  className="bg-[#0E0E14] border border-white/10 rounded-2xl overflow-hidden flex flex-col hover:border-[#D4AF37]/40 transition-all duration-300 group shadow-xl"
                >
                  {/* Visual Image Header */}
                  <div className="relative aspect-[4/5] bg-gradient-to-b from-[#181822] to-[#0A0A0E] overflow-hidden flex items-center justify-center p-6">
                    <div
                      onClick={() => handleOpenPdp(prod.slug)}
                      className="cursor-pointer w-full h-full flex items-center justify-center transition-transform duration-500 group-hover:scale-105"
                    >
                      <FragmoreBottleVisual
                        slug={prod.slug}
                        size={currentVariant?.size}
                        variant={currentVariant}
                        productName={prod.name}
                        productTagline={prod.subtitle}
                        collection={prod.collection}
                        className="w-44 h-60"
                        showGlow={false}
                        showShadow={false}
                      />
                    </div>

                    {/* Top Badges */}
                    <div className="absolute top-4 left-4 flex flex-col gap-1.5">
                      <span className="px-2.5 py-1 bg-black/60 backdrop-blur-md border border-[#D4AF37]/40 text-[#E5C378] text-[10px] font-mono uppercase tracking-wider rounded-md">
                        {prod.collection}
                      </span>
                    </div>

                    {/* Remove from Wishlist Button */}
                    <button
                      onClick={() => toggleWishlist(prod.slug)}
                      className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/70 backdrop-blur-md border border-white/20 flex items-center justify-center text-[#D4AF37] hover:bg-rose-500/20 hover:border-rose-500/40 hover:text-rose-400 transition-colors cursor-pointer"
                      title="Remove from wishlist"
                      aria-label="Remove from wishlist"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Body Content */}
                  <div className="p-6 flex-1 flex flex-col justify-between space-y-5">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-mono text-white/50 uppercase tracking-widest">
                        <span>{prod.subtitle || 'Extrait de Parfum'}</span>
                        <span className="text-[#D4AF37] font-semibold">{prod.gender}</span>
                      </div>

                      <h3
                        onClick={() => handleOpenPdp(prod.slug)}
                        className="font-serif text-2xl uppercase tracking-wider text-white hover:text-[#D4AF37] cursor-pointer transition-colors"
                      >
                        {prod.name}
                      </h3>

                      <p className="text-xs text-[#D1CECB] font-light line-clamp-2 leading-relaxed">
                        {prod.scentProfile}
                      </p>

                      {/* Olfactory Notes Mini Pill */}
                      {prod.notes && (
                        <div className="pt-2 flex flex-wrap gap-1.5">
                          {Array.isArray(prod.notes.top) && prod.notes.top.slice(0, 2).map((note, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[10px] font-mono text-white/70"
                            >
                              {note}
                            </span>
                          ))}
                          {Array.isArray(prod.notes.base) && prod.notes.base.slice(0, 1).map((note, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded text-[10px] font-mono text-[#E5C378]"
                            >
                              {note}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Size Selector & Price */}
                    <div className="space-y-4 pt-4 border-t border-white/10">
                      {/* Variant Size Selector Buttons */}
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-white/50 uppercase">Flacon:</span>
                        <div className="flex items-center gap-1.5 flex-1 overflow-x-auto">
                          {variants.map((v) => (
                            <button
                              key={v.id}
                              onClick={() => handleSizeChange(prod.slug, v.size)}
                              className={`px-2.5 py-1 rounded text-[11px] font-mono uppercase tracking-wider transition-all whitespace-nowrap ${
                                currentSelectedSize === v.size
                                  ? 'bg-[#D4AF37] text-[#08080A] font-bold shadow'
                                  : 'bg-white/5 text-white/70 hover:text-white hover:bg-white/10 border border-white/10'
                              }`}
                            >
                              {v.size}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Price Tier */}
                      <div className="flex items-baseline justify-between">
                        <div className="flex items-baseline gap-2 font-mono">
                          <span className="text-xl font-bold text-[#D4AF37]">
                            ₹{currentVariant.sellingPrice.toLocaleString('en-IN')}
                          </span>
                          {currentVariant.mrp > currentVariant.sellingPrice && (
                            <span className="text-xs text-white/40 line-through">
                              ₹{currentVariant.mrp.toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-emerald-400">
                          {currentVariant.stockAvailable > 0 ? 'In Stock' : 'Pre-Order'}
                        </span>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleAddToCart(prod)}
                          className="flex-1 py-3 bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] font-bold text-xs uppercase tracking-widest rounded-lg flex items-center justify-center gap-2 transition-all shadow-md shadow-[#D4AF37]/15"
                        >
                          {addedItemSlug === prod.slug ? (
                            <>
                              <Check className="w-4 h-4 text-emerald-900" />
                              <span>Added to Bag</span>
                            </>
                          ) : (
                            <>
                              <ShoppingBag className="w-4 h-4" />
                              <span>Add To Bag</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleOpenPdp(prod.slug)}
                          className="p-3 bg-white/5 hover:bg-white/10 border border-white/15 text-white/80 hover:text-[#D4AF37] rounded-lg transition-colors"
                          title="View product details"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
