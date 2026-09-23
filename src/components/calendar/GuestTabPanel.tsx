import React, { useState } from 'react'
import { Utensils } from 'lucide-react'
import { TabLine } from '../../types/tab'
import { MenuPicker } from '../restaurant/MenuPicker'
import { OffMenuOrder } from '../restaurant/OffMenuOrder'
import { TabBill } from '../restaurant/TabBill'
import { RunningTabSlip } from '../restaurant/RunningTabSlip'
import { useTabOrder } from '../restaurant/useTabOrder'

interface GuestTabPanelProps {
  /**
   * The tab to add to, opened first if there is none yet. A stay passes its
   * booking; the restaurant passes a walk-in tab that is already running.
   */
  resolveTabId: () => Promise<string>
  lines: TabLine[]
  /** What the tab adds to the bill. */
  tabTotal: number
  /** Reloads the tab and puts the bill right. */
  onChanged: () => Promise<void>
  /**
   * Set while the tab may not take new orders yet (k69): a stay's tab opens only
   * once the guest is actually checked in, because that is how the desk works —
   * people order when they are in the hotel, not over the phone.
   */
  locked?: boolean
  /**
   * Who a mid-stay printout is for (k69, part D): a stay prints the guest and the
   * room, a walk-in diner the name and the table. Left out, the panel offers no
   * print at all — it would not know whose tab the paper belongs to.
   */
  slip?: { who: string; place?: { label: string; value: string }; note: string }
  /**
   * Where orders are taken (k69). The till lives in the Restaurant screen — the
   * owner did not want a menu board squeezed into the narrow booking slide-over —
   * so a booking's tab passes `ordering={false}` and shows its lines, its total
   * and a way over to the restaurant instead. Defaults to true.
   */
  ordering?: boolean
  /** Walks staff to the Restaurant screen with this guest's tab already open. */
  onOpenTill?: () => void
}

// The guest's food and bar tab (board card k69).
//
// A line can be added, and a line added by mistake can be removed — the same rule
// the app already uses for a wrong payment, so taking it off puts the bill back
// on its own. Nothing here edits a line: staff remove it and add the right one.
//
// The bill itself is [TabBill] and the writing is [useTabOrder], both shared with
// the Restaurant screen, so a stay's tab and a diner's cannot drift apart.
export function GuestTabPanel({ resolveTabId, lines, tabTotal, onChanged, locked = false, slip, ordering = true, onOpenTill }: GuestTabPanelProps) {
  const [showSlip, setShowSlip] = useState(false)
  const order = useTabOrder(resolveTabId, onChanged)

  // How many of each dish are already on the tab, so the card lights that line up
  // and says how many — the same order never lands twice unnoticed.
  const pickedCounts = lines.reduce<Record<string, number>>((acc, l) => {
    if (l.kind === 'charge') acc[l.description] = (acc[l.description] || 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-3">
      <TabBill
        lines={lines}
        total={tabTotal}
        busy={order.busy}
        locked={locked}
        onRemove={line => void order.remove(line)}
        onPrint={slip ? () => setShowSlip(true) : undefined}
        emptyText={ordering ? 'Nothing on the tab yet. Add the first order below.' : 'Nothing on the tab yet. Orders are taken in the Restaurant screen.'}
      />

      {order.removeError && <p className="text-[11px] font-semibold text-danger-600">{order.removeError}</p>}

      {/* Adding a charge — only once the guest is actually in the hotel (k69). */}
      {locked ? (
        <p className="text-[12.5px] text-ink-600 bg-paper-50 border border-soft rounded-lg px-3 py-2.5">
          <b className="text-ink-900">Check the guest in first.</b> Orders are added once the guest is in the hotel, so the bill is only ever run up by someone who is actually here.
        </p>
      ) : !ordering ? (
        <div className="bg-paper-50 border border-soft rounded-lg px-3 py-2.5 space-y-2">
          <p className="text-[12.5px] text-ink-600">
            <b className="text-ink-900">Orders are taken in the Restaurant screen.</b> The till lives there, so a menu is never squeezed into this narrow panel.
          </p>
          {onOpenTill && (
            <button type="button" onClick={onOpenTill}
              className="inline-flex items-center gap-1.5 text-[12px] font-bold text-ink-900 bg-gold-400 hover:bg-gold-600 px-3 py-2 rounded-lg transition-colors cursor-pointer">
              <Utensils className="w-3.5 h-3.5" /> Take orders for this guest
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          <MenuPicker onPick={item => void order.pickItem(item)} busy={order.busy} counts={pickedCounts} />
          <OffMenuOrder
            open={order.showOther}
            onOpen={() => order.setShowOther(true)}
            busy={order.busy}
            error={order.error}
            onAdd={order.addWritten}
          />
        </div>
      )}

      {showSlip && slip && (
        <RunningTabSlip
          who={slip.who}
          place={slip.place}
          lines={lines}
          total={tabTotal}
          note={slip.note}
          onClose={() => setShowSlip(false)}
        />
      )}
    </div>
  )
}
