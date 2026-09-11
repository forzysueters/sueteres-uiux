import type { Language, TourStepCopy, TourStepId } from './types';

/** Nome do personagem. Trocar aqui muda em toda a interface e na narração. */
export const ASSISTANT_NAME = 'Órion';

export const UI_COPY: Record<Language, Record<string, string>> = {
  pt: {
    role: 'Assistente virtual',
    open: `Falar com o ${ASSISTANT_NAME}`,
    close: 'Fechar',
    expand: 'Abrir em tela cheia',
    greeting_title: `Olá! Eu sou o ${ASSISTANT_NAME}.`,
    greeting_speech:
      `Olá! Eu sou o ${ASSISTANT_NAME}, seu assistente virtual aqui na plataforma. ` +
      'Ela reúne, em um único lugar, o monitoramento dos seus equipamentos em tempo real ' +
      'e a inteligência artificial que antecipa falhas antes que elas parem a produção. ' +
      'Quer que eu te mostre como funciona? Leva só alguns minutos.',
    start_tour: 'Sim, me mostre',
    later: 'Agora não',
    next: 'Continuar',
    back: 'Voltar',
    finish: 'Concluir',
    skip: 'Pular tour',
    pause: 'Pausar narração',
    resume: 'Retomar narração',
    audio_on: 'Desativar áudio',
    audio_off: 'Ativar áudio',
    speaking: 'Falando',
    thinking: 'Pensando',
    listening: 'Ouvindo',
    ready: 'Pronto para ajudar',
    step_of: 'Etapa {n} de {total}',
    ask_placeholder: 'Pergunte alguma coisa…',
    ask_cta: 'Fazer uma pergunta',
    chat_answer_title: 'Resposta',
    back_to_tour: 'Voltar ao tour',
    restart_tour: 'Refazer o tour',
    audio_unavailable: 'Este navegador não oferece voz sintetizada',
    chat_error:
      'Não consegui responder agora. Tente novamente em instantes — ou use o Assistente IA no menu.',
    chat_intro: 'Pode perguntar sobre a plataforma, seus equipamentos ou a documentação técnica.',
    chat_offline: 'modo offline — resposta montada só com os dados do banco',
    farewell_title: 'Tour concluído',
    ask_by_voice: 'Perguntar por voz',
    stop_listening: 'Parar de ouvir',
    voice_unavailable: 'Este navegador não reconhece voz',
    transcribing: 'Transcrevendo…',
  },
  en: {
    role: 'Virtual assistant',
    open: `Talk to ${ASSISTANT_NAME}`,
    close: 'Close',
    expand: 'Open full screen',
    greeting_title: `Hi! I'm ${ASSISTANT_NAME}.`,
    greeting_speech:
      `Hi! I'm ${ASSISTANT_NAME}, your virtual assistant on this platform. ` +
      'It brings together real-time monitoring of your equipment and the AI that ' +
      'anticipates failures before they stop production. ' +
      'Would you like me to show you around? It only takes a few minutes.',
    start_tour: 'Yes, show me',
    later: 'Not now',
    next: 'Continue',
    back: 'Back',
    finish: 'Finish',
    skip: 'Skip tour',
    pause: 'Pause narration',
    resume: 'Resume narration',
    audio_on: 'Mute audio',
    audio_off: 'Unmute audio',
    speaking: 'Speaking',
    thinking: 'Thinking',
    listening: 'Listening',
    ready: 'Ready to help',
    step_of: 'Step {n} of {total}',
    ask_placeholder: 'Ask me anything…',
    ask_cta: 'Ask a question',
    chat_answer_title: 'Answer',
    back_to_tour: 'Back to tour',
    restart_tour: 'Replay the tour',
    audio_unavailable: 'This browser has no speech synthesis',
    chat_error:
      "I couldn't answer right now. Try again shortly — or use the AI Assistant in the menu.",
    chat_intro: 'Ask about the platform, your equipment or the technical documentation.',
    chat_offline: 'offline mode — answer assembled from database records only',
    farewell_title: 'Tour complete',
    ask_by_voice: 'Ask by voice',
    stop_listening: 'Stop listening',
    voice_unavailable: 'This browser has no speech recognition',
    transcribing: 'Transcribing…',
  },
};

export const TOUR_COPY: Record<Language, Record<TourStepId, TourStepCopy>> = {
  pt: {
    dashboard: {
      label: 'Painel',
      title: 'A saúde da operação em uma tela',
      speech:
        'Vamos começar pelo Painel. Estes indicadores no topo resumem toda a sua operação: ' +
        'disponibilidade, alertas abertos, anomalias detectadas e quantos equipamentos estão ' +
        'online agora. É a primeira tela que você abre no começo do turno.',
    },
    charts: {
      label: 'Tempo real',
      title: 'A telemetria chegando ao vivo',
      speech:
        'Logo abaixo ficam os gráficos em tempo real. Este acompanha as leituras de toda a frota ' +
        'sem recarregar a página: você escolhe a grandeza e a janela de tempo aqui em cima. ' +
        'Mais abaixo aparecem quando os sensores saíram da faixa, a anomalia de cada ativo ' +
        'e a tendência de conformidade da operação.',
    },
    equipment: {
      label: 'Equipamentos',
      title: 'Cadastro pela placa do motor',
      speech:
        'Esta é a tela dos seus equipamentos: todos ficam listados aqui, com busca e filtros. ' +
        'E é por este botão que entra um novo. Em vez de digitar ficha técnica, você fotografa ' +
        'a placa de identificação. O sistema lê a placa sozinho, extrai potência, tensão, ' +
        'rotação e número de série, e você só confirma o que foi lido.',
    },
    monitoring: {
      label: 'Monitoramento',
      title: 'A fábrica inteira, em tempo real',
      speech:
        'Esta é a planta digital. Cada máquina aparece no lugar onde ela está de verdade no chão ' +
        'de fábrica, marcada com a cor do seu estado atual, e você alterna entre a planta 3D e o ' +
        'mapa 2D. Clique em qualquer uma para abrir a telemetria ao vivo: velocidade de vibração, ' +
        'aceleração e temperatura, com leituras novas a cada dez segundos. Quem configura a planta ' +
        'também reposiciona as máquinas por aqui, no botão Editar planta.',
    },
    predictions: {
      label: 'Predição',
      title: 'A IA que antecipa a falha',
      speech:
        'Este é o Índice de Saúde do equipamento, calculado pelo modelo de anomalias. ' +
        'Ele compara o comportamento de agora com a linha de base da máquina e aponta desvios ' +
        'que ninguém veria no gráfico bruto — como um aquecimento que não se explica pela carga. ' +
        'Junto dele vem a estimativa de vida útil restante e o que deu origem ao diagnóstico.',
    },
    reports: {
      label: 'Relatório',
      title: 'Do diagnóstico à ordem de serviço',
      speech:
        'Tudo o que você viu deste ativo vira relatório em um clique. Em Exportar, você imprime ' +
        'ou salva o PDF, ou recebe o relatório por e-mail com o PDF anexo. E em Agendar ' +
        'Manutenção você define o tipo, a prioridade, a data e o responsável: a ordem é aberta ' +
        'e o responsável recebe o aviso por e-mail.',
    },
    documentation: {
      label: 'Documentação',
      title: 'Pergunte ao manual',
      speech:
        'Toda a documentação técnica dos seus equipamentos fica indexada aqui. ' +
        'Você pergunta em português — por exemplo, qual o torque de aperto do mancal dianteiro — ' +
        'e eu respondo citando o manual e a página de onde veio a informação. ' +
        'Nada de procurar em PDF no meio da manutenção.',
    },
    troubleshooting: {
      label: 'Alertas',
      title: 'Do alerta à ação corretiva',
      speech:
        'Quando algo foge do padrão, o alerta chega aqui — mas não sozinho. ' +
        'Ele vem com o diagnóstico do modelo: o que mudou, desde quando, e qual ação corretiva ' +
        'faz sentido. Você acompanha a investigação e resolve o alerta na própria lista.',
    },
    wrapup: {
      label: 'Tudo pronto',
      title: 'É isso!',
      speech:
        'Pronto! Agora você já conhece as principais funcionalidades da plataforma: ' +
        'painel, gráficos em tempo real, cadastro, monitoramento, predição, relatórios, ' +
        'documentação e alertas. ' +
        'Sempre que precisar de ajuda, é só me chamar aqui no canto da tela.',
    },
  },
  en: {
    dashboard: {
      label: 'Dashboard',
      title: 'Operation health at a glance',
      speech:
        "Let's start with the Dashboard. These top indicators summarise your whole operation: " +
        'availability, open alerts, detected anomalies and how many assets are online right now. ' +
        "It's the first screen you open at the start of a shift.",
    },
    charts: {
      label: 'Live',
      title: 'Telemetry arriving live',
      speech:
        'Right below are the real-time charts. This one follows readings from the whole fleet ' +
        'without reloading the page: pick the metric and the time window up here. Further down ' +
        'you see when sensors went out of range, the anomaly score of each asset and the ' +
        'operation conformity trend.',
    },
    equipment: {
      label: 'Equipment',
      title: 'Register from the motor nameplate',
      speech:
        'This is your equipment screen: everything is listed here, with search and filters. ' +
        'And this button is how a new one comes in. Instead of typing the datasheet, you ' +
        'photograph the equipment nameplate. The system reads it on its own — power, voltage, ' +
        'speed and serial number — and you just confirm what was extracted.',
    },
    monitoring: {
      label: 'Monitoring',
      title: 'The whole plant, in real time',
      speech:
        'This is the digital plant. Every machine appears where it actually stands on the shop ' +
        'floor, marked with its current status colour, and you can switch between the 3D plant ' +
        'and the 2D map. Click any of them to open live telemetry: vibration velocity, ' +
        'acceleration and temperature, with fresh readings every ten seconds. Whoever configures ' +
        'the plant can also reposition machines here, with the Edit layout button.',
    },
    predictions: {
      label: 'Prediction',
      title: 'AI that sees the failure coming',
      speech:
        "This is the asset's Health Index, produced by the anomaly model. It compares current " +
        "behaviour against the machine's own baseline and surfaces deviations nobody would spot " +
        'in the raw chart — such as heating that the load does not explain. Alongside it you get ' +
        'the remaining useful life estimate and what drove the diagnosis.',
    },
    reports: {
      label: 'Report',
      title: 'From diagnosis to work order',
      speech:
        'Everything you saw about this asset becomes a report in one click. Under Export you can ' +
        'print or save the PDF, or get the report by email with the PDF attached. And with ' +
        'Schedule Maintenance you set the type, priority, date and assignee: the work order is ' +
        'opened and the assignee is notified by email.',
    },
    documentation: {
      label: 'Documentation',
      title: 'Ask the manual',
      speech:
        'All the technical documentation for your equipment is indexed here. You ask in plain ' +
        'language — say, the tightening torque for the front bearing — and I answer citing the ' +
        'manual and the page it came from. No more digging through PDFs mid-maintenance.',
    },
    troubleshooting: {
      label: 'Alerts',
      title: 'From alert to corrective action',
      speech:
        "When something drifts out of pattern, the alert lands here — and it doesn't come alone. " +
        'It carries the model diagnosis: what changed, since when, and which corrective action ' +
        'makes sense. You follow the investigation and resolve the alert right in the list.',
    },
    wrapup: {
      label: 'All set',
      title: "That's it!",
      speech:
        'Done! You now know the main capabilities of the platform: dashboard, live charts, ' +
        'registration, monitoring, prediction, reports, documentation and alerts. Whenever you ' +
        'need help, just call me ' +
        'from the corner of the screen.',
    },
  },
};

export const t = (lang: Language, key: string, vars?: Record<string, string | number>) => {
  let value = UI_COPY[lang][key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) value = value.replace(`{${k}}`, String(v));
  }
  return value;
};
