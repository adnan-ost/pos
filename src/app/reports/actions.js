
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

    return { totalRevenue, totalOrders, avgOrderValue, itemCounts }
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
        trends: {
            revenue: trendPct(current.totalRevenue, previous.totalRevenue),
            orders: trendPct(current.totalOrders, previous.totalOrders),
            avgOrderValue: trendPct(current.avgOrderValue, previous.avgOrderValue)
        }
    }
}
