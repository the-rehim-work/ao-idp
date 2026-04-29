/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"JetBrains Mono"', '"Courier New"', 'monospace'],
        mono: ['"JetBrains Mono"', '"Courier New"', 'monospace'],
      },
      colors: {
        terminal: {
          cyan: '#00ffff',
          dim: '#00d4e8',
          dark: '#009bb5',
          muted: '#006b8a',
          bg: '#000000',
          surface: '#020d10',
          surface2: '#041520',
          border: 'rgba(0,255,255,0.25)',
        }
      },
    },
  },
  plugins: [],
}
