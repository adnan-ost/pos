-- Open tabs / running bills.
--
-- A customer orders, the food fires to the kitchen, more rounds get added over
-- the sitting, and the bill is settled once at the end. The order row *is* the
-- tab: extra rounds append onto its `items` array and its totals are recomputed,
-- so one check stays one row (reports keep counting checks, not rounds).
--
-- Money moves out of "implied at order time" and into explicit columns:
--   payment_status  'unpaid' while the tab is open, 'paid' once settled
--   payment_mode    how it was settled (set at settle time, not at order time)
--   paid_at         when it was settled
--   include_tax     the tab's FBR tax rule, so later rounds are taxed the same
--   round_count     how many times food has been fired for this check
--   last_round_at   when food was last fired, so the KDS timer tracks the newest
--                   round instead of showing a 40-minute-old ticket as late
--
-- Run once in the Supabase SQL Editor.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'paid';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_mode TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS include_tax BOOLEAN DEFAULT true;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS round_count INTEGER DEFAULT 1;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS last_round_at TIMESTAMPTZ;

-- Existing orders were paid as they were placed, which is what the DEFAULT
-- backfills them to. Only tabs opened from here on start out unpaid.
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN ('unpaid', 'paid'));

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_mode_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_mode_check
  CHECK (payment_mode IS NULL OR payment_mode IN ('cash', 'card'));

-- The POS reads open tabs on every load, and they are a tiny slice of history
CREATE INDEX IF NOT EXISTS idx_orders_unpaid ON orders(created_at DESC)
  WHERE payment_status = 'unpaid';
