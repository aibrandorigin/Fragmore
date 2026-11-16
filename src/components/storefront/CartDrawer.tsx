import React from 'react';
import { useStore } from '../../context/StoreContext';
import { X, ShoppingBag, Trash2, Plus, Minus, Gift, Truck, ArrowRight, Sparkles, AlertTriangle } from 'lucide-react';
import { FragmoreBottleVisual } from './FragmoreBottleVisual';

export const CartDrawer: React.FC = () => {
  const {
    products,
    isMiniCartOpen,
    setIsMiniCartOpen,
    cart,
    removeFromCart,
    updateCartQuantity,
    toggleGiftWrap,
    setCurrentView,
    setSelectedProductSlug,
    setSelectedCategoryFilter,
    customer,
    setIsAuthModalOpen,
    showNotification
  } = useStore();

  if (!isMiniCartOpen) return null;

  const progressToFreeShipping = Math.min(100, (cart.subtotal / cart.freeShippingThreshold) * 100);
  const amountRemainingForFreeShipping = Math.max(0, cart.freeShippingThreshold - cart.subtotal);

  // Check if any item in cart is an unavailable 10 ml Aura/Devotional variant or archived product
  const unavailableItems = cart.items.filter((item) => {
    const isLegacy10ml = item.size.trim().toLowerCase() === '10 ml';
    const matchedProd = products.find((p) => p.id === item.productId || p.slug === item.slug);
    const matchedVar = matchedProd?.variants.find(
      (v) => v.id === item.variantId || v.size === item.size
    );
    const isArchivedOrUnavailable =
      !matchedProd ||
      matchedProd.status === 'ARCHIVED' ||
      matchedProd.status === 'INACTIVE' ||
      !matchedVar ||
      matchedVar.isAvailable === false;
    return isLegacy10ml || isArchivedOrUnavailable;
  });

  const hasUnavailableItems = unavailableItems.length > 0;

  const handleProceedToCheckout = () => {
    if (hasUnavailableItems) return;
    if (!customer) {
      setIsMiniCartOpen(false);
      showNotification('Please sign in to proceed to checkout.');
      setIsAuthModalOpen(true);
      return;
    }
    setIsMiniCartOpen(false);
    setCurrentView('checkout');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={() => setIsMiniCartOpen(false)}
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-stone-950 border-l border-white/10 flex flex-col justify-between text-stone-100 shadow-2xl">
          {/* Header */}
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <ShoppingBag className="w-5 h-5 text-amber-400" />
                <h2 className="font-serif text-xl tracking-wider text-white">YOUR SHOPPING BAG</h2>
                <span className="px-2.5 py-0.5 text-xs rounded-full bg-amber-500/20 text-amber-300 font-medium">
                  {cart.items.reduce((sum, i) => sum + i.quantity, 0)}
                </span>
              </div>
              <button
                onClick={() => setIsMiniCartOpen(false)}
                className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-stone-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Complimentary Gift & Free Shipping Milestones (₹999 -> 2ml Sample Free, ₹2,499 -> 1 Aura Perfume Free) */}
            <div className="bg-stone-900/90 rounded-xl p-3.5 border border-amber-500/25 space-y-2.5">
              <div className="flex items-start space-x-2 text-xs">
                <Gift className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                {cart.subtotal >= 2499 ? (
                  <span className="text-emerald-400 font-medium leading-snug">
                    Unlocked: <strong>2 ml Sample FREE</strong> + <strong>1 Aura Perfume FREE</strong> + Free Shipping!
                  </span>
                ) : cart.subtotal >= 999 ? (
                  <span className="text-stone-200 leading-snug">
                    <strong className="text-emerald-400">2 ml Sample FREE Unlocked!</strong> Add{' '}
                    <strong className="text-amber-300">
                      ₹{(2499 - cart.subtotal).toLocaleString('en-IN')}
                    </strong>{' '}
                    more to get <strong className="text-amber-300">1 Aura Perfume FREE</strong> (worth ₹2,499+ tier)
                  </span>
                ) : (
                  <span className="text-stone-300 leading-snug">
                    Add{' '}
                    <strong className="text-white">
                      ₹{Math.max(0, 999 - cart.subtotal).toLocaleString('en-IN')}
                    </strong>{' '}
                    more for <strong className="text-amber-300">2 ml Sample FREE</strong> &amp; Free Shipping · Buy worth{' '}
                    <strong className="text-amber-300">₹2,499</strong> for <strong className="text-amber-300">1 Aura Perfume FREE</strong>
                  </span>
                )}
              </div>

              {/* Dual Milestone Badges */}
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div
                  className={`px-2.5 py-1.5 rounded-lg border flex items-center justify-between ${
                    cart.subtotal >= 999
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                      : 'bg-stone-950/80 border-white/10 text-stone-400'
                  }`}
                >
                  <span className="font-semibold">₹999+ Offer</span>
                  <span>{cart.subtotal >= 999 ? '✓ 2 ml Sample Free' : '2 ml Sample Free'}</span>
                </div>
                <div
                  className={`px-2.5 py-1.5 rounded-lg border flex items-center justify-between ${
                    cart.subtotal >= 2499
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                      : 'bg-stone-950/80 border-white/10 text-stone-400'
                  }`}
                >
                  <span className="font-semibold">₹2,499+ Offer</span>
                  <span>{cart.subtotal >= 2499 ? '✓ 1 Aura Perfume Free' : '1 Aura Perfume Free'}</span>
                </div>
              </div>

              <div className="w-full h-1.5 bg-stone-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-500"
                  style={{ width: `${Math.min(100, (cart.subtotal / 2499) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Items List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Explicit Notice if an Old Cart Contains an Unavailable 10 ml Aura Variant */}
            {hasUnavailableItems && (
              <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-4 space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-stone-200 leading-relaxed">
                    <strong className="text-amber-300 block uppercase tracking-wider mb-1">
                      Selection Update Required
                    </strong>
                    Your bag contains an unavailable 10 ml or archived selection. All Aura Collection perfumes are now crafted in <strong>15 ml bottles at ₹249 each</strong>. We do not silently substitute cart items—please remove the unavailable item and select your preferred current edition.
                  </div>
                </div>
                <button
                  onClick={() => {
                    unavailableItems.forEach((u) => removeFromCart(u.variantId));
                    setIsMiniCartOpen(false);
                    setSelectedCategoryFilter('Aura Collection');
                    setCurrentView('shop');
                  }}
                  className="w-full py-2 px-3 rounded-lg bg-amber-500 text-stone-950 font-semibold text-[11px] uppercase tracking-wider hover:bg-amber-400 transition-colors cursor-pointer"
                >
                  Remove Unavailable Selection & View 15 ml Aura Collection
                </button>
              </div>
            )}

            {cart.items.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4 text-stone-400">
                  <ShoppingBag className="w-7 h-7" />
                </div>
                <p className="font-serif text-xl text-white mb-2">Your bag is currently empty</p>
                <p className="text-xs text-stone-400 max-w-xs mx-auto mb-4 leading-relaxed">
                  Buy items worth <strong className="text-amber-300">₹999</strong> to get a <strong className="text-amber-300">2 ml Sample Free</strong>, or worth <strong className="text-amber-300">₹2,499</strong> to get <strong className="text-amber-300">One Aura Perfume Free</strong>.
                </p>
                <button
                  onClick={() => {
                    setIsMiniCartOpen(false);
                    setCurrentView('shop');
                  }}
                  className="px-6 py-3 bg-amber-500 text-stone-950 font-semibold text-xs uppercase tracking-widest rounded-xl hover:bg-amber-400 transition-all cursor-pointer"
                >
                  Explore Fragrances
                </button>
              </div>
            ) : (
              cart.items.map((item) => {
                const matchedProd = products.find(
                  (p) => p.id === item.productId || p.slug === item.slug
                );
                const matchedVar = matchedProd?.variants.find(
                  (v) => v.id === item.variantId || v.size === item.size
                );
                const isItemUnavailable = unavailableItems.some(
                  (u) => u.variantId === item.variantId
                );

                return (
                  <div
                    key={item.variantId}
                    className={`flex items-center space-x-4 p-4 rounded-xl border ${
                      isItemUnavailable
                        ? 'bg-rose-950/20 border-amber-500/50'
                        : 'bg-stone-900/60 border-white/10'
                    }`}
                  >
                    {/* Variant Bottle Visual */}
                    <div
                      onClick={() => {
                        setIsMiniCartOpen(false);
                        setSelectedProductSlug(item.slug);
                        setCurrentView('product');
                      }}
                      className="w-16 h-20 rounded-lg shrink-0 flex items-center justify-center border border-white/15 bg-black/40 overflow-hidden cursor-pointer"
                    >
                      <FragmoreBottleVisual
                        slug={item.slug}
                        size={item.size}
                        variant={matchedVar}
                        productName={item.productName}
                        collection={matchedProd?.collection}
                        className="w-12 h-16"
                        showGlow={false}
                        showShadow={false}
                      />
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-serif text-base text-white tracking-wider truncate">
                            {item.productName}
                          </h4>
                          <p className="text-[11px] text-stone-400 uppercase tracking-widest">
                            Size: {item.size} · SKU: {item.sku}
                          </p>
                          {item.selectedFlavours && item.selectedFlavours.length > 0 && (
                            <p className="text-[10px] font-mono text-[#9A783E] mt-1 leading-snug">
                              Selected 6: {item.selectedFlavours.join(' · ')}
                            </p>
                          )}
                          {isItemUnavailable && (
                            <span className="inline-block mt-1 px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-[10px] text-amber-300 uppercase tracking-wider">
                              Unavailable 10 ml / Archived Variant — Please Update Selection
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => removeFromCart(item.variantId)}
                          className="text-stone-400 hover:text-rose-400 transition-colors p-1 cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center border border-white/15 rounded-lg bg-stone-950">
                          <button
                            onClick={() => updateCartQuantity(item.variantId, item.quantity - 1)}
                            className="p-1.5 text-stone-400 hover:text-white cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="px-3 text-xs font-medium text-white">{item.quantity}</span>
                          <button
                            onClick={() => updateCartQuantity(item.variantId, item.quantity + 1)}
                            disabled={isItemUnavailable}
                            className="p-1.5 text-stone-400 hover:text-white disabled:opacity-40 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="text-right">
                          <span className="font-serif text-base text-white font-semibold">
                            ₹{(item.sellingPrice * item.quantity).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Complimentary Free Gifts Unlocked in Bag */}
            {cart.items.length > 0 && cart.subtotal >= 999 && (
              <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/40 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                    <Gift className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white uppercase tracking-wider">
                      2 ml Sample Atomizer
                    </p>
                    <p className="text-[11px] text-emerald-300">
                      Unlocked on orders worth ₹999+
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 font-mono text-xs font-bold uppercase">
                  FREE
                </span>
              </div>
            )}

            {cart.items.length > 0 && cart.subtotal >= 2499 && (
              <div className="p-3.5 rounded-xl bg-amber-950/35 border border-amber-400/50 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white uppercase tracking-wider">
                      One Aura Perfume (15 ml)
                    </p>
                    <p className="text-[11px] text-amber-300">
                      Unlocked on orders worth ₹2,499+
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded bg-amber-500/25 text-amber-200 font-mono text-xs font-bold uppercase">
                  FREE
                </span>
              </div>
            )}

            {/* Luxury Gift Wrap Option */}
            {cart.items.length > 0 && (
              <div
                onClick={toggleGiftWrap}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                  cart.giftWrap
                    ? 'bg-amber-950/30 border-amber-500/50'
                    : 'bg-stone-900/40 border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Gift className={`w-5 h-5 ${cart.giftWrap ? 'text-amber-400' : 'text-stone-400'}`} />
                  <div>
                    <p className="text-xs font-semibold text-white uppercase tracking-wider">
                      Add Signature Luxury Gift Box & Ribbon
                    </p>
                    <p className="text-[11px] text-stone-400">
                      Includes gold-embossed rigid keepsake box (+₹150)
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={cart.giftWrap}
                  onChange={() => {}}
                  className="rounded border-white/20 text-amber-500 focus:ring-amber-500"
                />
              </div>
            )}
          </div>

          {/* Footer Totals & Checkout CTA */}
          {cart.items.length > 0 && (
            <div className="p-6 border-t border-white/10 bg-stone-900/90 space-y-4">
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-stone-400">
                  <span>Subtotal</span>
                  <span className="text-white">₹{cart.subtotal.toLocaleString('en-IN')}</span>
                </div>
                {cart.giftWrap && (
                  <div className="flex justify-between text-stone-400">
                    <span>Luxury Gift Packaging</span>
                    <span className="text-white">₹{cart.giftWrapFee}</span>
                  </div>
                )}
                <div className="flex justify-between text-stone-400">
                  <span>Shipping</span>
                  <span className="text-emerald-400">
                    {cart.shippingFee === 0 ? 'FREE' : `₹${cart.shippingFee}`}
                  </span>
                </div>
                <div className="pt-2 border-t border-white/10 flex justify-between items-baseline text-sm font-semibold text-white">
                  <span>Total (Inclusive of GST)</span>
                  <span className="font-serif text-2xl text-amber-300">
                    ₹{cart.total.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <button
                onClick={handleProceedToCheckout}
                disabled={hasUnavailableItems}
                className={`w-full py-4 rounded-xl font-semibold text-xs uppercase tracking-[0.2em] flex items-center justify-center space-x-2 transition-all shadow-lg cursor-pointer ${
                  hasUnavailableItems
                    ? 'bg-stone-800 text-stone-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 text-stone-950 hover:brightness-110 shadow-amber-500/20'
                }`}
              >
                <span>
                  {hasUnavailableItems
                    ? 'Update Unavailable Selection to Continue'
                    : 'Proceed to Secure Checkout'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="flex items-center justify-center space-x-2 text-[10px] text-stone-400 uppercase tracking-widest">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>UPI · Cards · NetBanking · COD Available</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
