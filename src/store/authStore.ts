import { create } from 'zustand'
import { AuthState, LoginCredentials, User } from '../types/auth'
import { authAPI } from '../services/authAPI'

interface AuthStore extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => Promise<void>
  refreshToken: () => Promise<void>
  verifyAuth: () => Promise<void>
  setUser: (user: User | null) => void
  setAccessToken: (token: string | null) => void
  clearAuth: () => void
}

// Hidrata token e user do localStorage para sobreviver a reload e foco/blur de aba.
const storedToken =
  typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null
const storedUserRaw =
  typeof window !== 'undefined' ? localStorage.getItem('authUser') : null
let storedUser: User | null = null
try {
  storedUser = storedUserRaw ? (JSON.parse(storedUserRaw) as User) : null
} catch {
  storedUser = null
}
if (storedToken) {
  authAPI.setAuthHeader(storedToken)
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: storedUser,
  accessToken: storedToken,
  isLoading: false,
  error: null,
  // Inicia autenticado se temos token + user. Verifica em background.
  isAuthenticated: Boolean(storedToken && storedUser),

  login: async (credentials: LoginCredentials) => {
    set({ isLoading: true, error: null })
    try {
      const response = await authAPI.login(credentials)

      localStorage.setItem('accessToken', response.accessToken)
      localStorage.setItem('authUser', JSON.stringify(response.user))
      authAPI.setAuthHeader(response.accessToken)

      set({
        accessToken: response.accessToken,
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      })
    } catch (error: any) {
      const errorMessage = error.message || 'Falha no login'
      set({
        error: errorMessage,
        isLoading: false,
        isAuthenticated: false,
      })
      throw error
    }
  },

  logout: async () => {
    set({ isLoading: true })
    try {
      await authAPI.logout()
    } finally {
      get().clearAuth()
    }
  },

  refreshToken: async () => {
    try {
      const response = await authAPI.refresh()
      localStorage.setItem('accessToken', response.accessToken)
      localStorage.setItem('authUser', JSON.stringify(response.user))
      authAPI.setAuthHeader(response.accessToken)

      set({
        accessToken: response.accessToken,
        user: response.user,
        isAuthenticated: true,
        error: null,
      })
    } catch (error: any) {
      // Só encerra a sessão quando o servidor rejeita explicitamente a
      // credencial (401 sem cookie / 403 refresh inválido). Erro de rede ou
      // 5xx transitório preservam a sessão local — o access token ainda pode
      // estar válido e o próximo tick do TokenRefresher tenta de novo.
      const status = error?.status
      if (!error?.isNetworkError && (status === 401 || status === 403)) {
        get().clearAuth()
      }
      throw error
    }
  },

  verifyAuth: async () => {
    // Se não temos token armazenado, não há nada que verificar.
    const token = localStorage.getItem('accessToken')
    if (!token) {
      get().clearAuth()
      return
    }

    set({ isLoading: true })
    const result = await authAPI.verify()

    if (result.status === 'authenticated') {
      set({
        user: result.user,
        accessToken: token,
        isAuthenticated: true,
        isLoading: false,
      })
      authAPI.setAuthHeader(token)
      localStorage.setItem('authUser', JSON.stringify(result.user))
      return
    }

    if (result.status === 'network-error') {
      // Servidor indisponível — preserva a sessão local em vez de derrubar.
      set({ isLoading: false, isAuthenticated: Boolean(token) })
      return
    }

    // Servidor disse "não autenticado" → sessão inválida de fato.
    get().clearAuth()
  },

  setUser: (user: User | null) => {
    if (user) {
      localStorage.setItem('authUser', JSON.stringify(user))
    } else {
      localStorage.removeItem('authUser')
    }
    set({ user })
  },

  setAccessToken: (token: string | null) => {
    if (token) {
      localStorage.setItem('accessToken', token)
      authAPI.setAuthHeader(token)
    } else {
      localStorage.removeItem('accessToken')
      authAPI.clearAuthHeader()
    }
    set({ accessToken: token })
  },

  clearAuth: () => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('authUser')
    authAPI.clearAuthHeader()
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    })
  },
}))
