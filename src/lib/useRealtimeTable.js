'use client';
import { useEffect, useRef } from 'react';
import { createClient } from './supabase/client';
import { setChannelHealth, forgetChannel } from './connection';

/*
 * Subscribes to changes on a table and — the part that was missing — refetches
 * after a reconnect.
 *
 * The bug this fixes: supabase-js reconnects a dropped socket on its own, but
 * the events that happened while it was down are gone. Screens that only
 * refetched on an event went on showing whatever they held when the socket died.
 * On a kitchen display that means tickets that never appear, which reads as a
 * quiet service rather than a broken one.
 *
 * So the reconnect itself is treated as a signal: whenever the channel becomes
 * healthy after having been unhealthy, and whenever the network comes back,
 * refetch to close the gap.
 */
export function useRealtimeTable({ table, channel, onChange, enabled = true }) {
    // Held in a ref so a changing callback identity — which is normal, it
    // usually closes over filters — never tears down and rebuilds the socket.
    const onChangeRef = useRef(onChange);
    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
        if (!enabled) return;

        const supabase = createClient();
        // Tracked locally: only a recovery counts as a reason to refetch, not
        // the first successful subscribe (the caller has just loaded).
        let wasUnhealthy = false;

        const client = supabase
            .channel(channel)
            .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
                onChangeRef.current?.();
            })
            .subscribe((status) => {
                const healthy = status === 'SUBSCRIBED';
                setChannelHealth(channel, healthy);

                if (!healthy) {
                    wasUnhealthy = true;
                    return;
                }
                if (wasUnhealthy) {
                    wasUnhealthy = false;
                    onChangeRef.current?.();
                }
            });

        // A laptop lid closing suspends the socket without a status change, so
        // coming back online is its own trigger.
        const refetchOnOnline = () => onChangeRef.current?.();
        window.addEventListener('online', refetchOnOnline);

        // Same for a tab that was backgrounded long enough to miss events.
        const refetchOnVisible = () => {
            if (document.visibilityState === 'visible') onChangeRef.current?.();
        };
        document.addEventListener('visibilitychange', refetchOnVisible);

        return () => {
            window.removeEventListener('online', refetchOnOnline);
            document.removeEventListener('visibilitychange', refetchOnVisible);
            client.unsubscribe();
            forgetChannel(channel);
        };
    }, [table, channel, enabled]);
}
