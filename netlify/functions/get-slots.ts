import type { Handler } from '@netlify/functions';
import { getDb } from './utils/mongodb';

/**
 * GET /.netlify/functions/get-slots?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 *
 * Returns all booking slots in the given date range.
 * Booked slots have booking details stripped for privacy (only status returned).
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

  // Validate date format
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRe.test(startDate) || !dateRe.test(endDate)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Dates must be in YYYY-MM-DD format' }),
    };
  }

  try {
    const db = await getDb();
    const collection = db.collection('booking_slots');

    const slots = await collection
      .find({ date: { $gte: startDate, $lte: endDate } })
      .sort({ date: 1, startTime: 1 })
      .toArray();

    // Strip booking details from non-admin responses to protect guest privacy
    const publicSlots = slots.map(({ booking: _booking, ...slot }) => slot);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(publicSlots),
    };
  } catch (err) {
    console.error('[get-slots] Error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
