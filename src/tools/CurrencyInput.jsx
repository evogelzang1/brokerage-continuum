import { useState, useCallback } from 'react'
import s from './shared.module.css'

const fmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

export default function CurrencyInput({ label, value, onChange, prefix = '$', suffix, disabled }) {
  const [focused, setFocused] = useState(false)
  const [rawText, setRawText] = useState('')

  const display = focused
    ? rawText
    : value ? `${prefix}${fmt.format(value)}${suffix || ''}` : ''

  const handleChange = useCallback(e => {
    const raw = e.target.value.replace(/[^0-9.]/g, '')
    setRawText(raw)
    const num = raw === '' ? 0 : parseFloat(raw)
    if (!isNaN(num)) onChange(num)
  }, [onChange])

  return (
    <div className={s.fieldGroup}>
      <label className={s.label}>{label}</label>
      <input
        className={s.input}
        type="text"
        inputMode="decimal"
        value={display}
        placeholder={`${prefix}0`}
        onChange={handleChange}
        onFocus={() => { setFocused(true); setRawText(value === 0 ? '' : String(value)) }}
        onBlur={() => setFocused(false)}
        disabled={disabled}
      />
    </div>
  )
}
