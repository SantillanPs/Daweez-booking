import React, { useState } from 'react'
import { Booking } from '../../types/booking'
import { channelOf, CHANNEL_NAME, needsDetails } from '../../utils/channelStay'

const BOX = 'w-full h-11 rounded-lg border-[1.5px] border-soft bg-card px-3 text-base sm:text-[14px] text-main placeholder:text-muted outline-none transition-colors focus:border-gold-500'

/**
 * **What the calendar link cannot say** (the mock, Sebastian, 2026-10-31): the link gives dates only,
 * so the desk types the name, phone and price from the site's own message. There is no Save button:
 * a box is saved when it is left, and a stay with a name has its money and its Bill.
 */
export function ChannelDetails({ booking, onSave }: {
  booking: Booking
  onSave: (patch: Partial<Booking>) => void
}) {
  const site = CHANNEL_NAME[channelOf(booking) || 'booking_com']
  const [name, setName] = useState(needsDetails(booking) ? '' : booking.guest_name)
  const [phone, setPhone] = useState(booking.guest_phone || '')
  const nights = Math.max(1, Math.round((new Date(booking.check_out).getTime() - new Date(booking.check_in).getTime()) / 86400000))
  const [price, setPrice] = useState(booking.contract_rate_override ? String(Math.round(booking.contract_rate_override * nights)) : '')

  const leaveName = () => {
    const typed = name.trim()
    if (typed && typed !== booking.guest_name) onSave({ guest_name: typed })
  }
  const leavePhone = () => {
    if (phone.trim() !== (booking.guest_phone || '')) onSave({ guest_phone: phone.trim() })
  }
  // The site's price for the whole stay is kept per night, as a price typed on the bill is.
  const leavePrice = () => {
    const total = Number(price.replace(/[^\d.]/g, ''))
    const rate = total > 0 ? Math.round((total / nights) * 100) / 100 : undefined
    if (rate !== (booking.contract_rate_override ?? undefined)) onSave({ contract_rate_override: rate })
  }
  const enterLeaves = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') e.currentTarget.blur() }

  return (
    <div className="grid gap-2">
      <input value={name} onChange={e => setName(e.target.value)} onBlur={leaveName} onKeyDown={enterLeaves}
        aria-label="Guest's name" placeholder="Name, e.g. Maria Santos" autoComplete="off" className={BOX} />
      <input value={phone} onChange={e => setPhone(e.target.value)} onBlur={leavePhone} onKeyDown={enterLeaves}
        aria-label="Guest's phone" placeholder="Phone, e.g. 0917 123 4567" inputMode="tel" autoComplete="off" className={BOX} />
      <input value={price} onChange={e => setPrice(e.target.value)} onBlur={leavePrice} onKeyDown={enterLeaves}
        aria-label={site + ' price'} placeholder={site + ' price, e.g. 4,200'} inputMode="numeric" autoComplete="off" className={BOX} />
    </div>
  )
}
