import type { Handler } from '@netlify/functions';
import { getDb } from './utils/db';
import {
  getTourCalendarSettings,
  isHolidayModeActiveNow,
  isSlotInsideHolidayRange,
  isSlotInsideBuffer,
} from './utils/tour-calendar';

/**
 * GET /.netlify/functions/get-tour-slots?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 *
 * Returns all tour slots in the given date range.
 * Guest details are omitted for privacy.
 */
export const handler: Handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const { startDate, endDate } = event.queryStringParameters ?? {};

  if (!startDate || !endDate) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'startDate and endDate query parameters are required' }),
    };
  }

  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRe.test(startDate) || !dateRe.test(endDate)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Dates must be in YYYY-MM-DD format' }),
    };
  }

  try {
    const settings = await getTourCalendarSettings();
    const calendarFullyDisabled = settings.holidayMode === 'indefinite' && isHolidayModeActiveNow(settings);

    const slots = await getDb().sql`
      SELECT
        id          AS "_id",
        date,
        start_time  AS "startTime",
        end_time    AS "endTime",
        status
      FROM tour_slots
      WHERE date >= ${startDate} AND date <= ${endDate}
      ORDER BY date, start_time
    `;

    const now = new Date();
    const transformedSlots = slots.map((slot) => {
      if (slot.status !== 'available') return slot;

      const blockedByHoliday = isSlotInsideHolidayRange(slot.date, slot.startTime, settings);
      const blockedByBuffer = isSlotInsideBuffer(slot.date, slot.startTime, settings.bookingBufferHours, now);

      if (blockedByHoliday || blockedByBuffer) {
        return { ...slot, status: 'blocked' as const };
      }

      return slot;
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        slots: transformedSlots,
        settings: {
          bookingBufferHours: settings.bookingBufferHours,
          holidayMode: settings.holidayMode,
          holidayStartAt: settings.holidayStartAt,
          holidayEndAt: settings.holidayEndAt,
          holidayMessageHtml: settings.holidayMessageHtml,
          isCalendarDisabled: calendarFullyDisabled,
        },
      }),
    };
  } catch (err) {
    console.error('[get-tour-slots] Error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
