<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { formatDate, formatTime } from "../lib/clock";
  import RecentEntries from "../components/RecentEntries.svelte";
  import TaskList from "../components/TaskList.svelte";
  import Streaks from "../components/Streaks.svelte";
  import ActivitySummary from "../components/ActivitySummary.svelte";
  import AgendaToday from "../components/AgendaToday.svelte";
  import { app, guard, reloadEntries, say } from "../lib/app.svelte";
  import { deleteEntry } from "../lib/db/entries";
  import { startOfDayIso, today } from "../lib/dates";
  import { onEscape } from "../lib/overlay";
  import { loadDashboardLayout, saveDashboardLayout } from "../lib/settings";
  import {
    addWidget, COLS, DEFAULT_LAYOUT, normalizeLayout, place, removeWidget, ROWS, WIDGET_IDS, WIDGETS,
    type Placement, type WidgetId,
  } from "../lib/dashboard/layout";

  let now = $state(new Date());
  const timer = setInterval(() => (now = new Date()), 1000);
  onDestroy(() => clearInterval(timer));

  // Today's open tasks (carried over ones included), then those done today.
  const todayTasks = $derived(
    app.tasks
      .filter((t) => (t.doneAt ? t.doneAt >= startOfDayIso(now) : !t.plannedFor || t.plannedFor <= today(now)))
      .sort((a, b) => Number(!!a.doneAt) - Number(!!b.doneAt) || a.priority - b.priority),
  );

  async function remove(id: string) {
    await guard(async () => {
      await deleteEntry(id);
      await reloadEntries();
      say("Entrée supprimée.");
    });
  }

  // ------------------------------------------------------------ layout
  let layout = $state<Placement[]>(DEFAULT_LAYOUT.map((p) => ({ ...p })));
  let editing = $state(false);
  let grid: HTMLDivElement;

  onMount(() => {
    loadDashboardLayout().then((raw) => { if (raw !== undefined && raw !== null) layout = normalizeLayout(raw); })
      .catch(() => {});
    // Escape leaves the layout mode before closing the overlay.
    return onEscape(() => { if (!editing) return false; editing = false; drag = null; return true; });
  });

  function commit(next: Placement[]) {
    layout = next;
    guard(() => saveDashboardLayout($state.snapshot(next)));
  }

  const hidden = $derived(WIDGET_IDS.filter((id) => !layout.some((p) => p.id === id)));

  function add(id: WidgetId) {
    const next = addWidget(layout, id);
    if (next) commit(next);
    else say(`Pas de place pour « ${WIDGETS[id].label} » : réduis ou masque un bloc.`, "error");
  }

  function reset() {
    commit(DEFAULT_LAYOUT.map((p) => ({ ...p })));
  }

  // Drag (move) and resize with the pointer, snapped to grid cells. While
  // dragging, `preview` shows where everything would go; null = no room.
  type Drag = { id: WidgetId; mode: "move" | "resize"; startX: number; startY: number; start: Placement; target: Placement };
  let drag = $state<Drag | null>(null);
  const preview = $derived(drag ? place(layout, drag.target) : null);
  const shown = $derived(drag && preview ? preview : layout);

  function begin(e: PointerEvent, p: Placement, mode: Drag["mode"]) {
    if (!editing || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag = { id: p.id, mode, startX: e.clientX, startY: e.clientY, start: { ...p }, target: { ...p } };
  }

  function moveTo(e: PointerEvent) {
    if (!drag) return;
    const rect = grid.getBoundingClientRect();
    const gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
    const dx = Math.round((e.clientX - drag.startX) / ((rect.width + gap) / COLS));
    const dy = Math.round((e.clientY - drag.startY) / ((rect.height + gap) / ROWS));
    const s = drag.start;
    const target = drag.mode === "move"
      ? { ...s, x: s.x + dx, y: s.y + dy }
      : { ...s, w: s.w + dx, h: s.h + dy };
    if (target.x !== drag.target.x || target.y !== drag.target.y || target.w !== drag.target.w || target.h !== drag.target.h) {
      drag.target = target;
    }
  }

  function end() {
    if (!drag) return;
    const next = preview;
    const changed = next && JSON.stringify(next) !== JSON.stringify(layout);
    drag = null;
    if (changed) commit(next);
  }

  /** Keyboard in layout mode: arrows move, Shift+arrows resize. */
  function onkey(e: KeyboardEvent, p: Placement) {
    if (!editing) return;
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!d) return;
    e.preventDefault();
    const target = e.shiftKey ? { ...p, w: p.w + d[0], h: p.h + d[1] } : { ...p, x: p.x + d[0], y: p.y + d[1] };
    const next = place(layout, target);
    if (next) commit(next);
  }
</script>

<div class="dash" class:editing>
  <div class="tools">
    {#if editing}
      <span class="lbl">Glisse un bloc pour le déplacer, son coin ◢ pour le redimensionner.</span>
      {#each hidden as id (id)}
        <button class="chip" onclick={() => add(id)}>+ {WIDGETS[id].label}</button>
      {/each}
      <span class="grow"></span>
      <button class="ghost" onclick={reset}>Réinitialiser</button>
      <button class="primary" onclick={() => (editing = false)}>Terminé</button>
    {:else}
      <span class="grow"></span>
      <button class="ghost edit" onclick={() => (editing = true)} title="Déplacer, redimensionner, masquer les blocs">⚙ Disposer</button>
    {/if}
  </div>

  <div class="grid" bind:this={grid} style:--cols={COLS} style:--rows={ROWS}>
    {#if editing}
      {#each Array(COLS * ROWS) as _, i (i)}<div class="cell" style:grid-column={(i % COLS) + 1} style:grid-row={Math.floor(i / COLS) + 1}></div>{/each}
    {/if}
    {#if layout.length === 0 && !editing}
      <p class="empty-all">Accueil vide. <button class="link" onclick={() => (editing = true)}>Ajouter des blocs</button></p>
    {/if}
    {#each shown as p (p.id)}
      <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
      <section
        class="w w-{p.id}"
        class:dragging={drag?.id === p.id}
        class:blocked={drag?.id === p.id && !preview}
        style:grid-column="{p.x + 1} / span {p.w}"
        style:grid-row="{p.y + 1} / span {p.h}"
        tabindex={editing ? 0 : undefined}
        aria-label={editing ? `${WIDGETS[p.id].label} : flèches pour déplacer, Maj+flèches pour redimensionner` : undefined}
        onpointerdown={(e) => begin(e, p, "move")}
        onpointermove={moveTo}
        onpointerup={end}
        onpointercancel={end}
        onkeydown={(e) => onkey(e, p)}
      >
        {#if editing}
          <header class="bar">
            <span>⠿ {WIDGETS[p.id].label}</span>
            <button class="x" onpointerdown={(e) => e.stopPropagation()} onclick={() => commit(removeWidget(layout, p.id))}
              aria-label="Masquer {WIDGETS[p.id].label}" title="Masquer">✕</button>
          </header>
        {/if}
        <div class="body">
          {#if p.id === "clock"}
            <div class="clock">
              <div class="time">{formatTime(now)}</div>
              <div class="date">{formatDate(now)}</div>
            </div>
          {:else if p.id === "streaks"}
            <h2>Séries</h2>
            {#if app.streaks.length}<Streaks />{:else}<p class="empty">Aucune série. Enregistre une entrée deux jours de suite.</p>{/if}
          {:else if p.id === "agenda"}
            <AgendaToday />
          {:else if p.id === "tasks"}
            <h2><button class="title" onclick={() => (app.view = "tasks")}>Tâches du jour</button></h2>
            {#if todayTasks.length}
              <TaskList tasks={todayTasks} compact />
            {:else}
              <p class="empty">Aucune tâche. <code>/tache …</code></p>
            {/if}
          {:else if p.id === "recent"}
            <RecentEntries entries={app.recent} categories={app.categories} ondelete={remove} />
          {:else if p.id === "activity"}
            <ActivitySummary />
          {/if}
        </div>
        {#if editing}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <span class="resize" title="Redimensionner" onpointerdown={(e) => begin(e, p, "resize")}
            onpointermove={moveTo} onpointerup={end} onpointercancel={end}>◢</span>
        {/if}
      </section>
    {/each}
  </div>
</div>

<style>
  .dash { display: flex; flex-direction: column; gap: 8px; height: 100%; min-height: 0; max-width: 1400px; width: 100%; margin: 0 auto; }
  .tools { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-height: 30px; }
  .lbl { color: var(--text-muted); font-size: 13px; margin-right: 6px; }
  .grow { flex: 1; }
  .tools button {
    background: var(--surface); border: 1px solid var(--border); color: var(--text);
    border-radius: 8px; padding: 4px 12px; cursor: pointer; font: inherit; font-size: 13px;
  }
  .tools .ghost { background: none; border-color: transparent; color: var(--text-muted); }
  .tools .ghost:hover { color: var(--text); }
  .tools .edit { opacity: 0.6; }
  .tools .edit:hover { opacity: 1; }
  .tools .primary { border-color: var(--accent); color: var(--accent); }
  .tools .chip { border-style: dashed; border-radius: 999px; }

  .grid {
    flex: 1; min-height: 0; display: grid; gap: 14px;
    grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
    grid-template-rows: repeat(var(--rows), minmax(0, 1fr));
  }
  .cell { border: 1px dashed rgba(255, 255, 255, 0.07); border-radius: 8px; }
  .empty-all { grid-column: 1 / -1; grid-row: 3; text-align: center; color: var(--text-muted); }
  .link { background: none; border: none; color: var(--accent); cursor: pointer; font: inherit; padding: 0; }

  .w {
    position: relative; min-width: 0; min-height: 0; display: flex; flex-direction: column;
    background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius);
    container-type: size;
  }
  .body { flex: 1; min-height: 0; overflow: auto; padding: 4px 16px 14px; }
  .editing .w { cursor: grab; border-style: dashed; border-color: var(--accent); user-select: none; touch-action: none; }
  .editing .w:focus-visible { outline: 2px solid var(--accent); }
  .editing .body { pointer-events: none; opacity: 0.6; }
  .w.dragging { cursor: grabbing; z-index: 2; box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5); }
  .w.blocked { border-color: var(--error); }
  .bar {
    display: flex; align-items: center; justify-content: space-between; padding: 6px 10px 0 14px;
    font-size: 12px; color: var(--accent); text-transform: uppercase; letter-spacing: 1px;
  }
  .x { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 13px; padding: 2px 4px; }
  .x:hover { color: var(--error); }
  .resize {
    position: absolute; right: 4px; bottom: 2px; color: var(--accent); cursor: nwse-resize;
    font-size: 14px; line-height: 1; padding: 4px; touch-action: none;
  }

  .clock { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
  .time { font-size: clamp(24px, min(40cqh, 18cqw), 96px); font-weight: 200; letter-spacing: 2px; line-height: 1.1; }
  .date { color: var(--text-muted); font-size: clamp(12px, 10cqh, 18px); }
  .w-clock .body { padding: 8px; }

  h2 { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); margin: 12px 0; }
  .title { background: none; border: none; padding: 0; font: inherit; color: inherit; text-transform: inherit; letter-spacing: inherit; cursor: pointer; }
  .title:hover { color: var(--text); }
  .empty { color: var(--text-muted); }
  code { font-family: var(--mono); color: var(--text); }
</style>
