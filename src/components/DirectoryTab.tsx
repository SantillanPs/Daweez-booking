import React, { useState } from 'react'
import { useDashboardData } from './DashboardContext'
import { PartnerDeal } from '../types/booking'
import * as syncEngine from '../utils/syncEngine'
import { Plus, Trash2, Edit2, Save, X, Building, FileText, Receipt, Coffee, Ban } from 'lucide-react'

export function DirectoryTab() {
  const { rooms, venues, partnerDeals, createPartnerDeal, savePartnerDeals, deletePartnerDeal } = useDashboardData()

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
    other: 'bg-page text-muted border-soft',
  }

  const inputCls = "w-full bg-brand-bg border border-soft text-main px-3 py-2.5 rounded-lg focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-[#B89251]/10 font-medium text-sm transition-all placeholder:text-slate-300"
  const labelCls = "text-[11px] text-muted font-semibold uppercase tracking-wide block mb-1.5"

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-4 font-sans space-y-4 animate-in fade-in duration-200">

      {/* Page Header */}
      <div className="flex justify-between items-center gap-4 border-b border-soft pb-3">
        <div>
          <h2 className="text-base font-bold text-main tracking-tight">Corporate Partners</h2>
          <p className="text-xs text-muted mt-0.5">Manage agency and corporate deal presets, billing rules, and contracted rates.</p>
        </div>
      </div>

      {/* CORPORATE PARTNERS */}
      <div className="space-y-4">
        {/* Form Panel */}
        {isAdding ? (
          <form onSubmit={handleSavePartner} className="bg-card border border-soft rounded-xl shadow-sm overflow-hidden">
            {/* Form Header */}
            <div className="px-5 py-3 border-b border-soft flex items-center justify-between bg-gradient-to-r from-[#FDFBF7] to-white">
              <div>
                <h3 className="text-sm font-bold text-main">
                  {editingDealId ? 'Edit Partner Preset' : 'New Partner Preset'}
                </h3>
                <p className="text-xs text-muted mt-0.5">Configure deal terms, billing rules, and contracted rates.</p>
              </div>
              <button type="button" onClick={resetForm} className="p-2 text-muted hover:text-muted hover:bg-softbg rounded-lg transition-colors cursor-pointer">
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
                    className="w-full bg-brand-bg border border-soft text-main px-3 py-2 rounded-lg focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-[#B89251]/10 font-semibold text-sm transition-all placeholder:text-slate-300"
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
                            : 'bg-card text-muted border-soft hover:border-soft hover:text-main'
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
                              ? 'border-brand-primary bg-brand-bg'
                              : 'border-soft bg-card hover:border-soft'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Icon className={`w-3.5 h-3.5 ${active ? 'text-brand-primary' : 'text-muted'}`} />
                            <span className={`text-xs font-bold ${active ? 'text-brand-text' : 'text-muted'}`}>{opt.title}</span>
                          </div>
                          <p className="text-[10px] text-muted leading-normal">{opt.sub}</p>
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
                              ? 'border-brand-primary bg-brand-bg'
                              : 'border-soft bg-card hover:border-soft'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Icon className={`w-3.5 h-3.5 ${active ? 'text-brand-primary' : 'text-muted'}`} />
                            <span className={`text-xs font-bold ${active ? 'text-brand-text' : 'text-muted'}`}>{opt.title}</span>
                          </div>
                          <p className="text-[10px] text-muted leading-normal">{opt.sub}</p>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* RIGHT: Contracted Rates */}
              <div className="bg-brand-bg border border-brand-border rounded-xl p-3.5 space-y-3 self-start">
                <div>
                  <h4 className="text-xs font-bold text-brand-text uppercase tracking-wide">Contracted Rates</h4>
                  <p className="text-[10px] text-muted mt-0.5 leading-relaxed">
                    Click a room or venue to <strong className="text-muted">include it</strong> in this deal, then enter its rate.
                  </p>
                </div>

                {selectedUnits.size > 0 && (
                  <div className="text-[10px] font-semibold text-brand-text bg-[#9A783E]/8 border border-brand-border rounded-lg px-3 py-2">
                    {selectedUnits.size} unit{selectedUnits.size !== 1 ? 's' : ''} included in this deal
                  </div>
                )}

                <div className="pr-0.5 space-y-2.5">
                  {/* Rooms section */}
                  {rooms.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-bold text-muted uppercase tracking-wide pb-1">Rooms</div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {rooms.map(r => {
                          const included = selectedUnits.has(r.id)
                          return (
                            <div
                              key={r.id}
                              onClick={() => toggleUnit(r.id)}
                              className={`rounded-lg p-2 cursor-pointer transition-all select-none ${
                                included
                                  ? 'bg-card border-2 border-brand-primary shadow-sm'
                                  : 'bg-card/60 border border-soft/60 hover:border-soft opacity-60 hover:opacity-80'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <span className={`text-xs font-bold ${included ? 'text-main' : 'text-muted'}`}>Room {r.room_number}</span>
                                <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-all ${
                                  included ? 'bg-brand-primary border-brand-primary' : 'border-soft'
                                }`}>
                                  {included && <span className="text-white text-[8px] font-black leading-none">✓</span>}
                                </div>
                              </div>
                              <div className={`text-[9px] font-medium mb-2 ${included ? 'text-muted' : 'text-slate-300'}`}>
                                Std ₱{r.base_price.toLocaleString()}
                              </div>
                              {included && (
                                <div className="relative" onClick={e => e.stopPropagation()}>
                                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted">₱</span>
                                  <input
                                    type="number"
                                    placeholder={String(r.base_price)}
                                    value={pRates[r.id] || ''}
                                    onChange={e => {
                                      const val = e.target.value
                                      setPRates(prev => ({ ...prev, [r.id]: val === '' ? 0 : Number(val) }))
                                    }}
                                    className="w-full bg-brand-bg border border-brand-border text-main pl-6 pr-2 py-1.5 rounded-md text-xs focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-[#B89251]/10 font-bold transition-all"
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
                      <div className="text-[10px] font-bold text-muted uppercase tracking-wide pb-1">Venues</div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {venues.map(v => {
                          const included = selectedUnits.has(v.id)
                          return (
                            <div
                              key={v.id}
                              onClick={() => toggleUnit(v.id)}
                              className={`rounded-lg p-2 cursor-pointer transition-all select-none ${
                                included
                                  ? 'bg-card border-2 border-brand-primary shadow-sm'
                                  : 'bg-card/60 border border-soft/60 hover:border-soft opacity-60 hover:opacity-80'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <span className={`text-xs font-bold truncate pr-1 ${included ? 'text-main' : 'text-muted'}`}>{v.name}</span>
                                <div className={`w-3.5 h-3.5 shrink-0 rounded-full border-2 flex items-center justify-center transition-all ${
                                  included ? 'bg-brand-primary border-brand-primary' : 'border-soft'
                                }`}>
                                  {included && <span className="text-white text-[8px] font-black leading-none">✓</span>}
                                </div>
                              </div>
                              <div className={`text-[9px] font-medium mb-2 ${included ? 'text-muted' : 'text-slate-300'}`}>
                                Std ₱{v.base_price.toLocaleString()}
                              </div>
                              {included && (
                                <div className="relative" onClick={e => e.stopPropagation()}>
                                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted">₱</span>
                                  <input
                                    type="number"
                                    placeholder={String(v.base_price)}
                                    value={pRates[v.id] || ''}
                                    onChange={e => {
                                      const val = e.target.value
                                      setPRates(prev => ({ ...prev, [v.id]: val === '' ? 0 : Number(val) }))
                                    }}
                                    className="w-full bg-brand-bg border border-brand-border text-main pl-6 pr-2 py-1.5 rounded-md text-xs focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-[#B89251]/10 font-bold transition-all"
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
            <div className="px-5 py-3 border-t border-soft bg-page/30 flex gap-2 justify-end">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 rounded-lg border border-soft text-muted text-xs font-semibold hover:bg-card transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-brand-primary hover:bg-brand-text text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
              >
                <Save className="w-4 h-4" />
                Save Preset
              </button>
            </div>
          </form>
        ) : (
          /* Partners List Header */
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted font-medium">{partnerDeals.length} partner preset{partnerDeals.length !== 1 ? 's' : ''} configured</p>
            <button
              onClick={() => setIsAdding(true)}
              className="bg-brand-primary hover:bg-brand-text text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Partner Preset
            </button>
          </div>
        )}

        {/* Partners Table */}
        {!isAdding && (
          <div className="bg-card border border-soft rounded-xl overflow-hidden shadow-sm">
            {partnerDeals.length === 0 ? (
              <div className="text-center py-16">
                <Building className="w-8 h-8 text-slate-200 mx-auto mb-3" />
                <p className="text-sm font-semibold text-muted">No partner presets yet</p>
                <p className="text-xs text-slate-300 mt-1">Add your first agency or corporate deal above.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-soft bg-page/40">
                      <th className="px-6 py-3.5 text-[11px] font-semibold text-muted uppercase tracking-wide">Partner</th>
                      <th className="px-6 py-3.5 text-[11px] font-semibold text-muted uppercase tracking-wide">Contact</th>
                      <th className="px-6 py-3.5 text-[11px] font-semibold text-muted uppercase tracking-wide">Billing & Breakfast</th>
                      <th className="px-6 py-3.5 text-[11px] font-semibold text-muted uppercase tracking-wide">Contracted Rates</th>
                      <th className="px-6 py-3.5 text-right text-[11px] font-semibold text-muted uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {partnerDeals.map(d => (
                      <tr key={d.id} className="hover:bg-page/40 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-main text-sm">{d.name}</div>
                          <span className={`inline-flex mt-1 capitalize text-[10px] font-bold px-2 py-0.5 rounded-full border ${typeStyles[d.type] || typeStyles.other}`}>
                            {d.type}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {d.email && <div className="text-muted text-sm">{d.email}</div>}
                          {d.contact_no && <div className="text-muted text-xs font-mono mt-0.5">{d.contact_no}</div>}
                          {!d.email && !d.contact_no && <span className="text-slate-300 text-xs">—</span>}
                        </td>
                        <td className="px-6 py-4 space-y-1.5">
                          <div className="text-xs font-semibold text-main">
                            {d.invoice_type === 'billing' ? 'Billing Statement (GRB)' : 'Guest Folio (GRF)'}
                          </div>
                          {d.breakfast_default === 'with' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-200/60">
                              <Coffee className="w-2.5 h-2.5" /> Breakfast Included
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[10px] font-semibold bg-page text-muted px-2 py-0.5 rounded-md border border-soft/60">
                              No Breakfast
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 max-w-[400px]">
                          <div className="flex flex-wrap gap-1.5">
                            {Object.entries(d.contracted_rates || {}).map(([rid, rate]) => {
                              const roomNum = rooms.find(r => r.id === rid)?.room_number || venues.find(v => v.id === rid)?.name || rid
                              return (
                                <span key={rid} className="inline-flex items-center gap-1 bg-brand-bg border border-brand-border text-brand-text text-[10px] font-bold px-2 py-0.5 rounded-md">
                                  <span>{typeof roomNum === 'number' ? `Rm ${roomNum}` : roomNum}</span>
                                  <span className="text-slate-300">·</span>
                                  <span className="font-extrabold text-main">₱{Number(rate).toLocaleString()}</span>
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
                              className="p-2 text-muted hover:text-brand-primary transition-colors border border-soft rounded-lg hover:border-brand-primary/30 cursor-pointer bg-card hover:bg-brand-bg"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeletePartner(d.id)}
                              className="p-2 text-muted hover:text-rose-600 transition-colors border border-soft rounded-lg hover:border-rose-200 cursor-pointer bg-card hover:bg-rose-50"
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
    </div>
  )
}
