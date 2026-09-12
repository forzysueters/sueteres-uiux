import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { apiService } from '../services/api';
import { TOUR_STEPS } from './tour';
import { buildFleetSummary, fleetSummaryIntent, type SummaryStep } from './fleetSummary';
import { TOUR_COPY, t } from './copy';
import { useSpeech } from './useSpeech';
import { stripMarkdown } from './markdown';
import type { AssistantPhase, AvatarState, TourContext } from './types';

const SEEN_KEY = 'forzy.assistant.tour.v1';
/** Página cheia do assistente — sem entrada no menu, só por "Expandir". */
const ASSISTANT_ROUTE = '/assistente';

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
  const { speak, cancel, prefetch } = speech;

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
  /**
   * A resposta veio do motor determinístico local, não do modelo.
   *
   * O flag já existia em `ChatMessage` e a página cheia do assistente o mostra;
   * aqui ele era descartado, então o painel flutuante apresentava a listagem
   * seca do banco com a mesma cara de uma resposta redigida. Quem lê precisa
   * saber que o Órion está sem o cérebro de linguagem — senão a queda de
   * qualidade parece um defeito do assistente, e não uma indisponibilidade.
   */
  const [chatOffline, setChatOffline] = useState(false);
  const conversationId = useRef<string | null>(null);
  const requestId = useRef(0);
  const [summarySteps, setSummarySteps] = useState<SummaryStep[] | null>(null);
  const steps = summarySteps ?? TOUR_STEPS;

  const step = steps[stepIndex] ?? steps[0];
  const stepCopy = summarySteps?.[stepIndex]?.copy ?? TOUR_COPY[language][step.id];

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
    speak(stripMarkdown(current.text), language);
    return () => cancel();
    // `current.text` deriva de textKey; observar a chave evita refalar à toa.
  }, [textKey, open, engaged, chatPending, current.text, language, speak, cancel]);

  // Enquanto a etapa atual é narrada, o áudio da próxima já vai sendo baixado —
  // o "Continuar" fica instantâneo em vez de esperar a rede de novo.
  useEffect(() => {
    if (phase !== 'tour' || !engaged) return;
    const next = steps[stepIndex + 1];
    if (next) prefetch(stripMarkdown(summarySteps?.[stepIndex + 1]?.copy.speech ?? TOUR_COPY[language][next.id].speech), language);
  }, [phase, stepIndex, engaged, language, steps, summarySteps, prefetch]);

  // ── Navegação entre etapas ─────────────────────────────────────────────
  const routeFor = useCallback(
    (index: number) => {
      const def = steps[index];
      return typeof def.route === 'function' ? def.route(context) : def.route;
    },
    [context, steps],
  );

  const goTo = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(steps.length - 1, index));
      const route = routeFor(clamped);
      if (route && route !== location.pathname) navigate(route);
      setStepIndex(clamped);
      setChatAnswer(null);
      setChatQuestion(null);
      setPhase('tour');
    },
    [navigate, routeFor, location.pathname, steps],
  );

  const start = useCallback(() => {
    requestId.current++;
    setChatPending(false);
    setSummarySteps(null);
    setEngaged(true);
    setStepIndex(0);
    setChatAnswer(null);
    setChatQuestion(null);
    setPhase('tour');
    navigate('/dashboard');
  }, [navigate]);

  const next = useCallback(() => {
    setEngaged(true);
    if (stepIndex >= steps.length - 1) {
      speech.cancel();
      if (summarySteps) {
        setChatAnswer('Resumo concluído. Você pode pedir um novo resumo para atualizar os dados ou perguntar sobre uma TAG específica.');
        setPhase('chat');
        return;
      }
      writeSeen('completed');
      setSeen(true);
      setPhase('farewell');
      return;
    }
    goTo(stepIndex + 1);
  }, [stepIndex, goTo, speech, steps, summarySteps]);

  const back = useCallback(() => {
    setEngaged(true);
    goTo(stepIndex - 1);
  }, [stepIndex, goTo]);

  const skip = useCallback(() => {
    requestId.current++;
    setChatPending(false);
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
    requestId.current++;
    setChatPending(false);
    speech.cancel();
    if (!seen) {
      writeSeen('later');
      setSeen(true);
    }
    setPhase('dormant');
    setOpen(false);
  }, [speech, seen]);

  /**
   * Leva para a página do Assistente e fecha o balão.
   *
   * Ela saiu do menu: este botão é o caminho para ela. Encerra a narração
   * porque o usuário está trocando de contexto, não pausando.
   */
  const expand = useCallback(() => {
    requestId.current++;
    setChatPending(false);
    speech.cancel();
    setPhase('dormant');
    setOpen(false);
    navigate(ASSISTANT_ROUTE);
  }, [speech, navigate]);

  const openPanel = useCallback(() => {
    setEngaged(true);
    setOpen(true);
    // Quem já conhece a plataforma cai direto na conversa; quem não, na
    // apresentação com o convite para o tour.
    setPhase(seen ? 'chat' : 'greeting');
  }, [seen]);

  const restart = start;

  const togglePause = useCallback(() => {
    if (speech.paused) speech.resume();
    else speech.pause();
  }, [speech]);

  // ── Conversa livre ─────────────────────────────────────────────────────
  const ask = useCallback(
    async (question: string) => {
      const currentRequest = ++requestId.current;
      setOpen(true);
      setEngaged(true);
      speech.cancel();
      setPhase('chat');
      setChatQuestion(question);
      setChatAnswer(null);
      setChatOffline(false);
      setChatPending(true);
      try {
        const scope = fleetSummaryIntent(question);
        if (scope) {
          const freshAssets = await apiService.listAssets();
          if (requestId.current !== currentRequest) return;
          const summary = buildFleetSummary(freshAssets, scope);
          setSummarySteps(summary);
          setStepIndex(0);
          setChatQuestion(null);
          setOpen(true);
          setPhase('tour');
          navigate('/planta');
          return;
        }
        const reply = await apiService.getChatResponse(
          question,
          selectedAssetId ?? undefined,
          conversationId.current,
        );
        if (requestId.current !== currentRequest) return;
        conversationId.current = reply.conversationId ?? conversationId.current;
        setChatAnswer(reply.content);
        setChatOffline(reply.offline === true);
      } catch {
        if (requestId.current === currentRequest) {
          setChatAnswer(t(language, 'chat_error'));
          setChatOffline(false);
        }
      } finally {
        if (requestId.current === currentRequest) setChatPending(false);
      }
    },
    [language, selectedAssetId, speech, navigate],
  );

  useEffect(() => {
    const onSummary = (event: Event) => {
      const question = (event as CustomEvent<string>).detail;
      if (typeof question === 'string' && fleetSummaryIntent(question)) void ask(question);
    };
    window.addEventListener('orion:summary', onSummary);
    return () => window.removeEventListener('orion:summary', onSummary);
  }, [ask]);

  useEffect(() => () => { requestId.current++; }, []);

  // ── Convite automático para o usuário novo ─────────────────────────────
  useEffect(() => {
    if (seen || open || phase !== 'dormant') return;
    const timer = window.setTimeout(() => {
      setOpen(true);
      setPhase('greeting');
    }, 1600);
    return () => clearTimeout(timer);
  }, [seen, open, phase]);

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
    stepCount: steps.length,
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
    chatOffline,
    preparing: speech.preparing,
    /** Some quando já se está na página — botão que não faz nada é ruído. */
    canExpand: location.pathname !== ASSISTANT_ROUTE,
    actions: {
      openPanel,
      start,
      next,
      back,
      skip,
      dismiss,
      close,
      restart,
      expand,
      togglePause,
      toggleMuted: speech.toggleMuted,
      ask,
    },
  };
};
