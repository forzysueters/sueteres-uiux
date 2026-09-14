# Anomalia-Motor — Serviço de Anomalia de Ativos (Forzy Digital Twin)

Microserviço Python/FastAPI que detecta anomalias de operação e calcula um **Índice de Saúde (0–100)**
a partir de leituras de sensores (velocidade, aceleração, temperatura). Foi extraído do protótipo de
pesquisa (`notebooks/manutencao_preditiva_motores.ipynb`) e empacotado como um serviço independente,
no mesmo padrão do serviço de OCR do [Forzy Digital Twin](../ocr), porém na
porta **8001**.

Dois modelos pré-treinados, versionados em `models/`:

| Modelo | Arquivo | Uso |
|---|---|---|
| **Classificador supervisionado** (principal) | `classifier.joblib` · `model_card.json` | Diagnóstico da planta: severidade + Índice de Saúde de qualquer ativo com limites cadastrados |
| Baseline não supervisionado | `baseline.joblib` | Janelas sem limites, em unidade bruta dos motores do dataset |

## Classificador supervisionado (`train_classifier.py`)

O log IO-Link tem ~4 h de dois motores saudáveis e nenhum rótulo. O pipeline:

1. **Data augmentation** (`src/model/augment.py`), 38 mil janelas de 5 min em 10 famílias: recortes
   reais projetados em 3 classes de limite ISO, dinâmica real reposicionada em outro nível de
   severidade, rampa térmica, deriva de vibração, picos intermitentes, perda de amostras, canal
   ausente, distorção temporal e o cenário da planta simulada (fórmula de `synthetic_tick`).
2. **Etapa não supervisionada**: K-Means (k=4) sobre os atributos, nomeado pela saúde média e
   comparado ao rótulo normativo.
3. **Rotulagem** pela régua normativa (`src/model/normative.py`): posição do valor entre os limites
   do sensor, penalidade por canal, "OR probabilístico" e cortes 85/65/45 — a mesma do avaliador SQL.
4. **HistGradientBoosting** para severidade e para o Índice de Saúde, sobre 32 atributos por janela.

Métricas da geração atual (reproduzíveis com `python train_classifier.py`):

| Avaliação | Resultado |
|---|---|
| Holdout estratificado (20%) | acurácia 0,995 · F1 macro 0,993 · MAE saúde 0,21 |
| Motor não visto (treino só m1, teste m2) | acurácia 1,000 · MAE saúde 0,11 |
| Perfis do cenário da planta (ok/info/alerta/crítico) | concordância 1,000 em todos |
| K-Means × rótulo normativo | ARI 0,44 — separa bem ok e crítico; info e alerta se misturam sem supervisão |

A última linha é o motivo da etapa supervisionada: sem rótulo, os dados sozinhos não distinguem
"desvio leve" de "desvio relevante".

### Na aplicação

`python -m src.worker` lê a janela de cada ativo no Supabase (`model_scoring_window`), classifica e
publica (`publish_model_score`, migração 0023). O avaliador SQL da 0018 cede o ativo enquanto houver
predição do classificador com menos de 7 min, e reassume se o worker parar. No Docker Compose, o
serviço `anomaly-worker` roda esse laço. O front também envia `limits` no `POST /anomaly/score`,
então o caminho do navegador usa o mesmo classificador.

## Baseline não supervisionado

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
pip install -r requirements.lock
pip install -r requirements-dev.txt  # somente desenvolvimento/testes

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

## Integração com o Forzy

O serviço já faz parte do monorepo em `services/anomaly`, é iniciado pelos scripts `start-all` na porta 8001 e é consumido pelo frontend em `apps/web/src/services/anomalyAPI.ts`. A URL pode ser alterada por `VITE_ANOMALY_API_URL`.

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
