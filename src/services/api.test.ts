import { describe, it, expect } from 'vitest';
import { apiService } from './api';
import { statusFor } from './sensorLimits';

const ASSET_IDS = ['motor-001', 'motor-002', 'pump-001', 'compressor-001', 'fan-001'];

describe('coerência entre sensores e alertas', () => {
  it('todo alerta de sensor corresponde a um sensor fora de faixa', async () => {
    for (const id of ASSET_IDS) {
      const asset = await apiService.getAssetById(id);
      const alerts = await apiService.getAlertsByAsset(id);
      const foraDeFaixa = asset!.sensors.filter((s) => s.status !== 'normal').map((s) => s.name);

      // Alertas de manutenção não vêm de sensor e são marcados como 'info'.
      const deSensor = alerts.filter((a) => a.severity !== 'info');
      for (const alerta of deSensor) {
        const casou = foraDeFaixa.some((nome) => alerta.title.startsWith(nome));
        expect(casou, `${id}: alerta "${alerta.title}" sem sensor fora de faixa`).toBe(true);
      }
    }
  });

  it('todo sensor fora de faixa gera exatamente um alerta', async () => {
    for (const id of ASSET_IDS) {
      const asset = await apiService.getAssetById(id);
      const alerts = await apiService.getAlertsByAsset(id);
      for (const sensor of asset!.sensors.filter((s) => s.status !== 'normal')) {
        const casados = alerts.filter((a) => a.title.startsWith(sensor.name));
        expect(casados, `${id}/${sensor.name}`).toHaveLength(1);
      }
    }
  });

  it('o texto do alerta cita o valor realmente medido pelo sensor', async () => {
    const asset = await apiService.getAssetById('motor-002');
    const alerts = await apiService.getAlertsByAsset('motor-002');
    for (const sensor of asset!.sensors.filter((s) => s.status !== 'normal')) {
      const alerta = alerts.find((a) => a.title.startsWith(sensor.name))!;
      const valorPtBr = String(sensor.value).replace('.', ',');
      expect(alerta.description).toContain(valorPtBr);
    }
  });

  it('a severidade do alerta espelha a do sensor', async () => {
    const alerts = await apiService.getAlertsByAsset('compressor-001');
    const vibracao = alerts.find((a) => a.title.startsWith('Vibração'))!;
    expect(vibracao.severity).toBe('critical');
  });
});

describe('status do ativo derivado dos sensores', () => {
  it('reflete o pior sensor', async () => {
    const esperado: Record<string, string> = {
      'motor-001': 'normal',
      'motor-002': 'warning',     // vibração + temperatura em atenção
      'pump-001': 'normal',
      'compressor-001': 'critical', // vibração em zona D
      'fan-001': 'normal',
    };
    for (const [id, status] of Object.entries(esperado)) {
      const asset = await apiService.getAssetById(id);
      expect(asset!.status, id).toBe(status);
    }
  });

  it('nenhum ativo fica em alerta sem um sensor que o justifique', async () => {
    for (const id of ASSET_IDS) {
      const asset = await apiService.getAssetById(id);
      const temOfensor = asset!.sensors.some((s) => s.status !== 'normal');
      expect(asset!.status !== 'normal', `${id} sem sensor que justifique`).toBe(temOfensor);
    }
  });
});

describe('MTR-002 — narrativa de rolamento em degradação', () => {
  it('a vibração é o indicador líder: alerta mais antigo que o da temperatura', async () => {
    const alerts = await apiService.getAlertsByAsset('motor-002');
    const vib = alerts.find((a) => a.title.startsWith('Vibração'))!;
    const temp = alerts.find((a) => a.title.startsWith('Temperatura'))!;
    expect(Date.parse(vib.timestamp)).toBeLessThan(Date.parse(temp.timestamp));
  });

  it('os sensores elétricos seguem nominais — a falha é mecânica', async () => {
    const asset = await apiService.getAssetById('motor-002');
    for (const nome of ['Tensão', 'Corrente', 'Rotação']) {
      const s = asset!.sensors.find((x) => x.name === nome)!;
      expect(s.status, nome).toBe('normal');
    }
  });
});

describe('tick de tempo real', () => {
  it('reavalia o status a cada atualização, em vez de congelá-lo', async () => {
    const asset = (await apiService.updateAssetSensors('motor-002'))!;
    for (const sensor of asset.sensors) {
      expect(sensor.status, sensor.name).toBe(statusFor(sensor.name, sensor.value, 'motor-002'));
    }
  });
});
