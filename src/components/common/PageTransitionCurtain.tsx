import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useStore } from '../../context/StoreContext';

const COLUMN_COUNT = 12;

export const PageTransitionCurtain: React.FC = () => {
  const { currentView, selectedProductSlug } = useStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const columnsRef = useRef<(HTMLDivElement | null)[]>([]);
  const rulerRef = useRef<HTMLDivElement>(null);
  const centerDotRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);
  const prevKeyRef = useRef(`${currentView}:${selectedProductSlug || ''}`);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const currentKey = `${currentView}:${selectedProductSlug || ''}`;
    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevKeyRef.current = currentKey;
      return;
    }

    if (prevKeyRef.current === currentKey) return;
    prevKeyRef.current = currentKey;

    const mqMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mqMotion.matches) return;

    const cols = columnsRef.current.filter(Boolean) as HTMLDivElement[];
    if (cols.length === 0) return;

    setIsActive(true);

    const tl = gsap.timeline({
      onComplete: () => {
        setIsActive(false);
      }
    });

    // Reset initial state: slats cover screen from bottom to top, then reveal upward
    gsap.set(cols, {
      scaleY: 0,
      transformOrigin: 'bottom center'
    });

    if (rulerRef.current) {
      gsap.set(rulerRef.current, { opacity: 0, x: -16 });
    }
    if (centerDotRef.current) {
      gsap.set(centerDotRef.current, { opacity: 0, scale: 0.5 });
    }

    // Phase 1: Vertical slats sweep in with tight stagger
    tl.to(cols, {
      scaleY: 1,
      duration: 0.36,
      stagger: {
        each: 0.022,
        from: 'start'
      },
      ease: 'power3.inOut'
    });

    if (rulerRef.current) {
      tl.to(
        rulerRef.current,
        {
          opacity: 1,
          x: 0,
          duration: 0.2,
          ease: 'power2.out'
        },
        0.14
      );
    }

    if (centerDotRef.current) {
      tl.to(
        centerDotRef.current,
        {
          opacity: 1,
          scale: 1,
          duration: 0.2,
          ease: 'power2.out'
        },
        0.18
      );
    }

    // Phase 2: Switch transformOrigin to top and lift slats upward to unveil the new view
    tl.set(cols, { transformOrigin: 'top center' }, '+=0.08');

    if (rulerRef.current) {
      tl.to(
        rulerRef.current,
        {
          opacity: 0,
          x: -12,
          duration: 0.18,
          ease: 'power2.in'
        },
        '<'
      );
    }

    if (centerDotRef.current) {
      tl.to(
        centerDotRef.current,
        {
          opacity: 0,
          scale: 0.5,
          duration: 0.16,
          ease: 'power2.in'
        },
        '<'
      );
    }

    tl.to(
      cols,
      {
        scaleY: 0,
        duration: 0.48,
        stagger: {
          each: 0.024,
          from: 'center'
        },
        ease: 'expo.inOut'
      },
      '<0.04'
    );

    return () => {
      tl.kill();
    };
  }, [currentView, selectedProductSlug]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={`fixed inset-0 z-[90] pointer-events-none overflow-hidden flex ${
        isActive ? 'visible' : 'invisible'
      }`}
    >
      {/* 12 Vertical Blind Columns (Alternating Deep Obsidian & Charcoal Tones like Reference Video 00:09) */}
      {Array.from({ length: COLUMN_COUNT }).map((_, idx) => (
        <div
          key={idx}
          ref={(el) => {
            columnsRef.current[idx] = el;
          }}
          className={`flex-1 h-full will-change-transform ${
            idx % 2 === 0 ? 'lumina-curtain-slat-even' : 'lumina-curtain-slat-odd'
          }`}
          style={{ transform: 'scaleY(0)' }}
        />
      ))}

      {/* Left-Edge Architectural Scale Ticks (Matching Reference Video 00:09) */}
      <div
        ref={rulerRef}
        className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 flex flex-col justify-between h-[52vh] opacity-0 pointer-events-none z-10"
      >
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className="h-[1px] bg-white/45"
              style={{ width: i % 2 === 0 ? '26px' : '14px' }}
            />
          </div>
        ))}
      </div>

      {/* Subtle Center Focal Point Dot */}
      <div
        ref={centerDotRef}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2 opacity-0 pointer-events-none z-10"
      >
        <div className="w-2 h-2 rounded-full bg-[#FAF8F4] shadow-[0_0_16px_rgba(255,255,255,0.8)]" />
        <span className="font-serif text-[11px] tracking-[0.42em] uppercase text-[#FAF8F4]/85">
          FRAGMORÉ
        </span>
      </div>
    </div>
  );
};
