// =============================================================================
// whatsapp — canal do Órion pela WhatsApp Cloud API (Meta) · módulo puro
//
// Sem `Deno.*`: a configuração entra por parâmetro, então o módulo roda na Edge
// Function e nos testes do vitest do mesmo jeito que `email-template.ts`.
//
// Duas regras da Meta moldam o desenho:
//   1. Fora da janela de 24 h desde a última mensagem do usuário, só template
//      aprovado pode ser enviado. Alerta proativo usa `sendTemplate`; resposta
//      de conversa usa `sendText`.
//   2. Todo POST do webhook vem assinado com HMAC-SHA256 do corpo bruto usando
//      o App Secret (`X-Hub-Signature-256`). Sem validar, qualquer um forja uma
//      mensagem "do técnico" e faz o Órion responder dados da planta.
// =============================================================================

export interface WhatsAppConfig {
  accessToken: string
  phoneNumberId: string
  appSecret: string
  verifyToken: string
  graphVersion?: string
}

export type WhatsAppSendResult =
  | { ok: true; to: string; messageId: string | null }
  | { ok: false; to: string; error: string }

export interface InboundMessage {
  id: string
  from: string
  name: string | null
  timestamp: number
  type: 'text' | 'audio' | 'button' | 'interactive' | 'other'
  text: string | null
  audioId: string | null
}

export const isWhatsAppConfigured = (cfg: Partial<WhatsAppConfig>): cfg is WhatsAppConfig =>
  Boolean(cfg.accessToken && cfg.phoneNumberId && cfg.appSecret && cfg.verifyToken)

/** Janela de atendimento da Meta: resposta livre só até 24 h da última mensagem recebida. */
export const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000

export const insideServiceWindow = (lastInboundAt: string | null | undefined, now = Date.now()) =>
  Boolean(lastInboundAt) && now - new Date(lastInboundAt!).getTime() < SERVICE_WINDOW_MS

/** Número em E.164 só com dígitos, como a Meta entrega em `from` (ex.: 5511987654321). */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  let digits = raw.replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`
  return digits.length >= 12 && digits.length <= 15 ? digits : null
}

const toHex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

/** Comparação em tempo constante — diferença de tempo vazaria a assinatura byte a byte. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function verifySignature(rawBody: string, header: string | null, appSecret: string) {
  if (!header?.startsWith('sha256=')) return false
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(appSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody))
  return safeEqual(toHex(mac), header.slice('sha256='.length))
}

/** Handshake do GET de verificação do webhook. Devolve o challenge ou null. */
export function verifySubscription(url: URL, verifyToken: string): string | null {
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')
  return mode === 'subscribe' && token === verifyToken && challenge ? challenge : null
}

/** Extrai as mensagens de um payload de webhook. Status de entrega são ignorados. */
// deno-lint-ignore no-explicit-any
export function parseInbound(payload: any): InboundMessage[] {
  const out: InboundMessage[] = []
  for (const entry of payload?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value
      const names = new Map<string, string>(
        // deno-lint-ignore no-explicit-any
        (value?.contacts ?? []).map((c: any) => [String(c.wa_id), c?.profile?.name ?? null]),
      )
      for (const m of value?.messages ?? []) {
        const type: InboundMessage['type'] =
          m.type === 'text' || m.type === 'audio' || m.type === 'button' || m.type === 'interactive'
            ? m.type
            : 'other'
        const text =
          m.text?.body ??
          m.button?.text ??
          m.interactive?.button_reply?.title ??
          m.interactive?.list_reply?.title ??
          null
        out.push({
          id: String(m.id),
          from: String(m.from),
          name: names.get(String(m.from)) ?? null,
          timestamp: Number(m.timestamp ?? 0) * 1000,
          type,
          text,
          audioId: m.audio?.id ?? null,
        })
      }
    }
  }
  return out
}

/**
 * Markdown do Órion → formatação do WhatsApp. O app usa `**negrito**`, títulos e
 * tabelas; o WhatsApp entende `*negrito*`, `_itálico_` e nada de tabela.
 */
export function toWhatsAppText(markdown: string, maxLength = 4096): string {
  let text = markdown
    .replace(/\r/g, '')
    .replace(/^#{1,6}\s+(.+)$/gm, '*$1*')
    .replace(/\*\*(.+?)\*\*/g, '*$1*')
    .replace(/__(.+?)__/g, '*$1*')
    .replace(/`{3}[\s\S]*?`{3}/g, (block) => block.replace(/`{3}\w*\n?/g, '```'))
    .replace(/\[(.+?)\]\((.+?)\)/g, '$1 ($2)')
    .replace(/^\s*[-*]\s+/gm, '• ')

  text = text
    .split('\n')
    .filter((line) => !/^\s*\|?\s*:?-{3,}/.test(line))
    .map((line) =>
      /^\s*\|.*\|\s*$/.test(line)
        ? line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()).join(' · ')
        : line,
    )
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
}

async function post(cfg: WhatsAppConfig, to: string, body: Record<string, unknown>): Promise<WhatsAppSendResult> {
  const version = cfg.graphVersion ?? 'v21.0'
  const recipient = to ? { recipient_type: 'individual', to } : {}
  try {
    const resp = await fetch(`https://graph.facebook.com/${version}/${cfg.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', ...recipient, ...body }),
    })
    const data = await resp.json().catch(() => ({}))
    if (!resp.ok) {
      console.error('[whatsapp]', resp.status, JSON.stringify(data).slice(0, 300))
      return { ok: false, to, error: `whatsapp_${resp.status}_${data?.error?.code ?? 'unknown'}` }
    }
    return { ok: true, to, messageId: data?.messages?.[0]?.id ?? null }
  } catch (err) {
    return { ok: false, to, error: (err as Error).message }
  }
}

export const sendText = (cfg: WhatsAppConfig, to: string, text: string) =>
  post(cfg, to, { type: 'text', text: { preview_url: false, body: toWhatsAppText(text) } })

/**
 * Template aprovado no WhatsApp Manager. `params` preenche {{1}}, {{2}}… do
 * corpo, na ordem. Botão de URL dinâmica recebe o sufixo em `buttonUrlSuffix`.
 */
export const sendTemplate = (
  cfg: WhatsAppConfig,
  to: string,
  template: { name: string; language: string; params: string[]; buttonUrlSuffix?: string },
) =>
  post(cfg, to, {
    type: 'template',
    template: {
      name: template.name,
      language: { code: template.language },
      components: [
        { type: 'body', parameters: template.params.map((text) => ({ type: 'text', text: text.slice(0, 1024) })) },
        ...(template.buttonUrlSuffix
          ? [{ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: template.buttonUrlSuffix }] }]
          : []),
      ],
    },
  })

/** Marca como lida e mostra "digitando" enquanto o Órion consulta o modelo. */
export const markAsRead = (cfg: WhatsAppConfig, messageId: string) =>
  post(cfg, '', { status: 'read', message_id: messageId, typing_indicator: { type: 'text' } })

/** Baixa a mídia de um áudio (URL assinada de curta duração, exige o token). */
export async function downloadMedia(cfg: WhatsAppConfig, mediaId: string): Promise<Blob | null> {
  const version = cfg.graphVersion ?? 'v21.0'
  const auth = { Authorization: `Bearer ${cfg.accessToken}` }
  const meta = await fetch(`https://graph.facebook.com/${version}/${mediaId}`, { headers: auth })
  if (!meta.ok) return null
  const { url } = await meta.json()
  const file = await fetch(url, { headers: auth })
  return file.ok ? await file.blob() : null
}
