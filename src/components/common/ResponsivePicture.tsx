import React, { useState, useEffect } from 'react';

export interface ResponsiveImageBreakpoints {
  sm?: { webp: string; jpg?: string }; // Mobile (< 640px)
  md?: { webp: string; jpg?: string }; // Tablet (640px - 1023px)
  lg?: { webp: string; jpg?: string }; // Desktop (>= 1024px)
}

export interface ResponsivePictureProps {
  /**
   * The base name or slug for standard assets (e.g., 'azure', 'ignite', 'roselle'),
   * or a custom path prefix.
   */
  slug?: string;
  category?: 'products' | 'editorial';
  /**
   * Explicit breakpoint overrides if custom URLs are provided
   */
  sources?: ResponsiveImageBreakpoints;
  /**
   * Image alt text for accessibility and SEO
   */
  alt: string;
  /**
   * Set priority to true for above-the-fold / LCP candidate elements.
   * This sets loading="eager", fetchPriority="high", and preloads the WebP image.
   */
  priority?: boolean;
  /**
   * Explicit dimensions to prevent Cumulative Layout Shift (CLS)
   */
  width?: number | string;
  height?: number | string;
  aspectRatio?: string; // e.g. "400/520", "1/1", "16/9"
  /**
   * CSS class names
   */
  className?: string;
  imageClassName?: string;
  sizes?: string;
  objectFit?: 'contain' | 'cover' | 'fill' | 'none';
  onClick?: () => void;
}

export const ResponsivePicture: React.FC<ResponsivePictureProps> = ({
  slug,
  category = 'products',
  sources,
  alt,
  priority = false,
  width,
  height,
  aspectRatio = '400/520',
  className = '',
  imageClassName = '',
  sizes,
  objectFit = 'contain',
  onClick
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Derive responsive breakpoint paths if slug is provided
  const resolvedSources: ResponsiveImageBreakpoints = sources || {
    sm: {
      webp: `/images/${category}/${slug}-sm.webp`,
      jpg: `/images/${category}/${slug}-sm.jpg`
    },
    md: {
      webp: `/images/${category}/${slug}-md.webp`,
      jpg: `/images/${category}/${slug}-md.jpg`
    },
    lg: {
      webp: `/images/${category}/${slug}-lg.webp`,
      jpg: `/images/${category}/${slug}-lg.jpg`
    }
  };

  const defaultWebp = resolvedSources.lg?.webp || resolvedSources.md?.webp || resolvedSources.sm?.webp || '';
  const defaultJpg = resolvedSources.lg?.jpg || resolvedSources.md?.jpg || resolvedSources.sm?.jpg || '';

  // Inject responsive preload link in document head for priority / LCP candidates
  useEffect(() => {
    if (!priority || !defaultWebp) return;

    const linkId = `preload-lcp-${slug || 'hero'}`;
    if (document.getElementById(linkId)) return;

    const preloadLink = document.createElement('link');
    preloadLink.id = linkId;
    preloadLink.rel = 'preload';
    preloadLink.as = 'image';
    preloadLink.type = 'image/webp';
    preloadLink.href = defaultWebp;

    if (resolvedSources.sm?.webp && resolvedSources.lg?.webp) {
      preloadLink.imageSrcset = `${resolvedSources.sm.webp} 400w, ${resolvedSources.md?.webp || resolvedSources.sm.webp} 800w, ${resolvedSources.lg.webp} 1200w`;
      preloadLink.imageSizes = sizes || '(min-width: 1024px) 1200px, (min-width: 640px) 800px, 400px';
    }

    document.head.appendChild(preloadLink);

    return () => {
      const existing = document.getElementById(linkId);
      if (existing) {
        existing.remove();
      }
    };
  }, [priority, defaultWebp, slug, sizes]);

  return (
    <div
      className={`relative overflow-hidden inline-flex items-center justify-center ${className}`}
      style={{
        aspectRatio: aspectRatio,
        width: width ? (typeof width === 'number' ? `${width}px` : width) : undefined,
        height: height ? (typeof height === 'number' ? `${height}px` : height) : undefined
      }}
      onClick={onClick}
    >
      {/* Luxury Dark Ambient Placeholder shimmer while WebP is decoding */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.02] via-white/[0.05] to-transparent animate-pulse pointer-events-none rounded" />
      )}

      {/* Responsive <picture> Tag Serving Breakpoint-Specific WebP with Fallback */}
      <picture className="w-full h-full flex items-center justify-center">
        {/* Desktop Viewport (min-width: 1024px) */}
        {resolvedSources.lg && (
          <>
            <source
              media="(min-width: 1024px)"
              type="image/webp"
              srcSet={`${resolvedSources.lg.webp} 1x, ${resolvedSources.lg.webp} 2x`}
            />
            {resolvedSources.lg.jpg && (
              <source
                media="(min-width: 1024px)"
                type="image/jpeg"
                srcSet={`${resolvedSources.lg.jpg} 1x, ${resolvedSources.lg.jpg} 2x`}
              />
            )}
          </>
        )}

        {/* Tablet Viewport (min-width: 640px) */}
        {resolvedSources.md && (
          <>
            <source
              media="(min-width: 640px)"
              type="image/webp"
              srcSet={`${resolvedSources.md.webp} 1x, ${resolvedSources.md.webp} 2x`}
            />
            {resolvedSources.md.jpg && (
              <source
                media="(min-width: 640px)"
                type="image/jpeg"
                srcSet={`${resolvedSources.md.jpg} 1x, ${resolvedSources.md.jpg} 2x`}
              />
            )}
          </>
        )}

        {/* Mobile Viewport / Default Fallback */}
        {resolvedSources.sm && (
          <>
            <source
              type="image/webp"
              srcSet={`${resolvedSources.sm.webp} 1x, ${resolvedSources.sm.webp} 2x`}
            />
            {resolvedSources.sm.jpg && (
              <source
                type="image/jpeg"
                srcSet={`${resolvedSources.sm.jpg} 1x, ${resolvedSources.sm.jpg} 2x`}
              />
            )}
          </>
        )}

        {/* Browser Fallback <img> Tag */}
        <img
          src={defaultJpg || defaultWebp}
          alt={alt}
          width={width}
          height={height}
          loading={priority ? 'eager' : 'lazy'}
          // @ts-ignore - React 19 / modern HTML standard fetchPriority
          fetchPriority={priority ? 'high' : 'low'}
          decoding={priority ? 'sync' : 'async'}
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          className={`w-full h-full transition-opacity duration-500 ${
            objectFit === 'contain'
              ? 'object-contain'
              : objectFit === 'cover'
              ? 'object-cover'
              : 'object-fill'
          } ${isLoaded ? 'opacity-100' : 'opacity-0'} ${imageClassName}`}
        />
      </picture>
    </div>
  );
};
