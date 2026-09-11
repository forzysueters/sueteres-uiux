import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Send, CalendarDays, Clock, User as UserIcon, Check, RotateCcw, Loader2, X } from 'lucide-react';
import { AvatarFace } from '../assistant/AvatarFace';
import { ASSISTANT_NAME } from '../assistant/copy';
import { apiService } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { usePermissions } from '../hooks/usePermissions';
import { translations } from '../translations';
import {
  Asset, Technician, MaintenanceType, MaintenancePriority,
} from '../types';
import type { AvatarState } from '../assistant/types';
import { cn } from '../lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: Asset;
  language: 'pt' | 'en';
}

type Step = 'type' | 'priority' | 'date' | 'time' | 'technician' | 'description' | 'confirm' | 'done';

/** Estado do e-mail de confirmação, mostrado como última bolha da conversa. */
type EmailState = 'idle' | 'sending' | 'sent' | 'failed' | 'not_configured';

interface Draft {
  type?: MaintenanceType;
  priority?: MaintenancePriority;
  date?: string;   // yyyy-mm-dd
  time?: string;   // HH:mm
  technician?: Technician;
  description?: string;
}

// O enum do banco aceita cinco tipos, mas a operação só abre OM destes dois —
// os outros continuam válidos para ordens vindas de outra origem.
const TYPES: MaintenanceType[] = ['preventive', 'corrective'];
const PRIORITIES: MaintenancePriority[] = ['low', 'medium', 'high', 'critical'];
const SLOTS = ['08:00', '10:00', '13:00', '15:00', '17:00'];

/** Etapas que contam para a barra de progresso (a de conclusão não é pergunta). */
const FLOW: Step[] = ['type', 'priority', 'date', 'time', 'technician', 'description', 'confirm'];
/** Sem o passo de responsável: o técnico abre ordem, mas só para si mesmo. */
const FLOW_SELF: Step[] = FLOW.filter((s) => s !== 'technician');

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Botão de resposta da conversa.
 *
 * Precisa viver FORA do componente: declarado dentro, viraria um tipo novo a
 * cada render, e o React desmontaria e remontaria o botão. A página do ativo
 * re-renderiza sozinha com a telemetria em tempo real — um update entre o
 * mousedown e o mouseup destruía o elemento no meio do gesto e o clique nunca
 * chegava a disparar.
 */
const Option: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <button
    onClick={onClick}
    className="rounded-lg border border-border bg-card-hover px-3 py-1.5 text-xs font-medium text-foreground-soft transition-colors hover:border-primary/40 hover:text-foreground"
  >
    {children}
  </button>
);

const toISODate = (d: Date) => {
  // Fatiar o toISOString() daria o dia em UTC, o que troca a data à noite no
  // fuso do Brasil. Aqui o dia é montado a partir dos campos locais.
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/**
 * Agendamento de manutenção em formato de conversa: o bot pergunta, o usuário
 * responde por botões fixos (ou digita a descrição). Grava uma OM real em
 * public.maintenance_orders ao confirmar e dispara os e-mails de confirmação.
 *
 * Veste a mesma casca do painel do Órion (assistant/AssistantPanel): é o mesmo
 * assistente falando, então aparecer como outro tipo de janela quebraria a
 * leitura. Vai ao body por portal porque `position: fixed` deixa de valer se
 * qualquer ancestral tiver transform — e a página do ativo é toda animada.
 */
export const MaintenanceScheduler: React.FC<Props> = ({ open, onOpenChange, asset, language }) => {
  const t = translations[language].scheduler;
  const locale = language === 'pt' ? 'pt-BR' : 'en-US';
  const user = useAuthStore((s) => s.user);
  // Abrir ordem é faixa 1; ATRIBUIR a outra pessoa é faixa 2. Sem a segunda, o
  // passo de responsável some e a ordem nasce no nome de quem a abriu — que é
  // exatamente o que o trigger `guard_maintenance_assignment` exige no banco.
  const { can } = usePermissions();
  const canWrite = can('maintenance:create');
  const mayAssign = can('maintenance:assign');

  const [draft, setDraft] = useState<Draft>({});

  // Quem não pode atribuir já entra atribuído a si mesmo.
  useEffect(() => {
    if (mayAssign || !user) return;
    setDraft((d) => (d.technician ? d : {
      ...d,
      technician: {
        id: user.id,
        name: user.name,
        role: user.role === 'engineer' ? 'engineer' : 'technician',
        jobTitle: user.jobTitle ?? null,
      },
    }));
  }, [mayAssign, user]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [techError, setTechError] = useState(false);
  const [descInput, setDescInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [emailState, setEmailState] = useState<EmailState>('idle');
  const scrollRef = useRef<HTMLDivElement>(null);

  const reset = () => {
    setDraft({});
    setDescInput('');
    setSaveError(null);
    setOrderNumber(null);
    setEmailState('idle');
  };

  useEffect(() => {
    if (!open) return;
    reset();
    apiService.getTechnicians()
      .then((list) => { setTechnicians(list); setTechError(false); })
      .catch(() => setTechError(true));
  }, [open]);

  // Sem foco preso como num modal, Esc é a única saída de teclado do painel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onOpenChange(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

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
  }, [step, emailState]);

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
      const { id, orderNumber: num } = await apiService.createMaintenanceOrder({
        assetId: asset.id,
        type: draft.type,
        priority: draft.priority,
        title: `${t.types[draft.type]} — ${asset.tag}`,
        description: draft.description ?? '',
        scheduledFor,
        assignedTo: draft.technician.id,
      });
      setOrderNumber(num);

      // A OM já está gravada: o e-mail é um passo à parte, e falhar aqui não
      // desfaz o agendamento — só muda a última bolha da conversa.
      setEmailState('sending');
      const dispatch = await apiService.sendMaintenanceEmail(id, language);
      setEmailState(
        dispatch.ok ? 'sent' : dispatch.reason === 'not_configured' ? 'not_configured' : 'failed',
      );
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
  if (orderNumber && emailState !== 'idle') {
    const EMAIL_TEXT: Record<Exclude<EmailState, 'idle'>, string> = {
      sending: t.email_sending,
      sent: t.email_sent.replace('{technician}', draft.technician?.name ?? ''),
      failed: t.email_failed,
      not_configured: t.email_not_configured,
    };
    bubbles.push({ from: 'bot', text: EMAIL_TEXT[emailState] });
  }

  const flow = mayAssign ? FLOW : FLOW_SELF;
  const stepIndex = step === 'done' ? flow.length : flow.indexOf(step);
  const busy = saving || emailState === 'sending';
  const avatarState: AvatarState = busy ? 'thinking' : step === 'done' ? 'idle' : 'listening';
  const statusLabel = saving
    ? t.status_saving
    : emailState === 'sending'
      ? t.status_sending
      : step === 'done'
        ? t.status_done
        : t.status_waiting;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.97 }}
          transition={{ duration: 0.32, ease: EASE }}
          className={cn(
            'fixed z-[70] flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-panel',
            'inset-x-3 bottom-3 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[382px]',
            'max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)]',
          )}
          role="dialog"
          aria-label={`${ASSISTANT_NAME} — ${t.title}`}
        >
          {/* ── Cabeçalho ──────────────────────────────────────────────── */}
          <div className="flex items-center gap-3 border-b border-border bg-card-hover px-4 py-3">
            <div className="flex-shrink-0">
              <AvatarFace size={44} state={avatarState} orbit={false} />
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-foreground">{t.title}</p>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                  {statusLabel}
                </span>
                <span className="truncate text-[10px] font-medium text-muted-soft">
                  · {asset.tag}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label={t.close}
              title={t.close}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-card hover:text-foreground"
            >
              <X size={16} />
            </button>
          </div>

          {canWrite && (
            <div className="flex gap-1 px-4 pt-3">
              {flow.map((s, i) => (
                <span
                  key={s}
                  className={cn(
                    'h-1 flex-1 rounded-full transition-colors duration-300',
                    i < stepIndex ? 'bg-primary/45' : i === stepIndex ? 'bg-primary' : 'bg-border',
                  )}
                />
              ))}
            </div>
          )}

          {!canWrite ? (
            <p className="px-4 py-8 text-center text-sm text-muted">{t.no_permission}</p>
          ) : (
            <>
              {/* ── Transcrição ────────────────────────────────────────── */}
              <div
                ref={scrollRef}
                className="min-h-0 flex-1 space-y-2 overflow-y-auto scrollbar-thin px-4 py-3.5"
              >
                {bubbles.map((b, i) => (
                  <div key={i} className={cn('flex', b.from === 'user' && 'justify-end')}>
                    <p
                      className={cn(
                        'max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed',
                        b.from === 'bot'
                          ? 'rounded-bl-sm bg-card-hover text-foreground-soft'
                          : 'rounded-br-sm border border-primary/25 bg-primary/12 text-foreground',
                      )}
                    >
                      {b.text}
                    </p>
                  </div>
                ))}
              </div>

              {/* ── Controles — mudam conforme a etapa ─────────────────── */}
              <div className="border-t border-border px-4 py-3">
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
                          <CalendarDays size={12} className="-mt-0.5 mr-1.5 inline" />
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
                        className="rounded-lg border border-border bg-card-hover px-2 py-1 text-xs text-foreground"
                      />
                    </label>
                  </div>
                )}

                {step === 'time' && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {SLOTS.map((v) => (
                        <Option key={v} onClick={() => setDraft((d) => ({ ...d, time: v }))}>
                          <Clock size={12} className="-mt-0.5 mr-1.5 inline" />
                          {v}
                        </Option>
                      ))}
                    </div>
                    <label className="flex items-center gap-2 text-[11px] text-muted">
                      {t.other_time}
                      <input
                        type="time"
                        onChange={(e) => e.target.value && setDraft((d) => ({ ...d, time: e.target.value }))}
                        className="rounded-lg border border-border bg-card-hover px-2 py-1 text-xs text-foreground"
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
                          <UserIcon size={12} className="-mt-0.5 mr-1.5 inline" />
                          {tech.name}
                          <span className="ml-1 text-muted">· {tech.jobTitle ?? t.roles[tech.role]}</span>
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
                      className="w-full resize-none rounded-lg border border-border bg-card-hover px-3 py-2 text-xs text-foreground placeholder:text-muted-soft focus:border-primary/40 focus:outline-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setDraft((d) => ({ ...d, description: '' }))}
                        className="btn-ghost !py-2 !text-xs"
                      >
                        {t.skip}
                      </button>
                      <button
                        onClick={() => setDraft((d) => ({ ...d, description: descInput.trim() }))}
                        className="btn-primary !py-2 !text-xs"
                      >
                        <Send size={13} />
                        {t.send}
                      </button>
                    </div>
                  </div>
                )}

                {step === 'confirm' && (
                  <div className="space-y-2.5">
                    {saveError && <p className="text-xs text-red-500">{saveError}</p>}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={reset}
                        className="btn-ghost !px-2.5 !py-2 !text-xs disabled:opacity-35"
                        disabled={saving}
                        aria-label={t.restart}
                        title={t.restart}
                      >
                        <RotateCcw size={14} />
                      </button>
                      <button
                        onClick={handleConfirm}
                        className="btn-primary !py-2.5 !text-xs flex-1"
                        disabled={saving}
                      >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        {saving ? t.saving : t.confirm}
                      </button>
                    </div>
                  </div>
                )}

                {step === 'done' && (
                  <div className="flex items-center justify-between gap-3">
                    <button
                      onClick={reset}
                      className="text-[11px] font-semibold text-muted transition-colors hover:text-primary"
                    >
                      {t.schedule_another}
                    </button>
                    <button
                      onClick={() => onOpenChange(false)}
                      className="text-[11px] font-semibold text-muted transition-colors hover:text-foreground"
                    >
                      {t.close}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};
