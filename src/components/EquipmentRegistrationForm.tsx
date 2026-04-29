import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, CheckCircle2, Bot, AlertCircle, Sparkles, Loader2, RefreshCw, Zap } from 'lucide-react';

interface EquipmentRegistrationFormProps {
  assetId?: string;
}

export const EquipmentRegistrationForm: React.FC<EquipmentRegistrationFormProps> = () => {
  const [step, setStep] = useState(1);
  const [, setFile] = useState<File | null>(null);
  const [, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      simulateExtraction();
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: false,
  });

  const simulateExtraction = () => {
    setIsProcessing(true);
    setStep(2);
    setTimeout(() => {
      setExtractedData({
        manufacturer: 'ABB Motors',
        model: 'IE3 High Efficiency',
        serialNumber: 'SN-77889900',
        power: '45kW / 60HP',
        rpm: '1780 RPM',
        voltage: '380-480V',
      });
      setIsProcessing(false);
      setStep(3);
    }, 3000);
  };

  const handleRegister = () => {
    setStep(4);
  };

  return (
    <div className="saas-card overflow-hidden animate-fade-in">
      {/* Header / Stepper */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-slate-900/20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-slate-800 border border-slate-700 flex items-center justify-center text-primary">
            <Bot size={18} />
          </div>
          <h2 className="font-bold text-sm text-foreground dark:text-white">Novo Registro de Equipamento</h2>
        </div>
        <div className="flex items-center gap-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all border ${
                  step >= s ? 'bg-primary border-primary text-white' : 'bg-slate-800 border-slate-700 text-muted'
                }`}
              >
                {step > s ? <CheckCircle2 size={12} /> : s}
              </div>
              {s < 3 && <div className={`w-6 h-px ${step > s ? 'bg-primary' : 'bg-slate-800'}`} />}
            </div>
          ))}
        </div>
      </div>

      <div className="p-8">
        {step === 1 && (
          <div className="space-y-6">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center transition-all cursor-pointer ${
                isDragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-slate-900/20 hover:border-primary/50 hover:bg-slate-900/40'
              }`}
            >
              <input {...getInputProps()} />
              <div className="w-12 h-12 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center mb-4 text-muted group-hover:text-primary transition-colors">
                <Upload size={24} />
              </div>
              <p className="font-bold text-sm text-foreground dark:text-white">Arraste a imagem da placa aqui ou clique para buscar</p>
              <p className="text-xs text-muted mt-1">PNG, JPG ou JPEG até 10MB</p>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/5 border border-amber-500/10 text-amber-500/80">
              <AlertCircle size={16} className="flex-shrink-0" />
              <p className="text-xs font-medium">Certifique-se de que o texto da placa esteja bem visível e iluminado para uma extração ideal por IA.</p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="py-16 flex flex-col items-center justify-center text-center">
            <div className="relative mb-6">
              <div className="w-16 h-16 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                <Loader2 size={32} className="text-primary animate-spin" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded bg-card border border-primary/30 flex items-center justify-center">
                <Sparkles size={12} className="text-primary animate-pulse" />
              </div>
            </div>
            <h3 className="text-foreground dark:text-white">Motor de Visão IA</h3>
            <p className="text-xs text-muted mt-1 max-w-[280px]">
              Extraindo especificações técnicas e números de série da telemetria de imagem...
            </p>
          </div>
        )}

        {step === 3 && extractedData && (
          <div className="animate-fade-in space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2 text-emerald-500">
                <Sparkles size={14} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Extração Concluída com Sucesso</span>
              </div>
              <button
                onClick={() => setStep(1)}
                className="text-[10px] font-bold text-muted hover:text-primary flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw size={12} />
                Fazer upload novamente
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
              {[
                { label: 'Fabricante', key: 'manufacturer', icon: FileText },
                { label: 'Modelo', key: 'model', icon: FileText },
                { label: 'Número de Série', key: 'serialNumber', icon: FileText },
                { label: 'Potência Nominal', key: 'power', icon: Zap },
                { label: 'Velocidade de Rotação', key: 'rpm', icon: RefreshCw },
                { label: 'Voltagem', key: 'voltage', icon: Zap },
              ].map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted">
                    {field.label}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      defaultValue={extractedData[field.key]}
                      className="w-full h-10 bg-slate-900 border border-border rounded-lg px-3 text-sm font-medium text-foreground dark:text-white focus:outline-none focus:border-primary/50 transition-all"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-6 flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 h-11 rounded-lg font-bold text-xs bg-slate-800 text-muted hover:bg-slate-700 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleRegister}
                className="flex-[2] btn-primary !rounded-lg !h-11 !text-xs"
              >
                <CheckCircle2 size={16} />
                Confirmar Registro
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="py-16 flex flex-col items-center justify-center text-center animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-center mb-6">
              <CheckCircle2 size={32} className="text-emerald-500" />
            </div>
            <h3 className="text-xl font-bold text-foreground dark:text-white">Registro Salvo</h3>
            <p className="text-sm text-muted mt-2 max-w-[320px]">
              O equipamento foi registrado com sucesso e vinculado ao gêmeo digital.
            </p>
            <button
              onClick={() => {
                setStep(1);
                setFile(null);
                setExtractedData(null);
              }}
              className="mt-8 px-6 py-2.5 rounded-lg bg-slate-800 border border-slate-700 font-bold text-xs text-foreground dark:text-white hover:bg-slate-700 transition-all"
            >
              Adicionar Outro Registro
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
