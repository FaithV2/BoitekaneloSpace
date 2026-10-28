import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { Link } from 'react-router-dom'

const roleOptions = [
  { value: 'user', label: 'Member' },
  { value: 'supporter', label: 'Supporter' },
  { value: 'therapist', label: 'Verified therapist' },
  { value: 'admin', label: 'Admin' }
]

function getDisplayName(user) {
  return user?.display_name || user?.username || user?.email || 'Community member'
}

function getRoleName(role) {
  return roleOptions.find((option) => option.value === role)?.label ?? 'Member'
}

function RoleBadge({ role }) {
  if (!['therapist', 'supporter', 'admin'].includes(role)) return null

  return (
    <span className={`admin-role-badge is-${role}`}>
      {role === 'therapist' ? '✓ Verified therapist' : role === 'supporter' ? '♡ Supporter' : '✿ Admin'}
    </span>
  )
}

export default function AdminPage() {
  const { session } = useAuth()
  const currentUserId = session?.user?.id
  const [activeTab, setActiveTab] = useState('applications')
  const [applications, setApplications] = useState([])
  const [applicationsLoading, setApplicationsLoading] = useState(true)
  const [applicationsError, setApplicationsError] = useState('')
  const [accounts, setAccounts] = useState([])
  const [accountsLoading, setAccountsLoading] = useState(false)
  const [accountsError, setAccountsError] = useState('')
  const [accountSearch, setAccountSearch] = useState('')
  const [updatingAccountId, setUpdatingAccountId] = useState(null)
  const [therapistEmail, setTherapistEmail] = useState('')
  const [therapistName, setTherapistName] = useState('')
  const [invitingTherapist, setInvitingTherapist] = useState(false)
  const [therapistInviteError, setTherapistInviteError] = useState('')
  const [therapistInviteSuccess, setTherapistInviteSuccess] = useState('')
  const [communityPosts, setCommunityPosts] = useState([])
  const [communityComments, setCommunityComments] = useState([])
  const [moderationLoading, setModerationLoading] = useState(false)
  const [moderationError, setModerationError] = useState('')
  const [editingPostId, setEditingPostId] = useState(null)
  const [editingContent, setEditingContent] = useState('')
  const [savingPostId, setSavingPostId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [reviewingApplicationId, setReviewingApplicationId] = useState(null)
  const [notice, setNotice] = useState('')

  const loadApplications = useCallback(async () => {
    setApplicationsLoading(true)
    setApplicationsError('')
    try {
      const { data, error } = await supabase
        .from('supporter_applications')
        .select('id, user_id, story, status, created_at, users!supporter_applications_user_id_fkey(email, display_name, username)')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setApplications(data ?? [])
    } catch (error) {
      console.error('Unable to load supporter applications:', error)
      setApplicationsError('Applications couldn’t be loaded. Please try again.')
    } finally {
      setApplicationsLoading(false)
    }
  }, [])

  const loadAccounts = useCallback(async () => {
    setAccountsLoading(true)
    setAccountsError('')
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, display_name, username, role, created_at')
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      setAccounts(data ?? [])
    } catch (error) {
      console.error('Unable to load accounts:', error)
      setAccountsError('Accounts couldn’t be loaded. Please try again.')
    } finally {
      setAccountsLoading(false)
    }
  }, [])

  const loadCommunity = useCallback(async () => {
    setModerationLoading(true)
    setModerationError('')
    try {
      const [postResult, commentResult] = await Promise.all([
        supabase
          .from('posts')
          .select('id, content, anonymous, created_at, updated_at')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('comments')
          .select('id, post_id, content, anonymous, created_at')
          .order('created_at', { ascending: false })
          .limit(50)
      ])

      if (postResult.error) throw postResult.error
      if (commentResult.error) throw commentResult.error

      const postRows = postResult.data ?? []
      const commentRows = commentResult.data ?? []
      const publicPostIds = postRows.filter((post) => !post.anonymous).map((post) => post.id)
      const publicCommentIds = commentRows.filter((comment) => !comment.anonymous).map((comment) => comment.id)

      const [postAuthorsResult, commentAuthorsResult] = await Promise.all([
        publicPostIds.length
          ? supabase.from('posts').select('id, users(username, display_name, role)').in('id', publicPostIds)
          : Promise.resolve({ data: [], error: null }),
        publicCommentIds.length
          ? supabase.from('comments').select('id, users(username, display_name, role)').in('id', publicCommentIds)
          : Promise.resolve({ data: [], error: null })
      ])

      if (postAuthorsResult.error) throw postAuthorsResult.error
      if (commentAuthorsResult.error) throw commentAuthorsResult.error

      const postAuthors = Object.fromEntries((postAuthorsResult.data ?? []).map((row) => [row.id, row.users]))
      const commentAuthors = Object.fromEntries((commentAuthorsResult.data ?? []).map((row) => [row.id, row.users]))

      setCommunityPosts(postRows.map((post) => ({ ...post, author: postAuthors[post.id] ?? null })))
      setCommunityComments(commentRows.map((comment) => ({ ...comment, author: commentAuthors[comment.id] ?? null })))
    } catch (error) {
      console.error('Unable to load community content for moderation:', error)
      setModerationError('Community content couldn’t be loaded. Please try again.')
    } finally {
      setModerationLoading(false)
    }
  }, [])

  useEffect(() => {
    loadApplications()
  }, [loadApplications])

  useEffect(() => {
    if (activeTab === 'accounts' && accounts.length === 0) loadAccounts()
    if (activeTab === 'moderation' && communityPosts.length === 0 && communityComments.length === 0) loadCommunity()
  }, [activeTab, accounts.length, communityComments.length, communityPosts.length, loadAccounts, loadCommunity])

  const reviewApplication = async (applicationId, decision) => {
    setReviewingApplicationId(applicationId)
    setApplicationsError('')
    setNotice('')
    try {
      const { error } = await supabase.rpc('admin_review_supporter_application', {
        p_application_id: applicationId,
        p_decision: decision
      })
      if (error) throw error

      setNotice(`Application ${decision}. ${decision === 'approved' ? 'The applicant now has the supporter role.' : ''}`)
      await loadApplications()
    } catch (error) {
      console.error('Unable to review supporter application:', error)
      setApplicationsError('The application couldn’t be reviewed. Please try again.')
    } finally {
      setReviewingApplicationId(null)
    }
  }

  const updateAccountRole = async (accountId, role) => {
    setUpdatingAccountId(accountId)
    setAccountsError('')
    setNotice('')
    try {
      const { error } = await supabase.rpc('admin_update_user_role', {
        p_target_user_id: accountId,
        p_new_role: role
      })
      if (error) throw error

      setAccounts((current) => current.map((account) => (
        account.id === accountId ? { ...account, role } : account
      )))
      setNotice(`Role updated to ${getRoleName(role)}.`)
    } catch (error) {
      console.error('Unable to update account role:', error)
      setAccountsError(error.message?.includes('last administrator')
        ? 'The last administrator account cannot be changed to another role.'
        : 'The role couldn’t be updated. Please try again.')
    } finally {
      setUpdatingAccountId(null)
    }
  }

  const inviteTherapist = async (event) => {
    event.preventDefault()
    setInvitingTherapist(true)
    setTherapistInviteError('')
    setTherapistInviteSuccess('')
    try {
      const { data, error } = await supabase.functions.invoke('invite-therapist', {
        body: { email: therapistEmail.trim(), display_name: therapistName.trim() }
      })

      if (error) throw error
      if (!data?.invited) throw new Error('The invitation service returned an unexpected response.')

      setTherapistInviteSuccess(`Invitation sent to ${data.email}. They’ll receive an email to finish setting up their therapist account.`)
      setTherapistEmail('')
      setTherapistName('')
      await loadAccounts()
    } catch (error) {
      console.error('Unable to invite therapist:', error)
      setTherapistInviteError(error.message?.includes('already exists')
        ? error.message
        : 'The therapist account couldn’t be created. Check the email and try again.')
    } finally {
      setInvitingTherapist(false)
    }
  }

  const saveModeratedPost = async (event, postId) => {
    event.preventDefault()
    const content = editingContent.trim()
    if (!content) {
      setModerationError('A post cannot be empty.')
      return
    }

    setSavingPostId(postId)
    setModerationError('')
    try {
      const { error } = await supabase
        .from('posts')
        .update({ content, updated_at: new Date().toISOString() })
        .eq('id', postId)
        .select('id')
        .single()

      if (error) throw error
      setCommunityPosts((current) => current.map((post) => (
        post.id === postId ? { ...post, content, updated_at: new Date().toISOString() } : post
      )))
      setEditingPostId(null)
      setEditingContent('')
      setNotice('Post updated.')
    } catch (error) {
      console.error('Unable to moderate post:', error)
      setModerationError('This post couldn’t be updated. Please try again.')
    } finally {
      setSavingPostId(null)
    }
  }

  const deleteModeratedContent = async (contentType, item) => {
    const label = contentType === 'post' ? 'post and all its comments' : 'comment'
    if (!window.confirm(`Delete this ${label}? This action cannot be undone.`)) return

    const itemKey = `${contentType}-${item.id}`
    setDeletingId(itemKey)
    setModerationError('')
    try {
      const { error } = await supabase
        .from(contentType === 'post' ? 'posts' : 'comments')
        .delete()
        .eq('id', item.id)
        .select('id')
        .single()

      if (error) throw error
      if (contentType === 'post') {
        setCommunityPosts((current) => current.filter((post) => post.id !== item.id))
        setCommunityComments((current) => current.filter((comment) => comment.post_id !== item.id))
      } else {
        setCommunityComments((current) => current.filter((comment) => comment.id !== item.id))
      }
      setNotice(`${contentType === 'post' ? 'Post' : 'Comment'} removed.`)
    } catch (error) {
      console.error(`Unable to remove community ${contentType}:`, error)
      setModerationError(`This ${contentType} couldn’t be deleted. Please try again.`)
    } finally {
      setDeletingId(null)
    }
  }

  const normalizedSearch = accountSearch.trim().toLowerCase()
  const filteredAccounts = accounts.filter((account) => (
    `${account.display_name ?? ''} ${account.username ?? ''} ${account.email ?? ''}`.toLowerCase().includes(normalizedSearch)
  ))
  const pendingApplications = applications.filter((application) => application.status === 'pending').length

  return (
    <div className="admin-page">
      <header className="admin-heading">
        <span className="admin-heading-icon" aria-hidden="true">✿</span>
        <div>
          <span className="admin-eyebrow">COMMUNITY CARE</span>
          <h1>Admin panel</h1>
          <p>Review applications, manage roles, and care for community conversations.</p>
        </div>
      </header>

      <nav className="admin-tabs" aria-label="Admin sections">
        <button type="button" className={activeTab === 'applications' ? 'is-active' : ''} aria-pressed={activeTab === 'applications'} onClick={() => setActiveTab('applications')}>
          Applications <span>{pendingApplications}</span>
        </button>
        <button type="button" className={activeTab === 'accounts' ? 'is-active' : ''} aria-pressed={activeTab === 'accounts'} onClick={() => setActiveTab('accounts')}>
          Accounts
        </button>
        <button type="button" className={activeTab === 'moderation' ? 'is-active' : ''} aria-pressed={activeTab === 'moderation'} onClick={() => setActiveTab('moderation')}>
          Moderation
        </button>
      </nav>

      {activeTab === 'applications' && (
        <section className="admin-applications-panel" aria-labelledby="admin-applications-title">
          <div className="admin-panel-heading">
            <div><span className="admin-eyebrow">REVIEW QUEUE</span><h2 id="admin-applications-title">Supporter applications</h2></div>
            <span className="admin-queue-count">{pendingApplications} pending</span>
          </div>
          {applicationsError && <p className="admin-panel-error" role="alert">{applicationsError}</p>}
          {applicationsLoading ? (
            <div className="admin-empty-state" role="status"><span className="app-loading-spinner" /><p>Loading applications…</p></div>
          ) : applications.length === 0 ? (
            <div className="admin-empty-state">
              <span aria-hidden="true">🌱</span>
              <strong>All caught up</strong>
              <p>No supporter applications have been submitted yet.</p>
            </div>
          ) : (
            <div className="admin-application-list">
              {applications.map((application) => (
                <article key={application.id} className="admin-application-card">
                  <div className="admin-application-topline">
                    <div className="admin-applicant">
                      <span className="admin-applicant-avatar" aria-hidden="true">{getDisplayName(application.users).charAt(0).toUpperCase()}</span>
                      <div>
                        <strong>{getDisplayName(application.users)}</strong>
                        <span>{application.users?.email ?? 'Email unavailable'} · {new Date(application.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="admin-application-review">
                      <span className={`admin-application-status is-${application.status}`}>{application.status}</span>
                      {application.status === 'pending' && (
                        <div className="admin-application-actions">
                          <button type="button" className="admin-approve-button" disabled={reviewingApplicationId !== null} onClick={() => reviewApplication(application.id, 'approved')}>
                            {reviewingApplicationId === application.id ? 'Reviewing…' : 'Approve'}
                          </button>
                          <button type="button" className="admin-reject-button" disabled={reviewingApplicationId !== null} onClick={() => reviewApplication(application.id, 'rejected')}>
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="admin-application-story">{application.story}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'accounts' && (
        <section className="admin-applications-panel" aria-labelledby="admin-accounts-title">
          <div className="admin-panel-heading">
            <div><span className="admin-eyebrow">ACCESS & TRUST</span><h2 id="admin-accounts-title">Account roles</h2></div>
            <span className="admin-queue-count">{accounts.length} accounts</span>
          </div>
          <p className="admin-role-guidance">Therapist roles are reserved for professionals the Boitekanelo Space team has personally approached and onboarded. Assign “Verified therapist” only after that process.</p>
          <section className="admin-therapist-invite">
            <div className="admin-therapist-invite-heading">
              <span className="admin-therapist-invite-icon" aria-hidden="true">✧</span>
              <div><h3>Create therapist account</h3><p>Send an invitation after your team has approached and verified the professional.</p></div>
            </div>
            <form className="admin-therapist-invite-form" onSubmit={inviteTherapist}>
              <div className="admin-therapist-fields">
                <label>
                  Therapist name
                  <input value={therapistName} onChange={(event) => setTherapistName(event.target.value)} maxLength={100} autoComplete="name" placeholder="Name as it should appear" />
                </label>
                <label>
                  Email address
                  <input type="email" value={therapistEmail} onChange={(event) => setTherapistEmail(event.target.value)} required maxLength={254} autoComplete="email" placeholder="therapist@example.com" />
                </label>
              </div>
              <button type="submit" className="admin-invite-button" disabled={invitingTherapist || !therapistEmail.trim()}>
                {invitingTherapist ? 'Sending invitation…' : 'Create and invite therapist'} {!invitingTherapist && <span aria-hidden="true">→</span>}
              </button>
            </form>
            {therapistInviteError && <p className="admin-panel-error" role="alert">{therapistInviteError}</p>}
            {therapistInviteSuccess && <p className="admin-invite-success" role="status">{therapistInviteSuccess}</p>}
          </section>
          <label className="admin-account-search">
            <span aria-hidden="true">⌕</span>
            <input type="search" value={accountSearch} onChange={(event) => setAccountSearch(event.target.value)} placeholder="Search name or email" aria-label="Search accounts" />
          </label>
          {accountsError && <p className="admin-panel-error" role="alert">{accountsError}</p>}
          {accountsLoading ? (
            <div className="admin-empty-state" role="status"><span className="app-loading-spinner" /><p>Loading accounts…</p></div>
          ) : (
            <div className="admin-account-list">
              {filteredAccounts.map((account) => (
                <article className="admin-account-row" key={account.id}>
                  <span className="admin-applicant-avatar" aria-hidden="true">{getDisplayName(account).charAt(0).toUpperCase()}</span>
                  <div className="admin-account-identity">
                    <strong>{getDisplayName(account)}</strong>
                    <span>{account.email ?? 'Email unavailable'}</span>
                  </div>
                  <RoleBadge role={account.role} />
                  <label className="admin-role-select-label">
                    <span className="admin-visually-hidden">Role for {getDisplayName(account)}</span>
                    <select
                      value={account.role}
                      disabled={updatingAccountId !== null || account.id === currentUserId}
                      title={account.id === currentUserId ? 'Administrators cannot change their own role.' : undefined}
                      onChange={(event) => updateAccountRole(account.id, event.target.value)}
                    >
                      {roleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                </article>
              ))}
              {filteredAccounts.length === 0 && <div className="admin-empty-state"><p>No matching accounts found.</p></div>}
            </div>
          )}
        </section>
      )}

      {activeTab === 'moderation' && (
        <section className="admin-applications-panel" aria-labelledby="admin-moderation-title">
          <div className="admin-panel-heading">
            <div><span className="admin-eyebrow">COMMUNITY SAFETY</span><h2 id="admin-moderation-title">Content moderation</h2></div>
            <span className="admin-queue-count">{communityPosts.length} posts · {communityComments.length} comments</span>
          </div>
          <p className="admin-role-guidance">Admins can edit or remove any post and remove comments. Anonymous authors remain anonymous here too.</p>
          {moderationError && <p className="admin-panel-error" role="alert">{moderationError}</p>}
          {moderationLoading ? (
            <div className="admin-empty-state" role="status"><span className="app-loading-spinner" /><p>Loading community content…</p></div>
          ) : (
            <div className="admin-moderation-content">
              <h3>Recent posts</h3>
              {communityPosts.length === 0 ? (
                <div className="admin-empty-state"><p>No posts to review.</p></div>
              ) : (
                <div className="admin-application-list">
                  {communityPosts.map((post) => (
                    <article className="admin-moderation-card" key={post.id}>
                      <div className="admin-moderation-meta">
                        <strong>{post.anonymous ? 'Anonymous' : getDisplayName(post.author)}</strong>
                        {post.author && <RoleBadge role={post.author.role} />}
                        <time dateTime={post.created_at}>{new Date(post.created_at).toLocaleString()}</time>
                      </div>
                      {editingPostId === post.id ? (
                        <form className="admin-moderation-edit" onSubmit={(event) => saveModeratedPost(event, post.id)}>
                          <textarea aria-label="Edit post content" value={editingContent} onChange={(event) => setEditingContent(event.target.value)} maxLength={2000} rows={5} />
                          <div>
                            <button type="button" className="feed-edit-cancel" onClick={() => { setEditingPostId(null); setEditingContent('') }} disabled={savingPostId !== null}>Cancel</button>
                            <button type="submit" className="feed-edit-save" disabled={savingPostId !== null || !editingContent.trim()}>{savingPostId === post.id ? 'Saving…' : 'Save changes'}</button>
                          </div>
                        </form>
                      ) : (
                        <p className="admin-moderation-text">{post.content}</p>
                      )}
                      {editingPostId !== post.id && (
                        <div className="admin-moderation-actions">
                          <button type="button" className="feed-owner-action" onClick={() => { setEditingPostId(post.id); setEditingContent(post.content) }}>Edit post</button>
                          <button type="button" className="feed-owner-action is-delete" disabled={deletingId !== null} onClick={() => deleteModeratedContent('post', post)}>
                            {deletingId === `post-${post.id}` ? 'Deleting…' : 'Remove post'}
                          </button>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}

              <h3 className="admin-comment-moderation-title">Recent comments</h3>
              {communityComments.length === 0 ? (
                <div className="admin-empty-state"><p>No comments to review.</p></div>
              ) : (
                <div className="admin-application-list">
                  {communityComments.map((comment) => (
                    <article className="admin-moderation-card" key={comment.id}>
                      <div className="admin-moderation-meta">
                        <strong>{comment.anonymous ? 'Anonymous' : getDisplayName(comment.author)}</strong>
                        {comment.author && <RoleBadge role={comment.author.role} />}
                        <time dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleString()}</time>
                      </div>
                      <p className="admin-moderation-text">{comment.content}</p>
                      <div className="admin-moderation-actions">
                        <Link className="feed-owner-action" to={`/post/${comment.post_id}`}>View discussion</Link>
                        <button type="button" className="feed-owner-action is-delete" disabled={deletingId !== null} onClick={() => deleteModeratedContent('comment', comment)}>
                          {deletingId === `comment-${comment.id}` ? 'Deleting…' : 'Remove comment'}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {notice && <p className="admin-status" role="status">{notice}</p>}
    </div>
  )
}
