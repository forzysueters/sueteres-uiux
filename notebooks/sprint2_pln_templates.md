# Templates de Linguagem Natural — Sprint 2 PLN
# Digital Twin Forzy | Enriquecimento Textual de Ativos

---

## 1. Objetivo

Este documento define os **templates de geração de texto** utilizados para transformar os
dados estruturados dos ativos industriais em descrições de linguagem natural. Essas descrições
alimentam o pipeline de embeddings e são reutilizadas pelo assistente conversacional.

---

## 2. Arquitetura de Templates

```
Ativo (campos estruturados)
        │
        ▼
  Template Engine
        │
        ├─ template_base()       → descrição geral do ativo
        ├─ template_status()     → estado operacional atual
        ├─ template_sensores()   → leituras de sensores em linguagem natural
        ├─ template_tipo_extra() → termos adicionais para recall semântico
        └─ template_completo()   → concatenação dos quatro acima para embedding
        │
        ▼
  Texto em linguagem natural
        │
        ▼
  Pipeline de Embedding → FAISS
```

---

## 3. Templates Definidos

### 3.1 Template Base — Identidade do Ativo

**Padrão:**
```
{TIPO_PT} {TAG} ({NOME}), localizado em {LOCALIZAÇÃO}, fabricante {FABRICANTE},
modelo {MODELO}. {ESPECIFICACAO_TECNICA}.
```

**Exemplos gerados:**

```
Motor MTR-001 (Main Production Motor), localizado em Hall A - Estação 1,
fabricante WEG, modelo W22 IE3. Motor trifásico assíncrono 380V, potência 45kW,
rotação nominal 1480 RPM, corrente nominal 45A.

Motor MTR-002 (Backup Motor), localizado em Hall A - Estação 2,
fabricante ABB, modelo IE3-132M. Motor trifásico de reserva 380V,
potência 52kW, rotação nominal 1470 RPM.

Bomba BOM-001 (Coolant Circulation Pump), localizado em Hall B - Sistema de Resfriamento,
fabricante KSB, modelo Etanorm. Bomba centrífuga para circulação de fluido refrigerante,
pressão nominal 2.5 bar, vazão 150 L/min.

Compressor CMP-001 (Air Compressor), localizado em Hall C - Pneumática,
fabricante Schulz, modelo MSV-15. Compressor de ar comprimido para sistema pneumático,
pressão de saída 7 bar, corrente do motor 35A.

Ventilador VEN-001 (Ventilation Fan), localizado em Hall A - Cobertura,
fabricante Multivac, modelo EVT-250. Ventilador de exaustão industrial para controle
térmico do ambiente, velocidade nominal 85%, corrente do motor 8A.
```

---

### 3.2 Template de Status — Estado Operacional

**Critérios de normalidade, alerta e criticidade:**

| Campo         | Normal                    | Alerta                      | Crítico                     |
|---------------|---------------------------|-----------------------------|-----------------------------|
| Temperatura   | ≤ threshold × 1.0         | threshold × 1.0 a × 1.2    | > threshold × 1.2           |
| Corrente      | ≤ threshold × 1.0         | threshold × 1.0 a × 1.2    | > threshold × 1.2           |
| Vibração      | ≤ threshold × 1.0         | threshold × 1.0 a × 1.2    | > threshold × 1.2           |
| RPM           | dentro do range nominal   | ± 5% do nominal             | ± 10% do nominal            |
| Tensão        | 380V ± 5%                 | 380V ± 10%                  | 380V ± 15%                  |
| anomalyScore  | 0–30                      | 31–60                       | 61–100                      |

**Padrões por status:**

**Normal:**
```
{TAG} operando dentro dos parâmetros normais. Temperatura: {TEMP}°C (OK),
corrente: {CORRENTE}A (OK), vibração: {VIBRACAO}mm/s (OK).
Disponibilidade: {UPTIME}%. Próxima manutenção prevista para {DATA_MANUT}.
```

**Alerta:**
```
{TAG} apresentando {SENSOR_ANOMALO} acima da faixa recomendada.
Valor atual: {VALOR} {UNIDADE} (limite: {THRESHOLD} {UNIDADE}).
Monitoramento intensificado recomendado. Índice de anomalia: {SCORE}%.
```

**Crítico:**
```
{TAG} em estado crítico. {SENSOR_ANOMALO} atingiu {VALOR} {UNIDADE},
ultrapassando o limiar crítico de {THRESHOLD} {UNIDADE}.
Parada para inspeção imediata recomendada. Índice de anomalia: {SCORE}%.
Risco de falha detectado.
```

**Offline:**
```
{TAG} offline — sem leitura de sensores. Último registro: {ULTIMO_REGISTRO}.
Verificar conectividade do sensor e estado físico do equipamento.
```

**Exemplos gerados:**

```
MTR-001 operando dentro dos parâmetros normais. Temperatura: 65°C (OK),
corrente: 45A (OK), vibração: 2.5mm/s (OK).
Disponibilidade: 99.8%. Próxima manutenção prevista para 2026-06-15.

MTR-002 apresentando temperatura acima da faixa recomendada.
Valor atual: 72°C (limite: 70°C). Monitoramento intensificado recomendado.
Índice de anomalia: 58%.

CMP-001 em estado crítico. Vibração atingiu 6.8mm/s, ultrapassando o
limiar crítico de 5.5mm/s. Parada para inspeção imediata recomendada.
Índice de anomalia: 85%. Risco de falha detectado.
```

---

### 3.3 Template de Sensores — Leituras Narradas

**Padrão:**
```
Telemetria de {TAG}: {LISTA_SENSORES_NARRADA}.
```

**Exemplos gerados:**

```
Telemetria de MTR-001: tensão 380V (normal), corrente 45A (normal),
temperatura 65°C (normal), rotação 1480 RPM (normal),
vibração 2.5mm/s (normal).

Telemetria de CMP-001: pressão de saída 7.0 bar (normal),
temperatura de entrada 28°C (normal), temperatura de saída 82°C (alerta),
corrente do motor 35A (normal), vibração 6.8mm/s (crítico).
```

---

### 3.4 Template Completo — Texto para Embedding

Concatenação de `template_base + template_status + template_sensores` com separação por
ponto-e-vírgula. Este é o texto que alimenta o modelo de embedding.

**Exemplo MTR-001:**
```
Motor MTR-001 (Main Production Motor), localizado em Hall A - Estação 1,
fabricante WEG, modelo W22 IE3. Motor trifásico assíncrono 380V 45kW 1480RPM.
MTR-001 operando dentro dos parâmetros normais. Temperatura: 65°C (OK),
corrente: 45A (OK), vibração: 2.5mm/s (OK). Disponibilidade: 99.8%.
Telemetria: tensão 380V normal, corrente 45A normal, temperatura 65°C normal,
rotação 1480 RPM normal, vibração 2.5mm/s normal.
Tipo: motor elétrico trifásico assíncrono industrial. Tensão de operação: 380V.
```

**Exemplo CMP-001:**
```
Compressor CMP-001 (Air Compressor), localizado em Hall C - Pneumática,
fabricante Schulz, modelo MSV-15. Compressor de ar para sistema pneumático 7 bar 35A.
CMP-001 em estado crítico. Vibração atingiu 6.8mm/s ultrapassando limiar crítico.
Parada para inspeção imediata recomendada. Índice de anomalia: 85%.
Telemetria: pressão saída 7.0 bar normal, temperatura saída 82°C alerta,
corrente motor 35A normal, vibração 6.8mm/s crítico.
Tipo: compressor de ar industrial pneumático. Pressão nominal: 7 bar.
```

---

## 4. Regras de Composição

### 4.1 Normalização de campos

| Campo de entrada | Transformação aplicada |
|---|---|
| `asset.id` = `"motor-001"` | → TAG = `"MTR-001"` (mapeamento por tipo) |
| `asset.type` = `"motor"` | → `"Motor"` em pt, `"Electric Motor"` em en |
| `asset.type` = `"pump"` | → `"Bomba"` em pt |
| `asset.type` = `"compressor"` | → `"Compressor"` em pt |
| `asset.type` = `"fan"` | → `"Ventilador"` em pt |
| `asset.location` = `"Hall A - Station 1"` | → `"Hall A - Estação 1"` |
| `sensor.name` = `"RPM"` | → `"rotação"` (campo textual normalizado) |
| `sensor.name` = `"Vibration"` | → `"vibração"` |
| `sensor.status` = `"normal"` | → `"(OK)"` / `"(normal)"` |
| `sensor.status` = `"warning"` | → `"(alerta)"` |

### 4.2 Seleção de sensor para template de status

Prioridade de sensor para diagnóstico textual:
1. Vibração (Vibration) — indicador mais crítico para motores
2. Temperatura (Temperature) — segundo indicador em relevância
3. Corrente (Current) — indicador de carga elétrica
4. RPM — indicador de velocidade
5. Pressão (Pressure) — para bombas e compressores

### 4.3 Thresholds adotados (baseados no mock `src/services/api.ts`)

Os thresholds são calculados como `baseValue × 1.2` conforme definido em `generateSensorData()`.
A função original: `threshold: baseValue * 1.2`.

| Ativo | Sensor | Valor Base | Threshold | Critério crítico |
|---|---|---|---|---|
| MTR-001 | Temperature | 65°C | 78°C | > 78°C |
| MTR-001 | Vibration | 2.5mm/s | 3.0mm/s | > 3.0mm/s |
| MTR-002 | Temperature | 72°C | 86.4°C | > 86.4°C |
| MTR-002 | Vibration | 4.2mm/s | 5.04mm/s | > 5.04mm/s |
| CMP-001 | Vibration | 6.8mm/s | 8.16mm/s | > 8.16mm/s |
| CMP-001 | Outlet Temp | 82°C | 98.4°C | > 98.4°C |

---

## 5. Glossário de Sinônimos Industriais

Utilizado pela camada de expansão semântica na busca:

```python
SYNONYM_MAP = {
    # Tipos de equipamento
    "motor":       ["motor", "máquina", "equipamento", "ativo", "motor elétrico",
                    "motor trifásico", "motor assíncrono", "machine", "equipment"],
    "bomba":       ["bomba", "pump", "bomba centrífuga", "circulador"],
    "compressor":  ["compressor", "compressor de ar", "air compressor"],
    "ventilador":  ["ventilador", "fan", "exaustor", "extrator"],

    # Localização
    "hall":        ["hall", "área", "setor", "pavilhão", "galpão", "zone", "area", "sector"],
    "estação":     ["estação", "station", "ponto", "posição", "posto"],
    "localização": ["localização", "local", "localidade", "posição", "where", "location"],
    "cobertura":   ["cobertura", "teto", "roof", "telhado"],

    # Estado
    "normal":      ["normal", "ok", "operacional", "funcionando", "healthy", "good"],
    "alerta":      ["alerta", "aviso", "warning", "atenção", "monitorar"],
    "crítico":     ["crítico", "critical", "falha", "failure", "quebrado", "parado"],

    # Sensores
    "temperatura": ["temperatura", "temperature", "temp", "calor", "thermal", "hot", "quente"],
    "vibração":    ["vibração", "vibration", "vib", "vibrating", "vibra", "oscilação"],
    "corrente":    ["corrente", "current", "amperagem", "ampere", "amp", "carga elétrica"],
    "tensão":      ["tensão", "voltage", "volt", "voltagem", "220v", "380v", "440v"],
    "rotação":     ["rotação", "rpm", "velocidade", "speed", "giro"],
    "pressão":     ["pressão", "pressure", "bar", "psi"],
    "vazão":       ["vazão", "flow", "flow rate", "fluxo"],
}
```

---

## 6. Rastreabilidade dos Templates

| Template | Origem dos dados | Arquivo fonte |
|---|---|---|
| `template_base()` | `Asset.type`, `Asset.name`, `Asset.location`, `EquipmentRegistration` | `src/services/api.ts` |
| `template_status()` | `Asset.status`, `Asset.anomalyScore`, `Asset.uptime`, `Asset.nextMaintenance` | `src/services/api.ts` |
| `template_sensores()` | `Asset.sensors[]` (name, value, unit, status) | `src/services/api.ts` |
| `template_tipo_extra()` | `Asset.type` | Sprint 2 PLN notebook |
| `template_completo()` | Concatenação dos quatro acima | — |
| TAGs | Geradas por `generate_tag(asset_id)` | Sprint 2 PLN notebook |
| Thresholds | `sensor.threshold` = `baseValue × 1.2` | `src/services/api.ts:8` |

---

*Documento gerado na Sprint 2 — NLP | Forzy Digital Twin Challenge FIAP*
