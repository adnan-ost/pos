'use client';
import { useEffect } from 'react';

/*
 * Registers the app-shell worker.
 *
 * Development is excluded deliberately: a worker caching the shell across HMR
 * reloads produces exactly the sort of "why am I seeing old code" confusion
 * that costs an afternoon.
 */
export default function ServiceWorkerRegistrar() {
    useEffect(() => {
        if (process.env.NODE_ENV !== 'production') return;
        if (!('serviceWorker' in navigator)) return;

        navigator.serviceWorker.register('/sw.js').catch(error => {
            // Not fatal — the app works without it, just without an offline
            // shell. Worth logging rather than swallowing.
            console.error('Service worker registration failed', error);
        });
    }, []);

    return null;
}
