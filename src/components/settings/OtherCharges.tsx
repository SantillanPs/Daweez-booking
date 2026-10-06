import React from 'react'
import { RateConfig, PaymentAccounts } from '../../types/booking'
import { Field } from '../walk-in/Field'
import { FIELD } from '../walk-in/formStyles'
import { Figure, FieldGrid, Section, TimeField } from './parts'

interface OtherChargesProps {
  rates: RateConfig
  onRate: (patch: Partial<RateConfig>) => void
  pay: PaymentAccounts
  onPay: (patch: Partial<PaymentAccounts>) => void
}

/**
 * One line of an account: its label above the box. An empty box is empty — each used to
 * show the hotel's own account in grey as an example, so a second bank account nobody had
 * filled in looked filled in, and printed nothing.
 */
function PayLine({ label, value, onChange, wide = false }: {
  label: string; value: string; onChange: (v: string) => void; wide?: boolean
}) {
  return (
    <Field label={label} className={wide ? 'sm:col-span-2' : ''}>
      <input value={value} onChange={e => onChange(e.target.value)} className={FIELD} />
    </Field>
  )
}

/**
 * One place a guest can send money: its name, then its lines. A bank's lines each take
 * the whole width — the account name is long, and it is printed from what is read here,
 * so nothing may be cut off.
 */
function PayGroup({ name, note, children }: { name: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="py-4">
      <p className="mb-2.5 text-[15px] font-semibold text-main">
        {name}{note && <span className="font-normal text-muted"> {note}</span>}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </div>
  )
}

/**
 * Everything that is not a room's own price: the venues, the arrival and departure
 * rules, the things a guest can add, where the guest sends money, and the two figures
 * that exist only for the Earnings Report.
 *
 * One part per KIND of money, in the order the desk meets it (the owner's design,
 * 2026-09). On a wide screen the prices run down the left and the accounts down the
 * right, so the page is half as long; on a narrow one they follow each other in that
 * same order.
 */
export function OtherCharges({ rates, onRate, pay, onPay }: OtherChargesProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-9 items-start">
      <div className="space-y-9">
        <Section title="Venues">
          <FieldGrid>
            <Figure label="Vacation House, per hour" value={rates.venueHourlyRate} onChange={v => onRate({ venueHourlyRate: v })} />
            <Figure label="Gazebo / Garden block, hours" unit="hrs" value={rates.venueDayBlockHours} onChange={v => onRate({ venueDayBlockHours: v })} />
            <Figure label="Gazebo / Garden, per block" placeholder="Venue's own price" value={rates.dayBlockRate} onChange={v => onRate({ dayBlockRate: v })} />
          </FieldGrid>
        </Section>

        <Section title="Arrival & departure">
          <FieldGrid>
            <TimeField label="Standard check-in" value={rates.standardCheckInTime} onChange={v => onRate({ standardCheckInTime: v })} />
            <TimeField label="Standard check-out" value={rates.standardCheckOutTime} onChange={v => onRate({ standardCheckOutTime: v })} />
            <Figure label="Early / late, per hour (rooms)" value={rates.lateEarlyRatePesos} onChange={v => onRate({ lateEarlyRatePesos: v })} />
            <Figure label="After this many hours, a whole night" unit="hrs" value={rates.lateEarlyCapHours} onChange={v => onRate({ lateEarlyCapHours: v })} />
            <Figure label="Security deposit" value={rates.securityDeposit} onChange={v => onRate({ securityDeposit: v })} />
          </FieldGrid>
        </Section>

        <Section title="Things guests can add">
          <FieldGrid>
            <Figure label="Extra foam · per night" value={rates.foamRate} onChange={v => onRate({ foamRate: v })} />
            <Figure label="Extra pillow · per night" value={rates.pillowRate} onChange={v => onRate({ pillowRate: v })} />
            <Figure label="Extra blanket · per night" value={rates.blanketRate} onChange={v => onRate({ blanketRate: v })} />
            <Figure label="Extra towel · per night" value={rates.towelRate} onChange={v => onRate({ towelRate: v })} />
            <Figure label="Mineral water" value={rates.mineralWaterRate} onChange={v => onRate({ mineralWaterRate: v })} />
            <Figure label="Big table (event)" value={rates.bigTableRate} onChange={v => onRate({ bigTableRate: v })} />
            <Figure label="Small table (event)" value={rates.smallTableRate} onChange={v => onRate({ smallTableRate: v })} />
            <Figure label="Chair (event)" value={rates.chairRate} onChange={v => onRate({ chairRate: v })} />
            <Figure label="Tent (event)" value={rates.tentRate} onChange={v => onRate({ tentRate: v })} />
          </FieldGrid>
        </Section>
      </div>

      <div className="space-y-9">
        <Section title="Where guests pay" fact="Printed on the guest's statement and shown on the booking portal.">
          <div className="border-y border-soft divide-y divide-soft">
            <PayGroup name="GCash">
              <PayLine label="Account name" value={pay.gcashName} onChange={v => onPay({ gcashName: v })} />
              <PayLine label="Number" value={pay.gcashNumber} onChange={v => onPay({ gcashNumber: v })} />
            </PayGroup>
            <PayGroup name="Bank transfer">
              <PayLine wide label="Bank" value={pay.bankName} onChange={v => onPay({ bankName: v })} />
              <PayLine wide label="Account name" value={pay.bankAccountName} onChange={v => onPay({ bankAccountName: v })} />
              <PayLine wide label="Account number" value={pay.bankAccountNumber} onChange={v => onPay({ bankAccountNumber: v })} />
            </PayGroup>
            {/* A SECOND bank account (the owner, 2026-09): his own PGO bill lists two, and a
                government office pays into whichever one its paperwork names. Both print on
                the agency statement; leave these empty and only the first is used. */}
            <PayGroup name="Second bank account" note="(agency bills)">
              <PayLine wide label="Bank" value={pay.bank2Name} onChange={v => onPay({ bank2Name: v })} />
              <PayLine wide label="Account name" value={pay.bank2AccountName} onChange={v => onPay({ bank2AccountName: v })} />
              <PayLine wide label="Account number" value={pay.bank2AccountNumber} onChange={v => onPay({ bank2AccountNumber: v })} />
            </PayGroup>
          </div>
        </Section>

        {/* Report-only, kept apart on purpose: these look like prices and are not. */}
        <Section title="For the Earnings Report only" fact="These never appear on a bill. No guest is ever charged these.">
          <FieldGrid>
            <Figure label="Extras: Rooms + Vacation House" value={rates.accommodationExtras} onChange={v => onRate({ accommodationExtras: v })} />
            <Figure label="Extras: Garden + Gazebo" value={rates.venueExtras} onChange={v => onRate({ venueExtras: v })} />
          </FieldGrid>
        </Section>
      </div>
    </div>
  )
}
