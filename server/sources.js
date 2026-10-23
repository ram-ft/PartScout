import { createHash } from 'node:crypto'
import { toOffer } from './pack.js'

try {
  process.loadEnvFile()
} catch {}

// Shops with a public product search endpoint. "kind" says which storefront
// API to try first; "auto" tries Shopify then WooCommerce.
export const SOURCES = [
  { id: 'robocraze', name: 'Robocraze', domain: 'robocraze.com', kind: 'auto', ship: { flat: 60, freeAbove: 499 } },
  { id: 'thinkrobotics', name: 'ThinkRobotics', domain: 'thinkrobotics.com', kind: 'auto', ship: { flat: 60, freeAbove: 499 } },
  { id: 'quartz', name: 'Quartz Components', domain: 'quartzcomponents.com', kind: 'auto', ship: { flat: 60, freeAbove: 499 } }
]

// Marketplace listings from Google Shopping via SerpAPI, enabled when a key is
// configured. Shipping is not quoted by the feed, so it is excluded from totals.
export const GOOGLE_SHOPPING = {
  id: 'googleshopping',
  name: 'Google Shopping',
  domain: 'google.com',
  kind: 'serpapi',
  aggregator: true,
  ship: { flat: 0, freeAbove: 0 }
}

export function configuredSources() {
  return process.env.SERPAPI_KEY ? [...SOURCES, GOOGLE_SHOPPING] : [...SOURCES]
}

// Marketplaces and stores that do not expose a product search API. They sit in
// the same shops list as the live connectors and open the query on site.
export const MARKETPLACES = [
  { id: 'amazon', name: 'Amazon', domain: 'amazon.in', url: (q) => `https://www.amazon.in/s?k=${encodeURIComponent(q)}` },
  { id: 'flipkart', name: 'Flipkart', domain: 'flipkart.com', url: (q) => `https://www.flipkart.com/search?q=${encodeURIComponent(q)}` },
  { id: 'robu', name: 'Robu', domain: 'robu.in', url: (q) => `https://robu.in/?s=${encodeURIComponent(q)}&post_type=product` },
  { id: 'evelta', name: 'Evelta', domain: 'evelta.com', url: (q) => `https://evelta.com/search.php?search_query=${encodeURIComponent(q)}` },
  { id: 'sunrom', name: 'Sunrom', domain: 'sunrom.com', url: (q) => `https://www.sunrom.com/search?q=${encodeURIComponent(q)}` },
  { id: 'indiamart', name: 'IndiaMART', domain: 'indiamart.com', url: (q) => `https://dir.indiamart.com/search.mp?ss=${encodeURIComponent(q)}` },
  { id: 'lcsc', name: 'LCSC', domain: 'lcsc.com', url: (q) => `https://www.lcsc.com/search?q=${encodeURIComponent(q)}` },
  { id: 'mouser', name: 'Mouser', domain: 'mouser.in', url: (q) => `https://www.mouser.in/c/?q=${encodeURIComponent(q)}` },
  { id: 'digikey', name: 'DigiKey', domain: 'digikey.in', url: (q) => `https://www.digikey.in/en/products/result?keywords=${encodeURIComponent(q)}` }
]

const HOST_RE = /^(?=.{4,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/i

/** Accepts only plain public-looking hostnames (no IPs, no localhost). */
export function validHost(host) {
  const h = String(host || '').trim().toLowerCase()
  if (!HOST_RE.test(h)) return null
  if (/^\d+(\.\d+){3}$/.test(h)) return null
  if (/(^|\.)(localhost|local|internal|lan|home)$/.test(h)) return null
  return h
}

export function customSource(host) {
  const domain = validHost(host)
  if (!domain) return null
  return { id: domain, name: domain, domain, kind: 'auto', ship: { flat: 60, freeAbove: 500 }, custom: true }
}

const HEADERS = { 'user-agent': 'PartScout/0.1 (personal price comparison)', accept: 'application/json' }
const TIMEOUT = 6000

async function getJson(url, timeout = TIMEOUT) {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(timeout) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const type = res.headers.get('content-type') || ''
  if (!type.includes('json')) throw new Error('not json')
  return res.json()
}

// Shopify serves product.js as text/javascript even though the body is JSON.
async function getJsonAny(url, timeout = TIMEOUT) {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(timeout) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

function shoppingPrice(p) {
  const extracted = Number(p.extracted_price)
  if (Number.isFinite(extracted) && extracted > 0) return extracted
  const text = String(p.price || '')
  if (!/₹|Rs\.?|INR/i.test(text)) return NaN
  const value = Number(text.replace(/[^\d.]/g, ''))
  return Number.isFinite(value) && value > 0 ? value : NaN
}

const MERCHANT_NAMES = {
  amazon: 'Amazon',
  flipkart: 'Flipkart',
  robu: 'Robu',
  evelta: 'Evelta',
  sunrom: 'Sunrom',
  indiamart: 'IndiaMART',
  lcsc: 'LCSC',
  mouser: 'Mouser',
  digikey: 'DigiKey'
}

function merchantName(raw) {
  const name = String(raw || '').trim()
  const lower = name.toLowerCase()
  for (const [needle, label] of Object.entries(MERCHANT_NAMES)) {
    if (lower.includes(needle)) return label
  }
  return name || 'Google Shopping'
}

const MERCHANT_HOSTS = {
  Amazon: 'amazon.in',
  Flipkart: 'flipkart.com',
  Robu: 'robu.in',
  Evelta: 'evelta.com',
  Sunrom: 'sunrom.com',
  IndiaMART: 'indiamart.com',
  LCSC: 'lcsc.com',
  Mouser: 'mouser.in',
  DigiKey: 'digikey.in'
}

// Google Shopping rarely exposes a merchant URL, so each offer gets a short
// id. On click the server resolves the exact product page via the immersive
// product API (one SerpAPI credit) and redirects there, or to the Google page.
const linkTokens = new Map()
const resolvedLinks = new Map()
const resolvingLinks = new Map()
const LINK_TTL = 6 * 60 * 60 * 1000
const RESOLVED_TTL = 6 * 60 * 60 * 1000
const RESOLVE_ERROR_TTL = 2 * 60 * 1000
const LINK_LIMIT = 500

function linkId(token, merchant) {
  return createHash('sha256').update(`${token}|${merchant}`).digest('base64url').slice(0, 22)
}

function hostMatches(host, domain) {
  const h = String(host || '').toLowerCase().replace(/^www\./, '')
  return h === domain || h.endsWith(`.${domain}`)
}

function pruneLinks(store) {
  if (store.size <= LINK_LIMIT) return
  const drop = [...store.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, store.size - LINK_LIMIT)
  for (const [key] of drop) store.delete(key)
}

function registerOfferLink(token, merchant, fallback) {
  if (!MERCHANT_HOSTS[merchant] || typeof token !== 'string' || token.length < 20 || token.length > 4000) {
    return fallback
  }
  const id = linkId(token, merchant)
  linkTokens.set(id, { token, merchant, at: Date.now() })
  pruneLinks(linkTokens)
  return `/api/merchant-link?id=${id}&fallback=${encodeURIComponent(fallback)}`
}

/** Resolve one offer to its merchant product page, or null. */
export function resolveOfferLink(rawId) {
  const id = String(rawId || '').trim().slice(0, 40)
  const entry = linkTokens.get(id)
  if (!entry || Date.now() - entry.at > LINK_TTL) return Promise.resolve(null)

  const hit = resolvedLinks.get(id)
  if (hit && Date.now() - hit.at < hit.ttl) return Promise.resolve(hit.url)
  if (resolvingLinks.has(id)) return resolvingLinks.get(id)

  const key = process.env.SERPAPI_KEY
  const domain = MERCHANT_HOSTS[entry.merchant]
  const task = (async () => {
    if (!key || !domain) return null
    const url =
      'https://serpapi.com/search.json?engine=google_immersive_product' +
      `&page_token=${encodeURIComponent(entry.token)}&gl=in&hl=en&api_key=${encodeURIComponent(key)}`
    const data = await getJson(url, 10000)
    if (data?.error) throw new Error(String(data.error).slice(0, 140))
    const stores = Array.isArray(data?.product_results?.stores) ? data.product_results.stores : []
    for (const store of stores) {
      try {
        const link = new URL(store?.link)
        if (link.protocol === 'https:' && hostMatches(link.hostname, domain)) return link.toString()
      } catch {}
    }
    return null
  })()
    .then((url) => {
      resolvedLinks.set(id, { url, at: Date.now(), ttl: url ? RESOLVED_TTL : RESOLVE_ERROR_TTL })
      pruneLinks(resolvedLinks)
      return url
    })
    .catch(() => {
      resolvedLinks.set(id, { url: null, at: Date.now(), ttl: RESOLVE_ERROR_TTL })
      pruneLinks(resolvedLinks)
      return null
    })
    .finally(() => resolvingLinks.delete(id))

  resolvingLinks.set(id, task)
  return task
}

async function serpapiShopping(source, q) {
  const key = process.env.SERPAPI_KEY
  if (!key) throw new Error('SERPAPI_KEY is not configured')
  const url =
    'https://serpapi.com/search.json?engine=google_shopping' +
    `&q=${encodeURIComponent(q)}&gl=in&hl=en&api_key=${encodeURIComponent(key)}`
  const data = await getJson(url, 10000)
  if (data?.error) throw new Error(String(data.error).slice(0, 140))
  const results = Array.isArray(data?.shopping_results) ? data.shopping_results : []
  return results
    .map((p) => {
      const price = shoppingPrice(p)
      const link = p.product_link || p.link
      if (!p?.title || !link || !Number.isFinite(price)) return null
      const sourceName = merchantName(p.source)
      return {
        id: p.product_id || p.immersive_product_page_token || `${p.position ?? ''}|${p.source ?? ''}|${p.title}`,
        title: p.title,
        price,
        url: registerOfferLink(p.immersive_product_page_token, sourceName, link),
        image: p.thumbnail || null,
        inStock: !/out of stock|sold out/i.test(p.tag || ''),
        sourceName,
        via: source.name
      }
    })
    .filter(Boolean)
}

async function shopify(source, q) {
  const url =
    `https://${source.domain}/search/suggest.json?q=${encodeURIComponent(q)}` +
    `&resources[type]=product&resources[limit]=12&resources[options][unavailable_products]=last`
  const data = await getJson(url)
  const products = data?.resources?.results?.products
  if (!Array.isArray(products)) throw new Error('unexpected shape')
  return products.map((p) => ({
    title: p.title,
    price: parseFloat(p.price),
    url: new URL(p.url, `https://${source.domain}`).toString(),
    image: p.image || p.featured_image?.url || null,
    inStock: p.available !== false
  }))
}

async function woo(source, q) {
  const url = `https://${source.domain}/wp-json/wc/store/v1/products?search=${encodeURIComponent(q)}&per_page=12`
  const data = await getJson(url)
  if (!Array.isArray(data)) throw new Error('unexpected shape')
  return data.map((p) => {
    const minor = p.prices?.currency_minor_unit ?? 2
    return {
      title: p.name,
      price: Number(p.prices?.price) / 10 ** minor,
      url: p.permalink,
      image: p.images?.[0]?.src || null,
      images: (p.images || []).map((img) => img?.src).filter(Boolean),
      inStock: p.is_in_stock !== false
    }
  })
}

async function live(source, q) {
  if (source.kind === 'serpapi') return serpapiShopping(source, q)
  const order = source.kind === 'woo' ? [woo] : source.kind === 'shopify' ? [shopify] : [shopify, woo]
  let last
  for (const fn of order) {
    try {
      return await fn(source, q)
    } catch (e) {
      last = e
    }
  }
  throw last || new Error('unsupported source')
}

const cache = new Map() // key -> { at, value }
const TTL = 5 * 60 * 1000
const ERROR_TTL = 60 * 1000
/** Query one live shop. Never substitutes sample rows. */
export async function querySource(source, q) {
  const key = `${source.id}|${q.toLowerCase()}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < hit.ttl) return hit.value

  const started = Date.now()
  let rows = []
  let state = 'live'
  let error
  try {
    rows = await live(source, q)
  } catch (e) {
    error = e.message || 'unreachable'
    state = 'error'
  }

  const offers = rows
    .map((r) => toOffer(source, r, q))
    .filter((o) => o && o.relevance >= 0.75)
  const value = {
    offers,
    status: {
      id: source.id,
      name: source.name,
      state,
      count: offers.length,
      ms: Date.now() - started,
      error
    }
  }
  cache.set(key, {
    at: Date.now(),
    ttl: state === 'live' ? (source.aggregator ? 10 * 60 * 1000 : TTL) : source.aggregator ? 2 * 60 * 1000 : ERROR_TTL,
    value
  })
  return value
}

export async function searchAll(q, { custom = [], includeAggregators = true } = {}) {
  const sources = [
    ...configuredSources(),
    ...custom.map(customSource).filter(Boolean)
  ].filter((s) => includeAggregators || !s.aggregator)
  const results = await Promise.all(sources.map((s) => querySource(s, q)))
  return {
    q,
    offers: results.flatMap((r) => r.offers),
    sources: results.map((r) => r.status),
    marketplaces: MARKETPLACES.map(({ id, name, domain, url }) => ({ id, name, domain, url: url(q) }))
  }
}

const imageCache = new Map() // product URL -> { at, images }
const IMAGE_TTL = 30 * 60 * 1000
const SOURCE_HOSTS = new Set(SOURCES.map((s) => s.domain))

function cleanImages(list, origin = '') {
  const out = []
  for (const item of list) {
    let src = typeof item === 'string' ? item : item?.src
    if (typeof src !== 'string') continue
    if (src.startsWith('//')) src = `https:${src}`
    else if (src.startsWith('/') && origin) src = `${origin}${src}`
    if (!/^https?:\/\//i.test(src) || out.includes(src)) continue
    out.push(src)
    if (out.length >= 12) break
  }
  return out
}

/**
 * All published images for a product on one of the live shops. Uses the shop's
 * own storefront JSON (Shopify product.js / Woo Store API), never HTML scraping.
 */
export async function productImages(rawUrl) {
  let u
  try {
    u = new URL(String(rawUrl || ''))
  } catch {
    return []
  }
  if (u.protocol !== 'https:' || !SOURCE_HOSTS.has(u.hostname.toLowerCase())) return []

  const cacheKey = `${u.hostname}${u.pathname}`
  const cached = imageCache.get(cacheKey)
  if (cached && Date.now() - cached.at < IMAGE_TTL) return cached.images

  let images = []
  const shopify = u.pathname.match(/\/products\/([^/]+?)(?:\.js)?\/?$/)
  if (shopify) {
    const prefix = u.pathname.slice(0, u.pathname.indexOf('/products/'))
    for (const base of [prefix, '']) {
      try {
        const data = await getJsonAny(`${u.origin}${base}/products/${shopify[1]}.js`)
        images = cleanImages(Array.isArray(data?.images) ? data.images : [], u.origin)
        if (images.length) break
      } catch {}
    }
  }

  if (!images.length) {
    const woo = u.pathname.match(/^(?:.*\/)?product\/([^/]+)\/?$/)
    if (woo) {
      try {
        const data = await getJson(
          `${u.origin}/wp-json/wc/store/v1/products?slug=${encodeURIComponent(woo[1])}&per_page=1`
        )
        const product = Array.isArray(data) ? data[0] : null
        images = cleanImages(Array.isArray(product?.images) ? product.images : [], u.origin)
      } catch {}
    }
  }

  imageCache.set(cacheKey, { at: Date.now(), images })
  return images
}
