#!/usr/bin/env node
/**
 * Operação do coletor IoT dos endpoints da Forzy.
 *
 * A coleta em si roda sozinha dentro do Postgres (pg_cron, a cada 30s, ver
 * supabase/migrations/0014_iot_collector.sql). Este script é só o painel:
 * conferir se a janela rendeu dado, e trocar a URL quando o túnel mudar.
 *
 *   npm run collector:status              → saúde por endpoint + últimas capturas
 *   npm run collector:test                → força uma coleta agora, fora da janela
 *   npm run collector -- url s1 <URL>     → troca a URL de um endpoint
 *   npm run collector -- url both <BASE>  → troca as duas a partir da base
 *   npm run collector -- reprocess        → reingere tudo que já foi capturado
 */
import pg from 'pg'
import fs from 'node:fs'
import path from 'node:path'

function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    const p = path.resolve(process.cwd(), file)
    if (!fs.existsSync(p)) continue
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = (m[2] ?? '').replace(/^['"]|['"]$/g, '')
    }
  }
}
loadEnv()

if (!process.env.SUPABASE_DB_URL) {
  console.error('Defina SUPABASE_DB_URL no .env.local (veja .env.example).')
  process.exit(1)
}

const client = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
})

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const [command = 'status', ...args] = process.argv.slice(2)

await client.connect()

try {
  switch (command) {
    case 'status': {
      const cfg = (
        await client.query(
          `select is_enabled, force_always, active_isodow, window_start, window_end, timezone,
                  public.iot_collector_window_open() as aberta,
                  (now() at time zone timezone)::timestamp(0) as agora_local
             from public.collector_config`,
        )
      ).rows[0]

      console.log('\n── Janela de coleta ─────────────────────────────────────')
      console.log(`  dias           ${cfg.active_isodow.map((d) => ['', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'][d]).join(', ')}`)
      console.log(`  horário        ${cfg.window_start} às ${cfg.window_end} (${cfg.timezone})`)
      console.log(`  agora          ${cfg.agora_local}`)
      console.log(`  coletando?     ${cfg.aberta ? 'SIM — janela aberta' : 'não — fora da janela'}`)
      if (!cfg.is_enabled) console.log('  ⚠ coletor DESABILITADO (collector_config.is_enabled = false)')
      if (cfg.force_always) console.log('  ⚠ force_always ligado: coleta o tempo todo')

      const job = (
        await client.query(`select schedule, active from cron.job where jobname = 'forzy-iot-collector'`)
      ).rows[0]
      console.log(`  agendamento    ${job ? `${job.schedule} (${job.active ? 'ativo' : 'INATIVO'})` : '⚠ JOB AUSENTE'}`)

      console.log('\n── Endpoints ────────────────────────────────────────────')
      console.table(
        (
          await client.query(
            `select code, capturas, ok, falhas, pendentes, leituras_gravadas,
                    ultimo_sucesso, left(coalesce(ultimo_erro, ''), 30) as ultimo_erro, url
               from public.collector_health order by code`,
          )
        ).rows,
      )

      const últimas = (
        await client.query(
          `select s.code, c.responded_at, c.http_status, c.ingested_rows,
                  left(coalesce(c.raw_body, c.error, ''), 70) as corpo
             from public.sensor_raw_captures c
             join public.collector_sources s on s.id = c.source_id
            order by c.responded_at desc limit 10`,
        )
      ).rows
      console.log('\n── Últimas capturas ─────────────────────────────────────')
      if (últimas.length) console.table(últimas)
      else console.log('  (nenhuma captura ainda — a primeira janela é segunda às 12h)')

      const leituras = (
        await client.query(
          `select s.tag, count(*) as leituras,
                  round(min(r.value)::numeric, 3) as minimo,
                  round(avg(r.value)::numeric, 3) as media,
                  round(max(r.value)::numeric, 3) as maximo,
                  max(r.ts) as ultima
             from public.sensor_readings r
             join public.sensors s on s.id = r.sensor_id
             join public.assets a on a.id = s.asset_id
            where a.tag like 'LAB-%'
            group by s.tag order by s.tag`,
        )
      ).rows
      console.log('\n── Série temporal gravada (ativos reais) ────────────────')
      if (leituras.length) console.table(leituras)
      else console.log('  (vazio)')
      break
    }

    case 'test': {
      console.log('Forçando uma coleta fora da janela…')
      await client.query(`update public.collector_config set force_always = true`)
      try {
        await client.query(`select public.iot_collector_tick()`)
        console.log('Requisições disparadas. Aguardando resposta (10s)…')
        await sleep(10000)
        const r = (await client.query(`select public.iot_collector_tick() as r`)).rows[0].r
        console.log(`\nResultado: ${JSON.stringify(r)}`)
        console.table(
          (
            await client.query(
              `select s.code, c.http_status, c.ingested_rows,
                      left(coalesce(c.raw_body, c.error, ''), 80) as corpo
                 from public.sensor_raw_captures c
                 join public.collector_sources s on s.id = c.source_id
                order by c.id desc limit 2`,
            )
          ).rows,
        )
      } finally {
        await client.query(`update public.collector_config set force_always = false`)
        console.log('Janela devolvida ao normal.')
      }
      break
    }

    case 'url': {
      const [alvo, valor] = args
      if (!alvo || !valor) {
        console.error('Uso: npm run collector -- url <s1|s2|both> <URL ou base>')
        process.exit(1)
      }
      const códigos = alvo === 'both' ? ['s1', 's2'] : [alvo]
      if (alvo === 'both') {
        const base = valor.replace(/\/+$/, '')
        await client.query(
          `update public.collector_sources
              set url = $1 || '/get_' || code
            where code in ('s1','s2')`,
          [base],
        )
      } else {
        await client.query(`update public.collector_sources set url = $1 where code = $2`, [valor, alvo])
      }

      // Cabeçalho conforme o provedor do túnel: o ngrok responde uma página HTML
      // de aviso quando não recebe ngrok-skip-browser-warning. Deixar isso na mão
      // de quem troca a URL às pressas entre duas janelas é pedir para perder uma.
      await client.query(
        `update public.collector_sources
            set headers = case when url ilike '%ngrok%'
                   then '{"accept": "application/json", "ngrok-skip-browser-warning": "true"}'::jsonb
                   else '{"accept": "application/json"}'::jsonb end
          where code = any($1)`,
        [códigos],
      )

      console.table(
        (await client.query(`select code, url, headers from public.collector_sources order by code`)).rows,
      )
      console.log('\nURL atualizada. O próximo tick do cron já usa a nova.')
      break
    }

    case 'reprocess': {
      const r = await client.query(
        `update public.sensor_raw_captures set ingested_at = null, ingested_rows = null
          where http_status = 200`,
      )
      console.log(`${r.rowCount} capturas marcadas para reprocessar.`)
      const n = (await client.query(`select public.iot_collector_ingest(100000) as n`)).rows[0].n
      console.log(`${n} leituras regravadas na série temporal.`)
      break
    }

    default:
      console.error(`Comando desconhecido: ${command}. Use status, test, url ou reprocess.`)
      process.exit(1)
  }
} finally {
  await client.end()
}
