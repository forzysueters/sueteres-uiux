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
│  │   KPIs   │ │SVG Map   │ │Realtime  │ │  OCR Register│  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
│                                                             │
│  State: Zustand | Routing: React Router v7 | Charts: Recharts│
│  Animation: Framer Motion | UI: Radix Primitives            │
│                                                             │
│  Backend (Node.js + Express)                                │
│  └── JWT Auth (access + refresh tokens)                     │
│                                                             │
│  OCR Pipeline (Python/Jupyter)                              │
│  └── OpenCV → EasyOCR → LLM Vision → Registro              │
└─────────────────────────────────────────────────────────────┘
```

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

### Fluxo

```
Planta → Ativo → Captura → Pré-proc. OpenCV → EasyOCR → Validação LLM → Registro
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
- Wizard em 4 etapas para cadastro via placa
- Pipeline visual: Imagem → Cinza → Contraste → Binarização → EasyOCR → Validação LLM
- 14 campos de nameplate preenchidos automaticamente
- Confiança OCR por campo
- Rastreabilidade com hash SHA-256

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
├── services/api.ts           # Mock API com dados determinísticos
├── store/appStore.ts         # Estado global (Zustand)
└── types/index.ts            # Interfaces TypeScript

notebooks/
└── sprint2_ocr_pipeline.ipynb  # Pipeline OCR completo (Sprint 2)

markdowns/
├── SPRINT2_VISAO_COMPUTACIONAL.md  # Documentação Sprint 2
└── ocr_evaluation_results.json     # Resultados exportados pelo notebook
```

---

## Execução

### Frontend

```bash
# Instalar dependências
npm install

# Desenvolvimento
npm run dev

# Build produção
npm run build
```

### Backend

```bash
cd server
npm install
npm start
# Servidor em http://localhost:3001
```

### Notebook OCR (Sprint 2)

```bash
# Criar ambiente virtual
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Instalar dependências
pip install opencv-python-headless easyocr pillow matplotlib numpy scikit-image jupyter

# Executar notebook
jupyter notebook notebooks/sprint2_ocr_pipeline.ipynb
```

---

## Credenciais de Acesso

```
Email:    tecnico@forzy.com.br
Senha:    forzy2024
```

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

### Backend
- **Node.js** + **Express**
- **JWT** (access + refresh tokens)

### Visão Computacional (Sprint 2)
- **OpenCV** (pré-processamento)
- **EasyOCR** (extração de texto)
- **Pillow / PIL** (geração de imagens sintéticas)
- **NumPy + Matplotlib** (análise e visualização)

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
