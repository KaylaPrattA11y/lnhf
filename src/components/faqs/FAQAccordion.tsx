import { useState } from 'react';

interface FAQItem {
  question: string;
  answer: string;
  id: string;
}

interface FAQAccordionProps {
  items: FAQItem[];
}

export default function FAQAccordion({ items }: FAQAccordionProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  const toggle = (id: string) => setOpenId(prev => (prev === id ? null : id));

  return (
    <div className="faq-accordion" role="list">
      {items.map(item => {
        const isOpen = openId === item.id;
        const panelId = `faq-panel-${item.id}`;
        const btnId   = `faq-btn-${item.id}`;

        return (
          <div
            key={item.id}
            className={`faq-item${isOpen ? ' is-open' : ''}`}
            role="listitem"
          >
            <h3 className="faq-item__heading">
              <button
                id={btnId}
                className="faq-item__trigger"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(item.id)}
                data-umami-event={`FAQ Click: ${item.question}`}
              >
                <span className="faq-item__question">{item.question}</span>
                <span className="faq-item__icon" aria-hidden="true">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points={isOpen ? '18 15 12 9 6 15' : '6 9 12 15 18 9'} />
                  </svg>
                </span>
              </button>
            </h3>

            <div
              id={panelId}
              role="region"
              aria-labelledby={btnId}
              className="faq-item__panel"
              hidden={!isOpen}
            >
              <div
                className="faq-item__answer prose"
                dangerouslySetInnerHTML={{ __html: item.answer }}
              />
            </div>
          </div>
        );
      })}

      <style>{`
        .faq-accordion {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }
        .faq-item {
          background: var(--color-white);
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-lg);
          overflow: hidden;
          transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
        }
        .faq-item.is-open {
          border-color: var(--color-primary);
          box-shadow: var(--shadow-sm);
        }
        .faq-item__heading { margin: 0; }
        .faq-item__trigger {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-4);
          padding: var(--space-5) var(--space-6);
          background: none;
          border: none;
          cursor: pointer;
          text-align: left;
          transition: background var(--transition-fast);
        }
        .faq-item__trigger:hover {
          background: var(--color-gray-100);
        }
        .faq-item.is-open .faq-item__trigger {
          background: var(--color-gray-100);
        }
        .faq-item__trigger:focus-visible {
          outline: 3px solid var(--color-accent);
          outline-offset: -3px;
        }
        .faq-item__question {
          font-family: var(--font-heading);
          font-size: var(--text-lg);
          font-weight: 600;
          color: var(--color-primary-dark);
          line-height: var(--leading-snug);
        }
        .faq-item__icon {
          flex-shrink: 0;
          color: var(--color-primary);
          transition: transform var(--transition-base);
        }
        .faq-item__panel {
          padding: 0 var(--space-6) var(--space-6);
          border-top: 1px solid var(--color-border);
        }
        .faq-item__answer {
          padding-top: var(--space-5);
          color: var(--color-text);
          line-height: var(--leading-relaxed);
          font-size: var(--text-base);
        }
        .faq-item__answer :global(a) {
          color: var(--color-primary);
          font-weight: 700;
        }
        .faq-item__answer :global(p) { margin-bottom: var(--space-3); }
        .faq-item__answer :global(ul), .faq-item__answer :global(ol) {
          padding-left: var(--space-6);
          margin-bottom: var(--space-3);
        }
      `}</style>
    </div>
  );
}
