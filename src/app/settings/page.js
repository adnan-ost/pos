
'use client'

import { useState, useEffect } from 'react'
import { getSettings, updateSettings } from './actions'
import { Save, Loader2, CreditCard, Building, MapPin } from 'lucide-react'

export default function SettingsPage() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState({ type: '', text: '' })
    const [settings, setSettings] = useState({
        merchant_name: '',
        merchant_city: '',
        raast_id: '',
    })

    useEffect(() => {
        getSettings().then(data => {
            if (data) setSettings(data)
            setLoading(false)
        })
    }, [])

    const handleSubmit = async (formData) => {
        setSaving(true)
        setMessage({ type: '', text: '' })

        const result = await updateSettings(formData)

        if (result.error) {
            setMessage({ type: 'error', text: result.error })
        } else {
            setMessage({ type: 'success', text: result.success })
        }
        setSaving(false)
    }

    const handleChange = (e) => {
        setSettings(prev => ({ ...prev, [e.target.name]: e.target.value }))
    }

    if (loading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto p-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-8">Store Settings</h1>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-4 mb-6">
                    <div className="h-12 w-12 bg-orange-100 rounded-full flex items-center justify-center">
                        <CreditCard className="h-6 w-6 text-orange-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">Payment & Merchant Info</h2>
                        <p className="text-sm text-gray-500">Configure your payment details for QR codes</p>
                    </div>
                </div>

                <form action={handleSubmit} className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-2">
                        <div>
                            <label htmlFor="merchant_name" className="block text-sm font-medium text-gray-700 mb-1">
                                Merchant Name
                            </label>
                            <div className="relative">
                                <Building className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                                <input
                                    type="text"
                                    name="merchant_name"
                                    value={settings.merchant_name || ''}
                                    onChange={handleChange}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                                    placeholder="e.g. Flames by the Indus"
                                />
                            </div>
                            <p className="mt-1 text-xs text-gray-500">Displayed on the QR code scan screen.</p>
                        </div>

                        <div>
                            <label htmlFor="merchant_city" className="block text-sm font-medium text-gray-700 mb-1">
                                City
                            </label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                                <input
                                    type="text"
                                    name="merchant_city"
                                    value={settings.merchant_city || ''}
                                    onChange={handleChange}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                                    placeholder="e.g. Islamabad"
                                />
                            </div>
                        </div>

                        <div className="md:col-span-2">
                            <label htmlFor="raast_id" className="block text-sm font-medium text-gray-700 mb-1">
                                Raast ID / IBAN / Merchant ID
                            </label>
                            <div className="relative">
                                <div className="absolute left-3 top-2.5 h-5 w-5 flex items-center justify-center font-bold text-gray-400 text-xs border border-gray-400 rounded-sm">R</div>
                                <input
                                    type="text"
                                    name="raast_id"
                                    value={settings.raast_id || ''}
                                    onChange={handleChange}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                                    placeholder="e.g. 03475369008"
                                />
                            </div>
                            <p className="mt-1 text-xs text-gray-500">The unique identifier (Phone, IBAN, or Merchant ID) linked to your Raast account.</p>
                        </div>
                    </div>

                    {message.type && (
                        <div className={`p-4 rounded-lg ${message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-green-50 text-green-700 border border-green-100'
                            }`}>
                            {message.text}
                        </div>
                    )}

                    <div className="flex justify-end pt-2">
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex items-center gap-2 px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4" />
                                    Save Settings
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
