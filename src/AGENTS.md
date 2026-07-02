# Frontend (React + Vite Client) AGENTS.md

## Purpose

This directory contains the React + TypeScript frontend codebase for the Daweez Pension House property management system (PMS) staff dashboard. The guest booking portal has been removed.

## Ownership

- Primary Owner: Frontend Engineers / Antigravity Agent
- Scope: Handles UI rendering, user interaction flows, client-side state/caching, local storage fallback database, and API interactions with Supabase.

## Local Contracts

- **State Management**: Uses React state coupled with `@tanstack/react-query` to handle fetching, caching, and mutating application state (rooms, venues, bookings, feeds).
- **Core Components**:
  - [AdminPortal](file:///c:/Users/dev4s/Documents/Programming/plum-hotel-booking/src/components/AdminPortal.tsx) - Minimalist responsive staff dashboard. Four tabs: Calendar (month grid + timeline views with day-level drill-down preview and collapsible room filter), Bookings (pending/confirmed reservation tables), Guests (loyalty visit history), Settings (iCal feed management). Mobile bottom nav + desktop top tabs. Compact inline stats bar (occupancy, arrivals, departures, guests, revenue).
  - [LoginPortal](file:///c:/Users/dev4s/Documents/Programming/plum-hotel-booking/src/components/LoginPortal.tsx) - Staff passcode validation gate component ensuring only authorized users can access the dashboard.
  - [MainLayout](file:///c:/Users/dev4s/Documents/Programming/plum-hotel-booking/src/components/MainLayout.tsx) - Minimal wrapper providing the base page structure (no decorative elements).
- **Data Operations**:
  - [syncEngine.ts](file:///c:/Users/dev4s/Documents/Programming/plum-hotel-booking/src/utils/syncEngine.ts) implements client-side calculations, pricing policy rules (10% loyalty discount, 50% reservation deposit, flat ₱500 security deposit), collision detection logic (`isRoomAvailable`, `isVenueAvailable`), and local storage fallback synchronization when Supabase is unconfigured.
  - [useBookings.ts](file:///c:/Users/dev4s/Documents/Programming/plum-hotel-booking/src/hooks/useBookings.ts) custom React hook orchestrating all React Query operations.

## Work Guidance

- **Styling Rules**: Use Tailwind CSS variables. Keep the curated color palette consistent (gold/champagne `#B89251`/`#9A783E`, slate, accent bg `#FDFBF7`, accent border `#E5D5C0`). Avoid using raw inline styles. Use `rounded-lg` (4px per tailwind config) for most elements. Minimal shadows — only on modals.
- **Responsive Design**: Mobile-first layout. Bottom tab nav on mobile (`md:hidden`), top tabs on desktop (`hidden md:block`). Stats bar uses horizontal scroll with `no-scrollbar` utility. Tables use `overflow-x-auto` for horizontal scrolling on small screens. Calendar cells use responsive min-heights (`min-h-[80px] sm:min-h-[100px]`).
- **Double Booking Prevention**: Any transaction or booking action must run collision checks through `isRoomAvailable` or `isVenueAvailable`. Check-in dates must be chronologically earlier than check-out dates.
- **Offline / Local Fallback**: Code must check `isSupabaseConfigured` and seamlessly fallback to local storage DB endpoints (`l_etoile_bookings_db`, `l_etoile_feeds_db`) to guarantee runtime persistence without a live database.
- **Background Calendar Sync**: Third-party bookings (Airbnb/Booking.com) must sync automatically via iCal feeds in the background upon mounting the application and at regular intervals (60 seconds) thereafter, with a manual OTA Sync trigger as a backup.
- **Staff Passcode Authentication Gate**: The staff portal is protected by a client-side passcode authentication gate. Authorized passcodes include 'daweez2026' (case-insensitive), '8888', and any custom passcode defined in VITE_STAFF_PASSCODE. Successful authentication persists in localStorage as `daweez_pms_auth` until explicit logout.

## Verification

- **Code Validation**: Verify TypeScript build compatibility using `npm run build` or checking Vite compile output.
- **Responsive Views**: Check that all UI elements adapt correctly on mobile, tablet, and desktop viewports.

## Child DOX Index

No child DOX documents reside under `src/`.
