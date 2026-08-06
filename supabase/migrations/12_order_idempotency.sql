-- Makes checkout safe to retry.
--
-- Today a network timeout during checkout tells the cashier nothing: the order
-- may have landed or may not have. They retry, and because addOrder generates a
-- fresh order_number from Date.now() each call, the second attempt inserts a
-- separate order. The kitchen cooks it twice and the takings are overstated.
--
-- The client now mints one id per checkout *attempt* and reuses it on retry, so
-- the second insert collides instead of duplicating.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_request_id UUID;

-- Deliberately NOT a partial index. ON CONFLICT can only infer a partial index
-- if the statement repeats its predicate, which PostgREST's upsert cannot
-- express. A plain unique index works here because Postgres treats NULLs as
-- distinct, so every order predating this column — and any future insert that
-- omits it — is still accepted.
CREATE UNIQUE INDEX IF NOT EXISTS orders_client_request_id_key
  ON orders (client_request_id);
