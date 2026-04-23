# Industrial Digital Twin Platform

A production-ready frontend for predictive maintenance of electric motors and industrial equipment. Built with React, TypeScript, and Tailwind CSS.

## 🎯 Features

### 1. **Dashboard**
- Real-time KPI metrics (uptime, alerts, anomalies)
- Interactive charts showing asset status distribution
- Uptime tracking and anomaly scores
- Fleet overview with key indicators

### 2. **Plant Navigation (Digital Twin)**
- Visual plant layout with clickable assets
- Interactive asset grid showing equipment location
- Status indicators (normal, warning, critical, offline)
- Single-click asset selection with side panel details

### 3. **Asset Details**
- Live sensor data visualization
- Time-series charts with 60-minute history
- Status indicators and anomaly scores
- Maintenance schedule tracking
- ML-powered insights

### 4. **Alerts Management**
- Real-time alert system with severity levels
- Critical, warning, and info classifications
- AI insights for each alert
- Alert resolution tracking
- Filter alerts by status and severity

### 5. **Equipment Registration**
- Image upload with computer vision simulation
- Automatic data extraction from images
- Equipment nameplate OCR simulation
- Editable registration form
- Equipment management dashboard

### 6. **AI Maintenance Assistant**
- Chat-based troubleshooting interface
- Context-aware responses based on selected asset
- RAG-based knowledge base simulation
- Quick action buttons for common questions

## 🛠️ Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Zustand** - State management
- **Recharts** - Data visualization
- **Lucide React** - Icons
- **Vite** - Build tool

## 📦 Installation

### Prerequisites
- Node.js 16.x or higher
- npm or yarn

### Setup

1. **Clone the repository**
```bash
cd industrial-digital-twin
```

2. **Install dependencies**
```bash
npm install
```

3. **Start development server**
```bash
npm run dev
```

The application will open at `http://localhost:5173`

4. **Build for production**
```bash
npm run build
```

## 🏗️ Project Structure

```
src/
├── components/          # Reusable React components
│   ├── AIAssistant.tsx
│   ├── AlertItem.tsx
│   ├── AssetDetailPanel.tsx
│   ├── Cards.tsx
│   ├── EquipmentRegistrationForm.tsx
│   └── TimeSeriesChart.tsx
├── pages/              # Page components
│   ├── Dashboard.tsx
│   ├── PlantNavigation.tsx
│   ├── AlertsPage.tsx
│   ├── EquipmentPage.tsx
│   └── AssistantPage.tsx
├── services/           # API and external services
│   └── api.ts         # Mock API with realistic data
├── store/             # State management
│   └── appStore.ts    # Zustand store
├── types/             # TypeScript type definitions
│   └── index.ts
├── App.tsx            # Main app component
├── main.tsx           # React entry point
└── index.css          # Global styles
```

## 🎨 UI/UX Features

### Dark Mode (Default)
- Enterprise-grade dark theme
- Reduced eye strain for industrial environments
- High contrast for accessibility

### Color System
- **Green (#10b981)** - Normal/Healthy status
- **Yellow (#f59e0b)** - Warning status
- **Red (#ef4444)** - Critical/Failed status
- **Slate** - Neutral and backgrounds

### Responsive Design
- Desktop-first approach
- Adaptive sidebar (collapses on mobile)
- Mobile-friendly layouts for all pages

### Animations & Transitions
- Smooth hover effects
- Status pulse animations
- Sidebar slide transitions
- Chart animations

## 🔄 Real-time Features

The dashboard includes simulated real-time updates:
- **Auto-refresh KPIs** - Every 5 seconds
- **Live sensor data** - Updates every 2 seconds when panel is open
- **Alert monitoring** - Updates every 3 seconds
- **Smooth transitions** - No jarring data changes

## 📊 Mock Data

The application includes realistic mock data:

### Assets (5 total)
- Main Production Motor (Normal)
- Backup Motor (Warning)
- Coolant Circulation Pump (Normal)
- Air Compressor (Critical)
- Ventilation Fan (Normal)

### Sensors (4-5 per asset)
- Voltage (V)
- Current (A)
- Temperature (°C)
- RPM/Speed
- Vibration (mm/s)
- Pressure (bar)
- Flow Rate (L/min)

### Alerts (4 total)
- Critical vibration detection
- Elevated temperature warning
- Scheduled maintenance reminder
- Performance optimization tip

## 🎯 Navigation

### Main Tabs
1. **Dashboard** - KPIs and overview charts
2. **Plant** - Interactive plant layout and asset selection
3. **Alerts** - Alert management and tracking
4. **Equipment** - Equipment registration and management
5. **AI Assistant** - Maintenance chatbot

### Side Panel
- Opens when clicking on an asset
- Shows live sensor data
- Displays time-series charts
- AI insights and recommendations
- Maintenance scheduling

## 🚀 Usage Examples

### Viewing Asset Details
1. Click "Plant" tab
2. Click any asset tile to select it
3. Details panel opens on the right
4. View live sensor data and charts
5. Click "Schedule Maintenance" or "View History"

### Managing Alerts
1. Click "Alerts" tab
2. Filter by status (All, Active, Critical, etc.)
3. View alert details and AI insights
4. Click "Mark Resolved" to acknowledge

### Registering Equipment
1. Click "Equipment" tab
2. Click "Upload Equipment Image"
3. Select image of equipment nameplate
4. Verify extracted data (auto-filled)
5. Edit fields as needed
6. Click "Register Equipment"

### Getting AI Assistance
1. Click "AI Assistant" tab
2. Optionally select an asset first
3. Type your question about maintenance
4. AI provides context-aware response
5. Use quick action buttons for common questions

## 🔧 Configuration

### Tailwind CSS
- Located in `tailwind.config.cjs`
- Extended color palette with slate
- Custom animations and utilities

### TypeScript
- Strict mode enabled
- Full type safety throughout
- Type definitions in `src/types/index.ts`

### Vite
- Fast HMR (Hot Module Reload)
- Optimized production builds
- Configured in `vite.config.ts`

## 📈 Performance Optimizations

- Lazy loading of charts
- Virtualized lists (for large datasets)
- Optimized re-renders with Zustand
- CSS optimization with Tailwind
- Production build optimization

## 🔐 Security Considerations

- No real API calls (mock data only)
- Client-side state management
- Input validation on forms
- CORS headers (if extending with real API)

## 🐛 Troubleshooting

### Port Already in Use
```bash
npm run dev -- --port 5174
```

### Node Version Issues
```bash
node --version  # Should be 16.x or higher
```

### Missing Dependencies
```bash
rm -rf node_modules package-lock.json
npm install
```

### TypeScript Errors
```bash
npm run build  # Will show all TS errors
```

## 📝 Development

### Adding a New Component
1. Create file in `src/components/`
2. Export as named export
3. Import and use in pages
4. Add TypeScript types

### Adding a New Page
1. Create file in `src/pages/`
2. Add navigation item in `App.tsx`
3. Add route/tab handling
4. Export page component

### Adding New Mock Data
1. Edit `src/services/api.ts`
2. Update mock arrays
3. Extend API methods as needed

## 🚢 Deployment

### Build for Production
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

### Deploy to Netlify
```bash
npm run build
# Drag dist/ folder to Netlify
```

### Deploy to Vercel
```bash
npm run build
vercel deploy
```

## 📚 API Reference

### Mock API Service (`src/services/api.ts`)

#### `getAssets()`
Returns all factory assets with sensor data

#### `getAssetById(id: string)`
Returns specific asset details

#### `getAlerts()`
Returns all active and resolved alerts

#### `getKPIMetrics()`
Returns fleet-wide KPI metrics

#### `registerEquipment(data)`
Simulates equipment registration

#### `uploadEquipmentImage(file)`
Simulates image upload and OCR

#### `getChatResponse(message, context)`
Gets AI assistant responses

## 🎓 Learning Resources

### Component Best Practices
- Functional components with hooks
- Props drilling minimized with Zustand
- Reusable card components
- Clear component separation

### State Management
- Zustand for global state
- Custom hooks for complex logic
- No prop drilling
- Efficient re-renders

### Data Visualization
- Recharts for charts
- Responsive containers
- Custom tooltips
- Real-time data updates

## 📄 License

MIT - Feel free to use this as a template for your projects

## 🤝 Contributing

To extend this platform:
1. Add new sensor types in `types/index.ts`
2. Create new API endpoints in `services/api.ts`
3. Build components in `components/`
4. Create pages in `pages/`
5. Update navigation in `App.tsx`

## 📞 Support

For issues or questions:
1. Check the structure and types
2. Review mock data in `api.ts`
3. Verify Zustand store connections
4. Check browser console for errors

## ✨ Future Enhancements

- [ ] Real API integration
- [ ] WebSocket for live updates
- [ ] Advanced predictive analytics
- [ ] Multi-plant support
- [ ] User authentication
- [ ] Role-based access control
- [ ] Historical data export
- [ ] Custom dashboard layouts
- [ ] Mobile app (React Native)
- [ ] Offline mode support

---

**Built with ❤️ for industrial IoT and predictive maintenance**
