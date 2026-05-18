import { useState, useEffect } from 'react';

interface Testimonial {
  testimonial: string;
  names: string;
  photo?: string;
  date?: string;
};

export default function Testimonials({ testimonials }: { testimonials: Testimonial[] }) {
  const [current, setCurrent] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const total = testimonials.length;

  const goTo = (index: number) => {
    if (index === current || isAnimating) return;
    setIsAnimating(true);
    setTimeout(() => {
      setCurrent(index);
      setIsAnimating(false);
    }, 300);
  };

  const next = () => goTo((current + 1) % total);
  const prev = () => goTo((current - 1 + total) % total);

  useEffect(() => {
    const timer = setInterval(next, 6000);
    return () => clearInterval(timer);
  }, [current]);

  const t = testimonials[current];

  return (
    <section className="testimonials bg-outline-circles" aria-label="Guest testimonials" aria-live="polite">
      <div className="testimonials__inner">
        <div className={`testimonials__slide${isAnimating ? ' is-animating' : ''}`}>
          <blockquote className="testimonials__quote">
            {t.photo && (
              <img
                src={t.photo}
                alt={`Photo of ${t.names.split(',')[0].trim()}${t.names.includes(',') ? ' and others' : ''}, who provided a testimonial about their experience at Lower Notley Hall Farm.`}
                className="testimonials__photo"
                width={175}
                height={125}
              />
            )}
            <p className="testimonials__text">&ldquo;{t.testimonial}&rdquo;</p>
            <footer className="testimonials__attribution">
              <cite className="testimonials__author">{t.names}</cite>
              {t.date && <span className="testimonials__date">{t.date}</span>}
            </footer>
          </blockquote>
        </div>

        <div className="testimonials__controls" role="group" aria-label="Testimonial navigation">
          <button
            className="testimonials__arrow"
            onClick={prev}
            aria-label="Previous testimonial"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>

          <div className="testimonials__dots" role="tablist" aria-label="Select testimonial">
            {testimonials.map((_, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={i === current}
                aria-label={`Testimonial ${i + 1} of ${total}`}
                className={`testimonials__dot${i === current ? ' is-active' : ''}`}
                onClick={() => goTo(i)}
              />
            ))}
          </div>

          <button
            className="testimonials__arrow"
            onClick={next}
            aria-label="Next testimonial"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>
        </div>
      </div>

      <style>{`
        .testimonials {
          position: relative;
          padding-block: var(--space-20);
          @container main (width < 600px) {
            padding: 1rem;
          }
        }
        .testimonials__inner {
          max-width: 800px;
          margin-inline: auto;
          padding-inline: var(--space-6);
          text-align: center;
          @container main (width < 600px) {
            padding-inline: 0;
          }
        }
        .testimonials__slide {
          container: testimonial / inline-size;
          background: var(--color-bark-deep);
          transition: opacity 0.3s ease;
          color: white;
          padding: var(--space-10) var(--space-5) var(--space-5) var(--space-5);
          border-radius: var(--space-5);
          corner-shape: bevel;
        }
        .testimonials__slide.is-animating {
          opacity: 0;
        }
        .testimonials__quote {
          border: none;
          padding: 0;
          margin: 0 0 var(--space-8);
        }
        .testimonials__quote img {
        margin: var(--space-2) auto;
        corner-shape: scoop;
        border-radius: 10px;
        @container testimonial (width >= 300px) {
            margin: var(--space-2) var(--space-2) var(--space-2) 0;
            float: left;
            clear: both;
          }
        }
        .testimonials__text {
          font-family: var(--font-heading);
          font-style: italic;
          font-size: clamp(1.1rem, 2.5vw, 1.5rem);
          color: var(--color-white);
          line-height: var(--leading-relaxed);
          margin-bottom: var(--space-8);
          max-width: 100%;
        }
        .testimonials__attribution {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-1);
        }
        .testimonials__attribution::before {
          content: '';
          display: block;
          width: 3rem;
          height: 2px;
          background: var(--color-accent);
          margin-bottom: var(--space-3);
        }
        .testimonials__author {
          font-style: normal;
          font-family: var(--font-heading);
          font-size: var(--text-lg);
          color: var(--color-accent-light);
          font-weight: 600;
        }
        .testimonials__date {
          font-size: var(--text-sm);
          color: rgba(255,255,255,0.55);
          letter-spacing: 0.05em;
        }
        .testimonials__controls {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-6);
          position: absolute;
          inset: auto auto 1.5rem 0;
          z-index: 1;
          inline-size: 100%;
        }
        .testimonials__arrow {
          background: var(--color-accent-dark);
          border: 1px solid rgba(255,255,255,0.2);
          color: rgba(255,255,255,0.8);
          border-radius: var(--radius-full);
          width: 40px;
          height: 40px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background var(--transition-fast), color var(--transition-fast);
        }
        .testimonials__arrow:hover {
          background: var(--color-accent);
          color: var(--color-primary-dark);
          border-color: var(--color-accent);
        }
        .testimonials__dots {
          display: flex;
          gap: var(--space-2);
        }
        .testimonials__dot {
          width: 10px;
          height: 10px;
          border-radius: var(--radius-full);
          background: #fff;
          border: none;
          cursor: pointer;
          padding: 0;
          transition: background var(--transition-fast), transform var(--transition-fast);
        }
        .testimonials__dot.is-active,
        .testimonials__dot[aria-selected="true"] {
          background: var(--color-river-deep);
          transform: scale(1.3);
        }
      `}</style>
    </section>
  );
}
