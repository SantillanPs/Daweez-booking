import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bot, BotOff } from 'lucide-react'
import { readAppSetting, writeAppSetting } from '../../utils/appSettings'
import { showToast } from '../../utils/toast'
import { markSeen } from '../../utils/newMarks'
import { NewTag } from '../NewMark'

const KEY = ['app_settings', 'chat_bot']

/**
 * **The guests' chat bot, on or off** (Sebastian, 2026-11-15: "add a way to disable the AI chatbot in the
 * front desk"). One tap switches it, saved behind; Undo takes it back. On, it is a quiet icon; off, it says
 * "Bot off" in red, so nobody forgets the guests on Messenger are waiting for a person.
 */
export function ChatBotSwitch() {
  const qc = useQueryClient()
  const { data: on = true } = useQuery({
    queryKey: KEY,
    queryFn: async () => (await readAppSetting<{ on?: boolean }>('chat_bot'))?.on !== false,
  })

  const set = (next: boolean, undo = true) => {
    qc.setQueryData(KEY, next)
    writeAppSetting('chat_bot', { on: next }).catch(() => {
      qc.setQueryData(KEY, !next)
      showToast('Could not switch the chat bot. Try again.', 'error')
    })
    if (undo) showToast(next ? 'Chat bot on: it answers the guests again' : 'Chat bot off: reply to the guests on Messenger yourselves', 'info',
      { label: 'Undo', run: () => set(!next, false) })
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => { markSeen('chat-bot-switch'); set(!on) }}
        aria-pressed={on} title={on ? 'Chat bot on. Tap to switch it off' : 'Chat bot off. Tap to switch it on'}
        aria-label={on ? 'Chat bot on' : 'Chat bot off'}
        className={'h-8 inline-flex items-center gap-1.5 rounded-full text-[13px] font-bold active:scale-95 transition-[background-color,color,transform] cursor-pointer '
          + (on ? 'w-8 justify-center text-muted hover:text-main hover:bg-softbg' : 'px-2.5 bg-red-50 text-red-700 hover:bg-red-100')}>
        {on ? <Bot aria-hidden="true" className="w-4 h-4" strokeWidth={2.2} />
          : <><BotOff aria-hidden="true" className="w-4 h-4" strokeWidth={2.2} />Bot off</>}
      </button>
      <NewTag id="chat-bot-switch" />
    </div>
  )
}
