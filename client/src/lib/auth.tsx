import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  api,
  clearAuthTokens,
  getAccessToken,
  setAuthTokens,
  type AuthResponse,
  type AuthUser,
} from './api'

type AuthContextValue = {
  user: AuthUser | null
  initializing: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, confirmPassword: string) => Promise<AuthResponse>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      try {
        if (!getAccessToken()) {
          setUser(null)
          return
        }
        const { user: currentUser } = await api.auth.me()
        if (!cancelled) {
          setUser(currentUser)
        }
      } catch {
        clearAuthTokens()
        if (!cancelled) {
          setUser(null)
        }
      } finally {
        if (!cancelled) {
          setInitializing(false)
        }
      }
    }

    void bootstrap()

    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.auth.login(email, password)
    if (response.tokens) {
      setAuthTokens(response.tokens.accessToken, response.tokens.refreshToken)
    }
    setUser(response.user)
  }, [])

  const register = useCallback(
    async (email: string, password: string, confirmPassword: string) => {
      const response = await api.auth.register(email, password, confirmPassword)
      if (response.tokens) {
        setAuthTokens(response.tokens.accessToken, response.tokens.refreshToken)
        setUser(response.user)
      }
      return response
    },
    [],
  )

  const logout = useCallback(async () => {
    try {
      await api.auth.logout()
    } catch {
      // token may already be invalid; clear locally regardless
    }
    clearAuthTokens()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, initializing, login, register, logout }),
    [user, initializing, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
