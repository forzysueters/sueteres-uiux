import { describe, expect, it } from 'vitest';
import { buildFleetSummary, fleetSummaryIntent } from './fleetSummary';
import type { Asset } from '../types';

const asset = (overrides: Partial<Asset>): Asset => ({
  id: 'a', tag: 'MTR-001', name: 'Motor', type: 'motor', location: 'Hall A',
  status: 'normal', sensors: [], ...overrides,
} as Asset);

describe('resumo operacional', () => {
  it.each([
    ['faça um resumo', 'assets'],
    ['faz um resumo', 'assets'],
    ['Órion, pode fazer um resumo, por favor?', 'assets'],
    ['me dê um resumo geral', 'assets'],
    ['resumo', 'assets'],
    ['resuma tudo', 'assets'],
    ['faça um resumo da conversa', null],
    ['faça um resumo do manual', null],
    ['resumo dos ativos', 'assets'],
    ['faça um resumo de como estão os motores', 'motors'],
    ['Como estão os motores?', 'motors'],
    ['situação dos equipamentos', 'assets'],
    ['como cadastrar motores?', null],
    ['resumo do manual do motor MTR-001', null],
  ])('interpreta %s', (question, scope) => {
    expect(fleetSummaryIntent(question)).toBe(scope);
  });

  it('filtra motores e visita críticos primeiro sem alterar a lista original', () => {
    const assets = [asset({}), asset({ id: 'pump', type: 'pump' }), asset({ id: 'critical', status: 'critical' })];
    const steps = buildFleetSummary(assets, 'motors');
    expect(steps[0].copy.speech).toContain('2 motores');
    expect(steps[1].route).toBe('/planta/ativo/critical');
    expect(steps[2].route).toBe('/planta/ativo/a');
    expect(steps[steps.length - 1]?.route).toBe('/alertas');
    expect(assets[0].id).toBe('a');
  });

  it('não declara saúde sem sensores ou com ativo offline', () => {
    expect(buildFleetSummary([asset({})], 'assets')[1].copy.speech).toContain('não é possível avaliar');
    const offline = asset({ status: 'offline', sensors: [{ id: 's', name: 'Temperatura', value: 90, unit: '°C', status: 'critical', min: 0, max: 100, threshold: 80 }] });
    expect(buildFleetSummary([offline], 'assets')[1].copy.speech).toContain('não é possível confirmar');
  });

  it('explica leituras anormais e trata frota vazia', () => {
    const motor = asset({ status: 'warning', sensors: [{ id: 's', name: 'Temperatura', value: 85, unit: '°C', status: 'warning', min: 0, max: 100, threshold: 80 }] });
    expect(buildFleetSummary([motor], 'assets')[1].copy.speech).toContain('Temperatura: 85 °C, em alerta');
    const empty = buildFleetSummary([], 'motors');
    expect(empty).toHaveLength(1);
    expect(empty[0].copy.speech).toContain('Não há motores');
  });
});
