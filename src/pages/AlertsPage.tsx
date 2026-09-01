import { useState } from 'react';
import { AlertItem } from '../components/AlertItem';
import { useAlerts } from '../hooks/useAlerts';
import { useAppStore } from '../store/appStore';
import { translations } from '../translations';
import { Bell, AlertTriangle, ShieldAlert, CheckCircle2, Search } from 'lucide-react';
import { cn } from '../lib/utils';

export const AlertsPage: React.FC = () => {
  const { alerts, resolveAlert } = useAlerts();
  const { language } = useAppStore();
  const t = translations[language].alerts;
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'resolved'>('all');
  const [search, setSearch] = useState('');

  const filteredAlerts = alerts.filter(alert => {
    const matchesFilter =
      filter === 'all' ||
      (filter === 'critical' && alert.severity === 'critical') ||
      (filter === 'warning' && alert.severity === 'warning') ||
      (filter === 'resolved' && alert.resolved);

    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      alert.assetName.toLowerCase().includes(q) ||
      alert.description.toLowerCase().includes(q) ||
      alert.title.toLowerCase().includes(q) ||
      alert.assetTag.toLowerCase().includes(q);

    return matchesFilter && matchesSearch;
  });

  const stats = {
    total: alerts.length,
    critical: alerts.filter(a => a.severity === 'critical').length,
    warning: alerts.filter(a => a.severity === 'warning').length,
    active: alerts.filter(a => !a.resolved).length,
    resolved: alerts.filter(a => a.resolved).length,
  };

  const tabs = [
    { id: 'all' as const, label: t.tab_all, count: stats.total },
    { id: 'critical' as const, label: t.tab_critical, count: stats.critical },
    { id: 'warning' as const, label: t.tab_warning, count: stats.warning },
    { id: 'resolved' as const, label: t.tab_resolved, count: stats.resolved },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1>{t.title}</h1>
          <p>{t.subtitle}</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
          <input
            type="text"
            placeholder={t.search_placeholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:border-primary/50 transition-all w-full lg:w-72"
          />
        </div>
      </div>

      {/* Toolbar: stat strip + tab filter, one visual row — não duas caixas empilhadas */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
        <div className="saas-card flex items-center gap-5 px-5 py-3 overflow-x-auto">
          {[
            { label: t.total, value: stats.total, icon: Bell, color: 'text-primary' },
            { label: t.critical, value: stats.critical, icon: ShieldAlert, color: 'text-danger' },
            { label: t.active, value: stats.active, icon: AlertTriangle, color: 'text-warning' },
            { label: t.resolved, value: stats.resolved, icon: CheckCircle2, color: 'text-success' },
          ].map(({ label, value, icon: Icon, color }, i) => (
            <div key={label} className={cn('flex items-center gap-2 flex-shrink-0', i > 0 && 'pl-5 border-l border-border')}>
              <Icon size={14} className={color} />
              <span className="text-lg font-bold text-foreground tabular-nums">{value}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted whitespace-nowrap">{label}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-card border border-border flex-shrink-0">
          {tabs.map(({ id, label, count }) => {
            const isActive = filter === id;
            return (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                  isActive ? 'bg-primary text-white' : 'text-muted hover:text-foreground',
                )}
              >
                {label}
                <span className={cn('text-[10px] font-bold', isActive ? 'text-white/75' : 'text-muted-soft')}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      {filteredAlerts.length > 0 ? (
        <div className="space-y-3">
          {filteredAlerts.map(alert => (
            <AlertItem key={alert.id} alert={alert} onResolve={resolveAlert} />
          ))}
        </div>
      ) : (
        <div className="saas-card flex flex-col items-center justify-center text-center py-16">
          <div className="w-12 h-12 rounded-xl bg-card-hover border border-border flex items-center justify-center mb-3 text-muted">
            <Bell size={20} />
          </div>
          <h3 className="text-foreground">{t.empty_title}</h3>
          <p className="max-w-xs mx-auto mt-1 text-muted text-sm">{t.empty_desc}</p>
        </div>
      )}
    </div>
  );
};
