import { Channel } from '../../utils/channelStay'

/** The sign of a stay that came from a booking site: a small square in the site's own colour. */
export function ChannelMark({ channel, className = '' }: { channel: Channel; className?: string }) {
  const airbnb = channel === 'airbnb'
  return (
    <span aria-label={airbnb ? 'From Airbnb' : 'From Booking.com'}
      className={'inline-grid h-[15px] w-[15px] shrink-0 place-items-center rounded-[4px] font-display text-[10px] font-bold leading-none text-white ' + (airbnb ? 'bg-[#E0565B] ' : 'bg-[#003580] ') + className}>
      {airbnb ? 'A' : 'B'}
    </span>
  )
}
