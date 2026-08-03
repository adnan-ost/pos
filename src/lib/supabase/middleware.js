
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { getRole } from './role'

export async function updateSession(request) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        request.cookies.set(name, value)
                    )
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // IMPORTANT: Avoid writing any logic between createServerClient and
    // supabase.auth.getUser(). A simple mistake could make it very hard to debug
    // issues with users being randomly logged out.

    const {
        data: { user },
    } = await supabase.auth.getUser()

    const pathname = request.nextUrl.pathname
    const protectedPaths = ['/pos', '/orders', '/kds', '/menu', '/profile', '/reports', '/settings'];
    const adminOnlyPaths = ['/menu', '/reports', '/settings'];

    if (!user && !pathname.startsWith('/login')) {
        // Only redirect if accessing protected routes
        const isProtected = protectedPaths.some(path => pathname.startsWith(path))

        if (isProtected) {
            const url = request.nextUrl.clone()
            url.pathname = '/login'
            return NextResponse.redirect(url)
        }
    }

    // Signed in but wrong role: redirect to /pos, not /login — they ARE
    // authenticated, just not authorized for this route. Role is always
    // re-derived from `profiles` here, never trusted from client input.
    if (user && adminOnlyPaths.some(path => pathname.startsWith(path))) {
        const role = await getRole(supabase, user.id)
        if (role !== 'admin') {
            const url = request.nextUrl.clone()
            url.pathname = '/pos'
            return NextResponse.redirect(url)
        }
    }

    return supabaseResponse
}
