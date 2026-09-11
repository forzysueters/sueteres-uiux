import { describe, it, expect } from 'vitest';
import { secondsToNextCycle } from './useNextInsight';

/**
 * A contagem tem de bater com o cron do Postgres, que dispara nos minutos
 * múltiplos de 5. Se ela derivasse do momento em que a tela abriu, cada aba
 * mostraria um número diferente e o "0" não coincidiria com a avaliação real.
 */
const at = (minute: number, second: number) => new Date(2026, 8, 9, 14, minute, second);

describe('secondsToNextCycle', () => {
  it('zera exatamente nos minutos múltiplos de 5 — devolve o ciclo inteiro', () => {
    expect(secondsToNextCycle(at(0, 0))).toBe(300);
    expect(secondsToNextCycle(at(15, 0))).toBe(300);
    expect(secondsToNextCycle(at(55, 0))).toBe(300);
  });

  it('conta o que falta para o próximo múltiplo de 5, não 5 min a partir de agora', () => {
    expect(secondsToNextCycle(at(3, 0))).toBe(120); // 14:03 → 14:05
    expect(secondsToNextCycle(at(4, 59))).toBe(1); // um segundo antes da virada
    expect(secondsToNextCycle(at(12, 30))).toBe(150); // 14:12:30 → 14:15
  });

  it('nunca devolve zero ou negativo — o valor mínimo é o último segundo', () => {
    for (let m = 0; m < 60; m++) {
      for (const sec of [0, 1, 29, 30, 59]) {
        const left = secondsToNextCycle(at(m, sec));
        expect(left).toBeGreaterThan(0);
        expect(left).toBeLessThanOrEqual(300);
      }
    }
  });
});
