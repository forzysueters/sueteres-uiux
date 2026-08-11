import { ReactNode } from 'react';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { ROLE_LABELS, type UserRole } from '../types/auth';

interface ProtectedRouteProps {
  children: ReactNode;
  /** Papéis autorizados. Omitir libera para qualquer usuário autenticado. */
  requiredRoles?: UserRole[];
}

/**
 * Guarda de rota por papel.
 *
 * É uma barreira de interface: o controle efetivo está nas policies de RLS do
 * banco, que recusam a operação mesmo se esta verificação for contornada.
 */
export const ProtectedRoute = ({ children, requiredRoles }: ProtectedRouteProps) => {
  const { isAuthenticated, isInitializing, user } = useAuthStore();

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <ShieldAlert className="w-10 h-10 text-red-500 mb-4" />
        <h2 className="text-foreground dark:text-white">Acesso negado</h2>
        <p className="text-sm text-muted mt-1">
          Você precisa estar autenticado para ver esta página.
        </p>
      </div>
    );
  }

  if (requiredRoles && !requiredRoles.includes(user.role)) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <ShieldAlert className="w-10 h-10 text-amber-500 mb-4" />
        <h2 className="text-foreground dark:text-white">Permissão insuficiente</h2>
        <p className="text-sm text-muted mt-1">
          Esta área exige o perfil: {requiredRoles.map((r) => ROLE_LABELS[r]).join(' ou ')}.
        </p>
        <p className="text-xs text-muted-soft mt-2">
          Seu perfil atual: {ROLE_LABELS[user.role]}
        </p>
      </div>
    );
  }

  return <>{children}</>;
};
