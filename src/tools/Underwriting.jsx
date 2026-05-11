import { useState } from 'react'
import ExchangeAnalysis from './underwriting/ExchangeAnalysis'
import PortfolioExchange from './underwriting/PortfolioExchange'
import FlipModel from './underwriting/FlipModel'
import ReturnOnCost from './underwriting/ReturnOnCost'
import s from './shared.module.css'

const TOOLS = [
  { id: 'exchange', label: '1031 Exchange Analysis', component: ExchangeAnalysis },
  { id: 'portfolio', label: 'Portfolio 1031', component: PortfolioExchange },
  { id: 'flip', label: 'Flip Model', component: FlipModel },
  { id: 'roc', label: 'Return on Cost', component: ReturnOnCost },
]

export default function Underwriting() {
  const [active, setActive] = useState('exchange')
  const ActiveComponent = TOOLS.find(t => t.id === active)?.component

  return (
    <div className={s.toolPage}>
      <div className={s.toolHeader}>
        <div>
          <div className={s.toolTitle}>Underwriting Tools</div>
          <div className={s.toolSub}>1031 Exchange · Portfolio 1031 · Flip Model · Return on Cost</div>
        </div>
      </div>
      <div className={s.tabs}>
        {TOOLS.map(t => (
          <button
            key={t.id}
            className={`${s.tab} ${active === t.id ? s.tabActive : ''}`}
            onClick={() => setActive(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {ActiveComponent && <ActiveComponent />}
    </div>
  )
}
