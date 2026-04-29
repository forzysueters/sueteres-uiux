import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { AlertItem } from '../components/AlertItem';
import { Bell, AlertTriangle, CheckCircle2, ShieldAlert, Search, Filter } from 'lucide-react';

export const AlertsPage: React.FC = () => {
  const { alerts } = useAppStore();
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'resolved'>('all');
  const [search, setSearch] = useState('');

  const filteredAlerts = alerts.filter(alert => {
    const matchesFilter = 
      filter === 'all' || 
      (filter === 'critical' && alert.severity === 'critical') ||
      (filter === 'warning' && alert.severity === 'warning') ||
      (filter === 'resolved' && alert.status === 'resolved');
    
    const matchesSearch = alert.assetName.toLowerCase().includes(search.toLowerCase()) ||
                         alert.message.toLowerCase().includes(search.toLowerCase());
    
    return matchesFilter && matchesSearch;
  });

  const stats = {
    total: alerts.length,
    critical: alerts.filter(a => a.severity === 'critical').length,
    active: alerts.filter(a => a.status === 'active').length,
    resolved: alerts.filter(a => a.status === 'resolved').length,
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1>Centro de Alertas</h1>
          <p>
            Gerencie anomalias críticas e notificações de manutenção
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
            <input
              type="text"
              placeholder="Buscar alertas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:border-primary/50 transition-all w-64"
            />
          </div>
          <button className="p-2 rounded-lg bg-card border border-border text-muted hover:text-white transition-colors">
            <Filter size={18} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total de Alertas', value: stats.total, icon: Bell, color: 'text-primary' },
          { label: 'Críticos', value: stats.critical, icon: ShieldAlert, color: 'text-red-500' },
          { label: 'Ativos', value: stats.active, icon: AlertTriangle, color: 'text-amber-500' },
          { label: 'Resolvidos', value: stats.resolved, icon: CheckCircle2, color: 'text-emerald-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="saas-card p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider">{label}</span>
              <Icon size={16} className={color} />
            </div>
            <p className="text-2xl font-bold text-foreground dark:text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="saas-card overflow-hidden">
        <div className="border-b border-border bg-slate-900/10 px-6 flex items-center gap-6">
          {[
            { id: 'all', label: 'Todos', count: stats.total },
            { id: 'critical', label: 'Críticos', count: stats.critical },
            { id: 'warning', label: 'Alertas', count: alerts.filter(a => a.severity === 'warning').length },
            { id: 'resolved', label: 'Resolvidos', count: stats.resolved },
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

        <div className="divide-y divide-border">
          {filteredAlerts.length > 0 ? (
            filteredAlerts.map(alert => (
              <AlertItem key={alert.id} alert={alert} />
            ))
          ) : (
            <div className="p-20 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-slate-900/50 flex items-center justify-center mb-4">
                <Bell size={24} className="text-muted" />
              </div>
              <h3 className="text-foreground dark:text-white">Nenhum alerta encontrado</h3>
              <p className="max-w-xs mx-auto mt-1">
                Tente ajustar seus filtros ou busca para encontrar o que procura.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
