import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function AuthPage() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const { signIn, signUp, resetPasswordForEmail, session, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!authLoading && session?.user && mode !== 'forgot') {
      navigate('/', { replace: true })
    }
  }, [authLoading, session, mode, navigate])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setStatus(null)
    setLoading(true)

    try {
      if (mode === 'forgot') {
        const { error } = await resetPasswordForEmail({
          email,
          redirectTo: `${window.location.origin}/reset-password`
        })
        if (error) {
          setStatus(error.message)
        } else {
          setStatus('If an account exists for that email, a password reset link has been sent.')
        }
      } else {
        if (mode === 'login') {
          const { error } = await signIn({ email, password })
          if (error) {
            setStatus(error.message)
          } else {
            navigate('/', { replace: true })
          }
        } else {
          const { data, error } = await signUp({ email, password })
          if (error) {
            setStatus(error.message)
          } else if (data.session) {
            navigate('/', { replace: true })
          } else {
            setStatus('Email confirmation is enabled in Supabase. Disable Confirm email in Authentication > Providers > Email to allow sign-up without verification.')
          }
        }
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-card">
        <h1>{mode === 'forgot' ? 'Reset your password' : mode === 'login' ? 'Sign in' : 'Create your account'}</h1>
        <p className="auth-intro">Boitekanelo Space</p>

        {mode === 'forgot' ? (
          <p className="auth-form-description">Enter your email and we’ll send you a password reset link.</p>
        ) : (
          <div className="auth-mode-tabs" role="tablist" aria-label="Account access">
            <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'is-active' : ''} onClick={() => { setMode('login'); setStatus(null) }}>
              Log in
            </button>
            <button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'is-active' : ''} onClick={() => { setMode('signup'); setStatus(null) }}>
              Sign up
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          {mode !== 'forgot' && (
            <div className="form-field">
              <label htmlFor="password">Password</label>
              <input id="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
          )}

          <button type="submit" className="auth-submit-button" disabled={loading}>
            {loading ? 'Working…' : mode === 'forgot' ? 'Send reset link' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>

        {mode === 'login' && (
          <button type="button" className="auth-text-button" onClick={() => { setMode('forgot'); setStatus(null) }}>
            Forgot password?
          </button>
        )}
        {mode === 'forgot' && (
          <button type="button" className="auth-text-button" onClick={() => { setMode('login'); setStatus(null) }}>
            Back to log in
          </button>
        )}

        {status && <div className="auth-status" role="status">{status}</div>}
      </div>
    </section>
  )
}
