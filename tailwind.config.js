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
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Montserrat", "sans-serif"],
      },
      borderRadius: {
        xl: "16px",
        lg: "12px",
        md: "10px",
        sm: "8px",
      },
      boxShadow: {
        soft: "0 4px 24px rgba(15,23,42,0.06)",
        softLg: "0 8px 32px rgba(15,23,42,0.08)",
      }
    },
  },
  plugins: [require("tailwindcss-animate")],
}
