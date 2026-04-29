import { create } from 'zustand';
import { AuthState, LoginCredentials, User } from '../types/auth';
import { authAPI } from '../services/authAPI';

interface AuthStore extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  verifyAuth: () => Promise<void>;
  setUser: (user: User | null) => void;
  setAccessToken: (token: string | null) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  accessToken: null,
  isLoading: false,
  error: null,
  isAuthenticated: false,

  login: async (credentials: LoginCredentials) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authAPI.login(credentials);
      
      // Store access token in memory + localStorage for persistence
      localStorage.setItem('accessToken', response.accessToken);
      authAPI.setAuthHeader(response.accessToken);

      set({
        accessToken: response.accessToken,
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
        error: null
      });
    } catch (error: any) {
      const errorMessage = error.message || 'Login failed';
      set({
        error: errorMessage,
        isLoading: false,
        isAuthenticated: false
      });
      throw error;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await authAPI.logout();
    } finally {
      get().clearAuth();
    }
  },

  refreshToken: async () => {
    try {
      const response = await authAPI.refresh();
      localStorage.setItem('accessToken', response.accessToken);
      authAPI.setAuthHeader(response.accessToken);

      set({
        accessToken: response.accessToken,
        user: response.user,
        isAuthenticated: true,
        error: null
      });
    } catch (error: any) {
      // Refresh failed - clear auth
      get().clearAuth();
      throw error;
    }
  },

  verifyAuth: async () => {
    try {
      const result = await authAPI.verify();
      
      if (result.authenticated && result.user) {
        // Try to get stored token
        const storedToken = localStorage.getItem('accessToken');
        
        // If no stored token but server says authenticated, need to refresh
        if (!storedToken) {
          await get().refreshToken();
        } else {
          set({
            user: result.user,
            accessToken: storedToken,
            isAuthenticated: true
          });
          authAPI.setAuthHeader(storedToken);
        }
      } else {
        get().clearAuth();
      }
    } catch (error) {
      get().clearAuth();
    }
  },

  setUser: (user: User | null) => set({ user }),

  setAccessToken: (token: string | null) => {
    if (token) {
      localStorage.setItem('accessToken', token);
      authAPI.setAuthHeader(token);
    } else {
      localStorage.removeItem('accessToken');
      authAPI.clearAuthHeader();
    }
    set({ accessToken: token });
  },

  clearAuth: () => {
    localStorage.removeItem('accessToken');
    authAPI.clearAuthHeader();
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null
    });
  }
}));
