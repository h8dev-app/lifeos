<script lang="ts">
  // One-line feedback above the command bar.
  import type { ToastKind } from "../lib/app.svelte";
  let { message, kind = "info" }: { message: string; kind?: ToastKind } = $props();
</script>

{#if message}
  <p class="toast glass-strong {kind}" role="status">{message}</p>
{/if}

<style>
  .toast {
    margin: 0;
    max-width: min(760px, 100%);
    padding: 6px 12px;
    border-radius: 999px;
    font-size: 14px;
    color: var(--text-muted);
  }
  .ok { color: var(--ok); }
  .error { color: var(--error); }
</style>
