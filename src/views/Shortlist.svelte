<script>
  import { untrack } from 'svelte'
  import IconPlus from '@lucide/svelte/icons/plus'
  import IconTrash from '@lucide/svelte/icons/trash-2'
  import IconDownload from '@lucide/svelte/icons/download'
  import IconList from '@lucide/svelte/icons/list-checks'
  import IconLink from '@lucide/svelte/icons/external-link'
  import IconZap from '@lucide/svelte/icons/zap'
  import IconStore from '@lucide/svelte/icons/store'
  import IconTrendingDown from '@lucide/svelte/icons/trending-down'
  import IconLayers from '@lucide/svelte/icons/layers'
  import IconSparkles from '@lucide/svelte/icons/sparkles'
  import { shortlist, settings, sourceList, ruleFor, addToShortlist, removeFromShortlist, go } from '../lib/store.svelte.js'
  import { search, fetchBomReview } from '../lib/api.js'
  import { plan, shipping } from '../lib/pricing.js'
  import { inr } from '../lib/format.js'

  let results = $state({}) // item id -> search data
  let failed = $state({})
  let newPart = $state('')
  let newQty = $state(1)
  const requested = new Set()

  async function load(item, force = false) {
    const key = `${item.id}|${item.q}`
    if (!force && requested.has(key)) return
    requested.add(key)
    try {
      results[item.id] = await search(item.q, $state.snapshot(settings.customDomains))
      failed[item.id] = ''
    } catch (e) {
      failed[item.id] = e.message
    }
  }

  $effect(() => {
    for (const item of shortlist.items) untrack(() => load(item))
  })

  function add(e) {
    e.preventDefault()
    if (addToShortlist(newPart, newQty)) {
      newPart = ''
      newQty = 1
    }
  }

  /** Cheapest in-stock listing per shop for one part, sized to the quantity needed. */
  function bestPerShop(item) {
    const data = results[item.id]
    if (!data) return {}
    const out = {}
    for (const o of data.offers) {
      if (settings.disabledSources.includes(o.source)) continue
      if (!o.inStock) continue
      const p = plan(o, item.qty)
      if (!out[o.source] || p.cost < out[o.source].cost) out[o.source] = { offer: o, cost: p.cost, packs: p.packs }
    }
    return out
  }

  const model = $derived.by(() => {
    const shops = sourceList().filter((s) => !settings.disabledSources.includes(s.id))
    const parts = shortlist.items.map((item) => ({ item, best: bestPerShop(item), ready: Boolean(results[item.id]) }))

    const cols = shops.map((s) => {
      const have = parts.filter((p) => p.best[s.id])
      const subtotal = have.reduce((a, p) => a + p.best[s.id].cost, 0)
      const ship = have.length ? shipping(ruleFor(s.id), subtotal, settings.includeShipping) : 0
      return { shop: s, covers: have.length, complete: parts.length > 0 && have.length === parts.length, subtotal, ship, total: subtotal + ship }
    })

    const complete = cols.filter((c) => c.complete).sort((a, b) => a.total - b.total)
    const single = complete[0] || null

    const ids = cols.map((c) => c.shop.id).slice(0, 12)
    let best = null
    if (parts.length && parts.every((p) => Object.keys(p.best).length)) {
      for (let mask = 1; mask < 1 << ids.length; mask++) {
        const group = ids.filter((_, i) => mask & (1 << i))
        const sub = {}
        const assign = []
        let ok = true
        for (const p of parts) {
          let shop = null
          let cost = Infinity
          for (const id of group) {
            const v = p.best[id]
            if (v && v.cost < cost) {
              cost = v.cost
              shop = id
            }
          }
          if (!shop) {
            ok = false
            break
          }
          sub[shop] = (sub[shop] || 0) + cost
          assign.push(shop)
        }
        if (!ok) continue
        let total = 0
        for (const [id, s] of Object.entries(sub)) total += s + shipping(ruleFor(id), s, settings.includeShipping)
        const shops = Object.keys(sub).length
        if (!best || total < best.total - 1e-9 || (Math.abs(total - best.total) < 1e-9 && shops < best.shops)) {
          best = { total, shops, assign }
        }
      }
    }
    const picks = parts.map((p, i) => (best ? { part: p.item, shopId: best.assign[i], ...p.best[best.assign[i]] } : null))
    const split = best ? { shops: best.shops, total: best.total } : null
    return { parts, cols, single, split, picks }
  })

  const saving = $derived(model.single && model.split ? model.single.total - model.split.total : 0)

  const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100

  let review = $state(null)
  let reviewLoading = $state(false)
  let reviewKey = ''
  let reviewToken = 0
  let reviewTimer

  /** Real optimizer facts only, never raw offers or invented numbers. */
  function bomFacts(m) {
    return {
      parts: m.parts.map((p) => ({
        name: p.item.q.slice(0, 70),
        qty: Math.max(1, Math.floor(Number(p.item.qty)) || 1),
        ready: p.ready,
        shopsWithStock: Object.keys(p.best).length
      })),
      shops: m.cols.map((c) => ({
        name: c.shop.name,
        covered: c.covers,
        complete: c.complete,
        shippingQuoted: !c.shop.aggregator,
        subtotal: round2(c.subtotal),
        shipping: round2(c.ship),
        total: round2(c.total)
      })),
      single: m.single ? { shop: m.single.shop.name, total: round2(m.single.total) } : null,
      split: m.split ? { shops: m.split.shops, total: round2(m.split.total) } : null,
      saving: round2(saving),
      includeShipping: Boolean(settings.includeShipping),
      picks: m.picks.filter(Boolean).map((pk) => {
        const p = plan(pk.offer, pk.part.qty)
        return {
          part: pk.part.q.slice(0, 70),
          qty: Math.max(1, Math.floor(Number(pk.part.qty)) || 1),
          shop: shopName(pk.shopId),
          cost: round2(pk.cost),
          packs: pk.packs,
          spare: p.spare,
          shippingQuoted: !sourceList().find((s) => s.id === pk.shopId)?.aggregator
        }
      })
    }
  }

  $effect(() => {
    const m = model
    const settled = m.parts.length > 0 && m.parts.every((p) => p.ready || failed[p.item.id])
    if (!shortlist.items.length || !settled) {
      clearTimeout(reviewTimer)
      reviewToken += 1
      review = null
      reviewLoading = false
      reviewKey = ''
      return
    }
    const facts = bomFacts(m)
    const key = JSON.stringify(facts)
    if (key === reviewKey) return
    reviewKey = key
    review = null
    reviewLoading = true
    const token = ++reviewToken
    clearTimeout(reviewTimer)
    reviewTimer = setTimeout(async () => {
      const got = await fetchBomReview(facts)
      if (token !== reviewToken) return
      review = got
      reviewLoading = false
    }, 700)
    return () => clearTimeout(reviewTimer)
  })

  function exportCsv() {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const abs = (u) => {
      try {
        return new URL(u, location.origin).href
      } catch {
        return u
      }
    }
    const lines = [['Part', 'Qty', 'Shop', 'Listing', 'Packs', 'Cost', 'Link'].map(esc).join(',')]
    for (const pk of model.picks) {
      if (!pk) continue
      lines.push([pk.part.q, pk.part.qty, pk.offer.sourceName, pk.offer.title, pk.packs, pk.cost.toFixed(2), abs(pk.offer.url)].map(esc).join(','))
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'shortlist.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const shopName = (id) => sourceList().find((s) => s.id === id)?.name || id
</script>

<div class="page-container">
  <!-- Top Header Bar -->
  <header class="dashboard-header">
    <div class="header-left">
      <div class="header-title-row">
        <h1 class="header-title">Shortlist & BOM Optimizer</h1>
        <span class="header-status-badge">Split Cart Engine</span>
      </div>
      <p class="header-subtitle">Build your multi-part bill of materials. Compare all-in-one single shop vs optimal split cart.</p>
    </div>
    <div class="header-actions">
      <button class="btn primary" onclick={exportCsv} disabled={!model.split}>
        <IconDownload size={15} />
        <span>Export Order CSV</span>
      </button>
    </div>
  </header>

  <!-- Stadium Add Part Bar -->
  <form class="search-stadium" onsubmit={add}>
    <div class="search-input-wrap">
      <span class="search-icon-slot"><IconPlus size={19} /></span>
      <input
        class="search-main-input"
        bind:value={newPart}
        placeholder="Add part to bill of materials (e.g. M3 nut, 100uF capacitor, OLED display)..."
        aria-label="Part to add"
      />
    </div>

    <div class="search-qty-pill">
      <span class="qty-label">Qty</span>
      <input class="qty-num-input" type="number" min="1" step="1" bind:value={newQty} aria-label="Quantity" />
    </div>

    <button class="search-submit-btn" type="submit">
      <IconPlus size={16} />
      <span>Add Part</span>
    </button>
  </form>

  <!-- 4-KPI Metric Cards for Shortlist -->
  <div class="kpi-grid">
    <div class="kpi-metric-card">
      <div class="kpi-header-row">
        <span class="kpi-metric-name">BOM Line Items</span>
        <IconLayers size={16} class="kpi-header-icon" />
      </div>
      <div class="kpi-metric-val">{shortlist.items.length}</div>
      <div class="kpi-trend-row">
        <span class="kpi-pill-blue">Active Bill of Materials</span>
      </div>
    </div>

    <div class="kpi-metric-card">
      <div class="kpi-header-row">
        <span class="kpi-metric-name">Single Store Cart</span>
        <IconStore size={16} class="kpi-header-icon" />
      </div>
      <div class="kpi-metric-val">{model.single ? inr(model.single.total) : '-'}</div>
      <div class="kpi-trend-row">
        <span class="kpi-pill-green">{model.single ? model.single.shop.name : 'No single store stocks all'}</span>
      </div>
    </div>

    <div class="kpi-metric-card">
      <div class="kpi-header-row">
        <span class="kpi-metric-name">Cheapest Split Cart</span>
        <IconZap size={16} class="kpi-header-icon" />
      </div>
      <div class="kpi-metric-val">{model.split ? inr(model.split.total) : '-'}</div>
      <div class="kpi-trend-row">
        <span class="kpi-pill-green">{model.split ? `Split across ${model.split.shops} shops` : 'Waiting for prices'}</span>
      </div>
    </div>

    <div class="kpi-metric-card">
      <div class="kpi-header-row">
        <span class="kpi-metric-name">Consolidated Savings</span>
        <IconTrendingDown size={16} class="kpi-header-icon" />
      </div>
      <div class="kpi-metric-val">{saving > 0.5 ? inr(saving) : '₹0'}</div>
      <div class="kpi-trend-row">
        <span class="kpi-pill-amber">{saving > 0.5 ? 'Saved via split order' : 'Single shop is optimal'}</span>
      </div>
    </div>
  </div>

  {#if shortlist.items.length > 0 && (reviewLoading || review)}
    <div class="ai-review-card" aria-live="polite">
      <div class="ai-review-head">
        <span class="ai-assist-badge">
          <IconSparkles size={13} />
          <span>AI BOM review</span>
        </span>
        <span class="ai-review-note">Grounded in the optimizer totals below · confirm on the stores</span>
      </div>
      {#if review}
        <p class="ai-review-summary">{review.verdict}</p>
        {#if review.points.length}
          <ul class="ai-review-points">
            {#each review.points as point, i (i)}
              <li>{point}</li>
            {/each}
          </ul>
        {/if}
      {:else}
        <div class="ai-review-skeleton" aria-busy="true" aria-label="Reviewing bill of materials">
          <span class="ai-review-skel-line w-95"></span>
          <span class="ai-review-skel-line w-65"></span>
        </div>
      {/if}
    </div>
  {/if}

  {#if shortlist.items.length === 0}
    <div class="dashboard-empty-card">
      <div class="empty-icon-wrap"><IconList size={36} /></div>
      <h3>Your shortlist is empty</h3>
      <p>Search and add components to calculate consolidated orders across multiple distributors.</p>
      <button class="btn primary" onclick={() => go('search')}>
        <span>Explore Components</span>
      </button>
    </div>
  {:else}
    <!-- Distributor Comparison Matrix Table -->
    <div class="dashboard-table-card">
      <div class="table-card-header">
        <h3>Multi-Store Price Comparison Matrix</h3>
        <span class="muted-note">Comparing item prices and shipping across connected distributors</span>
      </div>

      <div class="matrix-table-wrap">
        <table class="saas-data-table matrix-table">
          <thead>
            <tr>
              <th class="th-part">Part & Quantity Needed</th>
              {#each model.cols as c (c.shop.id)}
                <th class="th-shop text-right">{c.shop.name}</th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each model.parts as p (p.item.id)}
              {@const min = Math.min(...Object.values(p.best).map((v) => v.cost))}
              <tr class="saas-data-row">
                <td class="td-part-config">
                  <div class="matrix-part-row">
                    <input class="input num matrix-qty-in" type="number" min="1" bind:value={p.item.qty} aria-label="Quantity of {p.item.q}" />
                    <span class="matrix-part-name">{p.item.q}</span>
                    <button class="table-action-delete-btn" aria-label="Remove {p.item.q}" onclick={() => removeFromShortlist(p.item.id)}>
                      <IconTrash size={14} />
                    </button>
                  </div>
                </td>
                {#each model.cols as c (c.shop.id)}
                  {@const v = p.best[c.shop.id]}
                  <td class="td-shop-val text-right">
                    {#if v}
                      <a class="matrix-price-link" class:min-deal={v.cost === min} href={v.offer.url} target="_blank" rel="noopener noreferrer" title={v.offer.title}>
                        {inr(v.cost)}
                      </a>
                    {:else}
                      <span class="matrix-na-val">{p.ready ? 'Out of stock' : 'Searching...'}</span>
                    {/if}
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
          <tfoot>
            <tr class="tfoot-row">
              <td class="td-tfoot-label">Estimated Shipping</td>
              {#each model.cols as c (c.shop.id)}
                <td class="text-right num muted-val">
                  {#if !c.covers}
                    -
                  {:else if c.shop.aggregator}
                    Not quoted
                  {:else if c.ship}
                    {inr(c.ship)}
                  {:else}
                    Free
                  {/if}
                </td>
              {/each}
            </tr>
            <tr class="tfoot-row total-row">
              <td class="td-tfoot-label bold">Total Cart Spend</td>
              {#each model.cols as c (c.shop.id)}
                <td class="text-right num total-val" class:highlight-price={model.single?.shop.id === c.shop.id}>
                  {#if c.complete}
                    <b>{inr(c.total)}</b>
                  {:else if c.covers}
                    <span class="muted-note">{c.covers} / {model.parts.length} parts</span>
                  {:else}
                    -
                  {/if}
                </td>
              {/each}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <!-- Optimal Split Purchasing Plan -->
    {#if model.split}
      <div class="dashboard-table-card" style="margin-top: 1.5rem">
        <div class="table-card-header">
          <h3>Recommended Split Purchasing Plan</h3>
          <span class="muted-note">Lowest total cost achieved by grouping parts across stores</span>
        </div>

        <table class="saas-data-table">
          <thead>
            <tr>
              <th>Part Requirement</th>
              <th>Selected Distributor</th>
              <th class="text-right">Line Item Cost</th>
              <th class="text-right">Listing</th>
            </tr>
          </thead>
          <tbody>
            {#each model.picks as pk (pk?.part.id)}
              {#if pk}
                <tr class="saas-data-row">
                  <td>
                    <div class="product-info-wrap">
                      <span class="product-title">{pk.part.qty} x {pk.part.q}</span>
                      <span class="product-sub-note">{pk.offer.title}</span>
                    </div>
                  </td>
                  <td>
                    <span class="store-tag-pill">{shopName(pk.shopId)}</span>
                  </td>
                  <td class="text-right num">
                    <span class="cell-total-val highlight-price">{inr(pk.cost)}</span>
                  </td>
                  <td class="text-right">
                    <a class="table-action-link-btn" href={pk.offer.url} target="_blank" rel="noopener noreferrer" aria-label="Open listing">
                      <IconLink size={15} />
                    </a>
                  </td>
                </tr>
              {/if}
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {/if}
</div>
