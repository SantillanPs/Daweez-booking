import React, { useState } from 'react'
import { Building2 } from 'lucide-react'
import { PartnerDeal, Room } from '../../types/booking'
import { getEffectiveNightlyPrice } from '../../utils/promoMode'
import { generateUUID } from '../../utils/helpers'
import { useDashboardData } from '../DashboardContext'

const field = 'input input-bordered input-sm w-full text-sm'
const lab = 'text-[10px] font-bold text-base-content/60 uppercase tracking-wider'
const money = (n: number) => '₱' + Math.round(n || 0).toLocaleString()

/**
 * An agency's own profile — its details **and the prices it pays per room** (the owner's
 * design, 2026-09).
 *
 * It opens when the desk creates an agency from the booking form, and again from
 * `Change` on an agency that already exists, so **one editor owns an agency** whether it
 * is new or old (the owner's ruling: *“it should open a create profile form or something
 * to set custom prices for rooms, and add agency details”*). Guests & Partners edits the
 * same profile from the other side.
 *
 * The board price of each room stays visible as a grey hint (the owner's ruling) — never
 * charged to the agency — and **an empty box means that room keeps the board price**, so
 * an agency deal can be a few rooms rather than all of them.
 */
export function AgencyProfileForm({ deal, draftName, rooms, onSaved, onClose }: {
  /** The agency being corrected, or null when a new one is being created. */
  deal: PartnerDeal | null
  /** What the desk had typed when they asked to create a new one. */
  draftName?: string
  rooms: Room[]
  onSaved: (saved: PartnerDeal) => void
  onClose: () => void
}) {
  const { partnerDeals, savePartnerDeals } = useDashboardData()
  const [name, setName] = useState(deal?.name || draftName || '')
  const [address, setAddress] = useState(deal?.address || '')
  const [contact, setContact] = useState(deal?.contact_no || '')
  const [tin, setTin] = useState(deal?.tin || '')
  const [plate, setPlate] = useState(deal?.vehicle_plate || '')
  const [rates, setRates] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {}
    Object.entries(deal?.contracted_rates || {}).forEach(([id, rate]) => {
      if (rate > 0) out[id] = String(rate)
    })
    return out
  })
  const [busy, setBusy] = useState(false)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    const contracted: Record<string, number> = {}
    Object.entries(rates).forEach(([id, value]) => {
      const n = Number(value)
      if (n > 0) contracted[id] = Math.round(n)
    })
    const saved: PartnerDeal = {
      id: deal?.id || 'partner-' + generateUUID(),
      name: name.trim(),
      type: deal?.type || 'agency',
      address: address.trim() || undefined,
      contact_no: contact.trim() || undefined,
      tin: tin.trim() || undefined,
      vehicle_plate: plate.trim() || undefined,
      email: deal?.email,
      breakfast_default: deal?.breakfast_default || 'w/o',
      contracted_rates: contracted,
      created_at: deal?.created_at || new Date().toISOString(),
    }
    try {
      const others = partnerDeals.filter(d => d.id !== saved.id)
      await savePartnerDeals([...others, saved])
      onSaved(saved)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/50 font-sans" onClick={onClose}>
      <form onSubmit={save} onClick={e => e.stopPropagation()}
        className="w-full max-w-2xl bg-base-100 rounded-xl border border-base-300 shadow-xl flex flex-col max-h-[90vh] overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-base-300 shrink-0">
          <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Building2 className="w-3 h-3" />
          </span>
          <h3 className="text-sm font-bold text-base-content">{deal ? 'Edit agency' : 'New agency'}</h3>
          <button type="button" onClick={onClose}
            className="ml-auto text-[11px] font-bold text-muted hover:text-main cursor-pointer">Cancel</button>
        </div>

        <div className="overflow-y-auto p-4 space-y-3">
          <div>
            <p className={lab}>Agency details</p>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Agency name" className={field + ' mt-1 font-semibold'} />
            <div className="grid grid-cols-2 gap-2 mt-2">
              <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Address" className={field} />
              <input value={contact} onChange={e => setContact(e.target.value)} placeholder="Contact no." className={field} />
              <input value={tin} onChange={e => setTin(e.target.value)} placeholder="TIN" className={field} />
              <input value={plate} onChange={e => setPlate(e.target.value)} placeholder="Vehicle plate" className={field} />
            </div>
          </div>

          <div>
            <p className={lab + ' text-brand-text'}>What this agency pays per room</p>
            <p className="text-[10.5px] text-base-content/60 mt-0.5">
              The grey figure is the price on the board — a hint, never charged to them. Leave a box empty and that room stays at the board price.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 mt-2">
              {rooms.map(room => {
                const board = getEffectiveNightlyPrice(room.base_price, room.promo_price)
                return (
                  <label key={room.id} className="flex items-center gap-2">
                    <span className="flex-1 text-[11.5px] font-semibold text-main truncate">
                      Room {room.room_number} <span className="text-muted font-normal">· {room.name}</span>
                    </span>
                    <span className="font-mono text-[10.5px] text-base-content/50 w-14 text-right">{money(board)}</span>
                    <input type="text" inputMode="decimal" value={rates[room.id] ?? ''}
                      onChange={e => setRates(r => ({ ...r, [room.id]: e.target.value.replace(/[^0-9.]/g, '') }))}
                      placeholder="—"
                      className="input input-bordered input-sm w-24 text-right font-mono" />
                  </label>
                )
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-base-300 shrink-0">
          {!name.trim() && <span className="text-[11px] text-danger-600 font-semibold mr-auto">Give the agency a name.</span>}
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm">Cancel</button>
          <button type="submit" disabled={busy || !name.trim()} className="btn btn-primary">
            {busy ? 'Saving…' : 'Save agency'}
          </button>
        </div>
      </form>
    </div>
  )
}
