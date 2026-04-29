# Sprint 1 — Definição dos Campos da Placa para OCR

> Especificação dos campos que serão extraídos automaticamente da placa do
> motor nas Sprints 2/3 (Visão Computacional + LLM multimodal).
>
> Atende ao requisito da Sprint 1: *"definição de quais dados da placa
> poderão ser extraídos futuramente por imagem"*.

## Estratégia

Combinação de duas abordagens em pipeline:

1. **OCR clássico** (PaddleOCR ou EasyOCR) para extração rápida e local.
2. **LLM multimodal** (Claude Vision ou GPT-4V) para placas danificadas,
   ilegíveis, ou para validar e complementar o resultado do OCR.

Para cada campo definimos:
- `field_key` — chave canônica (alinhada ao schema de `equipment`)
- `display_name` — rótulo legível
- `category` — `identificacao` / `eletrico` / `mecanico` / `termico`
- `data_type` — `string`, `number`, `enum`
- `unit` — V, A, kW, etc.
- `regex_hint` — padrão típico para extração e validação
- `example` — valor real visto na placa do W22
- `required` — campo obrigatório para considerar o cadastro completo
- `ocr_priority` — `1` alta (obrigatório no Sprint 2), `2` média, `3` baixa

## Tabela canônica (`placa_field`)

### Identificação (P1)

| field_key | display | required | regex | exemplo |
|---|---|---|---|---|
| `fabricante` | Fabricante | ✓ | `^[A-Z]{2,}$` | `WEG` |
| `codigo_fabricante` | Código fabricante | ✓ | `\d{6,10}` | `13887610` |
| `modelo` | Modelo | ✓ | `W22\|W21\|W11` | `W22 3 cv 2P 100L 1F` |
| `norma` | Norma | — | `ABNT\|IEC\|NEMA` | `NBR 17094` |

### Elétricos (P1)

| field_key | display | required | regex | exemplo |
|---|---|---|---|---|
| `tensao_nominal` | Tensão Nominal | ✓ | `\d{3}([-/]\d{3})*\s*V` | `110-127/220-254 V` |
| `corrente_nominal` | Corrente Nominal | ✓ | `\d+(\.\d+)?[-/]\d+(\.\d+)?\s*A` | `25.0-21.7/12.5-10.8 A` |
| `frequencia_hz` | Frequência | ✓ | `(50\|60)\s*Hz` | `60` |
| `numero_polos` | Polos | ✓ | `\dP\b` | `2` |
| `fator_potencia` | Fator de Potência | — | `0\.\d{2}` | `0.98` |
| `rendimento` | Rendimento | — | `\d{2}\.\d` | `81.8` |

### Mecânicos (P1)

| field_key | display | required | regex | exemplo |
|---|---|---|---|---|
| `potencia_cv` | Potência (cv) | ✓ | `\d+(\.\d+)?\s*(cv\|HP)` | `3` |
| `potencia_kw` | Potência (kW) | ✓ | `\d+(\.\d+)?\s*kW` | `2.2` |
| `rotacao_nominal_rpm` | RPM nominal | ✓ | `\d{3,4}\s*(RPM\|rpm\|r/min)` | `3525` |
| `carcaca` | Carcaça | ✓ | `\d{2,3}[A-Z]?` | `100L` |
| `forma_construtiva` | Forma construtiva | — | `B3[A-Z]?\|B5\|B14\|B35` | `B3D` |
| `massa_kg` | Massa | — | `\d+(\.\d+)?\s*kg` | `38.6` |

### Térmicos / Proteção (P1/P2)

| field_key | display | required | regex | exemplo |
|---|---|---|---|---|
| `grau_protecao` | Grau de Proteção | ✓ | `IP\d{2}` | `IP55` |
| `classe_isolamento` | Classe de Isolamento | ✓ | `CL\.\|CLASSE\s*[A-Z]\|ISOL\.` | `F` |
| `regime_servico` | Regime de Serviço | — | `S[1-9]\|REG\s*S` | `S1` |
| `fator_servico` | Fator de Serviço | — | `FS\s*\d\.\d{2}` | `1.15` |
| `temperatura_ambiente_max_c` | Temp. ambiente máx | — | `AMB\s*\d{2}\s*°?C` | `40` |

### Diagrama de ligação (P2 — visão multimodal)

| field_key | display | regex | observação |
|---|---|---|---|
| `diagrama_ligacao` | Diagrama de Ligação | — | Imagem gráfica na placa mostrando T1..T8 — **requer LLM multimodal**, não é texto |

### Mancal / Rolamento (P2)

| field_key | display | regex | exemplo |
|---|---|---|---|
| `rolamento_de` | Rolamento DE | `\d{4}\s*(2Z\|ZZ\|RS\|2RS\|C3)` | `6206 ZZ` |
| `rolamento_nde` | Rolamento NDE | `\d{4}\s*(2Z\|ZZ\|RS\|2RS\|C3)` | `6206 ZZ` |

---

## Como será usado na Sprint 2

```
   ┌──────────────────┐
   │  Foto da placa   │
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────┐
   │  PaddleOCR/Easy  │  →  texto bruto + bounding boxes
   └────────┬─────────┘
            │
            ▼  para cada placa_field:
   ┌──────────────────────────────────┐
   │  match com regex_hint             │
   │  → se score ≥ 0.8: aceita direto  │
   │  → se score < 0.8: vai para LLM   │
   └────────┬─────────────────────────┘
            │
            ▼
   ┌──────────────────────────────────┐
   │  LLM multimodal (Claude Vision)  │
   │  prompt: "Extraia o campo X da   │
   │  placa. Aceite valor numérico    │
   │  com tolerância. Devolva JSON."  │
   └────────┬─────────────────────────┘
            │
            ▼
   ┌──────────────────┐
   │  POST /equipments│  →  cadastro automático
   └──────────────────┘
```

A tabela `placa_field` no banco serve de **contrato bidirecional**: o
front sabe quais campos esperar, e o pipeline de OCR sabe quais campos
deve produzir. Isso evita que cada disciplina FIAP defina sua própria
estrutura.

---

## Exemplos reais (PDF do Challenge)

O briefing oficial mostrou 4 placas que servirão de gold standard para
testes do OCR:

1. **Siemens** Three-Phase Asynchronous (1LE0022-0EB4) — multi-tap 230V/400V
2. **WEG** W22 132M (220/440V, 7.5 cv) — placa similar ao MTR-001
3. **Dutchi Motors** DMA 100L4 (multi-tensão 230/400/415/460V)
4. **Metalcorte** Motor de Indução Trifásico

Em Sprint 2 cada uma dessas placas será processada e os resultados
comparados com o ground-truth feito manualmente.
