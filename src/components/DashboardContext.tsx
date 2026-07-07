import { createContext, useContext } from 'react'
import { Room, Venue, Booking, SyncFeed, BookingSource, BreakfastOrder, Companion, EquipmentRental, EventAddons, PartnerDeal } from '../types/booking'

export interface DashboardDataContextValue {
  rooms: Room[]
  venues: Venue[]
  bookings: Booking[]
  feeds: SyncFeed[]
  partnerDeals: PartnerDeal[]
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
    invoiceType?: 'folio' | 'billing'
    breakfastIncluded?: boolean
    contractRateOverride?: number
  }) => Promise<Booking>
  triggerOTASync: () => Promise<number>
  updateFeedUrls: (updatedFeeds: SyncFeed[]) => Promise<SyncFeed[]>
  createPartnerDeal: (deal: PartnerDeal) => Promise<void>
  savePartnerDeals: (deals: PartnerDeal[]) => Promise<void>
  deletePartnerDeal: (dealId: string) => Promise<void>
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
