import { describe, it, expect } from 'vitest'
import {
  resolveFocusAssets,
  needsHistoryEnrichment,
  buildSearchQuery,
  filterRelevantDocs,
  filterCitedDocs,
  buildContextBlock,
  buildAssetContextText,
  buildComparisonContextText,
  buildFleetContextText,
  SYSTEM_PROMPT,
  type AssetRef,
  type ChatTurn,
  type DocChunk,
} from './context'

const ASSETS: AssetRef[] = [
  { id: 'a1', tag: 'CMP-001', name: 'Compressor de Ar', status: 'critical', anomaly_score: 23 },
  { id: 'a2', tag: 'MTR-002', name: 'Motor de Reserva', status: 'warning', anomaly_score: 12 },
  { id: 'a3', tag: 'MTR-001', name: 'Motor de Produção', status: 'normal', anomaly_score: 2 },
]

describe('resolveFocusAssets', () => {
  it('prioriza a TAG mencionada na pergunta sobre a seleção da UI', () => {
    const r = resolveFocusAssets('qual o status do CMP-001?', 'a2', [], ASSETS)
    expect(r).toEqual({ assets: [ASSETS[0]], source: 'question' })
  })

  it('reconhece o ativo pelo nome quando a TAG não aparece', () => {
    const r = resolveFocusAssets('como está o motor de reserva?', null, [], ASSETS)
    expect(r.assets.map((a) => a.tag)).toEqual(['MTR-002'])
    expect(r.source).toBe('question')
  })

  it('usa a seleção da UI quando a pergunta não menciona nenhum ativo', () => {
    const r = resolveFocusAssets('quais alertas estão abertos?', 'a3', [], ASSETS)
    expect(r).toEqual({ assets: [ASSETS[2]], source: 'ui' })
  })

  it('cai para o último turno do usuário que mencionou algum ativo', () => {
    const history: ChatTurn[] = [
      { role: 'user', content: 'como está o CMP-001?' },
      { role: 'assistant', content: 'Está crítico.' },
    ]
    const r = resolveFocusAssets('e a manutenção dele, quando está agendada?', null, history, ASSETS)
    expect(r).toEqual({ assets: [ASSETS[0]], source: 'history' })
  })

  it('não resolve nenhum ativo quando não há menção, UI nem histórico', () => {
    const r = resolveFocusAssets('quais ativos precisam de manutenção hoje?', null, [], ASSETS)
    expect(r).toEqual({ assets: [], source: null })
  })

  it('resolve múltiplos ativos citados na mesma pergunta (comparação)', () => {
    const r = resolveFocusAssets('compare o CMP-001 e o MTR-002', null, [], ASSETS)
    expect(r.assets.map((a) => a.tag).sort()).toEqual(['CMP-001', 'MTR-002'])
    expect(r.source).toBe('question')
  })

  it('não fica preso a "o último ativo": recupera os DOIS ativos de uma comparação anterior no acompanhamento', () => {
    const history: ChatTurn[] = [
      { role: 'user', content: 'compare o CMP-001 e o MTR-002' },
      { role: 'assistant', content: 'CMP-001 está crítico, MTR-002 está em alerta.' },
    ]
    const r = resolveFocusAssets('qual dos dois apresenta maior risco?', null, history, ASSETS)
    expect(r.assets.map((a) => a.tag).sort()).toEqual(['CMP-001', 'MTR-002'])
    expect(r.source).toBe('history')
  })

  it('acompanha a troca de ativo: a menção mais recente sempre vence, mesmo após falar de outro', () => {
    // Como está o MTR-002? -> E o MTR-001? -> E a temperatura dele? (deve ser MTR-001, não MTR-002)
    const history: ChatTurn[] = [
      { role: 'user', content: 'como está o MTR-002?' },
      { role: 'assistant', content: 'Em alerta.' },
      { role: 'user', content: 'e o MTR-001?' },
      { role: 'assistant', content: 'Normal.' },
    ]
    const r = resolveFocusAssets('e a temperatura dele?', null, history, ASSETS)
    expect(r.assets.map((a) => a.tag)).toEqual(['MTR-001'])
    expect(r.source).toBe('history')
  })
})

describe('needsHistoryEnrichment', () => {
  it('detecta referências anafóricas', () => {
    expect(needsHistoryEnrichment('o que a documentação recomenda nesse caso?')).toBe(true)
    expect(needsHistoryEnrichment('e esse?')).toBe(true)
    expect(needsHistoryEnrichment('isso é normal?')).toBe(true)
  })

  it('detecta perguntas muito curtas mesmo sem anáfora explícita', () => {
    expect(needsHistoryEnrichment('e a potência?')).toBe(true)
  })

  it('não marca perguntas factuais completas', () => {
    expect(needsHistoryEnrichment('qual é o modelo do motor de produção?')).toBe(false)
  })
})

describe('buildSearchQuery', () => {
  const history: ChatTurn[] = [
    { role: 'user', content: 'qual a tensão do motor de produção?' },
    { role: 'assistant', content: 'A tensão registrada é 380V.' },
  ]

  it('combina a pergunta anterior do usuário quando a atual é referencial', () => {
    expect(buildSearchQuery('e a potência?', history)).toBe(
      'qual a tensão do motor de produção? e a potência?',
    )
  })

  it('mantém a pergunta original quando ela já é autossuficiente', () => {
    expect(buildSearchQuery('qual o procedimento de troca de rolamento?', history)).toBe(
      'qual o procedimento de troca de rolamento?',
    )
  })

  it('não quebra quando não há histórico', () => {
    expect(buildSearchQuery('e esse?', [])).toBe('e esse?')
  })
})

describe('filterRelevantDocs', () => {
  const mk = (rank: number, i: number): DocChunk => ({
    id: `c${i}`, document_id: `d${i}`, document_title: `Doc ${i}`, page_number: i, content: `trecho ${i}`, rank,
  })

  it('mantém apenas resultados próximos do melhor rank (gate relativo)', () => {
    const docs = [mk(0.8, 1), mk(0.75, 2), mk(0.05, 3)]
    const kept = filterRelevantDocs(docs)
    expect(kept.map((d) => d.id)).toEqual(['c1', 'c2'])
  })

  it('descarta tudo quando o melhor rank é zero (sem match real)', () => {
    expect(filterRelevantDocs([mk(0, 1), mk(0, 2)])).toEqual([])
  })

  it('respeita o limite máximo de resultados', () => {
    const docs = [mk(1, 1), mk(0.99, 2), mk(0.98, 3), mk(0.97, 4), mk(0.96, 5)]
    expect(filterRelevantDocs(docs, 2)).toHaveLength(2)
  })

  it('retorna vazio para lista vazia', () => {
    expect(filterRelevantDocs([])).toEqual([])
  })

  it('descarta um empate em rank baixíssimo mesmo quando tecnicamente "relativo" (caso real: pergunta parafraseada sem termo técnico)', () => {
    // Reproduz o achado ao vivo: "esquentando demais" empatou 1 chunk relevante
    // e 2 irrelevantes, todos em ~0.012 só por conterem a palavra "motor".
    const docs = [mk(0.0122, 1), mk(0.0122, 2), mk(0.0122, 3)]
    expect(filterRelevantDocs(docs)).toEqual([])
  })

  it('mantém um match único fraco mas acima do piso absoluto (paráfrase legítima)', () => {
    const docs = [mk(0.0203, 1)]
    expect(filterRelevantDocs(docs)).toHaveLength(1)
  })
})

describe('filterCitedDocs', () => {
  const docs: DocChunk[] = [
    { id: 'c1', document_id: 'd1', document_title: 'Manual Técnico — Siemens SIMOTICS SD', page_number: 61, content: 'x', rank: 0.8 },
    { id: 'c2', document_id: 'd2', document_title: 'Procedimento de Alinhamento a Laser', page_number: 5, content: 'y', rank: 0.6 },
  ]

  it('mantém só os documentos cujo título aparece de fato na resposta', () => {
    const answer = 'A causa provável está descrita no Manual Técnico — Siemens SIMOTICS SD, p. 61.'
    expect(filterCitedDocs(docs, answer).map((d) => d.id)).toEqual(['c1'])
  })

  it('não força citação quando a resposta não menciona nenhum documento', () => {
    const answer = 'A temperatura atual é 83,04°C, acima do limite de 75°C.'
    expect(filterCitedDocs(docs, answer)).toEqual([])
  })

  it('retorna vazio quando não há documentos recuperados', () => {
    expect(filterCitedDocs([], 'qualquer resposta')).toEqual([])
  })
})

describe('buildComparisonContextText', () => {
  it('monta uma seção por ativo com dados completos e separados', () => {
    const items = [
      {
        ctx: { asset: { tag: 'CMP-001', name: 'Compressor de Ar', location: 'Hall C', status: 'critical', uptime: 81, anomaly_score: 23, next_maintenance: null }, sensors: [], active_alerts: [], predictions: [], open_maintenance: [] },
        source: 'question' as const,
      },
      {
        ctx: { asset: { tag: 'MTR-002', name: 'Motor de Reserva', location: 'Hall A', status: 'warning', uptime: 95, anomaly_score: 12, next_maintenance: null }, sensors: [], active_alerts: [], predictions: [], open_maintenance: [] },
        source: 'question' as const,
      },
    ]
    const text = buildComparisonContextText(items)
    expect(text).toContain('Comparação solicitada entre 2 ativos')
    expect(text).toContain('--- CMP-001 — Compressor de Ar ---')
    expect(text).toContain('--- MTR-002 — Motor de Reserva ---')
    // Garante que os dados de um ativo não se misturam com o outro.
    const cmpIdx = text.indexOf('--- CMP-001')
    const mtrIdx = text.indexOf('--- MTR-002')
    const cmpSection = text.slice(cmpIdx, mtrIdx)
    expect(cmpSection).toContain('crítico')
    expect(cmpSection).not.toContain('Motor de Reserva')
  })

  it('ignora entradas sem dados de ativo (RPC falhou para aquele item)', () => {
    const items = [{ ctx: null, source: null }]
    const text = buildComparisonContextText(items)
    expect(text).toContain('Comparação solicitada entre 1 ativos')
    expect(text).not.toContain('---')
  })
})

describe('buildContextBlock', () => {
  it('avisa explicitamente quando não há documentação relevante — evita citação inventada', () => {
    const block = buildContextBlock({ assetSection: 'Ativo em foco: CMP-001.', docs: [] })
    expect(block).toContain('Nenhum trecho relevante foi recuperado')
    expect(block).not.toContain('DOCUMENTAÇÃO TÉCNICA RECUPERADA')
  })

  it('inclui os trechos e a instrução de citar só quando sustentam a resposta', () => {
    const docs: DocChunk[] = [
      { id: 'c1', document_id: 'd1', document_title: 'Manual W22', page_number: 5, content: 'trecho relevante', rank: 0.8 },
    ]
    const block = buildContextBlock({ assetSection: 'Ativo em foco: CMP-001.', docs })
    expect(block).toContain('DOCUMENTAÇÃO TÉCNICA RECUPERADA')
    expect(block).toContain('Manual W22, p. 5')
    expect(block).toContain('cite apenas se o trecho realmente sustentar a resposta')
  })

  it('mantém dados do sistema e documentação em seções distintas', () => {
    const block = buildContextBlock({ assetSection: 'Ativo em foco: CMP-001.', docs: [] })
    const dataIdx = block.indexOf('[DADOS DO SISTEMA')
    const docIdx = block.indexOf('[DOCUMENTAÇÃO TÉCNICA')
    expect(dataIdx).toBeGreaterThanOrEqual(0)
    expect(docIdx).toBeGreaterThan(dataIdx)
  })
})

describe('buildAssetContextText', () => {
  it('rotula a proveniência do ativo em foco', () => {
    const ctx = {
      asset: { tag: 'CMP-001', name: 'Compressor de Ar', location: 'Hall C', status: 'critical', uptime: 81, anomaly_score: 23, next_maintenance: null },
      sensors: [], active_alerts: [], predictions: [], open_maintenance: [],
    }
    expect(buildAssetContextText(ctx, 'history')).toContain('mesmo ativo da pergunta anterior')
    expect(buildAssetContextText(ctx, 'question')).toContain('mencionado nesta pergunta')
    expect(buildAssetContextText(ctx, 'ui')).toContain('selecionado na tela')
  })

  it('declara explicitamente a ausência de alertas e manutenção — evita o modelo inventar', () => {
    const ctx = {
      asset: { tag: 'MTR-001', name: 'Motor de Produção', location: 'Hall A', status: 'normal', uptime: 99, anomaly_score: 2, next_maintenance: null, last_maintenance: null },
      sensors: [], active_alerts: [], predictions: [], open_maintenance: [],
    }
    const text = buildAssetContextText(ctx, 'question')
    expect(text).toContain('Nenhum alerta aberto')
    expect(text).toContain('Nenhuma ordem de manutenção em aberto')
    expect(text).toContain('Não há registro de manutenção já concluída')
  })

  it('inclui a placa de identificação quando confirmada (bug real: get_asset_context não trazia isso, e o modelo negava conhecer o motor)', () => {
    const ctx = {
      asset: { tag: 'MTR-002', name: 'Motor de Reserva', location: 'Hall A', status: 'warning', uptime: 95, anomaly_score: 12, next_maintenance: null, last_maintenance: null },
      sensors: [], active_alerts: [], predictions: [], open_maintenance: [],
    }
    const nameplate = {
      manufacturer: 'Siemens', model: 'SIMOTICS SD', serial_number: 'SIE2023-MTR002', motor_type: 'Trifásico assíncrono de indução',
      year_manufactured: 2022, power_kw: 37, power_hp: 50, voltage: '380/660V', current_a: 68.5, rpm: 1475,
      poles: 4, frequency_hz: 60, connection_type: 'Delta/Star', insulation_class: 'F', ip_rating: 'IP55', efficiency_class: 'IE3',
    }
    const text = buildAssetContextText(ctx, 'question', nameplate)
    expect(text).toContain('Placa de identificação: Siemens SIMOTICS SD')
    expect(text).toContain('37 kW (50 cv)')
    expect(text).toContain('380/660V')
    expect(text).toContain('série SIE2023-MTR002')
  })

  it('declara explicitamente a ausência de placa confirmada — evita o modelo inventar modelo/potência', () => {
    const ctx = {
      asset: { tag: 'MTR-001', name: 'Motor de Produção', location: 'Hall A', status: 'normal', uptime: 99, anomaly_score: 2, next_maintenance: null, last_maintenance: null },
      sensors: [], active_alerts: [], predictions: [], open_maintenance: [],
    }
    expect(buildAssetContextText(ctx, 'question', null)).toContain('Nenhuma placa de identificação confirmada')
  })

  it('reporta a última manutenção concluída quando o banco tem o dado (bug real: era descartado antes)', () => {
    const ctx = {
      asset: { tag: 'MTR-002', name: 'Motor de Reserva', location: 'Hall A', status: 'warning', uptime: 95, anomaly_score: 12, next_maintenance: null, last_maintenance: '2026-06-15' },
      sensors: [], active_alerts: [], predictions: [], open_maintenance: [],
    }
    const text = buildAssetContextText(ctx, 'question')
    expect(text).toMatch(/Última manutenção registrada: \d{2}\/06\/2026/)
    expect(text).not.toContain('Não há registro de manutenção já concluída')
  })
})

describe('buildFleetContextText', () => {
  it('resume o panorama da planta quando nenhum ativo está em foco', () => {
    const text = buildFleetContextText(ASSETS)
    expect(text).toContain('Nenhum ativo específico identificado')
    expect(text).toContain('Estado crítico: CMP-001')
    expect(text).toContain('Em alerta: MTR-002')
  })
})

describe('SYSTEM_PROMPT', () => {
  it('estabelece a hierarquia de fontes e a regra anti-alucinação', () => {
    expect(SYSTEM_PROMPT).toMatch(/Hierarquia de fontes/)
    expect(SYSTEM_PROMPT).toMatch(/Nunca invente/)
    expect(SYSTEM_PROMPT).toMatch(/não encontrei essa informação/i)
  })

  it('separa fato, interpretação e recomendação', () => {
    expect(SYSTEM_PROMPT).toMatch(/Fato:/)
    expect(SYSTEM_PROMPT).toMatch(/Interpretação:/)
    expect(SYSTEM_PROMPT).toMatch(/Recomendação:/)
  })

  it('exige a cadeia dado observado → anomalia → hipótese → falha confirmada', () => {
    expect(SYSTEM_PROMPT).toMatch(/dado observado/i)
    expect(SYSTEM_PROMPT).toMatch(/falha confirmada/i)
    expect(SYSTEM_PROMPT).toMatch(/nunca prova de "defeito confirmado"/i)
  })

  it('estabelece a regra de concisão explícita', () => {
    expect(SYSTEM_PROMPT).toMatch(/Regra de concisão/)
    expect(SYSTEM_PROMPT).toMatch(/não transforme uma pergunta simples em um relatório/i)
  })

  it('instrui a buscar todos os ativos citados em uma comparação, não só o selecionado na UI', () => {
    expect(SYSTEM_PROMPT).toMatch(/nunca compare usando só o ativo selecionado na tela/i)
  })

  it('proíbe citar documentação para sustentar dados que já vêm do sistema', () => {
    expect(SYSTEM_PROMPT).toMatch(/nunca inclua uma citação para sustentar um dado que já veio de \[DADOS DO SISTEMA\]/i)
  })
})
