import React from 'react';

interface FragmoreLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero';
  variant?: 'studio' | 'light' | 'gold' | 'monochrome';
  showTagline?: boolean;
  className?: string;
  onClick?: () => void;
}

export const FragmoreLogo: React.FC<FragmoreLogoProps> = ({
  size = 'md',
  variant = 'gold',
  showTagline = true,
  className = '',
  onClick
}) => {
  const getDimensions = () => {
    switch (size) {
      case 'sm':
        return {
          titleSize: 'text-base tracking-[0.25em]',
          taglineSize: 'text-[7px] tracking-[0.35em]',
          accentOffset: 'scale-90',
          gap: 'gap-0.5'
        };
      case 'md':
        return {
          titleSize: 'text-xl tracking-[0.3em]',
          taglineSize: 'text-[9px] tracking-[0.4em]',
          accentOffset: 'scale-100',
          gap: 'gap-1'
        };
      case 'lg':
        return {
          titleSize: 'text-2xl sm:text-3xl tracking-[0.35em]',
          taglineSize: 'text-[10px] sm:text-xs tracking-[0.45em]',
          accentOffset: 'scale-110',
          gap: 'gap-1.5'
        };
      case 'xl':
        return {
          titleSize: 'text-4xl sm:text-5xl tracking-[0.4em]',
          taglineSize: 'text-xs sm:text-sm tracking-[0.5em]',
          accentOffset: 'scale-125',
          gap: 'gap-2'
        };
      case 'hero':
        return {
          titleSize: 'text-4xl sm:text-6xl md:text-7xl tracking-[0.35em]',
          taglineSize: 'text-xs sm:text-sm md:text-base tracking-[0.55em]',
          accentOffset: 'scale-150',
          gap: 'gap-3'
        };
    }
  };

  const dim = getDimensions();

  const getColors = () => {
    switch (variant) {
      case 'studio':
      case 'gold':
        return {
          title: 'text-[var(--text-main)] hover:text-[var(--accent-gold)] transition-colors duration-300',
          accent: 'text-[var(--accent-gold)]',
          tagline: 'text-[var(--accent-gold)]'
        };
      case 'light':
        return {
          title: 'text-[#F5EFE5]',
          accent: 'text-[#D0AE70]',
          tagline: 'text-[#C7BBA9]'
        };
      case 'monochrome':
        return {
          title: 'text-[var(--text-main)]',
          accent: 'text-[var(--text-main)]',
          tagline: 'text-[var(--text-secondary)]'
        };
    }
  };

  const colors = getColors();

  return (
    <div
      onClick={onClick}
      className={`inline-flex flex-col items-center justify-center select-none text-center ${
        onClick ? 'cursor-pointer group' : ''
      } ${dim.gap} ${className}`}
      role="banner"
      aria-label="FRAGMORÉ — Scent That Stays With You."
    >
      <div className="flex items-center justify-center font-display font-medium relative">
        <span className={`font-serif tracking-[0.32em] font-light uppercase ${dim.titleSize} ${colors.title}`}>
          FRAGMOR<span className="relative inline-block font-normal">
            E
            <span
              className={`absolute -top-[0.22em] right-[0.08em] ${dim.accentOffset} ${colors.accent} select-none font-serif`}
              style={{ transformOrigin: 'bottom center' }}
            >
              ´
            </span>
          </span>
        </span>
      </div>

      {showTagline && (
        <span
          className={`font-sans uppercase font-medium ${dim.taglineSize} ${colors.tagline} opacity-90 transition-opacity duration-300`}
        >
          Scent That Stays With You.
        </span>
      )}
    </div>
  );
};
