import { Router } from 'express';
import {
  login,
  refresh,
  logout,
  verify
} from '../controllers/auth.controller.js';

const router = Router();

// POST /auth/login - Login with email and password
router.post('/login', login);

// POST /auth/refresh - Refresh access token using refresh token cookie
router.post('/refresh', refresh);

// POST /auth/logout - Logout and invalidate refresh token
router.post('/logout', logout);

// GET /auth/verify - Check if user is authenticated (for client-side verification)
router.get('/verify', verify);

export default router;
