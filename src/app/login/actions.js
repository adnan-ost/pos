
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData) {
    const supabase = await createClient()

    // formData can be a FormData object or a plain object depending on how it's called
    // But since we using 'action={handleSubmit}' in the form, and handleSubmit receives formData (when used as action prop directly?)
    // Actually, wait. In the Client Component:
    // action={handleSubmit} -> handleSubmit matches signature (formData).

    const email = formData.get('email')
    const password = formData.get('password')

    const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
    })

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/pos', 'layout')
    redirect('/pos')
}
