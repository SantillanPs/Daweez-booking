import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
  lazyRouteComponent
} from '@tanstack/react-router'
import { MainLayout } from './components/MainLayout'
import { LoginRoute } from './components/LoginPortal'
import { DashboardLayout } from './components/DashboardLayout'
import { SettingsUnavailable } from './components/SettingsUnavailable'
import { NotFound } from './components/NotFound'
import { hydrateRateConfig } from './utils/rateConfig'
import { hydratePaymentAccounts } from './utils/paymentAccounts'
import { hydrateChannelSync } from './utils/channelSync'

/**
 * The shared rates and where-guests-pay are read once per page load, before any
 * route renders.
 *
 * Everything that prices a stay or prints an account number reads them
 * synchronously, so they must be in memory first — a screen that quietly used
 * the factory defaults is the exact failure this replaced (2026-09-28). If the
 * database cannot be reached the app stops with a plain message instead of
 * showing figures nobody verified.
 */
let settingsReady: Promise<void> | null = null
function loadSettings(): Promise<void> {
  if (!settingsReady) {
    settingsReady = Promise.all([hydrateRateConfig(), hydratePaymentAccounts(), hydrateChannelSync()]).then(() => undefined)
  }
  return settingsReady
}

// 1. Create a Root Route
const rootRoute = createRootRoute({
  beforeLoad: () => loadSettings(),
  errorComponent: ({ error }) => <SettingsUnavailable error={error as Error} />,
  // A URL the app does not know must say so in the app's own words. Without this, TanStack Router prints a bare
  // `<p>Not Found</p>` and logs a warning that no `notFoundComponent` is configured — which is what the owner
  // saw in the console after `/daily-report` was removed (2026-09-30). The route went, but his browser was still
  // sitting on it, so the app owed him a page rather than a stray word.
  notFoundComponent: () => <NotFound />,
  component: () => (
    <MainLayout>
      <Outlet />
    </MainLayout>
  )
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginRoute
})

const reserveRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reserve',
  component: lazyRouteComponent(() => import('./components/PublicReservePortal'), 'PublicReservePortal')
})

// 3. Create Dashboard Layout Route with Auth Guard
const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'dashboard',
  beforeLoad: () => {
    const isAuthed = localStorage.getItem('daweez_pms_auth') === 'true'
    if (!isAuthed) {
      throw redirect({
        to: '/login'
      })
    }
  },
  component: DashboardLayout
})

// 4. Create Dashboard Sub-routes
const dashboardIndexRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/calendar' })
  }
})

const calendarRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/calendar',
  component: lazyRouteComponent(() => import('./components/CalendarTab'), 'CalendarTab')
})

const guestsRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/guests',
  component: lazyRouteComponent(() => import('./components/DirectoryTab'), 'DirectoryTab')
})

/**
 * **`/daily-report` is a redirect, not a screen** (the owner's ruling, 2026-09-30: the Daily Report is
 * *"a 'print a daily report' type of feature. not a page"*).
 *
 * It was a tab here for a day. Rather than let the address die — his own browser was still sitting on it, and a
 * bookmark or a back-button would land on "not found" — the old URL forwards to Analytics, where the **Print
 * daily report** button now lives. A moved page keeps its address working.
 */
const dailyReportRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/daily-report',
  beforeLoad: () => {
    throw redirect({ to: '/analytics' })
  }
})

const settingsRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/settings',
  component: lazyRouteComponent(() => import('./components/SettingsTab'), 'SettingsTab')
})

const analyticsRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/analytics',
  component: lazyRouteComponent(() => import('./components/AnalyticsTab'), 'AnalyticsTab')
})

const expensesRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/expenses',
  component: lazyRouteComponent(() => import('./components/ExpensesTab'), 'ExpensesTab')
})

const bookingsRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/bookings',
  component: lazyRouteComponent(() => import('./components/BookingsListTab'), 'BookingsListTab')
})

/**
 * **One route, three addresses:** `/housekeeping` is the stock room, `/housekeeping/dishes` is "What a dish
 * uses", `/housekeeping/cleaning` is the cleaning checklist.
 *
 * These are the Stock tab's sub-tabs (the owner's ruling, 2026-10-04). They used to be buttons inside the
 * screen with no address of their own. The optional `view` keeps them ONE route on purpose — the screen stays
 * mounted, so going between them does not read the stock room from the database again.
 */
const housekeepingRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/housekeeping/{-$view}',
  component: lazyRouteComponent(() => import('./components/HousekeepingTab'), 'HousekeepingTab')
})

const restaurantRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/restaurant',
  component: lazyRouteComponent(() => import('./components/RestaurantTab'), 'RestaurantTab')
})

// The kitchen's own screen: the Restaurant tab's second sub-tab. Orders reach the cook
// here instead of on a printed slip (Sebastian, 2026-10-04).
const kitchenRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/restaurant/kitchen',
  component: lazyRouteComponent(() => import('./components/KitchenTab'), 'KitchenTab')
})

// 5. Construct Route Tree
const routeTree = rootRoute.addChildren([
  loginRoute,
  reserveRoute,
  dashboardRoute.addChildren([
    dashboardIndexRoute,
    calendarRoute,
    bookingsRoute,
    guestsRoute,
    analyticsRoute,
    settingsRoute,
    expensesRoute,
    housekeepingRoute,
    restaurantRoute,
    kitchenRoute,
    dailyReportRoute
  ])
])

// 6. Create and Export Router Instance
export const router = createRouter({
  routeTree,
  defaultPreload: 'intent'
})

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
