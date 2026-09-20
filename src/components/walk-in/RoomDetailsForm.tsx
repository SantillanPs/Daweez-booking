import React from 'react'
import { Companion, PartnerDeal } from '../../types/booking'
import { getRateConfig } from '../../utils/rateConfig'
import { User, Phone, Mail, Users, Trash2, Plus, CheckCircle2 } from 'lucide-react'

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
    showCompanions,
    setShowCompanions,
    guestNameError,
    onGuestNameBlur
  }: RoomDetailsFormProps) => {
    // Read the staff-editable rate so the form never quotes a price the bill
    // won't charge (the price used to be hardcoded at ₱150).

    if (formStatus === 'blocked') {
      return (
        <div className="bg-base-200 border border-base-300 rounded-lg px-2.5 py-2 space-y-1.5">
          <p className="text-[10px] font-bold text-base-content flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-primary" /> Block — just blocks the calendar (no charge).
          </p>
          <label className="text-[10px] text-base-content/60 font-bold block">Block reason (maintenance / cleaning)</label>
          <input value={formBlockNotes} onChange={e => setFormBlockNotes(e.target.value.toUpperCase())} placeholder="e.g. Room maintenance"
            className="input input-sm input-bordered w-full" />
        </div>
      )
    }

    return (
      <div className="bg-base-100 p-3 rounded-xl border border-base-300 shadow-sm space-y-3 animate-in fade-in duration-200 font-sans">
        <div className="flex items-center gap-2 pb-2 border-b border-base-300">
          <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0"><User className="w-3 h-3" /></span>
          <h4 className="text-[10px] font-bold text-base-content tracking-widest uppercase">Guest Information</h4>
        </div>
        
        <div className="space-y-3">


          {/* Primary Guest Name */}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-base-300">
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
          
          {/* Companions */}
          <div className="pt-2 border-t border-base-300 col-span-1 sm:col-span-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0"><Users className="w-3 h-3" /></span>
                <span className="text-xs font-bold text-base-content">Companion Information</span>
                {formCompanions.length > 0 && (
                  <span className="badge badge-primary badge-sm ml-1">{formCompanions.length} Guest{formCompanions.length !== 1 ? 's' : ''}</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => setFormCompanions([...formCompanions, { name: '' }])}
                className="btn btn-ghost btn-xs text-primary hover:text-primary/80 font-bold gap-1 normal-case"
              >
                <Plus className="w-3.5 h-3.5" /> Add Guest
              </button>
            </div>

            <div className="space-y-2 pt-2">
              {formCompanions.length === 0 && (
                <p className="text-xs text-base-content/60 py-3 italic text-center bg-base-200/50 rounded border border-dashed border-base-300">
                  No other guests added. Tap "Add Guest" to add.
                </p>
              )}
              {formCompanions.map((comp, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-base-200/50 p-2 rounded border border-base-300/60">
                  <input
                    type="text"
                    required
                    placeholder="Full name"
                    value={comp.name}
                    onChange={e => {
                      const u = [...formCompanions]
                      u[idx] = { ...u[idx], name: e.target.value.toUpperCase() }
                      setFormCompanions(u)
                    }}
                    className="input input-bordered input-sm flex-1"
                  />
                  <input
                    type="text"
                    placeholder="Nationality"
                    value={comp.nationality}
                    onChange={e => {
                      const u = [...formCompanions]
                      u[idx] = { ...u[idx], nationality: e.target.value.toUpperCase() }
                      setFormCompanions(u)
                    }}
                    className="input input-bordered input-sm w-24"
                  />
                  <button
                    type="button"
                    onClick={() => setFormCompanions(formCompanions.filter((_, i) => i !== idx))}
                    className="btn btn-ghost btn-xs text-base-content/60 hover:text-error p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

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

      prevProps.hasRooms === nextProps.hasRooms &&
      compsEqual
    )
  }
)