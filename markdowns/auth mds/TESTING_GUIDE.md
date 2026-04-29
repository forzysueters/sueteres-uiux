# 🧪 TESTING & VERIFICATION GUIDE

## Quick Verification (5 minutes)

### ✅ Step 1: Start Backend
```cmd
cd server
npm install
npm run dev
```

**Expected Output:**
```
✅ Server running on http://localhost:3000
🔐 CORS enabled for: http://localhost:5173
```

### ✅ Step 2: Start Frontend
```cmd
npm install
npm run dev
```

**Expected Output:**
```
VITE v5.0.0  ready in 1234 ms

➜  Local:   http://localhost:5173/
```

### ✅ Step 3: Open Browser
Navigate to: `http://localhost:5173`

You should see the **LoginPage** with:
- Industrial Digital Twin banner
- Email/password form
- Demo credentials reference
- Security badge

### ✅ Step 4: Login
```
Email:    admin@industrial.com
Password: password123
```

Click **Sign In**

### ✅ Step 5: Verify Dashboard
You should see:
- ✅ Dashboard page loads
- ✅ Sidebar with navigation items
- ✅ User profile in sidebar footer
- ✅ "Admin" role badge
- ✅ Logout button available

**If you see all of these → Authentication is working! ✅**

---

## 🔍 Detailed Verification Tests

### Test 1: Token Storage
**Verify tokens are stored correctly**

1. Login with `admin@industrial.com / password123`
2. Open **DevTools** (F12)
3. Go to **Application** tab
4. Check **Local Storage**:
   ```
   Key: accessToken
   Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
5. Check **Cookies**:
   ```
   Name: refresh_token
   Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   HttpOnly: ✅ (checked)
   Secure: ❌ (unchecked - OK for localhost)
   SameSite: Strict ✅
   ```

**Expected**: Both tokens present, httpOnly cookie set

✅ **PASS** if tokens visible and httpOnly is checked

---

### Test 2: API Call with Auth Header
**Verify Authorization header is sent**

1. Login as admin
2. Open **DevTools** → **Network** tab
3. Navigate to any page (Dashboard, Plant, Alerts, etc.)
4. Look for API requests (or make one)
5. Click on request → **Headers** tab
6. Scroll to **Request Headers**
7. Find: `Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

**Expected**: Authorization header present in requests

✅ **PASS** if Authorization header visible

---

### Test 3: Auto-Token Refresh
**Verify tokens refresh automatically**

1. Login as admin
2. Open **Console** (F12)
3. Wait 10 minutes OR:
   - Minimize/hide the browser tab
   - Switch to another tab
   - Switch back to this tab
4. Check console for refresh activity
5. Verify you're NOT logged out

**Expected**: Token refreshes silently, no logout

✅ **PASS** if still logged in after 10 min or tab switch

---

### Test 4: Role-Based Access Control
**Verify different roles see different content**

**Test 4a: Admin Role**
```
Email: admin@industrial.com
Password: password123
```
- Should see all features
- Full dashboard access
- All navigation items active

**Test 4b: Engineer Role**
```
Email: engineer@industrial.com
Password: password123
```
- Different user name in profile
- "Engineer" badge
- May have limited access to certain features

**Test 4c: Technician Role**
```
Email: technician@industrial.com
Password: password123
```
- Different user name in profile
- "Technician" badge
- View-only access

**Expected**: Different roles display different information

✅ **PASS** if each role shows unique data

---

### Test 5: Logout
**Verify logout clears tokens**

1. Login as admin
2. Open **DevTools** → **Application**
3. Check `localStorage.accessToken` exists
4. Check `refresh_token` cookie exists
5. Click **Logout** button
6. Check localStorage - `accessToken` should be gone
7. Check cookies - `refresh_token` should be deleted
8. Should redirect to LoginPage

**Expected**: Tokens cleared, redirect to login

✅ **PASS** if tokens cleared and on login page

---

### Test 6: Invalid Credentials
**Verify error handling**

1. On LoginPage
2. Enter: `admin@industrial.com`
3. Enter: `wrongpassword`
4. Click Sign In
5. Should see error: **"Invalid credentials"**

**Expected**: Generic error message (doesn't reveal if email exists)

✅ **PASS** if generic error shown

---

### Test 7: Missing Fields
**Verify form validation**

1. On LoginPage
2. Leave email empty
3. Enter password: `password123`
4. Click Sign In
5. Should see: **"Please enter both email and password"**

**Expected**: Validation error

✅ **PASS** if validation error shown

---

### Test 8: Invalid Email Format
**Verify email validation**

1. On LoginPage
2. Enter: `invalidemail`
3. Enter password: `password123`
4. Click Sign In
5. Should see: **"Please enter a valid email address"**

**Expected**: Format validation error

✅ **PASS** if format validation error shown

---

### Test 9: Weak Password
**Verify password length requirement**

1. On LoginPage
2. Enter email: `admin@industrial.com`
3. Enter password: `pass`
4. Click Sign In
5. Should see: **"Password must be at least 8 characters"**

**Expected**: Length validation error

✅ **PASS** if length validation error shown

---

### Test 10: Multiple Logins
**Verify concurrent sessions**

1. Open 2 browser tabs: Tab A and Tab B
2. Tab A: Login as admin
3. Tab B: Login as engineer
4. Tab A: Check sidebar - should show "Admin User"
5. Tab B: Check sidebar - should show "Engineer User"
6. Both should have independent tokens

**Expected**: Each tab maintains own session

✅ **PASS** if each tab has independent auth

---

## 🐛 Troubleshooting

### Issue: "Network Error" on Login
**Solution:**
1. Verify backend is running: `http://localhost:3000/health`
2. Check backend terminal for errors
3. Verify `VITE_API_URL=http://localhost:3000` in frontend `.env`
4. Restart backend: `npm run dev` in `/server`

### Issue: "CORS Error" in browser console
**Solution:**
1. Check `CORS_ORIGIN` in `server/.env`
2. Should be: `CORS_ORIGIN=http://localhost:5173`
3. Restart backend after changing `.env`

### Issue: Logout button doesn't work
**Solution:**
1. Check browser console for errors
2. Verify refresh_token cookie exists (DevTools → Application)
3. Restart backend
4. Try logout again

### Issue: Token doesn't refresh automatically
**Solution:**
1. Check if `TokenRefresher` component loaded
2. Open console: No errors should appear
3. Wait 10 minutes
4. Or switch tab and switch back
5. Verify new token in localStorage

### Issue: Can't login with demo credentials
**Solution:**
1. Verify database initialized: Check backend console
2. Demo users should be created on startup
3. Credentials: `password123` (exactly)
4. Restart backend: `npm run dev`
5. Try login again

---

## 📊 Performance Testing

### Login Response Time
1. Open **DevTools** → **Network** tab
2. Clear all requests
3. Login with credentials
4. Check **POST /auth/login** request
5. Look at **Time** column

**Expected**: < 100ms

✅ **PASS** if response < 100ms

### Token Refresh Time
1. Open **DevTools** → **Network** tab
2. Wait for auto-refresh (or manually trigger)
3. Check **POST /auth/refresh** request
4. Look at **Time** column

**Expected**: < 100ms

✅ **PASS** if response < 100ms

### Page Load After Login
1. Login to dashboard
2. Check **DOMContentLoaded** time in DevTools
3. Should be quick (< 2 seconds)

**Expected**: < 2 seconds

✅ **PASS** if page loads quickly

---

## 🔐 Security Verification

### Test: XSS Protection (httpOnly Cookies)
1. Open **Console** (F12)
2. Try: `document.cookie`
3. Should show nothing or non-sensitive cookies
4. `refresh_token` should NOT appear (httpOnly)

**Expected**: refresh_token not accessible via JavaScript

✅ **PASS** if refresh_token not visible

### Test: CORS Protection
1. Login normally
2. The page loads without CORS errors

**Expected**: No CORS errors in console

✅ **PASS** if no CORS errors

### Test: Password Not Logged
1. Login with credentials
2. Open **Console** and **Network** tabs
3. Search for your password
4. Should NOT appear anywhere

**Expected**: Password never logged

✅ **PASS** if password not visible anywhere

---

## ✅ Complete Test Matrix

| Test | Expected | Result |
|------|----------|--------|
| Backend starts | ✅ Server running | _____ |
| Frontend starts | ✅ VITE ready | _____ |
| Login page loads | ✅ Form visible | _____ |
| Login with admin | ✅ Dashboard loads | _____ |
| Token in storage | ✅ In localStorage | _____ |
| Refresh cookie set | ✅ httpOnly cookie | _____ |
| API auth header | ✅ Bearer token sent | _____ |
| Auto-refresh works | ✅ Tokens refreshed | _____ |
| Engineer login | ✅ Different role | _____ |
| Technician login | ✅ Different role | _____ |
| Logout works | ✅ Tokens cleared | _____ |
| Invalid creds | ✅ Error shown | _____ |
| Form validation | ✅ Errors shown | _____ |
| Concurrent sessions | ✅ Independent | _____ |
| Response time | ✅ < 100ms | _____ |
| No XSS vectors | ✅ httpOnly safe | _____ |

**Score**: _____ / 15 tests passed

---

## 🎯 Testing Checklist

- [ ] **Backend** - Starts without errors
- [ ] **Frontend** - Starts without errors
- [ ] **Login Page** - Displays correctly
- [ ] **Admin Login** - Works with demo creds
- [ ] **Token Storage** - Both tokens present
- [ ] **API Auth** - Authorization header sent
- [ ] **Auto-Refresh** - Works silently
- [ ] **Role Badges** - Different for each role
- [ ] **Logout** - Tokens cleared
- [ ] **Error Handling** - Friendly messages
- [ ] **Form Validation** - All fields validated
- [ ] **Security** - No sensitive data exposed
- [ ] **Performance** - Response < 100ms
- [ ] **CORS** - No CORS errors
- [ ] **Multiple Tabs** - Independent sessions

**Overall Status**: ___________________

---

## 🚀 Production Testing

Before deploying to production:

### Security Testing
- [ ] JWT secret is strong (32+ chars)
- [ ] Refresh secret is strong (32+ chars)
- [ ] HTTPS enabled
- [ ] Cookies secure flag enabled
- [ ] SameSite=Strict enforced
- [ ] CORS origin restricted to domain
- [ ] No sensitive info in logs

### Performance Testing
- [ ] Load test with 100+ concurrent users
- [ ] Verify token refresh doesn't bottleneck
- [ ] Check database query performance
- [ ] Monitor memory leaks

### Integration Testing
- [ ] Works with your database
- [ ] Works with your API
- [ ] Works with your deployment
- [ ] Works in all browsers

### User Acceptance Testing
- [ ] Users can login
- [ ] Users stay logged in
- [ ] Users can logout
- [ ] Roles work correctly
- [ ] UI is responsive

---

## 📝 Test Results Template

```
═══════════════════════════════════════════════════════
  AUTHENTICATION SYSTEM - TEST RESULTS
═══════════════════════════════════════════════════════

Date: _______________
Tester: _____________
Environment: Local / Staging / Production

RESULTS:
─────────────────────────────────────────────────────
Backend Start:                    ✅ / ❌
Frontend Start:                   ✅ / ❌
Login Functionality:              ✅ / ❌
Token Generation:                 ✅ / ❌
Auto-Refresh:                     ✅ / ❌
Logout:                           ✅ / ❌
Role-Based Access:                ✅ / ❌
Form Validation:                  ✅ / ❌
Error Handling:                   ✅ / ❌
Security (httpOnly):              ✅ / ❌

Overall Status:                   ✅ PASS / ❌ FAIL

Issues Found:
───────────────────────────────────────────────────
1. ___________________________________
2. ___________________________________
3. ___________________________________

Notes:
───────────────────────────────────────────────────
_________________________________________________
_________________________________________________

Sign-off: ____________________  Date: __________
═══════════════════════════════════════════════════════
```

---

**Ready to test! 🎉**
