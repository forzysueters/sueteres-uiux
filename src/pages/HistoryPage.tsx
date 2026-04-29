/**
 * Sprint 1 — Histórico Operacional.
 *
 * Filtros:
 *   • sensor (default: voltage)
 *   • janela de tempo (10 min / 1 h / 6 h / 24 h)
 * Saída:
 *   • gráfico de área temporal
 *   • estatísticas básicas (min, max, média, último)
 *   • exportação CSV
 */
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Download, History, Sparkles } from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { digitalTwinAPI } from '../services/digitalTwinAPI'
import { cn } from '../lib/utils'

const TAG = 'MTR-001'

type Window = '10m' | '1h' | '6h' | '24h'

const WINDOW_MS: Record<Window, number> = {
  '10m': 10 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
}

const WINDOW_LIMIT: Record<Window, number> = {
  '10m': 300,
  '1h': 1800,
  '6h': 4000,
  '24h': 5000,
}

export const HistoryPage: React.FC = () => {
  const [sensorKey, setSensorKey] = useState<string>('voltage')
  const [window, setWindow] = useState<Window>('1h')

  const { data: equipmentData } = useQuery({
    queryKey: ['equipment', TAG],
    queryFn: () => digitalTwinAPI.getEquipment(TAG),
  })

  const sensors = equipmentData?.sensors ?? []
  const def = sensors.find((s) => s.sensor_key === sensorKey)

  const from = useMemo(
    () => new Date(Date.now() - WINDOW_MS[window]).toISOString(),
    [window],
  )

  const { data: readings, isLoading } = useQuery({
    queryKey: ['history', TAG, sensorKey, window],
    queryFn: () =>
      digitalTwinAPI.getReadings({
        tag: TAG,
        sensor_key: sensorKey,
        from,
        limit: WINDOW_LIMIT[window],
      }),
    refetchInterval: 5000,
  })

  const stats = useMemo(() => {
    if (!readings || !readings.length) return null
    let min = Infinity
    let max = -Infinity
    let sum = 0
    let valid = 0
    for (const r of readings) {
      if (r.status === 'offline') continue
      min = Math.min(min, r.value)
      max = Math.max(max, r.value)
      sum += r.value
      valid += 1
    }
    if (!valid) return null
    return {
      min,
      max,
      avg: sum / valid,
      last: readings[readings.length - 1].value,
      count: readings.length,
    }
  }, [readings])

  const chartData =
    readings?.map((r) => ({ ts: r.ts, value: r.value, status: r.status })) ??
    []

  const downloadCSV = () => {
    if (!readings) return
    const header =
      'timestamp,sensor_key,value_raw_mA,value,unit,status,is_simulated\n'
    const body = readings
      .map(
        (r) =>
          `${r.ts},${r.sensor_key},${r.value_raw},${r.value},${r.unit},${r.status},${r.is_simulated}`,
      )
      .join('\n')
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${TAG}-${sensorKey}-${window}-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-end md:justify-between gap-4"
      >
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-card-hover text-[10px] font-semibold uppercase tracking-wider text-muted mb-3">
            <Sparkles size={11} className="text-primary" />
            <span>Sprint 1 · Histórico Operacional</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Histórico do Ativo
          </h1>
          <p className="mt-1.5 text-sm">
            Séries temporais convertidas. Base que sustentará anomaly detection
            (Sprint 3).
          </p>
        </div>
        <button onClick={downloadCSV} className="btn-ghost text-xs">
          <Download size={14} />
          Exportar CSV
        </button>
      </motion.div>

      <div className="saas-card-premium p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
            Sensor:
          </span>
          {sensors.map((s) => (
            <button
              key={s.sensor_key}
              onClick={() => setSensorKey(s.sensor_key)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                sensorKey === s.sensor_key
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-card-hover border-border text-muted hover:text-foreground-soft',
              )}
            >
              {s.display_name}{' '}
              <span className="text-muted-soft">({s.unit})</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
            Janela:
          </span>
          {(['10m', '1h', '6h', '24h'] as Window[]).map((w) => (
            <button
              key={w}
              onClick={() => setWindow(w)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                window === w
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-card-hover border-border text-muted hover:text-foreground-soft',
              )}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Última leitura" value={stats.last} unit={def?.unit} />
          <Stat label="Média" value={stats.avg} unit={def?.unit} />
          <Stat label="Mínimo" value={stats.min} unit={def?.unit} />
          <Stat label="Máximo" value={stats.max} unit={def?.unit} />
        </div>
      )}

      <div className="saas-card-premium p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History size={16} className="text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-foreground">
              {def?.display_name ?? 'Sensor'} · janela {window}
            </span>
          </div>
          <span className="text-[10px] text-muted-soft font-mono">
            {readings?.length ?? 0} pontos
          </span>
        </div>
        <ResponsiveContainer width="100%" height={360}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="historyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="rgb(var(--primary-rgb))"
                  stopOpacity={0.45}
                />
                <stop
                  offset="95%"
                  stopColor="rgb(var(--primary-rgb))"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.15} />
            <XAxis
              dataKey="ts"
              axisLine={false}
              tickLine={false}
              tickFormatter={(ts: string) =>
                new Date(ts).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              }
              minTickGap={40}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              domain={[
                def?.physical_min ?? 'auto',
                def?.physical_max ?? 'auto',
              ]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--card)',
                border: '1px solid var(--border-strong)',
                borderRadius: '12px',
              }}
              labelFormatter={(ts: string) =>
                new Date(ts).toLocaleString()
              }
              formatter={(value: number) => [
                `${value.toFixed(2)} ${def?.unit ?? ''}`,
                def?.display_name ?? 'valor',
              ]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="rgb(var(--primary-rgb))"
              strokeWidth={2}
              fill="url(#historyGrad)"
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
        {isLoading && !readings && (
          <p className="text-xs text-muted-soft text-center py-4">
            Carregando histórico…
          </p>
        )}
      </div>
    </div>
  )
}

const Stat: React.FC<{
  label: string
  value: number
  unit?: string
}> = ({ label, value, unit }) => (
  <div className="saas-card-premium p-4">
    <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">
      {label}
    </p>
    <div className="flex items-baseline gap-1.5">
      <span className="text-2xl font-bold text-foreground tabular-nums">
        {value.toFixed(2)}
      </span>
      {unit && <span className="text-xs text-muted-soft">{unit}</span>}
    </div>
  </div>
)
