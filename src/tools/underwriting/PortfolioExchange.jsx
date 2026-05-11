import { useState, useMemo } from 'react'
import CurrencyInput from '../CurrencyInput'
import { openHtml } from '../../lib/pdfExport'
import s from '../shared.module.css'
import styles from './exchange.module.css'

const fmt$ = v => `$${Math.round(v).toLocaleString()}`
const fmt$M = v => `$${(v / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 })}M`
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

function buildScenario(equity1031, params, sCF, refi) {
  const { capRate, ltv, rate, amort } = params
  const cap = capRate / 100
  const lev = ltv / 100

  // Acquisition with target LTV: equity covers down payment.
  // Portfolio price = equity / (1 - LTV); loan = price * LTV; NOI = price * cap.
  const price = lev < 1 ? equity1031 / (1 - lev) : 0
  const loanAmt = price * lev
  const newNOI = price * cap
  const mRate = rate / 100 / 12
  const annDS = loanAmt > 0 ? -PMT(mRate, amort * 12, loanAmt) * 12 : 0
  const princRedux = loanAmt > 0 ? -CUMPRINC(mRate, amort * 12, loanAmt, 1, 12) : 0
  const netCF = newNOI - annDS
  const cashReturn = equity1031 > 0 ? netCF / equity1031 : 0
  const totalReturn = equity1031 > 0 ? (netCF + princRedux) / equity1031 : 0
  const dscr = annDS > 0 ? newNOI / annDS : 0
  const debtYield = loanAmt > 0 ? newNOI / loanAmt : 0
  const cfDelta = netCF - sCF

  // Optional cash-out refi (typically only meaningful when initial LTV is 0).
  let refiOut = null
  if (refi && refi.enabled) {
    const refiLev = refi.ltv / 100
    const refiRate = refi.rate / 100 / 12
    const refiLoan = price * refiLev
    const refiAnnDS = refiLoan > 0 ? -PMT(refiRate, refi.amort * 12, refiLoan) * 12 : 0
    const refiPrincRedux = refiLoan > 0 ? -CUMPRINC(refiRate, refi.amort * 12, refiLoan, 1, 12) : 0
    const cashExtracted = refiLoan
    const cfPostRefi = newNOI - refiAnnDS
    const remainingEquity = Math.max(0, equity1031 - cashExtracted)
    const cocPostRefi = remainingEquity > 0 ? cfPostRefi / remainingEquity : 0
    const totalReturnPostRefi = remainingEquity > 0 ? (cfPostRefi + refiPrincRedux) / remainingEquity : 0
    const refiDSCR = refiAnnDS > 0 ? newNOI / refiAnnDS : 0
    refiOut = { refiLoan, refiAnnDS, refiPrincRedux, cashExtracted, cfPostRefi, remainingEquity, cocPostRefi, totalReturnPostRefi, refiDSCR }
  }

  return { price, loanAmt, ltv: lev, newNOI, capRate: cap, annDS, princRedux, netCF, cashReturn, totalReturn, dscr, debtYield, cfDelta, refi: refiOut }
}

const DEFAULT_SUB = {
  salePrice: 29_000_000,
  noi: 1_450_000,          // 5% current cap on $29M
  hasDebt: true,
  currLoanBal: 10_000_000,
  intRate: 5,
  amort: 25,
  titleEscrow: 75_000,
  commissionPct: 2,
  estimatedTaxLiability: 0,
}

const DEFAULT_SCENARIOS = [
  { name: 'Maximize Cash Flow', capRate: 6.75, ltv: 50, rate: 6.5, amort: 30, mode: 'leveraged' },
  { name: 'Preserve CF, Reduce Risk', capRate: 5.75, ltv: 30, rate: 6.5, amort: 30, mode: 'leveraged' },
  { name: 'Free & Clear + Refi', capRate: 5.50, ltv: 0, rate: 0, amort: 30, mode: 'cashRefi' },
]

const DEFAULT_REFI = { enabled: true, ltv: 50, rate: 6.5, amort: 30 }

export default function PortfolioExchange() {
  const [clientName, setClientName] = useState('Client')
  const [sub, setSub] = useState(DEFAULT_SUB)
  const [scenarios, setScenarios] = useState(DEFAULT_SCENARIOS)
  const [refi, setRefi] = useState(DEFAULT_REFI)

  const set = (k, v) => setSub(p => ({ ...p, [k]: v }))
  const setSc = (i, k, v) => setScenarios(p => p.map((sc, j) => j === i ? { ...sc, [k]: v } : sc))
  const setRefiK = (k, v) => setRefi(p => ({ ...p, [k]: v }))

  const calc = useMemo(() => {
    const currLoanBal = sub.hasDebt ? sub.currLoanBal : 0
    const brokerComm = sub.salePrice * (sub.commissionPct / 100)
    const equity1031 = Math.max(0, sub.salePrice - currLoanBal - sub.titleEscrow - brokerComm)

    // Current portfolio metrics
    const sMRate = sub.intRate / 100 / 12
    const sAnnDS = currLoanBal > 0 ? -PMT(sMRate, sub.amort * 12, currLoanBal) * 12 : 0
    const sCF = sub.noi - sAnnDS
    const sEquity = Math.max(0, sub.salePrice - currLoanBal)
    const sCoC = sEquity > 0 ? sCF / sEquity : 0
    const sDSCR = sAnnDS > 0 ? sub.noi / sAnnDS : 0
    const currentCap = sub.salePrice > 0 ? sub.noi / sub.salePrice : 0

    // Tax deferral — optional CPA estimate. Portfolio-level basis aggregation
    // is too rough to derive credibly from first principles, so we defer to
    // whatever number the seller's CPA produces.
    const totalTaxBill = Math.max(0, sub.estimatedTaxLiability)

    // 1031 timing
    const today = new Date()
    const id45 = new Date(today.getTime() + 45 * 86400000)
    const close180 = new Date(today.getTime() + 180 * 86400000)

    const results = scenarios.map(sc => {
      const useRefi = sc.mode === 'cashRefi'
      return buildScenario(equity1031, useRefi ? { ...sc, ltv: 0 } : sc, sCF, useRefi ? refi : null)
    })

    return {
      equity1031, brokerComm, currLoanBal,
      sAnnDS, sCF, sEquity, sCoC, sDSCR, currentCap,
      totalTaxBill,
      id45, close180, results,
    }
  }, [sub, scenarios, refi])

  const handleExport = () => {
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

    const subRows = [
      ['Sale Price', fmt$(sub.salePrice)],
      ['Current NOI', fmt$(sub.noi)],
      ['Current Cap Rate', fmtPct(calc.currentCap)],
      ['Existing Debt', sub.hasDebt ? fmt$(sub.currLoanBal) : 'Free & Clear'],
      ['Annual Debt Service', fmt$(calc.sAnnDS)],
      ['Annual Cash Flow', fmt$(calc.sCF)],
      ['Cash-on-Cash', fmtPct(calc.sCoC)],
      [`Commission (${sub.commissionPct}%)`, fmt$(calc.brokerComm)],
      ['Title / Escrow', fmt$(sub.titleEscrow)],
    ]

    const rowFns = [
      ['Target Cap Rate', (r, sc) => fmtPct(r.capRate)],
      ['Acquisition LTV', (r, sc) => sc.mode === 'cashRefi' ? 'All Cash' : fmtPct(r.ltv)],
      ['Loan Rate', (r, sc) => sc.mode === 'cashRefi' ? '—' : `${sc.rate.toFixed(2)}%`],
      ['Portfolio Size', r => fmt$(r.price)],
      ['Acquisition Debt', r => fmt$(r.loanAmt)],
      ['Year-1 NOI', r => fmt$(r.newNOI)],
      ['Annual Debt Service', r => fmt$(r.annDS)],
      ['Net Cash Flow', r => fmt$(r.netCF)],
      ['CF vs Current', r => `${r.cfDelta >= 0 ? '+' : ''}${fmt$(r.cfDelta)}`],
      ['DSCR', r => r.dscr > 0 ? `${r.dscr.toFixed(2)}x` : '—'],
      ['Debt Yield', r => r.debtYield > 0 ? fmtPct(r.debtYield) : '—'],
      ['Cash-on-Cash', r => fmtPct(r.cashReturn)],
      ['Total Return (incl. paydown)', r => fmtPct(r.totalReturn)],
    ]

    const refiSection = refi.enabled ? `
<div class="section">Scenario 3 — Cash-Out Refinance (Year 2+)</div>
<table>
  <thead><tr><th></th><th>${scenarios[2].name}</th></tr></thead>
  <tbody>
    <tr class="alt"><td>Refi LTV / Rate</td><td>${refi.ltv}% @ ${refi.rate.toFixed(2)}%</td></tr>
    <tr><td>Refi Loan Amount</td><td>${fmt$(calc.results[2].refi?.refiLoan || 0)}</td></tr>
    <tr class="alt"><td>Cash Extracted (tax-free)</td><td>${fmt$(calc.results[2].refi?.cashExtracted || 0)}</td></tr>
    <tr><td>Refi Debt Service</td><td>${fmt$(calc.results[2].refi?.refiAnnDS || 0)}</td></tr>
    <tr class="alt"><td>Net CF Post-Refi</td><td>${fmt$(calc.results[2].refi?.cfPostRefi || 0)}</td></tr>
    <tr><td>Remaining Equity</td><td>${fmt$(calc.results[2].refi?.remainingEquity || 0)}</td></tr>
    <tr class="alt"><td>CoC on Remaining Equity</td><td>${fmtPct(calc.results[2].refi?.cocPostRefi || 0)}</td></tr>
    <tr><td>DSCR (Refi)</td><td>${(calc.results[2].refi?.refiDSCR || 0).toFixed(2)}x</td></tr>
  </tbody>
</table>` : ''

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title> </title>
<style>
@page{size:letter landscape;margin:0}
*{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
html,body{margin:0;padding:0}
body{font-family:'Inter',-apple-system,sans-serif;color:#1a1a1a;line-height:1.3;font-size:9px;padding:.3in}
.banner{background:#101828;color:#fff;padding:6px 12px;display:flex;justify-content:space-between;align-items:center;border-radius:3px;margin-bottom:4px}
.banner h1{font-size:12px;margin:0;font-weight:700}
.banner span{font-size:7.5px;opacity:.7}
.meta{font-size:8.5px;color:#6e7378;margin-bottom:6px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.section{font-size:8px;font-weight:700;color:#0969da;text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid #d0d7de;padding:3px 0 1px;margin:6px 0 2px}
.row{display:flex;justify-content:space-between;padding:1px 3px;font-size:8.5px;line-height:1.25}
.row span:first-child{color:#6e7378}.row span:last-child{font-weight:600}
.alt{background:#f5f7fa}
.hl{border-top:1px solid #d0d7de;margin-top:2px;padding-top:2px}
.hl span:last-child{color:#22783c;font-weight:700}
.deadlines{display:flex;gap:6px;margin:6px 0}
.deadlines>div{flex:1;background:#fffbe6;border:1px solid #f0cc4a;border-radius:3px;padding:3px 5px;text-align:center}
.deadlines span:first-child{color:#6e7378;font-weight:600;display:block;font-size:7.5px}
.deadlines span:last-child{color:#9a6700;font-weight:700;font-size:9px}
table{width:100%;border-collapse:collapse;font-size:8.5px;margin-top:3px}
th{text-align:right;padding:3px 5px;font-weight:700;border-bottom:1px solid #d0d7de;background:#f5f7fa}
th:first-child{text-align:left}
td{text-align:right;padding:3px 5px}
td:first-child{text-align:left;color:#6e7378;font-weight:500}
tr.alt{background:#fafbfc}
.scenarioNote{font-size:8px;color:#6e7378;font-style:italic;margin-top:2px}
.footer{margin-top:6px;font-size:7px;color:#999;border-top:1px solid #d0d7de;padding-top:3px;text-align:center}
</style></head><body>
<div class="banner"><h1>PORTFOLIO 1031 EXCHANGE — STRATEGY COMPARISON</h1><span>Matthews Real Estate Investment Services</span></div>
<div class="meta">Prepared for: ${clientName} &mdash; ${dateStr}</div>

<div class="grid">
  <div>
    <div class="section">Relinquished Portfolio</div>
    ${subRows.map(([l, v], i) => `<div class="row ${i % 2 ? 'alt' : ''}"><span>${l}</span><span>${v}</span></div>`).join('')}
    <div class="row hl"><span>Net 1031 Equity</span><span>${fmt$(calc.equity1031)}</span></div>
  </div>
  <div>
    <div class="section">1031 Exchange Mechanics</div>
    ${calc.totalTaxBill > 0
      ? `<div class="row hl"><span>Tax Deferred via 1031 (CPA estimate)</span><span>${fmt$(calc.totalTaxBill)}</span></div>`
      : `<div class="row"><span>Estimated Tax Deferred</span><span>Per seller's CPA</span></div>`}
    <div class="deadlines">
      <div><span>45-Day ID</span><span>${fmtDate(calc.id45)}</span></div>
      <div><span>180-Day Close</span><span>${fmtDate(calc.close180)}</span></div>
    </div>
  </div>
</div>

<div class="section">Replacement Portfolio — Three Strategies</div>
<table>
  <thead>
    <tr>
      <th></th>
      ${scenarios.map((sc, i) => `<th>${i + 1}. ${sc.name}</th>`).join('')}
    </tr>
  </thead>
  <tbody>
    ${rowFns.map(([label, fn], ri) => `<tr class="${ri % 2 === 0 ? 'alt' : ''}"><td>${label}</td>${calc.results.map((r, i) => `<td>${fn(r, scenarios[i])}</td>`).join('')}</tr>`).join('')}
  </tbody>
</table>

${refiSection}

<div class="footer">Returns shown are Year-1 estimates on the new portfolio. Cash-out refi proceeds are tax-free loan proceeds, not income. For analysis purposes only — consult a qualified tax/legal professional. &mdash; Matthews REIS</div>
</body></html>`

    openHtml(html)
  }

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

        <div className={s.sectionLabel}>Relinquished Portfolio</div>
        <div className={s.inputGrid}>
          <CurrencyInput label="Portfolio Sale Price" hint="Aggregate sale price across all properties in the portfolio." value={sub.salePrice} onChange={v => set('salePrice', v)} />
          <CurrencyInput label="Current Portfolio NOI" hint="Combined trailing or Year-1 NOI of the portfolio being sold." value={sub.noi} onChange={v => set('noi', v)} />
          <CurrencyInput label="Title / Escrow" hint="Aggregate closing costs (title, escrow, transfer tax) across the sale." value={sub.titleEscrow} onChange={v => set('titleEscrow', v)} />
          <CurrencyInput label="Commission %" hint="Total brokerage commission on the portfolio sale." value={sub.commissionPct} onChange={v => set('commissionPct', v)} prefix="" suffix="%" />
        </div>

        <div className={s.sectionLabel} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          Existing Debt
          <div className={styles.toggleRow}>
            <button className={`${styles.toggleBtn} ${!sub.hasDebt ? styles.toggleActive : ''}`} onClick={() => set('hasDebt', false)}>Free &amp; Clear</button>
            <button className={`${styles.toggleBtn} ${sub.hasDebt ? styles.toggleActive : ''}`} onClick={() => set('hasDebt', true)}>Has Debt</button>
          </div>
        </div>
        {sub.hasDebt && (
          <div className={s.inputGrid}>
            <CurrencyInput label="Current Loan Balance" hint="Aggregate outstanding debt across the portfolio — deducted from sale proceeds." value={sub.currLoanBal} onChange={v => set('currLoanBal', v)} />
            <CurrencyInput label="Interest Rate" hint="Blended rate on existing debt (used for current debt-service)." value={sub.intRate} onChange={v => set('intRate', v)} prefix="" suffix="%" />
            <CurrencyInput label="Amortization (yrs)" hint="Blended amort schedule for the existing portfolio debt." value={sub.amort} onChange={v => set('amort', v)} prefix="" />
          </div>
        )}

        <div className={s.sectionLabel}>1031 Tax Deferral (Optional)</div>
        <div className={s.inputGrid}>
          <CurrencyInput label="Est. Tax Liability if Sold (per CPA)" hint="Optional. Paste the seller's CPA estimate of federal + state tax owed on an outright sale. Displayed as 'Tax Deferred via 1031.' Leave blank to omit — portfolio-level basis aggregation is too rough to derive credibly here." value={sub.estimatedTaxLiability} onChange={v => set('estimatedTaxLiability', v)} />
          <div />
        </div>

        <div className={s.outputCard}>
          <div className={s.outputTitle}>Current Portfolio Snapshot</div>
          <div className={s.outputRow}><span className={s.outputLabel}>Current Cap Rate</span><span className={s.outputValue}>{fmtPct(calc.currentCap)}</span></div>
          <div className={s.outputRow}><span className={s.outputLabel}>Annual Debt Service</span><span className={s.outputValue}>{fmt$(calc.sAnnDS)}</span></div>
          <div className={s.outputRow}><span className={s.outputLabel}>Annual Cash Flow</span><span className={s.outputValue}>{fmt$(calc.sCF)}</span></div>
          <div className={s.outputRow}><span className={s.outputLabel}>Cash-on-Cash</span><span className={s.outputValue}>{fmtPct(calc.sCoC)}</span></div>
          <div className={s.outputRow}><span className={s.outputLabel}>Net 1031 Equity Available</span><span className={`${s.outputValue} ${s.positive}`}>{fmt$(calc.equity1031)}</span></div>
          {calc.totalTaxBill > 0 && (
            <div className={s.outputRow}><span className={s.outputLabel}>Tax Deferred via 1031 (per CPA)</span><span className={`${s.outputValue} ${s.positive}`}>{fmt$(calc.totalTaxBill)}</span></div>
          )}
        </div>

        <div className={s.sectionLabel}>Replacement Strategies</div>
        <div className={styles.replGrid}>
          {scenarios.map((sc, i) => {
            const r = calc.results[i]
            const isRefi = sc.mode === 'cashRefi'
            return (
              <div key={i} className={styles.replCard}>
                <input className={styles.replName} value={sc.name} onChange={e => setSc(i, 'name', e.target.value)} placeholder={`Scenario ${i + 1}`} />
                <div className={styles.replInputs}>
                  <CurrencyInput label="Target Cap Rate" hint="Weighted-average acquisition cap rate on the replacement portfolio." value={sc.capRate} onChange={v => setSc(i, 'capRate', v)} prefix="" suffix="%" />
                  {!isRefi && <>
                    <CurrencyInput label="Acquisition LTV" hint="Debt as % of new portfolio purchase price." value={sc.ltv} onChange={v => setSc(i, 'ltv', v)} prefix="" suffix="%" />
                    <CurrencyInput label="Loan Rate" hint="Blended rate on acquisition debt." value={sc.rate} onChange={v => setSc(i, 'rate', v)} prefix="" suffix="%" />
                    <CurrencyInput label="Amortization" hint="Amort period (yrs). 25–30 typical." value={sc.amort} onChange={v => setSc(i, 'amort', v)} prefix="" />
                  </>}
                  {isRefi && (
                    <div className={s.hint} style={{ marginTop: -2 }}>
                      All-cash acquisition with the full 1031 equity, then a planned cash-out refinance in year 2+. Refi terms below.
                    </div>
                  )}
                </div>
                <div className={styles.replResults}>
                  <div className={styles.replRow}><span>Portfolio Size</span><span>{fmt$M(r.price)}</span></div>
                  <div className={styles.replRow}><span>Acquisition Debt</span><span>{isRefi ? '—' : fmt$M(r.loanAmt)}</span></div>
                  <div className={styles.replRow}><span>Year-1 NOI</span><span>{fmt$(r.newNOI)}</span></div>
                  <div className={styles.replRow}><span>Debt Service</span><span>{isRefi ? '—' : fmt$(r.annDS)}</span></div>
                  <div className={styles.replRow}><span>Net Cash Flow</span><span className={r.netCF < 0 ? s.negative : ''}>{fmt$(r.netCF)}</span></div>
                  <div className={`${styles.replRow} ${r.cfDelta >= 0 ? s.positive : s.negative}`}>
                    <span>CF vs Current</span><span>{r.cfDelta >= 0 ? '+' : ''}{fmt$(r.cfDelta)}</span>
                  </div>
                  <div className={styles.replRow}><span>DSCR</span><span>{r.dscr > 0 ? `${r.dscr.toFixed(2)}x` : '—'}</span></div>
                  <div className={styles.replRow}><span>Cash-on-Cash</span><span className={s.positive}>{fmtPct(r.cashReturn)}</span></div>
                  <div className={styles.replRow}><span>Total Return</span><span className={s.positive}>{fmtPct(r.totalReturn)}</span></div>
                </div>
              </div>
            )
          })}
        </div>

        <div className={s.sectionLabel} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          Cash-Out Refi (Scenario 3)
          <div className={styles.toggleRow}>
            <button className={`${styles.toggleBtn} ${!refi.enabled ? styles.toggleActive : ''}`} onClick={() => setRefiK('enabled', false)}>Skip Refi</button>
            <button className={`${styles.toggleBtn} ${refi.enabled ? styles.toggleActive : ''}`} onClick={() => setRefiK('enabled', true)}>Model Refi</button>
          </div>
        </div>
        {refi.enabled && (
          <>
            <div className={s.inputGrid}>
              <CurrencyInput label="Refi LTV" hint="Loan-to-value on the cash-out refinance. 50–60% typical for stabilized assets." value={refi.ltv} onChange={v => setRefiK('ltv', v)} prefix="" suffix="%" />
              <CurrencyInput label="Refi Rate" hint="Expected rate on the cash-out refi loan." value={refi.rate} onChange={v => setRefiK('rate', v)} prefix="" suffix="%" />
              <CurrencyInput label="Refi Amort (yrs)" hint="Amort period for the refi loan." value={refi.amort} onChange={v => setRefiK('amort', v)} prefix="" />
            </div>
            {calc.results[2].refi && (
              <div className={s.outputCard}>
                <div className={s.outputTitle}>Post-Refi Position</div>
                <div className={s.outputRow}><span className={s.outputLabel}>Refi Loan Amount</span><span className={s.outputValue}>{fmt$(calc.results[2].refi.refiLoan)}</span></div>
                <div className={s.outputRow}><span className={s.outputLabel}>Cash Extracted (tax-free)</span><span className={`${s.outputValue} ${s.positive}`}>{fmt$(calc.results[2].refi.cashExtracted)}</span></div>
                <div className={s.outputRow}><span className={s.outputLabel}>Refi Debt Service</span><span className={s.outputValue}>{fmt$(calc.results[2].refi.refiAnnDS)}</span></div>
                <div className={s.outputRow}><span className={s.outputLabel}>Net CF Post-Refi</span><span className={s.outputValue}>{fmt$(calc.results[2].refi.cfPostRefi)}</span></div>
                <div className={s.outputRow}><span className={s.outputLabel}>Remaining Equity</span><span className={s.outputValue}>{fmt$(calc.results[2].refi.remainingEquity)}</span></div>
                <div className={s.outputRow}><span className={s.outputLabel}>CoC on Remaining Equity</span><span className={`${s.outputValue} ${s.positive}`}>{fmtPct(calc.results[2].refi.cocPostRefi)}</span></div>
                <div className={s.outputRow}><span className={s.outputLabel}>DSCR (Refi)</span><span className={s.outputValue}>{calc.results[2].refi.refiDSCR.toFixed(2)}x</span></div>
              </div>
            )}
          </>
        )}
      </div>

      <PortfolioPreview
        clientName={clientName}
        previewDate={new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        sub={sub}
        scenarios={scenarios}
        calc={calc}
        refi={refi}
        onExport={handleExport}
      />
    </div>
  )
}

function PortfolioPreview({ clientName, previewDate, sub, scenarios, calc, refi, onExport }) {
  const p = {
    outer: { width: 460, flexShrink: 0, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', position: 'sticky', top: 0, background: '#fff' },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid var(--border)', background: 'var(--bg-hover)' },
    headerTitle: { fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' },
    body: { maxHeight: 720, overflowY: 'auto' },
    wrap: { padding: '10px 14px', fontFamily: "'Inter', -apple-system, sans-serif", color: '#1a1a1a', fontSize: 9, lineHeight: 1.3, background: '#fff' },
    banner: { background: '#101828', color: '#fff', padding: '6px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: 3, marginBottom: 4 },
    bannerTitle: { fontSize: 11, margin: 0, fontWeight: 700 },
    bannerSub: { fontSize: 7.5, opacity: 0.7 },
    meta: { fontSize: 8.5, color: '#6e7378', marginBottom: 6 },
    grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
    section: { fontSize: 8, fontWeight: 700, color: '#0969da', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #d0d7de', padding: '3px 0 1px', margin: '6px 0 2px' },
    row: { display: 'flex', justifyContent: 'space-between', padding: '1px 3px', fontSize: 8.5, lineHeight: 1.25 },
    rowAlt: { background: '#f5f7fa' },
    rowLabel: { color: '#6e7378' },
    rowValue: { fontWeight: 600 },
    hl: { borderTop: '1px solid #d0d7de', marginTop: 2, paddingTop: 2 },
    hlValue: { color: '#22783c', fontWeight: 700 },
    deadlines: { display: 'flex', gap: 6, margin: '6px 0' },
    deadlineBox: { flex: 1, background: '#fffbe6', border: '1px solid #f0cc4a', borderRadius: 3, padding: '3px 5px', textAlign: 'center' },
    deadlineLabel: { color: '#6e7378', fontWeight: 600, display: 'block', fontSize: 7.5 },
    deadlineValue: { color: '#9a6700', fontWeight: 700, fontSize: 9 },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 8, marginTop: 3 },
    th: { textAlign: 'right', padding: '2px 4px', fontWeight: 700, borderBottom: '1px solid #d0d7de', background: '#f5f7fa', color: '#1a1a1a' },
    thFirst: { textAlign: 'left' },
    td: { textAlign: 'right', padding: '2px 4px', fontSize: 8, color: '#1a1a1a' },
    tdFirst: { textAlign: 'left', color: '#6e7378', fontWeight: 500 },
    trAlt: { background: '#fafbfc' },
    footer: { marginTop: 6, fontSize: 7, color: '#999', borderTop: '1px solid #d0d7de', paddingTop: 3, textAlign: 'center' },
  }

  const subRows = [
    ['Sale Price', fmt$(sub.salePrice)],
    ['Current NOI', fmt$(sub.noi)],
    ['Current Cap Rate', fmtPct(calc.currentCap)],
    ['Existing Debt', sub.hasDebt ? fmt$(sub.currLoanBal) : 'Free & Clear'],
    ['Annual Debt Service', fmt$(calc.sAnnDS)],
    ['Annual Cash Flow', fmt$(calc.sCF)],
    ['Cash-on-Cash', fmtPct(calc.sCoC)],
    [`Commission (${sub.commissionPct}%)`, fmt$(calc.brokerComm)],
  ]
  const rowFns = [
    ['Target Cap Rate', r => fmtPct(r.capRate)],
    ['Acquisition LTV', (r, sc) => sc.mode === 'cashRefi' ? 'All Cash' : fmtPct(r.ltv)],
    ['Portfolio Size', r => fmt$M(r.price)],
    ['Year-1 NOI', r => fmt$(r.newNOI)],
    ['Net Cash Flow', r => fmt$(r.netCF)],
    ['CF vs Current', r => `${r.cfDelta >= 0 ? '+' : ''}${fmt$(r.cfDelta)}`],
    ['DSCR', r => r.dscr > 0 ? `${r.dscr.toFixed(2)}x` : '—'],
    ['Cash-on-Cash', r => fmtPct(r.cashReturn)],
    ['Total Return', r => fmtPct(r.totalReturn)],
  ]

  return (
    <div style={p.outer}>
      <div style={p.header}>
        <span style={p.headerTitle}>PDF Preview</span>
        <button onClick={onExport} style={{ fontSize: 12, fontWeight: 600, fontFamily: 'inherit', color: '#fff', background: 'var(--accent)', border: 'none', padding: '7px 16px', borderRadius: 6, cursor: 'pointer' }}>Export PDF</button>
      </div>
      <div style={p.body}>
        <div style={p.wrap}>
          <div style={p.banner}>
            <h1 style={p.bannerTitle}>PORTFOLIO 1031 EXCHANGE</h1>
            <span style={p.bannerSub}>Matthews REIS</span>
          </div>
          <div style={p.meta}>Prepared for: {clientName} — {previewDate}</div>

          <div style={p.grid}>
            <div>
              <div style={p.section}>Relinquished Portfolio</div>
              {subRows.map(([l, v], i) => (
                <div key={l} style={{ ...p.row, ...(i % 2 ? p.rowAlt : {}) }}>
                  <span style={p.rowLabel}>{l}</span>
                  <span style={p.rowValue}>{v}</span>
                </div>
              ))}
              <div style={{ ...p.row, ...p.hl }}>
                <span style={p.rowLabel}>Net 1031 Equity</span>
                <span style={p.hlValue}>{fmt$(calc.equity1031)}</span>
              </div>
            </div>
            <div>
              <div style={p.section}>1031 Exchange Mechanics</div>
              {calc.totalTaxBill > 0 ? (
                <div style={{ ...p.row, ...p.hl }}>
                  <span style={p.rowLabel}>Tax Deferred via 1031 (per CPA)</span>
                  <span style={p.hlValue}>{fmt$(calc.totalTaxBill)}</span>
                </div>
              ) : (
                <div style={p.row}>
                  <span style={p.rowLabel}>Estimated Tax Deferred</span>
                  <span style={p.rowValue}>Per seller's CPA</span>
                </div>
              )}
              <div style={p.deadlines}>
                <div style={p.deadlineBox}>
                  <span style={p.deadlineLabel}>45-Day ID</span>
                  <span style={p.deadlineValue}>{fmtDate(calc.id45)}</span>
                </div>
                <div style={p.deadlineBox}>
                  <span style={p.deadlineLabel}>180-Day Close</span>
                  <span style={p.deadlineValue}>{fmtDate(calc.close180)}</span>
                </div>
              </div>
            </div>
          </div>

          <div style={p.section}>Replacement Strategies</div>
          <table style={p.table}>
            <thead>
              <tr>
                <th style={{ ...p.th, ...p.thFirst }}></th>
                {scenarios.map((sc, i) => <th key={i} style={p.th}>{i + 1}. {sc.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {rowFns.map(([label, fn], ri) => (
                <tr key={label} style={ri % 2 === 0 ? p.trAlt : {}}>
                  <td style={{ ...p.td, ...p.tdFirst }}>{label}</td>
                  {calc.results.map((r, i) => <td key={i} style={p.td}>{fn(r, scenarios[i])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>

          {refi.enabled && calc.results[2].refi && (
            <>
              <div style={p.section}>Scenario 3 — Cash-Out Refi (Yr 2+)</div>
              <div style={{ ...p.row }}><span style={p.rowLabel}>Refi Terms</span><span style={p.rowValue}>{refi.ltv}% LTV @ {refi.rate.toFixed(2)}%</span></div>
              <div style={{ ...p.row, ...p.rowAlt }}><span style={p.rowLabel}>Cash Extracted (tax-free)</span><span style={p.rowValue}>{fmt$(calc.results[2].refi.cashExtracted)}</span></div>
              <div style={p.row}><span style={p.rowLabel}>Net CF Post-Refi</span><span style={p.rowValue}>{fmt$(calc.results[2].refi.cfPostRefi)}</span></div>
              <div style={{ ...p.row, ...p.rowAlt }}><span style={p.rowLabel}>Remaining Equity</span><span style={p.rowValue}>{fmt$(calc.results[2].refi.remainingEquity)}</span></div>
              <div style={p.row}><span style={p.rowLabel}>CoC on Remaining Equity</span><span style={p.rowValue}>{fmtPct(calc.results[2].refi.cocPostRefi)}</span></div>
            </>
          )}

          <div style={p.footer}>Year-1 estimates. Cash-out refi proceeds are tax-free loan proceeds, not income. For analysis purposes only. — Matthews REIS</div>
        </div>
      </div>
    </div>
  )
}
