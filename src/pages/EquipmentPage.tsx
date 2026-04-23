import React from 'react';
import { EquipmentRegistrationForm } from '../components/EquipmentRegistrationForm';
import { useAppStore } from '../store/appStore';

export const EquipmentPage: React.FC = () => {
  const { selectedAssetId } = useAppStore();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-slate-100">Equipment Registration & Management</h2>
        <p className="text-sm text-slate-400 mt-1">
          Register new equipment by uploading images. Computer Vision will automatically extract key specifications.
        </p>
      </div>

      {/* Form */}
      <EquipmentRegistrationForm assetId={selectedAssetId || undefined} />

      {/* Info */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-300 mb-2">How it works:</h3>
        <ul className="text-sm text-blue-200 space-y-1">
          <li>1. Upload a clear image of the equipment label or nameplate</li>
          <li>2. Our AI will extract manufacturer, model, and specifications</li>
          <li>3. Review and edit the extracted information as needed</li>
          <li>4. Register the equipment to track it in the digital twin</li>
        </ul>
      </div>

      {/* Registered Equipment List */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">Recently Registered</h3>
        <div className="space-y-3">
          <div className="p-4 bg-slate-700/50 rounded-lg border border-slate-600 flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-100">Main Production Motor</p>
              <p className="text-xs text-slate-400">ABB IE3-132M | SN: SNMPM123456</p>
            </div>
            <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-300">Registered</span>
          </div>
          <div className="p-4 bg-slate-700/50 rounded-lg border border-slate-600 flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-100">Air Compressor</p>
              <p className="text-xs text-slate-400">Siemens MOVIGEAR | SN: SNARC654321</p>
            </div>
            <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-300">Registered</span>
          </div>
        </div>
      </div>
    </div>
  );
};
