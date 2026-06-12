import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function HomePage() {
  const { profile } = useAuth()
  const role = profile?.role ?? 'user'

  return (
    <div className="grid-two">
      <section className="card">
        <h1 className="section-title">Hello, {profile?.display_name ?? 'friend'}.</h1>
        <p className="small-text">Boitekanelo Space is your calm community for sharing, mood tracking, and supportive check-ins.</p>

        <div className="banner">
          <p style={{ margin: 0, fontWeight: 600 }}>Your current role</p>
          <p style={{ margin: 0 }}>{role}</p>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <Link to="/feed" className="nav-link">Visit the thread feed</Link>
          <Link to="/checkin" className="nav-link">Complete today’s check-in</Link>
          <Link to="/mood" className="nav-link">Track how you feel</Link>
          <Link to="/profile" className="nav-link">Review your profile</Link>
        </div>
      </section>

      <section className="card">
        <h2 className="section-title">How it works</h2>
        <ul style={{ paddingLeft: 18, margin: 0, color: '#334e68' }}>
          <li>Share thoughts in the feed — anonymous if you choose.</li>
          <li>Leave supportive comments and breathing prompts.</li>
          <li>Log your mood each day and watch trends grow.</li>
          <li>Use AI check-ins for gentle encouragement and self-care ideas.</li>
        </ul>
      </section>
    </div>
  )
}
