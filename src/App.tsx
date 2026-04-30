import { useEffect, useState, useRef } from 'react'
import {
  BrowserRouter as Router,
  Routes,
  Route,
  NavLink,
  Navigate,
  useLocation,
  Link,
} from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
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
} from 'lucide-react'
import { useAppStore } from './store/appStore'
import { translations } from './translations'
import { useAuthStore } from './store/authStore'
import { apiService } from './services/api'
import { Dashboard } from './pages/Dashboard'
import { PlantNavigation } from './pages/PlantNavigation'
import { AlertsPage } from './pages/AlertsPage'
import { EquipmentPage } from './pages/EquipmentPage'
import { AssistantPage } from './pages/AssistantPage'
import { SettingsPage } from './pages/SettingsPage'
import { AccountPage } from './pages/AccountPage'
import { AssetDetailPanel } from './components/AssetDetailPanel'
import { LoginPage } from './pages/LoginPage'
import { TokenRefresher } from './components/TokenRefresher'
import logoWhite from './assets/logo-forzy-branca.svg'
import logoBlack from './assets/logo-forzy-preta.svg'
import { cn } from './lib/utils'

const AppContent = () => {
  const { selectedAssetId, setSelectedAsset, darkMode, primaryColor, language, alerts, setAlerts } =
    useAppStore()
  const { logout } = useAuthStore()
  const t = translations[language]

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('[auth] logout error:', error)
    }
  }

  const [time, setTime] = useState(new Date())
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const hasUserInteractedRef = useRef(false)
  const prevActionableAlertsCountRef = useRef(0)
  const location = useLocation()

  const playNotificationSound = (severity: 'critical' | 'warning') => {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return

    const context = new AudioCtx()
    const now = context.currentTime
    const baseFrequency = severity === 'critical' ? 920 : 740

    const playBeep = (start: number, duration: number, gainValue: number, freq: number) => {
      const oscillator = context.createOscillator()
      const gainNode = context.createGain()

      oscillator.type = 'triangle'
      oscillator.frequency.setValueAtTime(freq, start)
      gainNode.gain.setValueAtTime(0.0001, start)
      gainNode.gain.exponentialRampToValueAtTime(gainValue, start + 0.02)
      gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration)

      oscillator.connect(gainNode)
      gainNode.connect(context.destination)

      oscillator.start(start)
      oscillator.stop(start + duration)
    }

    playBeep(now, 0.17, 0.05, baseFrequency)
    playBeep(now + 0.2, 0.2, 0.06, baseFrequency * 1.12)

    window.setTimeout(() => {
      void context.close()
    }, 600)
  }

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const unlockAudio = () => {
      hasUserInteractedRef.current = true
    }

    window.addEventListener('pointerdown', unlockAudio, { once: true })
    window.addEventListener('keydown', unlockAudio, { once: true })

    return () => {
      window.removeEventListener('pointerdown', unlockAudio)
      window.removeEventListener('keydown', unlockAudio)
    }
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (darkMode) root.classList.add('dark')
    else root.classList.remove('dark')
    root.classList.remove('theme-orange', 'theme-purple')
    root.classList.add(`theme-${primaryColor}`)
  }, [darkMode, primaryColor])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    setShowProfileMenu(false)
  }, [location])

  useEffect(() => {
    let mounted = true

    const loadAlerts = async () => {
      try {
        const alertData = await apiService.getAlerts()
        if (!mounted) return

        setAlerts(alertData)

        const unresolvedAlerts = alertData.filter((alert) => !alert.resolved)
        const actionableAlerts = unresolvedAlerts.filter((alert) => alert.severity !== 'info')
        const actionableCount = actionableAlerts.length
        const previousCount = prevActionableAlertsCountRef.current

        if (actionableCount > previousCount && hasUserInteractedRef.current) {
          const hasCritical = actionableAlerts.some((alert) => alert.severity === 'critical')
          playNotificationSound(hasCritical ? 'critical' : 'warning')
        }

        prevActionableAlertsCountRef.current = actionableCount
      } catch {
        // Keep navbar resilient even if alert polling fails.
      }
    }

    void loadAlerts()
    const interval = setInterval(() => {
      void loadAlerts()
    }, 15000)

    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [setAlerts])

  const unresolvedAlerts = alerts.filter((alert) => !alert.resolved)
  const actionableAlerts = unresolvedAlerts.filter((alert) => alert.severity !== 'info')
  const criticalAlertsCount = actionableAlerts.filter((alert) => alert.severity === 'critical').length
  const hasActionableAlerts = actionableAlerts.length > 0
  const alertLevel: 'critical' | 'warning' | 'default' = criticalAlertsCount
    ? 'critical'
    : hasActionableAlerts
      ? 'warning'
      : 'default'

  const navItems = [
    { id: 'dashboard', label: t.nav.dashboard, path: '/dashboard', icon: LayoutDashboard },
    { id: 'plant', label: t.nav.plant, path: '/planta', icon: Factory },
    { id: 'equipment', label: t.nav.equipment, path: '/equipamentos', icon: Cpu },
    { id: 'assistant', label: t.nav.assistant, path: '/assistente', icon: Bot },
  ]

  return (
    <div className="flex flex-col h-screen bg-background text-foreground font-sans overflow-hidden">
      {/* Navbar */}
      <nav className="relative h-20 border-b border-border bg-background-elevated/80 backdrop-blur-xl px-4 md:px-6 flex items-center justify-between z-40 sticky top-0">
        {/* subtle bottom gradient */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-border-strong to-transparent"
        />

        <div className="flex items-center gap-6 md:gap-8 h-full">
          <Link
            to="/dashboard"
            className="flex items-center h-full transition-opacity hover:opacity-80"
          >
            <img
              src={darkMode ? logoWhite : logoBlack}
              alt="Forzy Logo"
              className="h-12 w-auto object-contain"
            />
          </Link>

          <div className="hidden md:flex items-center gap-0.5 h-full">
            {navItems.map((item) => (
              <NavLink
                key={item.id}
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    'group relative h-full px-3.5 flex items-center gap-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'text-foreground'
                      : 'text-muted hover:text-foreground-soft',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon
                      size={15}
                      className={cn(
                        'transition-colors',
                        isActive ? 'text-primary' : 'text-muted group-hover:text-foreground-soft',
                      )}
                      strokeWidth={2.2}
                    />
                    {item.label}
                    {isActive && (
                      <motion.div
                        layoutId="nav-active"
                        className="absolute bottom-0 left-2 right-2 h-[2px] bg-primary rounded-full"
                        style={{
                          boxShadow: '0 -2px 12px rgba(var(--primary-rgb), 0.5)',
                        }}
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-3 px-3 py-1.5 rounded-lg bg-card-hover border border-border">
            <span className="live-dot" />
            <div className="flex items-center gap-1.5 text-muted">
              <Clock size={12} />
              <span className="text-xs font-medium tabular-nums text-foreground-soft">
                {time.toLocaleTimeString(language === 'pt' ? 'pt-BR' : 'en-US', {
                  hour12: false,
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>

          <Link
            to="/alertas"
            aria-label={language === 'pt' ? 'Abrir alertas' : 'Open alerts'}
            title={language === 'pt' ? 'Centro de Alertas' : 'Alert Center'}
            className={cn(
              'hidden md:inline-flex relative items-center justify-center w-10 h-10 rounded-xl border transition-all duration-300',
              alertLevel === 'critical' &&
                'text-red-400 border-red-500/50 bg-red-500/10 shadow-[0_0_0_1px_rgba(239,68,68,0.2),0_0_20px_rgba(239,68,68,0.35)]',
              alertLevel === 'warning' &&
                'text-amber-400 border-amber-500/45 bg-amber-500/10 shadow-[0_0_0_1px_rgba(245,158,11,0.2),0_0_18px_rgba(245,158,11,0.3)]',
              alertLevel === 'default' &&
                'text-muted border-border bg-card hover:text-foreground-soft hover:border-border-strong',
            )}
          >
            <Bell
              size={16}
              strokeWidth={2.2}
              className={cn(
                hasActionableAlerts && 'origin-top animate-[bell-ring_3.2s_ease-in-out_infinite]',
              )}
            />

            {unresolvedAlerts.length > 0 && (
              <span
                className={cn(
                  'absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold inline-flex items-center justify-center text-white',
                  alertLevel === 'critical' && 'bg-red-500 border border-red-500/50',
                  alertLevel === 'warning' && 'bg-amber-500 border border-amber-500/50',
                  alertLevel === 'default' && 'bg-card border border-border',
                )}
              >
                {unresolvedAlerts.length > 99 ? '99+' : unresolvedAlerts.length}
              </span>
            )}

          </Link>

          <div className="hidden md:block h-6 w-px bg-border" />

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="group flex items-center gap-3 rounded-xl pr-2 pl-1 py-1 hover:bg-card-hover transition-colors"
            >
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-xs font-semibold text-foreground transition-colors">
                  Gerente Técnico
                </span>
                <span className="text-[10px] text-muted-soft font-medium">
                  {language === 'pt' ? 'Administrador' : 'Administrator'}
                </span>
              </div>
              <div className="relative w-9 h-9 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/30 flex items-center justify-center overflow-hidden">
                <User size={16} className="text-primary" strokeWidth={2.2} />
              </div>
              <ChevronDown
                size={14}
                className={cn(
                  'text-muted transition-transform duration-200',
                  showProfileMenu && 'rotate-180',
                )}
              />
            </button>

            <AnimatePresence>
              {showProfileMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-3 w-64 bg-card border border-border rounded-2xl shadow-panel z-50 overflow-hidden"
                >
                  <div className="p-4 border-b border-border bg-gradient-to-br from-card-hover to-card">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/40 to-primary/10 border border-primary/30 flex items-center justify-center">
                        <User size={18} className="text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          Gerente Técnico
                        </p>
                        <p className="text-[11px] text-muted">tecnico@forzy.com.br</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-1.5">
                    <Link
                      to="/conta"
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground-soft hover:text-foreground hover:bg-card-hover transition-all"
                    >
                      <User size={15} className="text-muted" />
                      {t.nav.account}
                    </Link>
                    <Link
                      to="/configuracoes"
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground-soft hover:text-foreground hover:bg-card-hover transition-all"
                    >
                      <Settings size={15} className="text-muted" />
                      {t.nav.settings}
                    </Link>
                  </div>
                  <div className="p-1.5 border-t border-border">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-500/10 transition-all"
                    >
                      <LogOut size={15} />
                      {t.nav.logout}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </nav>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-[1600px] mx-auto p-6 md:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <Routes location={location}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/planta" element={<PlantNavigation />} />
                <Route path="/alertas" element={<AlertsPage />} />
                <Route path="/equipamentos" element={<EquipmentPage />} />
                <Route path="/assistente" element={<AssistantPage />} />
                <Route path="/configuracoes" element={<SettingsPage />} />
                <Route path="/conta" element={<AccountPage />} />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {selectedAssetId && (
        <AssetDetailPanel
          assetId={selectedAssetId}
          onClose={() => setSelectedAsset(null)}
        />
      )}
    </div>
  )
}

export function App() {
  const { isAuthenticated, verifyAuth, isLoading, accessToken } = useAuthStore()

  useEffect(() => {
    // Verifica em background. Se já temos token, a UI não bloqueia.
    verifyAuth()
  }, [verifyAuth])

  // Só mostra a tela de loading quando NÃO temos sessão hidratada.
  if (isLoading && !accessToken) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#07080D] relative overflow-hidden">
        <div className="mesh-bg" aria-hidden />
        <div className="relative text-center">
          <div className="relative mx-auto w-16 h-16">
            <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
            <div className="absolute inset-0 blur-xl bg-primary/30 animate-pulse rounded-full" />
          </div>
          <p className="mt-6 text-white/70 text-sm font-medium tracking-wide">
            Autenticando sessão…
          </p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginPage />
  }

  return (
    <Router>
      <TokenRefresher>
        <AppContent />
      </TokenRefresher>
    </Router>
  )
}

export default App
