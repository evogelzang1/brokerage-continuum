import s from '../shared.module.css'
import styles from './exchange.module.css'

export default function SimplePreview({ title, subtitle, inputs, outputs, onExport }) {
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  return (
    <div className={styles.preview}>
      <div className={styles.previewHeader}>
        <span className={styles.previewTitle}>PDF Preview</span>
        <button className={s.btnPrimary} onClick={onExport}>Export PDF</button>
      </div>
      <div className={styles.previewBody}>
        <div className={styles.pvBanner}>
          <span className={styles.pvBannerTitle}>{title.toUpperCase()}</span>
          <span className={styles.pvBannerSub}>Matthews Real Estate Investment Services</span>
        </div>
        <div className={styles.pvMeta}>{subtitle ? `${subtitle} — ${dateStr}` : dateStr}</div>

        <div className={styles.pvSection}>ASSUMPTIONS</div>
        <div className={styles.pvRows}>
          {inputs.map(({ label, value }) => (
            <div key={label} className={styles.pvRow}>
              <span>{label}</span><span>{value}</span>
            </div>
          ))}
        </div>

        <div className={styles.pvSection}>RESULTS</div>
        <div className={styles.pvRows}>
          {outputs.map(({ label, value, highlight }, i, arr) => (
            <div key={label} className={`${styles.pvRow} ${highlight || i === arr.length - 1 ? styles.pvRowHL : ''}`}>
              <span>{label}</span><span>{value}</span>
            </div>
          ))}
        </div>

        <div className={styles.pvFooter}>For analysis purposes only. Consult a qualified tax/legal professional.</div>
      </div>
    </div>
  )
}
