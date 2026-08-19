#!/usr/bin/env node
/*
 * Applies supabase/seed/menu_v3.json to the database.
 *
 *   node scripts/menu/apply_menu.mjs backup    dump current menu to a file
 *   node scripts/menu/apply_menu.mjs upload    push images to the menu-images bucket
 *   node scripts/menu/apply_menu.mjs replace   swap the live menu for the seed
 *
 * Split into phases on purpose: uploading is slow and idempotent, replacing is
 * destructive and fast. Running them separately means a failed upload never
 * leaves the till with no menu.
 *
 * Writes go through a signed-in admin session because RLS only grants menu
 * changes to authenticated users.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const env = Object.fromEntries(
    readFileSync(join(ROOT, '.env.local'), 'utf8')
        .split('\n').filter(l => l.includes('=')).map(l => {
            const i = l.indexOf('=');
            return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
        })
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BUCKET = 'menu-images';
const IMG_ROOT = join(ROOT, 'Digital_Menu_Item_Images (webp 800)');
const SEED = JSON.parse(readFileSync(join(ROOT, 'supabase/seed/menu_v3.json'), 'utf8'));

const EMAIL = process.env.ADMIN_EMAIL;
const PIN = process.env.ADMIN_PIN;
if (!EMAIL || !PIN) {
    console.error('Set ADMIN_EMAIL and ADMIN_PIN in the environment.');
    process.exit(1);
}

let token;
const signIn = async () => {
    const r = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: ANON, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, password: PIN }),
    });
    const j = await r.json();
    if (!j.access_token) throw new Error('sign-in failed: ' + JSON.stringify(j));
    token = j.access_token;
};

const H = () => ({ apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });

const rest = async (path, opts = {}) => {
    const r = await fetch(`${URL_}/rest/v1/${path}`, { ...opts, headers: { ...H(), ...(opts.headers || {}) } });
    const text = await r.text();
    if (!r.ok) throw new Error(`${opts.method || 'GET'} ${path} -> ${r.status} ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : null;
};

// Stable, readable object names so a re-run overwrites rather than duplicating
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const objectPath = (item) => `menu-v3/${slug(item.category)}/${slug(item.name)}.webp`;
const publicUrl = (p) => `${URL_}/storage/v1/object/public/${BUCKET}/${p}`;

async function backup() {
    const cats = await rest('categories?select=*');
    const items = await rest('menu_items?select=*');
    const out = join(ROOT, 'supabase/seed/menu_backup_pre_v3.json');
    writeFileSync(out, JSON.stringify({ takenAt: new Date().toISOString(), categories: cats, items }, null, 1));
    console.log(`backed up ${cats.length} categories and ${items.length} items -> ${out}`);
}

async function upload() {
    const withImg = SEED.items.filter(i => i.image_file);
    let done = 0, failed = [];

    // Small concurrency: enough to be quick, not enough to get rate limited
    const queue = [...withImg];
    const worker = async () => {
        while (queue.length) {
            const item = queue.shift();
            const path = objectPath(item);
            try {
                const body = readFileSync(join(IMG_ROOT, item.image_file));
                const r = await fetch(`${URL_}/storage/v1/object/${BUCKET}/${path}`, {
                    method: 'POST',
                    headers: {
                        apikey: ANON, Authorization: `Bearer ${token}`,
                        'Content-Type': 'image/webp',
                        'x-upsert': 'true',        // re-runs replace instead of failing
                        'cache-control': '31536000',
                    },
                    body,
                });
                if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 160)}`);
                done++;
                if (done % 20 === 0) console.log(`   ${done}/${withImg.length}`);
            } catch (e) {
                failed.push(`${item.name}: ${e.message}`);
            }
        }
    };
    await Promise.all(Array.from({ length: 6 }, worker));

    console.log(`uploaded ${done}/${withImg.length}`);
    if (failed.length) { failed.forEach(f => console.error('  FAIL ' + f)); process.exit(1); }
}

async function replace() {
    // Items first: categories are referenced by them.
    const oldItems = await rest('menu_items?select=id');
    const oldCats = await rest('categories?select=id');
    if (oldItems.length) await rest('menu_items?id=neq.00000000-0000-0000-0000-000000000000', { method: 'DELETE' });
    if (oldCats.length) await rest('categories?id=neq.00000000-0000-0000-0000-000000000000', { method: 'DELETE' });
    console.log(`removed ${oldItems.length} items, ${oldCats.length} categories`);

    const cats = await rest('categories', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(SEED.categories),
    });
    const idOf = Object.fromEntries(cats.map(c => [c.name, c.id]));
    console.log(`inserted ${cats.length} categories`);

    const rows = SEED.items.map(i => ({
        name: i.name,
        category_id: idOf[i.category],
        description: i.description || null,
        price: i.price,
        variants: i.variants,
        image: i.image_file ? publicUrl(objectPath(i)) : null,
        is_available: true,
    }));
    const inserted = await rest('menu_items', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(rows),
    });
    console.log(`inserted ${inserted.length} items`);
}

const cmd = process.argv[2];
await signIn();
if (cmd === 'backup') await backup();
else if (cmd === 'upload') await upload();
else if (cmd === 'replace') await replace();
else { console.error('usage: apply_menu.mjs backup|upload|replace'); process.exit(1); }
