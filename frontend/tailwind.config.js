/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        forest: {
          50: '#F1F5F1', 100: '#DCE7DE', 200: '#B9CFBE', 300: '#8FB097', 400: '#5F8C6B',
          500: '#3F6F4E', 600: '#2E5A3E', 700: '#244A33', 800: '#1B3A29', 900: '#12281C', 950: '#0B1A12',
        },
        sage: {
          50: '#F4F7F1', 100: '#E6EDE0', 200: '#D2DEC8', 300: '#B7C9A9', 400: '#98B087', 500: '#7C9769',
        },
        cream: { 50: '#FEFCF7', 100: '#FBF7EE', 200: '#F5EFE0', 300: '#EBE2CC' },
        ember: { 100: '#FCE8D4', 300: '#F4B27A', 500: '#E3792B', 600: '#C45F14', 700: '#9C4A0E' },
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'Cambria', 'Times New Roman', 'serif'],
        body: ['Figtree', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(18, 40, 28, 0.06), 0 10px 28px -14px rgba(18, 40, 28, 0.22)',
        lift: '0 2px 4px rgba(18, 40, 28, 0.06), 0 18px 36px -14px rgba(18, 40, 28, 0.32)',
      },
    },
  },
  plugins: [],
};
