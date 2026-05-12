/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Stormyran brand greens
        brand: {
          DEFAULT: '#1B5E3F',  // djup skogsgrön — för rubriker och accenter
          light: '#61946e',    // ljusare sage — för hover/sekundära element
          50: '#f0fdf4',
          100: '#dcfce7',
        },
      },
    },
  },
  plugins: [],
}
