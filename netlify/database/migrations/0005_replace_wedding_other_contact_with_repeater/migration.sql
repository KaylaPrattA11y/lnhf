ALTER TABLE wedding_bookings
ADD COLUMN IF NOT EXISTS other_contacts JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE wedding_bookings
DROP COLUMN IF EXISTS other_full_name;

ALTER TABLE wedding_bookings
DROP COLUMN IF EXISTS other_email;

ALTER TABLE wedding_bookings
DROP COLUMN IF EXISTS other_phone;
