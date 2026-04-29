# 🚀 Quick Start Guide - Running the Application

## Prerequisites

- Node.js 16+ (https://nodejs.org/)
- npm or yarn
- A code editor (VS Code recommended)

---

## ⚡ Start Both Backend & Frontend

### Option 1: Two Terminal Windows (Recommended)

**Terminal 1 - Start Backend:**
```bash
cd server
npm install
npm run dev
```

You should see:
```
✅ Server running on http://localhost:3000
🔐 CORS enabled for: http://localhost:5173
```

**Terminal 2 - Start Frontend:**
```bash
npm install
npm run dev
```

You should see:
```
VITE v5.0.0  ready in 1234 ms

➜  Local:   http://localhost:5173/
```

### Option 2: Single Terminal with Concurrently (Optional)

Install globally or locally:
```bash
npm install -g concurrently
```

From root directory:
```bash
npm install
cd server && npm install && cd ..
npm run dev:all
```

(Requires updating root `package.json` with concurrently script)

---

## 🔐 Login

Open browser: **http://localhost:5173**

### Demo Credentials

Pick any of these to test:

| Role       | Email                    | Password    |
|-----------|--------------------------|-------------|
| Admin     | admin@industrial.com     | password123 |
| Engineer  | engineer@industrial.com  | password123 |
| Technician| technician@industrial.com| password123 |

---

## 📋 Testing Checklist

After logging in, verify:

- ✅ **Dashboard loads** - You see the industrial dashboard
- ✅ **User profile visible** - Check sidebar for your name and role
- ✅ **Navigation works** - Click between tabs (Dashboard, Plant, Alerts, etc.)
- ✅ **Logout button** - Click to log out and redirect to login
- ✅ **Token in memory** - Open DevTools → Console:
  ```javascript
  localStorage.getItem('accessToken')
  // Should show a JWT token
  ```
- ✅ **Refresh token cookie** - DevTools → Application → Cookies:
  ```
  Should see: refresh_token (httpOnly, Secure, SameSite=Strict)
  ```

---

## 🔧 Environment Configuration

### Backend (.env)

Located at: `/server/.env`

```
PORT=3000
NODE_ENV=development
JWT_SECRET=your-secret-key-here
JWT_REFRESH_SECRET=your-refresh-secret-here
CORS_ORIGIN=http://localhost:5173
```

### Frontend (.env)

Located at: `/.env`

```
VITE_API_URL=http://localhost:3000
```

---

## 🛠️ Common Issues

### Backend won't start
```bash
# Clear cache
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Frontend won't connect to backend
- Check if backend is running on port 3000
- Verify `VITE_API_URL` in frontend `.env`
- Check browser console for CORS errors

### Can't login with correct credentials
- Check backend console for errors
- Verify demo credentials above
- Restart backend server

### Token keeps expiring
- This is expected! System auto-refreshes every 10 minutes
- You should NOT see logout unless manual refresh fails
- Check browser console for any errors

---

## 📂 Project Structure

```
industrial-digital-twin/
├── server/                    # Backend (Node.js + Express)
│   ├── src/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── middleware/
│   │   ├── types/
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
│
├── src/                       # Frontend (React + TypeScript)
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   └── Dashboard.tsx
│   ├── components/
│   │   ├── ProtectedRoute.tsx
│   │   ├── TokenRefresher.tsx
│   │   └── UserProfile.tsx
│   ├── services/
│   │   └── authAPI.ts
│   ├── store/
│   │   ├── authStore.ts
│   │   └── appStore.ts
│   ├── types/
│   │   └── auth.ts
│   └── App.tsx
│
├── package.json
├── tsconfig.json
├── vite.config.ts
└── AUTHENTICATION.md
```

---

## 🔐 Security Features Enabled

✅ bcrypt password hashing  
✅ JWT access tokens (15min)  
✅ Refresh tokens (7 days)  
✅ httpOnly secure cookies  
✅ CORS protection  
✅ Role-based access control  
✅ Automatic token refresh  
✅ Secure logout  

---

## 📖 Full Documentation

For detailed information about:
- Authentication architecture
- API endpoints
- Token flow
- Security decisions
- Production checklist
- Role-based access control

👉 See: **`AUTHENTICATION.md`**

---

## 🎯 Next Steps

1. **Customize for production** - Update JWT secrets in `.env`
2. **Connect to database** - Replace in-memory user store
3. **Add more features** - Signup, password reset, MFA
4. **Deploy** - Use Docker, Vercel, or your preferred platform
5. **Monitor** - Add logging and error tracking

---

## 🆘 Need Help?

Check the AUTHENTICATION.md for:
- Detailed API documentation
- Architecture diagrams
- Advanced configuration
- Troubleshooting guide

---

**Happy coding! 🚀**
