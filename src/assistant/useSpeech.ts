import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createSpeechEngine } from './speech';
import type { Language } from './types';

const MUTE_KEY = 'forzy.assistant.muted';

interface SpeechState {
  /** Há uma fala em andamento (mesmo pausada). */
  speaking: boolean;
  paused: boolean;
  /** Áudio pedido, ainda não tocando — a espera de rede da voz de nuvem. */
  preparing: boolean;
  /** Quantos caracteres da fala atual já foram pronunciados. */
  progress: number;
}

/**
 * Ponte entre o motor de voz e o React.
 *
 * Guarda também a preferência de áudio do usuário: silenciar não interrompe o
 * tour, apenas troca a narração pelo texto — o balão continua avançando.
 */
export const useSpeech = () => {
  const engine = useMemo(() => createSpeechEngine(), []);
  const [state, setState] = useState<SpeechState>({
    speaking: false,
    paused: false,
    preparing: false,
    progress: 0,
  });
  const [muted, setMuted] = useState(
    () => typeof localStorage !== 'undefined' && localStorage.getItem(MUTE_KEY) === '1',
  );
  // Sem áudio a fala "termina" na hora; o callback precisa sobreviver ao render.
  const onEndRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {
      /* modo privado — a preferência só não persiste */
    }
  }, [muted]);

  const cancel = useCallback(() => {
    onEndRef.current = null;
    engine.cancel();
    setState({ speaking: false, paused: false, preparing: false, progress: 0 });
  }, [engine]);

  const speak = useCallback(
    (text: string, lang: Language, onEnd?: () => void) => {
      engine.cancel();
      onEndRef.current = onEnd ?? null;

      if (muted || !engine.available) {
        // Sem voz o texto ainda "acontece": mostramos ele inteiro de uma vez.
        setState({ speaking: false, paused: false, preparing: false, progress: text.length });
        return;
      }

      setState({ speaking: false, paused: false, preparing: true, progress: 0 });
      engine.speak(text, {
        lang,
        onStart: () =>
          setState({ speaking: true, paused: false, preparing: false, progress: 0 }),
        onProgress: (charIndex) =>
          setState((s) => (s.speaking ? { ...s, progress: charIndex } : s)),
        onEnd: () => {
          setState({ speaking: false, paused: false, preparing: false, progress: text.length });
          onEndRef.current?.();
          onEndRef.current = null;
        },
        onError: () =>
          setState({ speaking: false, paused: false, preparing: false, progress: text.length }),
      });
    },
    [engine, muted],
  );

  const pause = useCallback(() => {
    engine.pause();
    setState((s) => ({ ...s, paused: true }));
  }, [engine]);

  const resume = useCallback(() => {
    engine.resume();
    setState((s) => ({ ...s, paused: false }));
  }, [engine]);

  // Sair da página no meio de uma frase deixaria a voz tocando sozinha.
  useEffect(() => cancel, [cancel]);

  return {
    ...state,
    muted,
    supported: engine.available,
    /** Aquece o áudio da próxima etapa enquanto a atual toca. */
    prefetch: (text: string, lang: Language) => {
      if (!muted) engine.prefetch?.(text, lang);
    },
    toggleMuted: () => {
      setMuted((m) => {
        if (!m) cancel();
        return !m;
      });
    },
    speak,
    pause,
    resume,
    cancel,
  };
};
