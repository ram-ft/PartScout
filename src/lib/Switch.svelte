<script>
  // Two-way with bind:checked, or controlled from outside when onchange is given.
  let { checked = $bindable(false), label = '', onchange } = $props()

  function flip() {
    if (onchange) onchange(!checked)
    else checked = !checked
  }
</script>

<button type="button" role="switch" class="switch" class:on={checked} aria-checked={checked} aria-label={label} onclick={flip}>
  <span class="switch-thumb"></span>
</button>
