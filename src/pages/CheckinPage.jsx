import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { scanForHarmfulContent } from '../lib/safetyUtils'

const defaultPrompt = 'How are you feeling today?'

export default function CheckinPage() {
  const { profile } = useAuth()
  const [prompt, setPrompt] = useState(defaultPrompt)
  const [response, setResponse] = useState('')
  const [warning, setWarning] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setWarning(null)
    setResponse('')

    const { flag, warningMessage } = scanForHarmfulContent(prompt)

    const edgeUrl = import.meta.env.VITE_SUPABASE_EDGE_URL
    let aiText = ''

    if (edgeUrl) {
      try {
        const res = await fetch(`${edgeUrl}/checkin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, mood: profile?.recent_mood ?? 'reflective' })
        })
        const data = await res.json()
        aiText = data?.ai_response ?? data?.response ?? 'Thank you for sharing.'
        if (data?.safety_flag) {
          setWarning(data.warning_message)
        }
      } catch (error) {
        aiText = 'We could not connect to the AI service. If you have a local edge function, set VITE_SUPABASE_EDGE_URL.'
      }
    } else {
      aiText = `I hear you. It can be helpful to pause, breathe, and name one small feeling. Try pressing into your feet, counting your breath, and gently reminding yourself that feeling is temporary. If you can, write down one thing that feels supportive in this moment.`
    }

    const { error } = await supabase.from('ai_checkins').insert([
      {
        user_id: profile?.id,
        user_prompt: prompt,
        ai_response: aiText,
        safety_flag: flag,
        warning_message: warningMessage,
        created_at: new Date().toISOString()
      }
    ])

    if (error) {
      setWarning('There was an error saving your check-in. Please try again later.')
    }

    if (flag) {
      setWarning(warningMessage)
    }

    setResponse(aiText)
    setLoading(false)
  }

  return (
    <div className="grid-two">
      <section className="card">
        <h1 className="section-title">Daily check-in</h1>
        <p className="small-text">Share what’s on your mind and receive calm, non-diagnostic reflection.</p>

        <form className="card" onSubmit={handleSubmit} style={{ marginTop: 24 }}>
          <div className="form-field">
            <label htmlFor="prompt">Your check-in</label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={5}
              required
            />
          </div>

          <button type="submit" className="primary" disabled={loading}>
            {loading ? 'Checking in...' : 'Send check-in'}
          </button>
          {warning && <div className="alert" style={{ marginTop: 18 }}>{warning}</div>}
          {response && (
            <div className="banner" style={{ marginTop: 18 }}>
              <strong>Supportive response</strong>
              <p style={{ margin: '10px 0 0' }}>{response}</p>
            </div>
          )}
        </form>
      </section>

      <aside>
        <section className="card">
          <h2 className="section-title">How the AI check-in works</h2>
          <p className="small-text">This tool is designed to listen, reflect, and offer caring suggestions. It is not a diagnosis or therapy substitute.</p>
          <ul style={{ margin: 0, paddingLeft: 18, color: '#334e68' }}>
            <li>Reflect on feelings in simple words.</li>
            <li>Receive calm encouragement.</li>
            <li>Get grounding or journaling ideas.</li>
            <li>See crisis messaging if needed.</li>
          </ul>
        </section>
      </aside>
    </div>
  )
}
