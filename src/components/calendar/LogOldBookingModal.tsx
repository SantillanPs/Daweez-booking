import React, { useState } from 'react'
import { X, Users, Plus, CheckCircle2 } from 'lucide-react'
import { Booking, Room, Companion } from '../../types/booking'
import { dateToString, titleCase } from '../../utils/helpers'

const fmtPeso = (n: number) => '₱' + n.toLocaleString()

interface LogOldBookingInput {
  roomId: string; guestName: string; guestEmail: string; guestPhone: string
  guestAddress?: string; guestNationality?: string; companions?: Companion[]
  checkIn: string; checkOut: string; source: 'manual'; status: 'confirmed'
  referenceNumber?: string; registeredOn?: string
  paymentMethod?: string; downpaymentPaid?: number; balanceDue?: number
  paymentStatus?: 'unpaid' | 'downpayment' | 'paid'; paymentRecords?: Booking['payment_records']
}

interface LogOldBookingModalProps {
  rooms: Room[]
  createManualBooking: (p: LogOldBookingInput) => Promise<Booking>
  onClose: () => void
  // Calendar selection (rooms + dates) to pre-fill, like the other booking forms.
  initialSelections?: Record<string, { checkIn: string; checkOut: string; type: 'room' | 'venue' }>
}

// Logs a historical paper booking into the system: guest + room + dates + what
// was paid, plus the original paper log number/date so it stays findable.
export function LogOldBookingModal({ rooms, createManualBooking, onClose, initialSelections }: LogOldBookingModalProps) {
  const firstSel = initialSelections ? Object.values(initialSelections)[0] : undefined
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestAddress, setGuestAddress] = useState('')
  const [guestNationality, setGuestNationality] = useState('')
  const [companions, setCompanions] = useState<Companion[]>([])
  const [referenceNumber, setReferenceNumber] = useState('')
  const [registeredOn, setRegisteredOn] = useState('')
  const [roomId, setRoomId] = useState(firstSel?.type === 'room' ? (Object.keys(initialSelections || {})[0] || '') : '')
  const [checkIn, setCheckIn] = useState(firstSel?.checkIn || '')
  const [checkOut, setCheckOut] = useState(firstSel?.checkOut || '')
  const [payMode, setPayMode] = useState('Cash')
  const [total, setTotal] = useState('')
  const [deposit, setDeposit] = useState('')
  const [payDate, setPayDate] = useState(() => dateToString(new Date()))
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [loggedName, setLoggedName] = useState('')

  const cleanNum = (v: string) => {
    let s = v.replace(/[^0-9.]/g, '')
    const i = s.indexOf('.')
    if (i !== -1) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, '')
    return s
  }
  const totalNum = parseFloat(total) || 0
  const depositNum = parseFloat(deposit) || 0
  const balance = Math.max(0, totalNum - depositNum)
  const addCompanion = () => setCompanions(prev => [...prev, { name: '' }])
  const updateCompanion = (i: number, patch: Partial<Companion>) => setCompanions(prev => prev.map((c, idx) => idx === i ? { ...c, ...patch } : c))
  const removeCompanion = (i: number) => setCompanions(prev => prev.filter((_, j) => j !== i))

  const field = 'w-full bg-page border border-soft text-main px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-sea-500'
  const label = 'text-[10px] text-muted font-bold block mb-1'
  const moneyField = field + ' mt-1 font-mono'

  const reset = () => {
    setGuestName(''); setGuestPhone(''); setGuestEmail(''); setGuestAddress(''); setGuestNationality('')
    setCompanions([]); setReferenceNumber(''); setRegisteredOn(''); setRoomId('')
    setCheckIn(''); setCheckOut(''); setPayMode('Cash'); setTotal(''); setDeposit('')
    setPayDate(dateToString(new Date())); setError('')
  }

  const handleSave = async () => {
    if (!guestName.trim() || !guestPhone.trim()) { setError('Guest name and contact number are required.'); return }
    if (!roomId) { setError('Pick the room.'); return }
    if (!checkIn || !checkOut || checkOut <= checkIn) { setError('Check-out must be after check-in.'); return }
    setError(''); setIsSaving(true)
    try {
      const cleaned = companions.filter(c => c.name.trim())
      const paid = depositNum
      const status: Booking['payment_status'] = balance <= 0 ? 'paid' : 'downpayment'
      const recs = paid > 0
        ? [{ id: 'rcpt-' + Date.now(), amount: paid, method: payMode, paid_at: payDate ? new Date(payDate + 'T12:00:00').toISOString() : new Date().toISOString() }]
        : undefined
      await createManualBooking({
        roomId,
        guestName: guestName.trim(),
        guestEmail: guestEmail.trim() || 'admin@daweez-booking.vercel.app',
        guestPhone: guestPhone.trim() || 'None',
        guestAddress: guestAddress.trim() || undefined,
        guestNationality: guestNationality.trim() || undefined,
        companions: cleaned.length > 0 ? cleaned : undefined,
        checkIn, checkOut, source: 'manual', status: 'confirmed',
        referenceNumber: referenceNumber.trim() || undefined,
        registeredOn: registeredOn || undefined,
        paymentMethod: payMode,
        downpaymentPaid: paid,
        balanceDue: balance,
        paymentStatus: status,
        paymentRecords: recs,
      })
      setLoggedName(guestName.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the booking. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const modal = (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50">
      <div className="w-full max-w-lg bg-card rounded-xl shadow-softLg overflow-hidden flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-soft bg-sea-50 shrink-0">
          <div>
            <h3 className="font-display font-bold text-main">Log old booking</h3>
            <p className="text-[11px] text-muted">Copy a past paper booking into the system.</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-main transition-colors p-1.5 cursor-pointer" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loggedName ? (
          <div className="flex flex-col items-center justify-center flex-1 p-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-3" />
            <h4 className="font-display font-bold text-main">Booked {loggedName} in</h4>
            <p className="text-sm text-muted mt-1">It shows on the calendar and in the bookings list.</p>
            <div className="flex gap-2 mt-6">
              <button onClick={() => { reset(); setLoggedName('') }} className="px-4 py-2 rounded-lg bg-sea-600 hover:bg-sea-700 text-white text-sm font-bold transition-colors cursor-pointer">Log another</button>
              <button onClick={onClose} className="px-4 py-2 rounded-lg border border-soft text-main text-sm font-semibold hover:bg-sand-50 transition-colors cursor-pointer">Done</button>
            </div>
          </div>
        ) : (
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
                <input value={guestName} onChange={e => setGuestName(titleCase(e.target.value))} placeholder="Full name" className={field + ' mt-1'} />
              </label>
              <label className={label}>Contact no. *
                <input value={guestPhone} onChange={e => setGuestPhone(e.target.value)} placeholder="09xx xxx xxxx" className={field + ' mt-1'} />
              </label>
              <label className={label}>Address
                <input value={guestAddress} onChange={e => setGuestAddress(titleCase(e.target.value))} className={field + ' mt-1'} />
              </label>
              <label className={label}>Nationality
                <input value={guestNationality} onChange={e => setGuestNationality(titleCase(e.target.value))} placeholder="e.g. Filipino" className={field + ' mt-1'} />
              </label>
            </div>

            {/* Companions */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-muted uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-sea-600" /> Companions
              </p>
              {companions.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <input value={c.name} onChange={e => updateCompanion(i, { name: titleCase(e.target.value) })} placeholder="Name" className={field} />
                    <input value={c.nationality || ''} onChange={e => updateCompanion(i, { nationality: titleCase(e.target.value) })} placeholder="Nationality" className={field} />
                  </div>
                  <button type="button" onClick={() => removeCompanion(i)} className="text-muted hover:text-coral-600 p-1.5 cursor-pointer" aria-label="Remove companion">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button type="button" onClick={addCompanion} className="text-[11px] font-bold text-sea-700 bg-sea-50 border border-sea-200 hover:bg-sea-100 rounded-md px-2.5 py-1 transition-colors cursor-pointer inline-flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Add companion
              </button>
            </div>

            {/* Room + dates */}
            <div className="grid grid-cols-2 gap-3">
              <label className={label}>Room *
                <select value={roomId} onChange={e => setRoomId(e.target.value)} className={field + ' mt-1'}>
                  <option value="">Pick a room…</option>
                  {rooms.map(r => <option key={r.id} value={r.id}>Room {r.room_number} · {r.name}</option>)}
                </select>
              </label>
              <label className={label}>Check-in date *
                <input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)} className={field + ' mt-1'} />
              </label>
              <label className={label}>Check-out date *
                <input type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)} className={field + ' mt-1'} />
              </label>
            </div>

            {/* Payment */}
            <div className="bg-sand-50 border border-sand-200 rounded-lg p-3 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted">What was paid</p>
              <div className="grid grid-cols-2 gap-2">
                <label className={label}>Mode of payment
                  <select value={payMode} onChange={e => setPayMode(e.target.value)} className={field + ' mt-1'}>
                    <option>Cash</option><option>GCash</option><option>Bank transfer</option><option>Other</option>
                  </select>
                </label>
                <label className={label}>Date paid
                  <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className={field + ' mt-1'} />
                </label>
                <label className={label}>Total (on the paper)
                  <input type="text" inputMode="decimal" value={total} onChange={e => setTotal(cleanNum(e.target.value))} placeholder="0" className={moneyField} />
                </label>
                <label className={label}>Deposit / amount paid
                  <input type="text" inputMode="decimal" value={deposit} onChange={e => setDeposit(cleanNum(e.target.value))} placeholder="0" className={moneyField} />
                </label>
              </div>
              <div className="flex items-center justify-between text-[12px] pt-1 border-t border-sand-200">
                <span className="text-muted">Balance</span>
                <span className={'font-bold ' + (balance > 0 ? 'text-coral-600' : 'text-emerald-600')}>{fmtPeso(balance)}</span>
              </div>
            </div>

            {error && <div className="p-2.5 bg-coral-50 border border-coral-200 text-coral-600 text-xs rounded-lg">{error}</div>}

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose} className="flex-1 border border-soft text-main text-sm font-semibold py-2.5 rounded-lg hover:bg-sand-50 transition-colors cursor-pointer">Cancel</button>
              <button type="button" onClick={handleSave} disabled={isSaving} className="flex-1 bg-sea-600 hover:bg-sea-700 disabled:bg-sea-200 text-white text-sm font-bold py-2.5 rounded-lg transition-colors cursor-pointer shadow-sm">
                {isSaving ? 'Saving…' : 'Log booking'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return modal
}
