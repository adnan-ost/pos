/*
 * Keeps the in-progress order on the device.
 *
 * Nothing persisted it before, so a refresh, an accidental back-swipe or a
 * tablet running out of memory mid-order lost the whole basket — with the
 * customer standing there while it gets re-rung. Local only: it holds what
 * hasn't been sent to the kitchen yet, never anything that belongs on the
 * server.
 */

/*
 * Alongside the basket this carries `requestId` — the id that makes that
 * basket's checkout safe to retry. It belongs here rather than in memory
 * precisely because the crash is the case it exists for: without it a recovered
 * order that had actually landed before the tablet died would be rung up twice.
 */
const KEY = 'pos:draft:v1';

/*
 * A draft is only restored if it's recent. A basket left over from last night's
 * service is worse than an empty one — it looks like a live order, and the
 * prices or availability behind it may have moved since.
 */
const MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6 hours

export const loadCartDraft = () => {
    // Guarded because this module is imported by a component Next also renders
    // on the server.
    if (typeof window === 'undefined') return null;

    try {
        const raw = window.localStorage.getItem(KEY);
        if (!raw) return null;

        const draft = JSON.parse(raw);
        if (!draft?.savedAt || Date.now() - draft.savedAt > MAX_AGE_MS) {
            window.localStorage.removeItem(KEY);
            return null;
        }
        if (!Array.isArray(draft.cart) || draft.cart.length === 0) return null;

        return draft;
    } catch {
        // Corrupt or unreadable (private mode, quota, hand-edited): treat it as
        // no draft rather than breaking the till on load.
        return null;
    }
};

export const saveCartDraft = (draft) => {
    if (typeof window === 'undefined') return;

    try {
        if (!draft.cart || draft.cart.length === 0) {
            window.localStorage.removeItem(KEY);
            return;
        }
        window.localStorage.setItem(KEY, JSON.stringify({ ...draft, savedAt: Date.now() }));
    } catch {
        // Out of quota or storage disabled — the order still works, it just
        // won't survive a reload.
    }
};

export const clearCartDraft = () => {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.removeItem(KEY);
    } catch {
        // Nothing useful to do; the age check retires it anyway.
    }
};
