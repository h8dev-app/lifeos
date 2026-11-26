<script lang="ts">
  import Icon from "./Icon.svelte";
  import { categoryIcon } from "../lib/ui/iconNames";

  // Category icon in the category color; a colored dot when it has none.
  let { icon, color, size = 15 }: { icon: string | null | undefined; color?: string | null; size?: number } = $props();
  const name = $derived(categoryIcon(icon));
</script>

<span class="cat-icon" style:color={color ?? "var(--text-muted)"}>
  {#if name}<Icon {name} {size} />{:else}<span class="dot" style:background={color ?? "var(--text-muted)"}></span>{/if}
</span>

<style>
  .cat-icon { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 18px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; }
</style>
