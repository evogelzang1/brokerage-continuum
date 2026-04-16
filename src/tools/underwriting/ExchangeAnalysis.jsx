import { useState, useMemo } from 'react'
import CurrencyInput from '../CurrencyInput'
import s from '../shared.module.css'
import styles from './exchange.module.css'

const fmt$ = v => `$${Math.round(v).toLocaleString()}`
const fmtPct = v => `${(v * 100).toFixed(2)}%`
const fmtDate = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

function PMT(rate, nper, pv) {
  if (rate === 0) return -pv / nper
  const x = Math.pow(1 + rate, nper)
  return -(pv * rate * x) / (x - 1)
}

function CUMPRINC(rate, nper, pv, start, end) {
  let total = 0, balance = pv
  const payment = -PMT(rate, nper, pv)
  for (let i = 1; i <= end; i++) {
    const interest = balance * rate
    const principal = payment - interest
    if (i >= start) total += principal
    balance -= principal
  }
  return -total
}

const EMPTY_REPL = { name: '', noi: 0, capRate: 6.5, leaseType: 'Absolute Net', leaseYears: 20, rentIncreases: '10% Every 5 Yrs', rate: 6, amort: 30 }

export default function ExchangeAnalysis() {
  const [replDebt, setReplDebt] = useState(true)
  const [sub, setSub] = useState({
    exitCap: 4.95, noi: 87120, goingInPrice: 800000,
    yearsHeld: 10, depreciationPct: 80,
    titleEscrow: 10000, commissionPct: 4,
    origLoanBal: 350000, intRate: 5, amort: 25, term: 10, currLoanBal: 300000,
  })
  const [repls, setRepls] = useState([
    { ...EMPTY_REPL, name: 'Option 1', noi: 110000, capRate: 6.47, rate: 6, amort: 30 },
    { ...EMPTY_REPL, name: 'Option 2', noi: 100080, capRate: 7.25, rate: 5.85 },
    { ...EMPTY_REPL, name: 'Option 3', noi: 112200, capRate: 8.53, rate: 6.45, leaseYears: 15, rentIncreases: '1% Annually' },
  ])
  const [clientName, setClientName] = useState('Client')

  const set = (k, v) => setSub(p => ({ ...p, [k]: v }))
  const setR = (i, k, v) => setRepls(p => p.map((r, j) => j === i ? { ...r, [k]: v } : r))

  const calc = useMemo(() => {
    const salePrice = sub.exitCap > 0 ? sub.noi / (sub.exitCap / 100) : 0
    const appreciation = salePrice - sub.goingInPrice
    const depreciableBasis = sub.goingInPrice * (sub.depreciationPct / 100)
    const annualDepr = depreciableBasis / 27.5
    const accumDepr = Math.min(annualDepr * sub.yearsHeld, depreciableBasis)
    const taxBasis = sub.goingInPrice - accumDepr
    const capitalGain = Math.max(salePrice - sub.goingInPrice, 0)
    const depRecapture = accumDepr
    const capGainsTax = capitalGain * 0.238
    const depRecapTax = depRecapture * 0.25
    const totalTaxBill = capGainsTax + depRecapTax
    const taxSaved = totalTaxBill

    const sMRate = sub.intRate / 100 / 12
    const sAnnDebt = sub.origLoanBal > 0 ? -PMT(sMRate, sub.amort * 12, sub.origLoanBal) * 12 : 0
    const sMonthDebt = sAnnDebt / 12
    const sEquity = salePrice - sub.currLoanBal
    const sCF = sub.noi - sAnnDebt
    const sROE = sEquity > 0 ? sCF / sEquity : 0

    const brokerComm = salePrice * (sub.commissionPct / 100)
    const equity1031 = salePrice - sub.currLoanBal - sub.titleEscrow - brokerComm

    const today = new Date()
    const id45 = new Date(today.getTime() + 45 * 86400000)
    const close180 = new Date(today.getTime() + 180 * 86400000)

    const options = repls.map(r => {
      const price = r.capRate > 0 ? r.noi / (r.capRate / 100) : 0
      const capRate = r.capRate / 100

      if (!replDebt) {
        return {
          capRate, price, downPayment: equity1031, additionalCash: price - equity1031,
          cashOnCash: equity1031 > 0 ? r.noi / equity1031 : 0,
          cfDelta: r.noi - sCF, ...r,
        }
      }

      const loanAmt = Math.max(0, price - equity1031)
      const ltv = price > 0 ? loanAmt / price : 0
      const mRate = r.rate / 100 / 12
      const annDS = loanAmt > 0 ? -PMT(mRate, r.amort * 12, loanAmt) * 12 : 0
      const princRedux = loanAmt > 0 ? -CUMPRINC(mRate, r.amort * 12, loanAmt, 1, 12) : 0
      const dscr = annDS > 0 ? r.noi / annDS : 0
      const debtYield = loanAmt > 0 ? r.noi / loanAmt : 0
      const netCash = r.noi - annDS
      const cashReturn = equity1031 > 0 ? netCash / equity1031 : 0
      const totalReturn = equity1031 > 0 ? (princRedux + netCash) / equity1031 : 0
      const cfDelta = netCash - sCF

      return {
        capRate, price, loanAmt, ltv, annDS, princRedux, dscr, debtYield,
        netCash, cashReturn, totalReturn, equity: equity1031, cfDelta, ...r,
      }
    })

    return {
      salePrice, appreciation, equity1031, brokerComm,
      taxBasis, accumDepr, capitalGain, depRecapture, capGainsTax, depRecapTax, totalTaxBill, taxSaved,
      sAnnDebt, sMonthDebt, sEquity, sCF, sROE,
      id45, close180, options,
    }
  }, [sub, repls, replDebt])

  return (
    <div>
      <div className={s.inputGrid}>
        <div className={s.fieldGroup}>
          <label className={s.label}>Prepared For</label>
          <input className={s.input} value={clientName} onChange={e => setClientName(e.target.value)} />
        </div>
        <div />
      </div>

      <div className={s.sectionLabel}>Relinquished Property</div>
      <div className={s.inputGrid}>
        <CurrencyInput label="Current NOI" value={sub.noi} onChange={v => set('noi', v)} />
        <CurrencyInput label="Exit Cap Rate" value={sub.exitCap} onChange={v => set('exitCap', v)} prefix="" suffix="%" />
        <CurrencyInput label="Original Purchase Price" value={sub.goingInPrice} onChange={v => set('goingInPrice', v)} />
        <CurrencyInput label="Years Held" value={sub.yearsHeld} onChange={v => set('yearsHeld', v)} prefix="" />
        <CurrencyInput label="Depreciable % (building)" value={sub.depreciationPct} onChange={v => set('depreciationPct', v)} prefix="" suffix="%" />
        <CurrencyInput label="Title / Escrow" value={sub.titleEscrow} onChange={v => set('titleEscrow', v)} />
        <CurrencyInput label="Commission %" value={sub.commissionPct} onChange={v => set('commissionPct', v)} prefix="" suffix="%" />
      </div>

      <div className={s.sectionLabel}>Existing Debt</div>
      <div className={s.inputGrid}>
        <CurrencyInput label="Original Loan Balance" value={sub.origLoanBal} onChange={v => set('origLoanBal', v)} />
        <CurrencyInput label="Current Loan Balance" value={sub.currLoanBal} onChange={v => set('currLoanBal', v)} />
        <CurrencyInput label="Interest Rate" value={sub.intRate} onChange={v => set('intRate', v)} prefix="" suffix="%" />
        <CurrencyInput label="Amortization (yrs)" value={sub.amort} onChange={v => set('amort', v)} prefix="" />
      </div>

      <div className={s.outputCard}>
        <div className={s.outputTitle}>Relinquished Property Cash Flow</div>
        <div className={styles.outputGrid}>
          <div className={s.outputRow}><span className={s.outputLabel}>Sale Price</span><span className={s.outputValue}>{fmt$(calc.salePrice)}</span></div>
          <div className={s.outputRow}><span className={s.outputLabel}>Annual Debt Service</span><span className={s.outputValue}>{fmt$(calc.sAnnDebt)}/yr</span></div>
          <div className={s.outputRow}><span className={s.outputLabel}>Monthly Debt Service</span><span className={s.outputValue}>{fmt$(calc.sMonthDebt)}/mo</span></div>
          <div className={s.outputRow}><span className={s.outputLabel}>Cash Flow After Debt</span><span className={`${s.outputValue} ${calc.sCF >= 0 ? s.positive : s.negative}`}>{fmt$(calc.sCF)}/yr</span></div>
          <div className={s.outputRow}><span className={s.outputLabel}>Return on Equity</span><span className={s.outputValue}>{fmtPct(calc.sROE)}</span></div>
          <div className={s.outputRow} style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
            <span className={s.outputLabel}>Total Equity for 1031</span><span className={`${s.outputValue} ${s.positive}`}>{fmt$(calc.equity1031)}</span>
          </div>
        </div>

        <div className={s.outputTitle} style={{ marginTop: 16 }}>Tax Deferral</div>
        <div className={styles.outputGrid}>
          <div className={s.outputRow}><span className={s.outputLabel}>Adjusted Tax Basis</span><span className={s.outputValue}>{fmt$(calc.taxBasis)}</span></div>
          <div className={s.outputRow}><span className={s.outputLabel}>Accum. Depreciation</span><span className={s.outputValue}>{fmt$(calc.accumDepr)}</span></div>
          <div className={s.outputRow}><span className={s.outputLabel}>Capital Gain (23.8%)</span><span className={s.outputValue}>{fmt$(calc.capGainsTax)}</span></div>
          <div className={s.outputRow}><span className={s.outputLabel}>Dep. Recapture (25%)</span><span className={s.outputValue}>{fmt$(calc.depRecapTax)}</span></div>
          <div className={s.outputRow} style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
            <span className={s.outputLabel}>Tax Saved via 1031</span><span className={`${s.outputValue} ${s.positive}`}>{fmt$(calc.taxSaved)}</span>
          </div>
        </div>

        <div className={styles.deadlines}>
          <div><span>45-Day ID Deadline</span><span>{fmtDate(calc.id45)}</span></div>
          <div><span>180-Day Close Deadline</span><span>{fmtDate(calc.close180)}</span></div>
        </div>
      </div>

      <div className={s.sectionLabel} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        Replacement Properties
        <div className={styles.toggleRow}>
          <button className={`${styles.toggleBtn} ${!replDebt ? styles.toggleActive : ''}`} onClick={() => setReplDebt(false)}>All Cash</button>
          <button className={`${styles.toggleBtn} ${replDebt ? styles.toggleActive : ''}`} onClick={() => setReplDebt(true)}>With Debt</button>
        </div>
      </div>
      <div className={styles.replGrid}>
        {calc.options.map((opt, i) => (
          <div key={i} className={styles.replCard}>
            <input className={styles.replName} value={repls[i].name} onChange={e => setR(i, 'name', e.target.value)} placeholder={`Option ${i + 1}`} />
            <div className={styles.replInputs}>
              <CurrencyInput label="NOI" value={repls[i].noi} onChange={v => setR(i, 'noi', v)} />
              <CurrencyInput label="Cap Rate" value={repls[i].capRate} onChange={v => setR(i, 'capRate', v)} prefix="" suffix="%" />
              {replDebt && <>
                <CurrencyInput label="Interest Rate" value={repls[i].rate} onChange={v => setR(i, 'rate', v)} prefix="" suffix="%" />
                <CurrencyInput label="Amortization" value={repls[i].amort} onChange={v => setR(i, 'amort', v)} prefix="" />
              </>}
              <div className={s.fieldGroup}>
                <label className={s.label}>Lease Type</label>
                <input className={s.input} value={repls[i].leaseType} onChange={e => setR(i, 'leaseType', e.target.value)} />
              </div>
              <CurrencyInput label="Lease Years" value={repls[i].leaseYears} onChange={v => setR(i, 'leaseYears', v)} prefix="" />
              <div className={s.fieldGroup}>
                <label className={s.label}>Rent Increases</label>
                <input className={s.input} value={repls[i].rentIncreases} onChange={e => setR(i, 'rentIncreases', e.target.value)} />
              </div>
            </div>
            <div className={styles.replResults}>
              <div className={styles.replRow}><span>Purchase Price</span><span>{fmt$(opt.price)}</span></div>
              <div className={styles.replRow}><span>1031 Equity</span><span>{fmt$(calc.equity1031)}</span></div>
              {replDebt && <>
                <div className={styles.replRow}><span>Debt Required</span><span>{fmt$(opt.loanAmt)}</span></div>
                <div className={styles.replRow}><span>LTV</span><span>{fmtPct(opt.ltv)}</span></div>
                <div className={styles.replRow}><span>Net Cash (Annual)</span><span className={opt.netCash < 0 ? s.negative : ''}>{fmt$(opt.netCash)}</span></div>
                <div className={styles.replRow}><span>Cash Return</span><span className={opt.cashReturn < 0 ? s.negative : s.positive}>{fmtPct(opt.cashReturn)}</span></div>
              </>}
              {!replDebt && <>
                <div className={styles.replRow}>
                  <span>{opt.additionalCash > 0 ? 'Additional Cash Needed' : 'Cash Returned'}</span>
                  <span className={opt.additionalCash > 0 ? s.negative : s.positive}>{fmt$(Math.abs(opt.additionalCash))}</span>
                </div>
                <div className={styles.replRow}><span>Cash-on-Cash</span><span className={s.positive}>{fmtPct(opt.cashOnCash)}</span></div>
              </>}
              <div className={`${styles.replRow} ${opt.cfDelta >= 0 ? s.positive : s.negative}`}>
                <span>CF vs Subject</span><span>{opt.cfDelta >= 0 ? '+' : ''}{fmt$(opt.cfDelta)}/yr</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
