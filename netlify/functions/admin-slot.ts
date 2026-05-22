import type { Handler, HandlerContext } from '@netlify/functions';
import { getDb } from './utils/db';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const VALID_STATUSES = ['available', 'booked', 'blocked'];

/**
 * Admin slot management endpoint.
 * All methods require Netlify Identity JWT.
 *
 * POST   — add a new slot  { date, startTime, endTime, status?, booking? }
 * PATCH  — update a slot   { id, status? } or { id, unbook: true }
 * DELETE — delete a slot   { id }
 */
export const handler: Handler = async (event, context: HandlerContext) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  // Auth guard
  const { clientContext } = context as { clientContext?: { user?: { email: string } } };
  if (!clientContext?.user) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(event.body ?? '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  try {
    // ── CREATE ────────────────────────────────────────────────
    if (event.httpMethod === 'POST') {
      const { date, startTime, endTime, status = 'available', booking: bookingInput } = body as {
        date: string; startTime: string; endTime: string; status?: string;
        booking?: { name: string; email: string; phone?: string; partySize?: number; message?: string };
      };

      if (!date || !startTime || !endTime) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'date, startTime, and endTime are required' }) };
      }

      if (!DATE_RE.test(date) || !TIME_RE.test(startTime) || !TIME_RE.test(endTime)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid date/time format' }) };
      }

      if (!VALID_STATUSES.includes(status as string)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'status must be available, blocked, or booked' }) };
      }

      if (status === 'booked') {
        if (!bookingInput?.name?.trim() || !bookingInput?.email?.trim()) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Guest name and email are required for booked slots' }) };
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bookingInput.email)) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid guest email address' }) };
        }
      }

      const [slot] = await getDb().sql`
        INSERT INTO booking_slots
          (date, start_time, end_time, status,
           booking_name, booking_email, booking_phone, booking_party_size, booking_message, booked_at)
        VALUES (
          ${date}, ${startTime}, ${endTime}, ${status},
          ${bookingInput?.name?.trim() ?? null},
          ${bookingInput?.email?.trim().toLowerCase() ?? null},
          ${bookingInput?.phone?.trim() ?? null},
          ${bookingInput?.partySize ?? null},
          ${bookingInput?.message?.trim() ?? null},
          ${status === 'booked' ? new Date().toISOString() : null}
        )
        ON CONFLICT (date, start_time) DO NOTHING
        RETURNING id AS "_id"
      `;

      if (!slot) {
        return { statusCode: 409, headers, body: JSON.stringify({ error: `A slot for ${date} at ${startTime} already exists` }) };
      }

      return { statusCode: 201, headers, body: JSON.stringify({ id: slot._id }) };
    }

    // ── UPDATE ────────────────────────────────────────────────
    if (event.httpMethod === 'PATCH') {
      const { id, status, unbook } = body as { id: string; status?: string; unbook?: boolean };

      if (!id || !UUID_RE.test(id)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Valid id is required' }) };
      }

      if (unbook) {
        const [slot] = await getDb().sql`
          UPDATE booking_slots
          SET status = 'available',
              booking_name = NULL, booking_email = NULL, booking_phone = NULL,
              booking_party_size = NULL, booking_message = NULL, booked_at = NULL
          WHERE id = ${id}
          RETURNING id AS "_id", date, start_time AS "startTime", end_time AS "endTime", status
        `;
        if (!slot) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Slot not found' }) };
        return { statusCode: 200, headers, body: JSON.stringify(slot) };
      }

      if (!status) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Nothing to update' }) };
      }

      if (!VALID_STATUSES.includes(status)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid status value' }) };
      }

      const [slot] = await getDb().sql`
        UPDATE booking_slots SET status = ${status}
        WHERE id = ${id}
        RETURNING id AS "_id", date, start_time AS "startTime", end_time AS "endTime", status
      `;
      if (!slot) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Slot not found' }) };
      return { statusCode: 200, headers, body: JSON.stringify(slot) };
    }

    // ── DELETE ────────────────────────────────────────────────
    if (event.httpMethod === 'DELETE') {
      const { id } = body as { id: string };

      if (!id || !UUID_RE.test(id)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Valid id is required' }) };
      }

      const [deleted] = await getDb().sql`DELETE FROM booking_slots WHERE id = ${id} RETURNING id`;
      if (!deleted) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Slot not found' }) };
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    console.error('[admin-slot] Error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
