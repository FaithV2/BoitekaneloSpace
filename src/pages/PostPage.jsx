import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'

export default function PostPage() {
  const { id } = useParams()
  const { profile } = useAuth()
  const [post, setPost] = useState(null)
  const [comments, setComments] = useState([])
  const [content, setContent] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const [loading, setLoading] = useState(false)

  const loadPost = async () => {
    const { data } = await supabase
      .from('posts')
      .select('*, users(username, display_name)')
      .eq('id', id)
      .single()
    setPost(data)
  }

  const loadComments = async () => {
    const { data } = await supabase
      .from('comments')
      .select('*, users(username, display_name)')
      .eq('post_id', id)
      .order('created_at', { ascending: true })

    setComments(data ?? [])
  }

  useEffect(() => {
    loadPost()
    loadComments()
  }, [id])

  const submitComment = async (event) => {
    event.preventDefault()
    setLoading(true)
    await supabase.from('comments').insert([
      {
        post_id: id,
        user_id: profile?.id,
        content,
        anonymous,
        created_at: new Date().toISOString()
      }
    ])
    setContent('')
    setAnonymous(false)
    await loadComments()
    setLoading(false)
  }

  const renderThread = (parentId = null, depth = 0) => {
    return comments
      .filter((comment) => comment.parent_comment_id === parentId)
      .map((comment) => (
        <div key={comment.id} style={{ marginLeft: depth * 18, marginTop: 18, paddingLeft: 14, borderLeft: '2px solid rgba(16,42,67,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <strong>{comment.anonymous ? 'Anonymous' : comment.users?.display_name ?? comment.users?.username ?? 'Community member'}</strong>
              <div className="small-text">{new Date(comment.created_at).toLocaleString()}</div>
            </div>
          </div>
          <p style={{ margin: '12px 0 0' }}>{comment.content}</p>
          {renderThread(comment.id, depth + 1)}
        </div>
      ))
  }

  return (
    <div className="grid-two">
      <section className="card">
        <Link to="/feed" className="nav-link" style={{ display: 'inline-block', marginBottom: 20 }}>
          ← Back to feed
        </Link>

        {post ? (
          <>
            <h1 className="section-title">{post.anonymous ? 'Anonymous post' : post.users?.display_name ?? 'Community member'}</h1>
            <p className="small-text">{new Date(post.created_at).toLocaleString()}</p>
            <div className="card" style={{ marginTop: 20 }}>
              <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{post.content}</p>
            </div>
          </>
        ) : (
          <p className="small-text">Loading post…</p>
        )}

        <section className="card" style={{ marginTop: 24 }}>
          <h2 className="section-title">Leave a comment</h2>
          <form onSubmit={submitComment}>
            <div className="form-field">
              <label htmlFor="comment">Comment</label>
              <textarea id="comment" value={content} onChange={(e) => setContent(e.target.value)} rows={4} required />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
                Comment anonymously
              </label>
            </div>
            <button type="submit" className="primary" disabled={loading}>
              {loading ? 'Posting comment…' : 'Post comment'}
            </button>
          </form>
        </section>
      </section>

      <aside>
        <section className="card">
          <h2 className="section-title">Discussion</h2>
          {comments.length === 0 ? (
            <p className="small-text">No comments yet — be the first to offer support.</p>
          ) : (
            <div>{renderThread()}</div>
          )}
        </section>
      </aside>
    </div>
  )
}
