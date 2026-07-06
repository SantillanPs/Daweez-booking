import React, { useState } from 'react'
import { useDashboardData } from './DashboardContext'
import { SyncFeed } from '../types/booking'
import { Copy, Check } from 'lucide-react'

export function SettingsTab() {
  const { rooms, feeds, updateFeedUrls } = useDashboardData()

  // Local settings states
  const [editingFeeds, setEditingFeeds] = useState<SyncFeed[]>([])
  const [copiedFeedId, setCopiedFeedId] = useState<string | null>(null)
  const [prevFeeds, setPrevFeeds] = useState<SyncFeed[]>([])

  // Adjust state when feeds are loaded/updated from Query
  if (feeds !== prevFeeds) {
    setPrevFeeds(feeds)
    
    // Ensure every room has an Airbnb and Booking.com feed placeholder in the editor
    const completeFeeds: SyncFeed[] = []
    rooms.forEach(room => {
      const roomFeeds = feeds.filter(f => f.room_id === room.id)
      
      const airFeed = roomFeeds.find(f => f.channel === 'airbnb')
      completeFeeds.push(airFeed || {
        id: `feed-ab-${room.id}`,
        room_id: room.id,
        channel: 'airbnb',
        url: '',
        last_synced: null
      })
      
      const bcFeed = roomFeeds.find(f => f.channel === 'booking_com')
      completeFeeds.push(bcFeed || {
        id: `feed-bc-${room.id}`,
        room_id: room.id,
        channel: 'booking_com',
        url: '',
        last_synced: null
      })
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
    try {
      await updateFeedUrls(editingFeeds)
      alert('Feed URLs saved!')
    } catch {
      alert('Failed to save URLs.')
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-800">iCal Feed Subscriptions</h3>
      </div>
      <div className="p-4 space-y-5">
        {rooms.map(room => {
          const rf = editingFeeds.filter(f => f.room_id === room.id)
          const air = rf.find(f => f.channel === 'airbnb')
          const bk  = rf.find(f => f.channel === 'booking_com')
          return (
            <div key={room.id} className="border border-slate-100 rounded-lg p-4 space-y-3">
              <div className="text-xs font-semibold text-slate-800 border-b border-slate-100 pb-2">
                Room {room.room_number}: {room.name}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-2 items-center text-xs">
                <span className="text-[10px] text-[#B89251] font-medium">Export URL</span>
                <input readOnly value={`https://daweez-booking.vercel.app/api/ical/room/${room.room_number}.ics`}
                  className="bg-slate-50 border border-slate-200 text-slate-500 p-2 rounded-lg font-mono text-[10px] w-full select-all outline-none" />
                <button onClick={() => copyToClipboard(`https://daweez-booking.vercel.app/api/ical/room/${room.room_number}.ics`, `export-${room.id}`)}
                  className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1.5 rounded-lg border transition-all ${copiedFeedId === `export-${room.id}` ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                  {copiedFeedId === `export-${room.id}` ? <><Check className="w-3 h-3" />Copied</> : <><Copy className="w-3 h-3" />Copy</>}
                </button>
              </div>
              {air && (
                <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-2 items-center text-xs">
                  <span className="text-[10px] text-emerald-600 font-medium">Airbnb Feed</span>
                  <input value={air.url} onChange={e => handleFeedUrlChange(air.id, e.target.value)}
                    className="bg-white border border-slate-200 text-slate-700 p-2 rounded-lg font-mono text-[10px] w-full focus:outline-none focus:border-[#B89251]" />
                  <button onClick={() => copyToClipboard(air.url, `air-${room.id}`)}
                    className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1.5 rounded-lg border transition-all ${copiedFeedId === `air-${room.id}` ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                    {copiedFeedId === `air-${room.id}` ? <><Check className="w-3 h-3" />Copied</> : <><Copy className="w-3 h-3" />Copy</>}
                  </button>
                </div>
              )}
              {bk && (
                <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-2 items-center text-xs">
                  <span className="text-[10px] text-blue-600 font-medium">Booking.com</span>
                  <input value={bk.url} onChange={e => handleFeedUrlChange(bk.id, e.target.value)}
                    className="bg-white border border-slate-200 text-slate-700 p-2 rounded-lg font-mono text-[10px] w-full focus:outline-none focus:border-[#B89251]" />
                  <button onClick={() => copyToClipboard(bk.url, `bk-${room.id}`)}
                    className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1.5 rounded-lg border transition-all ${copiedFeedId === `bk-${room.id}` ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                    {copiedFeedId === `bk-${room.id}` ? <><Check className="w-3 h-3" />Copied</> : <><Copy className="w-3 h-3" />Copy</>}
                  </button>
                </div>
              )}
            </div>
          )
        })}
        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button onClick={handleSaveFeeds}
            className="bg-[#B89251] hover:bg-[#9A783E] text-white text-xs font-medium px-5 py-2.5 rounded-lg transition-colors">
            Save Feed URLs
          </button>
        </div>
      </div>
    </div>
  )
}
