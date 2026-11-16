import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { CustomerProfile, CustomerCommunication } from '../../types';
import {
  Users,
  Search,
  Filter,
  Plus,
  Eye,
  Star,
  Heart,
  ShoppingCart,
  Tag,
  Mail,
  MessageSquare,
  Smartphone,
  Calendar,
  Sparkles,
  CheckCircle2,
  X,
  Bell,
  Send,
  Edit3,
  ShoppingBag,
  Trash2
} from 'lucide-react';
import { AdminReviews } from './AdminReviews';
import { cloudSqlApi } from '../../lib/cloudSqlApi';
import { AssistedOrderModal } from './AssistedOrderModal';
import { ErpTableExportBar } from './erp/ErpUniversalExportModal';

interface AdminCustomersProps {
  initialSubTab?: 'all' | 'segments' | 'reviews' | 'wishlist' | 'backinstock';
}

export const AdminCustomers: React.FC<AdminCustomersProps> = ({ initialSubTab = 'all' }) => {
  const {
    customers,
    updateCustomer,
    addCustomer,
    deleteCustomer,
    backInStock,
    notifyBackInStock,
    deleteBackInStock,
    reviews,
    showNotification,
    adminRole,
    customer
  } = useStore();

  const [activeSubTab, setActiveSubTab] = useState<string>(initialSubTab);

  React.useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  // Server-authorized Admin Customers with calculated classifications
  const [adminCustomers, setAdminCustomers] = useState<CustomerProfile[]>([]);
  const [classificationFilter, setClassificationFilter] = useState<'ALL' | 'NEW' | 'VIP' | 'CUSTOMER'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSegmentFilter, setSelectedSegmentFilter] = useState<string>('all');
  const [customer360, setCustomer360] = useState<CustomerProfile | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Synchronize and poll server-side classifications strictly via Admin authorization
  const fetchAdminCustomers = React.useCallback(async () => {
    try {
      const data = await cloudSqlApi.getAdminCustomers(adminRole, customer?.email);
      if (Array.isArray(data)) {
        setAdminCustomers(data);
      }
    } catch (err) {
      // Fallback to store customers if network or local simulation
      if (customers && customers.length > 0) {
        setAdminCustomers(customers);
      }
    }
  }, [adminRole, customer?.email, customers]);

  React.useEffect(() => {
    fetchAdminCustomers();
    const interval = setInterval(() => {
      if (typeof document === 'undefined' || !document.hidden) {
        fetchAdminCustomers();
      }
    }, 60000);
    window.addEventListener('focus', fetchAdminCustomers);
    window.addEventListener('fragmore:authoritative-sync', fetchAdminCustomers);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', fetchAdminCustomers);
      window.removeEventListener('fragmore:authoritative-sync', fetchAdminCustomers);
    };
  }, [fetchAdminCustomers]);

  // New customer form
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newFav, setNewFav] = useState('GOLDEN HOUR');

  // Concierge Assisted Order State
  const [assistedModalOpen, setAssistedModalOpen] = useState(false);
  const [assistedTargetCustomer, setAssistedTargetCustomer] = useState<{
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
  } | null>(null);

  // Customer communication message form in 360 modal
  const [commChannel, setCommChannel] = useState<'WHATSAPP' | 'EMAIL' | 'SMS'>('WHATSAPP');
  const [commSubject, setCommSubject] = useState('');

  // Edit Customer Modal State
  const [editingCustomer, setEditingCustomer] = useState<CustomerProfile | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editFav, setEditFav] = useState('GOLDEN HOUR');
  const [editSegments, setEditSegments] = useState<string[]>([]);
  const [editSource, setEditSource] = useState('Direct Admin Registration');
  const [editInfluencer, setEditInfluencer] = useState('');
  const [editTotalSpend, setEditTotalSpend] = useState<number>(0);
  const [editOrdersCount, setEditOrdersCount] = useState<number>(0);
  const [editNotes, setEditNotes] = useState('');

  const AVAILABLE_SEGMENTS = [
    'New registered customers',
    'Visitors without purchases',
    'First-time buyers',
    'Repeat buyers',
    'High-value customers',
    'VIP customers',
    'Discovery buyers',
    'Signature fragrance buyers',
    'Devotional fragrance buyers',
    'Inactive customers',
    'Abandoned checkout customers',
    'Customers eligible for replenishment',
    'Customers with unresolved complaints',
    'Customers with unused vouchers'
  ];

  const startEditingCustomer = (cust: CustomerProfile) => {
    setEditingCustomer(cust);
    setEditName(cust.name || '');
    setEditEmail(cust.email || '');
    setEditPhone(cust.phone || '');
    setEditFav(cust.favouriteFragrance || 'GOLDEN HOUR');
    setEditSegments(Array.isArray(cust.segments) ? [...cust.segments] : ['VIP']);
    setEditSource(cust.source || 'Direct Admin Registration');
    setEditInfluencer(cust.influencer || '');
    setEditTotalSpend(cust.totalSpend || 0);
    setEditOrdersCount(cust.ordersCount || 0);
    setEditNotes(cust.notes || '');
  };

  const toggleEditSegment = (seg: string) => {
    setEditSegments((prev) =>
      prev.includes(seg) ? prev.filter((s) => s !== seg) : [...prev, seg]
    );
  };

  const handleUpdateCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer || !editName.trim() || !editEmail.trim()) return;

    const safeSpend = Number(editTotalSpend) || 0;
    const safeOrders = Number(editOrdersCount) || 0;
    const updated: CustomerProfile = {
      ...editingCustomer,
      name: editName.trim(),
      email: editEmail.trim(),
      phone: editPhone.trim(),
      favouriteFragrance: editFav,
      segments: editSegments.length > 0 ? editSegments : ['Private Client'],
      source: editSource.trim(),
      influencer: editInfluencer.trim() || undefined,
      totalSpend: safeSpend,
      ordersCount: safeOrders,
      aov: safeOrders > 0 ? Math.round(safeSpend / safeOrders) : editingCustomer.aov,
      notes: editNotes.trim()
    };

    updateCustomer(updated);
    if (customer360 && customer360.id === editingCustomer.id) {
      setCustomer360(updated);
    }
    setEditingCustomer(null);
  };

  const effectiveList = adminCustomers.length > 0 ? adminCustomers : customers;
  const allCount = effectiveList.length;
  const newCount = effectiveList.filter((c) => c.classification === 'NEW' || (!c.classification && (c.confirmedOrdersCount === 0 || c.ordersCount === 0))).length;
  const vipCount = effectiveList.filter((c: any) => c.isVip || c.classification === 'VIP' || (!c.classification && ((c.totalPurchaseValue || 0) >= 5000 || (c.totalSpend || 0) >= 5000))).length;
  const customerCount = effectiveList.filter((c) => c.classification === 'CUSTOMER' || (!c.classification && c.classification !== 'NEW' && c.classification !== 'VIP' && ((c.confirmedOrdersCount || 0) > 0 || (c.ordersCount || 0) > 0))).length;

  const filteredCustomers = effectiveList.filter((c: any) => {
    const q = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !q ||
      (c.name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.phone || '').includes(q);

    let matchesClassification = true;
    if (classificationFilter === 'NEW') {
      matchesClassification = c.classification === 'NEW' || (!c.classification && (c.confirmedOrdersCount === 0 || c.ordersCount === 0));
    } else if (classificationFilter === 'VIP') {
      matchesClassification = Boolean(c.isVip || c.classification === 'VIP' || (!c.classification && ((c.totalPurchaseValue || 0) >= 5000 || (c.totalSpend || 0) >= 5000)));
    } else if (classificationFilter === 'CUSTOMER') {
      matchesClassification = c.classification === 'CUSTOMER' || (!c.classification && c.classification !== 'NEW' && c.classification !== 'VIP' && ((c.confirmedOrdersCount || 0) > 0 || (c.ordersCount || 0) > 0));
    }

    const matchesSegment =
      selectedSegmentFilter === 'all' ||
      (c.segments || []).some((s: string) => s.toLowerCase() === selectedSegmentFilter.toLowerCase() || s.toLowerCase().includes(selectedSegmentFilter.toLowerCase()));

    return matchesSearch && matchesClassification && matchesSegment;
  });

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newEmail) return;

    const newCust: CustomerProfile = {
      id: 'cust-' + Math.random().toString(36).substring(2, 8),
      name: newName.trim(),
      email: newEmail.trim(),
      phone: newPhone.trim() || '',
      registeredDate: new Date().toISOString().split('T')[0],
      accountCreationDate: new Date().toISOString().split('T')[0],
      segments: ['New Customers'],
      classification: 'NEW',
      confirmedOrdersCount: 0,
      totalPurchaseValue: 0,
      totalSpend: 0,
      ordersCount: 0,
      aov: 0,
      lastOrderDate: 'Never',
      lastPurchaseDate: 'No purchases yet',
      daysSinceLastOrder: 999,
      favouriteFragrance: newFav,
      isDiscoveryBuyer: false,
      wishlistSlugs: [newFav.toLowerCase()],
      reviewsCount: 0,
      abandonedCartsCount: 0,
      couponsUsed: [],
      source: 'Direct Admin Registration',
      communicationHistory: []
    };

    addCustomer(newCust);
    setAdminCustomers((prev) => [newCust, ...prev]);
    setIsAddModalOpen(false);
    setNewName('');
    setNewEmail('');
    setNewPhone('');
  };

  const handleAddCommunication = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer360 || !commSubject) return;

    const newComm: CustomerCommunication = {
      id: 'comm-' + Math.random().toString(36).substring(2, 8),
      date: new Date().toISOString().split('T')[0],
      channel: commChannel,
      subject: commSubject,
      status: 'SENT'
    };

    const updated = {
      ...customer360,
      communicationHistory: [newComm, ...customer360.communicationHistory]
    };

    updateCustomer(updated);
    setCustomer360(updated);
    setCommSubject('');
    showNotification(`Dispatched ${commChannel} to ${customer360.name}.`);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-mono text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-white/10 gap-4">
        <div>
          <h2 className="font-serif text-2xl uppercase tracking-wider text-white">
            Customer CRM & Olfactory Connoisseur 360
          </h2>
          <p className="text-xs text-white/50">
            Omnichannel VIP profiles, lifetime value metrics, preferences, waitlists, and direct concierge dispatch.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ErpTableExportBar
            reportKey="store_customers"
            notify={(msg) => showNotification(msg)}
          />
          <button
            onClick={() => {
              setAssistedTargetCustomer(null);
              setAssistedModalOpen(true);
            }}
            className="px-3.5 py-2.5 bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 border border-[#D4AF37]/50 text-[#E5C378] font-bold text-xs uppercase tracking-wider rounded flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-[#D4AF37]" /> Assisted Cart &amp; Link
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2.5 bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] font-bold text-xs uppercase tracking-wider rounded flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Customer Profile
          </button>
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2 overflow-x-auto text-[11px]">
        {[
          { id: 'all', label: `All Customers (${customers.length})` },
          { id: 'segments', label: 'VIP & Behavioral Segments' },
          { id: 'reviews', label: `Olfactory Reviews (${reviews.length})` },
          { id: 'wishlist', label: 'Wishlist Intelligence' },
          { id: 'backinstock', label: `Back In Stock Waitlist (${backInStock.length})` }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap ${
              activeSubTab === tab.id
                ? 'bg-[#D4AF37] text-[#08080A] font-bold'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* SUB-TAB 1 & 2: ALL CUSTOMERS & SEGMENTS */}
      {(activeSubTab === 'all' || activeSubTab === 'segments') && (
        <div className="space-y-4">
          {/* Classification Filters with exact counts */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-mono">
            {[
              { id: 'ALL', label: `All (${allCount})` },
              { id: 'NEW', label: `New (${newCount})` },
              { id: 'VIP', label: `VIP ≥ ₹5,000 Net (${vipCount})` },
              { id: 'CUSTOMER', label: `Customers (${customerCount})` },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setClassificationFilter(f.id as any)}
                className={`px-3.5 py-2 rounded-lg border text-xs font-mono uppercase tracking-wider transition-all whitespace-nowrap min-h-[38px] flex items-center justify-center ${
                  classificationFilter === f.id
                    ? f.id === 'VIP'
                      ? 'bg-[#D4AF37] text-[#08080A] font-bold border-[#D4AF37] shadow-sm'
                      : f.id === 'NEW'
                      ? 'bg-sky-500 text-white font-bold border-sky-500 shadow-sm'
                      : 'bg-white text-[#08080A] font-bold border-white shadow-sm'
                    : 'bg-white/5 text-white/70 border-white/10 hover:border-white/30 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* 14 Dynamic Customer Segments Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 text-[10px] font-mono">
            <button
              onClick={() => setSelectedSegmentFilter('all')}
              className={`px-2.5 py-1.5 rounded-lg border whitespace-nowrap transition-all ${
                selectedSegmentFilter === 'all'
                  ? 'bg-[#D4AF37] text-[#08080A] font-bold border-[#D4AF37]'
                  : 'bg-white/5 text-white/60 border-white/10 hover:text-white'
              }`}
            >
              All 14 Segments
            </button>
            {AVAILABLE_SEGMENTS.map((seg) => {
              const segCount = effectiveList.filter((c) =>
                (c.segments || []).some((s) => s.toLowerCase() === seg.toLowerCase())
              ).length;
              return (
                <button
                  key={seg}
                  onClick={() => setSelectedSegmentFilter(selectedSegmentFilter === seg ? 'all' : seg)}
                  className={`px-2.5 py-1.5 rounded-lg border whitespace-nowrap transition-all ${
                    selectedSegmentFilter === seg
                      ? 'bg-[#D4AF37] text-[#08080A] font-bold border-[#D4AF37]'
                      : 'bg-white/5 text-white/60 border-white/10 hover:text-white'
                  }`}
                >
                  {seg} ({segCount})
                </button>
              );
            })}
          </div>

          {/* Search by Name, Email, or Phone */}
          <div className="flex items-center gap-3 bg-[#121218] border border-white/10 rounded-xl px-4 py-2.5">
            <Search className="w-4 h-4 text-white/40 shrink-0" />
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent text-base sm:text-xs text-white placeholder-white/40 focus:outline-none flex-1 font-mono"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="text-white/40 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* DESKTOP TABLE (Hidden on Mobile) */}
          <div className="hidden md:block bg-[#121218] border border-white/10 rounded-xl overflow-x-auto">
            <table className="w-full text-left min-w-[800px]">
              <thead>
                <tr className="border-b border-white/10 text-white/40 uppercase text-[10px]">
                  <th className="p-3.5">Name</th>
                  <th className="p-3.5">Email</th>
                  <th className="p-3.5">Phone</th>
                  <th className="p-3.5">Account Creation Date</th>
                  <th className="p-3.5">Customer Classification</th>
                  <th className="p-3.5">Confirmed Purchase Count</th>
                  <th className="p-3.5">Total Purchase Value</th>
                  <th className="p-3.5">Last Purchase Date</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-white/40">
                      No matching registered customers found.
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((cust: any) => {
                    const isVip = Boolean(cust.isVip || cust.classification === 'VIP' || (!cust.classification && ((cust.totalPurchaseValue || 0) >= 5000 || (cust.totalSpend || 0) >= 5000)));
                    const isNew = cust.classification === 'NEW' || (!cust.classification && (cust.confirmedOrdersCount === 0 || cust.ordersCount === 0));
                    const purchasesCount = (cust.confirmedOrdersCount !== undefined ? cust.confirmedOrdersCount : cust.ordersCount) || 0;
                    const totalSpend = (cust.totalPurchaseValue !== undefined ? cust.totalPurchaseValue : cust.totalSpend) || 0;
                    const lastPurchase = cust.lastPurchaseDate || (purchasesCount === 0 ? 'No purchases yet' : cust.lastOrderDate || 'No purchases yet');
                    const creationDate = cust.accountCreationDate || cust.registeredDate || (cust.createdAt ? new Date(cust.createdAt).toISOString().split('T')[0] : '2026-10-01');

                    return (
                      <tr key={cust.id} className="hover:bg-white/[0.02]">
                        <td className="p-3.5 font-medium text-white whitespace-nowrap">
                          {cust.name}
                        </td>
                        <td className="p-3.5 text-white/70 font-mono text-[11px] break-all max-w-[200px]">
                          {cust.email}
                        </td>
                        <td className="p-3.5 text-white/80 font-mono text-[11px] whitespace-nowrap">
                          {cust.phone ? cust.phone : <span className="text-white/30 italic">—</span>}
                        </td>
                        <td className="p-3.5 text-white/70 font-mono text-[11px] whitespace-nowrap">
                          {creationDate}
                        </td>
                        <td className="p-3.5 whitespace-nowrap">
                          {isVip ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono tracking-wider bg-[#D4AF37]/20 text-[#E5C378] border border-[#D4AF37]/50 inline-flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-[#D4AF37]" /> VIP Customer
                            </span>
                          ) : isNew ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono tracking-wider bg-sky-500/15 text-sky-400 border border-sky-500/30 inline-flex items-center gap-1">
                              New Customer
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium font-mono tracking-wider bg-white/10 text-white/80 border border-white/20 inline-flex items-center gap-1">
                              Customer
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 font-mono text-white/90 font-bold whitespace-nowrap">
                          {purchasesCount === 0 ? '0 purchases' : `${purchasesCount} ${purchasesCount === 1 ? 'purchase' : 'purchases'}`}
                        </td>
                        <td className="p-3.5 font-mono font-bold text-[#D4AF37] whitespace-nowrap">
                          ₹{totalSpend.toLocaleString('en-IN')}
                        </td>
                        <td className="p-3.5 font-mono text-white/70 text-[11px] whitespace-nowrap">
                          {lastPurchase}
                        </td>
                        <td className="p-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setAssistedTargetCustomer({
                                  name: cust.name,
                                  email: cust.email,
                                  phone: cust.phone,
                                  address: cust.addresses?.[0]?.street
                                });
                                setAssistedModalOpen(true);
                              }}
                              className="px-2.5 py-1.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 font-bold text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
                              title="Create Assisted Cart & Share Payment Link"
                            >
                              <ShoppingBag className="w-3 h-3 text-emerald-400" /> Assisted Link
                            </button>
                            <button
                              onClick={() => startEditingCustomer(cust)}
                              className="px-2.5 py-1.5 rounded bg-white/10 hover:bg-[#D4AF37] hover:text-[#08080A] text-white font-bold text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
                              title="Edit customer details"
                            >
                              <Edit3 className="w-3 h-3 text-[#D4AF37]" /> Edit
                            </button>
                            <button
                              onClick={() => setCustomer360(cust)}
                              className="px-2.5 py-1.5 rounded bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 text-[#E5C378] font-bold text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
                              title="View Customer 360 Dossier"
                            >
                              <Eye className="w-3 h-3" /> 360
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* MOBILE CARDS LIST (Visible on Phones) */}
          <div className="block md:hidden space-y-3">
            {filteredCustomers.length === 0 ? (
              <div className="p-8 text-center text-white/40 bg-[#121218] border border-white/10 rounded-xl">
                No matching registered customers found.
              </div>
            ) : (
              filteredCustomers.map((cust: any) => {
                const isVip = Boolean(cust.isVip || cust.classification === 'VIP' || (!cust.classification && ((cust.totalPurchaseValue || 0) >= 5000 || (cust.totalSpend || 0) >= 5000)));
                const isNew = cust.classification === 'NEW' || (!cust.classification && (cust.confirmedOrdersCount === 0 || cust.ordersCount === 0));
                const purchasesCount = (cust.confirmedOrdersCount !== undefined ? cust.confirmedOrdersCount : cust.ordersCount) || 0;
                const totalSpend = (cust.totalPurchaseValue !== undefined ? cust.totalPurchaseValue : cust.totalSpend) || 0;
                const lastPurchase = cust.lastPurchaseDate || (purchasesCount === 0 ? 'No purchases yet' : cust.lastOrderDate || 'No purchases yet');
                const creationDate = cust.accountCreationDate || cust.registeredDate || (cust.createdAt ? new Date(cust.createdAt).toISOString().split('T')[0] : '2026-10-01');

                return (
                  <div key={cust.id} className="p-4 rounded-xl bg-[#121218] border border-white/10 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <strong className="text-white text-sm font-medium block truncate">{cust.name}</strong>
                        <span className="text-white/60 font-mono text-[11px] break-all block mt-0.5">{cust.email}</span>
                        <span className="text-white/40 font-mono text-[10px] block mt-0.5">
                          {cust.phone ? cust.phone : 'Phone not provided'}
                        </span>
                      </div>
                      <div>
                        {isVip ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold font-mono tracking-wider bg-[#D4AF37]/20 text-[#E5C378] border border-[#D4AF37]/50 inline-flex items-center gap-1 shrink-0">
                            <Sparkles className="w-2.5 h-2.5 text-[#D4AF37]" /> VIP Customer
                          </span>
                        ) : isNew ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold font-mono tracking-wider bg-sky-500/15 text-sky-400 border border-sky-500/30 inline-flex items-center gap-1 shrink-0">
                            New Customer
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-medium font-mono tracking-wider bg-white/10 text-white/80 border border-white/20 inline-flex items-center gap-1 shrink-0">
                            Customer
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono p-3 bg-white/[0.02] border border-white/5 rounded-lg">
                      <div>
                        <span className="text-white/40 text-[10px] block uppercase">Account Created</span>
                        <span className="text-white/80">{creationDate}</span>
                      </div>
                      <div>
                        <span className="text-white/40 text-[10px] block uppercase">Purchases</span>
                        <span className="text-white font-semibold">
                          {purchasesCount === 0 ? '0 purchases' : `${purchasesCount} ${purchasesCount === 1 ? 'purchase' : 'purchases'}`}
                        </span>
                      </div>
                      <div>
                        <span className="text-white/40 text-[10px] block uppercase">Total Spend</span>
                        <span className="text-[#D4AF37] font-bold">₹{totalSpend.toLocaleString('en-IN')}</span>
                      </div>
                      <div>
                        <span className="text-white/40 text-[10px] block uppercase">Last Purchase</span>
                        <span className="text-white/70 truncate block">{lastPurchase}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-white/5">
                      <button
                        onClick={() => {
                          setAssistedTargetCustomer({
                            name: cust.name,
                            email: cust.email,
                            phone: cust.phone,
                            address: cust.addresses?.[0]?.street
                          });
                          setAssistedModalOpen(true);
                        }}
                        className="min-h-[38px] px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" /> Assisted Link
                      </button>
                      <button
                        onClick={() => startEditingCustomer(cust)}
                        className="min-h-[38px] px-3 py-1.5 rounded-lg bg-white/10 hover:bg-[#D4AF37] hover:text-[#08080A] text-white font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-[#D4AF37]" /> Edit
                      </button>
                      <button
                        onClick={() => setCustomer360(cust)}
                        className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 text-[#E5C378] font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" /> Customer 360
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: REVIEWS MODERATION */}
      {activeSubTab === 'reviews' && <AdminReviews />}

      {/* SUB-TAB 4: WISHLIST INTELLIGENCE */}
      {activeSubTab === 'wishlist' && (
        <div className="bg-[#121218] border border-white/10 rounded-xl p-6 space-y-4">
          <h3 className="font-serif text-lg uppercase tracking-wider text-white border-b border-white/10 pb-3">
            Customer Wishlist Demand Aggregation
          </h3>
          <p className="text-white/60 text-xs">
            Aggregate count of connoisseurs who saved specific flacons to their private wishlists.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
            {[
              { slug: 'azure', name: 'AZURE (Extrait)', count: 48, potential: 187152 },
              { slug: 'aaradhya', name: 'AARADHYA (Devotional)', count: 42, potential: 356916 },
              { slug: 'ignite', name: 'IGNITE (Smoked Oud)', count: 35, potential: 136465 },
              { slug: 'roselle', name: 'ROSELLE (Floral Rose)', count: 31, potential: 120869 },
              { slug: 'elan', name: 'ÉLAN (Gold Amber)', count: 26, potential: 101374 },
              { slug: 'suede', name: 'SUEDE (Bronze Leather)', count: 22, potential: 85778 }
            ].map((w) => (
              <div key={w.slug} className="p-4 bg-white/[0.02] border border-white/5 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <strong className="text-white block font-serif tracking-wide">{w.name}</strong>
                  <span className="flex items-center gap-1 text-[#D4AF37] font-bold">
                    <Heart className="w-3 h-3 fill-[#D4AF37]" /> {w.count}
                  </span>
                </div>
                <div className="text-[11px] text-white/50">
                  Unrealized Pipeline: <span className="text-emerald-400 font-bold">₹{w.potential.toLocaleString('en-IN')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 5: BACK IN STOCK WAITLIST */}
      {activeSubTab === 'backinstock' && (
        <div className="bg-[#121218] border border-white/10 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <h3 className="font-serif text-lg uppercase tracking-wider text-white">
                Back-in-Stock Notifications Queue
              </h3>
              <p className="text-xs text-white/50">
                Customers awaiting restock alerts for specific flacon variants.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10 text-white/40 uppercase text-[10px]">
                  <th className="p-3">Fragrance & Variant</th>
                  <th className="p-3">Customer Email</th>
                  <th className="p-3">Customer Phone</th>
                  <th className="p-3">Requested At</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {backInStock.map((bis) => (
                  <tr key={bis.id} className="hover:bg-white/[0.02]">
                    <td className="p-3 font-bold text-white">
                      {bis.productName} ({bis.size})
                    </td>
                    <td className="p-3 text-white/80">{bis.customerEmail}</td>
                    <td className="p-3 text-white/60">{bis.customerPhone}</td>
                    <td className="p-3 text-white/50">{bis.requestedAt}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          bis.status === 'NOTIFIED'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-amber-500/10 text-amber-400'
                        }`}
                      >
                        {bis.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {bis.status !== 'NOTIFIED' && (
                          <button
                            onClick={() => notifyBackInStock(bis.id)}
                            className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded font-bold text-[10px] flex items-center gap-1"
                          >
                            <Bell className="w-3 h-3" /> Dispatch Alert
                          </button>
                        )}
                        <button
                          onClick={() => deleteBackInStock(bis.id)}
                          className="p-1 text-white/40 hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CUSTOMER 360 MODAL (EXPLICIT USER REQUIREMENT) */}
      {customer360 && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setCustomer360(null);
          }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-[#0E0E14] border border-[#D4AF37]/40 rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto p-6 space-y-6 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#D4AF37] block">
                  CUSTOMER 360 DOSSIER
                </span>
                <h3 className="font-serif text-2xl uppercase tracking-wider text-white">
                  {customer360.name}
                </h3>
                <span className="text-white/50 text-xs">
                  {customer360.email} · {customer360.phone} · Member since {customer360.registeredDate}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setAssistedTargetCustomer({
                      name: customer360.name,
                      email: customer360.email,
                      phone: customer360.phone,
                      address: customer360.addresses?.[0]?.addressLine1
                    });
                    setAssistedModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-emerald-500/50 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                >
                  <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Assisted Cart &amp; Link</span>
                </button>
                <button
                  onClick={() => startEditingCustomer(customer360)}
                  className="px-3 py-1.5 rounded-lg border border-[#D4AF37]/50 bg-[#D4AF37]/15 hover:bg-[#D4AF37] hover:text-[#08080A] text-[#E5C378] font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Details</span>
                </button>
                <button
                  onClick={() => setCustomer360(null)}
                  className="p-2 text-white/50 hover:text-white rounded-lg bg-white/5 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 360 Core KPI Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 bg-[#14141C] border border-white/10 rounded-xl space-y-1">
                <span className="text-[10px] text-white/50 uppercase">Lifetime Net Revenue</span>
                <div className="text-xl font-bold text-[#D4AF37]">
                  ₹{Number((customer360 as any).totalPurchaseValue ?? customer360.totalSpend ?? 0).toLocaleString('en-IN')}
                </div>
                <span className="text-[10px] text-white/40">
                  {(customer360 as any).isVip || customer360.classification === 'VIP' ? 'VIP Status Eligible (≥ ₹5,000)' : 'Net after discounts & refunds'}
                </span>
              </div>
              <div className="p-4 bg-[#14141C] border border-white/10 rounded-xl space-y-1">
                <span className="text-[10px] text-white/50 uppercase">Qualifying Orders</span>
                <div className="text-xl font-bold text-white">{(customer360 as any).confirmedOrdersCount ?? customer360.ordersCount ?? 0}</div>
                <span className="text-[10px] text-white/40">AOV: ₹{Number(customer360.aov || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="p-4 bg-[#14141C] border border-white/10 rounded-xl space-y-1">
                <span className="text-[10px] text-white/50 uppercase">VIP & Loyalty Tier</span>
                <div className="text-sm font-bold text-[#D4AF37] mt-1">
                  {(customer360 as any).isVip || customer360.classification === 'VIP' ? 'VIP Connoisseur' : customer360.classification || 'Member'}
                </div>
                <span className="text-[10px] text-white/40">Admin-only visibility</span>
              </div>
              <div className="p-4 bg-[#14141C] border border-white/10 rounded-xl space-y-1">
                <span className="text-[10px] text-white/50 uppercase">Last Activity / Order</span>
                <div className="text-sm font-bold text-white mt-1">{(customer360 as any).lastPurchaseDate || customer360.lastOrderDate}</div>
                <span className="text-[10px] text-white/40">
                  {customer360.daysSinceLastOrder < 999 ? `${customer360.daysSinceLastOrder} days ago` : 'No orders yet'}
                </span>
              </div>
            </div>

            {/* Dynamic Segments & Consent Status */}
            <div className="p-4 bg-[#14141C] border border-white/10 rounded-xl space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-wider text-white/50">Assigned Dynamic Lifecycle Segments</span>
                <span className="text-[10px] font-mono text-emerald-400">
                  Consent: {(customer360 as any).customer360?.consentStatus?.unsubscribed ? 'UNSUBSCRIBED (Transactional Only)' : 'Opted-In (Transactional + Permitted Marketing)'}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(customer360.segments || []).map((seg) => (
                  <span key={seg} className="px-2.5 py-0.5 rounded bg-[#D4AF37]/15 text-[#E5C378] border border-[#D4AF37]/30 text-[10px] font-bold">
                    {seg}
                  </span>
                ))}
              </div>
            </div>

            {/* Preferences & Behavioral Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-5 bg-[#14141C] border border-white/10 rounded-xl space-y-3">
                <h4 className="font-serif uppercase tracking-wider text-white text-sm border-b border-white/10 pb-2">
                  Olfactory Profiling & Behavioral DNA
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/60">Favourite Fragrance:</span>
                    <span className="font-bold text-[#D4AF37]">{customer360.favouriteFragrance}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/60">Discovery Set Purchased:</span>
                    <span className={customer360.isDiscoveryBuyer ? 'text-emerald-400 font-bold' : 'text-white/40'}>
                      {customer360.isDiscoveryBuyer ? 'Yes (₹1,499 Voucher Issued)' : 'No'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/60">Private Wishlist Flacons:</span>
                    <span className="text-white font-medium">
                      {customer360.wishlistSlugs.length > 0 ? customer360.wishlistSlugs.join(', ').toUpperCase() : 'None'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/60">Reviews Submitted:</span>
                    <span className="text-white font-medium">{customer360.reviewsCount} verified</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/60">Abandoned Carts Recorded:</span>
                    <span className="text-amber-400 font-bold">{customer360.abandonedCartsCount}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/60">Coupons Redeemed:</span>
                    <span className="text-white font-mono">
                      {customer360.couponsUsed.length > 0 ? customer360.couponsUsed.join(', ') : 'None'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Attribution & Touchpoint Journey */}
              <div className="p-5 bg-[#14141C] border border-white/10 rounded-xl space-y-3">
                <h4 className="font-serif uppercase tracking-wider text-white text-sm border-b border-white/10 pb-2">
                  Acquisition Attribution & UTM Dossier
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/60">Original Source:</span>
                    <span className="text-white font-medium">{customer360.source}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/60">Influencer Partner:</span>
                    <span className="text-[#D4AF37] font-semibold">{customer360.influencer || 'Direct / None'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/60">UTM Source:</span>
                    <span className="text-white font-mono">{customer360.utmSource || 'direct'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/60">UTM Campaign:</span>
                    <span className="text-white font-mono">{customer360.utmCampaign || 'organic'}</span>
                  </div>
                  <div className="py-1">
                    <span className="text-white/60 block mb-1">Founder Concierge Notes:</span>
                    <div className="p-2.5 bg-black/40 rounded border border-white/10 text-white/80 italic text-[11px]">
                      {customer360.notes || 'No private notes logged for this connoisseur.'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Communication History & Concierge Dispatch */}
            <div className="p-5 bg-[#14141C] border border-white/10 rounded-xl space-y-4">
              <h4 className="font-serif uppercase tracking-wider text-white text-sm border-b border-white/10 pb-2 flex items-center justify-between">
                <span>Direct Concierge Communication History</span>
                <span className="text-xs font-mono text-[#D4AF37]">
                  {customer360.communicationHistory.length} Recorded Interventions
                </span>
              </h4>

              {/* History Log */}
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {(!customer360.communicationHistory || customer360.communicationHistory.length === 0) ? (
                  <p className="text-white/40 text-xs italic">No communication logs recorded yet.</p>
                ) : (
                  (customer360.communicationHistory || []).map((comm) => (
                    <div
                      key={comm.id}
                      className="p-3 bg-white/[0.02] border border-white/5 rounded-lg flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                            comm.channel === 'WHATSAPP'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : comm.channel === 'EMAIL'
                              ? 'bg-sky-500/20 text-sky-400'
                              : 'bg-amber-500/20 text-amber-400'
                          }`}
                        >
                          {comm.channel}
                        </span>
                        <span className="text-white font-medium">{comm.subject}</span>
                      </div>
                      <div className="flex items-center gap-3 text-white/50 text-[10px]">
                        <span>{comm.date}</span>
                        <span className="px-1.5 py-0.5 rounded bg-white/5 font-bold text-white/80">
                          {comm.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Quick Concierge Dispatch Form */}
              <form onSubmit={handleAddCommunication} className="pt-3 border-t border-white/10 space-y-3">
                <span className="text-[11px] text-white/60 font-semibold block">
                  Log or Dispatch New Concierge Communication:
                </span>
                <div className="flex flex-col sm:flex-row gap-3">
                  <select
                    value={commChannel}
                    onChange={(e: any) => setCommChannel(e.target.value)}
                    className="bg-[#0E0E14] border border-white/20 text-white rounded-lg px-3 py-2 focus:outline-none"
                  >
                    <option value="WHATSAPP">WhatsApp API</option>
                    <option value="EMAIL">SendGrid Email</option>
                    <option value="SMS">Msg91 SMS</option>
                  </select>

                  <input
                    type="text"
                    placeholder="Enter message subject or template summary..."
                    value={commSubject}
                    onChange={(e) => setCommSubject(e.target.value)}
                    className="flex-1 bg-[#0E0E14] border border-white/20 text-white placeholder-white/40 rounded-lg px-4 py-2 focus:outline-none focus:border-[#D4AF37]"
                  />

                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] font-bold rounded-lg flex items-center justify-center gap-1.5 uppercase tracking-wider text-xs"
                  >
                    <Send className="w-3.5 h-3.5" /> Dispatch
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ADD CUSTOMER MODAL */}
      {isAddModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAddModalOpen(false);
          }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-[#0E0E14] border border-white/20 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-serif text-lg uppercase tracking-wider text-white">
                Add New Luxury Connoisseur
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-white/40 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-4">
              <div>
                <label className="block text-white/60 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Maharani Gayatri Devi"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-[#121218] border border-white/20 text-white rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-white/60 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. gayatri.devi@heritage.co.in"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-[#121218] border border-white/20 text-white rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-white/60 mb-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="+91 98201 00000"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full bg-[#121218] border border-white/20 text-white rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-white/60 mb-1">Preferred Fragrance</label>
                <select
                  value={newFav}
                  onChange={(e) => setNewFav(e.target.value)}
                  className="w-full bg-[#121218] border border-white/20 text-white rounded-lg px-3 py-2"
                >
                  <option value="GOLDEN HOUR">GOLDEN HOUR (Signature)</option>
                  <option value="BLUSH & BLOSSOM">BLUSH &amp; BLOSSOM (Signature)</option>
                  <option value="VIOLET NOIR">VIOLET NOIR (Signature)</option>
                  <option value="MOKSHA ESSENCE">MOKSHA ESSENCE (Signature)</option>
                  <option value="LUXE HERITAGE">LUXE HERITAGE (Signature)</option>
                  <option value="FRAGMORÉ DISCOVERY SIX">FRAGMORÉ DISCOVERY SIX (Discovery Set)</option>
                  <option value="TEMPLE FLORA">TEMPLE FLORA (Signature)</option>
                  <option value="DIVINE AURA">DIVINE AURA (Signature)</option>
                  <option value="SACRED WOOD">SACRED WOOD (Signature)</option>
                  <option value="CELESTIAL BLOOM">CELESTIAL BLOOM (Signature)</option>
                  <option value="VELVET OUD">VELVET OUD (Signature)</option>
                  <option value="AURA BLISS">AURA BLISS (15ml Aura)</option>
                  <option value="AURA BREEZE">AURA BREEZE (15ml Aura)</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-white/20 text-white rounded-lg hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] font-bold rounded-lg transition-colors"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT CUSTOMER MODAL */}
      {editingCustomer && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingCustomer(null);
          }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-[#0E0E14] border border-[#D4AF37]/50 rounded-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#D4AF37] block">
                  CRM Profile Master
                </span>
                <h3 className="font-serif text-xl uppercase tracking-wider text-white">
                  Edit Connoisseur: {editingCustomer.name}
                </h3>
              </div>
              <button
                onClick={() => setEditingCustomer(null)}
                className="text-white/40 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateCustomerSubmit} className="space-y-4 text-xs font-mono">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/70 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-[#121218] border border-white/20 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="block text-white/70 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full bg-[#121218] border border-white/20 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/70 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full bg-[#121218] border border-white/20 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="block text-white/70 mb-1">Preferred Fragrance DNA</label>
                  <select
                    value={editFav}
                    onChange={(e) => setEditFav(e.target.value)}
                    className="w-full bg-[#121218] border border-white/20 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-[#D4AF37]"
                  >
                    <option value="GOLDEN HOUR">GOLDEN HOUR (Signature)</option>
                    <option value="BLUSH & BLOSSOM">BLUSH &amp; BLOSSOM (Signature)</option>
                    <option value="VIOLET NOIR">VIOLET NOIR (Signature)</option>
                    <option value="MOKSHA ESSENCE">MOKSHA ESSENCE (Signature)</option>
                    <option value="LUXE HERITAGE">LUXE HERITAGE (Signature)</option>
                    <option value="FRAGMORÉ DISCOVERY SIX">FRAGMORÉ DISCOVERY SIX (Discovery Set)</option>
                    <option value="TEMPLE FLORA">TEMPLE FLORA (Signature)</option>
                    <option value="DIVINE AURA">DIVINE AURA (Signature)</option>
                    <option value="SACRED WOOD">SACRED WOOD (Signature)</option>
                    <option value="CELESTIAL BLOOM">CELESTIAL BLOOM (Signature)</option>
                    <option value="VELVET OUD">VELVET OUD (Signature)</option>
                    <option value="AURA BLISS">AURA BLISS (15ml Aura)</option>
                    <option value="AURA BREEZE">AURA BREEZE (15ml Aura)</option>
                  </select>
                </div>
              </div>

              {/* Segments Tag Selector */}
              <div>
                <label className="block text-white/70 mb-1.5">
                  Client VIP & Behavioral Segments (Tap to toggle)
                </label>
                <div className="flex flex-wrap gap-1.5 p-2 bg-[#121218] border border-white/10 rounded-lg">
                  {AVAILABLE_SEGMENTS.map((seg) => {
                    const isSelected = editSegments.includes(seg);
                    return (
                      <button
                        type="button"
                        key={seg}
                        onClick={() => toggleEditSegment(seg)}
                        className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all ${
                          isSelected
                            ? 'bg-[#D4AF37] text-[#08080A] shadow-sm'
                            : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        {isSelected ? `✓ ${seg}` : `+ ${seg}`}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/70 mb-1">Acquisition Source</label>
                  <input
                    type="text"
                    value={editSource}
                    onChange={(e) => setEditSource(e.target.value)}
                    placeholder="e.g. Organic Web Portal, Direct Admin"
                    className="w-full bg-[#121218] border border-white/20 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="block text-white/70 mb-1">Influencer / Affiliate Referral</label>
                  <input
                    type="text"
                    value={editInfluencer}
                    onChange={(e) => setEditInfluencer(e.target.value)}
                    placeholder="e.g. @alizeh.scents (leave blank if none)"
                    className="w-full bg-[#121218] border border-white/20 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/70 mb-1">Lifetime Spend (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={editTotalSpend}
                    onChange={(e) => setEditTotalSpend(Number(e.target.value))}
                    className="w-full bg-[#121218] border border-white/20 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="block text-white/70 mb-1">Orders Count</label>
                  <input
                    type="number"
                    min="0"
                    value={editOrdersCount}
                    onChange={(e) => setEditOrdersCount(Number(e.target.value))}
                    className="w-full bg-[#121218] border border-white/20 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-white/70 mb-1">Founder / Concierge Private Notes</label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Record fragrance preferences, personal bespoke requests, or private consultation details..."
                  className="w-full bg-[#121218] border border-white/20 text-white placeholder-white/40 rounded-lg px-3 py-2 focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingCustomer(null)}
                  className="px-4 py-2 border border-white/20 text-white/80 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-md"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Update Customer Details</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONCIERGE ASSISTED ORDER & DIRECT PAYMENT LINK MODAL */}
      <AssistedOrderModal
        isOpen={assistedModalOpen}
        onClose={() => setAssistedModalOpen(false)}
        preselectedCustomer={assistedTargetCustomer}
      />
    </div>
  );
};
