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
