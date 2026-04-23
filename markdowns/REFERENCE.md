# 📚 Quick Reference Guide

## Installation & Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
src/
├── App.tsx                 # Main app component
├── main.tsx               # Entry point
├── index.css              # Global styles
├── components/            # Reusable UI components
│   ├── AIAssistant.tsx
│   ├── AlertItem.tsx
│   ├── AssetDetailPanel.tsx
│   ├── Cards.tsx
│   ├── EquipmentRegistrationForm.tsx
│   ├── ErrorBoundary.tsx          [NEW]
│   ├── SkeletonLoaders.tsx        [NEW]
│   └── TimeSeriesChart.tsx
├── pages/                 # Page components
│   ├── Dashboard.tsx
│   ├── PlantNavigation.tsx
│   ├── AlertsPage.tsx
│   ├── EquipmentPage.tsx
│   └── AssistantPage.tsx
├── services/              # API and external services
│   └── api.ts
├── store/                 # State management (Zustand)
│   └── appStore.ts
├── types/                 # TypeScript type definitions
│   └── index.ts
└── utils/                 # Helper functions       [NEW]
    └── helpers.ts

Configuration/
├── vite.config.ts        # Vite build config
├── tsconfig.json         # TypeScript config
├── tailwind.config.cjs   # Tailwind CSS config
├── postcss.config.cjs    # PostCSS config
└── package.json          # Dependencies

Documentation/
├── README.md             # Project overview
├── SETUP.md              # Setup & deployment guide   [NEW]
├── TESTING.md            # Testing guide              [NEW]
├── PERFORMANCE.md        # Performance optimization   [NEW]
├── FEATURES.md           # Feature development guide  [NEW]
├── START_HERE.md         # Quick start
├── INDEX.md              # Documentation index
├── QUICKSTART.md         # 3-step quick start
├── COMPLETE.md           # Project completion summary
├── DEVELOPMENT.md        # Architecture & patterns
├── COMPONENTS.md         # Component library reference
├── API.md                # API endpoints reference
├── DEPLOYMENT.md         # Multi-platform deployment
├── MANIFEST.md           # File listing
├── VERIFICATION.md       # Verification checklist
└── COMMANDS.sh           # Command reference
```

## Key Files & Their Purpose

| File | Purpose |
|------|---------|
| `src/App.tsx` | Main application shell with navigation |
| `src/store/appStore.ts` | Zustand store for global state |
| `src/services/api.ts` | Mock API service with 9 endpoints |
| `src/types/index.ts` | TypeScript type definitions |
| `src/utils/helpers.ts` | Utility functions (new) |
| `tailwind.config.cjs` | Tailwind CSS configuration |
| `vite.config.ts` | Vite build configuration |

## Common Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run preview          # Preview production build

# New (Testing)
npm run test             # Run tests (when configured)
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Generate coverage report

# Deployment
npm run build && npm run preview  # Test before deploying
```

## Component Usage Examples

### Import Pattern

```typescript
// Named imports for components
import { KPICard, SensorCard } from './components/Cards';
import { Dashboard } from './pages/Dashboard';
import { useAppStore } from './store/appStore';
import { apiService } from './services/api';
import { formatNumber, formatDate } from './utils/helpers';
```

### Using Store (Zustand)

```typescript
import { useAppStore } from './store/appStore';

export const MyComponent = () => {
  // ✅ Best: Use selectors to optimize re-renders
  const selectedTab = useAppStore((state) => state.selectedTab);
  const setSelectedTab = useAppStore((state) => state.setSelectedTab);

  return (
    <button onClick={() => setSelectedTab('dashboard')}>
      Go to Dashboard
    </button>
  );
};
```

### Loading States

```typescript
import { SkeletonLoader, CardSkeleton } from './components/SkeletonLoaders';

// Skeleton while loading
{loading ? <CardSkeleton count={4} /> : <Dashboard />}

// Custom skeleton
{loading && <SkeletonLoader count={5} height="h-10" />}
```

### Error Handling

```typescript
import { ErrorBoundary } from './components/ErrorBoundary';

// Wrap components that might error
<ErrorBoundary>
  <Dashboard />
</ErrorBoundary>
```

## API Service Methods

```typescript
import { apiService } from './services/api';

// Get all assets
const assets = await apiService.getAssets();

// Get alerts
const alerts = await apiService.getAlerts();

// Get KPI metrics
const kpis = await apiService.getKPIMetrics();

// Register equipment
const result = await apiService.registerEquipment(data);

// Upload image
const response = await apiService.uploadEquipmentImage(file);

// Get AI response
const message = await apiService.getChatResponse(question, context);

// Start real-time updates
const unsubscribe = apiService.startRealtimeUpdates(interval, callback);
```

## Styling Guide

### Colors

```typescript
// Status colors
const colors = {
  normal: '#10b981',    // Green
  warning: '#f59e0b',   // Yellow
  critical: '#ef4444',  // Red
  offline: '#6b7280',   // Gray
};

// Use with Tailwind classes
<div className="text-green-500 bg-green-500/10 border-green-500/30">
  Normal Status
</div>
```

### Tailwind Classes Reference

```html
<!-- Text colors -->
<p class="text-slate-100">Light text</p>
<p class="text-slate-400">Medium text</p>
<p class="text-slate-700">Dark text</p>

<!-- Background colors -->
<div class="bg-slate-900">Dark background</div>
<div class="bg-blue-600">Blue background</div>

<!-- Borders -->
<div class="border border-slate-700">With border</div>
<div class="border-l-4 border-blue-500">Left border</div>

<!-- Spacing -->
<div class="p-4 mb-4 gap-4">Padding and margin</div>

<!-- Layout -->
<div class="flex items-center justify-between gap-4">
  Flex layout
</div>

<!-- Grid -->
<div class="grid grid-cols-4 gap-4">Grid layout</div>
```

## Environment Variables

Create `.env.local` for local development:

```env
VITE_API_BASE_URL=http://localhost:5173/api
VITE_SENSOR_UPDATE_INTERVAL=2000
VITE_DASHBOARD_REFRESH_INTERVAL=5000
VITE_ENABLE_REAL_TIME_UPDATES=true
VITE_THEME=dark
```

See `.env.example` for all available variables.

## Debugging Tips

### Browser Console

```javascript
// Access Zustand store
window.useAppStore?.getState()

// Check assets
window.useAppStore?.getState().assets

// Update state
window.useAppStore?.getState().setSelectedTab('alerts')
```

### React DevTools

1. Install "React DevTools" browser extension
2. Open DevTools → Components tab
3. Inspect component props and state
4. Track re-renders and performance

### Responsive Testing

```bash
# Test at different breakpoints
Chrome DevTools → Device Toolbar → Select device

# Breakpoints
sm: 640px
md: 768px
lg: 1024px
xl: 1280px
2xl: 1536px
```

## Common Issues & Solutions

### "Cannot find module" error

```bash
rm -r node_modules package-lock.json
npm install
```

### Port 5173 already in use

```bash
npm run dev -- --port 3000
```

### TypeScript errors

```bash
rm tsconfig.tsbuildinfo
npm run build
```

### Styles not applying

1. Check Tailwind CSS content configuration
2. Ensure class names are correct
3. Rebuild CSS: `npm run build`

## Documentation Quick Links

| Document | Purpose |
|----------|---------|
| [START_HERE.md](./START_HERE.md) | Project overview & features |
| [SETUP.md](./SETUP.md) | Installation & deployment |
| [TESTING.md](./TESTING.md) | Unit/E2E testing guide |
| [PERFORMANCE.md](./PERFORMANCE.md) | Optimization strategies |
| [FEATURES.md](./FEATURES.md) | Building new features |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Architecture & patterns |
| [COMPONENTS.md](./COMPONENTS.md) | Component library |
| [API.md](./API.md) | API reference |

## Useful Links

- **Vite Documentation:** https://vitejs.dev
- **React Documentation:** https://react.dev
- **Tailwind CSS:** https://tailwindcss.com
- **TypeScript:** https://www.typescriptlang.org
- **Zustand:** https://github.com/pmndrs/zustand
- **Recharts:** https://recharts.org
- **Lucide Icons:** https://lucide.dev

## Performance Checklist

Before deployment:

- [ ] Run `npm run build` successfully
- [ ] Bundle size < 200 KB
- [ ] Lighthouse score > 90
- [ ] All images optimized
- [ ] Error boundaries in place
- [ ] Loading states implemented
- [ ] Cache headers configured

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes
git add .

# Commit changes
git commit -m "feat: add new feature"

# Push to origin
git push origin feature/new-feature

# Create pull request on GitHub
```

## Support Resources

- **Issues:** Report bugs in GitHub Issues
- **Discussions:** Ask questions in GitHub Discussions
- **Documentation:** Read docs in `docs/` folder
- **Examples:** Check `src/` for code examples

---

**Got questions? Check the relevant documentation file above! 📖**
