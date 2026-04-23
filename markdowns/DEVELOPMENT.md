# Development Guide

## Architecture Overview

The Industrial Digital Twin Platform uses a clean, scalable architecture designed for enterprise environments.

```
┌─────────────────────────────────────────────────────────┐
│                    React Components                      │
│  (Dashboard, Plant, Alerts, Equipment, Assistant)       │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                  Zustand Store                           │
│  (Global state: assets, alerts, UI state, chat)        │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│              Mock API Service                           │
│  (Data fetching, simulation, real-time updates)        │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│            Mock Data & Generators                       │
│  (Assets, sensors, alerts, equipment data)             │
└─────────────────────────────────────────────────────────┘
```

## Core Concepts

### 1. State Management with Zustand

All global state is managed in a single Zustand store:

```typescript
// Store structure
- UI State: selectedTab, selectedAssetId, sidebarOpen, darkMode
- Data State: assets, alerts, kpis, chatMessages
- Actions: setSelectedAsset, setAlerts, updateAsset, etc.
```

**Why Zustand?**
- Lightweight and simple
- No boilerplate
- Easy to test
- Perfect for mid-size applications

### 2. Mock API Layer

The API service (`services/api.ts`) simulates a real backend:

```typescript
- Realistic async delays (200-1000ms)
- Mock data that changes with each call
- Sensor data that updates realistically
- Error scenarios (coming soon)
```

**When connecting to real API:**
1. Keep the same function signatures
2. Replace implementation with real HTTP calls
3. Update response handling as needed
4. No component changes required

### 3. Component Patterns

#### Container Components (Pages)
- Fetch data from API
- Manage local state
- Connect to Zustand store
- Pass data to presentational components

```typescript
export const Dashboard: React.FC = () => {
  const { assets, setAssets } = useAppStore();
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadData();
  }, []);
  
  return <DashboardUI assets={assets} />;
};
```

#### Presentational Components
- Receive props
- Handle user interactions
- No data fetching
- Reusable across pages

```typescript
interface KPICardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
}

export const KPICard: React.FC<KPICardProps> = (props) => {
  return <div>{/* UI */}</div>;
};
```

### 4. Type Safety

All data is strongly typed:

```typescript
// types/index.ts defines all shapes
interface Asset {
  id: string;
  name: string;
  status: 'normal' | 'warning' | 'critical' | 'offline';
  sensors: Sensor[];
  // ...
}
```

**Benefits:**
- Catch errors at compile time
- Better IDE autocomplete
- Easier refactoring
- Self-documenting code

## File Structure Deep Dive

### `/components`
Reusable, presentational components:

- **Cards.tsx** - KPICard, SensorCard, StatusIndicator, AssetTile
- **TimeSeriesChart.tsx** - Recharts wrapper with custom styling
- **AlertItem.tsx** - Alert display with actions
- **AssetDetailPanel.tsx** - Right-side detail panel
- **AIAssistant.tsx** - Chat interface
- **EquipmentRegistrationForm.tsx** - Image upload and form

**Adding new component:**
```typescript
// Strongly typed props
interface MyComponentProps {
  title: string;
  onClick: (id: string) => void;
}

// Functional component
export const MyComponent: React.FC<MyComponentProps> = (props) => {
  return <div>{/* JSX */}</div>;
};

// Export from component file
```

### `/pages`
Full-page components that manage sections:

- **Dashboard.tsx** - KPIs and charts
- **PlantNavigation.tsx** - Asset grid and selection
- **AlertsPage.tsx** - Alert list and filters
- **EquipmentPage.tsx** - Equipment management
- **AssistantPage.tsx** - Chat interface

**Page pattern:**
```typescript
export const MyPage: React.FC = () => {
  const { data, setData } = useAppStore();
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    apiService.getData().then(data => {
      setData(data);
      setLoading(false);
    });
  }, []);
  
  return <PageLayout>...</PageLayout>;
};
```

### `/services`
API and external service layer:

**api.ts structure:**
- Mock data generators
- Mock asset/alert/KPI data
- API service functions
- Real-time update simulators

**Adding new API method:**
```typescript
export const apiService = {
  // Existing methods...
  
  async getNewData(id: string): Promise<Data> {
    await new Promise(r => setTimeout(r, 300));
    return mockData.find(d => d.id === id);
  }
};
```

### `/store`
Zustand store for global state:

**appStore.ts:**
- Centralized state
- Update actions
- No async logic (use effects in components)

**Pattern:**
```typescript
interface AppStore {
  // State
  selectedAssetId: string | null;
  assets: Asset[];
  
  // Actions
  setSelectedAssetId: (id: string | null) => void;
  setAssets: (assets: Asset[]) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  selectedAssetId: null,
  assets: [],
  setSelectedAssetId: (id) => set({ selectedAssetId: id }),
  setAssets: (assets) => set({ assets }),
}));
```

### `/types`
TypeScript definitions:

**Naming conventions:**
- Use singular names for individual items
- Use plural for arrays
- Use `I` prefix sparingly (modern practice is to avoid it)
- Export all types from single index.ts

## Common Patterns & Best Practices

### 1. Data Fetching

```typescript
useEffect(() => {
  let isMounted = true;
  
  const loadData = async () => {
    try {
      const data = await apiService.getData();
      if (isMounted) {
        setData(data);
      }
    } catch (error) {
      if (isMounted) {
        setError(error.message);
      }
    }
  };
  
  loadData();
  
  return () => {
    isMounted = false; // Cleanup
  };
}, []);
```

### 2. Real-time Updates

```typescript
useEffect(() => {
  const interval = setInterval(async () => {
    const updated = await apiService.updateData();
    setData(updated);
  }, 2000);
  
  return () => clearInterval(interval);
}, []);
```

### 3. Conditional Rendering

```typescript
if (loading) return <LoadingSpinner />;
if (error) return <ErrorMessage error={error} />;
if (!data) return <EmptyState />;

return <Content data={data} />;
```

### 4. Color States

```typescript
const getStatusColor = (status: string) => {
  switch (status) {
    case 'critical':
      return 'text-red-400 bg-red-500/10';
    case 'warning':
      return 'text-yellow-400 bg-yellow-500/10';
    default:
      return 'text-green-400 bg-green-500/10';
  }
};
```

### 5. Responsive Design

```typescript
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  {/* Cols: 1 on mobile, 2 on tablets, 4 on desktop */}
</div>
```

## Styling with Tailwind

### Key Classes Used

```css
/* Layout */
.flex, .grid, .space-y-4

/* Colors */
.bg-slate-800, .text-slate-100
.bg-green-500/20, .text-green-300
.border-blue-500/30

/* Sizing */
.w-full, .h-screen, .p-4

/* States */
.hover:bg-slate-700, .disabled:opacity-50
.focus:outline-none, .focus:border-blue-500

/* Transitions */
.transition-all, .duration-300
```

### Custom Animations

Defined in `index.css`:

```css
@keyframes pulse-glow {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.animate-pulse-glow {
  animation: pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
```

## Testing Approach

### Manual Testing Checklist

- [ ] All navigation works
- [ ] Asset selection opens panel
- [ ] Charts render correctly
- [ ] Alerts filter properly
- [ ] Equipment upload works
- [ ] AI responds to messages
- [ ] Real-time updates happen
- [ ] Responsive on mobile
- [ ] Dark mode works well

### Adding Unit Tests (Future)

```typescript
import { render, screen } from '@testing-library/react';
import { KPICard } from '../components/Cards';

describe('KPICard', () => {
  it('renders title and value', () => {
    render(<KPICard title="Test" value={100} icon={<div />} />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});
```

## Performance Optimization

### Current Optimizations

1. **Component Splitting** - Small, focused components
2. **Zustand** - Minimal re-renders via subscriptions
3. **Tailwind** - CSS purging removes unused styles
4. **Vite** - Fast bundling and HMR
5. **Charts** - Recharts is optimized for re-renders

### Future Optimizations

- Lazy loading pages with `React.lazy()`
- Virtualizing long lists
- Memoizing expensive computations
- Web Workers for heavy calculations
- Service Workers for offline

```typescript
// Example: Lazy loading
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
```

## Extending the Platform

### Adding New Sensor Type

1. **Update types:**
```typescript
// types/index.ts
interface Sensor {
  // ...existing fields
  sensorType: 'temperature' | 'vibration' | 'pressure' | 'humidity'; // NEW
}
```

2. **Update mock data:**
```typescript
// services/api.ts
const generateSensorData = (...) => ({
  // ...
  sensorType: 'humidity',
});
```

3. **Display in component:**
```typescript
// components/SensorCard.tsx
<div className="text-xs text-slate-500">
  Type: {sensor.sensorType}
</div>
```

### Adding New Alert Type

1. **Update enum:**
```typescript
// types/index.ts
severity: 'info' | 'warning' | 'critical' | 'maintenance'; // NEW
```

2. **Update colors:**
```typescript
// components/AlertItem.tsx
case 'maintenance':
  return 'border-blue-500/30 bg-blue-500/10';
```

3. **Create alert in mock data:**
```typescript
// services/api.ts
const mockAlerts = [
  // ...
  {
    severity: 'maintenance',
    title: 'Maintenance Performed',
    // ...
  }
];
```

## Debugging Tips

### Browser DevTools

1. **Components Tab** (React DevTools)
   - Inspect component hierarchy
   - Check props and state
   - Trigger state updates

2. **Console Tab**
   - Check for errors
   - Use `console.log()` for debugging
   - Test API calls

3. **Network Tab**
   - Monitor API calls (when real API is added)
   - Check response times
   - Verify data structure

### Zustand Debugging

```typescript
// In browser console
import { useAppStore } from './store/appStore';

// Get current state
useAppStore.getState();

// Subscribe to changes
useAppStore.subscribe(state => console.log(state));
```

## Common Issues & Solutions

### Issue: "setState during render"
**Solution:** Move state update to useEffect

### Issue: Chart not updating
**Solution:** Ensure data prop changes trigger re-render

### Issue: Styles not applying
**Solution:** Check Tailwind class spelling, clear cache

### Issue: Real-time updates stop
**Solution:** Check interval cleanup in useEffect return

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes and test
npm run dev

# Build for production
npm run build

# Commit with descriptive message
git commit -m "feat: add new sensor type"

# Push and create PR
git push origin feature/new-feature
```

## Deployment Checklist

- [ ] All tests pass
- [ ] No console errors
- [ ] Build succeeds: `npm run build`
- [ ] Environment variables configured
- [ ] API endpoints updated
- [ ] Analytics configured
- [ ] Error tracking setup
- [ ] Performance monitored

## Resources

- **React Patterns**: https://react.dev/reference
- **TypeScript Handbook**: https://www.typescriptlang.org/docs/
- **Tailwind Docs**: https://tailwindcss.com/docs
- **Zustand Guide**: https://github.com/pmndrs/zustand
- **Vite Guide**: https://vitejs.dev/guide/

---

Happy coding! 🚀
