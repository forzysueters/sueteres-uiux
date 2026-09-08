import { describe, it, expect } from 'vitest'
import {
  assetReportEmail,
  esc,
  formatDateTime,
  maintenanceEmail,
  type AssetReportEmailData,
  type MaintenanceEmailData,
} from './email-template'

const ORDER: MaintenanceEmailData = {
  orderNumber: 'OM-20260908-A1B2C3',
  assetTag: 'MTR-001',
  assetName: 'Motor de Produção',
  location: 'Hall A — Estação 1',
  type: 'preventive',
  priority: 'high',
  scheduledFor: '2026-09-10T13:00:00.000Z',
  technicianName: 'Ana Souza',
  requesterName: 'Vinicius Garbellini',
  description: 'Troca de rolamento do lado acoplado.',
}

const REPORT: AssetReportEmailData = {
  assetTag: 'MTR-001',
  assetName: 'Motor de Produção',
  location: 'Hall A',
  status: 'warning',
  healthIndex: 62.4,
  insight: 'Tendência de aquecimento no mancal traseiro.',
  sensors: [
    { name: 'Temperatura', value: 78.2, unit: '°C', threshold: 80, mean2h: 71.5, status: 'warning' },
    { name: 'Vibração', value: 2.1, unit: 'mm/s', threshold: 4.5, mean2h: null, status: 'normal' },
  ],
  alerts: [
    {
      title: 'Temperatura acima do esperado',
      message: 'Leitura sustentada acima da média das últimas 2h.',
      severity: 'warning',
      triggeredAt: '2026-09-08T12:00:00.000Z',
    },
  ],
  lastMaintenance: '2026-06-01',
  nextMaintenance: '2026-12-01',
  generatedAt: '2026-09-08T15:30:00.000Z',
  hasPdf: true,
}

describe('esc', () => {
  it('neutraliza markup vindo do banco', () => {
    expect(esc('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    )
  })

  it('trata nulo e indefinido como string vazia', () => {
    expect(esc(null)).toBe('')
    expect(esc(undefined)).toBe('')
  })
})

describe('formatDateTime', () => {
  it('converte para o fuso da planta, não UTC', () => {
    // 13:00Z é 10:00 em São Paulo — sem o timeZone o e-mail mostraria a hora errada.
    expect(formatDateTime('2026-09-10T13:00:00.000Z', 'pt')).toContain('10:00')
  })

  it('devolve travessão para data ausente ou inválida', () => {
    expect(formatDateTime(null, 'pt')).toBe('—')
    expect(formatDateTime('nao-e-data', 'pt')).toBe('—')
  })
})

describe('maintenanceEmail', () => {
  it('muda o texto conforme o destinatário', () => {
    const requester = maintenanceEmail(ORDER, 'pt', 'requester')
    const technician = maintenanceEmail(ORDER, 'pt', 'technician')

    expect(requester.html).toContain('Sua solicitação foi registrada')
    expect(technician.html).toContain('atribuída a você')
    // O técnico já sabe que é ele; o que lhe falta é quem pediu.
    expect(technician.html).toContain('Vinicius Garbellini')
    expect(requester.html).toContain('Ana Souza')
  })

  it('leva número da OM e TAG para o assunto', () => {
    const { subject } = maintenanceEmail(ORDER, 'pt', 'requester')
    expect(subject).toContain('OM-20260908-A1B2C3')
    expect(subject).toContain('MTR-001')
  })

  it('escapa a descrição escrita pelo usuário', () => {
    const hostile = { ...ORDER, description: '<img src=x onerror="alert(1)">' }
    const { html } = maintenanceEmail(hostile, 'pt', 'requester')
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img src=x')
  })

  it('traduz tipo e prioridade para o idioma pedido', () => {
    expect(maintenanceEmail(ORDER, 'pt', 'requester').html).toContain('Preventiva')
    expect(maintenanceEmail(ORDER, 'en', 'requester').html).toContain('Preventive')
  })
})

describe('assetReportEmail', () => {
  it('põe saúde e TAG no assunto', () => {
    const { subject } = assetReportEmail(REPORT, 'pt')
    expect(subject).toContain('MTR-001')
    expect(subject).toContain('62/100')
  })

  it('acompanha cada estado de um glifo, não só da cor', () => {
    const { html } = assetReportEmail(REPORT, 'pt')
    // Impressão em P&B e deuteranopia deixam crítico e normal indistinguíveis.
    expect(html).toContain('▲')
    expect(html).toContain('●')
  })

  it('mostra travessão quando o sensor não tem média de 2h', () => {
    const { html } = assetReportEmail(REPORT, 'pt')
    expect(html).toContain('—')
  })

  it('não desenha tendência dentro da banda morta de 2%', () => {
    const flat = {
      ...REPORT,
      sensors: [{ name: 'Vibração', value: 100, unit: 'mm/s', threshold: 120, mean2h: 99, status: 'normal' as const }],
    }
    const { html } = assetReportEmail(flat, 'pt')
    expect(html).not.toContain('▼')
  })

  it('avisa do anexo apenas quando existe PDF', () => {
    expect(assetReportEmail(REPORT, 'pt').html).toContain('anexo')
    expect(assetReportEmail({ ...REPORT, hasPdf: false }, 'pt').html).not.toContain('segue anexo')
  })

  it('substitui a lista de alertas por uma frase quando não há nenhum', () => {
    const { html } = assetReportEmail({ ...REPORT, alerts: [] }, 'pt')
    expect(html).toContain('Nenhum alerta ativo')
  })
})
