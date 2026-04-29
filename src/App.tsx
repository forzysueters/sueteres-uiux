import { useEffect, useState, useRef } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  NavLink,
  Navigate,
  useLocation,
  Link,
} from 'react-router-dom';
import {
  LayoutDashboard,
  Factory,
  Bell,
  Cpu,
  Bot,
  Clock,
  Settings,
  User,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { useAppStore } from './store/appStore';
import { translations } from './translations';
import { Dashboard } from './pages/Dashboard';
import { PlantNavigation } from './pages/PlantNavigation';
import { AlertsPage } from './pages/AlertsPage';
import { EquipmentPage } from './pages/EquipmentPage';
import { AssistantPage } from './pages/AssistantPage';
import { SettingsPage } from './pages/SettingsPage';
import { AccountPage } from './pages/AccountPage';
import { AssetDetailPanel } from './components/AssetDetailPanel';

// Caminhos dos logos
const logoWhite = '/src/assets/logo-forzy-branca.svg';
const logoBlack = '/src/assets/logo-forzy-preta.svg';

const AppContent = () => {
  const {
    selectedAssetId,
    setSelectedAsset,
    darkMode,
    primaryColor,
    language,
  } = useAppStore();

  const t = translations[language];

  const [time, setTime] = useState(new Date());
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Aplicar Tema Escuro/Claro e Cor Primária
  useEffect(() => {
    const root = document.documentElement;
    
    // Dark mode
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // Primary color theme
    root.classList.remove('theme-orange', 'theme-purple');
    root.classList.add(`theme-${primaryColor}`);
  }, [darkMode, primaryColor]);

  // Fechar menu ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fechar menu ao mudar de rota
  useEffect(() => {
    setShowProfileMenu(false);
  }, [location]);

  const navItems = [
    { id: 'dashboard', label: t.nav.dashboard, path: '/dashboard', icon: LayoutDashboard },
    { id: 'plant', label: t.nav.plant, path: '/planta', icon: Factory },
    { id: 'alerts', label: t.nav.alerts, path: '/alertas', icon: Bell, badge: 3 },
    { id: 'equipment', label: t.nav.equipment, path: '/equipamentos', icon: Cpu },
    { id: 'assistant', label: t.nav.assistant, path: '/assistente', icon: Bot },
  ];

  return (
    <div className="flex flex-col h-screen bg-background text-foreground font-sans overflow-hidden transition-colors duration-300">
      {/* Navbar Superior */}
      <nav className="h-16 border-b border-border bg-card/80 backdrop-blur-md px-6 flex items-center justify-between z-40 sticky top-0">
        <div className="flex items-center gap-8 h-full">
          {/* Seção do Logo Linkable */}
          <Link to="/dashboard" className="flex items-center h-full hover:opacity-80 transition-opacity">
            <img 
              src={darkMode ? logoWhite : logoBlack} 
              alt="Forzy Logo" 
              className="h-8 w-auto object-contain"
            />
          </Link>

          {/* Links de Navegação */}
          <div className="flex items-center gap-1 h-full">
            {navItems.map((item) => (
              <NavLink
                key={item.id}
                to={item.path}
                className={({ isActive }) => `
                  h-full px-4 flex items-center gap-2 text-sm font-medium transition-all relative group
                  ${isActive ? 'text-foreground dark:text-white' : 'text-muted hover:text-foreground dark:hover:text-white'}
                `}
              >
                {({ isActive }) => (
                  <>
                    <item.icon size={16} className={isActive ? 'text-primary' : 'text-muted group-hover:text-foreground dark:group-hover:text-white'} />
                    {item.label}
                    {item.badge && (
                      <span className="ml-1 bg-red-500/20 text-red-400 text-[10px] font-bold px-1.5 py-0.5 rounded border border-red-500/30">
                        {item.badge}
                      </span>
                    )}
                    {isActive && (
                      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary shadow-[0_-4px_10px_rgba(var(--primary-rgb),0.5)]" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Status e Relógio */}
          <div className="hidden md:flex items-center gap-4">
            <div 
              className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse ring-4 ring-emerald-500/10" 
              title={t.common.system_online}
            />
            
            <div className="flex items-center gap-2 text-muted">
              <Clock size={14} />
              <span className="text-xs font-medium tabular-nums">
                {time.toLocaleTimeString(language === 'pt' ? 'pt-BR' : 'en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          <div className="h-6 w-px bg-border" />

          {/* Perfil do Usuário com Dropdown */}
          <div className="relative" ref={menuRef}>
            <button 
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-3 group"
            >
              <div className="flex flex-col items-end hidden sm:flex">
                <span className="text-xs font-semibold text-foreground dark:text-white group-hover:text-primary transition-colors">Gerente Técnico</span>
                <span className="text-[10px] text-muted font-medium">{language === 'pt' ? 'Administrador' : 'Administrator'}</span>
              </div>
              <div className="w-9 h-9 rounded-full border border-border bg-slate-800 flex items-center justify-center overflow-hidden group-hover:border-primary/50 transition-colors">
                <User size={18} className="text-muted group-hover:text-primary" />
              </div>
              <ChevronDown size={14} className={`text-muted transition-transform duration-200 ${showProfileMenu ? 'rotate-180' : ''}`} />
            </button>

            {/* Menu Dropdown */}
            {showProfileMenu && (
              <div className="absolute right-0 mt-3 w-56 bg-card border border-border rounded-xl shadow-panel animate-slide-in-top z-50 overflow-hidden">
                <div className="p-4 border-b border-border bg-slate-900/10">
                  <p className="text-xs font-bold text-foreground dark:text-white">Gerente Técnico</p>
                  <p className="text-[10px] text-muted mt-0.5">tecnico@forzy.com.br</p>
                </div>
                <div className="p-2">
                  <Link
                    to="/conta"
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted hover:text-foreground dark:hover:text-white hover:bg-slate-800/50 transition-all"
                  >
                    <User size={16} />
                    {t.nav.account}
                  </Link>
                  <Link
                    to="/configuracoes"
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted hover:text-foreground dark:hover:text-white hover:bg-slate-800/50 transition-all"
                  >
                    <Settings size={16} />
                    {t.nav.settings}
                  </Link>
                </div>
                <div className="p-2 border-t border-border bg-slate-900/10">
                  <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-500/10 transition-all">
                    <LogOut size={16} />
                    {t.nav.logout}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Conteúdo da Página */}
      <main className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-[1600px] mx-auto p-6 md:p-8">
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/planta" element={<PlantNavigation />} />
            <Route path="/alertas" element={<AlertsPage />} />
            <Route path="/equipamentos" element={<EquipmentPage />} />
            <Route path="/assistente" element={<AssistantPage />} />
            <Route path="/configuracoes" element={<SettingsPage />} />
            <Route path="/conta" element={<AccountPage />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </main>

      {/* Painel de Detalhes do Ativo Overlay */}
      {selectedAssetId && (
        <AssetDetailPanel
          assetId={selectedAssetId}
          onClose={() => setSelectedAsset(null)}
        />
      )}
    </div>
  );
};

export const App = () => (
  <Router>
    <AppContent />
  </Router>
);
