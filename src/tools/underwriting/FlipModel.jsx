import { useState, useMemo } from 'react'
import CurrencyInput from '../CurrencyInput'
import { exportToolPdf } from '../../lib/pdfExport'
import s from '../shared.module.css'

const fmt$ = v => `$${v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
const fmtPct = v => `${v.toFixed(2)}%`

export default function FlipModel() {
  const [f, setF] = useState({
    acquisitionPrice: 0, closingCosts: 0, rehabBudget: 0,
    holdPeriod: 12, monthlyHoldCosts: 0,
    projectedSalePrice: 0, sellingCostsPct: 6,
  })
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))

  const calc = useMemo(() => {
    const totalHold = f.monthlyHoldCosts * f.holdPeriod
    const totalInvestment = f.acquisitionPrice + f.closingCosts + f.rehabBudget + totalHold
    const sellingCostsDollar = f.projectedSalePrice * (f.sellingCostsPct / 100)
    const grossProfit = f.projectedSalePrice - f.acquisitionPrice
    const netProfit = f.projectedSalePrice - sellingCostsDollar - totalInvestment
    const roi = totalInvestment > 0 ? (netProfit / totalInvestment) * 100 : 0
    const annualizedRoi = f.holdPeriod > 0 ? (roi / f.holdPeriod) * 12 : 0
    const profitPerMonth = f.holdPeriod > 0 ? netProfit / f.holdPeriod : 0
    return { totalHold, totalInvestment, sellingCostsDollar, grossProfit, netProfit, roi, annualizedRoi, profitPerMonth }
  }, [f])

  const profitClass = calc.netProfit >= 0 ? s.positive : s.negative

  const handleExport = () => {
    exportToolPdf({
      title: 'Flip Model',
      subtitle: 'Buy / Rehab / Sell Analysis',
      inputs: [
        { label: 'Acquisition Price', value: fmt$(f.acquisitionPrice) },
        { label: 'Closing Costs (Buy)', value: fmt$(f.closingCosts) },
        { label: 'Rehab / CapEx Budget', value: fmt$(f.rehabBudget) },
        { label: 'Hold Period', value: `${f.holdPeriod} months` },
        { label: 'Monthly Hold Costs', value: fmt$(f.monthlyHoldCosts) },
        { label: 'Projected Sale Price', value: fmt$(f.projectedSalePrice) },
        { label: 'Selling Costs', value: `${f.sellingCostsPct}%` },
      ],
      outputs: [
        { label: 'Total Investment', value: fmt$(calc.totalInvestment) },
        { label: 'Gross Profit', value: fmt$(calc.grossProfit) },
        { label: 'Selling Costs ($)', value: fmt$(calc.sellingCostsDollar) },
        { label: 'Net Profit', value: fmt$(calc.netProfit) },
        { label: 'ROI', value: fmtPct(calc.roi) },
        { label: 'Annualized ROI', value: fmtPct(calc.annualizedRoi) },
        { label: 'Profit / Month', value: fmt$(calc.profitPerMonth) },
      ],
    })
  }

  return (
    <>
      <div className={s.inputGrid}>
        <CurrencyInput label="Acquisition Price" value={f.acquisitionPrice} onChange={v => set('acquisitionPrice', v)} />
        <CurrencyInput label="Closing Costs (Buy)" value={f.closingCosts} onChange={v => set('closingCosts', v)} />
        <CurrencyInput label="Rehab / CapEx Budget" value={f.rehabBudget} onChange={v => set('rehabBudget', v)} />
        <CurrencyInput label="Hold Period (Months)" value={f.holdPeriod} onChange={v => set('holdPeriod', v)} prefix="" />
        <CurrencyInput label="Monthly Hold Costs" value={f.monthlyHoldCosts} onChange={v => set('monthlyHoldCosts', v)} />
        <CurrencyInput label="Projected Sale Price" value={f.projectedSalePrice} onChange={v => set('projectedSalePrice', v)} />
        <CurrencyInput label="Selling Costs (%)" value={f.sellingCostsPct} onChange={v => set('sellingCostsPct', v)} prefix="" suffix="%" />
      </div>
      <div className={s.outputCard}>
        <div className={s.outputTitle}>Flip Summary</div>
        <div className={s.outputRow}><span className={s.outputLabel}>Total Investment</span><span className={s.outputValue}>{fmt$(calc.totalInvestment)}</span></div>
        <div className={s.outputRow}><span className={s.outputLabel}>Gross Profit</span><span className={s.outputValue}>{fmt$(calc.grossProfit)}</span></div>
        <div className={s.outputRow}><span className={s.outputLabel}>Net Profit</span><span className={`${s.outputValue} ${profitClass}`}>{fmt$(calc.netProfit)}</span></div>
        <div className={s.outputRow}><span className={s.outputLabel}>ROI</span><span className={`${s.outputValue} ${profitClass}`}>{fmtPct(calc.roi)}</span></div>
        <div className={s.outputRow}><span className={s.outputLabel}>Annualized ROI</span><span className={`${s.outputValue} ${profitClass}`}>{fmtPct(calc.annualizedRoi)}</span></div>
        <div className={s.outputRow}><span className={s.outputLabel}>Profit / Month</span><span className={`${s.outputValue} ${profitClass}`}>{fmt$(calc.profitPerMonth)}</span></div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
        <button className={s.btnPrimary} onClick={handleExport}>Export PDF</button>
      </div>
    </>
  )
}
