import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, CheckCircle2, Bot, AlertCircle, Sparkles, Loader2, RefreshCw, Zap, Tag, Shield, Cpu, Timer } from 'lucide-react';
import { apiService } from '../services/api';
import { MotorNameplate } from '../types';
import type { NameplateResult, OcrMode } from '../services/ocrAPI';

type Extraction = NameplateResult;

interface EquipmentRegistrationFormProps {
  assetId?: string;
}

export const EquipmentRegistrationForm: React.FC<EquipmentRegistrationFormProps> = () => {
  const [step, setStep] = useState(1);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [mode, setMode] = useState<OcrMode>('easyocr');

  const extractedData = extraction?.nameplate ?? null;

  const processFile = async (file: File) => {
    setPreviewUrl(URL.createObjectURL(file));
    setStep(2);
    setOcrError(null);
    try {
      const result = await apiService.extractNameplate(file, { mode });
      setExtraction(result);
      setStep(3);
    } catch (err) {
      setOcrError(
        (err as Error)?.message ||
          'Falha na extração OCR. Tente uma imagem com melhor iluminação e resolução.',
      );
      setStep(1);
    }
  };

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) processFile(accepted[0]);
  }, [mode]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: false,
  });

  const handleRegister = async () => {
    if (!extractedData) return;
    setStep(4);
  };

  const reset = () => {
    setStep(1);
    setPreviewUrl(null);
    setExtraction(null);
    setOcrError(null);
  };

  const MODEL_LABELS: Record<string, string> = {
    easyocr: 'EasyOCR',
    gemini: 'Gemini Vision',
    mock: 'Simulado (offline)',
    paddleocr: 'PaddleOCR',
    trocr: 'TrOCR',
  };

  const fields: { label: string; key: keyof MotorNameplate; icon: React.ElementType; type?: string }[] = [
    { label: 'TAG', key: 'tag', icon: Tag },
    { label: 'Fabricante', key: 'manufacturer', icon: FileText },
    { label: 'Modelo', key: 'model', icon: FileText },
    { label: 'Número de Série', key: 'serialNumber', icon: FileText },
    { label: 'Potência (kW)', key: 'power_kw', icon: Zap, type: 'number' },
    { label: 'Potência (CV)', key: 'power_cv', icon: Zap, type: 'number' },
    { label: 'Tensão', key: 'voltage', icon: Zap },
    { label: 'Corrente Nominal (A)', key: 'current_a', icon: Zap, type: 'number' },
    { label: 'Rotação (RPM)', key: 'rpm', icon: RefreshCw, type: 'number' },
    { label: 'Número de Pólos', key: 'poles', icon: RefreshCw, type: 'number' },
    { label: 'Ligação', key: 'connection', icon: RefreshCw },
    { label: 'Classe IP', key: 'ip_class', icon: Shield },
    { label: 'Classe Isolamento', key: 'insulation_class', icon: Shield },
  ];

  return (
    <div className="saas-card overflow-hidden animate-fade-in">
      {/* Header / Stepper */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-card-hover">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-card-hover border border-border flex items-center justify-center text-primary">
            <Bot size={18} />
          </div>
          <div>
            <h2 className="font-bold text-sm text-foreground">Registro de Equipamento — Pipeline OCR</h2>
            <p className="text-[10px] text-muted">Modelo WEG W22 · EasyOCR + fallback Gemini Vision</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {[
            { n: 1, label: 'Upload' },
            { n: 2, label: 'OCR' },
            { n: 3, label: 'Revisão' },
          ].map(({ n, label }) => (
            <div key={n} className="flex items-center gap-1.5">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all ${
                step > n ? 'bg-emerald-500 border-emerald-500 text-white' :
                step === n ? 'bg-primary border-primary text-white' :
                'bg-card-hover border-border text-muted'
              }`}>
                {step > n ? <CheckCircle2 size={12} /> : n}
              </div>
              <span className={`text-[10px] font-medium hidden sm:block ${step >= n ? 'text-foreground' : 'text-muted'}`}>{label}</span>
              {n < 3 && <div className={`w-6 h-px ${step > n ? 'bg-emerald-500' : 'bg-border'}`} />}
            </div>
          ))}
        </div>
      </div>

      <div className="p-8">
        {/* STEP 1 — Upload */}
        {step === 1 && (
          <div className="space-y-6">
            {/* Seletor de motor de OCR */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Motor de OCR</span>
              <div className="inline-flex rounded-lg bg-card-hover border border-border p-0.5">
                {([
                  { id: 'easyocr', label: 'EasyOCR' },
                  { id: 'gemini', label: 'Gemini Vision' },
                ] as const).map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setMode(id)}
                    className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition-all ${
                      mode === id ? 'bg-primary text-white' : 'text-muted hover:text-foreground'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center transition-all cursor-pointer ${
                isDragActive ? 'border-primary bg-primary/5' : 'border-border bg-card-hover hover:border-primary/50 hover:bg-border/40'
              }`}
            >
              <input {...getInputProps()} />
              <div className="w-12 h-12 rounded-lg bg-card-hover border border-border flex items-center justify-center mb-4 text-muted">
                <Upload size={24} />
              </div>
              <p className="font-bold text-sm text-foreground">Arraste a imagem da placa aqui ou clique para buscar</p>
              <p className="text-xs text-muted mt-1">PNG, JPG ou JPEG até 10MB</p>
            </div>

            {ocrError && (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-red-500/5 border border-red-500/20 text-red-400">
                <AlertCircle size={16} className="flex-shrink-0" />
                <p className="text-xs font-medium">{ocrError}</p>
              </div>
            )}

            <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/5 border border-amber-500/10 text-amber-500/80">
              <AlertCircle size={16} className="flex-shrink-0" />
              <p className="text-xs font-medium">
                {mode === 'gemini'
                  ? 'Modo Gemini Vision: requer GEMINI_API_KEY configurada no backend (.env). Extrai todos os campos diretamente do modelo de visão.'
                  : 'Certifique-se de que o texto da placa esteja bem visível e iluminado. O pipeline aplica realce adaptativo (OpenCV) e remoção de linhas de grade antes do EasyOCR.'}
              </p>
            </div>

            {/* Pipeline visual */}
            <div className="p-4 rounded-xl bg-card-hover border border-border">
              <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-3">Pipeline de Visão Computacional</p>
              <div className="flex items-center gap-2 flex-wrap">
                {(mode === 'gemini'
                  ? ['Imagem', 'Realce', 'Gemini Vision', 'Normalização', 'Validação física', 'Cadastro']
                  : ['Imagem', 'Realce', 'EasyOCR', 'Extração de campos', 'Validação física', 'Fallback Gemini', 'Cadastro']
                ).map((step, i, arr) => (
                  <React.Fragment key={step}>
                    <span className="px-2 py-1 rounded bg-card-hover border border-border text-[9px] font-bold text-muted uppercase">{step}</span>
                    {i < arr.length - 1 && <span className="text-border-strong text-xs">→</span>}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2 — Processing */}
        {step === 2 && (
          <div className="py-16 flex flex-col items-center justify-center text-center">
            {previewUrl && (
              <img src={previewUrl} alt="Placa" className="w-48 h-32 object-cover rounded-lg mb-6 border border-border opacity-60" />
            )}
            <div className="relative mb-6">
              <div className="w-16 h-16 rounded-xl bg-card-hover border border-border flex items-center justify-center">
                <Loader2 size={32} className="text-primary animate-spin" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded bg-card border border-primary/30 flex items-center justify-center">
                <Sparkles size={12} className="text-primary animate-pulse" />
              </div>
            </div>
            <h3 className="text-foreground">Pipeline OCR em execução</h3>
            <div className="mt-4 space-y-1.5 text-left">
              {(mode === 'gemini'
                ? ['Aplicando realce adaptativo…', 'Enviando ao Gemini Vision…', 'Normalizando campos…', 'Validação física…']
                : ['Aplicando realce adaptativo…', 'Removendo linhas de grade…', 'Executando EasyOCR…', 'Extraindo e fundindo campos…', 'Validação física…']
              ).map((msg, i) => (
                <div key={i} className={`flex items-center gap-2 text-xs ${i <= 2 ? 'text-emerald-400' : 'text-muted animate-pulse'}`}>
                  {i <= 2 ? <CheckCircle2 size={12} /> : <Loader2 size={12} className="animate-spin" />}
                  {msg}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3 — Review */}
        {step === 3 && extractedData && (
          <div className="animate-fade-in space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2 text-emerald-500">
                <Sparkles size={14} />
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  Extração OCR Concluída — {extractedData.ocrConfidence ?? '?'}% de Confiança
                </span>
              </div>
              <button onClick={reset} className="text-[10px] font-bold text-muted hover:text-primary flex items-center gap-1.5 transition-colors">
                <RefreshCw size={12} />
                Novo upload
              </button>
            </div>

            {previewUrl && (
              <img src={previewUrl} alt="Placa capturada" className="w-full h-32 object-cover rounded-lg border border-border" />
            )}

            {/* Metadados do pipeline */}
            {extraction && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-card-hover border border-border text-[10px] font-bold text-foreground-soft">
                  <Cpu size={11} className="text-primary" />
                  {MODEL_LABELS[extraction.modelUsed] ?? extraction.modelUsed}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-card-hover border border-border text-[10px] font-bold text-foreground-soft capitalize">
                  <Bot size={11} className="text-primary" />
                  {extraction.motorType}
                </span>
                {extraction.processingTimeMs > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-card-hover border border-border text-[10px] font-bold text-foreground-soft">
                    <Timer size={11} className="text-primary" />
                    {(extraction.processingTimeMs / 1000).toFixed(1)}s
                  </span>
                )}
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[10px] font-bold ${
                    extraction.validation.consistente
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                  }`}
                >
                  {extraction.validation.consistente ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                  {extraction.validation.consistente ? 'Validação consistente' : 'Verificar campos'}
                </span>
              </div>
            )}

            {/* Alertas da validação física */}
            {extraction && extraction.validation.alertas.length > 0 && (
              <div className="p-4 rounded-lg bg-amber-500/5 border border-amber-500/20 space-y-2">
                <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertCircle size={12} />
                  Alertas de validação física
                </p>
                <ul className="space-y-1">
                  {extraction.validation.alertas.map((a, i) => (
                    <li key={i} className="text-xs text-amber-500/90 flex items-start gap-2">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-amber-500 flex-shrink-0" />
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div key={previewUrl ?? 'fields'} className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
              {fields.map(({ label, key, icon: Icon, type }) => (
                <div key={key} className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted flex items-center gap-1.5">
                    <Icon size={10} />
                    {label}
                  </label>
                  <input
                    type={type ?? 'text'}
                    defaultValue={String(extractedData[key] ?? '')}
                    className="w-full h-10 bg-card-hover border border-border rounded-lg px-3 text-sm font-medium text-foreground focus:outline-none focus:border-primary/50 transition-all"
                  />
                </div>
              ))}
            </div>

            <div className="pt-6 flex gap-3">
              <button onClick={reset} className="flex-1 h-11 rounded-lg font-bold text-xs bg-card-hover text-muted hover:bg-border transition-all">
                Cancelar
              </button>
              <button onClick={handleRegister} className="flex-[2] h-11 rounded-lg font-bold text-xs bg-primary text-white hover:bg-primary/90 transition-all flex items-center justify-center gap-2">
                <CheckCircle2 size={16} />
                Confirmar Registro
              </button>
            </div>
          </div>
        )}

        {/* STEP 4 — Success */}
        {step === 4 && (
          <div className="py-16 flex flex-col items-center justify-center text-center animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-center mb-6">
              <CheckCircle2 size={32} className="text-emerald-500" />
            </div>
            <h3 className="text-xl font-bold text-foreground">Equipamento Registrado</h3>
            <p className="text-sm text-muted mt-2 max-w-[320px]">
              A placa foi lida via OCR, validada e vinculada ao gêmeo digital com rastreabilidade completa.
            </p>
            <div className="mt-6 p-4 rounded-xl bg-card-hover border border-border text-left w-full max-w-xs">
              <p className="text-[10px] text-muted mb-2 font-bold uppercase tracking-wider">Rastreabilidade</p>
              <div className="space-y-1 text-xs text-muted">
                <p>• Imagem armazenada no backend (storage/)</p>
                <p>• Modelo: {extraction ? (MODEL_LABELS[extraction.modelUsed] ?? extraction.modelUsed) : 'EasyOCR'}</p>
                <p>• Confiança OCR: {extractedData?.ocrConfidence ?? '?'}%</p>
                <p>• Cadastro: {new Date().toLocaleString('pt-BR')}</p>
              </div>
            </div>
            <button onClick={reset} className="mt-8 px-6 py-2.5 rounded-lg bg-card-hover border border-border font-bold text-xs text-foreground hover:bg-border transition-all">
              Registrar Outro Equipamento
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
