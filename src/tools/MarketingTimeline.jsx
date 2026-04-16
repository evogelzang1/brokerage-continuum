import { useState, useRef, useCallback } from 'react'
import s from './shared.module.css'
import styles from './MarketingTimeline.module.css'

const PHASE_IDS = ['listing-signed', 'premarket-prep', 'market-launch', 'weeks-1-4', 'weeks-5-8', 'weeks-9+']
const PHASE_LABELS = {
  'listing-signed': 'Listing Signed',
  'premarket-prep': 'Premarket Prep',
  'market-launch': 'Market Launch',
  'weeks-1-4': 'On Market Wks 4-8',
  'weeks-5-8': 'On Market Wks 8-12',
  'weeks-9+': 'Weeks 12+',
}

function getTimelineNodes(fields) {
  const listDate = fields.listDate ? new Date(fields.listDate) : null
  const fmt = (offset) => {
    if (!listDate) return 'TBD'
    const dt = new Date(listDate)
    dt.setDate(dt.getDate() + offset)
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return [
    { phase: 'LISTING SIGNED', date: `Week 1 — ${listDate ? listDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD'}`, color: '#1a73e8', items: ['Engagement executed', 'Diligence collection begins', 'Photo / drone scheduled'] },
    { phase: 'PREMARKET PREP', date: `Weeks 1-3 — ${fmt(0)} to ${fmt(20)}`, color: '#7c3aed', items: ['OM design & copywriting', 'Buyer list curation', 'Premarket calling & outreach', 'Tour access confirmed'] },
    { phase: 'MARKET LAUNCH', date: `Week 4 — ${fmt(21)}`, color: '#059669', items: ['Eblast to curated buyer list', 'LinkedIn announcement', 'CoStar / LoopNet / Crexi', 'Craigslist / FB Marketplace', 'Property signage installed'] },
    { phase: 'ON MARKET — WEEKS 4-8', date: `${fmt(21)} — ${fmt(55)}`, color: '#d97706', items: ['Lead tracking & follow-up', 'Tour coordination', 'Postcard mailer', 'First marketing report to client'] },
    { phase: 'ON MARKET — WEEKS 8-12', date: `${fmt(56)} — ${fmt(83)}`, color: '#dc2626', items: ['Buyer feedback analysis', 'Strategy review with client', 'Pricing assessment', 'Expanded outreach if needed'] },
    { phase: 'WEEKS 12+', date: `${fmt(84)}+`, color: '#64748b', items: ['Comprehensive market analysis', 'Comp review & pricing recommendation', 'Strategy pivot if warranted'] },
  ]
}

function autoDetectPhase(listDate) {
  if (!listDate) return ''
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const ld = new Date(listDate); ld.setHours(0, 0, 0, 0)
  const days = Math.floor((now - ld) / 86400000)
  if (days <= 6) return 'listing-signed'
  if (days <= 20) return 'premarket-prep'
  if (days <= 27) return 'market-launch'
  if (days <= 55) return 'weeks-1-4'
  if (days <= 83) return 'weeks-5-8'
  return 'weeks-9+'
}

export default function MarketingTimeline() {
  const [fields, setFields] = useState({ clientName: '', propertyAddress: '', propertyType: '', agentName: '', listDate: '', askingPrice: '' })
  const [hiddenPhases, setHiddenPhases] = useState(new Set())
  const [currentPhase, setCurrentPhase] = useState('')
  const [autoStage, setAutoStage] = useState(true)
  const timelineRef = useRef(null)

  const updateField = (key, value) => {
    setFields(prev => {
      const next = { ...prev, [key]: value }
      if (key === 'listDate' && autoStage && value) {
        setCurrentPhase(autoDetectPhase(value))
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

  const allNodes = getTimelineNodes(fields)
  const nodes = allNodes.filter((_, i) => !hiddenPhases.has(PHASE_IDS[i]))
  const visibleCurrentIdx = (() => {
    const globalIdx = PHASE_IDS.indexOf(currentPhase)
    if (globalIdx === -1) return -1
    let count = -1
    for (let i = 0; i <= globalIdx; i++) {
      if (!hiddenPhases.has(PHASE_IDS[i])) count++
    }
    return count
  })()

  const SHARED_FIELDS = [
    { key: 'clientName', label: 'Client Name' },
    { key: 'propertyAddress', label: 'Property Address' },
    { key: 'propertyType', label: 'Property Type', placeholder: 'e.g. Multi-Tenant Retail' },
    { key: 'agentName', label: 'Your Name' },
    { key: 'listDate', label: 'List Date', type: 'date' },
    { key: 'askingPrice', label: 'Asking Price', placeholder: 'e.g. $4,250,000' },
  ]

  return (
    <div className={s.toolPage}>
      <div className={s.toolHeader}>
        <div>
          <div className={s.toolTitle}>Marketing Timeline</div>
          <div className={s.toolSub}>Visual timeline for client presentations — auto-dates from list date</div>
        </div>
        <button className={s.btnSecondary} onClick={handleExportPDF}>Export PDF</button>
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
            {PHASE_IDS.map(id => (
              <label key={id} className={styles.toggle}>
                <input type="checkbox" checked={!hiddenPhases.has(id)} onChange={() => setHiddenPhases(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })} />
                <span>{PHASE_LABELS[id]}</span>
              </label>
            ))}

            <div className={s.sectionLabel}>Current Stage</div>
            <label className={styles.toggle}>
              <input type="checkbox" checked={autoStage} onChange={e => { setAutoStage(e.target.checked); if (e.target.checked && fields.listDate) setCurrentPhase(autoDetectPhase(fields.listDate)) }} />
              <span>Auto-detect from dates</span>
            </label>
            <select className={s.select} value={currentPhase} onChange={e => { setCurrentPhase(e.target.value); setAutoStage(false) }}>
              <option value="">None</option>
              {PHASE_IDS.filter(id => !hiddenPhases.has(id)).map(id => (
                <option key={id} value={id}>{PHASE_LABELS[id]}</option>
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
                  <span>Asking: {fields.askingPrice || '[Price]'}</span>
                </div>
              </div>
              <div className={styles.tlTrack}>
                {nodes.map((node, i) => {
                  const isCurrent = i === visibleCurrentIdx
                  const isPast = visibleCurrentIdx >= 0 && i < visibleCurrentIdx
                  return (
                    <div key={i} className={`${styles.tlNode} ${isPast ? styles.tlNodePast : ''}`}>
                      <div className={`${styles.tlDot} ${isCurrent ? styles.tlDotCurrent : ''}`} style={{ background: isPast ? '#d1d5db' : node.color }} />
                      {i < nodes.length - 1 && <div className={styles.tlLine} style={isPast ? { background: '#d1d5db' } : {}} />}
                      {isCurrent && (
                        <div className={styles.currentStage}>
                          <span className={styles.currentStageArrow} style={{ color: node.color }}>&#9654;</span>
                          <span className={styles.currentStageText} style={{ background: node.color }}>CURRENT STAGE</span>
                        </div>
                      )}
                      <div className={`${styles.tlCard} ${isCurrent ? styles.tlCardCurrent : ''}`} style={{ borderLeftColor: isPast ? '#d1d5db' : node.color, ...(isCurrent ? { borderColor: node.color } : {}) }}>
                        <div className={styles.tlPhase} style={{ color: isPast ? '#9ca3af' : node.color }}>{node.phase}</div>
                        <div className={styles.tlDate}>{node.date}</div>
                        <ul className={styles.tlItems}>
                          {node.items.map((item, j) => <li key={j} style={isPast ? { color: '#9ca3af' } : {}}>{item}</li>)}
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
