/**
 * Utility functions for the Industrial Digital Twin Platform
 */

/**
 * Format a number with comma separators
 */
export const formatNumber = (value: number, decimals = 2): string => {
  return parseFloat(value.toFixed(decimals)).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

/**
 * Format a date to a readable string
 */
export const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Format a date with time
 */
export const formatDateTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Get color based on status
 */
export const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    normal: '#10b981', // green
    warning: '#f59e0b', // yellow
    critical: '#ef4444', // red
    offline: '#6b7280', // gray
  };
  return colors[status] || colors.normal;
};

/**
 * Get text color based on status (for Tailwind)
 */
export const getStatusTextColor = (status: string): string => {
  const colors: Record<string, string> = {
    normal: 'text-green-500',
    warning: 'text-yellow-500',
    critical: 'text-red-500',
    offline: 'text-gray-500',
  };
  return colors[status] || colors.normal;
};

/**
 * Get background color based on status (for Tailwind)
 */
export const getStatusBgColor = (status: string): string => {
  const colors: Record<string, string> = {
    normal: 'bg-green-500/10 border-green-500/30',
    warning: 'bg-yellow-500/10 border-yellow-500/30',
    critical: 'bg-red-500/10 border-red-500/30',
    offline: 'bg-gray-500/10 border-gray-500/30',
  };
  return colors[status] || colors.normal;
};

/**
 * Calculate percentage change
 */
export const calculatePercentageChange = (current: number, previous: number): number => {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
};

/**
 * Debounce function
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * Throttle function
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

/**
 * Check if a value is within a safe range
 */
export const isWithinRange = (
  value: number,
  min: number,
  max: number
): boolean => value >= min && value <= max;

/**
 * Get anomaly severity level
 */
export const getAnomalySeverity = (score: number): 'low' | 'medium' | 'high' | 'critical' => {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
};

/**
 * Delay execution
 */
export const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retry logic for failed operations
 */
export const retry = async <T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> => {
  let lastError: Error | null = null;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (i < maxRetries - 1) {
        await delay(delayMs * (i + 1)); // exponential backoff
      }
    }
  }
  throw lastError;
};

/**
 * Clamp a number between min and max
 */
export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/**
 * Generate a random ID
 */
export const generateId = (): string =>
  `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

/**
 * Deep clone an object
 */
export const deepClone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));
