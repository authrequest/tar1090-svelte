<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  // Props
  // Variant of the glass button: primary is more prominent, secondary is subtle
  export let variant: 'primary' | 'secondary' = 'primary';
  // Size variants with inline sizing per requirements
  export let size: 'sm' | 'md' | 'lg' = 'md';
  // Active state toggles an additional class for styling feedback
  export let active: boolean = false;
  // Optional onclick handler passed as a prop
  export let onclick: ((e: MouseEvent) => void) | undefined;

  const dispatch = createEventDispatcher();

  // Inline sizing values as requested
  const sizeMap = {
    sm: { paddingY: '0.4rem', paddingX: '0.8rem' },
    md: { paddingY: '0.5rem', paddingX: '1rem' },
    lg: { paddingY: '0.75rem', paddingX: '1.5rem' }
  } as const;

  // Reactive values for padding based on selected size
  $: padY = sizeMap[size]?.paddingY ?? '0.5rem';
  $: padX = sizeMap[size]?.paddingX ?? '1rem';

  // Click handling: call provided onclick prop and emit a click event for consumers
  function handleClick(e: MouseEvent) {
    if (typeof onclick === 'function') onclick!(e);
    dispatch('click', e);
  }
</script>

<button
  type="button"
  class={`glass-button ${variant === 'primary' ? 'GlassButton--primary' : 'GlassButton--secondary'} ${active ? 'active' : ''}`}
  style={`padding: ${padY} ${padX};`}
  on:click={handleClick}
  {...$$restProps}
>
  <slot />
</button>

<style>
  /* Keep the base look to rely on existing .glass-button styling */
  :global(.glass-button) {
    /* Ensure smoothness if the base CSS lacks transitions */
    transition: all 0.2s ease;
  }

  /* Variant shorthands that piggyback on the existing glass-button class */
  :global(.GlassButton--primary) {
    /* Slight elevation to make primary pop without duplicating full CSS */
    filter: saturate(110%);
  }
  :global(.GlassButton--secondary) {
    /* Subtle appearance for secondary variant */
    filter: saturate(95%);
  }
  /* Active state visual cue */
  :global(.glass-button.active) {
    outline: 2px solid rgba(255, 255, 255, 0.8);
  }
</style>
