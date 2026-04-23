import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { apiService } from '../services/api';
import { Asset } from '../types';
import { SensorCard, StatusIndicator } from './Cards';
import { TimeSeriesChart } from './TimeSeriesChart';
import { X, AlertCircle, Zap } from 'lucide-react';

interface AssetDetailPanelProps {
  assetId: string | null;
  onClose: () => void;
}

interface SensorHistory {
  timestamp: string;
  value: number;
  threshold: number;
}

export const AssetDetailPanel: React.FC<AssetDetailPanelProps> = ({ assetId, onClose }) => {
  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(false);
  const [sensorHistory, setSensorHistory] = useState<SensorHistory[]>([]);

  useEffect(() => {
    if (assetId) {
      loadAsset();
    }
  }, [assetId]);

  const loadAsset = async () => {
    if (!assetId) return;
    setLoading(true);
    try {
      const data = await apiService.getAssetById(assetId);
      if (data) {
        setAsset(data);
        // Generate mock history
        generateMockHistory(data);
      }
    } finally {
      setLoading(false);
    }
  };

  const generateMockHistory = (asset: Asset) => {
    const now = new Date();
    const history: SensorHistory[] = [];
    
    for (let i = 59; i >= 0; i--) {
      const tempSensor = asset.sensors.find(s => s.name.includes('Temperature'));
      if (tempSensor) {
        history.push({
          timestamp: new Date(now.getTime() - i * 60000).toISOString(),
          value: tempSensor.value + (Math.random() - 0.5) * 10,
          threshold: tempSensor.threshold,
        });
      }
    }
    setSensorHistory(history);
  };

  if (!assetId || !asset) {
    return null;
  }

  const getStatusBadgeColor = () => {
    switch (asset.status) {
      case 'critical':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'warning':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'offline':
        return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
      default:
        return 'bg-green-500/20 text-green-300 border-green-500/30';
    }
  };

  return (
    <div className="fixed inset-0 right-0 top-0 bottom-0 w-96 bg-slate-800/95 backdrop-blur border-l border-slate-700 shadow-2xl z-40 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-slate-800/95 border-b border-slate-700 p-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100">{asset.name}</h2>
          <p className="text-sm text-slate-400 mt-1">{asset.location}</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Status Section */}
        <div className={`rounded-lg border p-4 ${getStatusBadgeColor()}`}>
          <div className="flex items-center gap-3">
            <StatusIndicator status={asset.status} size="lg" />
            <div>
              <p className="text-sm font-semibold capitalize">{asset.status}</p>
              <p className="text-xs opacity-75">Uptime: {asset.uptime.toFixed(2)}%</p>
            </div>
          </div>
        </div>

        {/* Anomaly Score */}
        {asset.anomalyScore > 0 && (
          <div className={`rounded-lg border p-4 ${
            asset.anomalyScore > 70
              ? 'bg-red-500/10 border-red-500/30'
              : 'bg-orange-500/10 border-orange-500/30'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className={`w-5 h-5 ${asset.anomalyScore > 70 ? 'text-red-400' : 'text-orange-400'}`} />
              <span className="font-semibold">Anomaly Score</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1 bg-slate-700 rounded-full h-2">
                <div
                  className={`h-full rounded-full transition-all ${
                    asset.anomalyScore > 70 ? 'bg-red-500' : 'bg-orange-500'
                  }`}
                  style={{ width: `${asset.anomalyScore}%` }}
                />
              </div>
              <span className="text-lg font-bold">{asset.anomalyScore.toFixed(0)}%</span>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              {asset.anomalyScore > 70
                ? 'Critical anomaly detected. Immediate investigation required.'
                : 'Moderate anomaly. Monitor closely.'}
            </p>
          </div>
        )}

        {/* Maintenance Info */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-sm">Maintenance Schedule</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Last Maintenance:</span>
              <span className="text-slate-200 font-mono">{new Date(asset.lastMaintenance).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Next Scheduled:</span>
              <span className="text-slate-200 font-mono">{new Date(asset.nextMaintenance).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Sensor Grid */}
        <div>
          <h3 className="font-semibold text-sm mb-4">Live Sensor Data</h3>
          <div className="grid grid-cols-1 gap-3">
            {asset.sensors.map((sensor) => (
              <SensorCard
                key={sensor.id}
                label={sensor.name}
                value={sensor.value}
                unit={sensor.unit}
                status={sensor.status}
                min={sensor.min}
                max={sensor.max}
                threshold={sensor.threshold}
              />
            ))}
          </div>
        </div>

        {/* Time Series Chart */}
        {sensorHistory.length > 0 && (
          <TimeSeriesChart
            data={sensorHistory}
            title="Temperature Trend (Last 60 minutes)"
            dataKey="value"
            unit="°C"
            color="#ef4444"
            thresholdKey="threshold"
            type="area"
          />
        )}

        {/* ML Insights */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-5 h-5 text-blue-400" />
            <span className="font-semibold text-sm">AI Insights</span>
          </div>
          <p className="text-sm text-slate-300">
            {asset.anomalyScore > 50
              ? `Based on current sensor readings and historical patterns, this ${asset.type} shows signs of degradation. Recommend scheduling preventive maintenance within 48 hours.`
              : `Asset is operating within normal parameters. Condition-based monitoring shows no anomalies. Continue routine inspections.`}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-700">
          <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
            Schedule Maintenance
          </button>
          <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg text-sm font-medium transition-colors">
            View History
          </button>
        </div>
      </div>
    </div>
  );
};
