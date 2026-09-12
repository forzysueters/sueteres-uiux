# OCR WEG W22

Serviço FastAPI para extrair e validar campos de placas de identificação de motores WEG W22. O pipeline combina correção de perspectiva, tratamento OpenCV, EasyOCR, regras de extração e validação física; um provedor de visão pode ser configurado como fallback.

## Estrutura

```text
src/api/              API, schemas e persistência local
src/preprocessing/    correção e melhoria da imagem
src/postprocessing/   extração, validação e fallback de visão
scripts/              avaliação e utilitários
tests/                testes pytest
data/                 amostras e datasets locais
notebooks/            experimentos de treinamento
```

Dados brutos, modelos baixados e resultados locais são ignorados pelo Git. Consulte `../../docs/DATA_AND_MODELS.md` antes de redistribuir os artefatos versionados.

## Instalação

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.lock
```

No Windows, ative com `.venv\Scripts\activate`.

Para desenvolvimento e testes, instale também:

```bash
pip install -r requirements-dev.txt
```

## Execução

```bash
uvicorn src.api.main:app --host 0.0.0.0 --port 8000
```

- `GET /health` informa o estado do serviço.
- `POST /ocr/extract` recebe JPEG, PNG ou WebP de até 10 MB.
- A documentação interativa fica em `http://localhost:8000/docs`.

As opções do fallback ficam em `.env.example`. Copie para `.env` e mantenha tokens fora do repositório.

## Qualidade e avaliação

```bash
pytest tests
ruff check --select E9,F63,F7,F82 src tests
python scripts/eval_real_images.py --help
```

O script de avaliação deve ser executado com um conjunto de imagens identificado. Não há uma métrica global declarada sem dataset, tamanho de amostra e saída reproduzível associados.

## Limitações

- O extrator é especializado no layout WEG W22 e pode exigir adaptação para outras placas.
- A inicialização pode baixar ou preparar pesos do EasyOCR.
- A API usa CPU por padrão e não promete latência de produção.
- O CORS permissivo atende ao desenvolvimento; restrinja as origens antes de expor o serviço publicamente.
