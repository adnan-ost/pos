'use client';
import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { formatClockTime, formatWeekdayDate } from '@/lib/timeFormat';

/**
 * Local wall-clock time, ticking once a second.
 *
 * Rendered only after mount: the server and the kitchen screen sit in
 * different timezones, so formatting during SSR would hydrate mismatched.
 */
export default function LiveClock({ showDate = true, showSeconds = false, className = '', iconSize = 16 }) {
    const [now, setNow] = useState(null);

    useEffect(() => {
        // Seeding on mount is the whole point of `now` starting null: the server
        // can't know the till's timezone, so it renders the placeholder below and
        // the real time appears on the client. Waiting for the first interval tick
        // instead would leave the clock blank for a second on every page.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setNow(new Date());
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    if (!now) {
        // Reserve the space so the surrounding layout does not jump
        return <span className={className} suppressHydrationWarning />;
    }

    const time = formatClockTime(now, { withSeconds: showSeconds });
    const date = formatWeekdayDate(now);

    return (
        <span className={className} suppressHydrationWarning>
            <Clock size={iconSize} aria-hidden="true" />
            <strong>{time}</strong>
            {showDate && <span>{date}</span>}
        </span>
    );
}
