import { createHash } from 'node:crypto';
import type { Handler } from '@netlify/functions';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const NEW_YORK_TZ = 'America/New_York';

function sanitize(value: string | null | undefined, fallback: string, max = 200) {
  const next = (value ?? '').trim();
  return (next || fallback).slice(0, max);
}

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function toIcsDateTime(date: string, time: string) {
  return `${date.replace(/-/g, '')}T${time.replace(':', '')}00`;
}

function toSlug(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'tour-calendar-event';
}

export const handler: Handler = async (event) => {
  const headers = {
    'Content-Type': 'text/calendar; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Cache-Control': 'no-store',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const query = event.queryStringParameters ?? {};
  const date = query.date ?? '';
  const startTime = query.startTime ?? '';
  const endTime = query.endTime ?? '';

  if (!DATE_RE.test(date) || !TIME_RE.test(startTime) || !TIME_RE.test(endTime)) {
    return {
      statusCode: 400,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'date, startTime, and endTime are required in YYYY-MM-DD and HH:mm format' }),
    };
  }

  const title = sanitize(query.title, 'Tour at Lower Notley Hall Farm', 160);
  const description = sanitize(query.description, '', 500);
  const location = sanitize(query.location, 'Lower Notley Hall Farm, 36290 Notley Manor Ln, Chaptico, MD 20621', 200);
  const uidSeed = `${date}|${startTime}|${endTime}|${title}|${location}`;
  const uid = `${createHash('sha1').update(uidSeed).digest('hex')}@lowernotleyhallfarm.com`;
  const nowStamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

  const eventLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lower Notley Hall Farm//Tour Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${nowStamp}`,
    `SUMMARY:${escapeIcsText(title)}`,
    `DTSTART;TZID=${NEW_YORK_TZ}:${toIcsDateTime(date, startTime)}`,
    `DTEND;TZID=${NEW_YORK_TZ}:${toIcsDateTime(date, endTime)}`,
    `LOCATION:${escapeIcsText(location)}`,
    description ? `DESCRIPTION:${escapeIcsText(description)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  const filenameBase = sanitize(query.filename, toSlug(title), 80);
  const filename = `${toSlug(filenameBase)}.ics`;

  return {
    statusCode: 200,
    headers: {
      ...headers,
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
    body: eventLines.join('\r\n') + '\r\n',
  };
};
