import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import Icon from '../components/Icon'

export default function ProfilePage() {
  const { profile } = useAuth()
  const currentRole = profile?.role ?? 'user'
  const roleLabel = currentRole === 'therapist'
    ? 'Verified therapist'
    : currentRole === 'supporter'
      ? 'Community supporter'
      : currentRole === 'admin'
        ? 'Community admin'
        : 'Community member'
  const [story, setStory] = useState('')
  const [application, setApplication] = useState(null)
  const [status, setStatus] = useState(null)

  const loadApplication = async () => {
    if (!profile?.id) return
    const { data } = await supabase
      .from('supporter_applications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    setApplication(data)
  }

  useEffect(() => {
    loadApplication()
  }, [profile?.id])

  const submitApplication = async (event) => {
    event.preventDefault()
    if (!profile?.id) return

    const { error } = await supabase.from('supporter_applications').insert([
      { user_id: profile.id, story, status: 'pending', created_at: new Date().toISOString() }
    ])

    if (error) {
      setStatus(error.message)
    } else {
      setStatus('Application submitted. An admin will review it soon.')
      setStory('')
      loadApplication()
    }
  }

  return (
    <div className="profile-page">
      <header className="profile-heading">
        <span className="profile-avatar" aria-hidden="true">
          {(profile?.display_name || profile?.username || 'Y').charAt(0).toUpperCase()}
        </span>
        <div>
          <span className="profile-eyebrow">YOUR ACCOUNT</span>
          <h1>Your profile</h1>
          <p>Manage your account and your place in the community.</p>
        </div>
      </header>

      <div className="profile-layout">
        <section className="profile-account-card">
          <div className="profile-section-heading">
            <span className="profile-section-icon" aria-hidden="true"><Icon name="profile" /></span>
            <div><h2>Account details</h2><p>Your information at a glance.</p></div>
          </div>
          <dl className="profile-details">
            <div><dt>Email address</dt><dd>{profile?.email ?? 'Not available'}</dd></div>
            <div><dt>Community role</dt><dd><span className={`profile-role-pill is-${currentRole}`}>{roleLabel}</span></dd></div>
            {profile?.display_name && <div><dt>Display name</dt><dd>{profile.display_name}</dd></div>}
          </dl>
          <div className="profile-account-note"><span aria-hidden="true"><Icon name="lock" size={14} /></span> Your account details are kept private.</div>
        </section>

        <section className="profile-application-card">
          <div className="profile-section-heading">
            <span className="profile-section-icon profile-application-icon" aria-hidden="true"><Icon name="heart" /></span>
            <div><h2>{currentRole === 'supporter' ? 'You’re a supporter' : 'Become a supporter'}</h2><p>Supporter applications are reviewed by the community team.</p></div>
          </div>
          {currentRole === 'therapist' ? (
            <p className="profile-application-intro">Your therapist status was assigned by the Boitekanelo Space team after direct outreach. Your role badge appears on community contributions.</p>
          ) : currentRole === 'supporter' ? (
            <p className="profile-application-intro">Thank you for supporting the community. Your role badge appears when you join conversations.</p>
          ) : (
            <p className="profile-application-intro">If you’d like to support others, share a little about the experience or qualities you bring. Therapist roles are assigned only by our team after direct recruitment.</p>
          )}

          {currentRole === 'user' && <form className="profile-application-form" onSubmit={submitApplication}>
            <div className="form-field">
              <label htmlFor="story">Why would you like to become a supporter?</label>
              <textarea id="story" value={story} onChange={(e) => setStory(e.target.value)} rows={6} required placeholder="Share the qualities, experience, or care you’d bring…" />
            </div>
            <button type="submit" className="profile-submit-button">Submit application <span aria-hidden="true">→</span></button>
            {status && <div className="profile-status" role="status">{status}</div>}
          </form>}

          {application && (
            <div className="profile-last-application">
              <div className="profile-last-application-heading">
                <strong>Latest application</strong>
                <span className={`profile-application-status is-${application.status}`}>{application.status}</span>
              </div>
              <p>{application.story}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
