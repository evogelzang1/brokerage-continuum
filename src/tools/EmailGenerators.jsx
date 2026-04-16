import { useState, useRef } from 'react'
import s from './shared.module.css'

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
    ? `We are still waiting on a few items to finalize the package. If you could send over the following at your earliest convenience, it would help us hit the ground running:\n\n${d.missingDiligence}`
    : 'We have everything we need on the diligence side — thank you for getting those over promptly.'
  return `Hi ${name},\n\nHope you are doing well. I wanted to send over a quick update on where we stand with the marketing rollout for ${addr}.\n\n**Offering Memorandum**\nThe OM is ${d.omStatus || '[status]'}. Once finalized, this will serve as the primary marketing piece distributed to our targeted buyer list.\n\n**Marketing Launch Plan**\nWe have the following lined up and ready to deploy:\n\n- **Eblast Campaign:** Scheduled for ${d.eblastDate || '[date]'} — targeted distribution to our curated buyer database\n- **LinkedIn Announcement:** Going live ${d.linkedinDate || '[date]'} — designed to generate broker-to-broker awareness and inbound interest\n- **3rd Party Syndication:** CoStar, LoopNet, Crexi, Craigslist, and Facebook Marketplace — releasing ${d.thirdPartyDate || '[date]'}\n- **Property Signage:** ${d.signageStatus || '[status]'}\n\n**Premarket Outreach**\nWe have already begun proactive outreach ahead of the official launch. To date, our team has made ${d.premarketCalls || '[#]'} premarket calls targeting the most likely buyer profiles for this asset.${d.premarketHighlights ? ' ' + d.premarketHighlights : ''}\n\n**Tours & Access**\nFor scheduling tours, ${d.tourAccess ? 'access is via ' + d.tourAccess : 'we will coordinate all showings directly with your team'}. We will handle all tour logistics and provide you with feedback after each showing.\n\n**Diligence**\n${diligenceLine}\n\nI have attached the **Marketing Timeline** so you can see the full rollout at a glance. Please let me know if you have any questions — excited to get this one moving.\n\nBest,\n${agent}`
}

function generateEarly(d) {
  const name = d.clientName || '[Client]', addr = d.propertyAddress || '[Property Address]', agent = d.agentName || '[Your Name]'
  return `Hi ${name},\n\nWanted to provide a marketing performance update on ${addr} as we approach week ${d.timeOnMarket || '[#]'} on market. Below is a summary of our activity and the traction we are seeing.\n\n**Online Marketing Performance**\nOur LoopNet listing has generated ${d.loopnetClicks || '[#]'} clicks to date, producing ${d.leadCount || '[#]'} unique leads. Our email campaign achieved a ${d.eblastOpenRate || '[#]'}% open rate with ${d.eblastClicks || '[#]'} click-throughs, which is strong relative to industry benchmarks. The LinkedIn announcement has reached ${d.linkedinImpressions || '[#]'} impressions.\n\n**Lead Intelligence**\n${d.leadNames ? 'Notable leads include: ' + d.leadNames + '.' : 'We are tracking several active leads across our database.'}${d.leadFeedback ? '\n\nFeedback from the market: ' + d.leadFeedback : ''}\n\n**Proactive Outreach**\nOur team has made ${d.totalCalls || '[#]'} outbound calls to targeted buyers and brokers.${d.postcardCount && d.postcardCount !== '0' ? ' We also distributed ' + d.postcardCount + ' direct mail postcards to our targeted owner/investor list.' : ''}${d.toursCompleted ? ' We have completed ' + d.toursCompleted + ' property tours to date.' : ''}\n\n**3rd Party Platforms**\nThe property is live and active on CoStar, LoopNet, Crexi, Craigslist, and Facebook Marketplace. Property signage is in place and generating drive-by inquiries.\n\nI have attached the full LoopNet marketing report and inbound leads sheet for your reference. Let me know if you would like to discuss any of this in more detail.\n\nBest,\n${agent}`
}

function generateMedium(d) {
  const name = d.clientName || '[Client]', addr = d.propertyAddress || '[Property Address]', agent = d.agentName || '[Your Name]'
  return `Hi ${name},\n\nI wanted to check in with a comprehensive update on ${addr} and share where things stand as we continue to work the market.\n\n**Outreach & Activity Summary**\nTo date, our team has made ${d.totalCalls || '[#]'} outbound calls, generated ${d.totalLeads || '[#]'} total leads, and completed ${d.toursCompleted || '[#]'} property tours. We continue to actively canvass the market and follow up with every qualified lead.\n\n**LOI & Offer Activity**\n${d.loiActivity || 'No formal LOIs have been submitted at this time. We are continuing to push for written interest from our most engaged prospects.'}\n\n**Buyer Feedback**\nThis is the most important data point at this stage of the process, as it helps us understand how the market is reacting to the offering and informs our strategy going forward.\n\n${d.buyerFeedback || '[Buyer feedback themes]'}\n\n**Next Steps & Strategy**\n${d.nextSteps || 'We will continue targeted outreach, follow up with all active leads, and reassess our positioning based on the feedback above.'}\n\nI would like to schedule a call this week to walk through everything and discuss strategy. Let me know what works on your end.\n\nBest,\n${agent}`
}

function generateHighDOM(d) {
  const name = d.clientName || '[Client]', addr = d.propertyAddress || '[Property Address]', agent = d.agentName || '[Your Name]', dom = d.timeOnMarket || '[#]'
  return `Hi ${name},\n\nI wanted to provide a comprehensive update on ${addr} and share my honest assessment of where we stand at ${dom} days on market. I want to be transparent with you about what the data is telling us so we can make the best decision together.\n\n**Marketing Performance to Date**\n- LoopNet: ${d.loopnetClicks || '[#]'} clicks, ${d.leadCount || '[#]'} unique leads\n- Email campaign: ${d.eblastOpenRate || '[#]'}% open rate\n- Outbound calls: ${d.totalCalls || '[#]'}\n- Tours completed: ${d.toursCompleted || '[#]'}\n\nThese are solid activity numbers, which tells us the property is getting exposure. The challenge is not visibility — it is conversion.\n\n**Buyer Feedback**\nThe consistent theme from the market has been: ${d.topObjection || '[top objection]'}. This is the primary barrier to moving forward with the buyers we have engaged.\n\n**Competitive Landscape**\nThere are currently ${d.competingListings || '[#]'} competing listings in the submarket, with an average asking price of ${d.avgCompPrice || '[price/PSF]'}. The most recent comparable sale closed at ${d.recentSalePrice || '[price]'} after ${d.recentSaleDom || '[#]'} days on market.\n\nThis market data is important context for our pricing discussion. Buyers are well-informed and using these data points to benchmark their offers.\n\n**Recommendation**\nBased on the totality of feedback, market activity, and competitive data, my recommendation is: **${d.recommendation || '[recommendation]'}**.${d.recommendedPrice ? ' I believe a price of **' + d.recommendedPrice + '** positions us competitively while still delivering a strong result.' : ''}\n\nI know this is a lot of information. I would like to schedule a call to walk through it together and align on next steps. Please let me know your availability.\n\nBest,\n${agent}`
}

function generateClosing(d) {
  const name = d.clientName || '[Client]', addr = d.propertyAddress || '[Property Address]', agent = d.agentName || '[Your Name]'
  const highlight = d.salePrice
    ? `We closed at ${d.salePrice}${d.pricePsf ? ' (' + d.pricePsf + ')' : ''}${d.daysToClose ? ', just ' + d.daysToClose + ' days from listing to close' : ''}.${d.dealHighlight ? ' ' + d.dealHighlight + '.' : ''}`
    : (d.dealHighlight || 'It was a great outcome for everyone involved.')
  return `Hi ${name},\n\nCongratulations — we officially closed on ${addr}${d.closingDate ? ' as of ' + d.closingDate : ''}!\n\n${highlight}\n\nIt was a pleasure working with you through this process. Your trust and responsiveness throughout made all the difference, and I am proud of the result we were able to deliver together.\n\nIf there is anything you need on the post-closing side — estoppels, tenant communications, or anything else — please do not hesitate to reach out. I am always available.\n\nI would also be grateful if you would keep me in mind for any future real estate needs, or if you know anyone who could benefit from the same level of service. Referrals from clients like you mean a great deal.\n\nThank you again, ${name}. Looking forward to staying in touch.\n\nBest regards,\n${agent}`
}

const GENERATORS = { premarket: generatePremarket, early: generateEarly, medium: generateMedium, highdom: generateHighDOM, closing: generateClosing }

export default function EmailGenerators() {
  const [activeTab, setActiveTab] = useState('premarket')
  const [fields, setFields] = useState({ ...DEFAULTS })
  const [copied, setCopied] = useState(false)
  // Per-tab overrides: if a key exists here, it wins over the generated template.
  // Cleared only by "Reset to Template" or tab-specific regenerate.
  const [overrides, setOverrides] = useState({})
  const outputRef = useRef(null)

  const updateField = (key, value) => setFields(prev => ({ ...prev, [key]: value }))

  const generatedEmail = GENERATORS[activeTab] ? GENERATORS[activeTab](fields) : ''
  const isEdited = overrides[activeTab] != null
  const emailOutput = isEdited ? overrides[activeTab] : generatedEmail

  const handleEdit = (e) => {
    setOverrides(prev => ({ ...prev, [activeTab]: e.target.value }))
  }

  const handleReset = () => {
    setOverrides(prev => {
      const next = { ...prev }
      delete next[activeTab]
      return next
    })
  }

  const handleCopy = async () => {
    const output = emailOutput.replace(/\*\*(.+?)\*\*/g, '$1')
    try {
      await navigator.clipboard.writeText(output)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      if (outputRef.current) {
        outputRef.current.focus()
        outputRef.current.select()
      }
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
          <textarea
            ref={outputRef}
            value={emailOutput}
            onChange={handleEdit}
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
              resize: 'none',
              outline: 'none',
              overflowY: 'auto',
              wordWrap: 'break-word',
            }}
          />
        </div>
      </div>
    </div>
  )
}
