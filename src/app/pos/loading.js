/*
 * Shown the instant the router starts navigating to /pos, which matters most
 * right after sign-in: the auth round-trip plus this page's own data fetches
 * add up to seconds, and without this the browser sat on the login screen with
 * nothing to show for the click.
 *
 * Mirrors the real layout — search bar, category rail, item grid, cart panel —
 * so the swap to live content doesn't jump.
 */
export default function PosLoading() {
    return (
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }} aria-busy="true">
            <div style={{ flex: 1, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div className="skeleton" style={{ height: '2.75rem', flex: 1, maxWidth: '28rem' }} />
                    <div className="skeleton" style={{ height: '2.75rem', width: '7rem', marginLeft: 'auto' }} />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    {[72, 96, 84, 80, 92].map((w, i) => (
                        <div key={i} className="skeleton" style={{ height: '2.5rem', width: `${w}px` }} />
                    ))}
                </div>

                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
                        gap: '1rem',
                        overflow: 'hidden',
                    }}
                >
                    {Array.from({ length: 12 }).map((_, i) => (
                        <div
                            key={i}
                            className="skeleton"
                            style={{ height: '11rem', animationDelay: `${(i % 6) * 80}ms` }}
                        />
                    ))}
                </div>
            </div>

            <div
                style={{
                    width: '360px',
                    borderLeft: '1px solid var(--border)',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                }}
            >
                <div className="skeleton" style={{ height: '1.75rem', width: '60%' }} />
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="skeleton" style={{ height: '3.5rem' }} />
                ))}
                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div className="skeleton" style={{ height: '1.25rem', width: '40%' }} />
                    <div className="skeleton" style={{ height: '3rem' }} />
                </div>
            </div>
        </div>
    )
}
