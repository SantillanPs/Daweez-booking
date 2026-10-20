// Self-check for `stayStage`: npx tsx scripts/check_stay_stage.ts
import { stayStage, StayStage } from '../src/utils/stayStage'

const night = { check_in: '2026-10-20', check_out: '2026-10-22' }
const short = { check_in: '2026-10-20', check_out: '2026-10-21', stay_hours: 6 }
const want: [typeof short | typeof night, string, StayStage][] = [
  [night, '2026-10-19', 'before'], [night, '2026-10-20', 'during'], [night, '2026-10-21', 'during'], [night, '2026-10-22', 'after'],
  [short, '2026-10-19', 'before'], [short, '2026-10-20', 'during'], [short, '2026-10-21', 'after'],
]
for (const [b, d, s] of want) {
  const got = stayStage(b, d)
  if (got !== s) throw new Error(JSON.stringify(b) + ' on ' + d + ': ' + got + ', want ' + s)
}
console.log('stayStage ok')
