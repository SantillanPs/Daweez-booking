import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect
} from '@tanstack/react-router'
import { MainLayout } from './components/MainLayout'
import { LoginRoute } from './components/LoginPortal'
import { DashboardLayout } from './components/DashboardLayout'
import { CalendarTab } from './components/CalendarTab'
import { BookingsTab } from './components/BookingsTab'
import { DirectoryTab } from './components/DirectoryTab'
import { AnalyticsTab } from './components/AnalyticsTab'
import { SettingsTab } from './components/SettingsTab'
import { PublicReservePortal } from './components/PublicReservePortal'

// 1. Create a Root Route
const rootRoute = createRootRoute({
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
  component: PublicReservePortal
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
  component: CalendarTab
})

const bookingsRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/bookings',
  component: BookingsTab
})

const guestsRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/guests',
  component: DirectoryTab
})

const settingsRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/settings',
  component: SettingsTab
})

const analyticsRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/analytics',
  component: AnalyticsTab
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
    settingsRoute
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
