import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import Icon from '../components/Icon'

function formatRelativeTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'

  let duration = Math.round((date.getTime() - Date.now()) / 1000)
  let unit = 'second'
  if (Math.abs(duration) >= 60) {
    duration = Math.round(duration / 60)
    unit = 'minute'
  }
  if (Math.abs(duration) >= 60) {
    duration = Math.round(duration / 60)
    unit = 'hour'
  }
  if (Math.abs(duration) >= 24) {
    duration = Math.round(duration / 24)
    unit = 'day'
  }
  if (Math.abs(duration) >= 7) {
    duration = Math.round(duration / 7)
    unit = 'week'
  }

  return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(Math.round(duration), unit)
}

function getAuthorName(profile) {
  return profile?.display_name || profile?.username || 'Community member'
}

export default function FeedPage() {
  const { profile, session } = useAuth()
  const userId = session?.user?.id
  const [posts, setPosts] = useState([])
  const [content, setContent] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const [posting, setPosting] = useState(false)
  const [postError, setPostError] = useState('')
  const [feedStatus, setFeedStatus] = useState('loading')
  const [feedError, setFeedError] = useState('')
  const [reactingTo, setReactingTo] = useState(null)
  const [reactionError, setReactionError] = useState({ postId: null, message: '' })
  const [ownReactions, setOwnReactions] = useState([])
  const [filter, setFilter] = useState('all')
  const [editingPostId, setEditingPostId] = useState(null)
  const [editingContent, setEditingContent] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingPostId, setDeletingPostId] = useState(null)
  const [postActionError, setPostActionError] = useState({ postId: null, message: '' })

  const loadPosts = useCallback(async (showLoading = true) => {
    if (showLoading) setFeedStatus('loading')
    setFeedError('')

    if (filter === 'mine' && !userId) {
      setPosts([])
      setOwnReactions([])
      setFeedStatus('ready')
      return
    }

    try {
      let postQuery = supabase
        .from('posts')
        .select('id, content, anonymous, supporter_response, created_at, comments(id), reactions(id, type)')
        .order('created_at', { ascending: false })
      if (filter === 'mine' && userId) postQuery = postQuery.eq('user_id', userId)

      const { data: postData, error: postError } = await postQuery.limit(filter === 'mine' ? 100 : 20)

      if (postError) throw postError

      const postRows = postData ?? []
      const publicPostIds = postRows.filter((post) => !post.anonymous).map((post) => post.id)
      const authorByPostId = {}
      const ownedPostIds = new Set()

      if (publicPostIds.length > 0) {
        const { data: authors, error: authorError } = await supabase
          .from('posts')
          .select('id, user_id, users(username, display_name, role)')
          .in('id', publicPostIds)

        if (authorError) throw authorError

        for (const author of authors ?? []) {
          authorByPostId[author.id] = author.users
        }
      }

      if (filter === 'mine') {
        for (const ownPost of postRows) ownedPostIds.add(ownPost.id)
      } else if (userId && postRows.length > 0) {
        const { data: ownedPosts, error: ownedPostsError } = await supabase
          .from('posts')
          .select('id')
          .eq('user_id', userId)
          .in('id', postRows.map((post) => post.id))

        if (ownedPostsError) throw ownedPostsError
        for (const ownedPost of ownedPosts ?? []) ownedPostIds.add(ownedPost.id)
      }

      let reactions = []
      if (userId && postRows.length > 0) {
        const { data: reactionData, error: reactionLoadError } = await supabase
          .from('reactions')
          .select('post_id, type')
          .eq('user_id', userId)
          .in('post_id', postRows.map((post) => post.id))

        if (reactionLoadError) throw reactionLoadError
        reactions = reactionData ?? []
      }

      setOwnReactions(reactions)
      setPosts(postRows.map((post) => ({
        ...post,
        author: authorByPostId[post.id] ?? null,
        isOwnPost: ownedPostIds.has(post.id)
      })))
      setFeedStatus('ready')
    } catch (error) {
      console.error('Unable to load the community feed:', error)
      setFeedError('We couldn’t load the community feed. Please try again.')
      setFeedStatus('error')
    }
  }, [filter, userId])

  useEffect(() => {
    loadPosts()

    const channel = supabase
      .channel('community-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => loadPosts(false))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => loadPosts(false))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reactions' }, () => loadPosts(false))
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadPosts])

  const handleSubmit = async (event) => {
    event.preventDefault()
    const trimmedContent = content.trim()
    setPostError('')

    if (!userId) {
      setPostError('Please sign in again before sharing a post.')
      return
    }
    if (!trimmedContent) {
      setPostError('Add a few words before sharing your post.')
      return
    }

    setPosting(true)

    try {
      const { error } = await supabase.from('posts').insert([
        {
          user_id: userId,
          content: trimmedContent,
          anonymous
        }
      ])

      if (error) throw error

      setContent('')
      setAnonymous(false)
      await loadPosts()
    } catch (error) {
      console.error('Unable to share community post:', error)
      setPostError('We couldn’t share your post just now. Please try again.')
    } finally {
      setPosting(false)
    }
  }

  const sendSupport = async (postId) => {
    if (!userId || reactingTo) return

    setReactingTo(postId)
    setReactionError({ postId: null, message: '' })
    try {
      const { error } = await supabase.from('reactions').insert([
        { user_id: userId, post_id: postId, type: 'like' }
      ])

      if (error) throw error

      setOwnReactions((current) => [...current, { post_id: postId, type: 'like' }])
      setPosts((current) => current.map((post) => (
        post.id === postId
          ? { ...post, reactions: [...(post.reactions ?? []), { id: `local-${postId}`, type: 'like' }] }
          : post
      )))
    } catch (error) {
      console.error('Unable to send support reaction:', error)
      setReactionError({ postId, message: 'Your reaction couldn’t be sent. Please try again.' })
    } finally {
      setReactingTo(null)
    }
  }

  const startEditing = (post) => {
    setEditingPostId(post.id)
    setEditingContent(post.content)
    setPostActionError({ postId: null, message: '' })
  }

  const cancelEditing = () => {
    setEditingPostId(null)
    setEditingContent('')
    setPostActionError({ postId: null, message: '' })
  }

  const saveEditedPost = async (event, postId) => {
    event.preventDefault()
    const updatedContent = editingContent.trim()

    if (!updatedContent) {
      setPostActionError({ postId, message: 'A post can’t be empty.' })
      return
    }

    setSavingEdit(true)
    setPostActionError({ postId: null, message: '' })
    try {
      let updateQuery = supabase
        .from('posts')
        .update({ content: updatedContent, updated_at: new Date().toISOString() })
        .eq('id', postId)
      if (profile?.role !== 'admin') updateQuery = updateQuery.eq('user_id', userId)

      const { error } = await updateQuery.select('id').single()

      if (error) throw error

      setPosts((current) => current.map((post) => (
        post.id === postId ? { ...post, content: updatedContent } : post
      )))
      cancelEditing()
    } catch (error) {
      console.error('Unable to edit community post:', error)
      setPostActionError({ postId, message: 'This post couldn’t be updated. Please try again.' })
    } finally {
      setSavingEdit(false)
    }
  }

  const deletePost = async (post) => {
    const confirmed = window.confirm('Delete this post? This will also remove its comments and reactions.')
    if (!confirmed) return

    setDeletingPostId(post.id)
    setPostActionError({ postId: null, message: '' })
    try {
      let deleteQuery = supabase
        .from('posts')
        .delete()
        .eq('id', post.id)
      if (profile?.role !== 'admin') deleteQuery = deleteQuery.eq('user_id', userId)

      const { error } = await deleteQuery.select('id').single()

      if (error) throw error

      setPosts((current) => current.filter((entry) => entry.id !== post.id))
      setOwnReactions((current) => current.filter((reaction) => reaction.post_id !== post.id))
      if (editingPostId === post.id) cancelEditing()
    } catch (error) {
      console.error('Unable to delete community post:', error)
      setPostActionError({ postId: post.id, message: 'This post couldn’t be deleted. Please try again.' })
    } finally {
      setDeletingPostId(null)
    }
  }

  const visiblePosts = filter === 'mine'
    ? posts.filter((post) => post.isOwnPost)
    : posts
  const ownPostCount = posts.filter((post) => post.isOwnPost).length

  const roleName = profile?.role === 'admin'
    ? 'Community admin'
    : profile?.role === 'supporter'
      ? 'Community supporter'
      : 'Community member'

  return (
    <div className="feed-page">
      <header className="feed-heading">
        <div>
          <span className="feed-eyebrow">COMMUNITY · OPEN CONVERSATION</span>
          <h1>Community feed</h1>
          <p>Posts and conversations from the community.</p>
        </div>
        <span className="feed-heading-mark" aria-hidden="true"><Icon name="feed" size={28} strokeWidth={1.5} /></span>
      </header>

      <div className="feed-layout">
        <main className="feed-main">
          <section className="feed-composer" aria-labelledby="composer-title">
            <div className="feed-section-heading">
              <div>
                <span className="feed-composer-kicker">YOUR VOICE MATTERS</span>
                <h2 id="composer-title">Write a post</h2>
                <p>Share with the community.</p>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <label className="feed-visually-hidden" htmlFor="feed-content">Write a post</label>
              <textarea
                id="feed-content"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="Write something gentle, honest, or supportive…"
                rows={4}
                maxLength={2000}
                required
              />
              <div className="feed-composer-footer">
                <label className="feed-anonymous-toggle">
                  <input
                    type="checkbox"
                    checked={anonymous}
                    onChange={(event) => setAnonymous(event.target.checked)}
                  />
                  <span className="feed-toggle-track" aria-hidden="true"><span /></span>
                  <span className="feed-toggle-copy">
                    <strong>Share anonymously</strong>
                    <small>Your name won’t appear with this post</small>
                  </span>
                </label>
                <div className="feed-share-area">
                  <span className="feed-character-count">{content.length}/2000</span>
                  <button className="feed-share-button" type="submit" disabled={posting || !content.trim()}>
                    {posting ? (
                      <>
                        <span className="feed-spinner" aria-hidden="true" />
                        Sharing…
                      </>
                    ) : (
                      <>Share post <span aria-hidden="true">↗</span></>
                    )}
                  </button>
                </div>
              </div>
              {postError && <p className="feed-alert" role="alert">{postError}</p>}
            </form>
          </section>

          <section className="feed-posts" aria-labelledby="feed-posts-title">
            <div className="feed-posts-heading">
              <div>
                <h2 id="feed-posts-title">Recent posts</h2>
              </div>
              {feedStatus === 'ready' && (
                <span className="feed-post-count">{visiblePosts.length} {visiblePosts.length === 1 ? 'post' : 'posts'}</span>
              )}
            </div>

            <div className="feed-filter-bar" role="group" aria-label="Filter feed posts">
              <button
                type="button"
                className={`feed-filter-button${filter === 'all' ? ' is-active' : ''}`}
                aria-pressed={filter === 'all'}
                onClick={() => setFilter('all')}
              >
                All posts
                {feedStatus === 'ready' && <span>{posts.length}</span>}
              </button>
              <button
                type="button"
                className={`feed-filter-button${filter === 'mine' ? ' is-active' : ''}`}
                aria-pressed={filter === 'mine'}
                onClick={() => setFilter('mine')}
              >
                My posts
                {feedStatus === 'ready' && <span>{ownPostCount}</span>}
              </button>
            </div>

            {feedStatus === 'loading' ? (
              <div className="feed-state-card" role="status">
                <span className="feed-spinner" aria-hidden="true" />
                <span>Making space for the conversation…</span>
              </div>
            ) : feedStatus === 'error' ? (
              <div className="feed-state-card feed-state-error" role="alert">
                <p>{feedError}</p>
                <button className="feed-retry-button" type="button" onClick={loadPosts}>Try again</button>
              </div>
            ) : visiblePosts.length === 0 ? (
              <div className="feed-state-card feed-state-empty">
                <h3>{filter === 'mine' ? 'You haven’t shared a post yet' : 'No posts yet'}</h3>
                <p>{filter === 'mine' ? 'Posts you share with the community will appear here.' : 'Be the first to share something with the community.'}</p>
              </div>
            ) : (
              <div className="feed-post-list">
                {visiblePosts.map((post) => {
                  const supportCount = (post.reactions ?? []).filter((reaction) => reaction.type === 'like').length
                  const hasSupported = ownReactions.some((reaction) => reaction.post_id === post.id && reaction.type === 'like')
                  const author = post.anonymous ? 'Anonymous' : getAuthorName(post.author)
                  const isOwnPost = post.isOwnPost
                  const canManagePost = isOwnPost || profile?.role === 'admin'
                  const isEditing = editingPostId === post.id

                  return (
                    <article className="feed-post-card" key={post.id}>
                      <div className="feed-post-topline">
                        <span className={`feed-author-avatar${post.anonymous ? ' is-anonymous' : ''}`} aria-hidden="true">
                          {post.anonymous ? '· · ·' : author.charAt(0).toUpperCase()}
                        </span>
                        <div className="feed-author-details">
                          <strong>{author}</strong>
                          {!post.anonymous && ['therapist', 'supporter'].includes(post.author?.role) && (
                            <span className={`feed-community-role is-${post.author.role}`}>
                              {post.author.role === 'therapist' ? '✓ Verified therapist' : '♡ Supporter'}
                            </span>
                          )}
                          <time dateTime={post.created_at} title={new Date(post.created_at).toLocaleString()}>
                            {formatRelativeTime(post.created_at)}
                          </time>
                        </div>
                        {post.supporter_response && <span className={`feed-supporter-badge${isOwnPost ? ' has-owner-actions' : ''}`}>♡ Supporter</span>}
                        {canManagePost && !isEditing && (
                          <div className="feed-owner-actions">
                            <button type="button" className="feed-owner-action" onClick={() => startEditing(post)}>Edit</button>
                            <button
                              type="button"
                              className="feed-owner-action is-delete"
                              disabled={deletingPostId !== null || savingEdit}
                              onClick={() => deletePost(post)}
                            >
                              {deletingPostId === post.id ? 'Deleting…' : 'Delete'}
                            </button>
                          </div>
                        )}
                      </div>

                      {isEditing ? (
                        <form className="feed-edit-form" onSubmit={(event) => saveEditedPost(event, post.id)}>
                          <label className="feed-visually-hidden" htmlFor={`edit-post-${post.id}`}>Edit your post</label>
                          <textarea
                            id={`edit-post-${post.id}`}
                            value={editingContent}
                            onChange={(event) => setEditingContent(event.target.value)}
                            maxLength={2000}
                            rows={5}
                            autoFocus
                          />
                          <div className="feed-edit-footer">
                            <span>{editingContent.length}/2000</span>
                            <div>
                              <button type="button" className="feed-edit-cancel" onClick={cancelEditing} disabled={savingEdit}>Cancel</button>
                              <button type="submit" className="feed-edit-save" disabled={savingEdit || !editingContent.trim()}>
                                {savingEdit ? 'Saving…' : 'Save changes'}
                              </button>
                            </div>
                          </div>
                        </form>
                      ) : (
                        <p className="feed-post-content">{post.content}</p>
                      )}

                      {!isEditing && <div className="feed-post-actions">
                        <button
                          className={`feed-action-button feed-reaction-button${hasSupported ? ' is-selected' : ''}`}
                          type="button"
                          aria-pressed={hasSupported}
                          aria-label={hasSupported ? `You and ${Math.max(0, supportCount - 1)} others sent support` : `Send support, ${supportCount} reactions`}
                          disabled={hasSupported || reactingTo === post.id}
                          onClick={() => sendSupport(post.id)}
                        >
                          <Icon name="heart" size={16} />
                          <span>{reactingTo === post.id ? 'Sending…' : hasSupported ? 'Support sent' : 'Send support'}</span>
                          {supportCount > 0 && <span className="feed-action-count">{supportCount}</span>}
                        </button>
                        <Link className="feed-action-button feed-comment-button" to={`/post/${post.id}`}>
                          <Icon name="message" size={16} />
                          <span>Comment</span>
                          <span className="feed-action-count">{post.comments?.length ?? 0}</span>
                        </Link>
                      </div>}
                      {postActionError.postId === post.id && <p className="feed-reaction-error" role="alert">{postActionError.message}</p>}
                      {reactionError.postId === post.id && <p className="feed-reaction-error" role="alert">{reactionError.message}</p>}
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </main>

        <aside className="feed-sidebar" aria-label="Community information">
          <section className="feed-sidebar-card feed-support-card">
            <h2>Community support</h2>
            <p>Respond respectfully and keep comments constructive.</p>
            <div className="feed-kindness-note">
              <span>Be considerate of other people’s experiences.</span>
            </div>
          </section>

          <section className="feed-sidebar-card feed-role-card">
            <h2>Your role</h2>
            <div className="feed-role-badge">{roleName}</div>
            <p>Your role determines the tools available to your account.</p>
          </section>

          <p className="feed-privacy-note">You can choose anonymous sharing when creating a post.</p>
        </aside>
      </div>
    </div>
  )
}
