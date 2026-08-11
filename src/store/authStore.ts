import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import { supabase, describeSupabaseError } from '../lib/supabase'
import type { AuthState, LoginCredentials, User, UserRole } from '../types/auth'
import { canWrite } from '../types/auth'

interface AuthStore extends AuthState {
  /** Resolve a sessão persistida e passa a acompanhar as mudanças de auth. */
  verifyAuth: () => Promise<void>
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => Promise<void>
  updateProfile: (patch: {
    fullName?: string
    jobTitle?: string | null
    department?: string | null
  }) => Promise<void>
  changePassword: (newPassword: string) => Promise<void>
  clearError: () => void
  canWrite: () => boolean
}

type ProfileRow = {
  id: string
  email: string
  full_name: string
  role: UserRole
  job_title: string | null
  department: string | null
  avatar_url: string | null
  plant_id: string | null
  last_login_at: string | null
}

const PROFILE_COLUMNS =
  'id, email, full_name, role, job_title, department, avatar_url, plant_id, last_login_at'

function toUser(row: ProfileRow): User {
  return {
    id: row.id,
    name: row.full_name || row.email.split('@')[0],
    email: row.email,
    role: row.role,
    jobTitle: row.job_title,
    department: row.department,
    avatarUrl: row.avatar_url,
    plantId: row.plant_id,
    lastLoginAt: row.last_login_at,
  }
}

async function fetchProfile(userId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  return data ? toUser(data as ProfileRow) : null
}

let authListenerBound = false

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  isLoading: false,
  isInitializing: true,
  error: null,
  isAuthenticated: false,

  /**
   * O supabase-js persiste a sessão e renova o token sozinho — não há refresh
   * manual nem componente de keep-alive no front.
   */
  verifyAuth: async () => {
    const applySession = async (session: Session | null) => {
      if (!session?.user) {
        set({ user: null, isAuthenticated: false, isInitializing: false })
        return
      }

      try {
        const profile = await fetchProfile(session.user.id)
        if (!profile) {
          set({
            user: null,
            isAuthenticated: false,
            isInitializing: false,
            error: 'Perfil não encontrado. Contate um administrador.',
          })
          return
        }
        set({ user: profile, isAuthenticated: true, isInitializing: false, error: null })
      } catch (error) {
        set({
          user: null,
          isAuthenticated: false,
          isInitializing: false,
          error: describeSupabaseError(error, 'Falha ao carregar o perfil.'),
        })
      }
    }

    if (!authListenerBound) {
      authListenerBound = true
      supabase.auth.onAuthStateChange((event, session) => {
        // TOKEN_REFRESHED não muda quem está logado; evita refetch desnecessário.
        if (event === 'TOKEN_REFRESHED' && get().isAuthenticated) return
        void applySession(session)
      })
    }

    const { data, error } = await supabase.auth.getSession()
    if (error) {
      set({ isInitializing: false, error: describeSupabaseError(error, 'Falha ao restaurar a sessão.') })
      return
    }
    await applySession(data.session)
  },

  login: async ({ email, password }: LoginCredentials) => {
    set({ isLoading: true, error: null })

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    if (error) {
      const message =
        error.message === 'Invalid login credentials'
          ? 'E-mail ou senha incorretos.'
          : describeSupabaseError(error, 'Falha no login. Tente novamente.')
      set({ error: message, isLoading: false, isAuthenticated: false })
      throw new Error(message)
    }

    try {
      const profile = await fetchProfile(data.user.id)
      if (!profile) throw new Error('Perfil não encontrado. Contate um administrador.')

      set({ user: profile, isAuthenticated: true, isLoading: false, isInitializing: false, error: null })

      void supabase.rpc('log_audit_event', {
        p_action: 'login',
        p_entity_type: 'auth',
        p_entity_id: profile.id,
        p_metadata: { email: profile.email },
      })
    } catch (error) {
      const message = describeSupabaseError(error, 'Falha ao carregar o perfil.')
      set({ error: message, isLoading: false, isAuthenticated: false })
      throw new Error(message)
    }
  },

  logout: async () => {
    set({ isLoading: true })
    await supabase.auth.signOut()
    set({ user: null, isAuthenticated: false, isLoading: false, error: null })
  },

  updateProfile: async (patch) => {
    const current = get().user
    if (!current) throw new Error('Nenhuma sessão ativa.')

    const { data, error } = await supabase
      .from('profiles')
      .update({
        ...(patch.fullName !== undefined ? { full_name: patch.fullName } : {}),
        ...(patch.jobTitle !== undefined ? { job_title: patch.jobTitle } : {}),
        ...(patch.department !== undefined ? { department: patch.department } : {}),
      })
      .eq('id', current.id)
      .select(PROFILE_COLUMNS)
      .single()

    if (error) throw new Error(describeSupabaseError(error, 'Não foi possível salvar o perfil.'))
    set({ user: toUser(data as ProfileRow) })
  },

  changePassword: async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw new Error(describeSupabaseError(error, 'Não foi possível alterar a senha.'))
  },

  clearError: () => set({ error: null }),

  canWrite: () => canWrite(get().user?.role),
}))
