import type { Handler } from '@netlify/functions';
import { getDb } from './utils/db';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface BookingPayload {
  slotId: string;
  name: string;
  email: string;
  phone?: string;
  partySize?: number;
  message?: string;
}

/**
 * POST /.netlify/functions/create-booking
 *
 * Atomically claims an available slot, preventing double-booking via
 * a single findOneAndUpdate with a status filter. If another request
 * claims the same slot first, this returns 409 Conflict.
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

  let payload: BookingPayload;
  try {
    payload = JSON.parse(event.body ?? '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { slotId, name, email } = payload;

  // Validate required fields
  if (!slotId || !name || !email) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'slotId, name, and email are required' }),
    };
  }

  // Basic email format validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid email address' }),
    };
  }

  // Validate UUID format to prevent injection
  if (!UUID_RE.test(slotId)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid slotId' }) };
  }

  try {
    // Atomic update — only succeeds if status is still 'available'
    const [slot] = await getDb().sql`
      UPDATE booking_slots
      SET
        status              = 'booked',
        booking_name        = ${name.trim().substring(0, 100)},
        booking_email       = ${email.trim().toLowerCase().substring(0, 254)},
        booking_phone       = ${payload.phone?.trim().substring(0, 20) ?? null},
        booking_party_size  = ${payload.partySize ?? null},
        booking_message     = ${payload.message?.trim().substring(0, 1000) ?? null},
        booked_at           = NOW()
      WHERE id = ${slotId} AND status = 'available'
      RETURNING
        id         AS "_id",
        date,
        start_time AS "startTime",
        end_time   AS "endTime"
    `;

    if (!slot) {
      // Slot was booked by someone else between the guest viewing it and submitting
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({
          error: 'This slot was just booked by someone else. Please select another time.',
        }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, slot }),
    };
  } catch (err) {
    console.error('[create-booking] Error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
