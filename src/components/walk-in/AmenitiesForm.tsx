import React, { useState } from 'react'
import { BedDouble, Minus, Plus } from 'lucide-react'
import { ICON_BUTTON, LABEL, OPTION_BODY, OPTION_ROW, OPTION_VALUE, optionIcon, optionName, optionPlus, REVEAL } from './formStyles'
import { getRateConfig } from '../../utils/rateConfig'

interface AmenitiesFormProps {
  hasRooms: boolean
  hasVenues: boolean
  hasAddons: boolean
  estRentals: number
  estAddons: number
  formChairs: number
  setFormChairs: (val: number) => void
  formExtraFoam: number
  setFormExtraFoam: (val: number) => void
  formExtraPillow: number
  setFormExtraPillow: (val: number) => void
  formExtraBlanket: number
  setFormExtraBlanket: (val: number) => void
  formExtraTowel: number
  setFormExtraTowel: (val: number) => void
  formEventTable: number
  setFormEventTable: (val: number) => void
  formEventTent: number
  setFormEventTent: (val: number) => void
  formVenueExcessHours: number
  setFormVenueExcessHours: (val: number) => void
}

interface Extra {
  label: string
  value: number
  set: (val: number) => void
  price: number
  per: string
}

/** One fewer, the count, one more. */
function Counter({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center select-none rounded-[10px] bg-softbg">
      <button type="button" onClick={() => onChange(Math.max(0, value - 1))} disabled={value <= 0}
        aria-label={'One fewer ' + label} className={ICON_BUTTON + ' !text-gold-800 hover:!bg-gold-100 disabled:opacity-30 disabled:hover:!bg-transparent'}>
        <Minus className="w-4 h-4" />
      </button>
      {/* The figure pops as it changes (the booking form mock, 2026-10-16). */}
      <span className="w-7 text-center"><span key={value} className="bk-pop inline-block text-[15px] font-bold tabular-nums text-main">{value}</span></span>
      <button type="button" onClick={() => onChange(value + 1)} aria-label={'One more ' + label} className={ICON_BUTTON + ' !text-gold-800 hover:!bg-gold-100'}>
        <Plus className="w-4 h-4" />
      </button>
    </div>
  )
}

function ExtraList({ title, items }: { title: string; items: Extra[] }) {
  return (
    <div>
      <p className={LABEL}>{title}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
        {items.map(item => (
          <div key={item.label} className="flex items-center justify-between min-h-11">
            <span className="text-[15px] font-medium text-main">
              {item.label}
              <span className="ml-2 text-[13px] font-normal text-muted tabular-nums">₱{item.price.toLocaleString()}{item.per}</span>
            </span>
            <Counter label={item.label} value={item.value} onChange={item.set} />
          </div>
        ))}
      </div>
    </div>
  )
}

// Add-ons (card k138) — one line in the stay's list of extras.
//
// The owner's rule: "everything should be accessible but not immediately on
// display" — and never the wrong kind of thing. A guest in a room is not offered
// a tent and a wedding is not offered an extra blanket, so the list follows the
// unit being booked, and the counters stay closed until somebody actually wants
// them. When something HAS been added the line says what and how much, so a closed
// line can never hide a charge.
//
// The sentences that listed what could be added, and the one explaining why a room is
// not offered a tent, are gone (the staff's feedback, 2026-10-04: hard to read).
//
// **The price beside each one is the price in Settings** — the one the bill charges. They
// were written here by hand (₱200, ₱50, ₱150…), so a price changed in Settings went on
// the bill while this line went on quoting the old one to the guest.
export const AmenitiesForm = React.memo(
  ({
    hasRooms,
    hasVenues,
    estRentals,
    estAddons,
    formChairs,
    setFormChairs,
    formExtraFoam,
    setFormExtraFoam,
    formExtraPillow,
    setFormExtraPillow,
    formExtraBlanket,
    setFormExtraBlanket,
    formExtraTowel,
    setFormExtraTowel,
    formEventTable,
    setFormEventTable,
    formEventTent,
    setFormEventTent,
    formVenueExcessHours,
    setFormVenueExcessHours,
  }: AmenitiesFormProps) => {
    const [open, setOpen] = useState(false)

    // The same figures `calculatePricing` charges (utils/pricing.ts).
    const rates = getRateConfig()
    const roomExtras: Extra[] = [
      { label: 'Foam', value: formExtraFoam, set: setFormExtraFoam, price: rates.foamRate, per: '/night' },
      { label: 'Pillow', value: formExtraPillow, set: setFormExtraPillow, price: rates.pillowRate, per: '/night' },
      { label: 'Blanket', value: formExtraBlanket, set: setFormExtraBlanket, price: rates.blanketRate, per: '/night' },
      { label: 'Towel', value: formExtraTowel, set: setFormExtraTowel, price: rates.towelRate, per: '/night' },
    ]
    const venueExtras: Extra[] = [
      { label: 'Table', value: formEventTable, set: setFormEventTable, price: rates.bigTableRate, per: '' },
      { label: 'Tent', value: formEventTent, set: setFormEventTent, price: rates.tentRate, per: '' },
      { label: 'Chairs', value: formChairs, set: setFormChairs, price: rates.chairRate, per: '' },
      { label: 'Excess Hours', value: formVenueExcessHours, set: setFormVenueExcessHours, price: rates.venueHourlyRate, per: '' },
    ]
    const added = [...(hasRooms ? roomExtras : []), ...(hasVenues ? venueExtras : [])]
      .filter(item => item.value > 0)
      .map(item => `${item.value} × ${item.label}`)
      .join(' · ')

    return (
      <li>
        <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
          className={OPTION_ROW + ' cursor-pointer'}>
          <span className={optionIcon(!!added)}><BedDouble /></span>
          <span className={optionName(!!added)}>Add-ons</span>
          {added && (
            <span key={added} title={added} className={OPTION_VALUE}>+₱{(estRentals + estAddons).toLocaleString()}</span>
          )}
          <span className={optionPlus(open)}><Plus /></span>
        </button>

        {open && (
          <div className={'space-y-3 pb-4 ' + OPTION_BODY + ' ' + REVEAL}>
            {hasRooms && <ExtraList title="Room extras, per night" items={roomExtras} />}
            {hasVenues && <ExtraList title="Venue rentals, one-time" items={venueExtras} />}
          </div>
        )}
      </li>
    )
  },
  (prevProps, nextProps) => {
    return (
      prevProps.hasRooms === nextProps.hasRooms &&
      prevProps.hasVenues === nextProps.hasVenues &&
      prevProps.hasAddons === nextProps.hasAddons &&
      prevProps.estRentals === nextProps.estRentals &&
      prevProps.estAddons === nextProps.estAddons &&
      prevProps.formChairs === nextProps.formChairs &&
      prevProps.formExtraFoam === nextProps.formExtraFoam &&
      prevProps.formExtraPillow === nextProps.formExtraPillow &&
      prevProps.formExtraBlanket === nextProps.formExtraBlanket &&
      prevProps.formExtraTowel === nextProps.formExtraTowel &&
      prevProps.formEventTable === nextProps.formEventTable &&
      prevProps.formEventTent === nextProps.formEventTent &&
      prevProps.formVenueExcessHours === nextProps.formVenueExcessHours
    )
  }
)
