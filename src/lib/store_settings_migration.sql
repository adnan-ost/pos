
-- Store Settings table for global configurations
CREATE TABLE store_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_name TEXT,
  merchant_city TEXT,
  raast_id TEXT,
  jazzcash_id TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default row (singleton pattern)
INSERT INTO store_settings (merchant_name, merchant_city, raast_id)
VALUES ('Flames by the Indus', 'Islamabad', '03475369008');

-- Policy to allow only authenticated users to read/update
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read" ON store_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated update" ON store_settings
  FOR UPDATE TO authenticated USING (true);
