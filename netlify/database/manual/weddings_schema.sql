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
  notes TEXT,
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

CREATE TABLE IF NOT EXISTS wedding_payments_received (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id UUID NOT NULL REFERENCES wedding_bookings(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  value NUMERIC(12,2) NOT NULL,
  date_received TEXT CHECK (date_received IS NULL OR date_received ~ '^\d{4}-\d{2}-\d{2}$'),
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_wedding_bookings_date ON wedding_bookings (wedding_date);
CREATE INDEX IF NOT EXISTS idx_wedding_activities_wedding_id ON wedding_activities (wedding_id);
CREATE INDEX IF NOT EXISTS idx_wedding_pricing_items_wedding_id ON wedding_pricing_items (wedding_id);
CREATE INDEX IF NOT EXISTS idx_wedding_payments_received_wedding_id ON wedding_payments_received (wedding_id);
