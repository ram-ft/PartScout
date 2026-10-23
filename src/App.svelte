<script>
  import IconSearch from '@lucide/svelte/icons/search'
  import IconList from '@lucide/svelte/icons/list-checks'
  import IconBookmark from '@lucide/svelte/icons/bookmark'
  import IconSettings from '@lucide/svelte/icons/settings'
  import IconHistory from '@lucide/svelte/icons/history'
  import IconSun from '@lucide/svelte/icons/sun'
  import IconMoon from '@lucide/svelte/icons/moon'
  import IconPlus from '@lucide/svelte/icons/plus'
  import { route, go, shortlist, settings, loadMeta, applyAppearance } from './lib/store.svelte.js'
  import SearchView from './views/Search.svelte'
  import SavedSearchesView from './views/SavedSearches.svelte'
  import ShortlistView from './views/Shortlist.svelte'
  import CustomizeView from './views/Customize.svelte'

  loadMeta()

  $effect(() => {
    // re-run whenever any appearance setting changes
    settings.theme, settings.accent, settings.density, settings.radius, settings.fontScale
    applyAppearance()
  })

  const nav = [
    { view: 'search', label: 'Search', icon: IconSearch },
    { view: 'saved', label: 'Saved searches', icon: IconBookmark },
    { view: 'shortlist', label: 'Shortlist', icon: IconList }
  ]

  const recent = $derived(settings.recent.slice(0, 6))

  function toggleTheme() {
    const isDark = document.documentElement.dataset.theme === 'dark'
    settings.theme = isDark ? 'light' : 'dark'
  }
</script>

<div class="app-shell">
  <aside class="sidebar">
    <div class="sidebar-brand">
      <svg class="brand-mark" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <g stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
          <path d="M12 2.6v18.8" />
          <path d="M3.9 7.3 20.1 16.7" />
          <path d="M20.1 7.3 3.9 16.7" />
        </g>
      </svg>
      <span class="brand-word">PartScout</span>
    </div>

    <button class="sidebar-new" type="button" onclick={() => go('search')}>
      <IconPlus size={16} />
      <span>New search</span>
    </button>

    <nav class="sidebar-nav" aria-label="Main Navigation">
      {#each nav as n (n.view)}
        {@const Icon = n.icon}
        <button
          class="sidebar-link"
          class:active={route.view === n.view}
          aria-label={n.label}
          aria-current={route.view === n.view ? 'page' : undefined}
          onclick={() => go(n.view, n.view === 'search' ? route.params : {})}
        >
          <Icon size={17} />
          <span class="side-label">{n.label}</span>
          {#if n.view === 'saved' && settings.saved.length}
            <span class="side-count">{settings.saved.length}</span>
          {:else if n.view === 'shortlist' && shortlist.items.length}
            <span class="side-count">{shortlist.items.length}</span>
          {/if}
        </button>
      {/each}
    </nav>

    {#if recent.length}
      <section class="sidebar-recent" aria-label="Recent searches">
        <span class="sidebar-section-label">Recent searches</span>
        <div class="sidebar-recent-list">
          {#each recent as term (term)}
            <button
              class="sidebar-recent-link"
              class:active={route.view === 'search' && route.params.q === term}
              type="button"
              title={term}
              onclick={() => go('search', { q: term })}
            >
              <IconHistory size={14} />
              <span>{term}</span>
            </button>
          {/each}
        </div>
      </section>
    {/if}

    <div class="sidebar-footer">
      <button
        class="sidebar-link"
        class:active={route.view === 'customize'}
        type="button"
        onclick={() => go('customize')}
        aria-label="Settings"
        aria-current={route.view === 'customize' ? 'page' : undefined}
      >
        <IconSettings size={17} />
        <span class="side-label">Settings</span>
      </button>
      <button
        class="sidebar-link"
        type="button"
        onclick={toggleTheme}
        title="Toggle light / dark mode"
        aria-label="Toggle theme"
      >
        <span class="theme-icon-wrap">
          <IconSun size={16} class="sun-icon" />
          <IconMoon size={16} class="moon-icon" />
        </span>
        <span class="side-label">Theme</span>
      </button>
    </div>
  </aside>

  <main class="main-canvas">
    <div class="canvas-scroll">
      {#if route.view === 'saved'}
        <SavedSearchesView />
      {:else if route.view === 'shortlist'}
        <ShortlistView />
      {:else if route.view === 'customize'}
        <CustomizeView />
      {:else}
        <SearchView />
      {/if}
    </div>
  </main>
</div>
