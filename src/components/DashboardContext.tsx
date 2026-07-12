import { createContext, useContext } from 'react'
import { Room, Venue, Booking, SyncFeed, BookingSource, BreakfastOrder, Companion, EquipmentRental, EventAddons, PartnerDeal } from '../types/booking'
import { Expense, ExpenseCategory } from '../types/expense'

export interface DashboardDataContextValue {
  rooms: Room[]
  venues: Venue[]
  bookings: Booking[]
  feeds: SyncFeed[]
  partnerDeals: PartnerDeal[]
  expenses: Expense[]
  expenseCategories: ExpenseCategory[]
  isLoading: boolean
  isConfirming?: boolean
  confirmBooking: (id: string) => Promise<void>
  cancelBooking: (id: string) => Promise<void>
  createManualBooking: (params: {
    roomId?: string
    venueId?: string
    guestName: string
    guestEmail: string
    guestPhone: string
    checkIn: string
    checkOut: string
    source: BookingSource
    status: 'confirmed' | 'blocked'
    breakfastOrders?: BreakfastOrder[]
    equipmentRentals?: EquipmentRental
    eventAddons?: EventAddons
    rateMultiplier?: number
    companions?: Companion[]
    partnerDealId?: string
    companyName?: string
    vehiclePlate?: string
    breakfastIncluded?: boolean
    contractRateOverride?: number
    paymentMethod?: string
    paymentReference?: string
    venueExcessHours?: number
    id?: string
    invoiceNumber?: string
    paymentStatus?: 'unpaid' | 'downpayment' | 'paid'
    downpaymentPaid?: number
    balanceDue?: number
    securityDeposit?: number
  }) => Promise<Booking>
  triggerOTASync: () => Promise<number>
  updateBooking: (booking: Booking) => Promise<void>
  updateFeedUrls: (updatedFeeds: SyncFeed[]) => Promise<SyncFeed[]>
  createPartnerDeal: (deal: PartnerDeal) => Promise<void>
  savePartnerDeals: (deals: PartnerDeal[]) => Promise<void>
  deletePartnerDeal: (dealId: string) => Promise<void>
  createExpenseCategory: (category: Omit<ExpenseCategory, 'created_at'> & { created_at?: string }) => Promise<void>
  updateExpenseCategory: (category: ExpenseCategory) => Promise<void>
  deleteExpenseCategory: (categoryId: string) => Promise<void>
  createExpense: (expense: Omit<Expense, 'created_at'> & { created_at?: string }) => Promise<void>
  deleteExpense: (expenseId: string) => Promise<void>
  onLogout: () => void
}

export const DashboardDataContext = createContext<DashboardDataContextValue | null>(null)

export function useDashboardData() {
  const ctx = useContext(DashboardDataContext)
  if (!ctx) {
    throw new Error('useDashboardData must be used within a DashboardDataProvider')
  }
  return ctx
}
