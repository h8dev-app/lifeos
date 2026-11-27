<script lang="ts">
  // A screen widget: one home block alone in a small always-on-top window
  // (own process, see src-tauri/src/widgets.rs). Drag it by its header,
  // resize it by the corner; its place is kept in widget-<id>.json.
  import { onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { getCurrentWindow, LogicalPosition, LogicalSize, PhysicalPosition, PhysicalSize } from "@tauri-apps/api/window";
  import { load } from "@tauri-apps/plugin-store";
  import BlockContent from "./components/BlockContent.svelte";
  import Icon from "./components/Icon.svelte";
  import { app, reloadEntries, reloadProjects, reloadTasks } from "./lib/app.svelte";
  import { loadDashboardLayout, loadSettings, reloadStoreFromDisk } from "./lib/settings";
  import { applyAppearance } from "./lib/theme";
  import { blockTitle, normalizeLayout, type Block, type BlockType } from "./lib/dashboard/layout";

  const win = getCurrentWindow();
  const id = win.label.replace(/^widget-/, "");
  let block = $state<Block | null>(null);

  const VIEW: Partial<Record<BlockType, string>> = {
    agenda: "agenda", tasks: "tasks", project: "projects", projects: "projects", notes: "notes", note: "notes", activity: "activity",
  };
  /** First size of a widget (logical px), by block type. */
  const SIZE: Partial<Record<BlockType, [number, number]>> = {
    clock: [260, 140], streaks: [360, 150], memo: [280, 240], project: [330, 300],
  };
  const REFRESH_MS = 30_000;

  /** Block, theme and panel look as saved by the main window (re-read: they change). */
  async function refreshConfig(): Promise<boolean> {
    await reloadStoreFromDisk();
    const [s, raw] = await Promise.all([loadSettings(), loadDashboardLayout()]);
    applyAppearance({ style: s.style, theme: s.theme, accent: s.accent, panelOpacity: s.panelOpacity, glassBlur: 0 });
    const found = normalizeLayout(raw ?? undefined).find((b) => b.id === id) ?? null;
    if (!found) {
      // The block was deleted from the home screen: close (and unpin) the widget.
      await invoke("widget_quit");
      return false;
    }
    block = found;
    return true;
  }

  async function refreshData() {
    await Promise.allSettled([reloadEntries(), reloadTasks(), reloadProjects()]);
    app.agendaVersion++;
  }

  /** Put the window back where the user left it (or in the top-left corner). */
  async function restorePlace(type: BlockType) {
    const store = await load(`widget-${id}.json`, { autoSave: true, defaults: {} });
    const geom = await store.get<{ x: number; y: number; w: number; h: number }>("geom");
    if (geom && [geom.x, geom.y, geom.w, geom.h].every(Number.isFinite)) {
      await win.setSize(new PhysicalSize(geom.w, geom.h));
      await win.setPosition(new PhysicalPosition(geom.x, geom.y));
    } else {
      const [w, h] = SIZE[type] ?? [330, 380];
      await win.setSize(new LogicalSize(w, h));
      await win.setPosition(new LogicalPosition(24, 56));
    }
    // Remember each move / resize (debounced).
    let timer: ReturnType<typeof setTimeout> | undefined;
    const save = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const [pos, size] = await Promise.all([win.outerPosition(), win.innerSize()]);
        await store.set("geom", { x: pos.x, y: pos.y, w: size.width, h: size.height });
      }, 400);
    };
    await win.onMoved(save);
    await win.onResized(save);
  }

  onMount(() => {
    refreshConfig()
      .then(async (ok) => {
        if (!ok || !block) return;
        refreshData();
        await restorePlace(block.type).catch((e) => console.error("widget place", e));
        await invoke("widget_ready");
      })
      .catch((e) => console.error("widget", e));
    const t = setInterval(() => {
      refreshConfig().catch(() => {});
      refreshData();
    }, REFRESH_MS);
    return () => clearInterval(t);
  });
</script>

<div class="widget glass anim-fade">
  <header data-tauri-drag-region>
    <span class="grip" data-tauri-drag-region><Icon name="grip-horizontal" size={14} /></span>
    <span class="name" data-tauri-drag-region>{block ? blockTitle(block) : ""}</span>
    <button onclick={() => invoke("widget_open_app", { view: (block && VIEW[block.type]) ?? "dashboard" })} title="Ouvrir dans LifeOS" aria-label="Ouvrir dans LifeOS">
      <Icon name="maximize-2" size={13} />
    </button>
    <button onclick={() => invoke("widget_quit")} title="Retirer de l'écran" aria-label="Retirer de l'écran">
      <Icon name="x" size={14} />
    </button>
  </header>
  <div class="body" class:clock={block?.type === "clock"}>
    {#if block}<BlockContent {block} hideTitle editable={false} />{/if}
  </div>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <span class="resize" title="Redimensionner" onpointerdown={(e) => { e.preventDefault(); win.startResizeDragging("SouthEast"); }}></span>
</div>

<style>
  .widget {
    position: fixed; inset: 6px; display: flex; flex-direction: column; overflow: hidden;
    border-radius: var(--radius); container-type: size;
  }
  header {
    display: flex; align-items: center; gap: 6px; padding: 6px 6px 2px 10px; cursor: grab;
    color: var(--text-muted); font-size: 12px; user-select: none;
  }
  .grip { display: inline-flex; opacity: 0.6; }
  .name { flex: 1; font-weight: 600; }
  header button {
    display: grid; place-items: center; width: 22px; height: 22px; padding: 0; border-radius: 6px;
    border: none; background: none; color: var(--text-muted); cursor: pointer; opacity: 0;
  }
  .widget:hover header button { opacity: 1; }
  header button:hover { background: var(--surface); color: var(--text); }
  .body { flex: 1; min-height: 0; overflow: auto; padding: 0 14px 12px; }
  .body.clock { padding: 0 8px 8px; }
  .resize {
    position: absolute; right: 2px; bottom: 2px; width: 14px; height: 14px; cursor: nwse-resize;
    border-right: 2px solid var(--border); border-bottom: 2px solid var(--border); border-bottom-right-radius: 10px;
    opacity: 0;
  }
  .widget:hover .resize { opacity: 1; }
</style>
