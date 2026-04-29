/**
 * Sprint 1 — Tela de leitura ao vivo (raw + convertido).
 *
 * Para cada sensor do MTR-001 mostra:
 *   • valor raw (mA) lido do "IoT"
 *   • valor convertido para a unidade física
 *   • status (normal / atenção / crítico / offline)
 *   • mini-gráfico das últimas leituras
 *
 * Atualiza a cada 2s via react-query polling (mesmo intervalo do mock).
 */
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  Gauge,
  PowerOff,
  Sparkles,
  Thermometer,
  TrendingUp,
  Waves,
  Zap,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { digitalTwinAPI } from '../services/digitalTwinAPI'
import { SensorDefinition, SensorReading } from '../types/digital-twin'
import { cn } from '../lib/utils'

const SENSOR_ICON: Record<string, typeof Activity> = {
  voltage: Zap,
  current: Activity,
  temperature: Thermometer,
  rpm: Gauge,
  vibration: Waves,
}

const STATUS_STYLES = {
  normal: {
    label: 'Normal',
    text: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/25',
    dot: 'bg-emerald-500',
  },
  warning: {
    label: 'Atenção',
    text: 'text-amber-500',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/25',
    dot: 'bg-amber-500',
  },
  critical: {
    label: 'Crítico',
    text: 'text-red-500',
    bg: 'bg-red-500/10',
    border: 'border-red-500/25',
    dot: 'bg-red-500',
  },
  offline: {
    label: 'Offline',
    text: 'text-slate-400',
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/25',
    dot: 'bg-slate-400',
  },
} as const

const TAG = 'MTR-001'

export const TelemetryPage: React.FC = () => {
  const { data: equipmentData } = useQuery({
    queryKey: ['equipment', TAG],
    queryFn: () => digitalTwinAPI.getEquipment(TAG),
    staleTime: 60_000,
  })

  const { data: latest, isLoading: loadingLatest } = useQuery({
    queryKey: ['latest', TAG],
    queryFn: () => digitalTwinAPI.getLatestReadings(TAG),
    refetchInterval: 2000,
    refetchIntervalInBackground: false,
  })

  const { data: history } = useQuery({
    queryKey: ['history-recent', TAG],
    queryFn: () =>
      digitalTwinAPI.getReadings({ tag: TAG, limit: 600 }),
    refetchInterval: 4000,
  })

  const equipment = equipmentData?.equipment
  const sensors = equipmentData?.sensors ?? []

  const latestBySensor = new Map<string, SensorReading>()
  for (const r of latest?.readings ?? []) latestBySensor.set(r.sensor_key, r)

  const historyBySensor = new Map<string, SensorReading[]>()
  for (const r of history ?? []) {
    const arr = historyBySensor.get(r.sensor_key) ?? []
    arr.push(r)
    historyBySensor.set(r.sensor_key, arr)
  }
  // recharts precisa em ordem cronológica
  for (const arr of historyBySensor.values()) {
    arr.sort((a, b) => a.ts.localeCompare(b.ts))
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-end md:justify-between gap-4"
      >
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-card-hover text-[10px] font-semibold uppercase tracking-wider text-muted mb-3">
            <Sparkles size={11} className="text-primary" />
            <span>Sprint 1 · Telemetria ao Vivo</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            {equipment?.name ?? 'Carregando…'}
          </h1>
          <p className="mt-1.5 text-sm">
            <span className="font-mono text-foreground-soft">{TAG}</span>
            {equipment?.modelo && (
              <>
                {' · '}
                {equipment.fabricante} {equipment.modelo}
              </>
            )}
            {equipment?.location && <> · {equipment.location}</>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-card-hover border border-border">
            <span className="live-dot" />
            <span className="text-foreground-soft">Dados ao Vivo</span>
            <span className="text-muted-soft font-mono text-[10px]">2s</span>
          </div>
        </div>
      </motion.div>

      {/* Sensor cards */}
      {loadingLatest && !latest ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="saas-card-premium p-6 h-48 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {sensors.map((def, idx) => (
            <SensorCard
              key={def.sensor_key}
              def={def}
              reading={latestBySensor.get(def.sensor_key) ?? null}
              history={historyBySensor.get(def.sensor_key) ?? []}
              delay={idx * 0.05}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface SensorCardProps {
  def: SensorDefinition
  reading: SensorReading | null
  history: SensorReading[]
  delay: number
}

const SensorCard: React.FC<SensorCardProps> = ({
  def,
  reading,
  history,
  delay,
}) => {
  const Icon = SENSOR_ICON[def.sensor_key] ?? Gauge
  const status = reading?.status ?? 'offline'
  const style = STATUS_STYLES[status]
  const isOffline = status === 'offline'

  const data = history.map((r) => ({
    ts: r.ts,
    value: r.value,
  }))

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="saas-card-premium p-6 relative overflow-hidden"
    >
      <div
        aria-hidden
        className={cn(
          'absolute -top-12 -right-12 w-40 h-40 rounded-full blur-3xl opacity-30',
          status === 'critical' && 'bg-red-500/40',
          status === 'warning' && 'bg-amber-500/40',
          status === 'normal' && 'bg-emerald-500/30',
          status === 'offline' && 'bg-slate-500/20',
        )}
      />

      <div className="relative flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'w-10 h-10 rounded-xl border flex items-center justify-center',
              style.bg,
              style.border,
              style.text,
            )}
          >
            {isOffline ? <PowerOff size={18} /> : <Icon size={18} />}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {def.display_name}
            </h3>
            <p className="text-[10px] uppercase tracking-wider text-muted-soft font-mono">
              {def.sensor_key}
            </p>
          </div>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border',
            style.bg,
            style.border,
            style.text,
          )}
        >
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full',
              style.dot,
              status === 'critical' && 'animate-pulse',
            )}
          />
          {style.label}
        </span>
      </div>

      <div className="relative grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-soft mb-1">
            Valor convertido
          </p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-foreground tabular-nums tracking-tight">
              {isOffline ? '—' : reading?.value.toFixed(2) ?? '—'}
            </span>
            <span className="text-sm font-medium text-muted-soft">
              {def.unit}
            </span>
          </div>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-soft mb-1">
            Raw {def.raw_unit}
          </p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-foreground-soft tabular-nums">
              {reading?.value_raw.toFixed(2) ?? '—'}
            </span>
            <span className="text-xs font-medium text-muted-soft">
              {def.raw_unit}
            </span>
          </div>
        </div>
      </div>

      <div className="relative h-20 -mx-2">
        {data.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient
                  id={`grad-${def.sensor_key}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor={
                      status === 'critical'
                        ? '#EF4444'
                        : status === 'warning'
                          ? '#F59E0B'
                          : '#10B981'
                    }
                    stopOpacity={0.4}
                  />
                  <stop
                    offset="95%"
                    stopColor={
                      status === 'critical'
                        ? '#EF4444'
                        : status === 'warning'
                          ? '#F59E0B'
                          : '#10B981'
                    }
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <XAxis dataKey="ts" hide />
              <YAxis
                hide
                domain={[def.physical_min, def.physical_max]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--card)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: '10px',
                  fontSize: 11,
                }}
                labelFormatter={(ts: string) =>
                  new Date(ts).toLocaleTimeString()
                }
                formatter={(value: number) => [
                  `${value.toFixed(2)} ${def.unit}`,
                  def.display_name,
                ]}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={
                  status === 'critical'
                    ? '#EF4444'
                    : status === 'warning'
                      ? '#F59E0B'
                      : '#10B981'
                }
                strokeWidth={1.5}
                fill={`url(#grad-${def.sensor_key})`}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-[11px] text-muted-soft">
            Aguardando histórico…
          </div>
        )}
      </div>

      <div className="relative pt-3 mt-3 border-t border-border flex items-center justify-between text-[10px] font-mono text-muted-soft">
        <span>
          range {def.physical_min}–{def.physical_max} {def.unit}
        </span>
        <span>
          {def.threshold_warn !== null && (
            <>
              alerta {def.threshold_warn}
              {' · '}
            </>
          )}
          {def.threshold_crit !== null && <>crítico {def.threshold_crit}</>}
        </span>
      </div>

      {status === 'critical' && (
        <div className="relative mt-3 flex items-center gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/25">
          <AlertTriangle size={12} className="text-red-500" />
          <span className="text-[11px] font-medium text-red-500">
            Valor acima do limite crítico
          </span>
        </div>
      )}
      {status === 'offline' && (
        <div className="relative mt-3 flex items-center gap-2 p-2 rounded-lg bg-slate-500/10 border border-slate-500/25">
          <PowerOff size={12} className="text-slate-400" />
          <span className="text-[11px] font-medium text-slate-400">
            Sensor desconectado (raw &lt; 4 mA)
          </span>
        </div>
      )}
      {status === 'normal' && reading && (
        <div className="relative mt-3 flex items-center gap-2 text-[10px] text-muted-soft">
          <TrendingUp size={11} />
          <span>
            atualizado {new Date(reading.ts).toLocaleTimeString()}
          </span>
        </div>
      )}
    </motion.div>
  )
}
