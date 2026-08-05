'use client'

import { useState } from 'react'
import { setPin } from './actions'
import { Utensils, Loader2, KeyRound } from 'lucide-react'

export default function ResetPinPage() {
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (formData) => {
        setLoading(true)
        setError('')

        // On success this redirects, so nothing comes back to handle here.
        const result = await setPin(formData)

        if (result?.error) {
            setError(result.error)
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-800 via-gray-900 to-black p-4">
            <div className="max-w-md w-full space-y-8 p-8 bg-gray-800/50 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-700/50">
                <div className="text-center">
                    <div className="mx-auto h-16 w-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center shadow-lg mb-6">
                        <Utensils className="h-8 w-8 text-white" />
                    </div>
                    <h2 className="text-3xl font-bold text-white tracking-tight">
                        Set a new PIN
                    </h2>
                    <p className="mt-2 text-sm text-gray-400">
                        Choose 6 digits you&apos;ll remember
                    </p>
                </div>

                <form className="mt-8 space-y-6" action={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="pin" className="block text-sm font-medium text-gray-300 mb-1">
                                New PIN
                            </label>
                            <input
                                id="pin"
                                name="pin"
                                type="password"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={6}
                                autoComplete="new-password"
                                required
                                autoFocus
                                className="appearance-none block w-full px-4 py-3 border border-gray-600 rounded-lg bg-gray-900/50 text-white placeholder-gray-500 text-center text-2xl tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition duration-200"
                                placeholder="••••••"
                            />
                        </div>

                        <div>
                            <label htmlFor="confirmPin" className="block text-sm font-medium text-gray-300 mb-1">
                                Confirm PIN
                            </label>
                            <input
                                id="confirmPin"
                                name="confirmPin"
                                type="password"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={6}
                                autoComplete="new-password"
                                required
                                className="appearance-none block w-full px-4 py-3 border border-gray-600 rounded-lg bg-gray-900/50 text-white placeholder-gray-500 text-center text-2xl tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition duration-200"
                                placeholder="••••••"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3">
                            <p className="text-red-400 text-sm text-center font-medium">
                                {error}
                            </p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="group relative w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent text-sm font-semibold rounded-lg text-white bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-orange-500/20"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="animate-spin h-5 w-5 text-white" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <KeyRound className="h-4 w-4" />
                                Save new PIN
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    )
}
