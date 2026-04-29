# Sprint 1 — Cadastro Técnico do Equipamento

> Schema completo da tabela `equipment`, com todos os campos derivados do
> datasheet WEG W22 3 cv 2P 100L 1F 110-127/220-254 V (modelo de referência).

## Identificação

| Campo | Tipo | Exemplo (W22) | Fonte |
|---|---|---|---|
| `tag` | string | `MTR-001` | Convenção interna |
| `name` | string | "Motor Principal — Linha 1" | Operação |
| `location` | string | "Forzy Lab — Bancada Principal" | Operação |
| `status` | enum | `normal` / `warning` / `critical` / `offline` | Calculado |
| `fabricante` | string | `WEG` | Placa |
| `codigo_fabricante` | string | `13887610` | Placa / catálogo |
| `modelo` | string | "W22 3 cv 2P 100L 1F 110-127/220-254 V 60 Hz IC411 - TFVE - B3D" | Placa / catálogo |
| `linha` | string | "W22 (IP55)" | Catálogo |
| `categoria` | string | "Monofásico — Uso Geral" | Catálogo |
| `norma` | string | "ABNT NBR 17094" | Placa / catálogo |

## Elétricos

| Campo | Unidade | Exemplo (W22) |
|---|---|---|
| `tensao_nominal` | V | `110-127/220-254 V` (multi-tap) |
| `corrente_nominal` | A | `25.0-21.7/12.5-10.8 A` |
| `corrente_partida` | A | `217-188/109-94.2 A` |
| `corrente_vazio` | A | `7.60-6.58/3.80-3.29 A` |
| `ip_in` | adim. | `8.7` |
| `conjugado_nominal_kgfm` | kgf·m | `0.608` |
| `conjugado_partida_pct` | % | `229` (Cp/Cn) |
| `conjugado_maximo_pct` | % | `300` (Cm/Cn) |
| `tempo_rotor_bloq_frio_s` | s | `16` |
| `tempo_rotor_bloq_quente_s` | s | `9` |
| `metodo_partida` | string | "Partida direta" |
| `frequencia_hz` | Hz | `60` |
| `numero_polos` | int | `2` |

## Mecânicos

| Campo | Unidade | Exemplo (W22) |
|---|---|---|
| `carcaca` | string | `100L` |
| `potencia_kw` | kW | `2.2` |
| `potencia_cv` | cv | `3` |
| `rotacao_sincrona_rpm` | RPM | `3600` |
| `rotacao_nominal_rpm` | RPM | `3525` |
| `escorregamento_pct` | % | `2.08` |
| `forma_construtiva` | string | `B3D` |
| `fixacao` | string | "Com pés" |
| `flange` | string | "Sem" |
| `caixa_ligacao_posicao` | string | "Posição esquerda" |
| `refrigeracao` | string | `IC411 - TFVE` |
| `grau_protecao` | string | `IP55` |
| `sentido_rotacao` | string | "Ambos" |
| `massa_kg` | kg | `38.6` |
| `nivel_ruido_dba` | dB(A) | `72.0` |

## Térmicos / Ambientais

| Campo | Unidade | Exemplo (W22) |
|---|---|---|
| `classe_isolamento` | string | `F` (limite 155 °C) |
| `elevacao_temperatura_k` | K | `105` |
| `regime_servico` | string | `S1` |
| `temperatura_ambiente_min_c` | °C | `-20` |
| `temperatura_ambiente_max_c` | °C | `40` |
| `altitude_max_m` | m | `1000` |

## Mancal / Rolamento

| Campo | Exemplo (W22) |
|---|---|
| `mancal_dianteiro_tipo` (DE) | `6206 ZZ` |
| `mancal_traseiro_tipo` (NDE) | `6206 ZZ` |
| `vedacao_dianteiro` | V'Ring |
| `vedacao_traseiro` | V'Ring |
| `carga_axial_kgf` | `26` kgf |

## Construtivos

| Campo | Exemplo (W22) |
|---|---|
| `material_carcaca` | "Ferro fundido FC-200 (EN GJL 200)" |
| `material_eixo` | "Aço carbono SAE 1040/45" |
| `material_ventilador` | Plástico |
| `pintura` | "RAL 5009 207A (ISO 12944 - C3)" |
| `tipo_aterramento` | Único |
| `capacitor` | "Partida + permanente" |
| `sistema_partida` | Centrífugo |
| `vedacao` | "V'Ring (líquidos e poeira)" |

## Manutenção

| Campo | Exemplo |
|---|---|
| `ultima_manutencao` | `2026-02-15` |
| `proxima_manutencao` | `2026-08-15` |
| `fator_servico` | `1.15` |

---

## Sensores associados (tabela `sensor_definition`)

Cada equipamento possui N sensores 4-20 mA. Para o W22 (MTR-001) foram
definidos 5 sensores cobrindo as grandezas exigidas no requisito:

| sensor_key | Display | Unidade | Range físico | Nominal | Warn | Crit |
|---|---|---|---|---|---|---|
| `voltage` | Tensão | V | 0–300 | 220 | 240 | 260 |
| `current` | Corrente | A | 0–30 | 12.5 | 18 | 25 |
| `temperature` | Temp. enrolamento | °C | -20–200 | 75 | 130 | 155 |
| `rpm` | Rotação | RPM | 0–4000 | 3525 | 3700 | 3800 |
| `vibration` | Vibração | mm/s | 0–20 | 1.8 | 4.5 | 7.1 (ISO 10816) |

Range raw: 4 mA → physical_min, 20 mA → physical_max. Abaixo de 3.5 mA:
sensor offline (cabo rompido / desconectado).

---

## Observações sobre o schema

- **Tensão e corrente como string:** o W22 tem múltiplos taps (paralelo/série),
  então o cadastro guarda a string original do datasheet (`110-127/220-254 V`).
  Para uso operacional, o sensor reporta o tap em uso via `voltage` (numérico).
- **Datas em ISO 8601:** todas as colunas `*_at`, `*_manutencao`, `ts` seguem
  ISO 8601 (UTC) para compatibilidade com TimescaleDB no futuro.
- **Migrations:** schema é idempotente (`CREATE TABLE IF NOT EXISTS`). Para
  evoluir, criar arquivo `migrations/NNNN-description.sql` (não implementado
  nesta sprint — out of scope).
