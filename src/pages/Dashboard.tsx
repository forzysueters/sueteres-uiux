import { useEffect, useState } from 'react';
import { Activity, AlertCircle, Zap, Cpu, TrendingUp } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { translations } from '../translations';
import { apiService } from '../services/api';
import { KPICard } from '../components/Cards';
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
} from 'recharts';

const STATUS_COLORS: Record<string, string> = {
  Normal: '#10b981',
  Alerta: '#f59e0b',
  Crítico: '#ef4444',
  Offline: '#4d6080',
};

export const Dashboard: React.FC = () => {
  const { assets, setAssets, kpis, setKPIs, language } = useAppStore();
  const [loading, setLoading] = useState(true);

  const t = translations[language].dashboard;
  const common = translations[language].common;

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [assetsData, kpiData] = await Promise.all([
        apiService.getAssets(),
        apiService.getKPIMetrics(),
      ]);
      setAssets(assetsData);
      setKPIs(kpiData);
    } finally {
      setLoading(false);
    }
  };

  const assetStatusData = [
    { name: 'Normal', value: assets.filter(a => a.status === 'normal').length },
    { name: language === 'pt' ? 'Alerta' : 'Warning', value: assets.filter(a => a.status === 'warning').length },
    { name: language === 'pt' ? 'Crítico' : 'Critical', value: assets.filter(a => a.status === 'critical').length },
    { name: 'Offline', value: assets.filter(a => a.status === 'offline').length },
  ].filter(d => d.value > 0);

  const uptimeData = assets.map(a => ({
    name: a.name.length > 10 ? a.name.substring(0, 10) + '…' : a.name,
    uptime: parseFloat(a.uptime.toFixed(2)),
  }));

  const anomalyData = assets.map(a => ({
    name: a.name.length > 10 ? a.name.substring(0, 10) + '…' : a.name,
    anomaly: parseFloat(a.anomalyScore.toFixed(1)),
  }));

  if (loading && assets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 py-20">
        <Activity className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm font-medium text-muted">{common.loading}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1>{t.title}</h1>
          <p>
            {t.subtitle} · {assets.length} {t.tracked}
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 border border-border text-primary">
          <TrendingUp className="w-3.5 h-3.5" />
          {language === 'pt' ? 'Dados ao Vivo' : 'Live Data'}
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        <KPICard
          title={t.uptime}
          value={kpis?.totalUptime.toFixed(1) || '0'}
          unit="%"
          icon={Activity}
          trend={2.3}
        />
        <KPICard
          title={t.active_alerts}
          value={kpis?.activeAlerts || 0}
          icon={AlertCircle}
          trend={-1.2}
        />
        <KPICard
          title={t.anomalies}
          value={kpis?.anomaliesDetected || 0}
          icon={Zap}
          trend={5}
        />
        <KPICard
          title={t.assets_online}
          value={`${kpis?.assetsOnline || 0}/${kpis?.totalAssets || 0}`}
          icon={Cpu}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="saas-card p-6">
          <span className="section-title">{t.status_distribution}</span>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={assetStatusData}
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={95}
                paddingAngle={4}
                dataKey="value"
                stroke="none"
              >
                {assetStatusData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={STATUS_COLORS[entry.name] || STATUS_COLORS['Normal']}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#111827', border: '1px solid #1F2937', borderRadius: '8px' }}
                itemStyle={{ fontSize: '12px', fontWeight: 600 }}
              />
              <Legend
                formatter={(value) => <span className="text-xs font-medium text-muted">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="saas-card p-6">
          <span className="section-title">{t.anomaly_index}</span>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={anomalyData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#111827', border: '1px solid #1F2937', borderRadius: '8px' }}
                cursor={{ fill: 'rgba(var(--primary-rgb),0.02)' }} 
              />
              <Bar dataKey="anomaly" fill="var(--primary)" radius={[4, 4, 0, 0]} name={language === 'pt' ? 'Anomalia %' : 'Anomaly %'} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="saas-card p-6">
        <span className="section-title">{t.performance_trend}</span>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={uptimeData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
            <defs>
              <linearGradient id="uptimeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
            <XAxis dataKey="name" axisLine={false} tickLine={false} />
            <YAxis axisLine={false} tickLine={false} domain={[85, 100]} />
            <Tooltip
              contentStyle={{ backgroundColor: '#111827', border: '1px solid #1F2937', borderRadius: '8px' }}
            />
            <Area
              type="monotone"
              dataKey="uptime"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#uptimeGrad)"
              dot={false}
              activeDot={{ r: 4, fill: '#10b981', stroke: '#0B1220', strokeWidth: 2 }}
              name="Uptime %"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-4">
        <span className="section-title">{t.critical_summary}</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {assets.slice(0, 4).map((asset) => {
            const statusColors: Record<string, { border: string; text: string; label: string }> = {
              critical: { border: 'border-l-red-500', text: 'text-red-500', label: language === 'pt' ? 'Crítico' : 'Critical' },
              warning: { border: 'border-l-amber-500', text: 'text-amber-500', label: language === 'pt' ? 'Alerta' : 'Warning' },
              normal: { border: 'border-l-emerald-500', text: 'text-emerald-500', label: 'Normal' },
              offline: { border: 'border-l-slate-500', text: 'text-slate-500', label: 'Offline' },
            };
            const sc = statusColors[asset.status] ?? statusColors.normal;

            return (
              <div
                key={asset.id}
                className={`saas-card p-4 border-l-4 ${sc.border}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-bold text-sm text-foreground dark:text-white truncate">{asset.name}</h4>
                  <span className={`text-[9px] font-bold uppercase tracking-wider ${sc.text}`}>{sc.label}</span>
                </div>
                <p className="text-[10px] text-muted mb-3 truncate">{asset.location}</p>
                <div className="flex justify-between items-center text-[10px] font-bold">
                  <span className="text-foreground dark:text-white">{asset.uptime.toFixed(1)}% {language === 'pt' ? 'Disponibilidade' : 'Availability'}</span>
                  <span className="text-muted">{asset.sensors.length} {language === 'pt' ? 'sensores' : 'sensors'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
