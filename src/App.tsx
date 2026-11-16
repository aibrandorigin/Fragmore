import React, { useEffect } from 'react';
import { StoreProvider, useStore } from './context/StoreContext';
import { Header } from './components/common/Header';
import { Footer } from './components/common/Footer';
import { AnnouncementBar } from './components/common/AnnouncementBar';
import { PageTransitionCurtain } from './components/common/PageTransitionCurtain';
import { IntroWordmarkStage } from './components/storefront/IntroWordmarkStage';
import { HeroSection } from './components/storefront/HeroSection';
import { LuminaShowcaseSection } from './components/storefront/LuminaShowcaseSection';
import { FragranceScrollJourney } from './components/storefront/FragranceScrollJourney';
import { CategorySelector } from './components/storefront/CategorySelector';
import { DevotionalCollection } from './components/storefront/DevotionalCollection';
import { DiscoverySixSection } from './components/storefront/DiscoverySixSection';
import { ShopView } from './components/storefront/ShopView';
import { ProductDetailView } from './components/storefront/ProductDetailView';
import { CartDrawer } from './components/storefront/CartDrawer';
import { CheckoutView } from './components/storefront/CheckoutView';
import { CustomerAccountView } from './components/storefront/CustomerAccountView';
import { WishlistView } from './components/storefront/WishlistView';
import { TheJournalView } from './components/storefront/TheJournalView';
import { TrackOrderView } from './components/storefront/TrackOrderView';
import { FragranceQuizModal } from './components/storefront/FragranceQuizModal';
import { SearchModal } from './components/storefront/SearchModal';
import { CustomerAuthModal } from './components/auth/CustomerAuthModal';
import { LaunchModeOverlay } from './components/storefront/LaunchModeOverlay';
import { TaxInvoiceModal } from './components/storefront/TaxInvoiceModal';
import { GiftCardsStoreView } from './components/storefront/GiftCardsStoreView';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { rewardsApi } from './lib/rewardsApi';
import { Sparkles } from 'lucide-react';

const AppContent: React.FC = () => {
  const {
    currentView,
    setCurrentView,
    selectedProductSlug,
    products,
    notification,
    selectedOrderForInvoice,
    setSelectedOrderForInvoice,
    customer,
    isAuthModalOpen,
    setIsAuthModalOpen,
    showNotification,
    trackEvent
  } = useStore();

  // Support direct browser URL navigation to /admin/ai-cmo/* or /gift-cards + ?ref= referral capture
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const refCode = params.get('ref');
      if (refCode && refCode.trim()) {
        sessionStorage.setItem('fragmore_pending_ref_code', refCode.trim().toUpperCase());
      }
      if (window.location.pathname.startsWith('/admin/ai-cmo') && currentView !== 'admin') {
        setCurrentView('admin');
      } else if (window.location.pathname.startsWith('/gift-cards') && currentView !== 'gift-cards') {
        setCurrentView('gift-cards');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Automatically bind pending ?ref= code when a first-time customer signs in
  useEffect(() => {
    if (typeof window === 'undefined' || !customer?.email) return;
    const pendingRef = sessionStorage.getItem('fragmore_pending_ref_code');
    if (!pendingRef) return;
    sessionStorage.removeItem('fragmore_pending_ref_code');
    rewardsApi
      .applyReferralCode(customer.email, pendingRef, customer.phone, customer.id)
      .then(() => {
        showNotification(`Referral privilege ${pendingRef} linked to your FRAGMORÉ account.`);
      })
      .catch(() => {});
  }, [customer?.email, customer?.phone, customer?.id, showNotification]);

  // Ensure URL resets to root when navigating away from Admin Portal to Storefront or other views
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      currentView !== 'admin' &&
      window.location.pathname.startsWith('/admin')
    ) {
      window.history.pushState({}, '', '/');
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
  }, [currentView]);

  // Synchronize page metadata & track pageviews
  useEffect(() => {
    trackEvent('PageView', { path: currentView });

    if ((currentView === 'product' || currentView === 'pdp') && selectedProductSlug) {
      const prod = products.find((p) => p.slug === selectedProductSlug);
      if (prod) {
        document.title = `${prod.name} — ${prod.subtitle} | FRAGMORÉ`;
        return;
      }
    }
    if (currentView === 'gift-cards') {
      document.title = 'Gift FRAGMORÉ — Luxury Perfume Gift Cards | FRAGMORÉ';
      return;
    }
    document.title = 'FRAGMORÉ — Scent That Stays With You. | Luxury Perfumes';
  }, [currentView, selectedProductSlug, products]);

  return (
    <div
      className={`bg-[var(--bg-main)] text-[var(--text-main)] flex flex-col relative selection:bg-[var(--accent-gold)]/20 selection:text-[var(--text-main)] w-full max-w-full transition-colors duration-300 storefront-theme-scope ${
        currentView === 'admin' ? 'h-screen overflow-hidden' : 'min-h-screen'
      }`}
    >
      {/* VERTICAL SLAT PAGE TRANSITION CURTAIN (Reference Video 00:08–00:10) */}
      <PageTransitionCurtain />

      {/* LAUNCH MODE OVERLAY (Toggled in Admin CMS) */}
      <LaunchModeOverlay />

      {/* GLOBAL TOAST NOTIFICATION */}
      {notification && (
        <div className="fixed top-24 right-6 z-50 bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-main)] px-4 py-3 rounded-xl shadow-[0_14px_34px_rgba(0,0,0,0.18)] text-xs font-mono flex items-center gap-2.5 animate-in fade-in slide-in-from-top-4 duration-300">
          <Sparkles className="w-4 h-4 text-[var(--accent-gold)] shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* TOP ANNOUNCEMENT BAR */}
      <AnnouncementBar />

      {/* STICKY LUXURY NAVIGATION HEADER */}
      <Header />

      {/* MAIN VIEW ROUTING */}
      <main
        className={
          currentView === 'admin'
            ? 'flex-1 min-h-0 overflow-hidden flex flex-col'
            : 'flex-1'
        }
      >
        {currentView === 'storefront' && (
          <>
            <IntroWordmarkStage />
            <HeroSection />
            <LuminaShowcaseSection />
            <FragranceScrollJourney />
            <CategorySelector />
            <DevotionalCollection />
            <DiscoverySixSection />
          </>
        )}

        {currentView === 'shop' && <ShopView />}
        {(currentView === 'pdp' || currentView === 'product') && <ProductDetailView />}
        {currentView === 'checkout' && <CheckoutView />}
        {currentView === 'account' && <CustomerAccountView />}
        {currentView === 'wishlist' && <WishlistView />}
        {(currentView === 'journal' || currentView === 'editorial') && <TheJournalView />}
        {currentView === 'track-order' && <TrackOrderView />}
        {currentView === 'gift-cards' && <GiftCardsStoreView />}
        {currentView === 'admin' && <AdminDashboard />}
      </main>

      {/* FOOTER */}
      {currentView !== 'admin' && <Footer />}

      {/* GLOBAL MODALS & OVERLAYS */}
      <CartDrawer />
      <FragranceQuizModal />
      <SearchModal />
      <CustomerAuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

      {/* TAX INVOICE MODAL */}
      {selectedOrderForInvoice && (
        <TaxInvoiceModal
          order={selectedOrderForInvoice}
          onClose={() => setSelectedOrderForInvoice(null)}
        />
      )}
    </div>
  );
};

export default function App() {
  return (
    <StoreProvider>
      <AppContent />
    </StoreProvider>
  );
}
