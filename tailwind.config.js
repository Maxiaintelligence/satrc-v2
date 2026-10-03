/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        caritas: {
          blue: '#0B3C5D',
          red: '#B82601',
          gold: '#D9AB55',
          dark: '#1D2731'
        }
      }
    },
  },
  plugins: [],
}