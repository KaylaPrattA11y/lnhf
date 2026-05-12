import { useState } from 'react';
import { NOTES } from '../../data/pricing';

interface PricingTableEntry {
  id: string;
  name: string;
  feeType: 'static' | 'dynamic';
  adjustment: number;
  perUnit: boolean;
  sortOrder: number;
  description?: string;
  maxUnits?: number; // only used if perUnit is true
}

interface PricingTableProps {
  entries: PricingTableEntry[];
}

export default function PricingTable({ entries }: PricingTableProps) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const estimatedTotal = entries.reduce((sum, ent) => {
    if (ent.feeType === 'static') return sum + ent.adjustment;
    if (ent.feeType === 'dynamic' && checked[ent.name]) {
      const qty = ent.perUnit ? (quantities[ent.name] ?? 1) : 1;
      return sum + ent.adjustment * qty;
    }
    return sum;
  }, 0);

  const toggle = (entry: PricingTableEntry) => {
    setChecked(prev => ({ ...prev, [entry.name]: !prev[entry.name] }));
    if (!checked[entry.name] && !quantities[entry.name]) {
      setQuantities(prev => ({ ...prev, [entry.name]: 1 }));
    }
  };

  const setQty = (name: string, qty: number, max?: number) => {
    const clamped = Math.min(Math.max(1, qty), max ?? Infinity);
    setQuantities(prev => ({ ...prev, [name]: clamped }));
  };

  const fmt = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  const handlePrint = () => window.print();

  return (
    <div className="pricing-tool">
      <div className="pricing-tool__table-wrap">
        <table className="pricing-table" aria-label="Wedding pricing estimator">
          <caption className="sr-only">
            Adjust the options below to estimate the cost of your event at Lower Notley Hall Farm.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="pricing-table__col--option">Option</th>
              <th scope="col" className="pricing-table__col--amount">Adjustment</th>
              <th scope="col" className="pricing-table__col--qty">Qty</th>
            </tr>
          </thead>
          <tbody>
            {/* Adjustable rows */}
            {entries.map(ent => (
              <tr
                key={ent.name}
                className={`pricing-table__row${checked[ent.name] ? ' is-checked' : ''}${ent.feeType === 'static' ? ' is-static' : ''}`}
              >
                <td className="pricing-table__label">
                  {ent.feeType === 'static' ? (
                    <span className="pricing-table__check-label">{ent.name}</span>
                  ) : (
                  <label className="pricing-table__check-label">
                    <input
                      type="checkbox"
                      className="pricing-table__checkbox"
                      value={ent.adjustment}
                      checked={checked[ent.name] ?? false}
                      onChange={() => toggle(ent)}
                      aria-describedby={ent.description ? `desc-${ent.name}` : undefined}
                    />
                    <span className="pricing-table__check-text">{ent.name}</span>
                  </label>
                  )}
                  {ent.description && (
                    <span id={`desc-${ent.name}`} className="pricing-table__desc">{ent.description}</span>
                  )}
                </td>
                <td className="pricing-table__amount" aria-live="polite">
                  <span className={ent.adjustment < 0 ? 'is-discount' : 'is-surcharge'}>
                    {ent.adjustment < 0 ? '−' : '+'}{fmt(Math.abs(ent.adjustment))}
                    {ent.perUnit && checked[ent.name] && ` × ${quantities[ent.name] ?? 1}`}
                  </span>
                </td>
                <td className="pricing-table__qty">
                  {ent.perUnit && checked[ent.name] && (
                    <input
                      type="number"
                      className="pricing-table__qty-input"
                      min="1"
                      max={ent.maxUnits}
                      value={quantities[ent.name] ?? 1}
                      onChange={e => setQty(ent.name, parseInt(e.target.value, 10), ent.maxUnits)}
                      aria-label={`Quantity for ${ent.name}`}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="pricing-table__row pricing-table__row--total">
              <td><strong>Estimated Package Total</strong></td>
              <td className="pricing-table__amount pricing-table__total" aria-live="polite">
                <strong>{fmt(estimatedTotal)}</strong>
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Custom package note */}
      <div className="pricing-tool__note pricing-tool__note--cta">
        <p>
          Can&rsquo;t find what you want?{' '}
          <a href="/contact">Contact Jack and Cindy</a>{' '}
          to create your custom package.
        </p>
      </div>

      {/* Action buttons */}
      <div className="pricing-tool__actions no-print">
        <button
          type="button"
          className="btn btn--secondary"
          onClick={handlePrint}
          aria-label="Print or save this estimate as PDF"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
          </svg>
          Print / Save as PDF
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => { setChecked({}); setQuantities({}); }}
          aria-label="Reset pricing estimator"
        >
          Reset
        </button>
      </div>

      {/* Notes */}
      <div className="pricing-tool__notes">
        <h3 className="pricing-tool__notes-title">Important Notes</h3>
        <ol>
          {NOTES.map((note, i) => <li key={i}>{note}</li>)}
        </ol>
      </div>

      <style>{`
        .pricing-tool {
          font-size: var(--text-base);
          container: pricing-table / inline-size;
        }
        .pricing-tool__table-wrap {
          overflow-x: auto;
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-md);
          margin-bottom: var(--space-6);
        }
        .pricing-table {
          width: 100%;
          border-collapse: collapse;
          background: var(--color-white);
        }
        .pricing-table thead {
          background: var(--color-primary-dark);
          color: var(--color-white);
        }
        .pricing-table th {
          padding: var(--space-4) var(--space-5);
          text-align: left;
          font-size: var(--text-sm);
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .pricing-table__row td {
          padding: var(--space-4) var(--space-5);
          border-bottom: 1px solid var(--color-border);
          vertical-align: middle;
        }
        .pricing-table__row:last-child td { border-bottom: none; }
        .pricing-table__row--base { background: var(--color-gray-100); }
        .pricing-table__row--fixed { background: var(--color-gray-100); color: var(--color-text-muted); }
        .pricing-table__row--total { background: var(--color-primary-dark); color: var(--color-white); }
        .pricing-table__row--total td { border: none; padding: var(--space-5); }
        .pricing-table__row.is-checked { background: var(--color-available-bg); }
        
        .pricing-table__total { font-size: var(--text-xl); }
        .is-discount { color: var(--color-available); font-weight: 700; }
        .is-surcharge { color: var(--color-accent-dark); font-weight: 700; }
        .pricing-table__label { min-width: 260px; }
        .pricing-table__check-label {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          font-weight: 700;
          line-height: var(--leading-snug);
        }
        .pricing-table__checkbox {
          width: 18px;
          height: 18px;
          flex-shrink: 0;
          accent-color: var(--color-river);
          cursor: pointer;
        }
        .pricing-table__desc {
          display: block;
          font-weight: 400;
          font-size: var(--text-xs);
          color: var(--color-text-muted);
          margin-top: var(--space-1);
          padding-left: 30px;
        }
        .pricing-table__qty-input {
          width: 64px;
          padding: var(--space-1) var(--space-2);
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-sm);
          font-size: var(--text-sm);
          text-align: center;
        }
        .pricing-tool__note--cta {
          background: var(--color-cream);
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: var(--space-4) var(--space-6);
          margin-bottom: var(--space-6);
          font-size: var(--text-base);
          text-align: center;
        }
        .pricing-tool__note--cta a { font-weight: 700; }
        .pricing-tool__actions {
          display: flex;
          gap: var(--space-3);
          flex-wrap: wrap;
          margin-bottom: var(--space-8);
        }
        .pricing-tool__notes {
          background: var(--color-gray-100);
          border-radius: var(--radius-lg);
          padding: var(--space-6);
        }
        .pricing-tool__notes-title {
          font-size: var(--text-lg);
          color: var(--color-primary-dark);
          margin-bottom: var(--space-4);
        }
        .pricing-tool__notes ol {
          padding-left: var(--space-6);
        }
        .pricing-tool__notes li {
          font-size: var(--text-sm);
          color: var(--color-text-muted);
          margin-bottom: var(--space-3);
          line-height: var(--leading-relaxed);
        }
        @container pricing-table (width < 600px) {
        .pricing-table thead th:not(:first-child) { display: none; }
          .pricing-table__row td {
            display: block;
            padding: var(--space-1) var(--space-4);
          }
          .pricing-table__row td:empty {
            padding: 0;
          }
          .pricing-table__row td:not(:last-child) {
            border: 0;
          }
        }
        @container pricing-table (width >= 600px) {
          .pricing-table__col--amount,
          .pricing-table__col--qty {
            text-align: right;
            white-space: nowrap;
          }
          .pricing-table__amount {
            text-align: right;
            font-variant-numeric: tabular-nums;
            white-space: nowrap;
          }
        }
        /* Print styles */
        @media print {
          .pricing-tool__actions { display: none !important; }
          .pricing-table {
            font-size: 11pt;
            box-shadow: none;
          }
        }
      `}</style>
    </div>
  );
}
