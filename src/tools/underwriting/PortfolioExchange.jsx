import { useState, useMemo } from 'react'
import CurrencyInput from '../CurrencyInput'
import { openHtml } from '../../lib/pdfExport'
import s from '../shared.module.css'
import styles from './exchange.module.css'

const fmt$ = v => `$${Math.round(v).toLocaleString()}`
const fmt$M = v => `$${(v / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 })}M`
const fmtPct = v => `${(v * 100).toFixed(2)}%`
const fmtMult = v => `${v.toFixed(2)}x`
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

function PropNumInput({ value, onChange, className, title, placeholder }) {
  const [focused, setFocused] = useState(false)
  const [rawText, setRawText] = useState('')
  const display = focused ? rawText : (value || value === 0 ? String(value) : '')
  return (
    <input
      className={className}
      type="text"
      inputMode="decimal"
      value={display}
      title={title}
      placeholder={placeholder}
      onChange={e => {
        const raw = e.target.value.replace(/[^0-9.]/g, '')
        setRawText(raw)
        if (raw === '' || raw === '.') {
          onChange(0)
        } else {
          const num = parseFloat(raw)
          if (!isNaN(num)) onChange(num)
        }
      }}
      onFocus={() => { setFocused(true); setRawText(value === 0 ? '' : String(value)) }}
      onBlur={() => setFocused(false)}
    />
  )
}

function effectiveCap(properties) {
  if (!properties || properties.length === 0) return 0
  const totalAlloc = properties.reduce((s, p) => s + (p.allocation || 0), 0)
  if (totalAlloc === 0) return 0
  return properties.reduce((s, p) => s + (p.allocation || 0) * (p.capRate || 0), 0) / totalAlloc
}

const GOALS = {
  maxCF: 'More cash flow',
  preserveCF: 'Same CF, lower risk',
  freeAndClear: 'No leverage',
  cashOut: 'Extract tax-free cash',
}

const DEFAULT_SUB = {
  salePrice: 29_000_000,
  noi: 1_450_000,
  hasDebt: true,
  currLoanBal: 10_000_000,
  monthlyDebtService: 58_459,  // ~$10M @ 5% / 25yr; broker just asks "what's the mortgage payment"
  titleEscrow: 75_000,
  commissionPct: 2,
  estimatedTaxLiability: 0,
  estimatedCloseDate: new Date().toISOString().slice(0, 10),  // yyyy-mm-dd
}

const DEFAULT_PROJ = {
  years: 10,
  appreciation: 3.0,        // annual %, applied to value + NOI
  sellingCostsPct: 4.0,     // % of terminal value (exit broker fee + closing)
}

const DEFAULT_SCENARIOS = [
  {
    name: 'Maximize Cash Flow',
    ltv: 50, rate: 6.5, amort: 30, mode: 'leveraged', recourse: true,
    goalKey: 'maxCF', notes: '',
    properties: [{ name: 'Property 1', allocation: 100, capRate: 6.75 }],
  },
  {
    name: 'Preserve CF, Reduce Risk',
    ltv: 30, rate: 6.5, amort: 30, mode: 'leveraged', recourse: false,
    goalKey: 'preserveCF', notes: '',
    properties: [{ name: 'Property 1', allocation: 100, capRate: 5.75 }],
  },
  {
    name: 'Free & Clear (No Refi)',
    ltv: 0, rate: 0, amort: 30, mode: 'cashOnly', recourse: false,
    goalKey: 'freeAndClear', notes: '',
    properties: [{ name: 'Property 1', allocation: 100, capRate: 5.50 }],
  },
  {
    name: 'Free & Clear + Cash-Out Refi',
    ltv: 0, rate: 0, amort: 30, mode: 'cashRefi', recourse: true,
    goalKey: 'cashOut', notes: '',
    properties: [{ name: 'Property 1', allocation: 100, capRate: 5.50 }],
  },
]

const DEFAULT_REFI = { enabled: true, ltv: 50, rate: 6.5, amort: 30 }

function buildScenario(equity1031, minReplacementValue, params, sCF, refi, proj) {
  const { ltv, rate, amort, properties } = params
  const lev = ltv / 100
  const cap = effectiveCap(properties) / 100

  // 1031-safe sizing: ≥ relinquished sale price
  const equityImpliedPrice = lev < 1 ? equity1031 / (1 - lev) : equity1031
  const price = Math.max(equityImpliedPrice, minReplacementValue)
  const loanAmt = price * lev
  const downPayment = price - loanAmt
  const additionalCashNeeded = Math.max(0, downPayment - equity1031)
  const totalCashInvested = equity1031 + additionalCashNeeded

  const newNOI = price * cap
  const mRate = rate / 100 / 12
  const annDS = loanAmt > 0 ? -PMT(mRate, amort * 12, loanAmt) * 12 : 0
  const princRedux = loanAmt > 0 ? -CUMPRINC(mRate, amort * 12, loanAmt, 1, 12) : 0
  const netCF = newNOI - annDS
  const cashReturn = totalCashInvested > 0 ? netCF / totalCashInvested : 0
  const totalReturn = totalCashInvested > 0 ? (netCF + princRedux) / totalCashInvested : 0
  const dscr = annDS > 0 ? newNOI / annDS : 0
  const debtYield = loanAmt > 0 ? newNOI / loanAmt : 0
  const cfDelta = netCF - sCF

  // Refi (Scenario 4) — modeled as a Year-2 event. Year 1 uses acquisition
  // terms (all-cash); refi terms apply from Year 2 onward. The cash extracted
  // is realized at the refi event.
  let refiOut = null
  let refiLoan = 0
  let refiAnnDS = 0
  let refiMRate = 0
  let refiAmort = amort
  let cashExtractedAtRefi = 0
  if (refi && refi.enabled) {
    const refiLev = refi.ltv / 100
    refiMRate = refi.rate / 100 / 12
    refiAmort = refi.amort
    refiLoan = price * refiLev
    refiAnnDS = refiLoan > 0 ? -PMT(refiMRate, refiAmort * 12, refiLoan) * 12 : 0
    const refiPrincRedux = refiLoan > 0 ? -CUMPRINC(refiMRate, refiAmort * 12, refiLoan, 1, 12) : 0
    const cashExtracted = refiLoan
    const cfPostRefi = newNOI - refiAnnDS
    const remainingEquity = Math.max(0, price - refiLoan)
    const cocPostRefi = remainingEquity > 0 ? cfPostRefi / remainingEquity : 0
    const totalReturnPostRefi = remainingEquity > 0 ? (cfPostRefi + refiPrincRedux) / remainingEquity : 0
    const refiDSCR = refiAnnDS > 0 ? newNOI / refiAnnDS : 0
    refiOut = { refiLoan, refiAnnDS, refiPrincRedux, cashExtracted, cfPostRefi, remainingEquity, cocPostRefi, totalReturnPostRefi, refiDSCR }
    cashExtractedAtRefi = cashExtracted
  }

  // Hold-period projection. For cashRefi: Year 1 acquisition (no debt service),
  // Year 2+ uses refi terms. For all other scenarios: same terms throughout.
  const apprRate = (proj.appreciation || 0) / 100
  const years = Math.max(0, Math.floor(proj.years || 0))
  const hasRefi = refi && refi.enabled
  let cumCF = 0
  for (let y = 1; y <= years; y++) {
    const yrNOI = newNOI * Math.pow(1 + apprRate, y - 1)
    const inRefiPhase = hasRefi && y >= 2
    const yrDS = inRefiPhase ? refiAnnDS : annDS
    cumCF += (yrNOI - yrDS)
  }
  // Paydown years: full hold for non-refi; years 2..N for refi
  const paydownYears = hasRefi ? Math.max(0, years - 1) : years
  const paydownLoanAmt = hasRefi ? refiLoan : loanAmt
  const paydownRate = hasRefi ? refiMRate : mRate
  const paydownAmort = hasRefi ? refiAmort : amort
  const cumPaydown = (paydownYears > 0 && paydownLoanAmt > 0)
    ? -CUMPRINC(paydownRate, paydownAmort * 12, paydownLoanAmt, 1, paydownYears * 12)
    : 0
  const remLoan = Math.max(0, paydownLoanAmt - cumPaydown)
  const terminalValue = price * Math.pow(1 + apprRate, years)
  const sellingCosts = terminalValue * (proj.sellingCostsPct / 100)
  const netSaleProceeds = Math.max(0, terminalValue - remLoan - sellingCosts)
  const totalReturned = cashExtractedAtRefi + cumCF + netSaleProceeds
  const equityMultiple = totalCashInvested > 0 ? totalReturned / totalCashInvested : 0
  // Signed CAGR: handles negative returns honestly. Total wipeout (≤0) → -100%.
  const cagr = (totalCashInvested > 0 && years > 0)
    ? (totalReturned > 0
        ? Math.pow(totalReturned / totalCashInvested, 1 / years) - 1
        : -1)
    : 0

  return {
    price, loanAmt, ltv: lev, newNOI, capRate: cap, annDS, princRedux,
    netCF, cashReturn, totalReturn, dscr, debtYield, cfDelta,
    additionalCashNeeded, totalCashInvested, refi: refiOut,
    terminalValue, cumCF, cumPaydown, remLoan, sellingCosts, netSaleProceeds,
    totalReturned, equityMultiple, cagr, cashExtractedAtRefi,
  }
}

export default function PortfolioExchange() {
  const [clientName, setClientName] = useState('Client')
  const [sub, setSub] = useState(DEFAULT_SUB)
  const [scenarios, setScenarios] = useState(DEFAULT_SCENARIOS)
  const [refi, setRefi] = useState(DEFAULT_REFI)
  const [proj, setProj] = useState(DEFAULT_PROJ)
  const [activeGoal, setActiveGoal] = useState(null)
  const [previewOpen, setPreviewOpen] = useState(true)
  const [showProjection, setShowProjection] = useState(true)
  const [showClosingCosts, setShowClosingCosts] = useState(true)

  const set = (k, v) => setSub(p => ({ ...p, [k]: v }))
  const setSc = (i, k, v) => setScenarios(p => p.map((sc, j) => j === i ? { ...sc, [k]: v } : sc))
  const setRefiK = (k, v) => setRefi(p => ({ ...p, [k]: v }))
  const setProjK = (k, v) => setProj(p => ({ ...p, [k]: v }))

  const setProp = (scIdx, pIdx, k, v) => setScenarios(p => p.map((sc, j) =>
    j === scIdx
      ? { ...sc, properties: sc.properties.map((prop, pj) => pj === pIdx ? { ...prop, [k]: v } : prop) }
      : sc
  ))
  const addProp = scIdx => setScenarios(p => p.map((sc, j) => {
    if (j !== scIdx) return sc
    const next = sc.properties.length + 1
    return { ...sc, properties: [...sc.properties, { name: `Property ${next}`, allocation: 0, capRate: sc.properties[0]?.capRate || 6 }] }
  }))
  const removeProp = (scIdx, pIdx) => setScenarios(p => p.map((sc, j) =>
    j === scIdx && sc.properties.length > 1
      ? { ...sc, properties: sc.properties.filter((_, pj) => pj !== pIdx) }
      : sc
  ))
  const addScenario = () => setScenarios(p => [...p, {
    name: `Scenario ${p.length + 1}`,
    ltv: 40, rate: 6.5, amort: 30, mode: 'leveraged', recourse: true,
    goalKey: '', notes: '',
    properties: [{ name: 'Property 1', allocation: 100, capRate: 6.0 }],
  }])
  const removeScenario = i => setScenarios(p => p.length > 1 ? p.filter((_, j) => j !== i) : p)

  const calc = useMemo(() => {
    const currLoanBal = sub.hasDebt ? sub.currLoanBal : 0
    const brokerComm = sub.salePrice * (sub.commissionPct / 100)
    const equity1031 = Math.max(0, sub.salePrice - currLoanBal - sub.titleEscrow - brokerComm)

    const sAnnDS = sub.hasDebt ? (sub.monthlyDebtService || 0) * 12 : 0
    const sCF = sub.noi - sAnnDS
    const sEquity = Math.max(0, sub.salePrice - currLoanBal)
    const sCoC = sEquity > 0 ? sCF / sEquity : 0
    const sDSCR = sAnnDS > 0 ? sub.noi / sAnnDS : 0
    const currentCap = sub.salePrice > 0 ? sub.noi / sub.salePrice : 0

    const totalTaxBill = Math.max(0, sub.estimatedTaxLiability)

    // 1031 deadlines run from the relinquished close — not "today." Broker
    // enters the estimated close date; falls back to today if blank/invalid.
    const closeBase = sub.estimatedCloseDate ? new Date(sub.estimatedCloseDate + 'T00:00:00') : new Date()
    const anchorDate = isNaN(closeBase.getTime()) ? new Date() : closeBase
    const id45 = new Date(anchorDate.getTime() + 45 * 86400000)
    const close180 = new Date(anchorDate.getTime() + 180 * 86400000)

    const results = scenarios.map(sc => {
      const isCashAcq = sc.mode === 'cashOnly' || sc.mode === 'cashRefi'
      const params = isCashAcq ? { ...sc, ltv: 0 } : sc
      const refiCfg = sc.mode === 'cashRefi' ? refi : null
      return buildScenario(equity1031, sub.salePrice, params, sCF, refiCfg, proj)
    })

    return {
      equity1031, brokerComm, currLoanBal,
      sAnnDS, sCF, sEquity, sCoC, sDSCR, currentCap,
      totalTaxBill,
      anchorDate, id45, close180, results,
    }
  }, [sub, scenarios, refi, proj])

  const refiIdx = scenarios.findIndex(sc => sc.mode === 'cashRefi')
  const refiResult = refiIdx >= 0 ? calc.results[refiIdx]?.refi : null

  const handleExport = () => {
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    const recommendedIdx = activeGoal ? scenarios.findIndex(sc => sc.goalKey === activeGoal) : -1
    const recommendedScenario = recommendedIdx >= 0 ? scenarios[recommendedIdx] : null
    const goalLabel = activeGoal && GOALS[activeGoal] ? GOALS[activeGoal] : ''
    const subRows = [
      ['Sale Price', fmt$(sub.salePrice)],
      ['Current NOI', fmt$(sub.noi)],
      ['Current Cap Rate', fmtPct(calc.currentCap)],
      ['Existing Debt', sub.hasDebt ? fmt$(sub.currLoanBal) : 'Free & Clear'],
      ['Annual Debt Service', fmt$(calc.sAnnDS)],
      ['Annual Cash Flow', fmt$(calc.sCF)],
      ['Cash-on-Cash', fmtPct(calc.sCoC)],
      ...(showClosingCosts ? [['Closing Costs', fmt$(calc.brokerComm + sub.titleEscrow)]] : []),
    ]

    const isCashMode = sc => sc.mode === 'cashOnly' || sc.mode === 'cashRefi'
    const rowFns = [
      ['Effective Cap Rate', r => fmtPct(r.capRate)],
      ['Acquisition LTV', (r, sc) => isCashMode(sc) ? 'All Cash' : fmtPct(r.ltv)],
      ['Loan Rate / Recourse', (r, sc) => isCashMode(sc) ? '—' : `${sc.rate.toFixed(2)}% · ${sc.recourse ? 'Recourse' : 'Non-Rec'}`],
      ['Portfolio Size', r => fmt$(r.price)],
      ['Acquisition Debt', r => fmt$(r.loanAmt)],
      ['+ Cash Needed', r => r.additionalCashNeeded > 0 ? fmt$(r.additionalCashNeeded) : '—'],
      ['Total Cash Invested', r => fmt$(r.totalCashInvested)],
      ['Year-1 NOI', r => fmt$(r.newNOI)],
      ['Annual Debt Service', r => fmt$(r.annDS)],
      ['Net Cash Flow', r => fmt$(r.netCF)],
      ['CF vs Current', r => `${r.cfDelta >= 0 ? '+' : ''}${fmt$(r.cfDelta)}`],
      ['DSCR', r => r.dscr > 0 ? fmtMult(r.dscr) : '—'],
      ['Cash-on-Cash', r => fmtPct(r.cashReturn)],
    ]

    const projRowFns = [
      [`Terminal Value (Yr ${proj.years})`, r => fmt$(r.terminalValue)],
      [`Cumulative CF (${proj.years}y)`, r => fmt$(r.cumCF)],
      ['Principal Paydown', r => fmt$(r.cumPaydown)],
      ['Net Sale Proceeds', r => fmt$(r.netSaleProceeds)],
      ['Cash Extracted (Refi)', r => r.cashExtractedAtRefi > 0 ? fmt$(r.cashExtractedAtRefi) : '—'],
      ['Total $ Returned', r => fmt$(r.totalReturned)],
      ['Equity Multiple', r => fmtMult(r.equityMultiple)],
      ['Annualized Return (CAGR)', r => fmtPct(r.cagr)],
    ]

    const refiScenarioName = refiIdx >= 0 ? scenarios[refiIdx].name : ''
    const refiSection = (refi.enabled && refiResult) ? `
<div class="section">${refiScenarioName} — Cash-Out Refinance (Year 2+)</div>
<table>
  <thead><tr><th></th><th>Post-Refi Position</th></tr></thead>
  <tbody>
    <tr class="alt"><td>Refi LTV / Rate</td><td>${refi.ltv}% @ ${refi.rate.toFixed(2)}%</td></tr>
    <tr><td>Refi Loan Amount</td><td>${fmt$(refiResult.refiLoan)}</td></tr>
    <tr class="alt"><td>Cash Extracted (tax-free)</td><td>${fmt$(refiResult.cashExtracted)}</td></tr>
    <tr><td>Refi Debt Service</td><td>${fmt$(refiResult.refiAnnDS)}</td></tr>
    <tr class="alt"><td>Net CF Post-Refi</td><td>${fmt$(refiResult.cfPostRefi)}</td></tr>
    <tr><td>Remaining Equity (in Property)</td><td>${fmt$(refiResult.remainingEquity)}</td></tr>
    <tr class="alt"><td>CoC on Remaining Equity</td><td>${fmtPct(refiResult.cocPostRefi)}</td></tr>
    <tr><td>DSCR (Refi)</td><td>${fmtMult(refiResult.refiDSCR)}</td></tr>
  </tbody>
</table>` : ''

    const notesSection = scenarios.some(sc => sc.notes && sc.notes.trim()) ? `
<div class="section">Notes</div>
${scenarios.map((sc, i) => sc.notes && sc.notes.trim() ? `<div class="noteBlock"><strong>${i + 1}. ${sc.name}:</strong> ${sc.notes}</div>` : '').join('')}` : ''

    const recNote = recommendedScenario
      ? `<div class="recBadge">★ Recommended strategy: ${recommendedScenario.name} — aligned with goal "${goalLabel}"</div>`
      : ''

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title> </title>
<style>
@page{size:letter landscape;margin:0}
*{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
html,body{margin:0;padding:0}
body{font-family:'Inter',-apple-system,sans-serif;color:#1a1a1a;line-height:1.2;font-size:7.5px;padding:.25in}
.banner{background:#101828;color:#fff;padding:4px 10px;display:flex;justify-content:space-between;align-items:center;border-radius:3px;margin-bottom:3px}
.banner h1{font-size:11px;margin:0;font-weight:700}
.banner span{font-size:7px;opacity:.7}
.meta{font-size:8px;color:#6e7378;margin-bottom:4px}
.recBadge{font-size:7.5px;color:#0969da;background:#dbeafe;border:1px solid #93c5fd;border-radius:3px;padding:2px 8px;margin-bottom:4px;font-weight:600}
th.recCol{background:#dbeafe;color:#0969da}
tr td.recCol{background:#eff6ff}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.section{font-size:7.5px;font-weight:700;color:#0969da;text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid #d0d7de;padding:2px 0 1px;margin:4px 0 1px}
.row{display:flex;justify-content:space-between;padding:1px 3px;font-size:7.5px;line-height:1.2}
.row span:first-child{color:#6e7378}.row span:last-child{font-weight:600}
.alt{background:#f5f7fa}
.hl{border-top:1px solid #d0d7de;margin-top:2px;padding-top:2px}
.hl span:last-child{color:#22783c;font-weight:700}
.deadlines{display:flex;gap:6px;margin:4px 0}
.deadlines>div{flex:1;background:#fffbe6;border:1px solid #f0cc4a;border-radius:3px;padding:2px 4px;text-align:center}
.deadlines span:first-child{color:#6e7378;font-weight:600;display:block;font-size:7px}
.deadlines span:last-child{color:#9a6700;font-weight:700;font-size:8px}
table{width:100%;border-collapse:collapse;font-size:7.5px;margin-top:2px}
th{text-align:right;padding:1.5px 4px;font-weight:700;border-bottom:1px solid #d0d7de;background:#f5f7fa}
th:first-child{text-align:left}
td{text-align:right;padding:1.5px 4px}
td:first-child{text-align:left;color:#6e7378;font-weight:500}
tr.alt{background:#fafbfc}
.noteBlock{font-size:7.5px;padding:2px 4px;margin-top:1px;color:#1a1a1a}
.footer{margin-top:4px;font-size:6.5px;color:#999;border-top:1px solid #d0d7de;padding-top:2px;text-align:center}
</style></head><body>
<div class="banner"><h1>PORTFOLIO 1031 EXCHANGE — STRATEGY COMPARISON</h1><span>Matthews Real Estate Investment Services</span></div>
<div class="meta">Prepared for: ${clientName} &mdash; ${dateStr}</div>
${recNote}
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
      <div><span>Relinquished Close</span><span>${fmtDate(calc.anchorDate)}</span></div>
      <div><span>45-Day ID</span><span>${fmtDate(calc.id45)}</span></div>
      <div><span>180-Day Close</span><span>${fmtDate(calc.close180)}</span></div>
    </div>
    <div class="row"><span>Hold Period (assumed)</span><span>${proj.years} years</span></div>
    <div class="row alt"><span>Appreciation Rate (assumed)</span><span>${proj.appreciation.toFixed(2)}%/yr</span></div>
  </div>
</div>

<div class="section">Replacement Portfolio — Year 1</div>
<table>
  <thead><tr><th></th>${scenarios.map((sc, i) => `<th${i === recommendedIdx ? ' class="recCol"' : ''}>${i === recommendedIdx ? '★ ' : ''}${i + 1}. ${sc.name}</th>`).join('')}</tr></thead>
  <tbody>
    ${rowFns.map(([label, fn], ri) => `<tr class="${ri % 2 === 0 ? 'alt' : ''}"><td>${label}</td>${calc.results.map((r, i) => `<td${i === recommendedIdx ? ' class="recCol"' : ''}>${fn(r, scenarios[i])}</td>`).join('')}</tr>`).join('')}
  </tbody>
</table>

${showProjection ? `<div class="section">Hold-Period Projection (${proj.years} yrs @ ${proj.appreciation.toFixed(2)}%/yr appreciation)</div>
<table>
  <thead><tr><th></th>${scenarios.map((sc, i) => `<th${i === recommendedIdx ? ' class="recCol"' : ''}>${i === recommendedIdx ? '★ ' : ''}${i + 1}. ${sc.name}</th>`).join('')}</tr></thead>
  <tbody>
    ${projRowFns.map(([label, fn], ri) => `<tr class="${ri % 2 === 0 ? 'alt' : ''}"><td>${label}</td>${calc.results.map((r, i) => `<td${i === recommendedIdx ? ' class="recCol"' : ''}>${fn(r, scenarios[i])}</td>`).join('')}</tr>`).join('')}
  </tbody>
</table>` : ''}

${refiSection}
${notesSection}

<div class="footer">Year-1 estimates + ${proj.years}-yr projection assume ${proj.appreciation.toFixed(2)}% annual appreciation on value &amp; NOI, ${proj.sellingCostsPct}% selling costs. Cash-out refi proceeds are tax-free loan proceeds, not income. For analysis purposes only — consult a qualified tax/legal professional. &mdash; Matthews REIS</div>
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
          <div className={s.fieldGroup}>
            <label className={s.label}>Recommend a strategy</label>
            <div className={styles.goalChips}>
              {Object.entries(GOALS).map(([key, label]) => (
                <button
                  key={key}
                  className={`${styles.goalChip} ${activeGoal === key ? styles.goalChipActive : ''}`}
                  onClick={() => setActiveGoal(activeGoal === key ? null : key)}
                >{label}</button>
              ))}
            </div>
          </div>
        </div>

        <div className={s.sectionLabel}>Relinquished Portfolio</div>
        <div className={s.inputGrid}>
          <CurrencyInput label="Portfolio Sale Price" hint="Aggregate sale price across all properties in the portfolio." value={sub.salePrice} onChange={v => set('salePrice', v)} />
          <CurrencyInput label="Current Portfolio NOI" hint="Combined trailing or Year-1 NOI of the portfolio being sold." value={sub.noi} onChange={v => set('noi', v)} />
          <CurrencyInput label="Title / Escrow" hint="Aggregate closing costs (title, escrow, transfer tax) across the sale." value={sub.titleEscrow} onChange={v => set('titleEscrow', v)} />
          <CurrencyInput label="Commission %" hint="Total brokerage commission on the portfolio sale." value={sub.commissionPct} onChange={v => set('commissionPct', v)} prefix="" suffix="%" />
          <div className={s.fieldGroup}>
            <label className={s.label}>Show Closing Costs in PDF</label>
            <div className={styles.toggleRow}>
              <button className={`${styles.toggleBtn} ${!showClosingCosts ? styles.toggleActive : ''}`} onClick={() => setShowClosingCosts(false)}>Hide</button>
              <button className={`${styles.toggleBtn} ${showClosingCosts ? styles.toggleActive : ''}`} onClick={() => setShowClosingCosts(true)}>Show</button>
            </div>
            <div className={s.hint}>Whether the combined commission + title/escrow line appears in the seller-facing PDF and preview.</div>
          </div>
          <div className={s.fieldGroup}>
            <label className={s.label}>Est. Close Date (Relinquished)</label>
            <input className={s.input} type="date" value={sub.estimatedCloseDate} onChange={e => set('estimatedCloseDate', e.target.value)} />
            <div className={s.hint}>1031 identifies 45 days from close; replacement must close within 180 days.</div>
          </div>
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
            <CurrencyInput label="Monthly Debt Service" hint="What the seller is paying per month across the portfolio. Easier and more accurate than deriving from rate + amort." value={sub.monthlyDebtService} onChange={v => set('monthlyDebtService', v)} />
          </div>
        )}

        <div className={s.sectionLabel} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          Hold-Period Projection
          <div className={styles.toggleRow}>
            <button className={`${styles.toggleBtn} ${!showProjection ? styles.toggleActive : ''}`} onClick={() => setShowProjection(false)}>Hide</button>
            <button className={`${styles.toggleBtn} ${showProjection ? styles.toggleActive : ''}`} onClick={() => setShowProjection(true)}>Show</button>
          </div>
        </div>
        {showProjection && (
          <div className={s.inputGrid}>
            <CurrencyInput label="Hold Period (yrs)" hint="Years to model the wealth-comparison projection (terminal value, cumulative CF, equity multiple, CAGR)." value={proj.years} onChange={v => setProjK('years', v)} prefix="" />
            <CurrencyInput label="Appreciation (annual)" hint="Annual value + NOI growth rate applied to all scenarios. 2–4% is a reasonable national average; adjust for market." value={proj.appreciation} onChange={v => setProjK('appreciation', v)} prefix="" suffix="%" />
            <CurrencyInput label="Selling Costs (terminal)" hint="% of terminal value spent on exit broker commission, title, transfer tax. 3–5% typical." value={proj.sellingCostsPct} onChange={v => setProjK('sellingCostsPct', v)} prefix="" suffix="%" />
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
        <div className={styles.replGrid} style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          {scenarios.map((sc, i) => {
            const r = calc.results[i]
            const isRefi = sc.mode === 'cashRefi'
            const isCashAcq = sc.mode === 'cashOnly' || sc.mode === 'cashRefi'
            const recommended = activeGoal && sc.goalKey === activeGoal
            return (
              <div
                key={i}
                className={styles.replCard}
                style={recommended ? { borderColor: 'var(--accent)', boxShadow: '0 0 0 1px var(--accent)' } : {}}
              >
                {recommended && (
                  <div className={styles.recommendedBadge}>Recommended</div>
                )}
                {scenarios.length > 1 && (
                  <button
                    onClick={() => removeScenario(i)}
                    title="Remove scenario"
                    style={{
                      position: 'absolute', top: 8, right: 8,
                      width: 22, height: 22, padding: 0, lineHeight: 1,
                      fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
                      color: 'var(--text-muted)', background: 'transparent',
                      border: '1px solid var(--border)', borderRadius: 4,
                      cursor: 'pointer',
                    }}
                  >×</button>
                )}
                <input className={styles.replName} value={sc.name} onChange={e => setSc(i, 'name', e.target.value)} placeholder={`Scenario ${i + 1}`} />
                <div className={styles.replInputs}>
                  {!isCashAcq && <>
                    <CurrencyInput label="Acquisition LTV" hint="Debt as % of new portfolio purchase price." value={sc.ltv} onChange={v => setSc(i, 'ltv', v)} prefix="" suffix="%" />
                    <CurrencyInput label="Loan Rate" hint="Blended rate on acquisition debt." value={sc.rate} onChange={v => setSc(i, 'rate', v)} prefix="" suffix="%" />
                    <CurrencyInput label="Amortization" hint="Amort period (yrs). 25–30 typical." value={sc.amort} onChange={v => setSc(i, 'amort', v)} prefix="" />
                    <div className={s.fieldGroup}>
                      <label className={s.label}>Loan Type</label>
                      <div className={styles.toggleRow}>
                        <button className={`${styles.toggleBtn} ${!sc.recourse ? styles.toggleActive : ''}`} onClick={() => setSc(i, 'recourse', false)}>Non-Recourse</button>
                        <button className={`${styles.toggleBtn} ${sc.recourse ? styles.toggleActive : ''}`} onClick={() => setSc(i, 'recourse', true)}>Recourse</button>
                      </div>
                    </div>
                  </>}
                  {isCashAcq && (
                    <div className={s.hint} style={{ marginTop: -2 }}>
                      {isRefi
                        ? 'All-cash acquisition sized to the relinquished sale price (1031-safe), then a planned cash-out refinance in year 2+. Refi terms below.'
                        : 'All-cash acquisition sized to the relinquished sale price (1031-safe). No leverage, no refi — pure preservation strategy.'}
                    </div>
                  )}
                </div>

                <div className={styles.subProperties}>
                  <div className={styles.subPropertiesLabel}>
                    <span>Replacement Properties</span>
                    <button className={styles.addPropBtn} onClick={() => addProp(i)}>+ Add</button>
                  </div>
                  {sc.properties.map((prop, pi) => (
                    <div key={pi} className={styles.propRow}>
                      <input
                        className={styles.propName}
                        value={prop.name}
                        onChange={e => setProp(i, pi, 'name', e.target.value)}
                        placeholder={`Property ${pi + 1}`}
                      />
                      <PropNumInput
                        className={styles.propNum}
                        value={prop.allocation}
                        onChange={v => setProp(i, pi, 'allocation', v)}
                        title="Allocation %"
                      />
                      <span className={styles.propUnit}>%</span>
                      <PropNumInput
                        className={styles.propNum}
                        value={prop.capRate}
                        onChange={v => setProp(i, pi, 'capRate', v)}
                        title="Cap rate %"
                      />
                      <span className={styles.propUnit}>cap</span>
                      {sc.properties.length > 1 && (
                        <button className={styles.propRemove} onClick={() => removeProp(i, pi)} title="Remove">×</button>
                      )}
                    </div>
                  ))}
                  <div className={styles.propWeighted}>Weighted Cap: <strong>{fmtPct(r.capRate)}</strong></div>
                </div>

                <div className={styles.replResults}>
                  <div className={styles.replRow}><span>Portfolio Size</span><span>{fmt$M(r.price)}</span></div>
                  <div className={styles.replRow}><span>Acquisition Debt</span><span>{isCashAcq ? '—' : fmt$M(r.loanAmt)}</span></div>
                  {r.additionalCashNeeded > 0 && (
                    <div className={`${styles.replRow} ${s.warning}`}><span>+ Cash Needed</span><span>{fmt$M(r.additionalCashNeeded)}</span></div>
                  )}
                  <div className={styles.replRow}><span>Total Cash Invested</span><span>{fmt$M(r.totalCashInvested)}</span></div>
                  <div className={styles.replRow}><span>Year-1 NOI</span><span>{fmt$(r.newNOI)}</span></div>
                  <div className={styles.replRow}><span>Debt Service</span><span>{isCashAcq ? '—' : fmt$(r.annDS)}</span></div>
                  <div className={styles.replRow}><span>Net Cash Flow</span><span className={r.netCF < 0 ? s.negative : ''}>{fmt$(r.netCF)}</span></div>
                  <div className={`${styles.replRow} ${r.cfDelta >= 0 ? s.positive : s.negative}`}>
                    <span>CF vs Current</span><span>{r.cfDelta >= 0 ? '+' : ''}{fmt$(r.cfDelta)}</span>
                  </div>
                  <div className={styles.replRow}><span>DSCR</span><span>{r.dscr > 0 ? fmtMult(r.dscr) : '—'}</span></div>
                  <div className={styles.replRow}><span>Cash-on-Cash</span><span className={s.positive}>{fmtPct(r.cashReturn)}</span></div>
                  {showProjection && <>
                    <div className={styles.replRow} style={{ borderTop: '1px dashed var(--border)', paddingTop: 4, marginTop: 4 }}><span>Yr {proj.years} Value</span><span>{fmt$M(r.terminalValue)}</span></div>
                    <div className={styles.replRow}><span>Cum. CF ({proj.years}y)</span><span>{fmt$M(r.cumCF)}</span></div>
                    <div className={styles.replRow}><span>Total $ Returned</span><span className={s.positive}>{fmt$M(r.totalReturned)}</span></div>
                    <div className={styles.replRow}><span>Equity Multiple</span><span className={s.positive}>{fmtMult(r.equityMultiple)}</span></div>
                    <div className={styles.replRow}><span>CAGR</span><span className={s.positive}>{fmtPct(r.cagr)}</span></div>
                  </>}
                </div>

                <div className={styles.scenarioNotes}>
                  <textarea
                    className={s.textarea}
                    placeholder="Notes for this scenario…"
                    value={sc.notes}
                    onChange={e => setSc(i, 'notes', e.target.value)}
                    style={{ minHeight: 50, fontSize: 11 }}
                  />
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ marginTop: 8 }}>
          <button onClick={addScenario} className={s.btnSecondary}>+ Add Scenario</button>
        </div>

        <div className={s.sectionLabel} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          Cash-Out Refi Parameters
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
            {refiResult && (
              <div className={s.outputCard}>
                <div className={s.outputTitle}>Post-Refi Position ({scenarios[refiIdx].name})</div>
                <div className={s.outputRow}><span className={s.outputLabel}>Refi Loan Amount</span><span className={s.outputValue}>{fmt$(refiResult.refiLoan)}</span></div>
                <div className={s.outputRow}><span className={s.outputLabel}>Cash Extracted (tax-free)</span><span className={`${s.outputValue} ${s.positive}`}>{fmt$(refiResult.cashExtracted)}</span></div>
                <div className={s.outputRow}><span className={s.outputLabel}>Refi Debt Service</span><span className={s.outputValue}>{fmt$(refiResult.refiAnnDS)}</span></div>
                <div className={s.outputRow}><span className={s.outputLabel}>Net CF Post-Refi</span><span className={s.outputValue}>{fmt$(refiResult.cfPostRefi)}</span></div>
                <div className={s.outputRow}><span className={s.outputLabel}>Remaining Equity (in Property)</span><span className={s.outputValue}>{fmt$(refiResult.remainingEquity)}</span></div>
                <div className={s.outputRow}><span className={s.outputLabel}>CoC on Remaining Equity</span><span className={`${s.outputValue} ${s.positive}`}>{fmtPct(refiResult.cocPostRefi)}</span></div>
                <div className={s.outputRow}><span className={s.outputLabel}>DSCR (Refi)</span><span className={s.outputValue}>{fmtMult(refiResult.refiDSCR)}</span></div>
              </div>
            )}
          </>
        )}
      </div>

      {previewOpen ? (
        <PortfolioPreview
          clientName={clientName}
          previewDate={new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          sub={sub}
          scenarios={scenarios}
          calc={calc}
          refi={refi}
          proj={proj}
          activeGoal={activeGoal}
          showProjection={showProjection}
          showClosingCosts={showClosingCosts}
          onExport={handleExport}
          onClose={() => setPreviewOpen(false)}
        />
      ) : (
        <button
          onClick={() => setPreviewOpen(true)}
          style={{
            position: 'sticky', top: 0, height: 'fit-content',
            fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
            color: 'var(--text-muted)', background: 'var(--bg-card)',
            border: '1px solid var(--border)', borderRadius: 6,
            padding: '8px 6px', cursor: 'pointer', writingMode: 'vertical-rl',
            textOrientation: 'mixed', letterSpacing: '0.04em',
          }}
          title="Show PDF preview"
        >
          ◀ Show Preview
        </button>
      )}
    </div>
  )
}

function PortfolioPreview({ clientName, previewDate, sub, scenarios, calc, refi, proj, activeGoal, showProjection, showClosingCosts, onExport, onClose }) {
  const recommendedIdx = activeGoal ? scenarios.findIndex(sc => sc.goalKey === activeGoal) : -1
  const recommendedScenario = recommendedIdx >= 0 ? scenarios[recommendedIdx] : null
  const goalLabel = activeGoal && GOALS[activeGoal] ? GOALS[activeGoal] : ''
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
    recBadge: { fontSize: 8, color: '#0969da', background: '#dbeafe', border: '1px solid #93c5fd', borderRadius: 3, padding: '3px 8px', marginBottom: 6, fontWeight: 600 },
    recTh: { background: '#dbeafe', color: '#0969da' },
    recTd: { background: '#eff6ff' },
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
    ...(showClosingCosts ? [['Closing Costs', fmt$(calc.brokerComm + sub.titleEscrow)]] : []),
  ]
  const isCash = sc => sc.mode === 'cashOnly' || sc.mode === 'cashRefi'
  const rowFns = [
    ['Effective Cap', r => fmtPct(r.capRate)],
    ['Acquisition LTV', (r, sc) => isCash(sc) ? 'All Cash' : fmtPct(r.ltv)],
    ['Portfolio Size', r => fmt$M(r.price)],
    ['+ Cash Needed', r => r.additionalCashNeeded > 0 ? fmt$M(r.additionalCashNeeded) : '—'],
    ['Yr-1 NOI', r => fmt$(r.newNOI)],
    ['Net Cash Flow', r => fmt$(r.netCF)],
    ['Cash-on-Cash', r => fmtPct(r.cashReturn)],
    ['DSCR', r => r.dscr > 0 ? fmtMult(r.dscr) : '—'],
  ]
  const projRows = [
    [`Yr ${proj.years} Value`, r => fmt$M(r.terminalValue)],
    [`Cum. CF (${proj.years}y)`, r => fmt$M(r.cumCF)],
    ['Total $ Returned', r => fmt$M(r.totalReturned)],
    ['Equity Multiple', r => fmtMult(r.equityMultiple)],
    ['CAGR', r => fmtPct(r.cagr)],
  ]
  const refiIdx = scenarios.findIndex(sc => sc.mode === 'cashRefi')
  const refiData = refiIdx >= 0 ? calc.results[refiIdx]?.refi : null

  return (
    <div style={p.outer}>
      <div style={p.header}>
        <span style={p.headerTitle}>PDF Preview</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={onExport} style={{ fontSize: 12, fontWeight: 600, fontFamily: 'inherit', color: '#fff', background: 'var(--accent)', border: 'none', padding: '7px 16px', borderRadius: 6, cursor: 'pointer' }}>Export PDF</button>
          <button onClick={onClose} title="Hide preview" style={{ fontSize: 14, fontWeight: 700, fontFamily: 'inherit', color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--border)', width: 28, height: 28, borderRadius: 6, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
      </div>
      <div style={p.body}>
        <div style={p.wrap}>
          <div style={p.banner}>
            <h1 style={p.bannerTitle}>PORTFOLIO 1031 EXCHANGE</h1>
            <span style={p.bannerSub}>Matthews REIS</span>
          </div>
          <div style={p.meta}>Prepared for: {clientName} — {previewDate}</div>
          {recommendedScenario && (
            <div style={p.recBadge}>★ Recommended strategy: {recommendedScenario.name} — aligned with goal "{goalLabel}"</div>
          )}

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
                  <span style={p.deadlineLabel}>Relinquished Close</span>
                  <span style={p.deadlineValue}>{fmtDate(calc.anchorDate)}</span>
                </div>
                <div style={p.deadlineBox}>
                  <span style={p.deadlineLabel}>45-Day ID</span>
                  <span style={p.deadlineValue}>{fmtDate(calc.id45)}</span>
                </div>
                <div style={p.deadlineBox}>
                  <span style={p.deadlineLabel}>180-Day Close</span>
                  <span style={p.deadlineValue}>{fmtDate(calc.close180)}</span>
                </div>
              </div>
              <div style={p.row}><span style={p.rowLabel}>Hold Period</span><span style={p.rowValue}>{proj.years} yrs @ {proj.appreciation.toFixed(2)}%/yr</span></div>
            </div>
          </div>

          <div style={p.section}>Replacement — Year 1</div>
          <table style={p.table}>
            <thead>
              <tr>
                <th style={{ ...p.th, ...p.thFirst }}></th>
                {scenarios.map((sc, i) => <th key={i} style={{ ...p.th, ...(i === recommendedIdx ? p.recTh : {}) }}>{i === recommendedIdx ? '★ ' : ''}{i + 1}. {sc.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {rowFns.map(([label, fn], ri) => (
                <tr key={label} style={ri % 2 === 0 ? p.trAlt : {}}>
                  <td style={{ ...p.td, ...p.tdFirst }}>{label}</td>
                  {calc.results.map((r, i) => <td key={i} style={{ ...p.td, ...(i === recommendedIdx ? p.recTd : {}) }}>{fn(r, scenarios[i])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>

          {showProjection && (
            <>
              <div style={p.section}>Wealth Projection ({proj.years} yrs)</div>
              <table style={p.table}>
                <thead>
                  <tr>
                    <th style={{ ...p.th, ...p.thFirst }}></th>
                    {scenarios.map((sc, i) => <th key={i} style={{ ...p.th, ...(i === recommendedIdx ? p.recTh : {}) }}>{i === recommendedIdx ? '★ ' : ''}{i + 1}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {projRows.map(([label, fn], ri) => (
                    <tr key={label} style={ri % 2 === 0 ? p.trAlt : {}}>
                      <td style={{ ...p.td, ...p.tdFirst }}>{label}</td>
                      {calc.results.map((r, i) => <td key={i} style={{ ...p.td, ...(i === recommendedIdx ? p.recTd : {}) }}>{fn(r, scenarios[i])}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {refi.enabled && refiData && (
            <>
              <div style={p.section}>{scenarios[refiIdx].name} — Cash-Out Refi (Yr 2+)</div>
              <div style={{ ...p.row }}><span style={p.rowLabel}>Refi Terms</span><span style={p.rowValue}>{refi.ltv}% LTV @ {refi.rate.toFixed(2)}%</span></div>
              <div style={{ ...p.row, ...p.rowAlt }}><span style={p.rowLabel}>Cash Extracted (tax-free)</span><span style={p.rowValue}>{fmt$(refiData.cashExtracted)}</span></div>
              <div style={p.row}><span style={p.rowLabel}>Net CF Post-Refi</span><span style={p.rowValue}>{fmt$(refiData.cfPostRefi)}</span></div>
              <div style={{ ...p.row, ...p.rowAlt }}><span style={p.rowLabel}>Remaining Equity</span><span style={p.rowValue}>{fmt$(refiData.remainingEquity)}</span></div>
              <div style={p.row}><span style={p.rowLabel}>CoC on Remaining Equity</span><span style={p.rowValue}>{fmtPct(refiData.cocPostRefi)}</span></div>
            </>
          )}

          <div style={p.footer}>Wealth projection assumes {proj.appreciation.toFixed(2)}% annual appreciation on value &amp; NOI, {proj.sellingCostsPct}% selling costs. Cash-out refi proceeds are tax-free loan proceeds, not income. For analysis purposes only. — Matthews REIS</div>
        </div>
      </div>
    </div>
  )
}
