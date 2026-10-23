import { fetchSources } from './api.js'
import { readableOn } from './format.js'

const KEY = 'partscout.settings.v1'
const LIST_KEY = 'partscout.shortlist.v1'
const DEFAULT_ACCENT = '#b65a36'

const defaults = {
  theme: 'system', // system | light | dark
  accent: DEFAULT_ACCENT,
  density: 'comfortable', // comfortable | compact
  radius: 'soft', // sharp | soft | round
  fontScale: 100,
  layout: 'table', // table | grid
  sort: 'total', // total | unit | pack | relevance
  inStockOnly: true,
  showImages: true,
  includeShipping: true,
  minPrice: '',
  maxPrice: '',
  columns: { source: true, pack: true, unit: true, total: true, stock: true },
  disabledSources: [],
  disabledMarketplaces: [],
  ship: {}, // sourceId -> { flat, freeAbove } overrides
  customDomains: [],
  showLinkouts: true,
  recent: [],
  saved: []
}

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

const stored = read(KEY, {})
const LEGACY_ACCENTS = ['#6366f1', '#4f46e5', '#818cf8', '#8b5cf6']
if (LEGACY_ACCENTS.includes(String(stored.accent).toLowerCase())) stored.accent = DEFAULT_ACCENT
export const settings = $state({
  ...structuredClone(defaults),
  ...stored,
  columns: { ...defaults.columns, ...(stored.columns || {}) }
})

export const shortlist = $state({ items: read(LIST_KEY, []) })

export const meta = $state({ sources: [], marketplaces: [], mode: 'live', loaded: false, error: '' })

$effect.root(() => {
  $effect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings))
    } catch {}
  })
  $effect(() => {
    try {
      localStorage.setItem(LIST_KEY, JSON.stringify(shortlist.items))
    } catch {}
  })
})

/* ---------- sources ---------- */

export async function loadMeta() {
  try {
    const data = await fetchSources()
    meta.sources = data.sources
    meta.marketplaces = data.marketplaces || []
    meta.mode = data.mode || 'live'
    meta.error = ''
  } catch (e) {
    meta.error = e.message
  } finally {
    meta.loaded = true
  }
}

const DEFAULT_RULE = { flat: 60, freeAbove: 500 }

export function sourceList() {
  return [
    ...meta.sources,
    ...settings.customDomains.map((d) => ({ id: d, name: d, domain: d, ship: DEFAULT_RULE, custom: true }))
  ]
}

export function ruleFor(id) {
  const base = sourceList().find((s) => s.id === id)?.ship || DEFAULT_RULE
  return { ...base, ...(settings.ship[id] || {}) }
}

export function toggleSource(id) {
  const i = settings.disabledSources.indexOf(id)
  if (i >= 0) settings.disabledSources.splice(i, 1)
  else settings.disabledSources.push(id)
}

export function toggleMarketplace(id) {
  const i = settings.disabledMarketplaces.indexOf(id)
  if (i >= 0) settings.disabledMarketplaces.splice(i, 1)
  else settings.disabledMarketplaces.push(id)
}

/* ---------- routing (hash only, no slashes) ---------- */

const VIEWS = ['search', 'saved', 'shortlist', 'customize']
export const route = $state({ view: 'search', params: {} })

function parseHash() {
  const [view, qs = ''] = location.hash.replace(/^#/, '').split('?')
  route.view = VIEWS.includes(view) ? view : 'search'
  route.params = Object.fromEntries(new URLSearchParams(qs))
}
window.addEventListener('hashchange', parseHash)
parseHash()

export function go(view, params = {}) {
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))
  const qs = new URLSearchParams(clean).toString()
  location.hash = view + (qs ? `?${qs}` : '')
}

/* ---------- shortlist ---------- */

export function addToShortlist(q, qty = 1) {
  const term = q.trim()
  if (!term) return false
  const existing = shortlist.items.find((i) => i.q.toLowerCase() === term.toLowerCase())
  if (existing) existing.qty = Math.max(1, Math.floor(qty))
  else shortlist.items.push({ id: crypto.randomUUID(), q: term, qty: Math.max(1, Math.floor(qty)) })
  return true
}

export function removeFromShortlist(id) {
  const i = shortlist.items.findIndex((x) => x.id === id)
  if (i >= 0) shortlist.items.splice(i, 1)
}

/* ---------- search history ---------- */

export function remember(q) {
  const i = settings.recent.findIndex((r) => r.toLowerCase() === q.toLowerCase())
  if (i >= 0) settings.recent.splice(i, 1)
  settings.recent.unshift(q)
  if (settings.recent.length > 10) settings.recent.length = 10
}

export function toggleSaved(q) {
  const i = settings.saved.findIndex((r) => r.toLowerCase() === q.toLowerCase())
  if (i >= 0) settings.saved.splice(i, 1)
  else settings.saved.push(q)
}

/* ---------- appearance ---------- */

const dark = window.matchMedia('(prefers-color-scheme: dark)')

export function applyAppearance() {
  const root = document.documentElement
  const resolved = settings.theme === 'system' ? (dark.matches ? 'dark' : 'light') : settings.theme
  root.dataset.theme = resolved
  root.dataset.density = settings.density
  root.dataset.radius = settings.radius

  // The default clay is theme-aware in CSS; only pin inline vars for custom accents.
  const accent = String(settings.accent || DEFAULT_ACCENT).toLowerCase()
  if (accent === DEFAULT_ACCENT) {
    root.style.removeProperty('--accent')
    root.style.removeProperty('--accent-fg')
  } else {
    root.style.setProperty('--accent', accent)
    root.style.setProperty('--accent-fg', readableOn(accent))
  }

  root.style.fontSize = `${(16 * settings.fontScale) / 100}px`
}

dark.addEventListener('change', applyAppearance)
