/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cyber: {
          primary: '#00E5FF',
          glow: 'rgba(0, 229, 255, 0.5)',
        },
        bg: {
          base: '#050505',
          surface: '#121212',
          elevated: '#1E1E1E',
        },
        border: {
          subtle: '#333333',
        },
        status: {
          critical: '#FF2A2A',
          warning: '#FF9F0A',
          success: '#39FF14',
        },
        text: {
          main: '#E0E0E0',
          muted: '#A0A0A0',
        },
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "'Roboto Mono'", 'monospace'],
        sans: ["'Inter'", "'Roboto'", 'sans-serif'],
      },
      fontSize: {
        hero: '32px',
        h1: '24px',
        h2: '20px',
        body: '14px',
        small: '12px',
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
      },
      boxShadow: {
        glow: '0 0 10px rgba(0, 229, 255, 0.3)',
        critical: '0 0 15px rgba(255, 42, 42, 0.4)',
        card: '0 4px 20px rgba(0, 0, 0, 0.5)',
      },
      animation: {
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 10px rgba(0, 229, 255, 0.3)' },
          '50%': { boxShadow: '0 0 20px rgba(0, 229, 255, 0.6)' },
        },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
