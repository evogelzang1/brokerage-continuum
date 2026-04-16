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
@page{margin:.6in}body{font-family:'Inter',-apple-system,sans-serif;color:#1a1a1a;max-width:720px;margin:0 auto;padding:30px;line-height:1.5;font-size:11px}
.banner{background:#101828;color:#fff;padding:12px 18px;display:flex;justify-content:space-between;align-items:center;border-radius:4px;margin-bottom:6px}
.banner h1{font-size:15px;margin:0}.banner span{font-size:9px;opacity:.7}
.meta{font-size:10px;color:#6e7378;margin-bottom:16px}
.section{font-size:10px;font-weight:700;color:#00529b;text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid #d0d7de;padding:6px 0 3px;margin:14px 0 6px}
.row{display:flex;justify-content:space-between;padding:3px 4px;font-size:11px}.row:nth-child(even){background:#f5f7fa}
.row span:first-child{color:#6e7378}.row span:last-child{font-weight:600}
.footer{margin-top:24px;font-size:8px;color:#999;border-top:1px solid #d0d7de;padding-top:6px}
</style></head><body>
<div class="banner"><h1>${escapeHtml(title.toUpperCase())}</h1><span>Matthews Real Estate Investment Services</span></div>
<div class="meta">${subtitle ? escapeHtml(subtitle) + ' — ' : ''}${escapeHtml(dateStr)}</div>
<div class="section">ASSUMPTIONS</div>
${inputs.map(r => `<div class="row"><span>${escapeHtml(r.label)}</span><span>${escapeHtml(r.value)}</span></div>`).join('')}
<div class="section">RESULTS</div>
${outputs.map(r => `<div class="row"><span>${escapeHtml(r.label)}</span><span>${escapeHtml(r.value)}</span></div>`).join('')}
<div class="footer">${escapeHtml(note)} &mdash; Matthews REIS</div>
</body></html>`

  openHtml(html)
}
