import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Check, RefreshCw, WifiOff } from 'lucide-react'
import { tryAgain, useConnection } from '../utils/connection'

/**
 * The band under the top bar while the hotel's records can't be reached (Sebastian, 2026-11-06,
 * option B of the mock). It is there only while there is something to say: red while lost, green
 * for a moment once back, then it folds away.
 */
export function ConnectionBand() {
  const conn = useConnection()
  const queryClient = useQueryClient()
  const [spin, setSpin] = useState(0)

  // Back: read everything again. What changed meanwhile, on this screen or another, was missed.
  useEffect(() => {
    if (conn === 'back') void queryClient.invalidateQueries()
  }, [conn, queryClient])

  if (conn === 'on') return null
  const back = conn === 'back' || conn === 'closing'
  return (
    <div role="status" className={'cb-band border-t ' + (conn === 'closing' ? 'cb-close ' : '') +
      (back ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-danger-50 text-danger-600 border-danger-200')}>
      <div className="max-w-[1600px] h-11 mx-auto px-4 sm:px-6 flex items-center justify-between gap-3 text-[13px] font-semibold">
        <span className="flex min-w-0 items-center gap-2">
          {back ? <Check className="cb-tick w-4 h-4 shrink-0" aria-hidden="true" /> : <WifiOff className="w-4 h-4 shrink-0" aria-hidden="true" />}
          <span className="truncate">{back ? 'Back online. Everything is saving again.' : 'No connection. Nothing saves until it’s back.'}</span>
        </span>
        {!back && (
          <button type="button" onClick={() => { setSpin(n => n + 1); void tryAgain() }}
            className="flex h-11 shrink-0 items-center gap-1.5 underline underline-offset-2 cursor-pointer">
            <RefreshCw key={spin} className={'w-3.5 h-3.5 ' + (spin ? 'cb-spin' : '')} aria-hidden="true" />
            Try again
          </button>
        )}
      </div>
    </div>
  )
}
