import React, { useState } from 'react'
import { useDashboardData } from './DashboardContext'
import { RateConfig, PaymentAccounts } from '../types/booking'
import { BadgeDollarSign, BedDouble, Loader2, RefreshCw, Save } from 'lucide-react'
import { getRateConfig, saveRateConfig } from '../utils/rateConfig'
import { getPaymentAccounts, savePaymentAccounts } from '../utils/paymentAccounts'
import { RoomRatesEditor } from './settings/RoomRatesEditor'
import { RoomDraft, roomDraft } from './settings/roomDraft'
import { BreakfastMenuEditor } from './settings/BreakfastMenuEditor'
import { OtherCharges } from './settings/OtherCharges'
import { ChannelFeeds } from './settings/ChannelFeeds'
import { showToast } from '../utils/toast'

type SettingsTabKey = 'rooms' | 'charges' | 'channels'

const TABS: { key: SettingsTabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'rooms', label: 'Rooms & prices', icon: <BedDouble className="w-4 h-4" /> },
  { key: 'charges', label: 'Other charges', icon: <BadgeDollarSign className="w-4 h-4" /> },
  { key: 'channels', label: 'Channels', icon: <RefreshCw className="w-4 h-4" /> },
]

/** How many fields differ between what is on screen and what is stored. */
function countDiffs<T extends object>(draft: T, saved: T): number {
  return (Object.keys(draft) as (keyof T)[])
    .filter(k => JSON.stringify(draft[k]) !== JSON.stringify(saved[k]))
    .length
}

/**
 * Settings (the owner's design, 2026-09).
 *
 * THREE tabs — Rooms & prices · Other charges · Channels — and **ONE save bar** at the
 * foot of the page, which appears only once something has actually been typed and says
 * how many changes are waiting. That replaced a page with twenty loose boxes, three
 * different save models (a global button, a button per room, and payment details saved
 * silently by the first one) and two leftovers of the retired per-person breakfast rule.
 *
 * The room prices and the shared figures are held here as a DRAFT so one press saves
 * them together; the room rows go through `updateRoomRate` / `updateRoomBreakfastPrice`
 * / `updateRoomHourPrices`, the shared figures through `saveRateConfig` /
 * `savePaymentAccounts`.
 */
export function SettingsTab() {
  const { rooms, feeds, updateFeedUrls, updateRoomRate, updateRoomBreakfastPrice, updateRoomHourPrices } = useDashboardData()
  const [tab, setTab] = useState<SettingsTabKey>('rooms')

  const [rates, setRates] = useState<RateConfig>(() => getRateConfig())
  const [savedRates, setSavedRates] = useState<RateConfig>(() => getRateConfig())
  const [pay, setPay] = useState<PaymentAccounts>(() => getPaymentAccounts())
  const [savedPay, setSavedPay] = useState<PaymentAccounts>(() => getPaymentAccounts())
  const [roomEdits, setRoomEdits] = useState<Record<string, Partial<RoomDraft>>>({})
  const [saving, setSaving] = useState(false)

  const changes = countDiffs(rates, savedRates) + countDiffs(pay, savedPay) + Object.keys(roomEdits).length

  const editRoom = (roomId: string, patch: Partial<RoomDraft>) =>
    setRoomEdits(prev => ({ ...prev, [roomId]: { ...prev[roomId], ...patch } }))

  const handleSave = async () => {
    if (saving || changes === 0) return
    setSaving(true)
    try {
      saveRateConfig(rates)
      savePaymentAccounts(pay)
      for (const roomId of Object.keys(roomEdits)) {
        const room = rooms.find(r => r.id === roomId)
        if (!room) continue
        const d = roomDraft(room, roomEdits)
        await updateRoomRate(roomId, d.price, d.price)
        if (updateRoomBreakfastPrice) await updateRoomBreakfastPrice(roomId, d.breakfast)
        if (updateRoomHourPrices) await updateRoomHourPrices(roomId, d.hour3, d.hour6, d.hour12)
      }
      setSavedRates(rates)
      setSavedPay(pay)
      setRoomEdits({})
      showToast('Saved. The booking form, the board and the printed bill use these.')
    } catch {
      showToast('Could not save the room prices. Please try again.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col md:flex-row gap-6 h-full">
      <div className="w-full md:w-52 shrink-0">
        <nav className="flex md:flex-col gap-2 overflow-x-auto no-scrollbar pb-2 md:pb-0">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors cursor-pointer ' +
                (tab === t.key ? 'bg-brand-primary text-ink-900 shadow-sm' : 'text-muted hover:bg-softbg')}>
              {t.icon} {t.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 min-w-0 pb-16">
        {tab === 'rooms' && (
          <div className="space-y-4">
            <header>
              <h2 className="text-base font-semibold text-main">Rooms &amp; prices</h2>
              <p className="text-xs text-muted mt-1">One price per room, its breakfast, and what it is sold for by the hour.</p>
            </header>
            <RoomRatesEditor rooms={rooms} edits={roomEdits} onEdit={editRoom} />
            <BreakfastMenuEditor items={rates.breakfastMenu} onChange={items => setRates(s => ({ ...s, breakfastMenu: items }))} />
          </div>
        )}

        {tab === 'charges' && (
          <div className="space-y-4">
            <header>
              <h2 className="text-base font-semibold text-main">Other charges</h2>
              <p className="text-xs text-muted mt-1">The venues, the arrival and departure rules, what a guest can add, and where they send the money.</p>
            </header>
            <OtherCharges rates={rates} onRate={patch => setRates(s => ({ ...s, ...patch }))} pay={pay} onPay={patch => setPay(s => ({ ...s, ...patch }))} />
          </div>
        )}

        {tab === 'channels' && (
          <div className="space-y-4">
            <header>
              <h2 className="text-base font-semibold text-main">Channels</h2>
              <p className="text-xs text-muted mt-1">The calendar links Airbnb and Booking.com read and write.</p>
            </header>
            <ChannelFeeds rooms={rooms} feeds={feeds} onSave={async list => {
              try { await updateFeedUrls(list); showToast('Feed URLs saved.') }
              catch { showToast('Could not save the feed URLs.', 'error') }
            }} />
          </div>
        )}
      </div>

      {/* ONE save bar (the owner's ruling): it appears only once something has been
          typed, and it says how many changes are waiting. Kept in the LIGHT shell like
          the rest of the staff app — no dark bar floating over a light page. */}
      {changes > 0 && (
        <div className="fixed bottom-16 md:bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-card border border-gold-300 rounded-full pl-4 pr-1.5 py-1.5 shadow-softLg">
          <span className="text-[12px] font-semibold text-main">
            {changes} change{changes === 1 ? '' : 's'} not saved
          </span>
          <button type="button" onClick={() => void handleSave()} disabled={saving}
            className="inline-flex items-center gap-1.5 bg-gold-400 hover:bg-gold-600 text-ink-900 text-[12px] font-bold px-3.5 py-1.5 rounded-full transition-colors cursor-pointer disabled:opacity-60">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save changes
          </button>
        </div>
      )}
    </div>
  )
}
