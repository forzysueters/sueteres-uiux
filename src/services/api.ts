import { Asset, Alert, KPIMetrics, EquipmentRegistration, ChatMessage, Sensor } from '../types';

// Mock data generators
const generateSensorData = (baseName: string, unit: string, baseValue: number, variance: number): Sensor => ({
  id: `sensor-${Math.random()}`,
  name: baseName,
  unit,
  value: baseValue + (Math.random() - 0.5) * variance,
  min: baseValue * 0.7,
  max: baseValue * 1.3,
  threshold: baseValue * 1.2,
  status: Math.random() > 0.8 ? 'warning' : 'normal',
});

const mockAssets: Asset[] = [
  {
    id: 'motor-001',
    name: 'Main Production Motor',
    type: 'motor',
    location: 'Hall A - Station 1',
    status: 'normal',
    uptime: 99.8,
    sensors: [
      generateSensorData('Voltage', 'V', 380, 10),
      generateSensorData('Current', 'A', 45, 5),
      generateSensorData('Temperature', '°C', 65, 15),
      generateSensorData('RPM', 'rpm', 1480, 20),
      generateSensorData('Vibration', 'mm/s', 2.5, 1),
    ],
    lastMaintenance: '2026-03-15',
    nextMaintenance: '2026-06-15',
    x: 1,
    y: 1,
    anomalyScore: 12,
  },
  {
    id: 'motor-002',
    name: 'Backup Motor',
    type: 'motor',
    location: 'Hall A - Station 2',
    status: 'warning',
    uptime: 95.2,
    sensors: [
      generateSensorData('Voltage', 'V', 380, 15),
      generateSensorData('Current', 'A', 52, 8),
      generateSensorData('Temperature', '°C', 72, 20),
      generateSensorData('RPM', 'rpm', 1470, 30),
      generateSensorData('Vibration', 'mm/s', 4.2, 1.5),
    ],
    lastMaintenance: '2026-01-20',
    nextMaintenance: '2026-04-20',
    x: 3,
    y: 1,
    anomalyScore: 58,
  },
  {
    id: 'pump-001',
    name: 'Coolant Circulation Pump',
    type: 'pump',
    location: 'Hall B - Cooling System',
    status: 'normal',
    uptime: 99.5,
    sensors: [
      generateSensorData('Pressure', 'bar', 2.5, 0.5),
      generateSensorData('Flow Rate', 'L/min', 150, 20),
      generateSensorData('Temperature', '°C', 45, 10),
      generateSensorData('Power', 'kW', 5, 1),
    ],
    lastMaintenance: '2026-02-28',
    nextMaintenance: '2026-05-28',
    x: 1,
    y: 3,
    anomalyScore: 8,
  },
  {
    id: 'compressor-001',
    name: 'Air Compressor',
    type: 'compressor',
    location: 'Hall C - Pneumatics',
    status: 'critical',
    uptime: 78.3,
    sensors: [
      generateSensorData('Outlet Pressure', 'bar', 7.0, 1),
      generateSensorData('Inlet Temp', '°C', 28, 5),
      generateSensorData('Outlet Temp', '°C', 82, 15),
      generateSensorData('Motor Current', 'A', 35, 5),
      generateSensorData('Vibration', 'mm/s', 6.8, 2),
    ],
    lastMaintenance: '2025-12-10',
    nextMaintenance: '2026-03-10',
    x: 3,
    y: 3,
    anomalyScore: 85,
  },
  {
    id: 'fan-001',
    name: 'Ventilation Fan',
    type: 'fan',
    location: 'Hall A - Roof',
    status: 'normal',
    uptime: 99.2,
    sensors: [
      generateSensorData('Speed', '%', 85, 10),
      generateSensorData('Motor Current', 'A', 8, 1),
      generateSensorData('Bearing Temp', '°C', 55, 8),
      generateSensorData('Vibration', 'mm/s', 1.2, 0.5),
    ],
    lastMaintenance: '2026-03-01',
    nextMaintenance: '2026-06-01',
    x: 2,
    y: 2,
    anomalyScore: 15,
  },
];

const mockAlerts: Alert[] = [
  {
    id: 'alert-001',
    assetId: 'compressor-001',
    assetName: 'Air Compressor',
    severity: 'critical',
    title: 'High Vibration Detected',
    description: 'Vibration levels have exceeded safe thresholds. Immediate maintenance required.',
    timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
    resolved: false,
    mlInsight: 'ML Model predicts bearing failure within 7 days with 89% confidence.',
  },
  {
    id: 'alert-002',
    assetId: 'motor-002',
    assetName: 'Backup Motor',
    severity: 'warning',
    title: 'Elevated Temperature',
    description: 'Motor temperature is above normal operating range.',
    timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
    resolved: false,
    mlInsight: 'Temperature trend suggests cooling system degradation. Recommend coolant check.',
  },
  {
    id: 'alert-003',
    assetId: 'motor-001',
    assetName: 'Main Production Motor',
    severity: 'info',
    title: 'Scheduled Maintenance Due',
    description: 'Preventive maintenance is scheduled for June 15, 2026.',
    timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
    resolved: false,
  },
  {
    id: 'alert-004',
    assetId: 'pump-001',
    assetName: 'Coolant Circulation Pump',
    severity: 'info',
    title: 'Performance Optimal',
    description: 'Pump operating within normal parameters.',
    timestamp: new Date(Date.now() - 24 * 3600000).toISOString(),
    resolved: true,
  },
];

// API Service
export const apiService = {
  // Assets
  async getAssets(): Promise<Asset[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return mockAssets;
  },

  async getAssetById(id: string): Promise<Asset | undefined> {
    await new Promise(resolve => setTimeout(resolve, 200));
    return mockAssets.find(a => a.id === id);
  },

  async updateAssetSensors(assetId: string): Promise<Asset | undefined> {
    // Simulate real-time data updates
    const asset = mockAssets.find(a => a.id === assetId);
    if (asset) {
      asset.sensors = asset.sensors.map(sensor => ({
        ...sensor,
        value: sensor.value + (Math.random() - 0.5) * (sensor.max - sensor.min) * 0.05,
      }));
      asset.anomalyScore = Math.min(100, asset.anomalyScore + (Math.random() - 0.5) * 5);
    }
    return asset;
  },

  // Alerts
  async getAlerts(): Promise<Alert[]> {
    await new Promise(resolve => setTimeout(resolve, 250));
    return mockAlerts;
  },

  async resolveAlert(alertId: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 150));
    const alert = mockAlerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
    }
  },

  // KPIs
  async getKPIMetrics(): Promise<KPIMetrics> {
    await new Promise(resolve => setTimeout(resolve, 200));
    const onlineAssets = mockAssets.filter(a => a.status !== 'offline').length;
    const criticalAlerts = mockAlerts.filter(a => !a.resolved && a.severity === 'critical').length;
    const anomalies = mockAssets.filter(a => a.anomalyScore > 50).length;

    return {
      totalUptime: (mockAssets.reduce((sum, a) => sum + a.uptime, 0) / mockAssets.length),
      activeAlerts: mockAlerts.filter(a => !a.resolved).length,
      anomaliesDetected: anomalies,
      assetsOnline: onlineAssets,
      totalAssets: mockAssets.length,
      predictedFailures: criticalAlerts,
    };
  },

  // Equipment Registration
  async registerEquipment(data: Omit<EquipmentRegistration, 'id' | 'registeredAt'>): Promise<EquipmentRegistration> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return {
      ...data,
      id: `reg-${Date.now()}`,
      registeredAt: new Date().toISOString(),
    };
  },

  // AI Assistant
  async getChatResponse(message: string, assetContext?: string): Promise<ChatMessage> {
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const responses: Record<string, string> = {
      'compressor': 'Based on the vibration data, the air compressor is showing signs of bearing wear. I recommend scheduling maintenance within the next 48 hours. Replace the bearing seal and check the lubrication system.',
      'temperature': 'The elevated temperature reading suggests possible cooling system degradation. Check the coolant level, verify fan operation, and inspect heat exchanger for blockages.',
      'vibration': 'High vibration levels typically indicate misalignment, bearing issues, or imbalance. Perform an alignment check and inspect rotating components for damage.',
      'maintenance': 'Based on operating hours and anomaly patterns, this asset is due for preventive maintenance. Plan for component inspection, bearing lubrication, and thermal imaging.',
      'default': 'The asset is performing normally with all parameters within acceptable ranges. Continue monitoring and schedule routine maintenance as planned.',
    };

    let response = responses['default'];
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('compressor')) response = responses['compressor'];
    else if (lowerMessage.includes('temperature')) response = responses['temperature'];
    else if (lowerMessage.includes('vibration')) response = responses['vibration'];
    else if (lowerMessage.includes('maintenance')) response = responses['maintenance'];

    return {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: response,
      timestamp: new Date().toISOString(),
      assetContext,
    };
  },

  // Image upload simulation
  async uploadEquipmentImage(file: File): Promise<{ url: string; extractedData: Partial<EquipmentRegistration> }> {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Simulate image analysis and data extraction
    const mockManufacturers = ['ABB', 'Siemens', 'GE', 'Bosch Rexroth', 'SEW-EURODRIVE'];
    const mockModels = ['AE200L', 'IE3-132S', 'MOT-5055', 'MOVIGEAR', 'GEARBOX-2.2'];
    
    return {
      url: URL.createObjectURL(file),
      extractedData: {
        manufacturer: mockManufacturers[Math.floor(Math.random() * mockManufacturers.length)],
        model: mockModels[Math.floor(Math.random() * mockModels.length)],
        serialNumber: `SN${Math.random().toString(36).substring(2, 11).toUpperCase()}`,
        yearManufactured: 2020 + Math.floor(Math.random() * 4),
        powerRating: 5 + Math.floor(Math.random() * 90),
      },
    };
  },
};

// Real-time data simulation
export const startRealtimeUpdates = (assetId: string, callback: (asset: Asset) => void) => {
  const interval = setInterval(async () => {
    const updated = await apiService.updateAssetSensors(assetId);
    if (updated) {
      callback(updated);
    }
  }, 2000);

  return () => clearInterval(interval);
};
