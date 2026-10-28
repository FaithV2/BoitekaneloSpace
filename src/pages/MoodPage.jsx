import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'

const moods = [
  { value: 'happy', label: 'Happy', emoji: '😊', color: '#e5a331', tint: '#fff7df' },
  { value: 'calm', label: 'Calm', emoji: '😌', color: '#489b83', tint: '#e9f7f1' },
  { value: 'anxious', label: 'Anxious', emoji: '😟', color: '#8a79c2', tint: '#f2effb' },
  { value: 'sad', label: 'Sad', emoji: '😔', color: '#6488bd', tint: '#edf3fc' },
  { value: 'stressed', label: 'Stressed', emoji: '😣', color: '#d47b68', tint: '#fff0eb' }
]

const moodByValue = Object.fromEntries(moods.map((mood) => [mood.value, mood]))

function getLocalDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatLoggedDate(date) {
  if (!date) return 'Date unavailable'

  const parsedDate = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsedDate.getTime())) return 'Date unavailable'

  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(parsedDate)
}

export default function MoodPage() {
  const { session } = useAuth()
  const userId = session?.user?.id
  const [mood, setMood] = useState('calm')
  const [notes, setNotes] = useState('')
  const [logs, setLogs] = useState([])
  const [historyStatus, setHistoryStatus] = useState('loading')
  const [historyError, setHistoryError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)

  const loadMoodLogs = useCallback(async () => {
    if (!userId) {
      setLogs([])
      setHistoryStatus('ready')
      return
    }

    setHistoryStatus('loading')
    setHistoryError('')

    try {
      const { data, error } = await supabase
        .from('mood_logs')
        .select('id, mood, notes, logged_at, created_at')
        .eq('user_id', userId)
        .order('logged_at', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(30)

      if (error) throw error

      setLogs(data ?? [])
      setHistoryStatus('ready')
    } catch (error) {
      console.error('Unable to load mood history:', error)
      setHistoryError('We couldn’t load your mood history. Please try again.')
      setHistoryStatus('error')
    }
  }, [userId])

  useEffect(() => {
    loadMoodLogs()
  }, [loadMoodLogs])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaveError('')
    setSaved(false)

    if (!userId) {
      setSaveError('Please sign in again before saving your mood.')
      return
    }

    setSaving(true)

    try {
      const { error } = await supabase.from('mood_logs').insert([
        {
          user_id: userId,
          mood,
          notes: notes.trim() || null,
          logged_at: getLocalDateKey(new Date())
        }
      ])

      if (error) throw error

      setNotes('')
      setSaved(true)
      await loadMoodLogs()
    } catch (error) {
      console.error('Unable to save mood entry:', error)
      setSaveError('We couldn’t save your mood just now. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const recentEntries = [...logs].slice(0, 7).reverse()

  return (
    <div className="mood-page">
      <header className="mood-heading">
        <div className="mood-heading-copy">
          <span className="mood-eyebrow"><span aria-hidden="true">✦</span> A moment for you</span>
          <h1>How are you feeling today?</h1>
          <p>There’s no right or wrong way to feel. Take a breath and check in with yourself.</p>
        </div>
        <div className="mood-heading-art" aria-hidden="true">
          <span>☁️</span>
          <span>🌿</span>
        </div>
      </header>

      <div className="mood-content-grid">
        <section className="mood-panel mood-entry-panel" aria-labelledby="mood-entry-title">
          <div className="mood-panel-heading">
            <div>
              <span className="mood-step">YOUR DAILY CHECK-IN</span>
              <h2 id="mood-entry-title">Name what you’re feeling</h2>
            </div>
            <span className="mood-heading-icon" aria-hidden="true">♡</span>
          </div>

          <form onSubmit={handleSubmit}>
            <fieldset className="mood-choice-fieldset">
              <legend className="mood-field-label">Choose the feeling closest to yours</legend>
              <div className="mood-choice-grid">
                {moods.map((option) => (
                  <button
                    key={option.value}
                    className={`mood-choice${mood === option.value ? ' is-selected' : ''}`}
                    type="button"
                    aria-pressed={mood === option.value}
                    onClick={() => {
                      setMood(option.value)
                      setSaved(false)
                    }}
                    style={{ '--mood-color': option.color, '--mood-tint': option.tint }}
                  >
                    <span className="mood-choice-emoji" aria-hidden="true">{option.emoji}</span>
                    <span>{option.label}</span>
                    {mood === option.value && <span className="mood-choice-check" aria-hidden="true">✓</span>}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="mood-notes-field">
              <label className="mood-field-label" htmlFor="mood-notes">Anything you’d like to remember?</label>
              <p className="mood-field-hint">A few words can help make sense of how you’re feeling.</p>
              <textarea
                id="mood-notes"
                value={notes}
                onChange={(event) => {
                  setNotes(event.target.value)
                  setSaved(false)
                }}
                placeholder="What’s on your mind? What might you need right now?"
                rows={4}
              />
            </div>

            <button className="mood-save-button" type="submit" disabled={saving}>
              {saving ? (
                <>
                  <span className="mood-spinner" aria-hidden="true" />
                  Saving your check-in…
                </>
              ) : (
                <>
                  Save mood <span aria-hidden="true">→</span>
                </>
              )}
            </button>

            {saved && (
              <p className="mood-feedback mood-feedback-success" role="status">
                <span aria-hidden="true">✓</span> Your check-in is saved. Thank you for taking a moment for yourself.
              </p>
            )}
            {saveError && <p className="mood-feedback mood-feedback-error" role="alert">{saveError}</p>}
          </form>
        </section>

        <section className="mood-panel mood-history-panel" aria-labelledby="mood-history-title">
          <div className="mood-panel-heading">
            <div>
              <span className="mood-step">YOUR PERSONAL JOURNEY</span>
              <h2 id="mood-history-title">Mood history</h2>
            </div>
            <span className="mood-heading-icon" aria-hidden="true">↗</span>
          </div>

          {historyStatus === 'loading' ? (
            <div className="mood-history-loading" role="status">
              <span className="mood-spinner" aria-hidden="true" />
              <span>Gathering your check-ins…</span>
            </div>
          ) : historyStatus === 'error' ? (
            <div className="mood-history-message mood-history-error" role="alert">
              <span aria-hidden="true">☁</span>
              <p>{historyError}</p>
              <button type="button" className="mood-retry-button" onClick={loadMoodLogs}>Try again</button>
            </div>
          ) : logs.length === 0 ? (
            <div className="mood-history-message mood-history-empty">
              <span className="mood-empty-emoji" aria-hidden="true">🌱</span>
              <h3>Your story starts here</h3>
              <p>When you save a check-in, it’ll appear here. Over time, you’ll have a gentle view of your moods.</p>
            </div>
          ) : (
            <>
              <div className="mood-trend">
                <div className="mood-trend-heading">
                  <div>
                    <h3>Your recent moods</h3>
                    <p>The last {recentEntries.length} saved {recentEntries.length === 1 ? 'check-in' : 'check-ins'}</p>
                  </div>
                  <span className="mood-trend-count">{logs.length} {logs.length === 1 ? 'entry' : 'entries'}</span>
                </div>

                <div
                  className="mood-chart-scroll"
                  role="img"
                  aria-label={`Mood trend for the last ${recentEntries.length} saved entries. ${recentEntries.map((entry) => `${moodByValue[entry.mood]?.label ?? entry.mood}, ${formatLoggedDate(entry.logged_at)}`).join('; ')}.`}
                >
                  <div className="mood-chart" style={{ '--entry-count': recentEntries.length }}>
                    <div className="mood-chart-dates" aria-hidden="true">
                      <span />
                      {recentEntries.map((entry) => (
                        <span className="mood-chart-date" key={`date-${entry.id}`}>{formatLoggedDate(entry.logged_at).replace(/^[A-Za-z]{3}, /, '')}</span>
                      ))}
                    </div>
                    {moods.map((option) => (
                      <div className="mood-chart-row" key={option.value} aria-hidden="true">
                        <span className="mood-chart-label">{option.emoji} {option.label}</span>
                        {recentEntries.map((entry) => (
                          <span className="mood-chart-cell" key={`${option.value}-${entry.id}`}>
                            {entry.mood === option.value && (
                              <span
                                className="mood-chart-dot"
                                style={{ '--mood-color': option.color, '--mood-tint': option.tint }}
                              />
                            )}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mood-history-list-heading">
                <h3>Recent check-ins</h3>
                <span>Showing up to 30</span>
              </div>
              <ol className="mood-history-list">
                {logs.map((entry) => {
                  const entryMood = moodByValue[entry.mood]

                  return (
                    <li className="mood-history-entry" key={entry.id}>
                      <span
                        className="mood-history-emoji"
                        aria-hidden="true"
                        style={{
                          '--mood-color': entryMood?.color ?? '#6488bd',
                          '--mood-tint': entryMood?.tint ?? '#edf3fc'
                        }}
                      >
                        {entryMood?.emoji ?? '💭'}
                      </span>
                      <div className="mood-history-entry-content">
                        <div className="mood-history-entry-topline">
                          <strong>{entryMood?.label ?? entry.mood}</strong>
                          <time dateTime={entry.logged_at}>{formatLoggedDate(entry.logged_at)}</time>
                        </div>
                        {entry.notes ? (
                          <p>{entry.notes}</p>
                        ) : (
                          <p className="mood-no-note">No note added</p>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ol>
            </>
          )}
        </section>
      </div>

      <p className="mood-page-note"><span aria-hidden="true">♡</span> Your mood entries are private to you.</p>
    </div>
  )
}
