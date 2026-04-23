import React, { useEffect, useState } from 'react';
import { Activity, AlertCircle, Zap, Cpu } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { apiService } from '../services/api';
import { KPICard } from '../components/Cards';
import {
  LineChart,
  Line,
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
} from 'recharts';

export const Dashboard: React.FC = () => {
  const { assets, setAssets, kpis, setKPIs } = useAppStore();
  const [loading, setLoading] = useState(true);

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

  // Prepare chart data
  const assetStatusData = [
    { name: 'Normal', value: assets.filter(a => a.status === 'normal').length, fill: '#10b981' },
    { name: 'Warning', value: assets.filter(a => a.status === 'warning').length, fill: '#f59e0b' },
    { name: 'Critical', value: assets.filter(a => a.status === 'critical').length, fill: '#ef4444' },
    { name: 'Offline', value: assets.filter(a => a.status === 'offline').length, fill: '#6b7280' },
  ];

  const uptimeData = assets.map(a => ({
    name: a.name.substring(0, 10),
    uptime: a.uptime,
  }));

  const anomalyData = assets.map(a => ({
    name: a.name.substring(0, 10),
    anomaly: a.anomalyScore,
  }));

  if (loading && assets.length === 0) {
    return <div className="flex items-center justify-center h-full text-slate-400">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Average Uptime"
          value={kpis?.totalUptime.toFixed(1) || '0'}
          unit="%"
          icon={<Activity className="w-6 h-6" />}
          status="positive"
          trend={2.3}
        />
        <KPICard
          title="Active Alerts"
          value={kpis?.activeAlerts || 0}
          icon={<AlertCircle className="w-6 h-6" />}
          status={kpis?.activeAlerts ? 'negative' : 'positive'}
          trend={-1.2}
        />
        <KPICard
          title="Anomalies Detected"
          value={kpis?.anomaliesDetected || 0}
          icon={<Zap className="w-6 h-6" />}
          status="negative"
          trend={5}
        />
        <KPICard
          title="Assets Online"
          value={`${kpis?.assetsOnline || 0}/${kpis?.totalAssets || 0}`}
          icon={<Cpu className="w-6 h-6" />}
          status="positive"
          trend={0}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Asset Status Pie Chart */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">Asset Status Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={assetStatusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {assetStatusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Anomaly Score Distribution */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">Anomaly Scores</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={anomalyData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
              <XAxis dataKey="name" stroke="rgba(148, 163, 184, 0.5)" />
              <YAxis stroke="rgba(148, 163, 184, 0.5)" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(15, 23, 42, 0.95)',
                  border: '1px solid rgba(148, 163, 184, 0.3)',
                }}
              />
              <Bar dataKey="anomaly" fill="#ef4444" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">Uptime by Asset</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={uptimeData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
            <XAxis dataKey="name" stroke="rgba(148, 163, 184, 0.5)" />
            <YAxis stroke="rgba(148, 163, 184, 0.5)" domain={[90, 100]} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                border: '1px solid rgba(148, 163, 184, 0.3)',
              }}
              formatter={(value: number) => value.toFixed(2) + '%'}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="uptime"
              stroke="#10b981"
              dot={false}
              strokeWidth={2}
              name="Uptime %"
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Activity */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">Fleet Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {assets.slice(0, 4).map((asset) => (
            <div key={asset.id} className="p-4 bg-slate-700/50 rounded-lg border border-slate-600">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-sm text-slate-100 truncate">{asset.name}</h4>
                <div
                  className={`w-2 h-2 rounded-full ${
                    asset.status === 'critical'
                      ? 'bg-red-500'
                      : asset.status === 'warning'
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
                  }`}
                />
              </div>
              <p className="text-xs text-slate-400 mb-3">{asset.location}</p>
              <div className="flex justify-between text-xs text-slate-300">
                <span>{asset.uptime.toFixed(1)}% uptime</span>
                <span>{asset.sensors.length} sensors</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
