import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../../context/StoreContext';
import {
  Bell,
  Send,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  Activity
} from 'lucide-react';

export const AdminNotifications: React.FC = () => {
  const { customers, showNotification, addAuditLog } = useStore();
  const [broadcastChannel, setBroadcastChannel] = useState<'WHATSAPP' | 'EMAIL' | 'SMS'>('WHATSAPP');
  const [targetAudience, setTargetAudience] = useState<'ALL' | 'VIP' | 'DISCOVERY' | 'REPEAT'>('ALL');
  const [messageTitle, setMessageTitle] = useState('Exclusive Private Allocation: Mysore Sandalwood Trilogy');
  const [messageBody, setMessageBody] = useState(
    'FRAGMORÉ Concierge: Dear Connoisseur, a limited batch of our revered Devotional Trilogy flacons has completed 90-day cold maceration. Reserve your numbered flacon with complimentary express delivery.'
  );
  const [sending, setSending] = useState(false);
  const [lastBroadcastResult, setLastBroadcastResult] = useState<any>(null);
  const [opsAlerts, setOpsAlerts] = useState<any[]>([]);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(false);

  const [templates] = useState([
    {
      id: 'tpl-1',
      name: 'Order Confirmation & Dispatch (WhatsApp)',
      channel: 'WHATSAPP',
      content:
        'FRAGMORÉ: Dear {{customer_name}}, your artisanal flacon {{product_name}} has been sealed and dispatched via Blue Dart AWB {{awb_number}}. Track: {{tracking_url}}',
      status: 'APPROVED'
    },
    {
      id: 'tpl-2',
      name: 'Abandoned Cart Concierge Reminder',
      channel: 'WHATSAPP',
      content:
        'FRAGMORÉ Concierge: Your curated flacon bag is reserved at our atelier. Complete your bespoke order before allocation expires: {{checkout_url}}',
      status: 'APPROVED'
    },
    {
      id: 'tpl-3',
      name: 'Discovery Coffret Voucher Redemption Reminder',
      channel: 'EMAIL',
      content:
        'Your customer-specific Discovery Six voucher is active toward eligible 50ml or 100ml full-bottle creations. Redeem your voucher before expiration.',
      status: 'APPROVED'
    },
    {
      id: 'tpl-4',
      name: 'Blue Dart Delivery OTP & Dispatch Notice',
      channel: 'SMS',
      content:
        'FRAGMORÉ: Your luxury parcel {{awb_number}} is out for delivery today. Verification code: {{otp}}.',
      status: 'APPROVED'
    }
  ]);

  const fetchNotificationFeed = useCallback(async () => {
    setLoadingFeed(true);
    try {
      const res = await fetch('/api/notifications/feed');
      if (res.ok) {
        const json = await res.json();
        setOpsAlerts(Array.isArray(json.opsAlerts) ? json.opsAlerts : []);
        setRecentEvents(Array.isArray(json.recentDispatchEvents) ? json.recentDispatchEvents : []);
      }
    } catch {
      // ignore non-fatal error
    } finally {
      setLoadingFeed(false);
    }
  }, []);

  useEffect(() => {
    fetchNotificationFeed();
  }, [fetchNotificationFeed]);

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const res = await fetch('/api/notifications/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: broadcastChannel,
          targetAudience,
          title: messageTitle,
          messageBody
        })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setLastBroadcastResult(json);
        addAuditLog(
          'NOTIFICATION_BROADCAST',
          'Notifications',
          `Queued ${broadcastChannel} broadcast "${messageTitle}" to ${json.eligibleRecipientsCount} consented recipients (${json.suppressedOptOutCount} suppressed by consent guard)`
        );
        showNotification(
          `Broadcast recorded in PostgreSQL: ${json.eligibleRecipientsCount} consented recipients (${json.dispatchMode}).`
        );
        fetchNotificationFeed();
      } else {
        showNotification(json.error || 'Failed to queue broadcast.');
      }
    } catch {
      showNotification('Network error while queuing broadcast.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-mono text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-white/10 gap-4">
        <div>
          <h2 className="font-serif text-2xl uppercase tracking-wider text-white">
            Clientele Notifications, Consent-Gated Broadcasts &amp; Ops Alerts
          </h2>
          <p className="text-xs text-white/50">
            Persistent omnichannel dispatch templates, consent-filtered customer broadcasts, and real-time operational alerts from PostgreSQL.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchNotificationFeed}
          className="px-3.5 py-2 bg-white/10 hover:bg-white/15 text-white rounded-lg flex items-center gap-1.5 cursor-pointer self-start"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#D4AF37] ${loadingFeed ? 'animate-spin' : ''}`} />
          Refresh Live Feed
        </button>
      </div>

      {/* Broadcast Dispatcher */}
      <div className="p-6 bg-[#121218] border border-[#D4AF37]/30 rounded-xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-[#D4AF37]" />
            <div>
              <h3 className="font-serif text-base uppercase tracking-wider text-white">
                Consent-Enforced Concierge Broadcast Dispatcher
              </h3>
              <span className="text-[11px] text-white/50">
                Automatically filters target segment by verified channel opt-in consent and logs durable event in PostgreSQL.
              </span>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-emerald-400 text-[11px]">
            <ShieldCheck className="w-4 h-4" /> Consent Filter Active
          </div>
        </div>

        <form onSubmit={handleSendBroadcast} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-white/60 mb-1">Dispatch Channel</label>
              <select
                value={broadcastChannel}
                onChange={(e: any) => setBroadcastChannel(e.target.value)}
                className="w-full bg-[#161620] border border-white/20 text-white rounded-lg px-3 py-2 focus:outline-none"
              >
                <option value="WHATSAPP">WhatsApp Official Business API (Meta)</option>
                <option value="EMAIL">SendGrid High-Deliverability Email</option>
                <option value="SMS">Msg91 Transactional DLT SMS</option>
              </select>
            </div>

            <div>
              <label className="block text-white/60 mb-1">Target Segment</label>
              <select
                value={targetAudience}
                onChange={(e: any) => setTargetAudience(e.target.value)}
                className="w-full bg-[#161620] border border-white/20 text-white rounded-lg px-3 py-2 focus:outline-none"
              >
                <option value="ALL">All Registered Connoisseurs ({customers.length})</option>
                <option value="VIP">VIP Connoisseurs Only (Net Spend ≥ ₹5,000)</option>
                <option value="DISCOVERY">Discovery Set Buyers (Upgrade Nudge)</option>
                <option value="REPEAT">Repeat Buyers (Early Access)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-white/60 mb-1">Broadcast Headline / Subject</label>
            <input
              type="text"
              value={messageTitle}
              onChange={(e) => setMessageTitle(e.target.value)}
              className="w-full bg-[#161620] border border-white/20 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-[#D4AF37]"
            />
          </div>

          <div>
            <label className="block text-white/60 mb-1">Message Content</label>
            <textarea
              rows={3}
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              className="w-full bg-[#161620] border border-white/20 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-[#D4AF37]"
            />
          </div>

          {lastBroadcastResult && (
            <div className="p-3.5 bg-[#161C18] border border-emerald-500/30 rounded-lg text-xs text-white/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <strong className="text-emerald-400">Event #{lastBroadcastResult.eventId}:</strong>{' '}
                Matched {lastBroadcastResult.totalSegmentMatches} in segment ·{' '}
                <strong className="text-white">{lastBroadcastResult.eligibleRecipientsCount} Consented</strong> ·{' '}
                <span className="text-amber-400">{lastBroadcastResult.suppressedOptOutCount} Suppressed (Opt-Out)</span>
              </div>
              <span className="text-[11px] text-[#D4AF37] uppercase">{lastBroadcastResult.dispatchMode}</span>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={sending}
              className="px-5 py-2.5 bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] font-bold rounded-lg uppercase tracking-wider text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {sending ? 'Verifying Consent & Queuing...' : 'Transmit Consent-Verified Broadcast'}
            </button>
          </div>
        </form>
      </div>

      {/* Live Operational Alerts & Dispatch Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#121218] border border-white/10 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="font-serif text-base uppercase tracking-wider text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#D4AF37]" />
              Active Operational &amp; Low-Stock Alerts ({opsAlerts.length})
            </h3>
            <span className="text-[10px] text-white/40">ops_tasks_and_alerts</span>
          </div>

          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {opsAlerts.length === 0 ? (
              <div className="text-white/40 py-6 text-center">No open operational alerts.</div>
            ) : (
              opsAlerts.map((alert: any) => (
                <div key={alert.id} className="p-3.5 bg-white/[0.02] border border-white/10 rounded-lg space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-white font-semibold">{alert.title}</span>
                    <span className="text-[10px] text-[#D4AF37] uppercase">
                      {alert.category} · {alert.severity}
                    </span>
                  </div>
                  <p className="text-white/60 text-[11px]">{alert.description}</p>
                  <div className="text-[10px] text-white/40">
                    Assigned: {alert.assignedRole} · Status: {alert.status}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-[#121218] border border-white/10 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="font-serif text-base uppercase tracking-wider text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              Recent Notification &amp; Lifecycle Events ({recentEvents.length})
            </h3>
            <span className="text-[10px] text-white/40">automation_events</span>
          </div>

          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {recentEvents.length === 0 ? (
              <div className="text-white/40 py-6 text-center">No recent notification events.</div>
            ) : (
              recentEvents.map((evt: any) => (
                <div key={evt.id} className="p-3.5 bg-white/[0.02] border border-white/10 rounded-lg space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sky-400 font-semibold">{evt.eventType}</span>
                    <span className="text-emerald-400 text-[10px]">{evt.status}</span>
                  </div>
                  <div className="text-white/70 text-[11px]">
                    Recipient/Entity: {evt.customerEmail || evt.entityId || 'Segment Broadcast'}
                  </div>
                  <div className="text-[10px] text-white/40">
                    Event ID: {evt.id} · Source: {evt.source}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Approved Templates Table */}
      <div className="bg-[#121218] border border-white/10 rounded-xl overflow-x-auto p-5 space-y-4">
        <h3 className="font-serif text-base uppercase tracking-wider text-white border-b border-white/10 pb-3">
          Automated Lifecycle Templates (Meta &amp; DLT Registered)
        </h3>

        <div className="space-y-3">
          {templates.map((tpl) => (
            <div key={tpl.id} className="p-4 bg-white/[0.02] border border-white/5 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[#D4AF37] font-bold text-[10px]">{tpl.channel}</span>
                  <span aria-hidden="true" className="text-white/30">·</span>
                  <strong className="text-white font-medium">{tpl.name}</strong>
                </div>
                <span className="flex items-center gap-1 text-emerald-400 text-[10px] font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {tpl.status}
                </span>
              </div>
              <p className="text-white/70 text-xs bg-black/40 p-2.5 rounded border border-white/5 font-mono">
                {tpl.content}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
