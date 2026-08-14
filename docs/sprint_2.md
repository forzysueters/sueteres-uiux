00:00:00,540 --> 00:01:26,720 [Speaker 0]
Vocês têm a plataforma aí pra mostrar como é que tá a navegação? Porque eu fiquei numa dúvida, especialmente do gêmeo digital, porque aquele fluxo de navegação, e tá bom em termos esquemáticos, porque vamos lá, ali seria uma malha de processo, tá, pensando na vida da indústria, da engenharia. Tá ótimo, o cara clicou lá, apareceu os dados. Mas aquilo é a alma do negócio. Eu cliquei, eu queria ir pro dashboard, talvez inicial ali, com todas as informações, não só aquela telinha do lado. Aí que eu ia comentar, talvez faltou aquela escadinha que eu comentei. É, por exemplo, ah, eu entrei na minha planta. Quando eu entrei na minha planta, já caiu naquele, naquele fluxograma ali, onde o Mateus, é, começou a explicar. E de lá que eu começo a acessar os outros dashboards, a situação, beleza. Na minha tela inicial, eventualmente eu posso ter um dashboard um pouco mais simples, talvez consolidado ali, da minha, das minhas N plantas, tá? Mas eu acho que o fluxo, em termos de-- pensando assim no gêmeo digital, aquilo deveria ser pra-praticamente a primeira coisa. Então eu fiquei um pouco na dúvida. Eu gostei muito do-- assim, em termos de diagrama também, ali do fluxo que vocês mostraram, o fluxo da aplicação, eu achei que tá muito bom, tá? Ela tá bem estruturada, tá bem pensada. É, eu só não sei se ela está implementada, tá? É, queria, queria ter talvez um jeito de trazer os, o status ali, seria trazer por caixinha do diagrama de vocês, porque em termos do fluxo ali, cara, tá 

00:01:28,020 --> 00:03:53,200 [Speaker 0]
perfeito. É, de como a aplicação deve funcionar. Só que eu não senti que ela conversou com aquele front que vocês fizeram. O front tá meio desconexo, tá? Hã, aí também, de novo, aí vocês mostraram que existe uma parte separada pros agen-- pro agente do Orif ali, com os documentos, com a RAG, imagino que vocês usaram LLM. Isso pode ter, isso de-- perdi um pouco a voz, mas um-- dever-- poderia estar dentro dessa, dessa tela do ativo, entendeu? Porque quando eu tô olhando um ativo, um dado motor ali, eu gostaria muito de ter todas as informações lá, então não ficar navegando. E facilita, né? Porque aí eu já olho como tá meu modelo de machine learning. Gostei que vocês trouxeram o Z-score, gostei que vocês usaram o score de anomalia. Queria até um dia, talvez, entender como que isso é calculado, como que esse modelo é treinado, porque isso é uma grande dor da indústria. O que é um score de anomalia? Isso é muito legal, tá? Mas eu queria ver isso já na minha tela do meu motor. Cara, o meu sco-- o meu score de anomalia tá baixinho. Pô, meu motor tá top. Ah, não, tá começando a aumentar. Ih, não tá legal. Alguém-- seria legal ter uma recomendação ali. Então, consolidar isso, tá? É-é, aqui, é, pensem na simplicidade, tá? Tem-- acho que também tem bastante coisa ali, tá? Mas, é, usem como a alma do negócio o gêmeo digital. Ah, eu gostei muito, mas ainda assim tá um pouco desconexo. Talvez teria-- tem que escovar e evoluir, acho que naturalmente, acho que são os próximos passos, tá? Hã, uma dica que eu vou dar pra vocês também é: olhem talvez com mais atenção os dados, tá? É, principalmente porque a gente tá trabalhando com vibração, variação de vibração e temperatura, tá? Isso não são-- não é um-- muitas-- não são muitas informações, mas acreditem, são as mais pertinentes pra manutenção. Uma coisa que vibra muito, esquenta muito, é ruim. Então, eventualmente, os modelos... Gostei que vocês foram pra modelos simples, tá? É, não pecaram pelo excesso. Cara, uma regressão linear funciona, um XGBoost funciona, desde que bem contextualiza-- contextualizado, não, bem treinado, tá, ali bem separadinho, acho que funciona legal. Gostei que vocês não foram pra: "Não, vou usar deep learning e tal, não sei o quê". Não precisa, tá bom? A parte grossa ali de A profunda vai ser mesmo na, na RAGzinha e na RAG também, uma boa, uma RAG bem feita que consulte os manuais também já é um bom adianto. Hã, acho que é isso. Vocês têm alguma dúvida, colocação? 

00:03:53,200 --> 00:04:07,760 [Speaker 1]
Bom, aqui, por nossa parte, acredito que não tenhamos dúvida. É, era mais essa questão do feedback pra ter um direcionamento e entender do que que nós podemos dar continuidade, é, interpretar melhor. 

00:04:08,820 --> 00:04:12,540 [Speaker 1]
E você falou que queria que mostrasse um pouco da tela, você quer que mostra? 

00:04:12,540 --> 00:04:17,800 [Speaker 0]
É, se puder, cara, só pra entender como é que tá o fluxo, cara, porque eu fiquei meio no slide, às vezes não tá. 

00:04:17,800 --> 00:04:23,099 [Speaker 1]
Ó, aqui você tem a aba-- isso aqui eu tô rodando só o front, tá? Então algum serviço- 

00:04:23,100 --> 00:04:23,270 [Speaker 0]
Não vai ter dados. 

00:04:23,270 --> 00:04:25,320 [Speaker 1]
Não vai tá funcionando. Mas aqui... 

00:04:25,320 --> 00:04:28,400 [Speaker 0]
Então, deixa eu só perguntar, quando você entra na plataforma, qual é a primeira tela que você vê? 

00:04:28,400 --> 00:04:34,200 [Speaker 1]
É, a primeira tela é a de login, no caso. Deixa eu sair aqui. Deixa eu ver. É que eu não vou conseguir sair agora por causa do... Aí foi. 

00:04:35,440 --> 00:04:42,539 [Speaker 1]
Hã, aí você consegue fazer o login, o seu usuário como administrador, tudo. No caso, o meu deu erro. 

00:04:42,540 --> 00:04:44,220 [Speaker 0]
Tudo bem, acontece nos lançamentos. 

00:04:44,220 --> 00:04:45,610 [Speaker 1]
É, quando é... 

00:04:45,610 --> 00:04:47,040 [Speaker 0]
[rindo] Não era, não era a intenção. 

00:04:47,040 --> 00:04:47,210 [Speaker 1]
Quando tem- 

00:04:47,210 --> 00:04:48,280 [Speaker 2]
Vocês entrou no server? 

00:04:48,280 --> 00:04:49,440 [Speaker 3]
Tem que subir o server, Mikil. 

00:04:49,440 --> 00:04:58,700 [Speaker 1]
Tem que subir o server? É, eu tinha rodado sem subir o server. Calma aí, gente. Parar de fazer a tela rapidinho só pra subir o server e fazer o login. Alguém consegue rodar aí sem subir o server? 

00:04:58,700 --> 00:05:03,310 [Speaker 0]
Não, não precisa, não se sintam pressionados, tá? Eu acho que nem vocês têm que ter essa maturidade agora. 

00:05:03,310 --> 00:05:03,840 [Speaker 2]
Vou restartar aqui, 

00:05:04,920 --> 00:05:06,250 [Speaker 2]
vou restartar aqui. 

00:05:06,250 --> 00:05:06,250 [Speaker 1]
Você restartou aí? 

00:05:06,250 --> 00:05:07,780 [Speaker 2]
Restartou, só não consigo puxar a tela. 

00:05:09,360 --> 00:05:11,600 [Speaker 1]
Consegue liberar pro Henry mostrar a tela, Norris? 

00:05:12,880 --> 00:05:20,120 [Speaker 1]
[tosse] 

00:05:23,780 --> 00:05:25,080 [Speaker 2]
Tão vendo aqui? 

00:05:25,080 --> 00:05:25,840 [Speaker 1]
Sim. 

00:05:25,840 --> 00:06:58,280 [Speaker 0]
Então, tipo, eu diria que esse painel meio que não precisa, entendeu? A não ser que você colocasse coisas muito genéricas, tipo, ah, eu nem sei o quanto é utilidade disso. Qual é o meu OEE, minha disponibilidade de máquina geral de todas as minhas plantas? Não sei, tá? Então eu não vejo muita utilidade nessa primeira parte. Já quando você vai pra planta/gêmeo digital, aí sim, cara. Aí é legal, eu fico-- faltaria talvez uma, uma tela inicial, deveria ser a planta. Cliquei na planta, caí aqui. Aí quando eu clicar aqui nessas, nessas bolinhas, aparecer a telinha, só que talvez, é, uma mais focada no-- com o gráfico, com a análise, com o modelo, já com a-- isso! Consolidar isso numa tela, né, num grande painelzão, não ficar assim do ladinho, tal. E cara, aí fica perfeito o que vocês têm que fazer, mas essa, essa é a alma. Então seria fazer o login, entrar na minha tela com as minhas N plantas, cliquei na planta, caí no gêmeo digital, caí no gêmeo digital, é, cockpit, vou falar assim, que é o termo que a gente usa mesmo, com todas as informações. Cara, já tá ótimo. Se tem as informações, já tá perfeito. É só deixar-- traz a informação pra tela, tipo, não tem utilidade ficar com o gêmeo digital no fundo. É uma questão de-- enfim, só dando umas dicas ali. Aí-- e consolidar tudo que vocês-- todos aqueles modulozinhos que vocês colocaram lá no fluxo de vocês, que tá legal pra caramba, coloca numa tela só. Faz aparecer os alertas, faz aparecer o machine learning, faz aparecer a RAG, faz aparecer todo mundo numa coisa só. Porque o pessoal quer rapidez, pensa que a indústria o pessoal é nervoso. O pau tá comendo, cara. Cara, eu quero dar três cliques e chegar onde eu quero, entendeu? Esse tipo de coisa. Mas no mais, cara, tá-tá bonito, tá legal. Achei que ficou bem interessante mesmo. Tá bom? 

00:06:58,280 --> 00:07:01,230 [Speaker 1]
Fechou. Obrigado, viu, pelo feedback. A gente agradece. 

00:07:01,230 --> 00:07:01,640 [Speaker 3]
Valeu, galera. 

00:07:01,640 --> 00:07:03,340 [Speaker 0]
É isso. Obrigado. Valeu, senhores. 

00:07:03,340 --> 00:07:03,940 [Speaker 3]
Valeu, turma. 

00:07:03,940 --> 00:07:04,500 [Speaker 1]
Valeu, hein? 

00:07:04,500 --> 00:07:08,830 [Speaker 3]
Bom fim de semana. [bipe de final de ligação]

