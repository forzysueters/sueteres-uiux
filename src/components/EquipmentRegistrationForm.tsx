import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, CheckCircle2, Bot, AlertCircle, Sparkles, Loader2, RefreshCw, Zap, Tag, Shield, Cpu, Timer, MapPin, Link2, PlusCircle, Lock, GaugeCircle } from 'lucide-react';
import { apiService } from '../services/api';
import { Area, Asset, MotorNameplate, NewAssetInput } from '../types';
import type { Json } from '../types/database';
import type { NameplateResult, OcrMode } from '../services/ocrAPI';
import { useAppStore } from '../store/appStore';
import { usePermissions } from '../hooks/usePermissions';
import { PlantFloorMap } from './PlantFloorMap';
import { footprintCells, footprintOf, rectToPlant } from './three/plantGrid';
import type { CellRect } from './three/plantGrid';
import { hallForArea } from './three/plantLayout';
import { translations } from '../translations';

type Extraction = NameplateResult;
type Target = 'new' | 'existing';

interface EquipmentRegistrationFormProps {
  assetId?: string;
  /** Disparado após um cadastro concluído, para a página recarregar suas listas. */
  onRegistered?: () => void;
}

const ASSET_TYPES: Asset['type'][] = ['motor', 'pump', 'compressor', 'fan'];
const CRITICALITIES: NewAssetInput['criticality'][] = ['low', 'medium', 'high', 'critical'];

/** Campos da placa editáveis na revisão. A TAG saiu daqui: ela identifica o
 *  ativo, não a placa, e é pedida no passo de destino. */
const NUMERIC_FIELDS: (keyof MotorNameplate)[] = [
  'power_kw', 'power_cv', 'current_a', 'rpm', 'poles',
];

export const EquipmentRegistrationForm: React.FC<EquipmentRegistrationFormProps> = ({
  assetId,
  onRegistered,
}) => {
  const { language, assets, setAssets } = useAppStore();
  const { can } = usePermissions();
  const t = translations[language].equipmentForm;
  const locale = language === 'pt' ? 'pt-BR' : 'en-US';

  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [form, setForm] = useState<Partial<MotorNameplate>>({});
  const [ocrError, setOcrError] = useState<string | null>(null);
  // Motor fixo: a escolha deixou de ser oferecida na interface, e o backend
  // segue aceitando o parâmetro.
  const mode: OcrMode = 'gemini';

  // ─── Passo 4 — destino do cadastro ────────────────────────────────────────
  const mayCreateAsset = can('asset:create');
  const [target, setTarget] = useState<Target>(mayCreateAsset ? 'new' : 'existing');
  const [areas, setAreas] = useState<Area[]>([]);
  const [linkAssetId, setLinkAssetId] = useState(assetId ?? '');
  // Célula, não ponto livre: o ativo nasce alinhado à mesma malha que o editor
  // de layout usa, em vez de numa coordenada arbitrária que teria de ser
  // realinhada depois.
  const [cell, setCell] = useState<CellRect | null>(null);
  const [assetForm, setAssetForm] = useState({
    tag: '',
    name: '',
    type: 'motor' as Asset['type'],
    areaId: '',
    location: '',
    criticality: 'medium' as NewAssetInput['criticality'],
  });

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [result, setResult] = useState<{ imageUploaded: boolean; label: string } | null>(null);

  // O objectURL é um recurso do browser: sem revogar, cada upload vaza um blob.
  const previewRef = useRef<string | null>(null);
  const releasePreview = () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
  };
  useEffect(() => releasePreview, []);

  // Dados de destino só são necessários no passo 4 — não custa nada no boot.
  useEffect(() => {
    if (step !== 4 || areas.length > 0) return;
    apiService.getAreas().then(setAreas).catch(() => setAreas([]));
  }, [step, areas.length]);

  const isMock = extraction?.modelUsed === 'mock';

  // ─── Posicionamento por célula ────────────────────────────────────────────
  // O hall sai da ÁREA escolhida no formulário: assim o ativo não pode nascer
  // com área "Hall A" e desenhado dentro do Hall C — a incoerência que o editor
  // de layout existe para impedir.
  const pickHall = hallForArea(areas.find((a) => a.id === assetForm.areaId)?.name ?? '');
  const pickFootprint = footprintOf(assetForm.type);
  const occupiedRects = assets.map(footprintCells);

  // Trocar o tipo muda o tamanho da pegada, e trocar a área muda o hall: a
  // célula escolhida antes pode não valer mais, então volta a ser nenhuma.
  useEffect(() => {
    setCell(null);
  }, [assetForm.type, assetForm.areaId]);

  const processFile = async (picked: File) => {
    releasePreview();
    const url = URL.createObjectURL(picked);
    previewRef.current = url;
    setPreviewUrl(url);
    setFile(picked);
    setStep(2);
    setOcrError(null);
    try {
      const extracted = await apiService.extractNameplate(picked, { mode });
      setExtraction(extracted);
      setForm(extracted.nameplate);
      setStep(3);
    } catch (err) {
      setOcrError((err as Error)?.message || t.ocr_failed);
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

  const setField = (key: keyof MotorNameplate, raw: string) => {
    const value = NUMERIC_FIELDS.includes(key)
      ? (raw === '' ? undefined : Number(raw))
      : raw;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  /** O que ainda falta para o cadastro poder ser gravado. */
  const targetError = (): string | null => {
    if (target === 'existing') {
      return linkAssetId ? null : t.err_pick_asset;
    }
    if (!mayCreateAsset) return t.role_denied;
    if (!assetForm.tag.trim() || !assetForm.name.trim()) return t.err_required_fields;
    if (!assetForm.areaId) return t.err_pick_area;
    if (!cell) return t.err_pick_position;
    return null;
  };

  /**
   * Grava a placa como rascunho, cria/resolve o ativo e só então confirma.
   *
   * A ordem importa: se a criação do ativo falhar (TAG repetida, RLS), o que
   * sobra é uma placa `draft` sem vínculo — invisível para a view, para o
   * assistente e para a lista de registros recentes, que filtram `confirmed`.
   * Criar o ativo primeiro deixaria um órfão que só um admin apagaria.
   */
  const handleRegister = async () => {
    if (!extraction || isMock || saving) return;

    const invalid = targetError();
    if (invalid) { setSaveError(invalid); return; }

    setSaving(true);
    setSaveError(null);

    try {
      // A imagem é evidência, não o dado: se o Storage falhar, o cadastro segue
      // e a tela de sucesso avisa que a evidência não subiu.
      let image: { url: string; path: string } | null = null;
      if (file) {
        try {
          image = await apiService.uploadEquipmentImage(file);
        } catch (err) {
          console.warn('[ocr] falha ao enviar a imagem da placa:', (err as Error).message);
        }
      }

      const nameplateId = await apiService.registerNameplate(null, form, image, {
        provider: extraction.modelUsed,
        confidence: form.ocrConfidence,
        motorType: extraction.motorType,
        status: 'draft',
        // Já é JSON puro — veio da resposta HTTP do serviço de OCR. O cast só
        // existe porque `FieldValue.value` é `unknown` do lado do cliente.
        raw: {
          campos: extraction.rawFields,
          validacao: extraction.validation,
          processing_time_ms: extraction.processingTimeMs,
          model_used: extraction.modelUsed,
        } as unknown as Json,
      });

      let targetAssetId: string;
      let label: string;

      if (target === 'new') {
        const area = areas.find((a) => a.id === assetForm.areaId);
        if (!area) throw new Error(t.err_pick_area);

        targetAssetId = await apiService.createAsset({
          tag: assetForm.tag.trim().toUpperCase(),
          name: assetForm.name.trim(),
          type: assetForm.type,
          areaId: area.id,
          plantId: area.plantId,
          location: assetForm.location.trim() || area.name,
          criticality: assetForm.criticality,
          ...rectToPlant(cell!),
        });
        label = assetForm.tag.trim().toUpperCase();
      } else {
        targetAssetId = linkAssetId;
        label = assets.find((a) => a.id === linkAssetId)?.tag ?? '';
      }

      await apiService.confirmNameplate(nameplateId, targetAssetId);

      // Recarrega a frota: o ativo novo precisa aparecer na planta, no dashboard
      // e na lista de ativos que o assistente lê a cada turno.
      try {
        setAssets(await apiService.getAssets());
      } catch (err) {
        console.warn('[ocr] cadastro gravado, mas a frota não recarregou:', (err as Error).message);
      }

      setResult({ imageUploaded: !!image, label });
      setStep(5);
      onRegistered?.();
    } catch (err) {
      setSaveError((err as Error)?.message || t.err_generic);
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    releasePreview();
    setStep(1);
    setPreviewUrl(null);
    setFile(null);
    setExtraction(null);
    setForm({});
    setOcrError(null);
    setSaveError(null);
    setResult(null);
    setCell(null);
    setLinkAssetId(assetId ?? '');
    setAssetForm({
      tag: '', name: '', type: 'motor', areaId: '', location: '', criticality: 'medium',
    });
  };

  // A interface não expõe qual motor leu a placa: para quem cadastra, o que
  // importa é se a leitura foi real ou simulada. Só `mock` precisa se anunciar,
  // porque muda a confiança no dado.
  const modelLabel = (model: string) => (model === 'mock' ? t.simulated : t.trace_model_auto);

  const fields: { label: string; key: keyof MotorNameplate; icon: React.ElementType; type?: string }[] = [
    { label: t.field_manufacturer, key: 'manufacturer', icon: FileText },
    { label: t.field_model, key: 'model', icon: FileText },
    { label: t.field_serial, key: 'serialNumber', icon: FileText },
    { label: t.field_power_kw, key: 'power_kw', icon: Zap, type: 'number' },
    { label: t.field_power_cv, key: 'power_cv', icon: Zap, type: 'number' },
    { label: t.field_voltage, key: 'voltage', icon: Zap },
    { label: t.field_current, key: 'current_a', icon: Zap, type: 'number' },
    { label: t.field_rpm, key: 'rpm', icon: RefreshCw, type: 'number' },
    { label: t.field_poles, key: 'poles', icon: RefreshCw, type: 'number' },
    { label: t.field_connection, key: 'connection', icon: RefreshCw },
    { label: t.field_ip_class, key: 'ip_class', icon: Shield },
    { label: t.field_insulation_class, key: 'insulation_class', icon: Shield },
  ];

  const inputClass = 'w-full h-10 bg-card-hover border border-border rounded-lg px-3 text-sm font-medium text-foreground focus:outline-none focus:border-primary/50 transition-all';
  const labelClass = 'text-[10px] font-bold uppercase tracking-widest text-muted flex items-center gap-1.5';

  return (
    <div data-tour="equipment-registration" className="saas-card overflow-hidden animate-fade-in">
      {/* Header / Stepper */}
      <div className="px-4 sm:px-6 py-4 border-b border-border flex flex-wrap items-center justify-between gap-3 bg-card-hover">
        <div className="flex min-w-0 items-center gap-3">
          <div className="w-8 h-8 flex-shrink-0 rounded bg-card-hover border border-border flex items-center justify-center text-primary">
            <Bot size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-sm text-foreground">{t.pipeline_title}</h2>
            <p className="text-[10px] text-muted">{t.pipeline_subtitle}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {[
            { n: 1, label: t.step_upload },
            { n: 2, label: t.step_ocr },
            { n: 3, label: t.step_review },
            { n: 4, label: t.step_target },
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
              {n < 4 && <div className={`w-6 h-px ${step > n ? 'bg-emerald-500' : 'bg-border'}`} />}
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-6 lg:p-8">
        {/* STEP 1 — Upload */}
        {step === 1 && (
          <div className="space-y-6">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-6 sm:p-12 text-center flex flex-col items-center justify-center transition-all cursor-pointer ${
                isDragActive ? 'border-primary bg-primary/5' : 'border-border bg-card-hover hover:border-primary/50 hover:bg-border/40'
              }`}
            >
              <input {...getInputProps()} />
              <div className="w-12 h-12 rounded-lg bg-card-hover border border-border flex items-center justify-center mb-4 text-muted">
                <Upload size={24} />
              </div>
              <p className="font-bold text-sm text-foreground">{t.drop_hint}</p>
              <p className="text-xs text-muted mt-1">{t.file_hint}</p>
            </div>

            {ocrError && (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-red-500/5 border border-red-500/20 text-red-400">
                <AlertCircle size={16} className="flex-shrink-0" />
                <p className="text-xs font-medium">{ocrError}</p>
              </div>
            )}

            <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/5 border border-amber-500/10 text-amber-500/80">
              <AlertCircle size={16} className="flex-shrink-0" />
              <p className="text-xs font-medium">{t.capture_hint}</p>
            </div>

            {/* Pipeline visual */}
            <div className="p-4 rounded-xl bg-card-hover border border-border">
              <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-3">{t.pipeline_vision_title}</p>
              <div className="flex items-center gap-2 flex-wrap">
                {t.pipeline_stages.map((stage, i, arr) => (
                  <React.Fragment key={stage}>
                    <span className="px-2 py-1 rounded bg-card-hover border border-border text-[9px] font-bold text-muted uppercase">{stage}</span>
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
            <h3 className="text-foreground">{t.pipeline_running}</h3>
            <div className="mt-4 space-y-1.5 text-left">
              {t.processing_stages.map((msg, i) => (
                <div key={i} className={`flex items-center gap-2 text-xs ${i <= 2 ? 'text-emerald-400' : 'text-muted animate-pulse'}`}>
                  {i <= 2 ? <CheckCircle2 size={12} /> : <Loader2 size={12} className="animate-spin" />}
                  {msg}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3 — Review */}
        {step === 3 && extraction && (
          <div className="animate-fade-in space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border">
              <div className="flex items-center gap-2 text-emerald-500">
                <Sparkles size={14} />
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  {t.extraction_done} {form.ocrConfidence ?? '?'}{t.confidence_suffix}
                </span>
              </div>
              <button onClick={reset} className="text-[10px] font-bold text-muted hover:text-primary flex items-center gap-1.5 transition-colors">
                <RefreshCw size={12} />
                {t.new_upload}
              </button>
            </div>

            {previewUrl && (
              <img src={previewUrl} alt="Placa capturada" className="w-full h-32 object-cover rounded-lg border border-border" />
            )}

            {/* Metadados do pipeline */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-card-hover border border-border text-[10px] font-bold text-foreground-soft">
                <Cpu size={11} className="text-primary" />
                {modelLabel(extraction.modelUsed)}
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
                {extraction.validation.consistente ? t.consistent_validation : t.check_fields}
              </span>
            </div>

            {/* Backend de OCR offline — dados aleatórios não podem ser gravados */}
            {isMock && (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-red-500/5 border border-red-500/20 text-red-400">
                <Lock size={16} className="flex-shrink-0 mt-0.5" />
                <p className="text-xs font-medium leading-relaxed">{t.mock_blocked}</p>
              </div>
            )}

            {/* Alertas da validação física */}
            {extraction.validation.alertas.length > 0 && (
              <div className="p-4 rounded-lg bg-amber-500/5 border border-amber-500/20 space-y-2">
                <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertCircle size={12} />
                  {t.validation_alerts}
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 md:gap-x-8 gap-y-5">
              {fields.map(({ label, key, icon: Icon, type }) => (
                <div key={key} className="space-y-1.5">
                  <label className={labelClass}>
                    <Icon size={10} />
                    {label}
                  </label>
                  <input
                    type={type ?? 'text'}
                    value={String(form[key] ?? '')}
                    onChange={(e) => setField(key, e.target.value)}
                    className={inputClass}
                  />
                </div>
              ))}
            </div>

            <div className="pt-6 flex flex-col gap-3 sm:flex-row">
              <button onClick={reset} className="h-11 rounded-lg font-bold text-xs bg-card-hover text-muted hover:bg-border transition-all sm:flex-1">
                {t.cancel}
              </button>
              <button
                onClick={() => setStep(4)}
                disabled={isMock}
                className="h-11 rounded-lg font-bold text-xs bg-primary text-white hover:bg-primary/90 transition-all flex items-center justify-center gap-2 sm:flex-[2] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t.continue_to_target}
                <ArrowRightIcon />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4 — Destino do cadastro */}
        {step === 4 && (
          <div className="animate-fade-in space-y-6">
            <div className="pb-4 border-b border-border">
              <h3 className="font-bold text-sm text-foreground">{t.target_title}</h3>
              <p className="text-xs text-muted mt-1">{t.target_subtitle}</p>
            </div>

            {/* Seletor de modo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                { id: 'new' as Target, label: t.target_new, hint: t.target_new_hint, icon: PlusCircle, disabled: !mayCreateAsset },
                { id: 'existing' as Target, label: t.target_existing, hint: t.target_existing_hint, icon: Link2, disabled: false },
              ]).map(({ id, label, hint, icon: Icon, disabled }) => (
                <button
                  key={id}
                  type="button"
                  disabled={disabled}
                  onClick={() => { setTarget(id); setSaveError(null); }}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    target === id
                      ? 'bg-primary/5 border-primary/40'
                      : 'bg-card-hover border-border hover:border-primary/30'
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  <span className="flex items-center gap-2 font-bold text-xs text-foreground">
                    <Icon size={14} className={target === id ? 'text-primary' : 'text-muted'} />
                    {label}
                    {disabled && <Lock size={11} className="text-muted" />}
                  </span>
                  <span className="block text-[11px] text-muted mt-1.5 leading-relaxed">{hint}</span>
                </button>
              ))}
            </div>

            {!mayCreateAsset && (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/5 border border-amber-500/20 text-amber-500/90">
                <Lock size={16} className="flex-shrink-0 mt-0.5" />
                <p className="text-xs font-medium leading-relaxed">{t.role_denied}</p>
              </div>
            )}

            {/* Vincular a ativo existente */}
            {target === 'existing' && (
              <div className="space-y-1.5">
                <label className={labelClass}>
                  <Link2 size={10} />
                  {t.field_asset}
                </label>
                <select
                  value={linkAssetId}
                  onChange={(e) => setLinkAssetId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">{t.pick_asset_placeholder}</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>{a.tag} — {a.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Criar ativo novo */}
            {target === 'new' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 md:gap-x-8 gap-y-5">
                  <div className="space-y-1.5">
                    <label className={labelClass}><Tag size={10} />{t.field_tag} *</label>
                    <input
                      value={assetForm.tag}
                      onChange={(e) => setAssetForm((f) => ({ ...f, tag: e.target.value.toUpperCase() }))}
                      placeholder={t.tag_placeholder}
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClass}><FileText size={10} />{t.field_asset_name} *</label>
                    <input
                      value={assetForm.name}
                      onChange={(e) => setAssetForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder={t.asset_name_placeholder}
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClass}><Cpu size={10} />{t.field_asset_type}</label>
                    <select
                      value={assetForm.type}
                      onChange={(e) => setAssetForm((f) => ({ ...f, type: e.target.value as Asset['type'] }))}
                      className={inputClass}
                    >
                      {ASSET_TYPES.map((v) => (
                        <option key={v} value={v}>{t.asset_types[v]}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClass}><MapPin size={10} />{t.field_area} *</label>
                    <select
                      value={assetForm.areaId}
                      onChange={(e) => setAssetForm((f) => ({ ...f, areaId: e.target.value }))}
                      className={inputClass}
                    >
                      <option value="">{t.pick_area_placeholder}</option>
                      {areas.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClass}><MapPin size={10} />{t.field_location}</label>
                    <input
                      value={assetForm.location}
                      onChange={(e) => setAssetForm((f) => ({ ...f, location: e.target.value }))}
                      placeholder={t.location_placeholder}
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClass}><Shield size={10} />{t.field_criticality}</label>
                    <select
                      value={assetForm.criticality}
                      onChange={(e) => setAssetForm((f) => ({ ...f, criticality: e.target.value as NewAssetInput['criticality'] }))}
                      className={inputClass}
                    >
                      {CRITICALITIES.map((v) => (
                        <option key={v} value={v}>{t.criticalities[v]}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Posição na planta — por célula, como no editor de layout */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className={labelClass}><MapPin size={10} />{t.field_position} *</label>
                    <span className="text-[10px] font-mono text-muted">
                      {!pickHall
                        ? t.position_pick_area_first
                        : cell
                          ? `${pickFootprint[0]}×${pickFootprint[1]} · ${t.position_cell} ${cell.col},${cell.row}`
                          : t.position_hint}
                    </span>
                  </div>
                  {pickHall ? (
                    <div className={`rounded-xl border overflow-hidden transition-all ${cell ? 'border-primary/40' : 'border-border'}`}>
                      <PlantFloorMap
                        assets={assets}
                        selectedAssetId={null}
                        onSelectAsset={() => {}}
                        pickMode
                        pickFootprint={pickFootprint}
                        pickHall={pickHall}
                        pendingCell={cell}
                        occupiedRects={occupiedRects}
                        onPickCell={(rect) => { setCell(rect); setSaveError(null); }}
                      />
                    </div>
                  ) : (
                    // Sem área não há hall, e sem hall não há onde validar a
                    // célula. Pedir a área antes evita oferecer a planta inteira
                    // e depois recusar quase tudo.
                    <div className="rounded-xl border border-dashed border-border bg-card-hover px-6 py-10 text-center">
                      <MapPin size={20} className="mx-auto mb-2 text-muted" />
                      <p className="text-xs font-medium text-muted">{t.position_pick_area_first}</p>
                    </div>
                  )}
                </div>

                {/* O ativo nasce sem instrumentação */}
                <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/5 border border-amber-500/20 text-amber-500/90">
                  <GaugeCircle size={16} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold">{t.no_sensors_title}</p>
                    <p className="text-[11px] mt-1 leading-relaxed">{t.no_sensors_desc}</p>
                  </div>
                </div>
              </div>
            )}

            {saveError && (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-red-500/5 border border-red-500/20 text-red-400">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                <p className="text-xs font-medium leading-relaxed">{saveError}</p>
              </div>
            )}

            <div className="pt-2 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => { setStep(3); setSaveError(null); }}
                disabled={saving}
                className="h-11 rounded-lg font-bold text-xs bg-card-hover text-muted hover:bg-border transition-all sm:flex-1 disabled:opacity-40"
              >
                {t.back}
              </button>
              <button
                onClick={handleRegister}
                disabled={saving}
                className="h-11 rounded-lg font-bold text-xs bg-primary text-white hover:bg-primary/90 transition-all flex items-center justify-center gap-2 sm:flex-[2] disabled:opacity-60 disabled:cursor-wait"
              >
                {saving
                  ? <><Loader2 size={16} className="animate-spin" />{t.saving}</>
                  : <><CheckCircle2 size={16} />{t.confirm_registration}</>}
              </button>
            </div>
          </div>
        )}

        {/* STEP 5 — Success */}
        {step === 5 && (
          <div className="py-16 flex flex-col items-center justify-center text-center animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-center mb-6">
              <CheckCircle2 size={32} className="text-emerald-500" />
            </div>
            <h3 className="text-xl font-bold text-foreground">{t.registered_title}</h3>
            <p className="text-sm text-muted mt-2 max-w-[320px]">
              {t.registered_desc}
            </p>
            <div className="mt-6 p-4 rounded-xl bg-card-hover border border-border text-left w-full max-w-xs">
              <p className="text-[10px] text-muted mb-2 font-bold uppercase tracking-wider">{t.traceability}</p>
              <div className="space-y-1 text-xs text-muted">
                {result?.label && <p>{t.trace_asset} {result.label}</p>}
                <p>{result?.imageUploaded ? t.trace_image : t.trace_image_failed}</p>
                <p>{t.trace_model} {modelLabel(extraction?.modelUsed ?? '')}</p>
                <p>{t.trace_confidence} {form.ocrConfidence ?? '?'}%</p>
                <p>{t.trace_registration} {new Date().toLocaleString(locale)}</p>
              </div>
            </div>
            {target === 'new' && (
              <p className="mt-4 text-[11px] text-amber-500/90 max-w-xs leading-relaxed">
                {t.no_sensors_success}
              </p>
            )}
            <button onClick={reset} className="mt-8 px-6 py-2.5 rounded-lg bg-card-hover border border-border font-bold text-xs text-foreground hover:bg-border transition-all">
              {t.register_another}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/** Seta do botão "continuar" — inline para não crescer a lista de imports. */
const ArrowRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);
