import { useState, useRef, useCallback } from 'react'
import s from './shared.module.css'
import styles from './MarketingTimeline.module.css'

// Each phase: id, label, color, dayStart/dayEnd (days from listDate), default items
const TEMPLATES = {
  sale: {
    label: 'Sale Listing',
    phases: [
      { id: 'listing-signed', phase: 'LISTING SIGNED', color: '#1a73e8', dayStart: 0, dayEnd: 6,
        items: ['Engagement executed', 'Diligence collection begins', 'Photo / drone scheduled'] },
      { id: 'premarket-prep', phase: 'PREMARKET PREP', color: '#7c3aed', dayStart: 0, dayEnd: 20,
        items: ['OM design & copywriting', 'Buyer list curation', 'Premarket calling & outreach', 'Tour access confirmed'] },
      { id: 'market-launch', phase: 'MARKET LAUNCH', color: '#059669', dayStart: 21, dayEnd: 21,
        items: ['Eblast to curated buyer list', 'LinkedIn announcement', 'CoStar / LoopNet / Crexi', 'Craigslist / FB Marketplace', 'Property signage installed'] },
      { id: 'weeks-1-4', phase: 'ON MARKET — WEEKS 4-8', color: '#d97706', dayStart: 21, dayEnd: 55,
        items: ['Lead tracking & follow-up', 'Tour coordination', 'Postcard mailer', 'First marketing report to client'] },
      { id: 'weeks-5-8', phase: 'ON MARKET — WEEKS 8-12', color: '#dc2626', dayStart: 56, dayEnd: 83,
        items: ['Buyer feedback analysis', 'Strategy review with client', 'Pricing assessment', 'Expanded outreach if needed'] },
      { id: 'weeks-9+', phase: 'WEEKS 12+', color: '#64748b', dayStart: 84, dayEnd: null,
        items: ['Comprehensive market analysis', 'Comp review & pricing recommendation', 'Strategy pivot if warranted'] },
    ],
  },
  leasing: {
    label: 'Landlord Rep Leasing',
    phases: [
      { id: 'listing-signed', phase: 'LISTING SIGNED', color: '#1a73e8', dayStart: 0, dayEnd: 6,
        items: ['Engagement executed', 'Target tenant profile defined', 'Marketing materials briefed', 'Signage ordered'] },
      { id: 'premarket-prep', phase: 'MARKETING PREP', color: '#7c3aed', dayStart: 0, dayEnd: 20,
        items: ['Flyer / brochure design', 'Broker database curation', 'Tenant rep canvassing started', 'Floor plans finalized'] },
      { id: 'market-launch', phase: 'MARKET LAUNCH', color: '#059669', dayStart: 21, dayEnd: 21,
        items: ['Flyer blast to tenant reps', 'CoStar / LoopNet leasing listing live', 'Signage installed', 'Broker open house scheduled', 'LinkedIn announcement'] },
      { id: 'active-marketing', phase: 'ACTIVE MARKETING — MONTHS 1-3', color: '#d97706', dayStart: 21, dayEnd: 90,
        items: ['Broker canvassing & follow-up', 'Tour coordination', 'Weekly activity reports', 'Competitor watch / comp tracking'] },
      { id: 'loi-negotiation', phase: 'LOI & BUSINESS TERMS — MONTHS 3-6', color: '#dc2626', dayStart: 91, dayEnd: 180,
        items: ['LOI review & negotiation', 'Rent, term, TI, free rent terms', 'Credit review of prospective tenant', 'Back-and-forth counters'] },
      { id: 'lease-execution', phase: 'LEASE EXECUTION — MONTHS 6-9', color: '#64748b', dayStart: 181, dayEnd: null,
        items: ['Lease drafting with counsel', 'Legal review & comments', 'Final execution', 'Tenant improvements planning'] },
    ],
  },
}

function autoDetectPhase(listDate, phases) {
  if (!listDate) return ''
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const ld = new Date(listDate); ld.setHours(0, 0, 0, 0)
  const days = Math.floor((now - ld) / 86400000)
  for (const p of phases) {
    const end = p.dayEnd == null ? Infinity : p.dayEnd
    if (days <= end) return p.id
  }
  return phases[phases.length - 1].id
}

function formatDateRange(listDateStr, dayStart, dayEnd) {
  if (!listDateStr) {
    if (dayEnd == null) return 'TBD+'
    if (dayStart === dayEnd) return 'TBD'
    return 'TBD — TBD'
  }
  const ld = new Date(listDateStr)
  const fmt = offset => {
    const dt = new Date(ld)
    dt.setDate(dt.getDate() + offset)
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  if (dayEnd == null) return `${fmt(dayStart)}+`
  if (dayStart === dayEnd) return fmt(dayStart)
  return `${fmt(dayStart)} — ${fmt(dayEnd)}`
}

function makeItemId() {
  return 'item-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6)
}

export default function MarketingTimeline() {
  const [template, setTemplate] = useState('sale')
  const [fields, setFields] = useState({ clientName: '', propertyAddress: '', propertyType: '', agentName: '', listDate: '', askingPrice: '' })
  const [hiddenPhases, setHiddenPhases] = useState(new Set())
  const [currentPhase, setCurrentPhase] = useState('')
  const [autoStage, setAutoStage] = useState(true)
  // Overrides keyed by `${template}:${phaseId}` → array of item strings.
  // Switching templates preserves each template's customizations.
  const [itemOverrides, setItemOverrides] = useState({})
  const [addingTo, setAddingTo] = useState(null) // phaseId currently in "adding" mode
  const [newItemText, setNewItemText] = useState('')
  const timelineRef = useRef(null)

  const phases = TEMPLATES[template].phases

  const overrideKey = (phaseId) => `${template}:${phaseId}`

  const getItems = (phase) => {
    const key = overrideKey(phase.id)
    return itemOverrides[key] != null ? itemOverrides[key] : phase.items
  }

  const setItems = (phaseId, newItems) => {
    setItemOverrides(prev => ({ ...prev, [overrideKey(phaseId)]: newItems }))
  }

  const updateItem = (phaseId, index, text) => {
    const phase = phases.find(p => p.id === phaseId)
    const items = [...getItems(phase)]
    items[index] = text
    setItems(phaseId, items)
  }

  const removeItem = (phaseId, index) => {
    const phase = phases.find(p => p.id === phaseId)
    const items = getItems(phase).filter((_, i) => i !== index)
    setItems(phaseId, items)
  }

  const addItem = (phaseId) => {
    const text = newItemText.trim()
    if (!text) { setAddingTo(null); setNewItemText(''); return }
    const phase = phases.find(p => p.id === phaseId)
    const items = [...getItems(phase), text]
    setItems(phaseId, items)
    setAddingTo(null)
    setNewItemText('')
  }

  const resetPhase = (phaseId) => {
    setItemOverrides(prev => {
      const next = { ...prev }
      delete next[overrideKey(phaseId)]
      return next
    })
  }

  const handleTemplateSwitch = (newTemplate) => {
    setTemplate(newTemplate)
    // Re-detect current phase under new template
    if (autoStage && fields.listDate) {
      setCurrentPhase(autoDetectPhase(fields.listDate, TEMPLATES[newTemplate].phases))
    } else {
      setCurrentPhase('')
    }
    setHiddenPhases(new Set())
    setAddingTo(null)
  }

  const updateField = (key, value) => {
    setFields(prev => {
      const next = { ...prev, [key]: value }
      if (key === 'listDate' && autoStage && value) {
        setCurrentPhase(autoDetectPhase(value, phases))
      }
      return next
    })
  }

  const handleExportPDF = useCallback(() => {
    const el = timelineRef.current
    if (!el) return
    const style = document.createElement('style')
    style.setAttribute('data-print-timeline', '')
    style.textContent = `@media print { @page { size: letter portrait; margin: 0.4in; } body, html, #root { background: #fff !important; } * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } body > *, #root > * { visibility: hidden !important; height: 0 !important; overflow: hidden !important; position: absolute !important; } [data-timeline-print] { visibility: visible !important; position: static !important; height: auto !important; overflow: visible !important; } [data-timeline-print] * { visibility: visible !important; } }`
    document.head.appendChild(style)
    el.setAttribute('data-timeline-print', '')
    window.print()
    setTimeout(() => { style.remove(); el.removeAttribute('data-timeline-print') }, 500)
  }, [])

  const visibleNodes = phases.filter(p => !hiddenPhases.has(p.id))
  const visibleCurrentIdx = (() => {
    const globalIdx = phases.findIndex(p => p.id === currentPhase)
    if (globalIdx === -1) return -1
    let count = -1
    for (let i = 0; i <= globalIdx; i++) {
      if (!hiddenPhases.has(phases[i].id)) count++
    }
    return count
  })()

  const SHARED_FIELDS = [
    { key: 'clientName', label: 'Client Name' },
    { key: 'propertyAddress', label: 'Property Address' },
    { key: 'propertyType', label: 'Property Type', placeholder: template === 'leasing' ? 'e.g. Multi-Tenant Retail (Leasing)' : 'e.g. Multi-Tenant Retail' },
    { key: 'agentName', label: 'Your Name' },
    { key: 'listDate', label: 'List Date', type: 'date' },
    { key: 'askingPrice', label: template === 'leasing' ? 'Asking Rent' : 'Asking Price', placeholder: template === 'leasing' ? 'e.g. $36/SF NNN' : 'e.g. $4,250,000' },
  ]

  return (
    <div className={s.toolPage}>
      <div className={s.toolHeader}>
        <div>
          <div className={s.toolTitle}>Marketing Timeline</div>
          <div className={s.toolSub}>Visual timeline for client presentations — pick a template, edit bullets as needed</div>
        </div>
        <button className={s.btnSecondary} onClick={handleExportPDF}>Export PDF</button>
      </div>

      <div className={styles.templateSwitcher}>
        <button
          className={`${styles.templateBtn} ${template === 'sale' ? styles.templateActive : ''}`}
          onClick={() => handleTemplateSwitch('sale')}
        >Sale Listing</button>
        <button
          className={`${styles.templateBtn} ${template === 'leasing' ? styles.templateActive : ''}`}
          onClick={() => handleTemplateSwitch('leasing')}
        >Landlord Rep Leasing</button>
      </div>

      <div className={s.splitLayout}>
        <div className={s.panel}>
          <div className={s.panelHeader}>Listing Details</div>
          <div className={s.panelBody}>
            {SHARED_FIELDS.map(field => (
              <div key={field.key} className={s.fieldGroup}>
                <label className={s.label}>{field.label}</label>
                <input className={s.input} type={field.type || 'text'} value={fields[field.key]} onChange={e => updateField(field.key, e.target.value)} placeholder={field.placeholder || ''} />
              </div>
            ))}

            <div className={s.sectionLabel}>Show / Hide Phases</div>
            {phases.map(p => (
              <label key={p.id} className={styles.toggle}>
                <input type="checkbox" checked={!hiddenPhases.has(p.id)} onChange={() => setHiddenPhases(prev => { const n = new Set(prev); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n })} />
                <span>{p.phase}</span>
              </label>
            ))}

            <div className={s.sectionLabel}>Current Stage</div>
            <label className={styles.toggle}>
              <input type="checkbox" checked={autoStage} onChange={e => { setAutoStage(e.target.checked); if (e.target.checked && fields.listDate) setCurrentPhase(autoDetectPhase(fields.listDate, phases)) }} />
              <span>Auto-detect from dates</span>
            </label>
            <select className={s.select} value={currentPhase} onChange={e => { setCurrentPhase(e.target.value); setAutoStage(false) }}>
              <option value="">None</option>
              {phases.filter(p => !hiddenPhases.has(p.id)).map(p => (
                <option key={p.id} value={p.id}>{p.phase}</option>
              ))}
            </select>
          </div>
        </div>

        <div className={s.panel}>
          <div className={s.panelHeader}>Preview</div>
          <div className={styles.timelineWrap} ref={timelineRef}>
            <div className={styles.timeline}>
              <div className={styles.tlHeader}>
                <div className={styles.tlTitle}>Marketing Timeline</div>
                <div className={styles.tlAddress}>{fields.propertyAddress || '[Property Address]'}</div>
                <div className={styles.tlMeta}>
                  {fields.propertyType && <span>{fields.propertyType}</span>}
                  <span>{template === 'leasing' ? 'Asking: ' : 'Asking: '}{fields.askingPrice || '[Price]'}</span>
                </div>
              </div>
              <div className={styles.tlTrack}>
                {visibleNodes.map((node, i) => {
                  const isCurrent = i === visibleCurrentIdx
                  const isPast = visibleCurrentIdx >= 0 && i < visibleCurrentIdx
                  const items = getItems(node)
                  const dateStr = formatDateRange(fields.listDate, node.dayStart, node.dayEnd)
                  const isEditedPhase = itemOverrides[overrideKey(node.id)] != null

                  return (
                    <div key={node.id} className={`${styles.tlNode} ${isPast ? styles.tlNodePast : ''}`}>
                      <div className={`${styles.tlDot} ${isCurrent ? styles.tlDotCurrent : ''}`} style={{ background: isPast ? '#d1d5db' : node.color }} />
                      {i < visibleNodes.length - 1 && <div className={styles.tlLine} style={isPast ? { background: '#d1d5db' } : {}} />}
                      {isCurrent && (
                        <div className={styles.currentStage}>
                          <span className={styles.currentStageArrow} style={{ color: node.color }}>&#9654;</span>
                          <span className={styles.currentStageText} style={{ background: node.color }}>CURRENT STAGE</span>
                        </div>
                      )}
                      <div className={`${styles.tlCard} ${isCurrent ? styles.tlCardCurrent : ''}`} style={{ borderLeftColor: isPast ? '#d1d5db' : node.color, ...(isCurrent ? { borderColor: node.color } : {}) }}>
                        <div className={styles.tlPhase} style={{ color: isPast ? '#9ca3af' : node.color }}>{node.phase}</div>
                        <div className={styles.tlDate}>{dateStr}</div>
                        <ul className={styles.tlItems}>
                          {items.map((item, idx) => (
                            <li key={idx} style={isPast ? { color: '#9ca3af' } : {}} className={styles.tlItem}>
                              <input
                                type="text"
                                value={item}
                                onChange={e => updateItem(node.id, idx, e.target.value)}
                                className={styles.tlItemInput}
                                style={isPast ? { color: '#9ca3af' } : {}}
                              />
                              <button
                                className={styles.tlRemoveItem}
                                onClick={() => removeItem(node.id, idx)}
                                title="Remove item"
                              >&times;</button>
                            </li>
                          ))}
                          {addingTo === node.id ? (
                            <li className={styles.tlAddRow}>
                              <input
                                type="text"
                                value={newItemText}
                                onChange={e => setNewItemText(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') addItem(node.id)
                                  if (e.key === 'Escape') { setAddingTo(null); setNewItemText('') }
                                }}
                                placeholder="New bullet..."
                                className={styles.tlItemInput}
                                autoFocus
                              />
                              <button className={styles.tlAddConfirm} onClick={() => addItem(node.id)}>Add</button>
                              <button className={styles.tlAddCancel} onClick={() => { setAddingTo(null); setNewItemText('') }}>×</button>
                            </li>
                          ) : (
                            <li className={styles.tlAddItemRow}>
                              <button className={styles.tlAddBtn} onClick={() => setAddingTo(node.id)}>+ Add bullet</button>
                              {isEditedPhase && (
                                <button className={styles.tlResetBtn} onClick={() => resetPhase(node.id)} title="Reset this phase to the template default">
                                  Reset
                                </button>
                              )}
                            </li>
                          )}
                        </ul>
                        {isPast && <div className={styles.tlComplete}>&#10003; Complete</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className={styles.tlFooter}>
                Prepared by {fields.agentName || '[Agent Name]'} &middot; Matthews Real Estate Investment Services
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
