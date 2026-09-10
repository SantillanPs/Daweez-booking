import React, { useState } from 'react'
import { useDashboardData } from './DashboardContext'
import { SyncFeed, RateConfig } from '../types/booking'
import { Copy, Check, RefreshCw, ChevronDown, BadgeDollarSign, Plus, X } from 'lucide-react'
import { getRateConfig, saveRateConfig } from '../utils/rateConfig'
import { getPaymentAccounts, savePaymentAccounts } from '../utils/paymentAccounts'
import { RoomRatesEditor } from './settings/RoomRatesEditor'
import { NumInput } from './NumInput'

type RatesTab = 'channels' | 'rates'

function MoneyField({ label, value, onChange, prefix = '₱' }: { label: string; value: number; onChange: (v: number) => void; prefix?: string }) {
  return (
    <label className="flex items-center justify-between gap-2 bg-page border border-soft rounded-lg px-3 py-2">
      <span className="text-[11px] text-muted font-medium">{label}</span>
      <div className="flex items-center gap-1">
        {prefix && <span className="text-[11px] text-muted font-bold">{prefix}</span>}
        <NumInput value={value} onChange={onChange}
          className="w-24 bg-card border border-soft text-main px-2 py-1 rounded-md text-sm font-mono focus:outline-none focus:border-brand-primary text-right" />
      </div>
    </label>
  )
}

function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 bg-page border border-soft rounded-lg px-3 py-2">
      <span className="text-[11px] text-muted font-medium">{label}</span>
      <input type="time" value={value} onChange={e => onChange(e.target.value)}
        className="w-24 bg-card border border-soft text-main px-2 py-1 rounded-md text-sm font-mono focus:outline-none focus:border-brand-primary text-right" />
    </label>
  )
}

export function SettingsTab() {
  const { rooms, feeds, updateFeedUrls, updateRoomRate } = useDashboardData()
  const [activeTab, setActiveTab] = useState<RatesTab>('channels')

  // Rates editing
  const [rates, setRates] = useState<RateConfig>(() => getRateConfig())
  const [pay, setPay] = useState(() => getPaymentAccounts())

  // iCal feed editing state
  const [editingFeeds, setEditingFeeds] = useState<SyncFeed[]>([])
  const [copiedFeedId, setCopiedFeedId] = useState<string | null>(null)
  const [prevFeeds, setPrevFeeds] = useState<SyncFeed[]>([])

  if (feeds !== prevFeeds) {
    setPrevFeeds(feeds)
    const completeFeeds: SyncFeed[] = []
    rooms.forEach(room => {
      const roomFeeds = feeds.filter(f => f.room_id === room.id)
      const airFeed = roomFeeds.find(f => f.channel === 'airbnb')
      completeFeeds.push(airFeed || { id: 'feed-ab-' + room.id, room_id: room.id, channel: 'airbnb', url: '', last_synced: null })
      const bcFeed = roomFeeds.find(f => f.channel === 'booking_com')
      completeFeeds.push(bcFeed || { id: 'feed-bc-' + room.id, room_id: room.id, channel: 'booking_com', url: '', last_synced: null })
    })
    setEditingFeeds(completeFeeds)
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedFeedId(id)
      setTimeout(() => setCopiedFeedId(null), 1500)
    })
  }

  const handleFeedUrlChange = (feedId: string, url: string) => {
    setEditingFeeds(prev => prev.map(f => f.id === feedId ? { ...f, url } : f))
  }

  const handleSaveFeeds = async () => {
    try { await updateFeedUrls(editingFeeds); alert('Feed URLs saved!') }
    catch { alert('Failed to save URLs.') }
  }

  const handleSaveRates = () => {
    saveRateConfig(rates)
    savePaymentAccounts(pay)
    alert('Rates saved! The booking form and invoices use these.')
  }

  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(rooms.length > 0 ? rooms[0].id : null)

  return (
    <div className="flex flex-col md:flex-row gap-6 h-full">
      {/* Sidebar Nav */}
      <div className="w-full md:w-56 shrink-0">
        <nav className="flex md:flex-col gap-2 overflow-x-auto no-scrollbar pb-2 md:pb-0">
          <button onClick={() => setActiveTab('channels')}
            className={'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ' + (activeTab === 'channels' ? 'bg-brand-primary text-ink-900 shadow-sm' : 'text-muted hover:bg-softbg')}>
            <RefreshCw className="w-4 h-4" /> OTA Channels
          </button>
          <button onClick={() => setActiveTab('rates')}
            className={'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ' + (activeTab === 'rates' ? 'bg-brand-primary text-ink-900 shadow-sm' : 'text-muted hover:bg-softbg')}>
            <BadgeDollarSign className="w-4 h-4" /> Rates
          </button>
        </nav>
      </div>

      {/* Content Area */}
      <div className="flex-1 min-w-0">
        {activeTab === 'channels' && (
          <div className="bg-card border border-soft rounded-lg overflow-hidden font-sans shadow-sm">
            <div className="px-5 py-4 border-b border-soft flex justify-between items-center">
              <div>
                <h3 className="text-sm font-semibold text-main">iCal Feed Subscriptions</h3>
                <p className="text-xs text-muted mt-1">Manage import and export calendar links for your rooms.</p>
              </div>
              <button onClick={handleSaveFeeds} className="bg-brand-primary hover:bg-gold-500 text-ink-900 text-xs font-medium px-5 py-2 rounded-lg transition-colors cursor-pointer shadow-sm">Save Feed URLs</button>
            </div>
            <div className="divide-y divide-soft">
              {rooms.map(room => {
                const rf = editingFeeds.filter(f => f.room_id === room.id)
                const air = rf.find(f => f.channel === 'airbnb')
                const bk = rf.find(f => f.channel === 'booking_com')
                const isExpanded = expandedRoomId === room.id
                return (
                  <div key={room.id} className="border-b border-soft last:border-0">
                    <button onClick={() => setExpandedRoomId(isExpanded ? null : room.id)} className="w-full flex items-center justify-between px-5 py-3 hover:bg-page transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-main">Room {room.room_number}</span>
                        <span className="text-xs text-muted">{room.name}</span>
                      </div>
                      <ChevronDown className={'w-4 h-4 text-muted transition-transform ' + (isExpanded ? 'rotate-180' : '')} />
                    </button>
                    {isExpanded && (
                      <div className="px-5 pb-4 pt-1 space-y-2.5">
                        <div className="grid grid-cols-[80px_1fr] md:grid-cols-[100px_1fr] gap-3 items-center">
                          <span className="text-xs text-brand-text font-medium text-right">Export URL</span>
                          <div className="relative flex items-center">
                            <input readOnly value={'https://daweez-booking.vercel.app/api/ical/room/' + room.room_number + '.ics'}
                              className="bg-page border border-soft text-muted py-1.5 pl-3 pr-9 rounded-lg font-mono text-[10px] w-full select-all outline-none" />
                            <button onClick={() => copyToClipboard('https://daweez-booking.vercel.app/api/ical/room/' + room.room_number + '.ics', 'export-' + room.id)}
                              className="absolute right-1.5 p-1 text-muted hover:text-brand-text transition-colors" title="Copy URL">
                              {copiedFeedId === 'export-' + room.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                        {air && (
                          <div className="grid grid-cols-[80px_1fr] md:grid-cols-[100px_1fr] gap-3 items-center">
                            <span className="text-xs text-emerald-600 font-medium text-right">Airbnb</span>
                            <div className="relative flex items-center">
                              <input value={air.url} onChange={e => handleFeedUrlChange(air.id, e.target.value)} placeholder="Paste Airbnb iCal URL here..."
                                className="bg-card border border-soft text-main py-1.5 pl-3 pr-9 rounded-lg font-mono text-[10px] w-full focus:outline-none focus:border-brand-primary" />
                              <button onClick={() => copyToClipboard(air.url, 'air-' + room.id)} className="absolute right-1.5 p-1 text-muted hover:text-emerald-600 transition-colors" title="Copy URL">
                                {copiedFeedId === 'air-' + room.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
                        )}
                        {bk && (
                          <div className="grid grid-cols-[80px_1fr] md:grid-cols-[100px_1fr] gap-3 items-center">
                            <span className="text-xs text-blue-600 font-medium text-right">Booking.com</span>
                            <div className="relative flex items-center">
                              <input value={bk.url} onChange={e => handleFeedUrlChange(bk.id, e.target.value)} placeholder="Paste Booking.com iCal URL here..."
                                className="bg-card border border-soft text-main py-1.5 pl-3 pr-9 rounded-lg font-mono text-[10px] w-full focus:outline-none focus:border-brand-primary" />
                              <button onClick={() => copyToClipboard(bk.url, 'bk-' + room.id)} className="absolute right-1.5 p-1 text-muted hover:text-blue-600 transition-colors" title="Copy URL">
                                {copiedFeedId === 'bk-' + room.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {activeTab === 'rates' && (
          <div className="space-y-4">
            <div className="bg-card border border-soft rounded-lg overflow-hidden font-sans shadow-sm">
            <div className="px-5 py-4 border-b border-soft flex justify-between items-center">
              <div>
                <h3 className="text-sm font-semibold text-main">Shared Rates</h3>
                <p className="text-xs text-muted mt-1">Edit the everyday prices the booking form uses — no code needed. These apply to new bookings.</p>
              </div>
              <button onClick={handleSaveRates} className="bg-brand-primary hover:bg-gold-500 text-ink-900 text-xs font-medium px-5 py-2 rounded-lg transition-colors cursor-pointer shadow-sm">Save Rates</button>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
              <MoneyField label="Late / early per hour (rooms)" value={rates.lateEarlyRatePesos} onChange={v => setRates(s => ({ ...s, lateEarlyRatePesos: v }))} />
              <MoneyField label="Late / early cap (hours → 1 night)" value={rates.lateEarlyCapHours} onChange={v => setRates(s => ({ ...s, lateEarlyCapHours: v }))} prefix="" />
              <MoneyField label="Breakfast per guest / night" value={rates.breakfastPrice} onChange={v => setRates(s => ({ ...s, breakfastPrice: v }))} />
              <MoneyField label="Venue hourly (vacation house)" value={rates.venueHourlyRate} onChange={v => setRates(s => ({ ...s, venueHourlyRate: v }))} />
              <MoneyField label="Gazebo / Garden block length (hrs)" value={rates.venueDayBlockHours} onChange={v => setRates(s => ({ ...s, venueDayBlockHours: v }))} prefix="" />
              <MoneyField label="Gazebo / Garden per block (0 = own price)" value={rates.dayBlockRate} onChange={v => setRates(s => ({ ...s, dayBlockRate: v }))} />
              <MoneyField label="Security deposit" value={rates.securityDeposit} onChange={v => setRates(s => ({ ...s, securityDeposit: v }))} />
              <TimeField label="Standard check-in time" value={rates.standardCheckInTime} onChange={v => setRates(s => ({ ...s, standardCheckInTime: v }))} />
              <TimeField label="Standard check-out time" value={rates.standardCheckOutTime} onChange={v => setRates(s => ({ ...s, standardCheckOutTime: v }))} />
              <MoneyField label="Extra foam (per night)" value={rates.foamRate} onChange={v => setRates(s => ({ ...s, foamRate: v }))} />
              <MoneyField label="Extra pillow (per night)" value={rates.pillowRate} onChange={v => setRates(s => ({ ...s, pillowRate: v }))} />
              <MoneyField label="Extra blanket (per night)" value={rates.blanketRate} onChange={v => setRates(s => ({ ...s, blanketRate: v }))} />
              <MoneyField label="Extra towel (per night)" value={rates.towelRate} onChange={v => setRates(s => ({ ...s, towelRate: v }))} />
              <MoneyField label="Big table (event)" value={rates.bigTableRate} onChange={v => setRates(s => ({ ...s, bigTableRate: v }))} />
              <MoneyField label="Small table (event)" value={rates.smallTableRate} onChange={v => setRates(s => ({ ...s, smallTableRate: v }))} />
              <MoneyField label="Chair (event)" value={rates.chairRate} onChange={v => setRates(s => ({ ...s, chairRate: v }))} />
              <MoneyField label="Mineral water" value={rates.mineralWaterRate} onChange={v => setRates(s => ({ ...s, mineralWaterRate: v }))} />
              <MoneyField label="Tent (event)" value={rates.tentRate} onChange={v => setRates(s => ({ ...s, tentRate: v }))} />
              <MoneyField label="Extras: Pension + Vacation House (report)" value={rates.accommodationExtras} onChange={v => setRates(s => ({ ...s, accommodationExtras: v }))} />
              <MoneyField label="Extras: Garden + Gazebo (report)" value={rates.venueExtras} onChange={v => setRates(s => ({ ...s, venueExtras: v }))} />
            </div>
            <p className="px-5 pb-4 text-[11px] text-muted">These are the shared, extra rates. Each room's Regular and Promo prices are set under Room Rates below.</p>
            </div>
            <div className="bg-card border border-soft rounded-lg overflow-hidden font-sans shadow-sm">
              <div className="px-5 py-3 border-b border-soft">
                <h3 className="text-sm font-semibold text-main">Breakfast menu</h3>
                <p className="text-xs text-muted mt-1">What guests can order during their stay, priced per person. Add, rename, or change a price — it applies to new breakfast served.</p>
              </div>
              <div className="p-5 space-y-2">
                {rates.breakfastMenu.map((m, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input value={m.name} onChange={e => setRates(s => ({ ...s, breakfastMenu: s.breakfastMenu.map((mm, idx) => idx === i ? { ...mm, name: e.target.value } : mm) }))} placeholder="Item name (e.g. Bangsilog)"
                      className="flex-1 bg-page border border-soft text-main px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-brand-primary" />
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-muted font-bold">₱</span>
                      <NumInput value={m.price} onChange={v => setRates(s => ({ ...s, breakfastMenu: s.breakfastMenu.map((mm, idx) => idx === i ? { ...mm, price: v } : mm) }))}
                        className="w-24 bg-card border border-soft text-main px-2 py-2 rounded-md text-sm font-mono focus:outline-none focus:border-brand-primary text-right" />
                    </div>
                    <button type="button" onClick={() => setRates(s => ({ ...s, breakfastMenu: s.breakfastMenu.filter((_, idx) => idx !== i) }))} className="text-muted hover:text-danger-600 p-1.5 cursor-pointer" aria-label="Remove item">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => setRates(s => ({ ...s, breakfastMenu: [...s.breakfastMenu, { name: '', price: 0 }] }))}
                  className="text-[11px] font-bold text-gold-700 bg-gold-100 border border-gold-200 hover:bg-gold-100 rounded-md px-2.5 py-1.5 transition-colors cursor-pointer inline-flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> Add item
                </button>
              </div>
            </div>
            <div className="bg-card border border-soft rounded-lg overflow-hidden font-sans shadow-sm">
              <div className="px-5 py-3 border-b border-soft">
                <h3 className="text-sm font-semibold text-main">Payment account</h3>
                <p className="text-xs text-muted mt-1">Where guests send the downpayment. Shows on the booking form, guest portal, and printed statement.</p>
              </div>
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="block text-[11px] font-bold text-muted">GCash account name
                  <input value={pay.gcashName} onChange={e => setPay(s => ({ ...s, gcashName: e.target.value }))} className="mt-1 w-full bg-page border border-soft text-main px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-brand-primary" /></label>
                <label className="block text-[11px] font-bold text-muted">GCash number
                  <input value={pay.gcashNumber} onChange={e => setPay(s => ({ ...s, gcashNumber: e.target.value }))} className="mt-1 w-full bg-page border border-soft text-main px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-brand-primary" /></label>
                <label className="block text-[11px] font-bold text-muted">Bank name (e.g. BPI)
                  <input value={pay.bankName} onChange={e => setPay(s => ({ ...s, bankName: e.target.value }))} className="mt-1 w-full bg-page border border-soft text-main px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-brand-primary" /></label>
                <label className="block text-[11px] font-bold text-muted">Bank account name
                  <input value={pay.bankAccountName} onChange={e => setPay(s => ({ ...s, bankAccountName: e.target.value }))} className="mt-1 w-full bg-page border border-soft text-main px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-brand-primary" /></label>
                <label className="block text-[11px] font-bold text-muted">Bank account number
                  <input value={pay.bankAccountNumber} onChange={e => setPay(s => ({ ...s, bankAccountNumber: e.target.value }))} className="mt-1 w-full bg-page border border-soft text-main px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-brand-primary" /></label>
              </div>
            </div>
            <RoomRatesEditor rooms={rooms} updateRoomRate={updateRoomRate} />
          </div>
        )}
      </div>
    </div>
  )
}
