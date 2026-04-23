# Quick Start Guide

## Getting Started in 3 Steps

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Start Development Server
```bash
npm run dev
```

The application will automatically open in your browser at `http://localhost:5173`

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

### Registering New Equipment
1. Go to **Equipment** tab
2. Click "Upload Equipment Image"
3. Select a photo of equipment nameplate
4. Review auto-extracted data (AI fills in manufacturer, model, etc.)
5. Edit any incorrect fields
6. Click "Register Equipment"

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
