# Banco de dados — referência

Postgres gerenciado pelo Supabase. Todo o schema de aplicação vive em `public`,
versionado em `migrations/` e aplicado por `npm run db:migrate`.

## Migrações

| Arquivo | Conteúdo |
|---|---|
| `0001_extensions_enums.sql` | Extensões (`pgcrypto`, `pg_trgm`, `vector`), 18 tipos enumerados, utilitários (`set_updated_at`, `scale_raw_signal`, `classify_reading`) |
| `0002_governance.sql` | `profiles`, `user_settings`, `audit_logs`, `lgpd_consents`, provisionamento automático a partir de `auth.users`, helpers de RBAC |
| `0003_plant_assets.sql` | `plants`, `areas`, `assets`, `asset_nameplates`, `asset_health_snapshots` |
| `0004_sensors_telemetry.sql` | `sensors`, `sensor_readings` (particionada por mês), conversão 4-20 mA na ingestão, views de leitura corrente e agregação horária |
| `0005_alerts_maintenance.sql` | `alerts`, `maintenance_orders`, geração automática de alerta a partir de leitura fora de faixa |
| `0006_machine_learning.sql` | `ml_models` (com Model Card), `ml_predictions`, `ml_training_runs` |
| `0007_ai_rag.sql` | `documents`, `document_chunks` (pgvector 1536), `chat_conversations`, `chat_messages` |
| `0008_views_rpc.sql` | `v_assets_full`, `v_alerts_full`, `v_kpi_metrics`, séries temporais, transições de alerta, ingestão em lote |
| `0009_rls_policies.sql` | RLS e policies por papel, grants, guarda contra escalada de privilégio |
| `0010_storage_realtime.sql` | Buckets, policies de arquivo, publicação Realtime |
| `0011_document_search.sql` | Busca textual em português nos documentos, contexto consolidado do ativo |
| `0012_main_integration.sql` | Coordenadas da planta, diagnóstico do modelo de anomalia, direção do limite por grandeza |
| `0013_signup_hardening.sql` | Papel passa a vir de `app_metadata`; cadastro espontâneo nasce inativo |
| `0023_supervised_model_scoring.sql` | Classificador supervisionado registrado; `model_scoring_window`/`publish_model_score` para o worker; avaliador SQL vira fallback |
| `0024_orion_channels.sql` | Órion por WhatsApp e avisos de alerta por e-mail/WhatsApp: vínculo do número, sessões, fila `orion_notifications`, dispatcher em `pg_cron` (desligado por padrão) |

## Canais do Órion (e-mail e WhatsApp)

Arquitetura pronta e inerte até os provedores serem configurados.

```
alerts INSERT ─trigger─▶ orion_notifications ─cron 1 min─▶ orion-notify ─▶ Brevo (e-mail)
                                                                        └▶ WhatsApp Cloud API
WhatsApp (Meta) ─webhook─▶ whatsapp-webhook ─▶ _shared/orion.ts ─▶ mesma resposta do chat da tela
```

| Peça | Onde |
|---|---|
| Núcleo de resposta compartilhado (tela e WhatsApp) | `functions/_shared/orion.ts` |
| Cliente WhatsApp Cloud API: assinatura HMAC, parse do webhook, texto/template, markdown → WhatsApp | `functions/_shared/whatsapp.ts` |
| Webhook de entrada (identidade pelo número vinculado, idempotência, comandos `ajuda`/`parar`) | `functions/whatsapp-webhook` |
| Dispatcher de avisos (e-mail com `alertEmail`, WhatsApp com texto na janela de 24 h ou template fora dela) | `functions/orion-notify` |

E-mails transacionais que já estavam em produção: `send-maintenance-email` (confirmação de OM) e
`send-asset-report` (relatório do ativo com PDF), ambos via `_shared/brevo.ts`.

Para ligar:

1. Secrets: `ORION_NOTIFY_SECRET`, `APP_URL`, `BREVO_*` e `WHATSAPP_*` (ver `supabase/.env.example`).
2. `supabase functions deploy orion-notify --no-verify-jwt` e `supabase functions deploy whatsapp-webhook --no-verify-jwt`.
3. No painel da Meta, callback `https://<ref>.supabase.co/functions/v1/whatsapp-webhook` com o `WHATSAPP_VERIFY_TOKEN`, assinando `messages`; aprovar o template `forzy_alerta_ativo` (Utility, 4 variáveis, botão de URL).
4. `update public.orion_notify_config set enabled = true, function_url = '…/orion-notify', secret = '<ORION_NOTIFY_SECRET>';`
5. Vincular o número do usuário: `profiles.whatsapp_phone` (E.164 só dígitos), `whatsapp_opt_in = true` e `user_settings.notify_whatsapp = true`.

## Modelo de dados

### Governança
- **`profiles`** — 1:1 com `auth.users`, criado por trigger. Guarda o papel (RBAC).
- **`user_settings`** — preferências de interface, uma linha por usuário.
- **`audit_logs`** — trilha automática (insert/update/delete) das tabelas sensíveis.
- **`lgpd_consents`** — consentimento por finalidade, com versão de política e revogação.

### Planta e ativos
- **`plants`** → **`areas`** → **`assets`**. O ativo tem TAG industrial única por planta (`MTR-001`) e posição `grid_x`/`grid_y` na planta baixa navegável.
- **`asset_nameplates`** — dados da placa (Módulo 2 / OCR), com rastreabilidade da extração (`ocr_provider`, `ocr_confidence`, `ocr_raw`) e a imagem original.
- **`asset_health_snapshots`** — histórico de disponibilidade e anomalia, alimentado por trigger.

### Telemetria
- **`sensors`** — canal de medição com faixa de engenharia, limites de alerta/crítico, faixa do sinal bruto (4-20 mA), nó OPC-UA e tópico MQTT.
- **`sensor_readings`** — série temporal **particionada por mês** (2025→2027 + partição default), com índice BRIN em `ts`.
  Na inserção, um trigger converte o sinal bruto para unidade de engenharia, classifica a qualidade (`good`/`uncertain`/`bad`/`disconnected` — 0 mA significa sensor desconectado) e o status contra os limites.
  O histórico é **imutável**: usuários autenticados não podem alterar nem apagar leituras.

### Alertas e manutenção
- **`alerts`** — severidade, ciclo `active → acknowledged → resolved`, origem (`rule`/`ml`/`manual`/`system`) e coluna gerada `resolved`. Triggers carimbam autor e horário nas transições.
- Leitura em estado crítico ou de alerta gera alerta automaticamente, com janela de supressão de 30 minutos por sensor/severidade.
- **`maintenance_orders`** — OM com número gerado, checklist em JSON e sincronização das datas de manutenção do ativo ao concluir.

### Machine Learning
Três modelos encadeados via `parent_model_id`: baseline → anomalia → predição.
`ml_models` carrega o **Model Card** exigido pela governança de IA (propósito,
dados de treino, limitações, vieses, uso pretendido, fora de escopo).
`ml_predictions` guarda valor, confiança, RUL, ação recomendada e importância de
features (SHAP/LIME).

### Assistente e RAG
`documents` + `document_chunks`. Duas rotas de recuperação:

- **Lexical (ativa)** — `search_document_chunks(p_query, p_asset_id, p_limit)`, tsvector em português com índice GIN. Usa OR com prefixo e ordena por `ts_rank`.
- **Vetorial (pronta, inativa)** — `match_document_chunks(query_embedding, …)` sobre `embedding vector(1536)` com índice HNSW por cosseno. Depende de um provedor de embeddings.

## Views

| View | Uso |
|---|---|
| `v_assets_full` | Ativo + sensores com leitura corrente aninhados em JSON, em um round-trip |
| `v_alerts_full` | Alerta já com nome do ativo e do sensor |
| `v_kpi_metrics` | Indicadores do painel |
| `v_sensor_current` | Última leitura de cada sensor |
| `v_sensor_readings_hourly` | Agregação horária para períodos longos |
| `v_asset_latest_prediction` | Predição mais recente por ativo e tipo |

Todas declaram `security_invoker = on` — a RLS do usuário se aplica através da view.

## Funções (RPC)

| Função | Uso |
|---|---|
| `get_asset_series(asset, horas, bucket)` | Séries de todos os sensores do ativo |
| `get_sensor_series(sensor, de, até, bucket)` | Série de um sensor |
| `get_asset_context(asset)` | Estado operacional consolidado em JSON (usado pelo assistente) |
| `search_document_chunks(query, asset, limite)` | Recuperação textual na documentação |
| `resolve_alert(alerta, notas)` / `acknowledge_alert(alerta)` | Transições de alerta |
| `ingest_readings(jsonb)` | Ingestão em lote pelo consumidor OPC-UA/MQTT |
| `recompute_asset_health(asset?)` | Recalcula disponibilidade, anomalia e status a partir das últimas 24 h |
| `log_audit_event(ação, tipo, id, metadata)` | Auditoria disparada pela aplicação |

### Formato da ingestão

```sql
select public.ingest_readings('[
  {"sensor_tag": "MTR-001.TEMP", "ts": "2026-08-11T12:00:00Z", "raw_value": 12.5},
  {"sensor_tag": "MTR-001.VIB",  "ts": "2026-08-11T12:00:00Z", "value": 2.7}
]'::jsonb);
```

`raw_value` é o sinal em mA — a conversão para unidade de engenharia acontece no
banco, usando `raw_min`/`raw_max` e a faixa do sensor. A função garante que a
partição do mês corrente exista antes de inserir.

## Modelo de acesso

RLS habilitada em todas as tabelas de aplicação. `anon` não tem acesso a nada.

| | admin | engineer | technician | viewer |
|---|---|---|---|---|
| Ler acervo operacional | ✓ | ✓ | ✓ | ✓ |
| Alertas e manutenção (escrita) | ✓ | ✓ | ✓ | — |
| Cadastro de equipamento | ✓ | ✓ | ✓ | — |
| Ativos, sensores, modelos de ML | ✓ | ✓ | — | — |
| Plantas e áreas | ✓ | — | — | — |
| Papéis de usuário | ✓ | — | — | — |
| Trilha de auditoria completa | ✓ | — | — | — |

Conversas do assistente e preferências de interface são estritamente pessoais —
nenhum papel, inclusive admin, lê as do outro.

As policies chamam `public.has_role(...)`, `public.can_write()` e
`public.can_read()`, todas `SECURITY DEFINER` para não recursar nas policies de
`profiles`. A RLS **não** usa `FORCE`, de propósito: os triggers `SECURITY
DEFINER` (auditoria, alerta automático) rodam como dono da tabela e precisam
passar por cima dela.

### Cadastro de conta

`handle_new_user` lê o papel de **`raw_app_meta_data`**, que só a Auth Admin API
(chave secreta) consegue escrever. `raw_user_meta_data` é preenchido pelo próprio
cliente no signup, então não serve para conceder privilégio — pedir
`{"role":"admin"}` no cadastro não tem efeito.

Conta criada por cadastro espontâneo nasce **viewer e inativa**: `can_read()` e
`has_role()` exigem `is_active`, então ela não lê nada até um administrador
liberar. Contas provisionadas por `npm run db:users` vêm ativas.

### Guarda de privilégio

Um trigger em `profiles` recusa alteração de `role`, `is_active` ou `plant_id`
por quem não é administrador — a proteção está no dado, não só na policy.
Quando não há sessão autenticada (`auth.uid() is null` — service role,
migrações, jobs), a guarda é dispensada, pois o acesso já é privilegiado.

## Storage

| Bucket | Público | Limite | Escrita |
|---|---|---|---|
| `equipment-images` | sim | 10 MB | admin, engineer, technician |
| `avatars` | sim | 2 MB | cada usuário na própria pasta `<uid>/` |
| `floor-plans` | sim | 20 MB | admin, engineer |
| `documents` | **não** | 50 MB | admin, engineer, technician |

## Realtime

`assets`, `alerts`, `sensor_readings` e `maintenance_orders` estão na publicação
`supabase_realtime`, com `REPLICA IDENTITY FULL` nas três primeiras para entregar
o registro anterior nos eventos de update.

## Dados de demonstração

`seed.sql` é re-executável: apaga e recria os dados transacionais da planta
`FORZY-LAB`. Cria 1 planta, 3 áreas, 5 ativos, 23 sensores, ~13 mil leituras
cobrindo 48 h a cada 5 minutos, 5 alertas, 5 ordens de manutenção, 3 modelos de
ML com predições, 7 documentos e 10 trechos indexados.

A telemetria é gerada com ciclo de carga diário, ruído de medição e uma curva de
degradação progressiva nos ativos com problema — por isso o compressor `CMP-001`
cruza o limite de vibração da ISO 10816 e sustenta o alerta crítico e a predição
de RUL de 7 dias. Disponibilidade, índice de anomalia e status **não** são
escritos à mão: saem de `recompute_asset_health()` sobre as leituras geradas.

## Coletor IoT — endpoints reais da Forzy

A Forzy expõe dois endpoints HTTP com leitura de acelerômetro do motor do lab.
Eles **só respondem às segundas, terças e quartas, das 12h às 14h** — fora disso
o túnel fica fora do ar. Perder uma janela custa uma semana.

Por isso a coleta roda **dentro do próprio Postgres** (`pg_cron` + `pg_net`,
migração `0014`): não depende de nenhuma máquina ligada.

```
cron 30s → iot_collector_tick()
             ├─ iot_collector_drain()     respostas do pg_net → sensor_raw_captures
             ├─ iot_collector_ingest()    captura → ingest_readings() → série temporal
             └─ iot_collector_dispatch()  dispara o próximo GET (se a janela estiver aberta)
```

O job roda o ano inteiro de 30 em 30 segundos e a **função** decide se a janela
está aberta, lendo `collector_config`. Guardar a janela no banco e não no cron
evita o erro clássico de agendar 12h–14h num servidor que roda em UTC — que é o
caso do Supabase.

### Tabelas

| Tabela | Papel |
|---|---|
| `collector_config` | Linha única: dias, horário, fuso. `force_always` coleta fora da janela (testes) |
| `collector_sources` | Os endpoints. **A URL vive aqui**, nunca no código |
| `collector_field_map` | `"Velocidade"` do `get_s1` é o sensor `LAB-S1.VIB`. Mapeamento é dado, não código |
| `collector_requests` | Correlaciona o id assíncrono do `pg_net` com a origem |
| `sensor_raw_captures` | Zona de pouso: o corpo como veio, **inclusive as falhas** |

`sensor_raw_captures` é o que torna a coleta irreversível: se o mapeamento
estiver errado, zerar `ingested_at` reprocessa tudo. E registrar as falhas
("12:34 → HTTP 530") é a trilha de rastreabilidade do Módulo 6.

### Ativos

`LAB-S1` e `LAB-S2` representam os dois pontos de medição reais, com três
sensores cada (`.VIB` mm/s, `.ACC` m/s², `.TEMP` °C). Ficam no Hall A porque o
mapa 2D desenha quatro halls fixos — a separação entre real e sintético é
carregada por `metadata.is_real_telemetry`, não pela geografia.

Os limites de vibração seguem a ISO 10816-3 (iguais aos do seed). **Os de
aceleração são provisórios** (`metadata.provisional = true`): só dá para
calibrá-los com dado real na mão.

### Operação

```bash
npm run collector:status          # janela, saúde por endpoint, últimas capturas
npm run collector:test            # força uma coleta agora, fora da janela
npm run collector -- url both https://novo-tunel.trycloudflare.com
npm run collector -- reprocess    # reingere tudo que já foi capturado
```

> ⚠️ **A URL é um quick tunnel do `trycloudflare`: o subdomínio é sorteado a cada
> reinício do `cloudflared`.** Se a Forzy reiniciar o túnel, o coletor grava
> HTTP 530 a janela inteira. Confira `npm run collector:status` no início de cada
> janela e troque a URL com `collector -- url both <base>`. O ideal é pedir à
> Forzy um túnel nomeado, com URL fixa.
