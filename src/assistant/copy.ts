import type { Language, TourStepCopy, TourStepId } from './types';

/** Nome do personagem. Trocar aqui muda em toda a interface e na narração. */
export const ASSISTANT_NAME = 'Órion';

export const UI_COPY: Record<Language, Record<string, string>> = {
  pt: {
    role: 'Assistente virtual',
    open: `Falar com o ${ASSISTANT_NAME}`,
    close: 'Fechar',
    greeting_title: `Olá! Eu sou o ${ASSISTANT_NAME}.`,
    greeting_speech:
      `Olá! Eu sou o ${ASSISTANT_NAME}, seu assistente virtual aqui na plataforma. ` +
      'Ela reúne, em um único lugar, o monitoramento dos seus equipamentos em tempo real ' +
      'e a inteligência artificial que antecipa falhas antes que elas parem a produção. ' +
      'Quer que eu te mostre como funciona? Leva menos de dois minutos.',
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
    farewell_title: 'Tour concluído',
  },
  en: {
    role: 'Virtual assistant',
    open: `Talk to ${ASSISTANT_NAME}`,
    close: 'Close',
    greeting_title: `Hi! I'm ${ASSISTANT_NAME}.`,
    greeting_speech:
      `Hi! I'm ${ASSISTANT_NAME}, your virtual assistant on this platform. ` +
      'It brings together real-time monitoring of your equipment and the AI that ' +
      'anticipates failures before they stop production. ' +
      'Would you like me to show you around? It takes less than two minutes.',
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
    farewell_title: 'Tour complete',
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
    equipment: {
      label: 'Equipamentos',
      title: 'Cadastro pela placa do motor',
      speech:
        'Aqui é onde tudo começa. Em vez de digitar ficha técnica, você fotografa a placa de ' +
        'identificação do equipamento. O sistema lê a placa sozinho, extrai potência, tensão, ' +
        'rotação e número de série, e você só confirma o que foi lido.',
    },
    monitoring: {
      label: 'Monitoramento',
      title: 'A fábrica inteira, em tempo real',
      speech:
        'Esta é a planta digital. Cada máquina aparece no lugar onde ela está de verdade no chão ' +
        'de fábrica, pintada com a cor do seu estado atual. Clique em qualquer uma para abrir a ' +
        'telemetria ao vivo: tensão, corrente, temperatura e vibração, atualizadas a cada dois segundos.',
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
        'painel, cadastro, monitoramento, predição, documentação e alertas. ' +
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
    equipment: {
      label: 'Equipment',
      title: 'Register from the motor nameplate',
      speech:
        'This is where everything starts. Instead of typing the datasheet, you photograph the ' +
        'equipment nameplate. The system reads it on its own — power, voltage, speed and serial ' +
        'number — and you just confirm what was extracted.',
    },
    monitoring: {
      label: 'Monitoring',
      title: 'The whole plant, in real time',
      speech:
        'This is the digital plant. Every machine appears where it actually stands on the shop ' +
        'floor, painted with its current status. Click any of them to open live telemetry: ' +
        'voltage, current, temperature and vibration, refreshed every two seconds.',
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
        'Done! You now know the main capabilities of the platform: dashboard, registration, ' +
        'monitoring, prediction, documentation and alerts. Whenever you need help, just call me ' +
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
