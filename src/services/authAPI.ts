import { AuthResponse, LoginCredentials, User, UserRole } from '../types/auth'
import { supabase } from '../lib/supabaseClient'
import type { Session, User as SupabaseUser } from '@supabase/supabase-js'

export type VerifyResult =
  | { status: 'authenticated'; user: User }
  | { status: 'unauthenticated' }
  | { status: 'network-error' }

const isNetworkError = (err: unknown): boolean => {
  const message = err instanceof Error ? err.message.toLowerCase() : ''
  return (
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('load failed')
  )
}

const buildUser = async (
  supaUser: SupabaseUser,
  fallbackName?: string,
): Promise<User> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', supaUser.id)
    .maybeSingle()

  if (error) throw error

  return {
    id: supaUser.id,
    email: supaUser.email ?? '',
    name: data?.name ?? fallbackName ?? supaUser.email ?? 'Usuário',
    role: (data?.role as UserRole) ?? 'technician',
  }
}

const sessionToResponse = async (session: Session): Promise<AuthResponse> => {
  const user = await buildUser(session.user)
  return { accessToken: session.access_token, user }
}

class AuthAPI {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    })

    if (error || !data.session) {
      throw new Error(error?.message || 'Falha no login. Tente novamente.')
    }

    return sessionToResponse(data.session)
  }

  async refresh(): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.auth.refreshSession()
      if (error || !data.session) {
        throw new Error(error?.message || 'Token refresh failed')
      }
      return sessionToResponse(data.session)
    } catch (err) {
      if (isNetworkError(err)) {
        const e = new Error('Network error during refresh') as Error & {
          isNetworkError?: boolean
        }
        e.isNetworkError = true
        throw e
      }
      throw err
    }
  }

  async logout(): Promise<void> {
    try {
      await supabase.auth.signOut()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  async verify(): Promise<VerifyResult> {
    try {
      const { data, error } = await supabase.auth.getSession()
      if (error) {
        if (isNetworkError(error)) return { status: 'network-error' }
        return { status: 'unauthenticated' }
      }
      if (!data.session) return { status: 'unauthenticated' }
      const user = await buildUser(data.session.user)
      return { status: 'authenticated', user }
    } catch (err) {
      if (isNetworkError(err)) return { status: 'network-error' }
      return { status: 'unauthenticated' }
    }
  }

  // Supabase manages auth headers internally; these are kept for compatibility.
  setAuthHeader(_token: string): void {}
  clearAuthHeader(): void {}
}

export const authAPI = new AuthAPI()
