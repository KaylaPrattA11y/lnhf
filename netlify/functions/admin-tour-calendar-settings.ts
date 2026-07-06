import type { Handler, HandlerContext } from '@netlify/functions';
import { getDb } from './utils/db';
import { isAuthenticated } from './utils/auth';
import {
  ensureTourCalendarSettingsTable,
  getTourCalendarSettings,
  type HolidayMode,
} from './utils/tour-calendar';

const VALID_BUFFER_HOURS = new Set([12, 24, 36, 48]);
const VALID_BOOKING_HORIZON_MONTHS = new Set([1, 2, 3, 4, 5, 6]);
const VALID_HOLIDAY_MODES = new Set<HolidayMode>(['off', 'range', 'indefinite']);

function normalizeMessageHtml(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export const handler: Handler = async (event, context: HandlerContext) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (!(await isAuthenticated(event, context))) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    if (event.httpMethod === 'GET') {
      const settings = await getTourCalendarSettings();
      return { statusCode: 200, headers, body: JSON.stringify({ settings }) };
    }

    if (event.httpMethod !== 'PATCH') {
      return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    const body = JSON.parse(event.body ?? '{}') as {
      bookingBufferHours?: number;
      bookingHorizonMonths?: number;
      holidayMode?: HolidayMode;
      holidayStartAt?: string | null;
      holidayEndAt?: string | null;
      holidayMessageHtml?: string | null;
    };

    const bookingBufferHours = Number(body.bookingBufferHours ?? 24);
    const bookingHorizonMonths = Number(body.bookingHorizonMonths ?? 3);
    const holidayMode = (body.holidayMode ?? 'off') as HolidayMode;
    const holidayStartAt = body.holidayStartAt ? new Date(body.holidayStartAt) : null;
    const holidayEndAt = body.holidayEndAt ? new Date(body.holidayEndAt) : null;
    const holidayMessageHtml = normalizeMessageHtml(body.holidayMessageHtml);

    if (!VALID_BUFFER_HOURS.has(bookingBufferHours)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'bookingBufferHours must be one of 12, 24, 36, or 48' }) };
    }

    if (!VALID_BOOKING_HORIZON_MONTHS.has(bookingHorizonMonths)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'bookingHorizonMonths must be between 1 and 6' }) };
    }

    if (!VALID_HOLIDAY_MODES.has(holidayMode)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "holidayMode must be 'off', 'range', or 'indefinite'" }) };
    }

    if (holidayMode === 'range') {
      if (!holidayStartAt || !holidayEndAt || Number.isNaN(holidayStartAt.getTime()) || Number.isNaN(holidayEndAt.getTime())) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'holidayStartAt and holidayEndAt are required for range mode' }) };
      }
      if (holidayEndAt <= holidayStartAt) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'holidayEndAt must be after holidayStartAt' }) };
      }
    }

    await ensureTourCalendarSettingsTable();

    await getDb().sql`
      INSERT INTO tour_calendar_settings (
        id,
        booking_buffer_hours,
        booking_horizon_months,
        holiday_mode,
        holiday_start_at,
        holiday_end_at,
        holiday_message_html,
        updated_at
      )
      VALUES (
        TRUE,
        ${bookingBufferHours},
        ${bookingHorizonMonths},
        ${holidayMode},
        ${holidayMode === 'range' ? holidayStartAt?.toISOString() ?? null : null},
        ${holidayMode === 'range' ? holidayEndAt?.toISOString() ?? null : null},
        ${holidayMessageHtml},
        NOW()
      )
      ON CONFLICT (id) DO UPDATE
      SET
        booking_buffer_hours = EXCLUDED.booking_buffer_hours,
        booking_horizon_months = EXCLUDED.booking_horizon_months,
        holiday_mode = EXCLUDED.holiday_mode,
        holiday_start_at = EXCLUDED.holiday_start_at,
        holiday_end_at = EXCLUDED.holiday_end_at,
        holiday_message_html = EXCLUDED.holiday_message_html,
        updated_at = NOW()
    `;

    const settings = await getTourCalendarSettings();
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, settings }) };
  } catch (err) {
    console.error('[admin-tour-calendar-settings] Error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
