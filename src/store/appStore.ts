import { create } from 'zustand';
import { Asset, Alert, KPIMetrics, ChatMessage } from '../types';

interface AppStore {
  // UI State
  selectedAssetId: string | null;
  sidebarOpen: boolean;
  darkMode: boolean;
  primaryColor: 'orange' | 'purple';
  language: 'pt' | 'en';

  // Data State
  assets: Asset[];
  alerts: Alert[];
  kpis: KPIMetrics | null;
  chatMessages: ChatMessage[];
  conversationId: string | null;
  loading: boolean;
  error: string | null;

  // Actions
  setSelectedAsset: (assetId: string | null) => void;
  setSidebarOpen: (open: boolean) => void;
  setAssets: (assets: Asset[]) => void;
  setAlerts: (alerts: Alert[]) => void;
  setKPIs: (kpis: KPIMetrics) => void;
  updateAsset: (asset: Asset) => void;
  resolveAlert: (alertId: string) => void;
  addChatMessage: (message: ChatMessage) => void;
  clearChatMessages: () => void;
  setConversationId: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  toggleDarkMode: () => void;
  setPrimaryColor: (color: 'orange' | 'purple') => void;
  setLanguage: (lang: 'pt' | 'en') => void;
}

export const useAppStore = create<AppStore>((set) => ({
  // Initial state
  selectedAssetId: null,
  sidebarOpen: true,
  darkMode: true,
  primaryColor: 'orange',
  language: 'pt',
  assets: [],
  alerts: [],
  kpis: null,
  chatMessages: [],
  conversationId: null,
  loading: false,
  error: null,

  // Actions
  setSelectedAsset: (assetId) => set({ selectedAssetId: assetId }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setAssets: (assets) => set({ assets }),
  setAlerts: (alerts) => set({ alerts }),
  setKPIs: (kpis) => set({ kpis }),
  updateAsset: (asset) =>
    set((state) => ({ assets: state.assets.map((a) => (a.id === asset.id ? asset : a)) })),
  resolveAlert: (alertId) =>
    set((state) => ({
      alerts: state.alerts.map((a) => (a.id === alertId ? { ...a, resolved: true } : a)),
    })),
  addChatMessage: (message) =>
    set((state) => ({ chatMessages: [...state.chatMessages, message] })),
  clearChatMessages: () => set({ chatMessages: [], conversationId: null }),
  setConversationId: (id) => set({ conversationId: id }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
  toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
  setPrimaryColor: (color) => set({ primaryColor: color }),
  setLanguage: (lang) => set({ language: lang }),
}));
