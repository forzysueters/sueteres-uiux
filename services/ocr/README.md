# OCR WEG W22

Sistema de OCR especializado em placas de identificação de motores elétricos WEG da linha W22 (IP55).

## Estrutura

- `src/` — código de produção (pré-processamento, OCR, pós-processamento, API)
- `notebooks/` — notebooks Colab para geração de dados e treinamento
- `data/` — dataset (não versionado)
- `models/` — modelos treinados (não versionados)

## Instalação

```bash
pip install -r requirements.txt
```

## API

```bash
uvicorn src.api.main:app --reload
```

Documentação: http://localhost:8000/docs

Nota: a implementação completa da API é adicionada na Fase 6.
