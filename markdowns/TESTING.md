# 🧪 Testing Guide

## Test Strategy

This guide covers testing approaches for the Industrial Digital Twin platform.

---

## Unit Testing Setup

### Install Testing Dependencies

```bash
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom jsdom
```

### Create `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

### Example Unit Test

```typescript
// src/utils/__tests__/helpers.test.ts
import { describe, it, expect } from 'vitest';
import { formatNumber, calculatePercentageChange, clamp } from '../helpers';

describe('Helper Functions', () => {
  describe('formatNumber', () => {
    it('should format numbers with comma separators', () => {
      expect(formatNumber(1234.567, 2)).toBe('1,234.57');
      expect(formatNumber(1000000, 0)).toBe('1,000,000');
    });

    it('should handle decimal places', () => {
      expect(formatNumber(42.12345, 2)).toBe('42.12');
      expect(formatNumber(42.12345, 4)).toBe('42.1235');
    });
  });

  describe('calculatePercentageChange', () => {
    it('should calculate percentage change correctly', () => {
      expect(calculatePercentageChange(120, 100)).toBe(20);
      expect(calculatePercentageChange(80, 100)).toBe(-20);
    });

    it('should return 0 when previous is 0', () => {
      expect(calculatePercentageChange(100, 0)).toBe(0);
    });
  });

  describe('clamp', () => {
    it('should clamp values within range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });
  });
});
```

### Run Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

---

## Component Testing Examples

### Test Cards Component

```typescript
// src/components/__tests__/Cards.test.tsx
import { render, screen } from '@testing-library/react';
import { KPICard } from '../Cards';

describe('KPICard', () => {
  it('should render KPI card with correct data', () => {
    render(
      <KPICard
        title="Equipment Status"
        value={42}
        unit="Assets"
        icon="AlertTriangle"
        trend={5}
        status="normal"
      />
    );

    expect(screen.getByText('Equipment Status')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Assets')).toBeInTheDocument();
  });

  it('should display trend correctly', () => {
    const { container } = render(
      <KPICard
        title="Test"
        value={100}
        unit="Units"
        icon="Zap"
        trend={10}
        status="warning"
      />
    );

    const trendElement = container.querySelector('[data-testid="trend"]');
    expect(trendElement).toHaveTextContent('+10%');
  });
});
```

---

## Integration Testing

### API Service Testing

```typescript
// src/services/__tests__/api.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiService } from '../api';

describe('API Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAssets', () => {
    it('should return an array of assets', async () => {
      const assets = await apiService.getAssets();
      expect(Array.isArray(assets)).toBe(true);
      expect(assets.length).toBeGreaterThan(0);
    });

    it('should return assets with required properties', async () => {
      const assets = await apiService.getAssets();
      const asset = assets[0];

      expect(asset).toHaveProperty('id');
      expect(asset).toHaveProperty('name');
      expect(asset).toHaveProperty('status');
      expect(asset).toHaveProperty('sensors');
    });
  });

  describe('getKPIMetrics', () => {
    it('should return KPI metrics', async () => {
      const kpis = await apiService.getKPIMetrics();
      
      expect(kpis).toHaveProperty('totalAssets');
      expect(kpis).toHaveProperty('normalAssets');
      expect(kpis).toHaveProperty('warningAssets');
      expect(kpis).toHaveProperty('criticalAssets');
    });

    it('should return valid KPI values', async () => {
      const kpis = await apiService.getKPIMetrics();
      
      expect(kpis.totalAssets).toBeGreaterThan(0);
      expect(kpis.uptime).toBeGreaterThanOrEqual(0);
      expect(kpis.uptime).toBeLessThanOrEqual(100);
    });
  });
});
```

---

## Store (Zustand) Testing

### Test App Store

```typescript
// src/store/__tests__/appStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../appStore';

describe('App Store', () => {
  beforeEach(() => {
    // Reset store state
    const store = useAppStore.getState();
    store.setSelectedTab('dashboard');
    store.setSelectedAsset(null);
  });

  it('should manage selected tab', () => {
    const store = useAppStore.getState();
    
    expect(store.selectedTab).toBe('dashboard');
    
    store.setSelectedTab('alerts');
    expect(store.selectedTab).toBe('alerts');
  });

  it('should manage selected asset', () => {
    const store = useAppStore.getState();
    
    expect(store.selectedAssetId).toBeNull();
    
    store.setSelectedAsset('motor-001');
    expect(store.selectedAssetId).toBe('motor-001');
    
    store.setSelectedAsset(null);
    expect(store.selectedAssetId).toBeNull();
  });

  it('should manage assets list', () => {
    const store = useAppStore.getState();
    const mockAssets = [
      {
        id: 'motor-001',
        name: 'Test Motor',
        type: 'motor',
        location: 'Hall A',
        status: 'normal',
        uptime: 99,
        sensors: [],
        lastMaintenance: '2026-03-15',
        nextMaintenance: '2026-06-15',
        x: 1,
        y: 1,
        anomalyScore: 10,
      },
    ];

    store.setAssets(mockAssets);
    expect(store.assets).toEqual(mockAssets);
  });
});
```

---

## End-to-End Testing

### Setup Playwright

```bash
npm install --save-dev @playwright/test
npx playwright install
```

### Example E2E Test

```typescript
// e2e/dashboard.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Dashboard Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
  });

  test('should load dashboard with KPI cards', async ({ page }) => {
    // Check for dashboard heading
    await expect(page.locator('h1')).toContainText('Dashboard');

    // Check for KPI cards
    const kpiCards = page.locator('[data-testid="kpi-card"]');
    await expect(kpiCards).toHaveCount(4);
  });

  test('should display asset status pie chart', async ({ page }) => {
    const pieChart = page.locator('[data-testid="asset-status-chart"]');
    await expect(pieChart).toBeVisible();
  });

  test('should refresh data periodically', async ({ page }) => {
    const beforeTime = new Date().getTime();

    // Wait for 6 seconds
    await page.waitForTimeout(6000);

    const afterTime = new Date().getTime();
    expect(afterTime - beforeTime).toBeGreaterThan(5000);
  });
});

test.describe('Asset Details Panel', () => {
  test('should open asset detail panel on asset click', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // Click on an asset
    const assetTile = page.locator('[data-testid="asset-tile"]').first();
    await assetTile.click();

    // Check if detail panel is visible
    const detailPanel = page.locator('[data-testid="asset-detail-panel"]');
    await expect(detailPanel).toBeVisible();
  });

  test('should display sensor data in detail panel', async ({ page }) => {
    await page.goto('http://localhost:5173');

    const assetTile = page.locator('[data-testid="asset-tile"]').first();
    await assetTile.click();

    const sensors = page.locator('[data-testid="sensor-card"]');
    await expect(sensors.first()).toBeVisible();
  });
});
```

### Run E2E Tests

```bash
# Run all E2E tests
npx playwright test

# Run with UI mode
npx playwright test --ui

# Run specific test file
npx playwright test e2e/dashboard.spec.ts
```

---

## Performance Testing

### Lighthouse Testing

```bash
# Install Lighthouse CLI
npm install --save-dev @lhci/cli @lhci/core

# Run Lighthouse CI
lhci autorun
```

### Create `lighthouserc.json`

```json
{
  "ci": {
    "collect": {
      "url": ["http://localhost:5173"],
      "numberOfRuns": 3
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
```

### Performance Benchmarking

```typescript
// src/__tests__/performance.test.ts
import { describe, it, expect } from 'vitest';
import { performance } from 'perf_hooks';

describe('Performance', () => {
  it('should render dashboard in under 1 second', async () => {
    const startTime = performance.now();
    
    // Simulate render
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const endTime = performance.now();
    const renderTime = endTime - startTime;
    
    expect(renderTime).toBeLessThan(1000);
  });

  it('should load 5 assets with sensors efficiently', async () => {
    const startTime = performance.now();
    
    // Simulate data loading
    const assets = Array.from({ length: 5 }, (_, i) => ({
      id: `motor-${i}`,
      name: `Motor ${i}`,
      sensors: Array.from({ length: 5 }, (_, j) => ({
        id: `sensor-${j}`,
        value: Math.random() * 100,
      })),
    }));
    
    const endTime = performance.now();
    const loadTime = endTime - startTime;
    
    expect(assets).toHaveLength(5);
    expect(loadTime).toBeLessThan(100);
  });
});
```

---

## Test Coverage

### Generate Coverage Report

```bash
npm run test:coverage
```

### Coverage Targets

- **Statements:** 80%
- **Branches:** 75%
- **Functions:** 80%
- **Lines:** 80%

### View Coverage Report

```bash
# Open coverage report in browser
open coverage/index.html
```

---

## Continuous Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run build
      - run: npm run test
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3
```

---

## Manual Testing Checklist

### Dashboard
- [ ] KPI cards display correct values
- [ ] Charts render with data
- [ ] Auto-refresh works every 5 seconds
- [ ] Status indicators show correct colors

### Plant Navigation
- [ ] Asset tiles render
- [ ] Can click to select asset
- [ ] Selected asset highlights
- [ ] Detail panel opens

### Alerts Page
- [ ] Alerts load and display
- [ ] Can filter by severity
- [ ] Mark as resolved works
- [ ] Pagination works

### Equipment Registration
- [ ] Form submits correctly
- [ ] Image upload works
- [ ] Validation shows errors
- [ ] Success message appears

### AI Assistant
- [ ] Chat interface loads
- [ ] Can type and send messages
- [ ] Responses appear
- [ ] Context is maintained

---

## Debugging Tips

### Browser DevTools

```javascript
// In console
// Access Zustand store
useAppStore.getState()

// Check assets
useAppStore.getState().assets

// Set a value
useAppStore.getState().setSelectedTab('dashboard')
```

### Network Throttling

Simulate slow network in DevTools:
1. Open DevTools → Network tab
2. Set throttling to "Slow 3G"
3. Test UI behavior with delays

### React DevTools

Install React DevTools browser extension:
- View component hierarchy
- Inspect props and state
- Track re-renders
- Profile performance

---

## Test Maintenance

Keep tests updated when:
- [ ] Component props change
- [ ] API endpoints change
- [ ] Store structure changes
- [ ] Design patterns evolve

---

**Happy testing! 🧪**
