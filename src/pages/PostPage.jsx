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
    const { data, error } = await supabase
      .from('posts')
      .select('id, content, anonymous, supporter_response, created_at')
      .eq('id', id)
      .single()

    if (error) {
      setPost(null)
      return
    }

    if (data.anonymous) {
      setPost(data)
      return
    }

    const { data: author, error: authorError } = await supabase
      .from('posts')
      .select('users(username, display_name, role)')
      .eq('id', id)
      .single()

    setPost({ ...data, users: authorError ? null : author?.users })
  }

  const loadComments = async () => {
    const { data, error } = await supabase
      .from('comments')
      .select('id, post_id, parent_comment_id, content, anonymous, created_at')
      .eq('post_id', id)
      .order('created_at', { ascending: true })

    if (error) {
      setComments([])
      return
    }

    const commentRows = data ?? []
    const publicCommentIds = commentRows.filter((comment) => !comment.anonymous).map((comment) => comment.id)
    let authorByCommentId = {}

    if (publicCommentIds.length > 0) {
      const { data: authors, error: authorError } = await supabase
        .from('comments')
        .select('id, users(username, display_name, role)')
        .in('id', publicCommentIds)

      if (!authorError) {
        authorByCommentId = Object.fromEntries((authors ?? []).map((author) => [author.id, author.users]))
      }
    }

    setComments(commentRows.map((comment) => ({
      ...comment,
      users: authorByCommentId[comment.id] ?? null
    })))
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
        <div key={comment.id} className="post-comment" style={{ marginLeft: depth * 14 }}>
          <div className="post-comment-header">
            <div>
              <strong>{comment.anonymous ? 'Anonymous' : comment.users?.display_name ?? comment.users?.username ?? 'Community member'}</strong>
              {!comment.anonymous && ['therapist', 'supporter'].includes(comment.users?.role) && (
                <span className={`post-community-role is-${comment.users.role}`}>
                  {comment.users.role === 'therapist' ? '✓ Verified therapist' : '♡ Supporter'}
                </span>
              )}
              <time dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleString()}</time>
            </div>
          </div>
          <p className="post-comment-text">{comment.content}</p>
          {renderThread(comment.id, depth + 1)}
        </div>
      ))
  }

  return (
    <div className="post-page">
      <main className="post-main">
        <Link to="/feed" className="post-back-link">
          ← Back to feed
        </Link>

        {post ? (
          <article className="post-detail-card">
            <div className="post-detail-author">
              <span className={`post-author-avatar${post.anonymous ? ' is-anonymous' : ''}`} aria-hidden="true">
                {post.anonymous ? '· · ·' : (post.users?.display_name ?? post.users?.username ?? 'C').charAt(0).toUpperCase()}
              </span>
              <div>
                <h1>{post.anonymous ? 'Anonymous' : post.users?.display_name ?? post.users?.username ?? 'Community member'}</h1>
                  {!post.anonymous && ['therapist', 'supporter'].includes(post.users?.role) && (
                    <span className={`post-community-role is-${post.users.role}`}>
                      {post.users.role === 'therapist' ? '✓ Verified therapist' : '♡ Supporter'}
                    </span>
                  )}
                  <time dateTime={post.created_at}>{new Date(post.created_at).toLocaleString()}</time>
              </div>
            </div>
            <p className="post-detail-content">{post.content}</p>
            {post.supporter_response && <span className="post-supporter-badge">♡ Supporter</span>}
          </article>
        ) : (
          <div className="post-loading-card" role="status"><span className="app-loading-spinner" />Loading conversation…</div>
        )}

        <section className="post-comment-composer">
          <div className="post-section-heading"><span className="post-section-icon" aria-hidden="true">✎</span><div><h2>Join the conversation</h2><p>A kind word can make a difference.</p></div></div>
          <form onSubmit={submitComment}>
            <div className="form-field">
              <label htmlFor="comment">Your comment</label>
              <textarea id="comment" value={content} onChange={(e) => setContent(e.target.value)} rows={4} required placeholder="Leave a thoughtful, supportive comment…" />
            </div>
            <div className="post-comment-controls">
              <label className="post-anonymous-option">
                <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
                <span>Comment anonymously</span>
              </label>
              <button type="submit" className="post-comment-button" disabled={loading || !content.trim()}>
              {loading ? 'Posting comment…' : 'Post comment'}
              </button>
            </div>
          </form>
        </section>

      </main>

      <aside className="post-discussion-aside">
        <section className="post-discussion-card">
          <div className="post-discussion-heading">
            <div><span className="post-eyebrow">COMMUNITY VOICES</span><h2>Discussion</h2></div>
            <span className="post-comment-count">{comments.length}</span>
          </div>
          {comments.length === 0 ? (
            <div className="post-empty-comments"><span aria-hidden="true">🌱</span><p>No comments yet. Be the first to offer support.</p></div>
          ) : (
            <div className="post-comment-list">{renderThread()}</div>
          )}
        </section>
      </aside>
    </div>
  )
}
