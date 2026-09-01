import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Send, CalendarDays, Clock, User as UserIcon, Check, RotateCcw, Loader2 } from 'lucide-react';
import { Dialog } from './Dialog';
import { apiService } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { translations } from '../translations';
import {
  Asset, Technician, MaintenanceType, MaintenancePriority,
} from '../types';
import { cn } from '../lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: Asset;
  language: 'pt' | 'en';
}

type Step = 'type' | 'priority' | 'date' | 'time' | 'technician' | 'description' | 'confirm' | 'done';

interface Draft {
  type?: MaintenanceType;
  priority?: MaintenancePriority;
  date?: string;   // yyyy-mm-dd
  time?: string;   // HH:mm
  technician?: Technician;
  description?: string;
}

const TYPES: MaintenanceType[] = ['preventive', 'corrective', 'predictive', 'inspection', 'calibration'];
const PRIORITIES: MaintenancePriority[] = ['low', 'medium', 'high', 'critical'];
const SLOTS = ['08:00', '10:00', '13:00', '15:00', '17:00'];

const toISODate = (d: Date) => {
  // Fatiar o toISOString() daria o dia em UTC, o que troca a data à noite no
  // fuso do Brasil. Aqui o dia é montado a partir dos campos locais.
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/**
 * Agendamento de manutenção em formato de conversa: o bot pergunta, o usuário
 * responde por botões fixos (ou digita a descrição). Grava uma OM real em
 * public.maintenance_orders ao confirmar.
 */
export const MaintenanceScheduler: React.FC<Props> = ({ open, onOpenChange, asset, language }) => {
  const t = translations[language].scheduler;
  const locale = language === 'pt' ? 'pt-BR' : 'en-US';
  const user = useAuthStore((s) => s.user);
  // can_write() no banco cobre admin/engineer/technician; avisar antes evita o
  // usuário preencher a conversa inteira e só então tomar erro de permissão.
  const canWrite = !!user && user.role !== 'viewer';

  const [draft, setDraft] = useState<Draft>({});
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [techError, setTechError] = useState(false);
  const [descInput, setDescInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const reset = () => {
    setDraft({});
    setDescInput('');
    setSaveError(null);
    setOrderNumber(null);
  };

  useEffect(() => {
    if (!open) return;
    reset();
    apiService.getTechnicians()
      .then((list) => { setTechnicians(list); setTechError(false); })
      .catch(() => setTechError(true));
  }, [open]);

  const step: Step = useMemo(() => {
    if (orderNumber) return 'done';
    if (!draft.type) return 'type';
    if (!draft.priority) return 'priority';
    if (!draft.date) return 'date';
    if (!draft.time) return 'time';
    if (!draft.technician) return 'technician';
    if (draft.description === undefined) return 'description';
    return 'confirm';
  }, [draft, orderNumber]);

  // Mantém a última pergunta visível conforme a conversa cresce. O `scrollTo?.`
  // guarda o método, não só o elemento: ambientes sem ele (jsdom) quebrariam.
  useEffect(() => {
    const el = scrollRef.current;
    el?.scrollTo?.({ top: el.scrollHeight, behavior: 'smooth' });
  }, [step]);

  const dateOptions = useMemo(() => {
    const today = new Date();
    const mk = (offset: number, label: string) => {
      const d = new Date(today);
      d.setDate(d.getDate() + offset);
      return { value: toISODate(d), label };
    };
    return [mk(0, t.today), mk(1, t.tomorrow), mk(7, t.next_week)];
  }, [t]);

  const prettyDate = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString(locale, {
      weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
    });

  const handleConfirm = async () => {
    if (!draft.type || !draft.priority || !draft.date || !draft.time || !draft.technician) return;
    setSaving(true);
    setSaveError(null);
    try {
      const scheduledFor = new Date(`${draft.date}T${draft.time}:00`).toISOString();
      const { orderNumber: num } = await apiService.createMaintenanceOrder({
        assetId: asset.id,
        type: draft.type,
        priority: draft.priority,
        title: `${t.types[draft.type]} — ${asset.tag}`,
        description: draft.description ?? '',
        scheduledFor,
        assignedTo: draft.technician.id,
      });
      setOrderNumber(num);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t.save_error);
    } finally {
      setSaving(false);
    }
  };

  /* ── Transcrição derivada do rascunho: sem lista de mensagens em estado
        paralelo, então voltar/recomeçar nunca deixa bolha órfã. ── */
  const bubbles: { from: 'bot' | 'user'; text: string }[] = [];
  bubbles.push({ from: 'bot', text: t.greeting.replace('{asset}', `${asset.tag} — ${asset.name}`) });
  bubbles.push({ from: 'bot', text: t.ask_type });
  if (draft.type) {
    bubbles.push({ from: 'user', text: t.types[draft.type] });
    bubbles.push({ from: 'bot', text: t.ask_priority });
  }
  if (draft.priority) {
    bubbles.push({ from: 'user', text: t.priorities[draft.priority] });
    bubbles.push({ from: 'bot', text: t.ask_date });
  }
  if (draft.date) {
    bubbles.push({ from: 'user', text: prettyDate(draft.date) });
    bubbles.push({ from: 'bot', text: t.ask_time });
  }
  if (draft.time) {
    bubbles.push({ from: 'user', text: draft.time });
    bubbles.push({ from: 'bot', text: techError ? t.tech_error : t.ask_technician });
  }
  if (draft.technician) {
    bubbles.push({ from: 'user', text: draft.technician.name });
    bubbles.push({ from: 'bot', text: t.ask_description });
  }
  if (draft.description !== undefined) {
    bubbles.push({ from: 'user', text: draft.description || t.no_description });
    bubbles.push({ from: 'bot', text: t.ask_confirm });
  }
  if (orderNumber) {
    bubbles.push({ from: 'bot', text: t.done.replace('{order}', orderNumber) });
  }

  const Option: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-lg border border-border bg-card-hover text-xs font-medium text-foreground-soft hover:border-primary/40 hover:text-foreground transition-colors"
    >
      {children}
    </button>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t.title}
      description={`${asset.tag} · ${asset.name}`}
      className="max-w-lg"
    >
      {!canWrite ? (
        <p className="text-sm text-muted py-6 text-center">{t.no_permission}</p>
      ) : (
        <>
          {/* Transcrição */}
          <div ref={scrollRef} className="max-h-[46vh] overflow-y-auto scrollbar-thin space-y-2 pr-1">
            {bubbles.map((b, i) => (
              <div key={i} className={cn('flex gap-2', b.from === 'user' && 'justify-end')}>
                {b.from === 'bot' && (
                  <div className="flex-shrink-0 w-6 h-6 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center mt-0.5">
                    <Bot size={12} className="text-primary" />
                  </div>
                )}
                <p
                  className={cn(
                    'text-xs leading-relaxed rounded-xl px-3 py-2 max-w-[80%]',
                    b.from === 'bot'
                      ? 'bg-card-hover border border-border text-foreground-soft'
                      : 'bg-primary/12 border border-primary/25 text-foreground',
                  )}
                >
                  {b.text}
                </p>
              </div>
            ))}
          </div>

          {/* Área de resposta — muda conforme a etapa */}
          <div className="mt-4 pt-4 border-t border-border">
            {step === 'type' && (
              <div className="flex flex-wrap gap-2">
                {TYPES.map((v) => (
                  <Option key={v} onClick={() => setDraft((d) => ({ ...d, type: v }))}>{t.types[v]}</Option>
                ))}
              </div>
            )}

            {step === 'priority' && (
              <div className="flex flex-wrap gap-2">
                {PRIORITIES.map((v) => (
                  <Option key={v} onClick={() => setDraft((d) => ({ ...d, priority: v }))}>{t.priorities[v]}</Option>
                ))}
              </div>
            )}

            {step === 'date' && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {dateOptions.map((o) => (
                    <Option key={o.value} onClick={() => setDraft((d) => ({ ...d, date: o.value }))}>
                      <CalendarDays size={12} className="inline mr-1.5 -mt-0.5" />
                      {o.label}
                    </Option>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-[11px] text-muted">
                  {t.other_date}
                  <input
                    type="date"
                    min={toISODate(new Date())}
                    onChange={(e) => e.target.value && setDraft((d) => ({ ...d, date: e.target.value }))}
                    className="bg-card-hover border border-border rounded-lg px-2 py-1 text-xs text-foreground"
                  />
                </label>
              </div>
            )}

            {step === 'time' && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {SLOTS.map((v) => (
                    <Option key={v} onClick={() => setDraft((d) => ({ ...d, time: v }))}>
                      <Clock size={12} className="inline mr-1.5 -mt-0.5" />
                      {v}
                    </Option>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-[11px] text-muted">
                  {t.other_time}
                  <input
                    type="time"
                    onChange={(e) => e.target.value && setDraft((d) => ({ ...d, time: e.target.value }))}
                    className="bg-card-hover border border-border rounded-lg px-2 py-1 text-xs text-foreground"
                  />
                </label>
              </div>
            )}

            {step === 'technician' && (
              <div className="flex flex-wrap gap-2">
                {technicians.length === 0 ? (
                  <p className="text-xs text-muted">{techError ? t.tech_error : t.no_technicians}</p>
                ) : (
                  technicians.map((tech) => (
                    <Option key={tech.id} onClick={() => setDraft((d) => ({ ...d, technician: tech }))}>
                      <UserIcon size={12} className="inline mr-1.5 -mt-0.5" />
                      {tech.name}
                      <span className="text-muted ml-1">· {tech.jobTitle ?? t.roles[tech.role]}</span>
                    </Option>
                  ))
                )}
              </div>
            )}

            {step === 'description' && (
              <div className="space-y-2">
                <textarea
                  value={descInput}
                  onChange={(e) => setDescInput(e.target.value)}
                  rows={3}
                  placeholder={t.description_placeholder}
                  className="w-full bg-card-hover border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-soft resize-none focus:outline-none focus:border-primary/40"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setDraft((d) => ({ ...d, description: '' }))}
                    className="btn-ghost text-xs"
                  >
                    {t.skip}
                  </button>
                  <button
                    onClick={() => setDraft((d) => ({ ...d, description: descInput.trim() }))}
                    className="btn-primary text-xs"
                  >
                    <Send size={13} />
                    {t.send}
                  </button>
                </div>
              </div>
            )}

            {step === 'confirm' && (
              <div className="space-y-3">
                {saveError && <p className="text-xs text-red-500">{saveError}</p>}
                <div className="flex justify-end gap-2">
                  <button onClick={reset} className="btn-ghost text-xs" disabled={saving}>
                    <RotateCcw size={13} />
                    {t.restart}
                  </button>
                  <button onClick={handleConfirm} className="btn-primary text-xs" disabled={saving}>
                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    {saving ? t.saving : t.confirm}
                  </button>
                </div>
              </div>
            )}

            {step === 'done' && (
              <div className="flex justify-end gap-2">
                <button onClick={reset} className="btn-ghost text-xs">
                  <RotateCcw size={13} />
                  {t.schedule_another}
                </button>
                <button onClick={() => onOpenChange(false)} className="btn-primary text-xs">
                  {t.close}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </Dialog>
  );
};
