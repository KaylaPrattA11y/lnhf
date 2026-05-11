import { useState } from 'react';
import { BASE_PRICE, DAMAGE_DEPOSIT, RETAINING_FEE, ADJUSTMENTS, NOTES } from '../../data/pricing';

export default function PricingTable() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const toggle = (id: string) => {
    setChecked(prev => ({ ...prev, [id]: !prev[id] }));
    if (!checked[id] && !quantities[id]) {
      setQuantities(prev => ({ ...prev, [id]: 1 }));
    }
  };

  const setQty = (id: string, qty: number) => {
    setQuantities(prev => ({ ...prev, [id]: Math.max(1, qty) }));
  };

  const adjustmentTotal = ADJUSTMENTS.reduce((sum, adj) => {
    if (!checked[adj.id]) return sum;
    const qty = adj.perUnit ? (quantities[adj.id] ?? 1) : 1;
    return sum + adj.amount * qty;
  }, 0);

  const estimatedTotal = Math.max(0, BASE_PRICE + adjustmentTotal);

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
            {/* Base price row */}
            <tr className="pricing-table__row pricing-table__row--base">
              <td className="pricing-table__label">
                <strong>Base Package</strong>
                <span className="pricing-table__desc">
                  Full weekend use of the property (see notes below)
                </span>
              </td>
              <td className="pricing-table__amount">{fmt(BASE_PRICE)}</td>
              <td></td>
            </tr>

            {/* Adjustable rows */}
            {ADJUSTMENTS.map(adj => (
              <tr
                key={adj.id}
                className={`pricing-table__row${checked[adj.id] ? ' is-checked' : ''}`}
              >
                <td className="pricing-table__label">
                  <label className="pricing-table__check-label">
                    <input
                      type="checkbox"
                      className="pricing-table__checkbox"
                      checked={checked[adj.id] ?? false}
                      onChange={() => toggle(adj.id)}
                      aria-describedby={adj.description ? `desc-${adj.id}` : undefined}
                    />
                    <span className="pricing-table__check-text">{adj.label}</span>
                  </label>
                  {adj.description && (
                    <span id={`desc-${adj.id}`} className="pricing-table__desc">{adj.description}</span>
                  )}
                </td>
                <td className="pricing-table__amount" aria-live="polite">
                  <span className={adj.amount < 0 ? 'is-discount' : 'is-surcharge'}>
                    {adj.amount < 0 ? '−' : '+'}{fmt(Math.abs(adj.amount))}
                    {adj.perUnit && checked[adj.id] && ` × ${quantities[adj.id] ?? 1}`}
                  </span>
                </td>
                <td className="pricing-table__qty">
                  {adj.perUnit && checked[adj.id] && (
                    <input
                      type="number"
                      className="pricing-table__qty-input"
                      min="1"
                      max="10"
                      value={quantities[adj.id] ?? 1}
                      onChange={e => setQty(adj.id, parseInt(e.target.value, 10))}
                      aria-label={`Quantity for ${adj.label}`}
                    />
                  )}
                </td>
              </tr>
            ))}

            {/* Fixed fees */}
            <tr className="pricing-table__row pricing-table__row--fixed">
              <td className="pricing-table__label">
                <strong>Damage Deposit</strong>
                <span className="pricing-table__desc">Refundable; not included in package estimate</span>
              </td>
              <td className="pricing-table__amount">{fmt(DAMAGE_DEPOSIT)}</td>
              <td></td>
            </tr>
            <tr className="pricing-table__row pricing-table__row--fixed">
              <td className="pricing-table__label">
                <strong>Retaining Fee</strong>
                <span className="pricing-table__desc">Applied toward final balance; not included in estimate</span>
              </td>
              <td className="pricing-table__amount">{fmt(RETAINING_FEE)}</td>
              <td></td>
            </tr>
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
        .pricing-table__col--amount,
        .pricing-table__col--qty {
          text-align: right;
          white-space: nowrap;
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
        .pricing-table__amount {
          text-align: right;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }
        .pricing-table__total { font-size: var(--text-xl); }
        .is-discount { color: var(--color-available); font-weight: 700; }
        .is-surcharge { color: var(--color-accent-dark); font-weight: 700; }
        .pricing-table__label { min-width: 260px; }
        .pricing-table__check-label {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          cursor: pointer;
          font-weight: 700;
        }
        .pricing-table__checkbox {
          width: 18px;
          height: 18px;
          flex-shrink: 0;
          accent-color: var(--color-primary);
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
