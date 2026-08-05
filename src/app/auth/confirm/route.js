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

    // Some email clients hand over the href without decoding `&amp;`, which
    // turns the following params into `amp;token_hash` / `amp;type`. Read both
    // spellings rather than treating a mangled link as a missing token.
    const param = (name) => searchParams.get(name) ?? searchParams.get(`amp;${name}`)

    const tokenHash = param('token_hash')
    const type = param('type')
    const code = param('code')

    // Only ever redirect to a path on this origin — an attacker-supplied
    // absolute URL in `next` would otherwise turn this into an open redirect
    // that carries a live session.
    const nextParam = param('next') || '/reset-pin'
    const next = nextParam.startsWith('/') && !nextParam.startsWith('//')
        ? nextParam
        : '/reset-pin'

    const fail = (reason) => NextResponse.redirect(`${origin}/login?error=${reason}`)

    if (!tokenHash && !code) {
        // The template didn't interpolate, or the link lost its query string.
        console.error('[auth/confirm] no token in link:', request.url)
        return fail('link_malformed')
    }

    const supabase = await createClient()

    const { error } = tokenHash
        ? await supabase.auth.verifyOtp({ type: type || 'recovery', token_hash: tokenHash })
        : await supabase.auth.exchangeCodeForSession(code)

    if (error) {
        // Supabase keeps a single recovery token per user, so requesting another
        // reset invalidates the previous link — the common cause of landing
        // here is clicking an older email rather than the newest one.
        console.error('[auth/confirm] verify failed:', error.status, error.message)
        return fail('link_expired')
    }

    return NextResponse.redirect(`${origin}${next}`)
}
