import React, { useState, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { FragmoreLogo } from '../common/FragmoreLogo';
import { Sparkles, ArrowRight, Shield, CheckCircle2 } from 'lucide-react';

export const LaunchModeOverlay: React.FC = () => {
  const { cms, updateCMS, showNotification } = useStore();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [bypassed, setBypassed] = useState(false);

  // Countdown timer state
  const [timeLeft, setTimeLeft] = useState({
    days: 18,
    hours: 7,
    minutes: 42,
    seconds: 15
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 };
        } else if (prev.minutes > 0) {
          return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        } else if (prev.hours > 0) {
          return { ...prev, hours: prev.hours - 1, minutes: 59, seconds: 59 };
        } else if (prev.days > 0) {
          return { ...prev, days: prev.days - 1, hours: 23, minutes: 59, seconds: 59 };
        }
        return prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!cms.launchMode || bypassed) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsSubmitted(true);
    showNotification('Privilege access reserved. You will be notified 24 hours prior to public unlock.');
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#08080A] text-[#F3EFE6] flex flex-col items-center justify-between p-6 sm:p-12 overflow-y-auto">
      {/* Background ambient lighting */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#D4AF37]/5 rounded-full blur-[140px]" />
      </div>

      {/* Top Brand Logo */}
      <div className="relative z-10 text-center pt-4">
        <FragmoreLogo size="lg" variant="gold" showTagline={true} />
      </div>

      {/* Center Countdown & Pitch */}
      <div className="relative z-10 max-w-2xl mx-auto text-center space-y-8 my-auto py-8">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 text-xs font-mono tracking-[0.35em] uppercase text-[#D4AF37]">
            <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>The Private Unveiling</span>
          </div>

          <h1 className="font-serif text-3xl sm:text-5xl md:text-6xl tracking-[0.2em] font-light text-white uppercase leading-tight">
            A New Memory<br />Is About To Begin.
          </h1>

          <p className="text-xs sm:text-sm text-[#D1CECB] font-light max-w-lg mx-auto">
            Six signature extraits and the sacred Devotional Trilogy are currently maturing in our temperature-controlled Kannauj and Grasse vaults.
          </p>
        </div>

        {/* Countdown Timer Block */}
        <div className="grid grid-cols-4 gap-3 sm:gap-6 max-w-md mx-auto font-mono">
          {[
            { val: timeLeft.days, label: 'Days' },
            { val: timeLeft.hours, label: 'Hours' },
            { val: timeLeft.minutes, label: 'Minutes' },
            { val: timeLeft.seconds, label: 'Seconds' }
          ].map((item) => (
            <div key={item.label} className="p-3 sm:p-4 bg-white/[0.03] border border-white/10 rounded-xl">
              <span className="block text-2xl sm:text-4xl font-light text-white tabular-nums">
                {String(item.val).padStart(2, '0')}
              </span>
              <span className="block text-[9px] sm:text-[10px] text-[#D4AF37] uppercase tracking-wider mt-1">
                {item.label}
              </span>
            </div>
          ))}
        </div>

        {/* VIP Early Access Form */}
        <div className="max-w-md mx-auto pt-4">
          {!isSubmitted ? (
            <form onSubmit={handleSubmit} className="space-y-3">
              <span className="text-[11px] font-mono tracking-widest text-white/60 uppercase block">
                Reserve VIP Early Access & Discovery Set Voucher:
              </span>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  required
                  placeholder="Enter your private email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 bg-[#121218] border border-white/20 rounded px-3.5 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#D4AF37]"
                />
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#D4AF37] hover:bg-[#E5C378] text-[#08080A] font-semibold text-xs tracking-wider uppercase rounded transition-colors whitespace-nowrap"
                >
                  Reserve Access
                </button>
              </div>
            </form>
          ) : (
            <div className="p-4 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-emerald-400 text-xs font-mono flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Privilege entry guaranteed. Welcome to FRAGMORÉ.</span>
            </div>
          )}
        </div>
      </div>

      {/* Admin Bypass Control (Bottom) */}
      <div className="relative z-10 pt-6 text-center text-xs font-mono space-y-2">
        <button
          onClick={() => setBypassed(true)}
          className="text-white/40 hover:text-[#D4AF37] flex items-center gap-1.5 mx-auto underline text-[11px]"
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Enter Storefront as Administrator (Preview Mode)</span>
        </button>
      </div>
    </div>
  );
};
