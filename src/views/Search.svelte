<script>
  import { untrack } from 'svelte'
  import IconSearch from '@lucide/svelte/icons/search'
  import IconListPlus from '@lucide/svelte/icons/list-plus'
  import IconBookmark from '@lucide/svelte/icons/bookmark'
  import IconFilter from '@lucide/svelte/icons/list-filter'
  import IconGrid from '@lucide/svelte/icons/layout-grid'
  import IconRows from '@lucide/svelte/icons/rows-3'
  import IconLink from '@lucide/svelte/icons/external-link'
  import IconArrow from '@lucide/svelte/icons/arrow-up-right'
  import IconPlus from '@lucide/svelte/icons/plus'
  import IconShoppingBag from '@lucide/svelte/icons/shopping-bag'
  import IconCheck from '@lucide/svelte/icons/check'
  import IconAlert from '@lucide/svelte/icons/triangle-alert'
  import IconX from '@lucide/svelte/icons/circle-x'
  import IconOk from '@lucide/svelte/icons/circle-check'
  import IconClock from '@lucide/svelte/icons/history'
  import IconBox from '@lucide/svelte/icons/package-search'
  import IconZap from '@lucide/svelte/icons/zap'
  import IconTruck from '@lucide/svelte/icons/truck'
  import IconSparkles from '@lucide/svelte/icons/sparkles'
  import IconBarChart from '@lucide/svelte/icons/bar-chart-2'
  import IconShield from '@lucide/svelte/icons/shield-check'
  import IconCheckSquare from '@lucide/svelte/icons/check-square'
  import IconSquare from '@lucide/svelte/icons/square'
  import IconImage from '@lucide/svelte/icons/image'
  import IconChevronLeft from '@lucide/svelte/icons/chevron-left'
  import IconChevronRight from '@lucide/svelte/icons/chevron-right'
  import {
    route, go, settings, meta, sourceList, ruleFor, addToShortlist, remember, toggleSaved, toggleSource
  } from '../lib/store.svelte.js'
  import { search, fetchImages } from '../lib/api.js'
  import { plan, shipping } from '../lib/pricing.js'
  import { inr } from '../lib/format.js'
  import Seg from '../lib/Seg.svelte'
  import Switch from '../lib/Switch.svelte'

  const examples = ['10k resistor', 'M3 bolt 20mm', 'ESP32', '5V relay module', 'jumper wires', 'SG90 servo']
  const PAGE_SIZE = 12

  const categories = [
    { title: 'Microcontrollers', items: ['ESP32', 'Raspberry Pi Pico', 'Arduino Nano', 'STM32 BluePill'] },
    { title: 'Mechanical & Motion', items: ['M3 bolt 20mm', 'SG90 servo', 'NEMA 17 stepper', 'Lead screw 8mm'] },
    { title: 'Passives & Modules', items: ['10k resistor', '5V relay module', '100uF capacitor', 'Step-down LM2596'] },
    { title: 'Sensors & Displays', items: ['OLED 0.96 inch', 'DHT11 sensor', 'Ultrasonic HC-SR04', 'MPU6050 gyro'] }
  ]

  let q = $state(route.params.q ?? '')
  let qty = $state(Number(route.params.qty) || 1)
  let data = $state(null)
  let loading = $state(false)
  let error = $state('')
  let showTools = $state(false)
  let showStats = $state(true)
  let selectedMap = $state({})
  let failedImages = $state({})
  let gallery = $state(null)
  let visibleCount = $state(PAGE_SIZE)
  let input

  async function run(term, { force = false } = {}) {
    loading = true
    error = ''
    selectedMap = {}
    failedImages = {}
    visibleCount = PAGE_SIZE
    try {
      data = await search(term, $state.snapshot(settings.customDomains), { force })
      remember(term)
    } catch (e) {
      error = e.message
      data = null
    } finally {
      loading = false
    }
  }

  // Address bar is source of truth
  $effect(() => {
    const t = route.params.q ?? ''
    const n = Number(route.params.qty) || 1
    untrack(() => {
      q = t
      qty = n
      if (t.trim().length >= 2) run(t.trim())
      else data = null
    })
  })

  function submit(e) {
    e?.preventDefault()
    const term = q.trim()
    if (term.length < 2) return
    const n = Math.max(1, Math.floor(Number(qty)) || 1)
    if (route.params.q === term && Number(route.params.qty || 1) === n) run(term, { force: true })
    else go('search', { q: term, qty: n > 1 ? n : '' })
  }

  function pick(term) {
    q = term
    go('search', { q: term })
  }

  function toggleRowSelect(id) {
    selectedMap[id] = !selectedMap[id]
  }

  function toggleSelectAll() {
    const allSelected = visibleRows.length > 0 && visibleRows.every(r => selectedMap[r.o.id])
    const next = {}
    if (!allSelected) {
      for (const r of visibleRows) next[r.o.id] = true
    }
    selectedMap = next
  }

  function loadMore() {
    visibleCount += PAGE_SIZE
  }

  function markImageFailed(id) {
    failedImages[id] = true
  }

  async function openGallery(o) {
    const initial = (o.images?.length ? o.images : o.image ? [o.image] : []).slice(0, 12)
    gallery = { offer: o, images: initial, index: 0, loading: false, note: '' }

    if (o.source === 'googleshopping') {
      gallery.note = initial.length
        ? 'Google Shopping provides one thumbnail per listing. Open the store for the full gallery.'
        : 'No image available for this marketplace listing.'
      return
    }

    if (initial.length > 1) {
      gallery.note = `${initial.length} images from ${o.sourceName}`
      return
    }

    gallery.loading = initial.length === 0
    const extra = await fetchImages(o.url)
    if (!gallery || gallery.offer.id !== o.id) return

    const merged = [...new Set([...initial, ...extra])].slice(0, 12)
    gallery.images = merged
    gallery.loading = false
    gallery.note = merged.length > 1
      ? `${merged.length} images from ${o.sourceName}`
      : merged.length
        ? 'Only one image is published for this listing.'
        : 'No images available for this listing.'
  }

  function closeGallery() {
    gallery = null
  }

  function galleryStep(delta) {
    if (!gallery || gallery.images.length < 2) return
    gallery.index = (gallery.index + delta + gallery.images.length) % gallery.images.length
  }

  const selectedCount = $derived(Object.values(selectedMap).filter(Boolean).length)

  function addSelectedToShortlist() {
    for (const r of rows) {
      if (selectedMap[r.o.id]) {
        addToShortlist(r.o.title, qty)
      }
    }
    selectedMap = {}
  }

  function onKey(e) {
    if (gallery) {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeGallery()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        galleryStep(1)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        galleryStep(-1)
      }
      return
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      input?.focus()
      input?.select()
    }
  }

  $effect(() => {
    document.body.style.overflow = gallery ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  })

  const n = $derived(Math.max(1, Math.floor(Number(qty)) || 1))
  const saved = $derived(settings.saved.some((s) => s.toLowerCase() === q.trim().toLowerCase()))

  const rows = $derived.by(() => {
    if (!data) return []
    let list = data.offers.filter((o) => !settings.disabledSources.includes(o.source))
    if (settings.inStockOnly) list = list.filter((o) => o.inStock)
    const lo = settings.minPrice === '' ? null : Number(settings.minPrice)
    const hi = settings.maxPrice === '' ? null : Number(settings.maxPrice)
    const withPlan = list.map((o) => {
      const p = plan(o, n)
      const ship = shipping(ruleFor(o.source), p.cost, settings.includeShipping)
      return { o, p, ship, total: p.cost + ship }
    })
    const filtered = withPlan.filter((r) => (lo == null || r.total >= lo) && (hi == null || r.total <= hi))
    const key = {
      total: (r) => r.total,
      unit: (r) => r.o.unitPrice,
      pack: (r) => r.o.price,
      relevance: (r) => -(r.o.aiScore ?? r.o.relevance)
    }[settings.sort]
    return filtered.sort((a, b) => Number(!a.o.inStock) - Number(!b.o.inStock) || key(a) - key(b))
  })

  const bestId = $derived(rows.find((r) => r.o.inStock)?.o.id)
  const visibleRows = $derived(rows.slice(0, visibleCount))
  const hasMoreRows = $derived(visibleCount < rows.length)
  const remainingRows = $derived(Math.max(0, rows.length - visibleCount))
  const cols = $derived(['source', 'pack', 'unit', 'total', 'stock'].filter((c) => settings.columns[c]))
  const liveSourceCount = $derived(data?.sources.filter((s) => s.state === 'live').length ?? 0)
  const marketplaces = $derived((data?.marketplaces ?? []).filter((m) => !settings.disabledMarketplaces.includes(m.id)))
  const googleShoppingUrl = $derived(`https://www.google.com/search?tbm=shop&q=${encodeURIComponent(q.trim())}&gl=in`)
  const linkedMarketplaceCount = $derived(
    meta.marketplaces.length
      ? meta.marketplaces.filter((m) => !settings.disabledMarketplaces.includes(m.id)).length
      : Math.max(0, 9 - settings.disabledMarketplaces.length)
  )
  const bestUnitPrice = $derived(Math.min(...rows.filter((r) => r.o.inStock).map((r) => r.o.unitPrice)))
  const colLabel = $derived({ source: 'Shop', pack: 'Pack', unit: 'Per piece', total: n > 1 ? `Total for ${n}` : 'Price', stock: 'Status' })

  function valueLabel(row) {
    if (!row.o.inStock || !Number.isFinite(bestUnitPrice)) return '—'
    const ratio = row.o.unitPrice / bestUnitPrice
    if (ratio <= 1.0001) return 'Best value'
    if (ratio <= 1.25) return 'Good value'
    if (ratio <= 2) return 'Higher'
    return 'Premium'
  }

</script>

<svelte:window onkeydown={onKey} />

<div class="page-container">
  <!-- Top Product Header Bar (Faithful to Pinterest Dashboard Style) -->
  <header class="dashboard-header">
    <div class="header-left">
      <div class="header-title-row">
        <h1 class="header-title">Parts Explorer</h1>
        <span class="header-status-badge">Live Multi-Store</span>
      </div>
      <p class="header-subtitle">Real-time electronics pricing, inventory check and landed cost comparison across top stores.</p>
    </div>
    <div class="header-actions">
      {#if q.trim().length >= 2}
        <button class="btn secondary" class:active={saved} onclick={() => toggleSaved(q.trim())}>
          <IconBookmark size={15} />
          <span>{saved ? 'Saved' : 'Save Search'}</span>
        </button>
      {/if}
    </div>
  </header>

  <!-- Full-Width Stadium Search Form -->
  <form class="search-stadium" onsubmit={submit}>
    <div class="search-input-wrap">
      <span class="search-icon-slot"><IconSearch size={19} /></span>
      <input
        bind:this={input}
        class="search-main-input"
        bind:value={q}
        placeholder="Search any electronic component, microcontroller, fastener (e.g. ESP32, 10k resistor, M3 bolt)..."
        aria-label="Search parts"
        autocomplete="off"
        spellcheck="false"
      />
      <span class="search-kbd-slot"><kbd>Ctrl K</kbd></span>
    </div>

    <div class="search-qty-pill">
      <span class="qty-label">Qty</span>
      <input class="qty-num-input" type="number" min="1" step="1" bind:value={qty} aria-label="Quantity needed" />
    </div>

    <button class="search-submit-btn" type="submit">
      <IconSearch size={16} />
      <span>Compare Prices</span>
    </button>
  </form>

  {#if data?.ai?.used && !loading}
    <div class="ai-assist-strip">
      <span class="ai-assist-badge">
        <IconSparkles size={13} />
        <span>AI assist</span>
      </span>
      <span class="ai-assist-intent" title={data.ai.intent}>{data.ai.intent}</span>
      {#if data.ai.queries.length}
        <span class="ai-assist-sep" aria-hidden="true"></span>
        <span class="ai-assist-label">Also searched</span>
        {#each data.ai.queries as alt (alt)}
          <span class="ai-assist-chip">{alt}</span>
        {/each}
      {/if}
      {#if data.ai.added > 0}
        <span class="ai-assist-added">+{data.ai.added} extra listing{data.ai.added === 1 ? '' : 's'}</span>
      {/if}
    </div>
  {/if}

  <!-- Controls & Filter Toolbar (Inspired by Pinterest Dashboard Controls) -->
  <div class="dashboard-toolbar">
    <div class="toolbar-left-group">
      <Seg
        label="View"
        bind:value={settings.layout}
        options={[
          { value: 'table', icon: IconRows, title: 'Table View' },
          { value: 'grid', icon: IconGrid, title: 'Cards View' }
        ]}
      />

      <button class="btn secondary" class:active={showTools} onclick={() => (showTools = !showTools)}>
        <IconFilter size={15} />
        <span>Filters</span>
      </button>

      <Seg
        label="Sort"
        bind:value={settings.sort}
        options={[
          { value: 'total', label: 'Lowest total' },
          { value: 'unit', label: 'Per piece' },
          { value: 'pack', label: 'Pack price' },
          { value: 'relevance', label: 'Best match' }
        ]}
      />

      <div class="toolbar-toggle-item">
        <span class="toggle-text">Show Analytics</span>
        <Switch bind:checked={showStats} label="Show Analytics" />
      </div>

      <button class="btn secondary" class:active={settings.inStockOnly} onclick={() => (settings.inStockOnly = !settings.inStockOnly)}>
        <IconCheck size={14} />
        <span>In stock only</span>
      </button>

      <button class="btn secondary" class:active={settings.showImages} onclick={() => (settings.showImages = !settings.showImages)}>
        <IconImage size={14} />
        <span>Images</span>
      </button>
    </div>

    <div class="toolbar-right-group">
      {#if data}
        <span class="results-count-pill">{rows.length} offers found</span>
      {/if}
    </div>
  </div>

  <!-- Expandable Filter Panel -->
  {#if showTools}
    <div class="filter-drawer-panel">
      <div class="filter-field-row">
        <span class="filter-label">Price Range (INR)</span>
        <input class="input num filter-num-in" type="number" min="0" placeholder="Min" bind:value={settings.minPrice} />
        <span class="filter-sep">to</span>
        <input class="input num filter-num-in" type="number" min="0" placeholder="Max" bind:value={settings.maxPrice} />
      </div>

      <div class="filter-field-row">
        <span class="filter-label">Shipping Rules</span>
        <Switch bind:checked={settings.includeShipping} label="Include shipping" />
        <span class="filter-hint">Calculate delivery fees and free shipping thresholds</span>
      </div>

      <div class="filter-field-row shops-row">
        <span class="filter-label">Store Filters</span>
        <div class="filter-chips-wrap">
          {#each sourceList() as s (s.id)}
            <button class="filter-chip-btn" class:disabled={settings.disabledSources.includes(s.id)} onclick={() => toggleSource(s.id)}>
              <span class="chip-status-dot"></span>
              {s.name}
            </button>
          {/each}
        </div>
      </div>
    </div>
  {/if}

  <!-- 4-KPI Metric Stat Cards (Toggled by "Show Analytics", exactly matching Pinterest Reference) -->
  {#if showStats}
    <div class="kpi-grid">
      {#if data}
        <div class="kpi-metric-card">
          <div class="kpi-header-row">
            <span class="kpi-metric-name">Total Offers</span>
            <IconBarChart size={16} class="kpi-header-icon" />
          </div>
          <div class="kpi-metric-val">{rows.length}</div>
          <div class="kpi-trend-row">
            <span class="kpi-pill-green">+ {data.offers.length} across shops</span>
            <span class="kpi-trend-note">all active listings</span>
          </div>
        </div>

        <div class="kpi-metric-card">
          <div class="kpi-header-row">
            <span class="kpi-metric-name">Lowest Landed Price</span>
            <IconSparkles size={16} class="kpi-header-icon" />
          </div>
          <div class="kpi-metric-val">{rows.find(r => r.o.inStock) ? inr(rows.find(r => r.o.inStock).total) : '-'}</div>
          <div class="kpi-trend-row">
            <span class="kpi-pill-green">Best available deal</span>
            <span class="kpi-trend-note">including shipping</span>
          </div>
        </div>

        <div class="kpi-metric-card">
          <div class="kpi-header-row">
            <span class="kpi-metric-name">Connected Stores</span>
            <IconShield size={16} class="kpi-header-icon" />
          </div>
          <div class="kpi-metric-val">{liveSourceCount} / {data.sources.length}</div>
          <div class="kpi-trend-row">
            <span class="kpi-pill-blue">{liveSourceCount === data.sources.length ? 'Live sync active' : 'Partial sync'}</span>
            <span class="kpi-trend-note">direct store feeds</span>
          </div>
        </div>

        <div class="kpi-metric-card">
          <div class="kpi-header-row">
            <span class="kpi-metric-name">In-Stock Availability</span>
            <IconBox size={16} class="kpi-header-icon" />
          </div>
          <div class="kpi-metric-val">{Math.round((data.offers.filter(o => o.inStock).length / (data.offers.length || 1)) * 100)}%</div>
          <div class="kpi-trend-row">
            <span class="kpi-pill-green">Ready to dispatch</span>
            <span class="kpi-trend-note">immediate delivery</span>
          </div>
        </div>
      {:else}
        <!-- Platform KPI Cards for Empty State -->
        <div class="kpi-metric-card">
          <div class="kpi-header-row">
            <span class="kpi-metric-name">Covered Stores</span>
            <IconShield size={16} class="kpi-header-icon" />
          </div>
          <div class="kpi-metric-val">{(meta.sources.length || 3) + linkedMarketplaceCount} Shops</div>
          <div class="kpi-trend-row">
            <span class="kpi-pill-green">{meta.sources.length || 3} live feeds</span>
            <span class="kpi-trend-note">{linkedMarketplaceCount} search links</span>
          </div>
        </div>

        <div class="kpi-metric-card">
          <div class="kpi-header-row">
            <span class="kpi-metric-name">Pack Optimization</span>
            <IconBox size={16} class="kpi-header-icon" />
          </div>
          <div class="kpi-metric-val">100% Automated</div>
          <div class="kpi-trend-row">
            <span class="kpi-pill-blue">Pack size vs single unit</span>
          </div>
        </div>

        <div class="kpi-metric-card">
          <div class="kpi-header-row">
            <span class="kpi-metric-name">Shipping Engine</span>
            <IconTruck size={16} class="kpi-header-icon" />
          </div>
          <div class="kpi-metric-val">Dynamic Landed</div>
          <div class="kpi-trend-row">
            <span class="kpi-pill-green">Free delivery thresholds</span>
          </div>
        </div>

        <div class="kpi-metric-card">
          <div class="kpi-header-row">
            <span class="kpi-metric-name">BOM Multi-Split</span>
            <IconZap size={16} class="kpi-header-icon" />
          </div>
          <div class="kpi-metric-val">Cart Optimizer</div>
          <div class="kpi-trend-row">
            <span class="kpi-pill-amber">Minimizes total cart spend</span>
          </div>
        </div>
      {/if}
    </div>
  {/if}

  {#if data}
    <!-- Shops: live product feeds plus marketplace search shops, one list -->
    <div class="store-status-panel">
      <div class="store-status-bar">
        <span class="store-status-label">Shops</span>
        {#each data.sources as s (s.id)}
          {@const StateIcon = s.state === 'live' ? IconOk : IconX}
          <span class="store-status-chip {s.state}" title={s.error ? `${s.name}: ${s.error}` : `${s.count} offers in ${s.ms} ms`}>
            <StateIcon size={14} />
            <span>{s.name}</span>
            <span class="chip-count-num">{s.count}</span>
          </span>
        {/each}

        {#if settings.showLinkouts && marketplaces.length}
          <span class="store-status-divider" aria-hidden="true"></span>
          <span class="store-status-sublabel">Marketplace search</span>
          {#each marketplaces as m (m.id)}
            <a
              class="store-status-chip link"
              href={m.url}
              target="_blank"
              rel="noopener noreferrer"
              title="Search {q.trim()} on {m.name} (opens on site)"
            >
              <IconArrow size={13} />
              <span>{m.name}</span>
            </a>
          {/each}
          <a
            class="store-status-chip link aggregator-shop"
            href={googleShoppingUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open Google Shopping in a new tab for {q.trim()}"
          >
            <IconShoppingBag size={13} />
            <span>Google Shopping (web)</span>
          </a>
        {/if}
      </div>
    </div>

    {#if data.sources.length && liveSourceCount === 0}
      <div class="dashboard-notice" role="status">
        <IconAlert size={16} />
        <span>Live shops did not respond this time. Use the marketplace links above or try again in a minute.</span>
      </div>
    {/if}
  {/if}

  {#if error}
    <div class="dashboard-notice error" role="alert">
      <IconAlert size={16} />
      <span>{error}</span>
    </div>
  {/if}

  <!-- Results Content -->
  {#if loading}
    <div class="dashboard-table-card" aria-busy="true">
      <div class="table-loading-wrap">
        {#each Array(6) as _, i (i)}
          <div class="table-skeleton-row"></div>
        {/each}
      </div>
    </div>
  {:else if data && rows.length === 0}
    <div class="dashboard-empty-card">
      <div class="empty-icon-wrap"><IconBox size={36} /></div>
      <h3>No offers match your criteria</h3>
      <p>Try a broader part name, uncheck "In stock only", or open a marketplace from the shops bar above.</p>
    </div>
  {:else if data && settings.layout === 'table'}
    <!-- Data Table Faithfully Styled to Pinterest Reference -->
    <div class="dashboard-table-card">
      <table class="saas-data-table">
        <thead>
          <tr>
            <th class="th-checkbox">
              <button
                type="button"
                class="table-checkbox-btn"
                aria-label="Select all rows"
                onclick={toggleSelectAll}
              >
                {#if visibleRows.length > 0 && visibleRows.every(r => selectedMap[r.o.id])}
                  <IconCheckSquare size={17} class="check-icon-active" />
                {:else}
                  <IconSquare size={17} class="check-icon-default" />
                {/if}
              </button>
            </th>
            <th class="th-product">Product / Part Listing</th>
            {#each cols as c (c)}
              <th class="th-col" class:text-right={c !== 'source' && c !== 'stock'}>{colLabel[c]}</th>
            {/each}
            <th class="th-rating">Value vs best</th>
            <th class="th-action text-right">Direct Link</th>
          </tr>
        </thead>
        <tbody>
          {#each visibleRows as r (r.o.id)}
            {@const isSelected = Boolean(selectedMap[r.o.id])}
            {@const isBest = r.o.id === bestId}
            <tr class="saas-data-row" class:row-selected={isSelected} class:row-best={isBest} class:row-out={!r.o.inStock}>
              <td class="td-checkbox">
                <button
                  type="button"
                  class="table-checkbox-btn"
                  aria-label="Select row"
                  onclick={() => toggleRowSelect(r.o.id)}
                >
                  {#if isSelected}
                    <IconCheckSquare size={17} class="check-icon-active" />
                  {:else}
                    <IconSquare size={17} class="check-icon-default" />
                  {/if}
                </button>
              </td>

              <td class="td-product">
                <div class="product-cell-row">
                  {#if settings.showImages}
                    <button
                      class="product-thumb-tile"
                      type="button"
                      onclick={() => openGallery(r.o)}
                      aria-label="View images of {r.o.title}"
                      title="View all images"
                    >
                      {#if r.o.image && !failedImages[r.o.id]}
                        <img
                          class="product-thumb-img"
                          src={r.o.image}
                          alt=""
                          loading="lazy"
                          referrerpolicy="no-referrer"
                          onerror={() => markImageFailed(r.o.id)}
                        />
                      {:else}
                        <IconImage size={17} class="product-thumb-placeholder" />
                      {/if}
                      {#if r.o.images?.length > 1}
                        <span class="thumb-count-badge">{r.o.images.length}</span>
                      {/if}
                    </button>
                  {/if}
                  <div class="product-info-wrap">
                    <span class="product-title" title={r.o.title}>{r.o.title}</span>
                    <div class="product-sub-wrap">
                      {#if isBest}
                        <span class="badge-best-deal"><IconCheck size={12} /> Lowest Price</span>
                      {/if}
                      {#if r.p.packs > 1 || r.p.spare > 0}
                        <span class="badge-pack-info">{r.p.packs} x pack{r.p.spare > 0 ? `, ${r.p.spare} spare` : ''}</span>
                      {/if}
                      {#if r.o.via}
                        <span class="badge-via-info">{r.o.via}</span>
                      {/if}
                      {#if r.ship > 0}
                        <span class="badge-ship-info">+ {inr(r.ship)} ship</span>
                      {/if}
                    </div>
                  </div>
                </div>
              </td>

              {#each cols as c (c)}
                {#if c === 'source'}
                  <td class="td-col">
                    <span class="store-tag-pill">{r.o.sourceName}</span>
                  </td>
                {:else if c === 'pack'}
                  <td class="td-col text-right">
                    <span class="cell-pack-val">{r.o.packSize > 1 ? `${r.o.packSize} pcs` : 'Single'}</span>
                  </td>
                {:else if c === 'unit'}
                  <td class="td-col text-right">
                    <span class="cell-unit-val">{inr(r.o.unitPrice)}</span>
                  </td>
                {:else if c === 'total'}
                  <td class="td-col text-right">
                    <span class="cell-total-val" class:highlight-price={isBest}>{inr(r.total)}</span>
                  </td>
                {:else}
                  <td class="td-col">
                    <span class="status-pill-badge {r.o.inStock ? 'pill-in-stock' : 'pill-out-of-stock'}">
                      {r.o.inStock ? 'In Stock' : 'Out of Stock'}
                    </span>
                  </td>
                {/if}
              {/each}

              <td class="td-rating">
                <span class="rating-badge">{valueLabel(r)}</span>
              </td>

              <td class="td-action text-right">
                <a
                  class="table-action-link-btn"
                  href={r.o.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open on {r.o.sourceName}"
                  aria-label="Open on {r.o.sourceName}"
                >
                  <IconLink size={15} />
                </a>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>

      <!-- Table Bottom Bar (Pagination style from Pinterest reference) -->
      <div class="table-footer-bar">
        <div class="table-footer-left">
          <span class="footer-count-text">Showing {visibleRows.length} of {rows.length} electronic offers</span>
        </div>
        <div class="table-footer-right">
          {#if hasMoreRows}
            <span class="footer-count-text footer-remaining-text">{remainingRows} more</span>
            <button class="load-more-btn" type="button" onclick={loadMore}>
              <IconPlus size={14} />
              <span>Load more</span>
            </button>
          {:else}
            <span class="footer-end-note">All offers shown</span>
          {/if}
        </div>
      </div>

      <!-- Floating Multi-Select Action Capsule (Just like in Pinterest Reference!) -->
      {#if selectedCount > 0}
        <div class="floating-selection-capsule">
          <span class="selection-capsule-count">{selectedCount} Selected</span>
          <div class="selection-capsule-divider"></div>
          <button class="capsule-btn primary" onclick={addSelectedToShortlist}>
            <IconListPlus size={14} />
            <span>Add to Shortlist</span>
          </button>
          <button class="capsule-btn" onclick={() => (selectedMap = {})}>
            <IconX size={14} />
            <span>Clear</span>
          </button>
        </div>
      {/if}
    </div>
  {:else if data}
    <!-- Grid Cards View -->
    <div class="dashboard-cards-grid">
      {#each visibleRows as r (r.o.id)}
        {@const isBest = r.o.id === bestId}
        <div class="saas-product-card" class:card-best={isBest} class:card-out={!r.o.inStock}>
          {#if settings.showImages}
            <button
              class="card-image-wrap"
              type="button"
              onclick={() => openGallery(r.o)}
              aria-label="View images of {r.o.title}"
              title="View all images"
            >
              {#if r.o.image && !failedImages[r.o.id]}
                <img
                  class="card-image"
                  src={r.o.image}
                  alt=""
                  loading="lazy"
                  referrerpolicy="no-referrer"
                  onerror={() => markImageFailed(r.o.id)}
                />
              {:else}
                <IconImage size={26} class="card-image-placeholder" />
              {/if}
              {#if r.o.images?.length > 1}
                <span class="thumb-count-badge">{r.o.images.length}</span>
              {/if}
            </button>
          {/if}

          <div class="card-top-row">
            <span class="store-tag-pill">{r.o.sourceName}</span>
            <span class="status-pill-badge {r.o.inStock ? 'pill-in-stock' : 'pill-out-of-stock'}">
              {r.o.inStock ? 'In Stock' : 'Out of Stock'}
            </span>
          </div>

          <h3 class="card-product-title">{r.o.title}</h3>
          {#if r.o.via}
            <span class="card-via-note">{r.o.via}</span>
          {/if}

          <div class="card-pricing-block">
            <div class="card-total-price">{inr(r.total)}</div>
            <div class="card-pricing-sub">
              <span>{inr(r.o.unitPrice)} / piece</span>
              <span>•</span>
              <span>{r.o.packSize > 1 ? `Pack of ${r.o.packSize}` : 'Single unit'}</span>
            </div>
          </div>

          {#if isBest}
            <div class="card-badge-deal"><IconCheck size={13} /> Lowest landed offer</div>
          {/if}

          <div class="card-actions-row">
            <a class="btn primary full-width" href={r.o.url} target="_blank" rel="noopener noreferrer">
              <span>Open Store</span>
              <IconArrow size={14} />
            </a>
          </div>
        </div>
      {/each}
    </div>

    {#if rows.length > PAGE_SIZE}
      <div class="load-more-grid-bar">
        <span class="footer-count-text">Showing {visibleRows.length} of {rows.length} offers</span>
        {#if hasMoreRows}
          <button class="load-more-btn" type="button" onclick={loadMore}>
            <IconPlus size={14} />
            <span>Load more</span>
            <span class="load-more-badge">{remainingRows}</span>
          </button>
        {:else}
          <span class="footer-end-note">All offers shown</span>
        {/if}
      </div>
    {/if}
  {:else}
    <!-- Expansive Modern Landing Deck (When no search has been entered) -->
    <div class="landing-deck-wrap">
      <!-- 3 Feature Pillars with vibrant curved icon containers -->
      <div class="landing-features-grid">
        <div class="landing-feature-card">
          <div class="feature-icon-box indigo-glow">
            <IconZap size={22} />
          </div>
          <h3 class="feature-title">Live Multi-Store Pricing</h3>
          <p class="feature-text">Live shop feeds from Robocraze, ThinkRobotics and Quartz Components, plus Google Shopping marketplace listings and direct searches across Amazon, Flipkart and seven more.</p>
        </div>

        <div class="landing-feature-card">
          <div class="feature-icon-box emerald-glow">
            <IconBox size={22} />
          </div>
          <h3 class="feature-title">Smart Pack Economics</h3>
          <p class="feature-text">Intelligently sizes bulk orders to calculate if purchasing 10-packs or singles minimizes your total bill of materials.</p>
        </div>

        <div class="landing-feature-card">
          <div class="feature-icon-box amber-glow">
            <IconTruck size={22} />
          </div>
          <h3 class="feature-title">Dynamic Delivery & Shipping</h3>
          <p class="feature-text">Applies store-specific flat rates and free shipping thresholds to calculate authentic landed checkout costs.</p>
        </div>
      </div>

      <!-- Curated Category Grid with Curved Clickable Chips -->
      <div class="section-divider-title">
        <span>Trending Electronics Categories</span>
      </div>

      <div class="category-cards-grid">
        {#each categories as cat (cat.title)}
          <div class="curved-category-card">
            <h4 class="category-card-heading">{cat.title}</h4>
            <div class="category-chip-wrap">
              {#each cat.items as it}
                <button class="category-action-chip" onclick={() => pick(it)}>
                  <span>{it}</span>
                  <IconArrow size={12} class="chip-arrow" />
                </button>
              {/each}
            </div>
          </div>
        {/each}
      </div>

      <!-- Saved & Recent Searches -->
      {#if settings.saved.length}
        <div class="section-divider-title">
          <span>Saved Searches</span>
        </div>
        <div class="quick-chips-row">
          {#each settings.saved as s (s)}
            <button class="quick-chip-btn" onclick={() => pick(s)}>
              <IconBookmark size={13} />
              <span>{s}</span>
            </button>
          {/each}
        </div>
      {/if}

      {#if settings.recent.length}
        <div class="section-divider-title">
          <span>Recent Searches</span>
        </div>
        <div class="quick-chips-row">
          {#each settings.recent as s (s)}
            <button class="quick-chip-btn" onclick={() => pick(s)}>
              <IconClock size={13} />
              <span>{s}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

</div>

{#if gallery}
  <div class="gallery-backdrop">
    <button class="gallery-backdrop-close" type="button" aria-label="Close image viewer" onclick={closeGallery}></button>
    <div
      class="gallery-dialog"
      role="dialog"
      aria-modal="true"
      aria-label="Product images"
      tabindex="-1"
    >
      <header class="gallery-header">
        <div class="gallery-heading">
          <span class="store-tag-pill">{gallery.offer.sourceName}</span>
          <h3 class="gallery-title">{gallery.offer.title}</h3>
        </div>
        <button class="gallery-close-btn" type="button" aria-label="Close image viewer" onclick={closeGallery}>
          <IconX size={18} />
        </button>
      </header>

      <div class="gallery-stage">
        {#if gallery.loading}
          <div class="gallery-loading" role="status">
            <span class="gallery-spinner"></span>
            <span>Loading images…</span>
          </div>
        {:else if gallery.images.length}
          <img
            class="gallery-main-img"
            src={gallery.images[gallery.index]}
            alt="{gallery.offer.title} — image {gallery.index + 1}"
          />
          {#if gallery.images.length > 1}
            <button class="gallery-nav prev" type="button" aria-label="Previous image" onclick={() => galleryStep(-1)}>
              <IconChevronLeft size={22} />
            </button>
            <button class="gallery-nav next" type="button" aria-label="Next image" onclick={() => galleryStep(1)}>
              <IconChevronRight size={22} />
            </button>
            <span class="gallery-counter">{gallery.index + 1} / {gallery.images.length}</span>
          {/if}
        {:else}
          <div class="gallery-empty">
            <IconImage size={38} />
            <span>No images available for this listing.</span>
          </div>
        {/if}
      </div>

      {#if gallery.images.length > 1}
        <div class="gallery-thumbs">
          {#each gallery.images as img, i (img)}
            <button
              class="gallery-thumb"
              class:active={i === gallery.index}
              type="button"
              aria-label="Show image {i + 1}"
              onclick={() => (gallery.index = i)}
            >
              <img src={img} alt="" referrerpolicy="no-referrer" />
            </button>
          {/each}
        </div>
      {/if}

      <footer class="gallery-footer">
        <span class="gallery-note">{gallery.note}</span>
        <a class="btn primary" href={gallery.offer.url} target="_blank" rel="noopener noreferrer">
          <span>Open Store</span>
          <IconArrow size={14} />
        </a>
      </footer>
    </div>
  </div>
{/if}
