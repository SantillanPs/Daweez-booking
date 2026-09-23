import { StatementLineItem } from '../../utils/statement'

const money = (n: number) => '₱' + n.toLocaleString()

/**
 * The charges table of the printed Guest Billing Statement.
 *
 * Extracted from `InvoiceDocument` (which was over the 300-line limit) rather than
 * rewritten: same markup, same column order. The heading is plain **Qty** — it used to
 * read `Qty/Night`, which contradicted the `3 HOURS` a short-stay row prints under it
 * (the owner's S4 ruling). The Unit column is where NIGHT / DAY / BLOCK / 3 HOURS lives.
 */
export function StatementChargesTable({ items }: { items: StatementLineItem[] }) {
  return (
    <div className="py-3 border-t border-soft">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-paper-100 border-y-2 border-slate-600 text-left text-[10px] uppercase tracking-wider text-slate-800">
            <th className="py-1.5 px-2 font-bold">Description</th>
            <th className="py-1.5 px-2 font-bold text-center w-16">Qty</th>
            <th className="py-1.5 px-2 font-bold text-center w-16">Unit</th>
            <th className="py-1.5 px-2 font-bold text-right w-20">Price</th>
            <th className="py-1.5 px-2 font-bold text-center w-20">Discount</th>
            <th className="py-1.5 px-2 font-bold text-right w-24">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.key} className="border-b border-slate-300/60">
              <td className="py-1.5 px-2 text-[13px]">{it.description}</td>
              <td className="py-1.5 px-2 text-center font-mono text-[13px]">{it.qty}</td>
              <td className="py-1.5 px-2 text-center text-[11px] uppercase tracking-wide text-slate-600">{it.unit}</td>
              <td className="py-1.5 px-2 text-right font-mono text-[13px]">{it.price ? money(it.price) : '—'}</td>
              <td className="py-1.5 px-2 text-center text-[11px] text-slate-600">{it.discount ? money(it.discount) : '—'}</td>
              <td className="py-1.5 px-2 text-right font-mono text-[13px]">{money(it.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
