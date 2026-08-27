
'use server'

import { createClient } from '@/lib/supabase/server'
import { getRole } from '@/lib/supabase/role'
import { revalidatePath } from 'next/cache'

export async function updatePassword(formData) {
    const supabase = await createClient()
    const password = formData.get('password')
    const confirmPassword = formData.get('confirmPassword')

    if (password !== confirmPassword) {
        return { error: 'Passwords do not match' }
    }

    /*
     * Exactly six digits — the same shape the login screen enforces. This form
     * used to accept anything of six-plus characters, so a seven-digit PIN or
     * one with a letter saved fine and then nobody could sign in with the
     * account again: the login field refuses what this form had stored.
     */
    if (!/^\d{6}$/.test(password)) {
        return { error: 'PIN must be exactly 6 digits' }
    }

    const { error } = await supabase.auth.updateUser({
        password: password
    })

    if (error) {
        return { error: error.message }
    }

    return { success: 'Password updated successfully' }
}

export async function getUser() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const role = await getRole(supabase, user.id)
    return { ...user, role }
}
