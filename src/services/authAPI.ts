import axios, { AxiosInstance } from 'axios';
import { AuthResponse, LoginCredentials, User } from '../types/auth';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

class AuthAPI {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      withCredentials: true // Include cookies
    });

    // Interceptor to add access token to requests
    this.client.interceptors.request.use((config) => {
      const accessToken = localStorage.getItem('accessToken');
      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }
      return config;
    });
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await this.client.post<AuthResponse>(
        '/auth/login',
        credentials
      );
      return response.data;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.error || 'Login failed. Please try again.'
      );
    }
  }

  async refresh(): Promise<AuthResponse> {
    try {
      const response = await this.client.post<AuthResponse>('/auth/refresh');
      return response.data;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.error || 'Token refresh failed'
      );
    }
  }

  async logout(): Promise<void> {
    try {
      await this.client.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  async verify(): Promise<{ authenticated: boolean; user?: User }> {
    try {
      const response = await this.client.get<any>('/auth/verify');
      return response.data;
    } catch (error) {
      return { authenticated: false };
    }
  }

  setAuthHeader(token: string): void {
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  clearAuthHeader(): void {
    delete this.client.defaults.headers.common['Authorization'];
  }

  getClient(): AxiosInstance {
    return this.client;
  }
}

export const authAPI = new AuthAPI();
