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
          50: '#FBF4F4',
          100: '#F5E5E4',
          200: '#EAC9C7',
          300: '#DCA9A8',
          400: '#C98785',
          500: '#B36A68',
          600: '#955351',
          700: '#754140',
          800: '#553030',
          900: '#3A2222',
        },
        ink: {
          50: '#F8F7F5',
          100: '#EFEDE9',
          200: '#D9D5CE',
          300: '#B6AFA4',
          500: '#6B6359',
          700: '#3F3A33',
          900: '#1F1B16',
        },
      },
      fontFamily: {
        sans: ['var(--font-noto-sans-jp)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-shippori)', 'serif'],
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.35s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
