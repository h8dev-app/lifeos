<script lang="ts">
  import { guard, reloadTasks } from "../lib/app.svelte";
  import { deleteTask, postponeTask, setTaskDone, type Task } from "../lib/db/tasks";
  import { formatDay, today } from "../lib/dates";
  import { priorityOf } from "../lib/tasks/board";
  import { app } from "../lib/app.svelte";

  // `compact`: dashboard version (no postpone/delete buttons).
  let { tasks, compact = false }: { tasks: Task[]; compact?: boolean } = $props();

  const run = (action: () => Promise<void>) => guard(async () => { await action(); await reloadTasks(); });
  const overdue = (t: Task) => !t.doneAt && t.dueDate !== null && t.dueDate < today();
</script>

<ul>
  {#each tasks as t (t.id)}
    <li class:done={t.doneAt}>
      <input
        type="checkbox"
        checked={!!t.doneAt}
        onchange={(e) => run(() => setTaskDone(t.id, e.currentTarget.checked))}
        aria-label="Faite"
      />
      <span class="prio" title="Priorité {priorityOf(t.priority).label.toLowerCase()}">{priorityOf(t.priority).dot}</span>
      <span class="title">{t.title}</span>
      {#if t.categoryId}
        {@const cat = app.taskCategories.find((c) => c.id === t.categoryId)}
        {#if cat}<span class="cat" style:color={cat.color}>#{cat.name}</span>{/if}
      {/if}
      {#if t.dueDate}
        <span class="due" class:late={overdue(t)} title="Échéance">⏰ {formatDay(t.dueDate)}</span>
      {/if}
      {#if !compact && !t.doneAt}
        <button onclick={() => run(() => postponeTask(t.id))} title="Reporter à demain">→ demain</button>
        <button class="del" onclick={() => run(() => deleteTask(t.id))} aria-label="Supprimer">×</button>
      {/if}
    </li>
  {/each}
</ul>

<style>
  ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  li {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 12px; background: var(--surface); border-radius: 8px;
  }
  input { width: 18px; height: 18px; accent-color: var(--accent); cursor: pointer; }
  .prio { font-size: 10px; }
  .cat { font-size: 12px; white-space: nowrap; }
  .title { flex: 1; }
  .done .title { text-decoration: line-through; color: var(--text-muted); }
  .due { font-size: 13px; color: var(--text-muted); }
  .late { color: var(--error); }
  button {
    background: none; border: 1px solid transparent; border-radius: 6px;
    color: var(--text-muted); cursor: pointer; font-size: 13px; padding: 2px 6px;
    opacity: 0; transition: opacity 0.15s;
  }
  li:hover button, button:focus-visible { opacity: 1; }
  button:hover { border-color: var(--border); color: var(--text); }
  .del { font-size: 18px; }
  .del:hover { color: var(--error); }
</style>
