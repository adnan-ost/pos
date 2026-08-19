#!/usr/bin/env node
/*
 * Points the 84 reshot dishes at their new photographs.
 *
 *   ADMIN_EMAIL=... ADMIN_PIN=... node scripts/menu/apply_images_v4.mjs check
 *   ADMIN_EMAIL=... ADMIN_PIN=... node scripts/menu/apply_images_v4.mjs apply
 *   ADMIN_EMAIL=... ADMIN_PIN=... node scripts/menu/apply_images_v4.mjs verify
 *   ADMIN_EMAIL=... ADMIN_PIN=... node scripts/menu/apply_images_v4.mjs rollback
 *
 * `check` reads the database and the files but writes nothing — run it first.
 * `apply` backs up the current image URLs, uploads, then relinks.
 *
 * Why a new script rather than apply_menu.mjs's sync-images: that one HEADs the
 * object path and skips the upload when something is already there, which is
 * exactly the case here — every replacement shares a path with the picture it
 * replaces, so sync-images would silently keep the old photograph and relink to
 * the same URL.
 *
 * Why a new v4/ prefix rather than overwriting menu-v3/: the existing objects
 * went up with `cache-control: 31536000`. Overwriting a path leaves the CDN and
 * every till browser serving the old picture for up to a year. A new path is
 * fetched fresh, and it leaves the old objects untouched so rollback is a
 * column update rather than a re-upload.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const env = Object.fromEntries(
    readFileSync(join(ROOT, '.env.local'), 'utf8')
        .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#')).map(l => {
            const i = l.indexOf('=');
            return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
        })
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BUCKET = 'menu-images';
const PREFIX = 'menu-v4';
const IMG_ROOT = join(ROOT, 'menu-images-v2');
const SEED = JSON.parse(readFileSync(join(ROOT, 'supabase/seed/menu_v3.json'), 'utf8'));
const REPLACED = new Set(JSON.parse(readFileSync(join(ROOT, 'scripts/menu/replaced_images.json'), 'utf8')));
const BACKUP = join(ROOT, 'supabase/seed/image_urls_pre_v4.json');

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

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const objectPath = (item) => `${PREFIX}/${slug(item.category)}/${slug(item.name)}.webp`;
const publicUrl = (p) => `${URL_}/storage/v1/object/public/${BUCKET}/${p}`;

/* Every seed row whose photograph changed, paired with its file on disk. */
const targets = () => SEED.items
    .filter(i => i.image_file && REPLACED.has(i.name))
    .map(i => ({ ...i, file: join(IMG_ROOT, i.image_file), object: objectPath(i) }));

async function check() {
    const t = targets();
    const missing = t.filter(i => !existsSync(i.file));
    const cats = await rest('categories?select=id,name');
    const catId = Object.fromEntries(cats.map(c => [c.name, c.id]));
    const live = await rest('menu_items?select=id,name,category_id,image');

    let matched = 0;
    const unmatched = [];
    for (const i of t) {
        const rows = live.filter(r => r.name === i.name && r.category_id === catId[i.category]);
        if (rows.length) matched += rows.length; else unmatched.push(`${i.category} / ${i.name}`);
    }
    console.log(`files on disk       : ${t.length - missing.length}/${t.length}`);
    console.log(`database rows matched: ${matched}`);
    console.log(`untouched (keepers) : ${live.length - matched}`);
    if (missing.length) { console.log('MISSING FILES:'); missing.forEach(m => console.log('   ' + m.file)); }
    if (unmatched.length) { console.log('NO DATABASE ROW:'); unmatched.forEach(u => console.log('   ' + u)); }
    if (missing.length || unmatched.length) process.exit(1);
    console.log('\nready — run `apply` to upload and relink');
}

async function apply() {
    const t = targets();

    // Snapshot every current URL first, including the keepers, so a rollback
    // restores the exact prior state rather than an approximation of it.
    const before = await rest('menu_items?select=id,name,category_id,image');
    writeFileSync(BACKUP, JSON.stringify({ takenAt: new Date().toISOString(), items: before }, null, 1));
    console.log(`backed up ${before.length} image URLs -> ${BACKUP}`);

    let uploaded = 0;
    const failed = [];
    const queue = [...t];
    const worker = async () => {
        while (queue.length) {
            const item = queue.shift();
            try {
                const body = readFileSync(item.file);
                const r = await fetch(`${URL_}/storage/v1/object/${BUCKET}/${item.object}`, {
                    method: 'POST',
                    headers: {
                        apikey: ANON, Authorization: `Bearer ${token}`,
                        'Content-Type': 'image/webp',
                        'x-upsert': 'true',
                        'cache-control': '31536000',
                    },
                    body,
                });
                if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 160)}`);
                uploaded++;
                if (uploaded % 20 === 0) console.log(`   uploaded ${uploaded}/${t.length}`);
            } catch (e) {
                failed.push(`${item.name}: ${e.message}`);
            }
        }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    console.log(`uploaded ${uploaded}/${t.length}`);
    if (failed.length) {
        failed.forEach(f => console.error('  FAIL ' + f));
        console.error('\nnothing was relinked — the menu still points at the old pictures');
        process.exit(1);
    }

    // Relink only after every byte is in the bucket: a half-uploaded set that is
    // already linked shows broken images on the till mid-service.
    const cats = await rest('categories?select=id,name');
    const catId = Object.fromEntries(cats.map(c => [c.name, c.id]));
    let linked = 0;
    for (const item of t) {
        // Name *and* category: Channay exists in two categories with its own row
        // in each, and matching on name alone would write one of them twice.
        const q = `menu_items?name=eq.${encodeURIComponent(item.name)}&category_id=eq.${catId[item.category]}`;
        const rows = await rest(q, {
            method: 'PATCH',
            headers: { Prefer: 'return=representation' },
            body: JSON.stringify({ image: publicUrl(item.object) }),
        });
        linked += rows.length;
    }
    console.log(`relinked ${linked} rows`);
}

async function verify() {
    const t = targets();
    const live = await rest('menu_items?select=id,name,category_id,image');
    const cats = await rest('categories?select=id,name');
    const catId = Object.fromEntries(cats.map(c => [c.name, c.id]));

    let pointing = 0, reachable = 0;
    const wrong = [], unreachable = [];
    for (const item of t) {
        const want = publicUrl(item.object);
        const rows = live.filter(r => r.name === item.name && r.category_id === catId[item.category]);
        for (const row of rows) {
            if (row.image === want) pointing++; else wrong.push(`${item.name}: ${row.image}`);
        }
        const head = await fetch(want, { method: 'HEAD' });
        if (head.ok) reachable++; else unreachable.push(`${item.name} -> ${head.status}`);
    }
    const stale = live.filter(r => r.image && r.image.includes('/menu-v3/') && REPLACED.has(r.name));
    console.log(`rows pointing at the new photograph : ${pointing}`);
    console.log(`new objects reachable publicly      : ${reachable}/${t.length}`);
    console.log(`replaced dishes still on old images : ${stale.length}`);
    wrong.forEach(w => console.log('  WRONG ' + w));
    unreachable.forEach(u => console.log('  UNREACHABLE ' + u));
    if (wrong.length || unreachable.length || stale.length) process.exit(1);
    console.log('\nall good');
}

async function rollback() {
    if (!existsSync(BACKUP)) { console.error(`no backup at ${BACKUP}`); process.exit(1); }
    const { items } = JSON.parse(readFileSync(BACKUP, 'utf8'));
    let restored = 0;
    for (const row of items) {
        await rest(`menu_items?id=eq.${row.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ image: row.image }),
        });
        restored++;
    }
    console.log(`restored ${restored} image URLs from ${BACKUP}`);
}

const cmd = process.argv[2];
await signIn();
if (cmd === 'check') await check();
else if (cmd === 'apply') await apply();
else if (cmd === 'verify') await verify();
else if (cmd === 'rollback') await rollback();
else { console.error('usage: apply_images_v4.mjs check|apply|verify|rollback'); process.exit(1); }
