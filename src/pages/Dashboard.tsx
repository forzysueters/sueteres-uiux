import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Activity, AlertCircle, Zap, Cpu, Sparkles, AlertOctagon, Factory } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { translations } from '../translations'
import { apiService } from '../services/api'
import { KPICard } from '../components/Cards'
import { cn } from '../lib/utils'
import { STATUS_COLORS, statusBadge, statusLabel } from '../utils/plantStatus'
import { CardSkeleton, ChartSkeleton } from '../components/SkeletonLoaders'
import { tooltipStyle, tooltipItemStyle } from '../theme'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts'

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
}

export const Dashboard: React.FC = () => {
  const { assets, setAssets, kpis, setKPIs, language } = useAppStore()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const t = translations[language].dashboard

  useEffect(() => {
    loadDashboardData()
    const interval = setInterval(loadDashboardData, 5000)
    return () => clearInterval(interval)
  }, [])

  const loadDashboardData = async () => {
    setLoading(true)
    try {
      const [assetsData, kpiData] = await Promise.all([
        apiService.getAssets(),
        apiService.getKPIMetrics(),
      ])
      setAssets(assetsData)
      setKPIs(kpiData)
      setError(null)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : language === 'pt'
            ? 'Não foi possível carregar os dados da operação.'
            : 'Could not load operation data.',
      )
    } finally {
      setLoading(false)
    }
  }

  const assetStatusData = (['normal', 'warning', 'critical', 'offline'] as const)
    .map((status) => ({
      status,
      name: statusLabel(status, language),
      value: assets.filter((a) => a.status === status).length,
    }))
    .filter((d) => d.value > 0)

  const uptimeData = assets.map((a) => ({
    name: a.name.length > 10 ? a.name.substring(0, 10) + '…' : a.name,
    uptime: parseFloat(a.uptime.toFixed(2)),
  }))

  const anomalyData = assets.map((a) => ({
    name: a.name.length > 10 ? a.name.substring(0, 10) + '…' : a.name,
    anomaly: parseFloat(a.anomalyScore.toFixed(1)),
  }))

  if (loading && assets.length === 0) {
    return (
      <div className="space-y-8">
        <CardSkeleton count={4} />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className="lg:col-span-2"><ChartSkeleton height={280} /></div>
          <div className="lg:col-span-3"><ChartSkeleton height={280} /></div>
        </div>
        <ChartSkeleton height={220} />
      </div>
    )
  }

  if (error && assets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <div className="w-12 h-12 rounded-xl bg-danger/10 border border-danger/20 flex items-center justify-center text-danger">
          <AlertOctagon size={22} />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{error}</p>
          <p className="text-xs text-muted mt-1">
            {language === 'pt' ? 'Verifique sua conexão e tente novamente.' : 'Check your connection and try again.'}
          </p>
        </div>
        <button onClick={loadDashboardData} className="btn-ghost text-xs">
          {language === 'pt' ? 'Tentar novamente' : 'Try again'}
        </button>
      </div>
    )
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-8"
    >
      {/* Header */}
      <motion.div
        variants={itemVariants}
        className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-6 pb-2"
      >
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-card-hover text-[10px] font-semibold uppercase tracking-wider text-muted mb-3">
            <Sparkles size={11} className="text-primary" />
            <span>Operations Console</span>
          </div>
          <h1>{t.title}</h1>
          <p className="mt-1.5">
            {t.subtitle} · <span className="font-semibold text-foreground-soft tabular-nums">{assets.length}</span> {t.tracked}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-card-hover border border-border">
            <span className="live-dot" />
            <span className="text-foreground-soft">
              {language === 'pt' ? 'Dados ao Vivo' : 'Live Data'}
            </span>
            <span className="text-muted-soft font-mono text-[10px]">5s</span>
          </div>
        </div>
      </motion.div>

      {error && (
        <motion.div
          variants={itemVariants}
          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-danger/10 border border-danger/20 text-sm text-danger"
        >
          <AlertOctagon size={16} className="flex-shrink-0" />
          <span>{error}</span>
        </motion.div>
      )}

      {assets.length === 0 && !error ? (
        <motion.div
          variants={itemVariants}
          className="saas-card flex flex-col items-center justify-center gap-3 py-24 text-center"
        >
          <div className="w-12 h-12 rounded-xl bg-card-hover border border-border flex items-center justify-center text-muted">
            <Factory size={22} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {language === 'pt' ? 'Nenhum ativo cadastrado ainda' : 'No assets registered yet'}
            </p>
            <p className="text-xs text-muted mt-1">
              {language === 'pt'
                ? 'Cadastre um equipamento para começar a monitorar a operação.'
                : 'Register an equipment to start monitoring the operation.'}
            </p>
          </div>
        </motion.div>
      ) : (
      <>
      {/* KPI grid */}
      <motion.div
        variants={itemVariants}
        data-tour="dashboard-kpis"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5"
      >
        <KPICard
          title={t.uptime}
          value={kpis?.totalUptime.toFixed(1) || '0'}
          unit="%"
          icon={Activity}
          trend={2.3}
          accent="success"
        />
        <KPICard
          title={t.active_alerts}
          value={kpis?.activeAlerts || 0}
          icon={AlertCircle}
          trend={-1.2}
          accent="danger"
        />
        <KPICard
          title={t.anomalies}
          value={kpis?.anomaliesDetected || 0}
          icon={Zap}
          trend={5}
          accent="warning"
        />
        <KPICard
          title={t.assets_online}
          value={`${kpis?.assetsOnline || 0}/${kpis?.totalAssets || 0}`}
          icon={Cpu}
          accent="info"
        />
      </motion.div>

      {/* Charts row */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-5"
      >
        {/* Pie */}
        <div className="saas-card-premium p-4 sm:p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <span className="section-title !mb-0">{t.status_distribution}</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <defs>
                {Object.entries(STATUS_COLORS).map(([status, cfg]) => (
                  <linearGradient
                    id={`pie-${status}`}
                    key={status}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor={cfg.fill} stopOpacity={1} />
                    <stop offset="100%" stopColor={cfg.fill} stopOpacity={0.6} />
                  </linearGradient>
                ))}
              </defs>
              <Pie
                data={assetStatusData}
                cx="50%"
                cy="50%"
                innerRadius={62}
                outerRadius={92}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {assetStatusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={`url(#pie-${entry.status})`} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} />
              <Legend
                iconType="circle"
                formatter={(value) => (
                  <span className="text-xs font-medium text-muted">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Bar */}
        <div className="saas-card-premium p-4 sm:p-6 lg:col-span-3">
          <span className="section-title">{t.anomaly_index}</span>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={anomalyData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
              <defs>
                <linearGradient id="anomalyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(var(--primary-rgb))" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="rgb(var(--primary-rgb))" stopOpacity={0.4} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.15} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(var(--primary-rgb),0.04)' }} />
              <Bar
                dataKey="anomaly"
                fill="url(#anomalyGrad)"
                radius={[6, 6, 0, 0]}
                name={language === 'pt' ? 'Anomalia %' : 'Anomaly %'}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Trend area */}
      <motion.div variants={itemVariants} className="saas-card-premium p-4 sm:p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="section-title !mb-0">{t.performance_trend}</span>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider">
            <span className="flex items-center gap-1.5 text-emerald-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Uptime
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={uptimeData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
            <defs>
              <linearGradient id="uptimeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.15} />
            <XAxis dataKey="name" axisLine={false} tickLine={false} />
            {/* O piso fixo em 85 não segurava: com um ativo abaixo disso o
                Recharts estende o domínio até o dado e os tiques viravam
                80,97 / 85,97 / 90,97 / 100 — quebrados e desiguais no topo.
                Arredondar o piso para baixo, de 5 em 5, devolve a escala
                inteira sem cortar nenhuma barra. */}
            <YAxis
              axisLine={false}
              tickLine={false}
              domain={[(dataMin: number) => Math.floor(dataMin / 5) * 5, 100]}
              allowDecimals={false}
            />
            <Tooltip contentStyle={tooltipStyle} />
            <Area
              type="monotone"
              dataKey="uptime"
              stroke="#10b981"
              strokeWidth={2.5}
              fill="url(#uptimeGrad)"
              dot={false}
              activeDot={{
                r: 5,
                fill: '#10b981',
                stroke: 'var(--background)',
                strokeWidth: 3,
              }}
              name="Uptime %"
            />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Critical summary tiles */}
      <motion.div variants={itemVariants} className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="section-title !mb-0">{t.critical_summary}</span>
          <button
            onClick={() => navigate('/alertas')}
            className="text-[11px] font-semibold text-muted hover:text-primary transition-colors"
          >
            {language === 'pt' ? 'Ver todos →' : 'View all →'}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {assets.slice(0, 4).map((asset, i) => {
            const sc = statusBadge(asset.status)

            return (
              <motion.div
                key={asset.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ y: -2 }}
                className={cn(
                  'group relative saas-card saas-card-hover p-4 cursor-pointer',
                  'before:content-[""] before:absolute before:left-0 before:top-3 before:bottom-3 before:w-[3px] before:rounded-r-full',
                  sc.before,
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <h4 className="min-w-0 flex-1 font-semibold text-sm text-foreground truncate">
                    {asset.name}
                  </h4>
                  <span
                    className={cn(
                      'flex flex-shrink-0 items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider',
                      sc.text,
                    )}
                  >
                    <span className={cn('w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0', sc.dot)} />
                    {statusLabel(asset.status, language)}
                  </span>
                </div>
                <p className="text-[10px] text-muted-soft uppercase tracking-wider mb-3 truncate">
                  {asset.location}
                </p>
                <div className="flex justify-between items-center pt-3 border-t border-border">
                  <span className="text-[11px] font-bold text-foreground tabular-nums">
                    {asset.uptime.toFixed(1)}%{' '}
                    <span className="font-medium text-muted-soft">
                      {language === 'pt' ? 'Disp.' : 'Avail.'}
                    </span>
                  </span>
                  <span className="text-[10px] font-medium text-muted">
                    {asset.sensors.length} {language === 'pt' ? 'sensores' : 'sensors'}
                  </span>
                </div>
              </motion.div>
            )
          })}
        </div>
      </motion.div>
      </>
      )}
    </motion.div>
  )
}
