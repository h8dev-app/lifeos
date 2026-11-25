<script lang="ts">
  import type { Category } from "../lib/types";

  // Reminder of the available commands, under the bar. Click → fills the bar.
  let { categories, onpick }: { categories: Category[]; onpick: (cmd: string) => void } = $props();
  const visible = $derived(categories.filter((c) => !c.isSystem));
</script>

<div class="chips">
  {#each visible as c (c.id)}
    <button onclick={() => onpick(`/${c.slug} `)} title={c.schema.fields.map((f) => f.label).join(", ")}>
      {c.icon ?? ""} /{c.slug}
    </button>
  {/each}
  <button class="new" onclick={() => onpick("/cat ")}>+ /cat</button>
</div>

<style>
  .chips { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; }
  button {
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text-muted);
    border-radius: 999px;
    padding: 3px 10px;
    font: 13px var(--mono);
    cursor: pointer;
  }
  button:hover { color: var(--text); border-color: var(--accent); }
  .new { border-style: dashed; }
</style>
