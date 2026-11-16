import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { X, Sparkles, ArrowRight, ArrowLeft, RotateCcw, ShoppingBag, CheckCircle2 } from 'lucide-react';
import { FragmoreBottleVisual } from './FragmoreBottleVisual';

export const FragranceQuizModal: React.FC = () => {
  const {
    isQuizOpen,
    setIsQuizOpen,
    products,
    setSelectedProductSlug,
    setCurrentView,
    addToCart,
    trackEvent,
    customer,
    setIsAuthModalOpen,
    showNotification
  } = useStore();

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [selectedSizes, setSelectedSizes] = useState<Record<string, string>>({});

  if (!isQuizOpen) return null;

  const questions = [
    {
      title: 'Which olfactory mood calls to you today?',
      subtitle: 'Step 1 of 4 · Personal Character & Energy',
      options: [
        {
          id: 'luminous-citrus',
          label: 'Radiant, Crisp & Invigorating',
          desc: 'Sun-drenched citrus, fresh grapefruit, crushed mint & crisp pear'
        },
        {
          id: 'romantic-floral',
          label: 'Velvety, Blooming & Romantic',
          desc: 'Sparkling rose, airy gardenia, blush peony & orange blossom'
        },
        {
          id: 'warm-amber',
          label: 'Golden, Sensual & Addictive',
          desc: 'Warm vanilla, brown sugar, dark berries, golden amber & soft musk'
        },
        {
          id: 'bold-woody',
          label: 'Magnetic, Rich & Mysterious',
          desc: 'Warm leather, saffron, nutmeg, cedarwood & smoky woods'
        }
      ]
    },
    {
      title: 'When do you envision wearing this creation?',
      subtitle: 'Step 2 of 4 · Occasion & Setting',
      options: [
        {
          id: 'daytime-executive',
          label: 'Signature Daytime & Executive Presence',
          desc: 'Refined, polished, and effortlessly uplifting from morning to dusk'
        },
        {
          id: 'evening-soiree',
          label: 'Midnight Soirées & Black-Tie Statements',
          desc: 'Deep, magnetic, and unforgettable after dark'
        },
        {
          id: 'intimate-date',
          label: 'Romantic Evenings, Dates & Celebrations',
          desc: 'Playful, alluring, and captivating close to the skin'
        },
        {
          id: 'calm-retreat',
          label: 'Sunlit Getaways, Leisure & Quiet Reflection',
          desc: 'Breezy, grounded, and soul-soothing warmth'
        }
      ]
    },
    {
      title: 'Which heart & base notes resonate with your skin?',
      subtitle: 'Step 3 of 4 · Olfactory Architecture',
      options: [
        {
          id: 'woods-leather',
          label: 'Noble Woods, Leather & Warm Spice',
          desc: 'Cedarwood, sandalwood, saffron, nutmeg & rich leather accords'
        },
        {
          id: 'petals-vanilla',
          label: 'Lush Florals, Aldehydes & Creamy Vanilla',
          desc: 'Rose, jasmine, peony, gardenia & warm Madagascar vanilla'
        },
        {
          id: 'fruit-amber',
          label: 'Sparkling Fruit, Golden Amber & Musk',
          desc: 'Pear, tart raspberry, blackcurrant, sunset amber & soft musks'
        },
        {
          id: 'botanical-incense',
          label: 'Crisp Botanicals, Sandalwood & Incense',
          desc: 'Mint, sacred woods, lotus petals & smoky incense trail'
        }
      ]
    },
    {
      title: 'How would you like your fragrance trail to be experienced?',
      subtitle: 'Step 4 of 4 · Sillage & Expression',
      options: [
        {
          id: 'commanding',
          label: 'Commanding & Magnetic Trail',
          desc: 'A bold, distinctive presence that leaves a lasting impression'
        },
        {
          id: 'poised',
          label: 'Classic, Poised & Timeless',
          desc: 'Harmonious elegance balanced between radiance and refinement'
        },
        {
          id: 'radiant-playful',
          label: 'Sparkling, Playful & Luminous',
          desc: 'Effervescent energy that feels modern, chic, and effortless'
        }
      ]
    }
  ];

  const handleSelectOption = (optionId: string) => {
    const updated = { ...answers, [step]: optionId };
    setAnswers(updated);
    if (step < questions.length - 1) {
      setStep(step + 1);
    } else {
      trackEvent('CompleteFragranceFinder', updated);
      setStep(questions.length);
    }
  };

  const getScoredRecommendations = () => {
    const mood = answers[0];
    const occasion = answers[1];
    const accord = answers[2];
    const trail = answers[3];

    const activeProducts = products.filter(
      (p) => p.status === 'ACTIVE' && p.collection !== 'Discovery Collection' && p.gender !== 'discovery'
    );

    const scored = activeProducts.map((prod) => {
      let score = prod.collection === 'Signature Collection' ? 25 : 5;
      const slug = prod.slug;
      const allNotes = [
        ...(prod.notes?.top || []),
        ...(prod.notes?.heart || []),
        ...(prod.notes?.base || [])
      ]
        .join(' ')
        .toLowerCase();
      const families = (prod.families || []).map((f) => f.toLowerCase());
      const occasions = (prod.occasions || []).map((o) => o.toLowerCase());

      // 1. Mood scoring
      if (mood === 'luminous-citrus') {
        if (['aqua-pulse', 'golden-hour', 'blush-and-blossom'].includes(slug)) score += 40;
        if (families.includes('fresh') || families.includes('citrus')) score += 20;
        if (allNotes.includes('citrus') || allNotes.includes('grapefruit') || allNotes.includes('pear')) score += 15;
      } else if (mood === 'romantic-floral') {
        if (['blush-and-blossom', 'flora-crush', 'silky-velvet', 'night-bloom'].includes(slug)) score += 40;
        if (families.includes('floral')) score += 20;
        if (allNotes.includes('rose') || allNotes.includes('gardenia') || allNotes.includes('peony')) score += 15;
      } else if (mood === 'warm-amber') {
        if (['golden-hour', 'midnight-glow', 'night-bloom', 'flora-crush'].includes(slug)) score += 40;
        if (families.includes('amber') || families.includes('gourmand') || families.includes('sweet')) score += 20;
        if (allNotes.includes('vanilla') || allNotes.includes('amber') || allNotes.includes('sugar')) score += 15;
      } else if (mood === 'bold-woody') {
        if (['violet-noir', 'luxe-heritage', 'midnight-glow', 'aqua-pulse'].includes(slug)) score += 40;
        if (families.includes('leather') || families.includes('woody') || families.includes('spicy')) score += 20;
        if (allNotes.includes('leather') || allNotes.includes('saffron') || allNotes.includes('wood')) score += 15;
      }

      // 2. Occasion scoring
      if (occasion === 'daytime-executive') {
        if (['aqua-pulse', 'silky-velvet', 'golden-hour', 'blush-and-blossom'].includes(slug)) score += 30;
        if (occasions.includes('day') || occasions.includes('office') || occasions.includes('daily')) score += 15;
      } else if (occasion === 'evening-soiree') {
        if (['violet-noir', 'luxe-heritage', 'midnight-glow', 'night-bloom'].includes(slug)) score += 30;
        if (occasions.includes('night') || occasions.includes('party')) score += 15;
      } else if (occasion === 'intimate-date') {
        if (['night-bloom', 'midnight-glow', 'flora-crush', 'blush-and-blossom'].includes(slug)) score += 30;
        if (occasions.includes('wedding') || occasions.includes('party')) score += 15;
      } else if (occasion === 'calm-retreat') {
        if (['golden-hour', 'silky-velvet', 'aqua-pulse', 'moksha-essence'].includes(slug)) score += 30;
        if (occasions.includes('vacation') || occasions.includes('daily')) score += 15;
      }

      // 3. Heart & Base Accord scoring
      if (accord === 'woods-leather') {
        if (['violet-noir', 'luxe-heritage', 'aqua-pulse', 'silky-velvet'].includes(slug)) score += 35;
        if (allNotes.includes('leather') || allNotes.includes('cedarwood') || allNotes.includes('sandalwood')) score += 15;
      } else if (accord === 'petals-vanilla') {
        if (['blush-and-blossom', 'silky-velvet', 'night-bloom', 'flora-crush'].includes(slug)) score += 35;
        if (allNotes.includes('rose') || allNotes.includes('jasmine') || allNotes.includes('vanilla')) score += 15;
      } else if (accord === 'fruit-amber') {
        if (['golden-hour', 'midnight-glow', 'flora-crush', 'luxe-heritage'].includes(slug)) score += 35;
        if (allNotes.includes('pear') || allNotes.includes('raspberry') || allNotes.includes('amber')) score += 15;
      } else if (accord === 'botanical-incense') {
        if (['aqua-pulse', 'silky-velvet', 'violet-noir', 'moksha-essence'].includes(slug)) score += 35;
        if (allNotes.includes('incense') || allNotes.includes('mint') || allNotes.includes('sandalwood')) score += 15;
      }

      // 4. Trail & Expression scoring
      if (trail === 'commanding') {
        if (['violet-noir', 'luxe-heritage', 'midnight-glow'].includes(slug)) score += 25;
      } else if (trail === 'poised') {
        if (['silky-velvet', 'golden-hour', 'blush-and-blossom'].includes(slug)) score += 25;
      } else if (trail === 'radiant-playful') {
        if (['flora-crush', 'aqua-pulse', 'night-bloom', 'blush-and-blossom'].includes(slug)) score += 25;
      }

      const matchPercent = Math.min(99, Math.max(84, Math.round(72 + (score / 185) * 27)));
      return { product: prod, score, matchPercent };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 4);
  };

  const recommendations = step === questions.length ? getScoredRecommendations() : [];

  const handleReset = () => {
    setStep(0);
    setAnswers({});
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) setIsQuizOpen(false);
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto"
    >
      <div className="relative bg-stone-950 border border-amber-500/30 rounded-2xl sm:rounded-3xl max-w-2xl w-full my-auto max-h-[88vh] overflow-y-auto p-5 sm:p-8 shadow-2xl">
        {/* Top Bar */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center space-x-2 text-amber-400">
            <Sparkles className="w-4 h-4" />
            <span className="text-xs uppercase tracking-[0.25em] font-medium">
              FRAGMORÉ Olfactory Finder
            </span>
          </div>
          <button
            onClick={() => setIsQuizOpen(false)}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-stone-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {step < questions.length ? (
          <div>
            {/* Progress Bar */}
            <div className="w-full h-1 bg-stone-800 rounded-full mb-5 overflow-hidden">
              <div
                className="h-full bg-amber-400 transition-all duration-300"
                style={{ width: `${((step + 1) / questions.length) * 100}%` }}
              />
            </div>

            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase tracking-widest text-amber-400/90">
                {questions[step].subtitle}
              </span>
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => setStep(step - 1)}
                  className="inline-flex items-center gap-1 text-xs text-stone-400 hover:text-white cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>
              )}
            </div>

            <h3 className="font-serif text-2xl sm:text-3xl text-white mb-5">
              {questions[step].title}
            </h3>

            <div className="space-y-2.5">
              {questions[step].options.map((opt) => {
                const isSelected = answers[step] === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => handleSelectOption(opt.id)}
                    className={`w-full text-left p-4 rounded-xl border transition-all group flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-400'
                        : 'bg-stone-900/70 hover:bg-amber-500/15 border-white/10 hover:border-amber-400/50'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-semibold text-white group-hover:text-amber-200">
                        {opt.label}
                      </p>
                      <p className="text-xs text-stone-400 mt-0.5">{opt.desc}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-amber-300 group-hover:translate-x-1 transition-all shrink-0 ml-3" />
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div>
            <div className="text-center mb-6">
              <span className="text-xs uppercase tracking-[0.3em] text-amber-400 block mb-1.5">
                Bespoke Olfactory Analysis Complete
              </span>
              <h3 className="font-serif text-2xl sm:text-3xl text-white mb-1.5">
                YOUR SIGNATURE MATCHES
              </h3>
              <p className="text-xs text-stone-400">
                Ranked by olfactory harmony with your mood, setting, and note preferences:
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 max-h-80 overflow-y-auto pr-1">
              {recommendations.map(({ product: prod, matchPercent }) => {
                const availableVariants = prod.variants.filter(
                  (v) => v.isAvailable !== false && v.sellingPrice > 0
                );
                const chosenSize =
                  selectedSizes[prod.slug] ||
                  availableVariants[0]?.size ||
                  prod.variants[0]?.size ||
                  '30 ml';
                const variant =
                  prod.variants.find((v) => v.size === chosenSize) ||
                  availableVariants[0] ||
                  prod.variants[0];

                return (
                  <div
                    key={prod.id}
                    className="p-4 rounded-2xl bg-stone-900/80 border border-amber-500/30 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded">
                          <CheckCircle2 className="w-3 h-3" />
                          {matchPercent}% Match
                        </span>
                        {availableVariants.length > 1 ? (
                          <div className="flex items-center gap-1">
                            {availableVariants.map((v) => (
                              <button
                                key={v.id}
                                type="button"
                                onClick={() =>
                                  setSelectedSizes((prev) => ({ ...prev, [prod.slug]: v.size }))
                                }
                                className={`text-[10px] px-2 py-0.5 rounded cursor-pointer transition-colors ${
                                  variant?.size === v.size
                                    ? 'bg-amber-500 text-stone-950 font-semibold'
                                    : 'bg-white/5 text-stone-400 hover:text-white'
                                }`}
                              >
                                {v.size}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-200">
                            {variant?.size}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-16 shrink-0 flex items-center justify-center bg-black/30 rounded-lg border border-white/10">
                          <FragmoreBottleVisual
                            slug={prod.slug}
                            size={variant?.size}
                            variant={variant}
                            productName={prod.name}
                            collection={prod.collection}
                            className="w-10 h-14"
                            showGlow={false}
                            showShadow={false}
                          />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-serif text-lg text-white mb-0.5 truncate">
                            {prod.name}
                          </h4>
                          <p className="text-[11px] text-amber-200/90 italic mb-1 truncate">
                            {prod.subtitle}
                          </p>
                          <p className="text-[11px] text-stone-400 line-clamp-2">
                            Notes: {[...(prod.notes.top || []), ...(prod.notes.heart || [])].slice(0, 3).join(', ')}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-white/10">
                      <span className="font-serif text-base text-white font-semibold">
                        ₹{(variant?.sellingPrice || 0).toLocaleString('en-IN')}{' '}
                        <span className="text-[10px] text-stone-400">({variant?.size})</span>
                      </span>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            setIsQuizOpen(false);
                            setSelectedProductSlug(prod.slug);
                            setCurrentView('product');
                          }}
                          className="px-3 py-1.5 rounded-lg border border-white/15 text-[11px] text-white hover:bg-white/10 cursor-pointer"
                        >
                          View
                        </button>
                        {variant && (
                          <button
                            onClick={() => {
                              setIsQuizOpen(false);
                              if (!customer) {
                                showNotification('Please sign in to add items to your shopping bag.');
                                setIsAuthModalOpen(true);
                                return;
                              }
                              addToCart(prod, variant.size, 1);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-[11px] flex items-center space-x-1 cursor-pointer"
                          >
                            <ShoppingBag className="w-3 h-3" />
                            <span>Add</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-white/10">
              <button
                onClick={handleReset}
                className="inline-flex items-center space-x-2 text-xs text-stone-400 hover:text-white uppercase tracking-widest cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retake Finder</span>
              </button>

              <button
                onClick={() => {
                  setIsQuizOpen(false);
                  setCurrentView('shop');
                }}
                className="text-xs text-amber-300 hover:text-amber-200 uppercase tracking-widest cursor-pointer"
              >
                Explore All Fragrances →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
