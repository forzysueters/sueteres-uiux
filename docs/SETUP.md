# 🚀 Setup & Deployment Guide

> ⚠️ **Desatualizado.** O backend Express de autenticação foi removido; dados e login vêm do Supabase.
> Consulte o [README](../README.md) e [supabase/README.md](../supabase/README.md).

## Prerequisites

- Node.js 18+ (download from https://nodejs.org/)
- npm 9+ (comes with Node.js)
- **Python 3.10+** (para o modelo de OCR — https://www.python.org/)
- Git (for version control)
- A modern web browser (Chrome, Firefox, Safari, or Edge)

## Serviços

A aplicação é composta por três processos independentes:

| Serviço | Stack | Porta |
|---------|-------|-------|
| Frontend | React/Vite | 5173 |
| Backend de auth | Node/Express | 3000 |
| Modelo de OCR | Python/FastAPI | 8000 |

> Atalho: `start-all.bat` (Windows) / `./start-all.sh` (Linux/macOS) sobem os três.

## Local Development Setup

### Step 1: Clone or Extract the Project

```bash
# If you have git
git clone <repository-url>
cd fzy

# Or navigate to the project folder
cd c:\Users\labsfiap\Downloads\fzy
```

### Step 2: Install Dependencies

```bash
npm install
```

This will install all required packages:
- React 18.2
- TypeScript 5.2
- Tailwind CSS 3.3
- Recharts 2.10
- Zustand 4.4
- Lucide React icons

### Step 3: Start Development Server

```bash
npm run dev
```

The application will open at `http://localhost:5173`

**Automatic features:**
- ✅ Hot Module Replacement (HMR) - code changes reflect instantly
- ✅ TypeScript compilation
- ✅ Tailwind CSS processing

### Step 3b: Backend de autenticação

```bash
cp server/.env.example server/.env
cd server && npm install && npm run dev   # http://localhost:3000
```

### Step 3c: Modelo de OCR (FastAPI)

```bash
cd ocr/OCR-Model-main
python -m venv .venv
.venv\Scripts\activate              # Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
set PYTHONUTF8=1                     # Windows: evita UnicodeEncodeError no download do modelo
uvicorn src.api.main:app --port 8000   # http://localhost:8000  (docs em /docs)
```

> O primeiro start baixa os pesos do EasyOCR (alguns minutos). Sem este serviço,
> a tela de Equipamentos cai para dados simulados automaticamente.
> Detalhes da integração: `ocr/INTEGRATION.md`.

### Step 4: Build for Production

```bash
npm run build
```

This creates an optimized build in the `dist/` folder:
- TypeScript compilation with strict checking
- CSS minification and purging
- JavaScript bundling and tree-shaking
- ~200 KB total size

### Step 5: Preview Production Build

```bash
npm run preview
```

This serves the production build locally to verify it works.

---

## Environment Configuration

### Development Environment

Create the `.env` files from the examples:

```bash
cp .env.example .env               # frontend
cp server/.env.example server/.env # backend de auth
```

### Available Environment Variables (frontend)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:3000` | Backend de autenticação (JWT) |
| `VITE_OCR_API_URL` | `http://localhost:8000` | Modelo de OCR (FastAPI) |
| `VITE_OCR_USE_MOCK` | `false` | Força dados simulados de OCR (demo offline) |
| `VITE_SENSOR_UPDATE_INTERVAL` | `2000` | Sensor data refresh rate (ms) |
| `VITE_DASHBOARD_REFRESH_INTERVAL` | `5000` | Dashboard refresh rate (ms) |
| `VITE_ENABLE_REAL_TIME_UPDATES` | `true` | Enable real-time updates |
| `VITE_ENABLE_AI_ASSISTANT` | `true` | Enable AI chat features |
| `VITE_THEME` | `dark` | UI theme (dark/light) |
| `VITE_ENV` | `development` | Environment (development/production/staging) |

### Variáveis do modelo de OCR (`ocr/OCR-Model-main/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `DEFAULT_MODEL` | `easyocr` | Motor de OCR padrão |
| `OPENAI_API_KEY` | — | Habilita o fallback/modo de visão (opcional, parâmetro `mode=gemini` por compatibilidade) |

---

## Deployment Guides

### 🌐 Vercel (Recommended - Zero Configuration)

1. **Push to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-github-url>
   git push -u origin main
   ```

2. **Connect to Vercel:**
   - Go to https://vercel.com
   - Click "New Project"
   - Select your GitHub repository
   - Vercel auto-detects it's a Vite + React project
   - Click "Deploy"

3. **Configure Environment Variables:**
   - In Vercel dashboard → Settings → Environment Variables
   - Add your `.env` variables

**Deploy time:** ~1 minute  
**Automatic features:** HTTPS, CDN, auto-scaling, CI/CD

---

### 🚀 Netlify (Drop & Deploy)

1. **Build locally:**
   ```bash
   npm run build
   ```

2. **Deploy using Netlify CLI:**
   ```bash
   npm install -g netlify-cli
   netlify deploy --prod --dir=dist
   ```

3. **Or drag & drop:**
   - Go to https://app.netlify.com
   - Drag the `dist/` folder into the deployment area
   - Done!

**Deploy time:** ~30 seconds  
**URL:** Auto-generated at `https://<your-site>.netlify.app`

---

### ☁️ AWS S3 + CloudFront

1. **Build the project:**
   ```bash
   npm run build
   ```

2. **Create S3 bucket:**
   ```bash
   aws s3 mb s3://industrial-digital-twin-prod --region us-east-1
   ```

3. **Upload build files:**
   ```bash
   aws s3 sync dist/ s3://industrial-digital-twin-prod/ --delete
   ```

4. **Set bucket policy for public access:**
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::industrial-digital-twin-prod/*"
       }
     ]
   }
   ```

5. **Create CloudFront distribution** for caching and SSL

**Cost:** ~$1-5/month for low traffic  
**CDN:** Global content delivery  
**Features:** HTTPS, caching, compression

---

### 🐳 Docker Deployment

**Build Docker image:**

```dockerfile
# Dockerfile
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Build and run:**

```bash
docker build -t industrial-digital-twin:latest .
docker run -p 80:80 industrial-digital-twin:latest
```

**Deploy to Docker Hub:**

```bash
docker tag industrial-digital-twin:latest <your-username>/industrial-digital-twin:latest
docker push <your-username>/industrial-digital-twin:latest
```

---

### 🔧 GitHub Pages

1. **Update `vite.config.ts`:**
   ```typescript
   export default defineConfig({
     base: '/industrial-digital-twin/',
     // ... rest of config
   })
   ```

2. **Build and deploy:**
   ```bash
   npm run build
   git add dist/
   git commit -m "Deploy to GitHub Pages"
   git push origin main
   ```

3. **Enable GitHub Pages:**
   - Repository Settings → Pages
   - Select "Deploy from a branch"
   - Choose `main` / `root`

---

### 🌍 Azure Static Web Apps

1. **Create Azure account and CLI:**
   ```bash
   npm install -g @azure/static-web-apps-cli
   ```

2. **Authenticate:**
   ```bash
   az login
   ```

3. **Deploy:**
   ```bash
   npm run build
   az staticwebapp up --name industrial-digital-twin --output-location dist
   ```

---

## Production Checklist

Before deploying to production:

- [ ] Run `npm run build` successfully
- [ ] Test with `npm run preview`
- [ ] Set all environment variables
- [ ] Enable HTTPS
- [ ] Set up CDN for caching
- [ ] Configure error tracking (Sentry)
- [ ] Set up monitoring/alerts
- [ ] Test on mobile devices
- [ ] Check Web Vitals and performance
- [ ] Set up automated backups

---

## Troubleshooting

### "Cannot find module" errors

```bash
# Clear node_modules and reinstall
rm -r node_modules package-lock.json  # or del /s node_modules on Windows
npm install
```

### Port 5173 already in use

```bash
# Use a different port
npm run dev -- --port 3000
```

### TypeScript errors

```bash
# Clear TypeScript cache
rm tsconfig.tsbuildinfo
npm run build
```

### Build size too large

```bash
# Analyze bundle
npm run build -- --analyze
```

### OCR: `UnicodeEncodeError` ao subir o serviço (Windows)

A barra de progresso do EasyOCR usa um caractere unicode que quebra no console cp1252.
Defina UTF-8 antes do `uvicorn`:

```bash
set PYTHONUTF8=1            # CMD
$env:PYTHONUTF8=1          # PowerShell
```

### OCR: tela de Equipamentos mostra "Simulado (offline)"

O backend de OCR (porta 8000) não está acessível. Verifique `http://localhost:8000/health`
ou ajuste `VITE_OCR_API_URL` no `.env`.

---

## Performance Optimization

### Image Optimization

```typescript
// Use efficient image formats
<img src="asset.webp" alt="description" loading="lazy" />
```

### Code Splitting

Vite automatically code-splits at route level:
- Dashboard page only loads when accessed
- Reduces initial bundle size
- Faster initial load time

### Caching Headers

Set appropriate cache headers for production:

```
# .htaccess (Apache) or vercel.json (Vercel)
Cache-Control: max-age=31536000, immutable  # for hash-named assets
Cache-Control: max-age=3600  # for HTML
```

---

## Monitoring & Analytics

### Application Performance Monitoring (APM)

Integrate with Sentry for error tracking:

```typescript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "your-sentry-dsn",
  environment: "production",
});
```

### User Analytics

Track user behavior with Google Analytics:

```typescript
// In main.tsx
import { GTM_ID } from './config';
// Initialize GTM...
```

---

## Support & Resources

- **Documentation:** See `README.md` and `DEVELOPMENT.md`
- **Issues:** Report bugs in GitHub Issues
- **Discussion:** Use GitHub Discussions for questions
- **Contributing:** See `CONTRIBUTING.md`

---

## Quick Command Reference

```bash
# Development
npm run dev          # Start dev server
npm run build        # Build for production
npm run preview      # Preview production build

# Deployment
npm run build && npm run preview  # Test before deploying

# Troubleshooting
npm install          # Reinstall dependencies
npm cache clean --force  # Clear npm cache
```

---

**Happy deploying! 🎉**
