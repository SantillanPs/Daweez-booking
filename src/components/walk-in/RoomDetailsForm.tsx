import React from 'react'
import { Companion, PartnerDeal } from '../../types/booking'
import { User, Phone, Mail, Users, ChevronDown, Trash2, Plus, CheckCircle2 } from 'lucide-react'

interface RoomDetailsFormProps {
  formStatus: 'confirmed' | 'blocked'
  formGuestName: string
  setFormGuestName: (val: string) => void
  formGuestEmail: string
  setFormGuestEmail: (val: string) => void
  formGuestPhone: string
  setFormGuestPhone: (val: string) => void
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
  formVehiclePlate: string
  setFormVehiclePlate: (val: string) => void
  formTIN: string
  setFormTIN: (val: string) => void
  formAddress: string
  setFormAddress: (val: string) => void
  onSelectPartnerDeal: (deal: PartnerDeal | null) => void
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
    formCompanions,
    setFormCompanions,
    showCompanions,
    setShowCompanions,
    hasRooms,
    partnerDeals,
    formPartnerDealId,
    formCompanyName,
    setFormCompanyName,
    formVehiclePlate,
    setFormVehiclePlate,
    formTIN,
    setFormTIN,
    formAddress,
    setFormAddress,
    onSelectPartnerDeal
  }: RoomDetailsFormProps) => {
    if (formStatus === 'blocked') {
      return (
        <div className="p-4 bg-page border border-soft/60 rounded text-xs text-muted space-y-1.5 font-sans">
          <p className="font-bold text-main flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-brand-primary" /> Block Dates
          </p>
          <p className="text-[11px] leading-normal">
            This will block out the calendar. It won't create a real booking or charge money.
          </p>
        </div>
      )
    }

    return (
      <div className="bg-card p-4 rounded-md border border-soft/60 shadow-sm space-y-3.5 animate-in fade-in duration-200 font-sans">
        <h4 className="text-[9px] font-bold text-brand-text tracking-widest uppercase border-b border-soft pb-1.5">
          2. Guest Details
        </h4>
        
        <div className="space-y-3">


          {/* Primary Guest Name */}
          <div>
            <label className="text-[10px] text-muted font-medium block mb-1">Guest Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input 
                type="text" 
                required 
                placeholder="Guest full name" 
                value={formGuestName} 
                onChange={e => setFormGuestName(e.target.value)}
                className="w-full bg-brand-bg border border-soft text-main pl-9 pr-3 py-1.5 rounded text-xs focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-ring transition-all font-medium" 
              />
            </div>
          </div>


          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-soft">
            <div>
              <label className="text-[10px] text-muted font-medium block mb-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input 
                  type="email" 
                  placeholder="guest@domain.com" 
                  value={formGuestEmail} 
                  onChange={e => setFormGuestEmail(e.target.value)}
                  className="w-full bg-brand-bg border border-soft text-main pl-9 pr-3 py-1.5 rounded text-xs focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-ring transition-all font-medium" 
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-muted font-medium block mb-1">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input 
                  type="text" 
                  placeholder="09xx-xxx-xxxx" 
                  value={formGuestPhone} 
                  onChange={e => setFormGuestPhone(e.target.value)}
                  className="w-full bg-brand-bg border border-soft text-main pl-9 pr-3 py-1.5 rounded text-xs focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-ring transition-all font-medium" 
                />
              </div>
            </div>
          </div>
          
          {/* Companions Registry */}
          <div className="pt-2 border-t border-soft col-span-1 sm:col-span-2">
            <button 
              type="button" 
              onClick={() => setShowCompanions(!showCompanions)}
              className="flex items-center justify-between w-full text-[10px] text-muted font-semibold uppercase tracking-wider hover:text-main transition-colors py-1 cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-brand-primary" /> Other Guests
                {formCompanions.length > 0 && (
                  <span className="bg-brand-bg border border-brand-border text-brand-text text-[9px] font-bold px-2 py-0.5 rounded ml-1">
                    {formCompanions.length} Guest{formCompanions.length !== 1 ? 's' : ''}
                  </span>
                )}
              </span>
              <ChevronDown className={`w-4 h-4 text-muted transition-transform duration-200 ${showCompanions ? 'rotate-180' : ''}`} />
            </button>

            {showCompanions && (
              <div className="space-y-2 pt-2 animate-in slide-in-from-top-1 duration-150">
                {formCompanions.length === 0 && (
                  <p className="text-[10px] text-muted py-3 italic text-center bg-page/50 rounded border border-dashed border-soft">
                    No other guests added. Click below to add.
                  </p>
                )}
                {formCompanions.map((comp, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-page p-2 rounded border border-soft/60">
                    <input 
                      type="text" 
                      required 
                      placeholder="Full name" 
                      value={comp.name}
                      onChange={e => { 
                        const u = [...formCompanions]
                        u[idx] = { ...u[idx], name: e.target.value }
                        setFormCompanions(u) 
                      }}
                      className="flex-1 bg-card border border-soft text-main px-2 py-1 rounded text-[11px] focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-ring" 
                    />
                    <select 
                      value={comp.gender}
                      onChange={e => { 
                        const u = [...formCompanions]
                        u[idx] = { ...u[idx], gender: e.target.value as 'male' | 'female' }
                        setFormCompanions(u) 
                      }}
                      className="bg-card border border-soft text-main px-2 py-1 rounded text-[11px] focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-ring"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                    <button 
                      type="button" 
                      onClick={() => setFormCompanions(formCompanions.filter((_, i) => i !== idx))}
                      className="text-muted hover:text-rose-500 transition-colors p-1.5 shrink-0 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button 
                  type="button" 
                  onClick={() => setFormCompanions([...formCompanions, { name: '', gender: 'male' }])}
                  className="text-[10px] text-brand-primary hover:text-brand-text font-bold flex items-center gap-1 transition-colors mt-1 select-none cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Guest
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    )
  },
  (prevProps, nextProps) => {
    const compsEqual = prevProps.formCompanions.length === nextProps.formCompanions.length &&
      prevProps.formCompanions.every((c, i) => c.name === nextProps.formCompanions[i].name && c.gender === nextProps.formCompanions[i].gender)
    
    return (
      prevProps.formStatus === nextProps.formStatus &&
      prevProps.formGuestName === nextProps.formGuestName &&
      prevProps.formGuestEmail === nextProps.formGuestEmail &&
      prevProps.formGuestPhone === nextProps.formGuestPhone &&
      prevProps.showCompanions === nextProps.showCompanions &&

      prevProps.hasRooms === nextProps.hasRooms &&
      compsEqual
    )
  }
)
