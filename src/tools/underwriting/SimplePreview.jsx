import s from '../shared.module.css'

// Matches the print output exactly — same colors, same layout
const printStyles = {
  wrap: {
    background: '#fff',
    color: '#1a1a1a',
    fontFamily: "'Inter', -apple-system, sans-serif",
    fontSize: 9.5,
    lineHeight: 1.35,
    padding: '14px 18px',
  },
  banner: {
    background: '#101828',
    color: '#fff',
    padding: '8px 14px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 3,
    marginBottom: 4,
  },
  bannerTitle: { fontSize: 13, margin: 0, fontWeight: 700, letterSpacing: '0.02em' },
  bannerSub: { fontSize: 8, opacity: 0.75 },
  meta: { fontSize: 9, color: '#6e7378', marginBottom: 10 },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  section: {
    fontSize: 9,
    fontWeight: 700,
    color: '#0969da',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    borderBottom: '1px solid #d0d7de',
    padding: '4px 0 2px',
    margin: '8px 0 3px',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '2px 4px',
    fontSize: 9.5,
    lineHeight: 1.3,
  },
  rowAlt: { background: '#f5f7fa' },
  rowLabel: { color: '#6e7378' },
  rowValue: { fontWeight: 600 },
  footer: {
    marginTop: 10,
    fontSize: 7.5,
    color: '#999',
    borderTop: '1px solid #d0d7de',
    paddingTop: 4,
    textAlign: 'center',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-hover)',
  },
  headerTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  previewOuter: {
    width: 420,
    flexShrink: 0,
    border: '1px solid var(--border)',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'sticky',
    top: 0,
    background: '#fff',
  },
  previewBody: { maxHeight: 700, overflowY: 'auto' },
}

export default function SimplePreview({ title, subtitle, inputs, outputs, onExport }) {
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div style={printStyles.previewOuter}>
      <div style={printStyles.header}>
        <span style={printStyles.headerTitle}>PDF Preview</span>
        <button className={s.btnPrimary} onClick={onExport}>Export PDF</button>
      </div>
      <div style={printStyles.previewBody}>
        <div style={printStyles.wrap}>
          <div style={printStyles.banner}>
            <h1 style={printStyles.bannerTitle}>{title.toUpperCase()}</h1>
            <span style={printStyles.bannerSub}>Matthews Real Estate Investment Services</span>
          </div>
          <div style={printStyles.meta}>{subtitle ? `${subtitle} — ${dateStr}` : dateStr}</div>

          <div style={printStyles.twoCol}>
            <div>
              <div style={printStyles.section}>Assumptions</div>
              {inputs.map((r, i) => (
                <div key={r.label} style={{ ...printStyles.row, ...(i % 2 ? printStyles.rowAlt : {}) }}>
                  <span style={printStyles.rowLabel}>{r.label}</span>
                  <span style={printStyles.rowValue}>{r.value}</span>
                </div>
              ))}
            </div>
            <div>
              <div style={printStyles.section}>Results</div>
              {outputs.map((r, i) => (
                <div key={r.label} style={{ ...printStyles.row, ...(i % 2 ? printStyles.rowAlt : {}) }}>
                  <span style={printStyles.rowLabel}>{r.label}</span>
                  <span style={printStyles.rowValue}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={printStyles.footer}>
            For analysis purposes only. Consult a qualified tax/legal professional. — Matthews REIS
          </div>
        </div>
      </div>
    </div>
  )
}
