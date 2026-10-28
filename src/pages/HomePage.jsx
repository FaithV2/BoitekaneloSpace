import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Icon from '../components/Icon'

export default function HomePage() {
  const { profile } = useAuth()
  const role = profile?.role ?? 'user'

  return (
    <div className="home-page">
      <section className="home-welcome">
        <div className="home-welcome-copy">
          <span className="home-eyebrow">YOUR SPACE · {role === 'admin' ? 'ADMIN' : role === 'supporter' ? 'SUPPORTER' : 'MEMBER'}</span>
          <h1>Welcome back,<br />{profile?.display_name ?? 'friend'}.</h1>
          <p>Connect with the community, check in, or update your profile.</p>
          <div className="home-role-pill">{role === 'admin' ? 'Admin' : role === 'supporter' ? 'Supporter' : 'Member'}</div>
        </div>
        <div className="home-welcome-art" aria-hidden="true"><Icon name="heart" size={38} strokeWidth={1.4} /></div>
      </section>

      <section className="home-actions-section" aria-labelledby="home-actions-title">
        <div className="home-section-heading">
          <span className="home-eyebrow">FIND YOUR NEXT STEP</span>
          <h2 id="home-actions-title">Your space</h2>
        </div>
        <div className="home-action-grid">
          <Link to="/feed" className="home-action-card home-action-feed">
            <span className="home-action-icon"><Icon name="feed" /></span>
            <span><strong>Community feed</strong><small>Posts and discussions</small></span>
            <span className="home-action-arrow"><Icon name="arrow" size={18} /></span>
          </Link>
          <Link to="/checkin" className="home-action-card home-action-checkin">
            <span className="home-action-icon"><Icon name="checkin" /></span>
            <span><strong>Daily check-in</strong><small>Write down what’s on your mind</small></span>
            <span className="home-action-arrow"><Icon name="arrow" size={18} /></span>
          </Link>
          <Link to="/mood" className="home-action-card home-action-mood">
            <span className="home-action-icon"><Icon name="mood" /></span>
            <span><strong>Mood tracker</strong><small>Record and review your moods</small></span>
            <span className="home-action-arrow"><Icon name="arrow" size={18} /></span>
          </Link>
          <Link to="/profile" className="home-action-card home-action-profile">
            <span className="home-action-icon"><Icon name="profile" /></span>
            <span><strong>Your profile</strong><small>Account details and role</small></span>
            <span className="home-action-arrow"><Icon name="arrow" size={18} /></span>
          </Link>
        </div>
      </section>
    </div>
  )
}
