import type { Handler, HandlerContext } from '@netlify/functions';
import { getDb } from './utils/db';
import { isAuthenticated } from './utils/auth';

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
    const slots = startDate && endDate
      ? await getDb().sql`
          SELECT
            id                AS "_id",
            date,
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
            date,
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

    return { statusCode: 200, headers, body: JSON.stringify(slots) };
  } catch (err) {
    console.error('[admin-tours] Error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
