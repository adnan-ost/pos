
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

    // Sent as an explicit "true"/"false" string rather than a bare checkbox:
    // an unchecked checkbox submits nothing at all, which is indistinguishable
    // from the field not being on the form.
    const qr_enabled = formData.get('qr_enabled') !== 'false'
    const auto_print = formData.get('auto_print') !== 'false'

    // Clamped server-side too: the number input is a hint, not a guarantee, and a
    // rate above 1 would silently multiply every bill.
    const rawRate = Number(formData.get('tax_rate'))
    const tax_rate = Number.isFinite(rawRate) ? Math.min(Math.max(rawRate, 0), 1) : 0.16
    const tax_label = clean('tax_label') || 'GST'

    // Check if row exists
    const existing = await getSettings()

    let error
    if (existing) {
        const res = await supabase
            .from('store_settings')
            .update({ merchant_name, merchant_city, raast_id, qr_enabled, auto_print, tax_rate, tax_label, updated_at: new Date() })
            .eq('id', existing.id)
        error = res.error
    } else {
        const res = await supabase
            .from('store_settings')
            .insert({ merchant_name, merchant_city, raast_id, qr_enabled, auto_print, tax_rate, tax_label })
        error = res.error
    }

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/settings')
    return { success: 'Settings updated successfully' }
}
