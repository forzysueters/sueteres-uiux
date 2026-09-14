import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { alertEmail } from './email-template'
import {
  insideServiceWindow,
  normalizePhone,
  parseInbound,
  toWhatsAppText,
  verifySignature,
  verifySubscription,
} from './whatsapp'

describe('whatsapp', () => {
  it('normaliza número brasileiro para E.164 só com dígitos', () => {
    expect(normalizePhone('(11) 98765-4321')).toBe('5511987654321')
    expect(normalizePhone('+55 11 98765-4321')).toBe('5511987654321')
    expect(normalizePhone('0055 11 98765-4321')).toBe('5511987654321')
    expect(normalizePhone('123')).toBeNull()
  })

  it('aceita só assinatura HMAC do corpo bruto com o App Secret', async () => {
    const body = '{"entry":[]}'
    const sig = `sha256=${createHmac('sha256', 'segredo').update(body).digest('hex')}`
    expect(await verifySignature(body, sig, 'segredo')).toBe(true)
    expect(await verifySignature(body, sig, 'outro')).toBe(false)
    expect(await verifySignature(`${body} `, sig, 'segredo')).toBe(false)
    expect(await verifySignature(body, null, 'segredo')).toBe(false)
  })

  it('responde o challenge só com o verify token certo', () => {
    const url = new URL('https://x/fn?hub.mode=subscribe&hub.verify_token=tk&hub.challenge=42')
    expect(verifySubscription(url, 'tk')).toBe('42')
    expect(verifySubscription(url, 'errado')).toBeNull()
  })

  it('extrai texto, botão e áudio e ignora status de entrega', () => {
    const payload = {
      entry: [{ changes: [{ value: {
        contacts: [{ wa_id: '5511987654321', profile: { name: 'Ana' } }],
        messages: [
          { id: 'a', from: '5511987654321', timestamp: '1700000000', type: 'text', text: { body: 'Como está o CMP-001?' } },
          { id: 'b', from: '5511987654321', timestamp: '1700000001', type: 'audio', audio: { id: 'm1' } },
          { id: 'c', from: '5511987654321', timestamp: '1700000002', type: 'button', button: { text: 'Ver ativo' } },
        ],
        statuses: [{ id: 'z', status: 'delivered' }],
      } }] }],
    }
    const msgs = parseInbound(payload)
    expect(msgs.map((m) => m.id)).toEqual(['a', 'b', 'c'])
    expect(msgs[0]).toMatchObject({ name: 'Ana', type: 'text', text: 'Como está o CMP-001?' })
    expect(msgs[1]).toMatchObject({ type: 'audio', audioId: 'm1', text: null })
    expect(msgs[2].text).toBe('Ver ativo')
  })

  it('converte o markdown do Órion para a formatação do WhatsApp', () => {
    const md = '## Situação\n**CMP-001** está crítico.\n\n| Ativo | Saúde |\n|---|---|\n| CMP-001 | 28 |\n- verificar mancal'
    const out = toWhatsAppText(md)
    expect(out).toContain('*Situação*')
    expect(out).toContain('*CMP-001* está crítico.')
    expect(out).toContain('CMP-001 · 28')
    expect(out).not.toContain('|')
    expect(out).toContain('• verificar mancal')
  })

  it('limita a janela de texto livre a 24 h desde a última mensagem recebida', () => {
    const now = Date.parse('2026-09-14T12:00:00Z')
    expect(insideServiceWindow('2026-09-14T00:00:00Z', now)).toBe(true)
    expect(insideServiceWindow('2026-09-13T11:59:00Z', now)).toBe(false)
    expect(insideServiceWindow(null, now)).toBe(false)
  })
})

describe('alertEmail', () => {
  const base = {
    assetId: 'a1b2',
    assetTag: 'CMP-001',
    assetName: 'Compressor <Atlas>',
    severity: 'critical' as const,
    title: 'Velocidade fora da faixa',
    message: 'Leitura de 7,6 mm/s acima do limite de 7,1 mm/s.',
    insight: 'Degradação crítica (saúde 28/100).',
    healthIndex: 28.1,
    triggeredAt: '2026-09-14T11:05:00Z',
    appUrl: 'https://forzy.app',
  }

  it('monta assunto com severidade, TAG e título, e escapa dado do banco', () => {
    const { subject, html } = alertEmail(base, 'pt')
    expect(subject).toBe('Crítico · CMP-001 · Velocidade fora da faixa')
    expect(html).toContain('Compressor &lt;Atlas&gt;')
    expect(html).toContain('https://forzy.app/planta/ativo/a1b2')
    expect(html).toContain('28/100')
  })

  it('sai sem botão quando não há URL do app', () => {
    const { html } = alertEmail({ ...base, appUrl: null }, 'en')
    expect(html).not.toContain('/planta/ativo/')
    expect(html).toContain('Orion notice')
  })
})
