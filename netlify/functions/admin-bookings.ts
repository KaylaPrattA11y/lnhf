import type { Handler, HandlerContext } from '@netlify/functions';
import { getDb } from './utils/mongodb';

/**
 * GET /.netlify/functions/admin-bookings
 *
 * Returns all booking slots (including full booking details) for admin use.
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

  // Netlify Identity auth check
  const { clientContext } = context as { clientContext?: { user?: { email: string; app_metadata?: { roles?: string[] } } } };
  if (!clientContext?.user) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const { startDate, endDate } = event.queryStringParameters ?? {};

  try {
    const db = await getDb();
    const collection = db.collection('booking_slots');

    const filter: Record<string, unknown> = {};
    if (startDate && endDate) {
      filter.date = { $gte: startDate, $lte: endDate };
    }

    const slots = await collection
      .find(filter)
      .sort({ date: 1, startTime: 1 })
      .toArray();

    return { statusCode: 200, headers, body: JSON.stringify(slots) };
  } catch (err) {
    console.error('[admin-bookings] Error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
