-- Enable Realtime on `orders` so the KDS and Orders screens receive
-- live pushes instead of relying only on polling.
-- Supabase does not add tables to this publication automatically.

ALTER PUBLICATION supabase_realtime ADD TABLE orders;

-- Verify: `orders` should be listed
SELECT tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';
