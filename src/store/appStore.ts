import { create } from 'zustand';
import { Asset, Alert, KPIMetrics, ChatMessage } from '../types';

interface AppStore {
  // UI State
  selectedAssetId: string | null;
  selectedTab: 'dashboard' | 'plant' | 'alerts' | 'equipment' | 'assistant';
  sidebarOpen: boolean;
  darkMode: boolean;
  primaryColor: 'orange' | 'purple';
  language: 'pt' | 'en';

  // Data State
  assets: Asset[];
  alerts: Alert[];
  kpis: KPIMetrics | null;
  chatMessages: ChatMessage[];
  loading: boolean;
  error: string | null;

  // Actions
  setSelectedAsset: (assetId: string | null) => void;
  setSelectedTab: (tab: string) => void;
  setSidebarOpen: (open: boolean) => void;
  setAssets: (assets: Asset[]) => void;
  setAlerts: (alerts: Alert[]) => void;
  setKPIs: (kpis: KPIMetrics) => void;
  updateAsset: (asset: Asset) => void;
  updateChatMessage: (message: ChatMessage) => void;
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
  selectedTab: 'dashboard',
  sidebarOpen: true,
  darkMode: true,
  primaryColor: 'orange',
  language: 'pt',
  assets: [],
  alerts: [],
  kpis: null,
  chatMessages: [],
  loading: false,
  error: null,

  // Actions
  setSelectedAsset: (assetId) => set({ selectedAssetId: assetId }),
  setSelectedTab: (tab) => set({ selectedTab: tab as any }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setAssets: (assets) => set({ assets }),
  setAlerts: (alerts) => set({ alerts }),
  setKPIs: (kpis) => set({ kpis }),
  updateAsset: (asset) => set((state) => ({
    assets: state.assets.map(a => a.id === asset.id ? asset : a),
  })),
  updateChatMessage: (message) => set((state) => ({
    chatMessages: [...state.chatMessages, message],
  })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
  toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
  setPrimaryColor: (color) => set({ primaryColor: color }),
  setLanguage: (lang) => set({ language: lang }),
}));
