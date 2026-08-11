# Forzy Digital Twin — Plataforma Industrial de Manutenção Preditiva

Sistema de Gêmeo Digital para monitoramento industrial inteligente com pipeline de Visão Computacional para rastreabilidade de ativos via OCR.

---

## Objetivo

Desenvolver uma plataforma SaaS de **Digital Twin** para indústrias, integrando:
- Monitoramento em tempo real de ativos industriais (motores, bombas, compressores, exaustores)
- Análise preditiva com modelos de ML para detecção de anomalias
- **Pipeline OCR** para extração automática de dados de placas de identificação (nameplate)
- Rastreabilidade completa: imagem → pré-processamento → OCR → cadastro → histórico

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                    FORZY DIGITAL TWIN                        │
│                                                             │
│  Frontend (React 18 + Vite + TypeScript + Tailwind CSS)     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │Dashboard │ │  Planta  │ │  Alertas │ │ Equipamentos │  │
│  │   KPIs   │ │SVG + 3D  │ │Realtime  │ │  OCR Register│  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
│                                                             │
│  State: Zustand | Routing: React Router v7 | Charts: Recharts│
│  Animation: Framer Motion | 3D: three.js / R3F              │
│                                                             │
│  Supabase — banco, autenticação, storage e realtime         │
│  └── Postgres com Row Level Security · sem backend próprio  │
│                                                             │
│  Modelo de OCR (Python + FastAPI) — porta 8000             │
│  └── POST /ocr/extract: realce → EasyOCR → extração de      │
│      campos → validação física → fallback Gemini Vision     │
│                                                             │
│  Modelo de Anomalia (Python + FastAPI) — porta 8001         │
│  └── POST /anomaly/score: janela de leituras → health index │
└─────────────────────────────────────────────────────────────┘
```

Não existe backend de aplicação próprio: o frontend fala direto com o Supabase
(dados, login, arquivos) e com os dois serviços de modelo via HTTP.

| Serviço | Stack | Porta | Variável no front |
|---------|-------|-------|-------------------|
| Frontend | React/Vite | 5173 | — |
| Banco, auth e storage | Supabase (Postgres) | — | `VITE_SUPABASE_URL` |
| Modelo de OCR | Python/FastAPI | 8000 | `VITE_OCR_API_URL` |
| Modelo de anomalia | Python/FastAPI | 8001 | `VITE_ANOMALY_API_URL` |

Os dois modelos são opcionais para rodar a aplicação: sem eles o front cai num
fallback simulado, marcado como tal na interface. O Supabase, não — é a fonte
dos dados.

> Esquema do banco, RLS, views e RPCs: [`supabase/README.md`](supabase/README.md).
> Integração OCR ↔ frontend: [`ocr/INTEGRATION.md`](ocr/INTEGRATION.md).

---

## Planta Industrial

A planta simula uma unidade industrial com 4 zonas e 5 ativos monitorados:

| TAG | Nome | Tipo | Área | Localização | Fabricante | Modelo | Nº Série |
|-----|------|------|------|-------------|------------|--------|----------|
| MTR-001 | Motor Principal Linha A | Motor | Hall A | Linha de Produção A — Posto 1 | WEG | W22 IE3 | WEG2024-MTR001 |
| MTR-002 | Motor Secundário Linha A | Motor | Hall A | Linha de Produção A — Posto 2 | Siemens | SIMOTICS SD | SIE2023-MTR002 |
| BBA-001 | Bomba de Circulação | Bomba | Hall B | Sistema Hidráulico — Bomba Principal | KSB | Etanorm 32-200 | SN-KSB-20220615 |
| CMP-001 | Compressor de Ar | Compressor | Hall C | Central de Ar Comprimido | Atlas Copco | GA 22+ | SN-AC-20211210 |
| EXA-001 | Exaustor de Cobertura | Exaustor | Cobertura | Área Técnica — Cobertura Norte | WEG | W21 71 IE2 | SN-WEG-20230301 |

---

## Pipeline OCR (Sprint 2 — Visão Computacional)

O modelo de OCR é especializado em placas de identificação de motores **WEG
linha W22 (IP55)** e está exposto como uma **API FastAPI** (`ocr/OCR-Model-main`),
consumida diretamente pelo frontend na tela de **Registro de Equipamento**.

### Integração com o frontend

- Cliente HTTP: `src/services/ocrAPI.ts` → `POST /ocr/extract` (multipart).
- Mapeamento dos campos do OCR (`campos`) para `MotorNameplate`: `mapToNameplate()`.
- Fallback automático para dados simulados quando o backend de OCR está offline
  (a demo nunca quebra — o resultado vem marcado como `Simulado (offline)`).
- Dois modos disponíveis na UI: **EasyOCR** (padrão) e **Gemini Vision** (opcional,
  requer `GEMINI_API_KEY`).

### Fluxo

```
Captura → realce adaptativo (OpenCV) → EasyOCR (bbox + texto) →
extração/fusão de campos → validação física → [fallback Gemini] → Registro
```

### Etapas OpenCV

1. **Grayscale** — Conversão para escala de cinza
2. **Resize** — Normalização para 1200px (Lanczos4)
3. **Deskew** — Correção de rotação via Hough Lines
4. **Denoise** — Non-local Means Denoising
5. **CLAHE** — Equalização adaptativa de contraste
6. **Sharpening** — Unsharp Mask
7. **Binarização** — Threshold Otsu
8. **Morfologia** — Close + Open para remoção de ruído residual
9. **Crop ROI** — Recorte da região de interesse com padding

### Resultados

| Métrica | Sem pré-proc. | Com pipeline | Melhoria |
|---------|--------------|--------------|---------|
| Accuracy Rate | ~55% | ~83% | +28% |
| Character Error Rate | ~35% | ~12% | -23% |
| Confiança OCR | ~72% | ~87% | +15% |

---

## Funcionalidades

### 1. Dashboard
- KPIs em tempo real (disponibilidade, alertas, anomalias)
- Gráficos de distribuição de status da frota
- Score de anomalia por ativo

### 2. Planta / Gêmeo Digital
- Mapa SVG interativo com hotspots por TAG
- Status animado (pulso para crítico/alerta)
- Tooltip com dados principais ao hover
- **Fluxo de inspeção** — setas tracejadas e badges numerados (1–5) indicando sequência recomendada
- Navegação hierárquica: Área → Ativo → Monitoramento Completo
- Grid view alternativo com posicionamento por coordenadas

### 3. Monitoramento de Ativo (`/planta/ativo/:id`)
- Página dedicada com breadcrumb `Planta / Área / TAG`
- Gauges de sensores em tempo real (atualização a cada 2s)
- Histórico de sensores com seletor de período (1h/6h/24h/7d)
- Insight preditivo de IA baseado no score de anomalia
- NameplateCard com dados OCR e confiança
- Histórico de alertas do ativo com ação de resolução

### 4. Alertas
- Sistema de alertas em tempo real com severidade (crítico/alerta/info)
- Filtro por status, severidade e busca por texto/TAG
- Insights ML associados
- Resolução inline

### 5. Equipamentos / Registro OCR
- Wizard em 4 etapas para cadastro via placa, integrado ao **modelo de OCR real** (FastAPI)
- Seletor de motor de OCR: **EasyOCR** ou **Gemini Vision**
- Campos de nameplate preenchidos automaticamente a partir da extração
- Metadados do pipeline: modelo usado, tipo de motor, tempo de processamento
- **Alertas de validação física** (kW×cv, RPM×polos×Hz, carcaça×potência) vindos do backend
- Confiança OCR média por extração

### 6. Assistente IA
- Chat contextual com acesso ao ativo selecionado
- Perguntas rápidas pré-configuradas
- Persistência de mensagens via Zustand

---

## Estrutura de Arquivos

```
src/
├── components/
│   ├── PlantFloorMap.tsx     # SVG mapa interativo da planta
│   ├── AssetDetailPanel.tsx  # Painel lateral com abas (sensores/histórico/placa/alertas)
│   ├── SensorGauge.tsx       # Gauge de sensor com threshold
│   ├── NameplateCard.tsx     # Card de placa com dados OCR
│   ├── AIAssistant.tsx       # Chat de IA contextual
│   └── Cards.tsx             # AssetTile com chip de TAG
├── hooks/
│   ├── useAssetRealtime.ts   # Atualização em tempo real via store
│   └── useAlerts.ts          # Carregamento e resolução de alertas
├── pages/
│   ├── PlantNavigation.tsx   # Mapa/grid da planta
│   ├── AssetMonitorPage.tsx  # Página completa de monitoramento
│   ├── AlertsPage.tsx        # Gestão de alertas
│   └── EquipmentPage.tsx     # Registro via OCR
├── services/
│   ├── api.ts                # Fachada de serviços (Supabase + OCR + anomalia)
│   ├── ocrAPI.ts             # Cliente HTTP do modelo de OCR + mapeamento de campos
│   ├── anomalyAPI.ts         # Cliente HTTP do modelo de anomalia
│   ├── sensorLimits.ts       # Limites por grandeza (carregados do banco)
│   └── assistantEngine.ts    # Respostas do assistente a partir de dados reais
├── lib/supabase.ts           # Client tipado do Supabase
├── store/appStore.ts         # Estado global (Zustand)
├── store/authStore.ts        # Sessão e perfil (Supabase Auth)
├── vite-env.d.ts             # Tipos do Vite (import.meta.env, imports de assets)
├── types/index.ts            # Interfaces TypeScript
└── types/database.ts         # Tipos GERADOS do schema (npm run db:types)

supabase/
├── migrations/                # Schema versionado (0001 → 0012)
├── seed.sql                   # Conjunto de demonstração
└── README.md                  # Referência do banco: RLS, views, RPCs

scripts/
├── db.mjs                     # Aplica migrações e seed
├── create-demo-users.mjs      # Contas de demonstração (Auth Admin API)
├── gen-types.mjs              # Gera os tipos a partir do schema real
└── verify-access.mjs          # Verifica a RLS ponta a ponta, por papel

ocr/
└── OCR-Model-main/            # Modelo de OCR (Python/FastAPI, porta 8000)
    ├── src/api/main.py        # Endpoints /ocr/extract e /health
    ├── data/templates/        # Imagens de placa para teste
    └── requirements.txt
ocr/INTEGRATION.md             # Guia de integração OCR ↔ frontend

anomaly/
└── Anomaly-Model-main/        # Modelo de anomalia (Python/FastAPI, porta 8001)

notebooks/
└── sprint2_ocr_pipeline.ipynb  # Pipeline OCR completo (Sprint 2)

docs/
├── CHALLENGE_CONTEXT.md            # Contexto do challenge (requisitos, briefing)
├── SETUP.md                        # Guia de instalação e configuração
├── QUICKSTART.md                   # Guia rápido para rodar os 3 serviços
├── SPRINT2_VISAO_COMPUTACIONAL.md  # Documentação Sprint 2
├── ocr_evaluation_results.json     # Resultados exportados pelo notebook
├── fluxograma-modelos.html         # Fluxograma interativo do pipeline de ML
└── auth/AUTHENTICATION.md          # Documentação técnica do módulo de autenticação
```

---

## Execução

> **Atalho:** `start-all.bat` (Windows) ou `./start-all.sh` (Linux/macOS) sobem o
> frontend e os modelos de uma vez. Antes, configure o `.env` e provisione o
> banco (passos abaixo). Os modelos só sobem se o venv correspondente existir.

### 1. Configuração (uma vez)

```bash
cp .env.example .env
```

Preencha com os dados do seu projeto Supabase:

| Variável | Onde encontrar | Exposta ao browser |
|---|---|---|
| `VITE_SUPABASE_URL` | Project Settings → API | sim |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Project Settings → API keys | sim |
| `SUPABASE_URL` | idem | não |
| `SUPABASE_SECRET_KEY` | Project Settings → API keys (secret) | não |
| `SUPABASE_DB_URL` | Project Settings → Database → Connection string | não |

Só variáveis com prefixo `VITE_` chegam ao cliente; a chave secreta e a string
de conexão são usadas apenas pelos scripts locais.

### 2. Banco de dados

```bash
npm install
npm run db:setup     # migrações + contas de demo + seed + tipos
```

| Comando | O que faz |
|---|---|
| `npm run db:migrate` | Aplica `supabase/migrations/*.sql` (idempotente) |
| `npm run db:users` | Cria as contas de demonstração |
| `npm run db:seed` | Popula ativos, sensores, 48 h de telemetria, alertas, OMs, modelos e documentos |
| `npm run db:types` | Regenera `src/types/database.ts` do schema real |
| `npm run db:verify` | Confere a RLS ponta a ponta, papel por papel |

Ao alterar o schema: `npm run db:migrate` e depois `npm run db:types`.

### 3. Frontend

```bash
npm run dev          # http://localhost:5173
```

### 4. Modelo de OCR (FastAPI)

```bash
cd ocr/OCR-Model-main
py -3.10 -m venv .venv
.venv\Scripts\activate          # Windows  (Linux/macOS: source .venv/bin/activate)
pip install -r requirements.txt

# Windows: force UTF-8, senão o download do modelo EasyOCR quebra na barra de progresso
set PYTHONUTF8=1                # PowerShell: $env:PYTHONUTF8=1
uvicorn src.api.main:app --port 8000     # http://localhost:8000  (docs em /docs)
```

> O primeiro start baixa os pesos do EasyOCR (alguns minutos). Com o backend de
> OCR no ar, a tela de Equipamentos passa a usar o modelo real; sem ele, usa o
> fallback simulado. Detalhes em [`ocr/INTEGRATION.md`](ocr/INTEGRATION.md).

### Build de produção (frontend)

```bash
npm run build
```

---

## Credenciais de Acesso

Contas de demonstração criadas por `npm run db:users`. Senha `password123` para
todas. O papel define o que cada uma pode fazer — e quem garante isso é a Row
Level Security do Postgres, não a interface.

| E-mail | Papel | Pode |
|---|---|---|
| `admin@industrial.com` | admin | tudo, inclusive papéis e auditoria |
| `engineer@industrial.com` | engineer | ativos, sensores, modelos de ML |
| `technician@industrial.com` | technician | alertas, manutenção, cadastro de equipamento |
| `viewer@industrial.com` | viewer | somente leitura |

---

## Tecnologias

### Frontend
- **React 18** + **Vite** + **TypeScript**
- **Tailwind CSS** para estilização
- **Zustand** para estado global
- **React Router v7** com rotas parametrizadas
- **Recharts** para gráficos de série temporal
- **Framer Motion** para animações
- **Radix UI** para primitivos acessíveis
- **Lucide React** para ícones

### Banco, autenticação e storage
- **Supabase** (Postgres gerenciado)
- **Row Level Security** com quatro papéis, trilha de auditoria e consentimento LGPD
- **Supabase Auth** (sessão persistida e token renovado pelo SDK)
- **Realtime** em ativos, alertas e leituras
- **Storage** para fotos de placa, manuais, plantas baixas e avatares
- **pgvector** preparado para o RAG do assistente

### Modelo de anomalia (Sprint 2)
- **FastAPI** + **Uvicorn** (API `/anomaly/score`)
- Janela de leituras → health index, severidade e resíduo térmico

### Modelo de OCR (Visão Computacional — Sprint 2)
- **FastAPI** + **Uvicorn** (API `/ocr/extract`, `/health`)
- **EasyOCR** (extração de texto)
- **OpenCV** (realce adaptativo, remoção de linhas de grade, correção de perspectiva)
- **Gemini Vision** (fallback opcional via `google-generativeai`)
- **Pillow / NumPy** (manipulação de imagens)

---

## Sprint 2 — Entregáveis de Visão Computacional

Todos os 11 requisitos foram implementados:

| # | Requisito | Status |
|---|-----------|--------|
| 1 | Contexto da planta e documentação de ativos | ✅ |
| 2 | Visão geral visual (PlantFloorMap SVG) | ✅ |
| 3 | Tabela de identificação de ativos | ✅ |
| 4 | Documentação de integração futura (OCR → OPC-UA) | ✅ |
| 5 | Imagens sintéticas de placas | ✅ |
| 6 | Pipeline OpenCV (9 etapas, before/after) | ✅ |
| 7 | Protótipo OCR com EasyOCR | ✅ |
| 8 | Avaliação (accuracy, CER, análise crítica) | ✅ |
| 9 | Fluxograma visual do pipeline | ✅ |
| 10 | Jupyter Notebook completo | ✅ |
| 11 | Limitações e evolução futura | ✅ |

---

## O que é real e o que é fallback

Distinção importante para a apresentação: nem tudo que aparece na tela vem de
um modelo rodando.

| Camada | Estado | Sem o serviço no ar |
|---|---|---|
| Dados, autenticação, storage | **real** (Supabase) | a aplicação não sobe — não há fallback |
| Telemetria histórica | **real** (48 h no Postgres, geradas pelo seed) | — |
| Alertas e transições | **reais** (trigger na ingestão + RLS) | — |
| OCR da placa | **real** (FastAPI, porta 8000) | mock determinístico, marcado na UI |
| Índice de anomalia | **real** (FastAPI, porta 8001) | mock determinístico, marcado na UI |
| Assistente | **sem LLM** — compõe a resposta de dados reais do banco | — |

Pendências conhecidas, com o esquema já preparado:

- **Coletor OPC-UA/MQTT** — a RPC `ingest_readings` recebe leituras em lote e faz
  a conversão 4-20 mA, mas nenhum coletor está rodando: o histórico atual vem do seed.
- **Embeddings do RAG** — `document_chunks.embedding` (pgvector) e
  `match_document_chunks` existem; a recuperação em uso é lexical (tsvector).
- **`npm run lint`** — o projeto tem `.eslintrc.cjs` e o ESLint 9 instalado exige
  `eslint.config.js`. Migração pendente, independente do banco.
- **`npm install`** — use `--legacy-peer-deps`: `@vitejs/plugin-react@4` ainda não
  declara suporte a `vite@8`, que é a versão fixada no projeto.
