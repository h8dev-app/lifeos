<script lang="ts">
  import Icon from "../components/Icon.svelte";
  import { onMount } from "svelte";
  import BlockContent from "../components/BlockContent.svelte";
  import BlockDialog from "../components/BlockDialog.svelte";
  import BlockCatalog from "../components/BlockCatalog.svelte";
  import { app, saveBlocks, toggleScreenWidget } from "../lib/app.svelte";
  import { onEscape } from "../lib/overlay";
  import {
    addBlock, blockTitle, BLOCK_TYPES, bringToFront, clampRect, defaultLayout, dragRect, newBlockId, readingOrder,
    removeBlock, snapRect, updateBlock, type Block, type BlockType, type Handle, type MinSize,
  } from "../lib/dashboard/layout";

  // Home screen: blocks placed freely (fractions of the area), overlap
  // allowed, last touched on top. "Disposer" to move and resize; the ⚙ of a
  // block to rename it and choose what it shows; "Ajouter un bloc" for more.
  let editing = $state(false);
  let catalog = $state(false);
  let settingsOf = $state<Block | null>(null);
  let area: HTMLDivElement;

  onMount(() =>
    // Escape leaves the layout mode before closing the overlay.
    onEscape(() => { if (!editing) return false; editing = false; drag = null; return true; }),
  );

  const commit = (next: Block[]) => saveBlocks(next);

  /**
   * DOM order = reading order, frozen while dragging (moving a node would
   * drop its pointer capture); stacking comes from z-index = position in the list.
   */
  let domOrder = $state<string[]>([]);
  $effect(() => {
    const ids = readingOrder(app.blocks).map((b) => b.id);
    if (!drag) domOrder = ids;
  });
  const byId = $derived(new Map(app.blocks.map((b) => [b.id, b])));
  const zOf = (id: string) => app.blocks.findIndex((b) => b.id === id) + 1;

  /** Minimum size of a block in fractions of the current home area. */
  function minOf(b: Block): MinSize {
    const box = area.getBoundingClientRect();
    const t = BLOCK_TYPES[b.type];
    return { w: t.minW / Math.max(box.width, 1), h: t.minH / Math.max(box.height, 1) };
  }

  function add(type: BlockType) {
    catalog = false;
    const id = newBlockId();
    const next = addBlock(app.blocks, type, id);
    commit(next);
    // Blocks that need a choice (project, note…) open their settings right away.
    if (type === "project" || type === "note" || type === "memo") settingsOf = next.find((b) => b.id === id) ?? null;
  }

  // Pointer drag: move from anywhere on the block, resize from the right
  // edge, the bottom edge or the corner. Edges stick to nearby edges
  // (hold Alt to place freely without the magnet).
  type Drag = { id: string; handle: Handle; startX: number; startY: number; start: Block; min: MinSize };
  let drag = $state<Drag | null>(null);

  function begin(e: PointerEvent, b: Block, handle: Handle) {
    if (!editing || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag = { id: b.id, handle, startX: e.clientX, startY: e.clientY, start: { ...b }, min: minOf(b) };
    app.blocks = bringToFront(app.blocks, b.id);
  }

  function moveTo(e: PointerEvent) {
    if (!drag) return;
    const box = area.getBoundingClientRect();
    const dx = (e.clientX - drag.startX) / box.width;
    const dy = (e.clientY - drag.startY) / box.height;
    let next = dragRect(drag.start, drag.handle, dx, dy, drag.min);
    if (!e.altKey) next = clampRect(snapRect(next, app.blocks, drag.handle, 8 / box.width), drag.min);
    app.blocks = updateBlock(app.blocks, next);
  }

  function end() {
    if (!drag) return;
    drag = null;
    commit(app.blocks);
  }

  /** Layout mode keyboard: arrows move, Shift+arrows resize (1 %, Ctrl: 5 %). */
  function onkey(e: KeyboardEvent, b: Block) {
    if (!editing) return;
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!d) return;
    e.preventDefault();
    const step = e.ctrlKey ? 0.05 : 0.01;
    const next = e.shiftKey
      ? dragRect(b, "se", d[0] * step, d[1] * step, minOf(b))
      : dragRect(b, "move", d[0] * step, d[1] * step, minOf(b));
    commit(updateBlock(app.blocks, next));
  }

  const pct = (v: number) => `${(v * 100).toFixed(3)}%`;
</script>

<div class="dash" class:editing>
  <div class="tools">
    {#if editing}
      <span class="lbl">Glisse un bloc où tu veux · bords et coin pour la taille · Alt sans aimant</span>
      <span class="grow"></span>
      <button class="ghost" onclick={() => (catalog = true)}><Icon name="plus" size={14} /> Ajouter un bloc</button>
      <button class="ghost" onclick={() => commit(defaultLayout())}>Réinitialiser</button>
      <button class="primary" onclick={() => (editing = false)}>Terminé</button>
    {:else}
      <span class="grow"></span>
      <button class="ghost edit" onclick={() => (catalog = true)}><Icon name="plus" size={14} /> Ajouter un bloc</button>
      <button class="ghost edit" onclick={() => (editing = true)} title="Déplacer et redimensionner les blocs"><Icon name="layout-dashboard" size={14} /> Disposer</button>
    {/if}
  </div>

  <div class="area" bind:this={area}>
    {#if app.blocks.length === 0}
      <p class="empty-all">Accueil vide. <button class="link" onclick={() => (catalog = true)}>Ajouter un bloc</button></p>
    {/if}
    {#each domOrder as id, i (id)}
      {@const b = byId.get(id)}
      {#if b}
        <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
        <section
          class="w w-{b.type} glass anim-rise"
          style:animation-delay="{i * 45}ms"
          class:dragging={drag?.id === b.id}
          style:left={pct(b.x)} style:top={pct(b.y)} style:width={pct(b.w)} style:height={pct(b.h)}
          style:z-index={zOf(b.id)}
          tabindex={editing ? 0 : undefined}
          aria-label={editing ? `${blockTitle(b)} : flèches pour déplacer, Maj+flèches pour redimensionner` : blockTitle(b)}
          onpointerdown={(e) => begin(e, b, "move")}
          onpointermove={moveTo}
          onpointerup={end}
          onpointercancel={end}
          onkeydown={(e) => onkey(e, b)}
        >
          <div class="actions" class:always={editing}>
            <button onpointerdown={(e) => e.stopPropagation()} onclick={() => (settingsOf = b)}
              title="Renommer, choisir le contenu" aria-label="Réglages du bloc {blockTitle(b)}">
              <Icon name="settings" size={14} />
            </button>
            {#if editing}
              <button class="x" onpointerdown={(e) => e.stopPropagation()} onclick={() => commit(removeBlock(app.blocks, b.id))}
                aria-label="Supprimer le bloc {blockTitle(b)}" title="Supprimer"><Icon name="x" size={14} /></button>
            {:else}
              <button class:on={app.screenWidgets.includes(b.id)} onclick={() => toggleScreenWidget(b.id)}
                title={app.screenWidgets.includes(b.id) ? "Retirer de l'écran" : "Épingler sur l'écran (reste visible quand LifeOS est masqué)"}
                aria-label="Épingler {blockTitle(b)} sur l'écran">
                <Icon name="picture-in-picture-2" size={14} />
              </button>
            {/if}
          </div>
          <div class="body">
            <BlockContent block={b} onoptions={(options) => commit(app.blocks.map((x) => (x.id === b.id ? { ...x, options } : x)))} />
          </div>
          {#if editing}
            {#each ["e", "s", "se"] as const as h (h)}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <span class="handle h-{h}" title="Redimensionner" onpointerdown={(e) => begin(e, b, h)}
                onpointermove={moveTo} onpointerup={end} onpointercancel={end}></span>
            {/each}
          {/if}
        </section>
      {/if}
    {/each}
  </div>
</div>

{#if catalog}
  <BlockCatalog onpick={add} oncancel={() => (catalog = false)} />
{/if}
{#if settingsOf}
  <BlockDialog block={settingsOf}
    onsave={(b) => { settingsOf = null; commit(app.blocks.map((x) => (x.id === b.id ? b : x))); }}
    ondelete={() => { const id = settingsOf!.id; settingsOf = null; commit(removeBlock(app.blocks, id)); }}
    oncancel={() => (settingsOf = null)} />
{/if}

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
  .w-memo .body { display: flex; flex-direction: column; }
  .w.dragging { cursor: grabbing; box-shadow: var(--shadow); }
  /* Settings and pin buttons, top-right of each block (visible on hover). */
  .actions { position: absolute; top: 8px; right: 8px; z-index: 1; display: flex; gap: 2px; }
  .actions button {
    display: grid; place-items: center; width: 26px; height: 26px; padding: 0; border-radius: 8px;
    border: 1px solid transparent; background: none; color: var(--text-muted); cursor: pointer; opacity: 0;
  }
  .w:hover .actions button, .actions.always button, .actions button:focus-visible, .actions button.on { opacity: 1; }
  .actions button:hover { background: var(--surface); border-color: var(--border); color: var(--text); }
  .actions button.on { color: var(--accent); }
  .actions .x:hover { color: var(--error); }
  .handle { position: absolute; z-index: 1; touch-action: none; }
  .h-e { top: 12px; bottom: 12px; right: -4px; width: 10px; cursor: ew-resize; }
  .h-s { left: 12px; right: 12px; bottom: -4px; height: 10px; cursor: ns-resize; }
  .h-se {
    right: 2px; bottom: 2px; width: 16px; height: 16px; cursor: nwse-resize;
    border-right: 2px solid var(--accent); border-bottom: 2px solid var(--accent); border-bottom-right-radius: 14px;
  }

  .w-clock .body { padding: 8px; }

</style>
