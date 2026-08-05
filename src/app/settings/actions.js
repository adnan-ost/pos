
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getSettings() {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('store_settings')
        .select('*')
        .single()

    if (error && error.code !== 'PGRST116') { // Ignore no rows error
        console.error('Error fetching settings:', error)
        return null
    }
    return data
}

export async function updateSettings(formData) {
    const supabase = await createClient()

    // Trim before storing: a stray space in raast_id rides straight into the
    // EMVCo payload and produces a QR the bank app rejects.
    const clean = (key) => (formData.get(key) || '').trim()

    const merchant_name = clean('merchant_name')
    const merchant_city = clean('merchant_city')
    const raast_id = clean('raast_id')

    // Check if row exists
    const existing = await getSettings()

    let error
    if (existing) {
        const res = await supabase
            .from('store_settings')
            .update({ merchant_name, merchant_city, raast_id, updated_at: new Date() })
            .eq('id', existing.id)
        error = res.error
    } else {
        const res = await supabase
            .from('store_settings')
            .insert({ merchant_name, merchant_city, raast_id })
        error = res.error
    }

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/settings')
    return { success: 'Settings updated successfully' }
}
