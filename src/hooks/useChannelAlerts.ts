import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../utils/supabaseClient'
import { ChannelAlert, readChannelAlerts } from '../utils/channelStay'

/** What the calendar links are asking the desk, following the database live. `answered` takes one
 *  off the screen at once, and `refresh` reads again (a failed answer puts it back). */
export function useChannelAlerts() {
  const [alerts, setAlerts] = useState<ChannelAlert[]>([])
  const refresh = useCallback(() => { void readChannelAlerts().then(setAlerts) }, [])
  const answered = useCallback((id: string) => setAlerts(list => list.filter(a => a.id !== id)), [])

  useEffect(() => {
    refresh()
    const channel = supabase
      .channel('channel-alerts-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'channel_alerts' }, refresh)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [refresh])

  return { alerts, answered, refresh }
}
