
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

// The role toggle only picks which account to attempt — it is never trusted
// as a role claim. Everything downstream (middleware, RLS) re-derives the
// real role from `profiles`, keyed by whichever account this login actually
// authenticates as.
const ROLE_EMAIL = {
    admin: process.env.AUTH_ADMIN_EMAIL,
    staff: process.env.AUTH_STAFF_EMAIL,
}

export async function login(formData) {
    const supabase = await createClient()

    const role = formData.get('role')
    const pin = formData.get('pin')
    const email = ROLE_EMAIL[role]

    if (!email) {
        return { error: 'Unknown role' }
    }
    if (!/^\d{6}$/.test(pin || '')) {
        return { error: 'Enter a 6-digit PIN' }
    }

    const { error } = await supabase.auth.signInWithPassword({
        email,
        password: pin,
    })

    if (error) {
        // Don't pass through Supabase's raw message — the PIN's keyspace is
        // small enough that error detail isn't worth leaking.
        return { error: 'Incorrect PIN' }
    }

    revalidatePath('/pos', 'layout')
    redirect('/pos')
}

// Forgot-PIN. The login screen never collects an email, so the role toggle is
// what picks the account — same ROLE_EMAIL indirection as login(), so a caller
// still can't aim a reset at an arbitrary address.
//
// The mail lands in the inbox that owns the role account, so completing a
// reset requires access to that inbox. Anyone can *trigger* one, though; the
// only cost of an unwanted trigger is a stray email (Supabase rate-limits the
// send), never a PIN change.
export async function requestPinReset(role) {
    const email = ROLE_EMAIL[role]

    if (!email) {
        return { error: 'Unknown role' }
    }

    const h = await headers()
    const proto = h.get('x-forwarded-proto') ?? 'http'
    const origin = process.env.NEXT_PUBLIC_SITE_URL || `${proto}://${h.get('host')}`

    const supabase = await createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/auth/confirm?next=/reset-pin`,
    })

    if (error) {
        // Rate limiting is the realistic failure here; surface it as guidance
        // rather than an internal message.
        return { error: 'Could not send the reset email just yet — wait a minute and try again.' }
    }

    return { success: 'Reset link sent. Check the inbox for this account, then follow the link to set a new PIN.' }
}
