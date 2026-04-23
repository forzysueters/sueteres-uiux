# Component Library Documentation

## Overview

This document describes all reusable components in the Industrial Digital Twin platform.

## Components by Category

### UI Primitives

#### `StatusIndicator`
Status indicator dot with animation.

```typescript
import { StatusIndicator } from '@/components/Cards';

// Usage
<StatusIndicator status="critical" size="md" />

// Props
interface StatusIndicatorProps {
  status: 'normal' | 'warning' | 'critical' | 'offline';
  size?: 'sm' | 'md' | 'lg'; // default: 'md'
}

// Sizes
// sm: 8px, md: 12px, lg: 16px

// Colors
// normal: green-400, warning: yellow-400, critical: red-400, offline: slate-500

// Animations
// normal/warning/critical: pulse glow animation
// offline: no animation
```

#### `SensorCard`
Displays a single sensor with value, unit, status, and progress bar.

```typescript
import { SensorCard } from '@/components/Cards';

// Usage
<SensorCard
  label="Temperature"
  value={65.5}
  unit="°C"
  status="warning"
  min={45}
  max={85}
  threshold={75}
/>

// Props
interface SensorCardProps {
  label: string;
  value: number;
  unit: string;
  status: 'normal' | 'warning' | 'critical';
  min: number;
  max: number;
  threshold: number;
}

// Features
// - Colored value based on status
// - Progress bar showing value position
// - Min/Max/Threshold labels
```

#### `KPICard`
Key Performance Indicator card with icon and trend.

```typescript
import { KPICard } from '@/components/Cards';
import { Activity } from 'lucide-react';

// Usage
<KPICard
  title="Average Uptime"
  value={98.5}
  unit="%"
  icon={<Activity className="w-6 h-6" />}
  status="positive"
  trend={2.3}
/>

// Props
interface KPICardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: React.ReactNode;
  trend?: number;
  status?: 'positive' | 'negative' | 'neutral'; // default: 'neutral'
}

// Status Colors
// positive: green, negative: red, neutral: blue

// Features
// - Icon on right
// - Large value display
// - Trend indicator with arrow
// - Hover effect with border change
```

#### `AssetTile`
Clickable asset representation in plant view.

```typescript
import { AssetTile } from '@/components/Cards';

// Usage
<AssetTile
  asset={assetObject}
  isSelected={selectedAssetId === assetObject.id}
  onClick={(id) => handleSelectAsset(id)}
/>

// Props
interface AssetTileProps {
  asset: Asset;
  isSelected: boolean;
  onClick: (id: string) => void;
}

// Features
// - Asset type icon (⚙️ motor, 💧 pump, 💨 compressor, 🌀 fan)
// - Status indicator with color
// - Name and location
// - Uptime percentage
// - Anomaly score if > 50%
// - Selected state with blue ring

// Status Colors
// normal: green, warning: yellow, critical: red, offline: gray
```

### Data Visualization

#### `TimeSeriesChart`
Line or area chart for time-series sensor data.

```typescript
import { TimeSeriesChart } from '@/components/TimeSeriesChart';

// Usage
<TimeSeriesChart
  data={sensorHistory}
  title="Temperature Trend (Last 60 minutes)"
  dataKey="value"
  unit="°C"
  color="#ef4444"
  thresholdKey="threshold"
  type="area"
/>

// Props
interface TimeSeriesChartProps {
  data: TimeSeriesData[];
  title: string;
  dataKey: string;
  unit: string;
  color?: string; // default: '#3b82f6'
  thresholdKey?: string;
  type?: 'line' | 'area'; // default: 'line'
}

// Data Format
interface TimeSeriesData {
  timestamp: string; // ISO string
  value: number;
  threshold?: number;
}

// Features
// - Responsive container
// - Custom tooltip with timestamp
// - Grid background
// - Threshold line (dashed) if provided
// - Smooth animations
// - Gradient fill for area charts
```

### Business Components

#### `AlertItem`
Individual alert display with resolve action.

```typescript
import { AlertItem } from '@/components/AlertItem';

// Usage
<AlertItem
  alert={alertObject}
  onResolve={(alertId) => handleResolveAlert(alertId)}
/>

// Props
interface AlertItemProps {
  alert: Alert;
  onResolve: (alertId: string) => void;
}

// Alert Data Structure
interface Alert {
  id: string;
  assetId: string;
  assetName: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  timestamp: string;
  resolved: boolean;
  mlInsight?: string;
}

// Features
// - Severity-based color coding
// - Icon indicator for severity
// - Asset reference
// - AI insight box
// - Timestamp
// - Resolved badge
// - Mark Resolved button
// - Hover effect with shadow
```

#### `AssetDetailPanel`
Right-side panel showing detailed asset information.

```typescript
import { AssetDetailPanel } from '@/components/AssetDetailPanel';

// Usage
<AssetDetailPanel
  assetId={selectedAssetId}
  onClose={() => handleClosePanel()}
/>

// Props
interface AssetDetailPanelProps {
  assetId: string | null;
  onClose: () => void;
}

// Features
// - Fixed width (384px)
// - Sticky header with close button
// - Status badge
// - Anomaly score with bar
// - Maintenance schedule
// - Live sensor grid (4-5 cards)
// - Temperature trend chart
// - AI insights box
// - Action buttons (Schedule, History)
// - Scrollable content

// Real-time Updates
// - Sensors update every 2 seconds
// - Charts show 60-minute history
// - Anomaly score recalculated
```

#### `AIAssistant`
Chat interface for maintenance assistance.

```typescript
import { AIAssistant } from '@/components/AIAssistant';

// Usage
<AIAssistant selectedAssetId={assetId} />

// Props
interface AIAssistantProps {
  selectedAssetId?: string;
}

// Features
// - Message history (last 10)
// - User and assistant messages
// - Context indicator for selected asset
// - Loading state
// - Input field with send button
// - Keyboard support (Enter to send)
// - Timestamps on messages

// Message Format
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  assetContext?: string;
}
```

#### `EquipmentRegistrationForm`
Multi-step form for equipment registration.

```typescript
import { EquipmentRegistrationForm } from '@/components/EquipmentRegistrationForm';

// Usage
<EquipmentRegistrationForm assetId={assetId} />

// Props
interface EquipmentRegistrationFormProps {
  assetId?: string;
}

// Steps
// 1. Upload - Image upload with drag-drop
// 2. Form - Edit extracted fields
// 3. Success - Confirmation with details

// Fields
// - Serial Number
// - Manufacturer (auto-extracted)
// - Model (auto-extracted)
// - Year Manufactured (auto-extracted)
// - Power Rating (kW)
// - Image URL

// Features
// - Drag-drop image upload
// - Auto-fill from image analysis
// - Editable form fields
// - Validation
// - Success confirmation
// - New registration button
```

## Page Components

### Dashboard
Complete dashboard with KPIs and charts.

```typescript
import { Dashboard } from '@/pages/Dashboard';

// Features
// - 4 KPI cards (uptime, alerts, anomalies, online assets)
// - Asset status pie chart
// - Anomaly scores bar chart
// - Uptime line chart
// - Fleet overview grid
// - Auto-refresh every 5 seconds
```

### Plant Navigation
Interactive factory layout with assets.

```typescript
import { PlantNavigation } from '@/pages/PlantNavigation';

// Features
// - Responsive grid layout
// - Asset tiles with status
// - Click to select asset
// - Legend showing status colors
// - Empty station placeholders
// - Help text
```

### Alerts Page
Alert management and filtering.

```typescript
import { AlertsPage } from '@/pages/AlertsPage';

// Features
// - Stats cards (total, critical, active, resolved)
// - Severity filters
// - Alert list with items
// - Real-time updates (every 3 seconds)
// - Empty state
// - Mark resolved functionality
```

### Equipment Page
Equipment registration and management.

```typescript
import { EquipmentPage } from '@/pages/EquipmentPage';

// Features
// - Registration form
// - How-it-works guide
// - Recently registered list
// - Equipment management
```

### Assistant Page
AI maintenance chatbot.

```typescript
import { AssistantPage } from '@/pages/AssistantPage';

// Features
// - Chat interface
// - Asset context indicator
// - Quick action buttons
// - Real-time responses
```

## Styling Patterns

### Status Colors

```typescript
// Status -> Color mapping
normal: {
  text: 'text-green-400',
  bg: 'bg-green-500/10',
  border: 'border-green-500/30'
}

warning: {
  text: 'text-yellow-400',
  bg: 'bg-yellow-500/10',
  border: 'border-yellow-500/30'
}

critical: {
  text: 'text-red-400',
  bg: 'bg-red-500/10',
  border: 'border-red-500/30'
}

offline: {
  text: 'text-slate-500',
  bg: 'bg-slate-500/10',
  border: 'border-slate-500/30'
}
```

### Component Base Styles

```typescript
// Card base
bg-slate-800/50 border border-slate-700 rounded-lg p-4

// Hover effect
hover:border-slate-600 hover:shadow-lg transition-all

// Header
border-b border-slate-700 sticky top-0

// Input
bg-slate-700 border border-slate-600 focus:border-blue-500

// Button (primary)
bg-blue-600 hover:bg-blue-700 text-white rounded-lg

// Button (secondary)
bg-slate-700 hover:bg-slate-600 text-slate-100
```

## Props Patterns

### Common Patterns

```typescript
// Optional with defaults
size?: 'sm' | 'md' | 'lg'; // default: 'md'

// Status types
status: 'normal' | 'warning' | 'critical' | 'offline';

// Callbacks
onClick: (id: string) => void;
onResolve: (alertId: string) => void;

// Children
children?: React.ReactNode;

// Data
data: T[];
dataKey: string;
```

## Accessibility

### Built-in Features

- **Semantic HTML** - Proper heading hierarchy
- **Color + Icons** - Status not color-only
- **Keyboard Navigation** - Tab through elements
- **ARIA Labels** - Screen reader support
- **Contrast** - WCAG AA compliant colors

### Component Enhancements

```typescript
// Add to components
<button
  aria-label="Close panel"
  aria-pressed={isOpen}
  onClick={handleClick}
>
  {/* Icon */}
</button>
```

## Performance Considerations

### Optimization Strategies

1. **Memo Components** - Prevent unnecessary renders
```typescript
export const KPICard = React.memo(({ title, value }: Props) => {
  return <div>{/* */}</div>;
});
```

2. **Large Lists** - Use virtualization
```typescript
import { FixedSizeList } from 'react-window';
```

3. **Charts** - Limit data points
```typescript
data.slice(-60) // Last 60 points
```

## Testing Components

### Manual Testing

```bash
# Test each component type
npm run dev

# Check responsiveness
# Chrome DevTools -> Toggle Device Toolbar
```

### Example Test Cases

```typescript
// StatusIndicator
[ ] Renders correct color for status
[ ] Animates for normal/warning/critical
[ ] No animation for offline

// SensorCard
[ ] Displays value and unit
[ ] Shows progress bar
[ ] Color matches status
[ ] Shows min/max/threshold

// TimeSeriesChart
[ ] Renders data points
[ ] Shows tooltip on hover
[ ] Has threshold line if provided
[ ] Responsive to width changes
```

## Best Practices

### When Creating New Components

1. **Props First** - Define interface first
2. **Simple & Focused** - One responsibility
3. **Reusable** - No hardcoded values
4. **Typed** - Full TypeScript coverage
5. **Documented** - JSDoc comments

### Component Template

```typescript
import React from 'react';
import { IconName } from 'lucide-react';

/**
 * Brief description of component
 * 
 * @example
 * <MyComponent title="Test" onClick={handler} />
 */
interface MyComponentProps {
  title: string;
  onClick: (id: string) => void;
}

export const MyComponent: React.FC<MyComponentProps> = ({
  title,
  onClick
}) => {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
      <h3 className="font-semibold text-slate-100">{title}</h3>
    </div>
  );
};
```

## Component Hierarchy

```
App
├── Sidebar (Navigation)
├── Header
└── MainContent
    ├── Dashboard
    │   ├── KPICard (×4)
    │   ├── PieChart
    │   ├── BarChart
    │   └── LineChart
    ├── PlantNavigation
    │   └── AssetTile (×5)
    ├── AlertsPage
    │   └── AlertItem (×N)
    ├── EquipmentPage
    │   └── EquipmentRegistrationForm
    ├── AssistantPage
    │   └── AIAssistant
    └── AssetDetailPanel
        ├── StatusIndicator
        ├── SensorCard (×5)
        ├── TimeSeriesChart
        └── Button (×2)
```

---

**Last Updated:** April 2026
