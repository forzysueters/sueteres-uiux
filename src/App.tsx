import { useEffect } from 'react';
import {
  LayoutDashboard,
  Factory,
  AlertTriangle,
  Package,
  Bot,
  Menu,
  X,
} from 'lucide-react';
import { useAppStore } from './store/appStore';
import { useAuthStore } from './store/authStore';
import { Dashboard } from './pages/Dashboard';
import { PlantNavigation } from './pages/PlantNavigation';
import { AlertsPage } from './pages/AlertsPage';
import { EquipmentPage } from './pages/EquipmentPage';
import { AssistantPage } from './pages/AssistantPage';
import { AssetDetailPanel } from './components/AssetDetailPanel';
import { LoginPage } from './pages/LoginPage';
import { TokenRefresher } from './components/TokenRefresher';
import { UserProfile } from './components/UserProfile';

function AppContent() {
  const {
    selectedTab,
    setSelectedTab,
    selectedAssetId,
    setSelectedAsset,
    sidebarOpen,
    setSidebarOpen,
  } = useAppStore();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'plant', label: 'Plant', icon: Factory },
    { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
    { id: 'equipment', label: 'Equipment', icon: Package },
    { id: 'assistant', label: 'AI Assistant', icon: Bot },
  ];

  const renderContent = () => {
    switch (selectedTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'plant':
        return <PlantNavigation />;
      case 'alerts':
        return <AlertsPage />;
      case 'equipment':
        return <EquipmentPage />;
      case 'assistant':
        return <AssistantPage />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-0'
        } bg-slate-900 border-r border-slate-700 transition-all duration-300 overflow-hidden flex flex-col`}
      >        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="font-bold text-lg">Forzy</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = selectedTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setSelectedTab(item.id);
                  if (window.innerWidth < 1024) {
                    setSidebarOpen(false);
                  }
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User Profile in Sidebar */}
        <div className="p-4 border-t border-slate-700">
          <UserProfile />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-slate-900/50 border-b border-slate-700 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors lg:hidden"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>            <div>
              <h1 className="text-lg font-semibold">
                {navItems.find(item => item.id === selectedTab)?.label}
              </h1>
              <p className="text-xs text-slate-400">Forzy Digital Twin Platform</p>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6">
            {renderContent()}
          </div>

          {/* Detail Panel */}
          {selectedAssetId && (
            <AssetDetailPanel
              assetId={selectedAssetId}
              onClose={() => setSelectedAsset(null)}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function App() {
  const { isAuthenticated, verifyAuth, isLoading } = useAuthStore();

  useEffect(() => {
    // Verify authentication on app load
    verifyAuth();
  }, [verifyAuth]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-400 mx-auto"></div>
          <p className="mt-6 text-white text-lg font-medium">Loading authentication...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <TokenRefresher>
      <AppContent />
    </TokenRefresher>
  );
}

export default App;
