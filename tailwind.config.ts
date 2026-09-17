import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}', './popup.html'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#F1F0FE',
          100: '#E3E1FD',
          200: '#C7C3FB',
          300: '#A29CF7',
          400: '#7A72F0',
          500: '#5B4FE8',
          600: '#4536D1',
          700: '#362AAD',
          800: '#2B2189',
          900: '#201967',
        },
        surface: 'var(--surface)',
        'surface-raised': 'var(--surface-raised)',
        'surface-sunken': 'var(--surface-sunken)',
        border: {
          DEFAULT: 'var(--border)',
          strong: 'var(--border-strong)',
        },
        ink: {
          DEFAULT: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
        },
        link: {
          DEFAULT: 'var(--link)',
          hover: 'var(--link-hover)',
        },
        good: { bg: 'var(--good-bg)', fg: 'var(--good-fg)' },
        warn: { bg: 'var(--warn-bg)', fg: 'var(--warn-fg)' },
        bad: { bg: 'var(--bad-bg)', fg: 'var(--bad-fg)' },
        info: { bg: 'var(--info-bg)', fg: 'var(--info-fg)' },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
        mono: [
          '"SF Mono"',
          'ui-monospace',
          '"Cascadia Code"',
          '"Roboto Mono"',
          'Menlo',
          'Consolas',
          'monospace',
        ],
      },
      boxShadow: {
        card: '0 1px 2px rgba(21,17,38,0.05), 0 10px 24px -14px rgba(21,17,38,0.28)',
      },
    },
  },
  plugins: [],
} satisfies Config
