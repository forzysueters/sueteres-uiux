import axios, { AxiosError, AxiosInstance } from 'axios'
import { AuthResponse, LoginCredentials, User } from '../types/auth'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export type VerifyResult =
  | { status: 'authenticated'; user: User }
  | { status: 'unauthenticated' }
  | { status: 'network-error' }

class AuthAPI {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      withCredentials: true,
    })

    this.client.interceptors.request.use((config) => {
      const accessToken = localStorage.getItem('accessToken')
      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`
      }
      return config
    })
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await this.client.post<AuthResponse>(
        '/auth/login',
        credentials,
      )
      return response.data
    } catch (error: any) {
      throw new Error(
        error.response?.data?.error || 'Falha no login. Tente novamente.',
      )
    }
  }

  async refresh(): Promise<AuthResponse> {
    try {
      const response = await this.client.post<AuthResponse>('/auth/refresh')
      return response.data
    } catch (error: any) {
      // Diferencia erro de rede vs servidor recusando explicitamente
      const err = error as AxiosError
      if (!err.response) {
        const e = new Error('Network error during refresh') as Error & {
          isNetworkError?: boolean
        }
        e.isNetworkError = true
        throw e
      }
      throw new Error((err.response.data as any)?.error || 'Token refresh failed')
    }
  }

  async logout(): Promise<void> {
    try {
      await this.client.post('/auth/logout')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  async verify(): Promise<VerifyResult> {
    try {
      const response = await this.client.get<{
        authenticated: boolean
        user?: User
      }>('/auth/verify')
      if (response.data.authenticated && response.data.user) {
        return { status: 'authenticated', user: response.data.user }
      }
      return { status: 'unauthenticated' }
    } catch (error) {
      const err = error as AxiosError
      // Sem response = erro de rede (servidor offline / sem internet).
      // NÃO confundir com sessão inválida.
      if (!err.response) {
        return { status: 'network-error' }
      }
      return { status: 'unauthenticated' }
    }
  }

  setAuthHeader(token: string): void {
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`
  }

  clearAuthHeader(): void {
    delete this.client.defaults.headers.common['Authorization']
  }

  getClient(): AxiosInstance {
    return this.client
  }
}

export const authAPI = new AuthAPI()
