import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
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

/**
 * Chave da preferência de interface no localStorage.
 *
 * Lida também pelo script inline do index.html, que aplica tema e cor ANTES do
 * React montar. Mudou aqui? Mude lá — senão volta o flash de tema errado no
 * primeiro paint.
 */
export const PREFS_STORAGE_KEY = 'forzy.prefs';

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
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
    }),
    {
      name: PREFS_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Só as escolhas da pessoa. Ativos, alertas, KPIs e a conversa com o
      // Órion são dados do turno: gravados aqui, a tela abriria mostrando
      // telemetria velha como se fosse a de agora.
      partialize: (state) => ({
        darkMode: state.darkMode,
        primaryColor: state.primaryColor,
        language: state.language,
      }),
    },
  ),
);
