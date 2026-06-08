CREATE TABLE IF NOT EXISTS tour_calendar_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id = TRUE),
  booking_buffer_hours INTEGER NOT NULL DEFAULT 24 CHECK (booking_buffer_hours IN (12, 24, 36, 48)),
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
