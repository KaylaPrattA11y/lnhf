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

CREATE TABLE IF NOT EXISTS wedding_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),

  bride_full_name TEXT NOT NULL,
  bride_email TEXT,
  bride_phone TEXT,

  groom_full_name TEXT NOT NULL,
  groom_email TEXT,
  groom_phone TEXT,

  other_contacts JSONB NOT NULL DEFAULT '[]'::jsonb,

  wedding_date TEXT NOT NULL CHECK (wedding_date ~ '^\d{4}-\d{2}-\d{2}$'),
  wedding_time TEXT CHECK (wedding_time IS NULL OR wedding_time ~ '^\d{2}:\d{2}$'),

  final_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wedding_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id UUID NOT NULL REFERENCES wedding_bookings(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  activity_date TEXT NOT NULL CHECK (activity_date ~ '^\d{4}-\d{2}-\d{2}$'),
  activity_time TEXT CHECK (activity_time IS NULL OR activity_time ~ '^\d{2}:\d{2}$'),
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS wedding_pricing_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id UUID NOT NULL REFERENCES wedding_bookings(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('collection', 'custom')),
  entry_key TEXT,
  label TEXT NOT NULL,
  value NUMERIC(12,2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  billing_treatment TEXT NOT NULL DEFAULT 'includedInTotals' CHECK (billing_treatment IN ('includedInTotals', 'returnedLater', 'informationalOnly')),
  sort_order INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE wedding_pricing_items
ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1;

ALTER TABLE wedding_pricing_items
ADD COLUMN IF NOT EXISTS billing_treatment TEXT NOT NULL DEFAULT 'includedInTotals';

ALTER TABLE wedding_pricing_items
DROP CONSTRAINT IF EXISTS wedding_pricing_items_billing_treatment_check;

ALTER TABLE wedding_pricing_items
ADD CONSTRAINT wedding_pricing_items_billing_treatment_check CHECK (billing_treatment IN ('includedInTotals', 'returnedLater', 'informationalOnly'));

ALTER TABLE wedding_pricing_items
DROP CONSTRAINT IF EXISTS wedding_pricing_items_quantity_check;

ALTER TABLE wedding_pricing_items
ADD CONSTRAINT wedding_pricing_items_quantity_check CHECK (quantity >= 1);

CREATE INDEX IF NOT EXISTS idx_tour_slots_date ON tour_slots (date);
CREATE INDEX IF NOT EXISTS idx_wedding_bookings_date ON wedding_bookings (wedding_date);
CREATE INDEX IF NOT EXISTS idx_wedding_activities_wedding_id ON wedding_activities (wedding_id);
CREATE INDEX IF NOT EXISTS idx_wedding_pricing_items_wedding_id ON wedding_pricing_items (wedding_id);
