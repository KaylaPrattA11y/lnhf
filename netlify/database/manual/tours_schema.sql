CREATE TABLE IF NOT EXISTS tour_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date TEXT NOT NULL CHECK (date ~ '^\d{4}-\d{2}-\d{2}$'),
  start_time TEXT NOT NULL CHECK (start_time ~ '^\d{2}:\d{2}$'),
  end_time TEXT NOT NULL CHECK (end_time ~ '^\d{2}:\d{2}$'),
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'booked', 'blocked')),
  guest_name TEXT,
  guest_email TEXT,
  guest_phone TEXT,
  guest_party_size INTEGER,
  guest_message TEXT,
  booked_at TIMESTAMPTZ,
  CONSTRAINT tour_slots_date_start_unique UNIQUE (date, start_time)
);

CREATE INDEX IF NOT EXISTS idx_tour_slots_date ON tour_slots (date);

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
);

INSERT INTO tour_calendar_settings (id)
VALUES (TRUE)
ON CONFLICT (id) DO NOTHING;
