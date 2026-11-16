import React from 'react';
import { useStore } from '../../context/StoreContext';
import { ArrowRight } from 'lucide-react';
import { ResponsivePicture } from '../common/ResponsivePicture';

interface Article {
  id: string;
  title: string;
  kicker: string;
  readTime: string;
  date: string;
  excerpt: string;
  content: string[];
  fragranceSlug: string;
  fragranceName: string;
  imageSlug: string;
}

const ARTICLES: Article[] = [
  {
    id: 'art-1',
    title: 'The Sacred Woods of India: The Timeless Mystique of Mysore Chandan',
    kicker: 'Heritage Distillation',
    readTime: '6 min read',
    date: 'September 2026',
    excerpt: 'Before high parfumerie conquered Versailles, ancient Indian temple courts had perfected the meditative extraction of pure Santalum album.',
    content: [
      'In the quiet dawn of the southern Deccan plateau, the heartwood of mature sandalwood trees contains a complex lipid matrix that has defied synthetic duplication for over two millennia.',
      'Unlike fleeting citrus oils that disperse in minutes, true Mysore Sandalwood forms deep bonds with skin, creating an olfactory aura of calm, clarity, and grounding serenity.',
      'In our Aura Collection creation Moksha Essence, we honor this sacred botanical heritage alongside Tulsi, Jasmine, Lotus, and Nagachampa.'
    ],
    fragranceSlug: 'moksha-essence',
    fragranceName: 'Moksha Essence',
    imageSlug: 'journal-sandalwood'
  },
  {
    id: 'art-2',
    title: 'The Architecture of Sillage: Crafting Scent That Stays With You',
    kicker: 'Olfactory Craft',
    readTime: '5 min read',
    date: 'August 2026',
    excerpt: 'How top, heart, and base accords unfold across hours to create an unforgettable personal signature.',
    content: [
      'Every FRAGMORÉ Signature creation is structured around a three-stage olfactory pyramid designed to evolve seamlessly across skin.',
      'From the luminous opening of Golden Hour with Citrus and Pear to the rich Saffron and Warm Wood heart of Luxe Heritage, each note is balanced for clarity and poise.',
      'The result is a refined sillage that accompanies you from day into evening.'
    ],
    fragranceSlug: 'luxe-heritage',
    fragranceName: 'Luxe Heritage',
    imageSlug: 'journal-sillage'
  },
  {
    id: 'art-3',
    title: 'Kannauj to Grasse: The Royal Synthesis of French & Indian Parfumerie',
    kicker: 'Atelier Chronicles',
    readTime: '7 min read',
    date: 'July 2026',
    excerpt: 'Bridging traditional Indian botanical distillation with modern French perfumery.',
    content: [
      'For over four centuries, Kannauj has been recognized as the perfume capital of the East, where master craftsmen capture delicate flower absolutes and noble woods.',
      'Meanwhile, Grasse developed precision extraction, isolating the sparkling facets of citrus, rose, and aldehydes.',
      'FRAGMORÉ bridges these two traditions across our nine Signature Collection fragrances and three soulful Aura Collection creations.'
    ],
    fragranceSlug: 'blush-and-blossom',
    fragranceName: 'Blush & Blossom',
    imageSlug: 'journal-kannauj'
  }
];

export const TheJournalView: React.FC = () => {
  const { setCurrentView, setSelectedProductSlug } = useStore();

  const handleProductClick = (slug: string) => {
    setSelectedProductSlug(slug);
    setCurrentView('product');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center space-y-3 pb-8 border-b border-[var(--border-subtle)]">
          <span className="text-xs font-mono tracking-[0.3em] uppercase text-[var(--accent-gold)]">
            Editorial Olfactory Culture
          </span>
          <h1 className="font-serif text-3xl sm:text-5xl tracking-widest font-light text-[var(--text-main)] uppercase">
            The FRAGMORÉ Journal
          </h1>
          <p className="text-sm text-[var(--text-secondary)] font-light max-w-lg mx-auto">
            Essays on olfactory heritage, fine botanical extracts, the architecture of sillage, and Scent That Stays With You.
          </p>
        </div>

        {/* Articles Feed */}
        <div className="space-y-12">
          {ARTICLES.map((art) => (
            <article
              key={art.id}
              className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-8 sm:p-12 space-y-6 hover:border-[var(--accent-gold)] transition-all shadow-sm"
            >
              <div className="flex items-center gap-2 text-xs font-mono text-[var(--accent-gold)] tracking-wider uppercase">
                <span>{art.kicker}</span>
                <span aria-hidden="true">·</span>
                <span>{art.date}</span>
                <span aria-hidden="true">·</span>
                <span>{art.readTime}</span>
              </div>

              <h2 className="font-serif text-2xl sm:text-3xl tracking-wide uppercase font-light text-[var(--text-main)] leading-tight">
                {art.title}
              </h2>

              <div className="w-full rounded-xl overflow-hidden border border-[var(--border-subtle)] my-4 bg-[var(--bg-secondary)]">
                <ResponsivePicture
                  category="editorial"
                  slug={art.imageSlug}
                  alt={art.title}
                  aspectRatio="16/9"
                  width={800}
                  height={450}
                  sizes="(min-width: 1024px) 760px, (min-width: 640px) 600px, 100vw"
                  className="w-full"
                  imageClassName="w-full object-cover"
                />
              </div>

              <p className="text-sm sm:text-base text-[var(--text-main)] font-light italic leading-relaxed border-l-2 border-[var(--accent-gold)] pl-4">
                "{art.excerpt}"
              </p>

              <div className="space-y-4 text-xs sm:text-sm text-[var(--text-secondary)] font-light leading-relaxed">
                {art.content.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>

              <div className="pt-6 border-t border-[var(--border-subtle)] flex items-center justify-between">
                <span className="text-xs font-mono text-[var(--text-secondary)]">
                  Featured Creation: <strong className="text-[var(--text-main)] uppercase">{art.fragranceName}</strong>
                </span>
                <button
                  onClick={() => handleProductClick(art.fragranceSlug)}
                  className="inline-flex items-center gap-2 text-xs font-mono text-[var(--accent-gold)] hover:underline uppercase tracking-wider cursor-pointer"
                >
                  <span>Experience {art.fragranceName}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </article>
          ))}
        </div>

        {/* Back to Catalog */}
        <div className="text-center pt-8">
          <button
            onClick={() => setCurrentView('shop')}
            className="px-8 py-3.5 bg-[var(--text-main)] hover:bg-[var(--accent-gold)] text-[var(--bg-surface)] text-xs font-semibold uppercase tracking-widest rounded transition-colors cursor-pointer"
          >
            Explore The Fragrances
          </button>
        </div>
      </div>
    </div>
  );
};
