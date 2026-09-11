import type { Asset } from '../types';
import type { TourStepCopy, TourStepDef } from './types';

export type FleetScope = 'assets' | 'motors';
export type SummaryStep = TourStepDef & { copy: TourStepCopy };

export function fleetSummaryIntent(question: string): FleetScope | null {
  const q = question.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (!/\b(resum\w*|panorama|situacao|status|como\s+(?:estao|estavam)|visao geral)\b/.test(q)) return null;
  if (/\bativos\b|\bequipamentos\b|\bplanta\b/.test(q)) return 'assets';
  if (/\bmotores\b/.test(q)) return 'motors';
  // Pedidos sem objeto usam a planta como contexto padrão. A expressão é
  // fechada para não transformar resumos de manuais ou conversas em navegação.
  const generic = q.replace(/[,.!?;:]/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/^(?:orion\s+)?(?:por favor\s+)?/, '')
    .replace(/\s+por favor$/, '');
  return /^(?:(?:voce pode|pode|poderia)\s+)?(?:(?:me\s+)?(?:faca|fazer|faz|de|dar|mostre|mostrar|quero|preciso de)\s+)?(?:me\s+)?(?:um\s+|o\s+)?(?:resumo(?:\s+geral)?|panorama|visao geral)$/.test(generic)
    || /^(?:me\s+)?resum(?:a|ir)(?:\s+tudo)?$/.test(generic)
    ? 'assets' : null;
}

export function buildFleetSummary(assets: Asset[], scope: FleetScope): SummaryStep[] {
  const selected = assets.filter(a => scope === 'assets' || a.type === 'motor');
  const rank = { critical: 0, warning: 1, offline: 2, normal: 3 };
  const labels = { critical: 'crítico', warning: 'em alerta', offline: 'offline', normal: 'normal' };
  const noun = scope === 'motors' ? 'motores' : 'ativos';
  const count = (status: Asset['status']) => selected.filter(a => a.status === status).length;
  const intro = selected.length
    ? `Consultei ${selected.length} ${noun}: ${count('normal')} em estado normal, ${count('warning')} em alerta, ${count('critical')} críticos e ${count('offline')} offline. Vou mostrar cada um, começando pelos que precisam de atenção. Este resumo é uma fotografia dos dados consultados agora; as telas podem receber novas leituras.`
    : `Não há ${noun} disponíveis para consulta.`;
  return [
    { id: 'monitoring', route: '/planta', targets: ['[data-tour="plant-scene"]'], copy: { label: 'Panorama', title: `Resumo dos ${noun}`, speech: intro } },
    ...[...selected].sort((a, b) => rank[a.status] - rank[b.status] || a.tag.localeCompare(b.tag)).map((a): SummaryStep => {
      const abnormal = a.sensors.filter(s => s.status !== 'normal');
      const readings = abnormal.map(s => `${s.name}: ${s.value} ${s.unit}, ${labels[s.status]}`).join('; ');
      const telemetry = a.sensors.length === 0
        ? 'Sem sensores cadastrados: não é possível avaliar a condição operacional por telemetria.'
        : a.status === 'offline'
          ? 'O ativo está offline; não é possível confirmar sua condição atual pelas leituras disponíveis.'
          : readings ? `Sensores que precisam de atenção: ${readings}.` : `Os ${a.sensors.length} sensores estão dentro dos limites configurados.`;
      return {
        id: 'predictions', route: `/planta/ativo/${encodeURIComponent(a.id)}`,
        targets: ['[data-tour="health-index"]', '[data-tour="triage-rail"]'],
        copy: { label: a.tag, title: `${a.tag} — ${a.name}`, speech: `${a.tag}, ${a.name}, em ${a.location}. Estado ${labels[a.status]}. ${telemetry}` },
      };
    }),
    ...(selected.length ? [{ id: 'troubleshooting' as const, route: '/alertas', targets: ['[data-tour="alerts-list"]'], copy: { label: 'Alertas', title: 'Próximos passos', speech: `Concluí o resumo dos ${noun}. Nesta tela você pode conferir os alertas da planta. Priorize os estados críticos, depois os avisos, e verifique a comunicação dos ativos offline. Consulte o detalhe do ativo antes de definir uma intervenção.` } }] : []),
  ];
}
