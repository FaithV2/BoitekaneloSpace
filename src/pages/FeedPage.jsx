import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'

const moodTags = {
  happy: '😊',
  sad: '😔',
  anxious: '😰',
  stressed: '😓',
  calm: '🌿'
}

export default function FeedPage() {
  const { profile } = useAuth()
  const [posts, setPosts] = useState([])
  const [content, setContent] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const loadPosts = async () => {
    const { data, error } = await supabase
      .from('posts')
      .select('*, users(username, display_name), comments(id)')
      .order('created_at', { ascending: false })
      .limit(20)

    if (!error) setPosts(data ?? [])
  }

  useEffect(() => {
    loadPosts()

    const channel = supabase
      .channel('posts-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => {
        loadPosts()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.from('posts').insert([
      {
        user_id: profile?.id,
        content,
        anonymous,
        created_at: new Date().toISOString()
      }
    ])

    if (error) {
      setError(error.message)
    } else {
      setContent('')
      setAnonymous(false)
      loadPosts()
    }

    setLoading(false)
  }

  return (
    <div className="grid-two">
      <section className="card">
        <h1 className="section-title">Thread feed</h1>
        <p className="small-text">Share a thought, post anonymously, and support others.</p>

        <form onSubmit={handleSubmit} className="card" style={{ marginBottom: 24 }}>
          <div className="form-field">
            <label htmlFor="content">New post</label>
            <textarea id="content" value={content} onChange={(e) => setContent(e.target.value)} required placeholder="Write something gentle, honest, or supportive." />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
              Post anonymously
            </label>
            <button type="submit" className="primary" disabled={loading}>
              {loading ? 'Posting...' : 'Share'}
            </button>
          </div>
          {error && <div className="alert" style={{ marginTop: 16 }}>{error}</div>}
        </form>

        {posts.map((post) => (
          <article key={post.id} className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 12 }}>
              <div>
                <strong>{post.anonymous ? 'Anonymous' : post.users?.display_name ?? post.users?.username ?? 'Community member'}</strong>
                <div className="small-text">{new Date(post.created_at).toLocaleString()}</div>
              </div>
              <div className="small-text">{post.supporter_response ? 'Supporter post' : ''}</div>
            </div>
            <p style={{ margin: '0 0 12px', whiteSpace: 'pre-wrap' }}>{post.content}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#506880' }}>
              <span>{post.anonymous ? 'Shared safely' : moodTags.happy}</span>
              <span>{(post.comments?.length ?? 0)} comments</span>
            </div>
          </article>
        ))}
      </section>

      <aside>
        <section className="card" style={{ marginBottom: 24 }}>
          <h2 className="section-title">Community support</h2>
          <p className="small-text">Notice posts with gentle language and respond with kindness. If someone seems overwhelmed, share a grounding idea.</p>
        </section>

        <section className="card">
          <h2 className="section-title">Your role</h2>
          <p className="small-text">{profile?.role || 'user'}</p>
          <p style={{ marginTop: 12 }}>Supporters can reply with encouragement and admins can help keep the space safe.</p>
        </section>
      </aside>
    </div>
  )
}
