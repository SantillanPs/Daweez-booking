import React, { useState, useMemo } from 'react'
import { useDashboardData } from './DashboardContext'
import { PartnerDeal } from '../types/booking'
import * as syncEngine from '../utils/syncEngine'
import { Search, Users, Plus, Trash2, Edit2, Save, X, Building, Award } from 'lucide-react'

export function DirectoryTab() {
  const { rooms, venues, bookings, partnerDeals, createPartnerDeal, savePartnerDeals, deletePartnerDeal } = useDashboardData()

  // Tab state: 'guests' or 'partners'
  const [activeTab, setActiveTab] = useState<'guests' | 'partners'>('guests')

  // Search state for individual guests
  const [guestSearch, setGuestSearch] = useState('')

  // Partner Deals form states
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

  // Compile guest records
  const guestRecords = useMemo(() => {
    return syncEngine.getGuestRecords(bookings)
  }, [bookings])

  // Filter guest records
  const filteredGuests = useMemo(() => {
    const q = guestSearch.toLowerCase().trim()
    if (!q) return guestRecords
    return guestRecords.filter(g =>
      g.name.toLowerCase().includes(q) ||
      g.email.toLowerCase().includes(q) ||
      g.phone.toLowerCase().includes(q)
    )
  }, [guestRecords, guestSearch])

  // Reset partner form
  const resetForm = () => {
    setPName('')
    setPType('company')
    setPTIN('')
    setPAddress('')
    setPContactNo('')
    setPEmail('')
    setPVehiclePlate('')
    setPInvoiceType('folio')
    setPBreakfastDefault('w/o')
    setPRates({})
    setEditingDealId(null)
    setIsAdding(false)
  }

  // Start edit partner
  const startEdit = (deal: PartnerDeal) => {
    setPName(deal.name)
    setPType(deal.type)
    setPTIN(deal.tin || '')
    setPAddress(deal.address || '')
    setPContactNo(deal.contact_no || '')
    setPEmail(deal.email || '')
    setPVehiclePlate(deal.vehicle_plate || '')
    setPInvoiceType(deal.invoice_type)
    setPBreakfastDefault(deal.breakfast_default)
    setPRates(deal.contracted_rates || {})
    setEditingDealId(deal.id)
    setIsAdding(true)
  }

  const handleSavePartner = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pName.trim()) {
      alert('Partner name is required.')
      return
    }

    const cleanRates: Record<string, number> = {}
    Object.entries(pRates).forEach(([k, v]) => {
      if (v > 0) cleanRates[k] = Number(v)
    })

    const dealData: PartnerDeal = {
      id: editingDealId || `partner-${syncEngine.generateUUID()}`,
      name: pName,
      type: pType,
      tin: pTIN || undefined,
      address: pAddress || undefined,
      contact_no: pContactNo || undefined,
      email: pEmail || undefined,
      vehicle_plate: pVehiclePlate || undefined,
      invoice_type: pInvoiceType,
      breakfast_default: pBreakfastDefault,
      contracted_rates: cleanRates,
      created_at: new Date().toISOString()
    }

    try {
      if (editingDealId) {
        const updated = partnerDeals.map(d => d.id === editingDealId ? dealData : d)
        await savePartnerDeals(updated)
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
    try {
      await deletePartnerDeal(id)
      alert('Partner deal deleted!')
    } catch {
      alert('Failed to delete partner deal.')
    }
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 font-sans space-y-6 animate-in fade-in duration-200">
      
      {/* Tab Switcher & Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Guests & Partners Registry</h2>
          <p className="text-xs text-slate-400 font-medium">Manage walk-in guest records, loyalty status, and corporate preset deals.</p>
        </div>
        
        {/* Switcher tabs */}
        <div className="flex bg-slate-105 p-0.5 rounded-lg border border-slate-200">
          <button
            onClick={() => { setActiveTab('guests'); resetForm(); }}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${activeTab === 'guests' ? 'bg-white text-slate-800 shadow-sm border border-slate-200/20' : 'text-slate-500 hover:text-slate-800 bg-transparent border-none'}`}
          >
            <Users className="w-3.5 h-3.5" />
            Guest Directory ({guestRecords.length})
          </button>
          <button
            onClick={() => setActiveTab('partners')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${activeTab === 'partners' ? 'bg-white text-slate-800 shadow-sm border border-slate-200/20' : 'text-slate-500 hover:text-slate-800 bg-transparent border-none'}`}
          >
            <Building className="w-3.5 h-3.5" />
            Corporate Partners ({partnerDeals.length})
          </button>
        </div>
      </div>

      {/* TAB CONTENT: GUEST DIRECTORY */}
      {activeTab === 'guests' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          {/* Table Search bar */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-4">
            <div className="relative max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search guests by name, email, phone..."
                value={guestSearch}
                onChange={e => setGuestSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-[#B89251] focus:ring-1 focus:ring-[#e6c280] font-medium"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            {filteredGuests.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-400 font-medium">
                No guest records found matching the search criteria.
              </div>
            ) : (
              <table className="w-full text-xs text-left text-slate-500">
                <thead className="text-[10px] uppercase bg-slate-50/50 text-slate-400 tracking-wider">
                  <tr className="border-b border-slate-100">
                    <th className="px-6 py-3">Guest Name</th>
                    <th className="px-6 py-3">Contact Details</th>
                    <th className="px-6 py-3">Stay Count</th>
                    <th className="px-6 py-3">Loyalty Program</th>
                    <th className="px-6 py-3">Last Visit Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150">
                  {filteredGuests.map((g, i) => (
                    <tr key={i} className="hover:bg-slate-50/30">
                      <td className="px-6 py-3.5 font-bold text-slate-800 text-[13px]">{g.name}</td>
                      <td className="px-6 py-3.5 space-y-0.5">
                        <div className="text-slate-600 font-medium">{g.email}</div>
                        <div className="text-slate-400 text-[10px] font-mono">{g.phone}</div>
                      </td>
                      <td className="px-6 py-3.5 font-mono font-bold text-slate-700 text-[13px]">
                        {g.visit_count} stay{g.visit_count !== 1 ? 's' : ''}
                      </td>
                      <td className="px-6 py-3.5">
                        {g.visit_count >= 1 ? (
                          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-amber-200/50">
                            <Award className="w-3 h-3 text-[#B89251]" />
                            Loyalty Member (10% Off)
                          </span>
                        ) : (
                          <span className="inline-flex items-center bg-slate-100 text-slate-400 text-[10px] font-medium px-2 py-0.5 rounded-full">
                            First-time Guest
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 font-mono text-slate-500 font-medium">
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

      {/* TAB CONTENT: CORPORATE PARTNERS */}
      {activeTab === 'partners' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Agency & Partner Deals Preset Configuration</h3>
            {!isAdding && (
              <button
                onClick={() => setIsAdding(true)}
                className="bg-[#B89251] hover:bg-[#9A783E] text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Partner Preset
              </button>
            )}
          </div>

          <div className="p-4">
            {isAdding ? (
              <form onSubmit={handleSavePartner} className="space-y-4 max-w-2xl">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h4 className="text-xs font-bold text-[#9A783E] uppercase tracking-wider">
                    {editingDealId ? 'Edit Partner Preset' : 'New Partner Preset'}
                  </h4>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-slate-400 hover:text-slate-700 transition-colors p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                  <div>
                    <label className="text-[10px] text-slate-500 font-medium block mb-1">Company / Agency Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. GETZ PHARMA (PHIL.), INC."
                      value={pName}
                      onChange={e => setPName(e.target.value)}
                      className="w-full bg-[#fcf9f5] border border-slate-200 text-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:border-[#B89251] focus:ring-1 focus:ring-[#e6c280] font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-medium block mb-1">Partner Type</label>
                    <select
                      value={pType}
                      onChange={e => setPType(e.target.value as any)}
                      className="w-full bg-[#fcf9f5] border border-slate-200 text-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:border-[#B89251] focus:ring-1 focus:ring-[#e6c280] font-medium appearance-none cursor-pointer"
                    >
                      <option value="company">Corporate Company</option>
                      <option value="agency">Travel Agency</option>
                      <option value="government">Government Department</option>
                      <option value="university">University / School</option>
                      <option value="other">Other / Custom</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-medium block mb-1">TIN (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. 000-123-456-000"
                      value={pTIN}
                      onChange={e => setPTIN(e.target.value)}
                      className="w-full bg-[#fcf9f5] border border-slate-200 text-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:border-[#B89251] focus:ring-1 focus:ring-[#e6c280] font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-550 font-medium block mb-1">Contact No. (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. 0917-xxx-xxxx"
                      value={pContactNo}
                      onChange={e => setPContactNo(e.target.value)}
                      className="w-full bg-[#fcf9f5] border border-slate-200 text-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:border-[#B89251] focus:ring-1 focus:ring-[#e6c280] font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-medium block mb-1">Email Address (Optional)</label>
                    <input
                      type="email"
                      placeholder="e.g. finance@getzpharma.com"
                      value={pEmail}
                      onChange={e => setPEmail(e.target.value)}
                      className="w-full bg-[#fcf9f5] border border-slate-200 text-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:border-[#B89251] focus:ring-1 focus:ring-[#e6c280] font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-medium block mb-1">Default Vehicle Plate (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. N/A or ABC-1234"
                      value={pVehiclePlate}
                      onChange={e => setPVehiclePlate(e.target.value)}
                      className="w-full bg-[#fcf9f5] border border-slate-200 text-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:border-[#B89251] focus:ring-1 focus:ring-[#e6c280] font-medium"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] text-slate-500 font-medium block mb-1">Billing Address (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. BGC, Pasig City, Metro Manila"
                      value={pAddress}
                      onChange={e => setPAddress(e.target.value)}
                      className="w-full bg-[#fcf9f5] border border-slate-200 text-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:border-[#B89251] focus:ring-1 focus:ring-[#e6c280] font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-medium block mb-1">Default Invoice Style</label>
                    <select
                      value={pInvoiceType}
                      onChange={e => setPInvoiceType(e.target.value as any)}
                      className="w-full bg-[#fcf9f5] border border-slate-200 text-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:border-[#B89251] focus:ring-1 focus:ring-[#e6c280] font-medium appearance-none cursor-pointer"
                    >
                      <option value="folio">Guest Folio (No payment ledger)</option>
                      <option value="billing">Guest Registration & Billing (Show GCash/Landbank)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-medium block mb-1">Breakfast Inclusions</label>
                    <select
                      value={pBreakfastDefault}
                      onChange={e => setPBreakfastDefault(e.target.value as any)}
                      className="w-full bg-[#fcf9f5] border border-slate-200 text-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:border-[#B89251] focus:ring-1 focus:ring-[#e6c280] font-medium appearance-none cursor-pointer"
                    >
                      <option value="w/o">Without Breakfast (breakfast order costs ₱150/night)</option>
                      <option value="with">With Breakfast (included in room contracted rate)</option>
                    </select>
                  </div>
                </div>

                {/* contracted price mapping */}
                <div className="pt-2">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-2">Pre-negotiated Room Rates (PHP)</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {rooms.map(r => (
                      <div key={r.id} className="border border-slate-100 rounded-lg p-2.5 bg-slate-50/50 flex flex-col justify-between">
                        <span className="text-[10px] font-bold text-slate-700">Room {r.room_number}</span>
                        <span className="text-[9px] text-slate-400 font-medium block mb-1.5">Std: ₱{r.base_price.toLocaleString()}</span>
                        <input
                          type="number"
                          placeholder="Default standard"
                          value={pRates[r.id] || ''}
                          onChange={e => {
                            const val = e.target.value
                            setPRates(prev => ({
                              ...prev,
                              [r.id]: val === '' ? 0 : Number(val)
                            }))
                          }}
                          className="w-full bg-white border border-slate-200 text-slate-800 px-2 py-1 rounded text-xs focus:outline-none focus:border-[#B89251]"
                        />
                      </div>
                    ))}
                    {venues.map(v => (
                      <div key={v.id} className="border border-slate-100 rounded-lg p-2.5 bg-slate-50/50 flex flex-col justify-between">
                        <span className="text-[10px] font-bold text-slate-700">{v.name}</span>
                        <span className="text-[9px] text-slate-400 font-medium block mb-1.5">Std: ₱{v.base_price.toLocaleString()}</span>
                        <input
                          type="number"
                          placeholder="Default standard"
                          value={pRates[v.id] || ''}
                          onChange={e => {
                            const val = e.target.value
                            setPRates(prev => ({
                              ...prev,
                              [v.id]: val === '' ? 0 : Number(val)
                            }))
                          }}
                          className="w-full bg-white border border-slate-200 text-slate-800 px-2 py-1 rounded text-xs focus:outline-none focus:border-[#B89251]"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="border border-slate-200 text-slate-500 text-xs font-semibold px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-[#B89251] hover:bg-[#9A783E] text-white text-xs font-semibold px-5 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save Preset
                  </button>
                </div>
              </form>
            ) : partnerDeals.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400 font-medium">
                No partner deals or corporate accounts configured yet. Click "Add Partner Preset" to begin.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left text-slate-500">
                  <thead className="text-[10px] uppercase bg-slate-50/70 text-slate-400 tracking-wider">
                    <tr>
                      <th className="px-4 py-2.5">Name</th>
                      <th className="px-4 py-2.5">Type</th>
                      <th className="px-4 py-2.5">Contact Details</th>
                      <th className="px-4 py-2.5">Billing Preference</th>
                      <th className="px-4 py-2.5">Contract Rates Override</th>
                      <th className="px-4 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {partnerDeals.map(d => (
                      <tr key={d.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-semibold text-slate-800">{d.name}</td>
                        <td className="px-4 py-3 capitalize text-slate-500">{d.type}</td>
                        <td className="px-4 py-3">
                          {d.email && <div className="text-slate-600">{d.email}</div>}
                          {d.contact_no && <div className="text-slate-400 text-[10px]">{d.contact_no}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="capitalize text-slate-600">{d.invoice_type} invoice</div>
                          <div className="text-[10px] text-slate-400 font-medium">Breakfast: {d.breakfast_default}</div>
                        </td>
                        <td className="px-4 py-3 max-w-[200px]">
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(d.contracted_rates || {}).map(([rid, rate]) => {
                              const roomNum = rooms.find(r => r.id === rid)?.room_number || venues.find(v => v.id === rid)?.name || rid
                              return (
                                <span key={rid} className="bg-slate-100 text-slate-600 text-[9px] px-1.5 py-0.5 rounded font-mono">
                                  {typeof roomNum === 'number' ? `Rm ${roomNum}` : roomNum}: ₱{rate}
                                </span>
                              )
                            })}
                            {Object.keys(d.contracted_rates || {}).length === 0 && (
                              <span className="text-slate-400 text-[10px]">None (standard rates)</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => startEdit(d)}
                              className="p-1.5 text-slate-500 hover:text-[#B89251] transition-colors border border-slate-100 rounded hover:border-[#B89251]/20 cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeletePartner(d.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors border border-slate-100 rounded hover:border-rose-100 cursor-pointer"
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
        </div>
      )}
    </div>
  )
}
