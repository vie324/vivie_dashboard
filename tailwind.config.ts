import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        vivie: {
          DEFAULT: '#DCA9A8',
          50: '#FCF6F6',
          100: '#F8E8E7',
          200: '#EFCFCD',
          300: '#DCA9A8',  /* ブランドカラー */
          400: '#C98785',
          500: '#B36A68',
          600: '#955351',
          700: '#754140',
          800: '#553030',
          900: '#3A2222',
        },
        /* シャンパンゴールド — 高級感のためのアクセント */
        gold: {
          50: '#FBF8F1',
          100: '#F5EEDD',
          200: '#E9DBB8',
          300: '#D9C28C',
          400: '#C9A96A',
          500: '#B08D57',
          600: '#92703F',
          700: '#745730',
          800: '#564023',
          900: '#3B2C18',
        },
        ink: {
          50: '#F8F7F5',
          100: '#EFEDE9',
          200: '#D9D5CE',
          300: '#B6AFA4',
          400: '#928A7E',
          500: '#6B6359',
          600: '#554E46',
          700: '#3F3A33',
          800: '#2E2A25',
          900: '#1F1B16',
        },
      },
      fontFamily: {
        sans: ['var(--font-noto-sans-jp)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-shippori)', 'serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(31,27,22,0.04), 0 8px 24px -12px rgba(31,27,22,0.12)',
        lift: '0 2px 4px rgba(31,27,22,0.05), 0 18px 36px -18px rgba(149,83,81,0.28)',
        glow: '0 0 0 1px rgba(201,169,106,0.22), 0 12px 32px -12px rgba(201,169,106,0.35)',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'bar-grow': {
          '0%': { width: '0%' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.45s cubic-bezier(0.22, 1, 0.36, 1)',
        'scale-in': 'scale-in 0.25s ease-out',
        shimmer: 'shimmer 2.2s linear infinite',
        'bar-grow': 'bar-grow 0.8s cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
