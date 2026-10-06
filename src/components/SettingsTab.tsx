import React, { useMemo, useState } from 'react'
import { useBlocker } from '@tanstack/react-router'
import { useDashboardData } from './DashboardContext'
import { RateConfig, PaymentAccounts } from '../types/booking'
import { Loader2, Save } from 'lucide-react'
import { getRateConfig, saveRateConfig } from '../utils/rateConfig'
import { getPaymentAccounts, savePaymentAccounts } from '../utils/paymentAccounts'
import { RoomRatesEditor } from './settings/RoomRatesEditor'
import { RoomDraft, roomDraft } from './settings/roomDraft'
import { BreakfastMenuEditor } from './settings/BreakfastMenuEditor'
import { OtherCharges } from './settings/OtherCharges'
import { ChannelFeeds } from './settings/ChannelFeeds'
import { EmailSetup } from './settings/EmailSetup'
import { feedRows, feedUrlClashMessage, findFeedUrlClashes } from '../utils/feedUrls'
import { askConfirm } from '../utils/confirm'
import { showToast } from '../utils/toast'

type SettingsTabKey = 'rooms' | 'charges' | 'channels' | 'email'

const TABS: { key: SettingsTabKey; label: string }[] = [
  { key: 'rooms', label: 'Rooms & prices' },
  { key: 'charges', label: 'Other charges' },
  { key: 'channels', label: 'Channels' },
  { key: 'email', label: 'Email' },
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
 *
 * A fourth tab, **Email**, was added on 2026-10-04 when receipts and statements became
 * emailable: whether the hotel's Gmail is connected, and how to connect it. It saves
 * nothing here, so it never wakes the save bar.
 *
 * **One flat sheet** (the owner's taste, 2026-10-04: *"I don't like the boxes design. I
 * prefer a more 2d, clean, minimalistic, simple, yet professional look."*). The three
 * tabs are plain words down the side, marked the way the top bar's sub-tabs are — a gold
 * line on the chosen one — and each screen is parts under their names, with no card
 * round any of them. See `settings/parts.tsx`.
 *
 * **What is typed and not saved is never lost without a word** (the usability pass,
 * 2026-10-05). A new price was typed, the desk tapped Front desk, and the price was gone
 * with nothing said — the booking form went on charging the old one. Leaving now asks
 * first. And the calendar links, which had a Save button of their own inside one room's
 * row, are saved by the one bar like everything else.
 */
export function SettingsTab() {
  const { rooms, feeds, isLoading, updateFeedUrls, updateRoomRate, updateRoomBreakfastPrice, updateRoomHourPrices } = useDashboardData()
  const [tab, setTab] = useState<SettingsTabKey>('rooms')

  const [rates, setRates] = useState<RateConfig>(() => getRateConfig())
  const [savedRates, setSavedRates] = useState<RateConfig>(() => getRateConfig())
  const [pay, setPay] = useState<PaymentAccounts>(() => getPaymentAccounts())
  const [savedPay, setSavedPay] = useState<PaymentAccounts>(() => getPaymentAccounts())
  const [roomEdits, setRoomEdits] = useState<Record<string, Partial<RoomDraft>>>({})
  // A calendar link typed and not saved yet, by the row it belongs to. Laid over the
  // stored links, so a background sync that reads them again never wipes the typing.
  const [linkEdits, setLinkEdits] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const storedLinks = useMemo(() => feedRows(rooms, feeds), [rooms, feeds])
  const links = useMemo(
    () => storedLinks.map(f => (f.id in linkEdits ? { ...f, url: linkEdits[f.id] } : f)),
    [storedLinks, linkEdits],
  )

  const changes = countDiffs(rates, savedRates) + countDiffs(pay, savedPay) + Object.keys(roomEdits).length + Object.keys(linkEdits).length

  const editRoom = (roomId: string, patch: Partial<RoomDraft>) =>
    setRoomEdits(prev => ({ ...prev, [roomId]: { ...prev[roomId], ...patch } }))

  // A link typed back to what is stored is not a change.
  const editLink = (feedId: string, url: string) => setLinkEdits(prev => {
    const next = { ...prev }
    if ((storedLinks.find(f => f.id === feedId)?.url || '') === url) delete next[feedId]
    else next[feedId] = url
    return next
  })

  // Leaving with something typed and not saved asks first — the app's own question, never
  // the browser's.
  useBlocker({
    shouldBlockFn: async () => {
      if (changes === 0) return false
      const leave = await askConfirm({
        title: changes + (changes === 1 ? ' change is not saved' : ' changes are not saved'),
        message: 'Leave Settings without saving?',
        confirmLabel: 'Leave without saving',
        tone: 'danger',
      })
      return !leave
    },
    enableBeforeUnload: false,
    disabled: changes === 0,
  })

  const handleSave = async () => {
    if (saving || changes === 0) return

    // Nothing is written until everything can be: a save refused halfway would leave the
    // bar saying "saved" for some boxes and not others.
    const noPrice = rooms.find(r => !!roomEdits[r.id] && roomDraft(r, roomEdits).price <= 0)
    if (noPrice) {
      setTab('rooms')
      showToast('Room ' + noPrice.room_number + ' has no night price. Type one, then save.', 'error')
      return
    }
    const clash = Object.keys(linkEdits).length > 0 ? findFeedUrlClashes(links)[0] : undefined
    if (clash) {
      setTab('channels')
      showToast(feedUrlClashMessage(clash, id => 'Room ' + (rooms.find(r => r.id === id)?.room_number ?? '?')), 'error')
      return
    }

    setSaving(true)
    try {
      await saveRateConfig(rates)
      await savePaymentAccounts(pay)
      if (Object.keys(linkEdits).length > 0) await updateFeedUrls(links)
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
      setLinkEdits({})
      showToast('Saved. The booking form, the board and the printed bill use these.')
    } catch {
      showToast('Could not save the settings. Check the internet connection and try again.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-card border border-soft rounded-xl md:grid md:grid-cols-[12.5rem_minmax(0,1fr)]">
      {/* The same mark as the top bar's sub-tabs: a gold line on the chosen one, lying on the
          rule between the list and the screen — under the words on a phone, beside them here. */}
      <nav aria-label="Settings" className="flex md:flex-col gap-5 md:gap-0 px-5 md:px-0 md:py-4 border-b md:border-b-0 md:border-r border-soft overflow-x-auto no-scrollbar">
        {TABS.map(t => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)} aria-current={tab === t.key ? 'page' : undefined}
            // The chosen one is heavier as well as marked: down the side its gold line sits a
            // long way from its words.
            className={'flex items-center h-11 -mb-px md:mb-0 md:-mr-px md:pl-6 border-b-2 md:border-b-0 md:border-r-2 text-sm whitespace-nowrap transition-colors duration-150 cursor-pointer ' +
              (tab === t.key ? 'border-gold-600 text-main font-bold' : 'border-transparent text-muted font-medium hover:text-main')}>
            {t.label}
          </button>
        ))}
      </nav>

      <div className="min-w-0 px-5 sm:px-8 pt-6 pb-20">
        <div className="max-w-[1000px]">
          {/* The chosen tab's name is already on the list beside the screen; it is said
              again only for a screen reader. */}
          <h2 className="sr-only">{TABS.find(t => t.key === tab)?.label}</h2>

          {tab === 'rooms' && (
            <div className="space-y-9">
              <RoomRatesEditor rooms={rooms} edits={roomEdits} onEdit={editRoom} loading={isLoading} />
              <BreakfastMenuEditor items={rates.breakfastMenu} onChange={items => setRates(s => ({ ...s, breakfastMenu: items }))} />
            </div>
          )}

          {tab === 'charges' && (
            <OtherCharges rates={rates} onRate={patch => setRates(s => ({ ...s, ...patch }))} pay={pay} onPay={patch => setPay(s => ({ ...s, ...patch }))} />
          )}

          {tab === 'channels' && (
            <div className="max-w-[720px]">
              <ChannelFeeds rooms={rooms} links={links} unsaved={linkEdits} onLink={editLink} />
            </div>
          )}

          {tab === 'email' && <EmailSetup />}
        </div>
      </div>

      {/* ONE save bar (the owner's ruling): it appears only once something has been
          typed, and it says how many changes are waiting. Kept in the LIGHT shell like
          the rest of the staff app — no dark bar floating over a light page. It is the one
          thing on the screen that floats, so it is the one thing with a shadow. */}
      {changes > 0 && (
        <div className="fixed bottom-16 lg:bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-card border border-gold-300 rounded-full pl-5 pr-1.5 py-1.5 shadow-softLg">
          <span className="text-[14px] font-semibold text-main whitespace-nowrap">
            {changes} change{changes === 1 ? '' : 's'} not saved
          </span>
          <button type="button" onClick={() => void handleSave()} disabled={saving}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-gold-400 hover:bg-gold-600 text-ink-900 text-[14px] font-bold whitespace-nowrap transition-colors duration-150 active:scale-[0.98] cursor-pointer disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save changes
          </button>
        </div>
      )}
    </div>
  )
}
