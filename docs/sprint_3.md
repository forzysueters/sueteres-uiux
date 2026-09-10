Participante 1 (00:00)
Boa noite, pessoal. Tudo bem? Vamos o suéter isso aqui nós vamos trazer a solução e a evolução que nós ermos para esses 23, tá bom na última experiente, nós coletamos os feedbacks que vocês mostrou sério, principalmente relacionados à front chain, e nós fizemos algumas melhorias? 

Participante 2 (00:17)
Também com a modelagem que a gente já desenvolveu e vai trazer pra vocês como esse modelo ficou e quais foram as nossas dores também. 

Participante 1 (00:25)
Falando um pouco de frontinhal, a nossa tela inicial da nossa aplicação anteriormente era o painel de visão geral dos motores, porém nós ouvimos o conselho de vocês e trouxemos o nosso gêmeo digital, agora com uma abordagem 3D. Para a tela inicial, então vocês conseguem acompanhar de forma 3D os status do grupo dos motores, os nomes, como eles estão e clicando neles, pode avançar pra próxima tela, por favor? Ficando neles, você consegue ver as características deles, como corrente, tensão, etc. 

Participante 1 (00:53)
Vibração. E o status dele se ele tá bem se ele está ruim, etc. Também evoluímos o nosso assistente de água, o assistente agora está contextualizado no site, então tem as informações de como está os estados monitores e a nossa página de alertas que consegue trazer em tempo real se algum motor está com falha, se ele está com algum problema tá bom, é o Vinícius, agora vai apresentar? 

Participante 1 (01:14)
O modelo de machine learn que nós devolvemos. 

Participante 2 (01:22)
Bom, pessoal, é começando aqui, tá? Não queria trazer pro lado tão técnico, mas conforme as coisas que foram acontecendo, acho que eu vou ter que trazer um pouco aqui e ainda mais temos aqui o Leandro, que também vende do assunto até pra gente conseguir conversar sobre melhorias, vou trazer um pouquinho aqui da modelagem, tá? Então basicamente qual que foi a estratégia aqui pra começar a gente pegou os dados que tinha dentro do Excel e também dentro da pedi que vocês cê pensa SB, que vocês enviarem pra gente os Estados Unidos da API tiveram alguns problemas, eu vou comentar mais pra frente, mas enfim, basicamente os dados que tinham e a primeira estratégia foi a seguinte como os dados do motor vinham de uma forma que às vezes vinham dado repetido ou se não vinha 5 segundos ou se não vinha de meio e meio, segundo enfim, não vejo de uma forma padronizada, então essa estratégia aqui foi fazer de 55 segundos agrupar esse dados e. 

Participante 2 (02:14)
Também fazer a média de cada de cada médica, né? Então a gente fazia a média ali da velocidade. É da aceleração enfim, e aí com isso a estratégia foi fazer um modelo não supervisionado, porque como esse V é veio sem uma target, a gente precisava construir essa targue, só que eu fazia essa correlação fica complicado com o ser humano fazer, porque às vezes eu conseguir um detalhe que tá escondido dentro dos dados, então a estratégia desenvolver um modelo não supervisionado que dentro desse modelo não supervisionado, é, eu rodei, ele fazendo todas as correlações, ele me desenvolveu 4 glusters, neck ali depois eu rotolê eles que eu vou apresentar pra vocês e com isso depois eu tiver com o data 7 com todos os votos e com as tags definidas, aí sim eu vim pra um modelo supervisionado, né, que vem desse modelo supervisionado, eu vou mostrar a estratégia que eu testei algumas estratégias mais aqui principal foi foi a randonford, né? 

Participante 2 (03:16)
Porque passa, por favor. Então basicamente apresentando pra vocês aqui, né, a estratégia principal que a gente treinou aqui foi o rango forest e tivemos um resultado poderia trazer outras métricas aqui, mas eu acho que vai aqui me mscor, consegue traduzir bem o que a gente quer passar que o FMI. Mscore, 1 0,30, eu acredito assim, tá pessoal falando falando um pouco jardim de negócio e um pouco do que eu entendi pode ser que é outros grupos, é tragam um valor de afins, corre maior, mas é por conta que eu acredito que pode ser pelo dado vazado, porque realmente acho. 

Participante 2 (03:54)
Que um dos grandes problemas foi isso, né, pouca quantidade de dado, e por conta disso, fica muito difícil, é treinar um modelo que vai realmente ficar muito bom. Então, o fim score aqui saiu 030 que a gente pode melhorar isso ao longo do tempo, trazendo mais dados, enfim. Aqui como eu comentei os nomes das dos clusters, né? 

Participante 2 (04:17)
Que a gente definiu pra definir as taggets, então o repositável resfriamento, póscarga, operação intermitente, operação crítica, então esses foram as taggets que a gente definiu que aí consequentemente, conseguimos treinar um modelo supervisionado, então pra conseguir chegar dentro de uma predição, né? Pra gente fazer exatamente isso conseguir prever. Quando vai dar algum problema dentro dos motores, né, e a conclusão que o tempo pra passar é essa pessoa, acho que acredito que por conta da falta de dados e com volume que a gente tem de dados hoje? 

Participante 2 (04:53)
Acredito que nunca muito difícil trazer trazer esse modelo realmente muito bom. E tivemos alguns problemas com a PIS também que a gente pode conversar aqui, mas acredito que pra hoje a gente tem isso, acredito que a próxima vez print, a gente vai trazer todas as melhorias e trazer um pouco mais de detalhes. Aí a gente queria e focar mais nessa parte de modelagem, mesmo pra realmente conversar com vocês e traçar pra sua estratégia. 

Participante 2 (05:20)
Obrigado. Beleza, obrigado, pessoal.

Participante 1 (00:00)
Eu parece seu medo, é muito bom e hoje o velho até satiscurização prévia tomando mãos provisionado depois de treinar o mundo provisionado, é muito, muito próximo do que eu espero que nos estratégia tá? Entendo que você. 

Participante 2 (00:14)
Estes voluntários. 

Participante 1 (00:15)
Usados é de pedaços limitados e esse é uma realidade diferente enfrenta no mundo real, então não esperava assim, não vai ser um fator de avaliação antigo escolar ou a precisão, a curácia et cetera do modelo, desde que eu tenha uma metodologia bem feita, vocês apresentaram uma metodologia bem feita. Considerando o desconhecimento que vocês têm no sistema comum, todo tá excelente, tá bom agora? Apadinha, não, acho que não deveria me interessa agora todo resto a gente precisa ver também, então a parte de gerenciamento de ativos, a parte de facilidade, a parte de OCR é a parte de gráfico em tempo real, a parte de integração, enfim, a parte debatidamento boa, tá você mais toda a questão de desafiação, 3 DG gráfico real é gestão de ativo. 

Participante 1 (01:16)
O próprio cobile de manutenção, algum tipo de LB minimamente, acho que faltou um pouco dessa parte, mas assim continue pensando líder de uma estilando de vocês, mas tragam as outras, fiz discutiu pra fazer que eles falam ah, não comecinho, tá? Não sei como tá agradação que cês comentáram o da pergunta se vocês tiver alguma que. Eu posso discutir, mas se estocando bastante essa parte da xenga, às vezes não tem que colocar um pouco nas outras, fiz mais news, eu vou falar assim, tá? 

Participante 2 (01:56)
É, é assim, né, Japão? Eu acredito que talvez falta um pouco de clareza na nossa parte. Essa parte é mais de fits, dentro da nossa aplicação, ela tá sendo construída ainda claro, mas ela também tá bem completa, realmente acho que o foco hoje que a gente queria dar era mais discutir essa parte da modelagem, que pelo menos da nossa parte, essa parte dos dados ficou um pouco confusa, né? 

Participante 2 (02:19)
E eu quis focar mais. Até por conta do tempo que são 5 minutos pra gente apresentar realmente igual que foi a nossa estratégia até porque acredito que na última não cai, não cabe a gente trazer uma visão tão técnica, né, trazer uma visão mais de negócios mesmo. Então, por conta disso que eu acho que a gente trouxe essa parte mais forte, modelagem dessa. 

Participante 2 (02:40)
Apresentação, mas é deixando ser seguros. A gente também que trabalhando nisso e também legal tudo isso que você comentou, a gente também implementou, a gente vai apresentar na próxima e falando dessa parte da π, é vou falar. Do que foi da nossa experiência, tá o primeiro link, vocês mandaram, se eu não me engano aí aí pode ser que eu entendi ela tá, mas eu acho que era um link temporário? 

Participante 2 (03:07)
É então quando a gente foi rodar ela peina na primeira semana de fato eu acho o like não tava funcionando, a gente não conseguiu pegar esses dados de fato aí agora esse segundo link vocês enviaram ficou um pouco confuso, né? Porque pelo que eu entendi até conversando aqui um pouco conores, enfim, é a gente percebeu que os dados registravam uma vez e aí você não tivesse atualização ele. Ele não registrava no entendido muito bem essa parte continuava mesmo, né? 

Participante 2 (03:41)
Então, então os dados dessa semana realmente também não foi uma boa coleta assim, e eu entendi que cê coloque esses problemas no dia a dia é também acontece, existem, né? Só que também fica meio complexo, né? A gente queria trazer realmente um modelo muito bom pra tentar realmente ajudar. 

Participante 2 (04:02)
Mas eu acredito que se vocês forem levar mais em conta essa parte da estratégia que a gente tirou pra modelagem, eu acho que fica um pouco mais deste gente, um pouco mais tranquilo em relação a isso. 

Participante 3 (04:19)
É isso? 

Participante 1 (04:20)
Tivemos um pouquinho desculpa, olá. 

Participante 3 (04:22)
Tanto de experiência que a gente teve no back draws, 2 22, essas funcionalidades, como o ce. Assistente de IA gestão digital twin, elas já estavam muito bem feitas a gente. Só fez algumas alterações de fronte, isso do feedback de vocês tá, por isso que a gente vai optou por trazer mais foco, a modelagem de Machine Learning nessa experiência, tá bom? 

Participante 1 (04:44)
Eles trazem. 

Participante 4 (04:47)
Galera. Muito legal, gostei da melhoria da interface, tá? Gostei da parte do Washington game, tá bem estruturado? 

Participante 4 (04:53)
Acho que é bem por aí mesmo, tá só sentir foto de aplicação rodando? O mar aqui é uma reunião mais gerencial, meus comentários, né? Encha os olhos de que está olhando, né, uma aplicação rodando câmbio, os pretícios de porco. 

Participante 4 (05:13)
Assim, tanto tempo. Se vocês tiverem de aplicação de voluntários deverem disponibilizar pra nós, acho que o pessoal aí consegue né, compartilhar isso e ideia a gente consegue enviando avaliar a melhor em relação à interface, esse foi o meu sentimento aí eu tava eu tava pensando aqui, eu entendo essa questão do dado, né? Essa é a vida real. 

Participante 4 (05:37)
Nas empresas você vai receber muitas vezes o da tracet que não faz muito o seguido que tem uma sede de lacunas e tal, e aí uma sugestão para vocês, tá até pra vocês verem se o exportalmente talvendo não é o jeje que avaliasse o fornece grupário, o exporta um? Grupo. X PT oh tá, mas se vocês usarem dados estéticos, né, de aumentar a base de vocês, né, utilizando base dados sintéticos pra que vocês consigam validar esse modelo realmente trazendo a informação correta, né? 

Participante 4 (06:15)
Não depender só do cliente, isso é uma estratégia que a gente busca também se de casa tá qual dá no vendedor legal pode tá bom? Dá alguma coisa sim, tética pra simular o ambiente. Feliz, né, caso de vocês mais é isso demais, tá tudo bom, parab? 

Participante 2 (06:37)
Obrigado, é dessa parte lá sintético, isso eu também ia perguntar pra vocês hoje é porque assim, confesso que um pouco da parte nossa, também, a gente acaba vindo aqui alguns murmurinhos aqui junto com a sala e tem algumas pessoas que vai lá é então querendo muito que trouxe dados sintética, enfim, não sei se alguém. Falou pra tentar complicar o outro grupo, mas bom saber é outra pergunta também é se faz sentido brigada da internet. Às vezes pegado, não dá pra 7 de um grego ou pegar de alguma fonte, mas eu não moda nessa nesse sentido pra tentar. 

Participante 4 (07:13)
É só assim, a gente quer ver os dados que a gente possa para vocês, né, a gente quer ver o dado que nós atraímos do nosso do nosso equipamento e a gente quer ver isso, dando nossa aplicação, quando eu falo de usar dados sintético, é pra você vale dar sua tese do seu escorting, apô? Pra você é realmente tá funcionando, eu vou trabalhar, vou desencanar esse negócio que tá tudo 01 né, se eu usar o dados itéticos e continuar no 01/3 de uma menálise, tá correta, tá? É isso que eu Gostei de deixar bem, tem claro que tá durante a aplicação, eu quero ver, eu dá lá rodando, entendeu o que eu quero ver o meu Modelo 3D rodando pra cima de vocês é isso, é meu intuito. 

Participante 2 (07:58)
Entendi. Obrigado. É e outra dúvida pessoal. 

Participante 2 (08:00)
Tem tempo em nenhum, é rapidinho, tá, é outra dúvida a gente queria entender se na parte que a gente assim tá fazendo 2 aplicações diferentes, né? Tanto pro administrador tanto pro engenheiro de manutenção. A parte pro administrador é interessante ter algumas fitsuficas e trabalhar pra ele também ou focar mais na pessoa que vai. 

Participante 2 (08:20)
Estar na operação. 

Participante 1 (08:25)
As diferenças ansiosos de operação administrador é que o administrador conseguem operar alterar e evitar a aplicação com o potor, o operador só consegue visualizar e interagir com coisas que não editam dados em plataforma com um todo. 

Participante 2 (08:41)
Entendi. Não, beleza. Obrigado. 

Participante 4 (08:44)
O mesmo ambiente é só leitura e gravação. Peço assim é. 

Participante 1 (08:47)
O administrador adiciona um operador o operador não adicionou. 

Participante 2 (08:53)
I'm, know, no isso sim, eu falei mais por conta pensando que talvez pode te dar uma picture diferente pra administrador civis, fazer uma relagenda, alguma corres ali, né? 

Participante 1 (09:05)
Específico, é da verdade, os Estados Unidos têm que alimentar a plataforma, que é uma coisa mais que administrador central. 

Participante 4 (09:14)
Não é o operador que você vai pegar e vai variar pra falar que vai gastar a placa lá dentro da solução. Só fica dica. 

Participante 1 (09:26)
Leve de límica, é baixa 1 de vocês, ou vocês podem saber desses pesquinhos de acesso e quem faz o quê quando ano tá? 

Participante 2 (09:35)
Eles obrigada, hein. 

Participante 4 (09:36)
Ali argentina, parabéns, é isso, obrigado. Gente, o marido brigado, grupo, obrigado legal, obrigado. Michel, vou fechar aqui, tá? 

Participante 4 (09:49)
Pessoal.
