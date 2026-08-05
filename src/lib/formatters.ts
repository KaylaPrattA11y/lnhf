export function fmtUsd(value: number, options?: { minimumFractionDigits?: number; maximumFractionDigits?: number }) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', ...options }).format(value);
}

export function fmtDate(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function fmtTwelveHourTime(d: string) {
  return new Date(`1970-01-01T${d}`).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
  });
}