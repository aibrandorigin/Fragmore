import React, { useState, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { CustomerAddress, Order, OrderStatus, ReturnRefund } from '../../types';
import { CustomerAuthModal } from '../auth/CustomerAuthModal';
import { CustomerRewardsPortal, type CustomerRewardsSubTab } from './CustomerRewardsPortal';
import {
  Package,
  Clock,
  MapPin,
  Heart,
  User,
  Ticket,
  FileText,
  CheckCircle2,
  ExternalLink,
  Plus,
  Trash2,
  Sparkles,
  ShoppingBag,
  LogOut,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  RotateCcw,
  X,
  Wallet,
  Award,
  Gift,
  Share2,
  History
} from 'lucide-react';

export const CustomerAccountView: React.FC = () => {
  const {
    customer,
    updateCustomerProfile,
    changePassword,
    addOrUpdateAddress,
    orders,
    returns,
    addReturn,
    wishlist,
    products,
    setSelectedProductSlug,
    setCurrentView,
    addToCart,
    setSelectedOrderForInvoice,
    coupons,
    adminRole,
    logout,
    showNotification
  } = useStore();

  // If user is not authenticated, render the dedicated luxury sign-in portal
  if (!customer) {
    return (
      <div className="min-h-[85vh] bg-[#08080A] text-[#F3EFE6] py-16 px-4 flex flex-col items-center justify-center">
        <CustomerAuthModal inline={true} />
      </div>
    );
  }

  const [activeTab, setActiveTab] = useState<
    | 'orders'
    | 'tracking'
    | 'wallet'
    | 'privileges'
    | 'gift_cards'
    | 'referrals'
    | 'rewards_history'
    | 'addresses'
    | 'wishlist'
    | 'vouchers'
    | 'profile'
  >('orders');

  // Filter orders strictly for the current logged-in customer
  const customerOrders = orders.filter((o) => {
    if (!customer) return false;
    const matchesEmail = Boolean(
      customer.email && o.customerEmail && o.customerEmail.toLowerCase() === customer.email.toLowerCase()
    );
    const matchesId = Boolean(customer.id && o.customerId && o.customerId === customer.id);
    const matchesPhone = Boolean(
      customer.phone &&
        o.customerPhone &&
        o.customerPhone.replace(/\D/g, '') === customer.phone.replace(/\D/g, '')
    );
    return matchesEmail || matchesId || matchesPhone;
  });

  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [trackingSearchInput, setTrackingSearchInput] = useState<string>('');
  const [searchedOrder, setSearchedOrder] = useState<(typeof orders)[0] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Sync selectedOrderId with active non-delivered customer orders first
  useEffect(() => {
    if (customerOrders.length > 0 && !selectedOrderId) {
      const activeOrd =
        customerOrders.find(
          (o) => o.orderStatus !== 'DELIVERED' && o.orderStatus !== 'RETURNED' && o.orderStatus !== 'CANCELLED'
        ) || customerOrders[0];
      setSelectedOrderId(activeOrd.id);
    }
  }, [customerOrders, selectedOrderId]);

  // Return order modal state
  const [returnModalOrder, setReturnModalOrder] = useState<Order | null>(null);
  const [returnItemIndex, setReturnItemIndex] = useState<number>(0);
  const [returnReason, setReturnReason] = useState<string>('Damaged seal or packaging during transit');
  const [returnNotes, setReturnNotes] = useState<string>('');
  const [refundToWalletOptIn, setRefundToWalletOptIn] = useState<boolean>(false);

  const handleOpenReturnModal = (ord: Order) => {
    setReturnModalOrder(ord);
    setReturnItemIndex(0);
    setReturnReason('Damaged seal or packaging during transit');
    setReturnNotes('');
    setRefundToWalletOptIn(false);
  };

  const handleSubmitReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnModalOrder) return;
    const item = returnModalOrder.items[returnItemIndex] || returnModalOrder.items[0];
    const newRet: ReturnRefund & { refundToWalletOptIn?: boolean } = {
      id: 'ret-' + Date.now(),
      orderId: returnModalOrder.id,
      orderNumber: returnModalOrder.orderNumber,
      customerName: customer.name || returnModalOrder.customerName,
      customerEmail: customer.email || returnModalOrder.customerEmail,
      requestDate: new Date().toISOString().split('T')[0],
      reason: returnNotes.trim() ? `${returnReason} — ${returnNotes.trim()}` : returnReason,
      productName: item ? item.productName : 'FRAGMORÉ Creation',
      size: item ? item.size : '50 ml',
      quantity: item ? item.quantity : 1,
      refundAmount: item ? item.totalPrice : returnModalOrder.totalAmount,
      status: 'REQUESTED',
      restockInventory: true,
      refundToWalletOptIn,
      notes: `${returnNotes.trim() || 'Customer initiated return from account portal'}${
        refundToWalletOptIn ? ' · Explicit Opt-In: FRAGMORÉ Wallet Store Credit' : ' · Original Payment Method Refund'
      }`
    };
    addReturn(newRet);
    setReturnModalOrder(null);
  };

  // Address modal form
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [newFullName, setNewFullName] = useState(customer.name || '');
  const [newPhone, setNewPhone] = useState(customer.phone || '');
  const [newEmail, setNewEmail] = useState(customer.email || '');
  const [newLine1, setNewLine1] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newState, setNewState] = useState('');
  const [newPincode, setNewPincode] = useState('');

  // Profile edit form
  const [profName, setProfName] = useState(customer.name || '');
  const [profEmail, setProfEmail] = useState(customer.email || '');
  const [profPhone, setProfPhone] = useState(customer.phone || '');
  const [profBirthday, setProfBirthday] = useState<string>((customer as any).birthday || '');
  const [emailPromoOptIn, setEmailPromoOptIn] = useState<boolean>(
    (customer as any).consent?.emailPromotional !== false
  );
  const [whatsappPromoOptIn, setWhatsappPromoOptIn] = useState<boolean>(
    (customer as any).consent?.whatsappPromotional !== false
  );
  const [smsPromoOptIn, setSmsPromoOptIn] = useState<boolean>(
    Boolean((customer as any).consent?.smsPromotional)
  );
  const [unsubscribedAll, setUnsubscribedAll] = useState<boolean>(
    Boolean((customer as any).consent?.unsubscribed)
  );
  const [profileSavedMsg, setProfileSavedMsg] = useState<string | null>(null);

  // Change Password form
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [pwdStatus, setPwdStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isChangingPwd, setIsChangingPwd] = useState(false);

  // Keep form updated if customer changes
  useEffect(() => {
    if (customer) {
      setProfName(customer.name || '');
      setProfEmail(customer.email || '');
      setProfPhone(customer.phone || '');
      if ((customer as any).birthday) setProfBirthday((customer as any).birthday);
      if ((customer as any).consent) {
        setEmailPromoOptIn((customer as any).consent.emailPromotional !== false);
        setWhatsappPromoOptIn((customer as any).consent.whatsappPromotional !== false);
        setSmsPromoOptIn(Boolean((customer as any).consent.smsPromotional));
        setUnsubscribedAll(Boolean((customer as any).consent.unsubscribed));
      }
    }
  }, [customer]);

  const handleTrackSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError(null);
    const query = trackingSearchInput.trim().toUpperCase();
    if (!query) return;

    const found = orders.find(
      (o) =>
        o.orderNumber.toUpperCase() === query ||
        (o.awbNumber && o.awbNumber.toUpperCase() === query) ||
        o.id.toUpperCase() === query
    );

    if (found) {
      setSearchedOrder(found);
      setSelectedOrderId(found.id);
      setActiveTab('tracking');
    } else {
      setSearchError(`No consignment found with identifier "${query}". Please check the Order Number or AWB.`);
    }
  };

  // Selected order comes from search or customer's own orders
  const selectedOrder =
    searchedOrder ||
    customerOrders.find((o) => o.id === selectedOrderId) ||
    (customerOrders.length > 0 ? customerOrders[0] : null);

  const handleSaveAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLine1 || !newCity || !newPincode) return;

    const newAddr: CustomerAddress = {
      id: 'addr-' + Math.random().toString(36).substring(2, 7),
      fullName: newFullName,
      phone: newPhone,
      email: newEmail,
      addressLine1: newLine1,
      city: newCity,
      state: newState,
      pincode: newPincode,
      isDefault: (customer?.addresses || []).length === 0
    };
    addOrUpdateAddress(newAddr);
    setAddressModalOpen(false);
    setNewLine1('');
    setNewCity('');
    setNewState('');
    setNewPincode('');
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const consentObj = {
      emailTransactional: true,
      emailPromotional: unsubscribedAll ? false : emailPromoOptIn,
      whatsappTransactional: true,
      whatsappPromotional: unsubscribedAll ? false : whatsappPromoOptIn,
      smsTransactional: true,
      smsPromotional: unsubscribedAll ? false : smsPromoOptIn,
      marketingOptIn: !unsubscribedAll && (emailPromoOptIn || whatsappPromoOptIn || smsPromoOptIn),
      unsubscribed: unsubscribedAll,
      updatedAt: new Date().toISOString()
    };
    updateCustomerProfile({
      name: profName.trim(),
      email: profEmail.trim(),
      phone: profPhone.trim()
    });
    fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: customer.id,
        name: profName.trim(),
        email: profEmail.trim(),
        phone: profPhone.trim(),
        birthday: profBirthday || null,
        consent: consentObj,
        crmMetadata: {
          emailVerified: Boolean(profEmail.trim()),
          mobileVerified: Boolean(profPhone.trim()),
          birthday: profBirthday || null,
          consent: consentObj
        }
      })
    }).catch(() => {});
    setProfileSavedMsg('Your personal details & communication preferences have been saved.');
    setTimeout(() => setProfileSavedMsg(null), 4000);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdStatus(null);
    if (!newPwd || newPwd.length < 6) {
      setPwdStatus({
        type: 'error',
        text: 'New password must be at least 6 characters long.'
      });
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdStatus({
        type: 'error',
        text: 'New password and confirmation password do not match.'
      });
      return;
    }
    setIsChangingPwd(true);
    const res = await changePassword(currentPwd, newPwd);
    setIsChangingPwd(false);
    if (res.success) {
      setPwdStatus({ type: 'success', text: res.message });
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
    } else {
      setPwdStatus({ type: 'error', text: res.message });
    }
  };

  // Timeline step order
  const timelineSteps: { key: OrderStatus; label: string }[] = [
    { key: 'CONFIRMED', label: 'Order Confirmed' },
    { key: 'PACKING', label: 'Artisanal Packing' },
    { key: 'SHIPPED', label: 'Dispatched & In Transit' },
    { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
    { key: 'DELIVERED', label: 'Delivered' }
  ];

  const getStepStatus = (stepKey: OrderStatus, currentStatus: OrderStatus) => {
    const orderIndexMap: Record<string, number> = {
      NEW: 0,
      CONFIRMED: 1,
      PACKING: 2,
      SHIPPED: 3,
      OUT_FOR_DELIVERY: 4,
      DELIVERED: 5
    };
    const currentIdx = orderIndexMap[currentStatus] || 0;
    const stepIdx = orderIndexMap[stepKey] || 0;
    if (stepIdx < currentIdx) return 'completed';
    if (stepIdx === currentIdx) return 'current';
    return 'pending';
  };

  const wishlistProducts = products.filter((p) => wishlist.includes(p.slug));

  const isAdmin =
    customer.role === 'SUPER_ADMIN' ||
    customer.role === 'ADMIN' ||
    adminRole === 'SUPER_ADMIN' ||
    customer.email?.toLowerCase() === 'gowisherharsha@gmail.com' ||
    customer.email?.toLowerCase() === 'aibrandorigin@gmail.com' ||
    customer.email?.toLowerCase().includes('admin');

  return (
    <div className="min-h-screen bg-[#08080A] text-[#F3EFE6] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Header Profile Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-8 border-b border-white/10 mb-8 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono tracking-widest text-[#D4AF37] uppercase">
                Customer Portal
              </span>
              {isAdmin && (
                <span className="px-2 py-0.5 rounded bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#E5C378] text-[10px] font-mono font-bold uppercase">
                  Super Admin
                </span>
              )}
            </div>
            <h1 className="font-serif text-3xl tracking-widest font-light text-white uppercase">
              Welcome, {customer.name}
            </h1>
            <p className="text-xs text-white/50 font-mono mt-1">
              Member ID: {customer.id} · {customer.email}
            </p>
          </div>
          <div className="flex items-center gap-3 self-start sm:self-auto flex-wrap">
            {isAdmin && (
              <button
                onClick={() => setCurrentView('admin')}
                className="px-4 py-2.5 bg-gradient-to-r from-[#D4AF37] to-[#E5C378] hover:from-[#E5C378] hover:to-[#D4AF37] text-[#08080A] font-bold text-xs font-mono uppercase tracking-wider rounded flex items-center gap-2 shadow-lg shadow-[#D4AF37]/20 transition-all hover:scale-[1.02]"
                title="Super Admin ERP Platform"
              >
                <ShieldCheck className="w-4 h-4 text-[#08080A]" />
                <span>Super Admin ERP →</span>
              </button>
            )}
            <button
              onClick={() => setCurrentView('shop')}
              className="px-5 py-2.5 border border-[#D4AF37]/50 text-[#E5C378] hover:bg-[#D4AF37]/10 text-xs font-mono uppercase tracking-wider rounded transition-colors"
            >
              Explore Catalog →
            </button>
            <button
              onClick={() => logout()}
              className="px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 hover:text-white text-xs font-mono uppercase tracking-wider rounded flex items-center gap-2 transition-colors"
              title="Sign Out of Customer Portal"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* SUPER ADMIN ACCESS PANEL (HIDDEN PER USER REQUEST) */}
        {isAdmin && (
          <div className="hidden">
            <div className="space-y-2 relative z-10">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full bg-[#D4AF37] text-[#08080A] text-[10px] font-mono font-bold uppercase tracking-wider">
                  Admin Login Verified
                </span>
                <span className="text-emerald-400 text-xs font-mono flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Super Admin Terminal Accessible
                </span>
              </div>
              <h3 className="font-serif text-xl sm:text-2xl text-white tracking-wide uppercase font-light">
                Fragmoré Super Admin ERP Platform
              </h3>
              <p className="text-xs text-[#A3A3B0] font-light max-w-xl leading-relaxed">
                You are logged in with administrative privileges. Access full governance over product prices, live warehouse stocks, order dispatches, customer CRM, marketing attribution, and GST invoicing.
              </p>
            </div>
            <div className="relative z-10 shrink-0">
              <button
                onClick={() => setCurrentView('admin')}
                className="w-full sm:w-auto px-6 py-3.5 bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] font-bold text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-[#D4AF37]/25 flex items-center justify-center gap-2 hover:scale-[1.02]"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Launch Super Admin ERP →</span>
              </button>
            </div>
          </div>
        )}

        {/* Dashboard Tabs Header */}
        <div className="flex items-center gap-2 border-b border-white/10 pb-4 mb-8 overflow-x-auto no-scrollbar text-xs font-mono uppercase tracking-wider">
          {[
            { id: 'orders', label: 'My Orders', icon: Package, count: customerOrders.length },
            { id: 'tracking', label: 'Live Tracking', icon: Clock },
            { id: 'wallet', label: 'My Wallet', icon: Wallet },
            { id: 'privileges', label: 'FRAGMORÉ Privileges', icon: Award },
            { id: 'gift_cards', label: 'Gift Cards', icon: Gift },
            { id: 'referrals', label: 'Referrals', icon: Share2 },
            { id: 'rewards_history', label: 'Rewards History', icon: History },
            { id: 'wishlist', label: 'Wishlist', icon: Heart, count: wishlistProducts.length },
            { id: 'addresses', label: 'Saved Addresses', icon: MapPin },
            { id: 'vouchers', label: 'Privilege Vouchers', icon: Ticket },
            { id: 'profile', label: 'Profile & Security', icon: User }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#D4AF37] text-[#08080A] font-semibold shadow'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      isActive ? 'bg-[#08080A] text-[#D4AF37]' : 'bg-white/10 text-white'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* SMART WALLET, PRIVILEGES, GIFT CARDS, REFERRALS & REWARDS LEDGER PORTAL */}
        {(activeTab === 'wallet' ||
          activeTab === 'privileges' ||
          activeTab === 'gift_cards' ||
          activeTab === 'referrals' ||
          activeTab === 'rewards_history') && (
          <CustomerRewardsPortal
            activeSubTab={activeTab as CustomerRewardsSubTab}
            customerEmail={customer.email}
            customerId={customer.id}
            customerName={customer.name}
            onNavigateGiftStore={() => setCurrentView('gift-cards')}
            onNotify={showNotification}
          />
        )}

        {/* TAB 1: MY ORDERS */}
        {activeTab === 'orders' && (
          <div className="space-y-6">
            {customerOrders.length === 0 ? (
              <div className="text-center py-20 bg-[#121218] rounded-xl border border-white/5 space-y-4 max-w-lg mx-auto p-8">
                <Package className="w-12 h-12 text-[#D4AF37]/50 mx-auto" />
                <h3 className="font-serif text-xl uppercase tracking-wider text-white">No Orders Placed Yet</h3>
                <p className="text-xs text-white/60 leading-relaxed font-light">
                  Your sovereign olfactory vault is currently pristine. Explore our extrait compositions and place your inaugural order.
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => setCurrentView('shop')}
                    className="px-6 py-2.5 bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] font-bold text-xs uppercase tracking-wider rounded-lg transition-colors"
                  >
                    Explore Fragrance Catalog
                  </button>
                </div>
              </div>
            ) : (
              customerOrders.map((ord) => (
                <div
                  key={ord.id}
                  className="bg-[#121218] border border-white/10 rounded-xl p-6 space-y-4 hover:border-white/20 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/10 pb-4 gap-2 text-xs font-mono">
                    <div>
                      <span className="text-white/50 block">Order Placed: {new Date(ord.createdAt).toLocaleDateString()}</span>
                      <strong className="text-white text-sm">{ord.orderNumber}</strong>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-2.5 py-1 rounded bg-[#D4AF37]/15 text-[#E5C378] font-bold text-[11px] uppercase">
                        {ord.orderStatus}
                      </span>
                      <button
                        onClick={() => setSelectedOrderForInvoice(ord)}
                        className="flex items-center gap-1 text-[#D4AF37] hover:underline"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>GST Invoice</span>
                      </button>
                    </div>
                  </div>

                  {/* Order Items */}
                  <div className="divide-y divide-white/5">
                    {(ord.items || []).map((item, idx) => (
                      <div key={idx} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-serif text-sm text-white uppercase block">{item.productName}</span>
                          <span className="text-white/50 font-mono">{item.size} · Qty: {item.quantity}</span>
                        </div>
                        <span className="font-mono text-white font-medium">
                          ₹{item.totalPrice.toLocaleString('en-IN')}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Footer details */}
                  <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono">
                    <div className="text-white/60">
                      Shipped to: <strong className="text-white">{ord.shippingAddress?.city || 'India'}, {ord.shippingAddress?.pincode || ''}</strong>
                      {ord.awbNumber && <span> · AWB: {ord.awbNumber}</span>}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-white">
                        Total: <strong className="text-[#D4AF37] text-sm">₹{ord.totalAmount.toLocaleString('en-IN')}</strong>
                      </span>
                      {(() => {
                        const existingReturn = returns.find(
                          (r) => r.orderId === ord.id || r.orderNumber === ord.orderNumber
                        );
                        if (existingReturn || ord.orderStatus === 'RETURNED') {
                          return (
                            <span className="px-3 py-1.5 bg-amber-500/15 border border-amber-500/30 rounded text-[#D4AF37] font-semibold flex items-center gap-1.5">
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Return {existingReturn ? existingReturn.status : 'Logged'}</span>
                            </span>
                          );
                        }
                        if (ord.orderStatus === 'DELIVERED') {
                          return (
                            <button
                              type="button"
                              onClick={() => handleOpenReturnModal(ord)}
                              className="px-3.5 py-1.5 bg-white/10 hover:bg-[#D4AF37] hover:text-[#08080A] rounded text-white font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Return Order</span>
                            </button>
                          );
                        }
                        if (ord.orderStatus === 'CANCELLED') {
                          return null;
                        }
                        return (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedOrderId(ord.id);
                              setSearchedOrder(ord);
                              setActiveTab('tracking');
                            }}
                            className="px-3 py-1.5 bg-white/10 hover:bg-[#D4AF37] hover:text-[#08080A] rounded text-white font-semibold transition-colors cursor-pointer"
                          >
                            Track Status
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 2: LIVE ORDER TRACKING TIMELINE */}
        {activeTab === 'tracking' && (
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Consignment Lookup Form */}
            <div className="bg-[#121218] border border-white/10 rounded-2xl p-6 sm:p-8 space-y-4">
              <div className="flex items-center gap-2 text-xs font-mono tracking-widest text-[#D4AF37] uppercase">
                <Clock className="w-4 h-4" />
                <span>Consignment Status & Courier Tracking</span>
              </div>
              <p className="text-xs text-white/60">
                Track your artisanal flacon delivery in real time. Enter your Order ID (e.g. ORD-2025-001) or Air Waybill (AWB) number.
              </p>
              <form onSubmit={handleTrackSearch} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={trackingSearchInput}
                  onChange={(e) => setTrackingSearchInput(e.target.value)}
                  placeholder="e.g. ORD-2025-001 or BD-882194812"
                  className="flex-1 bg-[#08080A] border border-white/20 text-white placeholder-white/40 rounded-xl px-4 py-3 text-xs font-mono uppercase tracking-wider focus:outline-none focus:border-[#D4AF37]"
                />
                <button
                  type="submit"
                  className="px-6 py-3 bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Track Status</span>
                </button>
              </form>
              {searchError && (
                <p className="text-rose-400 text-xs font-mono">{searchError}</p>
              )}
            </div>

            {selectedOrder ? (
              <div className="bg-[#121218] border border-white/10 rounded-2xl p-6 sm:p-10 space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/10 pb-6 gap-4">
                  <div>
                    <span className="text-xs font-mono tracking-widest text-[#D4AF37] uppercase">
                      Consignment Journey
                    </span>
                    <h3 className="font-serif text-2xl uppercase tracking-wider text-white">
                      Order {selectedOrder.orderNumber}
                    </h3>
                    <p className="text-xs text-white/50 font-mono mt-0.5">
                      Courier: {selectedOrder.courierName || 'Blue Dart Express'} · AWB: {selectedOrder.awbNumber || 'BD-882194812'}
                    </p>
                  </div>

                  {/* Order selector if multiple customer orders */}
                  {customerOrders.length > 1 && (
                    <select
                      value={selectedOrderId}
                      onChange={(e) => {
                        setSelectedOrderId(e.target.value);
                        setSearchedOrder(null);
                      }}
                      className="bg-[#08080A] border border-white/20 rounded px-3 py-2 text-xs text-white font-mono"
                    >
                      {customerOrders.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.orderNumber} ({o.orderStatus})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Vertical / Horizontal Timeline */}
                <div className="space-y-6">
                  {timelineSteps.map((step, idx) => {
                    const status = getStepStatus(step.key, selectedOrder.orderStatus);
                    const isCompleted = status === 'completed';
                    const isCurrent = status === 'current';

                    return (
                      <div key={step.key} className="flex items-start gap-4">
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono transition-all ${
                              isCompleted
                                ? 'bg-emerald-500 text-white'
                                : isCurrent
                                ? 'bg-[#D4AF37] text-[#08080A] font-bold ring-4 ring-[#D4AF37]/20 animate-pulse'
                                : 'bg-white/10 text-white/40'
                            }`}
                          >
                            {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                          </div>
                          {idx < timelineSteps.length - 1 && (
                            <div
                              className={`w-0.5 h-10 my-1 ${
                                isCompleted ? 'bg-emerald-500' : 'bg-white/10'
                              }`}
                            />
                          )}
                        </div>

                        <div className="pt-0.5">
                          <h4
                            className={`text-sm font-serif uppercase tracking-wider ${
                              isCurrent
                                ? 'text-[#D4AF37] font-semibold'
                                : isCompleted
                                ? 'text-white'
                                : 'text-white/40'
                            }`}
                          >
                            {step.label}
                          </h4>
                          <p className="text-xs text-[#A3A3B0] font-light mt-0.5">
                            {step.key === 'CONFIRMED' && 'Authorized payment & order registered in ERP.'}
                            {step.key === 'PACKING' && 'Hand-sealed in our Worli Atelier with personalized message card.'}
                            {step.key === 'SHIPPED' && 'Handed over to premium air cargo hub for insured transit.'}
                            {step.key === 'OUT_FOR_DELIVERY' && 'Courier rider dispatched to your delivery address.'}
                            {step.key === 'DELIVERED' && 'Delivered into your hands.'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Courier Tracking Link or Return Button for Delivered Orders */}
                <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono">
                  {selectedOrder.orderStatus === 'DELIVERED' ? (
                    <>
                      <span className="text-emerald-400">Order delivered to your destination.</span>
                      <button
                        type="button"
                        onClick={() => handleOpenReturnModal(selectedOrder)}
                        className="px-4 py-2 bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] font-bold rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Return Order</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-white/60">Estimated arrival: Within 48 hours</span>
                      <a
                        href="https://bluedart.com"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-[#D4AF37] hover:underline"
                      >
                        <span>Track on Carrier Website</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-16 bg-[#121218] border border-white/5 rounded-2xl p-8 space-y-4">
                <Clock className="w-12 h-12 text-[#D4AF37]/40 mx-auto" />
                <h4 className="font-serif text-xl uppercase tracking-wider text-white">No Active Orders to Track</h4>
                <p className="text-xs text-white/50 max-w-md mx-auto leading-relaxed">
                  You currently have no active consignments in transit. Once you complete an order, your real-time artisanal packaging, air hub dispatch, and Blue Dart AWB milestones will appear here.
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => setCurrentView('shop')}
                    className="px-6 py-2.5 bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] font-bold text-xs uppercase tracking-wider rounded-lg transition-colors"
                  >
                    Explore Fragrance Catalog
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: WISHLIST */}
        {activeTab === 'wishlist' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="font-serif text-xl uppercase tracking-wider text-white">
                Saved Fragrances ({wishlistProducts.length})
              </h3>
              <button
                onClick={() => setCurrentView('wishlist')}
                className="text-xs font-mono text-[#D4AF37] hover:underline flex items-center gap-1.5"
              >
                <span>Open Dedicated Wishlist Page</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
            {wishlistProducts.length === 0 ? (
              <div className="text-center py-20 bg-[#121218] rounded-xl border border-white/5 space-y-3">
                <Heart className="w-10 h-10 text-white/30 mx-auto" />
                <p className="text-sm text-white/60 font-light">Your private wishlist is empty.</p>
                <button
                  onClick={() => setCurrentView('shop')}
                  className="px-5 py-2 bg-[#D4AF37] text-[#08080A] text-xs font-semibold uppercase tracking-wider rounded"
                >
                  Explore Creations
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {wishlistProducts.map((prod) => (
                  <div
                    key={prod.id}
                    className="p-6 bg-[#121218] border border-white/10 rounded-xl space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-[#D4AF37] uppercase">{prod.collection}</span>
                      <span className="text-xs font-mono text-white/70">From ₹{prod.variants[0].sellingPrice}</span>
                    </div>

                    <h3
                      onClick={() => {
                        setSelectedProductSlug(prod.slug);
                        setCurrentView('pdp');
                      }}
                      className="cursor-pointer font-serif text-xl uppercase tracking-wider text-white hover:text-[#D4AF37]"
                    >
                      {prod.name}
                    </h3>
                    <p className="text-xs text-[#D1CECB] font-light line-clamp-2">
                      {prod.scentProfile}
                    </p>

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => addToCart(prod, prod.variants[0].size)}
                        className="flex-1 py-2 bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] text-xs font-semibold uppercase tracking-wider rounded flex items-center justify-center gap-1.5"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        <span>Add To Bag</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: SAVED ADDRESSES */}
        {activeTab === 'addresses' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="font-serif text-xl uppercase tracking-wider text-white">
                Saved Delivery Addresses
              </h3>
              <button
                onClick={() => setAddressModalOpen(true)}
                className="px-4 py-2 bg-[#D4AF37] text-[#08080A] text-xs font-semibold uppercase tracking-wider rounded flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add New Address
              </button>
            </div>

            {(!customer?.addresses || customer.addresses.length === 0) ? (
              <div className="p-8 text-center bg-[#121218] border border-white/5 rounded-xl text-white/50 text-xs">
                No delivery addresses saved yet. Tap "Add New Address" above to register your destination.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(customer.addresses || []).map((addr) => (
                  <div
                    key={addr.id}
                    className="p-6 bg-[#121218] border border-white/10 rounded-xl space-y-3 relative"
                  >
                    {addr.isDefault && (
                      <span className="px-2 py-0.5 bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#E5C378] text-[10px] font-mono uppercase rounded">
                        Default Address
                      </span>
                    )}
                    <h4 className="font-medium text-white text-sm">{addr.fullName}</h4>
                    <p className="text-xs text-white/70">{addr.addressLine1} {addr.addressLine2}</p>
                    <p className="text-xs text-white/70">{addr.city}, {addr.state} - {addr.pincode}</p>
                    <p className="text-xs text-white/60 font-mono">Phone: {addr.phone}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: PRIVILEGE VOUCHERS */}
        {activeTab === 'vouchers' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center space-y-1 mb-8">
              <Sparkles className="w-8 h-8 text-[#D4AF37] mx-auto" />
              <h3 className="font-serif text-2xl uppercase tracking-wider text-white">
                Your House Privileges & Vouchers
              </h3>
              <p className="text-xs text-white/60">
                Exclusive redeemable credits associated with your FRAGMORÉ account.
              </p>
            </div>

            {coupons.map((c) => (
              <div
                key={c.code}
                className="p-6 bg-[#121218] border border-[#D4AF37]/30 rounded-xl flex items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <span className="text-xs font-mono font-bold text-[#D4AF37] uppercase tracking-widest block">
                    CODE: {c.code}
                  </span>
                  <p className="text-xs text-white font-medium">{c.description}</p>
                  <span className="text-[10px] font-mono text-white/50 block">
                    Valid on cart orders above ₹{c.minCartValue.toLocaleString('en-IN')}
                  </span>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(c.code);
                    showNotification(`Copied coupon code ${c.code}`);
                  }}
                  className="px-3.5 py-1.5 border border-white/20 hover:border-[#D4AF37] text-white text-xs font-mono uppercase rounded cursor-pointer"
                >
                  Copy
                </button>
              </div>
            ))}
          </div>
        )}

        {/* TAB 6: PROFILE & SECURITY (Edit Details & Change Password for All Users & Admins) */}
        {activeTab === 'profile' && (
          <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT CARD: EDIT PROFILE DETAILS */}
            <div className="bg-[#121218] border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#D4AF37] block">
                    {isAdmin ? 'Admin & Personal Account' : 'Personal Account'}
                  </span>
                  <h3 className="font-serif text-xl uppercase tracking-wider text-white">
                    Edit Profile Details
                  </h3>
                </div>
                <User className="w-5 h-5 text-[#D4AF37]" />
              </div>

              {profileSavedMsg && (
                <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 text-xs font-mono flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{profileSavedMsg}</span>
                </div>
              )}

              <form onSubmit={handleSaveProfile} className="space-y-4 text-xs font-mono">
                <div className="space-y-1">
                  <label className="text-white/70 block">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={profName}
                    onChange={(e) => setProfName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full bg-[#08080A] border border-white/20 rounded-lg p-2.5 text-white focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-white/70 block">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={profEmail}
                    onChange={(e) => setProfEmail(e.target.value)}
                    placeholder="your.email@example.com"
                    className="w-full bg-[#08080A] border border-white/20 rounded-lg p-2.5 text-white focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-white/70 block">Mobile / WhatsApp Number</label>
                  <input
                    type="tel"
                    value={profPhone}
                    onChange={(e) => setProfPhone(e.target.value)}
                    placeholder="+91 98201 00000"
                    className="w-full bg-[#08080A] border border-white/20 rounded-lg p-2.5 text-white focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-white/70 block">
                    Birthday (Optional — for private birthday privilege offers)
                  </label>
                  <input
                    type="date"
                    value={profBirthday}
                    onChange={(e) => setProfBirthday(e.target.value)}
                    className="w-full bg-[#08080A] border border-white/20 rounded-lg p-2.5 text-white focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div className="p-3.5 bg-[#08080A] border border-white/10 rounded-xl space-y-2.5">
                  <span className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-semibold block">
                    Communication &amp; Consent Preferences
                  </span>
                  <p className="text-[11px] text-white/50 font-sans">
                    Transactional order confirmations and shipping alerts are always delivered. Manage your promotional preferences below:
                  </p>
                  <label className="flex items-center gap-2 text-white/80 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!unsubscribedAll && emailPromoOptIn}
                      disabled={unsubscribedAll}
                      onChange={(e) => setEmailPromoOptIn(e.target.checked)}
                      className="accent-[#D4AF37]"
                    />
                    <span>Receive private collection invitations &amp; offers via Email</span>
                  </label>
                  <label className="flex items-center gap-2 text-white/80 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!unsubscribedAll && whatsappPromoOptIn}
                      disabled={unsubscribedAll}
                      onChange={(e) => setWhatsappPromoOptIn(e.target.checked)}
                      className="accent-[#D4AF37]"
                    />
                    <span>Receive approved WhatsApp concierge privileges</span>
                  </label>
                  <label className="flex items-center gap-2 text-white/80 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!unsubscribedAll && smsPromoOptIn}
                      disabled={unsubscribedAll}
                      onChange={(e) => setSmsPromoOptIn(e.target.checked)}
                      className="accent-[#D4AF37]"
                    />
                    <span>Receive promotional SMS alerts</span>
                  </label>
                  <div className="pt-1 border-t border-white/10">
                    <label className="flex items-center gap-2 text-rose-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={unsubscribedAll}
                        onChange={(e) => setUnsubscribedAll(e.target.checked)}
                        className="accent-rose-500"
                      />
                      <span>Unsubscribe from all promotional marketing campaigns</span>
                    </label>
                  </div>
                </div>

                <div className="pt-1">
                  <button
                    type="submit"
                    className="w-full py-3 bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] font-semibold text-xs tracking-wider uppercase rounded-lg transition-all cursor-pointer"
                  >
                    Save Profile &amp; Preferences
                  </button>
                </div>
              </form>

              {/* Active Session & Role Summary */}
              <div className="p-4 bg-[#08080A] border border-white/10 rounded-xl space-y-3 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-white font-medium uppercase tracking-wider">
                    Session Status
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 text-[10px] uppercase font-bold">
                    {isAdmin ? 'Admin Verified' : 'Active Session'}
                  </span>
                </div>
                <p className="text-white/60 text-[11px] font-light leading-relaxed">
                  Signed in as <strong className="text-white">{customer.email || customer.phone}</strong>.
                </p>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setCurrentView('admin')}
                    className="w-full py-2.5 bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] font-bold text-xs uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Open Super Admin ERP Platform</span>
                  </button>
                )}
              </div>
            </div>

            {/* RIGHT CARD: CHANGE PASSWORD & ACCOUNT SECURITY */}
            <div className="bg-[#121218] border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6 flex flex-col justify-between">
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[#D4AF37] block">
                      Credentials &amp; Password Management
                    </span>
                    <h3 className="font-serif text-xl uppercase tracking-wider text-white">
                      Change Account Password
                    </h3>
                  </div>
                  <Lock className="w-5 h-5 text-[#D4AF37]" />
                </div>

                {pwdStatus && (
                  <div
                    className={`p-3 rounded-xl text-xs font-mono flex items-center gap-2 ${
                      pwdStatus.type === 'success'
                        ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-700'
                        : 'bg-rose-500/15 border border-rose-500/30 text-rose-700'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{pwdStatus.text}</span>
                  </div>
                )}

                <form onSubmit={handleChangePassword} className="space-y-4 text-xs font-mono">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-white/70 block">Current Password</label>
                      <button
                        type="button"
                        onClick={() => setShowPwd((v) => !v)}
                        className="text-[10px] text-[#D4AF37] hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        {showPwd ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        <span>{showPwd ? 'Hide' : 'Show'}</span>
                      </button>
                    </div>
                    <input
                      type={showPwd ? 'text' : 'password'}
                      value={currentPwd}
                      onChange={(e) => setCurrentPwd(e.target.value)}
                      placeholder="Enter current password (optional for OTP/social login)"
                      className="w-full bg-[#08080A] border border-white/20 rounded-lg p-2.5 text-white focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-white/70 block">New Password *</label>
                    <input
                      type={showPwd ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={newPwd}
                      onChange={(e) => setNewPwd(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full bg-[#08080A] border border-white/20 rounded-lg p-2.5 text-white focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-white/70 block">Confirm New Password *</label>
                    <input
                      type={showPwd ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={confirmPwd}
                      onChange={(e) => setConfirmPwd(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full bg-[#08080A] border border-white/20 rounded-lg p-2.5 text-white focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isChangingPwd}
                    className="w-full py-3 bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] font-semibold text-xs tracking-wider uppercase rounded-lg transition-all cursor-pointer disabled:opacity-60"
                  >
                    {isChangingPwd ? 'Updating Password...' : 'Update Password'}
                  </button>
                </form>
              </div>

              <div className="pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => logout()}
                  className="w-full py-3 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 hover:text-white font-semibold text-xs tracking-wider uppercase rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out of Account</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ADD ADDRESS MODAL */}
      {addressModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setAddressModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
        >
          <div className="bg-[#0E0E14] border border-white/15 w-full max-w-lg my-auto max-h-[88vh] overflow-y-auto rounded-2xl p-5 sm:p-7 relative text-[#F3EFE6]">
            <h3 className="font-serif text-xl uppercase tracking-wider text-white mb-4">
              Add New Delivery Address
            </h3>
            <form onSubmit={handleSaveAddress} className="space-y-3 text-xs">
              <input
                type="text"
                required
                placeholder="Full Name"
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                className="w-full bg-[#08080A] border border-white/20 rounded p-2.5 text-white focus:border-[#D4AF37]"
              />
              <input
                type="tel"
                required
                placeholder="Phone Number"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="w-full bg-[#08080A] border border-white/20 rounded p-2.5 text-white focus:border-[#D4AF37]"
              />
              <input
                type="text"
                required
                placeholder="Flat / Building / Street Address"
                value={newLine1}
                onChange={(e) => setNewLine1(e.target.value)}
                className="w-full bg-[#08080A] border border-white/20 rounded p-2.5 text-white focus:border-[#D4AF37]"
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  required
                  placeholder="City"
                  value={newCity}
                  onChange={(e) => setNewCity(e.target.value)}
                  className="bg-[#08080A] border border-white/20 rounded p-2.5 text-white focus:border-[#D4AF37]"
                />
                <input
                  type="text"
                  required
                  placeholder="State"
                  value={newState}
                  onChange={(e) => setNewState(e.target.value)}
                  className="bg-[#08080A] border border-white/20 rounded p-2.5 text-white focus:border-[#D4AF37]"
                />
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="PIN"
                  value={newPincode}
                  onChange={(e) => setNewPincode(e.target.value)}
                  className="bg-[#08080A] border border-white/20 rounded p-2.5 text-white focus:border-[#D4AF37] font-mono"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setAddressModalOpen(false)}
                  className="px-4 py-2 border border-white/20 rounded text-white/70 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#D4AF37] text-[#08080A] font-semibold uppercase rounded cursor-pointer"
                >
                  Save Address
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RETURN ORDER MODAL (FOR DELIVERED ORDERS) */}
      {returnModalOrder && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setReturnModalOrder(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
        >
          <div className="bg-[#0E0E14] border border-white/15 w-full max-w-lg my-auto max-h-[88vh] overflow-y-auto rounded-2xl p-5 sm:p-7 relative text-[#F3EFE6]">
            <button
              type="button"
              onClick={() => setReturnModalOrder(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white cursor-pointer"
              aria-label="Close return modal"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1 mb-4 pr-8">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#D4AF37] block">
                Reverse Pickup &amp; Return Request
              </span>
              <h3 className="font-serif text-xl uppercase tracking-wider text-white">
                Return Order {returnModalOrder.orderNumber}
              </h3>
              <p className="text-xs text-white/60 font-mono">
                Delivered order eligible for white-glove return pickup and refund.
              </p>
            </div>

            <form onSubmit={handleSubmitReturn} className="space-y-4 text-xs font-mono">
              {returnModalOrder.items.length > 1 && (
                <div>
                  <label className="block text-white/70 mb-1">Select Item to Return</label>
                  <select
                    value={returnItemIndex}
                    onChange={(e) => setReturnItemIndex(Number(e.target.value))}
                    className="w-full bg-[#08080A] border border-white/20 rounded-lg p-2.5 text-white focus:border-[#D4AF37] focus:outline-none"
                  >
                    {returnModalOrder.items.map((item, idx) => (
                      <option key={idx} value={idx}>
                        {item.productName} ({item.size} · Qty {item.quantity}) — ₹{item.totalPrice.toLocaleString('en-IN')}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-white/70 mb-1">Reason for Return *</label>
                <select
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full bg-[#08080A] border border-white/20 rounded-lg p-2.5 text-white focus:border-[#D4AF37] focus:outline-none"
                >
                  <option value="Damaged seal or packaging during transit">
                    Damaged seal or packaging during transit
                  </option>
                  <option value="Incorrect fragrance or size delivered">
                    Incorrect fragrance or size delivered
                  </option>
                  <option value="Atomizer or flacon defect">
                    Atomizer or flacon defect
                  </option>
                  <option value="Exchange for another creation">
                    Exchange for another creation
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-white/70 mb-1">Additional Details (Optional)</label>
                <textarea
                  rows={2}
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder="Share any additional notes for our concierge pickup team..."
                  className="w-full bg-[#08080A] border border-white/20 rounded-lg p-2.5 text-white focus:border-[#D4AF37] focus:outline-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-[#08080A] border border-white/10 flex items-center justify-between">
                <span className="text-white/60">Estimated Refund Amount:</span>
                <strong className="text-[#D4AF37] text-sm">
                  ₹
                  {(
                    returnModalOrder.items[returnItemIndex]?.totalPrice ||
                    returnModalOrder.totalAmount
                  ).toLocaleString('en-IN')}
                </strong>
              </div>

              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={refundToWalletOptIn}
                  onChange={(e) => setRefundToWalletOptIn(e.target.checked)}
                  className="mt-0.5 accent-[#D4AF37]"
                />
                <div className="space-y-0.5">
                  <span className="text-white font-semibold block">
                    Receive instant approved refund in my FRAGMORÉ Wallet (Closed-Loop Store Credit)
                  </span>
                  <span className="text-[11px] text-white/60 font-sans block leading-relaxed">
                    Optional opt-in. Unchecked refunds are processed to your original payment method. FRAGMORÉ Wallet credits are closed-loop store credits redeemable exclusively on fragmore.shop (non-withdrawable to bank/UPI).
                  </span>
                </div>
              </label>

              <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setReturnModalOrder(null)}
                  className="px-4 py-2 border border-white/20 rounded-lg text-white/70 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] font-bold uppercase rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Submit Return Request</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
