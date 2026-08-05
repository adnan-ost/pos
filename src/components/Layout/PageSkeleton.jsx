/*
 * Generic route-loading placeholder. Every page in the app is a header plus a
 * list or grid, so one shape covers them all — the point is immediate feedback
 * on navigation, not a pixel-accurate preview of each screen.
 */
export default function PageSkeleton({ rows = 6, layout = 'list' }) {
    const isGrid = layout === 'grid'

    return (
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }} aria-busy="true">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div className="skeleton" style={{ height: '2rem', width: '12rem' }} />
                <div className="skeleton" style={{ height: '2.5rem', width: '8rem', marginLeft: 'auto' }} />
            </div>

            <div
                style={
                    isGrid
                        ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '1rem' }
                        : { display: 'flex', flexDirection: 'column', gap: '0.75rem' }
                }
            >
                {Array.from({ length: rows }).map((_, i) => (
                    <div
                        key={i}
                        className="skeleton"
                        style={{
                            height: isGrid ? '9rem' : '4.5rem',
                            animationDelay: `${(i % 6) * 80}ms`,
                        }}
                    />
                ))}
            </div>
        </div>
    )
}
