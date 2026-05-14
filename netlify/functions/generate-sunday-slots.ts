import { schedule } from '@netlify/functions';
import { getDb } from './utils/mongodb';

/**
 * Scheduled function — runs every Monday at 00:00 UTC.
 *
 * Looks 8 weeks ahead and upserts one "available" slot per hour (1:00–3:00 PM)
 * for each Sunday in that window. Uses $setOnInsert so existing slots that
 * owners have already changed to "blocked" are never overwritten.
 */

const HOURS = [13, 14, 15]; // 1 PM – 3 PM start times (1-hour slots)
const WEEKS_AHEAD = 8;

function getUpcomingSundays(from: Date, count: number): string[] {
  const sundays: string[] = [];
  const d = new Date(from);
  // Advance to the next Sunday (or today if already Sunday)
  d.setUTCHours(0, 0, 0, 0);
  const daysUntilSunday = (7 - d.getUTCDay()) % 7;
  d.setUTCDate(d.getUTCDate() + daysUntilSunday);

  for (let i = 0; i < count; i++) {
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    sundays.push(`${yyyy}-${mm}-${dd}`);
    d.setUTCDate(d.getUTCDate() + 7);
  }

  return sundays;
}

export const handler = schedule('0 0 * * 1', async () => {
  try {
    const db = await getDb();
    const collection = db.collection('booking_slots');

    const sundays = getUpcomingSundays(new Date(), WEEKS_AHEAD);

    const ops = sundays.flatMap(date =>
      HOURS.map(h => {
        const startTime = `${String(h).padStart(2, '0')}:00`;
        const endTime   = `${String(h + 1).padStart(2, '0')}:00`;
        return {
          updateOne: {
            filter: { date, startTime },
            update: { $setOnInsert: { date, startTime, endTime, status: 'available' } },
            upsert: true,
          },
        };
      })
    );

    const result = await collection.bulkWrite(ops, { ordered: false });

    console.log(
      `[generate-sunday-slots] Upserted ${result.upsertedCount} new slots ` +
      `across ${sundays.length} Sundays (${sundays[0]} – ${sundays[sundays.length - 1]})`
    );

    return { statusCode: 200 };
  } catch (err) {
    console.error('[generate-sunday-slots] Error:', err);
    return { statusCode: 500 };
  }
});
