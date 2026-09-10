/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ── Daweez brand: charcoal + gold ────────────────────────────────
        // Sampled from the logo: charcoal #1C1C1C (pure neutral), gold
        // #D0AB60 (one flat gold). Teal is retired entirely.
        ink: {
          50: "#FAFAFA",
          100: "#F0F0F0",
          200: "#E5E5E5",
          300: "#D4D4D4",
          400: "#B5B5B5",
          500: "#8A8A8A",
          600: "#3D3D3D",
          700: "#2E2E2E",
          800: "#242424",
          900: "#1C1C1C",
          950: "#141414"
        },
        gold: {
          100: "#F5EAD1",
          200: "#E3C68C",
          300: "#EAD4A4",
          400: "#D0AB60", // BRAND — the logo gold
          500: "#C1994A",
          600: "#A9812F",
          700: "#8A6A2F",
          800: "#6F5420", // deep gold — safe as TEXT on light surfaces
          900: "#4E3A16"
        },
        paper: {
          0: "#FFFFFF",
          50: "#F8F5EF",
          100: "#F1ECE1",
          200: "#E6DFD0",
          300: "#D9D0BC",
          400: "#C4B9A0",
          500: "#A99C82"
        },
        // Dark brand chrome (header / sidebar / login / public portal)
        chrome: {
          bg: "#1C1C1C",
          raised: "#242424",
          border: "#2E2E2E",
          text: "#F5F2EC",
          muted: "#9A9A9A",
          accent: "#D0AB60"
        },
        // Semantic "needs attention" ramp. Named `danger` (not `error`) so it
        // cannot collide with daisyUI's own theme `error` colour.
        danger: {
          50: "#FBEDEA",
          100: "#F7DCD6",
          200: "#EFBEB4",
          300: "#E59C8D",
          400: "#D46A56",
          500: "#BE3A2B",
          600: "#A32F22"
        },
        // ── Semantic tokens (driven by src/index.css) ────────────────────
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
        soft: "0 4px 24px rgba(28,28,28,0.07)",
        softLg: "0 8px 32px rgba(28,28,28,0.10)",
        sheet: "-8px 0 32px rgba(28,28,28,0.12)"
      }
    }
  },
  plugins: [require("tailwindcss-animate"), require("daisyui")],
  daisyui: {
    themes: [
      {
        daweez: {
          // Gold fill + CHARCOAL label: white on #D0AB60 is only 2.2:1 and
          // would be unreadable. Charcoal on gold is 7.9:1.
          primary: "#D0AB60",
          "primary-content": "#1C1C1C",
          secondary: "#1C1C1C",
          "secondary-content": "#F5F2EC",
          accent: "#A9812F",
          "accent-content": "#FFFFFF",
          neutral: "#2E2E2E",
          "neutral-content": "#F5F2EC",
          "base-100": "#FFFFFF",
          "base-200": "#F8F5EF",
          "base-300": "#E6DFD0",
          "base-content": "#1F1F1F",
          info: "#57606A",
          "info-content": "#FFFFFF",
          success: "#059669",
          "success-content": "#FFFFFF",
          warning: "#B45309",
          "warning-content": "#FFFFFF",
          error: "#BE3A2B",
          "error-content": "#FFFFFF",
          "--rounded-box": "1rem",
          "--rounded-btn": "0.75rem",
          "--rounded-badge": "0.5rem",
          "--rounded-field": "0.75rem"
        }
      }
    ]
  }
}