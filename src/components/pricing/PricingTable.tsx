import { useMemo, useState } from 'react';
import { NOTES } from '../../data/pricing';
import { comparePricingEntries } from '../../lib/pricing-order';

interface PricingTableEntry {
  id: string;
  name: string;
  feeType: 'static' | 'dynamic';
  isChecked: boolean;
  adjustment: number;
  perUnit: boolean;
  sortOrder: number;
  description?: string;
  maxUnits?: number; // only used if perUnit is true
  billingTreatment?: 'includedInTotals' | 'returnedLater' | 'informationalOnly';
}

interface PricingTableProps {
  entries: PricingTableEntry[];
}

function buildDefaultChecked(entries: PricingTableEntry[]) {
  return entries.reduce<Record<string, boolean>>((acc, ent) => {
    if (ent.feeType === 'dynamic') {
      acc[ent.name] = ent.isChecked;
    }
    return acc;
  }, {});
}

export default function PricingTable({ entries }: PricingTableProps) {
  const orderedEntries = useMemo(
    () => [...entries].sort(comparePricingEntries),
    [entries],
  );

  const [checked, setChecked] = useState<Record<string, boolean>>(() => buildDefaultChecked(orderedEntries));
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const getBillingTreatment = (ent: PricingTableEntry) => {
    return ent.billingTreatment ?? 'includedInTotals';
  };

  const isEntryChecked = (ent: PricingTableEntry) => {
    if (ent.feeType === 'static') return true;
    return checked[ent.name] ?? ent.isChecked;
  };

  const selectedEntries = orderedEntries.filter((ent) => {
    if (getBillingTreatment(ent) === 'informationalOnly') return false;
    return isEntryChecked(ent);
  });

  const totalCost = selectedEntries.reduce((sum, ent) => {
    const qty = ent.perUnit && ent.feeType === 'dynamic' ? (quantities[ent.name] ?? 1) : 1;
    return sum + ent.adjustment * qty;
  }, 0);

  const refundableTotal = selectedEntries.reduce((sum, ent) => {
    if (getBillingTreatment(ent) !== 'returnedLater') return sum;
    const qty = ent.perUnit && ent.feeType === 'dynamic' ? (quantities[ent.name] ?? 1) : 1;
    return sum + ent.adjustment * qty;
  }, 0);

  const netCost = totalCost - refundableTotal;

  const toggle = (entry: PricingTableEntry) => {
    const wasChecked = isEntryChecked(entry);
    setChecked(prev => ({ ...prev, [entry.name]: !wasChecked }));
    if (!wasChecked && !quantities[entry.name]) {
      setQuantities(prev => ({ ...prev, [entry.name]: 1 }));
    }
  };

  const setQty = (name: string, qty: number, max?: number) => {
    const clamped = Math.min(Math.max(1, qty), max ?? Infinity);
    setQuantities(prev => ({ ...prev, [name]: clamped }));
  };

  const fmt = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  const getEntryQuantity = (entry: PricingTableEntry) => (
    entry.perUnit && entry.feeType === 'dynamic' ? (quantities[entry.name] ?? 1) : 1
  );

  const getEntryTotal = (entry: PricingTableEntry) => entry.adjustment * getEntryQuantity(entry);

  const selectedLineItems = selectedEntries.map((entry) => ({
    name: entry.name,
    quantity: getEntryQuantity(entry),
    total: getEntryTotal(entry),
  }));

  const canShareEstimate = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const escapeHtml = (value: string) => value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  const handlePrint = () => {
    const win = window.open('about:blank', '_blank');
    if (!win) return;

    const rows = selectedLineItems.map((item) => `
      <tr>
        <td>${escapeHtml(item.name)}${item.quantity > 1 ? ` x ${item.quantity}` : ''}</td>
        <td>${escapeHtml(fmt(item.total))}</td>
      </tr>
    `).join('');

    win.document.open();
    win.document.write(`
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Lower Notley Hall Farm - Custom Estimate</title>
          <style>
            body { font-family: Arial, Helvetica, sans-serif; margin: 24px; color: #1f2937; }
            .header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
            .header img { width: 44px; height: 44px; object-fit: contain; }
            .header-title { font-weight: 700; font-size: 16px; line-height: 1.3; }
            .header-subtitle { font-weight: 700; font-size: 18px; margin-top: 2px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border: 1px solid #d1d5db; padding: 8px 10px; text-align: left; }
            th:last-child, td:last-child { text-align: right; white-space: nowrap; }
            tfoot td { font-weight: 700; }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="${window.location.origin}/images/logo.svg" alt="Lower Notley Hall Farm" />
            <div>
              <div class="header-title">Lower Notley Hall Farm: Southern Maryland Waterfront Weddings</div>
              <div class="header-subtitle">Custom Estimate</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Feature</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
            <tfoot>
              <tr>
                <td>Total Amount Due (including refundable items)</td>
                <td>${escapeHtml(fmt(totalCost))}</td>
              </tr>
              <tr>
                <td>Net Cost After Refundable Amounts Are Returned</td>
                <td>${escapeHtml(fmt(netCost))}</td>
              </tr>
            </tfoot>
          </table>
        </body>
      </html>
    `);
    win.document.close();

    const triggerPrint = () => {
      win.focus();
      win.print();
    };

    // Print after the new document is fully parsed/rendered to avoid blank-tab prints.
    win.addEventListener('load', triggerPrint, { once: true });
    win.addEventListener('afterprint', () => win.close(), { once: true });

    // Fallback for browsers where load does not fire reliably for document.write content.
    window.setTimeout(triggerPrint, 250);
  };

  const shareEstimate = async () => {
    if (!canShareEstimate) return;

    const lines = [
      'Lower Notley Hall Farm: Southern Maryland Waterfront Weddings',
      'Custom Estimate',
      '',
      ...selectedLineItems.map((item) => `- ${item.name}${item.quantity > 1 ? ` x ${item.quantity}` : ''}: ${fmt(item.total)}`),
      '',
      `Total Amount Due: ${fmt(totalCost)}`,
      `Net Cost: ${fmt(netCost)}`,
    ];

    try {
      await navigator.share({
        title: 'Lower Notley Hall Farm: Custom Estimate',
        text: lines.join('\n'),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      console.error('Unable to share estimate:', error);
    }
  };

  return (
    <div className="pricing-tool">
      <div className="pricing-tool__table-wrap">
        <table className="pricing-table" aria-label="Wedding pricing estimator">
          <caption>
            Check and uncheck the features below to estimate the cost of your event at Lower Notley Hall Farm.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="pricing-table__col--option">Feature</th>
              <th scope="col" className="pricing-table__col--amount">Adjustment</th>
              <th scope="col" className="pricing-table__col--qty">Qty</th>
            </tr>
          </thead>
          <tbody>
            {/* Adjustable rows */}
            {orderedEntries.map(ent => (
              <tr
                key={ent.name}
                className={`pricing-table__row${isEntryChecked(ent) ? ' is-checked' : ''}${ent.feeType === 'static' ? ' is-static' : ''}`}
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
                      checked={isEntryChecked(ent)}
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
                    {ent.perUnit && isEntryChecked(ent) && ` × ${quantities[ent.name] ?? 1}`}
                  </span>
                  {getBillingTreatment(ent) === 'returnedLater' && <span className="pricing-table__refundable">Refundable</span>}
                </td>
                <td className="pricing-table__qty">
                  {ent.perUnit && isEntryChecked(ent) && (
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
              <td><strong>Total Amount Due (including refundable items)</strong></td>
              <td className="pricing-table__amount pricing-table__total" aria-live="polite">
                <strong>{fmt(totalCost)}</strong>
              </td>
              <td></td>
            </tr>
            <tr className="pricing-table__row pricing-table__row--net">
              <td><strong>Net Cost After Refundable Amounts Are Returned</strong></td>
              <td className="pricing-table__amount pricing-table__total" aria-live="polite">
                <strong>{fmt(netCost)}</strong>
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
          <a href="/contact/">Contact Jack and Cindy</a>{' '}
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
          data-umami-event="Pricing Print/PDF Click"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{marginInlineEnd: '8px'}}>
            <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
          </svg>
          Print / Save as PDF
        </button>
        {canShareEstimate && (
          <button
            type="button"
            className="btn btn--secondary"
            onClick={shareEstimate}
            aria-label="Share this estimate"
          >
            Share Estimate
          </button>
        )}
        <button
          type="button"
          className="btn btn--secondary"
          onClick={() => {
            setChecked(buildDefaultChecked(orderedEntries));
            setQuantities({});
          }}
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
          padding-bottom: calc(var(--space-16) + env(safe-area-inset-bottom));
        }
        .pricing-table tfoot {
          position: fixed;
          left: 50%;
          bottom: max(var(--space-3), env(safe-area-inset-bottom));
          transform: translateX(-50%);
          z-index: 60;
          width: min(680px, calc(100vw - var(--space-4)));
          border: 1px solid color-mix(in srgb, var(--color-gold) 45%, transparent);
          border-radius: var(--radius-md);
          background: color-mix(in srgb, var(--color-primary-dark) 94%, black);
          box-shadow: var(--shadow-lg);
          backdrop-filter: blur(2px);
          overflow: hidden;
          display: block;
        }
        .pricing-table tfoot tr {
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          color: var(--color-white);
          background: transparent;
        }
        .pricing-table tfoot tr + tr {
          border-top: 1px solid color-mix(in srgb, var(--color-white) 18%, transparent);
        }
        .pricing-table tfoot td {
          border: 0;
          padding: var(--space-2) var(--space-4);
          font-size: var(--text-sm);
          line-height: var(--leading-snug);
        }
        .pricing-table tfoot td:empty {
          display: none;
        }
        .pricing-table tfoot td:last-child {
          text-align: right;
        }
        .pricing-table tfoot strong {
          font-size: var(--text-base);
          font-variant-numeric: tabular-nums;
          line-height: var(--leading-snug);
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
        .pricing-table__row--total { background: transparent; color: var(--color-white); }
        .pricing-table__row--net { background: transparent; color: var(--color-white); }
        .pricing-table__row--total td { border: none; }
        .pricing-table__row--net td { border: none; }
        .pricing-table__row.is-checked { background: var(--color-available-bg); }
        
        .pricing-table__total { font-size: var(--text-xl); }
        .pricing-table__refundable {
          display: block;
          margin-top: 2px;
          font-size: var(--text-xs);
          color: var(--color-text-muted);
          font-weight: 600;
        }
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
        .pricing-tool__note--cta p:last-child {
          margin-bottom: 0;
        }
        .pricing-tool__note--cta a { font-weight: 700; }
        .pricing-tool__actions {
          display: flex;
          gap: var(--space-3);
          flex-wrap: wrap;
          margin-bottom: var(--space-8);
          @container (width < 600px) {
            justify-content: center;
            padding-inline: var(--space-4);
          }
        }
        .pricing-tool__notes {
          background: var(--color-gray-100);
          border-radius: var(--radius-lg);
          padding: var(--space-6);
        }
        .pricing-tool__notes > * {
          max-inline-size: 80ch;
          margin-inline: auto;
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
          .pricing-table tfoot {
            width: calc(100vw - var(--space-3));
          }
          .pricing-table tfoot td {
            padding: var(--space-2) var(--space-3);
            font-size: var(--text-xs);
          }
          .pricing-table tfoot strong {
            font-size: var(--text-sm);
          }
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
          .pricing-table tfoot {
            position: static;
            left: auto;
            bottom: auto;
            transform: none;
            width: auto;
            border: 0;
            border-radius: 0;
            box-shadow: none;
            background: transparent;
            backdrop-filter: none;
            display: table-footer-group;
          }
          .pricing-table tfoot tr {
            display: table-row;
            color: inherit;
          }
          .pricing-table tfoot td {
            border: none;
            padding: var(--space-2) var(--space-5);
            font-size: 11pt;
          }
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
