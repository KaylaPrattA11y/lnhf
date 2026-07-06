import type { Handler } from '@netlify/functions';
import { getDb } from './utils/db';
import {
  getTourCalendarSettings,
  isSlotInsideHolidayRange,
  isSlotInsideBuffer,
  isSlotBeyondBookingHorizon,
} from './utils/tour-calendar';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface TourBookingPayload {
  slotId: string;
  name: string;
  email: string;
  phone?: string;
  partySize?: number;
  message?: string;
}

/**
 * POST /.netlify/functions/create-tour-booking
 *
 * Atomically claims an available tour slot. If another request claims
 * the same slot first, this returns 409 Conflict.
 */
export const handler: Handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let payload: TourBookingPayload;
  try {
    payload = JSON.parse(event.body ?? '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { slotId, name, email } = payload;

  if (!slotId || !name || !email) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'slotId, name, and email are required' }),
    };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid email address' }),
    };
  }

  if (!UUID_RE.test(slotId)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid slotId' }) };
  }

  try {
    const settings = await getTourCalendarSettings();

    const [slotRecord] = await getDb().sql`
      SELECT
        id,
        date,
        start_time AS "startTime",
        end_time AS "endTime",
        status
      FROM tour_slots
      WHERE id = ${slotId}
      LIMIT 1
    `;

    if (!slotRecord) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'That time slot no longer exists. Please pick another time.' }),
      };
    }

    const blockedByHoliday = isSlotInsideHolidayRange(slotRecord.date, slotRecord.startTime, settings);
    if (blockedByHoliday) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({
          error: 'Tour booking is temporarily unavailable right now. Please contact Jack and Cindy on the contact page.',
          code: 'HOLIDAY_MODE_ACTIVE',
        }),
      };
    }

    const blockedByBuffer = isSlotInsideBuffer(slotRecord.date, slotRecord.startTime, settings.bookingBufferHours);
    if (blockedByBuffer) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({
          error: `This tour slot is inside the ${settings.bookingBufferHours}-hour booking window and can no longer be booked online.`,
          code: 'BOOKING_WINDOW_ELAPSED',
        }),
      };
    }

    const blockedByHorizon = isSlotBeyondBookingHorizon(
      slotRecord.date,
      slotRecord.startTime,
      settings.bookingHorizonMonths,
    );
    if (blockedByHorizon) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({
          error: `This tour slot is outside the ${settings.bookingHorizonMonths}-month booking horizon and cannot be booked online yet.`,
          code: 'BOOKING_HORIZON_EXCEEDED',
        }),
      };
    }

    const [slot] = await getDb().sql`
      UPDATE tour_slots
      SET
        status           = 'booked',
        guest_name       = ${name.trim().substring(0, 100)},
        guest_email      = ${email.trim().toLowerCase().substring(0, 254)},
        guest_phone      = ${payload.phone?.trim().substring(0, 20) ?? null},
        guest_party_size = ${payload.partySize ?? null},
        guest_message    = ${payload.message?.trim().substring(0, 1000) ?? null},
        booked_at        = NOW()
      WHERE id = ${slotId} AND status = 'available'
      RETURNING
        id         AS "_id",
        date,
        start_time AS "startTime",
        end_time   AS "endTime"
    `;

    if (!slot) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({
          error: 'This slot was just booked by someone else. Please select another time.',
          code: 'SLOT_UNAVAILABLE',
        }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, slot }),
    };
  } catch (err) {
    console.error('[create-tour-booking] Error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
