/*
 * Reads the menu the website publishes.
 *
 * The restaurant authors its menu in Sanity (flamesbytheindus.com); the till
 * keeps its own copy in Supabase. This module is the only place the POS talks
 * to Sanity, and it only ever reads.
 *
 * Two deliberate constraints:
 *
 * 1. No token. The dataset is public, so this is a plain GET against Sanity's
 *    CDN. Nothing secret belongs on a till — a write token here would hand
 *    every terminal the ability to edit the public website.
 *
 * 2. Never on the ordering path. Nothing in the POS reads this to price an
 *    order; it runs only when an admin asks for a sync from Settings. The till
 *    goes on selling exactly as normal when Sanity, or the internet, is down.
 */

const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || '';
const DATASET = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production';

// Pinned, never "latest": an API version that drifts silently is a menu that
// changes shape without anyone deciding it should.
const API_VERSION = '2026-08-24';

// apicdn, not api: the cached edge endpoint. A menu sync does not need
// second-fresh reads, and the CDN is what the dataset's public access is for.
const HOST = `https://${PROJECT_ID}.apicdn.sanity.io`;

// Exactly the fields sync_menu_from_sanity reads. Asking for the whole
// document would drag portable-text bodies and image metadata across for
// nothing.
const QUERY = `*[_type == "dish" && defined(name) && defined(price)]{
  _id, name, description, price, "sizes": sizes[]{label, price}
}`;

const isSanityConfigured = () => PROJECT_ID.trim().length > 0;

/*
 * Fetches every dish. Returns the array the RPC expects.
 *
 * Throws rather than returning a partial list: the sync's own guard refuses a
 * payload smaller than half the menu, but a caller that swallowed the error
 * and passed `[]` would look like "the website has no dishes" rather than
 * "the request failed", so the failure is kept loud here.
 */
export const fetchSanityDishes = async ({ signal } = {}) => {
    if (!isSanityConfigured()) {
        throw new Error(
            'Sanity is not configured. Add NEXT_PUBLIC_SANITY_PROJECT_ID and ' +
            'NEXT_PUBLIC_SANITY_DATASET to the environment.'
        );
    }

    const url = `${HOST}/v${API_VERSION}/data/query/${encodeURIComponent(DATASET)}` +
        `?query=${encodeURIComponent(QUERY)}`;

    const res = await fetch(url, { signal, cache: 'no-store' });

    if (!res.ok) {
        throw new Error(`The website's menu could not be read (HTTP ${res.status}).`);
    }

    const body = await res.json();
    if (!Array.isArray(body?.result)) {
        throw new Error("The website's menu came back in an unexpected shape.");
    }

    return body.result;
};
