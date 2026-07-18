export const theme = {
  colors: {
    primary: 'var(--primary)',
    bg: 'var(--background)',
    card: 'var(--card)',
    border: 'var(--border)',
    text: 'var(--foreground)',
    textMuted: 'var(--muted)',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#3b82f6',
  },
  gradients: {
    primary: 'linear-gradient(135deg, var(--primary) 0%, rgba(var(--primary-rgb), 0.8) 100%)',
  },
  shadows: {
    glow: '0 0 15px rgba(var(--primary-rgb), 0.3)',
    card: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    panel: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
  },
  chart: {
    grid: 'var(--border)',
    axis: 'var(--muted)',
    tooltipBg: 'rgba(17, 24, 39, 0.95)',
    tooltipBorder: 'var(--border)',
    colors: ['var(--primary)', '#10b981', '#ef4444', '#3b82f6'],
  },
} as const;

export const tooltipStyle = {
  backgroundColor: 'var(--card)',
  border: '1px solid var(--border-strong)',
  borderRadius: '0.75rem',
  color: 'var(--foreground)',
  fontSize: '12px',
  padding: '10px 14px',
  boxShadow: '0 12px 32px -8px hsl(var(--shadow-color) / 0.6)',
};
