import type { Handler, HandlerContext } from '@netlify/functions';
import { getDb, type TourSlot } from './utils/db';
import { isAuthenticated } from './utils/auth';
import {
  getTourCalendarSettings,
  isHolidayModeActiveNow,
  isSlotBeyondBookingHorizon,
  isSlotInsideBuffer,
  isSlotInsideHolidayRange,
  type TourCalendarSettings,
} from './utils/tour-calendar';

/**
 * GET /.netlify/functions/admin-tours
 *
 * Returns all tour slots including full guest details for admin use.
 * Requires a valid Netlify Identity JWT via Authorization: Bearer <token>.
 */
export const handler: Handler = async (event, context: HandlerContext) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (!(await isAuthenticated(event, context))) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const { startDate, endDate } = event.queryStringParameters ?? {};

  try {
    const settings = await getTourCalendarSettings();
    const calendarDisabledIndefinitely = settings.holidayMode === 'indefinite' && isHolidayModeActiveNow(settings);

    const slots = startDate && endDate
      ? await getDb().sql`
          SELECT
            id                AS "_id",
            date::text        AS date,
            start_time        AS "startTime",
            end_time          AS "endTime",
            status,
            CASE WHEN guest_name IS NOT NULL THEN jsonb_build_object(
              'name',       guest_name,
              'email',      guest_email,
              'phone',      guest_phone,
              'partySize',  guest_party_size,
              'message',    guest_message,
              'bookedAt',   booked_at
            ) END AS tour
          FROM tour_slots
          WHERE date >= ${startDate} AND date <= ${endDate}
          ORDER BY date, start_time
        `
      : await getDb().sql`
          SELECT
            id                AS "_id",
            date::text        AS date,
            start_time        AS "startTime",
            end_time          AS "endTime",
            status,
            CASE WHEN guest_name IS NOT NULL THEN jsonb_build_object(
              'name',       guest_name,
              'email',      guest_email,
              'phone',      guest_phone,
              'partySize',  guest_party_size,
              'message',    guest_message,
              'bookedAt',   booked_at
            ) END AS tour
          FROM tour_slots
          ORDER BY date, start_time
        `;

    function toSlotDateTime(date: string | Date, startTime: string): Date {
      const dateStr = typeof date === 'string' ? date : date.toISOString().slice(0, 10);
      return new Date(`${dateStr}T${startTime}`);
    }

    const now = new Date();

    function getVisitorVisibility(slot: TourSlot, settings: TourCalendarSettings, now: Date, calendarDisabledIndefinitely: boolean) {
      if (slot.status !== 'available') {
        return { visitorVisibility: 'not_applicable', visitorVisibilityDetail: null };
      }

      const checks = [
        {
          condition: toSlotDateTime(slot.date, slot.startTime) < now,
          visibility: 'past_date',
          detail: 'Hidden from visitors: This tour slot is in the past.',
        },
        {
          condition: isSlotInsideHolidayRange(slot.date, slot.startTime, settings),
          visibility: 'holiday_mode',
          detail: calendarDisabledIndefinitely
            ? 'Hidden from visitors: Holiday Mode is disabling the calendar indefinitely.'
            : 'Hidden from visitors: This tour slot falls inside the configured Holiday Mode date range.',
        },
        {
          condition: isSlotInsideBuffer(slot.date, slot.startTime, settings.bookingBufferHours, now),
          visibility: 'booking_buffer',
          detail: `Hidden from visitors: This tour slot is inside the ${settings.bookingBufferHours}-hour Booking Buffer.`,
        },
        {
          condition: isSlotBeyondBookingHorizon(slot.date, slot.startTime, settings.bookingHorizonMonths, now),
          visibility: 'booking_horizon',
          detail: `Hidden from visitors: This tour slot is outside the ${settings.bookingHorizonMonths}-month Booking Horizon.`,
        },
      ];

      const matched = checks.find((check) => check.condition);

      return matched
        ? { visitorVisibility: matched.visibility, visitorVisibilityDetail: matched.detail }
        : { visitorVisibility: 'visible', visitorVisibilityDetail: 'Visible to visitors for online booking.' };
    }

    const transformedSlots = slots.map((slot) => ({
      ...slot,
      ...getVisitorVisibility(slot as TourSlot, settings, now, calendarDisabledIndefinitely),
    }));

    return { statusCode: 200, headers, body: JSON.stringify(transformedSlots) };
  } catch (err) {
    console.error('[admin-tours] Error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
