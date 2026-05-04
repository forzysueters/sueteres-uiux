module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        background: 'var(--background)',
        'background-elevated': 'var(--background-elevated)',
        card: 'var(--card)',
        'card-hover': 'var(--card-hover)',
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        muted: 'var(--muted)',
        'muted-soft': 'var(--muted-soft)',
        foreground: 'var(--foreground)',
        'foreground-soft': 'var(--foreground-soft)',
        primary: 'var(--primary)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        info: 'var(--info)',
        slate: {
          950: '#0B1220',
          900: '#111827',
          850: '#1a2235',
          800: '#1F2937',
          700: '#374151',
          600: '#4B5563',
          500: '#6B7280',
          400: '#9CA3AF',
          300: '#D1D5DB',
          200: '#E5E7EB',
          100: '#F3F4F6',
        },
      },
      backgroundImage: {
        'gradient-primary':
          'linear-gradient(135deg, rgb(var(--primary-rgb)) 0%, rgba(var(--primary-rgb), 0.7) 100%)',
        'gradient-mesh':
          'radial-gradient(at 20% 0%, rgba(var(--primary-rgb), 0.18) 0%, transparent 50%), radial-gradient(at 100% 100%, rgba(var(--info-rgb), 0.18) 0%, transparent 50%)',
        'gradient-subtle':
          'linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, transparent 100%)',
      },
      boxShadow: {
        'saas-card': '0 1px 3px 0 rgba(0,0,0,0.08), 0 1px 2px 0 rgba(0,0,0,0.04)',
        'saas-hover':
          '0 12px 32px -12px rgba(0,0,0,0.45), 0 1px 0 0 rgba(255,255,255,0.04) inset',
        'glow-primary':
          '0 0 0 1px rgba(var(--primary-rgb), 0.25), 0 8px 28px -4px rgba(var(--primary-rgb), 0.45)',
        panel: '0 32px 64px -16px rgba(0,0,0,0.6)',
        'inner-light': 'inset 0 1px 0 0 rgba(255,255,255,0.04)',
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
        '3xl': '1.5rem',
      },
      animation: {
        'slide-in-right': 'slide-in-right 0.3s ease-out',
        'slide-in-top': 'slide-in-top 0.2s ease-out',
        'fade-in': 'fade-in 0.4s ease-out',
        'spin-slow': 'spin 3s linear infinite',
        'gradient-shift': 'gradient-shift 8s ease infinite',
        float: 'float 4s ease-in-out infinite',
        'alert-pulse-critical': 'alert-pulse-critical 3s ease-in-out infinite',
        'alert-pulse-warning': 'alert-pulse-warning 4s ease-in-out infinite',
        'badge-pulse-critical': 'badge-pulse-critical 2s ease-out infinite',
        'badge-pulse-warning': 'badge-pulse-warning 2.5s ease-out infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 8px currentColor' },
          '50%': { opacity: '0.6', boxShadow: '0 0 16px currentColor' },
        },
        'pulse-border': {
          '0%, 100%': { borderColor: 'rgba(239,68,68,0.5)' },
          '50%': { borderColor: 'rgba(239,68,68,1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'slide-in-top': {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'bounce-dot': {
          '0%, 80%, 100%': { transform: 'scale(0)', opacity: '0.3' },
          '40%': { transform: 'scale(1)', opacity: '1' },
        },
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'alert-pulse-critical': {
          '0%': {
            boxShadow: '0 0 0 0 rgba(239, 68, 68, 0.5)',
          },
          '100%': {
            boxShadow: '0 0 0 12px rgba(239, 68, 68, 0)',
          },
        },
        'alert-pulse-warning': {
          '0%': {
            boxShadow: '0 0 0 0 rgba(245, 158, 11, 0.4)',
          },
          '100%': {
            boxShadow: '0 0 0 10px rgba(245, 158, 11, 0)',
          },
        },
        'badge-pulse-critical': {
          '0%': {
            boxShadow: '0 0 0 0 rgba(239, 68, 68, 0.6)',
          },
          '100%': {
            boxShadow: '0 0 0 6px rgba(239, 68, 68, 0)',
          },
        },
        'badge-pulse-warning': {
          '0%': {
            boxShadow: '0 0 0 0 rgba(245, 158, 11, 0.5)',
          },
          '100%': {
            boxShadow: '0 0 0 5px rgba(245, 158, 11, 0)',
          },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
