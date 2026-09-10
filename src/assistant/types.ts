/**
 * Contratos do assistente virtual (Órion).
 *
 * O módulo inteiro é desenhado para ser plugável: nada aqui conhece a estrutura
 * interna das páginas do site — a ligação com a interface acontece só através
 * de seletores CSS declarados no roteiro do tour (`tour.ts`).
 */

export type Language = 'pt' | 'en';

/** Estado do personagem — dirige a animação do avatar. */
export type AvatarState = 'idle' | 'speaking' | 'thinking' | 'listening';

/** Onde o assistente está dentro do seu próprio fluxo. */
export type AssistantPhase =
  | 'dormant' // só o botão flutuante
  | 'greeting' // apresentação + convite para o tour
  | 'tour' // percorrendo as etapas
  | 'chat' // conversa livre
  | 'farewell'; // encerramento do tour

export type TourStepId =
  | 'dashboard'
  | 'charts'
  | 'equipment'
  | 'monitoring'
  | 'predictions'
  | 'reports'
  | 'documentation'
  | 'troubleshooting'
  | 'wrapup';

/** Contexto que o app oferece ao roteiro (ex.: para abrir um ativo real). */
export interface TourContext {
  /** Ativo mais crítico no momento — usado na etapa de predições. */
  focusAssetId: string | null;
}

/**
 * Definição estrutural de uma etapa. A cópia (título/fala) mora separada, em
 * `copy.ts`, para que o roteiro possa ser traduzido sem tocar na navegação.
 */
export interface TourStepDef {
  id: TourStepId;
  /** Rota para onde navegar antes de destacar o alvo. */
  route?: string | ((ctx: TourContext) => string);
  /**
   * Candidatos a alvo do holofote, em ordem de preferência. O primeiro que
   * existir E estiver visível vence — é o que permite o mesmo roteiro servir
   * desktop e celular, onde o menu superior está recolhido.
   */
  targets: string[];
  /** Folga em px ao redor do recorte do holofote. */
  padding?: number;
}

export interface TourStepCopy {
  /** Rótulo curto exibido na etiqueta presa ao elemento destacado. */
  label: string;
  title: string;
  /** Texto falado e exibido no balão. */
  speech: string;
}

// ─────────────────────────── Voz (TTS) ───────────────────────────

export interface SpeakOptions {
  lang: Language;
  /**
   * O áudio começou de fato. Com voz de nuvem há uma espera de rede entre
   * pedir e ouvir; é isso que separa o estado "pensando" do "falando".
   */
  onStart?: () => void;
  /** Progresso da narração, em caracteres — usado para iluminar o texto. */
  onProgress?: (charIndex: number) => void;
  onEnd?: () => void;
  onError?: () => void;
}

/**
 * Camada de voz. Duas implementações vivem em `speech.ts`: a Web Speech API do
 * navegador (padrão, sem custo) e a ElevenLabs via proxy (`VITE_TTS_PROVIDER`).
 * Nenhum componente fala com o navegador nem com a rede diretamente.
 */
export interface SpeechEngine {
  readonly available: boolean;
  speak(text: string, options: SpeakOptions): void;
  pause(): void;
  resume(): void;
  cancel(): void;
  /** Aquece o cache com a fala da próxima etapa, se a implementação suportar. */
  prefetch?(text: string, lang: Language): void;
}
