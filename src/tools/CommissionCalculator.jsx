import { useState, useMemo } from 'react'
import CurrencyInput from './CurrencyInput'
import s from './shared.module.css'
import styles from './CommissionCalculator.module.css'

const fmt$ = v => `$${v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
const fmtPct = v => `${v.toFixed(2)}%`

export default function CommissionCalculator() {
  const [salePrice, setSalePrice] = useState(0)
  const [commissionPct, setCommissionPct] = useState(4)
  const [coBrokerSplit, setCoBrokerSplit] = useState(50)
  const [houseSplit, setHouseSplit] = useState(30)
  const [hasCoBroker, setHasCoBroker] = useState(true)
  const [teamSplit, setTeamSplit] = useState(0)

  const calc = useMemo(() => {
    const grossCommission = salePrice * (commissionPct / 100)

    // Co-broker gets their side first
    const coBrokerAmt = hasCoBroker ? grossCommission * (coBrokerSplit / 100) : 0
    const ourSide = grossCommission - coBrokerAmt

    // House (brokerage) takes their cut from our side
    const houseAmt = ourSide * (houseSplit / 100)
    const afterHouse = ourSide - houseAmt

    // Team split (if applicable)
    const teamAmt = afterHouse * (teamSplit / 100)
    const agentNet = afterHouse - teamAmt

    // Agent's effective rate on sale price
    const effectiveRate = salePrice > 0 ? (agentNet / salePrice) * 100 : 0

    return { grossCommission, coBrokerAmt, ourSide, houseAmt, afterHouse, teamAmt, agentNet, effectiveRate }
  }, [salePrice, commissionPct, coBrokerSplit, houseSplit, hasCoBroker, teamSplit])

  return (
    <div className={s.toolPage} style={{ maxWidth: 800 }}>
      <div className={s.toolHeader}>
        <div>
          <div className={s.toolTitle}>Commission Calculator</div>
          <div className={s.toolSub}>Calculate splits from gross commission to agent net</div>
        </div>
      </div>

      <div className={styles.layout}>
        <div className={styles.inputSection}>
          <CurrencyInput label="Sale Price" value={salePrice} onChange={setSalePrice} />
          <CurrencyInput label="Total Commission %" value={commissionPct} onChange={setCommissionPct} prefix="" suffix="%" />

          <label className={styles.checkLabel}>
            <input type="checkbox" checked={hasCoBroker} onChange={e => setHasCoBroker(e.target.checked)} />
            <span>Co-Broker Involved</span>
          </label>

          {hasCoBroker && (
            <CurrencyInput label="Co-Broker Split %" value={coBrokerSplit} onChange={setCoBrokerSplit} prefix="" suffix="%" />
          )}

          <CurrencyInput label="House / Brokerage Split %" value={houseSplit} onChange={setHouseSplit} prefix="" suffix="%" />
          <CurrencyInput label="Team Split % (0 if none)" value={teamSplit} onChange={setTeamSplit} prefix="" suffix="%" />
        </div>

        <div className={styles.resultSection}>
          <div className={styles.resultCard}>
            <div className={styles.resultRow}>
              <span className={styles.resultLabel}>Gross Commission ({fmtPct(commissionPct)})</span>
              <span className={styles.resultValue}>{fmt$(calc.grossCommission)}</span>
            </div>

            {hasCoBroker && (
              <div className={styles.resultRow}>
                <span className={styles.resultLabel}>Co-Broker ({fmtPct(coBrokerSplit)})</span>
                <span className={`${styles.resultValue} ${styles.deduction}`}>-{fmt$(calc.coBrokerAmt)}</span>
              </div>
            )}

            <div className={styles.resultRow} style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
              <span className={styles.resultLabel}>Our Side</span>
              <span className={styles.resultValue}>{fmt$(calc.ourSide)}</span>
            </div>

            <div className={styles.resultRow}>
              <span className={styles.resultLabel}>House Split ({fmtPct(houseSplit)})</span>
              <span className={`${styles.resultValue} ${styles.deduction}`}>-{fmt$(calc.houseAmt)}</span>
            </div>

            {teamSplit > 0 && (
              <div className={styles.resultRow}>
                <span className={styles.resultLabel}>Team Split ({fmtPct(teamSplit)})</span>
                <span className={`${styles.resultValue} ${styles.deduction}`}>-{fmt$(calc.teamAmt)}</span>
              </div>
            )}

            <div className={`${styles.resultRow} ${styles.netRow}`}>
              <span className={styles.netLabel}>Agent Net</span>
              <span className={styles.netValue}>{fmt$(calc.agentNet)}</span>
            </div>

            <div className={styles.effectiveRate}>
              Effective rate on sale: {fmtPct(calc.effectiveRate)}
            </div>
          </div>

          {/* Visual breakdown */}
          <div className={styles.breakdownBar}>
            {hasCoBroker && calc.coBrokerAmt > 0 && (
              <div className={styles.barSegment} style={{ flex: calc.coBrokerAmt, background: 'var(--text-subtle)' }} title={`Co-Broker: ${fmt$(calc.coBrokerAmt)}`} />
            )}
            {calc.houseAmt > 0 && (
              <div className={styles.barSegment} style={{ flex: calc.houseAmt, background: 'var(--yellow)' }} title={`House: ${fmt$(calc.houseAmt)}`} />
            )}
            {calc.teamAmt > 0 && (
              <div className={styles.barSegment} style={{ flex: calc.teamAmt, background: 'var(--orange)' }} title={`Team: ${fmt$(calc.teamAmt)}`} />
            )}
            {calc.agentNet > 0 && (
              <div className={styles.barSegment} style={{ flex: calc.agentNet, background: 'var(--green)' }} title={`Agent: ${fmt$(calc.agentNet)}`} />
            )}
          </div>
          <div className={styles.legend}>
            {hasCoBroker && <span><i style={{ background: 'var(--text-subtle)' }} />Co-Broker</span>}
            <span><i style={{ background: 'var(--yellow)' }} />House</span>
            {teamSplit > 0 && <span><i style={{ background: 'var(--orange)' }} />Team</span>}
            <span><i style={{ background: 'var(--green)' }} />Agent Net</span>
          </div>
        </div>
      </div>
    </div>
  )
}
