
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
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
