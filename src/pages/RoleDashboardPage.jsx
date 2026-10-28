import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'

function getDisplayName(profile) {
  return profile?.display_name || profile?.username || 'Community member'
}

function formatQueueDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date)
}

export default function RoleDashboardPage({ role }) {
  const { profile } = useAuth()
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const isTherapist = role === 'therapist'
  const dashboardTitle = isTherapist ? 'Therapist space' : 'Supporter space'

  const loadQueue = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data: postRows, error: postError } = await supabase
        .from('posts')
        .select('id, content, anonymous, created_at, comments(id, users(role))')
        .order('created_at', { ascending: false })
        .limit(50)

      if (postError) throw postError

      const unanswered = (postRows ?? [])
        .filter((post) => !post.comments?.some((comment) => (
          ['supporter', 'therapist'].includes(comment.users?.role)
        )))
      const publicPostIds = unanswered.filter((post) => !post.anonymous).map((post) => post.id)
      const authorsByPost = {}

      if (publicPostIds.length > 0) {
        const { data: authors, error: authorError } = await supabase
          .from('posts')
          .select('id, users(username, display_name)')
          .in('id', publicPostIds)

        if (authorError) throw authorError
        for (const author of authors ?? []) authorsByPost[author.id] = author.users
      }

      setConversations(unanswered.map((post) => ({
        ...post,
        authorName: post.anonymous
          ? 'Anonymous'
          : authorsByPost[post.id]?.display_name || authorsByPost[post.id]?.username || 'Community member'
      })))
    } catch (loadError) {
      console.error(`Unable to load ${role} conversation queue:`, loadError)
      setConversations([])
      setError('We couldn’t load the conversation queue. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [role])

  useEffect(() => {
    loadQueue()

    const channel = supabase
      .channel(`role-queue-${role}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => loadQueue())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => loadQueue())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadQueue, role])

  const displayName = getDisplayName(profile)

  return (
    <div className={`role-dashboard ${isTherapist ? 'is-therapist' : 'is-supporter'}`}>
      <header className="role-dashboard-hero">
        <div className="role-dashboard-hero-copy">
          <span className="role-dashboard-eyebrow">
            {isTherapist ? 'VERIFIED PROFESSIONAL SPACE' : 'COMMUNITY CARE SPACE'}
          </span>
          <h1>{dashboardTitle}</h1>
          <p>Welcome, {displayName}. Choose a conversation where a thoughtful response could help.</p>
        </div>
        <span className="role-dashboard-hero-mark" aria-hidden="true">{isTherapist ? '✧' : '♡'}</span>
      </header>

      <div className="role-dashboard-layout">
        <main className="role-queue-panel">
          <div className="role-queue-heading">
            <div>
              <span className="role-dashboard-eyebrow">SHARED COMMUNITY QUEUE</span>
              <h2>Conversations awaiting support</h2>
              <p>Posts without a reply from a supporter or therapist appear here.</p>
            </div>
            <span className="role-queue-count">{conversations.length}</span>
          </div>

          {error && <div className="role-queue-error" role="alert">{error}</div>}
          {loading ? (
            <div className="role-queue-state" role="status"><span className="app-loading-spinner" />Loading conversations…</div>
          ) : error ? (
            <div className="role-queue-state is-error">
              <button className="role-queue-retry" type="button" onClick={loadQueue}>Try again</button>
            </div>
          ) : conversations.length === 0 ? (
            <div className="role-queue-state is-empty">
              <span aria-hidden="true">🌱</span>
              <strong>Nothing waiting right now</strong>
              <p>New conversations needing support will appear here.</p>
            </div>
          ) : (
            <div className="role-conversation-list">
              {conversations.map((conversation) => (
                <article className="role-conversation-card" key={conversation.id}>
                  <div className="role-conversation-meta">
                    <span className={`role-conversation-avatar${conversation.anonymous ? ' is-anonymous' : ''}`} aria-hidden="true">
                      {conversation.anonymous ? '···' : conversation.authorName.charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <strong>{conversation.authorName}</strong>
                      <time dateTime={conversation.created_at}>{formatQueueDate(conversation.created_at)}</time>
                    </div>
                    <span className="role-awaiting-label">Awaiting support</span>
                  </div>
                  <p className="role-conversation-content">{conversation.content}</p>
                  <div className="role-conversation-footer">
                    <span>{conversation.comments?.length ?? 0} {conversation.comments?.length === 1 ? 'comment' : 'comments'}</span>
                    <Link to={`/post/${conversation.id}`} className="role-reply-link">
                      Read and respond <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </main>

        <aside className="role-dashboard-sidebar">
          <section className="role-guidance-card">
            <span className="role-guidance-icon" aria-hidden="true">{isTherapist ? '✧' : '♡'}</span>
            <span className="role-dashboard-eyebrow">{isTherapist ? 'PROFESSIONAL BOUNDARIES' : 'SUPPORT WITH CARE'}</span>
            <h2>{isTherapist ? 'A thoughtful presence' : 'A kind community voice'}</h2>
            {isTherapist ? (
              <>
                <p>Your verified role helps members recognize your professional perspective. Keep responses supportive and within the community setting.</p>
                <ul>
                  <li>Offer general, non-diagnostic support.</li>
                  <li>Protect privacy; don’t request sensitive details.</li>
                  <li>Encourage appropriate professional or emergency help when needed.</li>
                  <li>This platform is not a clinical care channel.</li>
                </ul>
              </>
            ) : (
              <>
                <p>Your time and compassion help members feel heard. You don’t need to have all the answers to offer support.</p>
                <ul>
                  <li>Listen without judgement.</li>
                  <li>Offer encouragement, not unsolicited advice.</li>
                  <li>Respect anonymity and personal boundaries.</li>
                </ul>
              </>
            )}
          </section>
          <Link className="role-dashboard-feed-link" to="/feed">Visit the community feed <span aria-hidden="true">→</span></Link>
        </aside>
      </div>
    </div>
  )
}
