import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { VisitorSessionRecord } from '../../types';
import {
  Users,
  Activity,
  ShoppingBag,
  MapPin,
  Smartphone,
  Monitor,
  Tablet,
  MessageCircle,
  Phone,
  Mail,
  Search,
  Sparkles,
  ShieldCheck,
  UserCheck,
  Clock,
  RefreshCw,
  Flame,
  Globe
} from 'lucide-react';
import { AssistedOrderModal } from './AssistedOrderModal';

interface LiveVisitorTelemetryProps {
  variant?: 'dark' | 'light';
  title?: string;
  maxItems?: number;
  showFilters?: boolean;
}

export const LiveVisitorTelemetry: React.FC<LiveVisitorTelemetryProps> = ({
  variant = 'dark',
  title = 'Live Visitor Telemetry & Patron Intelligence',
  maxItems = 50,
  showFilters = true
}) => {
  const { visitorStats, refreshVisitorStats, customers } = useStore();
  const [filterTab, setFilterTab] = useState<'all' | 'identified' | 'carts' | 'discovery'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [assistedPatron, setAssistedPatron] = useState<{
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
  } | null>(null);
  const [isAssistedModalOpen, setIsAssistedModalOpen] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshVisitorStats();
    } catch {}
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Merge live active sessions and recent visits, matching against known registered customers if email/phone match
  const visitorsList = useMemo(() => {
    const rawList: VisitorSessionRecord[] = [];
    const seenTokens = new Set<string>();

    // Prioritize active live sessions first
    if (Array.isArray(visitorStats?.liveVisitors) && visitorStats.liveVisitors.length > 0) {
      visitorStats.liveVisitors.forEach((vis) => {
        if (!seenTokens.has(vis.visitorId)) {
          seenTokens.add(vis.visitorId);
          rawList.push(vis);
        }
      });
    }

    // Add recent visits
    if (Array.isArray(visitorStats?.recentVisits)) {
      visitorStats.recentVisits.forEach((vis) => {
        if (!seenTokens.has(vis.visitorId)) {
          seenTokens.add(vis.visitorId);
          rawList.push(vis);
        }
      });
    }

    // Enrich with CRM customer profile if matching email or phone
    return rawList.map((vis) => {
      let enrichedName = vis.customerName;
      let enrichedPhone = vis.customerPhone;
      let enrichedCity = vis.location;
      let isRegistered = vis.isLoggedIn || false;

      if (vis.customerEmail && customers.length > 0) {
        const found = customers.find(
          (c) => c.email.toLowerCase() === vis.customerEmail?.toLowerCase()
        );
        if (found) {
          enrichedName = found.name || enrichedName;
          enrichedPhone = found.phone || enrichedPhone;
          enrichedCity = found.addresses?.[0]?.city || (found as any).city || enrichedCity;
          isRegistered = true;
        }
      }

      return {
        ...vis,
        customerName: enrichedName || 'Anonymous Guest Patron',
        customerPhone: enrichedPhone,
        location: enrichedCity || 'India (Metro)',
        isLoggedIn: isRegistered
      };
    });
  }, [visitorStats?.liveVisitors, visitorStats?.recentVisits, customers]);

  // Filtered visitors
  const filteredVisitors = useMemo(() => {
    return visitorsList.filter((vis) => {
      // Tab filter
      if (filterTab === 'identified') {
        const hasName = vis.customerName && vis.customerName !== 'Anonymous Guest Patron';
        const hasEmail = Boolean(vis.customerEmail);
        const hasPhone = Boolean(vis.customerPhone);
        if (!hasName && !hasEmail && !hasPhone) return false;
      } else if (filterTab === 'carts') {
        if ((vis.cartValue || 0) <= 0 && (vis.cartItemsCount || 0) <= 0) return false;
      } else if (filterTab === 'discovery') {
        const pageLower = (vis.page || '').toLowerCase();
        if (!pageLower.includes('discovery') && !pageLower.includes('product') && !pageLower.includes('flacon')) {
          return false;
        }
      }

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = (vis.customerName || '').toLowerCase().includes(query);
        const matchesEmail = (vis.customerEmail || '').toLowerCase().includes(query);
        const matchesPhone = (vis.customerPhone || '').toLowerCase().includes(query);
        const matchesCity = (vis.location || '').toLowerCase().includes(query);
        const matchesPage = (vis.page || '').toLowerCase().includes(query);
        const matchesToken = (vis.visitorId || '').toLowerCase().includes(query);
        return matchesName || matchesEmail || matchesPhone || matchesCity || matchesPage || matchesToken;
      }

      return true;
    }).slice(0, maxItems);
  }, [visitorsList, filterTab, searchQuery, maxItems]);

  const identifiedCount = useMemo(
    () =>
      visitorsList.filter(
        (v) => (v.customerName && v.customerName !== 'Anonymous Guest Patron') || v.customerEmail || v.customerPhone
      ).length,
    [visitorsList]
  );

  const cartActiveCount = useMemo(
    () => visitorsList.filter((v) => (v.cartValue || 0) > 0 || (v.cartItemsCount || 0) > 0).length,
    [visitorsList]
  );

  const isDark = variant === 'dark';

  return (
    <div
      className={`rounded-2xl border transition-all ${
        isDark
          ? 'bg-[#121218] border-white/10 text-white shadow-xl'
          : 'bg-[#FFFFFF] border-[#DED7CC] text-[#24211D] shadow-xs'
      } p-6 space-y-6`}
    >
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5 border-white/10 dark:border-white/10 border-b-[#DED7CC]">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <h3
              className={`font-serif text-lg uppercase tracking-wider font-semibold ${
                isDark ? 'text-white' : 'text-[#24211D]'
              }`}
            >
              {title}
            </h3>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-medium ${
                isDark ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}
            >
              {visitorStats?.activeNow || visitorsList.length || 1} LIVE NOW
            </span>
          </div>
          <p className={`text-xs ${isDark ? 'text-white/60' : 'text-[#686158]'}`}>
            Real-time telemetry capturing visitor identities, browsed products, locations, and cart intent for VIP concierge conversion.
          </p>
        </div>

        {/* Quick Metrics & Refresh */}
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-4 px-4 py-2 rounded-xl border text-xs ${
              isDark ? 'bg-white/5 border-white/10' : 'bg-[#FAF8F4] border-[#DED7CC]'
            }`}
          >
            <div>
              <span className={`block text-[10px] uppercase font-mono ${isDark ? 'text-white/50' : 'text-[#8C827A]'}`}>
                Identified
              </span>
              <span className={`font-mono font-bold ${isDark ? 'text-[#D4AF37]' : 'text-[#9A783E]'}`}>
                {identifiedCount} Patrons
              </span>
            </div>
            <div className={`h-6 w-px ${isDark ? 'bg-white/10' : 'bg-[#DED7CC]'}`} />
            <div>
              <span className={`block text-[10px] uppercase font-mono ${isDark ? 'text-white/50' : 'text-[#8C827A]'}`}>
                Cart Active
              </span>
              <span className="font-mono font-bold text-emerald-500">
                {cartActiveCount} Active
              </span>
            </div>
          </div>

          <button
            onClick={handleRefresh}
            title="Refresh Live Telemetry"
            className={`p-2.5 rounded-xl border transition-colors ${
              isDark
                ? 'bg-white/5 border-white/10 hover:bg-white/10 text-white/80 hover:text-white'
                : 'bg-[#FAF8F4] border-[#DED7CC] hover:bg-[#F1EDE5] text-[#686158] hover:text-[#24211D]'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#D4AF37]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      {showFilters && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setFilterTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
                filterTab === 'all'
                  ? isDark
                    ? 'bg-[#D4AF37] text-black font-semibold'
                    : 'bg-[#24211D] text-white font-semibold'
                  : isDark
                  ? 'bg-white/5 text-white/70 hover:bg-white/10'
                  : 'bg-[#FAF8F4] text-[#686158] hover:bg-[#F1EDE5]'
              }`}
            >
              All Visitors ({visitorsList.length})
            </button>
            <button
              onClick={() => setFilterTab('identified')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 flex items-center gap-1.5 ${
                filterTab === 'identified'
                  ? isDark
                    ? 'bg-[#D4AF37] text-black font-semibold'
                    : 'bg-[#24211D] text-white font-semibold'
                  : isDark
                  ? 'bg-white/5 text-white/70 hover:bg-white/10'
                  : 'bg-[#FAF8F4] text-[#686158] hover:bg-[#F1EDE5]'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Identified Patrons ({identifiedCount})</span>
            </button>
            <button
              onClick={() => setFilterTab('carts')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 flex items-center gap-1.5 ${
                filterTab === 'carts'
                  ? isDark
                    ? 'bg-[#D4AF37] text-black font-semibold'
                    : 'bg-[#24211D] text-white font-semibold'
                  : isDark
                  ? 'bg-white/5 text-white/70 hover:bg-white/10'
                  : 'bg-[#FAF8F4] text-[#686158] hover:bg-[#F1EDE5]'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>In Cart ({cartActiveCount})</span>
            </button>
            <button
              onClick={() => setFilterTab('discovery')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 flex items-center gap-1.5 ${
                filterTab === 'discovery'
                  ? isDark
                    ? 'bg-[#D4AF37] text-black font-semibold'
                    : 'bg-[#24211D] text-white font-semibold'
                  : isDark
                  ? 'bg-white/5 text-white/70 hover:bg-white/10'
                  : 'bg-[#FAF8F4] text-[#686158] hover:bg-[#F1EDE5]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Fragrance PDPs</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search
              className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${
                isDark ? 'text-white/40' : 'text-[#8C827A]'
              }`}
            />
            <input
              type="text"
              placeholder="Search by name, phone, city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-9 pr-3 py-1.5 rounded-lg text-xs border outline-none transition-all ${
                isDark
                  ? 'bg-white/5 border-white/10 text-white placeholder-white/30 focus:border-[#D4AF37]'
                  : 'bg-[#FAF8F4] border-[#DED7CC] text-[#24211D] placeholder-[#8C827A] focus:border-[#24211D]'
              }`}
            />
          </div>
        </div>
      )}

      {/* Main Telemetry Table */}
      <div
        className={`overflow-x-auto rounded-xl border ${
          isDark ? 'border-white/10 bg-black/20' : 'border-[#DED7CC] bg-[#FFFFFF]'
        }`}
      >
        <table className="w-full text-left text-xs">
          <thead
            className={`uppercase text-[10px] font-mono tracking-wider border-b ${
              isDark
                ? 'bg-white/[0.03] border-white/10 text-white/50'
                : 'bg-[#F1EDE5] border-[#DED7CC] text-[#686158]'
            }`}
          >
            <tr>
              <th className="py-3 px-4">Patron & Identity</th>
              <th className="py-3 px-4">Current Browsing Surface</th>
              <th className="py-3 px-4">Location & Network</th>
              <th className="py-3 px-4">Cart Status</th>
              <th className="py-3 px-4">Channel & Device</th>
              <th className="py-3 px-4">Active Status</th>
              <th className="py-3 px-4 text-right">Concierge Action</th>
            </tr>
          </thead>
          <tbody
            className={`divide-y ${
              isDark ? 'divide-white/5 text-white/90' : 'divide-[#DED7CC] text-[#24211D]'
            }`}
          >
            {filteredVisitors.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <Activity className={`w-8 h-8 opacity-30 ${isDark ? 'text-white' : 'text-[#686158]'}`} />
                    <p className={`text-xs ${isDark ? 'text-white/50' : 'text-[#686158]'}`}>
                      No visitor sessions match your current filter.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredVisitors.map((vis) => {
                const isIdentified =
                  (vis.customerName && vis.customerName !== 'Anonymous Guest Patron') ||
                  Boolean(vis.customerEmail) ||
                  Boolean(vis.customerPhone);
                const hasCart = (vis.cartValue || 0) > 0 || (vis.cartItemsCount || 0) > 0;
                const dateObj = new Date(vis.timestamp);
                const timeStr = !isNaN(dateObj.getTime())
                  ? dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                  : 'Just now';

                return (
                  <tr
                    key={vis.id}
                    className={`transition-colors ${
                      isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-[#FAF8F4]'
                    }`}
                  >
                    {/* Column 1: Patron & Identity */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                            isIdentified
                              ? isDark
                                ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40'
                                : 'bg-[#9A783E]/15 text-[#9A783E] border border-[#9A783E]/30'
                              : isDark
                              ? 'bg-white/10 text-white/50 border border-white/10'
                              : 'bg-[#F1EDE5] text-[#686158] border border-[#DED7CC]'
                          }`}
                        >
                          {isIdentified
                            ? (vis.customerName || 'P').charAt(0).toUpperCase()
                            : '#'}
                        </div>
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`font-semibold text-xs truncate max-w-[170px] ${
                                isIdentified
                                  ? isDark
                                    ? 'text-white font-medium'
                                    : 'text-[#24211D] font-medium'
                                  : isDark
                                  ? 'text-white/60 font-mono text-[11px]'
                                  : 'text-[#686158] font-mono text-[11px]'
                              }`}
                            >
                              {vis.customerName}
                            </span>
                            {isIdentified && (
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] font-mono uppercase ${
                                  vis.isLoggedIn
                                    ? isDark
                                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : isDark
                                    ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30'
                                    : 'bg-[#9A783E]/15 text-[#9A783E] border border-[#9A783E]/30'
                                }`}
                              >
                                {vis.isLoggedIn ? 'VIP Patron' : 'Identified'}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-[10px] text-white/50 flex-wrap">
                            <span className="font-mono text-[10px] opacity-70">
                              {vis.visitorId.slice(0, 14)}
                            </span>
                            {vis.customerEmail && (
                              <span
                                className={`flex items-center gap-1 truncate max-w-[140px] ${
                                  isDark ? 'text-white/60' : 'text-[#686158]'
                                }`}
                                title={vis.customerEmail}
                              >
                                <Mail className="w-2.5 h-2.5 shrink-0" />
                                <span className="truncate">{vis.customerEmail}</span>
                              </span>
                            )}
                            {vis.customerPhone && (
                              <span
                                className={`flex items-center gap-1 ${
                                  isDark ? 'text-emerald-400' : 'text-emerald-700'
                                }`}
                              >
                                <Phone className="w-2.5 h-2.5 shrink-0" />
                                <span>{vis.customerPhone}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Column 2: Current Browsing Surface */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-medium truncate max-w-[200px] block ${
                              isDark ? 'text-white/90' : 'text-[#24211D]'
                            }`}
                            title={vis.page}
                          >
                            {vis.page}
                          </span>
                        </div>
                        {vis.productSlug && (
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-mono uppercase ${
                              isDark
                                ? 'bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/20'
                                : 'bg-[#FAF8F4] text-[#9A783E] border border-[#DED7CC]'
                            }`}
                          >
                            Flacon: {vis.productSlug}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Column 3: Location & Network */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1 text-xs font-medium">
                          <MapPin className={`w-3 h-3 ${isDark ? 'text-[#D4AF37]' : 'text-[#9A783E]'}`} />
                          <span className={isDark ? 'text-white/80' : 'text-[#24211D]'}>
                            {vis.location}
                          </span>
                        </div>
                        {vis.ip && (
                          <span className={`block font-mono text-[9px] ${isDark ? 'text-white/40' : 'text-[#8C827A]'}`}>
                            IP: {vis.ip.split('.').slice(0, 3).join('.')}.*
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Column 4: Cart Status */}
                    <td className="py-3.5 px-4">
                      {hasCart ? (
                        <div
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-mono ${
                            isDark
                              ? 'bg-[#D4AF37]/15 border-[#D4AF37]/30 text-[#D4AF37]'
                              : 'bg-[#9A783E]/10 border-[#9A783E]/20 text-[#9A783E]'
                          }`}
                        >
                          <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                          <span className="font-bold">₹{vis.cartValue?.toLocaleString('en-IN')}</span>
                          <span className="text-[10px] opacity-80">({vis.cartItemsCount} item{vis.cartItemsCount !== 1 ? 's' : ''})</span>
                        </div>
                      ) : (
                        <span className={`text-[11px] font-mono ${isDark ? 'text-white/40' : 'text-[#8C827A]'}`}>
                          Cart Empty
                        </span>
                      )}
                    </td>

                    {/* Column 5: Channel & Device */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          {vis.device === 'mobile' ? (
                            <Smartphone className="w-3.5 h-3.5 text-blue-400" />
                          ) : vis.device === 'tablet' ? (
                            <Tablet className="w-3.5 h-3.5 text-purple-400" />
                          ) : (
                            <Monitor className="w-3.5 h-3.5 text-amber-400" />
                          )}
                          <span className="capitalize text-[11px] font-mono">{vis.device}</span>
                        </div>
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-mono uppercase ${
                            isDark
                              ? 'bg-white/5 border border-white/10 text-white/60'
                              : 'bg-[#FAF8F4] border border-[#DED7CC] text-[#686158]'
                          }`}
                        >
                          {vis.channel}
                        </span>
                      </div>
                    </td>

                    {/* Column 6: Active Status */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="font-mono text-[10px] text-emerald-400 font-semibold uppercase">
                            Active Now
                          </span>
                        </div>
                        <span className={`block font-mono text-[10px] ${isDark ? 'text-white/40' : 'text-[#8C827A]'}`}>
                          {timeStr}
                        </span>
                        {vis.durationSeconds && (
                          <span className={`block font-mono text-[9px] ${isDark ? 'text-white/30' : 'text-[#8C827A]'}`}>
                            {Math.floor(vis.durationSeconds / 60)}m {vis.durationSeconds % 60}s duration
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Column 7: Concierge Action */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {vis.customerPhone && (
                          <a
                            href={`https://wa.me/${vis.customerPhone.replace(/[^0-9]/g, '')}?text=Hello%20${encodeURIComponent(
                              vis.customerName || 'there'
                            )},%20Maison%20FragMore%20concierge%20here.%20We%20noticed%20you%20were%20exploring%20${encodeURIComponent(
                              vis.page
                            )}.%20May%20we%20assist%20with%20your%20olfactory%20selection?`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Chat on WhatsApp"
                            className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>
                        )}

                        <button
                          onClick={() => {
                            setAssistedPatron({
                              name: vis.customerName !== 'Anonymous Guest Patron' ? vis.customerName : undefined,
                              email: vis.customerEmail,
                              phone: vis.customerPhone,
                              address: vis.location
                            });
                            setIsAssistedModalOpen(true);
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                            isDark
                              ? 'bg-[#D4AF37] hover:bg-[#E5C378] text-black shadow-xs'
                              : 'bg-[#24211D] hover:bg-[#38332C] text-white shadow-xs'
                          }`}
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>Assist</span>
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

      {/* Assisted Order / Concierge Link Modal */}
      {isAssistedModalOpen && (
        <AssistedOrderModal
          isOpen={isAssistedModalOpen}
          onClose={() => setIsAssistedModalOpen(false)}
          preselectedCustomer={assistedPatron}
        />
      )}
    </div>
  );
};
