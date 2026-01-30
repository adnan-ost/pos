
'use client'

import { useState, useEffect } from 'react'
import { getDashboardStats } from './actions'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts'
import { DollarSign, ShoppingBag, TrendingUp, Calendar, Loader2 } from 'lucide-react'

const COLORS = ['#F26513', '#F97316', '#FB923C', '#FDBA74', '#FFEDD5'];

export default function ReportsPage() {
    const [range, setRange] = useState('7days')
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        setLoading(true)
        getDashboardStats(range).then(data => {
            setStats(data)
            setLoading(false)
        })
    }, [range])

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-950">
                <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
            </div>
        )
    }

    if (stats?.error) {
        return <div className="p-8 text-red-500 bg-gray-950 min-h-screen">Error loading stats: {stats.error}</div>
    }

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 bg-gray-950 min-h-screen text-gray-100">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">Analytics Dashboard</h1>
                    <p className="text-gray-400">Overview of your store's performance</p>
                </div>

                <div className="flex bg-gray-900 rounded-lg shadow-sm border border-gray-800 p-1">
                    <button
                        onClick={() => setRange('today')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${range === 'today' ? 'bg-orange-500/10 text-orange-500' : 'text-gray-400 hover:bg-gray-800'}`}
                    >
                        Today
                    </button>
                    <button
                        onClick={() => setRange('7days')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${range === '7days' ? 'bg-orange-500/10 text-orange-500' : 'text-gray-400 hover:bg-gray-800'}`}
                    >
                        Last 7 Days
                    </button>
                    <button
                        onClick={() => setRange('30days')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${range === '30days' ? 'bg-orange-500/10 text-orange-500' : 'text-gray-400 hover:bg-gray-800'}`}
                    >
                        Last 30 Days
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gray-900 p-6 rounded-xl shadow-sm border border-gray-800 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-400 mb-1">Total Revenue</p>
                        <h3 className="text-2xl font-bold text-white">Rs. {stats.totalRevenue.toLocaleString()}</h3>
                    </div>
                    <div className="h-12 w-12 bg-green-900/20 rounded-full flex items-center justify-center">
                        <DollarSign className="h-6 w-6 text-green-500" />
                    </div>
                </div>

                <div className="bg-gray-900 p-6 rounded-xl shadow-sm border border-gray-800 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-400 mb-1">Total Orders</p>
                        <h3 className="text-2xl font-bold text-white">{stats.totalOrders}</h3>
                    </div>
                    <div className="h-12 w-12 bg-blue-900/20 rounded-full flex items-center justify-center">
                        <ShoppingBag className="h-6 w-6 text-blue-500" />
                    </div>
                </div>

                <div className="bg-gray-900 p-6 rounded-xl shadow-sm border border-gray-800 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-400 mb-1">Average Order Value</p>
                        <h3 className="text-2xl font-bold text-white">Rs. {Math.round(stats.avgOrderValue).toLocaleString()}</h3>
                    </div>
                    <div className="h-12 w-12 bg-purple-900/20 rounded-full flex items-center justify-center">
                        <TrendingUp className="h-6 w-6 text-purple-500" />
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Sales Chart */}
                <div className="bg-gray-900 p-6 rounded-xl shadow-sm border border-gray-800 lg:col-span-2">
                    <h3 className="text-lg font-semibold text-white mb-6">Sales Trend</h3>
                    <div className="h-[300px] w-full">
                        {stats.chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 12 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                                    <Tooltip
                                        cursor={{ fill: '#1F2937' }}
                                        contentStyle={{ backgroundColor: '#1F2937', borderRadius: '8px', border: '1px solid #374151', color: '#F3F4F6' }}
                                        itemStyle={{ color: '#F3F4F6' }}
                                        labelStyle={{ color: '#9CA3AF' }}
                                    />
                                    <Bar dataKey="sales" fill="#F26513" radius={[4, 4, 0, 0]} barSize={40} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-500">
                                No sales data for this period
                            </div>
                        )}
                    </div>
                </div>

                {/* Top Items */}
                <div className="bg-gray-900 p-6 rounded-xl shadow-sm border border-gray-800">
                    <h3 className="text-lg font-semibold text-white mb-6">Top Selling Items</h3>
                    <div className="space-y-4">
                        {stats.topItems.length > 0 ? (
                            stats.topItems.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between pb-4 border-b border-gray-800 last:border-0 last:pb-0">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-orange-900/20 flex items-center justify-center font-bold text-orange-500 text-xs">
                                            #{idx + 1}
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-200 text-sm">{item.name}</p>
                                            <p className="text-xs text-gray-400">{item.count} orders</p>
                                        </div>
                                    </div>
                                    <span className="font-semibold text-gray-300 text-sm">Rs. {item.revenue.toLocaleString()}</span>
                                </div>
                            ))
                        ) : (
                            <div className="text-center text-gray-500 py-10">
                                No items sold yet
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    )
}
