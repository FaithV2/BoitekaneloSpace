import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const notificationCopy = {
  post_comment: {
    icon: '☏',
    text: 'Someone commented on your post'
  },
  comment_reply: {
    icon: '↩',
    text: 'Someone replied to your comment'
  },
  post_reaction: {
    icon: '♡',
    text: 'Someone sent support to your post'
  }
}

function formatNotificationTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const seconds = Math.round((date.getTime() - Date.now()) / 1000)
  const divisions = [
    { limit: 60, amount: 1, unit: 'second' },
    { limit: 60, amount: 60, unit: 'minute' },
    { limit: 24, amount: 3600, unit: 'hour' },
    { limit: 7, amount: 86400, unit: 'day' },
    { limit: Infinity, amount: 604800, unit: 'week' }
  ]
  const division = divisions.find((item) => Math.abs(seconds) / item.amount < item.limit) ?? divisions[divisions.length - 1]

  return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(
    Math.round(seconds / division.amount),
    division.unit
  )
}

export default function NotificationCenter({ userId }) {
  const navigate = useNavigate()
  const rootRef = useRef(null)
  const [notifications, setNotifications] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updating, setUpdating] = useState(false)

  const loadNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    try {
      const { data, error: loadError } = await supabase
        .from('notifications')
        .select('id, type, post_id, created_at, read_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30)

      if (loadError) throw loadError
      setNotifications(data ?? [])
    } catch (loadError) {
      console.error('Unable to load notifications:', loadError)
      setError('Notifications couldn’t be loaded. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    loadNotifications()

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          setNotifications((current) => (
            current.some((notification) => notification.id === payload.new.id)
              ? current
              : [payload.new, ...current].slice(0, 30)
          ))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadNotifications, userId])

  useEffect(() => {
    if (!open) return undefined

    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const markRead = async (notification) => {
    if (notification.read_at) return true

    setUpdating(true)
    setError('')
    try {
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notification.id)
        .eq('user_id', userId)
        .is('read_at', null)

      if (updateError) throw updateError
      setNotifications((current) => current.map((item) => (
        item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item
      )))
      return true
    } catch (updateError) {
      console.error('Unable to update notification:', updateError)
      setError('This notification couldn’t be marked as read.')
      return false
    } finally {
      setUpdating(false)
    }
  }

  const openNotification = async (event, notification) => {
    event.preventDefault()
    if (!(await markRead(notification))) return
    setOpen(false)
    navigate(`/post/${notification.post_id}`)
  }

  const markAllRead = async () => {
    const unread = notifications.filter((notification) => !notification.read_at)
    if (unread.length === 0 || updating) return

    setUpdating(true)
    setError('')
    try {
      const readAt = new Date().toISOString()
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ read_at: readAt })
        .eq('user_id', userId)
        .is('read_at', null)

      if (updateError) throw updateError
      setNotifications((current) => current.map((item) => item.read_at ? item : { ...item, read_at: readAt }))
    } catch (updateError) {
      console.error('Unable to mark all notifications as read:', updateError)
      setError('Notifications couldn’t be marked as read. Please try again.')
    } finally {
      setUpdating(false)
    }
  }

  const unreadCount = notifications.filter((notification) => !notification.read_at).length

  return (
    <div className="notification-center" ref={rootRef}>
      <button
        type="button"
        className={`notification-trigger${open ? ' is-open' : ''}`}
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
      >
        <span aria-hidden="true">♧</span>
        <span className="notification-trigger-label">Notifications</span>
        {unreadCount > 0 && <span className="notification-unread-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>

      {open && (
        <section className="notification-popover" role="dialog" aria-label="Notifications">
          <header className="notification-popover-header">
            <div>
              <h2>Notifications</h2>
              <p>{unreadCount ? `${unreadCount} unread` : 'You’re all caught up'}</p>
            </div>
            {unreadCount > 0 && (
              <button type="button" className="notification-mark-all" onClick={markAllRead} disabled={updating}>
                Mark all read
              </button>
            )}
          </header>

          {error && (
            <div className="notification-error" role="alert">
              <span>{error}</span>
              <button type="button" onClick={loadNotifications}>Retry</button>
            </div>
          )}

          {loading ? (
            <div className="notification-empty-state" role="status">
              <span className="app-loading-spinner" />
              <p>Loading notifications…</p>
            </div>
          ) : notifications.length === 0 && !error ? (
            <div className="notification-empty-state">
              <span aria-hidden="true">🌿</span>
              <strong>A quiet moment</strong>
              <p>Comments and reactions on your posts will show up here.</p>
            </div>
          ) : notifications.length > 0 ? (
            <ul className="notification-list">
              {notifications.map((notification) => {
                const copy = notificationCopy[notification.type] ?? { icon: '✧', text: 'There’s an update on your post' }
                return (
                  <li key={notification.id}>
                    <a
                      className={`notification-item${notification.read_at ? '' : ' is-unread'}`}
                      href={`/post/${notification.post_id}`}
                      onClick={(event) => openNotification(event, notification)}
                    >
                      <span className={`notification-item-icon is-${notification.type}`} aria-hidden="true">{copy.icon}</span>
                      <span className="notification-item-copy">
                        <strong>{copy.text}</strong>
                        <time dateTime={notification.created_at}>{formatNotificationTime(notification.created_at)}</time>
                      </span>
                      {!notification.read_at && <span className="notification-unread-dot" aria-label="Unread" />}
                    </a>
                  </li>
                )
              })}
            </ul>
          ) : null}
        </section>
      )}
    </div>
  )
}
