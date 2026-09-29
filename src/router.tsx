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
import { hydrateRateConfig } from './utils/rateConfig'
import { hydratePaymentAccounts } from './utils/paymentAccounts'

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
    settingsReady = Promise.all([hydrateRateConfig(), hydratePaymentAccounts()]).then(() => undefined)
  }
  return settingsReady
}

// 1. Create a Root Route
const rootRoute = createRootRoute({
  beforeLoad: () => loadSettings(),
  errorComponent: ({ error }) => <SettingsUnavailable error={error as Error} />,
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

const housekeepingRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/housekeeping',
  component: lazyRouteComponent(() => import('./components/HousekeepingTab'), 'HousekeepingTab')
})

const restaurantRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/restaurant',
  component: lazyRouteComponent(() => import('./components/RestaurantTab'), 'RestaurantTab')
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
    restaurantRoute
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
