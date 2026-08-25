# Endpoints IoT da Forzy

Dois pontos de medição (acelerômetro): velocidade de vibração, aceleração e
temperatura. Cada um responde um JSON embrulhado numa chave própria.

> A URL de produção não vive neste arquivo — vive em `public.collector_sources`.
> Este documento registra o túnel vigente; a fonte da verdade é o banco.

## Endpoint 1 — `get_s1`

```
https://charred-buzz-tannery.ngrok-free.dev/get_s1
```

```powershell
curl.exe --ssl-no-revoke -X GET "https://charred-buzz-tannery.ngrok-free.dev/get_s1" -H "accept: application/json"
```

Saída esperada: `{"dados1":{"Velocidade":0.04,"Aceleração":0.0,"Temperatura":34}}`

## Endpoint 2 — `get_s2`

```
https://charred-buzz-tannery.ngrok-free.dev/get_s2
```

```powershell
curl.exe --ssl-no-revoke -X GET "https://charred-buzz-tannery.ngrok-free.dev/get_s2" -H "accept: application/json"
```

Saída esperada: `{"dados2":{"Velocidade":0.04,"Aceleração":0.0,"Temperatura":35}}`

## Janela de atualização

Os dados são atualizados às **segundas, terças e quartas, das 12h às 14h**
(America/Sao_Paulo). Fora disso o endpoint pode continuar respondendo, mas com o
último valor lido — por isso o coletor só grava dentro da janela
(`public.collector_config`, com 1h de margem de cada lado).

## Túnel

O host atual é um túnel **ngrok** (`*.ngrok-free.dev`); antes era um quick tunnel
do `trycloudflare`. Em ambos os casos o subdomínio muda quando a Forzy reinicia o
agente. Quando mudar de novo:

```bash
npm run collector -- url both https://novo-subdominio.ngrok-free.dev
```

Atenção ao ngrok: com User-Agent de navegador ele devolve uma página HTML de
aviso em vez do JSON. O coletor manda `ngrok-skip-browser-warning: true`
(`collector_sources.headers`) para não depender disso.

## Como o dado entra no sistema

`pg_cron` (30s) → `iot_collector_tick()` → `sensor_raw_captures` (corpo cru) →
`collector_field_map` → `sensor_readings`. Ver
`supabase/migrations/0014_iot_collector.sql` e `0015_collector_ngrok.sql`.
Operação: `npm run collector:status`.
