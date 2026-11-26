<script lang="ts">
  // One-line feedback above the command bar.
  import type { ToastKind } from "../lib/app.svelte";
  import Icon from "./Icon.svelte";
  let { message, kind = "info" }: { message: string; kind?: ToastKind } = $props();
</script>

{#if message}
  {#key message}
  <p class="toast glass-strong anim-drop {kind}" role="status">
    <Icon name={kind === "ok" ? "circle-check" : kind === "error" ? "circle-alert" : "info"} size={15} />
    <span>{message}</span>
  </p>
  {/key}
{/if}

<style>
  .toast {
    margin: 0;
    display: flex; align-items: center; gap: 8px;
    max-width: min(760px, 100%);
    padding: 6px 14px 6px 10px;
    border-radius: 999px;
    font-size: 14px;
    color: var(--text-muted);
  }
  .ok { color: var(--ok); }
  .error { color: var(--error); }
</style>
