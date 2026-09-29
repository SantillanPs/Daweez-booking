import React from 'react'
import { Companion, PartnerDeal } from '../../types/booking'
import { User, Phone, Mail, Building2 } from 'lucide-react'
import { CompanionFields } from './CompanionFields'
import { BlockReasonFields } from './BlockReasonFields'

interface RoomDetailsFormProps {
  formStatus: 'confirmed' | 'blocked'
  formGuestName: string
  setFormGuestName: (val: string) => void
  formGuestEmail: string
  setFormGuestEmail: (val: string) => void
  formGuestPhone: string
  setFormGuestPhone: (val: string) => void
  formGuestGender: string
  setFormGuestGender: (val: string) => void
  formGuestNationality: string
  setFormGuestNationality: (val: string) => void
  formGuestAddress: string
  setFormGuestAddress: (val: string) => void
  formGuestBirthdate: string
  setFormGuestBirthdate: (val: string) => void
  formBlockNotes: string
  setFormBlockNotes: (val: string) => void
  formVehiclePlate: string
  setFormVehiclePlate: (val: string) => void
  formCompanions: Companion[]
  setFormCompanions: (val: Companion[]) => void
  showCompanions: boolean
  setShowCompanions: (val: boolean) => void
  hasRooms: boolean
  partnerDeals: PartnerDeal[]
  formPartnerDealId: string
  setFormPartnerDealId: (val: string) => void
  formCompanyName: string
  setFormCompanyName: (val: string) => void
  formTIN: string
  setFormTIN: (val: string) => void
  formAddress: string
  setFormAddress: (val: string) => void
  onSelectPartnerDeal: (deal: PartnerDeal | null) => void
  guestNameError: string
  onGuestNameBlur: () => void
  /** An agency is paying: the ⋯ menu offers it, and `agencySlot` sits above the name. */
  agencyOn: boolean
  /** What the slot currently shows — compared by the memo so it can never go stale. */
  agencyKey: string
  /** Is the bill-to picker open? The memo MUST compare this too, or **Change does nothing**. */
  agencyPicking: boolean
  onAddAgency: () => void
  onRemoveAgency: () => void
  /** The bill-to line / picker, built by the form (see AgencyFields). */
  agencySlot?: React.ReactNode
}

export const RoomDetailsForm = React.memo(
  ({
    formStatus,
    formGuestName,
    setFormGuestName,
    formGuestEmail,
    setFormGuestEmail,
    formGuestPhone,
    setFormGuestPhone,
    formGuestGender,
    setFormGuestGender,
    formGuestNationality,
    setFormGuestNationality,
    formGuestAddress,
    setFormGuestAddress,
    formGuestBirthdate,
    setFormGuestBirthdate,
    formVehiclePlate,
    setFormVehiclePlate,
    formBlockNotes,
    setFormBlockNotes,
    formCompanions,
    setFormCompanions,
    guestNameError,
    onGuestNameBlur,
    agencyOn,
    onAddAgency,
    onRemoveAgency,
    agencySlot
  }: RoomDetailsFormProps) => {
    /** The ⋯ menu: the only way into the agency feature the owner asked for. */
    const [menuOpen, setMenuOpen] = React.useState(false)

    /**
     * "More details" — the owner's instruction (2026-09-28): the guest card opens as
     * **Name and Contact No. side by side** and nothing else, with Nationality, Address,
     * Email, Plate No., Birth Date and Sex behind one quiet line.
     *
     * The extra fields show themselves whenever ANY of them already holds a value, so
     * correcting an old booking (or one typed off the paper form) can never hide a field
     * that has something in it — the toggle only decides whether an EMPTY section is on
     * screen.
     */
    const [showMore, setShowMore] = React.useState(false)
    const hasMoreDetails = !!(
      formGuestNationality || formGuestAddress || formGuestEmail ||
      formVehiclePlate || formGuestBirthdate || formGuestGender
    )
    const showExtra = showMore || hasMoreDetails
    // Read the staff-editable rate so the form never quotes a price the bill
    // won't charge (the price used to be hardcoded at ₱150).

    if (formStatus === 'blocked') {
      return <BlockReasonFields notes={formBlockNotes} setNotes={setFormBlockNotes} />
    }

    return (
      <div className="bg-base-100 p-3 rounded-xl border border-base-300 shadow-sm space-y-3 animate-in fade-in duration-200 font-sans">
        <div className="flex items-center gap-2 pb-2 border-b border-base-300">
          <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0"><User className="w-3 h-3" /></span>
          <h4 className="text-[10px] font-bold text-base-content tracking-widest uppercase">Guest Information</h4>
          {/* The ⋯ — the owner's own idea (2026-09): one small dot menu at the end of this
              row, holding "Add agency?" and, once an agency is on the booking, only
              "Remove agency" — **Change lives on the bill-to line itself** (the owner took
              the duplicate out of this menu), and the popup hangs to the LEFT of the dot
              rather than across the card. */}
          <div className="relative ml-auto">
            <button type="button" onClick={() => setMenuOpen(o => !o)} title="More for this guest"
              aria-label="More for this guest"
              className={'w-6 h-6 rounded-md border flex items-center justify-center font-bold tracking-widest leading-none cursor-pointer transition-colors ' +
                (menuOpen ? 'bg-gold-100 border-gold-400 text-brand-text' : 'bg-card border-soft text-muted hover:text-main')}>
              ⋯
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-7 z-30 min-w-[176px] bg-base-100 border border-base-300 rounded-lg shadow-lg overflow-hidden">
                {!agencyOn ? (
                  <button type="button" onClick={() => { setMenuOpen(false); onAddAgency() }}
                    className="w-full text-left px-3 py-2 text-[11.5px] font-bold text-main hover:bg-gold-100 flex items-center gap-1.5 cursor-pointer">
                    <Building2 className="w-3.5 h-3.5 text-brand-text" /> Add agency?
                  </button>
                ) : (
                  <button type="button" onClick={() => { setMenuOpen(false); onRemoveAgency() }}
                    className="w-full text-left px-3 py-2 text-[11.5px] font-bold text-danger-600 hover:bg-gold-100 cursor-pointer">Remove agency</button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* The agency line (BILL TO …) sits ABOVE the guest's name — the paper's own order,
            COMPANY over NAME OF GUEST. */}
        {agencySlot}
        
        <div className="space-y-3">

          {/* Name and Contact No. share the first row (the owner's design, 2026-09-28) —
              the two things the desk always types. Everything else waits behind "More
              details" below, and shows itself the moment it holds a value. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-base-content/70 font-medium block mb-1">Name <span className="text-error">*</span></label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40" />
              <input 
                type="text" 
                placeholder="Guest full name" 
                value={formGuestName} 
                onChange={e => setFormGuestName(e.target.value.toUpperCase())}
                onBlur={onGuestNameBlur}
                className={guestNameError ? 'input input-bordered input-error w-full pl-9' : 'input input-bordered w-full pl-9'} 
              />
            </div>
            {guestNameError && <p className="text-xs text-error mt-1">{guestNameError}</p>}
          </div>

          <div>
            <label className="text-xs text-base-content/70 font-medium block mb-1">Contact No.</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40" />
              <input
                type="text"
                placeholder="09xx-xxx-xxxx"
                value={formGuestPhone}
                onChange={e => setFormGuestPhone(e.target.value)}
                className="input input-bordered w-full pl-9"
              />
            </div>
          </div>
          </div>

          <button type="button" onClick={() => setShowMore(o => !o)}
            className="text-[11px] font-bold text-brand-text hover:underline cursor-pointer flex items-center gap-1">
            {showExtra ? '− Fewer details' : '＋ More details'}
          </button>
          {!showExtra && (
            <p className="text-[10px] text-muted -mt-1">Nationality · Address · Email · Plate No. · Birth Date · Sex</p>
          )}

          {showExtra && (
          <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-base-300">
            <div>
              <label className="text-xs text-base-content/70 font-medium block mb-1">Nationality</label>
              <input 
                type="text" 
                placeholder="e.g. Filipino" 
                value={formGuestNationality || ''} 
                onChange={e => setFormGuestNationality(e.target.value.toUpperCase())}
                className="input input-bordered w-full transition-all font-medium" 
              />
            </div>
            <div>
              <label className="text-xs text-base-content/70 font-medium block mb-1">Address</label>
              <input 
                type="text" 
                placeholder="Home address" 
                value={formGuestAddress || ''} 
                onChange={e => setFormGuestAddress(e.target.value.toUpperCase())}
                className="input input-bordered w-full transition-all font-medium" 
              />
            </div>
            <div>
              <label className="text-xs text-base-content/70 font-medium block mb-1">Email (optional)</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40" />
                <input 
                  type="email" 
                  placeholder="guest@domain.com" 
                  value={formGuestEmail} 
                  onChange={e => setFormGuestEmail(e.target.value)}
                  className="input input-bordered w-full pl-9" 
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-base-content/70 font-medium block mb-1">Plate No. (optional)</label>
              <input
                type="text"
                placeholder="Vehicle plate"
                value={formVehiclePlate || ''}
                onChange={e => setFormVehiclePlate(e.target.value.toUpperCase())}
                className="input input-bordered w-full transition-all font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-base-content/70 font-medium block mb-1">Birth Date (optional)</label>
              <input type="date" value={formGuestBirthdate} onChange={e => setFormGuestBirthdate(e.target.value)}
                className="input input-bordered w-full transition-all font-medium" />
            </div>
            <div>
              <label className="text-xs text-base-content/70 font-medium block mb-1">Sex</label>
              <select
                value={formGuestGender || ''}
                onChange={e => setFormGuestGender(e.target.value)}
                className="select select-bordered w-full font-medium"
              >
                <option value="">Not stated</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
          </div>

          </>
          )}

          <CompanionFields companions={formCompanions} setCompanions={setFormCompanions} />

        </div>
      </div>
    )
  },
  (prevProps, nextProps) => {
    const compsEqual = prevProps.formCompanions.length === nextProps.formCompanions.length &&
      prevProps.formCompanions.every((c, i) => c.name === nextProps.formCompanions[i].name && (c.nationality || '') === (nextProps.formCompanions[i].nationality || '') && !!c.breakfast === !!nextProps.formCompanions[i].breakfast)
    
    return (
      prevProps.formStatus === nextProps.formStatus &&
      prevProps.formGuestName === nextProps.formGuestName &&
      prevProps.formGuestEmail === nextProps.formGuestEmail &&
      prevProps.formGuestPhone === nextProps.formGuestPhone &&
      prevProps.formGuestGender === nextProps.formGuestGender &&
      prevProps.formGuestNationality === nextProps.formGuestNationality &&
      prevProps.formGuestAddress === nextProps.formGuestAddress &&
      prevProps.formGuestBirthdate === nextProps.formGuestBirthdate &&
      prevProps.formBlockNotes === nextProps.formBlockNotes &&
      prevProps.formVehiclePlate === nextProps.formVehiclePlate &&
      prevProps.showCompanions === nextProps.showCompanions &&
      prevProps.guestNameError === nextProps.guestNameError &&
      // The agency slot is a ReactNode, so the memo compares WHAT IT SHOWS (the agency's
      // identity) rather than the node itself — otherwise the card could keep an older
      // bill-to line after the agency changed.
      prevProps.agencyOn === nextProps.agencyOn &&
      prevProps.agencyKey === nextProps.agencyKey &&
      prevProps.agencyPicking === nextProps.agencyPicking &&

      prevProps.hasRooms === nextProps.hasRooms &&
      compsEqual
    )
  }
)