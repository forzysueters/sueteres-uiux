// =============================================================================
// tts — Voz do assistente Órion (Edge Function, Deno)
//
// Proxy para a API de Text-to-Speech da ElevenLabs. Existe por um motivo só:
// a chave da ElevenLabs NÃO PODE chegar ao navegador. Qualquer `VITE_*` é
// embutida no bundle e fica legível para quem abrir o site — e uma chave de TTS
// exposta é cota queimada por terceiros. Aqui ela vive em `ELEVENLABS_API_KEY`,
// um secret do projeto Supabase, do mesmo jeito que a `GEMINI_API_KEY` do
// `ai-chat`.
//
// Usa o endpoint `/with-timestamps`, que devolve o áudio junto com o instante
// de início de CADA caractere. É isso que sincroniza a boca do avatar e a
// iluminação progressiva do texto no balão — bem mais preciso do que os
// eventos de fronteira de palavra da Web Speech API.
//
// Deploy:
//   supabase secrets set ELEVENLABS_API_KEY=sk_...
//   supabase functions deploy tts
// =============================================================================

const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY')
// Voz e modelo ajustáveis sem novo deploy de código.
const VOICE_ID = Deno.env.get('ELEVENLABS_VOICE_ID') ?? 'JBFqnCBsd6RMkjVDRZzb'
const MODEL_ID = Deno.env.get('ELEVENLABS_MODEL_ID') ?? 'eleven_multilingual_v2'

/** Teto por requisição — o roteiro do tour cabe folgado; abuso, não. */
const MAX_CHARS = 1200

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-application-name',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  if (!ELEVENLABS_API_KEY) {
    return json({ error: 'tts_not_configured' }, 503)
  }

  let text: string
  try {
    const body = await req.json()
    text = String(body?.text ?? '').trim()
  } catch {
    return json({ error: 'invalid_body' }, 400)
  }

  if (!text) return json({ error: 'empty_text' }, 400)
  if (text.length > MAX_CHARS) text = text.slice(0, MAX_CHARS)

  const url =
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}` +
    `/with-timestamps?output_format=mp3_44100_128`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text, model_id: MODEL_ID }),
  })

  if (!response.ok) {
    const detail = await response.text()
    console.error('[tts] elevenlabs', response.status, detail.slice(0, 300))
    // O front cai para a voz do navegador — o tour nunca fica mudo.
    return json({ error: 'tts_upstream_error', status: response.status }, 502)
  }

  const data = await response.json()

  return json({
    audio: data.audio_base64,
    mimeType: 'audio/mpeg',
    // Só o que o cliente usa; o resto da resposta não precisa trafegar.
    alignment: data.alignment
      ? {
          characters: data.alignment.characters,
          startTimes: data.alignment.character_start_times_seconds,
        }
      : null,
  })
})
