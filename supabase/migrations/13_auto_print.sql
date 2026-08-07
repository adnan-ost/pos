-- Whether taking payment also prints the receipt.
--
-- Defaults to true because that's the point of a till: paper comes out when the
-- customer pays, with no extra tap. It's a switch rather than a constant for
-- real operational reasons — a jammed printer, an empty roll, a delivery order
-- nobody needs a copy of — and so a terminal whose Chrome isn't in kiosk mode
-- yet doesn't throw a print dialog on every sale while it's being set up.
--
-- Read as true when the column is absent, same as qr_enabled, so the app works
-- against a database where this hasn't been applied.

ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS auto_print BOOLEAN NOT NULL DEFAULT true;
