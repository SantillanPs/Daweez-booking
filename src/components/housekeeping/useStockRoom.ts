import { useCallback, useEffect, useState } from 'react'
import { getStockItems, getAllDishStock, saveDishStock, type StockItem, type DishStockLine } from '../../utils/stock'

/**
 * What a dish uses: the stock items and every dish's recipe. The counts and stock in live in the logbook
 * (`useInventoryBook`); this screen only says what a sale takes off.
 */
export function useStockRoom() {
  const [items, setItems] = useState<StockItem[]>([])
  const [dishStock, setDishStock] = useState<DishStockLine[]>([])

  const reload = useCallback(() => Promise.all([getStockItems(), getAllDishStock()])
    .then(([list, recipes]) => { setItems(list); setDishStock(recipes) })
    .catch(() => {}), [])

  useEffect(() => { void reload() }, [reload])

  /** Replaces one dish's recipe. */
  const saveRecipe = useCallback(async (menuItemId: string, lines: { item_id: string; quantity: number }[]) => {
    await saveDishStock(menuItemId, lines)
    await reload()
  }, [reload])

  return { items, dishStock, saveRecipe }
}
