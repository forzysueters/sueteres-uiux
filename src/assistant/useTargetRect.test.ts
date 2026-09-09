import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTargetRect } from './useTargetRect';

/** jsdom mede tudo como zero; o holofote descarta alvo menor que 4px. */
const sizeIt = (el: HTMLElement, width: number, height = 40) => {
  el.getBoundingClientRect = () =>
    ({ top: 10, left: 20, width, height, right: 20 + width, bottom: 50, x: 20, y: 10, toJSON: () => ({}) }) as DOMRect;
};

describe('useTargetRect', () => {
  let target: HTMLElement;
  let scrollIntoView: (arg?: boolean | ScrollIntoViewOptions) => void;

  beforeEach(() => {
    vi.useFakeTimers();
    scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    target = document.createElement('div');
    target.setAttribute('data-tour', 'alvo');
    sizeIt(target, 200);
    document.body.appendChild(target);
  });

  afterEach(() => {
    vi.useRealTimers();
    target.remove();
  });

  it('rola até o alvo ao entrar na etapa', () => {
    renderHook(() => useTargetRect(['[data-tour="alvo"]'], 8, true));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  /**
   * Regressão: o alvo pisca de visibilidade enquanto a página nova anima a
   * entrada. Antes, cada readquirição disparava um `scrollIntoView` suave — a
   * cada quadro — e as rolagens brigavam entre si, deixando a página presa.
   */
  it('não rola de novo quando o alvo pisca de visibilidade', () => {
    renderHook(() => useTargetRect(['[data-tour="alvo"]'], 8, true));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    // Some (como durante a animação de entrada) e volta.
    sizeIt(target, 0);
    vi.advanceTimersByTime(600);
    sizeIt(target, 200);
    vi.advanceTimersByTime(600);

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('não rola quando não há alvo para destacar', () => {
    renderHook(() => useTargetRect([], 8, true));
    vi.advanceTimersByTime(600);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
