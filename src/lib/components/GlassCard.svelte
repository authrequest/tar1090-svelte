<script>
  export let glow = false;
  export let blur = 'md';
  export let padding = '1rem';

  // Map visual blur to CSS values
  const blurMap = { sm: '6px', md: '12px', lg: '20px' };
  $: blurValue = blurMap[blur] ?? blurMap.md;
</script>

<div
  class="glass-card"
  class:glass-border-glow={glow}
  style="padding: {padding}; backdrop-filter: blur({blurValue}); -webkit-backdrop-filter: blur({blurValue});"
>
  <slot />
</div>
