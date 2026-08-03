// Shared by middleware and Server Components. Role is always re-derived
// from `profiles` here, keyed by the authenticated user's id — never trust
// a role claimed by client input (e.g. the login form's role toggle).
export async function getRole(supabase, userId) {
    if (!userId) return null;
    const { data } = await supabase.from('profiles').select('role').eq('id', userId).single();
    return data?.role ?? null;
}
