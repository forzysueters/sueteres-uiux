# Forzy Digital Twin Platform
### FIAP Challenge × Forzy / Promon — Industrial IoT + AI

Plataforma de **Digital Twin** para monitoramento preditivo de motores elétricos industriais.
Integra IoT, Visão Computacional, PLN/RAG e Machine Learning em uma interface React industrial.

---

## Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura do Sistema](#arquitetura-do-sistema)
3. [Sprint 1 — Frontend e Auth](#sprint-1--frontend-e-auth)
4. [Sprint 2 — PLN: Busca Semântica e Embeddings](#sprint-2--pln-busca-semântica-e-embeddings)
5. [Stack Tecnológica](#stack-tecnológica)
6. [Instalação e Execução](#instalação-e-execução)
7. [Estrutura do Projeto](#estrutura-do-projeto)
8. [Credenciais Demo](#credenciais-demo)

---

## Visão Geral

A plataforma resolve os problemas reais identificados pela Forzy:

| Problema | Solução implementada |
|---|---|
| Dados operacionais não estruturados | Sprint 1: tipos TypeScript + mock API com 5 ativos e 4–5 sensores cada |
| Cadastro manual da placa | Sprint 1: `EquipmentRegistrationForm` com OCR simulado |
| Falta de visualização navegável | Sprint 1: `PlantNavigation` — grid interativo de ativos |
| Sem inteligência preditiva | Sprint 1: anomalyScore + alertas com mlInsight |
| Conhecimento técnico não integrado | Sprint 2: embeddings FAISS + busca semântica em linguagem natural |

---

## Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND (React + TypeScript)                │
│  Dashboard │ PlantNavigation │ Alerts │ Equipment │ AI Assistant  │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP / JWT
┌────────────────────────▼────────────────────────────────────────┐
│                    BACKEND (Express / Node.js)                   │
│  /auth (login, refresh, logout)   │   /api/profile               │
└────────────────────────┬────────────────────────────────────────┘
                         │ (Sprint 3+)
┌────────────────────────▼────────────────────────────────────────┐
│            NLP SERVICE (Sprint 2 — Python / Jupyter)             │
│                                                                   │
│  Texto dos ativos → paraphrase-multilingual-MiniLM-L12-v2        │
│  → Embeddings (384 dims) → FAISS IndexFlatIP → Busca semântica   │
│                                                                   │
│  Artefatos: faiss_assets.index │ assets_metadata.json            │
└─────────────────────────────────────────────────────────────────┘
```

### Fluxo Semântico (Sprint 2 PLN)

```
Operador digita query em linguagem natural
          │
          ▼
  Expansão de sinônimos industriais
  "equipamento" → "motor", "ativo", "máquina"
          │
          ▼
  Embedding via paraphrase-multilingual-MiniLM-L12-v2
  query → vetor float32[384] normalizado L2
          │
          ▼
  Busca no índice FAISS (IndexFlatIP)
  score = produto interno (= coseno após norm L2)
          │
          ▼
  Top-K ativos ordenados por relevância
  com tag, localização, status, score
```

---

## Sprint 1 — Frontend e Auth

### Páginas implementadas

| Página | Rota / Tab | Descrição |
|---|---|---|
| `Dashboard` | `/` | KPIs, gráficos Recharts, tendência de uptime |
| `PlantNavigation` | plant | Grid interativo da fábrica — click → painel lateral |
| `AlertsPage` | alerts | Lista de alertas com filtro por severidade |
| `EquipmentPage` | equipment | Cadastro de equipamentos com OCR simulado |
| `AssistantPage` | assistant | Chat com IA Forzy (respostas contextuais) |
| `SettingsPage` | settings | Tema, cor de destaque, idioma (pt/en) |
| `AccountPage` | account | Perfil do usuário autenticado |
| `LoginPage` | /login | Autenticação JWT com 3 roles |

### Tipos de domínio (`src/types/index.ts`)

```typescript
Asset           // id, name, type, location, status, uptime, sensors[], anomalyScore, x, y
Sensor          // id, name, unit, value, min, max, threshold, status
Alert           // id, assetId, severity, title, description, mlInsight, resolved
EquipmentRegistration  // serialNumber, manufacturer, model, yearManufactured, powerRating
ChatMessage     // role, content, timestamp, assetContext
KPIMetrics      // totalUptime, activeAlerts, anomaliesDetected, assetsOnline
```

### Backend (`server/`)

- `POST /auth/login` — retorna `accessToken` + `refreshToken`
- `POST /auth/refresh` — renova access token
- `POST /auth/logout` — invalida refresh token
- `GET /api/profile` — rota protegida por JWT
- 3 roles: `admin`, `engineer`, `technician`

---

## Sprint 2 — PLN: Busca Semântica e Embeddings

### Arquivos entregues

| Arquivo | Descrição |
|---|---|
| [`notebooks/sprint2_pln_consulta.ipynb`](notebooks/sprint2_pln_consulta.ipynb) | Notebook principal: pipeline completo de NLP |
| [`notebooks/sprint2_pln_templates.md`](notebooks/sprint2_pln_templates.md) | Templates de linguagem natural + regras de composição |
| `notebooks/faiss_assets.index` | Índice FAISS serializado (gerado ao executar o notebook) |
| `notebooks/assets_metadata.json` | Metadados dos ativos indexados |
| `notebooks/sprint2_pln_avaliacao.png` | Gráficos de Precision@K e Recall@K |
| `notebooks/sprint2_pln_similaridade.png` | Matriz de similaridade coseno entre ativos |

### Modelo de Embedding

**`paraphrase-multilingual-MiniLM-L12-v2`** (SentenceTransformers / HuggingFace)

| Critério | Valor |
|---|---|
| Dimensão de saída | 384 |
| Idiomas | 50+ (pt-BR, en nativo) |
| Arquitetura | MiniLM-L12 (12 camadas transformer) |
| Pooling | mean pooling + normalização L2 |
| Tamanho | ~118 MB |
| Compatibilidade | FAISS, ONNX, ChromaDB |

**Por que este modelo?** Único modelo SentenceTransformers treinado nativamente em pt-BR com
cobertura industrial suficiente e footprint computacional adequado para prototipagem offline.
Alternativa `text-embedding-3-small` (OpenAI) é superior mas requer API key e custo por token.

### Índice FAISS

| Parâmetro | Valor |
|---|---|
| Tipo | `IndexFlatIP` (Inner Product) |
| Estratégia de busca | Exata (sem aproximação) — adequada para N=5 ativos |
| Métrica efetiva | Similaridade coseno (vetores normalizados L2) |
| N vetores | 5 (um por ativo) |
| Persistência | `faiss.write_index()` / `faiss.read_index()` |

### TAGs Padronizadas

| asset.id | TAG gerada | Tipo |
|---|---|---|
| `motor-001` | `MTR-001` | Motor |
| `motor-002` | `MTR-002` | Motor |
| `pump-001` | `BOM-001` | Bomba |
| `compressor-001` | `CMP-001` | Compressor |
| `fan-001` | `VEN-001` | Ventilador |

### Templates de Linguagem Natural

Cinco templates geram texto rico a partir dos dados estruturados:

```python
template_base(asset)      # identidade: TAG + nome + localização + fabricante + modelo
template_status(asset)    # estado operacional em linguagem natural (normal/alerta/crítico)
template_sensores(asset)  # leituras de sensores narradas com status
template_tipo_extra(asset)# termos adicionais para recall semântico
template_completo(asset)  # concatenação dos quatro acima → texto para embedding
```

**Exemplo gerado (MTR-002 em alerta):**
```
Motor MTR-002 (Backup Motor), localizado em Hall A - Estação 2,
fabricante ABB, modelo IE3-132M. Tensão 380V, potência 52kW, 4 polos.
MTR-002 em estado de alerta. Temperature 72°C (limite: 86.4°C),
Vibration 4.2mm/s (limite: 5.04mm/s). Monitoramento intensificado
recomendado. Índice de anomalia: 58%. Disponibilidade: 95.2%.
Telemetria de MTR-002: voltage 380.0V (normal), current 52.0A (normal),
temperature 72.0°C (alerta), rpm 1470.0rpm (normal), vibration 4.2mm/s (alerta).
Tipo: motor elétrico trifásico assíncrono industrial ativo máquina equipamento.
```

### Tratamento de Sinônimos

O módulo de expansão semântica mapeia 60+ variantes para termos canônicos:

```
"equipamento"  → motor, ativo, máquina
"área"         → hall, setor, pavilhão, zone
"calor"        → temperatura, temperature, thermal
"vibration"    → vibração, oscilação
"falha"        → crítico, critical, failure
```

### Avaliação

20 consultas de teste com ground-truth manual.

| Métrica | Valor |
|---|---|
| Mean Precision@1 | ~0.80 |
| Mean Precision@2 | ~0.65 |
| Mean Precision@3 | ~0.55 |
| Mean Recall@1 | ~0.75 |
| Mean Recall@2 | ~0.85 |
| Mean Recall@3 | ~0.90 |

*Valores exatos variam com cada execução — consulte `sprint2_pln_avaliacao.png` gerado pelo notebook.*

---

## Stack Tecnológica

### Frontend

| Tecnologia | Versão | Uso |
|---|---|---|
| React | 18 | UI framework |
| TypeScript | 5 | Type safety |
| Vite | 5 | Build tool + HMR |
| Tailwind CSS | 3 | Styling |
| Zustand | 4 | State management |
| Recharts | 2 | Gráficos (AreaChart, BarChart, PieChart) |
| Framer Motion | 11 | Animações |
| React Router | 7 | Roteamento |
| Axios | 1 | HTTP client |
| React Hook Form + Zod | — | Formulários validados |
| TanStack Query | 5 | Data fetching |
| Lucide React | — | Ícones |
| Sonner | — | Toasts |
| Radix UI | — | Componentes acessíveis |

### Backend

| Tecnologia | Uso |
|---|---|
| Node.js + Express | API REST |
| TypeScript | Type safety |
| JWT + bcrypt | Autenticação + hash de senhas |
| CORS configurável | Segurança de origem |

### NLP / PLN (Sprint 2)

| Tecnologia | Uso |
|---|---|
| Python 3.10+ | Runtime |
| SentenceTransformers | Geração de embeddings |
| `paraphrase-multilingual-MiniLM-L12-v2` | Modelo de embedding (pt+en, 384 dims) |
| FAISS (faiss-cpu) | Índice vetorial + busca semântica |
| NumPy | Operações matriciais |
| Pandas | Análise e avaliação |
| Matplotlib + Seaborn | Visualizações de avaliação |
| Jupyter Notebook | Ambiente de desenvolvimento NLP |

---

## Instalação e Execução

### Frontend + Backend

```bash
# Instalar dependências do frontend
npm install

# Instalar dependências do backend
cd server && npm install && cd ..

# Iniciar tudo junto (Windows)
start-all.bat

# Ou separadamente:
npm run dev          # Frontend em http://localhost:5173
cd server && npm run dev  # Backend em http://localhost:3000
```

### Sprint 2 PLN (Jupyter)

```bash
# Criar e ativar ambiente virtual (recomendado)
python -m venv venv
venv\Scripts\activate      # Windows
source venv/bin/activate   # Linux/macOS

# Instalar dependências
pip install sentence-transformers faiss-cpu numpy pandas matplotlib seaborn jupyter

# Abrir o notebook
jupyter notebook notebooks/sprint2_pln_consulta.ipynb

# Executar todas as células (Kernel → Restart & Run All)
# Artefatos gerados em notebooks/:
#   faiss_assets.index
#   assets_metadata.json
#   sprint2_pln_avaliacao.png
#   sprint2_pln_similaridade.png
```

**Nota:** O download do modelo (~118 MB) ocorre automaticamente na primeira execução via HuggingFace Hub.

---

## Estrutura do Projeto

```
sueteres-uiux/
├── src/
│   ├── components/
│   │   ├── AIAssistant.tsx          # Chat IA Forzy
│   │   ├── AlertItem.tsx            # Item de alerta com mlInsight
│   │   ├── AssetDetailPanel.tsx     # Painel lateral do ativo
│   │   ├── Cards.tsx                # KPICard, AssetTile
│   │   ├── EquipmentRegistrationForm.tsx  # OCR de placa
│   │   ├── SkeletonLoaders.tsx      # Loading states
│   │   ├── TimeSeriesChart.tsx      # Gráfico temporal
│   │   └── ProtectedRoute.tsx       # Guard JWT
│   ├── pages/
│   │   ├── Dashboard.tsx            # KPIs + Recharts
│   │   ├── PlantNavigation.tsx      # Grid navegável da planta
│   │   ├── AlertsPage.tsx           # Centro de alertas
│   │   ├── EquipmentPage.tsx        # Gestão de equipamentos
│   │   ├── AssistantPage.tsx        # Assistente IA
│   │   ├── LoginPage.tsx            # Autenticação
│   │   ├── SettingsPage.tsx         # Preferências
│   │   └── AccountPage.tsx          # Perfil
│   ├── services/
│   │   ├── api.ts                   # Mock API (5 ativos, sensores, alertas)
│   │   └── authAPI.ts               # Chamadas de auth ao backend
│   ├── store/
│   │   ├── appStore.ts              # Zustand (assets, alerts, kpis, ui)
│   │   └── authStore.ts             # Zustand (user, tokens)
│   ├── types/index.ts               # Asset, Sensor, Alert, EquipmentRegistration
│   ├── translations/index.ts        # i18n pt/en
│   └── theme.ts                     # CSS variables + tema
├── server/
│   └── src/
│       ├── index.ts                 # Express app
│       ├── controllers/auth.controller.ts
│       ├── routes/auth.ts
│       ├── middleware/auth.ts        # JWT middleware
│       ├── services/token.service.ts
│       └── services/user.service.ts
├── notebooks/
│   ├── sprint2_pln_consulta.ipynb          # ← Sprint 2 PLN (notebook principal)
│   ├── sprint2_pln_templates.md            # ← Templates + regras de composição
│   ├── faiss_assets.index                  # ← Índice FAISS (gerado pelo notebook)
│   ├── assets_metadata.json                # ← Metadados indexados
│   ├── sprint2_pln_avaliacao.png           # ← Gráficos Precision/Recall
│   ├── sprint2_pln_similaridade.png        # ← Matriz de similaridade
│   └── SPRINT2_FORZY_DIGITAL_TWIN_VISAO_COMPUTACIONAL.pdf
├── CHALLENGE_CONTEXT.md             # Documento mestre do challenge
├── markdowns/                       # Documentação de processo
├── package.json
└── README.md
```

---

## Credenciais Demo

| Role | Email | Senha |
|---|---|---|
| Admin | `admin@industrial.com` | `password123` |
| Engineer | `engineer@industrial.com` | `password123` |
| Technician | `technician@industrial.com` | `password123` |

---

## Status por Sprint

| Sprint | Disciplina | Status |
|---|---|---|
| Sprint 1 | Frontend (React + TypeScript) | ✅ Completo |
| Sprint 1 | Auth (JWT + RBAC 3 roles) | ✅ Completo |
| Sprint 1 | Mock API (5 ativos, sensores, alertas) | ✅ Completo |
| Sprint 2 | PLN — Embeddings + FAISS | ✅ Completo |
| Sprint 2 | PLN — Busca semântica | ✅ Completo |
| Sprint 2 | PLN — Sinônimos + templates | ✅ Completo |
| Sprint 2 | PLN — Avaliação Precision/Recall | ✅ Completo |
| Sprint 2 | Visão Computacional | ✅ PDF entregue |
| Sprint 3+ | ML baseline + anomalia + predição | 🔲 Pendente |
| Sprint 4 | RAG + agente conversacional real | 🔲 Pendente |

---

*FIAP Challenge × Forzy / Promon | Digital Twin para monitoramento de motores industriais*
