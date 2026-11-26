<script lang="ts">
  import { app } from "../lib/app.svelte";
  import type { Task } from "../lib/db/tasks";
  import { addDays, formatDay, today } from "../lib/dates";
  import { priorityOf } from "../lib/tasks/board";

  // One kanban card. Click = open; Ctrl/Shift+click or the checkbox = select.
  let {
    task, selected, selecting, onselect, onopen, oncycle, ondragstart,
  }: {
    task: Task;
    selected: boolean;
    selecting: boolean;
    onselect: () => void;
    onopen: () => void;
    oncycle: () => void;
    ondragstart: (e: DragEvent) => void;
  } = $props();

  const category = $derived(app.taskCategories.find((c) => c.id === task.categoryId));
  const done = $derived(task.status === "done");
  const late = $derived(!done && task.dueDate !== null && task.dueDate < today());
  const later = $derived(!done && task.plannedFor !== null && task.plannedFor > today());
  const prio = $derived(priorityOf(task.priority));

  function click(e: MouseEvent) {
    if (e.ctrlKey || e.metaKey || e.shiftKey || selecting) onselect();
    else onopen();
  }
</script>

<div class="card" class:selected class:done role="button" tabindex="0" draggable="true"
  style:border-left-color={category?.color ?? "transparent"}
  onclick={click} {ondragstart}
  onkeydown={(e) => { if (e.key === "Enter") onopen(); if (e.key === " ") { e.preventDefault(); onselect(); } }}>
  <div class="top">
    <input type="checkbox" class="check" class:visible={selecting} checked={selected}
      onclick={(e) => { e.stopPropagation(); onselect(); }} aria-label="Sélectionner" />
    <button class="prio" title="Priorité {prio.label.toLowerCase()} (clic pour changer)"
      onclick={(e) => { e.stopPropagation(); oncycle(); }}>{prio.dot}</button>
    <span class="title">{task.title}</span>
  </div>
  {#if category || task.dueDate || later}
    <div class="meta">
      {#if category}<span class="tag" style:color={category.color}>#{category.name}</span>{/if}
      {#if task.dueDate}<span class:late>⏰ {formatDay(task.dueDate)}</span>{/if}
      {#if later}<span title="Reportée">📅 {task.plannedFor === addDays(today(), 1) ? "demain" : formatDay(task.plannedFor!)}</span>{/if}
    </div>
  {/if}
</div>

<style>
  .card {
    display: flex; flex-direction: column; gap: 6px; padding: 10px 12px;
    background: var(--surface-strong); border: 1px solid var(--border); border-left: 3px solid transparent;
    border-radius: 10px; cursor: pointer; user-select: none;
  }
  .card:hover { border-color: var(--accent); }
  .card:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
  .card.selected { background: rgba(122, 162, 255, 0.18); border-color: var(--accent); }
  .top { display: flex; align-items: flex-start; gap: 8px; }
  .check { margin: 3px 0 0; accent-color: var(--accent); width: 15px; height: 15px; cursor: pointer; opacity: 0; transition: opacity 0.1s; flex-shrink: 0; }
  .card:hover .check, .check.visible, .card.selected .check { opacity: 1; }
  .prio { background: none; border: none; padding: 0; font-size: 11px; line-height: 20px; cursor: pointer; flex-shrink: 0; }
  .title { flex: 1; line-height: 1.4; overflow-wrap: anywhere; }
  .done .title { text-decoration: line-through; color: var(--text-muted); }
  .meta { display: flex; flex-wrap: wrap; gap: 8px; font-size: 12px; color: var(--text-muted); padding-left: 42px; }
  .tag { font-weight: 600; }
  .late { color: var(--error); }
</style>
