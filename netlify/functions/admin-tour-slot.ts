import type { Handler, HandlerContext } from '@netlify/functions';
import { getDb } from './utils/db';
import { isAuthenticated } from './utils/auth';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const VALID_STATUSES = ['available', 'booked', 'blocked'];

/**
 * Admin tour slot management endpoint.
 * All methods require Netlify Identity JWT.
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

  if (!(await isAuthenticated(event, context))) {
    return { 
      statusCode: 401, 
      headers, 
      body: JSON.stringify({ error: 'Unauthorized' }) 
    };
  }

  // Parse body safely
  let body: Record<string, unknown> = {};
  if (event.body) {
    try {
      body = JSON.parse(event.body);
    } catch {
      return { 
        statusCode: 400, 
        headers, 
        body: JSON.stringify({ error: 'Invalid JSON' }) 
      };
    }
  }

  try {
    if (event.httpMethod === 'POST') {
      const { date, startTime, endTime, status = 'available', tour: tourInput } = body as any;

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
        if (!tourInput?.name?.trim() || !tourInput?.email?.trim()) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Guest name and email are required for booked slots' }) };
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tourInput.email)) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid guest email address' }) };
        }
      }

      const [slot] = await getDb().sql`
        INSERT INTO tour_slots
          (date, start_time, end_time, status,
           guest_name, guest_email, guest_phone, guest_party_size, guest_message, booked_at)
        VALUES (
          ${date}, ${startTime}, ${endTime}, ${status},
          ${tourInput?.name?.trim() ?? null},
          ${tourInput?.email?.trim().toLowerCase() ?? null},
          ${tourInput?.phone?.trim() ?? null},
          ${tourInput?.partySize ?? null},
          ${tourInput?.message?.trim() ?? null},
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

    if (event.httpMethod === 'PATCH') {
      const { id, status, unbook, date, startTime, endTime, tour: tourInput } = body as any;

      if (!id || !UUID_RE.test(id)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Valid id is required' }) };
      }

      if (unbook) {
        const [slot] = await getDb().sql`
          UPDATE tour_slots
          SET status = 'available',
              guest_name = NULL,
              guest_email = NULL,
              guest_phone = NULL,
              guest_party_size = NULL,
              guest_message = NULL,
              booked_at = NULL
          WHERE id = ${id}
          RETURNING id AS "_id", date, start_time AS "startTime", end_time AS "endTime", status
        `;
        if (!slot) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Slot not found' }) };
        return { statusCode: 200, headers, body: JSON.stringify(slot) };
      }

      const hasDetailedUpdate = date || startTime || endTime || typeof tourInput !== 'undefined';

      if (hasDetailedUpdate) {
        if (!date || !startTime || !endTime) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'date, startTime, and endTime are required for detailed updates' }) };
        }

        if (!DATE_RE.test(date) || !TIME_RE.test(startTime) || !TIME_RE.test(endTime)) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid date/time format' }) };
        }

        const nextStatus = status ?? 'booked';

        if (!VALID_STATUSES.includes(nextStatus)) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid status value' }) };
        }

        if (nextStatus === 'booked') {
          if (!tourInput?.name?.trim() || !tourInput?.email?.trim()) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Guest name and email are required for booked slots' }) };
          }

          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tourInput.email)) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid guest email address' }) };
          }
        }

        try {
          const [slot] = await getDb().sql`
            UPDATE tour_slots
            SET
              date = ${date},
              start_time = ${startTime},
              end_time = ${endTime},
              status = ${nextStatus},
              guest_name = ${nextStatus === 'booked' ? tourInput?.name?.trim() ?? null : null},
              guest_email = ${nextStatus === 'booked' ? tourInput?.email?.trim().toLowerCase() ?? null : null},
              guest_phone = ${nextStatus === 'booked' ? tourInput?.phone?.trim() ?? null : null},
              guest_party_size = ${nextStatus === 'booked' ? tourInput?.partySize ?? null : null},
              guest_message = ${nextStatus === 'booked' ? tourInput?.message?.trim() ?? null : null},
              booked_at = CASE
                WHEN ${nextStatus} = 'booked' THEN COALESCE(booked_at, NOW())
                ELSE NULL
              END
            WHERE id = ${id}
            RETURNING id AS "_id", date, start_time AS "startTime", end_time AS "endTime", status
          `;

          if (!slot) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Slot not found' }) };
          return { statusCode: 200, headers, body: JSON.stringify(slot) };
        } catch (err: any) {
          if (err?.code === '23505') {
            return { statusCode: 409, headers, body: JSON.stringify({ error: `A slot for ${date} at ${startTime} already exists` }) };
          }

          throw err;
        }
      }

      if (!status) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Nothing to update' }) };
      }

      if (!VALID_STATUSES.includes(status)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid status value' }) };
      }

      const [slot] = await getDb().sql`
        UPDATE tour_slots SET status = ${status}
        WHERE id = ${id}
        RETURNING id AS "_id", date, start_time AS "startTime", end_time AS "endTime", status
      `;
      if (!slot) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Slot not found' }) };
      return { statusCode: 200, headers, body: JSON.stringify(slot) };
    }

    if (event.httpMethod === 'DELETE') {
      console.log('DELETE request received. Query:', event.queryStringParameters);
      
      const id = event.queryStringParameters?.id;

      if (!id || !UUID_RE.test(id)) {
        console.log('DELETE failed: No valid id provided');
        return { 
          statusCode: 400, 
          headers, 
          body: JSON.stringify({ error: 'Valid id is required' }) 
        };
      }

      const [deleted] = await getDb().sql`
        DELETE FROM tour_slots 
        WHERE id = ${id} 
        RETURNING id
      `;

      if (!deleted) {
        return { 
          statusCode: 404, 
          headers, 
          body: JSON.stringify({ error: 'Slot not found' }) 
        };
      }

      return { 
        statusCode: 200, 
        headers, 
        body: JSON.stringify({ success: true, message: 'Slot deleted successfully' }) 
      };
    }

    return { 
      statusCode: 405, 
      headers, 
      body: JSON.stringify({ error: 'Method not allowed' }) 
    };

  } catch (err) {
    console.error('[admin-tour-slot] Error:', err);
    return { 
      statusCode: 500, 
      headers, 
      body: JSON.stringify({ error: 'Internal server error' }) 
    };
  }
};