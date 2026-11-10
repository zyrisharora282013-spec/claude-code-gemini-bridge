/** @type {import('tailwindcss').Config} */
export default {
  content: ['./*.html', './partials/*.html', './src/**/*.js'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#07060d', 900: '#0d0b18', 800: '#15122a', 700: '#1f1b3a', border: '#2a2548' },
        violet: { 400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed' },
        cyan: { 300: '#67e8f9', 400: '#22d3ee', 500: '#06b6d4' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
