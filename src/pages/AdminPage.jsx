import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function AdminPage() {
  const [applications, setApplications] = useState([])
  const [message, setMessage] = useState(null)

  const loadApplications = async () => {
    const { data } = await supabase
      .from('supporter_applications')
      .select('*, users(email, display_name)')
      .order('created_at', { ascending: false })
      .limit(20)
    setApplications(data ?? [])
  }

  useEffect(() => {
    loadApplications()
  }, [])

  const updateStatus = async (applicationId, newStatus) => {
    const { error } = await supabase
      .from('supporter_applications')
      .update({ status: newStatus, reviewed_at: new Date().toISOString() })
      .eq('id', applicationId)

    if (error) {
      setMessage(error.message)
    } else {
      setMessage(`Application ${newStatus}.`)
      loadApplications()
    }
  }

  return (
    <div>
      <section className="card">
        <h1 className="section-title">Admin panel</h1>
        <p className="small-text">Review supporter applications and manage community safety.</p>
      </section>

      <section className="card" style={{ marginTop: 24 }}>
        <h2 className="section-title">Supporter applications</h2>
        {applications.length === 0 ? (
          <p className="small-text">No supporter applications are pending review.</p>
        ) : (
          <div style={{ display: 'grid', gap: 20 }}>
            {applications.map((application) => (
              <div key={application.id} style={{ padding: 18, borderRadius: 20, background: '#f8fbff', border: '1px solid rgba(16,42,67,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                  <div>
                    <strong>{application.users?.display_name ?? application.users?.email ?? 'Applicant'}</strong>
                    <div className="small-text">Status: {application.status}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="secondary" onClick={() => updateStatus(application.id, 'approved')}>
                      Approve
                    </button>
                    <button type="button" className="outline" onClick={() => updateStatus(application.id, 'rejected')}>
                      Reject
                    </button>
                  </div>
                </div>
                <p className="small-text" style={{ marginTop: 12 }}>{application.story}</p>
              </div>
            ))}
          </div>
        )}
        {message && <div className="alert" style={{ marginTop: 18 }}>{message}</div>}
      </section>
    </div>
  )
}
