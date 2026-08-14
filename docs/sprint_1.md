00:00:00,780 --> 00:00:08,080 [Speaker 0]
Beleza. Ah, beleza, entendi ali, ativo físico, é, depois tem, qual que é o outro símbolo? 

00:00:08,080 --> 00:00:08,620 [Speaker 1]
Sensores. 

00:00:08,620 --> 00:00:09,080 [Speaker 0]
Sensores. 

00:00:10,140 --> 00:01:18,720 [Speaker 0]
Sensores, plataforma de dados, modelo digital. Tá, beleza. Hã, cara, o ativo fixo ele é quase que a base ali da, da coisa toda, tá? A gente tá pensando sempre numa arquitetura que olha um pouco mais macro, tá? Então pensando em fábricas, plantas industriais, né? Você tem a planta industrial, dentro da planta você tem seus equipamentos, dentro dos equipamentos você tem seus ativos, é, que seriam motores, atuadores, etc. E dentro deles você tem os sensores, tá? Então sempre pensar nessa escadinha é importante, tá? Até isso influencia no como vai ficar o front de vocês, tá? E aqui ficou, nesse sentido, eu esperava uma arquitetura um pouco mais trazendo tecnologia e como ia ficar e tal. E também eu senti um pouquinho de falta da gente, de, de trazer um pouco mais que tipo de modelagem, que tipo de machine learning vocês iam, de fato, utilizar pra conseguir, ah, trazer o baseline do projeto, do, do, da, do equipamento, se ele time falha, se ele não cai, etc., e como isso ia ser arquitetado, tá? Isso é bastante salutar. Agora, passa pra próxima tela, que seria o começo do front de vocês. 

00:01:20,680 --> 00:01:24,540 [Speaker 0]
Aí, beleza. Essa é a primeira tela que eu vou ver, certo? 

00:01:24,540 --> 00:01:26,280 [Speaker 1]
É, tirando a tela de login. 

00:01:26,280 --> 00:02:21,799 [Speaker 0]
Eles vão tirar a de operações. Aí aqui eu gostaria de ver, tipo, cara, vários quadradinhos com a minha planta, tá? E aí eu poderia entrar nessa planta e aí eu ia cair num diagrama 2D, tá, gente? Simples, do tipo, ah, eu tenho o equipamento A, B, C e D. E aí, dentro desse equipamento, eu ia clicar nele, e aí eu ia chegar na visualização dele, que ia mostrar a velocidade, temperatura, pressão, vibração, enfim, tudo que os sensores puderem, é, trazer, tá? Passa pra próxima tela, por favor. Essa tela, se ela iniciasse assim, ia ficar muito poluída. Aí esse aqui, beleza, aí esse eu já tô vendo, tipo, o motor principal, então seria o equivalente a eu ter clicado já num ativo. Então faltou uma tela entre uma coisa e outra, entendeu? Então eu tenho uma tela inicial que tem minhas plantas, dentro da planta os equipamentos, dentro do equipamento, motor, cliquei no motor, cheguei nessa tela. Perfeito, isso tá muito bom, só que esse é meio que a ponta da cabeca. Passa pra próxima tela, por favor. 

00:02:25,140 --> 00:03:02,320 [Speaker 0]
Aí, beleza, esses esquemas de AR, bom, aí fica a critério de vocês só tomar um cuidado de, é, quando eu tô falando com esse AR eu tenho muito mais a pretensão de tá falando de um equipamento específico, então eu vou estar falando deste motor, deste atuador, deste, é, enfim, deste solenoide, desta válvula, não importa, tá? É, não trazer ele num lugar muito genérico, porque senão talvez a gente entenda que eu tá-- que eu vá falar, falar da planta inteira. Isso talvez eventualmente seja um contexto muito grande pra vocês trabalharem. Vocês podem, seria genial até, mas cuidado com isso. Passa pra próxima tela, por favor. 

00:03:05,260 --> 00:03:38,549 [Speaker 0]
Beleza, a gente chegou nessa, tá. O que eu senti um pouco de falta, é, também foi a questão de como vocês vão fazer a transcrição de dados, como vocês vão obter dados ali, a questão dos seus endpoints, conversão ali de, enfim, bits e bytes em informação útil, é, como é que vocês vão estruturar isso também. Então eu senti um pouquinho em falta essas ferramentas de tecnologia. Mas de resto, assim, em termos de, é, trazer a ideia mais tangível, acho que cês foram bem, acho que tá, tá, tá interessante, tá do jeito que a gente esperava, só esses detalhes, tá? 

00:03:39,580 --> 00:03:42,720 [Speaker 0]
Acho que, mas, Michel, tua visão também. 

00:03:42,720 --> 00:05:12,480 [Speaker 2]
É, eu gostei muito do, do storytelling que vocês montaram, né, trazendo ali a questão das cores, da, da indústria 4.0, acho que foi, foi uma sacada bem legal, tá? A, também de ter trazido uma arquitetura, mesmo que ela não tenha, hã, explorado muito as tecnologias, mas é já um, um, é um bom ponto de partida, o MVP tava bem construído, achei legal. É, trazendo um pouco pra o feedback, igual o Leandro comentou, né, acho que na hora de montar o front, né, a gente tem que ter essa visão da planta, os seus equipamentos, os, né, os, os seus motores, dentro dos motores, aí sim, a questão da, das análises individuais, né, de cada um daqueles equipamentos, tá? Faltou explorar um pouquinho os modelos de machine learning pra gente tentar entender como é que vocês vão capturar essas informações. Aí, aí eu não sei, tá, Leandro? Aí você pode até me corrigir, tá? Eu acho que pra esse momento, não sei se seria legal vocês gastarem tempo com chatbot, né, pra interagir. Imagina assim, que o cara lá que tá lá na obra lá, o supervisor que tá lá olhando o equipamento, né, muitas das vezes ele quer saber, é, como ele tem que resolver aquele problema. E daí como ele vai resolver aquele problema, ele pode consultar um material, ele pode consultar uma ordem de serviço, ele pode, né, ir, ir, e talvez, hã, um, um chatbot não seja a melhor opção, e sim 

00:05:13,820 --> 00:05:21,430 [Speaker 2]
ele poder visualizar, ele poder consultar essa documentação lá e ele tomar suas decisões, tá, em cima de lição aprendida. Hã, 

00:05:24,200 --> 00:05:36,320 [Speaker 2]
e no mais, foi muito bom. Ah, e daí gostei do, dos QR codes aí, tá? Pena que a gente não conseguiu mexer, que ficou bem legal essa sacada de a gente poder olhar e navegar dentro do MVP e dar o feedback pra vocês. Mas parabéns, trabalho tá muito bom. 

00:05:37,520 --> 00:05:39,880 [Speaker 1]
Poxa, pessoal, é, muito obrigado por esse feedback- 

00:05:39,880 --> 00:05:43,960 [Speaker 0]
Aí lá se quiser fazer alguma dúvida, alguma dúvida, questionamento. 

00:05:43,960 --> 00:05:44,900 [Speaker 1]
Posso nem vai falar? 

00:05:44,900 --> 00:05:46,570 [Speaker 3]
Não, pode falar, pode falar. Tá mutado. 

00:05:46,570 --> 00:06:31,280 [Speaker 1]
Opa, pessoal, muito obrigado pelo feedback no geral, é, é muito orientador ter esse feedback. É, os dados, basicamente, os modelos, nós acredito que pra sprint dois a gente vai conseguir vim falar muito mais sobre quais modelos utilizamos, sobre quais estratégias utilizamos, porque nós já vamos ter os dados reais do, do motor, dos sensores. Então vamos sim implementar eles no front. É, quando vocês conseguirem escanear o QR code, vocês vão ver que na tela, no site inteiro, tem bastante desse digital twin aplicado. Tem uma aba de digital twin, tem uma aba de equipamentos na qual vocês vão conseguir ver mais esses relatórios no geral. E é isso. Alguém quer, quer adicionar mais alguma coisa? É, só agradecer pelo feedback mesmo. É, traremos mais novidades na sprint dois, com certeza. 

00:06:31,620 --> 00:06:32,840 [Speaker 3]
Beleza. 

00:06:32,840 --> 00:06:34,230 [Speaker 0]
Show de bola, pessoal. 

00:06:34,230 --> 00:06:34,230 [Speaker 3]
Fechou. 

00:06:34,230 --> 00:06:35,320 [Speaker 0]
Parabéns, hein? 

00:06:35,320 --> 00:06:36,300 [Speaker 1]
Obrigado, professor. 

00:06:36,300 --> 00:06:36,670 [Speaker 3]
Obrigado. 

00:06:36,670 --> 00:06:37,350 [Speaker 1]
Pode pegar as coisas já? 

00:06:37,350 --> 00:06:37,970 [Speaker 0]
Pode, 

00:06:39,480 --> 00:06:39,990 [Speaker 0]
pode sim. 

00:06:39,990 --> 00:06:39,990 [Speaker 3]
O exercício é o 

00:06:41,220 --> 00:06:41,880 [Speaker 3]
chat Dallas

