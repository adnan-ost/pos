import LoginForm from '@/components/Auth/LoginForm'

/*
 * Thin server wrapper so the redirect outcomes carried in the query string
 * (?reset=1, ?error=link_expired) are resolved before render and handed to the
 * form as initial state, rather than being read from window in an effect.
 */
export default async function LoginPage({ searchParams }) {
    const params = await searchParams

    return (
        <LoginForm
            linkError={typeof params?.error === 'string' ? params.error : ''}
            justReset={Boolean(params?.reset)}
        />
    )
}
