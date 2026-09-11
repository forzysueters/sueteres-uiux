import React, { useState } from 'react';
import { Tag, Zap, RotateCcw, Cpu, Shield, CheckCircle2, Loader2, AlertCircle, X } from 'lucide-react';
import { MotorNameplate } from '../types';
import { apiService } from '../services/api';
import { useAppStore } from '../store/appStore';
import { translations } from '../translations';

interface NameplateEditorProps {
  assetId: string;
  nameplate: MotorNameplate;
  onCancel: () => void;
  /** Chamado após a revisão ser gravada, para a página recarregar o ativo. */
  onSaved: () => void;
}

type Field = {
  key: keyof MotorNameplate;
  label: string;
  icon: React.ElementType;
  numeric?: boolean;
};

/**
 * Correção manual da placa.
 *
 * Só os valores da placa física são editáveis. Os metadados da extração
 * (confiança, motor de OCR, texto bruto) ficam de fora de propósito: são a
 * evidência do que o modelo leu, não campos de formulário.
 */
export const NameplateEditor: React.FC<NameplateEditorProps> = ({
  assetId, nameplate, onCancel, onSaved,
}) => {
  const { language } = useAppStore();
  const t = translations[language].nameplate;
  const f = t.fields;

  const [form, setForm] = useState<Partial<MotorNameplate>>(nameplate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fields: Field[] = [
    { key: 'manufacturer', label: f.manufacturer, icon: Cpu },
    { key: 'model', label: f.model, icon: Cpu },
    { key: 'serialNumber', label: f.serial, icon: Cpu },
    { key: 'power_kw', label: t.edit_power_kw, icon: Zap, numeric: true },
    { key: 'power_cv', label: t.edit_power_cv, icon: Zap, numeric: true },
    { key: 'voltage', label: f.voltage, icon: Zap },
    { key: 'current_a', label: f.current, icon: Zap, numeric: true },
    { key: 'rpm', label: f.rpm, icon: RotateCcw, numeric: true },
    { key: 'poles', label: f.poles, icon: RotateCcw, numeric: true },
    { key: 'connection', label: f.connection, icon: RotateCcw },
    { key: 'frequency_hz', label: f.frequency, icon: RotateCcw, numeric: true },
    { key: 'ip_class', label: f.ip_class, icon: Shield },
    { key: 'insulation_class', label: f.insulation_class, icon: Shield },
    { key: 'yearManufactured', label: f.year, icon: CheckCircle2, numeric: true },
  ];

  const setField = (key: keyof MotorNameplate, raw: string, numeric?: boolean) => {
    setForm((prev) => ({
      ...prev,
      [key]: numeric ? (raw === '' ? undefined : Number(raw)) : raw,
    }));
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await apiService.saveNameplateRevision(assetId, form);
      onSaved();
    } catch (err) {
      setError((err as Error)?.message || t.edit_error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="saas-card overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-5 py-4 border-b border-border bg-card-hover flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="w-8 h-8 flex-shrink-0 rounded bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Tag size={16} className="text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground">{t.edit_title}</p>
            <p className="text-[10px] text-muted">{t.edit_subtitle}</p>
          </div>
        </div>
        <button
          onClick={onCancel}
          disabled={saving}
          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-foreground hover:bg-border transition-all disabled:opacity-40"
          aria-label={t.edit_cancel}
        >
          <X size={16} />
        </button>
      </div>

      {/* Campos */}
      <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {fields.map(({ key, label, icon: Icon, numeric }) => (
          <div key={key} className="space-y-1.5">
            <label className="text-[9px] font-bold uppercase tracking-widest text-muted flex items-center gap-1.5">
              <Icon size={10} />
              {label}
            </label>
            <input
              type={numeric ? 'number' : 'text'}
              value={String(form[key] ?? '')}
              onChange={(e) => setField(key, e.target.value, numeric)}
              className="w-full h-10 bg-card-hover border border-border rounded-lg px-3 text-sm font-medium text-foreground focus:outline-none focus:border-primary/50 transition-all"
            />
          </div>
        ))}
      </div>

      {error && (
        <div className="mx-4 sm:mx-5 mb-4 flex items-start gap-3 p-4 rounded-lg bg-red-500/5 border border-red-500/20 text-red-400">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <p className="text-xs font-medium leading-relaxed">{error}</p>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 sm:px-5 py-4 border-t border-border bg-card-hover space-y-3">
        <p className="text-[10px] text-muted leading-relaxed">{t.edit_revision_hint}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            onClick={onCancel}
            disabled={saving}
            className="h-10 rounded-lg font-bold text-xs bg-card-hover border border-border text-muted hover:bg-border transition-all sm:flex-1 disabled:opacity-40"
          >
            {t.edit_cancel}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-10 rounded-lg font-bold text-xs bg-primary text-white hover:bg-primary/90 transition-all flex items-center justify-center gap-2 sm:flex-[2] disabled:opacity-60 disabled:cursor-wait"
          >
            {saving
              ? <><Loader2 size={14} className="animate-spin" />{t.edit_saving}</>
              : <><CheckCircle2 size={14} />{t.edit_save}</>}
          </button>
        </div>
      </div>
    </div>
  );
};
