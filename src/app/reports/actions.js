
'use server'

import { createClient } from '@/lib/supabase/server'
import { startOfDay, endOfDay, subDays, format, parseISO } from 'date-fns'

export async function getDashboardStats(range = 'today') {
    const supabase = await createClient()

    // Determine date range
    const now = new Date()
    let startDate = startOfDay(now)
    let endDate = endOfDay(now)

    if (range === '7days') {
        startDate = subDays(now, 7)
    } else if (range === '30days') {
        startDate = subDays(now, 30)
    }

    // Fetch orders
    const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .neq('status', 'cancelled') // Exclude cancelled orders

    if (error) {
        console.error('Error fetching stats:', error)
        return { error: 'Failed to fetch stats' }
    }

    // Aggregate Data
    const totalRevenue = orders.reduce((sum, order) => sum + (order.total || 0), 0)
    const totalOrders = orders.length
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

    // Chart Data: Sales over time
    // Group by date
    const salesByDate = {}
    orders.forEach(order => {
        const dateStr = format(parseISO(order.created_at), 'MMM dd')
        if (!salesByDate[dateStr]) {
            salesByDate[dateStr] = { date: dateStr, sales: 0, orders: 0 }
        }
        salesByDate[dateStr].sales += order.total || 0
        salesByDate[dateStr].orders += 1
    })

    // Fill in missing days for 7/30 day views if needed, or just sort
    const chartData = Object.values(salesByDate).sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime() // Rough sort, better to use proper date obj
    )

    // Top Selling Items
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

    const topItems = Object.values(itemCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)

    return {
        totalRevenue,
        totalOrders,
        avgOrderValue,
        chartData,
        topItems
    }
}
