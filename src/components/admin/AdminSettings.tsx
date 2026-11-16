import React, { useState, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import {
  Save,
  Download,
  User,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  Database,
  FileSpreadsheet
} from 'lucide-react';
import { downloadCompleteDatabaseBackup } from '../../lib/erpApi';

export const AdminSettings: React.FC = () => {
  const {
    cms,
    updateCMS,
    showNotification,
    orders,
    products,
    customers,
    customer,
    updateCustomerProfile,
    changePassword
  } = useStore();

  const [legalName, setLegalName] = useState('FRAGMORÉ PRIVATE LIMITED');
  const [brandName, setBrandName] = useState('FRAGMORÉ');
  const [tagline, setTagline] = useState('Scent That Stays With You.');
  const [gstNumber, setGstNumber] = useState(cms.gstNumber || '27AABCF1234M1Z8');
  const [hqAddress, setHqAddress] = useState(
    cms.headquarters || 'Worli Sea Face, Mumbai 400018, Maharashtra, India'
  );
  const [contactEmail, setContactEmail] = useState(cms.contactEmail || 'concierge@fragmore.com');
  const [contactPhone, setContactPhone] = useState(cms.contactPhone || '+91 (022) 6912 8800');
  const [currency] = useState('INR (₹)');
  const [gstRate, setGstRate] = useState(18);
  const [orderPrefix, setOrderPrefix] = useState('FRG-2026-');

  // Admin Personal Profile & Password State
  const [adminName, setAdminName] = useState(customer?.name || 'Brand Origin Admin');
  const [adminEmail, setAdminEmail] = useState(customer?.email || 'aibrandorigin@gmail.com');
  const [adminPhone, setAdminPhone] = useState(customer?.phone || '+91 99999 88888');
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [exportingDbFormat, setExportingDbFormat] = useState<'json' | 'xlsx' | null>(null);
  const [pwdStatus, setPwdStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  useEffect(() => {
    if (customer) {
      setAdminName(customer.name || '');
      setAdminEmail(customer.email || '');
      setAdminPhone(customer.phone || '');
    }
  }, [customer]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateCMS({
      gstNumber,
      headquarters: hqAddress,
      contactEmail,
      contactPhone,
      logoText: brandName
    });
    showNotification('System & Brand settings successfully saved to database.');
  };

  const handleSaveAdminProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateCustomerProfile({
      name: adminName.trim(),
      email: adminEmail.trim(),
      phone: adminPhone.trim()
    });
  };

  const handleChangeAdminPassword = async (e: React.FormEvent) => {
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
    const res = await changePassword(currentPwd, newPwd);
    if (res.success) {
      setPwdStatus({ type: 'success', text: res.message });
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
    } else {
      setPwdStatus({ type: 'error', text: res.message });
    }
  };

  const handleExportCompleteDatabase = async (format: 'json' | 'xlsx') => {
    setExportingDbFormat(format);
    try {
      const res = await downloadCompleteDatabaseBackup(format);
      showNotification(
        `Complete database downloaded: ${res.fileName} (${res.totalDocuments.toLocaleString('en-IN')} records across ${res.populatedCollections} collections · ${(res.sizeBytes / 1024).toFixed(1)} KB).`
      );
    } catch (err: any) {
      showNotification(err?.message || `Failed to export complete database (${format.toUpperCase()}).`);
    } finally {
      setExportingDbFormat(null);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto font-mono text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-white/10 gap-4">
        <div>
          <h2 className="font-serif text-2xl uppercase tracking-wider text-white">
            Admin Profile, Security &amp; Commerce Settings
          </h2>
          <p className="text-xs text-white/50">
            Edit your Administrator profile details, change your password, and configure legal and GST settings.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleExportCompleteDatabase('json')}
            disabled={exportingDbFormat !== null}
            className="px-4 py-2 bg-white/10 hover:bg-white/15 disabled:opacity-50 text-white rounded flex items-center gap-1.5 cursor-pointer"
          >
            <Database className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>{exportingDbFormat === 'json' ? 'Exporting JSON...' : 'Download Complete DB (JSON)'}</span>
          </button>
          <button
            onClick={() => handleExportCompleteDatabase('xlsx')}
            disabled={exportingDbFormat !== null}
            className="px-4 py-2 bg-[#D4AF37] hover:bg-[#E5C378] disabled:opacity-50 text-[#08080A] font-semibold rounded flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{exportingDbFormat === 'xlsx' ? 'Exporting XLSX...' : 'Download Complete DB (.XLSX)'}</span>
          </button>
        </div>
      </div>

      {/* ADMIN PERSONAL PROFILE & PASSWORD SECURITY */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Edit Admin Profile Details */}
        <form
          onSubmit={handleSaveAdminProfile}
          className="p-6 bg-[#121218] border border-white/10 rounded-xl space-y-4 flex flex-col justify-between"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h3 className="font-serif text-base uppercase tracking-wider text-white">
                Edit Admin Profile Details
              </h3>
              <User className="w-4 h-4 text-[#D4AF37]" />
            </div>

            <div>
              <label className="block text-white/60 mb-1">Admin Full Name *</label>
              <input
                type="text"
                required
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                className="w-full bg-[#161622] border border-white/20 text-white rounded-lg px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-white/60 mb-1">Admin Email Address *</label>
              <input
                type="email"
                required
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full bg-[#161622] border border-white/20 text-white rounded-lg px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-white/60 mb-1">Admin Phone / WhatsApp</label>
              <input
                type="tel"
                value={adminPhone}
                onChange={(e) => setAdminPhone(e.target.value)}
                className="w-full bg-[#161622] border border-white/20 text-white rounded-lg px-3 py-2"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] font-bold rounded-lg uppercase tracking-wider text-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" /> Save Admin Profile Details
          </button>
        </form>

        {/* Change Admin Password */}
        <form
          onSubmit={handleChangeAdminPassword}
          className="p-6 bg-[#121218] border border-white/10 rounded-xl space-y-4 flex flex-col justify-between"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h3 className="font-serif text-base uppercase tracking-wider text-white">
                Change Admin Password
              </h3>
              <Lock className="w-4 h-4 text-[#D4AF37]" />
            </div>

            {pwdStatus && (
              <div
                className={`p-2.5 rounded-lg text-[11px] flex items-center gap-2 ${
                  pwdStatus.type === 'success'
                    ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-700'
                    : 'bg-rose-500/15 border border-rose-500/30 text-rose-700'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{pwdStatus.text}</span>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-white/60">Current Password</label>
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
                placeholder="Enter current password"
                className="w-full bg-[#161622] border border-white/20 text-white rounded-lg px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-white/60 mb-1">New Password *</label>
              <input
                type={showPwd ? 'text' : 'password'}
                required
                minLength={6}
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                placeholder="Minimum 6 characters"
                className="w-full bg-[#161622] border border-white/20 text-white rounded-lg px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-white/60 mb-1">Confirm New Password *</label>
              <input
                type={showPwd ? 'text' : 'password'}
                required
                minLength={6}
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full bg-[#161622] border border-white/20 text-white rounded-lg px-3 py-2"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] font-bold rounded-lg uppercase tracking-wider text-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" /> Update Admin Password
          </button>
        </form>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Brand & Legal Disclosures */}
        <div className="p-6 bg-[#121218] border border-white/10 rounded-xl space-y-4">
          <h3 className="font-serif text-base uppercase tracking-wider text-white border-b border-white/10 pb-2">
            Brand Identity &amp; Legal Disclosures
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-white/60 mb-1">Brand Wordmark</label>
              <input
                type="text"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                className="w-full bg-[#161622] border border-white/20 text-white rounded-lg px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-white/60 mb-1">Official Brand Sub-line</label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                className="w-full bg-[#161622] border border-white/20 text-white rounded-lg px-3 py-2"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-white/60 mb-1">Registered Legal Entity Name</label>
              <input
                type="text"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                className="w-full bg-[#161622] border border-white/20 text-white rounded-lg px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-white/60 mb-1">Goods &amp; Services Tax ID (GSTIN)</label>
              <input
                type="text"
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value)}
                className="w-full bg-[#161622] border border-white/20 text-white rounded-lg px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-white/60 mb-1">Invoice Order Prefix</label>
              <input
                type="text"
                value={orderPrefix}
                onChange={(e) => setOrderPrefix(e.target.value)}
                className="w-full bg-[#161622] border border-white/20 text-white rounded-lg px-3 py-2"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-white/60 mb-1">Atelier Headquarters Address</label>
              <input
                type="text"
                value={hqAddress}
                onChange={(e) => setHqAddress(e.target.value)}
                className="w-full bg-[#161622] border border-white/20 text-white rounded-lg px-3 py-2"
              />
            </div>
          </div>
        </div>

        {/* Contact & Concierge Information */}
        <div className="p-6 bg-[#121218] border border-white/10 rounded-xl space-y-4">
          <h3 className="font-serif text-base uppercase tracking-wider text-white border-b border-white/10 pb-2">
            Client Concierge &amp; Direct Contact Channels
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-white/60 mb-1">Concierge Email</label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="w-full bg-[#161622] border border-white/20 text-white rounded-lg px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-white/60 mb-1">Concierge Phone / WhatsApp</label>
              <input
                type="text"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="w-full bg-[#161622] border border-white/20 text-white rounded-lg px-3 py-2"
              />
            </div>
          </div>
        </div>

        {/* Fiscal & Tax Rules */}
        <div className="p-6 bg-[#121218] border border-white/10 rounded-xl space-y-4">
          <h3 className="font-serif text-base uppercase tracking-wider text-white border-b border-white/10 pb-2">
            Fiscal &amp; Tax Configuration (Indian GST)
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-white/60 mb-1">Default Commerce Currency</label>
              <input
                type="text"
                value={currency}
                disabled
                className="w-full bg-white/5 border border-white/10 text-white/50 rounded-lg px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-white/60 mb-1">GST Tax Rate on Fragrances (%)</label>
              <input
                type="number"
                value={gstRate}
                onChange={(e) => setGstRate(Number(e.target.value))}
                className="w-full bg-[#161622] border border-white/20 text-white rounded-lg px-3 py-2"
              />
            </div>
          </div>

          <div className="p-3 bg-white/[0.02] border border-white/5 rounded text-[11px] text-white/60">
            For intra-state shipments (Maharashtra to Maharashtra), tax splits into CGST 9% + SGST 9%. For inter-state shipments, IGST 18% is applied automatically on all official invoices.
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-6 py-2.5 bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] font-bold rounded-lg uppercase tracking-wider text-xs flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" /> Save General Settings
          </button>
        </div>
      </form>
    </div>
  );
};
