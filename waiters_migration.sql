-- Waiter assignment for orders.
-- Run once in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS waiters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT,                       -- short badge/staff code, e.g. "W-04"
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Orders keep the waiter's name alongside the id: the id is dropped if the
-- staff member is removed, but receipts and reports must still show who
-- served the table.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS waiter_id UUID REFERENCES waiters(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS waiter_name TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_waiter ON orders(waiter_id);

-- Demo staff
INSERT INTO waiters (name, code) VALUES
  ('Ahmed Raza', 'W-01'),
  ('Bilal Hussain', 'W-02'),
  ('Danish Iqbal', 'W-03'),
  ('Faisal Khan', 'W-04'),
  ('Hamza Tariq', 'W-05'),
  ('Usman Ghani', 'W-06');

-- Readable by the app, writable only by signed-in staff
ALTER TABLE waiters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read waiters" ON waiters
  FOR SELECT TO public USING (true);

CREATE POLICY "Authenticated manage waiters" ON waiters
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
