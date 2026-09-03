import type { Language, SpeakOptions, SpeechEngine } from './types';

const LOCALE = { pt: 'pt-BR', en: 'en-US' } as const;

/**
 * Voz do assistente sobre a Web Speech API do navegador.
 *
 * É a implementação de partida: não custa requisição, não precisa de chave e
 * funciona offline. Para trocar por um TTS de nuvem, escreva outro objeto que
 * satisfaça `SpeechEngine` e devolva-o em `createSpeechEngine()` — o resto do
 * módulo não sabe (nem precisa saber) de onde vem o áudio.
 *
 * Um esboço da versão em nuvem:
 *
 *   const audio = new Audio()
 *   speak(text, o) {
 *     fetch('/api/tts', { method: 'POST', body: JSON.stringify({ text, lang: o.lang }) })
 *       .then(r => r.blob())
 *       .then(b => { audio.src = URL.createObjectURL(b); audio.play() })
 *     // `onProgress` vem dos timestamps por palavra que o provedor devolve.
 *   }
 */
class WebSpeechEngine implements SpeechEngine {
  private synth = window.speechSynthesis;
  private voices: SpeechSynthesisVoice[] = [];

  constructor() {
    this.loadVoices();
    // Em vários navegadores a lista chega assíncrona, depois do primeiro get.
    this.synth.addEventListener?.('voiceschanged', this.loadVoices);
  }

  private loadVoices = () => {
    this.voices = this.synth.getVoices();
  };

  get available() {
    return true;
  }

  /** Prefere uma voz nativa do idioma; cai para qualquer uma do mesmo prefixo. */
  private pickVoice(lang: keyof typeof LOCALE) {
    const locale = LOCALE[lang];
    const prefix = locale.split('-')[0];
    return (
      this.voices.find((v) => v.lang.replace('_', '-') === locale && v.localService) ??
      this.voices.find((v) => v.lang.replace('_', '-') === locale) ??
      this.voices.find((v) => v.lang.toLowerCase().startsWith(prefix)) ??
      null
    );
  }

  speak(text: string, options: SpeakOptions) {
    this.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = LOCALE[options.lang];
    const voice = this.pickVoice(options.lang);
    if (voice) utterance.voice = voice;
    // Levemente abaixo do padrão: mais próximo de um apresentador do que de um
    // leitor de tela, que é o que a narração de um tour pede.
    utterance.rate = 0.97;
    utterance.pitch = 1;

    utterance.onstart = () => options.onStart?.();
    utterance.onboundary = (event) => options.onProgress?.(event.charIndex);
    utterance.onend = () => options.onEnd?.();
    utterance.onerror = () => {
      // `interrupted`/`canceled` são consequência de nós mesmos cancelarmos —
      // quem chama trata como fim silencioso.
      options.onError?.();
    };

    this.synth.speak(utterance);
  }

  pause() {
    if (this.synth.speaking && !this.synth.paused) this.synth.pause();
  }

  resume() {
    if (this.synth.paused) this.synth.resume();
  }

  cancel() {
    if (this.synth.speaking || this.synth.pending) this.synth.cancel();
  }
}

// ─────────────────────────── ElevenLabs ───────────────────────────────────

interface CloudClip {
  url: string;
  /** Instante de início de cada caractere, em segundos. */
  startTimes: number[];
}

/**
 * Voz de nuvem (ElevenLabs) através de um proxy do próprio backend.
 *
 * A chave da API não aparece aqui de propósito: ela vive no servidor
 * (`supabase/functions/tts` em produção, o middleware do Vite em
 * desenvolvimento). Tudo que é `VITE_*` é embutido no bundle e fica legível
 * para qualquer visitante — uma chave de TTS exposta é cota queimada.
 *
 * O endpoint devolve o áudio junto com o instante de início de cada caractere.
 * É daí que sai o `onProgress`: em vez de estimar, sabemos exatamente qual
 * caractere está sendo pronunciado — a iluminação do texto e a boca do avatar
 * ficam em sincronia real com a voz.
 */
class ElevenLabsEngine implements SpeechEngine {
  private audio = new Audio();
  /** O roteiro do tour é fixo: reouvir uma etapa não deve custar de novo. */
  private cache = new Map<string, CloudClip>();
  private inflight = new Map<string, Promise<CloudClip | null>>();
  private token = 0;
  private frame = 0;
  private fallback = createWebSpeech();

  constructor(private endpoint: string) {
    this.audio.preload = 'auto';
  }

  get available() {
    return true;
  }

  private key(text: string, lang: Language) {
    return `${lang}|${text}`;
  }

  private async fetchClip(text: string, lang: Language): Promise<CloudClip | null> {
    const key = this.key(text, lang);
    const cached = this.cache.get(key);
    if (cached) return cached;

    const running = this.inflight.get(key);
    if (running) return running;

    const request = (async () => {
      try {
        const response = await fetch(this.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, lang }),
        });
        if (!response.ok) throw new Error(`http_${response.status}`);

        const data = await response.json();
        if (!data?.audio) throw new Error('empty_audio');

        // base64 → Blob local: o mesmo clipe pode tocar várias vezes sem
        // voltar à rede (e sem gastar caractere de cota).
        const bytes = Uint8Array.from(atob(data.audio), (ch) => ch.charCodeAt(0));
        const blob = new Blob([bytes], { type: data.mimeType ?? 'audio/mpeg' });
        const clip: CloudClip = {
          url: URL.createObjectURL(blob),
          startTimes: data.alignment?.startTimes ?? [],
        };
        this.cache.set(key, clip);
        return clip;
      } catch (err) {
        console.warn('[tts] nuvem indisponível — usando a voz do navegador:', (err as Error).message);
        return null;
      } finally {
        this.inflight.delete(key);
      }
    })();

    this.inflight.set(key, request);
    return request;
  }

  prefetch(text: string, lang: Language) {
    if (text.trim()) void this.fetchClip(text, lang);
  }

  speak(text: string, options: SpeakOptions) {
    this.cancel();
    const mine = ++this.token;

    void this.fetchClip(text, options.lang).then((clip) => {
      // Outra fala começou enquanto esta baixava — descarta em silêncio.
      if (mine !== this.token) return;

      if (!clip) {
        // Rede fora, cota estourada, chave errada: o tour não fica mudo.
        this.fallback.speak(text, options);
        return;
      }

      this.audio.src = clip.url;
      this.audio.currentTime = 0;

      this.audio.onplaying = () => {
        if (mine === this.token) options.onStart?.();
      };
      this.audio.onended = () => {
        if (mine !== this.token) return;
        cancelAnimationFrame(this.frame);
        options.onEnd?.();
      };
      this.audio.onerror = () => {
        if (mine !== this.token) return;
        cancelAnimationFrame(this.frame);
        options.onError?.();
      };

      // Ponteiro que caminha junto com o áudio: como `startTimes` é crescente,
      // basta avançar — sem busca binária a cada quadro.
      let cursor = 0;
      const track = () => {
        if (mine !== this.token) return;
        const now = this.audio.currentTime;
        while (cursor < clip.startTimes.length && clip.startTimes[cursor] <= now) cursor++;
        options.onProgress?.(cursor);
        this.frame = requestAnimationFrame(track);
      };

      void this.audio.play().then(
        () => {
          this.frame = requestAnimationFrame(track);
        },
        (err: Error) => {
          // Autoplay bloqueado (sem gesto do usuário) cai no motor do navegador.
          console.warn('[tts] reprodução bloqueada:', err.message);
          if (mine === this.token) this.fallback.speak(text, options);
        },
      );
    });
  }

  pause() {
    this.fallback.pause();
    if (!this.audio.paused) this.audio.pause();
    cancelAnimationFrame(this.frame);
  }

  resume() {
    this.fallback.resume();
    if (this.audio.paused && this.audio.src) void this.audio.play();
  }

  cancel() {
    this.token++;
    this.fallback.cancel();
    cancelAnimationFrame(this.frame);
    this.audio.onplaying = this.audio.onended = this.audio.onerror = null;
    if (!this.audio.paused) this.audio.pause();
  }
}

/** Engine inerte: mantém a interface quando o navegador não sintetiza voz. */
const silentEngine: SpeechEngine = {
  available: false,
  speak: (_text, options) => options.onEnd?.(),
  pause: () => {},
  resume: () => {},
  cancel: () => {},
};

function createWebSpeech(): SpeechEngine {
  const supported =
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof window.SpeechSynthesisUtterance === 'function';
  return supported ? new WebSpeechEngine() : silentEngine;
}

let singleton: SpeechEngine | null = null;

/**
 * Escolhe a voz do assistente.
 *
 *   VITE_TTS_PROVIDER=elevenlabs   → voz de nuvem, via proxy
 *   (ausente ou qualquer outro)    → voz do navegador, sem custo
 *
 * O endpoint padrão `/api/tts` é servido pelo middleware do Vite em
 * desenvolvimento; em produção, aponte `VITE_TTS_ENDPOINT` para a Edge
 * Function publicada.
 */
export const createSpeechEngine = (): SpeechEngine => {
  if (singleton) return singleton;

  const provider = import.meta.env.VITE_TTS_PROVIDER;
  const endpoint = import.meta.env.VITE_TTS_ENDPOINT || '/api/tts';

  singleton =
    provider === 'elevenlabs' && typeof window !== 'undefined'
      ? new ElevenLabsEngine(endpoint)
      : createWebSpeech();

  return singleton;
};
