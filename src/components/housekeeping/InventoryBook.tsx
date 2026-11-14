// Inventory: the logbook (the stock logbook mock, Sebastian, 2026-11-12; PC design B, "Open logbook";
// docs/why/stock.md). Two books, Kitchen and Hotel. Stock in is copied from the receipt; the amounts in the
// inventory can be typed over, and that is the check. Every save lays its change on the screen at once,
// saves behind it, and has Undo.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Pencil, X } from 'lucide-react'
import { NewTag } from '../NewMark'
import { markSeen } from '../../utils/newMarks'
import { showToast } from '../../utils/toast'
import { dateToString, peso } from '../../utils/helpers'
import { fmtQty } from '../../utils/stock'
import {
  boughtOtherSince, daysSinceCheck, fixStockIn, removeStockIn, restoreStockIn, setCountNote, setStockCount,
  setStockInExpenses, writeStockIn, type Book, type BookItem, type StockInInput, type StockInLine, type StockUnit,
} from '../../utils/stockBook'
import { useInventoryBook } from './useInventoryBook'

const WIDE = '(min-width: 1024px)'
const subscribeWide = (cb: () => void) => { const m = matchMedia(WIDE); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb) }
const useWide = () => useSyncExternalStore(subscribeWide, () => matchMedia(WIDE).matches)

const BOOKS: { id: Book; label: string }[] = [{ id: 'kitchen', label: 'Kitchen' }, { id: 'hotel', label: 'Hotel' }]
const num = (s: string) => { const n = parseFloat(String(s).replace(/,/g, '')); return Number.isFinite(n) ? n : NaN }
const today = () => dateToString(new Date())
const perUnit = (total: number, amount: number, unit: StockUnit) => <><b className="font-display text-[18px] text-main">{peso(Math.round(total / amount * 100) / 100)}</b> a {unit === 'kg' ? 'kilo' : 'piece'}</>

function dayName(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const t = new Date(); const diff = Math.round((new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime() - dt.getTime()) / 864e5)
  return diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

interface Gap { d: number; unit: StockUnit; movement: string | null; note: string }
interface Draft { item: string; total: string; amount: string; unit: StockUnit }
const blank = (unit: StockUnit = 'kg'): Draft => ({ item: '', total: '', amount: '', unit })
const ready = (d: Draft) => d.item.trim() !== '' && num(d.total) > 0 && num(d.amount) > 0
const toInput = (d: Draft): StockInInput => ({ item: d.item.trim(), total: num(d.total), amount: num(d.amount), unit: d.unit })

export function InventoryBook() {
  const { items, setItems, lines, setLines, expensesOn, setExpensesOn, loaded, reload } = useInventoryBook()
  const wide = useWide()
  const [book, setBook] = useState<Book>('kitchen')
  const [tab, setTab] = useState<'shelf' | 'log'>('shelf')
  const [sheet, setSheet] = useState(false)
  const [fixing, setFixing] = useState<string | null>(null)
  const [unitFor, setUnitFor] = useState<string | null>(null)
  const [flash, setFlash] = useState<string[]>([])
  const [gaps, setGaps] = useState<Record<string, Gap>>({})
  const [printing, setPrinting] = useState(false)
  const [day, setDay] = useState(today)

  const mine = useMemo(() => items.filter(i => i.book === book), [items, book])
  const myLines = useMemo(() => lines.filter(l => l.book === book), [lines, book])
  const nameOf = (id: string) => items.find(i => i.id === id)?.name ?? ''
  const findItem = (name: string) => mine.find(i => i.name.toLowerCase() === name.trim().toLowerCase())
  const failed = (msg: string) => () => { showToast(msg, 'error'); void reload() }
  const lit = (ids: string[]) => { setFlash(ids); setTimeout(() => setFlash([]), 1300) }
  // A known item picks the unit it was last bought in, else the one it is counted in.
  const lastUnit = (name: string): StockUnit | null => {
    const it = findItem(name)
    if (!it) return null
    return lines.find(l => l.item_id === it.id && !l.removed_at)?.unit ?? it.unit
  }

  /** Writes a receipt's lines in. Resolves false when the database refused them, so the form gets them back. */
  const writeIn = async (draft: StockInInput[], boughtOn: string) => {
    const now = new Date().toISOString()
    const known = draft.map(d => findItem(d.item))
    setLines(ls => [...draft.map((d, k): StockInLine => ({
      id: `tmp-${k}-${now}`, book, item_id: known[k]?.id ?? `new-${d.item}`, bought_on: boughtOn, total: d.total, amount: d.amount,
      unit: d.unit, counted: known[k]?.unit === d.unit, has_expense: expensesOn, removed_at: null, created_at: now,
    })), ...ls])
    setItems(is => {
      let next = is.map(i => {
        const add = draft.filter((d, k) => known[k]?.id === i.id && i.unit === d.unit).reduce((a, d) => a + d.amount, 0)
        return add ? { ...i, quantity: i.quantity + add } : i
      })
      draft.forEach((d, k) => {
        if (!known[k] && !next.some(i => i.book === book && i.name.toLowerCase() === d.item.toLowerCase()))
          next = [...next, { id: `new-${d.item}`, name: d.item, book, quantity: d.amount, unit: d.unit, checked_at: null, created_at: now }]
      })
      return next
    })
    lit(draft.map((d, k) => known[k]?.id ?? `new-${d.item}`))
    try {
      const saved = await writeStockIn(book, boughtOn, draft)
      void reload()
      const sum = saved.reduce((a, l) => a + l.total, 0)
      showToast(`${saved.length} written in · ${peso(sum)}`, 'success', {
        label: 'Undo',
        run: () => {
          setLines(ls => ls.map(l => saved.some(s => s.id === l.id) ? { ...l, removed_at: new Date().toISOString() } : l))
          Promise.all(saved.map(l => removeStockIn(l.id))).then(() => reload(), failed('Could not take it back. Try again.'))
        },
      })
      return true
    } catch {
      showToast('Not written in. Check the line and try again.', 'error')
      void reload()
      return false
    }
  }

  /** The check: what is there now. A different amount shows its gap and a place for a note. */
  const count = (it: BookItem, v: number, unit: StockUnit) => {
    const old = { quantity: it.quantity, unit: it.unit, checked_at: it.checked_at }
    // A count in another unit, or after buying in the other unit, is not a loss: no gap.
    const showGap = unit === it.unit && v !== it.quantity && !boughtOtherSince(it, lines)
    setItems(is => is.map(i => i.id === it.id ? { ...i, quantity: v, unit, checked_at: new Date().toISOString() } : i))
    setGaps(g => { const n = { ...g }; if (showGap) n[it.id] = { d: v - it.quantity, unit, movement: null, note: '' }; else delete n[it.id]; return n })
    lit([it.id])
    setStockCount(it.id, v, unit).then(mv => {
      if (showGap) setGaps(g => g[it.id] ? { ...g, [it.id]: { ...g[it.id], movement: mv } } : g)
    }, failed(`${it.name} was not saved. Type it again.`))
    showToast(`${it.name} ${fmtQty(v)} ${unit}${unit === old.unit ? ' · was ' + fmtQty(old.quantity) : ''}`, 'success', {
      label: 'Undo',
      run: () => {
        setItems(is => is.map(i => i.id === it.id ? { ...i, ...old } : i))
        setGaps(g => { const n = { ...g }; delete n[it.id]; return n })
        setStockCount(it.id, old.quantity, old.unit, old.checked_at).then(() => reload(), failed('Could not undo. Try again.'))
      },
    })
  }

  const saveNote = (id: string) => {
    const g = gaps[id]
    if (g?.movement) setCountNote(g.movement, g.note).catch(failed('The note was not saved.'))
  }

  const fix = (l: StockInLine, f: { total: number; amount: number; unit: StockUnit; bought_on: string }) => {
    const old = { total: l.total, amount: l.amount, unit: l.unit, bought_on: l.bought_on }
    const put = (v: typeof f) => setLines(ls => ls.map(x => x.id === l.id ? { ...x, ...v } : x))
    put(f); setFixing(null)
    fixStockIn(l.id, f).then(() => reload(), failed('Not fixed. Try again.'))
    showToast(`${nameOf(l.item_id)} fixed`, 'success', {
      label: 'Undo', run: () => { put(old); fixStockIn(l.id, old).then(() => reload(), failed('Could not undo. Try again.')) },
    })
  }

  const putBack = (l: StockInLine) => {
    setLines(ls => ls.map(x => x.id === l.id ? { ...x, removed_at: null } : x))
    restoreStockIn(l.id).then(() => reload(), failed('Not put back. Try again.'))
  }

  const remove = (l: StockInLine) => {
    setLines(ls => ls.map(x => x.id === l.id ? { ...x, removed_at: new Date().toISOString() } : x)); setFixing(null)
    removeStockIn(l.id).then(() => reload(), failed('Not taken out. Try again.'))
    showToast(`${nameOf(l.item_id)} taken out of the log`, 'success', { label: 'Undo', run: () => putBack(l) })
  }

  const turnExpenses = (on: boolean) => {
    setExpensesOn(on)
    setStockInExpenses(on).then(n => {
      void reload()
      if (on) showToast(n ? `Stock in goes to Today's money · ${n} expenses back` : "Stock in goes to Today's money")
      else showToast(`Turned off · ${n} expense${n === 1 ? '' : 's'} taken back`, 'success', { label: 'Undo', run: () => turnExpenses(true) })
    }, failed('The switch was not saved. Try again.'))
  }

  const print = () => { setPrinting(true); setTimeout(() => { window.print(); setPrinting(false) }, 60) }

  const fixLine = myLines.find(l => l.id === fixing)
  const unitItem = mine.find(i => i.id === unitFor)
  const expenseCount = lines.filter(l => l.has_expense && !l.removed_at).length

  const head = (
    <BookHead book={book} onBook={b => { setBook(b); setFixing(null); setGaps({}) }}
      expensesOn={expensesOn} expenseCount={expenseCount} onExpenses={turnExpenses} onPrint={print} />
  )
  const shelf = (
    <Shelf items={mine} loaded={loaded} gaps={gaps} flash={flash} onCount={count} onUnit={id => setUnitFor(id)}
      onNote={(id, note) => setGaps(g => ({ ...g, [id]: { ...g[id], note } }))} onNoteDone={saveNote} />
  )
  const log = <StockInLog lines={myLines} loaded={loaded} nameOf={nameOf} onFix={id => setFixing(id)} onPutBack={putBack} />
  const names = <datalist id="inv-names">{mine.map(i => <option key={i.id} value={i.name} />)}</datalist>

  return (
    <div className="font-sans text-main">
      {wide ? (
        // B · the open logbook: stock in on the left page, written on its blank line; the inventory on the right.
        <div className="bg-card border border-soft rounded-xl overflow-hidden flex flex-col h-[calc(100dvh-170px)] min-h-[520px]">
          {head}
          <div className="grid grid-cols-2 flex-1 min-h-0 border-t border-soft">
            <section className="min-w-0 min-h-0 flex flex-col">
              <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-2.5 min-h-[62px]">
                <h4 className="font-display font-bold text-base">Stock in</h4>
                <BoughtDate value={day} onChange={setDay} />
              </div>
              <WriteLine expensesOn={expensesOn} isNew={n => !findItem(n)} unitOf={lastUnit} onWrite={d => writeIn([d], day)} />
              <div className="flex-1 min-h-0 overflow-y-auto">{log}</div>
            </section>
            <section className="min-w-0 min-h-0 flex flex-col border-l-[3px] border-double border-soft">
              <div className="flex items-center px-4 pt-3.5 pb-2.5 min-h-[62px]"><h4 className="font-display font-bold text-base">Inventory</h4></div>
              <div className="flex-1 min-h-0 overflow-y-auto">{shelf}</div>
            </section>
          </div>
        </div>
      ) : (
        <div className="bg-card border border-soft rounded-xl overflow-hidden">
          {head}
          <Tabs tab={tab} onTab={setTab} />
          {tab === 'shelf' ? shelf : log}
        </div>
      )}
      {!wide && (
        <div className="sticky bottom-[calc(64px+env(safe-area-inset-bottom,0px))] z-10 flex pt-3">
          <button onClick={() => setSheet(true)} className="flex-1 min-h-[48px] rounded-xl bg-gold-400 hover:bg-gold-600 text-ink-900 font-semibold text-[15px] cursor-pointer">+ Stock in</button>
        </div>
      )}
      {names}

      {sheet && !wide && createPortal(
        <div className="fixed inset-0 z-50 bg-page flex flex-col animate-[inv-sheet_.32s_cubic-bezier(.3,.7,.3,1)]">
          <Receipt book={book} day={day} onDay={setDay} expensesOn={expensesOn} isNew={n => !findItem(n)} unitOf={lastUnit}
            onClose={() => setSheet(false)}
            onWrite={(draft, keep) => { setSheet(false); setTab('shelf'); void writeIn(draft, day).then(ok => { if (!ok) keep() }) }} />
        </div>, document.body)}
      {fixLine && <FixPop line={fixLine} name={nameOf(fixLine.item_id)} onClose={() => setFixing(null)} onDone={f => fix(fixLine, f)} onRemove={() => remove(fixLine)} />}
      {unitItem && <UnitPop item={unitItem} onClose={() => setUnitFor(null)} onDone={(v, u) => { setUnitFor(null); count(unitItem, v, u) }} />}
      {printing && createPortal(<CountSheet book={book} items={mine} />, document.body)}
    </div>
  )
}

// ── The head: which book, and More ───────────────────────────────────────────

function BookHead({ book, onBook, expensesOn, expenseCount, onExpenses, onPrint }: {
  book: Book; onBook: (b: Book) => void; expensesOn: boolean; expenseCount: number; onExpenses: (on: boolean) => void; onPrint: () => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const [thumb, setThumb] = useState({ left: 3, width: 0 })
  const [open, setOpen] = useState(false)
  const [asking, setAsking] = useState(false)
  const menu = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const on = box.current?.querySelector<HTMLButtonElement>('[aria-pressed=true]')
    if (on) setThumb({ left: on.offsetLeft, width: on.offsetWidth })
  }, [book])

  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => { if (!menu.current?.contains(e.target as Node)) { setOpen(false); setAsking(false) } }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])

  return (
    <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-2.5 flex-wrap">
      <div ref={box} role="group" aria-label="Book" className="relative inline-flex bg-paper-100 rounded-full p-[3px]" onClick={() => markSeen('inventory-logbook')}>
        <span aria-hidden="true" className="absolute top-[3px] bottom-[3px] left-[var(--l)] w-[var(--w)] rounded-full bg-card transition-[left,width] duration-300 ease-[cubic-bezier(.3,.7,.3,1)]"
          style={{ '--l': thumb.left + 'px', '--w': thumb.width + 'px' } as CSSProperties} />
        {BOOKS.map(b => (
          <button key={b.id} aria-pressed={b.id === book} onClick={() => onBook(b.id)}
            className={'relative z-[1] px-4 min-h-[40px] rounded-full text-sm font-semibold cursor-pointer transition-colors duration-200 ' + (b.id === book ? 'text-ink-900' : 'text-muted')}>
            {b.label}
          </button>
        ))}
        <NewTag id="inventory-logbook" />
      </div>
      <div ref={menu} className="ml-auto relative">
        <button onClick={() => { setOpen(o => !o); setAsking(false) }} aria-expanded={open}
          className="border border-soft rounded-[10px] px-3 min-h-[40px] text-[13px] font-medium text-muted hover:bg-paper-100 hover:text-main cursor-pointer">More</button>
        {open && (
          <div className="absolute right-0 top-[calc(100%+6px)] w-[270px] bg-card border border-soft rounded-xl p-1.5 z-30 origin-top-right animate-[inv-pop_.18s_ease]">
            <button className="flex gap-2.5 items-center p-2.5 rounded-lg w-full text-left text-[13px] font-medium hover:bg-paper-100 cursor-pointer"
              onClick={() => { if (!expensesOn) { onExpenses(true); setOpen(false) } else if (expenseCount === 0) { onExpenses(false); setOpen(false) } else setAsking(true) }}>
              <Switch on={expensesOn} />
              <span>Stock in goes to Today's money</span>
            </button>
            {asking && (
              <div className="p-2.5 text-[13px] flex flex-col gap-2 animate-[inv-grow_.2s_ease]">
                Take back {expenseCount} expense{expenseCount === 1 ? '' : 's'} it added?
                <div className="flex gap-1.5">
                  <button onClick={() => { onExpenses(false); setOpen(false); setAsking(false) }} className="min-h-[34px] px-2.5 rounded-[9px] bg-danger-50 text-danger-500 font-semibold cursor-pointer">Turn off</button>
                  <button onClick={() => setAsking(false)} className="min-h-[34px] px-2.5 rounded-[9px] border border-soft font-semibold cursor-pointer">Keep on</button>
                </div>
              </div>
            )}
            <button onClick={() => { setOpen(false); onPrint() }} className="flex p-2.5 rounded-lg w-full text-left text-[13px] font-medium hover:bg-paper-100 cursor-pointer">Print a count sheet</button>
          </div>
        )}
      </div>
    </div>
  )
}

const Switch = ({ on }: { on: boolean }) => (
  <span className={'relative flex-none w-[38px] h-[22px] rounded-full transition-colors duration-200 ' + (on ? 'bg-emerald-700' : 'bg-ink-300')}>
    <span className={'absolute top-[3px] w-4 h-4 rounded-full bg-white transition-[left] duration-200 ' + (on ? 'left-[19px]' : 'left-[3px]')} />
  </span>
)

function Tabs({ tab, onTab }: { tab: 'shelf' | 'log'; onTab: (t: 'shelf' | 'log') => void }) {
  return (
    <div role="group" className="flex gap-[18px] px-4 border-b border-soft">
      {([['shelf', 'Inventory'], ['log', 'Stock in']] as const).map(([t, label]) => (
        <button key={t} aria-pressed={tab === t} onClick={() => onTab(t)}
          className={'relative py-2.5 min-h-[44px] text-sm font-semibold cursor-pointer ' + (tab === t ? 'text-main' : 'text-muted')}>
          {label}
          {tab === t && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-ink-900 animate-[inv-line_.25s_ease]" />}
        </button>
      ))}
    </div>
  )
}

// ── The inventory: each amount can be typed over ─────────────────────────────

function Shelf({ items, loaded, gaps, flash, onCount, onUnit, onNote, onNoteDone }: {
  items: BookItem[]; loaded: boolean; gaps: Record<string, Gap>; flash: string[]
  onCount: (it: BookItem, v: number, unit: StockUnit) => void; onUnit: (id: string) => void
  onNote: (id: string, note: string) => void; onNoteDone: (id: string) => void
}) {
  if (!items.length) return <div className="py-9 px-4 text-center text-muted">{loaded ? 'Nothing in this book yet.' : ''}</div>
  return (
    <div>
      {items.map((it, k) => {
        const days = daysSinceCheck(it)
        const g = gaps[it.id]
        return (
          <div key={it.id} className={'grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 items-center px-4 py-3 bg-card ' + (k ? 'border-t border-soft ' : '') + (flash.includes(it.id) ? 'animate-[inv-flash_1.2s_ease]' : '')}>
            <div className="min-w-0">
              <div className="font-semibold text-[15px] truncate">{it.name}</div>
              <div className="text-xs text-muted">
                {days === 0 ? <span className="text-emerald-700 font-semibold">Checked today</span>
                  : days === null ? 'Not checked yet'
                    : days >= 14 ? <span className="text-gold-800 font-semibold">Not checked in {days} days</span>
                      : days === 1 ? 'Checked yesterday' : `Checked ${days} days ago`}
              </div>
            </div>
            <label className="inline-flex items-baseline gap-[3px] cursor-text">
              <input key={it.quantity + it.unit} defaultValue={fmtQty(it.quantity)} inputMode="decimal" placeholder="0" aria-label={`${it.name}, ${it.unit}`}
                onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
                onBlur={e => {
                  const v = num(e.currentTarget.value)
                  if (Number.isNaN(v) || v < 0) { e.currentTarget.value = fmtQty(it.quantity); return }
                  if (v !== it.quantity) onCount(it, v, it.unit)
                }}
                className="w-[68px] text-right font-display font-bold text-lg tabular-nums bg-transparent px-1 py-1.5 border border-transparent border-b-ink-300 border-dashed rounded-none hover:border-b-gold-400 focus:outline-none focus:border-solid focus:border-gold-400 focus:rounded-lg focus:bg-page transition-[border-color,background-color,border-radius] duration-200" />
              <button type="button" onClick={() => onUnit(it.id)} aria-label={`${it.name}: kilos or pieces`}
                className="min-w-[32px] px-1 py-2.5 text-xs font-semibold text-muted hover:text-main underline decoration-dotted underline-offset-[3px] cursor-pointer">{it.unit}</button>
            </label>
            {g && (
              <div className="col-span-2 flex flex-wrap gap-2 items-center pt-1.5 animate-[inv-grow_.25s_ease]">
                <span className={'text-xs font-bold px-2.5 py-1 rounded-full tabular-nums ' + (g.d < 0 ? 'bg-danger-50 text-danger-500' : 'bg-emerald-50 text-emerald-700')}>
                  {g.d < 0 ? '−' : '+'}{fmtQty(Math.abs(g.d))} {g.unit}
                </span>
                <input value={g.note} onChange={e => onNote(it.id, e.target.value)} onBlur={() => onNoteDone(it.id)}
                  onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} placeholder="Note, e.g. 1 kg spoiled"
                  className="flex-1 min-w-[140px] text-base px-2.5 py-[7px] border border-dashed border-soft rounded-[10px] bg-transparent focus:outline-none focus:border-solid focus:border-gold-400" />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Stock in: the log, by day ────────────────────────────────────────────────

function StockInLog({ lines, loaded, nameOf, onFix, onPutBack }: {
  lines: StockInLine[]; loaded: boolean; nameOf: (id: string) => string; onFix: (id: string) => void; onPutBack: (l: StockInLine) => void
}) {
  const sorted = [...lines].sort((a, b) => b.bought_on.localeCompare(a.bought_on) || b.created_at.localeCompare(a.created_at))
  if (!sorted.length) return <div className="py-9 px-4 text-center text-muted">{loaded ? 'Nothing written in yet.' : ''}</div>
  const days = [...new Set(sorted.map(l => l.bought_on))]
  return (
    <div>
      {days.map(d => {
        const ls = sorted.filter(l => l.bought_on === d)
        return (
          <div key={d}>
            <div className="flex justify-between px-4 pt-3 pb-1 text-xs font-bold uppercase tracking-[0.06em] text-muted">
              <span>{dayName(d)}</span>
              <b className="text-main normal-case tracking-normal text-[13px] tabular-nums">{peso(ls.filter(l => !l.removed_at).reduce((a, l) => a + l.total, 0))}</b>
            </div>
            {ls.map(l => (
              <div key={l.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2.5 items-center px-4 py-2.5 bg-card border-t border-soft">
                <div className={'min-w-0 ' + (l.removed_at ? 'opacity-40 line-through' : '')}>
                  <div className="font-semibold truncate">{nameOf(l.item_id) || '…'}</div>
                  <div className="text-xs text-muted tabular-nums">{fmtQty(l.amount)} {l.unit}</div>
                </div>
                <div className={'flex gap-[18px] items-baseline tabular-nums ' + (l.removed_at ? 'opacity-40 line-through' : '')}>
                  <span className="text-muted font-semibold min-w-[64px] text-right">{peso(Math.round(l.total / l.amount * 100) / 100)}<small className="text-[11px] font-medium">/{l.unit === 'kg' ? 'kg' : 'pc'}</small></span>
                  <span className="font-bold min-w-[72px] text-right">{peso(l.total)}</span>
                </div>
                {l.removed_at
                  ? <button onClick={() => onPutBack(l)} className="text-xs font-semibold text-gold-800 px-1.5 min-h-[36px] cursor-pointer">Put back</button>
                  : <button onClick={() => { if (!l.id.startsWith('tmp-')) onFix(l.id) }} aria-label="Fix"
                    className="w-9 h-9 grid place-items-center rounded-[9px] text-muted hover:bg-paper-100 hover:text-main cursor-pointer"><Pencil className="w-4 h-4" /></button>}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

// ── Writing stock in ─────────────────────────────────────────────────────────

const field = 'text-base bg-page border border-soft rounded-[10px] px-[11px] py-2.5 w-full min-w-0 focus:outline-none focus:border-gold-400 focus:bg-card'

function UnitSeg({ unit, onPick, tall = 'h-11', words = false }: { unit: StockUnit; onPick: (u: StockUnit) => void; tall?: string; words?: boolean }) {
  return (
    <div role="group" className={'inline-flex bg-paper-100 rounded-[10px] p-[3px] ' + tall}>
      {(['kg', 'pcs'] as const).map(u => (
        <button key={u} type="button" aria-pressed={unit === u} onClick={() => onPick(u)}
          className={'px-3 rounded-lg text-sm font-semibold cursor-pointer transition-colors duration-150 ' + (unit === u ? 'bg-card text-ink-900' : 'text-muted')}>
          {words ? (u === 'kg' ? 'Kilos' : 'Pieces') : u}
        </button>
      ))}
    </div>
  )
}

function BoughtDate({ value, onChange }: { value: string; onChange: (d: string) => void }) {
  return (
    <label className="ml-auto flex items-center gap-1.5 text-[13px] text-muted">
      <span>Bought</span>
      <input type="date" value={value} max={today()} onChange={e => e.target.value && onChange(e.target.value)}
        className="text-base font-semibold border border-soft rounded-[10px] px-2 py-[7px] bg-page text-main" />
    </label>
  )
}

const NewItemTag = () => <span className="text-[10px] font-bold tracking-[0.06em] text-gold-800 bg-gold-100 px-1.5 py-0.5 rounded-md">NEW ITEM</span>

/** PC: one blank writing line, like the paper logbook. Enter in How many writes it in. */
function WriteLine({ expensesOn, isNew, unitOf, onWrite }: {
  expensesOn: boolean; isNew: (name: string) => boolean; unitOf: (name: string) => StockUnit | null; onWrite: (d: StockInInput) => void
}) {
  const [d, setD] = useState<Draft>(blank)
  const itemBox = useRef<HTMLInputElement>(null)
  const write = () => {
    if (!ready(d)) { showToast('Write the item, what was spent and how many', 'info'); return }
    onWrite(toInput(d)); setD(blank(d.unit)); itemBox.current?.focus()
  }
  const line = 'grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_92px_minmax(0,.8fr)_84px] gap-1.5 items-center px-4 bg-[#FFFDF8]'
  const ink = 'text-base border-0 border-b border-soft bg-transparent px-1 py-[9px] w-full min-w-0 focus:outline-none focus:border-gold-400'
  return (
    <div>
      <div className={line + ' pt-2 pb-1 border-t border-dashed border-gold-400 text-[11px] text-muted'}>
        <span>Item</span><span>Total spent</span><span>kg/pcs</span><span>How many</span><span />
      </div>
      <div className={line + ' pb-1'}>
        <input ref={itemBox} value={d.item} list="inv-names" autoComplete="off" placeholder="e.g. Chicken" aria-label="Item" className={ink}
          onChange={e => { const v = e.target.value; const u = unitOf(v); setD(x => ({ ...x, item: v, unit: u ?? x.unit })) }} />
        <div className="relative"><span className="absolute left-1 top-1/2 -translate-y-1/2 text-muted font-semibold">₱</span>
          <input value={d.total} inputMode="decimal" placeholder="1050" aria-label="Total spent" className={ink + ' pl-4 tabular-nums'}
            onChange={e => setD(x => ({ ...x, total: e.target.value }))} /></div>
        <UnitSeg unit={d.unit} onPick={u => setD(x => ({ ...x, unit: u }))} tall="h-[38px]" />
        <input value={d.amount} inputMode="decimal" placeholder={d.unit === 'kg' ? '5' : '30'} aria-label={d.unit === 'kg' ? 'How many kilos' : 'How many pieces'}
          className={ink + ' tabular-nums'} onChange={e => setD(x => ({ ...x, amount: e.target.value }))}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); write() } }} />
        <button onClick={write} className="min-h-[38px] px-3 rounded-xl bg-gold-400 hover:bg-gold-600 text-ink-900 text-sm font-semibold cursor-pointer">Write in</button>
      </div>
      <div className="flex justify-between items-center gap-2.5 px-4 pt-0.5 pb-2 min-h-[28px] text-xs text-muted bg-[#FFFDF8] border-b border-dashed border-gold-400">
        <span>{d.item.trim() && isNew(d.item) ? <NewItemTag /> : expensesOn ? <span className="text-emerald-700">● Also an expense in Today's money</span> : null}</span>
        <span>{num(d.total) > 0 && num(d.amount) > 0 ? perUnit(num(d.total), num(d.amount), d.unit) : null}</span>
      </div>
    </div>
  )
}

/** Phone: the whole receipt on one sheet, line after line. */
function Receipt({ book, day, onDay, expensesOn, isNew, unitOf, onClose, onWrite }: {
  book: Book; day: string; onDay: (d: string) => void; expensesOn: boolean; isNew: (name: string) => boolean
  unitOf: (name: string) => StockUnit | null; onClose: () => void; onWrite: (draft: StockInInput[], keep: () => void) => void
}) {
  const [rows, setRows] = useState<Draft[]>([blank()])
  const set = (k: number, p: Partial<Draft>) => setRows(rs => rs.map((r, i) => i === k ? { ...r, ...p } : r))
  const filled = rows.filter(ready)
  const sum = rows.reduce((a, r) => a + (num(r.total) || 0), 0)
  return (
    <>
      <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-dashed border-soft bg-card">
        <button onClick={onClose} aria-label="Close" className="p-1 text-muted cursor-pointer"><X className="w-5 h-5" /></button>
        <h4 className="font-display font-bold text-base">{book === 'kitchen' ? 'Kitchen' : 'Hotel'} receipt</h4>
        <BoughtDate value={day} onChange={onDay} />
      </div>
      <div className="flex-1 overflow-y-auto bg-card">
        {rows.map((r, k) => (
          <div key={k} className="px-4 py-3 border-b border-dashed border-soft flex flex-col gap-2 animate-[inv-grow_.25s_ease]">
            <label className="flex flex-col gap-1">
              <span className="flex justify-between items-center text-xs text-muted">
                <span className="flex gap-2 items-center">Item {r.item.trim() && isNew(r.item) && <NewItemTag />}</span>
                {rows.length > 1 && <button type="button" onClick={() => setRows(rs => rs.filter((_, i) => i !== k))} className="text-[13px] p-1 cursor-pointer">Remove</button>}
              </span>
              <input value={r.item} list="inv-names" autoComplete="off" placeholder="e.g. Chicken" className={field}
                onChange={e => { const v = e.target.value; const u = unitOf(v); set(k, u ? { item: v, unit: u } : { item: v }) }} />
            </label>
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,.8fr)] gap-2 items-end">
              <label className="flex flex-col gap-1"><span className="text-xs text-muted">Total spent</span>
                <span className="relative"><span className="absolute left-[11px] top-1/2 -translate-y-1/2 text-muted font-semibold">₱</span>
                  <input value={r.total} inputMode="decimal" placeholder="1050" className={field + ' pl-6 tabular-nums'} onChange={e => set(k, { total: e.target.value })} /></span>
              </label>
              <UnitSeg unit={r.unit} onPick={u => set(k, { unit: u })} />
              <label className="flex flex-col gap-1"><span className="text-xs text-muted">{r.unit === 'kg' ? 'How many kilos' : 'How many pieces'}</span>
                <input value={r.amount} inputMode="decimal" placeholder={r.unit === 'kg' ? '5' : '30'} className={field + ' tabular-nums'} onChange={e => set(k, { amount: e.target.value })} />
              </label>
            </div>
            {num(r.total) > 0 && num(r.amount) > 0 && <div className="flex justify-end gap-2 text-[15px] text-muted tabular-nums">{perUnit(num(r.total), num(r.amount), r.unit)}</div>}
          </div>
        ))}
        <button onClick={() => setRows(rs => [...rs, blank(rs[rs.length - 1].unit)])} className="w-full text-left px-4 py-3.5 min-h-[44px] text-gold-800 font-semibold text-sm cursor-pointer">+ Another item</button>
        {expensesOn && <div className="px-4 pb-2.5 text-xs text-emerald-700">● Also an expense in Today's money, on {dayName(day)}</div>}
      </div>
      <div className="flex items-center gap-2.5 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] border-t border-soft bg-card">
        <div className="text-[13px] text-muted">Receipt <b className="font-display text-lg text-main tabular-nums">{peso(sum)}</b></div>
        <button onClick={() => {
          if (!filled.length) { showToast('Write an item, what was spent and how many', 'info'); return }
          const keep = rows
          onWrite(filled.map(toInput), () => setRows(keep))
        }} className="ml-auto min-h-[44px] px-4 rounded-xl bg-gold-400 hover:bg-gold-600 text-ink-900 font-semibold cursor-pointer">
          {filled.length ? `Write in ${filled.length} item${filled.length > 1 ? 's' : ''}` : 'Write in'}
        </button>
      </div>
    </>
  )
}

// ── Pop-ups: a sheet from the bottom on a phone, a card in the middle on a PC ─

function Pop({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onClose])
  return createPortal(
    <div className="fixed inset-0 z-50 bg-ink-900/35 flex items-end lg:items-center justify-center lg:p-4 animate-[inv-fade_.2s_ease]" onPointerDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-label={label} className="bg-card w-full max-w-[420px] rounded-t-[18px] lg:rounded-2xl p-4 pb-[calc(16px+env(safe-area-inset-bottom,0px))] lg:pb-4 flex flex-col gap-3 font-sans text-main animate-[inv-sheet_.3s_cubic-bezier(.3,.7,.3,1)] lg:animate-[inv-pop_.2s_ease]">
        <div className="flex items-center gap-2">
          <h4 className="font-display font-bold text-[17px]">{label}</h4>
          <button onClick={onClose} aria-label="Close" className="ml-auto p-1 text-muted cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>, document.body)
}

function FixPop({ line, name, onClose, onDone, onRemove }: {
  line: StockInLine; name: string; onClose: () => void
  onDone: (f: { total: number; amount: number; unit: StockUnit; bought_on: string }) => void; onRemove: () => void
}) {
  const [f, setF] = useState({ total: String(line.total), amount: String(line.amount), unit: line.unit, bought_on: line.bought_on })
  const ok = num(f.total) > 0 && num(f.amount) > 0
  return (
    <Pop label={name} onClose={onClose}>
      <label className="flex flex-col gap-1"><span className="text-xs text-muted">Bought</span>
        <input type="date" value={f.bought_on} max={today()} onChange={e => e.target.value && setF(x => ({ ...x, bought_on: e.target.value }))} className={field} /></label>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,.8fr)] gap-2 items-end">
        <label className="flex flex-col gap-1"><span className="text-xs text-muted">Total spent</span>
          <span className="relative"><span className="absolute left-[11px] top-1/2 -translate-y-1/2 text-muted font-semibold">₱</span>
            <input value={f.total} inputMode="decimal" placeholder="1050" className={field + ' pl-6 tabular-nums'} onChange={e => setF(x => ({ ...x, total: e.target.value }))} /></span></label>
        <UnitSeg unit={f.unit} onPick={u => setF(x => ({ ...x, unit: u }))} />
        <label className="flex flex-col gap-1"><span className="text-xs text-muted">{f.unit === 'kg' ? 'How many kilos' : 'How many pieces'}</span>
          <input value={f.amount} inputMode="decimal" placeholder={f.unit === 'kg' ? '5' : '30'} className={field + ' tabular-nums'} onChange={e => setF(x => ({ ...x, amount: e.target.value }))} /></label>
      </div>
      <div className="flex justify-end gap-2 text-[15px] text-muted tabular-nums min-h-[22px]">{ok ? perUnit(num(f.total), num(f.amount), f.unit) : null}</div>
      <div className="flex gap-2">
        <button onClick={onRemove} className="min-h-[44px] px-3.5 rounded-xl bg-danger-50 text-danger-500 font-semibold cursor-pointer">Remove</button>
        <button onClick={() => ok ? onDone({ total: num(f.total), amount: num(f.amount), unit: f.unit, bought_on: f.bought_on }) : showToast('Write what was spent and how many', 'info')}
          className="flex-1 min-h-[44px] rounded-xl bg-ink-900 text-chrome-text font-semibold cursor-pointer">Done</button>
      </div>
    </Pop>
  )
}

/** One unit per item, kilos or pieces: changing it asks how many there are now in the new one. */
function UnitPop({ item, onClose, onDone }: { item: BookItem; onClose: () => void; onDone: (v: number, u: StockUnit) => void }) {
  const [unit, setUnit] = useState(item.unit)
  const [val, setVal] = useState(fmtQty(item.quantity))
  const box = useRef<HTMLInputElement>(null)
  useEffect(() => { box.current?.select() }, [])
  const done = () => { const v = num(val); if (Number.isNaN(v) || v < 0) { showToast('Type how many there are now', 'info'); return } onDone(v, unit) }
  return (
    <Pop label={item.name} onClose={onClose}>
      <div className="flex flex-col gap-1"><span className="text-xs text-muted">Counted in</span>
        <div><UnitSeg unit={unit} onPick={setUnit} words /></div></div>
      <label className="flex flex-col gap-1"><span className="text-xs text-muted">{unit === 'kg' ? 'How many kilos are there now' : 'How many pieces are there now'}</span>
        <input ref={box} value={val} inputMode="decimal" placeholder={unit === 'kg' ? 'e.g. 6' : 'e.g. 12'} className={field + ' tabular-nums'}
          onChange={e => setVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') done() }} /></label>
      <button onClick={done} className="min-h-[44px] rounded-xl bg-ink-900 text-chrome-text font-semibold cursor-pointer">Done</button>
    </Pop>
  )
}

/** The paper the staff count on: every item and a blank to write in. */
function CountSheet({ book, items }: { book: Book; items: BookItem[] }) {
  return (
    <div className="print-root hidden print:block p-6 font-sans text-black">
      <h1 className="text-lg font-bold">{book === 'kitchen' ? 'Kitchen' : 'Hotel'} count · {dayName(today())}</h1>
      <table className="w-full mt-3 text-sm border-collapse">
        <thead><tr className="text-left border-b border-black"><th className="py-1">Item</th><th className="py-1 w-40">Counted</th><th className="py-1">Note</th></tr></thead>
        <tbody>{items.map(i => (
          <tr key={i.id} className="border-b border-ink-300"><td className="py-2">{i.name}</td><td className="py-2">______ {i.unit}</td><td /></tr>
        ))}</tbody>
      </table>
    </div>
  )
}
