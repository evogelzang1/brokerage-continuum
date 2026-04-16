import { useState } from 'react'
import s from './shared.module.css'
import styles from './OfferComparison.module.css'

const EMPTY_OFFER = {
  buyerName: '', buyerCompany: '', offerPrice: '', pricePerSf: '', capRate: '',
  earnestMoney: '', dueDiligenceDays: '', closingDays: '', financingType: 'All Cash',
  contingencies: '', is1031: false, notes: '',
}

const fmt$ = v => {
  const n = parseFloat(String(v).replace(/[^0-9.-]/g, ''))
  return isNaN(n) ? v : `$${n.toLocaleString()}`
}

export default function OfferComparison() {
  const [propertyAddress, setPropertyAddress] = useState('')
  const [askingPrice, setAskingPrice] = useState('')
  const [offers, setOffers] = useState([
    { ...EMPTY_OFFER, buyerName: 'Buyer 1' },
    { ...EMPTY_OFFER, buyerName: 'Buyer 2' },
  ])

  const setOffer = (i, k, v) => setOffers(prev => prev.map((o, j) => j === i ? { ...o, [k]: v } : o))
  const addOffer = () => setOffers(prev => [...prev, { ...EMPTY_OFFER, buyerName: `Buyer ${prev.length + 1}` }])
  const removeOffer = (i) => setOffers(prev => prev.filter((_, j) => j !== i))

  const handleCopy = async () => {
    let text = `OFFER COMPARISON — ${propertyAddress || '[Property]'}\nAsking Price: ${askingPrice || 'N/A'}\n\n`
    offers.forEach((o, i) => {
      text += `--- ${o.buyerName || `Offer ${i + 1}`} ---\n`
      text += `Price: ${o.offerPrice || 'N/A'}\n`
      text += `Price/SF: ${o.pricePerSf || 'N/A'}\n`
      text += `Cap Rate: ${o.capRate || 'N/A'}\n`
      text += `Earnest Money: ${o.earnestMoney || 'N/A'}\n`
      text += `Due Diligence: ${o.dueDiligenceDays || 'N/A'} days\n`
      text += `Close Timeline: ${o.closingDays || 'N/A'} days\n`
      text += `Financing: ${o.financingType}\n`
      text += `1031 Exchange: ${o.is1031 ? 'Yes' : 'No'}\n`
      if (o.contingencies) text += `Contingencies: ${o.contingencies}\n`
      if (o.notes) text += `Notes: ${o.notes}\n`
      text += '\n'
    })
    try { await navigator.clipboard.writeText(text) } catch { /* fallback: select-all */ }
  }

  const FIELDS = [
    { key: 'offerPrice', label: 'Offer Price', placeholder: '$4,100,000' },
    { key: 'pricePerSf', label: 'Price / SF', placeholder: '$295' },
    { key: 'capRate', label: 'Cap Rate', placeholder: '5.8%' },
    { key: 'earnestMoney', label: 'Earnest Money', placeholder: '$100,000' },
    { key: 'dueDiligenceDays', label: 'Due Diligence (days)', placeholder: '30' },
    { key: 'closingDays', label: 'Close Timeline (days)', placeholder: '60' },
  ]

  const COMPARE_ROWS = [
    { label: 'Offer Price', key: 'offerPrice', format: fmt$ },
    { label: 'Price / SF', key: 'pricePerSf', format: fmt$ },
    { label: 'Cap Rate', key: 'capRate', format: v => v || '—' },
    { label: 'Earnest Money', key: 'earnestMoney', format: fmt$ },
    { label: 'Due Diligence', key: 'dueDiligenceDays', format: v => v ? `${v} days` : '—' },
    { label: 'Close Timeline', key: 'closingDays', format: v => v ? `${v} days` : '—' },
    { label: 'Financing', key: 'financingType', format: v => v },
    { label: '1031 Exchange', key: 'is1031', format: v => v ? 'Yes' : 'No' },
    { label: 'Contingencies', key: 'contingencies', format: v => v || 'None' },
  ]

  return (
    <div className={s.toolPage}>
      <div className={s.toolHeader}>
        <div>
          <div className={s.toolTitle}>Offer Comparison Matrix</div>
          <div className={s.toolSub}>Side-by-side LOI comparison for seller presentations</div>
        </div>
        <div className={s.headerBtns}>
          <button className={s.btnSecondary} onClick={handleCopy}>Copy to Clipboard</button>
          <button className={s.btnPrimary} onClick={addOffer}>+ Add Offer</button>
        </div>
      </div>

      <div className={styles.topFields}>
        <div className={s.fieldGroup}>
          <label className={s.label}>Property Address</label>
          <input className={s.input} value={propertyAddress} onChange={e => setPropertyAddress(e.target.value)} placeholder="e.g. 123 Main St, Los Angeles, CA" />
        </div>
        <div className={s.fieldGroup}>
          <label className={s.label}>Asking Price</label>
          <input className={s.input} value={askingPrice} onChange={e => setAskingPrice(e.target.value)} placeholder="$4,250,000" />
        </div>
      </div>

      {/* Input cards */}
      <div className={styles.offerGrid}>
        {offers.map((offer, i) => (
          <div key={i} className={styles.offerCard}>
            <div className={styles.offerHeader}>
              <input className={styles.offerName} value={offer.buyerName} onChange={e => setOffer(i, 'buyerName', e.target.value)} placeholder={`Buyer ${i + 1}`} />
              {offers.length > 1 && <button className={styles.removeBtn} onClick={() => removeOffer(i)}>&times;</button>}
            </div>
            <div className={s.fieldGroup}>
              <label className={s.label}>Company / Fund</label>
              <input className={s.input} value={offer.buyerCompany} onChange={e => setOffer(i, 'buyerCompany', e.target.value)} placeholder="e.g. ABC Capital" />
            </div>
            {FIELDS.map(f => (
              <div key={f.key} className={s.fieldGroup}>
                <label className={s.label}>{f.label}</label>
                <input className={s.input} value={offer[f.key]} onChange={e => setOffer(i, f.key, e.target.value)} placeholder={f.placeholder} />
              </div>
            ))}
            <div className={s.fieldGroup}>
              <label className={s.label}>Financing Type</label>
              <select className={s.select} value={offer.financingType} onChange={e => setOffer(i, 'financingType', e.target.value)}>
                <option>All Cash</option>
                <option>Conventional</option>
                <option>SBA</option>
                <option>Seller Financing</option>
                <option>Assumption</option>
              </select>
            </div>
            <label className={styles.checkLabel}>
              <input type="checkbox" checked={offer.is1031} onChange={e => setOffer(i, 'is1031', e.target.checked)} />
              <span>1031 Exchange Buyer</span>
            </label>
            <div className={s.fieldGroup}>
              <label className={s.label}>Contingencies</label>
              <textarea className={s.textarea} value={offer.contingencies} onChange={e => setOffer(i, 'contingencies', e.target.value)} placeholder="e.g. Financing, inspection, environmental" rows={2} />
            </div>
            <div className={s.fieldGroup}>
              <label className={s.label}>Notes</label>
              <textarea className={s.textarea} value={offer.notes} onChange={e => setOffer(i, 'notes', e.target.value)} placeholder="Additional context..." rows={2} />
            </div>
          </div>
        ))}
      </div>

      {/* Comparison table */}
      <div className={styles.compareSection}>
        <div className={s.sectionLabel}>Side-by-Side Comparison</div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th></th>
                {offers.map((o, i) => <th key={i}>{o.buyerName || `Offer ${i + 1}`}</th>)}
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((row, ri) => (
                <tr key={row.key} className={ri % 2 === 0 ? styles.altRow : ''}>
                  <td className={styles.rowLabel}>{row.label}</td>
                  {offers.map((o, i) => <td key={i}>{row.format(o[row.key])}</td>)}
                </tr>
              ))}
              <tr className={styles.notesRow}>
                <td className={styles.rowLabel}>Notes</td>
                {offers.map((o, i) => <td key={i} className={styles.noteCell}>{o.notes || '—'}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
