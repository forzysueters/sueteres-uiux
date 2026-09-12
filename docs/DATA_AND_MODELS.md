# Dados e modelos versionados

Este inventário torna explícitos os artefatos binários ou de dados necessários à demonstração. Ele não substitui a comprovação de origem e licença.

| Artefato | Finalidade | Reprodução | Situação de proveniência |
| --- | --- | --- | --- |
| `services/anomaly/data/History_32026-05-19T11-46-10-920.csv` | Histórico saudável usado pelo detector | Entrada de `train_baseline.py` | Confirmar origem, autorização e ausência de dados pessoais antes de distribuição pública |
| `services/anomaly/models/baseline.joblib` | Baseline carregado pela API | `python train_baseline.py` | Derivado do CSV acima; registrar versão do código e ambiente em uma nova geração |
| `services/anomaly/notebooks/manutencao_preditiva_motores.ipynb` | Pesquisa e validação exploratória | Executável com dependências científicas compatíveis | Revisar outputs e metadados antes de publicação |
| `apps/web/public/models/motor.glb` | Representação 3D na planta | Não há pipeline de geração no repositório | Autoria/licença externa precisa ser confirmada antes de redistribuição pública |

## Política

- Não versionar imagens OCR brutas, exports de produção, secrets ou dados pessoais.
- Modelos novos devem registrar dataset de origem, data, código de treinamento, versões das dependências e métricas reproduzíveis.
- Arquivos grandes gerados devem ir para um registry de modelos ou armazenamento de releases; mantenha no Git apenas o mínimo necessário à avaliação.
- Se a autorização de um artefato não puder ser comprovada, substitua-o por uma amostra sintética ou remova-o antes de tornar o repositório público.
