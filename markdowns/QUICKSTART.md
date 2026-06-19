# Quick Start Guide

## Serviços da aplicação

| Serviço | Porta | Comando |
|---------|-------|---------|
| Frontend (React/Vite) | 5173 | `npm run dev` |
| Backend de auth (Node/Express) | 3000 | `cd server && npm run dev` |
| Modelo de OCR (Python/FastAPI) | 8000 | ver passo 4 |

> Atalho: `start-all.bat` (Windows) / `./start-all.sh` (Linux/macOS) sobem os três juntos.

## Getting Started

### Step 1: Configure os `.env`
```bash
cp .env.example .env
cp server/.env.example server/.env
```

### Step 2: Frontend
```bash
npm install
npm run dev          # http://localhost:5173
```

### Step 3: Backend de auth
```bash
cd server && npm install && npm run dev   # http://localhost:3000
```

### Step 4: Modelo de OCR (opcional, mas necessário para OCR real)
```bash
cd ocr/OCR-Model-main
python -m venv .venv
.venv\Scripts\activate            # Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
set PYTHONUTF8=1                   # Windows (evita erro no download do modelo)
uvicorn src.api.main:app --port 8000   # http://localhost:8000
```

> Sem o backend de OCR no ar, a tela de Equipamentos usa dados simulados automaticamente.
> A aplicação abre no navegador em `http://localhost:5173`.

### Step 3: Explore the Platform

**Dashboard Tab:**
- View KPI cards showing uptime, alerts, and anomalies
- See interactive charts with asset status distribution
- Monitor uptime metrics across the fleet

**Plant Tab:**
- Interactive grid layout of the factory
- Click any asset to view detailed information
- Assets show status with color indicators
- Details panel opens on the right side

**Alerts Tab:**
- View all active and resolved alerts
- Filter by severity (Critical, Warning, Info)
- See AI-generated insights for each alert
- Mark alerts as resolved

**Equipment Tab:**
- Upload equipment images
- Auto-extract specifications from images
- Register equipment in the digital twin
- Manage equipment database

**AI Assistant Tab:**
- Chat with maintenance AI
- Get context-aware advice about selected assets
- Ask about maintenance, troubleshooting, diagnostics
- Use quick action buttons for common questions

## Key Features to Try

### 1. Real-time Data Updates
- Open the Plant tab and select any asset
- Watch sensor data update in real-time (every 2 seconds)
- See temperature, vibration, current, and voltage changes

### 2. Asset Status Indicators
- **Green** = Normal operation
- **Yellow** = Warning - needs monitoring
- **Red** = Critical - immediate attention required
- **Gray** = Offline

### 3. Anomaly Detection
- Assets show anomaly scores (0-100%)
- Higher scores indicate higher risk of failure
- ML insights explain the anomalies
- Recommendations for preventive maintenance

### 4. Alert System
- Alerts appear in real-time
- Each alert includes AI insights
- Critical alerts show at the top
- Mark resolved when action is taken

### 5. AI Assistance
- Select an asset, then open AI Assistant
- Ask "What maintenance is due?" or "Why is vibration high?"
- AI provides context-aware recommendations
- Use quick buttons for instant answers

## Example Workflows

### Investigating Critical Alert
1. Go to **Alerts** tab
2. Find the "High Vibration Detected" alert
3. Click to read full details and AI insight
4. Click asset name to view its detail panel
5. Check sensor data and time-series trends
6. Ask AI Assistant for maintenance recommendations

### Registering New Equipment (OCR real)
1. Go to **Equipment** tab
2. Choose the OCR engine: **EasyOCR** (default) or **Gemini Vision**
3. Upload a nameplate photo (PNG/JPG/WebP, ≤10 MB). For a quick test use the
   sample plates in `ocr/OCR-Model-main/data/templates/`
4. The frontend calls the OCR model (port 8000); review the extracted fields,
   confidence, motor type and physical-validation alerts
5. Edit any incorrect fields
6. Click "Confirmar Registro"

### Monitoring Fleet Health
1. Go to **Dashboard** tab
2. Check KPI cards for overall status
3. Review charts showing asset distribution
4. Click into **Plant** view for detailed inspection
5. Check anomaly scores for each asset
6. Plan maintenance based on predictions

## Keyboard Shortcuts

- **Tab** - Switch between main navigation items
- **Enter** - Select/click highlighted element
- **Esc** - Close detail panel

## Tips & Tricks

1. **Real-time Monitoring**: Keep dashboard open on a screen during shifts
2. **Mobile Access**: Use responsive design on tablets for floor walkthroughs
3. **Alert Prioritization**: Focus on critical alerts first, then warnings
4. **AI Learning**: Ask specific questions to get better recommendations
5. **Data Exports**: Export anomaly reports for your records (coming soon)

## Troubleshooting

### Application Won't Start
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Port 5173 Already in Use
```bash
npm run dev -- --port 5174
```

### Charts Not Displaying
- Check browser console for errors (F12)
- Ensure JavaScript is enabled
- Try refreshing the page

### Sidebar Not Showing on Mobile
- The sidebar collapses on small screens
- Click the menu icon (☰) to toggle it

### OCR retorna "Simulado (offline)"
- O backend de OCR (porta 8000) não está no ar. Suba-o (passo 4) ou verifique `http://localhost:8000/health`.

### Erro `UnicodeEncodeError` ao subir o OCR (Windows)
- A barra de progresso do EasyOCR usa um caractere unicode que quebra no console cp1252.
- Defina `set PYTHONUTF8=1` (CMD) ou `$env:PYTHONUTF8=1` (PowerShell) antes do `uvicorn`.

## Demo Data

The application comes with 5 pre-configured assets:

1. **Main Production Motor** (Hall A, Station 1) - Status: Normal
2. **Backup Motor** (Hall A, Station 2) - Status: Warning
3. **Coolant Circulation Pump** (Hall B) - Status: Normal
4. **Air Compressor** (Hall C) - Status: Critical (Best for testing alerts)
5. **Ventilation Fan** (Hall A, Roof) - Status: Normal

Each asset has 4-5 live sensors generating realistic data.

## Next Steps

1. ✅ Run the application locally
2. 📊 Explore all sections and features
3. 🎨 Customize colors and layouts
4. 🔌 Connect to a real API when ready
5. 🚀 Deploy to production

## Production Deployment

When you're ready to deploy:

```bash
# Build for production
npm run build

# This creates an optimized dist/ folder
# Deploy the dist/ folder to your hosting service
```

### Hosting Options
- **Netlify**: Drag dist/ folder
- **Vercel**: `vercel deploy`
- **AWS Amplify**: Connect GitHub repo
- **Docker**: Use Node 18 base image

## Support & Resources

- **TypeScript Docs**: https://www.typescriptlang.org/
- **React Docs**: https://react.dev/
- **Tailwind CSS**: https://tailwindcss.com/
- **Zustand**: https://github.com/pmndrs/zustand
- **Recharts**: https://recharts.org/

---

Happy monitoring! 🎯
