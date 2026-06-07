import { useState, useEffect, useCallback } from 'react';

interface GalleryImage {
  id: string;
  data: {
    image: string;
    pubDate: Date;
    title: string;
    caption?: string;
    credit?: string;
  }
}

interface LightboxGalleryProps {
  images: GalleryImage[];
  columns?: 2 | 3 | 4;
}

export default function LightboxGallery({ images, columns = 3 }: LightboxGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const open  = (i: number) => setLightboxIndex(i);
  const close = useCallback(() => setLightboxIndex(null), []);
  const prev  = useCallback(() => setLightboxIndex(i => (i! - 1 + images.length) % images.length), [images.length]);
  const next  = useCallback(() => setLightboxIndex(i => (i! + 1) % images.length), [images.length]);

  useEffect(() => {
    if (lightboxIndex === null) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape')     close();
      if (e.key === 'ArrowLeft')  prev();
      if (e.key === 'ArrowRight') next();
    };

    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [lightboxIndex, close, prev, next]);

  const isOpen = lightboxIndex !== null;
  const current = isOpen ? images[lightboxIndex] : null;

  return (
    <>
      <div
        className="lightbox-grid"
        style={{ '--cols': columns } as React.CSSProperties}
        role="list"
        aria-label="Photo gallery"
      >
        {images.map((img, i) => (
          <button
            key={img.id}
            className="lightbox-thumb"
            role="listitem"
            onClick={() => open(i)}
            aria-label={`Open photo: ${img.data.title}`}
          >
            <img
              src={img.data.image}
              alt={img.data.title}
              loading="lazy"
              width="400"
              height="280"
              className="lightbox-thumb__img"
            />
            <span className="lightbox-thumb__overlay" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="M11 8v6M8 11h6"/>
              </svg>
            </span>
          </button>
        ))}
      </div>

      {isOpen && current && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`Photo: ${current.data.title}`}
        >
          {/* Backdrop */}
          <div className="lightbox__backdrop" onClick={close} />

          {/* Panel */}
          <div className="lightbox__panel">
            <button className="lightbox__close" onClick={close} aria-label="Close photo">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>

            <button className="lightbox__nav lightbox__nav--prev" onClick={prev} aria-label="Previous photo">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
            </button>

            <figure className="lightbox__figure">
              <img
                key={current.id}
                src={current.data.image}
                alt={current.data.title}
                className="lightbox__img"
              />
              <figcaption className="lightbox__caption">
                <div>{current.data.title}</div>
                {current.data.caption && <p>{current.data.caption}</p>}
              </figcaption>
            </figure>

            <button className="lightbox__nav lightbox__nav--next" onClick={next} aria-label="Next photo">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>

            <div className="lightbox__counter" aria-live="polite">
              {lightboxIndex + 1} / {images.length}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .lightbox-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.25rem;
        }
        @media (min-width: 640px) {
          .lightbox-grid {
            grid-template-columns: repeat(var(--cols, 3), 1fr);
          }
        }
        .lightbox-thumb {
          position: relative;
          overflow: hidden;
          border-radius: 0.75rem;
          cursor: pointer;
          background: none;
          border: none;
          padding: 0;
          aspect-ratio: 4/3;
          corner-shape: bevel;
        }
        .lightbox-thumb__img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.4s ease;
          margin: 0;
        }
        .lightbox-thumb:hover .lightbox-thumb__img {
          transform: scale(1.05);
        }
        .lightbox-thumb__overlay {
          position: absolute;
          inset: 0;
          background: rgba(26,53,120,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        .lightbox-thumb:hover .lightbox-thumb__overlay,
        .lightbox-thumb:focus-visible .lightbox-thumb__overlay {
          opacity: 1;
        }
        .lightbox-thumb:focus-visible {
          outline: 3px solid var(--color-accent);
          outline-offset: 2px;
        }
        /* Lightbox overlay */
        .lightbox {
          position: fixed;
          inset: 0;
          z-index: 300;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .lightbox__backdrop {
          position: absolute;
          inset: 0;
          background: rgba(10,20,50,0.93);
        }
        .lightbox__panel {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 1100px;
          display: flex;
          align-items: center;
          gap: var(--space-4);
        }
        .lightbox__figure {
          flex: 1;
          text-align: center;
        }
        .lightbox__img {
          max-height: 80vh;
          max-width: 100%;
          margin-inline: auto;
          object-fit: contain;
          border-radius: var(--radius-md);
          animation: fade-in 0.2s ease;
        }
        @keyframes fade-in {
          from { opacity: 0; transform: scale(0.96); }
          to   { opacity: 1; transform: scale(1); }
        }
        .lightbox__caption {
          color: rgba(255,255,255,0.7);
        }
        .lightbox__caption > div {
          margin-top: var(--space-3);
          font-size: var(--text-xl);
          font-weight: 500;
        }
        .lightbox__caption > p {
          font-size: var(--text-lg);
          font-style: italic;
        }
        .lightbox__close {
          position: absolute;
          top: var(--space-4);
          right: var(--space-4);
          background: rgba(255,255,255,0.15);
          border: none;
          color: white;
          border-radius: var(--radius-full);
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 2;
          transition: background 0.2s;
        }
        .lightbox__close:hover { background: rgba(255,255,255,0.3); }
        .lightbox__nav {
          background: rgba(255,255,255,0.12);
          border: 1px solid rgba(255,255,255,0.2);
          color: white;
          border-radius: var(--radius-full);
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          transition: background 0.2s;
        }
        .lightbox__nav:hover { background: var(--color-accent); color: var(--color-primary-dark); }
        .lightbox__counter {
          position: absolute;
          bottom: 0;
          left: 50%;
          translate: -50% 75%;
          color: rgba(255,255,255,0.6);
          font-size: var(--text-sm);
        }
        @media (max-width: 640px) {
          .lightbox__nav { display: none; }
        }
      `}</style>
    </>
  );
}
