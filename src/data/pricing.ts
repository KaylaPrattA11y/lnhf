/**
 * Pricing data for the interactive pricing table.
 * Update these values here or promote to TinaCMS when ready.
 * All dollar amounts are estimates — final prices are documented in the signed contract.
 */

export interface PricingAdjustment {
  id: string;
  label: string;
  description?: string;
  amount: number;      // negative = discount, positive = surcharge
  perUnit?: boolean;   // if true, show a quantity input
  defaultChecked?: boolean;
}

export const BASE_PRICE = 7500; // TBD — update with actual current base price

export const DAMAGE_DEPOSIT = 500;  // Fixed (not included in running estimate)
export const RETAINING_FEE  = 2000; // Fixed (not included in running estimate)

export const ADJUSTMENTS: PricingAdjustment[] = [
  {
    id: 'no-friday',
    label: 'Without Friday',
    description: 'Excludes Friday evening setup and early access',
    amount: -1000,
  },
  {
    id: 'no-manor',
    label: 'Without Manor House',
    description: 'Reception barn and grounds only; Manor House rooms not included',
    amount: -1500,
  },
  {
    id: 'less-100',
    label: 'Less than 100 guests',
    description: 'Reduced venue fee for smaller guest lists',
    amount: -750,
  },
  {
    id: 'no-alcohol',
    label: 'Alcohol-free event',
    description: 'No alcoholic beverages served during the event',
    amount: -500,
  },
  {
    id: 'no-ceremony',
    label: 'Without Ceremony',
    description: 'Reception only — ceremony held elsewhere',
    amount: -500,
  },
  {
    id: 'extra-bridal',
    label: 'Additional bridal room',
    description: 'Each additional room beyond what is included',
    amount: 200,
    perUnit: true,
  },
  {
    id: 'military',
    label: 'Military, First Responder, or Teacher',
    description: 'Valid ID required at contract signing',
    amount: -500,
  },
];

export const NOTES = [
  'Above prices are estimates and subject to change without notice. Final prices will be documented in the signed contract.',
  'Base price includes use of restrooms, tables, chairs, benches, firepit, and on-site decorative accessories (wine barrels, linens, portable bar, cake/buffet tables, mason jars, shepherd hooks, and choice of two wedding arches).',
  'Base price does not include bartender, DJ, cake, caterer, planner, photographers, or other vendor services.',
  'For an outdoor ceremony only, please call or email us for pricing details.',
];
