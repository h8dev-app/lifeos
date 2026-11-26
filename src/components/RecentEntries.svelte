<script lang="ts">
  import type { RecentEntry } from "../lib/db/entries";
  import type { Category } from "../lib/types";
  import { formatEntryData } from "../lib/format";
  import { formatWhen } from "../lib/clock";

  let {
    entries,
    categories,
    ondelete,
  }: { entries: RecentEntry[]; categories: Category[]; ondelete: (id: string) => void } = $props();

  const byId = $derived(new Map(categories.map((c) => [c.id, c])));
</script>

<section>
  <h2>Dernières entrées</h2>
  {#if entries.length === 0}
    <p class="empty">Aucune entrée. Essaie <code>/sport course 5km 28min</code>.</p>
  {:else}
    <ul>
      {#each entries as e (e.id)}
        {@const cat = byId.get(e.categoryId)}
        <li>
          <span class="dot" style:background={cat?.color ?? "var(--text-muted)"}></span>
          <span class="icon">{cat?.icon ?? "•"}</span>
          <span class="name">{cat?.name ?? "?"}</span>
          <span class="data">{cat ? formatEntryData(cat, e.data) : ""}</span>
          <span class="when">{formatWhen(e.occurredAt)}</span>
          <button title="Supprimer" aria-label="Supprimer l'entrée" onclick={() => ondelete(e.id)}>×</button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  section { min-width: 0; }
  h2 { font-size: 13px; font-weight: 600; color: var(--text-muted); }
  ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  li {
    display: grid;
    grid-template-columns: 8px 24px 110px 1fr auto 24px;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: var(--surface);
    border-radius: 8px;
  }
  .dot { width: 8px; height: 8px; border-radius: 50%; }
  .name { font-weight: 600; }
  .data { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .when { color: var(--text-muted); font-size: 13px; font-variant-numeric: tabular-nums; }
  button {
    background: none; border: none; color: var(--text-muted); font-size: 18px; cursor: pointer;
    opacity: 0; transition: opacity 0.15s;
  }
  li:hover button, button:focus-visible { opacity: 1; }
  button:hover { color: var(--error); }
  .empty { color: var(--text-muted); }
  code { font-family: var(--mono); color: var(--text); }
</style>
