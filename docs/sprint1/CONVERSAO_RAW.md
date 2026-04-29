# Sprint 1 — Conversão Raw 4-20 mA → Unidades Físicas

> Especificação do serviço de conversão entre o sinal industrial padrão
> (4-20 mA) e as unidades do sistema métrico exigidas pelo requisito.

## Por que 4-20 mA

Padrão industrial dominante por três motivos práticos:

1. **Imunidade a ruído.** Sinais em corrente são pouco afetados por
   eletromagnetismo e quedas de tensão no cabo (importante em planta
   industrial com motores e inversores próximos).
2. **Detecção de falha.** A faixa 0–4 mA fica reservada como "sem
   sinal" — então cabo rompido, sensor desconectado ou alimentação
   ausente são detectáveis automaticamente.
3. **Loop simples.** Apenas dois fios alimentam e transmitem sinal.

> Confirmado pelo Leandro Augusto na reunião de briefing: *"O sensor
> industrial entrega CC já compensada. Não há que se preocupar com
> fator de potência, defasagem, etc."*

## Fórmula de conversão

Conversão linear (regra de 3) entre o range raw e o range físico do sensor:

```
ratio = (raw_mA - raw_min) / (raw_max - raw_min)
value = physical_min + ratio * (physical_max - physical_min)
```

Onde:
- `raw_min = 4`, `raw_max = 20` (constantes para todos os sensores 4-20 mA)
- `physical_min`, `physical_max` — calibração específica de cada sensor

### Exemplo prático

Sensor de tensão do MTR-001:
- `raw_min = 4 mA`, `raw_max = 20 mA`
- `physical_min = 0 V`, `physical_max = 300 V`

Leitura raw = 15.74 mA:

```
ratio = (15.74 - 4) / (20 - 4) = 0.7338
value = 0 + 0.7338 * (300 - 0) = 220.13 V
```

## Detecção de sensor offline

A constante `RAW_OFFLINE_THRESHOLD = 3.5` (em mA) é o limiar abaixo do
qual a leitura é tratada como **sensor desconectado**. Lemos 3.5 e não
4.0 para tolerar pequenas oscilações na fonte do loop.

```
if (raw_mA < 3.5) → status: 'offline', value: 0
```

## Classificação de status

Cada sensor tem dois thresholds opcionais:

- `threshold_warn` — limite de **atenção** (operação fora da zona ótima)
- `threshold_crit` — limite **crítico** (intervenção imediata)

Lógica:

```
if (value >= threshold_crit)  → 'critical'
else if (value >= threshold_warn) → 'warning'
else → 'normal'
```

## Calibração dos sensores do MTR-001

Derivado dos valores nominais do datasheet WEG W22 com folga operacional
realista. Os thresholds seguem boas práticas industriais.

| Sensor | Range físico | Nominal | Warn | Crit | Justificativa |
|---|---|---|---|---|---|
| Tensão | 0–300 V | 220 | 240 | 260 | ±10% em torno da nominal (220V tap) |
| Corrente | 0–30 A | 12.5 | 18 | 25 | Corrente nominal máxima do W22 = 25 A |
| Temperatura | -20–200 °C | 75 | 130 | 155 | Classe F = limite de 155°C; warn em 130 dá margem |
| RPM | 0–4000 | 3525 | 3700 | 3800 | Síncrona = 3600; alerta em overspeed |
| Vibração | 0–20 mm/s | 1.8 | 4.5 | 7.1 | **ISO 10816** zona A (boa)→C (insatisfatório)→D (inaceitável) |

## Implementação

```typescript
// server/src/services/sensor.service.ts
export function convertRawToPhysical(
  raw_mA: number,
  def: SensorDefinition,
): ConversionResult {
  if (raw_mA < RAW_OFFLINE_THRESHOLD) {
    return { value: 0, status: 'offline', unit: def.unit, display_name: def.display_name }
  }
  const span = def.raw_max - def.raw_min
  const ratio = (Math.min(Math.max(raw_mA, def.raw_min), def.raw_max) - def.raw_min) / span
  const value = def.physical_min + ratio * (def.physical_max - def.physical_min)
  return { value, status: classifyStatus(value, def), unit: def.unit, display_name: def.display_name }
}
```

## Auditoria

A tabela `sensor_reading` armazena **simultaneamente** o `value_raw`
(em mA) e o `value` (convertido). Isso permite:

- Rerodar a conversão se a calibração mudar (sem perder o histórico raw).
- Detectar erros de calibração: se o raw mudou mas o convertido continua
  igual ou vice-versa, há bug na pipeline.
- Auditar a integridade da pipeline IoT → DB para certificações.
