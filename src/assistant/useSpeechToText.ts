import { useCallback, useEffect, useRef, useState } from 'react';
import { apiService } from '../services/api';
import type { Language } from './types';

/**
 * Teto de gravação — uma pergunta falada cabe folgada aqui; acima disso é
 * provável esquecimento de parar, não uma pergunta de verdade.
 */
const MAX_RECORDING_MS = 45_000;

/** Abaixo disso o navegador quase certamente não captou nada de útil. */
const MIN_AUDIO_BYTES = 1000;

const ERROR_MESSAGES: Record<Language, Record<string, string> & { unknown: string }> = {
  pt: {
    'not-allowed': 'Permissão de microfone negada — libere o acesso nas configurações do navegador.',
    'no-device': 'Nenhum microfone encontrado neste dispositivo.',
    'no-speech': 'Não consegui entender o que foi dito. Tente falar mais perto do microfone.',
    'transcription-failed': 'Não foi possível transcrever o áudio agora. Tente de novo em instantes.',
    unknown: 'Não foi possível usar o microfone agora.',
  },
  en: {
    'not-allowed': 'Microphone permission denied — allow access in your browser settings.',
    'no-device': 'No microphone found on this device.',
    'no-speech': "Couldn't understand what was said. Try speaking closer to the microphone.",
    'transcription-failed': 'Could not transcribe the audio right now. Try again shortly.',
    unknown: 'Could not use the microphone right now.',
  },
};

function errorMessage(code: string | null, lang: Language): string | null {
  if (!code) return null;
  const table = ERROR_MESSAGES[lang];
  return table[code] ?? table.unknown;
}

/** `NotFoundError`/`NotAllowedError` etc. — nomes padronizados do `getUserMedia`. */
function classifyMediaError(err: unknown): string {
  const name = (err as { name?: string })?.name;
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'no-device';
  return 'not-allowed';
}

/** Chrome só grava em `webm`; Firefox aceita `ogg` também — tenta o melhor disponível. */
function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Tira o prefixo "data:audio/webm;base64," — só o conteúdo interessa.
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Entrada por voz (STT) — grava no navegador e manda pra Edge Function `stt`,
 * que transcreve via Whisper (OpenAI) — mesma chave do `ai-chat`.
 *
 * Existe no lugar do `SpeechRecognition` nativo porque esse manda o áudio
 * direto pros servidores do Google, por fora da nossa aplicação — um
 * caminho que se mostrou instável fora desta máquina (bloqueios de rede
 * específicos, cota do serviço gratuito, falhas que não avisam nada).
 * Proxeando pela nossa própria infra, o resultado passa a depender só da
 * nossa conexão com o Supabase — a mesma que já sustenta o chat de texto.
 *
 * Um resultado por captura: grava, envia ao soltar, entrega o texto
 * transcrito uma vez — a pessoa revisa/edita no campo antes de enviar, igual
 * a digitar. `supported` cai pra `false` (some o botão) em navegador sem
 * `MediaRecorder`/`getUserMedia`, ou fora de HTTPS/localhost — contextos
 * onde a API nem existe.
 */
export const useSpeechToText = (lang: Language) => {
  const supported =
    typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia;

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const clearSafetyTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    clearSafetyTimeout();
    // Qualquer estado que não seja "já parado" — não só 'recording'. Um
    // guard estrito aqui foi o que deixava a gravação presa pra sempre
    // quando o MediaRecorder engasgava num estado intermediário.
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
  }, [clearSafetyTimeout]);

  const start = useCallback(
    async (onResult: (text: string) => void) => {
      if (!supported || listening || transcribing) return;
      setErrorCode(null);

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        setErrorCode(classifyMediaError(err));
        return;
      }

      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType = pickMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      // Sem isto, um erro do MediaRecorder depois de já ter começado a
      // gravar deixava `listening` travado em `true` pra sempre — nem
      // `onstop` disparava pra resetar, nem o botão de parar fazia efeito.
      recorder.onerror = () => {
        clearSafetyTimeout();
        releaseStream();
        chunksRef.current = [];
        setListening(false);
        setTranscribing(false);
        setErrorCode('transcription-failed');
      };

      recorder.onstop = async () => {
        releaseStream();
        setListening(false);

        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        chunksRef.current = [];

        if (blob.size < MIN_AUDIO_BYTES) {
          setErrorCode('no-speech');
          return;
        }

        setTranscribing(true);
        try {
          const base64 = await blobToBase64(blob);
          const text = await apiService.transcribeAudio(base64, blob.type, lang);
          if (text) onResult(text);
          else setErrorCode('no-speech');
        } catch {
          setErrorCode('transcription-failed');
        } finally {
          setTranscribing(false);
        }
      };

      recorder.start();
      setListening(true);
      timeoutRef.current = setTimeout(stop, MAX_RECORDING_MS);
    },
    [supported, listening, transcribing, lang, releaseStream, stop],
  );

  // Sair da tela gravando não deve deixar o microfone aberto sozinho.
  useEffect(
    () => () => {
      clearSafetyTimeout();
      recorderRef.current?.stop();
      releaseStream();
    },
    [clearSafetyTimeout, releaseStream],
  );

  return {
    supported,
    /** Gravando de fato — é quando o ripple/ícone de "captando áudio" faz sentido. */
    listening,
    /** Áudio já foi enviado, esperando a transcrição voltar — visual diferente do de gravação. */
    transcribing,
    /** Botão deve ficar "ocupado" (desabilitado pro clique iniciar de novo) do clique até o texto voltar. */
    busy: listening || transcribing,
    error: errorMessage(errorCode, lang),
    start,
    stop,
  };
};
