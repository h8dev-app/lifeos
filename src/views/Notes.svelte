<script lang="ts">
  import Icon from "../components/Icon.svelte";
  import { flip } from "svelte/animate";
  import { onMount } from "svelte";
  import NoteEditor from "../components/NoteEditor.svelte";
  import NewNoteDialog from "../components/NewNoteDialog.svelte";
  import { app, guard, say } from "../lib/app.svelte";
  import { createFolder, createNote, deleteNote, listFolders, listNotes, moveNote, syncNotes, type NoteMeta } from "../lib/db/notes";
  import { formatWhen } from "../lib/clock";
  import { onEscape } from "../lib/overlay";
  import Select from "../components/Select.svelte";

  const ALL = "__all__";

  let notes = $state<NoteMeta[]>([]);
  let folders = $state<string[]>([]);
  let search = $state("");
  let filter = $state<string>(ALL); // ALL, "" (no category) or a folder
  let openId = $state<string | null>(null);
  let creating = $state(false);
  let newFolderMode = $state(false);
  let newFolderName = $state("");
  let selected = $state<Set<string>>(new Set());
  let confirmBulkDelete = $state(false);

  const open = $derived(notes.find((n) => n.id === openId) ?? null);
  const visible = $derived(filter === ALL ? notes : notes.filter((n) => n.folder === filter));
  const count = (f: string) => notes.filter((n) => n.folder === f).length;
  const uncategorized = $derived(count(""));

  async function refresh() {
    const [list, dirs] = await Promise.all([guard(() => listNotes(search)), guard(listFolders)]);
    notes = list ?? [];
    folders = dirs ?? [];
    app.noteFolders = folders;
    if (app.openNoteId) {
      const target = notes.find((n) => n.id === app.openNoteId);
      if (target) { openId = target.id; filter = ALL; }
      app.openNoteId = null;
    }
  }

  onMount(() => {
    guard(syncNotes).then(refresh);
    // Escape: first clears the selection, then (App) closes the overlay.
    return onEscape(() => {
      if (selected.size === 0) return false;
      clearSelection();
      return true;
    });
  });

  // ----- multiple selection
  const selecting = $derived(selected.size > 0);

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

  function cardClick(e: MouseEvent, n: NoteMeta) {
    if (e.ctrlKey || e.metaKey || e.shiftKey || selecting) toggle(n.id);
    else openId = n.id;
  }

  async function bulkMove(folder: string) {
    const list = notes.filter((n) => selected.has(n.id));
    let done = 0;
    for (const n of list) if (await guard(() => moveNote(n, folder))) done++;
    say(`${done} note(s) déplacée(s) dans « ${folder || "Sans catégorie"} ».`);
    clearSelection();
    await refresh();
  }

  async function bulkDelete() {
    if (!confirmBulkDelete) { confirmBulkDelete = true; return; }
    const list = notes.filter((n) => selected.has(n.id));
    let done = 0;
    for (const n of list) if (await guard(async () => { await deleteNote(n); return true; })) done++;
    say(`${done} note(s) mise(s) à la corbeille (notes/.trash).`);
    clearSelection();
    await refresh();
  }

  // Search as you type; also re-read when `/note` or `/bilan` asks to open a note.
  $effect(() => { search; app.openNoteId; refresh(); });

  async function create(title: string, folder: string) {
    creating = false;
    if (folder && !folders.includes(folder)) await guard(() => createFolder(folder));
    const n = await guard(() => createNote(title, folder));
    if (!n) return;
    search = "";
    await refresh();
    openId = n.id;
  }

  async function addFolder() {
    const name = newFolderName.trim();
    newFolderMode = false;
    newFolderName = "";
    if (!name) return;
    const f = await guard(() => createFolder(name));
    if (f) { await refresh(); filter = f; }
  }

  function onsaved(n: NoteMeta) {
    notes = notes.map((x) => (x.id === n.id ? n : x)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async function move(note: NoteMeta, folder: string) {
    const moved = await guard(() => moveNote(note, folder));
    if (!moved) return;
    notes = notes.map((x) => (x.id === moved.id ? moved : x));
    say(`Note déplacée dans « ${folder || "Sans catégorie"} ».`);
  }

  async function remove(note: NoteMeta) {
    const ok = await guard(async () => { await deleteNote(note); return true; });
    if (!ok) return; // the error is already shown
    openId = null;
    say("Note mise à la corbeille (notes/.trash).");
    await refresh();
  }
</script>

<div class="notes">
  <aside class="glass">
    <button class="new" onclick={() => (creating = true)}><Icon name="plus" size={15} /> Nouvelle note</button>
    <input class="search" placeholder="Rechercher dans les notes…" bind:value={search} aria-label="Rechercher" />

    <nav aria-label="Catégories">
      <button class="cat" class:active={filter === ALL} onclick={() => { filter = ALL; openId = null; }}>
        <span>Toutes les notes</span><span class="n">{notes.length}</span>
      </button>
      {#each folders as f (f)}
        <button class="cat" class:active={filter === f} onclick={() => { filter = f; openId = null; }}>
          <span class="fname"><Icon name="folder" size={14} /> {f}</span><span class="n">{count(f)}</span>
        </button>
      {/each}
      {#if uncategorized || folders.length === 0}
        <button class="cat" class:active={filter === ""} onclick={() => { filter = ""; openId = null; }}>
          <span class="muted">Sans catégorie</span><span class="n">{uncategorized}</span>
        </button>
      {/if}
      {#if newFolderMode}
        <!-- svelte-ignore a11y_autofocus -->
        <input class="search" placeholder="Nom de la catégorie" bind:value={newFolderName} autofocus
          onkeydown={(e) => { if (e.key === "Enter") addFolder(); if (e.key === "Escape") { e.stopPropagation(); newFolderMode = false; } }}
          onblur={addFolder} />
      {:else}
        <button class="cat add" onclick={() => (newFolderMode = true)}><Icon name="folder-plus" size={14} /> Catégorie</button>
      {/if}
    </nav>
  </aside>

  <main class="glass">
    {#if open}
      {#key open.id}
        <NoteEditor note={open} {folders} {onsaved}
          onclose={() => (openId = null)}
          onmove={(f) => move(open, f)}
          ondelete={() => remove(open)} />
      {/key}
    {:else}
      {#if selecting}
        <div class="selbar glass-strong anim-drop" role="toolbar" aria-label="Actions sur la sélection">
          <strong>{selected.size} sélectionnée{selected.size > 1 ? "s" : ""}</strong>
          <button onclick={() => (selected = new Set(visible.map((n) => n.id)))}>Tout sélectionner</button>
          <Select label="Déplacer vers" mode="action" placeholder="Déplacer vers…" onchange={bulkMove} options={[
            { value: "", label: "Sans catégorie" },
            ...folders.map((f) => ({ value: f, label: f })),
          ]} />
          <button class="danger" onclick={bulkDelete}>{#if confirmBulkDelete}Confirmer{:else}<Icon name="trash-2" size={14} /> Corbeille{/if}</button>
          <span class="grow"></span>
          <button class="ghost" onclick={clearSelection}>Annuler (Échap)</button>
        </div>
      {/if}
      <h2>
        {filter === ALL ? (search ? `Résultats pour « ${search} »` : "Toutes les notes") : filter || "Sans catégorie"}
        <span class="n">{visible.length}</span>
      </h2>
      {#if visible.length === 0}
        <div class="empty">
          <p>{search ? "Aucune note ne correspond." : "Aucune note ici."}</p>
          <button class="new" onclick={() => (creating = true)}><Icon name="plus" size={15} /> Créer une note</button>
        </div>
      {:else}
        <div class="cards">
          {#each visible as n (n.id)}
            <!-- div, not button: it contains a checkbox (no interactive element inside a button). -->
            <div class="card" class:selected={selected.has(n.id)} role="button" tabindex="0" animate:flip={{ duration: 240 }}
              onclick={(e) => cardClick(e, n)}
              onkeydown={(e) => { if (e.key === "Enter") openId = n.id; if (e.key === " ") { e.preventDefault(); toggle(n.id); } }}>
              <span class="head">
                <input type="checkbox" class="check" class:visible={selecting} checked={selected.has(n.id)}
                  onclick={(e) => { e.stopPropagation(); toggle(n.id); }} aria-label="Sélectionner {n.title}" />
                <span class="t">{n.title}</span>
              </span>
              <span class="x">{n.excerpt || "Note vide"}</span>
              <span class="meta">
                {#if filter === ALL}<span class="tag">{n.folder || "Sans catégorie"}</span>{/if}
                <span>{formatWhen(n.updatedAt)}</span>
              </span>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </main>
</div>

{#if creating}
  <NewNoteDialog {folders} defaultFolder={filter === ALL ? "" : filter} oncreate={create} oncancel={() => (creating = false)} />
{/if}

<style>
  .notes { display: grid; grid-template-columns: 240px 1fr; gap: 24px; height: 100%; max-width: 1280px; width: 100%; margin: 0 auto; min-height: 0; }
  aside { display: flex; flex-direction: column; gap: 10px; min-height: 0; overflow: auto; padding: 14px; border-radius: var(--radius); }
  .new {
    background: var(--accent); color: var(--on-accent); border: none; border-radius: 8px;
    padding: 9px 12px; font: inherit; font-weight: 600; cursor: pointer;
  }
  .new:hover { filter: brightness(1.1); }
  .search {
    background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
    padding: 8px 10px; color: var(--text); outline: none; font: inherit; font-size: 14px;
  }
  .search:focus { border-color: var(--accent); }
  nav { display: flex; flex-direction: column; gap: 2px; margin-top: 6px; }
  .cat {
    display: flex; justify-content: space-between; align-items: center; gap: 8px;
    background: none; border: none; color: var(--text); text-align: left;
    padding: 7px 10px; border-radius: 8px; cursor: pointer; font: inherit; font-size: 14px;
  }
  .cat span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .cat:hover { background: var(--surface); }
  .cat.active { background: var(--surface-strong); }
  .cat.add { color: var(--text-muted); font-size: 13px; }
  .n { color: var(--text-muted); font-size: 12px; font-variant-numeric: tabular-nums; }
  .muted { color: var(--text-muted); }
  main { min-height: 0; min-width: 0; display: flex; flex-direction: column; overflow: auto; padding: 16px; border-radius: var(--radius); }
  h2 { margin: 0 0 14px; font-size: 18px; font-weight: 600; display: flex; gap: 8px; align-items: baseline; }
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
  .card {
    display: flex; flex-direction: column; gap: 6px; text-align: left; min-height: 120px;
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 14px; color: var(--text); cursor: pointer; font: inherit;
  }
  .card:hover { border-color: var(--accent); background: var(--surface-strong); }
  .card:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
  .card { user-select: none; }
  .card.selected { border-color: var(--accent); background: var(--accent-soft); }
  .head { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .check { margin: 0; accent-color: var(--accent); width: 15px; height: 15px; cursor: pointer; opacity: 0; transition: opacity 0.1s; flex-shrink: 0; }
  .card:hover .check, .check.visible, .card.selected .check { opacity: 1; }
  .t { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .selbar {
    display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 10px 14px; margin-bottom: 14px;
    background: var(--glass-bg-strong); -webkit-backdrop-filter: var(--glass-filter); backdrop-filter: var(--glass-filter); box-shadow: var(--glass-rim), var(--glass-shadow); border: 1px solid var(--accent); border-radius: var(--radius);
  }
  .selbar :global(.trigger) { font-size: 13px; padding: 5px 10px; }
  .selbar button {
    background: var(--surface); border: 1px solid var(--border); color: var(--text);
    border-radius: 8px; padding: 5px 10px; cursor: pointer; font: inherit; font-size: 13px;
  }
  .selbar .danger { color: var(--error); border-color: var(--error); }
  .selbar .ghost { background: none; border-color: transparent; color: var(--text-muted); }
  .grow { flex: 1; }
  .x { color: var(--text-muted); font-size: 13px; line-height: 1.4; flex: 1;
    display: -webkit-box; -webkit-line-clamp: 3; line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .meta { display: flex; justify-content: space-between; gap: 8px; color: var(--text-muted); font-size: 12px; }
  .tag { padding: 1px 8px; border-radius: 999px; background: var(--surface-strong); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .empty { color: var(--text-muted); display: flex; flex-direction: column; align-items: flex-start; gap: 10px; }
</style>
