import React, { useState, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import {
  Save,
  Globe,
  Megaphone,
  Calendar,
  Share2,
  Eye,
  Check,
  AlertCircle,
  Loader2
} from 'lucide-react';

interface AdminCMSProps {
  initialSubTab?: string;
}

export const AdminCMS: React.FC<AdminCMSProps> = () => {
  const { cms, updateCMS, setCurrentView } = useStore();
  const [formState, setFormState] = useState(cms);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setFormState(cms);
  }, [cms]);

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(null);
    setSaveError(null);

    setIsSaving(true);
    try {
      await updateCMS({
        ...formState
      });
      setSaveSuccess(
        'Saved to database. Storefront cache invalidated and synchronized across browsers.'
      );
      setTimeout(() => setSaveSuccess(null), 5000);
    } catch (err: any) {
      setSaveError(
        err?.message || 'Failed to save changes to database. Verify Admin authorization.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSaveAll} className="space-y-6">
      {/* Header & Save Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#FFFFFF] border border-[#DED7CC] rounded-2xl p-5 shadow-2xs">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-[#9A783E] mb-1 font-semibold">
            Admin → Content → Homepage &amp; Storefront Settings
          </div>
          <h3 className="font-serif text-2xl text-[#24211D] uppercase tracking-wider">
            HOMEPAGE &amp; STOREFRONT CONTENT MANAGEMENT
          </h3>
          <p className="text-xs text-[#686158]">
            Changes persist to Firebase Firestore with server-side Admin authorization and live storefront sync.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => setCurrentView('storefront')}
            className="px-4 py-2.5 rounded-xl bg-[#F1EDE5] hover:bg-[#DED7CC] border border-[#DED7CC] text-xs text-[#24211D] font-mono flex items-center space-x-2 cursor-pointer transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-[#9A783E]" />
            <span>Preview Storefront</span>
          </button>

          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2.5 rounded-xl bg-[#24211D] hover:bg-[#9A783E] disabled:opacity-60 text-[#FAF8F4] font-semibold text-xs uppercase tracking-widest flex items-center space-x-2 transition-all cursor-pointer"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving to Database...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save All Changes</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Feedback Alerts */}
      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 text-xs flex items-center gap-2.5">
          <Check className="w-4 h-4 shrink-0" />
          <span>{saveSuccess}</span>
        </div>
      )}
      {saveError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Hero Section & Brand Identity */}
        <div className="p-6 rounded-2xl bg-[#FFFFFF] border border-[#DED7CC] space-y-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-[#9A783E]">
              <Globe className="w-4 h-4" />
              <h4 className="text-xs uppercase tracking-widest font-semibold">
                Homepage Studio Hero &amp; Interactive Bottle
              </h4>
            </div>
            <label className="flex items-center space-x-2 text-xs text-[#24211D] cursor-pointer">
              <input
                type="checkbox"
                checked={formState.heroAnimationEnabled !== false}
                onChange={(e) =>
                  setFormState({ ...formState, heroAnimationEnabled: e.target.checked })
                }
                className="rounded border-[#DED7CC] text-[#9A783E]"
              />
              <span>Interactive Spray Enabled</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-[#686158] block mb-1">Brand Logo Text</label>
              <input
                type="text"
                value={formState.logoText || 'FRAGMORÉ'}
                onChange={(e) => setFormState({ ...formState, logoText: e.target.value })}
                className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-xl px-4 py-2.5 text-sm font-serif text-[#24211D] focus:border-[#9A783E] focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs text-[#686158] block mb-1">
                Featured Hero Fragrance Slug
              </label>
              <input
                type="text"
                value={formState.heroFeaturedProductSlug || 'golden-hour'}
                onChange={(e) =>
                  setFormState({ ...formState, heroFeaturedProductSlug: e.target.value })
                }
                placeholder="golden-hour"
                className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-xl px-4 py-2.5 text-xs font-mono text-[#24211D] focus:border-[#9A783E] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-[#686158] block mb-1">Hero Headline</label>
            <input
              type="text"
              value={formState.heroHeadline}
              onChange={(e) => setFormState({ ...formState, heroHeadline: e.target.value })}
              className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-xl px-4 py-2.5 text-sm font-serif text-[#24211D] focus:border-[#9A783E] focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs text-[#686158] block mb-1">Hero Sub-Tagline</label>
            <textarea
              rows={2}
              value={formState.heroTagline}
              onChange={(e) => setFormState({ ...formState, heroTagline: e.target.value })}
              className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-xl px-4 py-2.5 text-xs text-[#24211D] focus:border-[#9A783E] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-[#686158] block mb-1">Primary CTA Button Text</label>
              <input
                type="text"
                value={formState.heroCtaText || 'SHOP NOW'}
                onChange={(e) => setFormState({ ...formState, heroCtaText: e.target.value })}
                className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-xl px-4 py-2.5 text-xs text-[#24211D] focus:border-[#9A783E] focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs text-[#686158] block mb-1">Interactive Bottle Instruction</label>
              <input
                type="text"
                value={
                  formState.heroInteractionHint || 'Tap the bottle to experience the scent.'
                }
                onChange={(e) =>
                  setFormState({ ...formState, heroInteractionHint: e.target.value })
                }
                className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-xl px-4 py-2.5 text-xs text-[#24211D] focus:border-[#9A783E] focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-[#DED7CC] space-y-3">
            <div className="text-[11px] font-mono uppercase tracking-wider text-[#686158]">
              Optional Custom Layered Hero Renders (Bottle / Atomizer / Cap / Static Fallback)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-[#686158] block mb-1">
                  Layered Bottle Body URL
                </label>
                <input
                  type="text"
                  value={formState.heroLayeredBottleUrl || ''}
                  onChange={(e) =>
                    setFormState({ ...formState, heroLayeredBottleUrl: e.target.value })
                  }
                  placeholder="/images/hero/bottle-body.webp"
                  className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2 text-xs text-[#24211D] font-mono focus:border-[#9A783E] focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] text-[#686158] block mb-1">
                  Layered Atomizer Nozzle URL
                </label>
                <input
                  type="text"
                  value={formState.heroLayeredAtomizerUrl || ''}
                  onChange={(e) =>
                    setFormState({ ...formState, heroLayeredAtomizerUrl: e.target.value })
                  }
                  placeholder="/images/hero/atomizer.webp"
                  className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2 text-xs text-[#24211D] font-mono focus:border-[#9A783E] focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] text-[#686158] block mb-1">
                  Layered Spherical Cap URL
                </label>
                <input
                  type="text"
                  value={formState.heroLayeredCapUrl || ''}
                  onChange={(e) =>
                    setFormState({ ...formState, heroLayeredCapUrl: e.target.value })
                  }
                  placeholder="/images/hero/cap.webp"
                  className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2 text-xs text-[#24211D] font-mono focus:border-[#9A783E] focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] text-[#686158] block mb-1">
                  Static Reduced-Motion Fallback URL
                </label>
                <input
                  type="text"
                  value={formState.heroStaticFallbackUrl || ''}
                  onChange={(e) =>
                    setFormState({ ...formState, heroStaticFallbackUrl: e.target.value })
                  }
                  placeholder="/images/hero/poster-fallback.webp"
                  className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-lg px-3 py-2 text-xs text-[#24211D] font-mono focus:border-[#9A783E] focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 2. Announcement Bar & Thresholds */}
        <div className="p-6 rounded-2xl bg-[#FFFFFF] border border-[#DED7CC] space-y-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-[#9A783E]">
              <Megaphone className="w-4 h-4" />
              <h4 className="text-xs uppercase tracking-widest font-semibold">
                Announcement Bar &amp; Shipping Rules
              </h4>
            </div>
            <label className="flex items-center space-x-2 text-xs text-[#24211D] cursor-pointer">
              <input
                type="checkbox"
                checked={formState.announcementBarActive}
                onChange={(e) =>
                  setFormState({ ...formState, announcementBarActive: e.target.checked })
                }
                className="rounded border-[#DED7CC] text-[#9A783E]"
              />
              <span>Active</span>
            </label>
          </div>

          <div>
            <label className="text-xs text-[#686158] block mb-1">Top Announcement Text</label>
            <input
              type="text"
              value={formState.announcementBarText}
              onChange={(e) =>
                setFormState({ ...formState, announcementBarText: e.target.value })
              }
              className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-xl px-4 py-2.5 text-xs text-[#24211D] focus:border-[#9A783E] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-[#686158] block mb-1">
                Free Shipping Threshold (₹)
              </label>
              <input
                type="number"
                value={formState.freeShippingThreshold}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    freeShippingThreshold: Number(e.target.value)
                  })
                }
                className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-xl px-4 py-2.5 text-sm text-[#24211D] focus:border-[#9A783E] focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs text-[#686158] block mb-1">
                Discovery Voucher Value (₹)
              </label>
              <input
                type="number"
                value={formState.discoveryVoucherValue}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    discoveryVoucherValue: Number(e.target.value)
                  })
                }
                className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-xl px-4 py-2.5 text-sm text-[#24211D] focus:border-[#9A783E] focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* 3. Launch Mode */}
        <div className="p-6 rounded-2xl bg-[#FFFFFF] border border-[#DED7CC] space-y-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-[#9A783E]">
              <Calendar className="w-4 h-4" />
              <h4 className="text-xs uppercase tracking-widest font-semibold">
                Launch Mode Control
              </h4>
            </div>
            <label className="flex items-center space-x-2 text-xs text-[#24211D] cursor-pointer">
              <input
                type="checkbox"
                checked={formState.launchMode}
                onChange={(e) =>
                  setFormState({ ...formState, launchMode: e.target.checked })
                }
                className="rounded border-[#DED7CC] text-[#9A783E]"
              />
              <span>Enable Pre-Launch Gate</span>
            </label>
          </div>

          <div>
            <label className="text-xs text-[#686158] block mb-1">Target Launch Date &amp; Time</label>
            <input
              type="datetime-local"
              value={formState.launchDate.slice(0, 16)}
              onChange={(e) => setFormState({ ...formState, launchDate: e.target.value })}
              className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-xl px-4 py-2.5 text-xs text-[#24211D] focus:border-[#9A783E] focus:outline-none"
            />
          </div>
        </div>

        {/* 4. Contact & GST Details */}
        <div className="p-6 rounded-2xl bg-[#FFFFFF] border border-[#DED7CC] space-y-4 shadow-2xs">
          <div className="flex items-center space-x-2 text-[#9A783E]">
            <Share2 className="w-4 h-4" />
            <h4 className="text-xs uppercase tracking-widest font-semibold">
              Headquarters &amp; Tax Details
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-[#686158] block mb-1">Support Email</label>
              <input
                type="text"
                value={formState.contactEmail}
                onChange={(e) => setFormState({ ...formState, contactEmail: e.target.value })}
                className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-xl px-3 py-2 text-xs text-[#24211D] focus:border-[#9A783E] focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] text-[#686158] block mb-1">Support Phone</label>
              <input
                type="text"
                value={formState.contactPhone}
                onChange={(e) => setFormState({ ...formState, contactPhone: e.target.value })}
                className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-xl px-3 py-2 text-xs text-[#24211D] focus:border-[#9A783E] focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] text-[#686158] block mb-1">GSTIN Number</label>
              <input
                type="text"
                value={formState.gstNumber}
                onChange={(e) => setFormState({ ...formState, gstNumber: e.target.value })}
                className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-xl px-3 py-2 text-xs text-[#24211D] focus:border-[#9A783E] focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] text-[#686158] block mb-1">Instagram URL</label>
              <input
                type="text"
                value={formState.instagramUrl}
                onChange={(e) => setFormState({ ...formState, instagramUrl: e.target.value })}
                className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-xl px-3 py-2 text-xs text-[#24211D] focus:border-[#9A783E] focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>
    </form>
  );
};
