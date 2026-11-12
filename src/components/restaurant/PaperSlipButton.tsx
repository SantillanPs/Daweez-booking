import { FileText } from 'lucide-react'
import { NewTag } from '../NewMark'
import { markSeen } from '../../utils/newMarks'

/** Opens the paper slip (`PaperSlip`): top right of the empty order slip, and of the phone's order bar. */
export function PaperSlipButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" onClick={() => { markSeen('paper-slip'); onOpen() }}
      className="relative shrink-0 inline-flex items-center gap-1.5 min-h-11 pl-2.5 pr-3 rounded-full bg-softbg hover:bg-gold-100 text-[12.5px] font-bold text-main cursor-pointer active:scale-95 transition-[background-color,transform]">
      <FileText className="w-[15px] h-[15px] text-gold-800" />Paper slip
      <NewTag id="paper-slip" />
    </button>
  )
}
