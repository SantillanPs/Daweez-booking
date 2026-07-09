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
          primary: "var(--brand-primary)",
          text: "var(--brand-text)",
          border: "var(--brand-border)",
          bg: "var(--brand-bg)",
          ring: "var(--brand-ring)",
        },
        border: "var(--border-soft)",
        input: "var(--border-soft)",
        ring: "var(--brand-ring)",
        background: "var(--body-bg)",
        foreground: "var(--text-main)",
        card: "var(--bg-card)",
        page: "var(--bg-page)",
        softbg: "var(--bg-softbg)",
        soft: "var(--border-soft)",
        main: "var(--text-main)",
        muted: "var(--text-muted)",
        popover: "var(--bg-card)",
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
