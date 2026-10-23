// Pack-size detection and text matching shared by every source adapter.

const PACK_PATTERNS = [
  /\b(?:pack|set|lot|bag|box|kit)\s*(?:of)?\s*(\d{1,5})\b/i,
  /\b(\d{1,5})\s*(?:pcs|pc|pieces|piece|nos|units|unit)\b/i,
  /\(\s*(\d{1,5})\s*\)\s*$/ // trailing "(100)"
]

/** Returns how many individual units one listing contains (1 when unknown). */
export function detectPackSize(title) {
  for (const re of PACK_PATTERNS) {
    const m = title.match(re)
    if (m) {
      const n = Number(m[1])
      if (n >= 1 && n <= 10000) return n
    }
  }
  return 1
}

const compact = (s) => s.toLowerCase().replace(/[^a-z0-9.]/g, '')

/**
 * 0..1 score of how many query tokens appear in the title.
 * Hyphens and spaces are ignored so "ESP-32" and "ESP32" match each other.
 */
export function relevance(query, title) {
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9.]+/)
    .filter(Boolean)
  if (!tokens.length) return 0
  const hay = compact(title)
  const hit = tokens.filter((t) => hay.includes(compact(t))).length
  return hit / tokens.length
}

export function toOffer(source, raw, query) {
  const packSize = detectPackSize(raw.title)
  const price = Number(raw.price)
  if (!Number.isFinite(price) || price <= 0) return null
  const images = [...new Set([raw.image, ...(Array.isArray(raw.images) ? raw.images : [])]
    .filter((u) => typeof u === 'string' && /^https?:\/\//i.test(u)))]
    .slice(0, 12)
  return {
    id: `${source.id}|${raw.id || raw.url}|${raw.title}|${price}`,
    source: source.id,
    sourceName: raw.sourceName || source.name,
    via: raw.via || null,
    title: raw.title.trim(),
    url: raw.url,
    image: images[0] || null,
    images,
    price,
    packSize,
    unitPrice: price / packSize,
    inStock: raw.inStock !== false,
    relevance: relevance(query, raw.title)
  }
}
