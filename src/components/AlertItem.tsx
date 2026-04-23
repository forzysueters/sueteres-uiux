import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Alert } from '../types';

interface AlertItemProps {
  alert: Alert;
  onResolve: (alertId: string) => void;
}

export const AlertItem: React.FC<AlertItemProps> = ({ alert, onResolve }) => {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'border-red-500/30 bg-red-500/10';
      case 'warning':
        return 'border-yellow-500/30 bg-yellow-500/10';
      default:
        return 'border-blue-500/30 bg-blue-500/10';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="w-5 h-5 text-red-400" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
      default:
        return <CheckCircle2 className="w-5 h-5 text-blue-400" />;
    }
  };

  return (
    <div
      className={`border rounded-lg p-4 ${getSeverityColor(
        alert.severity
      )} transition-all hover:shadow-lg ${alert.resolved ? 'opacity-50' : ''}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">{getSeverityIcon(alert.severity)}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-semibold text-slate-100">{alert.title}</h4>
            {alert.resolved && (
              <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-300">
                Resolved
              </span>
            )}
          </div>
          <p className="text-sm text-slate-300 mt-1">{alert.description}</p>
          <p className="text-xs text-slate-400 mt-2">Asset: {alert.assetName}</p>
          {alert.mlInsight && (
            <div className="mt-3 p-2 bg-black/30 rounded border border-slate-700/50">
              <p className="text-xs text-slate-300">
                <span className="font-semibold text-blue-300">AI Insight: </span>
                {alert.mlInsight}
              </p>
            </div>
          )}
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-slate-400">
              {new Date(alert.timestamp).toLocaleString()}
            </span>
            {!alert.resolved && (
              <button
                onClick={() => onResolve(alert.id)}
                className="text-xs px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 transition-colors"
              >
                Mark Resolved
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
