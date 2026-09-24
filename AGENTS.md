# DOX framework

- DOX is highly performant AGENTS.md hierarchy installed here
- Agent must follow DOX instructions across any edits

## Core Contract

- AGENTS.md files are binding work contracts for their subtrees
- Work products, source materials, instructions, records, assets, and durable docs must stay understandable from the nearest applicable AGENTS.md plus every parent AGENTS.md above it

## Read Before Editing

1. Read the root AGENTS.md
2. Identify every file or folder you expect to touch
3. Walk from the repository root to each target path
4. Read every AGENTS.md found along each route
5. If a parent AGENTS.md lists a child AGENTS.md whose scope contains the path, read that child and continue from there
6. Use the nearest AGENTS.md as the local contract and parent docs for repo-wide rules
7. If docs conflict, the closer doc controls local work details, but no child doc may weaken DOX

Do not rely on memory. Re-read the applicable DOX chain in the current session before editing.

## Update After Editing

Every meaningful change requires a DOX pass before the task is done.

Update the closest owning AGENTS.md when a change affects:

- purpose, scope, ownership, or responsibilities
- durable structure, contracts, workflows, or operating rules
- required inputs, outputs, permissions, constraints, side effects, or artifacts
- user preferences about behavior, communication, process, organization, or quality
- AGENTS.md creation, deletion, move, rename, or index contents

Update parent docs when parent-level structure, ownership, workflow, or child index changes. Update child docs when parent changes alter local rules. Remove stale or contradictory text immediately. Small edits that do not change behavior or contracts may leave docs unchanged, but the DOX pass still must happen.

## Hierarchy

- Root AGENTS.md is the DOX rail: project-wide instructions, global preferences, durable workflow rules, and the top-level Child DOX Index
- Child AGENTS.md files own domain-specific instructions and their own Child DOX Index
- Each parent explains what its direct children cover and what stays owned by the parent
- The closer a doc is to the work, the more specific and practical it must be

## Child Doc Shape

- Create a child AGENTS.md when a folder becomes a durable boundary with its own purpose, rules, responsibilities, workflow, materials, or quality standards
- Work Guidance must reflect the current standards of the project or user instructions; if there are no specific standards or instructions yet, leave it empty
- Verification must reflect an existing check; if no verification framework exists yet, leave it empty and update it when one exists

Default section order:
- Purpose
- Ownership
- Local Contracts
- Work Guidance
- Verification
- Child DOX Index

## Style

- Keep docs concise, current, and operational
- Document stable contracts, not diary entries
- Put broad rules in parent docs and concrete details in child docs
- Prefer direct bullets with explicit names
- Do not duplicate rules across many files unless each scope needs a local version
- Delete stale notes instead of explaining history
- Trim obvious statements, repeated rules, misplaced detail, and warnings for risks that no longer exist

## Closeout

1. Re-check changed paths against the DOX chain
2. Update nearest owning docs and any affected parents or children
3. Refresh every affected Child DOX Index
4. Remove stale or contradictory text
5. Run existing verification when relevant
6. Report any docs intentionally left unchanged and why

## Lint & Verification

- `npm run lint` = `eslint .` over the repo, configured in `eslint.config.js`: `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, plus **`@shadcn/lint`** (the Tailwind design-system linter). It must exit **0**.
- **The `shadcn/*` levels are deliberate and measured** (every rule was run over `src/`; the numbers are in `.lavish/lint-what-it-found.html`): `no-raw-colors`, `no-arbitrary-values` (with `allow: ['layout','typography']` for the dense type scale) and `no-unknown-classes` (with daisyUI + tailwindcss-animate names allowed, because the Tailwind **v3** loader cannot see plugin classes) are **warnings** while their findings are worked through; `no-inline-styles` is an error, with width/background-color/animation-delay allowed as genuinely dynamic values. **`no-restyle` and `require-static-classes` are errors but silent until `settings.shadcn` names a component directory** — naming one today reports the ~92 places that style `NumInput` through `className`, which is how every screen styles it. Never raise a warning to `error` or add `settings.shadcn` without the owner's say-so.
- Type-check every change with `npx tsc -b --force` (must exit 0). Per-area checks are in `src/AGENTS.md`.

## User Preferences

### Working Agreement — show it first, always
- **NEVER IMPLEMENT IMMEDIATELY. SHOW HIM FIRST, ALWAYS.** His words, in capitals, after I built a Settings redesign he had only approved in outline: even when a change looks obvious, agreed or already ruled on, the build starts **only after he has seen the drawing and said yes to it**. No exceptions for small changes.
- **Never implement from a note, a list or an inference.** Every change starts as a discussion: the owner's words *"Make sure we discuss things first before doing any implementations so that we're always on the same page."*
- The order is fixed: **I bring a drawing (Lavish) and the open questions → he rules on one item at a time → only then do I build.** A drawing is discussion, not a green light; approval is a ruling, in his words.
- **When several drawings miss in a row, stop drawing variations and ask him what he pictures**, in plain words, with a box to write it in — then draw the thing he described. That is how the room-price pop-up was found after six misses.
- **One item at a time.** Do not batch several of his open questions into one build, and do not start the next one until the previous is built and handed to Review.
- When an answer is ambiguous or two of his notes disagree, **ask, and show the two consequences side by side** — never pick silently.

### File Size & Modularity
- **Maximum file size: 300 lines per file.** Any file exceeding 300 lines must be split into smaller modules.
- Enforced as a hard rule: no new file may exceed this limit, and existing files above it are flagged for refactoring.
- Splitting strategy: separate concerns into their own files (e.g., extract a hook, a subcomponent, or a utility function).
- Apply this rule to every project, not just this one.
- **Why it also matters for tooling**: the agent's `read` tool returns at most ~50 KiB (~51,200 characters, roughly 1000 lines of typical TSX) per call, even when a larger `limit` is requested. Files above that are silently truncated (always compare `lines.length` against `totalLines`). Keeping files under 300 lines guarantees they are always fully readable in one call and safe to edit with targeted edits rather than full rewrites.

### Kanban Board
- The agent may move a card to **In Progress** and to **Review**.
- The agent may **never** move a card to **Done** — the user decides what is finished and closes cards themselves. Never delete or create cards unless explicitly asked.
- Move finished work to **Review** and hand it back for verification.

### Communication & Language Style
- **Always Use Simple Language**: Avoid overly complex, academic, or technical jargon in both explanations (responses) and user interface design (labels, tabs, links, and route names).
- **Clear & Direct Vocabulary**: Prefer plain terms (e.g., "Guests & Partners") over technical terms (e.g., "Directory" or "Registry").
- **Financial & Spreadsheet Terms**: Never use standard accounting jargon (e.g., "Apportioned Sales", "Gross Revenue", "Net Profit", "Financial Breakdown Statement"). Always use highly simplified, everyday English (e.g., "Earnings Report", "Room Rate", "Total Money In", "Total Money Out", "Your Profit").
- **Profit Visibility**: Ensure bottom-line profit displays trigger a "reward feeling" or "dopamine hit" (e.g., using clear visibility, bold typography, and rewarding colors like vibrant green) rather than flat theme colors.
- **Explain Visually, Never in Walls of Text**: The owner does not read long blocks of text. Lead with a picture — a diagram, a before/after with real numbers, or short labelled cards — and keep prose to one short line per idea. Rewrite any paragraph that explains a mechanism as either a diagram or a worked example with actual figures.
- **Lavish Is the Default for Discussion and Review**: Anything beyond a short answer goes into a Lavish HTML artifact, not the chat. That includes reporting status, saying what still needs doing and why it matters, proposing an order of work, reviewing what was built, and laying out options. Write the page to `.lavish/` in the Daweez charcoal-gold design system, open it with `npx -y lavish-axi <file>`, and let the chat carry only the short answer, the link, and the one decision being asked for. Load the `lavish` skill for the current CLI workflow. **Under the DSH sandbox both `npm_config_cache` and `LAVISH_AXI_STATE_DIR` must be pointed inside this repo** (`.npm-cache`, `.lavish-state`) or npm and the CLI cannot write their state and the command dies with EPERM.
- **Lavish Pages Are Always DARK MODE**: every artifact is authored dark, never on the light ivory workspace — the owner's eyes hurt reading a light page. Dark tokens: page `#141414`, card `#1F1F1F`, raised surface `#262626`, hairline border `#3A3A3A`, body text `#EDEAE4`, secondary `#A8A29A`, muted `#7D7871`; the brand gold `#D0AB60` is the accent and — unlike on the app's light surfaces — **gold text and icons are allowed here** (7.9:1 on charcoal). Tinted badges are dark fills with light text: gold `#332B18` / `#E6C989`, good `#12261F` / `#34D399`, danger `#2A1615` / `#F87171`, neutral `#2A2A2A` / `#C9C4BB`. Gold FILLS still take a charcoal label (`#141414`), never light text. A slip or paper mock stays light so it still reads as paper, but dimmed to off-white (`#E6E2DA`), never pure white. This rule is about the review pages only — the staff app shell itself stays light.

## Child DOX Index

- [src/AGENTS.md](file:///c:/Users/dev4s/Documents/Programming/Daweez/src/AGENTS.md): Core frontend React application logic, component styling, pricing engine, and hook-based state contracts.
- [supabase/AGENTS.md](file:///c:/Users/dev4s/Documents/Programming/Daweez/supabase/AGENTS.md): Backend database migrations, database schema types, Row-Level Security policies, and Deno serverless edge functions.