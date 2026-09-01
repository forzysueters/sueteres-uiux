import { useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { supabase, describeSupabaseError } from '../lib/supabase'
import {
  Lock,
  Mail,
  AlertCircle,
  ArrowRight,
  Activity,
  Cpu,
  ShieldCheck,
  Sparkles,
  Eye,
  EyeOff,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { LoginCredentials } from '../types/auth'
import logoWhite from '../assets/logo-forzy-branca.svg'

export const LoginPage = () => {
  const { login, isLoading, error } = useAuthStore()
  const [credentials, setCredentials] = useState<LoginCredentials>({
    email: '',
    password: '',
  })
  const [localError, setLocalError] = useState<string | null>(null)
  const [showDemo, setShowDemo] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [resetSending, setResetSending] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setCredentials((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)

    if (!credentials.email || !credentials.password) {
      setLocalError('Informe e-mail e senha para continuar')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(credentials.email)) {
      setLocalError('Informe um endereço de e-mail válido')
      return
    }
    if (credentials.password.length < 8) {
      setLocalError('A senha deve ter pelo menos 8 caracteres')
      return
    }

    try {
      await login(credentials)
    } catch (err: any) {
      setLocalError(err.message || 'Falha no acesso. Tente novamente.')
    }
  }

  const demoCredentials = [
    { role: 'Administrador (Forzy)', email: 'admin@industrial.com', password: 'password123' },
    { role: 'Engenheiro', email: 'engineer@industrial.com', password: 'password123' },
    { role: 'Técnico de Manutenção', email: 'technician@industrial.com', password: 'password123' },
  ]

  const handleDemoLogin = (email: string) => {
    setCredentials({ email, password: 'password123' })
  }

  const handleForgotPassword = async () => {
    setLocalError(null)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(credentials.email)) {
      setLocalError('Informe seu e-mail no campo acima para recuperar a senha')
      return
    }
    setResetSending(true)
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(credentials.email, {
        redirectTo: window.location.origin,
      })
      if (resetError) throw resetError
      toast.success(`Enviamos um link de recuperação para ${credentials.email}`)
    } catch (err) {
      setLocalError(describeSupabaseError(err, 'Não foi possível enviar o e-mail de recuperação.'))
    } finally {
      setResetSending(false)
    }
  }

  const features = [
    {
      icon: Activity,
      label: 'Monitoramento em tempo real',
      desc: 'Sensores IoT do motor — tensão, corrente, vibração, temperatura',
    },
    {
      icon: Cpu,
      label: 'Manutenção preditiva',
      desc: 'Detecção de anomalias e predição de paradas estratégicas',
    },
    {
      icon: ShieldCheck,
      label: 'Governança & LGPD',
      desc: 'Acesso por perfil, rastreabilidade e auditoria',
    },
  ]

  return (
    <div className="min-h-screen w-full overflow-hidden bg-[#07080D] text-white relative isolate">
      {/* Animated mesh background */}
      <div className="mesh-bg" aria-hidden />

      {/* Grid pattern */}
      <div
        className="absolute inset-0 grid-pattern opacity-60 pointer-events-none"
        aria-hidden
      />

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between px-5 md:px-10 h-20 sm:h-28">
        <img src={logoWhite} alt="Forzy" className="h-11 sm:h-16 md:h-20 w-auto drop-shadow-[0_0_28px_rgba(245,158,11,0.3)]" />
        <div className="hidden md:flex items-center gap-2 text-xs font-medium text-white/60">
          <span className="live-dot" />
          <span>Plataforma operacional · Online</span>
        </div>
      </header>

      <main className="relative z-10 grid lg:grid-cols-[1.1fr_minmax(0,440px)] gap-12 lg:gap-20 items-center px-4 sm:px-6 md:px-10 lg:px-16 pb-10 sm:pb-16">
        {/* ─── Left: pitch ─── */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="hidden lg:block max-w-2xl"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-md text-xs font-medium text-white/80 mb-8">
            <Sparkles size={13} className="text-amber-400" />
            <span>Forzy · Plataforma de Gêmeo Digital</span>
          </div>

          <h1 className="text-5xl xl:text-6xl font-bold tracking-tight leading-[1.05] mb-6 text-white">
            Seus motores industriais,{' '}
            <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-orange-500 bg-clip-text text-transparent">
              conectados, monitorados e preditivos.
            </span>
          </h1>

          <p className="text-lg text-white/60 leading-relaxed mb-12 max-w-xl">
            Conecte sensores, antecipe falhas e planeje paradas estratégicas em uma
            única plataforma. Do dado bruto ao diagnóstico inteligente — com IoT, IA
            e governança.
          </p>

          <div className="grid sm:grid-cols-3 gap-4 max-w-2xl">
            {features.map((f, i) => (
              <motion.div
                key={f.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.08, duration: 0.5 }}
                className="group relative rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-md p-5 hover:bg-white/[0.04] transition-colors"
              >
                <div className="absolute inset-x-6 -top-px h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 border border-amber-500/20 flex items-center justify-center mb-4">
                  <f.icon size={18} className="text-amber-400" />
                </div>
                <p className="text-sm font-semibold text-white mb-1">{f.label}</p>
                <p className="text-xs text-white/50 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>

          <div className="mt-12 flex items-center gap-6 text-xs text-white/40">
            <span>Uma empresa Promon · Engenharia desde 1960</span>
            <div className="h-px flex-1 bg-white/10" />
            <span className="font-mono tracking-widest">FORZY · DIGITAL TWIN</span>
          </div>
        </motion.section>

        {/* ─── Right: login card ─── */}
        <motion.section
          initial={{ opacity: 0, scale: 0.97, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          className="w-full max-w-[440px] mx-auto lg:mx-0"
        >
          <div className="relative">
            {/* gradient border */}
            <div className="absolute -inset-px rounded-3xl bg-gradient-to-br from-amber-500/40 via-white/5 to-transparent opacity-80 pointer-events-none" />
            <div className="relative rounded-3xl bg-[#0B0D14]/90 backdrop-blur-2xl border border-white/[0.06] p-5 sm:p-8 md:p-10 shadow-[0_32px_80px_-12px_rgba(0,0,0,0.7)]">
              {/* Logo on small screens */}
              <div className="lg:hidden mb-6 sm:mb-8 flex justify-center">
                <img src={logoWhite} alt="Forzy" className="h-12 sm:h-16 w-auto" />
              </div>

              <div className="mb-8">
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight mb-2">
                  Acesse sua plataforma
                </h2>
                <p className="text-sm text-white/50">
                  Entre com suas credenciais para abrir o console operacional
                </p>
              </div>

              {(error || localError) && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 p-3.5 bg-red-500/10 border border-red-500/25 rounded-xl flex gap-3"
                >
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-red-300 text-xs leading-relaxed">{error || localError}</p>
                </motion.div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-2"
                  >
                    E-mail corporativo
                  </label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 group-focus-within:text-amber-400 transition-colors" />
                    <input
                      type="email"
                      id="email"
                      name="email"
                      autoComplete="email"
                      value={credentials.email}
                      onChange={handleChange}
                      placeholder="seu.nome@empresa.com.br"
                      disabled={isLoading}
                      className="w-full pl-11 pr-4 py-3.5 bg-white/[0.03] border border-white/10 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-amber-400/40 focus:bg-white/[0.05] focus:shadow-[0_0_0_4px_rgba(245,158,11,0.08)] transition-all disabled:opacity-50"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label
                      htmlFor="password"
                      className="block text-[11px] font-semibold uppercase tracking-wider text-white/50"
                    >
                      Senha
                    </label>
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={resetSending}
                      className="text-[11px] font-medium text-white/50 hover:text-amber-400 transition-colors disabled:opacity-50"
                    >
                      {resetSending ? 'Enviando…' : 'Esqueci minha senha'}
                    </button>
                  </div>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 group-focus-within:text-amber-400 transition-colors" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      name="password"
                      autoComplete="current-password"
                      value={credentials.password}
                      onChange={handleChange}
                      placeholder="••••••••"
                      disabled={isLoading}
                      className="w-full pl-11 pr-11 py-3.5 bg-white/[0.03] border border-white/10 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-amber-400/40 focus:bg-white/[0.05] focus:shadow-[0_0_0_4px_rgba(245,158,11,0.08)] transition-all disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="group relative w-full mt-2 py-3.5 rounded-xl font-semibold text-sm text-white overflow-hidden transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{
                    background:
                      'linear-gradient(135deg, #F59E0B 0%, #FB923C 100%)',
                    boxShadow:
                      '0 1px 0 0 rgba(255,255,255,0.25) inset, 0 12px 32px -8px rgba(245,158,11,0.6)',
                  }}
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                  <span className="relative flex items-center justify-center gap-2">
                    {isLoading ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                          />
                          <path
                            className="opacity-90"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                        Autenticando…
                      </>
                    ) : (
                      <>
                        Entrar na plataforma
                        <ArrowRight
                          size={16}
                          className="group-hover:translate-x-0.5 transition-transform"
                        />
                      </>
                    )}
                  </span>
                </button>
              </form>

              <button
                type="button"
                onClick={() => setShowDemo(!showDemo)}
                className="w-full mt-7 pt-5 border-t border-white/5 text-center text-[11px] font-medium text-white/40 hover:text-white/70 transition-colors"
              >
                {showDemo ? '— Ocultar credenciais de demonstração —' : '— Ver credenciais de demonstração —'}
              </button>

              {showDemo && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-4 space-y-2 overflow-hidden"
                >
                  {demoCredentials.map((cred) => (
                    <button
                      key={cred.email}
                      onClick={() => handleDemoLogin(cred.email)}
                      type="button"
                      className="w-full text-left p-3 bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-white/10 rounded-xl transition-all group"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white/90 group-hover:text-amber-400 transition-colors">
                            {cred.role}
                          </p>
                          <p className="text-[11px] text-white/40 font-mono break-all">
                            {cred.email}
                          </p>
                        </div>
                        <ArrowRight
                          size={14}
                          className="flex-shrink-0 text-white/30 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all"
                        />
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </div>
          </div>

          <p className="mt-6 text-center text-[11px] text-white/30">
            Acesso protegido por criptografia e auditoria · © Forzy {new Date().getFullYear()} · Uma empresa Promon
          </p>
        </motion.section>
      </main>
    </div>
  )
}
