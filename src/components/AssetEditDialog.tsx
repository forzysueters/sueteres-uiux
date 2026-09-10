import React, { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, MapPin, Save, Tag as TagIcon } from 'lucide-react';
import { Dialog } from './Dialog';
import { Asset, NewAssetInput } from '../types';
import { apiService } from '../services/api';
import { useAppStore } from '../store/appStore';
import { translations } from '../translations';

const TYPES: Asset['type'][] = ['motor', 'pump', 'compressor', 'fan'];
const CRITICALITIES: NewAssetInput['criticality'][] = ['low', 'medium', 'high', 'critical'];

interface AssetEditDialogProps {
  asset: Asset | null;
  onClose: () => void;
  /** Chamado após salvar, para a lista recarregar. */
  onSaved: () => void;
}

/**
 * Edição dos dados cadastrais do ativo.
 *
 * Área e posição ficam de fora de propósito: mudar de hall exige reposicionar
 * junto, senão o ativo passa a ser desenhado fora da própria área. Isso é
 * trabalho do editor de layout, e o rodapé deste diálogo diz onde encontrá-lo —
 * sem esse aviso, a pessoa procura o campo aqui e conclui que não é possível.
 */
export const AssetEditDialog: React.FC<AssetEditDialogProps> = ({ asset, onClose, onSaved }) => {
  const { language } = useAppStore();
  const t = translations[language].assetEdit;
  const tf = translations[language].equipmentForm;

  const [form, setForm] = useState({
    tag: '', name: '', type: 'motor' as Asset['type'],
    location: '', criticality: 'medium' as NewAssetInput['criticality'],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recomeça a cada ativo aberto: um diálogo reaproveitado não pode herdar o
  // rascunho do ativo anterior.
  useEffect(() => {
    if (!asset) return;
    setForm({
      tag: asset.tag,
      name: asset.name,
      type: asset.type,
      location: asset.location ?? '',
      criticality: asset.criticality,
    });
    setError(null);
  }, [asset]);

  const dirty = !!asset && (
    form.tag !== asset.tag
    || form.name !== asset.name
    || form.type !== asset.type
    || form.location !== (asset.location ?? '')
    || form.criticality !== asset.criticality
  );

  const handleSave = async () => {
    if (!asset || saving) return;
    if (!form.tag.trim() || !form.name.trim()) { setError(t.err_required); return; }

    setSaving(true);
    setError(null);
    try {
      await apiService.updateAsset(asset.id, {
        tag: form.tag.trim().toUpperCase(),
        name: form.name.trim(),
        type: form.type,
        location: form.location.trim(),
        criticality: form.criticality,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error)?.message ?? t.err_generic);
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full h-10 bg-card-hover border border-border rounded-lg px-3 text-sm font-medium text-foreground focus:outline-none focus:border-primary/50 transition-all';
  const labelClass = 'text-[10px] font-bold uppercase tracking-widest text-muted flex items-center gap-1.5';

  return (
    <Dialog
      open={asset !== null}
      onOpenChange={(open) => { if (!open) onClose(); }}
      title={t.title.replace('{tag}', asset?.tag ?? '')}
      description={t.subtitle}
      className="max-w-lg"
    >
      {asset && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={labelClass}><TagIcon size={10} />{tf.field_tag} *</label>
              <input
                value={form.tag}
                onChange={(e) => setForm((f) => ({ ...f, tag: e.target.value.toUpperCase() }))}
                className={`${inputClass} font-mono`}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>{tf.field_asset_name} *</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>{tf.field_asset_type}</label>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as Asset['type'] }))}
                className={inputClass}
              >
                {TYPES.map((v) => <option key={v} value={v}>{tf.asset_types[v]}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>{tf.field_criticality}</label>
              <select
                value={form.criticality}
                onChange={(e) => setForm((f) => ({ ...f, criticality: e.target.value as NewAssetInput['criticality'] }))}
                className={inputClass}
              >
                {CRITICALITIES.map((v) => <option key={v} value={v}>{tf.criticalities[v]}</option>)}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className={labelClass}><MapPin size={10} />{tf.field_location}</label>
              <input
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                placeholder={tf.location_placeholder}
                className={inputClass}
              />
            </div>
          </div>

          {/* Onde mora o que este diálogo não faz. */}
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-card-hover border border-border">
            <MapPin size={14} className="flex-shrink-0 mt-0.5 text-muted" />
            <p className="text-[11px] text-muted leading-relaxed">
              <span className="font-bold text-foreground-soft">{asset.area}</span> — {t.area_note}
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-500/5 border border-red-500/20 text-red-400">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              <p className="text-[11px] font-medium leading-relaxed">{error}</p>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              onClick={onClose}
              disabled={saving}
              className="h-10 rounded-lg font-bold text-xs bg-card-hover border border-border text-muted hover:bg-border transition-all sm:flex-1 disabled:opacity-40"
            >
              {tf.cancel}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !dirty}
              className="h-10 rounded-lg font-bold text-xs bg-primary text-white hover:bg-primary/90 transition-all flex items-center justify-center gap-2 sm:flex-[2] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving
                ? <><Loader2 size={14} className="animate-spin" />{t.saving}</>
                : <><Save size={14} />{t.save}</>}
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
};
