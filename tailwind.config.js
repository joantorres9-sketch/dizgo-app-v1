/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        dizgo: {
          bg:       '#0A0D14',
          surface:  '#111520',
          surface2: '#161C2E',
          border:   'rgba(255,255,255,0.07)',
          accent:   '#F5A623',
          blue:     '#3D8EF0',
          green:    '#2DD4A0',
          red:      '#F05C5C',
          purple:   '#9B6BFF',
          text:     '#E8EDF5',
          text2:    '#8B96A8',
          text3:    '#5A6478',
        },
      },
      fontFamily: {
        sans: ['var(--font-space-grotesk)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'monospace'],
      },
    },
  },
  plugins: [],
}
