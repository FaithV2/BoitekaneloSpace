import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'

const options = [
  { value: 'happy', label: 'Happy' },
  { value: 'calm', label: 'Calm' },
  { value: 'anxious', label: 'Anxious' },
  { value: 'sad', label: 'Sad' },
  { value: 'stressed', label: 'Stressed' }
]

export default function MoodPage() {
  const { profile } = useAuth()
  const [mood, setMood] = useState('calm')
  const [notes, setNotes] = useState('')
  const [logs, setLogs] = useState([])
  const [saved, setSaved] = useState(false)

  const loadMoodLogs = async () => {
    const { data } = await supabase
      .from('mood_logs')
      .select('*')
      .eq('user_id', profile?.id)
      .order('logged_at', { ascending: false })
      .limit(30)

    setLogs(data ?? [])
  }

  useEffect(() => {
    if (profile?.id) {
      loadMoodLogs()
    }
  }, [profile?.id])

  const handleSubmit = async (event) => {
    event.preventDefault()
    await supabase.from('mood_logs').insert([
      {
        user_id: profile?.id,
        mood,
        notes,
        logged_at: new Date().toISOString().slice(0, 10),
        created_at: new Date().toISOString()
      }
    ])

    setSaved(true)
    setNotes('')
    setTimeout(() => setSaved(false), 2500)
    loadMoodLogs()
  }

  return (
    <div className="grid-two">
      <section className="card">
        <h1 className="section-title">Daily mood tracker</h1>
        <p className="small-text">Log how you feel today and keep a calm record of your progress.</p>

        <form onSubmit={handleSubmit} className="card" style={{ marginTop: 24 }}>
          <div className="form-field">
            <label htmlFor="mood">Select mood</label>
            <select id="mood" value={mood} onChange={(e) => setMood(e.target.value)}>
              {options.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="notes">Notes</label>
            <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What helped you feel this way?" />
          </div>

          <button type="submit" className="primary">Save mood</button>
          {saved && <div className="alert" style={{ marginTop: 16 }}>Mood logged.</div>}
        </form>
      </section>

      <section className="card">
        <h2 className="section-title">Mood history</h2>
        {logs.length === 0 ? (
          <p className="small-text">Track at least one mood entry to see your personal trend.</p>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {logs.map((entry) => (
              <div key={entry.id} style={{ borderRadius: 18, background: '#f8fbff', padding: 16, border: '1px solid rgba(16,42,67,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <strong>{entry.mood}</strong>
                  <span className="small-text">{entry.logged_at}</span>
                </div>
                {entry.notes && <p className="small-text" style={{ margin: '8px 0 0' }}>{entry.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
