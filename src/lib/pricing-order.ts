export interface SortablePricingEntry {
  id?: string;
  name: string;
  feeType: 'static' | 'dynamic';
  sortOrder?: number;
}

/**
 * Sorts pricing entries first by fee type (dynamic/add-on before static/base), then by sort order (ascending, with undefined treated as 99), then by name (alphabetically), and finally by id (alphabetically, with undefined treated as an empty string).
 * @param a
 * @param b 
 * @returns A negative number if a should come before b, a positive number if a should come after b, or 0 if they are considered equal in sorting order.
 */
export function comparePricingEntries(
  a: SortablePricingEntry,
  b: SortablePricingEntry,
): number {
  if (a.feeType !== b.feeType) {
    return a.feeType === 'dynamic' ? -1 : 1;
  }

  const bySortOrder = (a.sortOrder ?? 99) - (b.sortOrder ?? 99);
  if (bySortOrder !== 0) return bySortOrder;

  const byName = a.name.localeCompare(b.name);
  if (byName !== 0) return byName;

  return (a.id ?? '').localeCompare(b.id ?? '');
}
