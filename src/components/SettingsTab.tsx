import React, { useState } from 'react'
import { useDashboardData } from './DashboardContext'
import { generateUUID } from '../utils/syncEngine'
import { SyncFeed } from '../types/booking'
import { Copy, Check, Plus, Trash2, Tag, RefreshCw, ChevronDown } from 'lucide-react'

export function SettingsTab() {
  const { rooms, feeds, updateFeedUrls, expenseCategories, createExpenseCategory, deleteExpenseCategory, expenses } = useDashboardData()

  // Local settings states
  const [editingFeeds, setEditingFeeds] = useState<SyncFeed[]>([])
  const [copiedFeedId, setCopiedFeedId] = useState<string | null>(null)
  const [prevFeeds, setPrevFeeds] = useState<SyncFeed[]>([])
  
  const [newCategoryName, setNewCategoryName] = useState('')

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

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCategoryName.trim()) return
    try {
      await createExpenseCategory({ id: `cat-${generateUUID()}`, name: newCategoryName.trim() })
      setNewCategoryName('')
    } catch {
      alert('Failed to add category.')
    }
  }

  const handleDeleteCategory = async (id: string) => {
    const isUsed = expenses.some(exp => exp.category_id === id)
    if (isUsed) {
      alert('Cannot delete this category because it is used by existing expenses. Please re-categorize or delete those expenses first.')
      return
    }
    if (confirm('Are you sure you want to delete this category?')) {
      try {
        await deleteExpenseCategory(id)
      } catch {
        alert('Failed to delete category.')
      }
    }
  }

  const [activeTab, setActiveTab] = useState<'channels' | 'expenses'>('channels')
  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(rooms.length > 0 ? rooms[0].id : null)

  return (
    <div className="flex flex-col md:flex-row gap-6 h-full">
      {/* Sidebar Nav */}
      <div className="w-full md:w-56 shrink-0">
        <nav className="flex md:flex-col gap-2 overflow-x-auto no-scrollbar pb-2 md:pb-0">
          <button 
            onClick={() => setActiveTab('channels')} 
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${activeTab === 'channels' ? 'bg-brand-primary text-white shadow-sm' : 'text-muted hover:bg-softbg'}`}
          >
            <RefreshCw className="w-4 h-4" />
            OTA Channels
          </button>
          <button 
            onClick={() => setActiveTab('expenses')} 
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${activeTab === 'expenses' ? 'bg-brand-primary text-white shadow-sm' : 'text-muted hover:bg-softbg'}`}
          >
            <Tag className="w-4 h-4" />
            Expense Categories
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

        {/* Expense Categories Card */}
        {activeTab === 'expenses' && (
          <div className="bg-card border border-soft rounded-lg overflow-hidden font-sans shadow-sm">
            <div className="px-5 py-4 border-b border-soft flex justify-between items-center">
              <div>
                <h3 className="text-sm font-semibold text-main flex items-center gap-2">
                  <Tag className="w-4 h-4 text-brand-primary" />
                  Expense Categories
                </h3>
                <p className="text-xs text-muted mt-1">Define custom categories for logging your hotel expenses.</p>
              </div>
            </div>
            <div className="p-5 space-y-5">
              <form onSubmit={handleAddCategory} className="flex gap-2">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="e.g. Maintenance, Salary, Supplies"
                  className="flex-1 bg-card border border-soft text-main p-2 rounded-lg text-sm focus:outline-none focus:border-brand-primary"
                />
                <button type="submit" disabled={!newCategoryName.trim()}
                  className="bg-brand-primary hover:bg-brand-text text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1">
                  <Plus className="w-4 h-4" /> Add
                </button>
              </form>

              {expenseCategories.length > 0 ? (
                <div className="border border-soft rounded-lg overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-page text-muted text-xs uppercase">
                      <tr>
                        <th className="px-4 py-3 font-medium">Category Name</th>
                        <th className="px-4 py-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-soft">
                      {expenseCategories.map(cat => (
                        <tr key={cat.id} className="hover:bg-page">
                          <td className="px-4 py-3 text-main font-medium">{cat.name}</td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => handleDeleteCategory(cat.id)}
                              className="text-muted hover:text-rose-500 transition-colors p-1 rounded hover:bg-rose-500/10 cursor-pointer">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-6 bg-page rounded-lg border border-soft border-dashed text-sm text-muted">
                  No expense categories defined yet. Add one above to start categorizing hotel expenses.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
