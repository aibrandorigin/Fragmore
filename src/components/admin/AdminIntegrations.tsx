import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { IntegrationConfig } from '../../types';
import {
  Link2,
  CheckCircle2,
  Eye,
  EyeOff,
  Save,
  Activity,
  Zap,
  Shield,
  Smartphone,
  Mail,
  CreditCard,
  Truck,
  Globe,
  RefreshCw,
  Lock
} from 'lucide-react';

export const AdminIntegrations: React.FC = () => {
  const { integrations, updateIntegrations, testIntegration, showNotification } = useStore();

  const [form, setForm] = useState<IntegrationConfig>(integrations);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [testingService, setTestingService] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, string>>({});

  const toggleShowSecret = (fieldKey: string) => {
    setShowSecrets((prev) => ({ ...prev, [fieldKey]: !prev[fieldKey] }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateIntegrations(form);
    showNotification('Integration configurations successfully updated and secured.');
  };

  const handleTest = async (service: keyof IntegrationConfig) => {
    setTestingService(service);
    try {
      const result = await testIntegration(service);
      setTestResults((prev) => ({
        ...prev,
        [service]: `${result.message} (${new Date().toLocaleTimeString()})`
      }));
      showNotification(`${service.toUpperCase()} connection verified successfully!`);
    } catch {
      showNotification(`Failed to verify ${service}.`);
    } finally {
      setTestingService(null);
    }
  };

  // Helper to mask secret strings when not toggled
  const renderSecretInput = (
    fieldKey: string,
    value: string,
    onChange: (val: string) => void,
    placeholder: string = 'Enter secret...'
  ) => {
    const isVisible = !!showSecrets[fieldKey];
    return (
      <div className="relative flex items-center">
        <input
          type={isVisible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-[#161622] border border-white/20 text-white rounded-lg px-3 py-2 pr-10 focus:outline-none focus:border-[#D4AF37] font-mono text-xs"
        />
        <button
          type="button"
          onClick={() => toggleShowSecret(fieldKey)}
          className="absolute right-3 text-white/40 hover:text-white"
          title={isVisible ? 'Hide secret' : 'Reveal secret'}
        >
          {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-mono text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-white/10 gap-4">
        <div>
          <h2 className="font-serif text-2xl uppercase tracking-wider text-white">
            Enterprise Integrations & API Vault
          </h2>
          <p className="text-xs text-white/50">
            Configure third-party gateways, advertising pixels, cloud messaging, and logistics APIs with masked security.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-bold">
            <Lock className="w-3.5 h-3.5" /> Client Secret Masking Active
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        
        {/* 1. META (Pixel & Conversions API) */}
        <div className="p-6 bg-[#121218] border border-white/10 rounded-xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <Globe className="w-4 h-4 text-sky-400" />
              <h3 className="font-serif text-base uppercase tracking-wider text-white">
                META (Facebook & Instagram)
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                {form.meta.status}
              </span>
              <button
                type="button"
                onClick={() => handleTest('meta')}
                disabled={testingService === 'meta'}
                className="px-3 py-1 bg-white/10 hover:bg-white/15 text-white rounded text-[10px] font-bold flex items-center gap-1"
              >
                {testingService === 'meta' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3 text-[#D4AF37]" />}
                Test Connection
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-white/60 mb-1">Meta Pixel ID</label>
              <input
                type="text"
                value={form.meta.pixelId}
                onChange={(e) => setForm({ ...form, meta: { ...form.meta, pixelId: e.target.value } })}
                className="w-full bg-[#161622] border border-white/20 text-white rounded-lg px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-white/60 mb-1">Conversions API (CAPI) Token</label>
              {renderSecretInput('metaToken', form.meta.conversionsApiToken, (val) =>
                setForm({ ...form, meta: { ...form.meta, conversionsApiToken: val } })
              )}
            </div>

            <div>
              <label className="block text-white/60 mb-1">Test Event Code</label>
              <input
                type="text"
                value={form.meta.testEventCode}
                onChange={(e) => setForm({ ...form, meta: { ...form.meta, testEventCode: e.target.value } })}
                className="w-full bg-[#161622] border border-white/20 text-white rounded-lg px-3 py-2 text-xs"
              />
            </div>
          </div>

          {testResults['meta'] && (
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded text-emerald-400 text-[11px]">
              ✓ {testResults['meta']}
            </div>
          )}
        </div>

        {/* 2. GOOGLE (GA4, GTM, Ads, Merchant Center) */}
        <div className="p-6 bg-[#121218] border border-white/10 rounded-xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <Activity className="w-4 h-4 text-emerald-400" />
              <h3 className="font-serif text-base uppercase tracking-wider text-white">
                GOOGLE ECOSYSTEM (GA4, GTM, ADS)
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                {form.google.status}
              </span>
              <button
                type="button"
                onClick={() => handleTest('google')}
                disabled={testingService === 'google'}
                className="px-3 py-1 bg-white/10 hover:bg-white/15 text-white rounded text-[10px] font-bold flex items-center gap-1"
              >
                {testingService === 'google' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3 text-[#D4AF37]" />}
                Test Connection
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-white/60 mb-1">GA4 Measurement ID</label>
              <input
                type="text"
                value={form.google.ga4MeasurementId}
                onChange={(e) => setForm({ ...form, google: { ...form.google, ga4MeasurementId: e.target.value } })}
                className="w-full bg-[#161622] border border-white/20 text-white rounded-lg px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-white/60 mb-1">GTM Container ID</label>
              <input
                type="text"
                value={form.google.gtmId}
                onChange={(e) => setForm({ ...form, google: { ...form.google, gtmId: e.target.value } })}
                className="w-full bg-[#161622] border border-white/20 text-white rounded-lg px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-white/60 mb-1">Google Ads ID</label>
              <input
                type="text"
                value={form.google.googleAdsId}
                onChange={(e) => setForm({ ...form, google: { ...form.google, googleAdsId: e.target.value } })}
                className="w-full bg-[#161622] border border-white/20 text-white rounded-lg px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-white/60 mb-1">Google Merchant Center ID</label>
              <input
                type="text"
                value={form.google.merchantCenterId}
                onChange={(e) => setForm({ ...form, google: { ...form.google, merchantCenterId: e.target.value } })}
                className="w-full bg-[#161622] border border-white/20 text-white rounded-lg px-3 py-2 text-xs"
              />
            </div>
          </div>

          {testResults['google'] && (
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded text-emerald-400 text-[11px]">
              ✓ {testResults['google']}
            </div>
          )}
        </div>

        {/* 3. WHATSAPP BUSINESS API */}
        <div className="p-6 bg-[#121218] border border-white/10 rounded-xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <Smartphone className="w-4 h-4 text-emerald-400" />
              <h3 className="font-serif text-base uppercase tracking-wider text-white">
                WHATSAPP BUSINESS CONCIERGE API
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                {form.whatsapp.status}
              </span>
              <button
                type="button"
                onClick={() => handleTest('whatsapp')}
                disabled={testingService === 'whatsapp'}
                className="px-3 py-1 bg-white/10 hover:bg-white/15 text-white rounded text-[10px] font-bold flex items-center gap-1"
              >
                {testingService === 'whatsapp' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3 text-[#D4AF37]" />}
                Test Connection
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-white/60 mb-1">API Provider</label>
              <select
                value={form.whatsapp.provider}
                onChange={(e: any) => setForm({ ...form, whatsapp: { ...form.whatsapp, provider: e.target.value } })}
                className="w-full bg-[#161622] border border-white/20 text-white rounded-lg px-3 py-2 text-xs"
              >
                <option value="Meta Cloud API">Meta Official Cloud API</option>
                <option value="Interakt">Interakt Official Jio Platform</option>
                <option value="Wati">WATI Enterprise</option>
                <option value="Gupshup">Gupshup</option>
              </select>
            </div>

            <div>
              <label className="block text-white/60 mb-1">WhatsApp API Key / Secret</label>
              {renderSecretInput('whatsappKey', form.whatsapp.apiKey, (val) =>
                setForm({ ...form, whatsapp: { ...form.whatsapp, apiKey: val } })
              )}
            </div>

            <div>
              <label className="block text-white/60 mb-1">Phone Number ID</label>
              <input
                type="text"
                value={form.whatsapp.phoneNumberId}
                onChange={(e) => setForm({ ...form, whatsapp: { ...form.whatsapp, phoneNumberId: e.target.value } })}
                className="w-full bg-[#161622] border border-white/20 text-white rounded-lg px-3 py-2 text-xs"
              />
            </div>
          </div>

          {testResults['whatsapp'] && (
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded text-emerald-400 text-[11px]">
              ✓ {testResults['whatsapp']}
            </div>
          )}
        </div>

        {/* 4. SMS & EMAIL PROVIDERS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* SMS */}
          <div className="p-6 bg-[#121218] border border-white/10 rounded-xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-serif text-base uppercase tracking-wider text-white">
                SMS DLT GATEWAY
              </h3>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                {form.sms.status}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-white/60 mb-1">SMS Provider</label>
                <select
                  value={form.sms.provider}
                  onChange={(e: any) => setForm({ ...form, sms: { ...form.sms, provider: e.target.value } })}
                  className="w-full bg-[#161622] border border-white/20 text-white rounded-lg px-3 py-2 text-xs"
                >
                  <option value="Msg91">Msg91 (India DLT Compliant)</option>
                  <option value="Fast2SMS">Fast2SMS</option>
                  <option value="Twilio">Twilio</option>
                </select>
              </div>

              <div>
                <label className="block text-white/60 mb-1">SMS API Auth Token</label>
                {renderSecretInput('smsKey', form.sms.apiKey, (val) =>
                  setForm({ ...form, sms: { ...form.sms, apiKey: val } })
                )}
              </div>

              <div>
                <label className="block text-white/60 mb-1">Header Sender ID (6-char DLT)</label>
                <input
                  type="text"
                  value={form.sms.senderId}
                  onChange={(e) => setForm({ ...form, sms: { ...form.sms, senderId: e.target.value } })}
                  className="w-full bg-[#161622] border border-white/20 text-white rounded-lg px-3 py-2 text-xs"
                />
              </div>
            </div>
          </div>

          {/* EMAIL */}
          <div className="p-6 bg-[#121218] border border-white/10 rounded-xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-serif text-base uppercase tracking-wider text-white">
                EMAIL DISPATCH (SMTP / API)
              </h3>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                {form.email.status}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-white/60 mb-1">Email Provider</label>
                <select
                  value={form.email.provider}
                  onChange={(e: any) => setForm({ ...form, email: { ...form.email, provider: e.target.value } })}
                  className="w-full bg-[#161622] border border-white/20 text-white rounded-lg px-3 py-2 text-xs"
                >
                  <option value="SendGrid">SendGrid (Twilio)</option>
                  <option value="Postmark">Postmark</option>
                  <option value="Amazon SES">Amazon SES</option>
                  <option value="Custom SMTP">Custom Luxury SMTP</option>
                </select>
              </div>

              <div>
                <label className="block text-white/60 mb-1">API Key / SMTP Password</label>
                {renderSecretInput('emailKey', form.email.apiKey, (val) =>
                  setForm({ ...form, email: { ...form.email, apiKey: val } })
                )}
              </div>

              <div>
                <label className="block text-white/60 mb-1">From Email Address</label>
                <input
                  type="email"
                  value={form.email.fromEmail}
                  onChange={(e) => setForm({ ...form, email: { ...form.email, fromEmail: e.target.value } })}
                  className="w-full bg-[#161622] border border-white/20 text-white rounded-lg px-3 py-2 text-xs"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 5. PAYMENT & SHIPPING GATEWAYS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* PAYMENT */}
          <div className="p-6 bg-[#121218] border border-white/10 rounded-xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-serif text-base uppercase tracking-wider text-white">
                PAYMENT GATEWAY (RAZORPAY)
              </h3>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                {form.payment.status}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-white/60 mb-1">Gateway Provider</label>
                <select
                  value={form.payment.gateway}
                  onChange={(e: any) => setForm({ ...form, payment: { ...form.payment, gateway: e.target.value } })}
                  className="w-full bg-[#161622] border border-white/20 text-white rounded-lg px-3 py-2 text-xs"
                >
                  <option value="Razorpay">Razorpay (Cards, UPI, Netbanking)</option>
                  <option value="Cashfree">Cashfree Payments</option>
                  <option value="PhonePe">PhonePe Payment Gateway</option>
                </select>
              </div>

              <div>
                <label className="block text-white/60 mb-1">Key ID</label>
                <input
                  type="text"
                  value={form.payment.keyId}
                  onChange={(e) => setForm({ ...form, payment: { ...form.payment, keyId: e.target.value } })}
                  className="w-full bg-[#161622] border border-white/20 text-white rounded-lg px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-white/60 mb-1">Key Secret</label>
                {renderSecretInput('paymentSecret', form.payment.keySecret, (val) =>
                  setForm({ ...form, payment: { ...form.payment, keySecret: val } })
                )}
              </div>
            </div>
          </div>

          {/* SHIPPING */}
          <div className="p-6 bg-[#121218] border border-white/10 rounded-xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-serif text-base uppercase tracking-wider text-white">
                SHIPPING & 3PL FULFILLMENT
              </h3>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                {form.shipping.status}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-white/60 mb-1">Logistics Aggregator</label>
                <select
                  value={form.shipping.provider}
                  onChange={(e: any) => setForm({ ...form, shipping: { ...form.shipping, provider: e.target.value } })}
                  className="w-full bg-[#161622] border border-white/20 text-white rounded-lg px-3 py-2 text-xs"
                >
                  <option value="Shiprocket">Shiprocket Prime</option>
                  <option value="Delhivery">Delhivery Direct Express</option>
                  <option value="Blue Dart">Blue Dart Direct Apex</option>
                </select>
              </div>

              <div>
                <label className="block text-white/60 mb-1">Logistics API Token</label>
                {renderSecretInput('shippingKey', form.shipping.apiKey, (val) =>
                  setForm({ ...form, shipping: { ...form.shipping, apiKey: val } })
                )}
              </div>

              <div>
                <label className="block text-white/60 mb-1">Warehouse Origin Pincode</label>
                <input
                  type="text"
                  value={form.shipping.warehousePincode}
                  onChange={(e) => setForm({ ...form, shipping: { ...form.shipping, warehousePincode: e.target.value } })}
                  className="w-full bg-[#161622] border border-white/20 text-white rounded-lg px-3 py-2 text-xs"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Save Bar */}
        <div className="sticky bottom-4 z-20 p-4 bg-[#0A0A0E]/95 border border-white/15 rounded-xl backdrop-blur-md flex items-center justify-between shadow-2xl">
          <span className="text-[11px] text-white/60">
            Secrets are encrypted and persistently retained in the local database.
          </span>
          <button
            type="submit"
            className="px-6 py-2.5 bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] font-bold rounded-lg uppercase tracking-wider text-xs flex items-center gap-2"
          >
            <Save className="w-4 h-4" /> Save Integration Vault
          </button>
        </div>
      </form>
    </div>
  );
};
