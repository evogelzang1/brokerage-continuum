import { useState, useRef } from 'react'
import ExchangeAnalysis from './underwriting/ExchangeAnalysis'
import FlipModel from './underwriting/FlipModel'
import ReturnOnCost from './underwriting/ReturnOnCost'
import s from './shared.module.css'
import styles from './Underwriting.module.css'

const TOOLS = [
  { id: 'exchange', title: '1031 Exchange Analysis', icon: '↔' },
  { id: 'flip', title: 'Flip Model', icon: '⟳' },
  { id: 'roc', title: 'Return on Cost', icon: '◈' },
]

export default function Underwriting() {
  const [openTools, setOpenTools] = useState(new Set(['exchange']))

  const toggle = id => {
    setOpenTools(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const components = {
    exchange: <ExchangeAnalysis />,
    flip: <FlipModel />,
    roc: <ReturnOnCost />,
  }

  return (
    <div className={s.toolPage}>
      <div className={s.toolHeader}>
        <div>
          <div className={s.toolTitle}>Underwriting Tools</div>
          <div className={s.toolSub}>1031 Exchange · Flip Model · Return on Cost</div>
        </div>
      </div>
      <div className={styles.body}>
        {TOOLS.map(t => (
          <div key={t.id} className={`${styles.toolCard} ${openTools.has(t.id) ? styles.toolCardOpen : ''}`}>
            <button className={styles.toolHeader} onClick={() => toggle(t.id)}>
              <span className={styles.toolIcon}>{t.icon}</span>
              <span className={styles.toolTitle}>{t.title}</span>
              <span className={`${styles.chevron} ${openTools.has(t.id) ? styles.chevronOpen : ''}`}>&#9662;</span>
            </button>
            {openTools.has(t.id) && (
              <div className={styles.toolBody}>
                {components[t.id]}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
