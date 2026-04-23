import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { apiService } from '../services/api';
import { Alert } from '../types';
import { AlertItem } from '../components/AlertItem';
import { AlertCircle, TrendingDown } from 'lucide-react';

export const AlertsPage: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'critical' | 'warning' | 'info'>('active');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAlerts();
    const interval = setInterval(loadAlerts, 3000);
    return () => clearInterval(interval);
  }, []);

  const loadAlerts = async () => {
    setLoading(false);
    const data = await apiService.getAlerts();
    setAlerts(data);
  };

  const handleResolveAlert = async (alertId: string) => {
    await apiService.resolveAlert(alertId);
    setAlerts(alerts.map(a => a.id === alertId ? { ...a, resolved: true } : a));
  };

  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'all') return true;
    if (filter === 'active') return !alert.resolved;
    return alert.severity === filter && !alert.resolved;
  });

  const stats = {
    total: alerts.length,
    active: alerts.filter(a => !a.resolved).length,
    critical: alerts.filter(a => a.severity === 'critical' && !a.resolved).length,
    resolved: alerts.filter(a => a.resolved).length,
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide">Total Alerts</p>
          <p className="text-2xl font-bold text-slate-100 mt-1">{stats.total}</p>
        </div>
        <div className="bg-slate-800/50 border border-red-500/20 rounded-lg p-4 border-l-4 border-l-red-500">
          <p className="text-xs text-slate-400 uppercase tracking-wide">Critical</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{stats.critical}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide">Active</p>
          <p className="text-2xl font-bold text-yellow-400 mt-1">{stats.active}</p>
        </div>
        <div className="bg-slate-800/50 border border-green-500/20 rounded-lg p-4 border-l-4 border-l-green-500">
          <p className="text-xs text-slate-400 uppercase tracking-wide">Resolved</p>
          <p className="text-2xl font-bold text-green-400 mt-1">{stats.resolved}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'active', 'critical', 'warning', 'info'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Alerts List */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <p>Loading alerts...</p>
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
          <TrendingDown className="w-8 h-8 mb-2 opacity-50" />
          <p className="text-sm">No alerts found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map(alert => (
            <AlertItem key={alert.id} alert={alert} onResolve={handleResolveAlert} />
          ))}
        </div>
      )}
    </div>
  );
};
