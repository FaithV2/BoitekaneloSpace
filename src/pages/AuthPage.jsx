import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function AuthPage() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const { signIn, signUp, session, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!authLoading && session?.user) {
      navigate('/', { replace: true })
    }
  }, [authLoading, session, navigate])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setStatus(null)
    setLoading(true)

    if (mode === 'login') {
      const { data, error } = await signIn({ email, password })
      if (error) {
        setStatus(error.message)
      } else {
        navigate('/', { replace: true })
      }
    } else {
      const { data, error } = await signUp({ email, password })
      if (error) {
        setStatus(error.message)
      } else {
        setStatus('Check your email to confirm your account.')
      }
    }

    setLoading(false)
  }

  return (
    <div className="card" style={{ maxWidth: 520, margin: '0 auto' }}>
      <h1 className="section-title">Welcome to Boitekanelo Space</h1>
      <p className="small-text">A calm, safe place to share and reflect.</p>

      <div style={{ display: 'flex', gap: '12px', margin: '24px 0' }}>
        <button className={mode === 'login' ? 'primary' : 'secondary'} onClick={() => setMode('login')}>
          Log in
        </button>
        <button className={mode === 'signup' ? 'primary' : 'secondary'} onClick={() => setMode('signup')}>
          Sign up
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>

        <div className="form-field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>

        <button type="submit" className="primary" disabled={loading}>
          {loading ? 'Working...' : mode === 'login' ? 'Log in' : 'Create account'}
        </button>
      </form>

      {status && <div className="alert" style={{ marginTop: 20 }}>{status}</div>}
    </div>
  )
}
