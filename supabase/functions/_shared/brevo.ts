// =============================================================================
// brevo — envio de e-mail transacional (módulo compartilhado das Edge Functions)
//
// A chave da API vive em `BREVO_API_KEY`, secret do projeto Supabase, pelo mesmo
// motivo da `GEMINI_API_KEY` e da `ELEVENLABS_API_KEY`: qualquer `VITE_*` é
// embutida no bundle e fica legível para quem abrir o site.
//
// O remetente precisa estar validado no painel do Brevo (Senders & IP). Sem
// isso a API aceita a requisição e o e-mail nunca chega — falha silenciosa que
// custa caro de diagnosticar, então `sendEmail` devolve o erro da API em vez de
// engolir.
//
// Deploy:
//   supabase secrets set BREVO_API_KEY=xkeysib-...
//   supabase secrets set BREVO_SENDER_EMAIL=voce@dominio.com
// =============================================================================

const API_URL = 'https://api.brevo.com/v3/smtp/email'

const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY')
const SENDER_EMAIL = Deno.env.get('BREVO_SENDER_EMAIL')
const SENDER_NAME = Deno.env.get('BREVO_SENDER_NAME') ?? 'Forzy — Gêmeo Digital'

export interface Recipient {
  email: string
  name?: string
}

export interface Attachment {
  /** Nome do arquivo como aparece no cliente de e-mail. */
  name: string
  /** Conteúdo em base64, sem o prefixo `data:`. */
  content: string
}

export interface EmailMessage {
  to: Recipient
  subject: string
  html: string
  attachments?: Attachment[]
}

export type SendResult =
  | { ok: true; to: string; messageId: string | null }
  | { ok: false; to: string; error: string }

export const isConfigured = () => Boolean(BREVO_API_KEY && SENDER_EMAIL)

/**
 * Envia uma mensagem. Nunca lança: o chamador decide o que fazer com a falha —
 * uma OM já gravada no banco não deve ser desfeita porque o e-mail caiu.
 */
export async function sendEmail(msg: EmailMessage): Promise<SendResult> {
  if (!isConfigured()) {
    return { ok: false, to: msg.to.email, error: 'email_not_configured' }
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY!,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { email: SENDER_EMAIL, name: SENDER_NAME },
        to: [{ email: msg.to.email, ...(msg.to.name ? { name: msg.to.name } : {}) }],
        subject: msg.subject,
        htmlContent: msg.html,
        ...(msg.attachments?.length ? { attachment: msg.attachments } : {}),
      }),
    })

    if (!response.ok) {
      const detail = await response.text()
      console.error('[brevo]', response.status, detail.slice(0, 300))
      return { ok: false, to: msg.to.email, error: `brevo_${response.status}` }
    }

    const data = await response.json().catch(() => ({}))
    return { ok: true, to: msg.to.email, messageId: data?.messageId ?? null }
  } catch (err) {
    console.error('[brevo] falha de rede', err)
    return { ok: false, to: msg.to.email, error: (err as Error).message }
  }
}

/** Envia várias mensagens e devolve o resultado de cada uma, sem abortar no meio. */
export const sendAll = (messages: EmailMessage[]): Promise<SendResult[]> =>
  Promise.all(messages.map(sendEmail))
