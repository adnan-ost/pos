
const STORAGE_KEY = 'pos_orders';

export const getOrders = () => {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    try {
        return JSON.parse(stored);
    } catch (e) {
        console.error('Failed to parse orders', e);
        return [];
    }
};

export const addOrder = (order) => {
    const orders = getOrders();
    const newOrder = {
        ...order,
        id: Date.now().toString().slice(-6), // Simple ID generation
        createdAt: new Date().toISOString(),
        status: 'new' // Default status
    };
    const updatedOrders = [newOrder, ...orders];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedOrders));
    return newOrder;
};

export const updateOrderStatus = (orderId, newStatus) => {
    const orders = getOrders();
    const updatedOrders = orders.map(order =>
        order.id === orderId ? { ...order, status: newStatus } : order
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedOrders));
    return updatedOrders;
};

export const clearOrders = () => {
    localStorage.removeItem(STORAGE_KEY);
};
