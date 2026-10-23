const whole = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const fine = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Rupees. Small amounts keep paise so per-piece prices stay readable. */
export function inr(v) {
  if (v == null || Number.isNaN(v)) return '-'
  return Math.abs(v) < 100 && !Number.isInteger(v) ? fine.format(v) : whole.format(Math.round(v))
}

export function readableOn(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return '#ffffff'
  const n = parseInt(m[1], 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? '#111111' : '#ffffff'
}
