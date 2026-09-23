import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { plugin as shadcn } from '@shadcn/lint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: { shadcn },
    // No `settings.shadcn` on purpose: naming a component directory switches on
    // no-restyle, which would report the 92 places that style <NumInput> through
    // className — and className is how every screen styles it. It wakes up the day
    // a shared primitives folder exists whose components own their look.
    rules: {
      // ── @shadcn/lint design-system rules ──────────────────────────────────
      // Levels come from measuring each rule over src/ (see
      // .lavish/lint-what-it-found.html). The three carrying real work start as
      // WARNINGS so `npm run lint` stays green while they are worked through;
      // raise them to 'error' when each list is empty.

      // 245 findings: stock Tailwind palette (slate/emerald/rose) where the
      // ink/gold/danger palette belongs.
      'shadcn/no-raw-colors': 'warn',

      // 81 findings once the dense type scale is allowed: hard-coded hexes
      // (#2E7D78 teal, #0EA5E9, #EADFC9, #B89251 …) and a few px spacings.
      'shadcn/no-arbitrary-values': ['warn', { allow: ['layout', 'typography'] }],

      // 5 findings, every one a genuinely dynamic value, allowed by property:
      // a live progress width, a chart slice colour, a typing-dot stagger.
      'shadcn/no-inline-styles': ['error', { allow: ['width', 'backgroundColor', 'animationDelay'] }],

      // The v3 Tailwind loader cannot see plugin classes, so daisyUI and
      // tailwindcss-animate names are allowed explicitly. ONE warning survives by
      // design: daisyUI's bare `select` (RoomDetailsForm.tsx) — the allow matcher
      // covers `select-*` but not the bare name, whatever pattern is used.
      'shadcn/no-unknown-classes': ['warn', {
        allow: [
          'btn', 'btn-*', 'input', 'input-*', 'select', 'select-*', 'badge', 'badge-*',
          'animate-in', 'animate-out', 'fade-in', 'fade-out', 'zoom-in-*', 'zoom-out-*',
          'slide-in-from-*', 'slide-out-to-*', 'animate-fade-in',
          'no-scrollbar', 'print-slip', 'safe-bottom',
        ],
      }],

      // Silent until a component directory is named (see the note above).
      'shadcn/no-restyle': 'error',
      'shadcn/require-static-classes': 'error',
    },
  },
])
