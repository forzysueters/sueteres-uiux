import React from 'react'
import { motion } from 'framer-motion'
import {
  LucideIcon,
  TrendingUp,
  TrendingDown,
  Activity,
  Factory,
  Tag,
  Trash2,
} from 'lucide-react'
import { Asset } from '../types'
import { cn } from '../lib/utils'
import { statusBadge, statusLabel } from '../utils/plantStatus'
import { useAppStore } from '../store/appStore'
import { translations } from '../translations'

interface KPICardProps {
  title: string
  value: string | number
  unit?: string
  icon: LucideIcon
  trend?: number
  accent?: 'primary' | 'success' | 'warning' | 'danger' | 'info'
}

const accentMap: Record<NonNullable<KPICardProps['accent']>, { glow: string; iconBg: string; iconText: string }> = {
  primary: {
    glow: 'rgba(var(--primary-rgb), 0.18)',
    iconBg: 'bg-gradient-to-br from-amber-500/15 to-amber-500/5 border-amber-500/20',
    iconText: 'text-amber-500',
  },
  success: {
    glow: 'rgba(16, 185, 129, 0.18)',
    iconBg: 'bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 border-emerald-500/20',
    iconText: 'text-emerald-500',
  },
  warning: {
    glow: 'rgba(245, 158, 11, 0.18)',
    iconBg: 'bg-gradient-to-br from-amber-500/15 to-amber-500/5 border-amber-500/20',
    iconText: 'text-amber-500',
  },
  danger: {
    glow: 'rgba(239, 68, 68, 0.18)',
    iconBg: 'bg-gradient-to-br from-red-500/15 to-red-500/5 border-red-500/20',
    iconText: 'text-red-500',
  },
  info: {
    glow: 'rgba(59, 130, 246, 0.18)',
    iconBg: 'bg-gradient-to-br from-blue-500/15 to-blue-500/5 border-blue-500/20',
    iconText: 'text-blue-500',
  },
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  unit,
  icon: Icon,
  trend,
  accent = 'primary',
}) => {
  const styles = accentMap[accent]

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2 }}
      className="group relative saas-card-premium p-4 sm:p-5 overflow-hidden"
    >
      {/* Decorative glow on hover */}
      <div
        aria-hidden
        className="absolute -top-16 -right-16 w-40 h-40 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: styles.glow }}
      />

      <div className="relative flex items-start justify-between mb-5">
        <div
          className={cn(
            'w-10 h-10 rounded-xl border flex items-center justify-center',
            styles.iconBg,
            styles.iconText,
          )}
        >
          <Icon size={18} strokeWidth={2.2} />
        </div>
        {trend !== undefined && (
          <div
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold',
              trend >= 0
                ? 'bg-emerald-500/10 text-emerald-500'
                : 'bg-red-500/10 text-red-500',
            )}
          >
            {trend >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>

      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted mb-2">
        {title}
      </p>
      <div className="flex flex-wrap items-baseline gap-1.5">
        <span className="text-2xl sm:text-3xl font-bold text-foreground tabular-nums tracking-tight break-all">
          {value}
        </span>
        {unit && <span className="text-sm font-medium text-muted-soft">{unit}</span>}
      </div>
    </motion.div>
  )
}

interface AssetTileProps {
  asset: Asset
  isSelected: boolean
  onClick: (id: string) => void
  /** Quando presente, mostra a ação de remover no hover (admin/engenheiro). */
  onRemove?: (asset: Asset) => void
}

export const AssetTile: React.FC<AssetTileProps> = ({ asset, isSelected, onClick, onRemove }) => {
  const { language } = useAppStore()
  const cfg = statusBadge(asset.status)
  const label = statusLabel(asset.status, language)
  const removeLabel = translations[language].assetRemoval.action_remove

  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2 }}
      onClick={() => onClick(asset.id)}
      className={cn(
        'group relative saas-card saas-card-hover cursor-pointer p-4 sm:p-5 overflow-hidden',
        'before:content-[""] before:absolute before:left-0 before:top-3 before:bottom-3 before:w-[3px] before:rounded-r-full',
        cfg.before,
        isSelected && cn('ring-2', cfg.ring, cfg.glow),
      )}
    >
      {/* Top sheen */}
      <div
        aria-hidden
        className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
      />

      <div className="flex items-start justify-between mb-4">
        <div
          className={cn(
            'w-11 h-11 rounded-xl border flex items-center justify-center transition-colors',
            isSelected
              ? 'bg-primary/15 border-primary/30 text-primary'
              : 'bg-card-hover border-border text-muted group-hover:text-foreground',
          )}
        >
          <Factory size={20} strokeWidth={2} />
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className="badge bg-card-hover border-border">
            <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot, 'animate-pulse')} />
            <span className={cfg.text}>{label}</span>
          </div>
          {onRemove && (
            <button
              // O card inteiro navega para o ativo; sem parar a propagação, o
              // clique na lixeira abriria a página em vez do diálogo.
              onClick={(e) => { e.stopPropagation(); onRemove(asset) }}
              title={removeLabel}
              aria-label={removeLabel}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 focus:opacity-100 group-hover:opacity-100"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-1">
        <h4 className="font-semibold text-sm text-foreground truncate flex-1">{asset.name}</h4>
        {asset.tag && (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-card-hover border border-border text-[9px] font-bold text-primary font-mono flex-shrink-0">
            <Tag size={8} />
            {asset.tag}
          </span>
        )}
      </div>
      <p className="text-[10px] text-muted-soft font-medium uppercase tracking-wider mb-4">
        {asset.location}
      </p>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 pt-3 border-t border-border">
        <div>
          <span className="text-[9px] font-bold text-muted-soft uppercase tracking-wider">Uptime</span>
          <p className="text-sm font-bold text-foreground tabular-nums">{asset.uptime.toFixed(1)}%</p>
        </div>
        <div>
          <span className="text-[9px] font-bold text-muted-soft uppercase tracking-wider">Sensores</span>
          <p className="text-sm font-bold text-foreground tabular-nums">{asset.sensors.length}</p>
        </div>
      </div>

      {asset.anomalyScore > 40 && (
        <div className="mt-3 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
          <Activity size={12} className="text-red-500 animate-pulse" />
          <span className="text-[10px] font-bold text-red-500">
            Anomalia: {asset.anomalyScore}%
          </span>
        </div>
      )}
    </motion.div>
  )
}
