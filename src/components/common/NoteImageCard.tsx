import React, { useState, useEffect } from 'react';
import { NoteMediaConfig } from '../../types';
import { getIngredientMedia } from '../../data/ingredientMedia';

interface NoteImageCardProps {
  noteName: string;
  customNoteMedia?: Record<string, NoteMediaConfig>;
  variant?: 'compact' | 'tile' | 'orb';
  className?: string;
}

export const NoteImageCard: React.FC<NoteImageCardProps> = ({
  noteName,
  customNoteMedia,
  variant = 'compact',
  className = ''
}) => {
  const media = getIngredientMedia(noteName, customNoteMedia);
  const [imgSrc, setImgSrc] = useState<string>(media.imageUrl || media.fallbackDataUri);

  useEffect(() => {
    setImgSrc(media.imageUrl || media.fallbackDataUri);
  }, [media.imageUrl, media.fallbackDataUri]);

  if (variant === 'orb') {
    return (
      <div
        className={`flex flex-col items-center text-center group select-none ${className}`}
        title={media.alt}
      >
        <div
          className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-sm shrink-0"
          style={{ aspectRatio: '1 / 1' }}
        >
          <img
            src={imgSrc}
            alt={media.alt}
            width={56}
            height={56}
            loading="lazy"
            onError={() => {
              if (imgSrc !== media.fallbackDataUri) {
                setImgSrc(media.fallbackDataUri);
              }
            }}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {media.isAbstractAccord && (
            <span className="absolute bottom-0 inset-x-0 bg-black/65 text-[7px] font-mono uppercase tracking-widest text-white py-0.5 text-center">
              Accord
            </span>
          )}
        </div>
        <span className="mt-1 text-[10px] font-medium text-[var(--text-main)] leading-tight max-w-[82px] truncate">
          {media.label}
        </span>
      </div>
    );
  }

  if (variant === 'tile') {
    return (
      <div
        className={`flex items-center gap-2.5 p-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] transition-colors ${className}`}
      >
        <div
          className="relative w-11 h-11 rounded-lg overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-secondary)] shrink-0"
          style={{ aspectRatio: '1 / 1' }}
        >
          <img
            src={imgSrc}
            alt={media.alt}
            width={44}
            height={44}
            loading="lazy"
            onError={() => {
              if (imgSrc !== media.fallbackDataUri) {
                setImgSrc(media.fallbackDataUri);
              }
            }}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <span className="block text-xs font-medium text-[var(--text-main)] truncate">
            {media.label}
          </span>
          <span className="block text-[10px] text-[var(--text-secondary)] truncate">
            {media.isAbstractAccord ? media.subtitle || 'Atmospheric Accord' : 'Botanical Note'}
          </span>
        </div>
      </div>
    );
  }

  // Default: compact horizontal pill/chip with vibrant square thumbnail
  return (
    <div
      className={`inline-flex items-center gap-2 pr-2.5 pl-1 py-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-left shadow-[0_2px_6px_rgba(0,0,0,0.03)] ${className}`}
    >
      <div
        className="relative w-7 h-7 rounded-md overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-secondary)] shrink-0"
        style={{ aspectRatio: '1 / 1' }}
      >
        <img
          src={imgSrc}
          alt={media.alt}
          width={28}
          height={28}
          loading="lazy"
          onError={() => {
            if (imgSrc !== media.fallbackDataUri) {
              setImgSrc(media.fallbackDataUri);
            }
          }}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="min-w-0">
        <span className="block text-[11px] font-medium text-[var(--text-main)] leading-tight">
          {media.label}
        </span>
        {media.isAbstractAccord && (
          <span className="block text-[8px] font-mono uppercase tracking-wider text-[var(--accent-gold)] leading-none mt-0.5">
            Accord
          </span>
        )}
      </div>
    </div>
  );
};
