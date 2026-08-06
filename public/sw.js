/*
 * App-shell cache for the till.
 *
 * The problem this solves is narrow and worth being precise about: when the
 * connection drops, a reload used to give staff the browser's dinosaur. The
 * shell is now served from cache, so the app still paints and can say what's
 * wrong instead of vanishing.
 *
 * This caches the *shell*, never data. Nothing here queues writes or replays
 * anything — a cached order would be far more dangerous than a missing one.
 *
 * Deliberate exclusions:
 *   - anything but GET, so no write is ever intercepted
 *   - cross-origin requests, which includes every Supabase call: auth, data and
 *     realtime must always hit the network or the till would act on stale rows
 *   - /auth/* and /login, so a session is never decided from cache
 */

const VERSION = 'v1';
const SHELL_CACHE = `flames-shell-${VERSION}`;
const ASSET_CACHE = `flames-assets-${VERSION}`;
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(SHELL_CACHE)
            .then(cache => cache.addAll([OFFLINE_URL]))
            // Take over immediately: a till left on a half-updated worker for a
            // whole service is worse than a single reload now.
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys
                    .filter(key => key.startsWith('flames-') && !key.endsWith(VERSION))
                    .map(key => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

const isCacheableAsset = (url) =>
    // Content-hashed by the build, so cache-first can never serve a stale
    // version of a file that has changed.
    url.pathname.startsWith('/_next/static/')
    || url.pathname.startsWith('/icons/')
    || /\.(?:png|jpg|jpeg|svg|webp|avif|ico|woff2?)$/.test(url.pathname);

self.addEventListener('fetch', (event) => {
    const { request } = event;

    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // Same-origin only. Supabase is another origin, so this covers every data,
    // auth and storage call in one condition.
    if (url.origin !== self.location.origin) return;

    if (url.pathname.startsWith('/auth/') || url.pathname === '/login') return;

    if (isCacheableAsset(url)) {
        event.respondWith(
            caches.match(request).then(hit => hit || fetch(request).then(response => {
                // Opaque or failed responses aren't worth keeping.
                if (response.ok) {
                    const copy = response.clone();
                    caches.open(ASSET_CACHE).then(cache => cache.put(request, copy));
                }
                return response;
            }))
        );
        return;
    }

    /*
     * Navigations are network-first: the app is behind a login and reads live
     * data, so a cached page must never win over a reachable server. Cache is
     * only a fallback for when there's nothing to reach.
     */
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then(response => {
                    const copy = response.clone();
                    caches.open(SHELL_CACHE).then(cache => cache.put(request, copy));
                    return response;
                })
                .catch(async () => {
                    const cached = await caches.match(request);
                    return cached || caches.match(OFFLINE_URL);
                })
        );
    }
});
