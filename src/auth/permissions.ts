import type { UserRole } from '../types/auth';

/**
 * Quem pode o quê, por capacidade.
 *
 * Este é o ÚNICO lugar do front que conhece papel, e espelha literalmente as
 * policies da migração `0016_rbac_three_roles.sql`. Mudou aqui, muda lá — e
 * vice-versa.
 *
 * Por que capacidade e não lista de papéis: `canWriteAssets` (a versão antiga)
 * acabou reaproveitada para "editar layout" e "remover ativo" ao mesmo tempo,
 * porque naquele momento o conjunto de papéis coincidia. Quando a matriz
 * separou as duas coisas, o alias virou um bug silencioso. Um nome que descreve
 * a AÇÃO não tem como ser reaproveitado para outra.
 *
 * As três faixas:
 *   operar      — os três papéis, com conta ativa
 *   configurar  — admin e engenheiro
 *   administrar — só admin; é quem destrói e quem governa
 */
export type Capability =
  // ── faixa 1: operar ──────────────────────────────────────────────────────
  | 'asset:read'
  | 'alert:acknowledge'
  | 'alert:resolve'
  | 'maintenance:create'
  | 'maintenance:complete'
  | 'nameplate:register'
  // ── faixa 2: configurar ──────────────────────────────────────────────────
  | 'asset:create'
  | 'asset:update'
  | 'asset:deactivate'
  | 'asset:layout'
  | 'nameplate:edit'
  | 'sensor:manage'
  | 'ml:manage'
  | 'document:manage'
  | 'maintenance:assign'
  // ── faixa 3: administrar ─────────────────────────────────────────────────
  | 'asset:delete'
  | 'alert:delete'
  | 'nameplate:delete'
  | 'maintenance:delete'
  | 'sensor:delete'
  | 'document:delete'
  | 'user:manage'
  | 'plant:manage'
  | 'audit:read'
  | 'collector:manage';

/** Espelha `can_operate()` no banco. */
const OPERATE: readonly UserRole[] = ['admin', 'engineer', 'technician'];
/** Espelha `can_configure()`. */
const CONFIGURE: readonly UserRole[] = ['admin', 'engineer'];
/** Espelha `is_admin()`. */
const ADMIN: readonly UserRole[] = ['admin'];

export const CAPABILITIES: Record<Capability, readonly UserRole[]> = {
  'asset:read': OPERATE,
  'alert:acknowledge': OPERATE,
  'alert:resolve': OPERATE,
  'maintenance:create': OPERATE,
  'maintenance:complete': OPERATE,
  'nameplate:register': OPERATE,

  'asset:create': CONFIGURE,
  'asset:update': CONFIGURE,
  'asset:deactivate': CONFIGURE,
  'asset:layout': CONFIGURE,
  'nameplate:edit': CONFIGURE,
  'sensor:manage': CONFIGURE,
  'ml:manage': CONFIGURE,
  'document:manage': CONFIGURE,
  'maintenance:assign': CONFIGURE,

  'asset:delete': ADMIN,
  'alert:delete': ADMIN,
  'nameplate:delete': ADMIN,
  'maintenance:delete': ADMIN,
  'sensor:delete': ADMIN,
  'document:delete': ADMIN,
  'user:manage': ADMIN,
  'plant:manage': ADMIN,
  'audit:read': ADMIN,
  'collector:manage': ADMIN,
};

/**
 * Como as capacidades se agrupam na matriz de permissões da tela de Usuários.
 *
 * Ordem e recorte são de apresentação — quem decide o que cada papel pode
 * fazer continua sendo `CAPABILITIES` acima, e antes dele a RLS no banco. O
 * rótulo de cada linha vive em `translations`, não aqui: este arquivo não
 * conhece idioma.
 */
export const CAPABILITY_GROUPS = [
  {
    id: 'assets',
    caps: ['asset:read', 'asset:create', 'asset:update', 'asset:deactivate', 'asset:layout', 'asset:delete'],
  },
  { id: 'alerts', caps: ['alert:acknowledge', 'alert:resolve', 'alert:delete'] },
  {
    id: 'maintenance',
    caps: ['maintenance:create', 'maintenance:complete', 'maintenance:assign', 'maintenance:delete'],
  },
  { id: 'nameplate', caps: ['nameplate:register', 'nameplate:edit', 'nameplate:delete'] },
  { id: 'sensors', caps: ['sensor:manage', 'sensor:delete'] },
  { id: 'documents', caps: ['document:manage', 'document:delete'] },
  { id: 'ml', caps: ['ml:manage'] },
  { id: 'plant', caps: ['plant:manage', 'collector:manage'] },
  { id: 'admin', caps: ['user:manage', 'audit:read'] },
] as const satisfies readonly { id: string; caps: readonly Capability[] }[];

export type CapabilityGroupId = (typeof CAPABILITY_GROUPS)[number]['id'];

/**
 * Trava de compilação: capacidade que não entrou em nenhum grupo quebra o
 * build aqui. Sem isto, criar uma `Capability` nova e esquecer o grupo faria
 * ela sumir da matriz em silêncio — a tela seguiria bonita, dizendo que o
 * papel não pode algo que ele pode.
 */
type UngroupedCapability = Exclude<Capability, (typeof CAPABILITY_GROUPS)[number]['caps'][number]>;
const _everyCapabilityIsGrouped: UngroupedCapability extends never ? true : never = true;
void _everyCapabilityIsGrouped;

export function can(role: UserRole | null | undefined, cap: Capability): boolean {
  return !!role && CAPABILITIES[cap].includes(role);
}

/** Todas as capacidades de um papel — usado na tela de conta. */
export function capabilitiesOf(role: UserRole | null | undefined): Capability[] {
  if (!role) return [];
  return (Object.keys(CAPABILITIES) as Capability[]).filter((c) => can(role, c));
}
