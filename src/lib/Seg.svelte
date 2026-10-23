<script>
  let { options, value = $bindable(), label = '' } = $props()
</script>

<div class="seg" role="radiogroup" aria-label={label}>
  {#each options as o (o.value)}
    {@const Icon = o.icon}
    <button
      type="button"
      role="radio"
      aria-checked={value === o.value}
      class:on={value === o.value}
      title={o.title ?? o.label}
      onclick={() => (value = o.value)}
    >
      {#if Icon}<Icon size={15} />{/if}
      {#if o.label}<span>{o.label}</span>{/if}
    </button>
  {/each}
</div>
