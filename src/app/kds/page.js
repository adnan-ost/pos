'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import Image from 'next/image';
import styles from './kds.module.css';
import { getOrders, updateOrderStatus, getMenuItems } from '@/lib/supabaseDb';
import { supabase } from '@/lib/supabase';
import {
    getOrderNumber, buildImageMap, resolveItemImage, formatModifiers
} from '@/lib/orderDisplay';
import LiveClock from '@/components/Layout/LiveClock';
import { UtensilsCrossed, Volume2, VolumeX, Maximize2, UserRound } from 'lucide-react';

// Kitchen lanes, in the order tickets flow across the screen
const LANES = [
    { key: 'new', label: 'New', next: 'preparing', action: 'Start' },
    { key: 'preparing', label: 'Preparing', next: 'ready', action: 'Ready' },
    { key: 'ready', label: 'Ready', next: 'completed', action: 'Serve' }
];

// Minutes since an order landed, used to escalate a ticket's urgency
const WARN_AFTER = 5;
const LATE_AFTER = 10;

const ORDER_TYPE_LABEL = {
    'dine-in': 'Dine-in',
    'takeaway': 'Takeaway',
    'delivery': 'Delivery'
};

export default function KDSPage() {
    const [orders, setOrders] = useState([]);
    const [imageMap, setImageMap] = useState({});
    const [now, setNow] = useState(null); // null until mounted, to avoid SSR drift
    const [soundOn, setSoundOn] = useState(true);
    const knownIds = useRef(null);

    useEffect(() => {
        getMenuItems().then(items => setImageMap(buildImageMap(items)));
        loadOrders();

        const subscription = supabase
            .channel('kds_channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
                loadOrders();
            })
            .subscribe();

        // Safety net: this board runs unattended for a whole service, and a
        // dropped socket would silently stop new tickets from appearing.
        const poll = setInterval(loadOrders, 15000);

        return () => {
            subscription.unsubscribe();
            clearInterval(poll);
        };
    }, []);

    // Ticket age drives the colour coding, so keep a ticking clock
    useEffect(() => {
        setNow(Date.now());
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    const loadOrders = async () => {
        try {
            const data = await getOrders();
            const active = data.filter(o => LANES.some(l => l.key === o.status));

            // Chime when a ticket appears that we have not seen before. The
            // first load seeds the set instead of firing for every open order.
            const ids = new Set(active.map(o => o.id));
            if (knownIds.current === null) {
                knownIds.current = ids;
            } else {
                const isNew = active.some(o => !knownIds.current.has(o.id));
                knownIds.current = ids;
                if (isNew) chime();
            }

            setOrders(active);
        } catch (error) {
            console.error('Failed to load KDS orders', error);
        }
    };

    // Short two-tone beep via Web Audio, so no asset is needed
    const soundOnRef = useRef(soundOn);
    soundOnRef.current = soundOn;

    const chime = () => {
        if (!soundOnRef.current) return;
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            [880, 1320].forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.value = freq;
                osc.type = 'sine';
                const start = ctx.currentTime + i * 0.18;
                gain.gain.setValueAtTime(0.0001, start);
                gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
                osc.start(start);
                osc.stop(start + 0.18);
            });
            setTimeout(() => ctx.close(), 800);
        } catch {
            // Audio is a nicety; never let it break the board
        }
    };

    const handleBump = async (order, nextStatus) => {
        // Optimistic: the board must feel instant under a busy pass
        setOrders(prev => nextStatus === 'completed'
            ? prev.filter(o => o.id !== order.id)
            : prev.map(o => (o.id === order.id ? { ...o, status: nextStatus } : o))
        );
        try {
            await updateOrderStatus(order.id, nextStatus);
        } catch (error) {
            console.error('Failed to bump order', error);
            loadOrders(); // resync on failure
        }
    };

    const elapsedMinutes = (order) =>
        now === null ? null : (now - new Date(order.created_at).getTime()) / 60000;

    const formatElapsed = (order) => {
        const mins = elapsedMinutes(order);
        if (mins === null) return '--:--';
        const total = Math.max(0, Math.floor(mins * 60));
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        const s = total % 60;
        return h > 0
            ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
            : `${m}:${String(s).padStart(2, '0')}`;
    };

    const urgency = (order) => {
        const mins = elapsedMinutes(order);
        if (mins === null) return '';
        if (mins >= LATE_AFTER) return styles.late;
        if (mins >= WARN_AFTER) return styles.warn;
        return '';
    };

    // Oldest first: the kitchen works tickets FIFO
    const lanes = useMemo(() => {
        const byLane = {};
        LANES.forEach(lane => {
            byLane[lane.key] = orders
                .filter(o => o.status === lane.key)
                .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        });
        return byLane;
    }, [orders]);

    const goFullscreen = () => {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen?.();
    };

    return (
        <div className={styles.screen}>
            <header className={styles.topBar}>
                <div className={styles.brand}>
                    <Image
                        src="/flames-by-the-indus-logo.svg"
                        alt="Flames by the Indus"
                        width={180}
                        height={54}
                        priority
                        className={styles.logo}
                    />
                    <span className={styles.divider} />
                    <div>
                        <h1 className={styles.title}>Kitchen Display</h1>
                        <div className={styles.subtitle}>
                            <span className={styles.liveDot} />
                            Live service
                        </div>
                    </div>
                </div>

                <div className={styles.topRight}>
                    <LiveClock className={styles.clock} showSeconds iconSize={18} />
                    <button
                        className={styles.iconBtn}
                        onClick={() => setSoundOn(v => !v)}
                        title={soundOn ? 'Mute new-order alert' : 'Unmute new-order alert'}
                    >
                        {soundOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
                    </button>
                    <button className={styles.iconBtn} onClick={goFullscreen} title="Fullscreen">
                        <Maximize2 size={20} />
                    </button>
                </div>
            </header>

            <div className={styles.lanes}>
                {LANES.map(lane => (
                    <section key={lane.key} className={styles.lane}>
                        <div className={`${styles.laneHeader} ${styles[`lane_${lane.key}`]}`}>
                            <span className={styles.laneLabel}>{lane.label}</span>
                            <span className={styles.laneCount}>{lanes[lane.key].length}</span>
                        </div>

                        <div className={styles.laneBody}>
                            {lanes[lane.key].map(order => (
                                <article key={order.id} className={`${styles.ticket} ${urgency(order)}`}>
                                    <div className={styles.ticketHead}>
                                        <div>
                                            <div className={styles.ticketNumber}>
                                                #{getOrderNumber(order)}
                                            </div>
                                            <div className={styles.ticketMeta}>
                                                {ORDER_TYPE_LABEL[order.order_type] || order.order_type}
                                                {order.table_number && ` · ${order.table_number}`}
                                            </div>
                                            {order.waiter_name && (
                                                <div className={styles.ticketWaiter}>
                                                    <UserRound size={13} aria-hidden="true" />
                                                    {order.waiter_name}
                                                </div>
                                            )}
                                        </div>
                                        <div className={styles.timer}>{formatElapsed(order)}</div>
                                    </div>

                                    <ul className={styles.items}>
                                        {order.items.map((item, idx) => {
                                            const image = resolveItemImage(item, imageMap);
                                            const mods = formatModifiers(item);
                                            return (
                                                <li key={idx} className={styles.item}>
                                                    {image ? (
                                                        <img src={image} alt="" className={styles.thumb} />
                                                    ) : (
                                                        <span className={styles.thumbFallback}>
                                                            <UtensilsCrossed size={18} />
                                                        </span>
                                                    )}
                                                    <span className={styles.itemText}>
                                                        <span className={styles.qty}>{item.qty}</span>
                                                        {item.name}
                                                        {mods && <span className={styles.mods}>{mods}</span>}
                                                    </span>
                                                </li>
                                            );
                                        })}
                                    </ul>

                                    {order.notes && (
                                        <div className={styles.notes}>{order.notes}</div>
                                    )}

                                    <button
                                        className={styles.bumpBtn}
                                        onClick={() => handleBump(order, lane.next)}
                                    >
                                        {lane.action}
                                    </button>
                                </article>
                            ))}

                            {lanes[lane.key].length === 0 && (
                                <div className={styles.emptyLane}>No tickets</div>
                            )}
                        </div>
                    </section>
                ))}
            </div>
        </div>
    );
}
