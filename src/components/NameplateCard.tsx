import React from 'react';
import { MotorNameplate } from '../types';
import { Tag, Zap, RotateCcw, Cpu, Shield, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAppStore } from '../store/appStore';
import { translations } from '../translations';

interface NameplateCardProps {
  nameplate: MotorNameplate;
  compact?: boolean;
}

export const NameplateCard: React.FC<NameplateCardProps> = ({ nameplate, compact = false }) => {
  const { language } = useAppStore();
  const t = translations[language].nameplate;
  const f = t.fields;
  const locale = language === 'pt' ? 'pt-BR' : 'en-US';
  const confidence = nameplate.ocrConfidence ?? 0;
  const confidenceColor =
    confidence >= 95 ? 'text-emerald-400' :
    confidence >= 85 ? 'text-amber-400' : 'text-red-400';

  if (compact) {
    return (
      <div className="p-3 rounded-lg bg-card-hover border border-border space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag size={12} className="text-primary" />
            <span className="text-[10px] font-bold text-primary uppercase tracking-widest">{t.ocr_badge}</span>
          </div>
          <span className={cn('text-[9px] font-bold', confidenceColor)}>
            {confidence}% {t.confidence}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
          <span className="text-muted">{f.manufacturer}</span><span className="font-semibold text-foreground">{nameplate.manufacturer}</span>
          <span className="text-muted">{f.model}</span><span className="font-semibold text-foreground">{nameplate.model}</span>
          <span className="text-muted">{f.power}</span><span className="font-semibold text-foreground">{nameplate.power_kw} kW / {nameplate.power_cv} CV</span>
          <span className="text-muted">{f.voltage}</span><span className="font-semibold text-foreground">{nameplate.voltage}</span>
          <span className="text-muted">RPM</span><span className="font-semibold text-foreground">{nameplate.rpm} rpm</span>
          <span className="text-muted">{f.serial}</span><span className="font-semibold text-foreground font-mono">{nameplate.serialNumber}</span>
        </div>
      </div>
    );
  }

  const fields = [
    { icon: Tag, label: f.tag, value: nameplate.tag },
    { icon: Cpu, label: f.manufacturer, value: nameplate.manufacturer },
    { icon: Cpu, label: f.model, value: nameplate.model },
    { icon: Cpu, label: f.serial, value: nameplate.serialNumber },
    { icon: Zap, label: f.power, value: `${nameplate.power_kw} kW / ${nameplate.power_cv} CV` },
    { icon: Zap, label: f.voltage, value: nameplate.voltage },
    { icon: Zap, label: f.current, value: `${nameplate.current_a} A` },
    { icon: RotateCcw, label: f.rpm, value: `${nameplate.rpm} RPM` },
    { icon: RotateCcw, label: f.poles, value: String(nameplate.poles) },
    { icon: RotateCcw, label: f.connection, value: nameplate.connection },
    { icon: RotateCcw, label: f.frequency, value: `${nameplate.frequency_hz} Hz` },
    { icon: Shield, label: f.ip_class, value: nameplate.ip_class },
    { icon: Shield, label: f.insulation_class, value: nameplate.insulation_class },
    { icon: CheckCircle2, label: f.year, value: String(nameplate.yearManufactured) },
  ];

  return (
    <div className="saas-card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border bg-card-hover flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Tag size={16} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">{t.title}</p>
            <p className="text-[10px] text-muted">{t.subtitle}</p>
          </div>
        </div>
        <div className="text-right">
          <p className={cn('text-lg font-bold tabular-nums', confidenceColor)}>{confidence}%</p>
          <p className="text-[9px] text-muted uppercase tracking-wider">{t.ocr_confidence}</p>
        </div>
      </div>

      {/* Fields grid */}
      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fields.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-start gap-3 p-3 rounded-lg bg-card-hover border border-border">
            <Icon size={14} className="text-muted mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[9px] font-bold text-muted uppercase tracking-widest">{label}</p>
              <p className="text-xs font-semibold text-foreground mt-0.5 truncate">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-border bg-card-hover flex items-center justify-between">
        <p className="text-[10px] text-muted">
          {t.registered_at} {new Date(nameplate.registeredAt).toLocaleDateString(locale)}
        </p>
        <span className="text-[9px] font-bold text-emerald-400 flex items-center gap-1.5">
          <CheckCircle2 size={11} />
          {t.validated}
        </span>
      </div>
    </div>
  );
};
