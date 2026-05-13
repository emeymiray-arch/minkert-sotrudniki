import tailwindcssAnimate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"Plus Jakarta Sans"',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'sans-serif',
        ],
      },
      colors: {
        accent: 'hsl(var(--accent))',
        'accent-fg': 'hsl(var(--accent-fg))',
        surface: 'hsl(var(--panel))',
        muted: 'hsl(var(--muted))',
        stroke: 'hsl(var(--stroke))',
      },
      boxShadow: {
        glow: '0 0 0 1px hsl(var(--stroke)), 0 18px 48px -24px rgba(0, 0, 0, 0.45)',
        sidebar: '1px 0 0 hsl(var(--stroke))',
      },
      backgroundImage: {
        ambient:
          'radial-gradient(ellipse 90% 55% at 50% -15%, hsl(var(--accent) / 0.14), transparent 52%), radial-gradient(ellipse 60% 40% at 100% 0%, hsl(var(--accent-muted) / 0.08), transparent 45%)',
      },
    },
  },
  plugins: [tailwindcssAnimate],
};
