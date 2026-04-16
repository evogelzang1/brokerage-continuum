import { useState, useMemo } from 'react'
import CurrencyInput from '../CurrencyInput'
import { exportToolPdf } from '../../lib/pdfExport'
import s from '../shared.module.css'

const fmt$ = v => `$${v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
const fmtPct = v => `${v.toFixed(2)}%`
const fmtBps = v => `${Math.round(v)} bps`

export default function ReturnOnCost() {
  const [f, setF] = useState({
    acquisitionPrice: 0, closingCosts: 0, rehabCapex: 0,
    inPlaceNOI: 0, stabilizedNOI: 0, marketCapRate: 5,
  })
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))

  const calc = useMemo(() => {
    const totalCost = f.acquisitionPrice + f.closingCosts + f.rehabCapex
    const inPlaceYield = totalCost > 0 ? (f.inPlaceNOI / totalCost) * 100 : 0
    const returnOnCost = totalCost > 0 ? (f.stabilizedNOI / totalCost) * 100 : 0
    const impliedValue = f.marketCapRate > 0 ? f.stabilizedNOI / (f.marketCapRate / 100) : 0
    const profitOnCost = impliedValue - totalCost
    const yieldSpread = returnOnCost - f.marketCapRate
    const yieldSpreadBps = yieldSpread * 100
    return { totalCost, inPlaceYield, returnOnCost, impliedValue, profitOnCost, yieldSpread, yieldSpreadBps }
  }, [f])

  const spreadClass = calc.yieldSpread >= 0 ? s.positive : s.negative

  const handleExport = () => {
    exportToolPdf({
      title: 'Return on Cost',
      subtitle: 'Value-Add / Development Yield Analysis',
      inputs: [
        { label: 'Acquisition Price', value: fmt$(f.acquisitionPrice) },
        { label: 'Closing Costs', value: fmt$(f.closingCosts) },
        { label: 'Rehab / CapEx', value: fmt$(f.rehabCapex) },
        { label: 'Total Project Cost', value: fmt$(calc.totalCost) },
        { label: 'In-Place NOI', value: fmt$(f.inPlaceNOI) },
        { label: 'Stabilized NOI', value: fmt$(f.stabilizedNOI) },
        { label: 'Market Cap Rate', value: `${f.marketCapRate}%` },
      ],
      outputs: [
        { label: 'In-Place Yield', value: fmtPct(calc.inPlaceYield) },
        { label: 'Return on Cost', value: fmtPct(calc.returnOnCost) },
        { label: 'Implied Value at Market Cap', value: fmt$(calc.impliedValue) },
        { label: 'Profit on Cost', value: fmt$(calc.profitOnCost) },
        { label: 'Yield Spread vs Market', value: `${fmtPct(calc.yieldSpread)} (${fmtBps(calc.yieldSpreadBps)})` },
      ],
    })
  }

  return (
    <>
      <div className={s.inputGrid}>
        <CurrencyInput label="Acquisition Price" value={f.acquisitionPrice} onChange={v => set('acquisitionPrice', v)} />
        <CurrencyInput label="Closing Costs" value={f.closingCosts} onChange={v => set('closingCosts', v)} />
        <CurrencyInput label="Rehab / CapEx" value={f.rehabCapex} onChange={v => set('rehabCapex', v)} />
        <CurrencyInput label="Total Project Cost" value={calc.totalCost} onChange={() => {}} disabled />
        <CurrencyInput label="In-Place NOI" value={f.inPlaceNOI} onChange={v => set('inPlaceNOI', v)} />
        <CurrencyInput label="Stabilized NOI" value={f.stabilizedNOI} onChange={v => set('stabilizedNOI', v)} />
        <CurrencyInput label="Market Cap Rate (%)" value={f.marketCapRate} onChange={v => set('marketCapRate', v)} prefix="" suffix="%" />
      </div>
      <div className={s.outputCard}>
        <div className={s.outputTitle}>Yield Analysis</div>
        <div className={s.outputRow}><span className={s.outputLabel}>In-Place Yield</span><span className={s.outputValue}>{fmtPct(calc.inPlaceYield)}</span></div>
        <div className={s.outputRow}><span className={s.outputLabel}>Return on Cost</span><span className={`${s.outputValue} ${s.accent}`}>{fmtPct(calc.returnOnCost)}</span></div>
        <div className={s.outputRow}><span className={s.outputLabel}>Implied Value</span><span className={s.outputValue}>{fmt$(calc.impliedValue)}</span></div>
        <div className={s.outputRow}><span className={s.outputLabel}>Profit on Cost</span><span className={`${s.outputValue} ${calc.profitOnCost >= 0 ? s.positive : s.negative}`}>{fmt$(calc.profitOnCost)}</span></div>
        <div className={s.outputRow}><span className={s.outputLabel}>Yield Spread</span><span className={`${s.outputValue} ${spreadClass}`}>{fmtPct(calc.yieldSpread)} ({fmtBps(calc.yieldSpreadBps)})</span></div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
        <button className={s.btnPrimary} onClick={handleExport}>Export PDF</button>
      </div>
    </>
  )
}
