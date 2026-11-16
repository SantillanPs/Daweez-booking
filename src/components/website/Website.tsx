import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Booking, Room, Venue } from '../../types/booking'
import { getRooms, getTakenStays, getVenues } from '../../utils/db'
import { exclusiveCovers, isExclusive, isRoomAvailable } from '../../utils/availability'
import { calculatePricing } from '../../utils/pricing'
import { getEffectiveNightlyPrice } from '../../utils/promoMode'
import { addDays, dateToString, parseDay, pesoWhole } from '../../utils/helpers'
import { getPaymentAccounts } from '../../utils/paymentAccounts'
import { supabase } from '../../utils/supabaseClient'
import logo from '../../assets/logo.png'
import './website.css'

/* The guests' website (/reserve). The photo-first design (Sebastian, 2026-11-17: "apply the new website
   design", mock v8): the hotel's own photos lead, Pension House Exclusive has a stage of its own. A guest
   never books: they leave a request through `request_booking`, the same way the chat bot does, and the
   desk turns it into a booking. Rooms and venues are both asked for that way; a short stay is not, since
   a request holds whole days, so it sends the guest to the desk. */

const PHONE = '0981 358 5500' // Sebastian, 2026-11-17 (the posters' number)
const EMAIL = 'daweezpensionhouse@gmail.com'
const PLACE = 'Purok Kanipaan, San Agustin Sur, City of Tandag, 8300 Surigao del Sur'
const TOWN = 'Tandag City, Surigao del Sur'
const MAP_Q = 'Daweez Pension House, Tandag City, Surigao del Sur'
// ponytail: searches Facebook until we have the page's own m.me link
const MESSENGER = 'https://www.facebook.com/search/top?q=Daweez%20Pension%20House'

// The hotel's own photos (D:\Daweez Photos), resized into public/website. Rooms 1 and 9 were cut out of
// the Facebook posters (2026-11-17). A room type shows the photo of its first room that has one; room 8
// and the Gazebo keep the patterned slot until theirs come.
const ROOM_PHOTOS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const photoOf = (rooms: Room[]) => {
  const n = rooms.map(r => r.room_number).find(n => ROOM_PHOTOS.includes(n))
  return n ? `/website/room-${n}.webp` : undefined
}
const LOOK = [['a', 'look-bar', 'The bar'], ['b', 'look-hall', 'Hallway'], ['c', 'look-bed-2', 'Bedroom'], ['d', 'look-bed-1', 'Bedroom']]
// The new photos (Sebastian, 2026-11-17): the Vacation House and the Garden open a gallery, and "Held here" shows
// real parties. The first two sets were cut out of the hotel's Facebook posters, without their frame or label.
const VH_PICS = ['vacation-house', 'vh-morning', 'vh-night', 'vh-living', 'vh-dining-1', 'vh-kitchen-1', 'vh-kitchen-1b', 'vh-bar', 'vh-pantry', 'vh-kitchen-2', 'vh-dining-2', 'vh-master', 'vh-master-bath', 'vh-upstairs-1', 'vh-upstairs-2']
const GARDEN_PICS = ['garden', 'garden-palms', 'garden-lawn', 'garden-hut']
const HELD: [string, string][] = [['ev-wedding', 'wide'], ['ev-80th', 'land'], ['ev-arch', 'tall'], ['ev-kids', 'land'], ['ev-canopies', 'wide'], ['ev-long-table', 'tall'], ['ev-hall-party', 'land'], ['ev-round-tables', 'tall'], ['ev-dinner', 'tall']]
const PICS_ICON = <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-8 8" /></svg>
type Gal = { title: string; photos: string[]; at: number; from: DOMRect; ask?: (e: React.MouseEvent) => void }
const VH_NOTE = ['The house', 'The house and the ground', 'All of it, everything included']
// "For 2" and "Groups", as in the mock: a room that sleeps two, or one that sleeps more.
const FILTERS: [number, string][] = [[0, 'All'], [2, 'For 2'], [3, 'Groups']]
const fits = (f: number, n: number) => !f || (f === 2 ? n <= 2 : n > 2)
const longDay = (d: string) => parseDay(d).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })
const nightsOf = (a: string, b: string) => Math.max(0, Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 864e5))
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth' })

// A tap anywhere on a date field opens the calendar (Sebastian, 2026-11-17: "make the date easier to use");
// the browser alone opens it only from its small icon. showPicker throws where it isn't allowed, and the
// field still takes typing then.
const openCalendar = (e: React.MouseEvent<HTMLLabelElement>) => {
  try { e.currentTarget.querySelector('input')?.showPicker() } catch { /* typing still works */ }
}

interface RoomType { name: string; rooms: Room[]; sleeps: number; price: number; breakfast: number | null }
/** What a request is for: a room (its first free one) or a venue, with the venue's kind when one was picked. */
interface Ask { id: string; title: string; photo?: string; price: number; venue: boolean; kind?: string; breakfast: number | null; from: DOMRect }
interface Kind { key?: string; label: string; price: number }

/** The day the guest now in that room leaves: the latest check-out of what holds it on those dates. */
function occupiedTill(room: Room, from: string, to: string, list: Booking[]): string | null {
  let till: string | null = null
  for (const b of list) {
    if (b.status === 'cancelled' || b.check_in >= to || b.check_out <= from) continue
    if (b.room_id === room.id || (isExclusive(b) && exclusiveCovers(b, { room_id: room.id }))) if (!till || b.check_out > till) till = b.check_out
  }
  return till
}

/** A peso figure that counts to its new value. Written straight to the text, so counting re-renders nothing. */
function Count({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const shown = useRef(value)
  useLayoutEffect(() => {
    const el = ref.current!, a = shown.current, t0 = performance.now()
    let raf = 0
    const step = (now: number) => {
      const k = reduceMotion() ? 1 : Math.min(1, (now - t0) / 450)
      shown.current = Math.round(a + (value - a) * (1 - (1 - k) ** 3))
      el.textContent = pesoWhole(shown.current)
      if (k < 1) raf = requestAnimationFrame(step)
    }
    el.textContent = pesoWhole(a)
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <span ref={ref} className="num" />
}

/** A row of equal buttons with a block that slides under the pressed one. */
function Slide({ items, on, pick, className }: { items: string[]; on: number; pick: (i: number) => void; className: string }) {
  return (
    <div className={'slide ' + className} style={{ '--n': items.length, '--on': on } as React.CSSProperties} role="group">
      <i />
      {items.map((t, i) => <button key={t} type="button" aria-pressed={on === i} onClick={() => pick(i)}>{t}</button>)}
    </div>
  )
}

const PERSON = <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="4" /><path d="M4 21a8 8 0 0 1 16 0z" /></svg>

export function Website() {
  useEffect(() => {
    document.title = 'Daweez Pension House, Tandag City'
    const link = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Figtree:wght@400;500;600;700&display=swap' })
    document.head.appendChild(link)
    // The top links glide to their section instead of jumping (Sebastian, 2026-11-17). Set on <html>, since that is
    // what scrolls, and only while the website is open so the staff app keeps its own scrolling.
    const html = document.documentElement
    if (!reduceMotion()) html.style.scrollBehavior = 'smooth'
    return () => { link.remove(); html.style.scrollBehavior = '' }
  }, [])

  const today = dateToString(new Date())
  const [checkIn, setCheckIn] = useState(today)
  const [checkOut, setCheckOut] = useState(addDays(today, 1))
  const [people, setPeople] = useState(2)
  const [filter, setFilter] = useState(0)
  const [kind, setKind] = useState(0)
  const [hrsOn, setHrsOn] = useState(0)
  const [exOn, setExOn] = useState(0)
  const [ask, setAsk] = useState<Ask | null>(null)
  const [look, setLook] = useState<{ src: string; from: DOMRect } | null>(null)
  const [gal, setGal] = useState<Gal | null>(null)
  const [solid, setSolid] = useState(false)
  const heroRef = useRef<HTMLElement>(null)
  const nights = nightsOf(checkIn, checkOut)

  // The top bar is clear over the photo and turns white once the photo has scrolled under it.
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setSolid(!e.isIntersecting), { rootMargin: '-64px 0px 0px 0px' })
    io.observe(heroRef.current!)
    return () => io.disconnect()
  }, [])

  // Each part further down rises in once as it scrolls into view (Sebastian, 2026-11-17: "apply all with full").
  const seen = useRef<IntersectionObserver | null>(null)
  const reveal = useCallback((el: HTMLElement | null) => {
    if (!el) return
    seen.current ??= new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); seen.current?.unobserve(e.target) }
    }), { threshold: .15 })
    seen.current.observe(el)
  }, [])
  useEffect(() => () => { seen.current?.disconnect(); seen.current = null }, [])

  const rooms = useQuery<Room[]>({ queryKey: ['rooms'], queryFn: getRooms, staleTime: 5 * 60_000 })
  const venues = useQuery<Venue[]>({ queryKey: ['venues'], queryFn: getVenues, staleTime: 5 * 60_000 })
  const bookings = useQuery<Booking[]>({ queryKey: ['taken-stays'], queryFn: getTakenStays, staleTime: 30_000 })

  const types = useMemo(() => {
    const by = new Map<string, RoomType>()
    for (const r of [...(rooms.data || [])].sort((a, b) => a.room_number - b.room_number)) {
      const t = by.get(r.name) || { name: r.name, rooms: [], sleeps: r.capacity, price: getEffectiveNightlyPrice(r.base_price, r.promo_price), breakfast: r.breakfast_price || null }
      t.rooms.push(r)
      by.set(r.name, t)
    }
    return [...by.values()].sort((a, b) => a.price - b.price)
  }, [rooms.data])

  // Short stays: for each length any room sells, the cheapest price and the rooms that sell it.
  const short = useMemo(() => {
    const list = [...(rooms.data || [])].sort((a, b) => a.room_number - b.room_number)
    return ([[3, 'hour3_price'], [6, 'hour6_price'], [12, 'hour12_price']] as const).map(([h, k]) => {
      const sell = list.filter(r => r[k])
      return { h, price: Math.min(...sell.map(r => r[k]!)), nos: sell.map(r => r.room_number), photo: photoOf(sell) }
    }).filter(s => s.nos.length)
  }, [rooms.data])
  const shortOn = short[Math.min(hrsOn, short.length - 1)]

  const venue = (id: string) => venues.data?.find(v => v.id === id)
  const vh = venue('venue-vacation'), gazebo = venue('venue-gazebo'), garden = venue('venue-garden'), whole = venue('venue-exclusive')

  // The bar says which part the guest is in (Sebastian, 2026-11-17): one gold line slides under that part's link.
  const links = useRef<HTMLDivElement>(null)
  const [here, setHere] = useState('')
  useEffect(() => {
    // the part whose top has passed 40% of the screen; at the very bottom the last part, which is too short to get there
    const pick = () => {
      const parts = [...document.querySelectorAll<HTMLElement>('.dw section[id]')]
      const atEnd = innerHeight + scrollY >= document.documentElement.scrollHeight - 2
      setHere((atEnd ? parts.at(-1) : parts.filter(s => s.getBoundingClientRect().top <= innerHeight * .4).at(-1))?.id ?? '')
    }
    pick()
    addEventListener('scroll', pick, { passive: true })
    return () => removeEventListener('scroll', pick)
  }, [whole])
  useLayoutEffect(() => {
    const box = links.current!
    const place = () => {
      const a = box.querySelector<HTMLElement>(`a[href="#${here}"]:not(.cta)`)
      if (a) { box.style.setProperty('--mx', a.offsetLeft + 'px'); box.style.setProperty('--mw', String(a.offsetWidth)) }
    }
    place()
    const ro = new ResizeObserver(place) // the fonts arrive late and move the links
    ro.observe(box)
    return () => ro.disconnect()
  }, [here, whole])
  const vhKinds: Kind[] = vh ? [{ label: 'House', price: vh.base_price }, ...(vh.details?.types || []).map(t => ({ key: t.key, label: t.label.replace('Vacation House & ', '+ '), price: t.price }))] : []
  const vhKind = vhKinds[Math.min(kind, vhKinds.length - 1)]
  const askVh = (e: React.MouseEvent) => { if (vh && vhKind) askVenue(vh, e, vhKind.key ? `${vh.name} ${vhKind.label.replace('+ ', '& ')}` : vh.name, '/website/vacation-house.webp', vhKind) }
  const grounds = whole?.details?.types?.[0]
  const exKinds: Kind[] = whole ? [{ label: 'Rooms + Gazebo', price: whole.base_price }, ...(grounds ? [{ key: grounds.key, label: 'Everything', price: grounds.price }] : [])] : []
  const exKind = exKinds[Math.min(exOn, exKinds.length - 1)]

  const freeOf = (t: RoomType) => bookings.data ? t.rooms.filter(r => isRoomAvailable(r.id, checkIn, checkOut, bookings.data!)) : t.rooms
  const onDay = checkIn === today ? ' today' : ''
  const changeIn = (v: string) => { setCheckIn(v); if (checkOut <= v) setCheckOut(addDays(v, 1)) }
  const askVenue = (v: Venue, e: React.MouseEvent, title: string, photo?: string, k?: Kind) =>
    setAsk({ id: v.id, title, photo, price: k?.price ?? v.base_price, venue: true, kind: k?.key, breakfast: null, from: e.currentTarget.getBoundingClientRect() })

  return (
    <div className="dw">
      <nav className={solid ? 'solid' : ''}>
        <div className="wrap">
          <a className="brand" href="#top"><img src={logo} alt="" />Daweez</a>
          <div className={'links' + (solid && here ? ' marked' : '')} ref={links}>
            <span className="mark" aria-hidden="true" />
            <a href="#rooms">Rooms</a><a href="#look">Look around</a><a href="#events">Events</a>
            {whole && <a href="#exclusive" className="xl">Exclusive</a>}<a href="#find">Find us</a>
            <a className="cta" href="#rooms">Book</a>
          </div>
        </div>
      </nav>

      <header className="hero" id="top" ref={heroRef}>
        <img className="bg" src="/website/hero.webp" alt="Daweez Pension House at dusk" />
        <div className="wrap">
          <h1>Rest easy in <em>Tandag City.</em></h1>
          <p>10 rooms, a vacation house and a garden for your event.</p>
          {whole && <a className="ribbon" href="#exclusive"><b>Exclusive</b>Have the whole house →</a>}
        </div>
        <div className="where">TANDAG CITY · SURIGAO DEL SUR</div>
      </header>

      <div className="wrap bar">
        <form autoComplete="off" onSubmit={e => { e.preventDefault(); if (!nights) return; setFilter(people <= 2 ? 2 : 3); go('rooms') }}>
          <label className="date" onClick={openCalendar}><span>Check in</span><input type="date" min={today} value={checkIn} onChange={e => e.target.value && changeIn(e.target.value)} /></label>
          <label className="date" onClick={openCalendar}><span>Check out</span><input type="date" min={addDays(checkIn, 1)} value={checkOut} onChange={e => e.target.value && setCheckOut(e.target.value)} /></label>
          <label className="date pick"><span>Guests</span><select value={people} onChange={e => setPeople(+e.target.value)}>
            {Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{i + 1} {i ? 'guests' : 'guest'}</option>)}
          </select><svg className="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg></label>
          <button type="submit">See rooms</button>
        </form>
        <p className="hint num" key={`${checkIn}${checkOut}`}>{nights > 0 ? `${nights} night${nights > 1 ? 's' : ''}, ${longDay(checkIn)} to ${longDay(checkOut)}` : 'Check-out comes after check-in.'}</p>
      </div>

      <section id="rooms"><div className="wrap">
        <div className="head">
          <div><div className="eyebrow">Rooms</div><h2>Pick your room</h2></div>
          <div className="chips">{FILTERS.map(([f, label]) => <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>{label}</button>)}</div>
        </div>
        <div className="rooms" key={filter}>
          {rooms.isLoading && [0, 1, 2].map(i => <div key={i} className="skel" />)}
          {rooms.isError && <p className="empty">The rooms can't be shown right now. Call us on {PHONE} and we'll tell you what's free.</p>}
          {rooms.data && (() => {
            const shown = types.filter(t => fits(filter, t.sleeps))
            if (!shown.length) return <p className="empty">No room this size. Call us on {PHONE}.</p>
            return shown.map((t, i) => {
              const free = nights ? freeOf(t) : t.rooms
              const nos = t.rooms.map(r => r.room_number)
              const till = !free.length ? occupiedTill(t.rooms[0], checkIn, checkOut, bookings.data || []) : null
              const photo = photoOf(t.rooms)
              return (
                <button key={t.name} className={'room' + (free.length ? '' : ' busy')} style={{ animationDelay: i * 50 + 'ms' }} disabled={!free.length}
                  onClick={e => setAsk({ id: free[0].id, title: t.name, photo, price: t.price, venue: false, breakfast: t.breakfast, from: e.currentTarget.getBoundingClientRect() })}>
                  <div className="ph">
                    {photo ? <img src={photo} alt={t.name} loading="lazy" /> : <div className="no"><span>{nos[0]}</span></div>}
                    {bookings.data && nights > 0 && (free.length
                      ? <span key="free" className="tag">{t.rooms.length > 1 ? `${free.length} available${onDay}` : `Available${onDay}`}</span>
                      : <span key="busy" className="tag busy">{till ? `Occupied till ${longDay(till)}` : 'Occupied'}</span>)}
                    {nos.length > 1 && <span className="cnt">{nos.length} rooms</span>}
                  </div>
                  <div className="row"><h3>{t.name}</h3><span className="pr num">{pesoWhole(t.price)}<small> a night</small></span></div>
                  <div className="meta"><span>Room {nos.join(', ')}</span>
                    <span className="ppl" title={`Up to ${t.sleeps}`} aria-label={`Up to ${t.sleeps} people`}>{Array.from({ length: t.sleeps }, (_, k) => <i key={k}>{PERSON}</i>)}</span></div>
                </button>
              )
            })
          })()}
        </div>

        {shortOn && (
          <div className="short">
            <div className="sp">
              {shortOn.photo && <img src={shortOn.photo} alt="A short-stay room" loading="lazy" />}
              <span className="clock" style={{ '--h': shortOn.h } as React.CSSProperties} aria-hidden="true"><b>{shortOn.h}h</b></span>
            </div>
            <div className="sb">
              <div className="eyebrow">Short stay</div>
              <h3>Just a few hours?</h3>
              <Slide className="hrs" items={short.map(s => `${s.h} hrs`)} on={short.indexOf(shortOn)} pick={setHrsOn} />
              <div className="sprice"><Count value={shortOn.price} /><small>Room{shortOn.nos.length > 1 ? 's' : ''} {shortOn.nos.join(', ')}</small></div>
              <button className="sask" onClick={() => go('find')}>Ask for {shortOn.h} hours</button>
            </div>
          </div>
        )}
      </div></section>

      <section id="look"><div className="wrap">
        <div className="head rv" ref={reveal}><div><div className="eyebrow">Look around</div><h2>Inside Daweez</h2></div></div>
        <div className="look rvg" ref={reveal}>
          {LOOK.map(([c, f, label]) => (
            <button key={c} className={c} onClick={e => setLook({ src: `/website/${f}.webp`, from: e.currentTarget.getBoundingClientRect() })}>
              <img src={`/website/${f}.webp`} alt={label} loading="lazy" /><small>{label}</small>
            </button>
          ))}
        </div>
      </div></section>

      {(vh || gazebo || garden) && (
        <section className="events" id="events"><div className="wrap">
          <div className="rv" ref={reveal}><div className="eyebrow">Events</div><h2>Your party, our grounds</h2></div>
          <div className="ev rvg" ref={reveal}>
            {vh && vhKind && (
              <div className="vh">
                <img src="/website/vacation-house.webp" alt="The Vacation House" loading="lazy" />
                <button className="open" aria-label={`See ${VH_PICS.length} photos of the ${vh.name}`}
                  onClick={e => setGal({ title: vh.name, photos: VH_PICS, at: 0, from: e.currentTarget.getBoundingClientRect(), ask: askVh })}>
                  <span className="pics">{PICS_ICON}{VH_PICS.length}</span>
                </button>
                <div className="in">
                  <h3>{vh.name}</h3>
                  {vhKinds.length > 1 && <Slide className="kinds" items={vhKinds.map(k => k.label)} on={vhKinds.indexOf(vhKind)} pick={setKind} />}
                  <div className="price"><Count value={vhKind.price} /><small>a day</small>
                    <button className="ask" onClick={askVh}>Ask</button></div>
                  <div className="what">{VH_NOTE[vhKinds.indexOf(vhKind)] || ''}</div>
                </div>
              </div>
            )}
            {[gazebo, garden].map(v => v && (
              <button key={v.id} className="cell" onClick={e => v.id === 'venue-garden'
                ? setGal({ title: v.name, photos: GARDEN_PICS, at: 0, from: e.currentTarget.getBoundingClientRect(), ask: e2 => askVenue(v, e2, v.name, '/website/garden.webp') })
                : askVenue(v, e, v.name)}>
                {v.id === 'venue-garden' ? <><img src="/website/garden.webp" alt="The Garden Area" loading="lazy" /><span className="pics">{PICS_ICON}{GARDEN_PICS.length}</span></> : <div className="none">G</div>}
                <div className="in"><h3>{v.name}</h3><b className="num">{pesoWhole(v.base_price)}</b></div>
              </button>
            ))}
          </div>
          <div className="held rv" ref={reveal}>
            <div className="hh"><h3>Held here</h3><span>Swipe →</span></div>
            <div className="strip">
              {HELD.map(([p, shape], i) => (
                <button key={p} className={shape} aria-label={`Party photo ${i + 1}`}
                  onClick={e => setGal({ title: 'Held here', photos: HELD.map(h => h[0]), at: i, from: e.currentTarget.getBoundingClientRect() })}>
                  <img src={`/website/${p}.webp`} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          </div>
        </div></section>
      )}

      {whole && exKind && (
        <section className="xsec" id="exclusive">
          <div className="excl">
            <img className="xbg" src="/website/hero.webp" alt="" loading="lazy" />
            <svg className="seal" viewBox="0 0 120 120" aria-hidden="true">
              <defs><path id="dw-ring" d="M60 60m-46 0a46 46 0 1 1 92 0a46 46 0 1 1-92 0" /></defs>
              <circle cx="60" cy="60" r="58" fill="#D0AB60" />
              <g className="spin"><text><textPath href="#dw-ring">ONE GROUP · NO OTHER GUESTS · EXCLUSIVE ·</textPath></text></g>
              <text x="60" y="71" textAnchor="middle" className="sd">D</text>
            </svg>
            <div className="xin rvg" ref={reveal}>
              <div className="eyebrow">{whole.name}</div>
              <h2 className="xh">Have Daweez <em>all to yourselves.</em></h2>
              {exKinds.length > 1 && <Slide className="ekinds" items={exKinds.map(k => k.label)} on={exKinds.indexOf(exKind)} pick={setExOn} />}
              <p className="xinc">Every room and the Gazebo <span className={'xmore' + (exKind.key ? ' on' : '')}>+ the Vacation House &amp; Garden</span></p>
              <div className="xfoot"><span className="xprice"><Count value={exKind.price} /></span><small>a day</small>
                <button className="ask" onClick={e => askVenue(whole, e, exKind.key ? `${whole.name}, everything` : whole.name, '/website/hero.webp', exKind)}>Ask</button></div>
            </div>
          </div>
        </section>
      )}

      <section><div className="wrap">
        <div className="head rv" ref={reveal}><div><div className="eyebrow">Booking</div><h2>Three steps</h2></div></div>
        <div className="steps rvg" ref={reveal}>
          <div><b>Send a request</b><span>Pick a room and dates. Nothing is charged yet.</span></div>
          <div><b>The desk confirms</b><span>We call or message you to say it's yours.</span></div>
          <div><b>Pay half to keep it</b><span>By GCash or bank. Check in from 2 PM.</span></div>
        </div>
      </div></section>

      <section id="find"><div className="wrap find">
        <div className="pic">
          <iframe title="Map" loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={`https://www.google.com/maps?q=${encodeURIComponent(MAP_Q)}&output=embed`} />
          <a href={`https://www.google.com/maps/search/${encodeURIComponent(MAP_Q)}`} target="_blank" rel="noopener">Directions ↗</a>
        </div>
        <dl>
          <div><div className="eyebrow">Find us</div><h2>Come over</h2></div>
          <div><dt>Address</dt><dd>{PLACE} <Copy text={PLACE} /></dd></div>
          <div><dt>Phone</dt><dd><a className="num" href={`tel:${PHONE.replace(/\D/g, '')}`}>{PHONE}</a> <Copy text={PHONE} /></dd></div>
          <div><dt>Email</dt><dd><a href={`mailto:${EMAIL}`}>{EMAIL}</a> <Copy text={EMAIL} /></dd></div>
          <div><dt>Messenger</dt><dd>Daweez Pension House <a className="msg" href={MESSENGER} target="_blank" rel="noopener">Message us</a></dd></div>
        </dl>
      </div></section>

      <footer><div className="wrap"><a className="brand" href="#top"><img src={logo} alt="" />Daweez Pension House</a><span>Open 24 hours. {TOWN}.</span></div>
        {/* the maker's credit, its own quiet row at the very bottom (Sebastian, 2026-11-17) */}
        <div className="wrap by"><span>Designed &amp; built by <b>Sebastian Santillan</b></span>
          <span className="socials">
            <a href="https://github.com/SantillanPs" target="_blank" rel="noopener" aria-label="Sebastian on GitHub"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.4-4-1.4-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.3-3.1-.2-.4-.6-1.6.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.6 18.3 5 18.3 5c.7 1.6.2 2.9.1 3.2.8.8 1.3 1.9 1.3 3.1 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3" /></svg></a>
            <a href="https://www.linkedin.com/in/sebastian-santillan-366841260/" target="_blank" rel="noopener" aria-label="Sebastian on LinkedIn"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.4 20.5h-3.6v-5.6c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9v5.7H9.3V9h3.4v1.6c.5-.9 1.6-1.8 3.4-1.8 3.6 0 4.3 2.4 4.3 5.5v6.2zM5.3 7.4a2.1 2.1 0 1 1 0-4.1 2.1 2.1 0 0 1 0 4.1zM7.1 20.5H3.5V9h3.6v11.5zM22.2 0H1.8C.8 0 0 .8 0 1.7v20.6c0 .9.8 1.7 1.8 1.7h20.4c1 0 1.8-.8 1.8-1.7V1.7C24 .8 23.2 0 22.2 0z" /></svg></a>
          </span></div></footer>

      {ask && <RequestSheet ask={ask} checkIn={checkIn} checkOut={checkOut} people={people}
        rooms={rooms.data || []} venues={venues.data || []} onClose={() => setAsk(null)} />}
      {look && <Lightbox {...look} onClose={() => setLook(null)} />}
      {gal && <Gallery {...gal} onClose={() => setGal(null)} />}
    </div>
  )
}

/** The tapped photo grows from its tile to fill the screen, and shrinks back to it on close. */
function Lightbox({ src, from, onClose }: { src: string; from: DOMRect; onClose: () => void }) {
  const img = useRef<HTMLImageElement>(null)
  const [on, setOn] = useState(false)
  const toTile = () => {
    const el = img.current!, f = el.getBoundingClientRect()
    el.style.transform = `translate(${from.left + from.width / 2 - (f.left + f.width / 2)}px,${from.top + from.height / 2 - (f.top + f.height / 2)}px) scale(${from.width / f.width})`
  }
  const close = () => { img.current!.style.transform = 'none'; toTile(); setOn(false); setTimeout(onClose, reduceMotion() ? 0 : 400) }
  const grow = () => {
    const el = img.current!
    el.style.transition = 'none'
    toTile()
    requestAnimationFrame(() => requestAnimationFrame(() => { el.style.transition = ''; el.style.transform = 'none'; setOn(true) }))
  }
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return <>
    <div className={'scrim' + (on ? ' open' : '')} />
    <div className={'lb' + (on ? ' on' : '')} onClick={close}><img ref={img} src={src} alt="" onLoad={grow} /></div>
  </>
}

/** A set of photos that grows from what was tapped and swipes like a phone's photos: one photo a screen, arrows on a
 * computer, small photos along the bottom to jump. A venue's set has Ask, which opens its request. */
function Gallery({ title, photos, at, from, ask, onClose }: Gal & { onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null), track = useRef<HTMLDivElement>(null), thumbs = useRef<HTMLDivElement>(null)
  const [on, setOn] = useState(false)
  const [cur, setCur] = useState(at)
  const close = () => { setOn(false); setTimeout(onClose, 300) }
  const go = (i: number) => {
    const t = track.current!
    t.scrollTo({ left: Math.max(0, Math.min(photos.length - 1, i)) * t.clientWidth, behavior: reduceMotion() ? 'auto' : 'smooth' })
  }

  useLayoutEffect(() => {
    box.current!.style.setProperty('--ox', from.left + from.width / 2 + 'px')
    box.current!.style.setProperty('--oy', from.top + from.height / 2 + 'px')
    track.current!.scrollLeft = at * track.current!.clientWidth
    requestAnimationFrame(() => setOn(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    thumbs.current?.children[cur]?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: reduceMotion() ? 'auto' : 'smooth' })
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowRight') go(cur + 1)
      if (e.key === 'ArrowLeft') go(cur - 1)
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur])

  return <>
    <div className={'scrim dark' + (on ? ' open' : '')} onClick={close} />
    <div ref={box} className={'gal' + (on ? ' open' : '')} role="dialog" aria-modal="true" aria-label={title}>
      <div className="gbar">
        <h3>{title}</h3><span className="gn num">{cur + 1} / {photos.length}</span>
        {ask && <button className="ask" onClick={e => { ask(e); onClose() }}>Ask</button>}
        <button className="gx" aria-label="Close" onClick={close}>×</button>
      </div>
      <div className="gmid">
        <div className="gtrack" ref={track} onScroll={e => { const t = e.currentTarget, i = Math.round(t.scrollLeft / t.clientWidth); if (i !== cur) setCur(i) }}>
          {photos.map((p, i) => <figure key={p}><img src={`/website/${p}.webp`} alt="" loading={i === at ? 'eager' : 'lazy'} /></figure>)}
        </div>
        <button className="garr l" aria-label="Previous photo" disabled={cur === 0} onClick={() => go(cur - 1)}>←</button>
        <button className="garr r" aria-label="Next photo" disabled={cur === photos.length - 1} onClick={() => go(cur + 1)}>→</button>
      </div>
      <div className="thumbs" ref={thumbs}>
        {photos.map((p, i) => <button key={p} aria-label={`Photo ${i + 1}`} aria-current={i === cur} onClick={() => go(i)}><img src={`/website/${p}.webp`} alt="" loading="lazy" /></button>)}
      </div>
    </div>
  </>
}

function Copy({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  return <button className={'copy' + (done ? ' done' : '')} onClick={async () => {
    try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1600) } catch { /* the text stays on screen to copy by hand */ }
  }}>{done ? 'Copied' : 'Copy'}</button>
}

const REFUSED: Record<string, string> = {
  ROOM_UNAVAILABLE: 'Someone already has it for those dates. Pick other dates, or another room.',
  TOO_MANY_REQUESTS: 'You already have requests waiting. The desk will call you soon.',
  BAD_DATES: 'Those dates can no longer be booked. Pick dates from today on.',
  BAD_DETAILS: 'Check your name and number, then send again.',
}

function RequestSheet({ ask, checkIn, checkOut, people, rooms, venues, onClose }: {
  ask: Ask; checkIn: string; checkOut: string; people: number; rooms: Room[]; venues: Venue[]; onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [companions, setCompanions] = useState('')
  const [breakfast, setBreakfast] = useState(false)
  const [errs, setErrs] = useState<{ name?: string; phone?: string; companions?: string; form?: string }>({})
  const [sent, setSent] = useState(false)
  const days = nightsOf(checkIn, checkOut)
  const unit = ask.venue ? 'day' : 'night'
  // A venue is never asked for a headcount or companions (the same rule as the chat bot).
  const party = ask.venue ? 1 : people
  const total = calculatePricing(ask.venue
    ? { venueId: ask.id, eventAddons: { venue_type: ask.kind }, checkIn, checkOut, guestEmail: '', source: 'website', rooms, venues }
    : { roomId: ask.id, checkIn, checkOut, guestEmail: '', source: 'website', breakfastEnabled: breakfast, rooms, venues }).grandTotal
  const deposit = Math.round(total / 2)
  const pay = getPaymentAccounts()

  const close = () => { setOpen(false); setTimeout(onClose, 300) }

  // The sheet grows from what was tapped.
  useLayoutEffect(() => {
    const el = ref.current!, from = ask.from
    const left = innerWidth - 16 - el.offsetWidth, top = innerHeight - 16 - el.offsetHeight
    el.style.setProperty('--ox', from.left + from.width / 2 - left + 'px')
    el.style.setProperty('--oy', from.top + from.height / 2 - top + 'px')
    requestAnimationFrame(() => setOpen(true))
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('keydown', esc)
    setTimeout(() => el.querySelector('input')?.focus({ preventScroll: true }), 350)
    return () => document.removeEventListener('keydown', esc)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    const names = companions.split(/[,\n]/).map(s => s.trim()).filter(Boolean)
    const next = {
      name: name.trim() ? undefined : 'Write your name so the desk knows who to look for.',
      phone: phone.replace(/\D/g, '').length >= 10 ? undefined : 'Write a number we can call, like 0917 482 3361.',
      companions: party > 1 && names.length < party - 1 ? `Write the name of everyone coming with you (${party - 1}), separated by commas.` : undefined,
    }
    setErrs(next)
    if (next.name || next.phone || next.companions) return
    // Shown at once and taken back if the database refuses (the app's rule: buttons never wait).
    setSent(true)
    const note = ask.venue ? (ask.kind ? `Wants ${ask.title}` : null) : breakfast ? 'Wants breakfast' : null
    const { error } = await supabase.rpc('request_booking', {
      p_source: 'website', p_room_id: ask.id, p_check_in: checkIn, p_check_out: checkOut,
      p_guest_name: name.trim(), p_phone: phone.trim(), p_guests: ask.venue ? null : people, p_note: note,
      p_quoted_total: total, p_language: 'en', p_companions: names,
    })
    if (error) {
      setSent(false)
      const code = Object.keys(REFUSED).find(k => error.message?.includes(k))
      setErrs({ form: code ? REFUSED[code] : `The request didn't go through. Check your connection and try again, or call ${PHONE}.` })
    }
  }

  return <>
    <div className={'scrim' + (open ? ' open' : '')} onClick={close} />
    <div ref={ref} className={'sheet' + (open ? ' open' : '')} role="dialog" aria-modal="true" aria-labelledby="dw-sheet">
      <div className="sph">
        {ask.photo ? <img src={ask.photo} alt="" /> : <div className="no" />}
        <button className="x" aria-label="Close" onClick={close}>×</button>
      </div>
      {!sent ? <div className="sbody">
        <h3 id="dw-sheet">{ask.title}</h3>
        <p className="when num">{longDay(checkIn)} to {longDay(checkOut)}{ask.venue ? '' : ` · ${people} ${people > 1 ? 'people' : 'person'}`}</p>
        <form className="form" noValidate onSubmit={send}>
          <div className="f"><label htmlFor="dw-nm">Your name</label><input id="dw-nm" placeholder="e.g. Maria Santos" autoComplete="name" value={name} onChange={e => setName(e.target.value)} />{errs.name && <span className="err">{errs.name}</span>}</div>
          <div className="f"><label htmlFor="dw-ph">Mobile number</label><input id="dw-ph" inputMode="tel" placeholder="e.g. 0917 482 3361" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} />{errs.phone && <span className="err">{errs.phone}</span>}</div>
          {party > 1 && <div className="f"><label htmlFor="dw-cp">Who is coming with you</label><input id="dw-cp" placeholder="e.g. Jose Santos, Ana Santos" value={companions} onChange={e => setCompanions(e.target.value)} />{errs.companions && <span className="err">{errs.companions}</span>}</div>}
          {ask.breakfast && <div className="switch"><span>Breakfast every morning <span className="num faint">{pesoWhole(ask.breakfast)}</span></span>
            <button type="button" aria-pressed={breakfast} aria-label="Breakfast" onClick={() => setBreakfast(b => !b)} /></div>}
          <div className="sum num">
            <div><span>{pesoWhole(ask.price)} × {days} {unit}{days > 1 ? 's' : ''}</span><span>{pesoWhole(ask.price * days)}</span></div>
            {total > ask.price * days && <div><span>Breakfast</span><span>{pesoWhole(total - ask.price * days)}</span></div>}
            <div className="tot"><span>Total</span><Count value={total} /></div>
            <div className="dep"><span>Half to keep it</span><Count value={deposit} /></div>
          </div>
          {errs.form && <p className="err">{errs.form}</p>}
          <button className="send" type="submit">Send request</button>
        </form>
      </div> : <div className="sbody done-box">
        <svg className="tick" viewBox="0 0 72 72"><circle cx="36" cy="36" r="36" /><path d="M22 37l10 10 19-21" /></svg>
        <h3>Request sent</h3>
        <p>Thank you, {name.trim().split(' ')[0]}. The desk will call {phone.trim()} to confirm the {ask.title}.</p>
        <div className="pay">
          <p className="num strong">Once confirmed, send {pesoWhole(deposit)} to:</p>
          {pay.gcashNumber && <div><b>GCash</b>{pay.gcashName} · <span className="num">{pay.gcashNumber}</span></div>}
          {pay.bankAccountNumber && <div><b>{pay.bankName}</b>{pay.bankAccountName} · <span className="num">{pay.bankAccountNumber}</span></div>}
        </div>
      </div>}
    </div>
  </>
}
