import { useState, useMemo } from 'react'
import CurrencyInput from '../CurrencyInput'
import { openHtml } from '../../lib/pdfExport'
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

  const handleExport = () => {
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    const subRows = [
      ['Current NOI', fmt$(sub.noi)], ['Exit Cap Rate', fmtPct(sub.exitCap / 100)],
      ['Sale Price', fmt$(calc.salePrice)], ['Original Purchase Price', fmt$(sub.goingInPrice)],
      ['Value Appreciation', fmt$(calc.appreciation)], ['Current Loan Balance', fmt$(sub.currLoanBal)],
      ['Annual Debt Service', fmt$(calc.sAnnDebt)], ['Cash Flow After Debt', fmt$(calc.sCF)],
      ['Return on Equity', fmtPct(calc.sROE)], [`Commission (${sub.commissionPct}%)`, fmt$(calc.brokerComm)],
    ]
    const taxRows = [
      ['Adjusted Tax Basis', fmt$(calc.taxBasis)], [`Accum. Depreciation (${sub.yearsHeld} yrs)`, fmt$(calc.accumDepr)],
      ['Capital Gains Tax (23.8%)', fmt$(calc.capGainsTax)], ['Depreciation Recapture (25%)', fmt$(calc.depRecapTax)],
    ]
    const replMetrics = replDebt
      ? [['NOI', o => fmt$(o.noi)], ['Purchase Price', o => fmt$(o.price)], ['Cap Rate', o => fmtPct(o.capRate)],
         ['Debt Required', o => fmt$(o.loanAmt)], ['LTV', o => fmtPct(o.ltv)], ['Debt Service (Ann)', o => fmt$(o.annDS)],
         ['DSCR', o => o.dscr.toFixed(2) + 'x'], ['Net Cash (Annual)', o => fmt$(o.netCash)],
         ['Cash Return', o => fmtPct(o.cashReturn)], ['Total Return', o => fmtPct(o.totalReturn)],
         ['CF vs Subject', o => `${o.cfDelta >= 0 ? '+' : ''}${fmt$(o.cfDelta)}/yr`]]
      : [['NOI', o => fmt$(o.noi)], ['Purchase Price', o => fmt$(o.price)], ['Cap Rate', o => fmtPct(o.capRate)],
         ['1031 Equity', () => fmt$(calc.equity1031)], ['Additional Cash', o => fmt$(o.additionalCash)],
         ['Cash-on-Cash', o => fmtPct(o.cashOnCash)], ['CF vs Subject', o => `${o.cfDelta >= 0 ? '+' : ''}${fmt$(o.cfDelta)}/yr`],
         ['Lease Type', o => o.leaseType], ['Lease Years', o => String(o.leaseYears)]]

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>1031 Exchange Analysis</title>
<style>
@page{margin:.6in}body{font-family:'Inter',-apple-system,sans-serif;color:#1a1a1a;max-width:740px;margin:0 auto;padding:30px;line-height:1.5;font-size:11px}
.banner{background:#101828;color:#fff;padding:12px 18px;display:flex;justify-content:space-between;align-items:center;border-radius:4px;margin-bottom:6px}
.banner h1{font-size:15px;margin:0}.banner span{font-size:9px;opacity:.7}
.meta{font-size:10px;color:#6e7378;margin-bottom:16px}
.section{font-size:10px;font-weight:700;color:#00529b;text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid #d0d7de;padding:6px 0 3px;margin:14px 0 6px}
.rows{margin-bottom:8px}.row{display:flex;justify-content:space-between;padding:2px 4px;font-size:10px}.row span:first-child{color:#6e7378}.row span:last-child{font-weight:600}
.hl{border-top:1px solid #d0d7de;margin-top:4px;padding-top:4px}.hl span:last-child{color:#22783c;font-weight:700}
.deadlines{display:flex;gap:10px;margin:10px 0}.deadlines>div{flex:1;background:#f5f7fa;border-radius:4px;padding:6px;text-align:center;font-size:9px}
.deadlines span:first-child{color:#6e7378;font-weight:600;display:block}.deadlines span:last-child{color:#9a6700;font-weight:700;font-size:10px}
table{width:100%;border-collapse:collapse;font-size:10px;margin-top:4px}th{text-align:right;padding:3px 6px;font-weight:700;border-bottom:1px solid #d0d7de}
th:first-child{text-align:left}td{text-align:right;padding:3px 6px}td:first-child{text-align:left;color:#6e7378}
.alt{background:#f5f7fa}.footer{margin-top:20px;font-size:8px;color:#999;border-top:1px solid #d0d7de;padding-top:6px}
</style></head><body>
<div class="banner"><h1>1031 EXCHANGE ANALYSIS</h1><span>Matthews Real Estate Investment Services</span></div>
<div class="meta">Prepared for: ${clientName} &mdash; ${dateStr}</div>
<div class="section">RELINQUISHED PROPERTY</div>
<div class="rows">${subRows.map(([l,v])=>`<div class="row"><span>${l}</span><span>${v}</span></div>`).join('')}
<div class="row hl"><span>Total Equity for 1031</span><span>${fmt$(calc.equity1031)}</span></div></div>
<div class="section">TAX DEFERRAL</div>
<div class="rows">${taxRows.map(([l,v])=>`<div class="row"><span>${l}</span><span>${v}</span></div>`).join('')}
<div class="row hl"><span>Tax Saved via 1031</span><span>${fmt$(calc.taxSaved)}</span></div></div>
<div class="deadlines"><div><span>45-Day ID</span><span>${fmtDate(calc.id45)}</span></div><div><span>180-Day Close</span><span>${fmtDate(calc.close180)}</span></div></div>
<div class="section">REPLACEMENT PROPERTIES ${replDebt ? '(WITH DEBT)' : '(ALL CASH)'}</div>
<table><thead><tr><th></th>${repls.map((r,i)=>`<th>${r.name||'Option '+(i+1)}</th>`).join('')}</tr></thead>
<tbody>${replMetrics.map(([l,fn],ri)=>`<tr class="${ri%2===0?'alt':''}"><td>${l}</td>${calc.options.map(o=>`<td>${fn(o)}</td>`).join('')}</tr>`).join('')}</tbody></table>
<div class="footer">For analysis purposes only. Consult a qualified tax/legal professional. &mdash; Matthews REIS</div>
</body></html>`

    openHtml(html)
  }

  const replMetricsPreview = replDebt
    ? [['NOI', o => fmt$(o.noi)], ['Purchase Price', o => fmt$(o.price)], ['Cap Rate', o => fmtPct(o.capRate)],
       ['Loan Amount', o => fmt$(o.loanAmt)], ['LTV', o => fmtPct(o.ltv)],
       ['Debt Service (Ann)', o => fmt$(o.annDS)], ['DSCR', o => o.dscr.toFixed(2) + 'x'],
       ['Net Cash (Annual)', o => fmt$(o.netCash)], ['Cash Return', o => fmtPct(o.cashReturn)],
       ['Total Return', o => fmtPct(o.totalReturn)], ['CF vs Subject', o => fmt$(o.cfDelta)]]
    : [['NOI', o => fmt$(o.noi)], ['Purchase Price', o => fmt$(o.price)], ['Cap Rate', o => fmtPct(o.capRate)],
       ['1031 Equity', () => fmt$(calc.equity1031)], ['Additional Cash', o => fmt$(o.additionalCash)],
       ['Cash-on-Cash', o => fmtPct(o.cashOnCash)], ['CF vs Subject', o => fmt$(o.cfDelta)]]

  const previewDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div className={styles.splitLayout}>
      <div className={styles.inputPane}>
        <div className={s.inputGrid}>
          <div className={s.fieldGroup}>
            <label className={s.label}>Prepared For</label>
            <input className={s.input} value={clientName} onChange={e => setClientName(e.target.value)} />
          </div>
          <div />
        </div>

        <div className={s.sectionLabel}>Relinquished Property</div>
        <div className={s.inputGrid}>
          <CurrencyInput label="Current NOI" hint="Current year net operating income of the property being sold." value={sub.noi} onChange={v => set('noi', v)} />
          <CurrencyInput label="Exit Cap Rate" hint="Cap rate used to value the sale. Sale price = NOI ÷ cap rate." value={sub.exitCap} onChange={v => set('exitCap', v)} prefix="" suffix="%" />
          <CurrencyInput label="Original Purchase Price" hint="What the seller paid when they acquired the property." value={sub.goingInPrice} onChange={v => set('goingInPrice', v)} />
          <CurrencyInput label="Years Held" hint="How long the seller has owned it. Drives depreciation schedule." value={sub.yearsHeld} onChange={v => set('yearsHeld', v)} prefix="" />
          <CurrencyInput label="Depreciable % (building)" hint="% of purchase price that's building vs. land. Land doesn't depreciate. 75–85% typical." value={sub.depreciationPct} onChange={v => set('depreciationPct', v)} prefix="" suffix="%" />
          <CurrencyInput label="Title / Escrow" hint="Closing costs on sale (title, escrow, transfer tax)." value={sub.titleEscrow} onChange={v => set('titleEscrow', v)} />
          <CurrencyInput label="Commission %" hint="Total brokerage commission on the sale." value={sub.commissionPct} onChange={v => set('commissionPct', v)} prefix="" suffix="%" />
        </div>

        <div className={s.sectionLabel}>Existing Debt</div>
        <div className={s.inputGrid}>
          <CurrencyInput label="Original Loan Balance" hint="Initial loan amount when the seller acquired the asset." value={sub.origLoanBal} onChange={v => set('origLoanBal', v)} />
          <CurrencyInput label="Current Loan Balance" hint="Outstanding loan balance today — deducted from sale proceeds." value={sub.currLoanBal} onChange={v => set('currLoanBal', v)} />
          <CurrencyInput label="Interest Rate" hint="Rate on the existing loan." value={sub.intRate} onChange={v => set('intRate', v)} prefix="" suffix="%" />
          <CurrencyInput label="Amortization (yrs)" hint="Original amortization schedule of the existing loan." value={sub.amort} onChange={v => set('amort', v)} prefix="" />
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
                <CurrencyInput label="NOI" hint="Year-1 NOI of replacement property." value={repls[i].noi} onChange={v => setR(i, 'noi', v)} />
                <CurrencyInput label="Cap Rate" hint="Replacement cap rate determines purchase price." value={repls[i].capRate} onChange={v => setR(i, 'capRate', v)} prefix="" suffix="%" />
                {replDebt && <>
                  <CurrencyInput label="Interest Rate" hint="New loan rate on replacement property." value={repls[i].rate} onChange={v => setR(i, 'rate', v)} prefix="" suffix="%" />
                  <CurrencyInput label="Amortization" hint="Amort period for new loan. 25–30 yrs typical." value={repls[i].amort} onChange={v => setR(i, 'amort', v)} prefix="" />
                </>}
                <div className={s.fieldGroup}>
                  <label className={s.label}>Lease Type</label>
                  <input className={s.input} value={repls[i].leaseType} onChange={e => setR(i, 'leaseType', e.target.value)} />
                  <div className={s.hint}>NNN, Absolute Net, Modified Gross, etc.</div>
                </div>
                <CurrencyInput label="Lease Years" hint="Remaining primary lease term." value={repls[i].leaseYears} onChange={v => setR(i, 'leaseYears', v)} prefix="" />
                <div className={s.fieldGroup}>
                  <label className={s.label}>Rent Increases</label>
                  <input className={s.input} value={repls[i].rentIncreases} onChange={e => setR(i, 'rentIncreases', e.target.value)} />
                  <div className={s.hint}>Escalation schedule (e.g. 2% annually).</div>
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

      {/* Preview Pane */}
      <div className={styles.preview}>
        <div className={styles.previewHeader}>
          <span className={styles.previewTitle}>PDF Preview</span>
          <button className={s.btnPrimary} onClick={handleExport}>Export PDF</button>
        </div>
        <div className={styles.previewBody}>
          <div className={styles.pvBanner}>
            <span className={styles.pvBannerTitle}>1031 EXCHANGE ANALYSIS</span>
            <span className={styles.pvBannerSub}>Matthews Real Estate Investment Services</span>
          </div>
          <div className={styles.pvMeta}>{`Prepared for: ${clientName} — ${previewDate}`}</div>

          <div className={styles.pvSection}>RELINQUISHED PROPERTY</div>
          <div className={styles.pvRows}>
            <div className={styles.pvRow}><span>Current NOI</span><span>{fmt$(sub.noi)}</span></div>
            <div className={styles.pvRow}><span>Exit Cap Rate</span><span>{fmtPct(sub.exitCap / 100)}</span></div>
            <div className={styles.pvRow}><span>Sale Price</span><span>{fmt$(calc.salePrice)}</span></div>
            <div className={styles.pvRow}><span>Original Purchase Price</span><span>{fmt$(sub.goingInPrice)}</span></div>
            <div className={styles.pvRow}><span>Value Appreciation</span><span>{fmt$(calc.appreciation)}</span></div>
            <div className={styles.pvRow}><span>Current Loan Balance</span><span>{fmt$(sub.currLoanBal)}</span></div>
            <div className={styles.pvRow}><span>Annual Debt Service</span><span>{fmt$(calc.sAnnDebt)}</span></div>
            <div className={styles.pvRow}><span>Cash Flow After Debt</span><span>{fmt$(calc.sCF)}</span></div>
            <div className={styles.pvRow}><span>Return on Equity</span><span>{fmtPct(calc.sROE)}</span></div>
            <div className={styles.pvRow}><span>Commission ({sub.commissionPct}%)</span><span>{fmt$(calc.brokerComm)}</span></div>
            <div className={`${styles.pvRow} ${styles.pvRowHL}`}><span>Total Equity for 1031</span><span>{fmt$(calc.equity1031)}</span></div>
          </div>

          <div className={styles.pvSection}>TAX DEFERRAL</div>
          <div className={styles.pvRows}>
            <div className={styles.pvRow}><span>Adjusted Tax Basis</span><span>{fmt$(calc.taxBasis)}</span></div>
            <div className={styles.pvRow}><span>Accum. Depreciation ({sub.yearsHeld} yrs)</span><span>{fmt$(calc.accumDepr)}</span></div>
            <div className={styles.pvRow}><span>Capital Gains Tax (23.8%)</span><span>{fmt$(calc.capGainsTax)}</span></div>
            <div className={styles.pvRow}><span>Depreciation Recapture (25%)</span><span>{fmt$(calc.depRecapTax)}</span></div>
            <div className={`${styles.pvRow} ${styles.pvRowHL}`}><span>Tax Saved via 1031</span><span>{fmt$(calc.taxSaved)}</span></div>
          </div>

          <div className={styles.pvDeadlines}>
            <div><span>45-Day ID</span><span>{fmtDate(calc.id45)}</span></div>
            <div><span>180-Day Close</span><span>{fmtDate(calc.close180)}</span></div>
          </div>

          <div className={styles.pvSection}>REPLACEMENT PROPERTIES {replDebt ? '(WITH DEBT)' : '(ALL CASH)'}</div>
          <table className={styles.pvTable}>
            <thead><tr><th></th>{repls.map((r, i) => <th key={i}>{r.name || `Option ${i + 1}`}</th>)}</tr></thead>
            <tbody>
              {replMetricsPreview.map(([label, fn], ri) => (
                <tr key={label} className={ri % 2 === 0 ? styles.pvRowAlt : ''}>
                  <td className={styles.pvMetricLabel}>{label}</td>
                  {calc.options.map((o, i) => <td key={i}>{fn(o)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>

          <div className={styles.pvFooter}>For analysis purposes only. Consult a qualified tax/legal professional.</div>
        </div>
      </div>
    </div>
  )
}
