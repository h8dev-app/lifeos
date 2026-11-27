<script lang="ts">
  import Icon from "../components/Icon.svelte";
  import { onMount } from "svelte";
  import BlockContent from "../components/BlockContent.svelte";
  import { app, guard, say, toggleScreenWidget } from "../lib/app.svelte";
  import { onEscape } from "../lib/overlay";
  import { loadDashboardLayout, saveDashboardLayout } from "../lib/settings";
  import {
    addWidget, bringToFront, clampRect, defaultLayout, dragRect, normalizeLayout, removeWidget,
    snapRect, updateRect, WIDGET_IDS, WIDGETS, type Handle, type MinSize, type Rect, type WidgetId,
  } from "../lib/dashboard/layout";

  // ------------------------------------------------------------ layout
  // Free placement: rectangles in fractions of the home area, overlap
  // allowed, last touched on top. Layout mode (Disposer) to edit.
  let layout = $state<Rect[]>(defaultLayout());
  let editing = $state(false);
  let area: HTMLDivElement;

  onMount(() => {
    loadDashboardLayout().then((raw) => { if (raw !== undefined && raw !== null) layout = normalizeLayout(raw); })
      .catch(() => {});
    // Escape leaves the layout mode before closing the overlay.
    return onEscape(() => { if (!editing) return false; editing = false; drag = null; return true; });
  });

  function commit(next: Rect[]) {
    layout = next;
    guard(() => saveDashboardLayout($state.snapshot(next)));
  }

  const hidden = $derived(WIDGET_IDS.filter((id) => !layout.some((r) => r.id === id)));
  /**
   * DOM order never changes while dragging (moving a node would drop its
   * pointer capture); stacking comes from z-index = position in `layout`.
   */
  const ordered = $derived(WIDGET_IDS.filter((id) => layout.some((r) => r.id === id)));
  const zOf = (id: WidgetId) => layout.findIndex((r) => r.id === id) + 1;

  /** Minimum size of a widget in fractions of the current home area. */
  function minOf(id: WidgetId): MinSize {
    const box = area.getBoundingClientRect();
    return { w: WIDGETS[id].minW / Math.max(box.width, 1), h: WIDGETS[id].minH / Math.max(box.height, 1) };
  }

  // Pointer drag: move from anywhere on the block, resize from the right
  // edge, the bottom edge or the corner. Edges stick to nearby edges
  // (hold Alt to place freely without the magnet).
  type Drag = { id: WidgetId; handle: Handle; startX: number; startY: number; start: Rect; min: MinSize };
  let drag = $state<Drag | null>(null);

  function begin(e: PointerEvent, r: Rect, handle: Handle) {
    if (!editing || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag = { id: r.id, handle, startX: e.clientX, startY: e.clientY, start: { ...r }, min: minOf(r.id) };
    layout = bringToFront(layout, r.id);
  }

  function moveTo(e: PointerEvent) {
    if (!drag) return;
    const box = area.getBoundingClientRect();
    const dx = (e.clientX - drag.startX) / box.width;
    const dy = (e.clientY - drag.startY) / box.height;
    let next = dragRect(drag.start, drag.handle, dx, dy, drag.min);
    if (!e.altKey) next = clampRect(snapRect(next, layout, drag.handle, 8 / box.width), drag.min);
    layout = updateRect(layout, next);
  }

  function end() {
    if (!drag) return;
    drag = null;
    commit(layout);
  }

  /** Layout mode keyboard: arrows move, Shift+arrows resize (1 %, Ctrl: 5 %). */
  function onkey(e: KeyboardEvent, r: Rect) {
    if (!editing) return;
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!d) return;
    e.preventDefault();
    const step = e.ctrlKey ? 0.05 : 0.01;
    const next = e.shiftKey
      ? dragRect(r, "se", d[0] * step, d[1] * step, minOf(r.id))
      : dragRect(r, "move", d[0] * step, d[1] * step, minOf(r.id));
    commit(updateRect(layout, next));
  }

  const pct = (v: number) => `${(v * 100).toFixed(3)}%`;
</script>

<div class="dash" class:editing>
  <div class="tools">
    {#if editing}
      <span class="lbl">Glisse un bloc où tu veux · bords et coin pour la taille · Alt sans aimant</span>
      {#each hidden as id (id)}
        <button class="chip" onclick={() => commit(addWidget(layout, id))}>+ {WIDGETS[id].label}</button>
      {/each}
      <span class="grow"></span>
      <button class="ghost" onclick={() => commit(defaultLayout())}>Réinitialiser</button>
      <button class="primary" onclick={() => (editing = false)}>Terminé</button>
    {:else}
      <span class="grow"></span>
      <button class="ghost edit" onclick={() => (editing = true)} title="Déplacer, redimensionner, masquer les blocs"><Icon name="layout-dashboard" size={14} /> Disposer</button>
    {/if}
  </div>

  <div class="area" bind:this={area}>
    {#if layout.length === 0 && !editing}
      <p class="empty-all">Accueil vide. <button class="link" onclick={() => (editing = true)}>Ajouter des blocs</button></p>
    {/if}
    {#each ordered as id, i (id)}
      {@const r = layout.find((o) => o.id === id)!}
      <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
      <section
        class="w w-{r.id} glass anim-rise"
        style:animation-delay="{i * 45}ms"
        class:dragging={drag?.id === r.id}
        style:left={pct(r.x)} style:top={pct(r.y)} style:width={pct(r.w)} style:height={pct(r.h)}
        style:z-index={zOf(r.id)}
        tabindex={editing ? 0 : undefined}
        aria-label={editing ? `${WIDGETS[r.id].label} : flèches pour déplacer, Maj+flèches pour redimensionner` : undefined}
        onpointerdown={(e) => begin(e, r, "move")}
        onpointermove={moveTo}
        onpointerup={end}
        onpointercancel={end}
        onkeydown={(e) => onkey(e, r)}
      >
        {#if editing}
          <header class="bar">
            <button class="x" onpointerdown={(e) => e.stopPropagation()} onclick={() => commit(removeWidget(layout, r.id))}
              aria-label="Masquer {WIDGETS[r.id].label}" title="Masquer"><Icon name="x" size={12} /></button>
          </header>
        {/if}
        {#if !editing}
          <button class="pin" class:on={app.screenWidgets.includes(r.id)} onclick={() => toggleScreenWidget(r.id)}
            title={app.screenWidgets.includes(r.id) ? "Retirer de l'écran" : "Épingler sur l'écran (reste visible quand LifeOS est masqué)"}
            aria-label="Épingler {WIDGETS[r.id].label} sur l'écran">
            <Icon name="picture-in-picture-2" size={14} />
          </button>
        {/if}
        <div class="body">
          <BlockContent id={r.id} />
        </div>
        {#if editing}
          {#each ["e", "s", "se"] as const as h (h)}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <span class="handle h-{h}" title="Redimensionner" onpointerdown={(e) => begin(e, r, h)}
              onpointermove={moveTo} onpointerup={end} onpointercancel={end}></span>
          {/each}
        {/if}
      </section>
    {/each}
  </div>
</div>

<style>
  .dash { display: flex; flex-direction: column; gap: 8px; height: 100%; min-height: 0; max-width: 1400px; width: 100%; margin: 0 auto; }
  .tools { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-height: 30px; }
  .lbl {
    color: var(--text-muted); font-size: 13px; margin-right: 6px; padding: 4px 10px;
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); text-shadow: none;
  }
  .grow { flex: 1; }
  .tools button {
    background: var(--surface); border: 1px solid var(--border); color: var(--text);
    border-radius: 8px; padding: 4px 12px; cursor: pointer; font: inherit; font-size: 13px;
  }
  .tools .ghost { background: var(--surface); color: var(--text-muted); }
  .tools .ghost:hover { color: var(--text); }
  .tools .edit { opacity: 0.6; }
  .tools .edit:hover { opacity: 1; }
  .tools .primary { border-color: var(--accent); color: var(--accent); }
  .tools .chip { border-style: dashed; border-radius: 999px; }

  .area { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; }
  .empty-all { margin: auto; color: var(--text-muted); }
  .link { background: none; border: none; color: var(--accent); cursor: pointer; font: inherit; padding: 0; }

  .w {
    position: absolute; min-width: 0; min-height: 0; display: flex; flex-direction: column;
    border-radius: var(--radius); container-type: size;
  }
  .body { position: relative; flex: 1; min-height: 0; overflow: auto; padding: 4px 18px 14px; }
  .editing .area {
    background-image: radial-gradient(var(--surface-strong) 1px, transparent 1px);
    background-size: 24px 24px; border-radius: var(--radius);
  }
  .editing .w { cursor: grab; outline: 1px dashed var(--accent); outline-offset: -1px; user-select: none; touch-action: none; }
  .editing .w:focus-visible { outline: 2px solid var(--accent); }
  .editing .body { pointer-events: none; opacity: 0.55; }
  .w.dragging { cursor: grabbing; box-shadow: var(--shadow); }
  .bar { position: absolute; top: 6px; right: 10px; z-index: 1; }
  .x {
    background: var(--popup); border: 1px solid var(--border); border-radius: 50%;
    width: 24px; height: 24px; color: var(--text); cursor: pointer; font-size: 11px; padding: 0;
  }
  .x:hover { color: var(--error); }
  .pin {
    position: absolute; top: 8px; right: 8px; z-index: 1; display: grid; place-items: center;
    width: 26px; height: 26px; padding: 0; border-radius: 8px; border: 1px solid transparent;
    background: none; color: var(--text-muted); cursor: pointer; opacity: 0;
  }
  .w:hover .pin, .pin:focus-visible, .pin.on { opacity: 1; }
  .pin:hover { background: var(--surface); border-color: var(--border); color: var(--text); }
  .pin.on { color: var(--accent); }
  .handle { position: absolute; z-index: 1; touch-action: none; }
  .h-e { top: 12px; bottom: 12px; right: -4px; width: 10px; cursor: ew-resize; }
  .h-s { left: 12px; right: 12px; bottom: -4px; height: 10px; cursor: ns-resize; }
  .h-se {
    right: 2px; bottom: 2px; width: 16px; height: 16px; cursor: nwse-resize;
    border-right: 2px solid var(--accent); border-bottom: 2px solid var(--accent); border-bottom-right-radius: 14px;
  }

  .w-clock .body { padding: 8px; }

</style>
