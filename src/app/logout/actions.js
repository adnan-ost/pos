
'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function logout() {
    const supabase = await createClient()
    /*
     * Local scope only. The default ('global') revokes every session for the
     * account — and because admin/staff are shared accounts, one person
     * signing out of the back office dropped the till and the kitchen display
     * mid-service. This ends the session on this device and leaves the other
     * terminals working.
     */
    await supabase.auth.signOut({ scope: 'local' })
    redirect('/login')
}
