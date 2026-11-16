import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown } from 'lucide-react';

export const IntroWordmarkStage: React.FC = () => {
  const spacerRef = useRef<HTMLDivElement>(null);
  const curtainRef = useRef<HTMLDivElement>(null);
  const floatingLogoRef = useRef<HTMLDivElement>(null);
  const wordTextRef = useRef<HTMLSpanElement>(null);
  const subtitleRef = useRef<HTMLSpanElement>(null);
  const scrollPromptRef = useRef<HTMLButtonElement>(null);
  const [isDocked, setIsDocked] = useState(false);

  useEffect(() => {
    const headerLogo = document.getElementById('fragmore-header-logo');
    const headerTextSpan = headerLogo?.querySelector('span') as HTMLElement | null;

    let rafId: number | null = null;

    const updateAnimation = () => {
      rafId = null;
      const scrollY = window.scrollY || 0;
      const vh = Math.max(window.innerHeight, 500);
      const vw = Math.max(window.innerWidth, 320);

      // Scroll distance over which the blank intro stage transitions into the header
      const transitionDistance = vh * 0.82;
      const rawProgress = scrollY / transitionDistance;
      const progress = Math.min(Math.max(rawProgress, 0), 1);

      // Smooth cubic easing for the wordmark flight into the header
      const eased = 1 - Math.pow(1 - progress, 2.6);

      // 1. Move the blank full-screen curtain upward as the user scrolls
      const curtainProgress = Math.min(Math.max((progress - 0.08) / 0.88, 0), 1);
      if (curtainRef.current) {
        const curtainY = -curtainProgress * 102;
        curtainRef.current.style.transform = `translate3d(0, ${curtainY.toFixed(2)}%, 0)`;
        curtainRef.current.style.pointerEvents = progress > 0.85 ? 'none' : 'auto';
      }

      // 2. Fade out the bottom "SCROLL" indicator and subtitle quickly as scrolling begins
      const fadeOutFast = Math.max(0, 1 - progress * 3.4);
      if (scrollPromptRef.current) {
        scrollPromptRef.current.style.opacity = fadeOutFast.toFixed(3);
        scrollPromptRef.current.style.transform = `translate3d(0, ${Math.round(
          -progress * 28
        )}px, 0)`;
      }
      if (subtitleRef.current) {
        subtitleRef.current.style.opacity = fadeOutFast.toFixed(3);
      }

      // 3. Interpolate native fontSize & letterSpacing (ZERO bitmap scale stretching = razor-sharp on 4K/large screens)
      if (floatingLogoRef.current && wordTextRef.current) {
        let targetY = 56;
        let targetFontSize = vw < 375 ? 17 : vw < 640 ? 19 : vw < 768 ? 24 : 28;
        let targetLetterSpacing = vw < 640 ? 0.18 : 0.26; // in em

        if (headerLogo) {
          const rect = headerLogo.getBoundingClientRect();
          if (rect.height > 0) {
            targetY = rect.top + rect.height / 2;
          }
        }
        if (headerTextSpan) {
          const computed = window.getComputedStyle(headerTextSpan);
          const parsedSize = parseFloat(computed.fontSize);
          if (!Number.isNaN(parsedSize) && parsedSize > 10) {
            targetFontSize = parsedSize;
          }
        }

        // Crisp native starting display font size based on viewport width (up to 96px on large monitors)
        const startFontSize = Math.min(Math.max(vw * 0.068, 36), 96);
        const currentFontSize = startFontSize + (targetFontSize - startFontSize) * eased;

        const startLetterSpacing = vw < 640 ? 0.28 : 0.36;
        const currentLetterSpacing =
          startLetterSpacing + (targetLetterSpacing - startLetterSpacing) * eased;

        // Slightly above exact vertical center on initial screen so the elevated scroll prompt sits harmoniously below
        const startY = vh * 0.44;
        const currentY = startY + (targetY - startY) * eased;

        // Snap Y to device pixel grid to prevent subpixel blurriness
        const dpr = window.devicePixelRatio || 1;
        const snappedY = Math.round(currentY * dpr) / dpr;

        floatingLogoRef.current.style.transform = `translate3d(0, ${snappedY}px, 0) translateY(-50%)`;
        wordTextRef.current.style.fontSize = `${currentFontSize.toFixed(2)}px`;
        wordTextRef.current.style.letterSpacing = `${currentLetterSpacing.toFixed(3)}em`;
        wordTextRef.current.style.paddingLeft = `${currentLetterSpacing.toFixed(3)}em`;

        // Color transition: White on the blank dark intro curtain -> Dark Espresso once curtain passes behind it
        const curtainTopEdgePx = vh * (1 - curtainProgress);
        const isOverDarkCurtain = currentY < curtainTopEdgePx;
        wordTextRef.current.style.color = isOverDarkCurtain ? '#FAF8F4' : '#24211D';
      }

      // 4. Seamless handoff to the real Header wordmark at progress >= 0.98
      const dockedNow = progress >= 0.98;
      setIsDocked(dockedNow);
      if (headerLogo) {
        headerLogo.style.opacity = dockedNow ? '1' : '0';
        headerLogo.style.transition = 'opacity 120ms ease-out';
      }
    };

    const onScrollOrResize = () => {
      if (rafId === null) {
        rafId = requestAnimationFrame(updateAnimation);
      }
    };

    updateAnimation();
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (headerLogo) {
        headerLogo.style.opacity = '1';
      }
    };
  }, []);

  const handleScrollTrigger = () => {
    const vh = Math.max(window.innerHeight, 500);
    window.scrollTo({
      top: vh * 0.84,
      behavior: 'smooth'
    });
  };

  return (
    <>
      {/* Scroll Track Spacer so scrolling smoothly drives the transition before scrolling the page */}
      <div
        ref={spacerRef}
        aria-hidden="true"
        className="w-full h-[84vh] bg-[var(--bg-main)] select-none pointer-events-none"
      />

      {/* Full-Screen High-Definition Blank Intro Stage (Reference Video 00:01 - 00:04) */}
      <div
        ref={curtainRef}
        onClick={handleScrollTrigger}
        className={`fixed inset-0 z-[55] lumina-intro-blank-curtain flex flex-col items-center justify-end pb-16 sm:pb-20 md:pb-24 select-none cursor-pointer ${
          isDocked ? 'invisible pointer-events-none' : 'visible'
        }`}
      >
        {/* Subtle Architectural Studio Frame Hairline */}
        <div
          aria-hidden="true"
          className="absolute inset-4 sm:inset-7 border border-white/[0.06] pointer-events-none"
        />

        {/* Centered & Elevated "SCROLL" Prompt + Glowing Medallion Arrow */}
        <div className="w-full flex items-center justify-center px-4">
          <button
            ref={scrollPromptRef}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleScrollTrigger();
            }}
            aria-label="Scroll down to enter store"
            className="group relative mx-auto flex flex-col items-center justify-center gap-3.5 text-center text-[#FAF8F4] transition-all duration-300 cursor-pointer focus-visible:outline-none"
          >
            {/* Vertical Lead Line Guiding Eye From Center Wordmark to Scroll Control */}
            <span
              aria-hidden="true"
              className="w-[1px] h-8 sm:h-10 bg-gradient-to-b from-transparent via-[#D4AF37]/70 to-[#D4AF37]"
            />

            {/* Optical-Centered Scroll Label */}
            <span className="text-[11px] sm:text-xs font-mono font-medium uppercase tracking-[0.38em] pl-[0.38em] text-[#FAF8F4]/95 group-hover:text-[#D4AF37] transition-colors">
              SCROLL
            </span>

            {/* Elevated Tactile Arrow Medallion with Halo Pulse */}
            <span className="relative flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#1C1915] border border-[#D4AF37]/75 shadow-[0_10px_30px_rgba(212,175,55,0.32),0_0_0_5px_rgba(212,175,55,0.10)] group-hover:scale-105 group-hover:border-[#D4AF37] group-hover:shadow-[0_12px_36px_rgba(212,175,55,0.48),0_0_0_7px_rgba(212,175,55,0.16)] transition-all duration-300">
              <span
                aria-hidden="true"
                className="absolute inset-0 rounded-full border border-[#D4AF37]/40 animate-ping opacity-40"
              />
              <ArrowDown className="w-5 h-5 sm:w-5.5 sm:h-5.5 text-[#D4AF37] stroke-[2.2] animate-bounce" />
            </span>
          </button>
        </div>
      </div>

      {/* Floating Vector-Sharp FRAGMORÉ Wordmark (Native Font-Size Interpolation — Zero Upscale Blur) */}
      <div
        ref={floatingLogoRef}
        aria-hidden="true"
        style={{
          top: 0,
          left: 0,
          right: 0,
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
          textRendering: 'geometricPrecision'
        }}
        className={`fixed inset-x-0 w-full z-[65] pointer-events-none select-none flex flex-col items-center justify-center text-center ${
          isDocked ? 'opacity-0 invisible' : 'opacity-100 visible'
        }`}
      >
        <span
          ref={wordTextRef}
          style={{
            color: '#FAF8F4',
            fontSize: 'clamp(36px, 6.8vw, 96px)',
            letterSpacing: '0.36em',
            paddingLeft: '0.36em'
          }}
          className="font-serif uppercase block leading-none font-normal whitespace-nowrap transition-colors duration-200"
        >
          FRAGMOR<span className="text-[#D4AF37]">É</span>
        </span>

        <span
          ref={subtitleRef}
          className="mt-4 sm:mt-5 text-[10px] sm:text-xs font-mono uppercase tracking-[0.42em] pl-[0.42em] text-[#FAF8F4]/65 whitespace-nowrap text-center"
        >
          SCENT THAT STAYS WITH YOU
        </span>
      </div>
    </>
  );
};
