/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        plum: {
          950: "#0c040b",
          900: "#120710",
          800: "#190916",
          700: "#281124",
          600: "#3e1c39",
          500: "#5e3b58",
          400: "#c9a7c3",
        },
        champagne: {
          500: "#b89251", // Dark Gold
          400: "#d9af62", // Medium Gold
          300: "#e6c280", // Premium Accent
          200: "#e8c68a", // Soft Gold Accent
          100: "#f7e6c4", // Ultra Soft
        },
        border: "rgba(232, 198, 138, 0.15)",
        input: "rgba(232, 198, 138, 0.2)",
        ring: "#e6c280",
        background: "#0c040b",
        foreground: "#fcf9f5",
        card: "rgba(40, 17, 36, 0.35)",
        popover: "#120710",
      },
      fontFamily: {
        sans: ["Montserrat", "sans-serif"],
      },
      borderRadius: {
        lg: "4px", /* Sharp geometric boutique borders */
        md: "4px",
        sm: "2px",
      }
    },
  },
  plugins: [require("tailwindcss-animate")],
}
