import jwt from 'jsonwebtoken';
import { JWTPayload, RefreshTokenPayload } from '../types/index.js';

// Store refresh tokens in-memory. In production, use Redis or database
const refreshTokenStore = new Set<string>();

export const generateAccessToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, process.env.JWT_SECRET || 'your-secret-key', {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m'
  });
};

export const generateRefreshToken = (payload: RefreshTokenPayload): string => {
  const token = jwt.sign(
    payload,
    process.env.JWT_REFRESH_SECRET || 'your-refresh-secret',
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
    }
  );

  // Store token for validation
  refreshTokenStore.add(token);
  return token;
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload | null => {
  if (!refreshTokenStore.has(token)) {
    return null;
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_REFRESH_SECRET || 'your-refresh-secret'
    ) as RefreshTokenPayload;
    return decoded;
  } catch (error) {
    return null;
  }
};

export const revokeRefreshToken = (token: string): void => {
  refreshTokenStore.delete(token);
};

export const getAllRefreshTokens = (): string[] => {
  return Array.from(refreshTokenStore);
};
