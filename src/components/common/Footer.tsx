import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { FragmoreLogo } from './FragmoreLogo';

export const Footer: React.FC = () => {
  const { setCurrentView, setSelectedCategoryFilter, cms, showNotification } = useStore();
  const [newsletterEmail, setNewsletterEmail] = useState('');

  const handleNewsletter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail) return;
    showNotification('Thank you. You have been added to the FRAGMORÉ Private Client List.');
    setNewsletterEmail('');
  };

  const handleNav = (view: string, filter: string = 'all') => {
    setSelectedCategoryFilter(filter);
    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-[#F1EDE5] text-[#24211D] border-t border-[#DED7CC] pt-16 pb-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
      <div className="max-w-7xl mx-auto space-y-14">
        {/* Top Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          {/* Col 1 & 2: Brand Lockup, Newsletter & Made in India Stamp */}
          <div className="lg:col-span-2 space-y-6">
            <FragmoreLogo size="lg" variant="studio" showTagline={true} />
            <p className="text-xs text-[#686158] font-light leading-relaxed max-w-sm">
              Scent That Stays With You. Conceived between Grasse and Kannauj, crafted with fine botanical extracts and sacred Mysore woods.
            </p>

            <form onSubmit={handleNewsletter} className="space-y-2 max-w-sm">
              <span className="text-[11px] font-mono tracking-widest text-[#9A783E] uppercase block">
                Join The Private Client List
              </span>
              <div className="flex gap-2">
                <input
                  type="email"
                  required
                  placeholder="Enter your email"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  className="flex-1 bg-[#FFFFFF] border border-[#DED7CC] rounded px-3 py-2 text-xs text-[#24211D] placeholder-[#686158]/60 focus:outline-none focus:border-[#9A783E]"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#9A783E] text-[#FFFFFF] text-xs font-semibold uppercase tracking-wider rounded transition-opacity hover:opacity-90 cursor-pointer"
                >
                  Join
                </button>
              </div>
              <span className="text-[10px] text-[#686158] block">
                Privileged early access to limited harvests and private coffrets.
              </span>
            </form>
          </div>

          {/* Col 3: The Collections */}
          <div className="space-y-4">
            <h4 className="font-serif text-sm tracking-widest uppercase text-[#24211D] font-medium">
              The Collections
            </h4>
            <ul className="space-y-2.5 text-xs text-[#686158]">
              <li>
                <button
                  onClick={() => handleNav('shop', 'Signature Collection')}
                  className="hover:text-[#24211D] transition-colors cursor-pointer"
                >
                  Signature Collection (9 Creations)
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNav('shop', 'Aura Collection')}
                  className="hover:text-[#24211D] transition-colors cursor-pointer"
                >
                  Aura Collection (15 ml · ₹249)
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNav('shop', 'women')}
                  className="hover:text-[#24211D] transition-colors cursor-pointer"
                >
                  Women's Fragrances
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNav('shop', 'unisex')}
                  className="hover:text-[#24211D] transition-colors cursor-pointer"
                >
                  Unisex &amp; Men's Creations
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNav('shop', 'discovery')}
                  className="hover:text-[#24211D] transition-colors cursor-pointer"
                >
                  Discovery Six (2ml &amp; 10ml)
                </button>
              </li>
            </ul>
          </div>

          {/* Col 4: The House */}
          <div className="space-y-4">
            <h4 className="font-serif text-sm tracking-widest uppercase text-[#24211D] font-medium">
              The House
            </h4>
            <ul className="space-y-2.5 text-xs text-[#686158]">
              <li>
                <button
                  onClick={() => handleNav('journal')}
                  className="hover:text-[#24211D] transition-colors cursor-pointer"
                >
                  The Editorial Journal
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNav('track-order')}
                  className="hover:text-[#24211D] transition-colors cursor-pointer"
                >
                  Order Tracking
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNav('account')}
                  className="hover:text-[#24211D] transition-colors cursor-pointer"
                >
                  Customer Account
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNav('wishlist')}
                  className="hover:text-[#24211D] transition-colors cursor-pointer"
                >
                  Private Wishlist
                </button>
              </li>
            </ul>
          </div>

          {/* Col 5: Maison Origin */}
          <div className="space-y-4 text-xs text-[#686158]">
            <h4 className="font-serif text-sm tracking-widest uppercase text-[#24211D] font-medium">
              Maison &amp; Origin
            </h4>
            <div className="space-y-1.5 font-mono text-[11px]">
              <p className="text-[#24211D]">{cms.contactEmail}</p>
              <p className="text-[#24211D]">{cms.contactPhone}</p>
              <p className="pt-1 text-[#686158]">{cms.headquarters}</p>
              <p className="text-[#686158]">GSTIN: {cms.gstNumber}</p>
            </div>
          </div>
        </div>

        {/* Bottom Bar: Copyright, Made in India Stamp Badge & Compliance */}
        <div className="pt-8 border-t border-[#DED7CC] flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-mono text-[#686158]">
          <div className="text-center md:text-left flex flex-wrap items-center justify-center md:justify-start gap-x-2 gap-y-1">
            <span>
              {cms.footerCopyright || `© ${new Date().getFullYear()} FRAGMORÉ. All rights reserved.`}
            </span>
            <span className="hidden sm:inline text-[#DED7CC]">·</span>
            <span>
              Crafted with passion by{' '}
              <a
                href="https://brandorigin.in"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#9A783E] hover:text-[#24211D] font-semibold underline underline-offset-4 transition-colors"
              >
                BrandOrigin
              </a>
            </span>
          </div>

          {/* Center Stamp Pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FAF8F4] border border-[#DED7CC] text-[10px] uppercase tracking-[0.2em] text-[#24211D] font-semibold">
            <span className="inline-flex items-center gap-1.5" aria-hidden="true">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-xs" />
              <span className="w-2.5 h-2.5 rounded-full bg-white border border-stone-300 shadow-xs" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-600 shadow-xs" />
            </span>
            <span>MADE IN INDIA</span>
          </div>

          <div className="flex items-center gap-6 text-[11px]">
            <span>Privacy Policy</span>
            <span>·</span>
            <span>Terms of Service</span>
            <span>·</span>
            <span>IFRA Compliance</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
