# ⚡ Performance Optimization Guide

## Overview

This guide covers strategies to optimize the Industrial Digital Twin platform for production environments.

---

## Metrics to Monitor

### Core Web Vitals

| Metric | Target | Tool |
|--------|--------|------|
| **Largest Contentful Paint (LCP)** | < 2.5s | Lighthouse |
| **First Input Delay (FID)** | < 100ms | Chrome DevTools |
| **Cumulative Layout Shift (CLS)** | < 0.1 | Lighthouse |
| **First Contentful Paint (FCP)** | < 1.8s | Lighthouse |
| **Time to Interactive (TTI)** | < 3.8s | Lighthouse |

---

## Bundle Size Optimization

### Current Bundle Analysis

```bash
# Analyze bundle size
npm run build -- --visualize
```

### Code Splitting Strategy

**Current:** Vite automatically code-splits by route
- Dashboard: ~45 KB
- Plant Navigation: ~35 KB
- Alerts: ~25 KB
- Equipment: ~30 KB
- Assistant: ~20 KB
- Shared: ~35 KB

### Lazy Load Components

```typescript
// Before: All loaded upfront
import Dashboard from './pages/Dashboard';
import AlertsPage from './pages/AlertsPage';

// After: Lazy loaded
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const AlertsPage = React.lazy(() => import('./pages/AlertsPage'));

// Use with Suspense
<Suspense fallback={<LoadingSpinner />}>
  <Dashboard />
</Suspense>
```

### Tree Shaking Optimization

```typescript
// ❌ Bad: Imports entire module
import * from 'lucide-react';

// ✅ Good: Import only needed icons
import { AlertTriangle, Check, X } from 'lucide-react';
```

### Recharts Optimization

```typescript
// ✅ Good: Import only needed chart types
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

// Use ResponsiveContainer for efficient rendering
<ResponsiveContainer width="100%" height={300}>
  <LineChart data={data}>
    {/* chart config */}
  </LineChart>
</ResponsiveContainer>
```

---

## Runtime Performance

### React Optimization

#### 1. Memoization

```typescript
// Memoize expensive components
import { memo } from 'react';

export const KPICard = memo(({ title, value, unit }: Props) => {
  return (
    <div className="kpi-card">
      <h3>{title}</h3>
      <p>{value} {unit}</p>
    </div>
  );
});

// Only re-renders if props change
```

#### 2. useMemo for Expensive Calculations

```typescript
import { useMemo } from 'react';

export const Dashboard = () => {
  const { assets } = useAppStore();

  // Only recalculate if assets change
  const assetStats = useMemo(() => {
    return {
      total: assets.length,
      normal: assets.filter(a => a.status === 'normal').length,
      warning: assets.filter(a => a.status === 'warning').length,
      critical: assets.filter(a => a.status === 'critical').length,
    };
  }, [assets]);

  return <div>{assetStats.total} Assets</div>;
};
```

#### 3. useCallback for Event Handlers

```typescript
import { useCallback } from 'react';

export const AlertsPage = () => {
  const { alerts, markResolved } = useAppStore();

  // Memoize callback to prevent re-renders
  const handleResolve = useCallback((alertId: string) => {
    markResolved(alertId);
  }, [markResolved]);

  return (
    <div>
      {alerts.map(alert => (
        <AlertItem
          key={alert.id}
          alert={alert}
          onResolve={handleResolve}
        />
      ))}
    </div>
  );
};
```

### State Management Optimization

#### 1. Zustand Selector Optimization

```typescript
// ❌ Bad: Causes re-renders on ANY state change
const store = useAppStore();

// ✅ Good: Only re-renders if selectedTab changes
const selectedTab = useAppStore((state) => state.selectedTab);

// ✅ Better: Batch selectors
const { assets, alerts } = useAppStore((state) => ({
  assets: state.assets,
  alerts: state.alerts,
}));
```

#### 2. Slice Store Pattern

```typescript
// In appStore.ts - organize related actions
export const useAppStore = create<AppStore>((set) => ({
  // UI State
  selectedTab: 'dashboard',
  setSelectedTab: (tab) => set({ selectedTab: tab }),

  // Asset State
  assets: [],
  setAssets: (assets) => set({ assets }),

  // Alert State
  alerts: [],
  setAlerts: (alerts) => set({ alerts }),
}));
```

### Data Fetching Optimization

#### 1. Request Deduplication

```typescript
// API service with deduplication
let assetCache: Promise<Asset[]> | null = null;

export const getAssets = async (): Promise<Asset[]> => {
  if (assetCache) {
    return assetCache;
  }

  assetCache = fetch('/api/assets').then(r => r.json());
  const assets = await assetCache;
  assetCache = null;

  return assets;
};
```

#### 2. Stale-While-Revalidate Pattern

```typescript
// Serve cached data, update in background
let cachedAssets: Asset[] | null = null;

export const getAssets = async (): Promise<Asset[]> => {
  // Return cached data immediately
  if (cachedAssets) {
    // Update cache in background
    fetch('/api/assets')
      .then(r => r.json())
      .then(data => { cachedAssets = data; });

    return cachedAssets;
  }

  // First load
  const response = await fetch('/api/assets');
  cachedAssets = await response.json();
  return cachedAssets;
};
```

#### 3. Pagination for Large Lists

```typescript
interface UsePaginationProps {
  items: any[];
  pageSize: number;
}

export const usePagination = ({
  items,
  pageSize = 10,
}: UsePaginationProps) => {
  const [page, setPage] = useState(1);

  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  return {
    items: paginatedItems,
    page,
    setPage,
    totalPages: Math.ceil(items.length / pageSize),
  };
};
```

### Virtual Scrolling for Large Lists

```typescript
import { FixedSizeList } from 'react-window';

export const VirtualAlertsList = ({ alerts }: Props) => {
  return (
    <FixedSizeList
      height={600}
      itemCount={alerts.length}
      itemSize={80}
      width="100%"
    >
      {({ index, style }) => (
        <AlertItem
          style={style}
          alert={alerts[index]}
        />
      )}
    </FixedSizeList>
  );
};
```

---

## Network Optimization

### 1. Gzip Compression

Enable in your hosting provider or `vite.config.ts`:

```typescript
import viteCompression from 'vite-plugin-compression';

export default defineConfig({
  plugins: [
    react(),
    viteCompression({
      algorithm: 'gzip',
      ext: '.gz',
    }),
  ],
});
```

### 2. Minification

Already handled by Vite build:
- JavaScript minified via esbuild
- CSS minified via PostCSS
- HTML minified

### 3. Asset Optimization

#### Image Optimization

```typescript
// Use modern image formats
<picture>
  <source srcSet="image.webp" type="image/webp" />
  <img src="image.png" alt="description" loading="lazy" />
</picture>

// Responsive images
<img
  src="image-md.png"
  srcSet="image-sm.png 640w, image-md.png 1024w, image-lg.png 1920w"
  alt="description"
/>
```

#### Icon Optimization

Currently using Lucide React (optimized SVG icons):
- Icons are tree-shaken at build time
- Only used icons are included
- ~1-2 KB per icon vs ~20 KB for icon fonts

### 4. Service Worker Caching

```typescript
// vite.config.ts
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      manifest: {
        name: 'Industrial Digital Twin',
        short_name: 'IDT',
        icons: [
          {
            src: '/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
});
```

---

## Rendering Performance

### 1. Avoid Unnecessary Re-renders

```typescript
// ❌ Bad: Object literal creates new ref each render
<Component config={{ a: 1, b: 2 }} />

// ✅ Good: Define outside component
const CONFIG = { a: 1, b: 2 };

export const MyComponent = () => {
  return <Component config={CONFIG} />;
};
```

### 2. Conditional Rendering Optimization

```typescript
// ❌ Bad: Renders both branches
{condition ? <Heavy /> : null}

// ✅ Good: Only renders if condition is true
{condition && <Heavy />}
```

### 3. Key Optimization in Lists

```typescript
// ❌ Bad: Using array index as key
{assets.map((asset, index) => (
  <AssetTile key={index} asset={asset} />
))}

// ✅ Good: Use unique, stable ID
{assets.map(asset => (
  <AssetTile key={asset.id} asset={asset} />
))}
```

### 4. Animation Performance

```typescript
// ✅ Use CSS animations (GPU accelerated)
.animate-pulse-glow {
  animation: pulse-glow 2s ease-in-out infinite;
}

// ❌ Avoid: JavaScript-based animations
setInterval(() => {
  element.style.opacity = Math.random();
}, 16);
```

---

## CSS Performance

### 1. Tailwind CSS Optimization

Already configured in `tailwind.config.cjs`:

```javascript
{
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  // Only included classes that are used
}
```

### 2. Critical CSS

First load only essential styles:

```html
<!-- Inline critical styles in head -->
<style>
  body { margin: 0; background: #0f172a; }
  .loading { display: flex; }
</style>
```

### 3. CSS-in-JS Optimization

Not using CSS-in-JS (using Tailwind instead):
- Zero runtime overhead
- Better performance than styled-components
- All processing at build time

---

## Caching Strategy

### Browser Caching Headers

```
# For assets with hash (cache forever)
/assets/main.*.js → Cache-Control: max-age=31536000, immutable

# For HTML (cache briefly)
/index.html → Cache-Control: max-age=3600

# For API (don't cache)
/api/* → Cache-Control: no-store
```

### Service Worker Caching

```typescript
// Cache strategies
const CACHE_NAME = 'idt-v1';

// Cache on install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/src/main.tsx',
      ]);
    })
  );
});

// Serve from cache, update in background
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return (
        response ||
        fetch(event.request).then((response) => {
          if (!response) return response;
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
      );
    })
  );
});
```

---

## Monitoring & Profiling

### 1. Lighthouse CI

```bash
npm install --save-dev @lhci/cli@^0.9.0

lhci autorun
```

### 2. Performance Budgets

```json
{
  "budgets": [
    {
      "type": "bundle",
      "name": "main",
      "limits": ["200 KB"]
    },
    {
      "type": "bundle",
      "name": "vendors",
      "limits": ["100 KB"]
    }
  ]
}
```

### 3. Real User Monitoring (RUM)

```typescript
// Track Core Web Vitals
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

getCLS(metric => console.log('CLS', metric));
getFID(metric => console.log('FID', metric));
getFCP(metric => console.log('FCP', metric));
getLCP(metric => console.log('LCP', metric));
getTTFB(metric => console.log('TTFB', metric));
```

---

## Production Checklist

- [ ] Run `npm run build` successfully
- [ ] Bundle size < 200 KB
- [ ] All images optimized
- [ ] Service worker configured
- [ ] Gzip compression enabled
- [ ] Cache headers configured
- [ ] CDN configured
- [ ] Lighthouse score > 90
- [ ] Core Web Vitals green
- [ ] Error tracking enabled
- [ ] Analytics configured
- [ ] Performance monitored

---

## Quick Performance Wins

```bash
# 1. Update dependencies (latest = best optimizations)
npm update

# 2. Analyze bundle
npm run build -- --visualize

# 3. Run Lighthouse
npm run build && npm run preview
# Then use Chrome DevTools → Lighthouse

# 4. Check performance metrics
open https://web.dev/measure/

# 5. Monitor in production
# Set up Sentry + Web Vitals
```

---

**Your app will be blazing fast! 🚀**
