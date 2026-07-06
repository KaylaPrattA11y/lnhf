ALTER TABLE tour_calendar_settings
ADD COLUMN IF NOT EXISTS booking_horizon_months INTEGER NOT NULL DEFAULT 3;

UPDATE tour_calendar_settings
SET booking_horizon_months = 3
WHERE booking_horizon_months NOT IN (1, 2, 3, 4, 5, 6);

ALTER TABLE tour_calendar_settings
DROP CONSTRAINT IF EXISTS tour_calendar_settings_booking_horizon_check;

ALTER TABLE tour_calendar_settings
ADD CONSTRAINT tour_calendar_settings_booking_horizon_check
CHECK (booking_horizon_months IN (1, 2, 3, 4, 5, 6));
