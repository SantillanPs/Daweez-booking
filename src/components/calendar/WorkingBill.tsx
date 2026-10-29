import React, { useRef, useState } from 'react'
import { useDashboardData } from '../DashboardContext'
import { ExtendStayModal, PanelDesk } from './ExtendStayModal'
import { groupOf } from '../../utils/bookingGroup'
import { isOpenEnded } from '../../utils/openBlock'
import { showToast } from '../../utils/toast'
import type { Booking } from '../../types/booking'

const NewBookingBill = React.lazy(() => import('./NewBookingBill').then(m => ({ default: m.NewBookingBill })))

// The one bill, opened where the desk already is rather than on the calendar (Sebastian,
// 2026-10-28: "it should open the bill IN the cash flow"). It is the calendar's bill, being
// worked on, never a copy to look at. The booking's panel is there but out of sight, because the
// bill's payments and receipts go through it (`deskRef`, so `payBill` shares them out across the
// rooms); closing the bill closes both.
export function WorkingBill({ booking, mark, onBooking, onClose }: { booking: Booking; mark?: string; onBooking?: (b: Booking) => void; onClose: () => void }) {
  const { rooms, venues, bookings, allBookings, createManualBooking, cancelBooking, deleteBooking, updateBooking } = useDashboardData()
  const deskRef = useRef<PanelDesk | null>(null)
  const [id, setId] = useState(booking.id)
  // The cached row, so the panel and the bill follow every save; cancelled ones too.
  const live = allBookings.find(b => b.id === id) || booking

  return (
    <>
      <ExtendStayModal
        key={live.id}
        booking={live}
        rooms={rooms}
        venues={venues}
        bookings={bookings}
        allBookings={allBookings}
        extendCheckoutDate={isOpenEnded(live) ? '' : live.check_out}
        extendError=""
        onClose={onClose}
        onExtendStaySubmit={e => e.preventDefault()}
        setExtendCheckoutDate={() => {}}
        onCancelBooking={cancelBooking}
        onUpdateBooking={updateBooking}
        deskRef={deskRef}
        unseen
        onOpenBooking={b => setId(b.id)}
      />
      <React.Suspense fallback={null}>
        <NewBookingBill
          key={'bill-' + (live.group_id || live.id)}
          rooms={rooms}
          venues={venues}
          bookings={bookings}
          allBookings={allBookings}
          createManualBooking={createManualBooking}
          updateBooking={updateBooking}
          cancelBooking={cancelBooking}
          deleteBooking={deleteBooking}
          editing={groupOf(bookings.find(b => b.id === live.id) || live, bookings)}
          desk={{
            onPay: p => deskRef.current ? deskRef.current.onPay(p) : showToast('Open the booking again to take the payment.', 'error'),
            onFix: (key, patch) => deskRef.current?.onFix(key, patch),
            onReceipt: (n, start) => deskRef.current?.onReceipt(n, start),
          }}
          // A room swapped or taken off is a new row: the bill and the panel follow the booking.
          mark={mark}
          // A cancelled booking has no place on the calendar to go to.
          onBooking={onBooking && live.status !== 'cancelled' ? () => onBooking(live) : undefined}
          onSaved={rows => setId(cur => rows.some(r => r.id === cur) ? cur : rows[0].id)}
          onClose={onClose}
        />
      </React.Suspense>
    </>
  )
}
