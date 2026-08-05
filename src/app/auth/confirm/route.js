import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Landing point for emailed auth links (currently just PIN recovery).
//
// Exchanging the link for a session has to happen server-side so the session
// is written as cookies that middleware and Server Components can read. Two
// link shapes are accepted because it depends on how the email template is
// written: `token_hash` (what the template below produces) and `code` (PKCE,
// what Supabase's stock template produces).
export async function GET(request) {
    const { searchParams, origin } = new URL(request.url)

    const tokenHash = searchParams.get('token_hash')
    const type = searchParams.get('type')
    const code = searchParams.get('code')

    // Only ever redirect to a path on this origin — an attacker-supplied
    // absolute URL in `next` would otherwise turn this into an open redirect
    // that carries a live session.
    const nextParam = searchParams.get('next') || '/reset-pin'
    const next = nextParam.startsWith('/') && !nextParam.startsWith('//')
        ? nextParam
        : '/reset-pin'

    const supabase = await createClient()

    let error = null
    if (tokenHash && type) {
        ({ error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash }))
    } else if (code) {
        ({ error } = await supabase.auth.exchangeCodeForSession(code))
    } else {
        error = new Error('Missing token')
    }

    if (error) {
        // Expired or already-used links end up here. Don't echo the reason.
        return NextResponse.redirect(`${origin}/login?error=link_invalid`)
    }

    return NextResponse.redirect(`${origin}${next}`)
}
