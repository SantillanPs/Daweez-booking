import React, { useState } from 'react'
import { useDashboardData } from './DashboardContext'
import { SyncFeed } from '../types/booking'
import { Copy, Check, RefreshCw, ChevronDown } from 'lucide-react'

export function SettingsTab() {
  const { rooms, feeds, updateFeedUrls } = useDashboardData()

  // Local settings states
  const [activeTab, setActiveTab] = useState('channels')
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

  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(rooms.length > 0 ? rooms[0].id : null)

  return (
    <div className="flex flex-col md:flex-row gap-6 h-full">
      {/* Sidebar Nav */}
      <div className="w-full md:w-56 shrink-0">
        <nav className="flex md:flex-col gap-2 overflow-x-auto no-scrollbar pb-2 md:pb-0">
          <button 
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-brand-primary text-white shadow-sm whitespace-nowrap"
          >
            <RefreshCw className="w-4 h-4" />
            OTA Channels
          </button>
        </nav>
      </div>

      {/* Content Area */}
      <div className="flex-1 min-w-0">
        {/* iCal Feed Subscriptions Card */}
        {activeTab === 'channels' && (
          <div className="bg-card border border-soft rounded-lg overflow-hidden font-sans shadow-sm">
            <div className="px-5 py-4 border-b border-soft flex justify-between items-center">
              <div>
                <h3 className="text-sm font-semibold text-main">iCal Feed Subscriptions</h3>
                <p className="text-xs text-muted mt-1">Manage import and export calendar links for your rooms.</p>
              </div>
              <button onClick={handleSaveFeeds}
                className="bg-brand-primary hover:bg-brand-text text-white text-xs font-medium px-5 py-2 rounded-lg transition-colors cursor-pointer shadow-sm">
                Save Feed URLs
              </button>
            </div>
            <div className="divide-y divide-soft">
              {rooms.map(room => {
                const rf = editingFeeds.filter(f => f.room_id === room.id)
                const air = rf.find(f => f.channel === 'airbnb')
                const bk  = rf.find(f => f.channel === 'booking_com')
                const isExpanded = expandedRoomId === room.id
                
                return (
                  <div key={room.id} className="border-b border-soft last:border-0">
                    <button 
                      onClick={() => setExpandedRoomId(isExpanded ? null : room.id)}
                      className="w-full flex items-center justify-between px-5 py-3 hover:bg-page transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-main">Room {room.room_number}</span>
                        <span className="text-xs text-muted">{room.name}</span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {isExpanded && (
                      <div className="px-5 pb-4 pt-1 space-y-2.5">
                        <div className="grid grid-cols-[80px_1fr] md:grid-cols-[100px_1fr] gap-3 items-center">
                          <span className="text-xs text-brand-primary font-medium text-right">Export URL</span>
                          <div className="relative flex items-center">
                            <input readOnly value={`https://daweez-booking.vercel.app/api/ical/room/${room.room_number}.ics`}
                              className="bg-page border border-soft text-muted py-1.5 pl-3 pr-9 rounded-lg font-mono text-[10px] w-full select-all outline-none" />
                            <button onClick={() => copyToClipboard(`https://daweez-booking.vercel.app/api/ical/room/${room.room_number}.ics`, `export-${room.id}`)}
                              className="absolute right-1.5 p-1 text-muted hover:text-brand-primary transition-colors" title="Copy URL">
                              {copiedFeedId === `export-${room.id}` ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        {air && (
                          <div className="grid grid-cols-[80px_1fr] md:grid-cols-[100px_1fr] gap-3 items-center">
                            <span className="text-xs text-emerald-600 font-medium text-right">Airbnb</span>
                            <div className="relative flex items-center">
                              <input value={air.url} onChange={e => handleFeedUrlChange(air.id, e.target.value)}
                                placeholder="Paste Airbnb iCal URL here..."
                                className="bg-card border border-soft text-main py-1.5 pl-3 pr-9 rounded-lg font-mono text-[10px] w-full focus:outline-none focus:border-brand-primary" />
                              <button onClick={() => copyToClipboard(air.url, `air-${room.id}`)}
                                className="absolute right-1.5 p-1 text-muted hover:text-emerald-600 transition-colors" title="Copy URL">
                                {copiedFeedId === `air-${room.id}` ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
                        )}

                        {bk && (
                          <div className="grid grid-cols-[80px_1fr] md:grid-cols-[100px_1fr] gap-3 items-center">
                            <span className="text-xs text-blue-600 font-medium text-right">Booking.com</span>
                            <div className="relative flex items-center">
                              <input value={bk.url} onChange={e => handleFeedUrlChange(bk.id, e.target.value)}
                                placeholder="Paste Booking.com iCal URL here..."
                                className="bg-card border border-soft text-main py-1.5 pl-3 pr-9 rounded-lg font-mono text-[10px] w-full focus:outline-none focus:border-brand-primary" />
                              <button onClick={() => copyToClipboard(bk.url, `bk-${room.id}`)}
                                className="absolute right-1.5 p-1 text-muted hover:text-blue-600 transition-colors" title="Copy URL">
                                {copiedFeedId === `bk-${room.id}` ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
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
      </div>
    </div>
  )
}
