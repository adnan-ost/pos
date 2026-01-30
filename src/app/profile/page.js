
'use client'

import { useState, useEffect } from 'react'
import { updatePassword, getUser } from './actions'
import { Lock, User, Save, Loader2 } from 'lucide-react'

export default function ProfilePage() {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState({ type: '', text: '' })

    useEffect(() => {
        getUser().then(u => {
            setUser(u)
            setLoading(false)
        })
    }, [])

    const handleSubmit = async (formData) => {
        setSaving(true)
        setMessage({ type: '', text: '' })

        const result = await updatePassword(formData)

        if (result.error) {
            setMessage({ type: 'error', text: result.error })
        } else {
            setMessage({ type: 'success', text: result.success })
            // Reset form
            document.getElementById('password-form').reset()
        }
        setSaving(false)
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
            <h1 className="text-3xl font-bold text-gray-900 mb-8">Account Settings</h1>

            <div className="grid gap-6">
                {/* Profile Info Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="h-12 w-12 bg-orange-100 rounded-full flex items-center justify-center">
                            <User className="h-6 w-6 text-orange-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">Profile Information</h2>
                            <p className="text-sm text-gray-500">Your account details</p>
                        </div>
                    </div>

                    <div className="grid gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                            <div className="p-3 bg-gray-50 rounded-lg text-gray-600 font-medium font-mono border border-gray-200">
                                {user?.email}
                            </div>
                            <p className="mt-1 text-xs text-gray-500">Email cannot be changed directly.</p>
                        </div>
                    </div>
                </div>

                {/* Change Password Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="h-12 w-12 bg-orange-100 rounded-full flex items-center justify-center">
                            <Lock className="h-6 w-6 text-orange-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">Security</h2>
                            <p className="text-sm text-gray-500">Update your password</p>
                        </div>
                    </div>

                    <form id="password-form" action={handleSubmit} className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                                    New Password
                                </label>
                                <input
                                    type="password"
                                    name="password"
                                    required
                                    minLength={6}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                                    placeholder="••••••••"
                                />
                            </div>
                            <div>
                                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                                    Confirm Password
                                </label>
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    required
                                    minLength={6}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                                    placeholder="••••••••"
                                />
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
                                        Updating...
                                    </>
                                ) : (
                                    <>
                                        <Save className="h-4 w-4" />
                                        Update Password
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
