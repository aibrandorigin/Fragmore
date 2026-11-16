import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { Search, X, ArrowRight, Sparkles } from 'lucide-react';
import { FragmoreBottleVisual } from './FragmoreBottleVisual';

export const SearchModal: React.FC = () => {
  const {
    isSearchOpen,
    setIsSearchOpen,
    products,
    setSelectedProductSlug,
    setCurrentView,
    trackEvent
  } = useStore();

  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const activeProducts = products.filter((p) => p.status === 'ACTIVE');
    if (!query.trim()) return activeProducts.slice(0, 4);
    const q = query.toLowerCase();
    return activeProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.subtitle.toLowerCase().includes(q) ||
        p.scentProfile.toLowerCase().includes(q) ||
        p.collection.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.families.some((f) => f.toLowerCase().includes(q)) ||
        p.occasions.some((o) => o.toLowerCase().includes(q)) ||
        p.notes.top.some((n) => n.toLowerCase().includes(q)) ||
        p.notes.heart.some((n) => n.toLowerCase().includes(q)) ||
        p.notes.base.some((n) => n.toLowerCase().includes(q))
    );
  }, [query, products]);

  if (!isSearchOpen) return null;

  const handleSelectProduct = (slug: string) => {
    trackEvent('SearchSelect', { query, selectedSlug: slug });
    setIsSearchOpen(false);
    setSelectedProductSlug(slug);
    setCurrentView('product');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const quickTags = [
    'Golden Hour',
    'Violet Noir',
    'Luxe Heritage',
    'Moksha Essence',
    'Temple Flora',
    'Divine Aura',
    'Vanilla',
    'Sandalwood'
  ];

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) setIsSearchOpen(false);
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto"
    >
      <div className="bg-stone-950 border border-white/15 rounded-2xl max-w-3xl w-full my-auto max-h-[88vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Search Input Bar */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center space-x-3 sm:space-x-4 shrink-0">
          <Search className="w-5 h-5 text-amber-400 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by fragrance name, collection, note (e.g., Saffron, Rose, Tulsi, Vanilla)..."
            className="w-full bg-transparent text-white placeholder-stone-500 text-sm sm:text-base focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-xs text-stone-400 hover:text-white uppercase tracking-widest cursor-pointer"
            >
              Clear
            </button>
          )}
          <button
            onClick={() => setIsSearchOpen(false)}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-stone-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Search Pills */}
        <div className="px-4 sm:px-6 py-2.5 bg-stone-900/50 border-b border-white/5 flex items-center flex-wrap gap-1.5 sm:gap-2 shrink-0">
          <span className="text-[10px] uppercase tracking-widest text-stone-400 mr-2 flex items-center">
            <Sparkles className="w-3 h-3 text-amber-400 mr-1" /> Popular Searches:
          </span>
          {quickTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setQuery(tag)}
              className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-amber-500/20 hover:text-amber-300 border border-white/10 text-[11px] text-stone-300 transition-colors cursor-pointer"
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Results */}
        <div className="p-4 sm:p-6 flex-1 min-h-0 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs uppercase tracking-widest text-stone-400">
              {query.trim() ? `Matching Creations (${results.length})` : 'Featured Creations'}
            </span>
          </div>

          {results.length === 0 ? (
            <div className="text-center py-12">
              <p className="font-serif text-xl text-white mb-2">
                No fragrances found for "{query}"
              </p>
              <p className="text-xs text-stone-400">
                Try searching for notes like "Amber", "Rose", "Leather", "Tulsi", or "Sandalwood".
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {results.map((prod) => {
                const defaultVar =
                  prod.variants.find((v) => v.isAvailable !== false && v.sellingPrice > 0) ||
                  prod.variants[0];
                return (
                  <div
                    key={prod.id}
                    onClick={() => handleSelectProduct(prod.slug)}
                    className="group p-4 rounded-xl bg-stone-900/60 border border-white/10 hover:border-amber-500/40 transition-all cursor-pointer flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-3.5">
                      <div className="w-12 h-16 rounded-lg shrink-0 flex items-center justify-center border border-white/15 bg-black/40 overflow-hidden">
                        <FragmoreBottleVisual
                          slug={prod.slug}
                          size={defaultVar?.size}
                          variant={defaultVar}
                          productName={prod.name}
                          collection={prod.collection}
                          className="w-10 h-14"
                          showGlow={false}
                          showShadow={false}
                        />
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-widest text-amber-400 block">
                          {prod.collection} · {defaultVar?.size}
                        </span>
                        <h4 className="font-serif text-base text-white group-hover:text-amber-200">
                          {prod.name}
                        </h4>
                        <p className="text-[11px] text-stone-400">
                          {prod.subtitle || prod.scentProfile}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-serif text-sm text-white font-semibold block">
                        ₹{(defaultVar?.sellingPrice || 0).toLocaleString('en-IN')}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-stone-400 group-hover:text-amber-300 ml-auto mt-1" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
