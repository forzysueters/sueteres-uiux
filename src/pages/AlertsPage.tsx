import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { AlertItem } from '../components/AlertItem';
import { Bell, Search } from 'lucide-react';
import { apiService } from '../services/api';
import { translations } from '../translations';

export const AlertsPage: React.FC = () => {
  const { alerts, setAlerts, language } = useAppStore();
  const t = translations[language];
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'resolved'>('all');
  const [search, setSearch] = useState('');
  const [resolvingAlertId, setResolvingAlertId] = useState<string | null>(null);

  const severityRank = (severity: 'info' | 'warning' | 'critical') => {
    if (severity === 'critical') return 0;
    if (severity === 'warning') return 1;
    return 2;
  };

  const sortAlertsForDisplay = (items: typeof alerts) => {
    const unresolvedAlerts = items
      .filter((alert) => !alert.resolved)
      .sort((a, b) => {
        const urgencyDelta = severityRank(a.severity) - severityRank(b.severity);
        if (urgencyDelta !== 0) {
          return urgencyDelta;
        }

        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });

    const resolvedAlerts = items
      .filter((alert) => alert.resolved)
      .sort((a, b) => {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });

    return [...unresolvedAlerts, ...resolvedAlerts];
  };

  const handleResolveAlert = async (alertId: string) => {
    setResolvingAlertId(alertId);
    try {
      await apiService.resolveAlert(alertId);
      setAlerts(
        alerts.map((alert) =>
          alert.id === alertId
            ? { ...alert, resolved: true, resolvedAt: new Date().toISOString() }
            : alert,
        ),
      );
    } finally {
      setResolvingAlertId(null);
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    const matchesFilter = 
      filter === 'all' || 
      (filter === 'critical' && alert.severity === 'critical') ||
      (filter === 'warning' && alert.severity === 'warning') ||
      (filter === 'resolved' && alert.resolved);
    
    const matchesSearch = alert.assetName.toLowerCase().includes(search.toLowerCase()) ||
                         alert.title.toLowerCase().includes(search.toLowerCase()) ||
                         alert.description.toLowerCase().includes(search.toLowerCase());
    
    return matchesFilter && matchesSearch;
  });

  const sortedAlerts = sortAlertsForDisplay(filteredAlerts);

  const stats = {
    total: alerts.filter(a => !a.resolved).length,
    critical: alerts.filter(a => a.severity === 'critical' && !a.resolved).length,
    active: alerts.filter(a => !a.resolved).length,
    resolved: alerts.filter(a => a.resolved).length,
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1>{t.alerts.title}</h1>
          <p>
            {t.alerts.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
            <input
              type="text"
              placeholder={t.alerts.search_placeholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:border-primary/50 transition-all w-64"
            />
          </div>
        </div>
      </div>

      <div className="saas-card overflow-hidden">
        <div className="border-b border-border bg-slate-900/10 px-6 flex items-center gap-6">
          {[
            { id: 'all', label: t.alerts.all, count: stats.total },
            { id: 'critical', label: t.alerts.critical, count: stats.critical },
            { id: 'warning', label: t.alerts.warnings, count: alerts.filter(a => a.severity === 'warning' && !a.resolved).length },
            { id: 'resolved', label: t.alerts.resolved, count: stats.resolved },
          ].map(({ id, label, count }) => {
            const isActive = filter === id;
            return (
              <button
                key={id}
                onClick={() => setFilter(id as any)}
                className={`py-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest relative transition-all ${
                  isActive ? 'text-primary' : 'text-muted hover:text-foreground dark:hover:text-white'
                }`}
              >
                {label}
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${isActive ? 'bg-primary text-white' : 'bg-slate-800 text-muted'}`}>
                  {count}
                </span>
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />
                )}
              </button>
            );
          })}
        </div>

        <div className="p-4 md:p-5 space-y-4">
          {sortedAlerts.length > 0 ? (
            sortedAlerts.map(alert => (
              <AlertItem
                key={alert.id}
                alert={alert}
                onResolve={handleResolveAlert}
                isResolving={resolvingAlertId === alert.id}
              />
            ))
          ) : (
            <div className="p-20 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-slate-900/50 flex items-center justify-center mb-4">
                <Bell size={24} className="text-muted" />
              </div>
              <h3 className="text-foreground dark:text-white">{t.alerts.no_alerts}</h3>
              <p className="max-w-xs mx-auto mt-1">
                {t.alerts.no_alerts_desc}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
