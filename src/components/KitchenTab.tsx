import React, { useEffect, useState } from 'react'
import { Bell, BellOff, Check, ChefHat, ConciergeBell, Undo2 } from 'lucide-react'
import { useDashboardData } from './DashboardContext'
import { guestPlace, tableName } from './restaurant/served'
import { KitchenOrder, useKitchenQueue } from '../hooks/useKitchenQueue'
import { kitchenSoundIsOn, playKitchenChime, setKitchenSound, wakeKitchenSound } from '../utils/kitchenSound'

const QUIET = 'min-h-11 inline-flex items-center gap-1.5 px-3 rounded-lg border border-soft bg-card text-[14px] font-semibold text-main hover:border-gold-400 hover:bg-gold-100 transition-colors duration-200 active:scale-[0.98] cursor-pointer'
const LOUD = 'min-h-11 inline-flex items-center gap-1.5 px-3 rounded-lg bg-gold-400 hover:bg-gold-600 text-[14px] font-bold text-ink-900 transition-colors duration-200 active:scale-[0.98] cursor-pointer'

// How long an order may wait before its time turns gold, then red. Kitchen screens
// everywhere colour a ticket by its age so a late one is seen from across the room;
// ten and fifteen minutes are the usual starting point. Change them here.
const WAITING_LONG = 10
const WAITING_TOO_LONG = 15

/** How many minutes ago an order was sent. */
function minutesWaited(sentAt: string | null, now: number): number {
  return sentAt ? Math.max(0, Math.floor((now - Date.parse(sentAt)) / 60000)) : 0
}

/** The same, the way a cook would say it. */
function waited(minutes: number): string {
  if (minutes < 1) return 'just now'
  if (minutes < 60) return minutes + ' min'
  return Math.floor(minutes / 60) + ' h ' + (minutes % 60) + ' min'
}

// The kitchen's screen (Sebastian, 2026-10-04).
//
// There is always one member of staff in the kitchen, one in the restaurant or bar and
// one at the front desk, all using the system at once. The order used to reach the cook on
// a printed slip, and the only printer is at the front desk — so whoever took the order
// walked there and back every time. Now "Send to kitchen" puts it here.
//
// **It is a tablet propped up in a kitchen, upright or sideways, read from the stove and
// not held in the hand.** So the type is large, every tap target is a whole row, the
// tablet is kept awake, and a sound says an order has arrived.
//
// **Each card is a checklist** (Sebastian, 2026-10-05: the kitchen "feels a bit
// confusing"). It was: every dish had a tick drawn beside it before anything was done —
// which read as already done — and one tap made the dish vanish, so there was no seeing
// what had been cooked and no taking it back. And the big button carried the same tick.
// Now, the way kitchen screens work everywhere:
//
//   * an empty circle is a dish still to cook; a tap ticks it and strikes it through, and
//     the restaurant is told. It stays on the card. A tap again un-ticks it;
//   * "Order ready" is the one button, with a bell, not a tick: everything left on the
//     card is done, and the card goes. A card whose dishes are all ticked goes by itself;
//   * the time an order has waited turns gold, then red;
//   * above the cards, everything still to cook is added up across them.
//
// A card leads with where the food goes — the table — because that is what is called out
// when it is ready. No prices. It is open to every member of staff, like every other
// screen: they swap places, and nothing is off limits to them.
export function KitchenTab() {
  const { allBookings, rooms, venues } = useDashboardData()
  const [sound, setSound] = useState(kitchenSoundIsOn)
  const kitchen = useKitchenQueue(() => { if (kitchenSoundIsOn()) playKitchenChime() })

  // The waiting times move on without anything being tapped.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(tick)
  }, [])

  // A browser stays silent after a reload until the screen is touched once.
  useEffect(() => {
    const wake = () => { if (kitchenSoundIsOn()) wakeKitchenSound() }
    window.addEventListener('pointerdown', wake, { once: true })
    return () => window.removeEventListener('pointerdown', wake)
  }, [])

  // Left alone, a tablet dims and sleeps — and a sleeping screen shows no orders and makes
  // no sound. While this screen is open the tablet is asked to stay awake. It lets go
  // whenever the screen is hidden, so it is asked again each time the screen comes back.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null
    let closed = false
    const stayAwake = async () => {
      if (document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return
      try {
        lock = await navigator.wakeLock.request('screen')
        if (closed) void lock.release()
      } catch {
        // The tablet said no (a low battery, usually). It still works; it just dims.
      }
    }
    void stayAwake()
    document.addEventListener('visibilitychange', stayAwake)
    return () => {
      closed = true
      document.removeEventListener('visibilitychange', stayAwake)
      void lock?.release()
    }
  }, [])

  /** Where the food goes: the table, or the room for a slip that was started for one. */
  const placeOf = (order: KitchenOrder) => {
    const table = tableName(order.tableLabel)
    if (table) return table
    const booking = order.bookingId ? allBookings.find(b => b.id === order.bookingId) : undefined
    return booking ? guestPlace(booking, rooms, venues) : ''
  }

  const waiting = kitchen.orders.length
  return (
    <div className="space-y-4 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        {/* How many are waiting, not the screen's name: the tab above already says Kitchen. */}
        <h2 className="font-display font-bold text-xl tracking-tight text-main flex items-center gap-2">
          <ChefHat className="w-5 h-5 text-gold-600" />
          {waiting === 0 ? 'Kitchen' : waiting + (waiting === 1 ? ' order' : ' orders')}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {kitchen.lastDone && (
            <button type="button" onClick={() => void kitchen.putBack()} className={QUIET}>
              <Undo2 className="w-4 h-4" /> Put back {kitchen.lastDone}
            </button>
          )}
          {/* Off is the loud one: a silent kitchen screen misses orders, and it is off
              until somebody taps this on the kitchen's own tablet. */}
          <button type="button" aria-pressed={sound} className={sound ? QUIET : LOUD}
            onClick={() => { setKitchenSound(!sound); setSound(!sound) }}>
            {sound ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            {sound ? 'Sound on' : 'Turn sound on'}
          </button>
        </div>
      </div>

      {/* Everything still to cook, added up. Only worth saying when it is more than one
          order: with one, the card already says it. */}
      {waiting > 1 && kitchen.totals.length > 0 && (
        <p className="text-[17px] text-muted leading-relaxed">
          To cook{' '}
          {kitchen.totals.map((t, i) => (
            <span key={t.description} className="whitespace-nowrap">
              {i > 0 && <span className="mx-2 text-soft">·</span>}
              <b className="font-extrabold tabular-nums text-main">{t.count} ×</b>{' '}
              <span className="font-semibold text-main">{t.description}</span>
            </span>
          ))}
        </p>
      )}

      {/* Still reading: the shapes of what is coming, not a sentence about it. */}
      {kitchen.loading && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map(i => <span key={i} className="h-64 rounded-xl bg-softbg animate-pulse" />)}
        </div>
      )}

      {!kitchen.loading && waiting === 0 && (
        <p className="py-20 text-center font-display text-[22px] font-bold text-muted">Nothing to cook.</p>
      )}

      {!kitchen.loading && waiting > 0 && (
        <div className="grid gap-4 items-start sm:grid-cols-2 xl:grid-cols-3">
          {kitchen.orders.map(order => {
            const place = placeOf(order)
            const minutes = minutesWaited(order.sentAt, now)
            const late = minutes >= WAITING_TOO_LONG
            return (
              <article key={order.tabId}
                className={'bg-card border rounded-xl p-5 space-y-4 animate-in fade-in slide-in-from-bottom-1 duration-200 motion-reduce:animate-none ' + (late ? 'border-danger-400' : 'border-soft')}>
                {/* Where the food goes leads: it is what the cook calls out when it is ready. */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-display text-[30px] leading-none font-extrabold tracking-tight text-main">{place || order.who || 'Order'}</h3>
                    <p className="mt-2 text-[16px] text-muted">
                      {[order.number, place ? order.who : ''].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <span className={'shrink-0 px-2.5 py-1 rounded-lg text-[17px] font-bold tabular-nums ' +
                    (late ? 'bg-danger-50 text-danger-600' : minutes >= WAITING_LONG ? 'bg-gold-100 text-gold-800' : 'text-main')}>
                    {waited(minutes)}
                  </span>
                </div>

                {/* A checklist: an empty circle is still to cook, a filled one is done. */}
                <ul className="divide-y divide-soft border-y border-soft">
                  {order.dishes.map(dish => (
                    <li key={dish.id}>
                      <button type="button" onClick={() => void kitchen.toggle(dish.id)} aria-pressed={dish.done}
                        aria-label={dish.count + ' ' + dish.description + (dish.done ? ', cooked. Tap to take it back.' : '. Tap when it is cooked.')}
                        className="w-full min-h-16 py-2 flex items-center gap-3 text-left hover:bg-gold-100 transition-colors duration-200 active:scale-[0.99] cursor-pointer">
                        <span className={'w-9 h-9 shrink-0 inline-flex items-center justify-center rounded-full border-2 transition-colors duration-200 ' +
                          (dish.done ? 'bg-gold-400 border-gold-400 text-ink-900' : 'border-ink-300 text-transparent')}>
                          <Check className="w-5 h-5" strokeWidth={3} />
                        </span>
                        <span className={'w-14 shrink-0 text-[26px] leading-none font-extrabold tabular-nums ' + (dish.done ? 'text-muted line-through' : 'text-main')}>{dish.count} ×</span>
                        <span className={'min-w-0 flex-1 text-[22px] leading-tight font-bold break-words ' + (dish.done ? 'text-muted line-through' : 'text-main')}>{dish.description}</span>
                      </button>
                    </li>
                  ))}
                </ul>

                {/* The one button on the card, and no tick on it: it is not another dish. */}
                <button type="button" onClick={() => void kitchen.markReady(order)}
                  className="w-full min-h-16 inline-flex items-center justify-center gap-2 rounded-lg bg-gold-400 hover:bg-gold-600 text-ink-900 text-[19px] font-bold transition-colors duration-200 active:scale-[0.98] cursor-pointer">
                  <ConciergeBell className="w-5 h-5" /> Order ready
                </button>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
