# 📘 Challenge FIAP × Forzy / Promon — Contexto Completo do Projeto

> **Documento mestre de contexto.** Consolida toda a informação fornecida pela
> Forzy / Promon e pelos professores: requisitos oficiais, mapa mental do
> challenge, transcrição da reunião de briefing e a estrutura técnica
> proposta. Use este arquivo como referência única para qualquer decisão de
> escopo, arquitetura, design ou priorização.
>
> **Última atualização:** 2026-04-29
>
> **Fontes consolidadas:**
> - `Challenge - Forzy - Informações-Requisitos.pdf` (slides oficiais)
> - `Challenge - Forzy-Promon - Mapa Mental.pdf` (visão por sprint)
> - Transcrição da reunião de apresentação do challenge (Lília RH, Rogério Diretor, Leandro Augusto Visão Computacional)
> - `d:/Desktop/forzy/estutura.md` (estrutura vencedora previamente desenhada)

---

## 1. Tema e Visão Geral

**Tema:** Solução de **Digital Twin** para **monitoramento e predição de
manutenção** de motores elétricos industriais, integrando **IoT + LLM + Visão
Computacional + RPA + Machine Learning**.

**Frase-síntese:** *"Função antes da forma. Resolver o problema real da
indústria. Isso é o que a Forzy quer ver."* — Leandro Augusto.

**O que faremos (Forzy):**
> Desenvolver uma solução completa em módulos para registro de dados de
> equipamentos/ativos de uma planta industrial em uma plataforma que permita
> a visualização dos dados em tempo real, e permita o acompanhamento de
> manutenção e detecção de anomalias operacionais.

---

## 2. Quem é o Cliente — Grupo Promon e Forzy

### Composição do grupo
- **Profissionais Acionistas** (topo) — parte dos profissionais detém ações.
- **Promon Engenharia** (1960, 65+ anos) — projetos industriais e
  infraestrutura, mais de 3.000 projetos, atuação em 40+ países.
- **Forzy** — empresa mais nova do grupo (~1 ano). Foco em **eficiência
  operacional/energética** e **digitalização de ativos**. Esta é a empresa do
  challenge.
- **Educação e Engenharia** — formação em construção.
- **Logicalis** — 31,5%, serviços de TI/comunicação.
- **Fundação de previdência** — entidade associada.

### Setores de atuação Forzy
1. Industrial
2. Energético
3. Infraestrutura
4. Imobiliário

### Missão Forzy
> Facilitar a jornada das empresas para um futuro mais eficiente e
> simplificado, conectando o físico e o digital.

### Forzy Lab
- Laboratório dedicado a inovação e experimentação localizado na **JK
  (Av. Pres. Juscelino Kubitschek)**, em frente ao Shopping Iguatemi/JK,
  perto da estação Vila Olímpia da linha esmeralda da CPTM (~1 km).
- Possui: motor 220V (monofásico, com peso/carga), série de sensores reais,
  IoT integrado a AWS, óculos de realidade virtual/aumentada.
- Visitas combinadas; **não fica aberto livremente** (é local de trabalho).

### Stakeholders citados na reunião
| Pessoa | Papel |
|---|---|
| **Lília** | Business Partner de RH — Promon Group |
| **Rogério** | Diretor Forzy / Promon (na empresa há 34 anos) |
| **Leandro Augusto Guilherme** | Professor de Visão Computacional FIAP + responsável por IA na Forzy |
| **Prof. André** / **Prof. Godoi** | Coordenação FIAP |

---

## 3. Conceitos-chave — Maturidade do Gêmeo Digital

A Forzy considera Digital Twin uma **jornada em 4 níveis**:

| Nível | Nome | Descrição |
|------|------|-----------|
| **1** | Descritivo | Representação estática + base de dados única (única fonte de verdade) |
| **2** | Operacional | Dados em tempo real via IoT integrados ao gêmeo |
| **3** | Preditivo / Prescritivo | Algoritmos ML/AI preveem falhas e otimizam manutenção |
| **4** | Autônomo | Operação autônoma, IA toma decisões sem intervenção humana |

**Realidade da indústria nacional:** 90%+ está no nível 1. **Meta do challenge:**
percorrer do nível 1 ao nível 3+ (parcialmente nível 4 com agente
conversacional).

**Referência cultural:** Fórmula 1 (Oracle/Red Bull, Dell/McLaren) usa gêmeos
digitais em escala industrial.

### Cases reais Forzy (citados)
- **Suzano/Aalco** — projeto Sucuriú (MS): maior planta de celulose do mundo,
  Forzy gerencia base única de dados e padroniza disciplinas (civil,
  mecânica, elétrica, processo, instrumentação).
- **Syngenta** (Paulínia) — defensivos agrícolas, projeto de realidade
  aumentada.
- **Ultragaz** — modelo 3D de bases de envasamento, padronização replicável
  para todas as unidades.

---

## 4. Objetivos do Challenge

1. **Front-end Web amigável** capaz de integrar soluções de manutenção
   preventiva e preditiva.
2. **Agente LLM multimodal** especialista no datasheet de motores elétricos,
   capaz de responder de forma amigável.
3. **Solução IoT** capaz de obter dados de fenômenos físicos de motores
   elétricos.

---

## 5. Problemas Identificados (Dores do Cliente)

1. Dados operacionais do motor **não são estruturados** de forma histórica e
   padronizada.
2. Informações técnicas do ativo dependem de **leitura manual da placa**, com
   cadastro pouco automatizado.
3. Falta **visualização navegável e contextualizada** da planta e ativos.
4. Operação **sem inteligência preditiva** para anomalias e manutenção.
5. Conhecimento técnico dos documentos **não está integrado** ao suporte
   operacional nem à governança.

---

## 6. User Stories Oficiais (do PDF de Requisitos)

### 6.1 Geral
- **Eu, Forzy**, quero estruturar a solução em **módulos**, para flexibilidade
  na implantação completa ou parcial.
- **Eu, usuário**, quero uma **interface amigável e intuitiva** que permita
  navegação e configuração para oferecer a plataforma a diferentes clientes
  da indústria.

### 6.2 Extração — Sensores do Motor
> Extrair via interface IoT (**OPC-UA**) tensão, corrente, temperatura,
> rotação e vibração de motor industrial 220V com TAG.

- **Eu, Forzy**, quero módulo que leia a informação **raw** e insira em base
  histórica.
- **Eu, Forzy**, quero que os dados sejam **processados** para o sistema
  métrico (V, A, RPM, °C, etc).

### 6.3 Registro de Equipamento — OCR da Placa
> Por foto da placa de dados, extrair informações para cadastro automático.

- **Eu, técnico em manutenção**, quero módulo que **leia a imagem da placa**
  e extraia TAG + dados técnicos (tipo de motor, tensão de trabalho, ligação,
  potência, polos, fabricante).

### 6.4 Interface — Navegação na Planta Baixa
> Criar **PDF inteligente** que permita navegação na planta baixa; ao clicar
> em um ativo, ver dados em tempo real (1 leitura/min, exemplo).

- **Eu, técnico em manutenção**, quero que a **planta baixa** seja convertida
  em artefato digital com elementos navegáveis.
- **Eu, técnico em manutenção**, quero **valores atuais + gráficos
  temporais** para visualização histórica e monitoramento do estado atual.

### 6.5 Modelagem — 3 Modelos ML Encadeados
> A partir de histórico, modelo que alerta sobre desvios e sugere momento de
> manutenção.

- **Eu, Forzy**, quero modelo de ML para **baseline de operação**.
- **Eu, Forzy**, quero modelo de ML que **preveja anomalias** (alertas fora
  do esperado).
- **Eu, Forzy**, quero modelo de ML que com base em histórico + dados do
  fabricante **preveja momento de parada para manutenção** (planejar paradas
  estratégicas).

### 6.6 Integração com LLM — RAG para Troubleshooting
> Ler documentos do ativo e permitir interação textual (manuais, docs
> técnicos).

- **Eu, técnico em manutenção**, quero sistema **conversacional** para
  recuperar dados de manuais em caso de falhas/anomalias.
- **Eu, técnico em manutenção**, quero que dado o **estado atual** do
  equipamento, o sistema sugira a melhor solução para a falha apresentada.

### 6.7 Governança
> Estrutura de dados + controles (acesso, hierarquias, segurança).

- **Eu, usuário de TI**, quero sistema de governança que permita
  operacionalizar acessos e dados de forma estruturada para atender
  **requisitos regulatórios e de segurança**.

---

## 7. Mapa Mental por Sprint (PDF Oficial)

### Sprint 1 — Fundamentos do Ativo e da Base de Dados
**Objetivo:** estruturar base do projeto, captura inicial, cadastro técnico,
organização das primeiras informações.

**Entregas:**
- Leitura inicial dos dados brutos do ativo
- Conversão para unidades compreensíveis
- Definição dos campos técnicos do cadastro
- Base inicial de histórico operacional
- Definição de quais dados da placa serão extraídos por imagem

**Por disciplina:**
- **AI for RPA:** automações iniciais para coleta/registro/atualização
- **Generative IA & Advanced Net:** estruturar dados, definir pipeline ML/DL
  e base RAG
- **NLP:** organizar descrições técnicas, nomenclaturas
- **Front End:** interface inicial de cadastro e visualização básica
- **Visão Computacional:** definir estratégia de leitura da placa
- **Governança IA:** critérios de organização, rastreabilidade, acesso, uso
  responsável
- **IoT:** captura, transmissão, armazenamento e visualização inicial

### Sprint 2 — Visualização Operacional e Representação do Ativo
**Objetivo:** transformar a base em experiência visual de navegação,
localizar equipamento, associar à TAG, acompanhar estado operacional atual e
histórico.

**Entregas:**
- Estrutura inicial de navegação por planta/área/ativo
- Associação ativo ↔ TAG ↔ localização
- Exibição dos valores atuais
- Gráficos temporais com dados históricos
- Interface de consulta operacional
- Definição de como dados da placa se associam ao cadastro

**Por disciplina:**
- **AI for RPA:** automatizar atualização de registros e associações
- **Generative IA:** treinar ML/DL com dados operacionais → baseline
- **NLP:** atributos textuais e termos técnicos para consultas simples
- **Front End:** navegação por ativo/TAG + telas de monitoramento
- **Visão Computacional:** representação visual da planta + integração leitura
- **Governança:** clareza, rastreabilidade, controle de exibição
- **IoT:** unir captura/histórico/dashboards e alimentar ML/DL

### Sprint 3 — Inteligência Operacional e Apoio à Decisão
**Objetivo:** capacidade analítica para identificar desvios e iniciar alertas.

**Entregas:**
- Definição do baseline inicial
- Identificação de desvios/anomalias via ML/DL
- Geração de alertas operacionais
- Acompanhamento do estado do equipamento
- Apoio inicial à decisão de manutenção
- Uso das informações da placa no contexto técnico

**Por disciplina:**
- **AI for RPA:** registro de eventos, atualização de status
- **Generative IA:** ML/DL para baseline + detecção de anomalias
- **NLP:** resumos textuais de alertas/desvios/estados
- **Front End:** alertas, estados de risco, histórico de eventos
- **Visão Computacional:** continuação da leitura da placa
- **Governança:** limites de interpretação dos alertas + supervisão humana
- **IoT:** coleta contínua + envio de alertas integrado ao ML/DL

### Sprint 4 — Integração da Solução
**Objetivo:** consolidar tudo — monitoramento, histórico, consulta a docs,
apoio conversacional, governança.

**Entregas:**
- Integração de todos os módulos
- Consulta a documentos e informações técnicas
- Protótipo conversacional para troubleshooting
- Recomendação inicial baseada em IA + outcome dos modelos
- Solução final navegável, modular e demonstrável

**Por disciplina:**
- **AI for RPA:** automações finais de registro/ocorrências/fluxo operacional
- **Generative IA:** **arquitetura RAG** combinando sensores + histórico +
  documentação técnica
- **NLP:** experiência conversacional de consulta a manuais/troubleshooting
- **Front End:** integrar navegação + monitoramento + alertas + assistente em
  uma única interface
- **Visão Computacional:** versão funcional da leitura da placa
- **Governança:** regras mínimas de acesso, rastreabilidade,
  responsabilidade, segurança
- **IoT:** pipeline integrado completo (captura → armazenamento → dashboard
  → alertas → alimentação RAG)

---

## 8. Os 6 Módulos Funcionais (Estrutura Técnica)

> Mapa entre user stories oficiais e implementação modular sugerida.

### MÓDULO 1 — Ingestão e Processamento de Dados IoT
| Item | Detalhe |
|------|---------|
| Sensores físicos | Tensão, corrente (4-20 mA), temperatura, rotação (RPM), vibração |
| Conversão | Raw (4-20 mA) → unidades reais via regra de 3 com range |
| Protocolo | **OPC-UA** + **MQTT** (AWS IoT) → Consumer Python → DB |
| Tag do ativo | Identificador tipo `MTR-001` |
| Banco | PostgreSQL + **TimescaleDB** (séries temporais) |
| Frequência | 1-5s |

**Diferencial:** validação na ingestão (detectar leituras fora de range,
sensor desconectado = 0 mA vs 4 mA mínimo).

### MÓDULO 2 — OCR de Placas (Visão Computacional)
| Item | Detalhe |
|------|---------|
| Input | Foto da placa do motor |
| Saída | Tensão, potência, RPM, ligação, polos, fabricante |
| Abordagem 1 | PaddleOCR / EasyOCR + regex |
| Abordagem 2 | **GPT-4 Vision / Claude Vision** para placas danificadas |
| Combinação | OCR primeiro, LLM valida/corrige |

**Exemplos de placas no PDF oficial:** WEG W22 132M (220/440V, 7.5 cv), Siemens
Three-Phase Asynchronous, Dutchi Motors DMA 100L4, Metalcorte.

### MÓDULO 3 — Interface (Supervisório + Navegação)
| Tela | Persona | Função |
|------|---------|--------|
| Login | Ambos | Autenticação |
| Dashboard | Técnico | Visão geral de status (verde/amarelo/vermelho) |
| Planta Navegável | Técnico | SVG/PDF interativo com hotspots → popup com gauges |
| Séries Temporais | Técnico | Histórico por sensor com filtro de data |
| Alertas | Técnico | Lista de anomalias com timestamp/severidade |
| Painel Admin | Forzy | Configuração de ativos, thresholds, modelos ML |
| OCR Upload | Técnico | Upload de foto → JSON estruturado |
| Chat | Técnico | Agente conversacional lateral |

**Estética:** Leandro foi explícito — **função antes da forma**. Não precisa
3D nem visual super-elaborado. Pode ser básico estilo SCADA/supervisório
(verde/amarelo/vermelho), desde que cumpra a função.

### MÓDULO 4 — Modelos de ML Encadeados
| Modelo | Objetivo | Abordagem | Métrica |
|--------|----------|-----------|---------|
| 1. Baseline | Comportamento normal | Random Forest / XGBoost / NN simples | RMSE, MAE |
| 2. Anomalia | Desvio do baseline | Isolation Forest / Autoencoder / Z-score dinâmico | F1, recall |
| 3. Predição | Tempo até manutenção | Survival Analysis / LSTM / classificação temporal | AUC, lead-time |

**Encadeamento:** baseline alimenta anomalia → anomalia alimenta predição.

### MÓDULO 5 — Agente Conversacional (LLM + RAG + Tools)
| Item | Detalhe |
|------|---------|
| Conhecimento | Manuais, procedimentos, histórico de falhas |
| Embeddings | Sentence Transformers / OpenAI embeddings |
| Vectorstore | **ChromaDB** ou FAISS |
| LLM | GPT-4 / Claude via API |
| Funcionalidades | RAG técnico + diagnóstico + recomendação + **function calling** ao DB |

**Diferencial:** agente com tools — consulta DB do motor + cruza com docs.
Exemplo: *"MTR-001 com vibração alta. Manual indica desbalanceamento.
Recomendo parada para inspeção em 48h."*

### MÓDULO 6 — Governança (Dados + IA)
| Item | Implementação |
|------|--------------|
| Auth | JWT + refresh token |
| RBAC | 3 perfis: **Admin (Forzy)**, **Técnico**, **Visualizador** |
| Audit Log | Quem acessou o quê, quando |
| LGPD | Consentimento, anonimização, direito ao esquecimento |
| AI Governance | **Model Cards** (propósito, dados, métricas, limitações, vieses), versionamento, SHAP/LIME |
| Data | Catálogo, linhagem, qualidade |

---

## 9. Hardware e Cenário Real do Lab

### O que tem no Forzy Lab
- **Motor industrial 220V monofásico** com peso/carga acoplado.
- **Sensores físicos:** tensão, corrente, rotação, vibração, temperatura.
- **IoT real:** régua de sensores + Siemens (concentrador) + interface para
  PC. Dados já estão na **AWS IoT**.
- **Sinal típico:** 4-20 mA (alguns sensores leem de 2 mA, mas faixa nominal
  é 4-20). Mais comum na indústria por estabilidade.

### Como serão fornecidos os dados ao time
1. **Pior caso:** tabela com dados extraídos.
2. **Melhor caso (intenção):** **endpoint** que entrega os dados ao vivo.
3. Forzy fornecerá: range do sensor (ex: -200 a +400 °C), faixa de leitura
   (4-20 mA), e a equação raw → unidade real (regra de 3).

### Plan B com FIAP Maker Lab (6º andar)
Caso necessário, FIAP fornece sensores Arduino + DHT11 + ventilador fora de
centro para simular vibração — só pra **entender** como o dado é coletado,
não para construir o sensor de produção.

### Esclarecimentos elétricos da reunião
- Sensor industrial entrega **CC** já compensada. **Não há** que se preocupar
  com fator de potência, defasagem, etc. **Não desenvolver** sensor nem
  conversor analógico-digital — usar pronto.

---

## 10. Stack Tecnológica Recomendada

| Camada | Tecnologia | Justificativa |
|--------|-----------|---------------|
| Backend | **Python + FastAPI** | Async, ótimo para ML |
| Frontend | **React + Vite + TypeScript + Tailwind** | (já em uso neste repo) |
| Banco relacional | **PostgreSQL + TimescaleDB** | Séries temporais nativas |
| Banco vetorial | **ChromaDB** | RAG simples e eficiente |
| ML | **scikit-learn + XGBoost** | Iteração rápida |
| Deep Learning | **PyTorch** (se necessário) | Autoencoder para anomalias |
| OCR | **EasyOCR + Claude/GPT-4 Vision** | Combo |
| LLM | **LangChain + OpenAI/Anthropic** | RAG + tools |
| IoT | **OPC-UA + MQTT + AWS IoT** | Padrão industrial |
| Real-time | **WebSocket (FastAPI)** | Dados ao vivo |
| Auth | **JWT + bcrypt** | Simples e seguro |
| Infra | **Docker Compose** | Reprodutível para demo |
| CI/CD | **GitHub Actions** | Automação básica |

> **Nota deste repo:** o frontend atual já está em **React 18 + Vite +
> TypeScript + Tailwind**, com `react-router-dom`, `zustand`, `recharts`,
> `lucide-react`, `axios`, `framer-motion`, `react-hook-form`, `zod`,
> `@tanstack/react-query`, `react-helmet-async`, `sonner`, `@radix-ui/*` e
> tooling completo (ESLint/Prettier/Vitest/Testing-Library).

---

## 11. Estrutura de Pastas Sugerida (Solução End-to-End)

```
digital-twin-forz/
├── docs/                # User stories, arquitetura, governança, manual
├── backend/             # FastAPI (routers, services, ml/, db/)
├── frontend/            # React (já existente neste repo)
├── iot/                 # Arduino + ingestão MQTT/OPC-UA + raw_converter
├── ml_notebooks/        # EDA, baseline, anomalia, predição, OCR
├── llm/                 # RAG pipeline, prompts, agent com tools
├── infra/               # docker-compose, nginx, .env.example
└── README.md
```

Ver `d:/Desktop/forzy/estutura.md` para árvore completa com todos os arquivos.

---

## 12. Cronograma — Macro

| Sprint | Período | Foco |
|--------|---------|------|
| 1 | Sem 1-2 | Setup, Docker, DB, mock ingestion, modelo de dados |
| 2 | Sem 3-4 | Conversão raw, TimescaleDB, dashboard básica, login |
| 3 | Sem 5-6 | Modelos baseline + anomalia, OCR, planta SVG navegável |
| 4 | Sem 7-8 | Modelo predição, integração AWS, alertas em tempo real |
| 5 | Sem 9-10 | Agente RAG + tools, painel admin Forzy |
| 6 | Sem 11-12 | Governança (RBAC, audit, model cards), testes, polimento |
| 7 | Sem 13-14 | Demo, documentação, apresentação |

**Datas-chave (citadas na reunião):**
- **30/Set** — tudo precisa estar funcionando para passar pra rodada de
  vencedores.
- **24/Out** — apresentação final ao Challenge / preparação NEXT.
- O **NEXT** (evento Promon/FIAP) só recebe o **time vencedor**, não top 3.

---

## 13. Diferenciais que Vencem o Challenge

### O que o júri valoriza
1. **Modularidade real** — cliente compra o que quiser (Forzy quer isso de
   forma explícita).
2. **Dados sujos da realidade** — outliers, ruído, sensor offline.
3. **Pipeline ML encadeado** (baseline → anomalia → predição).
4. **Agente que consulta dados reais** — não chatbot genérico.
5. **Foco em valor de negócio** — quanto economiza em paradas.
6. **Governança bem feita** — Model Cards, LGPD, audit log.
7. **Demo ao vivo convincente** com motor real.

### Extras que surpreendem
- Estimativa de custo de parada ("Se MTR-001 parar = R$ X/h").
- Simulador "e se a carga aumentar 20%?".
- Exportação de relatórios PDF.
- Notificações via email/webhook em anomalia crítica.
- Arquitetura preparada para N motores (mesmo demo com 1).

---

## 14. Roteiro de Apresentação Vencedora (45 min)

1. **Contexto** (2 min) — custo de paradas não planejadas
2. **Demo ao vivo** (15 min) — sistema funcionando com dados reais
3. **Arquitetura** (5 min) — diagrama mostrando modularidade
4. **ML explicado** (5 min) — pipeline encadeado + métricas
5. **Agente inteligente** (5 min) — cenário superaquecimento → solução
6. **Governança** (3 min) — RBAC, model cards, LGPD
7. **Valor de negócio** (5 min) — ROI quantificado
8. **Próximos passos** (2 min) — escalabilidade, roadmap

---

## 15. Entregáveis Oficiais

1. **Documentação em GitHub privado:**
   - Justificativas do problema e da solução
   - Propostas das soluções (diagramas + documentos)
   - Cronograma de implementação
   - Análise de pontos fortes e riscos de cada proposta
2. **Vídeo da Solução Desenvolvida** (YouTube, **não listado**, link no
   GitHub privado).
3. **MVP** com front e back-end **integrados e funcionais**, em servidor na
   nuvem ou local.

---

## 16. Diretrizes Importantes da Reunião

### Sobre escopo
- Os user stories são **régua mínima**, **não teto**. Pode propor extras se
  agregarem valor; pode discutir cortes se a disciplina não cobrir.
- A **persona** é obrigatória em toda story. Personas conhecidas: **Forzy
  (admin)**, **Técnico de Manutenção**, **Usuário de TI**.
- Foque sempre no **negócio** — toda feature deve gerar valor mensurável.

### Sobre a interface
- **Função > Forma.** Não precisa ser bonito; precisa funcionar.
- 3D **não é obrigatório**. Imagem estática + hotspots resolve.
- O pessoal da indústria está acostumado a SCADA — verde/amarelo/vermelho é
  suficiente.

### Sobre ML
- Os 3 modelos podem ser simples — **regressão logística é IA** no padrão
  atual de mercado. Não precisa deep learning sofisticado.
- O **encadeamento** é mais importante que a sofisticação isolada.

### Sobre comunicação
- **Teams da FIAP** é o canal principal com Leandro.
- WhatsApp: somente segunda a sexta — final de semana é descanso.
- **Não assediar professor de aula** com discussões do challenge na frente
  dos colegas (vaza ideia para concorrentes).

### Sobre o WAM (As-Built / "as is")
- Realidade industrial: a planta nunca está exatamente como o projeto
  original — peças trocadas em emergência sem atualizar documentação.
- Resolver isso é parte do valor da Forzy: trazer **base única de verdade**.
- O time pode usar imagens estáticas de planta + botões/hotspots clicáveis
  como "PDF inteligente" mencionado no requisito.

---

## 17. Glossário Rápido

| Termo | Significado |
|-------|-------------|
| **TAG** | Identificador único do ativo (ex: `MTR-001`). É o "RG/CPF" do equipamento |
| **OPC-UA** | Open Platform Communications Unified Architecture — padrão industrial de comunicação |
| **MQTT** | Protocolo leve de mensageria pub/sub usado em IoT |
| **4-20 mA** | Faixa padrão de sinal analógico industrial — 4 mA = mínimo válido (abaixo = sensor desconectado) |
| **As-Built** | Documentação atualizada conforme construído (vs projeto original) |
| **P&ID** | Piping and Instrumentation Diagram — esquemático de processo industrial |
| **RAG** | Retrieval-Augmented Generation — LLM que busca em base de docs antes de responder |
| **Model Card** | Documentação formal de um modelo ML (propósito, dados, métricas, limitações) |
| **SCADA** | Supervisory Control and Data Acquisition — supervisório clássico industrial |
| **Function Calling** | Recurso de LLM que permite invocar funções/APIs — chave para o agente consultar DB ao vivo |

---

## 18. Estado Atual deste Repositório (snapshot 2026-04-29)

### Stack instalada
- React 18 + Vite + TypeScript + Tailwind
- Roteamento: `react-router-dom` v7
- State: `zustand`
- Charts: `recharts`
- Icons: `lucide-react`
- HTTP: `axios`
- UI premium: `@radix-ui/*`, `framer-motion`, `class-variance-authority`,
  `tailwind-merge`, `tailwindcss-animate`
- Forms: `react-hook-form`, `zod`, `@hookform/resolvers`
- Data fetching: `@tanstack/react-query`
- SEO: `react-helmet-async`
- Toasts: `sonner`
- Tooling: ESLint, Prettier, Vitest + Testing Library

### Páginas existentes
- `Dashboard`, `PlantNavigation`, `AlertsPage`, `EquipmentPage`,
  `AssistantPage`, `SettingsPage`, `AccountPage`, `LoginPage`

### Componentes existentes
- `AIAssistant`, `AlertItem`, `AssetDetailPanel`, `Cards` (KPICard, AssetTile),
  `EquipmentRegistrationForm`, `ErrorBoundary`, `ProtectedRoute`,
  `SkeletonLoaders`, `TimeSeriesChart`, `TokenRefresher`, `UserProfile`

### Backend
- Pasta `server/` no repo, ainda não auditada em detalhe.

### Credenciais demo do front
| Role | Email | Senha |
|------|-------|-------|
| Admin | `admin@industrial.com` | `password123` |
| Engineer | `engineer@industrial.com` | `password123` |
| Technician | `technician@industrial.com` | `password123` |

---

*Documento mantido como fonte única de verdade. Atualizar sempre que houver
nova diretriz da Forzy/Promon, mudança de escopo, ou decisão arquitetural
relevante.*
