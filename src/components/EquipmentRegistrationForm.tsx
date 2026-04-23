import React, { useState } from 'react';
import { Upload, Check, Loader } from 'lucide-react';
import { apiService } from '../services/api';
import { EquipmentRegistration } from '../types';

interface EquipmentRegistrationFormProps {
  assetId?: string;
}

export const EquipmentRegistrationForm: React.FC<EquipmentRegistrationFormProps> = ({ assetId }) => {
  const [step, setStep] = useState<'upload' | 'form' | 'success'>('upload');
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [formData, setFormData] = useState({
    serialNumber: '',
    manufacturer: '',
    model: '',
    yearManufactured: new Date().getFullYear(),
    powerRating: 0,
  });
  const [registered, setRegistered] = useState<EquipmentRegistration | null>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const result = await apiService.uploadEquipmentImage(file);
      setImageUrl(result.url);
      
      // Auto-fill form with extracted data
      setFormData(prev => ({
        ...prev,
        ...result.extractedData,
        powerRating: result.extractedData.powerRating || 0,
        yearManufactured: result.extractedData.yearManufactured || new Date().getFullYear(),
      }));
      
      setStep('form');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setLoading(true);
    try {
      const result = await apiService.registerEquipment({
        assetId: assetId || `asset-${Date.now()}`,
        ...formData,
        imageUrl,
      });
      setRegistered(result);
      setStep('success');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-slate-100 mb-6">Equipment Registration</h2>

      {step === 'upload' && (
        <div className="space-y-4">
          <div className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center hover:border-slate-500 transition-colors cursor-pointer">
            <label className="cursor-pointer block">
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-8 h-8 text-slate-400" />
                <span className="text-sm font-medium text-slate-200">Upload Equipment Image</span>
                <span className="text-xs text-slate-400">PNG, JPG up to 10MB</span>
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={loading}
                className="hidden"
              />
            </label>
          </div>
          {loading && (
            <div className="flex items-center justify-center gap-2 text-slate-400">
              <Loader className="w-4 h-4 animate-spin" />
              <span className="text-sm">Analyzing image...</span>
            </div>
          )}
        </div>
      )}

      {step === 'form' && (
        <div className="space-y-4">
          {imageUrl && (
            <div className="mb-4 rounded-lg overflow-hidden border border-slate-700">
              <img src={imageUrl} alt="Equipment" className="w-full h-48 object-cover" />
            </div>
          )}
          <p className="text-sm text-slate-400 mb-4">
            The following information was extracted from the image. Review and edit as needed.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Serial Number</label>
              <input
                type="text"
                value={formData.serialNumber}
                onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                placeholder="e.g., SN123456789"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Manufacturer</label>
              <input
                type="text"
                value={formData.manufacturer}
                onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                placeholder="e.g., ABB"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Model</label>
              <input
                type="text"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                placeholder="e.g., IE3-132M"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Year Manufactured</label>
              <input
                type="number"
                value={formData.yearManufactured}
                onChange={(e) => setFormData({ ...formData, yearManufactured: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-1">Power Rating (kW)</label>
              <input
                type="number"
                value={formData.powerRating}
                onChange={(e) => setFormData({ ...formData, powerRating: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                placeholder="e.g., 22"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setStep('upload')}
              className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg text-sm font-medium transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleRegister}
              disabled={loading || !formData.serialNumber || !formData.manufacturer}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {loading ? 'Registering...' : 'Register Equipment'}
            </button>
          </div>
        </div>
      )}

      {step === 'success' && registered && (
        <div className="text-center space-y-4">
          <div className="flex justify-center mb-4">
            <Check className="w-12 h-12 text-green-400" />
          </div>
          <h3 className="text-lg font-semibold text-green-300">Registration Successful!</h3>
          <div className="bg-slate-700/50 rounded-lg p-4 text-left space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">ID:</span>
              <span className="text-slate-200 font-mono">{registered.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Manufacturer:</span>
              <span className="text-slate-200">{registered.manufacturer}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Model:</span>
              <span className="text-slate-200">{registered.model}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Registered:</span>
              <span className="text-slate-200">{new Date(registered.registeredAt).toLocaleDateString()}</span>
            </div>
          </div>
          <button
            onClick={() => {
              setStep('upload');
              setFormData({ serialNumber: '', manufacturer: '', model: '', yearManufactured: new Date().getFullYear(), powerRating: 0 });
              setImageUrl('');
            }}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Register Another Equipment
          </button>
        </div>
      )}
    </div>
  );
};
