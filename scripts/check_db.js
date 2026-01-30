
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
    console.log('Checking connection...');
    const { data, error } = await supabase.from('store_settings').select('*');

    if (error) {
        console.error('Error:', error.message);
        if (error.code === '42P01') {
            console.log('DIAGNOSIS: Table "store_settings" does not exist.');
        }
    } else {
        console.log('Success! Data:', data);
        if (data.length === 0) {
            console.log('DIAGNOSIS: Table exists but is empty.');
        } else if (!data[0].raast_id) {
            console.log('DIAGNOSIS: Table exists but Raast ID is missing.');
        } else {
            console.log('DIAGNOSIS: Table and Data look correct. Issue might be in the UI.');
        }
    }
}

check();
