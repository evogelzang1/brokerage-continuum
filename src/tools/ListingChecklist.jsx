import { useState, useMemo } from 'react'
import s from './shared.module.css'
import styles from './ListingChecklist.module.css'

const CHECKLIST_ITEMS = [
  { category: 'Engagement & Setup', items: [
    { id: 'listing-agreement', label: 'Executed listing agreement received', dueOffset: 0 },
    { id: 'fee-agreement', label: 'Commission agreement / co-brokerage terms set', dueOffset: 0 },
    { id: 'crm-entry', label: 'Property entered in CRM / tracking system', dueOffset: 1 },
    { id: 'team-notify', label: 'Team notified of new listing', dueOffset: 1 },
  ]},
  { category: 'Diligence Collection', items: [
    { id: 'rent-roll', label: 'Current rent roll obtained', dueOffset: 3 },
    { id: 't12', label: 'Trailing 12-month P&L (T-12) obtained', dueOffset: 3 },
    { id: 'leases', label: 'Copies of all leases', dueOffset: 5 },
    { id: 'survey', label: 'Survey / site plan', dueOffset: 5 },
    { id: 'tax-returns', label: 'Tax returns or assessor records', dueOffset: 7 },
    { id: 'insurance', label: 'Insurance certificate / loss history', dueOffset: 7 },
    { id: 'env-reports', label: 'Environmental reports (Phase I/II)', dueOffset: 7 },
    { id: 'roof-warranty', label: 'Roof warranty / inspection', dueOffset: 7 },
    { id: 'title', label: 'Preliminary title report ordered', dueOffset: 5 },
  ]},
  { category: 'Photography & Marketing Prep', items: [
    { id: 'photos', label: 'Professional photography scheduled', dueOffset: 5 },
    { id: 'drone', label: 'Drone / aerial photography scheduled', dueOffset: 5 },
    { id: 'floorplan', label: 'Floor plan / site plan prepared', dueOffset: 7 },
    { id: 'om-draft', label: 'OM first draft complete', dueOffset: 14 },
    { id: 'om-review', label: 'OM reviewed and approved by client', dueOffset: 18 },
    { id: 'om-final', label: 'OM finalized and print-ready', dueOffset: 20 },
  ]},
  { category: 'Online Listings & Syndication', items: [
    { id: 'costar', label: 'CoStar listing live', dueOffset: 21 },
    { id: 'loopnet', label: 'LoopNet listing live', dueOffset: 21 },
    { id: 'crexi', label: 'Crexi listing live', dueOffset: 21 },
    { id: 'craigslist', label: 'Craigslist posting live', dueOffset: 21 },
    { id: 'fb-marketplace', label: 'Facebook Marketplace posting', dueOffset: 21 },
  ]},
  { category: 'Outreach & Signage', items: [
    { id: 'buyer-list', label: 'Targeted buyer list curated', dueOffset: 14 },
    { id: 'eblast', label: 'Eblast campaign designed and sent', dueOffset: 21 },
    { id: 'linkedin', label: 'LinkedIn announcement posted', dueOffset: 22 },
    { id: 'signage-ordered', label: 'Property signage ordered', dueOffset: 10 },
    { id: 'signage-installed', label: 'Property signage installed', dueOffset: 21 },
    { id: 'premarket-calls', label: 'Premarket outbound call campaign started', dueOffset: 7 },
  ]},
  { category: 'Tour Preparation', items: [
    { id: 'tour-access', label: 'Tour access method confirmed (lockbox, appointment, etc.)', dueOffset: 7 },
    { id: 'tour-route', label: 'Tour route / showing instructions prepared', dueOffset: 14 },
    { id: 'tenant-notice', label: 'Tenant notification letter sent (if applicable)', dueOffset: 14 },
  ]},
]

function formatDate(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function daysUntil(dueDate) {
  const now = new Date(); now.setHours(0, 0, 0, 0)
  return Math.ceil((dueDate - now) / 86400000)
}

function makeId() {
  return 'custom-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7)
}

export default function ListingChecklist() {
  const [listDate, setListDate] = useState('')
  const [propertyAddress, setPropertyAddress] = useState('')
  const [checked, setChecked] = useState({})
  const [notes, setNotes] = useState({})
  // Custom items keyed by category name: { [catName]: [{ id, label, dueOffset }] }
  const [customItems, setCustomItems] = useState({})
  // Inline add form state
  const [addingTo, setAddingTo] = useState(null)      // category name or null
  const [newLabel, setNewLabel] = useState('')
  const [newOffset, setNewOffset] = useState('')

  const toggleItem = id => setChecked(prev => ({ ...prev, [id]: !prev[id] }))
  const setNote = (id, val) => setNotes(prev => ({ ...prev, [id]: val }))

  const startAdd = (cat) => {
    setAddingTo(cat)
    setNewLabel('')
    setNewOffset('')
  }

  const cancelAdd = () => {
    setAddingTo(null)
    setNewLabel('')
    setNewOffset('')
  }

  const commitAdd = (cat) => {
    const label = newLabel.trim()
    if (!label) { cancelAdd(); return }
    const offset = newOffset === '' ? null : Number(newOffset)
    const item = { id: makeId(), label, dueOffset: Number.isFinite(offset) ? offset : null }
    setCustomItems(prev => ({ ...prev, [cat]: [...(prev[cat] || []), item] }))
    cancelAdd()
  }

  const removeCustom = (cat, id) => {
    setCustomItems(prev => ({ ...prev, [cat]: (prev[cat] || []).filter(i => i.id !== id) }))
    setChecked(prev => { const n = { ...prev }; delete n[id]; return n })
    setNotes(prev => { const n = { ...prev }; delete n[id]; return n })
  }

  const stats = useMemo(() => {
    const defaultCount = CHECKLIST_ITEMS.reduce((sum, cat) => sum + cat.items.length, 0)
    const customCount = Object.values(customItems).reduce((sum, arr) => sum + arr.length, 0)
    const total = defaultCount + customCount
    const done = Object.values(checked).filter(Boolean).length
    return { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 }
  }, [checked, customItems])

  const listDateObj = listDate ? new Date(listDate) : null

  const handleReset = () => {
    setChecked({})
    setNotes({})
    setCustomItems({})
    cancelAdd()
  }

  const renderItem = (item, categoryName, isCustom) => {
    const dueDate = listDateObj && item.dueOffset != null
      ? new Date(listDateObj.getTime() + item.dueOffset * 86400000)
      : null
    const days = dueDate ? daysUntil(dueDate) : null
    const overdue = days !== null && days < 0 && !checked[item.id]
    const dueSoon = days !== null && days >= 0 && days <= 2 && !checked[item.id]

    return (
      <div key={item.id} className={`${styles.item} ${checked[item.id] ? styles.itemDone : ''} ${overdue ? styles.itemOverdue : ''}`}>
        <label className={styles.checkbox}>
          <input type="checkbox" checked={!!checked[item.id]} onChange={() => toggleItem(item.id)} />
          <span className={styles.itemLabel}>{item.label}</span>
        </label>
        <div className={styles.itemMeta}>
          {dueDate && (
            <span className={`${styles.dueDate} ${overdue ? styles.overdue : ''} ${dueSoon ? styles.dueSoon : ''}`}>
              {checked[item.id] ? 'Done' : overdue ? `${Math.abs(days)}d overdue` : days === 0 ? 'Due today' : `Due ${formatDate(dueDate)}`}
            </span>
          )}
          <input className={styles.noteInput} placeholder="Notes..." value={notes[item.id] || ''} onChange={e => setNote(item.id, e.target.value)} />
          {isCustom && (
            <button
              className={styles.removeBtn}
              onClick={() => removeCustom(categoryName, item.id)}
              title="Remove this item"
            >
              &times;
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={s.toolPage}>
      <div className={s.toolHeader}>
        <div>
          <div className={s.toolTitle}>Listing Checklist</div>
          <div className={s.toolSub}>Track every task from listing signed through market launch</div>
        </div>
        <div className={s.headerBtns}>
          <span className={styles.progress}>{stats.done}/{stats.total} ({stats.pct}%)</span>
          <button className={s.btnDanger} onClick={handleReset}>Reset</button>
        </div>
      </div>

      <div className={styles.topFields}>
        <div className={s.fieldGroup}>
          <label className={s.label}>Property Address</label>
          <input className={s.input} value={propertyAddress} onChange={e => setPropertyAddress(e.target.value)} placeholder="e.g. 123 Main St, Los Angeles, CA" />
        </div>
        <div className={s.fieldGroup}>
          <label className={s.label}>List Date</label>
          <input className={s.input} type="date" value={listDate} onChange={e => setListDate(e.target.value)} />
        </div>
      </div>

      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${stats.pct}%` }} />
      </div>

      {CHECKLIST_ITEMS.map(category => {
        const custom = customItems[category.category] || []
        const isAdding = addingTo === category.category

        return (
          <div key={category.category} className={styles.category}>
            <div className={styles.categoryTitle}>{category.category}</div>
            {category.items.map(item => renderItem(item, category.category, false))}
            {custom.map(item => renderItem(item, category.category, true))}

            {isAdding ? (
              <div className={styles.addRow}>
                <input
                  className={styles.addLabelInput}
                  placeholder="Task description..."
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitAdd(category.category)
                    if (e.key === 'Escape') cancelAdd()
                  }}
                  autoFocus
                />
                <input
                  className={styles.addOffsetInput}
                  placeholder="Due (days from list)"
                  type="number"
                  value={newOffset}
                  onChange={e => setNewOffset(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitAdd(category.category)
                    if (e.key === 'Escape') cancelAdd()
                  }}
                />
                <button className={s.btnPrimary} onClick={() => commitAdd(category.category)}>Add</button>
                <button className={s.btnDanger} onClick={cancelAdd}>Cancel</button>
              </div>
            ) : (
              <button className={styles.addBtn} onClick={() => startAdd(category.category)}>
                + Add item
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
