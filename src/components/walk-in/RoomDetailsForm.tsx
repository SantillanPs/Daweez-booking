import React from 'react'
import { Companion, PartnerDeal } from '../../types/booking'
import { Building2, ChevronDown } from 'lucide-react'
import { CompanionFields } from './CompanionFields'
import { BlockReasonFields } from './BlockReasonFields'
import { BirthDateInput } from './BirthDateInput'
import { NationalityInput } from '../NationalityInput'
import { Field } from './Field'
import { FIELD, FIELD_ERROR, SELECT, GROUP, GROUP_TITLE, OPTION_LIST, OPTION_ROW, OPTION_NAME, OPTION_VALUE, REVEAL } from './formStyles'

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
    // Once open because a field holds something, it STAYS open while that field is
    // retyped — clearing the only filled box used to close the section mid-typing.
    if (hasMoreDetails && !showMore) setShowMore(true)
    const showExtra = showMore || hasMoreDetails
    // Read the staff-editable rate so the form never quotes a price the bill
    // won't charge (the price used to be hardcoded at ₱150).

    if (formStatus === 'blocked') {
      return <BlockReasonFields notes={formBlockNotes} setNotes={setFormBlockNotes} />
    }

    return (
      <section className={GROUP + ' font-sans'}>
        <div className="flex items-center justify-between gap-2">
          <h4 className={GROUP_TITLE}>Guest</h4>
          {/* The ⋯ — the owner's own idea (2026-09): one small dot menu at the end of this
              row, holding "Add agency?" and, once an agency is on the booking, only
              "Remove agency" — **Change lives on the bill-to line itself** (the owner took
              the duplicate out of this menu), and the popup hangs to the LEFT of the dot
              rather than across the form. */}
          <div className="relative -my-2">
            <button type="button" onClick={() => setMenuOpen(o => !o)} title="More for this guest"
              aria-label="More for this guest" aria-expanded={menuOpen}
              className={'w-11 h-11 rounded-md flex items-center justify-center font-bold tracking-widest leading-none cursor-pointer transition-colors ' +
                (menuOpen ? 'bg-gold-100 text-brand-text' : 'text-muted hover:text-main hover:bg-softbg')}>
              ⋯
            </button>
            {menuOpen && (
              <div className={'absolute right-0 top-11 z-30 min-w-[184px] bg-card border border-soft rounded-md shadow-softLg overflow-hidden ' + REVEAL}>
                {!agencyOn ? (
                  <button type="button" onClick={() => { setMenuOpen(false); onAddAgency() }}
                    className="w-full text-left px-3 h-11 text-[14px] font-semibold text-main hover:bg-gold-100 flex items-center gap-2 cursor-pointer">
                    <Building2 className="w-4 h-4 text-brand-text" /> Add agency?
                  </button>
                ) : (
                  <button type="button" onClick={() => { setMenuOpen(false); onRemoveAgency() }}
                    className="w-full text-left px-3 h-11 text-[14px] font-semibold text-danger-600 hover:bg-gold-100 cursor-pointer">Remove agency</button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* The agency line (BILL TO …) sits ABOVE the guest's name — the paper's own order,
            COMPANY over NAME OF GUEST. */}
        {agencySlot}

        {/* Name and Contact No. come first (the owner's design, 2026-09-28) — the two
            things the desk always types. Everything else waits behind "More details"
            below, and shows itself the moment it holds a value. Only Name is marked (the
            red star); "(optional)" on three of the rest made the other four read as
            required. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
          <Field label="Name" required error={guestNameError}>
            <input
              type="text"
              autoComplete="off"
              value={formGuestName}
              onChange={e => setFormGuestName(e.target.value.toUpperCase())}
              onBlur={onGuestNameBlur}
              aria-invalid={guestNameError ? true : undefined}
              className={guestNameError ? FIELD_ERROR : FIELD}
            />
          </Field>
          <Field label="Contact no.">
            <input
              type="text"
              inputMode="tel"
              autoComplete="off"
              value={formGuestPhone}
              onChange={e => setFormGuestPhone(e.target.value)}
              className={FIELD}
            />
          </Field>
        </div>

        {/* The optional extras, as lines in one ruled list. The whole line is the button. */}
        <ul className={OPTION_LIST}>
          {/* The extra boxes open UNDER this line, the way every other line here opens (the
              usability pass, 2026-10-05). They used to appear above it, in the grid with the
              name: the line that was pressed jumped six boxes down the form and ended up
              under what it had opened. Once any of them holds something they stay on
              screen, so there is nothing left for the line to open or close and it goes. */}
          <li>
            {!hasMoreDetails && (
              <button type="button" onClick={() => setShowMore(o => !o)} aria-expanded={showExtra}
                className={OPTION_ROW + ' cursor-pointer'}>
                <span className={OPTION_NAME}>More details</span>
                <span className={OPTION_VALUE}>
                  {showExtra
                    ? <span>Hide</span>
                    : <span className="truncate font-normal text-muted">Nationality, address, email, plate no., birth date, sex</span>}
                  <ChevronDown className={'w-4 h-4 shrink-0 transition-transform duration-200 ' + (showExtra ? 'rotate-180' : '')} />
                </span>
              </button>
            )}
            {showExtra && (
              <div className={'grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 pb-4 ' + (hasMoreDetails ? 'pt-4' : 'pt-1')}>
                <Field label="Nationality" className={REVEAL}>
                  <NationalityInput value={formGuestNationality || ''} onChange={setFormGuestNationality} className={FIELD} />
                </Field>
                <Field label="Address" className={REVEAL}>
                  <input
                    type="text"
                    value={formGuestAddress || ''}
                    onChange={e => setFormGuestAddress(e.target.value.toUpperCase())}
                    className={FIELD}
                  />
                </Field>
                <Field label="Email" className={REVEAL}>
                  <input
                    type="email"
                    value={formGuestEmail}
                    onChange={e => setFormGuestEmail(e.target.value)}
                    className={FIELD}
                  />
                </Field>
                <Field label="Plate no." className={REVEAL}>
                  <input
                    type="text"
                    value={formVehiclePlate || ''}
                    onChange={e => setFormVehiclePlate(e.target.value.toUpperCase())}
                    className={FIELD}
                  />
                </Field>
                {/* A plain block, not a `Field`: the date box carries its own label for
                    screen readers and draws its own "type it like this" line under itself. */}
                <div className={REVEAL}>
                  <span className="block text-[13px] font-medium text-muted mb-1.5">Birth date</span>
                  <BirthDateInput value={formGuestBirthdate} onChange={setFormGuestBirthdate} />
                </div>
                <Field label="Sex" className={REVEAL}>
                  <select
                    value={formGuestGender || ''}
                    onChange={e => setFormGuestGender(e.target.value)}
                    className={SELECT}
                  >
                    <option value="">Not stated</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </Field>
              </div>
            )}
          </li>
          <CompanionFields companions={formCompanions} setCompanions={setFormCompanions} />
        </ul>
      </section>
    )
  },
  (prevProps, nextProps) => {
    const compsEqual = prevProps.formCompanions.length === nextProps.formCompanions.length &&
      prevProps.formCompanions.every((c, i) => c.name === nextProps.formCompanions[i].name && (c.nationality || '') === (nextProps.formCompanions[i].nationality || '') && (c.sex || '') === (nextProps.formCompanions[i].sex || '') && !!c.breakfast === !!nextProps.formCompanions[i].breakfast)
    
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