# Sprint 2 — Visão Computacional: Identificação e Rastreabilidade de Ativos

**Disciplina:** Visão Computacional  
**Projeto:** Forzy Digital Twin — Monitoramento Industrial Inteligente  
**Data:** Junho 2026

---

## 1. Contexto da Planta Industrial

A planta da Forzy simula uma unidade industrial de manufatura contínua organizada em quatro zonas:

| Zona | Descrição | Ativos |
|------|-----------|--------|
| **Hall A** | Produção principal — motores de alta potência | MTR-001, MTR-002 |
| **Hall B** | Sistema hidráulico — bombas e tubulações | BBA-001 |
| **Hall C** | Utilidades — ar comprimido | CMP-001 |
| **Cobertura / Área Técnica** | Ventilação e exaustão | EXA-001 |

### Descrição dos Ativos

| TAG | Nome | Tipo | Área | Localização | Fabricante | Modelo | Nr. Série |
|-----|------|------|------|-------------|------------|--------|-----------|
| MTR-001 | Motor Principal Linha A | Motor elétrico | Hall A | Linha de Produção A — Posição 1 | WEG | W22 IE3 | WEG2024-MTR001 |
| MTR-002 | Motor Secundário Linha A | Motor elétrico | Hall A | Linha de Produção A — Posição 2 | Siemens | SIMOTICS SD | SIE2023-MTR002 |
| BBA-001 | Bomba de Circulação | Bomba centrífuga | Hall B | Sistema Hidráulico — Bomba Principal | KSB | Etanorm 32-200 | SN-KSB-20220615 |
| CMP-001 | Compressor de Ar | Compressor parafuso | Hall C | Central de Ar Comprimido | Atlas Copco | GA 22+ | SN-AC-20211210 |
| EXA-001 | Exaustor de Cobertura | Exaustor industrial | Cobertura | Área Técnica — Cobertura Norte | WEG | W21 71 IE2 | SN-WEG-20230301 |

---

## 2. Dados de Placa (Nameplate) dos Motores

### MTR-001 — WEG W22 IE3

| Campo | Valor |
|-------|-------|
| TAG | MTR-001 |
| Fabricante | WEG |
| Modelo | W22 IE3 |
| Nr. Série | WEG2024-MTR001 |
| Potência | 22 kW / 30 cv |
| Tensão | 380/660 V |
| Corrente nominal | 41,8 A |
| Rotação | 1.760 RPM |
| Polos | 4 |
| Ligação | Delta/Star |
| Frequência | 60 Hz |
| Classe IP | IP55 |
| Classe de Isolação | F |
| Ano de Fabricação | 2021 |

### MTR-002 — Siemens SIMOTICS SD

| Campo | Valor |
|-------|-------|
| TAG | MTR-002 |
| Fabricante | Siemens |
| Modelo | SIMOTICS SD |
| Nr. Série | SIE2023-MTR002 |
| Potência | 37 kW / 50 cv |
| Tensão | 380/660 V |
| Corrente nominal | 68,5 A |
| Rotação | 1.475 RPM |
| Polos | 4 |
| Ligação | Delta/Star |
| Frequência | 60 Hz |
| Classe IP | IP55 |
| Classe de Isolação | F |
| Ano de Fabricação | 2022 |

---

## 3. Pipeline OCR — Etapas de Pré-processamento

```
┌─────────────────────────────────────────────────────────────────────────┐
│                  PIPELINE OCR — FORZY DIGITAL TWIN                      │
│                                                                         │
│  [1] Planta      [2] Ativo      [3] Captura    [4] Pré-proc.           │
│  Industrial  →  Identificado → Imagem      →  OpenCV                   │
│                                                                         │
│       [5] EasyOCR  →  [6] Validação  →  [7] Registro                  │
│          Extração      LLM Vision        Sistema                        │
└─────────────────────────────────────────────────────────────────────────┘
```

### Etapas de Pré-processamento OpenCV

| Etapa | Operação | Parâmetros | Objetivo |
|-------|----------|-----------|----------|
| 1 | Grayscale | `cvtColor(BGR2GRAY)` | Reduz dimensionalidade, acelera processamento |
| 2 | Resize | `INTER_LANCZOS4`, target 1200px | Normaliza resolução para OCR |
| 3 | Deskew | `HoughLines + warpAffine` | Corrige rotação da câmera |
| 4 | Denoise | `fastNlMeansDenoising(h=10)` | Remove ruído de câmera/compressão |
| 5 | Contraste | `CLAHE(clipLimit=2.5, tile=8x8)` | Equaliza iluminação irregular |
| 6 | Sharpening | `addWeighted(1.8, -0.8)` | Realça bordas dos caracteres |
| 7 | Binarização | `THRESH_BINARY + THRESH_OTSU` | Separa texto do fundo |
| 8 | Morfologia | `MORPH_CLOSE + MORPH_OPEN` | Remove ruídos residuais |
| 9 | Crop ROI | `copyMakeBorder(padding=20)` | Remove margens e prepara para OCR |

---

## 4. Resultados de Avaliação OCR

### Métricas de Avaliação

| Imagem | Accuracy Rate | CER médio | Confiança OCR | Campos corretos |
|--------|---------------|-----------|----------------|-----------------|
| Original (sem pré-proc.) | ~55% | ~35% | ~72% | 13/24 |
| Pré-processada (pipeline) | ~83% | ~12% | ~87% | 20/24 |
| **Melhoria** | **+28%** | **-23%** | **+15%** | **+7** |

### Análise Crítica

**Pontos Fortes:**
- O pré-processamento aumenta significativamente a acurácia para campos numéricos (RPM, tensão, potência)
- CLAHE é particularmente eficaz para placas com iluminação desigual de campo
- EasyOCR com modelos `pt+en` trata bem nomenclaturas técnicas mistas

**Limitações Identificadas:**
- Imagens sintéticas não reproduzem corrosão, sujeira e desgaste real
- Fontes puncionadas ou em relevo reduzem a acurácia em ~15%
- Caracteres similares (0/O, 1/I, l/L) ainda causam erros
- Sem detecção automática da região da placa (requer enquadramento manual)

---

## 5. Integração Futura

```
Captura Mobile
     ↓
YOLO v8 (detecção da placa)
     ↓
Pipeline OpenCV (pré-processamento)
     ↓
EasyOCR + Fine-tuning industrial
     ↓
LLM Vision (validação semântica + completude)
     ↓
Hash SHA-256 (rastreabilidade)
     ↓
Forzy API → TAG → Asset → Sensor History
     ↓
OPC-UA / MQTT (telemetria em tempo real)
```

---

## 6. Checklist Sprint 2

- [x] Contexto da planta e descrição dos ativos
- [x] Visão geral visual (SVG PlantFloorMap com hotspots)
- [x] Tabela de identificação de ativos (TAG, tipo, área, fabricante, modelo, série)
- [x] Dados de nameplate completos (14 campos por motor)
- [x] Documentação de integração futura (OCR → OPC-UA → Digital Twin)
- [x] Geração de imagens sintéticas (PIL com ruído, rotação, variação de iluminação)
- [x] Pipeline OpenCV completo (9 etapas com visualização before/after)
- [x] Protótipo OCR com EasyOCR (bilíngue pt+en)
- [x] Avaliação quantitativa (accuracy rate, CER, confiança, por campo)
- [x] Fluxograma visual do pipeline
- [x] Jupyter Notebook completo (`notebooks/sprint2_ocr_pipeline.ipynb`)
- [x] Análise de limitações e sugestões de evolução
