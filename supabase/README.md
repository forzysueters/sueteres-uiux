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
