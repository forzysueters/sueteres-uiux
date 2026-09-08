import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CornerDownLeft,
  Loader2,
  Maximize2,
  Mic,
  Pause,
  Play,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { AvatarFace } from './AvatarFace';
import { RichText } from './RichText';
import { ASSISTANT_NAME, t } from './copy';
import { useSpeechToText } from './useSpeechToText';
import { cn } from '../lib/utils';
import type { AssistantPhase, AvatarState, Language } from './types';

export interface AssistantPanelModel {
  lang: Language;
  phase: AssistantPhase;
  avatarState: AvatarState;
  title: string;
  text: string;
  /** true quando o texto é Markdown vindo do modelo, e não narração do roteiro. */
  formatted: boolean;
  /** Caracteres já pronunciados — ilumina o texto acompanhando a voz. */
  progress: number;
  stepIndex: number;
  stepCount: number;
  speaking: boolean;
  paused: boolean;
  muted: boolean;
  audioSupported: boolean;
  /** Painel sobe para o topo quando o elemento destacado está embaixo. */
  anchor: 'bottom' | 'top';
  chatPending: boolean;
  chatQuestion: string | null;
  /** Falso quando já se está na página do assistente. */
  canExpand: boolean;
}

interface AssistantPanelProps extends AssistantPanelModel {
  /** Ponto de origem do traço que liga o avatar ao elemento destacado. */
  avatarRef: React.RefObject<HTMLDivElement>;
  onStart: () => void;
  onDismiss: () => void;
  onClose: () => void;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onTogglePause: () => void;
  onToggleMute: () => void;
  onAsk: (question: string) => void;
  onRestart: () => void;
  onExpand: () => void;
}

const EASE = [0.22, 1, 0.36, 1] as const;

export const AssistantPanel: React.FC<AssistantPanelProps> = (p) => {
  const { lang } = p;
  const [asking, setAsking] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const isTour = p.phase === 'tour';
  const lastStep = p.stepIndex === p.stepCount - 1;
  const stt = useSpeechToText(lang);
  const startListening = () => stt.start((text) => setDraft((d) => (d ? `${d} ${text}` : text)));

  useEffect(() => {
    if (asking) inputRef.current?.focus();
  }, [asking]);

  // Sair da conversa livre quando o tour recomeça evita dois modos abertos.
  useEffect(() => {
    if (p.phase === 'tour' || p.phase === 'greeting') setAsking(false);
  }, [p.phase]);

  const spoken = p.text.slice(0, p.progress);
  const pending = p.text.slice(p.progress);

  const statusLabel = p.speaking
    ? t(lang, 'speaking')
    : p.avatarState === 'thinking'
      ? t(lang, 'thinking')
      : asking
        ? t(lang, 'listening')
        : t(lang, 'ready');

  const submit = () => {
    const q = draft.trim();
    if (!q || p.chatPending) return;
    setDraft('');
    p.onAsk(q);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.97 }}
      transition={{ duration: 0.32, ease: EASE }}
      className={cn(
        'fixed z-[70] flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-panel',
        'inset-x-3 sm:inset-x-auto sm:right-6 sm:w-[382px]',
        // Nunca mais alto que a janela — telas baixas e celular deitado.
        'max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)]',
        p.anchor === 'top' ? 'top-20 sm:top-24' : 'bottom-3 sm:bottom-6',
      )}
      role="dialog"
      aria-label={`${ASSISTANT_NAME} — ${t(lang, 'role')}`}
    >
      {/* ── Cabeçalho ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 border-b border-border bg-card-hover px-4 py-3">
        <div ref={p.avatarRef} className="relative flex-shrink-0">
          <AvatarFace size={44} state={p.avatarState} orbit={false} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-foreground">{ASSISTANT_NAME}</p>
          <div className="flex items-center gap-1.5">
            {/* Indicador de fala: barras que só correm enquanto há voz */}
            <span className="flex h-2.5 items-end gap-[2px]">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="w-[2px] rounded-full"
                  style={{ background: 'rgb(var(--primary-rgb))' }}
                  animate={
                    p.speaking
                      ? { height: [3, 9, 4, 8, 3] }
                      : { height: p.avatarState === 'thinking' ? 3 : 2.5 }
                  }
                  transition={
                    p.speaking
                      ? { duration: 0.6, repeat: Infinity, delay: i * 0.12, ease: 'easeInOut' }
                      : { duration: 0.2 }
                  }
                />
              ))}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
              {statusLabel}
            </span>
            {isTour && (
              <span className="ml-1 truncate text-[10px] font-medium text-muted-soft">
                · {t(lang, 'step_of', { n: p.stepIndex + 1, total: p.stepCount })}
              </span>
            )}
          </div>
        </div>

        {p.canExpand && (
          <button
            type="button"
            onClick={p.onExpand}
            aria-label={t(lang, 'expand')}
            title={t(lang, 'expand')}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-card hover:text-foreground"
          >
            <Maximize2 size={15} />
          </button>
        )}

        <button
          type="button"
          onClick={p.onToggleMute}
          disabled={!p.audioSupported}
          aria-label={p.muted ? t(lang, 'audio_off') : t(lang, 'audio_on')}
          title={p.audioSupported ? (p.muted ? t(lang, 'audio_off') : t(lang, 'audio_on')) : t(lang, 'audio_unavailable')}
          className={cn(
            'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-colors',
            p.muted || !p.audioSupported
              ? 'text-muted hover:text-foreground hover:bg-card'
              : 'text-primary bg-primary/10',
            !p.audioSupported && 'cursor-not-allowed opacity-40',
          )}
        >
          {p.muted || !p.audioSupported ? <VolumeX size={15} /> : <Volume2 size={15} />}
        </button>

        <button
          type="button"
          onClick={p.onClose}
          aria-label={t(lang, 'close')}
          title={t(lang, 'close')}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-card hover:text-foreground"
        >
          <X size={16} />
        </button>
      </div>

      {/* ── Progresso do tour ────────────────────────────────────────────── */}
      {isTour && (
        <div className="flex gap-1 px-4 pt-3">
          {Array.from({ length: p.stepCount }).map((_, i) => (
            <span
              key={i}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors duration-300',
                i < p.stepIndex ? 'bg-primary/45' : i === p.stepIndex ? 'bg-primary' : 'bg-border',
              )}
            />
          ))}
        </div>
      )}

      {/* ── Balão de fala ────────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin px-4 py-3.5">
        <motion.div
          key={`${p.phase}-${p.stepIndex}-${p.chatQuestion ?? ''}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: EASE }}
        >
          {p.chatQuestion && (
            <p className="mb-2.5 rounded-lg rounded-br-sm bg-card-hover px-3 py-2 text-xs font-medium text-foreground-soft">
              {p.chatQuestion}
            </p>
          )}

          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
            {p.title}
          </p>

          {p.chatPending ? (
            <p className="flex items-center gap-2 py-2 text-sm text-muted">
              <Loader2 size={14} className="animate-spin text-primary" />
              {t(lang, 'thinking')}…
            </p>
          ) : p.formatted ? (
            // Resposta do modelo: negrito, ênfase e listas de verdade. Aqui não
            // faz sentido acender por caractere — a estrutura é que informa.
            <RichText text={p.text} />
          ) : (
            // Narração: o trecho já pronunciado fica sólido, o que falta esmaece.
            <p className="text-sm leading-relaxed text-muted">
              <span className="text-foreground-soft">{spoken}</span>
              <span className={p.speaking ? 'opacity-45' : 'text-foreground-soft'}>{pending}</span>
            </p>
          )}
        </motion.div>
      </div>

      {/* ── Controles ────────────────────────────────────────────────────── */}
      <div className="border-t border-border px-4 py-3">
        {p.phase === 'greeting' && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <button onClick={p.onStart} className="btn-primary flex-1 !py-2.5 !text-xs">
              <Sparkles size={14} />
              {t(lang, 'start_tour')}
            </button>
            <button onClick={p.onDismiss} className="btn-ghost !py-2.5 !text-xs sm:flex-shrink-0">
              {t(lang, 'later')}
            </button>
          </div>
        )}

        {isTour && (
          <>
            <div className="flex items-center gap-2">
              <button
                onClick={p.onBack}
                disabled={p.stepIndex === 0}
                aria-label={t(lang, 'back')}
                title={t(lang, 'back')}
                className="btn-ghost !px-2.5 !py-2 disabled:opacity-35"
              >
                <ArrowLeft size={15} />
              </button>

              <button
                onClick={p.onTogglePause}
                disabled={!p.audioSupported || p.muted}
                aria-label={p.paused ? t(lang, 'resume') : t(lang, 'pause')}
                title={p.paused ? t(lang, 'resume') : t(lang, 'pause')}
                className="btn-ghost !px-2.5 !py-2 disabled:opacity-35"
              >
                {p.paused ? <Play size={15} /> : <Pause size={15} />}
              </button>

              <button onClick={p.onNext} className="btn-primary flex-1 !py-2.5 !text-xs">
                {lastStep ? (
                  <>
                    <Check size={14} />
                    {t(lang, 'finish')}
                  </>
                ) : (
                  <>
                    {t(lang, 'next')}
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </div>

            <div className="mt-2.5 flex items-center justify-between gap-3">
              <button
                onClick={() => setAsking((v) => !v)}
                className="text-[11px] font-semibold text-muted transition-colors hover:text-primary"
              >
                {t(lang, 'ask_cta')}
              </button>
              <button
                onClick={p.onSkip}
                className="text-[11px] font-semibold text-muted transition-colors hover:text-foreground"
              >
                {t(lang, 'skip')}
              </button>
            </div>
          </>
        )}

        {(p.phase === 'chat' || p.phase === 'farewell') && (
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => setAsking(true)}
              className="text-[11px] font-semibold text-muted transition-colors hover:text-primary"
            >
              {t(lang, 'ask_cta')}
            </button>
            <button
              onClick={p.onRestart}
              className="text-[11px] font-semibold text-muted transition-colors hover:text-foreground"
            >
              {t(lang, 'restart_tour')}
            </button>
          </div>
        )}

        {/* Campo de pergunta — o mesmo motor de IA usado no Assistente do site */}
        <AnimatePresence>
          {(asking || p.phase === 'chat') && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 10 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              transition={{ duration: 0.22, ease: EASE }}
              className="overflow-hidden"
            >
              <div className="relative">
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
                  placeholder={stt.listening ? t(lang, 'listening') : t(lang, 'ask_placeholder')}
                  disabled={p.chatPending}
                  className={cn(
                    'h-10 w-full rounded-xl border border-border bg-card-hover pl-3 text-xs font-medium text-foreground transition-colors placeholder:text-muted-soft focus:border-primary/50 focus:outline-none disabled:opacity-50',
                    stt.supported ? 'pr-16' : 'pr-10',
                  )}
                />
                {stt.supported && (
                  <button
                    type="button"
                    onClick={() => (stt.listening ? stt.stop() : startListening())}
                    disabled={p.chatPending}
                    aria-label={stt.listening ? t(lang, 'stop_listening') : t(lang, 'ask_by_voice')}
                    title={stt.listening ? t(lang, 'stop_listening') : t(lang, 'ask_by_voice')}
                    className={cn(
                      'absolute right-9 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg transition-colors disabled:opacity-30',
                      stt.listening ? 'text-primary bg-primary/10 animate-pulse' : 'text-muted hover:text-primary hover:bg-primary/10',
                    )}
                  >
                    <Mic size={14} />
                  </button>
                )}
                <button
                  onClick={submit}
                  disabled={!draft.trim() || p.chatPending}
                  aria-label={t(lang, 'ask_cta')}
                  className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-primary transition-colors hover:bg-primary/10 disabled:opacity-30"
                >
                  <CornerDownLeft size={15} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
