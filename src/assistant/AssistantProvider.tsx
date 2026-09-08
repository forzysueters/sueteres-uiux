import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence } from 'framer-motion';
import { AssistantLauncher } from './AssistantLauncher';
import { AssistantPanel } from './AssistantPanel';
import { TourSpotlight } from './TourSpotlight';
import { useTourController } from './useTourController';
import { useTargetRect } from './useTargetRect';
import { ASSISTANT_NAME, t } from './copy';

/**
 * Ponto único de integração do assistente com o site.
 *
 * Monte-o uma vez, dentro do Router, e pronto: ele se desenha em um portal
 * sobre `document.body`, então não herda `overflow`, `z-index` nem contexto de
 * empilhamento de nenhum contêiner da aplicação — e nada do layout existente
 * precisa mudar por causa dele.
 */
export const AssistantProvider: React.FC = () => {
  const c = useTourController();
  const avatarRef = useRef<HTMLDivElement>(null);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);

  const spotlightOn = c.open && c.phase === 'tour';
  const rect = useTargetRect(c.step.targets, c.step.padding ?? 8, spotlightOn);

  // O painel sobe quando o elemento em destaque está na metade de baixo da
  // tela — senão o próprio assistente taparia o que está explicando.
  const anchor: 'top' | 'bottom' =
    rect && rect.top + rect.height > window.innerHeight * 0.52 ? 'top' : 'bottom';

  // Origem do traço que liga o avatar ao elemento destacado.
  useLayoutEffect(() => {
    if (!spotlightOn) {
      setOrigin(null);
      return;
    }
    let frame = 0;
    const measure = () => {
      const el = avatarRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const next = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      setOrigin((prev) =>
        prev && Math.abs(prev.x - next.x) < 1 && Math.abs(prev.y - next.y) < 1 ? prev : next,
      );
    };
    const track = () => {
      measure();
      frame = requestAnimationFrame(track);
    };
    measure();
    frame = requestAnimationFrame(track);
    const safety = window.setInterval(measure, 250);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(safety);
    };
  }, [spotlightOn, anchor]);

  // Esc encerra o tour — atalho esperado de qualquer sobreposição.
  useEffect(() => {
    if (!c.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') c.actions.close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [c.open, c.actions]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <AnimatePresence>
        {spotlightOn && (
          <TourSpotlight
            key="spotlight"
            rect={rect}
            label={c.stepCopy.label}
            stepIndex={c.stepIndex}
            stepCount={c.stepCount}
            origin={origin}
            onSkip={c.actions.skip}
          />
        )}
      </AnimatePresence>

      {!c.open && (
        <AssistantLauncher
          state={c.avatarState}
          label={t(c.language, 'open')}
          teaser={c.seen ? null : `${ASSISTANT_NAME} pode te mostrar a plataforma`}
          onOpen={c.actions.openPanel}
        />
      )}

      <AnimatePresence>
        {c.open && (
          <AssistantPanel
            key="panel"
            avatarRef={avatarRef}
            lang={c.language}
            phase={c.phase}
            avatarState={c.avatarState}
            title={c.title}
            text={c.text}
            formatted={c.formatted}
            progress={c.progress}
            stepIndex={c.stepIndex}
            stepCount={c.stepCount}
            speaking={c.speaking}
            paused={c.paused}
            muted={c.muted}
            audioSupported={c.audioSupported}
            anchor={anchor}
            chatPending={c.chatPending}
            chatQuestion={c.chatQuestion}
            canExpand={c.canExpand}
            onStart={c.actions.start}
            onDismiss={c.actions.dismiss}
            onClose={c.actions.close}
            onNext={c.actions.next}
            onBack={c.actions.back}
            onSkip={c.actions.skip}
            onTogglePause={c.actions.togglePause}
            onToggleMute={c.actions.toggleMuted}
            onAsk={c.actions.ask}
            onRestart={c.actions.restart}
            onExpand={c.actions.expand}
          />
        )}
      </AnimatePresence>
    </>,
    document.body,
  );
};
