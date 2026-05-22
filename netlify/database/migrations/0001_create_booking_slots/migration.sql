CREATE TABLE IF NOT EXISTS booking_slots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date        TEXT NOT NULL CHECK (date ~ '^\d{4}-\d{2}-\d{2}$'),
  start_time  TEXT NOT NULL CHECK (start_time ~ '^\d{2}:\d{2}$'),
  end_time    TEXT NOT NULL CHECK (end_time ~ '^\d{2}:\d{2}$'),
  status      TEXT NOT NULL DEFAULT 'available'
                CHECK (status IN ('available', 'booked', 'blocked')),

  -- Booking details (populated only when status = 'booked')
  booking_name        TEXT,
  booking_email       TEXT,
  booking_phone       TEXT,
  booking_party_size  INTEGER,
  booking_message     TEXT,
  booked_at           TIMESTAMPTZ,

  CONSTRAINT booking_slots_date_start_unique UNIQUE (date, start_time)
);

CREATE INDEX IF NOT EXISTS idx_booking_slots_date ON booking_slots (date);
