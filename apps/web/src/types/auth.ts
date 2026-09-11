export type UserRole = 'admin' | 'engineer' | 'technician';

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
  /** Conta desativada não autentica: o authStore a trata como não logada. */
  isActive?: boolean;
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
};

/**
 * Quem pode o quê mora em `src/auth/permissions.ts`, por CAPACIDADE.
 *
 * As antigas `canWrite`/`canWriteAssets` foram removidas de propósito: eram
 * listas de papéis, e um mesmo teste acabava reaproveitado para capacidades
 * diferentes (`mayEditLayout = mayRemoveAsset`) — que no modelo atual divergem.
 */
