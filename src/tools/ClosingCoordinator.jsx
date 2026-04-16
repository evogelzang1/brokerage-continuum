import { useState, useMemo } from 'react'
import s from './shared.module.css'
import styles from './ClosingCoordinator.module.css'

const CLOSING_ITEMS = [
  { category: 'Escrow & Title', items: [
    { id: 'escrow-opened', label: 'Escrow opened', dueOffset: 0 },
    { id: 'title-ordered', label: 'Preliminary title report ordered', dueOffset: 2 },
    { id: 'title-reviewed', label: 'Title report reviewed — exceptions cleared', dueOffset: 10 },
    { id: 'title-insurance', label: 'Title insurance policy ordered', dueOffset: 15 },
  ]},
  { category: 'Due Diligence', items: [
    { id: 'dd-period-start', label: 'Due diligence period started', dueOffset: 0 },
    { id: 'inspection', label: 'Physical inspection completed', dueOffset: 10 },
    { id: 'env-review', label: 'Environmental review completed', dueOffset: 15 },
    { id: 'financials-verified', label: 'Financial documents verified (T-12, rent roll)', dueOffset: 15 },
    { id: 'lease-audit', label: 'Lease audit completed', dueOffset: 15 },
    { id: 'dd-contingency', label: 'Due diligence contingency removed', dueOffset: 20 },
  ]},
  { category: 'Financing', items: [
    { id: 'loan-app', label: 'Loan application submitted', dueOffset: 5 },
    { id: 'appraisal-ordered', label: 'Appraisal ordered', dueOffset: 7 },
    { id: 'appraisal-received', label: 'Appraisal received and reviewed', dueOffset: 21 },
    { id: 'loan-approval', label: 'Loan approval / commitment letter received', dueOffset: 30 },
    { id: 'financing-contingency', label: 'Financing contingency removed', dueOffset: 35 },
    { id: 'loan-docs', label: 'Loan documents signed', dueOffset: -3, fromClose: true },
  ]},
  { category: 'Closing Prep', items: [
    { id: 'estoppels', label: 'Tenant estoppel certificates collected', dueOffset: 25 },
    { id: 'snda', label: 'SNDA agreements executed (if required)', dueOffset: 30 },
    { id: 'prorations', label: 'Prorations calculated and agreed', dueOffset: -5, fromClose: true },
    { id: 'closing-statement', label: 'Closing statement reviewed and approved', dueOffset: -3, fromClose: true },
    { id: 'wire-instructions', label: 'Wire instructions confirmed', dueOffset: -2, fromClose: true },
    { id: 'keys-access', label: 'Keys / access transfer coordinated', dueOffset: -1, fromClose: true },
  ]},
  { category: 'Post-Close', items: [
    { id: 'commission-received', label: 'Commission disbursement received', dueOffset: 3, fromClose: true, postClose: true },
    { id: 'tenant-notice', label: 'Tenant notification letters sent', dueOffset: 2, fromClose: true, postClose: true },
    { id: 'docs-filed', label: 'All documents filed and archived', dueOffset: 5, fromClose: true, postClose: true },
    { id: 'closing-email', label: 'Closing email sent to client', dueOffset: 0, fromClose: true, postClose: true },
  ]},
]

function formatDate(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function daysUntil(dueDate) {
  const now = new Date(); now.setHours(0, 0, 0, 0)
  return Math.ceil((dueDate - now) / 86400000)
}

export default function ClosingCoordinator() {
  const [escrowDate, setEscrowDate] = useState('')
  const [closeDate, setCloseDate] = useState('')
  const [propertyAddress, setPropertyAddress] = useState('')
  const [buyerName, setBuyerName] = useState('')
  const [sellerName, setSellerName] = useState('')
  const [escrowOfficer, setEscrowOfficer] = useState('')
  const [escrowCompany, setEscrowCompany] = useState('')
  const [escrowPhone, setEscrowPhone] = useState('')
  const [checked, setChecked] = useState({})
  const [notes, setNotes] = useState({})

  const toggleItem = id => setChecked(prev => ({ ...prev, [id]: !prev[id] }))
  const setNote = (id, val) => setNotes(prev => ({ ...prev, [id]: val }))

  const escrowDateObj = escrowDate ? new Date(escrowDate) : null
  const closeDateObj = closeDate ? new Date(closeDate) : null

  const stats = useMemo(() => {
    const total = CLOSING_ITEMS.reduce((sum, cat) => sum + cat.items.length, 0)
    const done = Object.values(checked).filter(Boolean).length
    return { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 }
  }, [checked])

  const getDueDate = (item) => {
    if (item.fromClose && closeDateObj) {
      return new Date(closeDateObj.getTime() + item.dueOffset * 86400000)
    }
    if (!item.fromClose && escrowDateObj) {
      return new Date(escrowDateObj.getTime() + item.dueOffset * 86400000)
    }
    return null
  }

  return (
    <div className={s.toolPage}>
      <div className={s.toolHeader}>
        <div>
          <div className={s.toolTitle}>Closing Coordinator</div>
          <div className={s.toolSub}>Track every deadline from escrow open through post-close</div>
        </div>
        <div className={s.headerBtns}>
          <span className={styles.progress}>{stats.done}/{stats.total} ({stats.pct}%)</span>
          <button className={s.btnDanger} onClick={() => { setChecked({}); setNotes({}) }}>Reset</button>
        </div>
      </div>

      <div className={styles.topGrid}>
        <div className={s.fieldGroup}>
          <label className={s.label}>Property Address</label>
          <input className={s.input} value={propertyAddress} onChange={e => setPropertyAddress(e.target.value)} placeholder="123 Main St" />
        </div>
        <div className={s.fieldGroup}>
          <label className={s.label}>Escrow Open Date</label>
          <input className={s.input} type="date" value={escrowDate} onChange={e => setEscrowDate(e.target.value)} />
        </div>
        <div className={s.fieldGroup}>
          <label className={s.label}>Target Close Date</label>
          <input className={s.input} type="date" value={closeDate} onChange={e => setCloseDate(e.target.value)} />
        </div>
        <div className={s.fieldGroup}>
          <label className={s.label}>Buyer</label>
          <input className={s.input} value={buyerName} onChange={e => setBuyerName(e.target.value)} placeholder="Buyer name / entity" />
        </div>
        <div className={s.fieldGroup}>
          <label className={s.label}>Seller</label>
          <input className={s.input} value={sellerName} onChange={e => setSellerName(e.target.value)} placeholder="Seller name / entity" />
        </div>
        <div className={s.fieldGroup}>
          <label className={s.label}>Escrow Officer</label>
          <input className={s.input} value={escrowOfficer} onChange={e => setEscrowOfficer(e.target.value)} placeholder="Name" />
        </div>
        <div className={s.fieldGroup}>
          <label className={s.label}>Escrow Company</label>
          <input className={s.input} value={escrowCompany} onChange={e => setEscrowCompany(e.target.value)} placeholder="Company" />
        </div>
        <div className={s.fieldGroup}>
          <label className={s.label}>Escrow Phone</label>
          <input className={s.input} value={escrowPhone} onChange={e => setEscrowPhone(e.target.value)} placeholder="(555) 555-5555" />
        </div>
      </div>

      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${stats.pct}%` }} />
      </div>

      {CLOSING_ITEMS.map(category => (
        <div key={category.category} className={styles.category}>
          <div className={styles.categoryTitle}>{category.category}</div>
          {category.items.map(item => {
            const dueDate = getDueDate(item)
            const days = dueDate ? daysUntil(dueDate) : null
            const overdue = days !== null && days < 0 && !checked[item.id]
            const dueSoon = days !== null && days >= 0 && days <= 3 && !checked[item.id]

            return (
              <div key={item.id} className={`${styles.item} ${checked[item.id] ? styles.itemDone : ''} ${overdue ? styles.itemOverdue : ''}`}>
                <label className={styles.checkbox}>
                  <input type="checkbox" checked={!!checked[item.id]} onChange={() => toggleItem(item.id)} />
                  <span className={styles.itemLabel}>{item.label}</span>
                </label>
                <div className={styles.itemMeta}>
                  {dueDate && (
                    <span className={`${styles.dueDate} ${overdue ? styles.overdue : ''} ${dueSoon ? styles.dueSoon : ''}`}>
                      {checked[item.id] ? 'Done' : overdue ? `${Math.abs(days)}d overdue` : days === 0 ? 'Due today' : `${formatDate(dueDate)}`}
                    </span>
                  )}
                  <input className={styles.noteInput} placeholder="Notes..." value={notes[item.id] || ''} onChange={e => setNote(item.id, e.target.value)} />
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
