import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Activity, AlertCircle, AlertOctagon, Cpu, Factory, Radio, Zap } from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { KPICard } from '../components/Cards'
import { CardSkeleton, ChartSkeleton } from '../components/SkeletonLoaders'
import {
  apiService,
  FleetTrendRow,
  startFleetTelemetryUpdates,
  TelemetryRow,
} from '../services/api'
import { useAppStore } from '../store/appStore'
import { tooltipItemStyle, tooltipStyle } from '../theme'
import { translations } from '../translations'
import { STATUS_COLORS, statusLabel } from '../utils/plantStatus'

const COLORS = [
  '#f97316',
  '#8b5cf6',
  '#06b6d4',
  '#10b981',
  '#ef4444',
  '#3b82f6',
  '#eab308',
  '#ec4899',
]
const variants = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }
const locale = (language: 'pt' | 'en') => (language === 'pt' ? 'pt-BR' : 'en-US')
const shortTime = (iso: string, language: 'pt' | 'en') =>
  new Intl.DateTimeFormat(locale(language), { hour: '2-digit', minute: '2-digit' }).format(
    new Date(iso),
  )
const relativeAge = (iso: string, language: 'pt' | 'en') => {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return language === 'pt' ? `há ${seconds}s` : `${seconds}s ago`
  const minutes = Math.round(seconds / 60)
  return language === 'pt' ? `há ${minutes} min` : `${minutes}m ago`
}

export const Dashboard: React.FC = () => {
  const { assets, setAssets, kpis, setKPIs, language } = useAppStore()
  const [telemetry, setTelemetry] = useState<TelemetryRow[]>([])
  const [trend, setTrend] = useState<FleetTrendRow[]>([])
  const [minutes, setMinutes] = useState<15 | 60>(15)
  const [trendHours, setTrendHours] = useState<24 | 168>(24)
  const [metric, setMetric] = useState('Temperatura')
  const [loading, setLoading] = useState(true)
  const [chartsLoading, setChartsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const t = translations[language].dashboard

  const loadStructure = useCallback(async () => {
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
            ? 'Não foi possível carregar a operação.'
            : 'Could not load the operation.',
      )
    } finally {
      setLoading(false)
    }
  }, [language, setAssets, setKPIs])

  const loadCharts = useCallback(
    async (quiet = false) => {
      if (!quiet) setChartsLoading(true)
      try {
        const [rows, trendRows] = await Promise.all([
          apiService.getFleetTelemetry(minutes),
          apiService.getFleetTelemetryTrend(trendHours),
        ])
        setTelemetry(rows)
        setTrend(trendRows)
        setError(null)
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : language === 'pt'
              ? 'Não foi possível atualizar os gráficos.'
              : 'Could not refresh the charts.',
        )
      } finally {
        if (!quiet) setChartsLoading(false)
      }
    },
    [language, minutes, trendHours],
  )

  useEffect(() => {
    void loadStructure()
  }, [loadStructure])
  useEffect(() => {
    void loadCharts()
  }, [loadCharts])
  useEffect(
    () =>
      startFleetTelemetryUpdates(
        (rows) => {
          const cutoff = Date.now() - minutes * 60_000
          setTelemetry((current) =>
            [...current, ...rows].filter((row) => new Date(row.ts).getTime() >= cutoff),
          )
        },
        () => void loadCharts(true),
      ),
    [loadCharts, minutes],
  )

  const sensorMeta = useMemo(
    () =>
      new Map(
        assets.flatMap((asset) =>
          asset.sensors.map(
            (sensor) =>
              [
                sensor.id,
                {
                  assetTag: asset.tag,
                  name: sensor.name,
                  unit: sensor.unit,
                },
              ] as const,
          ),
        ),
      ),
    [assets],
  )
  const metrics = useMemo(
    () => [...new Set([...sensorMeta.values()].map((sensor) => sensor.name))].sort(),
    [sensorMeta],
  )
  useEffect(() => {
    if (metrics.length && !metrics.includes(metric)) setMetric(metrics[0])
  }, [metric, metrics])
  const selectedRows = useMemo(
    () => telemetry.filter((row) => sensorMeta.get(row.sensorId)?.name === metric),
    [metric, sensorMeta, telemetry],
  )
  const series = useMemo(
    () =>
      [
        ...new Set(
          selectedRows.map((row) => sensorMeta.get(row.sensorId)?.assetTag).filter(Boolean),
        ),
      ] as string[],
    [selectedRows, sensorMeta],
  )
  const liveData = useMemo(() => {
    const buckets = new Map<number, Record<string, number | string>>()
    selectedRows.forEach((row) => {
      const bucket = Math.floor(new Date(row.ts).getTime() / 5_000) * 5_000
      const point = buckets.get(bucket) ?? { ts: new Date(bucket).toISOString() }
      point[sensorMeta.get(row.sensorId)!.assetTag] = Number(row.value.toFixed(2))
      buckets.set(bucket, point)
    })
    return [...buckets.values()]
  }, [selectedRows, sensorMeta])
  const rangeData = useMemo(() => {
    const buckets = new Map<number, { ts: string; warning: number; critical: number }>()
    telemetry.forEach((row) => {
      const bucket = Math.floor(new Date(row.ts).getTime() / 60_000) * 60_000
      const point = buckets.get(bucket) ?? {
        ts: new Date(bucket).toISOString(),
        warning: 0,
        critical: 0,
      }
      if (row.status === 'warning') point.warning++
      if (row.status === 'critical') point.critical++
      buckets.set(bucket, point)
    })
    return [...buckets.values()]
  }, [telemetry])
  const trendData = useMemo(() => {
    const buckets = new Map<string, { ts: string; samples: number; critical: number }>()
    trend.forEach((row) => {
      const point = buckets.get(row.bucket) ?? { ts: row.bucket, samples: 0, critical: 0 }
      point.samples += row.sampleCount
      point.critical += row.criticalCount
      buckets.set(row.bucket, point)
    })
    return [...buckets.values()].map((point) => ({
      ts: point.ts,
      conformity: point.samples
        ? Number((((point.samples - point.critical) / point.samples) * 100).toFixed(1))
        : 0,
    }))
  }, [trend])
  const anomalyData = assets.map((asset) => ({
    name: asset.tag,
    anomaly: Number(asset.anomalyScore.toFixed(1)),
  }))
  const latestTs = telemetry[telemetry.length - 1]?.ts
  const stale = !latestTs || Date.now() - new Date(latestTs).getTime() > 90_000
  const statusCounts = (['normal', 'warning', 'critical', 'offline'] as const)
    .map((status) => ({ status, count: assets.filter((asset) => asset.status === status).length }))
    .filter(({ count }) => count)

  if (loading && !assets.length)
    return (
      <div className="space-y-6">
        <CardSkeleton count={4} />
        <ChartSkeleton height={330} />
        <ChartSkeleton height={260} />
      </div>
    )
  if (error && !assets.length)
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <AlertOctagon className="text-danger" />
        <p>{error}</p>
        <button className="btn-ghost" onClick={() => void loadStructure()}>
          {language === 'pt' ? 'Tentar novamente' : 'Try again'}
        </button>
      </div>
    )

  const EmptyChart = () => (
    <div className="flex h-[260px] items-center justify-center text-xs text-muted">
      {language === 'pt' ? 'Nenhuma leitura nesta janela.' : 'No readings in this window.'}
    </div>
  )
  const WindowButtons = ({ long = false }: { long?: boolean }) => (
    <div className="flex rounded-lg border border-border bg-card-hover p-0.5 text-[10px] font-semibold">
      {(long ? [24, 168] : [15, 60]).map((value) => (
        <button
          key={value}
          onClick={() => (long ? setTrendHours(value as 24 | 168) : setMinutes(value as 15 | 60))}
          className={`rounded-md px-2.5 py-1 ${(long ? trendHours : minutes) === value ? 'bg-primary text-white' : 'text-muted hover:text-foreground'}`}
        >
          {long ? (value === 24 ? '24 h' : '7 d') : `${value} min`}
        </button>
      ))}
    </div>
  )

  return (
    <motion.div
      initial="hidden"
      animate="show"
      transition={{ staggerChildren: 0.05 }}
      className="space-y-6"
    >
      <motion.header
        variants={variants}
        className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"
      >
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-card-hover px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
            <Radio size={11} className="text-primary" />
            Operations Console
          </div>
          <h1>{t.title}</h1>
          <p className="mt-1.5">
            {t.subtitle} · <b className="text-foreground-soft">{assets.length}</b> {t.tracked}
          </p>
        </div>
        <div
          className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold ${stale ? 'border-warning/30 bg-warning/10 text-warning' : 'border-success/20 bg-success/10 text-success'}`}
        >
          <span className={stale ? 'h-2 w-2 rounded-full bg-warning' : 'live-dot'} />
          {stale
            ? language === 'pt'
              ? 'Dados atrasados'
              : 'Delayed data'
            : language === 'pt'
              ? 'Ao vivo'
              : 'Live'}
          <span className="font-mono text-[10px] opacity-70">
            {latestTs ? relativeAge(latestTs, language) : '—'}
          </span>
        </div>
      </motion.header>
      {error && (
        <motion.div
          variants={variants}
          className="border-danger/20 bg-danger/10 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm text-danger"
        >
          <AlertOctagon size={16} />
          {error}
        </motion.div>
      )}
      {!assets.length ? (
        <div className="saas-card flex flex-col items-center gap-3 py-24 text-center">
          <Factory className="text-muted" />
          <p>{language === 'pt' ? 'Nenhum ativo cadastrado ainda' : 'No assets registered yet'}</p>
        </div>
      ) : (
        <>
          <motion.div
            variants={variants}
            data-tour="dashboard-kpis"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            <KPICard
              title={t.uptime}
              value={kpis?.totalUptime.toFixed(1) || '0'}
              unit="%"
              icon={Activity}
              accent="success"
            />
            <KPICard
              title={t.active_alerts}
              value={kpis?.activeAlerts || 0}
              icon={AlertCircle}
              accent="danger"
            />
            <KPICard
              title={t.anomalies}
              value={kpis?.anomaliesDetected || 0}
              icon={Zap}
              accent="warning"
            />
            <KPICard
              title={t.assets_online}
              value={`${kpis?.assetsOnline || 0}/${kpis?.totalAssets || 0}`}
              icon={Cpu}
              accent="info"
            />
          </motion.div>
          <motion.div variants={variants} className="saas-card px-4 py-3">
            <div className="mb-2 flex justify-between text-[10px] font-semibold uppercase tracking-wider text-muted">
              <span>{language === 'pt' ? 'Composição da frota' : 'Fleet composition'}</span>
              <span>
                {assets.length} {language === 'pt' ? 'ativos' : 'assets'}
              </span>
            </div>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-card-hover">
              {statusCounts.map(({ status, count }) => (
                <div
                  key={status}
                  style={{
                    width: `${(count / assets.length) * 100}%`,
                    background: STATUS_COLORS[status].fill,
                  }}
                  title={`${statusLabel(status, language)}: ${count}`}
                />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {statusCounts.map(({ status, count }) => (
                <span key={status} className="text-[10px] text-muted">
                  <b className="text-foreground-soft">{count}</b> {statusLabel(status, language)}
                </span>
              ))}
            </div>
          </motion.div>
          <motion.section
            variants={variants}
            data-tour="dashboard-charts"
            className="saas-card-premium p-4 sm:p-6"
          >
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <span className="section-title !mb-0">
                  {language === 'pt' ? 'Telemetria ao vivo' : 'Live telemetry'}
                </span>
                <p className="mt-1 text-[11px] text-muted">
                  {language === 'pt'
                    ? 'Leituras reais da frota, atualizadas sem recarregar'
                    : 'Real fleet readings, updated without reloading'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  aria-label={language === 'pt' ? 'Grandeza' : 'Metric'}
                  value={metric}
                  onChange={(event) => setMetric(event.target.value)}
                  className="rounded-lg border border-border bg-card-hover px-2.5 py-1 text-xs text-foreground"
                >
                  {metrics.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
                <WindowButtons />
              </div>
            </div>
            {chartsLoading ? (
              <ChartSkeleton height={300} />
            ) : !liveData.length ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={liveData} margin={{ left: -10, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.15} />
                  <XAxis
                    dataKey="ts"
                    tickFormatter={(value) => shortTime(value, language)}
                    minTickGap={35}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    unit={sensorMeta.get(selectedRows[0]?.sensorId)?.unit}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    itemStyle={tooltipItemStyle}
                    labelFormatter={(value) => new Date(value).toLocaleString(locale(language))}
                  />
                  <Legend />
                  {series.map((tag, index) => (
                    <Line
                      key={tag}
                      type="monotone"
                      dataKey={tag}
                      stroke={COLORS[index % COLORS.length]}
                      dot={false}
                      connectNulls
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </motion.section>
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <motion.section variants={variants} className="saas-card-premium p-4 sm:p-6">
              <span className="section-title">
                {language === 'pt' ? 'Fora de faixa no tempo' : 'Out of range over time'}
              </span>
              {chartsLoading ? (
                <ChartSkeleton height={250} />
              ) : !rangeData.length ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={rangeData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.15} />
                    <XAxis
                      dataKey="ts"
                      tickFormatter={(value) => shortTime(value, language)}
                      minTickGap={30}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelFormatter={(value) => new Date(value).toLocaleString(locale(language))}
                    />
                    <Legend />
                    <Bar
                      dataKey="warning"
                      stackId="range"
                      fill="#f59e0b"
                      name={language === 'pt' ? 'Alerta' : 'Warning'}
                    />
                    <Bar
                      dataKey="critical"
                      stackId="range"
                      fill="#ef4444"
                      radius={[4, 4, 0, 0]}
                      name={language === 'pt' ? 'Crítica' : 'Critical'}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </motion.section>
            <motion.section variants={variants} className="saas-card-premium p-4 sm:p-6">
              <span className="section-title">
                {language === 'pt' ? 'Anomalia por ativo' : 'Anomaly by asset'}
              </span>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={anomalyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.15} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar
                    dataKey="anomaly"
                    fill="#8b5cf6"
                    radius={[5, 5, 0, 0]}
                    name={language === 'pt' ? 'Anomalia %' : 'Anomaly %'}
                  />
                </BarChart>
              </ResponsiveContainer>
            </motion.section>
          </div>
          <motion.section variants={variants} className="saas-card-premium p-4 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <span className="section-title !mb-0">
                  {language === 'pt' ? 'Tendência da operação' : 'Operation trend'}
                </span>
                <p className="mt-1 text-[11px] text-muted">
                  {language === 'pt'
                    ? 'Conformidade horária calculada sobre a telemetria recebida'
                    : 'Hourly conformity calculated from received telemetry'}
                </p>
              </div>
              <WindowButtons long />
            </div>
            {chartsLoading ? (
              <ChartSkeleton height={250} />
            ) : !trendData.length ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={270}>
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="conformity" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.15} />
                  <XAxis
                    dataKey="ts"
                    tickFormatter={(value) => shortTime(value, language)}
                    minTickGap={35}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis domain={[0, 100]} unit="%" axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelFormatter={(value) => new Date(value).toLocaleString(locale(language))}
                  />
                  <Area
                    type="monotone"
                    dataKey="conformity"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fill="url(#conformity)"
                    name={language === 'pt' ? 'Conformidade %' : 'Conformity %'}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </motion.section>
        </>
      )}
    </motion.div>
  )
}
