// =============================================================================
// stt — Transcrição de voz do assistente Órion (Edge Function, Deno)
//
// Recebe o áudio gravado no navegador (base64) e devolve o texto transcrito,
// delegando à API de áudio da OpenAI (Whisper) — a mesma `OPENAI_API_KEY` já
// usada no `ai-chat`. Nenhuma chave nova, nenhum serviço terceiro novo.
//
// Existe no lugar da Web Speech API nativa do navegador: ela manda o áudio
// direto pros servidores de reconhecimento de voz do Google, por fora da
// nossa aplicação — um caminho que se mostrou instável em máquinas fora do
// ambiente de desenvolvimento (bloqueios de rede específicos a esse serviço,
// cota do plano gratuito, e falhas que terminam em silêncio sem avisar
// nada). Proxeando por um serviço nosso, o resultado passa a depender só da
// conexão com a nossa própria infra — a mesma que já sustenta o chat de
// texto.
//
// O áudio passa só pela memória desta execução: não é salvo em banco nem em
// Storage. Só o texto transcrito segue adiante (e some se a pessoa não
// enviar a pergunta).
//
// Roda com a JWT do usuário autenticado, no mesmo padrão do `ai-chat`.
//
// Deploy:
//   supabase functions deploy stt
// =============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2'

// Ajustável sem deploy de código via o secret `OPENAI_STT_MODEL` no projeto.
const OPENAI_STT_MODEL = Deno.env.get('OPENAI_STT_MODEL') ?? 'whisper-1'
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

// Mesmo mecanismo de allow-list do `ai-chat` — `*` até o secret ser definido.
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '*')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

function corsHeadersFor(origin: string | null) {
  const allowOrigin =
    ALLOWED_ORIGINS.includes('*') ? '*' : origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

/** ~6 MB decodificados — uma pergunta falada de até 45s cabe folgada; acima disso, provavelmente é abuso. */
const MAX_BASE64_LENGTH = 8_000_000

/** Código ISO-639-1 — a Whisper aceita como dica de idioma, melhora a precisão. */
const LANG_CODE: Record<string, string> = {
  pt: 'pt',
  en: 'en',
}

/** Extensão condizente com o `mimeType` gravado no navegador — a OpenAI infere o formato pelo nome do arquivo. */
function extensionFor(mimeType: string): string {
  if (mimeType.includes('ogg')) return 'ogg'
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'm4a'
  if (mimeType.includes('wav')) return 'wav'
  return 'webm'
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

interface RequestBody {
  audio: string
  mimeType?: string
  lang?: string
}

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req.headers.get('Origin'))
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'unauthorized' }, 401)

  if (!OPENAI_API_KEY) {
    return json({ error: 'llm_unavailable', message: 'OPENAI_API_KEY não configurada no projeto Supabase.' }, 503)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) return json({ error: 'unauthorized' }, 401)

  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_body' }, 400)
  }

  const audio = (body.audio ?? '').trim()
  if (!audio) return json({ error: 'empty_audio' }, 400)
  if (audio.length > MAX_BASE64_LENGTH) return json({ error: 'audio_too_large' }, 413)

  const mimeType = body.mimeType || 'audio/webm'
  const langCode = LANG_CODE[body.lang ?? 'pt'] ?? LANG_CODE.pt

  let audioBytes: Uint8Array
  try {
    audioBytes = base64ToBytes(audio)
  } catch {
    return json({ error: 'invalid_audio' }, 400)
  }

  // A API de transcrição da OpenAI é multipart/form-data, não JSON — o
  // arquivo vai como Blob, e o `fetch` monta o boundary sozinho quando o
  // corpo é um FormData (por isso nenhum Content-Type é setado à mão aqui).
  const form = new FormData()
  form.append('file', new Blob([audioBytes], { type: mimeType }), `audio.${extensionFor(mimeType)}`)
  form.append('model', OPENAI_STT_MODEL)
  form.append('language', langCode)
  // `verbose_json` traz `no_speech_prob` por segmento — sem isso, a Whisper
  // "alucina" texto de boilerplate (ex.: "Legendas pela comunidade Amara.org")
  // em áudio silencioso, em vez de devolver string vazia. Verificado ao vivo:
  // um WAV de silêncio puro voltou com essa frase como se fosse fala real.
  form.append('response_format', 'verbose_json')

  // Sem isto, uma API lenta/sobrecarregada prendia a function — e do outro
  // lado, a pessoa via o app "travado" sem nenhum aviso até o timeout da
  // própria plataforma Supabase estourar.
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20_000)

  let transcript: string
  try {
    const openaiResp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      signal: controller.signal,
      body: form,
    })
    if (!openaiResp.ok) {
      const errText = await openaiResp.text()
      console.error('[stt] OpenAI error:', openaiResp.status, errText.slice(0, 300))
      return json({ error: 'transcription_failed' }, 502)
    }
    const openaiJson = await openaiResp.json()
    const segments = (openaiJson.segments ?? []) as Array<{ no_speech_prob?: number }>
    const isSilence =
      segments.length === 0 ||
      segments.every((s) => (s.no_speech_prob ?? 0) > 0.5)
    transcript = isSilence ? '' : (openaiJson.text ?? '')
  } catch (err) {
    const timedOut = (err as Error)?.name === 'AbortError'
    console.error('[stt] erro ao chamar a OpenAI:', timedOut ? 'timeout (20s)' : err)
    return json({ error: timedOut ? 'transcription_timeout' : 'transcription_failed' }, 502)
  } finally {
    clearTimeout(timeout)
  }

  return json({ text: transcript.trim() })
})
