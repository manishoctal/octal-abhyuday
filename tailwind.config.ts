import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f4ff',
          100: '#dbe4ff',
          200: '#bdcdff',
          300: '#91abff',
          400: '#5e7eff',
          500: '#3b55ff',
          600: '#2433f5',
          700: '#1c24d8',
          800: '#1d21ae',
          900: '#1e2389',
        },
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 12px 2px rgba(250, 204, 21, 0.45)' },
          '50%': { boxShadow: '0 0 28px 8px rgba(250, 204, 21, 0.85)' },
        },
        sparkle: {
          '0%, 100%': { opacity: '0', transform: 'scale(0.4) rotate(0deg)' },
          '50%': { opacity: '1', transform: 'scale(1) rotate(180deg)' },
        },
        lightning: {
          '0%, 92%, 100%': { opacity: '0' },
          '93%, 95%': { opacity: '0.9' },
          '94%, 96%': { opacity: '0.1' },
          '97%': { opacity: '0.7' },
          '98%': { opacity: '0' },
        },
        floaty: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        shimmer: 'shimmer 2.5s linear infinite',
        glow: 'glow 2s ease-in-out infinite',
        sparkle: 'sparkle 1.6s ease-in-out infinite',
        lightning: 'lightning 5s linear infinite',
        floaty: 'floaty 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
