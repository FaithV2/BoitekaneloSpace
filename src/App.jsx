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

function AppShell() {
  const { session, profile, signOut } = useAuth()
  const isAuthenticated = Boolean(session?.user)

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="brand">
            <span className="brand-mark">B</span>
            <div>
              <div>Boitekanelo Space</div>
              <div style={{ fontSize: '0.9rem', color: '#506880' }}>A calm community for wellness sharing</div>
            </div>
          </div>

          {isAuthenticated && (
            <div className="nav-actions">
              <nav className="nav-links">
                <NavLink to="/" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                  Home
                </NavLink>
                <NavLink to="/feed" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                  Feed
                </NavLink>
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
              <button className="secondary" onClick={signOut}>
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="page-shell">
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
          <Route path="/feed" element={<ProtectedRoute><FeedPage /></ProtectedRoute>} />
          <Route path="/post/:id" element={<ProtectedRoute><PostPage /></ProtectedRoute>} />
          <Route path="/mood" element={<ProtectedRoute><MoodPage /></ProtectedRoute>} />
          <Route path="/checkin" element={<ProtectedRoute><CheckinPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
          <Route path="*" element={isAuthenticated ? <Navigate to="/" replace /> : <Navigate to="/auth" replace />} />
        </Routes>
      </main>
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { session, loading } = useAuth()

  if (loading) {
    return <div style={{ padding: '24px', textAlign: 'center' }}>Loading your session…</div>
  }

  return session?.user ? children : <Navigate to="/auth" replace />
}

function AdminRoute({ children }) {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return <div style={{ padding: '24px', textAlign: 'center' }}>Loading admin access…</div>
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
