import React, { useEffect, useState } from 'react'
import { Plus, Utensils } from 'lucide-react'
import { Tab, TabLine } from '../types/tab'
import { PaymentRecord } from '../types/booking'
import { GuestTabPanel } from './calendar/GuestTabPanel'
import { TabSettlePanel } from './restaurant/TabSettlePanel'
import { TabReceiptModal } from './restaurant/TabReceiptModal'
import { getOpenWalkInTabs, getTabLines, openTab, tabTotal } from '../utils/tabs'

const fmtPeso = (n: number) => '₱' + Number(n || 0).toLocaleString()

// The restaurant and bar (board card k69, part B).
//
// A diner who is not staying has no room to charge to, so they get a tab of their
// own — a name, or just the table they are sitting at. Everything they order goes
// on it, and it is settled at the counter (part C).
export function RestaurantTab() {
  const [tabs, setTabs] = useState<Tab[]>([])
  const [lines, setLines] = useState<Record<string, TabLine[]>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [table, setTable] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  // The tab just settled, kept with its lines so its receipt can be printed after
  // it has already left the open list.
  const [settled, setSettled] = useState<{ tab: Tab; lines: TabLine[]; record: PaymentRecord } | null>(null)

  // Reads the open tabs and their lines. Keeps the selected tab while it is still
  // open, otherwise falls back to the first.
  const load = async (preferId?: string) => {
    const open = await getOpenWalkInTabs()
    const map: Record<string, TabLine[]> = {}
    for (const t of open) map[t.id] = await getTabLines(t.id)
    setTabs(open)
    setLines(map)
    setSelectedId(prev => {
      const wanted = preferId || prev
      return wanted && open.some(t => t.id === wanted) ? wanted : (open[0]?.id ?? null)
    })
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const selected = tabs.find(t => t.id === selectedId) || null

  const openNew = async () => {
    if (!name.trim() && !table.trim()) { setError('Give the tab a name or a table.'); return }
    setError(''); setBusy(true)
    try {
      const tab = await openTab({ label: name, tableLabel: table })
      setName(''); setTable('')
      await load(tab.id)
    } catch {
      setError('Could not open that tab. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const onTheTables = tabTotal(tabs.flatMap(t => lines[t.id] || []))
  const box = 'w-full bg-card border border-soft text-main px-2.5 py-2 rounded-lg text-sm focus:outline-none focus:border-gold-500'
  const label = 'block text-[10px] font-bold uppercase tracking-wider text-muted'

  return (
    <div className="space-y-4 font-sans">
      <div>
        <h2 className="font-display font-bold text-xl text-main flex items-center gap-2">
          <Utensils className="w-5 h-5 text-gold-600" />
          Restaurant &amp; bar
        </h2>
        <p className="text-[13px] text-muted mt-1">
          Open tabs: <b className="text-main">{tabs.length}</b> · <b className="text-emerald-600">{fmtPeso(onTheTables)}</b> on the tables
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Left: open a tab, then the list of the ones already running. */}
        <div className="space-y-3">
          <div className="bg-card border border-soft rounded-lg p-3.5 space-y-2">
            <p className="text-[13px] font-bold text-main">Open a tab</p>
            <label className="block">
              <span className={label}>Name</span>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Mr. Cruz" className={box} />
            </label>
            <label className="block">
              <span className={label}>Table</span>
              <input value={table} onChange={e => setTable(e.target.value)} placeholder="e.g. Table 2" className={box} />
            </label>
            {error && <p className="text-[11px] font-semibold text-danger-600">{error}</p>}
            <button type="button" onClick={() => void openNew()} disabled={busy}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-ink-900 bg-gold-400 hover:bg-gold-600 px-3 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50">
              <Plus className="w-3.5 h-3.5" /> Open tab
            </button>
            <p className="text-[10.5px] text-muted">A name or a table is enough — one of the two.</p>
          </div>

          <div className="bg-card border border-soft rounded-lg overflow-hidden">
            <p className="px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider text-muted border-b border-soft">Open now</p>
            {loading ? (
              <p className="px-3.5 py-4 text-[13px] text-muted">Reading the tabs…</p>
            ) : tabs.length === 0 ? (
              <p className="px-3.5 py-4 text-[13px] text-muted">No tabs open. Start one above.</p>
            ) : (
              <ul className="divide-y divide-soft">
                {tabs.map(t => {
                  const count = (lines[t.id] || []).length
                  return (
                    <li key={t.id}>
                      <button type="button" onClick={() => setSelectedId(t.id)}
                        className={'w-full text-left px-3.5 py-2.5 transition-colors cursor-pointer ' + (t.id === selectedId ? 'bg-gold-100' : 'hover:bg-page')}>
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-bold text-main truncate">{t.label || t.table_label || 'Walk-in'}</span>
                          <span className="text-[13px] font-bold text-main shrink-0">{fmtPeso(tabTotal(lines[t.id] || []))}</span>
                        </span>
                        <span className="block text-[10.5px] text-muted mt-0.5">
                          {count} line{count === 1 ? '' : 's'}
                          {t.label && t.table_label ? ' · ' + t.table_label : ''}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Right: the tab staff picked, with its orders. */}
        <div className="bg-card border border-soft rounded-lg p-4">
          {selected ? (
            <>
              <p className="text-[13px] font-bold text-main mb-3">
                {selected.label || 'Walk-in'}{selected.table_label ? ' · ' + selected.table_label : ''}
              </p>
              <GuestTabPanel
                resolveTabId={async () => selected.id}
                lines={lines[selected.id] || []}
                tabTotal={tabTotal(lines[selected.id] || [])}
                onChanged={async () => { await load(selected.id) }}
              />
              {/* Settling (k69, part C): only worth offering once something is on
                  the tab. The diner pays what they ran up and gets a receipt. */}
              {(lines[selected.id] || []).length > 0 && (
                <TabSettlePanel
                  tab={selected}
                  total={tabTotal(lines[selected.id] || [])}
                  onSettled={async receipt => {
                    setSettled({ tab: selected, lines: lines[selected.id] || [], record: receipt })
                    await load()
                  }}
                />
              )}
            </>
          ) : (
            <p className="text-[13px] text-muted">Pick a tab on the left, or open a new one.</p>
          )}
        </div>
      </div>

      {settled && (
        <TabReceiptModal
          tab={settled.tab}
          lines={settled.lines}
          record={settled.record}
          onClose={() => setSettled(null)}
        />
      )}
    </div>
  )
}
