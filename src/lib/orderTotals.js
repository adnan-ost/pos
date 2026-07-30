// Money for an order, in one place. The POS cart, an appended round and the
// settled bill all price the same way, so they can never drift apart.

export const TAX_RATE = 0.16; // FBR GST

export const calcTotals = (items, includeTax = true) => {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    const tax = includeTax ? Math.round(subtotal * TAX_RATE) : 0;
    return { subtotal, tax, total: subtotal + tax };
};

// Rounds are stamped on each line as it is fired, so the kitchen can tell a
// freshly added course from food it has already cooked. Lines predating this
// (orders placed before tabs existed) read as round 1.
export const itemRound = (item) => item.round || 1;

export const isLatestRound = (item, order) =>
    (order?.round_count || 1) > 1 && itemRound(item) === order.round_count;
