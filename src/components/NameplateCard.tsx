import React from 'react';
import { MotorNameplate } from '../types';
import { Tag, Zap, RotateCcw, Cpu, Shield, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface NameplateCardProps {
  nameplate: MotorNameplate;
  compact?: boolean;
}

export const NameplateCard: React.FC<NameplateCardProps> = ({ nameplate, compact = false }) => {
  const confidence = nameplate.ocrConfidence ?? 0;
  const confidenceColor =
    confidence >= 95 ? 'text-emerald-400' :
    confidence >= 85 ? 'text-amber-400' : 'text-red-400';

  if (compact) {
    return (
      <div className="p-3 rounded-lg bg-slate-900/50 border border-border space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag size={12} className="text-primary" />
            <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Placa OCR</span>
          </div>
          <span className={cn('text-[9px] font-bold', confidenceColor)}>
            {confidence}% confiança
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
          <span className="text-muted">Fabricante</span><span className="font-semibold text-foreground">{nameplate.manufacturer}</span>
          <span className="text-muted">Modelo</span><span className="font-semibold text-foreground">{nameplate.model}</span>
          <span className="text-muted">Potência</span><span className="font-semibold text-foreground">{nameplate.power_kw} kW / {nameplate.power_cv} CV</span>
          <span className="text-muted">Tensão</span><span className="font-semibold text-foreground">{nameplate.voltage}</span>
          <span className="text-muted">RPM</span><span className="font-semibold text-foreground">{nameplate.rpm} rpm</span>
          <span className="text-muted">Nº Série</span><span className="font-semibold text-foreground font-mono">{nameplate.serialNumber}</span>
        </div>
      </div>
    );
  }

  const fields = [
    { icon: Tag, label: 'TAG', value: nameplate.tag },
    { icon: Cpu, label: 'Fabricante', value: nameplate.manufacturer },
    { icon: Cpu, label: 'Modelo', value: nameplate.model },
    { icon: Cpu, label: 'Nº de Série', value: nameplate.serialNumber },
    { icon: Zap, label: 'Potência', value: `${nameplate.power_kw} kW / ${nameplate.power_cv} CV` },
    { icon: Zap, label: 'Tensão Nominal', value: nameplate.voltage },
    { icon: Zap, label: 'Corrente Nominal', value: `${nameplate.current_a} A` },
    { icon: RotateCcw, label: 'Rotação', value: `${nameplate.rpm} RPM` },
    { icon: RotateCcw, label: 'Pólos', value: String(nameplate.poles) },
    { icon: RotateCcw, label: 'Ligação', value: nameplate.connection },
    { icon: RotateCcw, label: 'Frequência', value: `${nameplate.frequency_hz} Hz` },
    { icon: Shield, label: 'Classe IP', value: nameplate.ip_class },
    { icon: Shield, label: 'Cl. Isolamento', value: nameplate.insulation_class },
    { icon: CheckCircle2, label: 'Ano Fabricação', value: String(nameplate.yearManufactured) },
  ];

  return (
    <div className="saas-card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border bg-slate-900/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Tag size={16} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Placa de Identificação</p>
            <p className="text-[10px] text-muted">Dados extraídos via OCR — Visão Computacional</p>
          </div>
        </div>
        <div className="text-right">
          <p className={cn('text-lg font-bold tabular-nums', confidenceColor)}>{confidence}%</p>
          <p className="text-[9px] text-muted uppercase tracking-wider">confiança OCR</p>
        </div>
      </div>

      {/* Fields grid */}
      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fields.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-start gap-3 p-3 rounded-lg bg-slate-900/20 border border-border">
            <Icon size={14} className="text-muted mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[9px] font-bold text-muted uppercase tracking-widest">{label}</p>
              <p className="text-xs font-semibold text-foreground mt-0.5 truncate">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-border bg-slate-900/20 flex items-center justify-between">
        <p className="text-[10px] text-muted">
          Cadastrado em {new Date(nameplate.registeredAt).toLocaleDateString('pt-BR')}
        </p>
        <span className="text-[9px] font-bold text-emerald-400 flex items-center gap-1.5">
          <CheckCircle2 size={11} />
          Registro Validado
        </span>
      </div>
    </div>
  );
};
