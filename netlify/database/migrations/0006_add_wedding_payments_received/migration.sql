CREATE TABLE IF NOT EXISTS wedding_payments_received (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id UUID NOT NULL REFERENCES wedding_bookings(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  value NUMERIC(12,2) NOT NULL,
  date_received TEXT CHECK (date_received IS NULL OR date_received ~ '^\d{4}-\d{2}-\d{2}$'),
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_wedding_payments_received_wedding_id ON wedding_payments_received (wedding_id);