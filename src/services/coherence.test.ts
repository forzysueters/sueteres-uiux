import { describe, it, expect, beforeEach } from 'vitest';
import { statusFor, reasonFor, registerSensorLimits, clearRegisteredLimits } from './sensorLimits';
import { assetStatusFromSensors, worstSensor } from '../utils/plantStatus';
import type { Asset, Sensor } from '../types';

/**
 * Invariantes de coerência entre sensor, status do ativo e alerta.
 *
 * Antes estas garantias eram verificadas contra o `apiService` com dados em
 * memória. Agora os ativos vêm do Postgres, então o alvo passa a ser a regra
 * pura — que é o que de fato impede um ativo aparecer "em alerta" sem nenhum
 * sensor fora de faixa, ou um alerta citar um número que a tela não mostra.
 */

const sensor = (name: string, value: number, unit: string, tag: string): Sensor => ({
  id: `${tag}-${name}`,
  name,
  unit,
  value,
  min: 0,
  max: 100,
  threshold: 0,
  status: statusFor(name, value, tag),
});

const asset = (tag: string, sensors: Sensor[]): Asset => ({
  id: `id-${tag}`,
  tag,
  name: tag,
  type: 'motor',
  areaId: null,
  criticality: 'medium',
  area: 'Hall A',
  location: 'Hall A',
  status: 'normal',
  uptime: 100,
  sensors,
  lastMaintenance: '',
  nextMaintenance: '',
  x: 1,
  y: 1,
  plantX: 0,
  plantY: 0,
  anomalyScore: 0,
});

describe('status do ativo derivado dos sensores', () => {
  it('reflete o pior sensor', () => {
    const saudavel = asset('MTR-001', [
      sensor('Temperatura', 62, '°C', 'MTR-001'),
      sensor('Velocidade de Vibração', 2.3, 'mm/s', 'MTR-001'),
    ]);
    expect(assetStatusFromSensors(saudavel)).toBe('normal');

    const emAlerta = asset('MTR-002', [
      sensor('Temperatura', 79, '°C', 'MTR-002'),
      sensor('Velocidade de Vibração', 5.2, 'mm/s', 'MTR-002'),
    ]);
    expect(assetStatusFromSensors(emAlerta)).toBe('warning');

    const critico = asset('CMP-001', [
      sensor('Temp. Saída', 84, '°C', 'CMP-001'),
      sensor('Vibração', 8.1, 'mm/s', 'CMP-001'),
    ]);
    expect(assetStatusFromSensors(critico)).toBe('critical');
  });

  it('nenhum ativo fica em alerta sem um sensor que o justifique', () => {
    const a = asset('MTR-001', [
      sensor('Temperatura', 60, '°C', 'MTR-001'),
      sensor('Velocidade de Vibração', 2.0, 'mm/s', 'MTR-001'),
    ]);
    a.status = assetStatusFromSensors(a);
    expect(a.status !== 'normal').toBe(a.sensors.some((s) => s.status !== 'normal'));
    expect(worstSensor(a)).toBeNull();
  });

  it('offline é estado de comunicação e sobrevive à derivação', () => {
    const a = asset('EXA-001', [sensor('Vibração', 0.9, 'mm/s', 'EXA-001')]);
    a.status = 'offline';
    expect(assetStatusFromSensors(a)).toBe('offline');
  });
});

describe('justificativa do alerta', () => {
  it('cita o valor realmente medido pelo sensor', () => {
    const texto = reasonFor('Vibração', 8.1, 'mm/s', 'CMP-001');
    expect(texto).toContain('8,1 mm/s');
    expect(texto).toContain('7,1');
  });

  it('não existe justificativa para sensor dentro da faixa', () => {
    expect(reasonFor('Velocidade de Vibração', 2.3, 'mm/s', 'MTR-001')).toBeNull();
  });

  it('a severidade da justificativa acompanha a do sensor', () => {
    expect(statusFor('Velocidade de Vibração', 5.2, 'MTR-002')).toBe('warning');
    expect(reasonFor('Velocidade de Vibração', 5.2, 'mm/s', 'MTR-002')).toContain('4,5');

    expect(statusFor('Vibração', 8.1, 'CMP-001')).toBe('critical');
    expect(reasonFor('Vibração', 8.1, 'mm/s', 'CMP-001')).toContain('7,1');
  });
});

describe('limites carregados do banco', () => {
  beforeEach(clearRegisteredLimits);

  it('sobrescrevem a tabela estática', () => {
    expect(statusFor('Velocidade de Vibração', 5.0, 'MTR-001')).toBe('warning');

    // O cadastro do sensor no banco afrouxa o limite para esta máquina.
    registerSensorLimits('MTR-001', 'Velocidade de Vibração', {
      warn: 6.0,
      crit: 9.0,
      direction: 'above',
      source: 'Limite de projeto revisado',
    });
    expect(statusFor('Velocidade de Vibração', 5.0, 'MTR-001')).toBe('normal');
    expect(statusFor('Velocidade de Vibração', 6.0, 'MTR-001')).toBe('warning');
    expect(reasonFor('Velocidade de Vibração', 9.5, 'mm/s', 'MTR-001')).toContain('Limite de projeto revisado');
  });

  it('não afetam outros ativos', () => {
    registerSensorLimits('MTR-001', 'Velocidade de Vibração', {
      warn: 6.0, crit: 9.0, direction: 'above', source: 'x',
    });
    expect(statusFor('Velocidade de Vibração', 5.0, 'MTR-002')).toBe('warning');
  });

  it('registro incompleto é ignorado, preservando o limite conhecido', () => {
    registerSensorLimits('MTR-001', 'Velocidade de Vibração', { warn: null, crit: null });
    expect(statusFor('Velocidade de Vibração', 5.0, 'MTR-001')).toBe('warning');
  });

  it('direção "band" sem nominal é recusada', () => {
    registerSensorLimits('MTR-001', 'Tensão', {
      warn: 10, crit: 20, direction: 'band', nominal: null, source: 'x',
    });
    // Continua valendo o limite estático (±19 V / ±38 V em torno de 380 V).
    expect(statusFor('Tensão', 395, 'MTR-001')).toBe('normal');
  });
});
