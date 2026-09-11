# Anomalia-Motor — Serviço de Anomalia de Ativos (Forzy Digital Twin)

Microserviço Python/FastAPI que detecta anomalias de operação e calcula um **Índice de Saúde (0–100)**
a partir de leituras de sensores (velocidade, aceleração, temperatura). Foi extraído do protótipo de
pesquisa (`notebooks/manutencao_preditiva_motores.ipynb`) e empacotado como um serviço independente,
no mesmo padrão do serviço de OCR do [Forzy Digital Twin](../) (`ocr/OCR-Model-main/`), porém na
porta **8001**.

Usa **um único modelo pré-treinado** (`models/baseline.joblib`), aprendido a partir do histórico
saudável em `data/` (os dois motores empilhados como exemplos de operação normal). O mesmo modelo é
aplicado a qualquer ativo — não há treino por ativo.

## Como funciona

Detecção **não supervisionada**: o modelo aprende o comportamento *normal* e mede o quanto cada novo
ponto se afasta dessa referência.

- **Isolation Forest** sobre atributos de operação (valor + desvio móvel de cada canal, taxa térmica, *duty cycle*) → pontos atípicos.
- **Modelo térmico (Ridge)** que prevê a temperatura *esperada* dada a carga; o resíduo (real − esperado) sinaliza aquecimento não explicado.
- **Índice de Saúde 0–100** suavizado, com penalidade que só cresce além da fronteira do normal (calibrada nos próprios dados saudáveis).
- **Severidade** alinhada ao frontend (`ok` / `info` / `alerta` / `critico`) e **insight preditivo** textual acionável.

## Estrutura

```
src/
  api/main.py        # FastAPI: GET /health, POST /anomaly/score
  model/
    features.py      # reamostragem + atributos de operação
    baseline.py      # fit_baseline (aceita vários segmentos) + score do Índice de Saúde
    insight.py       # gerador de insight preditivo (regras)
    persistence.py   # salvar/carregar o modelo único (joblib)
  data_loader.py     # parser do CSV IO-Link + conversão de leituras da API
  schemas.py         # contratos Pydantic
  config.py          # limiares, porta, caminhos (via env)
train_baseline.py    # treina models/baseline.joblib a partir de data/
models/baseline.joblib  # modelo pré-treinado (versionado)
data/                # CSV IO-Link de exemplo (histórico saudável)
notebooks/           # protótipo/validação original (motor saudável vs. degradação injetada)
tests/               # pytest (features, baseline, API)
```

## Como rodar

```bash
py -3.10 -m venv .venv
source .venv/Scripts/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# (opcional) re-treinar o modelo a partir de data/ — já vem treinado no repo:
python train_baseline.py

uvicorn src.api.main:app --port 8001
```

Testes: `pytest`

## Endpoints

| Método | Rota              | Descrição |
|--------|-------------------|-----------|
| GET    | `/health`         | Status do serviço e se o modelo está carregado. |
| POST   | `/anomaly/score`  | Pontua uma janela de leituras recentes e devolve saúde + severidade + insight. |

### `POST /anomaly/score`

```json
{
  "asset_tag": "MTR-001",
  "readings": [
    {"timestamp": "2026-05-19T11:46:10", "sensors": {"velocity": 0.04, "acceleration": 0.0, "temperature": 27}},
    {"timestamp": "2026-05-19T11:46:20", "sensors": {"velocity": 6.8, "acceleration": 0.48, "temperature": 34}}
  ]
}
```

`asset_tag` é **opcional** (apenas rótulo ecoado na resposta; o modelo é compartilhado).
`readings` é uma janela recente do ativo (ex.: últimos 10–30 min). Resposta:

```json
{
  "asset_tag": "MTR-001",
  "timestamp": "2026-05-19T15:43:10",
  "health_index": 51.1,
  "health_min": 51.1,
  "anomaly_score": 0.0,
  "severity": "alerta",
  "insight": "Desvio relevante de forma sustentada (saúde 51/100): resíduo térmico de +15.9°C acima do esperado para a carga (aquecimento não explicado). Agendar inspeção preventiva.",
  "thermal_residual": 15.9,
  "sustained": true
}
```

- `health_index` — saúde **no instante atual** (para o gauge em tempo real).
- `health_min` — pior saúde na janela avaliada; justifica a severidade quando o instante atual já se recuperou.
- `severity` — reflete o pior estado sustentado da janela (`ok`/`info`/`alerta`/`critico`).
- Modelo ausente (`models/baseline.joblib` não gerado) → **503** com instrução para rodar `train_baseline.py`.

## Validação

O notebook (`notebooks/`) contém a validação original: motor saudável vs. degradação injetada
(superaquecimento na fase de resfriamento). Os testes (`tests/test_baseline.py`, `tests/test_api.py`)
reproduzem essa validação com o modelo empacotado: o detector dispara alerta sustentado diante de um
superaquecimento claramente anômalo, **mesmo sem a temperatura cruzar um limite absoluto** — algo que
um alarme de limite fixo não detectaria.

## Integração com o Forzy (trabalho no repo principal)

1. Colocar esta pasta no monorepo (ex.: `anomaly/Anomaly-Model-main/`), espelhando `ocr/OCR-Model-main/`.
2. Adicionar o serviço ao `start-all.bat` / `start-all.sh` na porta 8001.
3. Criar `src/services/anomalyAPI.ts` no frontend (análogo a `ocrAPI.ts`) apontando para `http://localhost:8001`.
4. Mapear `ScoreResponse` para os componentes existentes: `health_index`/`severity` no `SensorGauge` e no "score de anomalia" do Dashboard; `severity`/`insight` na `AlertsPage` e no "insight preditivo de IA".
5. Reconciliar nomes de campo com `src/types/index.ts` do Forzy (as severidades já usam `critico`/`alerta`/`info`).

## Limitações (honestas)

- **Especializado em motores.** O modelo aprendeu as faixas de operação dos motores do dataset e usa
  valores **absolutos** de sensor. Aplicá-lo a ativos com faixas muito diferentes (ex.: um compressor
  operando a 60°C) tende a marcar tudo como anômalo. Para bombas/compressores/exaustores, o ideal é
  treinar um modelo próprio com o histórico saudável desses ativos, ou normalizar as leituras à faixa
  de cada ativo antes de pontuar (evolução futura).
- **Sensibilidade sem acoplamento.** O protótipo detectava desvios sutis comparando os dois motores
  entre si (`temp_div`). Ao generalizar para um ativo isolado, essas features foram removidas — o
  detector pega superaquecimentos claros, mas pode não pegar deriva térmica marginal (dentro do ruído
  de ~3°C do baseline).
- **Sem rótulos de falha:** não prevê Vida Útil Remanescente (RUL); exige histórico *run-to-failure*.
- **Resolução:** temperatura em passos de 1°C e amostragem irregular limitam a sensibilidade fina.
- **Vibração agregada:** a aceleração vem agregada (~0.6 s), insuficiente para análise espectral (FFT).
