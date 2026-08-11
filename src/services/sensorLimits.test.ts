import { describe, it, expect } from 'vitest';
import { statusFor, reasonFor, limitFor } from './sensorLimits';

describe('statusFor — direção "above" (alto é ruim)', () => {
  // Vibração, ISO 10816-3 classe II: warn 4.5 / crit 7.1
  it('abaixo do warn é normal', () => {
    expect(statusFor('Vibração', 4.09)).toBe('normal');
  });
  it('a partir do warn é warning', () => {
    expect(statusFor('Vibração', 4.5)).toBe('warning');
    expect(statusFor('Vibração', 5.19)).toBe('warning');
  });
  it('a partir do crit é critical', () => {
    expect(statusFor('Vibração', 7.1)).toBe('critical');
    expect(statusFor('Vibração', 8.08)).toBe('critical');
  });
});

describe('statusFor — direção "below" (baixo é ruim)', () => {
  // Vazão da bomba: warn 120 / crit 100 L/min. Só existe como override de
  // pump-001 — vazão não é uma grandeza com limite universal.
  it('acima do warn é normal', () => {
    expect(statusFor('Vazão', 149.59, 'BBA-001')).toBe('normal');
  });
  it('a partir do warn é warning', () => {
    expect(statusFor('Vazão', 120, 'BBA-001')).toBe('warning');
    expect(statusFor('Vazão', 110, 'BBA-001')).toBe('warning');
  });
  it('a partir do crit é critical', () => {
    expect(statusFor('Vazão', 100, 'BBA-001')).toBe('critical');
    expect(statusFor('Vazão', 80, 'BBA-001')).toBe('critical');
  });
});

describe('statusFor — direção "band" (desvio nos dois sentidos)', () => {
  // Tensão: nominal 380, warn ±19 (5%), crit ±38 (10%)
  it('dentro da faixa é normal', () => {
    expect(statusFor('Tensão', 384.89)).toBe('normal');
    expect(statusFor('Tensão', 365)).toBe('normal');
  });
  it('desvio para cima e para baixo pesa igual', () => {
    expect(statusFor('Tensão', 400)).toBe('warning');
    expect(statusFor('Tensão', 360)).toBe('warning');
    expect(statusFor('Tensão', 420)).toBe('critical');
    expect(statusFor('Tensão', 340)).toBe('critical');
  });
});

describe('limitFor — resolução por ativo', () => {
  it('usa o override do ativo quando existe', () => {
    // fan-001 é 0,75 kW → ISO 10816-3 classe I, limites mais apertados
    expect(limitFor('Vibração', 'EXA-001')?.warn).toBe(2.8);
    expect(limitFor('Vibração', 'CMP-001')?.warn).toBe(4.5);
  });
  it('cai no limite genérico quando o ativo não tem override', () => {
    expect(limitFor('Vibração')?.warn).toBe(4.5);
  });
  it('retorna null para grandeza desconhecida', () => {
    expect(limitFor('Grandeza Inexistente')).toBeNull();
  });
});

describe('grandeza sem limite definido', () => {
  it('nunca vira alerta', () => {
    expect(statusFor('Grandeza Inexistente', 99999)).toBe('normal');
  });
  it('não produz justificativa', () => {
    expect(reasonFor('Grandeza Inexistente', 99999, 'x')).toBeNull();
  });
});

describe('reasonFor — texto derivado do próprio valor', () => {
  it('cita o valor medido, o limite violado e a referência', () => {
    const r = reasonFor('Vibração', 5.19, 'mm/s');
    expect(r).toContain('5,19 mm/s');
    expect(r).toContain('4,5 mm/s');
    expect(r).toContain('ISO 10816-3');
  });
  it('cita o limite crítico quando o valor é crítico', () => {
    expect(reasonFor('Vibração', 8.08, 'mm/s')).toContain('7,1 mm/s');
  });
  it('é null quando o sensor está normal', () => {
    expect(reasonFor('Vibração', 2.08, 'mm/s')).toBeNull();
  });
  it('descreve desvio, não ultrapassagem, para grandezas em faixa', () => {
    expect(reasonFor('Tensão', 405, 'V')).toContain('380');
  });
});

// ─── Aceitação: o estado que cada ativo deve apresentar na tela ──────────────
// Valores conferidos contra o gerador determinístico de `api.ts`.
describe('cenário dos ativos', () => {
  const casos: [string, string, number, string][] = [
    // MTR-001 — operação nominal, nada fora de faixa
    ['MTR-001', 'Tensão', 384.89, 'normal'],
    ['MTR-001', 'Corrente', 29.57, 'normal'],
    ['MTR-001', 'Temperatura', 60.34, 'normal'],
    ['MTR-001', 'Rotação', 1768.49, 'normal'],
    ['MTR-001', 'Vibração', 2.08, 'normal'],

    // MTR-002 — rolamento em degradação: vibração lidera, temperatura acompanha
    ['MTR-002', 'Tensão', 381.16, 'normal'],
    ['MTR-002', 'Corrente', 49.75, 'normal'],
    ['MTR-002', 'Temperatura', 79.47, 'warning'],
    ['MTR-002', 'Rotação', 1458.33, 'normal'],
    ['MTR-002', 'Vibração', 5.19, 'warning'],

    // BBA-001 — nominal
    ['BBA-001', 'Pressão', 2.65, 'normal'],
    ['BBA-001', 'Vazão', 149.59, 'normal'],
    ['BBA-001', 'Temperatura', 41.85, 'normal'],
    ['BBA-001', 'Potência', 5.1, 'normal'],

    // CMP-001 — vibração severa; o resto opera dentro da faixa
    ['CMP-001', 'Pressão de Saída', 7.09, 'normal'],
    ['CMP-001', 'Temp. Entrada', 27.35, 'normal'],
    ['CMP-001', 'Temp. Saída', 81.18, 'normal'],
    ['CMP-001', 'Corrente Motor', 38.76, 'normal'],
    ['CMP-001', 'Vibração', 8.08, 'critical'],

    // EXA-001 — nominal
    ['EXA-001', 'Velocidade', 82.9, 'normal'],
    ['EXA-001', 'Corrente Motor', 2.96, 'normal'],
    ['EXA-001', 'Temp. Mancal', 55.4, 'normal'],
    ['EXA-001', 'Vibração', 0.91, 'normal'],
  ];

  it.each(casos)('%s / %s = %s', (assetId, sensor, valor, esperado) => {
    expect(statusFor(sensor, valor, assetId)).toBe(esperado);
  });

  it('toda grandeza usada nos ativos tem limite definido', () => {
    for (const [assetId, sensor] of casos) {
      expect(limitFor(sensor, assetId), `${assetId}/${sensor} sem limite`).not.toBeNull();
    }
  });
});
