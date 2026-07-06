import { getDb } from './db';

export type HolidayMode = 'off' | 'range' | 'indefinite';

export interface TourCalendarSettings {
  bookingBufferHours: 12 | 24 | 36 | 48;
  bookingHorizonMonths: 1 | 2 | 3 | 4 | 5 | 6;
  holidayMode: HolidayMode;
  holidayStartAt: string | null;
  holidayEndAt: string | null;
  holidayMessageHtml: string | null;
}

const DEFAULT_SETTINGS: TourCalendarSettings = {
  bookingBufferHours: 24,
  bookingHorizonMonths: 3,
  holidayMode: 'off',
  holidayStartAt: null,
  holidayEndAt: null,
  holidayMessageHtml: null,
};

export async function ensureTourCalendarSettingsTable() {
  await getDb().sql`
    CREATE TABLE IF NOT EXISTS tour_calendar_settings (
      id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id = TRUE),
      booking_buffer_hours INTEGER NOT NULL DEFAULT 24 CHECK (booking_buffer_hours IN (12, 24, 36, 48)),
      booking_horizon_months INTEGER NOT NULL DEFAULT 3 CHECK (booking_horizon_months IN (1, 2, 3, 4, 5, 6)),
      holiday_mode TEXT NOT NULL DEFAULT 'off' CHECK (holiday_mode IN ('off', 'range', 'indefinite')),
      holiday_start_at TIMESTAMPTZ,
      holiday_end_at TIMESTAMPTZ,
      holiday_message_html TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT tour_calendar_settings_range_check CHECK (
        holiday_mode <> 'range' OR (holiday_start_at IS NOT NULL AND holiday_end_at IS NOT NULL AND holiday_end_at > holiday_start_at)
      )
    )
  `;

  await getDb().sql`
    ALTER TABLE tour_calendar_settings
    ADD COLUMN IF NOT EXISTS booking_horizon_months INTEGER NOT NULL DEFAULT 3
  `;

  await getDb().sql`
    DO $$
    BEGIN
      BEGIN
        ALTER TABLE tour_calendar_settings
        ADD CONSTRAINT tour_calendar_settings_booking_horizon_check
        CHECK (booking_horizon_months IN (1, 2, 3, 4, 5, 6));
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END;
    END
    $$;
  `;
}

function toIsoDateTime(date: string, time: string) {
  return `${date}T${time}:00`;
}

export function isSlotInsideBuffer(slotDate: string, slotStartTime: string, bufferHours: number, now = new Date()) {
  const slotStart = new Date(toIsoDateTime(slotDate, slotStartTime));
  const diffMs = slotStart.getTime() - now.getTime();
  const bufferMs = bufferHours * 60 * 60 * 1000;
  return diffMs < bufferMs;
}

export function isSlotBeyondBookingHorizon(
  slotDate: string,
  slotStartTime: string,
  bookingHorizonMonths: number,
  now = new Date(),
) {
  const slotStart = new Date(toIsoDateTime(slotDate, slotStartTime));
  const bookingEnd = new Date(now);
  bookingEnd.setMonth(bookingEnd.getMonth() + bookingHorizonMonths);
  return slotStart > bookingEnd;
}

export function isHolidayModeActiveNow(
  settings: Pick<TourCalendarSettings, 'holidayMode' | 'holidayStartAt' | 'holidayEndAt'>,
  now = new Date(),
) {
  if (settings.holidayMode === 'indefinite') return true;
  if (settings.holidayMode !== 'range' || !settings.holidayStartAt || !settings.holidayEndAt) return false;
  const start = new Date(settings.holidayStartAt);
  const end = new Date(settings.holidayEndAt);
  return now >= start && now <= end;
}

export function isSlotInsideHolidayRange(
  slotDate: string,
  slotStartTime: string,
  settings: Pick<TourCalendarSettings, 'holidayMode' | 'holidayStartAt' | 'holidayEndAt'>,
) {
  if (settings.holidayMode === 'indefinite') return true;
  if (settings.holidayMode !== 'range' || !settings.holidayStartAt || !settings.holidayEndAt) return false;

  const slotStart = new Date(toIsoDateTime(slotDate, slotStartTime));
  const start = new Date(settings.holidayStartAt);
  const end = new Date(settings.holidayEndAt);
  return slotStart >= start && slotStart <= end;
}

export async function getTourCalendarSettings(): Promise<TourCalendarSettings> {
  await ensureTourCalendarSettingsTable();

  const [row] = await getDb().sql`
    SELECT
      booking_buffer_hours AS "bookingBufferHours",
      booking_horizon_months AS "bookingHorizonMonths",
      holiday_mode AS "holidayMode",
      holiday_start_at AS "holidayStartAt",
      holiday_end_at AS "holidayEndAt",
      holiday_message_html AS "holidayMessageHtml"
    FROM tour_calendar_settings
    WHERE id = TRUE
    LIMIT 1
  `;

  if (!row) {
    await getDb().sql`
      INSERT INTO tour_calendar_settings (id)
      VALUES (TRUE)
      ON CONFLICT (id) DO NOTHING
    `;
    return DEFAULT_SETTINGS;
  }

  return {
    bookingBufferHours: Number(row.bookingBufferHours ?? 24) as 12 | 24 | 36 | 48,
    bookingHorizonMonths: Number(row.bookingHorizonMonths ?? 3) as 1 | 2 | 3 | 4 | 5 | 6,
    holidayMode: (row.holidayMode ?? 'off') as HolidayMode,
    holidayStartAt: row.holidayStartAt ? new Date(row.holidayStartAt).toISOString() : null,
    holidayEndAt: row.holidayEndAt ? new Date(row.holidayEndAt).toISOString() : null,
    holidayMessageHtml: typeof row.holidayMessageHtml === 'string' && row.holidayMessageHtml.trim().length > 0
      ? row.holidayMessageHtml
      : null,
  };
}
