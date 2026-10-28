import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { scanForHarmfulContent } from '../lib/safetyUtils'
import Icon from '../components/Icon'

const defaultPrompt = 'How are you feeling today?'

export default function CheckinPage() {
  const { session } = useAuth()
  const [prompt, setPrompt] = useState(defaultPrompt)
  const [response, setResponse] = useState('')
  const [warning, setWarning] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setWarning(null)
    setError(null)
    setResponse('')

    try {
      if (!session?.user) {
        setError('Please sign in again before sending a check-in.')
        return
      }

      const { flag, warningMessage } = scanForHarmfulContent(prompt)
      const { data, error: functionError } = await supabase.functions.invoke('ai-checkin', {
        body: { message: prompt }
      })

      if (functionError) {
        const errorResponse = functionError.context
        let responseError = null

        if (errorResponse instanceof Response) {
          try {
            const errorBody = await errorResponse.clone().json()
            responseError = typeof errorBody?.error === 'string' ? errorBody.error : null
          } catch {
            responseError = null
          }
        }

        if (errorResponse?.status === 401) {
          setError(responseError || 'Your session has expired. Please sign in again.')
        } else if (errorResponse?.status === 503 || errorResponse?.status === 504) {
          setError(responseError || 'The check-in service is busy or taking too long. Please try again shortly.')
        } else {
          setError(responseError || 'We could not connect to the check-in service. Please try again.')
        }
        return
      }

      if (typeof data?.reply !== 'string' || !data.reply.trim()) {
        setError('We received an unexpected response. Please try again.')
        return
      }

      const aiText = data.reply
      const safetyFlag = flag || Boolean(data.safety_flag)
      const safetyWarning = warningMessage || data.warning_message

      if (safetyFlag && safetyWarning) {
        setWarning(safetyWarning)
      }

      const { error: saveError } = await supabase.from('ai_checkins').insert([
        {
          user_id: session.user.id,
          user_prompt: prompt,
          ai_response: aiText,
          safety_flag: safetyFlag,
          warning_message: safetyWarning,
          created_at: new Date().toISOString()
        }
      ])

      if (saveError) {
        setError('Your response is ready, but we could not save this check-in.')
      }

      setResponse(aiText)
    } catch {
      setError('We could not send your check-in right now. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="checkin-page">
      <header className="checkin-heading">
        <span className="checkin-heading-icon" aria-hidden="true"><Icon name="checkin" size={22} /></span>
        <span className="checkin-eyebrow">A GENTLE PAUSE</span>
        <h1>Daily check-in</h1>
        <p>Share what’s on your mind and receive calm, non-diagnostic reflection.</p>
      </header>

      <div className="checkin-layout">
        <section className="checkin-form-panel">
          <div className="checkin-form-intro">
            <h2>What would you like to share?</h2>
            <p>There’s no right way to check in. Start wherever you are.</p>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="prompt">Your check-in</label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={6}
                required
              />
            </div>

            <button type="submit" className="checkin-submit" disabled={loading}>
              {loading && <span className="checkin-spinner" aria-hidden="true" />}
              {loading ? 'Taking a moment…' : 'Send check-in'} {!loading && <span aria-hidden="true">→</span>}
            </button>
            {error && <div className="checkin-alert checkin-alert-error" role="alert">{error}</div>}
            {warning && <div className="checkin-alert checkin-alert-warning" role="status">{warning}</div>}
            {response && (
              <div className="checkin-response">
                <span className="checkin-response-icon" aria-hidden="true"><Icon name="heart" /></span>
                <div>
                  <strong>A supportive reflection</strong>
                  <p>{response}</p>
                </div>
              </div>
            )}
          </form>
        </section>

        <aside className="checkin-aside">
          <section className="checkin-info-card">
            <span className="checkin-info-icon" aria-hidden="true"><Icon name="shield" /></span>
            <span className="checkin-eyebrow">A LITTLE ABOUT THIS SPACE</span>
            <h2>How check-ins work</h2>
            <p>This tool is here to listen, reflect, and offer caring suggestions. It’s not a diagnosis or a substitute for professional care.</p>
            <ul>
              <li><span aria-hidden="true">✓</span> Reflect in your own words</li>
              <li><span aria-hidden="true">✓</span> Receive gentle encouragement</li>
              <li><span aria-hidden="true">✓</span> Find grounding ideas</li>
            </ul>
          </section>
          <p className="checkin-privacy-note"><span aria-hidden="true"><Icon name="lock" size={14} /></span> Your check-in is personal and shared only with this service.</p>
        </aside>
      </div>
    </div>
  )
}
