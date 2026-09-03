import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { apiService } from '../services/api';
import { TOUR_STEPS } from './tour';
import { TOUR_COPY, t } from './copy';
import { useSpeech } from './useSpeech';
import { stripMarkdown } from './RichText';
import type { AssistantPhase, AvatarState, TourContext } from './types';

const SEEN_KEY = 'forzy.assistant.tour.v1';

const readSeen = () => {
  try {
    return localStorage.getItem(SEEN_KEY) !== null;
  } catch {
    return false;
  }
};

const writeSeen = (value: 'completed' | 'skipped' | 'later') => {
  try {
    localStorage.setItem(SEEN_KEY, value);
  } catch {
    /* modo privado */
  }
};

/**
 * Máquina de estados do assistente.
 *
 * Concentra tudo que é comportamento — fase, etapa atual, navegação, narração e
 * conversa — para que os componentes visuais só recebam um modelo pronto e não
 * precisem saber nada sobre rotas ou voz.
 */
export const useTourController = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { language, assets, selectedAssetId } = useAppStore();
  const speech = useSpeech();

  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<AssistantPhase>('dormant');
  const [stepIndex, setStepIndex] = useState(0);
  const [seen, setSeen] = useState(readSeen);
  /**
   * A narração só começa depois de um gesto do usuário: navegadores bloqueiam
   * áudio automático, e uma voz surgindo sozinha ao abrir a página assusta.
   */
  const [engaged, setEngaged] = useState(false);

  const [chatQuestion, setChatQuestion] = useState<string | null>(null);
  const [chatAnswer, setChatAnswer] = useState<string | null>(null);
  const [chatPending, setChatPending] = useState(false);
  const conversationId = useRef<string | null>(null);

  const step = TOUR_STEPS[stepIndex];
  const stepCopy = TOUR_COPY[language][step.id];

  /** O ativo mais crítico serve de exemplo real na etapa de predição. */
  const context: TourContext = useMemo(() => {
    const rank = { critical: 0, warning: 1, normal: 2, offline: 3 } as const;
    const worst = [...assets].sort((a, b) => rank[a.status] - rank[b.status])[0];
    return { focusAssetId: selectedAssetId ?? worst?.id ?? null };
  }, [assets, selectedAssetId]);

  // ── Texto corrente ─────────────────────────────────────────────────────
  const current = useMemo(() => {
    if (phase === 'chat') {
      return {
        title: chatAnswer ? t(language, 'chat_answer_title') : t(language, 'ask_cta'),
        text: chatAnswer ?? t(language, 'chat_intro'),
      };
    }
    if (phase === 'greeting') {
      return { title: t(language, 'greeting_title'), text: t(language, 'greeting_speech') };
    }
    if (phase === 'farewell') {
      return {
        title: t(language, 'farewell_title'),
        text: TOUR_COPY[language].wrapup.speech,
      };
    }
    return { title: stepCopy.title, text: stepCopy.speech };
  }, [phase, language, chatAnswer, stepCopy]);

  // ── Narração ───────────────────────────────────────────────────────────
  // Refala sempre que o texto muda; nunca antes do primeiro gesto do usuário.
  const textKey = `${phase}-${stepIndex}-${chatAnswer ?? ''}-${language}`;
  useEffect(() => {
    if (!open || !engaged || chatPending) return;
    speech.speak(stripMarkdown(current.text), language);
    return () => speech.cancel();
    // `current.text` deriva de textKey; observar a chave evita refalar à toa.
  }, [textKey, open, engaged, chatPending]);

  // Enquanto a etapa atual é narrada, o áudio da próxima já vai sendo baixado —
  // o "Continuar" fica instantâneo em vez de esperar a rede de novo.
  useEffect(() => {
    if (phase !== 'tour' || !engaged) return;
    const next = TOUR_STEPS[stepIndex + 1];
    if (next) speech.prefetch(stripMarkdown(TOUR_COPY[language][next.id].speech), language);
  }, [phase, stepIndex, engaged, language]);

  // ── Navegação entre etapas ─────────────────────────────────────────────
  const routeFor = useCallback(
    (index: number) => {
      const def = TOUR_STEPS[index];
      return typeof def.route === 'function' ? def.route(context) : def.route;
    },
    [context],
  );

  const goTo = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(TOUR_STEPS.length - 1, index));
      const route = routeFor(clamped);
      if (route && route !== location.pathname) navigate(route);
      setStepIndex(clamped);
      setChatAnswer(null);
      setChatQuestion(null);
      setPhase('tour');
    },
    [navigate, routeFor, location.pathname],
  );

  const start = useCallback(() => {
    setEngaged(true);
    goTo(0);
  }, [goTo]);

  const next = useCallback(() => {
    setEngaged(true);
    if (stepIndex >= TOUR_STEPS.length - 1) {
      speech.cancel();
      writeSeen('completed');
      setSeen(true);
      setPhase('farewell');
      return;
    }
    goTo(stepIndex + 1);
  }, [stepIndex, goTo, speech]);

  const back = useCallback(() => {
    setEngaged(true);
    goTo(stepIndex - 1);
  }, [stepIndex, goTo]);

  const skip = useCallback(() => {
    speech.cancel();
    writeSeen('skipped');
    setSeen(true);
    setPhase('dormant');
    setOpen(false);
  }, [speech]);

  const dismiss = useCallback(() => {
    speech.cancel();
    writeSeen('later');
    setSeen(true);
    setPhase('dormant');
    setOpen(false);
  }, [speech]);

  const close = useCallback(() => {
    speech.cancel();
    if (!seen) {
      writeSeen('later');
      setSeen(true);
    }
    setPhase('dormant');
    setOpen(false);
  }, [speech, seen]);

  const openPanel = useCallback(() => {
    setEngaged(true);
    setOpen(true);
    // Quem já conhece a plataforma cai direto na conversa; quem não, na
    // apresentação com o convite para o tour.
    setPhase(seen ? 'chat' : 'greeting');
  }, [seen]);

  const restart = useCallback(() => {
    setEngaged(true);
    goTo(0);
  }, [goTo]);

  const togglePause = useCallback(() => {
    if (speech.paused) speech.resume();
    else speech.pause();
  }, [speech]);

  // ── Conversa livre ─────────────────────────────────────────────────────
  const ask = useCallback(
    async (question: string) => {
      setEngaged(true);
      speech.cancel();
      setPhase('chat');
      setChatQuestion(question);
      setChatAnswer(null);
      setChatPending(true);
      try {
        const reply = await apiService.getChatResponse(
          question,
          selectedAssetId ?? undefined,
          [],
          conversationId.current,
        );
        conversationId.current = reply.conversationId ?? conversationId.current;
        setChatAnswer(reply.content);
      } catch {
        setChatAnswer(t(language, 'chat_error'));
      } finally {
        setChatPending(false);
      }
    },
    [language, selectedAssetId, speech],
  );

  // ── Convite automático para o usuário novo ─────────────────────────────
  useEffect(() => {
    if (seen) return;
    const timer = window.setTimeout(() => {
      setOpen(true);
      setPhase('greeting');
    }, 1600);
    return () => clearTimeout(timer);
  }, [seen]);

  // A voz de nuvem tem ~2s entre pedir e tocar: enquanto isso o avatar pensa,
  // em vez de ficar parado como se nada estivesse acontecendo.
  const avatarState: AvatarState = chatPending || speech.preparing
    ? 'thinking'
    : speech.speaking && !speech.paused
      ? 'speaking'
      : phase === 'chat'
        ? 'listening'
        : 'idle';

  return {
    open,
    phase,
    stepIndex,
    stepCount: TOUR_STEPS.length,
    step,
    stepCopy,
    seen,
    language,
    avatarState,
    title: current.title,
    text: current.text,
    /** Respostas do modelo vêm em Markdown; o roteiro é prosa corrida. */
    formatted: phase === 'chat',
    progress: speech.speaking ? speech.progress : current.text.length,
    speaking: speech.speaking && !speech.paused,
    paused: speech.paused,
    muted: speech.muted,
    audioSupported: speech.supported,
    chatPending,
    chatQuestion,
    preparing: speech.preparing,
    actions: {
      openPanel,
      start,
      next,
      back,
      skip,
      dismiss,
      close,
      restart,
      togglePause,
      toggleMuted: speech.toggleMuted,
      ask,
    },
  };
};
