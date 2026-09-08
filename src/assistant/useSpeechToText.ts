import { useCallback, useEffect, useRef, useState } from 'react';
import type { Language } from './types';

const LOCALE = { pt: 'pt-BR', en: 'en-US' } as const;

/**
 * Só o que este hook usa da Web Speech API — `SpeechRecognition` não está no
 * lib.dom.d.ts padrão do TypeScript (segue prefixada em alguns navegadores),
 * então tipamos localmente em vez de aumentar o `Window` global.
 */
interface MinimalRecognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

type RecognitionCtor = new () => MinimalRecognition;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Entrada por voz (STT) sobre a Web Speech API do navegador — mesmo espírito
 * do `speech.ts`: sem custo, sem chave, e simplesmente ausente (`supported:
 * false`) em quem não implementa (Firefox, por exemplo), sem quebrar nada.
 *
 * Um resultado por captura: começa a ouvir, entrega o texto final transcrito
 * uma vez e para sozinho — a pessoa revisa/edita no campo antes de enviar,
 * igual a digitar.
 */
export const useSpeechToText = (lang: Language) => {
  const Ctor = useRef(getRecognitionCtor()).current;
  const recognitionRef = useRef<MinimalRecognition | null>(null);
  const [listening, setListening] = useState(false);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(
    (onResult: (text: string) => void) => {
      if (!Ctor || listening) return;
      const recognition = new Ctor();
      recognition.lang = LOCALE[lang];
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event) => {
        const transcript = event.results[event.results.length - 1]?.[0]?.transcript?.trim();
        if (transcript) onResult(transcript);
      };
      recognition.onend = () => setListening(false);
      recognition.onerror = () => setListening(false);
      recognitionRef.current = recognition;
      setListening(true);
      recognition.start();
    },
    [Ctor, lang, listening],
  );

  // Sair da tela com o microfone aberto não deve deixá-lo escutando sozinho.
  useEffect(() => () => recognitionRef.current?.abort(), []);

  return { supported: !!Ctor, listening, start, stop };
};
