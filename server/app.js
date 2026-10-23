import { Hono } from 'hono'
import { MARKETPLACES, configuredSources, productImages, resolveOfferLink, searchAll, validHost } from './sources.js'
import { aiConfigured, analyzeBom, planQuery, scorePlan } from './ai.js'

export const app = new Hono()

function offerKey(offer) {
  try {
    const u = new URL(offer.url)
    u.hash = ''
    for (const key of [...u.searchParams.keys()]) {
      if (/^(utm_|gclid$|fbclid$|ref$)/i.test(key)) u.searchParams.delete(key)
    }
    return `${offer.source}|${u.href.replace(/\/$/, '')}|${offer.price}`
  } catch {
    return `${offer.source}|${offer.title}|${offer.price}`
  }
}

function mergeOffers(base, extra) {
  const seen = new Set()
  const out = []
  for (const offer of [...base, ...extra]) {
    const key = offerKey(offer)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(offer)
  }
  return out
}

app.get('/api/sources', (c) =>
  c.json({
    mode: 'live',
    sources: configuredSources().map(({ id, name, domain, ship, aggregator }) => ({
      id,
      name,
      domain,
      ship,
      aggregator: Boolean(aggregator)
    })),
    marketplaces: MARKETPLACES.map(({ id, name, domain }) => ({ id, name, domain }))
  })
)

app.get('/api/images', async (c) => {
  const url = (c.req.query('url') || '').slice(0, 800)
  const images = await productImages(url)
  return c.json({ images })
})

// Google Shopping product page, used when the merchant page cannot be resolved.
function shoppingFallback(raw) {
  try {
    const u = new URL(String(raw || ''))
    if (u.protocol !== 'https:') return null
    if (!/^(www\.)?google\.(com|co\.in)$/i.test(u.hostname)) return null
    const productPage = u.pathname.startsWith('/shopping')
    const shoppingSearch = u.pathname === '/search' && u.searchParams.get('ibp') === 'oshop'
    return productPage || shoppingSearch ? u.toString() : null
  } catch {
    return null
  }
}

app.get('/api/merchant-link', async (c) => {
  const fallback = shoppingFallback(c.req.query('fallback'))
  const direct = await resolveOfferLink(c.req.query('id'))
  return c.redirect(direct || fallback || '/', 302)
})

// The AI review only rephrases optimizer facts; it never adds products or prices.
app.post('/api/ai/bom', async (c) => {
  if (!aiConfigured()) return c.json({ analysis: null })
  const facts = await c.req.json().catch(() => null)
  const analysis = facts ? await analyzeBom(facts) : null
  return c.json({ analysis })
})

app.get('/api/search', async (c) => {
  const q = (c.req.query('q') || '').trim().slice(0, 120)
  if (q.length < 2) return c.json({ error: 'query too short' }, 400)
  const custom = (c.req.query('custom') || '')
    .split(',')
    .map(validHost)
    .filter(Boolean)
    .slice(0, 8)
  const started = Date.now()
  try {
    const [base, plan] = await Promise.all([searchAll(q, { custom }), planQuery(q)])
    let offers = base.offers
    let sources = base.sources
    let ai = null

    if (plan) {
      let added = 0
      if (plan.queries.length) {
        try {
          const expanded = await Promise.all(
            plan.queries.map((alt) => searchAll(alt, { custom, includeAggregators: false }))
          )
          const merged = mergeOffers(offers, expanded.flatMap((r) => r.offers))
          added = merged.length - offers.length
          offers = merged
        } catch {
          // Expansion is best-effort; the base results still stand.
        }
      }

      const counts = new Map()
      for (const offer of offers) counts.set(offer.source, (counts.get(offer.source) || 0) + 1)
      sources = sources.map((s) => ({ ...s, count: counts.get(s.id) ?? s.count }))
      offers = offers.map((offer) => ({ ...offer, aiScore: scorePlan(offer.title, plan) }))
      ai = {
        used: true,
        intent: plan.intent,
        terms: plan.terms,
        queries: plan.queries,
        added
      }
    }

    return c.json({ ...base, offers, sources, ai, took: Date.now() - started })
  } catch (e) {
    console.error('search failed:', e)
    return c.json({ error: 'Live search failed. Please try again.' }, 502)
  }
})
