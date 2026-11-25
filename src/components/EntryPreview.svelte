<script lang="ts">
  import { app } from "../lib/app.svelte";
  import { formatEntryData } from "../lib/format";
  import { formatWhen } from "../lib/clock";
  import type { PendingEntry } from "../lib/app.svelte";

  // AI proposal: nothing is saved until "Enregistrer".
  let { entry, onconfirm, oncancel }: { entry: PendingEntry; onconfirm: () => void; oncancel: () => void } = $props();

  const category = $derived(app.categories.find((c) => c.id === entry.categoryId));
  let saveButton: HTMLButtonElement | undefined = $state();
  $effect(() => { saveButton?.focus(); });
</script>

{#if category}
  <div class="preview" role="dialog" aria-label="Aperçu de l'entrée proposée par l'IA">
    <p class="src">« {entry.text} »</p>
    <div class="row">
      <span class="dot" style:background={category.color ?? "var(--text-muted)"}></span>
      <strong>{category.icon ?? ""} {category.name}</strong>
      <span class="data">{formatEntryData(category, entry.data)}</span>
      <span class="when">{formatWhen(entry.occurredAt)}</span>
    </div>
    <div class="actions">
      <button bind:this={saveButton} class="ok" onclick={onconfirm}>Enregistrer ↵</button>
      <button onclick={oncancel}>Annuler (Échap)</button>
    </div>
  </div>
{/if}

<style>
  .preview {
    width: min(760px, 100%);
    padding: 12px 16px;
    background: var(--surface-strong);
    border: 1px solid var(--accent);
    border-radius: var(--radius);
    display: flex; flex-direction: column; gap: 8px;
  }
  .src { margin: 0; color: var(--text-muted); font-size: 13px; font-style: italic; }
  .row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .dot { width: 8px; height: 8px; border-radius: 50%; }
  .data { flex: 1; }
  .when { color: var(--text-muted); font-size: 13px; }
  .actions { display: flex; gap: 8px; justify-content: flex-end; }
  button {
    background: var(--surface); border: 1px solid var(--border); color: var(--text);
    border-radius: 8px; padding: 5px 12px; cursor: pointer; font: inherit; font-size: 14px;
  }
  button.ok { border-color: var(--accent); color: var(--accent); }
  button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
</style>
