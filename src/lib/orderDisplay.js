// Shared display helpers for the Orders and KDS screens.

import { formatClockTime, formatDayMonth } from './timeFormat';

// Prefer the human-readable order_number; fall back to the UUID's head
export const getOrderNumber = (order) =>
    order.order_number || order.id.slice(0, 6).toUpperCase();

// "Today, 8:34 PM" for the current shift; dated otherwise
export const formatOrderDate = (createdAt) => {
    const date = new Date(createdAt);
    const time = formatClockTime(date);

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const sameDay = (a, b) => a.toDateString() === b.toDateString();

    if (sameDay(date, today)) return `Today, ${time}`;
    if (sameDay(date, yesterday)) return `Yesterday, ${time}`;

    return `${formatDayMonth(date)}, ${time}`;
};

// name -> image lookup, so orders whose line items predate the stored
// `image` field can still show a thumbnail
export const buildImageMap = (menuItems) => {
    const map = {};
    menuItems.forEach(mi => { if (mi.image) map[mi.name] = mi.image; });
    return map;
};

// Cart item names carry a variant suffix, e.g. "Chicken Karahi (Full)"
export const resolveItemImage = (item, imageMap) =>
    item.image || imageMap[item.name] || imageMap[item.name.replace(/\s*\(.*\)\s*$/, '')];

// Flattened modifier names, e.g. "Spicy, Raita"
export const formatModifiers = (item) =>
    item.selectedModifiers
        ? Object.values(item.selectedModifiers).flat().map(m => m.name).join(', ')
        : '';
