import { defineConfig, loadEnv, type Plugin } from 'vite'
// SWC em vez de Babel: @vitejs/plugin-react@4 ainda não declara suporte a
// vite@8, o que fazia `npm install` abortar com ERESOLVE em clone novo.
import react from '@vitejs/plugin-react-swc'
import path from 'node:path'

/**
 * Proxy de TTS para o servidor de desenvolvimento.
 *
 * Em produção quem atende `/api/tts` é a Edge Function `supabase/functions/tts`.
 * Este plugin dá o mesmo contrato durante o `npm run dev`, para não ser preciso
 * fazer deploy só para ouvir o assistente.
 *
 * O ponto importante: o middleware roda no Node, então `ELEVENLABS_API_KEY`
 * (sem prefixo `VITE_`, lida do `.env.local`) NUNCA entra no bundle do browser.
 * Uma chave de TTS no front seria cota queimada por qualquer visitante.
 */
function ttsDevProxy(env: Record<string, string>): Plugin {
  const apiKey = env.ELEVENLABS_API_KEY
  const voiceId = env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb'
  const modelId = env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2'

  return {
    name: 'forzy:tts-dev-proxy',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/tts', (req, res) => {
        const send = (status: number, body: unknown) => {
          res.statusCode = status
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(body))
        }

        if (req.method !== 'POST') return send(405, { error: 'method_not_allowed' })
        if (!apiKey) return send(503, { error: 'tts_not_configured' })

        let raw = ''
        req.setEncoding('utf8')
        req.on('data', (chunk) => { raw += chunk })
        req.on('end', async () => {
          let text = ''
          try {
            text = String(JSON.parse(raw)?.text ?? '').trim()
          } catch {
            return send(400, { error: 'invalid_body' })
          }
          if (!text) return send(400, { error: 'empty_text' })

          try {
            const upstream = await fetch(
              `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}` +
                '/with-timestamps?output_format=mp3_44100_128',
              {
                method: 'POST',
                headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: text.slice(0, 1200), model_id: modelId }),
              },
            )

            if (!upstream.ok) {
              const detail = await upstream.text()
              console.warn('[tts] elevenlabs', upstream.status, detail.slice(0, 200))
              return send(502, { error: 'tts_upstream_error', status: upstream.status })
            }

            const data = await upstream.json()
            send(200, {
              audio: data.audio_base64,
              mimeType: 'audio/mpeg',
              alignment: data.alignment
                ? {
                    characters: data.alignment.characters,
                    startTimes: data.alignment.character_start_times_seconds,
                  }
                : null,
            })
          } catch (err) {
            console.warn('[tts] falhou:', (err as Error).message)
            send(502, { error: 'tts_unreachable' })
          }
        })
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // Prefixo '' carrega TODAS as variáveis, inclusive as sem `VITE_`. Elas ficam
  // aqui, no processo do Node — nada disso é injetado no cliente.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), ttsDevProxy(env)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      open: true,
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: true,
    },
  } as any
})
