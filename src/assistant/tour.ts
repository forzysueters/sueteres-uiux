import type { TourStepDef } from './types';

/**
 * Roteiro do tour — estrutura apenas (para onde ir, o que destacar).
 *
 * A ligação com o site existente é feita por `data-tour`, um atributo puramente
 * declarativo: ele não muda layout, classe nem comportamento de nada. Cada
 * etapa lista alternativas em ordem de preferência, e o resolvedor escolhe a
 * primeira que estiver de fato visível — é assim que o mesmo roteiro funciona
 * no desktop (onde o menu está na barra) e no celular (onde ele está recolhido).
 */
export const TOUR_STEPS: TourStepDef[] = [
  {
    id: 'dashboard',
    route: '/dashboard',
    targets: ['[data-tour="dashboard-kpis"]', 'nav a[href="/dashboard"]'],
    padding: 10,
  },
  {
    id: 'charts',
    route: '/dashboard',
    targets: ['[data-tour="dashboard-charts"]', '[data-tour="dashboard-kpis"]'],
    padding: 8,
  },
  {
    id: 'equipment',
    route: '/equipamentos',
    // O formulário só existe no DOM com o diálogo aberto; o botão que o abre
    // está sempre lá. Se o usuário já tiver aberto o diálogo, o formulário é
    // o alvo melhor e o resolvedor promove para ele.
    targets: [
      '[data-tour="equipment-registration"]',
      '[data-tour="equipment-registration-cta"]',
      'nav a[href="/equipamentos"]',
    ],
    padding: 8,
  },
  {
    id: 'monitoring',
    route: '/planta',
    targets: ['[data-tour="plant-scene"]', 'nav a[href="/planta"]'],
    padding: 8,
  },
  {
    id: 'predictions',
    // Abre um ativo de verdade quando houver um; senão fica na visão da planta.
    route: (ctx) => (ctx.focusAssetId ? `/planta/ativo/${ctx.focusAssetId}` : '/planta'),
    targets: [
      '[data-tour="health-index"]',
      '[data-tour="triage-rail"]',
      '[data-tour="dashboard-kpis"]',
    ],
    padding: 10,
  },
  {
    id: 'reports',
    // Mesmo ativo da etapa anterior: a barra de ações só existe na tela dele.
    route: (ctx) => (ctx.focusAssetId ? `/planta/ativo/${ctx.focusAssetId}` : '/planta'),
    targets: ['[data-tour="asset-actions"]', '[data-tour="triage-rail"]'],
    padding: 6,
  },
  {
    id: 'documentation',
    route: '/assistente',
    // Sem alternativa de menu: o Assistente não está mais na navbar.
    targets: ['[data-tour="ai-chat"]'],
    padding: 8,
  },
  {
    id: 'troubleshooting',
    route: '/alertas',
    targets: ['[data-tour="alerts-list"]', 'nav a[href="/alertas"]'],
    padding: 8,
  },
  {
    id: 'wrapup',
    targets: [],
  },
];
