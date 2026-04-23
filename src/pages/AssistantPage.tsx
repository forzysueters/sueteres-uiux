import React from 'react';
import { AIAssistant } from '../components/AIAssistant';
import { useAppStore } from '../store/appStore';

export const AssistantPage: React.FC = () => {
  const { selectedAssetId, assets } = useAppStore();

  const selectedAsset = assets.find(a => a.id === selectedAssetId);

  return (
    <div className="h-full flex flex-col gap-6">
      {/* Header */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-slate-100">AI Maintenance Assistant</h2>
        <p className="text-sm text-slate-400 mt-1">
          Ask questions about maintenance, troubleshooting, or asset diagnostics. The AI learns from historical data and ML models.
        </p>
        {selectedAsset && (
          <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded text-xs text-blue-200">
            💡 Context: You're discussing <strong>{selectedAsset.name}</strong> ({selectedAsset.location})
          </div>
        )}
      </div>

      {/* Chat Interface */}
      <div className="flex-1 min-h-0">
        <AIAssistant selectedAssetId={selectedAssetId || undefined} />
      </div>

      {/* Quick Actions */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-slate-100 mb-3">Quick Questions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <button className="text-left px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs text-slate-200 transition-colors">
            What maintenance is due soon?
          </button>
          <button className="text-left px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs text-slate-200 transition-colors">
            Why is there high vibration?
          </button>
          <button className="text-left px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs text-slate-200 transition-colors">
            How do I reduce energy consumption?
          </button>
          <button className="text-left px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs text-slate-200 transition-colors">
            What caused the last failure?
          </button>
        </div>
      </div>
    </div>
  );
};
