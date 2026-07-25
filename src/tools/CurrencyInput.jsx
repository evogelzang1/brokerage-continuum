import { useState, useCallback } from 'react'
import s from './shared.module.css'

const fmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

export default function CurrencyInput({
  label, hint, value, onChange,
  prefix = '$', suffix, disabled,
  compact, className, title, placeholder,
}) {
  const [focused, setFocused] = useState(false)
  const [rawText, setRawText] = useState('')

  const formatted = compact
    ? (value === 0 ? '0' : (value ? String(value) : ''))
    : (value ? `${prefix}${fmt.format(value)}${suffix || ''}` : '')
  const display = focused ? rawText : formatted

  const handleChange = useCallback(e => {
    const raw = e.target.value.replace(/[^0-9.]/g, '')
    setRawText(raw)
    const num = raw === '' ? 0 : parseFloat(raw)
    if (!isNaN(num)) onChange(num)
  }, [onChange])

  const inputEl = (
    <input
      className={compact ? className : s.input}
      type="text"
      inputMode="decimal"
      value={display}
      placeholder={placeholder ?? `${prefix}0`}
      title={title}
      onChange={handleChange}
      onFocus={() => { setFocused(true); setRawText(value === 0 ? '' : String(value)) }}
      onBlur={() => setFocused(false)}
      disabled={disabled}
    />
  )

  if (compact) return inputEl

  return (
    <div className={s.fieldGroup}>
      <label className={s.label}>{label}</label>
      {inputEl}
      {hint && <div className={s.hint}>{hint}</div>}
    </div>
  )
}
