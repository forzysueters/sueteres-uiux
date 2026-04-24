export type UserRole = 'admin' | 'engineer' | 'technician';

export interface User {
  id: string;
  name: string;
  email: string;
  password: string; // hashed
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  };
}

export interface RefreshTokenPayload {
  userId: string;
  email: string;
}
