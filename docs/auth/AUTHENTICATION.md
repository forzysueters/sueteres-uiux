# 🔐 Authentication System Documentation

## Overview

This is a production-ready authentication system for the Industrial Digital Twin platform with:
- **JWT Access Tokens** (15-minute expiry)
- **Refresh Tokens** (7-day expiry, httpOnly cookies)
- **Bcrypt password hashing**
- **Role-Based Access Control (RBAC)**
- **Automatic token refresh**
- **Secure logout**

---

## Architecture

### Backend (Node.js + Express + TypeScript)

```
/server
├── src/
│   ├── controllers/
│   │   └── auth.controller.ts       # Login, refresh, logout
│   ├── routes/
│   │   └── auth.ts                  # Route definitions
│   ├── services/
│   │   ├── user.service.ts          # User management
│   │   └── token.service.ts         # JWT generation/validation
│   ├── middleware/
│   │   └── auth.ts                  # authenticateToken, authorizeRole
│   ├── types/
│   │   └── index.ts                 # TypeScript interfaces
│   └── index.ts                     # Express app setup
├── package.json
├── tsconfig.json
└── .env.example
```

### Frontend (React + TypeScript + Zustand)

```
/src
├── pages/
│   └── LoginPage.tsx                # Login UI
├── components/
│   ├── ProtectedRoute.tsx           # Route protection wrapper
│   ├── TokenRefresher.tsx           # Auto-refresh logic
│   └── UserProfile.tsx              # User info + logout
├── services/
│   └── authAPI.ts                   # API client
├── store/
│   └── authStore.ts                 # Auth state management
├── types/
│   └── auth.ts                      # Auth interfaces
└── App.tsx                          # Integrated auth flow
```

---

## API Endpoints

### POST `/auth/login`
Login with email and password.

**Request:**
```json
{
  "email": "admin@industrial.com",
  "password": "password123"
}
```

**Response (200 OK):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "1",
    "name": "Admin User",
    "email": "admin@industrial.com",
    "role": "admin"
  }
}
```

**Sets Cookie:**
- `refresh_token` (httpOnly, Secure, SameSite=Strict, 7-day expiry)

---

### POST `/auth/refresh`
Refresh the access token using the refresh token cookie.

**Request:**
- Sends `refresh_token` cookie automatically

**Response (200 OK):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "1",
    "name": "Admin User",
    "email": "admin@industrial.com",
    "role": "admin"
  }
}
```

---

### POST `/auth/logout`
Logout and invalidate the refresh token.

**Request:**
- Sends `refresh_token` cookie automatically

**Response (200 OK):**
```json
{
  "message": "Logged out successfully"
}
```

---

### GET `/auth/verify`
Check if user is authenticated (for client-side verification).

**Response (200 OK):**
```json
{
  "authenticated": true,
  "user": {
    "id": "1",
    "name": "Admin User",
    "email": "admin@industrial.com",
    "role": "admin"
  }
}
```

**Response (401 if not authenticated):**
```json
{
  "authenticated": false
}
```

---

## Authentication Flow

### 1. Login
```
User → POST /auth/login (email, password)
           ↓
       Backend validates credentials with bcrypt
           ↓
       Generates JWT access token (15min)
       Generates refresh token (7 days)
           ↓
       Returns accessToken + user + sets httpOnly cookie
           ↓
Frontend → Stores accessToken in memory
         → Sets auth state (user, isAuthenticated)
```

### 2. API Calls
```
Frontend → Adds "Authorization: Bearer <accessToken>" header
        ↓
Backend → middleware: authenticateToken
        ↓
JWT verified & decoded
        ↓
Request processed
```

### 3. Token Refresh (Automatic)
```
Access token expires (15 min) → API returns 403
           ↓
Frontend catches error → calls POST /auth/refresh
           ↓
Backend validates refresh_token cookie
           ↓
Returns new accessToken
           ↓
Frontend updates token & retries original request
```

### 4. Logout
```
User → Logout button
    ↓
Frontend → POST /auth/logout (refresh_token sent via cookie)
         → Clear accessToken from memory
         → Clear auth state
    ↓
Backend → Delete refresh_token from store
       → Clear cookie
    ↓
Frontend → Redirect to login
```

---

## Demo Credentials

Use these to test the authentication system:

```
Email                      | Password    | Role
---------------------------|-------------|------------
admin@industrial.com       | password123 | admin
engineer@industrial.com    | password123 | engineer
technician@industrial.com  | password123 | technician
```

---

## Security Features

### ✅ Password Security
- Bcrypt hashing with salt rounds = 10
- Never stored or transmitted in plain text
- Passwords validated on every login

### ✅ Token Security
- **Access Token**: Short-lived (15 min), revoked on logout
- **Refresh Token**: Long-lived (7 days), httpOnly cookie
  - Immune to XSS (not accessible via JavaScript)
  - Secure flag (HTTPS only in production)
  - SameSite=Strict (CSRF protection)

### ✅ JWT Validation
- Signed with HS256 algorithm
- Secret key stored in environment variables
- Verified on every protected request

### ✅ CORS Protection
- Only trusted origins allowed (configurable)
- Credentials included only from same origin

### ✅ Error Handling
- Generic error messages (don't reveal if email exists)
- Sensitive information never exposed
- Proper HTTP status codes (401, 403, 500)

### ✅ Role-Based Access Control
- Middleware: `authorizeRole(['admin', 'engineer'])`
- Frontend: Conditional UI rendering based on user.role
- Protected routes redirect if unauthorized

---

## Setup & Installation

### Backend

1. **Navigate to server directory:**
   ```bash
   cd server
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create `.env` file from `.env.example`:**
   ```bash
   copy .env.example .env
   ```

4. **Update `.env` with your secrets:**
   ```
   JWT_SECRET=your-super-secret-key-minimum-32-chars
   JWT_REFRESH_SECRET=your-refresh-secret-key-minimum-32-chars
   CORS_ORIGIN=http://localhost:5173
   ```

5. **Start development server:**
   ```bash
   npm run dev
   ```

   Server runs on `http://localhost:3000`

### Frontend

1. **Install dependencies (from root):**
   ```bash
   npm install
   ```

2. **Create `.env` file:**
   ```bash
   copy .env.example .env
   ```

3. **Update `.env`:**
   ```
   VITE_API_URL=http://localhost:3000
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

   Frontend runs on `http://localhost:5173`

---

## Testing the Authentication

### 1. Open your browser
```
http://localhost:5173
```

### 2. Login with demo credentials
```
Email: admin@industrial.com
Password: password123
```

### 3. You should see:
- ✅ Dashboard loads
- ✅ User profile visible in sidebar
- ✅ Navigation items active

### 4. Test token refresh
```
Open DevTools → Application → Cookies
You'll see: refresh_token (httpOnly)

Open DevTools → Console:
localStorage.getItem('accessToken') 
// Shows JWT token in memory
```

### 5. Test automatic refresh
```
Wait 10 minutes (or manually trigger)
Frontend automatically refreshes the token
No logout unless refresh fails
```

### 6. Test logout
```
Click "Logout" button
Token cleared
Redirected to login
```

---

## Production Checklist

- [ ] Update `JWT_SECRET` and `JWT_REFRESH_SECRET` to strong, random values
- [ ] Enable HTTPS in production
- [ ] Set `NODE_ENV=production`
- [ ] Replace in-memory token store with Redis or database
- [ ] Implement rate limiting on `/auth/login`
- [ ] Add logging and monitoring
- [ ] Use environment variables for all secrets
- [ ] Implement token blacklist for revoked tokens
- [ ] Add refresh token rotation (issue new refresh token on each refresh)
- [ ] Set secure cookie flags properly (already done)
- [ ] Configure CORS correctly for your domain
- [ ] Add password requirements (length, complexity)
- [ ] Implement user session tracking
- [ ] Add MFA (multi-factor authentication) for admins

---

## Integrating Protected Routes

```typescript
// Example: Admin-only route
import { ProtectedRoute } from './components/ProtectedRoute';

function AdminPanel() {
  return (
    <ProtectedRoute requiredRoles={['admin']}>
      <div>Admin content here</div>
    </ProtectedRoute>
  );
}
```

---

## Role-Based UI Rendering

```typescript
import { useAuthStore } from './store/authStore';

function Dashboard() {
  const { user } = useAuthStore();

  return (
    <div>
      {user?.role === 'admin' && (
        <AdminSection />
      )}
      
      {['admin', 'engineer'].includes(user?.role || '') && (
        <EngineeringTools />
      )}
      
      {/* Available to all authenticated users */}
      <MainDashboard />
    </div>
  );
}
```

---

## Troubleshooting

### "Invalid credentials" on correct password
- Check if user exists in `user.service.ts`
- Verify bcrypt hash is initialized

### CORS error when logging in
- Ensure `CORS_ORIGIN` in backend `.env` matches frontend URL
- Check browser console for exact error

### Token keeps expiring
- Verify `TokenRefresher` component is active
- Check if refresh token cookie is being set
- Look at browser DevTools → Cookies for `refresh_token`

### Logout not working
- Ensure refresh_token cookie exists
- Check if backend is clearing it properly

---

## Next Steps

1. **Database Integration**: Replace in-memory users with PostgreSQL
2. **Email Verification**: Add signup with email confirmation
3. **Password Reset**: Implement forgot password flow
4. **Multi-Factor Authentication**: Add TOTP/SMS
5. **Audit Logging**: Track all auth events
6. **Session Management**: Limit concurrent sessions per user
7. **Social Login**: Add OAuth (Google, Microsoft, etc.)
