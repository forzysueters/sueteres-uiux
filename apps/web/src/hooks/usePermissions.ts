import { useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import { can as canRole, capabilitiesOf } from '../auth/permissions';
import type { Capability } from '../auth/permissions';

/**
 * Capacidades do usuário logado.
 *
 * O papel chega de forma ASSÍNCRONA (o `verifyAuth` resolve a sessão e busca o
 * perfil depois do primeiro render), então no boot `role` é `null` e tudo
 * devolve `false`. Componentes que só renderizam condicionalmente lidam bem com
 * isso; efeitos que dependem de permissão precisam declarar a capacidade como
 * dependência, senão rodam uma vez com o papel vazio e nunca mais.
 */
export function usePermissions() {
  const role = useAuthStore((s) => s.user?.role) ?? null;

  return useMemo(() => ({
    role,
    can: (cap: Capability) => canRole(role, cap),
    capabilities: capabilitiesOf(role),
    isAdmin: role === 'admin',
  }), [role]);
}
