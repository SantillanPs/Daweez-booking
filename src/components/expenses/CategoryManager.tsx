import React, { useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { ExpenseCategory } from '../../types/expense'

interface CategoryManagerProps {
  categories: ExpenseCategory[]
  onAdd: (name: string) => Promise<void>
  onRemove: (category: ExpenseCategory) => void
  onClose: () => void
}

// The list of things money is spent on — the chips on the day screen.
export function CategoryManager({ categories, onAdd, onRemove, onClose }: CategoryManagerProps) {
  const [name, setName] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    await onAdd(name.trim())
    setName('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="bg-card w-full max-w-md rounded-xl border border-soft shadow-xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-3.5 border-b border-soft flex items-center justify-between bg-page">
          <h3 className="text-sm font-bold text-main">Categories</h3>
          <button onClick={onClose} aria-label="Close" className="text-muted hover:text-main transition-colors cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 overflow-y-auto max-h-[50vh]">
          {categories.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <span key={cat.id} className="inline-flex items-center gap-1.5 bg-page border border-soft text-main text-xs font-semibold px-3 py-1.5 rounded-lg">
                  {cat.name}
                  <button type="button" onClick={() => onRemove(cat)} aria-label={'Remove ' + cat.name} className="text-muted hover:text-danger-600 transition-colors cursor-pointer">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted text-center py-4">No categories yet.</p>
          )}
        </div>

        <form onSubmit={submit} className="p-5 border-t border-soft bg-page flex gap-2">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="New category"
            aria-label="New category"
            className="flex-1 bg-card border border-soft text-main px-3 py-2 rounded-lg text-sm outline-none focus:border-gold-500"
          />
          <button type="submit" disabled={!name.trim()}
            className="bg-gold-400 hover:bg-gold-600 text-ink-900 text-sm font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5 shrink-0">
            <Plus className="w-4 h-4" /> Add
          </button>
        </form>
      </div>
    </div>
  )
}
