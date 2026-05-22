import type { Handler } from '@netlify/functions';
import { getDb } from './utils/db';

/**
 * GET /.netlify/functions/get-slots?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 *
 * Returns all booking slots in the given date range.
 * Booking details are omitted for privacy.
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
    const slots = await getDb().sql`
      SELECT
        id          AS "_id",
        date,
        start_time  AS "startTime",
        end_time    AS "endTime",
        status
      FROM booking_slots
      WHERE date >= ${startDate} AND date <= ${endDate}
      ORDER BY date, start_time
    `;

    return { statusCode: 200, headers, body: JSON.stringify(slots) };
  } catch (err) {
    console.error('[get-slots] Error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
