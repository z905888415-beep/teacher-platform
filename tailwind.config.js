/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F5F6FA',
        surface: { DEFAULT: '#FFFFFF', muted: '#F0F2F7' },
        ink: { 900: '#111827', 700: '#596174', 500: '#8B93A5' },
        line: { DEFAULT: '#E4E7EE', strong: '#B7BFD0' },
        brand: { 50: '#EDF2FF', 600: '#002FA7', 700: '#001F73' },
        danger: { 50: '#FDECEA', 600: '#B42318' },
        success: '#177245',
        warning: '#946200',
      },
      borderRadius: {
        ui: '14px',
        menu: '12px',
        group: '18px',
        card: '22px',
        panel: '24px',
        overview: '26px',
      },
      fontFamily: {
        sans: ['Helvetica Neue', 'Arial', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 12px 36px -30px rgba(17, 24, 39, .45)',
        drag: '0 18px 40px -22px rgba(17, 24, 39, .55)',
      },
    },
  },
  plugins: [],
}
