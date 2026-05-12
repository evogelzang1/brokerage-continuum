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
  const [previewOpen, setPreviewOpen] = useState(true)
  const [sub, setSub] = useState({
    exitCap: 4.95, noi: 87120,
    titleEscrow: 10000, commissionPct: 4,
    estimatedTaxLiability: 0,
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
    // Tax deferral — optional CPA estimate. Single-asset basis derivation
    // is plausible but still subject to state tax, NIIT thresholds, prior
    // 1031 carryover, and depreciation-method variation — defer to CPA.
    const totalTaxBill = Math.max(0, sub.estimatedTaxLiability)

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
      // 1031-safe check: replacement price must be ≥ relinquished sale price.
      // Any shortfall is mortgage/equity boot that becomes taxable.
      const boot = Math.max(0, salePrice - price)

      if (!replDebt) {
        return {
          capRate, price, boot, downPayment: equity1031, additionalCash: price - equity1031,
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
        capRate, price, boot, loanAmt, ltv, annDS, princRedux, dscr, debtYield,
        netCash, cashReturn, totalReturn, equity: equity1031, cfDelta, ...r,
      }
    })

    return {
      salePrice, equity1031, brokerComm,
      totalTaxBill,
      sAnnDebt, sMonthDebt, sEquity, sCF, sROE,
      id45, close180, options,
    }
  }, [sub, repls, replDebt])

  const handleExport = () => {
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    const subRows = [
      ['Current NOI', fmt$(sub.noi)], ['Exit Cap Rate', fmtPct(sub.exitCap / 100)],
      ['Sale Price', fmt$(calc.salePrice)],
      ['Current Loan Balance', fmt$(sub.currLoanBal)],
      ['Annual Debt Service', fmt$(calc.sAnnDebt)], ['Cash Flow After Debt', fmt$(calc.sCF)],
      ['Return on Equity', fmtPct(calc.sROE)],
      ['Closing Costs', fmt$(calc.brokerComm + sub.titleEscrow)],
    ]
    const bootRow = ['Mortgage Boot (taxable)', o => o.boot > 0 ? fmt$(o.boot) : '—']
    const replMetrics = replDebt
      ? [['NOI', o => fmt$(o.noi)], ['Purchase Price', o => fmt$(o.price)], ['Cap Rate', o => fmtPct(o.capRate)],
         bootRow,
         ['Debt Required', o => fmt$(o.loanAmt)], ['LTV', o => fmtPct(o.ltv)], ['Debt Service (Ann)', o => fmt$(o.annDS)],
         ['DSCR', o => o.dscr.toFixed(2) + 'x'], ['Net Cash (Annual)', o => fmt$(o.netCash)],
         ['Cash Return', o => fmtPct(o.cashReturn)], ['Total Return', o => fmtPct(o.totalReturn)],
         ['CF vs Subject', o => `${o.cfDelta >= 0 ? '+' : ''}${fmt$(o.cfDelta)}/yr`]]
      : [['NOI', o => fmt$(o.noi)], ['Purchase Price', o => fmt$(o.price)], ['Cap Rate', o => fmtPct(o.capRate)],
         bootRow,
         ['1031 Equity', () => fmt$(calc.equity1031)], ['Additional Cash', o => fmt$(o.additionalCash)],
         ['Cash-on-Cash', o => fmtPct(o.cashOnCash)], ['CF vs Subject', o => `${o.cfDelta >= 0 ? '+' : ''}${fmt$(o.cfDelta)}/yr`],
         ['Lease Type', o => o.leaseType], ['Lease Years', o => String(o.leaseYears)]]

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title> </title>
<style>
@page{size:letter;margin:0}
*{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
html,body{margin:0;padding:0}
body{font-family:'Inter',-apple-system,sans-serif;color:#1a1a1a;line-height:1.2;font-size:8px;padding:.25in}
.wrap{max-width:100%;margin:0 auto}
.banner{background:#101828;color:#fff;padding:5px 10px;display:flex;justify-content:space-between;align-items:center;border-radius:3px;margin-bottom:3px}
.banner h1{font-size:11px;margin:0;font-weight:700}
.banner span{font-size:7px;opacity:.7}
.meta{font-size:8px;color:#6e7378;margin-bottom:4px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.section{font-size:7.5px;font-weight:700;color:#0969da;text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid #d0d7de;padding:2px 0 1px;margin:4px 0 2px}
.row{display:flex;justify-content:space-between;padding:1px 3px;font-size:8px;line-height:1.2}
.row span:first-child{color:#6e7378}.row span:last-child{font-weight:600}
.alt{background:#f5f7fa}
.hl{border-top:1px solid #d0d7de;margin-top:2px;padding-top:2px}
.hl span:last-child{color:#22783c;font-weight:700}
.deadlines{display:flex;gap:6px;margin:4px 0}
.deadlines>div{flex:1;background:#fffbe6;border:1px solid #f0cc4a;border-radius:3px;padding:2px 4px;text-align:center}
.deadlines span:first-child{color:#6e7378;font-weight:600;display:block;font-size:7px}
.deadlines span:last-child{color:#9a6700;font-weight:700;font-size:8.5px}
table{width:100%;border-collapse:collapse;font-size:8px;margin-top:2px}
th{text-align:right;padding:1.5px 4px;font-weight:700;border-bottom:1px solid #d0d7de;background:#f5f7fa}
th:first-child{text-align:left}
td{text-align:right;padding:1.5px 4px;font-size:8px}
td:first-child{text-align:left;color:#6e7378;font-weight:500}
tr.alt{background:#fafbfc}
.footer{margin-top:4px;font-size:6.5px;color:#999;border-top:1px solid #d0d7de;padding-top:2px;text-align:center}
</style></head><body><div class="wrap">
<div class="banner"><h1>1031 EXCHANGE ANALYSIS</h1><span>Matthews Real Estate Investment Services</span></div>
<div class="meta">Prepared for: ${clientName} &mdash; ${dateStr}</div>
<div class="grid">
<div>
<div class="section">Relinquished Property</div>
${subRows.map(([l,v],i)=>`<div class="row ${i%2?'alt':''}"><span>${l}</span><span>${v}</span></div>`).join('')}
<div class="row hl"><span>Total Equity for 1031</span><span>${fmt$(calc.equity1031)}</span></div>
</div>
<div>
<div class="section">1031 Exchange Mechanics</div>
${calc.totalTaxBill > 0
  ? `<div class="row hl"><span>Tax Deferred via 1031 (CPA estimate)</span><span>${fmt$(calc.totalTaxBill)}</span></div>`
  : `<div class="row"><span>Estimated Tax Deferred</span><span>Per seller's CPA</span></div>`}
<div class="deadlines"><div><span>45-Day ID</span><span>${fmtDate(calc.id45)}</span></div><div><span>180-Day Close</span><span>${fmtDate(calc.close180)}</span></div></div>
</div>
</div>
<div class="section">Replacement Properties ${replDebt ? '(With Debt)' : '(All Cash)'}</div>
<table><thead><tr><th></th>${repls.map((r,i)=>`<th>${r.name||'Option '+(i+1)}</th>`).join('')}</tr></thead>
<tbody>${replMetrics.map(([l,fn],ri)=>`<tr class="${ri%2===0?'alt':''}"><td>${l}</td>${calc.options.map(o=>`<td>${fn(o)}</td>`).join('')}</tr>`).join('')}</tbody></table>
<div class="footer">For analysis purposes only. Consult a qualified tax/legal professional. &mdash; Matthews REIS</div>
</div></body></html>`

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
          <CurrencyInput label="Title / Escrow" hint="Closing costs on sale (title, escrow, transfer tax)." value={sub.titleEscrow} onChange={v => set('titleEscrow', v)} />
          <CurrencyInput label="Commission %" hint="Total brokerage commission on the sale." value={sub.commissionPct} onChange={v => set('commissionPct', v)} prefix="" suffix="%" />
        </div>

        <div className={s.sectionLabel}>1031 Tax Deferral (Optional)</div>
        <div className={s.inputGrid}>
          <CurrencyInput label="Est. Tax Liability if Sold (per CPA)" hint="Optional. Paste the seller's CPA estimate of federal + state tax owed on an outright sale. Displayed as 'Tax Deferred via 1031.' Leave blank to omit — depreciation method, state tax, NIIT, and prior 1031 carryover make this hard to derive accurately here." value={sub.estimatedTaxLiability} onChange={v => set('estimatedTaxLiability', v)} />
          <div />
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
                {opt.boot > 0 && (
                  <div className={`${styles.replRow} ${s.warning}`}><span>Mortgage Boot (taxable)</span><span>{fmt$(opt.boot)}</span></div>
                )}
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

      {previewOpen ? (
        <Preview1031
          clientName={clientName}
          previewDate={previewDate}
          sub={sub}
          calc={calc}
          repls={repls}
          replDebt={replDebt}
          replMetricsPreview={replMetricsPreview}
          fmt$={fmt$}
          fmtPct={fmtPct}
          fmtDate={fmtDate}
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

// Print-matching preview for 1031 Exchange — inline styles mirror the exported HTML
function Preview1031({ clientName, previewDate, sub, calc, repls, replDebt, replMetricsPreview, fmt$, fmtPct, fmtDate, onExport, onClose }) {
  const p = {
    outer: { width: 460, flexShrink: 0, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', position: 'sticky', top: 0, background: '#fff' },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid var(--border)', background: 'var(--bg-hover)' },
    headerTitle: { fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' },
    body: { maxHeight: 700, overflowY: 'auto' },
    wrap: { padding: '10px 14px', fontFamily: "'Inter', -apple-system, sans-serif", color: '#1a1a1a', fontSize: 9, lineHeight: 1.3, background: '#fff' },
    banner: { background: '#101828', color: '#fff', padding: '6px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: 3, marginBottom: 4 },
    bannerTitle: { fontSize: 12, margin: 0, fontWeight: 700 },
    bannerSub: { fontSize: 7.5, opacity: 0.7 },
    meta: { fontSize: 8.5, color: '#6e7378', marginBottom: 6 },
    grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
    section: { fontSize: 8, fontWeight: 700, color: '#0969da', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #d0d7de', padding: '3px 0 1px', margin: '4px 0 2px' },
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
    ['Current NOI', fmt$(sub.noi)],
    ['Exit Cap Rate', fmtPct(sub.exitCap / 100)],
    ['Sale Price', fmt$(calc.salePrice)],
    ['Current Loan Balance', fmt$(sub.currLoanBal)],
    ['Annual Debt Service', fmt$(calc.sAnnDebt)],
    ['Cash Flow After Debt', fmt$(calc.sCF)],
    ['Return on Equity', fmtPct(calc.sROE)],
    ['Closing Costs', fmt$(calc.brokerComm + sub.titleEscrow)],
  ]

  return (
    <div style={p.outer}>
      <div style={p.header}>
        <span style={p.headerTitle}>PDF Preview</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={onExport} style={{ fontSize: 12, fontWeight: 600, fontFamily: 'inherit', color: '#fff', background: 'var(--accent)', border: 'none', padding: '7px 16px', borderRadius: 6, cursor: 'pointer' }}>Export PDF</button>
          {onClose && (
            <button onClick={onClose} title="Hide preview" style={{ fontSize: 14, fontWeight: 700, fontFamily: 'inherit', color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--border)', width: 28, height: 28, borderRadius: 6, cursor: 'pointer', lineHeight: 1 }}>×</button>
          )}
        </div>
      </div>
      <div style={p.body}>
        <div style={p.wrap}>
          <div style={p.banner}>
            <h1 style={p.bannerTitle}>1031 EXCHANGE ANALYSIS</h1>
            <span style={p.bannerSub}>Matthews Real Estate Investment Services</span>
          </div>
          <div style={p.meta}>Prepared for: {clientName} — {previewDate}</div>

          <div style={p.grid}>
            <div>
              <div style={p.section}>Relinquished Property</div>
              {subRows.map(([l, v], i) => (
                <div key={l} style={{ ...p.row, ...(i % 2 ? p.rowAlt : {}) }}>
                  <span style={p.rowLabel}>{l}</span>
                  <span style={p.rowValue}>{v}</span>
                </div>
              ))}
              <div style={{ ...p.row, ...p.hl }}>
                <span style={p.rowLabel}>Total Equity for 1031</span>
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

          <div style={p.section}>Replacement Properties {replDebt ? '(With Debt)' : '(All Cash)'}</div>
          <table style={p.table}>
            <thead>
              <tr>
                <th style={{ ...p.th, ...p.thFirst }}></th>
                {repls.map((r, i) => <th key={i} style={p.th}>{r.name || `Option ${i + 1}`}</th>)}
              </tr>
            </thead>
            <tbody>
              {replMetricsPreview.map(([label, fn], ri) => (
                <tr key={label} style={ri % 2 === 0 ? p.trAlt : {}}>
                  <td style={{ ...p.td, ...p.tdFirst }}>{label}</td>
                  {calc.options.map((o, i) => <td key={i} style={p.td}>{fn(o)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>

          <div style={p.footer}>For analysis purposes only. Consult a qualified tax/legal professional. — Matthews REIS</div>
        </div>
      </div>
    </div>
  )
}
