/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        pitch: "#050508",
        charcoal: {
          900: "#0A0A0F",
          800: "#0D0D14",
          700: "#14141F",
          600: "#1A1A28"
        },
        terminal: {
          green: "#00FF66",
          amber: "#FFB000",
          cyan: "#00F0FF",
          dim: "#445566",
          border: "#222222",
          hairline: "#181824"
        }
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'Consolas', '"Courier New"', 'monospace'],
        display: ['"Space Mono"', 'monospace']
      },
      borderRadius: {
        none: '0px'
      }
    },
  },
  plugins: [],
}
