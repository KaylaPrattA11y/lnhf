ALTER TABLE wedding_pricing_items
ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1;

ALTER TABLE wedding_pricing_items
ADD COLUMN IF NOT EXISTS billing_treatment TEXT NOT NULL DEFAULT 'includedInTotals';

ALTER TABLE wedding_pricing_items
DROP CONSTRAINT IF EXISTS wedding_pricing_items_billing_treatment_check;

ALTER TABLE wedding_pricing_items
ADD CONSTRAINT wedding_pricing_items_billing_treatment_check
CHECK (billing_treatment IN ('includedInTotals', 'returnedLater', 'informationalOnly'));

ALTER TABLE wedding_pricing_items
DROP CONSTRAINT IF EXISTS wedding_pricing_items_quantity_check;

ALTER TABLE wedding_pricing_items
ADD CONSTRAINT wedding_pricing_items_quantity_check CHECK (quantity >= 1);
