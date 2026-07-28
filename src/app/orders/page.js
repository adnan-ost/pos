'use client';
import { useState, useEffect } from 'react';
import styles from './orders.module.css';
import { getOrders, updateOrderStatus, getMenuItems } from '@/lib/supabaseDb';
import { supabase } from '@/lib/supabase';
import {
    getOrderNumber, formatOrderDate, buildImageMap, resolveItemImage, formatModifiers
} from '@/lib/orderDisplay';
import { UtensilsCrossed } from 'lucide-react';

export default function OrdersPage() {
    const [orders, setOrders] = useState([]);
    const [activeTab, setActiveTab] = useState('all');
    const [itemImages, setItemImages] = useState({});

    useEffect(() => {
        getMenuItems().then(items => setItemImages(buildImageMap(items)));

        // Load orders on mount
        loadOrders();

        // Real-time subscription for new orders
        const subscription = supabase
            .channel('orders_channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, payload => {
                loadOrders();
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const loadOrders = async () => {
        try {
            const data = await getOrders();
            setOrders(data);
        } catch (error) {
            console.error("Failed to load orders", error);
        }
    };

    const filteredOrders = orders.filter(order => {
        if (activeTab === 'all') return true;
        return order.status === activeTab;
    });

    const handleStatusUpdate = async (orderId, currentStatus) => {
        const flow = ['new', 'preparing', 'ready', 'completed'];
        const currentIndex = flow.indexOf(currentStatus);
        if (currentIndex < flow.length - 1) {
            const nextStatus = flow[currentIndex + 1];
            try {
                await updateOrderStatus(orderId, nextStatus);
                // State will auto-update via subscription, but for instant feedback:
                loadOrders();
            } catch (error) {
                console.error("Failed to update status", error);
            }
        }
    };

    const getStatusLabel = (status) => {
        const labels = {
            new: 'New',
            preparing: 'Preparing',
            ready: 'Ready',
            completed: 'Completed'
        };
        return labels[status] || status;
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>Orders</h1>
                <div className={styles.filters}>
                    {['all', 'new', 'preparing', 'ready', 'completed'].map(tab => (
                        <button
                            key={tab}
                            className={`${styles.filterTab} ${activeTab === tab ? styles.active : ''}`}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            <div className={styles.ordersGrid}>
                {filteredOrders.map(order => (
                    <div key={order.id} className={styles.orderCard}>
                        <div className={styles.cardHeader}>
                            <div>
                                <div className={styles.orderId}>Order #{getOrderNumber(order)}</div>
                                <div className={styles.orderTime}>
                                    {formatOrderDate(order.created_at)}
                                </div>
                            </div>
                            <span className={`${styles.statusBadge} ${styles[`status_${order.status}`]}`}>
                                {getStatusLabel(order.status)}
                            </span>
                        </div>

                        <div className={styles.itemsList}>
                            {order.items.map((item, idx) => {
                                const image = resolveItemImage(item, itemImages);
                                const mods = formatModifiers(item);
                                return (
                                    <div key={idx} className={styles.itemRow}>
                                        {image ? (
                                            <img src={image} alt="" className={styles.itemThumb} />
                                        ) : (
                                            <div className={styles.itemThumbFallback}>
                                                <UtensilsCrossed size={16} />
                                            </div>
                                        )}
                                        <div className={styles.itemInfo}>
                                            <div className={styles.itemName}>
                                                <span className={styles.itemQty}>{item.qty}x</span>
                                                {item.name}
                                            </div>
                                            {mods && (
                                                <div className={styles.itemModifiers}>{mods}</div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className={styles.cardFooter}>
                            <div className={styles.totalAmount}>
                                Rs. {order.total.toLocaleString()}
                            </div>
                            {order.status !== 'completed' && (
                                <button
                                    className={styles.actionBtn}
                                    onClick={() => handleStatusUpdate(order.id, order.status)}
                                >
                                    Next Status →
                                </button>
                            )}
                        </div>
                    </div>
                ))}

                {filteredOrders.length === 0 && (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--muted-foreground)', marginTop: '2rem' }}>
                        No orders in this category.
                    </div>
                )}
            </div>
        </div>
    );
}
