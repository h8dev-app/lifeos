<script lang="ts">
  import Icon from "../components/Icon.svelte";
  import { flip } from "svelte/animate";
  import { crossfade, scale } from "svelte/transition";

  // A card moved to another column flies there; others slide into place.
  const [send, receive] = crossfade({
    duration: 280,
    fallback: (node) => scale(node, { start: 0.94, duration: 180 }),
  });
  import { onMount } from "svelte";
  import TaskCard from "../components/TaskCard.svelte";
  import TaskDialog, { type TaskForm } from "../components/TaskDialog.svelte";
  import { app, guard, reloadTasks, say } from "../lib/app.svelte";
  import {
    addTask, deleteTaskCategory, deleteTasks, ensureTaskCategory, setTasksCategory, setTasksPriority,
    setTasksStatus, updateTask, type Task,
  } from "../lib/db/tasks";
  import { groupByStatus, nextPriority, PRIORITIES, STATUSES, type Priority, type TaskStatus } from "../lib/tasks/board";
  import { onEscape } from "../lib/overlay";
  import Select from "../components/Select.svelte";

  const ALL = "__all__";
  const NONE = "__none__";

  let filter = $state<string>(ALL); // ALL, NONE or a category id
  let selected = $state<Set<string>>(new Set());
  let editing = $state<Task | null>(null);
  let creating = $state<TaskStatus | null>(null);
  let dropTarget = $state<TaskStatus | null>(null);
  let newCatMode = $state(false);
  let newCatName = $state("");
  let confirmBulkDelete = $state(false);
  let confirmCatDelete = $state<string | null>(null);

  const visible = $derived(
    filter === ALL ? app.tasks
    : filter === NONE ? app.tasks.filter((t) => !t.categoryId)
    : app.tasks.filter((t) => t.categoryId === filter),
  );
  const columns = $derived(groupByStatus(visible));
  const selecting = $derived(selected.size > 0);
  const count = (id: string | null) => app.tasks.filter((t) => t.categoryId === id && t.status !== "done").length;

  // Escape: first clears the selection, then (App) closes the overlay.
  onMount(() => onEscape(() => {
    if (selected.size === 0) return false;
    clearSelection();
    return true;
  }));

  const run = async (action: () => Promise<unknown>) => {
    await guard(async () => { await action(); await reloadTasks(); });
  };

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    selected = next;
    confirmBulkDelete = false;
  }

  function clearSelection() {
    selected = new Set();
    confirmBulkDelete = false;
  }

  function selectColumn(status: TaskStatus) {
    selected = new Set([...selected, ...columns[status].map((t) => t.id)]);
  }

  // ----- drag & drop between columns (moves the whole selection if the card is selected)
  function dragStart(e: DragEvent, task: Task) {
    const ids = selected.has(task.id) ? [...selected] : [task.id];
    e.dataTransfer?.setData("text/plain", JSON.stringify(ids));
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
  }

  async function drop(e: DragEvent, status: TaskStatus) {
    e.preventDefault();
    dropTarget = null;
    let ids: string[] = [];
    try { ids = JSON.parse(e.dataTransfer?.getData("text/plain") ?? "[]"); } catch { return; }
    if (!Array.isArray(ids) || ids.length === 0) return;
    await run(() => setTasksStatus(ids, status));
    if (ids.length > 1) clearSelection();
  }

  // ----- bulk actions
  async function bulkStatus(status: TaskStatus) {
    const n = selected.size;
    await run(() => setTasksStatus([...selected], status));
    say(`${n} tâche(s) → ${STATUSES.find((s) => s.id === status)!.label}.`);
    clearSelection();
  }
  async function bulkPriority(p: Priority) {
    await run(() => setTasksPriority([...selected], p));
    clearSelection();
  }
  async function bulkCategory(value: string) {
    const id = value === NONE ? null : value;
    await run(() => setTasksCategory([...selected], id));
    clearSelection();
  }
  async function bulkDelete() {
    if (!confirmBulkDelete) { confirmBulkDelete = true; return; }
    const n = selected.size;
    await run(() => deleteTasks([...selected]));
    say(`${n} tâche(s) supprimée(s).`);
    clearSelection();
  }

  // ----- dialog
  async function categoryIdOf(f: TaskForm): Promise<string | null> {
    return f.newCategory ? ensureTaskCategory(f.newCategory) : f.categoryId;
  }

  async function saveForm(f: TaskForm) {
    const task = editing;
    const status = creating;
    editing = null;
    creating = null;
    await run(async () => {
      const categoryId = await categoryIdOf(f);
      if (task) {
        await updateTask(task.id, { title: f.title, dueDate: f.dueDate, categoryId, priority: f.priority });
        if (f.status !== task.status) await setTasksStatus([task.id], f.status);
      } else if (status) {
        await addTask({ title: f.title, dueDate: f.dueDate, categoryId, priority: f.priority, status: f.status });
      }
    });
  }

  async function deleteEditing() {
    const task = editing;
    editing = null;
    if (task) await run(() => deleteTasks([task.id]));
  }

  // ----- categories
  async function addCategory() {
    const name = newCatName.trim();
    newCatMode = false;
    newCatName = "";
    if (!name) return;
    const id = await guard(() => ensureTaskCategory(name));
    await reloadTasks();
    if (id) filter = id;
  }

  async function removeCategory(id: string) {
    if (confirmCatDelete !== id) { confirmCatDelete = id; return; }
    confirmCatDelete = null;
    await run(() => deleteTaskCategory(id));
    if (filter === id) filter = ALL;
    say("Catégorie supprimée, ses tâches sont maintenant sans catégorie.");
  }
</script>

<section class="board">
  <div class="filters glass">
    <button class="chip" class:active={filter === ALL} onclick={() => (filter = ALL)}>Toutes</button>
    {#each app.taskCategories as c (c.id)}
      <span class="chip-wrap">
        <button class="chip" class:active={filter === c.id} onclick={() => (filter = c.id)}>
          <span class="dot" style:background={c.color}></span>{c.name}<span class="n">{count(c.id)}</span>
        </button>
        <button class="chip-x" class:confirm={confirmCatDelete === c.id} onclick={() => removeCategory(c.id)}
          onblur={() => (confirmCatDelete = null)}
          title="Supprimer la catégorie" aria-label="Supprimer la catégorie {c.name}">
          {#if confirmCatDelete === c.id}Supprimer ?{:else}<Icon name="x" size={12} />{/if}
        </button>
      </span>
    {/each}
    <button class="chip" class:active={filter === NONE} onclick={() => (filter = NONE)}>
      <span class="muted">Sans catégorie</span><span class="n">{count(null)}</span>
    </button>
    {#if newCatMode}
      <!-- svelte-ignore a11y_autofocus -->
      <input class="cat-input" placeholder="Nom de la catégorie" bind:value={newCatName} autofocus
        onkeydown={(e) => { if (e.key === "Enter") addCategory(); if (e.key === "Escape") { e.stopPropagation(); newCatMode = false; } }}
        onblur={addCategory} />
    {:else}
      <button class="chip add" onclick={() => (newCatMode = true)}><Icon name="plus" size={13} /> Catégorie</button>
    {/if}
    <span class="grow"></span>
    <button class="new" onclick={() => (creating = "todo")}><Icon name="plus" size={15} /> Nouvelle tâche</button>
  </div>

  <div class="columns">
    {#each STATUSES as col (col.id)}
      <div class="column glass" class:drop={dropTarget === col.id} role="list" aria-label={col.label}
        ondragover={(e) => { e.preventDefault(); dropTarget = col.id; }}
        ondragleave={(e) => { if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) dropTarget = null; }}
        ondrop={(e) => drop(e, col.id)}>
        <header>
          <h2>{col.label} <span class="n">{columns[col.id].length}</span></h2>
          <div class="col-actions">
            {#if columns[col.id].length}
              <button class="mini" onclick={() => selectColumn(col.id)} title="Tout sélectionner" aria-label="Tout sélectionner"><Icon name="square-check" size={14} /></button>
            {/if}
            <button class="mini" onclick={() => (creating = col.id)} title="Ajouter une tâche ici" aria-label="Ajouter dans {col.label}"><Icon name="plus" size={15} /></button>
          </div>
        </header>
        <div class="cards">
          {#each columns[col.id] as t (t.id)}
            <div class="slot" in:receive={{ key: t.id }} out:send={{ key: t.id }} animate:flip={{ duration: 280 }}>
              <TaskCard task={t} selected={selected.has(t.id)} {selecting}
                onselect={() => toggle(t.id)}
                onopen={() => (editing = t)}
                oncycle={() => run(() => setTasksPriority([t.id], nextPriority(t.priority)))}
                ondragstart={(e) => dragStart(e, t)} />
            </div>
          {:else}
            <p class="empty">{col.id === "done" ? "Rien de fini ces 7 derniers jours." : "Glisse une tâche ici."}</p>
          {/each}
        </div>
      </div>
    {/each}
  </div>

  {#if selecting}
    <div class="selbar glass-strong anim-drop" role="toolbar" aria-label="Actions sur la sélection">
      <strong>{selected.size} sélectionnée{selected.size > 1 ? "s" : ""}</strong>
      <span class="sep"></span>
      {#each STATUSES as s (s.id)}
        <button onclick={() => bulkStatus(s.id)}><Icon name="arrow-right" size={13} /> {s.label}</button>
      {/each}
      <Select up label="Priorité" mode="action" placeholder="Priorité…"
        onchange={(v) => bulkPriority(Number(v) as Priority)}
        options={PRIORITIES.map((p) => ({ value: String(p.id), label: p.label, color: p.color }))} />
      <Select up label="Catégorie" mode="action" placeholder="Catégorie…" onchange={bulkCategory} options={[
        ...app.taskCategories.map((c) => ({ value: c.id, label: c.name, color: c.color })),
        { value: NONE, label: "Sans catégorie" },
      ]} />
      <button class="danger" onclick={bulkDelete}>{#if confirmBulkDelete}Confirmer la suppression{:else}<Icon name="trash-2" size={14} /> Supprimer{/if}</button>
      <span class="grow"></span>
      <button class="ghost" onclick={clearSelection}>Annuler (Échap)</button>
    </div>
  {/if}
</section>

{#if editing}
  <TaskDialog task={editing} onsave={saveForm} ondelete={deleteEditing} oncancel={() => (editing = null)} />
{:else if creating}
  <TaskDialog defaultStatus={creating} defaultCategoryId={filter === ALL || filter === NONE ? null : filter}
    onsave={saveForm} oncancel={() => (creating = null)} />
{/if}

<style>
  .board { display: flex; flex-direction: column; gap: 14px; height: 100%; min-height: 0; max-width: 1280px; width: 100%; margin: 0 auto; }
  .filters { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 8px 10px; border-radius: var(--radius); }
  .chip-wrap { display: inline-flex; align-items: center; }
  .chip {
    display: inline-flex; align-items: center; gap: 6px;
    background: var(--surface); border: 1px solid var(--border); color: var(--text);
    border-radius: 999px; padding: 4px 12px; cursor: pointer; font: inherit; font-size: 13px;
  }
  .chip.active { border-color: var(--accent); background: var(--surface-strong); }
  .chip.add { border-style: dashed; color: var(--text-muted); }
  .chip-x {
    background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 14px;
    padding: 0 6px; opacity: 0; transition: opacity 0.1s;
  }
  .chip-wrap:hover .chip-x, .chip-x:focus-visible, .chip-x.confirm { opacity: 1; }
  .chip-x:hover, .chip-x.confirm { color: var(--error); font-size: 12px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; }
  .n { color: var(--text-muted); font-size: 12px; font-variant-numeric: tabular-nums; }
  .muted { color: var(--text-muted); }
  .cat-input {
    background: var(--surface); border: 1px solid var(--accent); border-radius: 999px;
    padding: 4px 12px; color: var(--text); font: inherit; font-size: 13px; outline: none; width: 180px;
  }
  .grow { flex: 1; }
  .new {
    background: var(--accent); color: var(--on-accent); border: none; border-radius: 8px;
    padding: 7px 14px; font: inherit; font-weight: 600; cursor: pointer;
  }
  .columns { display: grid; grid-template-columns: repeat(3, minmax(220px, 1fr)); gap: 14px; flex: 1; min-height: 0; }
  .column {
    display: flex; flex-direction: column; min-height: 0;
    border-radius: var(--radius); padding: 10px;
    transition: border-color 0.1s, background 0.1s;
  }
  .column.drop { border-color: var(--accent); background: var(--accent-faint); }
  .column header { display: flex; justify-content: space-between; align-items: center; padding: 2px 4px 10px; }
  .column h2 { margin: 0; font-size: 13px; font-weight: 600; color: var(--text-muted); }
  .col-actions { display: flex; gap: 2px; }
  .mini { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 15px; padding: 2px 6px; border-radius: 6px; }
  .mini:hover { color: var(--text); background: var(--surface-strong); }
  .cards { display: flex; flex-direction: column; gap: 8px; overflow: auto; flex: 1; min-height: 60px; padding: 2px; }
  .empty { color: var(--text-muted); font-size: 13px; text-align: center; margin: 16px 0; }
  .selbar {
    display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 10px 14px;
    background: var(--glass-bg-strong); -webkit-backdrop-filter: var(--glass-filter); backdrop-filter: var(--glass-filter); box-shadow: var(--glass-rim), var(--glass-shadow); border: 1px solid var(--accent); border-radius: var(--radius);
  }
  .selbar .sep { width: 1px; height: 20px; background: var(--border); }
  .selbar :global(.trigger) { font-size: 13px; padding: 5px 10px; }
  .selbar button {
    background: var(--surface); border: 1px solid var(--border); color: var(--text);
    border-radius: 8px; padding: 5px 10px; cursor: pointer; font: inherit; font-size: 13px;
  }
  .selbar .danger { color: var(--error); border-color: var(--error); }
  .selbar .ghost { background: none; border-color: transparent; color: var(--text-muted); }
</style>
