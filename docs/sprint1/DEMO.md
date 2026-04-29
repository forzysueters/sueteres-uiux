# Sprint 1 — Roteiro de Demonstração

> Pode-se demonstrar a Sprint 1 em ~5 minutos. O foco é mostrar que a
> **fundação do Digital Twin está completa** — pipeline IoT → DB → API →
> Front funcionando ponta-a-ponta com dados realistas.

---

## Pré-requisitos

```bash
# Backend
cd server && npm install && npm run dev
# Em outro terminal — Frontend
cd .. && npm install && npm run dev
```

Acesse `http://localhost:5173` e logue com credenciais demo.

---

## Roteiro (5 min)

### 1. **Mostrar o cadastro técnico** (1 min)

Navegar para **Cadastro** no menu superior.

> "Esta é a fundação. Cada equipamento da planta tem mais de 50 campos
> técnicos derivados do datasheet do fabricante. Aqui temos o motor de
> referência: WEG W22 3 cv, código 13887610, com todas as especificações
> elétricas, mecânicas, térmicas e de mancal."

Passar pelos blocos: Identificação → Elétricos → Mecânicos → Térmicos.
Destacar:
- Multi-tap de tensão (`110-127/220-254 V`)
- Classe de isolamento F (limite 155°C)
- Forma construtiva B3D, refrigeração IC411

### 2. **Trocar para a aba "Campos da Placa"** (1 min)

> "Esta tabela formaliza o que será extraído por OCR na Sprint 2. São
> 24 campos catalogados por categoria, com regex e prioridade. P1 são
> obrigatórios — o pipeline OCR/LLM tem que acertar 100%."

Passar pelos campos P1 de cada categoria.

### 3. **Telemetria ao vivo** (2 min)

Navegar para **Telemetria**.

> "Aqui está a leitura ao vivo. Cinco sensores 4-20 mA do motor, com
> tick a cada 2 segundos. Para cada um, mostramos o **raw** em
> miliampères como sai do sensor, e o **valor convertido** na unidade
> física."

Mostrar:
- Tensão ~220 V, raw ~15-16 mA
- Corrente ~12.5 A
- Temperatura ~75 °C
- RPM ~3525
- Vibração ~1.8 mm/s

> "O gerador mock injeta anomalias periodicamente — pode aparecer um
> spike, drift, ou simulação de sensor desconectado (raw < 4 mA = card
> fica vermelho com 'Offline'). Em produção, o backend recebe os dados
> via OPC-UA da AWS IoT — o serviço de conversão é o mesmo."

### 4. **Histórico operacional** (1 min)

Navegar para **Histórico**.

> "Toda leitura é persistida com raw + convertido + timestamp + status.
> Já temos 1 hora de histórico simulado pré-carregado. Filtros por
> sensor e janela de tempo (10 min, 1h, 6h, 24h). Estatísticas básicas
> (mín/máx/média) e exportação CSV — esta base alimentará os modelos
> de ML na Sprint 3."

Trocar entre sensores, mudar janela, exportar CSV.

### 5. **API behind the scenes** (1 min, opcional)

Em outro terminal:

```bash
curl http://localhost:3000/api/equipments/MTR-001/latest | jq
```

> "Tudo isso é REST. A mesma rota `POST /readings` que o mock usa,
> também aceita ingestão real do IoT da Forzy quando o endpoint da
> AWS estiver pronto."

```bash
curl -X POST http://localhost:3000/api/equipments/MTR-001/readings \
  -H "Content-Type: application/json" \
  -d '{"sensor_key":"voltage","value_raw":15.741}' | jq
```

> "Servidor faz a conversão (regra de 3) e responde com valor em V e
> status. Mesma pipeline."

---

## Pontos a destacar

- ✅ **Modular** — cada serviço (mock, conversion, persistence, API) é
  isolado. O cliente Forzy poderia desligar o mock e plugar OPC-UA real.
- ✅ **Auditável** — toda leitura tem raw + convertido + flag
  `is_simulated`. Cumpre requisito de governança de dados.
- ✅ **Realista** — anomalias injetadas (drift, spike, offline) garantem
  que não estamos demonstrando dados "limpos demais".
- ✅ **Pronto para Sprint 2** — `placa_field` já especifica os campos do
  OCR, `sensor_reading` já é a fonte para os modelos ML.

## Perguntas frequentes (esperadas no Q&A)

- **"E se o sensor cair?"** → Raw fica abaixo de 3.5 mA, status vai para
  `offline`, status do equipamento agrega para o pior status entre os
  sensores. Demonstrável esperando 1-2 minutos.
- **"Como muda a calibração?"** → Tabela `sensor_definition` tem
  `physical_min`, `physical_max`, `nominal_value`, `threshold_warn`,
  `threshold_crit` por sensor. Mudança em produção é UPDATE no banco —
  raw histórico fica intacto, basta rerodar a conversão.
- **"Por que SQLite e não PostgreSQL/TimescaleDB?"** → Sprint 1 é
  fundação. Schema é compatível com PostgreSQL — migração é trocar o
  driver e adicionar `CREATE EXTENSION timescaledb`. Para a demo, SQLite
  zera fricção operacional.
