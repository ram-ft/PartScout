<script>
  import IconPalette from '@lucide/svelte/icons/palette'
  import IconTable from '@lucide/svelte/icons/table-2'
  import IconStore from '@lucide/svelte/icons/store'
  import IconDb from '@lucide/svelte/icons/database'
  import IconSun from '@lucide/svelte/icons/sun'
  import IconMoon from '@lucide/svelte/icons/moon'
  import IconMonitor from '@lucide/svelte/icons/monitor'
  import IconPlus from '@lucide/svelte/icons/plus'
  import IconX from '@lucide/svelte/icons/x'
  import IconDownload from '@lucide/svelte/icons/download'
  import IconUpload from '@lucide/svelte/icons/upload'
  import IconArrow from '@lucide/svelte/icons/arrow-up-right'
  import { settings, shortlist, meta, sourceList, ruleFor, toggleSource, toggleMarketplace } from '../lib/store.svelte.js'
  import Seg from '../lib/Seg.svelte'
  import Switch from '../lib/Switch.svelte'

  const swatches = ['#b65a36', '#8a6a3b', '#5d7a5f', '#5b6f82', '#7b5a6b', '#a94e42']
  let domain = $state('')
  let domainError = $state('')
  let importError = $state('')

  const columnNames = [
    ['source', 'Shop name'],
    ['pack', 'Pack size'],
    ['unit', 'Per piece price'],
    ['total', 'Total for quantity'],
    ['stock', 'Stock status']
  ]

  function addDomain(e) {
    e.preventDefault()
    const d = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(d)) {
      domainError = 'Enter a shop domain such as example.com'
      return
    }
    if (sourceList().some((s) => s.id === d || s.domain === d)) {
      domainError = 'Already added'
      return
    }
    settings.customDomains.push(d)
    domain = ''
    domainError = ''
  }

  function removeDomain(d) {
    settings.customDomains.splice(settings.customDomains.indexOf(d), 1)
  }

  function setRule(id, field, value) {
    const v = Math.max(0, Number(value) || 0)
    settings.ship[id] = { ...ruleFor(id), [field]: v }
  }

  function exportAll() {
    const blob = new Blob([JSON.stringify({ settings: $state.snapshot(settings), shortlist: $state.snapshot(shortlist.items) }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'partscout-settings.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function importAll(e) {
    importError = ''
    const file = e.currentTarget.files?.[0]
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text())
      if (parsed.settings && typeof parsed.settings === 'object') {
        for (const [k, v] of Object.entries(parsed.settings)) if (k in settings) settings[k] = v
      }
      if (Array.isArray(parsed.shortlist)) shortlist.items = parsed.shortlist
    } catch {
      importError = 'That file could not be read'
    }
    e.currentTarget.value = ''
  }

  function clearHistory() {
    settings.recent = []
    settings.saved = []
  }
</script>

<div class="page-container">
  <header class="dashboard-header">
    <div class="header-left">
      <div class="header-title-row">
        <h1 class="header-title">Preferences & Store Rules</h1>
        <span class="header-status-badge">Configuration</span>
      </div>
      <p class="header-subtitle">Customize theme appearance, distributor connections, and localized shipping delivery thresholds.</p>
    </div>
    <div class="header-actions">
      <button class="btn secondary" onclick={exportAll}>
        <IconDownload size={15} />
        <span>Backup Settings</span>
      </button>
    </div>
  </header>

  <div class="settings-sections-grid">
    <!-- Appearance Section -->
    <div class="dashboard-table-card settings-card">
      <div class="table-card-header">
        <div class="card-header-icon-box"><IconPalette size={18} /></div>
        <div>
          <h3>Theme & Appearance</h3>
          <span class="muted-note">Visual theme, accent palette and element geometry</span>
        </div>
      </div>

      <div class="settings-rows-list">
        <div class="settings-row">
          <div class="settings-row-text">
            <span class="settings-row-title">Color Theme</span>
            <span class="settings-row-desc">Switch between light, dark, or system preference</span>
          </div>
          <Seg
            label="Theme"
            bind:value={settings.theme}
            options={[
              { value: 'system', icon: IconMonitor, title: 'System' },
              { value: 'light', icon: IconSun, title: 'Light' },
              { value: 'dark', icon: IconMoon, title: 'Dark' }
            ]}
          />
        </div>

        <div class="settings-row">
          <div class="settings-row-text">
            <span class="settings-row-title">Accent Color</span>
            <span class="settings-row-desc">Accent for highlights, focus rings and primary actions</span>
          </div>
          <div class="swatches-wrap">
            {#each swatches as c (c)}
              <button
                class="swatch-circle-btn"
                class:active-swatch={settings.accent === c}
                style="background:{c}"
                aria-label="Accent {c}"
                onclick={() => (settings.accent = c)}
              ></button>
            {/each}
            <input class="custom-color-picker" type="color" bind:value={settings.accent} aria-label="Custom accent color" />
          </div>
        </div>

        <div class="settings-row">
          <div class="settings-row-text">
            <span class="settings-row-title">Workspace Density</span>
            <span class="settings-row-desc">Adjust table row heights and spacing</span>
          </div>
          <Seg
            label="Density"
            bind:value={settings.density}
            options={[
              { value: 'comfortable', label: 'Comfortable' },
              { value: 'compact', label: 'Compact' }
            ]}
          />
        </div>

        <div class="settings-row">
          <div class="settings-row-text">
            <span class="settings-row-title">Curved Corners</span>
            <span class="settings-row-desc">Border radius of cards, inputs and badges</span>
          </div>
          <Seg
            label="Corners"
            bind:value={settings.radius}
            options={[
              { value: 'soft', label: 'Subtle' },
              { value: 'round', label: 'Smooth Curved' }
            ]}
          />
        </div>

        <div class="settings-row">
          <div class="settings-row-text">
            <span class="settings-row-title">Text Scale: {settings.fontScale}%</span>
            <span class="settings-row-desc">Scale overall interface text size</span>
          </div>
          <input class="range-slider-input" type="range" min="85" max="125" step="5" bind:value={settings.fontScale} aria-label="Text size" />
        </div>
      </div>
    </div>

    <!-- Results Display Section -->
    <div class="dashboard-table-card settings-card">
      <div class="table-card-header">
        <div class="card-header-icon-box"><IconTable size={18} /></div>
        <div>
          <h3>Results Display</h3>
          <span class="muted-note">Table layout options, default sorting and visible columns</span>
        </div>
      </div>

      <div class="settings-rows-list">
        <div class="settings-row">
          <div class="settings-row-text">
            <span class="settings-row-title">Default Layout</span>
            <span class="settings-row-desc">Choose between table rows or card grid</span>
          </div>
          <Seg
            label="Layout"
            bind:value={settings.layout}
            options={[
              { value: 'table', label: 'Table' },
              { value: 'grid', label: 'Cards' }
            ]}
          />
        </div>

        <div class="settings-row">
          <div class="settings-row-text">
            <span class="settings-row-title">Hide Out-of-Stock</span>
            <span class="settings-row-desc">Only display parts with confirmed inventory</span>
          </div>
          <Switch bind:checked={settings.inStockOnly} label="Hide out of stock" />
        </div>

        <div class="settings-row">
          <div class="settings-row-text">
            <span class="settings-row-title">Include Shipping in Totals</span>
            <span class="settings-row-desc">Calculate landed costs including store delivery rules</span>
          </div>
          <Switch bind:checked={settings.includeShipping} label="Add shipping to totals" />
        </div>

        <div class="settings-row">
          <div class="settings-row-text">
            <span class="settings-row-title">Marketplace Search Shops</span>
            <span class="settings-row-desc">Show Amazon, Flipkart and distributor shops in the main shops list</span>
          </div>
          <Switch bind:checked={settings.showLinkouts} label="Show marketplace links" />
        </div>

        {#each columnNames as [key, name] (key)}
          <div class="settings-row">
            <div class="settings-row-text">
              <span class="settings-row-title">Column: {name}</span>
            </div>
            <Switch bind:checked={settings.columns[key]} label="Show {name}" />
          </div>
        {/each}
      </div>
    </div>

    <!-- Connected Distributors & Shipping Rules -->
    <div class="dashboard-table-card settings-card full-span">
      <div class="table-card-header">
        <div class="card-header-icon-box"><IconStore size={18} /></div>
        <div>
          <h3>Connected Distributors & Shipping Delivery Rules</h3>
          <span class="muted-note">Manage live connectors and delivery rules, plus the marketplace search shops shown in the shops bar</span>
        </div>
      </div>

      <div class="settings-rows-list">
        <div class="stores-group-heading">
          <span class="stores-group-title">Live connectors</span>
          <span class="stores-group-count">{sourceList().length} shops</span>
        </div>

        <div class="stores-config-grid">
          {#each sourceList() as s (s.id)}
            {@const r = ruleFor(s.id)}
            <div class="store-config-item-card">
              <div class="store-item-top">
                <span class="store-item-name">{s.name}{#if s.custom}<span class="custom-badge">&nbsp;(Custom)</span>{/if}{#if s.aggregator}<span class="custom-badge">&nbsp;(Marketplace feed)</span>{/if}</span>
                <span class="store-item-actions">
                  {#if s.custom}
                    <button class="table-action-delete-btn" aria-label="Remove {s.name}" onclick={() => removeDomain(s.id)}>
                      <IconX size={14} />
                    </button>
                  {/if}
                  <Switch checked={!settings.disabledSources.includes(s.id)} label="Use {s.name}" onchange={() => toggleSource(s.id)} />
                </span>
              </div>
              {#if s.aggregator}
                <p class="store-feed-note">Marketplace listings via Google Shopping. Shipping is not quoted by this feed, so it is excluded from totals.</p>
              {:else}
                <div class="store-ship-inputs-row">
                  <label class="ship-input-label">
                    <span>Flat Delivery (INR)</span>
                    <input class="input num" type="number" min="0" value={r.flat} aria-label="{s.name} flat shipping" oninput={(e) => setRule(s.id, 'flat', e.currentTarget.value)} />
                  </label>
                  <label class="ship-input-label">
                    <span>Free Above (INR)</span>
                    <input class="input num" type="number" min="0" value={r.freeAbove} aria-label="{s.name} free shipping threshold" oninput={(e) => setRule(s.id, 'freeAbove', e.currentTarget.value)} />
                  </label>
                </div>
              {/if}
            </div>
          {/each}
        </div>

        <!-- Add Custom Shopify / WooCommerce Shop -->
        <form class="custom-shop-add-form" onsubmit={addDomain}>
          <div class="search-input-wrap" style="flex: 1">
            <span class="search-icon-slot"><IconPlus size={16} /></span>
            <input class="search-main-input" bind:value={domain} placeholder="Add custom electronics shop domain (e.g. makerbazar.in)..." aria-label="Shop domain" />
          </div>
          <button class="btn primary" type="submit">
            <IconPlus size={15} />
            <span>Connect Shop</span>
          </button>
        </form>
        {#if domainError}
          <div class="dashboard-notice error" style="margin-top: 0.5rem">{domainError}</div>
        {/if}

        {#if meta.marketplaces.length}
          <div class="stores-group-heading marketplace-heading">
            <span class="stores-group-title">Marketplace search shops</span>
            <span class="stores-group-count">{meta.marketplaces.length} shops</span>
          </div>
          <p class="stores-group-note">Search links only — these shops open on-site, so delivery rules apply to live connectors.</p>

          <div class="stores-config-grid marketplace-config-grid">
            {#each meta.marketplaces as m (m.id)}
              <div class="store-config-item-card marketplace-config-card">
                <div class="store-item-top">
                  <span class="store-item-name">{m.name}</span>
                  <Switch
                    checked={!settings.disabledMarketplaces.includes(m.id)}
                    label="Show {m.name}"
                    onchange={() => toggleMarketplace(m.id)}
                  />
                </div>
                <div class="marketplace-meta">
                  <span class="marketplace-domain">{m.domain}</span>
                  <a
                    class="marketplace-open-link"
                    href={`https://${m.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Open {m.name}"
                    title="Open {m.name}"
                  >
                    <span>Visit</span>
                    <IconArrow size={12} />
                  </a>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- Data Management & Backups -->
    <div class="dashboard-table-card settings-card full-span">
      <div class="table-card-header">
        <div class="card-header-icon-box"><IconDb size={18} /></div>
        <div>
          <h3>Data Management & Sync</h3>
          <span class="muted-note">Server synchronization mode, search history and local backup</span>
        </div>
      </div>

      <div class="settings-rows-list">
        <div class="settings-row">
          <div class="settings-row-text">
            <span class="settings-row-title">Server Sync Mode</span>
            <span class="settings-row-desc">{meta.mode === 'auto' ? 'Live distributor prices with sample fallback when a store is offline' : meta.mode === 'live' ? 'Live distributor prices only' : 'Sample catalog data'}</span>
          </div>
          <span class="header-status-badge">{meta.loaded && !meta.error ? meta.mode : 'offline'}</span>
        </div>

        <div class="settings-row">
          <div class="settings-row-text">
            <span class="settings-row-title">Search History</span>
            <span class="settings-row-desc">{settings.saved.length} saved searches, {settings.recent.length} recent queries</span>
          </div>
          <button class="btn secondary" onclick={clearHistory}>
            <span>Clear History</span>
          </button>
        </div>

        <div class="settings-row">
          <div class="settings-row-text">
            <span class="settings-row-title">Backup & Restore</span>
            <span class="settings-row-desc">Export or import your complete configuration and bill of materials JSON file</span>
          </div>
          <div class="btn-group-row">
            <button class="btn secondary" onclick={exportAll}>
              <IconDownload size={15} />
              <span>Export JSON</span>
            </button>
            <label class="btn secondary upload-btn-label">
              <IconUpload size={15} />
              <span>Import JSON</span>
              <input type="file" accept="application/json" hidden onchange={importAll} />
            </label>
          </div>
        </div>
        {#if importError}
          <div class="dashboard-notice error">{importError}</div>
        {/if}
      </div>
    </div>
  </div>
</div>
