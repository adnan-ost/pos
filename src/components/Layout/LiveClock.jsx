'use client';
import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

/**
 * Local wall-clock time, ticking once a second.
 *
 * Rendered only after mount: the server and the kitchen screen sit in
 * different timezones, so formatting during SSR would hydrate mismatched.
 */
export default function LiveClock({ showDate = true, showSeconds = false, className = '', iconSize = 16 }) {
    const [now, setNow] = useState(null);

    useEffect(() => {
        setNow(new Date());
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    if (!now) {
        // Reserve the space so the surrounding layout does not jump
        return <span className={className} suppressHydrationWarning />;
    }

    const time = now.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
        ...(showSeconds && { second: '2-digit' })
    });

    const date = now.toLocaleDateString([], {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
    });

    return (
        <span className={className} suppressHydrationWarning>
            <Clock size={iconSize} aria-hidden="true" />
            <strong>{time}</strong>
            {showDate && <span>{date}</span>}
        </span>
    );
}
