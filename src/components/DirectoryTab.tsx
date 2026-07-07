import React, { useState, useMemo } from 'react'
import { useDashboardData } from './DashboardContext'
import { PartnerDeal } from '../types/booking'
import * as syncEngine from '../utils/syncEngine'
import { Search, Users, Plus, Trash2, Edit2, Save, X, Building, Award, FileText, Receipt, Coffee, Ban } from 'lucide-react'

export function DirectoryTab() {
  const { rooms, venues, bookings, partnerDeals, createPartnerDeal, savePartnerDeals, deletePartnerDeal } = useDashboardData()

  const [activeTab, setActiveTab] = useState<'guests' | 'partners'>('guests')
  const [guestSearch, setGuestSearch] = useState('')

  const [isAdding, setIsAdding] = useState(false)
  const [editingDealId, setEditingDealId] = useState<string | null>(null)
  const [pName, setPName] = useState('')
  const [pType, setPType] = useState<'agency' | 'company' | 'government' | 'university' | 'other'>('company')
  const [pTIN, setPTIN] = useState('')
  const [pAddress, setPAddress] = useState('')
  const [pContactNo, setPContactNo] = useState('')
  const [pEmail, setPEmail] = useState('')
  const [pVehiclePlate, setPVehiclePlate] = useState('')
  const [pInvoiceType, setPInvoiceType] = useState<'folio' | 'billing'>('folio')
  const [pBreakfastDefault, setPBreakfastDefault] = useState<'w/o' | 'with'>('w/o')
  const [pRates, setPRates] = useState<Record<string, number>>({})
  const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set())

  const guestRecords = useMemo(() => syncEngine.getGuestRecords(bookings), [bookings])

  const filteredGuests = useMemo(() => {
    const q = guestSearch.toLowerCase().trim()
    if (!q) return guestRecords
    return guestRecords.filter(g =>
      g.name.toLowerCase().includes(q) ||
      g.email.toLowerCase().includes(q) ||
      g.phone.toLowerCase().includes(q)
    )
  }, [guestRecords, guestSearch])

  const resetForm = () => {
    setPName(''); setPType('company'); setPTIN(''); setPAddress('')
    setPContactNo(''); setPEmail(''); setPVehiclePlate('')
    setPInvoiceType('folio'); setPBreakfastDefault('w/o'); setPRates({})
    setSelectedUnits(new Set())
    setEditingDealId(null); setIsAdding(false)
  }

  const startEdit = (deal: PartnerDeal) => {
    setPName(deal.name); setPType(deal.type); setPTIN(deal.tin || '')
    setPAddress(deal.address || ''); setPContactNo(deal.contact_no || '')
    setPEmail(deal.email || ''); setPVehiclePlate(deal.vehicle_plate || '')
    setPInvoiceType(deal.invoice_type); setPBreakfastDefault(deal.breakfast_default)
    const rates = deal.contracted_rates || {}
    setPRates(rates)
    setSelectedUnits(new Set(Object.keys(rates).filter(k => (rates[k] ?? 0) > 0)))
    setEditingDealId(deal.id); setIsAdding(true)
  }

  const toggleUnit = (id: string) => {
    setSelectedUnits(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        setPRates(r => { const n = { ...r }; delete n[id]; return n })
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleSavePartner = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pName.trim()) { alert('Partner name is required.'); return }

    const cleanRates: Record<string, number> = {}
    Object.entries(pRates).forEach(([k, v]) => { if (v > 0) cleanRates[k] = Number(v) })

    const dealData: PartnerDeal = {
      id: editingDealId || `partner-${syncEngine.generateUUID()}`,
      name: pName, type: pType, tin: pTIN || undefined,
      address: pAddress || undefined, contact_no: pContactNo || undefined,
      email: pEmail || undefined, vehicle_plate: pVehiclePlate || undefined,
      invoice_type: pInvoiceType, breakfast_default: pBreakfastDefault,
      contracted_rates: cleanRates, created_at: new Date().toISOString()
    }

    try {
      if (editingDealId) {
        await savePartnerDeals(partnerDeals.map(d => d.id === editingDealId ? dealData : d))
      } else {
        await createPartnerDeal(dealData)
      }
      resetForm()
      alert('Partner deal saved!')
    } catch {
      alert('Failed to save partner deal.')
    }
  }

  const handleDeletePartner = async (id: string) => {
    if (!confirm('Are you sure you want to delete this partner profile?')) return
    try { await deletePartnerDeal(id); alert('Partner deal deleted!') }
    catch { alert('Failed to delete partner deal.') }
  }

  const partnerTypes = [
    { value: 'company', label: 'Company' },
    { value: 'agency', label: 'Agency' },
    { value: 'government', label: 'Government' },
    { value: 'university', label: 'University' },
    { value: 'other', label: 'Other' },
  ] as const

  const typeStyles: Record<string, string> = {
    agency: 'bg-blue-50 text-blue-700 border-blue-200/60',
    company: 'bg-purple-50 text-purple-700 border-purple-200/60',
    government: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
    university: 'bg-amber-50 text-amber-700 border-amber-200/60',
    other: 'bg-slate-50 text-slate-600 border-slate-200',
  }

  const inputCls = "w-full bg-[#fcf9f5] border border-slate-200 text-slate-800 px-3 py-2.5 rounded-lg focus:outline-none focus:border-[#B89251] focus:ring-2 focus:ring-[#B89251]/10 font-medium text-sm transition-all placeholder:text-slate-300"
  const labelCls = "text-[11px] text-slate-400 font-semibold uppercase tracking-wide block mb-1.5"

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-4 font-sans space-y-4 animate-in fade-in duration-200">

      {/* Page Header */}
      <div className="flex justify-between items-center gap-4 border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-base font-bold text-slate-800 tracking-tight">Guests & Partners</h2>
          <p className="text-xs text-slate-400 mt-0.5">Guest records, loyalty status, and corporate deal presets.</p>
        </div>
        <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
          <button
            onClick={() => { setActiveTab('guests'); resetForm() }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${activeTab === 'guests' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Users className="w-3.5 h-3.5" />
            Guests <span className={`ml-0.5 text-[10px] font-bold ${activeTab === 'guests' ? 'text-white/70' : 'text-slate-400'}`}>({guestRecords.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('partners')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${activeTab === 'partners' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Building className="w-3.5 h-3.5" />
            Partners <span className={`ml-0.5 text-[10px] font-bold ${activeTab === 'partners' ? 'text-white/70' : 'text-slate-400'}`}>({partnerDeals.length})</span>
          </button>
        </div>
      </div>

      {/* GUEST DIRECTORY */}
      {activeTab === 'guests' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/40 flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              <input
                type="text"
                placeholder="Search by name, email, or phone…"
                value={guestSearch}
                onChange={e => setGuestSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#B89251] focus:ring-2 focus:ring-[#B89251]/10 text-slate-700 placeholder:text-slate-300 transition-all"
              />
            </div>
            <span className="text-xs text-slate-400 font-medium ml-auto">{filteredGuests.length} records</span>
          </div>

          <div className="overflow-x-auto">
            {filteredGuests.length === 0 ? (
              <div className="text-center py-16 text-sm text-slate-400">No guests found.</div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-6 py-3.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Guest Name</th>
                    <th className="px-6 py-3.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Contact</th>
                    <th className="px-6 py-3.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Stays</th>
                    <th className="px-6 py-3.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Status</th>
                    <th className="px-6 py-3.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Last Visit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredGuests.map((g, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-800">{g.name}</td>
                      <td className="px-6 py-4">
                        <div className="text-slate-600 text-sm">{g.email}</div>
                        <div className="text-slate-400 text-xs font-mono mt-0.5">{g.phone}</div>
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-slate-700">{g.visit_count}</td>
                      <td className="px-6 py-4">
                        {g.visit_count >= 1 ? (
                          <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full border border-amber-200/60">
                            <Award className="w-3 h-3" />
                            Loyalty Member
                          </span>
                        ) : (
                          <span className="inline-flex items-center bg-slate-100 text-slate-400 text-xs font-medium px-2.5 py-1 rounded-full">
                            First Visit
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-sm">
                        {new Date(g.last_visit).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* CORPORATE PARTNERS */}
      {activeTab === 'partners' && (
        <div className="space-y-4">

          {/* Form Panel */}
          {isAdding ? (
            <form onSubmit={handleSavePartner} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden max-h-[calc(100vh-140px)] overflow-y-auto">
              {/* Form Header */}
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-[#FDFBF7] to-white sticky top-0 z-10">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    {editingDealId ? 'Edit Partner Preset' : 'New Partner Preset'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Configure deal terms, billing rules, and contracted rates.</p>
                </div>
                <button type="button" onClick={resetForm} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5 items-start">

                {/* LEFT: Partner Details */}
                <div className="space-y-4">

                  {/* Company Name — most important, gets prominence */}
                  <div>
                    <label className={labelCls}>Company / Agency Name <span className="text-rose-400">*</span></label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Agoda Bohol Agency"
                      value={pName}
                      onChange={e => setPName(e.target.value)}
                      className="w-full bg-[#fcf9f5] border border-slate-200 text-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:border-[#B89251] focus:ring-2 focus:ring-[#B89251]/10 font-semibold text-sm transition-all placeholder:text-slate-300"
                    />
                  </div>

                  {/* Partner Type — pill selector */}
                  <div>
                    <label className={labelCls}>Partner Type</label>
                    <div className="flex flex-wrap gap-2">
                      {partnerTypes.map(t => (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => setPType(t.value)}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                            pType === t.value
                              ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                              : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Contact Details Grid */}
                  <div>
                    <label className={labelCls}>Contact Details</label>
                    <div className="grid grid-cols-2 gap-3">
                      <input type="email" placeholder="Email address" value={pEmail} onChange={e => setPEmail(e.target.value)} className={inputCls} />
                      <input type="text" placeholder="Phone number" value={pContactNo} onChange={e => setPContactNo(e.target.value)} className={inputCls} />
                      <input type="text" placeholder="TIN (optional)" value={pTIN} onChange={e => setPTIN(e.target.value)} className={inputCls} />
                      <input type="text" placeholder="Vehicle plate (optional)" value={pVehiclePlate} onChange={e => setPVehiclePlate(e.target.value)} className={inputCls} />
                      <div className="col-span-2">
                        <input type="text" placeholder="Billing address (optional)" value={pAddress} onChange={e => setPAddress(e.target.value)} className={inputCls} />
                      </div>
                    </div>
                  </div>

                  {/* Invoice Style — toggle cards */}
                  <div>
                    <label className={labelCls}>Default Invoice Style</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { value: 'billing', icon: Receipt, title: 'Billing Statement', sub: 'Shows GCash & Landbank details (GRB)' },
                        { value: 'folio', icon: FileText, title: 'Guest Folio', sub: 'No payment ledger shown (GRF)' },
                      ].map(opt => {
                        const Icon = opt.icon
                        const active = pInvoiceType === opt.value
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setPInvoiceType(opt.value as any)}
                            className={`text-left p-2.5 rounded-lg border-2 transition-all cursor-pointer ${
                              active
                                ? 'border-[#B89251] bg-[#FDFBF7]'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <Icon className={`w-3.5 h-3.5 ${active ? 'text-[#B89251]' : 'text-slate-400'}`} />
                              <span className={`text-xs font-bold ${active ? 'text-[#9A783E]' : 'text-slate-600'}`}>{opt.title}</span>
                            </div>
                            <p className="text-[10px] text-slate-400 leading-normal">{opt.sub}</p>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Breakfast — toggle */}
                  <div>
                    <label className={labelCls}>Breakfast Inclusions</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { value: 'with', icon: Coffee, title: 'Breakfast Included', sub: 'Built into contracted rate' },
                        { value: 'w/o', icon: Ban, title: 'No Breakfast', sub: 'Ordered separately (₱150/night)' },
                      ].map(opt => {
                        const Icon = opt.icon
                        const active = pBreakfastDefault === opt.value
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setPBreakfastDefault(opt.value as any)}
                            className={`text-left p-2.5 rounded-lg border-2 transition-all cursor-pointer ${
                              active
                                ? 'border-[#B89251] bg-[#FDFBF7]'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <Icon className={`w-3.5 h-3.5 ${active ? 'text-[#B89251]' : 'text-slate-400'}`} />
                              <span className={`text-xs font-bold ${active ? 'text-[#9A783E]' : 'text-slate-600'}`}>{opt.title}</span>
                            </div>
                            <p className="text-[10px] text-slate-400 leading-normal">{opt.sub}</p>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* RIGHT: Contracted Rates */}
                <div className="bg-[#FDFBF7] border border-[#E5D5C0] rounded-xl p-3.5 space-y-3 self-start">
                  <div>
                    <h4 className="text-xs font-bold text-[#9A783E] uppercase tracking-wide">Contracted Rates</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                      Click a room or venue to <strong className="text-slate-500">include it</strong> in this deal, then enter its rate.
                    </p>
                  </div>

                  {selectedUnits.size > 0 && (
                    <div className="text-[10px] font-semibold text-[#9A783E] bg-[#9A783E]/8 border border-[#E5D5C0] rounded-lg px-3 py-2">
                      {selectedUnits.size} unit{selectedUnits.size !== 1 ? 's' : ''} included in this deal
                    </div>
                  )}

                  <div className="max-h-[calc(100vh-380px)] min-h-[120px] overflow-y-auto pr-0.5 space-y-2.5">
                    {/* Rooms section */}
                    {rooms.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide pb-1">Rooms</div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {rooms.map(r => {
                            const included = selectedUnits.has(r.id)
                            return (
                              <div
                                key={r.id}
                                onClick={() => toggleUnit(r.id)}
                                className={`rounded-lg p-2 cursor-pointer transition-all select-none ${
                                  included
                                    ? 'bg-white border-2 border-[#B89251] shadow-sm'
                                    : 'bg-white/60 border border-slate-200/60 hover:border-slate-300 opacity-60 hover:opacity-80'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className={`text-xs font-bold ${included ? 'text-slate-800' : 'text-slate-500'}`}>Room {r.room_number}</span>
                                  <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-all ${
                                    included ? 'bg-[#B89251] border-[#B89251]' : 'border-slate-300'
                                  }`}>
                                    {included && <span className="text-white text-[8px] font-black leading-none">✓</span>}
                                  </div>
                                </div>
                                <div className={`text-[9px] font-medium mb-2 ${included ? 'text-slate-400' : 'text-slate-300'}`}>
                                  Std ₱{r.base_price.toLocaleString()}
                                </div>
                                {included && (
                                  <div className="relative" onClick={e => e.stopPropagation()}>
                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₱</span>
                                    <input
                                      type="number"
                                      placeholder={String(r.base_price)}
                                      value={pRates[r.id] || ''}
                                      onChange={e => {
                                        const val = e.target.value
                                        setPRates(prev => ({ ...prev, [r.id]: val === '' ? 0 : Number(val) }))
                                      }}
                                      className="w-full bg-[#fcf9f5] border border-[#E5D5C0] text-slate-800 pl-6 pr-2 py-1.5 rounded-md text-xs focus:outline-none focus:border-[#B89251] focus:ring-2 focus:ring-[#B89251]/10 font-bold transition-all"
                                      autoFocus
                                    />
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Venues section */}
                    {venues.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide pb-1">Venues</div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {venues.map(v => {
                            const included = selectedUnits.has(v.id)
                            return (
                              <div
                                key={v.id}
                                onClick={() => toggleUnit(v.id)}
                                className={`rounded-lg p-2 cursor-pointer transition-all select-none ${
                                  included
                                    ? 'bg-white border-2 border-[#B89251] shadow-sm'
                                    : 'bg-white/60 border border-slate-200/60 hover:border-slate-300 opacity-60 hover:opacity-80'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className={`text-xs font-bold truncate pr-1 ${included ? 'text-slate-800' : 'text-slate-500'}`}>{v.name}</span>
                                  <div className={`w-3.5 h-3.5 shrink-0 rounded-full border-2 flex items-center justify-center transition-all ${
                                    included ? 'bg-[#B89251] border-[#B89251]' : 'border-slate-300'
                                  }`}>
                                    {included && <span className="text-white text-[8px] font-black leading-none">✓</span>}
                                  </div>
                                </div>
                                <div className={`text-[9px] font-medium mb-2 ${included ? 'text-slate-400' : 'text-slate-300'}`}>
                                  Std ₱{v.base_price.toLocaleString()}
                                </div>
                                {included && (
                                  <div className="relative" onClick={e => e.stopPropagation()}>
                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₱</span>
                                    <input
                                      type="number"
                                      placeholder={String(v.base_price)}
                                      value={pRates[v.id] || ''}
                                      onChange={e => {
                                        const val = e.target.value
                                        setPRates(prev => ({ ...prev, [v.id]: val === '' ? 0 : Number(val) }))
                                      }}
                                      className="w-full bg-[#fcf9f5] border border-[#E5D5C0] text-slate-800 pl-6 pr-2 py-1.5 rounded-md text-xs focus:outline-none focus:border-[#B89251] focus:ring-2 focus:ring-[#B89251]/10 font-bold transition-all"
                                      autoFocus
                                    />
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Form Footer */}
              <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/30 flex gap-2 justify-end sticky bottom-0">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#B89251] hover:bg-[#9A783E] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                >
                  <Save className="w-4 h-4" />
                  Save Preset
                </button>
              </div>
            </form>
          ) : (
            /* Partners List Header */
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400 font-medium">{partnerDeals.length} partner preset{partnerDeals.length !== 1 ? 's' : ''} configured</p>
              <button
                onClick={() => setIsAdding(true)}
                className="bg-[#B89251] hover:bg-[#9A783E] text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Partner Preset
              </button>
            </div>
          )}

          {/* Partners Table */}
          {!isAdding && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              {partnerDeals.length === 0 ? (
                <div className="text-center py-16">
                  <Building className="w-8 h-8 text-slate-200 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-400">No partner presets yet</p>
                  <p className="text-xs text-slate-300 mt-1">Add your first agency or corporate deal above.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/40">
                        <th className="px-6 py-3.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Partner</th>
                        <th className="px-6 py-3.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Contact</th>
                        <th className="px-6 py-3.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Billing & Breakfast</th>
                        <th className="px-6 py-3.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Contracted Rates</th>
                        <th className="px-6 py-3.5 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {partnerDeals.map(d => (
                        <tr key={d.id} className="hover:bg-slate-50/40 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-bold text-slate-800 text-sm">{d.name}</div>
                            <span className={`inline-flex mt-1 capitalize text-[10px] font-bold px-2 py-0.5 rounded-full border ${typeStyles[d.type] || typeStyles.other}`}>
                              {d.type}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {d.email && <div className="text-slate-600 text-sm">{d.email}</div>}
                            {d.contact_no && <div className="text-slate-400 text-xs font-mono mt-0.5">{d.contact_no}</div>}
                            {!d.email && !d.contact_no && <span className="text-slate-300 text-xs">—</span>}
                          </td>
                          <td className="px-6 py-4 space-y-1.5">
                            <div className="text-xs font-semibold text-slate-700">
                              {d.invoice_type === 'billing' ? 'Billing Statement (GRB)' : 'Guest Folio (GRF)'}
                            </div>
                            {d.breakfast_default === 'with' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-200/60">
                                <Coffee className="w-2.5 h-2.5" /> Breakfast Included
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-[10px] font-semibold bg-slate-50 text-slate-400 px-2 py-0.5 rounded-md border border-slate-200/60">
                                No Breakfast
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 max-w-[400px]">
                            <div className="flex flex-wrap gap-1.5">
                              {Object.entries(d.contracted_rates || {}).map(([rid, rate]) => {
                                const roomNum = rooms.find(r => r.id === rid)?.room_number || venues.find(v => v.id === rid)?.name || rid
                                return (
                                  <span key={rid} className="inline-flex items-center gap-1 bg-[#FDFBF7] border border-[#E5D5C0] text-[#9A783E] text-[10px] font-bold px-2 py-0.5 rounded-md">
                                    <span>{typeof roomNum === 'number' ? `Rm ${roomNum}` : roomNum}</span>
                                    <span className="text-slate-300">·</span>
                                    <span className="font-extrabold text-slate-800">₱{Number(rate).toLocaleString()}</span>
                                  </span>
                                )
                              })}
                              {Object.keys(d.contracted_rates || {}).length === 0 && (
                                <span className="text-slate-300 text-xs">Standard rates</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => startEdit(d)}
                                className="p-2 text-slate-400 hover:text-[#B89251] transition-colors border border-slate-200 rounded-lg hover:border-[#B89251]/30 cursor-pointer bg-white hover:bg-[#FDFBF7]"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeletePartner(d.id)}
                                className="p-2 text-slate-400 hover:text-rose-600 transition-colors border border-slate-200 rounded-lg hover:border-rose-200 cursor-pointer bg-white hover:bg-rose-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
