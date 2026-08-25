# Forzy — Metodologia completa do pipeline de Machine Learning

**Data:** 24/08/2026
**Base analisada:** `History_32026-05-19T11-46-10-920.csv` (sessão de 19/05/2026)
**Entregável:** `D:\Downloads\sueteres-uiux\eda_excel\forzy_kmeans_pipeline.ipynb`
**Referência metodológica:** Aula 4 — Pipeline de ML, Projeto Ford (slides + `ford_kmeans.ipynb`)

> Documento escrito para ser **questionado**. Cada decisão tem a justificativa e, quando
> existe, a alternativa que foi rejeitada e o porquê. A seção 11 lista os pontos onde o
> trabalho é mais frágil — leia ela antes de defender qualquer número daqui.

---

## Índice

1. [O dado de partida](#1-o-dado-de-partida)
2. [Diagnóstico: o problema não era falta de correlação](#2-diagnóstico-o-problema-não-era-falta-de-correlação)
3. [Decodificação do payload IO-Link](#3-decodificação-do-payload-io-link)
4. [Reamostragem: a grade de 5 segundos](#4-reamostragem-a-grade-de-5-segundos)
5. [A regra crítica: por que o pipeline não é circular](#5-a-regra-crítica-por-que-o-pipeline-não-é-circular)
6. [Base 1 — a janela futura](#6-base-1--a-janela-futura)
7. [K-Means: escolha de k e os perfis](#7-k-means-escolha-de-k-e-os-perfis)
8. [Base 2 — a janela passada](#8-base-2--a-janela-passada)
9. [Classificação e os dois testes](#9-classificação-e-os-dois-testes)
10. [Causa raiz do resultado baixo](#10-causa-raiz-do-resultado-baixo)
11. [Onde me questionar — pontos fracos conhecidos](#11-onde-me-questionar--pontos-fracos-conhecidos)
12. [O que se sustenta e o que não se sustenta](#12-o-que-se-sustenta-e-o-que-não-se-sustenta)
13. [Próximo passo](#13-próximo-passo)
14. [Tabela de referência rápida](#14-tabela-de-referência-rápida)

---

## 1. O dado de partida

Log exportado de um gateway IO-Link com dois pontos de medição (motor 1 e motor 2).

**Estrutura do arquivo** — 3 linhas de cabeçalho antes dos dados:

```
linha 1:  ;IOLM/Port 1/Attached Device/PDI Data Byte Array;IOLM/Port 2/...;4;5;6;7;8;9
linha 2:  ;PDI Data Byte Array;PDI Data Byte Array;1.1. Velocidade;1.2. Aceleração;
          1.3. Temperatura;2.1. Velocidade;2.2. Aceleração;2.3. Temperatura
linha 3:  ;Byte[];Byte[];Double;Double;Double;Double;Double;Double
linha 4+: dados
```

Por isso o `read_csv` usa `sep=";"` e `header=2`.

| item | valor |
|---|---|
| linhas de dados | 7.183 |
| período | 19/05/2026, 11:46:10 → 15:43:14 |
| duração | 237 min (~4 h) |
| colunas numéricas | 6 (V, A, T de cada motor) |
| colunas de bytes | 2 (uma por port) |
| valores nulos | 0 |

**Unidades** (já registradas no projeto, em `context_for_ai/eda_forzy_lab_maio.md` e na
migração `supabase/migrations/0014_iot_collector.sql`):

- **Velocidade** = velocidade de **vibração**, em **mm/s** — não é rotação do motor
- **Aceleração** = m/s²
- **Temperatura** = °C

Isso importa: os limiares da **ISO 10816-3** se aplicam diretamente.

| faixa | mm/s |
|---|---|
| aceitável | < 4,5 |
| alerta | 4,5 – 7,1 |
| **inaceitável** | **≥ 7,1** |

Medido nesta sessão:

| motor | máximo | % das leituras ≥ 7,1 | % ≥ 4,5 |
|---|---|---|---|
| 1 | 7,46 mm/s | 2,4 % | 31,7 % |
| 2 | 7,73 mm/s | 8,1 % | 32,8 % |

---

## 2. Diagnóstico: o problema não era falta de correlação

A hipótese inicial era *"não conseguimos achar correlações"*. A matriz de correlação
mostra o oposto:

```
      v1    a1    t1    v2    a2    t2
v1  1.00  1.00 -0.08  1.00  1.00 -0.26
a1  1.00  1.00 -0.09  1.00  1.00 -0.26
t1 -0.08 -0.09  1.00 -0.10 -0.09  0.95
v2  1.00  1.00 -0.10  1.00  1.00 -0.27
a2  1.00  1.00 -0.09  1.00  1.00 -0.26
t2 -0.26 -0.26  0.95 -0.27 -0.26  1.00
```

**PCA sobre as 6 colunas do Excel:**

```
variância explicada = [0.687, 0.307, 0.005, 0.001, 0.001, 0.000]
                       └────────────┘
                       2 componentes = 99,4 %
```

**Conclusão:** 6 colunas, ~2 dimensões reais de informação — *quanto vibra* e
*quão quente está*.

### Por que isso é um problema para o K-Means

O K-Means agrupa por **distância euclidiana**. Uma variável duplicada entra na conta
**duas vezes** e pesa o dobro. Com velocidade e aceleração praticamente idênticas, o
eixo "vibração" pesaria 2× o eixo "temperatura" — sem que ninguém tivesse decidido isso.

### Aceleração é velocidade reescalada

Medido apenas nas amostras em operação (V > 1):

| relação | valor |
|---|---|
| R² de A ~ V | **0,9735** |
| razão A/V (média) | 0,0746 |
| razão A/V (desvio) | 0,0075 |

97,4 % da variância da aceleração é explicada pela velocidade. **Não é uma hipótese a
testar — é uma identidade aritmética neste arquivo.**

> **Consequência importante:** a pergunta *"o motor quebra por velocidade ou por
> aceleração?"* **não pode ser respondida com este dataset**. As duas colunas são a
> mesma variável. Isso é limitação do dado exportado, não escolha de modelagem.
> No mundo real a distinção existe — aqui, não.

---

## 3. Decodificação do payload IO-Link

O documento anterior do projeto afirmava que os campos `PDI Data Byte Array` eram
*"status/protocolo, não é sinal de processo"*. **Isso estava errado** (já corrigido em
`context_for_ai/eda_forzy_lab_maio.md`).

### Como cheguei na estrutura

Contei os valores distintos em cada posição de byte, nas 7.183 linhas:

```
byte[ 0]  3 valores      byte[ 8]  2 valores
byte[ 1]  253 valores    byte[ 9]  92 valores
byte[ 2]  1 valor (100)  byte[10]  1 valor (1)
byte[ 3]  1 valor (0)    byte[11]  1 valor (0)
byte[ 4]  1 valor (0)    byte[12]  1 valor (0)
byte[ 5]  59 valores     byte[13]  18 valores
byte[ 6]  1 valor (1)    byte[14]  1 valor (1)
byte[ 7]  1 valor (0)    byte[15]  1 valor (0)
```

O padrão de bytes constantes a cada 4 posições revela a estrutura: **4 canais de 4 bytes**,
cada canal um inteiro de 16 bits big-endian seguido de bytes de status.

### Verificação

Linha real do arquivo, motor em operação:

```
2, 191, 100, 0, | 0, 55, 1, 0, | 0, 192, 1, 0, | 0, 32, 1, 0
└── canal 1 ──┘  └─ canal 2 ─┘  └─ canal 3 ─┘  └─ canal 4 ─┘
```

| canal | conta | resultado | coluna do Excel |
|---|---|---|---|
| 1 | (2×256 + 191) / 100 | **7,03** | Velocidade = 7,02 ✓ |
| 2 | 55 / 100 | **0,55** | Aceleração = 0,55 ✓ |
| 3 | 192 / 100 | **1,92** | **nenhuma** |
| 4 | 32 | **32** | Temperatura = 32 ✓ |

Correlação entre canal 1 decodificado e a coluna `v1`: **0,9996**. As pequenas
divergências são defasagem de amostragem — o byte array e a coluna escalar são
capturados em instantes ligeiramente diferentes. A decodificação está certa.

### O canal recuperado

| | motor 1 | motor 2 |
|---|---|---|
| faixa | 0 a 4,38 | 0 a 2,49 |
| R² vs Velocidade (em operação) | **0,652** | — |

Comparativo de redundância, em operação:

| canal | R² vs V | variância independente |
|---|---|---|
| Aceleração | 0,974 | 2,6 % — descartável |
| **Canal 3 (X)** | **0,652** | **34,8 % — sinal real** |
| Temperatura | 0,08 | independente |

**O canal 3 é a única variável mecânica com informação nova, e ele nunca foi exportado
para o Excel.** A unidade física depende do IODD do sensor — ainda não consultado.

---

## 4. Reamostragem: a grade de 5 segundos

### O problema

O sensor não entrega em ritmo fixo:

| medida | valor |
|---|---|
| mediana entre leituras | 0,59 s |
| média | 1,98 s |
| **máximo** | **228,4 s** (quase 4 min de silêncio) |

Trecho real, motor em operação:

```
13:45:35.558   7.02
13:45:36.560   7.02      ← duas leituras
13:45:36.910   7.02      ← no mesmo segundo
13:45:37.562   7.02
13:45:37.910   7.02
...
```

Isso inviabiliza qualquer estatística de janela. "Média dos últimos 30 segundos" seria
60 leituras num trecho e 2 leituras em outro. Os números não seriam comparáveis entre si.

### A solução

Dividi a linha do tempo em **baldes fixos de 5 segundos** e tirei a **média** do que caiu
em cada balde.

```
BALDE 13:45:35 → 13:45:40
  contém: 7.02  7.02  7.02  7.02  7.02  7.02  7.03  7.03
  saída:  7.021

BALDE 13:45:40 → 13:45:45
  contém: 7.01  7.01  7.02  7.02  7.00  7.00  7.00  7.02
  saída:  7.009

BALDE 13:45:45 → 13:45:50   →  7.033
BALDE 13:45:50 → 13:45:55   →  7.045
```

31 leituras irregulares em 15 segundos viram **4 linhas em ritmo constante**.

Baldes vazios (o buraco de 228 s) são preenchidos por **interpolação linear** — reta
entre o valor anterior e o seguinte.

### Resultado

**2.845 linhas por motor**, uma a cada 5 segundos, sem falha.
"Últimos 30 segundos" = sempre exatamente 6 linhas, em qualquer ponto do arquivo.

> Isso é normalização, não criação de dado. Nenhum valor foi inventado — só foi colocado
> em ritmo constante. **Exceção honesta:** as linhas geradas por interpolação dentro dos
> intervalos longos são estimativas, não medições. Elas caem em períodos de repouso
> (motor parado), onde o sinal é praticamente constante, então o risco é baixo — mas
> existe.

### Alternativas rejeitadas

| alternativa | por que não |
|---|---|
| usar o dado cru sem reamostrar | janelas móveis ficariam sem significado consistente |
| balde de 1 s | metade dos baldes ficaria vazia (mediana é 0,6 s, mas com caudas longas) |
| balde de 30 s | perderia a dinâmica de partida/parada, que dura 1-2 min |
| usar `last()` em vez de `mean()` | descartaria informação e amplificaria ruído pontual |

---

## 5. A regra crítica: por que o pipeline não é circular

### O risco

O plano original era: rodar K-Means para gerar rótulos, e depois treinar um modelo
supervisionado com esses rótulos.

**Se isso for feito sobre as mesmas colunas, é tautologia.** O modelo supervisionado não
aprende nada sobre a realidade — aprende a reproduzir a fronteira geométrica que o
K-Means desenhou. Uma acurácia alta nesse arranjo mede apenas o quanto uma árvore
consegue imitar uma partição de Voronoi.

Se perguntarem *"o que essa acurácia prova?"*, a resposta honesta seria:
*"que reproduzi meu próprio K-Means"*.

### Como a aula da Ford resolve isso

**Slide 7 — "A regra crítica: não misturar passado conhecido com futuro desconhecido"**

| | Etapa 1 (K-Means) | Etapa 2 (Classificador) |
|---|---|---|
| base | **Base 1** — histórico completo | **Base 2** — só o que existe na compra |
| variáveis | comportamento **futuro** observado | informação disponível **no instante 0** |

**Slide 18** é explícito: *"Features permitidas: informação disponível na venda.
Proibido: usar revisões futuras, gasto futuro, churn futuro ou satisfação futura como
entrada."*

**Os dois conjuntos de variáveis são disjuntos.** É isso — e só isso — que faz o
pipeline da Ford ser legítimo.

### A tradução para a Forzy

Na Ford são duas tabelas. Aqui é um stream temporal, então são duas **janelas de tempo**:

```
        passado                    linha atual                 futuro
   ├──────────────────┤                 ↓          ├─────────────────────┤
        BASE 2                          ●                  BASE 1
   (entra no modelo)                              (gera a resposta certa)
   46 variáveis                                    6 variáveis
```

|            | Ford                           | Forzy                                     |
|------------|--------------------------------|-------------------------------------------|
| **Base 1** | comportamento pós-venda (24 m) | janela **futura**: próximos 10 min        |
| **Base 2** | dados no momento da compra     | janela **passada**: últimos 30 s a 10 min |

**Verificação implementada no notebook** (etapa 10) — o código trava se houver vazamento:

```python
vazamento = set(FEATURES_B1) & set(FEATURES_B2)
assert not vazamento, "VAZAMENTO: a Base 2 contém variáveis da janela futura!"

futuras_na_b2 = [c for c in FEATURES_B2 if c.startswith("fut_")]
assert not futuras_na_b2
```

Saída da execução:

```
Variaveis em comum entre Base 1 e Base 2: NENHUMA
Features futuras dentro da Base 2: NENHUMA
  Base 1 (gera o target):    6 variaveis, todas do FUTURO
  Base 2 (entra no modelo): 46 variaveis, todas do PASSADO/PRESENTE
```

---

## 6. Base 1 — a janela futura

Para **cada** uma das 2.845 linhas de cada motor, olhei os **próximos 10 minutos**
(= 120 linhas de 5 s) e resumi em 6 números:

| variável | significado |
|---|---|
| `fut_T_max` | maior temperatura atingida no horizonte |
| `fut_T_delta` | variação de temperatura: `T(t+10min) − T(t)` |
| `fut_V_max` | maior pico de vibração |
| `fut_V_mean` | vibração média sustentada |
| `fut_A_max` | maior pico de aceleração |
| `fut_X_max` | maior pico do canal recuperado |

```
   linha atual                    próximos 10 min
        ↓          ├──────────────────────────────────────┤
   ...──●──────────────────────────────────────────────────
                   └──── resumo vira 6 números ────┘
```

A janela desliza de 5 em 5 segundos e repete.

**Implementação:** rolling reverso — inverte a série, aplica `rolling(120)`, desinverte.

### Por que 6 variáveis e não só temperatura

Esta foi uma correção de rumo importante. A primeira versão do plano fixava temperatura
como alvo. Isso estava errado: **um motor pode degradar por calor ou por vibração**, e
essa escolha não deve ser uma suposição minha.

Clusterizando a janela futura **inteira**, é o K-Means que revela qual variável separa os
perfis. A resposta vem da análise, não da premissa. (Ver seção 7.)

### Por que 10 minutos

| horizonte testado | f1 split aleatório | f1 split temporal |
|---|---|---|
| 2 min | 0,877 | 0,336 |
| 3 min | 0,939 | 0,325 |
| **10 min** | 0,909 | 0,308 |

O horizonte **não muda o diagnóstico** — a diferença entre os três é pequena e o
resultado temporal continua baixo em todos. Escolhi 10 min porque é o horizonte com
utilidade operacional (dá tempo de reagir a um alarme). **Não é uma escolha otimizada
por métrica**, e isso é proposital: otimizar horizonte contra a métrica seria escolher
o teste que dá o melhor número.

---

## 7. K-Means: escolha de k e os perfis

### Padronização

`StandardScaler` antes do K-Means. Motivo: o algoritmo trabalha com **distância**.
Temperatura chega a 46 e aceleração a 0,58 — sem padronizar, a temperatura dominaria o
agrupamento sozinha, por ter escala maior, não por ser mais informativa.

### Escolha de k

| k | inércia (SSE) | silhueta |
|---|---|---|
| 2 | 13.794 | 0,621 |
| 3 | 9.859 | **0,627** |
| **4** | **6.714** | **0,494** |
| 5 | 5.442 | 0,500 |
| 6 | 4.669 | 0,508 |
| 7 | 4.135 | 0,458 |

**Escolhi k = 4.** Justificativa:

- o cotovelo mostra ganho decrescente a partir de k = 4;
- a silhueta em k = 4 é 0,494 — separação sólida (acima de 0,45);
- k = 4 é interpretável em linguagem de operação.

**Ponto honesto:** a silhueta é **maior em k = 3** (0,627). Ver seção 11 — este é um dos
pontos legítimos de questionamento.

### Os perfis encontrados (semente 42)

| cluster | T_max | ΔT | V_max | V_méd | n | nome operacional |
|---|---|---|---|---|---|---|
| 2 | 33,6 | +0,3 | 0,19 | 0,05 | 2.423 | **Repouso estável** |
| 0 | 43,2 | −0,9 | 0,09 | 0,04 | 1.603 | **Resfriamento pós-carga** |
| 1 | 32,7 | −0,5 | 6,48 | 1,62 | 1.013 | **Operação intermitente** |
| **3** | 40,9 | **+5,9** | 6,77 | **4,78** | 411 | **Operação crítica** |

> O K-Means entrega números (0,1,2,3). Os **nomes fui eu que dei**, lendo a tabela de
> médias — exatamente como o slide 13 da aula manda (*"Cluster 0 não é um resultado
> executivo"*).

### Qual variável separa os clusters

**Não é uma só.** Duas variáveis fazem o trabalho:

- **`fut_V_mean`** separa operação de repouso
- **`fut_T_delta`** separa quem aquece de quem esfria

### O achado mais útil da segmentação

Compare os clusters **1** e **3**:

| | cluster 1 (intermitente) | cluster 3 (crítico) |
|---|---|---|
| `fut_V_max` (pico) | 6,48 | 6,77 |
| `fut_V_mean` (sustentada) | **1,62** | **4,78** |
| `fut_T_delta` | −0,5 | **+5,9** |

**O pico de vibração é praticamente igual nos dois.** O que os separa é a vibração
**sustentada** — e é ela que produz o aquecimento de +5,9 °C.

> **Pico isolado de vibração não caracteriza risco. Platô mantido sim.**

Isso é consistente com a conclusão já registrada no projeto em 21/08: o sinal de
problema é **nível absoluto sustentado**, não variação instante a instante.

---

## 8. Base 2 — a janela passada

Para cada linha, 46 números olhando **só para trás**:

| grupo | variáveis |
|---|---|
| valor atual | `V_agora`, `A_agora`, `X_agora`, `T_agora` |
| janelas móveis | média, desvio e máximo de cada canal em 30 s / 2 min / 10 min (36 variáveis) |
| tendência térmica | `T_slope_2min`, `T_slope_10min` |
| contexto operacional | `rodando`, `tempo_no_estado_min`, `carga_termica` |
| identificação | `motor` |

- `carga_termica` = `∑(V × 5s)` acumulado desde a última mudança de estado — proxy do
  trabalho mecânico acumulado desde a partida.
- `tempo_no_estado_min` = há quantos minutos o motor está no estado atual (ligado ou parado).

### Empilhamento por ativo

Em vez de uma linha com as 6 colunas dos dois motores, cada motor vira uma **observação
independente**: `(motor, instante, V, A, X, T)`.

**Motivo:** dobra os dados úteis e força o modelo a ser genérico por ativo, em vez de
decorar "motor 1 é mais frio que motor 2" — viés que quebraria ao plugar um terceiro motor.

**Dataset final: 5.450 linhas** (2 motores × 2.725 instantes válidos).

---

## 9. Classificação e os dois testes

Modelos: `LogisticRegression` e `DecisionTreeClassifier(max_depth=6)` — os mesmos da
aula (slide 22).

### Teste A — split aleatório (o procedimento da aula)

`train_test_split(test_size=0.30, stratify=y)`

| modelo | accuracy | precision | recall | **f1_macro** |
|---|---|---|---|---|
| Regressão Logística | 0,871 | 0,875 | 0,840 | 0,851 |
| **Árvore de Decisão** | 0,918 | 0,935 | 0,896 | **0,909** |
| BASELINE (classe majoritária) | 0,445 | 0,111 | 0,250 | 0,154 |

Pela régua da aula, o trabalho estaria concluído aqui.

### Teste B — split temporal (a avaliação honesta)

`TimeSeriesSplit(n_splits=5)` — cada fold treina só no passado e testa só no futuro.

| fold | Árvore (f1_macro) |
|---|---|
| 0 | 0,204 |
| 1 | 0,504 |
| 2 | **0,033** |
| 3 | 0,323 |
| 4 | 0,435 |

| modelo | f1_macro médio |
|---|---|
| Regressão Logística | 0,270 |
| **Árvore de Decisão** | **0,300** |
| BASELINE | 0,167 |

### O custo do vazamento

| modelo | split aleatório | split temporal | queda |
|---|---|---|---|
| Regressão Logística | 0,851 | 0,270 | **0,581** |
| Árvore de Decisão | 0,909 | 0,300 | **0,609** |

**Mesmo modelo. Mesmas features. Só muda como o teste foi montado.**

### Por que a diferença existe

A telemetria é amostrada a cada 5 s. Duas linhas consecutivas são quase idênticas:

```
13:45:35  →  7.021
13:45:40  →  7.009     ← praticamente a mesma linha
```

O `train_test_split` embaralha e manda uma para o treino e a outra para o teste. O modelo
"acerta" porque já viu a resposta na irmã gêmea ao lado. **Isso é vazamento de dados** —
tema listado no slide 2 da própria aula como objetivo de aprendizado.

Em produção o modelo nunca vê o futuro. Só o corte temporal reproduz a condição real.

---

## 10. Causa raiz do resultado baixo

Não é hiperparâmetro. Não é escolha de algoritmo. É **cobertura de dados**.

**Quais perfis existem em cada trecho da sessão:**

```
bloco temporal │  y=0   y=1   y=2   y=3
───────────────┼──────────────────────────
      0        │    0   500   410     0
      1        │    0     0   908     0
      2        │    0   424   484     0
      3        │  408    89     0   411
      4        │  741     0   167     0
      5        │  454     0   454     0
```

**Os perfis aparecem e desaparecem.** O cluster 3 (Operação crítica) só existe no
bloco 3. O cluster 0 (Resfriamento) nasce no bloco 3.

Um modelo treinado no passado é avaliado sobre perfis que **nunca apareceram no treino**.
Nenhum algoritmo resolve isso — é ausência de exemplo.

### A origem: 6 ciclos

A sessão inteira tem **6 partidas e 6 paradas**:

| corrida | duração |
|---|---|
| 1 | 1,58 min |
| 2 | 1,33 min |
| 3 | 1,42 min |
| 4 | 3,75 min |
| 5 | 3,75 min |
| 6 | **16,92 min** |

Uma corrida de 17 minutos domina todo o aquecimento da sessão.

> **Do ponto de vista estatístico, o número de exemplos independentes não é 5.450.
> É da ordem de 6.**

As 5.450 linhas são recortes sobrepostos de 6 eventos. Agravante: os dois motores são
acionados juntos (correlação ~1,0), então nem sequer são 2 ativos independentes.

---

## 11. Onde me questionar — pontos fracos conhecidos

Lista honesta dos pontos onde este trabalho é atacável. Nenhum deles foi escondido.

### 11.1 A silhueta favorece k = 3, não k = 4

**O fato:** silhueta k=3 = 0,627 contra k=4 = 0,494.

**A defesa:** k=4 separa "Operação intermitente" de "Operação crítica" — que é
justamente a distinção com valor operacional (pico vs. platô). Com k=3 esses dois
provavelmente colapsam num só e o achado principal desaparece.

**A crítica válida:** essa é uma escolha de negócio sobreposta a um critério estatístico
que apontava para outro lado. O slide 12 da aula autoriza isso (*"o número final também
precisa ser interpretável"*), mas **é uma escolha, não uma dedução.** Rodar com k=3 e
comparar é um teste legítimo que eu não fiz.

### 11.2 O cotovelo não tem cotovelo claro

A inércia cai de forma contínua (13.794 → 9.859 → 6.714 → 5.442 → 4.669 → 4.135), sem
uma quebra nítida. O "cotovelo em k=4" é uma leitura interpretativa, não um ponto óbvio
no gráfico.

### 11.3 Interpolação nos intervalos longos

O buraco de 228 s foi preenchido por reta. São valores **estimados, não medidos**.
Caem em período de repouso (sinal constante), então o risco é baixo — mas linhas
sintéticas entraram no dataset.

### 11.4 O horizonte de 10 min não foi otimizado

Testei 2, 3 e 10 min. O de 3 min dá o melhor número no split aleatório (0,939). Escolhi
10 min por utilidade operacional. Alguém pode argumentar que a escolha deveria ser
por validação — a contra-argumentação é que otimizar horizonte contra a métrica é
escolher o teste que dá o melhor resultado.

### 11.5 `T_agora` está na Base 2 e `fut_T_max` na Base 1

Elas são correlacionadas — temperatura muda devagar. **Isso não é vazamento** (a
temperatura atual é legitimamente conhecida agora; o proibido é usar o valor futuro).
Mas parte do acerto do modelo vem de autocorrelação temporal, não de aprendizado real.
É por isso que o baseline está na tabela: ele mostra quanto do resultado é trivial.

### 11.6 Os nomes dos perfis são interpretação minha

"Operação crítica", "Repouso estável" etc. saíram da minha leitura da tabela de médias.
O K-Means entregou 0/1/2/3. Outra pessoa lendo a mesma tabela poderia nomear diferente.
Isso está de acordo com a aula, mas é subjetivo por construção.

### 11.7 A unidade do canal 3 é desconhecida

Recuperei o canal e provei que ele carrega informação independente. **Não sei o que ele
mede.** Precisa do IODD do sensor. Enquanto isso, ele entra no modelo como número sem
significado físico declarado.

### 11.8 "Operação crítica" não significa "motor com defeito"

O perfil descreve **regime de operação**, não estado de saúde. O motor vibrando 4,78 mm/s
sustentado e esquentando +5,9 °C pode ser simplesmente o processo funcionando como
projetado. **Não há nenhuma falha rotulada nesta base para calibrar isso.**

---

## 12. O que se sustenta e o que não se sustenta

| Afirmação | Sustentada? |
|---|---|
| "Velocidade e aceleração são a mesma variável neste dataset (R²=0,97)" | **Sim** — verificável |
| "Existe um 4º canal no payload que não foi exportado" | **Sim** — decodificação confere com as colunas conhecidas |
| "O canal 3 é o único com variância mecânica independente (R²=0,65)" | **Sim** |
| "O comportamento futuro se organiza em 4 perfis distintos" | **Sim** — silhueta 0,494 |
| "Vibração sustentada, não pico isolado, é o que acompanha aquecimento" | **Sim** — V_max quase igual, V_mean 1,62 vs 4,78 |
| "O pipeline está livre de circularidade" | **Sim** — conjuntos disjuntos, verificado por `assert` |
| "O classificador prevê o perfil com F1 ≈ 0,91" | **NÃO** — vem do split aleatório, inflado por vazamento |
| "O classificador está pronto para produção" | **NÃO** — F1 temporal ≈ 0,30 |
| "O modelo prevê falha do motor" | **NÃO** — não há falha rotulada na base |
| "O motor quebra por vibração e não por temperatura" | **NÃO** — não há evento de quebra para sustentar |

### Limitações estruturais

- Uma sessão, um dia, ~4 h, **6 ciclos** de operação.
- Os dois motores são acionados juntos — não são amostras independentes.
- **Nenhuma falha registrada.** O pipeline segmenta *regimes de operação*, não
  *estados de saúde*. Qualquer rótulo tipo "motor com defeito" seria invenção.

---

## 13. Próximo passo

**Coletar mais base.** O pipeline está pronto e validado; falta dado.

Meta: **30–50 ciclos de partida/parada distribuídos em vários dias**.

Com isso:
- o split temporal passa a ter cobertura de todas as classes em todos os blocos;
- o F1 honesto vira um número utilizável;
- é possível testar se o platô de vibração **sobe ao longo dos dias** — que seria a
  primeira evidência real de degradação, e não apenas de regime de operação.

Complementos possíveis:
- consultar o **IODD do sensor** para descobrir o que o canal 3 mede;
- registrar qualquer evento de manutenção/defeito como rótulo positivo.

---

## 14. Tabela de referência rápida

### Arquivos

| arquivo | conteúdo |
|---|---|
| `eda_excel/forzy_kmeans_pipeline.ipynb` | pipeline completo, 44 células, roda ponta a ponta |
| `eda_excel/forzy_perfis_segmentados.csv` | 5.450 linhas com perfil atribuído |
| `eda_excel/History_32026-05-19T11-46-10-920.csv` | base bruta |
| `context_for_ai/eda_forzy_lab_maio.md` | EDA anterior (corrigido em 24/08) |
| `context_for_ai/log.md` | log contínuo do projeto |

### Parâmetros do pipeline

| parâmetro | valor |
|---|---|
| `PASSO` (reamostragem) | 5 s |
| `HORIZONTE_PASSOS` | 120 (= 10 min) |
| `JANELAS` (Base 2) | 6 / 24 / 120 passos (30 s / 2 min / 10 min) |
| `K` | 4 |
| `RANDOM_STATE` | 42 |
| limiar "rodando" | V > 1 mm/s |

### Números-chave

| métrica | valor |
|---|---|
| linhas brutas | 7.183 |
| linhas após grade 5 s (por motor) | 2.845 |
| dataset final | 5.450 |
| features Base 1 | 6 |
| features Base 2 | 46 |
| ciclos de operação | **6** |
| PCA colunas do Excel (2 comp.) | 99,4 % |
| R² aceleração ~ velocidade | 0,974 |
| R² canal 3 ~ velocidade | 0,652 |
| silhueta k=4 | 0,494 |
| **f1_macro split aleatório** | **0,909** |
| **f1_macro split temporal** | **0,300** |
| f1_macro baseline (temporal) | 0,167 |

---

*Documento gerado em 24/08/2026. Todos os números são reprodutíveis executando
`forzy_kmeans_pipeline.ipynb` com `RANDOM_STATE = 42`.*
