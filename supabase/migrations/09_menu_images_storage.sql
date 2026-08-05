-- Storage bucket for menu item photos uploaded from the Menu Management form.
--
-- Creating a bucket needs the service role, so it can't be done from the app
-- or with the anon key — run this once in the Supabase SQL Editor.
--
-- Public read, because the customer menu and the POS render these images with
-- no session. Writes are restricted to signed-in staff.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'menu-images',
  'menu-images',
  true,
  5242880, -- 5MB, matches MAX_IMAGE_BYTES in src/lib/supabaseDb.js
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/avif']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Anyone may read: these URLs end up on the customer-facing menu.
DROP POLICY IF EXISTS "Public read menu images" ON storage.objects;
CREATE POLICY "Public read menu images" ON storage.objects
  FOR SELECT USING (bucket_id = 'menu-images');

-- Only signed-in staff may add or replace photos.
DROP POLICY IF EXISTS "Staff upload menu images" ON storage.objects;
CREATE POLICY "Staff upload menu images" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'menu-images');

DROP POLICY IF EXISTS "Staff update menu images" ON storage.objects;
CREATE POLICY "Staff update menu images" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'menu-images');

-- Deleting is left to admins working in the dashboard: an item's image column
-- can be cleared from the form without stranding anything the app depends on,
-- and orphaned files are cheaper than a mis-scoped delete policy.
