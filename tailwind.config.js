/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Sun & Sea palette: sand paper, sea-teal actions, sun gold accents,
        // coral for "needs attention".
        sea: {
          50: "#F0F7F6",
          100: "#DDEFEC",
          200: "#BFE2DE",
          300: "#8FCAC4",
          400: "#57A49C",
          500: "#3B8A82",
          600: "#2E7D78",
          700: "#25635F",
          800: "#1D4F4C",
          900: "#163B39"
        },
        sand: {
          50: "#FDFBF6",
          100: "#FAF6EE",
          200: "#F2ECDD",
          300: "#E6DCC4",
          400: "#D5C59E",
          500: "#C2AC7C"
        },
        sun: {
          100: "#FBF3E0",
          200: "#F6E3B8",
          300: "#EED08F",
          400: "#DEAE55",
          500: "#C9922F",
          600: "#A97720"
        },
        coral: {
          50: "#FDF0EC",
          100: "#FBE3DA",
          200: "#F5C4B4",
          300: "#EE9E88",
          400: "#E47F68",
          500: "#D9604A",
          600: "#BC4A36"
        },
        plum: {
          950: "#0c040b",
          900: "#120710",
          800: "#190916",
          700: "#281124",
          600: "#3e1c39",
          500: "#5e3b58",
          400: "#c9a7c3"
        },
        champagne: {
          500: "#b89251",
          400: "#d9af62",
          300: "#e6c280",
          200: "#e8c68a",
          100: "#f7e6c4"
        },
        brand: {
          primary: "var(--brand-primary)",
          text: "var(--brand-text)",
          border: "var(--brand-border)",
          bg: "var(--brand-bg)",
          ring: "var(--brand-ring)"
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
        popover: "var(--bg-card)"
      },
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
        display: ["Sora", "system-ui", "sans-serif"]
      },
      borderRadius: {
        xl: "16px",
        lg: "12px",
        md: "10px",
        sm: "8px"
      },
      boxShadow: {
        soft: "0 4px 24px rgba(42,55,51,0.07)",
        softLg: "0 8px 32px rgba(42,55,51,0.10)",
        sheet: "-8px 0 32px rgba(42,55,51,0.12)"
      }
    }
  },
  plugins: [require("tailwindcss-animate"), require("daisyui")],
  daisyui: {
    themes: [
      {
        sunsea: {
          primary: "#2E7D78",
          "primary-content": "#ffffff",
          secondary: "#C9922F",
          "secondary-content": "#ffffff",
          accent: "#DEAE55",
          "accent-content": "#ffffff",
          neutral: "#3D3A33",
          "neutral-content": "#ffffff",
          "base-100": "#ffffff",
          "base-200": "#FAF6EE",
          "base-300": "#F2ECDD",
          "base-content": "#2E2A24",
          info: "#3B8A82",
          "info-content": "#ffffff",
          success: "#059669",
          "success-content": "#ffffff",
          warning: "#DEAE55",
          "warning-content": "#ffffff",
          error: "#D9604A",
          "error-content": "#ffffff",
          "--rounded-box": "1rem",
          "--rounded-btn": "0.75rem",
          "--rounded-badge": "0.5rem",
          "--rounded-field": "0.75rem"
        }
      }
    ]
  }
}
