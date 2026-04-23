# API Documentation

## Overview

The Industrial Digital Twin platform uses a mock API layer that simulates a real backend. This documentation explains how to use and extend the API.

## Getting Started

### Importing the API

```typescript
import { apiService } from '@/services/api';
```

### Basic Usage

```typescript
// Fetch all assets
const assets = await apiService.getAssets();

// Fetch KPI metrics
const metrics = await apiService.getKPIMetrics();

// Handle errors
try {
  const alert = await apiService.resolveAlert(alertId);
} catch (error) {
  console.error('Failed to resolve alert:', error);
}
```

## API Methods

### Assets

#### `getAssets(): Promise<Asset[]>`
Fetches all factory assets with current sensor data.

```typescript
const assets = await apiService.getAssets();

// Returns array of Asset objects
[
  {
    id: 'motor-001',
    name: 'Main Production Motor',
    type: 'motor',
    location: 'Hall A - Station 1',
    status: 'normal',
    uptime: 99.8,
    sensors: [/* ... */],
    // ... more fields
  }
]

// Response Time: ~300ms
// Typical Size: 2-5 KB per asset
```

**Response Format:**
```typescript
interface Asset {
  id: string;                      // Unique identifier
  name: string;                    // Display name
  type: 'motor' | 'pump' | 'compressor' | 'fan';
  location: string;                // Physical location in plant
  status: 'normal' | 'warning' | 'critical' | 'offline';
  uptime: number;                  // Percentage (0-100)
  sensors: Sensor[];               // Live sensor data
  lastMaintenance: string;          // ISO date string
  nextMaintenance: string;          // ISO date string
  imageUrl?: string;               // Equipment photo
  x: number;                       // Grid position X
  y: number;                       // Grid position Y
  anomalyScore: number;            // 0-100, higher = more anomalous
}

interface Sensor {
  id: string;
  name: string;
  unit: string;
  value: number;                   // Current reading
  min: number;                     // Normal minimum
  max: number;                     // Normal maximum
  threshold: number;               // Alert threshold
  status: 'normal' | 'warning' | 'critical';
}
```

#### `getAssetById(id: string): Promise<Asset | undefined>`
Fetches a specific asset by ID.

```typescript
const asset = await apiService.getAssetById('motor-001');

// Returns single Asset object or undefined
// Response Time: ~200ms
```

**Use Cases:**
- Loading detail panel for selected asset
- Updating single asset after action
- Pre-loading asset data before displaying

#### `updateAssetSensors(assetId: string): Promise<Asset | undefined>`
Updates sensor readings for an asset (simulates real-time data).

```typescript
const updated = await apiService.updateAssetSensors('motor-001');

// Returns updated Asset with new sensor values
// Simulates real sensor data changes
// Response Time: ~200ms
// Used for: Real-time monitoring every 2-3 seconds

// Example setup in component:
useEffect(() => {
  const interval = setInterval(async () => {
    const updated = await apiService.updateAssetSensors(assetId);
    if (updated) setAsset(updated);
  }, 2000);
  
  return () => clearInterval(interval);
}, [assetId]);
```

**Behavior:**
- Sensor values change slightly (±5% variance)
- Anomaly score adjusts gradually
- Status may change (e.g., normal → warning)
- Realistic simulation of operating equipment

### Alerts

#### `getAlerts(): Promise<Alert[]>`
Fetches all alerts (active and resolved).

```typescript
const alerts = await apiService.getAlerts();

// Returns array of Alert objects
[
  {
    id: 'alert-001',
    assetId: 'compressor-001',
    assetName: 'Air Compressor',
    severity: 'critical',
    title: 'High Vibration Detected',
    description: 'Vibration levels have exceeded...',
    timestamp: '2026-04-23T10:30:00.000Z',
    resolved: false,
    mlInsight: 'ML Model predicts bearing failure...'
  }
]

// Response Time: ~250ms
// Typical Size: 1-2 KB per alert
```

**Response Format:**
```typescript
interface Alert {
  id: string;                      // Unique identifier
  assetId: string;                 // Related asset
  assetName: string;               // Asset display name
  severity: 'info' | 'warning' | 'critical';
  title: string;                   // Alert headline
  description: string;             // Detailed explanation
  timestamp: string;               // ISO date when raised
  resolved: boolean;               // Acknowledged by user
  mlInsight?: string;              // AI-generated recommendation
}
```

#### `resolveAlert(alertId: string): Promise<void>`
Marks an alert as resolved.

```typescript
await apiService.resolveAlert('alert-001');

// Updates alert.resolved = true
// Response Time: ~150ms

// Usage:
const handleResolveAlert = async (alertId: string) => {
  try {
    await apiService.resolveAlert(alertId);
    // Update local state
    setAlerts(alerts.map(a => 
      a.id === alertId ? { ...a, resolved: true } : a
    ));
  } catch (error) {
    console.error('Failed to resolve alert');
  }
};
```

### Key Performance Indicators (KPIs)

#### `getKPIMetrics(): Promise<KPIMetrics>`
Fetches fleet-wide performance metrics.

```typescript
const metrics = await apiService.getKPIMetrics();

// Returns KPI metrics object
{
  totalUptime: 98.5,           // Average uptime %
  activeAlerts: 2,             // Current open alerts
  anomaliesDetected: 1,        // Assets with high anomaly scores
  assetsOnline: 5,             // Number of online assets
  totalAssets: 5,              // Total in fleet
  predictedFailures: 1         // Critical risk assets
}

// Response Time: ~200ms
// Recalculated from current asset data
```

**Response Format:**
```typescript
interface KPIMetrics {
  totalUptime: number;             // 0-100, fleet average
  activeAlerts: number;            // Count of unresolved alerts
  anomaliesDetected: number;       // Count of assets with score > 50
  assetsOnline: number;            // Count of non-offline assets
  totalAssets: number;             // Total in database
  predictedFailures: number;       // Critical severity alerts
}
```

**Calculation Logic:**
```typescript
{
  totalUptime: sum(asset.uptime) / count(assets),
  activeAlerts: count(alerts where !resolved),
  anomaliesDetected: count(assets where anomalyScore > 50),
  assetsOnline: count(assets where status !== 'offline'),
  totalAssets: count(assets),
  predictedFailures: count(alerts where severity === 'critical' && !resolved)
}
```

### Equipment Registration

#### `registerEquipment(data): Promise<EquipmentRegistration>`
Registers a new piece of equipment.

```typescript
const registration = await apiService.registerEquipment({
  assetId: 'motor-001',
  serialNumber: 'SN123456789',
  manufacturer: 'ABB',
  model: 'IE3-132M',
  yearManufactured: 2022,
  powerRating: 22,
  imageUrl: 'data:image/png;base64,...'
});

// Returns registration object with ID
{
  id: 'reg-1713870600000',
  assetId: 'motor-001',
  serialNumber: 'SN123456789',
  manufacturer: 'ABB',
  model: 'IE3-132M',
  yearManufactured: 2022,
  powerRating: 22,
  imageUrl: '...',
  registeredAt: '2026-04-23T10:30:00.000Z'
}

// Response Time: ~300ms
```

**Input Format:**
```typescript
interface EquipmentRegistrationInput {
  assetId: string;              // Link to asset
  serialNumber: string;         // Required
  manufacturer: string;         // Required
  model: string;               // Required
  yearManufactured: number;    // Required
  powerRating: number;         // In kW
  imageUrl?: string;           // Optional photo
}

// Output Format:
interface EquipmentRegistration extends EquipmentRegistrationInput {
  id: string;                  // Generated ID
  registeredAt: string;        // ISO timestamp
}
```

#### `uploadEquipmentImage(file: File): Promise<{url: string, extractedData: ...}>`
Simulates image upload and OCR extraction.

```typescript
const file = event.target.files[0];
const result = await apiService.uploadEquipmentImage(file);

// Returns mock extracted data
{
  url: 'blob:http://localhost:5173/abc123...',
  extractedData: {
    manufacturer: 'ABB',
    model: 'IE3-132M',
    serialNumber: 'SNABM987654',
    yearManufactured: 2021,
    powerRating: 18.5
  }
}

// Response Time: ~1000ms (simulates processing)
```

**Features:**
- Converts File to blob URL for preview
- Simulates Computer Vision extraction
- Returns mock but realistic data
- Generates random (but valid-looking) values

### AI Assistant

#### `getChatResponse(message: string, assetContext?: string): Promise<ChatMessage>`
Gets AI response to maintenance question.

```typescript
const response = await apiService.getChatResponse(
  'Why is vibration high?',
  'compressor-001'
);

// Returns ChatMessage from assistant
{
  id: 'msg-1713870600000',
  role: 'assistant',
  content: 'High vibration typically indicates misalignment, bearing issues...',
  timestamp: '2026-04-23T10:30:00.000Z',
  assetContext: 'compressor-001'
}

// Response Time: ~800ms (simulates thinking)
```

**Response Format:**
```typescript
interface ChatMessage {
  id: string;                    // Generated ID
  role: 'user' | 'assistant';   // Message sender
  content: string;               // Actual message text
  timestamp: string;             // ISO date
  assetContext?: string;         // Asset ID if contextual
}
```

**Response Logic:**
```typescript
// Matches keywords in message to provide relevant responses
const responses = {
  'compressor': 'Vibration data suggests bearing wear...',
  'temperature': 'Elevated temperature indicates cooling degradation...',
  'vibration': 'High vibration typically means misalignment or bearing issues...',
  'maintenance': 'Based on operating hours and anomaly patterns...',
  'default': 'The asset is performing normally...'
};

// Selects response based on message content
```

## Real-Time Features

### Polling Pattern

```typescript
// Update KPIs every 5 seconds
useEffect(() => {
  const interval = setInterval(async () => {
    const metrics = await apiService.getKPIMetrics();
    setKPIs(metrics);
  }, 5000);
  
  return () => clearInterval(interval);
}, []);
```

### Real-Time Sensors

```typescript
// Update single asset every 2 seconds when viewing
useEffect(() => {
  if (!assetId) return;
  
  const stopUpdating = startRealtimeUpdates(assetId, (updated) => {
    setAsset(updated);
  });
  
  return stopUpdating;
}, [assetId]);
```

### Export

```typescript
export const startRealtimeUpdates = (
  assetId: string,
  callback: (asset: Asset) => void
) => {
  const interval = setInterval(async () => {
    const updated = await apiService.updateAssetSensors(assetId);
    if (updated) callback(updated);
  }, 2000);
  
  return () => clearInterval(interval);
};
```

## Extending the API

### Adding a New Endpoint

1. **Define the response type:**
```typescript
// types/index.ts
interface NewData {
  id: string;
  // ... fields
}
```

2. **Create mock data:**
```typescript
// services/api.ts
const mockNewData: NewData[] = [
  { id: '1', /* ... */ }
];
```

3. **Add API method:**
```typescript
export const apiService = {
  // ... existing methods
  
  async getNewData(): Promise<NewData[]> {
    await new Promise(r => setTimeout(r, 300));
    return mockNewData;
  }
};
```

4. **Use in component:**
```typescript
const data = await apiService.getNewData();
```

### Switching to Real API

When connecting to a real backend:

1. **Keep function signatures** - Components don't change
2. **Replace implementation:**
```typescript
// Before (mock)
async getAssets(): Promise<Asset[]> {
  await new Promise(r => setTimeout(r, 300));
  return mockAssets;
}

// After (real API)
async getAssets(): Promise<Asset[]> {
  const response = await fetch('/api/assets');
  return response.json();
}
```

3. **Handle errors:**
```typescript
async getAssets(): Promise<Asset[]> {
  try {
    const response = await fetch('/api/assets');
    if (!response.ok) throw new Error('Failed to fetch');
    return response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}
```

## Error Handling

### Current (Mock API)
Mock API doesn't throw errors - in production, add:

```typescript
// Example production error handling
async getAssets(): Promise<Asset[]> {
  try {
    const response = await fetch('/api/assets');
    if (!response.ok) {
      throw new APIError(`HTTP ${response.status}`);
    }
    return response.json();
  } catch (error) {
    // Notify user of error
    throw error;
  }
}
```

### Component Error Handling

```typescript
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  loadData()
    .catch(error => {
      setError(error.message);
      console.error('Load failed:', error);
    });
}, []);

if (error) return <ErrorMessage error={error} />;
```

## Response Times

| Endpoint | Time | Notes |
|----------|------|-------|
| `getAssets()` | 300ms | Simulates DB query |
| `getAssetById()` | 200ms | Single asset lookup |
| `updateAssetSensors()` | 200ms | Quick sensor update |
| `getAlerts()` | 250ms | Alert query |
| `resolveAlert()` | 150ms | Simple update |
| `getKPIMetrics()` | 200ms | Calculation |
| `registerEquipment()` | 300ms | Data storage |
| `uploadEquipmentImage()` | 1000ms | Image processing |
| `getChatResponse()` | 800ms | AI thinking time |

## Data Size Estimates

| Resource | Typical Size | Notes |
|----------|-------------|-------|
| Single Asset | 2-5 KB | Includes 4-5 sensors |
| Sensor | 200-300 bytes | One reading |
| Alert | 1-2 KB | With AI insight |
| Chart Data | 5-10 KB | 60-point history |
| Dashboard | 15-20 KB | Full KPIs & data |

## Best Practices

### 1. Error Handling
```typescript
try {
  const data = await apiService.getData();
  setData(data);
} catch (error) {
  setError('Failed to load data');
}
```

### 2. Loading States
```typescript
const [loading, setLoading] = useState(false);

useEffect(() => {
  setLoading(true);
  loadData().finally(() => setLoading(false));
}, []);
```

### 3. Cleanup Intervals
```typescript
useEffect(() => {
  const interval = setInterval(updateData, 5000);
  return () => clearInterval(interval);
}, []);
```

### 4. Debouncing Updates
```typescript
import { useCallback } from 'react';

const debouncedUpdate = useCallback(
  debounce(async () => {
    await apiService.updateAsset(asset);
  }, 1000),
  [asset]
);
```

## Rate Limiting

Mock API doesn't implement rate limiting, but production should:

```typescript
// Implementation example
class RateLimiter {
  private calls: { [key: string]: number[] } = {};
  
  async checkLimit(key: string, limit: number, window: number) {
    // Track calls and enforce limit
  }
}
```

## Caching Strategy

For production:

```typescript
// Simple cache
const cache = new Map<string, { data: any; time: number }>();

async function getCachedData(key: string) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.time < 5000) {
    return cached.data;
  }
  // Fetch fresh data
}
```

## WebSocket Support (Future)

```typescript
// Planned for real-time updates
const socket = io('wss://api.example.com');

socket.on('asset-update', (asset) => {
  updateAsset(asset);
});
```

---

**Last Updated:** April 2026
