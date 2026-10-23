<script>
  import IconBookmark from '@lucide/svelte/icons/bookmark'
  import IconSearch from '@lucide/svelte/icons/search'
  import IconArrow from '@lucide/svelte/icons/arrow-up-right'
  import IconTrash from '@lucide/svelte/icons/trash-2'
  import { settings, go, toggleSaved } from '../lib/store.svelte.js'

  const saved = $derived(settings.saved)
  const savedCount = $derived(saved.length)

  function open(term) {
    go('search', { q: term })
  }
</script>

<div class="page-container">
  <header class="dashboard-header">
    <div class="header-left">
      <div class="header-title-row">
        <h1 class="header-title">Saved Searches</h1>
        <span class="header-status-badge">{savedCount} saved</span>
      </div>
      <p class="header-subtitle">Your bookmarked parts. Open any search to compare live offers across every connected shop.</p>
    </div>
    <div class="header-actions">
      <button class="btn secondary" type="button" onclick={() => go('search')}>
        <IconSearch size={15} />
        <span>New search</span>
      </button>
    </div>
  </header>

  {#if savedCount === 0}
    <div class="dashboard-empty-card">
      <div class="empty-icon-wrap"><IconBookmark size={34} /></div>
      <h3>No saved searches yet</h3>
      <p>Run a search and hit "Save Search" to keep it here for quick price checks later.</p>
      <button class="btn primary" type="button" onclick={() => go('search')}>
        <IconSearch size={15} />
        <span>Find parts</span>
      </button>
    </div>
  {:else}
    <div class="saved-searches-grid">
      {#each saved as term, index (term)}
        <article class="saved-search-card">
          <div class="saved-search-top">
            <span class="saved-search-index">{String(index + 1).padStart(2, '0')}</span>
            <button
              class="saved-search-remove"
              type="button"
              onclick={() => toggleSaved(term)}
              aria-label="Remove {term}"
              title="Remove saved search"
            >
              <IconTrash size={14} />
            </button>
          </div>

          <button class="saved-search-query" type="button" onclick={() => open(term)} title="Search {term}">
            <IconBookmark size={16} />
            <span>{term}</span>
          </button>

          <div class="saved-search-foot">
            <span class="saved-search-hint">Live shops ready</span>
            <button class="saved-search-open" type="button" onclick={() => open(term)}>
              <span>Compare prices</span>
              <IconArrow size={14} />
            </button>
          </div>
        </article>
      {/each}
    </div>

    <div class="saved-search-footer">
      <span class="muted-note">{savedCount} saved searches · prices refresh when you open one</span>
      <button class="btn secondary" type="button" onclick={() => go('search')}>
        <IconSearch size={15} />
        <span>Add another search</span>
      </button>
    </div>
  {/if}
</div>
