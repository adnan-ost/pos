-- Explicit on/off switch for the payment QR on receipts.
--
-- Until now the only way to stop printing a QR was to clear raast_id, which
-- threw the identifier away — so turning QR payments off for an evening (bank
-- outage, terminal-only night) meant re-typing an IBAN to turn them back on.
--
-- Defaults to true so existing installs keep printing QR codes exactly as
-- before; the column being absent is read as enabled in the app too.

ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS qr_enabled BOOLEAN NOT NULL DEFAULT true;
