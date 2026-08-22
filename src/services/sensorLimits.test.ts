import { describe, it, expect } from 'vitest';
import { statusFor, reasonFor, limitFor, sensorByRole } from './sensorLimits';
import type { Sensor } from '../types';

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
    // MTR-001 — operação nominal, nada fora de faixa. Mede as mesmas três
    // grandezas dos pontos reais do Forzy Lab.
    ['MTR-001', 'Velocidade de Vibração', 2.08, 'normal'],
    ['MTR-001', 'Aceleração', 0.38, 'normal'],
    ['MTR-001', 'Temperatura', 60.34, 'normal'],

    // MTR-002 — rolamento em degradação. Vibração e aceleração medem o MESMO
    // fenômeno (a = 2πf·v), então têm de acusar juntas: se uma entrar em
    // warning e a outra não, os limites saíram de sincronia.
    ['MTR-002', 'Velocidade de Vibração', 5.19, 'warning'],
    ['MTR-002', 'Aceleração', 0.78, 'warning'],
    ['MTR-002', 'Temperatura', 79.47, 'warning'],

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

describe('sensorByRole — resolve a grandeza por papel, não por nome literal', () => {
  const s = (name: string, value: number): Sensor => ({
    id: name, name, unit: '', value, min: 0, max: 100, threshold: 0, status: 'normal',
  });

  // Regressão: os pontos de medição reais (LAB-S1/LAB-S2) e os motores chamam
  // a grandeza de "Velocidade de Vibração". Enquanto o alias só listava
  // "Vibração", sensorByRole devolvia undefined e o viewer 3D dessas páginas
  // caía no default de vibração 0 — com o gauge ao lado mostrando o valor certo.
  it('acha a vibração pelo nome dos ativos reais e dos motores', () => {
    const sensores = [s('Temperatura', 48), s('Velocidade de Vibração', 3.1)];
    expect(sensorByRole(sensores, 'vibration')?.value).toBe(3.1);
  });

  it('continua achando pelo nome dos ativos de processo', () => {
    const sensores = [s('Temperatura', 48), s('Vibração', 2.2)];
    expect(sensorByRole(sensores, 'vibration')?.value).toBe(2.2);
  });

  // EXA-001 tem um sensor "Velocidade" que é rotação em %, não vibração.
  // Ele não pode ser confundido com "Velocidade de Vibração".
  it('não confunde a velocidade do exaustor (% de rotação) com vibração', () => {
    const sensores = [s('Velocidade', 84), s('Corrente Motor', 3.1)];
    expect(sensorByRole(sensores, 'vibration')).toBeUndefined();
  });

  it('resolve a temperatura sob os vários nomes que os ativos usam', () => {
    expect(sensorByRole([s('Temp. Saída', 81)], 'temperature')?.value).toBe(81);
    expect(sensorByRole([s('Temp. Mancal', 55)], 'temperature')?.value).toBe(55);
  });
});
