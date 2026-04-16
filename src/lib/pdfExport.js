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
    w.focus()
    setTimeout(() => w.print(), 300)
  } else {
    alert('Popup blocked — please allow popups to export PDF.')
  }
}

export function exportToolPdf({ title, subtitle, inputs, outputs, footnotes }) {
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const note = footnotes || 'For analysis purposes only. Consult a qualified tax/legal professional before making investment decisions.'

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
@page{size:letter;margin:.35in}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:'Inter',-apple-system,sans-serif;color:#1a1a1a;line-height:1.35;font-size:9.5px;padding:0}
.wrap{max-width:7.8in;margin:0 auto;padding:0}
.banner{background:#101828;color:#fff;padding:8px 14px;display:flex;justify-content:space-between;align-items:center;border-radius:3px;margin-bottom:4px}
.banner h1{font-size:13px;margin:0;font-weight:700;letter-spacing:.02em}
.banner span{font-size:8px;opacity:.75}
.meta{font-size:9px;color:#6e7378;margin-bottom:10px}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.section{font-size:9px;font-weight:700;color:#0969da;text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid #d0d7de;padding:4px 0 2px;margin:8px 0 3px}
.row{display:flex;justify-content:space-between;padding:2px 4px;font-size:9.5px;line-height:1.3}
.row:nth-child(even){background:#f5f7fa}
.row span:first-child{color:#6e7378}.row span:last-child{font-weight:600}
.footer{margin-top:10px;font-size:7.5px;color:#999;border-top:1px solid #d0d7de;padding-top:4px;text-align:center}
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
