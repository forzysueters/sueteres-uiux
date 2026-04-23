# 🎯 Feature Enhancement Guide

## Overview

This guide provides architecture and implementation patterns for extending the Industrial Digital Twin platform with new features.

---

## Feature Development Process

### 1. Planning Phase

**Define Requirements:**
- User stories
- Acceptance criteria
- Technical requirements
- Dependencies

**Example Feature: Real-time Anomaly Detection**

```
As a maintenance engineer,
I want to receive real-time anomaly alerts,
So that I can respond immediately to equipment issues.

Acceptance Criteria:
✓ System detects anomalies within 5 seconds
✓ Alert displays with severity level
✓ Sound notification plays
✓ Alert can be dismissed
```

### 2. Architecture Phase

**Design:**
- Data structure
- Components
- State management
- API endpoints

---

## Adding New Features

### Feature 1: Real-Time Notifications

```typescript
// 1. Add to types/index.ts
export interface Notification {
  id: string;
  type: 'alert' | 'info' | 'success' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

// 2. Add to store/appStore.ts
interface AppStore {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  markNotificationRead: (id: string) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  notifications: [],
  
  addNotification: (notification) =>
    set((state) => ({
      notifications: [
        {
          id: generateId(),
          timestamp: new Date(),
          ...notification,
        },
        ...state.notifications,
      ],
    })),

  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),

  markNotificationRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    })),
}));

// 3. Create component (src/components/NotificationCenter.tsx)
export const NotificationCenter: React.FC = () => {
  const { notifications, removeNotification } = useAppStore();

  return (
    <div className="fixed top-4 right-4 space-y-2 max-w-md">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`p-4 rounded-lg border animate-slide-in ${
            notification.type === 'alert'
              ? 'bg-red-500/10 border-red-500/30'
              : 'bg-blue-500/10 border-blue-500/30'
          }`}
        >
          <div className="flex justify-between items-start">
            <div>
              <h4 className="font-semibold">{notification.title}</h4>
              <p className="text-sm text-slate-400">{notification.message}</p>
            </div>
            <button
              onClick={() => removeNotification(notification.id)}
              className="text-slate-400 hover:text-slate-200"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

// 4. Use in App.tsx
function App() {
  return (
    <div className="flex h-screen">
      {/* ... existing content ... */}
      <NotificationCenter />
    </div>
  );
}
```

### Feature 2: Dark/Light Theme Toggle

```typescript
// 1. Add to store/appStore.ts
interface AppStore {
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
}

export const useAppStore = create<AppStore>((set) => ({
  theme: (localStorage.getItem('theme') as any) || 'dark',

  setTheme: (theme) => {
    localStorage.setItem('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    set({ theme });
  },
}));

// 2. Create theme toggle component
export const ThemeToggle: React.FC = () => {
  const { theme, setTheme } = useAppStore();

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
    >
      {theme === 'dark' ? (
        <Sun size={20} className="text-yellow-400" />
      ) : (
        <Moon size={20} className="text-blue-400" />
      )}
    </button>
  );
};

// 3. Update tailwind.config.cjs
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        light: {
          bg: '#ffffff',
          fg: '#000000',
        },
      },
    },
  },
};

// 4. Update index.css
html[data-theme='light'] {
  @apply bg-white text-slate-900;
}

html[data-theme='dark'] {
  @apply bg-slate-950 text-slate-100;
}
```

### Feature 3: Equipment History & Timeline

```typescript
// 1. Update types/index.ts
export interface MaintenanceEvent {
  id: string;
  assetId: string;
  date: Date;
  type: 'maintenance' | 'failure' | 'replacement' | 'upgrade';
  description: string;
  technician: string;
  duration: number; // in minutes
  cost: number;
}

// 2. Create timeline component
export const MaintenanceTimeline: React.FC<{ assetId: string }> = ({
  assetId,
}) => {
  const [events, setEvents] = useState<MaintenanceEvent[]>([]);

  useEffect(() => {
    // Fetch from API
    apiService.getMaintenanceHistory(assetId).then(setEvents);
  }, [assetId]);

  return (
    <div className="space-y-4">
      {events.map((event) => (
        <div key={event.id} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <div className="w-1 h-20 bg-slate-700" />
          </div>
          <div className="pb-8">
            <h4 className="font-semibold">{event.type}</h4>
            <p className="text-sm text-slate-400">{event.description}</p>
            <p className="text-xs text-slate-500 mt-1">
              {formatDateTime(event.date)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};
```

### Feature 4: Predictive Maintenance Score

```typescript
// 1. Update types/index.ts
export interface PredictiveScore {
  assetId: string;
  score: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  failureProbability: number; // 0-1
  estimatedDaysToFailure: number;
  recommendation: string;
}

// 2. Create score component
export const PredictiveScoreCard: React.FC<{ assetId: string }> = ({
  assetId,
}) => {
  const [score, setScore] = useState<PredictiveScore | null>(null);

  useEffect(() => {
    apiService.getPredictiveScore(assetId).then(setScore);
  }, [assetId]);

  if (!score) return <SkeletonLoader />;

  const getScoreColor = () => {
    if (score.riskLevel === 'low') return 'text-green-500';
    if (score.riskLevel === 'medium') return 'text-yellow-500';
    if (score.riskLevel === 'high') return 'text-orange-500';
    return 'text-red-500';
  };

  return (
    <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
      <h3 className="text-lg font-semibold mb-4">Health Score</h3>
      
      <div className="mb-4">
        <div className={`text-4xl font-bold ${getScoreColor()}`}>
          {score.score}%
        </div>
        <p className="text-sm text-slate-400 mt-1">
          Risk Level: {score.riskLevel.toUpperCase()}
        </p>
      </div>

      <div className="space-y-2 text-sm">
        <p>
          Failure Probability:{' '}
          <span className="font-semibold">
            {(score.failureProbability * 100).toFixed(1)}%
          </span>
        </p>
        <p>
          Days to Failure:{' '}
          <span className="font-semibold">{score.estimatedDaysToFailure}</span>
        </p>
      </div>

      <div className="mt-4 p-3 bg-slate-800 rounded border border-slate-700">
        <p className="text-sm text-slate-300">{score.recommendation}</p>
      </div>
    </div>
  );
};
```

### Feature 5: Custom Dashboards

```typescript
// 1. Add to types/index.ts
export interface DashboardConfig {
  id: string;
  name: string;
  widgets: {
    id: string;
    type: 'kpi' | 'chart' | 'table' | 'gauge';
    config: any;
    position: { x: number; y: number };
    size: { width: number; height: number };
  }[];
  isDefault: boolean;
}

// 2. Create dashboard builder
export const DashboardBuilder: React.FC = () => {
  const [dashboards, setDashboards] = useState<DashboardConfig[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  const addWidget = (type: string) => {
    if (!selected) return;
    // Add new widget to dashboard
  };

  return (
    <div className="grid grid-cols-12 gap-4">
      {/* Dashboard list */}
      <aside className="col-span-3 bg-slate-900 p-4 rounded-lg">
        {dashboards.map((dashboard) => (
          <button
            key={dashboard.id}
            onClick={() => setSelected(dashboard.id)}
            className={`w-full text-left p-2 rounded mb-2 ${
              selected === dashboard.id
                ? 'bg-blue-600'
                : 'hover:bg-slate-800'
            }`}
          >
            {dashboard.name}
          </button>
        ))}
      </aside>

      {/* Widget editor */}
      <div className="col-span-9">
        {/* Widget configuration UI */}
      </div>
    </div>
  );
};
```

### Feature 6: Export & Reporting

```typescript
// 1. Create export service
export const exportService = {
  exportAsCSV: (data: any[], filename: string) => {
    const csv = data.map(row =>
      Object.values(row).join(',')
    ).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
  },

  exportAsPDF: async (html: HTMLElement, filename: string) => {
    const { jsPDF } = await import('jspdf');
    const { html2canvas } = await import('html2canvas');
    
    const canvas = await html2canvas(html);
    const pdf = new jsPDF();
    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', 0, 0);
    pdf.save(`${filename}.pdf`);
  },

  exportAsJSON: (data: any[], filename: string) => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.json`;
    a.click();
  },
};

// 2. Use in component
export const ReportGenerator: React.FC = () => {
  const { alerts } = useAppStore();

  return (
    <div className="space-x-2">
      <button onClick={() => exportService.exportAsCSV(alerts, 'alerts')}>
        Export CSV
      </button>
      <button onClick={() => exportService.exportAsJSON(alerts, 'alerts')}>
        Export JSON
      </button>
    </div>
  );
};
```

---

## Best Practices for New Features

### 1. Type Safety

```typescript
// ✅ Always define types first
interface Feature {
  id: string;
  name: string;
  enabled: boolean;
}

// Use in component
export const MyComponent: React.FC<{ feature: Feature }> = ({ feature }) => {
  // TypeScript ensures type safety
};
```

### 2. Error Handling

```typescript
// ✅ Handle errors gracefully
export const loadFeatureData = async () => {
  try {
    const data = await api.getFeatureData();
    return data;
  } catch (error) {
    console.error('Failed to load feature:', error);
    showNotification({
      type: 'error',
      message: 'Failed to load feature data',
    });
    return null;
  }
};
```

### 3. Testing

```typescript
// ✅ Write tests for new features
describe('NewFeature', () => {
  it('should load data on mount', async () => {
    // Test implementation
  });

  it('should handle errors gracefully', async () => {
    // Error handling test
  });
});
```

### 4. Documentation

```typescript
/**
 * Feature: Real-time Anomaly Detection
 *
 * Detects anomalies in sensor data and alerts users.
 *
 * @example
 * ```tsx
 * <AnomalyDetector assetId="motor-001" />
 * ```
 */
export const AnomalyDetector: React.FC = () => {
  // Implementation
};
```

---

## Integration Patterns

### Pattern 1: Feature Flag

```typescript
// Feature toggle
const FEATURES = {
  REAL_TIME_ALERTS: true,
  PREDICTIVE_MAINTENANCE: true,
  DARK_MODE: true,
  CUSTOM_DASHBOARDS: false,
};

export const isFeatureEnabled = (feature: keyof typeof FEATURES): boolean => {
  return FEATURES[feature] ?? false;
};

// Use in component
{isFeatureEnabled('CUSTOM_DASHBOARDS') && <DashboardBuilder />}
```

### Pattern 2: Plugin Architecture

```typescript
type PluginType = 'dashboard' | 'alert' | 'report';

interface Plugin {
  name: string;
  type: PluginType;
  component: React.ComponentType<any>;
  config?: any;
}

const plugins: Map<string, Plugin> = new Map();

export const registerPlugin = (plugin: Plugin) => {
  plugins.set(plugin.name, plugin);
};

export const getPlugin = (name: string): Plugin | undefined => {
  return plugins.get(name);
};
```

### Pattern 3: Middleware/Interceptor

```typescript
type Middleware = (next: Function) => (action: any) => void;

const loggingMiddleware: Middleware = (next) => (action) => {
  console.log('Action:', action);
  next(action);
  console.log('State updated');
};

// Use in store
export const useAppStore = create<AppStore>(
  (set) => ({
    // store definition
  }),
  loggingMiddleware
);
```

---

## Performance Considerations

### For Heavy Computations

```typescript
// Use Web Worker
const worker = new Worker(new URL('./worker.ts', import.meta.url), {
  type: 'module',
});

export const computeAnomalyScore = (data: Sensor[]): Promise<number> => {
  return new Promise((resolve) => {
    worker.postMessage(data);
    worker.onmessage = (e) => resolve(e.data);
  });
};
```

### For Large Datasets

```typescript
// Use virtual scrolling
import { FixedSizeList } from 'react-window';

export const LargeDatasetView: React.FC<{ items: any[] }> = ({ items }) => {
  return (
    <FixedSizeList
      height={600}
      itemCount={items.length}
      itemSize={80}
    >
      {({ index, style }) => (
        <DataRow style={style} data={items[index]} />
      )}
    </FixedSizeList>
  );
};
```

---

## Feature Checklist

Before merging a new feature:

- [ ] TypeScript types defined
- [ ] Component created with proper props
- [ ] State management integrated
- [ ] API service updated
- [ ] Error handling implemented
- [ ] Loading states added
- [ ] Unit tests written
- [ ] E2E tests written
- [ ] Documentation updated
- [ ] Performance optimized
- [ ] Accessibility checked
- [ ] Responsive design verified
- [ ] Code reviewed
- [ ] Merged to main branch

---

**Happy building! 🎉**
