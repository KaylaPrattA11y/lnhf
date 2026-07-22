import { schedule } from '@netlify/functions';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { getDb } from './utils/db';
import { getTourCalendarSettings } from './utils/tour-calendar';

interface TourTimeSlotSeedConfig {
  tourStart: string;
  tourEnd: string;
  seedDays: number[];
}

export interface SeededTourSyncResult {
  insertedCount: number;
  deletedCount: number;
  seededTemplates: number;
  horizonMonths: number;
  windowStart: string;
  windowEnd: string;
}

const tourTimeSlotsDirectory = resolve(process.cwd(), 'src/content/tour-time-slots');

function parseSeedDays(source: string): number[] {
  const inlineMatch = source.match(/seedSlotOnDay:\s*\[([^\]]*)\]/m);
  if (inlineMatch) {
    const days = inlineMatch[1]
      .split(',')
      .map((part) => Number(part.replace(/['"\s]/g, '')))
      .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6);
    return Array.from(new Set(days)).sort((a, b) => a - b);
  }

  const blockMatch = source.match(/seedSlotOnDay:\s*\n([\s\S]*?)(?:\n\w|$)/m);
  if (!blockMatch) return [];

  const days = blockMatch[1]
    .split('\n')
    .map((line) => line.match(/^\s*-\s*['"]?(\d)['"]?\s*$/)?.[1])
    .filter((value): value is string => Boolean(value))
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6);

  return Array.from(new Set(days)).sort((a, b) => a - b);
}

function extractSlotSeedConfigFromFrontmatter(source: string): TourTimeSlotSeedConfig | null {
  const startMatch = source.match(/tourStart:\s*['"]?(\d{2}:\d{2})['"]?/);
  const endMatch = source.match(/tourEnd:\s*['"]?(\d{2}:\d{2})['"]?/);
  if (!startMatch || !endMatch) return null;

  const tourStart = startMatch[1];
  const tourEnd = endMatch[1];

  if (/^\d{2}:\d{2}$/.test(tourStart) === false || /^\d{2}:\d{2}$/.test(tourEnd) === false) {
    return null;
  }

  return {
    tourStart,
    tourEnd,
    seedDays: parseSeedDays(source),
  };
}

async function loadTourTimeSlotSeedConfigs(): Promise<TourTimeSlotSeedConfig[]> {
  try {
    const entries = await readdir(tourTimeSlotsDirectory, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')))
      .map((entry) => entry.name);

    if (files.length === 0) return [];

    const parsedConfigs = await Promise.all(
      files.map(async (fileName) => {
        const content = await readFile(resolve(tourTimeSlotsDirectory, fileName), 'utf8');
        return extractSlotSeedConfigFromFrontmatter(content);
      }),
    );

    const uniqueConfigs = Array.from(
      new Map(
        parsedConfigs
          .filter((value): value is TourTimeSlotSeedConfig => value !== null)
          .map((config) => [`${config.tourStart}-${config.tourEnd}`, config]),
      ).values(),
    ).sort((a, b) => a.tourStart.localeCompare(b.tourStart));

    return uniqueConfigs;
  } catch (error) {
    console.error('[generate-seeded-tour-slots] Could not load slot seed config:', error);
    return [];
  }
}

function addMonthsUtc(date: Date, months: number): Date {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

function toIsoDateUtc(date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getDatesInRangeUtc(from: Date, to: Date): string[] {
  const dates: string[] = [];
  const d = new Date(from);
  d.setUTCHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setUTCHours(0, 0, 0, 0);

  while (d <= end) {
    dates.push(toIsoDateUtc(d));
    d.setUTCDate(d.getUTCDate() + 7);
  }

  return dates;
}

function getUpcomingDatesByWeekday(weekday: number, from: Date, monthsAhead: number): string[] {
  const start = new Date(from);
  start.setUTCHours(0, 0, 0, 0);
  const end = addMonthsUtc(start, monthsAhead);

  const cursor = new Date(start);
  const dayOffset = (weekday - cursor.getUTCDay() + 7) % 7;
  cursor.setUTCDate(cursor.getUTCDate() + dayOffset);

  return getDatesInRangeUtc(cursor, end);
}

/**
 * Scheduled function — runs monthly.
 * Synchronizes seeded slots for the configured booking horizon based on tour-time-slots content.
 */
export async function syncSeededTourSlots(now = new Date()): Promise<SeededTourSyncResult> {
  const settings = await getTourCalendarSettings();
  const monthsAhead = Math.min(6, Math.max(1, Number(settings.bookingHorizonMonths || 3)));
  const slotConfigs = await loadTourTimeSlotSeedConfigs();
  const startDate = toIsoDateUtc(now);
  const endDate = toIsoDateUtc(addMonthsUtc(now, monthsAhead));

  if (slotConfigs.length === 0) {
    console.warn('[generate-seeded-tour-slots] No tour-time-slots content found. Nothing to seed.');
    return {
      insertedCount: 0,
      deletedCount: 0,
      seededTemplates: 0,
      horizonMonths: monthsAhead,
      windowStart: startDate,
      windowEnd: endDate,
    };
  }

  const configuredRangeKeys = new Set(slotConfigs.map((config) => `${config.tourStart}-${config.tourEnd}`));
  const desiredSeededKeys = new Set<string>();

  for (const config of slotConfigs) {
    for (const day of config.seedDays) {
      const dates = getUpcomingDatesByWeekday(day, now, monthsAhead);
      for (const date of dates) {
        desiredSeededKeys.add(`${date}|${config.tourStart}|${config.tourEnd}`);
      }
    }
  }

  const seedRows = Array.from(desiredSeededKeys).map((key) => {
    const [date, start, end] = key.split('|');
    return [date, start, end];
  });

  let insertedCount = 0;
  if (seedRows.length > 0) {
    const insertResult = await getDb().sql`
      INSERT INTO tour_slots (date, start_time, end_time)
      VALUES ${getDb().sql.values(seedRows)}
      ON CONFLICT (date, start_time) DO NOTHING
    `;
    insertedCount = insertResult.length;
  }

  const existingFutureSlots = await getDb().sql<{
    _id: string;
    date: string;
    startTime: string;
    endTime: string;
    status: 'available' | 'blocked' | 'booked';
  }>`
    SELECT
      id AS "_id",
      date,
      start_time AS "startTime",
      end_time AS "endTime",
      status
    FROM tour_slots
    WHERE date >= ${startDate}
      AND date <= ${endDate}
  `;

  const slotIdsToDelete = existingFutureSlots
    .filter((slot) => {
      if (slot.status === 'booked') return false;
      const rangeKey = `${slot.startTime}-${slot.endTime}`;
      if (!configuredRangeKeys.has(rangeKey)) return true;
      const seededKey = `${slot.date}|${slot.startTime}|${slot.endTime}`;
      return !desiredSeededKeys.has(seededKey);
    })
    .map((slot) => slot._id);

  let deletedCount = 0;
  if (slotIdsToDelete.length > 0) {
    const slotIdRows = slotIdsToDelete.map((id) => [id]);
    const deleted = await getDb().sql`
      DELETE FROM tour_slots
      WHERE id IN (
        SELECT column1::uuid
        FROM (VALUES ${getDb().sql.values(slotIdRows)}) AS ids
      )
      AND status != 'booked'
      RETURNING id
    `;
    deletedCount = deleted.length;
  }

  const result: SeededTourSyncResult = {
    insertedCount,
    deletedCount,
    seededTemplates: slotConfigs.length,
    horizonMonths: monthsAhead,
    windowStart: startDate,
    windowEnd: endDate,
  };

  console.log(
    `[generate-seeded-tour-slots] inserted=${insertedCount} deleted=${deletedCount} ` +
    `seededTemplates=${slotConfigs.length} horizonMonths=${monthsAhead}`,
  );

  return result;
}

export const handler = schedule('0 0 1 * *', async () => {
  try {
    await syncSeededTourSlots();
    return { statusCode: 200 };
  } catch (err) {
    console.error('[generate-seeded-tour-slots] Error:', err);
    return { statusCode: 500 };
  }
});
