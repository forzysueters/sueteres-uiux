export type UserRole = 'admin' | 'engineer' | 'technician' | 'viewer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  jobTitle?: string | null;
  department?: string | null;
  avatarUrl?: string | null;
  plantId?: string | null;
  lastLoginAt?: string | null;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  /** true até a sessão persistida ser resolvida no boot. */
  isInitializing: boolean;
  error: string | null;
  isAuthenticated: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

/** Rótulos de exibição por papel. */
export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  engineer: 'Engenheiro',
  technician: 'Técnico de Manutenção',
  viewer: 'Visualizador',
};

/** Papéis que escrevem dados operacionais — espelha public.can_write() no banco. */
export const WRITE_ROLES: UserRole[] = ['admin', 'engineer', 'technician'];

export function canWrite(role: UserRole | undefined | null): boolean {
  return !!role && WRITE_ROLES.includes(role);
}
