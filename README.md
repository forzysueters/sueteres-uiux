# Forzy Digital Twin — Plataforma Industrial de Manutenção Preditiva

Sistema de Gêmeo Digital para monitoramento industrial inteligente: planta em 3D,
manutenção preditiva, pipeline de Visão Computacional para rastreabilidade de
ativos via OCR e assistente de IA com tour guiado por voz.

---

## Objetivo

Desenvolver uma plataforma SaaS de **Digital Twin** para indústrias, integrando:
- Monitoramento em tempo real de ativos industriais (motores, bombas, compressores, exaustores)
- **Planta em 3D** navegável, com as máquinas nas posições reais do chão de fábrica
- Análise preditiva com modelos de ML para detecção de anomalias
- **Pipeline OCR** para extração automática de dados de placas de identificação (nameplate)
- **Assistente de IA** que responde sobre a operação e a documentação técnica, e um
  **avatar-guia** que apresenta a plataforma a quem chega
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
│  ├── Postgres com Row Level Security · sem backend próprio  │
│  ├── Edge Functions (Deno): ai-chat (Gemini) · tts (voz)    │
│  └── pg_cron + pg_net: coletor IoT, a cada 30s              │
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
| Conversa do assistente | Edge Function `ai-chat` (Deno + Gemini) | — | — |
| Voz do assistente | Edge Function `tts` (Deno + ElevenLabs) | — | `VITE_TTS_PROVIDER` |
| Modelo de OCR | Python/FastAPI | 8000 | `VITE_OCR_API_URL` |
| Modelo de anomalia | Python/FastAPI | 8001 | `VITE_ANOMALY_API_URL` |

Os dois modelos são opcionais para rodar a aplicação: sem eles o front cai num
fallback simulado, marcado como tal na interface. O Supabase, não — é a fonte
dos dados.

As Edge Functions existem porque há chaves que **não podem** chegar ao navegador:
tudo que é `VITE_*` é embutido no bundle e fica legível para qualquer visitante.
`OPENAI_API_KEY` e `ELEVENLABS_API_KEY` são secrets do projeto Supabase, e o
front só conversa com as funções.

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
- Dois modos disponíveis na UI: **EasyOCR** (padrão) e **fallback de Visão**
  (opcional, parâmetro `mode=gemini` na API do OCR por compatibilidade — hoje
  usa a API de visão da OpenAI, requer `OPENAI_API_KEY`).

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

Três modos de visualização, alternáveis na barra de ferramentas:

- **Planta 3D** (padrão) — cena three.js/R3F com os halls e as máquinas nas
  posições reais; clique isola um hall, duplo clique abre o ativo. Ao lado, a
  **régua de triagem**: a lista ordenada por urgência, que responde "o que está
  ruim agora?" sem depender de enxergar nenhuma máquina. Cai para o mapa 2D
  automaticamente quando não há WebGL.
- **Mapa 2D** — blueprint SVG com hotspots por TAG, pulso para crítico/alerta,
  tooltip ao passar o mouse e o **fluxo de inspeção** (setas tracejadas e badges
  numerados com a sequência recomendada).
- **Grade** — posicionamento por coordenadas; no celular vira lista de uma coluna.

Além disso:

- **Editor de layout** — "Editar planta" libera o arrasto das máquinas na cena
  3D. Cada uma ocupa espaço proporcional ao equipamento, sobreposição é bloqueada,
  e mudar de hall pede confirmação. Salvar grava as posições no banco.
- **Remoção e reativação de ativos** — desativar guarda o histórico
  (`is_active = false`); o painel de inativos permite trazer de volta.
- Navegação hierárquica: Área → Ativo → Monitoramento Completo.

### 3. Monitoramento de Ativo (`/planta/ativo/:id`)
- Página dedicada com breadcrumb `Planta / Área / TAG`
- Gauges de sensores em tempo real (atualização a cada 2s)
- Histórico de sensores com seletor de período (1h/6h/24h/7d)
- Insight preditivo de IA baseado no score de anomalia
- NameplateCard com dados OCR e confiança
- Histórico de alertas do ativo com ação de resolução

### 4. Alertas
- Acessível pelo **sino no canto superior direito**, com contador de alertas abertos
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
- Resposta gerada pelo **Gemini** na Edge Function `ai-chat`, a partir de contexto
  real: telemetria, alertas, predições, manutenção e trechos da documentação (RAG)
- **Citações** de documento e página junto da resposta
- Perguntas rápidas pré-configuradas
- Persistência de mensagens via Zustand
- Sem a Edge Function no ar, cai no motor determinístico local
  (`assistantEngine.ts`), que compõe a resposta só com dados do banco

### 7. Órion — assistente-guia (`src/assistant/`)

Avatar virtual que apresenta a plataforma a quem entra nela pela primeira vez.
Módulo isolado, montado por uma linha no `App.tsx` e desenhado em portal sobre o
`body` — não altera layout, menu ou funcionalidade de nenhuma tela.

- **Avatar** em SVG vetorial, nítido de 32 a 320 px, que herda a cor de destaque
  do tema. Quatro estados: repouso, falando, pensando, ouvindo.
- **Tour de sete etapas** — painel, cadastro por placa, monitoramento, predição,
  documentação e alertas. Cada etapa navega para a rota real e acende o elemento
  que está explicando, com holofote (máscara SVG) e um traço ligando o avatar ao
  alvo. Os alvos são declarados por `data-tour` nas telas.
- **Voz** — narração por TTS com o texto do balão acendendo junto da fala.
- **Controles** — continuar, voltar, pausar narração, ligar/desligar áudio, pular
  e fechar. `Esc` encerra.
- **Pergunta livre** — usa o mesmo motor de IA do Assistente, com o Markdown da
  resposta renderizado de verdade (negrito, ênfase, listas).
- Aparece sozinho no primeiro acesso; depois disso, só se for chamado.

### 8. Interface
- **Dois idiomas** (pt-BR / en-US) em toda a aplicação, trocáveis em Configurações
- **Tema claro e escuro**, com acento laranja (Forzy) ou roxo
- **Responsivo de 320 px para cima** — nenhuma tela exige rolagem horizontal
- Conta e perfil: edição de dados e troca de senha

---

## Estrutura de Arquivos

```
src/
├── assistant/                # Órion — assistente-guia (módulo isolado)
│   ├── AvatarFace.tsx        # O personagem, em SVG animado
│   ├── AssistantProvider.tsx # Único ponto de integração (portal sobre o body)
│   ├── AssistantLauncher.tsx # Estado minimizado
│   ├── AssistantPanel.tsx    # Estado expandido: balão + controles
│   ├── TourSpotlight.tsx     # Holofote e traço de indicação
│   ├── RichText.tsx          # Markdown do modelo → nós React (sem innerHTML)
│   ├── useTourController.ts  # Máquina de estados: fase, etapa, narração, conversa
│   ├── useTargetRect.ts      # Resolve e acompanha o elemento destacado
│   ├── useSpeech.ts          # Ponte React ↔ voz
│   ├── speech.ts             # Motores de voz (Web Speech e ElevenLabs)
│   ├── tour.ts / copy.ts     # Roteiro (estrutura) e textos (pt/en), separados
│   └── types.ts / index.ts   # Contratos e barril de exportação
├── components/
│   ├── PlantFloorMap.tsx     # Mapa 2D da planta (SVG interativo)
│   ├── PlantAlertRail.tsx    # Régua de triagem ao lado da cena 3D
│   ├── PlantLayoutToolbar.tsx# Painel flutuante do modo de edição de layout
│   ├── HallChangeDialog.tsx  # Confirma mudança de hall ao arrastar
│   ├── AssetRemovalDialog.tsx / InactiveAssetsPanel.tsx  # Desativar e reativar
│   ├── EquipmentRegistrationForm.tsx  # Wizard de cadastro por placa (OCR)
│   ├── NameplateCard.tsx / NameplateEditor.tsx  # Placa: leitura e edição
│   ├── SensorGauge.tsx       # Gauge de sensor com threshold
│   ├── HealthGauge.tsx       # Índice de saúde (arco animado)
│   ├── TimeSeriesChart.tsx   # Série temporal (Recharts)
│   ├── AlertItem.tsx         # Item de alerta com insight de ML
│   ├── AIAssistant.tsx       # Chat de IA contextual
│   ├── Cards.tsx             # KPICard e AssetTile
│   ├── Dialog.tsx            # Modal padrão (Radix)
│   ├── SkeletonLoaders.tsx / ErrorBoundary.tsx
│   └── three/                # Cena 3D (three.js / React Three Fiber)
│       ├── PlantScene3D.tsx  # Cena da planta com halls e ativos
│       ├── MotorViewer.tsx / MotorModel.tsx / MachineGeometry.tsx
│       ├── PlantFloor.tsx / AssetMarker.tsx / EditOverlay.tsx
│       └── plantLayout.ts / plantGrid.ts   # Geometria e grade (TS puro, testável)
├── hooks/
│   ├── useAssetRealtime.ts   # Atualização em tempo real via store
│   ├── useAlerts.ts          # Carregamento e resolução de alertas
│   ├── usePlantLayoutEditor.ts  # Estado do editor de layout (arrasto e validação)
│   └── useMediaQuery.ts      # Breakpoint em React, para layouts que mudam de forma
├── pages/
│   ├── Dashboard.tsx         # KPIs e gráficos da operação
│   ├── PlantNavigation.tsx   # Planta em 3D / mapa 2D / grade
│   ├── AssetMonitorPage.tsx  # Página completa de monitoramento do ativo
│   ├── AlertsPage.tsx        # Gestão de alertas
│   ├── EquipmentPage.tsx     # Registro via OCR
│   ├── AssistantPage.tsx     # Assistente IA
│   ├── SettingsPage.tsx      # Tema, acento e idioma
│   ├── AccountPage.tsx       # Perfil e senha
│   └── LoginPage.tsx         # Autenticação
├── services/
│   ├── api.ts                # Fachada de serviços (Supabase + OCR + anomalia + chat)
│   ├── ocrAPI.ts             # Cliente HTTP do modelo de OCR + mapeamento de campos
│   ├── anomalyAPI.ts         # Cliente HTTP do modelo de anomalia
│   ├── sensorLimits.ts       # Limites por grandeza (carregados do banco)
│   └── assistantEngine.ts    # Fallback do assistente, só com dados do banco
├── translations/index.ts     # Textos da interface (pt-BR / en-US)
├── utils/                    # plantStatus, webgl, helpers
├── lib/supabase.ts           # Client tipado do Supabase
├── store/appStore.ts         # Estado global (Zustand)
├── store/authStore.ts        # Sessão e perfil (Supabase Auth)
├── vite-env.d.ts             # Tipos do Vite (import.meta.env, imports de assets)
├── types/index.ts            # Interfaces TypeScript
└── types/database.ts         # Tipos GERADOS do schema (npm run db:types)

supabase/
├── migrations/                # Schema versionado (0001 → 0015)
├── functions/
│   ├── ai-chat/               # Conversa do assistente (Deno + Gemini + RAG)
│   └── tts/                   # Voz do Órion (Deno + ElevenLabs)
├── seed.sql                   # Conjunto de demonstração
└── README.md                  # Referência do banco: RLS, views, RPCs

scripts/
├── db.mjs                     # Aplica migrações e seed
├── create-demo-users.mjs      # Contas de demonstração (Auth Admin API)
├── gen-types.mjs              # Gera os tipos a partir do schema real
├── verify-access.mjs          # Verifica a RLS ponta a ponta, por papel
└── collector.mjs              # Painel do coletor IoT (status, teste, troca de URL)

ocr/
└── OCR-Model-main/            # Modelo de OCR (Python/FastAPI, porta 8000)
    ├── src/api/main.py        # Endpoints /ocr/extract e /health
    ├── data/templates/        # Imagens de placa para teste
    └── requirements.txt
ocr/INTEGRATION.md             # Guia de integração OCR ↔ frontend

anomaly/
└── Anomaly-Model-main/        # Modelo de anomalia (Python/FastAPI, porta 8001)
    └── notebooks/manutencao_preditiva_motores.ipynb

docs/
├── CHALLENGE_CONTEXT.md            # Contexto do challenge (requisitos, briefing)
├── SETUP.md                        # Guia de instalação e configuração
├── QUICKSTART.md                   # Guia rápido para rodar os serviços
├── endpoints_api.md                # Endpoints IoT do Forzy Lab
├── sprint_1.md / sprint_2.md       # Entregáveis por sprint
└── transcricao_desafio_inicial.md  # Briefing original
```

---

## Execução

> **Atalho:** `start-all.bat` (Windows) ou `./start-all.sh` (Linux/macOS) sobem o
> frontend e os modelos de uma vez. Os modelos só sobem se o venv correspondente
> existir; sem eles o front usa o fallback simulado.

### 1. Rodar a aplicação

```bash
npm install
npm run dev          # http://localhost:5173
```

Só isso. O `.env` do repositório já traz a URL e a chave publishable do
Supabase — são valores públicos, os mesmos que vão no bundle do browser de
qualquer deploy. Quem protege os dados é a Row Level Security do Postgres.

### 2. Mexer no banco (opcional)

Necessário apenas para aplicar migrações ou repopular o seed:

```bash
cp .env.example .env.local     # preencha SUPABASE_SECRET_KEY e SUPABASE_DB_URL
npm run db:setup               # migrações + contas de demo + seed + tipos
```

> ⚠️ É um projeto Supabase **compartilhado**. `npm run db:seed` recria os dados
> de demonstração para todo o time: alertas resolvidos voltam e equipamentos
> cadastrados via OCR naquela planta são descartados.

| Comando | O que faz |
|---|---|
| `npm run db:migrate` | Aplica `supabase/migrations/*.sql` (idempotente, reexecutável) |
| `npm run db:users` | Cria as contas de demonstração |
| `npm run db:seed` | Repopula ativos, sensores, 48 h de telemetria, alertas, OMs, modelos e documentos |
| `npm run db:types` | Regenera `src/types/database.ts` do schema real |
| `npm run db:verify` | Confere a RLS ponta a ponta, papel por papel |

Para alterar o schema: crie um arquivo **novo** em `supabase/migrations/`
(nunca edite uma migração já publicada), rode `npm run db:migrate` e
`npm run db:types`, e commite a migração junto dos tipos regenerados.

### 3. Modelo de OCR (FastAPI)

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

### 4. Voz do assistente (opcional)

Sem configurar nada, o Órion fala pela **Web Speech API** do navegador: não custa
nada, funciona offline, e soa robótico. Para a voz de nuvem (ElevenLabs):

```bash
cp .env.example .env.local     # preencha ELEVENLABS_API_KEY
npm run dev                    # o proxy /api/tts sobe junto com o Vite
```

A chave fica **no processo do Node**, nunca no bundle — é por isso que ela não
tem o prefixo `VITE_`. Em desenvolvimento quem atende `/api/tts` é um middleware
do `vite.config.ts`; em produção, a Edge Function:

```bash
supabase secrets set ELEVENLABS_API_KEY=sk_...
supabase functions deploy tts
# e aponte o front para ela:
# VITE_TTS_ENDPOINT=https://<project-ref>.supabase.co/functions/v1/tts
```

Ajustes sem mexer em código: `VITE_TTS_PROVIDER` (`elevenlabs` ou vazio, para a
voz do navegador), `ELEVENLABS_VOICE_ID` e `ELEVENLABS_MODEL_ID`. Se a nuvem
falhar — rede, cota, chave inválida — o assistente cai na voz do navegador
sozinho: o tour nunca fica mudo.

### 5. Qualidade e build

```bash
npm run typecheck    # tsc --noEmit
npm run test         # vitest (watch) · test:run para uma passada única
npm run format       # prettier
npm run build        # tsc -b && vite build
```

Os testes cobrem a geometria da planta (`plantGrid`), os limites de sensor
(`sensorLimits`), a coerência dos dados (`coherence`) e a montagem de contexto do
assistente (`ai-chat/context`).

### 6. Coletor IoT (operação)

A coleta roda dentro do Postgres (pg_cron, ver `0014_iot_collector.sql`) e não
depende de nenhuma máquina ligada. O script é só o painel:

```bash
npm run collector:status              # saúde por endpoint + últimas capturas
npm run collector:test                # força uma coleta agora, fora da janela
npm run collector -- url both <BASE>  # troca a URL quando o túnel muda
```

---

## Acesso e cadastro

O cadastro espontâneo (`/auth/v1/signup`) está aberto no projeto Supabase, mas
uma conta criada assim nasce como **visualizador inativo**: `is_active = false`
faz `can_read()` e `has_role()` recusarem tudo, então ela não enxerga nenhum
dado até um administrador liberar. O papel vem de `app_metadata`, que só a chave
secreta escreve — pedir `{"role":"admin"}` no signup não tem efeito.

Para eliminar o cadastro espontâneo de vez: painel do Supabase →
Authentication → Sign In / Providers → desmarcar *Allow new users to sign up*.

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
- **three.js / React Three Fiber** para a planta e o motor em 3D
- **Web Speech API** / **ElevenLabs** para a voz do assistente
- Interface bilíngue (pt-BR / en-US), tema claro/escuro e layout responsivo

### Banco, autenticação e storage
- **Supabase** (Postgres gerenciado)
- **Row Level Security** com quatro papéis, trilha de auditoria e consentimento LGPD
- **Supabase Auth** (sessão persistida e token renovado pelo SDK)
- **Realtime** em ativos, alertas e leituras
- **Storage** para fotos de placa, manuais, plantas baixas e avatares
- **pgvector** preparado para o RAG do assistente (a busca em uso é lexical)
- **Edge Functions** (Deno) para o que exige chave secreta: `ai-chat` e `tts`
- **pg_cron + pg_net** para o coletor IoT, a cada 30 s

### Assistente conversacional
- **Gemini** via Edge Function `ai-chat`, com contexto real do banco e RAG lexical
- Citação de documento e página na resposta
- Motor determinístico local como fallback, sem LLM

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

| # | Requisito | Onde está |
|---|-----------|-----------|
| 1 | Contexto da planta e documentação de ativos | `docs/CHALLENGE_CONTEXT.md` e a seção *Planta Industrial* acima |
| 2 | Visão geral visual (PlantFloorMap SVG) | `src/components/PlantFloorMap.tsx` |
| 3 | Tabela de identificação de ativos | seção *Planta Industrial* acima |
| 4 | Documentação de integração futura (OCR → OPC-UA) | `ocr/INTEGRATION.md` |
| 5 | Imagens sintéticas de placas | `ocr/OCR-Model-main/data/templates/` |
| 6 | Pipeline OpenCV, 9 etapas | `src/preprocessing/` e a seção *Etapas OpenCV* acima |
| 7 | Protótipo OCR com EasyOCR | `ocr/OCR-Model-main/src/` |
| 8 | Avaliação (accuracy, CER) | `scripts/eval_real_images.py` e a seção *Resultados* acima |

---

## O que é real e o que é fallback

Distinção importante para a apresentação: nem tudo que aparece na tela vem de
um modelo rodando.

| Camada | Estado | Sem o serviço no ar |
|---|---|---|
| Dados, autenticação, storage | **real** (Supabase) | a aplicação não sobe — não há fallback |
| Telemetria do Forzy Lab | **real** (coletor pg_cron, janela seg–qua 12h–14h) | a série para de crescer; o histórico fica |
| Telemetria histórica | **real** (48 h no Postgres, geradas pelo seed) | — |
| Alertas e transições | **reais** (trigger na ingestão + RLS) | — |
| OCR da placa | **real** (FastAPI, porta 8000) | mock determinístico, marcado na UI |
| Índice de anomalia | **real** (FastAPI, porta 8001) | mock determinístico, marcado na UI |
| Conversa do assistente | **real** (Gemini na Edge Function `ai-chat`) | motor local, só com dados do banco |
| Voz do Órion | **real** (ElevenLabs) quando configurada | voz do navegador (Web Speech API) |

Pendências conhecidas, com o esquema já preparado:

- **Embeddings do RAG** — `document_chunks.embedding` (pgvector) e
  `match_document_chunks` existem; a recuperação em uso é lexical
  (`search_document_chunks`, sobre tsvector).
- **OPC-UA/MQTT** — o coletor atual lê os endpoints HTTP do Forzy Lab. A RPC
  `ingest_readings` já recebe lote e faz a conversão 4-20 mA, então plugar um
  gateway industrial é trocar a origem, não o caminho.
- **`npm run lint`** — o projeto tem `.eslintrc.cjs` e o ESLint 9 instalado exige
  `eslint.config.js`. Migração pendente, independente do banco.
