# Forzy Digital Twin

Plataforma web para monitoramento industrial, manutenção preditiva e cadastro de equipamentos por OCR. O projeto integra uma interface React, dois serviços FastAPI e uma infraestrutura Supabase com autenticação, RLS, telemetria, alertas e Edge Functions.

## Visão geral

```text
Navegador (React/Vite)
  ├─ Supabase: dados, Auth, Storage e Realtime
  ├─ Serviço OCR: leitura de placas WEG W22
  ├─ Serviço de anomalia: índice de saúde e severidade
  └─ Edge Functions: chat, voz, transcrição, usuários e e-mails
```

| Componente | Diretório | Porta |
| --- | --- | ---: |
| Aplicação web | `apps/web` | 5173 |
| OCR | `services/ocr` | 8000 |
| Detecção de anomalias | `services/anomaly` | 8001 |
| Banco e funções | `supabase` | remoto |

Uma descrição dos limites de cada componente está em [ARCHITECTURE.md](ARCHITECTURE.md).

## Funcionalidades

- Dashboard de KPIs, séries temporais e estado da frota.
- Planta industrial 2D/3D com navegação e edição de layout.
- Monitoramento por ativo, sensores e limites operacionais.
- Alertas e ordens de manutenção com controle de acesso.
- Cadastro de equipamentos usando OCR, OpenCV e fallback opcional de visão.
- Índice de saúde calculado pelo serviço de anomalias.
- Assistente Órion com contexto do banco, GPT, voz e transcrição.
- Interface responsiva, bilíngue e com temas claro/escuro.

## Pré-requisitos

- Node.js 22 (versão registrada em `.nvmrc`).
- npm.
- Python 3.10–3.12 para executar os modelos localmente.
- Docker com Compose, opcional.
- Um projeto Supabase para dados reais.

## Início rápido

1. Instale as dependências Node:

   ```bash
   npm ci
   ```

2. Crie a configuração pública do frontend:

   ```bash
   cp apps/web/.env.example apps/web/.env.local
   ```

   No PowerShell:

   ```powershell
   Copy-Item apps/web/.env.example apps/web/.env.local
   ```

3. Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` com as credenciais públicas do ambiente fornecido para a avaliação.

4. Inicie o frontend:

   ```bash
   npm run dev
   ```

A aplicação fica disponível em `http://localhost:5173`. Sem os serviços Python, OCR e anomalia usam respostas simuladas identificadas na interface; operações simuladas não são persistidas.

Para configurar também os ambientes Python:

```bash
npm run python:setup
./start-all.sh       # Linux/macOS
```

No Windows, execute `start-all.bat` depois do bootstrap.

## Docker Compose

O Compose usa `apps/web/.env.local`, criado no passo 2 do início rápido. Preencha esse arquivo sem alterar o contrato versionado em `.env.example`:

```bash
docker compose up --build
```

Os serviços possuem health checks e o frontend aguarda OCR e anomalia ficarem saudáveis.

## Configuração

Somente arquivos de exemplo são versionados:

| Arquivo | Finalidade |
| --- | --- |
| `apps/web/.env.example` | Configuração pública do frontend |
| `services/ocr/.env.example` | Modelo de visão opcional do OCR |
| `services/anomaly/.env.example` | Porta, CORS e parâmetros do detector |
| `supabase/.env.example` | Inventário de secrets das Edge Functions |
| `.env.ops.example` | Operações administrativas locais |

Nunca coloque segredos em variáveis `VITE_*`: elas fazem parte do bundle do navegador. Credenciais de avaliação devem ser entregues por um canal separado e rotacionadas ao final.

## Banco e usuários de demonstração

Os comandos administrativos exigem `.env.local` na raiz:

```bash
cp .env.ops.example .env.local
npm run db:migrate
npm run db:users
npm run db:seed
npm run db:types
npm run db:verify
```

`DEMO_PASSWORD` é obrigatório, deve ter pelo menos 12 caracteres e não possui valor padrão. O seed altera o ambiente compartilhado; não o execute contra produção.

As migrações versionadas vão de `0001` a `0022`. O modelo de dados, RLS, RPCs e coletor estão documentados em [supabase/README.md](supabase/README.md).

## Qualidade

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run check
```

- O frontend possui testes unitários e de componentes com Vitest.
- OCR e anomalia possuem testes com pytest.
- A CI executa lint, testes e build web, os testes das Edge Functions e os testes dos dois serviços Python.
- O Ruff bloqueia inicialmente erros críticos; a adoção integral das regras é incremental.

## OCR

O pipeline principal aplica pré-processamento OpenCV, EasyOCR, extração de campos e validação física. Quando configurado, um modelo de visão pode completar campos críticos ausentes.

```bash
cd services/ocr
python -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate
pip install -r requirements.lock
uvicorn src.api.main:app --port 8000
```

API: `GET /health` e `POST /ocr/extract`. Consulte [docs/OCR_INTEGRATION.md](docs/OCR_INTEGRATION.md).

O script `services/ocr/scripts/eval_real_images.py` permite avaliar um conjunto identificado de imagens. O repositório não declara métricas globais de accuracy/CER sem vincular dataset, amostra e saída reproduzível.

## Detecção de anomalias

O serviço recebe uma janela de leituras, calcula atributos de operação e retorna índice de saúde, severidade, resíduo térmico e insight.

```bash
cd services/anomaly
python -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate
pip install -r requirements.lock
uvicorn src.api.main:app --port 8001
```

API: `GET /health` e `POST /anomaly/score`. O baseline usado na demonstração está versionado em `services/anomaly/models/baseline.joblib`.

## O que é real e o que é fallback

| Camada | Fonte | Quando indisponível |
| --- | --- | --- |
| Dados e autenticação | Supabase | A aplicação não acessa dados |
| OCR | Serviço FastAPI | Resultado simulado e não persistível |
| Anomalia | Serviço FastAPI | Resultado simulado identificado |
| Chat | Edge Function com GPT | Motor determinístico local |
| Voz | Edge Function com ElevenLabs | Web Speech API |
| Transcrição | Edge Function STT | Entrada manual continua disponível |

## Estrutura

```text
apps/web/             React, Vite, testes e assets
services/ocr/         API e pipeline OCR
services/anomaly/     API, baseline e notebook de anomalias
supabase/             Migrações, seed e Edge Functions
scripts/              Administração do banco e coletor
tools/                Validação de ambiente e tarefas Python
docs/                 Contexto, sprints e guias técnicos
.github/workflows/    Integração contínua
```

## Documentação

- [Arquitetura](ARCHITECTURE.md)
- [Quick start](docs/QUICKSTART.md)
- [Setup e deploy](docs/SETUP.md)
- [Integração OCR](docs/OCR_INTEGRATION.md)
- [Contexto do desafio](docs/CHALLENGE_CONTEXT.md)
- [Banco e RLS](supabase/README.md)
- [Dados e modelos](docs/DATA_AND_MODELS.md)
- [Sprint 1](docs/sprint_1.md), [Sprint 2](docs/sprint_2.md) e [Sprint 3](docs/sprint_3.md)

## Limitações conhecidas

- O detector usa um baseline compartilhado e é mais confiável para desvios térmicos claros do que para deriva marginal.
- O RAG está preparado para embeddings, mas a recuperação atual é lexical.
- A origem IoT do laboratório depende de endpoints operacionais fornecidos fora do Git.
- Não há suíte E2E nem threshold de cobertura obrigatório neste momento.

## Licenciamento

Os serviços importados preservam seus respectivos arquivos `LICENSE`. A licença do produto integrado deve ser definida pelos responsáveis antes de distribuição pública; compartilhar para avaliação privada não concede direitos adicionais.
