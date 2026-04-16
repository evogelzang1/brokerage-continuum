import { useState, useRef, useEffect, useCallback } from 'react'
import styles from './BrokerageContinuum.module.css'

// Maps timeline phase IDs to email tab IDs
const PHASE_TO_EMAIL = {
  'listing-signed': 'premarket',
  'premarket-prep': 'premarket',
  'market-launch': 'early',
  'weeks-1-4': 'early',
  'weeks-5-8': 'medium',
  'weeks-9+': 'highdom',
}

const EMAIL_TABS = [
  { id: 'premarket', label: 'Premarket Update' },
  { id: 'early', label: 'Weeks 4-8 Update' },
  { id: 'medium', label: 'Weeks 8-12 Update' },
  { id: 'highdom', label: 'Weeks 12+ Update' },
  { id: 'closing', label: 'Closing Email' },
]

const DEFAULTS = {
  clientName: '', propertyAddress: '', propertyType: '', agentName: '', listDate: '', askingPrice: '',
  // Premarket
  omStatus: '', eblastDate: '', linkedinDate: '', thirdPartyDate: '', signageStatus: '',
  premarketCalls: '', premarketHighlights: '', tourAccess: '', missingDiligence: '',
  // Early
  timeOnMarket: '', loopnetClicks: '', leadCount: '', leadNames: '', leadFeedback: '',
  eblastOpenRate: '', eblastClicks: '', totalCalls: '', postcardCount: '', linkedinImpressions: '', toursCompleted: '',
  // Medium
  totalLeads: '', loiActivity: '', buyerFeedback: '', nextSteps: '',
  // High DOM
  topObjection: '', competingListings: '', avgCompPrice: '', recentSalePrice: '', recentSaleDom: '', recommendedPrice: '', recommendation: '',
  // Closing
  closingDate: '', salePrice: '', pricePsf: '', daysToClose: '', dealHighlight: '',
}

// Shared fields shown on every view
const SHARED_FIELDS = [
  { key: 'clientName', label: 'Client Name' },
  { key: 'propertyAddress', label: 'Property Address' },
  { key: 'propertyType', label: 'Property Type', placeholder: 'e.g. Multi-Tenant Retail' },
  { key: 'agentName', label: 'Your Name' },
  { key: 'listDate', label: 'List Date', type: 'date' },
  { key: 'askingPrice', label: 'Asking Price', placeholder: 'e.g. $4,250,000' },
]

// Phase-specific fields — data entry only, agents fill in numbers/names/dates
const EMAIL_FIELDS = {
  premarket: [
    { key: 'omStatus', label: 'OM Status', placeholder: 'e.g. Final draft, photos complete, targeting delivery 4/12' },
    { key: 'eblastDate', label: 'Eblast Date', placeholder: 'e.g. April 15' },
    { key: 'linkedinDate', label: 'LinkedIn Post Date', placeholder: 'e.g. April 16' },
    { key: 'thirdPartyDate', label: '3rd Party Release Date', placeholder: 'e.g. April 18' },
    { key: 'signageStatus', label: 'Signage Status', placeholder: 'e.g. Ordered, installing Friday' },
    { key: 'premarketCalls', label: '# of Premarket Calls', placeholder: 'e.g. 85' },
    { key: 'premarketHighlights', label: 'Key Conversations (names/interest)', type: 'textarea', placeholder: 'e.g. Spoke with 3 active 1031 buyers, 2 requested OM preview' },
    { key: 'tourAccess', label: 'Tour Access Method', placeholder: 'e.g. Lockbox on site, 24hr notice required' },
    { key: 'missingDiligence', label: 'Missing Diligence Items (blank if none)', type: 'textarea', placeholder: 'e.g. T-12, rent roll, roof warranty' },
  ],
  early: [
    { key: 'timeOnMarket', label: 'Weeks on Market', placeholder: 'e.g. 6' },
    { key: 'loopnetClicks', label: 'LoopNet Clicks', placeholder: 'e.g. 245' },
    { key: 'leadCount', label: '# of Unique Leads', placeholder: 'e.g. 12' },
    { key: 'leadNames', label: 'Top Leads (names & firms)', type: 'textarea', placeholder: 'e.g. John Smith (ABC Capital), Sarah Lee (XYZ Investments)' },
    { key: 'leadFeedback', label: 'Lead Feedback Summary', type: 'textarea', placeholder: 'e.g. Positive on location, 2 buyers asked for rent roll, 1 pricing concern' },
    { key: 'eblastOpenRate', label: 'Eblast Open Rate %', placeholder: 'e.g. 32' },
    { key: 'eblastClicks', label: 'Eblast Click-Throughs', placeholder: 'e.g. 48' },
    { key: 'totalCalls', label: 'Total Outbound Calls', placeholder: 'e.g. 150' },
    { key: 'postcardCount', label: 'Postcards Sent (0 if none)', placeholder: 'e.g. 500' },
    { key: 'linkedinImpressions', label: 'LinkedIn Impressions', placeholder: 'e.g. 2,400' },
    { key: 'toursCompleted', label: '# of Tours Completed', placeholder: 'e.g. 4' },
  ],
  medium: [
    { key: 'totalCalls', label: 'Total Calls to Date', placeholder: 'e.g. 300' },
    { key: 'totalLeads', label: 'Total Leads to Date', placeholder: 'e.g. 22' },
    { key: 'toursCompleted', label: 'Tours Completed', placeholder: 'e.g. 6' },
    { key: 'loiActivity', label: 'LOI Activity', placeholder: 'e.g. 1 LOI received, 2 in discussion' },
    { key: 'buyerFeedback', label: 'Buyer Feedback Themes', type: 'textarea', placeholder: 'e.g. Pricing 5-10% above expectations, cap rate concern, strong location feedback' },
    { key: 'nextSteps', label: 'Planned Next Steps', type: 'textarea', placeholder: 'e.g. Second round of targeted calls, broker event invite, re-price discussion' },
  ],
  highdom: [
    { key: 'timeOnMarket', label: 'Days on Market', placeholder: 'e.g. 95' },
    { key: 'loopnetClicks', label: 'Total LoopNet Clicks', placeholder: 'e.g. 580' },
    { key: 'leadCount', label: 'Total Leads', placeholder: 'e.g. 28' },
    { key: 'eblastOpenRate', label: 'Eblast Open Rate %', placeholder: 'e.g. 29' },
    { key: 'totalCalls', label: 'Total Calls', placeholder: 'e.g. 400' },
    { key: 'toursCompleted', label: 'Tours Completed', placeholder: 'e.g. 8' },
    { key: 'topObjection', label: 'Top Buyer Objection', placeholder: 'e.g. Pricing too high relative to cap rate' },
    { key: 'competingListings', label: '# of Competing Listings', placeholder: 'e.g. 5' },
    { key: 'avgCompPrice', label: 'Avg Competing Price/PSF', placeholder: 'e.g. $285/PSF' },
    { key: 'recentSalePrice', label: 'Most Recent Comp Sale Price', placeholder: 'e.g. $3.8M at $270/PSF' },
    { key: 'recentSaleDom', label: 'That Comp Days on Market', placeholder: 'e.g. 62' },
    { key: 'recommendedPrice', label: 'Recommended New Price (if any)', placeholder: 'e.g. $3,950,000' },
    { key: 'recommendation', label: 'Recommendation', placeholder: 'Price Reduction / Hold / Strategy Pivot' },
  ],
  closing: [
    { key: 'closingDate', label: 'Closing Date', placeholder: 'e.g. April 4, 2026' },
    { key: 'salePrice', label: 'Sale Price', placeholder: 'e.g. $4,100,000' },
    { key: 'pricePsf', label: 'Price/PSF or Cap Rate', placeholder: 'e.g. $295/PSF, 5.8% cap' },
    { key: 'daysToClose', label: 'Days from List to Close', placeholder: 'e.g. 74' },
    { key: 'dealHighlight', label: 'Deal Win (1 line)', placeholder: 'e.g. Above ask, multiple offers, 60-day close' },
  ],
}

// --- Email generators (professional copy baked in, agents just fill data) ---

function generatePremarket(d) {
  const name = d.clientName || '[Client]'
  const addr = d.propertyAddress || '[Property Address]'
  const agent = d.agentName || '[Your Name]'

  const diligenceLine = d.missingDiligence
    ? `We are still waiting on a few items to finalize the package. If you could send over the following at your earliest convenience, it would help us hit the ground running:\n\n${d.missingDiligence}`
    : 'We have everything we need on the diligence side — thank you for getting those over promptly.'

  return `Hi ${name},

Hope you are doing well. I wanted to send over a quick update on where we stand with the marketing rollout for ${addr}.

**Offering Memorandum**
The OM is ${d.omStatus || '[status]'}. Once finalized, this will serve as the primary marketing piece distributed to our targeted buyer list.

**Marketing Launch Plan**
We have the following lined up and ready to deploy:

- **Eblast Campaign:** Scheduled for ${d.eblastDate || '[date]'} — targeted distribution to our curated buyer database
- **LinkedIn Announcement:** Going live ${d.linkedinDate || '[date]'} — designed to generate broker-to-broker awareness and inbound interest
- **3rd Party Syndication:** CoStar, LoopNet, Crexi, Craigslist, and Facebook Marketplace — releasing ${d.thirdPartyDate || '[date]'}
- **Property Signage:** ${d.signageStatus || '[status]'}

**Premarket Outreach**
We have already begun proactive outreach ahead of the official launch. To date, our team has made ${d.premarketCalls || '[#]'} premarket calls targeting the most likely buyer profiles for this asset.${d.premarketHighlights ? ' ' + d.premarketHighlights : ''}

**Tours & Access**
For scheduling tours, ${d.tourAccess ? 'access is via ' + d.tourAccess : 'we will coordinate all showings directly with your team'}. We will handle all tour logistics and provide you with feedback after each showing.

**Diligence**
${diligenceLine}

I have attached the **Marketing Timeline** so you can see the full rollout at a glance. Please let me know if you have any questions — excited to get this one moving.

Best,
${agent}`
}

function generateEarly(d) {
  const name = d.clientName || '[Client]'
  const addr = d.propertyAddress || '[Property Address]'
  const agent = d.agentName || '[Your Name]'

  return `Hi ${name},

Wanted to provide a marketing performance update on ${addr} as we approach week ${d.timeOnMarket || '[#]'} on market. Below is a summary of our activity and the traction we are seeing.

**Online Marketing Performance**
Our LoopNet listing has generated ${d.loopnetClicks || '[#]'} clicks to date, producing ${d.leadCount || '[#]'} unique leads. Our email campaign achieved a ${d.eblastOpenRate || '[#]'}% open rate with ${d.eblastClicks || '[#]'} click-throughs, which is strong relative to industry benchmarks. The LinkedIn announcement has reached ${d.linkedinImpressions || '[#]'} impressions.

**Lead Intelligence**
${d.leadNames ? 'Notable leads include: ' + d.leadNames + '.' : 'We are tracking several active leads across our database.'}${d.leadFeedback ? '\n\nFeedback from the market: ' + d.leadFeedback : ''}

**Proactive Outreach**
Our team has made ${d.totalCalls || '[#]'} outbound calls to targeted buyers and brokers.${d.postcardCount && d.postcardCount !== '0' ? ' We also distributed ' + d.postcardCount + ' direct mail postcards to our targeted owner/investor list.' : ''}${d.toursCompleted ? ' We have completed ' + d.toursCompleted + ' property tours to date.' : ''}

**3rd Party Platforms**
The property is live and active on CoStar, LoopNet, Crexi, Craigslist, and Facebook Marketplace. Property signage is in place and generating drive-by inquiries.

I have attached the full LoopNet marketing report and inbound leads sheet for your reference. Let me know if you would like to discuss any of this in more detail.

Best,
${agent}`
}

function generateMedium(d) {
  const name = d.clientName || '[Client]'
  const addr = d.propertyAddress || '[Property Address]'
  const agent = d.agentName || '[Your Name]'

  return `Hi ${name},

I wanted to check in with a comprehensive update on ${addr} and share where things stand as we continue to work the market.

**Outreach & Activity Summary**
To date, our team has made ${d.totalCalls || '[#]'} outbound calls, generated ${d.totalLeads || '[#]'} total leads, and completed ${d.toursCompleted || '[#]'} property tours. We continue to actively canvass the market and follow up with every qualified lead.

**LOI & Offer Activity**
${d.loiActivity || 'No formal LOIs have been submitted at this time. We are continuing to push for written interest from our most engaged prospects.'}

**Buyer Feedback**
This is the most important data point at this stage of the process, as it helps us understand how the market is reacting to the offering and informs our strategy going forward.

${d.buyerFeedback || '[Buyer feedback themes]'}

**Next Steps & Strategy**
${d.nextSteps || 'We will continue targeted outreach, follow up with all active leads, and reassess our positioning based on the feedback above.'}

I would like to schedule a call this week to walk through everything and discuss strategy. Let me know what works on your end.

Best,
${agent}`
}

function generateHighDOM(d) {
  const name = d.clientName || '[Client]'
  const addr = d.propertyAddress || '[Property Address]'
  const agent = d.agentName || '[Your Name]'
  const dom = d.timeOnMarket || '[#]'

  return `Hi ${name},

I wanted to provide a comprehensive update on ${addr} and share my honest assessment of where we stand at ${dom} days on market. I want to be transparent with you about what the data is telling us so we can make the best decision together.

**Marketing Performance to Date**
- LoopNet: ${d.loopnetClicks || '[#]'} clicks, ${d.leadCount || '[#]'} unique leads
- Email campaign: ${d.eblastOpenRate || '[#]'}% open rate
- Outbound calls: ${d.totalCalls || '[#]'}
- Tours completed: ${d.toursCompleted || '[#]'}

These are solid activity numbers, which tells us the property is getting exposure. The challenge is not visibility — it is conversion.

**Buyer Feedback**
The consistent theme from the market has been: ${d.topObjection || '[top objection]'}. This is the primary barrier to moving forward with the buyers we have engaged.

**Competitive Landscape**
There are currently ${d.competingListings || '[#]'} competing listings in the submarket, with an average asking price of ${d.avgCompPrice || '[price/PSF]'}. The most recent comparable sale closed at ${d.recentSalePrice || '[price]'} after ${d.recentSaleDom || '[#]'} days on market.

This market data is important context for our pricing discussion. Buyers are well-informed and using these data points to benchmark their offers.

**Recommendation**
Based on the totality of feedback, market activity, and competitive data, my recommendation is: **${d.recommendation || '[recommendation]'}**.${d.recommendedPrice ? ' I believe a price of **' + d.recommendedPrice + '** positions us competitively while still delivering a strong result.' : ''}

I know this is a lot of information. I would like to schedule a call to walk through it together and align on next steps. Please let me know your availability.

Best,
${agent}`
}

function generateClosing(d) {
  const name = d.clientName || '[Client]'
  const addr = d.propertyAddress || '[Property Address]'
  const agent = d.agentName || '[Your Name]'

  const highlight = d.salePrice
    ? `We closed at ${d.salePrice}${d.pricePsf ? ' (' + d.pricePsf + ')' : ''}${d.daysToClose ? ', just ' + d.daysToClose + ' days from listing to close' : ''}.${d.dealHighlight ? ' ' + d.dealHighlight + '.' : ''}`
    : (d.dealHighlight || 'It was a great outcome for everyone involved.')

  return `Hi ${name},

Congratulations — we officially closed on ${addr}${d.closingDate ? ' as of ' + d.closingDate : ''}!

${highlight}

It was a pleasure working with you through this process. Your trust and responsiveness throughout made all the difference, and I am proud of the result we were able to deliver together.

If there is anything you need on the post-closing side — estoppels, tenant communications, or anything else — please do not hesitate to reach out. I am always available.

I would also be grateful if you would keep me in mind for any future real estate needs, or if you know anyone who could benefit from the same level of service. Referrals from clients like you mean a great deal.

Thank you again, ${name}. Looking forward to staying in touch.

Best regards,
${agent}`
}

const GENERATORS = {
  premarket: generatePremarket,
  early: generateEarly,
  medium: generateMedium,
  highdom: generateHighDOM,
  closing: generateClosing,
}

// --- Timeline ---

function getTimelineNodes(d) {
  const listDate = d.listDate ? new Date(d.listDate) : null
  const fmt = (offset) => {
    if (!listDate) return 'TBD'
    const dt = new Date(listDate)
    dt.setDate(dt.getDate() + offset)
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return [
    {
      phase: 'LISTING SIGNED',
      date: `Week 1 — ${listDate ? listDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD'}`,
      color: '#1a73e8',
      items: ['Engagement executed', 'Diligence collection begins', 'Photo / drone scheduled'],
    },
    {
      phase: 'PREMARKET PREP',
      date: `Weeks 1-3 — ${fmt(0)} to ${fmt(20)}`,
      color: '#7c3aed',
      items: ['OM design & copywriting', 'Buyer list curation', 'Premarket calling & outreach', 'Tour access confirmed'],
    },
    {
      phase: 'MARKET LAUNCH',
      date: `Week 4 — ${fmt(21)}`,
      color: '#059669',
      items: ['Eblast to curated buyer list', 'LinkedIn announcement', 'CoStar / LoopNet / Crexi', 'Craigslist / FB Marketplace', 'Property signage installed'],
    },
    {
      phase: 'ON MARKET — WEEKS 4-8',
      date: `${fmt(21)} — ${fmt(55)}`,
      color: '#d97706',
      items: ['Lead tracking & follow-up', 'Tour coordination', 'Postcard mailer', 'First marketing report to client'],
    },
    {
      phase: 'ON MARKET — WEEKS 8-12',
      date: `${fmt(56)} — ${fmt(83)}`,
      color: '#dc2626',
      items: ['Buyer feedback analysis', 'Strategy review with client', 'Pricing assessment', 'Expanded outreach if needed'],
    },
    {
      phase: 'WEEKS 12+',
      date: `${fmt(84)}+`,
      color: '#64748b',
      items: ['Comprehensive market analysis', 'Comp review & pricing recommendation', 'Strategy pivot if warranted'],
    },
  ]
}

const PHASE_IDS = ['listing-signed', 'premarket-prep', 'market-launch', 'weeks-1-4', 'weeks-5-8', 'weeks-9+']

const PHASE_LABELS = {
  'listing-signed': 'Listing Signed',
  'premarket-prep': 'Premarket Prep',
  'market-launch': 'Market Launch',
  'weeks-1-4': 'On Market Wks 4-8',
  'weeks-5-8': 'On Market Wks 8-12',
  'weeks-9+': 'Weeks 12+',
}

function autoDetectPhase(listDate) {
  if (!listDate) return ''
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const ld = new Date(listDate)
  ld.setHours(0, 0, 0, 0)
  const days = Math.floor((now - ld) / (1000 * 60 * 60 * 24))

  if (days <= 6) return 'listing-signed'    // Week 1
  if (days <= 20) return 'premarket-prep'   // Weeks 1-3
  if (days <= 27) return 'market-launch'    // Week 4
  if (days <= 55) return 'weeks-1-4'        // Weeks 4-8
  if (days <= 83) return 'weeks-5-8'        // Weeks 8-12
  return 'weeks-9+'                          // Weeks 12+
}

function TimelineGraphic({ fields, hiddenPhases, currentPhase }) {
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
  const address = fields.propertyAddress || '[Property Address]'
  const propType = fields.propertyType || ''
  const price = fields.askingPrice || '[Price]'

  return (
    <div className={styles.timeline}>
      <div className={styles.tlHeader}>
        <div className={styles.tlTitle}>Marketing Timeline</div>
        <div className={styles.tlAddress}>{address}</div>
        <div className={styles.tlMeta}>
          {propType && <span>{propType}</span>}
          <span>Asking: {price}</span>
        </div>
      </div>

      <div className={styles.tlTrack}>
        {nodes.map((node, i) => {
          const isCurrent = i === visibleCurrentIdx
          const isPast = visibleCurrentIdx >= 0 && i < visibleCurrentIdx

          return (
            <div key={i} className={`${styles.tlNode} ${isPast ? styles.tlNodePast : ''}`}>
              <div
                className={`${styles.tlDot} ${isCurrent ? styles.tlDotCurrent : ''}`}
                style={{ background: isPast ? '#d1d5db' : node.color }}
              />
              {i < nodes.length - 1 && (
                <div className={styles.tlLine} style={isPast ? { background: '#d1d5db' } : {}} />
              )}
              {isCurrent && (
                <div className={styles.currentStage}>
                  <span className={styles.currentStageArrow} style={{ color: node.color }}>&#9654;</span>
                  <span className={styles.currentStageText} style={{ background: node.color }}>CURRENT STAGE</span>
                </div>
              )}
              <div
                className={`${styles.tlCard} ${isCurrent ? styles.tlCardCurrent : ''}`}
                style={{ borderLeftColor: isPast ? '#d1d5db' : node.color, ...(isCurrent ? { borderColor: node.color } : {}) }}
              >
                <div className={styles.tlPhase} style={{ color: isPast ? '#9ca3af' : node.color }}>{node.phase}</div>
                <div className={styles.tlDate}>{node.date}</div>
                <ul className={styles.tlItems}>
                  {node.items.map((item, j) => (
                    <li key={j} style={isPast ? { color: '#9ca3af' } : {}}>{item}</li>
                  ))}
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
  )
}

// --- Main Component ---

export default function BrokerageContinuum() {
  const [view, setView] = useState('timeline') // 'timeline' or email tab id
  const [fields, setFields] = useState({ ...DEFAULTS })
  const [copied, setCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [hiddenPhases, setHiddenPhases] = useState(new Set())
  const [currentPhase, setCurrentPhase] = useState('')
  const [autoStage, setAutoStage] = useState(true)
  const outputRef = useRef(null)
  const timelineRef = useRef(null)

  const isTimeline = view === 'timeline'
  const emailTabId = PHASE_TO_EMAIL[currentPhase] || 'premarket'
  const emailTabLabel = EMAIL_TABS.find(t => t.id === emailTabId)?.label || 'Email'

  useEffect(() => {
    if (autoStage && fields.listDate) {
      setCurrentPhase(autoDetectPhase(fields.listDate))
    }
  }, [fields.listDate, autoStage])

  const updateField = (key, value) => {
    setFields(prev => ({ ...prev, [key]: value }))
  }

  const handleExportPDF = useCallback(() => {
    const el = timelineRef.current
    if (!el) return
    const style = document.createElement('style')
    style.setAttribute('data-print-timeline', '')
    style.textContent = `
      @media print {
        @page { size: letter portrait; margin: 0.4in; }
        body, html, #root { background: #fff !important; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body > *, #root > * { visibility: hidden !important; height: 0 !important; overflow: hidden !important; position: absolute !important; }
        [data-timeline-print] { visibility: visible !important; position: static !important; height: auto !important; overflow: visible !important; }
        [data-timeline-print] * { visibility: visible !important; }
      }
    `
    document.head.appendChild(style)
    el.setAttribute('data-timeline-print', '')
    window.print()
    setTimeout(() => {
      style.remove()
      el.removeAttribute('data-timeline-print')
    }, 500)
  }, [])

  const handleCopy = async () => {
    const raw = GENERATORS[view]?.(fields) || ''
    const output = raw.replace(/\*\*(.+?)\*\*/g, '$1')
    try {
      await navigator.clipboard.writeText(output)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      if (outputRef.current) {
        const range = document.createRange()
        range.selectNodeContents(outputRef.current)
        window.getSelection()?.removeAllRanges()
        window.getSelection()?.addRange(range)
      }
    }
  }

  const handleClear = () => {
    setFields({ ...DEFAULTS })
  }

  const handleGenerateEmail = () => {
    setView(emailTabId)
  }

  const emailOutput = !isTimeline && GENERATORS[view] ? GENERATORS[view](fields) : ''

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Brokerage Continuum</h1>
          <p className={styles.sub}>Listing marketing templates & client deliverables</p>
        </div>
        <div className={styles.headerBtns}>
          <button
            className={styles.shareLinkBtn}
            onClick={() => {
              const base = window.location.origin
              navigator.clipboard.writeText(`${base}/tools/brokerage-continuum`)
              setLinkCopied(true)
              setTimeout(() => setLinkCopied(false), 2000)
            }}
          >
            {linkCopied ? 'Link Copied!' : 'Copy Agent Link'}
          </button>
          <button className={styles.clearBtn} onClick={handleClear}>Clear All Fields</button>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${isTimeline ? styles.tabActive : ''}`}
          onClick={() => setView('timeline')}
        >
          Marketing Timeline
        </button>
        <span className={styles.tabDivider} />
        {EMAIL_TABS.map(tab => (
          <button
            key={tab.id}
            className={`${styles.tab} ${view === tab.id ? styles.tabActive : ''}`}
            onClick={() => setView(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={styles.content}>
        {/* Left panel — always shared fields at top */}
        <div className={styles.formPanel}>
          <div className={styles.panelHeader}>Listing Details</div>
          <div className={styles.formFields}>
            {SHARED_FIELDS.map(field => (
              <div key={field.key} className={styles.fieldGroup}>
                <label className={styles.label}>{field.label}</label>
                <input
                  className={styles.input}
                  type={field.type || 'text'}
                  value={fields[field.key]}
                  onChange={e => updateField(field.key, e.target.value)}
                  placeholder={field.placeholder || ''}
                />
              </div>
            ))}

            {/* Timeline controls */}
            {isTimeline && (
              <>
                <div className={styles.tlControlSection}>
                  <div className={styles.label}>Show / Hide Phases</div>
                  {PHASE_IDS.map((id) => (
                    <label key={id} className={styles.tlToggle}>
                      <input
                        type="checkbox"
                        checked={!hiddenPhases.has(id)}
                        onChange={() => {
                          setHiddenPhases(prev => {
                            const next = new Set(prev)
                            if (next.has(id)) next.delete(id)
                            else next.add(id)
                            return next
                          })
                        }}
                      />
                      <span>{PHASE_LABELS[id]}</span>
                    </label>
                  ))}
                </div>

                <div className={styles.tlControlSection}>
                  <div className={styles.label}>Current Stage</div>
                  <label className={styles.tlToggle}>
                    <input
                      type="checkbox"
                      checked={autoStage}
                      onChange={e => {
                        setAutoStage(e.target.checked)
                        if (e.target.checked && fields.listDate) {
                          setCurrentPhase(autoDetectPhase(fields.listDate))
                        }
                      }}
                    />
                    <span>Auto-detect from dates</span>
                  </label>
                  <select
                    className={styles.input}
                    value={currentPhase}
                    onChange={e => { setCurrentPhase(e.target.value); setAutoStage(false) }}
                  >
                    <option value="">None</option>
                    {PHASE_IDS.filter(id => !hiddenPhases.has(id)).map(id => (
                      <option key={id} value={id}>{PHASE_LABELS[id]}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* Email-specific fields */}
            {!isTimeline && EMAIL_FIELDS[view] && (
              <>
                <div className={styles.tlControlSection}>
                  <div className={styles.label} style={{ marginBottom: 4 }}>
                    {EMAIL_TABS.find(t => t.id === view)?.label} Details
                  </div>
                </div>
                {EMAIL_FIELDS[view].map(field => (
                  <div key={field.key} className={styles.fieldGroup}>
                    <label className={styles.label}>{field.label}</label>
                    {field.type === 'textarea' ? (
                      <textarea
                        className={styles.textarea}
                        value={fields[field.key]}
                        onChange={e => updateField(field.key, e.target.value)}
                        placeholder={field.placeholder || ''}
                        rows={3}
                      />
                    ) : (
                      <input
                        className={styles.input}
                        type={field.type || 'text'}
                        value={fields[field.key]}
                        onChange={e => updateField(field.key, e.target.value)}
                        placeholder={field.placeholder || ''}
                      />
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Right panel — timeline or email preview */}
        <div className={styles.outputPanel}>
          <div className={styles.outputHeader}>
            <span className={styles.panelHeader}>Preview</span>
            {isTimeline ? (
              <button className={styles.copyBtn} onClick={handleExportPDF}>Export PDF</button>
            ) : (
              <button className={styles.copyBtn} onClick={handleCopy}>
                {copied ? 'Copied!' : 'Copy to Clipboard'}
              </button>
            )}
          </div>

          {isTimeline ? (
            <div className={styles.timelineWrap} ref={outputRef}>
              <div ref={timelineRef}>
                <TimelineGraphic fields={fields} hiddenPhases={hiddenPhases} currentPhase={currentPhase} />
              </div>
              {/* Generate email CTA */}
              {currentPhase && (
                <div className={styles.emailCta}>
                  <div className={styles.emailCtaText}>
                    Current stage: <strong>{PHASE_LABELS[currentPhase]}</strong>
                  </div>
                  <button className={styles.emailCtaBtn} onClick={handleGenerateEmail}>
                    Generate {emailTabLabel} &rarr;
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div
              className={styles.output}
              ref={outputRef}
              dangerouslySetInnerHTML={{ __html: emailOutput
                .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/\n/g, '<br />')
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
