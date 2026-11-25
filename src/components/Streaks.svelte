<script lang="ts">
  import { app } from "../lib/app.svelte";

  const byId = $derived(new Map(app.categories.map((c) => [c.id, c])));
</script>

{#if app.streaks.length}
  <div class="streaks">
    {#each app.streaks as s (s.categoryId)}
      {@const cat = byId.get(s.categoryId)}
      {#if cat}
        <div class="streak" class:pending={!s.doneToday}
          title={s.doneToday ? `Record : ${s.best} jours` : `Pas encore aujourd'hui · record : ${s.best} jours`}>
          <span class="flame">🔥</span>
          <strong>{s.current}</strong>
          <span>jours de {cat.name.toLowerCase()} {cat.icon ?? ""}</span>
          {#if !s.doneToday}<span class="todo">· à faire aujourd'hui</span>{/if}
        </div>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .streaks { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-bottom: 28px; }
  .streak {
    display: flex; align-items: center; gap: 6px; padding: 6px 14px;
    background: var(--surface); border: 1px solid var(--border); border-radius: 999px; font-size: 14px;
  }
  .streak strong { color: var(--accent); font-size: 16px; }
  .pending { opacity: 0.75; border-style: dashed; }
  .todo { color: var(--text-muted); font-size: 12px; }
</style>
