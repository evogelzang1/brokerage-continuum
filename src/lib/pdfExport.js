export function escapeHtml(str) {
  if (typeof str !== 'string') return String(str ?? '')
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function openHtml(html) {
  const w = window.open('', '_blank')
  if (w) {
    w.document.write(html)
    w.document.close()
    w.document.title = ' '
    w.focus()
    setTimeout(() => w.print(), 300)
  } else {
    alert('Popup blocked — please allow popups to export PDF.')
  }
}

export function exportToolPdf({ title, subtitle, inputs, outputs, footnotes }) {
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const note = footnotes || 'For analysis purposes only. Consult a qualified tax/legal professional before making investment decisions.'

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title> </title>
<style>
@page{size:letter;margin:0}
*{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
html,body{margin:0;padding:0}
body{font-family:'Inter',-apple-system,sans-serif;color:#1a1a1a;line-height:1.25;font-size:8.5px;padding:.3in}
.wrap{max-width:100%;margin:0 auto;padding:0}
.banner{background:#101828;color:#fff;padding:6px 12px;display:flex;justify-content:space-between;align-items:center;border-radius:3px;margin-bottom:3px}
.banner h1{font-size:12px;margin:0;font-weight:700;letter-spacing:.02em}
.banner span{font-size:7.5px;opacity:.75}
.meta{font-size:8.5px;color:#6e7378;margin-bottom:6px}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.section{font-size:8.5px;font-weight:700;color:#0969da;text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid #d0d7de;padding:3px 0 1px;margin:5px 0 2px}
.row{display:flex;justify-content:space-between;padding:1.5px 4px;font-size:8.5px;line-height:1.25}
.row:nth-child(even){background:#f5f7fa}
.row span:first-child{color:#6e7378}.row span:last-child{font-weight:600}
.footer{margin-top:6px;font-size:7px;color:#999;border-top:1px solid #d0d7de;padding-top:3px;text-align:center}
</style></head><body><div class="wrap">
<div class="banner"><h1>${escapeHtml(title.toUpperCase())}</h1><span>Matthews Real Estate Investment Services</span></div>
<div class="meta">${subtitle ? escapeHtml(subtitle) + ' — ' : ''}${escapeHtml(dateStr)}</div>
<div class="two-col">
<div>
<div class="section">Assumptions</div>
${inputs.map(r => `<div class="row"><span>${escapeHtml(r.label)}</span><span>${escapeHtml(r.value)}</span></div>`).join('')}
</div>
<div>
<div class="section">Results</div>
${outputs.map(r => `<div class="row"><span>${escapeHtml(r.label)}</span><span>${escapeHtml(r.value)}</span></div>`).join('')}
</div>
</div>
<div class="footer">${escapeHtml(note)} — Matthews REIS</div>
</div></body></html>`

  openHtml(html)
}
