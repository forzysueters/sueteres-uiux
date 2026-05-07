import { useEffect, useState } from 'react'
import { motion, type Variants } from 'framer-motion'
import { Activity, AlertCircle, Zap, Cpu, TrendingUp, Sparkles } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { translations } from '../translations'
import { apiService } from '../services/api'
import { KPICard } from '../components/Cards'
import { cn } from '../lib/utils'
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

const STATUS_COLORS: Record<string, string> = {
  Normal: '#10B981',
  Alerta: '#F59E0B',
  Warning: '#F59E0B',
  Crítico: '#EF4444',
  Critical: '#EF4444',
  Offline: '#64748B',
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
}

export const Dashboard: React.FC = () => {
  const { assets, setAssets, kpis, setKPIs, language } = useAppStore()
  const [loading, setLoading] = useState(true)

  const t = translations[language].dashboard
  const common = translations[language].common

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
    } finally {
      setLoading(false)
    }
  }

  const assetStatusData = [
    { name: 'Normal', value: assets.filter((a) => a.status === 'normal').length },
    {
      name: language === 'pt' ? 'Alerta' : 'Warning',
      value: assets.filter((a) => a.status === 'warning').length,
    },
    {
      name: language === 'pt' ? 'Crítico' : 'Critical',
      value: assets.filter((a) => a.status === 'critical').length,
    },
    { name: 'Offline', value: assets.filter((a) => a.status === 'offline').length },
  ].filter((d) => d.value > 0)

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
      <div className="flex flex-col items-center justify-center h-full gap-4 py-20">
        <div className="relative">
          <Activity className="w-10 h-10 text-primary animate-spin" />
          <div className="absolute inset-0 blur-xl bg-primary/30 animate-pulse" />
        </div>
        <p className="text-sm font-medium text-muted">{common.loading}</p>
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
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{t.title}</h1>
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
          <button className="btn-ghost text-xs">
            <TrendingUp size={14} />
            {language === 'pt' ? 'Relatório' : 'Report'}
          </button>
        </div>
      </motion.div>

      {/* KPI grid */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5"
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
        className="grid grid-cols-1 lg:grid-cols-5 gap-5"
      >
        {/* Pie */}
        <div className="saas-card-premium p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <span className="section-title !mb-0">{t.status_distribution}</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <defs>
                {Object.entries(STATUS_COLORS).map(([name, color]) => (
                  <linearGradient
                    id={`pie-${name}`}
                    key={name}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor={color} stopOpacity={1} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.6} />
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
                  <Cell
                    key={`cell-${index}`}
                    fill={`url(#pie-${entry.name in STATUS_COLORS ? entry.name : 'Normal'})`}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--card)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: '12px',
                  boxShadow: '0 12px 32px -8px rgba(0,0,0,0.5)',
                }}
                itemStyle={{ fontSize: '12px', fontWeight: 600 }}
              />
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
        <div className="saas-card-premium p-6 lg:col-span-3">
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
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--card)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: '12px',
                }}
                cursor={{ fill: 'rgba(var(--primary-rgb),0.04)' }}
              />
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
      <motion.div variants={itemVariants} className="saas-card-premium p-6">
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
            <YAxis axisLine={false} tickLine={false} domain={[85, 100]} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--card)',
                border: '1px solid var(--border-strong)',
                borderRadius: '12px',
              }}
            />
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
          <button className="text-[11px] font-semibold text-muted hover:text-primary transition-colors">
            {language === 'pt' ? 'Ver todos →' : 'View all →'}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {assets.slice(0, 4).map((asset, i) => {
            const statusColors: Record<
              string,
              { ring: string; text: string; label: string; dot: string }
            > = {
              critical: {
                ring: 'before:bg-red-500',
                text: 'text-red-500',
                label: language === 'pt' ? 'Crítico' : 'Critical',
                dot: 'bg-red-500',
              },
              warning: {
                ring: 'before:bg-amber-500',
                text: 'text-amber-500',
                label: language === 'pt' ? 'Alerta' : 'Warning',
                dot: 'bg-amber-500',
              },
              normal: {
                ring: 'before:bg-emerald-500',
                text: 'text-emerald-500',
                label: 'Normal',
                dot: 'bg-emerald-500',
              },
              offline: {
                ring: 'before:bg-slate-500',
                text: 'text-slate-500',
                label: 'Offline',
                dot: 'bg-slate-500',
              },
            }
            const sc = statusColors[asset.status] ?? statusColors.normal

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
                  sc.ring,
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-semibold text-sm text-foreground truncate">
                    {asset.name}
                  </h4>
                  <span
                    className={cn(
                      'flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider',
                      sc.text,
                    )}
                  >
                    <span className={cn('w-1.5 h-1.5 rounded-full animate-pulse', sc.dot)} />
                    {sc.label}
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
    </motion.div>
  )
}
