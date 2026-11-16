import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { X, Sparkles } from 'lucide-react';

export const AnnouncementBar: React.FC = () => {
  const { cms, cart, currentView } = useStore();
  const [dismissed, setDismissed] = useState(false);

  if (currentView === 'admin' || dismissed || !cms.announcementBarActive) return null;

  const remainingForFreeShipping = Math.max(0, cms.freeShippingThreshold - cart.subtotal);

  return (
    <div className="bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)] text-[var(--text-main)] text-[11px] sm:text-xs tracking-wider py-2 px-3 sm:px-4 transition-colors duration-300 w-full max-w-full overflow-hidden box-border">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 min-w-0 w-full">
        <div className="flex-1 text-center font-medium min-w-0 flex items-center justify-center gap-1.5 sm:gap-2">
          <Sparkles className="w-3.5 h-3.5 text-[var(--accent-gold)] shrink-0" />
          {cart.items.length > 0 && remainingForFreeShipping > 0 ? (
            <span className="truncate text-[10px] sm:text-xs text-[var(--text-secondary)]">
              You are only{' '}
              <strong className="text-[var(--text-main)]">
                ₹{remainingForFreeShipping.toLocaleString('en-IN')}
              </strong>{' '}
              away from complimentary express insured delivery
            </span>
          ) : (
            <span className="truncate text-[10px] sm:text-xs text-[var(--text-main)]">
              {cms.announcementBarText}
            </span>
          )}
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-[var(--text-secondary)] hover:text-[var(--text-main)] p-1 shrink-0 cursor-pointer"
          aria-label="Dismiss announcement"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
