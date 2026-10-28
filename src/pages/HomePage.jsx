import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function HomePage() {
  const { profile } = useAuth()
  const role = profile?.role ?? 'user'

  return (
    <div className="home-page">
      <section className="home-welcome">
        <div className="home-welcome-copy">
          <h1>Welcome back, {profile?.display_name ?? 'friend'}</h1>
          <p>Connect with the community, check in, or update your profile.</p>
          <div className="home-role-pill">{role === 'admin' ? 'Admin' : role === 'supporter' ? 'Supporter' : 'Member'}</div>
        </div>
      </section>

      <section className="home-actions-section" aria-labelledby="home-actions-title">
        <div className="home-section-heading">
          <h2 id="home-actions-title">Your space</h2>
        </div>
        <div className="home-action-grid">
          <Link to="/feed" className="home-action-card home-action-feed">
            <span><strong>Community feed</strong><small>Posts and discussions</small></span>
            <span className="home-action-arrow" aria-hidden="true">›</span>
          </Link>
          <Link to="/checkin" className="home-action-card home-action-checkin">
            <span><strong>Daily check-in</strong><small>Write down what’s on your mind</small></span>
            <span className="home-action-arrow" aria-hidden="true">›</span>
          </Link>
          <Link to="/mood" className="home-action-card home-action-mood">
            <span><strong>Mood tracker</strong><small>Record and review your moods</small></span>
            <span className="home-action-arrow" aria-hidden="true">›</span>
          </Link>
          <Link to="/profile" className="home-action-card home-action-profile">
            <span><strong>Your profile</strong><small>Account details and role</small></span>
            <span className="home-action-arrow" aria-hidden="true">›</span>
          </Link>
        </div>
      </section>
    </div>
  )
}
