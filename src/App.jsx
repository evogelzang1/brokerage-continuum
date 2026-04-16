import { useState } from 'react'
import MarketingTimeline from './tools/MarketingTimeline'
import EmailGenerators from './tools/EmailGenerators'
import Underwriting from './tools/Underwriting'
import ListingChecklist from './tools/ListingChecklist'
import OfferComparison from './tools/OfferComparison'
import ClosingCoordinator from './tools/ClosingCoordinator'
import CommissionCalculator from './tools/CommissionCalculator'
import styles from './App.module.css'

const SECTIONS = [
  { id: 'underwriting', label: 'Underwriting', component: Underwriting },
  { id: 'timeline', label: 'Marketing Timeline', component: MarketingTimeline },
  { id: 'emails', label: 'Client Emails', component: EmailGenerators },
  { id: 'checklist', label: 'Listing Checklist', component: ListingChecklist },
  { id: 'offers', label: 'Offer Comparison', component: OfferComparison },
  { id: 'closing', label: 'Closing Coordinator', component: ClosingCoordinator },
  { id: 'commission', label: 'Commission Calculator', component: CommissionCalculator },
]

export default function App() {
  const [active, setActive] = useState('underwriting')
  const ActiveComponent = SECTIONS.find(s => s.id === active)?.component

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <h1 className={styles.title}>Brokerage Continuum</h1>
          <p className={styles.sub}>Full lifecycle tools for CRE listings</p>
        </div>
      </header>
      <nav className={styles.nav}>
        {SECTIONS.map((s, i) => (
          <button
            key={s.id}
            className={`${styles.navBtn} ${active === s.id ? styles.navActive : ''}`}
            onClick={() => setActive(s.id)}
          >
            <span className={styles.navNum}>{i + 1}</span>
            {s.label}
          </button>
        ))}
      </nav>
      <main className={styles.main}>
        {ActiveComponent && <ActiveComponent />}
      </main>
    </div>
  )
}
