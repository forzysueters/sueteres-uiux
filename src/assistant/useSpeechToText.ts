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
 *
 * Toda mensagem começa dizendo que o problema é DA ENTRADA POR VOZ e termina
 * com a saída (digitar). Num painel de monitoramento industrial, um aviso que
 * abre com "sem conexão" é lido como a planta tendo perdido telemetria — o
 * que aqui nunca é o caso: a transcrição roda num serviço do próprio
 * navegador, fora da plataforma, e só ela cai.
 */
const ERROR_MESSAGES: Record<Language, Record<string, string> & { unknown: string }> = {
  pt: {
    'not-allowed':
      'Microfone bloqueado pelo navegador. Libere o acesso no cadeado da barra de endereço — ou digite a pergunta no campo.',
    'permission-denied':
      'Microfone bloqueado pelo navegador. Libere o acesso no cadeado da barra de endereço — ou digite a pergunta no campo.',
    'service-not-allowed':
      'Este navegador não liberou o reconhecimento de voz (ele exige HTTPS, e alguns navegadores baseados no Chromium não o incluem). Digite a pergunta no campo.',
    'no-speech': 'Não consegui ouvir nada. Fale mais perto do microfone e tente de novo.',
    'audio-capture': 'Nenhum microfone encontrado neste dispositivo. Digite a pergunta no campo.',
    // `network` é o caso mais comum e o mais mal explicado: a fala não é
    // transcrita no computador, o navegador a envia a um serviço externo. Esse
    // caminho é o que falhou — o Órion e a telemetria seguem funcionando.
    network:
      'A transcrição de voz é feita por um serviço externo do navegador, e ele não foi alcançado (redes corporativas costumam bloqueá-lo). O Órion segue respondendo — digite a pergunta no campo.',
    offline:
      'Sem internet no momento. A transcrição de voz depende de um serviço externo do navegador — digite a pergunta no campo.',
    unknown: 'Não foi possível usar o microfone agora. Digite a pergunta no campo.',
  },
  en: {
    'not-allowed':
      'The browser blocked the microphone. Allow access from the padlock in the address bar — or just type your question.',
    'permission-denied':
      'The browser blocked the microphone. Allow access from the padlock in the address bar — or just type your question.',
    'service-not-allowed':
      'This browser did not enable speech recognition (it requires HTTPS, and some Chromium-based browsers ship without it). Type your question instead.',
    'no-speech': "Didn't hear anything. Speak closer to the microphone and try again.",
    'audio-capture': 'No microphone found on this device. Type your question instead.',
    network:
      'Voice is transcribed by an external browser service, and it could not be reached (corporate networks often block it). Órion still answers — just type your question.',
    offline:
      'You are offline. Voice transcription relies on an external browser service — type your question instead.',
    unknown: 'Could not use the microphone right now. Type your question instead.',
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
      // A fala não é transcrita no dispositivo. Sem rede, o `start()` ainda
      // abre o microfone e só falha segundos depois com `network` — dizer a
      // causa certa na hora custa uma linha.
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setErrorCode('offline');
        return;
      }
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
