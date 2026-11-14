import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../utils/supabaseClient'
import { getBookItems, getStockIn, readStockInExpenses, type BookItem, type StockInLine } from '../../utils/stockBook'

/** The logbook's data, following the database live: the kitchen and the restaurant change the counts too
 *  (a sale takes its dish's recipe off), and several staff use the screen at once. Writes lay their change
 *  over these lists first and read again behind it. */
export function useInventoryBook() {
  const [items, setItems] = useState<BookItem[]>([])
  const [lines, setLines] = useState<StockInLine[]>([])
  const [expensesOn, setExpensesOn] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const reload = useCallback(() => Promise.all([getBookItems(), getStockIn(), readStockInExpenses()])
    .then(([i, l, e]) => { setItems(i); setLines(l); setExpensesOn(e); setLoaded(true) })
    .catch(() => {}), [])

  useEffect(() => {
    void reload()
    const channel = supabase.channel('inventory-book-' + Math.random().toString(36).slice(2))
    for (const table of ['inventory_items', 'stock_in', 'app_settings'])
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => { void reload() })
    channel.subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [reload])

  return { items, setItems, lines, setLines, expensesOn, setExpensesOn, loaded, reload }
}
