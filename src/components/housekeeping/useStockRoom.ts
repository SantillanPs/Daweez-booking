import { useCallback, useEffect, useState } from 'react'
import {
  getStockItems, getStockMovements, getAllDishStock, moveStock, saveStockItem, saveDishStock,
  type StockItem, type StockMovement, type DishStockLine,
} from '../../utils/stock'

/**
 * The stock room's data (board card k71, part 1).
 *
 * One place reads the three lists — the items, their movements and the dishes' recipes — and one place writes
 * them, so the screen never holds two versions of the same number. Every write reloads, because a movement
 * changes both the log and the on-hand figure, and the desk must see the new count immediately.
 */
export function useStockRoom() {
  const [items, setItems] = useState<StockItem[]>([])
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [dishStock, setDishStock] = useState<DishStockLine[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    try {
      const [list, log, recipes] = await Promise.all([
        getStockItems(), getStockMovements(300), getAllDishStock(),
      ])
      setItems(list); setMovements(log); setDishStock(recipes); setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The stock room could not be read.')
    } finally {
      setLoading(false)
    }
  }, [])

  // The first read, and the only one the effect does. The state is set in the callbacks, never in the effect
  // body: a synchronous setState inside an effect cascades renders, which is what the hooks lint asks about.
  // Every later read comes from a write the desk just made, through `reload`.
  useEffect(() => {
    let alive = true
    Promise.all([getStockItems(), getStockMovements(300), getAllDishStock()])
      .then(([list, log, recipes]) => {
        if (!alive) return
        setItems(list); setMovements(log); setDishStock(recipes)
      })
      .catch(err => {
        if (alive) setError(err instanceof Error ? err.message : 'The stock room could not be read.')
      })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  /** Stock in. The only movement a person types — everything that goes out comes from a sale. */
  const receive = useCallback(async (
    itemId: string, quantity: number, movedBy: string, note: string,
  ) => {
    await moveStock({ itemId, direction: 'in', quantity, reason: 'Delivery', movedBy, note, source: 'delivery' })
    await reload()
  }, [reload])

  /** Adds an item, or corrects one. */
  const saveItem = useCallback(async (item: Partial<StockItem> & { name: string }) => {
    await saveStockItem(item)
    await reload()
  }, [reload])

  /** Replaces one dish's recipe. */
  const saveRecipe = useCallback(async (menuItemId: string, lines: { item_id: string; quantity: number }[]) => {
    await saveDishStock(menuItemId, lines)
    await reload()
  }, [reload])

  return { items, movements, dishStock, loading, error, reload, receive, saveItem, saveRecipe }
}
