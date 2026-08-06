-- Day-to-day operations the till was missing: voiding a mistake, discounting a
-- bill, capturing who the order is for, reprinting a receipt, and a tax rate
-- that can change without a deploy.
--
-- All additive with defaults, so existing rows keep their current meaning.

-- ==================== ORDERS ====================

-- Voiding. `status` already permitted 'cancelled' and both Orders and Reports
-- filtered on it, but nothing could ever set it — a mis-fired order stayed in
-- revenue forever. A reason is stored because "why" is the whole point of an
-- audit trail; a void with no reason tells you nothing three weeks later.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_by TEXT;

-- Discounts. Held as an amount in rupees even when the operator entered a
-- percentage: the percentage is an input, the money is the fact, and a stored
-- percentage would silently re-price the order if anything else changed.
-- Applied to the subtotal, with tax charged on what remains.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_reason TEXT;

-- The receipt's invoice number was generated at print time and never stored,
-- so a reprint produced a *different* number for the same sale. Persisted so a
-- reprint is the same document.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_number TEXT;

-- Delivery needs somewhere to put the address. customers.address exists, but
-- the address used for *this* order belongs on the order — people move, and a
-- past delivery should still say where it went.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_address TEXT;

-- ==================== INDEXES ====================
-- The Orders screen pages and filters on these; without them every page view
-- is a full scan that gets slower as history accumulates.
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);
CREATE INDEX IF NOT EXISTS orders_payment_status_idx ON orders (payment_status);
CREATE INDEX IF NOT EXISTS orders_order_number_idx ON orders (order_number);
CREATE INDEX IF NOT EXISTS orders_customer_phone_idx ON orders (customer_phone);

-- ==================== STORE SETTINGS ====================

-- Tax was TAX_RATE = 0.16 in orderTotals.js, with "16%" hardcoded into two
-- components as well. A rate change meant a code deploy; it belongs beside the
-- other merchant configuration. Stored as a fraction, not a percentage.
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5, 4) NOT NULL DEFAULT 0.16;

-- Shown on the receipt line, so a change of regime doesn't leave the receipt
-- claiming "GST" for something else.
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS tax_label TEXT NOT NULL DEFAULT 'GST';
