import jwt from 'jsonwebtoken';
import { JWTPayload, RefreshTokenPayload } from '../types/index.js';

// Revocation blocklist (in-memory). We deliberately do NOT keep an allowlist of
// issued tokens: a refresh token's authenticity is already guaranteed by its JWT
// signature + expiry, and an allowlist gets wiped on every server restart —
// silently invalidating every active session and bouncing users back to login.
// So we only track tokens that were explicitly revoked (via logout).
// In production, back this with Redis/DB so revocations survive restarts too.
const revokedRefreshTokens = new Set<string>();

export const generateAccessToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, process.env.JWT_SECRET || 'your-secret-key', {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m'
  });
};

export const generateRefreshToken = (payload: RefreshTokenPayload): string => {
  return jwt.sign(
    payload,
    process.env.JWT_REFRESH_SECRET || 'your-refresh-secret',
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
    }
  );
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload | null => {
  // Explicitly revoked (logout) → reject even if still unexpired.
  if (revokedRefreshTokens.has(token)) {
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
  revokedRefreshTokens.add(token);
};
