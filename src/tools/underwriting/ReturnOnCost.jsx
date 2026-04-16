import { useState, useMemo } from 'react'
import CurrencyInput from '../CurrencyInput'
import { exportToolPdf } from '../../lib/pdfExport'
import SimplePreview from './SimplePreview'
import s from '../shared.module.css'
import styles from './exchange.module.css'

const fmt$ = v => `$${Math.round(v).toLocaleString('en-US')}`
const fmtPct = v => `${v.toFixed(2)}%`
const fmtBps = v => `${Math.round(v)} bps`

function PMT(rate, nper, pv) {
  if (rate === 0) return -pv / nper
  const x = Math.pow(1 + rate, nper)
  return -(pv * rate * x) / (x - 1)
}

export default function ReturnOnCost() {
  const [useDebt, setUseDebt] = useState(false)
  const [f, setF] = useState({
    acquisitionPrice: 0, closingCostsPct: 2, rehabCapex: 0,
    constructionMonths: 12, rentLossPct: 100,
    inPlaceNOI: 0, stabilizedNOI: 0, marketCapRate: 5, exitCapRate: 5,
    loanLTC: 65, constLoanRate: 7.5,
    refiLTV: 70, refiRate: 6.5, refiAmort: 30,
  })
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))

  const calc = useMemo(() => {
    const closingCosts = f.acquisitionPrice * (f.closingCostsPct / 100)
    const projectCost = f.acquisitionPrice + closingCosts + f.rehabCapex

    // Lost NOI during construction period (monthly in-place NOI × months × rentLoss%)
    const monthlyInPlace = f.inPlaceNOI / 12
    const rentLossDuringConst = monthlyInPlace * f.constructionMonths * (f.rentLossPct / 100)

    // Construction loan (interest-only during construction period)
    const loanAmount = useDebt ? projectCost * (f.loanLTC / 100) : 0
    const monthlyConstInt = loanAmount * (f.constLoanRate / 100 / 12)
    const totalConstInterest = monthlyConstInt * f.constructionMonths

    const totalCostWithCarry = projectCost + rentLossDuringConst + totalConstInterest
    const cashIn = projectCost - loanAmount + rentLossDuringConst + totalConstInterest

    // Yields
    const inPlaceYield = projectCost > 0 ? (f.inPlaceNOI / projectCost) * 100 : 0
    const untrendedROC = projectCost > 0 ? (f.stabilizedNOI / projectCost) * 100 : 0
    const trendedROC = totalCostWithCarry > 0 ? (f.stabilizedNOI / totalCostWithCarry) * 100 : 0

    // Implied values
    const impliedValueMarket = f.marketCapRate > 0 ? f.stabilizedNOI / (f.marketCapRate / 100) : 0
    const impliedValueExit = f.exitCapRate > 0 ? f.stabilizedNOI / (f.exitCapRate / 100) : 0
    const profitOnCost = impliedValueExit - totalCostWithCarry
    const profitMargin = totalCostWithCarry > 0 ? (profitOnCost / totalCostWithCarry) * 100 : 0

    // Yield spreads
    const yieldSpread = untrendedROC - f.marketCapRate
    const yieldSpreadBps = yieldSpread * 100

    // Refi at stabilization
    const refiProceeds = impliedValueMarket * (f.refiLTV / 100)
    const refiDebtPayoff = loanAmount
    const netRefiCash = refiProceeds - refiDebtPayoff
    const remainingEquity = Math.max(0, cashIn - netRefiCash)
    const refiAnnDS = refiProceeds > 0 ? -PMT(f.refiRate / 100 / 12, f.refiAmort * 12, refiProceeds) * 12 : 0
    const stabilizedDSCR = refiAnnDS > 0 ? f.stabilizedNOI / refiAnnDS : 0
    const stabilizedCashFlow = f.stabilizedNOI - refiAnnDS
    const stabilizedCoC = remainingEquity > 0 ? (stabilizedCashFlow / remainingEquity) * 100 : 0

    return {
      closingCosts, projectCost, rentLossDuringConst, loanAmount, totalConstInterest,
      totalCostWithCarry, cashIn,
      inPlaceYield, untrendedROC, trendedROC,
      impliedValueMarket, impliedValueExit, profitOnCost, profitMargin,
      yieldSpread, yieldSpreadBps,
      refiProceeds, netRefiCash, remainingEquity, refiAnnDS, stabilizedDSCR, stabilizedCashFlow, stabilizedCoC,
    }
  }, [f, useDebt])

  const spreadClass = calc.yieldSpread >= 0 ? s.positive : s.negative
  const profitClass = calc.profitOnCost >= 0 ? s.positive : s.negative
  const dscrClass = calc.stabilizedDSCR >= 1.25 ? s.positive : calc.stabilizedDSCR >= 1.0 ? s.warning : s.negative

  const inputs = [
    { label: 'Acquisition Price', value: fmt$(f.acquisitionPrice) },
    { label: 'Closing Costs', value: `${fmtPct(f.closingCostsPct)} (${fmt$(calc.closingCosts)})` },
    { label: 'Rehab / CapEx', value: fmt$(f.rehabCapex) },
    { label: 'Total Project Cost', value: fmt$(calc.projectCost) },
    { label: 'Construction Period', value: `${f.constructionMonths} months` },
    { label: 'Rent Loss During Reno', value: `${fmtPct(f.rentLossPct)} (${fmt$(calc.rentLossDuringConst)})` },
    { label: 'In-Place NOI', value: fmt$(f.inPlaceNOI) },
    { label: 'Stabilized NOI', value: fmt$(f.stabilizedNOI) },
    { label: 'Market Cap Rate', value: `${f.marketCapRate}%` },
    { label: 'Exit Cap Rate', value: `${f.exitCapRate}%` },
    { label: 'Financing', value: useDebt ? `${fmtPct(f.loanLTC)} LTC @ ${fmtPct(f.constLoanRate)} IO` : 'All Cash' },
  ]

  const outputs = [
    { label: 'Total Cost (incl. carry)', value: fmt$(calc.totalCostWithCarry) },
    ...(useDebt ? [
      { label: 'Construction Loan', value: fmt$(calc.loanAmount) },
      { label: 'Construction Interest', value: fmt$(calc.totalConstInterest) },
      { label: 'Cash Required', value: fmt$(calc.cashIn) },
    ] : []),
    { label: 'In-Place Yield', value: fmtPct(calc.inPlaceYield) },
    { label: 'Untrended ROC', value: fmtPct(calc.untrendedROC) },
    { label: 'Trended ROC (w/ carry)', value: fmtPct(calc.trendedROC) },
    { label: 'Implied Value (Market Cap)', value: fmt$(calc.impliedValueMarket) },
    { label: 'Implied Value (Exit Cap)', value: fmt$(calc.impliedValueExit) },
    { label: 'Profit on Cost', value: fmt$(calc.profitOnCost), highlight: true },
    { label: 'Profit Margin', value: fmtPct(calc.profitMargin) },
    { label: 'Yield Spread vs Market', value: `${fmtPct(calc.yieldSpread)} (${fmtBps(calc.yieldSpreadBps)})` },
    { label: 'Stabilized Refi Proceeds', value: `${fmt$(calc.refiProceeds)} @ ${fmtPct(f.refiLTV)} LTV` },
    ...(useDebt ? [{ label: 'Net Cash Out at Refi', value: fmt$(calc.netRefiCash) }] : []),
    { label: 'Stabilized DSCR', value: calc.stabilizedDSCR.toFixed(2) + 'x' },
    { label: 'Stabilized Cash Flow', value: `${fmt$(calc.stabilizedCashFlow)}/yr` },
    ...(useDebt ? [{ label: 'Cash-on-Cash (post-refi)', value: fmtPct(calc.stabilizedCoC) }] : []),
  ]

  const handleExport = () => exportToolPdf({
    title: 'Return on Cost',
    subtitle: 'Value-Add / Development Yield Analysis',
    inputs, outputs,
  })

  return (
    <div className={styles.splitLayout}>
      <div className={styles.inputPane}>
        <div className={s.sectionLabel}>Purchase & Rehab</div>
        <div className={s.inputGrid}>
          <CurrencyInput label="Acquisition Price" value={f.acquisitionPrice} onChange={v => set('acquisitionPrice', v)} />
          <CurrencyInput label="Closing Costs %" value={f.closingCostsPct} onChange={v => set('closingCostsPct', v)} prefix="" suffix="%" />
          <CurrencyInput label="Rehab / CapEx" value={f.rehabCapex} onChange={v => set('rehabCapex', v)} />
          <CurrencyInput label="Total Project Cost" value={calc.projectCost} onChange={() => {}} disabled />
        </div>

        <div className={s.sectionLabel}>Construction Period</div>
        <div className={s.inputGrid}>
          <CurrencyInput label="Construction Months" value={f.constructionMonths} onChange={v => set('constructionMonths', v)} prefix="" />
          <CurrencyInput label="Rent Loss % During Reno" value={f.rentLossPct} onChange={v => set('rentLossPct', v)} prefix="" suffix="%" />
        </div>

        <div className={s.sectionLabel}>NOI & Cap Rates</div>
        <div className={s.inputGrid}>
          <CurrencyInput label="In-Place NOI" value={f.inPlaceNOI} onChange={v => set('inPlaceNOI', v)} />
          <CurrencyInput label="Stabilized NOI" value={f.stabilizedNOI} onChange={v => set('stabilizedNOI', v)} />
          <CurrencyInput label="Market Cap Rate (%)" value={f.marketCapRate} onChange={v => set('marketCapRate', v)} prefix="" suffix="%" />
          <CurrencyInput label="Exit Cap Rate (%)" value={f.exitCapRate} onChange={v => set('exitCapRate', v)} prefix="" suffix="%" />
        </div>

        <div className={s.sectionLabel} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          Construction Financing
          <div className={styles.toggleRow}>
            <button className={`${styles.toggleBtn} ${!useDebt ? styles.toggleActive : ''}`} onClick={() => setUseDebt(false)}>All Cash</button>
            <button className={`${styles.toggleBtn} ${useDebt ? styles.toggleActive : ''}`} onClick={() => setUseDebt(true)}>Const. Loan</button>
          </div>
        </div>
        {useDebt && (
          <div className={s.inputGrid}>
            <CurrencyInput label="LTC %" value={f.loanLTC} onChange={v => set('loanLTC', v)} prefix="" suffix="%" />
            <CurrencyInput label="Const. Rate (IO)" value={f.constLoanRate} onChange={v => set('constLoanRate', v)} prefix="" suffix="%" />
          </div>
        )}

        <div className={s.sectionLabel}>Stabilization Refi</div>
        <div className={s.inputGrid}>
          <CurrencyInput label="Refi LTV %" value={f.refiLTV} onChange={v => set('refiLTV', v)} prefix="" suffix="%" />
          <CurrencyInput label="Refi Rate" value={f.refiRate} onChange={v => set('refiRate', v)} prefix="" suffix="%" />
          <CurrencyInput label="Refi Amortization (yrs)" value={f.refiAmort} onChange={v => set('refiAmort', v)} prefix="" />
        </div>

        <div className={s.outputCard}>
          <div className={s.outputTitle}>Yield Analysis</div>
          <div className={s.outputRow}><span className={s.outputLabel}>Total Cost (incl. carry)</span><span className={s.outputValue}>{fmt$(calc.totalCostWithCarry)}</span></div>
          {useDebt && <>
            <div className={s.outputRow}><span className={s.outputLabel}>Construction Loan</span><span className={s.outputValue}>{fmt$(calc.loanAmount)}</span></div>
            <div className={s.outputRow}><span className={s.outputLabel}>Cash Required</span><span className={`${s.outputValue} ${s.accent}`}>{fmt$(calc.cashIn)}</span></div>
          </>}
          <div className={s.outputRow}><span className={s.outputLabel}>In-Place Yield</span><span className={s.outputValue}>{fmtPct(calc.inPlaceYield)}</span></div>
          <div className={s.outputRow}><span className={s.outputLabel}>Untrended ROC</span><span className={`${s.outputValue} ${s.accent}`}>{fmtPct(calc.untrendedROC)}</span></div>
          <div className={s.outputRow}><span className={s.outputLabel}>Trended ROC</span><span className={s.outputValue}>{fmtPct(calc.trendedROC)}</span></div>
          <div className={s.outputRow}><span className={s.outputLabel}>Implied Value (Exit Cap)</span><span className={s.outputValue}>{fmt$(calc.impliedValueExit)}</span></div>
          <div className={s.outputRow}><span className={s.outputLabel}>Profit on Cost</span><span className={`${s.outputValue} ${profitClass}`}>{fmt$(calc.profitOnCost)}</span></div>
          <div className={s.outputRow}><span className={s.outputLabel}>Profit Margin</span><span className={`${s.outputValue} ${profitClass}`}>{fmtPct(calc.profitMargin)}</span></div>
          <div className={s.outputRow}><span className={s.outputLabel}>Yield Spread</span><span className={`${s.outputValue} ${spreadClass}`}>{fmtPct(calc.yieldSpread)} ({fmtBps(calc.yieldSpreadBps)})</span></div>
        </div>

        <div className={s.outputCard}>
          <div className={s.outputTitle}>At Stabilization (Refi)</div>
          <div className={s.outputRow}><span className={s.outputLabel}>Refi Proceeds</span><span className={s.outputValue}>{fmt$(calc.refiProceeds)}</span></div>
          {useDebt && <div className={s.outputRow}><span className={s.outputLabel}>Net Cash Out</span><span className={`${s.outputValue} ${calc.netRefiCash >= 0 ? s.positive : s.negative}`}>{fmt$(calc.netRefiCash)}</span></div>}
          <div className={s.outputRow}><span className={s.outputLabel}>DSCR</span><span className={`${s.outputValue} ${dscrClass}`}>{calc.stabilizedDSCR.toFixed(2)}x</span></div>
          <div className={s.outputRow}><span className={s.outputLabel}>Cash Flow After Debt</span><span className={`${s.outputValue} ${calc.stabilizedCashFlow >= 0 ? s.positive : s.negative}`}>{fmt$(calc.stabilizedCashFlow)}/yr</span></div>
          {useDebt && <div className={s.outputRow}><span className={s.outputLabel}>Cash-on-Cash</span><span className={s.outputValue}>{fmtPct(calc.stabilizedCoC)}</span></div>}
        </div>
      </div>

      <SimplePreview
        title="Return on Cost"
        subtitle="Value-Add / Development Yield Analysis"
        inputs={inputs}
        outputs={outputs}
        onExport={handleExport}
      />
    </div>
  )
}
