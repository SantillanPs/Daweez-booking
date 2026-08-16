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
    expensesRoute
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
