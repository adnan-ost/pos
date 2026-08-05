'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Sets a new PIN for whoever holds the current (recovery) session. There's no
// role or email input here on purpose: the session decides which account gets
// changed, so a caller can't retarget it.
export async function setPin(formData) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return { error: 'This reset link has expired. Request a new one from the login screen.' }
    }

    const pin = formData.get('pin')
    const confirmPin = formData.get('confirmPin')

    // Same 6-digit rule the login form enforces — a PIN that doesn't match it
    // would lock the account out of the only sign-in path the app has.
    if (!/^\d{6}$/.test(pin || '')) {
        return { error: 'PIN must be exactly 6 digits' }
    }
    if (pin !== confirmPin) {
        return { error: 'PINs do not match' }
    }

    const { error } = await supabase.auth.updateUser({ password: pin })
    if (error) {
        return { error: error.message }
    }

    // Drop the recovery session so the new PIN has to be typed once to get in.
    // Confirms it works, and leaves no session behind on a shared terminal.
    await supabase.auth.signOut()

    redirect('/login?reset=1')
}
