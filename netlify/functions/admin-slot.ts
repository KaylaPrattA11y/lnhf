import type { Handler, HandlerContext } from '@netlify/functions';
import { ObjectId } from 'mongodb';
import { getDb } from './utils/mongodb';

/**
 * Admin slot management endpoint.
 * All methods require Netlify Identity JWT.
 *
 * POST   — add a new slot  { date, startTime, endTime, status? }
 * PATCH  — update a slot   { id, status?, booking? (null to unbook) }
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
    const db = await getDb();
    const collection = db.collection('booking_slots');

    // ── CREATE ────────────────────────────────────────────────
    if (event.httpMethod === 'POST') {
      const { date, startTime, endTime, status = 'available', booking: bookingInput } = body as {
        date: string; startTime: string; endTime: string; status?: string;
        booking?: { name: string; email: string; phone?: string; partySize?: number; message?: string };
      };

      if (!date || !startTime || !endTime) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'date, startTime, and endTime are required' }),
        };
      }

      const dateRe = /^\d{4}-\d{2}-\d{2}$/;
      const timeRe = /^\d{2}:\d{2}$/;
      if (!dateRe.test(date) || !timeRe.test(startTime) || !timeRe.test(endTime)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid date/time format' }),
        };
      }

      const validStatuses = ['available', 'blocked', 'booked'];
      if (!validStatuses.includes(status as string)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'status must be available, blocked, or booked' }),
        };
      }

      if (status === 'booked') {
        if (!bookingInput?.name?.trim() || !bookingInput?.email?.trim()) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Guest name and email are required for booked slots' }),
          };
        }
        const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRe.test(bookingInput.email)) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid guest email address' }),
          };
        }
      }

      const doc: Record<string, unknown> = { date, startTime, endTime, status };
      if (status === 'booked' && bookingInput) {
        doc.booking = {
          name: bookingInput.name.trim(),
          email: bookingInput.email.trim().toLowerCase(),
          ...(bookingInput.phone ? { phone: bookingInput.phone.trim() } : {}),
          ...(bookingInput.partySize ? { partySize: Number(bookingInput.partySize) } : {}),
          ...(bookingInput.message ? { message: bookingInput.message.trim() } : {}),
          bookedAt: new Date().toISOString(),
        };
      }

      const result = await collection.insertOne(doc);
      return { statusCode: 201, headers, body: JSON.stringify({ id: result.insertedId }) };
    }

    // ── UPDATE ────────────────────────────────────────────────
    if (event.httpMethod === 'PATCH') {
      const { id, status, unbook } = body as {
        id: string; status?: string; unbook?: boolean;
      };

      if (!id || !ObjectId.isValid(id)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Valid id is required' }) };
      }

      const update: Record<string, unknown> = {};

      if (status) {
        const validStatuses = ['available', 'booked', 'blocked'];
        if (!validStatuses.includes(status)) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid status value' }),
          };
        }
        update['status'] = status;
      }

      // Unbook: restore to available and remove booking details
      if (unbook) {
        const result = await collection.findOneAndUpdate(
          { _id: new ObjectId(id) },
          { $set: { status: 'available' }, $unset: { booking: '' } },
          { returnDocument: 'after' }
        );
        if (!result) {
          return { statusCode: 404, headers, body: JSON.stringify({ error: 'Slot not found' }) };
        }
        return { statusCode: 200, headers, body: JSON.stringify(result) };
      }

      if (Object.keys(update).length === 0) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Nothing to update' }) };
      }

      const result = await collection.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: update },
        { returnDocument: 'after' }
      );

      if (!result) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Slot not found' }) };
      }

      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // ── DELETE ────────────────────────────────────────────────
    if (event.httpMethod === 'DELETE') {
      const { id } = body as { id: string };

      if (!id || !ObjectId.isValid(id)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Valid id is required' }) };
      }

      const result = await collection.deleteOne({ _id: new ObjectId(id) });

      if (result.deletedCount === 0) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Slot not found' }) };
      }

      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    console.error('[admin-slot] Error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
