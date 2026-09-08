/**
 * Órion — assistente virtual da plataforma.
 *
 * Integração em uma linha, dentro do Router:
 *
 *     import { AssistantProvider } from './assistant'
 *     …
 *     <AssistantProvider />
 *
 * E, nas telas que o tour visita, um atributo declarativo no elemento a
 * destacar (não muda classe, layout nem comportamento):
 *
 *     <div data-tour="dashboard-kpis"> … </div>
 *
 * Peças, caso precise montá-las de outro jeito:
 *   AvatarFace        — o personagem (SVG animado, de 32 a 320px)
 *   AssistantLauncher — estado minimizado
 *   AssistantPanel    — estado expandido (balão + controles)
 *   TourSpotlight     — holofote e traço de indicação
 *   useTourController — máquina de estados (fase, etapa, narração, conversa)
 *   useSpeech         — camada de voz (texto → fala)
 *   useSpeechToText   — entrada por voz (fala → texto)
 *   createSpeechEngine — troque aqui para usar um TTS de nuvem
 */
export { AssistantProvider } from './AssistantProvider';
export { AvatarFace } from './AvatarFace';
export { AssistantLauncher } from './AssistantLauncher';
export { AssistantPanel } from './AssistantPanel';
export { TourSpotlight } from './TourSpotlight';
export { RichText, stripMarkdown } from './RichText';
export { useTourController } from './useTourController';
export { useSpeech } from './useSpeech';
export { useSpeechToText } from './useSpeechToText';
export { createSpeechEngine } from './speech';
export { TOUR_STEPS } from './tour';
export { TOUR_COPY, UI_COPY, ASSISTANT_NAME } from './copy';
export type * from './types';
