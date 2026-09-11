import React from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';
import type { Capability } from './permissions';

/**
 * Renderiza os filhos só se o papel tiver a capacidade.
 *
 * ESCONDE, não desabilita: botão cinza que o usuário nunca vai poder usar é
 * ruído permanente, e clicar para descobrir que não pode é pior ainda. Onde a
 * ação for central demais para sumir sem explicação, use `usePermissions()`
 * direto e renderize uma alternativa.
 */
export const Can: React.FC<{
  do: Capability;
  children: React.ReactNode;
  /** Opcional: o que mostrar no lugar (ex.: um aviso do papel necessário). */
  fallback?: React.ReactNode;
}> = ({ do: capability, children, fallback = null }) => {
  const { can } = usePermissions();
  return <>{can(capability) ? children : fallback}</>;
};

/**
 * Guarda de rota. Sem a capacidade, redireciona para a planta em vez de mostrar
 * uma tela de erro — a rota simplesmente não existe para esse papel, e o item
 * de menu correspondente também está escondido.
 */
export const RequireCapability: React.FC<{
  cap: Capability;
  children: React.ReactElement;
}> = ({ cap, children }) => {
  const { can } = usePermissions();
  return can(cap) ? children : <Navigate to="/planta" replace />;
};
