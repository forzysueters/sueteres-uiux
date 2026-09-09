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

export function can(role: UserRole | null | undefined, cap: Capability): boolean {
  return !!role && CAPABILITIES[cap].includes(role);
}

/** Todas as capacidades de um papel — usado na tela de conta. */
export function capabilitiesOf(role: UserRole | null | undefined): Capability[] {
  if (!role) return [];
  return (Object.keys(CAPABILITIES) as Capability[]).filter((c) => can(role, c));
}
