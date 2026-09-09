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
  onerror: ((event: { error: string }) => void) | null;
}

type RecognitionCtor = new () => MinimalRecognition;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Traduz o código de erro da Web Speech API numa frase que explica o que
 * fazer — sem isso, quem clica no microfone e esbarra num erro (permissão
 * negada, rede corporativa bloqueando o serviço do Google, sem microfone) só
 * vê o ícone voltar ao normal, sem pista nenhuma do motivo.
 */
const ERROR_MESSAGES: Record<Language, Record<string, string> & { unknown: string }> = {
  pt: {
    'not-allowed': 'Permissão de microfone negada — libere o acesso nas configurações do navegador.',
    'permission-denied': 'Permissão de microfone negada — libere o acesso nas configurações do navegador.',
    'service-not-allowed':
      'O navegador bloqueou o reconhecimento de voz — confira se a página está em HTTPS (ou localhost).',
    'no-speech': 'Não consegui ouvir nada. Tente falar mais perto do microfone.',
    'audio-capture': 'Nenhum microfone encontrado neste dispositivo.',
    network: 'Sem conexão com o serviço de reconhecimento de voz — redes corporativas costumam bloqueá-lo.',
    unknown: 'Não foi possível usar o microfone agora.',
  },
  en: {
    'not-allowed': 'Microphone permission denied — allow access in your browser settings.',
    'permission-denied': 'Microphone permission denied — allow access in your browser settings.',
    'service-not-allowed': 'The browser blocked speech recognition — make sure the page is served over HTTPS (or localhost).',
    'no-speech': "Didn't hear anything. Try speaking closer to the microphone.",
    'audio-capture': 'No microphone found on this device.',
    network: 'No connection to the speech recognition service — corporate networks often block it.',
    unknown: 'Could not use the microphone right now.',
  },
};

/** `aborted` é o próprio app ou usuário interrompendo — não é falha, não mostra nada. */
export function speechErrorMessage(code: string | null, lang: Language): string | null {
  if (!code || code === 'aborted') return null;
  const table = ERROR_MESSAGES[lang];
  return table[code] ?? table.unknown;
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
  /** Código bruto do último erro (`event.error`) — a mensagem amigável vem de `speechErrorMessage`. */
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(
    (onResult: (text: string) => void) => {
      if (!Ctor || listening) return;
      setErrorCode(null);
      const recognition = new Ctor();
      recognition.lang = LOCALE[lang];
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event) => {
        const transcript = event.results[event.results.length - 1]?.[0]?.transcript?.trim();
        if (transcript) onResult(transcript);
      };
      recognition.onend = () => setListening(false);
      recognition.onerror = (event) => {
        setListening(false);
        setErrorCode(event.error);
      };
      recognitionRef.current = recognition;
      setListening(true);
      recognition.start();
    },
    [Ctor, lang, listening],
  );

  // Sair da tela com o microfone aberto não deve deixá-lo escutando sozinho.
  useEffect(() => () => recognitionRef.current?.abort(), []);

  return {
    supported: !!Ctor,
    listening,
    error: speechErrorMessage(errorCode, lang),
    start,
    stop,
  };
};
