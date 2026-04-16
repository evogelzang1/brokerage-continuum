import { useState, useMemo } from 'react'
import CurrencyInput from '../CurrencyInput'
import { exportToolPdf } from '../../lib/pdfExport'
import SimplePreview from './SimplePreview'
import s from '../shared.module.css'
import styles from './exchange.module.css'

const fmt$ = v => `$${Math.round(v).toLocaleString('en-US')}`
const fmtPct = v => `${v.toFixed(2)}%`

// Tenant credit tiers drive cap rate selection
const TENANT_TIERS = [
  { id: 'ig', label: 'Investment Grade (S&P BBB-+)', cap: 5.75, hint: 'Walgreens, Starbucks Corp, FedEx' },
  { id: 'corp', label: 'Strong National / Non-IG', cap: 6.50, hint: 'National chains, credit parent' },
  { id: 'franchise', label: 'Franchise / Regional', cap: 7.50, hint: 'Franchisee-operated, regional brand' },
  { id: 'local', label: 'Local / Unrated', cap: 8.50, hint: 'Mom-and-pop, private operator' },
  { id: 'vacant', label: 'Vacant / Speculative', cap: 9.50, hint: 'No signed tenant — priced to lease' },
]

export default function FlipModel() {
  const [useDebt, setUseDebt] = useState(false)
  const [tenantTier, setTenantTier] = useState('corp')
  const [f, setF] = useState({
    acquisitionPrice: 0, closingCostsPct: 2, rehabBudget: 0, contingencyPct: 10,
    holdPeriod: 12, monthlyHoldCosts: 0,
    buildingSf: 0, marketRent: 0, vacancyPct: 5, opexPct: 5, exitCapRate: 6.50,
    sellingCostsPct: 6,
    ltcPct: 80, intRate: 11, points: 2,
  })
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))

  // Apply a tenant tier — updates cap rate
  const applyTier = (tierId) => {
    setTenantTier(tierId)
    const tier = TENANT_TIERS.find(t => t.id === tierId)
    if (tier) set('exitCapRate', tier.cap)
  }

  const calc = useMemo(() => {
    // Income-based ARV calculation
    const grossRent = f.buildingSf * f.marketRent
    const vacancyLoss = grossRent * (f.vacancyPct / 100)
    const egi = grossRent - vacancyLoss
    const opex = egi * (f.opexPct / 100)
    const stabilizedNOI = egi - opex
    const arv = f.exitCapRate > 0 ? stabilizedNOI / (f.exitCapRate / 100) : 0
    const pricePerSf = f.buildingSf > 0 ? arv / f.buildingSf : 0

    // Costs
    const closingCosts = f.acquisitionPrice * (f.closingCostsPct / 100)
    const contingency = f.rehabBudget * (f.contingencyPct / 100)
    const rehabTotal = f.rehabBudget + contingency
    const totalHold = f.monthlyHoldCosts * f.holdPeriod
    const projectCost = f.acquisitionPrice + closingCosts + rehabTotal

    // Financing
    const loanAmount = useDebt ? projectCost * (f.ltcPct / 100) : 0
    const pointsCost = loanAmount * (f.points / 100)
    const monthlyInterest = loanAmount * (f.intRate / 100 / 12)
    const totalInterest = monthlyInterest * f.holdPeriod
    const financingCosts = pointsCost + totalInterest
    const cashIn = projectCost - loanAmount + totalHold + financingCosts

    // Profit
    const totalInvestment = projectCost + totalHold + financingCosts
    const sellingCostsDollar = arv * (f.sellingCostsPct / 100)
    const grossProfit = arv - f.acquisitionPrice
    const netProfit = arv - sellingCostsDollar - totalInvestment

    const roi = totalInvestment > 0 ? (netProfit / totalInvestment) * 100 : 0
    const cashOnCash = cashIn > 0 ? (netProfit / cashIn) * 100 : 0
    const annualizedRoi = f.holdPeriod > 0 ? (cashOnCash / f.holdPeriod) * 12 : 0
    const profitPerMonth = f.holdPeriod > 0 ? netProfit / f.holdPeriod : 0

    // Break-even sale price
    const breakEven = totalInvestment / (1 - f.sellingCostsPct / 100)
    const breakEvenCap = breakEven > 0 ? (stabilizedNOI / breakEven) * 100 : 0

    // 70% rule
    const maxOffer70 = Math.max(0, arv * 0.7 - rehabTotal)

    return {
      grossRent, vacancyLoss, egi, opex, stabilizedNOI, arv, pricePerSf,
      closingCosts, contingency, rehabTotal, totalHold, projectCost,
      loanAmount, pointsCost, totalInterest, financingCosts, cashIn,
      totalInvestment, sellingCostsDollar, grossProfit, netProfit,
      roi, cashOnCash, annualizedRoi, profitPerMonth, breakEven, breakEvenCap, maxOffer70,
    }
  }, [f, useDebt])

  const profitClass = calc.netProfit >= 0 ? s.positive : s.negative
  const offerClass = f.acquisitionPrice > 0 && calc.maxOffer70 > 0
    ? (f.acquisitionPrice <= calc.maxOffer70 ? s.positive : s.negative)
    : ''

  const activeTier = TENANT_TIERS.find(t => t.id === tenantTier)

  const inputs = [
    { label: 'Acquisition Price', value: fmt$(f.acquisitionPrice) },
    { label: 'Closing Costs', value: `${fmtPct(f.closingCostsPct)} (${fmt$(calc.closingCosts)})` },
    { label: 'Rehab Budget', value: fmt$(f.rehabBudget) },
    { label: 'Contingency', value: `${fmtPct(f.contingencyPct)} (${fmt$(calc.contingency)})` },
    { label: 'Hold Period', value: `${f.holdPeriod} months` },
    { label: 'Monthly Hold Costs', value: fmt$(f.monthlyHoldCosts) },
    { label: 'Building SF', value: f.buildingSf.toLocaleString() },
    { label: 'Market Rent', value: `$${f.marketRent}/SF/yr` },
    { label: 'Vacancy', value: fmtPct(f.vacancyPct) },
    { label: 'OpEx % of EGI', value: fmtPct(f.opexPct) },
    { label: 'Stabilized NOI', value: fmt$(calc.stabilizedNOI) },
    { label: 'Tenant Profile', value: activeTier ? activeTier.label : '—' },
    { label: 'Exit Cap Rate', value: fmtPct(f.exitCapRate) },
    { label: 'ARV (Income-Based)', value: fmt$(calc.arv) },
    { label: 'Selling Costs', value: fmtPct(f.sellingCostsPct) },
    { label: 'Financing', value: useDebt ? `Debt @ ${fmtPct(f.ltcPct)} LTC, ${fmtPct(f.intRate)} IO, ${fmtPct(f.points)} points` : 'All Cash' },
  ]

  const outputs = [
    { label: 'Gross Rent', value: fmt$(calc.grossRent) },
    { label: 'EGI (after vacancy)', value: fmt$(calc.egi) },
    { label: 'OpEx', value: fmt$(calc.opex) },
    { label: 'Stabilized NOI', value: fmt$(calc.stabilizedNOI) },
    { label: 'ARV (NOI / Cap)', value: fmt$(calc.arv), highlight: true },
    { label: 'Price / SF at ARV', value: `$${calc.pricePerSf.toFixed(2)}` },
    { label: 'Total Project Cost', value: fmt$(calc.projectCost) },
    { label: 'Total Hold Costs', value: fmt$(calc.totalHold) },
    ...(useDebt ? [
      { label: 'Loan Amount', value: fmt$(calc.loanAmount) },
      { label: 'Financing Costs', value: fmt$(calc.financingCosts) },
      { label: 'Cash Required', value: fmt$(calc.cashIn) },
    ] : []),
    { label: 'Total Investment', value: fmt$(calc.totalInvestment) },
    { label: 'Net Profit', value: fmt$(calc.netProfit), highlight: true },
    { label: 'ROI', value: fmtPct(calc.roi) },
    ...(useDebt ? [{ label: 'Cash-on-Cash', value: fmtPct(calc.cashOnCash) }] : []),
    { label: 'Annualized Return', value: fmtPct(calc.annualizedRoi) },
    { label: 'Break-even Sale Price', value: fmt$(calc.breakEven) },
    { label: 'Break-even Cap Rate', value: fmtPct(calc.breakEvenCap) },
    { label: '70% Rule Max Offer', value: fmt$(calc.maxOffer70) },
  ]

  const handleExport = () => exportToolPdf({
    title: 'Flip Model',
    subtitle: 'Buy / Rehab / Sell Analysis',
    inputs, outputs,
  })

  return (
    <div className={styles.splitLayout}>
      <div className={styles.inputPane}>
        <div className={s.sectionLabel}>Purchase & Rehab</div>
        <div className={s.inputGrid}>
          <CurrencyInput label="Acquisition Price" hint="What you're paying for the property." value={f.acquisitionPrice} onChange={v => set('acquisitionPrice', v)} />
          <CurrencyInput label="Closing Costs %" hint="Title, escrow, lender fees. Typically 1–3%." value={f.closingCostsPct} onChange={v => set('closingCostsPct', v)} prefix="" suffix="%" />
          <CurrencyInput label="Rehab Budget" hint="Hard construction costs — materials + labor + TI." value={f.rehabBudget} onChange={v => set('rehabBudget', v)} />
          <CurrencyInput label="Contingency %" hint="Rehab buffer for overruns. 10–15% standard." value={f.contingencyPct} onChange={v => set('contingencyPct', v)} prefix="" suffix="%" />
        </div>

        <div className={s.sectionLabel}>Hold Period</div>
        <div className={s.inputGrid}>
          <CurrencyInput label="Hold Period (Months)" hint="Close → rehab → lease-up → sale." value={f.holdPeriod} onChange={v => set('holdPeriod', v)} prefix="" />
          <CurrencyInput label="Monthly Hold Costs" hint="Taxes, insurance, utilities while renovating." value={f.monthlyHoldCosts} onChange={v => set('monthlyHoldCosts', v)} />
        </div>

        <div className={s.sectionLabel}>Post-Rehab Income (drives ARV)</div>
        <div className={s.inputGrid}>
          <CurrencyInput label="Building SF" hint="Rentable square footage post-renovation." value={f.buildingSf} onChange={v => set('buildingSf', v)} prefix="" />
          <CurrencyInput label="Market Rent ($/SF/yr)" hint="Achievable market rent post-rehab. NNN or gross — match OpEx input." value={f.marketRent} onChange={v => set('marketRent', v)} prefix="$" suffix="/sf" />
          <CurrencyInput label="Vacancy %" hint="Economic vacancy. 5% standard for stabilized." value={f.vacancyPct} onChange={v => set('vacancyPct', v)} prefix="" suffix="%" />
          <CurrencyInput label="OpEx % of EGI" hint="Use ~5% if true NNN (taxes/insurance billed back). 25–35% if gross." value={f.opexPct} onChange={v => set('opexPct', v)} prefix="" suffix="%" />
        </div>

        <div className={s.sectionLabel}>Projected Tenant (drives cap rate)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, marginBottom: 8 }}>
          {TENANT_TIERS.map(t => (
            <button
              key={t.id}
              className={`${styles.toggleBtn} ${tenantTier === t.id ? styles.toggleActive : ''}`}
              style={{ textAlign: 'left', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6, lineHeight: 1.4 }}
              onClick={() => applyTier(t.id)}
            >
              <div style={{ fontWeight: 600, fontSize: 12 }}>{t.label}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{t.hint} · {t.cap.toFixed(2)}% cap</div>
            </button>
          ))}
        </div>
        <div className={s.inputGrid}>
          <CurrencyInput label="Exit Cap Rate (%)" hint="Editable — override the tier default if needed." value={f.exitCapRate} onChange={v => set('exitCapRate', v)} prefix="" suffix="%" />
          <CurrencyInput label="Selling Costs (%)" hint="Commission + transfer tax + closing. 6–8% typical." value={f.sellingCostsPct} onChange={v => set('sellingCostsPct', v)} prefix="" suffix="%" />
        </div>

        <div className={s.outputCard}>
          <div className={s.outputTitle}>Stabilized Value (ARV)</div>
          <div className={s.outputRow}><span className={s.outputLabel}>Gross Rent ({f.buildingSf.toLocaleString()} SF × ${f.marketRent}/SF)</span><span className={s.outputValue}>{fmt$(calc.grossRent)}</span></div>
          <div className={s.outputRow}><span className={s.outputLabel}>Vacancy Loss ({fmtPct(f.vacancyPct)})</span><span className={s.outputValue}>-{fmt$(calc.vacancyLoss)}</span></div>
          <div className={s.outputRow}><span className={s.outputLabel}>Effective Gross Income</span><span className={s.outputValue}>{fmt$(calc.egi)}</span></div>
          <div className={s.outputRow}><span className={s.outputLabel}>OpEx ({fmtPct(f.opexPct)} of EGI)</span><span className={s.outputValue}>-{fmt$(calc.opex)}</span></div>
          <div className={s.outputRow}><span className={s.outputLabel}>Stabilized NOI</span><span className={`${s.outputValue} ${s.accent}`}>{fmt$(calc.stabilizedNOI)}</span></div>
          <div className={s.outputRow}><span className={s.outputLabel}>÷ Exit Cap Rate ({fmtPct(f.exitCapRate)})</span><span className={s.outputValue}></span></div>
          <div className={s.outputRow} style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
            <span className={s.outputLabel} style={{ fontWeight: 600, color: 'var(--text)' }}>ARV</span>
            <span className={`${s.outputValue} ${s.positive}`} style={{ fontSize: 18 }}>{fmt$(calc.arv)}</span>
          </div>
          <div className={s.outputRow}><span className={s.outputLabel}>Price / SF at ARV</span><span className={s.outputValue}>${calc.pricePerSf.toFixed(2)}</span></div>
        </div>

        <div className={s.sectionLabel} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          Financing
          <div className={styles.toggleRow}>
            <button className={`${styles.toggleBtn} ${!useDebt ? styles.toggleActive : ''}`} onClick={() => setUseDebt(false)}>All Cash</button>
            <button className={`${styles.toggleBtn} ${useDebt ? styles.toggleActive : ''}`} onClick={() => setUseDebt(true)}>Hard Money</button>
          </div>
        </div>
        {useDebt && (
          <div className={s.inputGrid}>
            <CurrencyInput label="LTC %" hint="Loan-to-Cost — % of total project financed." value={f.ltcPct} onChange={v => set('ltcPct', v)} prefix="" suffix="%" />
            <CurrencyInput label="Interest Rate (IO)" hint="Annual interest rate. Interest-only, no amort." value={f.intRate} onChange={v => set('intRate', v)} prefix="" suffix="%" />
            <CurrencyInput label="Points" hint="Upfront lender fee as % of loan. 1–3 typical." value={f.points} onChange={v => set('points', v)} prefix="" suffix="%" />
          </div>
        )}

        <div className={s.outputCard}>
          <div className={s.outputTitle}>Flip Summary</div>
          <div className={s.outputRow}><span className={s.outputLabel}>Total Project Cost</span><span className={s.outputValue}>{fmt$(calc.projectCost)}</span></div>
          <div className={s.outputRow}><span className={s.outputLabel}>Total Hold Costs</span><span className={s.outputValue}>{fmt$(calc.totalHold)}</span></div>
          {useDebt && <>
            <div className={s.outputRow}><span className={s.outputLabel}>Loan Amount</span><span className={s.outputValue}>{fmt$(calc.loanAmount)}</span></div>
            <div className={s.outputRow}><span className={s.outputLabel}>Financing Costs</span><span className={s.outputValue}>{fmt$(calc.financingCosts)}</span></div>
            <div className={s.outputRow}><span className={s.outputLabel}>Cash Required</span><span className={`${s.outputValue} ${s.accent}`}>{fmt$(calc.cashIn)}</span></div>
          </>}
          <div className={s.outputRow}><span className={s.outputLabel}>Total Investment</span><span className={s.outputValue}>{fmt$(calc.totalInvestment)}</span></div>
          <div className={s.outputRow}><span className={s.outputLabel}>Net Profit</span><span className={`${s.outputValue} ${profitClass}`}>{fmt$(calc.netProfit)}</span></div>
          <div className={s.outputRow}><span className={s.outputLabel}>ROI</span><span className={`${s.outputValue} ${profitClass}`}>{fmtPct(calc.roi)}</span></div>
          {useDebt && <div className={s.outputRow}><span className={s.outputLabel}>Cash-on-Cash</span><span className={`${s.outputValue} ${profitClass}`}>{fmtPct(calc.cashOnCash)}</span></div>}
          <div className={s.outputRow}><span className={s.outputLabel}>Annualized Return</span><span className={`${s.outputValue} ${profitClass}`}>{fmtPct(calc.annualizedRoi)}</span></div>
          <div className={s.outputRow}><span className={s.outputLabel}>Break-even Sale Price</span><span className={s.outputValue}>{fmt$(calc.breakEven)}</span></div>
          <div className={s.outputRow}><span className={s.outputLabel}>Break-even Cap Rate</span><span className={s.outputValue}>{fmtPct(calc.breakEvenCap)}</span></div>
          <div className={s.outputRow}>
            <span className={s.outputLabel}>70% Rule Max Offer</span>
            <span className={`${s.outputValue} ${offerClass}`}>{fmt$(calc.maxOffer70)}</span>
          </div>
        </div>
      </div>

      <SimplePreview
        title="Flip Model"
        subtitle="Buy / Rehab / Sell Analysis"
        inputs={inputs}
        outputs={outputs}
        onExport={handleExport}
      />
    </div>
  )
}
