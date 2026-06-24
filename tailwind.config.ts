import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#FFF4E8',
          100: '#FFE4C0',
          200: '#FED098',
          300: '#FEBC70',
          400: '#FEA852',
          500: '#FE9234',   // ← Octal primary
          600: '#E87620',
          700: '#C85F10',
          800: '#A04A0A',
          900: '#7C3808',
        },
        surface: {
          DEFAULT: '#F8FAFC',
          card:    '#FFFFFF',
          muted:   '#F1F5F9',
        },
        ink: {
          DEFAULT: '#0F172A',
          muted:   '#64748B',
          faint:   '#94A3B8',
        },
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        card:  '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card-md': '0 4px 12px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.04)',
        'card-lg': '0 8px 24px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)',
        'brand-sm': '0 4px 14px rgba(254,146,52,0.30)',
        'brand-md': '0 8px 24px rgba(254,146,52,0.35)',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition:  '200% 0' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 12px 2px rgba(254,146,52,0.35)' },
          '50%':      { boxShadow: '0 0 28px 8px rgba(254,146,52,0.55)' },
        },
        sparkle: {
          '0%, 100%': { opacity: '0', transform: 'scale(0.4) rotate(0deg)' },
          '50%':      { opacity: '1', transform: 'scale(1) rotate(180deg)' },
        },
        lightning: {
          '0%, 92%, 100%': { opacity: '0' },
          '93%, 95%': { opacity: '0.9' },
          '94%, 96%': { opacity: '0.1' },
          '97%': { opacity: '0.7' },
          '98%': { opacity: '0' },
        },
        'fade-up': {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%':   { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        shimmer:    'shimmer 2.5s linear infinite',
        glow:       'glow 2s ease-in-out infinite',
        sparkle:    'sparkle 1.6s ease-in-out infinite',
        lightning:  'lightning 5s linear infinite',
        'fade-up':  'fade-up 0.25s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
