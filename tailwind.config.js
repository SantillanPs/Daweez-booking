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
          500: "#b89251",
          400: "#d9af62",
          300: "#e6c280",
          200: "#e8c68a",
          100: "#f7e6c4",
        },
        brand: {
          primary: "#b89251",
          text: "#9a783e",
          border: "#e5d5c0",
          bg: "#fdfbf7",
          ring: "#e6c280",
        },
        border: "rgba(229, 213, 192, 0.4)",
        input: "rgba(229, 213, 192, 0.4)",
        ring: "#b89251",
        background: "#fdfbf7",
        foreground: "#0f172a",
        card: "#ffffff",
        page: "#fdfbf7",
        softbg: "#f8fafc",
        soft: "rgba(229, 213, 192, 0.65)",
        main: "#0f172a",
        muted: "#64748b",
        popover: "#ffffff",
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
