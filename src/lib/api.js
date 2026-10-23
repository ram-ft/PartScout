const cache = new Map()

/** Search every source for a part. Results are kept for the session. */
export async function search(q, custom = [], { force = false } = {}) {
  const key = `${q.toLowerCase()}|${custom.join(',')}`
  if (!force && cache.has(key)) return cache.get(key)
  const params = new URLSearchParams({ q })
  if (custom.length) params.set('custom', custom.join(','))
  let res
  try {
    res = await fetch(`/api/search?${params}`)
  } catch {
    throw new Error('Search service is unreachable. Restart the app with npm run dev.')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(
      body.error ||
        (res.status === 500 || res.status === 502
          ? 'Search service is unavailable right now. Please try again.'
          : `Request failed (${res.status})`)
    )
  }
  const data = await res.json()
  cache.set(key, data)
  return data
}

export async function fetchSources() {
  const res = await fetch('/api/sources')
  if (!res.ok) throw new Error('Could not load sources')
  return res.json()
}

/** Extra gallery images for a live shop product page. */
export async function fetchImages(url) {
  try {
    const res = await fetch(`/api/images?url=${encodeURIComponent(url)}`)
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data.images) ? data.images : []
  } catch {
    return []
  }
}

const aiCache = new Map()
const AI_CACHE_LIMIT = 20

async function postAi(path, facts, field) {
  const key = `${path}|${JSON.stringify(facts)}`
  if (aiCache.has(key)) return aiCache.get(key)
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(facts)
    })
    if (!res.ok) return null
    const data = await res.json()
    const value = data?.[field] ?? null
    if (value) {
      if (aiCache.size >= AI_CACHE_LIMIT) aiCache.delete(aiCache.keys().next().value)
      aiCache.set(key, value)
    }
    return value
  } catch {
    return null
  }
}

/** Grounded review of a shortlist's optimizer result. */
export function fetchBomReview(facts) {
  return postAi('/api/ai/bom', facts, 'analysis')
}
