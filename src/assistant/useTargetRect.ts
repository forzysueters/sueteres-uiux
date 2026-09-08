import { useEffect, useState } from 'react';

export interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Janela em que ainda vale trocar por um alvo de prioridade melhor. */
const UPGRADE_WINDOW_MS = 4000;
/**
 * Carência inicial em que só o alvo preferido é aceito. Sem ela, o holofote
 * piscaria no item de menu antes de saltar para o conteúdo da página, que ainda
 * está montando (ou terminando a animação de entrada) quando a etapa começa.
 */
const GRACE_MS = 700;

const isVisible = (el: Element) => {
  const rect = el.getBoundingClientRect();
  if (rect.width < 4 || rect.height < 4) return false;
  const style = getComputedStyle(el);
  return style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0';
};

const measure = (el: HTMLElement, padding: number): TargetRect => {
  const r = el.getBoundingClientRect();
  return {
    top: r.top - padding,
    left: r.left - padding,
    width: r.width + padding * 2,
    height: r.height + padding * 2,
  };
};

const same = (a: TargetRect | null, b: TargetRect | null) =>
  a === b ||
  (!!a &&
    !!b &&
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5);

/**
 * Acompanha o retângulo do elemento destacado pelo tour.
 *
 * Duas sutilezas justificam o tamanho deste hook:
 *
 * 1. Quando a etapa começa, a rota acabou de mudar e a página de destino ainda
 *    não montou — só o item de menu existe. Aceitar esse fallback e parar seria
 *    destacar o menu a tour inteiro. Por isso a busca continua por alguns
 *    segundos e *promove* o alvo assim que um candidato melhor aparece.
 * 2. O alvo se mexe: scroll suave, animação de entrada, dados chegando. Em vez
 *    de ouvir scroll/resize de cada contêiner, medimos por quadro — é um
 *    `getBoundingClientRect` de um elemento só, e o estado só muda de fato
 *    quando o retângulo muda.
 */
export const useTargetRect = (
  selectors: string[],
  padding = 8,
  enabled = true,
): TargetRect | null => {
  const [rect, setRect] = useState<TargetRect | null>(null);
  const key = selectors.join('|');

  useEffect(() => {
    const list = key ? key.split('|') : [];
    if (!enabled || list.length === 0) {
      setRect(null);
      return;
    }

    let element: HTMLElement | null = null;
    let rank = Infinity; // índice do seletor que venceu (menor = melhor)
    let frame = 0;
    let cancelled = false;
    const started = performance.now();
    const deadline = started + UPGRADE_WINDOW_MS;

    /** Procura um candidato estritamente melhor do que o atual. */
    const upgrade = () => {
      // Nos primeiros instantes, só o primeiro seletor conta.
      const limit = performance.now() - started < GRACE_MS ? 1 : list.length;
      for (let i = 0; i < limit && i < rank; i++) {
        const found = Array.from(document.querySelectorAll<HTMLElement>(list[i])).find(isVisible);
        if (found && found !== element) {
          element = found;
          rank = i;
          found.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
          return;
        }
      }
    };

    const tick = () => {
      if (cancelled) return;
      // Enquanto não houver alvo, ou enquanto a janela de promoção estiver
      // aberta, seguimos procurando algo melhor.
      if (!element || performance.now() < deadline) upgrade();

      if (element) {
        const alive = element.isConnected && isVisible(element);
        const next = alive ? measure(element, padding) : null;
        setRect((prev) => (same(prev, next) ? prev : next));
        if (!alive) {
          element = null;
          rank = Infinity;
        }
      }
    };

    const loop = () => {
      tick();
      frame = requestAnimationFrame(loop);
    };

    tick(); // primeira medição sem esperar quadro nenhum
    frame = requestAnimationFrame(loop);
    // Rede de segurança: em aba de fundo o rAF não roda, mas o holofote ainda
    // precisa aparecer no lugar certo quando o usuário voltar.
    const safety = window.setInterval(tick, 250);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      clearInterval(safety);
    };
  }, [key, padding, enabled]);

  return rect;
};
