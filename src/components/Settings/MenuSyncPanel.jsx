'use client';

import { useState } from 'react';
import { RefreshCw, AlertTriangle, Check, Loader2, ArrowRight } from 'lucide-react';
import { syncMenuFromSanity } from '@/app/settings/actions';

const rs = (n) => `Rs. ${Number(n || 0).toLocaleString('en-PK')}`;

/*
 * Pulls the website's menu into the till.
 *
 * Always two taps: "Check for changes" reads the website and shows the diff
 * without writing anything, and only then does an Apply button appear. Prices
 * are what customers are charged — nothing here changes one without a person
 * having read the number first.
 */
export default function MenuSyncPanel() {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [preview, setPreview] = useState(null);
    const [applied, setApplied] = useState(null);

    const run = async ({ apply }) => {
        setBusy(true);
        setError('');
        try {
            const { result, error: err } = await syncMenuFromSanity({ apply });
            if (err) { setError(err); return; }
            if (apply) { setApplied(result); setPreview(null); }
            else { setPreview(result); setApplied(null); }
        } finally {
            setBusy(false);
        }
    };

    // The dry run reports every dish it would touch; the panel shows the price
    // moves, biggest first, since that is what a reviewer is checking.
    const changes = (preview?.detail || []).filter(d => d.bucket === 'changed');
    const held = (preview?.detail || []).filter(d => d.bucket === 'held');
    const unmatched = (preview?.detail || []).filter(d => d.bucket === 'unmatched');

    return (
        <div className="bg-gray-900 rounded-xl shadow-sm border border-gray-800 p-6 mt-6">
            <div className="flex items-start gap-4 mb-5">
                <div className="h-12 w-12 bg-blue-900/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <RefreshCw className="h-6 w-6 text-blue-400" />
                </div>
                <div className="min-w-0">
                    <h2 className="text-xl font-semibold text-white">Menu &amp; prices from the website</h2>
                    <p className="text-sm text-gray-400">
                        Prices and descriptions are edited on flamesbytheindus.com and pulled in here.
                        Sold-out switches, modifiers and categories stay with the till.
                    </p>
                </div>
            </div>

            {error && (
                <div className="mb-5 flex items-start gap-3 p-4 rounded-lg bg-red-900/15 border border-red-800/40">
                    <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-200/90">{error}</p>
                </div>
            )}

            {applied && (
                <div className="mb-5 flex items-start gap-3 p-4 rounded-lg bg-green-900/15 border border-green-800/40">
                    <Check className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-green-200/90">
                        {applied.changed} {applied.changed === 1 ? 'dish' : 'dishes'} updated.
                        {applied.held_sized > 0 && ` ${applied.held_sized} sold in sizes were left alone.`}
                    </p>
                </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
                <button
                    type="button"
                    onClick={() => run({ apply: false })}
                    disabled={busy}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold
                               bg-gray-800 text-gray-100 border border-gray-700 hover:bg-gray-750
                               disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                    {busy && !preview ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Check for changes
                </button>

                {preview && changes.length > 0 && (
                    <button
                        type="button"
                        onClick={() => run({ apply: true })}
                        disabled={busy}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold
                                   bg-gradient-to-r from-orange-500 to-orange-600 text-[#1A0E05]
                                   shadow-lg shadow-orange-500/20 hover:from-orange-400 hover:to-orange-500
                                   disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                    >
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                        Apply {changes.length} {changes.length === 1 ? 'price' : 'prices'}
                    </button>
                )}
            </div>

            {preview && (
                <div className="mt-5 space-y-4">
                    <p className="text-sm text-gray-400">
                        Read {preview.dishes_seen} dishes from the website.
                        {changes.length === 0 && ' Nothing to change — the till already matches.'}
                    </p>

                    {changes.length > 0 && (
                        <div className="rounded-lg border border-gray-800 overflow-hidden">
                            <div className="max-h-80 overflow-y-auto">
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 bg-gray-900">
                                        <tr className="text-left text-xs uppercase tracking-wider text-gray-500">
                                            <th className="px-4 py-2.5 font-semibold">Dish</th>
                                            <th className="px-4 py-2.5 font-semibold text-right">Now</th>
                                            <th className="px-4 py-2.5 font-semibold text-right">New</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {changes.map((d, i) => (
                                            <tr key={`${d.name}-${i}`} className="border-t border-gray-800/70">
                                                <td className="px-4 py-2 text-gray-200">{d.name}</td>
                                                <td className="px-4 py-2 text-right text-gray-500 tabular-nums">{rs(d.old)}</td>
                                                <td className="px-4 py-2 text-right text-white font-semibold tabular-nums">{rs(d.new)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {held.length > 0 && (
                        <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-900/15 border border-amber-800/40">
                            <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-amber-200/90">
                                <p className="font-semibold mb-1">{held.length} dishes sold in sizes were not touched</p>
                                <p className="text-amber-200/70">
                                    The website prices these from the smaller size and the till charges the larger,
                                    so their prices have to be set together rather than copied across.
                                    {' '}{held.slice(0, 4).map(d => d.name).join(', ')}
                                    {held.length > 4 && `, and ${held.length - 4} more`}.
                                </p>
                            </div>
                        </div>
                    )}

                    {unmatched.length > 0 && (
                        <p className="text-sm text-gray-500">
                            {unmatched.length} {unmatched.length === 1 ? 'dish on the till has' : 'dishes on the till have'} no
                            match on the website and {unmatched.length === 1 ? 'was' : 'were'} left alone.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
