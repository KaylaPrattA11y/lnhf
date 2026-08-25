const TOUR_TIME_ZONE = 'America/New_York';
const DEFAULT_EVENT_TITLE = 'LNHF Tour';
const DEFAULT_EVENT_LOCATION = 'Lower Notley Hall Farm, 36290 Notley Manor Ln, Chaptico, MD 20621';

export interface CalendarEventInput {
  date: string;
  startTime: string;
  endTime: string;
  title?: string;
  description?: string;
  location?: string;
  filename?: string;
}

function toCompactDate(date: string) {
  return date.replace(/-/g, '');
}

function toCompactTime(time: string) {
  return time.replace(':', '') + '00';
}

function formatGoogleDateTime(date: string, time: string) {
  return `${toCompactDate(date)}T${toCompactTime(time)}`;
}

export function buildGoogleCalendarUrl(input: CalendarEventInput) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: input.title ?? DEFAULT_EVENT_TITLE,
    dates: `${formatGoogleDateTime(input.date, input.startTime)}/${formatGoogleDateTime(input.date, input.endTime)}`,
    details: input.description ?? '',
    location: input.location ?? DEFAULT_EVENT_LOCATION,
    ctz: TOUR_TIME_ZONE,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildIcsDownloadUrl(input: CalendarEventInput, siteBaseUrl = '') {
  const params = new URLSearchParams({
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    title: input.title ?? DEFAULT_EVENT_TITLE,
    description: input.description ?? '',
    location: input.location ?? DEFAULT_EVENT_LOCATION,
  });

  if (input.filename) {
    params.set('filename', input.filename);
  }

  return `${siteBaseUrl}/.netlify/functions/tour-calendar-ics?${params.toString()}`;
}

export function formatCalendarDateLabel(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatCalendarTimeLabel(time: string) {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, '0')} ${period}`;
}
