import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const { session, loading: authLoading, updatePassword } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (event) => {
    event.preventDefault()
    setStatus(null)

    if (password !== confirmPassword) {
      setStatus('The passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const { error } = await updatePassword(password)
      if (error) {
        setStatus(error.message)
      } else {
        navigate('/', { replace: true })
      }
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) {
    return <div className="app-loading-state" role="status"><span className="app-loading-spinner" />Checking your reset link…</div>
  }

  if (!session?.user) {
    return <Navigate to="/auth" replace />
  }

  return (
    <section className="reset-page">
      <div className="reset-card">
        <span className="reset-icon" aria-hidden="true">✧</span>
        <span className="reset-eyebrow">ACCOUNT SECURITY</span>
        <h1>Choose a new password</h1>
        <p>Enter your new password below to get back to your space.</p>

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="new-password">New password</label>
            <input
              id="new-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="confirm-password">Confirm new password</label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>

          <button type="submit" className="reset-submit-button" disabled={loading}>
            {loading ? 'Updating…' : 'Update password'} {!loading && <span aria-hidden="true">→</span>}
          </button>
        </form>

        {status && <div className="reset-status" role="alert">{status}</div>}
        <Link to="/auth" className="reset-back-link">← Back to log in</Link>
      </div>
    </section>
  )
}
