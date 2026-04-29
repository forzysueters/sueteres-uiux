# Sprint 1 — Fundamentos do Ativo e da Base de Dados

> **Status:** Implementação completa.
> **Branch:** `sprint/1-fundamentos-ativo`
> **Motor de referência:** WEG W22 3 cv 2P 100L 1F 110-127/220-254 V (`MTR-001`)

Esta sprint estabelece a fundação do Digital Twin: captura inicial dos dados
do ativo, cadastro técnico, organização das primeiras informações e a base
operacional histórica que sustentará as próximas sprints (modelos ML,
agente RAG, governança).

---

## Entregas mapeadas

| Entrega da sprint | O que foi feito | Onde |
|---|---|---|
| **Leitura inicial dos dados brutos do ativo** | Gerador IoT mock que produz raw 4-20 mA com ruído gaussiano, drift, spikes e simulação de sensor offline (raw < 4 mA). Exposição via `POST /api/equipments/:tag/readings` para integração futura com IoT real (OPC-UA / MQTT). | `server/src/services/iot-mock.service.ts`, `server/src/routes/equipment.ts` |
| **Conversão dos dados para unidades compreensíveis** | Serviço de conversão raw → unidades físicas (V, A, °C, RPM, mm/s) por regra de 3 com range calibrado por sensor. Detecção automática de "sensor desconectado" e classificação de status (`normal`/`warning`/`critical`/`offline`). | `server/src/services/sensor.service.ts` |
| **Definição dos campos técnicos do cadastro** | Schema SQL com 50+ campos derivados do datasheet WEG (identificação, elétricos, mecânicos, térmicos, mancal, construtivos, manutenção). Seed completo do MTR-001. UI de visualização agrupada por categoria. | `server/src/db/schema.sql`, `server/src/db/seed.ts`, `src/pages/AssetRegistryPage.tsx` |
| **Base inicial de histórico operacional** | Tabela `sensor_reading` com índice composto (equipment_id, sensor_key, ts) emulando TimescaleDB. Warmup automático com 1h de histórico no boot. Exportação CSV. | `server/src/db/schema.sql`, `src/pages/HistoryPage.tsx` |
| **Definição dos campos da placa para OCR** | Tabela taxonômica `placa_field` com 24 campos (regex hint, exemplo, prioridade OCR, categoria, obrigatório). UI de visualização para alinhamento com Sprint 2/3 (Visão Computacional + LLM multimodal). | `server/src/db/seed.ts` (`seedPlacaFields`), `src/pages/AssetRegistryPage.tsx` aba "Placa" |

---

## Arquitetura — Pipeline da Sprint 1

```
┌──────────────────────┐    raw 4-20 mA   ┌──────────────────────┐
│   IoT Mock Generator │ ───────────────> │  Conversion Service  │
│  (anomalia injection)│                  │   raw → física + status│
└──────────────────────┘                  └──────────┬───────────┘
                                                     │
                                                     ▼
                                           ┌──────────────────────┐
                                           │   sensor_reading     │
                                           │   (SQLite TS table)  │
                                           └──────────┬───────────┘
                                                      │
                       ┌──────────────────────────────┼─────────────────────────┐
                       ▼                              ▼                         ▼
            ┌──────────────────┐         ┌──────────────────────┐    ┌─────────────────┐
            │  GET /latest     │         │  GET /readings       │    │  POST /readings │
            │  (telemetria)    │         │  (histórico)         │    │  (ingestão real)│
            └────────┬─────────┘         └──────────┬───────────┘    └─────────────────┘
                     │                              │
                     ▼                              ▼
            ┌──────────────────┐         ┌──────────────────────┐
            │  TelemetryPage   │         │   HistoryPage        │
            │  (live, 2s poll) │         │   (filtros, CSV)     │
            └──────────────────┘         └──────────────────────┘
```

---

## Como rodar localmente

### 1. Backend (porta 3000 por padrão)

```bash
cd server
npm install
npm run dev
```

No primeiro start, o backend:
1. Cria `server/data/digital-twin.db` (SQLite com WAL mode).
2. Aplica o schema (`schema.sql`).
3. Roda seed: cadastra MTR-001 (W22), define 5 sensores e 24 campos de placa.
4. Faz warmup do histórico (1h de dados simulados).
5. Inicia o gerador IoT mock — uma leitura por sensor a cada 2s.

Variáveis úteis:
- `PORT=3010` — muda a porta
- `IOT_MOCK=off` — desliga o gerador (use leituras via POST)
- `DB_PATH=/caminho/db.sqlite` — sobrescreve local do banco

### 2. Frontend (porta 5173)

```bash
cd ..
npm install
npm run dev
```

Abra `http://localhost:5173`. Após login (credenciais demo no card),
navegue:
- **Telemetria** — leitura ao vivo dos 5 sensores com raw + convertido
- **Cadastro** — campos técnicos do MTR-001 + alvo OCR
- **Histórico** — séries temporais com filtros + CSV

---

## Endpoints REST da Sprint 1

| Método | Rota | Função |
|---|---|---|
| `GET` | `/api/equipments` | Lista todos os equipamentos com status agregado |
| `GET` | `/api/equipments/:tag` | Cadastro técnico completo + sensores |
| `POST` | `/api/equipments` | Cadastra novo equipamento |
| `GET` | `/api/equipments/:tag/sensors` | Calibração e thresholds dos sensores |
| `GET` | `/api/equipments/:tag/latest` | Última leitura por sensor |
| `GET` | `/api/equipments/:tag/readings?sensor_key=&from=&to=&limit=` | Histórico filtrado |
| `POST` | `/api/equipments/:tag/readings` | Ingestão de leitura raw (4-20 mA) |
| `GET` | `/api/equipments/placa/fields` | Definição taxonômica dos campos da placa |

Exemplo de ingestão (integração futura com OPC-UA real):

```bash
curl -X POST http://localhost:3000/api/equipments/MTR-001/readings \
  -H "Content-Type: application/json" \
  -d '{"sensor_key":"voltage","value_raw":15.741}'
# → { "value": 220.13, "unit": "V", "status": "normal" }
```

---

## Disciplinas FIAP atendidas (mapeamento Sprint 1)

| Disciplina | Implementado | Onde |
|---|---|---|
| **AI for RPA** | Automação de coleta + persistência (gerador mock como proxy de futura RPA real) | `iot-mock.service.ts` |
| **Generative IA & Advanced Net** | Pipeline de dados estruturado (raw, convertido, status, ts) — pronto para alimentar ML/DL na Sprint 2/3 | `sensor_reading` schema |
| **NLP** | Descrições técnicas, nomenclaturas e atributos textuais organizados em `placa_field` para futura RAG | `seedPlacaFields` |
| **Front End & Mobile** | Interface inicial de cadastro e visualização básica do ativo + telemetria + histórico | `AssetRegistryPage`, `TelemetryPage`, `HistoryPage` |
| **Visão Computacional** | Estratégia de leitura da placa **definida formalmente** com 24 campos taxonômicos, regex e prioridades | tabela `placa_field` + UI |
| **Governança IA** | Critérios iniciais: cada leitura tem `is_simulated` + status auditável, schema versionado, RBAC já existente | `schema.sql`, `auth.controller.ts` |
| **IoT** | Captura, conversão, persistência e visualização em tempo real | pipeline completo |

---

## Documentos detalhados

- [`CADASTRO_TECNICO.md`](./CADASTRO_TECNICO.md) — todos os campos do schema com fonte, unidade e exemplo.
- [`PLACA_OCR_FIELDS.md`](./PLACA_OCR_FIELDS.md) — campos da placa, regex e prioridade para Sprint 2/3.
- [`CONVERSAO_RAW.md`](./CONVERSAO_RAW.md) — fórmulas de conversão 4-20 mA e thresholds.
- [`DEMO.md`](./DEMO.md) — roteiro de demonstração ao vivo.

---

## O que vem na Sprint 2

- Reaproveitar `placa_field` para construir o pipeline de OCR (PaddleOCR/EasyOCR) + LLM multimodal (Claude Vision / GPT-4V) que preenche o cadastro a partir de uma foto.
- Construir representação visual da planta (SVG navegável) com hotspots no MTR-001.
- Treinar primeiro modelo ML (baseline) consumindo `sensor_reading`.
