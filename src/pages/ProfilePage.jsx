import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'

export default function ProfilePage() {
  const { profile } = useAuth()
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
    <div className="grid-two">
      <section className="card">
        <h1 className="section-title">Your profile</h1>
        <p className="small-text">Manage your role and share why you want to support the community.</p>

        <div className="card" style={{ marginTop: 24 }}>
          <p><strong>Email</strong></p>
          <p className="small-text">{profile?.email ?? 'Not available'}</p>
          <p style={{ marginTop: 16 }}><strong>Role</strong></p>
          <p className="small-text">{profile?.role ?? 'user'}</p>
        </div>
      </section>

      <section className="card">
        <h2 className="section-title">Supporter application</h2>
        <p className="small-text">If you want to support others, tell us what experience or qualities you bring.</p>

        <form className="card" onSubmit={submitApplication} style={{ marginTop: 24 }}>
          <div className="form-field">
            <label htmlFor="story">Why would you like to become a supporter?</label>
            <textarea id="story" value={story} onChange={(e) => setStory(e.target.value)} rows={6} required />
          </div>
          <button type="submit" className="primary">Submit application</button>
          {status && <div className="alert" style={{ marginTop: 16 }}>{status}</div>}
        </form>

        {application && (
          <div className="banner" style={{ marginTop: 24 }}>
            <p style={{ margin: 0 }}><strong>Last application</strong></p>
            <p className="small-text" style={{ margin: '10px 0 0' }}>Status: {application.status}</p>
            <p className="small-text" style={{ margin: '8px 0 0' }}>{application.story}</p>
          </div>
        )}
      </section>
    </div>
  )
}
