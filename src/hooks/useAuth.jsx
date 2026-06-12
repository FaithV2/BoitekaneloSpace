import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined)
  const [user, setUser] = useState(undefined)
  const [profile, setProfile] = useState(null)
  const [refreshingProfile, setRefreshingProfile] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadProfile = async (userId) => {
    if (!userId) {
      setProfile(null)
      return
    }

    try {
      setRefreshingProfile(true)

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (!error) {
        setProfile(data)
      } else {
        setProfile(null)
      }
    } catch (err) {
      console.log('Profile error:', err)
      setProfile(null)
    } finally {
      setRefreshingProfile(false)
    }
  }

  const ensureProfile = async (userId, email) => {
    if (!userId) return

    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single()

    if (!data) {
      await supabase.from('users').insert([{ id: userId, email: email || '', role: 'user' }])
    }
  }

  useEffect(() => {
    let active = true

    const init = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        const sessionData = data?.session ?? null

        if (!active) return

        setSession(sessionData)
        setUser(sessionData?.user ?? null)

        if (sessionData?.user?.id) {
          await ensureProfile(sessionData.user.id, sessionData.user.email)
          await loadProfile(sessionData.user.id)
        }
      } catch (err) {
        console.log('Auth init error:', err)
      } finally {
        if (active) setLoading(false)
      }
    }

    init()

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, sessionData) => {
        if (!active) return

        setSession(sessionData)
        setUser(sessionData?.user ?? null)

        if (sessionData?.user?.id) {
          await ensureProfile(sessionData.user.id, sessionData.user.email)
          await loadProfile(sessionData.user.id)
        } else {
          setProfile(null)
        }
      }
    )

    return () => {
      active = false
      listener?.subscription?.unsubscribe()
    }
  }, [])

  const signUp = async ({ email, password }) => {
    return await supabase.auth.signUp({ email, password })
  }

  const signIn = async ({ email, password }) => {
    return await supabase.auth.signInWithPassword({ email, password })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setUser(null)
    setProfile(null)
  }

  const value = useMemo(
    () => ({
      user,
      profile,
      session,
      loading,
      signIn,
      signUp,
      signOut,
      refreshingProfile
    }),
    [user, profile, session, loading, refreshingProfile]
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}