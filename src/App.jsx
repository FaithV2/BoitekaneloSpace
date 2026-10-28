import { useCallback, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import AuthPage from './pages/AuthPage'
import HomePage from './pages/HomePage'
import FeedPage from './pages/FeedPage'
import PostPage from './pages/PostPage'
import MoodPage from './pages/MoodPage'
import CheckinPage from './pages/CheckinPage'
import ProfilePage from './pages/ProfilePage'
import AdminPage from './pages/AdminPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import NotificationCenter from './components/NotificationCenter'
import WelcomeExperience from './components/WelcomeExperience'
import RoleDashboardPage from './pages/RoleDashboardPage'

function AppShell() {
  const { session, profile, loading, refreshingProfile, signOut } = useAuth()
  const isAuthenticated = Boolean(session?.user)
  const userId = session?.user?.id
  const [welcomeUserId, setWelcomeUserId] = useState(null)

  useEffect(() => {
    if (!userId || loading || refreshingProfile) {
      if (!userId) setWelcomeUserId(null)
      return
    }

    let hasSeenWelcome = false
    try {
      hasSeenWelcome = Boolean(window.localStorage.getItem(`boitekanelo-welcome-seen:${userId}`))
    } catch (error) {
      console.error('Unable to read welcome experience state:', error)
    }
    setWelcomeUserId(hasSeenWelcome ? null : userId)
  }, [userId, loading, refreshingProfile])

  const dismissWelcome = useCallback(() => {
    if (!welcomeUserId) return

    try {
      window.localStorage.setItem(`boitekanelo-welcome-seen:${welcomeUserId}`, 'true')
    } catch (error) {
      console.error('Unable to save welcome experience state:', error)
    }
    setWelcomeUserId(null)
  }, [welcomeUserId])

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">B</span>
            <div>
              <div className="brand-name">Boitekanelo Space</div>
              <div className="brand-tagline">A calm community for wellness sharing</div>
            </div>
          </div>

          {isAuthenticated && (
            <div className="nav-actions">
              <nav className="nav-links" aria-label="Main navigation">
                {profile?.role !== 'supporter' && profile?.role !== 'therapist' && (
                  <NavLink to="/" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                    Home
                  </NavLink>
                )}
                <NavLink to="/feed" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                  Feed
                </NavLink>
                {profile?.role === 'supporter' && (
                  <NavLink to="/supporter" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                    Support
                  </NavLink>
                )}
                {profile?.role === 'therapist' && (
                  <NavLink to="/therapist" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                    Therapist space
                  </NavLink>
                )}
                <NavLink to="/mood" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                  Mood
                </NavLink>
                <NavLink to="/checkin" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                  Check-in
                </NavLink>
                <NavLink to="/profile" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                  Profile
                </NavLink>
                {profile?.role === 'admin' && (
                  <NavLink to="/admin" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                    Admin
                  </NavLink>
                )}
              </nav>
              <NotificationCenter userId={session.user.id} />
              <button className="secondary sign-out-button" onClick={signOut}>
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      <main className={`page-shell${isAuthenticated ? ' authenticated-shell' : ' public-shell'}`}>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/" element={<HomeRoute />} />
          <Route path="/feed" element={<ProtectedRoute><FeedPage /></ProtectedRoute>} />
          <Route path="/post/:id" element={<ProtectedRoute><PostPage /></ProtectedRoute>} />
          <Route path="/mood" element={<ProtectedRoute><MoodPage /></ProtectedRoute>} />
          <Route path="/checkin" element={<ProtectedRoute><CheckinPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
          <Route path="/supporter" element={<RoleRoute role="supporter"><RoleDashboardPage role="supporter" /></RoleRoute>} />
          <Route path="/therapist" element={<RoleRoute role="therapist"><RoleDashboardPage role="therapist" /></RoleRoute>} />
          <Route path="*" element={isAuthenticated ? <Navigate to="/" replace /> : <Navigate to="/auth" replace />} />
        </Routes>
      </main>
      {welcomeUserId && <WelcomeExperience onContinue={dismissWelcome} />}
    </div>
  )
}

function HomeRoute() {
  const { profile, loading } = useAuth()

  if (loading) {
    return <div className="app-loading-state" role="status"><span className="app-loading-spinner" />Loading your session…</div>
  }

  if (profile?.role === 'supporter') return <Navigate to="/supporter" replace />
  if (profile?.role === 'therapist') return <Navigate to="/therapist" replace />
  return <ProtectedRoute><HomePage /></ProtectedRoute>
}

function ProtectedRoute({ children }) {
  const { session, loading } = useAuth()

  if (loading) {
    return <div className="app-loading-state" role="status"><span className="app-loading-spinner" />Loading your session…</div>
  }

  return session?.user ? children : <Navigate to="/auth" replace />
}

function RoleRoute({ children, role }) {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return <div className="app-loading-state" role="status"><span className="app-loading-spinner" />Checking role access…</div>
  }

  if (!session?.user) return <Navigate to="/auth" replace />
  if (profile?.role === role) return children
  if (profile?.role === 'supporter') return <Navigate to="/supporter" replace />
  if (profile?.role === 'therapist') return <Navigate to="/therapist" replace />
  return <Navigate to="/" replace />
}

function AdminRoute({ children }) {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return <div className="app-loading-state" role="status"><span className="app-loading-spinner" />Checking admin access…</div>
  }

  if (!session?.user) return <Navigate to="/auth" replace />
  return profile?.role === 'admin' ? children : <Navigate to="/" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </AuthProvider>
  )
}
