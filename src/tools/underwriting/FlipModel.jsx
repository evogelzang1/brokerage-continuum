import { useState, useMemo } from 'react'
import CurrencyInput from '../CurrencyInput'
import { exportToolPdf } from '../../lib/pdfExport'
import SimplePreview from './SimplePreview'
import s from '../shared.module.css'
import styles from './exchange.module.css'

const fmt$ = v => `$${Math.round(v).toLocaleString('en-US')}`
const fmtPct = v => `${v.toFixed(2)}%`

export default function FlipModel() {
  const [useDebt, setUseDebt] = useState(false)
  const [f, setF] = useState({
    acquisitionPrice: 0, closingCostsPct: 2, rehabBudget: 0, contingencyPct: 10,
    holdPeriod: 12, monthlyHoldCosts: 0,
    arv: 0, sellingCostsPct: 6,
    ltcPct: 80, intRate: 11, points: 2,
  })
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))

  const calc = useMemo(() => {
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

    const totalInvestment = projectCost + totalHold + financingCosts
    const sellingCostsDollar = f.arv * (f.sellingCostsPct / 100)
    const netSaleProceeds = f.arv - sellingCostsDollar - loanAmount
    const grossProfit = f.arv - f.acquisitionPrice
    const netProfit = f.arv - sellingCostsDollar - totalInvestment

    const roi = totalInvestment > 0 ? (netProfit / totalInvestment) * 100 : 0
    const cashOnCash = cashIn > 0 ? (netProfit / cashIn) * 100 : 0
    const annualizedRoi = f.holdPeriod > 0 ? (cashOnCash / f.holdPeriod) * 12 : 0
    const profitPerMonth = f.holdPeriod > 0 ? netProfit / f.holdPeriod : 0

    // Break-even sale price (makes netProfit = 0)
    const breakEven = totalInvestment / (1 - f.sellingCostsPct / 100)

    // 70% rule: max offer = 70% ARV − rehab
    const maxOffer70 = Math.max(0, f.arv * 0.7 - rehabTotal)

    return {
      closingCosts, contingency, rehabTotal, totalHold, projectCost,
      loanAmount, pointsCost, totalInterest, financingCosts, cashIn,
      totalInvestment, sellingCostsDollar, netSaleProceeds, grossProfit, netProfit,
      roi, cashOnCash, annualizedRoi, profitPerMonth, breakEven, maxOffer70,
    }
  }, [f, useDebt])

  const profitClass = calc.netProfit >= 0 ? s.positive : s.negative
  const offerVsOffer = f.acquisitionPrice > 0 && calc.maxOffer70 > 0
    ? (f.acquisitionPrice <= calc.maxOffer70 ? s.positive : s.negative)
    : ''

  const inputs = [
    { label: 'Acquisition Price', value: fmt$(f.acquisitionPrice) },
    { label: 'Closing Costs', value: `${fmtPct(f.closingCostsPct)} (${fmt$(calc.closingCosts)})` },
    { label: 'Rehab Budget', value: fmt$(f.rehabBudget) },
    { label: 'Contingency', value: `${fmtPct(f.contingencyPct)} (${fmt$(calc.contingency)})` },
    { label: 'Hold Period', value: `${f.holdPeriod} months` },
    { label: 'Monthly Hold Costs', value: fmt$(f.monthlyHoldCosts) },
    { label: 'ARV (After Repair Value)', value: fmt$(f.arv) },
    { label: 'Selling Costs', value: fmtPct(f.sellingCostsPct) },
    { label: 'Financing', value: useDebt ? `Debt @ ${fmtPct(f.ltcPct)} LTC, ${fmtPct(f.intRate)} IO, ${fmtPct(f.points)} points` : 'All Cash' },
  ]

  const outputs = [
    { label: 'Total Project Cost', value: fmt$(calc.projectCost) },
    { label: 'Total Hold Costs', value: fmt$(calc.totalHold) },
    ...(useDebt ? [
      { label: 'Loan Amount', value: fmt$(calc.loanAmount) },
      { label: 'Points Cost', value: fmt$(calc.pointsCost) },
      { label: 'Total Interest (IO)', value: fmt$(calc.totalInterest) },
      { label: 'Cash Required', value: fmt$(calc.cashIn) },
    ] : []),
    { label: 'Total Investment', value: fmt$(calc.totalInvestment) },
    { label: 'Gross Profit', value: fmt$(calc.grossProfit) },
    { label: 'Selling Costs ($)', value: fmt$(calc.sellingCostsDollar) },
    { label: 'Net Profit', value: fmt$(calc.netProfit), highlight: true },
    { label: 'ROI (Total Investment)', value: fmtPct(calc.roi) },
    ...(useDebt ? [{ label: 'Cash-on-Cash', value: fmtPct(calc.cashOnCash) }] : []),
    { label: 'Annualized Return', value: fmtPct(calc.annualizedRoi) },
    { label: 'Break-even Sale Price', value: fmt$(calc.breakEven) },
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
          <CurrencyInput label="Acquisition Price" value={f.acquisitionPrice} onChange={v => set('acquisitionPrice', v)} />
          <CurrencyInput label="Closing Costs %" value={f.closingCostsPct} onChange={v => set('closingCostsPct', v)} prefix="" suffix="%" />
          <CurrencyInput label="Rehab Budget" value={f.rehabBudget} onChange={v => set('rehabBudget', v)} />
          <CurrencyInput label="Contingency %" value={f.contingencyPct} onChange={v => set('contingencyPct', v)} prefix="" suffix="%" />
        </div>

        <div className={s.sectionLabel}>Hold & Exit</div>
        <div className={s.inputGrid}>
          <CurrencyInput label="Hold Period (Months)" value={f.holdPeriod} onChange={v => set('holdPeriod', v)} prefix="" />
          <CurrencyInput label="Monthly Hold Costs" value={f.monthlyHoldCosts} onChange={v => set('monthlyHoldCosts', v)} />
          <CurrencyInput label="ARV (After Repair Value)" value={f.arv} onChange={v => set('arv', v)} />
          <CurrencyInput label="Selling Costs (%)" value={f.sellingCostsPct} onChange={v => set('sellingCostsPct', v)} prefix="" suffix="%" />
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
            <CurrencyInput label="LTC %" value={f.ltcPct} onChange={v => set('ltcPct', v)} prefix="" suffix="%" />
            <CurrencyInput label="Interest Rate (IO)" value={f.intRate} onChange={v => set('intRate', v)} prefix="" suffix="%" />
            <CurrencyInput label="Points" value={f.points} onChange={v => set('points', v)} prefix="" suffix="%" />
          </div>
        )}

        <div className={s.outputCard}>
          <div className={s.outputTitle}>Flip Summary</div>
          <div className={s.outputRow}><span className={s.outputLabel}>Total Project Cost</span><span className={s.outputValue}>{fmt$(calc.projectCost)}</span></div>
          <div className={s.outputRow}><span className={s.outputLabel}>Total Hold Costs</span><span className={s.outputValue}>{fmt$(calc.totalHold)}</span></div>
          {useDebt && <>
            <div className={s.outputRow}><span className={s.outputLabel}>Loan Amount</span><span className={s.outputValue}>{fmt$(calc.loanAmount)}</span></div>
            <div className={s.outputRow}><span className={s.outputLabel}>Financing Costs (pts + int)</span><span className={s.outputValue}>{fmt$(calc.financingCosts)}</span></div>
            <div className={s.outputRow}><span className={s.outputLabel}>Cash Required</span><span className={`${s.outputValue} ${s.accent}`}>{fmt$(calc.cashIn)}</span></div>
          </>}
          <div className={s.outputRow}><span className={s.outputLabel}>Total Investment</span><span className={s.outputValue}>{fmt$(calc.totalInvestment)}</span></div>
          <div className={s.outputRow}><span className={s.outputLabel}>Net Profit</span><span className={`${s.outputValue} ${profitClass}`}>{fmt$(calc.netProfit)}</span></div>
          <div className={s.outputRow}><span className={s.outputLabel}>ROI</span><span className={`${s.outputValue} ${profitClass}`}>{fmtPct(calc.roi)}</span></div>
          {useDebt && <div className={s.outputRow}><span className={s.outputLabel}>Cash-on-Cash</span><span className={`${s.outputValue} ${profitClass}`}>{fmtPct(calc.cashOnCash)}</span></div>}
          <div className={s.outputRow}><span className={s.outputLabel}>Annualized Return</span><span className={`${s.outputValue} ${profitClass}`}>{fmtPct(calc.annualizedRoi)}</span></div>
          <div className={s.outputRow}><span className={s.outputLabel}>Break-even Sale Price</span><span className={s.outputValue}>{fmt$(calc.breakEven)}</span></div>
          <div className={s.outputRow}>
            <span className={s.outputLabel}>70% Rule Max Offer</span>
            <span className={`${s.outputValue} ${offerVsOffer}`}>{fmt$(calc.maxOffer70)}</span>
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
