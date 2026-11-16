import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { FragmoreBottleVisual } from '../storefront/FragmoreBottleVisual';
import {
  ShoppingBag,
  Search,
  Heart,
  Menu,
  X,
  User,
  LogOut,
  ChevronDown,
  ArrowRight,
  Compass,
  Shield,
  Sun,
  Moon,
  Sparkles,
  Gift
} from 'lucide-react';

type MobileAccordionKey = 'fragrances' | 'occasion' | 'customization' | 'notes' | null;

export const Header: React.FC = () => {
  const {
    currentView,
    setCurrentView,
    selectedCategoryFilter,
    setSelectedCategoryFilter,
    setSelectedProductSlug,
    products,
    orders,
    cart,
    wishlist,
    setIsMiniCartOpen,
    setIsSearchOpen,
    setIsQuizOpen,
    cms,
    customer,
    adminRole,
    isLoggedIn,
    setIsAuthModalOpen,
    logout,
    theme,
    toggleTheme
  } = useStore();

  const [shopDropdownOpen, setShopDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileAccordion, setMobileAccordion] = useState<MobileAccordionKey>('fragrances');
  const headerRef = useRef<HTMLElement>(null);

  const cartCount = cart.items.reduce((acc, item) => acc + item.quantity, 0);

  const isAdminUser =
    adminRole === 'SUPER_ADMIN' ||
    customer?.role === 'SUPER_ADMIN' ||
    customer?.email?.toLowerCase() === 'gowisherharsha@gmail.com' ||
    customer?.email?.toLowerCase() === 'aibrandorigin@gmail.com' ||
    customer?.email?.toLowerCase().includes('admin') ||
    customer?.email?.toLowerCase() === 'founder@fragmore.com';

  // Active published products
  const publishedProducts = useMemo(
    () => products.filter((p) => p.status === 'ACTIVE'),
    [products]
  );
  const publishedSignature = useMemo(
    () => publishedProducts.filter((p) => p.collection === 'Signature Collection'),
    [publishedProducts]
  );
  const publishedAura = useMemo(
    () => publishedProducts.filter((p) => p.collection === 'Aura Collection'),
    [publishedProducts]
  );

  // Check whether real bestseller data or active bestseller flags exist
  const hasBestsellers = useMemo(() => {
    const hasConfirmedOrderItems = orders.some(
      (o) =>
        o.orderStatus !== 'CANCELLED' &&
        o.orderStatus !== 'RETURNED' &&
        Array.isArray(o.items) &&
        o.items.length > 0
    );
    const hasFlaggedBestsellers = publishedProducts.some((p) => Boolean(p.isBestSeller));
    return hasConfirmedOrderItems || hasFlaggedBestsellers;
  }, [orders, publishedProducts]);

  // Featured cards for Mega Menu Column 5
  const featuredSignature = useMemo(
    () =>
      publishedSignature.find((p) => p.slug === (cms.heroFeaturedProductSlug || 'golden-hour')) ||
      publishedSignature[0],
    [publishedSignature, cms.heroFeaturedProductSlug]
  );
  const featuredAura = useMemo(
    () => publishedAura.find((p) => p.slug === 'moksha-essence') || publishedAura[0],
    [publishedAura]
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setShopDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShopDropdownOpen(false);
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  if (currentView === 'admin') {
    return null;
  }

  const handleNavClick = (view: string, category: string = 'all') => {
    setSelectedCategoryFilter(category);
    setCurrentView(view);
    setShopDropdownOpen(false);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenProduct = (slug: string) => {
    setSelectedProductSlug(slug);
    setCurrentView('product');
    setShopDropdownOpen(false);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleMobileSection = (key: Exclude<MobileAccordionKey, null>) => {
    setMobileAccordion((prev) => (prev === key ? null : key));
  };

  const OCCASION_LINKS = [
    { label: 'Day', filter: 'occasion:Day' },
    { label: 'Evening / Night', filter: 'occasion:Evening / Night' },
    { label: 'Office / Daily Wear', filter: 'occasion:Office / Daily Wear' },
    { label: 'Date / Special Occasion', filter: 'occasion:Date / Special Occasion' },
    { label: 'Gifting', filter: 'occasion:Gifting' },
    { label: 'Seasonal', filter: 'occasion:Seasonal' }
  ];

  const NOTE_PROFILE_LINKS = [
    { label: 'Floral', filter: 'family:Floral' },
    { label: 'Woody', filter: 'family:Woody' },
    { label: 'Amber / Oriental', filter: 'family:Amber' },
    { label: 'Fresh / Citrus / Aquatic', filter: 'family:Fresh' },
    { label: 'Fruity', filter: 'family:Fruity' },
    { label: 'Gourmand / Vanilla', filter: 'family:Gourmand' },
    { label: 'Spicy / Oud', filter: 'family:Spicy' }
  ];

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-40 bg-[var(--bg-main)]/95 backdrop-blur-xl border-b border-[var(--border-subtle)] transition-colors duration-300 w-full"
    >
      {/* 3-Column Symmetrical Auto-Center Grid keeps the FRAGMORÉ wordmark dead-center on mobile & desktop */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-20 grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
        {/* LEFT COLUMN: Mobile Menu + Mobile Search (Symmetrical 2-icon pair on mobile) & Desktop SHOP Mega-Menu Trigger */}
        <div className="justify-self-start flex items-center gap-1.5 sm:gap-2 min-w-0">
          {/* Mobile Menu Trigger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className={`lg:hidden inline-flex items-center justify-center gap-1.5 w-9 h-9 min-[400px]:w-auto min-[400px]:px-3 sm:h-10 rounded-full border transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)] shrink-0 ${
              mobileMenuOpen
                ? 'bg-[var(--text-main)] text-[var(--bg-main)] border-[var(--text-main)] shadow-xs'
                : 'bg-[var(--bg-surface)] text-[var(--text-main)] border-[var(--border-subtle)] hover:border-[var(--accent-gold)]'
            }`}
            aria-label={mobileMenuOpen ? 'Close Shop Menu' : 'Open Shop Menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-shop-drawer"
          >
            {mobileMenuOpen ? (
              <X className="w-4 h-4 shrink-0" />
            ) : (
              <Menu className="w-4 h-4 shrink-0" />
            )}
            <span className="hidden min-[400px]:inline text-[10px] sm:text-[11px] font-mono font-semibold uppercase tracking-[0.18em]">
              {mobileMenuOpen ? 'CLOSE' : 'MENU'}
            </span>
          </button>

          {/* Mobile Quick Search Button (Placed on Left for Perfect Mobile Symmetry) */}
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              setIsSearchOpen(true);
            }}
            aria-label="Search fragrances and notes"
            className="lg:hidden w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-main)] hover:border-[var(--accent-gold)] hover:text-[var(--accent-gold)] transition-colors cursor-pointer flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)] shrink-0"
            title="Search Fragrances & Notes"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Desktop SHOP Mega-Menu Trigger */}
          <div className="hidden lg:flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShopDropdownOpen((prev) => !prev)}
              aria-expanded={shopDropdownOpen}
              aria-haspopup="true"
              aria-controls="desktop-shop-megamenu"
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs uppercase tracking-[0.22em] font-medium transition-all cursor-pointer border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)] ${
                shopDropdownOpen || currentView === 'shop'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-main)] border-[var(--border-subtle)] shadow-sm'
                  : 'bg-transparent text-[var(--text-main)] border-transparent hover:text-[var(--accent-gold)] hover:border-[var(--border-subtle)]'
              }`}
            >
              <span>SHOP</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  shopDropdownOpen ? 'rotate-180 text-[var(--accent-gold)]' : 'text-[var(--text-secondary)]'
                }`}
              />
            </button>

            <button
              type="button"
              onClick={() => handleNavClick('gift-cards')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs uppercase tracking-[0.2em] font-medium transition-all cursor-pointer border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)] ${
                currentView === 'gift-cards'
                  ? 'bg-[var(--bg-surface)] text-[var(--accent-gold)] border-[var(--accent-gold)] shadow-sm'
                  : 'bg-transparent text-[var(--text-main)] border-transparent hover:text-[var(--accent-gold)] hover:border-[var(--border-subtle)]'
              }`}
            >
              <Gift className="w-3.5 h-3.5 text-[var(--accent-gold)] shrink-0" />
              <span>GIFT CARDS</span>
            </button>
          </div>
        </div>

        {/* CENTER COLUMN: Approved FRAGMORÉ Wordmark */}
        <div className="justify-self-center flex items-center justify-center px-1">
          <button
            id="fragmore-header-logo"
            type="button"
            onClick={() => handleNavClick('storefront')}
            className="group text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)] rounded-lg px-1 sm:px-2 py-1 cursor-pointer"
            aria-label="FRAGMORÉ Home"
          >
            <span className="font-serif text-[18px] min-[375px]:text-[20px] sm:text-2xl md:text-[28px] tracking-[0.2em] sm:tracking-[0.26em] uppercase text-[var(--text-main)] group-hover:text-[var(--accent-gold)] transition-colors block leading-none font-normal whitespace-nowrap">
              FRAGMOR<span className="text-[var(--accent-gold)]">É</span>
            </span>
          </button>
        </div>

        {/* RIGHT COLUMN: Search (Desktop), Wishlist, Account & Shopping Bag */}
        <div className="justify-self-end flex items-center gap-1.5 sm:gap-2 min-w-0">
          {/* Desktop Search Button */}
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            aria-label="Search fragrances and notes"
            className="hidden lg:flex p-2 text-[var(--text-main)] hover:text-[var(--accent-gold)] transition-colors cursor-pointer min-h-[40px] min-w-[40px] items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)] shrink-0"
            title="Search Fragrances & Notes"
          >
            <Search className="w-[18px] h-[18px]" />
          </button>

          {/* Wishlist Button (Visible on tablet & desktop) */}
          <button
            type="button"
            onClick={() => handleNavClick('wishlist')}
            aria-label="Wishlist"
            className="relative p-2 text-[var(--text-main)] hover:text-[var(--accent-gold)] transition-colors cursor-pointer hidden md:flex items-center justify-center min-h-[40px] min-w-[40px] rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)] shrink-0"
            title="Private Wishlist"
          >
            <Heart className="w-[18px] h-[18px]" />
            {wishlist.length > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[var(--accent-gold)] text-[var(--bg-surface)] text-[9px] font-bold flex items-center justify-center">
                {wishlist.length}
              </span>
            )}
          </button>

          {/* Customer Account / Sign In */}
          {isLoggedIn ? (
            <>
              {/* Refined Mobile Account Button */}
              <button
                type="button"
                onClick={() => handleNavClick('account')}
                aria-label="My Account"
                className={`sm:hidden w-9 h-9 rounded-full border transition-colors cursor-pointer flex items-center justify-center shrink-0 ${
                  currentView === 'account'
                    ? 'border-[var(--accent-gold)] bg-[var(--bg-secondary)] text-[var(--accent-gold)]'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--accent-gold)] hover:border-[var(--accent-gold)]'
                }`}
                title="My Account"
              >
                <User className="w-4 h-4" />
              </button>

              {/* Desktop / Tablet Account Controls */}
              <div className="hidden sm:flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => handleNavClick('account')}
                  className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-full border text-xs transition-all cursor-pointer ${
                    currentView === 'account'
                      ? 'border-[var(--accent-gold)] bg-[var(--bg-secondary)] text-[var(--text-main)]'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-main)] hover:border-[var(--accent-gold)]'
                  }`}
                  title="My Account"
                >
                  <User className="w-3.5 h-3.5 text-[var(--accent-gold)] shrink-0" />
                  <span className="max-w-[75px] lg:max-w-[90px] truncate font-medium text-[11px]">
                    {(customer?.name || 'Account').split(' ')[0]}
                  </span>
                </button>

                {isAdminUser && (
                  <button
                    type="button"
                    onClick={() => setCurrentView('admin')}
                    className="p-2 text-[var(--accent-gold)] hover:opacity-80 transition-colors cursor-pointer"
                    title="Admin Suite"
                    aria-label="Admin Suite"
                  >
                    <Shield className="w-4 h-4" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={logout}
                  className="p-1.5 text-[var(--text-secondary)] hover:text-rose-500 transition-colors cursor-pointer"
                  title="Sign Out"
                  aria-label="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setIsAuthModalOpen(true)}
              aria-label="Sign In or Create Account"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] lg:border-transparent lg:bg-transparent text-[var(--text-main)] hover:border-[var(--accent-gold)] hover:text-[var(--accent-gold)] transition-colors cursor-pointer flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)] shrink-0"
              title="Sign In / Create Account"
            >
              <User className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
            </button>
          )}

          {/* Shopping Bag Drawer Trigger */}
          <button
            type="button"
            onClick={() => setIsMiniCartOpen(true)}
            aria-label={`Shopping bag with ${cartCount} items`}
            className="relative flex items-center space-x-1.5 h-9 sm:h-10 px-3 sm:px-3.5 rounded-full bg-[var(--bg-surface)] hover:bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:border-[var(--accent-gold)] transition-all group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)] shrink-0 shadow-2xs"
          >
            <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--accent-gold)] group-hover:scale-105 transition-transform shrink-0" />
            <span className="text-[11px] sm:text-xs font-mono text-[var(--text-main)] font-semibold tabular-nums">
              {cartCount}
            </span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          DESKTOP 5-COLUMN MEGA MENU (Matches Reference Shop Menu Architecture)
          ===================================================================== */}
      {shopDropdownOpen && (
        <div
          id="desktop-shop-megamenu"
          role="region"
          aria-label="Shop Mega Menu"
          className="hidden lg:block absolute left-0 right-0 top-full bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] shadow-[0_28px_70px_rgba(0,0,0,0.16)] z-50 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
            <div className="grid grid-cols-12 gap-7">
              {/* COLUMN 1: FRAGRANCES */}
              <div className="col-span-2 space-y-3.5">
                <h3 className="text-[11px] font-mono uppercase tracking-[0.24em] text-[var(--text-main)] font-semibold border-b border-[var(--border-subtle)] pb-2">
                  Fragrances
                </h3>
                <ul className="space-y-2.5 text-xs">
                  <li>
                    <button
                      type="button"
                      onClick={() => handleNavClick('shop', 'all')}
                      className={`w-full text-left py-0.5 transition-colors flex items-center justify-between cursor-pointer ${
                        selectedCategoryFilter === 'all' && currentView === 'shop'
                          ? 'text-[var(--accent-gold)] font-semibold'
                          : 'text-[var(--text-main)] hover:text-[var(--accent-gold)] font-medium'
                      }`}
                    >
                      <span>Shop All</span>
                      <ArrowRight className="w-3 h-3 text-[var(--accent-gold)]" />
                    </button>
                  </li>
                  {hasBestsellers && (
                    <li>
                      <button
                        type="button"
                        onClick={() => handleNavClick('shop', 'bestsellers')}
                        className="w-full text-left py-0.5 text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
                      >
                        Bestsellers
                      </button>
                    </li>
                  )}
                  <li>
                    <button
                      type="button"
                      onClick={() => handleNavClick('shop', 'new-arrivals')}
                      className="w-full text-left py-0.5 text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
                    >
                      New Arrivals
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => handleNavClick('shop', 'Signature Collection')}
                      className="w-full text-left py-0.5 text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
                    >
                      Signature Collection ({publishedSignature.length || 9})
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => handleNavClick('shop', 'Aura Collection')}
                      className="w-full text-left py-0.5 text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
                    >
                      Aura Collection ({publishedAura.length || 3})
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => handleNavClick('shop', 'discovery')}
                      className="w-full text-left py-0.5 text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
                    >
                      Gift Sets &amp; Discovery
                    </button>
                  </li>
                </ul>
              </div>

              {/* COLUMN 2: SHOP BY OCCASION */}
              <div className="col-span-2 space-y-3.5">
                <h3 className="text-[11px] font-mono uppercase tracking-[0.24em] text-[var(--text-main)] font-semibold border-b border-[var(--border-subtle)] pb-2">
                  Shop By Occasion
                </h3>
                <ul className="space-y-2.5 text-xs">
                  {OCCASION_LINKS.map((item) => (
                    <li key={item.filter}>
                      <button
                        type="button"
                        onClick={() => handleNavClick('shop', item.filter)}
                        className={`w-full text-left py-0.5 transition-colors cursor-pointer ${
                          selectedCategoryFilter === item.filter && currentView === 'shop'
                            ? 'text-[var(--accent-gold)] font-semibold'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                        }`}
                      >
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* COLUMN 3: CUSTOMIZATION */}
              <div className="col-span-2 space-y-3.5">
                <h3 className="text-[11px] font-mono uppercase tracking-[0.24em] text-[var(--text-main)] font-semibold border-b border-[var(--border-subtle)] pb-2">
                  Customization
                </h3>
                <ul className="space-y-2.5 text-xs">
                  <li>
                    <button
                      type="button"
                      onClick={() => handleNavClick('shop', 'occasion:Gifting')}
                      className="w-full text-left py-0.5 text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
                    >
                      Engraving &amp; Personalization
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => handleNavClick('shop', 'discovery')}
                      className="w-full text-left py-0.5 text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
                    >
                      Build Your Discovery Set
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        setShopDropdownOpen(false);
                        setIsQuizOpen(true);
                      }}
                      className="w-full text-left py-0.5 text-[var(--accent-gold)] hover:opacity-80 font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Compass className="w-3.5 h-3.5 shrink-0" />
                      <span>Fragrance Finder Quiz</span>
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => handleNavClick('shop', 'discovery')}
                      className="w-full text-left py-0.5 text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
                    >
                      Sample Program
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => handleNavClick('gift-cards')}
                      className="w-full text-left py-0.5 text-[var(--accent-gold)] hover:opacity-80 font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Gift className="w-3.5 h-3.5 shrink-0" />
                      <span>Gift FRAGMORÉ (Gift Cards)</span>
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => handleNavClick('shop', 'occasion:Gifting')}
                      className="w-full text-left py-0.5 text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
                    >
                      Corporate &amp; Event Gifting
                    </button>
                  </li>
                </ul>
              </div>

              {/* COLUMN 4: NOTE PROFILES */}
              <div className="col-span-2 space-y-3.5">
                <h3 className="text-[11px] font-mono uppercase tracking-[0.24em] text-[var(--text-main)] font-semibold border-b border-[var(--border-subtle)] pb-2">
                  Note Profiles
                </h3>
                <ul className="space-y-2.5 text-xs">
                  {NOTE_PROFILE_LINKS.map((item) => (
                    <li key={item.filter}>
                      <button
                        type="button"
                        onClick={() => handleNavClick('shop', item.filter)}
                        className={`w-full text-left py-0.5 transition-colors cursor-pointer ${
                          selectedCategoryFilter === item.filter && currentView === 'shop'
                            ? 'text-[var(--accent-gold)] font-semibold'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                        }`}
                      >
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* COLUMN 5: FEATURED VISUAL CARDS */}
              <div className="col-span-4 grid grid-cols-2 gap-4 pl-2 border-l border-[var(--border-subtle)]">
                {/* Featured Visual Card 1: Signature Collection */}
                <div
                  onClick={() =>
                    featuredSignature
                      ? handleOpenProduct(featuredSignature.slug)
                      : handleNavClick('shop', 'Signature Collection')
                  }
                  className="group rounded-xl bg-[var(--bg-main)] border border-[var(--border-subtle)] hover:border-[var(--accent-gold)] p-3.5 flex flex-col justify-between transition-all cursor-pointer"
                >
                  <div className="relative h-36 flex items-center justify-center overflow-hidden rounded-lg bg-[var(--bg-secondary)]/50 mb-3">
                    <FragmoreBottleVisual
                      slug={featuredSignature?.slug || 'golden-hour'}
                      productName={featuredSignature?.name || 'GOLDEN HOUR'}
                      productTagline={featuredSignature?.subtitle || 'Golden. Warm. Unforgettable.'}
                      collection="Signature Collection"
                      size="50 ml"
                      className="w-24 h-32 group-hover:scale-105 transition-transform duration-500"
                      showGlow={false}
                      showShadow={true}
                    />
                  </div>
                  <div>
                    <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-[var(--accent-gold)] mb-0.5">
                      Signature Collection
                    </div>
                    <div className="font-serif text-sm uppercase tracking-[0.12em] text-[var(--text-main)] font-semibold truncate">
                      {featuredSignature?.name || 'GOLDEN HOUR'}
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)] truncate mb-2">
                      {featuredSignature?.subtitle || 'Golden. Warm. Unforgettable.'}
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono pt-1.5 border-t border-[var(--border-subtle)]">
                      <span className="text-[var(--text-main)] font-semibold">From ₹699</span>
                      <span className="text-[var(--accent-gold)] uppercase tracking-wider flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                        Explore <ArrowRight className="w-2.5 h-2.5" />
                      </span>
                    </div>
                  </div>
                </div>

                {/* Featured Visual Card 2: Aura Collection · 15 ml */}
                <div
                  onClick={() =>
                    featuredAura
                      ? handleOpenProduct(featuredAura.slug)
                      : handleNavClick('shop', 'Aura Collection')
                  }
                  className="group rounded-xl bg-[var(--bg-main)] border border-[var(--border-subtle)] hover:border-[var(--accent-gold)] p-3.5 flex flex-col justify-between transition-all cursor-pointer"
                >
                  <div className="relative h-36 flex items-center justify-center overflow-hidden rounded-lg bg-[var(--bg-secondary)]/50 mb-3">
                    <FragmoreBottleVisual
                      slug={featuredAura?.slug || 'moksha-essence'}
                      productName={featuredAura?.name || 'MOKSHA ESSENCE'}
                      productTagline={featuredAura?.subtitle || 'Calm. Pure. Centered.'}
                      collection="Aura Collection"
                      size="15 ml"
                      className="w-24 h-32 group-hover:scale-105 transition-transform duration-500"
                      showGlow={false}
                      showShadow={true}
                    />
                  </div>
                  <div>
                    <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-[var(--accent-gold)] mb-0.5">
                      Aura Collection · 15 ml
                    </div>
                    <div className="font-serif text-sm uppercase tracking-[0.12em] text-[var(--text-main)] font-semibold truncate">
                      {featuredAura?.name || 'MOKSHA ESSENCE'}
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)] truncate mb-2">
                      {featuredAura?.subtitle || 'Calm. Pure. Centered.'}
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono pt-1.5 border-t border-[var(--border-subtle)]">
                      <span className="text-[var(--text-main)] font-semibold">15 ml · ₹249</span>
                      <span className="text-[var(--accent-gold)] uppercase tracking-wider flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                        Explore <ArrowRight className="w-2.5 h-2.5" />
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Strip: Direct Access to All 9 Signature Creations & Maison Links */}
            <div className="mt-7 pt-5 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--text-secondary)] mr-2">
                  Signature 01–09:
                </span>
                {publishedSignature.slice(0, 9).map((prod, idx) => (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => handleOpenProduct(prod.slug)}
                    className="px-2.5 py-1 rounded-full bg-[var(--bg-main)] hover:bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:border-[var(--accent-gold)] text-[10px] text-[var(--text-main)] transition-colors cursor-pointer"
                  >
                    <span className="font-mono text-[var(--accent-gold)] mr-1">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    {prod.name}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-4 text-[11px] font-mono uppercase tracking-[0.18em]">
                <button
                  type="button"
                  onClick={() => handleNavClick('gift-cards')}
                  className="text-[var(--accent-gold)] hover:opacity-80 transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Gift className="w-3 h-3" />
                  <span>Gift Cards</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleNavClick('journal')}
                  className="text-[var(--text-secondary)] hover:text-[var(--accent-gold)] transition-colors cursor-pointer"
                >
                  The Journal
                </button>
                <button
                  type="button"
                  onClick={() => handleNavClick('track-order')}
                  className="text-[var(--text-secondary)] hover:text-[var(--accent-gold)] transition-colors cursor-pointer"
                >
                  Track Order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MOBILE NAVIGATION DRAWER WITH COLLAPSIBLE ACCORDIONS
          ===================================================================== */}
      {mobileMenuOpen && (
        <>
          {/* Mobile Backdrop Scrim */}
          <div
            aria-hidden="true"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden fixed inset-0 top-16 bg-black/30 backdrop-blur-xs z-40 animate-in fade-in duration-200"
          />

          <div
            id="mobile-shop-drawer"
            className="lg:hidden relative z-50 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] max-h-[calc(100dvh-4rem)] flex flex-col justify-between overflow-hidden shadow-[0_24px_48px_rgba(36,33,29,0.2)] animate-in fade-in slide-in-from-top-2 duration-200"
          >
            {/* Scrollable Body of Mobile Drawer */}
            <div className="px-4 pt-4 pb-6 space-y-4 overflow-y-auto flex-1">
              {/* Top Quick Action Bar: Search & Fragrance Finder */}
              <div className="grid grid-cols-2 gap-2.5 pb-3 border-b border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setIsSearchOpen(true);
                  }}
                  className="py-2.5 px-3 rounded-xl bg-[var(--bg-main)] border border-[var(--border-subtle)] hover:border-[var(--accent-gold)] flex items-center justify-center gap-2 text-xs font-medium text-[var(--text-main)] cursor-pointer transition-colors"
                >
                  <Search className="w-3.5 h-3.5 text-[var(--accent-gold)] shrink-0" />
                  <span className="truncate">Search Scents</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setIsQuizOpen(true);
                  }}
                  className="py-2.5 px-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:border-[var(--accent-gold)] flex items-center justify-center gap-2 text-xs font-medium text-[var(--text-main)] cursor-pointer transition-colors"
                >
                  <Compass className="w-3.5 h-3.5 text-[var(--accent-gold)] shrink-0" />
                  <span className="truncate">Fragrance Finder</span>
                </button>
              </div>

              {/* Visual Collection Spotlight Cards with Bottle Previews */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleNavClick('shop', 'Signature Collection')}
                  className="p-3 rounded-xl bg-[var(--bg-main)] border border-[var(--border-subtle)] hover:border-[var(--accent-gold)] flex items-center gap-2.5 text-left cursor-pointer transition-colors"
                >
                  <div className="w-11 h-14 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0 p-1">
                    <FragmoreBottleVisual
                      slug={featuredSignature?.slug || 'golden-hour'}
                      size="50 ml"
                      productName={featuredSignature?.name || 'GOLDEN HOUR'}
                      collection="Signature Collection"
                      className="w-9 h-12"
                      showGlow={false}
                      showShadow={false}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[9px] font-mono uppercase tracking-[0.16em] text-[var(--accent-gold)] font-semibold">
                      01–09 · Signature
                    </div>
                    <div className="font-serif text-xs uppercase tracking-wider text-[var(--text-main)] font-semibold truncate mt-0.5">
                      9 Perfumes
                    </div>
                    <div className="text-[10px] font-mono text-[var(--text-secondary)] mt-0.5">
                      ₹699 / ₹999 →
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleNavClick('shop', 'Aura Collection')}
                  className="p-3 rounded-xl bg-[var(--bg-main)] border border-[var(--border-subtle)] hover:border-[var(--accent-gold)] flex items-center gap-2.5 text-left cursor-pointer transition-colors"
                >
                  <div className="w-11 h-14 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0 p-1">
                    <FragmoreBottleVisual
                      slug={featuredAura?.slug || 'moksha-essence'}
                      size="15 ml"
                      productName={featuredAura?.name || 'MOKSHA ESSENCE'}
                      collection="Aura Collection"
                      className="w-9 h-12"
                      showGlow={false}
                      showShadow={false}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[9px] font-mono uppercase tracking-[0.16em] text-[var(--accent-gold)] font-semibold">
                      Aura · 15 ml
                    </div>
                    <div className="font-serif text-xs uppercase tracking-wider text-[var(--text-main)] font-semibold truncate mt-0.5">
                      3 Sacred Scents
                    </div>
                    <div className="text-[10px] font-mono text-[var(--text-secondary)] mt-0.5">
                      ₹249 Each →
                    </div>
                  </div>
                </button>
              </div>

              {/* ACCORDION 1: FRAGRANCES */}
              <div className="border-b border-[var(--border-subtle)] pb-3">
                <button
                  type="button"
                  onClick={() => toggleMobileSection('fragrances')}
                  aria-expanded={mobileAccordion === 'fragrances'}
                  className="w-full py-2 flex items-center justify-between text-xs font-mono uppercase tracking-[0.22em] text-[var(--text-main)] font-semibold cursor-pointer"
                >
                  <span>01. Fragrances</span>
                  <ChevronDown
                    className={`w-4 h-4 text-[var(--accent-gold)] transition-transform ${
                      mobileAccordion === 'fragrances' ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {mobileAccordion === 'fragrances' && (
                  <div className="mt-2 space-y-1.5">
                    <button
                      type="button"
                      onClick={() => handleNavClick('shop', 'all')}
                      className="w-full text-left py-2.5 px-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border-subtle)] text-xs font-semibold uppercase tracking-wider text-[var(--text-main)] flex items-center justify-between cursor-pointer"
                    >
                      <span>Shop All Fragrances</span>
                      <ArrowRight className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
                    </button>
                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      {hasBestsellers && (
                        <button
                          type="button"
                          onClick={() => handleNavClick('shop', 'bestsellers')}
                          className="text-left py-2 px-3 rounded-lg bg-[var(--bg-main)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-main)] cursor-pointer truncate"
                        >
                          Bestsellers
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleNavClick('shop', 'new-arrivals')}
                        className="text-left py-2 px-3 rounded-lg bg-[var(--bg-main)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-main)] cursor-pointer truncate"
                      >
                        New Arrivals
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNavClick('shop', 'Signature Collection')}
                        className="text-left py-2 px-3 rounded-lg bg-[var(--bg-main)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-main)] cursor-pointer truncate"
                      >
                        Signature (30/50 ml)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNavClick('shop', 'discovery')}
                        className="text-left py-2 px-3 rounded-lg bg-[var(--bg-main)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-main)] cursor-pointer truncate"
                      >
                        Discovery 6-Set
                      </button>
                    </div>

                    {/* Numbered Signature Quick List */}
                    <div className="pt-2 grid grid-cols-1 gap-1">
                      {publishedSignature.slice(0, 9).map((prod, idx) => (
                        <button
                          key={prod.id}
                          type="button"
                          onClick={() => handleOpenProduct(prod.slug)}
                          className="text-left text-xs py-2 px-3 rounded-lg hover:bg-[var(--bg-main)] text-[var(--text-main)] flex items-center justify-between cursor-pointer border border-transparent hover:border-[var(--border-subtle)] transition-colors"
                        >
                          <span className="truncate pr-2">
                            <span className="font-mono text-[var(--accent-gold)] font-semibold mr-2">
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                            <span className="font-medium">{prod.name}</span>
                          </span>
                          <span className="text-[10px] font-mono text-[var(--text-secondary)] shrink-0 tabular-nums">
                            ₹699
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ACCORDION 2: SHOP BY OCCASION */}
              <div className="border-b border-[var(--border-subtle)] pb-3">
                <button
                  type="button"
                  onClick={() => toggleMobileSection('occasion')}
                  aria-expanded={mobileAccordion === 'occasion'}
                  className="w-full py-2 flex items-center justify-between text-xs font-mono uppercase tracking-[0.22em] text-[var(--text-main)] font-semibold cursor-pointer"
                >
                  <span>02. Shop By Occasion</span>
                  <ChevronDown
                    className={`w-4 h-4 text-[var(--accent-gold)] transition-transform ${
                      mobileAccordion === 'occasion' ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {mobileAccordion === 'occasion' && (
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    {OCCASION_LINKS.map((item) => (
                      <button
                        key={item.filter}
                        type="button"
                        onClick={() => handleNavClick('shop', item.filter)}
                        className="text-left py-2 px-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border-subtle)] text-xs text-[var(--text-main)] hover:border-[var(--accent-gold)] cursor-pointer truncate"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* ACCORDION 3: CUSTOMIZATION */}
              <div className="border-b border-[var(--border-subtle)] pb-3">
                <button
                  type="button"
                  onClick={() => toggleMobileSection('customization')}
                  aria-expanded={mobileAccordion === 'customization'}
                  className="w-full py-2 flex items-center justify-between text-xs font-mono uppercase tracking-[0.22em] text-[var(--text-main)] font-semibold cursor-pointer"
                >
                  <span>03. Customization &amp; Sets</span>
                  <ChevronDown
                    className={`w-4 h-4 text-[var(--accent-gold)] transition-transform ${
                      mobileAccordion === 'customization' ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {mobileAccordion === 'customization' && (
                  <div className="mt-2 space-y-1.5">
                    <button
                      type="button"
                      onClick={() => handleNavClick('shop', 'discovery')}
                      className="w-full text-left py-2 px-3 rounded-lg bg-[var(--bg-main)] text-xs text-[var(--text-main)] cursor-pointer"
                    >
                      Build Your 6-Vial Discovery Set
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setIsQuizOpen(true);
                      }}
                      className="w-full text-left py-2 px-3 rounded-lg bg-[var(--bg-main)] text-xs text-[var(--accent-gold)] font-medium cursor-pointer"
                    >
                      Fragrance Finder / Scent Consultation
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavClick('gift-cards')}
                      className="w-full text-left py-2 px-3 rounded-lg bg-[var(--bg-main)] border border-[var(--accent-gold)]/40 text-xs text-[var(--accent-gold)] font-medium flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <Gift className="w-3.5 h-3.5 shrink-0" />
                        <span>Gift FRAGMORÉ · Digital &amp; Physical Gift Cards</span>
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavClick('shop', 'occasion:Gifting')}
                      className="w-full text-left py-2 px-3 rounded-lg bg-[var(--bg-main)] text-xs text-[var(--text-main)] cursor-pointer"
                    >
                      Luxury Gifting &amp; Personalization
                    </button>
                  </div>
                )}
              </div>

              {/* ACCORDION 4: NOTE PROFILES */}
              <div className="pb-1">
                <button
                  type="button"
                  onClick={() => toggleMobileSection('notes')}
                  aria-expanded={mobileAccordion === 'notes'}
                  className="w-full py-2 flex items-center justify-between text-xs font-mono uppercase tracking-[0.22em] text-[var(--text-main)] font-semibold cursor-pointer"
                >
                  <span>04. Note Profiles</span>
                  <ChevronDown
                    className={`w-4 h-4 text-[var(--accent-gold)] transition-transform ${
                      mobileAccordion === 'notes' ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {mobileAccordion === 'notes' && (
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    {NOTE_PROFILE_LINKS.map((item) => (
                      <button
                        key={item.filter}
                        type="button"
                        onClick={() => handleNavClick('shop', item.filter)}
                        className="text-left py-2 px-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border-subtle)] text-xs text-[var(--text-main)] hover:border-[var(--accent-gold)] cursor-pointer truncate"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Pinned Bottom Mobile Concierge Footer inside Drawer */}
            <div className="px-4 py-3.5 bg-[var(--bg-secondary)] border-t border-[var(--border-subtle)] flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => handleNavClick('wishlist')}
                  className="px-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-main)] flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Heart className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
                  <span>Wishlist ({wishlist.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleNavClick('track-order')}
                  className="px-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-main)] shrink-0 cursor-pointer"
                >
                  Track Order
                </button>
                <button
                  type="button"
                  onClick={() => handleNavClick('journal')}
                  className="px-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-main)] shrink-0 cursor-pointer"
                >
                  Journal
                </button>
              </div>

              {isLoggedIn ? (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleNavClick('account')}
                    className="px-3.5 py-2 rounded-lg bg-[var(--text-main)] text-[var(--bg-main)] text-[11px] font-semibold uppercase tracking-wider cursor-pointer"
                  >
                    Account
                  </button>
                  {isAdminUser && (
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setCurrentView('admin');
                      }}
                      className="px-2.5 py-2 rounded-lg border border-[var(--accent-gold)] text-[var(--accent-gold)] text-[11px] font-semibold cursor-pointer"
                    >
                      Admin
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setIsAuthModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-lg bg-[var(--text-main)] text-[var(--bg-main)] text-[11px] font-semibold uppercase tracking-wider shrink-0 cursor-pointer"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </header>
  );
};
