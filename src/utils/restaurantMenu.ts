import { supabase, isSupabaseConfigured } from './supabaseClient'

// The restaurant and bar menu (board card k70, fed by card k69's tabs).
//
// Typed off the printed menu the hotel actually uses, so staff tap an item
// instead of retyping a description and a price for every order. Prices are
// editable configuration, not code: `saveMenu` keeps the hotel's own copy, the
// same way the breakfast menu works in `rateConfig.ts`.
//
// The DATABASE is the source of truth (`menu_categories` + `menu_items`, seeded
// from the hotel's own printed card), so every tablet shows the same menu and the
// same prices. The list below is only the offline fallback.

export interface MenuItem {
  id: string
  name: string
  price: number
  /** The choices a dish comes with, e.g. "Buttered | Sinagang | Tinola". */
  note?: string
}

export interface MenuCategory {
  id: string
  name: string
  /** Shown small beside the category name, e.g. "6–10am". */
  note?: string
  items: MenuItem[]
}

const KEY = 'daweez_restaurant_menu'

// [category, note, [[item, price, choices?], …]]
type RawRow = [string, number, string?]
const RAW: Array<[string, string, RawRow[]]> = [
  ['Breakfast', '6–10am', [
    ['Cornsilog', 200], ['Hotsilog', 200], ['Porksilog', 200],
    ['Bangsilog', 200], ['Lumpiasilog', 200], ['Beefsilog', 210],
  ]],
  ['Value Meals', 'with rice + swakto soda', [
    ['Sizzling Sisig Meal', 210], ['Lechon Kawali Meal', 200], ['Beef Steak Meal', 250],
  ]],
  ['Rice', '', [['Cup rice', 20], ['Platter rice', 100], ['Fried rice', 180], ['Java rice', 170]]],
  ['Appetizers', '', [['Calamares', 280], ['Shrimp Tempura', 270], ['Pork Lumpia (12 pcs)', 210]]],
  ['Chicken', '', [
    ['Whole Fried Chicken', 490], ['Half Fried Chicken', 290], ['Buttered Chicken', 290],
  ]],
  ['Pork', '', [['Sizzling Sisig', 310], ['Lechon Kawali', 340], ['Crispy Pata', 650]]],
  ['Beef', '', [
    ['Beef Steak', 350], ['Beef with Broccoli', 360], ['Beef with Mushroom', 360],
  ]],
  ['Seafood', '', [
    ['Shrimp', 300, 'Buttered | Sinagang | Tinola'],
    ['Tuna', 300, 'Filipino | Kinilaw | Sinagang | Tinola'],
    ['Tuna Belly', 480],
    ['Pampano', 480, 'Sinagang | Tinola | Fried'],
  ]],
  ['Noodles', '', [['Bam-i', 200], ['Bihon', 200], ['Canton Guisado', 200], ['Sotanghon', 220]]],
  ['Vegetables', '', [['Chopsuey', 250]]],
  ['Salad', '', [['Mix Vegetable', 480, 'cucumber, onion, tomato, chick peas, carrots']]],
  ['Snacks', '', [
    ['Burger', 75, 'chicken or beef patty'],
    ['Burger with cheese', 85],
    ['Double Stacker Burger', 150],
    ['Regular Burger with Fries', 100],
    ['French Fries 200g', 150],
  ]],
  ['Desserts & Shakes', '', [
    ['Halo-halo', 135], ['Mango Shake', 140], ['Ice Cream Scoops', 50],
    ['Avocado Shake', 150], ['Durian Shake', 200], ['Banana Shake', 100], ['Buko Shake', 150],
  ]],
  ['Drinks', 'non-alcoholic', [
    ['Coke / Royal / Sprite', 15], ['Coke / Royal / Sprite 1.25L', 100],
    ['Kopiko Brown 3-in-1', 25], ['Coffee Stick with Cream', 25],
    ['Iced Coffee', 70], ['Iced Milo', 75], ['Hot Milo', 25],
    ['Bottled Water 500ml', 20], ['Iced Tea 1L Pitcher', 120],
  ]],
  ['Beer & Spirits', '', [
    ['San Mig Flavoured Beer (Apple)', 70], ['San Mig Light', 70],
    ['Red Horse Stallion', 70], ['Red Horse 1 Litro', 160], ['Pilsen', 70],
  ]],
]

// Ids are stable and readable ("pork-sizzling-sisig") so a saved line always
// points at something a human can recognise later.
const slug = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)

export const DEFAULT_MENU: MenuCategory[] = RAW.map(([name, note, items]) => ({
  id: slug(name),
  name,
  note: note || undefined,
  items: items.map(([itemName, price, itemNote]) => ({
    id: slug(name) + '-' + slug(itemName),
    name: itemName,
    price,
    note: itemNote,
  })),
}))

// The menu in use: the database when it answers, then this browser's cached copy,
// then the list typed from the printed card.
export async function getMenu(): Promise<MenuCategory[]> {
  if (isSupabaseConfigured) {
    try {
      const [cats, items] = await Promise.all([
        supabase.from('menu_categories').select('*').order('sort_order', { ascending: true }),
        supabase.from('menu_items').select('*').eq('active', true).order('sort_order', { ascending: true }),
      ])
      if (cats.error) throw cats.error
      if (items.error) throw items.error
      if (cats.data && cats.data.length > 0 && items.data) {
        const menu: MenuCategory[] = cats.data
          .map(c => ({
            id: String(c.id),
            name: String(c.name),
            note: c.note ? String(c.note) : undefined,
            items: items.data!
              .filter(i => i.category_id === c.id)
              .map(i => ({
                id: String(i.id),
                name: String(i.name),
                price: Number(i.price),
                note: i.note ? String(i.note) : undefined,
              })),
          }))
          .filter(c => c.items.length > 0)
        if (menu.length > 0) return menu
      }
    } catch (err) {
      console.error('getMenu fell back to the browser store:', err)
    }
  }
  const raw = localStorage.getItem(KEY)
  if (raw) {
    try {
      const saved = JSON.parse(raw) as MenuCategory[]
      if (Array.isArray(saved) && saved.length > 0) return saved
    } catch {
      /* a broken cache falls through to the printed list */
    }
  }
  return DEFAULT_MENU
}

/** Writes the whole menu — prices included — for every device to read. */
export async function saveMenu(menu: MenuCategory[]): Promise<void> {
  try {
    localStorage.setItem(KEY, JSON.stringify(menu))
  } catch (err) {
    console.error('Could not cache the restaurant menu:', err)
  }
  if (!isSupabaseConfigured) return
  try {
    const cats = menu.map((c, i) => ({ id: c.id, name: c.name, note: c.note ?? null, sort_order: i + 1 }))
    const items = menu.flatMap(c =>
      c.items.map((it, j) => ({
        id: it.id,
        category_id: c.id,
        name: it.name,
        price: it.price,
        note: it.note ?? null,
        sort_order: j + 1,
      })),
    )
    const { error: catError } = await supabase.from('menu_categories').upsert(cats)
    if (catError) throw catError
    if (items.length > 0) {
      const { error: itemError } = await supabase.from('menu_items').upsert(items)
      if (itemError) throw itemError
    }
  } catch (err) {
    console.error('Could not save the menu to the database:', err)
  }
}
