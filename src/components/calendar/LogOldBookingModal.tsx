import React, { useState } from 'react'
import { X, Users, Plus } from 'lucide-react'
import { Booking, Room, Venue, Companion } from '../../types/booking'
import { dateToString } from '../../utils/helpers'
import { getEffectiveNightlyPrice } from '../../utils/promoMode'
import { OldBookingUnitPicker, OldBookingUnitSel } from './OldBookingUnitPicker'
import { OldBookingPayment } from './OldBookingPayment'

interface LogOldBookingInput {
  roomId?: string; venueId?: string; guestName: string; guestEmail: string; guestPhone: string
  guestAddress?: string; guestNationality?: string; companions?: Companion[]
  checkIn: string; checkOut: string; source: 'manual'; status: 'confirmed'
  referenceNumber?: string; registeredOn?: string
  paymentMethod?: string; downpaymentPaid?: number; balanceDue?: number
  paymentStatus?: 'unpaid' | 'downpayment' | 'paid'; paymentRecords?: Booking['payment_records']
  /** The price choice above — today's board price, or the older regular figure —
   *  passed through so the row RECORDS which one it was logged at. Without it
   *  every later read would silently re-price the log at the other figure. */
  usePromo?: boolean
  preparedBy?: string
}

interface LogOldBookingModalProps {
  rooms: Room[]
  venues: Venue[]
  createManualBooking: (p: LogOldBookingInput) => Promise<Booking>
  onClose: () => void
  // Calendar selection (room/venue + dates) to pre-fill, like the other booking forms.
  initialSelections?: Record<string, { checkIn: string; checkOut: string; type: 'room' | 'venue' }>
}

// Logs a historical paper booking into the system: guest + room + dates + what
// was paid, plus the original paper log number/date so it stays findable.
export function LogOldBookingModal({ rooms, venues, createManualBooking, onClose, initialSelections }: LogOldBookingModalProps) {
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestAddress, setGuestAddress] = useState('')
  const [guestNationality, setGuestNationality] = useState('')
  const [companions, setCompanions] = useState<Companion[]>([])
  const [referenceNumber, setReferenceNumber] = useState('')
  const [registeredOn, setRegisteredOn] = useState('')
  // Every room/venue picked on the calendar, in the order they were selected.
  const [unitSelections, setUnitSelections] = useState<Record<string, OldBookingUnitSel>>(() => {
    const s: Record<string, OldBookingUnitSel> = {}
    if (initialSelections) Object.entries(initialSelections).forEach(([id, sel]) => { s[id] = { checkIn: sel.checkIn, checkOut: sel.checkOut, type: sel.type } })
    return s
  })
  const [payMode, setPayMode] = useState('Cash')
  // Which price this paper log was written at. ON (the default) is the price on
  // the board today; untick it only for an old log that was written at the older
  // regular figure — the card k128 rule is one price, so "promo" is not a thing
  // staff are asked about any more.
  const [usePromo, setUsePromo] = useState(true)
  const [deposit, setDeposit] = useState('')
  const [fullyPaid, setFullyPaid] = useState(false)
  const [payDate, setPayDate] = useState(() => dateToString(new Date()))
  const [preparedBy, setPreparedBy] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [trySave, setTrySave] = useState(false)

  const cleanNum = (v: string) => {
    let s = v.replace(/[^0-9.]/g, '')
    const i = s.indexOf('.')
    if (i !== -1) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, '')
    return s
  }
  const depositNum = parseFloat(deposit) || 0
  const unitEntries = Object.entries(unitSelections)
  const unitNights = (sel: OldBookingUnitSel) => sel.checkIn && sel.checkOut ? Math.max(1, Math.ceil((new Date(sel.checkOut).getTime() - new Date(sel.checkIn).getTime()) / 86400000)) : 0
  const unitTotal = (id: string, sel: OldBookingUnitSel) => {
    const unit = sel.type === 'room' ? rooms.find(r => r.id === id) : venues.find(v => v.id === id)
    return unit ? Math.round(getEffectiveNightlyPrice(unit.base_price, unit.promo_price, usePromo) * unitNights(sel)) : 0
  }
  const unitTotals = unitEntries.map(([id, sel]) => unitTotal(id, sel))
  const totalNum = unitTotals.reduce((a, b) => a + b, 0)
  const totalNights = unitEntries.reduce((a, [, sel]) => a + unitNights(sel), 0)
  const totalLabel = totalNights > 0
    ? ` · ${totalNights} ${unitEntries.length === 1 && unitEntries[0][1].type === 'venue' ? 'day' : 'night'}${totalNights !== 1 ? 's' : ''}${unitEntries.length > 1 ? ` · ${unitEntries.length} units` : ''}`
    : ''
  const effectivePaid = fullyPaid ? totalNum : depositNum
  const balance = Math.max(0, totalNum - effectivePaid)
  const hasInvalidDates = unitEntries.some(([, sel]) => !sel.checkIn || !sel.checkOut || sel.checkOut <= sel.checkIn)
  const fieldErrors = {
    guestName: guestName.trim() ? '' : 'Guest name is required.',
    units: unitEntries.length === 0 ? 'Pick at least one room or venue.' : (hasInvalidDates ? 'Check that every room/venue has a valid check-in and check-out.' : ''),
  }
  const showErr = (f: keyof typeof fieldErrors) => (touched[f] || trySave) ? fieldErrors[f] : ''
  const isInvalid = (f: keyof typeof fieldErrors) => Boolean(showErr(f))
  const markTouched = (f: keyof typeof fieldErrors) => () => setTouched(t => ({ ...t, [f]: true }))
  const addCompanion = () => setCompanions(prev => [...prev, { name: '' }])
  const updateCompanion = (i: number, patch: Partial<Companion>) => setCompanions(prev => prev.map((c, idx) => idx === i ? { ...c, ...patch } : c))
  const removeCompanion = (i: number) => setCompanions(prev => prev.filter((_, j) => j !== i))

  const baseField = 'w-full bg-page border text-main px-3 py-2 rounded-lg text-sm focus:outline-none'
  const field = baseField + ' border-soft focus:border-gold-500'
  const fieldErr = baseField + ' border-danger-400 focus:border-danger-500'
  const label = 'text-[10px] text-muted font-bold block mb-1'

  const handleSave = async () => {
    if (Object.values(fieldErrors).some(v => v)) { setTrySave(true); return }
    setError(''); setIsSaving(true)
    try {
      const cleaned = companions.filter(c => c.name.trim())
      const paid = effectivePaid
      const n = unitEntries.length
      // Split the single "Amount paid" across units in proportion to each unit's total.
      const allocs: number[] = []
      if (totalNum > 0 && n > 0) {
        const raw = unitTotals.map(ut => Math.floor(paid * ut / totalNum))
        let diff = paid - raw.reduce((a, b) => a + b, 0)
        for (let i = 0; i < n && diff !== 0; i++) {
          const cap = unitTotals[i] - raw[i]
          const add = Math.min(cap, diff)
          raw[i] += add
          diff -= add
        }
        allocs.push(...raw)
      } else {
        unitTotals.forEach(() => allocs.push(0))
      }
      const paidAt = payDate ? new Date(payDate + 'T12:00:00').toISOString() : new Date().toISOString()
      for (let i = 0; i < n; i++) {
        const [id, sel] = unitEntries[i]
        const down = allocs[i]
        const bal = Math.max(0, unitTotals[i] - down)
        const status: Booking['payment_status'] = bal <= 0 ? 'paid' : 'downpayment'
        const recs = (i === 0 && paid > 0)
          ? [{ id: 'rcpt-' + Date.now(), amount: paid, method: payMode, paid_at: paidAt }]
          : undefined
        await createManualBooking({
          roomId: sel.type === 'room' ? id : undefined,
          venueId: sel.type === 'venue' ? id : undefined,
          guestName: guestName.trim(),
          guestEmail: guestEmail.trim() || 'admin@daweez-booking.vercel.app',
          guestPhone: guestPhone.trim() || 'None',
          guestAddress: guestAddress.trim() || undefined,
          guestNationality: guestNationality.trim() || undefined,
          companions: cleaned.length > 0 ? cleaned : undefined,
          checkIn: sel.checkIn, checkOut: sel.checkOut, source: 'manual', status: 'confirmed',
          referenceNumber: referenceNumber.trim() || undefined,
          registeredOn: registeredOn || undefined,
          paymentMethod: payMode,
          downpaymentPaid: down,
          balanceDue: bal,
          paymentStatus: status,
          paymentRecords: recs,
          usePromo,
          preparedBy: preparedBy.trim() || undefined,
        })
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the booking. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const modal = (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50">
      <div className="w-full max-w-lg bg-card rounded-xl shadow-softLg overflow-hidden flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-soft bg-gold-100 shrink-0">
          <div>
            <h3 className="font-display font-bold text-main">Log old booking</h3>
            <p className="text-[11px] text-muted">Copy a past paper booking into the system.</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-main transition-colors p-1.5 cursor-pointer" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
            {/* Reference */}
            <div className="grid grid-cols-2 gap-3">
              <label className={label}>Original registration No. (on the paper)
                <input value={referenceNumber} onChange={e => setReferenceNumber(e.target.value)} placeholder="e.g. 2549-09-0023" className={field + ' mt-1'} />
              </label>
              <label className={label}>Date on the paper log
                <input type="date" value={registeredOn} onChange={e => setRegisteredOn(e.target.value)} className={field + ' mt-1'} />
              </label>
            </div>

            {/* Guest */}
            <div className="grid grid-cols-2 gap-3">
              <label className={label}>Guest name *
                <input value={guestName} onChange={e => setGuestName(e.target.value.toUpperCase())} onBlur={markTouched('guestName')} placeholder="Full name" className={(isInvalid('guestName') ? fieldErr : field) + ' mt-1'} />
                {showErr('guestName') && <p className="text-[10px] text-danger-600 mt-1">{showErr('guestName')}</p>}
              </label>
              <label className={label}>Contact no.
                <input value={guestPhone} onChange={e => setGuestPhone(e.target.value)} placeholder="09xx xxx xxxx" className={field + ' mt-1'} />
              </label>
              <label className={label}>Address
                <input value={guestAddress} onChange={e => setGuestAddress(e.target.value.toUpperCase())} className={field + ' mt-1'} />
              </label>
              <label className={label}>Nationality
                <input value={guestNationality} onChange={e => setGuestNationality(e.target.value.toUpperCase())} placeholder="e.g. Filipino" className={field + ' mt-1'} />
              </label>
            </div>

            {/* Companions */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-muted uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-gold-600" /> Companions
              </p>
              {companions.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <input value={c.name} onChange={e => updateCompanion(i, { name: e.target.value.toUpperCase() })} placeholder="Name" className={field} />
                    <input value={c.nationality || ''} onChange={e => updateCompanion(i, { nationality: e.target.value.toUpperCase() })} placeholder="Nationality" className={field} />
                  </div>
                  <button type="button" onClick={() => removeCompanion(i)} className="text-muted hover:text-danger-600 p-1.5 cursor-pointer" aria-label="Remove companion">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button type="button" onClick={addCompanion} className="text-[11px] font-bold text-gold-700 bg-gold-100 border border-gold-200 hover:bg-gold-100 rounded-md px-2.5 py-1 transition-colors cursor-pointer inline-flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Add companion
              </button>
            </div>

            {/* Units (rooms / venues) */}
            <div className="space-y-1">
              <OldBookingUnitPicker
                rooms={rooms}
                venues={venues}
                unitSelections={unitSelections}
                onChange={next => setUnitSelections(next)}
              />
              {showErr('units') && <p className="text-[10px] text-danger-600 mt-1">{showErr('units')}</p>}
            </div>

            {/* Receptionist on duty */}
            <div>
              <label className={label}>Receptionist on duty
                <input value={preparedBy} onChange={e => setPreparedBy(e.target.value.toUpperCase())} placeholder="Staff name" className={field + ' mt-1'} />
              </label>
            </div>

            {/* Payment */}
            <OldBookingPayment
              payMode={payMode}
              setPayMode={setPayMode}
              payDate={payDate}
              setPayDate={setPayDate}
              deposit={deposit}
              setDeposit={setDeposit}
              usePromo={usePromo}
              setUsePromo={setUsePromo}
              fullyPaid={fullyPaid}
              setFullyPaid={setFullyPaid}
              totalLabel={totalLabel}
              totalNum={totalNum}
              balance={balance}
              cleanNum={cleanNum}
            />

            {error && <div className="p-2.5 bg-danger-50 border border-danger-200 text-danger-600 text-xs rounded-lg">{error}</div>}

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose} className="flex-1 border border-soft text-main text-sm font-semibold py-2.5 rounded-lg hover:bg-paper-50 transition-colors cursor-pointer">Cancel</button>
              <button type="button" onClick={handleSave} disabled={isSaving} className="flex-1 bg-gold-400 hover:bg-gold-600 disabled:bg-gold-200 text-ink-900 text-sm font-bold py-2.5 rounded-lg transition-colors cursor-pointer shadow-sm">
                {isSaving ? 'Saving…' : 'Log booking'}
              </button>
            </div>
          </div>
      </div>
    </div>
  )

  return modal
}