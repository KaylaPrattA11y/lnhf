import type { Handler, HandlerContext } from '@netlify/functions';
import { getWeddingDb } from './utils/db';
import { isAuthenticated } from './utils/auth';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

interface WeddingActivityInput {
  label: string;
  date: string;
  time?: string;
}

interface WeddingPricingItemInput {
  sourceType: 'collection' | 'custom';
  entryKey?: string | null;
  label: string;
  value: number;
  quantity?: number;
  billingTreatment?: 'includedInTotals' | 'returnedLater' | 'informationalOnly';
}

interface WeddingPaymentInput {
  label: string;
  value: number;
  dateReceived?: string | null;
}

interface WeddingPayload {
  id?: string;
  status?: 'active' | 'cancelled';
  bride: { fullName: string; email?: string; phone?: string };
  groom: { fullName: string; email?: string; phone?: string };
  otherContacts?: Array<{ fullName?: string; role?: string; email?: string; phone?: string }>;
  weddingDate: string;
  weddingTime?: string;
  notes?: string;
  activities?: WeddingActivityInput[];
  pricingItems?: WeddingPricingItemInput[];
  paymentsReceived?: WeddingPaymentInput[];
}

function cleanText(value: unknown, maxLen = 255) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text) return null;
  return text.substring(0, maxLen);
}

function cleanEmail(value: unknown) {
  const email = cleanText(value, 254);
  if (!email) return null;
  return email.toLowerCase();
}

function cleanNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function sumPricing(items: WeddingPricingItemInput[] | undefined) {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => {
    const value = cleanNumber(item.value) ?? 0;
    const quantity = Math.max(1, cleanNumber(item.quantity) ?? 1);
    return sum + (item.billingTreatment === 'informationalOnly' ? 0 : value * quantity);
  }, 0);
}

function sumPayments(items: WeddingPaymentInput[] | undefined) {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => {
    const value = cleanNumber(item.value) ?? 0;
    return sum + value;
  }, 0);
}

function validateDate(value: string | undefined) {
  return !!value && DATE_RE.test(value);
}

function validateTime(value: string | undefined) {
  return !value || TIME_RE.test(value);
}

function mapRows(rows: Array<Record<string, unknown>>) {
  return rows.map((row) => ({
    _id: row._id,
    status: row.status,
    bride: row.bride,
    groom: row.groom,
    otherContacts: row.otherContacts ?? [],
    weddingDate: row.weddingDate,
    weddingTime: row.weddingTime,
    notes: row.notes,
    finalCost: Number(row.finalCost ?? 0),
    activities: row.activities ?? [],
    pricingItems: row.pricingItems ?? [],
    paymentsReceived: row.paymentsReceived ?? [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

export const handler: Handler = async (event, context: HandlerContext) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (!(await isAuthenticated(event, context))) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const db = getWeddingDb();

  try {
    if (event.httpMethod === 'GET') {
      const { startDate, endDate, status } = event.queryStringParameters ?? {};
      const hasDateFilter = validateDate(startDate) && validateDate(endDate);
      const hasStatus = status === 'active' || status === 'cancelled';

      const weddings = hasDateFilter
        ? await db.sql`
            SELECT
              wb.id AS "_id",
              wb.status,
              jsonb_build_object(
                'fullName', wb.bride_full_name,
                'email', wb.bride_email,
                'phone', wb.bride_phone
              ) AS bride,
              jsonb_build_object(
                'fullName', wb.groom_full_name,
                'email', wb.groom_email,
                'phone', wb.groom_phone
              ) AS groom,
              wb.other_contacts AS "otherContacts",
              wb.wedding_date AS "weddingDate",
              wb.wedding_time AS "weddingTime",
              wb.notes AS notes,
              wb.final_cost AS "finalCost",
              wb.created_at AS "createdAt",
              wb.updated_at AS "updatedAt",
              COALESCE(a.activities, '[]'::jsonb) AS activities,
              COALESCE(p.items, '[]'::jsonb) AS "pricingItems",
              COALESCE(pr.payments, '[]'::jsonb) AS "paymentsReceived"
            FROM wedding_bookings wb
            LEFT JOIN LATERAL (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'label', wa.label,
                  'date', wa.activity_date,
                  'time', wa.activity_time
                ) ORDER BY wa.sort_order, wa.id
              ) AS activities
              FROM wedding_activities wa
              WHERE wa.wedding_id = wb.id
            ) a ON true
            LEFT JOIN LATERAL (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'sourceType', wp.source_type,
                  'entryKey', wp.entry_key,
                  'label', wp.label,
                  'value', wp.value,
                  'quantity', wp.quantity,
                  'billingTreatment', wp.billing_treatment
                ) ORDER BY wp.sort_order, wp.id
              ) AS items
              FROM wedding_pricing_items wp
              WHERE wp.wedding_id = wb.id
            ) p ON true
            LEFT JOIN LATERAL (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'label', wr.label,
                  'value', wr.value,
                  'dateReceived', wr.date_received
                ) ORDER BY wr.sort_order, wr.id
              ) AS payments
              FROM wedding_payments_received wr
              WHERE wr.wedding_id = wb.id
            ) pr ON true
            WHERE wb.wedding_date >= ${startDate!} AND wb.wedding_date <= ${endDate!}
            ${hasStatus ? db.sql`AND wb.status = ${status}` : db.sql``}
            ORDER BY wb.wedding_date ASC, wb.created_at DESC
          `
        : await db.sql`
            SELECT
              wb.id AS "_id",
              wb.status,
              jsonb_build_object(
                'fullName', wb.bride_full_name,
                'email', wb.bride_email,
                'phone', wb.bride_phone
              ) AS bride,
              jsonb_build_object(
                'fullName', wb.groom_full_name,
                'email', wb.groom_email,
                'phone', wb.groom_phone
              ) AS groom,
              wb.other_contacts AS "otherContacts",
              wb.wedding_date AS "weddingDate",
              wb.wedding_time AS "weddingTime",
              wb.notes AS notes,
              wb.final_cost AS "finalCost",
              wb.created_at AS "createdAt",
              wb.updated_at AS "updatedAt",
              COALESCE(a.activities, '[]'::jsonb) AS activities,
              COALESCE(p.items, '[]'::jsonb) AS "pricingItems",
              COALESCE(pr.payments, '[]'::jsonb) AS "paymentsReceived"
            FROM wedding_bookings wb
            LEFT JOIN LATERAL (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'label', wa.label,
                  'date', wa.activity_date,
                  'time', wa.activity_time
                ) ORDER BY wa.sort_order, wa.id
              ) AS activities
              FROM wedding_activities wa
              WHERE wa.wedding_id = wb.id
            ) a ON true
            LEFT JOIN LATERAL (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'sourceType', wp.source_type,
                  'entryKey', wp.entry_key,
                  'label', wp.label,
                  'value', wp.value,
                  'quantity', wp.quantity,
                  'billingTreatment', wp.billing_treatment
                ) ORDER BY wp.sort_order, wp.id
              ) AS items
              FROM wedding_pricing_items wp
              WHERE wp.wedding_id = wb.id
            ) p ON true
            LEFT JOIN LATERAL (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'label', wr.label,
                  'value', wr.value,
                  'dateReceived', wr.date_received
                ) ORDER BY wr.sort_order, wr.id
              ) AS payments
              FROM wedding_payments_received wr
              WHERE wr.wedding_id = wb.id
            ) pr ON true
            ${hasStatus ? db.sql`WHERE wb.status = ${status}` : db.sql``}
            ORDER BY wb.wedding_date ASC, wb.created_at DESC
          `;

      return { statusCode: 200, headers, body: JSON.stringify(mapRows(weddings as Array<Record<string, unknown>>)) };
    }

    let payload: WeddingPayload;
    try {
      payload = JSON.parse(event.body ?? '{}') as WeddingPayload;
    } catch {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }

    if (event.httpMethod === 'POST' || event.httpMethod === 'PATCH') {
      const brideName = cleanText(payload.bride?.fullName, 120);
      const groomName = cleanText(payload.groom?.fullName, 120);
      const weddingDate = cleanText(payload.weddingDate, 10);
      const weddingTime = cleanText(payload.weddingTime, 5);
      const notes = cleanText(payload.notes, 2000);

      if (!brideName || !groomName || !weddingDate) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Bride full name, groom full name, and wedding date are required' }),
        };
      }

      if (!validateDate(weddingDate)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Wedding date must be YYYY-MM-DD' }) };
      }

      if (!validateTime(weddingTime ?? undefined)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Wedding time must be HH:MM' }) };
      }

      const activities = Array.isArray(payload.activities)
        ? payload.activities
            .map((activity) => ({
              label: cleanText(activity.label, 120),
              date: cleanText(activity.date, 10),
              time: cleanText(activity.time, 5),
            }))
            .filter((activity) => activity.label && activity.date) as Array<{ label: string; date: string; time: string | null }>
        : [];

      for (const activity of activities) {
        if (!validateDate(activity.date)) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Activity dates must be YYYY-MM-DD' }) };
        }
        if (!validateTime(activity.time ?? undefined)) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Activity times must be HH:MM' }) };
        }
      }

      const pricingItems = Array.isArray(payload.pricingItems)
        ? payload.pricingItems
            .map((item) => ({
              sourceType: item.sourceType === 'custom' ? 'custom' : 'collection',
              entryKey: cleanText(item.entryKey, 120),
              label: cleanText(item.label, 120),
              value: cleanNumber(item.value),
              quantity: Math.max(1, cleanNumber(item.quantity) ?? 1),
              billingTreatment: item.billingTreatment === 'returnedLater'
                ? 'returnedLater'
                : item.billingTreatment === 'informationalOnly'
                  ? 'informationalOnly'
                  : 'includedInTotals',
            }))
            .filter((item) => item.label && item.value !== null) as Array<{
              sourceType: 'collection' | 'custom';
              entryKey: string | null;
              label: string;
              value: number;
              quantity: number;
              billingTreatment: 'includedInTotals' | 'returnedLater' | 'informationalOnly';
            }>
        : [];

      const paymentsReceived = Array.isArray(payload.paymentsReceived)
        ? payload.paymentsReceived
            .map((payment) => ({
              label: cleanText(payment.label, 120),
              value: cleanNumber(payment.value),
              dateReceived: cleanText(payment.dateReceived, 10),
            }))
            .filter((payment) => payment.label && payment.value !== null) as Array<{
              label: string;
              value: number;
              dateReceived: string | null;
            }>
        : [];

      for (const payment of paymentsReceived) {
        if (payment.dateReceived && !validateDate(payment.dateReceived)) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Payment dates must be YYYY-MM-DD' }) };
        }
      }

      const otherContacts = Array.isArray(payload.otherContacts)
        ? payload.otherContacts
            .map((contact) => ({
              fullName: cleanText(contact.fullName, 120),
              role: cleanText(contact.role, 120),
              email: cleanEmail(contact.email),
              phone: cleanText(contact.phone, 30),
            }))
            .filter((contact) => contact.fullName || contact.role || contact.email || contact.phone)
        : [];

      const finalCost = Number(sumPricing(pricingItems).toFixed(2));
      const totalPaymentsReceived = Number(sumPayments(paymentsReceived).toFixed(2));

      if (event.httpMethod === 'POST') {
        const [created] = await db.sql`
          INSERT INTO wedding_bookings (
            status,
            bride_full_name, bride_email, bride_phone,
            groom_full_name, groom_email, groom_phone,
            other_contacts,
            wedding_date, wedding_time,
            notes,
            final_cost
          ) VALUES (
            'active',
            ${brideName}, ${cleanEmail(payload.bride?.email)}, ${cleanText(payload.bride?.phone, 30)},
            ${groomName}, ${cleanEmail(payload.groom?.email)}, ${cleanText(payload.groom?.phone, 30)},
            ${JSON.stringify(otherContacts)}::jsonb,
            ${weddingDate}, ${weddingTime ?? null},
            ${notes},
            ${finalCost}
          )
          RETURNING id AS "_id"
        `;

        if (activities.length > 0) {
          const rows = activities.map((activity, index) => [
            created._id,
            activity.label,
            activity.date,
            activity.time,
            index,
          ]);
          await db.sql`
            INSERT INTO wedding_activities (wedding_id, label, activity_date, activity_time, sort_order)
            VALUES ${db.sql.values(rows)}
          `;
        }

        if (pricingItems.length > 0) {
          const rows = pricingItems.map((item, index) => [
            created._id,
            item.sourceType,
            item.entryKey,
            item.label,
            Number(item.value.toFixed(2)),
            item.quantity,
            item.billingTreatment,
            index,
          ]);
          await db.sql`
            INSERT INTO wedding_pricing_items (wedding_id, source_type, entry_key, label, value, quantity, billing_treatment, sort_order)
            VALUES ${db.sql.values(rows)}
          `;
        }

        if (paymentsReceived.length > 0) {
          const rows = paymentsReceived.map((payment, index) => [
            created._id,
            payment.label,
            Number(payment.value.toFixed(2)),
            payment.dateReceived,
            index,
          ]);
          await db.sql`
            INSERT INTO wedding_payments_received (wedding_id, label, value, date_received, sort_order)
            VALUES ${db.sql.values(rows)}
          `;
        }

        return { statusCode: 201, headers, body: JSON.stringify({ id: created._id, totalPaymentsReceived }) };
      }

      if (!payload.id || !UUID_RE.test(payload.id)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Valid id is required for updates' }) };
      }

      const status = payload.status === 'cancelled' ? 'cancelled' : 'active';

      const [updated] = await db.sql`
        UPDATE wedding_bookings
        SET
          status = ${status},
          bride_full_name = ${brideName},
          bride_email = ${cleanEmail(payload.bride?.email)},
          bride_phone = ${cleanText(payload.bride?.phone, 30)},
          groom_full_name = ${groomName},
          groom_email = ${cleanEmail(payload.groom?.email)},
          groom_phone = ${cleanText(payload.groom?.phone, 30)},
          other_contacts = ${JSON.stringify(otherContacts)}::jsonb,
          wedding_date = ${weddingDate},
          wedding_time = ${weddingTime ?? null},
          notes = ${notes},
          final_cost = ${finalCost},
          updated_at = NOW()
        WHERE id = ${payload.id}
        RETURNING id AS "_id"
      `;

      if (!updated) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Wedding not found' }) };
      }

      await db.sql`DELETE FROM wedding_activities WHERE wedding_id = ${payload.id}`;
      await db.sql`DELETE FROM wedding_pricing_items WHERE wedding_id = ${payload.id}`;
      await db.sql`DELETE FROM wedding_payments_received WHERE wedding_id = ${payload.id}`;

      if (activities.length > 0) {
        const rows = activities.map((activity, index) => [
          payload.id,
          activity.label,
          activity.date,
          activity.time,
          index,
        ]);
        await db.sql`
          INSERT INTO wedding_activities (wedding_id, label, activity_date, activity_time, sort_order)
          VALUES ${db.sql.values(rows)}
        `;
      }

      if (pricingItems.length > 0) {
        const rows = pricingItems.map((item, index) => [
          payload.id,
          item.sourceType,
          item.entryKey,
          item.label,
          Number(item.value.toFixed(2)),
          item.quantity,
          item.billingTreatment,
          index,
        ]);
        await db.sql`
          INSERT INTO wedding_pricing_items (wedding_id, source_type, entry_key, label, value, quantity, billing_treatment, sort_order)
          VALUES ${db.sql.values(rows)}
        `;
      }

      if (paymentsReceived.length > 0) {
        const rows = paymentsReceived.map((payment, index) => [
          payload.id,
          payment.label,
          Number(payment.value.toFixed(2)),
          payment.dateReceived,
          index,
        ]);
        await db.sql`
          INSERT INTO wedding_payments_received (wedding_id, label, value, date_received, sort_order)
          VALUES ${db.sql.values(rows)}
        `;
      }

      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    if (event.httpMethod === 'DELETE') {
      // Read ID from query string (more reliable with netlify dev)
      const id = event.queryStringParameters?.id;

      console.log('DELETE wedding request received. ID from query:', id);

      if (!id || !UUID_RE.test(id)) {
        return { 
          statusCode: 400, 
          headers, 
          body: JSON.stringify({ error: 'Valid id is required' }) 
        };
      }

      const [deleted] = await db.sql`
        DELETE FROM wedding_bookings 
        WHERE id = ${id} 
        RETURNING id
      `;

      if (!deleted) {
        return { 
          statusCode: 404, 
          headers, 
          body: JSON.stringify({ error: 'Wedding not found' }) 
        };
      }

      return { 
        statusCode: 200, 
        headers, 
        body: JSON.stringify({ success: true, message: 'Wedding deleted successfully' }) 
      };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    console.error('[admin-weddings] Error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
