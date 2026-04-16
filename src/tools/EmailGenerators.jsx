import { useState, useRef, useEffect } from 'react'
import s from './shared.module.css'

// Convert generator output (plain text with **bold** markers and \n) to HTML
function textToHtml(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br />')
}

const EMAIL_TABS = [
  { id: 'premarket', label: 'Premarket Update' },
  { id: 'early', label: 'Weeks 4-8 Update' },
  { id: 'medium', label: 'Weeks 8-12 Update' },
  { id: 'highdom', label: 'Weeks 12+ Update' },
  { id: 'closing', label: 'Closing Email' },
]

const SHARED_FIELDS = [
  { key: 'clientName', label: 'Client Name' },
  { key: 'propertyAddress', label: 'Property Address' },
  { key: 'propertyType', label: 'Property Type', placeholder: 'e.g. Multi-Tenant Retail' },
  { key: 'agentName', label: 'Your Name' },
  { key: 'listDate', label: 'List Date', type: 'date' },
  { key: 'askingPrice', label: 'Asking Price', placeholder: 'e.g. $4,250,000' },
]

const EMAIL_FIELDS = {
  premarket: [
    { key: 'omStatus', label: 'OM Status', placeholder: 'e.g. Final draft, photos complete' },
    { key: 'eblastDate', label: 'Eblast Date', placeholder: 'e.g. April 15' },
    { key: 'linkedinDate', label: 'LinkedIn Post Date', placeholder: 'e.g. April 16' },
    { key: 'thirdPartyDate', label: '3rd Party Release Date', placeholder: 'e.g. April 18' },
    { key: 'signageStatus', label: 'Signage Status', placeholder: 'e.g. Ordered, installing Friday' },
    { key: 'premarketCalls', label: '# of Premarket Calls', placeholder: 'e.g. 85' },
    { key: 'premarketHighlights', label: 'Key Conversations', type: 'textarea', placeholder: 'e.g. Spoke with 3 active 1031 buyers' },
    { key: 'tourAccess', label: 'Tour Access Method', placeholder: 'e.g. Lockbox on site, 24hr notice' },
    { key: 'missingDiligence', label: 'Missing Diligence Items', type: 'textarea', placeholder: 'e.g. T-12, rent roll, roof warranty' },
  ],
  early: [
    { key: 'timeOnMarket', label: 'Weeks on Market', placeholder: 'e.g. 6' },
    { key: 'loopnetClicks', label: 'LoopNet Clicks', placeholder: 'e.g. 245' },
    { key: 'leadCount', label: '# of Unique Leads', placeholder: 'e.g. 12' },
    { key: 'leadNames', label: 'Top Leads (names & firms)', type: 'textarea', placeholder: 'e.g. John Smith (ABC Capital)' },
    { key: 'leadFeedback', label: 'Lead Feedback Summary', type: 'textarea', placeholder: 'e.g. Positive on location, pricing concern' },
    { key: 'eblastOpenRate', label: 'Eblast Open Rate %', placeholder: 'e.g. 32' },
    { key: 'eblastClicks', label: 'Eblast Click-Throughs', placeholder: 'e.g. 48' },
    { key: 'totalCalls', label: 'Total Outbound Calls', placeholder: 'e.g. 150' },
    { key: 'postcardCount', label: 'Postcards Sent', placeholder: 'e.g. 500' },
    { key: 'linkedinImpressions', label: 'LinkedIn Impressions', placeholder: 'e.g. 2,400' },
    { key: 'toursCompleted', label: '# of Tours Completed', placeholder: 'e.g. 4' },
  ],
  medium: [
    { key: 'totalCalls', label: 'Total Calls to Date', placeholder: 'e.g. 300' },
    { key: 'totalLeads', label: 'Total Leads to Date', placeholder: 'e.g. 22' },
    { key: 'toursCompleted', label: 'Tours Completed', placeholder: 'e.g. 6' },
    { key: 'loiActivity', label: 'LOI Activity', placeholder: 'e.g. 1 LOI received, 2 in discussion' },
    { key: 'buyerFeedback', label: 'Buyer Feedback Themes', type: 'textarea', placeholder: 'e.g. Pricing 5-10% above expectations' },
    { key: 'nextSteps', label: 'Planned Next Steps', type: 'textarea', placeholder: 'e.g. Second round of targeted calls' },
  ],
  highdom: [
    { key: 'timeOnMarket', label: 'Days on Market', placeholder: 'e.g. 95' },
    { key: 'loopnetClicks', label: 'Total LoopNet Clicks', placeholder: 'e.g. 580' },
    { key: 'leadCount', label: 'Total Leads', placeholder: 'e.g. 28' },
    { key: 'eblastOpenRate', label: 'Eblast Open Rate %', placeholder: 'e.g. 29' },
    { key: 'totalCalls', label: 'Total Calls', placeholder: 'e.g. 400' },
    { key: 'toursCompleted', label: 'Tours Completed', placeholder: 'e.g. 8' },
    { key: 'topObjection', label: 'Top Buyer Objection', placeholder: 'e.g. Pricing too high' },
    { key: 'competingListings', label: '# of Competing Listings', placeholder: 'e.g. 5' },
    { key: 'avgCompPrice', label: 'Avg Competing Price/PSF', placeholder: 'e.g. $285/PSF' },
    { key: 'recentSalePrice', label: 'Most Recent Comp Sale', placeholder: 'e.g. $3.8M at $270/PSF' },
    { key: 'recentSaleDom', label: 'That Comp Days on Market', placeholder: 'e.g. 62' },
    { key: 'recommendedPrice', label: 'Recommended New Price', placeholder: 'e.g. $3,950,000' },
    { key: 'recommendation', label: 'Recommendation', placeholder: 'Price Reduction / Hold / Pivot' },
  ],
  closing: [
    { key: 'closingDate', label: 'Closing Date', placeholder: 'e.g. April 4, 2026' },
    { key: 'salePrice', label: 'Sale Price', placeholder: 'e.g. $4,100,000' },
    { key: 'pricePsf', label: 'Price/PSF or Cap Rate', placeholder: 'e.g. $295/PSF, 5.8% cap' },
    { key: 'daysToClose', label: 'Days from List to Close', placeholder: 'e.g. 74' },
    { key: 'dealHighlight', label: 'Deal Win (1 line)', placeholder: 'e.g. Above ask, multiple offers' },
  ],
}

const DEFAULTS = {
  clientName: '', propertyAddress: '', propertyType: '', agentName: '', listDate: '', askingPrice: '',
  omStatus: '', eblastDate: '', linkedinDate: '', thirdPartyDate: '', signageStatus: '',
  premarketCalls: '', premarketHighlights: '', tourAccess: '', missingDiligence: '',
  timeOnMarket: '', loopnetClicks: '', leadCount: '', leadNames: '', leadFeedback: '',
  eblastOpenRate: '', eblastClicks: '', totalCalls: '', postcardCount: '', linkedinImpressions: '', toursCompleted: '',
  totalLeads: '', loiActivity: '', buyerFeedback: '', nextSteps: '',
  topObjection: '', competingListings: '', avgCompPrice: '', recentSalePrice: '', recentSaleDom: '', recommendedPrice: '', recommendation: '',
  closingDate: '', salePrice: '', pricePsf: '', daysToClose: '', dealHighlight: '',
}

function generatePremarket(d) {
  const name = d.clientName || '[Client]', addr = d.propertyAddress || '[Property Address]', agent = d.agentName || '[Your Name]'
  const diligenceLine = d.missingDiligence
    ? `A few remaining items from your side would help us finalize the package:\n\n${d.missingDiligence}`
    : 'Diligence is in good shape — thank you for the quick turnaround.'
  return `Hi ${name},\n\nA concise update on ${addr} as we approach launch.\n\n**Offering Memorandum**\n${d.omStatus || '[status]'}. This will be the primary piece distributed to every qualified buyer on our list.\n\n**Launch Plan**\n- Eblast to our curated buyer database: ${d.eblastDate || '[date]'}\n- LinkedIn announcement: ${d.linkedinDate || '[date]'}\n- CoStar, LoopNet, Crexi, Craigslist, Facebook Marketplace: ${d.thirdPartyDate || '[date]'}\n- Signage: ${d.signageStatus || '[status]'}\n\n**Premarket Outreach**\nWe have completed ${d.premarketCalls || '[#]'} targeted premarket calls to the buyers most likely to compete for this asset.${d.premarketHighlights ? ' ' + d.premarketHighlights : ''}\n\n**Tours & Access**\n${d.tourAccess ? 'Access: ' + d.tourAccess + '.' : 'We will coordinate all showings directly with your team.'} You will receive feedback after each tour.\n\n**Diligence**\n${diligenceLine}\n\nThe marketing timeline is attached. Please let me know if there is anything else you need ahead of launch.\n\nBest,\n${agent}`
}

function generateEarly(d) {
  const name = d.clientName || '[Client]', addr = d.propertyAddress || '[Property Address]', agent = d.agentName || '[Your Name]'
  return `Hi ${name},\n\nWeek ${d.timeOnMarket || '[#]'} performance update on ${addr}. Here is where we stand and what the market is telling us.\n\n**Online Performance**\n- LoopNet: ${d.loopnetClicks || '[#]'} clicks → ${d.leadCount || '[#]'} unique leads\n- Email campaign: ${d.eblastOpenRate || '[#]'}% open rate, ${d.eblastClicks || '[#]'} click-throughs — above industry benchmarks\n- LinkedIn: ${d.linkedinImpressions || '[#]'} impressions\n\n**Top Leads**\n${d.leadNames ? d.leadNames + ' — all actively engaged.' : 'Several qualified leads in active conversation.'}${d.leadFeedback ? '\n\nFeedback from the market: ' + d.leadFeedback : ''}\n\n**Proactive Outreach**\n${d.totalCalls || '[#]'} outbound calls to targeted buyers and brokers.${d.postcardCount && d.postcardCount !== '0' ? ' ' + d.postcardCount + ' postcards distributed to our owner and investor list.' : ''}${d.toursCompleted ? ' ' + d.toursCompleted + ' property tours completed.' : ''}\n\n**Distribution**\nLive and active on CoStar, LoopNet, Crexi, Craigslist, and Facebook Marketplace. Signage is installed and generating drive-by inquiries.\n\nThe full LoopNet report and lead sheet are attached. Happy to walk through any of it on a call.\n\nBest,\n${agent}`
}

function generateMedium(d) {
  const name = d.clientName || '[Client]', addr = d.propertyAddress || '[Property Address]', agent = d.agentName || '[Your Name]'
  return `Hi ${name},\n\nA comprehensive update on ${addr} — where we are, what the market is telling us, and the direction I recommend from here.\n\n**Activity to Date**\n${d.totalCalls || '[#]'} outbound calls. ${d.totalLeads || '[#]'} total leads. ${d.toursCompleted || '[#]'} property tours. We are working every qualified prospect.\n\n**LOI & Offer Activity**\n${d.loiActivity || 'No written offers submitted to date. We are actively pursuing formal interest from our most engaged prospects.'}\n\n**What the Market Is Telling Us**\nThis is the most important data point at this stage of the process — it shapes how we position from here.\n\n${d.buyerFeedback || '[Buyer feedback themes]'}\n\n**Next Steps**\n${d.nextSteps || 'Second round of targeted outreach, continued follow-up with active leads, and a positioning reassessment based on the feedback above.'}\n\nI would like to schedule a call this week to align on strategy. Please send over a time that works.\n\nBest,\n${agent}`
}

function generateHighDOM(d) {
  const name = d.clientName || '[Client]', addr = d.propertyAddress || '[Property Address]', agent = d.agentName || '[Your Name]', dom = d.timeOnMarket || '[#]'
  return `Hi ${name},\n\nA candid read on ${addr} at ${dom} days on market. I want to share the data and my recommendation so we can make the right call together.\n\n**Activity**\n- LoopNet: ${d.loopnetClicks || '[#]'} clicks, ${d.leadCount || '[#]'} unique leads\n- Email campaign: ${d.eblastOpenRate || '[#]'}% open rate\n- Outbound calls: ${d.totalCalls || '[#]'}\n- Tours completed: ${d.toursCompleted || '[#]'}\n\nExposure is not the issue. Conversion is.\n\n**The Primary Objection**\n${d.topObjection || '[top objection]'}. This is the consistent theme keeping buyers from moving to written offers.\n\n**Competitive Set**\n${d.competingListings || '[#]'} competing listings in the submarket averaging ${d.avgCompPrice || '[price/PSF]'}. The most recent comparable sale closed at ${d.recentSalePrice || '[price]'} after ${d.recentSaleDom || '[#]'} days on market.\n\nBuyers are well-informed and benchmarking against this data.\n\n**My Recommendation**\n**${d.recommendation || '[recommendation]'}**.${d.recommendedPrice ? ' A price of **' + d.recommendedPrice + '** positions us competitively while still delivering a strong result.' : ''}\n\nThis is an important decision and I would like to walk through it together. Please let me know your availability this week.\n\nBest,\n${agent}`
}

function generateClosing(d) {
  const name = d.clientName || '[Client]', addr = d.propertyAddress || '[Property Address]', agent = d.agentName || '[Your Name]'
  const highlight = d.salePrice
    ? `Closed at ${d.salePrice}${d.pricePsf ? ' (' + d.pricePsf + ')' : ''}${d.daysToClose ? ' — ' + d.daysToClose + ' days from list to close' : ''}.${d.dealHighlight ? ' ' + d.dealHighlight + '.' : ''}`
    : (d.dealHighlight || 'A clean result for everyone involved.')
  return `Hi ${name},\n\nCongratulations — ${addr}${d.closingDate ? ' officially closed ' + d.closingDate : ' is officially closed'}.\n\n${highlight}\n\nThis one came together because you were decisive at the key moments and responsive throughout. That is what gets deals to the finish line, and I am grateful to have worked with you on it.\n\nFor anything on the post-closing side — estoppels, tenant transitions, follow-up items — please don't hesitate to reach out. I am always available.\n\nIf there is anyone in your network who could benefit from the same level of service, I would be grateful for the introduction. Referrals from clients like you mean a great deal.\n\nThank you again, ${name}. Looking forward to the next one.\n\nBest regards,\n${agent}`
}

const GENERATORS = { premarket: generatePremarket, early: generateEarly, medium: generateMedium, highdom: generateHighDOM, closing: generateClosing }

export default function EmailGenerators() {
  const [activeTab, setActiveTab] = useState('premarket')
  const [fields, setFields] = useState({ ...DEFAULTS })
  const [copied, setCopied] = useState(false)
  // Per-tab overrides store HTML (from the contentEditable). Presence of a key
  // means the user has manually edited this tab; absence means show the
  // generator output live.
  const [overrides, setOverrides] = useState({})
  const editorRef = useRef(null)

  const updateField = (key, value) => setFields(prev => ({ ...prev, [key]: value }))

  const generatedEmail = GENERATORS[activeTab] ? GENERATORS[activeTab](fields) : ''
  const generatedHtml = textToHtml(generatedEmail)
  const isEdited = overrides[activeTab] != null
  const displayHtml = isEdited ? overrides[activeTab] : generatedHtml

  // Sync displayHtml → DOM only when the target differs. User-edit updates are
  // no-ops here because the DOM already matches after the keystroke.
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== displayHtml) {
      editorRef.current.innerHTML = displayHtml
    }
  }, [displayHtml, activeTab])

  const handleInput = (e) => {
    setOverrides(prev => ({ ...prev, [activeTab]: e.currentTarget.innerHTML }))
  }

  const handleReset = () => {
    setOverrides(prev => {
      const next = { ...prev }
      delete next[activeTab]
      return next
    })
  }

  const handleCopy = async () => {
    if (!editorRef.current) return
    const html = editorRef.current.innerHTML
    const text = editorRef.current.innerText
    try {
      // Write both HTML and plain text so pasting into Gmail/Outlook preserves bold/italic,
      // while pasting into plain-text fields still works.
      if (window.ClipboardItem && navigator.clipboard?.write) {
        const item = new window.ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' }),
        })
        await navigator.clipboard.write([item])
      } else {
        await navigator.clipboard.writeText(text)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Last-resort fallback: select the text so user can Ctrl+C
      const range = document.createRange()
      range.selectNodeContents(editorRef.current)
      window.getSelection()?.removeAllRanges()
      window.getSelection()?.addRange(range)
    }
  }

  // Rich-text formatting commands for the toolbar
  const exec = (cmd) => {
    editorRef.current?.focus()
    document.execCommand(cmd, false, null)
    // capture the result back to state so it persists as an override
    if (editorRef.current) {
      setOverrides(prev => ({ ...prev, [activeTab]: editorRef.current.innerHTML }))
    }
  }

  return (
    <div className={s.toolPage}>
      <div className={s.toolHeader}>
        <div>
          <div className={s.toolTitle}>Client Email Templates</div>
          <div className={s.toolSub}>Professional client update emails for every stage of the listing</div>
        </div>
        <button className={s.btnDanger} onClick={() => setFields({ ...DEFAULTS })}>Clear All</button>
      </div>

      <div className={s.tabs}>
        {EMAIL_TABS.map(tab => (
          <button key={tab.id} className={`${s.tab} ${activeTab === tab.id ? s.tabActive : ''}`} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
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
            {EMAIL_FIELDS[activeTab] && (
              <>
                <div className={s.sectionLabel}>{EMAIL_TABS.find(t => t.id === activeTab)?.label} Details</div>
                {EMAIL_FIELDS[activeTab].map(field => (
                  <div key={field.key} className={s.fieldGroup}>
                    <label className={s.label}>{field.label}</label>
                    {field.type === 'textarea' ? (
                      <textarea className={s.textarea} value={fields[field.key]} onChange={e => updateField(field.key, e.target.value)} placeholder={field.placeholder || ''} rows={3} />
                    ) : (
                      <input className={s.input} value={fields[field.key]} onChange={e => updateField(field.key, e.target.value)} placeholder={field.placeholder || ''} />
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        <div className={s.panel}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 14, gap: 8 }}>
            <div className={s.panelHeader}>
              Editable Preview {isEdited && <span style={{ color: 'var(--yellow)', fontSize: 10, marginLeft: 6 }}>● edited</span>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {isEdited && (
                <button className={s.btnDanger} onClick={handleReset} title="Discard edits and regenerate from form fields">
                  Reset to Template
                </button>
              )}
              <button className={s.btnSecondary} onClick={handleCopy}>{copied ? 'Copied!' : 'Copy to Clipboard'}</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, padding: '0 16px 8px' }}>
            <button
              type="button"
              onMouseDown={e => { e.preventDefault(); exec('bold') }}
              style={{ fontFamily: 'inherit', fontWeight: 700, fontSize: 12, padding: '4px 10px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', cursor: 'pointer' }}
              title="Bold (Ctrl+B)"
            >B</button>
            <button
              type="button"
              onMouseDown={e => { e.preventDefault(); exec('italic') }}
              style={{ fontFamily: 'inherit', fontStyle: 'italic', fontSize: 12, padding: '4px 10px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', cursor: 'pointer' }}
              title="Italic (Ctrl+I)"
            >I</button>
            <button
              type="button"
              onMouseDown={e => { e.preventDefault(); exec('underline') }}
              style={{ fontFamily: 'inherit', textDecoration: 'underline', fontSize: 12, padding: '4px 10px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', cursor: 'pointer' }}
              title="Underline (Ctrl+U)"
            >U</button>
          </div>
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            style={{
              flex: 1,
              margin: '0 16px 16px',
              padding: '12px 14px',
              fontFamily: 'inherit',
              fontSize: 13,
              lineHeight: 1.8,
              color: 'var(--text)',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              outline: 'none',
              overflowY: 'auto',
              wordWrap: 'break-word',
              whiteSpace: 'pre-wrap',
            }}
          />
        </div>
      </div>
    </div>
  )
}
