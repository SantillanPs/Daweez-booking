# Frontend (React + Vite Client) AGENTS.md

## Purpose

This directory contains the React + TypeScript frontend codebase for the Daweez Pension House property management system (PMS) staff dashboard. The guest booking portal has been removed.

## Ownership

- Primary Owner: Frontend Engineers / Antigravity Agent
- Scope: Handles UI rendering, user interaction flows, client-side state/caching, local storage fallback database, and API interactions with Supabase.

## Local Contracts

- **State Management & Routing**: Uses React state coupled with `@tanstack/react-query` to handle fetching, caching, and mutating, `@tanstack/react-router` for view-tab routing and layout hierarchies, and `@tanstack/react-table` for sortable, searchable data grids. Booking data is synchronized instantly over a WebSocket using a Supabase Realtime subscription via `useRealtimeBookings.ts` to replace high-frequency polling.
- **Core Components & Router Tree**:
  - [router.tsx](file:///c:/Users/dev4s/Documents/Programming/plum-hotel-booking/src/router.tsx) - Sets up routes (`/login`, `/`, `/calendar`, `/bookings`, `/guests`, `/settings`) and runs auth redirects.
  - [DashboardLayout](file:///c:/Users/dev4s/Documents/Programming/plum-hotel-booking/src/components/DashboardLayout.tsx) - Responsive PMS layout shell (header, inline statistics bar, desktop/mobile bottom tabs, context provider).
  - [CalendarTab](file:///c:/Users/dev4s/Documents/Programming/plum-hotel-booking/src/components/CalendarTab.tsx) - Orchestrates the scheduling timeline grid layout, delegating rendering to modular subcomponents in `src/components/calendar/` (`TimelineGrid`, `ExtendStayModal`).
  - [BookingsTab](file:///c:/Users/dev4s/Documents/Programming/plum-hotel-booking/src/components/BookingsTab.tsx) - Headless table view for pending/confirmed reservations with sortable columns.
  - [GuestsTab](file:///c:/Users/dev4s/Documents/Programming/plum-hotel-booking/src/components/GuestsTab.tsx) - Headless table view for guest list records, loyalty visits, and search text-filtering.
  - [SettingsTab](file:///c:/Users/dev4s/Documents/Programming/plum-hotel-booking/src/components/SettingsTab.tsx) - Settings panel for OTA iCal URLs export & import feeds.
  - [WalkInBookingForm](file:///c:/Users/dev4s/Documents/Programming/plum-hotel-booking/src/components/WalkInBookingForm.tsx) - Orchestrates the progressive walk‑in booking wizard, allowing concurrent booking of multiple rooms and event venues in a single transaction with automatic rollback error-handling, and delegating step fields and receipt estimation to modular subcomponents in `src/components/walk-in/` (`GuestDetailsForm`, `RoomDetailsForm`, `AmenitiesForm`, `BillingSummary`).
  - [LoginPortal](file:///c:/Users/dev4s/Documents/Programming/plum-hotel-booking/src/components/LoginPortal.tsx) - Staff passcode validation gate component ensuring only authorized users can access the dashboard.
  - [MainLayout](file:///c:/Users/dev4s/Documents/Programming/plum-hotel-booking/src/components/MainLayout.tsx) - Minimal wrapper providing the base page structure (no decorative elements).
- **Data Operations**:
  - [syncEngine.ts](file:///c:/Users/dev4s/Documents/Programming/plum-hotel-booking/src/utils/syncEngine.ts) implements client-side calculations, pricing policy rules (10% loyalty discount, 50% reservation deposit, flat ₱500 security deposit), collision detection logic (`isRoomAvailable`, `isVenueRangeAvailable`), and local storage fallback synchronization when Supabase is unconfigured.
  - [useBookings.ts](file:///c:/Users/dev4s/Documents/Programming/plum-hotel-booking/src/hooks/useBookings.ts) custom React hook orchestrating all React Query operations.
  - [useRealtimeBookings.ts](file:///c:/Users/dev4s/Documents/Programming/plum-hotel-booking/src/hooks/useRealtimeBookings.ts) hook that listens to PostgreSQL replication changes over WebSockets and updates the React Query bookings cache in real-time.

## Work Guidance

- **Styling Rules**: Use Tailwind CSS variables. Keep the curated color palette consistent (gold/champagne `#B89251`/`#9A783E`, slate, accent bg `#FDFBF7`, accent border `#E5D5C0`). Avoid using raw inline styles. Use `rounded-lg` (4px per tailwind config) for most elements. Minimal shadows — only on modals.
- **Responsive Design**: Mobile-first layout. Bottom tab nav on mobile (`md:hidden`), top tabs on desktop (`hidden md:block`). Stats bar uses horizontal scroll with `no-scrollbar` utility. Tables use `overflow-x-auto` for horizontal scrolling on small screens. Calendar cells use responsive min-heights (`min-h-[80px] sm:min-h-[100px]`).
- **Double Booking Prevention**: Any transaction or booking action must run collision checks through `isRoomAvailable` or `isVenueRangeAvailable`. Check-in dates must be chronologically earlier than check-out dates.
- **Offline / Local Fallback**: Code must check `isSupabaseConfigured` and seamlessly fallback to local storage DB endpoints (`l_etoile_bookings_db`, `l_etoile_feeds_db`) to guarantee runtime persistence without a live database.
- **Background Calendar Sync**: Third-party bookings (Airbnb/Booking.com) must sync automatically via iCal feeds in the background upon mounting the application and at regular intervals (60 seconds) thereafter, with a manual OTA Sync trigger as a backup.
- **Staff Passcode Authentication Gate**: The staff portal is protected by a client-side passcode authentication gate. Authorized passcodes include 'daweez2026' (case-insensitive), '8888', and any custom passcode defined in VITE_STAFF_PASSCODE. Successful authentication persists in localStorage as `daweez_pms_auth` until explicit logout.
- **Performance Guardrails for Grids & Complex Views**:
  - **State Isolation**: High-frequency states (e.g. mouse hover coordinates, hovered dates, range calculations) must live at the lowest leaf component level possible. Avoid placing hover states in orchestrators or context providers to prevent wide component trees from re-rendering.
  - **Memoized Cell Wrappers**: Wrap individual grid cells or list items in a memoized component wrapper (`React.memo`) using strict custom equality comparators to bypass rendering. Ensure callbacks are stable or checked appropriately, converting $O(N)$ re-renders to $O(1)$ changes.
  - **Numeric Timestamp Operations**: Avoid using string parsing operations (like `.toDateString()` or `.toISOString()`) inside rendering loops. Convert dates to numeric timestamps via `.getTime()` for cheap integer comparisons.
  - **Keystroke Rendering Isolation**: Keep text field keystroke states isolated so typing in registry forms does not trigger re-calculations or re-renders of adjacent sidebar receipts and summaries.
  - **Avoid Backdrop Filter Penalty**: Do not apply `backdrop-filter: blur(...)` styling to modals or overlay backdrops rendered on top of dense grids or tables. This triggers heavy GPU composition paint operations on every keypress or state change. Use solid or semi-transparent flat colors instead (e.g. `bg-slate-900/50`).
  - **Debounced Hover Tooltips**: Details tooltips on dense timeline grids must be debounced with a short delay (e.g., `500ms`) using a `useRef` timeout to prevent rendering spam when moving the mouse across cells. Stale timeouts must be cleared on mouse leave and on component unmount.
  - **Floating UI Alerts over Inline Banners**: Transient states (such as active scheduler selection status) must be presented in absolute/fixed floating elements (toasts) rather than inline blocks to avoid grid layout shifts, vertical screen clutter, and component displacement.

## Verification

- **Code Validation**: Verify TypeScript build compatibility using `npm run build` or checking Vite compile output.
- **Responsive Views**: Check that all UI elements adapt correctly on mobile, tablet, and desktop viewports.

## Child DOX Index

No child DOX documents reside under `src/`.
