import React from 'react';
import { EquipmentRegistrationForm } from '../components/EquipmentRegistrationForm';
import { useAppStore } from '../store/appStore';
import { Package, CheckCircle2, ArrowRight } from 'lucide-react';

const howItWorks = [
  { step: 1, text: 'Faça o upload de uma imagem nítida da placa de identificação do equipamento' },
  { step: 2, text: 'Nossa IA de Visão Computacional extrai fabricante, modelo e especificações' },
  { step: 3, text: 'Revise e edite as informações extraídas conforme necessário' },
  { step: 4, text: 'Registre o equipamento para rastreá-lo no gêmeo digital' },
];

const recentEquipment = [
  { name: 'Motor de Produção Principal', spec: 'ABB IE3-132M | SN: SNMPM123456', status: 'Registrado', date: 'há 2 dias' },
  { name: 'Compressor de Ar', spec: 'Siemens MOVIGEAR | SN: SNARC654321', status: 'Registrado', date: 'há 5 dias' },
];

export const EquipmentPage: React.FC = () => {
  const { selectedAssetId } = useAppStore();

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="flex items-center gap-3">
          <Package className="w-7 h-7 text-primary" />
          Gestão de Equipamentos
        </h1>
        <p>
          Registre e gerencie equipamentos industriais com extração automatizada por IA
        </p>
      </div>

      <div className="saas-card p-6 bg-slate-900/20">
        <span className="section-title">Como funciona</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {howItWorks.map(({ step, text }, i) => (
            <div key={step} className="flex items-start gap-4">
              <div className="flex items-start gap-4 flex-1">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-primary text-white flex-shrink-0 mt-0.5">
                  {step}
                </div>
                <p className="text-xs font-medium text-muted leading-relaxed">{text}</p>
              </div>
              {i < 3 && (
                <ArrowRight size={14} className="hidden lg:block flex-shrink-0 mt-2.5 text-slate-800" />
              )}
            </div>
          ))}
        </div>
      </div>

      <EquipmentRegistrationForm assetId={selectedAssetId || undefined} />

      <div className="saas-card p-6">
        <span className="section-title">Registros Recentes</span>
        <div className="space-y-3">
          {recentEquipment.map(({ name, spec, status, date }) => (
            <div
              key={name}
              className="flex items-center justify-between p-4 rounded-lg bg-slate-800/20 border border-border hover:bg-slate-800/40 hover:border-primary/30 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-slate-800 border border-border text-primary">
                  <Package size={20} />
                </div>
                <div>
                  <p className="font-bold text-sm text-foreground dark:text-white">{name}</p>
                  <p className="text-[10px] mt-0.5 font-mono text-muted">{spec}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0">
                <span className="text-[10px] font-medium text-slate-500 uppercase tracking-tight">{date}</span>
                <span className="badge badge-success px-3 py-1">
                  <CheckCircle2 size={12} />
                  {status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
