# Sprint 2 — Visão Computacional: Identificação e Rastreabilidade de Ativos

**Disciplina:** Visão Computacional  
**Projeto:** Forzy Digital Twin — Monitoramento Industrial Inteligente  
**Data:** Junho 2026

---

## 1. Contexto da Planta Industrial

### Descrição do Ambiente

A planta industrial Forzy simula uma unidade de **manufatura contínua** do setor metalmecânico. O ambiente é composto por maquinário pesado com alta densidade energética, operação 24/7 e requisitos rigorosos de rastreabilidade por normas como NBR 17094, ISO 55000 e regulamentos de segurança NR-12.

**Por que a identificação visual dos ativos é crítica?**

Em plantas industriais reais, as placas de identificação (nameplates) são a **única fonte de verdade** sobre as especificações elétricas e mecânicas de um equipamento. Substituições de peças, trocas de motores, remanufaturamento e ausência de documentação atualizada tornam a placa física o registro mais confiável. Um sistema OCR que extrai automaticamente esses dados:

- **Elimina erros de digitação manual** durante o cadastro (principal causa de falhas em manutenção)
- **Acelera o onboarding** de novos equipamentos de horas para segundos
- **Garante rastreabilidade contínua**: a imagem da placa + dados extraídos formam evidência auditável
- **Alimenta o Digital Twin** com parâmetros reais do fabricante, habilitando análises de desvio operacional (ex: motor operando acima da corrente nominal da placa)
- **Habilita CBM (Condition-Based Maintenance)**: ao comparar telemetria em tempo real com os limites da placa, o sistema detecta degradação antes da falha

### Zonas da Planta

| Zona | Tipo | Descrição |
|------|------|-----------|
| **Hall A** | Produção principal | Linha de produção com motores elétricos de alta potência |
| **Hall B** | Sistema hidráulico | Bombas e tubulações de refrigeração e processo |
| **Hall C** | Utilidades | Central de ar comprimido e instrumentação |
| **Cobertura / Área Técnica** | Ventilação | Sistema de exaustão e renovação de ar |

### Fluxo de Inspeção Recomendado

O mapa SVG interativo exibe setas tracejadas e badges numerados indicando a sequência recomendada de inspeção dos ativos:

```
[1] MTR-001 (Hall A — Posto 1)
      ↓
[2] MTR-002 (Hall A — Posto 2)
      ↓
[3] BBA-001 (Hall B — Sistema Hidráulico)
      ↓
[4] CMP-001 (Hall C — Central de Ar Comprimido)
      ↓
[5] EXA-001 (Cobertura — Área Técnica Norte)
```

**Critério de ordenação:** inspeção por proximidade física dentro de cada área (Hall A completo → Hall B → Hall C → Cobertura), minimizando o deslocamento do técnico e respeitando a criticidade dos ativos de produção principal.

### Distribuição dos Ativos

| TAG | Nome | Tipo | Área | Localização | Fabricante | Modelo | Nº Série |
|-----|------|------|------|-------------|------------|--------|----------|
| MTR-001 | Motor Principal Linha A | Motor elétrico | Hall A | Linha de Produção A — Posto 1 | WEG | W22 IE3 | WEG2024-MTR001 |
| MTR-002 | Motor Secundário Linha A | Motor elétrico | Hall A | Linha de Produção A — Posto 2 | Siemens | SIMOTICS SD | SIE2023-MTR002 |
| BBA-001 | Bomba de Circulação | Bomba centrífuga | Hall B | Sistema Hidráulico — Bomba Principal | KSB | Etanorm 32-200 | SN-KSB-20220615 |
| CMP-001 | Compressor de Ar | Compressor parafuso | Hall C | Central de Ar Comprimido | Atlas Copco | GA 22+ | SN-AC-20211210 |
| EXA-001 | Exaustor de Cobertura | Exaustor industrial | Cobertura | Área Técnica — Cobertura Norte | WEG | W21 71 IE2 | SN-WEG-20230301 |

---

## 2. Dados de Placa (Nameplate) — Todos os Ativos

### MTR-001 — WEG W22 IE3 (Motor Principal)

| Campo | Valor |
|-------|-------|
| TAG | MTR-001 |
| Fabricante | WEG |
| Modelo | W22 IE3 |
| Nº Série | WEG2024-MTR001 |
| Potência | 22,0 kW / 30 CV |
| Tensão | 380/660 V |
| Corrente nominal | 41,8 A |
| Rotação | 1.760 RPM |
| Polos | 4 |
| Ligação | Delta/Star |
| Frequência | 60 Hz |
| Classe IP | IP55 |
| Classe de Isolação | F |
| Ano de Fabricação | 2021 |
| Norma | NBR 17094 / IEC 60034 |

### MTR-002 — Siemens SIMOTICS SD (Motor Secundário)

| Campo | Valor |
|-------|-------|
| TAG | MTR-002 |
| Fabricante | Siemens |
| Modelo | SIMOTICS SD |
| Nº Série | SIE2023-MTR002 |
| Potência | 37,0 kW / 50 CV |
| Tensão | 380/660 V |
| Corrente nominal | 68,5 A |
| Rotação | 1.475 RPM |
| Polos | 4 |
| Ligação | Delta/Star |
| Frequência | 60 Hz |
| Classe IP | IP55 |
| Classe de Isolação | F |
| Ano de Fabricação | 2022 |
| Norma | IEC 60034 |

### BBA-001 — KSB Etanorm 32-200 (Bomba de Circulação)

| Campo | Valor |
|-------|-------|
| TAG | BBA-001 |
| Fabricante | KSB |
| Modelo | Etanorm 32-200 |
| Nº Série | SN-KSB-20220615 |
| Potência | 5,5 kW / 7,5 CV |
| Tensão | 380 V |
| Corrente nominal | 11,2 A |
| Rotação | 1.450 RPM |
| Polos | 4 |
| Ligação | Star |
| Frequência | 60 Hz |
| Classe IP | IP54 |
| Classe de Isolação | B |
| Ano de Fabricação | 2022 |
| Norma | NBR 12166 / ISO 9908 |

### CMP-001 — Atlas Copco GA 22+ (Compressor de Ar)

| Campo | Valor |
|-------|-------|
| TAG | CMP-001 |
| Fabricante | Atlas Copco |
| Modelo | GA 22+ |
| Nº Série | SN-AC-20211210 |
| Potência | 22,0 kW / 30 CV |
| Tensão | 380 V |
| Corrente nominal | 42,0 A |
| Rotação | 2.950 RPM |
| Polos | 2 |
| Ligação | Delta |
| Frequência | 60 Hz |
| Classe IP | IP55 |
| Classe de Isolação | F |
| Ano de Fabricação | 2020 |
| Norma | ISO 1217 / NBR 9912 |

### EXA-001 — WEG W21 71 IE2 (Exaustor de Cobertura)

| Campo | Valor |
|-------|-------|
| TAG | EXA-001 |
| Fabricante | WEG |
| Modelo | W21 71 IE2 |
| Nº Série | SN-WEG-20230301 |
| Potência | 0,75 kW / 1 CV |
| Tensão | 220/380 V |
| Corrente nominal | 3,2 A |
| Rotação | 1.710 RPM |
| Polos | 4 |
| Ligação | Delta/Star |
| Frequência | 60 Hz |
| Classe IP | IP55 |
| Classe de Isolação | F |
| Ano de Fabricação | 2023 |
| Norma | NBR 17094 / IEC 60034 |

---

## 3. Pipeline OCR — Etapas de Pré-processamento

```
┌─────────────────────────────────────────────────────────────────────────┐
│                  PIPELINE OCR — FORZY DIGITAL TWIN                      │
│                                                                         │
│  [1] Planta      [2] Ativo      [3] Captura    [4] Pré-proc.           │
│  Industrial  →  Identificado → Imagem      →  OpenCV (9 etapas)        │
│                                                                         │
│       [5] EasyOCR  →  [6] Validação  →  [7] Registro + Hash           │
│          Extração      LLM Vision        Sistema Forzy                  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Etapas de Pré-processamento OpenCV

| Etapa | Operação | Parâmetros | Objetivo |
|-------|----------|-----------|----------|
| 1 | Grayscale | `cvtColor(BGR2GRAY)` | Reduz dimensionalidade, acelera processamento |
| 2 | Resize | `INTER_LANCZOS4`, target 1200px | Normaliza resolução para OCR consistente |
| 3 | Deskew | `HoughLines + warpAffine` | Corrige rotação da câmera (até ±15°) |
| 4 | Denoise | `fastNlMeansDenoising(h=10)` | Remove ruído de câmera/compressão JPEG |
| 5 | Contraste | `CLAHE(clipLimit=2.5, tile=8×8)` | Equaliza iluminação irregular e sombras |
| 6 | Sharpening | `addWeighted(1.8, −0.8)` Unsharp Mask | Realça bordas dos caracteres para leitura |
| 7 | Binarização | `THRESH_BINARY + THRESH_OTSU` | Separa texto do fundo em dois tons |
| 8 | Morfologia | `MORPH_CLOSE + MORPH_OPEN` (kernel 2×2) | Remove ruídos residuais pós-binarização |
| 9 | Crop ROI | `copyMakeBorder(padding=20px)` | Remove margens, adiciona borda branca uniforme |

---

## 4. Resultados de Avaliação OCR

### Métricas — MTR-001 (WEG W22 IE3)

| Imagem | Accuracy Rate | CER médio | Confiança OCR | Campos corretos |
|--------|---------------|-----------|----------------|-----------------|
| Original (sem pré-proc.) | 54,2% | 34,2% | 71,8% | 13/24 |
| Pré-processada (pipeline) | 83,3% | 11,8% | 87,4% | 20/24 |
| **Melhoria** | **+29,1%** | **−22,4%** | **+15,6%** | **+7 campos** |

### Análise Crítica

**Por que o pré-processamento faz diferença?**

Imagens de campo de placas industriais sofrem de: iluminação lateral desigual, reflexos metálicos, inclinação de câmera (2°–8°), compressão JPEG, e contraste reduzido em placas antigas. O CLAHE resolve iluminação heterogênea; o Otsu threshold cria separação nítida texto/fundo; o deskew elimina erros de alinhamento que o EasyOCR não consegue compensar internamente.

**Campos mais difíceis para o OCR:**

| Campo | Motivo da dificuldade |
|-------|-----------------------|
| Nº Série (WEG2024-MTR001) | Mistura alfanumérica com hífens |
| Frequência (60 Hz) | "Hz" pode ser lido como "H2" ou "H2" |
| Potência (22.0 kW / 30.0 cv) | Múltiplos tokens + barras |
| Classe de Isolação (F) | Caractere único ambíguo (F/E/P) |

---

## 5. Implementação Real e Integração com o Frontend

O modelo de OCR deixou de ser apenas um protótipo em notebook e está **implementado
como um serviço FastAPI** (`ocr/OCR-Model-main`), **integrado ao frontend** na tela de
**Registro de Equipamento**.

### Arquitetura da integração

```
Frontend (React)  ──POST /ocr/extract (multipart)──►  Modelo OCR (FastAPI :8000)
   src/services/ocrAPI.ts                                EasyOCR + fallback Gemini
   ◄────────────── OCRResponse (JSON: campos + validação) ──────────────
```

- **Endpoint:** `POST /ocr/extract?mode=easyocr|gemini` e `GET /health`.
- **Cliente HTTP:** `src/services/ocrAPI.ts` (axios), URL via `VITE_OCR_API_URL`.
- **Mapeamento:** `mapToNameplate()` converte os `campos` extraídos (ex.: `potencia_kw`,
  `tensao_v`, `rpm`, `grau_protecao`, `classe_isolamento`, `data_fabricacao`) para a
  interface `MotorNameplate` exibida na UI; os polos são estimados de RPM × frequência e
  a confiança é a média das confianças por campo.
- **Dois modos na UI:** **EasyOCR** (padrão) e **Gemini Vision** (opcional, `GEMINI_API_KEY`).
- **Validação física no backend** (`PhysicalValidator`): coerência kW × cv, RPM × polos × Hz,
  carcaça × potência e nº de tensões × correntes — exibida como alertas na tela de revisão.
- **Resiliência:** se o backend de OCR estiver offline, o frontend cai automaticamente para
  dados simulados (marcados como "Simulado (offline)"), sem quebrar a demo.

### Pipeline efetivamente executado pela API

```
Imagem → realce adaptativo (OpenCV) → remoção de linhas de grade →
EasyOCR (bbox + texto) → extração/fusão de campos por zona →
validação física → [fallback Gemini quando faltam campos críticos] → resposta JSON
```

> Guia de execução e tabela completa de mapeamento de campos: `ocr/INTEGRATION.md`.

---

## 6. Integração Futura

### Fluxo Completo de Rastreabilidade

```
Captura Mobile (React Native / câmera)
     ↓
YOLO v8 — Detecção automática da região da placa
     ↓
Pipeline OpenCV (9 etapas de pré-processamento)
     ↓
EasyOCR + fine-tuning industrial (pt + en)
     ↓
LLM Vision (GPT-4V / Claude Vision) — validação semântica
     ↓
Hash SHA-256 da imagem (imutabilidade)
     ↓
Forzy API: TAG → Asset → MotorNameplate → Registro
     ↓
OPC-UA / MQTT → sensores vinculados ao nameplate
     ↓
Digital Twin: comparação telemetria vs. placa
     ↓
Histórico de Inspeções (imagem + dados + timestamp + operador)
```

### Cronograma de Implementação

| Horizonte | Funcionalidade |
|-----------|---------------|
| **Curto Prazo — Sprint 3** | Coleta de imagens reais em campo; fine-tuning EasyOCR; câmera mobile |
| **Médio Prazo** | Detecção YOLO v8; pipeline de augmentation; LLM Vision; confiança adaptativa por campo |
| **Longo Prazo** | OPC-UA integrado; base vetorial de modelos; OCR edge (ONNX); rastreabilidade blockchain |

---

## 7. Checklist Sprint 2

- [x] Contexto da planta e descrição do ambiente industrial
- [x] Importância da identificação visual documentada
- [x] Visão geral visual (PlantFloorMap SVG interativo)
- [x] Tabela de identificação com TAG, tipo, área, localização, fabricante, modelo, nº série
- [x] Dados de nameplate completos para **todos os 5 ativos** (14 campos cada)
- [x] Documentação de integração futura (OCR → OPC-UA → Digital Twin)
- [x] Geração de imagens sintéticas (PIL + ruído + rotação + variação de contraste)
- [x] Imagens salvas em disco (`notebooks/images/`)
- [x] Pipeline OpenCV completo (9 etapas com visualização before/after)
- [x] Protótipo OCR com EasyOCR (bilíngue pt+en)
- [x] Avaliação quantitativa (accuracy rate, CER, confiança, por campo)
- [x] Fluxograma visual do pipeline
- [x] Jupyter Notebook executado com outputs armazenados
- [x] Análise de limitações e sugestões de evolução (3 horizontes)
- [x] **Modelo de OCR implementado como API FastAPI e integrado ao frontend** (tela de Registro de Equipamento)
