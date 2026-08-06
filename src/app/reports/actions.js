
'use server'

import { createClient } from '@/lib/supabase/server'
import { startOfDay, endOfDay, subDays, differenceInMilliseconds, format, parseISO } from 'date-fns'

// Aggregate a set of orders into the numbers the dashboard needs.
function summarize(orders) {
    const totalRevenue = orders.reduce((sum, order) => sum + (order.total || 0), 0)
    const totalOrders = orders.length
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

    const itemCounts = {}
    orders.forEach(order => {
        if (order.items && Array.isArray(order.items)) {
            order.items.forEach(item => {
                const name = item.name
                if (!itemCounts[name]) {
                    itemCounts[name] = { name, count: 0, revenue: 0 }
                }
                itemCounts[name].count += item.qty || 1
                itemCounts[name].revenue += (item.price * (item.qty || 1))
            })
        }
    })

    /*
     * The figures below come from columns that were already being stored and
     * simply weren't reported on: payment_mode, waiter_name, tax, discount and
     * the timestamp. No new data collection, so they work retroactively over
     * whatever history already exists.
     */

    // Total tax collected — needed for filing, and previously nowhere on screen.
    const totalTax = orders.reduce((sum, order) => sum + (Number(order.tax) || 0), 0)
    const totalDiscount = orders.reduce((sum, order) => sum + (Number(order.discount) || 0), 0)

    /*
     * Cash vs card, plus what's still owed on open tabs. Counted by amount and
     * by order, because "half the orders were card" and "half the money was
     * card" are different questions and a till gets asked both.
     *
     * Orders with no payment_mode recorded get their own bucket rather than
     * being folded into cash. Plenty of history predates the field, and
     * reporting an unknown as cash would state something untrue about where the
     * money went.
     */
    const paymentMix = {
        cash: { amount: 0, count: 0 },
        card: { amount: 0, count: 0 },
        unpaid: { amount: 0, count: 0 },
        unrecorded: { amount: 0, count: 0 },
    }
    orders.forEach(order => {
        let bucket
        if (order.payment_status === 'unpaid') bucket = 'unpaid'
        else if (order.payment_mode === 'card') bucket = 'card'
        else if (order.payment_mode === 'cash') bucket = 'cash'
        else bucket = 'unrecorded'

        paymentMix[bucket].amount += Number(order.total) || 0
        paymentMix[bucket].count += 1
    })

    // Takings by hour of day, for staffing decisions. Every hour is present even
    // at zero, so the shape of a service is readable rather than inferred from
    // gaps.
    const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, label: hourLabel(hour), revenue: 0, orders: 0 }))
    orders.forEach(order => {
        const hour = new Date(order.created_at).getHours()
        hourly[hour].revenue += Number(order.total) || 0
        hourly[hour].orders += 1
    })

    // Per-server takings. waiter_name is denormalised onto the order, so this
    // still attributes correctly after someone leaves.
    const waiterTotals = {}
    orders.forEach(order => {
        const name = order.waiter_name
        if (!name) return
        if (!waiterTotals[name]) waiterTotals[name] = { name, revenue: 0, orders: 0 }
        waiterTotals[name].revenue += Number(order.total) || 0
        waiterTotals[name].orders += 1
    })

    return {
        totalRevenue, totalOrders, avgOrderValue, itemCounts,
        totalTax, totalDiscount, paymentMix, hourly,
        waiters: Object.values(waiterTotals).sort((a, b) => b.revenue - a.revenue),
    }
}

// 12-hour labels, matching how times read everywhere else in the app
function hourLabel(hour) {
    const period = hour < 12 ? 'AM' : 'PM'
    const twelve = hour % 12 === 0 ? 12 : hour % 12
    return `${twelve} ${period}`
}

// % change from `previous` to `current`. Null when there is no baseline to
// compare against (avoids a misleading "+∞%" or "+100%" off a zero start).
function trendPct(current, previous) {
    if (!previous) return null
    return ((current - previous) / previous) * 100
}

export async function getDashboardStats(range = 'today', endDateStr = null) {
    const supabase = await createClient()

    // Determine date range
    const now = new Date()
    let startDate = startOfDay(now)
    let endDate = endOfDay(now)

    // Check if range is a specific date (YYYY-MM-DD) or date range
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (dateRegex.test(range)) {
        const specificDate = parseISO(range);
        startDate = startOfDay(specificDate);
        // If endDateStr is provided, use it; otherwise use the same day
        if (endDateStr && dateRegex.test(endDateStr)) {
            endDate = endOfDay(parseISO(endDateStr));
        } else {
            endDate = endOfDay(specificDate);
        }
    } else if (range === '7days') {
        startDate = subDays(now, 7)
    } else if (range === '30days') {
        startDate = subDays(now, 30)
    }

    // The immediately preceding period of equal length, used for trend %s
    // e.g. "7 Days" compares against the 7 days before that.
    const durationMs = differenceInMilliseconds(endDate, startDate)
    const prevEndDate = new Date(startDate.getTime() - 1)
    const prevStartDate = new Date(prevEndDate.getTime() - durationMs)

    const fetchOrders = async (from, to) => {
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .gte('created_at', from.toISOString())
            .lte('created_at', to.toISOString())
            .neq('status', 'cancelled') // Exclude cancelled orders
        if (error) throw error
        return data
    }

    let orders, prevOrders
    try {
        [orders, prevOrders] = await Promise.all([
            fetchOrders(startDate, endDate),
            fetchOrders(prevStartDate, prevEndDate)
        ])
    } catch (error) {
        console.error('Error fetching stats:', error)
        return { error: 'Failed to fetch stats' }
    }

    const current = summarize(orders)
    const previous = summarize(prevOrders)

    // Chart Data: Sales over time
    const salesByDate = {}
    orders.forEach(order => {
        const dateStr = format(parseISO(order.created_at), 'MMM dd')
        if (!salesByDate[dateStr]) {
            salesByDate[dateStr] = { date: dateStr, sales: 0, orders: 0 }
        }
        salesByDate[dateStr].sales += order.total || 0
        salesByDate[dateStr].orders += 1
    })
    const chartData = Object.values(salesByDate).sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    // Top Selling Items — highest volume this period
    const topItems = Object.values(current.itemCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)

    // Trending Items — biggest increase in units sold vs. the prior period.
    // Distinct from "top selling": a low-volume item climbing fast still
    // shows up here even if it doesn't crack the top 5 by raw count.
    const trendingItems = Object.values(current.itemCounts)
        .map(item => {
            const prevCount = previous.itemCounts[item.name]?.count || 0
            return { ...item, prevCount, growth: item.count - prevCount }
        })
        .filter(item => item.growth > 0)
        .sort((a, b) => b.growth - a.growth)
        .slice(0, 5)

    return {
        totalRevenue: current.totalRevenue,
        totalOrders: current.totalOrders,
        avgOrderValue: current.avgOrderValue,
        chartData,
        topItems,
        trendingItems,
        totalTax: current.totalTax,
        totalDiscount: current.totalDiscount,
        paymentMix: current.paymentMix,
        // Trimmed to the trading part of the day so the chart isn't mostly empty
        // bars, but kept whole if the kitchen genuinely ran round the clock.
        hourly: current.hourly.filter(h => h.orders > 0).length
            ? current.hourly.slice(
                Math.min(...current.hourly.filter(h => h.orders > 0).map(h => h.hour)),
                Math.max(...current.hourly.filter(h => h.orders > 0).map(h => h.hour)) + 1
            )
            : [],
        waiters: current.waiters,
        trends: {
            revenue: trendPct(current.totalRevenue, previous.totalRevenue),
            orders: trendPct(current.totalOrders, previous.totalOrders),
            avgOrderValue: trendPct(current.avgOrderValue, previous.avgOrderValue)
        }
    }
}
