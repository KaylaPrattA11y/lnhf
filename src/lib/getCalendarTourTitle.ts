export default function getCalendarTourTitle(guestName?: string): string {
  return `LNHF Tour${guestName ? `: ${guestName}` : ''}`;
}